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
import { type DrafterMaterial, isModelDrafterName } from "./model-draft.js";

/** One drafted plan as the screen shows it: its words, where it runs, and its agent type. */
export interface DraftedPlanShown {
  readonly index: number;
  readonly split: SplitPlan;
  /** The template's place, or null when the snapshot no longer holds the template. */
  readonly repository: string | null;
  readonly workspaceRoot: string | null;
}

/** A drafter's scope and the split it was drafted with. */
export interface DraftedScopeShown {
  readonly scope: StoredScope;
  readonly proposalId: string;
  readonly plans: readonly DraftedPlanShown[];
  /** Rule 4.2 over the proposal's snapshot: what the drafted values were computed as. */
  readonly computed: ScopeBudgets;
  /** Messages the scope rests on beyond the request and any pasted plan: the words a narrowing cites. */
  readonly narrowedBy: readonly string[];
}

export type DraftedStanding =
  /** No drafter's scope for this request, or the person declined it: the person's own form. */
  | { readonly kind: "none" }
  /** A drafted scope waiting on the person. */
  | { readonly kind: "drafted"; readonly drafted: DraftedScopeShown }
  /** The drafted scope, or the person's scope that replaced it, is approved. */
  | { readonly kind: "decided"; readonly scopeDecisionId: string };

type Ports = {
  readonly record: Pick<AdvisoryRecord, "scopesFor" | "scopeDecisionOf" | "readProposal">;
};

/**
 * Where the drafted scope for `requestMessageId` stands: the latest one a model
 * drafter wrote, unless the person already approved it -- as drafted, or as
 * their own scope replacing it -- in which case the approval is the answer.
 */
export async function draftedStanding(
  ports: Ports,
  requestMessageId: string,
): Promise<DraftedStanding> {
  const scopes = await ports.record.scopesFor(requestMessageId);
  const draft = [...scopes]
    .reverse()
    .find((s) => s.authorKind === "drafter" && isModelDrafterName(s.authorId));
  if (draft === undefined) {
    return { kind: "none" };
  }
  for (const candidate of [draft, ...scopes.filter((s) => s.supersedesScopeId === draft.scopeId)]) {
    const decided = await ports.record.scopeDecisionOf(candidate.scopeId);
    if (decided.kind === "read" && decided.decision.outcome === "approved") {
      return { kind: "decided", scopeDecisionId: decided.decision.scopeDecisionId };
    }
    if (candidate === draft && decided.kind === "read") {
      // Declined: the person said no to the draft, so the form is theirs.
      return { kind: "none" };
    }
  }
  const shown = await draftedShown(ports, draft);
  return shown === null ? { kind: "none" } : { kind: "drafted", drafted: shown };
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
  if (scope.authorKind === "drafter" && isModelDrafterName(scope.authorId)) {
    return await draftedShown(ports, scope);
  }
  if (scope.supersedesScopeId === null) {
    return null;
  }
  const replaced = await ports.record.readScope(scope.supersedesScopeId);
  return replaced.kind === "read" &&
    replaced.scope.authorKind === "drafter" &&
    isModelDrafterName(replaced.scope.authorId)
    ? await draftedShown(ports, replaced.scope)
    : null;
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
  const pasted = new Set(
    material.agentTypes.flatMap((a) =>
      a.source.kind === "recordable" ? [a.source.messageId] : [],
    ),
  );
  const narrowedBy = scope.bases.flatMap((basis) => {
    const b = basis as Record<string, unknown>;
    return b["form"] === "message" &&
      typeof b["messageId"] === "string" &&
      b["messageId"] !== material.requestMessageId &&
      !pasted.has(b["messageId"])
      ? [b["messageId"]]
      : [];
  });
  return { scope, proposalId: cited.proposalId, plans, computed, narrowedBy };
}
