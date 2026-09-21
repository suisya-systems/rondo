import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import { recordScopeFromPage, reviseFromPage, startScopedFromPage } from "../../src/access/cli.js";
import type {} from "../../src/access/inbox.js";
import { agentTypeRecordOf, heldAgentTypeLines } from "../../src/access/scope.js";
import { newScopeId, type ScopeFormDraft } from "../../src/access/web-app.js";
import { type Chrome, chromeFor, EN } from "../../src/access/wording.js";
import { allocate } from "../../src/refrain/allocator.js";
import {
  admittedPlan,
  planPayload,
  type RunPlan,
  readRunPlan,
  runPlan,
} from "../../src/refrain/plan.js";
import { planDigest } from "../../src/store/plan.js";
import { type JsonRecord, scopePayloadWithDefaults } from "../../src/store/records.js";
import { advisoryRecord, iterationStore } from "../../src/store/sqlite.js";
import { laneFor, ownLane } from "../lane-claims.js";
import { openRequest, REQUEST } from "../request-fixture.js";
import {
  fresh,
  mint,
  operatorPage,
  PLAN,
  planFor,
  portsOver,
  rows,
  seedScopeRequest,
  WINDOWS_HEAVY_TIMEOUT_MS,
} from "./page-world.js";

/**
 * A real, cadenza-valid agent type. `PLAN.agentTypeInput` above is `{}`
 * (no test on that fixture's path ever built a record from it), but the scope
 * screen calls `agentTypeRecordOf` on every render and cadenza refuses `{}`.
 */
const SCOPE_AGENT_TYPE_INPUT = {
  agentTypeId: "worker-basic",
  vocabularyVersion: 1,
  granted: ["command.run"],
  askable: ["branch.push"],
  loopPolicy: { maxReviewRounds: 2, noProgressWindow: 3, noProgressRepeat: 2 },
  executorPolicy: { roleName: "worker", modelTier: "standard", reportingDuties: [] },
};

const SCOPE_PLAN: RunPlan = {
  ...PLAN,
  agentTypeInput: SCOPE_AGENT_TYPE_INPUT as unknown as RunPlan["agentTypeInput"],
  parties: { issuer: "rondo-host", grantee: "unset" } as unknown as RunPlan["parties"],
  intendedAction: { capabilities: ["command.run"] } as unknown as RunPlan["intendedAction"],
};

/** The plan document an environment's setup writes, admitted under one id. */
function scopePlanDocument(): JsonRecord {
  const validated = runPlan(SCOPE_PLAN);
  if (validated.kind !== "planned") {
    throw new Error(`the scope fixture plan is not valid: ${validated.reason}`);
  }
  const allocation = allocate("scope-plan-fixture", SCOPE_PLAN.workspaceRoot);
  if (allocation.kind !== "allocated") {
    throw new Error(`the scope fixture id does not allocate: ${allocation.reason}`);
  }
  const admitted = admittedPlan(validated.plan, allocation.allocation);
  if (admitted.kind !== "planned") {
    throw new Error(`the scope fixture allocation is not valid: ${admitted.reason}`);
  }
  return planPayload(admitted.plan);
}

/**
 * The scope fixture plan, pasted by the person into the request's thread as a
 * reply -- which makes it a plan rondo holds (D-0071 point 1 (a), rondo#238) --
 * plus the two digests the screen draws with, read the way `heldPlans` reads
 * them so a fixture and the render it feeds can never silently diverge.
 */
async function seedScopePlan(
  record: ReturnType<typeof advisoryRecord>,
  requestId: string,
  document: JsonRecord = scopePlanDocument(),
  messageId = `${requestId}-plan`,
): Promise<{ agentTypeDigest: string; planDigest: string }> {
  const outcome = await record.recordThreadMessage({
    messageId,
    body: JSON.stringify(document),
    authorKind: "operator",
    authorId: "ada",
    inReplyTo: requestId,
    atMs: 1_100,
    bases: [],
    asks: false,
  });
  if (outcome.kind !== "recorded") {
    throw new Error(`the scope fixture plan did not record: ${JSON.stringify(outcome)}`);
  }
  const planned = readRunPlan(document);
  if (planned.kind !== "planned") {
    throw new Error(`the scope fixture document does not read back: ${planned.reason}`);
  }
  const recorded = agentTypeRecordOf(planned.plan, document);
  if ("refusal" in recorded) {
    throw new Error(`the scope fixture agent type builds no record: ${recorded.refusal}`);
  }
  return { agentTypeDigest: recorded.record.agentTypeDigest, planDigest: planDigest(document) };
}

/**
 * A closed lap with a cost and a duration, for `scopeBudgetsFromStore`'s
 * `rows` bases (D-0071 rule 4.2). `store.reserve` has no verb for "a worker
 * reported this cost" -- those three columns are read off a real transcript at
 * a suspend -- so they are set with SQL after the row exists, exactly as
 * `test/store/scope-record.test.ts` already does for the same reading.
 */
async function seedEndedLap(
  world: ReturnType<typeof fresh>,
  id: string,
  opts: {
    agentTypeDigest: string;
    costUsd: number;
    durationMs: number;
    supersedesIterationId?: string | null;
  },
): Promise<void> {
  // Every lap names a request (D-0083); the budgets are what this seeds for.
  await openRequest(world.connection);
  const outcome = await world.store.reserve({
    id,
    request: "seeded for the scope screen's budgets",
    // The plan `heldAgentType`'s "iteration" source rebuilds `agentTypeInput`
    // from, when no `agent_type_record` row holds the digest -- it must be
    // {@link SCOPE_AGENT_TYPE_INPUT}'s plan, or the digest column and the
    // input the record rebuilds from disagree (rondo#233 S3).
    plan: scopePlanDocument(),
    spend: null,
    scopeSpend: null,
    claim: laneFor(id, opts.supersedesIterationId ?? null),
    nowMs: 1_000,
    supersedesIterationId: opts.supersedesIterationId ?? null,
    requestMessageId: REQUEST,
    runId: `rondo-${id}`,
    topicBranch: `rondo/${id}`,
    workspace: `/srv/work/${id}`,
  });
  if (outcome.kind !== "reserved") {
    throw new Error(`the scope fixture did not reserve '${id}': ${JSON.stringify(outcome)}`);
  }
  world.connection
    .prepare(
      "UPDATE iteration SET status = 'closed', lap_cost_usd = ?, lap_duration_ms = ?, " +
        "agent_type_digest = ? WHERE id = ?",
    )
    .run(opts.costUsd, opts.durationMs, opts.agentTypeDigest, id);
}

