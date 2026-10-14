/**
 * Discarding the uncommitted changes a lap left in its workspace, from the
 * page (rondo#676, D-0198): what the confirmation screen reads, the port the
 * press goes through and the press itself, `POST /discard`. Out of
 * `web-app.ts`, which is at its size cap, as `github-sign-in-route.ts` is.
 *
 * **What the screen listed is what is discarded, and nothing else.** The
 * screen lists the workspace file by file and carries the list's digest; the
 * press reads it again, discards only where it is still the one shown, and
 * then acts on those paths alone, so nothing the list did not name -- an
 * ignored file, a change git status hides, a submodule -- is touched. The lap
 * is closed, so no worker is writing in the workspace between read and act.
 */
import type { Context, Hono } from "hono";
import { contentDigest } from "../store/plan.js";
import { type IterationRecord, planField } from "../store/records.js";
import type { IterationStore } from "../store/sqlite.js";
import { runCommand } from "./forge.js";
import type { PublishReading, PublishShown } from "./page/contract.js";
import { viewHref } from "./page-logic/routes.js";
import { refusedPage } from "./screens/refused.js";
import { mintPress, type PageEnv, type Press, spendPress } from "./web-app.js";
import type { Chrome } from "./wording.js";

export const DISCARD_ROUTE = "/discard";

/** How long one git command may take: local, so well short of a forge's. */
const DISCARD_TIMEOUT_MS = 60_000;

/** One line of `git status`, as the press acts on it. */
export interface Listed {
  readonly path: string;
  /** A rename's or copy's source, which comes back too. */
  readonly from: string | null;
  /** `??`: removed. Anything else is put back to what is checked out. */
  readonly untracked: boolean;
}

/** What the discard screen shows for one lap. */
export type Discardable =
  | {
      readonly kind: "uncommitted";
      readonly workspace: string;
      /**
       * Every path the press acts on, one file at a time (Codex round 4):
       * `--untracked-files=all`, so a file added inside an untracked folder
       * after the screen was drawn changes the digest.
       */
      readonly listed: readonly Listed[];
      readonly elsewhere: string | null;
      /** The digest the press carries back. */
      readonly shown: string;
    }
  /** Publishing is not held by uncommitted work: nothing to discard. */
  | { readonly kind: "clean" }
  /** Publishing is refused for something else first, so the list is not known. */
  | { readonly kind: "notOffered" };

/** A git command in the workspace, its paths read literally rather than as globs. */
async function git(workspace: string, args: readonly string[]) {
  const ran = await runCommand(
    "git",
    ["--literal-pathspecs", "-C", workspace, ...args],
    DISCARD_TIMEOUT_MS,
  );
  return ran.spawnError !== null || ran.status !== 0
    ? { failed: `${ran.commandLine}: ${ran.spawnError ?? ran.stderr.trim()}` }
    : { out: ran.stdout };
}

/**
 * Which of the three one publish plan is: the plan says whether a discard is
 * offered, and the workspace is then read file by file for what it would lose.
 */
async function discardableAt(record: IterationRecord, shown: PublishShown): Promise<Discardable> {
  if (shown.kind === "ready") {
    return { kind: "clean" };
  }
  const block = shown.block;
  if (block.why !== "uncommitted") {
    return { kind: "notOffered" };
  }
  const workspace = planField(record, "workspace");
  const status = await git(workspace, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  if ("failed" in status) {
    return { kind: "notOffered" };
  }
  const listed: Listed[] = [];
  const entries = status.out.split("\0");
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index] ?? "";
    if (entry.length < 4) {
      continue;
    }
    // A rename's or copy's source follows as an entry of its own.
    const renamed = /[RC]/.test(entry.slice(0, 2));
    listed.push({
      path: entry.slice(3),
      from: renamed ? (entries[index + 1] ?? null) : null,
      untracked: entry.startsWith("??"),
    });
    if (renamed) {
      index += 1;
    }
  }
  return listed.length === 0
    ? { kind: "clean" }
    : {
        kind: "uncommitted",
        workspace,
        listed,
        elsewhere: block.elsewhere,
        shown: contentDigest({
          workspace,
          listed: listed.map(({ path, from, untracked }) => ({ path, from, untracked })),
          elsewhere: block.elsewhere,
        }),
      };
}

/**
 * Throw away exactly the listed paths: untracked files removed one by one
 * (`clean` without `-d` or `-x`, over the files named), tracked ones put back
 * to what is checked out (`restore --staged --worktree`, rename sources too).
 * Null when both ran.
 *
 * **Refused before anything runs where an ignored file is in the way** (Codex
 * rounds 2 and 3): putting a listed path back writes a file or a folder there,
 * and an ignored file at that path, below it or at a folder above it would be
 * deleted though it was never listed.
 *
 * ponytail: every path is one argument, so a list past the system's argument
 * limit fails as a whole and says so; `--pathspec-from-file` if that is met.
 */
