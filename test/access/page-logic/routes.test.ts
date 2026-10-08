/**
 * The address of a thread asked about (rondo#401, D-0177): the "?" is in the
 * address, so the language switch and the poll, which re-request it, keep the
 * box in question mode.
 */
import { expect, test } from "vitest";

import { type PageView, viewHref, viewOf } from "../../../src/access/page-logic/routes.js";

const read = (href: string): PageView => viewOf(new URL(href, "http://x").searchParams);

test("a thread's ask round-trips through its address, in either language", () => {
  const view: PageView = {
    kind: "thread",
    messageId: "req-1",
    to: "note 1",
    gate: "i-1",
    ask: "gate:g-1#2",
  };
  for (const lang of ["en", "ja"]) {
    const href = viewHref(view, lang);
    expect(href).toContain(`ask=gate%3Ag-1%232&lang=${lang}`);
    expect(read(href)).toEqual(view);
  }
});

test("a thread with no ask, or an empty one, has none", () => {
  expect(viewHref({ kind: "thread", messageId: "r", to: null }, "en")).toBe("/?thread=r&lang=en");
  expect(read("/?thread=r&ask=&lang=en")).toEqual({ kind: "thread", messageId: "r", to: null });
});
