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

test("the governance line is under the title, permanent, and says which of rule 6's items is missing", async () => {
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

  // **Five items, and the sixth named rather than dropped.** A line that read
  // as whole while one of rule 6's facts was absent is the failure this
  // sentence exists against; drawing it as `0` would be worse, because zero
  // is the claim that rondo decided nothing without asking.
  expect(head).toContain("what rondo decided without asking is not counted here yet");
  expect(head).not.toContain(">0<");
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
