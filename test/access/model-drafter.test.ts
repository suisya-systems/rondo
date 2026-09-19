/**
 * One drafter run over a real store and a fake `claude` (D-0071).
 *
 * The store is real because "what the drafter is handed" is a claim about rows:
 * the thread of one request and not another's, a plan pasted into it as a
 * template with its agent type recordable, and the held agent types read back.
 * The model is replaced by the port; what a real model drafts is D-0071 rule
 * 7.4's planted requests, not CI.
 */
import { expect, test } from "vitest";

import { readDrafterResult } from "../../src/access/forge.js";
import type { DrafterRun } from "../../src/access/model-draft.js";
import {
  type DrafterPorts,
  draftRequest,
  gatherDrafterMaterial,
  heldPlanByDigest,
  heldPlans,
} from "../../src/access/model-drafter.js";
import { readRunPlan } from "../../src/refrain/plan.js";
import { planDigest } from "../../src/store/plan.js";
import type { JsonRecord } from "../../src/store/records.js";
import { ownLane } from "../lane-claims.js";
import {
  AGENT_TYPE_INPUT,
  agentTypeDigestOf,
  planDocument,
  REPOSITORY,
  WORKSPACE_ROOT,
  world,
} from "./fixtures/drafter.js";

function portsOver(
  w: Awaited<ReturnType<typeof world>>,
  answer: (document: string) => DrafterRun,
): DrafterPorts & { handed: string[] } {
  const handed: string[] = [];
  return {
    store: w.store,
    record: w.record,
    now: () => 5_000,
    handed,
    runDrafter: async (_row, document) => {
      handed.push(document);
      return answer(document);
    },
  };
}

test("a fresh store: the plan the person pasted is a template, and its agent type is recorded by the scope drafted from it", async () => {
  const w = await world();
  const document = planDocument();
  const typeDigest = agentTypeDigestOf(document);
  const templateDigest = planDigest(document);
  await w.say("r1", "Fix the flaky test.", null, 1_000);
  await w.say("r1-plan", JSON.stringify(document), "r1", 2_000);
  // Another request's thread is not this one's material.
  await w.say("r2", "Something else entirely.", null, 3_000);

  const ports = portsOver(w, () => ({
    kind: "answered",
    costUsd: 0.31,
    finalMessage: JSON.stringify({
      act: "split",
      summary: { text: "One plan.", bases: ["r1"] },
      plans: [
        {
          template_plan_digest: templateDigest,
          agent_type_digest: typeDigest,
          prompt: "Fix the flaky test.",
          bases: ["r1", "r1-plan"],
          claim: ["/"],
        },
      ],
    }),
  }));
  const run = await draftRequest(ports, "r1", "ja");

  expect(ports.handed).toHaveLength(1);
  expect(run.drafter).toBe("rondo/drafter/4/claude-opus-5");
  expect(run.costUsd).toBe(0.31);
  expect(run.document).toBe(ports.handed[0]);
  expect(run.material?.thread.map((m) => m.messageId)).toEqual(["r1", "r1-plan"]);
  expect(run.material?.templates).toEqual([
    expect.objectContaining({
      planDigest: templateDigest,
      from: { kind: "message", messageId: "r1-plan" },
    }),
  ]);
  expect(run.material?.agentTypes).toEqual([
    expect.objectContaining({
      digest: typeDigest,
      modelTier: "standard",
      priced: true,
      granted: ["command.run"],
      source: expect.objectContaining({ kind: "recordable", messageId: "r1-plan" }),
    }),
  ]);
  expect(run.outcome.kind).toBe("drafted");
  if (run.outcome.kind !== "drafted") return;
  expect(run.outcome.scope?.agentTypeRecords).toEqual([
    {
      agentTypeDigest: typeDigest,
      agentTypeInput: AGENT_TYPE_INPUT,
      planDigest: templateDigest,
      messageId: "r1-plan",
    },
  ]);
  expect(run.outcome.scope?.payload["agent_types"]).toEqual([typeDigest]);
});

