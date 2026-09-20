/**
 * The claims `AGENTS.md` and `docs/operations/rondo-cli.md` make about the
 * tree, checked against the tree.
 *
 * rondo#324 is the reason this file exists, and its finding is the design.
 * `DECISIONS.md` -- 83 entries, walked by hand -- had drifted from the
 * implementation in one place. The prose had drifted in several, and the
 * asymmetry is the whole explanation: `test/architecture/import-boundaries.test.ts`
 * watches the code and nothing watched the prose. A fix with no checker behind
 * it drifts again for the reason it drifted the first time.
 *
 * **What is checked here is a narrow kind of sentence, deliberately.** Not
 * "is this documentation good" -- that is a review, and a test cannot hold it.
 * What a test can hold is a sentence that *enumerates* something the tree also
 * enumerates: the commands the CLI dispatches, the layers under `src/`, the
 * modules that may start a process, the continuo verbs rondo drives. Each of
 * those is a closed set on both sides, so the two sets can simply be compared,
 * and each of them is the kind of sentence that goes stale invisibly -- nobody
 * adding a verb thinks to re-read a paragraph in another file.
 *
 * **Counts were removed rather than checked.** "`src/` holds five layers" and
 * "The operator's twelve commands" were both false when this was written, and
 * a count is redundant with the list beside it. The prose now names the members
 * and states no number, so there is no second place holding the same fact --
 * which is the same reasoning `src/access/cli.ts` applies to its own flags.
 *
 * **Each claim is found by an anchor phrase, and a missing anchor is a
 * failure.** Deleting the sentence has to break this file; otherwise the
 * cheapest way to make a red check green would be to delete the claim it
 * checks, and the documentation would decay into whatever survives that.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { COMMANDS } from "../../src/access/cli.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const AGENTS = readFileSync(join(ROOT, "AGENTS.md"), "utf8");
const CLI_DOC_PATH = join("docs", "operations", "rondo-cli.md");
const CLI_DOC = readFileSync(join(ROOT, CLI_DOC_PATH), "utf8");

/**
 * The paragraph or bullet `phrase` appears in, as one string.
 *
 * A claim wraps across lines at eighty columns, so the unit a reader thinks of
 * as "the sentence" is several lines of the file. The block ends at the first
 * blank line, heading or *following* bullet -- the anchor line may itself be a
 * bullet, which is why the first line is taken before the loop rather than by
 * it.
 *
 * Throws when the phrase is absent, so that deleting a checked claim fails
 * here rather than quietly removing the check with it.
 */
function claim(document: string, phrase: string): string {
  const lines = document.split("\n");
  const start = lines.findIndex((line) => line.includes(phrase));
  if (start === -1) {
    throw new Error(
      `No line of the document contains ${JSON.stringify(phrase)}. ` +
        "This anchor is how test/architecture/docs-claims.test.ts finds the claim it checks. " +
        "If the claim moved, move the anchor with it; if it was deleted, delete its case here " +
        "and say in the diff why the tree no longer has that fact to state.",
    );
  }
  const block = [lines[start] ?? ""];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "" || line.startsWith("#") || /^\s*- /.test(line)) {
      break;
    }
    block.push(line);
  }
  return block.join("\n");
}

