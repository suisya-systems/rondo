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

import { readSplitPayload, type SplitPlan } from "../advisory/proposal.js";
import { type RunPlan, readRunPlan } from "../refrain/plan.js";
import type { HostPolicy } from "../refrain/policy.js";
import {
  claimCover,
  claimCovers,
  normalizeClaim,
  repositoryKey,
  sharedPaths,
  WHOLE_REPOSITORY,
} from "../store/lanes.js";
import { canonicalJson } from "../store/plan.js";
import { isDeterministicReadingDrafter, latestReading } from "../store/records.js";
import {
  type AdvisoryRecord,
  type IterationStore,
  LANE_LEDGER_AUTHOR,
  type LedgerLine,
} from "../store/sqlite.js";
import { DONE_OPENING } from "./done.js";
import { draftedPlansUnder, draftedStanding } from "./drafted-view.js";
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
  /** Other laps hold every execution slot this host allows (D-0012, D-0124). */
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
        /**
         * The line's latest lap: a retry of `first` keeps its lineage, so an
         * ended retry is told apart from the ending before it by this.
         */
        readonly lastLapId: string;
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
  return {
    kind: "waiting",
    after,
    first: { lineageId, state, lastLapId: line?.lapIds.at(-1) ?? lineageId },
  };
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
 * with no claim is admitted claiming the whole repository (D-0073 rule 2.5),
 * asked here in the lane ledger's name so the landing is a basis of that row
 * too: every admitted `then` records the commit it was admitted on.
 */
export function onLanding(
  run: Extract<DraftedPlanRun, { kind: "runnable" }>,
  landing: OrderLanding,
): Pick<Extract<DraftedPlanRun, { kind: "runnable" }>, "plan" | "claim"> {
  return {
    plan: { ...run.plan, prompt: run.plan.prompt + orderSection(landing) },
    claim:
      run.claim === null
        ? {
            paths: [WHOLE_REPOSITORY],
            authorKind: "drafter",
            authorId: LANE_LEDGER_AUTHOR,
            bases: [{ form: "landing", ...landing }],
          }
        : { ...run.claim, bases: [...run.claim.bases, { form: "landing", ...landing }] },
  };
}

/**
 * The request's earlier work a drafted plan could start from (rondo#520,
 * D-0146): a line of the same request and repository that no plan of this
 * split started, has committed work rondo read, and has neither landed nor been
 * given up. `line` names the newest lap of it that rondo read; `notCut` says
 * why the plan starts from the default branch although such work exists.
 */
export type EarlierWork =
  | { readonly kind: "none" }
  | {
      readonly kind: "line";
      readonly lineageId: string;
      readonly branch: string;
      /** The tip and base its reading read, so the prompt names a commit. */
      readonly commit: string;
      readonly baseCommit: string;
      /** What the line still holds (a closed line that has not landed keeps its claim). */
      readonly held: readonly string[];
    }
  | { readonly kind: "notCut"; readonly lineageIds: readonly string[]; readonly reason: string };