test("an agent type rondo already holds is offered as held, from its record", async () => {
  const w = await world();
  const document = planDocument();
  const typeDigest = agentTypeDigestOf(document);
  await w.say("r1", "Fix it.", null, 1_000);
  const scoped = await w.record.recordScope({
    scopeId: "s-0",
    payload: {
      requests: ["r1"],
      workspaces: [{ repository: REPOSITORY, workspace_root: WORKSPACE_ROOT }],
      agent_types: [typeDigest],
      budgets: {
        laps: 1,
        review_rounds: 3,
        cost_usd: 5,
        cost_reserve_usd: 2.5,
        expires_at_ms: 9e12,
      },
      severity_threshold: "major",
      outward_acts: [],
      irreversible_additions: [],
    },
    supersedesScopeId: null,
    authorKind: "operator",
    authorId: "ada",
    bases: [],
    createdAtMs: 1_500,
    agentTypeRecords: [
      {
        agentTypeDigest: typeDigest,
        agentTypeInput: AGENT_TYPE_INPUT,
        planDigest: planDigest(document),
      },
    ],
  });
  expect(scoped.kind).toBe("recorded");
  const run = await draftRequest(
    portsOver(w, () => ({ kind: "answered", costUsd: null, finalMessage: '{"act":"none"}' })),
    "r1",
    null,
  );
  expect(run.material?.agentTypes).toEqual([
    expect.objectContaining({ digest: typeDigest, source: { kind: "held" } }),
  ]);
  expect(run.outcome).toEqual({
    kind: "drafted",
    act: "none",
    split: null,
    scope: null,
    messages: [],
  });
});

test("nothing is spawned for a request that is not there; the run is unavailable and says why", async () => {
  const w = await world();
  const ports = portsOver(w, () => {
    throw new Error("the drafter must not run");
  });
  const run = await draftRequest(ports, "missing", null);
  expect(ports.handed).toEqual([]);
  expect(run.document).toBeNull();
  expect(run.outcome.kind).toBe("unavailable");
});

const RESULT = {
  type: "result",
  subtype: "success",
  is_error: false,
  num_turns: 1,
  result: ' {"act":"none"}\n',
  total_cost_usd: 0.0239,
  permission_denials: [],
  usage: { server_tool_use: { web_search_requests: 0, web_fetch_requests: 0 } },
};

test("the CLI's result is read strictly: its text and its cost", () => {
  expect(readDrafterResult(JSON.stringify(RESULT), "claude -p")).toEqual({
    kind: "answered",
    finalMessage: '{"act":"none"}',
    costUsd: 0.0239,
  });
  expect(
    readDrafterResult(JSON.stringify({ ...RESULT, total_cost_usd: undefined }), "claude -p"),
  ).toMatchObject({ kind: "answered", costUsd: null });
});

test.each([
  ["output that is not JSON", "Error: not logged in", "not one JSON object"],
  ["an error result", JSON.stringify({ ...RESULT, is_error: true }), "ended in an error"],
  ["a second turn", JSON.stringify({ ...RESULT, num_turns: 2 }), "reported a tool call"],
  [
    "a permission denial",
    JSON.stringify({ ...RESULT, permission_denials: [{ tool_name: "Bash" }] }),
    "reported a tool call",
  ],
  [
    "a server-side tool",
    JSON.stringify({ ...RESULT, usage: { server_tool_use: { web_fetch_requests: 1 } } }),
    "reported a tool call",
  ],
  ["no text", JSON.stringify({ ...RESULT, result: null }), "carries no text"],
])("a run is failed on %s (D-0071 rules 1.3 and 1.5)", (_what, stdout, reason) => {
  const read = readDrafterResult(stdout, "claude -p");
  expect(read.kind).toBe("failed");
  expect(read.kind === "failed" && read.reason).toContain(reason);
});

