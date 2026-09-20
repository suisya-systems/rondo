/**
 * The scope record: its three tables, its two writers, its readers and the
 * scope's spend inside `reserve()` (D-0066 sections 1-3 and rule 4.3).
 *
 * Against a real `node:sqlite` in-memory database, for `advisory-record.test.ts`'s
 * reason: what is under test is a primary key, a UNIQUE, a recursive query and
 * a re-test made under one `BEGIN IMMEDIATE`, and a fake would assert the fake.
 *
 * **Every refusal is observed firing and its control observed not firing.** For
 * the writers the control is the neighbouring draft that records. For the spend
 * it is the neighbouring admission that reserves, and writes its consumption row
 * beside the iteration row; a flipped input is observed stopping at its own
 * test, in D-0066 rule 4.3's order.
 */
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import type { HostPolicy } from "../../src/refrain/policy.js";
import { contentDigest } from "../../src/store/plan.js";
import {
  type AnswerOutcome,
  isApprovableKind,
  type JsonRecord,
  type ScopeDecisionDraft,
  type ScopeDraft,
  scopePayloadWithDefaults,
  type ThreadMessageDraft,
} from "../../src/store/records.js";
import { advisoryRecord, type ReserveInput, type ScopeSpend } from "../../src/store/sqlite.js";
import { laneFor } from "../lane-claims.js";
import { REQUEST, storeWithRequest } from "../request-fixture.js";

/** Bounds high enough that capacity never answers before the scope does. */
const ROOMY: HostPolicy = { maxOccupying: 100, maxLive: 100 };

const AGENT_TYPE = `sha256:${"a".repeat(64)}`;
const OTHER_AGENT_TYPE = `sha256:${"b".repeat(64)}`;
const REPOSITORY = "/srv/repo";
const WORKSPACE_ROOT = "/srv/work";

const PAYLOAD: JsonRecord = {
  requests: ["m-0001"],
  workspaces: [{ repository: REPOSITORY, workspace_root: WORKSPACE_ROOT }],
  agent_types: [AGENT_TYPE],
  budgets: { laps: 3, review_rounds: 3, cost_usd: 10, cost_reserve_usd: 2, expires_at_ms: 10_000 },
  severity_threshold: "major",
  outward_acts: [],
  irreversible_additions: [],
};

/** A thread message, opening a request unless `inReplyTo` says otherwise (D-0061 rule 2). */
const message = (parts: Partial<ThreadMessageDraft> = {}): ThreadMessageDraft => ({
  messageId: "m-0001",
  body: "please do the work",
  authorKind: "operator",
  authorId: "oidc|operator-1",
  inReplyTo: null,
  atMs: 1,
  bases: [],
  asks: false,
  ...parts,
});

/**
 * The person's answer to `inReplyTo` (D-0072 rule 1). `carry_on` is what ends
 * the hold; `stop` records that they stopped the line and leaves it held.
 */
const answer = (
  messageId: string,
  inReplyTo: string,
  answerOutcome: AnswerOutcome = "carry_on",
): ThreadMessageDraft => message({ messageId, body: "answered", inReplyTo, answerOutcome });

/** A drafter's question in `m-0001`'s thread, over whatever its bases name (D-0066 rule 4.4). */
const ask = (messageId: string, bases: JsonRecord[], inReplyTo = "m-0001"): ThreadMessageDraft =>
  message({
    messageId,
    body: "which way?",
    authorKind: "drafter",
    authorId: "rondo/deterministic",
    inReplyTo,
    bases: [{ form: "message", messageId: "m-0001" }, ...bases],
    asks: true,
  });

/**
 * A store holding what a scope may name: the request message, and an iteration
 * row carrying the agent type (D-0062 rule 1.2's "a record rondo already holds").
 */
const seeded = async (policy: HostPolicy = ROOMY) => {
  const connection = new DatabaseSync(":memory:");
  const store = storeWithRequest(connection, policy);
  const record = advisoryRecord(connection);
  expect(await record.recordThreadMessage(message())).toEqual({ kind: "recorded" });
  await store.reserve(reserveInput("i-held", null));
  connection
    .prepare("UPDATE iteration SET agent_type_digest = ?, status = 'closed' WHERE id = ?")
    .run(AGENT_TYPE, "i-held");
  return { connection, store, record };
};

const scope = (parts: Partial<ScopeDraft> = {}): ScopeDraft => ({
  scopeId: "s-0001",
  payload: PAYLOAD,
  supersedesScopeId: null,
  authorKind: "operator",
  authorId: "oidc|operator-1",
  bases: [],
  createdAtMs: 1_000,
  agentTypeRecords: [],
  ...parts,
});

const scopeDecision = (parts: Partial<ScopeDecisionDraft> = {}): ScopeDecisionDraft => ({
  scopeDecisionId: "sd-0001",
  scopeId: "s-0001",
  scopeDigest: contentDigest(PAYLOAD),
  outcome: "approved",
  actorId: "oidc|operator-1",
  recordedBy: "rondo/cli",
  decidedAtMs: 2_000,
  ...parts,
});

const spendOf = (parts: Partial<ScopeSpend> = {}): ScopeSpend => ({
  scopeDecisionId: "sd-0001",
  proposalId: null,
  agentTypeDigest: AGENT_TYPE,
  ...parts,
});

function reserveInput(
  id: string,
  scopeSpend: ScopeSpend | null,
  parts: Partial<ReserveInput> = {},
): ReserveInput {
  return {
    id,
    request: `do ${id}`,
    plan: { run_id: `r-${id}`, repository: REPOSITORY, workspace_root: WORKSPACE_ROOT },
    runId: `rondo-${id}`,
    topicBranch: `rondo/${id}`,
    workspace: `/srv/work/iter-${id}`,
    supersedesIterationId: null,
    requestMessageId: "m-0001",
    spend: null,
    scopeSpend,
    claim: laneFor(id, parts.supersedesIterationId ?? null),
    nowMs: 5_000,
    ...parts,
  };
}

/** A store with one approved scope, ready to be spent against. */
const approved = async (payload: JsonRecord = PAYLOAD) => {
  const seed = await seeded();
  expect(await seed.record.recordScope(scope({ payload }))).toEqual({ kind: "recorded" });
  expect(
    await seed.record.recordScopeDecision(scopeDecision({ scopeDigest: contentDigest(payload) })),
  ).toEqual({ kind: "recorded" });
  return seed;
};

const withBudgets = (budgets: JsonRecord): JsonRecord => ({
  ...PAYLOAD,
  budgets: { ...(PAYLOAD["budgets"] as JsonRecord), ...budgets },
});

const count = (connection: DatabaseSync, sql: string, ...values: string[]): number =>
  Number((connection.prepare(sql).get(...values) as { n: number }).n);

/**
 * An act already recorded under `decisionId` (an admission under `sd-0001`
 * unless the test says otherwise), with its lap cost as the test wants it.
 */
