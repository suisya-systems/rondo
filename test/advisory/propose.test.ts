/**
 * `propose` over hand-built snapshots, and nothing else (D-0022 rule 14).
 *
 * **No database, no continuo build, no cadenza package**, which is the property
 * rule 2 bought by making the advisory a function of an injected snapshot --
 * the same one `D-0019` rule 1 bought for `test/refrain/`. A file here that
 * needed a fixture would mean the layer had acquired a dependency the boundary
 * test is supposed to have made impossible.
 *
 * Three properties are asserted that nothing else in the suite can see:
 *
 *  - **a claim the snapshot cannot ground says so** and is not dropped
 *    (D-0032 rule 8's `undetermined`, which is the one the brief names);
 *  - **every claim carries a basis** (rule 2 -- a claim without one is the
 *    summary #39 measured an operator approving three times in one day);
 *  - **an explanation carries no recommendation**, which is how rule 1 and
 *    rule 5 are read together (see `src/advisory/proposal.ts`'s note on
 *    {@link Proposal}).
 */
import { expect, test } from "vitest";

import {
  ABSENT,
  type AdvisorySnapshot,
  BASIS_FORMS,
  type Claim,
  type ContractSnapshot,
  DERIVATIONS,
  propose,
  proposeAgentType,
  proposeContractKeys,
  proposeElevated,
  proposeRetryPlan,
  type RetrySnapshot,
  readPayload,
  UNDETERMINED,
} from "../../src/advisory/proposal.js";

/**
 * A row as rich as the store ever gets it: every nullable column filled.
 *
 * Written as the *full* case and narrowed per test, because the interesting
 * failures are all on the empty side and a fixture that started empty would
 * make the full case the one nobody checked.
 */
const FULL: AdvisorySnapshot = {
  iteration: {
    id: "i-0001",
    status: "closed",
    request: "teach revise to name the flags it takes",
    planDigest: `sha256:${"a".repeat(64)}`,
    attempts: 1,
    supersedesIterationId: "i-0000",
    continuoRevision: "603843b",
    agentTypeDigest: `sha256:${"b".repeat(64)}`,
    configDigest: `sha256:${"c".repeat(64)}`,
    contractDigest: `sha256:${"d".repeat(64)}`,
    classification: "allowed",
    classificationReason: "the intended action is inside the contract",
    modelTier: "standard",
    model: "claude-sonnet-4-5",
    lapCostUsd: 1.542,
    lapTurns: 38,
    lapDurationMs: 203_324,
    gateId: "g-0001",
    gateStage: "answered",
    gateOutcome: "approved",
    reason: null,
  },
  readings: [
    {
      drafter: "rondo/deterministic/1",
      verdict: "concerns",
      findings: ["the help text names a flag the parser refuses"],
      unavailableReason: null,
    },
  ],
};

/** The same row as `reserve()` first writes it: the plan, and almost nothing else. */
const BARE: AdvisorySnapshot = {
  iteration: {
    id: "i-0002",
    status: "planned",
    request: "something a person typed",
    planDigest: `sha256:${"e".repeat(64)}`,
    attempts: 1,
    supersedesIterationId: null,
    continuoRevision: null,
    agentTypeDigest: null,
    configDigest: null,
    contractDigest: null,
    classification: null,
    classificationReason: null,
    modelTier: null,
    model: null,
    lapCostUsd: null,
    lapTurns: null,
    lapDurationMs: null,
    gateId: null,
    gateStage: null,
    gateOutcome: null,
    reason: null,
  },
  readings: [],
};

const labelled = (claims: readonly Claim[], label: string): Claim => {
  const found = claims.find((claim) => claim.label === label);
  if (found === undefined) {
    throw new Error(`no claim labelled '${label}'`);
  }
  return found;
};

