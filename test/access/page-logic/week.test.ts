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
  finishedAt,
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
        { spentUsd: 4, heldUsd: 0, heldTries: 0, heldInProgress: false, approvedUsd: 20 },
        { spentUsd: 1.5, heldUsd: 0, heldTries: 0, heldInProgress: false, approvedUsd: 30 },
      ],
    },
    NOW,
  );
  expect(figures.allowance).toMatchObject({ spentUsd: 5.5, approvedUsd: 50, leftUsd: 44.5 });
  const over = weekFigures(
    {
      ...reads,
      allowances: [
        { spentUsd: 9, heldUsd: 0, heldTries: 0, heldInProgress: false, approvedUsd: 5 },
      ],
    },
    NOW,
  );
  expect(over.allowance?.leftUsd).toBe(0);
});

test("what is held is summed apart from what was spent, and is not left", () => {
  // rondo#378: the reserve an unread lap holds is not money spent, so it is
  // never folded into the spend; but the store's check counts it, so it is not
  // left either.
  const figures = weekFigures(
    {
      ...reads,
      allowances: [
        { spentUsd: 0.79, heldUsd: 2.5, heldTries: 1, heldInProgress: true, approvedUsd: 25 },
        { spentUsd: 1, heldUsd: 0, heldTries: 0, heldInProgress: false, approvedUsd: 5 },
      ],
    },
    NOW,
  );
  expect(figures.allowance).toEqual({
    spentUsd: 1.79,
    heldUsd: 2.5,
    heldTries: 1,
    heldInProgress: true,
    approvedUsd: 30,
    leftUsd: 30 - 1.79 - 2.5,
  });
});

test("the pair is one approval's own, so a raise is not read as a total", () => {
  // D-0074 rule 2 and section 3.2: budgets are per approved row and the
  // successor starts at zero. A week that added a predecessor's $4 into a
  // successor's $10 would say "$14 approved", which is the misreading that
  // entry exists to prevent; what the predecessor spent is the scope screen's
  // to show.
  const raised = weekFigures(
    {
      ...reads,
      allowances: [
        { spentUsd: 2, heldUsd: 0, heldTries: 0, heldInProgress: false, approvedUsd: 10 },
      ],
    },
    NOW,
  );
  expect(raised.allowance).toMatchObject({ spentUsd: 2, approvedUsd: 10, leftUsd: 8 });
});

test("a request still working is on its work, and nothing later is claimed", () => {
  const steps = stepsOf(lap({}), []);
  expect(steps.map((step) => step.state)).toEqual([
    "waiting",
    "ahead",
    "ahead",
    "ahead",
    "ahead",
    "yours",
  ]);
});

test("a reading moves the step it belongs to, and the checks are not the model's", () => {
  const checked = stepsOf(lap({}), [{ drafter: "rondo/checks", verdict: "clear" }]);
  expect(checked.map((step) => step.state)).toEqual([
    "done",
    "done",
    "waiting",
    "ahead",
    "ahead",
    "yours",
  ]);
  const modelRead = stepsOf(lap({}), [{ drafter: "rondo/model/sonnet", verdict: "clear" }]);
  // The model read it and the checks have not run: what is done is what
  // happened, and the step the work is on is the first that has not.
  expect(modelRead.map((step) => step.state)).toEqual([
    "done",
    "waiting",
    "done",
    "ahead",
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
  expect(steps.map((step) => step.state)).toEqual([
    "done",
    "ahead",
    "ahead",
    "waiting",
    "ahead",
    "yours",
  ]);
  const checked = stepsOf(lap({ status: "awaiting_human" }), [
    { drafter: "rondo/checks", verdict: "clear" },
    { drafter: "rondo/model/sonnet", verdict: "clear" },
  ]);
  expect(checked.map((step) => step.state)).toEqual([
    "done",
    "done",
    "done",
    "waiting",
    "ahead",
    "yours",
  ]);
});

test("taking the work in is never rondo's, and a closed lap is not evidence it happened", () => {
  // `merge_default_branch` is no member of the acts a scope may permit, so no
  // approval can put rondo on this step (page-logic/governance.ts).
  expect(stepsOf(lap({ gateOutcome: "approved" }), []).at(-1)).toEqual({
    name: "landing",
    state: "yours",
  });
  // **And a closed lap does not make it done** (rondo#350, Codex). A lap
  // closes the moment its gate reaches a terminal outcome, with no publish and
  // no merge between, so marking the step done there claims something rondo
  // never watched -- which rule 6's chain has always refused to claim for
  // *merge*. It was invisible while these steps were drawn only under running
  // work; rule 6 draws them under a request being answered, where a closed lap
  // is the ordinary case.
  expect(stepsOf(lap({ status: "closed" }), []).at(-1)).toEqual({
    name: "landing",
    state: "yours",
  });
});

test("the pull request is its own step, between the approval and the merge (rondo#376)", () => {
  const publish = (record: Parameters<typeof stepsOf>[0], published = false) =>
    stepsOf(record, [], published).find((step) => step.name === "publish")?.state;
  // Approve, publish and merge are three acts, and lap 11's owner could not
  // tell which had happened. An approved lap's publish is the person's; it is
  // done only once rondo's report of it is in the thread.
  const approved = lap({
    status: "closed",
    gateOutcome: "answered_and_forwarded",
    gateAnswer: "approve",
  });
  expect(publish(approved)).toBe("yours");
  // rondo#385 / D-0092: a change asked for, or no record of which answer it
  // was, is not the person's to publish.
  expect(publish({ ...approved, gateAnswer: "revise" })).toBe("ahead");
  expect(publish({ ...approved, gateAnswer: null })).toBe("ahead");
  expect(publish(approved, true)).toBe("done");
  // A gate that closed without a yes has nothing to publish.
  expect(publish(lap({ status: "closed", gateOutcome: "withdrawn" }))).toBe("ahead");
  expect(publish(lap({ status: "awaiting_human" }))).toBe("ahead");
  expect(stepsOf(approved, []).map((step) => step.name)).toEqual([
    "work",
    "checks",
    "reading",
    "approval",
    "publish",
    "landing",
  ]);
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

const TERMINAL = (status: string) => ["closed", "failed", "abandoned"].includes(status);

test("a request finishes once, at its newest closing", () => {
  // Rule 2's unit is the request: three tries and one taking-in is one
  // finish, dated by the try that was taken in.
  expect(
    finishedAt(
      [
        [
          { status: "closed", updatedAtMs: 10 },
          { status: "failed", updatedAtMs: 20 },
        ],
      ],
      TERMINAL,
    ),
  ).toEqual([10]);
});

test("a request with work still under way has not finished", () => {
  // Otherwise the same request is under *finished* and under *work under way*
  // at once, and is counted again the week its next revision closes.
  expect(
    finishedAt(
      [
        [
          { status: "closed", updatedAtMs: 10 },
          { status: "performing", updatedAtMs: 30 },
        ],
      ],
      TERMINAL,
    ),
  ).toEqual([]);
  // And a request that only ever stopped has not finished either.
  expect(finishedAt([[{ status: "abandoned", updatedAtMs: 10 }]], TERMINAL)).toEqual([]);
});
