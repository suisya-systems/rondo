/**
 * What every store module shares: the connection's shape, the defect a decoder
 * raises, the transaction helper, and the decoders that read an `iteration`
 * row, a reading, a proposal and a decision back out of SQL.
 *
 * Split out of `src/store/sqlite.ts` (D-0171), which still owns the driver; this
 * module never opens a connection, it only describes the one it is handed.
 */

import type { ReadOutcome } from "./contract.js";
import { canonicalJson, contentDigest, planDigest } from "./plan.js";
import {
  type FailureKind,
  FINDING_SEVERITIES,
  type FindingBasis,
  type FindingSeverity,
  type GateAnswer,
  type GradedFinding,
  type IterationFields,
  type IterationRecord,
  type IterationStatus,
  type JsonRecord,
  type LapReading,
  type OperatorVerificationClaim,
  type ReadingEvidence,
  type StoredDecision,
  type StoredProposal,
} from "./records.js";

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
  permissionDenials: "permission_denials",
  lapCommands: "lap_commands",
  lapCostUsd: "lap_cost_usd",
  lapTurns: "lap_turns",
  lapDurationMs: "lap_duration_ms",
  lapBudgetCapUsd: "lap_budget_cap_usd",
  reason: "reason",
  failureKind: "failure_kind",
} as const satisfies Record<keyof IterationFields, string>;

/**
 * The connection every store module is handed, stated by its shape (D-0171).
 *
 * `src/store/sqlite.ts` is the one module that names the driver, and so the one
 * that can open a connection; the modules that hold the schema and the queries
 * are given this instead. It names only what they call -- `exec` and `prepare`,
 * and a statement's `get`, `all` and `run` -- in `node:sqlite`'s own types, so a
 * `DatabaseSync` is one without a cast and a driver swap is checked here by the
 * compiler rather than discovered in every module that queries.
 */
export interface StoreConnection {
  exec(sql: string): void;
  prepare(sql: string): StoreStatement;
}

/** A prepared statement, as {@link StoreConnection} hands one back. */
interface StoreStatement {
  get(...values: SqlInput[]): Record<string, SqlOutput> | undefined;
  all(...values: SqlInput[]): Record<string, SqlOutput>[];
  run(...values: SqlInput[]): { readonly changes: number | bigint };
}

/** `node:sqlite`'s `SQLInputValue`, spelled without naming the driver. */
type SqlInput = null | number | bigint | string | NodeJS.ArrayBufferView;

/** `node:sqlite`'s `SQLOutputValue`, spelled without naming the driver. */
type SqlOutput = null | number | bigint | string | Uint8Array;

/** What a bound parameter may be. The store persists no blobs and no bigints. */
type SqlValue = string | number | null;

