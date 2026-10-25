/**
 * Signing this computer's `gh` in to GitHub from the page (rondo#676), so a
 * person whose rondo "cannot reach GitHub as you" is never sent to a terminal
 * to run `gh auth login`.
 *
 * **GitHub's device flow, through `gh` itself.** Without a terminal, `gh auth
 * login --web` prints a one-time code and the address to enter it at, then
 * waits until GitHub says the person approved it, and stores the credential
 * where it always does. rondo shows the code and the address, and holds
 * nothing: the credential is `gh`'s, in `gh`'s own configuration, as before.
 *
 * **`gh` runs through `forge.ts`**, where rondo runs `git` and `gh` on the
 * operator's behalf (AGENTS.md section 2): this module starts no process.
 *
 * **A computer without `gh` is told so before any press** (D-0204): where rondo
 * can fetch one, the press fetches it and then signs it in, so it is one press;
 * where it cannot, the page says to ask whoever installed rondo here.
 */
import { runCommand } from "./forge.js";

/** Where a sign-in stands, as the page shows it. */
export type SignIn =
  | { readonly kind: "none" }
  | { readonly kind: "waiting"; readonly code: string; readonly url: string }
  | { readonly kind: "signedIn" }
  | { readonly kind: "noGh" }
  /** No `gh`, and rondo can fetch one: the press does, then signs it in. */
  | { readonly kind: "installable" }
  | { readonly kind: "installFailed"; readonly reason: string }
  | { readonly kind: "failed"; readonly reason: string };

export interface GitHubSignIn {
  /** Where the latest sign-in stands, read without starting one. */
  now(): SignIn;
  /**
   * Starts a sign-in and answers once `gh` has printed its code, or has
   * ended. While one is running, a second press answers with it: one at a time.
   */
  start(): Promise<SignIn>;
}

/**
 * Whether there is a `gh` to run, and how to fetch one where there is not
 * (`./gh-install.ts`). The default is the one before D-0204: always there,
 * nothing to fetch, so a missing one is learnt from the run.
 */
export interface GhCli {
  found(): boolean;
  /** Null where rondo fetches none; else null when fetched, or why it was not. */
  readonly install: (() => Promise<string | null>) | null;
}

const ASSUMED: GhCli = { found: () => true, install: null };

/** How long `gh` may take to print its code before the press is answered without one. */
const CODE_WAIT_MS = 30_000;

/**
 * How long a sign-in may wait for the person. GitHub's device codes expire in
 * fifteen minutes and `gh` stops then; this only frees rondo from one that
 * does not.
 */
const SIGN_IN_BOUND_MS = 16 * 60_000;

// biome-ignore lint/suspicious/noControlCharactersInRegex: `gh` colours its output.
const ESCAPES = /\u001b\[[0-9;]*m/g;

export function gitHubSignIn(host: string, executable = "gh", cli: GhCli = ASSUMED): GitHubSignIn {
  let state: SignIn = { kind: "none" };
  const missing = (): SignIn | null =>
    cli.found() ? null : cli.install === null ? { kind: "noGh" } : { kind: "installable" };
  let running: Promise<SignIn> | null = null;
  const run = () =>
    new Promise<SignIn>((resolve) => {
      let said = "";
      const answer = (next: SignIn) => {
        state = next;
        resolve(next);
      };
      // ponytail: a `gh` that prints no code is answered here but left to run to
      // its bound, and a press meanwhile answers with this; nothing kills it sooner.
      const early = setTimeout(
        () => answer({ kind: "failed", reason: "gh printed no sign-in code" }),
        CODE_WAIT_MS,
      );
      const argv = ["auth", "login", "--hostname", host, "--web", "--git-protocol", "https"];
      void runCommand(executable, argv, SIGN_IN_BOUND_MS, {
        onOutput: (chunk) => {
          said += chunk.toString("utf8");
          const shown = codeIn(said);
          if (shown !== null && state.kind !== "waiting") {
            clearTimeout(early);
            answer({ kind: "waiting", ...shown });
          }
        },
      }).then((ran) => {
        clearTimeout(early);
        running = null;
        answer(
          ran.spawnError !== null && /ENOENT/.test(ran.spawnError)
            ? { kind: "noGh" }
            : ran.status === 0
              ? { kind: "signedIn" }
              : {
                  kind: "failed",
                  reason:
                    (ran.spawnError ?? ran.stderr.replace(ESCAPES, "").trim()) ||
                    "gh ended without signing in",
                },
        );
      });
    });
  const begin = async (): Promise<SignIn> => {
    const absent = missing();
    const failed = absent === null || cli.install === null ? null : await cli.install();
    if (absent?.kind === "noGh" || failed !== null) {
      state = failed === null ? { kind: "noGh" } : { kind: "installFailed", reason: failed };
      running = null;
      return state;
    }
    return await run();
  };
  return {
    // Read at each look (Codex on rondo#676's design): a missing `gh` shows its
    // press before any is pressed, and one installed since shows the sign-in's.
    now: () =>
      state.kind === "none" || state.kind === "noGh" ? (missing() ?? { kind: "none" }) : state,
    start: () => {
      running ??= begin();
      return running;
    },
  };
}

/** The one-time code and the address `gh` printed, or null before both are there. */
export function codeIn(printed: string): { readonly code: string; readonly url: string } | null {
  const plain = printed.replace(ESCAPES, "");
  const code = /one-time code:\s*([A-Z0-9]{4}-[A-Z0-9]{4})/.exec(plain)?.[1];
  const url = /(https:\/\/\S+\/login\/device)\b/.exec(plain)?.[1];
  return code === undefined || url === undefined ? null : { code, url };
}
