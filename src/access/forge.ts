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
 * person, and this is the keyboard rather than the authority. A merge is spelled
 * here too, on the same terms and under `D-0091`: a person presses it on the
 * page, per act, and nothing else in the tree reaches it.
 *
 * Nothing here interprets what it ran. Both functions hand back the exit status
 * and the captured streams for the caller to relay; `git` and `gh` say what
 * went wrong far better than a translation of them would.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { DrafterRow, ReviewerRow } from "../continuo/roles.js";
import { recordNumber, recordNumbers } from "../store/lanes.js";
import { contentDigest } from "../store/plan.js";
import type { ReadingEvidence } from "../store/records.js";
import { hostFailure } from "./host-failure.js";
import type { DrafterRun } from "./model-draft/judgement.js";
import type { ReviewerRun } from "./model-review/judgement.js";

/** What one forge command did. Streams as they arrived, unparsed. */
export interface CommandOutcome {
  /** The command as it was run, for the operator to read or repeat. */
  readonly commandLine: string;
  /** Null when the process was killed by a signal or never started. */
  readonly status: number | null;
  /** The signal that ended the process, when one did (a timeout is SIGKILL). */
  readonly signal: string | null;
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
  options: { readonly input?: string; readonly cwd?: string } = {},
): Promise<CommandOutcome> {
  const commandLine = [executable, ...argv].join(" ");
  return await new Promise<CommandOutcome>((resolve) => {
    // `shell: false` is `spawn`'s default and is load-bearing: every argument
    // below reaches the process as one argv element, so a branch name or a
    // title containing a shell metacharacter is data rather than syntax.
    //
    // Standard input is a pipe only when there is something to write to it
    // (D-0065 1.1: the reviewer's document), so every other command keeps the
    // closed stdin it always had and cannot sit waiting on a terminal.
    //
    // **Windows.** Without a shell, `spawn` does not resolve an npm `.cmd`
    // shim, so a `codex` installed that way fails to start (ENOENT). That is a
    // `spawnError`, which every caller turns into an unreadable query or a
    // failed reviewer run -- an unavailable reading, never a clear one.
    const child = spawn(executable, [...argv], {
      stdio: [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
      // Absent is the caller's directory; only the drafter names one (it has no `-C`).
      ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    });
    // **Bytes, decoded once at the end.** A chunk boundary can fall inside a
    // multi-byte UTF-8 character; decoding chunk by chunk would turn both
    // halves into U+FFFD in text a reading is then taken over.
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let timedOut = false;
    let settled = false;

    // **The timeout settles the outcome itself**, rather than killing and then
    // waiting for `close`. `close` needs every holder of the output pipes gone,
    // and an npm-installed `codex` is a Node launcher whose native child
    // inherits them and does not die with it: waiting would leave the command
    // (and the gate's screen) hanging past the bound it was given. So the pipes
    // are torn down on rondo's side and the command is answered as killed.
    // ponytail: only the direct child is killed; a descendant runs on to its own
    // end detached from rondo. A process group would reach it, but a detached
    // group also escapes the terminal's Ctrl-C, which is the worse orphan.
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
      child.stdin?.destroy();
      child.stdout?.destroy();
      child.stderr?.destroy();
      finish({
        commandLine,
        status: null,
        signal: "SIGKILL",
        ...streams(),
        spawnError:
          options.input === undefined
            ? null
            : "standard input was not delivered in full: the command was killed at its timeout",
      });
    }, timeoutMs);

    const streams = (): { stdout: string; stderr: string } => ({
      stdout: Buffer.concat(stdoutChunks).toString("utf8"),
      stderr:
        Buffer.concat(stderrChunks).toString("utf8") +
        (timedOut
          ? `\nrondo stopped waiting after ${String(timeoutMs)} ms and killed the command.\n`
          : ""),
    });

    const finish = (outcome: CommandOutcome): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(outcome);
    };

    // **Delivered means the write finished, not that it was attempted.** A
    // process that exits without reading all of its input makes the write fail
    // with EPIPE, or is destroyed with the write still pending when Node reaps
    // the child; either way `finish` never fires. Unhandled, the EPIPE is an
    // uncaught exception; swallowed, it is a delivered digest over bytes the
    // reader was never given (D-0065 1.4). So the outcome waits for standard
    // input to close as well as the process, and the input counts as delivered
    // only if `finish` fired first with no error.
    let stdinClosed = options.input === undefined || child.stdin === null;
    let stdinFinished = false;
    let stdinError: string | null = null;
    let exited: { status: number | null; signal: string | null } | null = null;
    const settleIfDone = (): void => {
      if (exited === null || !stdinClosed) {
        return;
      }
      finish({
        commandLine,
        ...exited,
        ...streams(),
        spawnError:
          options.input === undefined || (stdinFinished && stdinError === null)
            ? null
            : `standard input was not delivered in full: ${stdinError ?? "the process did not take it all"}`,
      });
    };

    if (options.input !== undefined && child.stdin !== null) {
      child.stdin.on("error", (error: Error) => {
        stdinError = error.message;
      });
      child.stdin.on("finish", () => {
        stdinFinished = true;
      });
      child.stdin.on("close", () => {
        stdinClosed = true;
        settleIfDone();
      });
      child.stdin.end(options.input, "utf8");
    }

    child.stdout?.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });
    child.on("error", (error: Error) => {
      finish({ commandLine, status: null, signal: null, ...streams(), spawnError: error.message });
    });
    child.on("close", (status, signal) => {
      exited = { status, signal };
      settleIfDone();
      // The process is gone, so nothing more will be read: a pipe still open
      // after pending callbacks ran is closed here rather than waited on, and
      // counts as undelivered unless `finish` already fired.
      setImmediate(() => {
        if (!stdinClosed) {
          child.stdin?.destroy();
        }
      });
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

/** Whether a branch is already there, or why git could not say. */
export type BranchPresence =
  | { readonly kind: "read"; readonly exists: boolean }
  /** git will not accept the name, whether or not anything holds it. */
  | { readonly kind: "malformed" }
  | { readonly kind: "unreadable"; readonly reason: string };

/**
 * Ask a repository whether a branch is already there.
 *
 * **For `revise`, and it is a preflight rather than a courtesy.** continuo's
 * materialiser requires a topic branch that does **not** already exist, and it
 * discovers that after `run admit` -- which for a revision is after the gate has
 * been presented, answered and closed. A person who reuses a branch from two
 * laps ago would spend their gate to learn it. `revisionPlan` compares the
 * three identifiers against the immediate predecessor's, which is a string
 * comparison in a layer that may not start a process; this is the same question
 * asked of git, so it also answers for a lap further back and for a branch
 * created by anything else.
 *
 * The repository rather than the workspace: the workspace is the worktree a lap
 * cuts and does not exist yet, and the branch lives in the repository it is cut
 * from. `--verify --quiet` distinguishes "not there" (exit 1, silence) from
 * "git could not answer", and the two must not be collapsed -- the caller
 * refuses on the second rather than reading it as room to proceed.
 */
export async function inspectTopicBranch(request: {
  readonly repository: string;
  readonly topicBranch: string;
}): Promise<BranchPresence> {
  // **Syntax before existence, because "no such ref" is the same answer for a
  // name that could never be one.** `rev-parse --verify --quiet` exits 1 for
  // `bad..branch` exactly as it does for a branch nobody has created, so asking
  // only that question reports a malformed name as available -- and continuo's
  // materialiser then refuses it after the gate is gone. `runPlan` cannot close
  // this: it refuses an empty or option-shaped value, and the rest of what a
  // refname may be is git's rule rather than rondo's, which is why it is asked
  // of git.
  //
  // The full `refs/heads/` form rather than `--branch`: it is the name that
  // will actually be created, and it is checked as a string with none of
  // `--branch`'s shorthand expansion (`@{-1}` and friends) in the way.
  const wellFormed = await runCommand(
    "git",
    ["check-ref-format", `refs/heads/${request.topicBranch}`],
    PREFLIGHT_TIMEOUT_MS,
  );
  if (wellFormed.spawnError !== null) {
    return { kind: "unreadable", reason: `${wellFormed.commandLine}: ${wellFormed.spawnError}` };
  }
  if (wellFormed.status !== 0) {
    return { kind: "malformed" };
  }

  const branch = await runCommand(
    "git",
    [
      "-C",
      request.repository,
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
  if (branch.status !== 0 && branch.status !== 1) {
    return { kind: "unreadable", reason: queryFailure(branch) ?? branch.commandLine };
  }
  return { kind: "read", exists: branch.status === 0 };
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
 * slug would be whatever that clone happened to point at. That is unchanged by
 * `D-0081`, which moved *where a person tells rondo the slug* -- onto the plan,
 * recorded by setup, with the host's `--repo` left as the fallback for a plan
 * that carries none -- and refused inference a second time (rule 3.3). What
 * reaches here is still a slug somebody wrote, never one rondo worked out.
 *
 * **There is no merge here.** Opening a pull request puts the work in front of
 * a reviewer; merging it is a different act under a different authority, a
 * person's press per act (`D-0091`), and it is {@link mergePullRequest}.
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

/** Which issue to read, as `readIssueFromForge` spells it (D-0078 section 2.1). */
export interface IssueReadRequest {
  /** The forge host for `--hostname`, or null for the one `gh` is set up for. */
  readonly host: string | null;
  /** `OWNER/NAME`. */
  readonly repo: string;
  readonly number: number;
}

/**
 * How long one read of an issue may take. Nothing waits on it (the host reads
 * in the background), so the bound only frees the reader from a forge that
 * never answers.
 */
const ISSUE_READ_TIMEOUT_MS = 60_000;

/**
 * Read one issue or pull request's conversation (D-0078 section 2.2): the
 * issue itself, then -- only if that answered -- every comment, oldest first.
 *
 * **A read, through the operator's own `gh`, and nothing else**: `gh api` with
 * no method is a `GET`, the credential is the one in the operator's `gh`
 * configuration that rondo neither stores nor reads (this module's header),
 * and it runs in the host, never in a lap, whose fence stays closed to the
 * forge (section 1.2). `issues/N` answers for a pull request too, with its
 * conversation and never its diff. Links in what comes back are not followed.
 */
export async function readIssueFromForge(request: IssueReadRequest): Promise<{
  readonly issue: CommandOutcome;
  readonly comments: CommandOutcome | null;
}> {
  const host = request.host === null ? [] : ["--hostname", request.host];
  const path = `repos/${request.repo}/issues/${String(request.number)}`;
  const issue = await runCommand("gh", ["api", ...host, path], ISSUE_READ_TIMEOUT_MS);
  if (issue.spawnError !== null || issue.status !== 0) {
    return { issue, comments: null };
  }
  const comments = await runCommand(
    "gh",
    [
      "api",
      ...host,
      "--paginate",
      `${path}/comments?per_page=100`,
      "--jq",
      ".[] | {author: .user.login, at: .created_at, body: .body}",
    ],
    ISSUE_READ_TIMEOUT_MS,
  );
  return { issue, comments };
}

/**
 * List one repository's open issues for triage (D-0097 point 1 (b)): number,
 * title and label names, one JSON object per line, pull requests left out.
 *
 * A read through the operator's own `gh`, as {@link readIssueFromForge} is,
 * and it writes nothing on the forge (point 6 (a)).
 *
 * ponytail: the newest 100 open issues, one page; `--paginate` when a
 * repository rondo triages holds more open issues than that.
 */
export async function listOpenIssues(request: {
  readonly host: string | null;
  readonly repo: string;
}): Promise<CommandOutcome> {
  const host = request.host === null ? [] : ["--hostname", request.host];
  return await runCommand(
    "gh",
    [
      "api",
      ...host,
      `repos/${request.repo}/issues?state=open&per_page=100`,
      "--jq",
      ".[] | select(.pull_request == null) | {number, title, labels: [.labels[].name]}",
    ],
    ISSUE_READ_TIMEOUT_MS,
  );
}

/**
 * Whether a remote URL names `repo` (`OWNER/NAME`) on github.com, case aside:
 * the HTTPS and SSH spellings `gh repo clone` writes, and nothing on another
 * host or on this disk that merely ends in the same two names.
 */
export function sameForgeRepository(url: string, repo: string): boolean {
  const m =
    /^(?:https:\/\/(?:[^@/\s]+@)?github\.com\/|ssh:\/\/git@github\.com\/|git@github\.com:)([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/i.exec(
      url,
    );
  return m?.[1]?.toLowerCase() === repo.toLowerCase();
}

/** What cloning a repository for the page did (rondo#383), step by step. */
export interface RepositoryClone {
  /** The clone, or null when `into` already held a clone to use. */
  readonly clone: CommandOutcome | null;
  /** The branch the clone's HEAD is on; null when the clone did not answer. */
  readonly branch: CommandOutcome | null;
  /** The clone's top-level file names, one per line; null likewise. */
  readonly files: CommandOutcome | null;
}

/**
 * Clone `repo` (`OWNER/NAME`) into `into` through the operator's own `gh`, and
 * read what setup reads of a target: the branch its HEAD is on and, for the
 * worker's commands, the names of its top-level files (rondo#383, D-0090).
 *
 * **A clone already at `into` is used, not cloned again**, so a press that
 * cloned and then failed to record is repaired by pressing again. Only a
 * clone whose own top level is `into` counts: a directory inside some other
 * repository is not one. Anything else at `into` fails the clone and says so.
 */
export async function cloneRepository(repo: string, into: string): Promise<RepositoryClone> {
  const top = await runCommand("git", ["-C", into, "rev-parse", "--show-toplevel"]);
  const held = top.status === 0 && top.stdout.trim() === into;
  if (held) {
    // **Only a clone of `repo`**: a checkout of something else at this path
    // would be recorded as `repo`'s plan and the work run in the wrong tree.
    const origin = await runCommand("git", ["-C", into, "remote", "get-url", "origin"]);
    if (!sameForgeRepository(origin.stdout.trim(), repo)) {
      return {
        clone: {
          ...origin,
          status: origin.status === 0 ? 1 : origin.status,
          stderr: `${into} holds a clone whose origin is '${origin.stdout.trim()}', not ${repo}`,
        },
        branch: null,
        files: null,
      };
    }
  }
  const clone = held ? null : await runCommand("gh", ["repo", "clone", repo, into]);
  if (clone !== null && (clone.spawnError !== null || clone.status !== 0)) {
    return { clone, branch: null, files: null };
  }
  const branch = await runCommand("git", [
    "-C",
    into,
    "symbolic-ref",
    "--quiet",
    "--short",
    "HEAD",
  ]);
  const files = await runCommand("git", ["-C", into, "ls-tree", "--name-only", "HEAD"]);
  return { clone, branch, files };
}

/** Which pull request's checks to fetch (rondo#310, `continuo D-1113`). */
export interface PullRequestChecksRequest {
  /** The forge host for `--hostname`, or null for the one `gh` is set up for. */
  readonly host: string | null;
  /** `OWNER/NAME`, the pull request's base repository. */
  readonly repo: string;
  readonly number: number;
}

/**
 * The three documents `continuo ci observe` reads, as the forge printed them,
 * or why they were not all fetched.
 */
export type PullRequestChecksFetch =
  | {
      readonly kind: "fetched";
      readonly pullRequest: string;
      readonly checkRuns: string;
      readonly status: string;
    }
  | { readonly kind: "failed"; readonly reason: string };

/**
 * Fetch what the forge says about one pull request's checks, through the
 * operator's own `gh` (rondo#310, `D-0010`), and judge none of it.
 *
 * **Three `GET`s and nothing else**, which is `readIssueFromForge`'s shape and
 * is there for its reasons: `gh api` with no method is a read, the credential
 * is the one in the operator's own `gh` configuration that rondo neither stores
 * nor reads, and it runs in the host and never in a lap. Recording what came
 * back and folding it into a verdict is continuo's (`continuo D-1113`): rondo
 * hands it these documents and never reaches a verdict of its own.
 *
 * **The head is the pull request document's**, so the checks fetched are the
 * ones on the commit the pull request would merge. Both check documents are
 * every page (`--paginate --slurp`), because one page is a wrong answer and
 * not a partial one; continuo compares each page against the forge's own
 * `total_count` and refuses a short answer.
 */
export async function fetchPullRequestChecks(
  request: PullRequestChecksRequest,
): Promise<PullRequestChecksFetch> {
  const host = request.host === null ? [] : ["--hostname", request.host];
  const at = `repos/${request.repo}`;
  const pull = await runCommand(
    "gh",
    ["api", ...host, `${at}/pulls/${String(request.number)}`],
    CHECKS_READ_TIMEOUT_MS,
  );
  const pullFailure = queryFailure(pull);
  if (pullFailure !== null) {
    return { kind: "failed", reason: pullFailure };
  }
  let head: string | null;
  try {
    const json: unknown = JSON.parse(pull.stdout);
    head = stringAt(
      typeof json === "object" && json !== null ? (json as Record<string, unknown>)["head"] : null,
      "sha",
    );
  } catch (error) {
    return {
      kind: "failed",
      reason: `the forge's answer was not JSON: ${hostFailure(error).text}`,
    };
  }
  if (head === null || !/^[0-9a-f]{7,64}$/i.test(head)) {
    return { kind: "failed", reason: "the pull request document carried no head commit" };
  }
  const read = async (path: string): Promise<CommandOutcome> =>
    await runCommand(
      "gh",
      ["api", ...host, "--paginate", "--slurp", `${at}/commits/${head}/${path}?per_page=100`],
      CHECKS_READ_TIMEOUT_MS,
    );
  const runs = await read("check-runs");
  const runsFailure = queryFailure(runs);
  if (runsFailure !== null) {
    return { kind: "failed", reason: runsFailure };
  }
  const status = await read("status");
  const statusFailure = queryFailure(status);
  if (statusFailure !== null) {
    return { kind: "failed", reason: statusFailure };
  }
  return {
    kind: "fetched",
    pullRequest: pull.stdout,
    checkRuns: runs.stdout,
    status: status.stdout,
  };
}

/** The commits a pull request's head carries past another commit (rondo#412). */
export interface CommitsBetweenRequest {
  readonly host: string | null;
  /** `OWNER/NAME`, the pull request's base repository. */
  readonly repo: string;
  readonly from: string;
  readonly to: string;
}

/** One commit, as a person reads it: its sha and the first line of its message. */
export interface CommitLine {
  readonly sha: string;
  readonly subject: string;
}

export type CommitsBetween =
  | {
      readonly kind: "read";
      readonly commits: readonly CommitLine[];
      /** How many it carries: the forge lists at most 250 (`total_commits`). */
      readonly total: number;
    }
  | { readonly kind: "failed"; readonly reason: string };

/**
 * What `to` carries that `from` does not, through the operator's own `gh`
 * (rondo#412): one `GET` of the forge's comparison, which writes nothing.
 * Oldest first, as the forge lists them.
 */
export async function readCommitsBetween(request: CommitsBetweenRequest): Promise<CommitsBetween> {
  const host = request.host === null ? [] : ["--hostname", request.host];
  const read = await runCommand(
    "gh",
    ["api", ...host, `repos/${request.repo}/compare/${request.from}...${request.to}`],
    CHECKS_READ_TIMEOUT_MS,
  );
  const failure = queryFailure(read);
  if (failure !== null) {
    return { kind: "failed", reason: failure };
  }
  try {
    const json: unknown = JSON.parse(read.stdout);
    const commits = commitsOf(json);
    const total =
      typeof json === "object" && json !== null
        ? (json as Record<string, unknown>)["total_commits"]
        : null;
    return {
      kind: "read",
      commits,
      total: typeof total === "number" && total > commits.length ? total : commits.length,
    };
  } catch (error) {
    return {
      kind: "failed",
      reason: `the forge's comparison did not read: ${hostFailure(error).text}`,
    };
  }
}

/** The comparison document's commits, or a throw where it carries none. */
export function commitsOf(json: unknown): readonly CommitLine[] {
  const commits =
    typeof json === "object" && json !== null ? (json as Record<string, unknown>)["commits"] : null;
  if (!Array.isArray(commits)) {
    throw new Error("the comparison carried no list of commits");
  }
  return commits.map((one: unknown) => {
    const sha = stringAt(one, "sha");
    const message = stringAt(
      typeof one === "object" && one !== null ? (one as Record<string, unknown>)["commit"] : null,
      "message",
    );
    if (sha === null) {
      throw new Error("a commit in the comparison carried no sha");
    }
    return { sha, subject: (message ?? "").split("\n")[0] ?? "" };
  });
}

/**
 * How long one read of a pull request's checks may take. Nothing waits on it
 * (the host reads on its own timer), so the bound only frees the reader from a
 * forge that never answers.
 */
const CHECKS_READ_TIMEOUT_MS = 60_000;

function stringAt(json: unknown, key: string): string | null {
  if (typeof json !== "object" || json === null) {
    return null;
  }
  const at = (json as Record<string, unknown>)[key];
  return typeof at === "string" && at !== "" ? at : null;
}

/**
 * One pull request, as the merge press names it (rondo#380): **by the address
 * the forge printed when it opened it**, so the pull request merged is the one
 * published and never a number read against whichever repository the host is
 * told about today.
 */
export interface PullRequestAt {
  readonly url: string;
}

/** What the forge says about one pull request, just before and just after a merge. */
export type PullRequestState =
  | {
      readonly kind: "read";
      /** The forge's own word: `OPEN`, `MERGED` or `CLOSED`. */
      readonly state: string;
      readonly headCommit: string;
      /** The branch it merges into: where a merge lands. */
      readonly baseBranch: string;
      /** The commit a merge made, or null before one. */
      readonly mergeCommit: string | null;
      /**
       * Whether the base branch merges through a queue. There, `gh pr merge`
       * queues the pull request -- or turns on auto-merge -- rather than
       * merging it now, so the press refuses before asking (Codex round 2).
       */
      readonly mergeQueue: boolean;
    }
  | { readonly kind: "undetermined"; readonly reason: string };

/**
 * Read one pull request's state, head, base and whether its base merges
 * through a queue (rondo#380): one GraphQL query, which writes nothing.
 * `gh pr view --json` does not offer the queue, so the query is spelled here.
 */
export async function readPullRequest(at: PullRequestAt): Promise<PullRequestState> {
  const read = await runCommand(
    "gh",
    [
      "api",
      "graphql",
      // The host the pull request is on, and not whichever one `gh` is set up
      // for: the query's `url` does not choose the endpoint (Codex round 3).
      "--hostname",
      hostOf(at.url),
      "-f",
      `query=${PULL_REQUEST_QUERY}`,
      "-f",
      `url=${at.url}`,
      "--jq",
      ".data.resource",
    ],
    CHECKS_READ_TIMEOUT_MS,
  );
  const failure = queryFailure(read);
  if (failure !== null) {
    return { kind: "undetermined", reason: failure };
  }
  let json: unknown;
  try {
    json = JSON.parse(read.stdout);
  } catch (error) {
    return {
      kind: "undetermined",
      reason: `the forge's answer was not JSON: ${hostFailure(error).text}`,
    };
  }
  const state = stringAt(json, "state");
  const headCommit = stringAt(json, "headRefOid");
  const baseBranch = stringAt(json, "baseRefName");
  if (state === null || headCommit === null || baseBranch === null) {
    return { kind: "undetermined", reason: "the forge's answer carried no state, head or base" };
  }
  const merged = (json as Record<string, unknown>)["mergeCommit"];
  const queue = (json as Record<string, unknown>)["isMergeQueueEnabled"];
  // A forge that did not say is not a "no": merging as if there were no queue
  // is exactly the act a queue would turn into a later one.
  if (typeof queue !== "boolean") {
    return { kind: "undetermined", reason: "the forge did not say whether a merge queue applies" };
  }
  return {
    kind: "read",
    state,
    headCommit,
    baseBranch,
    mergeCommit: stringAt(merged, "oid"),
    mergeQueue: queue,
  };
}

/** The host part of an address, or the address itself where it will not parse. */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

const PULL_REQUEST_QUERY =
  "query($url: URI!) { resource(url: $url) { ... on PullRequest { " +
  "state headRefOid baseRefName mergeCommit { oid } isMergeQueueEnabled } } }";

/** How a merge is made; the flag `gh pr merge` takes for each. */
export type MergeMethod = "squash" | "merge" | "rebase";

/** Which method the repository's own settings leave, or why there is none. */
export type MergeMethodReading =
  | { readonly kind: "read"; readonly method: MergeMethod }
  | { readonly kind: "none" }
  | { readonly kind: "undetermined"; readonly reason: string };

/**
 * The repository's allowed merge methods (rondo#380, `D-0091` rule 3), read
 * through the operator's own `gh`: one `GET`. `repo` is `HOST/OWNER/NAME`.
 */
export async function readMergeMethod(repo: string): Promise<MergeMethodReading> {
  const read = await runCommand(
    "gh",
    ["repo", "view", repo, "--json", "squashMergeAllowed,mergeCommitAllowed,rebaseMergeAllowed"],
    CHECKS_READ_TIMEOUT_MS,
  );
  const failure = queryFailure(read);
  return failure === null ? mergeMethodOf(read.stdout) : { kind: "undetermined", reason: failure };
}

/**
 * The method a merge press uses, from what the repository allows.
 *
 * **One allowed method is the repository's setting, and it is used.** Where
 * several are allowed, the first of squash, a merge commit and rebase, and the
 * report and the page say which (`D-0091` rule 3, the gate's answer: a person
 * does not choose per press).
 */
export function mergeMethodOf(printed: string): MergeMethodReading {
  let json: unknown;
  try {
    json = JSON.parse(printed);
  } catch (error) {
    return {
      kind: "undetermined",
      reason: `the forge's answer was not JSON: ${hostFailure(error).text}`,
    };
  }
  const allowed = (key: string): boolean | null => {
    const at =
      typeof json === "object" && json !== null ? (json as Record<string, unknown>)[key] : null;
    return typeof at === "boolean" ? at : null;
  };
  const read = [
    ["squash", allowed("squashMergeAllowed")],
    ["merge", allowed("mergeCommitAllowed")],
    ["rebase", allowed("rebaseMergeAllowed")],
  ] as const;
  // A field that is absent is a forge that did not say, never a "no": reading
  // it as one could pick a method the repository refuses.
  if (read.some(([, value]) => value === null)) {
    return { kind: "undetermined", reason: "the forge did not say which merge methods it allows" };
  }
  const method = read.find(([, value]) => value === true)?.[0];
  return method === undefined ? { kind: "none" } : { kind: "read", method };
}

/**
 * Merge one pull request, on a person's press (rondo#380, `D-0091`).
 *
 * **`--match-head-commit` is what makes the press about the commit that was
 * read green**: the forge refuses the merge if the head has moved since, so a
 * push after the green reading cannot ride in on it. No `--delete-branch`, no
 * `--auto` and no `--admin`: the branch stays, a merge the forge would not make
 * now is not queued for later, and a protection rule is not overridden.
 */
export async function mergePullRequest(
  request: PullRequestAt & { readonly method: MergeMethod; readonly headCommit: string },
): Promise<CommandOutcome> {
  return await runCommand("gh", [
    "pr",
    "merge",
    request.url,
    `--${request.method}`,
    "--match-head-commit",
    request.headCommit,
  ]);
}

/** What reading the lap's work needs. Every value comes from the plan. */
export interface LapWorkRequest {
  /** The worktree the lap materialised. Absolute; it is the plan's `workspace`. */
  readonly workspace: string;
  readonly remote: string;
  readonly baseBranch: string;
  readonly topicBranch: string;
}

/** One commit the lap made, as a person would list it. */
export interface LapCommit {
  readonly abbreviatedSha: string;
  /** The commit's first line, exactly as the lap wrote it. */
  readonly subject: string;
}

/** One path the lap touched, with its line counts. Null counts mean binary. */
export interface LapFile {
  readonly path: string;
  readonly added: number | null;
  readonly deleted: number | null;
}

/**
 * One file's line counts, or the fact that it has none.
 *
 * **Beside the shape it reads** (rondo#341), because both screens that list a
 * lap's files render a count this way: the terminal's own summary in
 * `./cli.ts`, and the pull-request body in `./pull-request.ts`. Two spellings
 * of "(binary)" would be the two of them describing the same file differently.
 */
export function fileCounts(file: LapFile): string {
  if (file.added === null || file.deleted === null) {
    return "(binary)";
  }
  return `(+${String(file.added)} -${String(file.deleted)})`;
}

/**
 * What the lap actually did to the workspace, as `git` reports it.
 *
 * Facts again, and for the same reason `PushTargetInspection` is: what a pull
 * request's title and body are made of is a rule about pull requests, and it
 * lives in `./pull-request.ts` as a pure function over this value.
 *
 * `unreadable` is a first-class answer rather than an empty read. A publish
 * whose history could not be read still has to be publishable -- the diff is
 * already pushed and the operator is standing there -- so the caller degrades
 * to a body that says so, which it can only do if it can tell the two apart.
 */
export type LapWorkInspection =
  | {
      readonly kind: "read";
      /** The ref the range was taken from, so the body can name what it compared against. */
      readonly baseRef: string;
      /**
       * That ref resolved to a full sha, and the topic branch resolved to one.
       *
       * **The names alone are not an identity, and D-0029 rule 10 needs one.** A
       * ref name says where to look and not what was there; the abbreviated shas
       * `%h` yields per commit are not commit ids; and the newest entry of the
       * log is not the tip when the tip is a merge, because the log is
       * `--no-merges`. So a reading taken here and a `publish` that happens later
       * could not otherwise be compared, and a branch that moved in between would
       * publish under a verdict describing something else.
       *
       * The base resolution costs nothing: the loop below already runs
       * `rev-parse` over the candidates and used to discard the sha it printed.
       * The tip is one more query of the same shape.
       */
      readonly baseCommit: string;
      readonly tipCommit: string;
      /** Oldest first: the order the lap built the work, which is the order it reads in. */
      readonly commits: readonly LapCommit[];
      readonly files: readonly LapFile[];
      /**
       * Paths `git status` lists in the workspace, in its order (D-0060 rule 1).
       *
       * What git counts: tracked paths modified, staged or deleted, and
       * untracked paths that are not ignored. None of them is on the topic
       * branch, so none of them is in a push. **Not in the material digest**
       * (rule 3): they are what a push would leave behind, not what it carries.
       */
      readonly uncommitted: readonly string[];
      /**
       * What the workspace has checked out, as `git status --branch` names it
       * (`topic`, `HEAD (no branch)`, ...). The uncommitted paths are relative
       * to that, which is not always the topic branch -- D-0060's second
       * residual asks the refusal to say which branch it read.
       */
      readonly checkedOut: string;
    }
  | {
      readonly kind: "unreadable";
      /**
       * Which half could not be read (D-0099). `history` is the base, the
       * tip, the log or the diff; nothing after it was asked, so the
       * uncommitted state is unknown too, and the rule above still stands: the
       * publish degrades rather than stops. `status` is the history read and
       * `git status` failing on top of it, which leaves D-0060's fact -- what
       * the push would leave behind -- unknown, and `publish` refuses on that
       * whatever overrides it.
       */
      readonly part: "history" | "status";
      readonly reason: string;
    };

/** Where a branch points, or why git would not say. */
export type BranchTip =
  | { readonly kind: "read"; readonly tipCommit: string }
  | { readonly kind: "unreadable"; readonly reason: string };

/**
 * The commit one topic branch points at, asked of git and nothing else.
 *
 * **Separate from {@link inspectLapWork} because the two can disagree about
 * whether anything is readable** (rondo#233 S5, Codex round 3). That function
 * needs a base ref to compare against, and a worktree that holds none reads as
 * `unreadable` while the branch it would push is perfectly resolvable. Anything
 * that has to identify *what would be pushed* -- rather than summarise what it
 * changed -- asks this instead, so a workspace with no base still has a
 * fingerprint and work that moved under a screen is still caught moving.
 */
export async function inspectBranchTip(request: {
  readonly workspace: string;
  readonly topicBranch: string;
}): Promise<BranchTip> {
  // `refs/heads/...` spelled out, for `inspectPushTarget`'s reason: a tag or a
  // remote ref of the same name must not answer for the branch.
  const resolved = await runCommand(
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
  if (resolved.spawnError !== null) {
    return { kind: "unreadable", reason: `${resolved.commandLine}: ${resolved.spawnError}` };
  }
  const tipCommit = resolved.stdout.trim();
  if (resolved.status !== 0 || tipCommit === "") {
    return {
      kind: "unreadable",
      reason:
        queryFailure(resolved) ??
        `git could not say what '${request.topicBranch}' points at in ${request.workspace}`,
    };
  }
  return { kind: "read", tipCommit };
}

/**
 * Read the commits and the touched paths the topic branch adds to its base.
 *
 * **The base is resolved before it is used, and the remote-tracking ref is
 * preferred.** The plan names a base *branch*, and a worktree cut for one lap
 * may carry no local branch of that name at all -- `main..topic` would then
 * fail as "unknown revision" and cost the body its summary for a reason that is
 * not a real absence. `<remote>/<base>` is the ref that actually describes what
 * the pull request will be opened against, so it is tried first and the local
 * branch second.
 *
 * `--no-merges` because a merge commit is the shape of the history rather than
 * a change the lap made, and a person reading a list of what changed is asking
 * for the second. Three dots for the diff, so a base that moved after the lap
 * branched does not show up as work this pull request did.
 */
export async function inspectLapWork(request: LapWorkRequest): Promise<LapWorkInspection> {
  const candidates = [
    `refs/remotes/${request.remote}/${request.baseBranch}`,
    `refs/heads/${request.baseBranch}`,
  ];
  let baseRef: string | null = null;
  let baseCommit = "";
  for (const candidate of candidates) {
    const resolved = await runCommand(
      "git",
      ["-C", request.workspace, "rev-parse", "--verify", "--quiet", candidate],
      PREFLIGHT_TIMEOUT_MS,
    );
    if (resolved.spawnError !== null) {
      return {
        kind: "unreadable",
        part: "history",
        reason: `${resolved.commandLine}: ${resolved.spawnError}`,
      };
    }
    // Exit 1 with no output is "no such ref", which is an answer here and not a
    // failure: the next candidate may resolve. Anything else is git unable to
    // answer, and collapsing the two would report a broken repository as a
    // missing branch.
    if (resolved.status === 0) {
      baseRef = candidate;
      // **Kept rather than discarded, which is the whole of this line's
      // history.** This query already printed the base's full sha and the sha
      // died with the loop iteration; D-0029 rule 10 needs it, and needing it
      // costs a variable rather than a command.
      baseCommit = resolved.stdout.trim();
      break;
    }
    if (resolved.status !== 1) {
      return {
        kind: "unreadable",
        part: "history",
        reason: queryFailure(resolved) ?? resolved.commandLine,
      };
    }
  }
  if (baseRef === null) {
    return {
      kind: "unreadable",
      part: "history",
      reason: `neither ${candidates[0] ?? ""} nor ${candidates[1] ?? ""} is a ref in ${request.workspace}`,
    };
  }
  if (baseCommit === "") {
    // `rev-parse --verify` exiting 0 and printing nothing is git answering in a
    // way this function has no reading of. Refusing beats carrying an empty
    // string into a row that claims to identify a commit.
    return {
      kind: "unreadable",
      part: "history",
      reason: `git rev-parse --verify ${baseRef} in ${request.workspace} printed no sha`,
    };
  }

  // The topic branch, resolved. Not `--verify --quiet` over a bare name: the
  // branch is spelled `refs/heads/...` so a tag or a remote ref of the same
  // name cannot answer for it, which is the mistake `inspectPushTarget` is
  // written to avoid one function above.
  const tip = await runCommand(
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
  const tipFailure = queryFailure(tip);
  if (tipFailure !== null) {
    return { kind: "unreadable", part: "history", reason: tipFailure };
  }
  const tipCommit = tip.stdout.trim();
  if (tipCommit === "") {
    return {
      kind: "unreadable",
      part: "history",
      reason: `git rev-parse --verify refs/heads/${request.topicBranch} in ${request.workspace} printed no sha`,
    };
  }

  const logged = await runCommand(
    "git",
    [
      "-C",
      request.workspace,
      "log",
      "--no-merges",
      "--reverse",
      // A tab cannot appear in an abbreviated sha, so the first one is the
      // separator and every tab after it belongs to the subject.
      "--format=%h%x09%s",
      `${baseRef}..${request.topicBranch}`,
    ],
    PREFLIGHT_TIMEOUT_MS,
  );
  const logFailure = queryFailure(logged);
  if (logFailure !== null) {
    return { kind: "unreadable", part: "history", reason: logFailure };
  }
  const commits: LapCommit[] = [];
  for (const line of logged.stdout.split("\n")) {
    const tab = line.indexOf("\t");
    if (tab <= 0) {
      continue;
    }
    commits.push({ abbreviatedSha: line.slice(0, tab), subject: line.slice(tab + 1).trim() });
  }

  const diffed = await runCommand(
    "git",
    [
      "-C",
      request.workspace,
      // Paths as they are, rather than as C string literals, because this one
      // is read by a person in a pull request and not by a shell.
      "-c",
      "core.quotePath=false",
      "diff",
      "--numstat",
      `${baseRef}...${request.topicBranch}`,
    ],
    PREFLIGHT_TIMEOUT_MS,
  );
  const diffFailure = queryFailure(diffed);
  if (diffFailure !== null) {
    return { kind: "unreadable", part: "history", reason: diffFailure };
  }
  const files: LapFile[] = [];
  for (const line of diffed.stdout.split("\n")) {
    const fields = line.split("\t");
    const added = fields[0];
    const deleted = fields[1];
    const path = fields.slice(2).join("\t");
    if (added === undefined || deleted === undefined || path === "") {
      continue;
    }
    // `-` for both counts is git saying "binary", which is a fact about the
    // file rather than a zero -- printing 0 would claim nothing changed in it.
    files.push({
      path,
      added: added === "-" ? null : Number.parseInt(added, 10),
      deleted: deleted === "-" ? null : Number.parseInt(deleted, 10),
    });
  }

  // **What the branch does not hold** (D-0060 rule 1). `-z` so a path arrives
  // as it is rather than as a C string literal, for the reason the diff above
  // sets `core.quotePath=false`. `--untracked-files=normal` spelled out because
  // `status.showUntrackedFiles=no` in someone's config would otherwise make an
  // untracked file read as absent -- the silent loss this query exists to end.
  // Ignored paths are left out by git's default, which is the repository's own
  // statement that they are not work. A failure is `unreadable`, never "clean".
  const status = await runCommand(
    "git",
    [
      "-C",
      request.workspace,
      "status",
      "--porcelain=v1",
      "-z",
      "--branch",
      "--untracked-files=normal",
    ],
    PREFLIGHT_TIMEOUT_MS,
  );
  const statusFailure = queryFailure(status);
  if (statusFailure !== null) {
    return { kind: "unreadable", part: "status", reason: statusFailure };
  }
  const uncommitted: string[] = [];
  let checkedOut = "";
  const entries = status.stdout.split("\0");
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index] ?? "";
    if (entry.startsWith("## ")) {
      // `topic...origin/topic [ahead 1]` is the branch and its upstream; the
      // branch is the part this names.
      checkedOut = entry.slice(3).split("...")[0] ?? "";
      continue;
    }
    if (entry.length < 4) {
      continue;
    }
    uncommitted.push(entry.slice(3));
    // A rename or copy is followed by its source path as an entry of its own,
    // which is not a second change.
    if (/[RC]/.test(entry.slice(0, 2))) {
      index += 1;
    }
  }

  return {
    kind: "read",
    baseRef,
    baseCommit,
    tipCommit,
    commits,
    files,
    uncommitted,
    checkedOut,
  };
}

/** What {@link readLanding} is asked about one line (D-0073 rule 6). */
export interface LandingRequest {
  /** The repository the line's workspaces were cut from: where git is asked. */
  readonly repository: string;
  /** The remote `publish` pushes to, whose default branch is the forge's. */
  readonly remote: string;
  /** The lineage's first `baseCommit`. */
  readonly baseCommit: string;
  /** Each closed tip's `tipCommit`: what must be on the default branch. */
  readonly tipCommits: readonly string[];
  /**
   * The repository's decision record and the numbers the line holds in it
   * (D-0098 rule 3.7), or null when the plan names no record: read by
   * numbers and added lines instead of by its tree entry.
   */
  readonly record: { readonly path: string; readonly reserved: readonly number[] } | null;
}

/**
 * Whether a line's work is on the default branch (D-0073 rule 6).
 *
 * `undetermined` is its own answer and never a `notLanded`: a fetch that failed
 * or a commit git cannot read says nothing about a merge, and the screen must
 * not say "waiting on a merge" for it (rule 6, `D-0068` rule 2.3).
 */
export type LandingReading =
  | {
      readonly kind: "landed";
      /** The forge's default branch, as the remote named it. */
      readonly branch: string;
      readonly headCommit: string;
      readonly paths: readonly string[];
    }
  | {
      readonly kind: "notLanded";
      readonly branch: string;
      readonly headCommit: string;
      /** The changed paths whose entry on the default branch is not the tip's. */
      readonly differing: readonly string[];
    }
  | { readonly kind: "undetermined"; readonly reason: string };

/**
 * Read whether the default branch holds what a line changed (D-0073 rule 6).
 *
 * **The forge's branch, fetched into a ref rondo owns**, not local `main` or a
 * remote-tracking ref: a squash merge on the forge moves neither until
 * something fetches, and rondo writing `refs/remotes/...` would move a ref the
 * person reads. **Tree entries, not blobs**: for every path a closed tip
 * changed since the lineage's base, the entry at the fetched head equals the
 * entry at the tip -- mode, type and object id -- and a path the tip deleted is
 * absent from both. A change of mode alone keeps the blob and must not read as
 * landed. It holds under squash, where ancestry never fires, and it is sound
 * because no other line held these paths while this one was open (rule 3).
 */
export async function readLanding(request: LandingRequest): Promise<LandingReading> {
  const git = (argv: readonly string[], timeoutMs = PREFLIGHT_TIMEOUT_MS) =>
    runCommand("git", ["-C", request.repository, ...argv], timeoutMs);
  const fetched = await fetchDefaultBranch(git, request.remote);
  if (fetched.kind === "undetermined") {
    return fetched;
  }
  const { branch, headCommit } = fetched;
  const headTree = await treeEntries(git, headCommit);
  if (typeof headTree === "string") {
    return { kind: "undetermined", reason: headTree };
  }
  const paths = new Set<string>();
  const differing = new Set<string>();
  for (const tip of request.tipCommits) {
    const changed = await changedBetween(git, request.baseCommit, tip);
    if (typeof changed === "string") {
      return { kind: "undetermined", reason: changed };
    }
    // **What the line took in is not its work** (D-0098 rule 2, D-0103): a tip
    // that merged the default branch's commit X changes, since the lineage's
    // base, every path X brought -- and a later landing on one of those would
    // leave the line `notLanded` for good. So a path counts only if the tip
    // also changed it since its merge-base with the fetched head, which drops
    // X's paths. Kept as an intersection, not a replacement, so a line cut
    // from a branch other than the default one (whose merge-base with the
    // head is older than its base) still reads exactly its own paths.
    const own = await changedBetween(git, headCommit, tip);
    if (typeof own === "string") {
      return { kind: "undetermined", reason: own };
    }
    const ownPaths = new Set(own);
    const tipTree = await treeEntries(git, tip);
    if (typeof tipTree === "string") {
      return { kind: "undetermined", reason: tipTree };
    }
    // The decision record is read by numbers and added lines below, never by
    // its tree entry: another line appends to it too (D-0098 rule 3.7).
    for (const path of changed.filter(
      (each) => ownPaths.has(each) && each !== request.record?.path,
    )) {
      paths.add(path);
      if (tipTree.get(path) !== headTree.get(path)) {
        differing.add(path);
      }
    }
  }
  if (request.record !== null) {
    const record = await recordLanding(git, request, headCommit);
    if (typeof record === "string") {
      return { kind: "undetermined", reason: record };
    }
    if (record.part) {
      paths.add(request.record.path);
    }
    if (record.missing !== null) {
      differing.add(`${request.record.path} (${record.missing})`);
    }
  }
  return differing.size === 0
    ? { kind: "landed", branch, headCommit, paths: [...paths].sort() }
    : { kind: "notLanded", branch, headCommit, differing: [...differing].sort() };
}

/**
 * The forge's default branch, fetched into a ref rondo owns (D-0073 rule 6):
 * its name and the commit it points at, or why not. **One fetch for the
 * landing reading and for the decision record's floor** (D-0098 rule 3.3), so
 * the two cannot read the default branch two ways.
 *
 * **The forge's default branch, asked of the forge**, and not the plan's base
 * branch: a line cut from `develop` has not landed on the default branch
 * because it merged into `develop` (rule 6). A remote that will not name its
 * HEAD leaves the reading undetermined. `--refmap=` (empty) is load-bearing:
 * with an explicit refspec, a fetch from a configured remote also moves that
 * remote's tracking ref, which is the person's and not rondo's to move;
 * `--no-write-fetch-head` keeps two readings at once off the one file every
 * fetch would otherwise rewrite. Two readings can still race for the landing
 * ref's lock; the loser is undetermined and is read again.
 */
async function fetchDefaultBranch(
  git: (argv: readonly string[], timeoutMs?: number) => Promise<CommandOutcome>,
  remote: string,
): Promise<
  | { readonly kind: "fetched"; readonly branch: string; readonly headCommit: string }
  | { readonly kind: "undetermined"; readonly reason: string }
> {
  const symref = await git(["ls-remote", "--symref", remote, "HEAD"], FORGE_TIMEOUT_MS);
  const symrefFailure = queryFailure(symref);
  const named = /^ref: refs\/heads\/(\S+)\tHEAD$/m.exec(symref.stdout)?.[1];
  if (symrefFailure !== null || named === undefined) {
    return {
      kind: "undetermined",
      reason: `the forge's default branch could not be named: ${symrefFailure ?? "no HEAD symref"}`,
    };
  }
  const branch = named;
  const ref = `refs/rondo/landing/${remote}/${branch}`;
  const fetched = await git(
    [
      "fetch",
      "--no-tags",
      "--no-write-fetch-head",
      "--refmap=",
      remote,
      `+refs/heads/${branch}:${ref}`,
    ],
    FORGE_TIMEOUT_MS,
  );
  const fetchFailure = queryFailure(fetched);
  if (fetchFailure !== null) {
    return {
      kind: "undetermined",
      reason: `the default branch could not be fetched: ${fetchFailure}`,
    };
  }
  const head = await git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
  const headCommit = head.stdout.trim();
  if (queryFailure(head) !== null || headCommit === "") {
    return { kind: "undetermined", reason: `git could not say what ${ref} points at` };
  }
  return { kind: "fetched", branch, headCommit };
}

/**
 * A file's text at `commit`, "" when the commit has no such file, or why git
 * would not say. `ls-tree` first, so a missing record reads as empty rather
 * than as a failure.
 */
async function textAt(
  git: (argv: readonly string[]) => Promise<CommandOutcome>,
  commit: string,
  path: string,
): Promise<string | { readonly failure: string }> {
  const listed = await git(["ls-tree", "-z", commit, "--", path]);
  const listFailure = queryFailure(listed);
  if (listFailure !== null) {
    return { failure: listFailure };
  }
  if (!listed.stdout.includes(" blob ")) {
    return "";
  }
  const shown = await git(["cat-file", "blob", `${commit}:${path}`]);
  const failure = queryFailure(shown);
  return failure === null ? shown.stdout : { failure };
}

/**
 * The non-blank lines `tip` added to `path` since it forked off `base`, or
 * why git would not say: the `+` lines of `git diff base...tip -- path`, the
 * range {@link changedBetween} reads (D-0098 rules 3.6 and 3.7).
 */
async function addedLines(
  git: (argv: readonly string[]) => Promise<CommandOutcome>,
  base: string,
  tip: string,
  path: string,
): Promise<readonly string[] | { readonly failure: string }> {
  const diff = await git([
    "diff",
    "--no-color",
    "--no-ext-diff",
    "--no-textconv",
    "--no-renames",
    "-U0",
    `${base}...${tip}`,
    "--",
    path,
  ]);
  const failure = queryFailure(diff);
  if (failure !== null) {
    return { failure };
  }
  // Only inside hunks, so the `+++ b/<path>` header is never read as a line.
  const body = diff.stdout.split("\n");
  const firstHunk = body.findIndex((line) => line.startsWith("@@"));
  return body
    .slice(firstHunk === -1 ? body.length : firstHunk)
    .filter((line) => line.startsWith("+"))
    .map((line) => line.slice(1))
    .filter((line) => line.trim() !== "");
}

/**
 * Whether the default branch holds a line's work on its decision record
 * (D-0098 rule 3.7): a heading and an index row for each reservation, and
 * every non-blank line its closed tips added, annotations included. `part` is
 * whether the record is in this line's landing at all: a line with no
 * reservation that added nothing to it is not read on it, and a line with
 * none is read by its added lines alone -- an empty set is never "landed" on
 * its own. `missing` says what is not there, or null.
 */
async function recordLanding(
  git: (argv: readonly string[]) => Promise<CommandOutcome>,
  request: LandingRequest,
  headCommit: string,
): Promise<{ readonly part: boolean; readonly missing: string | null } | string> {
  const record = request.record;
  if (record === null) {
    return { part: false, missing: null };
  }
  const added: string[] = [];
  for (const tip of request.tipCommits) {
    const lines = await addedLines(git, request.baseCommit, tip, record.path);
    if ("failure" in lines) {
      return lines.failure;
    }
    added.push(...lines);
  }
  if (record.reserved.length === 0 && added.length === 0) {
    return { part: false, missing: null };
  }
  const text = await textAt(git, headCommit, record.path);
  if (typeof text !== "string") {
    return text.failure;
  }
  const numbers = recordNumbers(text);
  const absent = record.reserved.find(
    (number) => !numbers.headings.includes(number) || !numbers.indexRows.includes(number),
  );
  if (absent !== undefined) {
    return {
      part: true,
      missing: `${recordNumber(absent)} has no heading and index row there`,
    };
  }
  const there = new Set(text.split("\n"));
  return {
    part: true,
    missing: added.every((line) => there.has(line)) ? null : "a line it added is not there",
  };
}

/** What {@link readRecordFloor} found on the forge's default branch (D-0098 rule 3.3). */
export type RecordFloor =
  | { readonly kind: "read"; readonly floor: number; readonly headCommit: string }
  | { readonly kind: "undetermined"; readonly reason: string };

/**
 * The highest number the forge's default branch's decision record spells, in a
 * heading or an index row, or 0 when it has no such file (D-0098 rule 3.3).
 * Fetched as the landing reading fetches ({@link fetchDefaultBranch}), so the
 * number an admission hands out is above what is merged now, not what the
 * clone last pulled.
 */
export async function readRecordFloor(request: {
  readonly repository: string;
  readonly remote: string;
  readonly record: string;
}): Promise<RecordFloor> {
  const git = (argv: readonly string[], timeoutMs = PREFLIGHT_TIMEOUT_MS) =>
    runCommand("git", ["-C", request.repository, ...argv], timeoutMs);
  const fetched = await fetchDefaultBranch(git, request.remote);
  if (fetched.kind === "undetermined") {
    return fetched;
  }
  const text = await textAt(git, fetched.headCommit, request.record);
  if (typeof text !== "string") {
    return { kind: "undetermined", reason: text.failure };
  }
  const numbers = recordNumbers(text);
  return {
    kind: "read",
    floor: Math.max(0, ...numbers.headings, ...numbers.indexRows),
    headCommit: fetched.headCommit,
  };
}

/**
 * The entry numbers a lap added to its decision record, in headings and index
 * rows, from `base...tip` (D-0098 rule 3.6): what the gate tests against the
 * line's reservations.
 */
export async function readRecordAdditions(request: {
  readonly repository: string;
  readonly baseCommit: string;
  readonly tipCommit: string;
  readonly record: string;
}): Promise<
  | { readonly kind: "read"; readonly numbers: readonly number[] }
  | { readonly kind: "undetermined"; readonly reason: string }
> {
  const lines = await addedLines(
    (argv) => runCommand("git", ["-C", request.repository, ...argv], PREFLIGHT_TIMEOUT_MS),
    request.baseCommit,
    request.tipCommit,
    request.record,
  );
  if ("failure" in lines) {
    return { kind: "undetermined", reason: lines.failure };
  }
  const numbers = recordNumbers(lines.join("\n"));
  return {
    kind: "read",
    numbers: [...new Set([...numbers.headings, ...numbers.indexRows])].sort((a, b) => a - b),
  };
}

/** Which branch a first lap is cut from, and where to fetch it (rondo#407). */
export interface LapBaseRequest {
  /** The repository the workspace is cut from: where git is asked. */
  readonly repository: string;
  /** The remote `publish` pushes to, whose branch the lap must start from. */
  readonly remote: string;
  /** The plan's base branch, as the forge names it. */
  readonly baseBranch: string;
  /** The lap's run id, which names the branch this lap alone is cut from. */
  readonly runId: string;
}

/**
 * Fetch the forge's base branch into a local branch of this lap's own, for
 * continuo to cut a first lap's workspace from (rondo#407, D-0100).
 *
 * **The forge's branch as it is now, not the clone's.** A clone's `main` is
 * whatever it was when someone last pulled, and a lap cut from it works on a
 * stale base (lap 12 recorded a decision number `main` already had). continuo
 * accepts only a local branch (`refs/heads/<name>`), and the clone's own
 * `main` is usually checked out, which a fetch refuses to move -- so the
 * branch is the lap's: `rondo/base/<runId>`, which no other lap writes.
 *
 * **Nothing shared is written by the fetch that decides the lap.** `--refmap=`
 * (empty) keeps it off `refs/remotes/<remote>/<branch>`, so two laps admitted
 * at the same instant take no common ref lock and neither is refused for the
 * other (the parallel lanes of D-0098); `--no-write-fetch-head` likewise, for
 * the one file every fetch would otherwise rewrite. The remote-tracking ref is moved
 * afterwards by a plain fetch whose failure is ignored: `inspectLapWork` reads
 * the base there first, and a lock lost to a concurrent fetch is that fetch
 * writing the same forge head.
 *
 * A fetch of the lap's branch that fails is a lap that does not start, and the
 * reason says why.
 */
export async function fetchLapBase(
  request: LapBaseRequest,
): Promise<
  | { readonly kind: "fetched"; readonly branch: string; readonly commit: string }
  | { readonly kind: "refused"; readonly reason: string }
> {
  const branch = `rondo/base/${request.runId}`;
  const git = (argv: readonly string[]) =>
    runCommand("git", [
      "-C",
      request.repository,
      "fetch",
      "--no-tags",
      "--no-write-fetch-head",
      ...argv,
    ]);
  const failure = queryFailure(
    await git([
      "--refmap=",
      request.remote,
      `+refs/heads/${request.baseBranch}:refs/heads/${branch}`,
    ]),
  );
  if (failure !== null) {
    return {
      kind: "refused",
      reason:
        `rondo cuts a lap from ${request.remote}/${request.baseBranch} as the forge has it now, ` +
        `and could not fetch it: ${failure}. No run was admitted; fetch access to the forge ` +
        "is what lets the lap start.",
    };
  }
  await git([request.remote, `refs/heads/${request.baseBranch}`]);
  // **The commit, named** (D-0098 rule 2.2): a take-in tells the lap which
  // commit to bring in and the gate tests that very commit, so it is read off
  // the lap's own branch now rather than off a ref that may move later.
  const resolved = await runCommand(
    "git",
    ["-C", request.repository, "rev-parse", "--verify", "--quiet", `refs/heads/${branch}^{commit}`],
    PREFLIGHT_TIMEOUT_MS,
  );
  const commit = resolved.stdout.trim();
  if (queryFailure(resolved) !== null || commit === "") {
    return {
      kind: "refused",
      reason: `rondo fetched ${request.remote}/${request.baseBranch} into '${branch}' and git could not say what it points at.`,
    };
  }
  return { kind: "fetched", branch, commit };
}

/**
 * Whether `ancestor` is an ancestor of `descendant` in `repository`
 * (D-0098 rule 2.3's test), by `git merge-base --is-ancestor`.
 *
 * Exit 0 is yes and exit 1 is no; **anything else is undetermined and its own
 * answer** -- a commit git cannot read says nothing about ancestry, and the
 * gate must not read it as either (never a silent clear).
 */
export async function isAncestor(request: {
  readonly repository: string;
  readonly ancestor: string;
  readonly descendant: string;
}): Promise<"yes" | "no" | { readonly undetermined: string }> {
  const outcome = await runCommand(
    "git",
    ["-C", request.repository, "merge-base", "--is-ancestor", request.ancestor, request.descendant],
    PREFLIGHT_TIMEOUT_MS,
  );
  if (outcome.spawnError === null && outcome.status === 0) {
    return "yes";
  }
  if (outcome.spawnError === null && outcome.status === 1) {
    return "no";
  }
  return { undetermined: queryFailure(outcome) ?? `${outcome.commandLine} did not answer` };
}

/**
 * The paths changed from where `tip` forked off `base` to `tip`, or why git
 * would not say. Three dots, so a base that moved while the line ran (another
 * line landed, a fetch) is not this line's work. `--ignore-submodules=none` so
 * a gitlink bump is never hidden by `.gitmodules` or the person's config.
 */
async function changedBetween(
  git: (argv: readonly string[]) => Promise<CommandOutcome>,
  base: string,
  tip: string,
): Promise<readonly string[] | string> {
  const changed = await git([
    "diff",
    "--name-only",
    "-z",
    "--no-renames",
    "--ignore-submodules=none",
    `${base}...${tip}`,
  ]);
  return queryFailure(changed) ?? changed.stdout.split("\0").filter((path) => path !== "");
}

/** What {@link readChangedPaths} is asked: one lap's range, in its repository. */
export interface ChangedPathsRequest {
  readonly repository: string;
  readonly baseCommit: string;
  readonly tipCommit: string;
}

export type ChangedPathsReading =
  | { readonly kind: "read"; readonly paths: readonly string[] }
  | { readonly kind: "undetermined"; readonly reason: string };

/**
 * The paths a lap changed (D-0073 rule 5), the set {@link readLanding} reads
 * per closed tip, so the gate and the landing never disagree on what a lap
 * changed.
 */
export async function readChangedPaths(request: ChangedPathsRequest): Promise<ChangedPathsReading> {
  const changed = await changedBetween(
    (argv) => runCommand("git", ["-C", request.repository, ...argv], PREFLIGHT_TIMEOUT_MS),
    request.baseCommit,
    request.tipCommit,
  );
  return typeof changed === "string"
    ? { kind: "undetermined", reason: changed }
    : { kind: "read", paths: changed };
}

/**
 * Every entry of a commit's tree, recursively, as `mode type oid` by path, or
 * why git would not list it. `-t` lists the trees too, so a file one side
 * deleted and the other replaced with a directory of the same name differs
 * rather than reading as absent from both.
 */
async function treeEntries(
  git: (argv: readonly string[]) => Promise<CommandOutcome>,
  commit: string,
): Promise<ReadonlyMap<string, string> | string> {
  const listed = await git(["ls-tree", "-r", "-t", "-z", "--full-tree", commit]);
  const failure = queryFailure(listed);
  if (failure !== null) {
    return failure;
  }
  const entries = new Map<string, string>();
  for (const record of listed.stdout.split("\0")) {
    const tab = record.indexOf("\t");
    if (tab > 0) {
      entries.set(record.slice(tab + 1), record.slice(0, tab));
    }
  }
  return entries;
}

/**
 * What `git` handed over for a model reading (D-0065 1.2.1, 1.2.2, 1.2.6).
 *
 * Facts again, for `LapWorkInspection`'s reason: what the reviewer is handed and
 * how it is laid out is decided in `./model-review/judgement.ts`, a pure function over this.
 */
export type ReviewMaterialFacts =
  | {
      readonly kind: "read";
      /** `git diff base...tip`, the committed bytes (no textconv, no external diff). */
      readonly diff: string;
      /** Full sha and full message, oldest first. */
      readonly commits: readonly { readonly sha: string; readonly message: string }[];
      /** Each rule file's content at `baseCommit`, in the order the criterion named them. */
      readonly ruleFiles: readonly { readonly path: string; readonly content: string }[];
    }
  | { readonly kind: "unreadable"; readonly reason: string };

/**
 * Read the range the deterministic reading resolved, by its shas and not by
 * branch names, so the model reading is about the same commits (D-0065 1.2.1)
 * even if the branch moved since.
 *
 * **A rule file the criterion names and the base does not hold is unreadable,
 * not skipped.** A document that silently lacks a rule the plan said to grade
 * against would carry a delivered digest over a criterion the reviewer never saw.
 */
export async function gatherReviewMaterialFacts(request: {
  readonly workspace: string;
  readonly evidence: ReadingEvidence;
  readonly ruleFiles: readonly string[];
}): Promise<ReviewMaterialFacts> {
  const { workspace, evidence } = request;
  const diffed = await runCommand(
    "git",
    [
      "-C",
      workspace,
      "-c",
      "core.quotePath=false",
      "diff",
      "--no-color",
      "--no-ext-diff",
      "--no-textconv",
      `${evidence.baseCommit}...${evidence.tipCommit}`,
    ],
    PREFLIGHT_TIMEOUT_MS,
  );
  const diffFailure = queryFailure(diffed);
  if (diffFailure !== null) {
    return { kind: "unreadable", reason: diffFailure };
  }

  // NUL after the sha and NUL after the message, and nothing else as a
  // separator: a commit message holding a NUL is one git itself refuses to
  // write, so every other byte of a message survives (an RS or any control byte
  // a message may legitimately hold included). Output that is not exactly
  // sha/message pairs is unreadable rather than skipped -- a skipped commit is a
  // delivered digest over a range with a message missing.
  //
  // `--no-merges` keeps the commits the deterministic reading counted
  // (`inspectLapWork`), so a merge commit's message is not handed over; its
  // content still is, through the range's diff.
  const logged = await runCommand(
    "git",
    [
      "-C",
      workspace,
      "log",
      "--no-merges",
      "--reverse",
      "--no-show-signature",
      "--format=%H%x00%B%x00",
      `${evidence.baseCommit}..${evidence.tipCommit}`,
    ],
    PREFLIGHT_TIMEOUT_MS,
  );
  const logFailure = queryFailure(logged);
  if (logFailure !== null) {
    return { kind: "unreadable", reason: logFailure };
  }
  // `sha NUL message NUL` per commit, with the newline git puts between
  // entries leading the next sha; the last field is what follows the last NUL.
  const fields = logged.stdout.split("\0");
  const trailer = fields.pop() ?? "";
  if (fields.length % 2 !== 0 || trailer.trim() !== "") {
    return { kind: "unreadable", reason: `${logged.commandLine}: output is not sha/message pairs` };
  }
  const commits: { sha: string; message: string }[] = [];
  for (let index = 0; index < fields.length; index += 2) {
    const sha = (fields[index] ?? "").replace(/^\n/, "");
    if (!/^[0-9a-f]{40,64}$/.test(sha)) {
      return {
        kind: "unreadable",
        reason: `${logged.commandLine}: output is not sha/message pairs`,
      };
    }
    commits.push({ sha, message: (fields[index + 1] ?? "").trim() });
  }

  const ruleFiles: { path: string; content: string }[] = [];
  for (const path of request.ruleFiles) {
    const shown = await runCommand(
      "git",
      ["-C", workspace, "show", "--no-textconv", `${evidence.baseCommit}:${path}`],
      PREFLIGHT_TIMEOUT_MS,
    );
    const showFailure = queryFailure(shown);
    if (showFailure !== null) {
      return {
        kind: "unreadable",
        reason: `rule file '${path}' could not be read at ${evidence.baseCommit}: ${showFailure}`,
      };
    }
    ruleFiles.push({ path, content: shown.stdout });
  }

  return { kind: "read", diff: diffed.stdout, commits, ruleFiles };
}

/**
 * How long a model reviewer may take over one document.
 *
 * ponytail: picked, not measured. A reasoning model over a few hundred kilobytes
 * takes minutes; fifteen is past that and short of a hang nobody notices. The
 * reading runs after `drive()` returned and occupies no capacity (D-0065 2.6),
 * so what this bounds is the operator's terminal, not the loop.
 */
const REVIEWER_TIMEOUT_MS = 900_000;

/**
 * The codex features the reviewer is started without (codex-cli 0.153.4,
 * `codex features list`). A denylist, so a later codex can add a tool this does
 * not name: that is why {@link runReviewer} still refuses any tool event.
 * ponytail: a denylist by version, a no-tools codex surface when one exists.
 */
const REVIEWER_DISABLED_FEATURES = Object.freeze([
  "shell_tool",
  "unified_exec",
  "apps",
  "plugins",
  "remote_plugin",
  "browser_use",
  "browser_use_external",
  "computer_use",
  "in_app_browser",
  "code_mode_host",
  "image_generation",
  "multi_agent",
  "collaboration_modes",
  "goals",
  "hooks",
  "skill_search",
  "tool_suggest",
]);

/** How long one reviewer-supplied message may be inside a persisted reason. */
const REVIEWER_MESSAGE_BOUND = 300;

/**
 * A reviewer-supplied string as a reason may carry it: printable ASCII, bounded.
 * Never stderr -- codex echoes the whole handed-over document there, and a
 * reason is persisted.
 */
function boundedAscii(text: string): string {
  const ascii = text.replace(/[^\x20-\x7e]/g, "?");
  return ascii.length > REVIEWER_MESSAGE_BOUND
    ? `${ascii.slice(0, REVIEWER_MESSAGE_BOUND)}...`
    : ascii;
}

/** The item types a reading over the delivered bytes alone may contain. */
const READING_ITEM_TYPES: ReadonlySet<string> = new Set(["agent_message", "reasoning"]);

/** What rondo reads out of `codex exec --json`'s event stream. */
type ReviewerEvents =
  | { readonly kind: "unparseable"; readonly line: number }
  | {
      readonly kind: "read";
      /** The text of the last completed `agent_message`, if there was one. */
      readonly finalMessage: string | null;
      /** Item types outside `READING_ITEM_TYPES`, in first-seen order. */
      readonly otherItems: readonly string[];
      /** `turn.failed` and `error` events' messages. */
      readonly errors: readonly string[];
    };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readReviewerEvents(stdout: string): ReviewerEvents {
  let finalMessage: string | null = null;
  const otherItems: string[] = [];
  const errors: string[] = [];
  // **An `error` item before the turn starts is a startup notice, not a tool.**
  // Disabling `code_mode_host` makes codex announce, before `turn.started`,
  // that code mode "will fail closed" -- which is the point of disabling it.
  // Nothing can be run or fetched before the turn begins, so only that one
  // shape is let through; inside the turn every non-reading item still fails
  // the run.
  let turnStarted = false;
  const lines = stdout.split("\n");
  for (const [index, raw] of lines.entries()) {
    const line = raw.trim();
    if (line === "") {
      continue;
    }
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      return { kind: "unparseable", line: index + 1 };
    }
    if (!isObject(event) || typeof event.type !== "string") {
      return { kind: "unparseable", line: index + 1 };
    }
    if (event.type === "turn.started") {
      turnStarted = true;
      continue;
    }
    if (
      !turnStarted &&
      event.type === "item.completed" &&
      isObject(event.item) &&
      event.item.type === "error"
    ) {
      continue;
    }
    if (
      event.type === "item.started" ||
      event.type === "item.completed" ||
      event.type === "item.updated"
    ) {
      const item = event.item;
      const itemType =
        isObject(item) && typeof item.type === "string" ? item.type : "(untyped item)";
      if (!READING_ITEM_TYPES.has(itemType)) {
        if (!otherItems.includes(itemType)) {
          otherItems.push(itemType);
        }
      } else if (
        event.type === "item.completed" &&
        itemType === "agent_message" &&
        isObject(item) &&
        typeof item.text === "string"
      ) {
        finalMessage = item.text;
      }
    } else if (event.type === "turn.failed") {
      const error = event.error;
      errors.push(
        isObject(error) && typeof error.message === "string" ? error.message : "turn.failed",
      );
    } else if (event.type === "error") {
      errors.push(typeof event.message === "string" ? event.message : "error");
    }
  }
  return { kind: "read", finalMessage, otherItems, errors };
}

/**
 * Run the reviewer over one document, and nothing else (D-0065 1.1).
 *
 * **The document is on standard input and the directory is empty.** The review
 * surface that lets the reviewer run `git` in the workspace is not used: what it
 * read would be its own account. So the process is started in a fresh empty
 * directory (`-C`), `--ephemeral` so no session is kept, and `-` so the prompt
 * is exactly the bytes written. It inherits the environment, so the login is the
 * operator's own codex login and rondo holds no credential (D-0010, D-0065 3.2).
 *
 * **"Ran nothing" is checked, not hoped for.** Measured on 2026-09-13 with
 * codex-cli 0.153.4: `-s read-only` blocks writes but still runs shell
 * commands, and `-c features.shell_tool=false` is what removes the shell tool
 * (`tools.web_search=false` likewise the fetch). Those flags are the intent;
 * the proof is `--json`, whose stdout is one event per line. A run whose events
 * hold any item other than an agent message or reasoning -- a command, a tool
 * call, a web search, a file change, a type rondo does not know -- is failed,
 * because its reading is not over the delivered bytes only (D-0065 rule 1.1).
 * So is a line that is not a JSON event, a run with no agent message, and a run
 * reporting `turn.failed` or `error`. The answer is the last completed agent
 * message.
 *
 * **Tools are taken away before the run, not only refused after it** (Codex
 * gate round 3: a tool with a remote side effect is not undone by refusing its
 * event). `--ignore-user-config` drops the operator's `config.toml`, and with
 * it every MCP server configured there, while auth still comes from
 * `CODEX_HOME`; {@link REVIEWER_DISABLED_FEATURES} turns off the built-in
 * connectors, browsers, image generation and agent spawning that version
 * exposes. **What that does not reach**, measured the same day by asking the
 * model to list its tools: a code-mode `exec`, `web__run`, `apply_patch` (held
 * by `-s read-only`) and the collaboration tools stayed listed, and codex has
 * no flag rondo found that runs a turn with no tools at all. So the event check
 * above remains the proof, and a residual reported beside D-0065 1.1.
 *
 * **What the delivered digest proves.** It is over the string `runCommand`
 * wrote, and a run is `answered` only when that write finished in full before
 * the process was reaped: rondo wrote these bytes to the reviewer's standard
 * input. It does not prove the model attended to them (D-0029 rule 11 compares
 * it against the document prepared).
 *
 * A failed reason carries the exit status or signal and the event stream's
 * error messages, bounded ASCII -- never stderr, where codex echoes the document.
 */
export async function runReviewer(
  row: ReviewerRow,
  document: string,
  timeoutMs: number = REVIEWER_TIMEOUT_MS,
): Promise<ReviewerRun> {
  let directory: string;
  try {
    directory = mkdtempSync(join(tmpdir(), "rondo-reviewer-"));
  } catch (error) {
    return {
      kind: "failed",
      reason: `no empty directory for the reviewer: ${hostFailure(error).text}`,
    };
  }
  try {
    const outcome = await runCommand(
      row.executable,
      [
        "exec",
        "--json",
        "-m",
        row.model,
        "-s",
        "read-only",
        "--skip-git-repo-check",
        "--ephemeral",
        "--color",
        "never",
        "--ignore-user-config",
        // Pinned here rather than inherited from the ignored config.
        // ponytail: measured on 2026-09-13, with the config ignored about a
        // third of the two-finding answers came back as JSON cut short of its
        // closing brackets, which is an unavailable reading (fail closed) and
        // noise; with the config kept, none did. Cause not found; codex's
        // `--output-schema` (a file rondo would have to write) is the candidate.
        "-c",
        "model_reasoning_effort=medium",
        ...REVIEWER_DISABLED_FEATURES.flatMap((feature) => ["-c", `features.${feature}=false`]),
        "-c",
        "tools.web_search=false",
        "-C",
        directory,
        "-",
      ],
      timeoutMs,
      { input: document },
    );
    if (outcome.spawnError !== null) {
      return { kind: "failed", reason: `${outcome.commandLine}: ${outcome.spawnError}` };
    }
    const events = readReviewerEvents(outcome.stdout);
    if (events.kind === "unparseable") {
      return {
        kind: "failed",
        reason: `${outcome.commandLine}: stdout line ${String(events.line)} is not a JSON event, so the events are unparseable`,
      };
    }
    if (events.otherItems.length > 0) {
      return {
        kind: "failed",
        reason:
          `the reviewer ran or fetched something (${events.otherItems.map(boundedAscii).join(", ")}), ` +
          "so its reading is not over the delivered bytes only (D-0065 rule 1.1)",
      };
    }
    const said = events.errors.map(boundedAscii).join("; ");
    if (outcome.status !== 0 || events.errors.length > 0) {
      const ended =
        outcome.signal !== null
          ? `was killed by ${outcome.signal}`
          : `exited ${String(outcome.status)}`;
      return {
        kind: "failed",
        reason: `${outcome.commandLine} ${ended}${said === "" ? "" : `: ${said}`}`,
      };
    }
    if (events.finalMessage === null) {
      return { kind: "failed", reason: `${outcome.commandLine}: no agent message in its events` };
    }
    return {
      kind: "answered",
      finalMessage: events.finalMessage.trim(),
      deliveredDigest: contentDigest({ delivered: document }),
    };
  } finally {
    try {
      rmSync(directory, { recursive: true, force: true });
    } catch {
      // An empty directory left in the temp dir costs nothing; a throw here
      // would lose a reading that was already taken.
    }
  }
}

/**
 * How long the model drafter may take over one document (D-0071 rule 1.5).
 *
 * ponytail: picked, not measured, on {@link REVIEWER_TIMEOUT_MS}'s reasoning. A
 * draft runs off the message write and nobody waits on it (rule 3.4).
 */
const DRAFTER_TIMEOUT_MS = 600_000;

/**
 * The `claude` flags that make a run of the drafter a reading over one
 * document (D-0071 rule 1.3), measured against claude 2.1.277 on 2026-09-19:
 *
 * - `--tools ""` removes every built-in tool, and `--strict-mcp-config` with no
 *   `--mcp-config` every MCP server, so there is nothing to call;
 * - `--safe-mode` drops the operator's own CLAUDE.md, skills, hooks and plugins,
 *   so the drafter is handed rondo's document and not the operator's setup,
 *   while keeping the operator's login (`--bare` would refuse an OAuth login,
 *   and rondo holds no key: D-0010);
 * - `--no-session-persistence` leaves no resumable session behind.
 *
 * "No tools" is the property and these flags are one way to it, so
 * {@link runDrafter} still refuses an answer that reports a tool call.
 */
const DRAFTER_FLAGS = Object.freeze([
  "--output-format",
  "json",
  "--tools",
  "",
  "--safe-mode",
  "--strict-mcp-config",
  "--no-session-persistence",
]);

/**
 * Run the model drafter once over `document`, handed on standard input, in an
 * empty directory (D-0071 rule 1.3), and read its one JSON result.
 *
 * A failure is a value: a spawn error, a non-zero exit, output that is not the
 * CLI's result object, an error result, or **any sign of a tool call** -- more
 * than one turn, a permission denial or a server-side tool request -- is
 * `failed`, which the caller turns into an unavailable run (rule 1.5).
 */
export async function runDrafter(
  row: DrafterRow,
  document: string,
  timeoutMs: number = DRAFTER_TIMEOUT_MS,
): Promise<DrafterRun> {
  let directory: string;
  try {
    directory = mkdtempSync(join(tmpdir(), "rondo-drafter-"));
  } catch (error) {
    return {
      kind: "failed",
      reason: `no empty directory for the drafter: ${hostFailure(error).text}`,
    };
  }
  try {
    const outcome = await runCommand(
      row.executable,
      ["-p", "--model", row.model, ...DRAFTER_FLAGS],
      timeoutMs,
      { input: document, cwd: directory },
    );
    if (outcome.spawnError !== null) {
      return { kind: "failed", reason: `${outcome.commandLine}: ${outcome.spawnError}` };
    }
    if (outcome.status !== 0) {
      const ended =
        outcome.signal !== null
          ? `was killed by ${outcome.signal}`
          : `exited ${String(outcome.status)}`;
      return { kind: "failed", reason: `${outcome.commandLine} ${ended}` };
    }
    return readDrafterResult(outcome.stdout, outcome.commandLine);
  } finally {
    try {
      rmSync(directory, { recursive: true, force: true });
    } catch {
      // As runReviewer: an empty temp directory left behind costs nothing.
    }
  }
}

/** `claude -p --output-format json`'s one result object, read strictly. Exported for its test. */
export function readDrafterResult(stdout: string, commandLine: string): DrafterRun {
  let result: unknown;
  try {
    result = JSON.parse(stdout);
  } catch {
    return { kind: "failed", reason: `${commandLine}: its output is not one JSON object` };
  }
  if (!isObject(result) || result["type"] !== "result") {
    return { kind: "failed", reason: `${commandLine}: its output is not a result object` };
  }
  if (result["is_error"] !== false || result["subtype"] !== "success") {
    return {
      kind: "failed",
      reason: `${commandLine}: the run ended in an error (${boundedAscii(String(result["subtype"]))})`,
    };
  }
  const denials = result["permission_denials"];
  const usage = isObject(result["usage"]) ? result["usage"] : {};
  const server = isObject(usage["server_tool_use"]) ? usage["server_tool_use"] : {};
  const serverCalls = Object.values(server).some((n) => typeof n === "number" && n > 0);
  if (result["num_turns"] !== 1 || (Array.isArray(denials) && denials.length > 0) || serverCalls) {
    return {
      kind: "failed",
      reason:
        "the drafter reported a tool call, so its draft is not over the delivered document " +
        "only (D-0071 rule 1.3)",
    };
  }
  const text = result["result"];
  if (typeof text !== "string") {
    return { kind: "failed", reason: `${commandLine}: the result carries no text` };
  }
  const cost = result["total_cost_usd"];
  return {
    kind: "answered",
    finalMessage: text.trim(),
    costUsd: typeof cost === "number" && Number.isFinite(cost) && cost >= 0 ? cost : null,
  };
}