test("a drafter port that throws is an unavailable run, with what was handed kept for the record", async () => {
  const w = await world();
  await w.say("r1", "Fix it.", null, 1_000);
  const run = await draftRequest(
    portsOver(w, () => {
      throw new Error("spawn EACCES");
    }),
    "r1",
    null,
  );
  expect(run.outcome).toEqual({
    kind: "unavailable",
    reason: "the drafter could not be run: spawn EACCES",
  });
  expect(run.document).not.toBeNull();
  expect(run.material?.requestMessageId).toBe("r1");
});

test("an earlier lap of the request is handed over with what it was asked, so a redraft knows what already ran (rule 2.1.5)", async () => {
  const w = await world();
  await w.say("r1", "Fix it.", null, 1_000);
  const reserved = await w.store.reserve({
    id: "i-1",
    request: "Fix it.",
    plan: planDocument(),
    spend: null,
    scopeSpend: null,
    claim: ownLane("i-1"),
    nowMs: 1_500,
    supersedesIterationId: null,
    requestMessageId: "r1",
    runId: "rondo-i-1",
    topicBranch: "rondo/i-1",
    workspace: "/srv/work/i-1",
  });
  expect(reserved.kind).toBe("reserved");
  const run = await draftRequest(
    portsOver(w, () => ({ kind: "answered", costUsd: null, finalMessage: '{"act":"none"}' })),
    "r1",
    null,
  );
  expect(run.material?.laps).toEqual([
    expect.objectContaining({ iterationId: "i-1", prompt: "do the thing" }),
  ]);
  expect(run.document).toContain("--- lap i-1:");
  expect(run.document).toContain("  asked: do the thing");
});

async function reserveLap(
  w: Awaited<ReturnType<typeof world>>,
  id: string,
  plan: JsonRecord,
  atMs: number,
): Promise<void> {
  const reserved = await w.store.reserve({
    id,
    request: "earlier work",
    plan,
    spend: null,
    scopeSpend: null,
    claim: ownLane(id),
    nowMs: atMs,
    supersedesIterationId: null,
    requestMessageId: null,
    runId: `rondo-${id}`,
    topicBranch: `rondo/${id}`,
    workspace: `/srv/work/${id}`,
  });
  if (reserved.kind !== "reserved") throw new Error(JSON.stringify(reserved));
}

test("the plans a person picks from: one per place and agent type, newest first, and never a revise lap's plan", async () => {
  const w = await world();
  await w.say("r1", "Fix it.", null, 1_000);
  const older = { ...planDocument(), prompt: "the first request" };
  const newer = { ...planDocument(), prompt: "the second request" };
  // A revise lap's plan bases on the lap it revised's topic branch.
  const revised = {
    ...planDocument(),
    prompt: "the second request, revised",
    base_branch: "rondo/lap-2",
    pull_request_base_branch: "main",
  };
  // A valid plan in every other respect, so its absence below is the rule and not a parse failure.
  expect(readRunPlan(revised).kind).toBe("planned");
  await reserveLap(w, "lap-1", older, 1_000);
  await reserveLap(w, "lap-2", newer, 2_000);
  await reserveLap(w, "lap-3", revised, 3_000);
  const ports = { store: w.store, record: w.record, now: () => 5_000 };

  const offered = await heldPlans(ports, "r1");
  // One kind here, and its newest first lap stands for it: not the revise.
  expect(offered.map((p) => p.planDigest)).toEqual([planDigest(newer)]);
  // A press and a redraw resolve what was chosen by digest, wherever rondo
  // holds it: a newer lap of the same kind since does not hide the older one.
  expect((await heldPlanByDigest(ports, "r1", planDigest(older)))?.planDigest).toBe(
    planDigest(older),
  );
  // Held, but a revise's: still not a plan for new work.
  expect(await heldPlanByDigest(ports, "r1", planDigest(revised))).toBeNull();
  // And the drafter is not handed it as a template either (rondo#238 C2).
  const material = await gatherDrafterMaterial(ports, "r1", null);
  expect(material.templates.map((t) => t.planDigest)).not.toContain(planDigest(revised));
  expect(await heldPlanByDigest(ports, "r1", `sha256:${"0".repeat(64)}`)).toBeNull();
});

