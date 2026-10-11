/**
 * Every decision the store holds, read back as one list (D-0190 rule 10).
 *
 * **Derived and never kept** (D-0032 rule 3): no table is added, and each row
 * here is a projection of a row some writer already wrote. Kept apart from
 * `CHANGE_SOURCES` on purpose (rule 10.1) -- that list is the inbox's
 * census of what changed, and it does not move when this one does.
 */
import type { SqlRow, StoreConnection } from "./rows.js";

/** One decision, whoever took it (D-0190 rule 10.3). */
export interface DecisionRow {
  /** The table it was read from. */
  readonly kind: string;
  /** Its own reference, or null for a row whose subject never had one. */
  readonly id: string | null;
  readonly atMs: number;
  /** Who the row names, or null when the row names nobody (rondo's own acts). */
  readonly actor: string | null;
  /** `rondo` for an id under `rondo/` or a row that names nobody. */
  readonly by: "person" | "rondo";
  /** The row's own answer or verdict, or the act it records. */
  readonly outcome: string;
  /** The 0-based option an answer pressed (D-0190 rule 2), else null. */
  readonly option: number | null;
  /** The row the decision is about, or null. */
  readonly locator: string | null;
}

/**
 * One branch per table: identity, clock, actor, outcome, option and locator as
 * that table spells them. Only these constants are interpolated, under
 * `CHANGES_SINCE_SQL`'s licence; the bound is a parameter, once per branch.
 */
const SOURCES = [
  // An operator's answer to an ask (D-0072, D-0190 rule 2).
  [
    "conversation_message",
    "message_id",
    "at_ms",
    "author_id",
    "answer_outcome",
    "answer_option",
    "in_reply_to",
    "answer_outcome IS NOT NULL",
  ],
  ["human_decision", "decision_id", "decided_at_ms", "actor_id", "outcome", "NULL", "proposal_id"],
  [
    "scope_decision",
    "scope_decision_id",
    "decided_at_ms",
    "actor_id",
    "outcome",
    "NULL",
    "scope_id",
  ],
  ["gate_answer", "iteration_id", "answered_at_ms", "actor_id", "answer", "NULL", "gate_id"],
  // The flow host's own ask: rondo's, so it names no actor.
  ["flow_ask", "ask_id", "asked_at_ms", "NULL", "'asked'", "NULL", "proposal_id"],
  ["flow_answer", "ask_id", "answered_at_ms", "answered_by", "'answered'", "NULL", "request"],
  [
    "triage_decline",
    "decline_id",
    "declined_at_ms",
    "declined_by",
    "'declined'",
    "NULL",
    "proposal_id",
  ],
  ["goal", "goal_id", "written_at_ms", "written_by", "'written'", "NULL", "repository"],
  // D-0067 rule 6: kept, changed or retired, and the policy it replaced.
  [
    "standing_policy",
    "policy_id",
    "created_at_ms",
    "author_id",
    "CASE WHEN body = '' THEN 'retired' WHEN supersedes_policy_id IS NULL THEN 'kept' " +
      "ELSE 'changed' END",
    "NULL",
    "supersedes_policy_id",
  ],
  // A held start's verdict is rondo's sentence when refused; the reader keeps
  // the verdict and never the sentence (rule 10.4: no body is printed).
  [
    "held_start",
    "iteration_id",
    "COALESCE(settled_at_ms, held_at_ms)",
    "NULL",
    "CASE WHEN settled_at_ms IS NULL THEN 'held' WHEN outcome = 'started' THEN 'started' " +
      "ELSE 'refused' END",
    "NULL",
    "request_message_id",
  ],
  [
    "scope_consumption",
    "subject_id",
    "consumed_at_ms",
    "NULL",
    "act_kind",
    "NULL",
    "scope_decision_id",
  ],
] as const;

// Opt-in (rule 10.2): a tick can write many of these.
const ATTENTION = [
  "operator_attention",
  "subject_id",
  "at_ms",
  "NULL",
  "disposition",
  "NULL",
  "subject_kind",
] as const;

function statement(sources: readonly (readonly string[])[]): string {
  return `${sources
    .map(
      ([table, id, at, actor, outcome, option, locator, where]) =>
        `SELECT '${String(table)}' AS kind, ${String(id)} AS id, ${String(at)} AS at_ms, ` +
        `${String(actor)} AS actor, ${String(outcome)} AS outcome, ${String(option)} AS option, ` +
        `${String(locator)} AS locator FROM ${String(table)} WHERE ${String(at)} >= ?` +
        (where === undefined ? "" : ` AND ${where}`),
    )
    .join(" UNION ALL ")} ORDER BY at_ms, kind, id`;
}

const DECISIONS_SQL = statement(SOURCES);
const DECISIONS_WITH_ATTENTION_SQL = statement([...SOURCES, ATTENTION]);

const text = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);

/**
 * Every decision at or after `sinceMs` (inclusive, `changedSince`'s rule), or
 * every one when it is null, oldest first.
 */
export function readDecisions(
  connection: StoreConnection,
  sinceMs: number | null,
  attention: boolean,
): readonly DecisionRow[] {
  const branches = attention ? SOURCES.length + 1 : SOURCES.length;
  return connection
    .prepare(attention ? DECISIONS_WITH_ATTENTION_SQL : DECISIONS_SQL)
    .all(...Array.from({ length: branches }, () => sinceMs ?? Number.MIN_SAFE_INTEGER))
    .map((row) => {
      const record = row as SqlRow;
      const actor = text(record["actor"]);
      const option = record["option"];
      return {
        kind: String(record["kind"]),
        id: text(record["id"]),
        atMs: Number(record["at_ms"]),
        actor,
        by: actor === null || actor.startsWith("rondo/") ? "rondo" : "person",
        outcome: String(record["outcome"]),
        option: option === null || option === undefined ? null : Number(option),
        locator: text(record["locator"]),
      };
    });
}
