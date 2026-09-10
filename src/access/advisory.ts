/**
 * The composition root for the advisory: it gathers, it records, and it renders
 * (D-0022 rules 1, 2 and 3).
 *
 * **Three things happen here and none of them happens in `src/advisory/`.**
 * Gathering is this layer's because the advisory may not read the store itself;
 * writing is this layer's because the advisory returns a value and nothing else;
 * rendering is this layer's because D-0032 rule 3 refuses a stored summary -- a
 * framing that outlives the material it was drawn from can drift from it
 * silently, so what an operator sees is composed from the option set and its
 * bases at the moment it is shown.
 *
 * **The proposal row is written before it is presented.** That is D-0022
 * rule 18's order applied to the kind this cut ships: a proposal an operator was
 * shown and the ledger does not hold is a framing with no record, and the
 * failure it produces is the one the whole design exists to make impossible. If
 * the insert fails, nothing is rendered.
 *
 * **The arrow this module needs is `src/access -> src/advisory`**, which
 * D-0022 rule 1 grants. It does not reach cadenza and composes no contract:
 * `explanation` is the kind that binds nothing (D-0032 rule 5), so there is
 * nothing here for authority (b) or (c) to do.
 */
import {
  type AdvisorySnapshot,
  type Basis,
  type Claim,
  type Explanation,
  type Option,
  payloadDocument,
  propose,
  proposeRetryPlan,
  type RetrySnapshot,
  type RunPlanProposal,
  type SnapshotCandidate,
  type SnapshotIteration,
  snapshotDocument,
} from "../advisory/proposal.js";
import {
  agentTypeRecord,
  contractDigest,
  contractPayload,
  issueInitialContract,
  resolveProject,
} from "../cadenza/facade.js";
import { allocate } from "../refrain/allocator.js";
import { admittedPlan, readPlan } from "../refrain/plan.js";
import type { DecisionOutcome, IterationRecord, JsonRecord, LapReading } from "../store/records.js";
import type { AdvisoryRecord, IterationStore } from "../store/sqlite.js";

/**
 * Who drafted it (D-0022 rule 13).
 *
 * An identifier and never an authority: the record is identical whichever
 * drafter produced it, which is what lets a model drafter arrive without a
 * schema change, and is why D-0032 rule 5 makes authority a function of `kind`
 * alone. This is the deterministic one, which rule 13 says ships first.
 */
export const DETERMINISTIC_DRAFTER = "rondo/advisory/deterministic";

/**
 * The subject kind `explain` counts itself under (D-0032 rule 10).
 *
 * A proposal is what was put in front of the operator; the iteration it is about
 * is what the proposal is *for*. Counting the iteration would make one row's
 * several explanations indistinguishable from one.
 */
export const PROPOSAL_SUBJECT = "proposal";

/**
 * What one `explain` did, or the first reason it did not.
 *
 * **The middle arm is D-0032 rule 10 refusing to be silent.** The count of what
 * was put to the operator comes from `operator_attention` and from nowhere else
 * -- `human_decision` counts answers, so with six proposals on the screen and
 * none answered it reports zero -- so a presentation that happened and was not
 * counted leaves that table understating the numerator. It is not a refusal: the
 * operator has already read the explanation and the proposal row is in the
 * ledger. It is the one case where the surface has to say that its own
 * accounting is short.
 */
export type ExplainOutcome =
  | { readonly kind: "explained"; readonly proposalId: string }
  | {
      readonly kind: "presentedUncounted";
      readonly proposalId: string;
      readonly reason: string;
    }
  | { readonly kind: "refused"; readonly reason: string };

