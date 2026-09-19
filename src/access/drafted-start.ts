/**
 * Whether one plan of a drafted split can be started now, answered **before**
 * anything is pressed (rondo#238 C2).
 *
 * **A button that cannot work is not drawn; its reason is.** A refused scoped
 * admission writes a stop into the request's thread (D-0066 rule 4.4), so a
 * press offered where the scope's own tests already fail would write a
 * question the person never caused. This reads everything that decides it --
 * the plan itself, a lap already started from it, the host's capacity, and
 * the scope's verdict for exactly the act the button would take -- and writes
 * nothing.
 *
 * ponytail: D-0073's lane claims are not built, so a claim collision is not a
 * reason here yet; it is added where the ledger is.
 */

import type { HostPolicy } from "../refrain/policy.js";
import type { AdvisoryRecord, IterationStore } from "../store/sqlite.js";
import { type DraftedPlanRun, draftedPlanRun } from "./model-drafter.js";
import { gatherScopeSnapshot, type ScopeReadPorts, scopeVerdict } from "./scope.js";

/** The id the verdict is asked about: a shape `allocate` accepts, and no row's. */
const ASKED_AS = "lap-00000000-0000-0000-0000-000000000000";

export type DraftedStartReadiness =
  | {
      readonly kind: "ready";
      readonly run: Extract<DraftedPlanRun, { kind: "runnable" }>;
    }
  /** A lap of this request already runs, or ran, on this plan. */
  | { readonly kind: "started"; readonly iterationId: string }
  /** Another lap holds the one execution slot this host allows (D-0012). */
  | { readonly kind: "busy"; readonly occupying: number; readonly limit: number }
  /** As many laps are open as this host allows (D-0023). */
  | { readonly kind: "full"; readonly live: number; readonly limit: number }
  /** The scope's own verdict for this start: which test, and its reason. */
  | { readonly kind: "outside"; readonly test: string; readonly reason: string }
  /** The plan will not run at all (its template or agent type is gone). */
  | { readonly kind: "unrunnable"; readonly reason: string };

export interface DraftedStartPorts {
  readonly store: Pick<
    IterationStore,
    "read" | "readingsFor" | "readLive" | "terminalIterations" | "occupancy"
  >;
  readonly record: ScopeReadPorts["record"] &
    Pick<AdvisoryRecord, "readProposal" | "heldAgentType">;
  readonly policy: Pick<HostPolicy, "maxOccupying" | "maxLive">;
  readonly nowMs: number;
}

/**
 * Whether plan `planIndex` of split `proposalId` can start under the approval
 * `scopeDecisionId`, in the order a person would want to know: the plan, a lap
 * already started from it, the host's capacity, the scope.
 */
export async function draftedStartReadiness(
  ports: DraftedStartPorts,
  requestMessageId: string,
  scopeDecisionId: string,
  proposalId: string,
  planIndex: number,
): Promise<DraftedStartReadiness> {
  const run = await draftedPlanRun(ports, requestMessageId, proposalId, planIndex);
  if (run.kind !== "runnable") {
    return { kind: "unrunnable", reason: run.reason };
  }
  const started = await startedFrom(ports, requestMessageId, run);
  if (started !== null) {
    return { kind: "started", iterationId: started };
  }
  const occupancy = await ports.store.occupancy();
  if (occupancy.live >= ports.policy.maxLive) {
    return { kind: "full", live: occupancy.live, limit: ports.policy.maxLive };
  }
  if (occupancy.occupying >= ports.policy.maxOccupying) {
    return { kind: "busy", occupying: occupancy.occupying, limit: ports.policy.maxOccupying };
  }
  const gathered = await gatherScopeSnapshot(
    ports,
    scopeDecisionId,
    {
      kind: "lineage_start",
      iterationId: ASKED_AS,
      plan: run.plan,
      proposalId,
      requestMessageId,
    },
    ports.nowMs,
  );
  if (gathered.kind !== "gathered") {
    return { kind: "outside", test: gathered.test, reason: gathered.reason };
  }
  const verdict = scopeVerdict(
    {
      kind: "lineage_start",
      iterationId: ASKED_AS,
      plan: run.plan,
      proposalId,
      requestMessageId,
    },
    gathered.snapshot,
  );
  return verdict.kind === "inside"
    ? { kind: "ready", run }
    : { kind: "outside", test: verdict.test, reason: verdict.reason };
}

/**
 * The lap of this request that already started from this plan, or null: one
 * whose own plan carries the split's prompt in the split's place. A lap's plan
 * is the only record of which drafted plan it ran, and the prompt is the one
 * field the drafter wrote (D-0063 rule 4.3).
 */
async function startedFrom(
  ports: Pick<DraftedStartPorts, "store">,
  requestMessageId: string,
  run: Extract<DraftedPlanRun, { kind: "runnable" }>,
): Promise<string | null> {
  for (const outcome of [
    ...(await ports.store.readLive()),
    ...(await ports.store.terminalIterations()),
  ]) {
    if (outcome.kind !== "read") {
      continue;
    }
    const lap = outcome.record;
    if (
      lap.requestMessageId === requestMessageId &&
      lap.supersedesIterationId === null &&
      lap.plan["prompt"] === run.split.prompt &&
      lap.plan["repository"] === run.repository &&
      lap.plan["workspace_root"] === run.workspaceRoot
    ) {
      return lap.id;
    }
  }
  return null;
}
