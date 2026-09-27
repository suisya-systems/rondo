/**
 * rondo#469: under a goal scope a person approved, the flow host asks for the
 * goal's next request itself -- one opener as `rondo/flow/1`, under the
 * picker's id -- and never starts a lap. The drafter drafts the split and no
 * scope, D-0127's tick finds it under the goal scope, and the triage reading
 * it came from counts toward the scope's cost. A stop is asked once.
 *
 * A real store in memory; the laps are a list the test fills.
 */
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import { approvedSplits } from "../../src/access/drafted-view.js";
import { drafterHost } from "../../src/access/drafter-host.js";
import { type FlowHostPorts, flowHost } from "../../src/access/flow-host.js";
import { unreadIssues } from "../../src/access/issue-read.js";
import { MODEL_DRAFTER_PREFIX } from "../../src/access/model-draft/judgement.js";
import { flowMessageId } from "../../src/advisory/flow.js";
import { type TriagePayload, triagePayloadDocument } from "../../src/advisory/triage.js";
import { contentDigest } from "../../src/store/plan.js";
import {
  askStandsOver,
  FLOW_AUTHOR,
  type IterationRecord,
  type JsonRecord,
  type ProposalDraft,
} from "../../src/store/records.js";
import { advisoryRecord } from "../../src/store/sqlite.js";

const REPO = "o/r";
const AGENT_TYPE = `sha256:${"a".repeat(64)}`;

const goalPayload = (parts: Record<string, number> = {}): JsonRecord => ({
  requests: { from_goal: "g-1" },
  workspaces: [{ repository: "/srv/repo", workspace_root: "/srv/work" }],
  agent_types: [AGENT_TYPE],
  budgets: {
    laps: 5,
    review_rounds: 3,
    cost_usd: 10,
    cost_reserve_usd: 2,
    expires_at_ms: 100_000,
    ...parts,
  },
  severity_threshold: "major",
  outward_acts: [],
  irreversible_additions: [],
});

const ranked = (number: number, openPoints = 0): TriagePayload["ranked"][number] => ({
  key: `issue:${REPO}#${String(number)}`,
  clause: 1,
  request: `Fix issue ${String(number)} in ${REPO}`,
  why: "the person has to open a terminal for it",
  openPoints: Array.from({ length: openPoints }, () => ({ point: "p", recommendation: "r" })),
  source: { form: "issue", repository: REPO, number },
  title: `issue ${String(number)}`,
  labels: [],
});

const proposal = (parts: Partial<ProposalDraft>): ProposalDraft => ({
  proposalId: "p",
  kind: "split",
  drafter: "d",
  payload: {},
  snapshot: {},
  derivation: null,
  iterationId: null,
  supersedesIterationId: null,
  supersedesProposalId: null,
  predecessorPlanDigest: null,
  predecessorContractDigest: null,
  agentTypeDigest: null,
  configDigest: null,
  contractDigest: null,
  continuoRevision: null,
  cadenzaRevision: null,
  elevatedFromMessageId: null,
  elevatedByActorId: null,
  createdAtMs: 1,
  ...parts,
});

