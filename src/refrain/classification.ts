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
  type ResolvedProject,
  resolveProject,
} from "../cadenza/facade.js";

import type { AdmittedPlan } from "./plan.js";
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
export function classifyPlan(plan: AdmittedPlan): EffectOutcome<ClassificationRecord> {
  try {
    const project = resolveProject(plan.catalogLayers, plan.projectName);
    const disagreement = catalogDisagreement(plan, project);
    if (disagreement !== null) {
      return { kind: "refused", message: disagreement };
    }
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
        // The other half of the same policy, read here for the same reason and
        // mapped in the same layer: `roleName` says what the executor is for,
        // `modelTier` says what it costs, and neither is spelled in continuo's
        // vocabulary until the invocation adapter spells it (D-0021).
        modelTier: record.executorPolicy.modelTier,
      },
    };
  } catch (error) {
    return { kind: "refused", message: cadenzaMessage(error) };
  }
}

/**
 * The one thing rondo checks *about* cadenza's answer rather than reading out
 * of it: that the catalog and the lap are talking about the same repository.
 *
 * **Two fields of the plan say the same thing, and nothing compared them.** The
 * lap is cut from `plan.repository` -- continuo's input, the directory a
 * workspace is materialised from -- while the contract is issued against the
 * project cadenza resolved out of `plan.catalogLayers`. When that project's
 * source is a `local_path`, the two are the same repository stated twice, and a
 * plan where they disagree is a plan whose contract was issued about one
 * repository and whose worker is turned loose in another. Before this check
 * nothing noticed: the run was admitted, a worker was spawned, and the
 * disagreement was discovered by reading the commits it left in the wrong
 * place (rondo #72).
 *
 * **It refuses rather than choosing a winner.** Picking one field as the truth
 * would be rondo inferring a plan's contents, which `D-0025` rule 5 says it does
 * not do; the plan file is the whole of the configuration and this is the plan
 * file being self-contradictory. Deriving one from the other belongs to whoever
 * *writes* the plan -- `scripts/dogfood-env.sh` writes all four places from one
 * `--target-repo` -- and this is the backstop under a plan written by hand.
 *
 * **Where it fires matters as much as what it says.** This is the `classify`
 * step, which is before `admit`: no run exists at continuo yet, no fence has
 * been rendered and no worker has been spawned. The iteration ends at terminal
 * `abandoned` the way cadenza's own refusals do (D-0019 rule 15), having cost a
 * row and nothing else.
 *
 * `null` when there is nothing to say, which is every plan whose source is a
 * `git_url` or a `new` -- neither of those names a directory on this machine, so
 * neither is the same statement as `repository` and neither is compared.
 */
function catalogDisagreement(plan: AdmittedPlan, project: ResolvedProject): string | null {
  if (project.source.kind === "local_path" && !samePath(project.source.path, plan.repository)) {
    return (
      `the plan disagrees with itself about which repository this is: 'repository' is ` +
      `'${plan.repository}', and project '${plan.projectName}' in the catalog has ` +
      `source.path '${project.source.path}'. Both name the repository a lap is cut from, so ` +
      `they have to be the same directory`
    );
  }
  // **Only on a first lap.** A revision is cut from its predecessor's topic
  // branch rather than from the project's base branch -- that is what makes it
  // a continuation and not a restart (D-0027) -- and it carries the branch the
  // first lap was cut from in `pullRequestBaseBranch`. So a second lap's
  // `baseBranch` differing from the catalog's is correct, and comparing it
  // would refuse every revision rondo runs.
  if (plan.pullRequestBaseBranch === null && project.baseBranch !== plan.baseBranch) {
    return (
      `the plan disagrees with itself about which branch this lap is cut from: 'base_branch' ` +
      `is '${plan.baseBranch}', and project '${plan.projectName}' in the catalog has ` +
      `base_branch '${project.baseBranch}'`
    );
  }
  return null;
}

/**
 * Whether two absolute paths name the same directory, lexically.
 *
 * `src/refrain/`'s external allowance is empty -- no `node:path`, by design --
 * so this is the comparison rather than `resolve()`. It has to be a real
 * normalisation rather than a string equality, because the two sides arrive
 * spelled by two different rules: cadenza runs its `local_path` through a
 * `normpath` (no trailing separator, no `.` segment, no doubled separator),
 * while `readPlan` checks `repository` is absolute and otherwise keeps whatever
 * the operator typed. A plan that said `/srv/repo/.` in both places would
 * otherwise be refused for disagreeing with itself, which is the opposite of
 * this check's purpose.
 *
 * **Lexical, and nothing else.** No symlink is resolved and nothing is stat'd,
 * for cadenza's own reason: this has to give the same answer in CI on a machine
 * that has none of these directories. Two paths that reach one directory
 * through a symlink are therefore *not* folded together here, and the refusal
 * that follows names both spellings, which is the failure an operator can act
 * on.
 *
 * Case is deliberately not folded either. A fold would call two paths the same
 * on a case-sensitive filesystem where they are not, and the direction of that
 * error is the wrong one for a check that exists to catch a disagreement.
 */
function samePath(left: string, right: string): boolean {
  return normalisePath(left) === normalisePath(right);
}

/**
 * Whether a path is spelled in Windows's own shape: a drive letter, or a UNC
 * root.
 *
 * The same decision-by-shape `plan.ts`'s `isAbsolutePath` makes, and for the
 * same reason: `path.sep` answers for the platform this process is running on,
 * which is the wrong question to ask about a path written into a plan. It
 * governs one thing here -- whether a backslash is a separator. On Windows it
 * is; on POSIX `\` is an ordinary character in a file name, so folding it would
 * make `/srv/a\b` and `/srv/a/b` compare equal when they are two directories.
 */
function isWindowsShaped(value: string): boolean {
  return /^(?:\\\\|[A-Za-z]:[\\/])/.test(value);
}

/**
 * One absolute path, lexically normalised: cadenza's `normpath` as far as two
 * paths need it to be compared.
 *
 * Empty and `.` segments are dropped, `..` pops the segment before it (and is
 * dropped at the root, which is what an absolute path means), and the prefix --
 * `/`, a drive, a UNC root -- is kept as it was written.
 */
function normalisePath(value: string): string {
  const windows = isWindowsShaped(value);
  const unified = windows ? value.replace(/\\/g, "/") : value;
  const slash = unified.indexOf("/");
  // Everything up to and including the first separator is the root, and it is
  // never a segment: dropping it would turn an absolute path into a relative
  // one and would compare two different drives as the same directory.
  const prefix = unified.slice(0, slash + 1);
  const segments: string[] = [];
  for (const segment of unified.slice(slash + 1).split("/")) {
    if (segment === "" || segment === ".") {
      continue;
    }
    if (segment === ".." && segments.length > 0) {
      segments.pop();
      continue;
    }
    if (segment === "..") {
      continue;
    }
    segments.push(segment);
  }
  return prefix + segments.join("/");
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
