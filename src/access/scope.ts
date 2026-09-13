/**
 * The one point where the organisation stops (D-0066 section 4): the verdict an
 * act under a scope gets, the snapshot it is computed over, and the single call
 * site that turns `inside` into an admission.
 *
 * **Pure where it decides, and it owns no capability.** {@link scopeVerdict} is
 * a total function of the scope row, its decision, the act and a snapshot, so
 * every test below is a unit case with hand-built rows. {@link gatherScopeSnapshot}
 * reads the store and asks cadenza through the facade; {@link admitUnderScope}
 * is gather, verdict, and -- only on `inside` -- `admit`. No `node:*` import:
 * this module is not on the externals allowlist.
 *
 * **The surface's verdict, and the store makes it again.** Rule 4.3: what lives
 * in the store (the scope's fields, the superseding approval, the budgets) is
 * re-tested by `reserve()` under the write lock, in the transaction that writes
 * the consumption. What does not (the agent type record, the grant, the
 * readings) is decided here from the snapshot, and its drift before the write
 * is D-0047 rule 6's bounded race.
 *
 * ponytail: residual R1. The request thread (D-0061 rules 2 and 4, build steps
 * 5.1 and 5.2) is not built, so no row links an act to the message that opened
 * its request, and no message carries `asks`. The production gatherer passes
 * `requestMessageId` and `openAsks` as null, the verdict answers `undecidable`
 * for both, and so **no act under a scope is taken on this tree**. When the
 * thread lands only the gatherer changes. R2: the stopping message of rule 4.4
 * has nowhere to be written either, so a refusal is returned and printed, and
 * no row keeps the line stopped.
 */

import { agentTypeRecord } from "../cadenza/facade.js";
import { allocate } from "../refrain/allocator.js";
import { classifyPlan } from "../refrain/classification.js";
import type { ConductorReport } from "../refrain/interpreter.js";
import { admittedPlan, type RunPlan, readPlan } from "../refrain/plan.js";
import type { ScopeSpend } from "../refrain/ports.js";
import {
  IRREVERSIBLE_ACTS,
  isModelReadingDrafter,
  type LapReading,
  latestReading,
  type ScopePayload,
  type ScopeSpent,
  type StoredScope,
  type StoredScopeDecision,
} from "../store/records.js";
import type { AdvisoryRecord, IterationStore } from "../store/sqlite.js";
import {
  type ReviewScope,
  reviewPolicyOf,
  reviewRoundDecision,
  reviewRoundsAlong,
} from "./model-review.js";

/**
 * An admission under a scope (D-0066 rule 3.2: the one writable act kind).
 *
 * The two arms are rule 4.2's readings bullet: a split's plan **starts a
 * lineage** and has no reading to test; an in-scope retry **redoes a lap** and
 * reads its predecessor's. `iterationId` is the id the admission will reserve.
 */
export type ScopeAct =
  | {
      readonly kind: "lineage_start";
      readonly iterationId: string;
      readonly plan: RunPlan;
      /** The split proposal the plan came from (rule 3.3). */
      readonly proposalId: string | null;
    }
  | {
      readonly kind: "redo";
      readonly iterationId: string;
      readonly plan: RunPlan;
      readonly predecessorId: string;
    };

/** Which of rule 4.2's tests refused, as a closed name a test and a screen can both read. */
export type ScopeTest =
  | "decision"
  | "superseded"
  | "request"
  | "workspace"
  | "agent_type"
  | "contract"
  | "irreversible"
  | "expiry"
  | "laps"
  | "cost"
  | "asks"
  | "grants"
  | "readings";

export type ScopeVerdict =
  | { readonly kind: "inside" }
  | { readonly kind: "outside"; readonly test: ScopeTest; readonly reason: string }
  | { readonly kind: "undecidable"; readonly test: ScopeTest; readonly reason: string };

