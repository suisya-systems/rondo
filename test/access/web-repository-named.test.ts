/**
 * **The page names a repository only where two things would otherwise be
 * indistinguishable** (rondo#305, `D-0081` rule 4.2 and its gate's answer 4,
 * `D-0076` rules 3.3 and 5.1).
 *
 * One store serves several repositories and their work is one list, and the
 * question the rule asks is not how many of them there are. It is whether the
 * person, reading what the page already says, could tell two things apart: two
 * requests whose first lines differ are told apart by the person's own words,
 * and a place beside them separates nothing. Two requests that read the same
 * are told apart by nothing else, and there the place is said -- in the
 * person's own name for it, never the path rondo holds it by and never an
 * `OWNER/NAME`.
 *
 * Both cases are drawn in both wording sets (D-0079): what the set decides is
 * the prose around a name, and the rule itself must not move with the
 * language.
 */
import { expect, test } from "vitest";

import { type Chrome, chromeFor } from "../../src/access/wording.js";
import { fresh, operatorPage, portsOver, reserve } from "./page-world.js";

/** The two places a person in these cases works in, as rondo holds them. */
const ONE = "/home/ada/work/shop-app";
const OTHER = "/home/ada/work/billing";

const EN = chromeFor("en");
const JA = chromeFor("ja");

/** The page, drawn over two requests whose laps are in the places given. */
async function pageOver(
  wording: Chrome,
  first: { title: string; repository: string },
  second: { title: string; repository: string },
): Promise<string> {
  const world = fresh();
  await reserve(world, "i-0001", first.title, null, undefined, first.repository);
  await reserve(world, "i-0002", second.title, null, undefined, second.repository);
  return await operatorPage(portsOver(world), null, { kind: "summary" }, wording);
}

for (const wording of [EN, JA]) {
  test(`two requests the person's own words tell apart name no repository (${wording.lang})`, async () => {
    const html = await pageOver(
      wording,
      { title: "the invoice needs the tax broken out", repository: ONE },
      { title: "the receipt prints the wrong date", repository: OTHER },
    );

    // Two repositories, and still no place on either row: the titles already
    // separate them, so a name added beside would say nothing a person could
    // use (rule 5.1).
    expect(html).toContain("the invoice needs the tax broken out");
    expect(html).toContain("the receipt prints the wrong date");
    expect(html).not.toContain("list-repo");
    expect(html).not.toContain("shop-app");
    expect(html).not.toContain("billing");
  });

  test(`two requests that read the same are each named their place (${wording.lang})`, async () => {
    const html = await pageOver(
      wording,
      { title: "the build is broken", repository: ONE },
      { title: "the build is broken", repository: OTHER },
    );

    // Nothing else on the page tells these two apart, so the place is drawn --
    // as the name the person calls it by, which is the last segment of the
    // path and never the path (D-0081 rule 4.2, D-0076 rule 3.3).
    expect(html).toContain("list-repo");
    expect(html).toContain("shop-app");
    expect(html).toContain("billing");
    expect(html).not.toContain(ONE);
    expect(html).not.toContain(OTHER);
  });
}

test("the place is said for the pair that collides and not for the request beside them", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "the build is broken", null, undefined, ONE);
  await reserve(world, "i-0002", "the build is broken", null, undefined, OTHER);
  // A third request in a third place, saying something of its own: the page
  // spans three repositories now, and this row still carries none of them,
  // because nothing on the page could be mistaken for it.
  await reserve(world, "i-0003", "the nightly report is late", null, undefined, "/home/ada/ops");

  const html = await operatorPage(portsOver(world), null, { kind: "summary" }, EN);

  expect(html).toContain("shop-app");
  expect(html).toContain("billing");
  expect(html).not.toContain("ops");
});
