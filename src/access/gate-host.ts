/**
 * The organisation's answer at a gate (D-0125 rule 6, rondo#467): a lap whose
 * gate {@link gateAuto} says rondo would approve is approved, in the resident
 * host -- today the `rondo web` process -- on the minute it already rescans on
 * and right after a model reading lands there.
 *
 * **Recorded as delegated, never as the person's press** (D-0064 rule 3.6,
 * `continuo D-1121`): the answer goes to continuo as `rondo/gate/1` acting on
 * behalf of the person who approved the scope, on the authority of that scope
 * decision. rondo records `approve` (D-0092) only where continuo says the
 * delegated answer is the one it holds; a person who answered first keeps it.
 *
 * **Claimed before the walk, once per gate** (D-0125 rule 5): the `gate_answer`
 * consumption row is written first -- claim, then act, as `D-0042` and a merge
 * on green do -- so two lines in flight, two passes or two processes answer a
 * gate once. A walk that fails after the claim is not tried again: the gate
 * stays the person's, with both presses drawn as before.
 *
 * **It approves, and under a goal scope it sends a drafted change** (D-0145,
 * rondo#517). A review extension, a spent round, a scope exit, a closing lap
 * and publish stay with the person (the owner's decision of 2026-09-27), and so
 * does every revise but one: a lap whose gate is withheld only by findings the
 * revise drafter answered as plain defects at or above the threshold, with a
 * round and budget left, is answered with that draft ({@link reviseToSend}), on
 * the same claim (D-0156: a judgment call below the threshold is left out). A publish
 * follows only where the scope includes it, and that is `publish-host.ts`'s
 * (rondo#470).
 */
import type { GateDelegation } from "../continuo/invoker.js";
import {
  type IterationRecord,
  isModelReadingDrafter,
  latestReading,
  requestsGoal,
  reviewedReading,
  type StoredScopeDecision,
} from "../store/records.js";
import type { AdvisoryRecord, IterationStore } from "../store/sqlite.js";
import { DETERMINISTIC_DRAFTER } from "./advisory.js";
import { autoThreshold, type GateScope, gateAuto, repairOf } from "./gate-auto.js";
import {
  reviewPolicyOf,
  reviewRoundDecision,
  reviewRoundsAlong,
} from "./model-review/judgement.js";
import { workerRuns } from "./page-logic/laps.js";
import { askOverLine } from "./page-logic/result.js";
import { threadsOf } from "./page-logic/threads.js";
import { judgmentOf, reviseBoxOf, reviseLabels } from "./revise-draft/judgement.js";
import { approvalTip, budgetRefusal, reviewScopeOf } from "./scope.js";
import type { Chrome } from "./wording.js";

/** Who the organisation's answer is recorded as (rondo#467). */
export const GATE_ACTOR = "rondo/gate/1";

/** What the delegated walk did: the answer continuo holds is rondo's, or it is not. */
export type ScopedAnswer =
  | { readonly kind: "delegated" }
  | { readonly kind: "notDelegated"; readonly note: string };

/** What rondo's own send of a drafted change came to (D-0145). */
export type ScopedRevise =
  | { readonly kind: "sent" }
  /** `answered`: the gate may hold rondo's words although no next lap started. */
  | { readonly kind: "notSent"; readonly note: string; readonly answered: boolean };

/** One send of a drafted change: the press's inputs, with the delegation and the re-test. */
export interface ScopedReviseInput {
  readonly successorId: string;
  readonly scopeDecisionId: string;
  readonly body: string;
  readonly delegation: GateDelegation;
  /**
   * Asked once more right before the walk (D-0145 rule 6): whether this body is
   * still what rondo would send, and the host has room for the next lap.
   */
  readonly recheck: () => Promise<boolean>;
}

/** What rondo's send of a drafted change reaches; absent where no approver is set. */
export interface GateRevisePorts {
  /** The revise press's own path, delegated, answering once the next lap is reserved. */
  readonly send: (record: IterationRecord, input: ScopedReviseInput) => Promise<ScopedRevise>;
  /** Whether one more lap would fit the host's bound now. */
  readonly hasRoom: () => Promise<boolean>;
  readonly mintId: () => string;
}

