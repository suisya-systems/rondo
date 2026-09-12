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
  type AgentType,
  agentTypeRecord,
  classifyAction,
  issueInitialContract,
  normalisePath,
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
    const tierDisagreement = unpricedModelTier(record);
    if (tierDisagreement !== null) {
      return { kind: "refused", message: tierDisagreement };
    }
    const fenceDisagreement = grantDisagreement(plan, record);
    if (fenceDisagreement !== null) {
      return { kind: "refused", message: fenceDisagreement };
    }
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
 * The tiers rondo prices, transcribed from `src/continuo/roles.ts`'s
 * `MODEL_TIER_TABLE` -- the *keys* only, and nothing about what any of them
 * cost (D-0052 rule 3).
 *
 * **Why a transcription and not an import.** `src/refrain` may not import
 * `src/continuo` (D-0017 rule 2), and this is the same move `SERVED_RECIPIENTS`
 * in `./plan.ts` already makes for continuo's outbox: a frozen list of names
 * held in the loop, with the revision it agrees with proved by a test rather
 * than by an arrow. `test/continuo/roles.test.ts` asserts this list equal, as a
 * set, to `mappedModelTiers()` -- both directions, because a name only here
 * would refuse a tier rondo can in fact run, and a name only in the table would
 * admit a lap onto a tier with no price (D-0052 rule 4).
 *
 * A tier name is a cadenza neutral name and already crosses this boundary on
 * `ClassificationRecord.modelTier`; no model id is added here (D-0014 rule 1).
 */
export const PRICED_MODEL_TIERS = Object.freeze(["standard"] as const);

/**
 * The third thing rondo checks about its own inputs: that the agent type names
 * a model tier rondo prices (D-0052).
 *
 * **Why this and not `mapModelTier` itself.** `mapModelTier` lives in
 * `src/continuo/roles.ts` and answering with it here would be the arrow D-0052
 * declines. This function asks the same question in the loop's own vocabulary,
 * off the record cadenza already built -- the tier is read from
 * `record.executorPolicy.modelTier` and never from `plan.agentTypeInput`, for
 * `grantDisagreement`'s reason: the record is what cadenza validated.
 *
 * **A refusal, not a defect.** Before this rule the same fact reached
 * `performLap`'s `mapModelTier` after `run admit`, with a run already admitted
 * at continuo and nobody to close it. Answering here ends the iteration at
 * terminal `abandoned`, before `startContinuo`, before a build is verified,
 * before `run admit` -- rondo#138's falsifier, answered before the row that
 * falsified it.
 */
function unpricedModelTier(record: AgentType): string | null {
  const tier = record.executorPolicy.modelTier;
  if ((PRICED_MODEL_TIERS as readonly string[]).includes(tier)) {
    return null;
  }
  return (
    `agent type '${record.agentTypeId}' names a model tier rondo does not price: '${tier}'. ` +
    `The tiers rondo prices are ${PRICED_MODEL_TIERS.join(", ")}. Give the agent type one of ` +
    "those tiers, or ratify a price for it in src/continuo/roles.ts under a new decision entry."
  );
}

/**
 * The capability key that says a lap's worker runs commands.
 *
 * cadenza's own vocabulary and spelled once here: `command.run` "names the
 * execution and never an effect", which is why it is the key the fence has to
 * agree with and why no other key is consulted.
 */
const COMMAND_RUN = "command.run";

