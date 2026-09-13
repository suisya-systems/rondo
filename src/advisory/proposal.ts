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
    }
  /** A message in the request thread: D-0061 rule 2.6's one addition to the union. */
  | { readonly form: "message"; readonly messageId: string };

/** The six forms of {@link Basis}, written once so a reader can check the union is closed. */
export const BASIS_FORMS = Object.freeze([
  "snapshot",
  "iteration",
  "gateTransition",
  "continuoRun",
  "repository",
  "message",
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
  /** What the lap spent (`D-0046`); null is unread and 0 is zero. */
  readonly lapCostUsd: number | null;
  readonly lapTurns: number | null;
  readonly lapDurationMs: number | null;
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
export type Proposal = Explanation | RunPlanProposal | AgentTypeProposal | ContractKeysProposal;

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

/** Which agent type the retry runs under -- the widening D-0022 rule 17 names. */
export type AgentTypeProposal = {
  readonly kind: "agent_type";
  readonly derivation: null;
  readonly payload: OptionSetPayload;
};

/** Which capability keys that agent type carries as granted rather than askable. */
export type ContractKeysProposal = {
  readonly kind: "contract_keys";
  readonly derivation: null;
  readonly payload: OptionSetPayload;
};

/** A claim over a null the store documents as a fact rather than as a gap. */
function settled(label: string, value: string | null, pointer: string): Claim {
  return { label, value: value ?? ABSENT, basis: { form: "snapshot", pointer } };
}

/**
 * A claim over a number the snapshot may not hold (`D-0046`).
 *
 * `String(0)` is `'0'`, which {@link claim} would keep as a value -- but
 * `String(null)` is `'null'`, which it would keep too, and that is the reading
 * this wrapper exists to prevent. The null is turned into the absent case
 * *before* anything is stringified, so an unread cost reads as
 * {@link UNDETERMINED} and a lap that spent nothing reads as `0`.
 */
function spent(label: string, value: number | null, pointer: string): Claim {
  return claim(label, value === null ? null : String(value), pointer);
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
    // **Three claims, one per quantity, and a number is not spelled as prose**
    // (`D-0046` rule 5). Time and money are separate: a lap inside its ceiling
    // can cost several times the one before it, so a duration claim is not a
    // cost claim and neither is derivable from the other. The basis is the
    // snapshot pointer, so a reader can follow it into the verbatim row and see
    // the number -- or the null -- for themselves.
    //
    // A null renders as UNDETERMINED and a zero renders as `0`, which is the
    // whole point of the columns being nullable: "rondo did not read this lap's
    // cost" and "this lap cost nothing" are different claims.
    spent("lap cost (USD)", it.lapCostUsd, "/iteration/lapCostUsd"),
    spent("lap turns", it.lapTurns, "/iteration/lapTurns"),
    spent("lap duration (ms)", it.lapDurationMs, "/iteration/lapDurationMs"),
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
 * Where one candidate contract came from, as a closed union.
 *
 * **The closure is {@link Basis}'s argument applied to provenance**: a
 * candidate whose origin a reader does not recognise is one they cannot judge,
 * and the two members are the only two ways rondo composes a candidate at all.
 *
 * `iteration` is a **selection**: the agent type some iteration really ran
 * under, chosen and not written. `promotedKey` is the one thing rondo composes
 * rather than selects, and it is bounded to the single motion D-0022 rule 17
 * calls the widening -- *"a different agent type, whose grants are what
 * widens"*. Even that invents nothing: the key moved is one the agent type's
 * own author already listed as `askable`, which is that list's whole meaning
 * (D-0022 rule 11: `granted` and `askable` are **inputs to contract
 * construction**, consumed before the contract exists, never a second answer
 * standing beside one).
 */
export type CandidateSource =
  | { readonly form: "iteration"; readonly iterationId: string }
  | { readonly form: "promotedKey"; readonly key: string };

/**
 * One candidate contract, as the snapshot carries it.
 *
 * **One shape for two kinds, because they differ in where the candidate comes
 * from and in nothing else.** `agent_type` varies which agent type the retry
 * runs under; `contract_keys` varies which keys that agent type carries as
 * granted. Both end in the same place -- a contract issued to the successor's
 * identity, with a digest a person approves -- so a second shape would be a
 * second spelling of the thing `human_decision.approved` points at.
 *
 * `granted` and `askable` are carried because they are what the option is
 * *about*: an operator judging a widening is judging those two lists, and a
 * basis that pointed at a digest alone would be a citation of the answer rather
 * than of the material.
 */
export type SnapshotContractCandidate = {
  readonly from: CandidateSource;
  readonly agentTypeId: string;
  readonly agentTypeDigest: string;
  /** Sorted and frozen by cadenza; rondo copies rather than re-deriving. */
  readonly granted: readonly string[];
  readonly askable: readonly string[];
  /** The contract the successor would run under with it. */
  readonly contractDigest: string;
};

/**
 * What the composition root gathered for an `agent_type` or `contract_keys`
 * proposal.
 *
 * A third snapshot shape, for {@link RetrySnapshot}'s reason exactly: a
 * `snapshot` basis is a pointer into **this row's own** snapshot, so the
 * document is per proposal. **Nothing in {@link AdvisorySnapshot} moves**, and
 * that is load-bearing rather than incidental -- every pointer an `explanation`
 * has ever written resolves against the document that kind still gathers.
 */
export type ContractSnapshot = {
  readonly iteration: SnapshotIteration;
  readonly successor: SnapshotSuccessor;
  /** Non-empty: the subject's own contract is always one of them. */
  readonly candidates: readonly [SnapshotContractCandidate, ...SnapshotContractCandidate[]];
};

/**
 * The candidate that changes nothing, which is the one rondo recommends.
 *
 * **Written once and used by both kinds, because it is one rule**: the
 * recommendation is the row's own agent type, unchanged -- an
 * `iteration`-sourced candidate naming the subject. So rondo never recommends
 * more authority than the iteration already had, and a widening is something a
 * person reaches for rather than something they accept by taking the default.
 * That is `D-0009`'s division kept at the level of the screen: the advisory
 * proposes candidates, and *widening* is a human's decision.
 *
 * Total: where the subject's own candidate is not in the set -- which the
 * gatherer does not produce, but the drafter must survive -- the first is
 * recommended, because a set with no recommendation is the one shape D-0032
 * rule 1 does not admit.
 */
function unchangedIndex(snapshot: ContractSnapshot): number {
  const at = snapshot.candidates.findIndex(
    (candidate) =>
      candidate.from.form === "iteration" && candidate.from.iterationId === snapshot.iteration.id,
  );
  return at === -1 ? 0 : at;
}

/** One candidate as an option: the digest, cited where the snapshot keeps it. */
function optionFor(candidate: SnapshotContractCandidate, index: number, label: string): Option {
  return {
    label,
    value: candidate.contractDigest,
    basis: { form: "snapshot", pointer: `/candidates/${String(index)}/contractDigest` },
  };
}

/** `k, k2` -- or `none`, which is a fact about the list and not an empty line. */
function keyList(keys: readonly string[]): string {
  return keys.length === 0 ? ABSENT : keys.join(", ");
}

/**
 * Which agent type the retry should run under (D-0022 rule 17's widening).
 *
 * **A selection among the agent types the lineage actually ran under**, on
 * `proposeRetryPlan`'s terms: rondo authors no agent type here, because an
 * agent type rondo wrote would be rondo deciding what a delegate may do. The
 * option set is therefore short by construction, and short is the honest
 * answer -- rondo has no catalog of agent types to offer, and `D-0019` rule 3
 * says it gains no configuration layer to acquire one in.
 *
 * Total and pure over the snapshot, like every other drafter here.
 */
export function proposeAgentType(snapshot: ContractSnapshot): AgentTypeProposal {
  const options = snapshot.candidates.map((candidate, index) =>
    optionFor(
      candidate,
      index,
      `run '${snapshot.successor.iterationId}' under agent type '${candidate.agentTypeId}' ` +
        `(${candidate.agentTypeDigest}), granting ${keyList(candidate.granted)} and asking for ` +
        `${keyList(candidate.askable)}`,
    ),
  );
  return {
    kind: "agent_type",
    derivation: null,
    payload: { options, recommended: unchangedIndex(snapshot) },
  };
}

/**
 * Which keys the retry's contract carries as granted rather than askable.
 *
 * **One key at a time, and only a key the agent type already declared
 * askable.** Both halves are the bound: a proposal that promoted two keys at
 * once would ask a person to approve two widenings with one answer, which is
 * the *"answerable in one sentence"* #39 measures failing in the other
 * direction; and a key from outside `askable` would be rondo inventing a grant
 * its author never offered, which is the amplification `D-0022` rule 17 says
 * nothing bounds once the successor contract is gone.
 *
 * The candidate that promotes nothing is the recommendation, by
 * {@link unchangedIndex}'s rule.
 */
export function proposeContractKeys(snapshot: ContractSnapshot): ContractKeysProposal {
  const options = snapshot.candidates.map((candidate, index) =>
    optionFor(
      candidate,
      index,
      candidate.from.form === "promotedKey"
        ? `grant '${candidate.from.key}' to '${snapshot.successor.iterationId}' instead of ` +
            `leaving it askable, so it is granted without asking: ${keyList(candidate.granted)}`
        : `leave the keys as they are: granting ${keyList(candidate.granted)} and asking for ` +
            `${keyList(candidate.askable)}`,
    ),
  );
  return {
    kind: "contract_keys",
    derivation: null,
    payload: { options, recommended: unchangedIndex(snapshot) },
  };
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
 * Every live lap, as the host-wide snapshot carries one of them (D-0037
 * rule 1).
 *
 * **The element is {@link SnapshotIteration} and not a second shape**, for the
 * reason `gather` already gives about the per-lap snapshot: two copies of
 * eighteen field names are two places a field can go missing from, and a
 * `snapshot` basis is a pointer into the persisted bytes -- so a between-laps
 * claim citing `/laps/3/iteration/status` must find the same document `explain`
 * would have shown for that lap alone.
 *
 * **What is here and is not on {@link AdvisorySnapshot} is exactly what a
 * cross-lap claim reads**: the `D-0023` triple, which is how an operator gets
 * from an adjacency to the two working trees, and the plan's base branch, which
 * is what rule 3a's adjacency is *against*. The plan itself is still cited by
 * digest and not copied -- the base branch is what the claim rests on, and
 * copying thirty fields to ground one of them would be paying for
 * re-derivability nothing reads.
 *
 * Every one of the four is nullable because the row's own columns are:
 * `runId`, `topicBranch` and `workspace` predate `D-0023` and are null on rows
 * written before it, and `baseBranch` is null when the persisted plan will not
 * decode. A null here is a claim that says `undetermined` rather than a lap
 * quietly left out of a family.
 */
export type SnapshotLap = {
  readonly iteration: SnapshotIteration;
  readonly runId: string | null;
  readonly topicBranch: string | null;
  readonly workspace: string | null;
  readonly baseBranch: string | null;
  readonly readings: readonly SnapshotReading[];
};

/**
 * The two bounds and what stands against them (D-0037 rule 3c).
 *
 * The bounds are the host's policy (`maxOccupying`, `maxLive`); the two
 * occupancies are what the store counts over the generated columns those bounds
 * are defined against. All four travel because the claim is about the *pair*:
 * a bound with no occupancy beside it is a number an operator cannot act on.
 */
export type SnapshotBounds = {
  readonly maxOccupying: number;
  readonly maxLive: number;
  readonly occupying: number;
  readonly live: number;
};

/**
 * One admission a bound refused, as the snapshot carries it (`D-0023` rule 14).
 *
 * **Work deliberately not started is #40's third measured case**, and this is
 * the only row in the store that records it: a refusal costs no `iteration` row
 * at all, so without this table the bound could only ever be raised because
 * somebody complained.
 */
export type SnapshotRefusal = {
  readonly refusedAtMs: number;
  readonly request: string;
  readonly boundName: string;
  readonly bound: number;
  readonly occupancy: number;
};

/**
 * What the composition root gathered for a between-laps composition (D-0037
 * rule 1).
 *
 * **A fourth snapshot type and not a fourth component.** It is more rows in the
 * argument to a function that already exists: the gathering stays the
 * composition root's (D-0022 rule 2), this layer's read allowance is not
 * widened by a word, and what comes back is an {@link Explanation} -- the kind
 * that binds nothing, which is what makes the type system rather than a review
 * the thing that forbids a between-laps component with authority.
 *
 * **No cap, no paging and no "top ten"** (rule 5): every live lap enters. If a
 * host-wide snapshot ever has to be bounded for size, that bound is a
 * *withholding* -- it writes `withheld` rows under a rule the operator named --
 * and not an implementation detail chosen inside a diff.
 */
export type HostSnapshot = {
  readonly laps: readonly SnapshotLap[];
  /**
   * The live rows that would not decode, which hold a slot and have no claims.
   *
   * **On the screen rather than missing from it**, which is the inbox's rule
   * applied where a family would otherwise be quietly short: a composition that
   * dropped them would be wrong about what is running in exactly the case that
   * needs a person, and the count of laps would silently stop matching the
   * occupancy beside it.
   */
  readonly unreadable: readonly { readonly id: string; readonly reason: string }[];
  readonly bounds: SnapshotBounds;
  readonly refusals: readonly SnapshotRefusal[];
};

/**
 * One lap and where it sits in the snapshot, carried together.
 *
 * The index is what a `snapshot` basis is built out of and the lap is what the
 * claim is about, so the two travel as one value rather than as a number that
 * has to be looked up again -- a second lookup is a second place the pointer
 * and the lap can stop agreeing.
 */
type Placed = { readonly lap: SnapshotLap; readonly index: number };

/** A lap's `D-0023` triple as one line, with `none` where the row has no value. */
function triple(lap: SnapshotLap): string {
  return (
    `run ${lap.runId ?? ABSENT}, branch ${lap.topicBranch ?? ABSENT}, ` +
    `workspace ${lap.workspace ?? ABSENT}`
  );
}

/** The claim a family emits when it looked and found nothing (D-0037 rule 3). */
function foundNothing(label: string, pointer: string): Claim {
  return { label, value: ABSENT, basis: { form: "snapshot", pointer } };
}

/**
 * Rule 3a: live laps open against the same base branch, and nothing more.
 *
 * **It says they are adjacent; it does not say they collided.** rondo
 * de-conflicts only the identifiers it mints, and a decision id or a migration
 * number lives *inside the work* -- reading that needs a reader across branches
 * nothing in rondo has (`D-0033` rule 9). What an operator gets is the fact
 * that sends them to look: these two are open against `main` right now, and
 * here are the two workspaces. A claim that said more would be rondo asserting
 * an absence it cannot observe.
 *
 * A lap whose base branch would not decode is {@link UNDETERMINED} rather than
 * a lap silently missing from the grouping: "rondo looked and these are not
 * adjacent" and "rondo could not tell" are different answers.
 */
function adjacencyClaims(laps: readonly SnapshotLap[]): readonly Claim[] {
  const byBase = new Map<string, Placed[]>();
  const unreadable: Claim[] = [];
  laps.forEach((lap, index) => {
    if (lap.baseBranch === null) {
      unreadable.push(claim("open against", null, `/laps/${String(index)}/baseBranch`));
      return;
    }
    byBase.set(lap.baseBranch, [...(byBase.get(lap.baseBranch) ?? []), { lap, index }]);
  });
  const adjacent = [...byBase]
    .filter(([, placed]) => placed.length > 1)
    .flatMap(([base, placed]) =>
      placed.map(({ lap, index }): Claim => {
        const others = placed
          .filter((other) => other.index !== index)
          .map((other) => `'${other.lap.iteration.id}'`)
          .join(", ");
        return {
          label: `open against '${base}' beside ${others}`,
          value: `${lap.iteration.id} (${triple(lap)})`,
          basis: { form: "snapshot", pointer: `/laps/${String(index)}/iteration/id` },
        };
      }),
    );
  return [
    ...(adjacent.length === 0
      ? [foundNothing("two live laps open against one base branch", "/laps")]
      : adjacent),
    ...unreadable,
  ];
}

/**
 * Rule 3b: a finding that appears on more than one live lap's reading (D-0029).
 *
 * **The ceiling is equality over the finding's text, and it is stated rather
 * than discovered.** This finds the same sentence written twice and nothing
 * else; two readings that describe one defect in different words are invisible
 * to it. The alternative refused is similarity scoring -- a {@link Claim} has
 * three fields and no fourth for exactly that reason, and a confidence is a
 * number the drafter would be narrating about its own material.
 *
 * Each side is cited by an `iteration` basis, because what an operator needs
 * from a shared finding is the two laps to go and open.
 */
function sharedMaterialClaims(laps: readonly SnapshotLap[]): readonly Claim[] {
  const sides = new Map<string, Placed[]>();
  laps.forEach((lap, index) => {
    // Per lap rather than per reading: two readers of one lap agreeing is one
    // lap's finding, and counting it twice would report a lap as sharing
    // material with itself.
    const onThisLap = new Set(lap.readings.flatMap((reading) => [...reading.findings]));
    for (const finding of onThisLap) {
      sides.set(finding, [...(sides.get(finding) ?? []), { lap, index }]);
    }
  });
  const shared = [...sides]
    .filter(([, placed]) => placed.length > 1)
    .flatMap(([finding, placed]) =>
      placed.map(
        ({ lap }): Claim => ({
          label: `a finding on ${String(placed.length)} live laps`,
          value: finding,
          basis: { form: "iteration", iterationId: lap.iteration.id },
        }),
      ),
    );
  return shared.length === 0
    ? [foundNothing("one finding read on more than one live lap", "/laps")]
    : shared;
}

/**
 * Rule 3c: the bounds, what stands against them, and what they refused.
 *
 * **rondo takes no act here** (`D-0033` rule 3). The refusal side is already
 * owned and already counted; a person who reads this and does not run `start`
 * is the other half, and an advisory that could withhold an admission by itself
 * would be the advisory deciding.
 */
function capacityClaims(snapshot: HostSnapshot): readonly Claim[] {
  const bounds = snapshot.bounds;
  return [
    claim("bound 'maxOccupying'", String(bounds.maxOccupying), "/bounds/maxOccupying"),
    claim("occupying now", String(bounds.occupying), "/bounds/occupying"),
    claim("bound 'maxLive'", String(bounds.maxLive), "/bounds/maxLive"),
    claim("live now", String(bounds.live), "/bounds/live"),
    ...(snapshot.refusals.length === 0
      ? [foundNothing("an admission a bound refused", "/refusals")]
      : snapshot.refusals.map(
          (refusal, index): Claim => ({
            label: "an admission a bound refused",
            value:
              `'${refusal.request}' against '${refusal.boundName}' ` +
              `${String(refusal.bound)} at occupancy ${String(refusal.occupancy)}`,
            basis: { form: "snapshot", pointer: `/refusals/${String(index)}` },
          }),
        )),
  ];
}

/**
 * What spans the live laps, as claims a person can check (D-0037 rules 1-3).
 *
 * **The between-laps composition, and it is an {@link Explanation} like every
 * other one.** It proposes nothing and binds nothing: `D-0033` rule 3 says the
 * one act rondo can take between laps is admission, and `D-0023`'s bound
 * already owns and counts its refusal, so there is nothing here to approve.
 *
 * **Every family is emitted for every snapshot, including an empty one**, which
 * is {@link propose}'s discipline and not a new rule: a family that fell silent
 * when it found nothing would make *"rondo looked and there is no adjacency"*
 * and *"rondo did not look"* the same screen.
 *
 * Total over the snapshot and pure, on {@link propose}'s terms exactly: no
 * clock, no I/O, and the same bytes in give the same bytes out.
 */
export function proposeHost(snapshot: HostSnapshot): Explanation {
  return {
    kind: "explanation",
    derivation: "store_rows",
    payload: {
      claims: [
        claim("live laps", String(snapshot.laps.length), "/laps"),
        ...snapshot.unreadable.map(
          (row, index): Claim => ({
            label: "a live lap rondo could not read",
            value: `${row.id}: ${row.reason}`,
            basis: { form: "snapshot", pointer: `/unreadable/${String(index)}` },
          }),
        ),
        ...adjacencyClaims(snapshot.laps),
        ...sharedMaterialClaims(snapshot.laps),
        ...capacityClaims(snapshot),
      ],
    },
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
export function snapshotDocument(
  snapshot: AdvisorySnapshot | RetrySnapshot | ContractSnapshot | HostSnapshot,
): JsonRecord {
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

/**
 * A payload read back out of a stored row, or the reason it will not read
 * (#39).
 *
 * **The inverse of {@link payloadDocument}, and the refusal is the point.** The
 * store holds a payload verbatim and never reads into it, so a reader is where
 * D-0032 rule 2's closure stops being a sentence: *"an unrecognised form is a
 * row the reader refuses rather than guesses at"*. A basis rondo cannot place
 * is a citation an operator would read as though rondo had checked it.
 *
 * **Which arm is decided by the document's own shape, never by the row's
 * `kind`.** The two are separate facts and the screen prints both: authority
 * comes from `kind` alone (D-0032 rule 5) and what is on the screen comes from
 * the payload, so a row whose two disagree renders visibly rather than as one
 * of them quietly winning.
 */
export type PayloadReading =
  | { readonly kind: "options"; readonly payload: OptionSetPayload }
  | { readonly kind: "claims"; readonly payload: ExplanationPayload }
  | { readonly kind: "unreadable"; readonly reason: string };

/** What a decoder returns when it will not guess. */
class PayloadDefect extends Error {}

function object(at: unknown, what: string): Record<string, unknown> {
  if (typeof at !== "object" || at === null || Array.isArray(at)) {
    throw new PayloadDefect(`${what} is not an object`);
  }
  return at as Record<string, unknown>;
}

function text(at: Record<string, unknown>, field: string, what: string): string {
  const value = at[field];
  if (typeof value !== "string") {
    throw new PayloadDefect(`${what} has no '${field}' string`);
  }
  return value;
}

function whole(at: Record<string, unknown>, field: string, what: string): number {
  const value = at[field];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new PayloadDefect(`${what} has no '${field}' whole number`);
  }
  return value;
}

/**
 * One basis, read back as the closed union (D-0032 rule 2).
 *
 * A form outside {@link BASIS_FORMS} is refused rather than rendered as prose,
 * and so is a form whose own fields are missing: *"the basis is prose"* is
 * deliberately not a member, and a half-read locator would become one.
 */
function readBasis(at: unknown, what: string): Basis {
  const row = object(at, `${what}'s basis`);
  const form = text(row, "form", `${what}'s basis`);
  switch (form) {
    case "snapshot":
      return { form, pointer: text(row, "pointer", `${what}'s basis`) };
    case "iteration":
      return { form, iterationId: text(row, "iterationId", `${what}'s basis`) };
    case "gateTransition":
      return {
        form,
        gateId: text(row, "gateId", `${what}'s basis`),
        transitionSeq: whole(row, "transitionSeq", `${what}'s basis`),
      };
    case "continuoRun":
      return { form, runId: text(row, "runId", `${what}'s basis`) };
    case "repository":
      return {
        form,
        path: text(row, "path", `${what}'s basis`),
        commit: text(row, "commit", `${what}'s basis`),
        firstLine: whole(row, "firstLine", `${what}'s basis`),
        lastLine: whole(row, "lastLine", `${what}'s basis`),
      };
    case "message":
      return { form, messageId: text(row, "messageId", `${what}'s basis`) };
    default:
      throw new PayloadDefect(
        `${what}'s basis is of form '${form}', which is not one of ${BASIS_FORMS.join(", ")}. ` +
          "D-0032 rule 2 closes the union, so rondo refuses it rather than showing you a " +
          "citation it cannot place.",
      );
  }
}

/** The three fields a claim and an option both carry, on D-0034 rule 3's terms. */
function readCited(at: unknown, what: string): Claim {
  const row = object(at, what);
  return {
    label: text(row, "label", what),
    value: text(row, "value", what),
    basis: readBasis(row.basis, what),
  };
}

function readList(at: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(at)) {
    throw new PayloadDefect(`the payload's '${field}' is not a list`);
  }
  return at;
}

/**
 * One stored payload, read back (#39, D-0032 rules 1 and 2, D-0034 rule 1).
 *
 * Total; never throws. A payload that is neither an option set nor a claim
 * list, and one whose recommendation names no option, both read as
 * `unreadable`: *"exactly one marked as the recommendation"* is rule 1's own
 * words, and an index out of range is a proposal with no recommendation at all.
 */
export function readPayload(document: JsonRecord): PayloadReading {
  try {
    const row = object(document, "the payload");
    if ("options" in row) {
      const options = readList(row.options, "options").map((one, index) =>
        readCited(one, `option ${String(index)}`),
      );
      const recommended = whole(row, "recommended", "the payload");
      if (options.length === 0) {
        throw new PayloadDefect("the payload's 'options' is empty, so there is nothing to answer");
      }
      if (recommended < 0 || recommended >= options.length) {
        throw new PayloadDefect(
          `the payload recommends option ${String(recommended)} of ${String(options.length)}, ` +
            "which is no option in it",
        );
      }
      return { kind: "options", payload: { options, recommended } };
    }
    if ("claims" in row) {
      return {
        kind: "claims",
        payload: {
          claims: readList(row.claims, "claims").map((one, index) =>
            readCited(one, `claim ${String(index)}`),
          ),
        },
      };
    }
    throw new PayloadDefect(
      "the payload carries neither 'options' nor 'claims', so rondo cannot tell whether it is " +
        "something to answer or something to read",
    );
  } catch (error) {
    if (error instanceof PayloadDefect) {
      return { kind: "unreadable", reason: error.message };
    }
    throw error;
  }
}

/**
 * One plan a split proposes, as a diff against a template (D-0063 rule 4).
 *
 * **Four fields and no identifier.** Rule 4.1 names the template by its
 * `plan_digest`; rule 4.2 lets only the request text and the agent type differ
 * from it, so those are the only two values carried, and every other field is
 * the template's byte for byte; rule 4.5 derives run id, branch and workspace at
 * admission, so none is here and a key that would carry one is refused.
 * `bases` reads {@link Basis}'s closed union, D-0061 rule 2.6's `message` form
 * included (rule 4.3).
 *
 * ponytail: residual R3 -- no drafter writes a split and no path admits one yet.
 */
export interface SplitPlan {
  readonly template_plan_digest: string;
  readonly prompt: string;
  readonly agent_type_digest: string;
  readonly bases: readonly Basis[];
}

/**
 * A split's payload (D-0063 rule 4, D-0066 rule 5.1): proposed plans, or --
 * with no persisted plan to use as a template -- the holes (rule 4.4, D-0022
 * rule 7's third form). Never approved per split: the scope that lists the
 * agent type is the approval.
 */
export interface SplitPayload {
  readonly plans: readonly SplitPlan[];
  readonly holes: readonly string[];
}

export type SplitPayloadReading =
  | { readonly kind: "split"; readonly payload: SplitPayload }
  | { readonly kind: "unreadable"; readonly reason: string };

const SPLIT_KEYS: readonly string[] = ["plans", "holes"];
const SPLIT_PLAN_KEYS: readonly string[] = [
  "template_plan_digest",
  "prompt",
  "agent_type_digest",
  "bases",
];
const SPLIT_DIGEST = /^sha256:[0-9a-f]{64}$/;

/**
 * A split payload, read back. Total; never throws.
 *
 * **A reader of its own rather than a third arm of {@link readPayload}.** An arm
 * there widens {@link PayloadReading}, and every screen that switches on it
 * would need a rendering for a kind nothing writes today (no drafter, no verb:
 * D-0066's residual R3). The row's `kind` still says `split`, and
 * `readPayload` over a split reads `unreadable` -- visibly, never as one of the
 * other two.
 */
export function readSplitPayload(document: JsonRecord): SplitPayloadReading {
  try {
    const row = object(document, "the split payload");
    refuseUnknownKeys(row, SPLIT_KEYS, "the split payload");
    const plans = readList(row.plans, "plans").map((one, index) => {
      const what = `split plan ${String(index)}`;
      const plan = object(one, what);
      // D-0063 rule 4.5: a key beyond the four is a proposed identifier or a
      // field the template owns, and neither is the drafter's to fill.
      refuseUnknownKeys(plan, SPLIT_PLAN_KEYS, what);
      const template = text(plan, "template_plan_digest", what);
      const agentType = text(plan, "agent_type_digest", what);
      for (const digest of [template, agentType]) {
        if (!SPLIT_DIGEST.test(digest)) {
          throw new PayloadDefect(`${what} names '${digest}', which is not a sha256 digest`);
        }
      }
      return {
        template_plan_digest: template,
        prompt: text(plan, "prompt", what),
        agent_type_digest: agentType,
        bases: readList(plan.bases, `${what}'s bases`).map((basis, b) =>
          readBasis(basis, `${what} basis ${String(b)}`),
        ),
      };
    });
    const holes = readList(row.holes, "holes").map((hole, index) => {
      if (typeof hole !== "string" || hole === "") {
        throw new PayloadDefect(`hole ${String(index)} is not a non-empty string`);
      }
      return hole;
    });
    if (plans.length === 0 && holes.length === 0) {
      throw new PayloadDefect(
        "the split proposes no plan and lists no hole, so it says nothing (D-0063 rule 4.4)",
      );
    }
    return { kind: "split", payload: { plans, holes } };
  } catch (error) {
    if (error instanceof PayloadDefect) {
      return { kind: "unreadable", reason: error.message };
    }
    throw error;
  }
}

function refuseUnknownKeys(at: Record<string, unknown>, known: readonly string[], what: string) {
  const extra = Object.keys(at).find((key) => !known.includes(key));
  if (extra !== undefined) {
    throw new PayloadDefect(`${what} carries '${extra}', which is not one of ${known.join(", ")}`);
  }
}
