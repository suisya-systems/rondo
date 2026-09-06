/**
 * The second lap: what a person's "revise" at the gate turns into.
 *
 * `gate_options` has said `["approve", "revise"]` since the first dogfood run,
 * and until this module existed the second word bought nothing. `rondo answer`
 * carried whatever a person typed to continuo, the gate closed
 * `answered_and_forwarded` either way, and the iteration reached terminal
 * `closed` -- so a person who wanted the work changed had to write a fresh
 * thirty-two-field plan by hand, pick three new identifiers, and know without
 * being told that the next lap's `base_branch` has to be the last lap's
 * `topic_branch` or the work starts from nothing. This module is the *what* of
 * that; `src/access/cli.ts`'s `revise` command is the *when*.
 *
 * **A revision is a new iteration, not a resumed one.** `advisory.md`'s `A-10`
 * settles this and gives the reason in one line -- *"resuming would mean
 * re-entering a terminal state, which `D-0019` rule 10's edge relation refuses.
 * Lineage costs a join; revival costs the invariant"*. So nothing here reopens
 * the predecessor's row, `src/refrain/loop.ts` grows no back edge, and the
 * successor walks the ordinary arc from `planned`. The absent `iterate` edge
 * stays absent, which is what `parallel-admission.md`'s `N-19` asks of anything
 * that is not the allocator.
 *
 * **What is inherited is the base branch, and it is not the triple.** The
 * obvious reading -- `A-17`, *"the retry reuses the predecessor's (run id,
 * topic branch, workspace)"* -- does not apply here and says so itself: it is
 * scoped to route S, where `D-0019` rule 15 stopped a `needs_approval`
 * **before** admission so *"the triple is unused, not spent"*, and it records
 * that a widening over an **admitted** run is *"out of scope in lap 1 ... its
 * first consumer arrives with the allocator or with a resumable lap, not
 * here"*. A gate is open only after a lap actually ran, so a revision is always
 * the admitted case, and the triple is spent in the strongest sense continuo
 * has: at the pinned revision `src/workspace/materializer.ts` documents
 * `topicBranch` as *"Must not already exist"* and `workspace` as *"Absolute
 * path the worktree is created at. Must not exist"*, and `continuo D-0057`
 * refuses a second materialisation of the same run. Three fresh identifiers are
 * therefore not a preference, they are the only thing continuo will accept.
 *
 * What makes the next lap a continuation rather than a restart is the one field
 * that is inherited **across** the fresh triple: the successor's `baseBranch`
 * is the predecessor's `topicBranch`, so the worktree git cuts is cut from the
 * commits the first lap made. Nothing is pushed to reach them (`D-0010`); the
 * branch is in the same repository the first workspace was cut from.
 *
 * **rondo still mints nothing** (`D-0019` rule 3, `D-0012`). The three
 * identifiers are the caller's, exactly as `start`'s are, and this module
 * refuses rather than derives when one is missing or repeats a spent one. When
 * the allocator of `D-0023` lands, `revisionPlan` is one of the two call sites
 * that stop taking them -- and until it does, a module that guessed a topic
 * branch would be taking that decision inside an implementation diff.
 */
import type { IterationRecord } from "../store/records.js";

import { type PlanOutcome, type RunPlan, readPlan, runPlan } from "./plan.js";

/**
 * Everything a second lap needs that the first lap's row does not already hold.
 *
 * Four values, and the asymmetry between them is the point: the three
 * identifiers are the operator's because rondo allocates none, and the
 * instruction is the operator's because rondo composes no answer on a person's
 * behalf (`D-0009`). Every one of the remaining twenty-eight plan fields comes
 * off the predecessor's row.
 */
export interface RevisionRequest {
  /** The row whose gate a person has just answered with a change to make. */
  readonly predecessor: IterationRecord;
  /** The successor's run id. Fresh: continuo holds a run under the old one. */
  readonly runId: string;
  /** The successor's topic branch. Fresh: git holds a branch under the old one. */
  readonly topicBranch: string;
  /** The successor's workspace. Fresh: a worktree stands at the old path. */
  readonly workspace: string;
  /** What the person asked for, byte for byte as they wrote it. */
  readonly instruction: string;
}

/**
 * The successor's plan, or the first reason there is not one.
 *
 * {@link PlanOutcome}'s own two arms rather than a third union: what this
 * function produces is a plan, and a caller that already knows how to report a
 * refused plan should not have to learn a second vocabulary to report a refused
 * revision.
 */