test("the scope screen drafts a form pre-filled from the request and the plan, every budget's formula and bases shown, the defaults marked as defaults", async () => {
  const world = fresh();
  await seedScopeRequest(world, "request-scope-1", "Fix the flaky test, please.");
  const { agentTypeDigest, planDigest } = await seedScopePlan(world.record, "request-scope-1");
  await seedEndedLap(world, "i-scope-0", { agentTypeDigest, costUsd: 0.4, durationMs: 3 * 60_000 });
  await seedEndedLap(world, "i-scope-1", { agentTypeDigest, costUsd: 1.2, durationMs: 6 * 60_000 });
  await seedEndedLap(world, "i-scope-2", {
    agentTypeDigest,
    costUsd: 3.4,
    durationMs: 9 * 60_000,
    supersedesIterationId: "i-scope-1",
  });

  const ports = portsOver(world, "ada", []);
  const html = await operatorPage(
    ports,
    "t",
    { kind: "scope", messageId: "request-scope-1", rounds: null, decisionId: null, plan: null },
    EN,
    mint,
    () => "MINT-SCOPE-1",
    () => "MINT-LAP-1",
  );

  // Pre-filled from the seeded request and the plan (rondo#233 S3): the
  // request's own words, its id carried hidden, the plan's two digests and its
  // workspace, and the agent type's grants read back from the held record.
  expect(html).toContain("Fix the flaky test, please.");
  expect(html).toContain('<input type="hidden" name="request" value="request-scope-1"/>');
  expect(html).toContain('<input type="hidden" name="scope_id" value="MINT-SCOPE-1"/>');
  expect(html).toContain(`agent type ${agentTypeDigest}`);
  expect(html).toContain(`plan ${planDigest}`);
  expect(html).toContain(`${SCOPE_PLAN.repository} at ${SCOPE_PLAN.workspaceRoot}`);
  expect(html).toContain("tier standard, granted command.run");

  // **What the draft assumed, above the numbers** (rondo#247): which laps it
  // measured, how far apart they were, and that their size was never recorded.
  expect(html).toContain("This draft assumes your request is the size of past laps");
  expect(html).toContain(
    "Drafted from 2 recorded first laps of this agent type, which cost 0.40 to 1.20 USD",
  );
  expect(html).toContain("you can still raise it when the work comes back to you");
  expect(html.indexOf("This draft assumes")).toBeLessThan(html.indexOf('name="cost_usd"'));
  // Measured values carry no cold-start note (rondo#378).
  expect(html).not.toContain(EN.scopeColdStartNote(true));
  expect(html).not.toContain(EN.scopeColdStartNote(false));

  // Every budget's formula, and its bases folded but present.
  expect(html).toContain("how: plans x review rounds = 1 x 3");
  expect(html).toContain("where this came from");
  // **A `rows` basis names its laps and no longer links them.** They used to
  // lead to each lap's gate screen; D-0083 rule 3 took that screen away, and a
  // lap's thread is its request's rather than its own, which this basis does
  // not know. D-0071 rule 4.2 asked for "a screen to link rather than anyone
  // to copy", and naming is what survives of it here.
  expect(html).toContain("lap i-scope-1");
  expect(html).toContain("lap i-scope-2");
  expect(html).not.toContain('href="/?answer=');

  // The deterministic defaults, marked as defaults and not derived from the
  // request (rondo#233 S3 -- `severity_threshold`, `outward_acts` and
  // `irreversible_additions` are none of them editable here).
  expect(html).toMatch(/<option value="major"[^>]*selected/);
  expect(html).not.toContain("checked=");
  expect(html).toContain("No act is added to the irreversible list.");
  expect(html).toContain("A default, not derived from your request.");

  // **What the screen cannot check, said** (rondo#233 S3 screen review): there
  // is no listing of a request's scopes, so a blank draft is not evidence
  // there is no approval already.
  expect(html).toContain("rondo cannot tell from here whether you have already approved a scope");
  // **The card says which plan, and the digests are folded**: three
  // 71-character hashes as plain text were a third of the first screenful at
  // 420px, and there is nothing a person does with one.
  expect(html).toContain("The plan rondo will run, and where it will run it");
  expect(html).toContain("The digests rondo will record");
  expect(html.indexOf("The digests rondo will record")).toBeLessThan(
    html.indexOf(`plan ${planDigest}`),
  );
  // The two digests it was drawn from ride along, for the write to compare its
  // own re-read against -- never as a second authority for what is recorded.
  expect(html).toContain(`<input type="hidden" name="plan_digest" value="${planDigest}"/>`);
  expect(html).toContain(`<input type="hidden" name="agent_type" value="${agentTypeDigest}"/>`);

  // No script needed to draft or to press it.
  expect(html).not.toContain("hx-get");
  expect(html).not.toContain('http-equiv="refresh"');
});

test("with no lap recorded, the scope screen says in Japanese that the reserve was measured by nobody", async () => {
  const world = fresh();
  await seedScopeRequest(world, "request-scope-cold", "表示の崩れを直してください。");
  await seedScopePlan(world.record, "request-scope-cold");
  const ports = portsOver(world, "ada", []);
  const html = await operatorPage(
    ports,
    "t",
    { kind: "scope", messageId: "request-scope-cold", rounds: null, decisionId: null, plan: null },
    chromeFor("ja"),
    mint,
    () => "MINT-SCOPE-1",
    () => "MINT-LAP-1",
  );
  expect(html).toContain("依頼の大きさが過去の周回と同じくらいだと見て、予算を出しています");
  expect(html).toContain("rondo の初期値 2.50 USD で、誰かが測った値ではありません");
  // **And next to each value that rests on it, not only in its formula**
  // (rondo#378): lap 11's owner read $7.50 as a measured figure. The cost, the
  // reserve and the expiry each say so; the laps and rounds are given, not
  // measured, so they do not.
  const cold = chromeFor("ja").scopeColdStartNote(true);
  expect(html.split(cold).length - 1).toBe(3);
  expect(html.indexOf(cold)).toBeGreaterThan(html.indexOf('name="cost_usd"'));
  // A tier-level sample says it is other agent types' laps, in both languages.
  expect(EN.scopeSampleRows(3, "standard", "0.22", "1.88")).toContain(
    "3 recorded first laps of other agent types on tier standard, as none of this one's is recorded, which cost 0.22 to 1.88 USD",
  );
  expect(chromeFor("ja").scopeSampleRows(1, "standard", "1.04", "1.04")).toContain(
    "同じ tier standard の別のエージェント種別の初回周回 1 件をもとに下書きしました。費用は 1.04 USD",
  );
});

test("choosing review rounds redraws the budgets from the plan, with script off", async () => {
  const world = fresh();
  await seedScopeRequest(world, "request-scope-rounds", "Do the thing.");
  await seedScopePlan(world.record, "request-scope-rounds");
  const ports = portsOver(world, "ada", []);
  const view = (rounds: number | null) =>
    ({
      kind: "scope",
      messageId: "request-scope-rounds",
      rounds,
      decisionId: null,
      plan: null,
    }) as const;

  const defaulted = await operatorPage(
    ports,
    "t",
    view(null),
    EN,
    mint,
    () => "x",
    () => "y",
  );
  const five = await operatorPage(
    ports,
    "t",
    view(5),
    EN,
    mint,
    () => "x",
    () => "y",
  );

  // D-0064 rule 3.1.4's default is 3 review rounds, over one plan: laps = 3.
  expect(defaulted).toContain('value="3"');
  expect(defaulted).not.toContain('value="5"');
  // Asking for 5 redraws every budget that depends on it, laps included.
  expect(five).toContain('value="5"');
  expect(five).not.toContain('value="3"');

  // **Explicit links, not a `method="get"` form** (rondo#233 S3): a link works
  // identically with script off, so nothing here needs `hx-get`.
  expect(five).toContain('href="/?scope=request-scope-rounds&amp;rounds=0&amp;lang=en"');
  expect(five).not.toContain("hx-get");
  expect(five).not.toContain('method="get"');
});

