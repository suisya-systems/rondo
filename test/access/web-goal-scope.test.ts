/**
 * The page approves and pauses a goal scope (D-0128, rondo#471).
 *
 * What is held: the triage block leads to the goal scope's screen; the
 * screen drafts one from the goal and the plans rondo holds for the
 * repository; the press records `{"from_goal": ...}` and approves it, once per
 * goal; the pause writes the `laps: 0` successor and the resume succeeds it; a
 * candidate the flow already started reads *started*; and a scope stop shows
 * its three options in the page's language.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import { DETERMINISTIC_DRAFTER } from "../../src/access/advisory.js";
import { pauseGoalScopeFromPage, recordGoalScopeFromPage } from "../../src/access/cli.js";
import type { CommandOutcome } from "../../src/access/forge.js";
import { goalScopeMaterial, goalScopeStanding } from "../../src/access/goal-scope.js";
import { triageHost } from "../../src/access/triage-host.js";
import type { GoalScopeInput } from "../../src/access/web-app.js";
import { chromeFor, EN } from "../../src/access/wording.js";
import { allocate } from "../../src/refrain/allocator.js";
import { admittedPlan, planPayload, type RunPlan, runPlan } from "../../src/refrain/plan.js";
import {
  type JsonRecord,
  requestsGoal,
  scopePayloadWithDefaults,
} from "../../src/store/records.js";
import { advisoryRecord, iterationStore } from "../../src/store/sqlite.js";
import { mint, operatorPage, PLAN, portsOver } from "./page-world.js";

const ENV = { RONDO_APPROVER: "ada" };
const JA = chromeFor("ja");

/** A cadenza-valid agent type, as `web-scope.test.ts` holds one. */
const PLAN_WITH_AGENT: RunPlan = {
  ...PLAN,
  forgeRepository: "o/r",
  agentTypeInput: {
    agentTypeId: "worker-basic",
    vocabularyVersion: 1,
    granted: ["command.run"],
    askable: ["branch.push"],
    loopPolicy: { maxReviewRounds: 2, noProgressWindow: 3, noProgressRepeat: 2 },
    executorPolicy: { roleName: "worker", modelTier: "standard", reportingDuties: [] },
  } as unknown as RunPlan["agentTypeInput"],
  parties: { issuer: "rondo-host", grantee: "unset" } as unknown as RunPlan["parties"],
  intendedAction: { capabilities: ["command.run"] } as unknown as RunPlan["intendedAction"],
};

function setupPlan() {
  const validated = runPlan(PLAN_WITH_AGENT);
  if (validated.kind !== "planned") throw new Error(validated.reason);
  const allocation = allocate("goal-scope-fixture", PLAN.workspaceRoot);
  if (allocation.kind !== "allocated") throw new Error(allocation.reason);
  const admitted = admittedPlan(validated.plan, allocation.allocation);
  if (admitted.kind !== "planned") throw new Error(admitted.reason);
  return planPayload(admitted.plan);
}

const BUDGETS = {
  laps: 6,
  review_rounds: 3,
  cost_usd: 15,
  cost_reserve_usd: 2.5,
  expires_at_ms: 4_102_444_800_000,
};

let scopes = 0;
const scopeId = () => `scope-00000000-0000-4000-8000-${String(++scopes).padStart(12, "0")}`;

/** A goal for `o/r` and a setup plan for it, over a store file the presses open by path. */
async function world() {
  const storePath = join(mkdtempSync(join(tmpdir(), "rondo-goal-scope-")), "store.db");
  const connection = new DatabaseSync(storePath);
  const store = iterationStore(connection, { maxOccupying: 4, maxLive: 6 });
  const record = advisoryRecord(connection);
  await record.recordGoal({
    goalId: "goal-1",
    repository: "o/r",
    clauses: [
      { said: "they never open a terminal", unmetIf: "a terminal is ever required" },
      { said: "setup finishes by itself", unmetIf: "setup asks for anything" },
    ],
    writtenBy: "ada",
    writtenAtMs: 1_000,
  });
  expect(
    await record.recordSetupPlan({
      setupId: "setup-1",
      plan: setupPlan(),
      recordedBy: "ada",
      recordedAtMs: 2_000,
    }),
  ).toEqual({ kind: "recorded" });
  const ports = {
    ...portsOver({ connection, store, record }),
    triageRepositories: async () => ["o/r"],
    triageWritable: true,
  };
  const page = async (view: Parameters<typeof operatorPage>[2], wording = EN) =>
    (await operatorPage(ports, "t", view, wording, mint, () => "scope-drawn")).replaceAll(
      "&#x27;",
      "'",
    );
  return { storePath, store, record, page };
}

