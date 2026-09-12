/**
 * `inspectLapWork` over a real repository, for the one fact a unit case cannot
 * hold: what `git status` actually lists (D-0060 rule 1).
 *
 * The two cases are the ones D-0060 measured -- everything uncommitted, and one
 * commit with the rest left behind -- built the way the measurement built them:
 * a bare remote, a base pushed on `main`, a `topic` branch with the case applied.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "vitest";

import { inspectLapWork } from "../../src/access/forge.js";
import { materialDigestOf, readingOf } from "../../src/access/review.js";

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
