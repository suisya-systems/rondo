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
 * (expiry, laps or cost), a newer goal, two injected lines whose work ended
 * failed -- a refused draft and a lap lost to a restart are neither (rondo#549,
 * `injectionState`) -- or nothing left the ranking would start. The ask sits in the thread of the
 * flow's latest request, so the flow waits on it (`ownOpenAsk`), and in the
 * flow's own voice, so it holds no part of that request (`holdsNothing`); with no
 * request yet there is no thread, so the stop is a `flow_stop` row with its
 * facts, which the page reads (`flow-stop.ts`, rondo#488), and is said on the
 * terminal. A pause is the person's own answer (`laps: 0`, D-0128 rule 4) and
 * is not asked about.
 *
 * **A refused draft is said in its own thread** (rondo#549, `tellDraftRefused`):
 * a request the drafter wrote no split for is not counted as a failure, and it
 * is not passed over in silence either -- one message goes into its thread, in
 * the operator's language, and asks, so the request stays the person's turn
 * while the flow asks for the goal's next one.
 *
 * **Open points are asked first** (rondo#487): when the candidate it would
 * inject has open points nobody answered, it records one ask with rondo's
 * suggestion for each (`flow_ask`), which the page draws beside the goal scope,
 * and injects nothing. The person's answers go into the request's body once
 * given, and the request line and why go as the person left them (rondo#492).
 * While the ask is open the flow waits, and the wait is not a failure.
 */

import {
  type Answered,
  failedTwice,
  type Injection,
  type InjectionState,
  pickNext,
} from "../advisory/flow.js";
import { readSplitPayload } from "../advisory/proposal.js";
import { type Ranked, readTriagePayload } from "../advisory/triage.js";
import type { HostPolicy } from "../refrain/policy.js";
import { contentDigest } from "../store/plan.js";
import {
  FLOW_AUTHOR,
  type IterationRecord,
  type JsonRecord,
  opensFlowRequest,
  requestsGoal,
  type StoredGoal,
  type StoredScope,
  scopeCoversRequest,
  TERMINAL_STATUSES,
  type ThreadMessageDraft,
} from "../store/records.js";
import type { AdvisoryRecord, IterationStore } from "../store/sqlite.js";
import { type FlowStopFacts, flowStopBody, stopPrefix, withdrawnId } from "./flow-stop.js";
import { hostFailure } from "./host-failure.js";
import { MODEL_DRAFTER_PREFIX } from "./model-draft/judgement.js";
import type { Chrome } from "./wording.js";

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
    | "recordFlowStop"
    | "flowStops"
    | "flowAsks"
    | "recordFlowAsk"
  >;
  readonly policy: Pick<HostPolicy, "maxOccupying" | "maxLive">;
  /**
   * The operator's own language, for the prose the flow leaves in a thread
   * (D-0055, D-0079): the host's operator language, since no request of the
   * page is being answered when the flow writes. The terminal lines stay
   * English.
   *
   * **The stop is said again where it is read** (rondo#549, the gate's third
   * reading): what is written here is the record, and the page draws the stop
   * from its `flow_stop` row in the language of whoever is looking
   * (`flowStopView`), so a host that reads English does not force an English
   * ask onto a person reading the page in Japanese.
   */
  readonly words: Chrome;
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
  // **A `failed_twice` stop asked earlier is weighed again on every pass**
  // (rondo#549): one asked before that reading was narrowed, or over a lap
  // that was lost and has since been started again, can stop standing. It
  // holds the flow only while the two failures it was asked over still read
  // as failures; otherwise the flow takes it back below. One the person
  // answered `stop` is theirs, and stays.
  const failedTwiceStop = `${stopPrefix(scopeDecisionId)}failed_twice-`;
  const failedTwiceAsks: string[] = [];
  for (const opener of openers) {
    const asks = await ports.record.openAsksIn(opener.messageId);
    if (asks.kind !== "read") {
      throw new Error(asks.reason);
    }
    const own = opener.messageId.startsWith(prefix);
    // Asked by anyone but the flow: its own question is not the drafter asking
    // (Codex, rondo#549) -- counted, its `failed_twice` stop would turn the
    // `abandoned` it was asked over into `waiting_to_start`, and be taken back
    // and asked again on alternate passes.
    const asked = asks.asks.some((ask) => ask.holdsNothing !== true);
    // **The refused draft's own note is not an ask that holds the flow**
    // (rondo#549, the gate's second reading). It is written so the request
    // stays the person's turn rather than vanishing, and the flow is free to
    // ask for the goal's next request meanwhile -- exactly what `draft_refused`
    // not being a failure says. Every other ask in an own thread holds it.
    const reweighed = asks.asks.filter(
      (ask) => ask.messageId.startsWith(failedTwiceStop) && !ask.answeredStop,
    );
    failedTwiceAsks.push(...reweighed.map((ask) => ask.messageId));
    const holds = asks.asks.filter(
      (ask) => ask.messageId !== draftRefusedNoteId(opener.messageId) && !reweighed.includes(ask),
    );
    // This approval's own stop holds it in whichever request's thread it was
    // asked, an inherited one included.
    ownOpenAsk ||=
      (own && holds.length > 0) ||
      holds.some((ask) => ask.messageId.startsWith(stopPrefix(scopeDecisionId)));
    const state = await injectionState(ports, seen, opener.messageId, asked);
    if (state === "draft_refused") {
      await tellDraftRefused(ports, flow, repository, opener);
    }
    injections.push({
      candidateKey: candidateKeyOf(opener.messageId),
      messageId: opener.messageId,
      state: own || (state !== "failed" && state !== "abandoned") ? state : "closed",
    });
  }
  if (!failedTwice(injections)) {
    for (const askId of failedTwiceAsks) {
      await withdrawStop(ports, flow, repository, askId);
    }
  }
  const stop = async (facts: FlowStopFacts, detail: string): Promise<void> =>
    await askStop(ports, sayOnce, flow, repository, seen, openers.at(-1) ?? null, facts, detail);

  // The scope and the goal first: past either, nothing the picker says matters.
  const newest = seen.goals.filter((one) => one.repository === repository).at(-1);
  if (newest !== undefined && newest.goalId !== goal.goalId) {
    return await stop(
      { reason: "newer_goal", goalId: goal.goalId, newestGoalId: newest.goalId },
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
      { reason: "expiry", expiresAtMs: budgets.expires_at_ms },
      `the scope expired at ${new Date(budgets.expires_at_ms).toISOString()}`,
    );
  }
  // The laps and the cost, as `reserve()` will test the next request's first lap.
  const spentStop = async (): Promise<readonly [FlowStopFacts, string] | null> => {
    const spent = await ports.record.scopeSpent(scopeDecisionId);
    if (spent.admissions >= budgets.laps) {
      return [
        { reason: "laps", admissions: spent.admissions, laps: budgets.laps },
        `the scope has admitted ${String(spent.admissions)} of ${String(budgets.laps)} laps`,
      ];
    }
    const committed = spent.readCostUsd + (spent.unreadLaps + 1) * budgets.cost_reserve_usd;
    return committed > budgets.cost_usd
      ? [
          {
            reason: "cost",
            committedUsd: committed,
            budgetUsd: budgets.cost_usd,
            spentUsd: spent.readCostUsd,
            reserveUsd: budgets.cost_reserve_usd,
            unreadLaps: spent.unreadLaps,
          },
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
  const asks = (await ports.record.flowAsks()).filter((ask) => ask.goalId === goal.goalId);
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
    asks: asks.map((ask) => ({
      candidateKey: ask.candidate,
      points: ask.points.map((one) => one.point),
      answers: ask.answer?.answers ?? null,
      request: ask.answer?.request ?? null,
      why: ask.answer?.why ?? null,
    })),
  });
  if (pick.kind === "wait") {
    if (pick.reason === "failed_twice") {
      return await stop(
        { reason: "failed_twice" },
        "the last two requests it started ended failed or abandoned",
      );
    }
    if (pick.reason === "nothing_eligible") {
      return await stop(
        { reason: "nothing_eligible", skipped: pick.skipped },
        `the latest ranking holds no candidate it may start: ${
          pick.skipped.map((one) => `${one.key} (${one.why})`).join(", ") || "it is empty"
        }`,
      );
    }
    return sayOnce(`waiting (${pick.reason})`);
  }
  if (triage === undefined) {
    return;
  }
  if (pick.kind === "ask") {
    // Asking spends nothing: the triage reading is claimed when the answered
    // request is injected.
    const asked = await ports.record.recordFlowAsk({
      askId: pick.askId,
      repository,
      goalId: goal.goalId,
      scopeDecisionId,
      proposalId: triage.proposalId,
      candidate: pick.candidate.key,
      points: pick.candidate.openPoints,
      request: pick.candidate.request,
      why: pick.candidate.why,
      askedAtMs: nowMs,
    });
    if (asked.kind === "recorded") {
      said.delete(repository);
      ports.log(
        `flow     ${repository}: asked the person ${String(pick.candidate.openPoints.length)} ` +
          `open point(s) of ${pick.candidate.key} before it starts it`,
      );
    } else if (asked.kind !== "duplicate") {
      sayOnce(`the open points of ${pick.candidate.key} were not asked: ${asked.reason}`);
    }
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
    body: flowBody(pick.candidate, goal, pick.answers),
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

/**
 * **The flow takes back a `failed_twice` stop that no longer stands**
 * (rondo#549): a reply in its own voice under its own question, which closes
 * it (`withdrawnByFlow`), in the operator's language (D-0055). The goal's
 * screen and the person's list stop showing it, and the flow goes on. One per
 * stop, so a pass that reads it again writes nothing.
 */
async function withdrawStop(
  ports: FlowHostPorts,
  flow: Flow,
  repository: string,
  askId: string,
): Promise<void> {
  const outcome = await ports.record.recordThreadMessage({
    messageId: withdrawnId(askId),
    body: ports.words.flowStopWithdrawn,
    authorKind: "drafter",
    authorId: FLOW_AUTHOR,
    inReplyTo: askId,
    atMs: ports.now(),
    bases: [
      { form: "message", messageId: askId },
      { form: "goal", goalId: flow.goal.goalId },
    ],
    asks: false,
  });
  if (outcome.kind === "recorded") {
    ports.log(`flow     ${repository}: the stop '${askId}' no longer stands; it is taken back`);
  } else if (outcome.kind !== "duplicate") {
    ports.log(`flow     ${repository}: the stop '${askId}' was not taken back: ${outcome.reason}`);
  }
}

/**
 * The id of the note rondo leaves when a request's draft was refused: one per
 * request, so a pass that reads the same refusal again writes nothing.
 */
export function draftRefusedNoteId(requestMessageId: string): string {
  return `flow-draft-refused-${requestMessageId}`;
}

/**
 * **A request whose draft was refused is said, and stays the person's turn**
 * (rondo#549, the gate's second reading).
 *
 * `draft_refused` is not counted as a failure, and that alone would leave the
 * request where nobody looks: the flow would ask for the next candidate and
 * this one would sit in the list as a request that never started, with nothing
 * said about why. So one message goes into its thread, in the operator's own
 * language (D-0055), asking -- which is what puts the request under *your turn*
 * (`waitsOnYou`) -- and the flow carries on with the goal's other requests.
 *
 * It is written in the flow's own voice, so it holds no part of the request
 * (`holdsNothing`), and it is skipped when `ownOpenAsk` is read, so the note
 * does not become the stop it exists instead of. The drafter host drafts a
 * refused run once more first (rondo#554, D-0160): its note covers nothing,
 * so a request is `draft_refused` here only once the second run is refused.
 */
async function tellDraftRefused(
  ports: FlowHostPorts,
  flow: Flow,
  repository: string,
  opener: ThreadMessageDraft,
): Promise<void> {
  const outcome = await ports.record.recordThreadMessage({
    messageId: draftRefusedNoteId(opener.messageId),
    body: ports.words.flowDraftRefusedAsk,
    authorKind: "drafter",
    authorId: FLOW_AUTHOR,
    inReplyTo: opener.messageId,
    atMs: ports.now(),
    bases: [
      { form: "message", messageId: opener.messageId },
      { form: "goal", goalId: flow.goal.goalId },
    ],
    asks: true,
  });
  if (outcome.kind === "recorded") {
    ports.log(
      `flow     ${repository}: the draft of '${opener.messageId}' was refused; the person is told`,
    );
    return;
  }
  if (outcome.kind !== "duplicate") {
    ports.log(
      `flow     ${repository}: the refused draft of '${opener.messageId}' was not said: ${outcome.reason}`,
    );
  }
}

/** How a flow's request ids begin: `flowMessageId` without the candidate. */
function flowPrefix(scopeDecisionId: string): string {
  return `flow-${scopeDecisionId}-`;
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
 * drafted for it (`draft_refused` when the drafter ran and wrote no draft),
 * running while any lap of it is open, waiting to start while a plan of its
 * split has no line, and otherwise as its latest lap ended. A split of no
 * plans waits on the person when the drafter asked, and is abandoned when it
 * did not.
 *
 * **Two of those are ends the flow does not count against the goal**
 * (rondo#549). A drafter run that wrote no split is one refused model output
 * and not the request's work failing, and a lap the host's restart lost
 * (`D-0139`) answered nothing at all: it is `lost` until the start again it is
 * owed is reserved, and then that successor's own end is read here instead.
 */
async function injectionState(
  ports: FlowHostPorts,
  seen: Seen,
  requestMessageId: string,
  asked: boolean,
): Promise<InjectionState> {
  const proposalId = await ports.record.latestSplitFor(requestMessageId, MODEL_DRAFTER_PREFIX);
  if (proposalId === null) {
    return seen.drafted.has(requestMessageId) ? "draft_refused" : "drafting";
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
  const latest = laps.at(-1);
  // D-0139: a lost lap ends `failed`, and that row is the restart's record and
  // not an answer. It reads as `lost` only while no successor stands for it --
  // once one is reserved the successor is the latest lap, and says the end.
  if (
    latest !== undefined &&
    latest.status === "failed" &&
    latest.failureKind === "lost" &&
    !laps.some((lap) => lap.supersedesIterationId === latest.id)
  ) {
    return "lost";
  }
  return latest?.status as "closed" | "failed" | "abandoned";
}

/**
 * The injected request's words: the ranked request, then rondo's report of why
 * it started it (rondo#469), citing the clause by its number and its words,
 * and the issue, then the open points as the person answered them (rondo#487).
 * ASCII, as rondo's own lines are (D-0004); the answers are the person's words.
 */
export function flowBody(
  candidate: Ranked,
  goal: StoredGoal,
  answers: readonly Answered[] = [],
): string {
  const clause = goal.clauses[candidate.clause - 1];
  const source = candidate.source;
  return [
    candidate.request,
    "",
    `rondo started this because it goes against clause ${String(candidate.clause)} of the goal` +
      `${clause === undefined ? "" : `: "${clause.said}"`}.`,
    `Why: ${candidate.why}`,
    ...(source.form === "issue" ? [`Issue: ${source.repository}#${String(source.number)}`] : []),
    ...(answers.length === 0
      ? []
      : [
          "",
          "Open points, as the person answered them:",
          ...answers.map((one) => `- ${one.point}: ${one.answer}`),
        ]),
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
  seen: Seen,
  latest: ThreadMessageDraft | null,
  facts: FlowStopFacts,
  detail: string,
): Promise<void> {
  const { reason } = facts;
  if (latest === null) {
    // **No thread to ask in, so the stop is a row the page reads** (rondo#488).
    // Written when it differs from the approval's newest row, so a stop that
    // recurs after another (A, B, A) is the newest again (Codex round 2).
    const named = `${stopPrefix(flow.scopeDecisionId)}${reason}-${contentDigest(facts as unknown as JsonRecord)}-`;
    const rows = (await ports.record.flowStops()).filter(
      (one) => one.scopeDecisionId === flow.scopeDecisionId,
    );
    const newest = rows.at(-1);
    const atMs = ports.now();
    const recorded = newest?.stopId.startsWith(named)
      ? ({ kind: "recorded" } as const)
      : await ports.record.recordFlowStop({
          stopId: `${named}${String(rows.length)}`,
          scopeDecisionId: flow.scopeDecisionId,
          repository,
          facts: facts as unknown as JsonRecord,
          atMs,
        });
    return sayOnce(
      recorded.kind === "defect"
        ? `stopped before its first request (${detail}), and the stop was not recorded: ${recorded.reason}`
        : `stopped before its first request: ${detail}`,
    );
  }
  // A stop the flow took back (`withdrawStop`) is closed for good, so the same
  // stop asked again in the same thread is a new question under a new id.
  const asked = `${stopPrefix(flow.scopeDecisionId)}${reason}-${latest.messageId}`;
  const takenBack = (id: string): boolean =>
    seen.messages.some((one) => one.messageId === withdrawnId(id));
  let messageId = asked;
  for (let round = 2; takenBack(messageId); round += 1) {
    messageId = `${asked}-${String(round)}`;
  }
  // **The stop's facts are kept beside the ask, under the ask's own id**
  // (rondo#549, the gate's third reading). The body below is one language's
  // wording of them -- the host's -- and the person reading the thread may have
  // chosen another, so the page says the stop again from these fields
  // (`flowStopAskedFacts`). Recorded first, so an ask is never on the page
  // without the facts it would be re-said from; a row whose ask then fails to
  // write is read by nothing, since `flowStopOf` reads rows only before the
  // approval's first request and one exists here.
  const kept = await ports.record.recordFlowStop({
    stopId: messageId,
    scopeDecisionId: flow.scopeDecisionId,
    repository,
    facts: facts as unknown as JsonRecord,
    atMs: ports.now(),
  });
  // `refused` here is the id already spoken for -- the flow stops again on
  // every pass until the ask is answered -- and is this caller's success, as
  // `duplicate` is for the message below.
  if (kept.kind === "defect") {
    sayOnce(`stopped (${reason}), and its facts were not kept: ${kept.reason}`);
  }
  const outcome = await ports.record.recordThreadMessage({
    messageId,
    body: flowStopBody(ports.words, repository, facts),
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
