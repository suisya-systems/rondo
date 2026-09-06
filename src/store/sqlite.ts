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

import { canonicalJson, planDigest } from "./plan.js";
import {
  type IterationFields,
  type IterationRecord,
  type IterationStatus,
  type JsonRecord,
  type LapReading,
  type LapReadingDraft,
  type ReadingEvidence,
  SUSPENDED_STATUSES,
  TERMINAL_STATUSES,
} from "./records.js";

/**
 * Everything `reserve` needs to write the first row.
 *
 * This type and the outcome unions below are stated here **and** in
 * `src/refrain/ports.ts`, structurally identically. They are two statements of
 * one contract, and this is the canonical one, because the store is the
 * implementation and the port is a description of it written in the loop's
 * vocabulary so that the loop can be handed a fake instead (D-0019 rule 1).
 * `src/access/conductor.ts` is where the two are checked against each other:
 * assigning an `IterationStore` to a `StorePort` there is a compile error the
 * moment they drift. The store may not close the loop by importing the port
 * itself -- the store layer names only itself, which is what
 * `test/architecture/import-boundaries.test.ts` enforces.
 */
export interface ReserveInput {
  readonly id: string;
  readonly request: string;
  /** The plan as the loop rendered it; the store digests these bytes. */
  readonly plan: JsonRecord;
  /**
   * The triple the allocator minted for this iteration (D-0023 rule 5).
   *
   * Handed in rather than derived here, because deriving them is a pure
   * function of the iteration id and the workspace root and belongs where the
   * loop can be tested against it. The store's job is the half that needs a
   * transaction: writing the claim in the same `BEGIN IMMEDIATE` as the row, so
   * that no concurrent reservation can be handed a name this one is taking.
   */
  readonly runId: string;
  readonly topicBranch: string;
  readonly workspace: string;
  readonly nowMs: number;
}

/**
 * The two bounds one host admits under (D-0023 rule 12).
 *
 * Read once at the composition root and handed to the store, never taken from
 * a request: `admit()` receives a `LoopPolicy` per call, so a bound placed
 * there would be a bound each request states about the whole host, and "the
 * bound" would become whichever caller arrived last. A host-wide limit any
 * request may restate is not a limit.
 *
 * **`maxIterations` is not either of these numbers.** It is a ceiling on
 * attempts *of one request* and is compared against a fresh iteration's zero
 * attempts before a row exists; these bound *concurrent requests*. Different
 * axes, different owners.
 *
 * Declared here as well as in `src/refrain/policy.ts` for the reason
 * {@link ReserveInput} is: the store may not import the loop, and
 * `src/access/conductor.ts` is where the two are checked against each other.
 */
export interface HostPolicy {
  /**
   * How many iterations may be *executing* at once.
   *
   * Counted over the generated `occupying` column: every non-terminal status
   * except `awaiting_human` and `withdrawal_requested`. **One, until continuo's
   * D-1104 lands its holder-identity half** -- continuo serialises `lap perform`
   * on a single global delivery resource, so a second concurrent lap is refused
   * there rather than here. Raising this number is then a policy edit and not a
   * code change.
   */
  readonly maxOccupying: number;
  /**
   * How many iterations may be *non-terminal* at once.
   *
   * Counted over `live`. This one may exceed one today, because an iteration
   * suspended at a gate holds no continuo resource, no process and no fenced
   * child -- it is a durable row in front of a person. What it bounds is the
   * leak: worktrees, branches, open runs and unanswered questions.
   */
  readonly maxLive: number;
}

/**
 * Why a reservation did not happen.
 *
 * `atCapacity` is the capacity refusal and is an ordinary answer rather than a
 * fault: a host that is already at its bound says so, and the caller tries
 * again when something ends. It replaces D-0019's `occupied`, which named the
 * one blocking row -- a meaningful answer only while the bound was one.
 *
 * It carries the bound, the occupancy observed and which of the two bounds
 * refused, because that is what a person needs in order to decide whether to
 * wait or to raise a number, and because the occupancy may legitimately read
 * *higher* than the bound (D-0023 rule 27).
 */
export type ReserveOutcome =
  | { readonly kind: "reserved"; readonly record: IterationRecord }
  | {
      readonly kind: "atCapacity";
      readonly bound: BoundName;
      readonly limit: number;
      readonly occupancy: number;
    }
  | { readonly kind: "defect"; readonly reason: string };

/** Which of {@link HostPolicy}'s two bounds an admission was refused by. */
export type BoundName = "maxOccupying" | "maxLive";

/** Why a transition did not happen. */
export type TransitionOutcome =
  | { readonly kind: "transitioned"; readonly record: IterationRecord }
  /** The row was not in the status the caller asserted. The closed edge
   *  relation, enforced where it can actually be enforced. */
  | { readonly kind: "unexpectedStatus"; readonly found: IterationStatus }
  | { readonly kind: "missing" }
  | { readonly kind: "defect"; readonly reason: string };

/**
 * What a read found: the record, no row at all, or a row that will not decode.
 *
 * The third arm is the point. A store that *threw* on a row it cannot decode
 * made `stalled` -- which `records.ts` defines as existing precisely for "a
 * corrupt row, an effect result the union does not cover, a status the
 * interpreter does not recognise" -- unreachable, because every caller that
 * would have driven the iteration there rejected before it could. The row
 * meanwhile still counts as live, so the single-flight lock stayed held by a
 * row nothing could name. `unreadable` is that state given a name the machine
 * can act on, and it carries the id so the answer can say which row.
 */
export type ReadOutcome =
  | { readonly kind: "read"; readonly record: IterationRecord }
  | { readonly kind: "absent" }
  | { readonly kind: "unreadable"; readonly id: string; readonly reason: string };

/** Whether the status-blind termination of {@link IterationStore.settle} landed. */
export type SettleOutcome =
  | { readonly kind: "settled" }
  | { readonly kind: "missing" }
  | { readonly kind: "defect"; readonly reason: string };

/**
 * The durable surface, as the loop is allowed to see it.
 *
 * Asynchronous even though every implementation below is synchronous, because
 * the port is what a fake, a future connection pool or a store on another
 * process all have to satisfy, and a synchronous signature would be the one
 * shape none of them could take later without changing every caller.
 */
