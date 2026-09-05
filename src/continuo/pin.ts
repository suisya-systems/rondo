/**
 * Which continuo rondo drives, and how rondo checks that it got it.
 *
 * D-0001 item 2 and D-0015 rule 1 fix the seam as a checkout pinned by commit
 * sha; D-0015 rule 6 makes the revision something rondo *verifies* rather than
 * assumes, because `--version` now reports the build's own git revision and an
 * identity the seam reports is a claim to be checked. D-0017 turns both into
 * this module: three committed literals and one pure comparison.
 *
 * **The pin is committed, and an environment variable can never stand in for
 * it.** `continuo.pin.json` at the repository root is the canonical manifest --
 * CI reads it to know what to clone and build -- and the literals below mirror
 * it so that nothing under `src/` needs a filesystem capability to know the
 * pin. `test/continuo/pin.test.ts` fails if the two drift, and the CI workflow
 * derives the sha from the manifest rather than repeating it. What
 * `RONDO_CONTINUO_CLI` does is *locate* an already-built `dist/cli.js`; what it
 * cannot do is change which revision that build has to be, because the answer
 * to that question is here and the check below runs either way.
 *
 * **Pure on purpose.** Nothing here spawns, reads a file or touches the
 * network: the module is a value and a comparison, so every refusal path is a
 * fast unit case rather than something only a built continuo can exercise.
 * `src/continuo/invoker.ts` is the one module in this layer that owns a
 * process.
 *
 * **ASCII only** (D-0004): every string here can reach a cp932 console.
 */

/** Where the pinned build comes from. CI clones this and nothing else. */
export const CONTINUO_REPOSITORY = "https://github.com/suisya-systems/continuo.git";

/**
 * The pinned commit, in full.
 *
 * Forty hex digits rather than an abbreviation, matching what continuo's own
 * `--version` reports: git's abbreviation length is a function of repository
 * size and of `core.abbrev`, so a short sha differs between two clones of the
 * same commit, and an identifier that depends on where it was resolved is not
 * an identifier.
 *
 * D-0017 chose `44f62336108b86cab5da791111ffa0e5b73cd01a`, the first continuo
 * that answers `gate close --json` in the shared envelope (`continuo D-0092`).
 * **D-0021 moves the pin here**, to the first continuo that answers the two
 * things the lap-1 dogfood stopped on: the post-spawn identity read-back is a
 * caller-supplied budget rather than 50 attempts at 50 ms (`continuo D-0098`,
 * the dogfood's F-1), and `lap perform` takes `--model` and reports which model
 * the lap ran on (`continuo D-0099`, F-2). The envelope property D-0017 pinned
 * for is unchanged and still holds.
 */
export const CONTINUO_REVISION = "603843b7c0e91136bc7f7e5c9f91640f7bb970c9";

/**
 * The exact line the pinned build's `--version` prints.
 *
 * Recorded whole rather than assembled from parts, because it is a
 * *measurement* of the pinned build and not a format rondo gets to define. If
 * continuo ever changes the line's shape, rondo's verification fails loudly at
 * startup against a value that says what was actually observed -- on 2026-09-05
 * for the revision D-0017 pinned, and on 2026-09-06 for this one, by building
 * the pinned checkout with `CONTINUO_REQUIRE_REVISION=1` and running
 * `node dist/cli.js --version` -- instead of quietly agreeing with a template
 * rondo wrote for itself.
 */
export const CONTINUO_VERSION_LINE =
  "@suisya-systems/continuo 0.0.0 (rev 603843b7c0e91136bc7f7e5c9f91640f7bb970c9)";

/** What a build reports when it has no git information (`continuo`'s literal). */
const REVISION_UNKNOWN = "unknown";

/** The alphabet a reported revision may use, per continuo's own pattern. */
const REVISION_PATTERN = /^(?:[0-9a-f]{40}(?:-dirty)?|unknown)$/;

/** `--version`'s one line: a name, a version, and `(rev <revision>)`. */
const VERSION_LINE_PATTERN = /^(\S+) (\S+) \(rev (\S+)\)$/;

