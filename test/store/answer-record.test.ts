/**
 * The thread explainer's store side (rondo#401, D-0177): a question is an
 * operator row under `question-`, it never asks for work, and one answer --
 * explanation proposal, drafter message, and the claim that counts its cost --
 * is written all or nothing.
 */
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import type { AnswerWrite } from "../../src/store/contract.js";
import {
  asksForWork,
  EXPLAINER_PREFIX,
  isQuestion,
  type ProposalDraft,
  QUESTION_ID_PREFIX,
  type ThreadMessageDraft,
} from "../../src/store/records.js";
import { advisoryRecord } from "../../src/store/sqlite.js";

const EXPLAINER = `${EXPLAINER_PREFIX}1/claude-sonnet-5`;
const QUESTION = `${QUESTION_ID_PREFIX}0001`;

const operator = (messageId: string, inReplyTo: string | null): ThreadMessageDraft => ({
  messageId,
  body: messageId === QUESTION ? "What does this mean?" : "Fix the flaky test.",
  authorKind: "operator",
  authorId: "ada",
  inReplyTo,
  atMs: 1_000,
  bases: [],
  asks: false,
});

async function asked() {
  const connection = new DatabaseSync(":memory:");
  const record = advisoryRecord(connection);
  for (const m of [operator("request-1", null), operator(QUESTION, "request-1")]) {
    expect(await record.recordThreadMessage(m)).toEqual({ kind: "recorded" });
  }
  return { connection, record };
}

function answer(
  parts: { proposal?: Partial<ProposalDraft>; message?: Partial<ThreadMessageDraft> } = {},
  claim: AnswerWrite["claim"] = null,
): AnswerWrite {
  const proposal: ProposalDraft = {
    proposalId: "explanation-1",
    kind: "explanation",
    drafter: EXPLAINER,
    payload: { claims: [] },
    snapshot: { cost_usd: 0.03, cost_read: true, cap_usd: 0.5 },
    derivation: "model",
    iterationId: null,
    supersedesIterationId: null,
    supersedesProposalId: null,
    predecessorPlanDigest: null,
    predecessorContractDigest: null,
    agentTypeDigest: null,
    configDigest: null,
    contractDigest: null,
    continuoRevision: null,
    cadenzaRevision: null,
    elevatedFromMessageId: null,
    elevatedByActorId: null,
    createdAtMs: 2_000,
    ...parts.proposal,
  };
  return {
    questionId: QUESTION,
    drafterPrefix: EXPLAINER_PREFIX,
    proposal,
    message: {
      messageId: "answer-1",
      body: "It means the lap is waiting.",
      authorKind: "drafter",
      authorId: EXPLAINER,
      inReplyTo: QUESTION,
      atMs: 2_000,
      bases: [
        { form: "message", messageId: QUESTION },
        { form: "proposal", proposalId: proposal.proposalId },
      ],
      asks: false,
      ...parts.message,
    },
    claim,
  };
}