export interface GateHostPorts {
  readonly store: Pick<IterationStore, "readLive" | "readingsFor" | "closingLapOf" | "laneLedger">;
  readonly record: Pick<
    AdvisoryRecord,
    | "scopeDecisionAdmitting"
    | "scopeTip"
    | "readScopeDecision"
    | "readScope"
    | "scopeSupersededByApproved"
    | "claimScopedAct"
    | "threadMessages"
    | "recordThreadMessage"
    | "lineageOf"
    | "scopeSpent"
    | "reviseDraftFor"
  >;
  /** Walk the gate with the delegation and settle rondo's row (`answerUnderScope`, `cli.ts`). */
  readonly answer: (record: IterationRecord, delegation: GateDelegation) => Promise<ScopedAnswer>;
  /** Null where no approver the allowlist accepts is set: then the host only approves. */
  readonly revise: GateRevisePorts | null;
  /**
   * The host operator's words (what the page draws): the revise box's, and
   * rondo's own notes in the thread (rondo#533).
   */
  readonly words: Chrome;
  readonly now: () => number;
  readonly log: (line: string) => void;
}

export interface GateHost {
  /** Run one pass now, or once more after the one in flight. Never throws. */
  kick(): void;
  /** Resolves when no pass is in flight (for tests). */
  settled(): Promise<void>;
}