export interface IterationStore {
  /** Commit the `planned` row, or say that a non-terminal iteration exists. */
  reserve(input: ReserveInput): Promise<ReserveOutcome>;
  /**
   * Assert the current status, then write the new one with its fields.
   *
   * **`reading` is written in the same transaction as the transition, and that
   * is D-0029 rule 8 rather than a convenience.** A reading committed after the
   * transition succeeded leaves a window in which the row says
   * `awaiting_human` and no reading exists -- and the person who answers the
   * gate inside that window is the person the reading was taken for. Passing it
   * here rather than offering a second method is what makes the window
   * unreachable instead of merely small: there is no call a caller could make
   * in the wrong order.
   */
  transition(
    id: string,
    from: IterationStatus,
    to: IterationStatus,
    fields: IterationFields,
    nowMs: number,
    reading?: LapReadingDraft | null,
  ): Promise<TransitionOutcome>;
  /**
   * Every reading taken of one iteration, oldest first.
   *
   * What `publish` consults, and the reason D-0029 rule 8 refuses to defer the
   * query: a reading on a row that has reached a terminal status is reachable
   * through nothing else in this file. {@link IterationStore.read} needs an id
   * a caller already has and answers about the iteration rather than about its
   * readings; {@link IterationStore.readLive} filters terminal rows out.
   */
  readingsFor(iterationId: string): Promise<readonly LapReading[]>;
  /**
   * Every iteration that reached a terminal status carrying no reading at all.
   *
   * **The fail-open detector, and it exists because the fail-open is silent.**
   * A lap whose reading was never written closes within minutes and looks from
   * every other read in this file exactly like one that was read and found
   * fine. Without this, "how often does the stage not happen" is not a question
   * the store can answer, and a stage whose absence is unobservable is a stage
   * that can quietly stop running.
   *
   * Ids rather than records: the question is a count and a list to go look at,
   * and returning records would make a row that will not decode able to break
   * the census of the rows that do.
   */
  terminalWithoutReading(): Promise<readonly string[]>;
  /**
   * One iteration by id -- total, and that totality is load-bearing.
   *
   * It answers `absent` when there is no such row and `unreadable` when there
   * is one that will not decode; it does not throw for either. The fix belongs
   * here rather than in a `try`/`catch` upstream because the store is the thing
   * that knows the row did not decode -- a caller can only observe that
   * *something* threw, and would have to guess whether the promise rejected
   * because the row is corrupt or because the connection is gone. The two want
   * opposite responses: one is an iteration to stall and settle, the other is a
   * process that should stop.
   */
  read(id: string): Promise<ReadOutcome>;
  /**
   * Every non-terminal iteration, oldest first.
   *
   * Plural since D-0023: under a bound above one there is no such thing as
   * *the* live iteration, and a singular answer would have been an arbitrary
   * row. Each element is a {@link ReadOutcome} rather than a record so that one
   * row that will not decode does not make the others unreadable -- which is
   * the same totality argument {@link IterationStore.read} makes, applied to a
   * list.
   */
  readLive(): Promise<readonly ReadOutcome[]>;
  /**
   * Terminate a row by id alone, without decoding it.
   *
   * **A narrow, single-purpose licence, and the only write in this file that
   * does not assert the status it is leaving.** Every other write does, because
   * the closed edge relation of D-0019 rule 6 is the design's safety property
   * and `transition` is where it is enforced against a restart. But a row whose
   * status cannot be read has no status to assert, and refusing to write it is
   * exactly what wedges the conductor: the row keeps `live` set, so `reserve`
   * answers `occupied` forever and no path exists to end it. This is the floor
   * beneath D-0019 rule 11's table, whose last row is an operator's `abandon()`.
   *
   * Reachable **only** from the interpreter's `abandon()`, and only when
   * `read` answered `unreadable`. Nothing else may call it: a caller that can
   * name the status has `transition`, and using this instead would trade the
   * invariant for a convenience.
   */
  settle(id: string, reason: string, nowMs: number): Promise<SettleOutcome>;
}

/**
 * A row the store cannot read, or a write the store will not make.
 *
 * Internal to this module: it is the signal a decoder raises, and no method
 * lets it out. The read boundary catches it and answers `unreadable` with its
 * message, `reserve` and `transition` catch it and answer `defect`; the two
 * shapes are the same fact stated in the vocabulary each caller reads. It stays
 * a throw inside because the decoders below are ordinary functions returning
 * ordinary values, and threading an outcome through every column would put the
 * refusal everywhere rather than at the one boundary that has to state it.
 *
 * D-0019 rule 8's rule is that anything the interpreter cannot classify halts
 * and asks. That rule is worth nothing if the store guesses first, so a status
 * outside the eleven and a `plan` column that is not JSON are refusals here
 * rather than coercions.
 */
export class StoreDefect extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreDefect";
  }
}

/**
 * Every status the union covers, as a lookup a compiler checks for
 * completeness.
 *
 * `IterationStatus` is a union of literals and a union cannot be enumerated at
 * runtime, so the eleven names are written once more here -- as the *keys of a
 * total record*, which means a status added to `records.ts` and forgotten here
 * is a type error rather than a row this module would silently refuse to read.
 * The terminal three are not restated: they come from `TERMINAL_STATUSES`,
 * below, where the generated column needs them.
 */
const KNOWN_STATUSES: Readonly<Record<IterationStatus, true>> = Object.freeze({
  planned: true,
  classified: true,
  admitting: true,
  admitted: true,
  performing: true,
  awaiting_human: true,
  withdrawal_requested: true,
  stalled: true,
  closed: true,
  abandoned: true,
  failed: true,
});

/**
 * The column each writable field is stored in.
 *
 * `satisfies` over `Record<keyof IterationFields, string>` is the point of the
 * shape: every field a transition may write has a column, checked at compile
 * time, so a field added to the record and not to the schema cannot become a
 * write that is silently dropped.
 */
const COLUMN_BY_FIELD = {
  request: "request",
  plan: "plan",
  planDigest: "plan_digest",
  attempts: "attempts",
  identifiersSpent: "identifiers_spent",
  continuoRevision: "continuo_revision",
  agentTypeDigest: "agent_type_digest",
  configDigest: "config_digest",
  contractDigest: "contract_digest",
  classification: "classification",
  classificationReason: "classification_reason",
  neutralRoleName: "neutral_role_name",
  continuoRole: "continuo_role",
  modelTier: "model_tier",
  model: "model",
  gateId: "gate_id",
  gateStage: "gate_stage",
  gateOutcome: "gate_outcome",
  sessionId: "session_id",
  sessionPath: "session_path",
  reason: "reason",
} as const satisfies Record<keyof IterationFields, string>;

/** What a bound parameter may be. The store persists no blobs and no bigints. */
type SqlValue = string | number | null;

/** A row as the driver hands it back, before anything has been read from it. */
type SqlRow = Readonly<Record<string, unknown>>;

/**
 * The terminal set, rendered as SQL literals from the one place it is written.
 *
 * Derived from `TERMINAL_STATUSES` rather than retyped into the DDL, so the set
 * has one spelling: D-0019 rule 10 chose the generated-column shape over a
 * partial index whose `WHERE` repeats the list precisely so that adding a
 * terminal status is one edit in `records.ts`. The interpolation is safe by
 * construction -- the values are this repository's own frozen tuple of
 * lowercase identifiers, not anything a caller supplies -- and it is the only
 * interpolation in this file; every other value is a bound parameter.
 */
const TERMINAL_SQL_LITERALS = TERMINAL_STATUSES.map((status) => `'${status}'`).join(", ");

/**
 * The terminal set plus the two suspended statuses, as SQL literals.
 *
 * The `occupying` column's whole definition, and it is derived from
 * `records.ts` for {@link TERMINAL_SQL_LITERALS}'s reason: `maxOccupying`
 * counts exactly this column, so the bound and the column are one definition
 * and the set has one spelling (D-0023 rule 8).
 */
const UNOCCUPIED_SQL_LITERALS = [...TERMINAL_STATUSES, ...SUSPENDED_STATUSES]
  .map((status) => `'${status}'`)
  .join(", ");

/**
 * The generated columns, as SQL expressions, written once.
 *
 * Named here rather than inline in the DDL because they are needed twice: once
 * by `CREATE TABLE` for a database that does not exist yet, and once by
 * {@link migrate} for one that does. Two spellings of a generated column would
 * be two definitions of a bound.
 */
const GENERATED_COLUMNS = Object.freeze({
  live: `INTEGER GENERATED ALWAYS AS (
                          CASE WHEN status IN (${TERMINAL_SQL_LITERALS}) THEN NULL ELSE 1 END
                        ) VIRTUAL`,
  occupying: `INTEGER GENERATED ALWAYS AS (
                          CASE WHEN status IN (${UNOCCUPIED_SQL_LITERALS}) THEN NULL ELSE 1 END
                        ) VIRTUAL`,
  holds_identifiers: `INTEGER GENERATED ALWAYS AS (
                          CASE WHEN status IN (${TERMINAL_SQL_LITERALS}) AND identifiers_spent = 0
                            THEN NULL ELSE 1 END
                        ) VIRTUAL`,
});

