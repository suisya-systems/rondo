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

/**
 * The bounds one host admits under (D-0023 rule 12).
 *
 * **Read once at the composition root, never from a request.** `admit()` takes
 * a {@link LoopPolicy} per call, so a bound placed there would be a bound each
 * request states about the whole host, and "the bound" would become whichever
 * caller arrived last. A host-wide limit that any request may restate is not a
 * limit. This is a deployment fact and belongs beside the other deployment
 * facts -- the database's path, its journal mode -- in the one place that knows
 * them.
 *
 * **{@link LoopPolicy.maxIterations} is not either of these numbers, and the
 * confusion is one rename away.** It is a hard ceiling on attempts *of one
 * request*, compared against a fresh iteration's zero attempts before any row
 * exists; these bound *concurrent requests*. Different axes with different
 * owners, and `CONSERVATIVE_POLICY`'s `maxIterations: 1` must not quietly
 * become a concurrency bound of one.
 *
 * Structurally identical to `HostPolicy` in `src/store/sqlite.ts`, which is the
 * store's own statement of the same contract; `src/access/conductor.ts` is
 * where the two are checked against each other, the way the port and the store
 * already are.
 *
 * The durable, operator-editable form of this -- a row rondo's web UI edits
 * rather than a value fixed until restart -- is named and deliberately not
 * taken here (D-0023 rule 13). A resident host that must be restarted to change
 * its own concurrency is a poor resident host, but that is D-0020's operating
 * surface, and taking it here would settle a surface decision inside a
 * scheduling one.
 */
export interface HostPolicy {
  /**
   * How many iterations may be executing at once.
   *
   * **One, until continuo's `D-1104` lands its holder-identity half and not
   * merely its column.** continuo serialises `lap perform` on a single global
   * delivery resource, so a second concurrent lap is refused there rather than
   * here; raising this number before that is a host that admits work continuo
   * will refuse. Once it lands, this is a policy edit and not a code change.
   */
  readonly maxOccupying: number;
  /**
   * How many iterations may be non-terminal at once.
   *
   * **This one may exceed one today, with no continuo change at all**, which is
   * the whole of what D-0023 delivers now. An iteration suspended at a gate
   * holds no continuo lease, no process and no fenced child: it is a durable
   * row in front of a person. What it bounds is the leak a suspended iteration
   * leaves -- a worktree, a branch, an open run, an unanswered question.
   */
  readonly maxLive: number;
}

/**
 * The bounds a host runs under when nobody has said otherwise.
 *
 * `maxLive` is three rather than one because the default that matches lap 1's
 * measured shape is "one lap at a time, several questions open at once": the
 * lock was held for a lap plus an unbounded human wait, and it is the second
 * term this bound releases. It is not a claim that three is the right number
 * for any particular host -- {@link hostPolicy} is how an operator says
 * otherwise, and D-0023 rule 14's refusal rows are how a later reader learns
 * whether the number was ever binding.
 */
export const CONSERVATIVE_HOST_POLICY: HostPolicy = Object.freeze({
  maxOccupying: 1,
  maxLive: 3,
});

/** A host policy rondo accepted, or the reason it is not one. */
export type HostPolicyOutcome =
  | { readonly kind: "accepted"; readonly policy: HostPolicy }
  | { readonly kind: "refused"; readonly reason: string };

/**
 * Validate a pair of bounds (D-0023 rule 8).
 *
 * **`maxLive >= maxOccupying` is a validated constraint rather than a
 * convention**, because the other way round is not merely tight, it is
 * unsatisfiable: `maxLive` would refuse admissions the execution bound was
 * willing to run, so the host could never reach the concurrency it was
 * configured for. A configuration that cannot be satisfied is worth refusing at
 * the moment it is read rather than at the moment it silently binds.
 *
 * Both bounds must be at least one. A bound of zero is a host that admits
 * nothing, which is indistinguishable from a host that is broken and is better
 * said with a stopped process than with a refusal on every request.
 */
export function hostPolicy(input: HostPolicy): HostPolicyOutcome {
  for (const name of ["maxOccupying", "maxLive"] as const) {
    const value = input[name];
    if (!Number.isInteger(value) || value < 1) {
      return {
        kind: "refused",
        reason: `'${name}' is ${String(value)}, and a bound on concurrent work is a whole number of at least one`,
      };
    }
  }
  if (input.maxLive < input.maxOccupying) {
    return {
      kind: "refused",
      reason:
        `'maxLive' is ${String(input.maxLive)} and 'maxOccupying' is ${String(input.maxOccupying)}: ` +
        "the bound on non-terminal iterations cannot be lower than the bound on executing ones, " +
        "because every executing iteration is also non-terminal, so this host could never reach " +
        "the concurrency it was configured for",
    };
  }
  return { kind: "accepted", policy: Object.freeze({ ...input }) };
}
