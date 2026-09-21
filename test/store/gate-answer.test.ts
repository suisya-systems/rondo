/**
 * Which answer a gate was given, as the store holds it (rondo#385, D-0092):
 * beside the gate answer, read onto the lap's record, and written by nothing
 * but the gate walk.
 */
import { expect, test } from "vitest";
import { fresh, openGate, openRequest, reserve } from "../access/page-world.js";

async function lapAtGate() {
  const world = fresh();
  await openRequest(world, "req-g", "cap the backoff");
  await reserve(world, "i-g", "cap the backoff", null, "req-g");
  await openGate(world, "i-g");
  return world;
}

async function answerOf(world: ReturnType<typeof fresh>) {
  const read = await world.store.read("i-g");
  if (read.kind !== "read") {
    throw new Error("the lap would not read");
  }
  return read.record.gateAnswer;
}

test("no record reads as null, and a record reads onto the lap and survives it closing", async () => {
  const world = await lapAtGate();
  expect(await answerOf(world)).toBeNull();

  await world.store.recordGateAnswer("i-g", "gate-i-g", "revise", "ada", 4_000);
  expect(await answerOf(world)).toBe("revise");

  const closed = await world.store.transition(
    "i-g",
    "awaiting_human",
    "closed",
    { gateOutcome: "answered_and_forwarded" },
    5_000,
  );
  expect(closed.kind).toBe("transitioned");
  expect(await answerOf(world)).toBe("revise");
});

test("the first answer for a gate stands, and an answer to another gate is not this one's", async () => {
  const world = await lapAtGate();
  // continuo refuses a second, different body for one gate, so the first
  // record is the answer continuo holds; a re-issue is not a second fact.
  await world.store.recordGateAnswer("i-g", "gate-i-g", "revise", "ada", 4_000);
  await world.store.recordGateAnswer("i-g", "gate-i-g", "approve", "ada", 4_100);
  expect(await answerOf(world)).toBe("revise");

  // A record naming a gate the row does not name says nothing about the row.
  const other = await lapAtGate();
  await other.store.recordGateAnswer("i-g", "gate-other", "approve", "ada", 4_000);
  expect(await answerOf(other)).toBeNull();
});
