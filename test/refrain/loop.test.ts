/**
 * `nextStep` is total, reads both of the policy's bounds, and names an edge for
 * every one of the eleven statuses.
 *
 * This file defends two properties. The first is the one it has always
 * defended: `src/refrain/policy.ts` claims in prose that `maxIterations` is a
 * hard ceiling, and that claim was false when it was first written -- the field
 * was documented and never read -- which is why it has cases rather than a
 * comment. The second is new with D-0019 rule 8: `nextStep` is a **total**
 * function over a union that has grown from four states to eleven, so every
 * status has a case here and a status outside the union has one too, because
 * the row is read out of a database rondo does not have exclusive authorship of.
 *
 * **The previous file's `running` cases were re-pointed, and the claims survived
 * the re-pointing.** D-0019 removed `running`: it is the one word that cannot be
 * acted on after a crash, and `admitting`, `admitted` and `performing` each say
 * which effect is in flight. Every behavioural claim the old cases made is still
 * here -- both axes are read, the ceiling is compared so that a ceiling of zero
 * authorises nothing, an unusable ceiling stops rather than frees the loop, the
 * conservative default asks, and the default policy is the one used when none is
 * given -- asked of the states that exist now.
 *
 * One claim moved rather than being re-spelled, and it is worth naming. The old
 * file asserted that a corrupted `attempts` **on the record** could not read as
 * "below the ceiling". D-0019 rule 9 gives the ceiling exactly one reader, at
 * admission, where it is compared against a fresh iteration's zero attempts --
 * so there is no longer a count on the record for the ceiling to be fooled by.
 * The claim is preserved as its stronger form: the record's `attempts` does not
 * change `nextStep`'s answer at all, whatever is in it, which is what pins that
 * no second reader has quietly appeared.
 */
import { expect, test } from "vitest";

import { nextStep } from "../../src/refrain/loop.js";
import { CONSERVATIVE_POLICY, type LoopPolicy } from "../../src/refrain/policy.js";
import type { IterationRecord, IterationStatus } from "../../src/store/records.js";

/**
 * A record at one status, with everything else at a value `nextStep` may not
 * read.
 *
 * The nullable columns stay null on purpose: `nextStep` is a function of the
 * status alone once a record exists, and a fixture that filled them in would
 * hide a future reader of them behind a plausible value.
 */
const recordWith = (status: IterationStatus, attempts = 1): IterationRecord => ({
  id: "i-0001",
  status,
  request: "do the thing",
  plan: {},
  planDigest: "sha256:0",
  attempts,
  runId: null,
  continuoRevision: null,
  agentTypeDigest: null,
  configDigest: null,
  contractDigest: null,
  classification: null,
  classificationReason: null,
  neutralRoleName: null,
  continuoRole: null,
  gateId: null,
  gateStage: null,
  gateOutcome: null,
  sessionId: null,
  sessionPath: null,
  reason: null,
  createdAtMs: 0,
  updatedAtMs: 0,
});

/** Autonomy that permits admitting, so the ceiling is the only thing left. */
const permissive = (maxIterations: number): LoopPolicy => ({
  autonomy: "ask_before_landing",
  maxIterations,
});

const asks = { kind: "ask_human", about: "i-0001" } as const;

// --- the policy, which is read only where no record exists yet ---------------

test("with no iteration yet and both bounds satisfied, the loop reserves", () => {
  // The old file's "under permissive autonomy and room to spare, the loop
  // iterates", re-pointed: the edge a permitting policy authorises in lap 1 is
  // the reservation, because `iterate` names a back-edge that does not exist.
  expect(nextStep(null, permissive(5))).toEqual({ kind: "reserve" });
});

test("the conservative default asks before anything is reserved", () => {
  expect(nextStep(null, CONSERVATIVE_POLICY)).toEqual({
    kind: "ask_human",
    about: "a new request",
  });
});

test("the default policy is the one used when none is given", () => {
  expect(nextStep(null)).toEqual(nextStep(null, CONSERVATIVE_POLICY));
});

test("a ceiling of zero authorises nothing", () => {
  // The case Codex found, and it still holds where the ceiling is now read: a
  // fresh iteration has zero attempts, so a policy of zero must refuse it. A
  // policy that says "no unattended iterations" and then authorises one is
  // worse than a policy with no ceiling at all, because the reader has been
  // told there is a bound.
  expect(nextStep(null, permissive(0))).toEqual({ kind: "ask_human", about: "a new request" });
  expect(nextStep(null, permissive(1))).toEqual({ kind: "reserve" });
});

test("a ceiling that is not a whole count stops the loop rather than freeing it", () => {
  // Every comparison with NaN is false, so an unusable ceiling would otherwise
  // read as "not reached yet", every time, forever. Infinity and a fractional
  // limit are the same problem, quieter. All of them ask a human.
  for (const maxIterations of [Number.NaN, Number.POSITIVE_INFINITY, 1.5, -1]) {
    expect(nextStep(null, permissive(maxIterations))).toEqual({
      kind: "ask_human",
      about: "a new request",
    });
  }
});

test("the conservative default's own ceiling authorises exactly one iteration", () => {
  // Its autonomy stops it first, so this pins the ceiling independently of
  // that: with autonomy relaxed and nothing else changed, the default number
  // still authorises a fresh iteration, and zero would not.
  expect(nextStep(null, permissive(CONSERVATIVE_POLICY.maxIterations))).toEqual({
    kind: "reserve",
  });
  expect(CONSERVATIVE_POLICY.maxIterations).toBe(1);
});

