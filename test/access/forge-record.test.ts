/**
 * The decision record against real git (D-0098 rules 3.3, 3.6 and 3.7): the
 * floor an admission's numbers start above, the numbers a lap added, and a
 * landing read by numbers and added lines rather than by the record's tree
 * entry, which another line appends to as well.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "vitest";

import { readLanding, readRecordAdditions, readRecordFloor } from "../../src/access/forge.js";

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

const entry = (n: string, title: string) => `\n## D-${n} — ${title}\n\nWhy ${title}.\n`;
const row = (n: string, title: string) => `| D-${n} | ${title} | accepted |\n`;
const record = (rows: string, entries: string) => `# Decisions\n\n## Index\n\n${rows}${entries}`;

/**
 * A line on `topic` in `work` that writes entry D-0002 (its reservation), with
 * `merger` landing things on the forge's `main` as a squash merge does.
 */
function recordWorld() {
  const root = mkdtempSync(join(tmpdir(), "rondo-record-"));
  const remote = join(root, "remote.git");
  const work = join(root, "work");
  const merger = join(root, "merger");
  git(root, "init", "--bare", remote);
  git(root, "init", work);
  writeFileSync(join(work, RECORD), record(row("0001", "first"), entry("0001", "first")));
  writeFileSync(join(work, "a.txt"), "base\n");
  git(work, "add", ".");
  git(work, "commit", "-m", "base");
  git(work, "remote", "add", "origin", remote);
  git(work, "push", "-q", "origin", "main");
  const baseCommit = git(work, "rev-parse", "HEAD");
  git(work, "switch", "-q", "-c", "topic");
  writeFileSync(
    join(work, RECORD),
    record(
      row("0001", "first") + row("0002", "second"),
      entry("0001", "first") + entry("0002", "second"),
    ),
  );
  writeFileSync(join(work, "a.txt"), "changed\n");
  git(work, "commit", "-q", "-am", "the line's work");
  const tipCommit = git(work, "rev-parse", "HEAD");
  git(root, "clone", "-q", remote, merger);
  const landing = (reserved: readonly number[], tips: readonly string[] = [tipCommit]) => ({
    repository: work,
    remote: "origin",
    baseCommit,
    tipCommits: tips,
    record: { path: RECORD, reserved },
  });
  /** Land on the forge's main as a squash of `text` for the record and `a.txt`. */
  const land = (text: string, a = "changed\n") => {
    git(merger, "pull", "-q", "origin", "main");
    writeFileSync(join(merger, RECORD), text);
    writeFileSync(join(merger, "a.txt"), a);
    git(merger, "commit", "-q", "-am", "squash");
    git(merger, "push", "-q", "origin", "main");
  };
  return { work, merger, baseCommit, tipCommit, landing, land };
}

test(
  "the floor is the highest heading or index row on the forge's default branch, and a missing record is 0",
  async () => {
    const { work, merger } = recordWorld();
    expect(
      await readRecordFloor({ repository: work, remote: "origin", record: RECORD }),
    ).toMatchObject({
      kind: "read",
      floor: 1,
    });
    // Another line landed D-0005 on the forge; the clone never pulled it.
    writeFileSync(
      join(merger, RECORD),
      `${readFileSync(join(merger, RECORD), "utf8")}${row("0005", "fifth")}`,
    );
    git(merger, "commit", "-q", "-am", "another line");
    git(merger, "push", "-q", "origin", "main");
    expect(
      await readRecordFloor({ repository: work, remote: "origin", record: RECORD }),
    ).toMatchObject({
      kind: "read",
      floor: 5,
      headCommit: git(merger, "rev-parse", "HEAD"),
    });
    expect(
      await readRecordFloor({ repository: work, remote: "origin", record: "docs/NONE.md" }),
    ).toMatchObject({ kind: "read", floor: 0 });
    expect(
      await readRecordFloor({ repository: work, remote: "nowhere", record: RECORD }),
    ).toMatchObject({ kind: "undetermined" });
  },
  REAL_GIT_TIMEOUT_MS,
);

test(
  "the numbers a lap added are its new headings and index rows, and nothing it only mentions",
  async () => {
    const { work, baseCommit, tipCommit } = recordWorld();
    expect(
      await readRecordAdditions({ repository: work, baseCommit, tipCommit, record: RECORD }),
    ).toEqual({ kind: "read", numbers: [2] });
    expect(
      await readRecordAdditions({ repository: work, baseCommit, tipCommit, record: "a.txt" }),
    ).toEqual({ kind: "read", numbers: [] });
    expect(
      (
        await readRecordAdditions({
          repository: work,
          baseCommit,
          tipCommit: "f".repeat(40),
          record: RECORD,
        })
      ).kind,
    ).toBe("undetermined");
  },
  REAL_GIT_TIMEOUT_MS,
);

test(
  "a landing on the record is read by numbers and added lines, not by its tree entry",
  async () => {
    const { landing, land } = recordWorld();
    expect(await readLanding(landing([2]))).toMatchObject({
      kind: "notLanded",
      differing: [`${RECORD} (D-0002 has no heading and index row there)`, "a.txt"],
    });
    // Squashed beside another line's D-0003: the record's entry differs from
    // the tip's, and the line has still landed.
    land(
      record(
        row("0001", "first") + row("0002", "second") + row("0003", "third"),
        entry("0001", "first") + entry("0002", "second") + entry("0003", "third"),
      ),
    );
    expect(await readLanding(landing([2]))).toMatchObject({
      kind: "landed",
      paths: [RECORD, "a.txt"],
    });
  },
  REAL_GIT_TIMEOUT_MS,
);

test(
  "a line with no reservation is read by its added lines, and a reservation never written keeps a line unlanded",
  async () => {
    const { landing, land } = recordWorld();
    // The numbers are there, and a line the tip added is not: not landed.
    land(
      record(
        row("0001", "first") + row("0002", "second"),
        entry("0001", "first") + entry("0002", "other"),
      ),
    );
    expect(await readLanding(landing([]))).toMatchObject({
      kind: "notLanded",
      differing: [`${RECORD} (a line it added is not there)`],
    });
    // A reservation the line holds and never wrote keeps it unlanded (rule 3.7).
    land(
      record(
        row("0001", "first") + row("0002", "second"),
        entry("0001", "first") + entry("0002", "second"),
      ),
    );
    expect(await readLanding(landing([2]))).toMatchObject({ kind: "landed" });
    expect(await readLanding(landing([2, 3]))).toMatchObject({
      kind: "notLanded",
      differing: [`${RECORD} (D-0003 has no heading and index row there)`],
    });
  },
  REAL_GIT_TIMEOUT_MS,
);
