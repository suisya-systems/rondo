/**
 * From a drafted split to a lap (rondo#238 C2, D-0063 rule 4, D-0071 rule 5.3):
 * the plan a lap would run, read back from the proposal row; the approval of a
 * drafted scope as drafted or as the person changed it; and whether a plan can
 * start, answered before anything is pressed.
 *
 * Over a real store file, because the page's presses open the store by path,
 * and with a draft written the way the host writes one -- a fake `claude`
 * answering, the real run, the real one-transaction write.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test, vi } from "vitest";

import { recordDraftedScopeFromPage, startSplitFromPage } from "../../src/access/cli.js";
import { draftedStartReadiness } from "../../src/access/drafted-start.js";
import { drafterHost } from "../../src/access/drafter-host.js";
import { ISSUES_QUOTE_OPENING } from "../../src/access/issue-read.js";
import { draftedPlanRun } from "../../src/access/model-draft/host.js";
import { allocate } from "../../src/refrain/allocator.js";
import { admittedPlan, planPayload, type RunPlan } from "../../src/refrain/plan.js";
import { planDigest } from "../../src/store/plan.js";
import type { JsonRecord } from "../../src/store/records.js";
import { advisoryRecord, iterationStore } from "../../src/store/sqlite.js";
import { ownLane } from "../lane-claims.js";
import { AGENT_TYPE_INPUT, agentTypeDigestOf, planDocument } from "./fixtures/drafter.js";

const PROMPTS = ["Fix the scope screen's cost box.", "Title-case the approve button."];
/** What each plan claims (D-0073 rule 2.3): two paths no other plan shares. */
const CLAIMS = [["src/access/scope.ts"], ["src/access/web.tsx", "test/access/"]];

/**
 * The two seams a start press needs past its own reads: continuo, which is not
 * on this machine, and the conductor's `admit`, whose arguments are what the
 * press hands admission. Real unless a test sets `pressed`.
 */
const seams = vi.hoisted(() => ({ pressed: null as unknown[] | null }));
vi.mock("../../src/continuo/invoker.js", async (original) => {
  const real = await original<typeof import("../../src/continuo/invoker.js")>();
  return {
    ...real,
    startContinuo: async (environment?: Readonly<Record<string, string | undefined>>) =>
      seams.pressed === null
        ? await real.startContinuo(environment)
        : { kind: "ready", continuo: {} as never },
  };
});
vi.mock("../../src/access/conductor.js", async (original) => {
  const real = await original<typeof import("../../src/access/conductor.js")>();
  return {
    ...real,
    admit: async (...args: Parameters<typeof real.admit>) => {
      if (seams.pressed === null) return await real.admit(...args);
      seams.pressed.push(...args);
      return { iterationId: null, status: null, lines: ["captured by the test"] };
    },
  };
});

async function drafted() {
  const dir = mkdtempSync(join(tmpdir(), "rondo-drafted-start-"));
  const storePath = join(dir, "store.db");
  const connection = new DatabaseSync(storePath);
  const record = advisoryRecord(connection);
  const store = iterationStore(connection, { maxOccupying: 4, maxLive: 6 });
  await record.messagesBeforeDrafter(0);
  const document = planDocument();
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
  await say("r1", "Two things, please.", null, 1_000);
  await say("r1-plan", JSON.stringify(document), "r1", 2_000);
  const typeDigest = agentTypeDigestOf(document);
  let n = 0;
  const host = drafterHost({
    store,
    record,
    now: () => 10_000,
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
        summary: { text: "Two plans.", bases: ["r1"] },
        plans: PROMPTS.map((prompt, i) => ({
          template_plan_digest: planDigest(document),
          agent_type_digest: typeDigest,
          prompt,
          bases: ["r1"],
          claim: CLAIMS[i],
        })),
      }),
    }),
  });
  host.kick();
  await host.idle();
  // Minted in order: the host's holder, the proposal, two messages' worth of
  // ids at most, then the scope -- read it back rather than count.
  const scopeRow = connection
    .prepare("SELECT scope_id FROM scope WHERE author_kind = 'drafter'")
    .get() as { scope_id: string };
  const proposalRow = connection
    .prepare("SELECT proposal_id FROM proposal WHERE kind = 'split'")
    .get() as { proposal_id: string };
  const scope = await record.readScope(scopeRow.scope_id);
  if (scope.kind !== "read") throw new Error("the drafted scope did not read");
  return {
    storePath,
    connection,
    record,
    store,
    typeDigest,
    document,
    draft: scope.scope,
    proposalId: proposalRow.proposal_id,
  };
}