/** Everything `explain` is handed: two ports over the store, a clock, and a screen. */
export interface ExplainPorts {
  readonly store: IterationStore;
  readonly record: AdvisoryRecord;
  /**
   * Where the lines go.
   *
   * A port rather than a return value, because **the order is the property**:
   * the proposal is recorded before this is called and the attention row is
   * written after it, so "presented" is a claim about something that has already
   * reached the screen rather than about something that is about to. D-0032
   * rule 9's own note applies -- a look is a claim by the surface that it
   * rendered, not proof that a person read anything.
   */
  readonly present: (lines: readonly string[]) => void;
  /**
   * The caller's clock.
   *
   * A parameter rather than a call inside, for the reason every other timestamp
   * in the tree is the caller's: the store reads no clock, and a proposal whose
   * `created_at_ms` cannot be controlled from a test is a row whose ordering
   * cannot be tested. It is also what rule 9's "what changed since `t`" query
   * compares against.
   */
  readonly now: () => number;
}

/**
 * Copy one row into the snapshot shape, which is the gathering D-0022 rule 2
 * assigns to this layer.
 *
 * Field by field rather than by spreading the record: the snapshot is persisted
 * verbatim and every `snapshot` basis is a pointer into it, so what goes in is a
 * decision and not whatever the row happened to carry. The plan is cited by its
 * digest and is not copied -- see {@link AdvisorySnapshot}.
 */
function snapshotIteration(record: IterationRecord): SnapshotIteration {
  return {
    id: record.id,
    status: record.status,
    request: record.request,
    planDigest: record.planDigest,
    attempts: record.attempts,
    supersedesIterationId: record.supersedesIterationId,
    continuoRevision: record.continuoRevision,
    agentTypeDigest: record.agentTypeDigest,
    configDigest: record.configDigest,
    contractDigest: record.contractDigest,
    classification: record.classification,
    classificationReason: record.classificationReason,
    modelTier: record.modelTier,
    model: record.model,
    gateId: record.gateId,
    gateStage: record.gateStage,
    gateOutcome: record.gateOutcome,
    reason: record.reason,
  };
}

/**
 * The explanation's snapshot: one row copied, and the readings taken over it.
 *
 * The iteration half is {@link snapshotIteration} because both snapshot shapes
 * carry it and a second copy of eighteen field names is a second place a field
 * can go missing from -- the pointer that cited it would then resolve on one
 * kind and not on the other.
 */
function gather(record: IterationRecord, readings: readonly LapReading[]): AdvisorySnapshot {
  return {
    iteration: snapshotIteration(record),
    readings: readings.map((reading) => ({
      drafter: reading.drafter,
      verdict: reading.verdict,
      findings: [...reading.findings],
      unavailableReason: reading.unavailableReason,
    })),
  };
}

/**
 * How much of a cited value is printed beside its pointer.
 *
 * ponytail: a fixed cap, raise it if an operator ever needs a longer citation
 * inline. A citation that fills the screen stops being a citation, and what is
 * cut is always still in the row the pointer names.
 */
const CITATION_CEILING = 200;

/**
 * Resolve one JSON pointer against the snapshot the proposal kept.
 *
 * Total: a pointer that leads nowhere says so rather than rendering as an empty
 * citation, because a basis that does not resolve is worth seeing -- it means
 * the claim and the snapshot have drifted apart, which is the one failure a
 * locator is supposed to make impossible.
 */
function cited(snapshot: AdvisorySnapshot | RetrySnapshot, pointer: string): string {
  const found = pointer
    .split("/")
    .slice(1)
    .reduce<unknown>(
      (at, step) => (at === null || typeof at !== "object" ? undefined : Reflect.get(at, step)),
      snapshot,
    );
  if (found === undefined) {
    return "does not resolve";
  }
  const rendered = JSON.stringify(found);
  return rendered.length > CITATION_CEILING
    ? `${rendered.slice(0, CITATION_CEILING)}... (${String(rendered.length)} chars)`
    : rendered;
}

