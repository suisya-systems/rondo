/**
 * Whose turn it is, read once for the screen and for the host (rondo#311).
 *
 * The property worth a suite of its own is that **both sources count and
 * neither is the other's subset**: a lap at its gate with nothing asked in its
 * thread, and a question standing over a request no lap was ever started for.
 * The screen used to compute this inside its own `map`, where nothing could
 * say so.
 */
import { expect, test } from "vitest";
import { threadsOf } from "../../../src/access/page-logic/threads.js";
import {
  lapsPastTheirCeiling,
  requestsWaitingOnYou,
} from "../../../src/access/page-logic/waits.js";
import type { IterationRecord, ThreadMessageDraft } from "../../../src/store/records.js";

const message = (
  over: Partial<ThreadMessageDraft> & { messageId: string },
): ThreadMessageDraft => ({
  body: over.messageId,
  authorKind: "operator",
  authorId: "ada",
  inReplyTo: null,
  atMs: 1_000,
  bases: [],
  asks: false,
  ...over,
});

const lap = (over: Partial<IterationRecord> & { id: string }): IterationRecord =>
  ({
    status: "performing",
    plan: {},
    requestMessageId: `req-${over.id}`,
    updatedAtMs: 1_000,
    ...over,
  }) as IterationRecord;

const threads = (messages: readonly ThreadMessageDraft[]) =>
  threadsOf(messages, new Set(), new Map());

test("a lap at its gate puts its request on the person", () => {
  const waits = requestsWaitingOnYou(threads([message({ messageId: "req-a" })]), [
    lap({ id: "a", status: "awaiting_human", requestMessageId: "req-a" }),
  ]);
  expect([...waits]).toEqual(["req-a"]);
});

test("a lap in flight does not", () => {
  const waits = requestsWaitingOnYou(threads([message({ messageId: "req-a" })]), [
    lap({ id: "a", status: "performing", requestMessageId: "req-a" }),
  ]);
  expect([...waits]).toEqual([]);
});

test("a lap that ended does not, whichever way it ended", () => {
  for (const status of ["closed", "abandoned"] as const) {
    const waits = requestsWaitingOnYou(threads([message({ messageId: "req-a" })]), [
      lap({ id: "a", status, requestMessageId: "req-a" }),
    ]);
    expect([...waits], `a '${status}' lap is nobody's turn`).toEqual([]);
  }
});

test("a question with no lap behind it still puts its request on the person", () => {
  // The other source, and the one a reading built only from laps would miss:
  // nothing has been started here at all.
  const waits = requestsWaitingOnYou(
    threads([
      message({ messageId: "req-a" }),
      message({ messageId: "ask", inReplyTo: "req-a", authorKind: "drafter", asks: true }),
    ]),
    [],
  );
  expect([...waits]).toEqual(["req-a"]);
});

test("a question the person carried on is settled", () => {
  const waits = requestsWaitingOnYou(
    threads([
      message({ messageId: "req-a" }),
      message({ messageId: "ask", inReplyTo: "req-a", authorKind: "drafter", asks: true }),
      message({ messageId: "reply", inReplyTo: "ask", answerOutcome: "carry_on" }),
    ]),
    [],
  );
  expect([...waits]).toEqual([]);
});

test("two questions in one thread are one request to go and look", () => {
  const waits = requestsWaitingOnYou(
    threads([
      message({ messageId: "req-a" }),
      message({ messageId: "one", inReplyTo: "req-a", authorKind: "drafter", asks: true }),
      message({ messageId: "two", inReplyTo: "req-a", authorKind: "drafter", asks: true }),
    ]),
    [],
  );
  expect([...waits]).toEqual(["req-a"]);
});

test("a lap past its own plan's patience is late, and one inside it is not", () => {
  const ceiling = { invocation_ceiling_ms: 10_000 };
  const laps = [
    lap({ id: "late", status: "performing", plan: ceiling, updatedAtMs: 1_000 }),
    lap({ id: "inside", status: "performing", plan: ceiling, updatedAtMs: 9_000 }),
  ];
  expect(lapsPastTheirCeiling(laps, 12_000)).toEqual(["late:performing"]);
});

test("a lap with no readable ceiling is never late", () => {
  // There is no statement for the time to have passed: D-0068 reads the plan's
  // own patience and holds no threshold of rondo's to fall back on.
  for (const plan of [{}, { invocation_ceiling_ms: "soon" }, { invocation_ceiling_ms: 0 }]) {
    expect(
      lapsPastTheirCeiling([lap({ id: "a", plan, updatedAtMs: 0 })], 10_000_000),
      `'${JSON.stringify(plan)}' states no patience`,
    ).toEqual([]);
  }
});

test("a lap waiting on the person is not late, however long it waits", () => {
  // F1 is about rondo waiting past what it said it would wait, and a lap at a
  // gate is waiting on a person -- whose own slowness is not a finding
  // (D-0068 section 2, rule 5).
  const laps = [
    lap({
      id: "a",
      status: "awaiting_human",
      plan: { invocation_ceiling_ms: 10 },
      updatedAtMs: 0,
    }),
  ];
  expect(lapsPastTheirCeiling(laps, 10_000_000)).toEqual([]);
});

test("the episode is the lap and the status it is late at", () => {
  // D-0068 rule 3.1: a lap walks its in-flight statuses forward and never
  // re-enters one, so late at `admitting` and late again at `performing` are
  // two things to be told about and not a repeat of one.
  const plan = { invocation_ceiling_ms: 10 };
  expect(lapsPastTheirCeiling([lap({ id: "a", status: "admitting", plan })], 10_000)).toEqual([
    "a:admitting",
  ]);
  expect(lapsPastTheirCeiling([lap({ id: "a", status: "performing", plan })], 10_000)).toEqual([
    "a:performing",
  ]);
});