const admitted = (
  connection: DatabaseSync,
  id: string,
  costUsd: number | null,
  decisionId = "sd-0001",
  actKind = "admission",
): void => {
  connection
    .prepare(
      "INSERT INTO iteration (id, status, request, plan, plan_digest, attempts, identifiers_spent, " +
        "lap_cost_usd, created_at_ms, updated_at_ms) VALUES (?, 'closed', 'r', '{}', 'x', 1, 0, ?, 1, 1)",
    )
    .run(id, costUsd);
  connection
    .prepare(
      "INSERT INTO scope_consumption (scope_decision_id, act_kind, subject_id, proposal_id, " +
        "consumed_at_ms) VALUES (?, ?, ?, NULL, 1)",
    )
    .run(decisionId, actKind, id);
};

// --- recordScope ------------------------------------------------------------

test("a scope is held verbatim beside its digest, and read back with it re-derived", async () => {
  const { record } = await seeded();
  expect(await record.recordScope(scope())).toEqual({ kind: "recorded" });
  const read = await record.readScope("s-0001");
  expect(read.kind).toBe("read");
  if (read.kind === "read") {
    expect(read.scope.scopeDigest).toBe(contentDigest(PAYLOAD));
    expect(read.scope.payload.agent_types).toEqual([AGENT_TYPE]);
    expect(read.scope.authorKind).toBe("operator");
  }
  expect(await record.readScope("s-none")).toEqual({ kind: "absent" });
});

test("a scope row whose payload no longer digests to its column is unreadable", async () => {
  const { connection, record } = await seeded();
  await record.recordScope(scope());
  connection
    .prepare("UPDATE scope SET scope_digest = 'sha256:moved' WHERE scope_id = 's-0001'")
    .run();
  expect((await record.readScope("s-0001")).kind).toBe("unreadable");
});

const PAYLOAD_REFUSALS: readonly (readonly [string, JsonRecord, string])[] = [
  [
    "an unknown top-level key",
    { ...PAYLOAD, predicate: "all" },
    "'predicate' is not a scope field",
  ],
  [
    "an unknown workspace key",
    { ...PAYLOAD, workspaces: [{ repository: REPOSITORY, workspace_root: WORKSPACE_ROOT, x: 1 }] },
    "'x' is not a workspaces field",
  ],
  ["an unknown budget", withBudgets({ turns: 4 }), "'turns' is not a budget"],
  ["empty requests", { ...PAYLOAD, requests: [] }, "requests must not be empty"],
  ["empty workspaces", { ...PAYLOAD, workspaces: [] }, "workspaces must be a non-empty list"],
  ["empty agent_types", { ...PAYLOAD, agent_types: [] }, "agent_types must not be empty"],
  [
    "a duplicate request",
    { ...PAYLOAD, requests: ["m-0001", "m-0001"] },
    "requests holds a duplicate",
  ],
  [
    "a duplicate workspace",
    {
      ...PAYLOAD,
      workspaces: [
        { repository: REPOSITORY, workspace_root: WORKSPACE_ROOT },
        { repository: REPOSITORY, workspace_root: WORKSPACE_ROOT },
      ],
    },
    "twice",
  ],
  ["a non-string request id", { ...PAYLOAD, requests: [7] }, "requests must hold only strings"],
  ["a malformed agent type", { ...PAYLOAD, agent_types: ["sha256:ABC"] }, "not an agentTypeDigest"],
  [
    "a missing budget",
    { ...PAYLOAD, budgets: { laps: 1, review_rounds: 3, cost_usd: 1, cost_reserve_usd: 1 } },
    "'expires_at_ms' is missing",
  ],
  ["fractional laps", withBudgets({ laps: 1.5 }), "'laps' must be a whole number"],
  ["negative review rounds", withBudgets({ review_rounds: -1 }), "'review_rounds' must be a whole"],
  ["a negative cost", withBudgets({ cost_usd: -1 }), "'cost_usd' must be a finite number"],
  [
    "a string reserve",
    withBudgets({ cost_reserve_usd: "2" }),
    "'cost_reserve_usd' must be a finite",
  ],
  ["a fractional expiry", withBudgets({ expires_at_ms: 1.5 }), "'expires_at_ms' must be a whole"],
  ["an unknown threshold", { ...PAYLOAD, severity_threshold: "p1" }, "severity_threshold must be"],
  [
    "merge_default_branch",
    { ...PAYLOAD, outward_acts: ["merge_default_branch"] },
    "CI observation",
  ],
  ["an unknown outward act", { ...PAYLOAD, outward_acts: ["tag"] }, "'tag', which is not one of"],
  ["an empty irreversible name", { ...PAYLOAD, irreversible_additions: [""] }, "an empty name"],
  ["a non-string irreversible name", { ...PAYLOAD, irreversible_additions: [1] }, "only strings"],
];

test.each(PAYLOAD_REFUSALS)("the scope writer refuses %s", async (_name, payload, reason) => {
  const { connection, record } = await seeded();
  const outcome = await record.recordScope(scope({ payload }));
  expect(outcome.kind).toBe("refused");
  expect(outcome.kind === "refused" ? outcome.reason : "").toContain(reason);
  expect(count(connection, "SELECT COUNT(*) AS n FROM scope")).toBe(0);
});

test("the payload refusals' control: zeros, both outward acts and an addition record", async () => {
  const { record } = await seeded();
  const payload = {
    ...withBudgets({ laps: 0, review_rounds: 0, cost_usd: 0, cost_reserve_usd: 0 }),
    outward_acts: ["push_branch", "open_pull_request"],
    irreversible_additions: ["rotate_secret"],
  };
  expect(await record.recordScope(scope({ payload }))).toEqual({ kind: "recorded" });
});

test("defaults fill only the keys that are absent, before the digest", () => {
  const { review_rounds: _r, ...budgets } = PAYLOAD["budgets"] as JsonRecord;
  const bare: JsonRecord = {
    requests: PAYLOAD["requests"],
    workspaces: PAYLOAD["workspaces"],
    agent_types: PAYLOAD["agent_types"],
    budgets,
  };
  expect(scopePayloadWithDefaults(bare)).toEqual(PAYLOAD);
  // Control: a present value, even a wrong one, is left for the reader to refuse.
  expect(
    scopePayloadWithDefaults({ ...PAYLOAD, severity_threshold: "p1" })["severity_threshold"],
  ).toBe("p1");
  expect(
    (scopePayloadWithDefaults(withBudgets({ review_rounds: 0 }))["budgets"] as JsonRecord)[
      "review_rounds"
    ],
  ).toBe(0);
});

