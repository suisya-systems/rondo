/**
 * The box a person writes into, under the thread or the requests: the composer
 * form, and the raise and revise fields it carries when it answers a waiting
 * question (rondo#341 moved it out of `src/access/web.tsx`).
 */
import { requestsGoal, type ScopePayload } from "../../store/records.js";
import { basisOf } from "../explainer/material.js";
import { ago } from "../inbox.js";
import { type PageView, viewHref } from "../page-logic/routes.js";
import { lineOf, replyTarget, type Threads } from "../page-logic/threads.js";
import { approvalTip, stopRaises } from "../scope.js";
import type { Chrome } from "../wording.js";
import type { MintMessageId, WebPorts } from "./contract.js";
import { kbd } from "./document.js";
import { scopeStop } from "./thread-stops.js";
import { localTime, money, PRIMARY, SECONDARY, whoWrote } from "./vocabulary.js";

/** A pull request body split around the request fold it carries. */

/**
 * The raise's fields in a budget stop's answering box (D-0140 rule 3): the
 * amount, prefilled with what the approval allowed, and the approval's other
 * budgets carried as drawn, so the press posts what the raise screen's form
 * would. What is left, beside the reserve one more try holds, is said above it.
 */
function raiseFields(wording: Chrome, raise: BudgetRaise) {
  const b = raise.budgets;
  return (
    <div class="mx-4 mt-2 space-y-1">
      <input type="hidden" name="raise" value={raise.scopeDecisionId} />
      <input type="hidden" name="iteration" value={raise.iterationId} />
      <input type="hidden" name="request" value={raise.requestMessageId} />
      <input type="hidden" name="laps" value={String(b.laps)} />
      {raise.rounds ? null : (
        <input type="hidden" name="review_rounds" value={String(b.review_rounds)} />
      )}
      <input type="hidden" name="cost_reserve_usd" value={money(b.cost_reserve_usd)} />
      <input type="hidden" name="expires_at_ms" value={localTime(b.expires_at_ms)} />
      <p class="text-meta leading-5 text-muted-foreground">
        {wording.answerRaiseLeft(
          money(raise.leftUsd),
          money(b.cost_reserve_usd),
          raise.leftUsd >= b.cost_reserve_usd,
        )}
      </p>
      <label class="flex items-center gap-2 text-meta leading-5 text-muted-foreground">
        <span>{wording.answerRaiseLabel}</span>
        <input
          type="number"
          name="cost_usd"
          // Kept across the redraw while it is this question's over this
          // approval (`page/composer.js`, Codex).
          data-keep={`raise:${raise.iterationId}:${raise.scopeDecisionId}`}
          min="0.01"
          step="0.01"
          value={money(b.cost_usd)}
          class="w-28 rounded-md border border-border bg-background px-2 py-1 text-body leading-5"
        />
      </label>
      {/* A stop on spent review rounds (rondo#512): rounds are counted along
          the line, so one more than approved is what lets the next try run. */}
      {raise.rounds ? (
        <label class="flex items-center gap-2 text-meta leading-5 text-muted-foreground">
          <span>{wording.answerRaiseRoundsLabel}</span>
          <input
            type="number"
            name="review_rounds"
            data-keep={`rounds:${raise.iterationId}:${raise.scopeDecisionId}`}
            min="1"
            step="1"
            value={String(b.review_rounds + 1)}
            class="w-20 rounded-md border border-border bg-background px-2 py-1 text-body leading-5"
          />
        </label>
      ) : null}
    </div>
  );
}

/**
 * A budget stop's raise, drawn in its answering box (D-0140 rule 3): the lap,
 * the approval its next try would spend, that approval's budgets for the
 * successor to start from, and what is left of it by the admission arithmetic
 * (D-0066 rule 3.4.2).
 */
interface BudgetRaise {
  readonly iterationId: string;
  readonly requestMessageId: string;
  readonly scopeDecisionId: string;
  readonly budgets: ScopePayload["budgets"];
  readonly leftUsd: number;
  /** Whether what ran out is the review rounds, drawn as a box of their own. */
  readonly rounds: boolean;
}

/**
 * A budget stop whose line's approval is a paused goal scope's (D-0148, rondo#524):
 * the raise would carry the pause's `laps: 0` and stop again, so the box says
 * the work is paused and links to where it is resumed, the goal's repository.
 */
interface PausedStop {
  readonly pausedRepository: string | null;
}

