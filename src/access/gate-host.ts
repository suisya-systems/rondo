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
 * **It only approves.** Revise, a review extension, a spent round, a scope
 * exit, a closing lap and publish stay with the person (the owner's decision
 * of 2026-09-27): each of those is a reason `gateAuto` answers `would not
 * approve`, or not an answer at all. A publish follows only where the scope
 * includes it, and that is `publish-host.ts`'s (rondo#470).
 */
import type { GateDelegation } from "../continuo/invoker.js";
import type { IterationRecord, StoredScopeDecision } from "../store/records.js";
import type { AdvisoryRecord, IterationStore } from "../store/sqlite.js";
import { DETERMINISTIC_DRAFTER } from "./advisory.js";
import { autoThreshold, type GateScope, gateAuto } from "./gate-auto.js";
import { reviewPolicyOf } from "./model-review/judgement.js";
import { workerRuns } from "./page-logic/laps.js";
import { askOverLine } from "./page-logic/result.js";
import { threadsOf } from "./page-logic/threads.js";
import { approvalTip, reviewScopeOf } from "./scope.js";

/** Who the organisation's answer is recorded as (rondo#467). */
export const GATE_ACTOR = "rondo/gate/1";

/** What the delegated walk did: the answer continuo holds is rondo's, or it is not. */
export type ScopedAnswer =
  | { readonly kind: "delegated" }
  | { readonly kind: "notDelegated"; readonly note: string };

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
  >;
  /** Walk the gate with the delegation and settle rondo's row (`answerUnderScope`, `cli.ts`). */
  readonly answer: (record: IterationRecord, delegation: GateDelegation) => Promise<ScopedAnswer>;
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
    questionOpen: await questionOpen(ports, record),
    closing: (await ports.store.closingLapOf(record.id)) !== null,
    scope,
    nowMs: ports.now(),
  });
  if (auto.kind !== "would_approve") {
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
    body: approvedBody(scope.decision.scopeId, scope.decision.actorId, line),
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

/** Whether a question waits on the person over this lap's line, as the gate card reads it. */
async function questionOpen(ports: GateHostPorts, record: IterationRecord): Promise<boolean> {
  if (record.requestMessageId === null) {
    return false;
  }
  const read = await ports.record.threadMessages();
  if (read.kind !== "read") {
    // Unreadable is not "no question": send the gate to the person.
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

/** The report's words: rondo's own, ASCII (D-0004), with the conditions it rests on. */
export function approvedBody(scopeId: string, approver: string, line: string): string {
  return [
    `Approved by rondo under scope '${scopeId}', on ${approver}'s approval of it.`,
    "It met every condition for an automatic approval:",
    "- the checks were clear;",
    `- the model review of the same commit found nothing at or above ${line};`,
    "- the worker's last test run passed;",
    "- no question was open over this line;",
    "- it is not a closing lap.",
  ].join("\n");
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