test("a drafter's scope with no bases is refused, and with one it records", async () => {
  const { record } = await seeded();
  const bare = await record.recordScope(scope({ authorKind: "drafter", authorId: "rondo/model" }));
  expect(bare.kind === "refused" ? bare.reason : bare.kind).toContain("D-0066 rule 1.5");
  expect(
    await record.recordScope(
      scope({ authorKind: "drafter", authorId: "rondo/model", bases: [{ snapshot: "$.request" }] }),
    ),
  ).toEqual({ kind: "recorded" });
  // Control on the other side: an operator's scope needs none.
  expect(await record.recordScope(scope({ scopeId: "s-0002" }))).toEqual({ kind: "recorded" });
});

test("a supersedes naming no row, or the row itself, is refused", async () => {
  const { record } = await seeded();
  const dangling = await record.recordScope(scope({ supersedesScopeId: "s-none" }));
  expect(dangling.kind === "refused" ? dangling.reason : dangling.kind).toContain("no scope");
  const self = await record.recordScope(scope({ supersedesScopeId: "s-0001" }));
  expect(self.kind === "refused" ? self.reason : self.kind).toContain("names itself");
  expect(await record.recordScope(scope())).toEqual({ kind: "recorded" });
  expect(
    await record.recordScope(scope({ scopeId: "s-0002", supersedesScopeId: "s-0001" })),
  ).toEqual({
    kind: "recorded",
  });
});

test("a request that is no message, or an agent type no iteration holds, is refused", async () => {
  const { record } = await seeded();
  const request = await record.recordScope(
    scope({ payload: { ...PAYLOAD, requests: ["m-none"] } }),
  );
  expect(request.kind === "refused" ? request.reason : request.kind).toContain("'m-none'");
  const agentType = await record.recordScope(
    scope({ payload: { ...PAYLOAD, agent_types: [AGENT_TYPE, OTHER_AGENT_TYPE] } }),
  );
  expect(agentType.kind === "refused" ? agentType.reason : agentType.kind).toContain(
    OTHER_AGENT_TYPE,
  );
  // Control: the same scope over what the store does hold records.
  expect(await record.recordScope(scope())).toEqual({ kind: "recorded" });
});

const UNRUN = `sha256:${"c".repeat(64)}`;
const recorded = (agentTypeDigest = UNRUN) => ({
  agentTypeDigest,
  agentTypeInput: { agentTypeId: "worker-basic", granted: ["command.run"] },
  planDigest: `sha256:${"d".repeat(64)}`,
});
const records = (connection: DatabaseSync) =>
  count(connection, "SELECT COUNT(*) AS n FROM agent_type_record");

test("D-0069: an operator's scope records an unrun agent type from a plan, in its own transaction", async () => {
  const { connection, record } = await seeded();
  const payload = { ...PAYLOAD, agent_types: [AGENT_TYPE, UNRUN] };
  // Control: without the record, the unrun digest is no record rondo holds.
  const bare = await record.recordScope(scope({ payload }));
  expect(bare.kind === "refused" ? bare.reason : bare.kind).toContain(UNRUN);
  expect(await record.recordScope(scope({ payload, agentTypeRecords: [recorded()] }))).toEqual({
    kind: "recorded",
  });
  expect(
    connection
      .prepare(
        "SELECT agent_type_input, plan_digest, recorded_by, recorded_at_ms FROM agent_type_record",
      )
      .all(),
  ).toEqual([
    {
      agent_type_input: '{"agentTypeId":"worker-basic","granted":["command.run"]}',
      plan_digest: `sha256:${"d".repeat(64)}`,
      recorded_by: "oidc|operator-1",
      recorded_at_ms: 1_000,
    },
  ]);
  // Once held, a drafter's scope may list it, and a later record of it writes nothing.
  expect(
    await record.recordScope(
      scope({
        scopeId: "s-0002",
        payload,
        authorKind: "drafter",
        bases: [{ form: "message", messageId: "m-0001" }],
      }),
    ),
  ).toEqual({ kind: "recorded" });
  expect(
    await record.recordScope(
      scope({
        scopeId: "s-0003",
        payload,
        agentTypeRecords: [{ ...recorded(), agentTypeInput: { other: true } }],
      }),
    ),
  ).toEqual({ kind: "recorded" });
  expect(records(connection)).toBe(1);
  expect(await record.heldAgentType(UNRUN)).toEqual({
    kind: "read",
    source: "agent_type_record",
    agentTypeInput: { agentTypeId: "worker-basic", granted: ["command.run"] },
  });
  expect((await record.changedSince(1)).map((change) => change.kind)).toContain(
    "agent_type_record",
  );
});

test("D-0069: a drafter records nothing, a record its scope does not list is refused, a refusal rolls it back", async () => {
  const { connection, record } = await seeded();
  const payload = { ...PAYLOAD, agent_types: [AGENT_TYPE, UNRUN] };
  const drafted = await record.recordScope(
    scope({
      payload,
      authorKind: "drafter",
      bases: [{ form: "message", messageId: "m-0001" }],
      agentTypeRecords: [recorded()],
    }),
  );
  expect(drafted.kind === "refused" ? drafted.reason : drafted.kind).toContain("drafter's");
  const unlisted = await record.recordScope(scope({ agentTypeRecords: [recorded()] }));
  expect(unlisted.kind === "refused" ? unlisted.reason : unlisted.kind).toContain(
    "does not list it",
  );
  // Refusals that come after the record loop leave no record either: a second listed agent
  // type nobody holds, a second plan the scope does not list, and a taken scope id.
  const THIRD = `sha256:${"e".repeat(64)}`;
  const unheld = await record.recordScope(
    scope({ payload: { ...payload, agent_types: [UNRUN, THIRD] }, agentTypeRecords: [recorded()] }),
  );
  expect(unheld.kind === "refused" ? unheld.reason : unheld.kind).toContain(THIRD);
  const secondUnlisted = await record.recordScope(
    scope({ payload, agentTypeRecords: [recorded(), recorded(THIRD)] }),
  );
  expect(secondUnlisted.kind === "refused" ? secondUnlisted.reason : secondUnlisted.kind).toContain(
    "does not list it",
  );
  expect(await record.recordScope(scope({ scopeId: "s-taken" }))).toEqual({ kind: "recorded" });
  const taken = await record.recordScope(
    scope({ scopeId: "s-taken", payload, agentTypeRecords: [recorded()] }),
  );
  expect(taken.kind).toBe("refused");
  expect(records(connection)).toBe(0);
  expect(await record.heldAgentType(UNRUN)).toEqual({ kind: "absent" });
  expect(count(connection, "SELECT COUNT(*) AS n FROM scope")).toBe(1);
});