/** One basis, as the line under the claim it supports. */
function basisLine(basis: Basis, snapshot: AdvisorySnapshot | RetrySnapshot): string {
  switch (basis.form) {
    case "snapshot":
      // **The inline form** (D-0032 rule 2): the snapshot is in the row, so the
      // material renders *here* rather than as something to go and open -- and
      // the value is printed beside the pointer rather than trusted to match the
      // claim. Where the claim reads `undetermined` or `none` the two differ on
      // purpose, and this is the line that lets an operator see whether the
      // column was null, empty, or something rondo did not read.
      return `snapshot ${basis.pointer} = ${cited(snapshot, basis.pointer)}`;
    case "iteration":
      return `iteration ${basis.iterationId}`;
    case "gateTransition":
      return `gate ${basis.gateId} transition ${String(basis.transitionSeq)}`;
    case "continuoRun":
      return `continuo run ${basis.runId}`;
    default:
      return `${basis.path}:${String(basis.firstLine)}-${String(basis.lastLine)} at ${basis.commit}`;
  }
}

function claimLines(claim: Claim, snapshot: AdvisorySnapshot): readonly string[] {
  return [`  ${claim.label}: ${claim.value}`, `      basis: ${basisLine(claim.basis, snapshot)}`];
}

/**
 * The explanation as an operator reads it, composed at render time.
 *
 * **Every claim carries its basis on the line under it, and a snapshot basis
 * carries the material it names**, which is #39's requirement taken literally:
 * close enough to read without opening anything. The snapshot is a parameter for
 * exactly that reason -- a renderer that did not have it could print the pointer
 * and could not print what the pointer resolves to, which would leave the
 * operator checking a claim against itself. Nothing here is stored
 * (D-0032 rule 3).
 */
export function explanationLines(
  iterationId: string,
  proposal: Explanation,
  snapshot: AdvisorySnapshot,
): readonly string[] {
  return [
    `explanation of iteration '${iterationId}'`,
    `  drafter: ${DETERMINISTIC_DRAFTER}; derivation: ${proposal.derivation}`,
    // **Said out loud, because the record says it and a screen that did not
    // would be the confusion D-0032 rule 5 refuses**: this kind binds nothing,
    // and `recordDecision` will refuse an answer that names it.
    "  this explanation binds nothing: it is not a proposal and cannot be approved",
    ...proposal.payload.claims.flatMap((claim) => claimLines(claim, snapshot)),
  ];
}

/**
 * Explain one iteration: gather, propose, record, render.
 *
 * **It reads the store and drives no continuo**, which is what makes it
 * reachable for the row it most exists to explain. `D-0019` rule 15 ends a
 * `needs_approval` request at terminal `abandoned`, and D-0032 rule 11's
 * terminal enumeration exists because that row could not be found at all; a
 * command that needed a working continuo to describe it would be unreachable in
 * exactly the states worth describing.
 */