/** A message with `asks` set and no reply (D-0061 rule 2.7), by the lineage its bases name. */
export interface OpenAsk {
  /** The `iteration_id` basis, or null when it names no lap (rule 4.4's first bullet). */
  readonly iterationId: string | null;
}

type Read<T> =
  | ({ readonly kind: "read" } & T)
  | { readonly kind: "unreadable"; readonly reason: string };

/** Everything the verdict reads, gathered once, before the act (rule 4.1). */
export interface ScopeSnapshot {
  readonly scope: StoredScope;
  readonly decision: StoredScopeDecision;
  readonly supersededByApproved: boolean;
  readonly spent: ScopeSpent;
  readonly nowMs: number;
  /** The message that opened the act's request, or null: not readable on this tree (R1). */
  readonly requestMessageId: string | null;
  /** Open `asks` in the request's thread, or null: not readable on this tree (R1). */
  readonly openAsks: readonly OpenAsk[] | null;
  /** The act's lineage, newest first: empty for a lineage start (rule 4.4). */
  readonly lineageIterationIds: Read<{ readonly ids: readonly string[] }>;
  /** cadenza's answer for the act's own plan under the admission's identity. */
  readonly classification: Read<{
    readonly outcome: string;
    readonly agentTypeDigest: string;
    readonly granted: readonly string[];
  }>;
  /** Null for a lineage start. */
  readonly predecessor: {
    readonly grants: Read<{
      readonly granted: readonly string[];
      readonly contractDigestMatches: boolean;
    }>;
    readonly readings: Read<{
      readonly latestModelReading: LapReading | null;
      readonly roundsTaken: number;
    }>;
  } | null;
}

/** The scope's two review fields in `model-review.ts`'s view: the D-0065 seam, wired. */
export function reviewScopeOf(payload: ScopePayload): ReviewScope {
  return Object.freeze({
    budgets: Object.freeze({ reviewRounds: payload.budgets.review_rounds }),
    severityThreshold: payload.severity_threshold,
  });
}

/**
 * The verdict (D-0066 rule 4.2), **the first failing test decides**, in the
 * order below. Anything but `inside` takes no act and writes no consumption
 * (rule 4.1) -- that half is {@link admitUnderScope}'s.
 *
 * The order puts the approval first because every later test reads the row it
 * approved; the store-backed tests before the snapshot-backed ones in the same
 * order `reserve()` re-tests them; and the asks and the redo tests last, since
 * R1 makes the asks test undecidable on every production snapshot and the
 * other refusals are still worth naming ahead of it.
 */
