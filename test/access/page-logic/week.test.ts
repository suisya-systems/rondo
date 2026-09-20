/**
 * The last seven days, and where running work stands (DECISIONS.md D-0083
 * rule 4).
 *
 * The properties held here are the ones a drawn figure could quietly break:
 * the window is seven days and the clock is the caller's, the allowance pair
 * is drawn whole or not at all (rule 6), one approval counts once however many
 * tries spent it, and exactly one of the five steps is the one the work is on
 * -- with the last of them never rondo's.
 */
import { expect, test } from "vitest";
import {
  GATE_ANSWERS_NOT_DATED,
  stepsOf,
  WEEK_MS,
  weekFigures,
} from "../../../src/access/page-logic/week.js";
import type { IterationRecord } from "../../../src/store/records.js";

const NOW = 10 * WEEK_MS;

const lap = (over: Partial<IterationRecord>): IterationRecord =>
  ({ status: "performing", gateOutcome: null, plan: {}, ...over }) as IterationRecord;

const reads = {
  askedAtMs: [],
  finishedAtMs: [],
  answeredAtMs: [],
  decidedWithoutAsking: 0,
  allowances: [],
} as const;

test("the window is seven days back from the caller's clock, inclusive of its edge", () => {
  const figures = weekFigures(
    {
      ...reads,
      askedAtMs: [NOW - WEEK_MS, NOW - WEEK_MS - 1, NOW],
      finishedAtMs: [NOW - 1],
      answeredAtMs: [NOW - WEEK_MS * 2],
    },
    NOW,
  );
  // The edge is in, a millisecond older is out, and nothing in the future
  // counts towards a week that has already happened.
  expect(figures.asked).toBe(2);
  expect(figures.finished).toBe(1);
  expect(figures.answered).toBe(0);
});

test("what rondo decided without asking is the store's count, passed through", () => {
  // It is the one figure this module cannot narrow: the rows are the
  // `attention` table's and the interval is the query's (D-0032 rule 10).
  expect(weekFigures({ ...reads, decidedWithoutAsking: 31 }, NOW).decidedWithoutAsking).toBe(31);
});

test("with no approval to read, the week draws no spend", () => {
  // Rule 6's refusal, on the week's figures: a spend without the figure it
  // was approved against would read as though somebody had agreed to it.
  expect(weekFigures(reads, NOW).allowance).toBeNull();
});

test("the approvals are summed, and what is left is never a debt", () => {
  const figures = weekFigures(
    {
      ...reads,
      allowances: [
        { spentUsd: 4, approvedUsd: 20 },
        { spentUsd: 1.5, approvedUsd: 30 },
      ],
    },
    NOW,
  );
  expect(figures.allowance).toEqual({ spentUsd: 5.5, approvedUsd: 50, leftUsd: 44.5 });
  const over = weekFigures({ ...reads, allowances: [{ spentUsd: 9, approvedUsd: 5 }] }, NOW);
  expect(over.allowance?.leftUsd).toBe(0);
});

test("the pair is one approval's own, so a raise is not read as a total", () => {
  // D-0074 rule 2 and section 3.2: budgets are per approved row and the
  // successor starts at zero. A week that added a predecessor's $4 into a
  // successor's $10 would say "$14 approved", which is the misreading that
  // entry exists to prevent; what the predecessor spent is the scope screen's
  // to show.
  const raised = weekFigures({ ...reads, allowances: [{ spentUsd: 2, approvedUsd: 10 }] }, NOW);
  expect(raised.allowance).toEqual({ spentUsd: 2, approvedUsd: 10, leftUsd: 8 });
});

test("a request still working is on its work, and nothing later is claimed", () => {
  const steps = stepsOf(lap({}), []);
  expect(steps.map((step) => step.state)).toEqual(["waiting", "ahead", "ahead", "ahead", "yours"]);
});

test("a reading moves the step it belongs to, and the checks are not the model's", () => {
  const checked = stepsOf(lap({}), [{ drafter: "rondo/checks", verdict: "clear" }]);
  expect(checked.map((step) => step.state)).toEqual(["done", "done", "waiting", "ahead", "yours"]);
  const modelRead = stepsOf(lap({}), [{ drafter: "rondo/model/sonnet", verdict: "clear" }]);
  // The model read it and the checks have not run: what is done is what
  // happened, and the step the work is on is the first that has not.
  expect(modelRead.map((step) => step.state)).toEqual([
    "done",
    "waiting",
    "done",
    "ahead",
    "yours",
  ]);
});

test("a reading that could not be taken moves nothing", () => {
  const steps = stepsOf(lap({}), [{ drafter: "rondo/model/sonnet", verdict: "unavailable" }]);
  expect(steps[2]?.state).toBe("ahead");
});

test("at a gate the step the work is on is the person's, whatever its readings say", () => {
  // The work is done -- a gate follows it -- and the step the lap is stopped
  // on is the person's. What did not happen is still not claimed: a lap that
  // reached a gate with no checks recorded has not passed any.
  const steps = stepsOf(lap({ status: "awaiting_human" }), []);
  expect(steps.map((step) => step.state)).toEqual(["done", "ahead", "ahead", "waiting", "yours"]);
  const checked = stepsOf(lap({ status: "awaiting_human" }), [
    { drafter: "rondo/checks", verdict: "clear" },
    { drafter: "rondo/model/sonnet", verdict: "clear" },
  ]);
  expect(checked.map((step) => step.state)).toEqual(["done", "done", "done", "waiting", "yours"]);
});

test("taking the work in is never rondo's, and is done only where the work closed", () => {
  // `merge_default_branch` is no member of the acts a scope may permit, so no
  // approval can put rondo on this step (page-logic/governance.ts).
  expect(stepsOf(lap({ gateOutcome: "approved" }), []).at(-1)).toEqual({
    name: "landing",
    state: "yours",
  });
  expect(stepsOf(lap({ status: "closed" }), []).at(-1)).toEqual({
    name: "landing",
    state: "done",
  });
});

test("exactly one step is the one the work is on", () => {
  for (const record of [
    lap({}),
    lap({ status: "awaiting_human" }),
    lap({ gateOutcome: "approved" }),
    lap({ status: "closed" }),
  ]) {
    const waiting = stepsOf(record, [{ drafter: "rondo/checks", verdict: "clear" }]).filter(
      (step) => step.state === "waiting",
    );
    expect(waiting.length).toBeLessThanOrEqual(1);
  }
});

test("the one answer this figure cannot date is named rather than guessed at", () => {
  // A gate walked from the page leaves no dated row of rondo's own, and
  // dating it by the lap's last movement would file an answer under the week
  // a retry moved it. The module says which answer is not counted and why,
  // which is what `WITHHELD_NOT_READ` does for the governance line.
  expect(GATE_ANSWERS_NOT_DATED).toContain("gate");
  expect(GATE_ANSWERS_NOT_DATED).toContain("dated");
});
