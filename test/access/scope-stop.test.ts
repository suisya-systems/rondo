/**
 * D-0066 rule 4.4's durable stop, driven end to end: `admitUnderScope` over a
 * real `node:sqlite` store, the real cadenza facade, and the real conductor with
 * only the continuo seam injected (`decision-consumption.test.ts`'s shape).
 *
 * What is under test is that a refusal leaves a row that keeps the line stopped,
 * that the row is what stops the next attempt (and not a second copy of it),
 * that a person's reply is what lets the line carry on, and that the store's
 * refusal under the write lock reaches the same writer as data.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test, vi } from "vitest";

import { commandScopedRetry, parseCommand } from "../../src/access/cli.js";
import { admit } from "../../src/access/conductor.js";
import { consoleSeams } from "../../src/access/console.js";
import { admitUnderScope, type ScopeAct, type ScopeAdmitPorts } from "../../src/access/scope.js";
import { allocate } from "../../src/refrain/allocator.js";
import { classifyPlan } from "../../src/refrain/classification.js";
import { type AdmittedPlan, admittedPlan, type RunPlan, runPlan } from "../../src/refrain/plan.js";
import type { LoopPolicy } from "../../src/refrain/policy.js";
import type { ConductorPorts, EffectOutcome, LapPerformance } from "../../src/refrain/ports.js";
import { contentDigest } from "../../src/store/plan.js";
import type { JsonRecord } from "../../src/store/records.js";
import { advisoryRecord, iterationStore } from "../../src/store/sqlite.js";

const ABS = (p: string) => resolve(p);
const ROOT = "m-root";
const POLICY: LoopPolicy = { autonomy: "ask_before_landing", maxIterations: 1 };
const EXPIRES = 10_000;

function plan(): RunPlan {
  const repository = ABS("/srv/rondo/repo");
  const planned = runPlan({
    db: ABS("/srv/rondo/control.db"),
    workspaceRoot: ABS("/srv/rondo/work"),
    baseBranch: "main",
    prompt: "teach rondo to count",
    allowedBash: ["npm run:*"],
    materialLanguage: null,
    reviewCriterion: null,
    repository,
    artifactRoot: ABS("/srv/rondo/artifacts"),
    stateRoot: ABS("/srv/rondo/state"),
    interlockRoot: ABS("/srv/rondo/interlock"),
    claudeOrgPath: ABS("/srv/rondo/claude-org"),
    endpointRecipient: "external-notify",
    endpointDestinationDir: ABS("/srv/rondo/outbox"),
    claudeCommand: [ABS("/usr/bin/claude")],
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
    catalogLayers: [
      {
        layer: "tracked",
        origin: `${ABS("/srv/catalog")}/projects.toml`,
        baseDir: ABS("/srv/catalog"),
        data: {
          schema_version: 1,
          catalog: { allowed_local_roots: [repository] },
          project: {
            rondo: {
              source: { kind: "local_path", path: repository },
              base_branch: "main",
              aliases: [],
            },
          },
        },
      },
    ],
    projectName: "rondo",
    agentTypeInput: {
      agentTypeId: "worker-basic",
      vocabularyVersion: 1,
      granted: ["command.run"],
      askable: ["branch.push"],
      loopPolicy: { maxReviewRounds: 2, noProgressWindow: 3, noProgressRepeat: 2 },
      executorPolicy: { roleName: "worker", modelTier: "standard", reportingDuties: [] },
    },
    parties: { issuer: "rondo-host", grantee: "unset" },
    intendedAction: { capabilities: ["command.run"] },
  });
  if (planned.kind !== "planned") throw new Error(planned.reason);
  return planned.plan;
}

const PLAN = plan();

function agentTypeOf(p: RunPlan): string {
  const allocation = allocate("i-probe", p.workspaceRoot);
  if (allocation.kind !== "allocated") throw new Error(allocation.reason);
  const admitted = admittedPlan(p, allocation.allocation);
  if (admitted.kind !== "planned") throw new Error(admitted.reason);
  const classified = classifyPlan(admitted.plan);
  if (classified.kind !== "answered") throw new Error("the fixture plan did not classify");
  return classified.value.agentTypeDigest;
}

const PAYLOAD: JsonRecord = {
  requests: [ROOT],
  workspaces: [{ repository: PLAN.repository, workspace_root: PLAN.workspaceRoot }],
  agent_types: [agentTypeOf(PLAN)],
  budgets: {
    laps: 10,
    review_rounds: 3,
    cost_usd: 100,
    cost_reserve_usd: 1,
    expires_at_ms: EXPIRES,
  },
  severity_threshold: "major",
  outward_acts: [],
  irreversible_additions: [],
};

/** A store with the request, an approved scope, and a clock the test moves. */
async function harness(path = ":memory:") {
  const connection = new DatabaseSync(path);
  const store = iterationStore(connection, { maxOccupying: 100, maxLive: 100 });
  const record = advisoryRecord(connection);
  const clock = { now: 1_000 };
  const lap = (p: AdmittedPlan): EffectOutcome<LapPerformance> => ({
    kind: "answered",
    value: {
      runId: p.runId,
      gateId: `gate-${p.runId}`,
      sessionId: "session-1",
      sessionPath: "started",
      endpointLeaseFailure: null,
      elapsedDeadlineAtMs: null,
      model: "claude-fixture",
      requestedModel: "claude-fixture",
      permissionDenials: "",
      costUsd: null,
      turns: null,
      durationMs: null,
      spendSource: "unread",
    },
  });
  const conductor: ConductorPorts = {
    store,
    now: () => clock.now,
    classify: async (p) => classifyPlan(p),
    startContinuo: async () => ({ kind: "answered", value: { revision: "44f62336" } }),
    admitRun: async (p) => ({
      kind: "answered",
      value: { runId: p.runId, status: "created", continuoRole: "worker" },
    }),
    performLap: async (p) => lap(p),
    showGate: async () => ({
      kind: "answered",
      value: { gateId: "gate-1", stage: "received", outcome: null },
    }),
    readLapWork: async () => ({
      kind: "answered",
      value: {
        drafter: "rondo/deterministic/1",
        verdict: "clear",
        findings: [],
        evidence: {
          baseRef: "refs/heads/main",
          baseCommit: "b".repeat(40),
          tipCommit: "a".repeat(40),
          materialDigest: `sha256:${"c".repeat(64)}`,
          commitCount: 2,
          fileCount: 3,
        },
        unavailableReason: null,
      },
    }),
  };
  const advisory = { unavailable: "not under test" };
  expect(
    await record.recordThreadMessage({
      messageId: ROOT,
      body: "please teach rondo to count",
      authorKind: "operator",
      authorId: "oidc|operator-1",
      inReplyTo: null,
      atMs: 1,
      bases: [],
      asks: false,
    }),
  ).toEqual({ kind: "recorded" });
  // The scope may list only an agent type rondo already holds (D-0062 rule 1.2).
  expect((await admit(conductor, advisory, PLAN, POLICY, "i-seed")).iterationId).toBe("i-seed");
  expect(
    await record.recordScope({
      scopeId: "s-1",
      payload: PAYLOAD,
      supersedesScopeId: null,
      authorKind: "operator",
      authorId: "oidc|operator-1",
      bases: [],
      createdAtMs: 1,
    }),
  ).toEqual({ kind: "recorded" });
  expect(
    await record.recordScopeDecision({
      scopeDecisionId: "sd-1",
      scopeId: "s-1",
      scopeDigest: contentDigest(PAYLOAD),
      outcome: "approved",
      actorId: "oidc|operator-1",
      recordedBy: "rondo/cli",
      decidedAtMs: 1,
    }),
  ).toEqual({ kind: "recorded" });
  /** Called just before the real `admit`, after the verdict: the store's race window. */
  const beforeReserve = { run: async () => {} };
  const ports: ScopeAdmitPorts = {
    store,
    record,
    nowMs: () => clock.now,
    admit: async (p, id, supersedes, request, scopeSpend) => {
      await beforeReserve.run();
      return admit(conductor, advisory, p, POLICY, id, supersedes, null, request, scopeSpend);
    },
  };
  const stops = () =>
    connection
      .prepare(
        "SELECT message_id, author_kind, author_id, in_reply_to, asks, bases, body " +
          "FROM conversation_message WHERE author_kind = 'drafter' ORDER BY at_ms, message_id",
      )
      .all() as Record<string, unknown>[];
  const consumptions = () =>
    Number(
      (connection.prepare("SELECT COUNT(*) AS n FROM scope_consumption").get() as { n: number }).n,
    );
  return { connection, store, record, clock, ports, stops, consumptions, beforeReserve };
}

