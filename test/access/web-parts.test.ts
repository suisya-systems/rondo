/**
 * D-0098 rule 8 (D-0129): a request run as several lines, said on the page --
 * one row counting its parts, one step per part on the right face, and the
 * other parts' state under the title.
 *
 * Over a real store file, with a split drafted the way the host drafts one and
 * approved from the page, as `test/access/order-host.test.ts` builds it.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";
import { recordDraftedScopeFromPage } from "../../src/access/cli.js";
import { drafterHost } from "../../src/access/drafter-host.js";
import { draftedPlanRun } from "../../src/access/model-draft/host.js";
import { unlandedBody, unlandedPrefix } from "../../src/access/order-host.js";
import { partStepOf } from "../../src/access/page/thread-side.js";
import { relayQuestion } from "../../src/access/question.js";
import { chromeFor, EN } from "../../src/access/wording.js";

import { allocate } from "../../src/refrain/allocator.js";
import { admittedPlan, planPayload, type RunPlan } from "../../src/refrain/plan.js";
import { planDigest } from "../../src/store/plan.js";
import type { JsonRecord } from "../../src/store/records.js";
import { advisoryRecord, iterationStore } from "../../src/store/sqlite.js";
import { agentTypeDigestOf, planDocument } from "./fixtures/drafter.js";
import { EVIDENCE, mint, openGate, operatorPage, portsOver } from "./page-world.js";

const ENV = { RONDO_APPROVER: "ada" };
const JA = chromeFor("ja");

/** A split of `after.length` plans, drafted and approved; `after[i]` orders plan `i`. */
async function split(after: readonly (number | undefined)[]) {
  const dir = mkdtempSync(join(tmpdir(), "rondo-parts-"));
  const storePath = join(dir, "store.db");
  const connection = new DatabaseSync(storePath);
  const record = advisoryRecord(connection);
  const store = iterationStore(connection, { maxOccupying: 4, maxLive: 6 });
  await record.messagesBeforeDrafter(0);
  const document = planDocument();
  const say = async (messageId: string, body: string, inReplyTo: string | null, atMs: number) => {
    const outcome = await record.recordThreadMessage({
      messageId,
      body,
      authorKind: "operator",
      authorId: "ada",
      inReplyTo,
      atMs,
      bases: [],
      asks: false,
    });
    if (outcome.kind !== "recorded") throw new Error(JSON.stringify(outcome));
  };
  await say("r1", "Change the library, then move the pin.", null, 1_000);
  await say("r1-plan", JSON.stringify(document), "r1", 2_000);
  const typeDigest = agentTypeDigestOf(document);
  let n = 0;
  const host = drafterHost({
    store,
    record,
    now: () => 3_000,
    language: null,
    log: () => undefined,
    mintId: (kind) => {
      n += 1;
      return `${kind}-${String(n)}`;
    },
    runDrafter: async () => ({
      kind: "answered",
      costUsd: 0.05,
      finalMessage: JSON.stringify({
        act: "split",
        summary: { text: "Parts.", bases: ["r1"] },
        plans: after.map((one, i) => ({
          template_plan_digest: planDigest(document),
          agent_type_digest: typeDigest,
          prompt: `Part ${String(i + 1)} of the work.`,
          bases: ["r1"],
          claim: [`part${String(i)}/`],
          ...(one === undefined ? {} : { after: one }),
        })),
      }),
    }),
  });
  host.kick();
  await host.idle();
  const scopeRow = connection
    .prepare("SELECT scope_id FROM scope WHERE author_kind = 'drafter'")
    .get() as { scope_id: string };
  const proposalRow = connection
    .prepare("SELECT proposal_id FROM proposal WHERE kind = 'split'")
    .get() as { proposal_id: string };
  const scope = await record.readScope(scopeRow.scope_id);
  if (scope.kind !== "read") throw new Error("the drafted scope did not read");
  const approved = await recordDraftedScopeFromPage(ENV, storePath, "ada", {
    draftScopeId: scope.scope.scopeId,
    draftDigest: scope.scope.scopeDigest,
    scopeId: "scope-mine-1",
    budgets: scope.scope.payload.budgets,
    severityThreshold: scope.scope.payload.severity_threshold,
    outwardActs: scope.scope.payload.outward_acts,
  });
  const world = { connection, record, store };
  const decision = approved.scopeDecisionId as string;
  const proposalId = proposalRow.proposal_id;
  /** Start plan `index` as lap `id`, the way a press admits it. */
  const start = async (index: number, id: string) => {
    const run = await draftedPlanRun(world, "r1", proposalId, index);
    if (run.kind !== "runnable") throw new Error(`plan ${String(index)} does not run`);
    const outcome = await store.reserve({
      numbers: null,
      id,
      request: "Change the library, then move the pin.",
      plan: admittedPayload(run.plan, id),
      spend: null,
      scopeSpend: { scopeDecisionId: decision, proposalId, agentTypeDigest: typeDigest },
      claim: run.claim,
      nowMs: 3_500,
      supersedesIterationId: null,
      requestMessageId: "r1",
      runId: `rondo-${id}`,
      topicBranch: `rondo/${id}`,
      workspace: `/srv/work/${id}`,
    });
    expect(outcome.kind, JSON.stringify(outcome)).toBe("reserved");
  };
  return { world, proposalId, decision, start };
}

