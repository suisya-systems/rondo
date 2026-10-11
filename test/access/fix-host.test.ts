/**
 * D-0194 (rondo#557): the conflict fix rondo starts by itself for a line
 * started with no claim, under an approval that starts work by itself -- over a
 * real store and thread, with the press's path and the approval's reading
 * stood in for.
 */
import { expect, test } from "vitest";
import { reportToRequest } from "../../src/access/conductor.js";
import { fixHost } from "../../src/access/fix-host.js";
import type { ConflictFixed, ConflictFixInput } from "../../src/access/web-app.js";
import { fresh, openGate, openRequest, recordAnswer, reserve } from "./page-world.js";

const PR = "https://github.com/suisya-systems/rondo/pull/372";

/** One lap approved at its gate, published, and its pull request then `checks`. */
async function published(checks: "conflict" | "red") {
  const world = fresh();
  await openRequest(world, "req-r", "split the wording", 1_000);
  await reserve(world, "i-r", "split the wording", null, "req-r");
  await openGate(world, "i-r");
  await recordAnswer(world, "i-r", "approve");
  await world.store.transition(
    "i-r",
    "awaiting_human",
    "closed",
    { gateOutcome: "answered_and_forwarded" },
    5_000,
  );
  const thread = { record: world.record, store: world.store };
  await reportToRequest(thread, "i-r", { kind: "published", pullRequestUrl: PR }, 6_000);
  await reportToRequest(
    thread,
    "i-r",
    checks === "conflict"
      ? { kind: "conflict", pullRequestUrl: PR, head: "abc1234", base: "main", baseCommit: "b1" }
      : {
          kind: "checks",
          commit: "abc1234",
          reading: { kind: "red", failed: ["build"], cancelled: [], timedOut: [] },
        },
    7_000,
  );
  return world;
}

function host(
  world: ReturnType<typeof fresh>,
  over: {
    unclaimed?: boolean;
    byItself?: boolean;
    admitted?: string | null;
    answer?: ConflictFixed;
  } = {},
) {
  const asked: ConflictFixInput[] = [];
  const lines: string[] = [];
  let minted = 0;
  const fixer = fixHost({
    store: { ...world.store, startedUnclaimed: async () => over.unclaimed ?? true },
    record: {
      ...world.record,
      scopeDecisionAdmitting: async () => (over.admitted === undefined ? "dec-1" : over.admitted),
    },
    byItself: async () => over.byItself ?? true,
    fix: async (input) => {
      asked.push(input);
      return over.answer ?? { ok: true, note: "admitted" };
    },
    mintId: () => `i-fix-${String(++minted)}`,
    log: (line) => lines.push(line),
  });
  return { fixer, asked, lines };
}

test("a conflicting line started with no claim is fixed by rondo, once, through the press's path (D-0194)", async () => {
  const world = await published("conflict");
  const { fixer, asked } = host(world);
  // Before the pass: rondo's to start, so the page draws no press.
  expect(await fixer.starting("i-r")).toBe(true);
  fixer.kick();
  await fixer.settled();
  fixer.kick();
  await fixer.settled();
  expect(asked).toEqual([
    { iterationId: "i-r", successorId: "i-fix-1", scopeDecisionId: "dec-1", cause: "conflict" },
  ]);
  expect(fixer.left("i-r")).toBeNull();
});

test("the fix stays a press for a drafted claim, an approval that starts nothing by itself, no approval, or a red check", async () => {
  const conflict = await published("conflict");
  for (const over of [{ unclaimed: false }, { byItself: false }, { admitted: null }]) {
    const { fixer, asked } = host(conflict, over);
    expect(await fixer.starting("i-r")).toBe(false);
    fixer.kick();
    await fixer.settled();
    expect(asked).toEqual([]);
  }
  const { fixer, asked } = host(await published("red"));
  expect(await fixer.starting("i-r")).toBe(false);
  fixer.kick();
  await fixer.settled();
  expect(asked).toEqual([]);
});

test("a try that started nothing leaves the fix to the press, with why, and is not tried again", async () => {
  const world = await published("conflict");
  const refusal: ConflictFixed = {
    ok: false,
    why: "conflictFixRefusedOutside",
    test: "redo",
    note: "the refused verdict at the redo test",
  };
  const { fixer, asked, lines } = host(world, { answer: refusal });
  fixer.kick();
  await fixer.settled();
  fixer.kick();
  await fixer.settled();
  expect(asked).toHaveLength(1);
  expect(fixer.left("i-r")).toEqual(refusal);
  expect(await fixer.starting("i-r")).toBe(false);
  expect(lines.at(-1)).toContain("left for the press");
});