const hidden = (html: string, name: string) =>
  new RegExp(`name="${name}" value="([^"]*)"`).exec(html)?.[1] ?? "";

async function approve(w: Awaited<ReturnType<typeof world>>, input: Partial<GoalScopeInput> = {}) {
  const drawn = await w.page({ kind: "goalScope", repository: "o/r" });
  return await recordGoalScopeFromPage(ENV, w.store, w.storePath, "ada", {
    scopeId: scopeId(),
    repository: "o/r",
    goalId: hidden(drawn, "goal"),
    drawn: hidden(drawn, "drawn"),
    resumes: hidden(drawn, "resumes") === "" ? null : hidden(drawn, "resumes"),
    budgets: BUDGETS,
    severityThreshold: "major",
    outwardActs: ["push_branch"],
    ...input,
  });
}

test("the front leads to the goal scope, and the screen drafts it from the goal and the held plans", async () => {
  const w = await world();
  const front = await w.page({ kind: "requests" });
  const block = front.slice(front.indexOf('class="triage"'));
  expect(block).toContain(EN.triageGoalScopeAction);
  expect(block).toContain("/?goal_scope=o%2Fr&amp;lang=en");

  const screen = await w.page({ kind: "goalScope", repository: "o/r" });
  expect(screen).toContain(EN.goalScopeHeading);
  expect(screen).toContain('action="/goal-scope?lang=en"');
  expect(hidden(screen, "goal")).toBe("goal-1");
  expect(hidden(screen, "drawn")).toMatch(/^sha256:/);
  // One plan per clause: two clauses, two requests' worth of budgets.
  expect(screen).toContain(EN.goalScopePlansNote(2));
  expect(screen).toContain("they never open a terminal");
  expect(screen).toContain(EN.goalScopeAction);
  // The Japanese page says it in Japanese (D-0079).
  const ja = await w.page({ kind: "goalScope", repository: "o/r" }, JA);
  expect(ja).toContain(JA.goalScopeHeading);
  expect(ja).toContain(JA.goalScopeAction);

  // No goal: the way to write one, and no form.
  const none = await w.page({ kind: "goalScope", repository: "o/none" });
  expect(none).toContain(EN.goalScopeNoGoal);
  expect(none).not.toContain('action="/goal-scope');
});

test("the press records a goal scope and approves it, once per goal", async () => {
  const w = await world();
  const draft = await w.page({ kind: "goalScope", repository: "o/r" });
  const approved = await approve(w);
  expect(approved.ok).toBe(true);
  const standing = await goalScopeStanding(w.record, "goal-1");
  expect(standing.kind).toBe("running");
  if (standing.kind === "none") return;
  expect(requestsGoal(standing.scope.payload.requests)).toBe("goal-1");
  expect(standing.scope.payload.budgets.laps).toBe(6);
  expect(standing.scope.payload.workspaces).toHaveLength(1);

  // The screen now says it runs, with the pause; the front says it too.
  const screen = await w.page({ kind: "goalScope", repository: "o/r" });
  expect(screen).toContain(EN.goalScopeRunningHeading);
  expect(screen).toContain('action="/goal-scope-pause?lang=en"');
  expect(screen).not.toContain('action="/goal-scope?lang=en"');
  expect(await w.page({ kind: "requests" })).toContain(EN.triageGoalScopeRunning);

  // A second first approval over the same goal is refused.
  const again = await approve(w, { goalId: hidden(draft, "goal"), drawn: hidden(draft, "drawn") });
  expect(again).toMatchObject({ ok: false, why: "goalScopeRefusedMoved" });
});

