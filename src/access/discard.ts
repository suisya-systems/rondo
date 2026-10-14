/**
 * Discarding the uncommitted changes a lap left in its workspace, from the
 * page (rondo#676, D-0198): what the confirmation screen reads, the port the
 * press goes through and the press itself, `POST /discard`. Out of
 * `web-app.ts`, which is at its size cap, as `github-sign-in-route.ts` is.
 *
 * **What the screen read is what is discarded, or nothing is.** The screen
 * draws the list publishing refused over (D-0060 rule 4) and carries its
 * digest; the press reads the publish plan again and discards only where the
 * list is still the one shown. The lap is closed, so no worker is writing in
 * the workspace between that read and the discard.
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

/** How long one of the two git commands may take: local, so well short of a forge's. */
const DISCARD_TIMEOUT_MS = 60_000;

/** What the discard screen shows for one lap. */
export type Discardable =
  | {
      readonly kind: "uncommitted";
      readonly workspace: string;
      /** As `git status` listed them: what the press throws away. */
      readonly paths: readonly string[];
      readonly elsewhere: string | null;
      /** The digest the press carries back. */
      readonly shown: string;
    }
  /** Publishing is not held by uncommitted work: nothing to discard. */
  | { readonly kind: "clean" }
  /** Publishing is refused for something else first, so the list is not known. */
  | { readonly kind: "notOffered" };

/** Which of the three one publish plan is. */
export function discardableOf(record: IterationRecord, shown: PublishShown): Discardable {
  if (shown.kind === "ready") {
    return { kind: "clean" };
  }
  const block = shown.block;
  if (block.why !== "uncommitted") {
    return { kind: "notOffered" };
  }
  const workspace = planField(record, "workspace");
  return {
    kind: "uncommitted",
    workspace,
    paths: block.paths,
    elsewhere: block.elsewhere,
    shown: contentDigest({ workspace, paths: [...block.paths], elsewhere: block.elsewhere }),
  };
}

/**
 * Throw away what `git status` lists: tracked changes back to what is checked
 * out, untracked paths removed. Ignored paths stay (no `-x`), which is the
 * repository's own statement that they are not work. Null when both ran.
 *
 * **Refused before anything runs where an ignored file is in the way** (Codex
 * round 2): one inside a folder that stands where the branch has a file would
 * be deleted when that file comes back, and it was never on the list.
 *
 * **`clean` first, under the ignore rules the list was read with** (Codex
 * round 1). Reset first would put back a `.gitignore` the changes edited, and
 * `clean` would then delete what that edit ignored -- files nobody was shown.
 *
 * ponytail: an untracked nested repository survives `clean -fd`; the screen
 * then lists it as still there rather than claiming it is gone.
 */
export async function discardUncommitted(
  workspace: string,
): Promise<{ readonly why: DiscardRefusal; readonly note: string } | null> {
  const listed = async (...args: string[]): Promise<readonly string[] | string> => {
    const ran = await runCommand("git", ["-C", workspace, ...args], DISCARD_TIMEOUT_MS);
    return ran.spawnError !== null || ran.status !== 0
      ? `${ran.commandLine}: ${ran.spawnError ?? ran.stderr.trim()}`
      : ran.stdout.split("\0").filter((path) => path !== "");
  };
  const ignored = await listed("ls-files", "-z", "--others", "--ignored", "--exclude-standard");
  const branch = await listed("ls-tree", "-r", "-z", "--name-only", "HEAD");
  if (typeof ignored === "string" || typeof branch === "string") {
    return {
      why: "discardRefusedFailed",
      note: typeof ignored === "string" ? ignored : `${branch}`,
    };
  }
  const files = new Set(branch);
  const inTheWay = ignored.filter((path) =>
    path
      .split("/")
      .slice(0, -1)
      .some((_, at, parts) => files.has(parts.slice(0, at + 1).join("/"))),
  );
  if (inTheWay.length > 0) {
    return { why: "discardRefusedIgnored", note: inTheWay.join("\n") };
  }
  for (const args of [
    ["clean", "-fd", "--quiet"],
    ["reset", "--hard", "--quiet"],
  ]) {
    const ran = await runCommand("git", ["-C", workspace, ...args], DISCARD_TIMEOUT_MS);
    if (ran.spawnError !== null || ran.status !== 0) {
      return {
        why: "discardRefusedFailed",
        note: `${ran.commandLine}: ${ran.spawnError ?? ran.stderr.trim()}`,
      };
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
    return discardableOf(record, await this.#reading(record));
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
    const failed = await discardUncommitted(now.workspace);
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