async function world(budgets: Record<string, number> = {}, ranking = [ranked(7), ranked(8)]) {
  const connection = new DatabaseSync(":memory:");
  const record = advisoryRecord(connection);
  const laps: IterationRecord[] = [];
  const log: string[] = [];
  let injected = 0;
  let nowMs = 10_000;
  expect(
    await record.recordGoal({
      goalId: "g-1",
      repository: REPO,
      clauses: [{ said: "nobody opens a terminal", unmetIf: "a terminal is opened" }],
      writtenBy: "oidc|operator-1",
      writtenAtMs: 1,
    }),
  ).toEqual({ kind: "recorded" });
  const triage = async (proposalId: string, costUsd: number, rows = ranking) =>
    expect(
      await record.recordProposal(
        proposal({
          proposalId,
          kind: "triage",
          drafter: "rondo/triage/1/m",
          payload: triagePayloadDocument({
            repository: REPO,
            goalId: "g-1",
            ranked: rows,
            withheld: [],
            read: { issues: rows.length, stopped: 0 },
            unavailable: null,
          }),
          snapshot: { cost_usd: costUsd },
          createdAtMs: nowMs,
        }),
      ),
    ).toEqual({ kind: "recorded" });
  await triage("t-1", 1.5);
  // A scope lists only agent types rondo holds (D-0066 rule 1.2.3).
  connection
    .prepare(
      "INSERT INTO agent_type_record (agent_type_digest, agent_type_input, plan_digest, " +
        "recorded_by, recorded_at_ms) VALUES (?, '{}', ?, 'oidc|operator-1', 1)",
    )
    .run(AGENT_TYPE, AGENT_TYPE);
  const payload = goalPayload(budgets);
  expect(
    await record.recordScope({
      scopeId: "s-goal",
      payload,
      supersedesScopeId: null,
      authorKind: "operator",
      authorId: "oidc|operator-1",
      bases: [],
      createdAtMs: 2,
      agentTypeRecords: [],
    }),
  ).toEqual({ kind: "recorded" });
  expect(
    await record.recordScopeDecision({
      scopeDecisionId: "sd-goal",
      scopeId: "s-goal",
      scopeDigest: contentDigest(payload),
      outcome: "approved",
      actorId: "oidc|operator-1",
      recordedBy: "rondo/cli",
      decidedAtMs: 3,
    }),
  ).toEqual({ kind: "recorded" });
  const ports: FlowHostPorts = {
    store: {
      readLive: async () =>
        laps
          .filter((lap) => !["closed", "failed", "abandoned"].includes(lap.status))
          .map((lap) => ({ kind: "read" as const, record: lap })),
      terminalIterations: async () =>
        laps
          .filter((lap) => ["closed", "failed", "abandoned"].includes(lap.status))
          .map((lap) => ({ kind: "read" as const, record: lap })),
      occupancy: async () => ({ occupying: 0, live: 0 }) as never,
    },
    record,
    policy: { maxOccupying: 2, maxLive: 3 },
    now: () => nowMs,
    log: (line) => log.push(line),
    injected: () => {
      injected += 1;
    },
  };
  const host = flowHost(ports);
  const pass = async () => {
    host.kick();
    await host.settled();
  };
  const messages = async () => {
    const read = await record.threadMessages();
    if (read.kind !== "read") throw new Error(read.reason);
    return read.messages;
  };
  /** The drafter's split for `requestMessageId`, as its run writes one. */
  const drafted = async (proposalId: string, requestMessageId: string, plans: number) =>
    expect(
      await record.recordDraft({
        requestMessageId,
        operatorMessageIds: [requestMessageId],
        drafterPrefix: MODEL_DRAFTER_PREFIX,
        proposal: proposal({
          proposalId,
          drafter: `${MODEL_DRAFTER_PREFIX}1/m`,
          payload: {
            plans: Array.from({ length: plans }, () => ({
              template_plan_digest: AGENT_TYPE,
              prompt: "p",
              agent_type_digest: AGENT_TYPE,
              bases: [],
            })),
            holes: [],
          },
          snapshot: { covers: [requestMessageId], material: { requestMessageId } },
        }),
        scope: null,
        messages: [],
      }),
    ).toEqual({ kind: "recorded" });
  const lap = (id: string, requestMessageId: string, status: string, at: number) =>
    laps.push({
      id,
      requestMessageId,
      status,
      supersedesIterationId: null,
      updatedAtMs: at,
    } as unknown as IterationRecord);
  return {
    connection,
    record,
    log,
    laps,
    pass,
    messages,
    drafted,
    lap,
    triage,
    injectedCount: () => injected,
    setNow: (at: number) => {
      nowMs = at;
    },
  };
}

const first = flowMessageId("sd-goal", `issue:${REPO}#7`);
const second = flowMessageId("sd-goal", `issue:${REPO}#8`);

test("the flow writes the goal's next request as rondo/flow/1, once, and counts the triage reading", async () => {
  const w = await world();
  await w.pass();
  await w.pass();
  const openers = (await w.messages()).filter((m) => m.inReplyTo === null);
  expect(openers.map((m) => m.messageId)).toEqual([first]);
  const opener = openers[0];
  expect(opener?.authorKind).toBe("drafter");
  expect(opener?.authorId).toBe(FLOW_AUTHOR);
  expect(opener?.bases).toEqual([
    { form: "proposal", proposalId: "t-1" },
    { form: "goal", goalId: "g-1" },
  ]);
  // The report cites the clause it goes against, and the issue.
  expect(opener?.body).toContain(
    'rondo started this because it goes against clause 1 of the goal: "nobody opens a terminal".',
  );
  expect(opener?.body).toContain(`Issue: ${REPO}#7`);
  expect(w.injectedCount()).toBe(1);
  // The reading's 1.5 USD is the approval's, and is counted once.
  expect((await w.record.scopeSpent("sd-goal")).readCostUsd).toBe(1.5);
  // The goal scope covers it: D-0127's tick has nothing to start until a split is drafted.
  expect(await approvedSplits({ record: w.record })).toEqual([]);
  // It starts nothing itself.
  expect(w.laps).toEqual([]);
  // The store takes the issue reader's reply to it, as to a person's message.
  const reply = (inReplyTo: string) =>
    w.record.recordThreadMessage({
      messageId: `forge-${inReplyTo}`,
      body: "read",
      authorKind: "forge",
      authorId: "rondo/issue-reader/1",
      inReplyTo,
      atMs: 1,
      bases: [],
      asks: false,
    });
  expect(await reply(first)).toEqual({ kind: "recorded" });
  expect((await reply(`forge-${first}`)).kind).toBe("refused");
});

