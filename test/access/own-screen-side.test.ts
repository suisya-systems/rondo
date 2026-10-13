/**
 * The right face beside a screen of its own (rondo#693, after rondo#664):
 * publish, merge, release and end are about one lap, so the side is that
 * lap's request's; sign-in is about none, so the side names no request. In
 * every case another request first under *your turn* stays off the side. A
 * goal-scope screen is about a repository, so its side names none (rondo#696).
 */
import { expect, test } from "vitest";

import type { PageView } from "../../src/access/page-logic/routes.js";
import { EN } from "../../src/access/wording.js";
import { fresh, openGate, operatorPage, portsOver, reserve } from "./page-world.js";

async function sideOf(view: PageView): Promise<string> {
  const world = fresh();
  // Waiting at a gate: what the page selects when nothing is named.
  await reserve(world, "lap-elsewhere", "Somebody else's older work");
  await openGate(world, "lap-elsewhere");
  await reserve(world, "lap-own", "The work this screen is about");
  const html = await operatorPage(portsOver(world, "ada", []), "t", view, EN);
  // The list still names the waiting request; the side must not draw it.
  expect(html).toContain('href="/?thread=req-lap-elsewhere&amp;lang=en"');
  const side = html.slice(html.indexOf('<aside class="face face-side"'));
  return side.slice(0, side.indexOf("</aside>"));
}

for (const kind of ["publish", "merge", "release", "end"] as const) {
  test(`the ${kind} screen's right side is its lap's request's, not the one first under your turn (rondo#693)`, async () => {
    const side = await sideOf({ kind, iterationId: "lap-own" });
    expect(side).not.toContain("lap-elsewhere");
    expect(side).toContain("What remains before this ends");
  });
}

test("the sign-in screen's right side names no request, not the one first under your turn (rondo#693)", async () => {
  const side = await sideOf({ kind: "signIn" });
  expect(side).not.toContain("lap-elsewhere");
  expect(side).not.toContain("What remains before this ends");
});

test("the goal-scope screen's right side names no request, not the one first under your turn (rondo#696)", async () => {
  const side = await sideOf({ kind: "goalScope", repository: "acme/app" });
  expect(side).not.toContain("lap-elsewhere");
  expect(side).not.toContain("What remains before this ends");
});
