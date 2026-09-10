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
  type AdvisorySnapshot,
  BASIS_FORMS,
  type Claim,
  DERIVATIONS,
  propose,
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
    "revision of",
    "gate",
  ]) {
    expect(labelled(bare, label).value).toBe(UNDETERMINED);
  }
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

test("a snapshot basis points at a field the persisted snapshot actually has", () => {
  // **The citation is checked rather than trusted.** A pointer is only worth
  // storing if following it lands somewhere, and the snapshot is the document
  // the store keeps verbatim -- so this resolves each pointer against the very
  // value handed to `propose`.
  const resolve = (document: unknown, pointer: string): unknown =>
    pointer
      .split("/")
      .slice(1)
      .reduce<unknown>(
        (at, step) => (at === null || typeof at !== "object" ? undefined : Reflect.get(at, step)),
        document,
      );
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
