/**
 * The left face's marks (rondo#589).
 *
 * A row's state was said by colour alone, and four states shared one grey
 * dot. The claim held here is that **every state a row can be in that the
 * colour does not already split is a shape of its own**, and that running
 * turns -- `D-0082` rule 3 keeps the turning mark, and the list had lost it.
 */
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { RequestsFace } from "../../../src/access/page/list.js";
import type { RequestRow, RowState } from "../../../src/access/page-logic/list.js";
import { EN } from "../../../src/access/wording.js";

const row = (state: RowState, over: Partial<RequestRow> = {}): RequestRow => ({
  messageId: state,
  title: state,
  repository: null,
  state,
  atMs: 1,
  ...over,
});

/** Each row's mark, in the order drawn. */
const marks = (rows: readonly RequestRow[]): string[] => {
  const html = renderToStaticMarkup(
    RequestsFace({
      wording: EN,
      list: { yourTurn: [], days: [{ cut: "today", rows }], lastLookedAbove: null },
      hrefOf: (id) => `/?thread=${id}`,
      agoOf: () => "now",
      allowance: null,
      newRequestHref: null,
      lastLookedSaid: "",
      openId: null,
    }),
  );
  return [...html.matchAll(/data-mark="([a-z]+)"/g)].map((m) => m[1] ?? "");
};

test("running, finished, stopped and not started are four shapes, not one grey dot", () => {
  expect(
    marks([
      row("waitingOnYou"),
      row("running"),
      row("finished"),
      row("stopped"),
      row("notStarted"),
    ]),
  ).toEqual(["wait", "run", "done", "stopped", "idle"]);
  // Drafting has not started either, and an approval not yet published is done.
  expect(marks([row("drafting"), row("approved")])).toEqual(["idle", "done"]);
});

test("a published request's checks give the tick or the cross, and only they do", () => {
  const published = (kind: "green" | "red" | "pending") =>
    row("approved", {
      published: { checks: { kind } } as unknown as NonNullable<RequestRow["published"]>,
    });
  expect(marks([published("green"), published("red"), published("pending")])).toEqual([
    "ok",
    "fail",
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

test("a row that needs nobody is one line, its sentence stays for a reader, and hover reads it whole (rondo#592)", () => {
  const css = readFileSync(new URL("../../../page/list.css", import.meta.url), "utf8");
  const rule = (selector: string): string =>
    new RegExp(`${selector.replace(/[.()]/g, "\\$&")} \\{([^}]*)\\}`).exec(css)?.[1] ?? "";
  expect(rule(".list-row:not(.list-row-mine) b")).toMatch(/white-space: nowrap/);
  const sentence = rule(".list-row:not(.list-row-mine) p");
  expect(sentence).toMatch(/clip-path: inset\(50%\)/);
  expect(sentence).not.toMatch(/display: none/);
  // A waiting row is not cut: nothing narrows `.list-row-mine` back to one line.
  expect(rule(".list-row-mine p")).not.toMatch(/nowrap|clip/);
  const html = renderToStaticMarkup(
    RequestsFace({
      wording: EN,
      list: {
        yourTurn: [row("waitingOnYou")],
        days: [{ cut: "today", rows: [row("finished", { repository: "org/repo" })] }],
        lastLookedAbove: null,
      },
      hrefOf: (id) => `/?thread=${id}`,
      agoOf: () => "now",
      allowance: null,
      newRequestHref: null,
      lastLookedSaid: "",
      openId: null,
    }),
  );
  const [mine, cut] = html.match(/<a class="list-row[^>]*>/g) ?? [];
  expect(mine).not.toContain("title=");
  // Two requests with one title are told apart on hover by repository and state.
  expect(cut).toContain(`title="finished\norg/repo\n${EN.rowFinished}"`);
  expect(html).toContain(`<span class="list-repo">org/repo</span>${EN.rowFinished}</p>`);
});
