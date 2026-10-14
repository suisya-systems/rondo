/**
 * Discarding a lap's uncommitted changes from the page (rondo#676, D-0198):
 * what `git` is asked to do, over a real repository, and the screen and its
 * press, with the publish plan standing in for what git said.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";

import { DiscardPort, discardUncommitted } from "../../src/access/discard.js";
import type { PublishShown } from "../../src/access/page/contract.js";
import { chromeFor } from "../../src/access/wording.js";
import type { IterationStore } from "../../src/store/sqlite.js";
import { fresh, get, portsOver, post, reserve, serving, tokenIn } from "./page-world.js";

const EN = chromeFor("en");

const git = (cwd: string, ...args: string[]): string =>
  execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" });

/** A repository with one commit and every kind of change `git status` lists. */
function dirtyRepository(): string {
  const repo = mkdtempSync(join(tmpdir(), "rondo-discard-"));
  git(repo, "init", "--quiet", "--initial-branch=topic");
  git(repo, "config", "user.email", "t@example.com");
  git(repo, "config", "user.name", "t");
  writeFileSync(join(repo, "kept.txt"), "committed\n");
  writeFileSync(join(repo, ".gitignore"), "ignored.log\n");
  git(repo, "add", ".");
  git(repo, "commit", "--quiet", "-m", "base");
  writeFileSync(join(repo, "kept.txt"), "edited\n");
  writeFileSync(join(repo, "staged.txt"), "new and staged\n");
  git(repo, "add", "staged.txt");
  mkdirSync(join(repo, "loose"));
  writeFileSync(join(repo, "loose", "a.txt"), "untracked\n");
  writeFileSync(join(repo, "ignored.log"), "not work\n");
  return repo;
}

/** The status paths as the publish plan reads them, or "ready" when there are none. */
function planOver(repo: string): (record: unknown) => Promise<PublishShown> {
  return async () => {
    const paths = git(repo, "status", "--porcelain=v1", "--untracked-files=normal")
      .split("\n")
      .filter((line) => line.length > 3)
      .map((line) => line.slice(3));
    return paths.length === 0
      ? ({ kind: "ready" } as PublishShown)
      : { kind: "refused", block: { why: "uncommitted", paths, elsewhere: null } };
  };
}

/** The world's store, with the lap's plan naming `repo` as its workspace. */
function storeAt(store: IterationStore, repo: string): IterationStore {
  return new Proxy(store, {
    get(target, key) {
      if (key === "read") {
        return async (id: string) => {
          const found = await target.read(id);
          return found.kind !== "read"
            ? found
            : {
                ...found,
                record: { ...found.record, plan: { ...found.record.plan, workspace: repo } },
              };
        };
      }
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

test("discarding puts tracked files back, removes untracked ones and leaves ignored ones", async () => {
  const repo = dirtyRepository();
  expect(await discardUncommitted(repo)).toBeNull();
  expect(git(repo, "status", "--porcelain=v1", "--untracked-files=normal")).toBe("");
  expect(readFileSync(join(repo, "kept.txt"), "utf8")).toBe("committed\n");
  expect(existsSync(join(repo, "staged.txt"))).toBe(false);
  expect(existsSync(join(repo, "loose"))).toBe(false);
  expect(existsSync(join(repo, "ignored.log"))).toBe(true);
  // A workspace git cannot work in says so, with git's own words.
  expect((await discardUncommitted(join(repo, "nowhere")))?.why).toBe("discardRefusedFailed");

  // A file the changes' own `.gitignore` edit ignores was not on the list, so it stays.
  writeFileSync(join(repo, ".gitignore"), "ignored.log\nlocal.env\n");
  writeFileSync(join(repo, "local.env"), "not shown\n");
  expect(await discardUncommitted(repo)).toBeNull();
  expect(readFileSync(join(repo, ".gitignore"), "utf8")).toBe("ignored.log\n");
  expect(existsSync(join(repo, "local.env"))).toBe(true);

  // An ignored file inside a folder standing where the branch has a file would
  // go when the file comes back, so nothing runs and the file is named.
  rmSync(join(repo, "kept.txt"));
  mkdirSync(join(repo, "kept.txt"));
  writeFileSync(join(repo, "kept.txt", "ignored.log"), "never shown\n");
  writeFileSync(join(repo, "kept.txt", "loose.txt"), "shown\n");
  expect(await discardUncommitted(repo)).toEqual({
    why: "discardRefusedIgnored",
    note: "kept.txt/ignored.log",
  });
  expect(existsSync(join(repo, "kept.txt", "loose.txt"))).toBe(true);
});

test("the screen lists what will be lost; only a person's press over that list discards it", async () => {
  const repo = dirtyRepository();
  const world = fresh();
  await reserve(world, "i-0001", "add a retry budget");
  const store = storeAt(world.store, repo);
  const discard = new DiscardPort(store, planOver(repo));
  const { base, stop, served } = await serving({ ...portsOver(world, "ada", []), store, discard });

  const page = (await get(base, "/?discard=i-0001&lang=en")).body;
  expect(page).toContain(EN.discardListHeading(3));
  for (const path of ["kept.txt", "staged.txt", "loose/"]) {
    expect(page).toContain(`<li class="wrap-anywhere">${path}</li>`);
  }
  expect(page).not.toContain("ignored.log");
  expect(page).toContain('action="/discard?lang=en"');
  const token = tokenIn(page);
  const shown = /name="shown" value="([^"]+)"/.exec(page)?.[1] ?? "";

  // A script's press, and a press over a list that is not the one drawn, discard nothing.
  const script = await post(
    base,
    { token, iteration: "i-0001", shown },
    { "sec-fetch-user": undefined },
    "/discard",
  );
  expect(script.status).toBe(403);
  const stale = await post(
    base,
    { token, iteration: "i-0001", shown: "sha256:other" },
    {},
    "/discard",
  );
  expect(stale.status).toBe(409);
  expect(stale.body.replaceAll("&#39;", "'")).toContain(EN.discardRefusedChanged);
  expect(existsSync(join(repo, "staged.txt"))).toBe(true);

  const pressed = await post(base, { token, iteration: "i-0001", shown }, {}, "/discard");
  expect(pressed.status).toBe(303);
  expect(pressed.location).toBe("/?discard=i-0001&done=1&lang=en");
  expect(existsSync(join(repo, "staged.txt"))).toBe(false);
  expect((await get(base, pressed.location ?? "")).body.replaceAll("&#39;", "'")).toContain(
    EN.discardDone,
  );

  // Pressed again, there is nothing left, and it says so.
  const again = await post(base, { token, iteration: "i-0001", shown }, {}, "/discard");
  expect(again.status).toBe(409);
  expect(again.body).toContain(EN.discardRefusedNothing);
  stop.abort();
  expect(await served).toBe(0);
});

test("with nobody named as approver there is no port, no list and no press", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "add a retry budget");
  const { base, stop, served } = await serving({ ...portsOver(world, null), discard: null });
  const page = (await get(base, "/?discard=i-0001&lang=en")).body;
  expect(page).toContain(EN.discardNoApprover);
  expect(page).not.toContain('action="/discard');
  const pressed = await post(base, { token: "t", iteration: "i-0001", shown: "x" }, {}, "/discard");
  expect(pressed.status).toBe(403);
  stop.abort();
  expect(await served).toBe(0);
});