test("an explanation is the kind it says it is, and names how it was derived", () => {
  const proposal = propose(FULL);
  expect(proposal.kind).toBe("explanation");
  // D-0032 rule 8: non-null exactly when the kind is `explanation`, which the
  // schema's own CHECK enforces from the other side.
  expect(DERIVATIONS).toContain(proposal.derivation);
});

test("it says where the request stands, under what plan, and on which build", () => {
  const claims = propose(FULL).payload.claims;
  expect(labelled(claims, "status").value).toBe("closed");
  expect(labelled(claims, "plan digest").value).toBe(FULL.iteration.planDigest);
  expect(labelled(claims, "continuo revision").value).toBe("603843b");
  expect(labelled(claims, "contract digest").value).toBe(FULL.iteration.contractDigest);
  expect(labelled(claims, "revision of").value).toBe("i-0000");
});

test("it says what the lap cost, in dollars, turns and milliseconds", () => {
  // rondo#96 / D-0046. Three claims because they are three quantities: a lap can
  // run well inside its ceiling and cost several times the lap before it, so the
  // duration is not a price and neither stands in for the other.
  const claims = propose(FULL).payload.claims;
  expect(labelled(claims, "lap cost (USD)").value).toBe("1.542");
  expect(labelled(claims, "lap turns").value).toBe("38");
  expect(labelled(claims, "lap duration (ms)").value).toBe("203324");
  // Every claim rests somewhere a reader can follow (D-0032 rule 2).
  expect(labelled(claims, "lap cost (USD)").basis).toEqual({
    form: "snapshot",
    pointer: "/iteration/lapCostUsd",
  });
});

test("a lap that cost nothing and a lap whose cost was never read do not render alike", () => {
  // The reason the columns are nullable. `0` is a lap that spent nothing; a null
  // is rondo not having read the transcript, and rounding the second into the
  // first would understate a bill in the direction nobody checks.
  const free = propose({
    ...FULL,
    iteration: { ...FULL.iteration, lapCostUsd: 0, lapTurns: 0, lapDurationMs: 0 },
  }).payload.claims;
  expect(labelled(free, "lap cost (USD)").value).toBe("0");
  expect(labelled(free, "lap turns").value).toBe("0");
  expect(labelled(free, "lap duration (ms)").value).toBe("0");

  const unread = propose(BARE).payload.claims;
  expect(labelled(unread, "lap cost (USD)").value).toBe(UNDETERMINED);
  expect(labelled(unread, "lap turns").value).toBe(UNDETERMINED);
  expect(labelled(unread, "lap duration (ms)").value).toBe(UNDETERMINED);
});

test("a field the snapshot does not settle is undetermined and is not dropped", () => {
  const full = propose(FULL).payload.claims;
  const bare = propose(BARE).payload.claims;
  // **The property the whole rule turns on**: the two payloads have the *same*
  // claims, and the empty one differs in its values rather than in its length.
  // A drafter that omitted what it could not ground would leave a reader unable
  // to tell "rondo looked and the row is null" from "rondo did not look", and
  // the omission is exactly the failure that reads as fluency.
  const cited = (claims: readonly Claim[]): readonly string[] =>
    claims.filter((claim) => claim.label !== "independent reading").map((claim) => claim.label);
  for (const label of cited(full)) {
    if (label.startsWith("independent reading") || label === "reading finding") {
      continue;
    }
    expect(cited(bare)).toContain(label);
  }
  for (const label of [
    "classification",
    "continuo revision",
    "agent type digest",
    "config digest",
    "contract digest",
    "model",
    "gate stage",
    "gate outcome",
    "gate",
  ]) {
    expect(labelled(bare, label).value).toBe(UNDETERMINED);
  }
});

