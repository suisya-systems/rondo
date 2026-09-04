/**
 * What the loop is allowed to decide on its own.
 *
 * A pure description. `src/refrain/` is the directory Issue #1 reserves for the
 * loop, and the property the boundary test defends is that nothing in it can
 * reach an HTTP server, a browser, a session provider or continuo's internals:
 * its external allowance is empty, so the loop can only ever be a function of
 * what it was handed. Naming the policy here rather than in an access point is
 * what makes that possible -- a policy read from a request is a policy the loop
 * cannot be tested against.
 */

/** How far the loop may go before a human has to answer. */
export type Autonomy =
  /** Every iteration stops at a closed gate. */
  | "ask_every_iteration"
  /** The loop may iterate; landing anything is still a human's call. */
  | "ask_before_landing";

/** The bound on unattended action, as the loop reads it. */
export interface LoopPolicy {
  readonly autonomy: Autonomy;
  /** Hard ceiling on iterations before the loop stops and asks. */
  readonly maxIterations: number;
}

/**
 * The policy a loop runs under when nobody has said otherwise.
 *
 * The conservative end of both axes. A default that iterated unattended would
 * be a decision about unattended action taken by a skeleton, and rondo's whole
 * premise is that the human is the resident process's counterpart.
 */
export const CONSERVATIVE_POLICY: LoopPolicy = Object.freeze({
  autonomy: "ask_every_iteration",
  maxIterations: 1,
});
