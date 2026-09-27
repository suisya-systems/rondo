/**
 * Whether rondo would approve a lap's gate automatically, and why not
 * (D-0125, rondo#464).
 *
 * **Pure, and it answers nothing.** It reads what the gate already read -- the
 * lap's readings, the worker's last test run, the question over the line, the
 * closing-lap mark and the approval the lap spends -- and says *would approve*
 * or *would not approve* with every reason that holds. No gate is answered
 * from here: it is one line on the gate card, and the resident host's gate
 * pass (`gate-host.ts`, rondo#467) answers on *would approve*, recorded as
 * delegated (D-0064 rule 3.6, continuo#240).
 *
 * The caller asks only of a lap at `awaiting_human`; the status is not
 * re-tested here.
 */
import {
  FINDING_SEVERITIES,
  type FindingSeverity,
  isModelReadingDrafter,
  type LapReading,
  latestReading,
  reviewedReading,
  type ScopePayload,
  severityAtOrAbove,
} from "../store/records.js";
import { reviewPolicyOf } from "./model-review/judgement.js";
import type { WorkerRuns } from "./page-logic/laps.js";
import { reviewScopeOf } from "./scope.js";

/** One reason a gate goes to the person rather than being approved automatically. */
export type GateAutoReason =
  /** The lap spends no approval, its line has two tips, or the approval will not read. */
  | { readonly kind: "no_scope" }
  | { readonly kind: "scope_declined" }
  | { readonly kind: "scope_superseded" }
  | { readonly kind: "scope_expired" }
  /** The deterministic reading is absent, `concerns` or `unavailable` (D-0065 5.7). */
  | { readonly kind: "checks_not_clear" }
  /** No model reading yet, or only one of an earlier tip. */
  | { readonly kind: "model_pending" }
  | { readonly kind: "model_unavailable" }
  /** Its severities did not decode, so no finding can be shown to be below the line. */
  | { readonly kind: "model_ungraded" }
  /** Findings at or above `min(threshold, major)`, counted per severity, worst first. */
  | {
      readonly kind: "model_raised";
      readonly counts: readonly { readonly severity: FindingSeverity; readonly count: number }[];
    }
  /** `workerRuns` is `unrecorded` or `none`: no verification record rondo can read. */
  | { readonly kind: "tests_unread" }
  | { readonly kind: "tests_failed"; readonly failed: number }
  | { readonly kind: "tests_errored" }
  | { readonly kind: "question_open" }
  | { readonly kind: "closing_lap" };

export type GateAuto =
  | { readonly kind: "would_approve" }
  | { readonly kind: "would_not_approve"; readonly reasons: readonly GateAutoReason[] };

/** The approval the lap spends, as the store holds it, or null where there is none to read. */
export interface GateScope {
  readonly outcome: string;
  readonly payload: ScopePayload;
  readonly supersededByApproved: boolean;
}

export interface GateAutoInput {
  readonly readings: readonly LapReading[];
  readonly runs: WorkerRuns;
  readonly questionOpen: boolean;
  readonly closing: boolean;
  readonly scope: GateScope | null;
  readonly nowMs: number;
}

/**
 * The line a finding must stay under: the scope's threshold, but never looser
 * than `major` (owner decision of 2026-09-27) -- a scope that lets a major
 * through its rounds still sends a major to the person.
 */
export function autoThreshold(threshold: FindingSeverity): FindingSeverity {
  return severityAtOrAbove(threshold, "major") ? "major" : threshold;
}

export function gateAuto(input: GateAutoInput): GateAuto {
  const reasons: GateAutoReason[] = [];
  const { scope } = input;
  if (scope === null) {
    reasons.push({ kind: "no_scope" });
  } else {
    if (scope.outcome !== "approved") {
      reasons.push({ kind: "scope_declined" });
    }
    if (scope.supersededByApproved) {
      reasons.push({ kind: "scope_superseded" });
    }
    if (input.nowMs >= scope.payload.budgets.expires_at_ms) {
      reasons.push({ kind: "scope_expired" });
    }
  }
  const checks = reviewedReading(input.readings);
  if (checks?.verdict !== "clear") {
    reasons.push({ kind: "checks_not_clear" });
  }
  const model = modelReason(input.readings, checks, scope);
  if (model !== null) {
    reasons.push(model);
  }
  const runs = input.runs;
  if (runs.kind !== "ran") {
    reasons.push({ kind: "tests_unread" });
  } else {
    if (runs.last.failed > 0) {
      reasons.push({ kind: "tests_failed", failed: runs.last.failed });
    }
    if (runs.last.isError) {
      reasons.push({ kind: "tests_errored" });
    }
  }
  if (input.questionOpen) {
    reasons.push({ kind: "question_open" });
  }
  if (input.closing) {
    reasons.push({ kind: "closing_lap" });
  }
  return reasons.length === 0
    ? { kind: "would_approve" }
    : { kind: "would_not_approve", reasons: Object.freeze(reasons) };
}

/** What the latest model reading stands in the way with, or null where it does not. */
function modelReason(
  readings: readonly LapReading[],
  checks: LapReading | null,
  scope: GateScope | null,
): GateAutoReason | null {
  const model = latestReading(readings, isModelReadingDrafter);
  if (model === null) {
    return { kind: "model_pending" };
  }
  // An unavailable row carries no evidence, so it is that round's outcome and
  // is said as such, as the gate card says it (`modelPendingOnPage`).
  if (model.verdict === "unavailable") {
    return { kind: "model_unavailable" };
  }
  const tip = model.evidence?.tipCommit;
  if (tip === undefined || tip !== checks?.evidence?.tipCommit) {
    return { kind: "model_pending" };
  }
  const graded = model.graded;
  if (graded === undefined || graded.length !== model.findings.length) {
    return { kind: "model_ungraded" };
  }
  const line = autoThreshold(
    reviewPolicyOf(scope === null ? null : reviewScopeOf(scope.payload)).threshold,
  );
  const counts = FINDING_SEVERITIES.filter((severity) => severityAtOrAbove(severity, line))
    .map((severity) => ({
      severity,
      count: graded.filter((finding) => finding.severity === severity).length,
    }))
    .filter((part) => part.count > 0);
  return counts.length === 0 ? null : { kind: "model_raised", counts: Object.freeze(counts) };
}