test("a first lap revises nothing, which is a fact and not a gap", () => {
  // `src/store/records.ts` on `supersedesIterationId`: *"Null is not 'unknown',
  // it is 'no predecessor'"* -- written once at reservation and by nothing
  // afterwards. Rendering it as `undetermined` would report every first lap as
  // an iteration whose lineage rondo could not establish, which is a worse
  // answer than the one the row gives.
  expect(labelled(propose(BARE).payload.claims, "revision of").value).toBe(ABSENT);
  expect(labelled(propose(BARE).payload.claims, "revision of").value).not.toBe(UNDETERMINED);
  expect(labelled(propose(FULL).payload.claims, "revision of").value).toBe("i-0000");
});

test("a lap with no independent reading says so rather than saying nothing", () => {
  // D-0029 rule 10's distinction, carried into the explanation: a reading that
  // never ran must not render like one that was taken and found nothing.
  expect(labelled(propose(BARE).payload.claims, "independent reading").value).toBe(UNDETERMINED);
  const full = propose(FULL).payload.claims;
  expect(labelled(full, "independent reading (rondo/deterministic/1)").value).toBe("concerns");
  expect(labelled(full, "reading finding").value).toBe(
    "the help text names a flag the parser refuses",
  );
});

test("every claim carries a basis, and every basis is one of the five forms", () => {
  for (const snapshot of [FULL, BARE]) {
    const claims = propose(snapshot).payload.claims;
    expect(claims.length).toBeGreaterThan(0);
    for (const claim of claims) {
      // D-0032 rule 2: prose is permitted only where it travels with its basis.
      expect(BASIS_FORMS).toContain(claim.basis.form);
      if (claim.basis.form === "snapshot") {
        // A pointer into the row's own verbatim snapshot, which is what makes
        // the citation renderable inline with no second home for the fact.
        expect(claim.basis.pointer.startsWith("/")).toBe(true);
      }
    }
  }
});

/**
 * Follow one JSON pointer into a snapshot, the way the renderer does.
 *
 * At module scope because both voices cite this way: a claim's basis and an
 * option's basis are the same closed union under the same rule (D-0032 rule 2,
 * D-0034 rule 3), so one resolver checking both is what keeps the two from
 * drifting into two notions of what a citation is.
 */
const resolve = (document: unknown, pointer: string): unknown =>
  pointer
    .split("/")
    .slice(1)
    .reduce<unknown>(
      (at, step) => (at === null || typeof at !== "object" ? undefined : Reflect.get(at, step)),
      document,
    );

test("a snapshot basis points at a field the persisted snapshot actually has", () => {
  // **The citation is checked rather than trusted.** A pointer is only worth
  // storing if following it lands somewhere, and the snapshot is the document
  // the store keeps verbatim -- so this resolves each pointer against the very
  // value handed to `propose`.
  for (const snapshot of [FULL, BARE]) {
    for (const claim of propose(snapshot).payload.claims) {
      if (claim.basis.form !== "snapshot") {
        continue;
      }
      expect(resolve(snapshot, claim.basis.pointer)).not.toBe(undefined);
    }
  }
});

test("an explanation carries claims and no recommendation", () => {
  // **D-0032 rule 1 and rule 5, read together.** Rule 1's option set with
  // exactly one recommendation is the shape of the thing being *approved*;
  // rule 5 says an `explanation` binds nothing and `recordDecision` refuses an
  // answer that names it. A recommendation here would be the third voice
  // borrowing the grammar of the first, which is the confusion both rules exist
  // to prevent. The absence is asserted so a later kind cannot acquire it here
  // by accident.
  const payload: Record<string, unknown> = propose(FULL).payload;
  expect(Object.keys(payload)).toEqual(["claims"]);
  for (const claim of propose(FULL).payload.claims) {
    expect(Object.keys(claim).sort()).toEqual(["basis", "label", "value"]);
  }
});

