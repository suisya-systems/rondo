/**
 * The loop's planner: what to do next, without doing any of it.
 *
 * A total function from `(state, policy)` to a transition -- an **edge
 * relation**, not a control-flow loop. Nothing in this module iterates; `while`
 * and `for` do not appear in it, and what re-enters the conductor is not a loop
 * body but an external event. That is D-0019 rule 6: the state graph's
 * discipline -- named states, an explicit and closed edge relation, a durable
 * checkpoint at every node -- without a graph runtime, because the runtime's
 * distinguishing feature is fan-out and fan-out is refused upstream by
 * continuo's single global `outbox-delivery` lease (D-0012).
 *
 * It touches no clock, no filesystem and no network, and it never will: the
 * layer's external allowance in `test/architecture/import-boundaries.test.ts`
 * is *empty*, which refuses the hazards nobody has thought of yet as well as
 * the ones that have names. The effects live in `./interpreter.ts` and arrive
 * there as injected ports (D-0019 rule 1), so this file stays the thing that
 * can be tested by handing it a record.
 *
 * **`iterate` is gone**, and its absence is a decision rather than an
 * oversight. It named the one edge an iterative controller needs -- "failed, go
 * round again" -- and that edge does not exist in lap 1: `lap perform` cannot be
 * re-entered on an admitted run, and a second attempt needs a fresh (run id,
 * topic branch, workspace) triple that D-0012 records nothing allocates. So the
 * lap-1 loop executes each edge at most once, and a variant standing for a
 * transition nothing can take would be a promise the machine cannot keep. It
 * returns with the allocator, as that change's decision.
 */
import type { IterationRecord } from "../store/records.js";

import { CONSERVATIVE_POLICY, type LoopPolicy } from "./policy.js";

/**
 * What the loop decided to do next, without doing any of it.
 *
 * Eight variants naming the transitions of the lap-1 arc. The interpreter's
 * `switch` over them is exhaustive, which under this repository's TypeScript
 * settings (D-0002) makes a variant added and not handled a compile error
 * rather than a runtime surprise.
 */
export type Step =
  /** Nothing to do; the loop is at rest. */
  | { readonly kind: "rest" }
  /** A human has to answer before anything else happens, and there is no gate
   *  for anything to observe: a policy stop, a corrupt row, or a state a
   *  restart must not act on. The interpreter files these at `stalled`. */
  | { readonly kind: "ask_human"; readonly about: string }
  /** No iteration exists and the policy permits one: commit the row. */
  | { readonly kind: "reserve" }
  /** Ask cadenza whether this action is within the contract. */
  | { readonly kind: "classify"; readonly about: string }
  /** Verify the continuo build, record what it observed, and admit the run. */
  | { readonly kind: "admit"; readonly about: string }
  /** Walk one lap. The one step that takes minutes. */
  | { readonly kind: "perform"; readonly about: string }
  /** Observe the gate once. Idempotent, and safe to take on a gate that is
   *  still open (D-0019 rule 5). */
  | { readonly kind: "observe_gate"; readonly about: string }
  /** The gate reached an outcome; tell the human what happened, and that
   *  publishing is still theirs (D-0010). */
  | { readonly kind: "report"; readonly about: string };

/**
 * The next step, given the state and a policy.
 *
 * **`null` is "no iteration exists yet"**, and it is where the policy is read.
 * That is D-0019 rule 9 and it is load-bearing rather than tidy: `nextStep`
 * under `ask_every_iteration` refuses, and a conductor that reserved first and
 * asked second would hold the single-flight lock on an iteration whose only
 * exit is a human -- for a *policy stop*, which is an ordinary configured
 * outcome and not an incident. Refused before reservation it costs nothing: no
 * row, no lock, and a caller that gets an immediate answer naming the policy
 * that produced it.
 *
 * **Both axes are read here and nowhere else.** What is dormant in lap 1 is
 * their *post-admission* meaning, for D-0012's reason: with one lap per request
 * `maxIterations` never bounds a *second* iteration because there is never one,
 * and `ask_before_landing` never permits an unattended landing because rondo
 * cannot land at all (D-0010). The axes are still enforced -- as an admission
 * policy -- and that distinction is what keeps "the policy is dormant" from
 * being read as "the policy is ignored".
 */
