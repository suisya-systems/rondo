/**
 * D-0121 as `conductorPorts` wires it: a lap is sent with the cap the store
 * computed and wrote for it, and a lap with no room left is refused before
 * continuo is touched, as a budget stop that spent nothing.
 */
import { expect, test } from "vitest";

import { conductorPorts } from "../../src/access/conductor.js";
import { thisDriver } from "../../src/access/lost-laps.js";

test("a lap with no room left in the budget is refused, and continuo is never driven", async () => {
  // The continuo handle is an empty object, so driving it would throw.
  const store = { sendLapBudget: async () => -1 };
  const ports = conductorPorts({} as never, store as never, null);
  const outcome = await ports.performLap({} as never, "standard", "lap-1", null);
  expect(outcome).toMatchObject({ kind: "refused", budgetStop: { totalCostUsd: 0 } });
  expect(outcome.kind === "refused" && outcome.message).toContain("D-0121");
});

test("a cap below a micro dollar is no room either, not a defect", async () => {
  const store = { sendLapBudget: async () => 0.0000004 };
  const ports = conductorPorts({} as never, store as never, null);
  expect(await ports.performLap({} as never, "standard", "lap-1", null)).toMatchObject({
    kind: "refused",
    budgetStop: { totalCostUsd: 0 },
  });
});

test("rondo#655: a reserved row names this process as its driver, and a refused one is not marked", async () => {
  const marks: unknown[] = [];
  let answer: { kind: string } = { kind: "reserved" };
  const store = {
    reserve: async () => answer,
    markLapProcess: async (id: string, mark: unknown) => {
      marks.push([id, mark]);
    },
  };
  const ports = conductorPorts({} as never, store as never, null);
  expect(await ports.store.reserve({ id: "lap-1" } as never)).toEqual({ kind: "reserved" });
  expect(marks).toEqual([["lap-1", thisDriver()]]);
  answer = { kind: "atCapacity" };
  await ports.store.reserve({ id: "lap-2" } as never);
  expect(marks).toHaveLength(1);
  // A mark that fails does not fail the reservation: the ceiling decides instead.
  answer = { kind: "reserved" };
  store.markLapProcess = async () => {
    throw new Error("disk full");
  };
  expect(await ports.store.reserve({ id: "lap-3" } as never)).toEqual({ kind: "reserved" });
});
