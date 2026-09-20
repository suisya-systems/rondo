/**
 * The last seven days, and what is running, as facts rather than as markup
 * (DECISIONS.md D-0083 rule 4).
 *
 * **What rule 4 asks the empty state's right face to hold**: the last seven
 * days -- asked, finished, answered by the person, decided by rondo without
 * asking, spent, left of the week's allowance -- and each running request with
 * its allowance and the five steps to its end. This module answers all of that
 * from rows that already exist and stores none of it, which is
 * `page-logic/governance.ts`'s rule kept: a figure with a cache behind it
 * would be a second answer to *what happened this week*.
 *
 * **The window is seven days back from the caller's clock**, and the clock is
 * handed in rather than read here for `page-logic/list.ts`'s reason: a
 * function that asks the clock cannot be checked against a fixed week.
 *
 * **"The week's allowance" is the approvals in force this week, summed.**
 * rondo holds no weekly budget -- what a person approves is one request's
 * scope (`D-0066`) -- so the pair rule 4 asks for is read as the approvals the
 * week's work spends and what has been spent against them. It is a reading of
 * rule 4 against what the store holds and not a new allowance: no week figure
 * is written anywhere, and with no approval to read, both figures are withheld
 * together, which is rule 6's refusal to show a spend without the figure it
 * was approved against.
 */
import type { IterationRecord } from "../../store/records.js";
import type { StepState } from "./governance.js";

/** Seven days, as rule 4's window. */
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** One approval in force, narrowed to the two figures rule 6 pairs. */
export interface Allowance {
  readonly spentUsd: number;
  readonly approvedUsd: number;
}

/** What the week is counted from: moments, one count, and the approvals. */
export interface WeekReads {
  /** When each request was asked, over all of time; the window is applied here. */
  readonly askedAtMs: readonly number[];
  /** When each finished request's work closed. */
  readonly finishedAtMs: readonly number[];
  /** Each act of the person's that answered something. */
  readonly answeredAtMs: readonly number[];
  /**
   * What rondo decided without calling anybody, already counted over the
   * window by the store (`attentionBreakdown`'s `withheld` side, `D-0032` rule
   * 10).
   *
   * A count and not a list of moments, because it is the one figure this
   * module cannot narrow itself: the rows are the store's and the interval is
   * the query's.
   */
  readonly decidedWithoutAsking: number;
  /** The approvals the week's work spends, already deduplicated by the caller. */
  readonly allowances: readonly Allowance[];
}

/** The six figures, ready to be said. */
export interface WeekFigures {
  readonly asked: number;
  readonly finished: number;
  readonly answered: number;
  readonly decidedWithoutAsking: number;
  /** Spent, approved and left -- or null where no approval reads, which hides all three. */
  readonly allowance: (Allowance & { readonly leftUsd: number }) | null;
}

export function weekFigures(reads: WeekReads, nowMs: number): WeekFigures {
  const fromMs = nowMs - WEEK_MS;
  const inWeek = (atMs: number) => atMs >= fromMs && atMs <= nowMs;
  const spentUsd = reads.allowances.reduce((sum, one) => sum + one.spentUsd, 0);
  const approvedUsd = reads.allowances.reduce((sum, one) => sum + one.approvedUsd, 0);
  return {
    asked: reads.askedAtMs.filter(inWeek).length,
    finished: reads.finishedAtMs.filter(inWeek).length,
    answered: reads.answeredAtMs.filter(inWeek).length,
    decidedWithoutAsking: reads.decidedWithoutAsking,
    allowance:
      reads.allowances.length === 0
        ? null
        : // Never below zero: a spend past its approval is the budget's own
          // refusal to report, and *left* is what remains and not a debt.
          { spentUsd, approvedUsd, leftUsd: Math.max(0, approvedUsd - spentUsd) },
  };
}

/** The five steps rule 4 puts under a running request, in the order they happen. */
export type StepName = "work" | "checks" | "reading" | "approval" | "landing";

/**
 * The four rondo can be in the middle of, and then the one that is the
 * person's: taking the work in is never rondo's, so it is not a step rondo can
 * be stopped on.
 */
const BEFORE_LANDING = Object.freeze(["work", "checks", "reading", "approval"] as const);

export interface WorkStep {
  readonly name: StepName;
  readonly state: StepState;
}

/** Whether a reading is the automatic checks rather than a model's (`thread-events.ts`). */
function isChecks(drafter: string): boolean {
  return !drafter.startsWith("rondo/model/");
}

/** One reading of a lap, narrowed to what a step is read from. */
export interface StepReading {
  readonly drafter: string;
  readonly verdict: string;
}

/**
 * Where one running request stands, as five steps.
 *
 * **Read off the lap's own row and its readings, and off nothing else** --
 * the same two sources `lapEvents` draws the thread's lines from, so the face
 * and the thread cannot disagree about what has happened.
 *
 * **The last step is the person's whatever else is true.** rondo does not
 * merge: `merge_default_branch` is no member of the acts a scope may permit
 * (`page-logic/governance.ts`), so drawing *taking it in* as *ahead* would
 * suggest rondo were going to do it.
 *
 * **Exactly one step is `waiting`, and at a gate it is the person's.** A lap
 * standing at a gate has done its work whatever its readings say, so marking
 * an earlier step as the one it is stopped on would point a person at the
 * wrong thing. A step that did not happen is still not marked done: a lap that
 * reached a gate with no checks recorded has passed none, and the face says
 * *not yet* about them rather than filling the row in.
 */
export function stepsOf(
  record: IterationRecord,
  readings: readonly StepReading[],
): readonly WorkStep[] {
  const read = readings.filter((reading) => reading.verdict !== "unavailable");
  const atGate = record.status === "awaiting_human";
  const answered = record.gateOutcome !== null;
  const closed = record.status === "closed";
  const done = {
    work: closed || atGate || answered || read.length > 0,
    checks: read.some((reading) => isChecks(reading.drafter)),
    reading: read.some((reading) => !isChecks(reading.drafter)),
    approval: answered,
  };
  const waitingAt = atGate ? "approval" : BEFORE_LANDING.find((name) => !done[name]);
  return [
    ...BEFORE_LANDING.map(
      (name): WorkStep => ({
        name,
        state: done[name] ? "done" : name === waitingAt ? "waiting" : "ahead",
      }),
    ),
    { name: "landing", state: closed ? "done" : "yours" },
  ];
}