test("D-0069: a digest an iteration holds reads back from that iteration's plan", async () => {
  const { connection, record } = await seeded();
  connection
    .prepare("UPDATE iteration SET plan = ? WHERE id = 'i-held'")
    .run(JSON.stringify({ agent_type_input: { agentTypeId: "ran" } }));
  expect(await record.heldAgentType(AGENT_TYPE)).toEqual({
    kind: "read",
    source: "iteration",
    agentTypeInput: { agentTypeId: "ran" },
  });
  connection.prepare("UPDATE iteration SET plan = '{}' WHERE id = 'i-held'").run();
  expect(await record.heldAgentType(AGENT_TYPE)).toMatchObject({ kind: "unreadable" });
});

test("a request must open one: a bare message id and a reply are refused (R5)", async () => {
  const { record } = await seeded();
  await record.recordMessage("m-bare");
  await record.recordThreadMessage(message({ messageId: "m-reply", inReplyTo: "m-0001" }));
  for (const id of ["m-bare", "m-reply"]) {
    const refused = await record.recordScope(scope({ payload: { ...PAYLOAD, requests: [id] } }));
    expect(refused.kind === "refused" ? refused.reason : refused.kind).toContain(
      "does not open a request",
    );
  }
  // Control: a request root records.
  await record.recordThreadMessage(message({ messageId: "m-root-2" }));
  expect(
    await record.recordScope(scope({ payload: { ...PAYLOAD, requests: ["m-0001", "m-root-2"] } })),
  ).toEqual({ kind: "recorded" });
});

test("a second scope under one id is refused, not overwritten", async () => {
  const { record } = await seeded();
  expect(await record.recordScope(scope())).toEqual({ kind: "recorded" });
  const again = await record.recordScope(scope({ authorId: "oidc|operator-2" }));
  expect(again.kind === "refused" ? again.reason : again.kind).toContain("already exists");
});

// --- recordScopeDecision ----------------------------------------------------

test("a decision naming a digest that is not the row's, or no scope, is refused", async () => {
  const { record } = await seeded();
  await record.recordScope(scope());
  const moved = await record.recordScopeDecision(scopeDecision({ scopeDigest: "sha256:other" }));
  expect(moved.kind === "refused" ? moved.reason : moved.kind).toContain("D-0066 rule 2.2");
  const missing = await record.recordScopeDecision(scopeDecision({ scopeId: "s-none" }));
  expect(missing.kind === "refused" ? missing.reason : missing.kind).toContain("'s-none'");
  expect(await record.recordScopeDecision(scopeDecision())).toEqual({ kind: "recorded" });
});

test("one decision per scope row: a second is refused, and a decline is recorded", async () => {
  const { record } = await seeded();
  await record.recordScope(scope());
  // Control for `scopeDecisionOf`: absent before anybody answers.
  expect(await record.scopeDecisionOf("s-0001")).toEqual({ kind: "absent" });
  expect(await record.recordScopeDecision(scopeDecision({ outcome: "declined" }))).toEqual({
    kind: "recorded",
  });
  const second = await record.recordScopeDecision(scopeDecision({ scopeDecisionId: "sd-0002" }));
  expect(second.kind === "refused" ? second.reason : second.kind).toContain("D-0066 rule 2.3");
  const read = await record.readScopeDecision("sd-0001");
  expect(read.kind === "read" ? read.decision.outcome : read.kind).toBe("declined");
  const byScope = await record.scopeDecisionOf("s-0001");
  expect(byScope.kind === "read" ? byScope.decision.scopeDecisionId : byScope.kind).toBe("sd-0001");
});

test("a split proposal cannot be answered by a human decision (D-0066 rule 5.1)", async () => {
  const { record } = await seeded();
  const proposal = {
    proposalId: "p-split",
    drafter: "rondo/model",
    payload: { plans: [], holes: ["which repository"] },
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
    createdAtMs: 1_000,
  } as const;
  const decision = {
    proposalId: "p-split",
    outcome: "declined",
    approved: null,
    predecessor: null,
    actorId: "oidc|operator-1",
    recordedBy: "rondo/cli",
    gateId: null,
    gateTransitionSeq: null,
    decidedAtMs: 2_000,
  } as const;
  // The sqlite branch below refuses a split before it asks the kind list, so the
  // list itself is pinned here: inbox, web and advisory read only the list
  // (D-0066 5.1).
  expect(isApprovableKind("split")).toBe(false);
  expect(isApprovableKind("run_plan")).toBe(true);
  await record.recordProposal({ ...proposal, kind: "split" });
  const refused = await record.recordDecision({ ...decision, decisionId: "d-split" });
  expect(refused.kind === "refused" ? refused.reason : refused.kind).toContain(
    "never approved per split",
  );
  // Control: the same answer to an approvable kind records.
  await record.recordProposal({ ...proposal, proposalId: "p-run", kind: "run_plan" });
  expect(
    await record.recordDecision({ ...decision, decisionId: "d-run", proposalId: "p-run" }),
  ).toEqual({ kind: "recorded" });
});

// --- Readers ----------------------------------------------------------------

test("an approved grandchild retires a scope; drafted and declined successors do not", async () => {
  const { record } = await seeded();
  await record.recordScope(scope());
  await record.recordScope(scope({ scopeId: "s-child", supersedesScopeId: "s-0001" }));
  expect(await record.scopeSupersededByApproved("s-0001")).toBe(false);
  await record.recordScopeDecision(
    scopeDecision({ scopeDecisionId: "sd-child", scopeId: "s-child", outcome: "declined" }),
  );
  expect(await record.scopeSupersededByApproved("s-0001")).toBe(false);
  await record.recordScope(scope({ scopeId: "s-grandchild", supersedesScopeId: "s-child" }));
  expect(await record.scopeSupersededByApproved("s-0001")).toBe(false);
  await record.recordScopeDecision(
    scopeDecision({ scopeDecisionId: "sd-grandchild", scopeId: "s-grandchild" }),
  );
  expect(await record.scopeSupersededByApproved("s-0001")).toBe(true);
  expect(await record.scopeSupersededByApproved("s-child")).toBe(true);
  expect(await record.scopeSupersededByApproved("s-grandchild")).toBe(false);
});

