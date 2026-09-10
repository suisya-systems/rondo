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
 * One thing an operator may choose, and what it rests on (D-0032 rule 1).
 *
 * The same three fields a {@link Claim} carries, for D-0034 rule 3's reason:
 * rule 2's *"every claim and every option in the payload carries a `basis`"*
 * names the two as different members of a payload and holds them to one rule
 * about where they rest. What differs is what `value` **is**.
 *
 * **On an approvable kind, `value` is the `composition.contract_digest` an
 * approval of this option would name**, and that is not a decoration of the
 * candidate value -- it *is* it. `human_decision.approved` is a reference into
 * the composition table and is non-null exactly on an approval, so an option a
 * person can say yes to is an option that already names the contract they would
 * be saying yes to (D-0022 rule 18: the contract the human was *shown*). An
 * option whose value were a plan digest would leave the operator approving one
 * fact and the ledger recording another.
 */
export type Option = {
  /** What choosing it means, as the line an operator reads. */
  readonly label: string;
  /** The candidate value: on an approvable kind, the digest an approval binds. */
  readonly value: string;
  /** Where it rests. Required, on {@link Claim}'s terms exactly. */
  readonly basis: Basis;
};

/**
 * The payload of an approvable kind: options in order, exactly one recommended.
 *
 * **The recommendation is an index and not a flag on the option**, for the
 * reason D-0032 rule 5 refuses an `approvable` column: a per-option flag can be
 * set on two options or on none, and neither state has an answer -- *"two
 * authorities with no precedence is not stricter, it is unanswerable"*. An
 * index cannot say "both".
 *
 * **`options` is non-empty by construction, and the constructor is the
 * snapshot.** {@link RetrySnapshot.candidates} is a non-empty tuple, so the
 * drafter never faces the case of an option set with nothing in it -- which
 * would be a proposal with a recommendation naming nothing, and the one shape
 * rule 1 cannot be read to permit. Where there is nothing to propose there is
 * no proposal, and the composition root refuses before this function is called.
 *
 * **There is no hole list here, and its absence is D-0022 rule 17 rather than
 * an omission.** Rule 7 permits a proposal about a plan to carry *"an explicit
 * list of the fields it will not fill"*; rule 17 records that a retry starts
 * from the abandoned row's plan, *"so rule 7's holes are filled by the
 * predecessor"*. Every option here is a **selection among persisted plans**,
 * and a persisted plan is one that was admitted -- it carries `workspaceRoot`
 * and every fence root already. The `diff` form of rule 7, which is the one
 * that can leave a field for a person to fill, is not in this cut, and it is
 * what brings the list with it.
 */
export type OptionSetPayload = {
  /** The options in the order they are read. Never empty. */
  readonly options: readonly Option[];
  /** Which one rondo recommends: an index into {@link options}. Exactly one. */
  readonly recommended: number;
};

/**
 * One persisted plan a retry could run under, as the snapshot carries it.
 *
 * **`contractDigest` is composed rather than read off a row, and it is the
 * composition root that composes it** (D-0022 rules 1, 5 and 17): this layer
 * may not import cadenza, and a digest is what the operator approves. It is the
 * digest of the contract *this plan under the successor's identity* would run
 * under -- not the digest the predecessor ran under, which named a run that no
 * longer exists.
 */
export type SnapshotCandidate = {
  /** Whose plan it is: the iteration whose row holds it. */
  readonly iterationId: string;
  /** That iteration's status, so a reader can see what became of the plan. */
  readonly status: string;
  /** The plan's digest, as its row records it. */
  readonly planDigest: string;
  /** The contract the successor would run under with this plan. */
  readonly contractDigest: string;
};

/**
 * The identity the retry would take, derived and never minted here.
 *
 * The iteration id is the operator's (`D-0023`: rondo derives the run id, the
 * topic branch and the workspace from it, and the id itself is *"the one name a
 * person chooses and the only one that is not the host's to mint"*). It is in
 * the snapshot because the contract's grantee is the derived run id, so the
 * digest in every option is a function of this value -- an operator approving a
 * digest is entitled to see the identity that fixed it.
 *
 * **The workspace is not here, and the reason is that it is not a property of
 * the identity alone.** `allocate()` derives it from the id *and* the plan's
 * `workspaceRoot`, so two options over two plans can name two workspaces; the
 * run id and the topic branch come from the id by itself and are the same under
 * every option. What the workspace would be is settled at admission, by the
 * plan that is actually taken.
 */
export type SnapshotSuccessor = {
  readonly iterationId: string;
  readonly runId: string;
  readonly topicBranch: string;
};

