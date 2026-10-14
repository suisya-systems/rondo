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

import { DiscardPort, discardUncommitted, type Listed } from "../../src/access/discard.js";
import type { PublishShown } from "../../src/access/page/contract.js";
import { chromeFor } from "../../src/access/wording.js";
import type { IterationRecord } from "../../src/store/records.js";
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

/** What the press would act on in `repo`, read as the screen reads it. */
async function listedIn(repo: string): Promise<readonly Listed[]> {
  const read = await new DiscardPort(fresh().store, planOver(repo)).read({
    plan: { workspace: repo },
  } as unknown as IterationRecord);
  return read.kind === "uncommitted" ? read.listed : [];
}

const status = (repo: string): string =>
  git(repo, "status", "--porcelain=v1", "--untracked-files=all");

test("only the listed paths are put back or removed; what the list did not name stays", async () => {
  const repo = dirtyRepository();
  // A change git status hides is not on the list, so it is not touched (Codex round 5).
  git(repo, "update-index", "--assume-unchanged", ".gitignore");
  writeFileSync(join(repo, ".gitignore"), "ignored.log\n# a local note\n");
  const listed = await listedIn(repo);
  expect(listed.map((one) => one.path).sort()).toEqual(["kept.txt", "loose/a.txt", "staged.txt"]);
  expect(await discardUncommitted(repo, listed)).toBeNull();
  expect(status(repo)).toBe("");
  expect(readFileSync(join(repo, "kept.txt"), "utf8")).toBe("committed\n");
  // The staged new file is gone from the index and from the folder.
  expect(existsSync(join(repo, "staged.txt"))).toBe(false);
  expect(existsSync(join(repo, "loose", "a.txt"))).toBe(false);
  expect(existsSync(join(repo, "ignored.log"))).toBe(true);
  expect(readFileSync(join(repo, ".gitignore"), "utf8")).toBe("ignored.log\n# a local note\n");
  // A workspace git cannot work in says so, with git's own words.
  expect((await discardUncommitted(join(repo, "nowhere"), listed))?.why).toBe(
    "discardRefusedFailed",
  );
});

test("a rename comes back whole, and a path that looks like a pattern is only itself", async () => {
  const repo = dirtyRepository();
  git(repo, "mv", "kept.txt", "moved.txt");
  writeFileSync(join(repo, "*.txt"), "a name, not a pattern\n");
  const listed = await listedIn(repo);
  expect(listed.find((one) => one.path === "moved.txt")?.from).toBe("kept.txt");
  expect(await discardUncommitted(repo, listed)).toBeNull();
  expect(readFileSync(join(repo, "kept.txt"), "utf8")).toBe("committed\n");
  expect(existsSync(join(repo, "moved.txt"))).toBe(false);
  expect(existsSync(join(repo, "*.txt"))).toBe(false);
  expect(status(repo)).toBe("");
});

test("a .gitignore edit is put back, and what it had ignored is left where it was", async () => {
  const repo = dirtyRepository();
  writeFileSync(join(repo, ".gitignore"), "ignored.log\nlocal.env\n");
  writeFileSync(join(repo, "local.env"), "not shown\n");
  const listed = await listedIn(repo);
  expect(listed.map((one) => one.path)).not.toContain("local.env");
  expect(await discardUncommitted(repo, listed)).toBeNull();
  expect(readFileSync(join(repo, ".gitignore"), "utf8")).toBe("ignored.log\n");
  // Not on the list, so still there -- and now not ignored, so not clean either.
  expect(readFileSync(join(repo, "local.env"), "utf8")).toBe("not shown\n");
  expect(status(repo)).toBe("?? local.env\n");
});

test("an ignored file at, below or above a path that comes back stops the discard before it runs", async () => {
  // Below: a tracked file replaced by a folder holding an ignored file.
  const below = dirtyRepository();
  rmSync(join(below, "kept.txt"));
  mkdirSync(join(below, "kept.txt"));
  writeFileSync(join(below, "kept.txt", "ignored.log"), "never shown\n");
  writeFileSync(join(below, "kept.txt", "loose.txt"), "shown\n");
  expect(await discardUncommitted(below, await listedIn(below))).toEqual({
    why: "discardRefusedIgnored",
    note: "kept.txt/ignored.log",
  });
  expect(existsSync(join(below, "kept.txt", "loose.txt"))).toBe(true);

  // At: a tracked file taken out of the index, and now ignored.
  const at = dirtyRepository();
  git(at, "add", "-f", "ignored.log");
  git(at, "commit", "--quiet", "-m", "track it");
  git(at, "rm", "--quiet", "--cached", "ignored.log");
  writeFileSync(join(at, "ignored.log"), "local edits\n");
  expect(await discardUncommitted(at, await listedIn(at))).toEqual({
    why: "discardRefusedIgnored",
    note: "ignored.log",
  });
  expect(readFileSync(join(at, "ignored.log"), "utf8")).toBe("local edits\n");

  // Above: a tracked folder replaced by an ignored file.
  const above = dirtyRepository();
  mkdirSync(join(above, "docs"));
  writeFileSync(join(above, "docs", "a.txt"), "tracked\n");
  git(above, "add", "docs");
  git(above, "commit", "--quiet", "-m", "docs");
  rmSync(join(above, "docs"), { recursive: true });
  writeFileSync(join(above, ".gitignore"), "ignored.log\ndocs\n");
  writeFileSync(join(above, "docs"), "not shown\n");
  expect(await discardUncommitted(above, await listedIn(above))).toEqual({
    why: "discardRefusedIgnored",
    note: "docs",
  });
  expect(readFileSync(join(above, "docs"), "utf8")).toBe("not shown\n");
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
  // Every file, and not only the folder an untracked file is in (Codex round 4).
  for (const path of ["kept.txt", "staged.txt", "loose/a.txt"]) {
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
  // A file added inside a listed folder after the screen was drawn is a new list.
  writeFileSync(join(repo, "loose", "b.txt"), "written after the screen\n");
  const grown = await post(base, { token, iteration: "i-0001", shown }, {}, "/discard");
  expect(grown.status).toBe(409);
  expect(existsSync(join(repo, "loose", "b.txt"))).toBe(true);
  rmSync(join(repo, "loose", "b.txt"));
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

test("after a press, what the list did not cover is said as still there, not as matching the branch", async () => {
  const repo = dirtyRepository();
  writeFileSync(join(repo, ".gitignore"), "ignored.log\nlocal.env\n");
  writeFileSync(join(repo, "local.env"), "not shown\n");
  const world = fresh();
  await reserve(world, "i-0001", "add a retry budget");
  const store = storeAt(world.store, repo);
  const discard = new DiscardPort(store, planOver(repo));
  const { base, stop, served } = await serving({ ...portsOver(world, "ada", []), store, discard });
  const page = (await get(base, "/?discard=i-0001&lang=en")).body;
  const token = tokenIn(page);
  const shown = /name="shown" value="([^"]+)"/.exec(page)?.[1] ?? "";
  const pressed = await post(base, { token, iteration: "i-0001", shown }, {}, "/discard");
  expect(pressed.status).toBe(303);
  const after = (await get(base, pressed.location ?? "")).body.replaceAll("&#39;", "'");
  expect(after).toContain(EN.discardDonePartly);
  expect(after).not.toContain(EN.discardDone);
  expect(after).toContain('<li class="wrap-anywhere">local.env</li>');
  stop.abort();
  expect(await served).toBe(0);
});
