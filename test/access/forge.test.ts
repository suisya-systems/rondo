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

test("the review material is the range's diff, full messages and rule files at the base", async () => {
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
});

/** A stand-in reviewer: records its argv and stdin, and answers from a file. */
function fakeReviewer(answer: string, status = 0): { executable: string; seen: string } {
  const root = mkdtempSync(join(tmpdir(), "rondo-fake-reviewer-"));
  const seen = join(root, "seen");
  const executable = join(root, "reviewer");
  writeFileSync(join(root, "answer"), answer);
  writeFileSync(
    executable,
    `#!/bin/sh\nprintf '%s\\n' "$@" > '${seen}.argv'\ncat > '${seen}'\necho 'banner on stderr' >&2\ncat '${join(root, "answer")}'\nexit ${String(status)}\n`,
    { mode: 0o755 },
  );
  return { executable, seen };
}

// The stand-in is a POSIX shell script.
test.skipIf(process.platform === "win32")(
  "the reviewer is handed the document on stdin, and stdout is its answer",
  async () => {
    const fake = fakeReviewer('\n  {"findings":[]}  \n');
    const document = "review this: café — and nothing else\n";

    const run = await runReviewer(
      { model: "gpt-6-astra", family: "gpt", executable: fake.executable },
      document,
    );

    expect(run).toEqual({
      kind: "answered",
      finalMessage: '{"findings":[]}',
      deliveredDigest: contentDigest({ delivered: document }),
    });
    expect(readFileSync(fake.seen, "utf8")).toBe(document);
    const argv = readFileSync(`${fake.seen}.argv`, "utf8").split("\n");
    expect(argv.slice(0, 9)).toEqual([
      "exec",
      "-m",
      "gpt-6-astra",
      "-s",
      "read-only",
      "--skip-git-repo-check",
      "--ephemeral",
      "--color",
      "never",
    ]);
    expect(argv[9]).toBe("-C");
    expect(argv[11]).toBe("-");
    // The directory it ran in was empty and is gone.
    expect(existsSync(argv[10] ?? "")).toBe(false);
  },
);

// The stand-in is a POSIX shell script.
test.skipIf(process.platform === "win32")(
  "a reviewer that exits non-zero or cannot start is a failed run",
  async () => {
    const fake = fakeReviewer("", 3);
    const failed = await runReviewer(
      { model: "gpt-6-astra", family: "gpt", executable: fake.executable },
      "doc",
    );
    expect(failed.kind).toBe("failed");
    expect(failed.kind === "failed" && failed.reason).toContain("exited 3");

    const absent = await runReviewer(
      { model: "gpt-6-astra", family: "gpt", executable: join(tmpdir(), "rondo-no-such-reviewer") },
      "doc",
    );
    expect(absent.kind).toBe("failed");
  },
);
