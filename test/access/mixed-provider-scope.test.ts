/**
 * rondo#462 open point 4: one scope holding two requests on different providers.
 *
 * The host setting made "which worker" a property of the process, so a scope's
 * laps all ran on one provider and nothing downstream had to ask a row. With
 * the choice on the request, two laps of one scope can differ, and the two
 * things that follow a lap's provider -- the budget continuo is allowed to
 * enforce, and the family the reviewer must not share -- have to follow it per
 * request rather than per host.
 *
 * Three claims, each with the observed-red control that stops it passing
 * against code that reads one host-wide provider:
 *
 *  1. **The provider that reaches the seam is the one on that lap's row**, seen
 *     through the real store and the real `conductorPorts`: on a host equipped
 *     for Claude only, the Codex request is refused by name before any spawn
 *     while its neighbour drives, and equipping the host for both makes the
 *     same two rows both drive.
 *  2. **The cap goes on the command line only for the lap that runs on Claude**
 *     (`continuo D-1114` refuses `--max-budget-usd` under `--provider codex`,
 *     `D-0121`), observed by giving both laps a cap the flag cannot carry: the
 *     Claude lap is refused by field, and the Codex lap, whose argv never
 *     composed the flag, drives.
 *  3. **The reviewer's family is the other side of that lap's own model**, seen
 *     on the reading each lap's row gets appended: two laps of one scope are
 *     read by reviewers of two different families, each opposite its own lap.
 *
 * The store is real throughout, for `ledger.test.ts`'s reason: every claim here
 * is a claim about what a row said when something downstream read it.
 */
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import { conductorPorts } from "../../src/access/conductor.js";
import { type ModelReviewPorts, takeModelReading } from "../../src/access/model-review/host.js";
import {
  type PerformLapRequest,
  performLap,
  type VerifiedContinuo,
} from "../../src/continuo/invoker.js";
import { modelFamilyOf } from "../../src/continuo/roles.js";
import { allocate } from "../../src/refrain/allocator.js";
import { type AdmittedPlan, admittedPlan, type RunPlan, runPlan } from "../../src/refrain/plan.js";
import type { HostPolicy } from "../../src/refrain/policy.js";
import { contentDigest } from "../../src/store/plan.js";
import type { JsonRecord } from "../../src/store/records.js";
import { advisoryRecord, type IterationStore } from "../../src/store/sqlite.js";
import { laneFor } from "../lane-claims.js";
import { storeWithRequest } from "../request-fixture.js";

const ROOMY: HostPolicy = { maxOccupying: 100, maxLive: 100 };
const REQUEST_MESSAGE = "m-0001";
const AGENT_TYPE = `sha256:${"a".repeat(64)}`;
const REPOSITORY = "/srv/repo";
const WORKSPACE_ROOT = "/srv/work";

/** A handle this module never issued: enough to reach `run()`, never past it. */
const UNISSUED = {
  cliPath: "/opt/continuo/dist/cli.js",
  revision: "44f62336108b86cab5da791111ffa0e5b73cd01a",
};

/** The message `run()` gives a handle it did not issue: the marker for "it drove". */
const REACHED_RUN = "did not issue";

const CODEX_READY = {
  provider: "codex",
  codexHome: "/home/op/.codex",
  codexCommand: "/usr/bin/codex",
} as const;

/** A host that can run Claude only -- the shape `--codex-home` was never given. */
const CLAUDE_ONLY_HOST: VerifiedContinuo = {
  ...UNISSUED,
  workers: { fallback: "claude", ready: [{ provider: "claude" }] },
};

/** A host equipped for both, running Claude unless a request says otherwise. */
const BOTH_READY_HOST: VerifiedContinuo = {
  ...UNISSUED,
  workers: { fallback: "claude", ready: [{ provider: "claude" }, CODEX_READY] },
};

const SCOPE_PAYLOAD: JsonRecord = {
  requests: [REQUEST_MESSAGE],
  workspaces: [{ repository: REPOSITORY, workspace_root: WORKSPACE_ROOT }],
  agent_types: [AGENT_TYPE],
  budgets: { laps: 6, review_rounds: 3, cost_usd: 50, cost_reserve_usd: 5, expires_at_ms: 10_000 },
  severity_threshold: "major",
  outward_acts: [],
  irreversible_additions: [],
};

