/**
 * The sign-in press, `POST /github-sign-in` (rondo#676), and the port it goes
 * through. Out of `web-app.ts`, which is at its size cap, as `line-ports.ts`
 * is; the press is checked there, through {@link mintPress} and
 * {@link spendPress}.
 */
import type { Context, Hono } from "hono";
import type { GitHubSignIn, SignIn } from "./github-sign-in.js";
import { viewHref } from "./page-logic/routes.js";
import { refusedPage } from "./screens/refused.js";
import { mintPress, type PageEnv, type Press, spendPress } from "./web-app.js";
import type { Chrome } from "./wording.js";

export const SIGN_IN_ROUTE = "/github-sign-in";

/**
 * Signing this computer's `gh` in to GitHub, on one press. Reading where a
 * sign-in stands needs none: the screen shows it.
 */
export class SignInPort {
  readonly #signIn: GitHubSignIn;

  constructor(signIn: GitHubSignIn) {
    this.#signIn = signIn;
  }

  now(): SignIn {
    return this.#signIn.now();
  }

  /** Null when this was not a person's press. */
  async start(press: Press): Promise<SignIn | null> {
    return spendPress(press) ? await this.#signIn.start() : null;
  }
}

/** The press, answered with the sign-in screen, which shows the code. */
export function signInRoute(
  app: Hono<PageEnv>,
  port: SignInPort | null,
  wordingOf: (c: Context<PageEnv>) => Chrome,
): void {
  app.post(SIGN_IN_ROUTE, async (c) => {
    const wording = wordingOf(c);
    const back = viewHref({ kind: "signIn" }, wording.lang);
    const minting = port === null ? null : mintPress(c, (await c.req.parseBody())["token"]);
    if (port === null || minting === null || !("press" in minting)) {
      return c.html(
        await refusedPage(wording, {
          title: wording.signInAction,
          id: "sign-in-refused",
          line: port === null ? wording.signInRefusedNoApprover : wording.signInRefusedPress,
          href: back,
          back: wording.signInBack,
          note: null,
          holders: [],
          releasable: false,
        }),
        403,
      );
    }
    await port.start(minting.press);
    return c.redirect(back, 303);
  });
}