test("a plan pasted again is the latest paste: A, then B, then A again offers A, as the message that carries it now", async () => {
  const w = await world();
  await w.say("r1", "Fix it.", null, 1_000);
  const a = { ...planDocument(), prompt: "plan A" };
  const b = { ...planDocument(), prompt: "plan B" };
  await w.say("paste-a", JSON.stringify(a), "r1", 2_000);
  await w.say("paste-b", JSON.stringify(b), "r1", 3_000);
  await w.say("paste-a-again", JSON.stringify(a), "r1", 4_000);
  const offered = await heldPlans({ store: w.store, record: w.record, now: () => 5_000 }, "r1");
  expect(offered.map((p) => [p.planDigest, p.from])).toEqual([
    [planDigest(a), { kind: "message", messageId: "paste-a-again" }],
  ]);
});

/** The plan as setup writes it: no allocated field, since no lap has run it (D-0075 rule 2.3). */
function setupDocument(overrides: JsonRecord = {}): JsonRecord {
  const {
    run_id: _runId,
    lease_claimant_id: _claimant,
    workspace: _workspace,
    topic_branch: _branch,
    ...plan
  } = planDocument();
  return {
    ...plan,
    parties: { ...(plan["parties"] as JsonRecord), grantee: "rondo-allocates-this" },
    prompt: "a placeholder",
    ...overrides,
  };
}

async function recordSetup(
  w: Awaited<ReturnType<typeof world>>,
  setupId: string,
  plan: JsonRecord,
  atMs: number,
): Promise<void> {
  const outcome = await w.record.recordSetupPlan({
    setupId,
    plan,
    recordedBy: "ada",
    recordedAtMs: atMs,
  });
  if (outcome.kind !== "recorded") throw new Error(JSON.stringify(outcome));
}

test("a fresh store setup finished holds its first plan: offered with nothing pasted, and its agent type recordable from the row (D-0075)", async () => {
  const w = await world();
  const plan = setupDocument();
  const typeDigest = agentTypeDigestOf(plan);
  await recordSetup(w, "setup-1", plan, 500);
  await w.say("r1", "Fix the flaky test.", null, 1_000);
  const ports = portsOver(w, () => ({
    kind: "answered",
    costUsd: null,
    finalMessage: JSON.stringify({
      act: "split",
      summary: { text: "One plan.", bases: ["r1"] },
      plans: [
        {
          template_plan_digest: planDigest(plan),
          agent_type_digest: typeDigest,
          prompt: "Fix the flaky test.",
          bases: ["r1"],
          claim: ["/"],
        },
      ],
    }),
  }));

  const offered = await heldPlans(ports, "r1");
  expect(offered.map((p) => [p.planDigest, p.from])).toEqual([
    [planDigest(plan), { kind: "setup", setupId: "setup-1" }],
  ]);
  expect((await heldPlanByDigest(ports, "r1", planDigest(plan)))?.from).toEqual({
    kind: "setup",
    setupId: "setup-1",
  });

  const run = await draftRequest(ports, "r1", null);
  expect(run.document).toContain(`recorded by setup setup-1`);
  expect(run.outcome.kind).toBe("drafted");
  if (run.outcome.kind !== "drafted" || run.outcome.scope === null) return;
  const scope = run.outcome.scope;
  expect(scope.agentTypeRecords).toEqual([
    {
      agentTypeDigest: typeDigest,
      agentTypeInput: AGENT_TYPE_INPUT,
      planDigest: planDigest(plan),
      setupId: "setup-1",
    },
  ]);
  expect(scope.bases).toContainEqual({ form: "setup", setupId: "setup-1" });

  // The store takes the record from the row it cites, as the row's approver's,
  // and refuses one that does not cite it or copies other bytes (rule 2.4).
  const draft = (scopeId: string, bases: readonly JsonRecord[], input: unknown) =>
    w.record.recordScope({
      scopeId,
      payload: scope.payload,
      supersedesScopeId: null,
      authorKind: "drafter",
      authorId: "rondo/drafter/1/test",
      bases,
      createdAtMs: 2_000,
      agentTypeRecords: [
        {
          agentTypeDigest: typeDigest,
          agentTypeInput: input as JsonRecord,
          planDigest: planDigest(plan),
          fromSetupId: "setup-1",
        },
      ],
    });
  expect(
    await draft("s-uncited", [{ form: "message", messageId: "r1" }], AGENT_TYPE_INPUT),
  ).toMatchObject({ kind: "refused", reason: expect.stringContaining("does not cite it") });
  expect(
    await draft("s-other", scope.bases, { ...AGENT_TYPE_INPUT, agentTypeId: "someone-else" }),
  ).toMatchObject({ kind: "refused", reason: expect.stringContaining("not the plan") });
  expect(await draft("s-1", scope.bases, AGENT_TYPE_INPUT)).toEqual({ kind: "recorded" });
  expect(await w.record.heldAgentType(typeDigest)).toMatchObject({ kind: "read" });
  expect(
    w.connection
      .prepare("SELECT recorded_by FROM agent_type_record WHERE agent_type_digest = ?")
      .get(typeDigest),
  ).toEqual({ recorded_by: "ada" });
});

