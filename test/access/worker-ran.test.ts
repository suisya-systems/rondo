/**
 * What `rondo answer` says about the worker's own test runs (rondo#424).
 *
 * The page's checks card has carried this block since rondo#410 (D-0104) and
 * the terminal did not, so a person answering from a terminal read the
 * reading below it -- rondo's own checks saying *it built nothing, ran
 * nothing* -- as *no tests were run*. The properties under test are the two
 * that make the block worth printing: the commands the worker actually ran
 * and their counts reach the terminal, and a lap with no readable record says
 * so in words that are not a zero.
 *
 * `continuo` is null, as in `fence-material.test.ts`: the fence half then says
 * it was not read, and this block comes off the row and is unaffected.
 */
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import { lapMaterialLines } from "../../src/access/cli.js";
import { EN } from "../../src/access/wording.js";
import { CONSERVATIVE_HOST_POLICY } from "../../src/refrain/policy.js";
import { ownLane } from "../lane-claims.js";
import { REQUEST, storeWithRequest } from "../request-fixture.js";

/** One command as continuo records it in `lap_commands`. */
const ran = (index: number, command: string, output: string, isError = false) => ({
  index,
  command,
  output,
  output_omitted_chars: 0,
  is_error: isError,
});

/**
 * The lines `rondo answer` prints for a row carrying these commands.
 *
 * The row names no range, so nothing here reaches git. `true` is what
 * `sayLapMaterial` passes: the terminal draws the block in these lines
 * because it has no card to draw it on.
 */
async function terminal(lapCommands: string | null, workerRan = true): Promise<string> {
  const store = storeWithRequest(new DatabaseSync(":memory:"), CONSERVATIVE_HOST_POLICY);
  await store.reserve({
    numbers: null,
    id: "i-0001",
    request: "do the thing",
    plan: { run_id: "rondo-i-0001", repository: "/srv/repo" },
    spend: null,
    scopeSpend: null,
    claim: ownLane("i-0001"),
    nowMs: 1_000,
    supersedesIterationId: null,
    requestMessageId: REQUEST,
    runId: "rondo-i-0001",
    topicBranch: "rondo/i-0001",
    workspace: "/srv/work/iter-i-0001",
  });
  await store.transition("i-0001", "planned", "awaiting_human", { lapCommands }, 2_000);
  const outcome = await store.read("i-0001");
  if (outcome.kind !== "read") {
    throw new Error(`the fixture row did not decode: ${outcome.kind}`);
  }
  return (await lapMaterialLines(EN, store, outcome.record, null, workerRan)).join("\n");
}

test("the commands the worker ran and what they said reach the terminal, with their source", async () => {
  const verify = (line: string, index: number) =>
    ran(index, "npm run verify", `> verify\n\n      Tests  ${line}\n`);
  const said = await terminal(
    JSON.stringify([
      verify("1 failed | 1842 passed (1843)", 12),
      ran(20, "git status", "clean"),
      verify("1844 passed | 2 skipped (1846)", 41),
    ]),
  );
  expect(said).toContain("worker  npm run verify");
  expect(said).toContain(EN.workerCount("passed", 1844));
  expect(said).toContain(EN.workerCount("failed", 0));
  expect(said).toContain(EN.workerCount("skipped", 2));
  expect(said).toContain(EN.workerRanEarlier(1));
  // The source line is the page's, word for word: read from continuo's record
  // at a named transcript line, and rondo ran nothing.
  expect(said).toContain(EN.workerRanSource(41));
  // Above the reading, as on the page: *it ran nothing* is about the reader.
  expect(said.indexOf("worker  ")).toBeLessThan(said.indexOf("review  "));
});

test("a command that ended in error says so even where its tests passed", async () => {
  const said = await terminal(
    JSON.stringify([
      ran(41, "npm run verify", "      Tests  1844 passed (1844)\nlint failed", true),
    ]),
  );
  expect(said).toContain(EN.workerCount("passed", 1844));
  expect(said).toContain(EN.workerRanErrored);
});

test("a lap with no readable record of its commands is never a lap that ran nothing", async () => {
  for (const column of [null, "null", "{not json"]) {
    const said = await terminal(column);
    expect(said).toContain(EN.workerRanUnrecorded);
    // The misread #410 was about: a zero would be rondo saying the worker ran
    // a test suite and it found nothing, which rondo does not know.
    expect(said).not.toContain(EN.workerCount("passed", 0));
    expect(said).not.toContain(EN.workerRanSource(41));
  }
});

test("commands rondo read with no runner summary in them are a third answer again", async () => {
  const said = await terminal(JSON.stringify([ran(1, "ls", "a b"), ran(2, "git status", "clean")]));
  expect(said).toContain(EN.workerRanNone(2));
  expect(said).not.toContain(EN.workerRanUnrecorded);
  expect(said).not.toContain(EN.workerCount("passed", 0));
});

test("the page's copy of these lines is unchanged: it draws the block as a card of its own", async () => {
  const said = await terminal(
    JSON.stringify([ran(41, "npm run verify", "      Tests  1844 passed (1844)")]),
    false,
  );
  expect(said).not.toContain("worker  ");
  expect(said).not.toContain(EN.workerRanSource(41));
});
