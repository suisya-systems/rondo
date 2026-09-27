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

import { asEffect, landingRemoteOf, lapSpendFields } from "../../src/access/conductor.js";
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

test("a Codex lap's tokens are priced, and a reported cost is never replaced (D-0123)", () => {
  const tokens = {
    model: "gpt-6-astra",
    inputTokens: 1_000_000,
    cachedInputTokens: 0,
    cacheWriteInputTokens: 0,
    outputTokens: 100_000,
  };
  const codex = lapSpendFields({ totalCostUsd: null, numTurns: null, durationMs: 9, ...tokens });
  expect(codex).toEqual({ costUsd: 15, turns: null, durationMs: 9, spendSource: "priced" });

  const claude = lapSpendFields({ totalCostUsd: 1.5, numTurns: 3, durationMs: 9, ...tokens });
  expect(claude).toMatchObject({ costUsd: 1.5, spendSource: "resultEvent" });

  // Tokens that do not price leave the null a null (D-0046: not read, not zero).
  const unpriced = lapSpendFields({
    totalCostUsd: null,
    numTurns: null,
    durationMs: 9,
    ...tokens,
    model: null,
  });
  expect(unpriced).toMatchObject({ costUsd: null, spendSource: "resultEvent" });
});

test("rondo#286 (D-0153): where a landing is read from is what the publish recorded, and nothing is guessed", () => {
  const lap = (publishedRemote: string | null) => ({ publishedRemote });

  // Rule 2: the record is the basis, whatever it names.
  expect(landingRemoteOf([lap("origin"), lap(null)], "origin")).toEqual({ remote: "origin" });

  // Rule 3: no record at all is undetermined, and says a press is what ends it.
  const unrecorded = landingRemoteOf([lap(null)], "origin");
  expect(unrecorded).toMatchObject({
    undetermined: expect.stringContaining("holds no record of the remote a publish pushed it to"),
  });
  expect(unrecorded).toMatchObject({
    undetermined: expect.stringContaining("release press"),
  });

  // Rule 4: a record this host disagrees with is a person's to settle, and
  // rondo names both sides rather than choosing one.
  expect(landingRemoteOf([lap("fork")], "origin")).toEqual({
    undetermined:
      "its publish pushed to 'fork' and this host reads landings from 'origin'. rondo does " +
      "not settle that disagreement by itself: point the host at the remote the publish " +
      "used, or release the line by hand",
  });

  // Two laps of one line published to two remotes is the same refusal to
  // choose: neither is read, whichever one this host is pointed at.
  for (const wired of ["origin", "fork"]) {
    expect(landingRemoteOf([lap("origin"), lap("fork")], wired)).toMatchObject({
      undetermined: expect.stringContaining("published to more than one remote ('fork', 'origin')"),
    });
  }
});
