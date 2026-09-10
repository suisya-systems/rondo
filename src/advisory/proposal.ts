/**
 * The advisory layer: candidate material, and no authority at all (D-0022
 * rules 1 and 2).
 *
 * **This layer exists to remove reach, which is why it is a layer.** Its
 * internal allowance is `["src/advisory", "src/store"]` and it is absent from
 * the external table, so it cannot import cadenza, cannot import continuo,
 * cannot reach the loop, and cannot open a file, a socket or a process. That is
 * D-0022 rule 1's whole argument: internals are granted per layer and externals
 * per module, so "this one module may not import cadenza while its neighbours
 * may" is a rule the boundary test cannot express, and a component that must
 * never compose a contract has no business sitting in the layer that may.
 *
 * **`propose` is total and pure over the snapshot it is handed** (rule 2).
 * Gathering is the composition root's; a function that returns a value cannot
 * issue one, which is how "expresses no authority" becomes a type rather than a
 * discipline. The cost is named rather than hidden: a snapshot missing a field
 * shows up as a worse proposal rather than as a refusal, and the answer to that
 * is {@link UNDETERMINED} -- a claim the snapshot cannot ground says so, and is
 * never silently dropped.
 *
 * **The vocabulary is "candidate", never "permission"** (D-0022 rule 11,
 * cadenza `D-0031` section 1): `granted` and `askable` are inputs to contract
 * construction, consumed before the contract exists, and never a second answer
 * standing beside one. The check is in `test/advisory/` only, because the word
 * lives in an unrelated capacity message elsewhere in the tree and a tree-wide
 * grep would fail on it for no reason.
 */
import type { JsonRecord } from "../store/records.js";

/**
 * Where a claim or an option rests, as a **locator and never a copy**
 * (D-0032 rule 2).
 *
 * A closed union of five forms, and the closure is the point: an unrecognised
 * form is a row the reader refuses rather than guesses at. `snapshot` is the
 * one that renders inline, because D-0022 rule 4 stores the snapshot **verbatim**
 * beside the proposal -- so the material the advisory actually read is *in the
 * row*, and a pointer into it is neither a copy nor a second source of truth.
 * The other four name material the advisory did not read as a store row, and
 * they render as something an operator opens.
 *
 * **"The basis is prose" is deliberately not a member.** Prose is permitted in
 * a payload only where it travels with its basis; a claim with no basis is the
 * summary #39 measured an operator approving three times in one day.
 */
export type Basis =
  /**
   * A JSON pointer (RFC 6901) into this proposal's own verbatim snapshot.
   *
   * The pointer is into the snapshot **as persisted**, which is why
   * {@link AdvisorySnapshot} is the document the store holds rather than a view
   * over richer objects: a pointer that addressed a shape nobody kept would be
   * a citation of something unreadable.
   */
  | { readonly form: "snapshot"; readonly pointer: string }
  | { readonly form: "iteration"; readonly iterationId: string }
  | { readonly form: "gateTransition"; readonly gateId: string; readonly transitionSeq: number }
  | { readonly form: "continuoRun"; readonly runId: string }
  | {
      readonly form: "repository";
      readonly path: string;
      readonly commit: string;
      readonly firstLine: number;
      readonly lastLine: number;
    };

/** The five forms of {@link Basis}, written once so a reader can check the union is closed. */
export const BASIS_FORMS = Object.freeze([
  "snapshot",
  "iteration",
  "gateTransition",
  "continuoRun",
  "repository",
] as const satisfies readonly Basis["form"][]);

/**
 * What a claim says when the snapshot does not settle it (D-0032 rule 8).
 *
 * **A value, never an empty field, and never an omitted claim.** An absence and
 * a negative answer must not be the same thing at the only point where either
 * matters -- the precedent is `D-0029` rule 10's `unavailable`, which is a
 * verdict rather than a missing row. A reader who cannot tell "rondo looked and
 * the row is null" from "rondo did not look" has no way to spot-check, and
 * fluency reads as understanding.
 */
export const UNDETERMINED = "undetermined";

