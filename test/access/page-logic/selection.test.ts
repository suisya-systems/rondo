/**
 * Which request the centre face shows (DECISIONS.md D-0083 rule 3).
 *
 * The property these cases hold is gate point 3's answer: opened by hand, the
 * page selects the **oldest** thing waiting, because the person came to
 * answer. D-0083's own falsifier is the other side of it -- "a person with
 * three requests waiting who cannot say which is oldest" is what tells you the
 * lift out of the time order cost more than it bought.
 */
import { expect, test } from "vitest";
import type { RequestList, RequestRow } from "../../../src/access/page-logic/list.js";
import { selectRequest, walkPosition } from "../../../src/access/page-logic/selection.js";

const row = (messageId: string, atMs: number): RequestRow => ({
  messageId,
  title: messageId,
  repository: null,
  state: "waitingOnYou",
  atMs,
});

/** `requestList` hands `yourTurn` over oldest-first; these stand in for that. */
const listOf = (yourTurn: readonly RequestRow[]): RequestList => ({
  yourTurn,
  days: [],
  lastLookedAbove: null,
});

test("opened by hand, the oldest thing waiting is selected", () => {
  const list = listOf([row("last-week", 1), row("an-hour-ago", 9)]);
  expect(selectRequest(null, list)).toEqual({ kind: "request", messageId: "last-week" });
});

test("a request the address names wins over the oldest waiting one", () => {
  // Arriving from a notification: the person asked for this one, and is not
  // redirected to another because it has waited longer.
  const list = listOf([row("last-week", 1), row("an-hour-ago", 9)]);
  expect(selectRequest("an-hour-ago", list)).toEqual({
    kind: "request",
    messageId: "an-hour-ago",
  });
  // Even a request that is not waiting at all.
  expect(selectRequest("some-finished-one", list)).toEqual({
    kind: "request",
    messageId: "some-finished-one",
  });
});

test("with nothing waiting and nothing named, nothing is selected", () => {
  // Rule 4: empty is the ordinary state, and its centre asks what the person
  // wants -- which is a different screen, not an empty thread.
  expect(selectRequest(null, listOf([]))).toEqual({ kind: "empty" });
});

test("the walk counts what waits, and a request outside it has no position", () => {
  const list = listOf([row("a", 1), row("b", 2), row("c", 3)]);
  expect(walkPosition("a", list)).toEqual({ at: 1, of: 3 });
  expect(walkPosition("c", list)).toEqual({ at: 3, of: 3 });
  // Not waiting: null rather than zero, because it has no place in the walk.
  expect(walkPosition("elsewhere", list)).toBeNull();
  expect(walkPosition("a", listOf([]))).toBeNull();
});