export function scopeVerdict(act: ScopeAct, snapshot: ScopeSnapshot): ScopeVerdict {
  const outside = (test: ScopeTest, reason: string): ScopeVerdict => ({
    kind: "outside",
    test,
    reason,
  });
  const undecidable = (test: ScopeTest, reason: string): ScopeVerdict => ({
    kind: "undecidable",
    test,
    reason,
  });
  const { scope, decision } = snapshot;
  const payload = scope.payload;
  const budgets = payload.budgets;

  // 1. The approval, of this row (rules 2.2 and 4.3).
  if (decision.scopeId !== scope.scopeId || decision.scopeDigest !== scope.scopeDigest) {
    return outside(
      "decision",
      `the decision '${decision.scopeDecisionId}' names ${decision.scopeDigest} of scope ` +
        `'${decision.scopeId}', which is not ${scope.scopeDigest} of '${scope.scopeId}' (D-0066 rule 2.2)`,
    );
  }
  if (decision.outcome !== "approved") {
    return outside(
      "decision",
      `the scope '${scope.scopeId}' was ${decision.outcome}, and only an approval covers an act (D-0066 rule 2)`,
    );
  }
  // 2. Superseded by an approved successor, at any depth (rule 1.4).
  if (snapshot.supersededByApproved) {
    return outside(
      "superseded",
      `a successor of scope '${scope.scopeId}' is approved, and it retires this approval (D-0066 rule 1.4)`,
    );
  }
  // 3. The request (rule 1.2.1).
  if (snapshot.requestMessageId === null) {
    return undecidable(
      "request",
      "the request this act answers cannot be read: the request thread (D-0061 rules 2 and 4) is " +
        "not built, so no row links an act to the message that opened its request",
    );
  }
  if (!payload.requests.includes(snapshot.requestMessageId)) {
    return outside(
      "request",
      `the request '${snapshot.requestMessageId}' is not in the scope's requests (D-0066 rule 1.2.1)`,
    );
  }
  // 4. The workspace pair, byte for byte (rule 1.2.2).
  const { repository, workspaceRoot } = act.plan;
  if (
    !payload.workspaces.some(
      (w) => w.repository === repository && w.workspace_root === workspaceRoot,
    )
  ) {
    return outside(
      "workspace",
      `(${repository}, ${workspaceRoot}) is not one of the scope's workspaces (D-0066 rule 1.2.2)`,
    );
  }
  // 5. The agent type (rule 1.2.3).
  const classification = snapshot.classification;
  if (classification.kind === "unreadable") {
    return undecidable(
      "agent_type",
      `cadenza could not classify the plan, so its agent type is unknown: ${classification.reason}`,
    );
  }
  if (!payload.agent_types.includes(classification.agentTypeDigest)) {
    return outside(
      "agent_type",
      `the plan's agent type ${classification.agentTypeDigest} is not in the scope's agent_types ` +
        "(D-0066 rule 1.2.3)",
    );
  }
  // 6. No grant beyond the agent type's (D-0064 rule 3.2).
  if (classification.outcome !== "allowed") {
    return outside(
      "contract",
      `cadenza answered '${classification.outcome}' for the composed contract, and only 'allowed' ` +
        "needs no grant beyond the agent type's (D-0064 rule 3.2)",
    );
  }
  // 7. Irreversible, always outside (D-0064 rule 3.4, D-0066 rule 1.2.7). An
  // admission is not on the entry's list; a scope may add it.
  const actName = "admission";
  if (
    (IRREVERSIBLE_ACTS as readonly string[]).includes(actName) ||
    payload.irreversible_additions.includes(actName)
  ) {
    return outside(
      "irreversible",
      `'${actName}' is irreversible under this scope, and an irreversible act is always outside ` +
        "(D-0064 rule 3.4)",
    );
  }
  // 8. The budgets an admission spends, with the store's own arithmetic (rule 3.4).
  if (snapshot.nowMs >= budgets.expires_at_ms) {
    return outside(
      "expiry",
      `the scope expired at ${String(budgets.expires_at_ms)} (D-0066 rule 1.2.4)`,
    );
  }
  if (snapshot.spent.admissions >= budgets.laps) {
    return outside(
      "laps",
      `${String(snapshot.spent.admissions)} of ${String(budgets.laps)} laps are spent (D-0066 rule 3.4.1)`,
    );
  }
  const committed =
    snapshot.spent.readCostUsd + (snapshot.spent.unreadLaps + 1) * budgets.cost_reserve_usd;
  if (committed > budgets.cost_usd) {
    return outside(
      "cost",
      `${String(committed)} USD read and reserved would pass the budget of ` +
        `${String(budgets.cost_usd)} USD (D-0066 rule 3.4.2)`,
    );
  }
  // 9. Open asks over the act's line (rule 4.2, D-0061 rule 2.7).
  if (snapshot.openAsks === null) {
    return undecidable(
      "asks",
      "whether a question stands over this line cannot be read: the request thread (D-0061 " +
        "rules 2 and 4) is not built, so no message carries asks",
    );
  }
  const lineage = snapshot.lineageIterationIds;
  if (lineage.kind === "unreadable") {
    return undecidable("asks", `the act's lineage cannot be walked: ${lineage.reason}`);
  }
  const standing = snapshot.openAsks.find((ask) =>
    ask.iterationId === null ? act.kind === "lineage_start" : lineage.ids.includes(ask.iterationId),
  );
  if (standing !== undefined) {
    return outside(
      "asks",
      standing.iterationId === null
        ? "an unanswered question about the request holds back its plans not yet admitted (D-0066 rule 4.4)"
        : `an unanswered question stands over iteration '${standing.iterationId}' on this line (D-0066 rule 4.4)`,
    );
  }
  if (act.kind === "lineage_start") {
    // Rule 4.2: a lineage start has no reading to test and none is required.
    return { kind: "inside" };
  }
  // 10. A redo: no grant beyond the predecessor's (D-0064 O4), and its readings.
  const predecessor = snapshot.predecessor;
  if (predecessor === null) {
    return undecidable("grants", `the predecessor '${act.predecessorId}' was not gathered`);
  }
  const grants = predecessor.grants;
  if (grants.kind === "unreadable") {
    return undecidable(
      "grants",
      `the predecessor's grants cannot be recomposed, so the comparison cannot be made: ${grants.reason}`,
    );
  }
  if (!grants.contractDigestMatches) {
    return undecidable(
      "grants",
      `the predecessor '${act.predecessorId}' no longer recomposes to the contract digest on its ` +
        "row, so its grants are not the ones it ran under (D-0066 rule 4.2)",
    );
  }
  const wider = classification.granted.filter((key) => !grants.granted.includes(key));
  if (wider.length > 0) {
    return outside(
      "grants",
      `the redo grants ${wider.join(", ")}, which '${act.predecessorId}' did not (D-0064 O4)`,
    );
  }
  const readings = predecessor.readings;
  if (readings.kind === "unreadable") {
    return undecidable("readings", `the predecessor's readings cannot be read: ${readings.reason}`);
  }
  if (readings.latestModelReading === null) {
    // Q-a: D-0066 is silent, and a redo is the correction of a finding -- with
    // no reading there is nothing to show the redo corrects.
    return undecidable(
      "readings",
      `the predecessor '${act.predecessorId}' has no model reading, so there is no round to test`,
    );
  }
  const round = reviewRoundDecision({
    latest: readings.latestModelReading,
    roundsTaken: readings.roundsTaken,
    policy: reviewPolicyOf(reviewScopeOf(payload)),
  });
  return round.kind === "stop" ? outside("readings", round.reason) : { kind: "inside" };
}

