/**
 * **The left list marks the request the centre has open, and its rows are
 * `j`/`k` stops** (rondo#587): every row carries `data-row`, which is what
 * `page/keys.js` moves through, and the one whose thread is open carries
 * `aria-current="page"` -- the others do not, and with nothing open none does.
 * A screen of its own (scope, publish, merge, release) shows no thread, so it
 * marks no row even where the summary would fall back to a waiting one.
 */
import { expect, test } from "vitest";

import { EN } from "../../src/access/wording.js";
import { fresh, openGate, openRequest, operatorPage, portsOver, reserve } from "./page-world.js";

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

test("a screen of its own marks no row, though the summary opens the waiting request", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "the invoice needs the tax broken out");
  await openGate(world, "i-0001");

  const summary = rows(await operatorPage(portsOver(world), null, { kind: "summary" }, EN));
  expect(summary.filter((row) => row.includes('aria-current="page"'))).toHaveLength(1);

  const release = rows(
    await operatorPage(portsOver(world), null, { kind: "release", iterationId: "i-0001" }, EN),
  );
  expect(release.some((row) => row.includes("aria-current"))).toBe(false);
});