/**
 * The schema, created idempotently on construction.
 *
 * `request` and `plan` are `NOT NULL` because `IterationRecord` says they are
 * never absent, and a column that permits what the type forbids is a schema
 * that disagrees with the code reading it. Everything the write order of
 * D-0019 rule 10 learns *later* -- the run id, the observed continuo revision,
 * the three digests, the gate -- is nullable, because it is legitimately
 * unknown at the moment the row is first written.
 *
 * **`live` is no longer an invariant the database holds, and that is D-0023.**
 * It stays as a column and keeps its meaning -- "this row has not reached a
 * terminal status" -- but the unique index over it is gone, because a unique
 * index expresses "at most one" and nothing else: `UNIQUE(live)` over a column
 * whose only non-null value is `1` is a bound of one *by construction*, and
 * there is no "at most N" index to widen it into. What replaces it is a count
 * read inside `reserve()`'s own `BEGIN IMMEDIATE`.
 *
 * **What that costs is stated here rather than argued away.** Under the index,
 * a row inserted from outside this code -- `sqlite3` on the file, a hand-edited
 * migration -- could not violate single-flight, because the database refused
 * it. Under a counted bound the invariant lives in `reserve()`'s transaction
 * and an out-of-band insert violates it silently. D-0019 rule 10 bought
 * "making 'at most one non-terminal iteration' the *database's* invariant", and
 * that is what is being spent. D-0023 rule 11 records it, and names the slot
 * table as the alternative that would have kept it.
 *
 * `occupying` and `holds_identifiers` are the two generated columns that
 * replace what the index was doing, and neither is a bound: they are the sets
 * the bounds are counted over and the claims the partial unique indexes are
 * taken over. See {@link GENERATED_COLUMNS}.
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS iteration (
  id                    TEXT    PRIMARY KEY,
  status                TEXT    NOT NULL,
  request               TEXT    NOT NULL,
  plan                  TEXT    NOT NULL,
  plan_digest           TEXT    NOT NULL,
  attempts              INTEGER NOT NULL,
  run_id                TEXT,
  topic_branch          TEXT,
  workspace             TEXT,
  identifiers_spent     INTEGER NOT NULL DEFAULT 0,
  continuo_revision     TEXT,
  agent_type_digest     TEXT,
  config_digest         TEXT,
  contract_digest       TEXT,
  classification        TEXT,
  classification_reason TEXT,
  neutral_role_name     TEXT,
  continuo_role         TEXT,
  model_tier            TEXT,
  model                 TEXT,
  gate_id               TEXT,
  gate_stage            TEXT,
  gate_outcome          TEXT,
  session_id            TEXT,
  session_path          TEXT,
  reason                TEXT,
  created_at_ms         INTEGER NOT NULL,
  updated_at_ms         INTEGER NOT NULL,
  live                  ${GENERATED_COLUMNS.live},
  occupying             ${GENERATED_COLUMNS.occupying},
  holds_identifiers     ${GENERATED_COLUMNS.holds_identifiers}
);
-- D-0023 rule 14. The demand record, and it is deliberately not the iteration
-- table: a capacity refusal must reserve nothing, take no lock and cost no row
-- *there*, which is what D-0019 rule 9 and the dogfood's 1 ms measurement both
-- rest on. Without this table a refusal leaves no trace at all, and the bound
-- could only ever be raised because somebody complained rather than because
-- somebody was counted.
CREATE TABLE IF NOT EXISTS admission_refusal (
  refused_at_ms         INTEGER NOT NULL,
  request               TEXT    NOT NULL,
  bound_name            TEXT    NOT NULL,
  bound                 INTEGER NOT NULL,
  occupancy             INTEGER NOT NULL
);

-- D-0029 rule 8. One reading of what a lap produced, per row that produced one.
--
-- **Append-only, and with no status column on purpose.** A row that could be
-- rewritten to clear would be a record of what somebody wished had been read
-- (D-0022 rule 4, whose shape this copies). Immutability here is a property of
-- the schema and of there being no writer that updates -- not of a trigger, and
-- the entry claims it at that grade.
--
-- iteration_id is not a foreign key, for admission_refusal's reason: this
-- database has no foreign keys at all, and adding one to a single table would
-- make the schema say that referential integrity is enforced somewhere it is
-- not. It is also not unique: a second reading of the same row is a later fact
-- about it and not a correction of the first, so the newest is what a reader
-- takes and both stay readable.
--
-- The evidence columns are nullable together: null exactly when the verdict is
-- unavailable. findings is canonical JSON of an array of strings rather
-- than a joined string, because a finding may contain any character a person's
-- branch name may and a separator would be a bug waiting for that character.
CREATE TABLE IF NOT EXISTS lap_reading (
  iteration_id          TEXT    NOT NULL,
  read_at_ms            INTEGER NOT NULL,
  drafter               TEXT    NOT NULL,
  verdict               TEXT    NOT NULL,
  findings              TEXT    NOT NULL,
  base_ref              TEXT,
  base_commit           TEXT,
  tip_commit            TEXT,
  material_digest       TEXT,
  commit_count          INTEGER,
  file_count            INTEGER,
  unavailable_reason    TEXT
);

CREATE INDEX IF NOT EXISTS lap_reading_by_iteration
  ON lap_reading(iteration_id, read_at_ms);
`;

/**
 * The allocator's three claims, as partial unique indexes.
 *
 * **Applied after {@link migrate} rather than with {@link SCHEMA}, and the
 * order is load-bearing.** Each index names `holds_identifiers` in its `WHERE`,
 * and on a database created before D-0023 that column does not exist until the
 * migration adds it -- so creating these with the tables would fail on exactly
 * the databases the migration exists for.
 *
 * `AND <column> IS NOT NULL` in each predicate because SQLite treats NULLs as
 * distinct in a unique index but the intent is worth stating rather than
 * inheriting: a row that has not been allocated a triple yet claims no name,
 * and several such rows are not a collision.
 *
 * D-0023 rule 7. The reason these are indexes over a generated column rather
 * than three plain UNIQUE constraints is that a claim must outlive the
 * iteration that made it. A *live* row holds its triple, so no concurrent
 * iteration can be handed it. A *terminal, spent* row keeps holding it for
 * ever -- continuo's run exists, the branch exists, the worktree exists, and
 * reissuing any of those names is how a design hands a second run a branch a
 * merged pull request still owns. A *terminal, unspent* row releases it, which
 * is the one case a plain UNIQUE could not express.
 */
const CLAIM_INDEXES = `
CREATE UNIQUE INDEX IF NOT EXISTS iteration_holds_run_id
  ON iteration(run_id) WHERE holds_identifiers IS NOT NULL AND run_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS iteration_holds_topic_branch
  ON iteration(topic_branch) WHERE holds_identifiers IS NOT NULL AND topic_branch IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS iteration_holds_workspace
  ON iteration(workspace) WHERE holds_identifiers IS NOT NULL AND workspace IS NOT NULL;
`;