/** The store half the gatherer reads, and nothing it could write with. */
export interface ScopeReadPorts {
  readonly store: Pick<IterationStore, "read" | "readingsFor">;
  readonly record: Pick<
    AdvisoryRecord,
    "readScope" | "readScopeDecision" | "scopeSpent" | "scopeSupersededByApproved"
  >;
}

export type ScopeGather =
  | { readonly kind: "gathered"; readonly snapshot: ScopeSnapshot }
  | { readonly kind: "undecidable"; readonly test: "decision"; readonly reason: string };

/** Links a lineage walk follows before it calls the chain unreadable. */
const LINEAGE_BOUND = 1000;

/**
 * Gather the snapshot for one act (rule 4.1). **Reads only.**
 *
 * `requestMessageId` and `openAsks` are null, always, on this tree: the request
 * thread (D-0061 rules 2 and 4) is not built, so there is nothing to read them
 * from (residual R1). The verdict answers `undecidable` for that.
 */
export async function gatherScopeSnapshot(
  ports: ScopeReadPorts,
  scopeDecisionId: string,
  act: ScopeAct,
  nowMs: number,
): Promise<ScopeGather> {
  const decision = await ports.record.readScopeDecision(scopeDecisionId);
  if (decision.kind !== "read") {
    return {
      kind: "undecidable",
      test: "decision",
      reason:
        decision.kind === "absent"
          ? `there is no scope decision '${scopeDecisionId}'`
          : `the scope decision '${scopeDecisionId}' will not read: ${decision.reason}`,
    };
  }
  const scopeId = decision.decision.scopeId;
  const scope = await ports.record.readScope(scopeId);
  if (scope.kind !== "read") {
    return {
      kind: "undecidable",
      test: "decision",
      reason:
        scope.kind === "absent"
          ? `the decision names scope '${scopeId}', and there is no such row`
          : `the scope '${scopeId}' will not read: ${scope.reason}`,
    };
  }

  const chain = act.kind === "redo" ? await walkLineage(ports, act.predecessorId) : null;
  return {
    kind: "gathered",
    snapshot: Object.freeze({
      scope: scope.scope,
      decision: decision.decision,
      supersededByApproved: await ports.record.scopeSupersededByApproved(scopeId),
      spent: await ports.record.scopeSpent(scopeDecisionId),
      nowMs,
      requestMessageId: null,
      openAsks: null,
      lineageIterationIds:
        chain === null
          ? { kind: "read" as const, ids: [] }
          : chain.kind === "read"
            ? { kind: "read" as const, ids: chain.links.map((link) => link.id) }
            : chain,
      classification: classifyAs(act.plan, act.iterationId),
      predecessor:
        act.kind === "redo" && chain !== null
          ? {
              grants: await predecessorGrants(ports, act.predecessorId),
              readings:
                chain.kind === "read"
                  ? {
                      kind: "read" as const,
                      latestModelReading: latestReading(
                        chain.links[0]?.readings ?? [],
                        isModelReadingDrafter,
                      ),
                      roundsTaken: reviewRoundsAlong(chain.links),
                    }
                  : chain,
            }
          : null,
    }),
  };
}

