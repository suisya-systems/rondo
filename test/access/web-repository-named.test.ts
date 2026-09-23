/**
 * **The page names a repository only where two things would otherwise be
 * indistinguishable** (rondo#305, `D-0081` rule 4.2 and its gate's answer 4,
 * `D-0076` rules 3.3 and 5.1).
 *
 * One store serves several repositories and their work is one list, so the two
 * cases are: a page whose work is all in one place, where naming it separates
 * nothing and it is unsaid; and a page whose work spans two, where the place is
 * what tells them apart and is said -- in the person's own name for it, never
 * the path rondo holds it by and never an `OWNER/NAME`.
 */
import { expect, test } from "vitest";

import { chromeFor } from "../../src/access/wording.js";
import { fresh, operatorPage, portsOver, reserve } from "./page-world.js";

/** The two places a person in these cases works in, as rondo holds them. */
const ONE = "/home/ada/work/shop-app";
const OTHER = "/home/ada/work/billing";

test("work all in one repository does not name it", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "the invoice needs the tax broken out", null, undefined, ONE);
  await reserve(world, "i-0002", "the receipt prints the wrong date", null, undefined, ONE);

  const html = await operatorPage(portsOver(world));

  // Both requests are drawn, and neither carries a place: with one repository
  // behind them the name would say nothing a person could use (rule 5.1).
  expect(html).toContain("the invoice needs the tax broken out");
  expect(html).toContain("the receipt prints the wrong date");
  expect(html).not.toContain("list-repo");
  expect(html).not.toContain("shop-app");
  expect(html).not.toContain(ONE);
});

test("work spanning two repositories names each in the person's own words", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "the invoice needs the tax broken out", null, undefined, ONE);
  await reserve(world, "i-0002", "the receipt prints the wrong date", null, undefined, OTHER);

  const html = await operatorPage(portsOver(world));

  // The place is what tells the two apart, so it is drawn -- as the name the
  // person calls it by, which is the last segment of the path and not the
  // path (D-0081 rule 4.2, D-0076 rule 3.3).
  expect(html).toContain("list-repo");
  expect(html).toContain("shop-app");
  expect(html).toContain("billing");
  expect(html).not.toContain(ONE);
  expect(html).not.toContain(OTHER);
});

test("a Japanese page draws the same names and says them no differently", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "the invoice needs the tax broken out", null, undefined, ONE);
  await reserve(world, "i-0002", "the receipt prints the wrong date", null, undefined, OTHER);

  // A place's name is the person's own word for it, so it crosses the set
  // unchanged: what the language decides is the prose around it, and the chip
  // that carries a place has none.
  const html = await operatorPage(portsOver(world), null, { kind: "summary" }, chromeFor("ja"));

  expect(html).toContain("shop-app");
  expect(html).toContain("billing");
  expect(html).not.toContain(ONE);
});