export async function explainIteration(
  ports: ExplainPorts,
  iterationId: string,
): Promise<ExplainOutcome> {
  const outcome = await ports.store.read(iterationId);
  if (outcome.kind === "absent") {
    return {
      kind: "refused",
      reason: `There is no iteration '${iterationId}' in this store.`,
    };
  }
  if (outcome.kind === "unreadable") {
    // **The one case where refusing is the explanation.** A row that will not
    // decode cannot be cited, and an explanation composed from a half-read row
    // would be grounded in material the reader cannot check.
    return {
      kind: "refused",
      reason:
        `Iteration '${iterationId}' is in the store and will not decode, so there is nothing ` +
        `rondo can cite about it: ${outcome.reason}`,
    };
  }
  const snapshot = gather(outcome.record, await ports.store.readingsFor(iterationId));
  const proposal = propose(snapshot);
  const createdAtMs = ports.now();
  // **The id is the operator's to read, and a collision is a repeat.** Two
  // explanations of one row in one millisecond carry the same bytes, so the
  // primary key collides exactly when the second row would have said what the
  // first one says; the store reports that as a defect and nothing is presented.
  const proposalId = `explanation-${iterationId}-${String(createdAtMs)}`;
  const recorded = await ports.record.recordProposal({
    proposalId,
    kind: "explanation",
    drafter: DETERMINISTIC_DRAFTER,
    payload: payloadDocument(proposal.payload),
    snapshot: snapshotDocument(snapshot),
    derivation: proposal.derivation,
    iterationId,
    supersedesIterationId: outcome.record.supersedesIterationId,
    supersedesProposalId: null,
    // **The predecessor digests are null on an explanation, and that is not an
    // oversight.** They say what a diff or a widening is *against*; an
    // explanation diffs nothing, and filling them with this row's own digests
    // would make the row read as a proposal about a successor.
    predecessorPlanDigest: null,
    predecessorContractDigest: null,
    agentTypeDigest: outcome.record.agentTypeDigest,
    configDigest: outcome.record.configDigest,
    contractDigest: outcome.record.contractDigest,
    continuoRevision: outcome.record.continuoRevision,
    // The pin that *composed* something. An explanation composes no contract,
    // so there is no composition for a pin to qualify (D-0022 rule 18).
    cadenzaRevision: null,
    // D-0032 rule 7's pair, null together: nothing was elevated, because the
    // conversation this would reference is still undecided (`D-0020` rule 5).
    elevatedFromMessageId: null,
    elevatedByActorId: null,
    createdAtMs,
  });
  if (recorded.kind !== "recorded") {
    return {
      kind: "refused",
      reason:
        `The explanation of '${iterationId}' was composed and not recorded, so it is not being ` +
        `shown: ${recorded.reason}. A framing an operator reads and the ledger does not hold is ` +
        "the thing the record exists to prevent.",
    };
  }
  ports.present(explanationLines(iterationId, proposal, snapshot));
  // **Counted after it was shown** (D-0032 rule 10). This is the first writer
  // that table has: `explain` withholds nothing, so only the `presented` side
  // fires here, and `rule_name` stays null because there is no policy to name.
  // The withheld side arrives with the layer that decides what the operator does
  // *not* see, which #40 says nothing owns yet.
  const counted = await ports.record.recordAttention({
    atMs: createdAtMs,
    subjectKind: PROPOSAL_SUBJECT,
    subjectId: proposalId,
    disposition: "presented",
    ruleName: null,
  });
  return counted.kind === "recorded"
    ? { kind: "explained", proposalId }
    : { kind: "presentedUncounted", proposalId, reason: counted.reason };
}

/**
 * The surface that recorded a decision, which is not the person who took it.
 *
 * `human_decision` carries `actor_id` and `recorded_by` as two columns because
 * they are two facts, and *"a surface that recorded itself as the approver
 * would be the one substitution this table exists to make visible"*. This is
 * the second of the two.
 */
export const COMMAND_LINE_SURFACE = "rondo/cli";

/** What one `propose` did, or the first reason it did not. */
export type ProposeOutcome =
  | { readonly kind: "proposed"; readonly proposalId: string; readonly options: readonly Option[] }
  | {
      readonly kind: "presentedUncounted";
      readonly proposalId: string;
      readonly reason: string;
    }
  | { readonly kind: "refused"; readonly reason: string };

/**
 * Everything `propose` is handed: `explain`'s four ports and the cadenza pin.
 *
 * **The pin is a parameter and not a constant** (D-0022 rule 18): the
 * `composition` row records which cadenza composed the contract, and *"the
 * pin's mobility is a fact, not a forecast"* -- it has already fired once. It
 * is read where the repository's own files are readable, which is the command
 * line, and never in this module or in the advisory layer.
 */
export interface ProposePorts extends ExplainPorts {
  readonly cadenzaRevision: string;
}

/**
 * One candidate composed: the plan a retry could take and the contract it fixes.
 *
 * The contract travels beside the snapshot entry because two different rows are
 * written from it -- the option's digest goes in the `proposal`, and the
 * contract's own fields go in the `composition` -- and recomposing it for the
 * second write would be a second issuance of a value a person is about to
 * approve.
 */