/**
 * The columns and indexes a database created before D-0023 does not have.
 *
 * **This exists because rondo had no migration mechanism and now needs one.**
 * `CREATE TABLE IF NOT EXISTS` is a no-op against a table that is already
 * there, whatever its columns, so every DDL change since D-0019 would have
 * reached new databases only -- and D-0023 is the first change that adds a
 * column at all, which is why the gap had never been stepped in.
 *
 * The shape is deliberately the small one: a declarative list of columns, a
 * diff against what the table actually has, and an `ALTER TABLE ADD COLUMN` for
 * each one missing. There is no version number and no ordered directory of
 * migration files. continuo carries that machinery and is right to; rondo's
 * store is one module over one table with no down-migration and no branch in
 * its history, and a version counter would be a mechanism whose failure modes
 * exceed the thing it guards. **It is a reversible choice**: the moment a
 * second table needs a coordinated change, this becomes the wrong shape.
 *
 * **`pragma_table_xinfo` rather than `pragma_table_info`, and that is not a
 * preference.** `table_info` does not list generated columns at all, so a diff
 * taken against it would try to add `live`, `occupying` and
 * `holds_identifiers` on every open and fail with `duplicate column name` on
 * the second one. `table_xinfo` lists them, marked `hidden = 2`.
 *
 * A `VIRTUAL` generated column can be added by `ALTER TABLE`; a `STORED` one
 * cannot, portably. All three of rondo's are `VIRTUAL`.
 */
const ADDED_COLUMNS = Object.freeze({
  topic_branch: "TEXT",
  workspace: "TEXT",
  identifiers_spent: "INTEGER NOT NULL DEFAULT 0",
  occupying: GENERATED_COLUMNS.occupying,
  holds_identifiers: GENERATED_COLUMNS.holds_identifiers,
});

/**
 * Bring an existing database up to the schema above.
 *
 * Idempotent, and safe on a database that has just been created by
 * {@link SCHEMA}: every column is already there, so the diff is empty.
 *
 * **Dropping `iteration_one_live` is a decision's consequence and not a
 * housekeeping step.** It is the index D-0019 rule 10 made the single-flight
 * invariant *the database's*, and on an existing database this line is the
 * exact moment that stops being true: afterwards the bound is enforced by
 * `reserve()`'s counted refusal, in this process, and an insert that does not
 * go through it is unopposed. Leaving the index in place instead was not an
 * option -- it refuses a second live row unconditionally, so an operator's
 * existing database would have silently ignored `maxLive` and kept behaving as
 * if D-0023 had not landed.
 *
 * **It is reversible only while the bound it replaced would still hold.**
 * `CREATE UNIQUE INDEX iteration_one_live` can be re-run to restore the
 * database-side guarantee, and it will succeed exactly when at most one
 * non-terminal row exists at that moment. Once a host has actually admitted a
 * second live iteration, recreating the index fails until the operator ends one
 * of them; the migration is reversible, the history it enabled is not.
 */
function migrate(connection: DatabaseSync): void {
  // **One transaction around the whole upgrade, and that is not tidiness.**
  // `ALTER TABLE` commits on its own, so a process that stopped between adding
  // `identifiers_spent` and back-filling it would leave a database whose
  // columns are present and whose claims are wrong -- and the next open would
  // find nothing missing, skip the back-fill for ever, and quietly release
  // every spent legacy claim. `BEGIN IMMEDIATE` also makes two first opens
  // race for the write lock rather than for the `ALTER`.
  connection.exec("BEGIN IMMEDIATE");
  try {
    const present = new Set(
      connection
        .prepare("SELECT name FROM pragma_table_xinfo('iteration')")
        .all()
        .map((row) => String((row as SqlRow)["name"])),
    );
    const added: string[] = [];
    for (const [column, declaration] of Object.entries(ADDED_COLUMNS)) {
      if (!present.has(column)) {
        connection.exec(`ALTER TABLE iteration ADD COLUMN ${column} ${declaration}`);
        added.push(column);
      }
    }
    if (added.includes("identifiers_spent")) {
      backfill(connection);
    }
    connection.exec("DROP INDEX IF EXISTS iteration_one_live");
    connection.exec("COMMIT");
  } catch (error) {
    try {
      connection.exec("ROLLBACK");
    } catch {
      // The transaction was already resolved, or the connection is gone.
    }
    throw error;
  }
}

/**
 * Give every pre-D-0023 row the identifiers and the claim it actually had.
 *
 * **The order of these four statements is the whole of their correctness.**
 * Before D-0023 the run id was written by the transition into `admitting` and
 * by nothing earlier, so `run_id IS NOT NULL` on the *row* is exactly "this
 * iteration spent its identifiers". That signal has to be read before anything
 * writes a run id from the plan, or it is destroyed -- so `identifiers_spent`
 * is set first, and the three columns are filled afterwards.
 *
 * The values come from the stored plan, because that is where they were: the
 * triple was the operator's and travelled in the plan payload, and the row
 * carried only the run id and only once it was admitted. A legacy row whose
 * branch and workspace stayed NULL would sit outside all three claim indexes,
 * so a later iteration could be handed a branch git already has -- which is the
 * failure the indexes exist to prevent, reintroduced by the upgrade itself.
 *
 * `json_extract` returns NULL for a plan that does not carry the key, which
 * leaves the column NULL and the row out of the indexes: correct, because a row
 * whose plan never named a branch never claimed one.
 *
 * **`json_valid` is the guard, and a corrupt row must not brick the store.**
 * `json_extract` raises on malformed JSON, and one damaged historical row would
 * otherwise stop the whole database opening -- including for `abandon()`, which
 * is the one path that exists to end exactly such a row and which deliberately
 * leaves its plan bytes untouched. So an unreadable plan yields no back-fill
 * for that row and no error: it keeps NULL identifiers, stays outside the claim
 * indexes, and remains reachable by the recovery that was built for it.
 */
function backfill(connection: DatabaseSync): void {
  connection.exec(
    "UPDATE iteration SET identifiers_spent = 1 WHERE run_id IS NOT NULL AND identifiers_spent = 0",
  );
  for (const [column, key] of [
    ["run_id", "$.run_id"],
    ["topic_branch", "$.topic_branch"],
    ["workspace", "$.workspace"],
  ] as const) {
    connection.exec(
      `UPDATE iteration SET ${column} = json_extract(plan, '${key}') ` +
        `WHERE ${column} IS NULL AND json_valid(plan)`,
    );
  }
}

/**
 * The two bounds, in the order `reserve()` checks them.
 *
 * `maxOccupying` first, so that a host whose execution bound is the binding one
 * says so rather than reporting the looser number. Each entry pairs a bound
 * with the generated column it is counted over, which is what keeps
 * "the bound and the column are one definition" (D-0023 rule 8) true in the
 * code and not only in the entry.
 */
const BOUNDS = Object.freeze([
  { name: "maxOccupying", column: "occupying" },
  { name: "maxLive", column: "live" },
] as const satisfies readonly { name: BoundName; column: "occupying" | "live" }[]);

/** Every column the reader expects, in the order the record spells them. */
const SELECT_COLUMNS = [
  "id",
  "status",
  "request",
  "plan",
  "plan_digest",
  "attempts",
  "run_id",
  "topic_branch",
  "workspace",
  "identifiers_spent",
  "continuo_revision",
  "agent_type_digest",
  "config_digest",
  "contract_digest",
  "classification",
  "classification_reason",
  "neutral_role_name",
  "continuo_role",
  "model_tier",
  "model",
  "gate_id",
  "gate_stage",
  "gate_outcome",
  "session_id",
  "session_path",
  "reason",
  "created_at_ms",
  "updated_at_ms",
].join(", ");

/**
 * A store backed by an open `node:sqlite` connection.
 *
 * The schema is created on construction and the connection is not otherwise
 * configured: journal mode, busy timeout and file location are the composition
 * root's, because they are deployment facts and this module is a schema.
 */
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
  return iterationStore(new DatabaseSync(databasePath), policy);
}

