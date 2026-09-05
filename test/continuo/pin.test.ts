/**
 * The pin, from both ends: the comparison rondo makes at startup, and the
 * agreement between the three places the pinned revision is written down.
 *
 * The manifest (`continuo.pin.json`) is canonical and CI reads it; the literals
 * in `src/continuo/pin.ts` mirror it so that no module under `src/` needs a
 * filesystem capability; the workflow provisions from the manifest. Two of
 * those three could drift silently -- a pin moved in one file and not the other
 * looks exactly like a pin that was moved -- so the drift is a test rather than
 * a habit (D-0017 rule 4).
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import {
  CONTINUO_REPOSITORY,
  CONTINUO_REVISION,
  CONTINUO_VERSION_LINE,
  verifyVersionLine,
} from "../../src/continuo/pin.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const manifest = JSON.parse(readFileSync(join(ROOT, "continuo.pin.json"), "utf8")) as {
  readonly repository: string;
  readonly revision: string;
  readonly versionLine: string;
};

describe("the manifest and the module say the same thing", () => {
  test("the repository, the revision and the version line all agree", () => {
    expect(manifest.repository).toBe(CONTINUO_REPOSITORY);
    expect(manifest.revision).toBe(CONTINUO_REVISION);
    expect(manifest.versionLine).toBe(CONTINUO_VERSION_LINE);
  });

  test("the pinned revision is a full commit, not an abbreviation", () => {
    expect(CONTINUO_REVISION).toMatch(/^[0-9a-f]{40}$/);
  });

  test("the recorded version line is the one that revision would print", () => {
    // A weak-looking assertion that catches the likely mistake: moving the
    // revision and leaving the line, which would make every startup refuse
    // with "the revision matches and the rest of the line does not".
    expect(CONTINUO_VERSION_LINE).toContain(CONTINUO_REVISION);
    expect(verifyVersionLine(CONTINUO_VERSION_LINE)).toEqual({
      kind: "verified",
      revision: CONTINUO_REVISION,
    });
  });

  test("CI provisions from the manifest rather than from a second copy of the sha", () => {
    const workflow = readFileSync(join(ROOT, ".github", "workflows", "ci.yml"), "utf8");
    expect(workflow).toContain("continuo.pin.json");
    // Any full sha written into the workflow would be a second pin. There must
    // be none, or it must be this one -- otherwise CI can build a continuo the
    // suite then refuses, with the diagnosis split across two files.
    for (const sha of workflow.match(/\b[0-9a-f]{40}\b/g) ?? []) {
      expect(sha).toBe(CONTINUO_REVISION);
    }
  });
});

describe("what rondo refuses to drive", () => {
  test("the pinned line verifies, and reports the OBSERVED revision", () => {
    expect(verifyVersionLine(CONTINUO_VERSION_LINE)).toEqual({
      kind: "verified",
      revision: CONTINUO_REVISION,
    });
  });

  test("a trailing newline is trimmed rather than treated as a different line", () => {
    expect(verifyVersionLine(`${CONTINUO_VERSION_LINE}\n`).kind).toBe("verified");
  });

  test("another revision is refused, and the message names both", () => {
    const other = "0123456789abcdef0123456789abcdef01234567";
    const verdict = verifyVersionLine(`@suisya-systems/continuo 0.0.0 (rev ${other})`);
    expect(verdict).toEqual({
      kind: "refused",
      reason: expect.stringContaining(other),
    });
    expect(verdict.kind === "refused" && verdict.reason).toContain(CONTINUO_REVISION);
  });

  test("'unknown' is refused, and the message says how to make it impossible", () => {
    const verdict = verifyVersionLine("@suisya-systems/continuo 0.0.0 (rev unknown)");
    expect(verdict).toEqual({
      kind: "refused",
      reason: expect.stringContaining("CONTINUO_REQUIRE_REVISION=1"),
    });
  });

  test("a '-dirty' build is refused even when the sha is the pinned one", () => {
    const verdict = verifyVersionLine(
      `@suisya-systems/continuo 0.0.0 (rev ${CONTINUO_REVISION}-dirty)`,
    );
    expect(verdict).toEqual({
      kind: "refused",
      reason: expect.stringContaining("modified"),
    });
  });

  test("a line that is not the shape --version promises is refused", () => {
    expect(verifyVersionLine("continuo v0.0.0").kind).toBe("refused");
    expect(verifyVersionLine("").kind).toBe("refused");
  });

  test("a revision outside continuo's own alphabet is refused before anything else", () => {
    // Not 40 hex, not 'unknown': whatever printed this is not answering the
    // question `--version` answers.
    expect(verifyVersionLine("@suisya-systems/continuo 0.0.0 (rev HEAD)").kind).toBe("refused");
  });

  test("the right revision under a different package is refused", () => {
    const verdict = verifyVersionLine(`@someone-else/continuo 9.9.9 (rev ${CONTINUO_REVISION})`);
    expect(verdict.kind).toBe("refused");
  });
});
