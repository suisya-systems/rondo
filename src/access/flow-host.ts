/**
 * The flow host (D-0128 rule 5, rondo#469): under a goal scope a person
 * approved, rondo asks for the goal's next request itself, in the resident
 * host -- today the `rondo web` process -- on the minute it already rescans on,
 * when a lap ends, and when a merge is closed out.
 *
 * **It writes a request and nothing else.** Per repository with a goal scope in
 * force it asks the picker (`pickNext`, rondo#466) and, on `inject`, writes one
 * request opener as `rondo/flow/1` under the pick's deterministic id, so a
 * second pass or a second process finds it spoken for. The drafter drafts the
 * split and no scope of its own (`drafter-host.ts`), and D-0127's tick starts
 * its parts under the goal scope's decision (`approvedSplits`). **It never
 * starts a lap**: the lane ledger, the order, the readiness and `reserve()`'s
 * re-test see every start exactly as they see a press.
 *
 * **Triage's model spend counts toward the goal scope's cost**: the triage
 * reading an injection comes from is claimed under the approval before the
 * opener is written (`triage_reading`), and the store adds its `cost_usd` to
 * what the approval has read.
 *
 * **A stop is asked, once** (D-0066 rule 4.4's layout): the scope run out
 * (expiry, laps or cost), a newer goal, two injected lines that ended failed,
 * or nothing left the ranking would start. The ask sits in the thread of the
 * flow's latest request, so the flow waits on it (`ownOpenAsk`), and in the
 * flow's own voice, so it holds no part of that request (`holdsNothing`); with no
 * request yet there is no thread, and the stop is said on the terminal. A pause
 * is the person's own answer (`laps: 0`, D-0128 rule 4) and is not asked about.
 */

import { type Injection, type InjectionState, pickNext } from "../advisory/flow.js";
import { readSplitPayload } from "../advisory/proposal.js";
import { type Ranked, readTriagePayload } from "../advisory/triage.js";
import type { HostPolicy } from "../refrain/policy.js";
import {
  FLOW_AUTHOR,
  type IterationRecord,
  opensFlowRequest,
  requestsGoal,
  type StoredGoal,
  type StoredScope,
  scopeCoversRequest,
  TERMINAL_STATUSES,
  type ThreadMessageDraft,
} from "../store/records.js";
import type { AdvisoryRecord, IterationStore } from "../store/sqlite.js";
import { hostFailure } from "./host-failure.js";
import { MODEL_DRAFTER_PREFIX } from "./model-draft/judgement.js";

export interface FlowHostPorts {
  readonly store: Pick<IterationStore, "readLive" | "terminalIterations" | "occupancy">;
  readonly record: Pick<
    AdvisoryRecord,
    | "approvalsInForce"
    | "readScope"
    | "goals"
    | "latestTriage"
    | "triageDeclines"
    | "scopeSpent"
    | "threadMessages"
    | "openAsksIn"
    | "latestSplitFor"
    | "draftedMessageIds"
    | "readProposal"
    | "claimScopedAct"
    | "recordThreadMessage"
  >;
  readonly policy: Pick<HostPolicy, "maxOccupying" | "maxLive">;
  readonly now: () => number;
  readonly log: (line: string) => void;
  /** Called once a request is injected: the drafter's kick, so it is drafted now. */
  readonly injected?: () => void;
}

export interface FlowHost {
  /** Run one pass now, or once more after the one in flight. Never throws. */
  kick(): void;
  /** Resolves when no pass is in flight (for tests). */
  settled(): Promise<void>;
}

/** Why the flow stops and asks the person (rondo#469). */
export type FlowStop =
  | "newer_goal"
  | "expiry"
  | "laps"
  | "cost"
  | "failed_twice"
  | "nothing_eligible";

/** One goal scope in force, and the goal it covers. */
interface Flow {
  readonly scopeDecisionId: string;
  readonly scope: StoredScope;
  readonly goal: StoredGoal;
}

/** What one pass reads once, for every repository. */
interface Seen {
  readonly messages: readonly ThreadMessageDraft[];
  readonly laps: readonly IterationRecord[];
  readonly goals: readonly StoredGoal[];
  readonly drafted: ReadonlySet<string>;
}

export function flowHost(ports: FlowHostPorts): FlowHost {
  // What this process last said about a repository, so a wait that stays the
  // same is not a line a minute. The asks themselves are idempotent by id.
  const said = new Map<string, string>();
  let running: Promise<void> | null = null;
  let again = false;

  const pass = async (): Promise<void> => {
    while (again) {
      again = false;
      try {
        await flowPass(ports, said);
      } catch (error) {
        ports.log(`flow     the goal scopes could not be read: ${hostFailure(error).text}`);
      }
    }
  };

  const kick = (): void => {
    again = true;
    if (running === null) {
      running = pass().finally(() => {
        running = null;
      });
    }
  };

  return {
    kick,
    async settled() {
      while (running !== null) {
        await running;
      }
    },
  };
}

