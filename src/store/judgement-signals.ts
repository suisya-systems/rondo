/**
 * The counts that would falsify two model judgements nothing deterministic
 * checks (rondo#659): triage's raised-or-decided reading of an open point
 * (`D-0193`'s three falsifiers) and the explainer's K4 signal (`D-0177`).
 *
 * **Derived and never kept**, `ask-frequency.ts`'s rule: no table is added.
 * Every count is read from rows the writers already wrote -- the triage
 * `proposal` payload, `flow_ask` / `flow_answer`, the request threads the flow
 * opened, and the `signal` on each explanation's snapshot.
 */
import { FLOW_AUTHOR_PREFIX } from "./records.js";
import type { SqlRow, StoreConnection } from "./rows.js";

/** One triage reading (a `triage` proposal row), and what its points came to. */
export interface TriageJudgementRow {
  readonly reading: string;
  readonly repository: string;
  readonly atMs: number;
  readonly candidates: number;
  /** Candidates with at least one raised point: each one the flow asks before it starts. */
  readonly raising: number;
  /** Points marked `dispute`, `irreversible` or `policy`; one written before `D-0193` reads as raised. */
  readonly raised: number;
  /** Points marked `null`: rondo decided them as recommended. */
  readonly decided: number;
  /** The flow's asks over this reading's raised points, and the answered ones. */
  readonly asks: number;
  readonly answered: number;
  /** Points of the answered asks, and of those the ones answered with the recommendation. */
  readonly answeredPoints: number;
  readonly asRecommended: number;
  /** Requests the flow sent under this reading that carried decided points. */
  readonly sentDecided: number;
  /** Of those, the ones the person replied in, in their own words and not by an ask's press. */
  readonly replied: number;
}

/** One thing a person asked the explainer about, and how often (`D-0173` K4). */
export interface ExplainSignalRow {
  /** The basis the "?" was pressed beside as canonical JSON, or null for free text. */
  readonly about: string | null;
  readonly asked: number;
  readonly button: number;
  readonly text: number;
  readonly firstAtMs: number;
  readonly lastAtMs: number;
}

/**
 * The line `flowBody` opens the decided points with (`D-0193` rule 4). The
 * request's body is where the decided points were written for the person.
 *
 * ponytail: matched as text, since the store does not import the flow host;
 * if the line's words change, change them here too (the test seeds the body
 * `flowBody` writes, so it fails when they part).
 */
const DECIDED_LINE = "Decided by rondo, as suggested";

/**
 * Each request the flow opened under a reading that carried decided points,
 * and whether the person wrote in its thread with no answer press: a reply in
 * the thread is how `D-0193` rule 4 says a decided point is changed.
 *
 * ponytail: any such reply counts, whatever it says, so `replied` is an upper
 * bound on decided points changed; a change made at a gate is not read.
 */
const SENT_SQL =
  "WITH RECURSIVE walk(id, root) AS (SELECT message_id, message_id FROM conversation_message " +
  "WHERE in_reply_to IS NULL AND author_kind = 'drafter' AND substr(author_id, 1, length(?)) = ? " +
  "AND instr(body, ?) > 0 AND EXISTS (SELECT 1 FROM json_each(bases) b " +
  "WHERE json_extract(b.value, '$.form') = 'proposal' " +
  "AND json_extract(b.value, '$.proposalId') = ?) " +
  "UNION SELECT m.message_id, w.root FROM conversation_message m JOIN walk w ON m.in_reply_to = w.id) " +
  "SELECT w.root, MAX(m.author_kind = 'operator' AND m.answer_outcome IS NULL) AS replied " +
  "FROM walk w JOIN conversation_message m ON m.message_id = w.id GROUP BY w.root";

function parse(text: unknown): unknown {
  try {
    return JSON.parse(String(text));
  } catch {
    return null;
  }
}

const list = (value: unknown): readonly Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter((one): one is Record<string, unknown> => typeof one === "object" && one !== null)
    : [];

/**
 * Every triage reading written at or after `sinceMs` (inclusive; null for
 * all), oldest first. An answer counts as the recommendation when it is the
 * recommendation as written or as `asDrawn` puts it in the answer field the
 * person keeps or edits.
 */
