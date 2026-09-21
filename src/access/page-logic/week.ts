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
 *
 * **Both figures are the approval in force, and a raise starts at zero**
 * (`D-0074` rule 2 and section 3.2). Budgets are per approved row: a successor
 * scope states what may be spent *from here on*, and what the predecessor
 * spent stays written under the predecessor. So the pair is read off the tip
 * of each chain and nothing older is added into it -- a week that summed the
 * chain would make a raise read as "$15 in total", which is the misreading
 * `D-0074` rule 2 exists to prevent. What a predecessor spent is not lost; it
 * is a fact about an allowance that is no longer the one in force, and the
 * screen that shows it is the scope screen's (`D-0074` section 4.2), not this
 * face's.
 */
import { approvedForPublication, type IterationRecord } from "../../store/records.js";
import type { StepState } from "./governance.js";

/**
 * **Why an answer walked at a gate from the page is not in *you answered*.**
 *
 * The three kinds of answer this figure counts each leave a dated row of
 * rondo's own: a decision on a proposal (`human_decision`), an approval of a
 * scope (`scope_decision`), and an answer written into a thread. A gate
 * answered by the page's press is walked into continuo, and what rondo's own
 * store keeps of it is the lap's `gate_outcome` beside an `updated_at_ms` that
 * goes on moving as the lap runs -- so there is no moment in this store to
 * count it at. Dating it by the lap's last movement would put an answer given
 * on Monday into the week a retry moved it, which is worse than a figure that
 * says what it can date.
 *
 * The right source is a dated row written where the press is answered, which
 * is a write on the answer path and not a read on the page's.
 */
export const GATE_ANSWERS_NOT_DATED =
  "a gate walked from the page leaves no dated answer row in this store, so 'you answered' " +
  "counts decisions, scope approvals and answers in a thread, and not that press";

/** Seven days, as rule 4's window. */
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * One approval in force, narrowed to the figures rule 6 pairs: what was spent,
 * what is held for tries whose cost is not read yet (rondo#378), and what was
 * approved.
 */
export interface Allowance {
  /** What the laps' rows say they cost -- read, never reserved. */
  readonly spentUsd: number;
  /** The reserve the unread laps hold; the store's check counts it as spent. */
  readonly heldUsd: number;
  /** How many laps hold it. */
  readonly heldTries: number;
  /** Whether every one of them is a try still going (`page-logic/governance.ts`). */
  readonly heldInProgress: boolean;
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
  /**
   * The approvals in force over the week's work -- one per chain, deduplicated
   * by the caller, each with its own spend and its own ceiling.
   */
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
  const heldUsd = reads.allowances.reduce((sum, one) => sum + one.heldUsd, 0);
  const heldTries = reads.allowances.reduce((sum, one) => sum + one.heldTries, 0);
  const heldInProgress = reads.allowances.every((one) => one.heldTries === 0 || one.heldInProgress);
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
          // What is held is not left: the store's check counts it as spent.
          {
            spentUsd,
            heldUsd,
            heldTries,
            heldInProgress,
            approvedUsd,
            leftUsd: Math.max(0, approvedUsd - spentUsd - heldUsd),
          },
  };
}

/** One lap, narrowed to what *finished* is read from. */
export interface FinishedLap {
  readonly status: string;
  readonly updatedAtMs: number;
}

/**
 * When each **request** finished, given every lap under each of them.
 *
 * **A request and not a lap** (rule 2's unit): a request tried three times and
 * taken in once has finished once, so the laps are grouped by their request
 * and the newest closing is the moment.
 *
 * **And only where nothing under it is still going.** A closed lap with a
 * running revision beside it is a request still being worked on: counting it
 * would put the same request under *finished* and under *work under way* at
 * once, and count it again the week the next revision closes.
 *
 * `isTerminal` is handed in rather than imported for `lapEvents`'s reason: the
 * store owns which statuses are terminal, and this owns what is counted.
 */
export function finishedAt(
  requests: readonly (readonly FinishedLap[])[],
  isTerminal: (status: string) => boolean,
): number[] {
  return requests.flatMap((laps) => {
    const closed = laps.filter((lap) => lap.status === "closed");
    return closed.length === 0 || !laps.every((lap) => isTerminal(lap.status))
      ? []
      : [Math.max(...closed.map((lap) => lap.updatedAtMs))];
  });
}

/**
 * The steps rule 4 puts under a running request, in the order they happen.
 *
 * `publish` is opening the pull request (rondo#376), between the approval and
 * the merge: three acts a person could not tell apart on lap 11's screen.
 */
export type StepName = "work" | "checks" | "reading" | "approval" | "publish" | "landing";

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
 * **The last step is the person's whatever else is true, and it never reads
 * as done.** rondo does not merge: `merge_default_branch` is no member of the
 * acts a scope may permit (`page-logic/governance.ts`), so drawing *taking it
 * in* as *ahead* would suggest rondo were going to do it -- and marking it
 * *done* because the lap closed would claim something rondo never watched.
 *
 * **That claim used to be made, and rondo#350 is where it showed.** A lap
 * closes the moment its gate reaches a terminal outcome, with no publish and
 * no merge between; while these steps were drawn only under *running* work
 * (rule 4) no closed lap ever reached them, so `closed` standing for *taken
 * in* was invisible. Rule 6 draws the same five steps under a request being
 * answered, where a closed lap is the ordinary case, and the face would have
 * said the work had landed for every request whose gate was answered. Rule
 * 6's own chain has always said *merge* is the person's and never done
 * (`page-logic/governance.ts`); this now says the same thing.
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
  /**
   * Whether the lap has been published (`page-logic/result.ts`). **Done only
   * on the report that says so**; before it, an approved lap's publish is the
   * person's, and anything earlier has it still ahead.
   */
  published = false,
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
    {
      name: "publish",
      // The person's only on a recorded approval (D-0092).
      state: published ? "done" : approvedForPublication(record) ? "yours" : "ahead",
    },
    { name: "landing", state: "yours" },
  ];
}
