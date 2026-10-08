/**
 * The thread explainer's pure half (rondo#401, D-0177): what an answer may
 * say, the answer rondo composes without a model, and the body around both.
 */
import { expect, test } from "vitest";

import {
  admission,
  answerBody,
  DETERMINISTIC_EXPLAINER,
  deterministicAnswer,
  EXPLAINER_CAP_USD,
  EXPLAINER_INPUT_BOUND_BYTES,
  explainerDocument,
  explainerName,
  readExplanation,
} from "../../../src/access/explainer/judgement.js";
import type { ExplainerMaterial } from "../../../src/access/explainer/material.js";
import { chromeFor, EN } from "../../../src/access/wording.js";
import { explainerRow } from "../../../src/continuo/roles.js";
import { EXPLAINER_PREFIX } from "../../../src/store/records.js";

const MATERIAL: ExplainerMaterial = {
  question: {
    messageId: "question-1",
    body: "What does this mean?",
    about: { form: "iteration", iterationId: "lap-1" },
    origin: "button",
  },
  requestMessageId: "request-1",
  thread: [
    {
      messageId: "request-1",
      authorKind: "operator",
      authorId: "ada",
      inReplyTo: null,
      atMs: 1_000,
      body: "Fix the flaky test.\nIt fails one run in ten.",
    },
    {
      messageId: "question-1",
      authorKind: "operator",
      authorId: "ada",
      inReplyTo: "request-1",
      atMs: 3_000,
      body: "What does this mean?",
    },
  ],
  laps: [
    {
      iterationId: "lap-1",
      status: "awaiting_human",
      gateId: "gate-lap-1",
      gateStage: null,
      gateOutcome: null,
      reason: null,
      failureKind: null,
      model: null,
      modelTier: null,
      lapCostUsd: null,
      supersedesIterationId: null,
      createdAtMs: 1_000,
      updatedAtMs: 2_000,
      result: null,
    },
  ],
  waits: [{ kind: "gate", iterationId: "lap-1", status: "awaiting_human" }],
  scope: null,
  words: null,
  locators: ["message:request-1", "message:question-1", "iteration:lap-1"],
};

const ANSWER = {
  act: "answer",
  answer: "The try is waiting for your answer at its gate.",
  claims: [{ label: "The try", value: "waiting on you", basis: "iteration:lap-1" }],
};

test("an answer of the right form is read, bare or in one fence, with its bases as locators", () => {
  const read = readExplanation(MATERIAL, JSON.stringify(ANSWER));
  expect(read).toEqual({
    kind: "read",
    answer: ANSWER.answer,
    claims: [
      {
        label: "The try",
        value: "waiting on you",
        basis: { form: "iteration", iterationId: "lap-1" },
      },
    ],
  });
  expect(readExplanation(MATERIAL, `\`\`\`json\n${JSON.stringify(ANSWER)}\n\`\`\``)).toEqual(read);
});

test.each([
  ["prose around the object", `Here you go: ${JSON.stringify(ANSWER)}`, "not one JSON object"],
  ["an extra key", JSON.stringify({ ...ANSWER, note: "x" }), "'note'"],
  ["an act other than answer", JSON.stringify({ ...ANSWER, act: "split" }), "only answers"],
  ["a split", JSON.stringify({ ...ANSWER, split: { plans: [] } }), "'split'"],
  [
    "asks in a claim",
    JSON.stringify({ ...ANSWER, claims: [{ ...ANSWER.claims[0], asks: true }] }),
    "'asks'",
  ],
  [
    "a locator the material does not hold",
    JSON.stringify({ ...ANSWER, claims: [{ ...ANSWER.claims[0], basis: "iteration:lap-9" }] }),
    "iteration:lap-9",
  ],
  ["no claims", JSON.stringify({ ...ANSWER, claims: [] }), "claims"],
  ["an empty answer", JSON.stringify({ ...ANSWER, answer: " " }), "answer"],
  ["an answer over its bound", JSON.stringify({ ...ANSWER, answer: "x".repeat(1_201) }), "answer"],
])("an answer with %s is refused", (_what, message, reason) => {
  const read = readExplanation(MATERIAL, message);
  expect(read.kind).toBe("refused");
  expect(read.kind === "refused" ? read.reason : "").toContain(reason);
});