export function revisionPlan(input: RevisionRequest): PlanOutcome {
  const previous = readPlan(input.predecessor.plan);
  if (previous.kind !== "planned") {
    return {
      kind: "refused",
      reason:
        `the plan on iteration '${input.predecessor.id}' will not read back, so there is ` +
        `nothing to revise: ${previous.reason}`,
    };
  }
  const plan = previous.plan;

  // **The three refusals continuo would otherwise raise after a worktree
  // existed.** Each names the field, what it repeats, and which of continuo's
  // rules it would hit -- because an operator who reuses one has made a
  // reasonable mistake (the whole point of a revision is that the work
  // continues) and deserves to be told why the thing that continues is the base
  // branch and not the identifier.
  const repeated = repeatedIdentifier(input, plan);
  if (repeated !== null) {
    return { kind: "refused", reason: repeated };
  }

  // **An absolute deadline cannot be inherited, and rondo will not invent a new
  // one.** `gateDeadlineAtMs` is an instant and not a duration, so the
  // predecessor's is behind the second lap before it starts: carried forward it
  // would open a gate that was already past its deadline, and the person who
  // asked for the revision would be the one to discover it. Shifting it would
  // mean rondo choosing how long a human has to answer, which is the operator's
  // patience and not rondo's (the same argument `invocationCeilingMs` makes).
  // So this is refused, plainly, and the way through it is an edited plan and
  // `start` -- which is the state every revision was in before this module.
  if (plan.gateDeadlineAtMs !== null) {
    return {
      kind: "refused",
      reason:
        `the plan on iteration '${input.predecessor.id}' sets 'gateDeadlineAtMs' to ` +
        `${String(plan.gateDeadlineAtMs)}, which is an instant rather than a duration and is ` +
        "already behind a second lap. rondo will not carry it forward and will not choose a " +
        "new one, because how long a person has to answer is the operator's declared patience. " +
        "Run the revision with 'rondo start' against a plan whose deadline you have set.",
    };
  }

  return runPlan({
    ...plan,
    runId: input.runId,
    topicBranch: input.topicBranch,
    workspace: input.workspace,
    // The whole of the continuation, in one field. See this module's header.
    baseBranch: plan.topicBranch,
    // **And the whole of what that costs, in the field beside it.** The branch
    // this lap is cut from is not the branch its pull request may be opened
    // against: the predecessor's topic branch is local to the machine that ran
    // the lap and is never pushed (`D-0010`), so a pull request against it would
    // name a branch no forge has. `publish` reads this instead, and `?? ` rather
    // than an assignment is what makes a chain of revisions carry the *first*
    // lap's base all the way along instead of walking back one link.
    pullRequestBaseBranch: plan.pullRequestBaseBranch ?? plan.baseBranch,
    prompt: revisionPrompt(plan, input),
    // `parties.grantee` is the run id spelled a second time, and `runPlan`
    // refuses a plan where the two disagree -- so a successor that kept the
    // predecessor's grantee would be refused here rather than answered
    // `grantee_mismatch` by cadenza after the row was reserved. `loadPlan`
    // rewrites the same field for the same reason when `start` overrides
    // `--run-id`; this is that rule applied to the one other place a run id can
    // change.
    parties: { ...plan.parties, grantee: input.runId },
  });
}

/**
 * The prompt the second lap runs, which is the first lap's with the revision
 * on the end.
 *
 * **Appended rather than replaced.** The instruction a person types at a gate
 * is a delta -- "use the existing helper", "the tests are wrong" -- and a
 * worker handed only the delta has lost the request it is a delta of. So the
 * original request stays first and stays verbatim, and what follows says three
 * things the second worker cannot otherwise know: that a previous lap ran, what
 * was asked of it, and that its work is already on the branch this workspace
 * was cut from.
 *
 * **ASCII only** (`D-0004`), like everything else rondo composes: this string
 * reaches continuo's command line and a cp932 console on the Windows cell.
 */
function revisionPrompt(plan: RunPlan, input: RevisionRequest): string {
  return [
    plan.prompt,
    "",
    "--- Revision requested at the gate ---",
    "",
    `A previous lap (run '${plan.runId}', iteration '${input.predecessor.id}') did this work and` +
      " stopped at a gate. A person read it and asked for a change:",
    "",
    input.instruction,
    "",
    `That lap's commits are already on '${plan.topicBranch}', which is the branch this` +
      " workspace was cut from. Continue from them rather than starting the request over.",
  ].join("\n");
}

/**
 * The first identifier the successor repeats from the predecessor, described.
 *
 * Null when all three are fresh. Checked against the plan the predecessor
 * actually ran under rather than against the row's `run_id` column, because the
 * plan is the thing continuo was handed: the column is written from it and
 * agreeing with a copy is weaker than agreeing with the original.
 */
function repeatedIdentifier(input: RevisionRequest, plan: RunPlan): string | null {
  if (input.runId === plan.runId) {
    return (
      `'runId' is '${input.runId}', which is the run the previous lap was admitted under. ` +
      "continuo holds that run and refuses a second materialisation of it (continuo D-0057), " +
      "so a revision needs a run id of its own. What continues across the two laps is the " +
      "branch, not the identifier."
    );
  }
  if (input.topicBranch === plan.topicBranch) {
    return (
      `'topicBranch' is '${input.topicBranch}', which the previous lap created. continuo ` +
      "requires a topic branch that does not already exist, and this one holds the work the " +
      "revision continues from -- it is the successor's 'baseBranch', which rondo sets for you."
    );
  }
  if (input.workspace === plan.workspace) {
    return (
      `'workspace' is '${input.workspace}', where the previous lap's worktree still stands. ` +
      "continuo creates the worktree and requires the path not to exist, so the revision needs " +
      "a directory of its own."
    );
  }
  return null;
}
