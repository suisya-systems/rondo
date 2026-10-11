/**
 * How often the drafter asks back, per request, and how often the person takes
 * its recommendation (rondo#637, `D-0189`'s A2).
 *
 * **Derived and never kept**, `decision-log.ts`'s rule: no table is added, and
 * every count is read from the `conversation_message` rows the drafter and the
 * person already wrote -- `asks`, `ask_options` and `answer_option`.
 */
import type { SqlRow, StoreConnection } from "./rows.js";

/** One request the drafter wrote in, and what its asks came to. */
export interface AskFrequencyRow {
  /** The message that opens the request (`in_reply_to IS NULL`). */
  readonly request: string;
  readonly atMs: number;
  /** The drafter's asks anywhere in the request's thread. */
  readonly asks: number;
  /** Of those, the ones the person has not answered with either press yet. */
  readonly unanswered: number;
  /** The person's answers that pressed one of an ask's options (`D-0190` rule 2). */
  readonly pressed: number;
  /** Of those, the ones that pressed the option the ask recommended. */
  readonly recommended: number;
}

/**
 * One row per request, oldest first. A request counts when a drafter under
 * `drafterPrefix` wrote any message in it, so a request drafted without an ask
 * counts as zero asks rather than not at all. The walk is `openAsksIn`'s, from
 * every root at once; each message has one parent, so it lands under one root.
 */
const ASK_FREQUENCY_SQL =
  "WITH RECURSIVE walk(id, root, root_at) AS (SELECT message_id, message_id, at_ms " +
  "FROM conversation_message WHERE in_reply_to IS NULL AND author_kind IS NOT NULL " +
  "AND at_ms >= ? UNION SELECT m.message_id, w.root, w.root_at FROM conversation_message m " +
  "JOIN walk w ON m.in_reply_to = w.id), " +
  "tagged AS (SELECT w.root, w.root_at, m.*, " +
  "(m.author_kind = 'drafter' AND substr(m.author_id, 1, length(?)) = ?) AS by_drafter, " +
  "q.ask_options AS q_options, (q.author_kind = 'drafter' AND q.asks = 1 AND " +
  "substr(q.author_id, 1, length(?)) = ?) AS to_drafter_ask FROM walk w " +
  "JOIN conversation_message m ON m.message_id = w.id " +
  "LEFT JOIN conversation_message q ON q.message_id = m.in_reply_to) " +
  "SELECT root, root_at, SUM(by_drafter) AS drafted, " +
  "SUM(by_drafter AND asks = 1) AS asks, " +
  "SUM(by_drafter AND asks = 1 AND NOT EXISTS (SELECT 1 FROM conversation_message r " +
  "WHERE r.in_reply_to = tagged.message_id AND r.author_kind = 'operator' " +
  "AND r.answer_outcome IS NOT NULL)) AS unanswered, " +
  "SUM(author_kind = 'operator' AND answer_option IS NOT NULL AND to_drafter_ask IS 1) " +
  "AS pressed, " +
  "SUM(author_kind = 'operator' AND answer_option IS NOT NULL AND to_drafter_ask IS 1 " +
  "AND answer_option = CASE WHEN json_valid(q_options) " +
  "THEN json_extract(q_options, '$.recommended') END) " +
  "AS recommended FROM tagged GROUP BY root, root_at HAVING drafted > 0 ORDER BY root_at, root";

/**
 * Every request opened at or after `sinceMs` (inclusive; null for all) that a
 * drafter under `drafterPrefix` wrote in, oldest first.
 */
export function readAskFrequency(
  connection: StoreConnection,
  sinceMs: number | null,
  drafterPrefix: string,
): readonly AskFrequencyRow[] {
  return connection
    .prepare(ASK_FREQUENCY_SQL)
    .all(
      sinceMs ?? Number.MIN_SAFE_INTEGER,
      drafterPrefix,
      drafterPrefix,
      drafterPrefix,
      drafterPrefix,
    )
    .map((row) => {
      const record = row as SqlRow;
      return {
        request: String(record["root"]),
        atMs: Number(record["root_at"]),
        asks: Number(record["asks"]),
        unanswered: Number(record["unanswered"]),
        pressed: Number(record["pressed"]),
        recommended: Number(record["recommended"]),
      };
    });
}
