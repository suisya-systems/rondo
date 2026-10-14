/**
 * A question that opens a thread of its own asks across every request
 * (rondo#626, D-0189): what waits on the person anywhere, each wait under its
 * request and resting on the row that waits, answered from the records alone.
 */
import { expect, test } from "vitest";
import { DETERMINISTIC_DRAFTER } from "../../../src/access/advisory.js";
import { explainerHost } from "../../../src/access/explainer/host.js";
import {
  answerBody,
  DETERMINISTIC_EXPLAINER,
  deterministicAnswer,
} from "../../../src/access/explainer/judgement.js";
import {
  type ExplainerWait,
  gatherExplainerMaterial,
} from "../../../src/access/explainer/material.js";
import { FLOW_STOP } from "../../../src/access/flow-stop.js";
import { ago } from "../../../src/access/inbox.js";
import type { DrafterRun } from "../../../src/access/model-draft/judgement.js";
import { PAGE_EN } from "../../../src/access/page/words.js";
import { chromeFor, EN } from "../../../src/access/wording.js";
import { fresh, openGate, operatorPage, portsOver, reserve } from "../page-world.js";
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
      // How long it has waited, from the lap's row (D-0068 rule 2.5, rondo#630).
      forMs: 3_000,
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
  expect(body).toContain(`- "Fix the flaky test": ${EN.explainWaitsGate}`);
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

const FLAKY = { messageId: REQUEST, title: "Fix the flaky test." } as const;

function across(waits: readonly ExplainerWait[]) {
  return {
    question: { messageId: ACROSS, body: "What is waiting on me?", about: null, origin: "text" },
    requestMessageId: ACROSS,
    thread: [],
    laps: [],
    waits,
    scope: null,
    words: null,
    locators: [],
  } as const;
}

test("the goal flow's stop is said as the flow's, under the request it is asked in (D-0188)", () => {
  const material = across([{ kind: "ask", messageId: `${FLOW_STOP}1`, request: FLAKY }]);
  const { claims } = deterministicAnswer(material, EN, { kind: "acrossRequests" });
  expect(claims).toEqual([
    {
      label: `"Fix the flaky test"`,
      value: PAGE_EN.rowFlowStopped,
      basis: { form: "message", messageId: `${FLOW_STOP}1` },
    },
  ]);
});

