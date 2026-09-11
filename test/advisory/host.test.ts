/**
 * `proposeHost` over hand-built host snapshots, and nothing else (D-0037
 * rules 1-3).
 *
 * **No database and no composition root**, which is the property rule 1 kept by
 * making the between-laps material a fourth *snapshot* rather than a fourth
 * component: the drafter is still a pure function of what it was handed, so the
 * three claim families can be checked against a world a test wrote by hand.
 *
 * Four properties are asserted that nothing else in the suite can see:
 *
 *  - **every family is emitted for every snapshot, including an empty one**
 *    (rule 3's totality -- a family that fell silent when it found nothing
 *    would make *"rondo looked and there is no adjacency"* and *"rondo did not
 *    look"* the same screen);
 *  - **an adjacency is an adjacency and not a collision** (rule 3a): what the
 *    claim carries is the base branch and the `D-0023` triples, and there is no
 *    score, no confidence and no assertion about the work inside the branches;
 *  - **shared material is equality over the finding's text and says so**
 *    (rule 3b), with the ceiling asserted directly: two readings describing one
 *    defect in different words are invisible, and that is the stated limit
 *    rather than a bug this file would be hiding;
 *  - **every claim carries a basis, and the result binds nothing** -- an
 *    `Explanation` with no recommendation, on `propose`'s terms exactly.
 */
import { expect, test } from "vitest";

import {
  ABSENT,
  BASIS_FORMS,
  type Claim,
  type HostSnapshot,
  proposeHost,
  type SnapshotIteration,
  type SnapshotLap,
  UNDETERMINED,
} from "../../src/advisory/proposal.js";

const iteration = (id: string): SnapshotIteration => ({
  id,
  status: "performing",
  request: `do ${id}`,
  planDigest: `sha256:${"a".repeat(64)}`,
  attempts: 1,
  supersedesIterationId: null,
  continuoRevision: "603843b",
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
});

const lap = (
  id: string,
  baseBranch: string | null,
  findings: readonly string[] = [],
): SnapshotLap => ({
  iteration: iteration(id),
  runId: `rondo-${id}`,
  topicBranch: `rondo/${id}`,
  workspace: `/srv/work/${id}`,
  baseBranch,
  readings:
    findings.length === 0
      ? []
      : [
          {
            drafter: "rondo/reader/deterministic@1",
            verdict: "concerns",
            findings: [...findings],
            unavailableReason: null,
          },
        ],
});

const host = (over: Partial<HostSnapshot> = {}): HostSnapshot => ({
  laps: [],
  unreadable: [],
  bounds: { maxOccupying: 1, maxLive: 3, occupying: 0, live: 0 },
  refusals: [],
  ...over,
});

/** The claims, as `label -> the values claimed under it`. */
function claimed(snapshot: HostSnapshot): Map<string, string[]> {
  const byLabel = new Map<string, string[]>();
  for (const claim of proposeHost(snapshot).payload.claims) {
    byLabel.set(claim.label, [...(byLabel.get(claim.label) ?? []), claim.value]);
  }
  return byLabel;
}

/** Every claim whose label starts with one of the family's phrasings. */
function labelled(snapshot: HostSnapshot, prefix: string): readonly Claim[] {
  return proposeHost(snapshot).payload.claims.filter((claim) => claim.label.startsWith(prefix));
}

// --- rule 3's totality ----------------------------------------------------

test("every family speaks on an empty host, and says it found nothing rather than nothing", () => {
  const empty = claimed(host());

  // Not "no claims", and not a missing section: rondo looked at zero laps and
  // each family says so in its own words.
  expect(empty.get("live laps")).toEqual(["0"]);
  expect(empty.get("two live laps open against one base branch")).toEqual([ABSENT]);
  expect(empty.get("one finding read on more than one live lap")).toEqual([ABSENT]);
  expect(empty.get("an admission a bound refused")).toEqual([ABSENT]);
  // And the capacity family reports the bounds themselves, which is the half
  // an operator reads even when nothing has been refused.
  expect(empty.get("bound 'maxOccupying'")).toEqual(["1"]);
  expect(empty.get("bound 'maxLive'")).toEqual(["3"]);
});