/**
 * The second thing rondo checks *about* its own inputs: that the capability an
 * agent type grants and the fence a plan declares are the same statement
 * (D-0039 rule 3).
 *
 * **Two halves that were both real and disagreed silently.** rondo#67 ran a lap
 * whose agent type granted `command.run` and whose worker could not run
 * `npm ci --ignore-scripts`, `npm run verify`, `npm --version` or
 * `node vendor/pin.mjs check`: every one answered `This command requires
 * approval` to a `claude -p` child with nobody to ask. The plan was admitted
 * *because* it held the grant, and then rendered a fence that could not run a
 * command. D-0039 rule 2 is why the grant cannot simply *become* the allow list
 * -- a capability key says *that* commands may be run and an allow rule says
 * *which*, and deriving the second from the first would be rondo inventing a
 * command vocabulary -- so the two are stated separately and this is where they
 * are made to agree.
 *
 * **The pair is the grant and the declaration, and no longer the grant and the
 * role.** D-0039 rule 3 wrote the check over `executorPolicy.roleName`, on the
 * expectation that continuo would answer the escalation with a second
 * command-capable role for that name to point at. continuo declined that shape
 * (`continuo D-1110`, first alternative: a role is what a worker *is*, not what
 * runs it) and answered with a per-run declaration instead, which is rule 3's
 * named cost arriving -- the role turning out to be the wrong carrier -- so the
 * fence profile sits on a field of the plan's own and the refusal is stated
 * over that field. The dated annotation on D-0039 records the move; the rule's
 * text is unchanged.
 *
 * **Both directions, because either one is a plan lying about itself.** A grant
 * with nothing declared is rondo#67 exactly: a lap that may run commands under
 * a fence that allows none. A declaration with no grant is the mirror image and
 * is worse for being quiet -- the fence would be widened for a lap cadenza was
 * never asked to authorise for execution, which is a widening that appears in
 * no contract.
 *
 * **Where it fires is the point.** This is `classify`, which runs before
 * `admit`: no run exists at continuo, no fence has been rendered, no worktree
 * has been cut and no worker has been spawned. `mapNeutralRole`'s manner and
 * `mapModelTier`'s reason (D-0039 rule 3): an agent type an operator wrote,
 * answered with a value rather than a throw, before money is spent.
 *
 * `record.granted` and not `plan.agentTypeInput.granted`: the record is the set
 * cadenza validated, sorted and made unique, and reading the raw input would be
 * rondo deciding what a capability set is.
 */
function grantDisagreement(plan: AdmittedPlan, record: AgentType): string | null {
  const granted = record.granted.includes(COMMAND_RUN);
  const declared = plan.allowedBash.length > 0;
  if (granted && !declared) {
    return (
      `the plan disagrees with itself about whether this lap runs commands: agent type ` +
      `'${record.agentTypeId}' grants '${COMMAND_RUN}' and 'allowed_bash' is empty, so the ` +
      `worker would be admitted to run commands under a fence that allows none. That is the ` +
      `defect rondo#67 measured: every command came back 'This command requires approval' to a ` +
      `session with nobody to ask. Declare the commands this lap needs, or stop granting ` +
      `'${COMMAND_RUN}'`
    );
  }
  if (declared && !granted) {
    return (
      `the plan disagrees with itself about whether this lap runs commands: 'allowed_bash' ` +
      `declares ${String(plan.allowedBash.length)} subject(s) and agent type ` +
      `'${record.agentTypeId}' does not grant '${COMMAND_RUN}', so the fence would be widened ` +
      `for a capability no contract carries. Grant '${COMMAND_RUN}' on the agent type, or drop ` +
      `the declaration`
    );
  }
  return null;
}

/**
 * Whether two absolute paths name the same directory.
 *
 * Both sides go through {@link normalisePath}, which is cadenza's own
 * `normpath` -- the same function cadenza ran over the `local_path` before it
 * became a `ResolvedProject`. That is what makes this a comparison of two
 * directories rather than of two strings: `readPlan` keeps whatever spelling
 * the operator typed, so the two sides arrive normalised by different rules
 * unless one of them is applied to both.
 *
 * Case is deliberately not folded, and neither is a symlink resolved. Both
 * would call two paths the same where a case-sensitive filesystem says they are
 * not, and the direction of that error is the wrong one for a check that exists
 * to catch a disagreement: the refusal names both spellings, which is something
 * an operator can act on.
 */
function samePath(left: string, right: string): boolean {
  return normalisePath(left) === normalisePath(right);
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