test("a lap's approval walks to the approved tip of its chain, and a chain with two tips has none (D-0074 rule 2.1)", async () => {
  const { connection, record } = await approved();
  // Nothing below it: the approval is its own tip.
  expect(await record.scopeTip("sd-0001")).toEqual({ kind: "tip", scopeDecisionId: "sd-0001" });
  expect(await record.scopeTip("sd-none")).toEqual({ kind: "absent" });
  // A drafted successor moves nothing; approved, it is the tip.
  await record.recordScope(scope({ scopeId: "s-raise", supersedesScopeId: "s-0001" }));
  expect(await record.scopeTip("sd-0001")).toEqual({ kind: "tip", scopeDecisionId: "sd-0001" });
  await record.recordScopeDecision(
    scopeDecision({ scopeDecisionId: "sd-raise", scopeId: "s-raise" }),
  );
  expect(await record.scopeTip("sd-0001")).toEqual({ kind: "tip", scopeDecisionId: "sd-raise" });
  // Through a declined link to an approved grandchild: the grandchild.
  await record.recordScope(scope({ scopeId: "s-no", supersedesScopeId: "s-raise" }));
  await record.recordScopeDecision(
    scopeDecision({ scopeDecisionId: "sd-no", scopeId: "s-no", outcome: "declined" }),
  );
  await record.recordScope(scope({ scopeId: "s-again", supersedesScopeId: "s-no" }));
  await record.recordScopeDecision(
    scopeDecision({ scopeDecisionId: "sd-again", scopeId: "s-again" }),
  );
  expect(await record.scopeTip("sd-0001")).toEqual({ kind: "tip", scopeDecisionId: "sd-again" });
  expect(await record.scopeTip("sd-raise")).toEqual({ kind: "tip", scopeDecisionId: "sd-again" });
  // Two approved tips, written past the writer as a store from before D-0074
  // could hold them: no tip, and both named.
  connection
    .prepare(
      "INSERT INTO scope (scope_id, payload, scope_digest, supersedes_scope_id, author_kind, " +
        "author_id, bases, created_at_ms) SELECT 's-fork', payload, scope_digest, 's-0001', " +
        "author_kind, author_id, bases, created_at_ms FROM scope WHERE scope_id = 's-0001'",
    )
    .run();
  connection
    .prepare(
      "INSERT INTO scope_decision (scope_decision_id, scope_id, scope_digest, outcome, actor_id, " +
        "recorded_by, decided_at_ms) SELECT 'sd-fork', 's-fork', scope_digest, 'approved', " +
        "actor_id, recorded_by, decided_at_ms FROM scope_decision WHERE scope_decision_id = 'sd-0001'",
    )
    .run();
  const forked = await record.scopeTip("sd-0001");
  expect(forked.kind).toBe("forked");
  expect(forked.kind === "forked" ? [...forked.scopeDecisionIds].sort() : []).toEqual([
    "sd-again",
    "sd-fork",
  ]);
  // Each branch on its own still has one tip.
  expect(await record.scopeTip("sd-fork")).toEqual({ kind: "tip", scopeDecisionId: "sd-fork" });
});

test("one approved line per chain: a second branch of an approved scope is refused, at any depth (D-0074 rule 1.3)", async () => {
  const { record } = await approved();
  const approve = (scopeId: string) =>
    record.recordScopeDecision(scopeDecision({ scopeDecisionId: `sd-${scopeId}`, scopeId }));
  // The control: raising, then raising the raise, records.
  await record.recordScope(scope({ scopeId: "s-a", supersedesScopeId: "s-0001" }));
  expect(await approve("s-a")).toEqual({ kind: "recorded" });
  await record.recordScope(scope({ scopeId: "s-a2", supersedesScopeId: "s-a" }));
  expect(await approve("s-a2")).toEqual({ kind: "recorded" });
  // A stale raise of the first approval: its line was already replaced.
  await record.recordScope(scope({ scopeId: "s-b", supersedesScopeId: "s-0001" }));
  const stale = await approve("s-b");
  expect(stale.kind).toBe("refused");
  expect(stale.kind === "refused" ? stale.reason : "").toMatch(/'s-a2?'/);
  // Two drafted branches under one approved scope: the one below a drafted
  // link is refused too, because the approved scope above it already has an
  // approved descendant.
  await record.recordScope(scope({ scopeId: "s-draft", supersedesScopeId: "s-a" }));
  await record.recordScope(scope({ scopeId: "s-c", supersedesScopeId: "s-draft" }));
  expect((await approve("s-c")).kind).toBe("refused");
  // A decline is not an approval and forks nothing.
  expect(
    await record.recordScopeDecision(
      scopeDecision({ scopeDecisionId: "sd-no", scopeId: "s-c", outcome: "declined" }),
    ),
  ).toEqual({ kind: "recorded" });
  // Approving a scope whose own successor is already approved is no second line.
  await record.recordScope(scope({ scopeId: "s-mid", supersedesScopeId: "s-a2" }));
  await record.recordScope(scope({ scopeId: "s-low", supersedesScopeId: "s-mid" }));
  expect(await approve("s-low")).toEqual({ kind: "recorded" });
  expect(await approve("s-mid")).toEqual({ kind: "recorded" });
  expect(await record.scopeTip("sd-0001")).toEqual({ kind: "tip", scopeDecisionId: "sd-s-low" });
});

test("spent is counted from rows: empty, an unread lap, then its read cost", async () => {
  const { connection, record } = await approved();
  expect(await record.scopeSpent("sd-0001")).toEqual({
    admissions: 0,
    readCostUsd: 0,
    unreadLaps: 0,
  });
  admitted(connection, "i-a", null);
  expect(await record.scopeSpent("sd-0001")).toEqual({
    admissions: 1,
    readCostUsd: 0,
    unreadLaps: 1,
  });
  connection.prepare("UPDATE iteration SET lap_cost_usd = 1.25 WHERE id = 'i-a'").run();
  expect(await record.scopeSpent("sd-0001")).toEqual({
    admissions: 1,
    readCostUsd: 1.25,
    unreadLaps: 0,
  });
});

test("spent is per approval and per admission: another decision's or another kind's rows do not count", async () => {
  const { connection, record } = await approved();
  admitted(connection, "i-mine", 2);
  // Rule 3.4 counts from rows *under this approval*: a second approval's laps
  // and cost (read or unread) are its own budget, and a row that is not an
  // admission is not a lap. The schema has no CHECK on act_kind, so a raw row
  // of another kind stands in for a future act.
  admitted(connection, "i-other-read", 5, "sd-0002");
  admitted(connection, "i-other-unread", null, "sd-0002");
  admitted(connection, "i-not-a-lap", 7, "sd-0001", "split");
  expect(await record.scopeSpent("sd-0001")).toEqual({
    admissions: 1,
    readCostUsd: 2,
    unreadLaps: 0,
  });
  expect(await record.scopeSpent("sd-0002")).toEqual({
    admissions: 2,
    readCostUsd: 5,
    unreadLaps: 1,
  });
});

test("the approval a lap was admitted under is read back off its admission row (rondo#233 S4)", async () => {
  const { connection, record } = await approved();
  // Nothing yet: a lap admitted under no approval has no row to read, and the
  // page offers no in-scope revise on one.
  expect(await record.scopeDecisionAdmitting("i-a")).toBe(null);
  admitted(connection, "i-a", null);
  expect(await record.scopeDecisionAdmitting("i-a")).toBe("sd-0001");
  // Per subject and per kind: another lap's row, and a row of a kind that is
  // not an admission, say nothing about this lap.
  expect(await record.scopeDecisionAdmitting("i-b")).toBe(null);
  admitted(connection, "i-c", null, "sd-0001", "push_branch");
  expect(await record.scopeDecisionAdmitting("i-c")).toBe(null);
  // **Two approvals claiming one admission is not a choice this reader makes.**
  // `reserve()` writes one row per lap, so a second is a store that cannot
  // happen -- and the honest answer to "which scope is this under" is then
  // none, not whichever the database listed first.
  connection
    .prepare(
      "INSERT INTO scope_consumption (scope_decision_id, act_kind, subject_id, proposal_id, " +
        "consumed_at_ms) VALUES ('sd-0002', 'admission', 'i-a', NULL, 1)",
    )
    .run();
  expect(await record.scopeDecisionAdmitting("i-a")).toBe(null);
});