/**
 * What a claim says when the snapshot settles it **negatively**.
 *
 * **The distinction {@link UNDETERMINED} would otherwise destroy.** Most nulls
 * in an iteration row mean "not observed yet" -- a row that has not been
 * classified has no digests, and a lap that has not run has no gate. But
 * `supersedesIterationId` is documented in `src/store/records.ts` in exactly the
 * opposite terms: *"Null is not 'unknown', it is 'no predecessor'"*, written
 * once by `reserve()` and by nothing afterwards. Rendering that as
 * `undetermined` would report every first lap as an iteration whose lineage
 * rondo could not establish, which is a worse answer than the one the row
 * actually gives.
 *
 * The rule for which a field takes: **`none` when the store documents the null
 * as a fact, `undetermined` when it documents it as a value not yet written.**
 * A field whose null means neither has not been thought about, and it is worth
 * one sentence here rather than a guess at the screen.
 */
export const ABSENT = "none";

/**
 * One thing an explanation says, and what it rests on.
 *
 * Three fields and no fourth: there is no confidence, no severity and no
 * ordering weight, because every one of those would be the drafter narrating
 * its own material. The order of the claims is the payload's own.
 */
export type Claim = {
  /** What is being said, as the line an operator reads. */
  readonly label: string;
  /** What it says -- or {@link UNDETERMINED}. */
  readonly value: string;
  /** Where it rests. Required: a claim with no basis is a summary. */
  readonly basis: Basis;
};

/**
 * How an `explanation` was derived (D-0032 rule 8), non-null exactly when the
 * kind is `explanation` -- which the schema's own `CHECK` enforces.
 *
 * **The union's members are D-0032's residual**, left to "the entry that admits
 * a model explainer"; what ships here is what the deterministic drafter can
 * honestly claim. A diagram drawn from identifier names and one derived from
 * tests that actually ran render identically, so the attribute is what lets a
 * reader know which they are looking at.
 *
 * **`operator_elevation` is the second member, and it is here because the first
 * one would be a lie.** An elevated proposal's claims are the store's *and* one
 * an operator typed (D-0036 rule 3 property 2); calling that `store_rows` would
 * report the operator's own observation as something rondo read out of the
 * ledger, which is precisely the substitution the attribute exists to prevent.
 */
export const DERIVATIONS = Object.freeze(["store_rows", "operator_elevation"] as const);

export type Derivation = (typeof DERIVATIONS)[number];

/**
 * The iteration row as the snapshot carries it.
 *
 * **A document rather than an {@link import("../store/records.js").IterationRecord},
 * and the reason is D-0032 rule 2.** The snapshot is persisted verbatim and a
 * `snapshot` basis is a pointer into those bytes, so the shape the advisory
 * reads and the shape the store keeps have to be the *same* shape -- otherwise
 * every pointer cites a view that was thrown away. The composition root copies
 * the row into this shape, which is the gathering D-0022 rule 2 assigns it.
 *
 * **It carries what the advisory reads and not the whole row.** The plan is
 * cited by its digest and is not copied here: D-0032 records snapshot size as a
 * residual for "the implementation, which is the first thing that can measure
 * it", and a snapshot holding a thirty-field plan no claim reads would be
 * paying for re-derivability the proposal does not use.
 */
export type SnapshotIteration = {
  readonly id: string;
  readonly status: string;
  readonly request: string;
  readonly planDigest: string;
  readonly attempts: number;
  readonly supersedesIterationId: string | null;
  readonly continuoRevision: string | null;
  readonly agentTypeDigest: string | null;
  readonly configDigest: string | null;
  readonly contractDigest: string | null;
  readonly classification: string | null;
  readonly classificationReason: string | null;
  readonly modelTier: string | null;
  readonly model: string | null;
  readonly gateId: string | null;
  readonly gateStage: string | null;
  readonly gateOutcome: string | null;
  readonly reason: string | null;
};

/** One independent reading of the lap (D-0029), as the snapshot carries it. */
export type SnapshotReading = {
  readonly drafter: string;
  readonly verdict: string;
  readonly findings: readonly string[];
  readonly unavailableReason: string | null;
};

