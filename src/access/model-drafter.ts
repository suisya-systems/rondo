/**
 * One run of the model drafter over one request (D-0071): gather what rondo
 * hands over, run the drafter, and check what it answered.
 *
 * **Three halves, each where it already lives**, as `./model-reviewer.ts` puts
 * the reviewer's: the `claude` process is `./forge.ts`'s, what the document
 * holds and what the answer may say are `./model-draft.ts`'s pure functions,
 * and the store reads are here. This file puts them in order.
 *
 * **It writes nothing.** Which run is due, the staleness check and the one
 * transaction a finished run writes (D-0071 rules 3 and 7.2-7.3) belong to the
 * caller that decides when a run happens; this returns the material, the
 * document and the outcome for that caller to write.
 */

import type { BudgetRow } from "../advisory/budget.js";
import { type AgentTypeInput, agentTypeRecord } from "../cadenza/facade.js";
import { drafterRow } from "../continuo/roles.js";
import { PRICED_MODEL_TIERS } from "../refrain/classification.js";
import { readPlan, readRunPlan } from "../refrain/plan.js";
import { planDigest } from "../store/plan.js";
import type { IterationRecord, JsonRecord, JsonValue } from "../store/records.js";
import type { AdvisoryRecord, IterationStore } from "../store/sqlite.js";
import type { runDrafter } from "./forge.js";
import {
  type DraftAgentType,
  type DrafterMaterial,
  type DrafterRun,
  type DraftOutcome,
  type DraftTemplate,
  draftOf,
  modelDrafterName,
  prepareDraft,
} from "./model-draft.js";
import { agentTypeRecordOf } from "./scope.js";

/** The iteration rows a template is drawn from (D-0071 rule 2.1.3). */
const TEMPLATE_ROWS = 20;

/** What a drafter run reaches, as values a test can replace. */
export interface DrafterPorts {
  readonly store: Pick<IterationStore, "readLive" | "terminalIterations" | "readingsFor">;
  readonly record: Pick<
    AdvisoryRecord,
    "threadMessages" | "heldAgentType" | "heldAgentTypeDigests"
  >;
  readonly runDrafter: typeof runDrafter;
  readonly now: () => number;
}

/** One finished run: what it was handed and what came of it. */
export interface DrafterRunResult {
  /** `rondo/drafter/1/<model-id>`, the name its rows are written under (rule 1.4). */
  readonly drafter: string;
  /** Null only when the material could not be gathered at all. */
  readonly material: DrafterMaterial | null;
  /** The bytes handed to the model, or null when nothing was handed. */
  readonly document: string | null;
  /** What the CLI said the run cost, or null (D-0071's residual on a draft's cost). */
  readonly costUsd: number | null;
  readonly outcome: DraftOutcome;
}

/**
 * Draft one request once. **Never throws**: a failure anywhere is an
 * `unavailable` outcome naming why (rule 1.5), because the caller writes a row
 * for every run, and a throw would be a run that left none.
 */
