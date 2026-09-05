/**
 * The cadenza pin, from all four places it is written down.
 *
 * D-0018 rule 3 keeps three *different* facts apart, and this file is where
 * they are required to describe the same tarball:
 *
 *  - `cadenza.pin.json` -- the repository and the full commit sha: what was
 *    meant to be built. Nothing in the tarball can attest to this, because
 *    every build of every cadenza revision is version `0.0.0`.
 *  - `vendor/cadenza.tgz.sha256` -- which bytes rondo carries. Recorded by
 *    `vendor/pin.mjs record` and checked by `node vendor/pin.mjs check`, which
 *    is portable Node rather than `sha256sum` because the matrix includes a
 *    Windows cell.
 *  - `package-lock.json` -- which bytes npm installs, as the sha512 npm
 *    enforces.
 *
 * The three cannot verify each other in the wild: a digest agreeing with a
 * lockfile says nothing about the commit. What this file can do, and does, is
 * fail the moment they stop describing one file -- a tarball replaced without
 * re-recording the digest, a digest re-recorded without a reinstall, a
 * specifier edited by hand. Every one of those is a green install of bytes
 * nobody pinned.
 *
 * It also checks the *sequence* in CI. The digest check must run immediately
 * before each install rather than as a test afterwards: npm's integrity hash is
 * enforced against the cache, so a drifted tarball fails loudly on a cold cache
 * and silently installs the previously pinned bytes on a warm one (cadenza's
 * `docs/artifact-delivery-bridge.md` section 4). The check is the one step that
 * reports it either way.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const read = (...parts: readonly string[]): string => readFileSync(join(ROOT, ...parts), "utf8");

const manifest = JSON.parse(read("cadenza.pin.json")) as {
  readonly repository: string;
  readonly revision: string;
  readonly tarball: string;
  readonly digestFile: string;
  readonly packageName: string;
  readonly packageSpecifier: string;
};

const packageJson = JSON.parse(read("package.json")) as {
  readonly dependencies?: Readonly<Record<string, string>>;
};

const lockfile = JSON.parse(read("package-lock.json")) as {
  readonly packages: Readonly<
    Record<
      string,
      {
        readonly resolved?: string;
        readonly integrity?: string;
        readonly dependencies?: Readonly<Record<string, string>>;
      }
    >
  >;
};

/** The committed artifact, read once. Everything below is a fact about it. */
const tarball = readFileSync(join(ROOT, ...manifest.tarball.split("/")));

const sha256 = createHash("sha256").update(tarball).digest("hex");
const sha512 = `sha512-${createHash("sha512").update(tarball).digest("base64")}`;

describe("the source pin: what was meant to be built", () => {
  test("the repository and a full commit sha, and no version line", () => {
    expect(manifest.repository).toBe("https://github.com/suisya-systems/cadenza.git");
    // Full, for the reason continuo's pin is full: git's abbreviation length
    // depends on the repository and on `core.abbrev`, so a short sha is not an
    // identifier.
    expect(manifest.revision).toMatch(/^[0-9a-f]{40}$/);
    // Deliberately absent, and asserted as absent so that nobody adds one back:
    // cadenza's package contract has no `--version` and every build of every
    // revision is `0.0.0`, so a recorded version line would be a fact rondo
    // invented (D-0018 rule 3).
    expect(Object.keys(manifest)).not.toContain("versionLine");
    expect(Object.keys(manifest)).not.toContain("version");
  });

  test("the manifest names the tarball and the digest file the helper uses", () => {
    expect(manifest.tarball).toBe("vendor/suisya-systems-cadenza-0.0.0.tgz");
    expect(manifest.digestFile).toBe("vendor/cadenza.tgz.sha256");
    expect(existsSync(join(ROOT, ...manifest.tarball.split("/")))).toBe(true);
    // The specifier is the tarball path and not a second, independently
    // editable string: `file:` plus exactly what is committed.
    expect(manifest.packageSpecifier).toBe(`file:${manifest.tarball}`);
    expect(manifest.packageName).toBe("@suisya-systems/cadenza");
  });
});

describe("the dependency: one specifier, and it is the vendored tarball", () => {
  test("cadenza is the first runtime dependency, at the pinned path", () => {
    const dependencies = packageJson.dependencies ?? {};
    // rondo had no `dependencies` block at all until D-0018, which is what
    // D-0001 item 1 recorded and what this entry supersedes. The first key is
    // asserted rather than merely membership: `file:` specifiers are order-
    // insensitive to npm and not to a reader, and this one is the reason the
    // block exists.
    expect(Object.keys(dependencies)[0]).toBe(manifest.packageName);
    expect(dependencies[manifest.packageName]).toBe(manifest.packageSpecifier);
  });

  test("the lockfile resolves that same path, for the root and for the package", () => {
    expect(lockfile.packages[""]?.dependencies?.[manifest.packageName]).toBe(
      manifest.packageSpecifier,
    );
    expect(lockfile.packages[`node_modules/${manifest.packageName}`]?.resolved).toBe(
      manifest.packageSpecifier,
    );
  });
});

