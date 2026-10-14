/**
 * rondo#659: what would falsify triage's raised-or-decided reading (D-0193)
 * and the K4 signal per thing asked about (D-0177), read from rows already
 * written, and `rondo raises` / `rondo explains`.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import { main } from "../../src/access/cli.js";
import { parseCommand } from "../../src/access/cli-parse.js";
import { consoleSeams } from "../../src/access/console.js";
import { breached, FALSIFIER_THRESHOLDS } from "../../src/access/decisions-cli.js";
import { flowBody } from "../../src/access/flow-host.js";
import { asDecision } from "../../src/access/page/triage.js";
import type { OpenPoint, Ranked } from "../../src/advisory/triage.js";
import { FLOW_AUTHOR } from "../../src/store/records.js";
import { openAdvisoryRecord, openJudgementSignals } from "../../src/store/sqlite.js";

function freshStore(): string {
  const path = join(mkdtempSync(join(tmpdir(), "rondo-raises-")), "store.db");
  openAdvisoryRecord(path);
  return path;
}

const point = (raise: OpenPoint["raise"] | "absent"): Record<string, unknown> => ({
  point: "p",
  recommendation: "r",
  ...(raise === "absent" ? {} : { raise }),
});

const candidate = (key: string, points: Record<string, unknown>[]): Record<string, unknown> => ({
  key,
  clause: 1,
  request: `do ${key}`,
  why: "w",
  open_points: points,
  source: { form: "issue", repository: "o/n", number: 1 },
  title: "t",
  labels: [],
});

/** The body the flow host writes, so the reader is held to its words. */
function sent(decided: boolean): string {
  const ranked: Ranked = {
    key: "c1",
    clause: 1,
    request: "do c1",
    why: "w",
    openPoints: decided ? [{ point: "p", recommendation: "r", raise: null }] : [],
    source: { form: "issue", repository: "o/n", number: 1 },
    title: "t",
    labels: [],
  };
  const goal = {
    goalId: "g",
    repository: "o/n",
    clauses: [{ said: "s", unmetIf: "u" }],
    writtenBy: "me",
    writtenAtMs: 0,
  };
  return flowBody(ranked, goal);
}

