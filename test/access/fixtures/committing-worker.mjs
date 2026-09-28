// The worker's turn, for the repair path's tests (rondo#551): one commit in the
// worktree it is started in, then the worker CLI it wraps, if any.
//
// **Why a commit inside the turn and not after it.** The gate's deterministic
// reading is taken over the worktree as the turn left it, and the checks host
// reads a pull request whose head is not that reading's tip as one somebody
// pushed to outside rondo -- which re-runs nothing and repairs nothing. A
// commit made by the test after the gate would put the whole scenario on that
// other road. continuo spawns the worker with the workspace as its `cwd`, and
// so does `stand-in-continuo.mjs`.
//
// `node committing-worker.mjs [<worker.mjs>] <worker args...>`: a first
// argument that is a `.mjs` file is the worker CLI to run after the commit
// (continuo's `fake-claude.mjs`, over the pinned build); without one this is
// the whole worker. A capability probe (`--version`, `--help`) commits nothing.
import { execFileSync, spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const [first, ...rest] = process.argv.slice(2);
const inner = first?.endsWith(".mjs") === true ? first : null;
const args = inner === null ? process.argv.slice(2) : rest;

if (!args.includes("--version") && !args.includes("--help")) {
  const git = (...gitArgs) =>
    execFileSync("git", gitArgs, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "rondo test worker",
        GIT_AUTHOR_EMAIL: "worker@example.invalid",
        GIT_COMMITTER_NAME: "rondo test worker",
        GIT_COMMITTER_EMAIL: "worker@example.invalid",
      },
    });
  const name = `work-${String(Date.now())}-${String(process.pid)}.md`;
  writeFileSync(join(process.cwd(), name), `the work of one turn\n`, "utf8");
  // `--all`, as `press-path.test.ts`'s stood-in turn does: a publish refuses a
  // worktree holding anything uncommitted (D-0060 rule 4), whatever put it there.
  git("add", "--all");
  git("commit", "--quiet", "-m", `a turn's work (${name})`);
}

if (inner !== null) {
  const ran = spawnSync(process.execPath, [inner, ...args], { stdio: "inherit" });
  process.exit(ran.status ?? 1);
}
