/**
 * How event lines fold (DECISIONS.md D-0086, adding to D-0083 rule 7).
 *
 * **What these cases hold down is the two things a fold must not do**, both of
 * them rule 7's own: a decision rondo made without asking stays on the time
 * axis at the moment it was made, and a fold never swallows what was said.
 * The first is the one the adopted mock-up got wrong, so it is the one with
 * the most cases under it.
 *
 * The rest is arithmetic about how many lines are left, which is what the two
 * folds were chosen on: twenty-one becomes nine for somebody who has never
 * looked, and four for somebody who has.
 */
import { expect, test } from "vitest";
import type { EventKind, ThreadEvent } from "../../../src/access/page/events.js";
import type { ThreadItem, ThreadMessage } from "../../../src/access/page/thread.js";
import { PAGE_EN } from "../../../src/access/page/words.js";
import type { FoldedItem, FoldLine } from "../../../src/access/page-logic/event-fold.js";
import { folds } from "../../../src/access/page-logic/event-fold.js";

const event = (
  id: string,
  kind: EventKind,
  tryAt: number | null,
  said = id,
): { readonly kind: "event"; readonly event: ThreadEvent } => ({
  kind: "event",
  event: { id, kind, said, at: "1h", atMs: 1, tryAt },
});

const message = (id: string): { readonly kind: "message"; readonly message: ThreadMessage } => ({
  kind: "message",
  message: { id, at: "1h" } as unknown as ThreadMessage,
});

/** One try's three lines: started, what the checks said, and how it ended. */
const oneTry = (at: number, checks: EventKind): readonly ThreadItem[] => [
  event(`lap-${String(at)}:started`, "other", at, `Try ${String(at)}: Work started.`),
  event(`lap-${String(at)}:reading`, checks, at, `Try ${String(at)}: checks.`),
  event(`lap-${String(at)}:ended`, "passed", at, `Try ${String(at)}: Finished.`),
];

const drawn = (items: readonly ThreadItem[], lastLookedAbove: string | null) =>
  folds(PAGE_EN, items, lastLookedAbove);

const foldsIn = (items: readonly FoldedItem[]): readonly FoldLine[] =>
  items.flatMap((item) => (item.kind === "fold" ? [item] : []));

const eventsIn = (items: readonly FoldedItem[]) => items.filter((item) => item.kind === "event");

/** Seven tries, the last one still at its gate: the thread rondo#332 opened on. */
const SEVEN: readonly ThreadItem[] = [
  message("request"),
  message("reading"),
  ...oneTry(1, "failed"),
  ...oneTry(2, "failed"),
  ...oneTry(3, "passed"),
  ...oneTry(4, "passed"),
  ...oneTry(5, "passed"),
  ...oneTry(6, "passed"),
  ...oneTry(7, "passed"),
];

test("the thread that was unreadable is twenty-one event lines", () => {
  expect(SEVEN.filter((item) => item.kind === "event")).toHaveLength(21);
});

test("a person who has never looked reads six folded tries and the newest try whole", () => {
  const out = drawn(SEVEN, null);
  expect(foldsIn(out)).toHaveLength(6);
  expect(eventsIn(out)).toHaveLength(3);
  // Nine lines where there were twenty-one, and the two messages beside them.
  expect(out).toHaveLength(11);
});

test("a person who has looked reads one line over the top, with the tries inside it", () => {
  const out = drawn(SEVEN, "lap-7:started");
  expect(foldsIn(out)).toHaveLength(1);
  const [seen] = foldsIn(out);
  expect(seen?.said).toBe("18 lines you had already read");
  // It counts event lines through the folds inside it, not the folds.
  expect(seen?.lines).toBe(18);
  expect(foldsIn(seen?.inside ?? [])).toHaveLength(6);
  expect(eventsIn(out)).toHaveLength(3);
  // Four lines where there were twenty-one, and the two messages beside them.
  expect(out).toHaveLength(6);
});

test("a folded try is said by what went wrong in it, and says how many lines it holds", () => {
  const [first] = foldsIn(drawn(SEVEN, null));
  expect(first?.said).toBe("Try 1: checks. (3 lines)");
  expect(first?.lines).toBe(3);
});

test("a try that failed nothing is said by how it ended", () => {
  expect(foldsIn(drawn(SEVEN, null))[2]?.said).toBe("Try 3: Finished. (3 lines)");
});

