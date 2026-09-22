/**
 * The centre face's stream, over a real store (DECISIONS.md D-0083 rules 2
 * and 5).
 *
 * **What these hold is that the thread is the request and not one of its
 * laps.** The list picks one lap to speak for a request, because a row is one
 * line; the thread is the request itself, so every lap's record is in it, a
 * gate is answerable wherever it stands, and the whole runs in the order it
 * happened rather than in the order the two sources were gathered.
 */
import { expect, test } from "vitest";
import { fresh, openGate, openRequest, operatorPage, portsOver, reserve } from "../page-world.js";

/** Two laps under one request: the first at its gate, a second started after it. */
async function twoLaps() {
  const world = fresh();
  await openRequest(world, "req-two", "count the laps", 1_000);
  await reserve(world, "i-first", "count the laps", null, "req-two");
  await openGate(world, "i-first");
  await reserve(world, "i-second", "count the laps", null, "req-two");
  // The second lap moves last, so it is the one `saysMore` would pick to
  // speak for the request in a list.
  for (const [from, to] of [
    ["planned", "admitting"],
    ["admitting", "admitted"],
    ["admitted", "performing"],
  ] as const) {
    expect((await world.store.transition("i-second", from, to, {}, 4_000)).kind).toBe(
      "transitioned",
    );
  }
  return world;
}

test("a gate is answerable wherever it stands among the request's laps", async () => {
  // **The failure this is against**: `saysMore` orders by what a row should
  // say, so a running retry speaks for the request while an older lap is still
  // at its gate. With no per-lap address left (D-0083 rule 3), a box drawn
  // only for the lap the list speaks with would leave that gate unreachable.
  const world = await twoLaps();
  const html = await operatorPage(portsOver(world, "ada", []), "t", {
    kind: "thread",
    messageId: "req-two",
    to: null,
  });
  expect(html).toContain('id="answering"');
  expect(html).toContain("gate-i-first");
});

test("every lap of the request is in the record, and the record runs in time order", async () => {
  // **A retry must not take the lap it superseded out of the thread**: the
  // messages would stay and the work would vanish, which is the request's
  // history changing retroactively because another lap started.
  const world = await twoLaps();
  const html = await operatorPage(portsOver(world, "ada", []), "t", {
    kind: "thread",
    messageId: "req-two",
    to: null,
  });
  expect([...html.matchAll(/Work started\./g)]).toHaveLength(2);
  // **And each line says which try it belongs to** (D-0076 rule 3.3): four
  // laps otherwise draw four *work started* and four *finished* with nothing
  // saying which ending belongs to which attempt. A try is a thing a person
  // has -- rule 6's line counts them -- and not an identifier of rondo's.
  expect(html).toContain("Try 1: Work started.");
  expect(html).toContain("Try 2: Work started.");
});

test("with one lap there is nothing to tell apart, so no try is said", async () => {
  const world = fresh();
  await openRequest(world, "req-one", "count the laps", 1_000);
  await reserve(world, "i-only", "count the laps", null, "req-one");
  await openGate(world, "i-only");
  const html = await operatorPage(portsOver(world, "ada", []), "t", {
    kind: "thread",
    messageId: "req-one",
    to: null,
  });
  expect(html).toContain("Work started.");
  expect(html).not.toContain("Try 1:");
});

test("a message written while the work ran sits between the events around it", async () => {
  // **One stream, in the order it happened** (rule 2, and `page/thread.tsx`'s
  // own claim about itself). The messages and the event lines are gathered
  // apart: concatenated, every event lands after every message, so a reply
  // written while a lap ran would be drawn above the line saying it started.
  const world = fresh();
  await openRequest(world, "req-order", "count the laps", 1_000);
  await reserve(world, "i-0001", "count the laps", null, "req-order");
  await openGate(world, "i-0001");
  await openRequest(world, "m-meanwhile", "and one more thing", 3_000);
  world.connection
    .prepare("UPDATE conversation_message SET in_reply_to = 'req-order' WHERE message_id = ?")
    .run("m-meanwhile");
  expect((await world.store.transition("i-0001", "awaiting_human", "closed", {}, 5_000)).kind).toBe(
    "transitioned",
  );

  const html = await operatorPage(portsOver(world, "ada", []), "t", {
    kind: "thread",
    messageId: "req-order",
    to: null,
  });
  const positions = [
    html.indexOf("Work started."),
    html.indexOf("and one more thing"),
    html.indexOf("Finished."),
  ];
  expect(positions.every((at) => at > -1)).toBe(true);
  // Drawn newest first (D-0106), so the order on the page is the reverse.
  expect(positions).toEqual([...positions].toSorted((left, right) => right - left));
});

test("a request waits on the person while any of its laps does", async () => {
  // **The list and the selection read the same thing the box does** (Codex).
  // `saysMore` lets a newer running lap speak for a request; if *waiting* were
  // read off that one lap, a request with an unanswered gate would drop out of
  // *your turn* and out of rule 3's selection -- the page would neither lift
  // it nor open it, while its box was drawable all along.
  const world = await twoLaps();
  const html = await operatorPage(portsOver(world, "ada", []), "t", { kind: "summary" });
  expect(html).toContain("Waiting on your answer");
  expect(html).toContain(">1 waiting</a>");
  // And rule 3 selects it, so the page a person arrives on is the one with
  // the question on it.
  expect(html).toContain('id="answering"');
});
