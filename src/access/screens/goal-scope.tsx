/**
 * The goal scope's screen (D-0128, rondo#471): the one approval that lets
 * rondo work toward a repository's goal, and its pause.
 *
 * **Three states on one address**, read off the approvals in force:
 *
 * - **none**: a goal scope drafted from the goal and the plans rondo holds for
 *   the repository (`../goal-scope.ts`), budgets from `src/advisory/budget.ts`
 *   with one plan per clause, and one press that records and approves it --
 *   the person's P1 over every request the flow injects from this goal;
 * - **running**: what it allows and what it has used, and the pause press,
 *   which writes the `laps: 0` successor (rule 4); **stopped** in its place
 *   when the flow has stopped (rondo#488): the reason, what it passed over,
 *   and the next step, above the same limits and press;
 * - **paused**: the same draft again, whose press resumes, as the paused
 *   approval's successor.
 *
 * **It writes nothing on a `GET`** and holds still ({@link isLive}), as the
 * scope screen does: it is a form being filled in.
 */
import { readTriagePayload } from "../../advisory/triage.js";
import type { StoredGoal, StoredScope } from "../../store/records.js";
import { flowStopOf } from "../flow-stop.js";
import { goalScopeMaterial, goalScopeStanding } from "../goal-scope.js";
import { ago } from "../inbox.js";
import type { MintScopeId, WebPorts } from "../page/contract.js";
import { type FlowStopSaid, flowStopSaid, waitingPointsAsk } from "../page/triage.js";
import {
  CARD,
  CARD_HEADING,
  localTime,
  money,
  note,
  PRIMARY,
  SECONDARY,
} from "../page/vocabulary.js";
import { type PageView, viewHref } from "../page-logic/routes.js";
import { heldAgentTypeLines, scopeBudgetsFromStore } from "../scope.js";
import type { Chrome } from "../wording.js";
import { budgetBoxes, defaultsSection, recordedFold, sampleCaveat } from "./scope.js";

const PRESS = "h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto sm:self-start";
const LINK = "text-link underline-offset-2 hover:underline";

export async function goalScopeView(
  ports: WebPorts,
  wording: Chrome,
  view: Extract<PageView, { kind: "goalScope" }>,
  token: string | null,
  newScopeId: MintScopeId | null,
  nowMs: number,
): Promise<unknown> {
  const goalHref = viewHref({ kind: "goal", repository: view.repository }, wording.lang);
  const read = await goalScopeMaterial(
    { store: ports.store, record: ports.record, now: () => nowMs },
    view.repository,
  );
  const goal =
    read.kind === "noGoal" ? null : read.kind === "read" ? read.material.goal : read.goal;
  const standing =
    goal === null ? { kind: "none" as const } : await goalScopeStanding(ports.record, goal.goalId);
  // Green only while the flow can start or runs (rondo#488).
  const messages = standing.kind === "running" ? await ports.record.threadMessages() : null;
  const stopRead =
    goal === null || standing.kind !== "running" || messages?.kind !== "read"
      ? null
      : await flowStopOf(ports.record, messages.messages, goal.goalId, standing.scopeDecisionId);
  const stop = stopRead === null ? null : flowStopSaid(wording, stopRead);
  // Waiting on answers to open points is not working on its own either
  // (rondo#487): the picker's own reading of the open ask.
  const triage =
    goal === null || standing.kind !== "running" || stop !== null
      ? undefined
      : (await ports.record.latestTriage()).find((one) => one.repository === view.repository);
  const triagePayload = triage === undefined ? null : readTriagePayload(triage.payload);
  const asking =
    goal !== null &&
    triagePayload !== null &&
    waitingPointsAsk(
      await ports.record.flowAsks(),
      goal.goalId,
      triagePayload,
      await ports.record.triageDeclines(),
    ) !== undefined;
  const head = (
    <header class="space-y-2">
      <div class="flex min-w-0 items-center gap-2">
        <a
          href={viewHref({ kind: "requests" }, wording.lang)}
          data-back=""
          class="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          title={wording.goalBack}
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
          <span class="sr-only">{wording.goalBack}</span>
        </a>
        <h2 class="min-w-0 flex-1 truncate text-title leading-6 font-semibold">
          {standing.kind === "running"
            ? stop === null
              ? wording.goalScopeRunningHeading
              : wording.goalScopeStoppedHeading
            : standing.kind === "paused"
              ? wording.goalScopePausedHeading
              : wording.goalScopeHeading}
        </h2>
      </div>
      <p class="ml-9 text-meta leading-5 text-muted-foreground">{view.repository}</p>
    </header>
  );
  if (goal === null) {
    return (
      <div id="goal-scope" class="space-y-4">
        {head}
        {note(wording.goalScopeNoGoal)}
        <a href={goalHref} class={`${PRIMARY} ${PRESS}`}>
          {wording.triageWriteGoal}
        </a>
      </div>
    );
  }
  const material = read.kind === "read" ? read.material : null;
  const body =
    standing.kind === "running" ? (
      await running(
        ports,
        wording,
        view,
        standing.scopeDecisionId,
        standing.scope,
        token,
        newScopeId,
        stop,
        asking,
      )
    ) : material === null ? (
      note(wording.goalScopeNoPlan)
    ) : (
      <>
        {standing.kind === "paused" ? (
          <p class="text-body leading-6">{wording.goalScopePausedLead}</p>
        ) : null}
        {
          await draft(
            ports,
            wording,
            view,
            material,
            standing.kind === "paused" ? standing.scopeDecisionId : null,
            token,
            newScopeId,
            nowMs,
            goalCard(wording, goal, goalHref, nowMs),
          )
        }
      </>
    );
  return (
    <div id="goal-scope" class="space-y-4">
      {head}
      {body}
      {/* On a draft the goal sits under its press, where the approval is read
          over it; elsewhere it is the screen's foot. */}
      {material !== null && standing.kind !== "running"
        ? null
        : goalCard(wording, goal, goalHref, nowMs)}
    </div>
  );
}

