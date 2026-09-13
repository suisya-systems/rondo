/**
 * `inspectLapWork` over a real repository, for the one fact a unit case cannot
 * hold: what `git status` actually lists (D-0060 rule 1).
 *
 * The two cases are the ones D-0060 measured -- everything uncommitted, and one
 * commit with the rest left behind -- built the way the measurement built them:
 * a bare remote, a base pushed on `main`, a `topic` branch with the case applied.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "vitest";

import { gatherReviewMaterialFacts, inspectLapWork, runReviewer } from "../../src/access/forge.js";
import { evidenceOf, materialDigestOf, readingOf } from "../../src/access/review.js";
import { contentDigest } from "../../src/store/plan.js";

function git(cwd: string, ...args: string[]): void {
  execFileSync(
    "git",
    [
      "-c",
      "user.name=rondo-test",
      "-c",
      "user.email=rondo-test@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "-c",
      "init.defaultBranch=main",
      ...args,
    ],
    { cwd, stdio: "pipe" },
  );
}

/** A workspace on `topic`, cut from a `main` that is pushed to `origin`. */
function workspace(): string {
  const root = mkdtempSync(join(tmpdir(), "rondo-forge-"));
  const remote = join(root, "remote.git");
  const work = join(root, "work");
  git(root, "init", "--bare", remote);
  git(root, "init", work);
  writeFileSync(join(work, "a.txt"), "base\n");
  writeFileSync(join(work, ".gitignore"), "ignored.log\n");
  git(work, "add", ".");
  git(work, "commit", "-m", "base");
  git(work, "remote", "add", "origin", remote);
  git(work, "push", "origin", "main");
  git(work, "switch", "-c", "topic");
  return work;
}

const request = (work: string) => ({
  workspace: work,
  remote: "origin",
  baseBranch: "main",
  topicBranch: "topic",
});

test("everything uncommitted: the reading names the paths beside 'left nothing'", async () => {
  const work = workspace();
  writeFileSync(join(work, "a.txt"), "changed\n");
  writeFileSync(join(work, "new.txt"), "new\n");
  writeFileSync(join(work, "ignored.log"), "not work\n");

  const inspection = await inspectLapWork(request(work));

  expect(inspection.kind).toBe("read");
  if (inspection.kind !== "read") return;
  expect(inspection.commits).toEqual([]);
  expect(inspection.uncommitted).toEqual(["a.txt", "new.txt"]);
  expect(inspection.checkedOut).toBe("topic");
  const reading = readingOf(inspection);
  expect(reading.verdict).toBe("concerns");
  expect(reading.findings.some((line) => line.includes("left nothing"))).toBe(true);
  expect(reading.findings).toContain(
    "the workspace holds 2 uncommitted path(s) that are not on the topic branch: a.txt, new.txt",
  );
});

test("one commit and the rest uncommitted no longer reads clear", async () => {
  // **The case that published silently before D-0060**: modified tracked,
  // staged second edit, untracked -- a reading of `clear` over the committed
  // half, and a push without the rest.
  const work = workspace();
  writeFileSync(join(work, "b.txt"), "first\n");
  git(work, "add", "b.txt");
  git(work, "commit", "-m", "add b");
  writeFileSync(join(work, "a.txt"), "changed\n");
  writeFileSync(join(work, "b.txt"), "second\n");
  git(work, "add", "b.txt");
  writeFileSync(join(work, "c.txt"), "untracked\n");
  writeFileSync(join(work, "ignored.log"), "not work\n");
  git(work, "mv", ".gitignore", "renamed-ignore");
  writeFileSync(join(work, ".gitignore"), "ignored.log\n");

  const inspection = await inspectLapWork(request(work));

  expect(inspection.kind).toBe("read");
  if (inspection.kind !== "read") return;
  expect(inspection.commits.length).toBe(1);
  expect(inspection.files.map((file) => file.path)).toEqual(["b.txt"]);
  // A rename is one path, not its source as a second one.
  expect([...inspection.uncommitted].sort()).toEqual(
    [".gitignore", "a.txt", "b.txt", "c.txt", "renamed-ignore"].sort(),
  );
  const reading = readingOf(inspection);
  expect(reading.verdict).toBe("concerns");
  expect(reading.findings).toHaveLength(1);
  // Rule 3: the digest does not see the uncommitted state.
  expect(reading.evidence?.materialDigest).toBe(
    materialDigestOf({ ...inspection, uncommitted: [] }),
  );
});

