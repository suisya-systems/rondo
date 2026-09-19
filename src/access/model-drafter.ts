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
import { readSplitPayload, type SplitPlan } from "../advisory/proposal.js";
import { type AgentTypeInput, agentTypeRecord } from "../cadenza/facade.js";
import { drafterRow } from "../continuo/roles.js";
import { PRICED_MODEL_TIERS } from "../refrain/classification.js";
import { planPayload, type RunPlan, readPlan, readRunPlan } from "../refrain/plan.js";
import { canonicalJson, planDigest } from "../store/plan.js";
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
  isModelDrafterName,
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
    "threadMessages" | "heldAgentType" | "heldAgentTypeDigests" | "setupPlans"
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

/** The request and every reply under it. */
function threadOf(
  messages: readonly { readonly messageId: string; readonly inReplyTo: string | null }[],
  requestMessageId: string,
): Set<string> {
  const inThread = new Set([requestMessageId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const m of messages) {
      if (!inThread.has(m.messageId) && m.inReplyTo !== null && inThread.has(m.inReplyTo)) {
        inThread.add(m.messageId);
        grew = true;
      }
    }
  }
  return inThread;
}

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
  const inThread = threadOf(read.messages, requestMessageId);
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

  // Templates: one per choice, newest first (rule 2.1.3 as D-0075 rule 2.3
  // groups it), from the 20 most recent rows, the setup rows and the plans
  // pasted into this thread.
  const templates = new Map<string, DraftTemplate>();
  for (const template of await heldTemplates(ports, records, read.messages, inThread)) {
    // `delete` first, so a later occurrence also takes the later place: on a
    // tie in time, the one the store wrote later is the newer.
    const choice = choiceOf(template.plan);
    const known = templates.get(choice);
    if (known === undefined || template.heldAtMs >= known.heldAtMs) {
      templates.delete(choice);
      templates.set(choice, template);
    }
  }
  const offered = [...templates.values()].reverse().sort((a, b) => b.heldAtMs - a.heldAtMs);

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

  // A plan pasted into an operator message, or recorded by setup, is a
  // template, and its agent type is recordable when rondo does not hold it
  // (the gate's answer to point 1, D-0075 rule 2.4) -- from the newest choice
  // that builds it.
  for (const template of offered) {
    if (template.from.kind === "iterations" || template.agentTypeDigest === null) {
      continue;
    }
    const typeDigest = template.agentTypeDigest;
    const input = template.plan["agent_type_input"] as JsonValue;
    const facts = builtFacts(typeDigest, input);
    if (!agentTypes.has(typeDigest) && facts !== null) {
      agentTypes.set(typeDigest, {
        digest: typeDigest,
        ...facts,
        priced: priced(facts.modelTier),
        source:
          template.from.kind === "message"
            ? {
                kind: "recordable",
                messageId: template.from.messageId,
                agentTypeInput: input,
                planDigest: template.planDigest,
              }
            : {
                kind: "recordable",
                setupId: template.from.setupId,
                agentTypeInput: input,
                planDigest: template.planDigest,
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
    templates: offered,
    agentTypes: [...agentTypes.values()],
    policies: [],
    laps,
    rows: records.map(budgetRow),
    draftedAtMs,
    language,
  };
}

/**
 * What makes two held plans the same choice (D-0075 rule 2.3): **the plan a
 * caller would write**, read through the plan reader so absent fields read as
 * their defaults, with what admission adds or fills put aside -- the version,
 * the allocated run id, lease claimant, workspace, topic branch and grantee --
 * and `prompt`, which every lap sets. A document that does not read is its own
 * choice, by digest.
 */
function choiceOf(plan: JsonRecord): string {
  const read = readRunPlan(plan);
  if (read.kind !== "planned") {
    return planDigest(plan);
  }
  return canonicalJson(
    planPayload({
      ...read.plan,
      prompt: "",
      runId: "",
      leaseClaimantId: "",
      workspace: "",
      topicBranch: "",
      parties: { ...read.plan.parties, grantee: "" },
    }),
  );
}

/**
 * Every plan rondo holds as a template, **ungrouped**: each of `records`' 20
 * most recent rows, every setup row, and every operator message in `thread`
 * whose body is a plan. A revise lap's plan is none (its base is another
 * request's unmerged work), and neither is a pasted or setup plan whose agent
 * type builds no record.
 */
async function heldTemplates(
  ports: Pick<DrafterPorts, "record">,
  records: readonly IterationRecord[],
  messages: readonly { messageId: string; authorKind: string; body: string; atMs: number }[],
  thread: ReadonlySet<string>,
): Promise<DraftTemplate[]> {
  const held: DraftTemplate[] = [];
  const recent = [...records]
    .sort((a, b) => b.createdAtMs - a.createdAtMs || (a.id < b.id ? 1 : -1))
    .slice(0, TEMPLATE_ROWS)
    // Oldest first, as the setup rows and the messages below are: the caller
    // reads a later place as a later write when two share a time.
    .reverse();
  for (const record of recent) {
    const planned = readPlan(record.plan);
    // **A revise lap's plan is no template** (rondo#238 C1's rule, drafter
    // side): its base is the revised lap's topic branch, so work drafted on it
    // would be cut from another request's unmerged commits.
    if (planned.kind !== "planned" || planned.plan.pullRequestBaseBranch !== null) {
      continue;
    }
    held.push({
      planDigest: record.planDigest,
      plan: record.plan,
      repository: planned.plan.repository,
      workspaceRoot: planned.plan.workspaceRoot,
      agentTypeDigest: record.agentTypeDigest,
      from: { kind: "iterations", iterationIds: [record.id] },
      heldAtMs: record.createdAtMs,
    });
  }
  const written = (
    document: JsonRecord,
    from: DraftTemplate["from"],
    heldAtMs: number,
  ): DraftTemplate | null => {
    const planned = readRunPlan(document);
    if (planned.kind !== "planned" || planned.plan.pullRequestBaseBranch !== null) {
      return null;
    }
    const recorded = agentTypeRecordOf(planned.plan, document);
    if ("refusal" in recorded) {
      return null;
    }
    return {
      planDigest: planDigest(document),
      plan: document,
      repository: planned.plan.repository,
      workspaceRoot: planned.plan.workspaceRoot,
      agentTypeDigest: recorded.record.agentTypeDigest,
      from,
      heldAtMs,
    };
  };
  for (const setup of await ports.record.setupPlans()) {
    const template = written(
      setup.plan,
      { kind: "setup", setupId: setup.setupId },
      setup.recordedAtMs,
    );
    if (template !== null) held.push(template);
  }
  for (const message of messages) {
    if (message.authorKind !== "operator" || !thread.has(message.messageId)) {
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
    const template = written(
      document as JsonRecord,
      { kind: "message", messageId: message.messageId },
      message.atMs,
    );
    if (template !== null) held.push(template);
  }
  return held;
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

/** A template as a plan a person may pick, or null when it is not one (see {@link heldPlans}). */
function asHeldPlan(template: DraftTemplate): HeldPlan | null {
  const planned = readRunPlan(template.plan);
  // **A revise lap's plan is not a template for new work**: its base is the
  // lap it revised's topic branch (`revisionPlan`), so a lap started from it
  // would be cut from another request's unmerged work. A first lap's plan
  // bases on the repository's own branch.
  if (planned.kind !== "planned" || planned.plan.pullRequestBaseBranch !== null) {
    return null;
  }
  const recorded = agentTypeRecordOf(planned.plan, template.plan);
  if ("refusal" in recorded) {
    return null;
  }
  return {
    planDigest: template.planDigest,
    document: template.plan,
    repository: template.repository,
    workspaceRoot: template.workspaceRoot,
    agentTypeDigest: recorded.record.agentTypeDigest,
    agentTypeInput: recorded.record.agentTypeInput,
    from: template.from,
  };
}

/**
 * The plans rondo holds for one request, **one per choice, newest first**
 * (D-0075 rule 2.3): the drafter's templates, which are pasted into its thread,
 * recorded by setup, and those recent laps ran, grouped by the plan a caller
 * would write and ordered by when rondo came to hold each, with no source
 * ranked above another. A plan whose agent type builds no record, or a revise
 * lap's, is not offered.
 */
export async function heldPlans(
  ports: Pick<DrafterPorts, "store" | "record" | "now">,
  requestMessageId: string,
): Promise<readonly HeldPlan[]> {
  const material = await gatherDrafterMaterial(ports, requestMessageId, null);
  return material.templates.flatMap((template) => asHeldPlan(template) ?? []);
}

/**
 * One plan a person chose, by digest, **wherever rondo holds it** (rondo#238):
 * pasted into this request's thread, on a setup row, or on any lap row -- not
 * only the one of each choice the list offers, and not only the twenty rows
 * the list reads. What a press and a redraw resolve the chosen plan by, so a
 * newer plan in the meantime neither hides it nor swaps it. Null when it is
 * held nowhere, or is no plan a person may pick ({@link asHeldPlan}).
 */
export async function heldPlanByDigest(
  ports: Pick<DrafterPorts, "store" | "record" | "now">,
  requestMessageId: string,
  planDigest: string,
): Promise<HeldPlan | null> {
  const records = [
    ...(await ports.store.readLive()),
    ...(await ports.store.terminalIterations()),
  ].flatMap((outcome) => (outcome.kind === "read" ? [outcome.record] : []));
  const read = await ports.record.threadMessages();
  const messages = read.kind === "read" ? read.messages : [];
  const thread = threadOf(messages, requestMessageId);
  // Written plans first, newest first, so a pasted or setup plan names where
  // it came from even when a lap once ran on the same bytes.
  const written = (await heldTemplates(ports, [], messages, thread))
    .reverse()
    .sort((a, b) => b.heldAtMs - a.heldAtMs);
  const found = written.find((t) => t.planDigest === planDigest);
  if (found !== undefined) {
    return asHeldPlan(found);
  }
  for (const record of records) {
    if (record.planDigest !== planDigest) {
      continue;
    }
    const planned = readPlan(record.plan);
    if (planned.kind !== "planned") {
      continue;
    }
    return asHeldPlan({
      planDigest,
      plan: record.plan,
      repository: planned.plan.repository,
      workspaceRoot: planned.plan.workspaceRoot,
      agentTypeDigest: record.agentTypeDigest,
      from: { kind: "iterations", iterationIds: [record.id] },
      heldAtMs: record.createdAtMs,
    });
  }
  return null;
}

/** One plan of a drafted split, as a lap would run it, or why it cannot be run. */
export type DraftedPlanRun =
  | {
      readonly kind: "runnable";
      readonly plan: RunPlan;
      /** The split's own words for the plan (D-0063 rule 4.3): what the page shows. */
      readonly split: SplitPlan;
      readonly repository: string;
      readonly workspaceRoot: string;
    }
  | { readonly kind: "refused"; readonly reason: string };

/**
 * The lap one plan of a drafted split would run (D-0063 rule 4, rondo#238 C2):
 * its template's plan, byte for byte, with the drafted `prompt` and the named
 * agent type's input in place -- the only two fields a split may differ in
 * (rule 4.2). Run id, branch and workspace are derived at admission from the
 * iteration id (rule 4.5), as for any plan.
 *
 * **Everything is read back from rows, never posted**: the proposal row (a
 * model drafter's split, over this request), the template from its snapshot,
 * and the agent type's input from the record rondo holds for the digest -- the
 * one a drafted scope wrote from a pasted plan (D-0071 point 1 (a)), else the
 * pasted input the snapshot carried. A revise lap's plan is refused as a
 * template, as it is everywhere a plan is picked.
 */
export async function draftedPlanRun(
  ports: { readonly record: Pick<AdvisoryRecord, "readProposal" | "heldAgentType"> },
  requestMessageId: string,
  proposalId: string,
  planIndex: number,
): Promise<DraftedPlanRun> {
  const refused = (reason: string): DraftedPlanRun => ({ kind: "refused", reason });
  const read = await ports.record.readProposal(proposalId);
  if (read.kind !== "read") {
    return refused(
      read.kind === "absent"
        ? `there is no proposal '${proposalId}'`
        : `the proposal '${proposalId}' will not read: ${read.reason}`,
    );
  }
  const proposal = read.proposal;
  if (proposal.kind !== "split" || !isModelDrafterName(proposal.drafter)) {
    return refused(`the proposal '${proposalId}' is not a drafted split`);
  }
  const material = proposal.snapshot["material"] as DrafterMaterial | undefined;
  if (material === undefined || material.requestMessageId !== requestMessageId) {
    return refused(`the proposal '${proposalId}' was not drafted for this request`);
  }
  const payload = readSplitPayload(proposal.payload);
  if (payload.kind !== "split") {
    return refused(`the proposal '${proposalId}' does not read as a split: ${payload.reason}`);
  }
  const split = payload.payload.plans[planIndex];
  if (split === undefined) {
    return refused(`the split '${proposalId}' has no plan ${String(planIndex)}`);
  }
  const template = material.templates.find((t) => t.planDigest === split.template_plan_digest);
  if (template === undefined) {
    return refused(`the template '${split.template_plan_digest}' is not in the draft's snapshot`);
  }
  const held = await ports.record.heldAgentType(split.agent_type_digest);
  const pasted = material.agentTypes.find(
    (a) => a.digest === split.agent_type_digest && a.source.kind === "recordable",
  );
  const input =
    held.kind === "read"
      ? held.agentTypeInput
      : pasted?.source.kind === "recordable"
        ? pasted.source.agentTypeInput
        : undefined;
  if (input === undefined || builtFacts(split.agent_type_digest, input) === null) {
    return refused(
      `the agent type '${split.agent_type_digest}' is not one rondo holds a record of that rebuilds to it`,
    );
  }
  const planned = readRunPlan({
    ...template.plan,
    prompt: split.prompt,
    agent_type_input: input,
  });
  if (planned.kind !== "planned") {
    return refused(`the drafted plan does not read: ${planned.reason}`);
  }
  if (planned.plan.pullRequestBaseBranch !== null) {
    return refused("the drafted plan's template is a revise lap's, which no new work starts from");
  }
  return {
    kind: "runnable",
    plan: planned.plan,
    split,
    repository: planned.plan.repository,
    workspaceRoot: planned.plan.workspaceRoot,
  };
}
