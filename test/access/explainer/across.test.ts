/**
 * A question that opens a thread of its own asks across every request
 * (rondo#626, D-0189): what waits on the person anywhere, each wait under its
 * request and resting on the row that waits, answered from the records alone.
 */
import { expect, test } from "vitest";

import { explainerHost } from "../../../src/access/explainer/host.js";
import {
  DETERMINISTIC_EXPLAINER,
  deterministicAnswer,
} from "../../../src/access/explainer/judgement.js";
import { gatherExplainerMaterial } from "../../../src/access/explainer/material.js";
import { FLOW_STOP } from "../../../src/access/flow-stop.js";
import type { DrafterRun } from "../../../src/access/model-draft/judgement.js";
import { PAGE_EN } from "../../../src/access/page/words.js";
import { EN } from "../../../src/access/wording.js";
import { fresh, operatorPage, portsOver } from "../page-world.js";
import { approve, asked, LAP, QUESTION, REQUEST, type World } from "./world.js";

const ACROSS = "question-across";

async function askAcross(w: World): Promise<void> {
  const said = await w.record.recordThreadMessage({
    messageId: ACROSS,
    body: "What is waiting on me?",
    authorKind: "operator",
    authorId: "ada",
    inReplyTo: null,
    atMs: 4_000,
    bases: [],
    asks: false,
  });
  if (said.kind !== "recorded") throw new Error(JSON.stringify(said));
}

async function answerAll(w: World) {
  const handed: string[] = [];
  let n = 0;
  const host = explainerHost({
    store: w.store,
    record: w.record,
    runDrafter: async (_row, document): Promise<DrafterRun> => {
      handed.push(document);
      return { kind: "failed", reason: "no model in this test" } as unknown as DrafterRun;
    },
    now: () => 5_000,
    mintId: (kind) => {
      n += 1;
      return `${kind}-${String(n)}`;
    },
    language: null,
    log: () => {},
  });
  host.kick();
  await host.idle();
  const read = await w.record.threadMessages();
  if (read.kind !== "read") throw new Error(read.reason);
  return { handed, answer: read.messages.find((m) => m.inReplyTo === ACROSS) };
}

test("the material is every request's waits, each named by its request, with no laps or approval", async () => {
  const w = await asked();
  await askAcross(w);
  const material = await gatherExplainerMaterial(w, ACROSS, 5_000);
  expect(material.requestMessageId).toBe(ACROSS);
  expect(material.thread.map((m) => m.messageId)).toEqual([ACROSS]);
  expect(material.laps).toEqual([]);
  expect(material.scope).toBeNull();
  expect(material.waits).toEqual([
    {
      kind: "gate",
      iterationId: LAP,
      status: "awaiting_human",
      request: { messageId: REQUEST, title: "Fix the flaky test." },
    },
  ]);
  expect(material.locators).toContain(`iteration:${LAP}`);
});

test("it is answered from the records even under an approval, each wait under its request", async () => {
  const w = await asked();
  await approve(w, 10);
  await askAcross(w);
  const { handed, answer } = await answerAll(w);
  // The in-thread question may reach a model; the one across every request never does.
  expect(handed.every((document) => !document.includes("What is waiting on me?"))).toBe(true);
  expect(answer?.authorId).toBe(DETERMINISTIC_EXPLAINER);
  const body = answer?.body ?? "";
  expect(body).toContain(EN.explainAcrossRequests);
  expect(body).toContain(`- Fix the flaky test.: ${EN.explainWaitsGate}`);
  expect(body).toContain(EN.explainFree);
  // Each wait's own link is where it is answered; no "in this thread" line.
  expect(body).not.toContain(EN.explainWhereToAnswer);
  expect(answer?.bases).toContainEqual({ form: "iteration", iterationId: LAP });
  expect(answer?.asks).toBe(false);
  expect(QUESTION).not.toBe(ACROSS);
});