export async function earlierWork(
  ports: Pick<DraftedStartPorts, "store" | "record">,
  requestMessageId: string,
  proposalId: string,
  run: Extract<DraftedPlanRun, { kind: "runnable" }>,
): Promise<EarlierWork> {
  const own = new Set<string>();
  for (let index = 0; index < (await splitPlans(ports, proposalId)).length; index += 1) {
    const plan = await draftedPlanRun(ports, requestMessageId, proposalId, index);
    const started =
      plan.kind === "runnable" ? await startedFrom(ports, requestMessageId, plan) : null;
    if (started !== null) {
      own.add(started);
    }
  }
  const repository = repositoryKey(run.repository);
  const found: Extract<EarlierWork, { kind: "line" }>[] = [];
  const running: string[] = [];
  for (const line of await ports.store.laneLedger()) {
    if (line.repository !== repository || own.has(line.lineageId)) {
      continue;
    }
    const root = await ports.store.read(line.lineageId);
    const last = await ports.store.read(line.lapIds.at(-1) ?? line.lineageId);
    if (
      root.kind !== "read" ||
      root.record.requestMessageId !== requestMessageId ||
      line.releasedBy === "person" ||
      (last.kind === "read" && last.record.status === "abandoned") ||
      (await ports.store.landingOf(line.lineageId)) !== null
    ) {
      continue;
    }
    let work: Extract<EarlierWork, { kind: "line" }> | null = null;
    let committed = false;
    // Newest first: the branch is the newest read lap's, and the base the
    // oldest's, so the changed paths are the whole line's and not only the
    // last revision's (whose range starts at its predecessor's tip).
    let baseCommit = "";
    for (const lapId of line.lapIds.toReversed()) {
      const evidence = latestReading(
        await ports.store.readingsFor(lapId),
        isDeterministicReadingDrafter,
      )?.evidence;
      const lap = await ports.store.read(lapId);
      if (evidence === null || evidence === undefined || lap.kind !== "read") {
        continue;
      }
      committed ||= evidence.commitCount > 0;
      baseCommit = evidence.baseCommit;
      work ??= {
        kind: "line",
        lineageId: line.lineageId,
        branch: lap.record.topicBranch ?? "",
        commit: evidence.tipCommit,
        baseCommit: "",
        held: line.paths,
      };
    }
    if (work === null || !committed || work.branch === "") {
      continue;
    }
    work = { ...work, baseCommit };
    if (line.inFlight) {
      running.push(line.lineageId);
    } else {
      found.push(work);
    }
  }
  const only = found[0];
  if (running.length === 0 && found.length === 1 && only !== undefined) {
    return only;
  }
  if (running.length + found.length === 0) {
    return { kind: "none" };
  }
  return {
    kind: "notCut",
    lineageIds: [...running, ...found.map((one) => one.lineageId)],
    reason:
      running.length > 0
        ? "a lap of that work is still running, so its last commit is not known yet"
        : "that work is on several lines, and rondo does not choose one of them",
  };
}

async function splitPlans(
  ports: Pick<DraftedStartPorts, "record">,
  proposalId: string,
): Promise<readonly SplitPlan[]> {
  const read = await ports.record.readProposal(proposalId);
  const payload = read.kind === "read" ? readSplitPayload(read.proposal.payload) : null;
  return payload?.kind === "split" ? payload.payload.plans : [];
}

/**
 * What plan `planIndex` is admitted as a part of (rondo#520): its section and
 * the earlier work it starts from. **A landing in the plan's own repository
 * is where it starts** (D-0098 rule 1.6), and that landing holds whatever the
 * part it follows started from, so no earlier line is looked for; a landing in
 * another repository says nothing of this one's.
 */
export async function partOf(
  ports: Pick<DraftedStartPorts, "store" | "record">,
  requestMessageId: string,
  proposalId: string,
  planIndex: number,
  run: Extract<DraftedPlanRun, { kind: "runnable" }>,
  order: PlanOrder,
): Promise<{ readonly section: string; readonly earlier: EarlierWork }> {
  const earlier: EarlierWork =
    order.kind === "landed" &&
    repositoryKey(order.landing.repository) === repositoryKey(run.repository)
      ? { kind: "none" }
      : await earlierWork(ports, requestMessageId, proposalId, run);
  const prompts = (await splitPlans(ports, proposalId)).map((plan) => plan.prompt);
  return { section: partSection({ index: planIndex, prompts, earlier }), earlier };
}

/** How {@link partSection} opens: what {@link startedFrom} strips. */
export const PART_OPENING = "\n\n---\nWhat this work is part of";

/**
 * The prompt section a drafted plan is admitted with (rondo#520, D-0146): which
 * part of the request it is, what the other parts are, and where it starts.
 * rondo's words, ASCII (D-0004), after the drafted prompt and the order
 * section. Empty for the one plan of a split with no earlier work, which is the
 * whole request as it always was.
 *
 * The worker reads it, and so does the model reviewer, whose instructions
 * (`model-review/judgement.ts`) say what a part means for a finding.
 */
