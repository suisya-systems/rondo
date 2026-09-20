/**
 * How event lines fold (DECISIONS.md D-0086, adding to D-0083 rule 7).
 *
 * **Rule 7 says one line per thing that happened, and this adds to it.** A
 * request tried once draws three or four lines and reads as a record. The
 * request the preview seeds was tried seven times and draws twenty-one, and at
 * that length the thread stops being a record and becomes a log: the person's
 * own words and the question being asked are below a screen of *work started*
 * and *the checks passed*, none of which is being asked about. D-0083 named
 * this on its unresolved list -- *how event lines fold past twenty* -- and
 * `D-0086` answers it.
 *
 * **Two folds, one inside the other**, and the outer one only for a person who
 * has been here before:
 *
 * 1. **By try** ({@link foldTries}): every try but the newest is one line,
 *    said by the one thing worth reading about it. This happens for everybody,
 *    so a person arriving from a notification for the first time still reads
 *    *seven tries, two of which failed their checks* off the thread.
 * 2. **By what was already read** ({@link foldSeen}): everything above the
 *    last-looked line -- by then already folded by try -- becomes one more
 *    line. This happens only where there is a line to fold above, so a person
 *    who has never looked loses nothing, and a person who has is not shown
 *    again what they have already been shown.
 *
 * **No line-count threshold, and that is the point.** Neither fold needs one:
 * a request tried once has no settled try, and a person who has read nothing
 * has nothing already-read. The unit each fold is measured in already says
 * when there is nothing to do, so there is no number here to defend in both
 * directions -- which is what *past twenty* would have been.
 *
 * **Two things this must not do**, both of them rule 7's:
 *
 * 1. **A decision rondo made without asking stays on the time axis at the
 *    moment it was made.** Rule 7 puts it there and rule 6 counts the same
 *    things on the right face, so a fold that swallowed one would leave the
 *    count pointing at a number inside a fold rather than at the axis. Neither
 *    fold takes the `decided` kind: a run is cut around it and it is drawn as
 *    its own line. **The adopted mock-up folds one away and says *rondo
 *    decided 1 thing* in the fold's own summary instead; that is not taken.**
 *    A mock-up is the material a decision was made from and not the decision
 *    (`D-0083`: *this entry decides and does not build*), so where the two
 *    disagree the rule wins.
 * 2. **A fold never crosses a message.** The thread is one stream in time
 *    order, and a message -- a report, the question, the person's own words --
 *    is not an event line. A run is a maximal stretch of foldable lines with
 *    nothing else in it.
 *
 * **Nothing is thrown away.** A fold is a `<details>` (`page/events.tsx`): the
 * lines are in the page, shut, and opening one is the browser's own act with
 * no script, no state of the page's and no address of its own.
 */
import type { ThreadEvent } from "../page/events.js";
import type { ThreadItem } from "../page/thread.js";
import type { PageWords } from "../page/words.js";

/** A run of lines drawn as one line, with the lines kept inside it. */
export interface FoldLine {
  readonly kind: "fold";
  /** Stable within a thread, so a redraw keeps the reader's place. */
  readonly id: string;
  /** The one sentence the shut fold says. */
  readonly said: string;
  /** The time at the right edge: the last moment inside the fold. */
  readonly at: string;
  /**
   * How many event lines are inside, counting through folds that are
   * themselves inside. What a person is told is how much of the record is
   * shut, and a fold of folds that said *6* would be counting its own
   * machinery rather than the record.
   */
  readonly lines: number;
  /** What is inside, oldest first; a fold of its own where one is nested. */
  readonly inside: readonly FoldedItem[];
}

/** The thread as it is drawn: its own items, with runs of event lines folded. */
export type FoldedItem = ThreadItem | FoldLine;

/** Nothing is gained by drawing one line as one line. */
const SHORTEST_FOLD = 2;

/** Rule 7's one exception: a decision made without asking is never folded away. */
function foldable(item: FoldedItem): boolean {
  return item.kind === "fold" || (item.kind === "event" && item.event.kind !== "decided");
}

/** What identifies an item, for the last-looked line and for a stable redraw. */
function idOf(item: FoldedItem): string {
  return item.kind === "message" ? item.message.id : item.kind === "fold" ? item.id : item.event.id;
}

/** How many event lines an item stands for, counting through nested folds. */
function linesIn(item: FoldedItem): number {
  return item.kind === "message" ? 0 : item.kind === "fold" ? item.lines : 1;
}

/** When an item happened, as a person reads it. */
function atOf(item: FoldedItem): string {
  return item.kind === "message" ? item.message.at : item.kind === "fold" ? item.at : item.event.at;
}

/**
 * The stream cut into stretches: a run of foldable lines, or anything else
 * left as it is.
 *
 * A message, and a *rondo decided this without asking* line, both end a run:
 * the first because a fold never crosses what was said, the second because
 * rule 7 keeps it on the axis.
 */
function runs(items: readonly FoldedItem[]): (readonly FoldedItem[])[] {
  const out: FoldedItem[][] = [];
  for (const item of items) {
    const open = out[out.length - 1];
    if (open !== undefined && foldable(item) === foldable(open[0] as FoldedItem)) {
      open.push(item);
    } else {
      out.push([item]);
    }
  }
  return out;
}

