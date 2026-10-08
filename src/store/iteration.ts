/**
 * The iteration store over a connection: reserving, transitioning, reading and
 * settling iterations, and the lane ledger's reads and writes beside them.
 *
 * Split out of `src/store/sqlite.ts` (D-0171), which still owns the driver and
 * opens the connection this is handed.
 */

import {
  basisForms,
  CHANGED,
  claimBases,
  claimHead,
  highestNumber,
  insertClaim,
  insertReservations,
  isPublishRelease,
  isUnclaimed,
  LANE_LEDGER_AUTHOR,
  laneAdmission,
  ledgerLines,
  lineageLaps,
  lineRecord,
  numberAdmission,
  openLines,
  releaseIfEnded,
  releaseReservations,
} from "./claims.js";
import type {
  AppendReadingOutcome,
  BoundName,
  ClosingLap,
  HeldStart,
  HostPolicy,
  IterationStore,
  LaneCompareInput,
  LaneCompareOutcome,
  LaneLineReadOutcome,
  LaneMoveInput,
  LaneMoveOutcome,
  LaneReleaseInput,
  LaneReleaseOutcome,
  LedgerLine,
  LineLanding,
  NumberReservation,
  ReadOutcome,
  ReserveInput,
  ReserveOutcome,
  SettleOutcome,
  TransitionOutcome,
} from "./contract.js";
import {
  changedDropped,
  claimCovers,
  claimMove,
  lineShape,
  mayBeOpen,
  normalizeClaim,
  quiescent,
  sharedPaths,
} from "./lanes.js";
import { canonicalJson, planDigest } from "./plan.js";
import {
  type GateAnswer,
  type IterationFields,
  type IterationStatus,
  isModelReadingDrafter,
  type LaneHolder,
  type LapReading,
  type LapReadingDraft,
  MODEL_READING_DRAFTER_PREFIX,
  type Occupancy,
  type OperatorVerificationClaim,
  type PerformingLap,
} from "./records.js";
import {
  assignmentsFor,
  decode,
  describe,
  gradedJson,
  hasEvidence,
  idOf,
  immediateTransaction,
  isClaimCollision,
  isIdCollision,
  lineageOf,
  optionalNumber,
  optionalText,
  readingsOf,
  requireStatus,
  requireText,
  type SqlRow,
  type StoreConnection,
  StoreDefect,
  toRecord,
  toVerificationClaim,
} from "./rows.js";
import { CLAIM_INDEXES, migrate, SCHEMA } from "./schema.js";
import { lapBudgetCapFor, requestRefusal, spendDecision, spendScope } from "./scope.js";

/** A `held_start` outcome naming the wait a form joined (`joinHeldStart`). */
const JOINED = "joined:";

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
  "request_message_id",
  "worker_provider",
  "worker_provider_chosen",
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
  "permission_denials",
  "lap_commands",
  "lap_cost_usd",
  "lap_turns",
  "lap_duration_ms",
  "lap_budget_cap_usd",
  "published_remote",
  "reason",
  "failure_kind",
  // D-0092: read from beside the gate answer, never from a column of the row.
  "(SELECT answer FROM gate_answer WHERE gate_answer.iteration_id = iteration.id " +
    "AND gate_answer.gate_id = iteration.gate_id) AS gate_answer",
  "(SELECT actor_id FROM gate_answer WHERE gate_answer.iteration_id = iteration.id " +
    "AND gate_answer.gate_id = iteration.gate_id) AS gate_answer_actor",
  "created_at_ms",
  "updated_at_ms",
].join(", ");

/**
 * A store backed by an open connection, handed in as a {@link StoreConnection}.
 *
 * The schema is created on construction and the connection is not otherwise
 * configured: journal mode, busy timeout and file location are the opener's,
 * because they are facts about the file and not about the schema.
 */
