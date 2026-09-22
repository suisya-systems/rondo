/**
 * The decision record's one spelling (D-0098 rules 3.1, 3.3 and 3.5): the
 * numbers its headings and index rows carry, the shared-append exemption, and
 * the sentence a lap is handed its numbers in.
 */
import { expect, test } from "vitest";

import { nextNumbers, numbersSection } from "../../src/access/record-numbers.js";
import { readingOf } from "../../src/access/review.js";
import { readSplitPayload } from "../../src/advisory/proposal.js";
import { recordNumber, recordNumbers, sharedPaths } from "../../src/store/lanes.js";

test("headings and index rows are read, four digits or more, and a mention in the body is neither", () => {
  const text = [
    "## Index",
    "| D-0001 | first | accepted |",
    "| D-1112 | continuo's | accepted |",
    "",
    "## D-0001 — first",
    "It supersedes D-0000 and is cited as `D-0002`.",
    "## D-12345 — wide",
    "## D-0003 - an ASCII hyphen is not a heading",
    "| D-012 | three digits |",
  ].join("\n");
  expect(recordNumbers(text)).toEqual({ headings: [1, 12345], indexRows: [1, 1112] });
  expect(recordNumber(112)).toBe("D-0112");
  expect(recordNumber(12345)).toBe("D-12345");
});

test("the record is exempt from overlap on both sides, and nothing else is", () => {
  expect(sharedPaths(["DECISIONS.md"], ["/"], "DECISIONS.md")).toEqual([]);
  expect(sharedPaths(["/"], ["DECISIONS.md"], "DECISIONS.md")).toEqual([]);
  expect(sharedPaths(["DECISIONS.md", "src/x.ts"], ["/"], "DECISIONS.md")).toEqual(["src/x.ts"]);
  expect(sharedPaths(["DECISIONS.md"], ["DECISIONS.md"])).toEqual(["DECISIONS.md"]);
});

test("the numbers start above both the default branch and every reservation", () => {
  expect(nextNumbers(111, 104, 2)).toEqual([112, 113]);
  expect(nextNumbers(3, 9, 1)).toEqual([10]);
  expect(numbersSection("DECISIONS.md", [112])).toBe(
    "\n\n---\nDecision record (rondo reserved these numbers for this work):\n" +
      "Your entry in DECISIONS.md is D-0112, with its index row. Write no other number; " +
      "rondo checks the record's new headings and index rows against these at the gate.",
  );
  expect(numbersSection("DECISIONS.md", [112, 113, 114])).toContain(
    "Your entries in DECISIONS.md are D-0112, D-0113 and D-0114, each with its index row.",
  );
});

test("the gate finds every number a lap added that its line does not hold, and never passes an unread one", () => {
  const inspection = {
    kind: "read" as const,
    baseRef: "refs/remotes/origin/main",
    baseCommit: "a".repeat(40),
    tipCommit: "b".repeat(40),
    commits: [{ abbreviatedSha: "bbbbbbb", subject: "docs: decide" }],
    files: [{ path: "DECISIONS.md", added: 4, deleted: 0 }],
    uncommitted: [],
    checkedOut: "topic",
  };
  const read = (reserved: readonly number[], added: readonly number[] | { undetermined: string }) =>
    readingOf(inspection, { record: { path: "DECISIONS.md", reserved, added } });
  expect(read([112], [112])).toMatchObject({ verdict: "clear", findings: [] });
  expect(read([112], [112, 113]).findings).toEqual([
    "DECISIONS.md adds D-0113, which is not one of this line's reserved numbers " +
      "(this line holds D-0112; D-0098 rule 3.6)",
  ]);
  expect(read([], [7]).findings).toEqual([
    "DECISIONS.md adds D-0007, which is not one of this line's reserved numbers " +
      "(this line holds no number there; D-0098 rule 3.6)",
  ]);
  expect(read([112], { undetermined: "git said no" })).toMatchObject({
    verdict: "concerns",
    findings: [
      "what the topic branch added to DECISIONS.md could not be read, so its entry numbers " +
        "were not tested: git said no",
    ],
  });
});

test("a stored split keeps a plan's entries, and refuses a count that is not 1 or more", () => {
  const digest = `sha256:${"0".repeat(64)}`;
  const plan = { template_plan_digest: digest, prompt: "p", agent_type_digest: digest, bases: [] };
  const read = (entries: unknown) =>
    readSplitPayload({ plans: [{ ...plan, entries }], holes: [] } as never);
  expect(read(2)).toMatchObject({ kind: "split", payload: { plans: [{ entries: 2 }] } });
  expect(readSplitPayload({ plans: [plan], holes: [] })).toMatchObject({
    kind: "split",
    payload: { plans: [{ prompt: "p" }] },
  });
  for (const entries of [0, 1.5, "1"]) {
    expect(read(entries)).toMatchObject({ kind: "unreadable" });
  }
});
