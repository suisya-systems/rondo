/**
 * The commands `publish` runs, and the only place rondo can spell one.
 *
 * Two of them change something outside rondo -- a branch push and a
 * pull-request creation -- and the rest are the read-only `git` queries
 * `publish` asks the workspace before it prints or runs anything (see
 * `inspectPushTarget`). They are here for the same reason the two effects are:
 * asking git a question needs a process, and only this module may start one.
 *
 * **Why this is a module of its own.** The operator's submit button has to run
 * a branch push and a pull-request creation, and running them needs
 * `node:child_process`. `test/architecture/import-boundaries.test.ts` grants
 * externals **per module**, so putting the spawn here rather than in
 * `src/access/cli.ts` keeps a property rather than a promise: the command line
 * -- the file that reads argv, reads the plan and drives every other verb -- has
 * no spawn binding at all, and cannot acquire one without an edit the boundary
 * test fails. What can spawn is this file, and every command line it can spell
 * is written out here in full, built from a plan rondo already validated rather
 * than assembled by a caller.
 *
 * **Where this sits against D-0010.** D-0010 says publishing is the operator's
 * and that rondo holds no push credentials, and that stands. Nothing here runs
 * unless a person typed `rondo publish`; no other command in the tree reaches
 * this module; and the credential is the one already in the operator's own
 * `git` and `gh` configuration, which rondo neither stores nor reads. What was
 * settled when this module was written is that a button the operator presses is
 * not the same act as rondo publishing on its own: the authority stays with the
 * person, and this is the keyboard rather than the authority. Merging is absent
 * from this module in both senses.
 *
 * Nothing here interprets what it ran. Both functions hand back the exit status
 * and the captured streams for the caller to relay; `git` and `gh` say what
 * went wrong far better than a translation of them would.
 */
import { spawn } from "node:child_process";

/** What one forge command did. Streams as they arrived, unparsed. */
export interface CommandOutcome {
  /** The command as it was run, for the operator to read or repeat. */
  readonly commandLine: string;
  /** Null when the process was killed by a signal or never started. */
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  /** Set when the process could not be started at all. */
  readonly spawnError: string | null;
}

/**
 * How long a forge command may take.
 *
 * A push to a cold remote and a pull-request creation are both network calls a
 * person is sitting in front of. Five minutes is well past either and well
 * short of a hang the operator would have to notice on their own; a command
 * that reaches it is reported as a kill rather than left holding the terminal.
 */
const FORGE_TIMEOUT_MS = 300_000;

/** Run one command, capture both streams, and never interpret either. */
async function runCommand(
  executable: string,
  argv: readonly string[],
  timeoutMs: number = FORGE_TIMEOUT_MS,
): Promise<CommandOutcome> {
  const commandLine = [executable, ...argv].join(" ");
  return await new Promise<CommandOutcome>((resolve) => {
    // `shell: false` is `spawn`'s default and is load-bearing: every argument
    // below reaches the process as one argv element, so a branch name or a
    // title containing a shell metacharacter is data rather than syntax.
    const child = spawn(executable, [...argv], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      stderr += `\nrondo stopped waiting after ${String(timeoutMs)} ms and killed the command.\n`;
      child.kill("SIGKILL");
    }, timeoutMs);

    const finish = (outcome: CommandOutcome): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(outcome);
    };

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error: Error) => {
      finish({ commandLine, status: null, stdout, stderr, spawnError: error.message });
    });
    child.on("close", (status) => {
      finish({ commandLine, status, stdout, stderr, spawnError: null });
    });
  });
}

/** What a push needs. Every value comes from the plan rondo already validated. */
export interface PushRequest {
  /** The worktree the lap materialised. Absolute; it is the plan's `workspace`. */
  readonly workspace: string;
  readonly remote: string;
  readonly topicBranch: string;
}

/**
 * Push the topic branch the lap committed on.
 *
 * `-C <workspace>` rather than a working-directory change, so the command names
 * the repository it acts on and rondo's own process directory is never what
 * decides where a push goes -- the failure that would otherwise send the wrong
 * branch from the wrong tree.
 *
 * No `--force` and no lease flag: this pushes a branch the lap itself created,
 * and a rejected non-fast-forward is an answer the operator needs to see rather
 * than one for rondo to overrule.
 */
export async function pushTopicBranch(request: PushRequest): Promise<CommandOutcome> {
  return await runCommand("git", [
    "-C",
    request.workspace,
    "push",
    request.remote,
    request.topicBranch,
  ]);
}

/** What preflight asks a workspace about, before anything is printed or run. */
export interface PushTargetRequest {
  /** The worktree the lap materialised. Absolute; it is the plan's `workspace`. */
  readonly workspace: string;
  readonly remote: string;
  readonly topicBranch: string;
}

/**
 * What `git` said about the workspace a push would leave from.
 *
 * Facts, not a verdict. Which of these combinations may publish is a rule about
 * publishing rather than a rule about git, and it lives with the other such
 * rules in `./cli.ts`, where it is a pure function over this value and can be
 * tested without a repository on disk.
 */
