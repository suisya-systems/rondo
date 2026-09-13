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
import { EN } from "../../src/access/wording.js";
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
    scopeSpend: null,
    nowMs: 1_000,
    supersedesIterationId: null,
    requestMessageId: null,
    runId: "rondo-i-0001",
    topicBranch: "rondo/i-0001",
    workspace: "/srv/work/iter-i-0001",
  });
  await store.transition("i-0001", "planned", "awaiting_human", { permissionDenials }, 2_000);
  const outcome = await store.read("i-0001");
  if (outcome.kind !== "read") {
    throw new Error(`the fixture row did not decode: ${outcome.kind}`);
  }
  return (await lapMaterialLines(EN, store, outcome.record, null)).join("\n");
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

/**
 * What the block does *not* cover, said on every lap (`D-0050` rules 3 and 4).
 *
 * The property is unconditionality, so it is tested as a property of every
 * state this file can reach rather than of one: the worker's sandbox fails open
 * without refusing anything, so no answer of either half is the one that ought
 * to carry it, and the sentence is worth nothing if a lap can print without it.
 *
 * **The last assertion is why the ones above it mean anything.** `continuo` is
 * null throughout this file, so the caveat this sentence sits beside --
 * *"not the whole fence"* -- is never composed on any of these rows. That is
 * what makes the sentence's presence evidence of its own: it cannot be riding
 * along with the conditional block. The assertion holds the premise still, so
 * that a later fixture reaching a real control plane fails here and says the
 * test has stopped proving what it claims, rather than passing for a new reason.
 *
 * Both mistakes are caught and were measured to be: emptying the constant, and
 * moving it into `allowanceLines`' provenance, each fail this test and only
 * this test.
 */
test("what this block does not cover is said whatever the lap did", async () => {
  const states = [
    "[]",
    "null",
    null,
    JSON.stringify([{ tool_name: "Bash", tool_input: { command: "npm test" } }]),
  ];
  for (const permissionDenials of states) {
    const said = await fenceBlock(permissionDenials);
    expect(said).toContain("The worker's own sandbox is a second containment");
    expect(said).toContain("prints here exactly like one that did not");
  }
  expect(await fenceBlock("[]")).not.toContain("not the whole fence");
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
