/**
 * The thread explainer in the resident host (rondo#401, D-0177), over a real
 * store and a fake `claude`: who answers, what is counted, and that a question
 * never starts the split drafter.
 */
import { expect, test } from "vitest";

import { drafterHost } from "../../../src/access/drafter-host.js";
import { explainerHost } from "../../../src/access/explainer/host.js";
import {
  DETERMINISTIC_EXPLAINER,
  EXPLAINER_CAP_USD,
  explainerName,
} from "../../../src/access/explainer/judgement.js";
import { gatherDrafterMaterial } from "../../../src/access/model-draft/host.js";
import type { DrafterRun } from "../../../src/access/model-draft/judgement.js";
import { EN } from "../../../src/access/wording.js";
import { explainerRow } from "../../../src/continuo/roles.js";
import { planDocument, world } from "../fixtures/drafter.js";
import { approve, asked, LAP, QUESTION, type World } from "./world.js";

const ANSWERED: DrafterRun = {
  kind: "answered",
  costUsd: 0.03,
  finalMessage: JSON.stringify({
    act: "answer",
    answer: "The try waits for your answer at its gate.",
    claims: [{ label: "The try", value: "waiting on you", basis: `iteration:${LAP}` }],
  }),
};

function hostOver(w: World, run: () => Promise<DrafterRun>) {
  const handed: string[] = [];
  const logged: string[] = [];
  let n = 0;
  const host = explainerHost({
    store: w.store,
    record: w.record,
    runDrafter: async (_row, document) => {
      handed.push(document);
      return await run();
    },
    now: () => 5_000,
    mintId: (kind) => {
      n += 1;
      return `${kind}-${String(n)}`;
    },
    language: null,
    log: (line) => logged.push(line),
  });
  return { host, handed, logged };
}

async function answers(w: World) {
  const read = await w.record.threadMessages();
  if (read.kind !== "read") throw new Error(read.reason);
  return read.messages.filter((m) => m.inReplyTo === QUESTION);
}

const proposal = async (w: World, proposalId: string) => {
  const read = await w.record.readProposal(proposalId);
  if (read.kind !== "read") throw new Error(JSON.stringify(read));
  return read.proposal;
};

test("under an approval, the model's answer is written and its cost counted against it", async () => {
  const w = await asked({ form: "iteration", iterationId: LAP });
  await approve(w);
  const before = (await w.record.scopeSpent("sd-1")).readCostUsd;
  const { host, handed } = hostOver(w, async () => ANSWERED);
  host.kick();
  await host.idle();
  expect(handed).toHaveLength(1);
  const [message] = await answers(w);
  expect(message).toMatchObject({
    authorKind: "drafter",
    authorId: explainerName(explainerRow()),
    asks: false,
  });
  expect(message?.body).toContain("The try waits for your answer at its gate.");
  expect(message?.body).toContain(EN.explainBand);
  expect(message?.body).toContain(EN.explainCost("0.03", "Fix the flaky test."));
  expect(message?.bases).toContainEqual({ form: "message", messageId: QUESTION });
  expect(message?.bases).toContainEqual({ form: "iteration", iterationId: LAP });
  const explanation = await proposal(w, "draft-1");
  expect(explanation).toMatchObject({
    kind: "explanation",
    derivation: "model",
    iterationId: null,
  });
  expect(explanation.snapshot).toMatchObject({
    cost_usd: 0.03,
    cost_read: true,
    cap_usd: EXPLAINER_CAP_USD,
    signal: { kind: "D-0173 K4", questionId: QUESTION, origin: "button" },
  });
  expect((await w.record.scopeSpent("sd-1")).readCostUsd).toBeCloseTo(before + 0.03);
  expect(await w.record.unansweredQuestionIds("rondo/explainer/")).toEqual([]);
});

test("with no approval, no model is asked and the records answer, costing nothing", async () => {
  const w = await asked();
  const { host, handed } = hostOver(w, async () => ANSWERED);
  host.kick();
  await host.idle();
  expect(handed).toHaveLength(0);
  const [message] = await answers(w);
  expect(message?.authorId).toBe(DETERMINISTIC_EXPLAINER);
  expect(message?.body).toContain(EN.explainNoApproval);
  expect(message?.body).toContain(EN.explainFree);
  expect((await proposal(w, "draft-1")).derivation).toBe("store_rows");
});

test("a failed run is answered from the records, and the cap is counted for the run", async () => {
  const w = await asked();
  await approve(w);
  const before = (await w.record.scopeSpent("sd-1")).readCostUsd;
  const { host, handed } = hostOver(w, async () => ({ kind: "failed", reason: "no claude" }));
  host.kick();
  await host.idle();
  expect(handed).toHaveLength(1);
  const [message] = await answers(w);
  expect(message?.authorId).toBe(DETERMINISTIC_EXPLAINER);
  expect(message?.body).toContain(EN.explainCouldNot);
  expect(message?.body).toContain(EN.explainCostUnread("0.50", "Fix the flaky test."));
  expect((await w.record.scopeSpent("sd-1")).readCostUsd).toBeCloseTo(before + EXPLAINER_CAP_USD);
});