// --- The spend inside reserve() (D-0066 rule 4.3) ---------------------------

const refusalOf = async (
  store: Awaited<ReturnType<typeof seeded>>["store"],
  input: ReserveInput,
): Promise<string> => {
  const outcome = await store.reserve(input);
  expect(outcome.kind).toBe("scopeRefused");
  return outcome.kind === "scopeRefused"
    ? `${outcome.verdict} ${outcome.test}: ${outcome.reason}`
    : "";
};

const reserves = async (
  store: Awaited<ReturnType<typeof seeded>>["store"],
  input: ReserveInput,
): Promise<void> => {
  expect((await store.reserve(input)).kind).toBe("reserved");
};

test("a spend that passes every store test writes one consumption row beside its iteration", async () => {
  const { connection, store } = await approved();
  await reserves(store, reserveInput("i-new", spendOf({ proposalId: "p-split" })));
  expect(connection.prepare("SELECT * FROM scope_consumption").all()).toEqual([
    {
      scope_decision_id: "sd-0001",
      act_kind: "admission",
      subject_id: "i-new",
      proposal_id: "p-split",
      consumed_at_ms: 5_000,
    },
  ]);
  expect(count(connection, "SELECT COUNT(*) AS n FROM iteration WHERE id = 'i-new'")).toBe(1);
});

test("both or neither: an iteration insert that fails after the consumption rolls both back", async () => {
  const { connection, store } = await approved();
  // `i-held` is already a row: the consumption lands, then the iteration's
  // primary key refuses, and the transaction takes the consumption with it.
  const collided = await store.reserve(reserveInput("i-held", spendOf()));
  expect(collided.kind).toBe("defect");
  expect(count(connection, "SELECT COUNT(*) AS n FROM scope_consumption")).toBe(0);
  // Control: the same admission under a fresh identity writes both.
  await reserves(store, reserveInput("i-new", spendOf()));
  expect(count(connection, "SELECT COUNT(*) AS n FROM scope_consumption")).toBe(1);
});

test("the last lap: of two admissions under laps 1 the second is refused and writes nothing", async () => {
  const { connection, store } = await approved(withBudgets({ laps: 1 }));
  await reserves(store, reserveInput("i-first", spendOf()));
  expect(await refusalOf(store, reserveInput("i-second", spendOf()))).toContain("1 of 1 laps");
  expect(count(connection, "SELECT COUNT(*) AS n FROM iteration WHERE id = 'i-second'")).toBe(0);
  expect(count(connection, "SELECT COUNT(*) AS n FROM scope_consumption")).toBe(1);
});

test("1. a missing or declined decision is refused", async () => {
  const { store } = await approved();
  expect(
    await refusalOf(store, reserveInput("i-new", spendOf({ scopeDecisionId: "sd-none" }))),
  ).toContain("no scope decision 'sd-none'");
  const declined = await seeded();
  await declined.record.recordScope(scope());
  await declined.record.recordScopeDecision(scopeDecision({ outcome: "declined" }));
  expect(await refusalOf(declined.store, reserveInput("i-new", spendOf()))).toContain("declined");
});

test("2. a scope whose digest is not the decision's is refused", async () => {
  const { connection, store } = await approved();
  connection.prepare("UPDATE scope_decision SET scope_digest = 'sha256:other'").run();
  expect(await refusalOf(store, reserveInput("i-new", spendOf()))).toContain("approved digest");
});

test("3. a scope with an approved successor is refused; a drafted one is not", async () => {
  const { record, store } = await approved();
  await record.recordScope(scope({ scopeId: "s-next", supersedesScopeId: "s-0001" }));
  await reserves(store, reserveInput("i-a", spendOf()));
  await record.recordScopeDecision(
    scopeDecision({ scopeDecisionId: "sd-next", scopeId: "s-next" }),
  );
  expect(await refusalOf(store, reserveInput("i-b", spendOf()))).toContain("approved successor");
});

test("6. a plan whose pair is not listed, byte for byte, is refused", async () => {
  const { store } = await approved();
  const plan = { run_id: "r", repository: REPOSITORY, workspace_root: `${WORKSPACE_ROOT}/` };
  expect(await refusalOf(store, reserveInput("i-new", spendOf(), { plan }))).toContain(
    "are not a pair",
  );
});

test("7. an agent type the scope does not list is refused", async () => {
  const { store } = await approved();
  expect(
    await refusalOf(store, reserveInput("i-new", spendOf({ agentTypeDigest: OTHER_AGENT_TYPE }))),
  ).toContain("is not one scope");
});

test("8. expiry: the instant itself has expired, the millisecond before has not", async () => {
  const { store } = await approved();
  expect(await refusalOf(store, reserveInput("i-new", spendOf(), { nowMs: 10_000 }))).toContain(
    "expired",
  );
  await reserves(store, reserveInput("i-new", spendOf(), { nowMs: 9_999 }));
});

test("9. laps: a spent budget is refused, and laps 0 refuses the first", async () => {
  const zero = await approved(withBudgets({ laps: 0 }));
  expect(await refusalOf(zero.store, reserveInput("i-new", spendOf()))).toContain("0 of 0 laps");
  const { connection, store } = await approved(withBudgets({ laps: 2, cost_usd: 100 }));
  admitted(connection, "i-a", 1);
  await reserves(store, reserveInput("i-b", spendOf()));
  expect(await refusalOf(store, reserveInput("i-c", spendOf()))).toContain("2 of 2 laps");
});

test("10. cost across real admissions: an unread lap holds its reserve, a read cost replaces it, equality is inside", async () => {
  // Budget 10, reserve 2. Read 5 plus one unread lap plus this one: 5 + 2*2 = 9.
  const { connection, store } = await approved(withBudgets({ laps: 10 }));
  admitted(connection, "i-read", 5);
  admitted(connection, "i-unread", null);
  await reserves(store, reserveInput("i-b", spendOf()));
  // `i-b` is admitted and unread, and holds its reserve too: 5 + 3*2 = 11 > 10.
  expect(await refusalOf(store, reserveInput("i-c", spendOf()))).toContain("would commit 11 USD");
  // Its cost is read at 1: 6 + 2*2 = 10, exactly the budget, which is inside.
  connection.prepare("UPDATE iteration SET lap_cost_usd = 1 WHERE id = 'i-b'").run();
  await reserves(store, reserveInput("i-c", spendOf()));
});

