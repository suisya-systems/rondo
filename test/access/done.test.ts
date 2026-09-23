/**
 * rondo#377: every lap's prompt carries the same definition of done, whatever
 * the request says -- commit, run the repository's own install and
 * verification, and say so when it cannot run -- so lap 11's one-line request
 * would not have ended on an empty branch (`docs/operations/lap-11-dogfood.md`
 * N-47).
 */
import { expect, test } from "vitest";

import { withNamedIssues } from "../../src/access/cli.js";
import { closingLapSection, DONE_OPENING, definitionOfDone } from "../../src/access/done.js";
import { readRunPlan } from "../../src/refrain/plan.js";
import { planDocument, world } from "./fixtures/drafter.js";

/** Lap 11's drafted prompt, in its shape: the change, and not a word about committing. */
const DRAFTED =
  "#291 の文言カタログを言語ごとに 1 ファイルへ分けてください。ビルドとテストが従来どおり通ることを確認してください。";

const CRITERION = {
  severities: { blocker: "b", major: "m", minor: "n", nit: "t" },
  rule_files: ["AGENTS.md"],
};

async function lapPrompt(document: Record<string, unknown>): Promise<string> {
  const w = await world();
  await w.say(
    "r1",
    "https://github.com/suisya-systems/rondo/issues/291 をやってほしい",
    null,
    1_000,
  );
  const planned = readRunPlan({ ...planDocument(), ...document, prompt: DRAFTED });
  if (planned.kind !== "planned") throw new Error(planned.reason);
  const quoted = await withNamedIssues(w.record, "r1", planned.plan);
  if ("refusal" in quoted) throw new Error(quoted.refusal);
  return quoted.prompt;
}

test("a drafted prompt that never says commit still reaches the lap asking for a commit and the repository's verification", async () => {
  expect(DRAFTED).not.toMatch(/commit/i);
  const prompt = await lapPrompt({});
  // The drafter's words first and unchanged; rondo's section after them.
  expect(prompt.startsWith(`${DRAFTED}${DONE_OPENING}`)).toBe(true);
  expect(prompt).toContain("Commit your work on this lap's branch.");
  expect(prompt).toContain("run the repository's own install and verification");
  expect(prompt).toContain("Never say it passed when it did not run.");
});

test("the worker is told the plan's turn budget and that a stop keeps only what is committed (D-0110)", async () => {
  // Lap 13's try was cut at 15 minutes with 15 files edited and no commit, and
  // a next try is cut from the last try's commits.
  const prompt = await lapPrompt({
    turn_timeout_ms: 1_800_000,
    invocation_ceiling_ms: 2_280_000,
  });
  expect(prompt).toContain(
    "- This lap has 30 minutes; a lap still working then is stopped. Commit each working step as you go: a stop keeps only what is committed.",
  );
  expect(definitionOfDone([], null)).not.toContain("minutes");
});

test("the plan's rule files are named to the worker, the files the model reviewer is handed", async () => {
  const prompt = await lapPrompt({ review_criterion: CRITERION });
  expect(prompt).toContain(
    "The repository's own rules are in AGENTS.md in your workspace: read it first and follow its order of work.",
  );
});

test("the section is ASCII, so it reaches continuo's command line on a cp932 console (D-0004)", () => {
  for (const files of [[], ["AGENTS.md"], ["AGENTS.md", "CONTRIBUTING.md"]]) {
    expect(definitionOfDone(files, 1_800_000)).toMatch(/^[\x20-\x7e\n]*$/);
  }
});

test("D-0098 rule 5.2: a closing lap's section quotes the findings with their bases and asks a test per fix", () => {
  const section = closingLapSection([
    { number: 1, text: "Rename the helper.", bases: ["src/a.ts:3"] },
    { number: 3, text: "Drop the dead branch.", bases: [] },
  ]);
  expect(section).toMatch(/^[\x20-\x7e\n]*$/);
  expect(section).toContain("  1. Rename the helper. (bases: src/a.ts:3)");
  expect(section).toContain("  3. Drop the dead branch. (bases: none)");
  expect(section).toContain("Write a test for each fix");
  expect(section).toContain("No reviewer reads this lap again");
  // Rule 5.4 is observed on rondo's reading only: the report is not promised to stop the line.
  expect(section).not.toContain("the line then stops");
});
