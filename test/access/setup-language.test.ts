/**
 * The one question setup asks, and what it does with the answer (rondo#352).
 *
 * `scripts/operator-language.sh` is shell rather than TypeScript, so it is
 * tested the way it is used: run over a temporary root with a scripted answer
 * on its stdin, and what it left behind read back. It was split out of
 * `scripts/dogfood-env.sh` for exactly this -- the same reason
 * `scripts/start-command.sh` was -- because the whole of setup clones continuo
 * and builds rondo, and a question is not worth minutes to ask about.
 *
 * Four properties carry the issue and the rest is prose:
 *
 *  1. **It asks once.** A second run reads the record and asks nothing, with
 *     no terminal to ask at -- which is what "every later start reads it"
 *     rests on.
 *  2. **The record is the operator's to see and change** (rondo#352's "not
 *     this"): a hand-written file, comments and all, is what the next run
 *     answers with.
 *  3. **Nobody is guessed at.** Nothing said and nobody to ask is empty --
 *     English, the floor of `D-0056` rule 2 -- and no file is written claiming
 *     an answer that was never given.
 *  4. **What is recorded is a tag a host will start on.** An ill-formed one is
 *     refused here rather than written into a unit, where it becomes a host
 *     that refuses to start (`operatorLanguage`, `src/access/cli.ts`).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "vitest";

/**
 * Every case here runs `bash` over a real directory, and the suite runs on a
 * Windows cell as well (AGENTS.md). Setup is a program for the machine rondo
 * is resident on, which is that machine's shell.
 */
const posix = test.skipIf(process.platform === "win32");

const asker = join(dirname(fileURLToPath(import.meta.url)), "../../scripts/operator-language.sh");

/**
 * Run the asker over `root` with `answer` typed at whatever it asks, and
 * answer with the tag it printed -- empty when nobody said.
 *
 * stdin is a pipe and never a terminal, which is what every case here wants:
 * the automatic question is asked only at a terminal, so what is exercised is
 * a setup run from a script unless `--language ask` puts the question anyway.
 */
function ask(root: string, args: readonly string[], answer = ""): string {
  return execFileSync("bash", [asker, "--root", root, ...args], {
    encoding: "utf8",
    input: answer,
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

/** The tag a record holds, as the asker would read it back. */
function recorded(root: string): string | null {
  const path = join(root, "operator-language");
  if (!existsSync(path)) {
    return null;
  }
  return (
    readFileSync(path, "utf8")
      .split("\n")
      .map((line) => line.replace(/#.*/, "").trim())
      .find((line) => line !== "") ?? null
  );
}

function root(): string {
  return mkdtempSync(join(tmpdir(), "rondo-language-"));
}

posix("the answer to the one question is what setup writes, and what it remembers", () => {
  const where = root();

  // `2` is the second of the two shipped sets, named in itself on screen.
  expect(ask(where, ["--language", "ask"], "2\n")).toBe("ja");

  expect(recorded(where)).toBe("ja");
  // Asked once: a later run has no terminal and asks nothing, and still
  // answers -- which is the language surviving a fresh shell.
  expect(ask(where, [])).toBe("ja");
});

posix("the record is a file the operator opens and changes", () => {
  const where = root();
  ask(where, ["--language", "ask"], "2\n");

  // What they see is a tag with prose around it, not an opaque blob; and what
  // they write by hand is what the next run answers with.
  expect(readFileSync(join(where, "operator-language"), "utf8")).toContain("--language ask");
  writeFileSync(join(where, "operator-language"), "# mine\nen\n");

  expect(ask(where, [])).toBe("en");
});

posix("asking again is how somebody who has already answered changes their answer", () => {
  const where = root();
  ask(where, ["--language", "ask"], "2\n");

  expect(ask(where, ["--language", "ask"], "1\n")).toBe("en");
  expect(recorded(where)).toBe("en");
  // And naming the tag outright is the other way, for a language the two-line
  // question does not offer.
  expect(ask(where, ["--language", "zh-Hant"])).toBe("zh-Hant");
  expect(recorded(where)).toBe("zh-Hant");
});

posix("nothing said and nobody to ask is English, and claims nothing", () => {
  const where = root();

  // No terminal on stdin: a setup run from a script, a CI job or a sandbox.
  expect(ask(where, [])).toBe("");
  // Nothing is written, because nobody answered. The host's locale is not
  // consulted here or anywhere (rondo#352's "not this").
  expect(recorded(where)).toBe(null);
});

posix("the host's variable seeds a first run and never overwrites an answer", () => {
  const first = root();
  expect(ask(first, ["--from-environment", "ja-JP"])).toBe("ja-JP");
  expect(recorded(first)).toBe("ja-JP");

  const second = root();
  ask(second, ["--language", "ask"], "1\n");
  // A variable left in a shell profile is not a person changing their mind.
  expect(ask(second, ["--from-environment", "ja"])).toBe("en");
  expect(recorded(second)).toBe("en");
});

posix("a tag no host would start on is refused rather than recorded", () => {
  const where = root();

  // `ja_JP` is a locale and not a tag, which is the mistake the runbook's
  // refusal table already names.
  expect(() => ask(where, ["--language", "ja_JP"])).toThrow();
  expect(recorded(where)).toBe(null);

  // The same refusal on the way back out, so a record edited into nonsense is
  // a setup that stops rather than a page that never opens.
  writeFileSync(join(where, "operator-language"), "Japanese please\n");
  expect(() => ask(where, [])).toThrow();
});