/** cadenza's classification of a plan under one admission identity, with its agent type's grants. */
function classifyAs(plan: RunPlan, iterationId: string): ScopeSnapshot["classification"] {
  const allocation = allocate(iterationId, plan.workspaceRoot);
  if (allocation.kind !== "allocated") {
    return { kind: "unreadable", reason: allocation.reason };
  }
  const admitted = admittedPlan(plan, allocation.allocation);
  if (admitted.kind !== "planned") {
    return { kind: "unreadable", reason: admitted.reason };
  }
  const classified = classifyPlan(admitted.plan);
  if (classified.kind !== "answered") {
    return { kind: "unreadable", reason: effectReason(classified) };
  }
  return {
    kind: "read",
    outcome: classified.value.outcome,
    agentTypeDigest: classified.value.agentTypeDigest,
    // classifyPlan built this record without throwing a moment ago, so this
    // call over the same input does not throw either.
    granted: [...agentTypeRecord(admitted.plan.agentTypeInput).granted],
  };
}

/**
 * The predecessor's grants, recomposed through the facade from its stored plan
 * (rule 4.2's "recomposed through the facade", D-0047 rule 4's seam), and whether
 * that recomposition is the contract its row carries.
 */
async function predecessorGrants(
  ports: ScopeReadPorts,
  predecessorId: string,
): Promise<NonNullable<ScopeSnapshot["predecessor"]>["grants"]> {
  const row = await ports.store.read(predecessorId);
  if (row.kind !== "read") {
    return { kind: "unreadable", reason: `the iteration '${predecessorId}' is ${row.kind}` };
  }
  const decoded = readPlan(row.record.plan);
  if (decoded.kind !== "planned") {
    return { kind: "unreadable", reason: decoded.reason };
  }
  const classified = classifyPlan(decoded.plan);
  if (classified.kind !== "answered") {
    return { kind: "unreadable", reason: effectReason(classified) };
  }
  return {
    kind: "read",
    granted: [...agentTypeRecord(decoded.plan.agentTypeInput).granted],
    contractDigestMatches:
      row.record.contractDigest !== null &&
      row.record.contractDigest === classified.value.contractDigest,
  };
}

type Lineage = Read<{
  readonly links: readonly { readonly id: string; readonly readings: readonly LapReading[] }[];
}>;

