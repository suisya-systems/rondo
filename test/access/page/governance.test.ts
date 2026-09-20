/**
 * The governance line and the line where the person last looked, on the page
 * (DECISIONS.md D-0083 rules 6 and 7).
 *
 * `page-logic/governance.test.ts` holds what the figures *are*; this holds
 * that they reach the markup, under the title, on the page a person arrives
 * on -- and that rule 6's refusal survives the rendering rather than only the
 * derivation.
 */
import { expect, test } from "vitest";
import {
  fresh,
  gateWithChecks,
  openRequest,
  operatorPage,
  portsOver,
  reserve,
} from "../page-world.js";

test("the governance line is under the title, permanent, and carries all six of rule 6's items", async () => {
  const world = fresh();
  await gateWithChecks(world);
  const html = await operatorPage(portsOver(world, "ada", []), "t", { kind: "summary" });

  // Under the title and inside the thread's own header, which is what "under
  // every thread's title, at every width" means in markup: not a card beside
  // it, and not a fold.
  const headAt = html.indexOf('class="thread-head"');
  const head = html.slice(headAt, html.indexOf("</header>", headAt));
  expect(head).toContain('class="gov"');
  expect(head.indexOf("<h1")).toBeLessThan(head.indexOf('class="gov"'));

  // The chain, in rule 6's order, with the step the work is stopped on marked
  // and the last step never rondo's.
  expect(head).toContain("your answer");
  expect(head).toContain("proposal");
  expect(head).toContain("merge");
  expect(head.indexOf("your answer")).toBeLessThan(head.indexOf("proposal"));
  expect(head.indexOf("proposal")).toBeLessThan(head.indexOf("merge"));
  expect(head).toContain('class="gov-step gov-waiting">your answer');
  expect(head).toContain('class="gov-step gov-yours">merge');

  // **The sixth item, counted** (rondo#350). The note admitting the absence
  // is gone with the absence: the count is read from this request's own
  // withheld rows, so zero is *nothing was withheld about this request* and
  // not a claim about every silence rondo has ever kept.
  expect(head).toContain('class="gov-decided">decided without asking: 0');
  expect(head).not.toContain("not counted here yet");
});

test("the right face carries the same governance in full, under the material", async () => {
  // **Rule 6's second half**: the line is what fits on a line and the right
  // face is the whole of it -- the allowance with what is left, the tries,
  // where a lap may touch, the steps to the end, and what was decided without
  // asking. Rule 5 puts the material above it while a question is standing.
  const world = fresh();
  await gateWithChecks(world);
  const html = await operatorPage(portsOver(world, "ada", []), "t", { kind: "summary" });
  const side = html.slice(html.indexOf('class="face face-side"'));
  expect(side).toContain("What this rests on");
  expect(side).toContain("What was agreed for this");
  expect(side).toContain("What remains before this ends");
  expect(side).toContain("Nothing about this was decided without asking you.");
  // The material is above the agreement, because something is being asked.
  expect(side.indexOf("What this rests on")).toBeLessThan(side.indexOf("What was agreed for this"));
  // **Rule 6's ban, on the face as on the line**: these fixtures admit their
  // laps under no approval, so no spend is drawn and no reach either.
  const agreed = side.slice(side.indexOf("What was agreed for this"));
  expect(agreed).toContain("No allowance approved yet");
  expect(agreed).not.toContain("$");
  expect(agreed).not.toContain("Where it may touch");
});

test("with no approval to read, the line says so instead of a spend nobody agreed to", async () => {
  // Rule 6's last sentence, on the page: these fixtures admit their laps under
  // no approval, so neither figure may be drawn.
  const world = fresh();
  await gateWithChecks(world);
  const html = await operatorPage(portsOver(world, "ada", []), "t", { kind: "summary" });
  const headAt = html.indexOf('class="thread-head"');
  const head = html.slice(headAt, html.indexOf("</header>", headAt));
  expect(head).toContain("No allowance approved yet");
  expect(head).not.toContain("$");
  expect(head).not.toMatch(/try \d+ of/);
});

test("the line where the reading stopped is drawn once, above the first thing that is new", async () => {
  const world = fresh();
  await openRequest(world, "req-old", "the first thing", 1_000);
  await reserve(world, "i-0001", "the first thing", null, "req-old");
  // A second message, after the mark: the line belongs above it and nowhere else.
  await openRequest(world, "m-new", "and one more thing", 4_000);
  const connection = world.connection;
  connection
    .prepare("UPDATE conversation_message SET in_reply_to = 'req-old' WHERE message_id = 'm-new'")
    .run();
  expect(await world.record.recordView("ada", 2_000)).toEqual({ kind: "recorded" });

  const html = await operatorPage(portsOver(world, "ada", []), "t", {
    kind: "thread",
    messageId: "req-old",
    to: null,
  });

  // **Once** (rule 7): one in the thread and one in the list, and no row
  // carries a *new* mark of its own.
  const lines = [...html.matchAll(/class="thread-since"/g)];
  expect(lines).toHaveLength(1);
  // Above the message that arrived after the look, and below the one before it.
  const at = html.indexOf('class="thread-since"');
  expect(html.indexOf('id="req-old"')).toBeLessThan(at);
  expect(at).toBeLessThan(html.indexOf('id="m-new"'));
});

test("a person who has never looked gets no line, because nothing is below it", async () => {
  const world = fresh();
  await gateWithChecks(world);
  const html = await operatorPage(portsOver(world, "ada", []), "t", { kind: "summary" });
  expect(html).not.toContain('class="thread-since"');
});

test("the walk says where this request stands among the ones waiting, and leads to the next", async () => {
  // Rule 3's *your turn 1 / 3, next*, in the list's own order -- oldest first,
  // so a person with three things waiting meets the one that has been waiting
  // longest and can keep going without choosing each time.
  const world = fresh();
  await gateWithChecks(world);
  const html = await operatorPage(portsOver(world, "ada", []), "t", { kind: "summary" });
  const headAt = html.indexOf('class="thread-head"');
  const head = html.slice(headAt, html.indexOf("</header>", headAt));
  expect(head).toContain("your turn 1 / 1");
  // One waiting request, so there is nowhere to walk on to and no link is drawn.
  expect(head).not.toContain(">next<");
});

test("the thread leads to the screens the request can be taken to next", async () => {
  // **The rows that carried these entrances are gone** (D-0083 rule 5), and
  // the screens are not. A screen rondo still has and no page leads to is a
  // screen only a typed address reaches, which is how a workflow disappears
  // without a decision saying it did.
  const world = fresh();
  await gateWithChecks(world);
  const html = await operatorPage(portsOver(world, "ada", []), "t", { kind: "summary" });
  expect(html).toContain('href="/?scope=req-1&amp;lang=en"');
  // No forge is configured in this world, so the publish entrance is not drawn
  // -- the same condition the publish screen itself draws a button under.
  expect(html).not.toContain('href="/?publish=');

  // With no write port there is nothing to press and no entrance either.
  const read = await operatorPage(portsOver(world, null), null, { kind: "summary" });
  expect(read).not.toContain('href="/?scope=');
});
