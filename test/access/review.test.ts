/**
 * The deterministic reading of a lap's work (D-0029 rule 5).
 *
 * Every case here runs with no repository on disk, which is the property rule 5
 * buys by keeping `git` in `forge.ts` and judgement in `review.ts`. It is also
 * D-0019 rule 7's second reason still standing: a verdict that cannot be a unit
 * case is a verdict this repository does not admit, and these are the cases.
 */
import { expect, test } from "vitest";

import type { LapWorkInspection } from "../../src/access/forge.js";
import {
  DETERMINISTIC_DRAFTER,
  evidenceOf,
  materialDigestOf,
  readingOf,
} from "../../src/access/review.js";

const BASE = "b".repeat(40);
const TIP = "a".repeat(40);

/** A workspace git could read, with one commit and one file unless varied. */
function read(
  parts: Partial<Extract<LapWorkInspection, { kind: "read" }>> = {},
): Extract<LapWorkInspection, { kind: "read" }> {
  return {
    kind: "read",
    baseRef: "refs/remotes/origin/main",
    baseCommit: BASE,
    tipCommit: TIP,
    commits: [{ abbreviatedSha: "cfa4502", subject: "feat: do the thing" }],
    files: [{ path: "src/thing.ts", added: 12, deleted: 3 }],
    ...parts,
  };
}

test("a workspace that could not be read is 'unavailable' and never 'clear'", () => {
  // **The fail-open this stage exists to refuse.** A workspace nobody could
  // read and a workspace that was read and found fine are different facts, and
  // a reader that answered `clear` here would leave a record saying a reading
  // happened where none did -- with `publish` then waving it through. Deleting
  // this branch is the mutation that must make this file red.
  const reading = readingOf({ kind: "unreadable", reason: "no such directory" });

  expect(reading.verdict).toBe("unavailable");
  expect(reading.evidence).toBeNull();
  expect(reading.unavailableReason).toBe("no such directory");
  expect(reading.findings).toEqual([]);
});

test("a lap that added commits and files reads clear, with its evidence", () => {
  const reading = readingOf(read());

  expect(reading.verdict).toBe("clear");
  expect(reading.findings).toEqual([]);
  expect(reading.unavailableReason).toBeNull();
  expect(reading.drafter).toBe(DETERMINISTIC_DRAFTER);
  expect(reading.evidence).toEqual({
    baseRef: "refs/remotes/origin/main",
    baseCommit: BASE,
    tipCommit: TIP,
    materialDigest: materialDigestOf(read()),
    commitCount: 1,
    fileCount: 1,
  });
});

test("a clear reading always carries the measurement it was taken over", () => {
  // The obligation D-0029 rule 11 puts on the store, checked at the source as
  // well: a `clear` whose evidence is absent is refused there, and a reader
  // that could produce one would be turning its own verdicts into
  // `unavailable` rows for no reason a person could act on.
  const evidence = readingOf(read()).evidence;

  expect(evidence).not.toBeNull();
  expect(evidence?.tipCommit).not.toBe("");
  expect(evidence?.materialDigest.startsWith("sha256:")).toBe(true);
});

test("a branch standing on its base raises the point, whatever the log says", () => {
  // The reset-to-base case, and the reason the tip check is not the commit
  // count: `git log --no-merges` would report the same zero for a branch that
  // is somewhere else entirely.
  const reading = readingOf(read({ tipCommit: BASE, commits: [], files: [] }));

  expect(reading.verdict).toBe("concerns");
  expect(reading.findings.some((line) => line.includes("same commit as"))).toBe(true);
  expect(reading.evidence?.tipCommit).toBe(BASE);
});

test("a branch that is elsewhere but adds no non-merge commits says which it is", () => {
  const reading = readingOf(read({ commits: [] }));

  expect(reading.verdict).toBe("concerns");
  expect(reading.findings.some((line) => line.includes("no non-merge commits"))).toBe(true);
  expect(reading.findings.some((line) => line.includes("same commit as"))).toBe(false);
});

test("a lap that changed no files raises that separately from its commits", () => {
  const reading = readingOf(read({ files: [] }));

  expect(reading.verdict).toBe("concerns");
  expect(reading.findings).toEqual([
    "the topic branch changes no files against refs/remotes/origin/main",
  ]);
});

test("the digest is over what was read, so a moved tip is a different digest", () => {
  // What D-0029 rule 10's staleness check compares. A digest that ignored the
  // tip would pass for a branch that had been amended into different content
  // under the same file list.
  const before = materialDigestOf(read());
  const moved = materialDigestOf(read({ tipCommit: "f".repeat(40) }));
  const edited = materialDigestOf(
    read({ files: [{ path: "src/thing.ts", added: 13, deleted: 3 }] }),
  );

  expect(moved).not.toBe(before);
  expect(edited).not.toBe(before);
  expect(materialDigestOf(read())).toBe(before);
});

test("evidenceOf and readingOf compute the same measurement", () => {
  // Two spellings of "the same work" would be a staleness check that passed
  // for the wrong reason: `publish` builds its half with `evidenceOf` and the
  // stored half came from `readingOf`.
  expect(readingOf(read()).evidence).toEqual(evidenceOf(read()));
});

test("the drafter is versioned, so an old row does not read as today's rules", () => {
  expect(DETERMINISTIC_DRAFTER).toMatch(/^rondo\/deterministic\/\d+$/);
});
