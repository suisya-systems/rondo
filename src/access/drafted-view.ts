/**
 * What the scope screen shows for a request the model drafter drafted
 * (rondo#238 C2b, D-0071 section 5.3): the drafted scope still waiting on the
 * person, or the approval that already decided it, and the drafted plans under
 * an approved scope.
 *
 * **Reads only, and never a second author.** Every value is read back from the
 * rows the drafter's run wrote -- the scope, its split proposal, the snapshot
 * that proposal holds -- and the budgets the screen explains are recomputed by
 * rule 4.2 over that same snapshot, which is what makes them re-derivable
 * (rule 7.1) rather than re-read.
 */

import {
  computeScopeBudgets,
  DEFAULT_REVIEW_ROUNDS,
  type ScopeBudgets,
} from "../advisory/budget.js";
import { readSplitPayload, type SplitPlan } from "../advisory/proposal.js";
import type { StoredScope } from "../store/records.js";
import type { AdvisoryRecord } from "../store/sqlite.js";
import { planRuleFiles } from "./done.js";
import { type DrafterMaterial, isModelDrafterName } from "./model-draft/judgement.js";

/** One drafted plan as the screen shows it: its words, where it runs, and its agent type. */
export interface DraftedPlanShown {
  readonly index: number;
  readonly split: SplitPlan;
  /** The template's place, or null when the snapshot no longer holds the template. */
  readonly repository: string | null;
  readonly workspaceRoot: string | null;
  /**
   * The rule files the template names (rondo#377), which a start of this plan
   * points its worker at, or null when the snapshot no longer holds the template.
   */
  readonly ruleFiles: readonly string[] | null;
}

/** A drafter's scope and the split it was drafted with. */
export interface DraftedScopeShown {
  readonly scope: StoredScope;
  readonly proposalId: string;
  readonly plans: readonly DraftedPlanShown[];
  /** Rule 4.2 over the proposal's snapshot: what the drafted values were computed as. */
  readonly computed: ScopeBudgets;
  /**
   * Each field the drafter narrowed, and the person's message the winning
   * narrowing rests on (D-0071 rule 4.1), as its run recorded them: what the
   * screen cites beside that field and nowhere else.
   */
  readonly narrowed: readonly { readonly field: string; readonly messageId: string }[];
}

export type DraftedStanding =
  /** No drafter's scope for this request, or the person declined it: the person's own form. */
  | { readonly kind: "none" }
  /** A drafted scope waiting on the person. */
  | { readonly kind: "drafted"; readonly drafted: DraftedScopeShown }
  /**
   * A drafted scope, or the person's scope that replaced it, is approved and
   * still in force. `newer` is a draft written after it -- the drafter drafts
   * again on the person's next message (D-0071 rule 3.1) -- shown beside the
   * approval and never in its place.
   */
  | {
      readonly kind: "decided";
      readonly scopeDecisionId: string;
      readonly newer: DraftedScopeShown | null;
    };

/** Changes a scope's chain is followed through before it is given up on. */
const CHAIN_BOUND = 100;

type Ports = {
  readonly record: Pick<
    AdvisoryRecord,
    "scopesFor" | "scopeDecisionOf" | "readProposal" | "scopeSupersededByApproved"
  >;
};

/**
 * Where the drafted scope for `requestMessageId` stands:
 *
 * - **an approval still in force wins** -- of any draft for this request, as
 *   drafted or as the person's scope replacing it -- so a redraft after it
 *   never takes its screen, its starts or its "started" links away;
 * - otherwise the latest draft, waiting on the person, unless the person
 *   declined it, when the form is theirs.
 */
export async function draftedStanding(
  ports: Ports,
  requestMessageId: string,
): Promise<DraftedStanding> {
  const scopes = await ports.record.scopesFor(requestMessageId);
  const drafts = scopes.filter((s) => s.authorKind === "drafter" && isModelDrafterName(s.authorId));
  const latest = drafts[drafts.length - 1];
  if (latest === undefined) {
    return { kind: "none" };
  }
  // Newest first, each draft with the person's scopes that replaced it.
  for (const draft of [...drafts].reverse()) {
    for (const candidate of [draft, ...replacing(scopes, draft.scopeId)]) {
      const decided = await ports.record.scopeDecisionOf(candidate.scopeId);
      if (
        decided.kind === "read" &&
        decided.decision.outcome === "approved" &&
        !(await ports.record.scopeSupersededByApproved(candidate.scopeId))
      ) {
        const newer = draft === latest ? null : await undecided(ports, latest, scopes);
        return { kind: "decided", scopeDecisionId: decided.decision.scopeDecisionId, newer };
      }
    }
  }
  const shown = await undecided(ports, latest, scopes);
  return shown === null ? { kind: "none" } : { kind: "drafted", drafted: shown };
}