describe("the two digests describe the bytes that are committed", () => {
  test("the recorded sha256 is the sha256 of the committed tarball", () => {
    expect(sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(read(...manifest.digestFile.split("/")).trim()).toBe(sha256);
  });

  test("the lockfile's integrity is the sha512 of the same bytes", () => {
    // The fact this pins is the one npm enforces: if these disagree, `npm ci`
    // either fails with EINTEGRITY or installs bytes from a warm cache that are
    // not the ones in the tree. Both are the drift the digest check reports.
    expect(lockfile.packages[`node_modules/${manifest.packageName}`]?.integrity).toBe(sha512);
  });

  test("the helper names the pinned paths and reaches no external command", () => {
    const helper = read("vendor", "pin.mjs");
    expect(helper).toContain(manifest.tarball);
    expect(helper).toContain(manifest.digestFile);
    // Node's own crypto, and no external command: `sha256sum` is GNU
    // coreutils, absent on stock macOS and on Windows, and rondo's matrix has a
    // Windows cell (D-0018 rule 4). Checked as "hashes in process" rather than
    // as "does not mention sha256sum", because the helper's own comment
    // explains why it does not use it -- an absent *string* and an absent
    // *dependency* are different claims, and this is the second one.
    expect(helper).toContain("node:crypto");
    expect(helper).toContain("createHash");
    expect(helper).not.toMatch(/child_process|execSync|execFileSync|spawnSync/);
  });

  test("the helper actually passes on this tree, and actually fails on a drifted one", () => {
    // Reading the helper's source says what it is written to do; only running
    // it says what it does. This matters more here than for ordinary code:
    // `node vendor/pin.mjs check` is the ONLY thing enforcing rule 4 in CI, and
    // a helper that had come to exit 0 unconditionally would satisfy every
    // text assertion above while certifying nothing.
    const run = (cwd: string): { status: number | null; stderr: string } => {
      const result = spawnSync(process.execPath, [join("vendor", "pin.mjs"), "check"], {
        cwd,
        encoding: "utf8",
      });
      return { status: result.status, stderr: result.stderr };
    };

    expect(run(ROOT).status).toBe(0);

    // The same helper, the same tarball, and a digest file that says something
    // else -- which is exactly the drift a warm npm cache would install through
    // in silence. Built in a temporary directory so the committed tree is
    // untouched; the helper's paths are repo-root relative, so the layout it
    // expects is reproduced rather than configured.
    const scratch = mkdtempSync(join(tmpdir(), "rondo-pin-"));
    mkdirSync(join(scratch, "vendor"));
    copyFileSync(join(ROOT, ...manifest.tarball.split("/")), join(scratch, manifest.tarball));
    copyFileSync(join(ROOT, "vendor", "pin.mjs"), join(scratch, "vendor", "pin.mjs"));
    const wrong = "0".repeat(64);
    writeFileSync(join(scratch, manifest.digestFile), `${wrong}\n`);

    const drifted = run(scratch);
    expect(drifted.status).not.toBe(0);
    // Both digests, so the diagnosis is readable where npm's EINTEGRITY is not.
    expect(drifted.stderr).toContain(wrong);
    expect(drifted.stderr).toContain(sha256);

    // And `record` writes the digest `check` then accepts, so the two halves of
    // the helper cannot drift apart either.
    const recorded = spawnSync(process.execPath, [join("vendor", "pin.mjs"), "record"], {
      cwd: scratch,
      encoding: "utf8",
    });
    expect(recorded.status).toBe(0);
    expect(readFileSync(join(scratch, manifest.digestFile), "utf8").trim()).toBe(sha256);
    expect(run(scratch).status).toBe(0);
  });
});

describe("CI checks the digest immediately before every install", () => {
  const workflow = read(".github", "workflows", "ci.yml");
  // Comments are dropped before anything below looks at a line. A YAML comment
  // that quotes either command -- and this workflow's comments quote both, at
  // length -- would otherwise count as the command itself, and a comment
  // mentioning the check would let an unchecked install through.
  const lines = workflow.split("\n").filter((line) => !/^\s*#/.test(line));

  /**
   * `npm ci` for RONDO's own tree, however the flags are spelled.
   *
   * Matched on the command rather than on one exact flag string: an install
   * written `npm ci --no-audit --ignore-scripts` is the same install and must
   * not become invisible to the sequence check by being spelled differently.
   * `--prefix` is what excludes the step that provisions continuo -- that one
   * installs continuo's tree, not rondo's, and no cadenza tarball is involved.
   */
  const isRondoInstall = (line: string): boolean =>
    /(^|\s)npm ci(\s|$)/.test(line) && !line.includes("--prefix");
  /** The portable digest check, as a command rather than as a mention of one. */
  const isPinCheck = (line: string): boolean =>
    /(^|\s)node vendor\/pin\.mjs check(\s|$)/.test(line);

  test("every install of rondo's own tree still carries --ignore-scripts", () => {
    // D-0007, asserted here because the predicate above deliberately stopped
    // requiring the flag in order to see an install spelled any other way.
    expect(
      lines.filter(isRondoInstall).filter((line) => !line.includes("--ignore-scripts")),
    ).toEqual([]);
  });

  test("there are at least three installs, and one check for each", () => {
    // A floor rather than an equality on the count itself: adding a job is
    // expected, and a job that installs without checking is caught by the case
    // below rather than by a count. What the two-sided assertion catches is a
    // spare check with no install, which would make the pairing below read as
    // satisfied when it is not.
    expect(lines.filter(isRondoInstall).length).toBeGreaterThanOrEqual(3);
    expect(lines.filter(isRondoInstall).length).toBe(lines.filter(isPinCheck).length);
  });

  test("no install is reached without a check between it and the previous one", () => {
    const unchecked: number[] = [];
    lines.forEach((line, index) => {
      if (!isRondoInstall(line)) {
        return;
      }
      // Walk back to the nearest line that is either a check or another
      // install. A check means this install is covered; another install means
      // the check for this one is missing, and the line number says which.
      const previous = lines
        .slice(0, index)
        .reverse()
        .find((earlier) => isPinCheck(earlier) || isRondoInstall(earlier));
      if (previous === undefined || !isPinCheck(previous)) {
        unchecked.push(index + 1);
      }
    });
    expect(unchecked).toEqual([]);
  });
});
