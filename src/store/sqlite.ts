/**
 * The one module that owns SQLite.
 *
 * Every other module under `src/` reaches durable state through the functions
 * exported here; none of them may name a SQLite driver, and
 * `test/architecture/import-boundaries.test.ts` fails if one does. That test
 * also asserts that exactly one module in the tree imports a driver, so this
 * file cannot quietly acquire a sibling.
 *
 * `node:sqlite` rather than a native package: it is in the standard library of
 * both Node versions rondo supports, so the boundary this file defends costs no
 * dependency, no lockfile entry and no prebuilt binary on the Windows CI cell.
 * It is still marked experimental by Node, which is a real cost and is recorded
 * as such in DECISIONS.md D-0005 -- the entry names the driver swap as the
 * thing that would falsify it, and this module is the whole of what such a swap
 * would touch. That is the point of the boundary.
 *
 * The import is type-position only today. rondo opens no database yet (Issue #1
 * puts the schema out of scope), and a module that imported the driver for
 * effect would load it on every `import` of the barrel, on a runtime that warns
 * about experimental modules.
 */
import type { DatabaseSync } from "node:sqlite";

import type { IterationRecord } from "./records.js";

/**
 * The durable surface, named before it is implemented.
 *
 * Stated as a type rather than a class so the boundary test has something to
 * guard from the first commit: the interface is what the loop is allowed to
 * see, and the driver behind it is what only this module is allowed to name.
 */
export interface IterationStore {
  read(id: string): IterationRecord | undefined;
  write(record: IterationRecord): void;
}

/**
 * A store backed by an open `node:sqlite` connection.
 *
 * Unimplemented on purpose: the schema is a separate decision, and a skeleton
 * that guessed at one would be a schema nobody decided. What this signature
 * fixes is the direction -- the connection is handed in, so opening it, and
 * therefore knowing where the file lives, belongs to whoever composes the
 * application rather than to the loop.
 */
export function iterationStore(_connection: DatabaseSync): IterationStore {
  throw new Error("rondo: the durable store is not implemented yet (Issue #1 is the skeleton)");
}
