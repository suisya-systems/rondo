/**
 * Which request the centre face is showing (DECISIONS.md D-0083 rule 3).
 *
 * **The summary and the gate are one screen.** There is no separate decision
 * screen: arriving from a notification and opening the page land on the same
 * screen, and what differs is only which request is selected. From a
 * notification it is the one the notification names; opened by hand it is the
 * oldest request waiting on the person, because *the person came to answer*
 * (gate point 3, taken as recommended). With nothing waiting, nothing is
 * selected and rule 4's empty centre applies.
 *
 * **Oldest, not newest.** The walk -- *your turn 1 / 3, next* -- goes in the
 * same order, so a request that has been waiting since last week is met before
 * one that arrived an hour ago. A person who has three things waiting should
 * not have to find the oldest themselves; D-0083's own falsifier names that
 * failure.
 */
import type { RequestList } from "./list.js";

/** Where the centre face's request comes from, which the address decides. */
export type Selection =
  | { readonly kind: "request"; readonly messageId: string }
  /** Nothing waits and nothing was named: rule 4's empty centre. */
  | { readonly kind: "empty" };

/**
 * The request to show.
 *
 * `named` is the request the address names, if it names one -- a thread
 * opened by hand, or arrived at from a notification. It wins outright: a
 * person who asked for a request is not redirected to another one because it
 * has been waiting longer.
 */
export function selectRequest(named: string | null, list: RequestList): Selection {
  if (named !== null) {
    return { kind: "request", messageId: named };
  }
  // `yourTurn` is already oldest-first (`requestList`), so the first is the
  // one to answer.
  const oldest = list.yourTurn[0];
  return oldest === undefined
    ? { kind: "empty" }
    : { kind: "request", messageId: oldest.messageId };
}

/**
 * Where a request stands in the walk, or null when nothing is waiting.
 *
 * The count is over what waits on the person and not over the list, because
 * *your turn 1 / 3* is a position among the things they have to answer. A
 * request that is not waiting has no position in it, which is null rather
 * than zero.
 */
export function walkPosition(
  messageId: string,
  list: RequestList,
): { readonly at: number; readonly of: number } | null {
  const at = list.yourTurn.findIndex((row) => row.messageId === messageId);
  return at === -1 ? null : { at: at + 1, of: list.yourTurn.length };
}