test("a request tried once folds nothing: its lines carry no try to group by", () => {
  const once: readonly ThreadItem[] = [
    message("request"),
    event("lap:started", "other", null),
    event("lap:reading", "passed", null),
    event("lap:ended", "passed", null),
  ];
  expect(drawn(once, null)).toEqual(once);
});

test("with the last-looked line above everything there is nothing already-read to fold", () => {
  expect(drawn(SEVEN, "request")).toEqual(drawn(SEVEN, null));
});

test("the try the person stopped reading in the middle of is left whole (Codex)", () => {
  // Looked during try 2 and came back during try 3: the line's anchor is
  // inside try 2, which is neither the newest try nor one they have finished.
  const out = drawn(SEVEN, "lap-2:reading");
  // Try 2 is drawn as its own lines, so `ThreadFace` still finds the id to
  // draw rule 7's one line in the thread above.
  expect(out.some((item) => item.kind === "event" && item.event.id === "lap-2:reading")).toBe(true);
  // What is above it has been read and folds; what is below has not.
  const [seen] = foldsIn(out);
  expect(seen?.said).toBe("4 lines you had already read");
  expect(eventsIn(out).map((item) => item.event.id)).toEqual([
    "lap-2:reading",
    "lap-2:ended",
    "lap-7:started",
    "lap-7:reading",
    "lap-7:ended",
  ]);
  // Tries 3 to 6 are still one line each: only the one being read is spared.
  // One fold for what was read, and four for the tries after it.
  expect(foldsIn(out)).toHaveLength(5);
});

test("folding keeps the thread in the order it happened", () => {
  // The try left open sits between the tries before it and the tries after,
  // never after them: one stream, and that order is time (D-0083 rule 5).
  const out = drawn(SEVEN, "lap-2:reading").map((item) =>
    item.kind === "fold" ? item.id : item.kind === "event" ? item.event.id : item.message.id,
  );
  expect(out).toEqual([
    "request",
    "reading",
    "fold:fold:lap-1:started",
    "lap-2:reading",
    "lap-2:ended",
    "fold:lap-3:started",
    "fold:lap-4:started",
    "fold:lap-5:started",
    "fold:lap-6:started",
    "lap-7:started",
    "lap-7:reading",
    "lap-7:ended",
  ]);
});

test("neither fold ever swallows a decision rondo made without asking (rule 7)", () => {
  const withDecision: readonly ThreadItem[] = [
    message("request"),
    ...oneTry(1, "failed"),
    event("lap-1:decided", "decided", 1, "Try 1: rondo decided this without asking."),
    ...oneTry(2, "passed"),
  ];
  for (const mark of [null, "lap-2:started"]) {
    const out = drawn(withDecision, mark);
    const kept = out.flatMap((item) =>
      item.kind === "event" && item.event.kind === "decided" ? [item.event.id] : [],
    );
    expect(kept, String(mark)).toEqual(["lap-1:decided"]);
    // And it is not hidden inside one either, at any depth: rule 6's count on
    // the right face names the same things, so they have to be on the axis.
    const inside = (items: readonly FoldedItem[]): readonly string[] =>
      items.flatMap((item) =>
        item.kind === "fold" ? inside(item.inside) : item.kind === "event" ? [item.event.kind] : [],
      );
    expect(inside(foldsIn(out)), String(mark)).not.toContain("decided");
  }
});

test("a fold never crosses a message: what was said is never inside one", () => {
  const out = drawn(SEVEN, "lap-7:started");
  const inside = (items: readonly FoldedItem[]): readonly FoldedItem[] =>
    items.flatMap((item) => (item.kind === "fold" ? inside(item.inside) : [item]));
  expect(inside(foldsIn(out)).some((item) => item.kind === "message")).toBe(false);
  expect(out.filter((item) => item.kind === "message")).toHaveLength(2);
});

test("one line is never folded into one line", () => {
  const single: readonly ThreadItem[] = [
    message("request"),
    event("lap-1:started", "other", 1),
    message("report"),
    ...oneTry(2, "passed"),
  ];
  expect(foldsIn(drawn(single, null))).toHaveLength(0);
});

test("a fold is named by the first thing inside it, so a redraw keeps the reader's place", () => {
  expect(foldsIn(drawn(SEVEN, null))[0]?.id).toBe("fold:lap-1:started");
  expect(foldsIn(drawn(SEVEN, "lap-7:started"))[0]?.id).toBe("fold:fold:lap-1:started");
});