const start = (iterationId: string): ScopeAct => ({
  kind: "lineage_start",
  iterationId,
  plan: PLAN,
  proposalId: null,
  requestMessageId: ROOT,
});

test("a verdict refusal writes one asking drafter message; the next attempt is held by it; a reply lets the line on", async () => {
  const h = await harness();
  // Past expiry: outside at the expiry test, and a lineage start.
  h.clock.now = EXPIRES;
  const first = await admitUnderScope(h.ports, "sd-1", start("i-a"));
  expect(first).toMatchObject({ kind: "refused", verdict: "outside", test: "expiry" });
  if (first.kind !== "refused" || first.stop.kind !== "written") throw new Error("no stop written");
  const stops = h.stops();
  expect(stops).toHaveLength(1);
  expect(stops[0]).toMatchObject({
    message_id: first.stop.messageId,
    author_kind: "drafter",
    author_id: "rondo/advisory/deterministic",
    in_reply_to: ROOT,
    asks: 1,
  });
  // A lineage start names no lap: the request root is its one basis.
  expect(JSON.parse(String(stops[0]?.["bases"]))).toEqual([{ form: "message", messageId: ROOT }]);
  const body = String(stops[0]?.["body"]);
  expect(body).toContain("scope 's-1'");
  expect(body).toContain(contentDigest(PAYLOAD));
  expect(body).toContain("expiry test");
  expect(body).toContain("Recommended: a successor scope");
  expect(body).toMatch(/^[\x20-\x7E\n]*$/);

  // Back inside the expiry: the stop itself refuses, and no second message is written.
  h.clock.now = 2_000;
  const second = await admitUnderScope(h.ports, "sd-1", start("i-a"));
  expect(second).toMatchObject({
    kind: "refused",
    test: "asks",
    stop: { kind: "held", messageId: first.stop.messageId },
  });
  expect(h.stops()).toHaveLength(1);
  expect(h.consumptions()).toBe(0);

  // The person's reply ends it, and the same attempt is admitted.
  expect(
    await h.record.recordThreadMessage({
      messageId: "m-answer",
      body: "go ahead",
      authorKind: "operator",
      authorId: "oidc|operator-1",
      inReplyTo: first.stop.messageId,
      atMs: 2_001,
      bases: [],
      asks: false,
    }),
  ).toEqual({ kind: "recorded" });
  const third = await admitUnderScope(h.ports, "sd-1", start("i-a"));
  expect(third).toMatchObject({ kind: "admitted", report: { iterationId: "i-a" } });
  expect(h.consumptions()).toBe(1);
  expect(h.stops()).toHaveLength(1);
});

