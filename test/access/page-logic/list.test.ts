/**
 * The left face's rows (DECISIONS.md D-0083 rules 2, 5 and 7).
 *
 * What these cases hold down is the shape of the replacement for `D-0082`
 * rule 1: a request is the unit, a day is the group, and the single exception
 * -- lifting what waits on the person out of the time order -- is the only
 * thing that breaks the axis.
 */
import { expect, test } from "vitest";
import type { RequestRow, ThingDrawn } from "../../../src/access/page-logic/list.js";
import {
  DONE_SHOWN,
  placeSaid,
  repositoryOf,
  requestList,
  rowStateOf,
  rowWord,
} from "../../../src/access/page-logic/list.js";
import type { PartCounts } from "../../../src/access/page-logic/parts.js";
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

test("every state a row can be in says one of three words, and done is where nothing happens next", () => {
  const wordOf = (over: Partial<RequestRow>) => rowWord(row({ messageId: "r", atMs: 1, ...over }));
  // The person's turn outranks everything, as the lift does.
  expect(wordOf({ state: "waitingOnYou" })).toBe("yourTurn");
  // Open work, whether rondo has begun it or is still drafting its plan: the
  // person has asked, and what they asked for has not happened yet.
  expect(wordOf({ state: "running" })).toBe("running");
  expect(wordOf({ state: "drafting" })).toBe("running");
  expect(wordOf({ state: "notStarted" })).toBe("running");
  // Done is everything nothing further happens to: finished, given up on,
  // approved and awaiting its publication, and a thread that asked rondo a
  // question rather than for work.
  expect(wordOf({ state: "finished" })).toBe("done");
  expect(wordOf({ state: "approved" })).toBe("done");
  expect(wordOf({ state: "stopped" })).toBe("done");
  expect(wordOf({ state: "question" })).toBe("done");
});

test("a request run as several lines takes its word from its parts (D-0098 rule 8.1)", () => {
  const counts = (over: Partial<PartCounts>): PartCounts => ({
    total: 3,
    running: 0,
    yours: 0,
    waiting: 0,
    waitingOn: null,
    toStart: 0,
    finished: 0,
    stopped: 0,
    ...over,
  });
  const wordOf = (parts: PartCounts) =>
    rowWord(row({ messageId: "r", atMs: 1, state: "running", parts }));
  // One part at its gate is the person's turn, whatever the rest are doing.
  expect(wordOf(counts({ yours: 1, running: 2 }))).toBe("yourTurn");
  // Any part still to run keeps the request in progress -- including one held
  // until an earlier part is merged, which is a wait rondo clears itself.
  expect(wordOf(counts({ running: 1, finished: 2 }))).toBe("running");
  expect(wordOf(counts({ waiting: 1, finished: 2 }))).toBe("running");
  expect(wordOf(counts({ toStart: 1, finished: 2 }))).toBe("running");
  // Done only once every part has ended, however each one ended.
  expect(wordOf(counts({ finished: 2, stopped: 1 }))).toBe("done");
});

test("the three newest done requests keep their place and the older ones are handed over", () => {
  const list = requestList(
    [
      row({ messageId: "running-older", atMs: at(2026, 9, 1), state: "running" }),
      row({ messageId: "done-1", atMs: at(2026, 9, 20, 9) }),
      row({ messageId: "done-2", atMs: at(2026, 9, 19) }),
      row({ messageId: "done-3", atMs: at(2026, 9, 18) }),
      row({ messageId: "done-4", atMs: at(2026, 9, 17) }),
      row({ messageId: "done-5", atMs: at(2026, 8, 20) }),
    ],
    null,
    NOW,
  );
  expect(DONE_SHOWN).toBe(3);
  // The three newest stay where the day cut put them, each under its own
  // heading: the fold does not gather them into a group of their own.
  expect(list.days.map((group) => [group.cut, group.rows.map((each) => each.messageId)])).toEqual([
    ["today", ["done-1"]],
    ["yesterday", ["done-2"]],
    ["lastWeek", ["done-3"]],
    ["month", ["running-older"]],
  ]);
  // The rest are handed over newest first, and a request still running is
  // never among them however old it is.
  expect(list.moreDone.map((each) => each.messageId)).toEqual(["done-4", "done-5"]);
});