/**
 * The answer to "may rondo drive this build?".
 *
 * `verified` carries the revision rondo *observed*, never the one it expected
 * (D-0015 rule 6): recording the pin as if it were a measurement is the weaker
 * practice the rule exists to forbid. `refused` carries a sentence for an
 * operator; the caller is what turns it into a startup refusal.
 */
export type PinVerdict =
  | { readonly kind: "verified"; readonly revision: string }
  | { readonly kind: "refused"; readonly reason: string };

/**
 * Check an observed `--version` line against the pin.
 *
 * Four ways this says no, and they are deliberately separate sentences rather
 * than one "unexpected version": each names a different thing to go and do.
 *
 *  - the line does not have the shape `--version` promises, so what rondo is
 *    driving may not be continuo at all;
 *  - the revision is the literal `unknown`, so the build cannot say what it is
 *    -- which means it was not built with `CONTINUO_REQUIRE_REVISION=1` on a
 *    real checkout, and the provisioning step is what to fix;
 *  - the revision carries `-dirty`, so the build was made from a modified tree
 *    and names a commit it is not;
 *  - the revision is a well-formed sha that is not the pinned one, so this is
 *    some other continuo and either the pin or the provisioning is stale.
 *
 * The whole line is compared as well as the revision, so a build that somehow
 * reported the right revision under a different package or version is refused
 * too -- the pin is the line, and the revision is what rondo then records.
 */
export function verifyVersionLine(observed: string): PinVerdict {
  const line = observed.trim();
  const match = VERSION_LINE_PATTERN.exec(line);
  if (match === null) {
    return {
      kind: "refused",
      reason:
        `continuo --version printed ${quoted(line)}, which is not the shape ` +
        `'<name> <version> (rev <revision>)'. rondo cannot identify this build.`,
    };
  }
  const revision = match[3] ?? "";
  if (!REVISION_PATTERN.test(revision)) {
    return {
      kind: "refused",
      reason:
        `continuo --version reported the revision ${quoted(revision)}, which is neither ` +
        "a full 40-hex commit, that commit with a '-dirty' suffix, nor 'unknown'.",
    };
  }
  if (revision === REVISION_UNKNOWN) {
    return {
      kind: "refused",
      reason:
        "continuo --version reported 'unknown': this build does not know which commit it " +
        "came from. Build the pinned checkout with CONTINUO_REQUIRE_REVISION=1, which makes " +
        "an unidentifiable build fail at build time rather than here.",
    };
  }
  if (revision.endsWith("-dirty")) {
    return {
      kind: "refused",
      reason:
        `continuo --version reported ${quoted(revision)}: the build was made from a modified ` +
        "tree, so it names a commit it is not. Build a clean checkout at " +
        `${CONTINUO_REVISION}.`,
    };
  }
  if (revision !== CONTINUO_REVISION) {
    return {
      kind: "refused",
      reason:
        `continuo --version reported revision ${quoted(revision)}, and rondo is pinned to ` +
        `${CONTINUO_REVISION}. Either the provisioned checkout or the pin in ` +
        "continuo.pin.json is stale; rondo never drives a build it did not pin.",
    };
  }
  if (line !== CONTINUO_VERSION_LINE) {
    return {
      kind: "refused",
      reason:
        `continuo --version printed ${quoted(line)}, and the pin records ` +
        `${quoted(CONTINUO_VERSION_LINE)}. The revision matches and the rest of the line does ` +
        "not, so this is not the build the pin was measured against.",
    };
  }
  return { kind: "verified", revision };
}

/**
 * A value quoted for a message an operator reads.
 *
 * Quoting only, never escaping: the escaping happens once, at the terminal
 * boundary (`src/access/console.ts`), so that a message rondo holds is still
 * the message continuo sent. Every literal in this module is ASCII already;
 * what passes through here is an *observed* line, which is exactly the value
 * that might not be.
 */
function quoted(value: string): string {
  return `'${value}'`;
}