/**
 * The raise each budget stop waiting in `root`'s thread offers, by the ask's
 * id: a `lap-stopped-` ask over a lap that ended `budget`, or a scope's stop
 * on spent review rounds or cost (`stopRaises`) over a lap still at its gate
 * (rondo#512: the stop's words name this press, and the gate's raise link is
 * drawn only for a spent budget) or over the start again of a lap the budget
 * stopped (D-0149), whose line has one approved tip that reads.
 * Anything else offers none, and its box is the two answers it always had.
 */
export async function budgetRaises(
  ports: WebPorts,
  threads: Threads,
  root: string,
): Promise<ReadonlyMap<string, BudgetRaise | PausedStop>> {
  const raises = new Map<string, BudgetRaise | PausedStop>();
  for (const message of threads.messages) {
    const raising = scopeStop(message) ? stopRaises(message.body) : null;
    const stoppedByScope = raising !== null;
    if (
      !(message.messageId.startsWith("lap-stopped-") || stoppedByScope) ||
      !threads.waiting.has(message.messageId) ||
      threads.rootOf(message.messageId) !== root
    ) {
      continue;
    }
    const iterationId = message.bases.find((basis) => basis["form"] === "iteration")?.[
      "iterationId"
    ];
    if (typeof iterationId !== "string") continue;
    const found = await ports.store.read(iterationId);
    if (
      found.kind !== "read" ||
      !(
        (stoppedByScope &&
          found.record.status === "awaiting_human" &&
          found.record.gateId !== null) ||
        // A budget-stopped lap, whose own stop or whose start again's scope
        // stop (D-0149: carried on under the same budget and refused at the
        // cost test) is answered by raising.
        (found.record.status === "failed" && found.record.failureKind === "budget")
      )
    ) {
      continue;
    }
    const tip = await approvalTip(ports.record, iterationId);
    if (tip.kind !== "tip") continue;
    const decided = await ports.record.readScopeDecision(tip.scopeDecisionId);
    if (decided.kind !== "read") continue;
    const stored = await ports.record.readScope(decided.decision.scopeId);
    if (stored.kind !== "read") continue;
    const budgets = stored.scope.payload.budgets;
    const goalId = requestsGoal(stored.scope.payload.requests);
    if (goalId !== null && budgets.laps === 0) {
      const goal = (await ports.record.goals()).find((one) => one.goalId === goalId);
      raises.set(message.messageId, { pausedRepository: goal?.repository ?? null });
      continue;
    }
    const spent = await ports.record.scopeSpent(tip.scopeDecisionId);
    raises.set(message.messageId, {
      iterationId,
      requestMessageId: found.record.requestMessageId,
      scopeDecisionId: tip.scopeDecisionId,
      budgets,
      leftUsd: Math.max(
        0,
        budgets.cost_usd - spent.readCostUsd - spent.unreadLaps * budgets.cost_reserve_usd,
      ),
      rounds: raising === "rounds",
    });
  }
  return raises;
}

/**
 * A worker's question at its gate, answered in the thread's box (D-0142):
 * the lap, the approval its next attempt spends, the successor minted at
 * render, and the change the reading drafted, which the box shows above its
 * buttons and posts as shown -- so *carry on* is the gate's revise.
 */
export interface AnswerRevise {
  readonly iterationId: string;
  readonly scopeDecisionId: string;
  readonly successor: string;
  readonly draft: string;
}

/** The answer box's revise fields, and the drafted change it carries, where there is one. */
function answerReviseFields(wording: Chrome, revise: AnswerRevise) {
  return (
    <div class="mx-4 mt-2 space-y-1">
      <input type="hidden" name="revise_iteration" value={revise.iterationId} />
      <input type="hidden" name="revise_decision" value={revise.scopeDecisionId} />
      <input type="hidden" name="revise_successor" value={revise.successor} />
      <p class="text-meta leading-5 text-muted-foreground">{wording.answerReviseNote}</p>
      {revise.draft === "" ? null : (
        <>
          <input type="hidden" name="revise_draft" value={revise.draft} />
          <p class="text-meta leading-5 text-muted-foreground">{wording.answerReviseDraftLead}</p>
          {/* The reviewer's words, so the block states no language. */}
          <pre
            lang=""
            class="max-h-48 overflow-auto rounded-md border border-border bg-muted/60 px-3 py-2 text-meta leading-5 whitespace-pre-wrap"
          >
            {revise.draft}
          </pre>
        </>
      )}
    </div>
  );
}