export function iterationStore(connection: DatabaseSync, policy: HostPolicy): IterationStore {
  connection.exec(SCHEMA);
  migrate(connection);
  try {
    connection.exec(CLAIM_INDEXES);
  } catch (error) {
    // **The one upgrade failure a person has to be able to act on.** These
    // indexes are created over data that predates them, and a database in
    // which two rows already hold one name cannot have them -- which is a fact
    // about that database and not a fault in this code. The driver would say
    // "UNIQUE constraint failed: iteration.topic_branch", naming a column and
    // no row; this says what happened and what it means, and refuses to open
    // rather than opening a store whose claims are not enforced.
    throw new StoreDefect(
      "this database already holds two iterations claiming one run id, topic branch or " +
        "workspace, so the claim indexes D-0023 requires cannot be created over it. That is " +
        "legal in a database written before D-0023, where the triple was the operator's to " +
        "type and could be reused across iterations. rondo will not open a store whose claims " +
        `it cannot enforce: ${describe(error)}`,
    );
  }

  const readRow = (id: string): SqlRow | null => {
    const row = connection.prepare(`SELECT ${SELECT_COLUMNS} FROM iteration WHERE id = ?`).get(id);
    return row === undefined ? null : (row as SqlRow);
  };

  const readLiveRows = (): readonly SqlRow[] =>
    connection
      .prepare(
        `SELECT ${SELECT_COLUMNS} FROM iteration WHERE live IS NOT NULL ORDER BY created_at_ms, id`,
      )
      .all() as readonly SqlRow[];

  /**
   * How many rows the given bound counts, read inside the caller's transaction.
   *
   * The column name is one of two literals chosen here rather than anything a
   * caller supplies, which is what keeps the interpolation safe; every other
   * value in this file is a bound parameter.
   */
  const occupancyOf = (column: "occupying" | "live"): number =>
    Number(
      (
        connection
          .prepare(`SELECT COUNT(*) AS n FROM iteration WHERE ${column} IS NOT NULL`)
          .get() as SqlRow
      )["n"],
    );

  /**
   * Write the demand record for a refusal (D-0023 rule 14).
   *
   * **Outside the transaction that refused, and outside any transaction.** The
   * refusal's whole value is that it costs no row in `iteration` and takes no
   * lock, and writing the trace inside the reserving transaction would have
   * rolled it back with the refusal it was recording.
   *
   * Best-effort on purpose: this table is evidence for a later decision about
   * the bound, not a fact the caller acts on, and failing to write it must not
   * turn an ordinary refusal into a defect. A refusal a person can act on is
   * worth more than a count nobody has read yet.
   */
  const recordRefusal = (
    input: ReserveInput,
    refusal: { readonly bound: BoundName; readonly limit: number; readonly occupancy: number },
  ): void => {
    try {
      connection
        .prepare(
          "INSERT INTO admission_refusal (refused_at_ms, request, bound_name, bound, occupancy) " +
            "VALUES (?, ?, ?, ?, ?)",
        )
        .run(input.nowMs, input.request, refusal.bound, refusal.limit, refusal.occupancy);
    } catch {
      // The demand record is not the answer; the refusal above is.
    }
  };

  /**
   * Run `body` inside `BEGIN IMMEDIATE`, committing it or rolling it back.
   *
   * `BEGIN IMMEDIATE` rather than the default deferred transaction for the
   * reason continuo gives on its own admission path: under a deferred
   * transaction the write lock is taken at the *first write*, which leaves a
   * window in which two readers have both decided they may proceed. Taking the
   * write lock at `BEGIN` closes it, and the serialisation is then the
   * database's -- it holds across two processes, not merely across two callers
   * in one.
   */
  const inTransaction = <T>(body: () => T): T => {
    connection.exec("BEGIN IMMEDIATE");
    try {
      const value = body();
      // **Enforced rather than assumed** (D-0023 rule 16). The type is
      // `<T>(body: () => T) => T`, which happily admits a promise-returning
      // body -- and then `COMMIT` runs *before* the awaited work, so the
      // transaction is torn and the write lands outside it. Under one
      // in-flight iteration the failure is invisible, because nothing else is
      // ever inside a transaction at the same time; under a bound above one it
      // is a corrupt row and a bound that was never really checked.
      //
      // The property the whole in-process side of N > 1 rests on is that every
      // transaction body is synchronous, so two overlapping `admit()` calls
      // cannot interleave inside one: `node:sqlite` is synchronous and
      // JavaScript is single-threaded, so a body with no `await` in it runs to
      // completion before any other continuation. That is a real guarantee and
      // it is worth exactly as much as the promise that nobody adds an
      // `await` -- which is why this refuses instead of trusting.
      if (typeof (value as { readonly then?: unknown } | null)?.then === "function") {
        throw new StoreDefect(
          "a store transaction body returned a thenable, which would commit before the awaited " +
            "work had happened. Every body here must be synchronous: that is what makes two " +
            "overlapping admissions unable to interleave inside one transaction.",
        );
      }
      connection.exec("COMMIT");
      return value;
    } catch (error) {
      // Rolling back is best-effort on purpose: if the rollback itself fails
      // the original error is the one worth reporting, and swallowing it to
      // report the rollback would hide the cause behind its own cleanup.
      try {
        connection.exec("ROLLBACK");
      } catch {
        // The transaction was already resolved, or the connection is gone.
      }
      throw error;
    }
  };

  /**
   * Write one reading beside the transition that carries it.
   *
   * Synchronous, and it has to be: it runs inside `inTransaction`, whose body
   * refuses a thenable for the reason stated there.
   *
   * **The `clear` that arrives with no evidence is refused here, and refusing
   * it is not the same as refusing the transition.** D-0029 rule 11 says a
   * `clear` may only be written beside rondo's own measurement of what was
   * read; a `clear` without one can only come from a defect in the reader, and
   * the two available answers are both bad in different directions. Failing the
   * transaction would strand the row at `performing` with a gate already open --
   * a reader's bug costing an iteration. Writing the `clear` would put the
   * stage's one enforced property in the hands of the code it is enforcing
   * against. So the reading is recorded as `unavailable`, naming what happened:
   * `publish` then refuses exactly as it does for any other absent reading
   * (rule 10), the row is untouched, and the defect is in the record rather
   * than in nobody's hands.
   */
  const writeReading = (iterationId: string, nowMs: number, draft: LapReadingDraft): void => {
    const evidence =
      draft.verdict === "clear" && !hasEvidence(draft.evidence) ? null : draft.evidence;
    const verdict = draft.verdict === "clear" && evidence === null ? "unavailable" : draft.verdict;
    const unavailableReason =
      verdict === draft.verdict
        ? draft.unavailableReason
        : "a 'clear' reading arrived with no measurement of what was read, so the store refused " +
          "it: D-0029 rule 11 admits a clear verdict only beside rondo's own reading of the work";
    connection
      .prepare(
        "INSERT INTO lap_reading (iteration_id, read_at_ms, drafter, verdict, findings, " +
          "base_ref, base_commit, tip_commit, material_digest, commit_count, file_count, " +
          "unavailable_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        iterationId,
        nowMs,
        draft.drafter,
        verdict,
        canonicalJson([...draft.findings]),
        evidence === null ? null : evidence.baseRef,
        evidence === null ? null : evidence.baseCommit,
        evidence === null ? null : evidence.tipCommit,
        evidence === null ? null : evidence.materialDigest,
        evidence === null ? null : evidence.commitCount,
        evidence === null ? null : evidence.fileCount,
        unavailableReason,
      );
  };

  const readingRows = (iterationId: string): readonly LapReading[] =>
    connection
      .prepare(
        "SELECT iteration_id, read_at_ms, drafter, verdict, findings, base_ref, base_commit, " +
          "tip_commit, material_digest, commit_count, file_count, unavailable_reason " +
          "FROM lap_reading WHERE iteration_id = ? ORDER BY read_at_ms, rowid",
      )
      .all(iterationId)
      .map((row) => toReading(row as SqlRow));

  return {
    async reserve(input: ReserveInput): Promise<ReserveOutcome> {
      try {
        const encoded = canonicalJson(input.plan);
        const digest = planDigest(input.plan);
        // **Both counts and the insert in one `BEGIN IMMEDIATE`, and that is
        // the whole of the ledger.** A bound checked in one transaction and
        // enforced in another is the deferred-transaction window this file
        // already rejects one level up: two callers would each read an
        // occupancy below the bound and each then insert. Taking the write lock
        // at `BEGIN` is what makes "count, decide, write" atomic, and it is why
        // the count is here rather than in the interpreter.
        const outcome = inTransaction<ReserveOutcome | null>(() => {
          for (const bound of BOUNDS) {
            const occupancy = occupancyOf(bound.column);
            const limit = policy[bound.name];
            if (occupancy >= limit) {
              // Nothing is written and nothing is locked, which is the property
              // D-0019 rule 9 rests on and the reason this returns rather than
              // throws. The demand record is written *after* the transaction,
              // outside it, for the same reason.
              return { kind: "atCapacity", bound: bound.name, limit, occupancy };
            }
          }
          connection
            .prepare(
              "INSERT INTO iteration (id, status, request, plan, plan_digest, attempts, " +
                "run_id, topic_branch, workspace, identifiers_spent, created_at_ms, " +
                "updated_at_ms) VALUES (?, 'planned', ?, ?, ?, 1, ?, ?, ?, 0, ?, ?)",
            )
            // One attempt, not zero: the row exists because an attempt is being
            // made. `nextStep` compares the policy's ceiling against a *fresh*
            // iteration's zero attempts, which is the state before this row --
            // and `records.ts` says the persisted count is one in lap 1,
            // always, because there is no back-edge to raise it.
            //
            // `identifiers_spent` is zero here and is set to one by the single
            // transition into `admitting`. Until then the triple is held but
            // unspent: no run exists under it, no branch was cut and no
            // worktree was materialised.
            .run(
              input.id,
              input.request,
              encoded,
              digest,
              input.runId,
              input.topicBranch,
              input.workspace,
              input.nowMs,
              input.nowMs,
            );
          const written = readRow(input.id);
          if (written === null) {
            return {
              kind: "defect",
              reason: `the reserved row '${input.id}' was not there inside its own transaction`,
            };
          }
          return { kind: "reserved", record: toRecord(written) };
        });
        if (outcome === null) {
          return { kind: "defect", reason: `reserving '${input.id}' produced no answer` };
        }
        if (outcome.kind === "atCapacity") {
          recordRefusal(input, outcome);
        }
        return outcome;
      } catch (error) {
        if (isClaimCollision(error)) {
          // rondo minting a name it has already handed out, which the allocator
          // makes impossible by construction -- so reaching this is a defect in
          // rondo and is filed as one, in rondo's own words rather than the
          // driver's. It is *not* the collision a person causes by creating
          // `rondo/iter-005` by hand: that one is not in this database at all
          // and is still refused by git, at materialisation.
          return {
            kind: "defect",
            reason:
              `the identifiers minted for iteration '${input.id}' are already held by another ` +
              "iteration, and an allocated triple is held for ever once it is spent: " +
              describe(error),
          };
        }
        if (isIdCollision(error)) {
          // A defect, in rondo's own words. The driver's text names a table
          // column and a constraint; every other refusal in the loop names a
          // field and a rule, and a person reading "UNIQUE constraint failed:
          // iteration.id" has to know the schema to learn what happened. The
          // fact is that an iteration id is minted once and this one was
          // minted twice, and that is what the reason says.
          return {
            kind: "defect",
            reason:
              `an iteration with id '${input.id}' already exists, and an iteration id is ` +
              "minted once: the store will not reserve a second row under it",
          };
        }
        return { kind: "defect", reason: describe(error) };
      }
    },

    async transition(
      id: string,
      from: IterationStatus,
      to: IterationStatus,
      fields: IterationFields,
      nowMs: number,
      reading: LapReadingDraft | null = null,
    ): Promise<TransitionOutcome> {
      try {
        const outcome = inTransaction<TransitionOutcome | null>(() => {
          const row = readRow(id);
          if (row === null) {
            return { kind: "missing" };
          }
          const found = requireStatus(row);
          if (found !== from) {
            // Refused, and nothing is written: the closed edge relation of
            // D-0019 rule 6, enforced in the one place a restart cannot argue
            // with. The transaction rolls back through the `null` below rather
            // than through a throw, because this is an answer and not a fault.
            return { kind: "unexpectedStatus", found };
          }
          const write = assignmentsFor(fields);
          connection
            .prepare(
              `UPDATE iteration SET status = ?, updated_at_ms = ?${write.clauses} WHERE id = ?`,
            )
            .run(to, nowMs, ...write.values, id);
          // **After the status assertion and inside the same lock.** The
          // assertion above is what makes this reading belong to the transition
          // it came with: a row another writer had already moved is refused
          // before this line, so no reading is ever appended to a transition
          // that did not happen. And being inside the transaction is D-0029
          // rule 8 -- either both land or neither does, so the window in which
          // a person could answer a gate whose reading exists but is not yet
          // written does not exist.
          if (reading !== null) {
            writeReading(id, nowMs, reading);
          }
          // Read back **inside** the transaction, and hand back what came out of
          // the database rather than what was constructed in memory. The two
          // differ exactly when a write did not land, which is the case worth
          // being able to see; a record assembled from the arguments would
          // report the caller's intent back to the caller.
          //
          // **Inside rather than after the commit, and that is the whole point.**
          // A read after `COMMIT` leaves a window in which another process --
          // an operator's `abandon()`, most realistically -- moves the row to a
          // terminal status before the read happens. This method would then hand
          // back a terminal record as a *successful* transition, and the
          // interpreter would go on to spawn `run admit` or `lap perform` for an
          // iteration that had already released the single-flight lock, with a
          // second iteration free to be reserved against it. That is precisely
          // the race D-0019 rule 10's invariant exists to make impossible, so
          // the read belongs where the write lock still holds.
          const written = readRow(id);
          if (written === null) {
            return {
              kind: "defect",
              reason: `the row '${id}' vanished inside its own transaction`,
            };
          }
          return { kind: "transitioned", record: toRecord(written) };
        });
        if (outcome === null) {
          return {
            kind: "defect",
            reason: `the transition of '${id}' from '${from}' to '${to}' produced no answer`,
          };
        }
        return outcome;
      } catch (error) {
        return { kind: "defect", reason: describe(error) };
      }
    },

    async read(id: string): Promise<ReadOutcome> {
      const row = readRow(id);
      return row === null ? { kind: "absent" } : decode(row, id);
    },

    async readLive(): Promise<readonly ReadOutcome[]> {
      // The id comes out of each row here rather than from an argument, and it
      // is read defensively: a row that will not decode may be a row whose own
      // `id` is not text, and the answer still has to say which row it means.
      return readLiveRows().map((row) => decode(row, idOf(row)));
    },

    async readingsFor(iterationId: string): Promise<readonly LapReading[]> {
      return readingRows(iterationId);
    },

    async terminalWithoutReading(): Promise<readonly string[]> {
      // `live IS NULL` is the generated column's own answer to "has this row
      // reached a terminal status", read rather than restated: the terminal set
      // is written once, in `records.ts`, and a second spelling here is exactly
      // what D-0019 rule 10 rejected shape A for.
      return connection
        .prepare(
          "SELECT id FROM iteration WHERE live IS NULL AND id NOT IN " +
            "(SELECT iteration_id FROM lap_reading) ORDER BY created_at_ms, id",
        )
        .all()
        .map((row) => String((row as SqlRow)["id"]));
    },

    async settle(id: string, reason: string, nowMs: number): Promise<SettleOutcome> {
      try {
        // Status-blind, by the licence documented on `IterationStore.settle`:
        // no `readRow`, no `requireStatus`, nothing that could refuse the very
        // row this exists to end. `BEGIN IMMEDIATE` all the same, because the
        // write releases the single-flight lock and another process reserving
        // against it must be serialised by the database rather than by luck.
        // **`live IS NOT NULL` is a guard and not an optimisation.** A row that
        // will not decode may be one whose *status* is fine and whose some other
        // column is malformed -- a `closed` iteration with a corrupt digest, say
        // -- and `read` answers `unreadable` for that too. Without this clause
        // the escape hatch would overwrite a finished outcome with `abandoned`,
        // destroying the record of a lap that really did close. The hatch exists
        // to release a row that is *holding the lock* (D-0019 rule 11), and the
        // generated column is exactly the database's own answer to "is it".
        const changes = inTransaction(
          () =>
            connection
              .prepare(
                "UPDATE iteration SET status = 'abandoned', reason = ?, updated_at_ms = ? " +
                  "WHERE id = ? AND live IS NOT NULL",
              )
              .run(reason, nowMs, id).changes,
        );
        // `changes` is the only thing that distinguishes "no such row" from a
        // row that was terminated, and it is the database's count rather than a
        // read this method is not allowed to make. Zero now covers two cases --
        // no row at all, and a row that was already terminal -- and both are
        // "nothing to release", which is the one fact the caller acts on.
        return changes === 0n || changes === 0 ? { kind: "missing" } : { kind: "settled" };
      } catch (error) {
        return { kind: "defect", reason: describe(error) };
      }
    },
  };
}