export function iterationStore(connection: StoreConnection, policy: HostPolicy): IterationStore {
  connection.exec(SCHEMA);
  migrate(connection);
  // **The walk down a lineage is an index lookup, not a scan** (D-0073 rule
  // 12): the page reads every line's laps on each redraw (`laneLedger`), and
  // `lineageOf`'s downward step joins on this column.
  connection.exec(
    "CREATE INDEX IF NOT EXISTS iteration_by_supersedes ON iteration(supersedes_iteration_id)",
  );
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
    refusal: {
      readonly bound: BoundName | "laneClaim";
      readonly limit: number;
      readonly occupancy: number;
      readonly holders?: readonly LaneHolder[];
    },
  ): void => {
    try {
      connection
        .prepare(
          "INSERT INTO admission_refusal (refused_at_ms, request, bound_name, bound, occupancy, " +
            "holders) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(
          input.nowMs,
          input.request,
          refusal.bound,
          refusal.limit,
          refusal.occupancy,
          refusal.holders === undefined
            ? null
            : canonicalJson(
                refusal.holders.map((holder) => ({
                  lineageId: holder.lineageId,
                  sharedPaths: [...holder.sharedPaths],
                })),
              ),
        );
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
    // D-0029 V-11's second clause, as D-0065 2.2 gave it a field: a model
    // drafter's `clear` also needs rondo's digest of what it delivered, and one
    // without it is refused in the same way and for the same reason.
    // **Only `clear` is refused; a `concerns` without the digest is kept as it
    // came.** A `clear` claims the material was read and nothing found, and
    // that claim is what needs the delivered bytes behind it. Findings claim no
    // coverage: dropping or demoting them because the digest is missing would
    // lose what the reviewer did raise, which D-0065 5.3 refuses, so the
    // asymmetry is the rule rather than a gap in it.

    const undelivered =
      draft.verdict === "clear" &&
      isModelReadingDrafter(draft.drafter) &&
      (draft.evidence?.deliveredDigest ?? "") === "";
    const evidence =
      draft.verdict === "clear" && (!hasEvidence(draft.evidence) || undelivered)
        ? null
        : draft.evidence;
    const verdict = draft.verdict === "clear" && evidence === null ? "unavailable" : draft.verdict;
    const unavailableReason =
      verdict === draft.verdict
        ? draft.unavailableReason
        : undelivered && hasEvidence(draft.evidence)
          ? "a model reader's 'clear' arrived with no digest of the material rondo delivered, so " +
            "the store refused it: D-0029 rule 11 admits a model drafter's clear only beside " +
            "rondo's own digest of the bytes it handed over"
          : "a 'clear' reading arrived with no measurement of what was read, so the store refused " +
            "it: D-0029 rule 11 admits a clear verdict only beside rondo's own reading of the work";
    connection
      .prepare(
        "INSERT INTO lap_reading (iteration_id, read_at_ms, drafter, verdict, findings, " +
          "base_ref, base_commit, tip_commit, material_digest, commit_count, file_count, " +
          "unavailable_reason, graded, delivered_digest) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
        draft.graded === undefined ? null : canonicalJson(draft.graded.map(gradedJson)),
        evidence?.deliveredDigest ?? null,
      );
  };

  const readingRows = (iterationId: string): readonly LapReading[] =>
    readingsOf(connection, iterationId);

  return {
    async reserve(input: ReserveInput): Promise<ReserveOutcome> {
      if (input.spend !== null && input.scopeSpend !== null) {
        // **Refused before the transaction opens**, not beside the spends: a
        // body that returned this after `spendDecision` had inserted its row
        // would commit a consumption for an admission that never happened.
        return {
          kind: "defect",
          reason:
            `iteration '${input.id}' was reserved spending both a human decision and a scope ` +
            "decision, and an admission is authorised by one approval: naming two is a defect " +
            "in the caller, not a stricter admission (D-0066 rule 5.2)",
        };
      }
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
          // **The lane claim, beside the two counts and under the same lock**
          // (D-0073 rules 3.1 and 3.6): the counts answer how many, this
          // answers which. Tested before the request and the spends so a
          // refusal consumes nothing, and written after the row below, both
          // or neither (rule 2.4).
          const lane = laneAdmission(connection, input);
          if (lane.kind === "defect" || lane.kind === "refused") {
            return lane.kind === "defect"
              ? lane
              : { kind: "laneRefused", paths: lane.paths, holders: lane.holders };
          }
          // **The numbers, beside the claim and for the claim's reason**
          // (D-0098 rule 3.3): tested before the spends so a refusal consumes
          // nothing, and written after the row below, both or neither.
          const numbers = numberAdmission(connection, input);
          if (numbers.kind !== "write" && numbers.kind !== "none") {
            return numbers;
          }
          // **A successor's request link is its predecessor's, read here**
          // (rondo#195): a revision or a retry is the same request continued,
          // so the link is derived from the row it supersedes rather than
          // taken from the caller. `linked` is the input with that link, and
          // everything below reads it.
          const linked: ReserveInput = {
            ...input,
            requestMessageId: inheritedRequest(connection, input),
          };
          // **The request link, under the same lock and before the spend**
          // (D-0061 rule 4), so a refusal spends no approval. Unlike the
          // lineage it is a refusal and not a defect: the id is a person's.
          const request = requestRefusal(connection, linked.requestMessageId);
          if (request !== null) {
            return { kind: "requestRefused", reason: request };
          }
          // **The approval is spent here, before the row, and in the row's own
          // transaction** (D-0022 rule 9, `advisory.md` 6.3). Under rule 17 a
          // retry is an ordinary admission rather than a successor contract, so
          // *this* row is the issuance the consumption is written beside --
          // which makes "approved something that never ran" and "ran on an
          // approval nobody subtracted" two states the ledger cannot reach,
          // rather than two a caller has to avoid reaching. Before the insert
          // rather than after only so that a refusal leaves the transaction
          // with nothing in it to roll back.
          if (input.spend !== null) {
            const refusal = spendDecision(connection, input.spend, input.nowMs);
            if (refusal !== null) {
              return { kind: "unapproved", reason: refusal };
            }
          }
          // **The scope's spend, in the same place and for the same reason**
          // (D-0066 rules 3.1 and 4.3): its store-side tests are re-made under
          // this write lock and its consumption row lands beside the iteration
          // row, both or neither. A refusal writes nothing, and says which
          // test refused as data (`scopeRefused`), for rule 4.4's stop.
          if (input.scopeSpend !== null) {
            const refusal = spendScope(connection, linked, input.scopeSpend);
            if (refusal !== null) {
              return refusal;
            }
          }
          // rondo#462: the choice, and then the name the lap actually runs
          // under. The successor of a lap that chose a provider keeps that
          // choice, exactly as it keeps the request link -- a revision or a
          // retry is the same request continued, and the choice was the
          // person's for the request rather than for one lap of it. The caller
          // may still name one, which is what lets a re-lap be put on the
          // other provider. Where nobody chose, the host's default is settled
          // onto the row *now*, so that what this lap ran on stays readable
          // after the host's default moves.
          const chosenWorker = input.workerProvider ?? inheritedWorkerProvider(connection, input);
          const ranOnWorker = chosenWorker ?? input.hostWorkerProvider ?? null;
          connection
            .prepare(
              "INSERT INTO iteration (id, status, request, plan, plan_digest, attempts, " +
                "run_id, topic_branch, workspace, identifiers_spent, supersedes_iteration_id, " +
                "request_message_id, worker_provider, worker_provider_chosen, created_at_ms, " +
                "updated_at_ms) " +
                "VALUES (?, 'planned', ?, ?, ?, 1, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)",
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
              linked.requestMessageId,
              ranOnWorker,
              // NULL and not 0 where no name was settled at all: the column
              // says what the provider beside it is, and there is nothing
              // beside it to say anything about.
              ranOnWorker === null ? null : chosenWorker === null ? 0 : 1,
              input.nowMs,
              input.nowMs,
            );
          if (lane.kind === "write") {
            insertClaim(connection, lane.write, input.nowMs);
          }
          if (numbers.kind === "write") {
            insertReservations(connection, numbers, input.id, input.nowMs);
          }
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
        if (outcome.kind === "laneRefused") {
          recordRefusal(input, {
            bound: "laneClaim",
            limit: 0,
            occupancy: new Set(outcome.holders.flatMap((holder) => holder.sharedPaths)).size,
            holders: outcome.holders,
          });
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
          // **A line that ends here gives up its paths here** (D-0073 rule
          // 4.3), in the transaction that wrote the status, both or neither.
          if (to === "abandoned" || to === "failed") {
            releaseIfEnded(connection, id, nowMs);
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

    async laneLine(iterationId: string): Promise<LaneLineReadOutcome> {
      try {
        const laps = lineageLaps(connection, iterationId);
        if (laps === null) {
          return { kind: "defect", reason: `the lineage of '${iterationId}' passes its bound` };
        }
        const root = laps[0];
        if (root === undefined) {
          return { kind: "absent" };
        }
        const head = claimHead(connection, root.id);
        return {
          kind: "read",
          line: {
            lineageId: root.id,
            claim: head === null ? null : { claimId: head.claimId, paths: head.paths },
            laps: laps.flatMap((lap) => {
              const row = readRow(lap.id);
              return row === null ? [] : [toRecord(row)];
            }),
          },
        };
      } catch (error) {
        return { kind: "defect", reason: describe(error) };
      }
    },

    async releaseLane(input: LaneReleaseInput): Promise<LaneReleaseOutcome> {
      try {
        return inTransaction<LaneReleaseOutcome>(() => {
          const laps = lineageLaps(connection, input.iterationId);
          if (laps === null) {
            return {
              kind: "defect",
              reason: `the lineage of '${input.iterationId}' passes its bound`,
            };
          }
          const root = laps[0];
          if (root === undefined) {
            return { kind: "refused", reason: `there is no iteration '${input.iterationId}'` };
          }
          const shape = lineShape(laps);
          if (shape.inFlight) {
            return {
              kind: "refused",
              reason:
                "a lap of this line has not ended, so its claim is not released; a line at its " +
                "gate gives up its paths when it is abandoned (D-0073 rule 9.3)",
            };
          }
          const head = claimHead(connection, root.id);
          if (input.takenOver !== null) {
            const readOver = [...input.takenOver.lapIds].sort().join("\n");
            const now = laps
              .map((lap) => lap.id)
              .sort()
              .join("\n");
            if (
              (head === null ? null : head.claimId) !== input.takenOver.claimId ||
              readOver !== now
            ) {
              return {
                kind: "refused",
                reason:
                  "the line moved after its landing was read (a claim row or a lap was written), " +
                  "so the reading is stale and nothing is released (D-0073 rule 7)",
              };
            }
          }
          // A line from before the ledger holds `/` only while a lap is in
          // flight (`openLines`), which this press refuses above: past that it
          // holds nothing, like a line already released. **A line released
          // when its pull request opened is the one exception** (D-0114): its
          // work is still owed a landing, so the landing, the merge or the
          // person's press writes the row that ends it, over the publish's.
          // Nor is a line that declared nothing and changed nothing yet: it is
          // open, holding no paths (D-0160), and a release ends it.
          const overPublish =
            head !== null &&
            head.paths.length === 0 &&
            ((isPublishRelease(claimBases(connection, head.claimId)) &&
              !isPublishRelease(input.bases)) ||
              isUnclaimed(claimBases(connection, head.claimId)));
          if (head === null || (head.paths.length === 0 && !overPublish)) {
            return {
              kind: "refused",
              reason: "this line holds no paths, so there is nothing to release",
            };
          }
          insertClaim(
            connection,
            {
              lineageId: root.id,
              repository: head.repository,
              paths: [],
              supersedesClaimId: head.claimId,
              authorKind: input.authorKind,
              authorId: input.authorId,
              bases: input.bases,
            },
            input.nowMs,
          );
          // A landed line's numbers are in the record and stay its (D-0098
          // rule 3.7); so are a published line's, which its pull request
          // carries (D-0114). Any other release gives them up here (rule 3.4).
          if (!input.landed && !isPublishRelease(input.bases)) {
            releaseReservations(connection, root.id, input.bases, input.nowMs);
          }
          return { kind: "released", lineageId: root.id };
        });
      } catch (error) {
        return { kind: "defect", reason: describe(error) };
      }
    },

    async moveClaim(input: LaneMoveInput): Promise<LaneMoveOutcome> {
      try {
        return inTransaction<LaneMoveOutcome>(() => {
          const laps = lineageLaps(connection, input.iterationId);
          if (laps === null) {
            return {
              kind: "defect",
              reason: `the lineage of '${input.iterationId}' passes its bound`,
            };
          }
          const root = laps[0];
          if (root === undefined) {
            return { kind: "refused", reason: `there is no iteration '${input.iterationId}'` };
          }
          const head = claimHead(connection, root.id);
          const now = laps
            .map((lap) => lap.id)
            .sort()
            .join("\n");
          if (
            head?.claimId !== input.takenOver.claimId ||
            [...input.takenOver.lapIds].sort().join("\n") !== now
          ) {
            return { kind: "stale" };
          }
          // A line that holds nothing has nothing to move: released (taking
          // paths back is a redo's allocation, rule 2.6), or declared nothing
          // and is claimed by its gate (D-0160).
          if (head.paths.length === 0) {
            return { kind: "refused", reason: "this line holds no paths to change" };
          }
          const move = claimMove(head.paths, input.paths);
          if (move.kind === "refused") {
            return move;
          }
          const shape = lineShape(laps);
          if (move.added.length > 0) {
            // Only work still going can change a path it takes: a finished
            // line taking more would hold it from others for nothing.
            if (!shape.inFlight) {
              return {
                kind: "refused",
                reason: "every lap of this line has ended, so it takes no more paths",
              };
            }
            const record = lineRecord(connection, root.id);
            const holders = openLines(connection, head.repository, root.id).flatMap((line) => {
              const shared = sharedPaths(move.added, line.paths, record);
              return shared.length === 0
                ? []
                : [{ lineageId: line.lineageId, sharedPaths: shared }];
            });
            if (holders.length > 0) {
              return { kind: "held", holders };
            }
          }
          if (move.dropped.length > 0) {
            if (!mayBeOpen(shape)) {
              return { kind: "refused", reason: "this line is not open" };
            }
            // Unread is a line that was still running when the press read it.
            if (!quiescent(laps) || input.changed === null) {
              return { kind: "busy" };
            }
            const kept = changedDropped(head.paths, move.paths, input.changed);
            if (kept.length > 0) {
              return { kind: "kept", paths: kept };
            }
          }
          // A line whose claim its gates write (D-0160) keeps that after the
          // person moves it: its next gate still claims what it changed.
          const forms = basisForms(claimBases(connection, head.claimId));
          insertClaim(
            connection,
            {
              lineageId: root.id,
              repository: head.repository,
              paths: move.paths,
              supersedesClaimId: head.claimId,
              authorKind: "operator",
              authorId: input.authorId,
              bases: [
                { form: "iteration", iterationId: input.iterationId },
                ...(move.added.length > 0 ? [{ form: "widened" }] : []),
                ...(move.dropped.length > 0 ? [{ form: "narrowed" }] : []),
                ...(forms.includes("changed") ? [CHANGED] : []),
              ],
              why: head.why,
            },
            input.nowMs,
          );
          return { kind: "moved", lineageId: root.id, added: move.added, dropped: move.dropped };
        });
      } catch (error) {
        return { kind: "defect", reason: describe(error) };
      }
    },

    async compareLane(input: LaneCompareInput): Promise<LaneCompareOutcome> {
      try {
        const root = lineageOf(connection, input.iterationId)?.[0];
        if (root === undefined) {
          return { kind: "absent" };
        }
        const head = claimHead(connection, root);
        // A line from before the ledger holds `/` while a lap is in flight
        // (`openLines`), so nothing it changed is outside its claim.
        if (head === null) {
          return { kind: "compared", lineageId: root, unheld: [], held: [] };
        }
        // The decision record is a shared-append path (D-0098 rule 3.5):
        // changing it is neither outside a claim nor a collision; the gate's
        // number test reads it instead (rule 3.6).
        const record = lineRecord(connection, root);
        const outside = input.paths.filter(
          (path) => path !== record && !claimCovers(head.paths, path),
        );
        const held = openLines(connection, head.repository, root).flatMap((line) => {
          const shared = sharedPaths(outside, line.paths);
          return shared.length === 0 ? [] : [{ lineageId: line.lineageId, sharedPaths: shared }];
        });
        const heldPaths = new Set(held.flatMap((holder) => holder.sharedPaths));
        return {
          kind: "compared",
          lineageId: root,
          unheld: [...new Set(outside.filter((path) => !heldPaths.has(path)))].sort(),
          held,
        };
      } catch (error) {
        return { kind: "defect", reason: describe(error) };
      }
    },

    async laneLedger(): Promise<readonly LedgerLine[]> {
      return ledgerLines(connection);
    },

    async sendLapBudget(iterationId: string, nowMs: number): Promise<number | null> {
      return immediateTransaction(connection, () => {
        const cap = lapBudgetCapFor(connection, iterationId, policy.maxOccupying);
        if (cap !== null) {
          connection
            .prepare("UPDATE iteration SET lap_budget_cap_usd = ?, updated_at_ms = ? WHERE id = ?")
            .run(cap, nowMs, iterationId);
        }
        return cap;
      });
    },

    async markLapProcess(iterationId, mark): Promise<void> {
      if ("lapPid" in mark) {
        connection
          .prepare("UPDATE iteration SET lap_pid = ? WHERE id = ? AND status = 'performing'")
          .run(mark.lapPid, iterationId);
        return;
      }
      connection
        .prepare(
          "UPDATE iteration SET driver_host = ?, driver_pid = ?, lap_pid = NULL " +
            "WHERE id = ? AND status = 'performing'",
        )
        .run(mark.driverHost, mark.driverPid, iterationId);
    },

    async performingLaps(): Promise<readonly PerformingLap[]> {
      return (
        connection
          .prepare(
            "SELECT id, driver_host, driver_pid, lap_pid, updated_at_ms FROM iteration " +
              "WHERE status = 'performing' ORDER BY created_at_ms, id",
          )
          .all() as SqlRow[]
      ).map((row) => ({
        iterationId: String(row["id"]),
        driverHost: optionalText(row, "driver_host"),
        driverPid: optionalNumber(row, "driver_pid"),
        lapPid: optionalNumber(row, "lap_pid"),
        updatedAtMs: Number(row["updated_at_ms"]),
      }));
    },

    async markPublishedRemote(iterationId: string, remote: string, nowMs: number): Promise<void> {
      connection
        .prepare("UPDATE iteration SET published_remote = ?, updated_at_ms = ? WHERE id = ?")
        .run(remote, nowMs, iterationId);
    },

    async numberReservations(iterationId: string): Promise<readonly NumberReservation[]> {
      const root = lineageOf(connection, iterationId)?.[0];
      if (root === undefined) {
        return [];
      }
      return (
        connection
          .prepare(
            "SELECT r.number, EXISTS (SELECT 1 FROM number_reservation s " +
              "WHERE s.releases_reservation_id = r.reservation_id) AS released " +
              "FROM number_reservation r WHERE r.lineage_id = ? " +
              "AND r.releases_reservation_id IS NULL ORDER BY r.number",
          )
          .all(root) as SqlRow[]
      ).map((row) => ({ number: Number(row["number"]), released: Number(row["released"]) === 1 }));
    },

    async highestReserved(repository: string, record: string): Promise<number> {
      return highestNumber(connection, repository, record);
    },

    async closingLapOf(iterationId: string): Promise<ClosingLap | null> {
      const row = connection
        .prepare(
          "SELECT iteration_id, predecessor_id, read_tip_commit, reading_read_at_ms, findings " +
            "FROM closing_lap WHERE iteration_id = ?",
        )
        .get(iterationId) as SqlRow | undefined;
      if (row === undefined) {
        return null;
      }
      return Object.freeze({
        iterationId: String(row["iteration_id"]),
        predecessorId: String(row["predecessor_id"]),
        readTipCommit: String(row["read_tip_commit"]),
        readingReadAtMs: Number(row["reading_read_at_ms"]),
        findings: Object.freeze((JSON.parse(String(row["findings"])) as number[]).map(Number)),
      });
    },

    async recordHeldStart(held: HeldStart): Promise<boolean> {
      const key = [held.requestMessageId, held.scopeDecisionId, held.planDigest];
      // Another row of the plan that waits, or whose wait already started it.
      const taken =
        "EXISTS (SELECT 1 FROM held_start WHERE request_message_id = ? AND " +
        "scope_decision_id = ? AND plan_digest = ? AND iteration_id <> ? AND " +
        "(settled_at_ms IS NULL OR outcome = 'started'))";
      return immediateTransaction(connection, () => {
        // Its own wait, ended without a start, waits again (Codex round 2).
        connection
          .prepare(
            "UPDATE held_start SET settled_at_ms = NULL, outcome = NULL, held_at_ms = ? " +
              "WHERE iteration_id = ? AND settled_at_ms IS NOT NULL AND outcome <> 'started' " +
              `AND NOT ${taken}`,
          )
          .run(held.heldAtMs, held.iterationId, ...key, held.iterationId);
        connection
          .prepare(
            "INSERT OR IGNORE INTO held_start (iteration_id, request_message_id, " +
              "scope_decision_id, plan_digest, repository, held_at_ms, worker_provider) " +
              `SELECT ?, ?, ?, ?, ?, ?, ? WHERE NOT ${taken}`,
          )
          .run(
            held.iterationId,
            ...key,
            held.repository,
            held.heldAtMs,
            held.workerProvider ?? null,
            ...key,
            held.iterationId,
          );
        return (
          connection
            .prepare("SELECT 1 FROM held_start WHERE iteration_id = ? AND settled_at_ms IS NULL")
            .get(held.iterationId) !== undefined
        );
      });
    },

    async joinHeldStart(held: HeldStart, joinedTo: string): Promise<void> {
      connection
        .prepare(
          "INSERT INTO held_start (iteration_id, request_message_id, " +
            "scope_decision_id, plan_digest, repository, held_at_ms, settled_at_ms, outcome, " +
            "worker_provider) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) " +
            // The form's own wait ended without a start (Codex round 5): it
            // joins now. One still waiting, or one that started, is left.
            "ON CONFLICT(iteration_id) DO UPDATE SET settled_at_ms = excluded.settled_at_ms, " +
            "outcome = excluded.outcome WHERE held_start.settled_at_ms IS NOT NULL AND " +
            "held_start.outcome <> 'started'",
        )
        .run(
          held.iterationId,
          held.requestMessageId,
          held.scopeDecisionId,
          held.planDigest,
          held.repository,
          held.heldAtMs,
          held.heldAtMs,
          `${JOINED}${joinedTo}`,
          held.workerProvider ?? null,
        );
    },

    async heldStartJoin(iterationId: string): Promise<string | null> {
      const row = connection
        .prepare("SELECT outcome FROM held_start WHERE iteration_id = ?")
        .get(iterationId) as SqlRow | undefined;
      const outcome = row === undefined ? "" : String(row["outcome"] ?? "");
      return outcome.startsWith(JOINED) ? outcome.slice(JOINED.length) : null;
    },

    async heldStarts(): Promise<readonly HeldStart[]> {
      return (
        connection
          .prepare(
            "SELECT iteration_id, request_message_id, scope_decision_id, plan_digest, repository, " +
              "held_at_ms, worker_provider FROM held_start WHERE settled_at_ms IS NULL " +
              "ORDER BY held_at_ms, iteration_id",
          )
          .all() as SqlRow[]
      ).map((row) =>
        Object.freeze({
          iterationId: String(row["iteration_id"]),
          requestMessageId: String(row["request_message_id"]),
          scopeDecisionId: String(row["scope_decision_id"]),
          planDigest: String(row["plan_digest"]),
          repository: String(row["repository"]),
          heldAtMs: Number(row["held_at_ms"]),
          workerProvider: optionalText(row, "worker_provider"),
        }),
      );
    },

    async settleHeldStart(iterationId: string, outcome: string, nowMs: number): Promise<void> {
      connection
        .prepare(
          "UPDATE held_start SET settled_at_ms = ?, outcome = ? " +
            "WHERE iteration_id = ? AND settled_at_ms IS NULL",
        )
        .run(nowMs, outcome, iterationId);
    },

    async claimChanged(input) {
      try {
        return inTransaction(() => {
          const root = lineageOf(connection, input.iterationId)?.[0];
          const head = root === undefined ? null : claimHead(connection, root);
          if (root === undefined || head === null) {
            return { kind: "unchanged" } as const;
          }
          const forms = basisForms(claimBases(connection, head.claimId));
          if (!forms.includes("unclaimed") && !forms.includes("changed")) {
            return { kind: "unchanged" } as const;
          }
          // Under the lock, the paths another open line holds are left out
          // again: that line keeps them (rule 3), and the collision is the
          // conflict fix's (D-0105). So is the decision record, which is
          // shared-append (D-0098 rule 3.5).
          const record = lineRecord(connection, root);
          const others = openLines(connection, head.repository, root);
          const taken = input.paths.filter(
            (path) =>
              path !== record &&
              !claimCovers(head.paths, path) &&
              others.every((line) => sharedPaths([path], line.paths).length === 0),
          );
          if (taken.length === 0) {
            return { kind: "unchanged" } as const;
          }
          const claim = normalizeClaim([...head.paths, ...taken]);
          if (claim.kind === "refused") {
            return { kind: "defect", reason: claim.reason } as const;
          }
          insertClaim(
            connection,
            {
              lineageId: root,
              repository: head.repository,
              paths: claim.paths,
              supersedesClaimId: head.claimId,
              authorKind: "drafter",
              authorId: LANE_LEDGER_AUTHOR,
              bases: [{ form: "iteration", iterationId: input.iterationId }, CHANGED],
            },
            input.nowMs,
          );
          return { kind: "claimed", lineageId: root, paths: [...taken].sort() } as const;
        });
      } catch (error) {
        return { kind: "defect", reason: describe(error) };
      }
    },

    async landingOf(iterationId: string): Promise<LineLanding | null> {
      const root = lineageOf(connection, iterationId)?.[0];
      if (root === undefined) {
        return null;
      }
      // A release is a successor: a line's root is never one, even an
      // `unclaimed` root carrying the landing it was admitted on (D-0160).
      const rows = connection
        .prepare(
          "SELECT bases, created_at_ms FROM lane_claim WHERE lineage_id = ? AND paths = '[]' " +
            "AND supersedes_claim_id IS NOT NULL ORDER BY created_at_ms DESC, claim_id DESC",
        )
        .all(root) as SqlRow[];
      for (const row of rows) {
        const bases: unknown = JSON.parse(String(row["bases"]));
        const landing = Array.isArray(bases)
          ? (bases as unknown[]).find(
              (basis): basis is { branch: string; commit: string } =>
                typeof basis === "object" &&
                basis !== null &&
                (basis as Record<string, unknown>)["form"] === "landing" &&
                typeof (basis as Record<string, unknown>)["branch"] === "string" &&
                typeof (basis as Record<string, unknown>)["commit"] === "string",
            )
          : undefined;
        if (landing !== undefined) {
          return {
            branch: landing.branch,
            commit: landing.commit,
            atMs: Number(row["created_at_ms"]),
          };
        }
      }
      return null;
    },

    async readLive(): Promise<readonly ReadOutcome[]> {
      // The id comes out of each row here rather than from an argument, and it
      // is read defensively: a row that will not decode may be a row whose own
      // `id` is not text, and the answer still has to say which row it means.
      return readLiveRows().map((row) => decode(row, idOf(row)));
    },

    async occupancy(): Promise<Occupancy> {
      return { occupying: occupancyOf("occupying"), live: occupancyOf("live") };
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

    async appendReading(
      iterationId: string,
      draft: LapReadingDraft,
      nowMs: number,
    ): Promise<AppendReadingOutcome> {
      // **Refused before the transaction, and as a defect rather than a row.**
      // Only a model drafter may append: the deterministic reading lands with
      // the `awaiting_human` transaction or not at all (D-0029 rule 8), and a
      // deterministic row appended afterwards would reopen exactly the window
      // `transition`'s `reading` parameter exists to make unreachable. A
      // `graded` array whose length differs from `findings` is not parallel to
      // them, and the reader would silently drop it (`readGraded`), so the
      // severities would vanish after they were written; refusing here keeps
      // that from being a write that looks like it succeeded.
      if (!isModelReadingDrafter(draft.drafter)) {
        return {
          kind: "defect",
          reason:
            `appendReading admits only a model drafter, and '${draft.drafter}' is not one: ` +
            "the deterministic reading lands with its transition (D-0029 rule 8).",
        };
      }
      if (draft.graded !== undefined && draft.graded.length !== draft.findings.length) {
        return {
          kind: "defect",
          reason:
            `the reading grades ${String(draft.graded.length)} findings and carries ` +
            `${String(draft.findings.length)}; graded must be parallel to findings (D-0065 2.2).`,
        };
      }
      try {
        return inTransaction<AppendReadingOutcome>(() => {
          if (readRow(iterationId) === null) {
            return { kind: "absent" };
          }
          writeReading(iterationId, nowMs, draft);
          return { kind: "appended" };
        });
      } catch (error) {
        return { kind: "defect", reason: describe(error) };
      }
    },

    async recordVerificationClaim(
      iterationId: string,
      actorId: string,
      claim: string,
      nowMs: number,
    ): Promise<void> {
      connection
        .prepare(
          "INSERT INTO operator_verification_claim (iteration_id, claimed_at_ms, actor_id, " +
            "claim) VALUES (?, ?, ?, ?)",
        )
        .run(iterationId, nowMs, actorId, claim);
    },

    async recordGateAnswer(
      iterationId: string,
      gateId: string,
      answer: GateAnswer,
      actorId: string,
      nowMs: number,
    ): Promise<void> {
      connection
        .prepare(
          "INSERT OR IGNORE INTO gate_answer (iteration_id, gate_id, answer, actor_id, " +
            "answered_at_ms) VALUES (?, ?, ?, ?, ?)",
        )
        .run(iterationId, gateId, answer, actorId, nowMs);
    },

    async verificationClaimsFor(
      iterationId: string,
    ): Promise<readonly OperatorVerificationClaim[]> {
      return connection
        .prepare(
          "SELECT iteration_id, claimed_at_ms, actor_id, claim FROM " +
            "operator_verification_claim WHERE iteration_id = ? ORDER BY claimed_at_ms, rowid",
        )
        .all(iterationId)
        .map((row) => toVerificationClaim(row as SqlRow));
    },

    async terminalWithoutReading(): Promise<readonly string[]> {
      // `live IS NULL` is the generated column's own answer to "has this row
      // reached a terminal status", read rather than restated: the terminal set
      // is written once, in `records.ts`, and a second spelling here is exactly
      // what D-0019 rule 10 rejected shape A for.
      // **A model reader's rows do not count** (D-0065 2.6): a model row is
      // appended after the transition and does not ride it, so a lap whose
      // transition-carried reading never landed is still the fail-open this
      // detects, however many model rows sit beside it. The predicate is
      // `isModelReadingDrafter`'s, spelled in SQL; excluding model rows rather
      // than listing deterministic ones keeps the interpreter's `rondo/none`
      // (a reading recorded as unavailable) counting as a reading that landed.
      return connection
        .prepare(
          "SELECT id FROM iteration WHERE live IS NULL AND id NOT IN " +
            "(SELECT iteration_id FROM lap_reading WHERE NOT (length(drafter) > ? AND " +
            "substr(drafter, 1, ?) = ?)) " +
            "ORDER BY created_at_ms, id",
        )
        .all(
          MODEL_READING_DRAFTER_PREFIX.length,
          MODEL_READING_DRAFTER_PREFIX.length,
          MODEL_READING_DRAFTER_PREFIX,
        )
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
        const changes = inTransaction(() => {
          const settled = connection
            .prepare(
              "UPDATE iteration SET status = 'abandoned', reason = ?, updated_at_ms = ? " +
                "WHERE id = ? AND live IS NOT NULL",
            )
            .run(reason, nowMs, id).changes;
          // D-0073 rule 4.3, as in `transition`: the escape hatch ends a line
          // as surely as a transition does. **But nothing may refuse it**, so
          // a claim it cannot read stays held -- fail closed, and the person's
          // release press ends it -- rather than the row staying live.
          if (Number(settled) > 0) {
            try {
              releaseIfEnded(connection, id, nowMs);
            } catch {
              // The claim stays in force; the settle stands.
            }
          }
          return settled;
        });
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

function lineageDefect(connection: StoreConnection, input: ReserveInput): string | null {
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
 * The request link the reserved row is written with (rondo#195, D-0061 rule 4).
 *
 * A first lap's is the caller's. A successor's is the row it supersedes, which
 * `lineageDefect` has already found: a revision or a retry continues that
 * request, and the request's report must not lose track of it.
 */
/**
 * The predecessor's worker provider, for a successor that named none
 * (rondo#462).
 *
 * **Inherited rather than re-defaulted**, which is {@link inheritedRequest}'s
 * argument applied to the other thing a lineage carries: a revision that fell
 * back to the host's default would silently move the work onto another
 * provider half way through a request, and the person who chose one chose it
 * for the work rather than for its first lap. Naming one explicitly still
 * wins, which is what lets a re-lap be put on the other provider on purpose.
 *
 * **A choice is inherited; a default is resolved again.** The predecessor's
 * row now also carries the name the host's default resolved to when nobody
 * chose (see the schema), and that name is a record of what that lap ran on
 * rather than an instruction about the next one. Inheriting it would pin a
 * request to whatever the host happened to run the first time, which is a
 * choice nobody made -- so only `worker_provider_chosen` rows are carried.
 */
function inheritedWorkerProvider(connection: StoreConnection, input: ReserveInput): string | null {
  if (input.supersedesIterationId === null) {
    return null;
  }
  const row = connection
    .prepare("SELECT worker_provider, worker_provider_chosen FROM iteration WHERE id = ?")
    .get(input.supersedesIterationId) as SqlRow | undefined;
  // A predecessor that is not there is `lineageDefect`'s to answer, as above.
  if (row === undefined || optionalNumber(row, "worker_provider_chosen") !== 1) {
    return null;
  }
  return optionalText(row, "worker_provider");
}

function inheritedRequest(connection: StoreConnection, input: ReserveInput): string {
  if (input.supersedesIterationId === null) {
    return input.requestMessageId;
  }
  const row = connection
    .prepare("SELECT request_message_id FROM iteration WHERE id = ?")
    .get(input.supersedesIterationId) as SqlRow | undefined;
  // A predecessor that is not there is `lineageDefect`'s to answer, and it has
  // already been asked; the caller's own link is what this falls back to
  // rather than a null the type no longer admits.
  return row === undefined ? input.requestMessageId : requireText(row, "request_message_id");
}