const count = (connection: DatabaseSync, table: string): number =>
  Number((connection.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n);

test("a question is the person's row under its prefix, and it never asks for work", () => {
  const question = { authorKind: "operator", messageId: QUESTION, inReplyTo: "request-1" };
  expect(isQuestion(question)).toBe(true);
  expect(asksForWork(question)).toBe(false);
  // The prefix marks only a person's row; a drafter's id under it is no question.
  expect(isQuestion({ ...question, authorKind: "drafter" })).toBe(false);
  expect(asksForWork({ ...question, messageId: "reply-1" })).toBe(true);
});

test("a question asked while a split draft runs does not make that draft stale", async () => {
  const { record } = await asked();
  const outcome = await record.recordDraft({
    requestMessageId: "request-1",
    operatorMessageIds: ["request-1"],
    drafterPrefix: "rondo/drafter/",
    proposal: null,
    scope: null,
    messages: [
      {
        ...operator("note-1", "request-1"),
        authorKind: "drafter",
        authorId: "rondo/drafter/1/x",
        bases: [{ form: "message", messageId: "request-1" }],
      },
    ],
  });
  expect(outcome).toEqual({ kind: "recorded" });
});

test("one answer writes the explanation, the message and the claim, then is answered", async () => {
  const { connection, record } = await asked();
  expect(await record.unansweredQuestionIds(EXPLAINER_PREFIX)).toEqual([QUESTION]);
  expect(await record.recordAnswer(answer({}, { scopeDecisionId: "sd-1", nowMs: 2_000 }))).toEqual({
    kind: "answered",
    proposalId: "explanation-1",
    messageId: "answer-1",
  });
  expect(await record.unansweredQuestionIds(EXPLAINER_PREFIX)).toEqual([]);
  // Another drafter's prefix has answered nothing.
  expect(await record.unansweredQuestionIds("rondo/drafter/")).toEqual([QUESTION]);
  expect((await record.scopeSpent("sd-1")).readCostUsd).toBeCloseTo(0.03);
  // A second writer finds it answered and writes nothing more.
  const again = answer({
    proposal: { proposalId: "explanation-2" },
    message: {
      messageId: "answer-2",
      bases: [
        { form: "message", messageId: QUESTION },
        { form: "proposal", proposalId: "explanation-2" },
      ],
    },
  });
  expect(await record.recordAnswer(again)).toEqual({
    kind: "alreadyAnswered",
    questionId: QUESTION,
  });
  expect(count(connection, "proposal")).toBe(1);
});

test("an answer whose cost was not read counts its cap against the approval", async () => {
  const { record } = await asked();
  const write = answer(
    { proposal: { snapshot: { cost_usd: null, cost_read: false, cap_usd: 0.5 } } },
    { scopeDecisionId: "sd-1", nowMs: 2_000 },
  );
  expect((await record.recordAnswer(write)).kind).toBe("answered");
  expect((await record.scopeSpent("sd-1")).readCostUsd).toBeCloseTo(0.5);
});

test("a write that breaks the answer's shape names the field and writes nothing", async () => {
  const { connection, record } = await asked();
  for (const [parts, field] of [
    [{ proposal: { kind: "split", derivation: null } }, "proposal.kind"],
    [{ proposal: { drafter: "rondo/drafter/1/x" } }, "proposal.drafter"],
    [{ message: { asks: true } }, "message.asks"],
    [{ message: { inReplyTo: "request-1" } }, "message.inReplyTo"],
    [{ message: { bases: [{ form: "message", messageId: QUESTION }] } }, "message.bases"],
  ] as const) {
    const outcome = await record.recordAnswer(answer(parts as Parameters<typeof answer>[0]));
    expect(outcome.kind === "malformed" ? outcome.field : outcome.kind).toBe(field);
  }
  expect(count(connection, "proposal")).toBe(0);
});

test("an answer to no question, or a refused message, leaves nothing behind", async () => {
  const { connection, record } = await asked();
  const notAsked = answer({
    message: {
      inReplyTo: "request-1",
      bases: [
        { form: "message", messageId: "request-1" },
        { form: "proposal", proposalId: "explanation-1" },
      ],
    },
  });
  expect(await record.recordAnswer({ ...notAsked, questionId: "request-1" })).toEqual({
    kind: "notAQuestion",
    questionId: "request-1",
  });
  // The message cites a message that is not there: the store refuses it after
  // the proposal went in, and the proposal is rolled back with it.
  const dangling = answer({
    message: {
      bases: [
        { form: "message", messageId: QUESTION },
        { form: "proposal", proposalId: "explanation-1" },
        { form: "message", messageId: "nowhere" },
      ],
    },
  });
  expect((await record.recordAnswer(dangling)).kind).toBe("refused");
  // A claim already taken for the subject refuses the whole answer too.
  connection
    .prepare(
      "INSERT INTO scope_consumption VALUES ('sd-0', 'explanation_reading', 'explanation-1', NULL, 1)",
    )
    .run();
  expect((await record.recordAnswer(answer({}, { scopeDecisionId: "sd-1", nowMs: 1 }))).kind).toBe(
    "refused",
  );
  expect(count(connection, "proposal")).toBe(0);
  expect(await record.unansweredQuestionIds(EXPLAINER_PREFIX)).toEqual([QUESTION]);
});

test("an answer that also cites another question does not answer that one", async () => {
  const { record } = await asked();
  const other = `${QUESTION_ID_PREFIX}0002`;
  expect(await record.recordThreadMessage(operator(other, "request-1"))).toEqual({
    kind: "recorded",
  });
  const citing = answer({
    message: {
      bases: [
        { form: "message", messageId: QUESTION },
        { form: "proposal", proposalId: "explanation-1" },
        { form: "message", messageId: other },
      ],
    },
  });
  expect((await record.recordAnswer(citing)).kind).toBe("answered");
  // The other question is still owed its own answer: only a reply answers.
  expect(await record.unansweredQuestionIds(EXPLAINER_PREFIX)).toEqual([other]);
});
