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
  type AgentTypeProposal,
  type Basis,
  type CandidateSource,
  type Claim,
  type ContractKeysProposal,
  type ContractSnapshot,
  type Explanation,
  type Option,
  type OptionSetPayload,
  type PayloadReading,
  payloadDocument,
  propose,
  proposeAgentType,
  proposeContractKeys,
  proposeElevated,
  proposeRetryPlan,
  type RetrySnapshot,
  type RunPlanProposal,
  readPayload,
  type SnapshotCandidate,
  type SnapshotContractCandidate,
  type SnapshotIteration,
  type SnapshotSuccessor,
  snapshotDocument,
} from "../advisory/proposal.js";
import {
  type AgentType,
  type AgentTypeInput,
  agentTypeRecord,
  contractDigest,
  contractPayload,
  issueInitialContract,
  resolveProject,
} from "../cadenza/facade.js";
import { allocate } from "../refrain/allocator.js";
import { type AdmittedPlan, admittedPlan, readPlan } from "../refrain/plan.js";
import {
  type DecisionOutcome,
  type IterationRecord,
  isApprovableKind,
  type JsonRecord,
  type LapReading,
  type ProposalDraft,
  type ProposalKind,
  type StoredProposal,
} from "../store/records.js";
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
 * Whether one pointer token addresses something **in the JSON document**.
 *
 * Own properties only, and on an array only an index: `constructor` is on
 * every object and `length` is on every array, and neither is in any snapshot.
 * A pointer that walked into one would render a number or a function as a
 * citation of material the row does not hold, which is the one thing a locator
 * is supposed to make impossible -- and the pointer can now come from an
 * operator's `--basis` (D-0032 rule 2, #41 section 3).
 */
function addressable(at: object, step: string): boolean {
  return Array.isArray(at) ? /^(0|[1-9]\d*)$/.test(step) && step in at : Object.hasOwn(at, step);
}

/**
 * Resolve one JSON pointer against the snapshot the proposal kept.
 *
 * Total: a pointer that leads nowhere says so rather than rendering as an empty
 * citation, because a basis that does not resolve is worth seeing -- it means
 * the claim and the snapshot have drifted apart, which is the one failure a
 * locator is supposed to make impossible.
 *
 * **The parameter is the JSON document and not the typed snapshot**, because
 * the same pointer has to resolve against a snapshot just composed and against
 * one read back out of a row (#39): the store holds it verbatim, so the two are
 * the same bytes, and typing this to the composed shape would leave the reader
 * able to print a pointer and unable to print what it resolves to.
 */
function cited(snapshot: object, pointer: string): string {
  const found = pointer
    .split("/")
    .slice(1)
    .reduce<unknown>(
      (at, step) =>
        at === null || typeof at !== "object" || !addressable(at, step)
          ? undefined
          : Reflect.get(at, step),
      snapshot,
    );
  // `JSON.stringify` answers `undefined` for a value JSON has no form for as
  // well as for an absent one, and the two are the same answer to a reader: a
  // pointer that leads to nothing they can open.
  const rendered = found === undefined ? undefined : JSON.stringify(found);
  if (rendered === undefined) {
    return "does not resolve";
  }
  return rendered.length > CITATION_CEILING
    ? `${rendered.slice(0, CITATION_CEILING)}... (${String(rendered.length)} chars)`
    : rendered;
}

/** One basis, as the line under the claim it supports. */
function basisLine(basis: Basis, snapshot: object): string {
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
  elevation: Elevation | null = null,
): readonly string[] {
  return [
    `explanation of iteration '${iterationId}'`,
    ...(elevation === null
      ? []
      : // **The chain, on the screen, in the order #41 section 3 writes it.** The
        // two columns are the record of it; this is the one line that says out
        // loud that a person put this here, because an elevated proposal that
        // rendered exactly like a drafted one would hide the very act the
        // columns exist to keep.
        [`  elevated from message '${elevation.messageId}' by '${elevation.actorId}'`]),
    `  drafter: ${DETERMINISTIC_DRAFTER}; derivation: ${proposal.derivation}`,
    // **Said out loud, because the record says it and a screen that did not
    // would be the confusion D-0032 rule 5 refuses**: this kind binds nothing,
    // and `recordDecision` will refuse an answer that names it.
    "  this explanation binds nothing: it is not a proposal and cannot be approved",
    ...proposal.payload.claims.flatMap((claim) => claimLines(claim, snapshot)),
  ];
}

/**
 * One observation, as the operator hands it over (#41 section 3, D-0036
 * rules 3 and 4).
 *
 * **Three fields, and each of them is a different half of the chain.** The
 * message is the observation's own identity in the conversation -- D-0036
 * rule 3 property 2 makes an observation a message and gives #41's chain its
 * one missing link; the actor is who took it up, which is where authority
 * enters; the claim is what was said *and what it rests on*, which is the
 * hazard's answer rather than the gesture's convenience.
 */
export interface Elevation {
  readonly messageId: string;
  readonly actorId: string;
  readonly observation: Claim;
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
  return await explainedBy(ports, iterationId, null);
}

/**
 * Elevate one observation into a proposal about an iteration: append the
 * message, then explain the row with the observation at the head of the claims.
 *
 * **The two elevation columns are written here and nowhere else** (D-0032
 * rule 7, D-0036 rule 3). Everything else about the path is `explain`'s,
 * deliberately: the same gather, the same record-before-render order, the same
 * one-per-subject count. Elevation is a *provenance* on a proposal rather than
 * a second kind of proposal, which is why it is two arguments and not a second
 * pipeline.
 *
 * **This is the first writer the conversation has**, and that settles a
 * question D-0036 rule 3 left open on purpose -- whether the surface writes a
 * message before an operator does. It does not: the only message rondo composes
 * is the one an operator typed at this verb, in the same gesture that elevates
 * it. Everything else rule 3 left open (the body's type, authorship, ordering,
 * threading, retention) is still open, because nothing here needed it: the
 * conversation stores an id, and the observation's text travels in the
 * proposal's payload, beside the basis it rests on.
 */
export async function elevateObservation(
  ports: ExplainPorts,
  iterationId: string,
  elevation: Elevation,
): Promise<ExplainOutcome> {
  return await explainedBy(ports, iterationId, elevation);
}