export function partSection(input: {
  readonly index: number;
  readonly prompts: readonly string[];
  readonly earlier: EarlierWork;
}): string {
  const { index, prompts, earlier } = input;
  const lines: string[] = [];
  if (prompts.length > 1) {
    lines.push(
      `This work is part ${String(index + 1)} of ${String(prompts.length)} of one request. ` +
        "Do this part only; other laps do the others:",
      ...prompts.flatMap((prompt, i) =>
        i === index
          ? []
          : [`- part ${String(i + 1)}: ${prompt.split("\n").find((l) => l.trim() !== "") ?? ""}`],
      ),
      "What the request or the issues quoted with it ask of another part is not this work's to do.",
    );
  }
  if (earlier.kind === "line") {
    lines.push(
      `This work starts from branch ${earlier.branch}, at commit ${earlier.commit} when rondo read ` +
        "it: that line holds this request's earlier work, which has not landed. Build on it; do " +
        "not redo it.",
    );
  } else if (earlier.kind === "notCut") {
    lines.push(
      `This request has earlier work that has not landed (line ${earlier.lineageIds.join(", ")}), ` +
        `and this work does not start from it because ${earlier.reason}. It starts from the ` +
        "default branch.",
    );
  }
  return lines.length === 0
    ? ""
    : [
        `${PART_OPENING} (rondo adds this because the request was drafted into parts):`,
        ...lines,
      ].join("\n");
}

/**
 * `admitted` as a part (rondo#520, D-0146): the section after its prompt, and,
 * cut from an earlier line, that line's branch as its base -- the revision's
 * convention (D-0027): the pull request still opens against the plan's own
 * base, and nothing is fetched for a branch that was never pushed. The claim
 * then also asks for what the earlier line changed (`changed`), which this
 * lap's reading, ranged from that branch, never counts -- less what that line
 * still holds itself, which no other line can take and which would otherwise
 * refuse this admission on the line it builds on. `changed` null is a change
 * set rondo could not read: the whole repository is asked for, unless that
 * line still holds paths, which `/` would collide with -- then the drafted
 * claim stands and the holding line keeps guarding its own paths.
 */
export function asPart(
  admitted: Pick<Extract<DraftedPlanRun, { kind: "runnable" }>, "plan" | "claim">,
  section: string,
  earlier: EarlierWork,
  changed: readonly string[] | null,
): Pick<Extract<DraftedPlanRun, { kind: "runnable" }>, "plan" | "claim"> {
  const plan = { ...admitted.plan, prompt: admitted.plan.prompt + section };
  if (earlier.kind !== "line") {
    return { plan, claim: admitted.claim };
  }
  if (changed === null && earlier.held.length > 0) {
    return {
      plan: { ...plan, baseBranch: earlier.branch, pullRequestBaseBranch: plan.baseBranch },
      claim: admitted.claim,
    };
  }
  const widened =
    admitted.claim === null || changed === null
      ? null
      : normalizeClaim([
          ...admitted.claim.paths,
          ...changed.map(claimCover).filter((path) => !claimCovers(earlier.held, path)),
        ]);
  return {
    plan: { ...plan, baseBranch: earlier.branch, pullRequestBaseBranch: plan.baseBranch },
    claim:
      admitted.claim === null || widened?.kind !== "claim"
        ? null
        : {
            ...admitted.claim,
            paths: widened.paths,
            bases: [...admitted.claim.bases, { form: "iteration", iterationId: earlier.lineageId }],
          },
  };
}

/**
 * One part of a request run as several lines (D-0098 rule 8): a plan of the
 * split its approved scope was drafted with, and where it stands in the split's
 * order. Read only; the page says it (`page-logic/parts.ts`).
 */
