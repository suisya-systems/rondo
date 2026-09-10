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

import { canonicalJson, contentDigest, planDigest } from "./plan.js";
import {
  type CompositionDraft,
  type HumanDecisionDraft,
  type IterationFields,
  type IterationRecord,
  type IterationStatus,
  isApprovableKind,
  type JsonRecord,
  type LapReading,
  type LapReadingDraft,
  type OperatorAttention,
  type ProposalDraft,
  type ReadingEvidence,
  type RecordChange,
  SUSPENDED_STATUSES,
  TERMINAL_STATUSES,
  type UnconsumedDecision,
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
  /**
   * The iteration this one revises, or null for a first lap (D-0030 rule 1).
   *
   * Required rather than optional, so that every caller says which it is: a
   * lineage that can be left off is a lineage a caller forgets, and the row
   * that results is indistinguishable from a first lap for ever. `revise` is
   * the one caller that passes an id today.
   */
  readonly supersedesIterationId: string | null;
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
   * Every iteration that has reached a terminal status, oldest first.
   *
   * **D-0022's residual, discharged rather than carried** (D-0032 rule 11).
   * {@link IterationStore.read} needs an id a caller already has and
   * {@link IterationStore.readLive} filters terminal rows out, so the abandoned
   * iteration the advisory component exists to explain could not be found at
   * all. D-0029 rule 8 discharged the part its verdicts needed
   * ({@link IterationStore.terminalWithoutReading}); #39's "what changed",
   * #41's inbox and #40's breakdown all need the rest.
   *
   * A {@link ReadOutcome} per row for {@link IterationStore.readLive}'s reason:
   * one row that will not decode must not make the others unreadable.
   */
  terminalIterations(): Promise<readonly ReadOutcome[]>;
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
 * **`supersedes_iteration_id` is the one nullable column that is not an
 * "unknown yet"** (D-0030). It is written by `reserve()` or never, and null
 * means this iteration revises nothing rather than that its lineage has not
 * been established. It is **not** a foreign key, for `admission_refusal`'s
 * reason below: this database declares none at all, and one on a single column
 * would make the schema claim that referential integrity is enforced somewhere
 * it is not. What stands in its place is a check inside `reserve()`'s own
 * transaction, where the predecessor can be read under the write lock.
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
  supersedes_iteration_id TEXT,
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

-- D-0032. The advisory record: what was proposed, what was composed from it,
-- what a person answered, what that answer was spent on, where the operator's
-- reading stopped, and what was put in front of them or kept from them.
--
-- **Six append-only tables and no status column anywhere.** D-0022 rule 4's
-- grade is inherited exactly, and by the same means: immutability is a property
-- of the schema and of the absence of any writer that updates, not of a
-- trigger. There are no triggers in this file.
--
-- No foreign keys, for admission_refusal's reason above: this database
-- declares none at all, and adding some here would make the schema claim that
-- referential integrity is enforced somewhere it is not. What stands in their
-- place, where it matters, is a read inside the writer's own BEGIN IMMEDIATE
-- -- which is where D-0032 rule 5's refusal lives.
--
-- No indexes beyond the primary keys. Every query below is a full scan of a
-- table rondo has never yet written a row to, and an index chosen before a
-- measurement is a guess about a shape nobody has seen.

-- D-0022 rule 4, extended by D-0032 rules 1, 2, 3, 7 and 8.
--
-- payload and snapshot are held verbatim beside a digest of their own bytes,
-- for D-0019 rule 4's reason exactly: a digest detects that a source has moved
-- and does not hand back the rows the proposal was made from. The snapshot is
-- also what makes D-0032 rule 2 affordable -- a basis pointing into it renders
-- inline with no copy -- and it never carries a gate answer's body, whose one
-- home is continuo.
--
-- **The three CHECKs are the three properties D-0032 fixed and nothing more.**
-- candidate_contract_digest exists and is kept null (D-0022 rule 4's "null on
-- a proposal, always"), so the claim is enforced by the database rather than by
-- a sentence in a design document. derivation is non-null exactly when the
-- kind is explanation (rule 8). The two elevation columns are null together
-- (rule 7), because an observation with no elevator and an elevator with no
-- observation are each half a link.
--
-- **kind deliberately carries no CHECK.** It is a closed union whose
-- unrecognised members are refused by the *reader* (D-0022 rule 4) and, for the
-- one question that matters, by the writer of human_decision below: a kind
-- this rondo does not know is not in the approvable set, so it cannot be
-- answered. That is iteration.status's precedent, which is likewise unchecked
-- in the schema and refused at decode.
CREATE TABLE IF NOT EXISTS proposal (
  proposal_id                 TEXT    PRIMARY KEY,
  kind                        TEXT    NOT NULL,
  drafter                     TEXT    NOT NULL,
  payload                     TEXT    NOT NULL,
  proposal_digest             TEXT    NOT NULL,
  snapshot                    TEXT    NOT NULL,
  snapshot_digest             TEXT    NOT NULL,
  derivation                  TEXT,
  iteration_id                TEXT,
  supersedes_iteration_id     TEXT,
  supersedes_proposal_id      TEXT,
  predecessor_plan_digest     TEXT,
  predecessor_contract_digest TEXT,
  candidate_contract_digest   TEXT,
  agent_type_digest           TEXT,
  config_digest               TEXT,
  contract_digest             TEXT,
  continuo_revision           TEXT,
  cadenza_revision            TEXT,
  elevated_from_message_id    TEXT,
  elevated_by_actor_id        TEXT,
  created_at_ms               INTEGER NOT NULL,
  CHECK (candidate_contract_digest IS NULL),
  CHECK ((derivation IS NOT NULL) = (kind = 'explanation')),
  CHECK ((elevated_from_message_id IS NULL) = (elevated_by_actor_id IS NULL))
);

-- D-0022 rule 18. The contract the human was **shown**, written before it is
-- presented.
--
-- A proposal carries candidate *inputs*; this is the thing on the screen, and it
-- must outlive both a refusal and a crash. contract holds the fields as
-- issued so contract_digest can be recomputed rather than trusted (D-0020
-- rule 4 fact 1), and cadenza_revision records which pin composed it -- the
-- pin's mobility is a fact, having fired once already.
CREATE TABLE IF NOT EXISTS composition (
  composition_id              TEXT    PRIMARY KEY,
  proposal_id                 TEXT    NOT NULL,
  contract                    TEXT    NOT NULL,
  contract_digest             TEXT    NOT NULL,
  supersedes_contract_digest  TEXT,
  cadenza_revision            TEXT    NOT NULL,
  composed_at_ms              INTEGER NOT NULL
);

-- D-0022 rule 9 and D-0032 rules 5 and 6. What a person answered.
--
-- **outcome is why this is a row and not an absence** (D-0032 rule 6):
-- "declined" and "never answered" are different facts, and without the
-- distinction #41's inbox cannot tell what is waiting on the operator from what
-- the operator has already settled. approved is a reference into
-- composition.contract_digest and is non-null exactly on an approval -- a
-- refusal approves no digest, and a digest with no approval behind it would be
-- an issuance waiting to happen.
--
-- gate_id and gate_transition_seq are route G's reference to continuo's own
-- record and are null together on route S, where no gate exists. They are a
-- reference and never a copy: the body is continuo's, and A-8 gives that fact
-- exactly one home.
--
-- actor_id is the approver and recorded_by is the surface. They are two
-- columns because they are two facts, and a surface that recorded itself as the
-- approver would be the one substitution this table exists to make visible.
CREATE TABLE IF NOT EXISTS human_decision (
  decision_id                 TEXT    PRIMARY KEY,
  proposal_id                 TEXT    NOT NULL,
  outcome                     TEXT    NOT NULL,
  approved                    TEXT,
  predecessor                 TEXT,
  actor_id                    TEXT    NOT NULL,
  recorded_by                 TEXT    NOT NULL,
  gate_id                     TEXT,
  gate_transition_seq         INTEGER,
  decided_at_ms               INTEGER NOT NULL,
  CHECK (outcome IN ('approved', 'declined')),
  CHECK ((approved IS NOT NULL) = (outcome = 'approved')),
  CHECK ((gate_id IS NULL) = (gate_transition_seq IS NULL))
);

-- advisory.md 6.4 / D-0022 rule 16. One continuo transition backs at most one
-- decision.
--
-- Without it two decision rows may name one gate answer -- two surfaces, two
-- browser tabs, one person answering once -- and each could then be spent
-- independently, which is the single-use guarantee of D-0022 rule 9 defeated
-- one level above the primary key that holds it. A person answered once, so
-- there is one answer.
--
-- Partial, over the route-G rows only. Route S has no gate to name and its two
-- columns are null together, and SQLite already treats NULLs in a unique index
-- as distinct -- but the predicate is written out rather than inherited, for
-- CLAIM_INDEXES' reason: a row that names no transition claims none, and
-- several such rows are not a collision.
CREATE UNIQUE INDEX IF NOT EXISTS human_decision_gate_transition
  ON human_decision(gate_id, gate_transition_seq) WHERE gate_id IS NOT NULL;

-- advisory.md 6.3 / D-0022 rule 9. Single use is a transaction, not a check.
--
-- decision_id is the **primary key**, so a second issuance against one answer
-- collides on it and is refused by the database rather than by a check somebody
-- remembered to write -- and human_decision stays a table nothing ever
-- updates. An earlier draft set a consumed_by column on the decision, which
-- would have made "immutable" a word this schema used about a row it rewrites.
CREATE TABLE IF NOT EXISTS decision_consumption (
  decision_id                 TEXT    PRIMARY KEY,
  contract_digest             TEXT    NOT NULL,
  consumed_at_ms              INTEGER NOT NULL
);

-- D-0032 rule 9. The durable last-look mark: one row per look.
--
-- viewed_at_ms is **the bound the render's own query used**, sampled before
-- the render reads and written after it, not the clock at the end. Writing the
-- end clock would lose every row committed while the render was running: it was
-- never displayed, and its timestamp precedes the mark, so the "what changed"
-- query would omit it for ever. The failure this shape accepts is showing
-- something twice.
--
-- **Its ceiling is named rather than hidden.** A timestamp cursor is not
-- lossless: these are the *caller's* clocks, taken before the writer enters
-- BEGIN IMMEDIATE, so a writer that samples before the render's bound and
-- commits after the render's query has produced a row the operator never saw
-- and whose timestamp is already behind the mark. The upgrade path is a
-- per-table commit-ordered cursor over rowid; it is not taken now because it
-- makes this table's shape a function of the set of record kinds, and because
-- rondo has one operator, one surface and one writer at a time.
--
-- **Per-item read/unread flags are refused**: one row per look answers the same
-- question as N rows per item, and a per-item flag is a mutable column on an
-- immutable record.
CREATE TABLE IF NOT EXISTS operator_view (
  actor_id                    TEXT    NOT NULL,
  viewed_at_ms                INTEGER NOT NULL
);

-- D-0032 rule 10. Both sides of the silence, in one table.
--
-- One table rather than two because the numerator and the denominator have to
-- come from the same place: a withheld-only table makes the count of what *was*
-- put to the operator somebody else's problem, and the only candidate is
-- human_decision, which counts answers and not presentations.
--
-- subject_id is nullable because the most common withholding has nothing to
-- carry one: it was never composed into a proposal at all.
--
-- **rule_name is required on the withheld side, and it is the point of the
-- table.** The CHECK refuses a null or an empty one from any writer, including
-- one editing the file by hand; the writer below refuses a blank one and says
-- why in rondo's own words.
CREATE TABLE IF NOT EXISTS operator_attention (
  at_ms                       INTEGER NOT NULL,
  subject_kind                TEXT    NOT NULL,
  subject_id                  TEXT,
  disposition                 TEXT    NOT NULL,
  rule_name                   TEXT,
  CHECK (disposition IN ('presented', 'withheld')),
  CHECK (disposition = 'presented' OR (rule_name IS NOT NULL AND rule_name <> ''))
);

-- D-0036 rule 1. A presentation is counted once per subject, not once per
-- render.
--
-- The inbox is looked at repeatedly across gaps (#41 section 4), so counting at
-- each render makes one unanswered proposal, looked at twenty times over a
-- morning, report twenty presentations -- and D-0032 rule 10's GROUP BY stops
-- reading as "six were put to you, forty were not" the moment its numerator
-- counts renders and its denominator counts subjects.
--
-- Partial and over the presented side only, in the shape D-0023's claims
-- already use. A repeat is a **no-op and not a refusal** (the writer's
-- ON CONFLICT DO NOTHING): the invariant every presented subject has a row
-- still holds, so a re-render is not the case explain's presentedUncounted arm
-- exists to report. SQLite treating NULLs as distinct here is the behaviour
-- wanted rather than one tolerated -- the most common withholding carries no
-- subject_id at all, and those must never collide with each other.
--
-- **The ceiling, stated rather than hidden.** *When* a subject was first shown
-- is preserved; *how often* is not, and is not recoverable afterwards. If that
-- question ever has to be answered, this rule is what moves -- not a column
-- added beside it.
CREATE UNIQUE INDEX IF NOT EXISTS operator_attention_presented_subject
  ON operator_attention(subject_kind, subject_id) WHERE disposition = 'presented';
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
 * The columns a database created before the entry that added them does not
 * have.
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
 * **D-0030 is the second entry to add a column, and it is the evidence for that
 * paragraph rather than a strain on it.** `supersedes_iteration_id` is one
 * nullable column on the same table, needing no back-fill -- a database written
 * before it holds no revision it could record, because `revise` had nowhere to
 * write one -- so the list grows by a line and the mechanism does not grow at
 * all. That is what D-0027 rule 9 was waiting for when it deferred the lineage
 * "to the entry that adds a migration to the store".
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
  supersedes_iteration_id: "TEXT",
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
  "supersedes_iteration_id",
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

  /** {@link immediateTransaction}, bound to this store's connection. */
  const inTransaction = <T>(body: () => T): T => immediateTransaction(connection, body);

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
          // **The lineage is checked here, under the write lock, because that
          // is the only place it can be** (D-0030 rule 3). This database
          // declares no foreign keys, so nothing else would refuse a
          // predecessor that is not there -- and a lineage naming a row nobody
          // can read is worse than the branch-name inference it replaced,
          // because it *looks* like a record. A row superseding itself is the
          // same failure with a shorter cycle. Both are rondo defects rather
          // than a person's mistake: the only caller passes a row it has
          // already read.
          const lineage = lineageDefect(connection, input);
          if (lineage !== null) {
            return { kind: "defect", reason: lineage };
          }
          connection
            .prepare(
              "INSERT INTO iteration (id, status, request, plan, plan_digest, attempts, " +
                "run_id, topic_branch, workspace, identifiers_spent, supersedes_iteration_id, " +
                "created_at_ms, updated_at_ms) VALUES (?, 'planned', ?, ?, ?, 1, ?, ?, ?, 0, " +
                "?, ?, ?)",
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
              input.supersedesIterationId,
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

    async terminalIterations(): Promise<readonly ReadOutcome[]> {
      // `live IS NULL` is the generated column's own answer to "has this row
      // reached a terminal status", read rather than restated: the terminal set
      // is written once, in `records.ts`.
      return connection
        .prepare(
          `SELECT ${SELECT_COLUMNS} FROM iteration WHERE live IS NULL ` +
            "ORDER BY created_at_ms, id",
        )
        .all()
        .map((row) => decode(row as SqlRow, idOf(row as SqlRow)));
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
 * Run `body` inside `BEGIN IMMEDIATE`, committing it or rolling it back.
 *
 * `BEGIN IMMEDIATE` rather than the default deferred transaction for the
 * reason continuo gives on its own admission path: under a deferred
 * transaction the write lock is taken at the *first write*, which leaves a
 * window in which two readers have both decided they may proceed. Taking the
 * write lock at `BEGIN` closes it, and the serialisation is then the
 * database's -- it holds across two processes, not merely across two callers
 * in one.
 *
 * At module scope rather than inside {@link iterationStore} because
 * {@link advisoryRecord} needs the same guarantee for D-0032 rule 5's refusal,
 * and a second copy of this function would be a second answer to "what does
 * this store do about concurrency".
 */
/**
 * Whether a write to the advisory record landed, or why it did not.
 *
 * **`refused` and `defect` are two different answers and the split is
 * load-bearing.** A refusal is this store declining to record something D-0032
 * says must not be recorded -- an answer to a proposal that binds nothing, a
 * withholding whose rule cannot be named -- and it is a fact about the caller's
 * request, not a fault. A defect is the store failing. A caller that collapsed
 * them would report a policy refusal as an outage, and the refusals are the
 * whole of what rules 5 and 10 buy.
 */
export type RecordOutcome =
  | { readonly kind: "recorded" }
  | { readonly kind: "refused"; readonly reason: string }
  | { readonly kind: "defect"; readonly reason: string };

/**
 * The advisory record, as D-0032 leaves it.
 *
 * A second port over the same connection rather than more methods on
 * {@link IterationStore}, because they answer different questions for different
 * callers: the loop drives one iteration and never reads a proposal, and the
 * operator's surface reads proposals and drives no iteration. The one method
 * that belongs to the iteration table -- {@link IterationStore.terminalIterations}
 * -- stayed there, beside the two reads it completes.
 *
 * **There is no reader for a proposal, a composition or a decision here, and
 * that is scope rather than an omission.** D-0032 rule 12 names the DDL, the
 * writer refusals of rules 5 and 10, rule 5's planted case and rule 11's three
 * queries as this work, in that order; reading a row back into a rendered shape
 * is the surface's, and D-0032 rule 2's reader refusal -- a basis whose form is
 * not one of the closed union's members -- belongs with it. What ships here is
 * what the entry listed.
 */
export interface AdvisoryRecord {
  /** Append one immutable proposal (D-0022 rule 4). */
  recordProposal(draft: ProposalDraft): Promise<RecordOutcome>;
  /** Append the contract that is about to be presented (D-0022 rule 18). */
  recordComposition(draft: CompositionDraft): Promise<RecordOutcome>;
  /**
   * Append what a person answered -- **or refuse it** (D-0032 rules 5 and 6).
   *
   * The refusal is the rule: the proposal's `kind` is read inside this method's
   * own `BEGIN IMMEDIATE` and an answer naming a kind that binds nothing is
   * refused there. Authority is a function of `kind` alone, and this is where
   * that stops being a sentence.
   */
  recordDecision(draft: HumanDecisionDraft): Promise<RecordOutcome>;
  /**
   * Spend one decision, once (`advisory.md` 6.3).
   *
   * The primary key on `decision_consumption.decision_id` is what makes a
   * second issuance impossible, and it is the database's refusal rather than a
   * check somebody remembered to write. **The delegation row joins this
   * transaction when `D-0020` rule 4's table lands**; until then the
   * consumption is the whole of what rondo has to write, and the guarantee it
   * carries is unchanged.
   */
  consumeDecision(
    decisionId: string,
    contractDigest: string,
    nowMs: number,
  ): Promise<RecordOutcome>;
  /**
   * Append the mark for one look (D-0032 rule 9).
   *
   * `viewedAtMs` is **the bound the render's own query used**, sampled before
   * the render read anything and written after it finished. Passing the clock
   * at the end instead loses every row committed while the render was running.
   */
  recordView(actorId: string, viewedAtMs: number): Promise<RecordOutcome>;
  /**
   * Where one actor's reading stopped, or null if they have never looked.
   *
   * The `t` that {@link AdvisoryRecord.changedSince} is asked with, which is
   * what makes rule 9's two columns worth storing. `MAX` rather than the last
   * row inserted: the marks are the caller's clocks and this asks how far the
   * reading has reached, which is the largest of them and not the newest row.
   */
  lastView(actorId: string): Promise<number | null>;
  /**
   * Append one side of the silence -- **or refuse it** (D-0032 rule 10).
   *
   * A `withheld` row whose `ruleName` is absent or blank is refused: a
   * withholding whose rule cannot be named is a judgement with no policy behind
   * it, and *"suppressed 40"* is a number where *"suppressed 40, of which 31 by
   * the duplicate-delivery rule"* is a record.
   */
  recordAttention(row: OperatorAttention): Promise<RecordOutcome>;
  /** Every approval that was never spent (D-0022 rule 19, D-0032 rule 11). */
  unconsumedDecisions(): Promise<readonly UnconsumedDecision[]>;
  /**
   * Every record that landed at or after `tMs`, oldest first (D-0032 rule 11).
   *
   * **Inclusive of the bound**, which is rule 9's shape and not an off-by-one:
   * the mark is the upper limit the render's own queries used, so a row bearing
   * exactly that timestamp may or may not have been displayed. The failure this
   * accepts is showing something twice; the failure it avoids is losing
   * something for ever.
   */
  changedSince(tMs: number): Promise<readonly RecordChange[]>;
}

/**
 * Every table a change can land in, beside how it spells its own identity and
 * its own clock.
 *
 * Written once, as data, because {@link AdvisoryRecord.changedSince} is a
 * `UNION ALL` over all of them and a list maintained in prose beside a list
 * maintained in SQL is two lists. The rule for membership is **total rather
 * than curated**: every append-only table in this schema that carries a
 * caller-clock timestamp is here, so a record kind added later is one row here
 * rather than a judgement about whether the operator would want to see it.
 *
 * **`operator_view` is the one exclusion, and it is the cursor itself.** A mark
 * is written by the render at the end of the render, so including it would make
 * every look report itself as a change the operator has not seen.
 *
 * `iteration` contributes `updated_at_ms` rather than `created_at_ms`: it is
 * the one mutable row in the store, and what changed about it is when it last
 * moved.
 */
const CHANGE_SOURCES = Object.freeze([
  { kind: "iteration", table: "iteration", id: "id", at: "updated_at_ms" },
  {
    kind: "admission_refusal",
    table: "admission_refusal",
    id: "CAST(rowid AS TEXT)",
    at: "refused_at_ms",
  },
  { kind: "lap_reading", table: "lap_reading", id: "iteration_id", at: "read_at_ms" },
  { kind: "proposal", table: "proposal", id: "proposal_id", at: "created_at_ms" },
  { kind: "composition", table: "composition", id: "composition_id", at: "composed_at_ms" },
  { kind: "human_decision", table: "human_decision", id: "decision_id", at: "decided_at_ms" },
  {
    kind: "decision_consumption",
    table: "decision_consumption",
    id: "decision_id",
    at: "consumed_at_ms",
  },
  { kind: "operator_attention", table: "operator_attention", id: "subject_id", at: "at_ms" },
] as const);

/**
 * {@link AdvisoryRecord.changedSince}'s one statement, built from
 * {@link CHANGE_SOURCES}.
 *
 * The only interpolation is table and column names chosen from the frozen tuple
 * above -- never anything a caller supplies -- which is the same licence
 * `TERMINAL_SQL_LITERALS` takes and under the same rule: `tMs` is a bound
 * parameter, once per branch.
 */
const CHANGES_SINCE_SQL = `${CHANGE_SOURCES.map(
  (source) =>
    `SELECT '${source.kind}' AS kind, ${source.id} AS id, ${source.at} AS at_ms ` +
    `FROM ${source.table} WHERE ${source.at} >= ?`,
).join(" UNION ALL ")} ORDER BY at_ms, kind, id`;

/**
 * The advisory record over an open connection.
 *
 * Applies {@link SCHEMA} for {@link iterationStore}'s reason -- every statement
 * in it is `IF NOT EXISTS`, so opening either port over either database is
 * idempotent and neither has to be opened first. It does **not** run
 * {@link migrate}: that is the `iteration` table's column history, and nothing
 * here reads a column the migration adds.
 */
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
 * that one command could share it. SQLite serialises the writers itself; what
 * this gives up is the busy timeout nothing in this tree sets anyway, so a
 * concurrent writer is reported as a defect rather than waited on.
 */
export function openAdvisoryRecord(databasePath: string): AdvisoryRecord {
  return advisoryRecord(new DatabaseSync(databasePath));
}

export function advisoryRecord(connection: DatabaseSync): AdvisoryRecord {
  connection.exec(SCHEMA);

  /**
   * Run one insert, translating a throw into an outcome.
   *
   * Bare rather than wrapped in `BEGIN IMMEDIATE`, and that is not a shortcut:
   * a single statement takes the write lock for its own duration, so there is
   * no window between a decision and a write to serialise. `recordDecision` is
   * the one writer here that reads before it writes, and it is the one that
   * takes a transaction.
   */
  const insert = (sql: string, values: readonly (string | number | null)[]): RecordOutcome => {
    try {
      connection.prepare(sql).run(...values);
      return { kind: "recorded" };
    } catch (error) {
      return { kind: "defect", reason: describe(error) };
    }
  };

  return {
    async recordProposal(draft: ProposalDraft): Promise<RecordOutcome> {
      let payload: string;
      let snapshot: string;
      try {
        // Encoded before the insert and outside it: `canonicalJson` refuses a
        // value it cannot round-trip, and a proposal whose payload cannot be
        // encoded is rondo handing the store something rondo should not have
        // built. That is a defect and not a refusal.
        payload = canonicalJson(draft.payload);
        snapshot = canonicalJson(draft.snapshot);
      } catch (error) {
        return { kind: "defect", reason: describe(error) };
      }
      return insert(
        "INSERT INTO proposal (proposal_id, kind, drafter, payload, proposal_digest, snapshot, " +
          "snapshot_digest, derivation, iteration_id, supersedes_iteration_id, " +
          "supersedes_proposal_id, predecessor_plan_digest, predecessor_contract_digest, " +
          "agent_type_digest, config_digest, contract_digest, continuo_revision, " +
          "cadenza_revision, elevated_from_message_id, elevated_by_actor_id, created_at_ms) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          draft.proposalId,
          draft.kind,
          draft.drafter,
          payload,
          contentDigest(draft.payload),
          snapshot,
          contentDigest(draft.snapshot),
          draft.derivation,
          draft.iterationId,
          draft.supersedesIterationId,
          draft.supersedesProposalId,
          draft.predecessorPlanDigest,
          draft.predecessorContractDigest,
          draft.agentTypeDigest,
          draft.configDigest,
          draft.contractDigest,
          draft.continuoRevision,
          draft.cadenzaRevision,
          draft.elevatedFromMessageId,
          draft.elevatedByActorId,
          draft.createdAtMs,
        ],
      );
      // `candidate_contract_digest` is named by no column list above, so the
      // insert leaves it NULL and the schema's `CHECK` keeps it there
      // (D-0022 rule 4).
    },

    async recordComposition(draft: CompositionDraft): Promise<RecordOutcome> {
      let contract: string;
      try {
        contract = canonicalJson(draft.contract);
      } catch (error) {
        return { kind: "defect", reason: describe(error) };
      }
      return insert(
        "INSERT INTO composition (composition_id, proposal_id, contract, contract_digest, " +
          "supersedes_contract_digest, cadenza_revision, composed_at_ms) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          draft.compositionId,
          draft.proposalId,
          contract,
          // cadenza's digest, stored as it was given. **Not recomputed here**:
          // the digest a human approves is cadenza's own, and a second one
          // taken over this module's rendering would be a second authority for
          // the one value D-0020 rule 4 fact 1 says must be recomputable rather
          // than trusted. The contract is beside it so a reader can do exactly
          // that recomputation.
          draft.contractDigest,
          draft.supersedesContractDigest,
          draft.cadenzaRevision,
          draft.composedAtMs,
        ],
      );
    },

    async recordDecision(draft: HumanDecisionDraft): Promise<RecordOutcome> {
      try {
        return immediateTransaction<RecordOutcome>(connection, () => {
          // **The read and the write in one `BEGIN IMMEDIATE`, and that is the
          // whole of D-0032 rule 5.** The same question asked before the
          // transaction would be a check with a window in it: the write lock is
          // what makes the kind that was read the kind that is still there when
          // the row lands.
          const row = connection
            .prepare("SELECT kind FROM proposal WHERE proposal_id = ?")
            .get(draft.proposalId);
          if (row === undefined) {
            return {
              kind: "refused",
              reason:
                `a human decision must name a proposal, and '${draft.proposalId}' is not a row ` +
                "in this store: D-0032 rule 5 makes authority a function of the proposal's " +
                "kind, and there is no kind here to read",
            };
          }
          const proposalKind = String((row as SqlRow)["kind"]);
          if (!isApprovableKind(proposalKind)) {
            // **The refusal fires for an unrecognised kind too, and by the same
            // line.** A kind this rondo does not know is not in the approvable
            // set, so D-0022 rule 4's "refuse rather than guess at" is reached
            // without a second spelling of the union -- and the one answer that
            // must never be produced is "approvable".
            return {
              kind: "refused",
              reason:
                `proposal '${draft.proposalId}' has kind '${proposalKind}', which binds nothing ` +
                "and cannot be answered: D-0032 rule 5 makes authority a function of kind " +
                "alone, and an explanation is material a person reads rather than a thing a " +
                "person approves",
            };
          }
          connection
            .prepare(
              "INSERT INTO human_decision (decision_id, proposal_id, outcome, approved, " +
                "predecessor, actor_id, recorded_by, gate_id, gate_transition_seq, " +
                "decided_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .run(
              draft.decisionId,
              draft.proposalId,
              draft.outcome,
              draft.approved,
              draft.predecessor,
              draft.actorId,
              draft.recordedBy,
              draft.gateId,
              draft.gateTransitionSeq,
              draft.decidedAtMs,
            );
          return { kind: "recorded" };
        });
      } catch (error) {
        return { kind: "defect", reason: describe(error) };
      }
    },

    async consumeDecision(
      decisionId: string,
      contractDigest: string,
      nowMs: number,
    ): Promise<RecordOutcome> {
      try {
        // **The read and the insert in one `BEGIN IMMEDIATE`**, for
        // `recordDecision`'s reason: an approval checked in one transaction and
        // spent in another is a check with a window in it.
        return immediateTransaction<RecordOutcome>(connection, () => {
          const row = connection
            .prepare("SELECT outcome, approved FROM human_decision WHERE decision_id = ?")
            .get(decisionId) as SqlRow | undefined;
          if (row === undefined) {
            // **Not a harmless dangling row.** `decision_consumption` is what
            // `unconsumedDecisions` subtracts, so a consumption naming nothing
            // is a subtraction from a set it was never in -- and the day the id
            // is minted the approval it names is born already spent.
            return {
              kind: "refused",
              reason:
                `there is no human decision '${decisionId}' in this store to spend: a ` +
                "consumption is the record of an issuance against an answer, and an answer " +
                "that was never recorded cannot have authorised one",
            };
          }
          if (String(row["outcome"]) !== "approved") {
            // D-0032 rule 6 in as many words: a refusal writes no
            // `decision_consumption` row and no delegation row, which is what
            // D-0022 rule 18 assumes when it says the composition must outlive
            // a refusal.
            return {
              kind: "refused",
              reason:
                `the human decision '${decisionId}' declined, and a refusal authorises ` +
                "nothing: D-0032 rule 6 gives a declined answer its own row precisely so that " +
                "it is not an absence somebody can spend",
            };
          }
          const approved = String(row["approved"]);
          if (approved !== contractDigest) {
            // **The digest is what a person approved** (cadenza D-0036), so
            // issuing a different one is issuing something nobody answered for
            // -- and it would spend the real approval on the way past, removing
            // it from `unconsumedDecisions` for ever.
            return {
              kind: "refused",
              reason:
                `the human decision '${decisionId}' approved '${approved}' and the issuance ` +
                `names '${contractDigest}': the digest is what a person approved, so a ` +
                "contract they did not see is not one this answer can be spent on",
            };
          }
          connection
            .prepare(
              "INSERT INTO decision_consumption (decision_id, contract_digest, consumed_at_ms) " +
                "VALUES (?, ?, ?)",
            )
            .run(decisionId, contractDigest, nowMs);
          return { kind: "recorded" };
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          // The database's refusal, said in rondo's words rather than the
          // driver's. One human decision authorises at most one issuance
          // (D-0022 rule 9), and this is the collision that enforces it.
          return {
            kind: "refused",
            reason:
              `the human decision '${decisionId}' has already been spent, and one decision ` +
              "authorises at most one issuance: D-0022 rule 9 makes single use the store's " +
              "guarantee, and it is this row's primary key that holds it",
          };
        }
        return { kind: "defect", reason: describe(error) };
      }
    },

    async recordView(actorId: string, viewedAtMs: number): Promise<RecordOutcome> {
      return insert("INSERT INTO operator_view (actor_id, viewed_at_ms) VALUES (?, ?)", [
        actorId,
        viewedAtMs,
      ]);
    },

    async lastView(actorId: string): Promise<number | null> {
      const row = connection
        .prepare("SELECT MAX(viewed_at_ms) AS mark FROM operator_view WHERE actor_id = ?")
        .get(actorId) as SqlRow | undefined;
      const mark = row === undefined ? null : row["mark"];
      // `MAX` over no rows is one row holding NULL rather than no row at all,
      // so "never looked" arrives here as a null column and not as an absent
      // result. Both are answered the same way, because both are the same fact.
      return mark === null || mark === undefined ? null : Number(mark);
    },

    async recordAttention(row: OperatorAttention): Promise<RecordOutcome> {
      if (row.disposition === "withheld" && (row.ruleName ?? "").trim() === "") {
        // **D-0032 rule 10's writer refusal.** The schema's `CHECK` already
        // refuses a null or an empty string, which covers a row inserted from
        // outside this code; this covers the blank one it cannot see and, more
        // to the point, says what happened in the vocabulary the caller reads.
        return {
          kind: "refused",
          reason:
            "an operator_attention row that withheld something must name the rule that " +
            "withheld it: D-0032 rule 10 refuses a withholding whose rule cannot be named, " +
            "because that is a judgement with no policy behind it and it is the named rule " +
            "that turns a suppressed count into a record",
        };
      }
      // **D-0036 rule 1: a second presentation of one subject stores nothing and
      // reports success.** The conflict target names the partial index rather
      // than being left bare, so a unique constraint added here later is a
      // defect the caller hears about instead of a write this silently drops.
      return insert(
        "INSERT INTO operator_attention (at_ms, subject_kind, subject_id, disposition, " +
          "rule_name) VALUES (?, ?, ?, ?, ?) " +
          "ON CONFLICT (subject_kind, subject_id) WHERE disposition = 'presented' DO NOTHING",
        [row.atMs, row.subjectKind, row.subjectId, row.disposition, row.ruleName],
      );
    },

    async unconsumedDecisions(): Promise<readonly UnconsumedDecision[]> {
      // **`outcome = 'approved'` is D-0032 rule 6 and not a filter chosen
      // here.** A refusal consumes nothing by design, so without this clause
      // every declined proposal would be reported as an approval that never
      // ran -- which is the opposite of what D-0022 rule 19 asks the query for.
      return connection
        .prepare(
          "SELECT decision_id, proposal_id, approved, actor_id, decided_at_ms " +
            "FROM human_decision WHERE outcome = 'approved' AND decision_id NOT IN " +
            "(SELECT decision_id FROM decision_consumption) ORDER BY decided_at_ms, decision_id",
        )
        .all()
        .map((row) => {
          const record = row as SqlRow;
          return {
            decisionId: String(record["decision_id"]),
            proposalId: String(record["proposal_id"]),
            approved: String(record["approved"]),
            actorId: String(record["actor_id"]),
            decidedAtMs: Number(record["decided_at_ms"]),
          };
        });
    },

    async changedSince(tMs: number): Promise<readonly RecordChange[]> {
      return connection
        .prepare(CHANGES_SINCE_SQL)
        .all(...CHANGE_SOURCES.map(() => tMs))
        .map((row) => {
          const record = row as SqlRow;
          const id = record["id"];
          return {
            kind: String(record["kind"]),
            // Null rather than an empty string, and it is
            // `operator_attention.subject_id` that produces it: the most common
            // withholding was never composed into anything with an id, and a
            // reader that saw `""` would go looking for a row named that.
            id: id === null || id === undefined ? null : String(id),
            atMs: Number(record["at_ms"]),
          };
        });
    },
  };
}

function immediateTransaction<T>(connection: DatabaseSync, body: () => T): T {
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
}

/**
 * Why a reservation's lineage cannot be written, or null when it can.
 *
 * **Read inside the caller's transaction**, which is what makes the answer
 * worth anything: `BEGIN IMMEDIATE` holds the write lock, so a predecessor
 * that exists when this looks still exists when the row is inserted. The same
 * question asked before the transaction would be a check with a window in it.
 *
 * Rows are never deleted by anything in this file -- `settle` and `transition`
 * both write statuses -- so "the predecessor is not there" means it was never
 * there, and that is a defect in the caller rather than a race it lost.
 */
function lineageDefect(connection: DatabaseSync, input: ReserveInput): string | null {
  const predecessor = input.supersedesIterationId;
  if (predecessor === null) {
    return null;
  }
  if (predecessor === input.id) {
    return (
      `iteration '${input.id}' was reserved as a revision of itself, and an iteration is not ` +
      "its own predecessor: a revision is a second lap, reserved under an id of its own"
    );
  }
  const found = connection
    .prepare("SELECT 1 AS present FROM iteration WHERE id = ?")
    .get(predecessor);
  if (found === undefined) {
    return (
      `iteration '${input.id}' was reserved as a revision of '${predecessor}', which is not a ` +
      "row in this database. rondo will not write a lineage that names nothing: a reference " +
      "no reader can follow is weaker than the branch names it was added to replace"
    );
  }
  return null;
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
    supersedesIterationId: optionalText(row, "supersedes_iteration_id"),
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
