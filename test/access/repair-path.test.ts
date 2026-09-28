/**
 * rondo#551's completion bar through the page, runnable anywhere: a published
 * pull request's check goes red, the thread says so, and the repair press lands
 * a commit on that pull request's head branch. The scenario and what is real in
 * it are `repair-path.ts`'s.
 *
 * **The one thing this file stands in for beyond that: continuo.** Every press
 * starts the pinned continuo before it does anything, and the pinned build
 * cannot run everywhere this suite does -- it is not provisioned outside CI,
 * and inside another Claude Code sandbox it refuses every lap (continuo D-1112
 * rule 4). So `RONDO_CONTINUO_CLI` names `fixtures/stand-in-continuo.mjs`:
 * the same process boundary, the same `--version` check against the pin, the
 * same JSON documents rondo decodes, and the two effects rondo reads back --
 * the worktree cut from the base branch `run admit` named, and the plan's
 * worker command run in it. It is not a narrower seam inside rondo: nothing
 * in rondo is replaced. The same scenario over the pinned build is the last
 * case of `test/access/press-path.test.ts`, which CI runs.
 *
 * The stood-in forge CLI is a POSIX shell script, which `spawn` cannot reach
 * on Windows (`press-path.test.ts`'s publish cases draw the same line), so the
 * Windows cell skips this and says why; every other cell runs it.
 */
import { test } from "vitest";

import { CLI_PATH_ENV } from "../../src/continuo/invoker.js";
import { CONTINUO_VERSION_LINE } from "../../src/continuo/pin.js";
import { COMMITTING_WORKER, repairScenario, standInContinuo } from "./repair-path.js";

test.skipIf(process.platform === "win32")(
  "a red check on rondo's own pull request is re-run once, then said with its name, and the " +
    "page's repair lands on that pull request's head branch, which green then merges (rondo#551)" +
    (process.platform === "win32"
      ? " [skipped: the stood-in gh is a POSIX shell script, which spawn cannot reach on Windows]"
      : ""),
  async () => {
    await repairScenario({
      label: "stand-in",
      environment: {
        RONDO_APPROVER: "ada",
        [CLI_PATH_ENV]: standInContinuo(CONTINUO_VERSION_LINE),
      },
      claudeCommand: [process.execPath, COMMITTING_WORKER],
    });
  },
  120_000,
);
