/**
 * The left face's rows, as facts rather than as markup (DECISIONS.md D-0083
 * rules 2, 5 and 7).
 *
 * **The unit is a request and the axis is time.** A row is a request, named by
 * the person's own words, and the groups are days -- not statuses. `D-0082`
 * rule 1 made the three questions the page's spine and `D-0083` annotates that
 * as *not additive*: a heading has to stay true of the row under it, and *just
 * finished* stops being true where *last week* does not.
 *
 * **One exception, and it is the only amber in the list** (rule 2). A request
 * waiting on the person is lifted out of the time order under *your turn*,
 * because a person alone can clear what it holds -- never because it is
 * interesting, which is `D-0082` rule 1's test, kept. Nothing else in the list
 * is amber, and a finished row may be cut to one line.
 *
 * **The last-looked line is a position, not a mark per row** (rule 7). This
 * answers *which row does the line sit above*, once, and no row carries a
 * *new* of its own.
 */
import type { IterationRecord } from "../../store/records.js";
import { byDay, type DayCut } from "./days.js";
import type { LapResult } from "./result.js";
import { approvedAt } from "./thread-events.js";

/**
 * What a request's row says about its state, as a name the wording set says.
 *
 * `approved` is a gate answered yes (rondo#376), apart from `finished`: what a
 * row says next is whether it was published and what its checks came to, and
 * a row that read *finished* there said nothing about either.
 */
export type RowState =
  | "waitingOnYou"
  | "running"
  | "approved"
  | "finished"
  | "stopped"
  | "notStarted";

/** One request, as the list draws it. */
export interface RequestRow {
  /** The message that opened the request, which is also the way into its thread. */
  readonly messageId: string;
  /** The person's own words, first line (rule 2: named by what they wrote). */
  readonly title: string;
  /** The repository this request's work is in (D-0081), or null where no lap names one. */
  readonly repository: string | null;
  readonly state: RowState;
  /** Where the row is `approved`: what its publish came to, or null before one. */
  readonly published?: LapResult | null;
  /** When the request last moved, which is what the day cut reads. */
  readonly atMs: number;
}

/** The list, as the left face draws it top to bottom. */
export interface RequestList {
  /** Lifted out of the time order; empty when nothing waits on the person. */
  readonly yourTurn: readonly RequestRow[];
  /** Everything else, cut by day, newest group first. */
  readonly days: readonly { readonly cut: DayCut; readonly rows: readonly RequestRow[] }[];
  /**
   * The row the "you last looked down to here" line sits above, or null when
   * there is no line to draw -- which is either that this actor has never
   * looked, or that they have seen everything.
   */
  readonly lastLookedAbove: string | null;
}

/** The repository a lap's plan names (D-0081), or null where it names none. */
export function repositoryOf(record: IterationRecord | null): string | null {
  const named = record?.plan["repository"];
  return typeof named === "string" && named !== "" ? named : null;
}

/**
 * What a request's row says, given the lap under it.
 *
 * **A request with no lap has not started**, which is a true thing to say and
 * not an absence: the person has asked, and rondo has not begun. It is the
 * state a request sits in while its scope is being agreed.
 */
export function rowStateOf(
  record: IterationRecord | null,
  waitingOnYou: boolean,
  isTerminal: (record: IterationRecord) => boolean,
): RowState {
  if (waitingOnYou) {
    return "waitingOnYou";
  }
  if (record === null) {
    return "notStarted";
  }
  if (!isTerminal(record)) {
    return "running";
  }
  return record.status !== "closed" ? "stopped" : approvedAt(record) ? "approved" : "finished";
}

/**
 * The list, assembled.
 *
 * `sinceMs` is where this actor's reading stopped, or null if they have never
 * looked (`src/access/inbox.ts`). The line is placed above the newest row they
 * had already seen, so what is above it is what arrived since.
 *
 * `nowMs` is the bound the day cut is read against, handed in rather than
 * taken from the clock: the list is a function of what was read, and a
 * function that asks the clock cannot be checked against a fixed day.
 */
export function requestList(
  rows: readonly RequestRow[],
  sinceMs: number | null,
  nowMs: number,
): RequestList {
  const yourTurn = rows
    .filter((row) => row.state === "waitingOnYou")
    .toSorted((left, right) => left.atMs - right.atMs);
  const rest = rows.filter((row) => row.state !== "waitingOnYou");
  const days = byDay(rest, (row) => row.atMs, nowMs);
  // The first row, in drawing order, that had already been seen. Only the rows
  // in the day groups are considered: what is lifted under *your turn* is
  // waiting on the person now, whenever it arrived, so a line above it would
  // say something false about it.
  const inOrder = days.flatMap((group) => group.rows);
  const seen = sinceMs === null ? undefined : inOrder.find((row) => row.atMs <= sinceMs);
  return {
    yourTurn,
    days,
    // No line where everything is new, or where nothing is: in both cases it
    // would sit at one end and divide nothing.
    lastLookedAbove:
      seen === undefined || seen.messageId === inOrder[0]?.messageId ? null : seen.messageId,
  };
}
