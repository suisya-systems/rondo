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
 * The import is **still type-position only**, and that is a property rather
 * than a leftover: the connection is handed in, so opening it -- and therefore
 * knowing where the file lives -- belongs to the composition root in
 * `src/access/conductor.ts` (D-0019 rule 2) rather than to the store. Nothing
 * here loads the experimental module on an `import` of the barrel.
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
import type { DatabaseSync } from "node:sqlite";

import { canonicalJson, planDigest } from "./plan.js";
import {
  type IterationFields,
  type IterationRecord,
  type IterationStatus,
  type JsonRecord,
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
  readonly nowMs: number;
}

/**
 * Why a reservation did not happen.
 *
 * `occupied` is the single-flight refusal and is an ordinary answer rather than
 * a fault: a conductor that is already conducting says so, and the caller tries
 * again when the live iteration ends.
 */
export type ReserveOutcome =
  | { readonly kind: "reserved"; readonly record: IterationRecord }
  | { readonly kind: "occupied"; readonly liveIterationId: string }
  | { readonly kind: "defect"; readonly reason: string };

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
  /** Assert the current status, then write the new one with its fields. */
  transition(
    id: string,
    from: IterationStatus,
    to: IterationStatus,
    fields: IterationFields,
    nowMs: number,
  ): Promise<TransitionOutcome>;
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
  /** The one non-terminal iteration; `absent` when every iteration is terminal. */
  readLive(): Promise<ReadOutcome>;
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
  runId: "run_id",
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
 * The schema, created idempotently on construction.
 *
 * `request` and `plan` are `NOT NULL` because `IterationRecord` says they are
 * never absent, and a column that permits what the type forbids is a schema
 * that disagrees with the code reading it. Everything the write order of
 * D-0019 rule 10 learns *later* -- the run id, the observed continuo revision,
 * the three digests, the gate -- is nullable, because it is legitimately
 * unknown at the moment the row is first written.
 *
 * `live` and the unique index over it are the invariant. Both carry the comment
 * below, and it is not decoration.
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
  live                  INTEGER GENERATED ALWAYS AS (
                          CASE WHEN status IN (${TERMINAL_SQL_LITERALS}) THEN NULL ELSE 1 END
                        ) VIRTUAL
);
-- rondo#8. **The "one" here is a lap-1 reduction, not the shape rondo is aiming
-- at.** The target is parallel delegated work at least equal to what the present
-- human organisation already runs concurrently; single-flight is what lap 1 can
-- defend, not what the host is for. The route from one to N is a **capacity
-- ledger, not a wider index**: D-0012's three conditions -- an allocator for the
-- (run id, topic branch, workspace) triple, continuo's lap-level serialisation
-- lifting, and a bound somebody sets and something enforces -- must be answered
-- before a second admission is safe, and they are tracked as rondo#8 and
-- continuo#167. This index and reserve()'s refusal are the two places the
-- constant 1 is burned into the schema, so the replacement sites are findable by
-- grep rather than by reading D-0019.
CREATE UNIQUE INDEX IF NOT EXISTS iteration_one_live
  ON iteration(live) WHERE live IS NOT NULL;
`;

/** Every column the reader expects, in the order the record spells them. */
const SELECT_COLUMNS = [
  "id",
  "status",
  "request",
  "plan",
  "plan_digest",
  "attempts",
  "run_id",
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
export function iterationStore(connection: DatabaseSync): IterationStore {
  connection.exec(SCHEMA);

  const readRow = (id: string): SqlRow | null => {
    const row = connection.prepare(`SELECT ${SELECT_COLUMNS} FROM iteration WHERE id = ?`).get(id);
    return row === undefined ? null : (row as SqlRow);
  };

  const readLiveRow = (): SqlRow | null => {
    const row = connection
      .prepare(`SELECT ${SELECT_COLUMNS} FROM iteration WHERE live IS NOT NULL`)
      .get();
    return row === undefined ? null : (row as SqlRow);
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

  return {
    async reserve(input: ReserveInput): Promise<ReserveOutcome> {
      try {
        const encoded = canonicalJson(input.plan);
        const digest = planDigest(input.plan);
        inTransaction(() => {
          connection
            .prepare(
              "INSERT INTO iteration (id, status, request, plan, plan_digest, attempts, " +
                "created_at_ms, updated_at_ms) VALUES (?, 'planned', ?, ?, ?, 1, ?, ?)",
            )
            // One attempt, not zero: the row exists because an attempt is being
            // made. `nextStep` compares the policy's ceiling against a *fresh*
            // iteration's zero attempts, which is the state before this row --
            // and `records.ts` says the persisted count is one in lap 1,
            // always, because there is no back-edge to raise it.
            .run(input.id, input.request, encoded, digest, input.nowMs, input.nowMs);
        });
        const row = readRow(input.id);
        if (row === null) {
          return {
            kind: "defect",
            reason: `the reserved row '${input.id}' was not there after its own commit`,
          };
        }
        return { kind: "reserved", record: toRecord(row) };
      } catch (error) {
        if (isLiveIndexViolation(error)) {
          // rondo#8: the single-flight refusal, and the second of the two
          // places the constant 1 lives (the first is `iteration_one_live` in
          // SCHEMA above). It is not a defect -- a conductor that is already
          // conducting saying so is an ordinary answer, and the caller retries
          // when the live iteration ends. When the ledger of D-0012's three
          // conditions replaces the index, this branch becomes "the bound is
          // reached" and both sites change together.
          const live = readLiveRow();
          if (live === null) {
            return {
              kind: "defect",
              reason:
                "the unique index refused a second live iteration and no live row could then " +
                "be read, so the store cannot say which iteration holds the conductor",
            };
          }
          return { kind: "occupied", liveIterationId: requireText(live, "id") };
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

    async readLive(): Promise<ReadOutcome> {
      const row = readLiveRow();
      // The id comes out of the row here rather than from an argument, and it
      // is read defensively: a row that will not decode may be a row whose own
      // `id` is not text, and the answer still has to say which row it means.
      return row === null ? { kind: "absent" } : decode(row, idOf(row));
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
 * Whether an error is the single-flight index refusing a second live row.
 *
 * Matched on the message because that is what the driver gives: `node:sqlite`
 * reports a constraint failure as `ERR_SQLITE_ERROR` with SQLite's own text,
 * and the text is what distinguishes `iteration.live` from `iteration.id`. The
 * distinction matters: a duplicate iteration id is rondo minting one twice,
 * which is a defect, and reporting it as `occupied` would tell an operator to
 * wait for an iteration that has nothing to do with theirs.
 */
function isLiveIndexViolation(error: unknown): boolean {
  return (
    isUniqueViolation(error) &&
    (error.message.includes("iteration.live") || error.message.includes("iteration_one_live"))
  );
}

/**
 * Whether an error is the primary key refusing a second row under one id.
 *
 * Matched the same way as {@link isLiveIndexViolation} and for the same reason:
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
