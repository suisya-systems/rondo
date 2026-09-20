/**
 * How event lines fold (DECISIONS.md D-0083 rule 7, its unresolved list,
 * rondo#332).
 *
 * **Rule 7 says one line per thing that happened, and that is what this adds
 * to.** A request tried once draws three or four lines and reads as a record.
 * The request the preview seeds was tried seven times and draws twenty-one,
 * and at that length the thread stops being a record and becomes a log: the
 * question at the bottom is below a screen of *work started* and *the checks
 * passed*, none of which is being asked about. D-0083 named this on its
 * unresolved list -- *how event lines fold past twenty* -- and left the rule
 * at *above the last-looked line* (rule 8, at 1600 only).
 *
 * **Two things this must not do**, both of them rule 7's:
 *
 * 1. **A decision rondo made without asking stays on the time axis at the
 *    moment it was made.** Rule 7 puts it there and rule 6 counts the same
 *    things on the right face, so a fold that swallowed one would leave the
 *    count naming things the thread no longer has. {@link folds} refuses to
 *    fold the `decided` kind at all: a run being folded is cut around it, and
 *    it is drawn as its own line inside or outside the fold either way.
 * 2. **A fold never crosses a message.** The thread is one stream in time
 *    order, and a message -- a report, the question, the person's own words --
 *    is not an event line. A run is a maximal stretch of foldable events with
 *    nothing else in it.
 *
 * **No line-count threshold.** Neither mode needs one: a request with one try
 * has no settled try to fold ({@link foldTries}), and a person who has read
 * nothing has nothing already-read to fold ({@link foldSeen}). A threshold
 * would be a number to defend in both directions, and the unit each mode folds
 * by already says when there is nothing to do.
 *
 * **Nothing is thrown away.** A fold is a `<details>` (`page/events.tsx`): the
 * lines are in the page, shut, and opening one is the browser's own act with
 * no script and no address of its own.
 */
import type { ThreadEvent } from "../page/events.js";
import type { ThreadItem } from "../page/thread.js";
import type { PageWords } from "../page/words.js";

/**
 * Which of the two ways the thread is folded.
 *
 * `tries` folds by what was done: every try but the newest becomes one line.
 * `seen` folds by what was read: everything above the last-looked line becomes
 * one line. They are the two answers rondo#332 puts to the gate, and one of
 * them leaves once the gate has chosen.
 *
 * `none` is the thread as rule 7 alone draws it, which is the photograph the
 * other two are compared against. It leaves with the losing mode.
 */
export type FoldMode = "tries" | "seen" | "none";

/** A run of event lines drawn as one line, with the lines kept inside it. */
export interface FoldLine {
  readonly kind: "fold";
  /** Stable within a thread, so a redraw keeps the reader's place. */
  readonly id: string;
  /** The one sentence the shut fold says. */
  readonly said: string;
  /** The time at the right edge: the last moment inside the fold. */
  readonly at: string;
  /** The lines inside, oldest first. */
  readonly inside: readonly ThreadEvent[];
}

/** The thread as it is drawn: its own items, with runs of event lines folded. */
export type FoldedItem = ThreadItem | FoldLine;

/** Nothing is gained by drawing one line as one line. */
const SHORTEST_FOLD = 2;

/** Rule 7's one exception: a decision made without asking is never folded away. */
function foldable(item: ThreadItem): boolean {
  return item.kind === "event" && item.event.kind !== "decided";
}

/** What identifies an item, for the last-looked line and for a stable redraw. */
function idOf(item: ThreadItem): string {
  return item.kind === "message" ? item.message.id : item.event.id;
}

/**
 * The stream cut into stretches: a run of foldable event lines, or anything
 * else left as it is.
 *
 * A message, and a *rondo decided this without asking* line, both end a run:
 * the first because a fold never crosses what was said, the second because
 * rule 7 keeps it on the axis.
 */
type Run =
  | { readonly fold: true; readonly events: readonly ThreadEvent[] }
  | { readonly fold: false; readonly items: readonly ThreadItem[] };

function runs(items: readonly ThreadItem[]): readonly Run[] {
  const out: ({ fold: true; events: ThreadEvent[] } | { fold: false; items: ThreadItem[] })[] = [];
  for (const item of items) {
    const open = out[out.length - 1];
    if (foldable(item) && item.kind === "event") {
      if (open !== undefined && open.fold) {
        open.events.push(item.event);
      } else {
        out.push({ fold: true, events: [item.event] });
      }
    } else if (open !== undefined && !open.fold) {
      open.items.push(item);
    } else {
      out.push({ fold: false, items: [item] });
    }
  }
  return out;
}