test("4. the request is the row's own link, and the scope must list it", async () => {
  const { record, store } = await approved();
  // The fixture's own request opens one, so it is a request the scope does
  // not list rather than no request at all: since D-0083 there is no such
  // thing as a lap that names none.
  expect(
    await refusalOf(store, reserveInput("i-new", spendOf(), { requestMessageId: REQUEST })),
  ).toContain(`'${REQUEST}' is not one scope`);
  await record.recordThreadMessage(message({ messageId: "m-0002" }));
  expect(
    await refusalOf(store, reserveInput("i-new", spendOf(), { requestMessageId: "m-0002" })),
  ).toContain("'m-0002' is not one scope");
  // A reply is refused earlier, by the request link's own test, and spends nothing.
  await record.recordThreadMessage(message({ messageId: "m-reply", inReplyTo: "m-0001" }));
  expect(
    (await store.reserve(reserveInput("i-new", spendOf(), { requestMessageId: "m-reply" }))).kind,
  ).toBe("requestRefused");
  await reserves(store, reserveInput("i-new", spendOf()));
});

// --- 5. Open asks, under the write lock (D-0066 rules 4.2-4.4) ------------

/** An approved scope with room for many laps, and a redo of `i-held` beside a lineage start. */
const askable = async () => {
  const seed = await approved(withBudgets({ laps: 50, cost_usd: 1_000 }));
  let n = 0;
  const redo = () =>
    reserveInput(`i-redo-${String(++n)}`, spendOf(), { supersedesIterationId: "i-held" });
  // A split's first admission (D-0066 rule 4.4 as written); `unproposed` is an
  // operator's plan under `start`, which names no proposal (D-0069 rule 5).
  const start = () => reserveInput(`i-start-${String(++n)}`, spendOf({ proposalId: "p-split" }));
  const unproposed = () => reserveInput(`i-plan-${String(++n)}`, spendOf());
  return { ...seed, redo, start, unproposed };
};

test("5. an ask over the lineage refuses a redo, at any depth, and not a split's lineage start", async () => {
  const { connection, record, store, redo, start } = await askable();
  expect(
    await record.recordThreadMessage(ask("m-ask", [{ form: "iteration", iterationId: "i-held" }])),
  ).toEqual({ kind: "recorded" });
  expect(await refusalOf(store, redo())).toContain("'m-ask'");
  await reserves(store, start());
  // A grandparent: `i-held` now continues `i-root`, and an ask over `i-root` stands over it too.
  admitted(connection, "i-root", null, "sd-other");
  connection
    .prepare("UPDATE iteration SET supersedes_iteration_id = 'i-root' WHERE id = 'i-held'")
    .run();
  // The held line holds a claim of its own, so its redo continues it rather
  // than asking a line from before the ledger's whole repository (D-0073 rule
  // 2.5): the lane ledger is not what this test probes.
  connection
    .prepare(
      "INSERT INTO lane_claim (claim_id, lineage_id, repository, paths, supersedes_claim_id, " +
        "author_kind, author_id, bases, created_at_ms) " +
        "VALUES ('i-root:1', 'i-root', ?, '[\"lanes/i-held/\"]', NULL, 'drafter', 'test', '[]', 1)",
    )
    .run(REPOSITORY);
  await record.recordThreadMessage(answer("m-ans", "m-ask"));
  await reserves(store, redo());
  await record.recordThreadMessage(
    ask("m-ask-root", [{ form: "iteration", iterationId: "i-root" }]),
  );
  expect(await refusalOf(store, redo())).toContain("'m-ask-root'");
  expect(await record.openAsksIn("m-0001")).toEqual({
    kind: "read",
    asks: [{ messageId: "m-ask-root", iterationIds: ["i-root"], answeredStop: false }],
  });
});

test("D-0072: only an answer that carries on releases the line; 'stop' and a bare reply hold it", async () => {
  // #206 and lap 8's N-31: before this, any reply at all released the hold, so
  // "stop this line" released it as surely as "go on" and no row could tell the
  // two apart. The line now opens on the absence of a `carry_on`.
  const { record, store, start } = await askable();
  await record.recordThreadMessage(ask("m-ask", []));

  // A bare reply -- what the page's `Reply` writes -- answers nothing.
  await record.recordThreadMessage(message({ messageId: "m-chat", inReplyTo: "m-ask" }));
  expect(await refusalOf(store, start())).toContain("nobody has answered");
  // The person's own words, said to be a stop: the hold stays, and the row says why.
  await record.recordThreadMessage(answer("m-stopped", "m-ask", "stop"));
  const refusal = await refusalOf(store, start());
  expect(refusal).toContain("'m-ask'");
  expect(refusal).toContain("answered by stopping this line");
  expect(await record.openAsksIn("m-0001")).toEqual({
    kind: "read",
    asks: [{ messageId: "m-ask", iterationIds: [], answeredStop: true }],
  });
  // Changing their mind is a second answer, and it is the one that carries on.
  await record.recordThreadMessage(answer("m-go", "m-ask"));
  await reserves(store, start());
  expect(await record.openAsksIn("m-0001")).toEqual({ kind: "read", asks: [] });
});

test("D-0072: no message rondo writes releases a hold rondo put on the line", async () => {
  // D-0066 rule 4.4's "the person's reply", read literally. A drafter's report
  // threaded under a stop used to end it, because the old query counted rows
  // and not voices.
  const { record, store, start } = await askable();
  await record.recordThreadMessage(ask("m-ask", []));
  expect(
    await record.recordThreadMessage(
      ask("m-report", [{ form: "iteration", iterationId: "i-held" }], "m-ask"),
    ),
  ).toEqual({ kind: "recorded" });
  expect(await refusalOf(store, start())).toContain("'m-ask'");
  // And a drafter cannot write the answer itself, whatever it replies to.
  const refused = await record.recordThreadMessage({
    ...ask("m-self-answer", [], "m-ask"),
    answerOutcome: "carry_on",
  });
  expect(refused).toMatchObject({ kind: "refused" });
  expect(refused.kind === "refused" && refused.reason).toContain("never rondo's own");
  expect(await refusalOf(store, start())).toContain("'m-ask'");
});

test("5. an ask naming no lap holds back a lineage start, and lineages running carry on", async () => {
  const { connection, record, store, redo, start } = await askable();
  await record.recordThreadMessage(ask("m-ask", []));
  expect(await refusalOf(store, start())).toContain("'m-ask'");
  await reserves(store, redo());
  expect(count(connection, "SELECT COUNT(*) AS n FROM iteration WHERE id LIKE 'i-start-%'")).toBe(
    0,
  );
});

