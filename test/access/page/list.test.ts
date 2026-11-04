/**
 * What the left face draws for a request (rondo#589, rondo#746).
 *
 * Two claims are held here. **A row says three things and no more**: the
 * person's short name for the request, one of three words of state, and how
 * long ago it moved -- so the mark beside it is one of three shapes, and the
 * sentences a row used to carry are on its hover rather than in the list.
 * **The done requests fold**: the three newest keep their place and the rest
 * are behind one press that names how many it holds, with no press at all
 * where there are no more than three. And what the fold must not change: the
 * last-looked line is still drawn once, wherever in the order it falls, which
 * is inside the fold where the fold took that position.
 */
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { RequestsFace } from "../../../src/access/page/list.js";
import type { RequestList, RequestRow, RowState } from "../../../src/access/page-logic/list.js";
import { requestList } from "../../../src/access/page-logic/list.js";
import { JA } from "../../../src/access/wording/ja.js";
import type { Chrome } from "../../../src/access/wording.js";
import { EN } from "../../../src/access/wording.js";

const row = (state: RowState, over: Partial<RequestRow> = {}): RequestRow => ({
  messageId: state,
  title: state,
  repository: null,
  state,
  atMs: 1,
  ...over,
});

/** The face, drawn over a list the test states in full. */
const face = (
  list: Partial<RequestList>,
  wording: Chrome = EN,
  openId: string | null = null,
  lastLookedSaid = "",
): string =>
  renderToStaticMarkup(
    RequestsFace({
      wording,
      list: { yourTurn: [], days: [], moreDone: [], lastLookedAbove: null, ...list },
      hrefOf: (id) => `/?thread=${id}`,
      agoOf: () => "now",
      newRequestHref: null,
      lastLookedSaid,
      openId,
    }),
  );

/** The face over one day's rows. */
const today = (rows: readonly RequestRow[], wording: Chrome = EN): string =>
  face({ days: [{ cut: "today", rows }] }, wording);

/** Each row's mark, in the order drawn. */
const marks = (rows: readonly RequestRow[]): string[] =>
  [...today(rows).matchAll(/data-mark="([a-z]+)"/g)].map((m) => m[1] ?? "");

/** The stylesheet, read for the claims that live in it. */
const css = (): string => readFileSync(new URL("../../../page/list.css", import.meta.url), "utf8");

test("the week's allowance is not a line under the list, and nothing stands in its place", () => {
  // D-0207 rules 1 and 4: a figure a person reads and decides nothing about
  // was under the list on every view. The week's reading is drawn where a
  // budget bears on what the person can do, which this face reads nothing
  // about -- and no sentence, blank cell or zero replaces the line.
  const html = today([row("running")]);
  expect(html).not.toContain("list-allowance");
  expect(html).not.toContain(EN.weekAllowance);
  expect(html).not.toContain(EN.weekNoAllowance);
  expect(html).not.toContain("$");
  // And the class it was drawn with is gone from the stylesheet too, so the
  // cheap way back is not an unstyled line nobody notices.
  expect(css()).not.toContain(".list-allowance");
});

test("a row says one of three words, and its mark is that word's shape (rondo#746)", () => {
  const states: readonly RowState[] = [
    "waitingOnYou",
    "running",
    "drafting",
    "notStarted",
    "approved",
    "finished",
    "stopped",
    "question",
  ];
  // Every state a row can be in says one of the three words -- nothing says a
  // fourth, and nothing says none.
  for (const state of states) {
    const words = [...today([row(state)]).matchAll(/<p>([^<]*)<\/p>/g)].map((m) => m[1]);
    expect(words).toHaveLength(1);
    expect([EN.yourTurn, EN.listRunning, EN.listDone]).toContain(words[0]);
  }
  // Three shapes against the three words, and the mark is the word drawn: the
  // checks' tick and cross and the slashed ring of a request given up on are
  // differences the row no longer makes (rondo#589 keeps shape over colour).
  expect(marks(states.map((state) => row(state)))).toEqual([
    "wait",
    "run",
    "run",
    "run",
    "done",
    "done",
    "done",
    "done",
  ]);
});

test("a published request's checks are no longer a mark of their own", () => {
  const published = (kind: "green" | "red" | "pending") =>
    row("approved", {
      published: { checks: { kind } } as unknown as NonNullable<RequestRow["published"]>,
    });
  // Green and red were a tick and a cross on the row; the row says *done* and
  // what the checks came to is on the request's thread.
  expect(marks([published("green"), published("red"), published("pending")])).toEqual([
    "done",
    "done",
    "done",
  ]);
  expect(today([published("green")])).toContain(`<p>${EN.listDone}</p>`);
});