const PLAN: RunPlan = {
  db: "/srv/continuo.db",
  workspaceRoot: WORKSPACE_ROOT,
  baseBranch: "main",
  prompt: "do the thing",
  materialLanguage: null,
  reviewCriterion: null,
  repository: REPOSITORY,
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
  forgeRepository: null,
  takeIn: null,
  decisionRecord: null,
  invocationCeilingMs: 1_800_000,
  catalogLayers: [{ layer: "git_url", origin: "o", baseDir: "/srv/catalog", data: {} }],
  projectName: "rondo",
  agentTypeInput: {} as RunPlan["agentTypeInput"],
  parties: { grantor: "rondo", grantee: "unset" } as unknown as RunPlan["parties"],
  intendedAction: {} as RunPlan["intendedAction"],
};

/** The plan the conductor hands the seam, for an iteration's own workspace. */
function planFor(id: string): AdmittedPlan {
  const validated = runPlan(PLAN);
  if (validated.kind !== "planned") throw new Error(validated.reason);
  const allocation = allocate(id, WORKSPACE_ROOT);
  if (allocation.kind !== "allocated") throw new Error(allocation.reason);
  const admitted = admittedPlan(validated.plan, allocation.allocation);
  if (admitted.kind !== "planned") throw new Error(admitted.reason);
  return admitted.plan;
}

/**
 * A store with one approved scope, and the agent type it names already on a
 * row -- what `reserve` asks for before it will spend the scope (D-0062 rule
 * 1.2).
 */
async function scopedStore(): Promise<{
  readonly connection: DatabaseSync;
  readonly store: IterationStore;
}> {
  const connection = new DatabaseSync(":memory:");
  const store = storeWithRequest(connection, ROOMY, REQUEST_MESSAGE);
  const record = advisoryRecord(connection);
  connection
    .prepare(
      "INSERT INTO iteration (id, status, request, plan, plan_digest, attempts, " +
        "agent_type_digest, created_at_ms, updated_at_ms) " +
        "VALUES ('i-held', 'closed', 'r', '{}', 'x', 1, ?, 1, 1)",
    )
    .run(AGENT_TYPE);
  expect(
    await record.recordScope({
      scopeId: "s-0001",
      payload: SCOPE_PAYLOAD,
      supersedesScopeId: null,
      authorKind: "operator",
      authorId: "oidc|operator-1",
      bases: [],
      createdAtMs: 1_000,
      agentTypeRecords: [],
    }),
  ).toEqual({ kind: "recorded" });
  expect(
    await record.recordScopeDecision({
      scopeDecisionId: "sd-0001",
      scopeId: "s-0001",
      scopeDigest: contentDigest(SCOPE_PAYLOAD),
      outcome: "approved",
      actorId: "oidc|operator-1",
      recordedBy: "rondo/cli",
      decidedAtMs: 2_000,
    }),
  ).toEqual({ kind: "recorded" });
  return { connection, store };
}

/** One request of the scope, reserved with the provider it chose (or none). */
async function reserveIn(
  store: IterationStore,
  id: string,
  workerProvider: string | null,
): Promise<void> {
  const reserved = await store.reserve({
    numbers: null,
    id,
    request: `do ${id}`,
    plan: { run_id: `r-${id}`, repository: REPOSITORY, workspace_root: WORKSPACE_ROOT },
    runId: `rondo-${id}`,
    topicBranch: `rondo/${id}`,
    workspace: `/srv/work/iter-${id}`,
    supersedesIterationId: null,
    requestMessageId: REQUEST_MESSAGE,
    spend: null,
    scopeSpend: { scopeDecisionId: "sd-0001", proposalId: null, agentTypeDigest: AGENT_TYPE },
    claim: laneFor(id, null),
    nowMs: 5_000,
    workerProvider,
  });
  expect(reserved.kind, `'${id}' did not reserve: ${JSON.stringify(reserved)}`).toBe("reserved");
}

/** The provider on a row, as the loop reads it before it sends the lap. */
async function providerOf(store: IterationStore, id: string): Promise<string | null> {
  const read = await store.read(id);
  if (read.kind !== "read") throw new Error(`iteration '${id}' did not read: ${read.kind}`);
  return read.record.workerProvider;
}