test("a git status that fails makes the inspection unreadable, never clean", async () => {
  const work = workspace();
  writeFileSync(join(work, "b.txt"), "b\n");
  git(work, "add", "b.txt");
  git(work, "commit", "-m", "add b");
  // Every earlier query reads refs and objects; only `status` needs the index.
  writeFileSync(join(work, ".git", "index"), "not an index");

  const inspection = await inspectLapWork(request(work));

  expect(inspection.kind).toBe("unreadable");
  expect(inspection.kind === "unreadable" && inspection.reason).toContain("status");
  expect(readingOf(inspection).verdict).toBe("unavailable");
});

// D-0065: the facts a model reading hands over, and the process it hands them to.

/**
 * The two review-material tests make a real repository and run a dozen git
 * processes. On the Windows CI cell one of them took 1.4 s under one seed and
 * ran past the 10 s default under the next (PR #191), so they are given room.
 */
const REAL_GIT_TIMEOUT_MS = 60_000;

test(
  "the review material is the range's diff, full messages and rule files at the base",
  async () => {
    const work = workspace();
    writeFileSync(join(work, "AGENTS.md"), "rule one\nrule two\n");
    git(work, "add", "AGENTS.md");
    git(work, "commit", "-m", "rules");
    git(work, "push", "origin", "topic:main");
    git(work, "fetch", "origin");
    writeFileSync(join(work, "a.txt"), "changed\n");
    git(work, "commit", "-am", "subject line\n\nbody that says why\nsecond body line");
    writeFileSync(join(work, "AGENTS.md"), "rule rewritten on the topic\n");
    git(work, "commit", "-am", "second");

    const inspection = await inspectLapWork(request(work));
    if (inspection.kind !== "read") throw new Error(inspection.reason);
    const evidence = evidenceOf(inspection);

    const facts = await gatherReviewMaterialFacts({
      workspace: work,
      evidence,
      ruleFiles: ["AGENTS.md"],
    });

    expect(facts.kind).toBe("read");
    if (facts.kind !== "read") return;
    expect(facts.commits.map((commit) => commit.message)).toEqual([
      "subject line\n\nbody that says why\nsecond body line",
      "second",
    ]);
    expect(facts.commits[1]?.sha).toBe(evidence.tipCommit);
    expect(facts.diff).toContain("+++ b/a.txt");
    expect(facts.diff).toContain("+changed");
    // At the base, not at the tip.
    expect(facts.ruleFiles).toEqual([{ path: "AGENTS.md", content: "rule one\nrule two\n" }]);

    const missing = await gatherReviewMaterialFacts({
      workspace: work,
      evidence,
      ruleFiles: ["NOPE.md"],
    });
    expect(missing.kind).toBe("unreadable");
    expect(missing.kind === "unreadable" && missing.reason).toContain("NOPE.md");
  },
  REAL_GIT_TIMEOUT_MS,
);

test(
  "a commit message holding an RS byte reaches the reviewer whole",
  async () => {
    // The format used to separate commits with 0x1E, which cut such a message
    // at the byte and dropped the rest without a word.
    const work = workspace();
    writeFileSync(join(work, "a.txt"), "changed\n");
    git(work, "commit", "-am", "before\x1eafter\n\nbody \x1e too");
    writeFileSync(join(work, "a.txt"), "again\n");
    git(work, "commit", "-am", "second");

    const inspection = await inspectLapWork(request(work));
    if (inspection.kind !== "read") throw new Error(inspection.reason);
    const facts = await gatherReviewMaterialFacts({
      workspace: work,
      evidence: evidenceOf(inspection),
      ruleFiles: [],
    });

    expect(facts.kind).toBe("read");
    if (facts.kind !== "read") return;
    expect(facts.commits.map((commit) => commit.message)).toEqual([
      "before\x1eafter\n\nbody \x1e too",
      "second",
    ]);
    expect(facts.commits.every((commit) => /^[0-9a-f]{40}$/.test(commit.sha))).toBe(true);
  },
  REAL_GIT_TIMEOUT_MS,
);

/** One `codex exec --json` event line. */
const event = (value: unknown): string => `${JSON.stringify(value)}\n`;
const agentMessage = (text: string): string =>
  event({ type: "item.completed", item: { id: "m", type: "agent_message", text } });
const opening = event({ type: "thread.started", thread_id: "t" }) + event({ type: "turn.started" });
const closing = event({ type: "turn.completed", usage: { input_tokens: 1, output_tokens: 1 } });

