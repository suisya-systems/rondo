// vendor/pin.mjs -- record or check the pinned cadenza tarball.
// `node vendor/pin.mjs record|check`, run from the repository root.
//
// Copied from cadenza's `docs/artifact-delivery-bridge.md` (cadenza D-0035),
// which prescribes it verbatim; only the comments and the line wrapping are
// rondo's. It is a Node script rather than `sha256sum` because `sha256sum` is
// GNU coreutils -- absent on stock macOS and on Windows, and rondo's CI matrix
// includes a Windows cell (DECISIONS.md D-0018 rule 4).
//
// The two paths are repo-root relative, as the bridge writes them, so this
// script is run from the repository root and nowhere else. Run from anywhere
// else it fails with ENOENT, which is the right direction to fail in: a check
// that cannot find the tarball must not report that the tarball is fine.
//
// ASCII only (D-0004): both lines below are printed on the Windows cell,
// where the console may be cp932 and a character it cannot encode crashes the
// writer rather than printing badly.
//
// A passing check says which digest it verified, on stdout. The exit code is
// what CI reads and it is unchanged; the line is for a person running the
// script by hand, to whom a silent exit 0 was indistinguishable from a no-op
// (docs/operations/lap-1-dogfood.md, F-10). The one fact worth printing is the
// digest that was checked, because it is the one fact the check established.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const TARBALL = "vendor/suisya-systems-cadenza-0.0.0.tgz";
const DIGEST = "vendor/cadenza.tgz.sha256";
const actual = createHash("sha256").update(readFileSync(TARBALL)).digest("hex");

if (process.argv[2] === "record") {
  writeFileSync(DIGEST, `${actual}\n`);
} else {
  const expected = readFileSync(DIGEST, "utf8").trim();
  if (actual !== expected) {
    console.error(
      `${TARBALL} is not the pinned artifact.\n  expected ${expected}\n  actual   ${actual}`,
    );
    process.exit(1);
  }
  console.log(`${TARBALL} is the pinned artifact: sha256 ${actual}`);
}
