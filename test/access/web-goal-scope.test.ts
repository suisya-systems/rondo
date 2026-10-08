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
import { flowHost } from "../../src/access/flow-host.js";
import type { CommandOutcome } from "../../src/access/forge.js";
import { goalScopeMaterial, goalScopeStanding } from "../../src/access/goal-scope.js";
import {
  pauseGoalScopeFromPage,
  recordGoalScopeFromPage,
} from "../../src/access/page-scope-actions.js";
import { triageHost } from "../../src/access/triage-host.js";
import type { GoalScopeInput } from "../../src/access/web-app.js";
import { chromeFor, EN } from "../../src/access/wording.js";
import { flowMessageId } from "../../src/advisory/flow.js";
import { allocate } from "../../src/refrain/allocator.js";
import { admittedPlan, planPayload, type RunPlan, runPlan } from "../../src/refrain/plan.js";
import {
  FLOW_AUTHOR,
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
    translating: true,
  };
  const page = async (view: Parameters<typeof operatorPage>[2], wording = EN) =>
    (await operatorPage(ports, "t", view, wording, mint, () => "scope-drawn")).replaceAll(
      "&#x27;",
      "'",
    );
  return { storePath, store, record, page };
}

/** A line as the page escapes it. */
const quoted = (line: string) => line.replaceAll('"', "&quot;");

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
  // **And in the list, on every view** (rondo#606): the triage block is not
  // drawn while something is in the person's turn, and the list always is.
  const listed = (html: string) => html.slice(html.indexOf('class="list"'));
  for (const view of [{ kind: "requests" }, { kind: "goal", repository: "o/r" }] as const) {
    expect(listed(await w.page(view))).toMatch(
      /<a class="list-row list-row-mine" href="\/\?goal_scope=o%2Fr&amp;lang=en" data-row="" data-paused="">/,
    );
  }

  // Paused, the screen offers the draft again, pressed as a resume.
  const screen = await w.page({ kind: "goalScope", repository: "o/r" });
  expect(screen).toContain(EN.goalScopePausedHeading);
  expect(screen).toContain(EN.goalScopeResumeAction);
  expect(hidden(screen, "resumes")).toBe(standing.scopeDecisionId);
  // What the paused approval allowed is still checked (rondo#512): a resume
  // that came back unchecked would take the merge away without anyone asking.
  expect(screen).toMatch(/name="outward_acts" value="push_branch"[^>]*checked/);
  expect(screen).not.toMatch(/name="outward_acts" value="open_pull_request"[^>]*checked/);
  const resumed = await approve(w);
  expect(resumed.ok).toBe(true);
  const after = await goalScopeStanding(w.record, "goal-1");
  expect(after.kind).toBe("running");
  expect(await w.page({ kind: "requests" })).not.toContain('data-paused=""');
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
      // As the flow host writes one (`src/access/flow-host.ts`).
      messageId: flowMessageId("scope-decision-x", "issue:o/r#7"),
      body: "Make setup in o/r finish without a shell",
      authorKind: "drafter",
      authorId: FLOW_AUTHOR,
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