export function readTriageJudgement(
  connection: StoreConnection,
  sinceMs: number | null,
  asDrawn: (recommendation: string) => string,
): readonly TriageJudgementRow[] {
  const readings = connection
    .prepare(
      "SELECT proposal_id, payload, created_at_ms FROM proposal WHERE kind = 'triage' " +
        "AND created_at_ms >= ? ORDER BY created_at_ms, proposal_id",
    )
    .all(sinceMs ?? Number.MIN_SAFE_INTEGER) as SqlRow[];
  const asks = connection.prepare(
    "SELECT k.points, a.answers FROM flow_ask k LEFT JOIN flow_answer a ON a.ask_id = k.ask_id " +
      "WHERE k.proposal_id = ?",
  );
  const sent = connection.prepare(SENT_SQL);
  return readings.map((row) => {
    const reading = String(row["proposal_id"]);
    const payload = parse(row["payload"]) as Record<string, unknown> | null;
    const ranked = list(payload?.["ranked"]);
    const points = ranked.map((one) => list(one["open_points"]));
    // `readTriagePayload`'s reading: only an explicit null is decided.
    const isDecided = (point: Record<string, unknown>): boolean => point["raise"] === null;
    let answered = 0;
    let answeredPoints = 0;
    let asRecommended = 0;
    const askRows = asks.all(reading) as SqlRow[];
    for (const ask of askRows) {
      if (ask["answers"] === null) {
        continue;
      }
      answered += 1;
      const answers = parse(ask["answers"]);
      list(parse(ask["points"])).forEach((point, at) => {
        const answer = Array.isArray(answers) ? String(answers[at] ?? "").trim() : "";
        const recommendation = String(point["recommendation"] ?? "");
        answeredPoints += 1;
        if (answer === recommendation.trim() || answer === asDrawn(recommendation).trim()) {
          asRecommended += 1;
        }
      });
    }
    const sentRows = sent.all(
      FLOW_AUTHOR_PREFIX,
      FLOW_AUTHOR_PREFIX,
      DECIDED_LINE,
      reading,
    ) as SqlRow[];
    return {
      reading,
      repository: String(payload?.["repository"] ?? "-"),
      atMs: Number(row["created_at_ms"]),
      candidates: ranked.length,
      raising: points.filter((each) => each.some((point) => !isDecided(point))).length,
      raised: points.flat().filter((point) => !isDecided(point)).length,
      decided: points.flat().filter(isDecided).length,
      asks: askRows.length,
      answered,
      answeredPoints,
      asRecommended,
      sentDecided: sentRows.length,
      replied: sentRows.filter((one) => Number(one["replied"]) === 1).length,
    };
  });
}

/**
 * One row per thing asked about since `sinceMs` (inclusive; null for all),
 * most asked first. Each explanation the explainer wrote carries the signal of
 * the question it answered (`D-0177`), so this counts answered questions; a
 * question no answer was written for is not on any row.
 */
const EXPLAIN_SIGNAL_SQL =
  "SELECT json_extract(snapshot, '$.signal.about') AS about, COUNT(*) AS asked, " +
  "SUM(json_extract(snapshot, '$.signal.origin') = 'button') AS button, " +
  "SUM(json_extract(snapshot, '$.signal.origin') = 'text') AS text, " +
  "MIN(created_at_ms) AS first_at, MAX(created_at_ms) AS last_at FROM proposal " +
  "WHERE kind = 'explanation' AND json_valid(snapshot) " +
  "AND json_extract(snapshot, '$.signal.kind') = 'D-0173 K4' AND created_at_ms >= ? " +
  "GROUP BY about ORDER BY asked DESC, first_at, about";

export function readExplainSignals(
  connection: StoreConnection,
  sinceMs: number | null,
): readonly ExplainSignalRow[] {
  return (
    connection.prepare(EXPLAIN_SIGNAL_SQL).all(sinceMs ?? Number.MIN_SAFE_INTEGER) as SqlRow[]
  ).map((row) => ({
    about: row["about"] === null ? null : String(row["about"]),
    asked: Number(row["asked"]),
    button: Number(row["button"]),
    text: Number(row["text"]),
    firstAtMs: Number(row["first_at"]),
    lastAtMs: Number(row["last_at"]),
  }));
}