test("the approval reads what its predecessor spent, and repeats that the reviewer's own cost is never counted", async () => {
  const world = fresh();
  const requestId = "request-scope-pred";
  await seedScopeRequest(world, requestId, "Please continue the migration.");
  const { agentTypeDigest } = await seedScopePlan(world.record, requestId);
  await seedEndedLap(world, "i-scope-pred", { agentTypeDigest, costUsd: 4.5, durationMs: 60_000 });

  const payload: JsonRecord = scopePayloadWithDefaults({
    requests: [requestId],
    workspaces: [{ repository: SCOPE_PLAN.repository, workspace_root: SCOPE_PLAN.workspaceRoot }],
    agent_types: [agentTypeDigest],
    budgets: {
      laps: 1,
      review_rounds: 1,
      cost_usd: 5,
      cost_reserve_usd: 1,
      expires_at_ms: 9_999_999_999,
    },
    severity_threshold: "major",
    outward_acts: [],
    irreversible_additions: [],
  });

  await world.record.recordScope({
    scopeId: "scope-pred",
    payload,
    supersedesScopeId: null,
    authorKind: "operator",
    authorId: "ada",
    bases: [],
    createdAtMs: 1_000,
    agentTypeRecords: [],
  });
  const predStored = await world.record.readScope("scope-pred");
  if (predStored.kind !== "read") {
    throw new Error(`the scope fixture predecessor did not record: ${JSON.stringify(predStored)}`);
  }
  await world.record.recordScopeDecision({
    scopeDecisionId: "decision-pred",
    scopeId: "scope-pred",
    scopeDigest: predStored.scope.scopeDigest,
    outcome: "approved",
    actorId: "ada",
    recordedBy: "rondo/page",
    decidedAtMs: 1_500,
  });
  // One admission planted directly against the predecessor's decision, as
  // `test/store/scope-record.test.ts` plants one for the same reading (D-0066
  // rule 3.4) rather than replaying `admitUnderScope`'s whole verdict.
  world.connection
    .prepare(
      "INSERT INTO scope_consumption (scope_decision_id, act_kind, subject_id, proposal_id, " +
        "consumed_at_ms) VALUES ('decision-pred', 'admission', 'i-scope-pred', NULL, 2000)",
    )
    .run();

  await world.record.recordScope({
    scopeId: "scope-succ",
    payload,
    supersedesScopeId: "scope-pred",
    authorKind: "operator",
    authorId: "ada",
    bases: [],
    createdAtMs: 3_000,
    agentTypeRecords: [],
  });
  const succStored = await world.record.readScope("scope-succ");
  if (succStored.kind !== "read") {
    throw new Error(`the scope fixture successor did not record: ${JSON.stringify(succStored)}`);
  }
  await world.record.recordScopeDecision({
    scopeDecisionId: "decision-succ",
    scopeId: "scope-succ",
    scopeDigest: succStored.scope.scopeDigest,
    outcome: "approved",
    actorId: "ada",
    recordedBy: "rondo/page",
    decidedAtMs: 3_500,
  });

  const ports = portsOver(world, "ada", []);
  const html = await operatorPage(
    ports,
    "t",
    { kind: "scope", messageId: requestId, rounds: null, decisionId: "decision-succ", plan: null },
    EN,
    mint,
    () => "x",
    () => "y",
  );

  // D-0066 rule 1.4: what a predecessor's approval spent is read on its
  // successor's own screen, in laps and read dollars, with unread laps named.
  expect(html).toContain("has spent 1 laps and $4.50 read");
  expect(html).toContain("with 0 laps whose cost is not read yet holding their reserve");
  // D-0066's first gate answer, said again beside the approval and not only on the form.
  expect(html).toContain(
    "the reviewer's cost is not counted, and a lap whose cost is not read yet holds the reserve",
  );
  expect(html).toContain('id="start-form"');
  // **The press that spends money says a second press is safe** (rondo#244).
  // `startScopedFromPage` joins a second press of this form to the first; the
  // refusal screens say *pressing again is safe* and this one said nothing.
  expect(html).toContain(
    "Pressing this button twice is one lap and not two: the second press joins the first and " +
      "starts nothing more.",
  );

  // **The retired approval's own screen draws no start button** (rule 1.4).
  // `scopeVerdict` refuses that press at the `superseded` test, so drawing it
  // is the screen offering a press it already knows cannot work; it says why
  // instead (rondo#233 S3 press review).
  const retired = await operatorPage(
    ports,
    "t",
    { kind: "scope", messageId: requestId, rounds: null, decisionId: "decision-pred", plan: null },
    EN,
    mint,
    () => "x",
    () => "y",
  );
  expect(retired).toContain("A later scope has replaced this one");
  expect(retired).not.toContain('id="start-form"');
});

test("the scope screen speaks Japanese, and every id, digest and 'rondo' token stays ASCII", async () => {
  const world = fresh();
  const requestId = "request-scope-ja";
  await seedScopeRequest(world, requestId, "テストの不安定さを直してください。");
  const { agentTypeDigest, planDigest } = await seedScopePlan(world.record, requestId);
  await seedEndedLap(world, "i-scope-ja", { agentTypeDigest, costUsd: 1, durationMs: 60_000 });
  const ports = portsOver(world, "ada", []);

  const html = await operatorPage(
    ports,
    "t",
    { kind: "scope", messageId: requestId, rounds: null, decisionId: null, plan: null },
    chromeFor("ja"),
    mint,
    () => "x",
    () => "y",
  );

  expect(html).toContain("この依頼の範囲");
  expect(html).toContain("範囲を決める");
  expect(html).toContain(
    "範囲を決めるのはあなたです。プランは rondo が持っているものから選び、数値はこのストアに記録された周回から出しています。",
  );
  expect(html).toContain("既定値で、依頼から導いたものではありません。");
  expect(html).toContain(`エージェント種別 ${agentTypeDigest}`);
  expect(html).toContain(`プラン ${planDigest}`);

  // **The evidence layer is in Japanese too** (rondo#233 S3 screen review).
  // The formulas, the bases and the agent type's bounds are the whole reason
  // the fold exists, and every one of them rendered English inside this page
  // while `computeScopeBudgets` composed the sentence itself. The numbers,
  // digests and capability keys they frame stay their own bytes (rule 3).
  expect(html).toContain("計算: プラン数 x レビュー回数 = 1 x 3");
  expect(html).toContain("この数の出どころ");
  expect(html).toContain("レビュー回数: 3（誰も選ばなかったときに rondo が使う数）");
  expect(html).toContain("初回周回の費用が最も高かったもの");
  expect(html).toContain("あなたの返信のための 1 日");
  expect(html).toContain("モデルの規模は standard、許可はcommand.run");
  expect(html).toContain("ブランチを push する");
  expect(html).toContain("重大 (major)");
  // Not one English sentence left in the fold, and no D-number in front of
  // anybody in either language (this catalogue's own rule).
  expect(html).not.toContain("highest");
  expect(html).not.toContain("most recent recorded lap");
  expect(html).not.toContain("held from");
  expect(html).not.toContain("D-0064");
  // The EN-only sentence this screen did not draw in Japanese.
  expect(html).not.toContain("Set the scope");
  // D-0055 rule 3: ids, digests and the `rondo` token stay ASCII in JA too.
  expect(agentTypeDigest).toMatch(/^[\x20-\x7E]+$/);
  expect(planDigest).toMatch(/^[\x20-\x7E]+$/);
  expect(html).toContain(">rondo</");
});

