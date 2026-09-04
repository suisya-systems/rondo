/**
 * `nextStep` reads both of the policy's bounds.
 *
 * The loop itself is out of scope for Issue #1, and this file does not test it:
 * it tests the one claim `src/refrain/policy.ts` makes in prose -- that
 * `maxIterations` is a hard ceiling. That claim was false when it was first
 * written (the field was documented and never read), which is why it now has a
 * case rather than a comment.
 */
import { expect, test } from "vitest";

import { nextStep } from "../../src/refrain/loop.js";
import { CONSERVATIVE_POLICY, type LoopPolicy } from "../../src/refrain/policy.js";
import type { IterationRecord, IterationStatus } from "../../src/store/records.js";

const recordWith = (status: IterationStatus, attempts: number): IterationRecord => ({
  id: "i-0001",
  status,
  attempts,
  observedAtMs: 0,
});

/** Autonomy that permits iterating, so the ceiling is the only thing left. */
const permissive = (maxIterations: number): LoopPolicy => ({
  autonomy: "ask_before_landing",
  maxIterations,
});

test("a closed iteration is at rest, whatever the policy says", () => {
  expect(nextStep(recordWith("closed", 0), permissive(10))).toEqual({ kind: "rest" });
});

test("the conservative default stops at every iteration", () => {
  expect(nextStep(recordWith("planned", 0), CONSERVATIVE_POLICY)).toEqual({
    kind: "ask_human",
    about: "i-0001",
  });
});

test("the default policy is the one used when none is given", () => {
  expect(nextStep(recordWith("planned", 0))).toEqual(
    nextStep(recordWith("planned", 0), CONSERVATIVE_POLICY),
  );
});

test("a record already awaiting a human keeps waiting, under any autonomy", () => {
  expect(nextStep(recordWith("awaiting_human", 0), permissive(10))).toEqual({
    kind: "ask_human",
    about: "i-0001",
  });
});

test("under permissive autonomy and room to spare, the loop iterates", () => {
  expect(nextStep(recordWith("running", 2), permissive(5))).toEqual({
    kind: "iterate",
    attempt: 3,
  });
});

test("the ceiling is reached, not exceeded", () => {
  // At the boundary and past it, both stop. `>=`, not `>`: a policy of 3 must
  // authorise attempts 1, 2 and 3, and refuse a fourth.
  expect(nextStep(recordWith("running", 3), permissive(3))).toEqual({
    kind: "ask_human",
    about: "i-0001",
  });
  expect(nextStep(recordWith("running", 4), permissive(3))).toEqual({
    kind: "ask_human",
    about: "i-0001",
  });
});

test("a ceiling of zero authorises nothing", () => {
  // The case Codex found: a policy that says "no unattended iterations" and
  // then authorises one is worse than a policy with no ceiling at all, because
  // the reader has been told there is a bound.
  expect(nextStep(recordWith("running", 0), permissive(0))).toEqual({
    kind: "ask_human",
    about: "i-0001",
  });
});

test("a ceiling that is not a whole count stops the loop rather than freeing it", () => {
  // Every comparison with NaN is false, so an unusable ceiling would otherwise
  // read as "not reached yet" on every iteration, forever. Infinity and a
  // fractional limit are the same problem, quieter. All of them ask a human.
  for (const maxIterations of [Number.NaN, Number.POSITIVE_INFINITY, 1.5, -1]) {
    expect(nextStep(recordWith("running", 1), permissive(maxIterations))).toEqual({
      kind: "ask_human",
      about: "i-0001",
    });
  }
});

test("an attempt count that is not a whole number stops the loop too", () => {
  // The same hole from the record's side: a corrupted count must not read as
  // "below the ceiling".
  for (const attempts of [Number.NaN, Number.POSITIVE_INFINITY, 0.5, -1]) {
    expect(nextStep(recordWith("running", attempts), permissive(5))).toEqual({
      kind: "ask_human",
      about: "i-0001",
    });
  }
});

test("the conservative default's own ceiling is one attempt", () => {
  // Its autonomy stops it first, so this pins the ceiling independently of
  // that: with autonomy relaxed and nothing else changed, one attempt is all
  // the default number permits.
  const asDefault = permissive(CONSERVATIVE_POLICY.maxIterations);
  expect(nextStep(recordWith("running", 0), asDefault)).toEqual({
    kind: "iterate",
    attempt: 1,
  });
  expect(nextStep(recordWith("running", 1), asDefault)).toEqual({
    kind: "ask_human",
    about: "i-0001",
  });
});
