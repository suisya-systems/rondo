/**
 * The one mapping in the composition root that decides whether a slot is given
 * back, exercised as the pure function it is.
 *
 * `asEffect` turns a decoded continuo outcome into the conductor's own, and the
 * interpreter reads that outcome and nothing else: `refused` and `defect` end
 * the iteration at `failed` and free the execution slot, `noAnswer` leaves the
 * row where it is and keeps it (`D-0019` rule 11, `D-0035`). So the mapping is
 * the whole of the difference between "a lap that failed" and "a lap nobody can
 * account for", and it is four lines of `switch` with no way to fail loudly --
 * exactly the shape that needs a case per branch rather than a walk through the
 * arc.
 *
 * `test/refrain/interpreter.test.ts` owns the other half: that a `noAnswer` at
 * `performing` really does hold the row and refuse the next admission.
 */
import { expect, test } from "vitest";

import { asEffect } from "../../src/access/conductor.js";
import type { ContinuoResult } from "../../src/continuo/protocol.js";

/** The reader is never reached on a failure path, and says so if it is. */
const unread = (): never => {
  throw new Error("asEffect read a payload off an outcome that carried none");
};

test("an abnormal end keeps the slot: it maps to noAnswer, never to defect", () => {
  // `D-0035`. continuo's CLI comes back through exit 0 or exit 2 and no other
  // status, so an invocation that ended any other way -- a signal, an escaping
  // exception's exit 1 -- never reached its own reporting path. `lap perform`'s
  // teardown may not have run, a worker may still be alive, and no session id
  // came back to name it. Mapping this onto `defect` would file it as a lap
  // that failed and hand the execution slot to the next one.
  const result: ContinuoResult<never> = {
    kind: "endedAbnormally",
    reason: "continuo lap perform exited 1",
  };
  expect(asEffect(result, unread)).toEqual({
    kind: "noAnswer",
    reason: "continuo lap perform exited 1",
  });
});

test("rondo's own ceiling keeps the slot for the same reason", () => {
  const result: ContinuoResult<never> = { kind: "timedOut", reason: "gave up after 900000ms" };
  expect(asEffect(result, unread)).toEqual({
    kind: "noAnswer",
    reason: "gave up after 900000ms",
  });
});

test("a defect diagnosed after an orderly exit still releases the slot", () => {
  // The other side of the same line: exit 0 with a document rondo could not
  // read is rondo's own bug, but the process it was reading came back through
  // its own reporting path, so nothing of the lap's is still running.
  const result: ContinuoResult<never> = {
    kind: "invokerDefect",
    reason: "continuo gate list exited 0 and stdout held no JSON document",
  };
  expect(asEffect(result, unread)).toEqual({
    kind: "defect",
    reason: "continuo gate list exited 0 and stdout held no JSON document",
  });
});

test("a refusal that names its session carries the id through, and only then", () => {
  // `continuo D-1102`'s field, passed along rather than manufactured: an
  // absent key stays absent (`exactOptionalPropertyTypes`), because "continuo
  // did not say" is not the same fact as "rondo looked and found nothing".
  const named: ContinuoResult<never> = {
    kind: "refused",
    db: "/tmp/cp.sqlite3",
    errorClass: "LapRefused",
    message: "the turn outlived --turn-timeout-ms",
    sessionId: "session-9",
  };
  expect(asEffect(named, unread)).toEqual({
    kind: "refused",
    message: "the turn outlived --turn-timeout-ms",
    sessionId: "session-9",
  });

  const unnamed: ContinuoResult<never> = {
    kind: "refused",
    db: "/tmp/cp.sqlite3",
    errorClass: "LeaseHeld",
    message: "the outbox-delivery lease is held",
  };
  expect(asEffect(unnamed, unread)).toEqual({
    kind: "refused",
    message: "the outbox-delivery lease is held",
  });
});

test("an answered outcome is the one path that reads the payload", () => {
  const result: ContinuoResult<{ runId: string }> = {
    kind: "answered",
    db: "/tmp/cp.sqlite3",
    payload: { runId: "r1" },
  };
  expect(asEffect(result, (payload) => payload.runId)).toEqual({
    kind: "answered",
    value: "r1",
  });
});
