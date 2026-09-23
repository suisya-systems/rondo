import {
  type BudgetBasis,
  type BudgetFormula,
  type BudgetValue,
  DEFAULT_REVIEW_ROUNDS,
  type ScopeBudgets,
} from "../../advisory/budget.js";
import {
  FINDING_SEVERITIES,
  type JsonRecord,
  SCOPE_OUTWARD_ACTS,
  type StoredScope,
} from "../../store/records.js";
import { definitionOfDone, planRuleFiles, planTurnTimeoutMs } from "../done.js";
import { draftedStartReadiness } from "../drafted-start.js";
import {
  type DraftedPlanShown,
  type DraftedScopeShown,
  draftedPlansUnder,
  draftedStanding,
} from "../drafted-view.js";
import { hostFailure } from "../host-failure.js";
import { ago } from "../inbox.js";
import { latestReads } from "../issue-read.js";
import { type HeldPlan, heldPlanByDigest, heldPlans } from "../model-draft/host.js";
import type { MintIterationId, MintScopeId, WebPorts } from "../page/contract.js";
import {
  basisWord,
  CARD,
  CARD_HEADING,
  chevron,
  issueNameLink,
  localTime,
  money,
  note,
  PILL,
  PRIMARY,
  TONE,
} from "../page/vocabulary.js";
import { isLive, type PageView, REVIEW_ROUND_CHOICES, viewHref } from "../page-logic/routes.js";
import { firstLine, type Threads, waitingAsk } from "../page-logic/threads.js";
import { approvalTip, heldAgentTypeLines, scopeBudgetsFromStore } from "../scope.js";
import type { Chrome } from "../wording.js";

/** A locator drawn as a chip: quiet, one line, the whole of it in `title`. */
const CHIP =
  "inline-flex max-w-full min-w-0 items-center gap-1 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-id leading-4 text-muted-foreground";

/** {@link basisWord} as this renderer's own chip, for the screens still drawn here. */
function basisChip(
  wording: Chrome,
  basis: Readonly<Record<string, unknown>>,
  threads: Threads,
  root: string | null,
  actorId: string | null,
) {
  const word = basisWord(wording, basis, threads, root, actorId);
  const text = (
    <span class={basis["form"] === "message" ? "max-w-[26rem] truncate" : "truncate font-mono"}>
      {word.said}
    </span>
  );
  return word.href === null ? (
    <span class={`basis ${CHIP}`} title={word.said}>
      {text}
    </span>
  ) : (
    <a
      href={word.href}
      class={`basis ${CHIP} hover:border-ring/60 hover:text-foreground`}
      title={word.said}
    >
      {text}
    </a>
  );
}

const whole = (value: number) => String(Math.trunc(value));

/**
 * Where one number came from, said in the page's language.
 *
 * The basis is facts (`src/advisory/budget.ts`) and the words are the
 * catalogue's, so a Japanese page says them in Japanese -- which is the whole
 * point of showing the evidence at all (D-0071 rule 4.2) and was not true while
 * `computeScopeBudgets` composed the sentence itself.
 */
function basisSaid(wording: Chrome, basis: BudgetBasis): string {
  switch (basis.kind) {
    case "rows":
      return wording.scopeBasisRows(
        basis.measurement,
        basis.iterationIds.length,
        basis.level === "model_tier" ? basis.modelTier : null,
      );
    case "cold_start":
      return wording.scopeBasisColdStart(basis.measurement);
    case "given":
      return basis.given === "plans"
        ? wording.scopeBasisPlans(basis.value)
        : basis.given === "review_rounds"
          ? wording.scopeBasisRounds(basis.value, basis.byDefault)
          : wording.scopeBasisReplyAllowance;
  }
}

/** How one value follows from its bases, in the page's language. */
function formulaSaid(wording: Chrome, formula: BudgetFormula): string {
  switch (formula.kind) {
    case "review_rounds":
      return wording.scopeFormulaRounds;
    case "laps":
      return wording.scopeFormulaLaps(formula.plans, formula.reviewRounds);
    case "cost_reserve_usd":
      return wording.scopeFormulaReserve;
    case "cost_usd":
      return wording.scopeFormulaCost(
        formula.plans,
        money(formula.reserveUsd),
        formula.laterRounds,
        money(formula.redoUsd),
      );
    case "expires_at_ms":
      return wording.scopeFormulaExpires(formula.laps, Math.round(formula.longestMs / 1000));
  }
}

/**
 * One basis of one budget: the sentence it comes to, and a `rows` basis's laps
 * as links into their answer view.
 *
 * **Never an id to copy** ({@link basisChip}'s rule, D-0071 rule 4.2's *"for a
 * screen to link rather than for anyone to copy"*). A `cold_start` or `given`
 * basis names no row, so it is prose and not a link that led nowhere.
 */
function basisRow(wording: Chrome, basis: BudgetBasis) {
  return (
    <p class="basis flex flex-wrap items-baseline gap-x-2 gap-y-1 text-meta leading-5 text-muted-foreground">
      <span>{basisSaid(wording, basis)}</span>
      {/*
       * **A lap is named and not linked.** It used to point at that lap's
       * gate screen; D-0083 rule 3 took the screen away, and a lap's thread
       * is its request's rather than its own, which this basis does not know.
       * Naming it is what rule 4.2 asked for that survives.
       */}
      {basis.kind === "rows"
        ? basis.iterationIds.map((iterationId) => (
            <span class="font-mono text-id">{wording.scopeBasisLap(iterationId)}</span>
          ))
        : null}
    </p>
  );
}

/**
 * **A value that rests on rondo's default says so beside itself** (rondo#378).
 *
 * The formula under it already names the cold start, and lap 11's owner still
 * read $7.50 as a figure somebody had measured: a default drawn exactly like a
 * measurement is read as one. So the sentence sits next to the number, in the
 * words a person uses. A redo cost falling back to the reserve is not counted:
 * that fallback is the reserve, measured or not, and the first-lap basis
 * beside it already says which.
 */
function coldStartNote(wording: Chrome, bases: readonly BudgetBasis[]) {
  const measured = bases.filter(
    (basis) =>
      (basis.kind === "rows" || basis.kind === "cold_start") && basis.measurement !== "redo_cost",
  );
  const cold = measured.filter((basis) => basis.kind === "cold_start").length;
  return cold === 0 ? null : (
    <p class="note text-meta leading-5 text-muted-foreground">
      {wording.scopeColdStartNote(cold === measured.length)}
    </p>
  );
}

/**
 * One budget: the control in a box, the formula quietly under it, and the bases
 * one press away.
 *
 * **Evidence visible but quiet** (D-0071 rule 4.2): every number on this screen
 * was derived from rows, and the derivation is on the screen rather than in a
 * terminal -- folded, because a person reading five budgets is reading five
 * numbers and not forty citations. The control is passed in rather than built
 * here: four of the five are numbers and the fifth is a date, and a field that
 * branched on its own name would be the same code with a switch in it.
 */
function budgetField(
  wording: Chrome,
  name: string,
  label: string,
  control: unknown,
  value: BudgetValue,
  /**
   * The value the box holds, where it may not be the computed one: a drafter's
   * narrowing from the person's own words is theirs, not rondo's default.
   */
  drawn: number = value.value,
) {
  return (
    <div class="min-w-0 space-y-1">
      <label for={name} class="flex flex-col gap-1">
        <span class="text-meta leading-5 font-medium text-muted-foreground">{label}</span>
        {control}
      </label>
      {drawn === value.value ? coldStartNote(wording, value.bases) : null}
      <p class="note text-meta leading-5 text-faint">
        {wording.scopeFormula(formulaSaid(wording, value.formula))}
      </p>
      {value.bases.length === 0 ? null : (
        <details class="group rounded-md border border-border">
          <summary class="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-1.5 text-meta leading-5 text-muted-foreground outline-none select-none hover:bg-accent focus-visible:bg-accent [&::-webkit-details-marker]:hidden">
            {chevron()}
            {wording.scopeBasesFold(value.bases.length)}
          </summary>
          <div class="space-y-1 border-t border-border px-3 py-2">
            {value.bases.map((basis) => basisRow(wording, basis))}
          </div>
        </details>
      )}
    </div>
  );
}

