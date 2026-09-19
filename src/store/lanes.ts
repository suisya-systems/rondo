/**
 * The lane ledger's arithmetic (D-0073 rules 2.2, 3.3 and 6): what a claimed
 * path covers, which claims share a path, and which laps of a lineage tree are
 * the tips its landing is owed by.
 *
 * **Pure, and in the store layer**, because two places ask the same questions
 * and must get one answer: `reserve()`'s `BEGIN IMMEDIATE`, which refuses an
 * overlap, and the landing reading in `src/access`, which decides what must be
 * on the default branch before a claim is released. Neither may carry a second
 * spelling of "overlap" or "closed tip".
 */

import { TERMINAL_STATUSES } from "./records.js";

/** The claim on the whole repository (D-0073 rule 2.2), and rule 2.5's default. */
export const WHOLE_REPOSITORY = "/";

/**
 * Why `path` is not a claimable path, or null when it is (D-0073 rule 2.2).
 *
 * Repository-relative and spelled with `/`; a trailing `/` makes it a
 * directory; `/` alone is the whole repository. **No patterns**: `*`, `?` and
 * `[` are ordinary bytes in a git path, and a claim is compared by equality and
 * prefix only, so they are refused rather than read as either.
 */
export function claimPathRefusal(path: string): string | null {
  if (path === WHOLE_REPOSITORY) {
    return null;
  }
  if (path === "") {
    return "a claimed path is not empty";
  }
  // biome-ignore lint/suspicious/noControlCharactersInRegex: the control range is the point
  if (/[\u0000-\u001f\u007f]/.test(path)) {
    return `'${path}' carries a control character, and a claimed path does not`;
  }
  if (path.includes("\\") || path.startsWith("/")) {
    return (
      `'${path}' is not a repository-relative path spelled with '/' ('src/store/' or ` +
      "'README.md'), and '/' alone is the whole repository"
    );
  }
  if (/[*?[]/.test(path)) {
    return `'${path}' is a pattern, and a claim names paths and directories only (D-0073 rule 2.2)`;
  }
  const body = path.endsWith("/") ? path.slice(0, -1) : path;
  if (body.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    return `'${path}' has an empty, '.' or '..' segment, and a claimed path names one place`;
  }
  return null;
}

/**
 * The claim `paths` asks for, deduplicated and sorted, or why it cannot be one.
 *
 * Sorted so that two writes of one claim are one set of bytes. **An empty list
 * is refused**: a claim with no paths is a release (D-0073 rule 4.3), and a
 * line is admitted holding something.
 */
export function normalizeClaim(
  paths: readonly string[],
):
  | { readonly kind: "claim"; readonly paths: readonly string[] }
  | { readonly kind: "refused"; readonly reason: string } {
  if (paths.length === 0) {
    return {
      kind: "refused",
      reason: "a claim names at least one path; a claim with none is a release",
    };
  }
  for (const path of paths) {
    const refusal = claimPathRefusal(path);
    if (refusal !== null) {
      return { kind: "refused", reason: refusal };
    }
  }
  return { kind: "claim", paths: [...new Set(paths)].sort() };
}

/** Whether claimed path `a` covers `b`: equal, or `a` a directory above it. */
function covers(a: string, b: string): boolean {
  return a === b || a === WHOLE_REPOSITORY || (a.endsWith("/") && b.startsWith(a));
}

/**
 * Whether two claimed paths overlap (D-0073 rule 2.2): equal, or one a
 * directory covering the other.
 */
export function pathsOverlap(a: string, b: string): boolean {
  return covers(a, b) || covers(b, a);
}

/** The paths of `asked` that overlap some path of `held`, in `asked`'s order. */
export function sharedPaths(asked: readonly string[], held: readonly string[]): readonly string[] {
  return asked.filter((path) => held.some((other) => pathsOverlap(path, other)));
}

/** One lap of a lineage tree, as the ledger reads it. */
export interface LaneLap {
  readonly id: string;
  readonly status: string;
  readonly supersedesIterationId: string | null;
}

/** Where a lineage tree stands, before anything is read off the default branch. */
export interface LineShape {
  /** Some lap is not terminal: the line is open whatever its diff says. */
  readonly inFlight: boolean;
  /**
   * The `closed` laps no other lap of the tree continues (D-0073 rule 6), in
   * id order. A lap a redo continues is superseded by it, whatever the redo's
   * end, so its work is never owed to the default branch in revised-away form.
   */
  readonly closedTips: readonly string[];
}

const TERMINAL: ReadonlySet<string> = new Set(TERMINAL_STATUSES);

/**
 * The shape of one lineage tree (D-0073 rules 3.3 and 6).
 *
 * The line is **open** while `inFlight` or while any closed tip has not landed;
 * with neither, it has nothing to land and its claim is released (rule 4.3).
 */
export function lineShape(laps: readonly LaneLap[]): LineShape {
  const continued = new Set(
    laps.flatMap((lap) => (lap.supersedesIterationId === null ? [] : [lap.supersedesIterationId])),
  );
  return {
    inFlight: laps.some((lap) => !TERMINAL.has(lap.status)),
    closedTips: laps
      .filter((lap) => lap.status === "closed" && !continued.has(lap.id))
      .map((lap) => lap.id)
      .sort(),
  };
}

/** Whether a line of this shape is open before its landing is read. */
export function mayBeOpen(shape: LineShape): boolean {
  return shape.inFlight || shape.closedTips.length > 0;
}

/**
 * The claimable path covering a path a lap changed (D-0073 rule 5): the path
 * itself, or, when a segment of it is one a claim cannot spell (a `*`, a `\\`,
 * a control character), the directory above that segment, down to `/`. A
 * wider claim costs parallelism and never a collision, so a path is never
 * dropped for being unspellable.
 */
export function claimCover(path: string): string {
  const segments = path.split("/");
  const bad = segments.findIndex((segment) => claimPathRefusal(segment) !== null);
  return bad === -1 ? path : bad === 0 ? WHOLE_REPOSITORY : `${segments.slice(0, bad).join("/")}/`;
}
