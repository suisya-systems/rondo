/**
 * D-0121 as `conductorPorts` wires it: a lap is sent with the cap the store
 * computed and wrote for it, and a lap with no room left is refused before
 * continuo is touched, as a budget stop that spent nothing.
 */
import { expect, test } from "vitest";

import { conductorPorts } from "../../src/access/conductor.js";

test("a lap with no room left in the budget is refused, and continuo is never driven", async () => {
  // The continuo handle is an empty object, so driving it would throw.
  const store = { sendLapBudget: async () => -1 };
  const ports = conductorPorts({} as never, store as never, null);
  const outcome = await ports.performLap({} as never, "standard", "lap-1");
  expect(outcome).toMatchObject({ kind: "refused", budgetStop: { totalCostUsd: 0 } });
  expect(outcome.kind === "refused" && outcome.message).toContain("D-0121");
});

test("a cap below a micro dollar is no room either, not a defect", async () => {
  const store = { sendLapBudget: async () => 0.0000004 };
  const ports = conductorPorts({} as never, store as never, null);
  expect(await ports.performLap({} as never, "standard", "lap-1")).toMatchObject({
    kind: "refused",
    budgetStop: { totalCostUsd: 0 },
  });
});