test("both axes are read: either one alone refuses", () => {
  // The claim the file exists for. Autonomy permits and the ceiling refuses;
  // the ceiling permits and autonomy refuses; only both together reserve.
  expect(nextStep(null, { autonomy: "ask_before_landing", maxIterations: 0 })).toEqual({
    kind: "ask_human",
    about: "a new request",
  });
  expect(nextStep(null, { autonomy: "ask_every_iteration", maxIterations: 9 })).toEqual({
    kind: "ask_human",
    about: "a new request",
  });
  expect(nextStep(null, { autonomy: "ask_before_landing", maxIterations: 9 })).toEqual({
    kind: "reserve",
  });
});

test("the policy has no second reader once a record exists", () => {
  // D-0019 rule 9: both axes are read at admission and nowhere else. A record
  // answers the same under a policy that would have refused it as under one
  // that would have admitted it.
  for (const status of ["planned", "classified", "admitted", "closed"] as const) {
    expect(nextStep(recordWith(status), permissive(9))).toEqual(
      nextStep(recordWith(status), CONSERVATIVE_POLICY),
    );
  }
});

test("an attempt count that is not a whole number stops the loop", () => {
  // The old file's record-side claim, kept: a corrupted count must not read as
  // an ordinary one. The ceiling has moved to admission (D-0019 rule 9), so
  // this is no longer a bound being compared -- it is the record failing to
  // read, and an unreadable field halts and asks whatever the status says.
  // Losing this when the comparison moved would have let a row edited out of
  // band drive a lap on the strength of its status alone.
  for (const attempts of [Number.NaN, Number.POSITIVE_INFINITY, 0.5, -1]) {
    expect(nextStep(recordWith("planned", attempts), permissive(1))).toEqual(asks);
  }
});

test("an attempt count that is merely large is not corruption", () => {
  // The other half of the same claim, and the one that keeps the check from
  // being a second ceiling: there is no post-admission bound on `attempts`, so
  // a big whole number is an ordinary record and reads as one.
  expect(nextStep(recordWith("planned", 10_000), permissive(1))).toEqual(
    nextStep(recordWith("planned", 1), permissive(1)),
  );
});

// --- a case per status, so the switch is covered -----------------------------

test("a planned iteration is classified next", () => {
  expect(nextStep(recordWith("planned"), permissive(9))).toEqual({
    kind: "classify",
    about: "i-0001",
  });
});

test("a classified iteration is admitted next", () => {
  expect(nextStep(recordWith("classified"), permissive(9))).toEqual({
    kind: "admit",
    about: "i-0001",
  });
});

test("an admitted iteration performs a lap next", () => {
  expect(nextStep(recordWith("admitted"), permissive(9))).toEqual({
    kind: "perform",
    about: "i-0001",
  });
});

test("an iteration awaiting a human is observed, not waited on, under any autonomy", () => {
  // The old file's "a record already awaiting a human keeps waiting" case,
  // re-pointed. `awaiting_human` now means one thing -- a continuo gate is open
  // on this iteration -- so the one edge from it is to look at that gate, and
  // no autonomy setting changes that.
  for (const policy of [CONSERVATIVE_POLICY, permissive(9)]) {
    expect(nextStep(recordWith("awaiting_human"), policy)).toEqual({
      kind: "observe_gate",
      about: "i-0001",
    });
  }
});

test("a withdrawal that has been asked for is observed on the same edge", () => {
  // Which is what keeps `withdrawal_requested` from being a state with no way
  // out: the observation is identical, so `resume()` serves both.
  expect(nextStep(recordWith("withdrawal_requested"), permissive(9))).toEqual({
    kind: "observe_gate",
    about: "i-0001",
  });
});

test("an effect in flight stops and asks rather than being re-sent", () => {
  // `admitting` and `performing` are the two states a restart must not act on:
  // `run admit` refuses a duplicate run id and relying on that refusal to find
  // out what happened is guessing with a mutating verb, and `lap perform`
  // cannot be re-entered while a fenced child may still be alive.
  expect(nextStep(recordWith("admitting"), permissive(9))).toEqual(asks);
  expect(nextStep(recordWith("performing"), permissive(9))).toEqual(asks);
});

test("a stalled iteration asks a human, under any autonomy", () => {
  for (const policy of [CONSERVATIVE_POLICY, permissive(9)]) {
    expect(nextStep(recordWith("stalled"), policy)).toEqual(asks);
  }
});

test("a closed iteration has one thing left, and it is saying so", () => {
  expect(nextStep(recordWith("closed"), permissive(9))).toEqual({
    kind: "report",
    about: "i-0001",
  });
});

test("the two other terminal statuses are at rest, whatever the policy says", () => {
  // The old file's "a closed iteration is at rest, whatever the policy says",
  // re-pointed: `closed` now owes a report (above), and rest belongs to the two
  // terminal statuses that were already explained at the moment they were
  // written.
  for (const status of ["abandoned", "failed"] as const) {
    for (const policy of [CONSERVATIVE_POLICY, permissive(9)]) {
      expect(nextStep(recordWith(status), policy)).toEqual({ kind: "rest" });
    }
  }
});

test("a status the union does not cover asks a human and names the row", () => {
  // The row is read out of a database rondo does not have exclusive authorship
  // of, so this is an input and not an impossibility. The cast is the point of
  // the case: it is the shape a hand-edited or older-schema row arrives in.
  const foreign = { ...recordWith("planned"), status: "half_done" as IterationStatus };
  expect(nextStep(foreign, permissive(9))).toEqual(asks);
});

test("an unreadable row is still described rather than dropped", () => {
  // The id is the only handle a person has on a row whose status did not read,
  // so it is carried through when it is a usable string and described when it
  // is not.
  const nameless = {
    ...recordWith("planned"),
    id: "",
    status: "half_done" as IterationStatus,
  };
  expect(nextStep(nameless, permissive(9))).toEqual({
    kind: "ask_human",
    about: "an unreadable row",
  });
});
