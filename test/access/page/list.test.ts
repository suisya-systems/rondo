/**
 * The left face's rows (rondo#589, rondo#745).
 *
 * What these cases hold down is **what a row is allowed to say**: a short
 * name, its state in one of three words, and how long since it moved. A row's
 * state was said by colour alone (rondo#589), then by a sentence per state
 * which grew with every kind of wait rondo learned to have; the claim now is
 * that the face says the three words and keeps the sentence for the hover, and
 * that the requests already over do not fill it -- the newest three keep their
 * place and the rest are counted on one press.
 */
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { RequestsFace } from "../../../src/access/page/list.js";
import type { RequestList, RequestRow, RowState } from "../../../src/access/page-logic/list.js";
import type { ChecksState } from "../../../src/access/page-logic/result.js";
import { chromeFor, EN } from "../../../src/access/wording.js";

const JA = chromeFor("ja");

/** The checks, having said green: the one reading these cases name. */
const GREEN = { kind: "green" } as ChecksState;

const row = (state: RowState, over: Partial<RequestRow> = {}): RequestRow => ({
  messageId: state,
  title: state,
  repository: null,
  state,
  atMs: 1,
  ...over,
});

/** The face, over a list given in part: what is not named is empty. */
const face = (list: Partial<RequestList>, wording = EN): string =>
  renderToStaticMarkup(
    RequestsFace({
      wording,
      list: { yourTurn: [], days: [], folded: [], lastLookedAbove: null, ...list },
      hrefOf: (id) => `/?thread=${id}`,
      agoOf: () => "now",
      allowance: null,
      newRequestHref: null,
      lastLookedSaid: "",
      openId: null,
    }),
  );

/** Each row's mark, in the order drawn. */
const marks = (rows: readonly RequestRow[]): string[] => {
  const html = face({ days: [{ cut: "today", rows }] });
  return [...html.matchAll(/data-mark="([a-z]+)"/g)].map((m) => m[1] ?? "");
};

/** What each row draws inside itself, with its tags taken out. */
const bodies = (html: string): string[] =>
  [...html.matchAll(/<a class="list-row[^"]*"[^>]*>([\s\S]*?)<\/a>/g)].map((m) =>
    (m[1] ?? "").replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<[^>]+>/g, "|"),
  );

test("the person's turn, work going on and work over are three shapes, and nothing else is a shape", () => {
  expect(
    marks([
      row("waitingOnYou"),
      row("running"),
      row("finished"),
      row("stopped"),
      row("notStarted"),
    ]),
  ).toEqual(["wait", "run", "done", "done", "run"]);
  // Drafting is work going on, and an approval is work over.
  expect(marks([row("drafting"), row("approved")])).toEqual(["run", "done"]);
});

test("a published request's checks are no longer a mark of their own (rondo#745)", () => {
  const published = (kind: "green" | "red" | "pending") =>
    row("approved", {
      published: { checks: { kind } } as unknown as NonNullable<RequestRow["published"]>,
    });
  // The mark says what the word beside it says and no more: the checks are the
  // thread's to report, and a green tick on this face was a second vocabulary.
  expect(marks([published("green"), published("red"), published("pending")])).toEqual([
    "done",
    "done",
    "done",
  ]);
});