async function flowPass(ports: FlowHostPorts, said: Map<string, string>): Promise<void> {
  const goals = await ports.record.goals();
  // One flow per repository: the newest approval over a goal of it. Two
  // approvals in force would each inject under their own ids, and the same
  // candidate twice.
  const flows = new Map<string, Flow>();
  for (const approval of await ports.record.approvalsInForce()) {
    const read = await ports.record.readScope(approval.scopeId);
    const goalId = read.kind === "read" ? requestsGoal(read.scope.payload.requests) : null;
    const goal = goals.find((one) => one.goalId === goalId);
    if (read.kind === "read" && goal !== undefined) {
      flows.set(goal.repository, {
        scopeDecisionId: approval.scopeDecisionId,
        scope: read.scope,
        goal,
      });
    }
  }
  if (flows.size === 0) {
    return;
  }
  const thread = await ports.record.threadMessages();
  if (thread.kind !== "read") {
    throw new Error(thread.reason);
  }
  const seen: Seen = {
    messages: thread.messages,
    laps: [...(await ports.store.readLive()), ...(await ports.store.terminalIterations())].flatMap(
      (outcome) => (outcome.kind === "read" ? [outcome.record] : []),
    ),
    goals,
    drafted: await ports.record.draftedMessageIds(MODEL_DRAFTER_PREFIX),
  };
  for (const [repository, flow] of flows) {
    // One repository's failure costs that repository, never the page's process.
    try {
      await flowOne(ports, said, seen, repository, flow);
    } catch (error) {
      ports.log(`flow     ${repository}: ${hostFailure(error).text}`);
    }
  }
}