export async function draftRequest(
  ports: DrafterPorts,
  requestMessageId: string,
  language: string | null,
): Promise<DrafterRunResult> {
  const row = drafterRow();
  const drafter = modelDrafterName(row);
  let material: DrafterMaterial;
  try {
    material = await gatherDrafterMaterial(ports, requestMessageId, language);
  } catch (error) {
    return {
      drafter,
      material: null,
      document: null,
      costUsd: null,
      outcome: {
        kind: "unavailable",
        reason: `the drafter's material could not be gathered: ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }
  const prepared = prepareDraft(material);
  if (prepared.kind === "refused") {
    return {
      drafter,
      material,
      document: null,
      costUsd: null,
      outcome: { kind: "unavailable", reason: prepared.reason },
    };
  }
  let run: DrafterRun;
  try {
    run = await ports.runDrafter(row, prepared.document);
  } catch (error) {
    run = {
      kind: "failed",
      reason: `the drafter could not be run: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  return {
    drafter,
    material,
    document: prepared.document,
    costUsd: run.kind === "answered" ? run.costUsd : null,
    outcome: outcomeOf(material, run),
  };
}

/** {@link draftOf}, with a defect in rondo's own check an unavailable run and not a throw. */
function outcomeOf(material: DrafterMaterial, run: DrafterRun): DraftOutcome {
  try {
    return draftOf(material, run);
  } catch (error) {
    return {
      kind: "unavailable",
      reason: `the draft could not be checked: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function budgetRow(record: IterationRecord): BudgetRow {
  return {
    id: record.id,
    agentTypeDigest: record.agentTypeDigest,
    modelTier: record.modelTier,
    supersedesIterationId: record.supersedesIterationId,
    lapCostUsd: record.lapCostUsd,
    lapDurationMs: record.lapDurationMs,
    createdAtMs: record.createdAtMs,
  };
}

/** A held record's tier and grants, or null when it does not rebuild to its digest. */
function builtFacts(
  digest: string,
  input: unknown,
): { readonly modelTier: string; readonly granted: readonly string[] } | null {
  try {
    const built = agentTypeRecord(input as AgentTypeInput);
    return built.agentTypeDigest === digest
      ? { modelTier: built.executorPolicy.modelTier, granted: built.granted }
      : null;
  } catch {
    return null;
  }
}

const priced = (tier: string | null): boolean =>
  tier !== null && (PRICED_MODEL_TIERS as readonly string[]).includes(tier);

/**
 * Everything D-0071 rule 2.1 hands the drafter, each part read from its own
 * source. Throws only when a source will not read at all; the caller turns
 * that into an unavailable run.
 */
export async function gatherDrafterMaterial(
  ports: Pick<DrafterPorts, "store" | "record" | "now">,
  requestMessageId: string,
  language: string | null,
): Promise<DrafterMaterial> {
  const draftedAtMs = ports.now();
  const read = await ports.record.threadMessages();
  if (read.kind !== "read") {
    throw new Error(`the thread will not read: ${read.reason}`);
  }
  // The request and every reply under it, in the store's order.
  const inThread = new Set([requestMessageId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const m of read.messages) {
      if (!inThread.has(m.messageId) && m.inReplyTo !== null && inThread.has(m.inReplyTo)) {
        inThread.add(m.messageId);
        grew = true;
      }
    }
  }
  const thread = read.messages
    .filter((m) => inThread.has(m.messageId))
    .map((m) => ({
      messageId: m.messageId,
      authorKind: m.authorKind,
      inReplyTo: m.inReplyTo,
      asks: m.asks,
      body: m.body,
    }));

  const records = [
    ...(await ports.store.readLive()),
    ...(await ports.store.terminalIterations()),
  ].flatMap((outcome) => (outcome.kind === "read" ? [outcome.record] : []));

  // Templates: the distinct plans on the 20 most recent rows (rule 2.1.3).
  const recent = [...records]
    .sort((a, b) => b.createdAtMs - a.createdAtMs || (a.id < b.id ? 1 : -1))
    .slice(0, TEMPLATE_ROWS);
  const templates = new Map<string, DraftTemplate>();
  for (const record of recent) {
    const known = templates.get(record.planDigest);
    if (known !== undefined && known.from.kind === "iterations") {
      templates.set(record.planDigest, {
        ...known,
        from: { kind: "iterations", iterationIds: [...known.from.iterationIds, record.id] },
      });
      continue;
    }
    const planned = readPlan(record.plan);
    if (planned.kind !== "planned") {
      continue;
    }
    templates.set(record.planDigest, {
      planDigest: record.planDigest,
      plan: record.plan,
      repository: planned.plan.repository,
      workspaceRoot: planned.plan.workspaceRoot,
      agentTypeDigest: record.agentTypeDigest,
      from: { kind: "iterations", iterationIds: [record.id] },
    });
  }

  // Held agent types: every digest a row names or a record holds (rule 2.1.2).
  const agentTypes = new Map<string, DraftAgentType>();
  const heldDigests = [
    ...new Set([
      ...records.flatMap((r) => (r.agentTypeDigest === null ? [] : [r.agentTypeDigest])),
      ...(await ports.record.heldAgentTypeDigests()),
    ]),
  ];
  for (const digest of heldDigests) {
    const held = await ports.record.heldAgentType(digest);
    const facts = held.kind === "read" ? builtFacts(digest, held.agentTypeInput) : null;
    // A record that will not rebuild to its digest is not offered: the drafter
    // would be choosing a hash nobody can say the bounds of.
    if (facts !== null) {
      agentTypes.set(digest, {
        digest,
        ...facts,
        priced: priced(facts.modelTier),
        source: { kind: "held" },
      });
    }
  }

  // A plan pasted into an operator message is a template, and its agent type
  // is recordable when rondo does not hold it (the gate's answer to point 1).
  for (const message of thread) {
    if (message.authorKind !== "operator") {
      continue;
    }
    let document: unknown;
    try {
      document = JSON.parse(message.body);
    } catch {
      continue;
    }
    if (typeof document !== "object" || document === null || Array.isArray(document)) {
      continue;
    }
    const planned = readRunPlan(document as JsonRecord);
    if (planned.kind !== "planned") {
      continue;
    }
    const recorded = agentTypeRecordOf(planned.plan, document as JsonRecord);
    if ("refusal" in recorded) {
      continue;
    }
    const digest = planDigest(document as JsonRecord);
    if (!templates.has(digest)) {
      templates.set(digest, {
        planDigest: digest,
        plan: document as JsonRecord,
        repository: planned.plan.repository,
        workspaceRoot: planned.plan.workspaceRoot,
        agentTypeDigest: recorded.record.agentTypeDigest,
        from: { kind: "message", messageId: message.messageId },
      });
    }
    const typeDigest = recorded.record.agentTypeDigest;
    const facts = builtFacts(typeDigest, recorded.record.agentTypeInput);
    if (!agentTypes.has(typeDigest) && facts !== null) {
      agentTypes.set(typeDigest, {
        digest: typeDigest,
        ...facts,
        priced: priced(facts.modelTier),
        source: {
          kind: "recordable",
          messageId: message.messageId,
          agentTypeInput: recorded.record.agentTypeInput,
          planDigest: digest,
        },
      });
    }
  }

  const laps = [];
  for (const record of records
    .filter((r) => r.requestMessageId === requestMessageId)
    .sort((a, b) => a.createdAtMs - b.createdAtMs || (a.id < b.id ? -1 : 1))) {
    laps.push({
      iterationId: record.id,
      status: record.status,
      supersedesIterationId: record.supersedesIterationId,
      gateOutcome: record.gateOutcome,
      prompt: ((planned) => (planned.kind === "planned" ? planned.plan.prompt : null))(
        readPlan(record.plan),
      ),
      readings: (await ports.store.readingsFor(record.id)).map((reading) => ({
        drafter: reading.drafter,
        verdict: reading.verdict,
        findings: reading.findings,
      })),
    });
  }

  return {
    requestMessageId,
    thread,
    templates: [...templates.values()],
    agentTypes: [...agentTypes.values()],
    policies: [],
    laps,
    rows: records.map(budgetRow),
    draftedAtMs,
    language,
  };
}

/**
 * A plan rondo holds, as a person picks it on the scope screen when there is
 * no draft to approve (rondo#238's answer: the operator path of D-0069 section
 * 1, on the page). The same plans the drafter is handed (D-0071 rule 2.1.3),
 * one per place and agent type.
 */
export interface HeldPlan {
  readonly planDigest: string;
  readonly document: JsonRecord;
  readonly repository: string;
  readonly workspaceRoot: string;
  readonly agentTypeDigest: string;
  readonly agentTypeInput: JsonValue;
  readonly from: DraftTemplate["from"];
}

/**
 * The plans rondo holds for one request: pasted into its thread, newest first,
 * then those recent laps ran, newest first -- **one per (repository, workspace
 * root, agent type)**, because every lap's plan carries its own run and prompt
 * and a list of twenty near-identical laps is not a choice a person can make.
 * The newest of each kind stands for it. A plan whose agent type builds no
 * record is not offered.
 */
export async function heldPlans(
  ports: Pick<DrafterPorts, "store" | "record" | "now">,
  requestMessageId: string,
  /**
   * Every plan and not one per kind: what a press looks the plan it was drawn
   * over up in, so a newer lap of the same kind in the meantime does not make
   * the drawn one vanish. The screen offers one per kind.
   */
  options: { readonly every?: boolean } = {},
): Promise<readonly HeldPlan[]> {
  const material = await gatherDrafterMaterial(ports, requestMessageId, null);
  const pasted = material.templates.filter((t) => t.from.kind === "message").reverse();
  const ran = material.templates.filter((t) => t.from.kind === "iterations");
  const plans = new Map<string, HeldPlan>();
  for (const template of [...pasted, ...ran]) {
    const planned = readRunPlan(template.plan);
    // **A revise lap's plan is not a template for new work**: its base is the
    // lap it revised's topic branch (`revisionPlan`), so a lap started from it
    // would be cut from another request's unmerged work. A first lap's plan
    // bases on the repository's own branch.
    if (planned.kind !== "planned" || planned.plan.pullRequestBaseBranch !== null) {
      continue;
    }
    const recorded = agentTypeRecordOf(planned.plan, template.plan);
    if ("refusal" in recorded) {
      continue;
    }
    const kind = options.every
      ? template.planDigest
      : JSON.stringify([
          template.repository,
          template.workspaceRoot,
          recorded.record.agentTypeDigest,
        ]);
    if (!plans.has(kind)) {
      plans.set(kind, {
        planDigest: template.planDigest,
        document: template.plan,
        repository: template.repository,
        workspaceRoot: template.workspaceRoot,
        agentTypeDigest: recorded.record.agentTypeDigest,
        agentTypeInput: recorded.record.agentTypeInput,
        from: template.from,
      });
    }
  }
  return [...plans.values()];
}