test("the running mark turns, and holds still where motion is reduced", () => {
  const css = readFileSync(new URL("../../../page/list.css", import.meta.url), "utf8");
  expect(css).toMatch(/\.list-dot-run \{[^}]*animation: list-dot-turn/);
  expect(css).toMatch(
    /@media \(prefers-reduced-motion: reduce\) \{\s*\.list-dot-run \{\s*animation: none;/,
  );
});

test("a row draws a short name, one word of state and an age, and nothing else (rondo#745)", () => {
  const css = readFileSync(new URL("../../../page/list.css", import.meta.url), "utf8");
  const rule = (selector: string): string =>
    new RegExp(`${selector.replace(/[.()]/g, "\\$&")} \\{([^}]*)\\}`).exec(css)?.[1] ?? "";
  // Every row is one line now, the waiting one included: the name is cut where
  // the column ends rather than wrapped, and the state is drawn beside it
  // rather than hidden from the eye the way the sentence had to be.
  expect(rule(".list-row b")).toMatch(/white-space: nowrap/);
  expect(rule(".list-row b")).toMatch(/text-overflow: ellipsis/);
  expect(rule(".list-row p")).not.toMatch(/clip-path/);

  const html = face({
    yourTurn: [row("waitingOnYou", { title: "Fix the invoice total" })],
    days: [
      {
        cut: "today",
        rows: [
          row("approved", {
            title: "Fix the invoice total",
            repository: "shop-app",
            published: {
              checks: GREEN,
              merged: null,
              closedAtMs: null,
              conflictsWith: null,
              number: "617",
            } as unknown as NonNullable<RequestRow["published"]>,
          }),
        ],
      },
    ],
  });
  // Three things drawn on each: the name, the state in one word, the age --
  // and, on the one row two could be mistaken for, its place (D-0081 rule 4.2).
  expect(bodies(html)).toEqual([
    "||Fix the invoice total||Your turn|||now|",
    "||Fix the invoice total|||shop-app|Done|||now|",
  ]);
  // What the publish came to is not drawn at all: it is the thread's to say.
  expect(bodies(html).join("")).not.toContain("617");
  // The sentence of state is what the row cut, so it is on the hover, whole,
  // and with it the name uncut and the place.
  expect([...html.matchAll(/ title="([\s\S]*?)"/g)].map((m) => m[1] ?? "")).toEqual([
    `Fix the invoice total\n${EN.rowWaitingOnYou}`,
    `Fix the invoice total\nshop-app\n${EN.rowPublished(
      EN.pullRequest("617"),
      EN.checksWord(GREEN),
    )}`,
  ]);
});

test("the finished requests past the newest three are counted on one press (rondo#745)", () => {
  const done = (id: string) => row("finished", { messageId: id, title: id });
  const html = face({
    days: [{ cut: "today", rows: [done("one"), done("two"), done("three")] }],
    folded: [done("four"), done("five")],
  });
  // One press, counting what is hidden behind it and not what there is.
  expect(html).toContain(`<details class="list-fold">`);
  expect(html).toContain(EN.listMoreDone(2));
  expect(html).toContain(EN.foldOpen);
  // The rows are in the page, shut: the press is the browser's own act, so a
  // redraw cannot lose them and nothing of the list's state holds them.
  const fold = /<details class="list-fold">([\s\S]*?)<\/details>/.exec(html)?.[1] ?? "";
  expect(fold).toContain("/?thread=four");
  expect(fold).toContain("/?thread=five");
  expect(fold).not.toContain("/?thread=one");
  // Said in the language in force, as every word on the face is (D-0079).
  expect(face({ folded: [done("four"), done("five")] }, JA)).toContain(JA.listMoreDone(2));
});

test("three or fewer finished requests leave no press at all (rondo#745)", () => {
  const html = face({
    days: [
      {
        cut: "today",
        rows: [row("finished"), row("approved"), row("stopped"), row("running")],
      },
    ],
  });
  expect(html).not.toContain("list-fold");
  expect(html).not.toContain(EN.listMoreDone(0));
  expect(html).not.toContain(EN.listMoreDone(1));
  // And the list is not read as empty because nothing is folded.
  expect(html).not.toContain(EN.noRequestsYet);
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

test("a row where only the goal flow's stop waits says so on its hover (rondo#611)", () => {
  const html = face({
    yourTurn: [row("waitingOnYou", { title: "Fix issue 194", flowStop: true })],
  });
  expect(html).toContain('data-mark="wait"');
  // The row draws the one word, and which kind of wait it is stays readable.
  expect(html).toContain(`<p>${EN.rowStateYourTurn}</p>`);
  expect(html).toContain(`title="Fix issue 194\n${EN.rowFlowStopped}"`);
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
