/**
 * What rondo would ask for next, the layer's half (D-0097 points 2.3 (a) and
 * 6 (a)): the model's answer is checked for form, and the order is the goal's,
 * never the model's.
 */
import { expect, test } from "vitest";

import {
  decided,
  labelRank,
  materialDigest,
  materialDocument,
  mixesScripts,
  RUNNERS_UP,
  raised,
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
  openPoints: [{ point: "scope", recommendation: "the page only", raise: "dispute" as const }],
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
  expect(payload.read).toEqual({ issues: 5, stopped: 0, unlapped: 0 });
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

test("mixed scripts are letters of a script neither the operator's language nor English uses (rondo#492)", () => {
  const one = (request: string) => ({ ...judged("issue:o/r#1", 1), request });
  expect(mixesScripts(one("o/r の репозиторий を直す"), "ja")).toBe(true);
  expect(mixesScripts(one("o/r の README（ｒｅａｄｍｅ）を直す　ー"), "ja-JP")).toBe(false);
  expect(mixesScripts(one("Fix the репозиторий"), "en")).toBe(true);
  expect(mixesScripts(one("Исправить README"), "ru")).toBe(false);
  expect(mixesScripts({ ...one("ok"), why: "理由" }, "en")).toBe(true);
  // Unset or unlisted, nothing is checked; nor is a candidate against no clause.
  expect(mixesScripts(one("o/r の репозиторий"), null)).toBe(false);
  expect(mixesScripts(one("o/r の репозиторий"), "tlh")).toBe(false);
  expect(mixesScripts({ ...one("репозиторий"), clause: null }, "ja")).toBe(false);
  // The mark reads back as written.
  const payload = rankTriage(material([issue(1, [])]), [{ ...one("x"), mixedScript: true }]);
  const document = JSON.parse(JSON.stringify(triagePayloadDocument(payload)));
  expect(readTriagePayload(document)?.ranked[0]?.mixedScript).toBe(true);
});

test("a point says whether the person decides it, and rondo decides the rest (D-0193)", () => {
  const found: TriageMaterial = {
    ...material([issue(1)]),
    policies: [{ id: "policy-1", body: "Never touch the release workflow" }],
  };
  const answer = (openPoints: unknown) =>
    JSON.stringify({ candidates: [{ ...judged("issue:o/r#1", 1), openPoints }] });
  const read = readJudgement(
    found,
    answer([
      { point: "Which test runner", recommendation: "vitest", raise: null },
      { point: "Ship it to users", recommendation: "Behind a flag", raise: "dispute" },
      {
        point: "Edit release.yml",
        recommendation: "Leave it",
        raise: "policy",
        policy: "policy-1",
      },
    ]),
  );
  if (read.kind !== "judged") throw new Error(read.reason);
  const points = read.judged[0]?.openPoints ?? [];
  expect(raised(points).map((one) => one.raise)).toEqual(["dispute", "policy"]);
  expect(raised(points)[1]?.policy).toBe("policy-1");
  expect(decided(points).map((one) => one.point)).toEqual(["Which test runner"]);
  // Rule 3: refused whole when a point says nothing, says something else, or
  // names a policy that is not in force.
  for (const [bad, reason] of [
    [{ point: "p", recommendation: "r" }, "says nothing of why"],
    [{ point: "p", recommendation: "r", raise: "maybe" }, "says nothing of why"],
    [{ point: "p", recommendation: "r", raise: "policy", policy: "policy-9" }, "not in force"],
    [{ point: "p", recommendation: "r", raise: "policy" }, "not in force"],
  ] as const) {
    const refused = readJudgement(found, answer([bad]));
    expect(refused.kind === "refused" ? refused.reason : "").toContain(reason);
  }
  // The decided points read back as decided.
  const payload = rankTriage(found, read.judged);
  const document = JSON.parse(JSON.stringify(triagePayloadDocument(payload)));
  expect(readTriagePayload(document)).toEqual(payload);
  // A ranking written before D-0193 says nothing: every point of it was asked.
  const old = JSON.parse(JSON.stringify(document));
  for (const point of old.ranked[0].open_points) delete point.raise;
  expect(readTriagePayload(old)?.ranked[0]?.openPoints.map((one) => one.raise)).toEqual([
    "dispute",
    "dispute",
    "dispute",
  ]);
});

test("a store with no policy in force keeps its material's digest (D-0193 rule 3)", () => {
  const plain = material([issue(1)]);
  expect(materialDocument({ ...plain, policies: [] })).toEqual(materialDocument(plain));
  expect(materialDigest({ ...plain, policies: [] })).toBe(materialDigest(plain));
  expect(materialDigest({ ...plain, policies: [{ id: "p", body: "b" }] })).not.toBe(
    materialDigest(plain),
  );
});

test("a request without a lap is counted, moves the digest and reads back from the row (rondo#658)", () => {
  const unlapped: TriageCandidate = {
    key: "unlapped:m-1",
    source: { form: "unlapped", requestMessageId: "m-1" },
    title: "make setup run without a shell",
    labels: [],
  };
  const found = material([issue(1), unlapped]);
  expect(materialDigest(found)).not.toBe(materialDigest(material([issue(1)])));
  const payload = rankTriage(found, [judged("unlapped:m-1", 1)]);
  expect(payload.read).toEqual({ issues: 1, stopped: 0, unlapped: 1 });
  const document = triagePayloadDocument(payload);
  expect(readTriagePayload(document)).toEqual(payload);
  // A row written before rondo#658 read no such request.
  expect(readTriagePayload({ ...document, read: { issues: 1, stopped: 0 } })?.read).toEqual({
    issues: 1,
    stopped: 0,
    unlapped: 0,
  });
});
