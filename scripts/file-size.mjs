/**
 * Line budget per source file (rondo#571).
 *
 * Every file under `<root>/src` may hold at most DEFAULT_LIMIT lines. A file already over it is
 * listed in `file-size-allowlist.json` with its current line count as its own cap, and a cap only
 * moves down: the check fails when a file grows past its cap, and also when it has shrunk below
 * it (lower the entry) or fits the default (delete the entry). Raising a cap is the one edit this
 * cannot stop; it shows in the diff of the allowlist, which is where review looks.
 *
 * Usage: node scripts/file-size.mjs [root] [allowlist.json]
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_LIMIT = 2000;
const root = process.argv[2] ?? fileURLToPath(new URL("..", import.meta.url));
const allowlistPath =
  process.argv[3] ?? fileURLToPath(new URL("file-size-allowlist.json", import.meta.url));
const allowlist = JSON.parse(readFileSync(allowlistPath, "utf8"));

const lineCount = (path) => readFileSync(path, "utf8").split("\n").length - 1;
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );

const problems = [];
const seen = new Set();
for (const file of walk(join(root, "src"))) {
  const name = relative(root, file).split("\\").join("/");
  const lines = lineCount(file);
  const cap = allowlist[name];
  seen.add(name);
  if (cap === undefined) {
    if (lines > DEFAULT_LIMIT) {
      problems.push(`${name}: ${lines} lines, over the ${DEFAULT_LIMIT} budget; split it`);
    }
  } else if (lines > cap) {
    problems.push(
      `${name}: ${lines} lines, over its allowlisted cap ${cap}; split it, do not raise the cap`,
    );
  } else if (lines <= DEFAULT_LIMIT) {
    problems.push(
      `${name}: ${lines} lines fits the ${DEFAULT_LIMIT} budget; delete its allowlist entry`,
    );
  } else if (lines < cap) {
    problems.push(`${name}: ${lines} lines, under its cap ${cap}; lower the cap to ${lines}`);
  }
}
for (const name of Object.keys(allowlist)) {
  if (!seen.has(name))
    problems.push(`${name}: allowlisted but not found; delete its allowlist entry`);
}

if (problems.length > 0) {
  process.stderr.write(`file-size: ${problems.length} problem(s)\n${problems.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write(
  `file-size: ok (${seen.size} files, ${Object.keys(allowlist).length} allowlisted)\n`,
);
