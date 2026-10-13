/**
 * The sign-in screen and its press (rondo#676): a computer whose rondo is not
 * signed in to GitHub is signed in from the page, with a one-time code, and
 * not from a terminal. The sign-in itself stands in here; what it does with
 * `gh` is `github-sign-in.test.ts`'s.
 */
import { expect, test } from "vitest";

import type { GitHubSignIn, SignIn } from "../../src/access/github-sign-in.js";
import { SignInPort } from "../../src/access/github-sign-in-route.js";
import { forgeBody } from "../../src/access/issue-read.js";
import { forgeView } from "../../src/access/page/thread-stops.js";
import { chromeFor } from "../../src/access/wording.js";
import type { ThreadMessageDraft } from "../../src/store/records.js";
import { fresh, get, operatorPage, portsOver, post, serving, tokenIn } from "./page-world.js";

const EN = chromeFor("en");

/** A sign-in that stands where a test puts it, and counts its starts. */
function standIn(state: SignIn): GitHubSignIn & { starts: number; state: SignIn } {
  const signIn = {
    starts: 0,
    state,
    now: () => signIn.state,
    start: async () => {
      signIn.starts += 1;
      signIn.state = { kind: "waiting", code: "AB12-CD34", url: "https://github.com/login/device" };
      return await Promise.resolve(signIn.state);
    },
  };
  return signIn;
}

async function screen(state: SignIn | null): Promise<string> {
  const world = fresh();
  const html = await operatorPage(
    { ...portsOver(world), signIn: state === null ? null : new SignInPort(standIn(state)) },
    "t",
    { kind: "signIn" },
  );
  return html.slice(html.indexOf('id="sign-in"'));
}

test("the sign-in screen says where this computer stands and offers the press only where it can be pressed (rondo#676)", async () => {
  const none = await screen({ kind: "none" });
  expect(none).toContain(EN.signInNone);
  expect(none).toContain('action="/github-sign-in?lang=en"');

  const waiting = await screen({
    kind: "waiting",
    code: "AB12-CD34",
    url: "https://github.com/login/device",
  });
  expect(waiting).toContain("AB12-CD34");
  expect(waiting).toContain('href="https://github.com/login/device"');
  // It asks again by itself until GitHub answers, and offers no second press.
  expect(waiting).toContain('hx-get="/?github=sign-in&amp;lang=en"');
  expect(waiting).not.toContain("<form");

  const done = await screen({ kind: "signedIn" });
  expect(done).toContain(EN.signInDone);
  expect(done).not.toContain("hx-get");
  // Signed in again from here if GitHub later lets the sign-in go.
  expect(done).toContain('action="/github-sign-in?lang=en"');

  // Installing gh is setup's: said for whoever maintains rondo, and pressed
  // again once it is installed.
  const noGh = await screen({ kind: "noGh" });
  expect(noGh).toContain(EN.signInNoGh);
  expect(noGh).toContain('action="/github-sign-in?lang=en"');

  const failed = await screen({ kind: "failed", reason: "error connecting to github.com" });
  expect(failed).toContain(EN.signInFailed);
  expect(failed).toContain("error connecting to github.com");
  expect(failed).toContain('action="/github-sign-in?lang=en"');

  // No approver, no port: the screen says it is not signed in and draws no press.
  const unported = await screen(null);
  expect(unported).toContain(EN.signInNone);
  expect(unported).not.toContain("<form");
});

test("a person's press starts the sign-in and lands on the screen with the code; a script starts nothing", async () => {
  const world = fresh();
  const signIn = standIn({ kind: "none" });
  const { base, stop, served } = await serving({
    // A writer, so the page carries the press token.
    ...portsOver(world, "ada", []),
    signIn: new SignInPort(signIn),
  });
  const page = (await get(base, "/?github=sign-in&lang=en")).body;
  const token = tokenIn(page);

  const script = await post(base, { token }, { "sec-fetch-user": undefined }, "/github-sign-in");
  expect(script.status).toBe(403);
  expect(script.body.replaceAll("&#39;", "'")).toContain(EN.signInRefusedPress);
  expect(signIn.starts).toBe(0);

  const pressed = await post(base, { token }, {}, "/github-sign-in");
  expect(pressed.status).toBe(303);
  expect(pressed.location).toBe("/?github=sign-in&lang=en");
  expect(signIn.starts).toBe(1);
  const after = (await get(base, pressed.location ?? "")).body;
  expect(after).toContain("AB12-CD34");
  stop.abort();
  expect(await served).toBe(0);
});

test("an issue rondo could not read because it is signed out links to the sign-in; a missing gh does not", async () => {
  const fold = async (why: "signed_out" | "no_gh") =>
    await (
      forgeView(EN, {
        body: forgeBody({ named: "#12", atMs: 0, failed: { why, detail: "gh: exited 4" } }),
      } as ThreadMessageDraft) as { toString(): Promise<string> | string }
    ).toString();
  const signedOut = await fold("signed_out");
  expect(signedOut).toContain('href="/?github=sign-in&amp;lang=en"');
  expect(signedOut).toContain(EN.signInAction);
  const noGh = await fold("no_gh");
  expect(noGh).not.toContain("github=sign-in");
  expect(noGh).toContain("the GitHub CLI is not installed on this computer");
});
