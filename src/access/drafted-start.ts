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
 * **Files another line holds are a reason and not a verdict** (D-0073 rules 3.1
 * and 7): `held` names each holding line, and a line with no lap in flight may
 * have landed unread -- its landing is read when a start is attempted -- so the
 * page still draws the press there, beside the reason. `reserve()` stays the
 * backstop either way.
 */

import { type RunPlan, readRunPlan } from "../refrain/plan.js";
import type { HostPolicy } from "../refrain/policy.js";
import { repositoryKey, sharedPaths, WHOLE_REPOSITORY } from "../store/lanes.js";
import { canonicalJson } from "../store/plan.js";
import type { AdvisoryRecord, IterationStore, LedgerLine } from "../store/sqlite.js";
import { ISSUES_QUOTE_OPENING } from "./issue-read.js";
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
  /**
   * Open lines of the same repository hold files this plan would claim
   * (D-0073 rule 3.1): each line, and the asked paths it holds.
   */
  | {
      readonly kind: "held";
      readonly run: Extract<DraftedPlanRun, { kind: "runnable" }>;
      readonly holders: readonly { readonly line: LedgerLine; readonly paths: readonly string[] }[];
    }
  /** The scope's own verdict for this start: which test, and its reason. */
  | { readonly kind: "outside"; readonly test: string; readonly reason: string }
  /**
   * The scope's tests could not be read (D-0066's `undecidable`): not a no,
   * and said as that -- a row that will not read is not a reason the work is
   * outside the scope.
   */
  | { readonly kind: "undecidable"; readonly test: string; readonly reason: string }
  /** The plan will not run at all (its template or agent type is gone). */
  | { readonly kind: "unrunnable"; readonly reason: string };

export interface DraftedStartPorts {
  readonly store: Pick<
    IterationStore,
    "read" | "readingsFor" | "readLive" | "terminalIterations" | "occupancy" | "laneLedger"
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
    return { kind: "undecidable", test: gathered.test, reason: gathered.reason };
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
  if (verdict.kind !== "inside") {
    return { kind: verdict.kind, test: verdict.test, reason: verdict.reason };
  }
  const holders = heldBy(await ports.store.laneLedger(), run);
  return holders.length === 0 ? { kind: "ready", run } : { kind: "held", run, holders };
}

/** The open lines of the plan's repository holding a path its claim asks for. */
function heldBy(
  ledger: readonly LedgerLine[],
  run: Extract<DraftedPlanRun, { kind: "runnable" }>,
): readonly { readonly line: LedgerLine; readonly paths: readonly string[] }[] {
  const repository = repositoryKey(run.repository);
  const asked = run.claim?.paths ?? [WHOLE_REPOSITORY];
  return ledger.flatMap((line) => {
    const paths = line.repository === repository ? sharedPaths(asked, line.paths) : [];
    return paths.length === 0 ? [] : [{ line, paths }];
  });
}

/**
 * A plan as the fields a lap runs on: canonical JSON with `parties.grantee`
 * blanked, the one run field admission writes into it (`admittedPlan` sets it
 * to the allocated run id), so a plan and the lap admitted from it compare equal.
 */
function planIdentity(plan: RunPlan): string {
  return canonicalJson({ ...plan, parties: { ...plan.parties, grantee: "" } } as never);
}

/**
 * The lap of this request that already started from this plan, or null: a
 * first lap whose own plan **is this plan** -- every field a lap runs on, with
 * only the identifiers admission derives (run id, branch, workspace: D-0063
 * rule 4.5) left out, because those are the lap's and not the plan's. A lap's
 * plan is the only record of which drafted plan it ran, and two plans of one
 * split may share a prompt and a place and still differ.
 */
async function startedFrom(
  ports: Pick<DraftedStartPorts, "store">,
  requestMessageId: string,
  run: Extract<DraftedPlanRun, { kind: "runnable" }>,
): Promise<string | null> {
  const identity = planIdentity(run.plan);
  for (const outcome of [
    ...(await ports.store.readLive()),
    ...(await ports.store.terminalIterations()),
  ]) {
    if (outcome.kind !== "read") {
      continue;
    }
    const lap = outcome.record;
    if (lap.requestMessageId !== requestMessageId || lap.supersedesIterationId !== null) {
      continue;
    }
    const ran = readRunPlan(lap.plan);
    if (ran.kind !== "planned") {
      continue;
    }
    // A lap's prompt is its plan's with the issues it was given after it
    // (D-0078 section 3.4); that section is the lap's, not the plan's.
    const prompt = ran.plan.prompt.startsWith(run.plan.prompt + ISSUES_QUOTE_OPENING)
      ? run.plan.prompt
      : ran.plan.prompt;
    if (planIdentity({ ...ran.plan, prompt }) === identity) {
      return lap.id;
    }
  }
  return null;
}