/**
 * The box a person writes into: a new request on `requests`, a reply on
 * `thread` (D-0061 rule 4, D-0059 section 5a's send).
 *
 * **Outside the ledger, so no redraw touches a draft.** The poll swaps
 * `#ledger`; this form is after it, and what a send must renew -- the minted
 * id, the reply's target, a refusal note -- is `#composer-fields`, which only
 * this form's own response replaces (`hx-select-oob`).
 *
 * **Two ways to send, one route.** With script off it is a native `POST` and
 * the `303` lands on the thread at the message sent. With script on a reply is
 * htmx's `hx-post`: the thread is swapped in, the box stays where it is, and
 * `page/composer.js` clears the draft. A new request stays a native submit,
 * because where it lands is a different view -- its own thread -- and a swap
 * would draw that thread under the requests' address.
 *
 * **Aimed at a waiting question, the box is a press** (#220 S1): action
 * `/answer-ask`, a native `POST` with no `hx-post` in either mode, and a filled
 * button labelled as answering. Answering an ask releases the hold D-0069
 * rule 5 puts on work, and D-0059 section 5a's falsifier says a message that
 * moves work needs a press, which only a person's navigation mints.
 *
 * **The id is minted here, at render, and carried hidden** (D-0061 rule 2.1):
 * the same form sent twice is one id, and the store refuses the second. It is
 * never printed. With no approver there is no form, and the box's place says
 * why (D-0020 rule 2).
 */