test("every claim carries a basis of a form the union admits, and nothing is recommended", () => {
  const proposal = proposeHost(
    host({
      laps: [
        lap("i-1", "main", ["the fence is wrong"]),
        lap("i-2", "main", ["the fence is wrong"]),
      ],
      bounds: { maxOccupying: 1, maxLive: 3, occupying: 1, live: 2 },
      refusals: [
        {
          refusedAtMs: 1_000,
          request: "a third thing",
          boundName: "maxLive",
          bound: 3,
          occupancy: 3,
        },
      ],
    }),
  );

  expect(proposal.kind).toBe("explanation");
  expect(proposal.derivation).toBe("store_rows");
  // An explanation binds nothing, so there is no `recommended` on it at all --
  // the payload is claims, and a recommendation would be the third voice
  // acquiring the grammar of the first.
  expect(proposal.payload).not.toHaveProperty("recommended");
  expect(proposal.payload.claims.length).toBeGreaterThan(0);
  for (const claim of proposal.payload.claims) {
    expect(BASIS_FORMS).toContain(claim.basis.form);
    expect(claim.label).not.toBe("");
  }
});

test("the same snapshot gives the same bytes", () => {
  const snapshot = host({
    laps: [lap("i-1", "main", ["x"]), lap("i-2", "main", ["x"]), lap("i-3", null)],
  });
  // Pure and total, on `propose`'s terms: what makes a proposal re-derivable
  // from the snapshot persisted beside it rather than from a world that has
  // since moved.
  expect(JSON.stringify(proposeHost(snapshot))).toBe(JSON.stringify(proposeHost(snapshot)));
});

// --- rule 3a: adjacency, and not collision --------------------------------

test("two laps open against one base branch are named, with their D-0023 triples", () => {
  const snapshot = host({ laps: [lap("i-1", "main"), lap("i-2", "main")] });
  const adjacency = labelled(snapshot, "open against 'main' beside");

  expect(adjacency).toHaveLength(2);
  // Each side names the other, so an operator reading either line knows where
  // the other working tree is without re-reading the list.
  expect(adjacency[0]?.label).toContain("'i-2'");
  expect(adjacency[1]?.label).toContain("'i-1'");
  // The triple is what a person goes and looks at: the run, the branch and the
  // workspace.
  expect(adjacency[0]?.value).toContain("run rondo-i-1");
  expect(adjacency[0]?.value).toContain("branch rondo/i-1");
  expect(adjacency[0]?.value).toContain("workspace /srv/work/i-1");
  // And the basis resolves into the snapshot rather than asserting anything.
  expect(adjacency[0]?.basis).toEqual({ form: "snapshot", pointer: "/laps/0/iteration/id" });
});

test("an adjacency claims no collision: no decision id, no migration, no score", () => {
  const proposal = proposeHost(host({ laps: [lap("i-1", "main"), lap("i-2", "main")] }));
  const rendered = JSON.stringify(proposal).toLowerCase();

  // **`D-0033` rule 9's gap, asserted as still open.** Reading a decision id or
  // a migration number needs a reader across branches nothing in rondo has, so
  // a claim that used those words would be rondo asserting an absence it cannot
  // observe -- which is the error rule 9 was corrected for once already.
  expect(rendered).not.toContain("collision");
  expect(rendered).not.toContain("conflict");
  expect(rendered).not.toContain("migration");
  // And no similarity score anywhere: `Claim` has three fields and no fourth.
  for (const claim of proposal.payload.claims) {
    expect(Object.keys(claim).sort()).toEqual(["basis", "label", "value"]);
  }
});

test("laps on different base branches are not adjacent, and the family still speaks", () => {
  const apart = claimed(host({ laps: [lap("i-1", "main"), lap("i-2", "release/2")] }));

  expect(apart.get("two live laps open against one base branch")).toEqual([ABSENT]);
  // The control: the same two laps on one base branch are adjacent, so the
  // `none` above is a fact about the base branches and not about the grouping
  // having stopped working.
  expect(
    labelled(host({ laps: [lap("i-1", "main"), lap("i-2", "main")] }), "open against"),
  ).toHaveLength(2);
});