/**
 * Every scope that replaces `scopeId`, however many changes deep -- the
 * person's edit of a draft, and a later change of that edit (D-0066 rule 1.4).
 */
function replacing(scopes: readonly StoredScope[], scopeId: string): StoredScope[] {
  const found: StoredScope[] = [];
  const seen = new Set([scopeId]);
  for (let at = [scopeId]; at.length > 0; ) {
    const next = scopes.filter(
      (s) =>
        s.supersedesScopeId !== null && at.includes(s.supersedesScopeId) && !seen.has(s.scopeId),
    );
    for (const s of next) {
      seen.add(s.scopeId);
    }
    found.push(...next);
    at = next.map((s) => s.scopeId);
  }
  return found;
}

/** A draft still waiting on the person: no decision on it or on a scope replacing it. */
async function undecided(
  ports: Ports,
  draft: StoredScope,
  scopes: readonly StoredScope[],
): Promise<DraftedScopeShown | null> {
  for (const candidate of [draft, ...replacing(scopes, draft.scopeId)]) {
    if ((await ports.record.scopeDecisionOf(candidate.scopeId)).kind === "read") {
      return null;
    }
  }
  // **Retired by an approved scope this request's list does not reach** -- one
  // that replaced the draft and no longer names the request -- is still retired:
  // its press would be refused, so its form is not offered (D-0066 rule 1.4).
  if (await ports.record.scopeSupersededByApproved(draft.scopeId)) {
    return null;
  }
  return await draftedShown(ports, draft);
}

/**
 * The drafted plans behind an approved scope: its own split when a drafter
 * wrote it, or the split of the draft it replaced (D-0071 rule 5.3's successor).
 * Null for a scope nothing was drafted for -- the person's own, from a held plan.
 */
export async function draftedPlansUnder(
  ports: Ports & { readonly record: Pick<AdvisoryRecord, "readScope"> },
  scope: StoredScope,
): Promise<DraftedScopeShown | null> {
  // Up the chain of changes to the draft it began from, however many deep.
  let at: StoredScope = scope;
  for (let hops = 0; hops < CHAIN_BOUND; hops += 1) {
    if (at.authorKind === "drafter" && isModelDrafterName(at.authorId)) {
      return await draftedShown(ports, at);
    }
    if (at.supersedesScopeId === null) {
      return null;
    }
    const replaced = await ports.record.readScope(at.supersedesScopeId);
    if (replaced.kind !== "read") {
      return null;
    }
    at = replaced.scope;
  }
  return null;
}

async function draftedShown(ports: Ports, scope: StoredScope): Promise<DraftedScopeShown | null> {
  const cited = scope.bases.find(
    (basis) =>
      typeof basis === "object" &&
      basis !== null &&
      !Array.isArray(basis) &&
      (basis as Record<string, unknown>)["form"] === "proposal",
  ) as { readonly proposalId?: unknown } | undefined;
  if (cited === undefined || typeof cited.proposalId !== "string") {
    return null;
  }
  const read = await ports.record.readProposal(cited.proposalId);
  if (read.kind !== "read") {
    return null;
  }
  const payload = readSplitPayload(read.proposal.payload);
  const material = read.proposal.snapshot["material"] as DrafterMaterial | undefined;
  if (payload.kind !== "split" || material === undefined) {
    return null;
  }
  const plans = payload.payload.plans.map((split, index) => {
    const template = material.templates.find((t) => t.planDigest === split.template_plan_digest);
    return {
      index,
      split,
      repository: template?.repository ?? null,
      workspaceRoot: template?.workspaceRoot ?? null,
      ruleFiles: template === undefined ? null : planRuleFiles(template.plan),
    };
  });
  const rounds = scope.payload.budgets.review_rounds;
  const computed = computeScopeBudgets({
    agentTypes: scope.payload.agent_types.map((digest) => ({
      digest,
      modelTier: material.agentTypes.find((a) => a.digest === digest)?.modelTier ?? null,
    })),
    plans: plans.length,
    // A narrowed round budget is R in every formula (rule 4.2.4); unnarrowed, the default.
    ...(rounds < DEFAULT_REVIEW_ROUNDS ? { reviewRounds: rounds } : {}),
    rows: material.rows,
    draftedAtMs: material.draftedAtMs,
  });
  const recorded = read.proposal.snapshot["narrowed"];
  const narrowed = (Array.isArray(recorded) ? recorded : []).flatMap((one) => {
    const n = one as Record<string, unknown>;
    return typeof n["field"] === "string" && typeof n["message_id"] === "string"
      ? [{ field: n["field"], messageId: n["message_id"] }]
      : [];
  });
  return { scope, proposalId: cited.proposalId, plans, computed, narrowed };
}
