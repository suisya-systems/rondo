/**
 * The allocator: three identifiers derived from one iteration id (D-0023).
 *
 * `D-0012` recorded that rondo mints nothing and that a second admission needs
 * a fresh `(run id, topic branch, workspace)` triple. This module is the
 * minting half. The *remembering* half is the store's -- three partial unique
 * indexes over `holds_identifiers` in `src/store/sqlite.ts` -- and the two are
 * one decision rather than two, because releasing a suspended iteration's
 * capacity is safe only if the next iteration cannot be handed its names.
 *
 * **Pure, total and invertible.** No filesystem, no git, no continuo. The
 * alternative was to allocate against observed state -- query the `run` table,
 * `git branch --list`, `existsSync` the workspace, mint, retry on collision --
 * and it was rejected on measurement rather than on taste: it costs three I/O
 * reads on the admission path, two of them across the process boundary D-0015
 * guards, and it is *still* not authoritative, because continuo's `run admit`
 * and git's own `branchExists` remain the authority and the check-then-use
 * window stays open behind it. It buys an earlier refusal and no guarantee.
 *
 * So the division is: **collisions rondo would cause become impossible**, by
 * construction and atomically, because a derived triple is a function of an
 * iteration id and iteration ids are unique in rondo's own table. **Collisions
 * rondo did not cause** -- a person who created `rondo/iter-005` by hand --
 * keep being refused exactly where they are refused today, inside
 * `lap perform`'s materialisation, and {@link ALLOCATION_COLLISION_REMEDY} is
 * what rondo says about them in its own words.
 */

/**
 * The alphabet an iteration id must match (D-0023 rule 26).
 *
 * A lowercase letter followed by up to 63 of `[a-z0-9_-]`. **Deliberately the
 * same shape D-0019 rule 12 already holds cadenza's role names to**, so rondo
 * has one identifier shape rather than two.
 *
 * It is not decoration and it is not defensive: without it the derivation below
 * is neither contained nor injective, and both failures are ordinary rather
 * than adversarial.
 *
 *  - **Containment.** `iter-../other` under a workspace root resolves *outside*
 *    that root, and it still passes `runPlan()`'s absoluteness check, because
 *    an escaped path is absolute.
 *  - **Injectivity.** `a/../b` and `b` name one workspace, so two iteration ids
 *    would claim one directory and "an operator reading a branch name knows
 *    which iteration it is" would be false.
 *  - **Well-formedness downstream.** `rondo/a/../b` is not a branch git will
 *    create, and that refusal arrives inside `lap perform`, after continuo's
 *    run row exists for ever.
 *
 * Excluding `/`, `\`, `.` and every other separator is what makes the
 * derivation injective *by construction* rather than by an argument about
 * normalisation, and what makes all three derived values well-formed without a
 * separate rule for each.
 *
 * **This is a reduction and is recorded as one.** Ids that were legal before
 * D-0023 are illegal after it. Every id in the tree and in the dogfood record
 * already conforms (`i-0001`, `iter-005`, `lap1-dogfood-003`).
 */
export const ITERATION_ID_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;

/**
 * The prefix every derived workspace component carries (D-0023 rule 28).
 *
 * **Windows, not tidiness.** `windows-latest` is a required cell of the
 * double-green matrix, and Windows reserves `con`, `nul`, `aux`, `prn`,
 * `com1`..`com9` and `lpt1`..`lpt9` as device names in *any* path component.
 * Every one of them matches {@link ITERATION_ID_PATTERN}, so a bare component
 * would let an admissible iteration id produce a directory `git worktree add`
 * cannot create -- reproducing the post-admission failure the alphabet exists
 * to prevent, on one platform only.
 *
 * A prefix removes the entire class where a denylist has edges to keep missing:
 * a reserved name with an extension is reserved, and so is one with a trailing
 * dot or space. It also makes the three derived values consistent -- the run id
 * and the topic branch already carry prefixes, and the workspace was the only
 * bare component.
 */
const WORKSPACE_PREFIX = "iter-";

/** The prefix of every derived run id, so continuo's rows say who minted them. */
const RUN_ID_PREFIX = "rondo-";

/** The namespace every derived topic branch lives in. */
const TOPIC_BRANCH_PREFIX = "rondo/";