export type PushTargetInspection =
  | {
      readonly kind: "read";
      /** Every remote configured in the workspace, in the order git listed them. */
      readonly remotes: readonly string[];
      /**
       * Every URL a push to the requested remote would reach; empty when the
       * remote is not configured at all.
       *
       * Plural because `remote.<name>.pushurl` is a multi-valued setting and
       * `git push` sends to **all** of it. A preflight that read only the first
       * would approve a publish that also reached repositories it never looked
       * at.
       */
      readonly pushUrls: readonly string[];
      /** Whether the topic branch exists in the workspace. */
      readonly topicBranchExists: boolean;
    }
  /** git could not be asked at all: no such directory, not a repository, no git. */
  | { readonly kind: "unreadable"; readonly reason: string };

/**
 * How long one preflight query may take.
 *
 * Every command below reads local configuration or a local ref and touches no
 * network, so the only way to reach this is a hang. It is short because a
 * preflight the operator is waiting on before a dry run should not be able to
 * cost them five minutes.
 */
const PREFLIGHT_TIMEOUT_MS = 30_000;

/** Why one preflight query did not answer, or null when it did. */
function queryFailure(outcome: CommandOutcome): string | null {
  if (outcome.spawnError !== null) {
    return `${outcome.commandLine}: ${outcome.spawnError}`;
  }
  if (outcome.status !== 0) {
    const said = outcome.stderr.trim();
    return `${outcome.commandLine} exited ${String(outcome.status)}${said === "" ? "" : `: ${said}`}`;
  }
  return null;
}

/**
 * Ask the workspace whether the push publish would run can run at all.
 *
 * **Three local reads, and no interpretation of them.** A remote that is not
 * configured, a topic branch that is not there and a push URL naming a
 * different repository than `--repo` are each a plan that cannot run, and
 * printing such a plan under `--dry-run` is the defect this exists to close --
 * but which of them is fatal is decided by the caller, not here.
 *
 * `git remote` before `git remote get-url` rather than reading the URL and
 * treating a failure as absence: `get-url` fails for more reasons than a
 * missing remote, and "there is no remote 'origin'" is worth being able to say
 * as a fact rather than as an inference from an exit status.
 */
export async function inspectPushTarget(request: PushTargetRequest): Promise<PushTargetInspection> {
  const listed = await runCommand("git", ["-C", request.workspace, "remote"], PREFLIGHT_TIMEOUT_MS);
  const listFailure = queryFailure(listed);
  if (listFailure !== null) {
    return { kind: "unreadable", reason: listFailure };
  }
  const remotes = listed.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

  let pushUrls: readonly string[] = [];
  if (remotes.includes(request.remote)) {
    // `--push` rather than the fetch URL, because a remote may have `pushurl`
    // set and what this compares against `--repo` has to be where the push
    // actually goes. `--all` because `pushurl` is multi-valued and `git push`
    // sends to every one of them.
    const urls = await runCommand(
      "git",
      ["-C", request.workspace, "remote", "get-url", "--push", "--all", request.remote],
      PREFLIGHT_TIMEOUT_MS,
    );
    const urlFailure = queryFailure(urls);
    if (urlFailure !== null) {
      return { kind: "unreadable", reason: urlFailure };
    }
    pushUrls = urls.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "");
  }

  const branch = await runCommand(
    "git",
    [
      "-C",
      request.workspace,
      "rev-parse",
      "--verify",
      "--quiet",
      `refs/heads/${request.topicBranch}`,
    ],
    PREFLIGHT_TIMEOUT_MS,
  );
  if (branch.spawnError !== null) {
    return { kind: "unreadable", reason: `${branch.commandLine}: ${branch.spawnError}` };
  }
  // `--verify --quiet` is exit 1 and silence for a ref that is not there, which
  // is an answer. Any other non-zero status is git failing to answer, and the
  // two must not be collapsed into "the branch is missing".
  if (branch.status !== 0 && branch.status !== 1) {
    return { kind: "unreadable", reason: queryFailure(branch) ?? branch.commandLine };
  }

  return { kind: "read", remotes, pushUrls, topicBranchExists: branch.status === 0 };
}

/** What a pull request needs. */
export interface PullRequestRequest {
  /**
   * `host/owner/name`: `--repo`'s two segments with the host the caller
   * checked in front of them, so that the repository this reaches is the one
   * the preflight agreed about rather than one the CLI resolves for itself.
   */
  readonly repo: string;
  readonly baseBranch: string;
  /**
   * What `--head` is given: the topic branch, or `owner:branch` when the push
   * went to a repository other than `--repo`. The caller decides which, because
   * deciding it needs the push URL preflight read (see `./cli.ts`).
   */
  readonly headRef: string;
  readonly title: string;
  readonly body: string;
}

/**
 * Open the pull request, and stop there.
 *
 * `--repo` is explicit rather than inferred from the workspace's remote,
 * because the workspace is a worktree cut from a local path and an inferred
 * slug would be whatever that clone happened to point at. The operator names
 * the forge repository, which is the one fact about publishing that the plan
 * does not already carry.
 *
 * **There is no merge here and there will not be one.** Opening a pull request
 * puts the work in front of a reviewer; merging it is a different act under a
 * different authority, and it is out of scope in both senses.
 */
export async function openPullRequest(request: PullRequestRequest): Promise<CommandOutcome> {
  return await runCommand("gh", [
    "pr",
    "create",
    "--repo",
    request.repo,
    "--base",
    request.baseBranch,
    "--head",
    request.headRef,
    "--title",
    request.title,
    "--body",
    request.body,
  ]);
}
