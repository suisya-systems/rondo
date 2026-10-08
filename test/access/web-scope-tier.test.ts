import { expect, test } from "vitest";

import { drafterHost } from "../../src/access/drafter-host.js";
import { draftedPlanRun } from "../../src/access/model-draft/host.js";
import type { ServedPorts } from "../../src/access/web-app.js";
import { type Chrome, chromeFor, EN } from "../../src/access/wording.js";
import { allocate } from "../../src/refrain/allocator.js";
import { admittedPlan, planPayload } from "../../src/refrain/plan.js";
import { planDigest } from "../../src/store/plan.js";
import { ownLane } from "../lane-claims.js";
import {
  AGENT_TYPE_INPUT,
  planDocument as drafterPlanDocument,
  agentTypeDigestOf as drafterTypeOf,
  world as drafterWorld,
} from "./fixtures/drafter.js";
import { mint, operatorPage, portsOver } from "./page-world.js";

const GROUNDS = [
  { condition: "files_named", text: "The request names scope.tsx.", bases: ["r1"] },
  { condition: "bounded", text: "One label changes.", bases: ["r1"] },
  { condition: "checks_are_acceptance", text: "The page test passing is the fix.", bases: ["r1"] },
];

/** A request the drafter drafted into one plan on a `mechanical` agent type, with its grounds. */
async function mechanicalRequest() {
  const w = await drafterWorld();
  const document = {
    ...drafterPlanDocument(),
    agent_type_input: {
      ...AGENT_TYPE_INPUT,
      executorPolicy: { ...AGENT_TYPE_INPUT.executorPolicy, modelTier: "mechanical" },
    },
  };
  await w.say("r1", "Rename the approve label in scope.tsx.", null, 1_000);
  await w.say("r1-plan", JSON.stringify(document), "r1", 1_100);
  let n = 0;
  const host = drafterHost({
    store: w.store,
    record: w.record,
    now: () => 1_500,
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
        summary: { text: "One plan.", bases: ["r1"] },
        plans: [
          {
            template_plan_digest: planDigest(document),
            agent_type_digest: drafterTypeOf(document),
            prompt: "Rename the approve label.",
            bases: ["r1"],
            claim: ["/"],
            grounds: GROUNDS,
          },
        ],
        narrowings: [],
      }),
    }),
  });
  host.kick();
  await host.idle();
  const scopeId = (
    w.connection.prepare("SELECT scope_id FROM scope WHERE author_kind = 'drafter'").get() as
      | {
          scope_id: string;
        }
      | undefined
  )?.scope_id;
  if (scopeId === undefined) throw new Error("the drafter drafted no scope");
  const read = await w.record.readScope(scopeId);
  if (read.kind !== "read") throw new Error("the drafted scope did not read");
  return { ...w, draft: read.scope };
}

const screen = (decisionId: string | null) =>
  ({ kind: "scope", messageId: "r1", rounds: null, decisionId, plan: null }) as const;

const render = async (ports: ServedPorts, wording: Chrome, decisionId: string | null) =>
  (
    await operatorPage(
      ports,
      "t",
      screen(decisionId),
      wording,
      mint,
      () => "scope-x",
      () => "lap-y",
    )
  ).replaceAll("&#39;", "'");

test("a drafted part says which model it runs on and why it qualifies, in the person's language (rondo#473)", async () => {
  const w = await mechanicalRequest();
  const ports = { ...portsOver(w, "ada", []), workers: { fallback: "claude", ready: ["claude"] } };
  for (const wording of [EN, chromeFor("ja")]) {
    const page = await render(ports, wording, null);
    const card = page.slice(page.indexOf('id="drafted-plans"'));
    expect(card).toContain('data-tier="mechanical"');
    expect(card).toContain(wording.tierSaid("mechanical", true));
    expect(card).toContain(wording.tierModel("claude-sonnet-5", "claude"));
    expect(card).toContain(wording.tierWhy);
    for (const ground of GROUNDS) {
      expect(card).toContain(wording.tierCondition(ground.condition));
      expect(card).toContain(ground.text);
    }
    // Each claim links the message it rests on.
    expect(card).toContain(`href="/?thread=r1&amp;lang=${wording.lang}#r1"`);
  }
  expect(chromeFor("ja").tierCondition("bounded")).not.toBe(EN.tierCondition("bounded"));
});

test("a mechanical part on a worker with no lighter model says so rather than promising a saving (rondo#473)", async () => {
  const w = await mechanicalRequest();
  const ports = { ...portsOver(w, "ada", []), workers: { fallback: "codex", ready: ["codex"] } };
  const page = await render(ports, EN, null);
  expect(page).toContain(EN.tierSaid("mechanical", false));
  expect(page).toContain(EN.tierModel("gpt-6-astra", "codex"));
  expect(page).not.toContain(EN.tierSaid("mechanical", true));
});

test("an approved part shows each lap's model and cost beside its tier (rondo#473)", async () => {
  const w = await mechanicalRequest();
  const decided = await w.record.recordScopeDecision({
    scopeDecisionId: "decision-draft",
    scopeId: w.draft.scopeId,
    scopeDigest: w.draft.scopeDigest,
    outcome: "approved",
    actorId: "ada",
    recordedBy: "test",
    decidedAtMs: 2_000,
  });
  expect(decided.kind).toBe("recorded");
  const proposalId = (
    w.connection.prepare("SELECT proposal_id FROM proposal WHERE kind = 'split'").get() as {
      proposal_id: string;
    }
  ).proposal_id;
  const run = await draftedPlanRun(w, "r1", proposalId, 0);
  if (run.kind !== "runnable") throw new Error(run.reason);
  const allocation = allocate("lap-plan-0", run.plan.workspaceRoot);
  if (allocation.kind !== "allocated") throw new Error(allocation.reason);
  const admitted = admittedPlan(run.plan, allocation.allocation);
  if (admitted.kind !== "planned") throw new Error(admitted.reason);
  const reserved = await w.store.reserve({
    numbers: null,
    id: "lap-plan-0",
    request: "Rename the approve label.",
    plan: planPayload(admitted.plan),
    spend: null,
    scopeSpend: null,
    claim: ownLane("lap-plan-0"),
    nowMs: 3_000,
    supersedesIterationId: null,
    requestMessageId: "r1",
    runId: "rondo-lap-plan-0",
    topicBranch: "rondo/lap-plan-0",
    workspace: "/srv/work/lap-plan-0",
  });
  expect(reserved.kind).toBe("reserved");
  const ports = { ...portsOver(w, "ada", []), workers: { fallback: "claude", ready: ["claude"] } };

  // Not read yet: the lap is named, and its cost said to be unread rather than zero.
  const unread = await render(ports, EN, "decision-draft");
  expect(unread).toContain(EN.tierLapsHeading);
  expect(unread).toContain(EN.tierLap(1, null, null, null));

  w.connection
    .prepare("UPDATE iteration SET model = ?, worker_provider = ?, lap_cost_usd = ? WHERE id = ?")
    .run("claude-sonnet-5", "claude", 0.42, "lap-plan-0");
  for (const wording of [EN, chromeFor("ja")]) {
    const page = await render(ports, wording, "decision-draft");
    expect(page).toContain(wording.tierSaid("mechanical", true));
    expect(page).toContain(wording.tierLap(1, "claude-sonnet-5", "claude", "0.42"));
  }
});