test("a redo's stop names the lineage's latest lap as an iteration basis", async () => {
  const h = await harness();
  expect(await admitUnderScope(h.ports, "sd-1", start("i-a"))).toMatchObject({
    kind: "admitted",
  });
  h.clock.now = EXPIRES;
  const redo: ScopeAct = {
    kind: "redo",
    iterationId: "i-b",
    plan: PLAN,
    predecessorId: "i-a",
    requestMessageId: ROOT,
  };
  const refused = await admitUnderScope(h.ports, "sd-1", redo);
  expect(refused).toMatchObject({ kind: "refused", test: "expiry", stop: { kind: "written" } });
  expect(JSON.parse(String(h.stops()[0]?.["bases"]))).toEqual([
    { form: "message", messageId: ROOT },
    { form: "iteration", iterationId: "i-a" },
  ]);
  // It holds that line, and not a new lineage in the same request.
  h.clock.now = 2_000;
  expect(await admitUnderScope(h.ports, "sd-1", redo)).toMatchObject({ test: "asks" });
  expect(await admitUnderScope(h.ports, "sd-1", start("i-c"))).toMatchObject({
    kind: "admitted",
  });
});

test("a store refusal under the write lock reaches the stop as data, and writes it", async () => {
  const h = await harness();
  // The verdict passes; between it and the reserve a successor scope is approved.
  h.beforeReserve.run = async () => {
    h.beforeReserve.run = async () => {};
    expect(
      await h.record.recordScope({
        scopeId: "s-2",
        payload: PAYLOAD,
        supersedesScopeId: "s-1",
        authorKind: "operator",
        authorId: "oidc|operator-1",
        bases: [],
        createdAtMs: 2,
      }),
    ).toEqual({ kind: "recorded" });
    expect(
      await h.record.recordScopeDecision({
        scopeDecisionId: "sd-2",
        scopeId: "s-2",
        scopeDigest: contentDigest(PAYLOAD),
        outcome: "approved",
        actorId: "oidc|operator-1",
        recordedBy: "rondo/cli",
        decidedAtMs: 2,
      }),
    ).toEqual({ kind: "recorded" });
  };
  const refused = await admitUnderScope(h.ports, "sd-1", start("i-a"));
  expect(refused).toMatchObject({
    kind: "refused",
    verdict: "outside",
    test: "superseded",
    stop: { kind: "written" },
  });
  expect(h.consumptions()).toBe(0);
  expect(
    h.connection.prepare("SELECT COUNT(*) AS n FROM iteration WHERE id = 'i-a'").get(),
  ).toEqual({ n: 0 });
  const stops = h.stops();
  expect(stops).toHaveLength(1);
  expect(String(stops[0]?.["body"])).toContain("superseded test");
});

