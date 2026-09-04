/**
 * The loop, as far as a skeleton can state it.
 *
 * Issue #1 puts the loop itself out of scope; what is in scope is the boundary
 * around the directory that will hold it. So this module exists to give that
 * boundary something to be true of: it imports the store's record shapes and
 * its own policy, and it imports nothing else -- no HTTP, no browser, no
 * session provider, no continuo internals. That allowance is empty in
 * `test/architecture/import-boundaries.test.ts`, which is a stronger statement
 * than a list of forbidden names: it also refuses the ones nobody has thought
 * of yet.
 */
import type { IterationRecord } from "../store/records.js";

import { CONSERVATIVE_POLICY, type LoopPolicy } from "./policy.js";

/** What the loop decided to do next, without doing any of it. */
export type Step =
  /** Nothing to do; the loop is at rest. */
  | { readonly kind: "rest" }
  /** A human has to answer before anything else happens. */
  | { readonly kind: "ask_human"; readonly about: string }
  /** The iteration may proceed to its next attempt. */
  | { readonly kind: "iterate"; readonly attempt: number };

/**
 * The next step, given a record and a policy.
 *
 * A total function of its two arguments: no clock, no filesystem, no network.
 * That is what lets the loop be tested without standing anything up, and it is
 * the reason the boundary is drawn around this directory rather than asserted
 * in review. Both of the policy's bounds are read here -- the autonomy setting
 * and the iteration ceiling -- because a bound nothing consults is not a bound.
 */
export function nextStep(record: IterationRecord, policy: LoopPolicy = CONSERVATIVE_POLICY): Step {
  if (record.status === "closed") {
    return { kind: "rest" };
  }
  if (record.status === "awaiting_human" || policy.autonomy === "ask_every_iteration") {
    return { kind: "ask_human", about: record.id };
  }
  // A ceiling that is not a count cannot be compared against one, and every
  // comparison with `NaN` is false -- so an unusable bound would read as "no
  // bound reached yet", every time, forever. `Infinity` and a fractional limit
  // are the same problem more quietly. `LoopPolicy.maxIterations` is a plain
  // `number` because that is what a caller writes; this is where the type's
  // looseness is answered, and it is answered by stopping and asking, which is
  // what the loop does whenever it does not know.
  if (!Number.isSafeInteger(policy.maxIterations) || policy.maxIterations < 0) {
    return { kind: "ask_human", about: record.id };
  }
  if (!Number.isSafeInteger(record.attempts) || record.attempts < 0) {
    return { kind: "ask_human", about: record.id };
  }
  // The ceiling is the policy's *other* bound, and it has to be read here or it
  // is not a bound at all -- a policy that says `maxIterations: 0` and still
  // authorises an iteration is worse than one that never claimed a ceiling.
  // Reaching it is not an error: it is the loop doing what it exists to do,
  // which is stop and ask.
  if (record.attempts >= policy.maxIterations) {
    return { kind: "ask_human", about: record.id };
  }
  return { kind: "iterate", attempt: record.attempts + 1 };
}
