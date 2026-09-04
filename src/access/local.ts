/**
 * An access point: something outside asks the loop a question.
 *
 * `src/access/` is where the web UI and the localhost MCP surface will live.
 * Both are out of scope for Issue #1, so this module stands in for the shape
 * they share -- an access point may reach the loop, and the loop may never
 * reach back. The boundary test enforces exactly that asymmetry, which is why
 * this file imports `src/refrain/` and `src/refrain/` imports nothing from
 * here.
 *
 * The name is `local` because the first access point is in-process. When the
 * HTTP one arrives it gets its own module and its own entry in the external
 * allowance; the allowance is per module, so granting `node:http` to a server
 * does not grant it to the loop.
 */
import { nextStep, type Step } from "../refrain/loop.js";
import type { IterationRecord } from "../store/records.js";

/**
 * Ask the loop what it would do next.
 *
 * The whole of the access point's job: translate an outside question into the
 * loop's vocabulary and hand the answer back. It adds no policy of its own,
 * because a policy applied here would be one the loop could not be tested
 * against.
 */
export function describeNextStep(record: IterationRecord): Step {
  return nextStep(record);
}