test("no more than three done requests leaves nothing to fold", () => {
  for (const count of [0, 1, 2, 3]) {
    const rows = Array.from({ length: count }, (_, index) =>
      row({ messageId: `done-${String(index)}`, atMs: at(2026, 9, 20 - index) }),
    );
    const list = requestList(rows, null, NOW);
    expect(list.moreDone).toEqual([]);
    expect(list.days.flatMap((group) => group.rows)).toHaveLength(count);
  }
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

test("the line is read off the whole list, the done requests the fold took included", () => {
  // Five done requests, so two are behind the press, and the person last
  // looked while the oldest two were already there. The line's position is
  // among those two -- reading it off the shown rows alone would find no row
  // already seen and draw no line, which would say they had never looked.
  const rows = [
    row({ messageId: "done-1", atMs: at(2026, 9, 20, 9) }),
    row({ messageId: "done-2", atMs: at(2026, 9, 19) }),
    row({ messageId: "done-3", atMs: at(2026, 9, 18) }),
    row({ messageId: "done-4", atMs: at(2026, 9, 17) }),
    row({ messageId: "done-5", atMs: at(2026, 8, 20) }),
  ];
  const list = requestList(rows, at(2026, 9, 17, 18), NOW);
  expect(list.moreDone.map((each) => each.messageId)).toEqual(["done-4", "done-5"]);
  expect(list.lastLookedAbove).toBe("done-4");
  // And where only the oldest of all was seen, the line is still the fold's,
  // on the row it belongs above rather than on the press.
  expect(requestList(rows, at(2026, 8, 21), NOW).lastLookedAbove).toBe("done-5");
  // A row the fold did not take is still where the line goes when the
  // position is its: the fold moves no line it does not hold.
  expect(requestList(rows, at(2026, 9, 18, 18), NOW).lastLookedAbove).toBe("done-3");
});

test("the line's position is the time order's, not the order the fold draws in", () => {
  // Five done requests and one still running that is older than every one of
  // them, so the fold draws two done requests *under* the running row. The
  // person last looked when the oldest done request had just arrived.
  const rows = [
    row({ messageId: "done-1", atMs: at(2026, 9, 20, 9) }),
    row({ messageId: "done-2", atMs: at(2026, 9, 19) }),
    row({ messageId: "done-3", atMs: at(2026, 9, 18) }),
    row({ messageId: "done-4", atMs: at(2026, 9, 17) }),
    row({ messageId: "done-5", atMs: at(2026, 9, 16) }),
    row({ messageId: "running-oldest", atMs: at(2026, 9, 10), state: "running" }),
  ];
  const list = requestList(rows, at(2026, 9, 16, 18), NOW);
  expect(list.moreDone.map((each) => each.messageId)).toEqual(["done-4", "done-5"]);
  // In time order the oldest row already seen is `done-5`, and that is where
  // the line goes. Walking the drawn rows instead -- the day groups, then the
  // rows behind the press -- would reach `running-oldest` first and leave
  // `done-4`, which the person has never seen, below the line.
  expect(list.lastLookedAbove).toBe("done-5");
  // And the running row is still where the line goes when the position is its
  // own: the mix is read by time, not by which section a row is drawn in.
  expect(requestList(rows, at(2026, 9, 10, 18), NOW).lastLookedAbove).toBe("running-oldest");
  // A reading between the two folded rows puts the line on the newer of them,
  // with the running row -- older than both -- still under it.
  expect(requestList(rows, at(2026, 9, 17, 18), NOW).lastLookedAbove).toBe("done-4");
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
 * **Naming the place only where two of the things drawn would otherwise read
 * the same** (rondo#305, `D-0081` rule 4.2, `D-0076` rules 3.3 and 5.1).
 *
 * `otherwise` is everything else the page says about a thing -- a request's
 * title, a plan's line with its place left out -- and `among` is that key for
 * every thing drawn beside it, its own included. So the question the rule asks
 * is whether the key is there twice, and never how many repositories the store
 * happens to serve or how many laps have run.
 */

const SHOP = "/home/ada/work/shop-app";
const BILLING = "/home/ada/work/billing";

/** One thing on the page, as far as telling it from another goes. */
const thing = (otherwise: string, repository: string | null): ThingDrawn => ({
  otherwise,
  repository,
});

/** The keys of the things drawn, which is what a thing is judged against. */
const keys = (...drawn: readonly ThingDrawn[]): string[] => drawn.map((one) => one.otherwise);

test("things the page already tells apart are not told which repository they are in", () => {
  const invoice = thing("the invoice needs the tax broken out", SHOP);
  const receipt = thing("the receipt prints the wrong date", BILLING);
  // Two repositories, and the person reads two different sentences: the place
  // separates nothing they could not already separate (rule 5.1).
  expect(placeSaid(invoice, keys(invoice, receipt))).toBeNull();
  expect(placeSaid(receipt, keys(invoice, receipt))).toBeNull();
  // One thing alone, and nothing at all, are both nothing to tell apart.
  expect(placeSaid(invoice, keys(invoice))).toBeNull();
  expect(placeSaid(invoice, [])).toBeNull();
});

test("two things that read the same are each told which repository it is in", () => {
  const here = thing("the build is broken", SHOP);
  const there = thing("the build is broken", BILLING);
  // Nothing else on the page separates them, so the place is what is left --
  // said as the person names it, which is the last segment and not the path.
  expect(placeSaid(here, keys(here, there))).toBe("shop-app");
  expect(placeSaid(there, keys(here, there))).toBe("billing");
  // A trailing separator, and the shape a Windows clone is held in: the name
  // is the last segment either way, and never the path it was read off.
  expect(placeSaid(thing("the build is broken", `${SHOP}/`), keys(here, there))).toBe("shop-app");
  expect(
    placeSaid(thing("the build is broken", "C:\\Users\\ada\\work\\shop-app"), keys(here, there)),
  ).toBe("shop-app");
});

test("a thing alike to one that names no repository is told its own", () => {
  // A request nothing has run for is still drawn, and its title is one the
  // other's can read the same as -- so the one that has a place says it.
  const ran = thing("the build is broken", SHOP);
  const not = thing("the build is broken", null);
  expect(placeSaid(ran, keys(ran, not))).toBe("shop-app");
  // The one with no place of its own still says none: rondo has nothing to say.
  expect(placeSaid(not, keys(ran, not))).toBeNull();
});

test("a repository with no name to read off is not said at all", () => {
  // rondo does not invent a name for a place it cannot read one off, and a
  // value made only of separators is one of those. The path itself is what
  // rule 4.2 forbids, so what is left to say is nothing.
  const nameless = thing("the build is broken", "/");
  const named = thing("the build is broken", BILLING);
  expect(placeSaid(nameless, keys(nameless, named))).toBeNull();
  expect(placeSaid(named, keys(nameless, named))).toBe("billing");
});
