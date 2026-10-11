/**
 * The plan files setup left beside the store unrecorded (D-0191 rule 2.2).
 *
 * **One directory, one level, one name pattern.** Setup writes
 * `plan-<project>.json` beside the store it exports as `RONDO_STORE`, and its
 * last step records them there; when that step did not happen the files are
 * the plans it would have recorded. This module lists that directory and
 * nothing else, and every file still passes the plan reader before a press
 * records it.
 */

import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { readRunPlan } from "../refrain/plan.js";
import type { JsonRecord } from "../store/records.js";
import { readPlanDocument } from "./cli.js";
import { agentTypeRecordOf } from "./scope.js";

/**
 * **Setup's plan files beside the store** (D-0191 rule 2.2): `plan-*.json` in
 * the directory of `RONDO_STORE`, which setup writes before its last step
 * records them there. Only those `rondo setup-plan` would accept -- the plan
 * reads, is no revise lap's, and its agent type builds a record -- by name.
 * Anything unreadable is left out, never thrown: the page renders over it.
 */
export function setupPlanFiles(
  storePath: string,
): readonly { readonly file: string; readonly plan: JsonRecord }[] {
  const directory = dirname(storePath);
  let names: string[];
  try {
    names = readdirSync(directory).filter((name) => /^plan-[^/\\]+\.json$/.test(name));
  } catch {
    return [];
  }
  return names.sort().flatMap((name) => {
    const file = join(directory, name);
    const read = readPlanDocument(file);
    if ("refusal" in read) {
      return [];
    }
    const planned = readRunPlan(read.document);
    if (planned.kind !== "planned" || planned.plan.pullRequestBaseBranch !== null) {
      return [];
    }
    return "refusal" in agentTypeRecordOf(planned.plan, read.document)
      ? []
      : [{ file, plan: read.document }];
  });
}