/** The lineage from `tipId` back along `supersedesIterationId`, newest first (D-0030). */
async function walkLineage(ports: ScopeReadPorts, tipId: string): Promise<Lineage> {
  const links: { id: string; readings: readonly LapReading[] }[] = [];
  const seen = new Set<string>();
  let next: string | null = tipId;
  while (next !== null) {
    if (seen.has(next) || links.length >= LINEAGE_BOUND) {
      return { kind: "unreadable", reason: `the lineage through '${next}' does not end` };
    }
    seen.add(next);
    const row = await ports.store.read(next);
    if (row.kind !== "read") {
      return {
        kind: "unreadable",
        reason: `the iteration '${next}' on the lineage is ${row.kind}`,
      };
    }
    links.push({ id: next, readings: await ports.store.readingsFor(next) });
    next = row.record.supersedesIterationId;
  }
  return { kind: "read", links };
}

export type ScopedAdmission =
  | { readonly kind: "admitted"; readonly report: ConductorReport }
  | {
      readonly kind: "refused";
      readonly verdict: "outside" | "undecidable";
      readonly test: ScopeTest;
      readonly reason: string;
    };

/** What the one call site needs: the reads, a clock, and `admit` already bound to its ports. */
export interface ScopeAdmitPorts extends ScopeReadPorts {
  readonly nowMs: () => number;
  /** `conductor.admit(ports, advisory, plan, policy, id, supersedes, null, null, scopeSpend)`. */
  readonly admit: (
    plan: RunPlan,
    iterationId: string,
    supersedesIterationId: string | null,
    scopeSpend: ScopeSpend,
  ) => Promise<ConductorReport>;
}

/**
 * **The one place a verdict is computed and acted on** (D-0066 rule 4.1):
 * gather, verdict, and anything but `inside` returns the refusal without
 * calling `admit`. On `inside` the admission carries the scope spend, and
 * `reserve()` re-tests and writes the consumption in the row's own transaction.
 *
 * R2: the refusal is returned for the surface to print; rule 4.4's stopping
 * message is not written, because the thread it goes into is not built.
 */
export async function admitUnderScope(
  ports: ScopeAdmitPorts,
  scopeDecisionId: string,
  act: ScopeAct,
): Promise<ScopedAdmission> {
  const gathered = await gatherScopeSnapshot(ports, scopeDecisionId, act, ports.nowMs());
  if (gathered.kind !== "gathered") {
    return {
      kind: "refused",
      verdict: "undecidable",
      test: gathered.test,
      reason: gathered.reason,
    };
  }
  const snapshot = gathered.snapshot;
  const verdict = scopeVerdict(act, snapshot);
  if (verdict.kind !== "inside") {
    return { kind: "refused", verdict: verdict.kind, test: verdict.test, reason: verdict.reason };
  }
  // `inside` has passed the request and classification tests, so both are read.
  if (snapshot.requestMessageId === null || snapshot.classification.kind !== "read") {
    throw new Error("an inside verdict over an unread request or classification is a defect");
  }
  return {
    kind: "admitted",
    report: await ports.admit(
      act.plan,
      act.iterationId,
      act.kind === "redo" ? act.predecessorId : null,
      {
        scopeDecisionId,
        // Rule 3.3: an in-scope retry names no proposal.
        proposalId: act.kind === "lineage_start" ? act.proposalId : null,
        requestMessageId: snapshot.requestMessageId,
        // Drift between this classification and the store's write is D-0047
        // rule 6's bounded race, which D-0066 rule 4.3 accepts.
        agentTypeDigest: snapshot.classification.agentTypeDigest,
      },
    ),
  };
}

/** Why cadenza gave no answer, in its own words (D-0018 rule 7). */
function effectReason(outcome: ReturnType<typeof classifyPlan>): string {
  switch (outcome.kind) {
    case "answered":
      return "answered";
    case "refused":
      return outcome.message;
    default:
      return outcome.reason;
  }
}