test("5. controls: an answered ask, one in another request's thread, one on another lineage", async () => {
  const { record, store, redo, start } = await askable();
  // Answered: a reply to the ask ends it.
  await record.recordThreadMessage(ask("m-ask", []));
  expect(await refusalOf(store, start())).toContain("'m-ask'");
  await record.recordThreadMessage(answer("m-ans", "m-ask"));
  await reserves(store, start());
  // Another request's thread: its question does not stand over this request's acts.
  await record.recordThreadMessage(message({ messageId: "m-0002" }));
  await record.recordThreadMessage(ask("m-ask-2", [], "m-0002"));
  await reserves(store, start());
  // Another lineage: an iteration basis not on this chain.
  await record.recordThreadMessage(
    ask("m-ask-3", [{ form: "iteration", iterationId: "i-elsewhere" }]),
  );
  await reserves(store, redo());
  // The ask deep in a reply chain is still in the thread.
  await record.recordThreadMessage(ask("m-ask-4", [], "m-ans"));
  expect(await refusalOf(store, start())).toContain("'m-ask-4'");
});

test("PLANTED 5 (D-0069 rule 5): every open ask holds back a start naming no proposal, whatever its bases", async () => {
  const { connection, record, store, start, unproposed } = await askable();
  // A stop over another lineage: a split's start carries on, an operator's plan is held.
  await record.recordThreadMessage(ask("m-stop", [{ form: "iteration", iterationId: "i-held" }]));
  expect(await refusalOf(store, unproposed())).toContain("'m-stop'");
  expect(count(connection, "SELECT COUNT(*) AS n FROM iteration WHERE id LIKE 'i-plan-%'")).toBe(0);
  await reserves(store, start());
  // Answered, it holds nothing; a question in another request's thread holds nothing either.
  await record.recordThreadMessage(answer("m-ans", "m-stop"));
  await record.recordThreadMessage(message({ messageId: "m-0002" }));
  await record.recordThreadMessage(
    ask("m-ask-2", [{ form: "iteration", iterationId: "i-held" }], "m-0002"),
  );
  await reserves(store, unproposed());
  expect(
    count(connection, "SELECT COUNT(*) AS n FROM scope_consumption WHERE proposal_id IS NULL"),
  ).toBe(1);
});

test("5. an ask over a lap stands over its whole lineage, so a branch from an earlier lap is refused", async () => {
  const { connection, record, store } = await askable();
  const redoOf = (id: string, predecessor: string) =>
    reserveInput(id, spendOf(), { supersedesIterationId: predecessor });
  await reserves(store, redoOf("i-p", "i-held"));
  // The line is stopped over its latest lap, `i-p`.
  await record.recordThreadMessage(ask("m-stop", [{ form: "iteration", iterationId: "i-p" }]));
  expect(await refusalOf(store, redoOf("i-s1", "i-p"))).toContain("'m-stop'");
  // Redoing the earlier lap shares `i-p`'s root, so the same stop holds it.
  expect(await refusalOf(store, redoOf("i-s2", "i-held"))).toContain("'m-stop'");
  expect(count(connection, "SELECT COUNT(*) AS n FROM iteration WHERE id = 'i-s2'")).toBe(0);
  expect(count(connection, "SELECT COUNT(*) AS n FROM scope_consumption")).toBe(1);
  expect(await record.lineageOf("i-held")).toEqual(["i-held", "i-p"]);
  expect(await record.lineageOf("i-p")).toEqual(["i-held", "i-p"]);
  // Control: once answered, the branch from the earlier lap is admitted.
  await record.recordThreadMessage(answer("m-ans", "m-stop"));
  await reserves(store, redoOf("i-s2", "i-held"));
  expect(await record.lineageOf("i-p")).toEqual(["i-held", "i-p", "i-s2"]);
});

test("the re-tests run in rule 4.3's order: the earliest failing one is the reason", async () => {
  // Expired, over laps and naming an unlisted agent type at once: test 5 answers.
  const { store } = await approved(withBudgets({ laps: 0 }));
  expect(
    await refusalOf(
      store,
      reserveInput("i-new", spendOf({ agentTypeDigest: OTHER_AGENT_TYPE }), { nowMs: 20_000 }),
    ),
  ).toContain("is not one scope");
  // Control: with the agent type fixed, expiry (test 8) answers before laps (test 9).
  expect(await refusalOf(store, reserveInput("i-new", spendOf(), { nowMs: 20_000 }))).toContain(
    "expired",
  );
});

test("an open ask over the line answers before a spent budget, so a stop is not written twice", async () => {
  const { store, record } = await approved(withBudgets({ laps: 0 }));
  expect(await refusalOf(store, reserveInput("i-new", spendOf()))).toContain("outside laps");
  await record.recordThreadMessage(ask("m-stop", []));
  expect(await refusalOf(store, reserveInput("i-new", spendOf()))).toContain("outside asks");
});

test("PLANTED (rondo#197): a scope:ID basis is recorded when it names a scope row, and refused when it names none", async () => {
  const { connection, record } = await seeded();
  expect(await record.recordScope(scope())).toEqual({ kind: "recorded" });
  expect(
    await record.recordThreadMessage(ask("m-stop", [{ form: "scope", scopeId: "s-0001" }])),
  ).toEqual({ kind: "recorded" });
  const missing = await record.recordThreadMessage(
    ask("m-nowhere", [{ form: "scope", scopeId: "s-never" }]),
  );
  expect(missing.kind === "refused" && missing.reason).toContain("scope:s-never");
  const incomplete = await record.recordThreadMessage(ask("m-bare", [{ form: "scope" }]));
  expect(incomplete.kind === "refused" && incomplete.reason).toContain("not a complete locator");
  // Two written here; the third is the fixture's own request (D-0083).
  expect(
    count(
      connection,
      `SELECT COUNT(*) AS n FROM conversation_message WHERE message_id != '${REQUEST}'`,
    ),
  ).toBe(2);
});

test("spending a human decision and a scope at once is a defect that writes nothing", async () => {
  const { connection, store } = await approved();
  const both = await store.reserve(
    reserveInput("i-new", spendOf(), {
      spend: { decisionId: "d-0001", contractDigest: `sha256:${"e".repeat(64)}` },
    }),
  );
  expect(both.kind).toBe("defect");
  expect(both.kind === "defect" ? both.reason : "").toContain("one approval");
  expect(count(connection, "SELECT COUNT(*) AS n FROM iteration WHERE id = 'i-new'")).toBe(0);
  expect(count(connection, "SELECT COUNT(*) AS n FROM decision_consumption")).toBe(0);
});

test("the three tables are changes the operator is shown", async () => {
  const { connection, record } = await approved();
  admitted(connection, "i-a", null);
  const kinds = (await record.changedSince(1)).map((change) => change.kind);
  expect(kinds).toEqual(expect.arrayContaining(["scope", "scope_decision", "scope_consumption"]));
});