/** One stretch become a fold -- or, too short to be worth it, the lines themselves. */
function fold(
  inside: readonly FoldedItem[],
  said: (lines: number) => string,
): readonly FoldedItem[] {
  const first = inside[0];
  const last = inside[inside.length - 1];
  if (inside.length < SHORTEST_FOLD || first === undefined || last === undefined) {
    return inside;
  }
  const lines = inside.reduce((sum, item) => sum + linesIn(item), 0);
  return [
    {
      kind: "fold",
      // Named by the first thing inside it, which is stable for as long as
      // that thing is: an id of the fold's own would move every time a line
      // joined, and a redraw would lose whichever fold the person had opened.
      id: `fold:${idOf(first)}`,
      said: said(lines),
      at: atOf(last),
      lines,
      inside,
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
function notable(inside: readonly FoldedItem[]): ThreadEvent | undefined {
  const events = inside.flatMap((item) => (item.kind === "event" ? [item.event] : []));
  return events.find((event) => event.kind === "failed") ?? events[events.length - 1];
}

/**
 * **Every try but the newest, one line each -- and not the one the person
 * stopped reading in the middle of.**
 *
 * The unit is a try, so what folds does not depend on how much the person has
 * read, on the width, or on a count of lines. A request tried once folds
 * nothing: its lines carry no try number, because with one try there is
 * nothing to tell apart (`lapEvents`), and lines with no try number are left
 * where they are.
 *
 * **The try holding the last-looked line is left open** (Codex). The line is
 * drawn above the first thing that arrived after the person last looked, and
 * that is not always in the newest try: somebody who looked in the middle of
 * try 2 and came back during try 4 has their line inside try 2. Folding that
 * try away takes the line's anchor with it -- `foldSeen` then cannot find it,
 * and `ThreadFace` cannot draw it -- so **rule 7's one line in the thread
 * disappears**, and the lines the person has not read are silently grouped
 * with the ones they have. It reads as the rule it is, too: the attempt you
 * were part-way through is not one you have finished with.
 */
function foldTries(
  words: PageWords,
  items: readonly ThreadItem[],
  lastLookedAbove: string | null,
): readonly FoldedItem[] {
  const tries = items.flatMap((item) =>
    item.kind === "event" && item.event.tryAt != null ? [item.event.tryAt] : [],
  );
  const newest = tries.length === 0 ? null : Math.max(...tries);
  /** The try the last-looked line lands in, which is left whole beside the newest. */
  const reading = items.find((item) => item.kind === "event" && item.event.id === lastLookedAbove);
  const open = reading?.kind === "event" ? reading.event.tryAt : null;
  /** A try that is not folded: the newest, the one being read, or no try at all. */
  const kept = (at: number | null | undefined) => at == null || at === newest || at === open;
  return runs(items).flatMap((run): readonly FoldedItem[] => {
    if (!foldable(run[0] as FoldedItem)) {
      return run;
    }
    /*
     * **Grouped by consecutive try, so the run stays in the order it
     * happened.** Collecting each try's lines into a map and emitting the
     * folds first would put a try that is left open -- the one the person
     * stopped reading in the middle of -- after tries that came later, which
     * is the one thing the thread must never do (`D-0083` rule 5: one stream,
     * and that order is time). Where two laps' lines interleave, a try gets a
     * fold per stretch rather than one fold out of order; that is the honest
     * drawing of an interleaving, and time wins over tidiness.
     */
    const out: FoldedItem[] = [];
    let group: FoldedItem[] = [];
    let key: number | null = null;
    const flush = () => {
      if (group.length === 0) {
        return;
      }
      if (key === null) {
        out.push(...group);
      } else {
        const head = notable(group);
        out.push(
          ...fold(group, (lines) => (head === undefined ? "" : words.foldTry(head.said, lines))),
        );
      }
      group = [];
    };
    for (const item of run) {
      const at = item.kind === "event" ? item.event.tryAt : null;
      const next = kept(at) ? null : (at as number);
      if (next !== key) {
        flush();
        key = next;
      }
      group.push(item);
    }
    flush();
    return out;
  });
}

/**
 * **Everything the person has already read, one more line over the top.**
 *
 * The unit is the last-looked line, so what folds is exactly what the person
 * is not being asked about. Where there is no line -- they have never looked,
 * or they have seen all of it -- there is nothing already-read to fold, and
 * what {@link foldTries} left is what is drawn.
 */
function foldSeen(
  words: PageWords,
  items: readonly FoldedItem[],
  lastLookedAbove: string | null,
): readonly FoldedItem[] {
  const at = items.findIndex((item) => idOf(item) === lastLookedAbove);
  if (lastLookedAbove === null || at <= 0) {
    return items;
  }
  return [
    ...runs(items.slice(0, at)).flatMap((run): readonly FoldedItem[] =>
      foldable(run[0] as FoldedItem) ? fold(run, (lines) => words.foldSeen(lines)) : run,
    ),
    ...items.slice(at),
  ];
}

/**
 * The thread, folded (`D-0086`).
 *
 * `lastLookedAbove` is the id the last-looked line sits above, which is the
 * caller's to work out: only it has read the mark. It is an id of the
 * *unfolded* stream, and both folds are given it -- the first so that it does
 * not fold the line's anchor away, the second so that it knows where to stop.
 */
export function folds(
  words: PageWords,
  items: readonly ThreadItem[],
  lastLookedAbove: string | null,
): readonly FoldedItem[] {
  return foldSeen(words, foldTries(words, items, lastLookedAbove), lastLookedAbove);
}
