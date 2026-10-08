/**
 * **The left list marks the request the centre has open, and its rows are
 * `j`/`k` stops** (rondo#587): every row carries `data-row`, which is what
 * `page/keys.js` moves through, and the one whose thread is open carries
 * `aria-current="page"` -- the others do not, and with nothing open none does.
 */
import { expect, test } from "vitest";

import { EN } from "../../src/access/wording.js";
import { fresh, openRequest, operatorPage, portsOver } from "./page-world.js";

/** Each list row's opening tag, in the order drawn. */
const rows = (html: string): string[] => html.match(/<a class="list-row[^>]*>/g) ?? [];

test("the open request is the one row marked current, and every row is a j/k stop", async () => {
  const world = fresh();
  await openRequest(world, "r1", "the invoice needs the tax broken out", 500);
  await openRequest(world, "r2", "the receipt prints the wrong date", 600);

  const open = rows(
    await operatorPage(portsOver(world), null, { kind: "thread", messageId: "r1", to: null }, EN),
  );
  expect(open).toHaveLength(2);
  expect(open.every((row) => row.includes('data-row=""'))).toBe(true);
  expect(open.filter((row) => row.includes('aria-current="page"'))).toEqual([
    expect.stringContaining("r1"),
  ]);

  const none = rows(await operatorPage(portsOver(world), null, { kind: "requests" }, EN));
  expect(none).toHaveLength(2);
  expect(none.some((row) => row.includes("aria-current"))).toBe(false);
});
