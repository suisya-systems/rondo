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
    html.indexOf("Finished, and the work was taken in."),
  ];
  expect(positions.every((at) => at > -1)).toBe(true);
  expect(positions).toEqual([...positions].toSorted((left, right) => left - right));
});
