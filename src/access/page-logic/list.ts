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
import { approvedForPublication, type IterationRecord } from "../../store/records.js";
import { byDay, type DayCut } from "./days.js";
import type { LapResult } from "./result.js";

/**
 * What a request's row says about its state, as a name the wording set says.
 *
 * `approved` is a gate recorded as answered yes (rondo#376, D-0092), apart from `finished`: what a
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
 * The person's own name for a place (`D-0081` rule 4.2, `D-0076` rule 3.3).
 *
 * A plan's `repository` is an absolute path, and a path is rondo's way of
 * holding a place rather than the person's way of saying it. What the person
 * calls the place is its last segment -- the name they cloned it under and the
 * name they say out loud -- so that is what the screen draws, never the whole
 * path and never the `OWNER/NAME` the forge knows it by.
 *
 * A value with no segment left after the separators (`/`, `\`) is given back
 * as it came: rondo does not invent a name for a place it cannot read one off.
 */
function placeName(repository: string): string {
  const segments = repository.split(/[/\\]/).filter((segment) => segment !== "");
  return segments[segments.length - 1] ?? repository;
}

/**
 * **The repository is said only where the person could not otherwise tell two
 * things apart** (`D-0081` rule 4.2 and its gate's answer 4, `D-0076` rules
 * 3.3 and 5.1).
 *
 * `among` is every repository the set being drawn is in. Where that set holds
 * one repository -- which is the person who works in one repository most days
 * -- naming it separates nothing, and by rule 5.1 a thing that separates
 * nothing is not on the page. Where it holds two or more, the repository is
 * the thing that tells them apart, and it is said as {@link placeName} says
 * it.
 *
 * This is the same shape as the try number on a thread's lines: one try has
 * nothing to tell apart and the number would be noise.
 */
export function placeSaid(
  repository: string | null,
  among: readonly (string | null)[],
): string | null {
  if (repository === null) {
    return null;
  }
  const places = new Set(among.filter((one): one is string => one !== null));
  return places.size > 1 ? placeName(repository) : null;
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
  // `approved` only on a recorded approval (D-0092): a change asked for, or an
  // answer rondo holds no record of, is not one.
  return record.status !== "closed"
    ? "stopped"
    : approvedForPublication(record)
      ? "approved"
      : "finished";
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
