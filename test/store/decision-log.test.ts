/**
 * D-0190 rule 10: one reader over every decision table, and `rondo decisions`.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import { main } from "../../src/access/cli.js";
import { parseCommand } from "../../src/access/cli-parse.js";
import { consoleSeams } from "../../src/access/console.js";
import { openAdvisoryRecord } from "../../src/store/sqlite.js";

function freshStore(): string {
  const path = join(mkdtempSync(join(tmpdir(), "rondo-decisions-")), "store.db");
  openAdvisoryRecord(path);
  return path;
}

/** One row per source, each at its own clock (the table's index * 10). */
function seed(path: string): void {
  const db = new DatabaseSync(path);
  db.exec(`
    INSERT INTO conversation_message (message_id, body, author_kind, author_id, at_ms, asks)
      VALUES ('ask-1', 'which?', 'drafter', 'rondo/drafter/1', 5, 1);
    INSERT INTO conversation_message
      (message_id, body, author_kind, author_id, in_reply_to, at_ms, answer_outcome, answer_option)
      VALUES ('ans-1', 'secret words', 'operator', 'me', 'ask-1', 10, 'carry_on', 1);
    INSERT INTO human_decision (decision_id, proposal_id, outcome, actor_id, recorded_by, decided_at_ms)
      VALUES ('d-1', 'p-1', 'declined', 'me', 'rondo', 20);
    INSERT INTO scope_decision (scope_decision_id, scope_id, scope_digest, outcome, actor_id, recorded_by, decided_at_ms)
      VALUES ('sd-1', 's-1', 'sha', 'approved', 'me', 'rondo', 30);
    INSERT INTO gate_answer (iteration_id, gate_id, answer, actor_id, answered_at_ms)
      VALUES ('i-1', 'g-1', 'approve', 'rondo/flow/1', 40);
    INSERT INTO flow_ask (ask_id, repository, goal_id, scope_decision_id, proposal_id, candidate, points, asked_at_ms)
      VALUES ('fa-1', 'o/r', 'goal-1', 'sd-1', 'p-2', 'c', '[]', 50);
    INSERT INTO flow_answer (ask_id, answers, answered_by, answered_at_ms, request)
      VALUES ('fa-1', '[]', 'me', 60, 'req-1');
    INSERT INTO triage_decline (decline_id, proposal_id, candidate, declined_by, declined_at_ms)
      VALUES ('td-1', 'p-3', 'c', 'me', 70);
    INSERT INTO goal (goal_id, repository, clauses, written_by, written_at_ms)
      VALUES ('goal-1', 'o/r', '[]', 'me', 80);
    INSERT INTO held_start (iteration_id, request_message_id, scope_decision_id, plan_digest, repository, held_at_ms, settled_at_ms, outcome)
      VALUES ('i-2', 'req-1', 'sd-1', 'sha', 'o/r', 85, 90, 'the files are taken by i-1');
    INSERT INTO scope_consumption (scope_decision_id, act_kind, subject_id, consumed_at_ms)
      VALUES ('sd-1', 'admission', 'i-3', 100);
    INSERT INTO operator_attention (at_ms, subject_kind, subject_id, disposition, rule_name)
      VALUES (110, 'proposal', NULL, 'withheld', 'quiet');
  `);
  db.close();
}

test("an empty store has no decisions", async () => {
  expect(await openAdvisoryRecord(freshStore()).decisions(null, true)).toEqual([]);
});

test("one row per source, oldest first, classified person or rondo", async () => {
  const path = freshStore();
  seed(path);
  const rows = await openAdvisoryRecord(path).decisions(null, false);
  expect(rows.map((row) => [row.kind, row.id, row.atMs, row.by, row.outcome])).toEqual([
    ["conversation_message", "ans-1", 10, "person", "carry_on"],
    ["human_decision", "d-1", 20, "person", "declined"],
    ["scope_decision", "sd-1", 30, "person", "approved"],
    ["gate_answer", "i-1", 40, "rondo", "approve"],
    ["flow_ask", "fa-1", 50, "rondo", "asked"],
    ["flow_answer", "fa-1", 60, "person", "answered"],
    ["triage_decline", "td-1", 70, "person", "declined"],
    ["goal", "goal-1", 80, "person", "written"],
    // The verdict, never rondo's sentence for the refusal.
    ["held_start", "i-2", 90, "rondo", "refused"],
    ["scope_consumption", "i-3", 100, "rondo", "admission"],
  ]);
  expect(rows[0]).toEqual({
    kind: "conversation_message",
    id: "ans-1",
    atMs: 10,
    actor: "me",
    by: "person",
    outcome: "carry_on",
    option: 1,
    locator: "ask-1",
  });
  expect(rows.every((row) => row.kind === "conversation_message" || row.option === null)).toBe(
    true,
  );
});

test("--since is inclusive, and attention is opt-in", async () => {
  const path = freshStore();
  seed(path);
  const record = openAdvisoryRecord(path);
  expect((await record.decisions(90, false)).map((row) => row.kind)).toEqual([
    "held_start",
    "scope_consumption",
  ]);
  const withAttention = await record.decisions(90, true);
  expect(withAttention.at(-1)).toMatchObject({
    kind: "operator_attention",
    id: null,
    by: "rondo",
    outcome: "withheld",
    locator: "proposal",
  });
});

test("parse: decisions takes --since as an ISO 8601 instant and --attention", () => {
  const parsed = parseCommand(["decisions", "--since", "1970-01-01T00:00:00.090Z", "--attention"]);
  expect(parsed.kind === "parsed" && [parsed.parsed.sinceMs, parsed.parsed.attention]).toEqual([
    90,
    true,
  ]);
  expect(parseCommand(["decisions", "--since", "yesterday"]).kind).toBe("refused");
  expect(parseCommand(["decisions", "--actor-id", "me"]).kind).toBe("refused");
  expect(parseCommand(["inbox", "--since", "2026-10-11"]).kind).toBe("refused");
});

test("rondo decisions prints one ASCII line per row, with no body", async () => {
  const path = freshStore();
  seed(path);
  const out: string[] = [];
  const originalWrite = consoleSeams.write;
  consoleSeams.write = (text: string) => {
    out.push(text);
  };
  try {
    expect(
      await main(["decisions", "--since", "1970-01-01T00:00:00.010Z"], { RONDO_STORE: path }),
    ).toBe(0);
  } finally {
    consoleSeams.write = originalWrite;
  }
  const lines = out.join("").trimEnd().split("\n");
  expect(lines).toHaveLength(10);
  expect(lines[0]).toBe(
    "1970-01-01T00:00:00.010Z conversation_message ans-1 by=person actor=me outcome=carry_on " +
      "option=1 locator=ask-1",
  );
  expect(lines[9]).toBe(
    "1970-01-01T00:00:00.100Z scope_consumption i-3 by=rondo actor=- outcome=admission locator=sd-1",
  );
  expect(out.join("")).not.toContain("secret words");
  expect(out.join("")).not.toContain("taken by");
  expect(/^[\x20-\x7e\n]*$/.test(out.join(""))).toBe(true);
});