type ComposedCandidate = {
  readonly candidate: SnapshotCandidate;
  readonly contract: JsonRecord;
  readonly runId: string;
  readonly topicBranch: string;
};

/** A candidate composed, or the first reason this plan cannot be one. */
type ComposeOutcome =
  | { readonly kind: "composed"; readonly composed: ComposedCandidate }
  | { readonly kind: "refused"; readonly reason: string };

/**
 * Compose the contract one persisted plan would run under as `successorId`.
 *
 * **This is D-0022 rule 17's replacement carried out.** A retry is not a
 * successor contract over the predecessor: it is an ordinary initial contract
 * issued to a *fresh* identity, and because `D-0023` derives the run id from
 * the iteration id, choosing the successor's id fixes its grantee before
 * anything is admitted -- so the exact contract the retry would run under can
 * be composed, digested and shown **before** a person approves it. The three
 * cadenza calls are the ones `classifyPlan` already makes, in cadenza's order.
 *
 * **Nothing is admitted, nothing is issued and no row is reserved here.** The
 * value is a contract and a digest; what turns either into a run is admission,
 * which this cut does not build (see {@link proposeRetry}).
 *
 * A refusal names the plan it could not compose from. **A candidate is never
 * dropped quietly**: the set of alternatives *is* the framing #39 identifies as
 * the hazard, so a proposal quietly short one option is a worse answer than a
 * refusal that says which row it could not read.
 */
