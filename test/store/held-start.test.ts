/**
 * rondo#284 (D-0157): the `held_start` rows. One waiting start per request,
 * approval and plan; a form's own wait that ended without a start waits again;
 * and none is kept once a form of the plan started it (Codex round 2).
 */
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";
import { iterationStore } from "../../src/store/sqlite.js";

const held = (iterationId: string) => ({
  iterationId,
  requestMessageId: "r1",
  scopeDecisionId: "decision-1",
  planDigest: "sha256:plan",
  repository: "/srv/repo",
  heldAtMs: 1_000,
});

const waiting = async (store: ReturnType<typeof iterationStore>) =>
  (await store.heldStarts()).map((one) => one.iterationId);

test("a held start waits once per plan, waits again after a wait that did not start, and never after one that did", async () => {
  const store = iterationStore(new DatabaseSync(":memory:"), { maxOccupying: 2, maxLive: 3 });

  expect(await store.recordHeldStart(held("lap-a"))).toBe(true);
  // The same form again keeps its one row; another form of the plan keeps none.
  expect(await store.recordHeldStart(held("lap-a"))).toBe(true);
  expect(await store.recordHeldStart(held("lap-b"))).toBe(false);
  expect(await waiting(store)).toEqual(["lap-a"]);

  // Ended without a start (a refusal waiting does not change): the same form,
  // refused by held files again, waits again rather than answering a wait
  // nothing reads.
  await store.settleHeldStart("lap-a", "the approval is no longer in force", 2_000);
  expect(await waiting(store)).toEqual([]);
  expect(await store.recordHeldStart(held("lap-a"))).toBe(true);
  expect(await waiting(store)).toEqual(["lap-a"]);

  // Started: no form of the plan waits again, so the tick never starts it twice.
  await store.settleHeldStart("lap-a", "started", 3_000);
  expect(await store.recordHeldStart(held("lap-a"))).toBe(false);
  expect(await store.recordHeldStart(held("lap-b"))).toBe(false);
  expect(await waiting(store)).toEqual([]);

  // Another plan of the same request is its own wait.
  expect(await store.recordHeldStart({ ...held("lap-c"), planDigest: "sha256:other" })).toBe(true);
  expect(await waiting(store)).toEqual(["lap-c"]);
});

test("a form that joined a wait resolves to it after the wait ends, and joining keeps no second wait", async () => {
  const store = iterationStore(new DatabaseSync(":memory:"), { maxOccupying: 2, maxLive: 3 });
  expect(await store.recordHeldStart(held("lap-a"))).toBe(true);
  await store.joinHeldStart(held("lap-b"), "lap-a");
  expect(await waiting(store)).toEqual(["lap-a"]);
  expect(await store.heldStartJoin("lap-b")).toBe("lap-a");
  await store.settleHeldStart("lap-a", "started", 2_000);
  expect(await store.heldStartJoin("lap-b")).toBe("lap-a");
  expect(await store.heldStartJoin("lap-a")).toBeNull();
  expect(await store.heldStartJoin("lap-none")).toBeNull();
});
