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
  type Proposal,
  payloadDocument,
  propose,
  proposeElevated,
  snapshotDocument,
} from "../advisory/proposal.js";
import type { IterationRecord, LapReading, ProposalDraft } from "../store/records.js";
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
function gather(record: IterationRecord, readings: readonly LapReading[]): AdvisorySnapshot {
  return {
    iteration: {
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
    },
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
function cited(snapshot: AdvisorySnapshot, pointer: string): string {
  const found = pointer
    .split("/")
    .slice(1)
    .reduce<unknown>(
      (at, step) =>
        // **Own properties only.** A pointer is a locator into the snapshot as
        // persisted, and `constructor`, `toString` and `__proto__` are in no
        // snapshot -- they are on every object. Walking into them would render
        // a function as a citation of material the row does not hold, which is
        // the one thing a locator is supposed to make impossible. It matters
        // here rather than in the abstract because a pointer can now come from
        // an operator's `--basis` (D-0032 rule 2, #41 section 3).
        at === null || typeof at !== "object" || !Object.hasOwn(at, step)
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
function basisLine(basis: Basis, snapshot: AdvisorySnapshot): string {
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
  proposal: Proposal,
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