export function nextStep(
  record: IterationRecord | null,
  policy: LoopPolicy = CONSERVATIVE_POLICY,
): Step {
  if (record === null) {
    return admissionStep(policy);
  }
  // A count that is not a count is a row rondo cannot vouch for, and it stops
  // here whatever the status says. The ceiling has exactly one reader now
  // (D-0019 rule 9, at admission), so this is no longer a bound being compared
  // -- it is the record failing to read, and the answer to that is the answer to
  // every other unreadable field: halt and ask, which the interpreter files at
  // `stalled`. Dropping the check when the comparison moved would have quietly
  // let a row edited out of band drive a lap on the strength of its status
  // alone.
  if (!Number.isSafeInteger(record.attempts) || record.attempts < 0) {
    return { kind: "ask_human", about: unknownStatusId(record) };
  }
  switch (record.status) {
    case "planned":
      return { kind: "classify", about: record.id };
    case "classified":
      return { kind: "admit", about: record.id };
    case "admitted":
      return { kind: "perform", about: record.id };
    case "awaiting_human":
    case "withdrawal_requested":
      // The gate is open, or its close has been asked for. Either way the one
      // thing rondo may do is look, and `resume()` is what takes this edge --
      // the interpreter does not walk into it on its own, because after
      // `performing` the conductor returns and the process may exit.
      return { kind: "observe_gate", about: record.id };
    case "admitting":
    case "performing":
      // **Stop and report; the row keeps the lock.** A restart found an effect
      // in flight, and neither is safe to re-send: `run admit` refuses a
      // duplicate run id and relying on that refusal to discover what happened
      // is guessing with a mutating verb, and `lap perform` cannot be re-entered
      // on an admitted run while a fenced child may still be alive with nobody
      // polling it. A person settles both with `abandon()` (D-0019 rule 10).
      return { kind: "ask_human", about: record.id };
    case "stalled":
      return { kind: "ask_human", about: record.id };
    case "closed":
      // The gate reached an outcome, and there is one thing left that is not an
      // effect: saying so. The report names the outcome, the run id, the
      // continuo revision that drove it and -- plainly -- that the run row is
      // still `created`, that nothing was pushed, and that publishing is the
      // operator's (D-0010).
      return { kind: "report", about: record.id };
    case "abandoned":
    case "failed":
      // Terminal and already explained: the reason was recorded and handed back
      // at the moment of the transition, and there is nothing further to do.
      return { kind: "rest" };
    default:
      // A status string the union does not cover, read out of a database rondo
      // does not have exclusive authorship of. It halts and asks, which is the
      // rule this function has always applied whenever it does not know.
      return { kind: "ask_human", about: unknownStatusId(record) };
  }
}

/**
 * Whether a fresh iteration may be reserved at all.
 *
 * Both bounds are read, because a bound nothing consults is not a bound. A
 * fresh iteration has zero attempts, which is why `maxIterations: 0` refuses
 * here: a policy that says "no unattended iterations" and then authorises one
 * is worse than a policy with no ceiling at all.
 */
function admissionStep(policy: LoopPolicy): Step {
  if (policy.autonomy === "ask_every_iteration") {
    return { kind: "ask_human", about: "a new request" };
  }
  // A ceiling that is not a count cannot be compared against one, and every
  // comparison with `NaN` is false -- so an unusable bound would read as "no
  // bound reached yet", every time, forever. `Infinity` and a fractional limit
  // are the same problem more quietly. `LoopPolicy.maxIterations` is a plain
  // `number` because that is what a caller writes; this is where the type's
  // looseness is answered, and it is answered by stopping and asking, which is
  // what the loop does whenever it does not know.
  if (!Number.isSafeInteger(policy.maxIterations) || policy.maxIterations < 1) {
    return { kind: "ask_human", about: "a new request" };
  }
  return { kind: "reserve" };
}

/**
 * The id to name in a refusal about a record whose status did not read.
 *
 * The `default` branch above has already established that the record is not one
 * this function understands, so its `id` is not to be trusted either -- but it
 * is the only handle a person has on the row, so it is carried through when it
 * is a string and described when it is not.
 */
function unknownStatusId(record: IterationRecord): string {
  return typeof record.id === "string" && record.id !== "" ? record.id : "an unreadable row";
}
