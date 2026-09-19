/**
 * One drafter run over a real store and a fake `claude` (D-0071).
 *
 * The store is real because "what the drafter is handed" is a claim about rows:
 * the thread of one request and not another's, a plan pasted into it as a
 * template with its agent type recordable, and the held agent types read back.
 * The model is replaced by the port; what a real model drafts is D-0071 rule
 * 7.4's planted requests, not CI.
 */
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import { readDrafterResult } from "../../src/access/forge.js";
import type { DrafterRun } from "../../src/access/model-draft.js";
import { type DrafterPorts, draftRequest } from "../../src/access/model-drafter.js";
import { agentTypeRecordOf } from "../../src/access/scope.js";
import { allocate } from "../../src/refrain/allocator.js";
import {
  admittedPlan,
  planPayload,
  type RunPlan,
  readRunPlan,
  runPlan,
} from "../../src/refrain/plan.js";
import { planDigest } from "../../src/store/plan.js";
import type { JsonRecord } from "../../src/store/records.js";
import { advisoryRecord, iterationStore } from "../../src/store/sqlite.js";

const AGENT_TYPE_INPUT = {
  agentTypeId: "worker-basic",
  vocabularyVersion: 1,
  granted: ["command.run"],
  askable: ["branch.push"],
  loopPolicy: { maxReviewRounds: 2, noProgressWindow: 3, noProgressRepeat: 2 },
  executorPolicy: { roleName: "worker", modelTier: "standard", reportingDuties: [] },
};

const PLAN = {
  db: "/srv/continuo.db",
  workspaceRoot: "/srv/work",
  baseBranch: "main",
  prompt: "do the thing",
  allowedBash: ["npm run:*"],
  materialLanguage: null,
  reviewCriterion: null,
  repository: "/srv/repo",
  artifactRoot: "/srv/artifacts",
  stateRoot: "/srv/state",
  interlockRoot: "/srv/interlock",
  claudeOrgPath: "/srv/claude-org",
  endpointRecipient: "external-notify",
  endpointDestinationDir: "/srv/dropbox",
  claudeCommand: ["/usr/bin/node", "/opt/claude/cli.js"],
  endpointDb: null,
  endpointModule: null,
  node: null,
  hookScript: null,
  python: null,
  pollIntervalMs: null,
  turnTimeoutMs: 900_000,
  gitTimeoutMs: 60_000,
  identityReadbackTimeoutMs: 30_000,
  gateOptions: ["approve", "revise"],
  gateDeadlineAtMs: null,
  pullRequestBaseBranch: null,
  invocationCeilingMs: 1_800_000,
  catalogLayers: [{ layer: "git_url", origin: "o", baseDir: "/srv/catalog", data: {} }],
  projectName: "rondo",
  agentTypeInput: AGENT_TYPE_INPUT,
  parties: { issuer: "rondo-host", grantee: "unset" },
  intendedAction: { capabilities: ["command.run"] },
} as unknown as RunPlan;

/** A plan document as an operator would paste it: validated, allocated, serialised. */
function planDocument(): JsonRecord {
  const validated = runPlan(PLAN);
  if (validated.kind !== "planned") throw new Error(validated.reason);
  const allocation = allocate("drafter-fixture", PLAN.workspaceRoot);
  if (allocation.kind !== "allocated") throw new Error(allocation.reason);
  const admitted = admittedPlan(validated.plan, allocation.allocation);
  if (admitted.kind !== "planned") throw new Error(admitted.reason);
  return planPayload(admitted.plan);
}

function agentTypeDigestOf(document: JsonRecord): string {
  const planned = readRunPlan(document);
  if (planned.kind !== "planned") throw new Error(planned.reason);
  const recorded = agentTypeRecordOf(planned.plan, document);
  if ("refusal" in recorded) throw new Error(recorded.refusal);
  return recorded.record.agentTypeDigest;
}

async function world() {
  const connection = new DatabaseSync(":memory:");
  const store = iterationStore(connection, { maxOccupying: 4, maxLive: 6 });
  const record = advisoryRecord(connection);
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
  return { store, record, say };
}

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
        },
      ],
    }),
  }));
  const run = await draftRequest(ports, "r1", "ja");

  expect(ports.handed).toHaveLength(1);
  expect(run.drafter).toBe("rondo/drafter/1/claude-opus-5");
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
      workspaces: [{ repository: "/srv/repo", workspace_root: "/srv/work" }],
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
