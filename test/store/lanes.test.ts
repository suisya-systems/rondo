/**
 * The lane ledger's arithmetic (D-0073 rules 2.2, 3.3 and 6), without a store:
 * which paths a claim may name, which two overlap, and which laps of a tree
 * are the closed tips its landing is owed by.
 */
import { expect, test } from "vitest";

import {
  claimCover,
  claimCovers,
  claimPathRefusal,
  lineShape,
  mayBeOpen,
  normalizeClaim,
  pathsOverlap,
  sharedPaths,
} from "../../src/store/lanes.js";

test("a claimed path is repository-relative, '/' is the whole repository, and patterns are refused", () => {
  for (const path of ["/", "README.md", "src/", "src/store/sqlite.ts", "docs/operations/"]) {
    expect(claimPathRefusal(path)).toBeNull();
  }
  for (const path of [
    "",
    "/src",
    "src\\store",
    "src/*.ts",
    "src/?",
    "src/[ab]",
    "a//b",
    "./a",
    "a/../b",
    "src/./",
    "a\u0000b",
    "//",
  ]) {
    expect(claimPathRefusal(path)).not.toBeNull();
  }
});

test("a claim is deduplicated and sorted, and an empty one is a release rather than a claim", () => {
  expect(normalizeClaim(["src/", "README.md", "src/"])).toEqual({
    kind: "claim",
    paths: ["README.md", "src/"],
  });
  expect(normalizeClaim([]).kind).toBe("refused");
  expect(normalizeClaim(["ok.md", "src/*"]).kind).toBe("refused");
});

test("two paths overlap when equal or when one is a directory covering the other", () => {
  expect(pathsOverlap("src/a.ts", "src/a.ts")).toBe(true);
  expect(pathsOverlap("src/", "src/store/a.ts")).toBe(true);
  expect(pathsOverlap("src/store/a.ts", "src/")).toBe(true);
  expect(pathsOverlap("/", "anything.md")).toBe(true);
  expect(pathsOverlap("docs/", "/")).toBe(true);
  // A prefix of the name is not a directory above it.
  expect(pathsOverlap("src/", "srcx/a.ts")).toBe(false);
  expect(pathsOverlap("src", "src/a.ts")).toBe(false);
  expect(pathsOverlap("src/a.ts", "src/b.ts")).toBe(false);
  expect(sharedPaths(["docs/", "src/a.ts", "web/"], ["src/", "README.md"])).toEqual(["src/a.ts"]);
});

test("a closed lap a redo continues is not a tip, whatever the redo's end; a closed leaf is", () => {
  const lap = (id: string, status: string, supersedes: string | null = null) => ({
    id,
    status,
    supersedesIterationId: supersedes,
  });
  // A closed, revised into B, which failed: nothing is owed, and the line is not open.
  const revisedAway = lineShape([lap("a", "closed"), lap("b", "failed", "a")]);
  expect(revisedAway).toEqual({ inFlight: false, closedTips: [] });
  expect(mayBeOpen(revisedAway)).toBe(false);
  // Two branches of one tree: A's redo B closed, and a second redo C of A abandoned.
  const branched = lineShape([
    lap("a", "closed"),
    lap("b", "closed", "a"),
    lap("c", "abandoned", "a"),
  ]);
  expect(branched).toEqual({ inFlight: false, closedTips: ["b"] });
  expect(mayBeOpen(branched)).toBe(true);
  // A lap at its gate holds the line open whatever its diff says.
  expect(lineShape([lap("a", "closed"), lap("b", "awaiting_human", "a")])).toEqual({
    inFlight: true,
    closedTips: [],
  });
});

test("D-0073 rule 5: a changed path a claim cannot spell is covered by the directory above it", () => {
  expect(claimCover("src/store/sqlite.ts")).toBe("src/store/sqlite.ts");
  expect(claimCover("src/*/x.ts")).toBe("src/");
  expect(claimCover("a\\b/c.ts")).toBe("/");
});

test("D-0073 rule 5: a changed path is inside a claim only when the claim covers it", () => {
  expect(claimCovers(["src/"], "src/a.ts")).toBe(true);
  expect(claimCovers(["src/a.ts"], "src/a.ts")).toBe(true);
  // A cover that only overlaps a narrower claim is outside it.
  expect(claimCovers(["src/a.ts"], "src/")).toBe(false);
  expect(claimCovers(["docs/"], "/")).toBe(false);
});