/** The lines themselves, for a run that is not worth folding. */
function drawn(events: readonly ThreadEvent[]): readonly FoldedItem[] {
  return events.map((event) => ({ kind: "event", event }) as const);
}

/**
 * One stretch of lines become a fold -- or, too short to be worth it, the
 * lines themselves.
 */
function fold(
  events: readonly ThreadEvent[],
  said: (inside: readonly ThreadEvent[]) => string,
): readonly FoldedItem[] {
  const first = events[0];
  const last = events[events.length - 1];
  if (events.length < SHORTEST_FOLD || first === undefined || last === undefined) {
    return drawn(events);
  }
  return [
    {
      kind: "fold",
      // Named by the first line inside it, which is stable for as long as that
      // line is: an id of the fold's own would move every time a line joined.
      id: `fold:${first.id}`,
      said: said(events),
      at: last.at,
      inside: events,
    },
  ];
}

/**
 * The sentence a folded try is said by.
 *
 * **What went wrong outranks what went right.** A try that failed its checks
 * and then ended is read as the try that failed, which is the thing a person
 * scanning seven of them is looking for, and the adopted mock-up's own line
 * says it the same way. With nothing failed, the last line of the run is the
 * ending, and the ending is what the try was.
 */
function notable(inside: readonly ThreadEvent[]): ThreadEvent | undefined {
  return inside.find((event) => event.kind === "failed") ?? inside[inside.length - 1];
}

/**
 * **Every try but the newest, one line each** (rondo#332 option a, and the
 * shape the adopted mock-up takes).
 *
 * The unit is a try, so what folds does not depend on how much the person has
 * read, on the width, or on a count of lines. A request tried once folds
 * nothing: its lines carry no try number, because with one try there is
 * nothing to tell apart (`lapEvents`), and lines with no try number are left
 * alone.
 */
function foldTries(words: PageWords, items: readonly ThreadItem[]): readonly FoldedItem[] {
  const tries = items.flatMap((item) =>
    item.kind === "event" && item.event.tryAt != null ? [item.event.tryAt] : [],
  );
  const newest = tries.length === 0 ? null : Math.max(...tries);
  return runs(items).flatMap((run): readonly FoldedItem[] => {
    if (!run.fold) {
      return run.items;
    }
    // A run may hold more than one try, where two laps' lines sit together
    // with nothing between them; each try folds on its own, so the line a
    // person reads is always about one attempt.
    const byTry = new Map<number, ThreadEvent[]>();
    const loose: ThreadEvent[] = [];
    for (const event of run.events) {
      const at = event.tryAt;
      if (at == null || at === newest) {
        loose.push(event);
        continue;
      }
      const held = byTry.get(at);
      if (held === undefined) {
        byTry.set(at, [event]);
      } else {
        held.push(event);
      }
    }
    // Oldest try first, then the newest try's own lines and anything carrying
    // no try: the run arrived in time order and this keeps it.
    return [
      ...[...byTry.keys()]
        .toSorted((left, right) => left - right)
        .flatMap((at) =>
          fold(byTry.get(at) as readonly ThreadEvent[], (inside) => {
            const head = notable(inside);
            return head === undefined ? "" : words.foldTry(head.said, inside.length);
          }),
        ),
      ...drawn(loose),
    ];
  });
}

/**
 * **Everything the person has already read, one line** (rondo#332 option c,
 * and rule 8's 1600 fold taken to every width).
 *
 * The unit is the last-looked line, so what folds is exactly what the person
 * is not being asked about. Where there is no line -- they have never looked,
 * or they have seen all of it -- there is nothing already-read to fold, and
 * the thread is drawn whole.
 */
function foldSeen(
  words: PageWords,
  items: readonly ThreadItem[],
  lastLookedAbove: string | null,
): readonly FoldedItem[] {
  const at = items.findIndex((item) => idOf(item) === lastLookedAbove);
  if (lastLookedAbove === null || at <= 0) {
    return items;
  }
  return [
    ...runs(items.slice(0, at)).flatMap((run): readonly FoldedItem[] =>
      run.fold ? fold(run.events, (inside) => words.foldSeen(inside.length)) : run.items,
    ),
    ...items.slice(at),
  ];
}

/**
 * The thread, folded (D-0083 rule 7's addition).
 *
 * `lastLookedAbove` is the id the last-looked line sits above, which is the
 * caller's to work out: only it has read the mark.
 */
export function folds(
  words: PageWords,
  items: readonly ThreadItem[],
  mode: FoldMode,
  lastLookedAbove: string | null,
): readonly FoldedItem[] {
  if (mode === "none") {
    return items;
  }
  return mode === "tries" ? foldTries(words, items) : foldSeen(words, items, lastLookedAbove);
}