test("no request, no thread: the refusal is the one with no durable stop", async () => {
  const h = await harness();
  const refused = await admitUnderScope(h.ports, "sd-1", {
    ...start("i-a"),
    requestMessageId: null,
  });
  expect(refused).toMatchObject({ kind: "refused", test: "request", stop: { kind: "noThread" } });
  expect(h.stops()).toHaveLength(0);
});

test("an undecidable refusal recommends stopping, and a failed write is reported as failed", async () => {
  const h = await harness();
  const missing = await admitUnderScope(h.ports, "sd-none", start("i-a"));
  expect(missing).toMatchObject({ verdict: "undecidable", stop: { kind: "written" } });
  expect(String(h.stops()[0]?.["body"])).toContain("Recommended: stop this line");
  const fresh = await harness();
  const failing: ScopeAdmitPorts = {
    ...fresh.ports,
    record: {
      ...fresh.record,
      recordThreadMessage: async () => ({ kind: "defect", reason: "disk full" }),
    },
  };
  expect(await admitUnderScope(failing, "sd-other", start("i-b"))).toMatchObject({
    stop: { kind: "failed", reason: "disk full" },
  });
});

test("PLANTED: asks that will not read write no stop on any attempt, and say so as failed", async () => {
  const h = await harness();
  const written: unknown[] = [];
  const unread: ScopeAdmitPorts = {
    ...h.ports,
    record: {
      ...h.record,
      openAsksIn: async () => ({ kind: "unreadable", reason: "torn row" }),
      recordThreadMessage: async (input) => {
        written.push(input);
        return { kind: "recorded" };
      },
    },
  };
  for (const id of ["i-a", "i-b"]) {
    expect(await admitUnderScope(unread, "sd-1", start(id))).toMatchObject({
      verdict: "undecidable",
      test: "asks",
      stop: { kind: "failed", reason: expect.stringContaining("torn row") },
    });
  }
  expect(written).toHaveLength(0);
  // Control: the same refusal with the asks readable writes its stop.
  expect(await admitUnderScope(h.ports, "sd-none", start("i-a"))).toMatchObject({
    stop: { kind: "written" },
  });
});

const redoOf = (iterationId: string, predecessorId: string): ScopeAct => ({
  kind: "redo",
  iterationId,
  plan: PLAN,
  predecessorId,
  requestMessageId: ROOT,
});

/** A model reading with only a finding below the threshold, so the readings test passes. */
const nitReading = {
  drafter: "rondo/model/1/gpt-6-astra",
  verdict: "concerns" as const,
  findings: ["a nit"],
  graded: [{ severity: "nit" as const, bases: [], basisResolved: false }],
  evidence: null,
  unavailableReason: null,
};