test("three laps on one base name the other two, and a fourth elsewhere is left out of it", () => {
  const adjacency = labelled(
    host({
      laps: [lap("i-1", "main"), lap("i-2", "main"), lap("i-3", "main"), lap("i-4", "next")],
    }),
    "open against 'main' beside",
  );

  expect(adjacency).toHaveLength(3);
  expect(adjacency[0]?.label).toContain("'i-2'");
  expect(adjacency[0]?.label).toContain("'i-3'");
  expect(JSON.stringify(adjacency)).not.toContain("i-4");
});

test("a lap whose base branch would not decode is undetermined, not quietly ungrouped", () => {
  const snapshot = host({ laps: [lap("i-1", "main"), lap("i-2", "main"), lap("i-3", null)] });
  const unknown = labelled(snapshot, "open against").filter(
    (claim) => claim.value === UNDETERMINED,
  );

  // "rondo looked and these are not adjacent" and "rondo could not tell" are
  // different answers, and the second one has to survive to the screen.
  expect(unknown).toHaveLength(1);
  expect(unknown[0]?.basis).toEqual({ form: "snapshot", pointer: "/laps/2/baseBranch" });
  // The readable pair is still grouped: one lap rondo cannot place does not
  // cost the operator the adjacency it can.
  expect(labelled(snapshot, "open against 'main' beside")).toHaveLength(2);
});

test("two laps whose base branches both fail to decode are two undetermined claims, not an adjacency", () => {
  const snapshot = host({ laps: [lap("i-1", null), lap("i-2", null)] });
  const claims = claimed(snapshot);

  // The failure this rules out: grouping by a null and reporting two
  // unreadable plans as two laps open against the same branch.
  expect(claims.get("open against")).toEqual([UNDETERMINED, UNDETERMINED]);
  expect(claims.get("two live laps open against one base branch")).toEqual([ABSENT]);
});

// --- rule 3b: shared material, and its stated ceiling ---------------------

test("one finding read on two live laps is claimed on both sides, each cited as an iteration", () => {
  const shared = labelled(
    host({
      laps: [
        lap("i-1", "main", ["the retry fence is not fenced", "a second thing"]),
        lap("i-2", "next", ["the retry fence is not fenced"]),
      ],
    }),
    "a finding on 2 live laps",
  );

  expect(shared).toHaveLength(2);
  expect(shared.map((claim) => claim.value)).toEqual([
    "the retry fence is not fenced",
    "the retry fence is not fenced",
  ]);
  // **Each side cited by an `iteration` basis**, because what an operator needs
  // from a shared finding is the two laps to go and open.
  expect(shared.map((claim) => claim.basis)).toEqual([
    { form: "iteration", iterationId: "i-1" },
    { form: "iteration", iterationId: "i-2" },
  ]);
  // The finding read on one lap only is not claimed as shared.
  expect(JSON.stringify(shared)).not.toContain("a second thing");
});

test("the ceiling is equality over the text, and it is stated rather than discovered", () => {
  // Two readings describing one defect in different words. rule 3b says out
  // loud that this is invisible to it; the alternative refused is similarity
  // scoring, which would give the drafter a confidence to narrate.
  const different = claimed(
    host({
      laps: [
        lap("i-1", "main", ["the retry fence is not fenced"]),
        lap("i-2", "next", ["retries escape the fence"]),
      ],
    }),
  );
  expect(different.get("one finding read on more than one live lap")).toEqual([ABSENT]);

  // The control, one character apart: the same sentence on both laps is found.
  const same = claimed(
    host({
      laps: [
        lap("i-1", "main", ["the retry fence is not fenced"]),
        lap("i-2", "next", ["the retry fence is not fenced"]),
      ],
    }),
  );
  expect(same.get("one finding read on more than one live lap")).toBeUndefined();
  expect(same.get("a finding on 2 live laps")).toHaveLength(2);
});