const defectReason = (outcome: { readonly kind: string }): string =>
  "reason" in outcome && typeof outcome.reason === "string"
    ? outcome.reason
    : `not a defect: ${JSON.stringify(outcome)}`;

// ---------------------------------------------------------------------------
// 1. Each lap of the scope is sent on its own request's provider.
// ---------------------------------------------------------------------------

test("two requests of one scope reach the seam on their own providers, not the host's", async () => {
  const { connection, store } = await scopedStore();
  await reserveIn(store, "i-codex", "codex");
  await reserveIn(store, "i-claude", null);
  const sent = async (host: VerifiedContinuo, id: string) => {
    // The lap is sent with what its own row says, which is how the loop sends
    // it (`interpreter.ts`'s `record.workerProvider`).
    const ports = conductorPorts(host, store, null);
    return await ports.performLap(planFor(id), "standard", id, await providerOf(store, id));
  };

  // A host equipped for Claude only: the request that asked for Codex is
  // refused by name, before a spawn and before its neighbour is touched.
  const refused = await sent(CLAUDE_ONLY_HOST, "i-codex");
  expect(refused.kind).toBe("defect");
  expect(defectReason(refused)).toContain("codex");
  expect(defectReason(refused)).not.toContain(REACHED_RUN);
  // Its neighbour in the same scope, which chose nothing, drives on the host's
  // default: the refusal above is about one row's choice, not about the host.
  expect(defectReason(await sent(CLAUDE_ONLY_HOST, "i-claude"))).toContain(REACHED_RUN);

  // The observed-red control: equip the host for both and the same two rows
  // both drive, so the refusal was the host's readiness and not a row rondo
  // could not read.
  expect(defectReason(await sent(BOTH_READY_HOST, "i-codex"))).toContain(REACHED_RUN);
  expect(defectReason(await sent(BOTH_READY_HOST, "i-claude"))).toContain(REACHED_RUN);

  // And both laps drew their cap from the one budget their scope approved:
  // mixing providers does not give a scope two budgets (D-0121).
  const capOf = (id: string) =>
    (
      connection.prepare("SELECT lap_budget_cap_usd AS c FROM iteration WHERE id = ?").get(id) as {
        readonly c: number | null;
      }
    ).c;
  const codexCap = capOf("i-codex");
  const claudeCap = capOf("i-claude");
  expect(codexCap).not.toBeNull();
  expect(claudeCap).not.toBeNull();
  // The second lap sees the first one holding its cap, so the two together are
  // inside the scope's 50 USD rather than 50 each.
  expect(Number(codexCap) + Number(claudeCap)).toBeLessThanOrEqual(50);
});

// ---------------------------------------------------------------------------
// 2. The cap on the command line follows the lap's provider.
// ---------------------------------------------------------------------------

test("the budget cap is composed for the Claude lap of the scope and never for the Codex one", async () => {
  // A cap `continuo D-1122` cannot carry: below a micro dollar. Whichever lap
  // composes the flag is refused by field name before the spawn, and whichever
  // lap does not compose it drives -- so the refusal is the discriminator for
  // "the flag was on this argv".
  const unusable = 0.0000004;
  const request = (workerProvider: string | null): PerformLapRequest => ({
    db: "/srv/rondo/cp.sqlite3",
    runId: "r1",
    repository: REPOSITORY,
    artifactRoot: "/srv/artifacts",
    stateRoot: "/srv/state",
    endpointRecipient: "human-gated-effect",
    endpointDestinationDir: "/srv/outbox",
    claudeCommand: ["/usr/local/bin/claude"],
    modelTier: "standard",
    workerProvider,
    interlockRoot: "/srv/interlock",
    claudeOrgPath: "/srv/claude-org",
    endpointDb: null,
    endpointModule: null,
    node: null,
    hookScript: null,
    python: null,
    pollIntervalMs: null,
    turnTimeoutMs: 900_000,
    gitTimeoutMs: 120_000,
    identityReadbackTimeoutMs: 30_000,
    gateOptions: [],
    gateDeadlineAtMs: null,
    maxBudgetUsd: unusable,
    invocationCeilingMs: 1_800_000,
  });

  const claude = await performLap(BOTH_READY_HOST, request(null));
  expect(defectReason(claude.result)).toContain("maxBudgetUsd");
  expect(defectReason(claude.result)).not.toContain(REACHED_RUN);

  // The same scope's Codex request, with the same unusable cap: continuo is
  // never handed the flag, so nothing refuses it and the lap drives.
  const codex = await performLap(BOTH_READY_HOST, request("codex"));
  expect(defectReason(codex.result)).toContain(REACHED_RUN);
  expect(codex.model).toBe("gpt-6-astra");
});

