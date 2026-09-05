/**
 * The conductor's one arrow out of its own layer: `src/refrain -> src/cadenza`.
 *
 * This module is D-0019 rule 1's *only* addition to the boundary table, and it
 * is D-0018 rule 5's trigger firing: that entry left the arrow unbuilt and said
 * "the arrow arrives when conductor code consumes the facade", and this is the
 * conductor code that consumes it.
 *
 * **Why this arrow was takeable while continuo stays behind a port.** The two
 * seams were compared on one measured property and they are not alike: the
 * cadenza facade **owns no capability** -- it reads no file, no clock and no
 * network, its own header says so, and `test/cadenza/smoke.test.ts` runs the
 * whole path on in-memory fixtures in every matrix cell without provisioning
 * anything -- whereas `src/continuo/` is the one place under `src/` that starts
 * a process (D-0017). An import of the facade therefore costs `test/refrain/`
 * nothing: no build, no `spawn`, no network. An import of continuo would cost it
 * all three, which is the stated purpose of `D-0017` rule 2 that the arrow would
 * have killed. So the effects that own a capability arrive as the injected ports
 * of `./ports.ts`, and the one that owns none arrives as an import.
 *
 * **Nothing here re-implements or second-guesses cadenza** (D-0018 rule 7). The
 * four calls are made in cadenza's own order and every value in the record below
 * is one cadenza computed. rondo reads the answer; it never re-derives it.
 */
import {
  agentTypeRecord,
  classifyAction,
  issueInitialContract,
  resolveProject,
} from "../cadenza/facade.js";

import type { RunPlan } from "./plan.js";
import type { ClassificationRecord, EffectOutcome } from "./ports.js";

/**
 * cadenza's four calls, as one effect, answered in rondo's own record.
 *
 * The order is cadenza's and is not rondo's to shuffle: resolve the project,
 * build the agent-type record, issue the initial contract against both, and
 * classify the intended action against the contract.
 *
 * **`configDigest` is read off the `ResolvedProject` now, and is deliberately
 * not cached.** It is the subject's digest at the moment the question is asked,
 * which is how a contract issued against a catalog that has since moved comes
 * back `stale_subject` rather than being honoured -- cadenza checks staleness
 * *first*, before the grant is consulted at all. A digest carried over from the
 * issuance would answer the question the contract already answered and would
 * make the one check that exists to notice drift incapable of noticing it.
 *
 * **Every classification is an `answered` value here, including a refusal.**
 * cadenza's `classify()` is total and pure: `allowed`, `needs_approval` and
 * `refused` are its three return values and none of them is an exception. So
 * this port answers with all three and `./interpreter.ts` is what turns two of
 * them into a terminal `abandoned` (D-0019 rule 15). Only a **throw** -- from
 * `resolveProject`, `agentTypeRecord` or `issueInitialContract`, cadenza's own
 * refusals such as `ProjectNotFoundError` -- becomes `refused`, and it carries
 * cadenza's message untranslated: a rondo message wrapped around it would be a
 * second vocabulary for the same fault, which is the drift D-0016 warned about.
 *
 * Synchronous, because none of it waits on anything; `ConductorPorts.classify`
 * is the asynchronous shape, and the composition root in `src/access` is where
 * this function is lifted into it. Making the port synchronous instead was the
 * rejected alternative: it is the one shape a store on another process or a
 * future out-of-line classifier could not take later without changing every
 * caller, and `./ports.ts` already records that reasoning for the store.
 */
export function classifyPlan(plan: RunPlan): EffectOutcome<ClassificationRecord> {
  try {
    const project = resolveProject(plan.catalogLayers, plan.projectName);
    const record = agentTypeRecord(plan.agentTypeInput);
    const contract = issueInitialContract(record, project, plan.parties);
    const answer = classifyAction(contract, plan.intendedAction, {
      runId: plan.runId,
      configDigest: project.configDigest,
    });
    return {
      kind: "answered",
      value: {
        outcome: answer.outcome,
        reason: answer.reason,
        agentTypeDigest: record.agentTypeDigest,
        configDigest: project.configDigest,
        // cadenza's digest of the contract the answer was made under, taken
        // from the answer rather than recomputed: D-0026 puts it on the
        // `Classification` precisely so a reader can tell which contract
        // produced which verdict.
        contractDigest: answer.contractDigest,
        // D-0014's neutral role name, which the continuo layer maps onto a
        // roster name (D-0019 rule 13). It is read here and mapped there,
        // because the mapping is continuo's vocabulary and not cadenza's.
        neutralRoleName: record.executorPolicy.roleName,
      },
    };
  } catch (error) {
    return { kind: "refused", message: cadenzaMessage(error) };
  }
}

/**
 * What cadenza said, as a string, without deciding anything about it.
 *
 * Every throw becomes a `refused` rather than some of them becoming a `defect`,
 * and that is the deliberate reading of D-0018 rule 7: rondo does not sort
 * cadenza's exceptions into rondo's own severities, because doing so would mean
 * rondo had an opinion about which of cadenza's rules are the caller's fault.
 * The one thing this does is get a printable string out of a value that may not
 * be an `Error` at all -- `String()` throws on a symbol, so even that is
 * guarded.
 */
function cadenzaMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  try {
    return String(error);
  } catch {
    return "cadenza threw a value that cannot be rendered as text";
  }
}
