// vendor/pin.mjs -- record or check the pinned vendored artifacts.
// `node vendor/pin.mjs record|check`, run from the repository root.
//
// Started as a copy of cadenza's `docs/artifact-delivery-bridge.md` (cadenza
// D-0035), which prescribes it verbatim for one tarball; it is a list rather
// than a single artifact since D-0054, which vendors idiomorph's minified file
// beside the cadenza tarball on the same terms. Only the comments, the line
// wrapping and the loop are rondo's. It is a Node script rather than
// `sha256sum` because `sha256sum` is GNU coreutils -- absent on stock macOS and
// on Windows, and rondo's CI matrix includes a Windows cell (DECISIONS.md
// D-0018 rule 4).
//
// **The two artifacts are pinned for different consumers and checked by one
// command.** The cadenza tarball is what npm installs, so the check exists to
// run immediately before every install (cadenza's bridge, section 4). The
// idiomorph file is not installed at all -- it is a static asset this process
// serves to a browser (D-0054 rule 5), so `--ignore-scripts` is not weakened
// and there is nothing npm would verify. What both share is the one property
// worth a command: the bytes in the tree are the bytes somebody pinned.
//
// The paths are repo-root relative, as the bridge writes them, so this script
// is run from the repository root and nowhere else. Run from anywhere else it
// fails with ENOENT, which is the right direction to fail in: a check that
// cannot find an artifact must not report that the artifact is fine.
//
// ASCII only (D-0004): every line below is printed on the Windows cell, where
// the console may be cp932 and a character it cannot encode crashes the writer
// rather than printing badly.
//
// A passing check says which digests it verified, on stdout. The exit code is
// what CI reads and it is unchanged; the lines are for a person running the
// script by hand, to whom a silent exit 0 was indistinguishable from a no-op
// (docs/operations/lap-1-dogfood.md, F-10). The one fact worth printing is the
// digest that was checked, because it is the one fact the check established.
//
// **Nothing is printed to stdout unless every artifact passed.** A list makes
// partial success possible, and a run that printed "is the pinned artifact"
// for one file while refusing another would put the sentence a pass prints on
// the screen of a failure.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const ARTIFACTS = [
  {
    artifact: "vendor/suisya-systems-cadenza-0.0.0.tgz",
    digest: "vendor/cadenza.tgz.sha256",
  },
  {
    artifact: "vendor/idiomorph-0.8.0.min.js",
    digest: "vendor/idiomorph-0.8.0.min.js.sha256",
  },
];

const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

if (process.argv[2] === "record") {
  for (const { artifact, digest } of ARTIFACTS) {
    writeFileSync(digest, `${sha256(artifact)}\n`);
  }
} else {
  const lines = [];
  const drifted = [];
  for (const { artifact, digest } of ARTIFACTS) {
    const actual = sha256(artifact);
    const expected = readFileSync(digest, "utf8").trim();
    if (actual === expected) {
      lines.push(`${artifact} is the pinned artifact: sha256 ${actual}`);
    } else {
      drifted.push(
        `${artifact} is not the pinned artifact.\n  expected ${expected}\n  actual   ${actual}`,
      );
    }
  }
  if (drifted.length > 0) {
    console.error(drifted.join("\n"));
    process.exit(1);
  }
  console.log(lines.join("\n"));
}