test("rendering the scope screen writes nothing, however many times or in which state it is drawn", async () => {
  const world = fresh();
  const requestId = "request-scope-idle";
  await seedScopeRequest(world, requestId, "Look at this.");
  const { agentTypeDigest } = await seedScopePlan(world.record, requestId);
  await seedEndedLap(world, "i-scope-idle", { agentTypeDigest, costUsd: 1, durationMs: 60_000 });
  const ports = portsOver(world, "ada", []);

  for (let i = 0; i < 5; i++) {
    await operatorPage(
      ports,
      "t",
      { kind: "scope", messageId: requestId, rounds: i % 4, decisionId: null, plan: null },
      EN,
      mint,
      () => "x",
      () => "y",
    );
  }
  // With no port, too (no `RONDO_APPROVER`): the plan is still read, and the
  // form is not drawn at all, buttons included (rondo#233 S3).
  const bare = await operatorPage(
    ports,
    null,
    { kind: "scope", messageId: requestId, rounds: null, decisionId: null, plan: null },
    EN,
    null,
    null,
    null,
  );
  expect(bare).not.toContain("<form");
  expect(bare).not.toContain("<button");
  expect(bare).toContain(
    "RONDO_APPROVER is not set, so there is nobody this page could approve a scope as.",
  );

  expect(rows(world.connection, "scope")).toBe(0);
  expect(rows(world.connection, "scope_decision")).toBe(0);
  expect(rows(world.connection, "operator_attention")).toBe(0);
});