/** A row as the driver hands it back, before anything has been read from it. */
export type SqlRow = Readonly<Record<string, unknown>>;

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function immediateTransaction<T>(connection: StoreConnection, body: () => T): T {
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
 * The operator messages a drafter named with `drafterPrefix` covers (D-0071
 * rule 3.2). One damaged row reads as covering nothing: it must not make the
 * query fail, which would leave every thread looking undrafted.
 */
/** A lap's readings, oldest first, in `readingsFor`'s order. */
export function readingsOf(
  connection: StoreConnection,
  iterationId: string,
): readonly LapReading[] {
  return connection
    .prepare(
      "SELECT iteration_id, read_at_ms, drafter, verdict, findings, base_ref, base_commit, " +
        "tip_commit, material_digest, commit_count, file_count, unavailable_reason, " +
        "graded, delivered_digest " +
        "FROM lap_reading WHERE iteration_id = ? ORDER BY read_at_ms, rowid",
    )
    .all(iterationId)
    .map((row) => toReading(row as SqlRow));
}

/** Links a lineage walk follows before it calls the chain one that does not end. */
export const LINEAGE_BOUND = 1000;

/**
 * Every iteration sharing `tipId`'s root, the end of its `supersedes` chain,
 * root first; empty for no tip; null when either walk passes
 * {@link LINEAGE_BOUND}. `reserve()` never writes a cycle (a predecessor must
 * already be a row, and ids are unique), so the bound is a backstop against a
 * row edited by hand, not an expected answer.
 */
export function lineageOf(
  connection: StoreConnection,
  tipId: string | null,
): readonly string[] | null {
  if (tipId === null) {
    return [];
  }
  const up = connection
    .prepare(
      "WITH RECURSIVE line(id, depth) AS (SELECT ?, 0 " +
        "UNION ALL SELECT i.supersedes_iteration_id, l.depth + 1 FROM iteration i " +
        "JOIN line l ON i.id = l.id WHERE i.supersedes_iteration_id IS NOT NULL AND l.depth < ?" +
        ") SELECT id FROM line ORDER BY depth DESC",
    )
    .all(tipId, LINEAGE_BOUND);
  if (up.length > LINEAGE_BOUND) {
    return null;
  }
  const down = connection
    .prepare(
      "WITH RECURSIVE tree(id, depth) AS (SELECT ?, 0 " +
        "UNION ALL SELECT i.id, t.depth + 1 FROM iteration i " +
        "JOIN tree t ON i.supersedes_iteration_id = t.id WHERE t.depth < ?" +
        ") SELECT id, depth FROM tree ORDER BY depth, id",
    )
    .all(String((up[0] as SqlRow)["id"]), LINEAGE_BOUND) as SqlRow[];
  return down.some((row) => Number(row["depth"]) >= LINEAGE_BOUND)
    ? null
    : down.map((row) => String(row["id"]));
}

/**
 * A transition's fields as a SQL fragment and its bound values.
 *
 * The clause list is built from `COLUMN_BY_FIELD` rather than from the caller's
 * strings, so an unexpected key cannot reach the statement text. A field that
 * is absent is not written at all, which is what makes `transition` able to say
 * "set the gate id and touch nothing else".
 */
export function assignmentsFor(fields: IterationFields): {
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
export function isClaimCollision(error: unknown): boolean {
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
export function isIdCollision(error: unknown): boolean {
  return isUniqueViolation(error) && error.message.includes("iteration.id");
}

/** `node:sqlite` reporting any `UNIQUE` constraint, before asking which one. */
export function isUniqueViolation(error: unknown): error is Error {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed");
}

/** An error rendered for a `defect` reason, without assuming it is an `Error`. */
export function describe(error: unknown): string {
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
export function decode(row: SqlRow, id: string): ReadOutcome {
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
export function idOf(row: SqlRow): string {
  const value = row["id"];
  return typeof value === "string" ? value : "(an iteration row whose id is not text)";
}

/** One row, read into a record, or a refusal to read it at all. */
export function toRecord(row: SqlRow): IterationRecord {
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
    requestMessageId: requireText(row, "request_message_id"),
    workerProvider: optionalText(row, "worker_provider"),
    workerProviderChosen: optionalNumber(row, "worker_provider_chosen") === 1,
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
    permissionDenials: optionalText(row, "permission_denials"),
    lapCommands: optionalText(row, "lap_commands"),
    lapCostUsd: optionalNumber(row, "lap_cost_usd"),
    lapTurns: optionalNumber(row, "lap_turns"),
    lapDurationMs: optionalNumber(row, "lap_duration_ms"),
    lapBudgetCapUsd: optionalNumber(row, "lap_budget_cap_usd"),
    publishedRemote: optionalText(row, "published_remote"),
    reason: optionalText(row, "reason"),
    failureKind: optionalFailureKind(row),
    gateAnswer: optionalGateAnswer(row),
    gateAnswerActor: optionalText(row, "gate_answer_actor"),
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
export function hasEvidence(evidence: ReadingEvidence | null): boolean {
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
/**
 * One `operator_verification_claim` row, read back.
 *
 * Total for `toReading`'s reason, and with one difference that matters: there
 * is no verdict to fall back to here, so a column that will not decode reads as
 * a stand-in a person can see is a stand-in rather than as an empty claim,
 * which would render as though nobody had said anything.
 */
export function toVerificationClaim(row: SqlRow): OperatorVerificationClaim {
  return {
    iterationId: typeof row["iteration_id"] === "string" ? row["iteration_id"] : "(unrecorded)",
    claimedAtMs: typeof row["claimed_at_ms"] === "number" ? row["claimed_at_ms"] : 0,
    actorId: typeof row["actor_id"] === "string" ? row["actor_id"] : "(unrecorded)",
    claim: typeof row["claim"] === "string" ? row["claim"] : "(unreadable)",
  };
}

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
  const delivered = row["delivered_digest"];
  const graded = readGraded(row["graded"], findings.length);
  return {
    iterationId: idOfReading(row),
    readAtMs: typeof row["read_at_ms"] === "number" ? row["read_at_ms"] : 0,
    drafter: typeof row["drafter"] === "string" ? row["drafter"] : "(unrecorded)",
    verdict: known ? verdict : "unavailable",
    findings,
    ...(graded === null ? {} : { graded }),
    evidence:
      known && evidence !== null && typeof delivered === "string" && delivered !== ""
        ? { ...evidence, deliveredDigest: delivered }
        : known
          ? evidence
          : null,
    unavailableReason: known
      ? typeof row["unavailable_reason"] === "string"
        ? row["unavailable_reason"]
        : null
      : `the stored verdict is ${JSON.stringify(verdict)}, which this rondo does not know`,
  };
}

/** A {@link GradedFinding} as the `graded` column holds it. */
export function gradedJson(finding: GradedFinding): JsonRecord {
  return {
    severity: finding.severity,
    bases: finding.bases.map((basis): JsonRecord => ({ ...basis })),
    basisResolved: finding.basisResolved,
  };
}

/**
 * The `graded` column, or null when it is NULL or does not decode.
 *
 * **Total, and honest by omission rather than by invention.** A column that is
 * not an array of well-formed graded findings parallel to `findings` (same
 * length) yields no `graded` at all: the one-line findings stay as they were
 * read, so nothing a reviewer raised disappears, and no severity is made up for
 * a finding whose stored one cannot be read. A reader that needs severities
 * (a scope's threshold) then sees none, which is the absence it already handles.
 */
function readGraded(value: unknown, findingCount: number): readonly GradedFinding[] | null {
  if (typeof value !== "string") {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length !== findingCount) {
    return null;
  }
  const out: GradedFinding[] = [];
  for (const entry of parsed as unknown[]) {
    const finding = readGradedFinding(entry);
    if (finding === null) {
      return null;
    }
    out.push(finding);
  }
  return Object.freeze(out);
}

function readGradedFinding(entry: unknown): GradedFinding | null {
  if (typeof entry !== "object" || entry === null) {
    return null;
  }
  const { severity, bases, basisResolved } = entry as Record<string, unknown>;
  if (
    typeof severity !== "string" ||
    !(FINDING_SEVERITIES as readonly string[]).includes(severity) ||
    typeof basisResolved !== "boolean" ||
    !Array.isArray(bases)
  ) {
    return null;
  }
  const read: FindingBasis[] = [];
  for (const basis of bases as unknown[]) {
    const one = readBasis(basis);
    if (one === null) {
      return null;
    }
    read.push(one);
  }
  return {
    severity: severity as FindingSeverity,
    bases: Object.freeze(read),
    basisResolved,
  };
}

function readBasis(basis: unknown): FindingBasis | null {
  if (typeof basis !== "object" || basis === null) {
    return null;
  }
  const b = basis as Record<string, unknown>;
  const line = Number.isInteger(b["line"]) ? (b["line"] as number) : null;
  const path = typeof b["path"] === "string" ? b["path"] : null;
  switch (b["kind"]) {
    case "file":
    case "rule":
      return path === null || line === null ? null : { kind: b["kind"], path, line };
    case "commit":
      return typeof b["sha"] === "string" ? { kind: "commit", sha: b["sha"] } : null;
    case "event":
      return Number.isInteger(b["index"]) ? { kind: "event", index: b["index"] as number } : null;
    default:
      return null;
  }
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
export function requireStatus(row: SqlRow): IterationStatus {
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

/**
 * One verbatim JSON column, **checked against the digest stored beside it**.
 *
 * D-0022 rule 4 keeps `payload` and `snapshot` as bytes with a digest of those
 * bytes, so that a proposal can be re-derived and not only re-read. Re-reading
 * both and comparing is what turns that from a property of the writer into a
 * property of the read: the row either still describes one document or it is
 * refused, and the moment worth finding out is the moment before an operator
 * answers it.
 */
export function verbatim(row: SqlRow, column: string, digestColumn: string): JsonRecord {
  const text = requireText(row, column, "proposal");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new StoreDefect(`the proposal row's '${column}' is not JSON: ${describe(error)}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new StoreDefect(`the proposal row's '${column}' is JSON, but it is not an object`);
  }
  const recorded = requireText(row, digestColumn, "proposal");
  const recomputed = contentDigest(parsed as JsonRecord);
  if (recorded !== recomputed) {
    throw new StoreDefect(
      `the proposal row's '${digestColumn}' is '${recorded}' and its '${column}' digests to ` +
        `'${recomputed}'. The pair no longer describes one document, so rondo cannot say what ` +
        "this proposal was composed from.",
    );
  }
  return parsed as JsonRecord;
}

/** One proposal row, read into a record, or a refusal to read it at all (#39). */
export function toProposal(row: SqlRow, answers: readonly SqlRow[]): StoredProposal {
  return {
    proposalId: requireText(row, "proposal_id", "proposal"),
    kind: requireText(row, "kind", "proposal"),
    drafter: requireText(row, "drafter", "proposal"),
    payload: verbatim(row, "payload", "proposal_digest"),
    snapshot: verbatim(row, "snapshot", "snapshot_digest"),
    derivation: optionalText(row, "derivation", "proposal"),
    iterationId: optionalText(row, "iteration_id", "proposal"),
    elevatedFromMessageId: optionalText(row, "elevated_from_message_id", "proposal"),
    elevatedByActorId: optionalText(row, "elevated_by_actor_id", "proposal"),
    cadenzaRevision: optionalText(row, "cadenza_revision", "proposal"),
    createdAtMs: requireInteger(row, "created_at_ms", "proposal"),
    decisions: answers.map(toDecision),
  };
}

/** One answer, read into a record (D-0032 rule 6). */
function toDecision(row: SqlRow): StoredDecision {
  return {
    decisionId: requireText(row, "decision_id", "decision"),
    outcome: requireText(row, "outcome", "decision"),
    approved: optionalText(row, "approved", "decision"),
    actorId: requireText(row, "actor_id", "decision"),
    decidedAtMs: requireInteger(row, "decided_at_ms", "decision"),
  };
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

export function requireText(row: SqlRow, column: string, subject = "iteration"): string {
  const value = row[column];
  if (typeof value !== "string") {
    throw new StoreDefect(`the ${subject} row's '${column}' is not text`);
  }
  return value;
}

export function optionalText(row: SqlRow, column: string, subject = "iteration"): string | null {
  const value = row[column];
  if (value === null || value === undefined) {
    return null;
  }
  return requireText(row, column, subject);
}

/**
 * The failure-kind column, or null where rondo does not know (rondo#348).
 *
 * **A value this rondo does not know reads as null rather than as a refusal to
 * read the row.** The column is written in one place, from a two-armed union,
 * so an unknown string can only be a database somebody edited -- and the whole
 * of what this column does is choose which sentence a screen writes about a
 * failure. Refusing the row would take a person's record away from them over a
 * word rondo uses to pick between two ways of saying the same failure; null is
 * *rondo does not know which*, which is a state the screen already draws.
 * {@link requireStatus} refuses an unknown status for the opposite reason: a
 * status decides whether a lock is held.
 */
function optionalFailureKind(row: SqlRow): FailureKind | null {
  const value = optionalText(row, "failure_kind");
  return value === "refusal" || value === "defect" || value === "budget" || value === "lost"
    ? value
    : null;
}

/** D-0092's answer, or null where rondo holds none; the table's CHECK already narrows it. */
function optionalGateAnswer(row: SqlRow): GateAnswer | null {
  const value = optionalText(row, "gate_answer");
  return value === "approve" || value === "revise" ? value : null;
}

/**
 * An integer column.
 *
 * `bigint` is refused rather than narrowed: `node:sqlite` hands back a `bigint`
 * for a value outside the double-safe range, and a timestamp or an attempt
 * count that far out is a row nobody should be reading past.
 */
export function requireInteger(row: SqlRow, column: string, subject = "iteration"): number {
  const value = row[column];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new StoreDefect(`the ${subject} row's '${column}' is not a whole number`);
  }
  return value;
}

/**
 * A nullable numeric column, whole or not.
 *
 * One helper for all three of `D-0046`'s columns, because what they have in
 * common is the part that matters: a null means rondo did not read the number
 * and a 0 means it read a zero, so an absent value is never rounded into a
 * cheap lap. `bigint` is refused for {@link requireInteger}'s reason, and a
 * non-finite number for a plainer one -- a cost of `Infinity` is not a cost.
 */
export function optionalNumber(row: SqlRow, column: string, subject = "iteration"): number | null {
  const value = row[column];
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new StoreDefect(`the ${subject} row's '${column}' is not a finite number`);
  }
  return value;
}