/**
 * A transition's fields as a SQL fragment and its bound values.
 *
 * The clause list is built from `COLUMN_BY_FIELD` rather than from the caller's
 * strings, so an unexpected key cannot reach the statement text. A field that
 * is absent is not written at all, which is what makes `transition` able to say
 * "set the gate id and touch nothing else".
 */
function assignmentsFor(fields: IterationFields): {
  readonly clauses: string;
  readonly values: readonly SqlValue[];
} {
  const clauses: string[] = [];
  const values: SqlValue[] = [];

  // The plan and its digest are written as a pair or not at all. A digest
  // column that disagrees with the bytes beside it is the one failure D-0019
  // rule 4 exists to make impossible, so the digest is always derived here and
  // a caller that supplies a different one is refused rather than obeyed.
  const plan = fields.plan;
  if (plan !== undefined) {
    const digest = planDigest(plan);
    if (fields.planDigest !== undefined && fields.planDigest !== digest) {
      throw new StoreDefect(
        "a transition supplied a 'planDigest' that is not the digest of the 'plan' it came " +
          "with, and the store will not write a row whose digest describes other bytes",
      );
    }
    clauses.push("plan = ?", "plan_digest = ?");
    values.push(canonicalJson(plan), digest);
  } else if (fields.planDigest !== undefined) {
    throw new StoreDefect(
      "a transition supplied a 'planDigest' with no 'plan', which would leave the row " +
        "claiming a digest of bytes it does not hold",
    );
  }

  for (const key of Object.keys(fields) as (keyof IterationFields)[]) {
    if (key === "plan" || key === "planDigest") {
      continue;
    }
    const value = fields[key];
    if (value === undefined) {
      // Under `exactOptionalPropertyTypes` an explicit `undefined` is not a
      // value the type admits; treating it as "not provided" is the reading
      // that cannot lose data, since the alternative is writing NULL over
      // something a caller never meant to clear.
      continue;
    }
    if (typeof value !== "string" && typeof value !== "number" && value !== null) {
      throw new StoreDefect(`the field '${key}' is a ${typeof value}, which no column holds`);
    }
    clauses.push(`${COLUMN_BY_FIELD[key]} = ?`);
    values.push(value);
  }

  return { clauses: clauses.map((clause) => `, ${clause}`).join(""), values };
}