test("two readers of one lap agreeing is one lap's finding, not a lap sharing with itself", () => {
  const twice: SnapshotLap = {
    ...lap("i-1", "main"),
    readings: [
      {
        drafter: "rondo/reader/deterministic@1",
        verdict: "concerns",
        findings: ["one thing"],
        unavailableReason: null,
      },
      {
        drafter: "some/model/reader",
        verdict: "concerns",
        findings: ["one thing"],
        unavailableReason: null,
      },
    ],
  };

  expect(
    claimed(host({ laps: [twice] })).get("one finding read on more than one live lap"),
  ).toEqual([ABSENT]);
});

test("a finding on three laps says three, and names all three sides", () => {
  const shared = labelled(
    host({
      laps: [lap("i-1", "main", ["x"]), lap("i-2", "main", ["x"]), lap("i-3", "release/2", ["x"])],
    }),
    "a finding on 3 live laps",
  );

  expect(shared).toHaveLength(3);
  expect(shared.map((claim) => claim.basis)).toEqual([
    { form: "iteration", iterationId: "i-1" },
    { form: "iteration", iterationId: "i-2" },
    { form: "iteration", iterationId: "i-3" },
  ]);
});

// --- rule 3c: capacity, and rondo taking no act ---------------------------

test("the bounds, what stands against them, and what they refused are all claimed", () => {
  const claims = claimed(
    host({
      bounds: { maxOccupying: 2, maxLive: 5, occupying: 2, live: 4 },
      refusals: [
        {
          refusedAtMs: 1_000,
          request: "teach revise to name its flags",
          boundName: "maxOccupying",
          bound: 2,
          occupancy: 2,
        },
        {
          refusedAtMs: 2_000,
          request: "something else",
          boundName: "maxLive",
          bound: 5,
          occupancy: 5,
        },
      ],
    }),
  );

  expect(claims.get("bound 'maxOccupying'")).toEqual(["2"]);
  expect(claims.get("occupying now")).toEqual(["2"]);
  expect(claims.get("bound 'maxLive'")).toEqual(["5"]);
  expect(claims.get("live now")).toEqual(["4"]);
  const refused = claims.get("an admission a bound refused") ?? [];
  expect(refused).toHaveLength(2);
  expect(refused[0]).toContain("teach revise to name its flags");
  expect(refused[0]).toContain("'maxOccupying' 2 at occupancy 2");
});

test("an occupancy of zero is a number and not an absence", () => {
  // `claim()` renders an empty string as `undetermined`; "0" is a value, and a
  // host with nothing running has to be able to say so.
  expect(claimed(host()).get("occupying now")).toEqual(["0"]);
  expect(claimed(host()).get("live now")).toEqual(["0"]);
});

test("rondo takes no act on capacity: the claims name no verb it would run", () => {
  const rendered = JSON.stringify(
    proposeHost(
      host({
        bounds: { maxOccupying: 1, maxLive: 3, occupying: 1, live: 3 },
        refusals: [{ refusedAtMs: 1, request: "r", boundName: "maxLive", bound: 3, occupancy: 3 }],
      }),
    ),
  ).toLowerCase();

  // `D-0033` rule 3: the refusal side is already owned and already counted, and
  // an advisory that could withhold an admission by itself would be the
  // advisory deciding. The claims report; they do not instruct.
  expect(rendered).not.toContain("you should");
  expect(rendered).not.toContain("recommend");
  expect(rendered).not.toContain("raise the bound");
});

// --- what is in the snapshot and has no claims of its own -----------------

test("a live lap that will not decode is on the screen rather than missing from it", () => {
  const claims = claimed(
    host({
      laps: [lap("i-1", "main")],
      unreadable: [{ id: "i-broken", reason: "plan is not an object" }],
    }),
  );

  // It holds a slot, so a composition that dropped it would be wrong about what
  // is running in exactly the case that needs a person.
  expect(claims.get("a live lap rondo could not read")).toEqual([
    "i-broken: plan is not an object",
  ]);
  // And the count of laps stays a count of the laps that have claims, so the
  // two numbers beside each other are each honest about what they are.
  expect(claims.get("live laps")).toEqual(["1"]);
});
