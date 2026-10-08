/** The line-budget check (rondo#571): over budget fails, an allowlist entry only moves down. */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const script = fileURLToPath(new URL("../../scripts/file-size.mjs", import.meta.url));

const run = (lines: number, allowlist: Record<string, number>) => {
  const root = mkdtempSync(join(tmpdir(), "file-size-"));
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "src", "a.ts"), "x\n".repeat(lines));
  const list = join(root, "allow.json");
  writeFileSync(list, JSON.stringify(allowlist));
  return spawnSync("node", [script, root, list], { encoding: "utf8" });
};

test("a file within the default budget passes", () => {
  expect(run(2000, {}).status).toBe(0);
});
test("a file over the budget and not listed fails", () => {
  expect(run(2001, {}).status).toBe(1);
});
test("a listed file passes at exactly its cap", () => {
  expect(run(2500, { "src/a.ts": 2500 }).status).toBe(0);
});
test("a listed file that grew fails", () => {
  expect(run(2501, { "src/a.ts": 2500 }).status).toBe(1);
});
test("a listed file that shrank must lower its cap", () => {
  expect(run(2400, { "src/a.ts": 2500 }).status).toBe(1);
});
test("an entry for a file now within budget must be deleted", () => {
  expect(run(1900, { "src/a.ts": 2500 }).status).toBe(1);
});
test("an entry for a missing file must be deleted", () => {
  expect(run(10, { "src/gone.ts": 2500 }).status).toBe(1);
});