test("a flow stopped before its first request is said on the front and the screen, not running (rondo#488)", async () => {
  const w = await world();
  expect((await approve(w)).ok).toBe(true);
  const standing = await goalScopeStanding(w.record, "goal-1");
  if (standing.kind === "none") throw new Error("no approval");
  const front = async (wording = EN) => {
    const page = await w.page({ kind: "requests" }, wording);
    return page.slice(page.indexOf('class="triage"'));
  };
  expect(await front()).toContain(EN.triageGoalScopeRunning);

  // The flow host meets the expiry before it has written anything.
  const flow = flowHost({
    store: w.store,
    record: w.record,
    policy: { maxOccupying: 4, maxLive: 6 },
    words: EN,
    now: () => BUDGETS.expires_at_ms + 1,
    log: () => undefined,
  });
  flow.kick();
  await flow.settled();
  const stopped = await front();
  expect(stopped).not.toContain(EN.triageGoalScopeRunning);
  expect(stopped).toContain('data-state="stopped"');
  expect(stopped).toContain(EN.triageGoalScopeStopped);
  expect(stopped).toContain(EN.flowStopReason("expiry"));
  expect(stopped).toContain(quoted(EN.flowStopNext("expiry")));
  expect(stopped).toContain(EN.triageGoalScopeStoppedLink);
  const screen = await w.page({ kind: "goalScope", repository: "o/r" });
  expect(screen).toContain(EN.goalScopeStoppedHeading);
  expect(screen).not.toContain(EN.goalScopeRunningLead);
  expect(screen).toContain(EN.flowStopReason("expiry"));
  expect(screen).toContain('action="/goal-scope-pause?lang=en"');
  // Every catalogue says it (D-0079).
  expect(await front(JA)).toContain(JA.flowStopReason("expiry"));
  expect(await w.page({ kind: "goalScope", repository: "o/r" }, JA)).toContain(
    JA.goalScopeStoppedHeading,
  );

  // Nothing eligible: which candidates were passed over, and why, in words.
  expect(
    await w.record.recordFlowStop({
      stopId: "flow-stop-later",
      scopeDecisionId: standing.scopeDecisionId,
      repository: "o/r",
      facts: {
        reason: "nothing_eligible",
        skipped: [
          {
            key: "stopped:request-1",
            request: "Make setup finish without a shell",
            why: "not_issue",
          },
          { key: "issue:o/r#8", request: "Drop the manual step", why: "put_aside" },
        ],
      },
      atMs: BUDGETS.expires_at_ms + 2,
    }),
  ).toEqual({ kind: "recorded" });
  for (const html of [await front(), await w.page({ kind: "goalScope", repository: "o/r" })]) {
    expect(html).toContain(EN.flowStopReason("nothing_eligible"));
    expect(html).toContain("Make setup finish without a shell");
    expect(html).toContain(EN.flowStopSkipped("not_issue"));
    expect(html).toContain(quoted(EN.flowStopSkipped("put_aside")));
    expect(html).toContain(quoted(EN.flowStopNext("nothing_eligible")));
    // A stop is washed when a redraw brings it (rondo#494 item 1).
    expect(html).toContain('data-can-act="stop"');
  }

  // Once a request is written the stop is asked in its thread: the front's
  // triage steps aside for the person's turn, and the screen leads to it.
  const opener = flowMessageId(standing.scopeDecisionId, "issue:o/r#9");
  for (const message of [
    {
      messageId: opener,
      inReplyTo: null,
      asks: false,
      bases: [{ form: "goal", goalId: "goal-1" }],
    },
    {
      messageId: `flow-stop-${standing.scopeDecisionId}-cost-${opener}`,
      inReplyTo: opener,
      asks: true,
      bases: [{ form: "message", messageId: opener }],
    },
  ]) {
    expect(
      await w.record.recordThreadMessage({
        ...message,
        body: "b",
        authorKind: "drafter",
        authorId: FLOW_AUTHOR,
        atMs: 6_000,
      }),
    ).toEqual({ kind: "recorded" });
  }
  expect(await w.page({ kind: "requests" })).not.toContain('class="triage"');
  const asked = await w.page({ kind: "goalScope", repository: "o/r" });
  expect(asked).toContain(EN.goalScopeStoppedHeading);
  expect(asked).toContain(EN.flowStopReason("cost"));
  expect(asked).toContain(EN.flowStopAsked);
  expect(asked).toContain(EN.flowStopAskedLink);
  expect(asked).not.toContain(EN.flowStopReason("nothing_eligible"));

  // Answered with *carry on* and the approval not replaced: the limit is still
  // spent, so the flow stays stopped and asks nothing new (Codex round 1).
  expect(
    await w.record.recordThreadMessage({
      messageId: "answer-carry-on",
      body: "carry on",
      authorKind: "operator",
      authorId: "ada",
      inReplyTo: `flow-stop-${standing.scopeDecisionId}-cost-${opener}`,
      atMs: 7_000,
      bases: [],
      asks: false,
      answerOutcome: "carry_on",
    }),
  ).toEqual({ kind: "recorded" });
  const answered = await w.page({ kind: "goalScope", repository: "o/r" });
  expect(answered).toContain(EN.goalScopeStoppedHeading);
  expect(answered).toContain(EN.flowStopReason("cost"));
  expect(answered).toContain(quoted(EN.flowStopNext("cost")));
  expect(answered).not.toContain(EN.flowStopAskedLink);
  expect(await front()).toContain('data-state="stopped"');

  // Answered *stop*: the ask stays open to hold the work, and is answered all
  // the same, so it does not lead back to the question (Codex round 4).
  const stopAsk = `flow-stop-${standing.scopeDecisionId}-laps-${opener}`;
  for (const message of [
    {
      messageId: stopAsk,
      authorKind: "drafter" as const,
      authorId: FLOW_AUTHOR,
      inReplyTo: opener,
      asks: true,
      bases: [{ form: "message", messageId: opener }],
    },
    {
      messageId: "answer-stop",
      authorKind: "operator" as const,
      authorId: "ada",
      inReplyTo: stopAsk,
      asks: false,
      bases: [],
      answerOutcome: "stop" as const,
    },
  ]) {
    expect(await w.record.recordThreadMessage({ ...message, body: "b", atMs: 8_000 })).toEqual({
      kind: "recorded",
    });
  }
  const stoppedByAnswer = await w.page({ kind: "goalScope", repository: "o/r" });
  expect(stoppedByAnswer).toContain(EN.flowStopReason("laps"));
  expect(stoppedByAnswer).not.toContain(EN.flowStopAskedLink);
  expect(stoppedByAnswer).toContain(quoted(EN.flowStopNext("laps")));
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

test("rondo#549: a flow's stop is read in the page's language, whatever the host's is", async () => {
  // The host's language is the machine's setting and the page's is the
  // reader's own (`?lang`, the cookie, the browser). This host reads English
  // -- `RONDO_LANGUAGE` unset is `EN` -- and the person is on a Japanese page.
  const w = await world();
  expect((await approve(w)).ok).toBe(true);
  const standing = await goalScopeStanding(w.record, "goal-1");
  if (standing.kind === "none") throw new Error("no approval");
  const opener = flowMessageId(standing.scopeDecisionId, "issue:o/r#7");
  expect(
    await w.record.recordThreadMessage({
      messageId: opener,
      body: "Make setup in o/r finish without a shell",
      authorKind: "drafter",
      authorId: FLOW_AUTHOR,
      inReplyTo: null,
      atMs: 3_000,
      bases: [{ form: "goal", goalId: "goal-1" }],
      asks: false,
    }),
  ).toEqual({ kind: "recorded" });
  const flow = flowHost({
    store: w.store,
    record: w.record,
    policy: { maxOccupying: 4, maxLive: 6 },
    words: EN,
    now: () => BUDGETS.expires_at_ms + 1,
    log: () => undefined,
  });
  flow.kick();
  await flow.settled();
  // Written in the host's words, and its facts kept beside it under its own id.
  const read = await w.record.threadMessages();
  const asked = (read.kind === "read" ? read.messages : []).find((message) => message.asks);
  expect(asked?.inReplyTo).toBe(opener);
  expect(asked?.body).toContain(EN.flowStopReason("expiry"));
  expect((await w.record.flowStops()).map((one) => one.stopId)).toEqual([asked?.messageId]);

  const view = { kind: "thread", messageId: opener, to: null } as const;
  const at = new Date(BUDGETS.expires_at_ms).toISOString().slice(0, 16).replace("T", " ");
  const ja = await w.page(view, JA);
  for (const said of [
    JA.flowStopReason("expiry"),
    JA.flowStopExpiredAt(at),
    JA.flowStopAskRecommended("expiry"),
  ]) {
    expect(ja).toContain(said);
  }
  // The person's own words lead; what the host wrote follows, under the fold,
  // byte for byte.
  expect(ja.indexOf(JA.flowStopReason("expiry"))).toBeLessThan(
    ja.indexOf(EN.flowStopReason("expiry")),
  );
  // And an English page says it once: the host's words and the page's agree,
  // so there is nothing to fold away.
  const en = await w.page(view);
  expect(en).toContain(EN.flowStopAskRecommended("expiry"));
  expect(en).not.toContain(JA.flowStopReason("expiry"));
  expect(en.split(EN.flowStopReason("expiry"))).toHaveLength(2);
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

test("the flow's ask over open points is drawn beside the goal scope, each field starting as rondo's suggestion (rondo#487)", async () => {
  const w = await world();
  expect((await approve(w)).ok).toBe(true);
  const host = triageHost({
    store: w.store,
    record: w.record,
    repositories: async () => ["o/r"],
    listIssues: async () =>
      await Promise.resolve({
        commandLine: "gh api repos/o/r/issues",
        status: 0,
        signal: null,
        stdout: JSON.stringify({ number: 7, title: "setup asks for a shell", labels: [] }),
        stderr: "",
        spawnError: null,
      }),
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
              openPoints: [
                { point: "Where the token is read from", recommendation: "The keychain" },
                { point: "Whether to keep the old flag", recommendation: "Keep it one release" },
              ],
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
  const standing = await goalScopeStanding(w.record, "goal-1");
  if (standing.kind === "none") throw new Error("no goal scope");
  const askId = `flow-ask-${standing.scopeDecisionId}-issue:o/r#7-1`;
  const blockOf = (html: string) => html.slice(html.indexOf('class="triage"'));
  // Nothing is drawn until the flow asks, and the card lists the points.
  const before = blockOf(await w.page({ kind: "requests" }));
  expect(before).not.toContain("/flow-answer");
  expect(before).toContain(EN.triageOpenPoints);
  expect(
    await w.record.recordFlowAsk({
      askId,
      repository: "o/r",
      goalId: "goal-1",
      scopeDecisionId: standing.scopeDecisionId,
      proposalId: "triage-1",
      candidate: "issue:o/r#7",
      points: [
        { point: "Where the token is read from", recommendation: "The keychain" },
        { point: "Whether to keep the old flag", recommendation: "Keep it one release" },
      ],
      // Asked before rondo#492: no words kept, and the ranking's are drawn.
      request: null,
      why: null,
      askedAtMs: 3_000,
    }),
  ).toEqual({ kind: "recorded" });
  const block = blockOf(await w.page({ kind: "requests" }));
  expect(block).toContain('action="/flow-answer?lang=en"');
  expect(hidden(block, "ask")).toBe(askId);
  expect(block).toContain(EN.flowAskLead);
  // The ask lap 18 saw replaced under a person mid-answer is washed when a
  // redraw changes it (rondo#494 item 1).
  expect(block).toContain('data-can-act="ask"');
  // The card above does not list the same points a second time.
  expect(block).not.toContain(EN.triageOpenPoints);
  expect(block).toContain(EN.flowAskAction);
  expect(block).toMatch(/name="answer-1"[^>]*>The keychain<\/textarea>/);
  // The request line and why are the person's to fix (rondo#492): an ask
  // recorded before that kept no words, so the ranking's are drawn.
  expect(block).toMatch(
    /name="request"[^>]*>Make setup in o\/r finish without a shell<\/textarea>/,
  );
  expect(block).toMatch(/name="why"[^>]*>Setup asks for a terminal today.<\/textarea>/);
  // One way to start it: the card leads to the ask, and *not now* stays.
  expect(block).not.toContain(EN.triagePutInBox);
  expect(block).toContain(`href="#flow-ask-o-r">${EN.triageAnswerAsk}`);
  expect(block).toContain('id="flow-ask-o-r"');
  expect(block).toContain(EN.triageNotNow);
  // Each field keeps what the person typed across the page's redraw.
  expect(block).toContain(`data-draft="flow-ask:${askId}:2"`);
  expect(block).toMatch(/name="answer-2"[^>]*>Keep it one release<\/textarea>/);
  // Above the goal scope's own row, which says it waits on these answers and
  // not that it works on its own (rondo#488).
  expect(block.indexOf("/flow-answer")).toBeLessThan(block.indexOf(EN.triageGoalScopeAsking));
  expect(block).toContain('data-state="asking"');
  expect(block).not.toContain(EN.triageGoalScopeRunning);
  const screen = await w.page({ kind: "goalScope", repository: "o/r" });
  expect(screen).toContain(EN.goalScopeAskingLead);
  expect(screen).toContain(EN.goalScopeAskingLink);
  expect(screen).not.toContain(EN.goalScopeRunningLead);
  expect(blockOf(await w.page({ kind: "requests" }, JA))).toContain(JA.flowAskAction);
  // rondo#490: on a page in another language each point, with rondo's
  // suggestion, can be read in it; the press is never inside a label, so a
  // click on the point focuses its box and spends nothing.
  const jaBlock = blockOf(await w.page({ kind: "requests" }, JA));
  expect(jaBlock.match(/form="read-in"/g)).toHaveLength(2);
  expect(jaBlock).toContain('value="Where the token is read from\n-&gt; The keychain"');
  expect(jaBlock).not.toMatch(/<label>(?:(?!<\/label>)[\s\S])*form="read-in"/);
  expect(jaBlock).toMatch(/<textarea name="answer-1" aria-label="Where the token is read from"/);
  // Another request's question in the person's turn does not hide this one,
  // which is theirs too and where the screen's link leads (rondo#522).
  for (const message of [
    { messageId: "other-request", inReplyTo: null, asks: false, authorKind: "operator", bases: [] },
    {
      messageId: "other-ask",
      inReplyTo: "other-request",
      asks: true,
      authorKind: "drafter",
      bases: [{ form: "message", messageId: "other-request" }],
    },
  ] as const) {
    expect(
      await w.record.recordThreadMessage({
        ...message,
        body: "b",
        authorId: message.authorKind === "operator" ? "ada" : FLOW_AUTHOR,
        atMs: 3_100,
      }),
    ).toEqual({ kind: "recorded" });
  }
  const turn = await w.page({ kind: "requests" });
  expect(turn).toContain('id="triage-heading"');
  expect(hidden(blockOf(turn), "ask")).toBe(askId);
  expect(await w.page({ kind: "goalScope", repository: "o/r" })).toContain(EN.goalScopeAskingLink);
  expect(
    await w.record.recordThreadMessage({
      messageId: "other-answer",
      body: "carry on",
      authorKind: "operator",
      authorId: "ada",
      inReplyTo: "other-ask",
      atMs: 3_200,
      bases: [],
      asks: false,
      answerOutcome: "carry_on",
    }),
  ).toEqual({ kind: "recorded" });
  // Put aside, the ask holds nothing and is not drawn, as the picker reads it.
  const aside = await w.record.recordFlowAsk({
    askId: `${askId}-aside`,
    repository: "o/r",
    goalId: "goal-1",
    scopeDecisionId: standing.scopeDecisionId,
    proposalId: "triage-1",
    candidate: "issue:o/r#7",
    points: [{ point: "p", recommendation: "r" }],
    request: null,
    why: null,
    askedAtMs: 2_000,
  });
  expect(aside).toEqual({ kind: "recorded" });
  expect(hidden(blockOf(await w.page({ kind: "requests" })), "ask")).toBe(`${askId}-aside`);
  expect(
    await w.record.recordTriageDecline({
      declineId: "d-1",
      proposalId: "triage-1",
      candidate: "issue:o/r#7",
      declinedBy: "ada",
      declinedAtMs: 3_500,
    }),
  ).toEqual({ kind: "recorded" });
  expect(blockOf(await w.page({ kind: "requests" }))).not.toContain("/flow-answer");
  // Answered, it is gone: the flow sends the request with the answers.
  expect(
    await w.record.recordFlowAnswer({
      askId,
      answers: ["The keychain", "Drop it"],
      request: null,
      why: null,
      answeredBy: "ada",
      answeredAtMs: 4_000,
    }),
  ).toEqual({ kind: "recorded" });
  expect(blockOf(await w.page({ kind: "requests" }))).not.toContain("/flow-answer");
  expect(blockOf(await w.page({ kind: "requests" }))).toContain(EN.triageGoalScopeRunning);
});