test(
  "the record-scope press writes the scope, reads it back, counts it and approves it with the digest read back -- and never a decision when the write refused",
  async () => {
    const dir = mkdtempSync(join(tmpdir(), "rondo-scope-write-"));
    const storePath = join(dir, "store.db");
    const connection = new DatabaseSync(storePath);
    const record = advisoryRecord(connection);
    const store = iterationStore(connection, { maxOccupying: 4, maxLive: 6 });
    const requestId = "request-scope-write";
    await record.recordThreadMessage({
      messageId: requestId,
      body: "Please fix it.",
      authorKind: "operator",
      authorId: "ada",
      inReplyTo: null,
      atMs: 1_000,
      bases: [],
      asks: false,
    });
    const plan = await seedScopePlan(record, requestId);
    const environment = { RONDO_APPROVER: "ada" };
    const draft: ScopeFormDraft = {
      scopeId: newScopeId(),
      requestMessageId: requestId,
      planDigest: plan.planDigest,
      agentTypeDigest: plan.agentTypeDigest,
      budgets: {
        laps: 1,
        review_rounds: 1,
        cost_usd: 5,
        cost_reserve_usd: 1,
        expires_at_ms: 9_999_999_999,
      },
      severityThreshold: "major",
      outwardActs: [],
    };

    const recorded = await recordScopeFromPage(environment, store, storePath, "ada", draft);
    expect(recorded.ok).toBe(true);
    expect(recorded.why).toBeUndefined();
    expect(recorded.scopeDecisionId).toBeDefined();

    const stored = await record.readScope(draft.scopeId);
    expect(stored.kind).toBe("read");
    const decision = await record.readScopeDecision(recorded.scopeDecisionId as string);
    expect(decision.kind).toBe("read");
    if (decision.kind === "read" && stored.kind === "read") {
      // D-0066 rule 2.2: the digest approved is the digest read back, never one
      // a form posted -- true here by construction (`recordScopeFromPage`'s own
      // order), not by a person copying a line.
      expect(decision.decision.scopeDigest).toBe(stored.scope.scopeDigest);
      expect(decision.decision.outcome).toBe("approved");
    }
    // Presented, once, for the row this press wrote (D-0042 rule 3).
    const attention = new DatabaseSync(storePath)
      .prepare(
        "SELECT count(*) AS n FROM operator_attention " +
          "WHERE subject_kind = 'scope' AND subject_id = ? AND disposition = 'presented'",
      )
      .get(draft.scopeId) as { n: number };
    expect(Number(attention.n)).toBe(1);

    // A second row, over a request this store never heard of: `recordScope`
    // refuses it, and a decision is never recorded for a scope that was not
    // taken (D-0036 rule 1's order -- write, present, count).
    const refusedDraft: ScopeFormDraft = {
      ...draft,
      scopeId: newScopeId(),
      requestMessageId: "no-such-request",
    };
    const refused = await recordScopeFromPage(environment, store, storePath, "ada", refusedDraft);
    expect(refused.ok).toBe(false);
    // No plan is held for a request nobody made, so the press is refused before
    // anything is written -- the same no-decision outcome, earlier.
    expect(refused.why).toBe("scopeRefusedPlanChanged");
    expect(refused.scopeDecisionId).toBeUndefined();
    expect(await record.readScope(refusedDraft.scopeId)).toEqual({ kind: "absent" });
    expect(rows(new DatabaseSync(storePath), "scope_decision")).toBe(1);
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);

test(
  "a plan that moved between the draw and the press records nothing, because the approval would name a workspace nobody saw",
  async () => {
    // **The hole rule 2.2 leaves open by itself** (rondo#233 S3 press review).
    // The write re-reads the plan, as it must, and the two fields the form does
    // not post -- the workspace and the agent type -- are exactly the ones that
    // say where the work may act. The digest approved is the row's own either
    // way, so rule 2.2's letter holds while the person approves a repository
    // they never read. The form carries what it was drawn from; this compares.
    const dir = mkdtempSync(join(tmpdir(), "rondo-scope-moved-"));
    const storePath = join(dir, "store.db");
    const connection = new DatabaseSync(storePath);
    const record = advisoryRecord(connection);
    const store = iterationStore(connection, { maxOccupying: 4, maxLive: 6 });
    const requestId = "request-scope-moved";
    await record.recordThreadMessage({
      messageId: requestId,
      body: "Please fix it.",
      authorKind: "operator",
      authorId: "ada",
      inReplyTo: null,
      atMs: 1_000,
      bases: [],
      asks: false,
    });
    const plan = await seedScopePlan(record, requestId);
    const drawn: ScopeFormDraft = {
      scopeId: newScopeId(),
      requestMessageId: requestId,
      planDigest: plan.planDigest,
      agentTypeDigest: plan.agentTypeDigest,
      budgets: {
        laps: 1,
        review_rounds: 1,
        cost_usd: 5,
        cost_reserve_usd: 1,
        expires_at_ms: 9_999_999_999,
      },
      severityThreshold: "major",
      outwardActs: [],
    };

    // A digest rondo does not hold for this request -- a plan naming somewhere
    // else, which was never pasted here -- is not the plan the screen drew.
    // Absolute, because a repository on a plan is a path (`requireAbsolute`):
    // the point is a *valid* plan naming somewhere else, not a broken one.
    const moved = { ...scopePlanDocument(), repository: "/srv/other-repo" };
    const env = { RONDO_APPROVER: "ada" };
    const notHeld = await recordScopeFromPage(env, store, storePath, "ada", {
      ...drawn,
      planDigest: planDigest(moved),
    });
    expect(notHeld.ok).toBe(false);
    expect(notHeld.why).toBe("scopeRefusedPlanChanged");
    // A held plan posted with an agent type it does not build is refused too:
    // the two digests are compared, never trusted.
    const otherType = await recordScopeFromPage(env, store, storePath, "ada", {
      ...drawn,
      agentTypeDigest: `sha256:${"0".repeat(64)}`,
    });
    expect(otherType.ok).toBe(false);
    expect(otherType.why).toBe("scopeRefusedPlanChanged");
    // Nothing at all: not the scope, not the presentation, not the approval.
    expect(await record.readScope(drawn.scopeId)).toEqual({ kind: "absent" });
    expect(rows(connection, "scope")).toBe(0);
    expect(rows(connection, "scope_decision")).toBe(0);

    // And the same press against the plan it was drawn from still records.
    const recorded = await recordScopeFromPage(env, store, storePath, "ada", drawn);
    expect(recorded.ok).toBe(true);
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);

test(
  "a second press of an edited form is refused, and never reported as an approval of numbers that were replaced",
  async () => {
    // The id is minted per draw, so the store refuses the second row on the id
    // and the approval already there reads back -- which is a screen saying
    // *approved* about a budget the person has just replaced (rondo#233 S3 press
    // review). The id says which form this is; the payload says whether it is
    // still the same scope.
    const dir = mkdtempSync(join(tmpdir(), "rondo-scope-edited-"));
    const storePath = join(dir, "store.db");
    const connection = new DatabaseSync(storePath);
    const record = advisoryRecord(connection);
    const store = iterationStore(connection, { maxOccupying: 4, maxLive: 6 });
    const requestId = "request-scope-edited";
    await record.recordThreadMessage({
      messageId: requestId,
      body: "Please fix it.",
      authorKind: "operator",
      authorId: "ada",
      inReplyTo: null,
      atMs: 1_000,
      bases: [],
      asks: false,
    });
    const plan = await seedScopePlan(record, requestId);
    const environment = { RONDO_APPROVER: "ada" };
    const draft: ScopeFormDraft = {
      scopeId: newScopeId(),
      requestMessageId: requestId,
      planDigest: plan.planDigest,
      agentTypeDigest: plan.agentTypeDigest,
      budgets: {
        laps: 3,
        review_rounds: 1,
        cost_usd: 5,
        cost_reserve_usd: 1,
        expires_at_ms: 9_999_999_999,
      },
      severityThreshold: "major",
      outwardActs: [],
    };
    const first = await recordScopeFromPage(environment, store, storePath, "ada", draft);
    expect(first.ok).toBe(true);

    // The same form, back from the browser's history, with one number changed.
    const edited: ScopeFormDraft = { ...draft, budgets: { ...draft.budgets, laps: 10 } };
    const again = await recordScopeFromPage(environment, store, storePath, "ada", edited);
    expect(again.ok).toBe(false);
    expect(again.why).toBe("scopeRefusedEdited");
    expect(again.scopeDecisionId).toBeUndefined();

    // What is stored is still the first press's scope, approved once.
    const stored = await record.readScope(draft.scopeId);
    expect(stored.kind === "read" && stored.scope.payload.budgets.laps).toBe(3);
    expect(rows(new DatabaseSync(storePath), "scope")).toBe(1);
    expect(rows(new DatabaseSync(storePath), "scope_decision")).toBe(1);

    // An unedited re-press -- a double click, a resend after a slow write -- is
    // still the write it repeats, and still lands on the approval it made.
    const repeated = await recordScopeFromPage(environment, store, storePath, "ada", draft);
    expect(repeated.ok).toBe(true);
    expect(repeated.scopeDecisionId).toBe(first.scopeDecisionId);
    expect(rows(new DatabaseSync(storePath), "scope_decision")).toBe(1);
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);

test(
  "a scoped start press that names a row already there admits nothing, rather than asking the request a question nobody asked",
  async () => {
    // **The replay the minted id makes possible** (rondo#233 S3, the Codex review
    // of this branch). The iteration id is minted when the form is drawn, so back
    // and submit posts the id the first press already admitted. Sending it through
    // the scope test again is not harmless: the lap it started has spent the
    // budget it was testing against, so the verdict fails and the refusal writes
    // an **asking message into the request's thread** (D-0066 rule 4.4) which then
    // holds the line (D-0069 rule 5) -- a question nobody asked, stopping the
    // work, because somebody pressed back. The guard runs before continuo is
    // started, which is what makes this reachable in a file with no continuo.
    const dir = mkdtempSync(join(tmpdir(), "rondo-start-replay-"));
    const storePath = join(dir, "store.db");
    const connection = new DatabaseSync(storePath);
    const record = advisoryRecord(connection);
    const store = iterationStore(connection, { maxOccupying: 4, maxLive: 6 });
    const requestId = "request-start-replay";
    await record.recordThreadMessage({
      messageId: requestId,
      body: "Please do it.",
      authorKind: "operator",
      authorId: "ada",
      inReplyTo: null,
      atMs: 1_000,
      bases: [],
      asks: false,
    });
    const iterationId = "lap-already-there";
    const reserved = await store.reserve({
      id: iterationId,
      request: "Please do it.",
      plan: planFor(iterationId),
      spend: null,
      scopeSpend: null,
      claim: ownLane(iterationId),
      nowMs: 1_000,
      supersedesIterationId: null,
      requestMessageId: requestId,
      runId: `rondo-${iterationId}`,
      topicBranch: `rondo/${iterationId}`,
      workspace: `/srv/work/${iterationId}`,
    });
    expect(reserved.kind).toBe("reserved");

    const before = rows(connection, "conversation_message");
    const started = await startScopedFromPage({ RONDO_APPROVER: "ada" }, store, storePath, "ada", {
      iterationId,
      requestMessageId: requestId,
      scopeDecisionId: "scope-decision-nobody-approved",
      planDigest: "sha256:not-read-because-the-row-is-already-there",
    });
    // The press is the one that made the row, so it is not a refusal to show.
    expect(started.ok).toBe(true);
    expect(started.why).toBeUndefined();
    // And nothing was asked of the request: the thread is exactly as it was.
    expect(rows(connection, "conversation_message")).toBe(before);
    // Not vacuous: a scope decision nobody approved is what the second press
    // carries, and it reached no scope test at all -- one iteration row, still.
    expect(rows(connection, "iteration")).toBe(1);
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);

test(
  "a revise press on a stale page answers nothing, and writes no framing for it (#233 S4)",
  async () => {
    // **The three refusals that catch a page that went stale**, which is what a
    // page redrawing itself every five seconds sometimes is: a lap that is not
    // there, one that has ended, and one whose row names no gate. None of them is
    // a person answering, so none of them puts a framing in the ledger and none
    // of them starts continuo (D-0042 rule 3's order, `answerFromPage`'s reading
    // of it). Reachable in a file with no continuo for exactly that reason.
    const dir = mkdtempSync(join(tmpdir(), "rondo-revise-stale-"));
    const storePath = join(dir, "store.db");
    const connection = new DatabaseSync(storePath);
    const store = iterationStore(connection, { maxOccupying: 4, maxLive: 6 });
    await openRequest(connection);
    const ended = "lap-ended";
    const reserved = await store.reserve({
      id: ended,
      request: "Please do it.",
      plan: planFor(ended),
      spend: null,
      scopeSpend: null,
      claim: ownLane(ended),
      nowMs: 1_000,
      supersedesIterationId: null,
      requestMessageId: REQUEST,
      runId: `rondo-${ended}`,
      topicBranch: `rondo/${ended}`,
      workspace: `/srv/work/${ended}`,
    });
    expect(reserved.kind).toBe("reserved");

    const pressing = (iterationId: string) =>
      reviseFromPage({ RONDO_APPROVER: "ada" }, store, storePath, "ada", {
        iterationId,
        successorId: "lap-00000000-0000-4000-8000-000000000009",
        scopeDecisionId: "sd-0001",
        body: "narrow it to the parser",
      });

    // A lap that is at its gate, and was admitted under no approval: the page
    // draws no revise form on one, and a press that names an approval anyway is
    // refused before the gate is touched (Codex round 2 -- the hidden field is
    // compared against the admission row and never trusted).
    const gated = "lap-gated";
    const openedReserve = await store.reserve({
      id: gated,
      request: "Please do it.",
      plan: planFor(gated),
      spend: null,
      scopeSpend: null,
      claim: ownLane(gated),
      nowMs: 1_000,
      supersedesIterationId: null,
      requestMessageId: REQUEST,
      runId: `rondo-${gated}`,
      topicBranch: `rondo/${gated}`,
      workspace: `/srv/work/${gated}`,
    });
    expect(openedReserve.kind).toBe("reserved");
    for (const [from, to] of [
      ["planned", "admitting"],
      ["admitting", "admitted"],
      ["admitted", "performing"],
      ["performing", "awaiting_human"],
    ] as const) {
      const moved = await store.transition(
        gated,
        from,
        to,
        to === "awaiting_human" ? { gateId: `gate-${gated}` } : {},
        2_000,
      );
      expect(moved.kind).toBe("transitioned");
    }

    const absent = await pressing("lap-not-there");
    expect(absent.ok).toBe(false);
    expect(absent.why).toBe("reviseRefusedGateClosed");
    // A row that is live but names no gate: the button is not drawn on one, and
    // a press that arrives anyway answers nothing.
    const noGate = await pressing(ended);
    expect(noGate.ok).toBe(false);
    expect(noGate.why).toBe("reviseRefusedGateClosed");
    // The approval the press named is not the one this lap was admitted under --
    // it was admitted under none -- so nothing is answered and no gate is walked.
    const wrongScope = await pressing(gated);
    expect(wrongScope.ok).toBe(false);
    expect(wrongScope.why).toBe("reviseRefusedNotItsScope");
    // Nothing was recorded for either: no proposal, no attention row, no message.
    expect(rows(connection, "proposal")).toBe(0);
    // The fixture's own request is in the conversation; nothing else is.
    expect(rows(connection, "conversation_message")).toBe(1);
    expect(rows(connection, "scope_consumption")).toBe(0);
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);

test(
  "a second revise press of one form joins the first only when it says the same thing (#233 S4)",
  async () => {
    // **The successor's id is minted per draw, so a double click carries one id**
    // -- and so does a press made from the same form after the browser's Back
    // button, with the words edited since (Codex round 3). The first is the press
    // that is running and the second is its repeat; the third is a different
    // instruction, and answering *sent* over words that were never sent is the
    // failure this screen exists not to have. Both presses here refuse before
    // continuo, on the lap's own state, which is what makes this reachable in a
    // file with no continuo -- what is under test is which of them joined.
    const dir = mkdtempSync(join(tmpdir(), "rondo-revise-twice-"));
    const storePath = join(dir, "store.db");
    const connection = new DatabaseSync(storePath);
    const store = iterationStore(connection, { maxOccupying: 4, maxLive: 6 });
    const successorId = "lap-00000000-0000-4000-8000-00000000000a";
    const pressing = (body: string) =>
      reviseFromPage({ RONDO_APPROVER: "ada" }, store, storePath, "ada", {
        iterationId: "lap-not-there",
        successorId,
        scopeDecisionId: "sd-0001",
        body,
      });

    const [first, same, other] = await Promise.all([
      pressing("narrow it to the parser"),
      pressing("narrow it to the parser"),
      pressing("actually, leave the parser alone"),
    ]);
    // The repeat is the press that made it: the same answer, whatever it was.
    expect(same).toEqual(first);
    // The one carrying other words is refused, and says the first is running.
    expect(other.ok).toBe(false);
    expect(other.why).toBe("reviseRefusedStillRunning");
    expect(rows(connection, "proposal")).toBe(0);
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);

test("the first scope in a store shows what its agent type is allowed, read from the plan the press will record", async () => {
  // **D-0069 section 1 in the one case the store cannot answer** (rondo#233 S3,
  // Codex round 3). A fresh store holds no `agent_type_record` and has run no
  // lap, so the held read is absent and the line could only say rondo holds no
  // record -- while the form goes on offering the press. The person would be
  // approving a hash, which is what that section exists to stop. The plan the
  // press is about to record is what the record is built from, so it answers
  // before the press; nothing is written by asking it.
  const world = fresh();
  const requestId = "request-scope-firstplan";
  await seedScopeRequest(world, requestId, "Fix it, please.");
  const plan = await seedScopePlan(world.record, requestId);
  const ports = portsOver(world, "ada", []);
  const view = {
    kind: "scope",
    messageId: requestId,
    rounds: null,
    decisionId: null,
    plan: null,
  } as const;

  const html = await operatorPage(
    ports,
    "t",
    view,
    EN,
    mint,
    () => "x",
    () => "y",
  );
  expect(html).toContain(plan.agentTypeDigest);
  expect(html).toContain("tier standard");
  expect(html).toContain("read from the plan this scope records");
  // Not the blind line: that one is still what a digest with no plan behind it
  // gets, which is the assertion that keeps this from passing vacuously.
  expect(html).not.toContain("rondo holds no record of what it is allowed");
  expect(
    (await heldAgentTypeLines(EN, world.record, [`sha256:${"0".repeat(64)}`])).join("\n"),
  ).toContain("rondo holds no record of what it is allowed");

  // Asking wrote nothing: the record is still the press's to write.
  expect(rows(world.connection, "agent_type_record")).toBe(0);
  expect(rows(world.connection, "scope")).toBe(0);

  // And it is said in the page's language too, not only in English.
  const ja = await operatorPage(
    ports,
    "t",
    view,
    chromeFor("ja"),
    mint,
    () => "x",
    () => "y",
  );
  expect(ja).toContain("この範囲が記録するプラン");
});

test("with no plan held, the scope screen says how one comes to be held, on the page, and draws no form (rondo#238)", async () => {
  const world = fresh();
  const requestId = "request-scope-noplan";
  await seedScopeRequest(world, requestId, "Fix it, please.");
  const ports = portsOver(world, "ada", []);
  const view = {
    kind: "scope",
    messageId: requestId,
    rounds: null,
    decisionId: null,
    plan: null,
  } as const;
  const en = await operatorPage(
    ports,
    "t",
    view,
    EN,
    mint,
    () => "x",
    () => "y",
  );
  expect(en).toContain(EN.scopeNoPlanHeld);
  expect(en).not.toContain('id="scope-form"');
  const ja = await operatorPage(
    ports,
    "t",
    view,
    chromeFor("ja"),
    mint,
    () => "x",
    () => "y",
  );
  expect(ja).toContain(chromeFor("ja").scopeNoPlanHeld);
  expect(ja).not.toContain('id="scope-form"');
  // Never sent to a terminal: no environment variable is named.
  expect(en).not.toContain("RONDO_PLAN");
  // Nothing held means setup did not finish, not a paste owed (D-0075 rule 4.1).
  for (const said of [EN.scopeNoPlanHeld, chromeFor("ja").scopeNoPlanHeld]) {
    expect(said).not.toMatch(/JSON|paste|plan\.json|貼/);
  }
});

test("a fresh store setup finished offers setup's plan, and two setups alike on the line say when each was held (D-0075)", async () => {
  const world = fresh();
  const requestId = "request-scope-setup";
  await seedScopeRequest(world, requestId, "Fix it, please.");
  const stale = { ...scopePlanDocument(), claude_command: ["/old/claude"] };
  const repaired = scopePlanDocument();
  for (const [setupId, plan, atMs] of [
    ["setup-1", stale, Date.UTC(2026, 8, 19, 9, 5)],
    ["setup-2", repaired, Date.UTC(2026, 8, 19, 10, 30)],
  ] as const) {
    expect(
      await world.record.recordSetupPlan({ setupId, plan, recordedBy: "ada", recordedAtMs: atMs }),
    ).toEqual({ kind: "recorded" });
  }
  const drawn = await operatorPage(
    portsOver(world, "ada", []),
    "t",
    { kind: "scope", messageId: requestId, rounds: null, decisionId: null, plan: null },
    EN,
    mint,
    () => "x",
    () => "y",
  );
  const choice = drawn.slice(drawn.indexOf('id="plans"'));
  expect(choice).toContain("(from setting up this machine), held since 2026-09-19 10:30 UTC");
  expect(choice).toContain("(from setting up this machine), held since 2026-09-19 09:05 UTC");
  // The newest setup is the screen's own pick.
  expect(drawn).toContain(
    `<input type="hidden" name="plan_digest" value="${planDigest(repaired)}"/>`,
  );
  expect(drawn).not.toContain(EN.scopeNoPlanHeld);
});

test("the scope screen shows the definition of done beside the request, naming the plan's rule files (rondo#377)", async () => {
  const world = fresh();
  const requestId = "request-scope-done";
  await seedScopeRequest(world, requestId, "#291 をやってほしい");
  const view = {
    kind: "scope",
    messageId: requestId,
    rounds: null,
    decisionId: null,
    plan: null,
  } as const;
  const drawn = async (wording: Chrome) => {
    const page = await operatorPage(
      portsOver(world, "ada", []),
      "t",
      view,
      wording,
      mint,
      () => "x",
      () => "y",
    );
    const at = page.indexOf('class="scope-done');
    expect(at).toBeGreaterThan(page.indexOf('class="request'));
    return page.slice(at, page.indexOf("</section>", at)).replaceAll("&#39;", "'");
  };

  // No plan names a rule file: the three asks are there, and the worker is told to look.
  const none = await drawn(EN);
  for (const ask of EN.scopeDoneAsks) expect(none).toContain(ask);
  expect(none).toContain(EN.scopeDoneNoRules);

  const plan = {
    ...scopePlanDocument(),
    review_criterion: {
      severities: { blocker: "b", major: "m", minor: "n", nit: "t" },
      rule_files: ["AGENTS.md"],
    },
  };
  expect(
    await world.record.recordSetupPlan({
      setupId: "setup-1",
      plan,
      recordedBy: "ada",
      recordedAtMs: 2_000,
    }),
  ).toEqual({ kind: "recorded" });
  const en = await drawn(EN);
  expect(en).toContain(EN.scopeDoneRules(["AGENTS.md"]));
  // The words the worker is sent, in the fold, are the ones the lap's prompt carries.
  expect(en).toContain("Commit your work on this lap's branch.");
  expect(en).toContain("The repository's own rules are in AGENTS.md in your workspace");
  const ja = chromeFor("ja");
  const inJa = await drawn(ja);
  expect(inJa).toContain(ja.scopeDoneHeading);
  for (const ask of ja.scopeDoneAsks) expect(inJa).toContain(ask);
  expect(inJa).toContain(ja.scopeDoneRules(["AGENTS.md"]));
});

test("with two plans held, the screen offers the choice, the first marked, and the address picks the other (rondo#238)", async () => {
  const world = fresh();
  const requestId = "request-scope-two";
  await seedScopeRequest(world, requestId, "Fix it, please.");
  const first = await seedScopePlan(world.record, requestId);
  const elsewhere = { ...scopePlanDocument(), repository: "/srv/other-repo" };
  const second = await seedScopePlan(world.record, requestId, elsewhere, `${requestId}-plan-2`);
  const ports = portsOver(world, "ada", []);
  const view = (plan: string | null) =>
    ({ kind: "scope", messageId: requestId, rounds: null, decisionId: null, plan }) as const;

  // Newest pasted first: the second paste is the screen's own pick.
  const drawn = await operatorPage(
    ports,
    "t",
    view(null),
    EN,
    mint,
    () => "x",
    () => "y",
  );
  const choice = drawn.slice(drawn.indexOf('id="plans"'));
  expect(choice).toContain(`/srv/other-repo at ${SCOPE_PLAN.workspaceRoot}`);
  expect(choice).toContain(`${SCOPE_PLAN.repository} at ${SCOPE_PLAN.workspaceRoot}`);
  expect(choice).toContain('aria-current="true"');
  expect(drawn).toContain(`<input type="hidden" name="plan_digest" value="${second.planDigest}"/>`);
  expect(drawn).toContain(
    `href="/?scope=${requestId}&amp;plan=${encodeURIComponent(first.planDigest)}&amp;lang=en"`,
  );

  const picked = await operatorPage(
    ports,
    "t",
    view(first.planDigest),
    EN,
    mint,
    () => "x",
    () => "y",
  );
  expect(picked).toContain(`<input type="hidden" name="plan_digest" value="${first.planDigest}"/>`);
  expect(picked).toContain(
    `<input type="hidden" name="agent_type" value="${first.agentTypeDigest}"/>`,
  );
});

test("a plan the address names and rondo no longer offers is said, with the list again and no form -- never another plan under its name (rondo#238)", async () => {
  const world = fresh();
  const requestId = "request-scope-gone";
  await seedScopeRequest(world, requestId, "Fix it, please.");
  const held = await seedScopePlan(world.record, requestId);
  const ports = portsOver(world, "ada", []);
  const gone = `sha256:${"9".repeat(64)}`;
  for (const wording of [EN, chromeFor("ja")]) {
    const page = await operatorPage(
      ports,
      "t",
      { kind: "scope", messageId: requestId, rounds: null, decisionId: null, plan: gone },
      wording,
      mint,
      () => "x",
      () => "y",
    );
    expect(page).toContain(wording.scopePlanGone);
    expect(page).not.toContain('id="scope-form"');
    // The one plan there is, offered as the way on.
    expect(page).toContain(`plan=${encodeURIComponent(held.planDigest)}`);
  }
});

test("the approved scope's start runs on a held plan it allows, and says so where there is none (rondo#238)", async () => {
  const world = fresh();
  const requestId = "request-scope-startplan";
  await seedScopeRequest(world, requestId, "Fix it, please.");
  const plan = await seedScopePlan(world.record, requestId);
  const approve = async (scopeId: string, repository: string) => {
    await world.record.recordScope({
      scopeId,
      payload: scopePayloadWithDefaults({
        requests: [requestId],
        workspaces: [{ repository, workspace_root: SCOPE_PLAN.workspaceRoot }],
        agent_types: [plan.agentTypeDigest],
        budgets: {
          laps: 1,
          review_rounds: 1,
          cost_usd: 5,
          cost_reserve_usd: 1,
          expires_at_ms: 9_999_999_999,
        },
        severity_threshold: "major",
        outward_acts: [],
        irreversible_additions: [],
      }),
      supersedesScopeId: null,
      authorKind: "operator",
      authorId: "ada",
      bases: [],
      createdAtMs: 1_000,
      agentTypeRecords: [
        {
          agentTypeDigest: plan.agentTypeDigest,
          agentTypeInput: SCOPE_AGENT_TYPE_INPUT,
          planDigest: plan.planDigest,
        },
      ],
    });
    const stored = await world.record.readScope(scopeId);
    if (stored.kind !== "read") throw new Error(JSON.stringify(stored));
    await world.record.recordScopeDecision({
      scopeDecisionId: `decision-${scopeId}`,
      scopeId,
      scopeDigest: stored.scope.scopeDigest,
      outcome: "approved",
      actorId: "ada",
      recordedBy: "rondo/page",
      decidedAtMs: 1_500,
    });
  };
  await approve("scope-here", SCOPE_PLAN.repository);
  await approve("scope-nowhere", "/srv/nowhere");
  const ports = portsOver(world, "ada", []);
  const view = (decisionId: string) =>
    ({ kind: "scope", messageId: requestId, rounds: null, decisionId, plan: null }) as const;

  const here = await operatorPage(
    ports,
    "t",
    view("decision-scope-here"),
    EN,
    mint,
    () => "x",
    () => "y",
  );
  expect(here).toContain('id="start-form"');
  expect(here).toContain(`<input type="hidden" name="plan" value="${plan.planDigest}"/>`);

  const nowhere = await operatorPage(
    ports,
    "t",
    view("decision-scope-nowhere"),
    EN,
    mint,
    () => "x",
    () => "y",
  );
  expect(nowhere).not.toContain('id="start-form"');
  expect(nowhere).toContain(EN.scopeNoPlanForScope);
});

test("a drafter run that drafted nothing is said as what happened, with the way to set the scope; its words are folded (rondo#238)", async () => {
  const world = fresh();
  const requestId = "request-nodraft";
  await seedScopeRequest(world, requestId, "Fix it, please.");
  const said = async (messageId: string, body: string, bases: JsonRecord[]) => {
    const outcome = await world.record.recordThreadMessage({
      messageId,
      body,
      authorKind: "drafter",
      authorId: "rondo/drafter/1/claude-opus-5",
      inReplyTo: requestId,
      atMs: 2_000,
      bases,
      asks: false,
    });
    if (outcome.kind !== "recorded") throw new Error(JSON.stringify(outcome));
  };
  await said("drafter-none", "rondo's drafter wrote no draft for this: claude exited 1", [
    { form: "message", messageId: requestId },
  ]);
  const ports = portsOver(world, "ada", []);
  const view = { kind: "thread", messageId: requestId, to: null } as const;
  const html = await operatorPage(
    ports,
    "t",
    view,
    EN,
    mint,
    () => "x",
    () => "y",
  );
  const card = html.slice(html.indexOf('id="drafter-none"'));
  expect(card).toContain(EN.drafterNoDraft);
  // The way to set the scope is the thread's next step, drawn once above the
  // messages (rondo#375), and not a second copy inside this one.
  expect(html.slice(0, html.indexOf('id="drafter-none"'))).toContain(
    `href="/?scope=${requestId}&amp;lang=en"`,
  );
  expect(card).not.toContain(`href="/?scope=${requestId}&amp;lang=en"`);
  expect(card).toContain("<details");
  expect(card).toContain(EN.drafterNoDraftWhy);
  expect(card.indexOf("<details")).toBeLessThan(card.indexOf("claude exited 1"));
  // Signed as rondo: the drafter's row name is a version and a model id (#259).
  expect(card.slice(0, card.indexOf("</header>"))).toContain('<span class="msg-who">rondo</span>');
  expect(html).not.toContain(">rondo/drafter/1/claude-opus-5<");
  const ja = await operatorPage(
    ports,
    "t",
    view,
    chromeFor("ja"),
    mint,
    () => "x",
    () => "y",
  );
  expect(ja).toContain(chromeFor("ja").drafterNoDraft);

  // A drafter message resting on the proposal its run wrote is a draft, and
  // reads as its own words.
  world.connection
    .prepare(
      "INSERT INTO proposal (proposal_id, kind, drafter, payload, proposal_digest, snapshot, " +
        "snapshot_digest, created_at_ms) VALUES ('draft-1', 'split', 'rondo/drafter/1/x', '{}', " +
        "'d', '{}', 'd', 1)",
    )
    .run();
  await said("drafter-summary", "One plan: fix the flaky test.", [
    { form: "message", messageId: requestId },
    { form: "proposal", proposalId: "draft-1" },
  ]);
  const drafted = await operatorPage(
    ports,
    "t",
    view,
    EN,
    mint,
    () => "x",
    () => "y",
  );
  const summary = drafted.slice(drafted.indexOf('id="drafter-summary"'));
  expect(summary.slice(0, summary.indexOf("</li>"))).not.toContain(EN.drafterNoDraft);
  expect(summary).toContain("One plan: fix the flaky test.");
});