/** The three identifiers one iteration owns for ever once it spends them. */
export interface Allocation {
  readonly runId: string;
  readonly topicBranch: string;
  readonly workspace: string;
  /**
   * The holder continuo records in its lease audit trail.
   *
   * Derived from the run id rather than required to be fresh (D-0023 rule 6):
   * nothing measured requires a per-run claimant, and two runs may legitimately
   * name one claimant on two different lease resources. But it is the identity
   * continuo's audit trail records as "who was writing", and a constant holder
   * across N concurrent laps makes that trail unable to say which lap wrote --
   * which is a cost paid at exactly the moment N stops being one.
   */
  readonly leaseClaimantId: string;
}

/** An allocation, or the first reason the iteration id could not produce one. */
export type AllocationOutcome =
  | { readonly kind: "allocated"; readonly allocation: Allocation }
  | { readonly kind: "refused"; readonly reason: string };

/**
 * What rondo says when a name it minted is already taken by something else.
 *
 * Exported so that the interpreter and the tests state it once. The remedy is
 * rondo's own -- abandon and readmit under a different iteration id -- rather
 * than continuo's sentence about branches, because the operator's lever is the
 * iteration id and nothing in continuo's message says so.
 */
export const ALLOCATION_COLLISION_REMEDY =
  "rondo derives the run id, the topic branch and the workspace from the iteration id, so a " +
  "name that is taken by something rondo did not create is settled by abandoning this " +
  "iteration and admitting the request again under a different iteration id";

/**
 * Derive one iteration's triple, or refuse the id.
 *
 * **Called in `admit()` before `reserve()`, never after.** A value refused
 * before the row costs no row and no lock, which is the property D-0019 rule 9
 * and the dogfood's 1 ms measurement of a refusal both rest on; a value refused
 * after it leaves an iteration holding capacity until a person abandons it, for
 * an input error that was knowable before anything was written. `AGENTS.md`
 * already states the general rule -- validate every operator-supplied value
 * before spawning, naming `--run-id`, `--workspace` and `--topic-branch` among
 * the known ones. The iteration id was absent from that list only because until
 * D-0023 it reached no command line. Under the derivation it reaches all three.
 *
 * `workspaceRoot` is trusted to be absolute: `runPlan()` has already refused it
 * otherwise, and re-deriving that rule here would be the second copy of a check
 * that D-0016 warns about. What is *not* trusted is the id.
 */
export function allocate(iterationId: string, workspaceRoot: string): AllocationOutcome {
  if (!ITERATION_ID_PATTERN.test(iterationId)) {
    return {
      kind: "refused",
      reason:
        `the iteration id '${iterationId}' is not a rondo identifier: rondo derives the run ` +
        "id, the topic branch and the workspace from it, so it must be a lowercase letter " +
        "followed by up to 63 more of [a-z0-9_-] and may contain no path separator, no dot " +
        "and no space",
    };
  }
  return {
    kind: "allocated",
    allocation: {
      runId: `${RUN_ID_PREFIX}${iterationId}`,
      topicBranch: `${TOPIC_BRANCH_PREFIX}${iterationId}`,
      workspace: joinUnder(workspaceRoot, `${WORKSPACE_PREFIX}${iterationId}`),
      leaseClaimantId: `${RUN_ID_PREFIX}${iterationId}`,
    },
  };
}

/**
 * Append one component to a root, with the separator the root itself uses.
 *
 * `node:path` is not available here and that is the point rather than an
 * inconvenience: `src/refrain/`'s external allowance is empty, so the loop can
 * only ever be a function of what it was handed, and
 * `test/architecture/import-boundaries.test.ts` enforces it. The same reasoning
 * already puts `isAbsolutePath`'s regex in `plan.ts` rather than a `isAbsolute`
 * import.
 *
 * The join is trivially correct here only because {@link ITERATION_ID_PATTERN}
 * has already excluded every separator from the component: there is nothing to
 * normalise, no `..` to resolve and no empty segment to collapse. A general
 * path join this is not, and it must not be reused as one.
 */
function joinUnder(root: string, component: string): string {
  // The separator is the one the root actually uses, and a root holding both is
  // read as POSIX -- because on POSIX a backslash is an ordinary character in a
  // filename, while on Windows a forward slash is a genuine separator.
  const separator = root.includes("\\") && !root.includes("/") ? "\\" : "/";
  // **Only a trailing separator of the chosen kind is trimmed.** Stripping
  // either kind would eat the last character of a POSIX directory whose name
  // genuinely ends in a backslash -- `/srv/work\` is a legal directory -- and
  // place the workspace beside the root instead of inside it, which is the one
  // property `allocate` promises about this path.
  const trimmed = root.endsWith(separator) ? root.slice(0, -1) : root;
  return `${trimmed}${separator}${component}`;
}
