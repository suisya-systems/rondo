/**
 * Which triggers the Windows cells run on, asserted here because the mechanism
 * is one expression in a file no test suite otherwise reads.
 *
 * `D-0087` moved the Windows cells off the pull-request path and onto the
 * nightly schedule and `workflow_dispatch`. That decision has two failure
 * modes, and they point in opposite directions:
 *
 *  1. **The cells come back to the pull-request path**, by someone restoring
 *     `os: [ubuntu-latest, windows-latest]` while resolving a conflict in this
 *     file. Nothing goes red -- the merge gate gets slower and starts failing
 *     for reasons unrelated to the change again, which is the state `#336`
 *     measured.
 *  2. **The cells leave the matrix entirely**, by someone deleting the
 *     `windows-latest` half of the expression. Nothing goes red either, and
 *     rondo silently stops observing the two things only Windows observes --
 *     `D-0004`'s cp932 console and backslash path separators. `D-0004` names
 *     exactly that as its own falsifier, so it is a decision to record and not
 *     an edit to make here.
 *
 * Both are edits to a YAML file that no compiler and no other test reads, so
 * this file reads it. The assertions are over the workflow's TEXT rather than
 * over a parsed document: the repository has no YAML parser in its
 * dependencies, and the two mistakes above are both visible in the text.
 *
 * Comments are stripped before anything is asserted, for the reason
 * `test/cadenza/pin.test.ts` gives about the same file: this workflow's
 * comments quote its own expressions at length, and a comment mentioning
 * `windows-latest` must not stand in for the cell running.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const WORKFLOW = readFileSync(
  join(import.meta.dirname, "..", "..", ".github", "workflows", "ci.yml"),
  "utf8",
);
const LINES = WORKFLOW.split("\n").filter((line) => !/^\s*#/.test(line));
const CODE = LINES.join("\n");

/**
 * The `os:` value of the `double-green` matrix, folded to one line.
 *
 * It is a multi-line folded scalar in the file, and every claim below is about
 * the whole expression rather than about whichever line a fragment landed on.
 */
const osExpression = (): string => {
  const start = LINES.findIndex((line) => /^\s*os:/.test(line));
  expect(start, "the double-green matrix has no `os:` key").toBeGreaterThanOrEqual(0);
  const collected = [LINES[start] ?? ""];
  for (const line of LINES.slice(start + 1)) {
    // The next mapping key ends the scalar; continuation lines are deeper and
    // are not keys.
    if (/^\s*[\w-]+:/.test(line)) break;
    collected.push(line);
  }
  return collected.join(" ").replace(/\s+/g, " ").trim();
};

describe("the Windows cells run nightly and on demand, and not on a pull request (D-0087)", () => {
  test("the workflow still runs on pull requests, and now also on a schedule and on demand", () => {
    expect(CODE).toMatch(/^\s*pull_request:/m);
    expect(CODE).toMatch(/^\s*workflow_dispatch:/m);
    // A `schedule:` key with no cron under it is a trigger that never fires.
    expect(CODE).toMatch(/^\s*schedule:\n\s*- cron: "[^"]+"/m);
  });

  test("windows-latest is still a cell, and appears only inside the trigger-conditional list", () => {
    const windowsLines = LINES.filter((line) => line.includes("windows-latest"));
    // Retiring the cell is D-0004's stated falsifier and a decision to record.
    // If this is what went red, the answer is an entry in DECISIONS.md, not a
    // change to this test.
    expect(windowsLines).not.toHaveLength(0);
    // And it is reached through the expression rather than listed outright: a
    // plain `os: [ubuntu-latest, windows-latest]` puts the cell back in front
    // of every merge, which is what D-0087 moved it out of.
    for (const line of windowsLines) {
      expect(line).toContain("fromJSON");
    }
  });

  test("the cell's two triggers are the scheduled and the manual one", () => {
    const expression = osExpression();
    expect(expression).toContain("github.event_name == 'schedule'");
    expect(expression).toContain("github.event_name == 'workflow_dispatch'");
    // The fallback -- what a pull request and a push to main get -- names
    // ubuntu and nothing else.
    expect(expression).toMatch(/\|\|\s*fromJSON\('\[\s*"ubuntu-latest"\s*\]'\)/);
  });

  test("the folded expression really is one line once YAML has folded it", () => {
    // The mistake this pins was made while writing the file: in a `>-` scalar,
    // a line indented FURTHER than the first keeps its newline instead of being
    // folded into it, and the value GitHub then evaluates has a newline in the
    // middle of `${{ ... }}`. It parses as valid YAML either way, so the only
    // place it shows up is a runner. Equal indentation on every continuation
    // line is the whole of the fix, and is what is asserted.
    const start = LINES.findIndex((line) => /^\s*os:/.test(line));
    const continuations: string[] = [];
    for (const line of LINES.slice(start + 1)) {
      if (/^\s*[\w-]+:/.test(line)) break;
      if (line.trim() !== "") continuations.push(line);
    }
    expect(continuations.length, "the os expression is not a folded scalar").toBeGreaterThan(0);
    const indents = new Set(continuations.map((line) => line.length - line.trimStart().length));
    expect([...indents]).toHaveLength(1);
  });

  test("a nightly and a push to main cannot cancel each other", () => {
    // Both run at `refs/heads/main`. Without the event in the key they share a
    // concurrency group, and `cancel-in-progress` makes a merge able to kill
    // the night's only Windows run -- leaving the cell unobserved for a day
    // with nothing red to say so.
    const group = LINES.find((line) => /^\s*group:/.test(line)) ?? "";
    expect(group).toContain("github.event_name");
  });
});