/**
 * The frozen value the composition root gathered (D-0022 rule 2).
 *
 * Declared as a type alias of plain JSON rather than as an interface so that it
 * is assignable to {@link JsonRecord}: the same value the advisory reads is the
 * value the store persists, and a conversion step between them would be a
 * second shape for the thing every `snapshot` basis points into.
 */
export type AdvisorySnapshot = {
  readonly iteration: SnapshotIteration;
  readonly readings: readonly SnapshotReading[];
};

/** The payload of an `explanation`: claims in the order they are read. */
export type ExplanationPayload = {
  readonly claims: readonly Claim[];
};

/**
 * What the advisory returns.
 *
 * **An `explanation` carries claims and no recommendation, and that is a
 * decision rather than an omission.** D-0032 rule 1 says a payload is an
 * ordered option set with exactly one option marked as the recommendation, and
 * rule 5 says an `explanation` binds nothing, ever -- it is not an approvable
 * kind and `recordDecision` refuses an answer that names it. Read together, the
 * option set is the shape of the thing being *approved*: #39's "answerable in
 * one sentence". An explanation has nothing to approve, so a recommendation on
 * one would be the third voice acquiring the grammar of the first, which is the
 * confusion rule 5 and D-0032 rule 8 exist to prevent. rule 2's own wording --
 * *"every claim and every option"* -- is what names the two as different
 * members. So: claims here, options and a recommendation when the approvable
 * kinds arrive.
 *
 * A union of one today. The four approvable kinds of `PROPOSAL_KINDS` join it
 * with their option sets, which is why `kind` is discriminating a union that
 * currently needs no discrimination.
 */
export type Proposal = {
  readonly kind: "explanation";
  readonly derivation: Derivation;
  readonly payload: ExplanationPayload;
};

/** A claim over a null the store documents as a fact rather than as a gap. */
function settled(label: string, value: string | null, pointer: string): Claim {
  return { label, value: value ?? ABSENT, basis: { form: "snapshot", pointer } };
}

/** A claim over a value the snapshot may not hold, pointed at where it would be. */
function claim(label: string, value: string | null, pointer: string): Claim {
  return {
    label,
    // **The null case is a value and not a gap** (D-0032 rule 8). The basis
    // still points at the field, so a reader can follow the pointer into the
    // verbatim snapshot and see the null for themselves rather than taking
    // rondo's word that it looked.
    value: value === null || value === "" ? UNDETERMINED : value,
    basis: { form: "snapshot", pointer },
  };
}

/**
 * What the store holds about one iteration, as claims a person can check.
 *
 * **The honest first cut** (`advisory.md` section 9): read the row handed over
 * and say where the request stands, what plan it ran under, which digests it
 * was classified against and which continuo build drove it. It proposes
 * nothing, so nothing here can be approved -- and that is what makes it the
 * part of the design that is buildable with no surface, no allocator and no
 * successor composer.
 *
 * Total over the snapshot: every claim is emitted for every snapshot, and a
 * field the snapshot does not settle is {@link UNDETERMINED} rather than a
 * claim that quietly went missing. Pure: no clock, no I/O, no randomness, and
 * the same snapshot gives the same bytes -- which is what makes a proposal
 * re-derivable from the snapshot persisted beside it rather than from a world
 * that has since moved.
 */