export async function discardUncommitted(
  workspace: string,
  listed: readonly Listed[],
): Promise<{ readonly why: DiscardRefusal; readonly note: string } | null> {
  const untracked = listed.filter((one) => one.untracked).map((one) => one.path);
  const tracked = listed
    .filter((one) => !one.untracked)
    .flatMap((one) => (one.from === null ? [one.path] : [one.path, one.from]));
  const ignored = await git(workspace, [
    "ls-files",
    "-z",
    "--others",
    "--ignored",
    "--exclude-standard",
  ]);
  if ("failed" in ignored) {
    return { why: "discardRefusedFailed", note: ignored.failed };
  }
  const inTheWay = ignored.out
    .split("\0")
    .filter(
      (path) =>
        path !== "" &&
        tracked.some(
          (back) => path === back || path.startsWith(`${back}/`) || back.startsWith(`${path}/`),
        ),
    );
  if (inTheWay.length > 0) {
    return { why: "discardRefusedIgnored", note: inTheWay.join("\n") };
  }
  for (const [args, paths] of [
    [["clean", "-f", "--quiet", "--"], untracked],
    [
      ["restore", "--source=HEAD", "--staged", "--worktree", "--no-recurse-submodules", "--"],
      tracked,
    ],
  ] as const) {
    const ran = paths.length === 0 ? null : await git(workspace, [...args, ...paths]);
    if (ran !== null && "failed" in ran) {
      return { why: "discardRefusedFailed", note: ran.failed };
    }
  }
  return null;
}

/** Why a discard press discarded nothing, as the wording key the page says it in. */
export type DiscardRefusal =
  | "discardRefusedChanged"
  | "discardRefusedNothing"
  | "discardRefusedNotOffered"
  | "discardRefusedIgnored"
  | "discardRefusedFailed";

export type Discarded =
  | { readonly ok: true }
  | { readonly ok: false; readonly why: DiscardRefusal; readonly note: string | null };

/**
 * A write this surface may make (D-0198): a workspace's uncommitted changes
 * thrown away, on one press. Its own class for `ReleasePort`'s reason; reading
 * needs no press, since the screen shows the list.
 */
export class DiscardPort {
  readonly #store: Pick<IterationStore, "read">;
  readonly #reading: PublishReading;
  /** One discard per lap and list at a time: a double press is one act. */
  readonly #running = new Map<string, Promise<Discarded>>();

  constructor(store: Pick<IterationStore, "read">, reading: PublishReading) {
    this.#store = store;
    this.#reading = reading;
  }

  async read(record: IterationRecord): Promise<Discardable> {
    return await discardableAt(record, await this.#reading(record));
  }

  /** Null when this was not a person's press. */
  async discard(
    press: Press,
    input: { readonly iterationId: string; readonly shown: string },
  ): Promise<Discarded | null> {
    if (!spendPress(press)) {
      return null;
    }
    const key = `${input.iterationId}\0${input.shown}`;
    const already = this.#running.get(key);
    if (already !== undefined) {
      return await already;
    }
    const running = this.#discard(input);
    this.#running.set(key, running);
    try {
      return await running;
    } finally {
      this.#running.delete(key);
    }
  }

  async #discard(input: { readonly iterationId: string; readonly shown: string }) {
    const found = await this.#store.read(input.iterationId);
    if (found.kind !== "read") {
      return refused("discardRefusedNotOffered", found.kind === "absent" ? null : found.reason);
    }
    const now = await this.read(found.record);
    if (now.kind === "clean") {
      return refused("discardRefusedNothing");
    }
    if (now.kind === "notOffered") {
      return refused("discardRefusedNotOffered");
    }
    if (now.shown !== input.shown) {
      return refused("discardRefusedChanged");
    }
    const failed = await discardUncommitted(now.workspace, now.listed);
    return failed === null ? ({ ok: true } as const) : refused(failed.why, failed.note);
  }
}

function refused(why: DiscardRefusal, note: string | null = null): Discarded {
  return { ok: false, why, note };
}

/** The press, answered with the discard screen saying what it did. */
export function discardRoute(
  app: Hono<PageEnv>,
  port: DiscardPort | null,
  wordingOf: (c: Context<PageEnv>) => Chrome,
): void {
  app.post(DISCARD_ROUTE, async (c) => {
    const wording = wordingOf(c);
    const form = await c.req.parseBody();
    const iterationId = typeof form["iteration"] === "string" ? form["iteration"] : "";
    const shown = typeof form["shown"] === "string" ? form["shown"] : "";
    const answer = async (
      status: 400 | 403 | 409,
      why:
        | DiscardRefusal
        | "discardRefusedNoApprover"
        | "discardRefusedPress"
        | "discardRefusedForm",
      note: string | null = null,
    ) =>
      c.html(
        await refusedPage(wording, {
          title: wording.discardHeading,
          id: "discard-refused",
          line: wording[why],
          href: viewHref(
            iterationId === ""
              ? { kind: "summary" }
              : { kind: "discard", iterationId, done: false },
            wording.lang,
          ),
          back: wording.discardBack,
          note,
          holders: [],
          releasable: false,
        }),
        status,
      );
    if (port === null) {
      return await answer(403, "discardRefusedNoApprover");
    }
    const minting = mintPress(c, form["token"]);
    if (!("press" in minting)) {
      return await answer(minting.status, "discardRefusedPress");
    }
    if (iterationId === "" || shown === "") {
      return await answer(400, "discardRefusedForm");
    }
    const discarded = await port.discard(minting.press, { iterationId, shown });
    if (discarded === null) {
      return await answer(403, "discardRefusedPress");
    }
    if (!discarded.ok) {
      return await answer(409, discarded.why, discarded.note);
    }
    return c.redirect(viewHref({ kind: "discard", iterationId, done: true }, wording.lang), 303);
  });
}