test("one line per request, named by it; two stops of one flow read as one, and the question is not said again", () => {
  const material = across([
    { kind: "ask", messageId: `${FLOW_STOP}nothing`, request: FLAKY },
    { kind: "ask", messageId: `${FLOW_STOP}expiry`, request: FLAKY },
    { kind: "gate", iterationId: LAP, status: "awaiting_human", request: FLAKY },
    {
      kind: "gate",
      iterationId: "lap-2",
      status: "awaiting_human",
      request: { messageId: "r-2", title: "Add a dark mode." },
    },
  ]);
  const { claims } = deterministicAnswer(material, EN, { kind: "acrossRequests" });
  const body = answerBody(EN, material, "", claims, { kind: "free" }).page;
  expect(body.split("\n").filter((line) => line.startsWith("- "))).toEqual([
    `- "Fix the flaky test": ${PAGE_EN.rowFlowStopped} / ${EN.explainWaitsGate}`,
    `- "Add a dark mode": ${EN.explainWaitsGate}`,
  ]);
  expect(body).not.toContain("What is waiting on me?");
  // In Japanese the title is quoted in brackets, its closing full stop dropped.
  const ja = chromeFor("ja");
  const jaClaims = deterministicAnswer(
    across([
      {
        kind: "gate",
        iterationId: LAP,
        status: "awaiting_human",
        request: { messageId: REQUEST, title: "前提をすり合わせてください。" },
      },
    ]),
    ja,
    { kind: "acrossRequests" },
  ).claims;
  expect(jaClaims.map((claim) => claim.label)).toEqual(["「前提をすり合わせてください」"]);
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

test("one request's waits are one line, and the answer still rests on every waiting row", async () => {
  const w = await asked();
  for (const [messageId, atMs] of [
    ["ask-1", 3_500],
    ["ask-2", 3_600],
  ] as const) {
    const said = await w.record.recordThreadMessage({
      messageId,
      body: "Which branch?",
      authorKind: "drafter",
      authorId: "rondo",
      inReplyTo: REQUEST,
      atMs,
      bases: [{ form: "message", messageId: REQUEST }],
      asks: true,
    });
    if (said.kind !== "recorded") throw new Error(JSON.stringify(said));
  }
  await askAcross(w);
  const { answer } = await answerAll(w);
  const lines = (answer?.body ?? "").split("\n").filter((line) => line.startsWith("- "));
  // Two questions are one reason, said once with the longer wait.
  expect(lines).toEqual([
    `- "Fix the flaky test": ${EN.explainHeldFor(EN.explainWaitsAsk, "2s")} / ${EN.explainHeldFor(EN.explainWaitsGate, "3s")}`,
  ]);
  expect(answer?.bases).toEqual(
    expect.arrayContaining([
      { form: "message", messageId: "ask-1" },
      { form: "message", messageId: "ask-2" },
      { form: "iteration", iterationId: LAP },
      { form: "message", messageId: REQUEST },
    ]),
  );
});

/** A message rondo wrote into `request` at `atMs`, as its reports are written. */
async function rondoSays(
  w: World,
  messageId: string,
  body: string,
  atMs: number,
  request = REQUEST,
) {
  const said = await w.record.recordThreadMessage({
    messageId,
    body,
    authorKind: "drafter",
    authorId: DETERMINISTIC_DRAFTER,
    inReplyTo: request,
    atMs,
    bases: [{ form: "message", messageId: request }],
    asks: false,
  });
  if (said.kind !== "recorded") throw new Error(JSON.stringify(said));
}

/**
 * The person last pressed at 3000 (the question in the request's thread); then
 * a pull request opened and merged, a request's report, and another request's
 * try failed. A pull request closed before that press is not news.
 */
async function endedSinceLooked(): Promise<World> {
  const w = await asked();
  await rondoSays(w, "report-closed-lap-0", "Lap 'lap-0' closed.", 2_900);
  await rondoSays(w, `report-published-${LAP}`, "Opened https://github.com/o/n/pull/12.", 3_200);
  await rondoSays(w, `report-merged-${LAP}`, `Lap '${LAP}' merged into main.`, 3_300);
  await rondoSays(w, "request-report-p1", "What this request did.", 3_400);
  await reserve(w, "lap-2", "Add a dark theme.");
  await openGate(w, "lap-2");
  const failed = await w.store.transition("lap-2", "awaiting_human", "failed", {}, 3_500);
  if (failed.kind !== "transitioned") throw new Error(JSON.stringify(failed));
  await askAcross(w);
  return w;
}

test("what ended since the person last looked is its own section, each under its request (rondo#656)", async () => {
  const w = await endedSinceLooked();
  const material = await gatherExplainerMaterial(w, ACROSS, 5_000);
  // The mark is the press before the question, not the question itself.
  expect(material.results?.forMs).toBe(5_000 - 3_001);
  expect(material.results?.items.map((item) => item.kind).toSorted()).toEqual([
    "lap",
    "merged",
    "opened",
    "report",
  ]);
  for (const locator of [
    `message:report-published-${LAP}`,
    `message:report-merged-${LAP}`,
    "message:request-report-p1",
    "iteration:lap-2",
  ]) {
    expect(material.locators).toContain(locator);
  }
  const { answer, claims } = deterministicAnswer(material, EN, { kind: "acrossRequests" });
  expect(claims).toContainEqual({
    label: '"Fix the flaky test"',
    value: "Pull request #12, merged",
    basis: { form: "message", messageId: `report-merged-${LAP}` },
  });
  expect(claims).toContainEqual({
    label: '"Add a dark theme"',
    value: "a try failed",
    basis: { form: "iteration", iterationId: "lap-2" },
  });
  const { page } = answerBody(EN, material, answer, claims, { kind: "free" });
  const section = page.slice(page.indexOf(EN.explainResultsLead(EN.age(ago(0, 1_999)))));
  expect(section).toContain('- "Fix the flaky test": Pull request #12, opened');
  expect(section).toContain(`- "Fix the flaky test": ${EN.explainReported}`);
  expect(section).not.toContain("closed without merging");
  // The waits come first, under their own lead.
  expect(page.indexOf(EN.explainAcrossLead)).toBeLessThan(page.indexOf(section));
  // And in the other catalogue, composed again from the same material.
  const ja = chromeFor("ja");
  const inJa = deterministicAnswer(material, ja, { kind: "acrossRequests" });
  const jaPage = answerBody(ja, material, inJa.answer, inJa.claims, { kind: "free" }).page;
  expect(jaPage).toContain(ja.explainResultsLead(ja.age(ago(0, 1_999))));
  expect(jaPage).toContain(`- 「Add a dark theme」: ${ja.explainLapEnded("failed")}`);
});

test("with no mark the answer reads the last day, and says so", async () => {
  const w = fresh();
  await askAcross(w);
  const material = await gatherExplainerMaterial(w, ACROSS, 5_000);
  expect(material.results).toEqual({ forMs: null, items: [], more: 0 });
  const { answer, claims } = deterministicAnswer(material, EN, { kind: "acrossRequests" });
  expect(answerBody(EN, material, answer, claims, { kind: "free" }).page).toContain(
    EN.explainResultsNone(null),
  );
});

test("a fix pushed onto an open pull request is not said as one opened, and a later mark is not read", async () => {
  const w = await asked();
  await rondoSays(
    w,
    `report-published-${LAP}`,
    `Lap '${LAP}' commits were pushed onto https://github.com/o/n/pull/12, which stays open.`,
    3_200,
  );
  await rondoSays(w, `report-merged-${LAP}`, `Lap '${LAP}' merged into main.`, 3_300);
  await askAcross(w);
  // `rondo inbox` run after the question moves no mark this answer reads.
  await w.record.recordView("ada", 4_500);
  const material = await gatherExplainerMaterial(w, ACROSS, 5_000);
  expect(material.results?.forMs).toBe(5_000 - 3_001);
  expect(material.results?.items.map((item) => item.kind)).toEqual(["merged"]);
});

test("a decision since the mark is said in the same section, and one before it is not (rondo#656)", async () => {
  const w = await asked();
  // Before the mark (3001): bob stopped rondo's ask.
  const asks = await w.record.recordThreadMessage({
    messageId: "ask-split",
    body: "Split it in two?",
    authorKind: "drafter",
    authorId: DETERMINISTIC_DRAFTER,
    inReplyTo: REQUEST,
    atMs: 2_750,
    bases: [{ form: "message", messageId: REQUEST }],
    asks: true,
  });
  if (asks.kind !== "recorded") throw new Error(JSON.stringify(asks));
  const stop = await w.record.recordThreadMessage({
    messageId: "answer-old",
    body: "No.",
    authorKind: "operator",
    authorId: "bob",
    inReplyTo: "ask-split",
    atMs: 2_800,
    bases: [],
    asks: false,
    answerOutcome: "stop",
  });
  if (stop.kind !== "recorded") throw new Error(JSON.stringify(stop));
  // Since the mark: rondo approved the lap at its gate.
  await w.store.recordGateAnswer(LAP, `gate-${LAP}`, "approve", "rondo/gate", 3_500);
  await askAcross(w);
  const material = await gatherExplainerMaterial(w, ACROSS, 5_000);
  expect(material.results?.items.filter((item) => item.kind === "decision")).toEqual([
    {
      kind: "decision",
      locator: `iteration:${LAP}`,
      by: "rondo",
      outcome: "approve",
      option: null,
      request: { messageId: REQUEST, title: "Fix the flaky test." },
    },
  ]);
  expect(material.locators).toContain(`iteration:${LAP}`);
  const { answer, claims } = deterministicAnswer(material, EN, { kind: "acrossRequests" });
  expect(claims).toContainEqual({
    label: '"Fix the flaky test"',
    value: "rondo approved at the gate",
    basis: { form: "iteration", iterationId: LAP },
  });
  const { page } = answerBody(EN, material, answer, claims, { kind: "free" });
  const section = page.slice(page.indexOf(EN.explainResultsLead(EN.age(ago(0, 1_999)))));
  expect(section).toContain('- "Fix the flaky test": rondo approved at the gate');
  expect(section).not.toContain("answered: stop");
  const ja = chromeFor("ja");
  const inJa = deterministicAnswer(material, ja, { kind: "acrossRequests" });
  expect(answerBody(ja, material, inJa.answer, inJa.claims, { kind: "free" }).page).toContain(
    "- 「Fix the flaky test」: rondoがゲートで承認しました",
  );
});