/** Every `backticked` token in `text`, in order, deduplicated. */
function backticked(text: string): string[] {
  return [...new Set([...text.matchAll(/`([^`]+)`/g)].map((match) => match[1] ?? ""))];
}

/** Backticked tokens matching `pattern`, sorted, so two sets compare as one. */
function named(text: string, pattern: RegExp): string[] {
  return backticked(text)
    .filter((token) => pattern.test(token))
    .sort();
}

/** Every `.ts` module under `src/`, as repository-relative POSIX paths. */
function modulesUnderSrc(directory = "src"): string[] {
  return readdirSync(join(ROOT, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      return modulesUnderSrc(path);
    }
    return entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") ? [path] : [];
  });
}

describe("the CLI reference documents the commands the CLI dispatches", () => {
  /**
   * The two spellings the reference uses for a command, and nothing looser.
   *
   * A bare `rondo <word>` in prose would match "rondo never merges", so the
   * pattern requires either the executable as it is actually typed
   * (`node bin/rondo.mjs publish`) or the opening backtick of a code span.
   * That keeps the reverse direction below usable: every match is a claim that
   * a verb by that name exists.
   */
  const MENTION = /(?:rondo\.mjs|`rondo) ([a-z][a-z-]*)/g;
  const mentioned = new Set([...CLI_DOC.matchAll(MENTION)].map((match) => match[1] ?? ""));

  it("names every command, so a new verb cannot ship undocumented", () => {
    const undocumented = COMMANDS.filter((command) => !mentioned.has(command));
    expect(
      undocumented,
      `${CLI_DOC_PATH} never mentions ${undocumented.join(", ")}, which src/access/cli.ts ` +
        "dispatches. A verb an operator cannot find is a verb that is not there.",
    ).toEqual([]);
  });

  it("names no command the CLI would refuse", () => {
    const invented = [...mentioned].filter(
      (verb) => !(COMMANDS as readonly string[]).includes(verb),
    );
    expect(
      invented,
      `${CLI_DOC_PATH} shows 'rondo ${invented.join("', 'rondo ")}', which src/access/cli.ts ` +
        "does not dispatch. A reference for a verb that was renamed or removed is worse than " +
        "no reference: it reads as current.",
    ).toEqual([]);
  });
});

describe("AGENTS.md's enumerations match the tree", () => {
  it("names the layers under src/", () => {
    const stated = named(claim(AGENTS, "holds these layers"), /^src\/[a-z]+\/$/);
    const actual = readdirSync(join(ROOT, "src"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `src/${entry.name}/`)
      .sort();
    expect(
      stated,
      "AGENTS.md section 1 names a different set of layers than src/ holds. A directory added " +
        "under src/ is a layer the boundary test makes you classify; this is the sentence that " +
        "has to learn about it at the same moment.",
    ).toEqual(actual);
  });

  it("names the modules that may start a process", () => {
    const stated = named(claim(AGENTS, "start a process"), /^src\/.+\.tsx?$/);
    // Acquisition, not mention: every comment in this tree writes the module
    // name inside backticks, and every acquisition writes it inside double
    // quotes -- `import ... from "node:child_process"`,
    // `process.getBuiltinModule("node:child_process")`. The boundary sweep is
    // what refuses any third spelling, so this pattern does not have to.
    const spawning = modulesUnderSrc()
      .filter((module) => readFileSync(join(ROOT, module), "utf8").includes('"node:child_process"'))
      .sort();
    expect(
      stated,
      "AGENTS.md section 2 names a different set of process-starting modules than src/ has. " +
        "This is rondo#324's own example: the file said src/continuo/ was the only one while " +
        "the boundary table granted src/access/forge.ts the same capability (D-0025 rule 6).",
    ).toEqual(spawning);
  });

  it("names the continuo verbs rondo drives", () => {
    const stated = named(claim(AGENTS, "continuo verbs rondo drives"), /^[a-z]+ [a-z]+$/);
    // The contracts in `src/continuo/protocol.ts` are the verbs rondo *can*
    // spell; the ones handed to `run()` in the invoker are the ones it drives.
    // The difference is the point: a contract declared and never invoked is a
    // verb rondo does not drive, and the claim is about driving.
    const protocol = readFileSync(join(ROOT, "src/continuo/protocol.ts"), "utf8");
    const invoker = readFileSync(join(ROOT, "src/continuo/invoker.ts"), "utf8");
    const commandOf = new Map(
      [
        ...protocol.matchAll(
          /export const ([A-Z_]+): VerbContract<[^>]*> = \{\s*command: \[([^\]]*)\]/g,
        ),
      ].map((match) => [
        match[1] ?? "",
        [...(match[2] ?? "").matchAll(/"([a-z-]+)"/g)].map((word) => word[1]).join(" "),
      ]),
    );
    const driven = [
      ...new Set(
        [...invoker.matchAll(/\brun\(\s*continuo,\s*([A-Z_]+)/g)].map(
          (match) => commandOf.get(match[1] ?? "") ?? `<${match[1] ?? ""} is not a VerbContract>`,
        ),
      ),
    ].sort();
    expect(
      stated,
      "AGENTS.md section 2 names a different set of continuo verbs than src/continuo/invoker.ts " +
        "drives. The set moves whenever a verb is taken up or dropped, and the paragraph around " +
        "it is about which of them carry --json, which is a claim about exactly these verbs.",
    ).toEqual(driven);
  });
});
