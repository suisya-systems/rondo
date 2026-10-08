/**
 * What the thread explainer is handed (rondo#401, D-0177), read off a real
 * store: the question, its thread, the request's laps and waits, and the
 * approval in force.
 */
import { expect, test } from "vitest";

import { drafterHost } from "../../../src/access/drafter-host.js";
import { answerBody, deterministicAnswer } from "../../../src/access/explainer/judgement.js";
import { gatherExplainerMaterial } from "../../../src/access/explainer/material.js";
import { EN } from "../../../src/access/wording.js";
import { planDigest } from "../../../src/store/plan.js";
import { FLOW_AUTHOR } from "../../../src/store/records.js";
import { agentTypeDigestOf, planDocument, world } from "../fixtures/drafter.js";
import { fresh, PLAN } from "../page-world.js";
import { approve, asked, LAP, QUESTION, REQUEST } from "./world.js";

test("a question beside a lap is handed its thread, the lap waiting at its gate, and no approval", async () => {
  const w = await asked({ form: "iteration", iterationId: LAP });
  const material = await gatherExplainerMaterial(w, QUESTION, 5_000);
  expect(material.question).toEqual({
    messageId: QUESTION,
    body: "What does this mean?",
    about: { form: "iteration", iterationId: LAP },
    origin: "button",
  });
  expect(material.requestMessageId).toBe(REQUEST);
  expect(material.thread.map((m) => m.messageId)).toEqual([REQUEST, "note-1", QUESTION]);
  expect(material.laps).toHaveLength(1);
  expect(material.laps[0]).toMatchObject({
    iterationId: LAP,
    status: "awaiting_human",
    result: null,
  });
  expect(material.waits).toEqual([{ kind: "gate", iterationId: LAP, status: "awaiting_human" }]);
  expect(material.scope).toBeNull();
  expect(material.words).toBeNull();
  expect([...material.locators].sort()).toEqual(
    [`iteration:${LAP}`, `message:${QUESTION}`, `message:${REQUEST}`, "message:note-1"].sort(),
  );
  // Plain JSON: what the snapshot holds is what was read.
  expect(JSON.parse(JSON.stringify(material))).toEqual(material);
});

test("a question about rondo's own words carries those words; free text carries no subject", async () => {
  const w = await asked({ form: "message", messageId: "note-1" });
  const material = await gatherExplainerMaterial(w, QUESTION, 5_000);
  expect(material.words).toBe("The lap stopped at its gate after 3 commits.");
  const free = await asked(null, "Why is this taking so long?");
  const text = await gatherExplainerMaterial(free, QUESTION, 5_000);
  expect(text.question).toMatchObject({ about: null, origin: "text" });
  expect(text.words).toBeNull();
});

test("the approval in force is read with what is spent, held and left", async () => {
  const w = await asked();
  await approve(w, 10);
  const material = await gatherExplainerMaterial(w, QUESTION, 5_000);
  expect(material.scope).toMatchObject({ decisionId: "sd-1", scopeId: "scope-1", approvedUsd: 10 });
  expect(material.scope?.leftUsd).toBeCloseTo(10 - (material.scope?.heldUsd ?? 0));
  expect(material.locators).toContain("scope:scope-1");
});

test("a goal's approval over a request the flow opened is the approval in force", async () => {
  const w = fresh();
  const goal = await w.record.recordGoal({
    goalId: "goal-1",
    repository: PLAN.repository,
    clauses: [{ said: "setup finishes by itself", unmetIf: "setup asks for anything" }],
    writtenBy: "ada",
    writtenAtMs: 1,
  });
  expect(goal.kind).toBe("recorded");
  // As the flow host opens one (`src/access/flow-host.ts`), and a question in it.
  for (const message of [
    { messageId: REQUEST, authorKind: "drafter" as const, authorId: FLOW_AUTHOR, inReplyTo: null },
    { messageId: QUESTION, authorKind: "operator" as const, authorId: "ada", inReplyTo: REQUEST },
  ]) {
    const said = await w.record.recordThreadMessage({
      ...message,
      body: "Make setup finish without a shell",
      atMs: 2_000,
      bases: message.inReplyTo === null ? [{ form: "goal", goalId: "goal-1" }] : [],
      asks: false,
    });
    expect(said.kind).toBe("recorded");
  }
  await approve(w, 10, 10_000_000, { from_goal: "goal-1" });
  const material = await gatherExplainerMaterial(w, QUESTION, 5_000);
  expect(material.scope).toMatchObject({ decisionId: "sd-1", scopeId: "scope-1", approvedUsd: 10 });
});

test("a question that is not in the store throws, for the host to try again", async () => {
  const w = await asked();
  await expect(gatherExplainerMaterial(w, "question-absent", 5_000)).rejects.toThrow(
    "not a message",
  );
});

test("a stalled lap waits on a decision, not at a gate, and the answer sends nobody to one", async () => {
  const w = await asked();
  w.connection.prepare("UPDATE iteration SET status = 'stalled' WHERE id = ?").run(LAP);
  const material = await gatherExplainerMaterial(w, QUESTION, 5_000);
  expect(material.waits).toEqual([{ kind: "decide", iterationId: LAP, status: "stalled" }]);
  const { claims } = deterministicAnswer(material, EN, { kind: "noApproval" });
  expect(claims.map((c) => c.value)).toContain(EN.explainWaitsDecide);
  const { body } = answerBody(EN, material, "P", claims, { kind: "free" });
  expect(body).not.toContain(EN.explainWhereToAnswer);
});

test("a drafted scope nobody decided waits for approval, and the answer leads to it", async () => {
  const w = await world();
  const document = planDocument();
  await w.say("r1", "Two things, please.", null, 1_000);
  await w.say("r1-plan", JSON.stringify(document), "r1", 1_100);
  const drafter = drafterHost({
    store: w.store,
    record: w.record,
    now: () => 1_500,
    language: null,
    log: () => undefined,
    mintId: (kind) => `${kind}-1`,
    runDrafter: async () => ({
      kind: "answered",
      costUsd: 0.05,
      finalMessage: JSON.stringify({
        act: "split",
        summary: { text: "One plan.", bases: ["r1"] },
        plans: [
          {
            template_plan_digest: planDigest(document),
            agent_type_digest: agentTypeDigestOf(document),
            prompt: "Do the first thing.",
            bases: ["r1"],
            claim: ["/"],
          },
        ],
        narrowings: [],
      }),
    }),
  });
  drafter.kick();
  await drafter.idle();
  await w.say(QUESTION, "What happens now?", "r1", 2_000);
  const material = await gatherExplainerMaterial(w, QUESTION, 5_000);
  const scopeId = (
    w.connection.prepare("SELECT scope_id FROM scope WHERE author_kind = 'drafter'").get() as {
      scope_id: string;
    }
  ).scope_id;
  expect(material.waits).toEqual([{ kind: "scope", scopeId }]);
  expect(material.locators).toContain(`scope:${scopeId}`);
  const { claims } = deterministicAnswer(material, EN, { kind: "noApproval" });
  expect(claims).toContainEqual({
    label: EN.explainWaiting,
    value: EN.explainWaitsScope,
    basis: { form: "scope", scopeId },
  });
  expect(answerBody(EN, material, "P", claims, { kind: "free" }).body).toContain(
    EN.explainWhereToApprove,
  );
});