export function gateHost(ports: GateHostPorts): GateHost {
  let running: Promise<void> | null = null;
  let again = false;

  const pass = async (): Promise<void> => {
    while (again) {
      again = false;
      let live: Awaited<ReturnType<IterationStore["readLive"]>>;
      try {
        live = await ports.store.readLive();
      } catch (error) {
        ports.log(`gate     the laps could not be read: ${describe(error)}`);
        return;
      }
      for (const found of live) {
        if (found.kind !== "read" || found.record.status !== "awaiting_human") {
          continue;
        }
        // One lap's failure costs that lap, never the page's process.
        try {
          await answerOne(ports, found.record);
        } catch (error) {
          ports.log(`gate     ${found.record.id}: ${describe(error)}`);
        }
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

/** The approval a lap spends, as {@link gateAuto} reads it, with who gave it; null where it will not read. */
export async function gateScope(
  record: Pick<AdvisoryRecord, "readScopeDecision" | "readScope" | "scopeSupersededByApproved">,
  scopeDecisionId: string,
): Promise<(GateScope & { readonly decision: StoredScopeDecision }) | null> {
  const decided = await record.readScopeDecision(scopeDecisionId);
  if (decided.kind !== "read") {
    return null;
  }
  const stored = await record.readScope(decided.decision.scopeId);
  if (stored.kind !== "read") {
    return null;
  }
  return {
    outcome: decided.decision.outcome,
    payload: stored.scope.payload,
    supersededByApproved: await record.scopeSupersededByApproved(decided.decision.scopeId),
    decision: decided.decision,
  };
}

async function answerOne(ports: GateHostPorts, record: IterationRecord): Promise<void> {
  const gateId = record.gateId;
  const tip = await approvalTip(ports.record, record.id);
  if (gateId === null || tip.kind !== "tip") {
    return;
  }
  const scope = await gateScope(ports.record, tip.scopeDecisionId);
  if (scope === null) {
    return;
  }
  const auto = gateAuto({
    readings: await ports.store.readingsFor(record.id),
    runs: workerRuns(record.lapCommands),
    repair: repairOf(record),
    questionOpen: await questionOpen(ports, record),
    closing: (await ports.store.closingLapOf(record.id)) !== null,
    scope,
    nowMs: ports.now(),
  });
  if (auto.kind !== "would_approve") {
    if (ports.revise !== null) {
      await sendOne(ports, ports.revise, record);
    }
    return;
  }
  const claimed = await ports.record.claimScopedAct({
    actKind: "gate_answer",
    scopeDecisionId: tip.scopeDecisionId,
    subjectId: gateId,
    nowMs: ports.now(),
  });
  if (claimed.kind !== "recorded") {
    // `refused` is a gate already claimed, by this pass or another: not news.
    if (claimed.kind === "defect") {
      ports.log(`gate     ${record.id}: the answer could not be claimed: ${claimed.reason}`);
    }
    return;
  }
  const answered = await ports.answer(record, {
    onBehalfOf: scope.decision.actorId,
    authorityRef: tip.scopeDecisionId,
  });
  if (answered.kind !== "delegated") {
    ports.log(`gate     ${record.id}: ${answered.note}`);
    return;
  }
  ports.log(`gate     ${record.id}: approved by rondo under scope '${scope.decision.scopeId}'`);
  if (record.requestMessageId === null) {
    return;
  }
  const line = autoThreshold(reviewPolicyOf(reviewScopeOf(scope.payload)).threshold);
  const written = await ports.record.recordThreadMessage({
    messageId: `gate-auto-${gateId}`,
    body: ports.words.gateAutoSaid(
      approvalOf(ports.words, scope.payload),
      scope.decision.actorId,
      line,
    ),
    authorKind: "drafter",
    authorId: DETERMINISTIC_DRAFTER,
    inReplyTo: record.requestMessageId,
    atMs: ports.now(),
    bases: [
      { form: "message", messageId: record.requestMessageId },
      { form: "iteration", iterationId: record.id },
      { form: "scope", scopeId: scope.decision.scopeId },
    ],
    asks: false,
  });
  if (written.kind !== "recorded" && written.kind !== "duplicate") {
    ports.log(`gate     ${record.id}: the report was not written: ${written.reason}`);
  }
}

/**
 * The change rondo sends at this lap's gate by itself, or null where the press
 * stays the person's (D-0145 rule 1). All of these hold:
 *
 * - the lap spends a goal scope's approval, which reads and is in force;
 * - the gate is withheld only by the model review's findings and, at most,
 *   by checks findings the box quotes itself (a take-in): no question, no
 *   test run, no closing lap, no pending or ungraded reading;
 * - the scope's own round decision over the reading is `revise` -- a finding
 *   at or above its threshold and a round left -- and no budget closes;
 * - the box the gate would draw is a draft that quotes every standing finding
 *   and marks none at or above the scope's threshold a judgment call; its text
 *   is what is sent, less the findings below the threshold marked one, which
 *   the note names (D-0156).
 */
export async function reviseToSend(
  ports: Pick<GateHostPorts, "store" | "record" | "now" | "words">,
  record: IterationRecord,
): Promise<{
  readonly body: string;
  readonly scopeDecisionId: string;
  readonly decision: StoredScopeDecision;
  /** The approval in plain words, for the note (rondo#533). */
  readonly approval: string;
  /** The threshold the send's judgment test was taken at, as the note names it. */
  readonly line: string;
  /** The findings left out of the body (D-0156), each as the box quotes it. */
  readonly left: readonly string[];
} | null> {
  const { words } = ports;
  if (
    record.status !== "awaiting_human" ||
    record.gateId === null ||
    record.requestMessageId === null
  ) {
    return null;
  }
  const tip = await approvalTip(ports.record, record.id);
  if (tip.kind !== "tip") {
    return null;
  }
  const scope = await gateScope(ports.record, tip.scopeDecisionId);
  if (scope === null || requestsGoal(scope.payload.requests) === null) {
    return null;
  }
  const readings = await ports.store.readingsFor(record.id);
  const auto = gateAuto({
    readings,
    runs: workerRuns(record.lapCommands),
    repair: repairOf(record),
    questionOpen: await questionOpen(ports, record),
    closing: (await ports.store.closingLapOf(record.id)) !== null,
    scope,
    nowMs: ports.now(),
  });
  if (
    auto.kind !== "would_not_approve" ||
    !auto.reasons.some((reason) => reason.kind === "model_raised") ||
    !auto.reasons.every(
      (reason) =>
        reason.kind === "model_raised" ||
        (reason.kind === "checks_not_clear" && reviewedReading(readings)?.verdict === "concerns"),
    )
  ) {
    return null;
  }
  const model = latestReading(readings, isModelReadingDrafter);
  const lineage = await ports.record.lineageOf(record.id);
  if (model === null || lineage === null) {
    return null;
  }
  const links = [];
  for (const id of lineage) {
    links.push({ readings: await ports.store.readingsFor(id) });
  }
  const round = reviewRoundDecision({
    latest: model,
    roundsTaken: reviewRoundsAlong(links),
    policy: reviewPolicyOf(reviewScopeOf(scope.payload)),
  });
  if (
    round.kind !== "revise" ||
    budgetRefusal(
      scope.payload.budgets,
      await ports.record.scopeSpent(tip.scopeDecisionId),
      ports.now(),
    ) !== null
  ) {
    return null;
  }
  const row = await ports.record.reviseDraftFor(record.id, model);
  // **A judgment call below the threshold is left out, not waited on** (D-0156):
  // the round decision graded every finding, so a position outside `atOrAbove`
  // is below the scope's threshold.
  const left =
    row === null ? [] : judgmentOf(row.payload).filter((i) => !round.atOrAbove.includes(i));
  const labels = reviseLabels(words);
  const box = reviseBoxOf(readings, row, labels, left);
  return box.kind === "drafted" && box.plain === true
    ? {
        body: box.text,
        scopeDecisionId: tip.scopeDecisionId,
        decision: scope.decision,
        approval: approvalOf(words, scope.payload),
        line: reviewPolicyOf(reviewScopeOf(scope.payload)).threshold,
        left: left.map((i) =>
          labels.finding(model.graded?.[i]?.severity ?? "", model.findings[i] ?? ""),
        ),
      }
    : null;
}

/** Send the drafted change at one gate, where {@link reviseToSend} says rondo does (D-0145). */
async function sendOne(
  ports: GateHostPorts,
  revise: GateRevisePorts,
  record: IterationRecord,
): Promise<void> {
  const gateId = record.gateId;
  const request = record.requestMessageId;
  const send = await reviseToSend(ports, record);
  // A host at its bound leaves the claim unspent: the next pass sends it.
  if (gateId === null || request === null || send === null || !(await revise.hasRoom())) {
    return;
  }
  // **One claim per gate, whichever answer** (D-0125 rule 5): the approve and
  // this send are the same act kind, so a gate is answered by rondo once.
  const claimed = await ports.record.claimScopedAct({
    actKind: "gate_answer",
    scopeDecisionId: send.scopeDecisionId,
    subjectId: gateId,
    nowMs: ports.now(),
  });
  if (claimed.kind !== "recorded") {
    if (claimed.kind === "defect") {
      ports.log(`gate     ${record.id}: the change could not be claimed: ${claimed.reason}`);
    }
    return;
  }
  const sent = await revise.send(record, {
    successorId: revise.mintId(),
    scopeDecisionId: send.scopeDecisionId,
    body: send.body,
    delegation: { onBehalfOf: send.decision.actorId, authorityRef: send.scopeDecisionId },
    // The same words under the same approval: a raise approved since spends
    // another tip, and the successor under this one would be refused.
    recheck: async () => {
      const again = await reviseToSend(ports, record);
      return (
        again?.body === send.body &&
        again.scopeDecisionId === send.scopeDecisionId &&
        (await revise.hasRoom())
      );
    },
  });
  if (sent.kind === "notSent") {
    ports.log(`gate     ${record.id}: the drafted change was not sent by rondo: ${sent.note}`);
    if (!sent.answered) {
      return;
    }
  } else {
    ports.log(
      `gate     ${record.id}: the drafted change sent by rondo under scope '${send.decision.scopeId}'`,
    );
  }
  const written = await ports.record.recordThreadMessage({
    messageId: `gate-revise-${gateId}`,
    body: ports.words.gateReviseSaid(
      send.approval,
      send.decision.actorId,
      sent.kind === "sent" ? null : sent.note,
      send.line,
      send.left,
    ),
    authorKind: "drafter",
    authorId: DETERMINISTIC_DRAFTER,
    inReplyTo: request,
    atMs: ports.now(),
    bases: [
      { form: "message", messageId: request },
      { form: "iteration", iterationId: record.id },
      { form: "scope", scopeId: send.decision.scopeId },
    ],
    asks: false,
  });
  if (written.kind !== "recorded" && written.kind !== "duplicate") {
    ports.log(`gate     ${record.id}: the report was not written: ${written.reason}`);
  }
}

/**
 * Whether a question waits on the person over this lap's line, as the gate card
 * reads it -- or the lap put a worker's question at all (D-0142): its answer
 * goes on by the revise the answer press makes, so approving the lap would drop
 * the work that waited on it, answered or not.
 */
async function questionOpen(
  ports: Pick<GateHostPorts, "store" | "record">,
  record: IterationRecord,
): Promise<boolean> {
  if (record.requestMessageId === null) {
    return false;
  }
  const read = await ports.record.threadMessages();
  if (read.kind !== "read") {
    // Unreadable is not "no question": send the gate to the person.
    return true;
  }
  if (read.messages.some((m) => m.messageId === `question-${record.id}` && m.asks)) {
    return true;
  }
  const line = (await ports.store.laneLedger()).find((held) => held.lapIds.includes(record.id));
  return (
    askOverLine(
      threadsOf(read.messages, new Set(), new Map()),
      record.requestMessageId,
      line?.lapIds ?? [record.id],
    ) !== null
  );
}

/** The approval a gate was answered under, in plain words rather than its scope id (rondo#533). */
function approvalOf(words: Chrome, payload: GateScope["payload"]): string {
  return words.approvalNamed(
    requestsGoal(payload.requests) !== null,
    payload.budgets.cost_usd.toFixed(2),
  );
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