const ENV = { RONDO_APPROVER: "ada" };

/**
 * Every test here writes on-disk stores -- several, each with a draft's
 * transactions -- which is `test/access/web-scope.test.ts`'s heavy class (#222,
 * #241): on PR #267's Windows node 24 cell this file took 12.3 s for four
 * tests against 0.36 s on Ubuntu, and on a slower Windows runner one of them
 * passed the 10 s default. A floor under Windows filesystem variance, not a
 * budget.
 */
const WINDOWS_HEAVY_TIMEOUT_MS = 60_000;

/** A plan as a real admission would persist it under `id`. */
function admittedPayload(plan: RunPlan, id: string): JsonRecord {
  const allocation = allocate(id, plan.workspaceRoot);
  if (allocation.kind !== "allocated") throw new Error(allocation.reason);
  const admitted = admittedPlan(plan, allocation.allocation);
  if (admitted.kind !== "planned") throw new Error(admitted.reason);
  return planPayload(admitted.plan);
}
/** The store's own bounds: room enough unless a test narrows it. */
const DEFAULT_HOST_POLICY = { maxOccupying: 4, maxLive: 6 };

test(
  "a drafted plan runs its template's plan with the drafted prompt and the named agent type, read back from the rows",
  async () => {
    const w = await drafted();
    const run = await draftedPlanRun(w, "r1", w.proposalId, 1);
    expect(run.kind).toBe("runnable");
    if (run.kind !== "runnable") return;
    expect(run.plan.prompt).toBe(PROMPTS[1]);
    expect(run.plan.agentTypeInput).toEqual(AGENT_TYPE_INPUT);
    expect(run.split.prompt).toBe(PROMPTS[1]);
    // The claim beside the plan, as the first admission asks for it (D-0073 rule 2.3):
    // the drafter run's own, resting on the split row and the plan's words.
    expect(run.claim).toEqual({
      paths: ["src/access/web.tsx", "test/access/"],
      authorKind: "drafter",
      authorId: expect.stringMatching(/^rondo\/drafter\/5\//),
      bases: [
        { form: "proposal", proposalId: w.proposalId },
        { form: "message", messageId: "r1" },
      ],
    });
    // Everything else is the template's.
    expect(run.plan.repository).toBe((w.document as JsonRecord)["repository"]);

    for (const [what, request, proposal, index] of [
      ["no such plan", "r1", w.proposalId, 2],
      ["another request's", "r9", w.proposalId, 0],
      ["no such proposal", "r1", "draft-none", 0],
    ] as const) {
      expect((await draftedPlanRun(w, request, proposal, index)).kind, what).toBe("refused");
    }
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);

test(
  "pressed as drafted, the approval is the drafter's own row; changed, it is the person's successor with a scope: basis to the draft (D-0071 rule 5.3)",
  async () => {
    const w = await drafted();
    const form = {
      draftScopeId: w.draft.scopeId,
      draftDigest: w.draft.scopeDigest,
      scopeId: "scope-mine-1",
      budgets: w.draft.payload.budgets,
      severityThreshold: w.draft.payload.severity_threshold,
      outwardActs: w.draft.payload.outward_acts,
    };
    const asDrafted = await recordDraftedScopeFromPage(ENV, w.storePath, "ada", form);
    expect(asDrafted.ok).toBe(true);
    const onDraft = await w.record.scopeDecisionOf(w.draft.scopeId);
    expect(onDraft.kind === "read" && onDraft.decision.outcome).toBe("approved");
    expect((await w.record.readScope("scope-mine-1")).kind).toBe("absent");

    const w2 = await drafted();
    const changed = await recordDraftedScopeFromPage(ENV, w2.storePath, "ada", {
      ...form,
      draftScopeId: w2.draft.scopeId,
      draftDigest: w2.draft.scopeDigest,
      budgets: { ...w2.draft.payload.budgets, cost_usd: 3 },
    });
    expect(changed.ok).toBe(true);
    const mine = await w2.record.readScope("scope-mine-1");
    expect(mine.kind).toBe("read");
    if (mine.kind !== "read") return;
    expect(mine.scope.authorKind).toBe("operator");
    expect(mine.scope.supersedesScopeId).toBe(w2.draft.scopeId);
    expect(mine.scope.bases).toEqual([{ form: "scope", scopeId: w2.draft.scopeId }]);
    expect(mine.scope.payload.budgets.cost_usd).toBe(3);
    // The lists are the draft's, never the form's.
    expect(mine.scope.payload.agent_types).toEqual(w2.draft.payload.agent_types);
    expect((await w2.record.scopeDecisionOf(w2.draft.scopeId)).kind).toBe("absent");
    const onMine = await w2.record.scopeDecisionOf("scope-mine-1");
    expect(onMine.kind === "read" && onMine.decision.outcome).toBe("approved");

    // The draft the person's own scope retired is not approved again, by a stale
    // tab or the back button (D-0066 rule 1.4).
    const again = await recordDraftedScopeFromPage(ENV, w2.storePath, "ada", {
      ...form,
      draftScopeId: w2.draft.scopeId,
      draftDigest: w2.draft.scopeDigest,
      scopeId: "scope-mine-2",
    });
    expect(again).toMatchObject({ ok: false, why: "scopeRefusedPlanChanged" });
    expect((await w2.record.scopeDecisionOf(w2.draft.scopeId)).kind).toBe("absent");
    // Nor edited again from another tab: one approved successor, not two.
    const otherTab = await recordDraftedScopeFromPage(ENV, w2.storePath, "ada", {
      ...form,
      draftScopeId: w2.draft.scopeId,
      draftDigest: w2.draft.scopeDigest,
      scopeId: "scope-mine-3",
      budgets: { ...w2.draft.payload.budgets, cost_usd: 2 },
    });
    expect(otherTab).toMatchObject({ ok: false, why: "scopeRefusedPlanChanged" });
    expect((await w2.record.readScope("scope-mine-3")).kind).toBe("absent");
    // The first edit's own form, pressed again, is still the write it repeats.
    const replayed = await recordDraftedScopeFromPage(ENV, w2.storePath, "ada", {
      ...form,
      draftScopeId: w2.draft.scopeId,
      draftDigest: w2.draft.scopeDigest,
      budgets: { ...w2.draft.payload.budgets, cost_usd: 3 },
    });
    expect(replayed.ok).toBe(true);

    // A form drawn over another digest records nothing.
    const w3 = await drafted();
    const stale = await recordDraftedScopeFromPage(ENV, w3.storePath, "ada", {
      ...form,
      draftScopeId: w3.draft.scopeId,
      draftDigest: `sha256:${"0".repeat(64)}`,
    });
    expect(stale).toMatchObject({ ok: false, why: "scopeRefusedPlanChanged" });
    expect((await w3.record.scopeDecisionOf(w3.draft.scopeId)).kind).toBe("absent");
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);

test(
  "whether a drafted plan can start is answered before any press: the scope, a lap already started, the host's room",
  async () => {
    const w = await drafted();
    const ports = (policy = DEFAULT_HOST_POLICY) => ({
      store: w.store,
      record: w.record,
      policy,
      nowMs: 20_000,
    });
    // An approval that is not there: the decision will not read, which is not
    // a no from the scope but a check that could not be made.
    expect(
      await draftedStartReadiness(ports(), "r1", "scope-decision-none", w.proposalId, 0),
    ).toMatchObject({ kind: "undecidable", test: "decision" });

    const approved = await recordDraftedScopeFromPage(ENV, w.storePath, "ada", {
      draftScopeId: w.draft.scopeId,
      draftDigest: w.draft.scopeDigest,
      scopeId: "scope-mine-1",
      budgets: w.draft.payload.budgets,
      severityThreshold: w.draft.payload.severity_threshold,
      outwardActs: w.draft.payload.outward_acts,
    });
    const decision = approved.scopeDecisionId as string;
    // The whole answer in the message, so a failure on another platform says
    // which test refused and why rather than only that it was not ready.
    const ready = await draftedStartReadiness(ports(), "r1", decision, w.proposalId, 0);
    expect(ready.kind, JSON.stringify(ready)).toBe("ready");
    expect(await draftedStartReadiness(ports(), "r1", decision, w.proposalId, 9)).toMatchObject({
      kind: "unrunnable",
    });

    // A lap of this request that runs plan 0's words: plan 0 is started, plan 1 is not.
    const run = await draftedPlanRun(w, "r1", w.proposalId, 0);
    if (run.kind !== "runnable") throw new Error("plan 0 does not run");
    const reserved = await w.store.reserve({
      numbers: null,
      id: "lap-plan-0",
      request: "Two things, please.",
      // The plan as admission stores it: allocated identifiers and all, the
      // grantee rewritten to the run id (`admittedPlan`).
      plan: admittedPayload(run.plan, "lap-plan-0"),
      spend: null,
      scopeSpend: null,
      claim: ownLane("lap-plan-0"),
      nowMs: 15_000,
      supersedesIterationId: null,
      requestMessageId: "r1",
      runId: "rondo-lap-plan-0",
      topicBranch: "rondo/lap-plan-0",
      workspace: "/srv/work/lap-plan-0",
    });
    expect(reserved.kind).toBe("reserved");
    expect(await draftedStartReadiness(ports(), "r1", decision, w.proposalId, 0)).toEqual({
      kind: "started",
      iterationId: "lap-plan-0",
    });
    // A lap with plan 1's words and another plan is not plan 1 started: the plan
    // is compared whole, identifiers aside.
    const decoy = await w.store.reserve({
      numbers: null,
      id: "lap-decoy",
      request: "Two things, please.",
      plan: { ...w.document, prompt: PROMPTS[1] as string, turn_timeout_ms: 600_000 },
      spend: null,
      scopeSpend: null,
      claim: ownLane("lap-decoy"),
      nowMs: 16_000,
      supersedesIterationId: null,
      requestMessageId: "r1",
      runId: "rondo-lap-decoy",
      topicBranch: "rondo/lap-decoy",
      workspace: "/srv/work/lap-decoy",
    });
    expect(decoy.kind).toBe("reserved");
    expect((await draftedStartReadiness(ports(), "r1", decision, w.proposalId, 1)).kind).not.toBe(
      "started",
    );
    // With the one live lap as many as this host allows, plan 1 waits on room.
    expect(
      await draftedStartReadiness(
        ports({ ...DEFAULT_HOST_POLICY, maxLive: 1, maxOccupying: 1 }),
        "r1",
        decision,
        w.proposalId,
        1,
      ),
    ).toMatchObject({ kind: "full", live: 2, limit: 1 });

    // The press asks the same questions and admits nothing on a no.
    const pressed = await startSplitFromPage(
      ENV,
      w.store,
      w.storePath,
      "ada",
      DEFAULT_HOST_POLICY,
      {
        iterationId: "lap-again",
        requestMessageId: "r1",
        scopeDecisionId: decision,
        proposalId: w.proposalId,
        planIndex: 0,
      },
    );
    expect(pressed).toMatchObject({ ok: false, why: "startRefusedNotAdmitted" });
    expect((await w.store.read("lap-again")).kind).toBe("absent");
    const nowhere = await startSplitFromPage(
      ENV,
      w.store,
      w.storePath,
      "ada",
      DEFAULT_HOST_POLICY,
      {
        iterationId: "lap-nowhere",
        requestMessageId: "r1",
        scopeDecisionId: decision,
        proposalId: w.proposalId,
        planIndex: 9,
      },
    );
    expect(nowhere).toMatchObject({ ok: false, why: "startRefusedNoPlan" });
    // Refused before admission: no stop was written into the thread.
    expect(
      w.connection.prepare("SELECT count(*) AS n FROM conversation_message WHERE asks = 1").get(),
    ).toEqual({ n: 0 });
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);

test(
  "the start press hands admission the plan's drafted claim, not the whole repository (D-0073 rule 2.3)",
  async () => {
    const w = await drafted();
    const approved = await recordDraftedScopeFromPage(ENV, w.storePath, "ada", {
      draftScopeId: w.draft.scopeId,
      draftDigest: w.draft.scopeDigest,
      scopeId: "scope-mine-1",
      budgets: w.draft.payload.budgets,
      severityThreshold: w.draft.payload.severity_threshold,
      outwardActs: w.draft.payload.outward_acts,
    });
    seams.pressed = [];
    // The draft's clock, so its scope has not expired when the press reads the time.
    vi.useFakeTimers({ toFake: ["Date"], now: 20_000 });
    try {
      const result = await startSplitFromPage(
        ENV,
        w.store,
        w.storePath,
        "ada",
        DEFAULT_HOST_POLICY,
        {
          iterationId: "lap-pressed",
          requestMessageId: "r1",
          scopeDecisionId: approved.scopeDecisionId as string,
          proposalId: w.proposalId,
          planIndex: 0,
        },
      );
      expect(result.note, JSON.stringify(result)).toContain("captured by the test");
      // conductor.admit(ports, advisory, plan, policy, id, supersedes, spend, request, scopeSpend, claim)
      const [, , , , id, supersedes, , , , claim] = seams.pressed;
      expect(id).toBe("lap-pressed");
      expect(supersedes).toBeNull();
      expect(claim).toEqual({
        paths: ["src/access/scope.ts"],
        authorKind: "drafter",
        authorId: expect.stringMatching(/^rondo\/drafter\/5\//),
        bases: [
          { form: "proposal", proposalId: w.proposalId },
          { form: "message", messageId: "r1" },
        ],
      });
    } finally {
      vi.useRealTimers();
      seams.pressed = null;
    }
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);

test(
  "two edits of one draft pressed together from two tabs leave one approved successor, not two (D-0066 rule 1.4)",
  async () => {
    const w = await drafted();
    const edit = (scopeId: string, cost: number) =>
      recordDraftedScopeFromPage(ENV, w.storePath, "ada", {
        draftScopeId: w.draft.scopeId,
        draftDigest: w.draft.scopeDigest,
        scopeId,
        budgets: { ...w.draft.payload.budgets, cost_usd: cost },
        severityThreshold: w.draft.payload.severity_threshold,
        outwardActs: w.draft.payload.outward_acts,
      });
    const outcomes = await Promise.all([edit("scope-tab-1", 3), edit("scope-tab-2", 2)]);
    expect(outcomes.filter((o) => o.ok)).toHaveLength(1);
    const approved = w.connection
      .prepare(
        "SELECT count(*) AS n FROM scope_decision d JOIN scope s ON s.scope_id = d.scope_id " +
          "WHERE s.supersedes_scope_id = ? AND d.outcome = 'approved'",
      )
      .get(w.draft.scopeId);
    expect(approved).toEqual({ n: 1 });
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);

test(
  "a lap given the issues its request named is still that plan, started (D-0078 section 3.4)",
  async () => {
    const w = await drafted();
    const ports = { store: w.store, record: w.record, policy: DEFAULT_HOST_POLICY, nowMs: 20_000 };
    const run = await draftedPlanRun(w, "r1", w.proposalId, 1);
    if (run.kind !== "runnable") throw new Error("plan 1 does not run");
    const reserve = (id: string, prompt: string) =>
      w.store.reserve({
        numbers: null,
        id,
        request: "Two things, please.",
        plan: admittedPayload({ ...run.plan, prompt }, id),
        spend: null,
        scopeSpend: null,
        claim: ownLane(id),
        nowMs: 15_000,
        supersedesIterationId: null,
        requestMessageId: "r1",
        runId: `rondo-${id}`,
        topicBranch: `rondo/${id}`,
        workspace: `/srv/work/${id}`,
      });
    // Words after the plan's that are not rondo's quote are another plan.
    expect((await reserve("lap-longer", `${run.plan.prompt} And more.`)).kind).toBe("reserved");
    expect(
      (await draftedStartReadiness(ports, "r1", "scope-decision-none", w.proposalId, 1)).kind,
    ).not.toBe("started");
    expect(
      (await reserve("lap-quoted", `${run.plan.prompt}${ISSUES_QUOTE_OPENING} ...`)).kind,
    ).toBe("reserved");
    expect(
      await draftedStartReadiness(ports, "r1", "scope-decision-none", w.proposalId, 1),
    ).toEqual({ kind: "started", iterationId: "lap-quoted" });
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);