/**
 * A stand-in reviewer: records its argv and (unless told not to read it) its
 * stdin, echoes the document to stderr as codex does, and prints `events`.
 */
function fakeReviewer(
  events: string,
  options: { readonly status?: number; readonly readStdin?: boolean } = {},
): { executable: string; seen: string } {
  const root = mkdtempSync(join(tmpdir(), "rondo-fake-reviewer-"));
  const seen = join(root, "seen");
  const executable = join(root, "reviewer");
  writeFileSync(join(root, "events"), events);
  const read = options.readStdin === false ? "" : `cat > '${seen}'\ncat '${seen}' >&2\n`;
  writeFileSync(
    executable,
    `#!/bin/sh\nprintf '%s\\n' "$@" > '${seen}.argv'\n${read}cat '${join(root, "events")}'\nexit ${String(options.status ?? 0)}\n`,
    { mode: 0o755 },
  );
  return { executable, seen };
}

const row = (executable: string) => ({ model: "gpt-6-astra", family: "gpt", executable });

// The stand-ins below are POSIX shell scripts.
const posix = test.skipIf(process.platform === "win32");

posix(
  "the reviewer is handed the document on stdin, and its last agent message is the answer",
  async () => {
    const fake = fakeReviewer(
      opening +
        event({ type: "item.completed", item: { id: "r", type: "reasoning", summary: [] } }) +
        agentMessage("an earlier draft") +
        agentMessage('\n  {"findings":[]}  \n') +
        closing,
    );
    const document = "review this: café -- and nothing else\n";

    const run = await runReviewer(row(fake.executable), document);

    expect(run).toEqual({
      kind: "answered",
      finalMessage: '{"findings":[]}',
      deliveredDigest: contentDigest({ delivered: document }),
    });
    expect(readFileSync(fake.seen, "utf8")).toBe(document);
    const argv = readFileSync(`${fake.seen}.argv`, "utf8").split("\n");
    expect(argv.slice(0, 13)).toEqual([
      "exec",
      "--json",
      "-m",
      "gpt-6-astra",
      "-s",
      "read-only",
      "--skip-git-repo-check",
      "--ephemeral",
      "--color",
      "never",
      "--ignore-user-config",
      "-c",
      "model_reasoning_effort=medium",
    ]);
    // Tools are taken away before the run: the operator's MCP servers go with
    // the ignored config, and these built-in ones by flag.
    for (const flag of [
      "features.shell_tool=false",
      "features.apps=false",
      "features.multi_agent=false",
      "tools.web_search=false",
    ]) {
      expect(argv[argv.indexOf(flag) - 1]).toBe("-c");
    }
    const at = argv.indexOf("-C");
    expect(argv[at + 2]).toBe("-");
    // The directory it ran in was empty and is gone.
    expect(existsSync(argv[at + 1] ?? "")).toBe(false);
  },
);

posix("output split inside multi-byte characters is decoded whole", async () => {
  // Far past one pipe chunk, with 1-, 2-, 3- and 4-byte characters so chunk
  // boundaries land inside characters at many offsets.
  const text = "aé€😀".repeat(60_000);
  const fake = fakeReviewer(opening + agentMessage(text) + closing);

  const run = await runReviewer(row(fake.executable), "doc");

  expect(run.kind).toBe("answered");
  expect(run.kind === "answered" && run.finalMessage === text).toBe(true);
});

posix("a reviewer whose events show it ran a command is a failed run", async () => {
  const fake = fakeReviewer(
    opening +
      event({ type: "item.started", item: { id: "c", type: "command_execution", command: "ls" } }) +
      event({
        type: "item.completed",
        item: { id: "c", type: "command_execution", command: "ls", aggregated_output: "" },
      }) +
      agentMessage('{"findings":[]}') +
      closing,
  );

  const run = await runReviewer(row(fake.executable), "doc");

  expect(run).toEqual({
    kind: "failed",
    reason:
      "the reviewer ran or fetched something (command_execution), so its reading is not over " +
      "the delivered bytes only (D-0065 rule 1.1)",
  });
});

posix("an unknown item type is failed the same way, not ignored", async () => {
  const fake = fakeReviewer(
    opening +
      event({ type: "item.completed", item: { type: "web_search", query: "q" } }) +
      agentMessage('{"findings":[]}') +
      closing,
  );
  const run = await runReviewer(row(fake.executable), "doc");
  expect(run.kind === "failed" && run.reason).toContain("(web_search)");
});