test("the fallback is never empty, leads with why, and names what was asked about first", () => {
  const bare: ExplainerMaterial = {
    ...MATERIAL,
    laps: [],
    waits: [],
    question: { ...MATERIAL.question, about: null },
  };
  const nothing = deterministicAnswer(bare, EN, { kind: "noApproval" });
  expect(nothing.claims).toEqual([
    {
      label: EN.explainRequest,
      value: "Fix the flaky test.",
      basis: { form: "message", messageId: "request-1" },
    },
  ]);
  expect(nothing.answer).toContain(EN.explainNoApproval);
  const full = deterministicAnswer(MATERIAL, EN, { kind: "refused", reason: "bad" });
  expect(full.answer).toContain(EN.explainCouldNot);
  expect(full.claims.map((c) => c.basis)).toContainEqual({
    form: "iteration",
    iterationId: "lap-1",
  });
  expect(full.claims.some((c) => c.value === EN.explainWaitsGate)).toBe(true);
  // In the person's language.
  const ja = deterministicAnswer(bare, chromeFor("ja"), { kind: "tooLittleLeft", leftUsd: 0.2 });
  expect(ja.answer).toContain("$0.20");
  expect(ja.answer).not.toContain(EN.explainFallbackLead);
});

test("the body says it decides nothing, what it cost against which approval, and where to answer", () => {
  const claims = [
    { label: "L", value: "V", basis: { form: "message", messageId: "request-1" } as const },
  ];
  const counted = answerBody(EN, MATERIAL, "Prose.", claims, {
    kind: "counted",
    costUsd: 0.03,
  }).body;
  expect(counted).toContain("Prose.\n\n- L: V\n");
  expect(counted).toContain(EN.explainBand);
  expect(counted).toContain(EN.explainCost("0.03", "Fix the flaky test."));
  expect(counted).toContain(EN.explainWhereToAnswer);
  expect(counted).not.toContain("request-1");
  const over = answerBody(EN, MATERIAL, "P", claims, { kind: "counted", costUsd: 0.75 }).body;
  expect(over).toContain(EN.explainOverCap("0.50"));
  const unread = answerBody(EN, MATERIAL, "P", claims, { kind: "counted", costUsd: null }).body;
  expect(unread).toContain(EN.explainCostUnread("0.50", "Fix the flaky test."));
  const free = answerBody(EN, { ...MATERIAL, waits: [] }, "P", claims, { kind: "free" }).body;
  expect(free).toContain(EN.explainFree);
  expect(free).not.toContain(EN.explainWhereToAnswer);
  // The page draws the band and the cost itself, so its text says neither.
  const page = answerBody(EN, MATERIAL, "Prose.", claims, { kind: "counted", costUsd: 0.03 }).page;
  expect(page).toContain("Prose.\n\n- L: V");
  expect(page).toContain(EN.explainWhereToAnswer);
  expect(page).not.toContain(EN.explainBand);
  expect(page).not.toContain("0.03");
});

test("a model is asked only under an approval in force with an answer's cap left", () => {
  const scope = {
    decisionId: "sd-1",
    scopeId: "scope-1",
    approvedUsd: 10,
    spentUsd: 9,
    heldUsd: 0,
    leftUsd: 1,
    expiresAtMs: 5_000,
  };
  expect(admission(MATERIAL, 1_000)).toEqual({ kind: "noApproval" });
  expect(admission({ ...MATERIAL, scope }, 1_000)).toEqual({
    kind: "admitted",
    scopeDecisionId: "sd-1",
  });
  expect(admission({ ...MATERIAL, scope }, 5_000)).toEqual({ kind: "expired" });
  const low = { ...scope, leftUsd: EXPLAINER_CAP_USD - 0.01 };
  expect(admission({ ...MATERIAL, scope: low }, 1_000)).toEqual({
    kind: "tooLittleLeft",
    leftUsd: EXPLAINER_CAP_USD - 0.01,
  });
});

test("an over-long document drops the oldest bodies, keeps every id and the question", () => {
  const long = "y".repeat(EXPLAINER_INPUT_BOUND_BYTES);
  const material: ExplainerMaterial = {
    ...MATERIAL,
    thread: MATERIAL.thread.map((m) => (m.messageId === "request-1" ? { ...m, body: long } : m)),
  };
  const document = explainerDocument(material, "ja");
  expect(new TextEncoder().encode(document).length).toBeLessThanOrEqual(
    EXPLAINER_INPUT_BOUND_BYTES,
  );
  expect(document).toContain("message:request-1");
  expect(document).toContain("What does this mean?");
  expect(document).toContain("language tagged ja");
});

test("the explainer's names sit under its own prefix, never the split drafter's", () => {
  expect(explainerName(explainerRow())).toBe(`${EXPLAINER_PREFIX}1/claude-sonnet-5`);
  expect(DETERMINISTIC_EXPLAINER.startsWith(EXPLAINER_PREFIX)).toBe(true);
  expect(EXPLAINER_PREFIX.startsWith("rondo/drafter/")).toBe(false);
});