function compose(
  record: IterationRecord,
  successorId: string,
  ownIterationId: string,
): ComposeOutcome {
  const decoded = readPlan(record.plan);
  if (decoded.kind !== "planned") {
    return {
      kind: "refused",
      reason:
        `the plan iteration '${record.id}' ran will not decode, so the contract a retry would ` +
        `run under cannot be composed from it: ${decoded.reason}`,
    };
  }
  const allocation = allocate(successorId, decoded.plan.workspaceRoot);
  if (allocation.kind !== "allocated") {
    return { kind: "refused", reason: allocation.reason };
  }
  // **`admittedPlan` rather than a spread that sets the grantee here.** It is
  // the function that writes `parties.grantee` from the allocation and then
  // asserts the two agree, and a second place that wrote a grantee would be
  // rondo acquiring the second authority for the run id that its own refusal
  // message names.
  const successor = admittedPlan(decoded.plan, allocation.allocation);
  if (successor.kind !== "planned") {
    return { kind: "refused", reason: successor.reason };
  }
  const plan = successor.plan;
  try {
    const project = resolveProject(plan.catalogLayers, plan.projectName);
    const agentType = agentTypeRecord(plan.agentTypeInput);
    const contract = issueInitialContract(agentType, project, plan.parties);
    return {
      kind: "composed",
      composed: {
        candidate: {
          iterationId: record.id,
          status: record.status,
          planDigest: record.planDigest,
          contractDigest: contractDigest(contract),
        },
        contract: contractPayload(contract) as JsonRecord,
        runId: plan.runId,
        topicBranch: plan.topicBranch,
      },
    };
  } catch (error) {
    // cadenza's message, untranslated (D-0018 rule 7): a rondo sentence wrapped
    // around `ProjectNotFoundError` would be a second vocabulary for one fault.
    return {
      kind: "refused",
      reason:
        `cadenza refused to issue a contract for iteration '${ownIterationId}'s retry from ` +
        `iteration '${record.id}'s plan: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * The option set as an operator reads it, composed at render time.
 *
 * Nothing here is stored (D-0032 rule 3), and every option carries its basis on
 * the line under it with the material that basis names -- #39's requirement,
 * the same way {@link explanationLines} takes it. The recommendation is marked
 * where it sits rather than moved to the top: the order is the payload's, and a
 * renderer that reordered the alternatives would be composing a framing of its
 * own over the one the record holds.
 */
export function optionLines(
  iterationId: string,
  proposal: RunPlanProposal,
  snapshot: RetrySnapshot,
): readonly string[] {
  const successor = snapshot.successor;
  return [
    `a retry of iteration '${iterationId}', as iteration '${successor.iterationId}'`,
    `  drafter: ${DETERMINISTIC_DRAFTER}`,
    `  the retry would run as ${successor.runId} on ${successor.topicBranch}`,
    // **Said out loud because it is what the person is answering.** The value
    // of each option is the contract digest an approval names, and approving is
    // the whole of what this kind does today -- nothing consumes the answer, so
    // a line claiming the retry will start would be false.
    "  approving one of these records that you approved its contract. It starts nothing yet:",
    "  no admission reads this decision (D-0022 rule 17's consumer is not built).",
    ...proposal.payload.options.flatMap((option, index) => [
      `  [${index === proposal.payload.recommended ? "recommended" : "alternative"}] ${option.label}`,
      `      contract: ${option.value}`,
      `      basis: ${basisLine(option.basis, snapshot)}`,
    ]),
  ];
}

/**
 * Propose the plans a retry of one iteration could run under, and record what
 * was put on the screen.
 *
 * **The order is the property, and it is D-0022 rule 18's** (`advisory.md`
 * 6.2): the proposal row and every composition row are written **before**
 * anything is rendered, so a contract a person was shown is a contract the
 * ledger holds -- including when they refuse it, which is the case rule 18 says
 * the composition has to outlive. If any of those writes fails, nothing is
 * shown.
 *
 * **What this does not do, stated because the gap is the point.** Nothing
 * consumes the decision: no admission compares an approved digest against the
 * classification of a plan it is about to run (D-0022 rule 17's enforcement),
 * `decision_consumption` stays empty, and the retry does not start. The chain
 * #41 §3 draws -- observation, elevation, proposal, approval, contract -- gains
 * its proposal and its approval here and is not closed by them.
 */
export async function proposeRetry(
  ports: ProposePorts,
  iterationId: string,
  successorId: string,
): Promise<ProposeOutcome> {
  const subject = await ports.store.read(iterationId);
  if (subject.kind === "absent") {
    return { kind: "refused", reason: `There is no iteration '${iterationId}' in this store.` };
  }
  if (subject.kind === "unreadable") {
    return {
      kind: "refused",
      reason:
        `Iteration '${iterationId}' is in the store and will not decode, so there is no plan ` +
        `rondo can propose a retry from: ${subject.reason}`,
    };
  }
  // **The successor's identity must be free, and this is where that is
  // checked.** `allocate()` validates the *shape* of an iteration id and knows
  // nothing about the store, so without this an operator can be shown -- and
  // can approve -- a contract for an identity that is already taken. The
  // iteration id is a primary key, so such a retry can never be admitted; and
  // moving to a free id changes the derived run id, which changes the grantee,
  // which changes the digest they approved. `revise` refuses a taken successor
  // for the same reason (`D-0027`), one lap earlier.
  const successor = await ports.store.read(successorId);
  if (successor.kind !== "absent") {
    return {
      kind: "refused",
      reason:
        `Iteration '${successorId}' already exists in this store, so it cannot be the identity a ` +
        "retry runs as: the id is a primary key, and the contract composed under it would be one " +
        "no admission could ever take. Name an unused --successor-id.",
    };
  }

  // **The subject's own plan first, then its predecessor's.** Order is the
  // payload's own and the recommendation is found by identity rather than by
  // position (see `proposeRetryPlan`), so this is the reading order and not the
  // rule.
  const rows: IterationRecord[] = [subject.record];
  const previousId = subject.record.supersedesIterationId;
  if (previousId !== null) {
    const previous = await ports.store.read(previousId);
    if (previous.kind !== "read") {
      // **A refusal rather than a shorter list**, for `compose`'s reason: an
      // alternative that silently went missing is the framing hazard, and the
      // operator can see the lineage in `explain` either way.
      return {
        kind: "refused",
        reason:
          `Iteration '${iterationId}' supersedes '${previousId}', and that row cannot be read, ` +
          "so the alternatives rondo would offer are not all of them. A proposal quietly short " +
          "one option is a framing, which is the thing this record exists to prevent.",
      };
    }
    rows.push(previous.record);
  }
  const composed: ComposedCandidate[] = [];
  for (const row of rows) {
    const outcome = compose(row, successorId, iterationId);
    if (outcome.kind !== "composed") {
      return {
        kind: "refused",
        reason: `No retry of '${iterationId}' can be proposed: ${outcome.reason}`,
      };
    }
    composed.push(outcome.composed);
  }
  const head = composed[0];
  if (head === undefined) {
    // Unreachable: `rows` always holds the subject. Written as a refusal rather
    // than as an assertion because the alternative is an option set with no
    // recommendation, which is the one shape D-0032 rule 1 does not admit.
    return { kind: "refused", reason: `Iteration '${iterationId}' has no plan to propose.` };
  }
  const snapshot: RetrySnapshot = {
    iteration: snapshotIteration(subject.record),
    successor: {
      iterationId: successorId,
      runId: head.runId,
      topicBranch: head.topicBranch,
    },
    candidates: [head.candidate, ...composed.slice(1).map((one) => one.candidate)],
  };
  const proposal = proposeRetryPlan(snapshot);
  const createdAtMs = ports.now();
  const proposalId = `run_plan-${successorId}-${String(createdAtMs)}`;
  const recorded = await ports.record.recordProposal({
    proposalId,
    kind: "run_plan",
    drafter: DETERMINISTIC_DRAFTER,
    payload: payloadDocument(proposal.payload),
    snapshot: snapshotDocument(snapshot),
    // Null on every kind but `explanation` (D-0032 rule 8), which the schema's
    // own CHECK enforces from the other side.
    derivation: null,
    iterationId,
    supersedesIterationId: subject.record.supersedesIterationId,
    supersedesProposalId: null,
    // **What the retry is measured against.** These two say what a diff or a
    // widening is *against*, and here there is one: the plan and the contract
    // the subject actually ran under.
    predecessorPlanDigest: subject.record.planDigest,
    predecessorContractDigest: subject.record.contractDigest,
    agentTypeDigest: subject.record.agentTypeDigest,
    configDigest: subject.record.configDigest,
    contractDigest: subject.record.contractDigest,
    continuoRevision: subject.record.continuoRevision,
    // The pin that composed something -- and this kind composes. It is the one
    // difference from `explain`'s row that is not a null (D-0022 rule 18).
    cadenzaRevision: ports.cadenzaRevision,
    // D-0032 rule 7's pair, null together: **nothing was elevated.** The
    // conversation exists now (D-0036 rule 3) and the writer refuses a proposal
    // naming a message that is not in it (rule 4), but this proposal was asked
    // for on a command line rather than taken up from an observation -- and a
    // message id written here to fill the column would be the dangling
    // reference rule 4 exists to refuse.
    elevatedFromMessageId: null,
    elevatedByActorId: null,
    createdAtMs,
  });
  if (recorded.kind !== "recorded") {
    return {
      kind: "refused",
      reason:
        `The retry of '${iterationId}' was composed and not recorded, so it is not being shown: ` +
        `${recorded.reason}.`,
    };
  }
  for (const [index, one] of composed.entries()) {
    const composition = await ports.record.recordComposition({
      compositionId: `${proposalId}-${String(index)}`,
      proposalId,
      contract: one.contract,
      contractDigest: one.candidate.contractDigest,
      // **Null, and D-0022 rule 17 is why.** The retry's contract supersedes
      // nothing: it is an *initial* contract, `supersedes` is null inside the
      // contract cadenza digested, and "cadenza links them not at all". A
      // predecessor digest written here would make the row claim a lineage
      // cadenza does not hold -- and would disagree with the bytes beside it.
      supersedesContractDigest: null,
      cadenzaRevision: ports.cadenzaRevision,
      composedAtMs: createdAtMs,
    });
    if (composition.kind !== "recorded") {
      return {
        kind: "refused",
        reason:
          `The contract for option ${String(index)} of '${proposalId}' was composed and not ` +
          `recorded, so nothing is being shown: ${composition.reason}. A contract an operator ` +
          "approves and the ledger does not hold is what rule 18 exists to prevent.",
      };
    }
  }
  ports.present(optionLines(iterationId, proposal, snapshot));
  const counted = await ports.record.recordAttention({
    atMs: createdAtMs,
    subjectKind: PROPOSAL_SUBJECT,
    subjectId: proposalId,
    disposition: "presented",
    ruleName: null,
  });
  return counted.kind === "recorded"
    ? { kind: "proposed", proposalId, options: proposal.payload.options }
    : { kind: "presentedUncounted", proposalId, reason: counted.reason };
}

/** What one answer did, or the first reason it was not recorded. */
export type AnswerOutcome =
  | { readonly kind: "answered"; readonly decisionId: string }
  | { readonly kind: "refused"; readonly reason: string };

/** What a person answered, as the surface hands it over. */
export interface Answer {
  readonly proposalId: string;
  readonly outcome: DecisionOutcome;
  /** The contract digest approved: one option's `value`. Null on a `declined`. */
  readonly contractDigest: string | null;
  readonly actorId: string;
}

/**
 * Record what a person answered about one proposal (D-0022 rule 9, D-0032
 * rules 5 and 6).
 *
 * **Thin on purpose.** The rule that decides whether this may be recorded at
 * all is the store's, enforced inside one `BEGIN IMMEDIATE`: a kind that binds
 * nothing is refused there (rule 5), because a check made here would be a check
 * a second surface could skip. What this function owns is the identity of the
 * decision and the two identities on the row.
 *
 * **What no writer checks, stated rather than assumed**: that `approved` names
 * a `composition` row of this proposal. D-0032 rule 12 fixed which properties
 * the schema enforces and said so -- *"the three CHECKs are the three
 * properties D-0032 fixed and nothing more"* -- so making that reference
 * enforceable is an entry's decision and not an implementation's. What stands
 * in its place today is that the digest an operator types is the one the
 * surface printed, from the option set in the row.
 *
 * **A refusal is a row and not an absence** (D-0032 rule 6): `declined` is
 * written, so *"the operator settled this"* and *"nobody has answered"* stay
 * different facts. Nothing is consumed on either path -- `decision_consumption`
 * is written by the issuance an approval authorises, and there is no issuance.
 */
export async function recordAnswer(
  ports: { readonly record: AdvisoryRecord; readonly now: () => number },
  answer: Answer,
): Promise<AnswerOutcome> {
  const decidedAtMs = ports.now();
  const decisionId = `decision-${answer.proposalId}-${String(decidedAtMs)}`;
  const recorded = await ports.record.recordDecision({
    decisionId,
    proposalId: answer.proposalId,
    outcome: answer.outcome,
    approved: answer.outcome === "approved" ? answer.contractDigest : null,
    // The digest the approved contract supersedes. Null for D-0022 rule 17's
    // reason, stated where the composition row states it: a retry's contract
    // opens a lineage rather than continuing one.
    predecessor: null,
    actorId: answer.actorId,
    recordedBy: COMMAND_LINE_SURFACE,
    // **Route S, and the two columns are null together.** No gate was opened
    // for this question: it was asked by a proposal on a command line, not by a
    // run pausing. Naming a transition here would be rondo manufacturing the
    // appearance of a question a run never asked.
    gateId: null,
    gateTransitionSeq: null,
    decidedAtMs,
  });
  return recorded.kind === "recorded"
    ? { kind: "answered", decisionId }
    : { kind: "refused", reason: recorded.reason };
}
