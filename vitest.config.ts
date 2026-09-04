import { defineConfig } from "vitest/config";

/**
 * Test runner configuration.
 *
 * Two properties here are load-bearing for CI and are deliberately NOT
 * expressible as CLI flags (DECISIONS.md D-0003):
 *
 *  1. Random ordering is enabled *in this file*, so it cannot be silently
 *     dropped by an edit to a CI script or a local `vitest run` invocation.
 *     CI injects only the seed.
 *  2. The seed is required in CI. A run with an unrecorded seed is a run that
 *     cannot be replayed, which makes an order-dependent failure unactionable,
 *     so an unset seed under CI is a hard error rather than a silent default.
 */

/** Environment variable carrying the explicit RNG seed. */
const SEED_ENV = "RONDO_TEST_SEED";

/** Largest seed accepted. Keeps the value printable and shell-safe. */
const SEED_MAX = 2_147_483_647;

/**
 * Whether this is a CI run.
 *
 * `CI` unset, empty, `"false"` or `"0"` all mean "not CI". Testing only for
 * presence is the obvious spelling and the wrong one: `CI=false` is an
 * established way of saying "do not behave as CI" -- several hosts and editor
 * integrations export it -- and under a presence test that value would turn the
 * seed from optional into mandatory and refuse to run the suite at all.
 */
function inContinuousIntegration(): boolean {
  const raw = process.env.CI;
  return raw !== undefined && raw !== "" && raw !== "false" && raw !== "0";
}

function resolveSeed(): number {
  const raw = process.env[SEED_ENV];
  const inCI = inContinuousIntegration();

  if (raw === undefined || raw === "") {
    if (inCI) {
      throw new Error(
        `${SEED_ENV} is not set. Rondo's CI runs the suite twice per matrix ` +
          `cell with two distinct explicit seeds (the double-green rule, ` +
          `DECISIONS.md D-0003); an implicit seed cannot be replayed. Set ` +
          `${SEED_ENV} to a non-negative integer.`,
      );
    }
    // Local default. Vitest's own default seed is also time-derived; the point
    // of computing it here is that the value is printed below, so a local
    // ordering failure is replayable from the terminal scrollback.
    return Date.now() % SEED_MAX;
  }

  if (!/^\d+$/.test(raw)) {
    throw new Error(`${SEED_ENV} must be a non-negative integer, got ${JSON.stringify(raw)}.`);
  }
  const seed = Number(raw);
  if (!Number.isSafeInteger(seed) || seed > SEED_MAX) {
    throw new Error(`${SEED_ENV} must be a non-negative integer <= ${SEED_MAX}, got ${raw}.`);
  }
  return seed;
}

const seed = resolveSeed();

// Printed on success as well as failure: the seed of a *green* run is what a
// later bisect needs in order to reproduce the order that was green.
// ASCII-only -- this line is emitted on the Windows cell too, where the console
// is cp932 and a non-encodable character would crash the writer rather than
// print badly (D-0004).
process.stderr.write(`rondo: test order seed = ${seed} (${SEED_ENV})\n`);

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",

    // Fail closed on an empty selection: a glob that stops matching must not
    // read as "everything passed". This matters more here than in a mature
    // repository -- rondo's suite is currently one file, and "the suite found
    // no tests" and "the suite passed" would otherwise be the same exit code.
    passWithNoTests: false,

    // No retries, ever. A test that passes on the second attempt under a
    // shuffled order is exactly the signal the double-green rule exists to
    // catch; retrying would erase it.
    retry: 0,

    // Explicit imports from "vitest" rather than injected globals.
    globals: false,

    // The boundary sweep parses every module under `src/` through a compiler
    // child process, which is the slowest thing in this suite by two orders of
    // magnitude and still far below this cap. The number is a floor under
    // runner variance, not a budget to grow into.
    testTimeout: 10_000,
    hookTimeout: 10_000,

    sequence: {
      // Both axes: file order and, within a file, test order.
      shuffle: { files: true, tests: true },
      // Order is shuffled, but tests do not run concurrently *within* a file.
      // The boundary sweep holds one compiler session; running its cases
      // concurrently would have them contend over a single mounted file.
      concurrent: false,
      seed,
    },

    // Each test file gets its own worker and therefore its own module registry.
    isolate: true,
  },
});
