/**
 * What rondo would ask for next, the layer's half (D-0097 points 2.3 (a) and
 * 6 (a)): the model's answer is checked for form, and the order is the goal's,
 * never the model's.
 */
import { expect, test } from "vitest";

import {
  labelRank,
  RUNNERS_UP,
  rankTriage,
  readJudgement,
  readTriagePayload,
  type TriageCandidate,
  type TriageMaterial,
  triagePayloadDocument,
} from "../../src/advisory/triage.js";

const issue = (number: number, labels: string[] = []): TriageCandidate => ({
  key: `issue:o/r#${String(number)}`,
  source: { form: "issue", repository: "o/r", number },
  title: `issue ${String(number)}`,
  labels,
});

const material = (candidates: TriageCandidate[], putAside: string[] = []): TriageMaterial => ({
  repository: "o/r",
  goalId: "goal-1",
  clauses: [
    { said: "they never open a terminal", unmetIf: "a terminal is ever required" },
    { said: "no word has to be asked about", unmetIf: "a word has to be asked about" },
  ],
  candidates,
  putAside,
});

const judged = (key: string, clause: number | null) => ({
  key,
  clause,
  request: `do ${key} in o/r`,
  why: "because",
  openPoints: [{ point: "scope", recommendation: "the page only" }],
});

test("the order is the clause, then an explicit label, then the order found; the model's order is ignored", () => {
  const found = material([
    issue(1),
    issue(2, ["priority:high"]),
    issue(3),
    issue(4),
    issue(5, ["P0"]),
  ]);
  const payload = rankTriage(found, [
    judged("issue:o/r#1", 2),
    judged("issue:o/r#2", 2),
    judged("issue:o/r#3", 1),
    judged("issue:o/r#4", null),
    judged("issue:o/r#5", 2),
  ]);
  expect(payload.ranked.map((one) => one.key)).toEqual([
    "issue:o/r#3",
    "issue:o/r#5",
    "issue:o/r#2",
    "issue:o/r#1",
  ]);
  expect(payload.withheld).toEqual([{ key: "issue:o/r#4", why: "no_clause" }]);
  expect(payload.read).toEqual({ issues: 5, stopped: 0 });
});

test("nothing is dropped silently: put aside, not judged and below the runners-up are withheld with their rule", () => {
  const many = Array.from({ length: RUNNERS_UP + 4 }, (_, at) => issue(at + 1));
  const payload = rankTriage(
    material(many, ["issue:o/r#1"]),
    many.slice(1, RUNNERS_UP + 3).map((one) => judged(one.key, 1)),
  );
  expect(payload.ranked).toHaveLength(1 + RUNNERS_UP);
  expect(payload.withheld).toEqual([
    { key: "issue:o/r#1", why: "put_aside" },
    { key: `issue:o/r#${String(RUNNERS_UP + 3)}`, why: "below" },
    { key: `issue:o/r#${String(RUNNERS_UP + 4)}`, why: "not_judged" },
  ]);
});

test("labelRank reads the person's stated priority and nothing else", () => {
  expect(labelRank(["priority:critical"])).toBe(0);
  expect(labelRank(["P1", "bug"])).toBe(1);
  expect(labelRank(["enhancement"])).toBe(2);
  expect(labelRank(["priority: low"])).toBe(3);
  expect(labelRank(["priority:low", "bug"])).toBe(3);
  expect(labelRank(["priority:low", "p0"])).toBe(0);
});

test("an answer is refused whole on the first fault in form", () => {
  const found = material([issue(1), issue(2)], ["issue:o/r#2"]);
  const answer = (candidates: unknown) => JSON.stringify({ candidates });
  expect(readJudgement(found, `here: ${answer([judged("issue:o/r#1", 1)])}`).kind).toBe("judged");
  for (const [bad, reason] of [
    ["no json at all", "holds no JSON"],
    [answer([judged("issue:o/r#9", 1)]), "not given"],
    // A candidate the person put aside was never offered, so it cannot be judged.
    [answer([judged("issue:o/r#2", 1)]), "not given"],
    [answer([judged("issue:o/r#1", 1), judged("issue:o/r#1", 1)]), "twice"],
    [answer([judged("issue:o/r#1", 3)]), "clause the goal does not have"],
    [answer([{ ...judged("issue:o/r#1", 1), request: "two\nlines" }]), "one-line request"],
    [
      answer([
        { ...judged("issue:o/r#1", 1), openPoints: [{ point: "scope", recommendation: "" }] },
      ]),
      "without a recommendation",
    ],
  ] as const) {
    const read = readJudgement(found, bad);
    expect(read.kind).toBe("refused");
    expect(read.kind === "refused" ? read.reason : "").toContain(reason);
  }
  // A candidate against no clause needs no request: it is withheld, not drafted.
  expect(readJudgement(found, answer([{ key: "issue:o/r#1", clause: null }])).kind).toBe("judged");
});

test("a payload reads back as it was written, and a row that will not read is not drawn", () => {
  const payload = rankTriage(material([issue(1, ["P1"])]), [judged("issue:o/r#1", 1)]);
  const document = JSON.parse(JSON.stringify(triagePayloadDocument(payload)));
  expect(readTriagePayload(document)).toEqual(payload);
  expect(readTriagePayload({ ...document, ranked: [{ key: "x" }] })).toBeNull();
});
