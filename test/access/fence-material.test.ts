/**
 * What the gate screen says about the fence, over the three answers there are
 * (rondo#88).
 *
 * The column carries continuo's own document and the screen is what a person
 * reads before pressing approve, so the property under test is the one
 * `continuo D-1110` argues for: **"nothing was refused" and "we cannot tell
 * whether anything was refused" must not read alike**, and neither may look
 * like a row rondo never wrote. Three states, three sentences, and a case each.
 *
 * `continuo` is null here, which is the fourth honest answer and the one that
 * keeps this file free of a continuo build: the allowance half then says it was
 * not read, and the denial half -- which comes off the row -- is unaffected.
 * The allowance half's own reading is measured against a real control plane,
 * not here.
 */
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import { lapMaterialLines } from "../../src/access/cli.js";
import { CONSERVATIVE_HOST_POLICY } from "../../src/refrain/policy.js";
import { iterationStore } from "../../src/store/sqlite.js";

/** A row with no range on it, so nothing here reaches git. */
async function fenceBlock(permissionDenials: string | null): Promise<string> {
  const store = iterationStore(new DatabaseSync(":memory:"), CONSERVATIVE_HOST_POLICY);
  await store.reserve({
    id: "i-0001",
    request: "do the thing",
    plan: { run_id: "rondo-i-0001" },
    spend: null,
    nowMs: 1_000,
    supersedesIterationId: null,
    runId: "rondo-i-0001",
    topicBranch: "rondo/i-0001",
    workspace: "/srv/work/iter-i-0001",
  });
  await store.transition("i-0001", "planned", "awaiting_human", { permissionDenials }, 2_000);
  const outcome = await store.read("i-0001");
  if (outcome.kind !== "read") {
    throw new Error(`the fixture row did not decode: ${outcome.kind}`);
  }
  return (await lapMaterialLines(store, outcome.record, null)).join("\n");
}

test("a fence that refused nothing says so, and says it as a reading", async () => {
  const said = await fenceBlock("[]");
  expect(said).toContain("continuo reported that the fence refused nothing");
  expect(said).not.toContain("what the fence refused");
});

test("a backend that cannot say is not a fence that refused nothing", async () => {
  const said = await fenceBlock("null");
  expect(said).toContain("continuo could not say what the fence refused");
  expect(said).toContain("unknown rather than none");
});

test("a row rondo never wrote the refusals to is a third answer again", async () => {
  const said = await fenceBlock(null);
  expect(said).toContain("was not recorded for this iteration");
});

test("the refusals are listed with the call each one was about", async () => {
  const said = await fenceBlock(
    JSON.stringify([
      { tool_name: "Bash", tool_input: { command: "npm test" } },
      { tool_name: "Bash", tool_input: { command: "line one\nline two" } },
    ]),
  );
  expect(said).toContain("the fence refused 2 call(s), as continuo reported them:");
  expect(said).toContain('Bash  "npm test"');
  // On a line rondo composed, the worker's own newline stays escaped (rondo#68).
  expect(said).toContain('Bash  "line one\\nline two"');
});

test("an allowance that was not read is not an allowance of nothing", async () => {
  const said = await fenceBlock("[]");
  expect(said).toContain("continuo is not usable here");
  expect(said).toContain("unknown rather than nothing");
  // The screen never says "allowed to run": the declaration is one input to the
  // fence and continuo renders the role's own template into the same allow
  // list, which rondo does not read. Measured on a real lap: a worker role
  // contributes six `git` specs no delegation record declares.
  expect(said).not.toContain("allowed to run:");
});