/**
 * Whether an error is one of the three claim indexes refusing a minted name.
 *
 * The successor to `isLiveIndexViolation`, which matched `iteration.live` and
 * `iteration_one_live` and died with the index it named. Matched on the
 * driver's message for the same reason that one was: `node:sqlite` reports a
 * constraint failure as `ERR_SQLITE_ERROR` with SQLite's own text, and the text
 * is the only thing that says *which* constraint refused. The distinction still
 * matters -- an identifier rondo minted twice is a rondo defect, and a
 * duplicate iteration id is a different rondo defect -- but neither is
 * `atCapacity` any more, because capacity is now counted before the insert
 * rather than learned from a refusal.
 */
function isClaimCollision(error: unknown): boolean {
  return (
    isUniqueViolation(error) &&
    (error.message.includes("iteration.run_id") ||
      error.message.includes("iteration.topic_branch") ||
      error.message.includes("iteration.workspace") ||
      error.message.includes("iteration_holds_"))
  );
}

/**
 * Whether an error is the primary key refusing a second row under one id.
 *
 * Matched the same way as {@link isClaimCollision} and for the same reason:
 * the driver's message is the only thing that says which constraint refused.
 * Kept apart from it because the two are different facts with different
 * answers -- one is a conductor that is busy, the other is rondo minting an id
 * twice -- and `reserve` words each in the vocabulary its reader needs rather
 * than relaying the driver's.
 */
function isIdCollision(error: unknown): boolean {
  return isUniqueViolation(error) && error.message.includes("iteration.id");
}

/** `node:sqlite` reporting any `UNIQUE` constraint, before asking which one. */
function isUniqueViolation(error: unknown): error is Error {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed");
}

/** An error rendered for a `defect` reason, without assuming it is an `Error`. */
function describe(error: unknown): string {
  return error instanceof Error ? error.message : `the store threw ${String(error)}`;
}

/**
 * The read boundary: one row turned into a {@link ReadOutcome}, never a throw.
 *
 * This is the whole of what makes `read` and `readLive` total. A `StoreDefect`
 * from any decoder below becomes `unreadable` carrying its message, so the
 * interpreter can reach `stalled` and then `settle` the row instead of
 * rejecting; anything else -- a driver fault, a closed connection -- is left to
 * propagate, because that is not an iteration to stall but a process to stop.
 */
function decode(row: SqlRow, id: string): ReadOutcome {
  try {
    return { kind: "read", record: toRecord(row) };
  } catch (error) {
    if (error instanceof StoreDefect) {
      return { kind: "unreadable", id, reason: error.message };
    }
    throw error;
  }
}

/**
 * A row's own id, for naming a row that may not decode.
 *
 * Deliberately does not go through `requireText`: this is called on the reading
 * that is already known to be in trouble, and a decoder that threw here would
 * put the refusal back exactly where {@link decode} took it out of.
 */
function idOf(row: SqlRow): string {
  const value = row["id"];
  return typeof value === "string" ? value : "(an iteration row whose id is not text)";
}

