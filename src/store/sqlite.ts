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
 * **The owner is of the driver, not of every query (D-0171, which amends
 * D-0005).** The schema and the queries live in per-concern modules
 * beside this one -- `schema.ts`, `iteration.ts`, `advisory.ts`, `thread.ts`,
 * `scope.ts`, `claims.ts`, with `contract.ts` for the ports and `rows.ts` for
 * what they share -- and each is handed a `StoreConnection`, a structural
 * `exec`/`prepare` handle, instead of naming a driver. None of them can open a
 * connection, because opening one needs the driver and only this module may
 * import it; a swap still touches this file and the handle's shape in
 * `rows.ts`, which the compiler checks a `DatabaseSync` against. Callers keep
 * importing from here: this module re-exports the ports.
 *
 * **The import is a value import, and that reversed a property this paragraph
 * used to state.** It was type-position only, so that an `import` of the barrel
 * never loaded the experimental module; the connection was handed in, and
 * knowing where the database file lives belonged to the composition root
 * (D-0019 rule 2). {@link openIterationStore} is what changed it, because the
 * operator's command line has to open a database by path and
 * `test/architecture/import-boundaries.test.ts` asserts *equality* on the set
 * of modules naming a SQLite driver -- so a second opener would not be a second
 * module, it would be a failing test. The opener therefore comes here, to the
 * module that already owns the driver, and the cost is paid in the open:
 * importing the barrel now loads `node:sqlite`, and Node prints one
 * `ExperimentalWarning` per process that does. That cost is recorded in
 * DECISIONS.md D-0024 rule 5 rather than left to be discovered in a terminal.
 *
 * {@link iterationStore} still takes a connection, and every existing caller
 * still hands one in: the opener is an addition beside it, not a replacement,
 * which is what keeps the suite able to pass `:memory:` and a fake alike.
 *
 * **What D-0019 rule 10 made this file do.** The `read`/`write` pair it used to
 * declare could not express durable single-flight: a write that takes a whole
 * record cannot say "only if the row is still `admitted`", and an in-memory
 * mutex does not survive a restart. What replaces it is two operations with
 * `BEGIN IMMEDIATE` transactions inside them and a reader, over a schema whose
 * invariant -- **at most one non-terminal iteration exists** -- is the
 * database's rather than a promise this code makes.
 *
 * The reader is **total**, and `settle` is the one status-blind write. Both
 * exist for the same row: one a person edited out from under rondo. See
 * {@link IterationStore.read} and {@link IterationStore.settle} for why a store
 * that threw on such a row closed every path out of it.
 */
import { DatabaseSync } from "node:sqlite";
import { advisoryRecord } from "./advisory.js";
import type { AdvisoryRecord, HostPolicy, IterationStore } from "./contract.js";
import { iterationStore } from "./iteration.js";

export { advisoryRecord } from "./advisory.js";
export { LANE_LEDGER_AUTHOR } from "./claims.js";
export type {
  AdvisoryRecord,
  ApprovedSplit,
  ClosingLap,
  DraftRunWrite,
  HeldStart,
  HostPolicy,
  IterationStore,
  LaneMoveInput,
  LedgerLine,
  ReadOutcome,
  RecordOutcome,
  ReserveInput,
  ReserveOutcome,
  ScopeSpend,
  ScopeTip,
  SettleOutcome,
  ThreadMessagesReadOutcome,
  TransitionOutcome,
} from "./contract.js";
export { asRefusal, duplicateReason } from "./contract.js";
export { iterationStore } from "./iteration.js";
export { StoreDefect } from "./rows.js";

/**
 * Open the durable store at a path.
 *
 * The one function in rondo that turns a filename into a database, and it is
 * here rather than in a composition root because the boundary test asserts
 * equality on the set of modules that name a SQLite driver (see this module's
 * header): an opener anywhere else would be a second owner, and the answer to
 * "where does the operator's database get opened" would have been a failing
 * architecture test rather than a design choice.
 *
 * The file is created if it is not there, and {@link iterationStore} applies
 * the schema on every open, so a first run needs no separate provisioning step
 * -- which is the whole reason the operator's surface can name a path that does
 * not exist yet and simply work.
 */
export function openIterationStore(databasePath: string, policy: HostPolicy): IterationStore {
  return iterationStore(openStoreFile(databasePath), policy);
}

/**
 * How long a connection waits for another one's write lock before it fails
 * (`D-0107`).
 *
 * **Every open writes**: {@link migrate} runs `BEGIN IMMEDIATE` on each one, so
 * two processes opening the file at the same moment race for the write lock --
 * and with SQLite's default of no wait the loser fails at once with "database
 * is locked". That is what setup's last step met in lap 12 (rondo#406), opening
 * the store while the host it had just restarted was opening it too; the host
 * could as easily have been the one to lose. Five seconds is far above any
 * write rondo holds, and only a lock that is really stuck reaches it.
 */
const BUSY_TIMEOUT_MS = 5_000;

/**
 * A connection to the store's file, waiting for a concurrent writer.
 *
 * A pragma and not `DatabaseSync`'s `timeout` option: the option arrived in
 * Node 22.16, and `engines` still admits 22.14, where it would be ignored.
 */
function openStoreFile(databasePath: string): DatabaseSync {
  const connection = new DatabaseSync(databasePath);
  connection.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
  return connection;
}

/**
 * Open the advisory record at a path.
 *
 * Beside {@link openIterationStore} and for the same reason it is here at all:
 * this module is the one owner of a SQLite driver, so a second opener anywhere
 * else would be a failing architecture test rather than a design choice.
 *
 * **A second connection to one file rather than a second port over one
 * connection**, which is a deliberate reduction and not an oversight. The two
 * ports answer different questions for different callers (see
 * {@link AdvisoryRecord}), and threading one connection out of
 * {@link openIterationStore} would change a signature five call sites use so
 * that one command could share it. SQLite serialises the writers itself, and
 * both connections wait the same busy timeout for each other (`D-0107`).
 */
export function openAdvisoryRecord(databasePath: string): AdvisoryRecord {
  return advisoryRecord(openStoreFile(databasePath));
}
