/**
 * How event lines fold (DECISIONS.md D-0083 rule 7 and its unresolved list,
 * rondo#332).
 *
 * **What these cases hold down is the two things a fold must not do**, both of
 * them rule 7's own: a decision rondo made without asking stays on the time
 * axis at the moment it was made, and a fold never swallows what was said.
 * Everything else here is arithmetic about how many lines are left.
 *
 * Both modes are covered while both exist. The one the gate does not choose
 * leaves with its cases.
 */
import { expect, test } from "vitest";
import type { EventKind, ThreadEvent } from "../../../src/access/page/events.js";
import type { ThreadItem, ThreadMessage } from "../../../src/access/page/thread.js";
import { PAGE_EN } from "../../../src/access/page/words.js";
import type { FoldLine, FoldMode } from "../../../src/access/page-logic/event-fold.js";
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
  message: { id } as unknown as ThreadMessage,
});

/** One try's three lines: started, what the checks said, and how it ended. */
const oneTry = (at: number, checks: EventKind): readonly ThreadItem[] => [
  event(`lap-${String(at)}:started`, "other", at, `Try ${String(at)}: Work started.`),
  event(`lap-${String(at)}:reading`, checks, at, `Try ${String(at)}: checks.`),
  event(`lap-${String(at)}:ended`, "passed", at, `Try ${String(at)}: Finished.`),
];

const drawn = (items: readonly ThreadItem[], mode: FoldMode, lastLookedAbove: string | null) =>
  folds(PAGE_EN, items, mode, lastLookedAbove);

const foldsIn = (items: ReturnType<typeof drawn>): readonly FoldLine[] =>
  items.flatMap((item) => (item.kind === "fold" ? [item] : []));

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

test("seven tries draw twenty-one event lines with no fold, which is the thread that was unreadable", () => {
  const out = drawn(SEVEN, "none", "lap-7:started");
  expect(out).toHaveLength(SEVEN.length);
  expect(out.filter((item) => item.kind === "event")).toHaveLength(21);
});

test("folding by try leaves one line for each settled try and the newest try whole", () => {
  const out = drawn(SEVEN, "tries", "lap-7:started");
  // Six folds, the newest try's three lines, and the two messages.
  expect(foldsIn(out)).toHaveLength(6);
  expect(out.filter((item) => item.kind === "event")).toHaveLength(3);
  expect(out).toHaveLength(11);
});

test("a folded try is said by what went wrong in it, and says how many lines it holds", () => {
  const [first] = foldsIn(drawn(SEVEN, "tries", null));
  expect(first?.said).toBe("Try 1: checks. (3 lines)");
  expect(first?.inside).toHaveLength(3);
});

test("a try that failed nothing is said by how it ended", () => {
  const folded = foldsIn(drawn(SEVEN, "tries", null));
  expect(folded[2]?.said).toBe("Try 3: Finished. (3 lines)");
});

test("a request tried once folds nothing: its lines carry no try to group by", () => {
  const once: readonly ThreadItem[] = [
    message("request"),
    event("lap:started", "other", null),
    event("lap:reading", "passed", null),
    event("lap:ended", "passed", null),
  ];
  expect(drawn(once, "tries", null)).toEqual(once);
});

test("folding by what was read leaves one line above the last-looked line", () => {
  const out = drawn(SEVEN, "seen", "lap-7:started");
  expect(foldsIn(out)).toHaveLength(1);
  expect(foldsIn(out)[0]?.said).toBe("18 lines you had already read");
  expect(foldsIn(out)[0]?.inside).toHaveLength(18);
  expect(out.filter((item) => item.kind === "event")).toHaveLength(3);
});

test("with no last-looked line there is nothing already-read, and the thread is drawn whole", () => {
  expect(drawn(SEVEN, "seen", null)).toEqual(SEVEN);
  // Nor when the line would sit above everything: a fold of nothing is nothing.
  expect(drawn(SEVEN, "seen", "request")).toEqual(SEVEN);
});

test("neither fold ever swallows a decision rondo made without asking (rule 7)", () => {
  const withDecision: readonly ThreadItem[] = [
    message("request"),
    ...oneTry(1, "failed"),
    event("lap-1:decided", "decided", 1, "Try 1: rondo decided this without asking."),
    ...oneTry(2, "passed"),
  ];
  for (const mode of ["tries", "seen"] as const) {
    const out = drawn(withDecision, mode, "lap-2:started");
    const kept = out.flatMap((item) =>
      item.kind === "event" && item.event.kind === "decided" ? [item.event.id] : [],
    );
    expect(kept, mode).toEqual(["lap-1:decided"]);
    // And it is not hidden inside one either: the count on the right face
    // names the same things as the axis, so it has to be on the axis.
    for (const fold of foldsIn(out)) {
      expect(
        fold.inside.map((one) => one.kind),
        mode,
      ).not.toContain("decided");
    }
  }
});

test("a fold never crosses a message: what was said is never inside one", () => {
  const out = drawn(SEVEN, "seen", "lap-7:started");
  for (const fold of foldsIn(out)) {
    expect(fold.inside.every((one) => one.id.startsWith("lap-"))).toBe(true);
  }
  expect(out.filter((item) => item.kind === "message")).toHaveLength(2);
});

test("one line is never folded into one line", () => {
  const single: readonly ThreadItem[] = [
    message("request"),
    event("lap-1:started", "other", 1),
    message("report"),
    ...oneTry(2, "passed"),
  ];
  const out = drawn(single, "tries", null);
  expect(foldsIn(out)).toHaveLength(0);
});

test("a fold is named by the first line inside it, so a redraw keeps the reader's place", () => {
  expect(foldsIn(drawn(SEVEN, "tries", null))[0]?.id).toBe("fold:lap-1:started");
  expect(foldsIn(drawn(SEVEN, "seen", "lap-7:started"))[0]?.id).toBe("fold:lap-1:started");
});