/**
 * What the composition root gathered for a `run_plan` proposal.
 *
 * A second snapshot shape rather than a widening of {@link AdvisorySnapshot},
 * and the reason is D-0032 rule 2: a `snapshot` basis is a pointer into **this
 * row's own** snapshot, so the document is per proposal and not per tree. An
 * explanation that carried candidates it never reads would be paying for
 * re-derivability nothing uses, which is the same argument
 * {@link AdvisorySnapshot} makes about the plan.
 */
export type RetrySnapshot = {
  readonly iteration: SnapshotIteration;
  readonly successor: SnapshotSuccessor;
  /** Non-empty: a proposal with nothing to propose is not composed at all. */
  readonly candidates: readonly [SnapshotCandidate, ...SnapshotCandidate[]];
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
 * **`run_plan` is the first of the four approvable kinds to arrive**, and it
 * arrives with the shape D-0034 rule 2 reserved for them: the ordered option
 * set of D-0032 rule 1, with exactly one recommendation. `derivation` is `null`
 * on it -- on every kind but `explanation` -- which is the schema's own
 * `CHECK ((derivation IS NOT NULL) = (kind = 'explanation'))` read from this
 * side, so a payload that could not be recorded cannot be composed either.
 */
export type Proposal = Explanation | RunPlanProposal;

/** The third voice: claims, a derivation, and nothing to approve. */
export type Explanation = {
  readonly kind: "explanation";
  readonly derivation: Derivation;
  readonly payload: ExplanationPayload;
};

/** The first approvable kind: an option set, and no derivation. */
export type RunPlanProposal = {
  readonly kind: "run_plan";
  readonly derivation: null;
  readonly payload: OptionSetPayload;
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
export function propose(snapshot: AdvisorySnapshot): Explanation {
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
export function proposeElevated(snapshot: AdvisorySnapshot, observation: Claim): Explanation {
  return {
    kind: "explanation",
    derivation: "operator_elevation",
    payload: { claims: [observation, ...propose(snapshot).payload.claims] },
  };
}

/**
 * What a retry could run under, as an ordered option set a person can answer.
 *
 * **A selection among persisted plans, which is the first of D-0022 rule 7's
 * three forms.** Every option names a plan some iteration actually ran under;
 * rondo composes no plan here and fills no field, because a plan rondo wrote
 * would be the allocator `D-0019` rule 3 refuses and the framing #39 measures.
 * The alternatives are the ones the store holds -- most often one, when the
 * subject has no predecessor -- and an alternative rondo invented would be a
 * worse answer than a short list.
 *
 * **The recommendation is the subject's own plan** (D-0022 rule 17: a retry
 * *"starts from the abandoned row's plan"*), found by identity rather than by
 * position so that the rule survives a gatherer that orders its candidates
 * differently. Where the subject's own plan is not among the candidates -- a
 * row whose plan will not decode, so the gatherer dropped it -- the first
 * candidate is recommended, because a set with no recommendation is the one
 * shape D-0032 rule 1 does not admit.
 *
 * Total over the snapshot and pure, on {@link propose}'s terms exactly: same
 * bytes in, same bytes out, no clock, no I/O.
 */
export function proposeRetryPlan(snapshot: RetrySnapshot): RunPlanProposal {
  const options = snapshot.candidates.map((candidate, index): Option => {
    const own = candidate.iterationId === snapshot.iteration.id;
    return {
      label:
        `run '${snapshot.successor.iterationId}' under the plan ` +
        `${own ? "this iteration" : `iteration '${candidate.iterationId}'`} ran ` +
        `(status ${candidate.status}, plan ${candidate.planDigest})`,
      // **The digest and not the plan** -- see {@link Option}. It is what
      // `human_decision.approved` will hold, so it is what is on the screen.
      value: candidate.contractDigest,
      basis: { form: "snapshot", pointer: `/candidates/${String(index)}/contractDigest` },
    };
  });
  const own = snapshot.candidates.findIndex(
    (candidate) => candidate.iterationId === snapshot.iteration.id,
  );
  return {
    kind: "run_plan",
    // Null on every kind but `explanation`, which the schema's CHECK enforces
    // and D-0032 rule 8 explains: `derivation` says how an explanation was
    // *derived*, and an option set was composed rather than derived.
    derivation: null,
    payload: { options, recommended: own === -1 ? 0 : own },
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
export function snapshotDocument(snapshot: AdvisorySnapshot | RetrySnapshot): JsonRecord {
  return snapshot;
}

/**
 * The payload as the store takes it, under the same assertion.
 *
 * The store holds the payload verbatim and never reads into it, so this is the
 * one place the compiler checks that what the advisory composed is something
 * `canonicalJson` can round-trip.
 */
export function payloadDocument(payload: ExplanationPayload | OptionSetPayload): JsonRecord {
  return payload;
}
