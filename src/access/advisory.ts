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
  type HostSnapshot,
  type Option,
  type OptionSetPayload,
  type PayloadReading,
  payloadDocument,
  propose,
  proposeAgentType,
  proposeContractKeys,
  proposeElevated,
  proposeHost,
  proposeRetryPlan,
  type RetrySnapshot,
  type RunPlanProposal,
  readPayload,
  type SnapshotCandidate,
  type SnapshotContractCandidate,
  type SnapshotIteration,
  type SnapshotLap,
  type SnapshotReading,
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
import { allocate, ITERATION_ID_PATTERN } from "../refrain/allocator.js";
import { type AdmittedPlan, admittedPlan, type RunPlan, readPlan } from "../refrain/plan.js";
import type { HostPolicy } from "../refrain/policy.js";
import { canonicalJson } from "../store/plan.js";
import {
  type DecisionOutcome,
  type IterationRecord,
  isApprovableKind,
  type JsonRecord,
  type JsonValue,
  type LapReading,
  type ProposalDraft,
  type ProposalKind,
  type StoredProposal,
} from "../store/records.js";
import type { AdvisoryRecord, IterationStore } from "../store/sqlite.js";
// The same layer, and the reason this module reaches for it is the reason that
// function exists: a value a person is meant to *read* keeps its paragraphs,
// where a value folded into a line rondo composed may not (rondo#68, rondo#90).
import { legibleAsciiEscape } from "./console.js";

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
    lapCostUsd: record.lapCostUsd,
    lapTurns: record.lapTurns,
    lapDurationMs: record.lapDurationMs,
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
export function gather(record: IterationRecord, readings: readonly LapReading[]): AdvisorySnapshot {
  return { iteration: snapshotIteration(record), readings: snapshotReadings(readings) };
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
function resolved(snapshot: object, pointer: string): unknown {
  return pointer
    .split("/")
    .slice(1)
    .reduce<unknown>(
      (at, step) =>
        at === null || typeof at !== "object" || !addressable(at, step)
          ? undefined
          : Reflect.get(at, step),
      snapshot,
    );
}

/**
 * What {@link resolved} found, rendered as the citation beside its pointer.
 *
 * Separate from the walk because a renderer sometimes has to compare what the
 * pointer found against what the claim already showed (rondo#90) rather than
 * only print it, and a comparison against a truncated rendering would be a
 * comparison of two prefixes.
 */
function cited(snapshot: object, pointer: string): string {
  const found = resolved(snapshot, pointer);
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

/**
 * One basis, as the line under the claim it supports.
 *
 * Exported because a second surface renders the same claims -- `src/access/`
 * holds the terminal today and the web page beside it -- and a second spelling
 * of a basis would be a second thing an operator has to learn to trust.
 */
export function basisLine(basis: Basis, snapshot: object): string {
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
    case "message":
      return `message ${basis.messageId}`;
    default:
      return `${basis.path}:${String(basis.firstLine)}-${String(basis.lastLine)} at ${basis.commit}`;
  }
}

/**
 * How wide a quoted value is wrapped (rondo#90).
 *
 * ponytail: a fixed width rather than the terminal's, for `asciiEscape`'s
 * reason one layer up -- what rondo writes has to read the same in the Windows
 * cell, in a pipe and in a file, and none of those has a width to ask for.
 */
const QUOTED_WIDTH = 88;

/**
 * One paragraph, broken at spaces so that no line is wider than
 * {@link QUOTED_WIDTH}.
 *
 * **An unbroken run is left whole rather than cut.** A digest, a path or a URL
 * that is wider than the column is still one token a person copies, and a line
 * break inside it would produce two halves neither of which is what the row
 * holds. So a run with no space in the column overflows it and the wrap
 * resumes at the next space.
 */
function wrapped(paragraph: string): readonly string[] {
  const lines: string[] = [];
  let rest = paragraph;
  while (rest.length > QUOTED_WIDTH) {
    const at = rest.slice(0, QUOTED_WIDTH + 1).lastIndexOf(" ");
    const cut = at > 0 ? at : rest.indexOf(" ", QUOTED_WIDTH);
    if (cut === -1) {
      break;
    }
    lines.push(rest.slice(0, cut));
    rest = rest.slice(cut + 1);
  }
  lines.push(rest);
  return lines;
}

/** A labelled value and whether it was quoted over lines of its own. */
type Labelled = { readonly lines: readonly string[]; readonly quoted: boolean };

/**
 * One labelled value, quoted over as many lines as it takes (rondo#90).
 *
 * **A value with a newline in it is the whole of what the line shows, so its
 * newlines are the worker's paragraph breaks and not bytes to escape.** This is
 * #68's distinction arriving at the advisory screen: `--prompt-file` exists so
 * that a request can be more than one paragraph (#72), and a request folded
 * through `asciiEscape` reaches the operator as one line of `\n` literals
 * -- 2154 characters of it in the run rondo#90 measured. Broken into its own
 * lines here, nothing rondo hands the seam holds a newline, so the `say` above
 * still escapes a line at a time and D-0004 is unmoved.
 *
 * {@link legibleAsciiEscape} is applied *here* rather than left to the seam
 * because the seam cannot tell a quoted value from a value folded into a line
 * rondo composed, and the two want opposite answers. It is safe to apply twice:
 * its output is printable ASCII, which `asciiEscape` passes through unchanged.
 *
 * The short single-line case keeps its exact shape -- `  label: value` -- so a
 * claim that always fitted still reads the way it did.
 */
function labelled(label: string, value: string): Labelled {
  // **Escaped first and wrapped second**, because the column is measured in
  // what is printed: an escape is six characters where the value had one, and
  // wrapping the unescaped text would put lines over the column exactly where
  // the value was hardest to read.
  const paragraphs = legibleAsciiEscape(value).split("\n");
  const first = paragraphs[0] ?? "";
  if (paragraphs.length === 1 && first.length <= QUOTED_WIDTH) {
    return { lines: [`  ${label}: ${first}`], quoted: false };
  }
  // The size is the row's own, counted in the characters it holds rather than
  // in the ones the escaping spelled them with.
  const size =
    paragraphs.length === 1
      ? `${String(value.length)} characters`
      : `${String(paragraphs.length)} lines, ${String(value.length)} characters`;
  return {
    lines: [
      `  ${label}: ${size}, quoted in full:`,
      // **The quotation is marked on every line of it.** What is quoted here is
      // a worker's own prose, and a line of it that began with two spaces and a
      // colon would otherwise read as a claim of rondo's own.
      ...paragraphs.flatMap(wrapped).map((line) => (line === "" ? "    |" : `    | ${line}`)),
    ],
    quoted: true,
  };
}

/**
 * One claim, its value, and the basis under it.
 *
 * `sharedPointers` is the pointers this screen cites once below rather than
 * under each claim (rondo#91); every claim still carries its basis, because
 * D-0037 requires it -- what the shared ones carry is the locator and a pointer
 * to where the material it names is printed.
 */
function claimLines(
  claim: Claim,
  snapshot: object,
  sharedPointers: readonly string[] = [],
): readonly string[] {
  const shown = labelled(claim.label, claim.value);
  return [
    ...shown.lines,
    `      basis: ${claimBasis(claim, snapshot, shown.quoted, sharedPointers)}`,
  ];
}

/**
 * The basis line under one claim, which is {@link basisLine} except where the
 * material it names is already on the screen.
 *
 * **Two ways it can already be there, and both of them are a repetition
 * rondo#90 and rondo#91 measured.** The claim's own value, quoted above in
 * full, does not want a 200-character prefix of itself printed under it; and a
 * pointer several claims rest on does not want its whole document printed once
 * per claim. Neither case drops the basis -- the locator is what a basis *is*
 * (D-0032 rule 2) -- and both say where the material went.
 */
function claimBasis(
  claim: Claim,
  snapshot: object,
  quoted: boolean,
  sharedPointers: readonly string[],
): string {
  if (claim.basis.form !== "snapshot") {
    return basisLine(claim.basis, snapshot);
  }
  const pointer = claim.basis.pointer;
  if (sharedPointers.includes(pointer)) {
    return `snapshot ${pointer} (cited once below)`;
  }
  // Compared against what the pointer resolves to rather than against the
  // citation, which is truncated: two values whose first 200 characters agree
  // are not the same value, and saying they were would be the citation
  // claiming more than it checked.
  return quoted && resolved(snapshot, pointer) === claim.value
    ? `snapshot ${pointer} = the value quoted above, in full`
    : basisLine(claim.basis, snapshot);
}

/**
 * The pointers more than one of these claims rests on, in the order the claims
 * first cite them (rondo#91).
 */
function sharedSnapshotPointers(claims: readonly Claim[]): readonly string[] {
  const counted = new Map<string, number>();
  for (const claim of claims) {
    if (claim.basis.form === "snapshot") {
      counted.set(claim.basis.pointer, (counted.get(claim.basis.pointer) ?? 0) + 1);
    }
  }
  return [...counted].filter(([, times]) => times > 1).map(([pointer]) => pointer);
}

/**
 * The material several claims share, cited once, with the claims that rest on
 * it named (rondo#91).
 *
 * **The citation is what moved, not the basis.** `rondo between` printed the
 * whole `/laps` snapshot under each of three claims that rest on it -- 3104
 * characters, three times, in the run rondo#91 measured -- which pushed the
 * three facts apart and buried them in a repeated citation of one document.
 * Naming the claims here is what keeps the citation a citation: a block of
 * material with nothing resting on it would be a document the screen printed
 * for its own sake.
 */
function citedOnceLines(
  claims: readonly Claim[],
  snapshot: object,
  sharedPointers: readonly string[],
): readonly string[] {
  if (sharedPointers.length === 0) {
    return [];
  }
  return [
    "  cited once, because more than one claim above rests on it:",
    ...sharedPointers.flatMap((pointer) => {
      const resting = claims
        .filter((claim) => claim.basis.form === "snapshot" && claim.basis.pointer === pointer)
        .map((claim) => `'${claim.label}'`);
      return [
        `    snapshot ${pointer} = ${cited(snapshot, pointer)}`,
        `        ${String(resting.length)} claims rest on it: ${resting.join(", ")}`,
      ];
    }),
  ];
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
 * into a run is `admit()`, which this module reaches only through
 * {@link approvedRetry} -- and then only against an approval, and only to hand
 * the plan back to a caller that has one.
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
    // of each option is the contract digest an approval names, and approving
    // records that digest and nothing else: what starts the retry is a second
    // verb, which recomposes the contract before it runs anything.
    "  approving one of these records that you approved its contract. 'rondo retry' is what",
    "  spends it, and it refuses unless the contract still composes to what you approved.",
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
      /**
       * The agent-type input each candidate was issued from, aligned to
       * `candidates` by index.
       *
       * Carried for {@link approvedRetry} alone, which needs the *input* and
       * not the record: what admits a retry is a plan, and the digest a person
       * approved names the input that composes it. Not stored anywhere -- the
       * snapshot keeps cadenza's own lists, which is what an operator judged.
       */
      readonly inputs: readonly AgentTypeInput[];
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
  const issuedFrom: AgentTypeInput[] = [];
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
    issuedFrom.push(input);
  }
  return {
    kind: "gathered",
    candidates,
    contracts,
    inputs: issuedFrom,
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

/** What recording one drafted proposal did, or the first reason it did not. */
type RecordOutcome =
  | { readonly kind: "recorded" }
  | { readonly kind: "refused"; readonly reason: string };

/**
 * Write one drafted proposal and every contract behind it, in that order.
 *
 * **Lifted out of {@link proposeRetry} so that the unprompted door writes the
 * same rows** (`D-0043` rule 9): the two writers, their order and their
 * refusals are the half of `D-0022` rule 18 that is about the ledger, and the
 * half that is about a screen -- the `present` call and the attention row --
 * stays with the door that has a screen. Two copies of the order would be two
 * places it can drift, and a drift here is a contract an operator approves that
 * the ledger does not hold.
 */
async function recordDraft(
  ports: ProposePorts,
  kind: ProposableKind,
  subject: IterationRecord,
  drafted: Drafted,
  proposalId: string,
  createdAtMs: number,
): Promise<RecordOutcome> {
  const { proposal, snapshot, contracts } = drafted;
  const iterationId = subject.id;
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
    supersedesIterationId: subject.supersedesIterationId,
    supersedesProposalId: null,
    // **What the retry is measured against.** These two say what a diff or a
    // widening is *against*, and here there is one: the plan and the contract
    // the subject actually ran under.
    predecessorPlanDigest: subject.planDigest,
    predecessorContractDigest: subject.contractDigest,
    agentTypeDigest: subject.agentTypeDigest,
    configDigest: subject.configDigest,
    contractDigest: subject.contractDigest,
    continuoRevision: subject.continuoRevision,
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
  return { kind: "recorded" };
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
 * **What this does not do.** It does not consume anything: an approval of what
 * this records is spent by {@link approvedRetry} and `admit()`, in the store's
 * own transaction, and the chain #41 §3 draws -- observation, elevation,
 * proposal, approval, contract -- reaches its contract there rather than
 * here.
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
  const { proposal, snapshot } = draft.drafted;
  const createdAtMs = ports.now();
  const proposalId = `${kind}-${successorId}-${String(createdAtMs)}`;
  const written = await recordDraft(
    ports,
    kind,
    subject.record,
    draft.drafted,
    proposalId,
    createdAtMs,
  );
  if (written.kind === "refused") {
    return written;
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
 * **That `approved` names a `composition` row of this proposal is checked, and
 * checked there too** (D-0049 rule 2). The entry that decided it kept D-0032
 * rule 12's schema intact -- *"the three CHECKs are the three properties
 * D-0032 fixed and nothing more"* -- so the reference is held by a writer
 * refusal rather than by a fourth CHECK, beside rule 5's and under the same
 * write lock. What that refuses is a digest this proposal never put on a
 * screen; a digest that was on the screen and has since stopped composing is
 * {@link approvedRetry}'s refusal and not this one.
 *
 * **A refusal is a row and not an absence** (D-0032 rule 6): `declined` is
 * written, so *"the operator settled this"* and *"nobody has answered"* stay
 * different facts. Nothing is consumed on either path -- `decision_consumption`
 * is written by the issuance an approval authorises, which is an admission and
 * not an answer ({@link approvedRetry}).
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
 * The successor identity one stored proposal was composed for, or null.
 *
 * Read out of the snapshot rather than re-minted: which identity a person
 * approved a contract *for* is a fact of the row, and minting one again here
 * would answer a different question -- "which identity is free now" -- and
 * would silently move the grantee the digest was issued to.
 */
function storedSuccessorId(proposal: StoredProposal): string | null {
  const successor = (proposal.snapshot as Record<string, unknown>)["successor"];
  const id =
    typeof successor === "object" && successor !== null
      ? (successor as Record<string, unknown>)["iterationId"]
      : undefined;
  return typeof id === "string" ? id : null;
}

/** The plan one approval authorises, with the identities the ledger will need. */
export interface ApprovedRetry {
  readonly decisionId: string;
  readonly proposalId: string;
  /** The iteration the proposal was about, which the retry supersedes (D-0030 rule 1). */
  readonly subjectId: string;
  readonly successorId: string;
  /**
   * The contract **this plan composes**, re-derived here and equal to the
   * digest on the decision row.
   *
   * Equal because it was matched on: the candidate whose digest is the
   * approved one is the candidate this plan came from. It travels to
   * `reserve()` so the store can make the comparison its own -- an equality
   * asserted by the caller that also chose the plan is an equality with nobody
   * on the other side of it.
   */
  readonly contractDigest: string;
  readonly plan: RunPlan;
}

/** What resolving an approval produced, or the first reason it produced nothing. */
export type ApprovedRetryOutcome =
  | { readonly kind: "resolved"; readonly retry: ApprovedRetry }
  | { readonly kind: "refused"; readonly reason: string };

/**
 * Resolve the one unspent approval against a proposal into the plan it
 * authorises (D-0022 rules 9 and 17, D-0043 rule 8).
 *
 * **This is the consumer #107 says is missing**, minus the act: it reads the
 * approval and re-derives, from the material as it stands *now*, the plan whose
 * contract is the one a person approved. What spends the approval is
 * `admit()`, in the store's own transaction, and nothing here writes a row.
 *
 * **Re-derived and not read back** (D-0022 rule 4's habit, `readProposal`'s
 * precedent). The option set is recomposed by the same gatherer that drafted
 * it, over the lineage read again, and the approved digest is matched against
 * what that produces. So a catalog that moved, an agent type whose author
 * changed a key, or a successor identity somebody took in between all end the
 * same way: **no candidate carries the approved digest any more, and nothing
 * runs.** That is D-0043 rule 8's third refusal, and it is a refusal rather
 * than a re-selection because the nearest contract is not the approved one.
 *
 * **One approval, named by the proposal it answers.** A decision id is minted
 * rather than typed, so naming the proposal is what an operator can do from
 * the screen; two unspent approvals against one proposal is refused rather
 * than resolved by order, because choosing between two answers a person gave
 * is composing their answer (D-0009 part 3).
 */
export async function approvedRetry(
  ports: Pick<ExplainPorts, "store" | "record">,
  proposalId: string,
): Promise<ApprovedRetryOutcome> {
  const unspent = (await ports.record.unconsumedDecisions()).filter(
    (row) => row.proposalId === proposalId,
  );
  const decision = unspent[0];
  if (decision === undefined) {
    return {
      kind: "refused",
      reason:
        `No unspent approval names proposal '${proposalId}'. Either nobody has approved it, it ` +
        "was declined, or the approval has already been spent on an admission -- 'rondo inbox' " +
        "lists the approvals that are still spendable.",
    };
  }
  if (unspent.length > 1) {
    // **Read here and not under the reservation's write lock** (`D-0047` rule
    // 6's own scope note). A second approval recorded between this read and
    // `reserve()` is not caught, and what that costs is bounded: the decision
    // spent is one a person took, for a contract that composes, and the other
    // approval stays unspent and still reported. Widening the store to know
    // what ambiguity among a proposal's answers is would be a large change for
    // a race whose worst outcome is acting instead of asking.
    return {
      kind: "refused",
      reason:
        `Proposal '${proposalId}' carries ${String(unspent.length)} unspent approvals, and ` +
        "rondo will not choose between two answers a person gave. Settle them before admitting " +
        "anything under either.",
    };
  }
  const stored = await ports.record.readProposal(proposalId);
  if (stored.kind !== "read") {
    return {
      kind: "refused",
      reason:
        stored.kind === "absent"
          ? `There is no proposal '${proposalId}' in this store, so the approval against it ` +
            "names a contract nothing composed."
          : `Proposal '${proposalId}' will not decode, so the contract its approval names ` +
            `cannot be recomposed: ${stored.reason}`,
    };
  }
  const proposal = stored.proposal;
  const subjectId = proposal.iterationId;
  if (subjectId === null) {
    return {
      kind: "refused",
      reason:
        `Proposal '${proposalId}' is about no iteration, so there is no plan to retry. Only a ` +
        "proposal drafted from an iteration's own material carries one.",
    };
  }
  const successorId = storedSuccessorId(proposal);
  if (successorId === null) {
    return {
      kind: "refused",
      reason:
        `Proposal '${proposalId}' records no successor identity, so the contract its approval ` +
        "names has no grantee rondo can admit under.",
    };
  }
  const subject = await ports.store.read(subjectId);
  if (subject.kind !== "read") {
    return {
      kind: "refused",
      reason:
        subject.kind === "absent"
          ? `Proposal '${proposalId}' is about iteration '${subjectId}', which is not in this ` +
            "store, so the plan a retry would start from cannot be read."
          : `Iteration '${subjectId}' will not decode, so the plan a retry would start from ` +
            `cannot be read: ${subject.reason}`,
    };
  }
  const rows = await lineage(ports, subject.record);
  if ("refusal" in rows) {
    return { kind: "refused", reason: rows.refusal };
  }
  const approved = decision.approved;
  const resolved = retryPlanFor(proposal.kind, subject.record, rows.rows, successorId, approved);
  if ("refusal" in resolved) {
    return { kind: "refused", reason: resolved.refusal };
  }
  return {
    kind: "resolved",
    retry: {
      decisionId: decision.decisionId,
      proposalId,
      subjectId,
      successorId,
      contractDigest: approved,
      plan: resolved.plan,
    },
  };
}

/**
 * The plan behind the approved digest, re-gathered per kind.
 *
 * `run_plan` varies the plan, so the option *is* a lineage row's plan;
 * `agent_type` and `contract_keys` hold the plan fixed and vary the agent-type
 * input, so the option is the subject's plan with that input folded on. The
 * split is the one the drafters already make, read backwards.
 */
function retryPlanFor(
  kind: string,
  subject: IterationRecord,
  rows: readonly IterationRecord[],
  successorId: string,
  approved: string,
): { readonly plan: RunPlan } | { readonly refusal: string } {
  const missing = (): { readonly refusal: string } => ({
    refusal:
      `No option of this proposal composes '${approved}' any more, so the contract that was ` +
      "approved is not one rondo can issue today -- the material behind it moved, or the " +
      `identity '${successorId}' it was issued to is no longer free. Nothing was admitted and ` +
      "the approval was not spent. Propose again against what the store holds now.",
  });
  // **Two options carrying one digest mean the ledger cannot say which was
  // approved, and rondo refuses rather than taking the first.** `run_plan` is
  // where this is reachable: `issueFor` composes a contract from the project,
  // the agent type and the parties, so two plans in one lineage that differ
  // only in their prompt or their base branch reach the same digest, and
  // `gatherRunPlanCandidates` offers both -- unlike the contract gatherer,
  // which folds equal digests into one candidate. `human_decision.approved`
  // names a digest and nothing else, so picking by position would be rondo
  // choosing which instructions a person meant (D-0009 part 3).
  const ambiguous = (count: number): { readonly refusal: string } => ({
    refusal:
      `${String(count)} options of this proposal compose '${approved}', so the approval does not ` +
      "say which of them was taken: a decision names a contract digest, and these plans issue " +
      "one contract between them. Nothing was admitted and the approval was not spent. Propose " +
      "the one you mean against a single iteration.",
  });
  if (kind === "run_plan") {
    const gathered = gatherRunPlanCandidates(rows, successorId);
    if (gathered.kind !== "gathered") {
      return { refusal: gathered.reason };
    }
    const matches = gathered.candidates.filter((row) => row.contractDigest === approved);
    const candidate = matches[0];
    if (candidate === undefined) {
      return missing();
    }
    if (matches.length > 1) {
      return ambiguous(matches.length);
    }
    const row = rows.find((each) => each.id === candidate.iterationId);
    if (row === undefined) {
      // Unreachable: the gatherer enumerates exactly these rows.
      return missing();
    }
    const decoded = readPlan(row.plan);
    return decoded.kind === "planned" ? { plan: decoded.plan } : { refusal: decoded.reason };
  }
  if (kind !== "agent_type" && kind !== "contract_keys") {
    return {
      refusal:
        `Proposal kind '${kind}' binds no plan rondo can admit: an approval of it authorises ` +
        "nothing to start (D-0032 rule 5).",
    };
  }
  const gathered = gatherContractCandidates(kind, subject, rows, successorId);
  if (gathered.kind !== "gathered") {
    return { refusal: gathered.reason };
  }
  const at = gathered.candidates.findIndex((row) => row.contractDigest === approved);
  const input = gathered.inputs[at];
  if (at < 0 || input === undefined) {
    return missing();
  }
  // Unreachable today -- this gatherer folds equal digests into one candidate --
  // and checked anyway, so that the refusal survives the fold being relaxed
  // rather than turning into a silently chosen option.
  if (gathered.candidates.filter((row) => row.contractDigest === approved).length > 1) {
    return ambiguous(2);
  }
  const decoded = readPlan(subject.plan);
  return decoded.kind === "planned"
    ? { plan: { ...decoded.plan, agentTypeInput: input } }
    : { refusal: decoded.reason };
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
  // D-0066 rule 5.1: a split is never approved per split, so it is not in the
  // approvable set and `foreclosureLines` never reaches this entry -- the
  // store refuses a decision naming one. Empty, for `explanation`'s reason.
  split: [],
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
    "  Approving starts nothing by itself: 'rondo retry --proposal-id' is the admission that",
    "  reads this decision, and it spends it only if the plan still composes what you approved.",
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

/**
 * A value, encoded so that equal values encode equally regardless of the key
 * order either side happened to build it in.
 *
 * **Not `JSON.stringify`**, because the stored side is bytes read back out of
 * the row and the re-gathered side is an object this module just built, and
 * nothing promises the two construct their keys in the same order for what is
 * otherwise one identical value -- codex's own finding, over `regatherPayload`
 * building a `SnapshotReading` in a field order that need not match the
 * store's. `canonicalJson` is the encoding the store itself digests proposals
 * by, so two equal values are guaranteed to encode equally rather than merely
 * expected to.
 */
function stableJson(value: unknown): string {
  // `canonicalJson` refuses `undefined` (D-0019 rule 4's own encoder, whose job
  // is a plan that must round-trip): a field one side has and the other does
  // not is malformed input rather than a value, but this reader has to stay
  // total over whatever a corrupted row holds, so it is a sentinel and not a
  // throw. No real `canonicalJson` output starts with `\u0000`.
  return value === undefined ? "\u0000undefined" : canonicalJson(value as JsonValue);
}

function recordDifferences(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  ignoreKeys: ReadonlySet<string> = new Set(),
): readonly string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const diffs: string[] = [];
  for (const key of keys) {
    if (ignoreKeys.has(key)) {
      continue;
    }
    if (stableJson(before[key]) !== stableJson(after[key])) {
      diffs.push(`${key}: ${renderValue(before[key])} -> ${renderValue(after[key])}`);
    }
  }
  return diffs;
}

/**
 * Two records of the same identity, compared field by field (`D-0038` rule 1).
 *
 * `ignoreKeys` exists for rule 5's fourth edge alone: a `contractDigest` is a
 * function of the cadenza pin (`issueFor`), so once the pin line has already
 * said the pin moved, comparing that field again on every candidate would
 * report the same one fact as though each candidate had moved independently
 * -- exactly what rule 5 refuses. Every other field still compares normally,
 * so material movement underneath a pin move is not hidden by it.
 */
function compareRecords(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  ignoreKeys?: ReadonlySet<string>,
): Freshness {
  const diffs = recordDifferences(before, after, ignoreKeys);
  return diffs.length === 0
    ? { verdict: "unmoved", detail: null }
    : { verdict: "moved", detail: diffs.join("; ") };
}

/**
 * The record one pointer sits in, per `D-0038` rule 1: an array element by its
 * own identity for a pointer into a record inside an array, the whole array
 * for a pointer at the array itself (`propose()`'s `/readings`, cited exactly
 * when there is no reading to point an element at), or the top-level record
 * for a pointer into one.
 *
 * Untyped on purpose: the same logic has to walk both the stored snapshot and
 * the re-gathered document, and typing this to any one snapshot shape would
 * leave it unable to walk the other two.
 */
type Container =
  | {
      readonly kind: "record";
      readonly top: string;
      readonly identity: string | null;
      readonly record: Record<string, unknown>;
    }
  | { readonly kind: "wholeArray"; readonly top: string; readonly array: readonly unknown[] };

function containerOf(document: Record<string, unknown>, pointer: string): Container | null {
  const segments = pointer.split("/").slice(1);
  const top = segments[0];
  if (top === undefined) {
    return null;
  }
  const value = document[top];
  if (Array.isArray(value)) {
    if (segments.length === 1) {
      return { kind: "wholeArray", top, array: value };
    }
    const index = segments[1];
    if (index === undefined || !/^(0|[1-9]\d*)$/.test(index)) {
      return null;
    }
    const at = Number(index);
    const element = value[at];
    if (typeof element !== "object" || element === null) {
      return null;
    }
    return { kind: "record", top, identity: identityOf(top, value, at), record: element };
  }
  if (typeof value !== "object" || value === null) {
    return null;
  }
  return { kind: "record", top, identity: null, record: value as Record<string, unknown> };
}

/**
 * The identity the record at `array[at]` is matched by, never its index
 * (`D-0038` rule 2): a candidate set is enumerated and de-duplicated by the
 * gatherer, so candidate N today need not be candidate N at composition.
 *
 * **A reading's identity is what it says (`D-0051` rule 1), never where it
 * sits.** `lap_reading` has no writer that updates a row, so a reading's
 * content cannot change while remaining the same row -- content is a stable
 * identity for it. The ordinal is used only among siblings whose canonical
 * content is otherwise identical, and it comes out order-invariant for free:
 * it counts a multiset match rather than a position.
 */
function identityOf(top: string, array: readonly unknown[], at: number): string {
  const value = array[at];
  if (typeof value !== "object" || value === null) {
    return "";
  }
  const record = value as Record<string, unknown>;
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
    return "";
  }
  if (top === "readings" && typeof record["drafter"] === "string") {
    const content = stableJson(record);
    let occurrence = 0;
    for (let i = 0; i < at; i++) {
      if (stableJson(array[i]) === content) {
        occurrence += 1;
      }
    }
    return `${content}#${String(occurrence)}`;
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
  for (let at = 0; at < value.length; at++) {
    const element = value[at];
    if (
      typeof element === "object" &&
      element !== null &&
      identityOf(container.top, value, at) === container.identity
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
  /** Whether the current cadenza pin differs from the one that composed this row (rule 5's fourth edge). */
  readonly pinDiffers: boolean;
}

/** Fields a `contractDigest` compare ignores once the pin line has already said the pin moved. */
const PIN_MOVED_IGNORES: ReadonlySet<string> = new Set(["contractDigest"]);

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
  if (container.kind === "wholeArray") {
    // `propose()`'s `/readings`: cited exactly when there was nothing to point
    // an element at, so what is compared is the collection itself rather than
    // a record inside it.
    const fresh = ctx.regathered.document[container.top];
    if (!Array.isArray(fresh)) {
      return undetermined("rondo does not know how to compare the record this citation names");
    }
    return stableJson(container.array) === stableJson(fresh)
      ? { verdict: "unmoved", detail: null }
      : {
          verdict: "moved",
          detail: `${String(container.array.length)} at composition, ${String(fresh.length)} now`,
        };
  }
  const fresh = matchingRecord(ctx.regathered.document, container);
  if (fresh === null) {
    // Rule 5's first edge: the strongest signal rondo can observe.
    return { verdict: "moved", detail: "no longer present in what rondo reads now" };
  }
  return compareRecords(
    container.record,
    fresh,
    container.top === "candidates" && ctx.pinDiffers ? PIN_MOVED_IGNORES : undefined,
  );
}

/**
 * One basis's freshness, exhaustive over {@link Basis}'s six forms
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
  // Append-only (D-0061 rule 3) means an existing message cannot move, not that
  // the one cited exists, and nothing here reads the thread yet.
  message: () =>
    undetermined("rondo has no reader for a thread message yet, so it cannot confirm this one"),
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
  const successorId = storedSuccessorId(proposal);
  if (successorId === null) {
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
  /** `D-0051` rule 5's count line, said once, for `explanation` proposals whose reading count changed. */
  readonly readingCountLine: string | null;
}

/**
 * `D-0051` rule 5: the one reading movement the store can produce is the set
 * gaining a member, said once as a count rather than through any one basis.
 * `explanation` proposals only -- `regatherPayload` is the only kind whose
 * document carries a `readings` array at all -- and only when the count
 * actually differs, so an unchanged set says nothing extra.
 */
function readingCountLine(proposal: StoredProposal, regathered: RegatherOutcome): string | null {
  if (proposal.kind !== "explanation" || regathered.kind !== "regathered") {
    return null;
  }
  const stored = (proposal.snapshot as Record<string, unknown>)["readings"];
  const fresh = regathered.document["readings"];
  if (!Array.isArray(stored) || !Array.isArray(fresh) || stored.length === fresh.length) {
    return null;
  }
  return `${String(stored.length)} readings at composition, ${String(fresh.length)} now`;
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
    return {
      subject: whole,
      perBasis: items.map(() => whole),
      pinLine: null,
      readingCountLine: null,
    };
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
  const pinDiffers =
    proposal.cadenzaRevision !== null && proposal.cadenzaRevision !== ports.cadenzaRevision;
  const ctx: FreshnessContext = {
    storedSnapshot: proposal.snapshot as Record<string, unknown>,
    subjectId: proposal.iterationId,
    subjectVerdict,
    regathered,
    pinDiffers,
  };
  const perBasis = items.map((item) => BASIS_FRESHNESS[item.basis.form](item.basis, ctx));

  const pinLine = pinDiffers
    ? `cadenza pin moved: this proposal's contracts were composed under '${proposal.cadenzaRevision}', ` +
      `and rondo is running '${ports.cadenzaRevision}'`
    : null;

  return {
    subject: subjectVerdict,
    perBasis,
    pinLine,
    readingCountLine: readingCountLine(proposal, regathered),
  };
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
 * basis on `agent_type` or `contract_keys` rests on it at all. `D-0051` rule
 * 5's reading count line follows, when there is one.
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
    ...(freshness.readingCountLine === null ? [] : [`  ${freshness.readingCountLine}`]),
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
        // **{@link claimLines}, and not a second spelling of it.** A stored
        // explanation is the same claim on the same terms as the screen that
        // drafted it, and a request quoted over its own lines there and folded
        // into one here would be rondo#90 half-repaired (D-0032 rule 3: the
        // screen is composed from the row at render time, by one renderer).
        ...reading.payload.claims.flatMap((claim, index) => [
          ...claimLines(claim, snapshot),
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

/**
 * Everything the between-laps composition is handed: `explain`'s four ports and
 * the host's own bounds.
 *
 * **The bounds are a parameter for `ProposePorts.cadenzaRevision`'s reason.**
 * They are the operator's policy, read where the environment is readable --
 * which is the command line -- and not a constant this module could invent. A
 * default taken here would report a host as running under bounds nobody set.
 */
export interface HostReadPorts {
  readonly store: Pick<IterationStore, "readLive" | "readingsFor" | "occupancy">;
  readonly record: Pick<AdvisoryRecord, "admissionRefusals">;
  readonly policy: HostPolicy;
}

export interface HostPorts extends ExplainPorts, HostReadPorts {
  readonly store: IterationStore;
  readonly record: AdvisoryRecord;
}

/** The readings of one lap, copied into the snapshot shape. */
function snapshotReadings(readings: readonly LapReading[]): readonly SnapshotReading[] {
  return readings.map((reading) => ({
    drafter: reading.drafter,
    verdict: reading.verdict,
    findings: [...reading.findings],
    unavailableReason: reading.unavailableReason,
  }));
}

/**
 * Every live lap, its readings, the bounds and the refusals, copied field by
 * field into the snapshot shape (D-0037 rule 1, the gathering D-0022 rule 2
 * assigns to this layer).
 *
 * **The iteration half is {@link snapshotIteration}**, the same function the
 * per-lap gather uses, which is what makes `/laps/3/iteration/status` resolve
 * to the same document `explain` would have shown for that lap alone.
 *
 * **The base branch is read out of the persisted plan and the plan is not
 * copied** (rule 1): what rule 3a claims rests on the base branch alone. A plan
 * that will not decode leaves it null, which the drafter renders as
 * `undetermined` rather than as a lap quietly missing from the grouping.
 *
 * **The occupancies come from the store rather than from the rows just read**,
 * because `maxOccupying` and `maxLive` are defined over the generated columns
 * (D-0023 rule 8) and a live row that will not decode has no status this layer
 * could classify.
 */
export async function gatherHost(ports: HostReadPorts): Promise<HostSnapshot> {
  const live = await ports.store.readLive();
  const laps: SnapshotLap[] = [];
  const unreadable: HostSnapshot["unreadable"][number][] = [];
  for (const outcome of live) {
    if (outcome.kind !== "read") {
      // **A live row that will not decode is in the snapshot rather than
      // missing from it**, which is the inbox's rule applied where a family
      // would otherwise be quietly short: it holds a slot, so a composition
      // that dropped it would be wrong about what is running in exactly the
      // case that needs a person.
      if (outcome.kind === "unreadable") {
        unreadable.push({ id: outcome.id, reason: outcome.reason });
      }
      continue;
    }
    const record = outcome.record;
    const plan = readPlan(record.plan);
    laps.push({
      iteration: snapshotIteration(record),
      runId: record.runId,
      topicBranch: record.topicBranch,
      workspace: record.workspace,
      baseBranch: plan.kind === "planned" ? plan.plan.baseBranch : null,
      readings: snapshotReadings(await ports.store.readingsFor(record.id)),
    });
  }
  const occupancy = await ports.store.occupancy();
  return {
    laps,
    unreadable,
    bounds: {
      maxOccupying: ports.policy.maxOccupying,
      maxLive: ports.policy.maxLive,
      occupying: occupancy.occupying,
      live: occupancy.live,
    },
    refusals: await ports.record.admissionRefusals(),
  };
}

/**
 * The between-laps composition as an operator reads it, composed at render
 * time (D-0032 rule 3).
 *
 * **The line about adjacency is here and not in a claim's label**, because it
 * is a property of the whole family rather than of any one of its claims:
 * D-0037's own falsifier is *"an adjacency claim an operator acts on as though
 * it were a collision"*, and the place that fails is the screen. What rondo can
 * observe is that two laps are open against one base branch; a collision inside
 * the work needs a reader across branches nothing in rondo has.
 *
 * **The families of this composition rest on one another's material, so the
 * shared part is cited once** (rondo#91). `live laps` and the two families that
 * found nothing all rest on `/laps`, and the whole snapshot of the live laps
 * printed under each of them is the same document three times -- the three
 * facts differ and their basis does not. Each claim still carries its basis,
 * which is what D-0037 requires; what it carries is the locator, and the
 * material it names is below with the claims that rest on it named beside it.
 */
export function hostLines(proposal: Explanation, snapshot: HostSnapshot): readonly string[] {
  const claims = proposal.payload.claims;
  const shared = sharedSnapshotPointers(claims);
  return [
    "what spans the live laps",
    `  drafter: ${DETERMINISTIC_DRAFTER}; derivation: ${proposal.derivation}`,
    "  this explanation binds nothing: it is not a proposal and cannot be approved",
    "  an adjacency is not a collision: rondo de-conflicts only the identifiers it mints, so " +
      "two laps open against one base branch is where to look and not what was found",
    ...claims.flatMap((claim) => claimLines(claim, snapshot, shared)),
    ...citedOnceLines(claims, snapshot, shared),
  ];
}

/**
 * Compose what spans every live lap: gather, compose, record, render, count.
 *
 * **`explain`'s order, for `explain`'s reason** (D-0037 rule 4): the proposal is
 * recorded with its snapshot verbatim before anything reaches the screen, so a
 * composition whose recording failed is a refusal rather than a framing the
 * ledger does not hold; the presentation is counted after it was shown, so
 * *presented* is a claim about something that has already reached the screen.
 *
 * **It is run when an operator asks, and by nothing else.** There is no
 * schedule, no daemon and no second loop: deciding *when* a person is
 * interrupted is the authority `D-0033` refused, and it is the same authority
 * whether it arrives through a component or through a timer.
 *
 * **It withholds nothing** (rule 5). Every live lap enters the snapshot: no
 * cap, no paging, no *"top ten"*. If a host-wide snapshot ever has to be
 * bounded for size, that bound is a withholding under a rule the operator named
 * and writes `withheld` rows -- not a number chosen inside this function.
 */
export async function composeBetweenLaps(ports: HostPorts): Promise<ExplainOutcome> {
  const snapshot = await gatherHost(ports);
  const proposal = proposeHost(snapshot);
  const createdAtMs = ports.now();
  // Clock-derived, on `explain`'s terms: two compositions in one millisecond
  // carry the same bytes, so the primary key collides exactly when the second
  // row would have said what the first one says.
  const proposalId = `between-${String(createdAtMs)}`;
  const draft: ProposalDraft = {
    proposalId,
    kind: "explanation",
    drafter: DETERMINISTIC_DRAFTER,
    payload: payloadDocument(proposal.payload),
    snapshot: snapshotDocument(snapshot),
    derivation: proposal.derivation,
    // **Null, and it is the one field that says what kind of subject this is.**
    // A between-laps composition is about the laps between which it sits and
    // about no single row; naming one of them here would make the row read as
    // an explanation of that lap, which is a different and narrower claim.
    iterationId: null,
    supersedesIterationId: null,
    supersedesProposalId: null,
    predecessorPlanDigest: null,
    predecessorContractDigest: null,
    // The three digests describe *one* row's classification, and this proposal
    // is about no one row. Filling them from an arbitrary lap would be a
    // citation of material the claims do not rest on.
    agentTypeDigest: null,
    configDigest: null,
    contractDigest: null,
    continuoRevision: null,
    cadenzaRevision: null,
    elevatedFromMessageId: null,
    elevatedByActorId: null,
    createdAtMs,
  };
  const recorded = await ports.record.recordProposal(draft);
  if (recorded.kind !== "recorded") {
    return {
      kind: "refused",
      reason:
        `The between-laps composition was composed and not recorded, so it is not being ` +
        `shown: ${recorded.reason}. A framing an operator reads and the ledger does not hold ` +
        "is the thing the record exists to prevent.",
    };
  }
  ports.present(hostLines(proposal, snapshot));
  const counted = await ports.record.recordAttention({
    atMs: createdAtMs,
    subjectKind: PROPOSAL_SUBJECT,
    subjectId: proposalId,
    disposition: "presented",
    // Null because this verb withholds nothing: every live lap entered the
    // snapshot and every family was emitted, so there is no policy to name
    // (D-0037 rule 5).
    ruleName: null,
  });
  return counted.kind === "recorded"
    ? { kind: "explained", proposalId }
    : { kind: "presentedUncounted", proposalId, reason: counted.reason };
}

// --- the unprompted door (D-0043) --------------------------------------------

/**
 * The ports the unprompted door takes, or the reason it has none.
 *
 * **The composition root has to be able to say "not this time" without
 * refusing the lap** (`D-0043` rule 11). The one input this door needs that a
 * lap does not is the cadenza pin, and it is read from a file: a pin that will
 * not read must not turn an admission that would otherwise have run into a
 * refusal, and it must not be papered over with an empty string either, because
 * `composition.cadenza_revision` is what says which cadenza composed the
 * contract a person may later approve. So the absence is a value, it carries
 * its own sentence, and the sentence reaches the report.
 */
export type UnpromptedPorts = ProposePorts | { readonly unavailable: string };

/** What the unprompted door did, or why it did nothing. */
export type UnpromptedOutcome =
  | {
      readonly kind: "proposed";
      readonly proposalId: string;
      readonly successorId: string;
      readonly options: number;
    }
  | { readonly kind: "silent"; readonly reason: string };

/** The suffix this door mints, and the one it strips so a chain does not grow its own name. */
const RETRY_SUFFIX = /-r[0-9]+$/;

/** The largest retry index this door will mint (`D-0043` rule 6). */
const LAST_RETRY_INDEX = 99;

/**
 * Mint the identity a retry would run as, by derivation from the subject's own
 * (`D-0043` rule 6).
 *
 * **Derived and not invented, which is what keeps `D-0019` rule 3 intact.**
 * What is minted here is a *candidate*: `admit()` still takes its iteration id
 * from its caller, and this value becomes an identifier only when a person
 * approves the digest composed under it. The base is the subject's id with a
 * trailing `-r<n>` removed, so a retry of a retry is `-r3` and not `-r2-r2` --
 * a name that grew a segment per attempt would run into the alphabet's own
 * bound after a handful of them, and would stop being readable well before
 * that.
 *
 * **Two refusals, and neither one truncates a name to make it fit.** An id that
 * cannot pass {@link ITERATION_ID_PATTERN} is one `allocate()` would refuse at
 * the far end, and an id shortened to pass it is a different iteration's name.
 */
async function mintSuccessorId(
  store: IterationStore,
  subjectId: string,
): Promise<{ readonly id: string } | { readonly refusal: string }> {
  const base = subjectId.replace(RETRY_SUFFIX, "");
  for (let index = 2; index <= LAST_RETRY_INDEX; index += 1) {
    const candidate = `${base}-r${String(index)}`;
    if (!ITERATION_ID_PATTERN.test(candidate)) {
      return {
        refusal:
          `the identity a retry would run as, '${candidate}', is not a rondo identifier, and ` +
          "rondo does not shorten a name to make one fit",
      };
    }
    // Anything but `absent` is taken: an id that will not decode is still a
    // primary key this store holds, and admitting under it is impossible.
    const held = await store.read(candidate);
    if (held.kind === "absent") {
      return { id: candidate };
    }
  }
  return {
    refusal:
      `every identity from '${base}-r2' to '${base}-r${String(LAST_RETRY_INDEX)}' is already in ` +
      "this store",
  };
}

/**
 * Propose what a retry could run under, with nobody having asked (`D-0043`).
 *
 * **The door the lap's own path reaches, and the four differences from
 * {@link proposeRetry} are the whole of it.** The successor's identity is
 * minted rather than typed (rule 6); the kind is fixed at `contract_keys`,
 * because it is the only one whose alternatives do not come from a lineage the
 * subject of a first stop does not have (rule 4); nothing is recorded when the
 * only candidate is the contract the subject already ran under, since an option
 * set of one is not a choice (rule 5); and **nothing is presented and no
 * attention row is written** (rule 9) -- `D-0042` settled that a presentation is
 * a person's act, and here there is not even a rendering, so a `presented` row
 * would be a claim about nobody.
 *
 * **Every ending is a value and none is an exception.** The caller is a
 * conductor verb that has already committed a terminal transition, and rule 11
 * is that nothing here may change what that transition decided: what this door
 * could not do comes back as a sentence for the report.
 */
export async function proposeAfterAbandon(
  ports: UnpromptedPorts,
  iterationId: string,
): Promise<UnpromptedOutcome> {
  const silent = (reason: string): UnpromptedOutcome => ({
    kind: "silent",
    reason: `No retry was proposed for '${iterationId}': ${reason}.`,
  });
  if ("unavailable" in ports) {
    return silent(ports.unavailable);
  }
  const subject = await ports.store.read(iterationId);
  if (subject.kind !== "read") {
    return silent(
      subject.kind === "absent"
        ? "the row this admission just wrote is not in the store"
        : `the row this admission just wrote will not decode: ${subject.reason}`,
    );
  }
  const minted = await mintSuccessorId(ports.store, iterationId);
  if ("refusal" in minted) {
    return silent(`${minted.refusal}. Name one with 'rondo propose --successor-id'`);
  }
  const rows = await lineage(ports, subject.record);
  if ("refusal" in rows) {
    return silent(rows.refusal);
  }
  const draft = draftContracts("contract_keys", subject.record, rows.rows, minted.id);
  if (draft.kind !== "drafted") {
    return silent(draft.reason);
  }
  const options = draft.drafted.proposal.payload.options;
  if (options.length < 2) {
    // Rule 5. `promotionsOf` offers the subject's own contract plus one option
    // per key its agent type declared askable, so a set of one means the author
    // offered none -- there is nothing to widen, and a proposal saying "run it
    // again exactly as it ran" is a row nobody can answer.
    return silent(
      "the agent type it ran under declares no askable key, so the only candidate is the " +
        "contract it already ran under",
    );
  }
  // **Derived from the subject, and carrying no clock** (rule 10), unlike the
  // operator door's id one line of this file away. A second attempt about the
  // same subject composes the same id and collides on the proposal table's
  // primary key, which is the whole of the idempotence this needs: the store
  // refuses the duplicate rather than this function remembering anything.
  //
  // **The subject and not the successor**, because a successor identity is not
  // unique to one subject: `job` and `job-r1` both mint `job-r2` while that
  // name is free, and an id naming only the minted successor would have let the
  // first of them silently suppress the second's proposal. The subject is the
  // thing this door proposes about, and it proposes about one subject once.
  const proposalId = `contract_keys-${iterationId}`;
  const written = await recordDraft(
    ports,
    "contract_keys",
    subject.record,
    draft.drafted,
    proposalId,
    ports.now(),
  );
  if (written.kind === "refused") {
    return silent(written.reason);
  }
  return {
    kind: "proposed",
    proposalId,
    successorId: minted.id,
    options: options.length,
  };
}
