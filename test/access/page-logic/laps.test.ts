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
  });
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