test("held plans are one per choice, ordered by when rondo came to hold them, with no source ranked above another (D-0075 rule 2.3)", async () => {
  const w = await world();
  await w.say("r1", "Fix it.", null, 1_000);
  const stale = setupDocument({ claude_command: ["/old/claude"] });
  const repaired = setupDocument();
  const ports = { store: w.store, record: w.record, now: () => 9_000 };
  const offered = async () =>
    (await heldPlans(ports, "r1")).map((p) => [p.planDigest, p.from.kind]);

  // A stale plan pasted into the thread, then setup repaired: two choices,
  // the repair first, and the stale one still offered with where it came from.
  await w.say("paste", JSON.stringify(stale), "r1", 2_000);
  await recordSetup(w, "setup-1", repaired, 3_000);
  expect(await offered()).toEqual([
    [planDigest(repaired), "setup"],
    [planDigest(stale), "message"],
  ]);

  // A lap run on the setup plan is the same choice -- its allocated fields and
  // prompt are put aside -- and dates it anew as the lap's.
  await reserveLap(w, "lap-1", { ...planDocument(), prompt: "the work" }, 4_000);
  expect(await offered()).toEqual([
    [expect.any(String), "iterations"],
    [planDigest(stale), "message"],
  ]);

  // Setup recording the same bytes again is a newer row, and it stands first.
  await recordSetup(w, "setup-2", repaired, 5_000);
  expect(await offered()).toEqual([
    [planDigest(repaired), "setup"],
    [planDigest(stale), "message"],
  ]);
});

test("one store holds the setup of one repository (D-0075 rule 1.1)", async () => {
  const w = await world();
  await recordSetup(w, "setup-1", setupDocument(), 1_000);
  const other = await w.record.recordSetupPlan({
    setupId: "setup-2",
    plan: setupDocument({ repository: "/srv/other-repo" }),
    recordedBy: "ada",
    recordedAtMs: 2_000,
  });
  expect(other).toMatchObject({ kind: "refused", reason: expect.stringContaining("D-0075") });
  expect((await w.record.setupPlans()).map((s) => s.setupId)).toEqual(["setup-1"]);
  // A `setup` basis is a locator the writers follow, as a `proposal` one is.
  const cite = (setupId: string, messageId: string) =>
    w.record.recordThreadMessage({
      messageId,
      body: "from setup",
      authorKind: "operator",
      authorId: "ada",
      inReplyTo: null,
      atMs: 3_000,
      bases: [{ form: "setup", setupId }],
      asks: false,
    });
  expect(await cite("setup-nope", "m-1")).toMatchObject({ kind: "refused" });
  expect(await cite("setup-1", "m-2")).toEqual({ kind: "recorded" });
});