// ---------------------------------------------------------------------------
// 3. The reviewer's family follows each lap's own provider.
// ---------------------------------------------------------------------------

test("two laps of one scope on two providers are read by reviewers of two families", async () => {
  const { store } = await scopedStore();
  const reviewPorts = (): ModelReviewPorts => ({
    store,
    rationale: async () => null,
    // Nothing here is reached: the family is checked before the material is
    // gathered, and a lap with no deterministic reading is read by nobody.
    gather: async () => {
      throw new Error("the material was gathered for a reading that cannot be taken");
    },
    runReviewer: async () => {
      throw new Error("a reviewer was spawned for a reading that cannot be taken");
    },
    now: () => 3_000,
  });

  /** One lap of the scope, run on `workerProvider`, up to its gate. */
  const lapOn = async (id: string, workerProvider: string | null): Promise<string> => {
    await reserveIn(store, id, workerProvider);
    // The model is the seam's answer for that row's provider, not a constant
    // this test picked: `performLap` maps the tier against the worker it chose.
    const walked = await performLap(BOTH_READY_HOST, {
      db: "/srv/rondo/cp.sqlite3",
      runId: `rondo-${id}`,
      repository: REPOSITORY,
      artifactRoot: "/srv/artifacts",
      stateRoot: "/srv/state",
      endpointRecipient: "human-gated-effect",
      endpointDestinationDir: "/srv/outbox",
      claudeCommand: ["/usr/local/bin/claude"],
      modelTier: "standard",
      workerProvider: await providerOf(store, id),
      interlockRoot: "/srv/interlock",
      claudeOrgPath: "/srv/claude-org",
      endpointDb: null,
      endpointModule: null,
      node: null,
      hookScript: null,
      python: null,
      pollIntervalMs: null,
      turnTimeoutMs: 900_000,
      gitTimeoutMs: 120_000,
      identityReadbackTimeoutMs: 30_000,
      gateOptions: [],
      gateDeadlineAtMs: null,
      maxBudgetUsd: null,
      invocationCeilingMs: 1_800_000,
    });
    expect(walked.model).not.toBeNull();
    // Committed to the row as the loop commits it once the lap answers.
    const transitioned = await store.transition(
      id,
      "planned",
      "awaiting_human",
      { model: walked.model, sessionId: `s-${id}`, gateId: `g-${id}` },
      6_000,
    );
    expect(transitioned.kind).toBe("transitioned");
    return walked.model ?? "";
  };

  const codexModel = await lapOn("i-codex", "codex");
  const claudeModel = await lapOn("i-claude", null);
  expect(modelFamilyOf(codexModel)).not.toBe(modelFamilyOf(claudeModel));

  /** The reviewer the reading names, which is the model that would read it. */
  const reviewerOf = async (id: string): Promise<string> => {
    await takeModelReading(reviewPorts(), id);
    const readings = await store.readingsFor(id);
    const last = readings[readings.length - 1];
    if (last === undefined) throw new Error(`no reading was appended for '${id}'`);
    // The lap is read by nobody yet -- there is no deterministic reading to
    // agree with -- but the row records who it would have been read by.
    expect(last.verdict).toBe("unavailable");
    return last.drafter;
  };

  const codexReviewer = await reviewerOf("i-codex");
  const claudeReviewer = await reviewerOf("i-claude");
  // Each is of the other family from its own lap (D-0065 rule 3.2)...
  expect(codexReviewer).toContain(claudeModel);
  expect(claudeReviewer).toContain(codexModel);
  // ...and the two laps of this one scope were therefore read by two different
  // reviewers, which is what a host-wide provider could not produce.
  expect(codexReviewer).not.toBe(claudeReviewer);
});