/** One row, read into a record, or a refusal to read it at all. */
function toRecord(row: SqlRow): IterationRecord {
  return {
    id: requireText(row, "id"),
    status: requireStatus(row),
    request: requireText(row, "request"),
    plan: requirePlan(row),
    planDigest: requireMatchingDigest(row),
    attempts: requireInteger(row, "attempts"),
    runId: optionalText(row, "run_id"),
    topicBranch: optionalText(row, "topic_branch"),
    workspace: optionalText(row, "workspace"),
    identifiersSpent: requireInteger(row, "identifiers_spent"),
    continuoRevision: optionalText(row, "continuo_revision"),
    agentTypeDigest: optionalText(row, "agent_type_digest"),
    configDigest: optionalText(row, "config_digest"),
    contractDigest: optionalText(row, "contract_digest"),
    classification: optionalText(row, "classification"),
    classificationReason: optionalText(row, "classification_reason"),
    neutralRoleName: optionalText(row, "neutral_role_name"),
    continuoRole: optionalText(row, "continuo_role"),
    modelTier: optionalText(row, "model_tier"),
    model: optionalText(row, "model"),
    gateId: optionalText(row, "gate_id"),
    gateStage: optionalText(row, "gate_stage"),
    gateOutcome: optionalText(row, "gate_outcome"),
    sessionId: optionalText(row, "session_id"),
    sessionPath: optionalText(row, "session_path"),
    reason: optionalText(row, "reason"),
    createdAtMs: requireInteger(row, "created_at_ms"),
    updatedAtMs: requireInteger(row, "updated_at_ms"),
  };
}

/**
 * Whether a reading carries a measurement complete enough to stand behind a
 * `clear`.
 *
 * **Every field, not any field.** A digest with no tip commit cannot answer
 * D-0029 rule 10's staleness question and a tip commit with no digest cannot
 * answer rule 11's; a partial measurement is the shape a defect takes, and
 * accepting one would let the two rules pass each other in the dark. The counts
 * are checked for being non-negative rather than for being interesting: a
 * reading of a branch with nothing on it is a real reading, and `concerns` is
 * what says so.
 */
function hasEvidence(evidence: ReadingEvidence | null): boolean {
  return (
    evidence !== null &&
    evidence.baseRef !== "" &&
    evidence.baseCommit !== "" &&
    evidence.tipCommit !== "" &&
    evidence.materialDigest !== "" &&
    Number.isInteger(evidence.commitCount) &&
    evidence.commitCount >= 0 &&
    Number.isInteger(evidence.fileCount) &&
    evidence.fileCount >= 0
  );
}

/**
 * One `lap_reading` row, read back.
 *
 * **Total where `toRecord` refuses**, and the asymmetry is deliberate: an
 * iteration row that will not decode is an iteration nobody may act on, while a
 * reading that will not decode is a reading nobody may rely on -- and the
 * caller's response to the second is already the response to a missing one.
 * So a verdict this rondo does not know reads as `unavailable` naming what was
 * found, which is exactly what `publish` refuses on. A row edited by hand into
 * something unrecognisable therefore cannot become a pass.
 */
function toReading(row: SqlRow): LapReading {
  const verdict = row["verdict"];
  const known = verdict === "clear" || verdict === "concerns" || verdict === "unavailable";
  const evidence: ReadingEvidence | null =
    typeof row["base_ref"] === "string" &&
    typeof row["base_commit"] === "string" &&
    typeof row["tip_commit"] === "string" &&
    typeof row["material_digest"] === "string" &&
    typeof row["commit_count"] === "number" &&
    typeof row["file_count"] === "number"
      ? {
          baseRef: row["base_ref"],
          baseCommit: row["base_commit"],
          tipCommit: row["tip_commit"],
          materialDigest: row["material_digest"],
          commitCount: row["commit_count"],
          fileCount: row["file_count"],
        }
      : null;
  const findings = readFindings(row["findings"]);
  return {
    iterationId: idOfReading(row),
    readAtMs: typeof row["read_at_ms"] === "number" ? row["read_at_ms"] : 0,
    drafter: typeof row["drafter"] === "string" ? row["drafter"] : "(unrecorded)",
    verdict: known ? verdict : "unavailable",
    findings,
    evidence: known ? evidence : null,
    unavailableReason: known
      ? typeof row["unavailable_reason"] === "string"
        ? row["unavailable_reason"]
        : null
      : `the stored verdict is ${JSON.stringify(verdict)}, which this rondo does not know`,
  };
}

/** A reading row's iteration id, named defensively for the reason `idOf` is. */
function idOfReading(row: SqlRow): string {
  const value = row["iteration_id"];
  return typeof value === "string" ? value : "(a reading row whose iteration id is not text)";
}

/**
 * The findings column, which is canonical JSON of an array of strings.
 *
 * Anything else reads as a single finding saying so, rather than as none: a
 * findings list that silently became empty is a `concerns` row that looks like
 * it had nothing to say.
 */
function readFindings(value: unknown): readonly string[] {
  if (typeof value !== "string") {
    return Object.freeze(["(the stored findings are not text)"]);
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((entry) => typeof entry === "string")) {
      return Object.freeze([...(parsed as string[])]);
    }
  } catch {
    // Falls through to the same answer a wrong shape gets.
  }
  return Object.freeze([`(the stored findings do not read as a list of strings: ${value})`]);
}

/**
 * The status column, refused rather than coerced when it is not one of eleven.
 *
 * rondo is not the exclusive author of this database -- a person with `sqlite3`
 * is one edit away from any string at all -- so this is a real branch and not a
 * defensive one.
 */
function requireStatus(row: SqlRow): IterationStatus {
  const value = requireText(row, "status");
  if (!Object.hasOwn(KNOWN_STATUSES, value)) {
    throw new StoreDefect(
      `the iteration row's status is '${value}', which is not one of the statuses this rondo ` +
        "knows. The store does not guess: an unreadable row is a person's decision",
    );
  }
  return value as IterationStatus;
}

/** The plan column, parsed back into the record it was stored as. */
/**
 * The persisted digest, checked against the plan it claims to describe.
 *
 * D-0019 rule 4 persists the plan **verbatim beside** its digest, and the reason
 * it persists both is that a digest detects change. A decoder that read the two
 * independently would hand back a plan and a digest that do not describe each
 * other, and `resume()` would then drive a database, a workspace and a command
 * prefix somebody edited while reporting the digest of the plan nobody ran --
 * which is the one thing the pair was written down to prevent.
 *
 * So a mismatch is a row that will not decode. It is a `StoreDefect` rather than
 * a coercion for the same reason an unknown status is: rondo is not the
 * exclusive author of this database, and a row it cannot vouch for is one a
 * person has to look at, not one to proceed on.
 */
function requireMatchingDigest(row: SqlRow): string {
  const recorded = requireText(row, "plan_digest");
  const recomputed = planDigest(requirePlan(row));
  if (recorded !== recomputed) {
    throw new StoreDefect(
      `the iteration row's plan_digest is '${recorded}' and its plan digests to ` +
        `'${recomputed}'. The pair no longer describes one plan, so rondo cannot say under what ` +
        "plan this iteration ran.",
    );
  }
  return recorded;
}

function requirePlan(row: SqlRow): JsonRecord {
  const text = requireText(row, "plan");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new StoreDefect(`the iteration row's plan is not JSON: ${describe(error)}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new StoreDefect("the iteration row's plan is JSON, but it is not an object");
  }
  return parsed as JsonRecord;
}

function requireText(row: SqlRow, column: string): string {
  const value = row[column];
  if (typeof value !== "string") {
    throw new StoreDefect(`the iteration row's '${column}' is not text`);
  }
  return value;
}

function optionalText(row: SqlRow, column: string): string | null {
  const value = row[column];
  if (value === null || value === undefined) {
    return null;
  }
  return requireText(row, column);
}

/**
 * An integer column.
 *
 * `bigint` is refused rather than narrowed: `node:sqlite` hands back a `bigint`
 * for a value outside the double-safe range, and a timestamp or an attempt
 * count that far out is a row nobody should be reading past.
 */
function requireInteger(row: SqlRow, column: string): number {
  const value = row[column];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new StoreDefect(`the iteration row's '${column}' is not a whole number`);
  }
  return value;
}
