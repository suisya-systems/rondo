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
import { DONE_OPENING } from "./done.js";
import { ISSUES_QUOTE_OPENING } from "./issue-read.js";
import { type DraftedPlanRun, draftedPlanRun } from "./model-draft/host.js";
import { NUMBERS_OPENING } from "./record-numbers.js";
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
  /**
   * The plan waits on an earlier plan of its split (D-0098 rule 1): `first`
   * has not landed, so this one is not admitted, by a press or by the tick.
   */
  | {
      readonly kind: "ordered";
      readonly after: number;
      readonly first: Extract<PlanOrder, { kind: "waiting" }>["first"];
    }
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
    | "read"
    | "readingsFor"
    | "readLive"
    | "terminalIterations"
    | "occupancy"
    | "laneLedger"
    | "landingOf"
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
  const order = await planOrder(ports, requestMessageId, proposalId, run);
  if (order.kind === "waiting") {
    return { kind: "ordered", after: order.after, first: order.first };
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

/** The landing a `then` is admitted on (D-0098 rule 1.6): `first`'s line, repository and default-branch commit. */
export interface OrderLanding {
  readonly lineageId: string;
  readonly repository: string;
  readonly branch: string;
  readonly commit: string;
}

/**
 * Where a plan stands in its split's order (D-0098 rule 1): no order; waiting
 * on plan `after`, which has not started (`first: null`), is running, has ended
 * and awaits its landing reading, or ended without landing (rule 1.5: released
 * by `abandon`, `fail`, the person's press or with nothing to land -- none of
 * which writes `first_landed`, so this never releases); or released by
 * `first`'s landing.
 *
 * **`first` is a plan of the same split, resolved when read** through
 * {@link startedFrom}: the lap started from plan `after` is `first`'s line.
 * The release fact is `first_landed` for every link, across repositories and
 * within one (D-0098 rule 1.2; stricter than `paths_free` within one, which
 * D-0067 rule 5.1 allows).
 */
export type PlanOrder =
  | { readonly kind: "none" }
  | {
      readonly kind: "waiting";
      readonly after: number;
      readonly first: {
        readonly lineageId: string;
        readonly state: "running" | "awaitingLanding" | "endedUnlanded";
      } | null;
    }
  | { readonly kind: "landed"; readonly landing: OrderLanding };

export async function planOrder(
  ports: Pick<DraftedStartPorts, "store" | "record">,
  requestMessageId: string,
  proposalId: string,
  run: Extract<DraftedPlanRun, { kind: "runnable" }>,
): Promise<PlanOrder> {
  const after = run.split.after;
  if (after === undefined) {
    return { kind: "none" };
  }
  const firstRun = await draftedPlanRun(ports, requestMessageId, proposalId, after);
  const lineageId =
    firstRun.kind === "runnable" ? await startedFrom(ports, requestMessageId, firstRun) : null;
  if (firstRun.kind !== "runnable" || lineageId === null) {
    return { kind: "waiting", after, first: null };
  }
  const landing = await ports.store.landingOf(lineageId);
  if (landing !== null) {
    return {
      kind: "landed",
      landing: {
        lineageId,
        repository: firstRun.repository,
        branch: landing.branch,
        commit: landing.commit,
      },
    };
  }
  const line = (await ports.store.laneLedger()).find((one) => one.lineageId === lineageId);
  const state =
    line?.inFlight === true
      ? "running"
      : (line?.releasedBy ?? null) === null
        ? "awaitingLanding"
        : "endedUnlanded";
  return { kind: "waiting", after, first: { lineageId, state } };
}

/** How {@link orderSection} opens: what {@link startedFrom} strips. */
export const ORDER_OPENING = "\n\n---\nWhat this work builds on";

/**
 * The prompt section a `then` is admitted with (D-0098 rule 1.6): the
 * dependency's repository, default branch and the commit its landing was read
 * at, which is the pin target. rondo's words, ASCII (D-0004), after the drafted
 * prompt and before the definition of done. No version is guessed before the
 * landing, so the commit is named only once it is read.
 */
export function orderSection(landing: OrderLanding): string {
  return [
    `${ORDER_OPENING} (rondo adds this because this work waits on another):`,
    `The work this follows has landed in ${landing.repository}: its default branch ` +
      `${landing.branch} is at commit ${landing.commit}, which holds it.`,
    "Build on that commit (it is the pin target). Do not use an earlier or a later one.",
  ].join("\n");
}

/**
 * `run`'s plan and claim as a `then` is admitted on `first`'s landing (D-0098
 * rule 1.6): the section after the prompt, and the landing as a basis of the
 * claim row `reserve()` writes in the admission's transaction. A split drafted
 * with no claim is admitted claiming the whole repository (D-0073 rule 2.5)
 * with no claim row of its own asking, so the basis is carried by the prompt
 * alone there.
 */
export function onLanding(
  run: Extract<DraftedPlanRun, { kind: "runnable" }>,
  landing: OrderLanding,
): Pick<Extract<DraftedPlanRun, { kind: "runnable" }>, "plan" | "claim"> {
  return {
    plan: { ...run.plan, prompt: run.plan.prompt + orderSection(landing) },
    claim:
      run.claim === null
        ? null
        : { ...run.claim, bases: [...run.claim.bases, { form: "landing", ...landing }] },
  };
}

/** The open lines of the plan's repository holding a path its claim asks for. */
function heldBy(
  ledger: readonly LedgerLine[],
  run: Extract<DraftedPlanRun, { kind: "runnable" }>,
): readonly { readonly line: LedgerLine; readonly paths: readonly string[] }[] {
  const repository = repositoryKey(run.repository);
  const asked = run.claim?.paths ?? [WHOLE_REPOSITORY];
  return ledger.flatMap((line) => {
    // The decision record is shared-append (D-0098 rule 3.5): never held.
    const paths =
      line.repository === repository ? sharedPaths(asked, line.paths, run.plan.decisionRecord) : [];
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
    // A lap's prompt is its plan's with the definition of done (rondo#377)
    // and the issues it was given after it (D-0078 section 3.4); those
    // sections are the lap's, not the plan's. A lap admitted before rondo#377
    // has the issues alone.
    const prompt = [DONE_OPENING, ISSUES_QUOTE_OPENING, ORDER_OPENING, NUMBERS_OPENING].some(
      (opening) => ran.plan.prompt.startsWith(run.plan.prompt + opening),
    )
      ? run.plan.prompt
      : ran.plan.prompt;
    if (planIdentity({ ...ran.plan, prompt }) === identity) {
      return lap.id;
    }
  }
  return null;
}