async function flowOne(
  ports: FlowHostPorts,
  said: Map<string, string>,
  seen: Seen,
  repository: string,
  flow: Flow,
): Promise<void> {
  const { scopeDecisionId, scope, goal } = flow;
  const sayOnce = (line: string): void => {
    if (said.get(repository) !== line) {
      said.set(repository, line);
      ports.log(`flow     ${repository}: ${line}`);
    }
  };
  // **Every request the flow injected from this goal**, under this approval or
  // one it replaced (a widening, a resume after a pause): what is started, or
  // still waits to start, is not asked for twice. What ended under an earlier
  // approval was asked about under it, and the person's new approval is the
  // answer, so it is read as closed: a failure there does not stop this one.
  const prefix = flowPrefix(scopeDecisionId);
  const openers = seen.messages.filter(
    (message) =>
      opensFlowRequest(message) && scopeCoversRequest({ from_goal: goal.goalId }, message),
  );
  const injections: Injection[] = [];
  let ownOpenAsk = false;
  for (const opener of openers) {
    const asks = await ports.record.openAsksIn(opener.messageId);
    if (asks.kind !== "read") {
      throw new Error(asks.reason);
    }
    const own = opener.messageId.startsWith(prefix);
    const asked = asks.asks.length > 0;
    // This approval's own stop holds it in whichever request's thread it was
    // asked, an inherited one included.
    ownOpenAsk ||=
      (own && asked) ||
      asks.asks.some((ask) => ask.messageId.startsWith(stopPrefix(scopeDecisionId)));
    const state = await injectionState(ports, seen, opener.messageId, asked);
    injections.push({
      candidateKey: candidateKeyOf(opener.messageId),
      messageId: opener.messageId,
      state: own || (state !== "failed" && state !== "abandoned") ? state : "closed",
    });
  }
  const stop = async (reason: FlowStop, detail: string): Promise<void> =>
    await askStop(ports, sayOnce, flow, repository, openers.at(-1) ?? null, reason, detail);

  // The scope and the goal first: past either, nothing the picker says matters.
  const newest = seen.goals.filter((one) => one.repository === repository).at(-1);
  if (newest !== undefined && newest.goalId !== goal.goalId) {
    return await stop(
      "newer_goal",
      `the goal was edited: goal '${newest.goalId}' is now the newest, and this scope covers ` +
        `only the requests from goal '${goal.goalId}' (D-0128 rule 3)`,
    );
  }
  const budgets = scope.payload.budgets;
  if (budgets.laps === 0) {
    return sayOnce(`paused under scope '${scope.scopeId}' (laps: 0); nothing is started`);
  }
  const nowMs = ports.now();
  if (nowMs >= budgets.expires_at_ms) {
    return await stop(
      "expiry",
      `the scope expired at ${new Date(budgets.expires_at_ms).toISOString()}`,
    );
  }
  // The laps and the cost, as `reserve()` will test the next request's first lap.
  const spentStop = async (): Promise<readonly [FlowStop, string] | null> => {
    const spent = await ports.record.scopeSpent(scopeDecisionId);
    if (spent.admissions >= budgets.laps) {
      return [
        "laps",
        `the scope has admitted ${String(spent.admissions)} of ${String(budgets.laps)} laps`,
      ];
    }
    const committed = spent.readCostUsd + (spent.unreadLaps + 1) * budgets.cost_reserve_usd;
    return committed > budgets.cost_usd
      ? [
          "cost",
          `another request would commit ${committed.toFixed(2)} USD against a budget of ` +
            `${String(budgets.cost_usd)}: ${spent.readCostUsd.toFixed(2)} spent, triage ` +
            `readings included, plus ${String(budgets.cost_reserve_usd)} reserved for each of ` +
            `${String(spent.unreadLaps)} unread laps and the next one`,
        ]
      : null;
  };
  const spentBefore = await spentStop();
  if (spentBefore !== null) {
    return await stop(...spentBefore);
  }

  const triage = (await ports.record.latestTriage()).find((one) => one.repository === repository);
  const payload = triage === undefined ? null : readTriagePayload(triage.payload);
  const pick = pickNext({
    scopeDecisionId,
    goal: newest === undefined ? null : { goalId: newest.goalId },
    triage: payload,
    putAside: (await ports.record.triageDeclines())
      .filter((one) => one.repository === repository)
      .map((one) => one.candidate),
    injections,
    occupancy: await ports.store.occupancy(),
    bounds: ports.policy,
    ownOpenAsk,
  });
  if (pick.kind === "wait") {
    if (pick.reason === "failed_twice") {
      return await stop(
        "failed_twice",
        "the last two requests it started ended failed or abandoned",
      );
    }
    if (pick.reason === "nothing_eligible") {
      return await stop(
        "nothing_eligible",
        "the latest ranking holds no candidate it may start: each one is started already, " +
          "put aside, still has open points, or is not an issue",
      );
    }
    return sayOnce(`waiting (${pick.reason})`);
  }
  if (triage === undefined) {
    return;
  }
  // Claimed before the opener, so the reading is counted whatever happens
  // next. Refused is a reading already claimed, by this approval or another.
  const claimed = await ports.record.claimScopedAct({
    actKind: "triage_reading",
    scopeDecisionId,
    subjectId: triage.proposalId,
    nowMs,
  });
  if (claimed.kind === "defect") {
    return sayOnce(`the triage reading could not be counted: ${claimed.reason}`);
  }
  // Asked again with the reading counted: it may be what leaves no room.
  const spentAfter = await spentStop();
  if (spentAfter !== null) {
    return await stop(...spentAfter);
  }
  const written = await ports.record.recordThreadMessage({
    messageId: pick.messageId,
    body: flowBody(pick.candidate, goal),
    authorKind: "drafter",
    authorId: FLOW_AUTHOR,
    inReplyTo: null,
    atMs: nowMs,
    bases: [
      { form: "proposal", proposalId: triage.proposalId },
      { form: "goal", goalId: goal.goalId },
    ],
    asks: false,
  });
  if (written.kind === "duplicate") {
    return;
  }
  if (written.kind !== "recorded") {
    return sayOnce(`the request for ${pick.candidate.key} was not written: ${written.reason}`);
  }
  said.delete(repository);
  ports.log(
    `flow     ${repository}: asked for ${pick.candidate.key} (clause ${String(pick.candidate.clause)}) ` +
      `under scope '${scope.scopeId}'`,
  );
  ports.injected?.();
}

/** How a flow's request ids begin: `flowMessageId` without the candidate. */
function flowPrefix(scopeDecisionId: string): string {
  return `flow-${scopeDecisionId}-`;
}

/** How the stops an approval raises are named (`askStop`). */
function stopPrefix(scopeDecisionId: string): string {
  return `flow-stop-${scopeDecisionId}-`;
}

/**
 * The candidate an opener was injected for, read back from its id
 * (`flowMessageId`). The picker injects only issues, whose keys begin
 * `issue:`, so the key is what follows the first `-issue:`.
 *
 * ponytail: parsed from the id; a candidate column on the opener if another
 * key form is ever injected.
 */
function candidateKeyOf(messageId: string): string {
  const at = messageId.indexOf("-issue:");
  return at < 0 ? messageId : messageId.slice(at + 1);
}

/**
 * Where one injected request stands, for the picker: drafting until a split is
 * drafted for it (failed when the drafter wrote no draft), running while any
 * lap of it is open, waiting to start while a plan of its split has no line,
 * and otherwise as its latest lap ended. A split of no plans waits on the
 * person when the drafter asked, and is abandoned when it did not.
 */