/**
 * What the cost draft assumed, said above the numbers it produced (rondo#247).
 *
 * **Said, not scored.** The draft takes the highest first-lap cost of the laps
 * it measured, and those laps resemble this request only if the work is the
 * same size -- which is what made lap 10 cost $8.46 against laps 6-9's ~$1.
 * The rows record what a lap cost and never how much it did, and the request
 * is one sentence, so no rule here could rank the likeness without inventing a
 * precision nobody measured. The caveat names what the sample shares with this
 * work (the agent type, or only its tier), how far apart it is (lowest to
 * highest), and what it cannot know (size), and says the one thing a person can
 * do about it now, before the first lap spends it (D-0074 lets it be raised
 * later, from the gate).
 */
function sampleCaveat(wording: Chrome, bases: readonly BudgetBasis[]) {
  return (
    <section class={`rounded-md border px-3 py-2 ${TONE.wait} space-y-1`}>
      <h3 class="text-body leading-5 font-semibold">{wording.scopeSampleHeading}</h3>
      {bases.map((basis) =>
        basis.kind === "rows" ? (
          <p class="text-body leading-5 text-foreground">
            {wording.scopeSampleRows(
              basis.iterationIds.length,
              basis.level === "model_tier" ? basis.modelTier : null,
              money(basis.lowest),
              money(basis.value),
            )}
          </p>
        ) : basis.kind === "cold_start" ? (
          <p class="text-body leading-5 text-foreground">
            {wording.scopeSampleColdStart(money(basis.value))}
          </p>
        ) : null,
      )}
    </section>
  );
}

/** The class every budget box carries: one box, one number, no decoration. */
const BOX =
  "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-body leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * The scope screen (rondo#233 S3, D-0066 rule 1): the form rondo drafted, or
 * the approval it recorded with the scoped start beside it.
 *
 * **Two states on one address**, and the address is what carries which: the
 * store holds no listing of a request's scopes and no index by request
 * (`AdvisoryRecord`), so the record press's `303` names the decision it wrote
 * and this renderer reads it back. That read is also the check -- a decision
 * that is not approved, or whose scope does not list this request, shows
 * nothing of itself (`scopeNotThisRequest`), because an address is a thing a
 * person can retype.
 *
 * **It writes nothing on a `GET`**, and it keeps itself current by nothing at
 * all ({@link isLive}).
 */
export async function scopeView(
  ports: WebPorts,
  wording: Chrome,
  view: Extract<PageView, { kind: "scope" }>,
  threads: Threads,
  token: string | null,
  newScopeId: MintScopeId | null,
  newIterationId: MintIterationId | null,
  nowMs: number,
): Promise<unknown> {
  const request = threads.byId.get(view.messageId);
  if (request === undefined) {
    return (
      <p class="note rounded-lg border border-dashed border-border px-5 py-6 text-body">
        {wording.noSuchThread}
      </p>
    );
  }
  const head = (
    <header class="space-y-2">
      <div class="flex min-w-0 items-center gap-2">
        <a
          href={viewHref({ kind: "thread", messageId: view.messageId, to: null }, wording.lang)}
          data-back=""
          class="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          title={wording.backToThread}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="size-4"
          >
            <path d="M13 8H3m4-4-4 4 4 4" />
          </svg>
          <span class="sr-only">{wording.backToThread}</span>
        </a>
        <h2 class="min-w-0 flex-1 truncate text-title leading-6 font-semibold">
          {wording.scopeHeading}
        </h2>
      </div>
      {/* The words the scope is about, as they were written (D-0061 rule 2.2):
          a person drafting a budget is reading what they asked for. */}
      <p
        class="request ml-9 text-title leading-6 wrap-anywhere whitespace-pre-wrap"
        title={request.body}
        lang=""
      >
        {request.body}
      </p>
      {scopeIssues(wording, threads, view.messageId)}
    </header>
  );
  // **The third state** (D-0074 rule 4.2): raising the approval a waiting lap
  // spends, reached only from that lap's gate.
  if (view.raise !== undefined) {
    return (
      <div id="scope" class="space-y-4">
        {head}
        {await raiseForm(ports, wording, view, view.raise, threads, token, newScopeId, nowMs)}
        {scopeDone(wording)}
      </div>
    );
  }
  // **A drafted scope comes first** (rondo#238 C2b): the drafter's, still
  // waiting on the person, or the approval that already decided it. Only a
  // request nothing was drafted for -- or whose draft the person declined --
  // gets the person's own form over a held plan.
  const standing =
    view.decisionId === null
      ? await draftedStanding(ports, view.messageId)
      : ({ kind: "none" } as const);
  const decisionId =
    view.decisionId ?? (standing.kind === "decided" ? standing.scopeDecisionId : null);
  // **No scope is offered while a question waits** (rondo#431): on lap 13 this
  // screen, opened before the drafter asked, took an approval two seconds after
  // the question landed, and the start then failed on that question. The way
  // is to the question; an approval already given keeps its screen.
  const asked = waitingAsk(threads, view.messageId);
  const answerFirst =
    asked === null ? null : (
      <section class="flex flex-col gap-2 rounded-lg border border-wait bg-wait-wash px-4 py-3">
        <p class="text-body leading-6">{wording.scopeAnswerFirst}</p>
        <a
          id={`answer-${view.messageId}`}
          href={viewHref({ kind: "thread", messageId: view.messageId, to: asked }, wording.lang)}
          class={`${PRIMARY} h-10 justify-center self-start px-6 text-sm`}
        >
          {wording.answerAskAction}
        </a>
      </section>
    );
  // A draft written after an approval that stands is shown beside it, never in
  // its place: the approval's starts and "started" links stay where they were.
  const newer =
    view.decisionId === null && standing.kind === "decided" && standing.newer !== null
      ? (answerFirst ?? (
          <section class="space-y-4 border-t border-border pt-4">
            {note(wording.scopeRedrafted)}
            {await draftedForm(ports, wording, view, standing.newer, threads, token, newScopeId)}
          </section>
        ))
      : null;
  const body =
    decisionId !== null ? (
      <>
        {await scopeApproved(ports, wording, view, decisionId, token, newIterationId, nowMs)}
        {newer}
      </>
    ) : answerFirst !== null ? (
      answerFirst
    ) : standing.kind === "drafted" ? (
      await draftedForm(ports, wording, view, standing.drafted, threads, token, newScopeId)
    ) : (
      await scopeForm(ports, wording, view, token, newScopeId, nowMs)
    );
  return (
    <div id="scope" class="space-y-4">
      {head}
      {body}
      {/* Rondo's own definition of done is the same on every lap and long, so
          it sits under whatever is pressed here (D-0106, rondo#408). */}
      {scopeDone(wording)}
    </div>
  );
}

/**
 * Which issues the worker will be given and which it will not, one line each
 * (D-0078 section 4.4): on the screen where the person approves, because what
 * they approve depends on it. Nothing when the request names none.
 */
