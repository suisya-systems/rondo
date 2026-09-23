/**
 * `dogfood-env.sh` embeds several `node -e '...'` bodies inside single-quoted
 * bash strings. Bash gives single quotes no escape: the first apostrophe
 * anywhere in the body -- even inside a comment -- closes the string early,
 * and the rest is handed to the shell as loose words (rondo#432: a comment's
 * "lap 10's" broke `== Plan` with `//: Is a directory`, exit 126). `bash -n`
 * does not catch this: what remains after the early close is still valid
 * shell, just not what was meant.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const scriptPath = fileURLToPath(new URL("../../scripts/dogfood-env.sh", import.meta.url));

test("dogfood-env.sh parses as bash", () => {
  expect(() => execFileSync("bash", ["-n", scriptPath])).not.toThrow();
});

test("no node -e body holds an apostrophe that would close its bash string early", () => {
  const script = readFileSync(scriptPath, "utf8");
  const bodies = [...script.matchAll(/node(?: --input-type=module)? -e '\n([\s\S]*?)\n[ \t]*'/g)];
  expect(bodies.length).toBeGreaterThan(0);
  for (const [, body] of bodies) {
    expect(body).not.toMatch(/'/);
  }
});
