import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, test } from "vitest";

import { codeIn, gitHubSignIn } from "../../src/access/github-sign-in.js";

/** A stand-in `gh`: a POSIX script, as `forge.test.ts`'s are. */
function standIn(body: string): string {
  const path = join(mkdtempSync(join(tmpdir(), "rondo-gh-sign-in-")), "gh");
  writeFileSync(path, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  return path;
}

const posix = test.skipIf(process.platform === "win32");

test("the code and the address are read from what gh prints, colours and all (rondo#676)", () => {
  expect(
    codeIn(
      "\u001b[0;33m!\u001b[0m First copy your one-time code: \u001b[1mAB12-CD34\u001b[0m\n" +
        "Open this URL to continue in your web browser: https://github.com/login/device\n",
    ),
  ).toEqual({ code: "AB12-CD34", url: "https://github.com/login/device" });
  expect(codeIn("! First copy your one-time code: AB12-CD34\n")).toBeNull();
});

posix(
  "a sign-in waits on the person with the code, then is signed in when gh ends well",
  async () => {
    const signIn = gitHubSignIn(
      "github.com",
      standIn(
        'echo "! First copy your one-time code: AB12-CD34" >&2\n' +
          'echo "Open this URL to continue in your web browser: https://github.com/login/device" >&2\n' +
          "sleep 1\nexit 0",
      ),
    );
    expect(signIn.now()).toEqual({ kind: "none" });
    const started = await signIn.start();
    expect(started).toEqual({
      kind: "waiting",
      code: "AB12-CD34",
      url: "https://github.com/login/device",
    });
    // One at a time: a second press answers with the sign-in already waiting.
    expect(await signIn.start()).toEqual(started);
    await expect.poll(() => signIn.now(), { timeout: 5_000 }).toEqual({ kind: "signedIn" });
  },
);

posix("a sign-in gh refuses says what gh said", async () => {
  const signIn = gitHubSignIn(
    "github.com",
    standIn('echo "error connecting to github.com" >&2\nexit 1'),
  );
  expect(await signIn.start()).toEqual({
    kind: "failed",
    reason: "error connecting to github.com",
  });
});

test("a computer without gh says so, not a failure", async () => {
  const signIn = gitHubSignIn("github.com", join(tmpdir(), "rondo-no-such-gh"));
  expect(await signIn.start()).toEqual({ kind: "noGh" });
});
