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
  snapshotDocument,
} from "../advisory/proposal.js";
import type { IterationRecord, LapReading } from "../store/records.js";
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

/** What one `explain` did, or the first reason it did not. */
export type ExplainOutcome =
  | { readonly kind: "explained"; readonly proposalId: string; readonly lines: readonly string[] }
  | { readonly kind: "refused"; readonly reason: string };

/** Everything `explain` is handed: two ports over the store, and a clock. */
export interface ExplainPorts {
  readonly store: IterationStore;
  readonly record: AdvisoryRecord;
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

/** One basis, as the line under the claim it supports. */
function basisLine(basis: Basis): string {
  switch (basis.form) {
    case "snapshot":
      // **The inline form** (D-0032 rule 2): the snapshot is in the row, so the
      // pointer is a citation a reader can follow without opening anything.
      return `snapshot ${basis.pointer}`;
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

function claimLines(claim: Claim): readonly string[] {
  return [`  ${claim.label}: ${claim.value}`, `      basis: ${basisLine(claim.basis)}`];
}

/**
 * The explanation as an operator reads it, composed at render time.
 *
 * **Every claim carries its basis on the line under it**, which is #39's
 * requirement taken literally: the citation is close enough to read without
 * opening anything, because the material the advisory read is in the row the
 * pointer names. Nothing here is stored (D-0032 rule 3).
 */
export function explanationLines(iterationId: string, proposal: Proposal): readonly string[] {
  return [
    `explanation of iteration '${iterationId}'`,
    `  drafter: ${DETERMINISTIC_DRAFTER}; derivation: ${proposal.derivation}`,
    // **Said out loud, because the record says it and a screen that did not
    // would be the confusion D-0032 rule 5 refuses**: this kind binds nothing,
    // and `recordDecision` will refuse an answer that names it.
    "  this explanation binds nothing: it is not a proposal and cannot be approved",
    ...proposal.payload.claims.flatMap(claimLines),
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
  return { kind: "explained", proposalId, lines: explanationLines(iterationId, proposal) };
}