async function injectionState(
  ports: FlowHostPorts,
  seen: Seen,
  requestMessageId: string,
  asked: boolean,
): Promise<InjectionState> {
  const proposalId = await ports.record.latestSplitFor(requestMessageId, MODEL_DRAFTER_PREFIX);
  if (proposalId === null) {
    return seen.drafted.has(requestMessageId) ? "failed" : "drafting";
  }
  const read = await ports.record.readProposal(proposalId);
  const split = read.kind === "read" ? readSplitPayload(read.proposal.payload) : null;
  const plans = split?.kind === "split" ? split.payload.plans.length : 0;
  const laps = seen.laps
    .filter((lap) => lap.requestMessageId === requestMessageId)
    .sort((a, b) => a.updatedAtMs - b.updatedAtMs);
  if (laps.some((lap) => !(TERMINAL_STATUSES as readonly string[]).includes(lap.status))) {
    return "running";
  }
  if (plans === 0) {
    return asked ? "waiting_to_start" : "abandoned";
  }
  if (laps.filter((lap) => lap.supersedesIterationId === null).length < plans) {
    return "waiting_to_start";
  }
  return laps.at(-1)?.status as "closed" | "failed" | "abandoned";
}

/**
 * The injected request's words: the ranked request, then rondo's report of why
 * it started it (rondo#469), citing the clause by its number and its words,
 * and the issue. ASCII, as rondo's own lines are (D-0004).
 */
export function flowBody(candidate: Ranked, goal: StoredGoal): string {
  const clause = goal.clauses[candidate.clause - 1];
  const source = candidate.source;
  return [
    candidate.request,
    "",
    `rondo started this because it goes against clause ${String(candidate.clause)} of the goal` +
      `${clause === undefined ? "" : `: "${clause.said}"`}.`,
    `Why: ${candidate.why}`,
    ...(source.form === "issue" ? [`Issue: ${source.repository}#${String(source.number)}`] : []),
  ].join("\n");
}

/**
 * Raise the stop (rondo#469): one ask in the thread of the flow's latest
 * request, named by the approval, the reason and that request, so each is
 * asked once and a later request's stop is asked again.
 */
async function askStop(
  ports: FlowHostPorts,
  sayOnce: (line: string) => void,
  flow: Flow,
  repository: string,
  latest: ThreadMessageDraft | null,
  reason: FlowStop,
  detail: string,
): Promise<void> {
  if (latest === null) {
    return sayOnce(`stopped before its first request: ${detail}`);
  }
  const messageId = `${stopPrefix(flow.scopeDecisionId)}${reason}-${latest.messageId}`;
  const outcome = await ports.record.recordThreadMessage({
    messageId,
    body: flowStopBody(flow, repository, reason, detail),
    authorKind: "drafter",
    // The flow's own voice, so the ask holds the flow and no part of the
    // request it is asked in (`holdsNothing`).
    authorId: FLOW_AUTHOR,
    inReplyTo: latest.messageId,
    atMs: ports.now(),
    bases: [
      { form: "message", messageId: latest.messageId },
      { form: "scope", scopeId: flow.scope.scopeId },
      { form: "goal", goalId: flow.goal.goalId },
    ],
    asks: true,
  });
  if (outcome.kind === "recorded") {
    ports.log(`flow     ${repository}: stopped (${reason}); the person is asked`);
    return;
  }
  if (outcome.kind !== "duplicate") {
    sayOnce(`stopped (${reason}), and the question was not written: ${outcome.reason}`);
  }
}

/** The stop's words, in the scope stop's layout (`stopBody`, D-0066 rule 4.4). */
export function flowStopBody(
  flow: Flow,
  repository: string,
  reason: FlowStop,
  detail: string,
): string {
  return [
    `Stopped: rondo starts no further request toward the goal for ${repository} under scope ` +
      `'${flow.scope.scopeId}' (decision '${flow.scopeDecisionId}'): ${detail}.`,
    "Options:",
    "- Widen the scope (a successor scope, D-0066 rule 1.4). Gives up: nothing of the goal; " +
      "rondo waits until a person approves the new budget or expiry.",
    "- A new goal scope. Gives up: this approval; the flow starts again under the new one, " +
      "with its own budget.",
    "- Stop. Gives up: the rest of the goal's work; requests already started carry on.",
    `Recommended: ${stopRecommendation(reason)}.`,
    "Nothing further is started toward the goal until this message is answered.",
  ].join("\n");
}

function stopRecommendation(reason: FlowStop): string {
  switch (reason) {
    case "newer_goal":
      return "a new goal scope over the newest goal: an edited goal is approved again (D-0128 rule 3)";
    case "expiry":
    case "laps":
    case "cost":
      return "widen the scope: what ran out is the approval, not the goal's work";
    case "failed_twice":
      return "stop, and read why the two requests failed before rondo starts another";
    case "nothing_eligible":
      return "stop: nothing left in the ranking is one rondo may start by itself";
  }
}
