/**
 * The shapes the durable store persists.
 *
 * Deliberately tiny and deliberately here rather than in `src/refrain/`: the
 * loop describes what it wants to happen, the store decides what a persisted
 * fact looks like, and the direction of that dependency is what
 * `test/architecture/import-boundaries.test.ts` enforces. Nothing in this file
 * is the schema (Issue #1 puts the schema out of scope); it is the smallest
 * record the skeleton needs in order for the store layer to be a layer rather
 * than an empty directory.
 */

/** How far a single iteration of the loop has got. */
export type IterationStatus = "planned" | "running" | "awaiting_human" | "closed";

/** One iteration of the loop, as the store holds it. */
export interface IterationRecord {
  /** Opaque identity minted by the store, never by the loop. */
  readonly id: string;
  readonly status: IterationStatus;
  /**
   * Milliseconds since the epoch, as the caller observed them.
   *
   * The store does not read the clock: a record whose timestamp came from
   * inside the store is a record whose time cannot be controlled from a test.
   */
  readonly observedAtMs: number;
}