test("PLANTED: a stop over the latest lap holds a redo of an earlier lap, until it is answered", async () => {
  const h = await harness();
  expect(await admitUnderScope(h.ports, "sd-1", start("i-a"))).toMatchObject({ kind: "admitted" });
  expect(await h.store.appendReading("i-a", nitReading, 1_001)).toMatchObject({
    kind: "appended",
  });
  h.clock.now += 1;
  // `i-p` redoes `i-a` through the store's own re-test.
  expect(await h.ports.admit(PLAN, "i-p", "i-a", ROOT, spend())).toMatchObject({
    iterationId: "i-p",
  });
  // The line is stopped over its latest lap, `i-p`.
  h.clock.now = EXPIRES;
  const stopped = await admitUnderScope(h.ports, "sd-1", redoOf("i-s1", "i-p"));
  if (stopped.kind !== "refused" || stopped.stop.kind !== "written") throw new Error("no stop");
  h.clock.now = 2_000;
  // Redoing the earlier lap shares `i-p`'s root: refused at the asks, held by the same stop.
  expect(await admitUnderScope(h.ports, "sd-1", redoOf("i-s2", "i-a"))).toMatchObject({
    kind: "refused",
    verdict: "outside",
    test: "asks",
    stop: { kind: "held", messageId: stopped.stop.messageId },
  });
  expect(h.stops()).toHaveLength(1);
  expect(h.consumptions()).toBe(2);
  // Control: the person's reply lets the branch from `i-a` on.
  expect(
    await h.record.recordThreadMessage({
      messageId: "m-answer",
      body: "go ahead",
      authorKind: "operator",
      authorId: "oidc|operator-1",
      inReplyTo: stopped.stop.messageId,
      atMs: 2_001,
      bases: [],
      asks: false,
    }),
  ).toEqual({ kind: "recorded" });
  expect(await admitUnderScope(h.ports, "sd-1", redoOf("i-s2", "i-a"))).toMatchObject({
    kind: "admitted",
  });
  expect(h.consumptions()).toBe(3);
});

test("the store refuses a branch stopped between the verdict and the reserve, and the stop holds it", async () => {
  const h = await harness();
  expect(await admitUnderScope(h.ports, "sd-1", start("i-a"))).toMatchObject({ kind: "admitted" });
  expect(await h.store.appendReading("i-a", nitReading, 1_001)).toMatchObject({
    kind: "appended",
  });
  // After the verdict, `i-p` redoes `i-a` and a question is asked over `i-p`.
  h.beforeReserve.run = async () => {
    h.beforeReserve.run = async () => {};
    expect(await h.ports.admit(PLAN, "i-p", "i-a", ROOT, spend())).toMatchObject({
      iterationId: "i-p",
    });
    expect(
      await h.record.recordThreadMessage({
        messageId: "m-late-ask",
        body: "hold on",
        authorKind: "operator",
        authorId: "oidc|operator-1",
        inReplyTo: ROOT,
        atMs: 1_002,
        bases: [{ form: "iteration", iterationId: "i-p" }],
        asks: true,
      }),
    ).toEqual({ kind: "recorded" });
  };
  h.clock.now += 1;
  expect(await admitUnderScope(h.ports, "sd-1", redoOf("i-s", "i-a"))).toMatchObject({
    kind: "refused",
    test: "asks",
    stop: { kind: "held", messageId: "m-late-ask" },
  });
  expect(h.stops()).toHaveLength(0);
  expect(h.consumptions()).toBe(2);
});

const spend = () => ({
  scopeDecisionId: "sd-1",
  proposalId: null,
  agentTypeDigest: agentTypeOf(PLAN),
});

// --- The retry verb over the same rows ---------------------------------------

/** `rondo retry` in scope: a file store, since the verb opens its own advisory port on the path. */
async function retryHarness() {
  const path = join(mkdtempSync(join(tmpdir(), "rondo-scope-retry-")), "rondo.sqlite3");
  const h = await harness(path);
  expect(await admitUnderScope(h.ports, "sd-1", start("i-a"))).toMatchObject({ kind: "admitted" });
  const errors: string[] = [];
  const retry = async (successorId: string): Promise<number> => {
    const parsed = parseCommand([
      "retry",
      "--iteration-id",
      "i-a",
      "--successor-id",
      successorId,
      "--scope-decision-id",
      "sd-1",
    ]);
    if (parsed.kind !== "parsed") throw new Error("the retry did not parse");
    const original = consoleSeams.writeError;
    consoleSeams.writeError = (text: string) => {
      errors.push(text);
    };
    try {
      // The wall clock is past the fixture's expiry, so every retry here is
      // refused before `admit`, and the conductor and continuo are never reached.
      return await commandScopedRetry(parsed.parsed, h.store, path, {} as never, {} as never, {
        cliPath: "/opt/continuo/dist/cli.js",
        revision: "0".repeat(40),
      });
    } finally {
      consoleSeams.writeError = original;
    }
  };
  return { ...h, errors, retry };
}

