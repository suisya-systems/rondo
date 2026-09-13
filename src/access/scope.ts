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
 * in the store (the scope's fields, the superseding approval, the budgets, the
 * request and the open asks) is re-tested by `reserve()` under the write lock,
 * in the transaction that writes the consumption. What does not (the agent type
 * record, the grant, the readings) is decided here from the snapshot, and its
 * drift before the write is D-0047 rule 6's bounded race.
 *
 * **The request is the act's own** (D-0061 rule 4): the link the iteration row
 * is written with, which an in-scope retry inherits from its predecessor's row.
 * The open asks are read from the thread that request opens, and a refusal
 * writes rule 4.4's stop into it, which is what keeps the line stopped.
 */

import { type AgentTypeInput, agentTypeRecord } from "../cadenza/facade.js";
import { allocate } from "../refrain/allocator.js";
import { classifyPlan } from "../refrain/classification.js";
import type { ConductorReport } from "../refrain/interpreter.js";
import { admittedPlan, type RunPlan, readPlan } from "../refrain/plan.js";
import type { ScopeSpend } from "../refrain/ports.js";
import { planDigest } from "../store/plan.js";
import {
  type AgentTypeRecordDraft,
  askStandsOver,
  IRREVERSIBLE_ACTS,
  isModelReadingDrafter,
  type JsonRecord,
  type JsonValue,
  type LapReading,
  latestReading,
  type OpenAsk,
  type ScopePayload,
  type ScopeRefusal,
  type ScopeSpent,
  type ScopeTest,
  type StoredScope,
  type StoredScopeDecision,
} from "../store/records.js";
import type { AdvisoryRecord, IterationStore } from "../store/sqlite.js";
import { DETERMINISTIC_DRAFTER } from "./advisory.js";
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
      /** The message that opened the request the plan answers, or null (D-0061 rule 4). */
      readonly requestMessageId: string | null;
    }
  | {
      readonly kind: "redo";
      readonly iterationId: string;
      readonly plan: RunPlan;
      readonly predecessorId: string;
      /** The predecessor row's own `requestMessageId`, inherited (D-0061 rule 4). */
      readonly requestMessageId: string | null;
    };

export type ScopeVerdict =
  | { readonly kind: "inside" }
  | { readonly kind: "outside"; readonly test: ScopeTest; readonly reason: string }
  | { readonly kind: "undecidable"; readonly test: ScopeTest; readonly reason: string };

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
  /** The act's request link (the plan's or the predecessor row's), or null when it names none. */
  readonly requestMessageId: string | null;
  /** Open `asks` in the request's thread; empty when the act names no request. */
  readonly openAsks: Read<{ readonly asks: readonly OpenAsk[] }>;
  /** Every lap in the act's lineage, sharing the predecessor's root: empty for a lineage start (rule 4.4). */
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
 * approved; the tests `reserve()` re-tests in the order it re-tests them; the
 * redo's tests last. **The asks test comes right after the request**, ahead of
 * the scope's fields and budgets: rule 4.4's stop is what keeps a line stopped,
 * so while one stands it is the answer, and a budget refusal named ahead of it
 * would write another stop on every attempt.
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
    return outside(
      "request",
      "the act names no request, so it cannot be one the scope lists (D-0066 rule 1.2.1)",
    );
  }
  if (!payload.requests.includes(snapshot.requestMessageId)) {
    return outside(
      "request",
      `the request '${snapshot.requestMessageId}' is not in the scope's requests (D-0066 rule 1.2.1)`,
    );
  }
  // 4. Open asks over the act's line (rule 4.2, D-0061 rule 2.7), right after the
  // request they are read from: while a stop stands, it is the answer (rule 4.4).
  const openAsks = snapshot.openAsks;
  if (openAsks.kind === "unreadable") {
    return undecidable(
      "asks",
      `whether a question stands over this line cannot be read: ${openAsks.reason}`,
    );
  }
  const lineage = snapshot.lineageIterationIds;
  if (lineage.kind === "unreadable") {
    return undecidable("asks", `the act's lineage cannot be walked: ${lineage.reason}`);
  }
  // A lineage start continues no line, whatever the snapshot's walk holds.
  const line = act.kind === "lineage_start" ? [] : lineage.ids;
  const unproposed = unproposedStart(act);
  const standing = openAsks.asks.find((ask) => askStandsOver(ask, line, unproposed));
  if (standing !== undefined) {
    return outside(
      "asks",
      unproposed
        ? `the unanswered question '${standing.messageId}' in the request's thread holds back ` +
            "every first admission that names no proposal, since nothing says which line such " +
            "a plan continues (D-0069 rule 5)"
        : standing.iterationIds.length === 0
          ? `the unanswered question '${standing.messageId}' about the request holds back its plans ` +
            "not yet admitted (D-0066 rule 4.4)"
          : `the unanswered question '${standing.messageId}' stands over this line (D-0066 rule 4.4)`,
    );
  }
  // 5. The workspace pair, byte for byte (rule 1.2.2).
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
  // 6. The agent type (rule 1.2.3).
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
  // 7. No grant beyond the agent type's (D-0064 rule 3.2).
  if (classification.outcome !== "allowed") {
    return outside(
      "contract",
      `cadenza answered '${classification.outcome}' for the composed contract, and only 'allowed' ` +
        "needs no grant beyond the agent type's (D-0064 rule 3.2)",
    );
  }
  // 8. Irreversible, always outside (D-0064 rule 3.4, D-0066 rule 1.2.7). An
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
  // 9. The budgets an admission spends, with the store's own arithmetic (rule 3.4).
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