test("a row draws its name, its word and its age, and nothing else (rondo#746)", () => {
  const html = today([row("running", { title: "the invoice needs the tax broken out", atMs: 1 })]);
  const drawn = /<a class="list-row[^"]*"[^>]*>([\s\S]*?)<\/a>/.exec(html)?.[1] ?? "";
  // The mark, the name, the word, the age: the text of the row is those three.
  expect(drawn.replace(/<svg[\s\S]*?<\/svg>/, "")).toBe(
    '<div class="list-row-body"><b lang="">the invoice needs the tax broken out</b></div>' +
      `<p>${EN.listRunning}</p><time>now</time>`,
  );
  // The request's own text is never in the list: the name is its first line,
  // which is what the caller hands over, and the row adds no second line of it.
  expect(drawn).not.toContain("<p>the invoice");
});

test("every row keeps on its hover what the cut took, the waiting ones too (rondo#592)", () => {
  // Every name is one line now, so every row carries the hover #592 gave the
  // cut rows: the whole first line, the place, and the sentence of state.
  const rule = (selector: string): string =>
    new RegExp(`${selector.replace(/[.()>]/g, "\\$&")} \\{([^}]*)\\}`).exec(css())?.[1] ?? "";
  expect(rule(".list-row b")).toMatch(/white-space: nowrap/);
  expect(rule(".list-row b")).toMatch(/text-overflow: ellipsis/);
  // The state is read, not hidden from the eye for the mark to say.
  expect(css()).not.toMatch(/\.list-row[^{]*p \{[^}]*clip-path: inset\(50%\)/);
  const html = face({
    yourTurn: [row("waitingOnYou", { title: "the build is broken" })],
    days: [{ cut: "today", rows: [row("finished", { repository: "org/repo" })] }],
  });
  const [mine, done] = html.match(/<a class="list-row[^>]*>/g) ?? [];
  expect(mine).toContain('title="the build is broken');
  expect(mine).toContain(EN.rowWaitingOnYou);
  expect(done).toContain(`title="finished\norg/repo\n${EN.rowFinished}"`);
  // The place is drawn beside the name, where the rule that says it puts it.
  expect(html).toContain('<span class="list-repo">org/repo</span>');
});

test("the done requests older than the newest three fold behind one press that counts them", () => {
  const done = (n: number, atMs: number) =>
    row("finished", { messageId: `d${n}`, title: `d${n}`, atMs });
  // Five done requests, read through the list's own assembly so the three the
  // list keeps and the two it folds are the ones a person would see.
  const list = requestList([done(1, 5), done(2, 4), done(3, 3), done(4, 2), done(5, 1)], null, 5);
  const html = face(list);
  const summary = /<summary>([\s\S]*?)<\/summary>/.exec(html)?.[1];
  expect(summary).toBe(EN.listMoreDone(2));
  // The three newest are drawn in the list itself, and the two older ones are
  // inside the fold -- in the page, shut, not fetched on the press.
  const fold = /<details class="list-fold">([\s\S]*?)<\/details>/.exec(html)?.[1] ?? "";
  expect([...fold.matchAll(/data-row/g)]).toHaveLength(2);
  expect(fold).toContain(">d4<");
  expect(fold).toContain(">d5<");
  expect(html.indexOf(">d3<")).toBeLessThan(html.indexOf("<details"));
  // And the count is said in each language's own way (D-0079).
  expect(/<summary>([\s\S]*?)<\/summary>/.exec(face(list, JA))?.[1]).toBe(JA.listMoreDone(2));
  expect(JA.listMoreDone(2)).toContain("2");
});

test("three done requests or fewer leave no press at all", () => {
  for (const count of [0, 1, 2, 3]) {
    const rows = Array.from({ length: count }, (_, at) =>
      row("finished", { messageId: `d${at}`, title: `d${at}`, atMs: at + 1 }),
    );
    const list = requestList(rows, null, 5);
    expect(list.moreDone).toEqual([]);
    const html = face(list);
    expect(html).not.toContain("<details");
    expect(html).not.toContain("list-fold");
    // Not an empty control and not a zero: nothing is drawn.
    expect(html).not.toContain(EN.listMoreDone(0));
  }
});

test("the fold is open where the request the centre is showing is inside it (rondo#587)", () => {
  const list = requestList(
    [5, 4, 3, 2, 1].map((at) =>
      row("finished", { messageId: `d${at}`, title: `d${at}`, atMs: at }),
    ),
    null,
    5,
  );
  // Shut while the person is reading something else, and open where the mark
  // that says *this is the one you have open* would otherwise be unseeable.
  expect(face(list, EN, "d3")).toContain('<details class="list-fold">');
  const open = face(list, EN, "d1");
  expect(open).toContain('<details class="list-fold" open="">');
  expect(open).toContain('aria-current="page"');
});

test("the last-looked line is drawn above the row it marks, the fold's rows included (rule 7)", () => {
  const done = (n: number, atMs: number) =>
    row("finished", { messageId: `d${n}`, title: `d${n}`, atMs });
  const rows = [done(1, 5), done(2, 4), done(3, 3), done(4, 2), done(5, 1)];
  const said = "you looked down to here";
  // The position is one of the three done requests the list keeps: the line is
  // in the time order above it, and above the press.
  const shown = face(requestList(rows, 3, 5), EN, null, said);
  expect([...shown.matchAll(/list-since/g)]).toHaveLength(1);
  expect(shown.indexOf(said)).toBeLessThan(shown.indexOf("<details"));
  // And where every request already seen is one the fold took, the line is
  // drawn inside the fold, above the row it belongs above, and the fold is
  // open -- a line behind a shut fold is a reading position lost, which is how
  // the fold must not change rule 7.
  const folded = face(requestList(rows, 2, 5), EN, null, said);
  expect([...folded.matchAll(/list-since/g)]).toHaveLength(1);
  const fold = /<details class="list-fold" open="">([\s\S]*?)<\/details>/.exec(folded)?.[1] ?? "";
  expect(fold).toContain(said);
  expect(fold.indexOf(said)).toBeLessThan(fold.indexOf(">d4<"));
});

test("the line is drawn by the time order where a running row is older than the fold's", () => {
  const done = (n: number, atMs: number) =>
    row("finished", { messageId: `d${n}`, title: `d${n}`, atMs });
  // Four done requests and one still running, older than all of them, so the
  // fold's rows are drawn under it while being newer than it. The person last
  // looked when the oldest done request had arrived and the running one had not.
  const rows = [done(1, 5), done(2, 4), done(3, 3), done(4, 2), done(5, 1)];
  const list = requestList(
    [...rows, row("running", { messageId: "r", title: "r", atMs: 0 })],
    1,
    5,
  );
  const said = "you looked down to here";
  const html = face(list, EN, null, said);
  // One line, and it is inside the fold above the row the time order names --
  // not above the running row, which is drawn before the fold and is older
  // than both of the rows the fold took.
  expect([...html.matchAll(/list-since/g)]).toHaveLength(1);
  const fold = /<details class="list-fold" open="">([\s\S]*?)<\/details>/.exec(html)?.[1] ?? "";
  expect(fold).toContain(said);
  expect(fold.indexOf(said)).toBeLessThan(fold.indexOf(">d5<"));
  expect(fold.indexOf(">d4<")).toBeLessThan(fold.indexOf(said));
  expect(html.indexOf(">r<")).toBeLessThan(html.indexOf(said));
});

test("a row that is still running is never folded away, however old it is", () => {
  const list = requestList(
    [
      row("running", { messageId: "r", title: "r", atMs: 1 }),
      ...[5, 4, 3, 2].map((at) =>
        row("finished", { messageId: `d${at}`, title: `d${at}`, atMs: at }),
      ),
    ],
    null,
    5,
  );
  const html = face(list);
  const fold = /<details class="list-fold">([\s\S]*?)<\/details>/.exec(html)?.[1] ?? "";
  expect(fold).not.toContain(">r<");
  expect(html.indexOf(">r<")).toBeLessThan(html.indexOf("<details"));
});

test("a paused goal flow stands with your turn and leads to the screen that resumes it (rondo#606)", () => {
  const html = face({ paused: ["org/repo"] });
  // Drawn under *your turn* even with no request waiting, at its weight.
  expect(html).toContain(`<h6 class="list-heading list-heading-mine">${EN.yourTurn}</h6>`);
  expect(html).toMatch(
    /<a class="list-row list-row-mine" href="\/\?goal_scope=org%2Frepo&amp;[^"]*"/,
  );
  expect(html).toContain('data-mark="paused"');
  expect(html).toContain(EN.triageGoalScopePaused);
});

test("a row where only the goal flow's stop waits says so, under your turn (rondo#611)", () => {
  const html = face({
    yourTurn: [row("waitingOnYou", { title: "Fix issue 194", flowStop: true })],
  });
  expect(html).toContain('data-mark="wait"');
  // The row says the person's turn in its one word, and which wait it is on
  // the hover: three words cannot tell a flow's stop from an answer owed.
  expect(html).toContain(`<p>${EN.yourTurn}</p>`);
  expect(html).toContain(EN.rowFlowStopped);
  expect(html).not.toContain(EN.rowWaitingOnYou);
});

test("a goal flow waiting on answers stands with your turn and leads to its questions (rondo#633)", () => {
  const html = face({
    paused: ["org/paused"],
    asking: [{ repository: "org/repo", request: "Fix the setup", points: 3, askedAtMs: 1 }],
  });
  expect(html).toContain(`<h6 class="list-heading list-heading-mine">${EN.yourTurn}</h6>`);
  expect(html).toMatch(/<a class="list-row list-row-mine" href="\/\?[^"#]*#flow-ask-org-repo"/);
  expect(html).toContain('data-mark="wait"');
  expect(html).toContain(`<b>${EN.rowFlowAsks(3)}</b>`);
  expect(html).toContain("Fix the setup");
  // After the paused rows.
  expect(html.indexOf("data-paused")).toBeLessThan(html.indexOf("data-asking"));
});

test("the running mark turns, and holds still where motion is reduced", () => {
  expect(css()).toMatch(/\.list-dot-run \{[^}]*animation: list-dot-turn/);
  expect(css()).toMatch(
    /@media \(prefers-reduced-motion: reduce\) \{\s*\.list-dot-run \{\s*animation: none;/,
  );
});