test("the words are candidate's, never permission's", () => {
  // D-0022 rule 11, and **here rather than as a tree-wide grep**: the word lives
  // in an unrelated capacity message in `src/refrain/interpreter.ts`, so a sweep
  // over the tree would fail on it for no reason. What matters is the text an
  // operator is shown, which is this payload.
  for (const snapshot of [FULL, BARE]) {
    for (const claim of propose(snapshot).payload.claims) {
      expect(`${claim.label} ${claim.value}`.toLowerCase()).not.toContain("permission");
      expect(`${claim.label} ${claim.value}`.toLowerCase()).not.toContain("permitted");
    }
  }
});

test("it is pure: the same snapshot gives the same bytes", () => {
  // What makes a proposal re-derivable from the snapshot persisted beside it
  // rather than from a world that has since moved (D-0022 rule 2). No clock, no
  // randomness, no ordering that depends on anything but the snapshot.
  expect(JSON.stringify(propose(FULL))).toBe(JSON.stringify(propose(FULL)));
  expect(JSON.stringify(propose(BARE))).not.toBe(JSON.stringify(propose(FULL)));
});

test("an elevated proposal carries the observation first and restates nothing", () => {
  // #41 section 3, as the layer sees it: what is elevated travels with its
  // basis, and the store's own claims follow **unaltered** rather than being
  // re-narrated around it. The observation is first because it is what the
  // elevation is about; everything after it is the context it was made in.
  const observation: Claim = {
    label: "observation",
    value: "the classification reason names a file that is not in this plan",
    basis: {
      form: "repository",
      path: "src/refrain/plan.ts",
      commit: "c0ffee",
      firstLine: 8,
      lastLine: 12,
    },
  };
  const elevated = proposeElevated(FULL, observation);

  expect(elevated.kind).toBe("explanation");
  // Not `store_rows`: one of these claims is the operator's, and saying
  // otherwise would report a person's own words as something rondo read.
  expect(elevated.derivation).toBe("operator_elevation");
  expect(DERIVATIONS).toContain(elevated.derivation);
  expect(elevated.payload.claims[0]).toEqual(observation);
  expect(elevated.payload.claims.slice(1)).toEqual(propose(FULL).payload.claims);
  // Every claim still carries a basis, the observation included: there is no
  // form of `Basis` that means "the operator said so".
  for (const claim of elevated.payload.claims) {
    expect(BASIS_FORMS).toContain(claim.basis.form);
  }
});

/**
 * The subject's own plan **second**, so that a recommendation found by position
 * would pick the wrong one.
 *
 * D-0022 rule 17 says a retry starts from the abandoned row's plan; the drafter
 * finds it by identity, and this fixture is what makes the difference between
 * that rule and "index 0" visible.
 */
const RETRY: RetrySnapshot = {
  iteration: FULL.iteration,
  successor: {
    iterationId: "iter-2",
    runId: "rondo-iter-2",
    topicBranch: "rondo/iter-2",
  },
  candidates: [
    {
      iterationId: "iter-0",
      status: "closed",
      planDigest: "sha256:aaa",
      contractDigest: "sha256:contract-of-the-predecessor",
    },
    {
      iterationId: FULL.iteration.id,
      status: "abandoned",
      planDigest: "sha256:bbb",
      contractDigest: "sha256:contract-of-the-subject",
    },
  ],
};

test("an option set carries exactly one recommendation, and it is the subject's own plan", () => {
  // D-0032 rule 1 with D-0034 rule 2, and D-0022 rule 17 for *which* option:
  // the retry starts from the plan of the row whose work was not taken. The
  // index is 1 here, so a drafter that recommended the first candidate -- or
  // that marked every option -- fails rather than passing on a fixture whose
  // order happened to agree with it.
  const proposal = proposeRetryPlan(RETRY);
  expect(proposal.kind).toBe("run_plan");
  // D-0032 rule 8's CHECK from this side: `derivation` is an explanation's.
  expect(proposal.derivation).toBe(null);
  expect(proposal.payload.options.length).toBe(2);
  expect(proposal.payload.recommended).toBe(1);
  const recommended = proposal.payload.options[proposal.payload.recommended];
  expect(recommended?.label).toContain("this iteration");
});

