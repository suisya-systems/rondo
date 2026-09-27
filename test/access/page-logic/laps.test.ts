/**
 * What the worker itself ran, read off the lap's commands (DECISIONS.md
 * D-0104, rondo#410): the counts are the runner's own, and a lap with no
 * readable record is never a zero.
 */
import { expect, test } from "vitest";
import { testSummary, workerRuns } from "../../../src/access/page-logic/laps.js";

const command = (index: number, cmd: string, output: string, isError = false) => ({
  index,
  command: cmd,
  output,
  output_omitted_chars: 0,
  is_error: isError,
});

test("each runner's summary line is read, and vitest's `Test Files` line is not", () => {
  const vitest =
    " Test Files  98 passed (98)\n      Tests  1 failed | 1841 passed | 2 skipped (1844)\n";
  expect(testSummary(vitest)).toEqual({ passed: 1841, failed: 1, skipped: 2 });
  expect(testSummary(" Test Files  98 passed (98)\n")).toBeNull();
  expect(testSummary("Tests:       1 failed, 2 skipped, 40 passed, 43 total")).toEqual({
    passed: 40,
    failed: 1,
    skipped: 2,
  });
  expect(testSummary("==== 3 failed, 40 passed, 2 skipped, 1 error in 1.20s ====")).toEqual({
    passed: 40,
    failed: 4,
    skipped: 2,
  });
  // Coloured output is read through its escapes; a banner is not a summary.
  expect(testSummary("\u001b[2m      Tests \u001b[22m \u001b[32m5 passed\u001b[39m (5)")).toEqual({
    passed: 5,
    failed: 0,
    skipped: 0,
  });
  expect(testSummary("===== short test summary info =====")).toBeNull();
  // pytest -q drops the rules; a line that only ends in a duration is not one.
  expect(testSummary("1 failed, 3 passed in 0.20s")).toEqual({ passed: 3, failed: 1, skipped: 0 });
  expect(testSummary("Done in 0.20s")).toBeNull();
});

test("a later failing quiet pytest run is the one shown, not an earlier passing one", () => {
  const runs = workerRuns(
    JSON.stringify([
      command(5, "pytest", "==== 4 passed in 0.30s ===="),
      command(9, "pytest -q", "..F.\n1 failed, 3 passed in 0.20s", true),
    ]),
  );
  expect(runs).toMatchObject({ kind: "ran", last: { index: 9, failed: 1 }, earlier: 1 });
});

test("the last run is shown with how many came before, and its own error flag", () => {
  const runs = workerRuns(
    JSON.stringify([
      command(3, "npx vitest run test/a.test.ts", "      Tests  4 passed (4)"),
      command(9, "git status", "clean"),
      command(41, "npm run verify", "      Tests  1844 passed (1844)\nlint failed", true),
    ]),
  );
  expect(runs).toEqual({
    kind: "ran",
    last: {
      index: 41,
      command: "npm run verify",
      passed: 1844,
      failed: 0,
      skipped: 0,
      isError: true,
    },
    earlier: 1,
    supersededBy: null,
  });
});

test("a deliberate failing run is superseded by a later clean test command, and only one whose exit status is the suite's (rondo#497)", () => {
  const failing = command(
    12,
    "npx vitest run test/a.test.ts",
    "      Tests  1 failed | 4 passed (5)",
    true,
  );
  const after = (cmd: string, isError = false) =>
    workerRuns(
      JSON.stringify([
        failing,
        command(20, "git checkout src/a.ts", ""),
        command(30, cmd, "", isError),
      ]),
    );
  for (const cmd of [
    "npm run verify > $TMPDIR/v.log 2>&1",
    "npm test && git status",
    "npx vitest run",
    "pytest -q",
  ]) {
    expect(after(cmd)).toMatchObject({
      kind: "ran",
      last: { index: 12, failed: 1 },
      supersededBy: { index: 30, command: cmd },
    });
  }
  // An error, a hidden exit status, or a command that is not a test run supersedes nothing.
  for (const [cmd, isError] of [
    ["npm run verify", true],
    ["npm run verify | tail -3", false],
    ["npm test; echo done", false],
    ["npm test || true", false],
    ["npm test &", false],
    ["git commit -m fix", false],
  ] as const) {
    expect(after(cmd, isError)).toMatchObject({
      kind: "ran",
      last: { index: 12 },
      supersededBy: null,
    });
  }
  // A clean run before the failure does not supersede it.
  expect(
    workerRuns(JSON.stringify([command(2, "npm run verify > log", ""), failing])),
  ).toMatchObject({ supersededBy: null });
});

test("no readable record is `unrecorded`, and no summary is `none` -- never a zero", () => {
  expect(workerRuns(null)).toEqual({ kind: "unrecorded" });
  expect(workerRuns("null")).toEqual({ kind: "unrecorded" });
  expect(workerRuns("{not json")).toEqual({ kind: "unrecorded" });
  expect(workerRuns(JSON.stringify([command(1, "ls", "a b")]))).toEqual({
    kind: "none",
    commandCount: 1,
  });
});