test("a press drawn over another goal or other plans records nothing", async () => {
  const w = await world();
  const drawn = await w.page({ kind: "goalScope", repository: "o/r" });
  await w.record.recordGoal({
    goalId: "goal-2",
    repository: "o/r",
    clauses: [{ said: "something else", unmetIf: "it is not so" }],
    writtenBy: "ada",
    writtenAtMs: 3_000,
  });
  const stale = await recordGoalScopeFromPage(ENV, w.store, w.storePath, "ada", {
    scopeId: scopeId(),
    repository: "o/r",
    goalId: hidden(drawn, "goal"),
    drawn: hidden(drawn, "drawn"),
    resumes: null,
    budgets: BUDGETS,
    severityThreshold: "major",
    outwardActs: [],
  });
  expect(stale).toMatchObject({ ok: false, why: "goalScopeRefusedGoalChanged" });
  const moved = await approve(w, { drawn: "sha256:not-what-was-drawn" });
  expect(moved).toMatchObject({ ok: false, why: "scopeRefusedPlanChanged" });
  expect((await goalScopeStanding(w.record, "goal-2")).kind).toBe("none");
});

test("pause writes the laps: 0 successor, and resume succeeds the pause", async () => {
  const w = await world();
  expect((await approve(w)).ok).toBe(true);
  const running = await w.page({ kind: "goalScope", repository: "o/r" });
  const decision = hidden(running, "pause");
  const pauseId = scopeId();
  const paused = await pauseGoalScopeFromPage(ENV, w.storePath, "ada", {
    scopeId: pauseId,
    scopeDecisionId: decision,
  });
  expect(paused.ok).toBe(true);
  // A second press of the same form is the write it repeats.
  expect(
    (
      await pauseGoalScopeFromPage(ENV, w.storePath, "ada", {
        scopeId: pauseId,
        scopeDecisionId: decision,
      })
    ).ok,
  ).toBe(true);
  const standing = await goalScopeStanding(w.record, "goal-1");
  expect(standing.kind).toBe("paused");
  if (standing.kind === "none") return;
  expect(standing.scope.payload.budgets.laps).toBe(0);
  expect(standing.scope.payload.budgets.cost_usd).toBe(BUDGETS.cost_usd);
  expect(await w.page({ kind: "requests" })).toContain(EN.triageGoalScopePaused);

  // Paused, the screen offers the draft again, pressed as a resume.
  const screen = await w.page({ kind: "goalScope", repository: "o/r" });
  expect(screen).toContain(EN.goalScopePausedHeading);
  expect(screen).toContain(EN.goalScopeResumeAction);
  expect(hidden(screen, "resumes")).toBe(standing.scopeDecisionId);
  const resumed = await approve(w);
  expect(resumed.ok).toBe(true);
  const after = await goalScopeStanding(w.record, "goal-1");
  expect(after.kind).toBe("running");
  if (after.kind === "none") return;
  expect(after.scope.supersedesScopeId).toBe(standing.scope.scopeId);
  // Pausing what is already paused is refused.
  const twice = await pauseGoalScopeFromPage(ENV, w.storePath, "ada", {
    scopeId: scopeId(),
    scopeDecisionId: standing.scopeDecisionId,
  });
  expect(twice).toMatchObject({ ok: false, why: "goalScopeRefusedMoved" });
});