test("retry: inherits the predecessor's request, writes the stop and exits 2, then is held", async () => {
  const h = await retryHarness();
  expect(await h.retry("i-b")).toBe(2);
  const first = h.errors.join("");
  // Tested as the predecessor's request: refused at expiry, not at the request test.
  expect(first).toContain("at the expiry test");
  expect(first).toContain("The line is stopped by message 'scope-stop-i-b-");
  expect(h.stops()).toHaveLength(1);
  h.errors.length = 0;
  expect(await h.retry("i-c")).toBe(2);
  expect(h.errors.join("")).toContain("already holds this line");
  expect(h.stops()).toHaveLength(1);
});

test("PLANTED: retry exits 1 when the stop is not recorded", async () => {
  const h = await retryHarness();
  const now = 50_000;
  const clock = vi.spyOn(Date, "now").mockReturnValue(now);
  try {
    // The id the stop would take is already a message, so its write is refused.
    expect(
      await h.record.recordThreadMessage({
        messageId: `scope-stop-i-b-${String(now)}`,
        body: "an unrelated note",
        authorKind: "operator",
        authorId: "oidc|operator-1",
        inReplyTo: ROOT,
        atMs: 2,
        bases: [],
        asks: false,
      }),
    ).toEqual({ kind: "recorded" });
    expect(await h.retry("i-b")).toBe(1);
    expect(h.errors.join("")).toContain("was NOT recorded");
  } finally {
    clock.mockRestore();
  }
});

test("a refusal ahead of the asks test does not write a second stop over a held line", async () => {
  const h = await harness();
  const successor = async () => {
    expect(
      await h.record.recordScope({
        scopeId: "s-2",
        payload: PAYLOAD,
        supersedesScopeId: "s-1",
        authorKind: "operator",
        authorId: "oidc|operator-1",
        bases: [],
        createdAtMs: 2,
      }),
    ).toEqual({ kind: "recorded" });
    expect(
      await h.record.recordScopeDecision({
        scopeDecisionId: "sd-2",
        scopeId: "s-2",
        scopeDigest: contentDigest(PAYLOAD),
        outcome: "approved",
        actorId: "oidc|operator-1",
        recordedBy: "rondo/cli",
        decidedAtMs: 2,
      }),
    ).toEqual({ kind: "recorded" });
  };
  await successor();
  const first = await admitUnderScope(h.ports, "sd-1", start("i-a"));
  if (first.kind !== "refused" || first.stop.kind !== "written") throw new Error("no stop written");
  expect(first.test).toBe("superseded");
  h.clock.now += 1;
  expect(await admitUnderScope(h.ports, "sd-1", start("i-b"))).toMatchObject({
    test: "superseded",
    stop: { kind: "held", messageId: first.stop.messageId },
  });
  // A failed gather is refused before any test, and is held the same way.
  h.clock.now += 1;
  expect(await admitUnderScope(h.ports, "sd-none", start("i-c"))).toMatchObject({
    verdict: "undecidable",
    stop: { kind: "held", messageId: first.stop.messageId },
  });
  expect(h.stops()).toHaveLength(1);
});

test("an unwalkable lineage writes a stop, and the next attempt is held by it", async () => {
  const h = await harness();
  const redo: ScopeAct = {
    kind: "redo",
    iterationId: "i-b",
    plan: PLAN,
    predecessorId: "i-missing",
    requestMessageId: ROOT,
  };
  const first = await admitUnderScope(h.ports, "sd-1", redo);
  expect(first).toMatchObject({ verdict: "undecidable", test: "asks", stop: { kind: "written" } });
  if (first.kind !== "refused" || first.stop.kind !== "written") throw new Error("no stop written");
  expect(String(h.stops()[0]?.["body"])).toContain("Recommended: stop this line");
  h.clock.now += 1;
  expect(await admitUnderScope(h.ports, "sd-1", redo)).toMatchObject({
    test: "asks",
    stop: { kind: "held", messageId: first.stop.messageId },
  });
  expect(h.stops()).toHaveLength(1);
});