function admittedPayload(plan: RunPlan, id: string): JsonRecord {
  const allocation = allocate(id, plan.workspaceRoot);
  if (allocation.kind !== "allocated") throw new Error(allocation.reason);
  const admitted = admittedPlan(plan, allocation.allocation);
  if (admitted.kind !== "planned") throw new Error(admitted.reason);
  return planPayload(admitted.plan);
}

const page = async (world: Parameters<typeof portsOver>[0], wording = EN) =>
  await operatorPage(
    portsOver(world, "ada", []),
    "t",
    { kind: "thread", messageId: "r1", to: null },
    wording,
    mint,
  );

/** The list row's sentence of state for the one request. */
function rowSaid(html: string): string {
  const row = /<a class="list-row[^"]*"[^>]*>([\s\S]*?)<\/a>/.exec(html)?.[1] ?? "";
  return (/<p>([\s\S]*?)<\/p>/.exec(row)?.[1] ?? "").replace(/<[^>]+>/g, "");
}

test("a request run as several lines is one row, and its sentence counts the parts (D-0098 rule 8.1)", async () => {
  const w = await split([undefined, undefined, 0]);
  expect(rowSaid(await page(w.world))).toBe(
    "3 parts: 1 waiting for another part to be merged, 2 not started",
  );

  await w.start(0, "lap-one");
  await w.start(1, "lap-two");
  const html = await page(w.world);
  expect(html.match(/<a class="list-row/g)).toHaveLength(1);
  expect(rowSaid(html)).toBe("2 of 3 parts running, 1 waiting for another part to be merged");
  // A wait rondo clears itself is not amber: only *your turn* is.
  expect(html).not.toContain("list-row-mine");
  expect(rowSaid(await page(w.world, JA))).toBe(
    "作業 3 件のうち 2 件が進行中、1 件はほかの作業のマージ待ち",
  );
});

test("a request run as one line keeps its one sentence of state", async () => {
  const w = await split([undefined]);
  await w.start(0, "lap-one");
  expect(rowSaid(await page(w.world))).toBe(EN.rowRunning);
});

/** The right face's steps, one per part, as text: name, then what it says. */
function partSteps(html: string): string[] {
  return [...html.matchAll(/<li class="side-part( side-part-yours)?">([\s\S]*?)<\/li>/g)].map(
    (m) => `${m[1] === undefined ? "" : "[yours] "}${(m[2] ?? "").replace(/<[^>]+>/g, "")}`,
  );
}

test("each part's wait is one step of what remains, and starts by itself (D-0098 rule 8.2)", async () => {
  const w = await split([undefined, 0]);
  await w.start(0, "lap-one");
  expect(partSteps(await page(w.world))).toEqual([
    "Part 1under way",
    "Part 2waiting until part 1 is merged; then it starts by itself",
  ]);
});

test("a part whose earlier part ended unmerged is the person's: amber, with the question linked (D-0098 rules 1.5 and 8.2)", async () => {
  const w = await split([undefined, 0]);
  await w.start(0, "lap-one");
  expect((await w.world.store.transition("lap-one", "planned", "abandoned", {}, 3_600)).kind).toBe(
    "transitioned",
  );
  const askId = `${unlandedPrefix({ proposalId: w.proposalId }, 1)}lap-one`;
  const asked = await w.world.record.recordThreadMessage({
    messageId: askId,
    body: unlandedBody(1, 0, "lap-one"),
    authorKind: "drafter",
    authorId: "rondo/deterministic/1",
    inReplyTo: "r1",
    atMs: 3_700,
    bases: [{ form: "message", messageId: "r1" }],
    asks: true,
  });
  expect(asked.kind, JSON.stringify(asked)).toBe("recorded");
  const html = await page(w.world);
  expect(partSteps(html)).toEqual([
    "Part 1stopped",
    "[yours] Part 2part 1 ended without being merged, so this one will not start by itself Answer the question",
  ]);
  expect(html).toContain(`href="#${askId}"`);
  // The row is the person's turn, and says which part.
  expect(html).toContain("list-row-mine");
  expect(rowSaid(html)).toBe("2 parts: 1 needs you, 1 stopped");
});

test("a wait on another repository names it and its pull request", () => {
  const step = partStepOf(EN, {
    index: 1,
    standing: "waiting",
    wait: {
      after: 0,
      first: "awaitingLanding",
      place: "cadenza",
      pullRequest: { url: "https://github.com/o/cadenza/pull/131", number: "131" },
      askId: null,
    },
    pullRequest: null,
    laps: [],
  });
  expect(step).toEqual({
    name: "Part 2",
    said: "waiting until cadenza #131 is merged; then it starts by itself",
    yours: false,
    links: [{ href: "https://github.com/o/cadenza/pull/131", said: "#131" }],
  });
});

test("the scope screen says what an ordered part waits on, and draws no press for it", async () => {
  const w = await split([undefined, 0]);
  const html = await operatorPage(
    portsOver(w.world, "ada", []),
    "t",
    { kind: "scope", messageId: "r1", rounds: null, decisionId: w.decision, plan: null },
    EN,
    mint,
  );
  expect(html).toContain("waiting until part 1 is merged; then it starts by itself");
  expect(html).not.toContain('name="plan_index" value="1"');
});

const QUESTION = {
  question: "Should the pin move to the tag or the commit?",
  options: [
    { text: "The tag", gives_up: "an exact commit" },
    { text: "The commit", gives_up: "a readable name" },
  ],
  recommended: 1,
  recommendation: "The commit, since the tag can move.",
  waits: "the pin bump in package.json",
};
const RATIONALE = `Built the loader.\n\n\`\`\`rondo-question\n${JSON.stringify(QUESTION)}\n\`\`\`\n`;

/** Part 1 at its gate with the worker's question put; part 2 still running. */
async function questioned(after: readonly (number | undefined)[] = [undefined, undefined]) {
  const w = await split(after);
  await w.start(0, "lap-one");
  if (after[1] === undefined) {
    await w.start(1, "lap-two");
  }
  await openGate(w.world as never, "lap-one");
  const carried = await w.world.store.transition(
    "lap-one",
    "awaiting_human",
    "awaiting_human",
    {},
    3_700,
    {
      drafter: "rondo/deterministic/2",
      verdict: "clear",
      findings: [],
      evidence: EVIDENCE,
      unavailableReason: null,
    },
  );
  expect(carried.kind).toBe("transitioned");
  const put = await relayQuestion(
    { record: w.world.record, store: w.world.store, rationale: async () => RATIONALE },
    "lap-one",
    3_800,
  );
  expect(put).toContain("question-lap-one");
  return w;
}

const gatePage = async (w: Awaited<ReturnType<typeof split>>, wording = EN) =>
  await operatorPage(
    {
      ...portsOver(w.world, "ada", []),
      material: async () => ({ lines: [], why: RATIONALE, work: null }),
    },
    "t",
    { kind: "thread", messageId: "r1", to: null },
    wording,
    mint,
    () => "scope-x",
    () => "lap-next",
  );

test("a worker's question: one line over the box says what was built and what waits, and the other parts keep their state under the title (D-0098 rule 8.3)", async () => {
  const w = await questioned();
  const html = await gatePage(w);
  const lead =
    "The worker built and committed bbbbbbb before stopping to ask. Waiting on your answer: the pin bump in package.json";
  expect(html).toContain(lead);
  // Directly above the box: nothing of the thread's record comes between.
  const at = html.indexOf(lead);
  const box = html.indexOf('id="answering"');
  expect(at).toBeGreaterThan(-1);
  expect(box).toBeGreaterThan(at);
  expect(html.slice(at, box)).not.toContain('class="msg ');
  expect(html.slice(at, box)).toContain('href="#changed"');
  // The line under the title keeps the other part's state.
  expect(html).toContain('<span class="gov-parts">1 other part still running</span>');
  expect(await gatePage(w, JA)).toContain('<span class="gov-parts">ほかの作業 1 件は進行中</span>');
});

/** The revise box's sentence about the question, as text. */
const answerSaid = (html: string) =>
  (/<p id="revise-answer"[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1] ?? "").replace(/<[^>]+>/g, "");

test("the revise box says what answering releases and how long the question has waited, with no deadline; once answered it holds the answer (D-0098 rules 4.5 and 8.4)", async () => {
  const w = await questioned([undefined, 0]);
  const open = await gatePage(w);
  expect(answerSaid(open)).toBe(
    "Once the question is answered, this starts part 1's next attempt with your answer in it. " +
      "Answering also moves on part 2, which waits for this part to be merged. " +
      "The question has waited 1s.",
  );
  // Never a countdown, and never what rondo will assume.
  expect(open).not.toMatch(/will assume|countdown|remaining|left to answer/i);

  const answer = "The commit,\n  pinned exactly.  ";
  const said = await w.world.record.recordThreadMessage({
    messageId: "m-answer",
    body: answer,
    authorKind: "operator",
    authorId: "ada",
    inReplyTo: "question-lap-one",
    atMs: 4_500,
    bases: [],
    asks: false,
    answerOutcome: "carry_on",
  });
  expect(said.kind).toBe("recorded");
  const answered = await gatePage(w);
  // Answered: no clock, and the box holds the question and the answer byte for byte.
  expect(answerSaid(answered)).toBe(
    "Once the question is answered, this starts part 1's next attempt with your answer in it. " +
      "Answering also moves on part 2, which waits for this part to be merged.",
  );
  const box = /<textarea name="body"[^>]*>([\s\S]*?)<\/textarea>/.exec(answered)?.[1] ?? "";
  expect(box).toContain(`---\n${answer}\n---`);
  expect(box).toContain("Should the pin move to the tag or the commit?");
  expect(answered).toContain(EN.reviseAnswerDrafted.replaceAll("'", "&#x27;").slice(0, 20));
  expect(answerSaid(await gatePage(w, JA))).toBe(
    "質問に答えたあとにこれを押すと、あなたの返事を入れて作業 1 の次の回を始めます。" +
      "返事をすると、この作業のマージを待っている作業 2 も先へ進みます。",
  );
});
