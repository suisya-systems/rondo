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
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ReviewerRow } from "../continuo/roles.js";
import { contentDigest } from "../store/plan.js";
import type { ReadingEvidence } from "../store/records.js";

import type { ReviewerRun } from "./model-review.js";

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
  options: { readonly input?: string } = {},
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
 * What the lap actually did to the workspace, as `git` reports it.
 *
 * Facts again, and for the same reason `PushTargetInspection` is: what a pull
 * request's title and body are made of is a rule about pull requests, and it
 * lives in `./cli.ts` as a pure function over this value.
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
  | { readonly kind: "unreadable"; readonly reason: string };

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
      return { kind: "unreadable", reason: `${resolved.commandLine}: ${resolved.spawnError}` };
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
      return { kind: "unreadable", reason: queryFailure(resolved) ?? resolved.commandLine };
    }
  }
  if (baseRef === null) {
    return {
      kind: "unreadable",
      reason: `neither ${candidates[0] ?? ""} nor ${candidates[1] ?? ""} is a ref in ${request.workspace}`,
    };
  }
  if (baseCommit === "") {
    // `rev-parse --verify` exiting 0 and printing nothing is git answering in a
    // way this function has no reading of. Refusing beats carrying an empty
    // string into a row that claims to identify a commit.
    return {
      kind: "unreadable",
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
    return { kind: "unreadable", reason: tipFailure };
  }
  const tipCommit = tip.stdout.trim();
  if (tipCommit === "") {
    return {
      kind: "unreadable",
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
    return { kind: "unreadable", reason: logFailure };
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
    return { kind: "unreadable", reason: diffFailure };
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
    return { kind: "unreadable", reason: statusFailure };
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

/**
 * What `git` handed over for a model reading (D-0065 1.2.1, 1.2.2, 1.2.6).
 *
 * Facts again, for `LapWorkInspection`'s reason: what the reviewer is handed and
 * how it is laid out is decided in `./model-review.ts`, a pure function over this.
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
      reason: `no empty directory for the reviewer: ${error instanceof Error ? error.message : String(error)}`,
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
        "-c",
        "features.shell_tool=false",
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