test("the drafter drafts a flow opener under its goal scope, and the tick starts its split", async () => {
  const w = await world();
  await w.pass();
  const scopes: unknown[] = [];
  const drafter = drafterHost({
    store: {} as never,
    record: {
      ...w.record,
      recordDraft: async (write) => {
        scopes.push(write.scope);
        return await w.record.recordDraft(write);
      },
    },
    runDrafter: (() => {
      throw new Error("not reached");
    }) as never,
    now: () => 20_000,
    mintId: (kind) => `${kind}-1`,
    language: null,
    log: () => undefined,
    draft: async (_ports, requestMessageId) =>
      ({
        drafter: `${MODEL_DRAFTER_PREFIX}1/m`,
        document: "d",
        costUsd: 0.5,
        material: {
          requestMessageId,
          thread: [
            {
              messageId: requestMessageId,
              authorKind: "drafter",
              authorId: FLOW_AUTHOR,
              inReplyTo: null,
              asks: false,
              body: "b",
            },
          ],
          templates: [],
          agentTypes: [],
          policies: [],
          laps: [],
          rows: [],
          draftedAtMs: 20_000,
          language: null,
        },
        outcome: {
          kind: "drafted",
          act: "split",
          split: { plans: [], holes: [] },
          // What the drafter drafts for a person's request: dropped under a goal scope.
          scope: { payload: {}, bases: [], narrowed: [], agentTypeRecords: [] },
          messages: [],
        },
      }) as never,
  });
  drafter.kick();
  await drafter.idle();
  expect(scopes).toEqual([null]);
  expect(await approvedSplits({ record: w.record })).toEqual([
    { scopeDecisionId: "sd-goal", proposalId: "draft-1", requestMessageId: first },
  ]);
});

test("a request not yet started holds the next one; a running one does not", async () => {
  const w = await world();
  await w.pass();
  await w.drafted("split-1", first, 1);
  await w.pass();
  expect(w.log).toContain("flow     o/r: waiting (injection_pending)");
  expect((await w.messages()).filter((m) => m.inReplyTo === null)).toHaveLength(1);
  // Running is bounded by the host's slots, not by the flow (D-0124).
  w.lap("lap-1", first, "performing", 1);
  await w.pass();
  expect((await w.messages()).filter((m) => m.inReplyTo === null).map((m) => m.messageId)).toEqual([
    first,
    second,
  ]);
});

test("two failed injections stop the flow, and the person is asked once in the latest thread", async () => {
  const w = await world({}, [ranked(7), ranked(8), ranked(9)]);
  await w.pass();
  await w.drafted("split-1", first, 1);
  w.lap("lap-1", first, "failed", 1);
  await w.pass();
  await w.drafted("split-2", second, 1);
  w.lap("lap-2", second, "abandoned", 2);
  await w.pass();
  await w.pass();
  const messages = await w.messages();
  expect(messages.filter((m) => m.inReplyTo === null)).toHaveLength(2);
  const asks = messages.filter((m) => m.asks);
  expect(asks.map((m) => [m.messageId, m.inReplyTo])).toEqual([
    [`flow-stop-sd-goal-failed_twice-${second}`, second],
  ]);
  expect(asks[0]?.body).toContain("Stopped: rondo starts no further request toward the goal");
  expect(asks[0]?.body).toContain("Recommended: stop");
});

test("the scope's cost, triage readings included, stops the flow before the request is written", async () => {
  // 10 USD, 2 reserved per lap: a 9 USD reading leaves no room for the next request.
  const w = await world();
  await w.pass();
  await w.drafted("split-1", first, 1);
  w.lap("lap-1", first, "closed", 1);
  await w.triage("t-2", 9);
  // t-2 is claimed for the next request, and then there is no room for it.
  await w.pass();
  expect((await w.record.scopeSpent("sd-goal")).readCostUsd).toBe(10.5);
  const messages = await w.messages();
  expect(messages.filter((m) => m.inReplyTo === null).map((m) => m.messageId)).toEqual([first]);
  const asks = messages.filter((m) => m.asks);
  expect(asks.map((m) => m.messageId)).toEqual([`flow-stop-sd-goal-cost-${first}`]);
  expect(asks[0]?.body).toContain("triage readings included");
  expect(asks[0]?.body).toContain("Recommended: widen the scope");
});