function seed(path: string): void {
  const db = new DatabaseSync(path);
  const proposal = db.prepare(
    "INSERT INTO proposal (proposal_id, kind, drafter, payload, proposal_digest, snapshot, " +
      "snapshot_digest, derivation, created_at_ms) VALUES (?, ?, 'd', ?, 'x', ?, 'x', ?, ?)",
  );
  const triage = (id: string, at: number, ranked: Record<string, unknown>[]): void => {
    proposal.run(
      id,
      "triage",
      JSON.stringify({ repository: "o/n", goal_id: "g", ranked, withheld: [], read: {} }),
      "{}",
      null,
      at,
    );
  };
  // p1: c1 raises one and decides one; c2 decides only; c3 was written before
  // D-0193 and its point says nothing, so it reads as raised.
  triage("p1", 10, [
    candidate("c1", [point(null), point("dispute")]),
    candidate("c2", [point(null)]),
    candidate("c3", [point("absent")]),
  ]);
  triage("p2", 20, [candidate("c4", [point(null)])]);

  const ask = db.prepare(
    "INSERT INTO flow_ask (ask_id, repository, goal_id, scope_decision_id, proposal_id, " +
      "candidate, points, asked_at_ms) VALUES (?, 'o/n', 'g', 's', ?, ?, ?, 11)",
  );
  const answer = db.prepare(
    "INSERT INTO flow_answer (ask_id, answers, answered_by, answered_at_ms) VALUES (?, ?, 'me', 12)",
  );
  // a1: kept as the answer field draws the recommendation, framing cut.
  ask.run(
    "a1",
    "p1",
    "c1",
    JSON.stringify([{ point: "x", recommendation: "Recommended: keep it" }]),
  );
  answer.run("a1", JSON.stringify([asDecision("Recommended: keep it")]));
  // a2: one point taken as written, one answered otherwise.
  ask.run(
    "a2",
    "p1",
    "c3",
    JSON.stringify([
      { point: "x", recommendation: " B " },
      { point: "y", recommendation: "C" },
    ]),
  );
  answer.run("a2", JSON.stringify(["B", "D"]));
  // a3: still open.
  ask.run("a3", "p1", "c2", JSON.stringify([{ point: "x", recommendation: "B" }]));

  const message = db.prepare(
    "INSERT INTO conversation_message (message_id, body, author_kind, author_id, in_reply_to, " +
      "at_ms, bases, asks, answer_outcome) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const under = (id: string) => JSON.stringify([{ form: "proposal", proposalId: id }]);
  const rows: [
    string,
    string,
    string,
    string,
    string | null,
    number,
    string,
    number,
    string | null,
  ][] = [
    // q1: decided points sent; the person writes deeper in its thread.
    ["q1", sent(true), "drafter", FLOW_AUTHOR, null, 30, under("p1"), 0, null],
    ["q1-ask", "?", "drafter", "rondo/drafter/m", "q1", 31, "[]", 1, null],
    ["q1-press", "ok", "operator", "me", "q1-ask", 32, "[]", 0, "carry_on"],
    ["q1-said", "change it", "operator", "me", "q1-press", 33, "[]", 0, null],
    // q2: decided points sent; the person only pressed an answer.
    ["q2", sent(true), "drafter", FLOW_AUTHOR, null, 40, under("p1"), 0, null],
    ["q2-ask", "?", "drafter", "rondo/drafter/m", "q2", 41, "[]", 1, null],
    ["q2-press", "ok", "operator", "me", "q2-ask", 42, "[]", 0, "carry_on"],
    // q3: nothing decided was sent, so a reply is not counted.
    ["q3", sent(false), "drafter", FLOW_AUTHOR, null, 50, under("p1"), 0, null],
    ["q3-said", "hm", "operator", "me", "q3", 51, "[]", 0, null],
    // q4: the same words from the drafter, not the flow, are not counted.
    ["q4", sent(true), "drafter", "rondo/drafter/m", null, 60, under("p2"), 0, null],
    // q5: sent under p2 and never replied to.
    ["q5", sent(true), "drafter", FLOW_AUTHOR, null, 70, under("p2"), 0, null],
  ];
  for (const row of rows) {
    message.run(...row);
  }

  const explained = (id: string, at: number, signal: Record<string, unknown> | null): void => {
    proposal.run(
      id,
      "explanation",
      "{}",
      JSON.stringify(signal === null ? {} : { signal }),
      "model",
      at,
    );
  };
  const k4 = (about: unknown, origin: string) => ({
    kind: "D-0173 K4",
    questionId: "q",
    origin,
    about,
  });
  explained("e1", 100, k4({ form: "message", messageId: "m1" }, "button"));
  explained("e2", 110, k4({ form: "message", messageId: "m1" }, "text"));
  explained("e3", 120, k4(null, "text"));
  explained("e4", 90, k4({ form: "iteration", iterationId: "i1" }, "button"));
  // An explanation with no signal is not a K4 signal.
  explained("e5", 130, null);
  db.close();
}

test("per triage reading: raised vs decided, answered as recommended, decided then replied", async () => {
  const path = freshStore();
  seed(path);
  const common = { repository: "o/n" };
  expect(openJudgementSignals(path).triageJudgement(null, asDecision)).toEqual([
    {
      ...common,
      reading: "p1",
      atMs: 10,
      candidates: 3,
      raising: 2,
      raised: 2,
      decided: 2,
      asks: 3,
      answered: 2,
      answeredPoints: 3,
      asRecommended: 2,
      sentDecided: 2,
      replied: 1,
    },
    {
      ...common,
      reading: "p2",
      atMs: 20,
      candidates: 1,
      raising: 0,
      raised: 0,
      decided: 1,
      asks: 0,
      answered: 0,
      answeredPoints: 0,
      asRecommended: 0,
      sentDecided: 1,
      replied: 0,
    },
  ]);
  expect(
    openJudgementSignals(path)
      .triageJudgement(20, asDecision)
      .map((r) => r.reading),
  ).toEqual(["p2"]);
  expect(openJudgementSignals(freshStore()).triageJudgement(null, asDecision)).toEqual([]);
});

test("K4 signals per thing asked about, most asked first, over a window", async () => {
  const path = freshStore();
  seed(path);
  const message = '{"form":"message","messageId":"m1"}';
  expect(openJudgementSignals(path).explainSignals(null)).toEqual([
    { about: message, asked: 2, button: 1, text: 1, firstAtMs: 100, lastAtMs: 110 },
    {
      about: '{"form":"iteration","iterationId":"i1"}',
      asked: 1,
      button: 1,
      text: 0,
      firstAtMs: 90,
      lastAtMs: 90,
    },
    { about: null, asked: 1, button: 0, text: 1, firstAtMs: 120, lastAtMs: 120 },
  ]);
  expect(
    openJudgementSignals(path)
      .explainSignals(110)
      .map((r) => [r.about, r.asked]),
  ).toEqual([
    [message, 1],
    [null, 1],
  ]);
});

test("parse: raises and explains take --since and nothing else", () => {
  for (const command of ["raises", "explains"]) {
    const parsed = parseCommand([command, "--since", "1970-01-01T00:00:00.020Z"]);
    expect(parsed.kind === "parsed" && [parsed.parsed.command, parsed.parsed.sinceMs]).toEqual([
      command,
      20,
    ]);
    expect(parseCommand([command, "--attention"]).kind).toBe("refused");
  }
});

test("rondo raises and rondo explains print a line each and one over them all", async () => {
  const run = async (argv: string[], path: string): Promise<string[]> => {
    const out: string[] = [];
    const originalWrite = consoleSeams.write;
    consoleSeams.write = (text: string) => {
      out.push(text);
    };
    try {
      expect(await main(argv, { RONDO_STORE: path })).toBe(0);
    } finally {
      consoleSeams.write = originalWrite;
    }
    return out.join("").trimEnd().split("\n");
  };
  const path = freshStore();
  seed(path);
  expect(await run(["raises"], path)).toEqual([
    "1970-01-01T00:00:00.010Z reading=p1 repository=o/n candidates=3 raising=2 raised=2 decided=2 " +
      "asks=3 answered=2 answered_points=3 as_recommended=2 sent_decided=2 replied=1",
    "1970-01-01T00:00:00.020Z reading=p2 repository=o/n candidates=1 raising=0 raised=0 decided=1 " +
      "asks=0 answered=0 answered_points=0 as_recommended=0 sent_decided=1 replied=0",
    "readings=2 candidates=4 raised=2 decided=3 raising_share=0.50 as_recommended_share=0.67 " +
      "replied_share=0.33 raising_breached=- as_recommended_breached=- replied_breached=-",
  ]);
  expect(await run(["explains", "--since", "1970-01-01T00:00:00.110Z"], path)).toEqual([
    'about={"form":"message","messageId":"m1"} asked=1 button=0 text=1 ' +
      "first=1970-01-01T00:00:00.110Z last=1970-01-01T00:00:00.110Z",
    "about=- asked=1 button=0 text=1 first=1970-01-01T00:00:00.120Z last=1970-01-01T00:00:00.120Z",
    "things=2 asked=2 repeated=0 k4_tripped=no",
  ]);
  expect((await run(["explains"], path)).at(-1)).toBe("things=3 asked=4 repeated=1 k4_tripped=yes");
  expect(await run(["raises"], freshStore())).toEqual([
    "readings=0 candidates=0 raised=0 decided=0 raising_share=- as_recommended_share=- " +
      "replied_share=- raising_breached=- as_recommended_breached=- replied_breached=-",
  ]);
  expect(await run(["explains"], freshStore())).toEqual([
    "things=0 asked=0 repeated=0 k4_tripped=no",
  ]);
});

test("D-0197: each falsifier breaches at its share, not below it, and not with too few", () => {
  const { raising, asRecommended, replied } = FALSIFIER_THRESHOLDS;
  // raising: 0.80 over at least 20 candidates
  expect(breached(16, 20, raising)).toBe("yes");
  expect(breached(15, 20, raising)).toBe("no");
  expect(breached(19, 19, raising)).toBe("-");
  // as recommended: 0.90 over at least 10 answered points
  expect(breached(9, 10, asRecommended)).toBe("yes");
  expect(breached(8, 10, asRecommended)).toBe("no");
  expect(breached(9, 9, asRecommended)).toBe("-");
  // replied: 0.50 over at least 10 sent requests
  expect(breached(5, 10, replied)).toBe("yes");
  expect(breached(4, 10, replied)).toBe("no");
  expect(breached(9, 9, replied)).toBe("-");
});