function scopeIssues(wording: Chrome, threads: Threads, requestMessageId: string) {
  // The latest read of each name, reckoned as the prompt's quote reckons it.
  // A name still to be read again is said as that, not as its older read:
  // the new read replaces it, and nothing starts until it lands.
  const pending = [
    ...new Map(
      threads.messages.flatMap((m) =>
        threads.rootOf(m.messageId) === requestMessageId
          ? (threads.unread.get(m.messageId) ?? []).map((ref) => [ref.named, ref] as const)
          : [],
      ),
    ).values(),
  ];
  const reads = new Map(
    latestReads(threads.messages, requestMessageId)
      .filter((r) => !pending.some((ref) => ref.named === r.named))
      .map((r) => [r.named, r]),
  );
  if (reads.size === 0 && pending.length === 0) {
    return null;
  }
  return (
    <section class="scope-issues ml-9 space-y-1 text-body leading-5">
      <h3 class="text-meta font-medium text-muted-foreground">{wording.scopeIssuesHeading}</h3>
      <ul class="space-y-1">
        {[...reads.values()].map((read) => (
          <li data-issue={"read" in read ? "given" : "not-given"}>
            {issueNameLink(read)}
            {"read" in read ? <span lang=""> {read.read.title}</span> : null}{" "}
            <span class={`${PILL} font-sans ${"read" in read ? TONE.ok : TONE.wait}`}>
              {"read" in read ? wording.scopeIssueGiven : wording.scopeIssueNotGiven}
            </span>
          </li>
        ))}
        {pending.map((ref) => (
          <li data-issue="pending">
            <span class="font-medium">{ref.named}</span>{" "}
            <span class={`${PILL} font-sans ${TONE.muted}`}>{wording.scopeIssuePending}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The definition of done every lap of this request is given after its prompt
 * (D-0089, rondo#377), beside the request: the person approves work whose end
 * is this, so it is on the screen where they approve, as the issues are. Its
 * three asks are the same on every lap; the rule files it points the worker
 * at are a plan's, so {@link planDone} says them where each plan is shown.
 */
function scopeDone(wording: Chrome) {
  return (
    <section class="scope-done ml-9 space-y-1 text-body leading-5">
      <h3 class="text-meta font-medium text-muted-foreground">{wording.scopeDoneHeading}</h3>
      <ul class="space-y-1">
        {wording.scopeDoneAsks.map((ask) => (
          <li>{ask}</li>
        ))}
      </ul>
    </section>
  );
}

/**
 * One plan's part of the definition of done: the rule files it points the
 * worker at, and in a fold the exact words a lap run on it is sent. Drawn
 * beside the plan a start runs on -- for a drafted split, from the template
 * its snapshot froze, which is what `draftedPlanRun` starts.
 */
function planDone(wording: Chrome, document: JsonRecord) {
  const ruleFiles = planRuleFiles(document);
  return (
    <div class="plan-done space-y-1" data-rule-files={ruleFiles.join(" ")}>
      <p class="text-meta leading-5 wrap-anywhere text-muted-foreground">
        {ruleFiles.length === 0 ? wording.scopeDoneNoRules : wording.scopeDoneRules(ruleFiles)}
      </p>
      <details class="group">
        <summary class="flex cursor-pointer list-none items-center gap-2 text-meta leading-5 text-muted-foreground select-none [&::-webkit-details-marker]:hidden">
          {chevron()}
          {wording.scopeDoneExact}
        </summary>
        <p
          class="mt-1 text-meta leading-5 wrap-anywhere whitespace-pre-wrap text-muted-foreground"
          lang="en"
        >
          {definitionOfDone(ruleFiles, planTurnTimeoutMs(document)).trimStart()}
        </p>
      </details>
    </div>
  );
}

/**
 * The plans rondo holds for this request (rondo#238), or the words for why
 * there are none to offer. The same plans the drafter is handed.
 */
async function plansFor(
  ports: WebPorts,
  wording: Chrome,
  messageId: string,
  nowMs: number,
): Promise<{ readonly plans: readonly HeldPlan[] } | { readonly note: string }> {
  try {
    const plans = await heldPlans(
      { store: ports.store, record: ports.record, now: () => nowMs },
      messageId,
    );
    return plans.length === 0 ? { note: wording.scopeNoPlanHeld } : { plans };
  } catch (error) {
    // **No fork here, deliberately** (rondo#349). An errno on this read never
    // reaches this catch: `operatorPage` reads the same rows before it draws
    // this screen and does not catch, so a store this process cannot read has
    // already failed the whole page. What arrives here is a decode this screen
    // can say as it always did.
    return { note: wording.scopePlansUnread(hostFailure(error).text) };
  }
}

/** The plan the address names, wherever rondo holds it, or null (none named, or not held). */
async function chosenPlan(
  ports: WebPorts,
  view: Extract<PageView, { kind: "scope" }>,
  nowMs: number,
): Promise<HeldPlan | null> {
  if (view.plan === null) {
    return null;
  }
  try {
    return await heldPlanByDigest(
      { store: ports.store, record: ports.record, now: () => nowMs },
      view.messageId,
      view.plan,
    );
  } catch {
    return null;
  }
}

/**
 * **What rondo records, folded** (rondo#233 S3, rondo#431): the workspace root,
 * the agent type's tier and grants, the digests. Still on the screen, because
 * what rondo records is what rondo shows; folded, because on lap 13 they were
 * the paths twice, a hash, `standard` and `command.run` in the person's way,
 * and nothing on them is theirs to act on.
 */
function recordedFold(wording: Chrome, lines: readonly string[]) {
  return (
    <details class="group rounded-md border border-border">
      <summary class="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-1.5 text-meta leading-5 text-muted-foreground outline-none select-none hover:bg-accent focus-visible:bg-accent [&::-webkit-details-marker]:hidden">
        {chevron()}
        {wording.scopeRecordedFold}
      </summary>
      <div class="space-y-1 border-t border-border px-3 py-2">
        {lines.map((line) => (
          <p class="font-mono text-id leading-5 wrap-anywhere text-faint">{line}</p>
        ))}
      </div>
    </details>
  );
}

/** One held plan as a person reads it: where it runs, with which agent type, and where it came from. */
function planLine(wording: Chrome, plan: HeldPlan): string {
  return wording.scopePlanLine(
    wording.scopeWorkspace(plan.repository, plan.workspaceRoot),
    plan.agentTypeDigest.slice("sha256:".length, "sha256:".length + 12),
    wording.scopePlanFrom(plan.from.kind),
  );
}

/**
 * The choice of plan, as links in the rounds' shape and for their reason (no
 * form to fight, and the address holds the state): one line per plan saying
 * where it runs and where it came from, the chosen one marked. Drawn only when
 * there is more than one to choose from.
 */
function planChoice(
  wording: Chrome,
  view: Extract<PageView, { kind: "scope" }>,
  plans: readonly HeldPlan[],
  /** The chosen plan's digest, or null when nothing is chosen: every plan is then a link. */
  chosen: string | null,
) {
  // One plan is no choice -- unless nothing is chosen, when it is the way on.
  if (plans.length < 2 && chosen !== null) {
    return null;
  }
  return (
    <section id="plans" class="space-y-1">
      <p class="text-body leading-6 font-medium">{wording.scopePlanAsk}</p>
      <ul class="space-y-1">
        {plans.map((plan) => {
          // **Two choices that read alike say when rondo came to hold each**
          // (D-0075 rule 2.3): a repaired setup and the stale plan it
          // replaced differ in a path this line does not show, and the time
          // is what a person can tell them apart by.
          const line = planLine(wording, plan);
          const alike = plans.filter((other) => planLine(wording, other) === line).length > 1;
          const said = alike
            ? wording.scopePlanHeldAt(line, localTime(plan.heldAtMs).replace("T", " "))
            : line;
          return (
            <li class="text-body leading-5 wrap-anywhere">
              {plan.planDigest === chosen ? (
                <span aria-current="true" class={`${PILL} font-sans ${TONE.ok}`}>
                  {said}
                </span>
              ) : (
                <a
                  href={viewHref({ ...view, plan: plan.planDigest }, wording.lang)}
                  class="rounded-md px-1.5 text-link underline-offset-2 hover:underline"
                >
                  {said}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** State A: the scope the person writes, and the one press that records it and approves it. */
async function scopeForm(
  ports: WebPorts,
  wording: Chrome,
  view: Extract<PageView, { kind: "scope" }>,
  token: string | null,
  newScopeId: MintScopeId | null,
  nowMs: number,
): Promise<unknown> {
  const lead = <p class="text-body leading-6">{wording.scopeLead}</p>;
  // The plan named in the address, wherever rondo holds it -- resolved first,
  // so one chosen earlier stays usable when the list of recent plans no
  // longer shows it -- else the first offered: pasted into this thread, else
  // the one the latest lap ran on (`heldPlans`' order). One named and no
  // longer held is said, with the list to choose from again, and no form:
  // never a different plan under the same address.
  const named = await chosenPlan(ports, view, nowMs);
  const held = await plansFor(ports, wording, view.messageId, nowMs);
  const offered = "plans" in held ? held.plans : [];
  if (named === null && (view.plan !== null || "note" in held)) {
    return (
      <>
        {lead}
        {view.plan !== null ? note(wording.scopePlanGone) : null}
        {"note" in held ? note(held.note) : planChoice(wording, view, offered, null)}
      </>
    );
  }
  const chosen = named ?? (offered[0] as HeldPlan);
  // **The plan answers for a digest the store does not hold yet**, as it did
  // when the plan was a file (rondo#233 S3): a pasted plan's agent type is
  // recorded by the press, and its own input says what it bounds before then.
  const drafted = {
    agentTypeDigest: chosen.agentTypeDigest,
    planDigest: chosen.planDigest,
    workspaces: [{ repository: chosen.repository, workspace_root: chosen.workspaceRoot }],
    heldLines: await heldAgentTypeLines(
      wording,
      ports.record,
      [chosen.agentTypeDigest],
      new Map([[chosen.agentTypeDigest, chosen.agentTypeInput]]),
    ),
  };
  if (token === null || newScopeId === null) {
    return (
      <>
        {lead}
        {note(wording.scopeNoApprover)}
      </>
    );
  }
  const rounds = view.rounds;
  const budgets = await scopeBudgetsFromStore(
    { store: ports.store, record: ports.record },
    {
      agentTypes: [drafted.agentTypeDigest],
      // One plan: the person picks one, and a scope over several is a drafted
      // split's (D-0071 section 4), which this form is not.
      plans: 1,
      ...(rounds === null ? {} : { reviewRounds: rounds }),
      draftedAtMs: nowMs,
    },
  );
  return (
    <>
      {lead}
      {/* What this screen cannot check, said rather than left to be discovered
          (rondo#233 S3 screen review): there is no listing of a request's
          scopes to look in, so a blank draft is not evidence there is none. */}
      <p class="note rounded-md border border-border bg-muted/60 px-3 py-2 text-body leading-5">
        {wording.scopeMaybeApproved}
      </p>
      {planChoice(wording, view, offered, chosen.planDigest)}
      {/*
       * **Explicit links, and not a `method="get"` form** (rondo#233 S3). This
       * view carries no htmx to fight; a `get` form would need every other
       * query as a hidden input to survive a submit, which is a second home for
       * state the address already holds (D-0054); and a link works identically
       * with script off, with no second submit button beside the one that
       * writes. The residual -- choosing a number redraws the boxes from the
       * plan -- is said on the screen rather than discovered.
       */}
      <p id="rounds" class="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-body leading-6">
        <span class="font-medium">{wording.scopeRoundsAsk}</span>
        {REVIEW_ROUND_CHOICES.map((n) =>
          n === (rounds ?? DEFAULT_REVIEW_ROUNDS) ? (
            <span aria-current="page" class={`${PILL} font-sans ${TONE.ok}`}>
              {String(n)}
            </span>
          ) : (
            <a
              href={viewHref({ ...view, rounds: n }, wording.lang)}
              class="rounded-md px-1.5 text-link underline-offset-2 hover:underline"
            >
              {String(n)}
            </a>
          ),
        )}
        <span class="note w-full text-meta leading-5 text-faint">{wording.scopeRoundsRedraw}</span>
      </p>
      <form
        id="scope-form"
        method="post"
        action={`/scope?lang=${encodeURIComponent(wording.lang)}`}
        class="space-y-4"
      >
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="request" value={view.messageId} />
        {/*
         * **Minted when this form is drawn** (D-0061 rule 2.1's reason applied
         * to a scope): one form pressed twice -- a double click, a resend after
         * a slow write -- carries one id, and the store's uniqueness refuses
         * the second rather than recording two scopes the person drafted once.
         */}
        <input type="hidden" name="scope_id" value={newScopeId()} />
        {/*
         * **The two digests this form was drawn from** (rondo#233 S3 press
         * review). The plan is a file, and a file can move between the draw and
         * the press: the write re-reads it, as it must, and would otherwise
         * record a workspace and an agent type nobody saw while satisfying
         * D-0066 rule 2.2's letter. These are not a second authority for what
         * is recorded -- nothing is written from them -- they are what the
         * re-read is compared against, and a difference is a refusal.
         */}
        <input type="hidden" name="plan_digest" value={drafted.planDigest} />
        <input type="hidden" name="agent_type" value={drafted.agentTypeDigest} />
        <div class="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3">
          <p class="note text-meta leading-5 text-muted-foreground">{wording.scopePressNote}</p>
          <button
            type="submit"
            data-row=""
            aria-describedby="scope-plain"
            data-busy={wording.scopeBusy}
            class={`${PRIMARY} h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto sm:self-start`}
          >
            {wording.scopeAction}
          </button>
          <span id="scope-plain" class="note sr-only">
            {wording.scopePlain}
          </span>
        </div>
        {sampleCaveat(wording, budgets.cost_reserve_usd.bases)}
        {budgetBoxes(wording, budgets, true)}
        <section class={`${CARD} space-y-3`}>
          <h3 class={CARD_HEADING}>{wording.scopeDefaultsHeading}</h3>
          <label class="flex flex-col gap-1">
            <span class="text-meta leading-5 font-medium text-muted-foreground">
              {wording.scopeSeverityLabel}
            </span>
            {/* The word, with the enum value it records beside it: the value is
                what `rondo scope` prints and a scope holds (D-0055 rule 3), and
                `blocker` alone was the whole option in both languages. */}
            <select name="severity_threshold" class={BOX}>
              {FINDING_SEVERITIES.map((severity) => (
                <option value={severity} {...(severity === "major" ? { selected: true } : {})}>
                  {`${wording.severityWord(severity)} (${severity})`}
                </option>
              ))}
            </select>
          </label>
          <fieldset class="space-y-1">
            <legend class="text-meta leading-5 font-medium text-muted-foreground">
              {wording.scopeOutwardLabel}
            </legend>
            {SCOPE_OUTWARD_ACTS.map((act) => (
              <label class="flex items-center gap-2 text-body leading-6">
                <input type="checkbox" name="outward_acts" value={act} class="size-3.5" />
                <span>{wording.scopeOutwardAct(act)}</span>
                <span class="font-mono text-id text-faint">{act}</span>
              </label>
            ))}
          </fieldset>
          {/*
           * **Not a box** (rondo#233 S3): `irreversible_additions` adds
           * free-text names to a closed list, and a text field that widens what
           * counts as irreversible by typo is exactly what the screen's own
           * axis forbids. Always empty, and said so rather than hidden.
           */}
          <p class="text-body leading-6">{wording.scopeIrreversibleNone}</p>
          <p class="note text-meta leading-5 text-faint">{wording.scopeDefaultNote}</p>
        </section>
        {/* D-0066's first gate answer, on the screen and not only in a terminal. */}
        <p class="note text-meta leading-5 text-muted-foreground">{wording.scopeCostCaveat}</p>
        {/* **The same press again under the last box** (D-0106, the owner's answer
            to point 2): a person who changed a number at the foot presses here
            rather than scrolling back up; the goal page does the same. */}
        <div class="flex flex-col">
          <button
            type="submit"
            data-row=""
            aria-describedby="scope-plain"
            data-busy={wording.scopeBusy}
            class={`${PRIMARY} h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto sm:self-start`}
          >
            {wording.scopeAction}
          </button>
        </div>
      </form>
      {/* The plan card is what the form runs on, and long: under the form
          and its press rather than above them (D-0106, rondo#408). */}
      <section class={`${CARD} space-y-1`}>
        {/* **The card says what it holds**: the plan, where it runs, and what
            its agent type is allowed. Its heading named only the last of those
            until rondo#233 S3's screen review, so the plan rondo would run was
            the one thing the card never said out loud. */}
        <h3 class={CARD_HEADING}>{wording.scopePlanHeading}</h3>
        {drafted.workspaces.map((workspace) => (
          <p class="text-body leading-5 text-muted-foreground wrap-anywhere">
            {workspace.repository}
          </p>
        ))}
        {planDone(wording, chosen.document)}
        {recordedFold(wording, [
          ...drafted.workspaces.map((workspace) =>
            wording.scopeWorkspace(workspace.repository, workspace.workspace_root),
          ),
          ...drafted.heldLines,
          wording.scopePlanDigest(drafted.planDigest),
        ])}
      </section>
    </>
  );
}

/**
 * The five budget boxes a scope form posts, each with where its number came
 * from: the person's own form and the raise form (D-0074 rule 4.2) draw the
 * same boxes, so a budget is drawn one way whichever screen posts it.
 */
function budgetBoxes(wording: Chrome, budgets: ScopeBudgets, roundsFixed: boolean) {
  return (
    <div class={`${CARD} grid gap-4 sm:grid-cols-2`}>
      {budgetField(
        wording,
        "laps",
        wording.scopeLapsLabel,
        <input
          type="number"
          name="laps"
          id="laps"
          min="0"
          step="1"
          value={whole(budgets.laps.value)}
          class={BOX}
        />,
        budgets.laps,
      )}
      {budgetField(
        wording,
        "review_rounds",
        wording.scopeRoundsLabel,
        // Read-only where the rounds links above change it, since
        // two controls over one number would disagree the moment one moved.
        <input
          type="number"
          name="review_rounds"
          id="review_rounds"
          min="0"
          step="1"
          readonly={roundsFixed}
          value={whole(budgets.review_rounds.value)}
          class={roundsFixed ? `${BOX} bg-muted/60` : BOX}
        />,
        budgets.review_rounds,
      )}
      {budgetField(
        wording,
        "cost_usd",
        wording.scopeCostLabel,
        <input
          type="number"
          name="cost_usd"
          id="cost_usd"
          min="0"
          step="0.01"
          value={money(budgets.cost_usd.value)}
          class={BOX}
        />,
        budgets.cost_usd,
      )}
      {budgetField(
        wording,
        "cost_reserve_usd",
        wording.scopeReserveLabel,
        <input
          type="number"
          name="cost_reserve_usd"
          id="cost_reserve_usd"
          min="0"
          step="0.01"
          value={money(budgets.cost_reserve_usd.value)}
          class={BOX}
        />,
        budgets.cost_reserve_usd,
      )}
      {budgetField(
        wording,
        "expires_at_ms",
        wording.scopeExpiresLabel,
        <input
          type="datetime-local"
          name="expires_at_ms"
          id="expires_at_ms"
          value={localTime(budgets.expires_at_ms.value)}
          class={BOX}
        />,
        budgets.expires_at_ms,
      )}
    </div>
  );
}

/**
 * State C (D-0074 rule 4.2): raising the budget of the approval the lap
 * waiting at a gate spends. What that approval allowed and what it has used;
 * the budgets redrawn from the rows as they are now, so the attempt that used
 * the old ones up is in the sample and the caveat names its cost; that the new
 * budgets count from here on; and, if one stands, the stop that raising does
 * not lift (rule 3.4).
 *
 * **Only budgets are posted.** Everything else the new approval holds is
 * copied by the press from the stored row (rule 1.1), so this screen has no box
 * for any of it. The checks are the press's to make again; the ones made here
 * only keep a form off a screen whose press would be refused.
 */
async function raiseForm(
  ports: WebPorts,
  wording: Chrome,
  view: Extract<PageView, { kind: "scope" }>,
  raise: NonNullable<Extract<PageView, { kind: "scope" }>["raise"]>,
  threads: Threads,
  token: string | null,
  newScopeId: MintScopeId | null,
  nowMs: number,
): Promise<unknown> {
  // The thread the gate is in (D-0083 rule 3); the raise screen is reached
  // from one request's scope, so that request is the way back.
  const gate = viewHref({ kind: "thread", messageId: view.messageId, to: null }, wording.lang);
  const decided = await ports.record.readScopeDecision(raise.decisionId);
  const stored =
    decided.kind === "read" && decided.decision.outcome === "approved"
      ? await ports.record.readScope(decided.decision.scopeId)
      : null;
  if (
    stored === null ||
    stored.kind !== "read" ||
    !stored.scope.payload.requests.includes(view.messageId)
  ) {
    return note(wording.scopeNotThisRequest);
  }
  const tip = await approvalTip(ports.record, raise.iterationId);
  if (tip.kind !== "tip" || tip.scopeDecisionId !== raise.decisionId) {
    return (
      <>
        {note(tip.kind === "forked" ? wording.raiseRefusedForked : wording.raiseNotTip)}
        <a href={gate} class="text-body text-link underline-offset-2 hover:underline">
          {wording.gateBack}
        </a>
      </>
    );
  }
  if (token === null || newScopeId === null) {
    return note(wording.scopeNoApprover);
  }
  const payload = stored.scope.payload;
  const was = payload.budgets;
  const spent = await ports.record.scopeSpent(raise.decisionId);
  const budgets = await scopeBudgetsFromStore(
    { store: ports.store, record: ports.record },
    {
      agentTypes: payload.agent_types,
      plans: 1,
      reviewRounds: was.review_rounds,
      draftedAtMs: nowMs,
    },
  );
  const asks = threads.messages.filter(
    (message) =>
      threads.waiting.has(message.messageId) &&
      threads.rootOf(message.messageId) === view.messageId,
  );
  return (
    <>
      <p class="text-body leading-6">{wording.raiseLead}</p>
      <section class={`${CARD} space-y-1`}>
        <h3 class={CARD_HEADING}>{wording.raiseWasHeading}</h3>
        <p class="text-body leading-6">
          {wording.raiseWas(
            was.laps,
            money(was.cost_usd),
            localTime(was.expires_at_ms).replace("T", " "),
          )}
        </p>
        <p class="text-body leading-6">
          {wording.raiseUsed(spent.admissions, money(spent.readCostUsd), spent.unreadLaps)}
        </p>
      </section>
      {asks.map((ask) => (
        <p class="note rounded-md border border-border bg-muted/60 px-3 py-2 text-body leading-5">
          {wording.raiseAskStands}{" "}
          <a
            href={viewHref({ kind: "thread", messageId: ask.messageId, to: null }, wording.lang)}
            class="text-link underline-offset-2 hover:underline"
          >
            {wording.raiseAskLink}
          </a>
        </p>
      ))}
      <form
        id="raise-form"
        method="post"
        action={`/raise?lang=${encodeURIComponent(wording.lang)}`}
        class="space-y-4"
      >
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="request" value={view.messageId} />
        <input type="hidden" name="raise" value={raise.decisionId} />
        <input type="hidden" name="iteration" value={raise.iterationId} />
        {/* Minted when drawn, as the person's own form's is: one form pressed
            twice records one new approval. */}
        <input type="hidden" name="scope_id" value={newScopeId()} />
        <div class="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3">
          <p class="note text-meta leading-5 text-muted-foreground">{wording.raisePressNote}</p>
          <button
            type="submit"
            data-row=""
            aria-describedby="raise-plain"
            data-busy={wording.scopeBusy}
            class={`${PRIMARY} h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto sm:self-start`}
          >
            {wording.raiseAction}
          </button>
          <span id="raise-plain" class="note sr-only">
            {wording.raisePlain}
          </span>
        </div>
        {sampleCaveat(wording, budgets.cost_reserve_usd.bases)}
        {budgetBoxes(wording, budgets, false)}
        <p class="note text-meta leading-5 text-muted-foreground">{wording.raiseFromHere}</p>
        <p class="note text-meta leading-5 text-muted-foreground">{wording.raiseRetires}</p>
        <p class="note text-meta leading-5 text-muted-foreground">{wording.scopeCostCaveat}</p>
        {/* **The same press again under the last box** (D-0106, the owner's answer
            to point 2): a person who changed a number at the foot presses here
            rather than scrolling back up; the goal page does the same. */}
        <div class="flex flex-col">
          <button
            type="submit"
            data-row=""
            aria-describedby="raise-plain"
            data-busy={wording.scopeBusy}
            class={`${PRIMARY} h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto sm:self-start`}
          >
            {wording.raiseAction}
          </button>
        </div>
      </form>
    </>
  );
}

/** Whether a scope allows a plan: its agent type is listed and its place is one of the scope's. */
function allowedBy(payload: StoredScope["payload"], plan: HeldPlan): boolean {
  return (
    payload.agent_types.includes(plan.agentTypeDigest) &&
    payload.workspaces.some(
      (w) => w.repository === plan.repository && w.workspace_root === plan.workspaceRoot,
    )
  );
}

/**
 * A drafted scope, waiting on the person (rondo#238 C2b, D-0071 rule 5.3): the
 * work rondo proposes, the budgets it computed with where each came from, and
 * one press that approves -- the draft as it stands, or, when a value was
 * changed, the person's version in its place. Which of the two the press is,
 * is decided by the rows (`recordDraftedScopeFromPage`), never by a button.
 */
async function draftedForm(
  ports: WebPorts,
  wording: Chrome,
  view: Extract<PageView, { kind: "scope" }>,
  drafted: DraftedScopeShown,
  threads: Threads,
  token: string | null,
  newScopeId: MintScopeId | null,
): Promise<unknown> {
  const lead = <p class="text-body leading-6">{wording.scopeDraftedLead}</p>;
  const plans = await draftedPlansList(ports, wording, drafted);
  if (token === null || newScopeId === null) {
    return (
      <>
        {lead}
        {plans}
        {note(wording.scopeNoApprover)}
      </>
    );
  }
  const payload = drafted.scope.payload;
  const computed = drafted.computed;
  // **A narrowed value says so, and on whose words** (D-0071 rule 4.1): the
  // winning narrowing of each field, as the drafter's run recorded it, with the
  // person's message it rests on linked rather than paraphrased. Nothing is
  // inferred from the numbers: a value is marked only where a narrowing won.
  const cite = (field: string, said: string) => {
    const by = drafted.narrowed.filter((n) => n.field === field);
    return by.length === 0 ? null : (
      <p class="note flex flex-wrap items-center gap-1.5 text-meta leading-5 text-muted-foreground">
        <span>{said}</span>
        {by.map((n) =>
          // No thread is on this screen, so the chip leads to the thread view
          // at that message rather than to an anchor this page does not draw.
          basisChip(
            wording,
            { form: "message", messageId: n.messageId },
            threads,
            null,
            ports.actorId,
          ),
        )}
      </p>
    );
  };
  const narrowed = (
    field: "laps" | "review_rounds" | "cost_usd" | "expires_at_ms",
    shown: string,
  ) => cite(field === "expires_at_ms" ? "expires_at" : field, wording.scopeNarrowed(shown));
  return (
    <>
      {lead}
      <form
        id="scope-draft-form"
        method="post"
        action={`/scope-draft?lang=${encodeURIComponent(wording.lang)}`}
        class="space-y-4"
      >
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="request" value={view.messageId} />
        {/* The draft by id and by digest: what the press approves is what
            this screen showed, and the store re-reads both (D-0066 rule 2.2). */}
        <input type="hidden" name="draft_scope" value={drafted.scope.scopeId} />
        <input type="hidden" name="draft_digest" value={drafted.scope.scopeDigest} />
        {/* Minted at draw for the person's version, should they change a value. */}
        <input type="hidden" name="scope_id" value={newScopeId()} />
        <div class="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3">
          <p class="note text-meta leading-5 text-muted-foreground">
            {wording.scopeDraftedPressNote}
          </p>
          <button
            type="submit"
            data-row=""
            aria-describedby="scope-draft-plain"
            data-busy={wording.scopeBusy}
            class={`${PRIMARY} h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto sm:self-start`}
          >
            {wording.scopeDraftedAction}
          </button>
          <span id="scope-draft-plain" class="note sr-only">
            {wording.scopeDraftedPlain}
          </span>
        </div>
        {sampleCaveat(wording, computed.cost_reserve_usd.bases)}
        <div class={`${CARD} grid gap-4 sm:grid-cols-2`}>
          <div class="min-w-0 space-y-1">
            {budgetField(
              wording,
              "laps",
              wording.scopeLapsLabel,
              <input
                type="number"
                name="laps"
                id="laps"
                min="0"
                step="1"
                value={whole(payload.budgets.laps)}
                class={BOX}
              />,
              computed.laps,
            )}
            {narrowed("laps", whole(computed.laps.value))}
          </div>
          <div class="min-w-0 space-y-1">
            {budgetField(
              wording,
              "review_rounds",
              wording.scopeRoundsLabel,
              <input
                type="number"
                name="review_rounds"
                id="review_rounds"
                min="0"
                step="1"
                value={whole(payload.budgets.review_rounds)}
                class={BOX}
              />,
              computed.review_rounds,
            )}
            {narrowed("review_rounds", whole(computed.review_rounds.value))}
          </div>
          <div class="min-w-0 space-y-1">
            {budgetField(
              wording,
              "cost_usd",
              wording.scopeCostLabel,
              <input
                type="number"
                name="cost_usd"
                id="cost_usd"
                min="0"
                step="0.01"
                value={money(payload.budgets.cost_usd)}
                class={BOX}
              />,
              computed.cost_usd,
              payload.budgets.cost_usd,
            )}
            {narrowed("cost_usd", money(computed.cost_usd.value))}
          </div>
          {budgetField(
            wording,
            "cost_reserve_usd",
            wording.scopeReserveLabel,
            <input
              type="number"
              name="cost_reserve_usd"
              id="cost_reserve_usd"
              min="0"
              step="0.01"
              value={money(payload.budgets.cost_reserve_usd)}
              class={BOX}
            />,
            computed.cost_reserve_usd,
            payload.budgets.cost_reserve_usd,
          )}
          <div class="min-w-0 space-y-1">
            {budgetField(
              wording,
              "expires_at_ms",
              wording.scopeExpiresLabel,
              <input
                type="datetime-local"
                name="expires_at_ms"
                id="expires_at_ms"
                value={localTime(payload.budgets.expires_at_ms)}
                class={BOX}
              />,
              computed.expires_at_ms,
              payload.budgets.expires_at_ms,
            )}
            {narrowed("expires_at_ms", localTime(computed.expires_at_ms.value))}
          </div>
        </div>
        <section class={`${CARD} space-y-3`}>
          <h3 class={CARD_HEADING}>{wording.scopeDefaultsHeading}</h3>
          <label class="flex flex-col gap-1">
            <span class="text-meta leading-5 font-medium text-muted-foreground">
              {wording.scopeSeverityLabel}
            </span>
            <select name="severity_threshold" class={BOX}>
              {FINDING_SEVERITIES.map((severity) => (
                <option
                  value={severity}
                  {...(severity === payload.severity_threshold ? { selected: true } : {})}
                >
                  {`${wording.severityWord(severity)} (${severity})`}
                </option>
              ))}
            </select>
          </label>
          {cite("severity_threshold", wording.scopeNarrowedStricter)}
          <fieldset class="space-y-1">
            <legend class="text-meta leading-5 font-medium text-muted-foreground">
              {wording.scopeOutwardLabel}
            </legend>
            {SCOPE_OUTWARD_ACTS.map((act) => (
              <label class="flex items-center gap-2 text-body leading-6">
                <input
                  type="checkbox"
                  name="outward_acts"
                  value={act}
                  class="size-3.5"
                  {...(payload.outward_acts.includes(act) ? { checked: true } : {})}
                />
                <span>{wording.scopeOutwardAct(act)}</span>
                <span class="font-mono text-id text-faint">{act}</span>
              </label>
            ))}
          </fieldset>
          <p class="text-body leading-6">
            {payload.irreversible_additions.length === 0
              ? wording.scopeIrreversibleNone
              : payload.irreversible_additions.join(", ")}
          </p>
          {cite("irreversible_additions", wording.scopeNarrowedAdded)}
        </section>
        <p class="note text-meta leading-5 text-muted-foreground">{wording.scopeCostCaveat}</p>
        {/* **The same press again under the last box** (D-0106, the owner's answer
            to point 2): a person who changed a number at the foot presses here
            rather than scrolling back up; the goal page does the same. */}
        <div class="flex flex-col">
          <button
            type="submit"
            data-row=""
            aria-describedby="scope-draft-plain"
            data-busy={wording.scopeBusy}
            class={`${PRIMARY} h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto sm:self-start`}
          >
            {wording.scopeDraftedAction}
          </button>
        </div>
      </form>
      {/* The drafted plans under the form and its press (D-0106, rondo#408):
          the lead above still says the work is below. */}
      {plans}
    </>
  );
}

/** The drafted plans as a person reads them: the words, where each runs, and what it may do. */
async function draftedPlansList(
  ports: WebPorts,
  wording: Chrome,
  drafted: DraftedScopeShown,
  /** The start line under each plan, on an approved scope; absent on the draft. */
  startOf?: (plan: DraftedPlanShown) => Promise<unknown>,
): Promise<unknown> {
  const cards = [];
  for (const plan of drafted.plans) {
    cards.push(
      <li class="space-y-1.5 border-t border-border pt-3 first:border-t-0 first:pt-0">
        <p class="text-body leading-5 font-semibold">{wording.scopeDraftedPlan(plan.index + 1)}</p>
        <p class="text-body leading-5 text-muted-foreground wrap-anywhere">
          {plan.repository === null || plan.workspaceRoot === null
            ? wording.scopeDraftedTemplateGone
            : plan.repository}
        </p>
        {/* The drafter's words for the worker, as it wrote them: their
            language is the template's, not the page's (D-0055 rule 8). */}
        <p
          class="rounded-md border border-border bg-muted/40 px-3 py-2 text-body leading-6 wrap-anywhere whitespace-pre-wrap"
          lang=""
        >
          {plan.split.prompt}
        </p>
        {plan.templatePlan === null ? null : planDone(wording, plan.templatePlan)}
        {recordedFold(wording, [
          ...(plan.repository === null || plan.workspaceRoot === null
            ? []
            : [wording.scopeWorkspace(plan.repository, plan.workspaceRoot)]),
          ...(await heldAgentTypeLines(wording, ports.record, [plan.split.agent_type_digest])),
        ])}
        {startOf === undefined ? null : await startOf(plan)}
      </li>,
    );
  }
  return (
    <section id="drafted-plans" class={`${CARD} space-y-3`}>
      <h3 class={CARD_HEADING}>{wording.scopeDraftedPlansHeading}</h3>
      <ul class="space-y-3">{cards}</ul>
    </section>
  );
}

/**
 * Under an approved scope, one drafted plan's way to start, or why it cannot
 * yet (rondo#238 C2b): a button only where C2a's readiness says the start
 * would go through, and the reason everywhere else -- a refused scoped start
 * writes a stop into the thread, so a button that is sure to fail is not drawn.
 */
async function planStart(
  ports: WebPorts,
  wording: Chrome,
  view: Extract<PageView, { kind: "scope" }>,
  decisionId: string,
  proposalId: string,
  plan: DraftedPlanShown,
  token: string | null,
  newIterationId: MintIterationId | null,
  nowMs: number,
): Promise<unknown> {
  const ready = await draftedStartReadiness(
    { store: ports.store, record: ports.record, policy: ports.policy, nowMs },
    view.messageId,
    decisionId,
    proposalId,
    plan.index,
  );
  const line = (text: string) => (
    <p class="note rounded-md border border-border bg-muted/60 px-3 py-2 text-body leading-5">
      {text}
    </p>
  );
  const startForm = () =>
    token === null || newIterationId === null ? null : (
      <form
        method="post"
        action={`/start-plan?lang=${encodeURIComponent(wording.lang)}`}
        class="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end"
      >
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="request" value={view.messageId} />
        <input type="hidden" name="scope_decision" value={decisionId} />
        <input type="hidden" name="proposal" value={proposalId} />
        <input type="hidden" name="plan_index" value={String(plan.index)} />
        {/* Minted at render, as every start's is: rondo names the lap. */}
        <input type="hidden" name="iteration" value={newIterationId()} />
        <button
          type="submit"
          data-row=""
          title={wording.planStartPlain}
          data-busy={wording.startBusy}
          class={`${PRIMARY} h-9 w-full justify-center px-5 text-sm sm:w-auto`}
        >
          {wording.planStartAction}
        </button>
        <p
          data-busy-note=""
          hidden
          role="status"
          class="note text-meta leading-5 text-muted-foreground sm:basis-full sm:text-right"
        >
          {wording.startBusyNote}
        </p>
      </form>
    );
  switch (ready.kind) {
    case "ready":
      return startForm();
    case "held": {
      // **Who holds the files, by their request** (D-0076 rule 3.3), and the
      // press only where every holder has finished: the attempt is where its
      // landing is read (D-0073 rule 7), and a running holder cannot have landed.
      const holders = await Promise.all(
        ready.holders.map(async ({ line }) => {
          const root = await ports.store.read(line.lineageId);
          return { line, request: root.kind === "read" ? root.record.request : null };
        }),
      );
      const finished = ready.holders.every(({ line }) => !line.inFlight);
      const paths = [...new Set(ready.holders.flatMap(({ paths }) => paths))];
      return (
        <div class="space-y-1.5">
          {line(finished ? wording.planHeldFinished(paths) : wording.planHeld(paths))}
          {holders.map(({ line: holder, request }) => (
            <p class="flex flex-wrap items-baseline gap-x-2 text-body leading-5">
              <span class="text-muted-foreground">{wording.planHeldBy}</span>
              <span class="min-w-0 truncate" lang="">
                {request === null ? "" : firstLine(request)}
              </span>
              {holder.inFlight || token === null || ports.releasable !== true ? null : (
                <a
                  href={viewHref({ kind: "release", iterationId: holder.lineageId }, wording.lang)}
                  class="text-link underline-offset-2 hover:underline"
                >
                  {wording.releaseLink}
                </a>
              )}
            </p>
          ))}
          {finished ? (
            <>
              <p class="text-meta leading-5 text-muted-foreground">{wording.planHeldTry}</p>
              {startForm()}
            </>
          ) : null}
        </div>
      );
    }
    case "started":
      return (
        <p class="note flex flex-wrap items-center gap-x-2 text-body leading-5">
          <span>{wording.planStarted}</span>
          <a
            href={viewHref({ kind: "thread", messageId: view.messageId, to: null }, wording.lang)}
            class="text-link underline-offset-2 hover:underline"
          >
            {wording.planStartedLink}
          </a>
        </p>
      );
    // D-0098 rule 1: no press while `first` has not landed; it starts by itself.
    // ponytail: no sentence of its own yet (rule 8.2's step is page work).
    case "ordered":
      return null;
    case "busy":
      return line(wording.planBusy(ready.limit));
    case "full":
      return line(wording.planFull(ready.live, ready.limit));
    case "outside":
      return line(wording.planOutside(ready.test));
    case "undecidable":
    case "unrunnable":
      return (
        <div class="space-y-1">
          {line(ready.kind === "undecidable" ? wording.planUndecidable : wording.planUnrunnable)}
          <details class="group">
            <summary class="flex cursor-pointer list-none items-center gap-2 text-meta leading-5 text-muted-foreground select-none [&::-webkit-details-marker]:hidden">
              {chevron()}
              {wording.planUnrunnableWhy}
            </summary>
            <p class="mt-1 text-meta leading-5 wrap-anywhere text-muted-foreground" lang="en">
              {ready.reason}
            </p>
          </details>
        </div>
      );
  }
}

/** State B: the approval the press recorded, read back, and the start it allows. */
async function scopeApproved(
  ports: WebPorts,
  wording: Chrome,
  view: Extract<PageView, { kind: "scope" }>,
  /** The decision this address named, already known not to be null. */
  decisionId: string,
  token: string | null,
  newIterationId: MintIterationId | null,
  nowMs: number,
): Promise<unknown> {
  const notThis = (
    <p class="note rounded-md border border-border bg-muted/60 px-3 py-2 text-body leading-5">
      {wording.scopeNotThisRequest}
    </p>
  );
  const decided = await ports.record.readScopeDecision(decisionId);
  if (decided.kind !== "read" || decided.decision.outcome !== "approved") {
    return notThis;
  }
  const stored = await ports.record.readScope(decided.decision.scopeId);
  // **The address is a thing a person can retype**, so the request this screen
  // is about has to be one the approved scope actually names (D-0066 rule
  // 1.2.1). Anything else shows nothing of the scope at all.
  //
  // **The digest is checked and not merely printed.** Scope rows are immutable,
  // so today this cannot diverge; the screen prints the row's digest under the
  // word *approved*, and a heading that vouches for a value it never compared
  // is the kind of thing that stays true until the day it does not.
  if (
    stored.kind !== "read" ||
    !stored.scope.payload.requests.includes(view.messageId) ||
    decided.decision.scopeDigest !== stored.scope.scopeDigest
  ) {
    return notThis;
  }
  const scope = stored.scope;
  const payload = scope.payload;
  // Rule 1.4: an approval a successor retired is not one to start under, and
  // `scopeVerdict` refuses that press at the `superseded` test. Drawing the
  // button anyway would be this screen offering a press it knows cannot work.
  const retired = await ports.record.scopeSupersededByApproved(scope.scopeId);
  const held = await heldAgentTypeLines(wording, ports.record, payload.agent_types);
  // **A drafted scope starts its drafted plans** (rondo#238 C2b): each with
  // its own button, or the reason it cannot start yet, and never the person's
  // held-plan start, which runs the request's own words as the prompt.
  const drafted = await draftedPlansUnder(ports, scope);
  const draftedStarts =
    drafted === null
      ? null
      : await draftedPlansList(ports, wording, drafted, async (plan) =>
          retired
            ? null
            : await planStart(
                ports,
                wording,
                view,
                decisionId,
                drafted.proposalId,
                plan,
                token,
                newIterationId,
                nowMs,
              ),
        );
  // **The plan the start runs on** (rondo#238): one rondo holds whose place and
  // agent type this scope allows -- the one the form was drawn over, carried in
  // the address, or the only one there is. A choice where there are several,
  // and a sentence where there are none, rather than a button that would be
  // refused at the scope's own tests.
  const plans = await plansFor(ports, wording, view.messageId, nowMs);
  const allowed = "plans" in plans ? plans.plans.filter((plan) => allowedBy(payload, plan)) : [];
  // The plan the scope was drawn over is looked up among every plan rondo
  // holds, not only the one of each kind the list offers: a newer lap of the
  // same kind since must not swap it for another without a word.
  const drawn = await chosenPlan(ports, view, nowMs);
  // A plan named in the address and no longer one this scope may run on is
  // said, and the choice put again -- never swapped for another plan silently.
  const gone = view.plan !== null && (drawn === null || !allowedBy(payload, drawn));
  const runsOn = gone ? null : (drawn ?? (allowed.length === 1 ? (allowed[0] as HeldPlan) : null));
  return (
    <>
      {/* **What can be started comes first** (D-0106, rondo#408): the start
          press, the plans to choose from, or why there is none -- then the
          approval it runs under, which is a record and not a thing to do. */}
      {retired ? (
        <p class="note rounded-md border border-border bg-muted/60 px-3 py-2 text-body leading-5">
          {wording.scopeRetired}
        </p>
      ) : null}
      {draftedStarts !== null ? (
        draftedStarts
      ) : retired || token === null || newIterationId === null ? null : runsOn === null &&
        allowed.length === 0 ? (
        <>
          {gone ? note(wording.scopePlanGone) : null}
          {note("plans" in plans ? wording.scopeNoPlanForScope : plans.note)}
        </>
      ) : runsOn === null ? (
        <>
          {gone ? note(wording.scopePlanGone) : null}
          {planChoice(wording, view, allowed, null)}
        </>
      ) : (
        <form
          id="start-form"
          method="post"
          action={`/start?lang=${encodeURIComponent(wording.lang)}`}
          class="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3"
        >
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="request" value={view.messageId} />
          <input type="hidden" name="scope_decision" value={decisionId} />
          <input type="hidden" name="plan" value={runsOn.planDigest} />
          <p class="text-body leading-5 wrap-anywhere text-muted-foreground">
            {`${wording.scopePlanAsk}: ${planLine(wording, runsOn)}`}
          </p>
          {planDone(wording, runsOn.document)}
          {/* Minted at render, as the scope id is, and for its reason: rondo
              names the lap (D-0023) and a double press is one lap. */}
          <input type="hidden" name="iteration" value={newIterationId()} />
          <p class="note text-meta leading-5 text-muted-foreground">{wording.startNote}</p>
          {/* **The one press that spends money, saying what the refusals
              already say** (rondo#244): the join is real, and a guarantee
              nobody is told about is paid for in suspicion. */}
          <p class="note text-meta leading-5 text-muted-foreground">{wording.startAgainSafe}</p>
          <button
            type="submit"
            data-row=""
            aria-describedby="start-plain"
            data-busy={wording.startBusy}
            class={`${PRIMARY} h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto sm:self-end`}
          >
            {wording.startAction}
          </button>
          <p
            data-busy-note=""
            hidden
            role="status"
            class="note text-meta leading-5 text-muted-foreground"
          >
            {wording.startBusyNote}
          </p>
          <span id="start-plain" class="note sr-only">
            {wording.startPlain}
          </span>
        </form>
      )}
      <section class={`${CARD} space-y-1`}>
        <h3 class={CARD_HEADING}>
          {wording.scopeApproved(wording.age(ago(decided.decision.decidedAtMs, nowMs)))}
        </h3>
        <p class="font-mono text-id leading-5 wrap-anywhere text-faint">
          {wording.scopeDigest(scope.scopeDigest)}
        </p>
      </section>
      <section class={`${CARD} space-y-2`}>
        {payload.workspaces.map((workspace) => (
          <p class="text-body leading-5 text-muted-foreground wrap-anywhere">
            {workspace.repository}
          </p>
        ))}
        {recordedFold(wording, [
          ...payload.workspaces.map((workspace) =>
            wording.scopeWorkspace(workspace.repository, workspace.workspace_root),
          ),
          ...held,
        ])}
        <dl class="grid gap-x-4 gap-y-1 text-body leading-6 sm:grid-cols-2">
          {(
            [
              [wording.scopeLapsLabel, whole(payload.budgets.laps)],
              [wording.scopeRoundsLabel, whole(payload.budgets.review_rounds)],
              [wording.scopeCostLabel, money(payload.budgets.cost_usd)],
              [wording.scopeReserveLabel, money(payload.budgets.cost_reserve_usd)],
              [wording.scopeExpiresLabel, localTime(payload.budgets.expires_at_ms)],
              [wording.scopeSeverityLabel, wording.severityWord(payload.severity_threshold)],
              [
                wording.scopeOutwardLabel,
                payload.outward_acts.length === 0
                  ? wording.scopeOutwardNone
                  : payload.outward_acts.map((act) => wording.scopeOutwardAct(act)).join(", "),
              ],
            ] as const
          ).map(([label, value]) => (
            <div class="flex min-w-0 items-baseline justify-between gap-3 border-b border-border/60 py-0.5">
              <dt class="text-meta text-muted-foreground">{label}</dt>
              <dd class="font-mono text-meta">{value}</dd>
            </div>
          ))}
        </dl>
        <p class="text-body leading-6">
          {payload.irreversible_additions.length === 0
            ? wording.scopeIrreversibleNone
            : payload.irreversible_additions.join(", ")}
        </p>
      </section>
      {/* Rule 1.4: approving a successor retires the predecessor's approval, so
          what that approval already spent is part of what was decided. */}
      {scope.supersedesScopeId === null ? null : (
        <p class="note text-meta leading-5 text-muted-foreground">
          {await predecessorLine(ports, wording, scope)}
        </p>
      )}
      <p class="note text-meta leading-5 text-muted-foreground">{wording.scopeCostCaveat}</p>
    </>
  );
}

/** What the scope this one replaces has spent, or why that could not be read. */
async function predecessorLine(
  ports: WebPorts,
  wording: Chrome,
  scope: StoredScope,
): Promise<string> {
  const supersedes = scope.supersedesScopeId;
  if (supersedes === null) {
    return wording.scopePredecessorNoApproval;
  }
  const prior = await ports.record.scopeDecisionOf(supersedes);
  if (prior.kind === "unreadable") {
    return wording.scopePredecessorUnreadable(prior.reason);
  }
  if (prior.kind !== "read" || prior.decision.outcome !== "approved") {
    return wording.scopePredecessorNoApproval;
  }
  const spent = await ports.record.scopeSpent(prior.decision.scopeDecisionId);
  return wording.scopePredecessorSpent(
    spent.admissions,
    money(spent.readCostUsd),
    spent.unreadLaps,
  );
}
