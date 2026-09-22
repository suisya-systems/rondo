/**
 * The gate's reading as `conductorPorts` wires it (D-0098 rules 2.3 and 3.6),
 * over a real repository: the ancestry test is asked of the take-in commit and
 * the tip the inspection read, in that order, and the record's numbers are
 * tested against every number the line was handed, both ways.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "vitest";

import { conductorPorts } from "../../src/access/conductor.js";

/** Real repositories and a dozen git processes: forge.test.ts's REAL_GIT_TIMEOUT_MS. */
const REAL_GIT_TIMEOUT_MS = 60_000;
const RECORD = "DECISIONS.md";

function git(cwd: string, ...args: string[]): string {
  return execFileSync(
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
  )
    .toString()
    .trim();
}

const record = (numbers: readonly string[]) =>
  `# Decisions\n\n${numbers.map((n) => `| D-${n} | t | accepted |\n`).join("")}` +
  numbers.map((n) => `\n## D-${n} — t\n\nWhy.\n`).join("");

/** A lap on `topic` that writes D-0002, cut from `main` pushed to `origin`, and a commit off to one side. */
function world() {
  const root = mkdtempSync(join(tmpdir(), "rondo-lap-work-"));
  const remote = join(root, "remote.git");
  const work = join(root, "work");
  git(root, "init", "--bare", remote);
  git(root, "init", work);
  writeFileSync(join(work, RECORD), record(["0001"]));
  git(work, "add", ".");
  git(work, "commit", "-m", "base");
  git(work, "remote", "add", "origin", remote);
  git(work, "push", "-q", "origin", "main");
  const baseCommit = git(work, "rev-parse", "HEAD");
  git(work, "switch", "-q", "-c", "aside");
  writeFileSync(join(work, "aside.txt"), "aside\n");
  git(work, "add", ".");
  git(work, "commit", "-m", "aside");
  const aside = git(work, "rev-parse", "HEAD");
  git(work, "switch", "-q", "-c", "topic", "main");
  writeFileSync(join(work, RECORD), record(["0001", "0002"]));
  git(work, "commit", "-q", "-am", "the lap's entry");
  const read = async (
    reservations: readonly { readonly number: number; readonly released: boolean }[],
    takeIn: string | null = null,
  ) => {
    const store = { numberReservations: async () => reservations };
    const ports = conductorPorts({} as never, store as never, null);
    const plan = {
      workspace: work,
      baseBranch: "main",
      topicBranch: "topic",
      decisionRecord: RECORD,
      takeIn: takeIn === null ? null : { commit: takeIn, remoteBranch: "main" },
    };
    const outcome = await ports.readLapWork(plan as never, "lap-1");
    if (outcome.kind !== "answered") throw new Error(JSON.stringify(outcome));
    return outcome.value;
  };
  return { baseCommit, aside, read };
}

test(
  "a retried lap writing the number its line was handed and has since released reads clear (D-0098 rule 3.4)",
  async () => {
    const { read } = world();
    const reading = await read([{ number: 2, released: true }]);
    expect(reading.findings).toEqual([]);
    expect(reading.verdict).toBe("clear");
  },
  REAL_GIT_TIMEOUT_MS,
);

test(
  "a number the line holds and the tip does not write is a finding at the gate (D-0098 rule 3.6)",
  async () => {
    const { read } = world();
    const reading = await read([
      { number: 2, released: false },
      { number: 3, released: false },
    ]);
    expect(reading.verdict).toBe("concerns");
    expect(reading.findings).toEqual([
      `${RECORD} has no heading and index row for D-0003, which this line holds: the line ` +
        "does not read landed until both are there (D-0098 rule 3.6)",
    ]);
  },
  REAL_GIT_TIMEOUT_MS,
);

test(
  "the take-in's ancestry is asked of the take-in commit and the tip, in that order (D-0098 rule 2.3)",
  async () => {
    const { baseCommit, aside, read } = world();
    const held = [{ number: 2, released: false }];
    expect((await read(held, baseCommit)).verdict).toBe("clear");
    const missing = await read(held, aside);
    expect(missing.verdict).toBe("concerns");
    expect(missing.findings).toEqual([
      `the topic branch does not hold ${aside}, the commit of main this lap was told to bring in ` +
        "first (D-0098 rule 2.3)",
    ]);
  },
  REAL_GIT_TIMEOUT_MS,
);
