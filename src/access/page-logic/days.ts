/**
 * Where a request sits on the time axis (DECISIONS.md D-0083 rule 2).
 *
 * **The list is cut by day and never by status.** `D-0082` rule 1 made the
 * three questions -- waiting, running, ended -- the page's spine; `D-0083`
 * annotates that as *not additive* and replaces it: the unit is a request and
 * the axis is time, so what heads a group is *today* or *last week* and never
 * *running now*. The one exception is rule 2's own: a request waiting on the
 * person is lifted out of the order entirely, under *your turn*, and that lift
 * is the caller's to make -- this module only says which day a request fell
 * on.
 *
 * **A day heading says nothing false about a row that has left it**, which is
 * the argument `D-0083` uses to allow the lift that `D-0082` rule 1 refused
 * for status groups: *just finished* stops being true of a row, and *last
 * week* does not.
 *
 * **Local days, not 24-hour buckets.** *Today* means the same calendar day as
 * the reader's, so a request from 23:50 last night is *yesterday* at 00:10 and
 * not *four hours ago*. The boundaries come from the host's own zone, which is
 * the one the reader is in: rondo is a resident process a person talks to on
 * their own machine (`D-0064`), so there is no second zone to reconcile.
 *
 * Nothing here is words. The cut is a name and the wording set says it, so the
 * Japanese is composed rather than translated (`D-0079`).
 */

/** Which group of the list a request falls into, newest first. */
export type DayCut = "today" | "yesterday" | "lastWeek" | "month" | "older";

/** Every cut, in the order the list draws them. */
export const DAY_CUTS: readonly DayCut[] = Object.freeze([
  "today",
  "yesterday",
  "lastWeek",
  "month",
  "older",
] as const);

/** Midnight at the start of the local day `atMs` falls in. */
function startOfDay(atMs: number): number {
  const at = new Date(atMs);
  return new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime();
}

/** How many local days separate two moments, by their day boundaries and not by elapsed hours. */
function daysBetween(atMs: number, nowMs: number): number {
  // Over the day boundaries rather than `(now - at) / 86_400_000`: a day is not
  // always 86,400 seconds where the clocks move, and what is being asked is
  // "how many midnights ago", which is a question about the calendar.
  const days = (startOfDay(nowMs) - startOfDay(atMs)) / 86_400_000;
  return Math.round(days);
}

/**
 * The cut one request falls into.
 *
 * **A request in the future is *today*.** A clock that has been set back, or a
 * row written by a machine a second ahead, would otherwise land in a group
 * headed by a day that has not happened. It is the reader's present either
 * way, so it reads as now.
 */
export function dayCut(atMs: number, nowMs: number): DayCut {
  const days = daysBetween(atMs, nowMs);
  if (days <= 0) {
    return "today";
  }
  if (days === 1) {
    return "yesterday";
  }
  // *Last week* is the rest of the last seven days and not the previous
  // calendar week: the list is read from today backwards, so what the reader
  // means by it is "recent, but not the last two days".
  if (days <= 7) {
    return "lastWeek";
  }
  return days <= 31 ? "month" : "older";
}

/**
 * The requests of one list, cut into groups and ordered newest first inside
 * each.
 *
 * Generic over the row so that this stays a fact about time: it is handed
 * whatever the list draws and a way to read the moment off it, and it returns
 * the same values regrouped. **Empty groups are dropped**, because a heading
 * over nothing is a heading that says something false about the list.
 */
export function byDay<T>(
  rows: readonly T[],
  atMsOf: (row: T) => number,
  nowMs: number,
): readonly { readonly cut: DayCut; readonly rows: readonly T[] }[] {
  const held = new Map<DayCut, T[]>();
  for (const row of rows) {
    const cut = dayCut(atMsOf(row), nowMs);
    const into = held.get(cut);
    if (into === undefined) {
      held.set(cut, [row]);
    } else {
      into.push(row);
    }
  }
  return DAY_CUTS.flatMap((cut) => {
    const rowsIn = held.get(cut);
    return rowsIn === undefined
      ? []
      : [{ cut, rows: [...rowsIn].sort((left, right) => atMsOf(right) - atMsOf(left)) }];
  });
}