/** The goal the approval is over, clause by clause, as the person wrote it. */
function goalCard(wording: Chrome, goal: StoredGoal, goalHref: string, nowMs: number) {
  return (
    <section class={`${CARD} space-y-2`}>
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h3 class={CARD_HEADING}>{wording.goalScopeGoalHeading}</h3>
        <a href={goalHref} class={`text-meta ${LINK}`}>
          {wording.triageEditGoal}
        </a>
      </div>
      <ol class="space-y-1.5">
        {goal.clauses.map((clause, at) => (
          <li class="flex gap-2 text-body leading-6">
            <span class="w-5 shrink-0 text-right text-muted-foreground tabular-nums">
              {wording.goalNumber(at + 1)}
            </span>
            <span class="min-w-0" lang="">
              {clause.said}
            </span>
          </li>
        ))}
      </ol>
      <p class="note text-meta leading-5 text-faint">
        {wording.goalScopeGoalNote(wording.age(ago(goal.writtenAtMs, nowMs)))}
      </p>
    </section>
  );
}

/**
 * The approval in force: what it allows, what it has used, and the pause
 * press -- under the stop, when the flow has stopped (rondo#488).
 */
async function running(
  ports: WebPorts,
  wording: Chrome,
  view: Extract<PageView, { kind: "goalScope" }>,
  scopeDecisionId: string,
  scope: StoredScope,
  token: string | null,
  newScopeId: MintScopeId | null,
  stop: FlowStopSaid | null,
  asking: boolean,
): Promise<unknown> {
  const budgets = scope.payload.budgets;
  const spent = await ports.record.scopeSpent(scopeDecisionId);
  return (
    <>
      {stop !== null ? (
        stopCard(wording, stop)
      ) : asking ? (
        <section class="flex flex-col gap-2 rounded-lg border border-wait/40 bg-wait-wash px-4 py-3">
          <p class="text-body leading-6">{wording.goalScopeAskingLead}</p>
          <a
            href={`${viewHref({ kind: "requests" }, wording.lang)}#triage-heading`}
            class={`${PRIMARY} h-10 justify-center self-start px-6 text-sm`}
          >
            {wording.goalScopeAskingLink}
          </a>
        </section>
      ) : (
        <p class="text-body leading-6">{wording.goalScopeRunningLead}</p>
      )}
      <section class={`${CARD} space-y-1`}>
        <h3 class={CARD_HEADING}>{wording.raiseWasHeading}</h3>
        <p class="text-body leading-6">
          {wording.raiseWas(
            budgets.laps,
            money(budgets.cost_usd),
            localTime(budgets.expires_at_ms).replace("T", " "),
          )}
        </p>
        <p class="text-body leading-6">
          {wording.raiseUsed(spent.admissions, money(spent.readCostUsd), spent.unreadLaps)}
        </p>
      </section>
      {token === null || newScopeId === null ? (
        note(wording.scopeNoApprover)
      ) : (
        <form
          method="post"
          action={`/goal-scope-pause?lang=${encodeURIComponent(wording.lang)}`}
          class="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3"
        >
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="repository" value={view.repository} />
          <input type="hidden" name="pause" value={scopeDecisionId} />
          {/* Minted when drawn: one form pressed twice pauses once. */}
          <input type="hidden" name="scope_id" value={newScopeId()} />
          <p class="note text-meta leading-5 text-muted-foreground">
            {stop === null ? wording.goalScopePauseNote : wording.goalScopePauseNoteStopped}
          </p>
          <button
            type="submit"
            data-row=""
            data-busy={wording.scopeBusy}
            class={`${SECONDARY} ${PRESS}`}
          >
            {wording.goalScopePauseAction}
          </button>
        </form>
      )}
    </>
  );
}

/**
 * Why the flow stopped and what to do (rondo#488): the person's turn, so it is
 * the one card on the screen that carries the waiting colour (D-0082 rule 2).
 */