export function composerView(
  wording: Chrome,
  view: PageView,
  threads: Threads,
  token: string | null,
  newId: MintMessageId | null,
  actorId: string | null,
  nowMs: number,
  /**
   * The drafted request a person took from a triage proposal (D-0097 point
   * 4.4), which the new-request box is drawn holding; `key` names the take, so
   * `page/composer.js` lets it win over a kept unsent draft once.
   */
  taken: { readonly key: string; readonly text: string } | null = null,
  /** The raise each budget stop offers, by the ask's id (D-0140 rule 3). */
  raises: ReadonlyMap<string, BudgetRaise | PausedStop> = new Map(),
  /** The worker's question at its gate this box can answer by revising (D-0142). */
  answerRevise: AnswerRevise | null = null,
) {
  if (view.kind !== "requests" && view.kind !== "thread") {
    return null;
  }
  if (token === null || newId === null) {
    return (
      <p class="note rounded-md border border-border bg-muted/60 px-3 py-2 text-body leading-5">
        {wording.composerNoApprover}
      </p>
    );
  }
  const replying = view.kind === "thread" ? replyTarget(threads, view, actorId) : null;
  if (view.kind === "thread" && replying === null) {
    return null;
  }
  const kind = replying === null ? "request" : "reply";
  // **A "?" was pressed** (rondo#401, D-0177): the box asks rondo about what it
  // was pressed beside, so it is never the answering press, whatever it aims at.
  const ask = view.kind === "thread" && replying !== null ? (view.ask ?? null) : null;
  const about = ask === null ? null : basisOf(ask);
  const asking = about !== null;
  const answers = !asking && replying?.answers === true;
  const cited = about?.form === "message" ? threads.byId.get(about.messageId) : undefined;
  const asked =
    wording.askPrefill + (cited === undefined ? "" : `\n${wording.askQuote(lineOf(cited))}`);
  const offered =
    answers && replying !== null ? (raises.get(replying.target.messageId) ?? null) : null;
  const raise = offered !== null && "budgets" in offered ? offered : null;
  const paused = offered !== null && "pausedRepository" in offered ? offered : null;
  const revising =
    answers &&
    answerRevise !== null &&
    replying?.target.messageId === `question-${answerRevise.iterationId}`
      ? answerRevise
      : null;
  const lang = `?lang=${encodeURIComponent(wording.lang)}`;
  const action = `/${answers ? "answer-ask" : asking ? "question" : kind}${lang}`;
  return (
    <form
      id="composer"
      method="post"
      action={action}
      {...(replying === null || answers
        ? {}
        : {
            "hx-post": action,
            "hx-target": "#ledger",
            "hx-select": "#ledger",
            // No `show:`: the box and the newest message are both at the top
            // of the thread now (D-0106), so the window stays where it is.
            "hx-swap": "outerHTML",
            // **The form is inside what the swap replaces now** (D-0083 rule
            // 5, Codex). It used to sit outside `#ledger` and be swapped out
            // of band, so that a send could change its mode -- the thread's
            // default target after a send can be a waiting ask, and answering
            // one is a press with its own `action` and no `hx-post`. The
            // ordinary swap carries the new form now, and naming it here as
            // well took it out of the response before the ledger landed, so
            // the box disappeared until the next poll.
            "hx-select-oob": "#waiting-count",
            // **One send per press, visibly** (the S1 design pass): every
            // submit is disabled while a request is in flight -- Send and
            // *Ask rondo* both, since `find` takes only the first match. The
            // store's refusal of a repeated id is still what makes a double
            // send one message.
            "hx-disabled-elt":
              "find button[type='submit']:not([formaction]), find button[formaction]",
          })}
      class={
        replying === null
          ? "rounded-xl border border-border bg-card shadow-xs focus-within:border-ring/60"
          : "mt-4 mb-3 rounded-xl border border-border bg-card shadow-xs focus-within:border-ring/60"
      }
    >
      {replying === null ? (
        <h2 class="px-4 pt-3 text-sm leading-6 font-semibold">{wording.newRequestHeading}</h2>
      ) : null}
      <div id="composer-fields">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="message_id" value={newId(kind)} />
        {replying === null ? null : (
          <>
            <input type="hidden" name="in_reply_to" value={replying.target.messageId} />
            {/* What the question is about, by its locator: never on screen (D-0076). */}
            {asking ? <input type="hidden" name="about" value={ask ?? ""} /> : null}
            <div class="mx-4 mt-2.5 flex min-w-0 items-center gap-1">
              <a
                href={`#${encodeURIComponent(replying.target.messageId)}`}
                class="replying flex min-w-0 items-center gap-1.5 text-meta leading-5 text-muted-foreground hover:text-foreground"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="size-3.5 shrink-0 text-faint"
                >
                  <path d="M3.5 2.5v5a3 3 0 0 0 3 3h6m-3-3 3 3-3 3" />
                </svg>
                <span class="truncate">
                  {(answers ? wording.answeringTo : wording.replyingTo)(
                    whoWrote(wording, replying.target, actorId),
                    wording.age(ago(replying.target.atMs, nowMs)),
                  )}
                </span>
              </a>
              {
                // **A target chosen by hand can be let go** (the S1 design
                // pass): a navigation back to the thread's default target, which
                // keeps the draft (`page/composer.js`).
                view.kind === "thread" && (view.to !== null || asking) ? (
                  <a
                    href={viewHref(
                      { kind: "thread", messageId: replying.root, to: null },
                      wording.lang,
                    )}
                    class="inline-flex size-5 shrink-0 items-center justify-center rounded text-faint hover:bg-accent hover:text-foreground"
                    title={wording.replyDefault}
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      class="size-3"
                    >
                      <path d="m4 4 8 8m0-8-8 8" />
                    </svg>
                    <span class="sr-only">{wording.replyDefault}</span>
                  </a>
                ) : null
              }
            </div>
            {/*
             * **Said where the words are typed** (#220 S1 review): a person who
             * came for a question waiting in this thread would otherwise send
             * their answer to the message above and see nothing say it did not
             * reach the question (see `replyTarget`).
             */}
            {replying.asksWaiting && !answers ? (
              <p class="not-answer mx-4 mt-0.5 text-meta leading-5 text-faint">
                {wording.replyNotAnswer}
              </p>
            ) : null}
            {raise === null ? null : raiseFields(wording, raise)}
            {paused === null ? null : (
              <p class="mx-4 mt-2 text-meta leading-5 text-muted-foreground">
                {wording.answerRaisePaused}{" "}
                {paused.pausedRepository === null ? null : (
                  <a
                    href={viewHref(
                      { kind: "goalScope", repository: paused.pausedRepository },
                      wording.lang,
                    )}
                    class="text-link underline-offset-2 hover:underline"
                  >
                    {wording.triageGoalScopeResume}
                  </a>
                )}
              </p>
            )}
            {revising === null ? null : answerReviseFields(wording, revising)}
          </>
        )}
        {/* Where htmx puts a refusal (the page's `responseHandling`); the draft stays. */}
        <p
          id="composer-note"
          role="status"
          data-refused={wording.notSent(wording.sendRefusedUnknown)}
          class="px-4 pt-2 text-body leading-5 text-fail empty:hidden"
        />
      </div>
      <label for="composer-body" class="sr-only">
        {replying === null
          ? wording.newRequestHeading
          : answers
            ? wording.answerAskAction
            : asking
              ? wording.askSubmit
              : wording.replyAction}
      </label>
      <textarea
        id="composer-body"
        name="body"
        // An answer is its press (rondo#512): words beside it are optional.
        required={!answers}
        rows={replying === null ? 4 : 3}
        placeholder={replying === null ? wording.requestPlaceholder : wording.replyPlaceholder}
        // A question keeps its own draft: pressing "?" leaves an unsent reply
        // where it was, and leaving question mode leaves the question behind.
        data-draft={replying === null ? "request" : `${asking ? "ask" : "reply"}:${replying.root}`}
        {...(replying === null && taken !== null
          ? { "data-draft-take": taken.key, autofocus: true }
          : {})}
        {...(view.kind === "thread" && view.to !== null ? { autofocus: true } : {})}
        {...(asking ? { "data-draft-take": `ask:${ask ?? ""}`, autofocus: true } : {})}
        // **The box grows with the words** (the S1 design pass): at a fixed
        // two rows a three-line draft scrolled its first line out of sight
        // under the line above it. Capped, then it scrolls.
        class="block max-h-[40vh] min-h-[4.5rem] w-full resize-y bg-transparent px-4 pt-2 text-body leading-6 outline-none [field-sizing:content] placeholder:text-faint"
      >
        {replying === null && taken !== null ? taken.text : asking ? asked : ""}
      </textarea>
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pt-1 pb-2.5">
        <span class="note px-1 text-meta leading-5 text-faint">
          {answers ? wording.answerOutcomeNote : wording.sendNote}
        </span>
        <span class="ml-auto flex items-center gap-3">
          {
            // **Not advertised where it does not work** (#206, Codex): the
            // chord submits without naming a button, and an answer *is* which
            // button was pressed, so `page/composer.js` leaves this one form
            // alone rather than sending an answer nobody chose.
            answers ? null : (
              <span class="js-only hidden items-center gap-1 text-meta text-faint sm:flex">
                {kbd("Ctrl/⌘")}
                {kbd("↵")}
                <span>{wording.keySend}</span>
              </span>
            )
          }
          {
            // **One button per answer, and the press is what rondo acts on**
            // (D-0072 rule 4). Two submits of one form, each carrying its own
            // `outcome`: a native submit sends the clicked button's name and
            // value, so this needs no script and works with script off -- and
            // the route refuses a press naming neither, so there is no default
            // for a browser that sends none.
            answers ? (
              <>
                {/* Asking rondo answers nothing (rondo#401): free words about
                    the waiting ask, sent as a question and not as an answer. */}
                <button
                  type="submit"
                  formaction={`/question${lang}`}
                  class={`${SECONDARY} h-9 px-4 text-sm`}
                >
                  {wording.askSubmit}
                </button>
                <button
                  type="submit"
                  name="outcome"
                  value="stop"
                  class={`${SECONDARY} h-9 px-4 text-sm`}
                >
                  {wording.answerStopAction}
                </button>
                <button
                  type="submit"
                  name="outcome"
                  value="carry_on"
                  class={`${raise === null ? PRIMARY : SECONDARY} h-9 px-4 text-sm`}
                >
                  {wording.answerCarryOnAction}
                </button>
                {/* A budget stop's recommended answer (D-0140 rule 3): the
                    same cap again only stops again. */}
                {raise === null ? null : (
                  <button
                    type="submit"
                    name="outcome"
                    value="raise_carry_on"
                    class={`${PRIMARY} h-9 px-4 text-sm`}
                  >
                    {wording.answerRaiseAction}
                  </button>
                )}
              </>
            ) : (
              <>
                {/* **Free words, asked as a question** (rondo#401): the second
                    submit of an ordinary reply box, which asks for no work. */}
                {replying === null || asking ? null : (
                  <button
                    type="submit"
                    formaction={`/question${lang}`}
                    class={`${SECONDARY} h-9 px-4 text-sm`}
                  >
                    {wording.askSubmit}
                  </button>
                )}
                <button
                  type="submit"
                  class="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-foreground px-4 text-sm font-semibold text-background shadow-xs outline-none hover:bg-foreground/85 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-wait disabled:opacity-60"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="size-3.5"
                  >
                    <path d="M8 13V3m-4 4 4-4 4 4" />
                  </svg>
                  {asking ? wording.askSubmit : wording.sendAction}
                </button>
              </>
            )
          }
        </span>
      </div>
    </form>
  );
}