test("a successor approval keeps the goal's requests: nothing is asked for twice, and an old failure does not stop it", async () => {
  const w = await world({}, [ranked(7), ranked(8), ranked(9)]);
  await w.pass();
  await w.drafted("split-1", first, 1);
  w.lap("lap-1", first, "failed", 1);
  await w.pass();
  // #8 is drafted and waiting to start when the person widens the scope.
  await w.drafted("split-2", second, 1);
  const payload = goalPayload({ laps: 9 });
  expect(
    await w.record.recordScope({
      scopeId: "s-wide",
      payload,
      supersedesScopeId: "s-goal",
      authorKind: "operator",
      authorId: "oidc|operator-1",
      bases: [],
      createdAtMs: 4,
      agentTypeRecords: [],
    }),
  ).toEqual({ kind: "recorded" });
  expect(
    await w.record.recordScopeDecision({
      scopeDecisionId: "sd-wide",
      scopeId: "s-wide",
      scopeDigest: contentDigest(payload),
      outcome: "approved",
      actorId: "oidc|operator-1",
      recordedBy: "rondo/cli",
      decidedAtMs: 5,
    }),
  ).toEqual({ kind: "recorded" });
  await w.pass();
  expect((await w.messages()).filter((m) => m.inReplyTo === null)).toHaveLength(2);
  // #8 fails too; under the old approval that was two failures in a row.
  w.lap("lap-2", second, "failed", 2);
  await w.pass();
  const openers = (await w.messages()).filter((m) => m.inReplyTo === null);
  expect(openers.map((m) => m.messageId)).toEqual([
    first,
    second,
    flowMessageId("sd-wide", `issue:${REPO}#9`),
  ]);
  expect((await w.messages()).filter((m) => m.asks)).toEqual([]);
});

test("a successor approval's stop in an inherited thread holds it too", async () => {
  const w = await world({}, [ranked(7)]);
  await w.pass();
  await w.drafted("split-1", first, 1);
  w.lap("lap-1", first, "closed", 1);
  const payload = goalPayload({ laps: 9 });
  expect(
    await w.record.recordScope({
      scopeId: "s-wide",
      payload,
      supersedesScopeId: "s-goal",
      authorKind: "operator",
      authorId: "oidc|operator-1",
      bases: [],
      createdAtMs: 4,
      agentTypeRecords: [],
    }),
  ).toEqual({ kind: "recorded" });
  expect(
    await w.record.recordScopeDecision({
      scopeDecisionId: "sd-wide",
      scopeId: "s-wide",
      scopeDigest: contentDigest(payload),
      outcome: "approved",
      actorId: "oidc|operator-1",
      recordedBy: "rondo/cli",
      decidedAtMs: 5,
    }),
  ).toEqual({ kind: "recorded" });
  // Nothing left: the successor asks in the thread the earlier approval opened.
  await w.pass();
  expect((await w.messages()).filter((m) => m.asks).map((m) => m.messageId)).toEqual([
    `flow-stop-sd-wide-nothing_eligible-${first}`,
  ]);
  // A new candidate is ranked; the stop still stands unanswered.
  await w.triage("t-2", 0, [ranked(7), ranked(8)]);
  await w.pass();
  expect((await w.messages()).filter((m) => m.inReplyTo === null)).toHaveLength(1);
});

test("the flow's opener names an issue the reader reads, as a person's message does", () => {
  const opener = {
    messageId: first,
    body: `Fix it\n\nIssue: ${REPO}#7`,
    authorKind: "drafter" as const,
    authorId: FLOW_AUTHOR,
    inReplyTo: null,
    atMs: 1,
    bases: [],
    asks: false,
  };
  expect([...unreadIssues([opener], new Set()).keys()]).toEqual([first]);
  // Another drafter row naming an issue is not read.
  expect(
    unreadIssues([{ ...opener, authorId: "rondo/advisory/deterministic" }], new Set()).size,
  ).toBe(0);
});

test("an expired scope stops the flow before its first request, said on the terminal", async () => {
  const w = await world({ expires_at_ms: 5_000 });
  await w.pass();
  await w.pass();
  expect(await w.messages()).toEqual([]);
  expect(w.log.filter((line) => line.includes("stopped before its first request"))).toHaveLength(1);
});