posix("no agent message, or a line that is not an event, is a failed run", async () => {
  const silent = await runReviewer(row(fakeReviewer(opening + closing).executable), "doc");
  expect(silent.kind === "failed" && silent.reason).toContain("no agent message");

  // A plain-text answer (what `codex exec` without `--json` prints) is not an event.
  const garbled = await runReviewer(
    row(fakeReviewer(`${opening}not json\n${agentMessage("x")}${closing}`).executable),
    "doc",
  );
  expect(garbled.kind === "failed" && garbled.reason).toContain(
    "stdout line 3 is not a JSON event",
  );
  // Nor is JSON without an event type.
  const untyped = await runReviewer(
    row(fakeReviewer(`${opening}{"findings":[]}\n${agentMessage("x")}${closing}`).executable),
    "doc",
  );
  expect(untyped.kind === "failed" && untyped.reason).toContain(
    "stdout line 3 is not a JSON event",
  );
});

posix(
  "a failed run says its exit and error events, and never the document echoed on stderr",
  async () => {
    const fake = fakeReviewer(
      opening + event({ type: "turn.failed", error: { message: "quota — exceeded" } }),
      { status: 3 },
    );

    const failed = await runReviewer(row(fake.executable), "SECRET-DOCUMENT-BODY");

    expect(failed.kind).toBe("failed");
    if (failed.kind !== "failed") return;
    expect(failed.reason).toContain("exited 3: quota ? exceeded");
    expect(failed.reason).not.toContain("SECRET-DOCUMENT-BODY");

    // Exit 0 with an error event is not an answer either.
    const errored = await runReviewer(
      row(
        fakeReviewer(opening + event({ type: "error", message: "stream lost" }) + agentMessage("x"))
          .executable,
      ),
      "doc",
    );
    expect(errored.kind === "failed" && errored.reason).toContain("exited 0: stream lost");

    const absent = await runReviewer(row(join(tmpdir(), "rondo-no-such-reviewer")), "doc");
    expect(absent.kind).toBe("failed");
  },
);

posix("a reviewer that exits 0 without reading its document was not delivered it", async () => {
  // Past any pipe buffer, so the write cannot finish into the kernel alone:
  // the child exits with it pending and the write fails or is destroyed.
  // Which of the two happens, and whether stdin closes before or after the
  // process, is the event loop's to order and cannot be forced here; this
  // pins the outcome both share -- `finish` never fires, so not delivered.
  const fake = fakeReviewer(opening + agentMessage('{"findings":[]}') + closing, {
    readStdin: false,
  });

  const run = await runReviewer(row(fake.executable), "x".repeat(8 * 1024 * 1024));

  expect(run.kind).toBe("failed");
  expect(run.kind === "failed" && run.reason).toContain("standard input was not delivered in full");
});

posix(
  "a reviewer whose descendant holds the pipes open is answered at the timeout, not after it",
  async () => {
    // The shape of an npm-installed codex: a launcher whose child inherits
    // stdout. Killing the launcher leaves the child holding the pipe, so a
    // runner that waited for `close` would wait the child's 30 s out.
    const root = mkdtempSync(join(tmpdir(), "rondo-fake-reviewer-"));
    const executable = join(root, "reviewer");
    writeFileSync(executable, "#!/bin/sh\ncat > /dev/null\nsleep 30 &\nwait\n", { mode: 0o755 });
    const started = Date.now();
    const run = await runReviewer(row(executable), "doc", 500);
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(run.kind).toBe("failed");
  },
);

posix(
  "an error notice before the turn starts is not a tool; the same item inside the turn is",
  async () => {
    const notice = event({
      type: "item.completed",
      item: { id: "item_0", type: "error", message: "Code mode will fail closed" },
    });
    const before = await runReviewer(
      row(
        fakeReviewer(
          `${event({ type: "thread.started" })}${notice}${opening}${agentMessage('{"findings":[]}')}${closing}`,
        ).executable,
      ),
      "doc",
    );
    expect(before.kind).toBe("answered");
    const inside = await runReviewer(
      row(
        fakeReviewer(`${opening}${notice}${agentMessage('{"findings":[]}')}${closing}`).executable,
      ),
      "doc",
    );
    expect(inside.kind === "failed" && inside.reason).toContain("(error)");
  },
);