test("an answer that fails the check is replaced by the records' answer, its cost still counted", async () => {
  const w = await asked();
  await approve(w);
  const { host } = hostOver(w, async () => ({
    kind: "answered",
    costUsd: 0.02,
    finalMessage: JSON.stringify({ act: "split", answer: "Start the work.", claims: [] }),
  }));
  host.kick();
  await host.idle();
  const [message] = await answers(w);
  expect(message?.authorId).toBe(DETERMINISTIC_EXPLAINER);
  expect(message?.body).not.toContain("Start the work.");
  expect((await proposal(w, "draft-1")).snapshot).toMatchObject({
    cost_usd: 0.02,
    unexplained: { kind: "refused" },
  });
});

test("two kicks answer a question once", async () => {
  const w = await asked();
  await approve(w);
  const { host, handed } = hostOver(w, async () => ANSWERED);
  host.kick();
  host.kick();
  await host.idle();
  host.kick();
  await host.idle();
  expect(handed).toHaveLength(1);
  expect(await answers(w)).toHaveLength(1);
});

test("a question does not make its thread due for the split drafter", async () => {
  const w = await world();
  await w.say("r1", "Fix the flaky test.", null, 1_000);
  let drafted = 0;
  const drafter = drafterHost({
    store: w.store,
    record: w.record,
    runDrafter: async () => {
      drafted += 1;
      return { kind: "answered", costUsd: 0, finalMessage: JSON.stringify({ act: "none" }) };
    },
    now: () => 5_000,
    mintId: (kind) => `${kind}-${String(drafted)}`,
    language: null,
    log: () => {},
  });
  drafter.kick();
  await drafter.idle();
  expect(drafted).toBe(1);
  // The question asked after the draft adds nothing due; a reply would.
  await w.say(QUESTION, "What does this mean?", "r1", 2_000);
  expect([...(await drafter.owed())]).not.toContain("r1");
  drafter.kick();
  await drafter.idle();
  expect(drafted).toBe(1);
  await w.say("reply-1", "Also fix the other one.", "r1", 3_000);
  expect([...(await drafter.owed())]).toContain("r1");
});

test("a run that never started is answered from the records and counted as nothing", async () => {
  const w = await asked();
  await approve(w);
  const before = (await w.record.scopeSpent("sd-1")).readCostUsd;
  const { host } = hostOver(w, async () => ({
    kind: "failed",
    reason: "claude: ENOENT",
    notStarted: true,
  }));
  host.kick();
  await host.idle();
  const [message] = await answers(w);
  expect(message?.authorId).toBe(DETERMINISTIC_EXPLAINER);
  expect(message?.body).toContain(EN.explainFree);
  expect((await w.record.scopeSpent("sd-1")).readCostUsd).toBeCloseTo(before);
});

test("a run whose write fails is written on the next scan without running again", async () => {
  const w = await asked();
  await approve(w);
  const before = (await w.record.scopeSpent("sd-1")).readCostUsd;
  let faults = 1;
  const record = {
    ...w.record,
    recordAnswer: async (write: Parameters<typeof w.record.recordAnswer>[0]) =>
      faults-- > 0
        ? { kind: "defect" as const, reason: "database is locked" }
        : await w.record.recordAnswer(write),
  };
  const { host, handed } = hostOver({ ...w, record }, async () => ANSWERED);
  host.kick();
  await host.idle();
  expect(await answers(w)).toHaveLength(0);
  host.kick();
  await host.idle();
  expect(handed).toHaveLength(1);
  expect(await answers(w)).toHaveLength(1);
  expect((await w.record.scopeSpent("sd-1")).readCostUsd).toBeCloseTo(before + 0.03);
});

test("a model answer the store refuses is written as the records' answer, its cost counted", async () => {
  const w = await asked();
  await approve(w);
  const before = (await w.record.scopeSpent("sd-1")).readCostUsd;
  const record = {
    ...w.record,
    recordAnswer: async (write: Parameters<typeof w.record.recordAnswer>[0]) =>
      write.proposal.derivation === "model"
        ? { kind: "refused" as const, reason: "refused for the test" }
        : await w.record.recordAnswer(write),
  };
  const { host } = hostOver({ ...w, record }, async () => ANSWERED);
  host.kick();
  await host.idle();
  const [message] = await answers(w);
  expect(message?.authorId).toBe(DETERMINISTIC_EXPLAINER);
  expect((await w.record.scopeSpent("sd-1")).readCostUsd).toBeCloseTo(before + 0.03);
});

test("a question and its answer are not the split drafter's material, nor a pasted plan", async () => {
  const w = await world();
  await w.say("r1", "Fix the flaky test.", null, 1_000);
  await w.say(QUESTION, JSON.stringify(planDocument()), "r1", 2_000);
  const material = await gatherDrafterMaterial(
    { store: w.store, record: w.record, now: () => 5_000, listPaths: async () => [] },
    "r1",
    null,
  );
  expect(material.thread.map((m) => m.messageId)).toEqual(["r1"]);
  expect(
    material.templates.some((t) => t.from.kind === "message" && t.from.messageId === QUESTION),
  ).toBe(false);
});