test("with nothing waiting anywhere, the answer says so", async () => {
  const w = fresh();
  await askAcross(w);
  const { answer } = await answerAll(w);
  expect(answer?.body).toContain(`${EN.explainWaiting}: ${EN.explainNothingWaits}`);
});

test("the list names the thread as a question, and its page offers no scope", async () => {
  const w = fresh();
  await askAcross(w);
  const html = await operatorPage(portsOver(w), "t", {
    kind: "thread",
    messageId: ACROSS,
    to: null,
  });
  expect(html).toContain(PAGE_EN.rowQuestion);
  expect(html).not.toContain(PAGE_EN.rowNotStarted);
  expect(html).not.toContain(`id="scope-${ACROSS}"`);
});

test("a question asked again in a question's thread still asks across every request", async () => {
  const w = await asked();
  await askAcross(w);
  const said = await w.record.recordThreadMessage({
    messageId: "question-again",
    body: "And now?",
    authorKind: "operator",
    authorId: "ada",
    inReplyTo: ACROSS,
    atMs: 4_500,
    bases: [],
    asks: false,
  });
  if (said.kind !== "recorded") throw new Error(JSON.stringify(said));
  const material = await gatherExplainerMaterial(w, "question-again", 5_000);
  expect(material.requestMessageId).toBe(ACROSS);
  expect(material.waits.map((wait) => wait.request?.messageId)).toEqual([REQUEST]);
});

test("a paused goal flow is named in the answer, as it is a row under your turn", async () => {
  const w = fresh();
  await askAcross(w);
  const record = {
    ...w.record,
    goals: async () => [{ goalId: "g-1", repository: "acme/widgets" }],
    approvalsInForce: async () => [{ scopeId: "s-1", scopeDecisionId: "sd-1" }],
    readScope: async () => ({
      kind: "read",
      scope: { scopeId: "s-1", payload: { requests: { from_goal: "g-1" }, budgets: { laps: 0 } } },
    }),
  } as unknown as typeof w.record;
  const ports = { store: w.store, record, triageRepositories: async () => ["acme/widgets"] };
  const material = await gatherExplainerMaterial(ports, ACROSS, 5_000);
  expect(material.waits).toEqual([{ kind: "paused", scopeId: "s-1", repository: "acme/widgets" }]);
  expect(material.locators).toContain("scope:s-1");
  // Without the repositories the page draws, no flow is read, as on the page.
  const unread = await gatherExplainerMaterial({ store: w.store, record }, ACROSS, 5_000);
  expect(unread.waits).toEqual([]);
});

test("the goal flow's stop is said as the flow's, not as the old request it is asked in (D-0188)", () => {
  const material = {
    question: { messageId: ACROSS, body: "What is waiting on me?", about: null, origin: "text" },
    requestMessageId: ACROSS,
    thread: [],
    laps: [],
    waits: [
      {
        kind: "ask",
        messageId: `${FLOW_STOP}1`,
        request: { messageId: REQUEST, title: "Fix the flaky test." },
      },
    ],
    scope: null,
    words: null,
    locators: [],
  } as const;
  const { claims } = deterministicAnswer(material, EN, { kind: "acrossRequests" });
  expect(claims[1]).toEqual({
    label: EN.explainWaiting,
    value: PAGE_EN.rowFlowStopped,
    basis: { form: "message", messageId: `${FLOW_STOP}1` },
  });
});

test("on the page, the answer leads to each wait's request, and to no scope screen of the question's own", async () => {
  const w = await asked();
  await askAcross(w);
  await answerAll(w);
  const html = await operatorPage(portsOver(w), "t", {
    kind: "thread",
    messageId: ACROSS,
    to: null,
  });
  const answer = /<article id="drafter-[^"]*"[\s\S]*?<\/article>/.exec(html)?.[0] ?? "";
  expect(answer).toContain(`href="/?thread=${REQUEST}&amp;lang=en#${REQUEST}"`);
  expect(answer).not.toContain(`?scope=${ACROSS}`);
});
