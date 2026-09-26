/**
 * D-0121 as `conductorPorts` wires it: a lap is sent with the room the scope's
 * budget leaves it, read the moment it is sent, and a lap with no room left is
 * refused before continuo is touched.
 */
import { expect, test } from "vitest";

import { conductorPorts } from "../../src/access/conductor.js";

const record = (readCostUsd: number) => ({
  recordThreadMessage: async () => {
    throw new Error("not reached");
  },
  scopeDecisionAdmitting: async () => "d-1",
  readScopeDecision: async () => ({ kind: "read", decision: { scopeId: "s-1" } }),
  readScope: async () => ({
    kind: "read",
    scope: { payload: { budgets: { cost_usd: 10, cost_reserve_usd: 2 } } },
  }),
  // This lap and one beside it are unread.
  scopeSpent: async () => ({ admissions: 3, readCostUsd, unreadLaps: 2 }),
});

test("a lap with no room left in the budget is refused, and continuo is never driven", async () => {
  // 10 - 9 read - 2 held for the lap beside it: -1 USD left for this one. The
  // continuo handle is an empty object, so driving it would throw.
  const ports = conductorPorts({} as never, {} as never, record(9) as never);
  const outcome = await ports.performLap({} as never, "standard", "lap-1");
  expect(outcome.kind).toBe("refused");
  expect(outcome.kind === "refused" && outcome.message).toContain("D-0121");
});
