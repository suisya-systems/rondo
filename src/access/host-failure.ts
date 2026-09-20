/**
 * One reading of a caught `unknown`, for every place that used to flatten it
 * (rondo#349).
 *
 * Twenty-eight sites under `src/access/` spelled the same conditional -- an
 * `instanceof Error` test picking `message` over `String(...)` -- and handed
 * the page one string for twenty-eight different causes: a missing directory, a
 * read-only path, a locked database and a genuine `TypeError` all arrived
 * indistinguishable. `D-0076` rule 4.3 does not ask for the cause -- it asks
 * rondo to be able to say *"setup on this machine has not finished, or has
 * stopped working"*, and **that** is what a flattened string cannot say.
 *
 * So this reads Node's `errno` where there is one, and `node:sqlite`'s own
 * result code where the store is what failed -- and nothing else:
 *
 * - **`text` is on both arms and is the old expression, byte for byte.** A site
 *   that only wants the string it always had writes `hostFailure(error).text`
 *   and is unchanged; that is what makes the replacement of all twenty-eight
 *   mechanical and regression-free. `kind` is a second thing a caller *may*
 *   read, not a new shape every caller has to handle.
 * - **No Error subclass and no hierarchy** (the issue's own boundary). rondo
 *   does not throw across layer boundaries: its nine `Error` subclasses are
 *   each caught inside the module that throws them, and that design is
 *   untouched here. This is a reader of errors, not a new one to throw.
 * - **`src/continuo/invoker.ts` has the twenty-ninth spelling and keeps it.**
 *   The boundary table lets `src/continuo` import only itself (D-0017), and a
 *   shared helper is not worth widening that arrow for one site whose sentence
 *   already says it is rondo's own defect.
 */

/**
 * The errno values that mean *this machine*, and not the person's world.
 *
 * Four and not every errno Node can raise: these are the ones a break in
 * installation actually produces -- a path that is not there, one this process
 * may not read, one it may not write, and a file something else holds. An
 * errno outside this set is left to `unknown`, where it reads exactly as it
 * did before, because a code this list cannot vouch for would make
 * `hostSetup` a guess and `D-0076` rule 4.3's sentence a claim rondo cannot
 * support.
 */
const HOST_SETUP_CODES = ["ENOENT", "EACCES", "EROFS", "EBUSY"] as const;

/** One of {@link HOST_SETUP_CODES}, as a type. */
export type HostSetupCode = (typeof HOST_SETUP_CODES)[number];

/**
 * The same four facts as `node:sqlite` states them, by SQLite result code.
 *
 * **rondo's store is the failure that reaches a person most often, and it
 * carries no errno at all.** `node:sqlite` raises `code: "ERR_SQLITE_ERROR"`
 * with the driver's own `errcode`: a store this process may not write is
 * `SQLITE_READONLY` and `"attempt to write a readonly database"`, never
 * `EROFS`. Reading only `error.code` would have left the one branch below a
 * dead one, which is what a real read-only database showed.
 *
 * Three and not five. `SQLITE_BUSY` and `SQLITE_LOCKED` are deliberately
 * absent: a press that lands while rondo's own writer holds the file is
 * contention and not a break, and "go back and try again" is the right thing
 * to tell that person -- which is exactly what the arm these codes divert from
 * already says.
 */
const SQLITE_HOST_SETUP: Readonly<Record<number, HostSetupCode>> = {
  3: "EACCES", // SQLITE_PERM
  8: "EROFS", // SQLITE_READONLY
  14: "ENOENT", // SQLITE_CANTOPEN
};

/**
 * A caught failure, read once.
 *
 * `hostSetup` is a break only installation repairs (`D-0076` rule 4.3);
 * `unknown` is everything else, and carries the same text it always did.
 */
export type HostFailure =
  | { readonly kind: "hostSetup"; readonly code: HostSetupCode; readonly text: string }
  | { readonly kind: "unknown"; readonly text: string };

/** The code this error carries and this module vouches for, or null. */
function hostSetupCode(error: unknown): HostSetupCode | null {
  // Read off the value rather than off `instanceof Error`: a rejected promise
  // crossing a worker or a driver's fault can arrive as a plain object with a
  // `code`, and refusing those would put a real ENOENT in `unknown`.
  const carried = error as { readonly code?: unknown; readonly errcode?: unknown } | null;
  if (carried?.code === "ERR_SQLITE_ERROR") {
    return typeof carried.errcode === "number"
      ? (SQLITE_HOST_SETUP[carried.errcode] ?? null)
      : null;
  }
  return HOST_SETUP_CODES.find((known) => known === carried?.code) ?? null;
}

/**
 * Read a caught `unknown`.
 *
 * `text` is what the twenty-eight sites composed before this function existed,
 * so every caller that reads only `text` says today exactly what it said
 * yesterday.
 */
export function hostFailure(error: unknown): HostFailure {
  const text = error instanceof Error ? error.message : String(error);
  const code = hostSetupCode(error);
  return code === null ? { kind: "unknown", text } : { kind: "hostSetup", code, text };
}