function stopCard(wording: Chrome, stop: FlowStopSaid) {
  return (
    <section
      id="goal-scope-stop"
      class="space-y-3 rounded-lg border border-wait/40 bg-wait-wash px-4 py-3"
    >
      <div class="space-y-1">
        <p class="text-body leading-6 font-medium text-wait-ink">{stop.reason}</p>
        {stop.facts === null ? null : (
          <p class="text-body leading-6 text-muted-foreground">{stop.facts}</p>
        )}
      </div>
      {stop.skipped === null ? null : (
        <div class="space-y-1.5">
          <h3 class={CARD_HEADING}>{wording.flowStopSkippedHeading}</h3>
          <ul class="space-y-2">
            {stop.skipped.map((one) => (
              <li class="text-body leading-5">
                <span class="block" lang="">
                  {one.request}
                </span>
                <span class="block text-meta text-muted-foreground">{one.why}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div class="flex flex-col gap-2">
        <div class="space-y-1">
          <h3 class={CARD_HEADING}>{wording.flowStopNextHeading}</h3>
          <p class="text-body leading-6">{stop.next}</p>
        </div>
        {/* The one thing to do is answer: the card's press, as scope.tsx's. */}
        {stop.askedHref === null ? null : (
          <a href={stop.askedHref} class={`${PRIMARY} h-10 justify-center self-start px-6 text-sm`}>
            {wording.flowStopAskedLink}
          </a>
        )}
      </div>
    </section>
  );
}

/** The drafted goal scope and its press: a first approval, or one that resumes a pause. */
async function draft(
  ports: WebPorts,
  wording: Chrome,
  view: Extract<PageView, { kind: "goalScope" }>,
  material: Extract<Awaited<ReturnType<typeof goalScopeMaterial>>, { kind: "read" }>["material"],
  resumes: string | null,
  token: string | null,
  newScopeId: MintScopeId | null,
  nowMs: number,
  goal: unknown,
): Promise<unknown> {
  const plans = material.goal.clauses.length;
  const budgets = await scopeBudgetsFromStore(
    { store: ports.store, record: ports.record },
    {
      agentTypes: material.agentTypes.map((one) => one.agentTypeDigest),
      plans,
      draftedAtMs: nowMs,
    },
  );
  // **The places and agent types are rondo's record, so they are folded**
  // (D-0076), as the request's scope screen folds them; the repository is
  // what a person reads.
  const where = (
    <section class={`${CARD} space-y-2`}>
      <h3 class={CARD_HEADING}>{wording.goalScopeWhereHeading}</h3>
      {[...new Set(material.workspaces.map((workspace) => workspace.repository))].map((place) => (
        <p class="text-body leading-5 text-muted-foreground wrap-anywhere">{place}</p>
      ))}
      {recordedFold(wording, [
        ...material.workspaces.map((workspace) =>
          wording.scopeWorkspace(workspace.repository, workspace.workspace_root),
        ),
        ...(await heldAgentTypeLines(
          wording,
          ports.record,
          material.agentTypes.map((one) => one.agentTypeDigest),
        )),
      ])}
    </section>
  );
  // A resume is over an approval the person already read: the lead once.
  const lead = (
    <>
      {resumes === null ? <p class="text-body leading-6">{wording.goalScopeLead}</p> : null}
      <p class="note text-meta leading-5 text-muted-foreground">
        {wording.goalScopePlansNote(plans)}
      </p>
    </>
  );
  if (token === null || newScopeId === null) {
    return (
      <>
        {lead}
        {note(wording.scopeNoApprover)}
        {goal}
        {where}
      </>
    );
  }
  const action = resumes === null ? wording.goalScopeAction : wording.goalScopeResumeAction;
  const press = (
    <button
      type="submit"
      data-row=""
      aria-describedby="goal-scope-plain"
      data-busy={wording.scopeBusy}
      class={`${PRIMARY} ${PRESS}`}
    >
      {action}
    </button>
  );
  return (
    <>
      {lead}
      <form
        id="goal-scope-form"
        method="post"
        action={`/goal-scope?lang=${encodeURIComponent(wording.lang)}`}
        class="space-y-4"
      >
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="repository" value={view.repository} />
        {/* The goal and the lists by what they were drawn as: the press reads
            both again and records nothing if either moved (D-0066 rule 2.2). */}
        <input type="hidden" name="goal" value={material.goal.goalId} />
        <input type="hidden" name="drawn" value={material.drawn} />
        {resumes === null ? null : <input type="hidden" name="resumes" value={resumes} />}
        <input type="hidden" name="scope_id" value={newScopeId()} />
        <div class="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3">
          <p class="note text-meta leading-5 text-muted-foreground">{wording.goalScopePressNote}</p>
          {press}
          <span id="goal-scope-plain" class="note sr-only">
            {wording.goalScopePlain}
          </span>
        </div>
        {goal}
        {where}
        {sampleCaveat(wording, budgets.cost_reserve_usd.bases, wording.goalScopeSampleHeading)}
        {budgetBoxes(wording, budgets, false)}
        {defaultsSection(wording, "major", [])}
        <p class="note text-meta leading-5 text-muted-foreground">{wording.scopeCostCaveat}</p>
        {/* The same press under the last box (D-0106), as every scope form has. */}
        <div class="flex flex-col">{press}</div>
      </form>
    </>
  );
}