test("an option's value is the digest an approval would name, and its basis resolves", () => {
  // **The value is the contract digest and not the plan digest**, because
  // `human_decision.approved` references `composition.contract_digest`: an
  // option whose value were a plan digest would leave the operator approving
  // one fact and the ledger recording another. And every option carries a
  // basis on a claim's terms exactly (D-0032 rule 2, D-0034 rule 3), which is
  // only a citation if it resolves against the bytes that were kept.
  const proposal = proposeRetryPlan(RETRY);
  for (const [index, option] of proposal.payload.options.entries()) {
    expect(Object.keys(option).sort()).toEqual(["basis", "label", "value"]);
    expect(option.value).toBe(RETRY.candidates[index]?.contractDigest);
    expect(option.basis.form).toBe("snapshot");
    if (option.basis.form === "snapshot") {
      expect(resolve(RETRY, option.basis.pointer)).toBe(option.value);
    }
  }
});

test("a candidate list without the subject's own plan still recommends exactly one", () => {
  // The gatherer drops nothing today, but the drafter is total over the
  // snapshot it is handed (D-0022 rule 2): a set with no recommendation is the
  // one shape rule 1 does not admit, so the first option takes it.
  const proposal = proposeRetryPlan({
    ...RETRY,
    candidates: [RETRY.candidates[0]],
  });
  expect(proposal.payload.options.length).toBe(1);
  expect(proposal.payload.recommended).toBe(0);
});

test("the option set is pure: the same snapshot gives the same bytes", () => {
  expect(JSON.stringify(proposeRetryPlan(RETRY))).toBe(JSON.stringify(proposeRetryPlan(RETRY)));
});

/**
 * Candidate contracts with the subject's own **second**, so that a
 * recommendation found by position would pick the widening.
 */
const CONTRACTS: ContractSnapshot = {
  iteration: FULL.iteration,
  successor: {
    iterationId: "iter-2",
    runId: "rondo-iter-2",
    topicBranch: "rondo/iter-2",
  },
  candidates: [
    {
      from: { form: "promotedKey", key: "branch.push" },
      agentTypeId: "worker-basic",
      agentTypeDigest: "sha256:widened",
      granted: ["branch.push", "command.run"],
      askable: [],
      contractDigest: "sha256:contract-with-push-granted",
    },
    {
      from: { form: "iteration", iterationId: FULL.iteration.id },
      agentTypeId: "worker-basic",
      agentTypeDigest: "sha256:as-it-is",
      granted: ["command.run"],
      askable: ["branch.push"],
      contractDigest: "sha256:contract-as-it-is",
    },
  ],
};

test("neither approvable kind recommends more authority than the row already had", () => {
  // **`D-0009`'s division, kept at the level of the screen.** The advisory
  // proposes candidates and a *widening* is a human's decision, so the
  // recommendation is the candidate that changes nothing -- the row's own agent
  // type, unchanged. A person reaches for a widening; they never acquire one by
  // taking the default. The fixture puts the widening first, so a drafter that
  // recommended index 0 fails here.
  for (const proposal of [proposeAgentType(CONTRACTS), proposeContractKeys(CONTRACTS)]) {
    expect(proposal.derivation).toBe(null);
    expect(proposal.payload.recommended).toBe(1);
    const recommended = proposal.payload.options[proposal.payload.recommended];
    expect(recommended?.value).toBe("sha256:contract-as-it-is");
  }
});

test("every option names a distinct contract, cited where the snapshot keeps it", () => {
  // **Distinct values are what makes an option set answerable.**
  // `human_decision.approved` names a digest, so two options carrying one digest
  // would be two ways to record an approval the ledger cannot tell apart.
  for (const proposal of [proposeAgentType(CONTRACTS), proposeContractKeys(CONTRACTS)]) {
    const values = proposal.payload.options.map((option) => option.value);
    expect(new Set(values).size).toBe(values.length);
    for (const [index, option] of proposal.payload.options.entries()) {
      expect(option.basis.form).toBe("snapshot");
      if (option.basis.form === "snapshot") {
        expect(resolve(CONTRACTS, option.basis.pointer)).toBe(option.value);
      }
      expect(option.value).toBe(CONTRACTS.candidates[index]?.contractDigest);
    }
  }
});