export interface PartRead {
  /** The plan's index in its split, from 0; the page says *part* `index + 1`. */
  readonly index: number;
  /** The plan's place, or null when its template is gone from the draft's snapshot. */
  readonly repository: string | null;
  /** The paths the part asked to hold, or null for a split drafted before claims. */
  readonly claim: readonly string[] | null;
  /** The part's line: the first lap started from the plan, or null while none is. */
  readonly lineageId: string | null;
  readonly order: PlanOrder;
  /** The split, for the id of rule 1.5's question about this part (`order-host.ts`). */
  readonly proposalId: string;
}

/**
 * The parts of `requestMessageId`, or none where it is not run as several
 * lines: its scope is not an approved drafted one, or its split has one plan.
 *
 * ponytail: `startedFrom` scans every lap once per part, on every redraw; a
 * store with thousands of laps wants the plan's line recorded on the lap.
 */
export async function partsOf(
  ports: Pick<DraftedStartPorts, "store"> & {
    readonly record: DraftedStartPorts["record"] &
      Pick<AdvisoryRecord, "scopesFor" | "scopeDecisionOf" | "readScopeDecision" | "readScope">;
  },
  requestMessageId: string,
): Promise<readonly PartRead[]> {
  const standing = await draftedStanding(ports, requestMessageId);
  if (standing.kind !== "decided") {
    return [];
  }
  const decided = await ports.record.readScopeDecision(standing.scopeDecisionId);
  const scope =
    decided.kind === "read" ? await ports.record.readScope(decided.decision.scopeId) : null;
  const drafted = scope?.kind === "read" ? await draftedPlansUnder(ports, scope.scope) : null;
  if (drafted === null || drafted.plans.length < 2) {
    return [];
  }
  return await Promise.all(
    drafted.plans.map(async (plan): Promise<PartRead> => {
      const run = await draftedPlanRun(ports, requestMessageId, drafted.proposalId, plan.index);
      return {
        index: plan.index,
        repository: plan.repository,
        claim: plan.split.claim ?? null,
        lineageId: run.kind === "runnable" ? await startedFrom(ports, requestMessageId, run) : null,
        order:
          run.kind === "runnable"
            ? await planOrder(ports, requestMessageId, drafted.proposalId, run)
            : { kind: "none" },
        proposalId: drafted.proposalId,
      };
    }),
  );
}

/**
 * Whether the approval standing over `requestMessageId`'s newest draft has a
 * plan no lap has started from (rondo#512): a split drafted again after a lap
 * stopped, and approved, is work to come -- not the stopped lap's ending.
 */
export async function approvedUnstarted(
  ports: Parameters<typeof partsOf>[0],
  requestMessageId: string,
): Promise<boolean> {
  const standing = await draftedStanding(ports, requestMessageId);
  if (standing.kind !== "decided") {
    return false;
  }
  const decided = await ports.record.readScopeDecision(standing.scopeDecisionId);
  const scope =
    decided.kind === "read" ? await ports.record.readScope(decided.decision.scopeId) : null;
  const drafted = scope?.kind === "read" ? await draftedPlansUnder(ports, scope.scope) : null;
  if (drafted === null) {
    return false;
  }
  for (const plan of drafted.plans) {
    const run = await draftedPlanRun(ports, requestMessageId, drafted.proposalId, plan.index);
    if (run.kind === "runnable" && (await startedFrom(ports, requestMessageId, run)) === null) {
      return true;
    }
  }
  return false;
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
    const prompt = [
      DONE_OPENING,
      ISSUES_QUOTE_OPENING,
      ORDER_OPENING,
      PART_OPENING,
      NUMBERS_OPENING,
    ].some((opening) => ran.plan.prompt.startsWith(run.plan.prompt + opening))
      ? run.plan.prompt
      : ran.plan.prompt;
    // A part cut from the request's earlier line (rondo#520) ran from that
    // line's branch; the plan's own base is the one its pull request names.
    const base =
      ran.plan.pullRequestBaseBranch === null
        ? {}
        : { baseBranch: ran.plan.pullRequestBaseBranch, pullRequestBaseBranch: null };
    if (planIdentity({ ...ran.plan, ...base, prompt }) === identity) {
      return lap.id;
    }
  }
  return null;
}
