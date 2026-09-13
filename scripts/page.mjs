/**
 * The page's browser files: build them, and record or check their digests (DECISIONS.md D-0059
 * rule 9, R1).
 *
 *   node scripts/page.mjs build [dir]    compile page/app.css, copy htmx, keys.js and the faces
 *   node scripts/page.mjs record [dir]   write page.manifest.json from a built directory
 *   node scripts/page.mjs check [dir]    fail unless the built directory is the manifest, exactly
 *
 * `dir` defaults to `dist/page`, the directory the server serves; another directory is for
 * measuring reproducibility (two clean builds, two paths, identical bytes).
 *
 * **Why a manifest.** Under R1 the browser no longer receives vendored files beside a `.sha256`
 * (`vendor/pin.mjs`): it receives Tailwind's output and copies out of `node_modules`. `npm ci`'s
 * sha512 integrity covers what was installed and nothing covers what the build emitted, which is
 * the gap D-0057 measured ("a build leaves a digest pin nothing to check"). The manifest is that
 * check: every served byte is named by digest in a checked-in file, so a changed class string, a
 * bumped htmx or a drifted Tailwind binary is a diff a reviewer approves, and a one-byte tamper of
 * any served file, or a file added or removed, fails `check`.
 *
 * **What it does not claim.** Tailwind's `oxide` and `lightningcss` are native per-platform
 * binaries, and reproducibility was measured on one machine (D-0059 residuals); the CI step that
 * runs `check` is where another platform's bytes are observed, and its comment says which cells.
 *
 * Tools are resolved through `createRequire` rather than by `node_modules/.bin` paths: `.bin` holds
 * `.cmd` shims on Windows that `execFileSync` cannot start, and a resolved path fails with the
 * package's name when a dependency is missing rather than with ENOENT on a guessed path.
 *
 * ASCII only (D-0004): everything printed here is printed on the Windows cell too.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const require = createRequire(join(root, "package.json"));
const manifestPath = join(root, "page.manifest.json");

/**
 * Files copied verbatim, by served name. The faces are the Latin variable-weight subsets; `keys.js`
 * is rondo's own key script (D-0059 rule 5), copied so that every file the browser receives is in
 * one directory under one manifest.
 */
const COPIES = {
  "htmx.min.js": require.resolve("htmx.org/dist/htmx.min.js"),
  "keys.js": join(root, "page/keys.js"),
  "inter-latin-wght-normal.woff2": require.resolve(
    "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  ),
  "jetbrains-mono-latin-wght-normal.woff2": require.resolve(
    "@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2",
  ),
};

const [command, dirArgument] = process.argv.slice(2);
const dir = resolve(root, dirArgument ?? "dist/page");

/** Every file in the built directory, by name, to its sha256. Sorted, so the manifest diffs cleanly. */
const digests = () =>
  Object.fromEntries(
    readdirSync(dir)
      .sort()
      .map((name) => [
        name,
        createHash("sha256")
          .update(readFileSync(join(dir, name)))
          .digest("hex"),
      ]),
  );

if (command === "build") {
  mkdirSync(dir, { recursive: true });
  const cliPackage = require.resolve("@tailwindcss/cli/package.json");
  const cli = join(
    dirname(cliPackage),
    JSON.parse(readFileSync(cliPackage, "utf8")).bin.tailwindcss,
  );
  execFileSync(
    process.execPath,
    [cli, "-i", join(root, "page/app.css"), "-o", join(dir, "app.css"), "--minify"],
    // Tailwind prints a banner and timing to stderr on success; shown only when it fails.
    { stdio: ["ignore", "inherit", "pipe"] },
  );
  for (const [name, from] of Object.entries(COPIES)) copyFileSync(from, join(dir, name));
} else if (command === "record") {
  writeFileSync(manifestPath, `${JSON.stringify(digests(), null, 2)}\n`);
} else if (command === "check") {
  const expected = JSON.parse(readFileSync(manifestPath, "utf8"));
  const actual = digests();
  const problems = [];
  for (const name of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
    if (!(name in actual)) problems.push(`${name} is in page.manifest.json but was not built.`);
    else if (!(name in expected))
      problems.push(`${name} was built but is not in page.manifest.json.`);
    else if (expected[name] !== actual[name]) {
      problems.push(
        `${name} is not the recorded file.\n  expected ${expected[name]}\n  actual   ${actual[name]}`,
      );
    }
  }
  if (problems.length > 0) {
    console.error(problems.join("\n"));
    console.error(
      "If the change is intended, run `npm run page:record` and commit page.manifest.json.",
    );
    process.exit(1);
  }
  console.log(
    Object.entries(actual)
      .map(([name, digest]) => `${name} is the recorded file: sha256 ${digest}`)
      .join("\n"),
  );
} else {
  console.error("usage: node scripts/page.mjs build|record|check [dir]");
  process.exit(2);
}