test("a contract_keys option says which key it grants, and the other says it changes nothing", () => {
  // The label is the whole of what an operator reads before approving, so the
  // one motion each option makes has to be in it -- D-0022 rule 11's vocabulary
  // included: these are candidate inputs to a contract, never a permission
  // standing beside one.
  const options = proposeContractKeys(CONTRACTS).payload.options;
  expect(options[0]?.label).toContain("grant 'branch.push'");
  expect(options[1]?.label).toContain("leave the keys as they are");
  for (const option of options) {
    expect(option.label.toLowerCase()).not.toContain("permission");
  }
});

test("an agent_type option names the agent type and both of its lists", () => {
  const options = proposeAgentType(CONTRACTS).payload.options;
  expect(options[1]?.label).toContain("agent type 'worker-basic'");
  expect(options[1]?.label).toContain("command.run");
  // An empty list is a fact about the list rather than a blank on the screen,
  // which is `ABSENT`'s job everywhere else in this payload.
  expect(options[0]?.label).toContain(`asking for ${ABSENT}`);
});

// --- Reading a payload back (#39) -----------------------------------------

test("an option set round-trips, and the recommendation survives the trip", () => {
  // The reader is the inverse of `payloadDocument`, and what it has to preserve
  // is rule 1's *"exactly one marked as the recommendation"*: an option set
  // that read back with the recommendation somewhere else would be a framing
  // composed by the reader, which is the hazard #39 measures.
  const payload = {
    options: [
      { label: "widen", value: "sha256:aa", basis: { form: "iteration", iterationId: "i-1" } },
      { label: "leave it", value: "sha256:bb", basis: { form: "snapshot", pointer: "/a" } },
    ],
    recommended: 1,
  };

  expect(readPayload(payload)).toEqual({ kind: "options", payload });
});

test("a claim list reads back as claims, which is a different shape", () => {
  // D-0034 rule 1: an explanation carries claims and no recommendation, so the
  // two shapes are two arms rather than one shape with an optional field.
  const payload = {
    claims: [{ label: "status", value: "planned", basis: { form: "continuoRun", runId: "r-1" } }],
  };

  expect(readPayload(payload)).toEqual({ kind: "claims", payload });
});

test("a basis form outside the union is refused rather than guessed at", () => {
  // D-0032 rule 2. The closure is the point: a citation rondo cannot place
  // would be read by an operator as one rondo had checked.
  const outcome = readPayload({
    options: [{ label: "widen", value: "sha256:aa", basis: { form: "hearsay" } }],
    recommended: 0,
  });

  expect(outcome.kind).toBe("unreadable");
  expect(outcome.kind === "unreadable" && outcome.reason).toContain("hearsay");
});

test("a recommendation that names no option is unreadable", () => {
  // Rule 1 says exactly one option is the recommendation. An index out of range
  // is a proposal with none, and rendering it would silently promote whichever
  // option happened to be first.
  expect(
    readPayload({
      options: [
        { label: "widen", value: "sha256:aa", basis: { form: "iteration", iterationId: "i" } },
      ],
      recommended: 3,
    }).kind,
  ).toBe("unreadable");
  expect(readPayload({ options: [], recommended: 0 }).kind).toBe("unreadable");
  expect(readPayload({ neither: true }).kind).toBe("unreadable");
  // A claim with no basis is the summary #39 measured an operator approving on.
  expect(readPayload({ claims: [{ label: "a", value: "b" }] }).kind).toBe("unreadable");
});
