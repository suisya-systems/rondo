/**
 * D-0098 rule 4: a worker's question is carried at its lap's end, holds only
 * its own line, and is answered by a person and never by silence.
 *
 * The thread is a real in-memory `node:sqlite` record, for
 * `request-thread.test.ts`'s reason: whether the ask holds a line is
 * `openAsksIn`'s read of what the writer stored. The iteration row and its
 * reading are handed in, since they are what the gate already wrote.
 */
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import { definitionOfDone } from "../../src/access/done.js";
import {
  answeredQuestion,
  type QuestionPorts,
  questionRevise,
  readWorkerQuestion,
  relayQuestion,
  WORKER_QUESTION_AUTHOR,
} from "../../src/access/question.js";
import {
  askStandsOver,
  DETERMINISTIC_READING_DRAFTER,
  type IterationRecord,
  type LapReading,
} from "../../src/store/records.js";
import { advisoryRecord } from "../../src/store/sqlite.js";

const TIP = "b".repeat(40);
const BASE = "a".repeat(40);

const QUESTION = {
  question: "Which store should the cache use?",
  options: [
    { text: "Memory", gives_up: "Lost on restart." },
    { text: "Disk", gives_up: "Slower." },
  ],
  recommended: 1,
  recommendation: "Disk keeps it across restarts.",
  waits: "The eviction code.",
};

const report = (block: unknown): string =>
  `I built the reader and committed it.\n\n\`\`\`rondo-question\n${JSON.stringify(block, null, 2)}\n\`\`\`\n`;

test("the definition of done asks for independent work first and names the block", () => {
  const done = definitionOfDone([]);
  expect(done).toContain(
    "first build, verify and commit everything that does not depend on the answer",
  );
  expect(done).toContain("Do not guess.");
  expect(done).toContain("```rondo-question");
});

test("no block is no question; the last block is read; a broken block is said to be unreadable", () => {
  expect(readWorkerQuestion("All done, tests pass.")).toEqual({ kind: "none" });
  const read = readWorkerQuestion(report({ ...QUESTION, question: "old" }) + report(QUESTION));
  expect(read.kind === "question" && read.question.question).toBe(QUESTION.question);
  expect(read.kind === "question" && read.question.options[1]?.givesUp).toBe("Slower.");
  for (const broken of [
    "```rondo-question\n{}",
    report({ ...QUESTION, options: [] }),
    report({ ...QUESTION, recommended: 2 }),
    report({ ...QUESTION, extra: 1 }),
    report({ ...QUESTION, waits: "" }),
    "```rondo-question\nnot json\n```",
  ]) {
    expect(readWorkerQuestion(broken).kind, broken).toBe("unreadable");
  }
});

function world(rationale: string | null, tip: string = TIP) {
  const connection = new DatabaseSync(":memory:");
  const record = advisoryRecord(connection);
  const row = {
    id: "it-1",
    runId: "rondo-it-1",
    gateId: "g-1",
    requestMessageId: "m-request",
    plan: { db: "/srv/db" },
  } as unknown as IterationRecord;
  const reading = {
    iterationId: "it-1",
    readAtMs: 1,
    drafter: DETERMINISTIC_READING_DRAFTER,
    verdict: "clear",
    findings: [],
    evidence: { baseRef: "main", baseCommit: BASE, tipCommit: tip },
    unavailableReason: null,
  } as unknown as LapReading;
  const ports: QuestionPorts = {
    record,
    store: {
      read: async () => ({ kind: "read", record: row }),
      readingsFor: async () => [reading],
    } as unknown as QuestionPorts["store"],
    rationale: async () => rationale,
  };
  return { record, ports };
}

async function request(record: ReturnType<typeof advisoryRecord>): Promise<void> {
  await record.recordThreadMessage({
    messageId: "m-request",
    body: "add a cache",
    authorKind: "operator",
    authorId: "oidc|op",
    inReplyTo: null,
    atMs: 1,
    bases: [],
    asks: false,
  });
}

test("a question is put as an ask on its lap, holds that line only, and is released only by carry_on", async () => {
  const { record, ports } = world(report(QUESTION));
  await request(record);
  const line = await relayQuestion(ports, "it-1", 10);
  expect(line).toContain("question-it-1");
  // Once per lap: the second write is refused, not doubled.
  expect(await relayQuestion(ports, "it-1", 11)).toContain("was not put");

  const read = await record.threadMessages();
  const asked =
    read.kind === "read" ? read.messages.find((m) => m.messageId === "question-it-1") : null;
  expect(asked).toMatchObject({
    authorKind: "drafter",
    authorId: WORKER_QUESTION_AUTHOR,
    inReplyTo: "m-request",
    asks: true,
    bases: [
      { form: "iteration", iterationId: "it-1" },
      { form: "continuoRun", runId: "rondo-it-1" },
    ],
  });
  // The worker's words, rondo's numbering, and the commit rondo measured.
  expect(asked?.body).toBe(
    [
      "Which store should the cache use?",
      "",
      "1. Memory",
      "   Lost on restart.",
      "2. Disk",
      "   Slower.",
      "",
      "2. Disk keeps it across restarts.",
      "",
      "The eviction code.",
      "",
      TIP,
    ].join("\n"),
  );

  const open = await record.openAsksIn("m-request");
  const ask = open.kind === "read" ? open.asks[0] : undefined;
  expect(ask?.messageId).toBe("question-it-1");
  expect(ask !== undefined && askStandsOver(ask, ["it-0", "it-1"], false)).toBe(true);
  expect(ask !== undefined && askStandsOver(ask, ["other"], false)).toBe(false);

  // Nothing answers it but a person: unanswered, the revise box has nothing.
  expect(answeredQuestion(read.kind === "read" ? read.messages : [], "it-1")).toBeNull();

  const answer = "Disk, but\n  keep it under 10 MB.  ";
  await record.recordThreadMessage({
    messageId: "m-answer",
    body: answer,
    authorKind: "operator",
    authorId: "oidc|op",
    inReplyTo: "question-it-1",
    atMs: 20,
    bases: [],
    asks: false,
    answerOutcome: "carry_on",
  });
  expect(await record.openAsksIn("m-request")).toEqual({ kind: "read", asks: [] });

  const after = await record.threadMessages();
  const answered = answeredQuestion(after.kind === "read" ? after.messages : [], "it-1");
  expect(answered).toEqual({ question: asked?.body, answer });
  const box = questionRevise(answered ?? { question: "", answer: "" });
  // Both byte for byte.
  expect(box).toContain(`---\n${asked?.body ?? ""}\n---`);
  expect(box).toContain(`---\n${answer}\n---`);
});

test("nothing committed, nothing asked, or nothing read: no ask is written", async () => {
  for (const { rationale, tip } of [
    { rationale: report(QUESTION), tip: BASE },
    { rationale: "Done.", tip: TIP },
    { rationale: null, tip: TIP },
  ]) {
    const { record, ports } = world(rationale, tip);
    await request(record);
    await relayQuestion(ports, "it-1", 10);
    expect(await record.openAsksIn("m-request")).toEqual({ kind: "read", asks: [] });
  }
});

test("an unreadable block is reported in the thread, not dropped, and holds nothing", async () => {
  const { record, ports } = world("```rondo-question\nnot json\n```");
  await request(record);
  expect(await relayQuestion(ports, "it-1", 10)).toContain("question-it-1");
  const read = await record.threadMessages();
  const note =
    read.kind === "read" ? read.messages.find((m) => m.messageId === "question-it-1") : null;
  expect(note?.asks).toBe(false);
  expect(note?.body).toContain("could not read");
});