async function explainedBy(
  ports: ExplainPorts,
  iterationId: string,
  elevation: Elevation | null,
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
  const proposal =
    elevation === null ? propose(snapshot) : proposeElevated(snapshot, elevation.observation);
  const createdAtMs = ports.now();
  // **The id is the operator's to read, and a collision is a repeat.** Two
  // explanations of one row in one millisecond carry the same bytes, so the
  // primary key collides exactly when the second row would have said what the
  // first one says; the store reports that as a defect and nothing is presented.
  // **An elevation is named after the message it came from, and the reason is
  // not tidiness.** The clock-derived form is right for `explain`, where two
  // rows one millisecond apart say the same thing; two elevations in one
  // millisecond say *different* things, because the operator typed them, so a
  // clock that cannot separate them would refuse the second one's observation
  // as though it were a repeat. The message id already cannot collide -- the
  // row was just inserted under it -- so the proposal id inherits that.
  const proposalId =
    elevation === null
      ? `explanation-${iterationId}-${String(createdAtMs)}`
      : `elevation-${elevation.messageId}`;
  // **The message and the proposal are one write** (`recordElevation`), and
  // the reason is that they are one gesture. A message id is spent for ever
  // once appended (D-0036 rule 3), so appending it and then failing to record
  // the proposal would cost the operator the name they chose and leave a row
  // in the conversation with no observation behind it. Nothing is appended
  // before the iteration is known to be readable either, for the same reason:
  // the commonest mistake is a typo'd iteration id.
  const draft: ProposalDraft = {
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
    // **D-0032 rule 7's pair, written together or not at all.** Null on an
    // `explain`, because nothing was elevated; both non-null on an elevation,
    // because an observation with no elevator and an elevator with no
    // observation are each half a link. The schema's CHECK says the same thing,
    // and the store refuses a message id that names no message (D-0036 rule 4).
    elevatedFromMessageId: elevation?.messageId ?? null,
    elevatedByActorId: elevation?.actorId ?? null,
    createdAtMs,
  };
  const recorded =
    elevation === null
      ? await ports.record.recordProposal(draft)
      : await ports.record.recordElevation(elevation.messageId, draft);
  if (recorded.kind !== "recorded") {
    return {
      kind: "refused",
      reason:
        `The ${elevation === null ? "explanation" : "elevation"} of '${iterationId}' was ` +
        `composed and not recorded, so it is not being shown: ${recorded.reason}. A framing an ` +
        "operator reads and the ledger does not hold is the thing the record exists to prevent.",
    };
  }
  ports.present(explanationLines(iterationId, proposal, snapshot, elevation));
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
 * Admit one persisted plan under the successor's identity.
 *
 * **This is D-0022 rule 17's replacement carried out.** A retry is not a
 * successor contract over the predecessor: it is an ordinary initial contract
 * issued to a *fresh* identity, and because `D-0023` derives the run id from
 * the iteration id, choosing the successor's id fixes the grantee before
 * anything is admitted -- so the exact contract the retry would run under can
 * be composed, digested and shown **before** a person approves it.
 *
 * **Nothing is admitted for real, nothing is issued and no row is reserved.**
 * The value is a plan with the successor's identity folded on; what turns one
 * into a run is `admit()`, which no path here calls.
 */
function admitFor(record: IterationRecord, successorId: string): AdmitOutcome {
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
  return successor.kind === "planned"
    ? { kind: "admitted", plan: successor.plan }
    : { kind: "refused", reason: successor.reason };
}

/** A plan under the successor's identity, or why this row cannot supply one. */
type AdmitOutcome =
  | { readonly kind: "admitted"; readonly plan: AdmittedPlan }
  | { readonly kind: "refused"; readonly reason: string };

/** One contract as both halves of what is written from it. */
type IssuedContract = {
  readonly contract: JsonRecord;
  readonly contractDigest: string;
  readonly agentTypeDigest: string;
  readonly granted: readonly string[];
  readonly askable: readonly string[];
};

/** A contract issued, or cadenza's own refusal to issue one. */
type IssueOutcome =
  | { readonly kind: "issued"; readonly issued: IssuedContract }
  | { readonly kind: "refused"; readonly reason: string };

/**
 * Issue the contract one plan and one agent-type input compose.
 *
 * **The one path to a contract in this module**, which is why `agent_type` and
 * `contract_keys` vary an *input* to it rather than composing a contract of
 * their own: two ways to reach a digest a person approves would be two things
 * that can disagree about what they approved. The three cadenza calls are the
 * ones `classifyPlan` already makes, in cadenza's order.
 *
 * The contract travels back beside its digest because two different rows are
 * written from it -- the option's digest goes in the `proposal`, the contract's
 * own fields in the `composition` -- and recomposing it for the second write
 * would be a second issuance of the value a person is about to approve.
 */
function issueFor(plan: AdmittedPlan, input: AgentTypeInput, about: string): IssueOutcome {
  try {
    const project = resolveProject(plan.catalogLayers, plan.projectName);
    const agentType = agentTypeRecord(input);
    const contract = issueInitialContract(agentType, project, plan.parties);
    return {
      kind: "issued",
      issued: {
        contract: contractPayload(contract) as JsonRecord,
        contractDigest: contractDigest(contract),
        agentTypeDigest: agentType.agentTypeDigest,
        // cadenza's own lists, sorted and frozen by it. Copied rather than read
        // off the input: what an operator judges is what the *record* carries,
        // and `agentType()` is what settles order and duplication.
        granted: [...agentType.granted],
        askable: [...agentType.askable],
      },
    };
  } catch (error) {
    // cadenza's message, untranslated (D-0018 rule 7): a rondo sentence wrapped
    // around `ProjectNotFoundError` would be a second vocabulary for one fault.
    return {
      kind: "refused",
      reason:
        `cadenza refused to issue a contract for ${about}: ` +
        `${error instanceof Error ? error.message : String(error)}`,
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
  kind: ProposableKind,
  payload: OptionSetPayload,
  snapshot: RetrySnapshot | ContractSnapshot,
): readonly string[] {
  const successor = snapshot.successor;
  return [
    `a retry of iteration '${iterationId}', as iteration '${successor.iterationId}' (${kind})`,
    `  drafter: ${DETERMINISTIC_DRAFTER}`,
    `  the retry would run as ${successor.runId} on ${successor.topicBranch}`,
    // **Said out loud because it is what the person is answering.** The value
    // of each option is the contract digest an approval names, and approving is
    // the whole of what these kinds do today -- nothing consumes the answer, so
    // a line claiming the retry will start would be false.
    "  approving one of these records that you approved its contract. It starts nothing yet:",
    "  no admission reads this decision (D-0022 rule 17's consumer is not built).",
    ...payload.options.flatMap((option, index) => [
      `  [${index === payload.recommended ? "recommended" : "alternative"}] ${option.label}`,
      `      contract: ${option.value}`,
      `      basis: ${basisLine(option.basis, snapshot)}`,
    ]),
  ];
}

/**
 * The three kinds this surface can put to an operator.
 *
 * A subset of `APPROVABLE_PROPOSAL_KINDS` and not a second spelling of it:
 * `widening_successor` is absent because nothing composes one yet, and the
 * store's own union is what decides whether a kind can be answered at all
 * (D-0032 rule 5). This list is only what `propose` knows how to draft.
 */
export const PROPOSABLE_KINDS = Object.freeze(["run_plan", "agent_type", "contract_keys"] as const);

export type ProposableKind = (typeof PROPOSABLE_KINDS)[number];

/** One drafted proposal: the option set, the snapshot it cites, and the contracts behind it. */
type Drafted = {
  readonly proposal: RunPlanProposal | AgentTypeProposal | ContractKeysProposal;
  readonly snapshot: RetrySnapshot | ContractSnapshot;
  /** In option order: the contract each option's digest was taken over. */
  readonly contracts: readonly JsonRecord[];
};

type DraftOutcome =
  | { readonly kind: "drafted"; readonly drafted: Drafted }
  | { readonly kind: "refused"; readonly reason: string };

/**
 * The rows a proposal draws its alternatives from: the subject, and the one it
 * superseded.
 *
 * ponytail: one generation, not the whole lineage. A row five revisions deep
 * would otherwise offer five options, of which four were each superseded for a
 * reason the operator already acted on -- and the set of alternatives *is* the
 * framing #39 measures, so a longer list is not a better one. What a person can
 * act on is what has just failed and what it was revised from. Walk further
 * when an operator asks for an ancestor this does not offer; the walk needs a
 * bound and a cycle guard that one generation does not.
 *
 * **A predecessor that will not read is a refusal rather than a shorter list**:
 * an alternative that silently went missing is the framing hazard, and the
 * operator can see the lineage in `explain` either way. An *older* ancestor is
 * not consulted at all, by the ceiling above, so it cannot go missing from a
 * set it was never in.
 */
async function lineage(
  ports: Pick<ExplainPorts, "store">,
  subject: IterationRecord,
): Promise<{ rows: readonly IterationRecord[] } | { refusal: string }> {
  const previousId = subject.supersedesIterationId;
  if (previousId === null) {
    return { rows: [subject] };
  }
  const previous = await ports.store.read(previousId);
  if (previous.kind !== "read") {
    return {
      refusal:
        `Iteration '${subject.id}' supersedes '${previousId}', and that row cannot be read, so ` +
        "the alternatives rondo would offer are not all of them. A proposal quietly short one " +
        "option is a framing, which is the thing this record exists to prevent.",
    };
  }
  return { rows: [subject, previous.record] };
}

/** What re-gathering `run_plan`'s candidates produced, or the gatherer's own refusal. */
type CandidateGather =
  | {
      readonly kind: "gathered";
      readonly candidates: readonly SnapshotCandidate[];
      readonly contracts: readonly JsonRecord[];
      readonly successor: SnapshotSuccessor | null;
    }
  | { readonly kind: "refused"; readonly reason: string };

/**
 * The candidate loop `run_plan` drafts from, callable without the drafter
 * (`D-0038` rule 3's re-gather seam). A re-gather at render time runs this
 * exact function again, over the lineage read fresh, so that "what would be
 * proposed now" and "what was proposed then" are produced by one gatherer.
 */
function gatherRunPlanCandidates(
  rows: readonly IterationRecord[],
  successorId: string,
): CandidateGather {
  const candidates: SnapshotCandidate[] = [];
  const contracts: JsonRecord[] = [];
  let successor: SnapshotSuccessor | null = null;
  for (const row of rows) {
    const admitted = admitFor(row, successorId);
    if (admitted.kind !== "admitted") {
      return { kind: "refused", reason: admitted.reason };
    }
    const issued = issueFor(admitted.plan, admitted.plan.agentTypeInput, `iteration '${row.id}'`);
    if (issued.kind !== "issued") {
      return { kind: "refused", reason: issued.reason };
    }
    successor ??= {
      iterationId: successorId,
      runId: admitted.plan.runId,
      topicBranch: admitted.plan.topicBranch,
    };
    candidates.push({
      iterationId: row.id,
      status: row.status,
      planDigest: row.planDigest,
      contractDigest: issued.issued.contractDigest,
    });
    contracts.push(issued.issued.contract);
  }
  return { kind: "gathered", candidates, contracts, successor };
}

/** Draft `run_plan`: one option per persisted plan in the lineage. */
function draftRunPlan(
  subject: IterationRecord,
  rows: readonly IterationRecord[],
  successorId: string,
): DraftOutcome {
  const gathered = gatherRunPlanCandidates(rows, successorId);
  if (gathered.kind !== "gathered") {
    return { kind: "refused", reason: gathered.reason };
  }
  const head = gathered.candidates[0];
  if (head === undefined || gathered.successor === null) {
    return { kind: "refused", reason: `Iteration '${subject.id}' has no plan to propose.` };
  }
  const snapshot: RetrySnapshot = {
    iteration: snapshotIteration(subject),
    successor: gathered.successor,
    candidates: [head, ...gathered.candidates.slice(1)],
  };
  return {
    kind: "drafted",
    drafted: { proposal: proposeRetryPlan(snapshot), snapshot, contracts: gathered.contracts },
  };
}

/** One candidate's provenance and the agent-type input it composes from. */
type CandidateInput = { readonly from: CandidateSource; readonly input: AgentTypeInput };

type InputsOutcome = { readonly inputs: readonly CandidateInput[] } | { readonly refusal: string };

/**
 * The agent types the lineage ran under, or the first row that will not say.
 *
 * **A row whose plan will not decode is a refusal and not a shorter list**, for
 * `lineage`'s reason: the alternative exists, rondo could not read it, and a
 * proposal that quietly omitted it would put a one-option set in front of a
 * person who had two. The row is named, because "something in the lineage" is
 * not something anyone can act on.
 */
function agentTypesOf(rows: readonly IterationRecord[]): InputsOutcome {
  const inputs: CandidateInput[] = [];
  for (const row of rows) {
    const decoded = readPlan(row.plan);
    if (decoded.kind !== "planned") {
      return {
        refusal:
          `the plan iteration '${row.id}' ran will not decode, so the agent type it ran under ` +
          `cannot be offered as an alternative: ${decoded.reason}`,
      };
    }
    inputs.push({
      from: { form: "iteration", iterationId: row.id },
      input: decoded.plan.agentTypeInput,
    });
  }
  return { inputs };
}

/**
 * The unchanged key set, and one candidate per askable key promoted.
 *
 * **cadenza validates the stored input before anything is enumerated from it**,
 * and that is not defensive habit: `readPlan` carries `agentTypeInput` through
 * as opaque data (the store may not name a cadenza type), so a plan that
 * decodes says nothing about whether `granted` and `askable` are lists at all.
 * A row written by an older build, or edited with `sqlite3`, would otherwise
 * throw here -- before `issueFor`'s `try`, which is where cadenza's refusals
 * are turned into something an operator can read.
 *
 * The lists are then taken **off the record cadenza built** rather than off the
 * input: `agentType()` sorts, de-duplicates and freezes them, so what is
 * enumerated is what the contract would actually carry.
 */
function promotionsOf(own: AgentTypeInput, subjectId: string): InputsOutcome {
  let record: AgentType;
  try {
    record = agentTypeRecord(own);
  } catch (error) {
    return {
      refusal:
        `the agent type iteration '${subjectId}' ran under is not one cadenza will build, so its ` +
        `keys cannot be offered: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  return {
    inputs: [
      { from: { form: "iteration", iterationId: subjectId }, input: own },
      ...record.askable.map((key) => ({
        from: { form: "promotedKey", key } as const,
        // **One key, and only one the author already offered.** cadenza requires
        // `granted` and `askable` to be disjoint, so the key moves rather than
        // being copied -- which is what makes this a promotion and not an
        // invention.
        input: {
          ...own,
          granted: [...record.granted, key],
          askable: record.askable.filter((other) => other !== key),
        },
      })),
    ],
  };
}

/**
 * Draft `agent_type` or `contract_keys`: one option per candidate contract.
 *
 * **Both hold the plan fixed and vary an input to the contract**, which is the
 * difference from `run_plan` and the reason they are one function. The subject's
 * own plan is the one every candidate is issued against: a proposal that varied
 * the agent type *and* the plan at once would ask a person to approve two
 * changes with one answer.
 *
 * `agent_type` draws its alternatives from the lineage -- agent types some
 * iteration really ran under, selected and not written. `contract_keys` composes
 * its alternatives, one at a time, by moving a single key the agent type's own
 * author already listed as `askable` (see {@link CandidateSource}).
 *
 * **Candidates that reach the same contract are one candidate.** Two agent
 * types with one digest issue one contract, and two options carrying one value
 * would be two ways to record an approval the ledger cannot tell apart --
 * `human_decision.approved` names a digest, so distinct options must name
 * distinct digests or the answer is ambiguous.
 */
/** What re-gathering `agent_type` or `contract_keys` candidates produced, or the refusal. */
type ContractCandidateGather =
  | {
      readonly kind: "gathered";
      readonly candidates: readonly SnapshotContractCandidate[];
      readonly contracts: readonly JsonRecord[];
      readonly successor: SnapshotSuccessor | null;
    }
  | { readonly kind: "refused"; readonly reason: string };

/**
 * The candidate loop `agent_type` and `contract_keys` draft from, callable
 * without the drafter (`D-0038` rule 3's re-gather seam), for
 * {@link gatherRunPlanCandidates}'s reason exactly.
 */
function gatherContractCandidates(
  kind: "agent_type" | "contract_keys",
  subject: IterationRecord,
  rows: readonly IterationRecord[],
  successorId: string,
): ContractCandidateGather {
  const admitted = admitFor(subject, successorId);
  if (admitted.kind !== "admitted") {
    return { kind: "refused", reason: admitted.reason };
  }
  const plan = admitted.plan;
  const own = plan.agentTypeInput;
  const enumerated = kind === "agent_type" ? agentTypesOf(rows) : promotionsOf(own, subject.id);
  if ("refusal" in enumerated) {
    return { kind: "refused", reason: enumerated.refusal };
  }
  const inputs = enumerated.inputs;

  const candidates: SnapshotContractCandidate[] = [];
  const contracts: JsonRecord[] = [];
  for (const { from, input } of inputs) {
    const about =
      from.form === "iteration"
        ? `the agent type iteration '${from.iterationId}' ran under`
        : `the agent type with '${from.key}' granted`;
    const issued = issueFor(plan, input, about);
    if (issued.kind !== "issued") {
      return { kind: "refused", reason: issued.reason };
    }
    if (candidates.some((seen) => seen.contractDigest === issued.issued.contractDigest)) {
      // The same contract reached twice: one option, not two identical ones.
      // The first is kept, and the first is always the subject's own.
      continue;
    }
    candidates.push({
      from,
      agentTypeId: input.agentTypeId,
      agentTypeDigest: issued.issued.agentTypeDigest,
      granted: issued.issued.granted,
      askable: issued.issued.askable,
      contractDigest: issued.issued.contractDigest,
    });
    contracts.push(issued.issued.contract);
  }
  return {
    kind: "gathered",
    candidates,
    contracts,
    successor: { iterationId: successorId, runId: plan.runId, topicBranch: plan.topicBranch },
  };
}

function draftContracts(
  kind: "agent_type" | "contract_keys",
  subject: IterationRecord,
  rows: readonly IterationRecord[],
  successorId: string,
): DraftOutcome {
  const gathered = gatherContractCandidates(kind, subject, rows, successorId);
  if (gathered.kind !== "gathered") {
    return { kind: "refused", reason: gathered.reason };
  }
  const head = gathered.candidates[0];
  if (head === undefined || gathered.successor === null) {
    // Unreachable: the subject's own agent type is always a candidate. Written
    // as a refusal because the alternative is an option set with no
    // recommendation, which is the one shape D-0032 rule 1 does not admit.
    return { kind: "refused", reason: `Iteration '${subject.id}' has no agent type to propose.` };
  }
  const snapshot: ContractSnapshot = {
    iteration: snapshotIteration(subject),
    successor: gathered.successor,
    candidates: [head, ...gathered.candidates.slice(1)],
  };
  return {
    kind: "drafted",
    drafted: {
      proposal: kind === "agent_type" ? proposeAgentType(snapshot) : proposeContractKeys(snapshot),
      snapshot,
      contracts: gathered.contracts,
    },
  };
}

/**
 * Propose what a retry of one iteration could run under, and record what was
 * put on the screen.
 *
 * **The order is the property, and it is D-0022 rule 18's** (`advisory.md`
 * 6.2): the proposal row and every composition row are written **before**
 * anything is rendered, so a contract a person was shown is a contract the
 * ledger holds -- including when they refuse it, which is the case rule 18 says
 * the composition has to outlive. If any of those writes fails, nothing is
 * shown.
 *
 * **The three kinds differ in what they vary and in nothing else.**
 * `run_plan` varies the plan, `agent_type` varies which agent type the retry
 * runs under, `contract_keys` varies which keys that agent type carries as
 * granted. All three end at a contract issued to the successor's identity, so
 * all three record the same rows in the same order.
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
  kind: ProposableKind,
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
  const rows = await lineage(ports, subject.record);
  if ("refusal" in rows) {
    return { kind: "refused", reason: rows.refusal };
  }
  const draft =
    kind === "run_plan"
      ? draftRunPlan(subject.record, rows.rows, successorId)
      : draftContracts(kind, subject.record, rows.rows, successorId);
  if (draft.kind !== "drafted") {
    return {
      kind: "refused",
      reason: `No ${kind} for a retry of '${iterationId}' can be proposed: ${draft.reason}`,
    };
  }
  const { proposal, snapshot, contracts } = draft.drafted;
  const createdAtMs = ports.now();
  const proposalId = `${kind}-${successorId}-${String(createdAtMs)}`;
  const recorded = await ports.record.recordProposal({
    proposalId,
    kind,
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
    // The pin that composed something -- and these kinds compose. It is the one
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
        `The ${kind} proposal for '${iterationId}' was composed and not recorded, so it is not ` +
        `being shown: ${recorded.reason}.`,
    };
  }
  for (const [index, option] of proposal.payload.options.entries()) {
    const contract = contracts[index];
    if (contract === undefined) {
      // Unreachable: the drafters build one contract per option, in order.
      // Refused rather than asserted, because the failure it would otherwise
      // produce is a composition row holding some other option's contract.
      return {
        kind: "refused",
        reason: `Option ${String(index)} of '${proposalId}' has no contract behind it.`,
      };
    }
    const composition = await ports.record.recordComposition({
      // **Zero-padded so the id sorts the way the options are ordered.** The
      // suffix is the option's index -- it is what links a composition row back
      // to the option whose digest it holds -- and `-10` sorts before `-2` in
      // text, so an unpadded id would put the tenth option second for any
      // reader that ordered by it. Three digits: an option set larger than that
      // is not one a person is answering in one sentence.
      compositionId: `${proposalId}-${String(index).padStart(3, "0")}`,
      proposalId,
      contract,
      contractDigest: option.value,
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
  ports.present(optionLines(iterationId, kind, proposal.payload, snapshot));
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

/**
 * What answering forecloses, **computed from `kind` and never stored**
 * (D-0032 rule 4).
 *
 * #39's fourth requirement, and the reason it is a function rather than a
 * column: a free-text *"this forecloses ..."* on the row would be the drafter
 * narrating the consequence of its own recommendation, which is rule 3's hazard
 * applied to the most load-bearing sentence on the screen. Every consequence
 * below is a property of the act and of the ledger that records it, readable in
 * the schema rather than in anybody's prose.
 *
 * **A `Record` over the union, for `RELEASED_BY`'s reason**: a sixth kind added
 * to `PROPOSAL_KINDS` and forgotten here is a type error rather than a screen
 * that quietly says nothing about what a person is about to spend.
 */
const FORECLOSES: Record<ProposalKind, readonly string[]> = {
  // The three widenings the surface can draft, and one it cannot: what an
  // approval of any of them *is* is the same act -- D-0022 rule 9's single
  // issuance -- so the sentence that differs is what the issuance would widen.
  run_plan: ["the retry would run under the plan you pick, and not under the other options"],
  agent_type: ["the retry would run under the agent type you pick, with the grants it carries"],
  contract_keys: ["the retry would carry the keys you pick as granted rather than as askable"],
  widening_successor: ["the successor would carry the widening you pick"],
  explanation: [],
};

/**
 * The irreversibility block, as the lines under an option set.
 *
 * Three sentences and no more, because all three are facts about the ledger:
 * an approval is spendable **once** (`decision_consumption.decision_id` is a
 * primary key, D-0022 rule 9); the answer row is append-only, so changing your
 * mind is a new proposal rather than an edit; and nothing consumes an approval
 * in this cut, so approving starts nothing today. The last is the one that
 * stops the screen from overstating what it is asking for.
 */
function foreclosureLines(kind: string): readonly string[] {
  if (!isApprovableKind(kind)) {
    return [
      "what answering forecloses: nothing. This kind binds nothing and cannot be answered",
      "  (D-0032 rule 5: the store refuses a decision that names it).",
    ];
  }
  return [
    "what answering forecloses:",
    ...FORECLOSES[kind].map((line) => `  ${line};`),
    "  an approval is spendable once and can never be spent twice (D-0022 rule 9), and the",
    "  answer is appended rather than edited -- changing your mind is a new proposal;",
    "  declining is recorded too, so nobody later reads a refusal as an unanswered question.",
    "  It starts nothing yet: no admission reads this decision (D-0022 rule 17's consumer",
    "  is not built).",
  ];
}

/**
 * Whether the material a basis rests on still reads the way it did at
 * composition (`D-0038`): decided by re-gathering and comparing records, never
 * by comparing timestamps, and `undetermined` is a value the screen may never
 * round to `unmoved`.
 *
 * `detail` carries which field differed on a `moved` verdict, or why rondo
 * could not decide on an `undetermined` one; it is null on `unmoved`, where
 * there is nothing to say beyond the word itself.
 */
export type Freshness = {
  readonly verdict: "unmoved" | "moved" | "undetermined";
  readonly detail: string | null;
};

function undetermined(detail: string): Freshness {
  return { verdict: "undetermined", detail };
}

/** A record differing from itself: fields whose value changed, rendered `key: `old` -> `new``. */
function renderValue(value: unknown): string {
  return `\`${typeof value === "string" ? value : JSON.stringify(value)}\``;
}

function recordDifferences(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): readonly string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const diffs: string[] = [];
  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      diffs.push(`${key}: ${renderValue(before[key])} -> ${renderValue(after[key])}`);
    }
  }
  return diffs;
}

/** Two records of the same identity, compared field by field (`D-0038` rule 1). */
function compareRecords(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Freshness {
  const diffs = recordDifferences(before, after);
  return diffs.length === 0
    ? { verdict: "unmoved", detail: null }
    : { verdict: "moved", detail: diffs.join("; ") };
}

/**
 * The record one pointer sits in, per `D-0038` rule 1: an array element by its
 * own identity for a pointer into an array of records, or the top-level record
 * itself for a pointer into one.
 *
 * Untyped on purpose: the same logic has to walk both the stored snapshot and
 * the re-gathered document, and typing this to any one snapshot shape would
 * leave it unable to walk the other two.
 */
function containerOf(
  document: Record<string, unknown>,
  pointer: string,
): {
  readonly top: string;
  readonly identity: string | null;
  readonly record: Record<string, unknown>;
} | null {
  const segments = pointer.split("/").slice(1);
  const top = segments[0];
  if (top === undefined) {
    return null;
  }
  const value = document[top];
  if (Array.isArray(value)) {
    const index = segments[1];
    if (index === undefined || !/^(0|[1-9]\d*)$/.test(index)) {
      return null;
    }
    const element = value[Number(index)];
    if (typeof element !== "object" || element === null) {
      return null;
    }
    const record = element as Record<string, unknown>;
    return { top, identity: identityOf(top, record), record };
  }
  if (typeof value !== "object" || value === null) {
    return null;
  }
  return { top, identity: null, record: value as Record<string, unknown> };
}

/**
 * The identity a record in an array is matched by, never its index
 * (`D-0038` rule 2): a candidate set is enumerated and de-duplicated by the
 * gatherer, so candidate N today need not be candidate N at composition.
 */
function identityOf(top: string, record: Record<string, unknown>): string {
  if (top === "candidates") {
    if (typeof record["iterationId"] === "string") {
      return `iteration:${record["iterationId"]}`;
    }
    const from = record["from"];
    if (typeof from === "object" && from !== null) {
      const source = from as Record<string, unknown>;
      if (source["form"] === "iteration" && typeof source["iterationId"] === "string") {
        return `iteration:${source["iterationId"]}`;
      }
      if (source["form"] === "promotedKey" && typeof source["key"] === "string") {
        return `promotedKey:${source["key"]}`;
      }
    }
  }
  if (top === "readings" && typeof record["drafter"] === "string") {
    return record["drafter"];
  }
  return "";
}

/** The record in the re-gathered document with the same identity, or null if it left the set. */
function matchingRecord(
  document: Record<string, unknown>,
  container: { readonly top: string; readonly identity: string | null },
): Record<string, unknown> | null {
  const value = document[container.top];
  if (container.identity === null) {
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }
  if (!Array.isArray(value)) {
    return null;
  }
  for (const element of value) {
    if (
      typeof element === "object" &&
      element !== null &&
      identityOf(container.top, element as Record<string, unknown>) === container.identity
    ) {
      return element as Record<string, unknown>;
    }
  }
  return null;
}

/** What re-gathering the material behind a proposal's bases produced, or the gatherer's refusal. */
type RegatherOutcome =
  | { readonly kind: "regathered"; readonly document: Record<string, unknown> }
  | { readonly kind: "refused"; readonly reason: string };

/** Everything one basis needs in order to decide its own freshness (`D-0038` rule 4's `Record`). */
interface FreshnessContext {
  readonly storedSnapshot: Record<string, unknown>;
  readonly subjectId: string;
  readonly subjectVerdict: Freshness;
  readonly regathered: RegatherOutcome;
}

/** A `snapshot` basis: re-gather, find the record the pointer sits in, and compare it. */
function snapshotBasisFreshness(pointer: string, ctx: FreshnessContext): Freshness {
  if (cited(ctx.storedSnapshot, pointer) === "does not resolve") {
    // D-0038 rule 5's second edge: a citation already broken at composition is
    // D-0032 rule 2's failure, not evidence about movement.
    return undetermined("this citation does not resolve in the stored snapshot");
  }
  if (ctx.regathered.kind === "refused") {
    // Rule 5's third edge: the refusal is whole-snapshot, not per basis.
    return undetermined(`rondo could not re-gather to check: ${ctx.regathered.reason}`);
  }
  const container = containerOf(ctx.storedSnapshot, pointer);
  if (container === null) {
    return undetermined("rondo does not know how to compare the record this citation names");
  }
  const fresh = matchingRecord(ctx.regathered.document, container);
  if (fresh === null) {
    // Rule 5's first edge: the strongest signal rondo can observe.
    return { verdict: "moved", detail: "no longer present in what rondo reads now" };
  }
  return compareRecords(container.record, fresh);
}

/**
 * One basis's freshness, exhaustive over {@link Basis}'s five forms
 * (`D-0038` rule 4). A sixth form added to the union and forgotten here is a
 * type error, not a screen that quietly says a premise held.
 */
const BASIS_FRESHNESS: {
  readonly [K in Basis["form"]]: (basis: Basis, ctx: FreshnessContext) => Freshness;
} = {
  snapshot: (basis, ctx) => snapshotBasisFreshness((basis as { pointer: string }).pointer, ctx),
  iteration: (basis, ctx) => {
    const iterationId = (basis as { iterationId: string }).iterationId;
    return iterationId === ctx.subjectId
      ? ctx.subjectVerdict
      : undetermined(
          `this basis names iteration '${iterationId}', not this proposal's own subject '${ctx.subjectId}', ` +
            "so rondo has nothing recorded at composition to compare it against",
        );
  },
  gateTransition: () =>
    undetermined("rondo has no reader for a gate transition yet (D-0022's own named residual)"),
  continuoRun: () =>
    undetermined(
      "nothing recorded what this continuo run said at composition, so there is no left-hand side",
    ),
  repository: () =>
    undetermined(
      "deciding a repository citation needs a ref to compare against, which is a policy nothing in " +
        "rondo owns yet (D-0033 rule 9, D-0037's residual)",
    ),
};

/** What re-gathering produced for a proposal's candidates or its readings, so bases can be compared. */
async function regatherPayload(
  ports: Pick<ProposePorts, "store">,
  proposal: StoredProposal,
  subject: IterationRecord,
): Promise<RegatherOutcome> {
  if (proposal.kind === "explanation") {
    const readings = await ports.store.readingsFor(subject.id);
    return {
      kind: "regathered",
      document: {
        iteration: snapshotIteration(subject),
        readings: readings.map((reading) => ({
          drafter: reading.drafter,
          verdict: reading.verdict,
          findings: [...reading.findings],
          unavailableReason: reading.unavailableReason,
        })),
      },
    };
  }
  if (
    proposal.kind !== "run_plan" &&
    proposal.kind !== "agent_type" &&
    proposal.kind !== "contract_keys"
  ) {
    // `widening_successor` and any kind rondo does not know: no drafter here
    // composes one, so there is no gatherer to re-run either.
    return {
      kind: "refused",
      reason: `rondo has no re-gather for proposal kind '${proposal.kind}'`,
    };
  }
  const successor = (proposal.snapshot as Record<string, unknown>)["successor"];
  const successorId =
    typeof successor === "object" && successor !== null
      ? (successor as Record<string, unknown>)["iterationId"]
      : undefined;
  if (typeof successorId !== "string") {
    return {
      kind: "refused",
      reason: "the stored snapshot names no successor to re-gather candidates for",
    };
  }
  const rows = await lineage(ports, subject);
  if ("refusal" in rows) {
    return { kind: "refused", reason: rows.refusal };
  }
  const gathered =
    proposal.kind === "run_plan"
      ? gatherRunPlanCandidates(rows.rows, successorId)
      : gatherContractCandidates(proposal.kind, subject, rows.rows, successorId);
  return gathered.kind === "gathered"
    ? {
        kind: "regathered",
        document: { iteration: snapshotIteration(subject), candidates: gathered.candidates },
      }
    : { kind: "refused", reason: gathered.reason };
}

/** Every basis's freshness, plus the subject's own verdict and the cadenza pin line (`D-0038`). */
export interface FreshnessReport {
  readonly subject: Freshness;
  /** Aligned by index to the payload's own `options` or `claims`. */
  readonly perBasis: readonly Freshness[];
  /** The pin line, said once, when the current pin differs from the one that composed this row. */
  readonly pinLine: string | null;
}

/**
 * Re-gather this proposal's material and decide every basis's freshness
 * against it (`D-0038`). Null when there is no payload to check -- the row
 * will not read, or names no iteration at all.
 */
async function gatherFreshness(
  ports: Pick<ProposePorts, "store" | "cadenzaRevision">,
  proposal: StoredProposal,
  reading: PayloadReading,
): Promise<FreshnessReport | null> {
  if (reading.kind === "unreadable" || proposal.iterationId === null) {
    return null;
  }
  const items: readonly { readonly basis: Basis }[] =
    reading.kind === "options" ? reading.payload.options : reading.payload.claims;
  const subjectOutcome = await ports.store.read(proposal.iterationId);
  if (subjectOutcome.kind !== "read") {
    const reason =
      subjectOutcome.kind === "absent"
        ? `iteration '${proposal.iterationId}' is no longer in this store`
        : `iteration '${proposal.iterationId}' will not decode: ${subjectOutcome.reason}`;
    const whole = undetermined(reason);
    return { subject: whole, perBasis: items.map(() => whole), pinLine: null };
  }
  const freshIteration = snapshotIteration(subjectOutcome.record) as unknown as Record<
    string,
    unknown
  >;
  const storedIteration = (proposal.snapshot as Record<string, unknown>)["iteration"];
  const subjectVerdict =
    typeof storedIteration === "object" && storedIteration !== null
      ? compareRecords(storedIteration as Record<string, unknown>, freshIteration)
      : undetermined("the stored snapshot names no iteration to compare");

  const regathered = await regatherPayload(ports, proposal, subjectOutcome.record);
  const ctx: FreshnessContext = {
    storedSnapshot: proposal.snapshot as Record<string, unknown>,
    subjectId: proposal.iterationId,
    subjectVerdict,
    regathered,
  };
  const perBasis = items.map((item) => BASIS_FRESHNESS[item.basis.form](item.basis, ctx));

  const pinLine =
    proposal.cadenzaRevision !== null && proposal.cadenzaRevision !== ports.cadenzaRevision
      ? `cadenza pin moved: this proposal's contracts were composed under '${proposal.cadenzaRevision}', ` +
        `and rondo is running '${ports.cadenzaRevision}'`
      : null;

  return { subject: subjectVerdict, perBasis, pinLine };
}

/**
 * One stored proposal as an operator reads it, composed at render time from the
 * row and nothing else (#39, D-0032 rules 1, 2, 3 and 4).
 *
 * **This is the screen #39 asks for, and the reason it needs a reader at all.**
 * The drafting verbs render an option set once, to the terminal that drafted
 * it; a gate answered an hour later was, until this, answerable only by
 * scrolling back or by reading the lap. Everything here comes out of the row:
 * the options and the recommendation from `payload`, the material under each
 * basis from the row's own verbatim `snapshot`, the voice from `kind`, and what
 * answering forecloses from `kind` again.
 *
 * **The recommendation is marked where it sits.** The order is the payload's,
 * and a renderer that moved the recommendation to the top would be composing a
 * framing of its own over the one the record holds -- which is the hazard #39
 * measures rather than a nicety.
 */
export function storedProposalLines(
  proposal: StoredProposal,
  reading: PayloadReading,
  freshness: FreshnessReport | null = null,
): readonly string[] {
  const about =
    proposal.iterationId === null
      ? "about no iteration"
      : `about iteration '${proposal.iterationId}'`;
  return [
    `proposal '${proposal.proposalId}'  ${proposal.kind}  ${about}`,
    `  drafter: ${proposal.drafter}${
      proposal.derivation === null ? "" : `; derivation: ${proposal.derivation}`
    }`,
    ...(proposal.elevatedFromMessageId === null || proposal.elevatedByActorId === null
      ? []
      : [
          `  elevated from message '${proposal.elevatedFromMessageId}' by ` +
            `'${proposal.elevatedByActorId}'`,
        ]),
    ...answerLines(proposal),
    ...(freshness === null ? [] : freshnessHeaderLines(proposal.iterationId, freshness)),
    "",
    ...payloadLines(
      reading,
      proposal.snapshot,
      isApprovableKind(proposal.kind),
      freshness?.perBasis ?? null,
    ),
    "",
    ...foreclosureLines(proposal.kind),
    // **The command that answers it, with the flag that carries the choice.**
    // #39 asks for a decision answerable in one sentence, and a screen that
    // shows the options without saying how to say one of them back leaves the
    // operator composing a command line from the usage text. It is printed only
    // where there is something to answer: on a settled proposal it would invite
    // a second answer the store will refuse.
    ...(isApprovableKind(proposal.kind) && proposal.decisions.length === 0
      ? [
          "",
          `Next: rondo decide --proposal-id ${proposal.proposalId} --actor-id ID ` +
            "--outcome approved --contract-digest DIGEST, where DIGEST is the contract line " +
            "of the option you are approving",
        ]
      : []),
  ];
}

/**
 * Answered, declined, or still open (D-0032 rule 6).
 *
 * **Every answer, oldest first, and never only the last one.** Nothing makes
 * `human_decision` unique per proposal, so a decline followed by an approval is
 * two rows and both of them are facts about what a person did. A screen that
 * showed one would be choosing which of them the ledger meant.
 */
function answerLines(proposal: StoredProposal): readonly string[] {
  if (proposal.decisions.length === 0) {
    return isApprovableKind(proposal.kind)
      ? ["  nobody has answered this yet"]
      : ["  this proposal binds nothing: it is read, not answered"];
  }
  return [
    ...proposal.decisions.map(
      (decision) =>
        `  ${decision.outcome} by '${decision.actorId}' as decision '${decision.decisionId}'` +
        `${decision.approved === null ? "" : `, approving contract ${decision.approved}`}`,
    ),
    // **Said out loud rather than left to be discovered.** A settled proposal
    // rendered exactly like an open one is the screen that gets answered twice.
    ...(proposal.decisions.length === 1
      ? ["  it is settled: this screen is the record of what was answered, not a question"]
      : [
          // **The count is on the screen rather than reconciled silently.** Two
          // answers to one proposal is a state the schema permits and nothing
          // here can rank: each is spendable on its own terms (D-0022 rule 9
          // counts issuances per decision, not per proposal), so the honest
          // rendering is all of them and the number.
          `  ${String(proposal.decisions.length)} answers were recorded against this proposal, ` +
            "and each is spendable on its own; rondo does not rank them",
        ]),
  ];
}

/**
 * The header's three-way count and the subject's own verdict (`D-0038` rule 1
 * and rule 4's closing paragraph): always the count, never a single word --
 * including when nothing moved -- and the subject is said beside it because no
 * basis on `agent_type` or `contract_keys` rests on it at all.
 */
function freshnessHeaderLines(
  iterationId: string | null,
  freshness: FreshnessReport,
): readonly string[] {
  const counts = { unmoved: 0, moved: 0, undetermined: 0 };
  for (const one of freshness.perBasis) {
    counts[one.verdict] += 1;
  }
  return [
    `  freshness: ${String(counts.unmoved)} unmoved, ${String(counts.moved)} moved, ` +
      `${String(counts.undetermined)} undetermined; subject '${String(iterationId)}': ` +
      freshnessWord(freshness.subject),
    ...(freshness.pinLine === null ? [] : [`  ${freshness.pinLine}`]),
  ];
}

/**
 * One verdict, with its detail beside it when there is one.
 *
 * `undefined` is unreachable -- `perBasis` is built one entry per option or
 * claim -- and is read as `undetermined` rather than asserted away, so an
 * index ever falling out of step is a wrong word on the screen and not a
 * throw.
 */
function freshnessWord(freshness: Freshness | undefined): string {
  if (freshness === undefined) {
    return "undetermined";
  }
  return freshness.detail === null
    ? freshness.verdict
    : `${freshness.verdict} (${freshness.detail})`;
}

/** The options or the claims, each with its basis and the material under it. */
function payloadLines(
  reading: PayloadReading,
  snapshot: object,
  approvable: boolean,
  perBasis: readonly Freshness[] | null,
): readonly string[] {
  switch (reading.kind) {
    case "options":
      return [
        `the options, in the order the record holds them (${String(
          reading.payload.options.length,
        )}):`,
        ...reading.payload.options.flatMap((option, index) => [
          `  [${index === reading.payload.recommended ? "recommended" : "alternative"}] ` +
            option.label,
          // **`contract:` on an approvable kind, because that is the word the
          // flag uses.** An option's value *is* the digest an approval names
          // (D-0032 rule 1), and `decide --contract-digest` is copied off this
          // line: a screen that called it something else would leave the
          // operator matching two words nobody said were the same.
          `      ${approvable ? "contract" : "value"}: ${option.value}`,
          `      basis: ${basisLine(option.basis, snapshot)}`,
          ...(perBasis === null ? [] : [`      freshness: ${freshnessWord(perBasis[index])}`]),
        ]),
      ];
    case "claims":
      return [
        `the claims, in the order the record holds them (${String(
          reading.payload.claims.length,
        )}):`,
        ...reading.payload.claims.flatMap((claim, index) => [
          `  ${claim.label}: ${claim.value}`,
          `      basis: ${basisLine(claim.basis, snapshot)}`,
          ...(perBasis === null ? [] : [`      freshness: ${freshnessWord(perBasis[index])}`]),
        ]),
      ];
    default:
      // **The row is on the screen saying it will not read, rather than
      // missing from it.** An operator who asked to see a proposal and got a
      // clean empty screen would read it as "there is nothing to decide".
      return [`this proposal's payload will not read: ${reading.reason}`];
  }
}

/** What showing one proposal did, or the way its own bookkeeping fell short. */
export type ShowOutcome =
  | { readonly kind: "shown" }
  | { readonly kind: "shownUncounted"; readonly reason: string }
  | { readonly kind: "refused"; readonly reason: string };

/**
 * Door eleven: show one stored proposal, and count that it was put to the
 * operator.
 *
 * **The order is `explain`'s and the inbox's**: read, render, then count
 * (D-0036 rule 1). A presentation is counted once per subject, so a proposal
 * read five times before it is answered is one row -- the second write stores
 * nothing and reports success, which is what keeps #40's ratio a count of
 * subjects on both sides.
 */
export async function showProposal(
  ports: Pick<ExplainPorts, "record" | "present" | "now"> &
    Pick<ProposePorts, "store" | "cadenzaRevision">,
  proposalId: string,
): Promise<ShowOutcome> {
  const atMs = ports.now();
  const outcome = await ports.record.readProposal(proposalId);
  if (outcome.kind === "absent") {
    return { kind: "refused", reason: `there is no proposal '${proposalId}'` };
  }
  if (outcome.kind === "unreadable") {
    // **A refusal and not a screen.** Every other decode fault in this tree
    // renders as a line, because the alternative is hiding a live row; here the
    // whole subject is the one row, and rendering half of a proposal somebody
    // is about to approve is the failure mode, not the fallback.
    return {
      kind: "refused",
      reason: `the proposal '${proposalId}' will not read: ${outcome.reason}`,
    };
  }
  const reading = readPayload(outcome.proposal.payload);
  // **Re-gathered here, and never stored** (`D-0038` rule 6): whether the
  // premise under this proposal still holds is a function of the row and of
  // now, decided fresh at every render.
  const freshness = await gatherFreshness(ports, outcome.proposal, reading);
  ports.present(storedProposalLines(outcome.proposal, reading, freshness));
  const counted = await ports.record.recordAttention({
    atMs,
    subjectKind: PROPOSAL_SUBJECT,
    subjectId: proposalId,
    disposition: "presented",
    // Null for the inbox's reason: this surface withholds nothing, so there is
    // no policy to name.
    ruleName: null,
  });
  return counted.kind === "recorded"
    ? { kind: "shown" }
    : { kind: "shownUncounted", reason: counted.reason };
}
