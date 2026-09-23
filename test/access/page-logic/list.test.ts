/**
 * The left face's rows (DECISIONS.md D-0083 rules 2, 5 and 7).
 *
 * What these cases hold down is the shape of the replacement for `D-0082`
 * rule 1: a request is the unit, a day is the group, and the single exception
 * -- lifting what waits on the person out of the time order -- is the only
 * thing that breaks the axis.
 */
import { expect, test } from "vitest";
import type { RequestRow } from "../../../src/access/page-logic/list.js";
import {
  placeSaid,
  repositoryOf,
  requestList,
  rowStateOf,
} from "../../../src/access/page-logic/list.js";
import type { IterationRecord } from "../../../src/store/records.js";

const at = (y: number, m: number, d: number, h = 12): number => new Date(y, m - 1, d, h).getTime();
const NOW = at(2026, 9, 20, 10);

const row = (over: Partial<RequestRow> & { messageId: string; atMs: number }): RequestRow => ({
  title: over.messageId,
  repository: null,
  state: "finished",
  ...over,
});

/** A lap row with only the fields these cases read. */
const lap = (over: Partial<IterationRecord>): IterationRecord =>
  ({ status: "closed", plan: {}, ...over }) as IterationRecord;

const terminalOf = (record: IterationRecord) =>
  record.status === "closed" || record.status === "abandoned";

test("what waits on the person is lifted out of the time order, oldest first", () => {
  const list = requestList(
    [
      row({ messageId: "new-and-waiting", atMs: at(2026, 9, 20), state: "waitingOnYou" }),
      row({ messageId: "old-and-waiting", atMs: at(2026, 8, 1), state: "waitingOnYou" }),
      row({ messageId: "today-done", atMs: at(2026, 9, 20, 9) }),
    ],
    null,
    NOW,
  );
  // Oldest first: *your turn 1 / 3, next* walks them in order, and a request
  // waiting since last month must not sit under one waiting since an hour ago.
  expect(list.yourTurn.map((each) => each.messageId)).toEqual([
    "old-and-waiting",
    "new-and-waiting",
  ]);
  // And it is out of the day groups entirely, not repeated in them.
  expect(list.days.flatMap((group) => group.rows.map((each) => each.messageId))).toEqual([
    "today-done",
  ]);
});

test("everything else is cut by day and not by what it is doing", () => {
  const list = requestList(
    [
      row({ messageId: "running-today", atMs: at(2026, 9, 20, 8), state: "running" }),
      row({ messageId: "done-today", atMs: at(2026, 9, 20, 9) }),
      row({ messageId: "done-yesterday", atMs: at(2026, 9, 19) }),
    ],
    null,
    NOW,
  );
  // A running request and a finished one share a heading, because the heading
  // is a day. Under D-0082 rule 1 they were in different groups.
  expect(list.days[0]?.cut).toBe("today");
  expect(list.days[0]?.rows.map((each) => each.messageId)).toEqual(["done-today", "running-today"]);
  expect(list.days[1]?.cut).toBe("yesterday");
});

test("the last-looked line sits above the newest row already seen", () => {
  const list = requestList(
    [
      row({ messageId: "arrived-since", atMs: at(2026, 9, 20, 9) }),
      row({ messageId: "seen-before", atMs: at(2026, 9, 19) }),
      row({ messageId: "older-still", atMs: at(2026, 9, 18) }),
    ],
    at(2026, 9, 19, 18),
    NOW,
  );
  expect(list.lastLookedAbove).toBe("seen-before");
});

test("no line is drawn where it would divide nothing", () => {
  const rows = [
    row({ messageId: "a", atMs: at(2026, 9, 20, 9) }),
    row({ messageId: "b", atMs: at(2026, 9, 19) }),
  ];
  // Never looked: there is no "since" to draw.
  expect(requestList(rows, null, NOW).lastLookedAbove).toBeNull();
  // Everything already seen: the line would sit at the very top and say
  // nothing about what is under it.
  expect(requestList(rows, at(2026, 9, 21), NOW).lastLookedAbove).toBeNull();
});

test("a row's state is read off the lap under it, and no lap means not started", () => {
  expect(rowStateOf(null, false, terminalOf)).toBe("notStarted");
  expect(rowStateOf(lap({ status: "performing" }), false, terminalOf)).toBe("running");
  expect(rowStateOf(lap({ status: "closed" }), false, terminalOf)).toBe("finished");
  expect(rowStateOf(lap({ status: "abandoned" }), false, terminalOf)).toBe("stopped");
  // Waiting on the person outranks whatever the lap is doing: it is the one
  // thing only they can clear.
  expect(rowStateOf(lap({ status: "performing" }), true, terminalOf)).toBe("waitingOnYou");
  expect(rowStateOf(null, true, terminalOf)).toBe("waitingOnYou");
});

test("the repository is the one the lap's plan names, or nothing", () => {
  expect(repositoryOf(lap({ plan: { repository: "shop-app" } }))).toBe("shop-app");
  expect(repositoryOf(lap({ plan: {} }))).toBeNull();
  expect(repositoryOf(lap({ plan: { repository: "" } }))).toBeNull();
  // Not a string is not a repository: the row says nothing rather than
  // printing whatever was in the plan.
  expect(repositoryOf(lap({ plan: { repository: 7 } }))).toBeNull();
  expect(repositoryOf(null)).toBeNull();
});

/*
 * **Naming the place only where it tells two things apart** (rondo#305,
 * `D-0081` rule 4.2, `D-0076` rules 3.3 and 5.1).
 */

const SHOP = "/home/ada/work/shop-app";
const BILLING = "/home/ada/work/billing";

test("a set all in one repository is not told which one it is", () => {
  expect(placeSaid(SHOP, [SHOP, SHOP])).toBeNull();
  // A set with one repository named and the rest naming none has still only
  // one place in it, so there is nothing the name would separate.
  expect(placeSaid(SHOP, [SHOP, null])).toBeNull();
  // One thing alone, and nothing at all, are both nothing to tell apart.
  expect(placeSaid(SHOP, [SHOP])).toBeNull();
  expect(placeSaid(SHOP, [])).toBeNull();
});

test("a set spanning two repositories says each as the person names it", () => {
  expect(placeSaid(SHOP, [SHOP, BILLING])).toBe("shop-app");
  expect(placeSaid(BILLING, [SHOP, BILLING])).toBe("billing");
  // A trailing separator, and the shape a Windows clone is held in: the name
  // is the last segment either way, and never the path it was read off.
  expect(placeSaid(`${SHOP}/`, [SHOP, BILLING])).toBe("shop-app");
  expect(placeSaid("C:\\Users\\ada\\work\\shop-app", [SHOP, BILLING])).toBe("shop-app");
});

test("a lap that names no repository says no place, however many the set holds", () => {
  expect(placeSaid(null, [SHOP, BILLING])).toBeNull();
});

test("a repository with no segment to read is given back as it came", () => {
  // rondo does not invent a name for a place it cannot read one off, and a
  // path made only of separators is one of those.
  expect(placeSaid("/", ["/", BILLING])).toBe("/");
});
