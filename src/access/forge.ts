/**
 * The two commands `publish` runs, and the only place rondo can spell one.
 *
 * **Why this is a module of its own.** The operator's submit button has to run
 * a branch push and a pull-request creation, and running them needs
 * `node:child_process`. `test/architecture/import-boundaries.test.ts` grants
 * externals **per module**, so putting the spawn here rather than in
 * `src/access/cli.ts` keeps a property rather than a promise: the command line
 * -- the file that reads argv, reads the plan and drives every other verb -- has
 * no spawn binding at all, and cannot acquire one without an edit the boundary
 * test fails. What can spawn is this file, and this file can spell exactly two
 * command lines, both built here from a plan rondo already validated rather
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

/** What a pull request needs. */
export interface PullRequestRequest {
  /** `owner/name`, which appears in no `RunPlan` field and is the one flag. */
  readonly repo: string;
  readonly baseBranch: string;
  readonly topicBranch: string;
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
    request.topicBranch,
    "--title",
    request.title,
    "--body",
    request.body,
  ]);
}
