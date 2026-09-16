/**
 * D-0071 rule 4.2 over hand-built rows: the cold start, each measurement's own
 * fall-through, the sample of ten, and the formulas.
 */
import { expect, test } from "vitest";
import { scopeBudgetsFromStore } from "../../src/access/scope.js";
import {
  type BudgetRow,
  COLD_START_RESERVE_USD,
  computeScopeBudgets,
  REPLY_ALLOWANCE_MS,
} from "../../src/advisory/budget.js";

const A = `sha256:${"a".repeat(64)}`;
const B = `sha256:${"b".repeat(64)}`;
const T0 = 1_000_000;
const MIN = 60_000;

let n = 0;
function row(fields: Partial<BudgetRow>): BudgetRow {
  n += 1;
  return {
    id: `i-${n}`,
    agentTypeDigest: A,
    modelTier: "standard",
    supersedesIterationId: null,
    lapCostUsd: null,
    lapDurationMs: null,
    createdAtMs: n,
    ...fields,
  };
}

test("a fresh store gets the cold start on every field, and 5.00 for one plan and two rounds", () => {
  const b = computeScopeBudgets({
    agentTypes: [{ digest: A, modelTier: "standard" }],
    plans: 1,
    reviewRounds: 2,
    rows: [],
    draftedAtMs: T0,
  });
  expect(b.cost_reserve_usd.value).toBe(2.5);
  expect(b.cost_usd.value).toBe(5);
  expect(b.laps.value).toBe(2);
  expect(b.review_rounds.value).toBe(2);
  expect(b.expires_at_ms.value).toBe(T0 + 2 * 30 * MIN + REPLY_ALLOWANCE_MS);
  expect(b.cost_reserve_usd.bases).toEqual([
    expect.objectContaining({ kind: "cold_start", value: COLD_START_RESERVE_USD }),
  ]);
  // The bases are facts and not a sentence: the words for them are the
  // catalogue's, so both languages can say where a number came from.
  expect(b.laps.formula).toEqual({ kind: "laps", plans: 1, reviewRounds: 2 });
  expect(b.laps.bases).toEqual([
    { kind: "given", given: "plans", value: 1, byDefault: false },
    { kind: "given", given: "review_rounds", value: 2, byDefault: false },
  ]);
});

test("recorded laps of the agent type set the reserve, the redo and the duration, with their rows", () => {
  const first = row({ lapCostUsd: 1.032, lapDurationMs: 10 * MIN });
  const first2 = row({ lapCostUsd: 1.04, lapDurationMs: 12 * MIN });
  const redo = row({ supersedesIterationId: first.id, lapCostUsd: 7.062, lapDurationMs: 5 * MIN });
  const b = computeScopeBudgets({
    agentTypes: [{ digest: A, modelTier: "standard" }],
    plans: 2,
    rows: [first, first2, redo],
    draftedAtMs: T0,
  });
  expect(b.review_rounds.value).toBe(3);
  expect(b.review_rounds.bases[0]).toEqual({
    kind: "given",
    given: "review_rounds",
    value: 3,
    byDefault: true,
  });
  expect(b.cost_reserve_usd.value).toBe(1.1);
  // 2 x (1.10 + 2 x max(7.10, 1.10))
  expect(b.cost_usd.value).toBe(30.6);
  expect(b.laps.value).toBe(6);
  expect(b.expires_at_ms.value).toBe(T0 + 6 * 12 * MIN + REPLY_ALLOWANCE_MS);
  expect(b.cost_reserve_usd.bases).toEqual([
    expect.objectContaining({
      kind: "rows",
      level: "agent_type",
      iterationIds: [first2.id, first.id],
    }),
  ]);
  expect(b.cost_usd.bases).toContainEqual(
    expect.objectContaining({ measurement: "redo_cost", iterationIds: [redo.id] }),
  );
});

test("each measurement falls through on its own: redo from the type, first lap from the tier, duration cold", () => {
  const other = row({ agentTypeDigest: B, lapCostUsd: 1.2 });
  const redo = row({ supersedesIterationId: "i-x", lapCostUsd: 0.456 });
  const elsewhere = row({ agentTypeDigest: B, modelTier: "large", lapCostUsd: 9 });
  const b = computeScopeBudgets({
    agentTypes: [{ digest: A, modelTier: "standard" }],
    plans: 1,
    rows: [other, redo, elsewhere],
    draftedAtMs: T0,
  });
  expect(b.cost_reserve_usd.value).toBe(1.2);
  expect(b.cost_reserve_usd.bases).toEqual([
    expect.objectContaining({ level: "model_tier", iterationIds: [other.id] }),
  ]);
  // redo 0.50 is below the reserve, so each later lap is budgeted at the reserve.
  expect(b.cost_usd.value).toBe(3.6);
  expect(b.expires_at_ms.bases).toContainEqual(
    expect.objectContaining({ kind: "cold_start", measurement: "lap_duration" }),
  );
});

test("only the ten most recent rows holding the measurement are read", () => {
  const old = row({ lapCostUsd: 6, createdAtMs: 0 });
  const recent = Array.from({ length: 10 }, (_, i) => row({ lapCostUsd: 1, createdAtMs: 100 + i }));
  const b = computeScopeBudgets({
    agentTypes: [{ digest: A, modelTier: null }],
    plans: 1,
    rows: [old, ...recent, row({ lapCostUsd: null, createdAtMs: 999 })],
    draftedAtMs: T0,
  });
  expect(b.cost_reserve_usd.value).toBe(1);
  const basis = b.cost_reserve_usd.bases[0];
  expect(basis?.kind === "rows" && basis.iterationIds).not.toContain(old.id);
});

test("the reserve is the highest over the listed agent types; a type with no tier and no rows is cold", () => {
  const b = computeScopeBudgets({
    agentTypes: [
      { digest: A, modelTier: "standard" },
      { digest: B, modelTier: null },
    ],
    plans: 1,
    rows: [row({ lapCostUsd: 0.891 })],
    draftedAtMs: T0,
  });
  expect(b.cost_reserve_usd.value).toBe(2.5);
  expect(b.cost_reserve_usd.bases.map((basis) => basis.kind)).toEqual(["rows", "cold_start"]);
});

test("a count that is not a whole number is refused", () => {
  expect(() =>
    computeScopeBudgets({ agentTypes: [], plans: 1.5, rows: [], draftedAtMs: T0 }),
  ).toThrow(/plans/);
});

test("the store reader reads live and terminal rows, skips an unreadable one, and treats an absent record as tierless", async () => {
  const live = row({ lapCostUsd: 1.5 }) as unknown as Record<string, unknown>;
  const ended = row({ lapCostUsd: 0.3 }) as unknown as Record<string, unknown>;
  const b = await scopeBudgetsFromStore(
    {
      store: {
        readLive: async () => [{ kind: "read", record: live as never }],
        terminalIterations: async () => [
          { kind: "read", record: ended as never },
          { kind: "unreadable", id: "i-bad", reason: "corrupt" },
        ],
      },
      record: { heldAgentType: async () => ({ kind: "absent" }) },
    },
    { agentTypes: [A], plans: 1, draftedAtMs: T0 },
  );
  expect(b.cost_reserve_usd.value).toBe(1.5);
  expect(b.cost_reserve_usd.bases[0]).toMatchObject({ level: "agent_type", modelTier: null });
});