export function propose(snapshot: AdvisorySnapshot): Proposal {
  const it = snapshot.iteration;
  const claims: Claim[] = [
    claim("request", it.request, "/iteration/request"),
    claim("status", it.status, "/iteration/status"),
    claim("attempts", String(it.attempts), "/iteration/attempts"),
    claim("plan digest", it.planDigest, "/iteration/planDigest"),
    settled("revision of", it.supersedesIterationId, "/iteration/supersedesIterationId"),
    claim("classification", it.classification, "/iteration/classification"),
    claim("classification reason", it.classificationReason, "/iteration/classificationReason"),
    claim("agent type digest", it.agentTypeDigest, "/iteration/agentTypeDigest"),
    claim("config digest", it.configDigest, "/iteration/configDigest"),
    claim("contract digest", it.contractDigest, "/iteration/contractDigest"),
    claim("continuo revision", it.continuoRevision, "/iteration/continuoRevision"),
    claim("model tier", it.modelTier, "/iteration/modelTier"),
    claim("model", it.model, "/iteration/model"),
    claim("gate stage", it.gateStage, "/iteration/gateStage"),
    claim("gate outcome", it.gateOutcome, "/iteration/gateOutcome"),
    claim("reason", it.reason, "/iteration/reason"),
  ];

  // **The gate is cited as a gate and not only as a field.** D-0032 rule 2's
  // `(gate_id, transition_seq)` form is what a later kind uses to cite the
  // answer a person typed; the body itself has one home and this is not it
  // (`A-8`), so what the claim carries is the identifier.
  claims.push(
    it.gateId === null
      ? claim("gate", null, "/iteration/gateId")
      : { label: "gate", value: it.gateId, basis: { form: "iteration", iterationId: it.id } },
  );

  // **An absent reading is a claim rather than a silence.** D-0029 rule 10
  // makes "nothing could be read" a verdict; the same distinction has to
  // survive into the explanation, or a lap whose reading never ran renders
  // exactly like one that was read and found fine.
  if (snapshot.readings.length === 0) {
    claims.push(claim("independent reading", null, "/readings"));
  } else {
    snapshot.readings.forEach((reading, index) => {
      claims.push({
        label: `independent reading (${reading.drafter})`,
        value: reading.verdict,
        basis: { form: "snapshot", pointer: `/readings/${String(index)}/verdict` },
      });
      for (const [finding, at] of reading.findings.map(
        (text, position) => [text, position] as const,
      )) {
        claims.push({
          label: "reading finding",
          value: finding,
          basis: { form: "snapshot", pointer: `/readings/${String(index)}/findings/${String(at)}` },
        });
      }
      if (reading.unavailableReason !== null) {
        claims.push({
          label: "reading unavailable because",
          value: reading.unavailableReason,
          basis: { form: "snapshot", pointer: `/readings/${String(index)}/unavailableReason` },
        });
      }
    });
  }

  return { kind: "explanation", derivation: "store_rows", payload: { claims } };
}

/**
 * What the operator handed over, and what the store holds about the row it is
 * about (#41 section 3).
 *
 * **The observation is a {@link Claim} like every other one, and that is the
 * whole of "what is elevated carries its basis with it".** #41 section 3 names
 * the hazard in its own gesture -- one button, and a thinly-founded observation
 * acquires the appearance of a proposal -- and D-0036 rule 4 says the answer to
 * it is D-0032 rule 2 rather than a new mechanism: a claim's basis is a
 * locator, so an observation resting on nothing is *visibly* resting on
 * nothing. Requiring the operator's line to be a `Claim` is that requirement
 * spelled as a type. There is no member of {@link Basis} that means "the
 * operator said so".
 *
 * **It is prepended rather than appended**, because it is what the elevation is
 * about; the store's claims follow as the context it was made in. Nothing is
 * restated: the claims are {@link propose}'s own, unaltered, which is #39's
 * discipline of pointing at material rather than re-narrating it.
 */
export function proposeElevated(snapshot: AdvisorySnapshot, observation: Claim): Proposal {
  return {
    kind: "explanation",
    derivation: "operator_elevation",
    payload: { claims: [observation, ...propose(snapshot).payload.claims] },
  };
}

/**
 * The snapshot as the store takes it, and the one assertion that keeps the two
 * shapes from drifting.
 *
 * It is the identity function, and that is the whole of its job: if
 * {@link AdvisorySnapshot} ever stops being assignable to {@link JsonRecord} --
 * an interface where a type alias was, a `Date`, a `Map` -- this stops
 * compiling, which is where that mistake should be caught rather than at the
 * insert that silently dropped a field.
 */
export function snapshotDocument(snapshot: AdvisorySnapshot): JsonRecord {
  return snapshot;
}

/**
 * The payload as the store takes it, under the same assertion.
 *
 * The store holds the payload verbatim and never reads into it, so this is the
 * one place the compiler checks that what the advisory composed is something
 * `canonicalJson` can round-trip.
 */
export function payloadDocument(payload: ExplanationPayload): JsonRecord {
  return payload;
}