test("a candidate the flow already started reads started, and is not offered for the box", async () => {
  const w = await world();
  const listed: CommandOutcome = {
    commandLine: "gh api repos/o/r/issues",
    status: 0,
    signal: null,
    stdout: JSON.stringify({ number: 7, title: "setup asks for a shell", labels: [] }),
    stderr: "",
    spawnError: null,
  };
  const host = triageHost({
    store: w.store,
    record: w.record,
    repositories: async () => ["o/r"],
    listIssues: async () => await Promise.resolve(listed),
    runDrafter: async () =>
      await Promise.resolve({
        kind: "answered" as const,
        costUsd: 0.02,
        finalMessage: JSON.stringify({
          candidates: [
            {
              key: "issue:o/r#7",
              clause: 1,
              request: "Make setup in o/r finish without a shell",
              why: "Setup asks for a terminal today.",
              openPoints: [],
            },
          ],
        }),
      }),
    forgeHost: null,
    now: () => 2_500,
    mintId: () => "triage-1",
    language: null,
    log: () => undefined,
  });
  host.kick();
  await host.idle();
  expect(await w.page({ kind: "requests" })).toContain(EN.triagePutInBox);
  expect(
    await w.record.recordThreadMessage({
      messageId: "flow-scope-decision-x-issue:o/r#7",
      body: "Make setup in o/r finish without a shell",
      authorKind: "operator",
      authorId: "rondo/flow/scope-decision-x",
      inReplyTo: null,
      atMs: 3_000,
      bases: [{ form: "goal", goalId: "goal-1" }],
      asks: false,
    }),
  ).toEqual({ kind: "recorded" });
  const front = await w.page({ kind: "requests" });
  const block = front.slice(front.indexOf('class="triage"'));
  expect(block).toContain(EN.triageStarted);
  expect(block).toContain(EN.triageStartedLink);
  expect(block).not.toContain(EN.triagePutInBox);
  expect(block).not.toContain('action="/not-now');
});

test("a scope stop shows its three options, in the page's language, with rondo's record folded", async () => {
  const w = await world();
  for (const message of [
    {
      messageId: "m-req",
      body: "Please fix the parser.",
      authorKind: "operator" as const,
      authorId: "ada",
      inReplyTo: null,
      bases: [],
      asks: false,
    },
    {
      messageId: "scope-stop-lap-1-5000",
      body: "Stopped: the first admission of a plan as 'lap-1' is outside scope 's-1'.\nOptions:",
      authorKind: "drafter" as const,
      authorId: DETERMINISTIC_DRAFTER,
      inReplyTo: "m-req",
      bases: [{ form: "message", messageId: "m-req" }],
      asks: true,
    },
  ]) {
    expect(await w.record.recordThreadMessage({ ...message, atMs: 4_000 })).toEqual({
      kind: "recorded",
    });
  }
  const view = { kind: "thread", messageId: "m-req", to: null } as const;
  for (const wording of [EN, JA]) {
    const html = await w.page(view, wording);
    for (const said of [
      wording.scopeStopLead,
      wording.scopeStopWider,
      wording.scopeStopChange,
      wording.scopeStopStop,
    ]) {
      expect(html).toContain(said);
    }
    // A first admission's stop names no lap: there is no gate to raise at.
    expect(html).toContain(wording.scopeStopWiderNoLap);
    expect(html).not.toContain(wording.scopeStopWiderDoes);
    // rondo's record is kept, shut, byte for byte.
    expect(html).toContain("is outside scope 's-1'.");
  }
});

test("a form whose row was written but never approved is tested again, not replayed", async () => {
  const w = await world();
  const draft = await w.page({ kind: "goalScope", repository: "o/r" });
  // The first press wrote its row and stopped before the approval.
  const interrupted = scopeId();
  const standingBefore = await goalScopeStanding(w.record, "goal-1");
  expect(standingBefore.kind).toBe("none");
  const read = await goalScopeMaterial(
    { store: w.store, record: w.record, now: () => 3_000 },
    "o/r",
  );
  if (read.kind !== "read") throw new Error(read.kind);
  const written = await w.record.recordScope({
    scopeId: interrupted,
    payload: scopePayloadWithDefaults({
      requests: { from_goal: "goal-1" },
      workspaces: read.material.workspaces,
      agent_types: read.material.agentTypes.map((one) => one.agentTypeDigest),
      budgets: BUDGETS,
    } as unknown as JsonRecord),
    supersedesScopeId: null,
    authorKind: "operator",
    authorId: "ada",
    bases: [],
    createdAtMs: 3_000,
    agentTypeRecords: read.material.agentTypes,
  });
  expect(written).toEqual({ kind: "recorded" });
  // Another press approves meanwhile; the retry of the first is refused.
  expect((await approve(w)).ok).toBe(true);
  const retry = await approve(w, {
    scopeId: interrupted,
    goalId: hidden(draft, "goal"),
    drawn: hidden(draft, "drawn"),
  });
  expect(retry).toMatchObject({ ok: false, why: "goalScopeRefusedMoved" });
});