test("a paused goal scope (laps: 0) injects nothing and asks nothing", async () => {
  const w = await world({ laps: 0 });
  await w.pass();
  expect(await w.messages()).toEqual([]);
  expect(w.log.join("\n")).toContain("paused");
});

test("a newer goal stops the flow: an edited goal is approved again", async () => {
  const w = await world();
  await w.pass();
  expect(
    await w.record.recordGoal({
      goalId: "g-2",
      repository: REPO,
      clauses: [{ said: "ship it", unmetIf: "" }],
      writtenBy: "oidc|operator-1",
      writtenAtMs: 2,
    }),
  ).toEqual({ kind: "recorded" });
  await w.pass();
  const asks = (await w.messages()).filter((m) => m.asks);
  expect(asks.map((m) => m.messageId)).toEqual([`flow-stop-sd-goal-newer_goal-${first}`]);
  expect(asks[0]?.body).toContain("a new goal scope over the newest goal");
});

test("nothing eligible stops the flow once, and the ask holds it", async () => {
  const w = await world({}, [ranked(7)]);
  await w.pass();
  await w.drafted("split-1", first, 1);
  w.lap("lap-1", first, "closed", 1);
  await w.pass();
  await w.pass();
  const asks = (await w.messages()).filter((m) => m.asks);
  expect(asks.map((m) => m.messageId)).toEqual([`flow-stop-sd-goal-nothing_eligible-${first}`]);
  expect(w.log.join("\n")).toContain("waiting (open_ask)");
  // It holds the flow, and no part of the request it is asked in.
  const open = await w.record.openAsksIn(first);
  if (open.kind !== "read") throw new Error(open.reason);
  expect(open.asks.map((ask) => askStandsOver(ask, [], true))).toEqual([false]);
});

test("open points are asked once before the request, and the answers go into it (rondo#487)", async () => {
  const w = await world({}, [ranked(7, 2), ranked(8)]);
  await w.pass();
  await w.pass();
  // Asked, once, and nothing injected or counted: the wait is on the person.
  expect((await w.messages()).filter((m) => m.inReplyTo === null)).toEqual([]);
  expect(w.injectedCount()).toBe(0);
  expect((await w.record.scopeSpent("sd-goal")).readCostUsd).toBe(0);
  const asks = await w.record.flowAsks();
  expect(asks.map((ask) => [ask.askId, ask.candidate, ask.answer])).toEqual([
    [`flow-ask-sd-goal-issue:${REPO}#7`, `issue:${REPO}#7`, null],
  ]);
  expect(asks[0]?.points).toEqual([
    { point: "p", recommendation: "r" },
    { point: "p", recommendation: "r" },
  ]);
  expect(w.log.join("\n")).toContain("asked the person 2 open point(s)");
  expect(w.log.join("\n")).toContain("waiting (points_asked)");
  expect(w.log.join("\n")).not.toContain("stopped");
  // An answer that leaves a point out is refused; a whole one is kept once.
  const answer = (answers: string[]) =>
    w.record.recordFlowAnswer({
      askId: `flow-ask-sd-goal-issue:${REPO}#7`,
      answers,
      answeredBy: "oidc|operator-1",
      answeredAtMs: 11_000,
    });
  expect((await answer(["yes", " "])).kind).toBe("refused");
  expect(await answer(["yes", "as rondo suggests"])).toEqual({ kind: "recorded" });
  expect((await answer(["again", "again"])).kind).toBe("refused");
  await w.pass();
  const openers = (await w.messages()).filter((m) => m.inReplyTo === null);
  expect(openers.map((m) => m.messageId)).toEqual([first]);
  expect(openers[0]?.body).toContain(
    "Open points, as the person answered them:\n- p: yes\n- p: as rondo suggests",
  );
  expect(w.injectedCount()).toBe(1);
});

test("a put-aside ask holds nothing: the flow moves on to the next candidate", async () => {
  const w = await world({}, [ranked(7, 1), ranked(8)]);
  await w.pass();
  expect(await w.record.flowAsks()).toHaveLength(1);
  expect(
    await w.record.recordTriageDecline({
      declineId: "d-1",
      proposalId: "t-1",
      candidate: `issue:${REPO}#7`,
      declinedBy: "oidc|operator-1",
      declinedAtMs: 11_000,
    }),
  ).toEqual({ kind: "recorded" });
  await w.pass();
  expect((await w.messages()).filter((m) => m.inReplyTo === null).map((m) => m.messageId)).toEqual([
    second,
  ]);
});
