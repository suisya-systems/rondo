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
 * the control is sharper, because nothing admits under a scope on this tree:
 * the store refuses every scoped spend as its last test while the request
 * thread (D-0061 rules 2 and 4) is not built (residual R1). So a spend that
 * passes tests 1-8 is observed reaching *that* refusal, and a flipped input is
 * observed stopping at an earlier one -- which is how each earlier test is
 * seen to be wired, in D-0066 rule 4.3's order.
 */
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import type { HostPolicy } from "../../src/refrain/policy.js";
import { contentDigest } from "../../src/store/plan.js";
import {
  isApprovableKind,
  type JsonRecord,
  type ScopeDecisionDraft,
  type ScopeDraft,
  scopePayloadWithDefaults,
} from "../../src/store/records.js";
import {
  advisoryRecord,
  iterationStore,
  type ReserveInput,
  type ScopeSpend,
} from "../../src/store/sqlite.js";

/** Bounds high enough that capacity never answers before the scope does. */
const ROOMY: HostPolicy = { maxOccupying: 100, maxLive: 100 };

const AGENT_TYPE = `sha256:${"a".repeat(64)}`;
const OTHER_AGENT_TYPE = `sha256:${"b".repeat(64)}`;
const REPOSITORY = "/srv/repo";
const WORKSPACE_ROOT = "/srv/work";
const R1 = "the request thread (D-0061 rules 2 and 4) is not built";

const PAYLOAD: JsonRecord = {
  requests: ["m-0001"],
  workspaces: [{ repository: REPOSITORY, workspace_root: WORKSPACE_ROOT }],
  agent_types: [AGENT_TYPE],
  budgets: { laps: 3, review_rounds: 3, cost_usd: 10, cost_reserve_usd: 2, expires_at_ms: 10_000 },
  severity_threshold: "major",
  outward_acts: [],
  irreversible_additions: [],
};

/**
 * A store holding what a scope may name: the request message, and an iteration
 * row carrying the agent type (D-0062 rule 1.2's "a record rondo already holds").
 */
const seeded = async (policy: HostPolicy = ROOMY) => {
  const connection = new DatabaseSync(":memory:");
  const store = iterationStore(connection, policy);
  const record = advisoryRecord(connection);
  await record.recordMessage("m-0001");
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
  requestMessageId: "m-0001",
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
    requestMessageId: null,
    spend: null,
    scopeSpend,
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

// --- The spend inside reserve() (D-0066 rule 4.3) ---------------------------

const refusalOf = async (
  store: Awaited<ReturnType<typeof seeded>>["store"],
  input: ReserveInput,
): Promise<string> => {
  const outcome = await store.reserve(input);
  expect(outcome.kind).toBe("unapproved");
  return outcome.kind === "unapproved" ? outcome.reason : "";
};

test("a spend that passes every store test stops at R1, and writes nothing", async () => {
  const { connection, store } = await approved();
  expect(await refusalOf(store, reserveInput("i-new", spendOf()))).toContain(R1);
  expect(count(connection, "SELECT COUNT(*) AS n FROM iteration WHERE id = 'i-new'")).toBe(0);
  expect(count(connection, "SELECT COUNT(*) AS n FROM scope_consumption")).toBe(0);
  // Control: the same admission with no scope reserves.
  expect((await store.reserve(reserveInput("i-new", null))).kind).toBe("reserved");
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
  expect(await refusalOf(store, reserveInput("i-new", spendOf()))).toContain(R1);
  await record.recordScopeDecision(
    scopeDecision({ scopeDecisionId: "sd-next", scopeId: "s-next" }),
  );
  expect(await refusalOf(store, reserveInput("i-new", spendOf()))).toContain("approved successor");
});

test("4. a plan whose pair is not listed, byte for byte, is refused", async () => {
  const { store } = await approved();
  const plan = { run_id: "r", repository: REPOSITORY, workspace_root: `${WORKSPACE_ROOT}/` };
  expect(await refusalOf(store, reserveInput("i-new", spendOf(), { plan }))).toContain(
    "are not a pair",
  );
});

test("5. an agent type the scope does not list is refused", async () => {
  const { store } = await approved();
  expect(
    await refusalOf(store, reserveInput("i-new", spendOf({ agentTypeDigest: OTHER_AGENT_TYPE }))),
  ).toContain("is not one scope");
});

test("6. expiry: the instant itself has expired, the millisecond before has not", async () => {
  const { store } = await approved();
  expect(await refusalOf(store, reserveInput("i-new", spendOf(), { nowMs: 10_000 }))).toContain(
    "expired",
  );
  expect(await refusalOf(store, reserveInput("i-new", spendOf(), { nowMs: 9_999 }))).toContain(R1);
});

test("7. laps: a spent budget is refused, and laps 0 refuses the first", async () => {
  const zero = await approved(withBudgets({ laps: 0 }));
  expect(await refusalOf(zero.store, reserveInput("i-new", spendOf()))).toContain("0 of 0 laps");
  const { connection, store } = await approved(withBudgets({ laps: 2, cost_usd: 100 }));
  admitted(connection, "i-a", 1);
  expect(await refusalOf(store, reserveInput("i-new", spendOf()))).toContain(R1);
  admitted(connection, "i-b", 1);
  expect(await refusalOf(store, reserveInput("i-new", spendOf()))).toContain("2 of 2 laps");
});

test("8. cost: an unread lap holds its reserve, a read cost replaces it, equality is inside", async () => {
  // Budget 10, reserve 2. Read 5 plus one unread lap plus this one: 5 + 2*2 = 9.
  const { connection, store } = await approved(withBudgets({ laps: 10 }));
  admitted(connection, "i-read", 5);
  admitted(connection, "i-unread", null);
  expect(await refusalOf(store, reserveInput("i-new", spendOf()))).toContain(R1);
  // A second unread lap: 5 + 3*2 = 11 > 10.
  admitted(connection, "i-unread-2", null);
  expect(await refusalOf(store, reserveInput("i-new", spendOf()))).toContain("would commit 11 USD");
  // Its cost is read at 1: 6 + 2*2 = 10, exactly the budget, which is inside.
  connection.prepare("UPDATE iteration SET lap_cost_usd = 1 WHERE id = 'i-unread-2'").run();
  expect(await refusalOf(store, reserveInput("i-new", spendOf()))).toContain(R1);
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
  // Control: with the agent type fixed, expiry (test 6) answers before laps (test 7).
  expect(await refusalOf(store, reserveInput("i-new", spendOf(), { nowMs: 20_000 }))).toContain(
    "expired",
  );
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