/**
 * D-0069 rule 5's act: a first admission that names no proposal (an operator's
 * plan under `start`), which every open ask in its request's thread holds back.
 */
function unproposedStart(act: ScopeAct): boolean {
  return act.kind === "lineage_start" && act.proposalId === null;
}

/** The store half the gatherer reads, and nothing it could write with. */
export interface ScopeReadPorts {
  readonly store: Pick<IterationStore, "read" | "readingsFor">;
  readonly record: Pick<
    AdvisoryRecord,
    | "readScope"
    | "readScopeDecision"
    | "scopeSpent"
    | "scopeSupersededByApproved"
    | "openAsksIn"
    | "lineageOf"
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
 * The request is the act's own link; the open asks are read from the thread it
 * opens, and an act naming no request reads none (the verdict refuses it at the
 * request test first).
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

  const lineage = act.kind === "redo" ? await lineageTree(ports, act.predecessorId) : null;
  return {
    kind: "gathered",
    snapshot: Object.freeze({
      scope: scope.scope,
      decision: decision.decision,
      supersededByApproved: await ports.record.scopeSupersededByApproved(scopeId),
      spent: await ports.record.scopeSpent(scopeDecisionId),
      nowMs,
      requestMessageId: act.requestMessageId,
      openAsks:
        act.requestMessageId === null
          ? { kind: "read" as const, asks: [] }
          : await ports.record.openAsksIn(act.requestMessageId),
      lineageIterationIds:
        lineage === null
          ? { kind: "read" as const, ids: [] }
          : lineage.kind === "read"
            ? { kind: "read" as const, ids: lineage.links.map((link) => link.id) }
            : lineage,
      classification: classifyAs(act.plan, act.iterationId),
      predecessor:
        act.kind === "redo" && lineage !== null
          ? {
              grants: await predecessorGrants(ports, act.predecessorId),
              readings:
                lineage.kind === "read"
                  ? {
                      kind: "read" as const,
                      latestModelReading: latestReading(
                        lineage.links.find((link) => link.id === act.predecessorId)?.readings ?? [],
                        isModelReadingDrafter,
                      ),
                      // The whole lineage, a branch's sibling laps included (D-0065 4.1).
                      roundsTaken: reviewRoundsAlong(lineage.links),
                    }
                  : lineage,
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

/**
 * Every lap sharing the predecessor's root, with its readings (D-0030: a line is
 * a split's plan with every redo that continues it, a branch included). The
 * chain is walked first, so a broken or cyclic one is unreadable here too.
 */
async function lineageTree(ports: ScopeReadPorts, predecessorId: string): Promise<Lineage> {
  const chain = await walkLineage(ports, predecessorId);
  if (chain.kind !== "read") {
    return chain;
  }
  const ids = await ports.record.lineageOf(predecessorId);
  if (ids === null) {
    return { kind: "unreadable", reason: `the lineage of '${predecessorId}' does not end` };
  }
  const links: { id: string; readings: readonly LapReading[] }[] = [];
  for (const id of ids) {
    links.push({ id, readings: await ports.store.readingsFor(id) });
  }
  return { kind: "read", links };
}

export type ScopedAdmission =
  | { readonly kind: "admitted"; readonly report: ConductorReport }
  | ({
      readonly kind: "refused";
      /** Rule 4.4's stop: what keeps the line stopped, or why nothing does. */
      readonly stop: ScopeStop;
    } & ScopeRefusal);

/**
 * What rule 4.4's stopping message came to.
 *
 * - `written`: one drafter message with `asks` set, in the request's thread.
 * - `held`: an unanswered question already stands over the line, whatever test
 *   refused, so none is written; `messageId` is that question.
 * - `noThread`: the act names no request, so there is no thread to write into.
 *   **The one refusal that leaves no durable stop.**
 * - `failed`: the write itself failed, or the thread would not read to say
 *   whether a stop already holds the line, so none was written; the surface
 *   says so loudly.
 */
export type ScopeStop =
  | { readonly kind: "written"; readonly messageId: string }
  | { readonly kind: "held"; readonly messageId: string }
  | { readonly kind: "noThread" }
  | { readonly kind: "failed"; readonly messageId: string; readonly reason: string };

/** What the one call site needs: the reads, a clock, the stop's writer, and `admit` bound to its ports. */
export interface ScopeAdmitPorts extends ScopeReadPorts {
  readonly record: ScopeReadPorts["record"] & Pick<AdvisoryRecord, "recordThreadMessage">;
  readonly nowMs: () => number;
  /** `conductor.admit(ports, advisory, plan, policy, id, supersedes, null, request, scopeSpend)`. */
  readonly admit: (
    plan: RunPlan,
    iterationId: string,
    supersedesIterationId: string | null,
    requestMessageId: string | null,
    scopeSpend: ScopeSpend,
  ) => Promise<ConductorReport>;
}

/**
 * **The one place a verdict is computed and acted on** (D-0066 rule 4.1):
 * gather, verdict, and anything but `inside` takes no act. On `inside` the
 * admission carries the scope spend, and `reserve()` re-tests and writes the
 * consumption in the row's own transaction.
 *
 * **Every refusal ends in rule 4.4's stop**, the surface's verdict and the
 * store's re-test alike: the store's arrives as `report.scopeRefusal`, data
 * rather than prose, so both reach {@link stopTheLine} with the test that
 * refused.
 */
export async function admitUnderScope(
  ports: ScopeAdmitPorts,
  scopeDecisionId: string,
  act: ScopeAct,
): Promise<ScopedAdmission> {
  const nowMs = ports.nowMs();
  const gathered = await gatherScopeSnapshot(ports, scopeDecisionId, act, nowMs);
  if (gathered.kind !== "gathered") {
    const refusal: ScopeRefusal = {
      verdict: "undecidable",
      test: gathered.test,
      reason: gathered.reason,
    };
    return refused(refusal, await stopTheLine(ports, scopeDecisionId, act, refusal, null, nowMs));
  }
  const snapshot = gathered.snapshot;
  const verdict = scopeVerdict(act, snapshot);
  if (verdict.kind !== "inside") {
    const refusal: ScopeRefusal = {
      verdict: verdict.kind,
      test: verdict.test,
      reason: verdict.reason,
    };
    return refused(
      refusal,
      await stopTheLine(ports, scopeDecisionId, act, refusal, snapshot, nowMs),
    );
  }
  // `inside` has passed the classification test, so it is read.
  if (snapshot.classification.kind !== "read") {
    throw new Error("an inside verdict over an unread classification is a defect");
  }
  const report = await ports.admit(
    act.plan,
    act.iterationId,
    act.kind === "redo" ? act.predecessorId : null,
    // The row's request link, which the store tests against `requests`.
    act.requestMessageId,
    {
      scopeDecisionId,
      // Rule 3.3: an in-scope retry names no proposal.
      proposalId: act.kind === "lineage_start" ? act.proposalId : null,
      // Drift between this classification and the store's write is D-0047
      // rule 6's bounded race, which D-0066 rule 4.3 accepts.
      agentTypeDigest: snapshot.classification.agentTypeDigest,
    },
  );
  if (report.scopeRefusal !== undefined) {
    return refused(
      report.scopeRefusal,
      await stopTheLine(ports, scopeDecisionId, act, report.scopeRefusal, snapshot, nowMs),
    );
  }
  return { kind: "admitted", report };
}

function refused(refusal: ScopeRefusal, stop: ScopeStop): ScopedAdmission {
  return {
    kind: "refused",
    verdict: refusal.verdict,
    test: refusal.test,
    reason: refusal.reason,
    stop,
  };
}

/**
 * Rule 4.4: write the one drafter message with `asks` set that keeps this line
 * stopped, into the request's thread -- unless an open ask already stands over
 * the line, when a second would say the same thing twice. **That is read here
 * for every refusal**, not only the `asks` test's: the decision, superseded and
 * request tests (and a failed gather) run before `asks` and refuse the same way
 * on every attempt. **A failed read of the asks writes nothing**: whether a
 * stop already holds the line is unknown, and writing on every attempt would
 * pile up stops no reader can find while the read fails; it is `failed`, loudly.
 *
 * **Bases:** the request root as a `message` basis and, for a redo, the
 * lineage's latest lap (the predecessor) as an `iteration` basis; a lineage
 * start names none, so its stop holds back the request's unstarted plans.
 *
 * ponytail: rule 4.4 also names the scope row and the refused test as bases,
 * and no form in D-0032 rule 2 or D-0061 rule 2.6 locates a scope row; rather
 * than add one, the body names the scope id, its digest and the test. A
 * `scope` basis form is the upgrade if a reader ever needs to follow it.
 */
async function stopTheLine(
  ports: ScopeAdmitPorts,
  scopeDecisionId: string,
  act: ScopeAct,
  refusal: ScopeRefusal,
  snapshot: ScopeSnapshot | null,
  nowMs: number,
): Promise<ScopeStop> {
  const request = act.requestMessageId;
  if (request === null) {
    return { kind: "noThread" };
  }
  const messageId = `scope-stop-${act.iterationId}-${String(nowMs)}`;
  const holder = await holdingAsk(ports, act, request);
  if (holder.kind === "unreadable") {
    return {
      kind: "failed",
      messageId,
      reason:
        "the request's thread will not read, so whether a stop already holds this line is " +
        `unknown and none was written: ${holder.reason}`,
    };
  }
  if (holder.messageId !== null) {
    return { kind: "held", messageId: holder.messageId };
  }
  const outcome = await ports.record.recordThreadMessage({
    messageId,
    body: stopBody(scopeDecisionId, act, refusal, snapshot?.scope ?? null),
    authorKind: "drafter",
    authorId: DETERMINISTIC_DRAFTER,
    inReplyTo: request,
    atMs: nowMs,
    bases: [
      { form: "message", messageId: request },
      ...(act.kind === "redo" ? [{ form: "iteration", iterationId: act.predecessorId }] : []),
    ],
    asks: true,
  });
  return outcome.kind === "recorded"
    ? { kind: "written", messageId }
    : { kind: "failed", messageId, reason: outcome.reason };
}

/**
 * The open ask standing over the act's line, read again with the lineage: null
 * when none does, `unreadable` when the asks will not read. The lineage is read
 * afresh, since the store's refusal may come from a lap written after the
 * snapshot; a redo whose lineage will not read is tested on its predecessor
 * alone, the one lap the stop it would write names, so an earlier stop over it
 * is found.
 */
async function holdingAsk(
  ports: ScopeAdmitPorts,
  act: ScopeAct,
  request: string,
): Promise<Read<{ readonly messageId: string | null }>> {
  const asks = await ports.record.openAsksIn(request);
  if (asks.kind !== "read") {
    return asks;
  }
  const line =
    act.kind === "lineage_start"
      ? []
      : ((await ports.record.lineageOf(act.predecessorId)) ?? [act.predecessorId]);
  return {
    kind: "read",
    messageId:
      asks.asks.find((ask) => askStandsOver(ask, line, unproposedStart(act)))?.messageId ?? null,
  };
}

/**
 * The option rule 4.4 recommends for the test that refused (D-0064 rule 4.1:
 * one recommendation). A spent or retired approval, or a spent round budget, wants
 * a successor scope; a model reading that cannot be taken wants the work changed; an
 * act the scope never covered wants the work changed, or a successor that lists
 * it; a read that failed wants stopping until it is fixed.
 */
function recommendation(refusal: ScopeRefusal): string {
  if (refusal.verdict === "undecidable") {
    return (
      "stop this line until the read that failed is fixed: nothing can be tested against a " +
      "row that cannot be read, and a successor scope or a change would be tested the same way"
    );
  }
  switch (refusal.test) {
    case "decision":
    case "superseded":
    case "expiry":
    case "laps":
    case "cost":
      return (
        "a successor scope (D-0066 rule 1.4) with the budget or approval this line needs: the " +
        "work itself is what the scope was approved for, and what ran out is the approval"
      );
    case "readings":
      // Only a spent round budget (D-0065 4.3) is an approval that ran out. An
      // unavailable or ungraded reading refuses a successor at the same test.
      return refusal.reason.endsWith("(D-0065 4.3)")
        ? "a successor scope (D-0066 rule 1.4) with the review rounds this line needs: the " +
            "findings are open because the rounds the scope approved are spent"
        : "change the work so a model reading can be taken (a plan with a review criterion): " +
            "a successor scope would be refused at this test for the same reason";
    default:
      return (
        "change the work so the scope covers it, or approve a successor scope that lists it: " +
        "the scope as approved does not name this act"
      );
  }
}

/**
 * The stop's words: deterministic, one recommendation (rule 4.4, D-0064 rule 4.1).
 * Stored as written, newlines included: ASCII escaping governs what rondo prints,
 * not what it stores (D-0004).
 */
function stopBody(
  scopeDecisionId: string,
  act: ScopeAct,
  refusal: ScopeRefusal,
  scope: StoredScope | null,
): string {
  const scopeName =
    scope === null
      ? `scope decision '${scopeDecisionId}' (its scope row could not be read)`
      : `scope '${scope.scopeId}' (digest ${scope.scopeDigest}) under decision '${scopeDecisionId}'`;
  return [
    `Stopped: the ${act.kind === "redo" ? `redo of '${act.predecessorId}'` : "first admission of a plan"} ` +
      `as '${act.iterationId}' is ${refusal.verdict} ${scopeName} at the ${refusal.test} test.`,
    `Reason: ${refusal.reason}`,
    "Options:",
    "- A successor scope (D-0066 rule 1.4). Gives up: this line waits for a person to approve " +
      "a new scope, and the old one is retired when they do.",
    "- A change to the work. Gives up: the work as planned; what runs is the changed work.",
    "- Stopping. Gives up: this line's work; other lines of the request carry on.",
    `Recommended: ${recommendation(refusal)}.`,
    "This line stays stopped until this message is answered.",
  ].join("\n");
}

/**
 * The agent type an operator's plan records for a scope (D-0069 section 1):
 * cadenza's digest over the plan's `agentTypeInput`, the input copied as the
 * plan holds it, and the digest of the plan document it came from. A refusal
 * is cadenza's own words when the input builds no record.
 */
export function agentTypeRecordOf(
  plan: RunPlan,
  document: JsonRecord,
): { readonly record: AgentTypeRecordDraft } | { readonly refusal: string } {
  try {
    return {
      record: {
        agentTypeDigest: agentTypeRecord(plan.agentTypeInput).agentTypeDigest,
        agentTypeInput: plan.agentTypeInput as unknown as JsonValue,
        planDigest: planDigest(document),
      },
    };
  } catch (error) {
    return { refusal: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * What a listed agent type bounds, **read back from the record rondo holds**
 * (D-0069 section 1): its tier and granted keys, so the person approving the
 * list sees more than a hash. One line per digest; a record that will not
 * rebuild, or rebuilds to another digest, says so in place of the tier.
 */
export async function heldAgentTypeLines(
  record: Pick<AdvisoryRecord, "heldAgentType">,
  digests: readonly string[],
): Promise<readonly string[]> {
  const lines: string[] = [];
  for (const digest of digests) {
    const held = await record.heldAgentType(digest);
    if (held.kind !== "read") {
      lines.push(
        `agent type ${digest}: ${held.kind === "absent" ? "no record is held" : `the record will not read: ${held.reason}`}`,
      );
      continue;
    }
    const from =
      held.source === "iteration" ? "an iteration's plan" : "a plan recorded for a scope";
    try {
      const built = agentTypeRecord(held.agentTypeInput as unknown as AgentTypeInput);
      lines.push(
        built.agentTypeDigest === digest
          ? `agent type ${digest}: tier ${built.executorPolicy.modelTier}, granted ` +
              `${built.granted.length === 0 ? "none" : built.granted.join(", ")} (held from ${from})`
          : `agent type ${digest}: the record held from ${from} rebuilds to ` +
              `${built.agentTypeDigest}, so what it bounds cannot be shown`,
      );
    } catch (error) {
      lines.push(
        `agent type ${digest}: the record held from ${from} does not build: ` +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }
  return lines;
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
