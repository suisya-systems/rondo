/**
 * `explain`, end to end over a real store: gather, propose, record, render.
 *
 * Against a real `node:sqlite` in-memory database rather than a fake, for
 * `advisory-record.test.ts`'s reason -- the properties worth asserting here are
 * the ones that cross the seam: that the snapshot the advisory read is the
 * snapshot the row keeps, that the proposal is written **before** anything is
 * rendered, and that a row that was not written is a row nobody is shown.
 *
 * The layer's own behaviour is `test/advisory/propose.test.ts`, which needs no
 * database at all (D-0022 rule 14).
 */
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import {
  COMMAND_LINE_SURFACE,
  explainIteration,
  proposeRetry,
  recordAnswer,
} from "../../src/access/advisory.js";
import type { CatalogLayer } from "../../src/cadenza/facade.js";
import { allocate } from "../../src/refrain/allocator.js";
import { admittedPlan, planPayload, type RunPlan, runPlan } from "../../src/refrain/plan.js";
import { CONSERVATIVE_HOST_POLICY } from "../../src/refrain/policy.js";
import type { JsonRecord } from "../../src/store/records.js";
import {
  type AdvisoryRecord,
  advisoryRecord,
  iterationStore,
  type RecordOutcome,
} from "../../src/store/sqlite.js";

const somePlan = (): JsonRecord => ({ run_id: "r-0001", workspace: "/srv/work/r-0001" });

const fresh = () => {
  const connection = new DatabaseSync(":memory:");
  return {
    connection,
    store: iterationStore(connection, CONSERVATIVE_HOST_POLICY),
    record: advisoryRecord(connection),
  };
};

const reserveOne = async (store: ReturnType<typeof fresh>["store"], id: string) =>
  store.reserve({
    id,
    request: "teach revise to name the flags it takes",
    plan: somePlan(),
    nowMs: 1_000,
    supersedesIterationId: null,
    runId: `rondo-${id}`,
    topicBranch: `rondo/${id}`,
    workspace: `/srv/work/iter-${id}`,
  });

/** The one row the proposal table holds, as the database has it. */
/** A screen that keeps what it was shown, so a test can read it. */
const screen = () => {
  const shown: string[] = [];
  return { shown, present: (lines: readonly string[]) => shown.push(...lines) };
};

const onlyProposal = (connection: DatabaseSync): Record<string, unknown> => {
  const rows = connection.prepare("SELECT * FROM proposal").all() as Record<string, unknown>[];
  expect(rows.length).toBe(1);
  const row = rows[0];
  if (row === undefined) {
    throw new Error("no proposal row");
  }
  return row;
};

test("it explains a row it can read, and records what it said", async () => {
  const { connection, store, record } = fresh();
  await reserveOne(store, "i-0001");

  const shows = screen();
  const outcome = await explainIteration(
    { store, record, now: () => 5_000, present: shows.present },
    "i-0001",
  );
  expect(outcome.kind).toBe("explained");

  const row = onlyProposal(connection);
  expect(row["kind"]).toBe("explanation");
  expect(row["iteration_id"]).toBe("i-0001");
  expect(row["created_at_ms"]).toBe(5_000);
  // D-0022 rule 4: the schema's CHECK keeps this null, and the advisory has no
  // field that could fill it -- a digest here would be the advisory claiming to
  // have composed something.
  expect(row["candidate_contract_digest"]).toBe(null);
  // D-0032 rule 8's CHECK, from the writer's side.
  expect(row["derivation"]).not.toBe(null);

  // **The snapshot in the row is the snapshot the claims point into.** Every
  // `snapshot` basis is a JSON pointer, and a pointer is only a citation if it
  // resolves against the bytes that were kept.
  const snapshot = JSON.parse(String(row["snapshot"])) as Record<string, unknown>;
  const iteration = snapshot["iteration"] as Record<string, unknown>;
  expect(iteration["id"]).toBe("i-0001");
  expect(String(iteration["planDigest"]).startsWith("sha256:")).toBe(true);

  // The lines carry the claim and its basis, which is #39's requirement: the
  // citation is readable without opening anything.
  const rendered = shows.shown.join("\n");
  expect(rendered).toContain("explanation of iteration 'i-0001'");
  expect(rendered).toContain("status: planned");
  // **The basis carries the material, not only the locator** (D-0032 rule 2).
  expect(rendered).toContain('basis: snapshot /iteration/status = "planned"');
  // And where the claim is rondo's word rather than the column's value, the line
  // under it is what lets an operator tell a null from an empty string.
  expect(rendered).toContain("continuo revision: undetermined");
  expect(rendered).toContain("basis: snapshot /iteration/continuoRevision = null");
  expect(rendered).toContain("revision of: none");
  expect(rendered).toContain("basis: snapshot /iteration/supersedesIterationId = null");
  // D-0032 rule 5, said out loud on the screen as well as in the record.
  expect(rendered).toContain("binds nothing");
});

test("it refuses an iteration the store does not hold, and writes nothing", async () => {
  const { connection, store, record } = fresh();
  const outcome = await explainIteration(
    { store, record, now: () => 5_000, present: screen().present },
    "i-ghost",
  );
  expect(outcome.kind).toBe("refused");
  expect(connection.prepare("SELECT count(*) AS n FROM proposal").get()).toEqual({ n: 0 });
});

test("a proposal that could not be recorded is not rendered", async () => {
  // **The order D-0022 rule 18 fixes, planted.** A framing an operator reads and
  // the ledger does not hold is the failure the record exists to prevent, so a
  // writer that refuses has to stop the presentation rather than be noted beside
  // it. Planted with a record port that fails, because the real one fails only
  // on a database that is already broken.
  const { store } = fresh();
  await reserveOne(store, "i-0001");
  const refusing: AdvisoryRecord = {
    ...advisoryRecord(new DatabaseSync(":memory:")),
    recordProposal: async (): Promise<RecordOutcome> => ({
      kind: "defect",
      reason: "the disk is gone",
    }),
  };

  const shows = screen();
  const outcome = await explainIteration(
    { store, record: refusing, now: () => 5_000, present: shows.present },
    "i-0001",
  );
  expect(outcome.kind).toBe("refused");
  if (outcome.kind !== "refused") {
    return;
  }
  expect(outcome.reason).toContain("the disk is gone");
  expect(outcome.reason).toContain("not being shown");
  expect(shows.shown).toEqual([]);
});

test("what was presented is counted as presented", async () => {
  // **D-0032 rule 10's numerator.** The count of what was put to the operator
  // comes from this table and from nowhere else: `human_decision` counts
  // answers, so with an explanation on the screen and nothing to answer it
  // reports zero. `rule_name` is null because `explain` withholds nothing and a
  // rule named where no policy applied would be a record of a judgement nobody
  // made.
  const { connection, store, record } = fresh();
  await reserveOne(store, "i-0001");

  const outcome = await explainIteration(
    { store, record, now: () => 5_000, present: screen().present },
    "i-0001",
  );
  expect(outcome.kind).toBe("explained");

  const rows = connection.prepare("SELECT * FROM operator_attention").all() as Record<
    string,
    unknown
  >[];
  expect(rows.length).toBe(1);
  expect(rows[0]?.["disposition"]).toBe("presented");
  expect(rows[0]?.["subject_kind"]).toBe("proposal");
  expect(rows[0]?.["subject_id"]).toBe(
    outcome.kind === "explained" ? outcome.proposalId : "unreachable",
  );
  expect(rows[0]?.["rule_name"]).toBe(null);
  expect(rows[0]?.["at_ms"]).toBe(5_000);
});

test("an explanation that was shown and not counted says so, and is still shown", async () => {
  // The failure has to be loud rather than absorbed: the operator has read the
  // explanation and the proposal is in the ledger, so treating this as a refusal
  // would be a lie about what happened -- and treating it as success would leave
  // #40's breakdown quietly short by one, which is the accountability the table
  // exists for.
  const { store, record } = fresh();
  await reserveOne(store, "i-0001");
  const halfWriting: AdvisoryRecord = {
    ...record,
    recordAttention: async (): Promise<RecordOutcome> => ({
      kind: "defect",
      reason: "the attention table is locked",
    }),
  };
  const shows = screen();

  const outcome = await explainIteration(
    { store, record: halfWriting, now: () => 5_000, present: shows.present },
    "i-0001",
  );

  expect(outcome.kind).toBe("presentedUncounted");
  if (outcome.kind === "presentedUncounted") {
    expect(outcome.reason).toContain("locked");
  }
  // Shown, and recorded as a proposal: the only thing missing is the count.
  expect(shows.shown.join("\n")).toContain("status: planned");
});

test("two explanations of one row are two rows, and the later one cites the later state", async () => {
  // An explanation is append-only like every other record here: the first one
  // stays readable for ever as the account that was given at the time, and the
  // second is a second row rather than an edit (D-0022 rule 4).
  const { connection, store, record } = fresh();
  await reserveOne(store, "i-0001");
  await explainIteration({ store, record, now: () => 5_000, present: screen().present }, "i-0001");
  const moved = await store.transition(
    "i-0001",
    "planned",
    "classified",
    { classification: "allowed", agentTypeDigest: `sha256:${"b".repeat(64)}` },
    6_000,
  );
  expect(moved.kind).toBe("transitioned");
  await explainIteration({ store, record, now: () => 7_000, present: screen().present }, "i-0001");

  const rows = connection
    .prepare("SELECT proposal_id, snapshot FROM proposal ORDER BY created_at_ms")
    .all() as { proposal_id: string; snapshot: string }[];
  expect(rows.length).toBe(2);
  expect(rows[0]?.snapshot).toContain('"classification":null');
  expect(rows[1]?.snapshot).toContain('"classification":"allowed"');
});

/**
 * A plan a retry could really run under: the fixture `readPlan` accepts and
 * cadenza can issue a contract from.
 *
 * **Built with the two functions production uses** (`allocate` then
 * `admittedPlan`), for `test/refrain/revision.test.ts`'s reason: a predecessor
 * row written as a literal would drift from what the allocator actually
 * derives, and every digest below is a function of that derivation.
 */
const CATALOG_LAYER: CatalogLayer = {
  layer: "tracked",
  origin: "test fixture",
  baseDir: resolve("/srv/catalog"),
  data: {
    schema_version: 1,
    project: {
      rondo: {
        source: { kind: "git_url", url: "https://example.invalid/org/rondo.git" },
        base_branch: "main",
      },
    },
  },
};

const WORKSPACE_ROOT = "/srv/rondo/work";

const PLAN_INPUT: RunPlan = {
  db: "/srv/rondo/control.db",
  workspaceRoot: WORKSPACE_ROOT,
  baseBranch: "main",
  prompt: "teach rondo to count",
  repository: "/srv/rondo/repo",
  artifactRoot: "/srv/rondo/artifacts",
  stateRoot: "/srv/rondo/state",
  interlockRoot: "/srv/rondo/interlock",
  claudeOrgPath: "/srv/rondo/claude-org",
  endpointRecipient: "external-notify",
  endpointDestinationDir: "/srv/rondo/outbox",
  claudeCommand: ["/usr/bin/node", "/srv/rondo/claude.js"],
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
  catalogLayers: [CATALOG_LAYER],
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
};

const realPlan = (iterationId: string): JsonRecord => {
  const validated = runPlan(PLAN_INPUT);
  if (validated.kind !== "planned") {
    throw new Error(`the fixture plan is not a plan: ${validated.reason}`);
  }
  const allocation = allocate(iterationId, WORKSPACE_ROOT);
  if (allocation.kind !== "allocated") {
    throw new Error(`fixture id '${iterationId}' was refused: ${allocation.reason}`);
  }
  const admitted = admittedPlan(validated.plan, allocation.allocation);
  if (admitted.kind !== "planned") {
    throw new Error(`fixture admission failed: ${admitted.reason}`);
  }
  return planPayload(admitted.plan);
};

const reserveWithPlan = async (
  store: ReturnType<typeof fresh>["store"],
  id: string,
  supersedesIterationId: string | null,
) =>
  store.reserve({
    id,
    request: "teach rondo to count",
    plan: realPlan(id),
    nowMs: 1_000,
    supersedesIterationId,
    runId: `rondo-${id}`,
    topicBranch: `rondo/${id}`,
    workspace: `/srv/work/${id}`,
  });

const PROPOSE_PORTS = { now: () => 7_000, cadenzaRevision: "5d5d9f4" };

test("it proposes the plans a retry could run under, and records both before showing them", async () => {
  // **The whole of D-0022 rules 17 and 18 in one case.** The contract each
  // option would run under is composed for the *successor's* identity -- a
  // fresh iteration id, whose run id the allocator derives, which is what makes
  // "the exact contract the retry will run under" showable before an approval.
  // Both the proposal and every composition are written before a line reaches
  // the screen, and the digest on the screen is the digest in the row.
  const { connection, store, record } = fresh();
  await reserveWithPlan(store, "iter-0", null);
  // The predecessor has to be over before a successor may name it: a
  // `needs_approval` row is never revived, and a new iteration is linked to it
  // (D-0022 rule 10). This is the shape a retry is proposed over.
  await store.settle("iter-0", "the work was not taken", 2_000);
  await reserveWithPlan(store, "iter-1", "iter-0");

  const shows = screen();
  const outcome = await proposeRetry(
    { ...PROPOSE_PORTS, store, record, present: shows.present },
    "iter-1",
    "iter-2",
  );
  // The refusal's own words on failure, because "expected refused to be
  // proposed" is a message nobody can act on.
  expect(outcome.kind === "refused" ? outcome.reason : "proposed").toBe("proposed");
  if (outcome.kind !== "proposed") {
    return;
  }

  const row = onlyProposal(connection);
  expect(row["kind"]).toBe("run_plan");
  expect(row["iteration_id"]).toBe("iter-1");
  // D-0032 rule 8's CHECK from the writer's side: `derivation` is an
  // explanation's, and this kind composed rather than derived.
  expect(row["derivation"]).toBe(null);
  // D-0022 rule 4's CHECK: the advisory composed no contract, so the *proposal*
  // claims none. The contracts are in `composition`, which is a different fact
  // with a different author.
  expect(row["candidate_contract_digest"]).toBe(null);
  // The pin that composed something -- the one column `explain`'s row leaves
  // null and this one must not (D-0022 rule 18).
  expect(row["cadenza_revision"]).toBe("5d5d9f4");
  expect(row["predecessor_plan_digest"]).not.toBe(null);

  // **Both plans are offered and the subject's own is the recommendation**
  // (D-0022 rule 17: a retry starts from the abandoned row's plan).
  expect(outcome.options.length).toBe(2);
  const snapshot = JSON.parse(String(row["snapshot"])) as {
    successor: Record<string, unknown>;
    candidates: Record<string, unknown>[];
  };
  expect(snapshot.successor["runId"]).toBe("rondo-iter-2");
  expect(snapshot.candidates.map((one) => one["iterationId"])).toEqual(["iter-1", "iter-0"]);

  // **The digest an operator reads is the digest the ledger holds.** Every
  // option's value is a `composition.contract_digest` written for this
  // proposal, which is what makes `human_decision.approved` a reference to
  // something rather than a string somebody typed.
  const compositions = connection
    .prepare("SELECT * FROM composition WHERE proposal_id = ? ORDER BY composition_id")
    .all(outcome.proposalId) as Record<string, unknown>[];
  expect(compositions.length).toBe(2);
  expect(compositions.map((one) => String(one["contract_digest"])).sort()).toEqual(
    outcome.options.map((option) => option.value).sort(),
  );
  // D-0022 rule 17: the retry's contract opens a lineage rather than continuing
  // one, so there is nothing for it to supersede -- and the contract cadenza
  // digested says the same thing in its own bytes.
  for (const composed of compositions) {
    expect(composed["supersedes_contract_digest"]).toBe(null);
    const contract = JSON.parse(String(composed["contract"])) as Record<string, unknown>;
    expect(contract["supersedes"]).toBe(null);
    // The grantee is the *successor's* run id, which is the whole reason the
    // digest can be shown before anything is admitted (D-0023 + rule 17).
    expect(contract["grantee"]).toBe("rondo-iter-2");
  }

  const rendered = shows.shown.join("\n");
  expect(rendered).toContain("a retry of iteration 'iter-1', as iteration 'iter-2'");
  expect(rendered).toContain("[recommended]");
  expect(rendered).toContain("[alternative]");
  // Said out loud, because an approval today authorises an issuance nothing
  // performs: a line claiming the retry starts would be false.
  expect(rendered).toContain("It starts nothing yet");
  for (const option of outcome.options) {
    expect(rendered).toContain(option.value);
  }
});

test("a lineage deeper than one generation offers two plans and not five", async () => {
  // **The ceiling stated as a test rather than only as a comment.** The set of
  // alternatives is the framing #39 measures, so the options are the plan that
  // has just failed and the one it was revised from -- an older ancestor is not
  // consulted, and is not silently missing from a set it was never in. This is
  // the case that goes red if the gatherer is ever taught to walk the lineage
  // without someone deciding it should.
  const { store, record } = fresh();
  await reserveWithPlan(store, "iter-0", null);
  await store.settle("iter-0", "the work was not taken", 2_000);
  await reserveWithPlan(store, "iter-1", "iter-0");
  await store.settle("iter-1", "the work was not taken", 2_500);
  await reserveWithPlan(store, "iter-2", "iter-1");

  const outcome = await proposeRetry(
    { ...PROPOSE_PORTS, store, record, present: screen().present },
    "iter-2",
    "iter-3",
  );
  expect(outcome.kind === "refused" ? outcome.reason : "proposed").toBe("proposed");
  if (outcome.kind !== "proposed") {
    return;
  }
  expect(outcome.options.length).toBe(2);
  expect(outcome.options.map((option) => option.label).join(" ")).not.toContain("iter-0");
});

test("a proposal whose alternatives are not all readable is refused, not shortened", async () => {
  // **The set of alternatives is the framing** #39 identifies as the hazard, so
  // a proposal quietly short one option is a worse answer than a refusal. The
  // predecessor row here is missing entirely, which is the same absence a
  // corrupt row produces from the reader's side.
  const { connection, store, record } = fresh();
  await reserveWithPlan(store, "iter-1", "iter-gone");

  const shows = screen();
  const outcome = await proposeRetry(
    { ...PROPOSE_PORTS, store, record, present: shows.present },
    "iter-1",
    "iter-2",
  );
  expect(outcome.kind).toBe("refused");
  expect(shows.shown).toEqual([]);
  expect(connection.prepare("SELECT count(*) AS n FROM proposal").get()).toEqual({ n: 0 });
  expect(connection.prepare("SELECT count(*) AS n FROM composition").get()).toEqual({ n: 0 });
});

test("a plan that will not decode is named rather than silently dropped", async () => {
  // `explain` reads a row like this and says what it holds; `propose` cannot,
  // because a contract cannot be composed from a plan nobody can read -- and
  // the refusal names which row, which is what a person needs to act on.
  const { connection, store, record } = fresh();
  await reserveOne(store, "iter-1");

  const outcome = await proposeRetry(
    { ...PROPOSE_PORTS, store, record, present: screen().present },
    "iter-1",
    "iter-2",
  );
  expect(outcome.kind).toBe("refused");
  if (outcome.kind === "refused") {
    expect(outcome.reason).toContain("iter-1");
    expect(outcome.reason).toContain("will not decode");
  }
  expect(connection.prepare("SELECT count(*) AS n FROM proposal").get()).toEqual({ n: 0 });
});

test("an approval is recorded against the contract that was shown", async () => {
  // The other half of the flow: D-0032 rule 6's row, with the two identities
  // that must not collapse into one -- the approver and the surface.
  const { connection, store, record } = fresh();
  await reserveWithPlan(store, "iter-1", null);
  const proposed = await proposeRetry(
    { ...PROPOSE_PORTS, store, record, present: screen().present },
    "iter-1",
    "iter-2",
  );
  expect(proposed.kind).toBe("proposed");
  if (proposed.kind !== "proposed") {
    return;
  }
  const chosen = proposed.options[0];

  const answered = await recordAnswer(
    { record, now: () => 8_000 },
    {
      proposalId: proposed.proposalId,
      outcome: "approved",
      contractDigest: chosen?.value ?? "",
      actorId: "operator-1",
    },
  );
  expect(answered.kind).toBe("answered");

  const decision = connection.prepare("SELECT * FROM human_decision").get() as Record<
    string,
    unknown
  >;
  expect(decision["proposal_id"]).toBe(proposed.proposalId);
  expect(decision["outcome"]).toBe("approved");
  expect(decision["approved"]).toBe(chosen?.value);
  expect(decision["actor_id"]).toBe("operator-1");
  expect(decision["recorded_by"]).toBe(COMMAND_LINE_SURFACE);
  // Route S: no gate was opened for this question, and the two columns are null
  // together rather than naming a transition no run ever made.
  expect(decision["gate_id"]).toBe(null);
  expect(decision["gate_transition_seq"]).toBe(null);
  // **Nothing was consumed.** An approval authorises an issuance that nothing
  // performs yet (D-0022 rule 17's enforcement is unbuilt), so rule 19's
  // "approved and never spent" is exactly what this store now holds.
  expect(connection.prepare("SELECT count(*) AS n FROM decision_consumption").get()).toEqual({
    n: 0,
  });
});

test("a refusal is a row, and it approves no contract", async () => {
  // D-0032 rule 6: without this row, "the operator settled this" and "nobody
  // has answered" are the same absence, and #41's inbox cannot tell them apart.
  const { connection, store, record } = fresh();
  await reserveWithPlan(store, "iter-1", null);
  const proposed = await proposeRetry(
    { ...PROPOSE_PORTS, store, record, present: screen().present },
    "iter-1",
    "iter-2",
  );
  expect(proposed.kind).toBe("proposed");
  if (proposed.kind !== "proposed") {
    return;
  }

  const answered = await recordAnswer(
    { record, now: () => 8_000 },
    {
      proposalId: proposed.proposalId,
      outcome: "declined",
      contractDigest: null,
      actorId: "operator-1",
    },
  );
  expect(answered.kind).toBe("answered");
  const decision = connection.prepare("SELECT * FROM human_decision").get() as Record<
    string,
    unknown
  >;
  expect(decision["outcome"]).toBe("declined");
  expect(decision["approved"]).toBe(null);
  // The composition outlives the refusal, which is what D-0022 rule 18 is for:
  // the ledger holds the contract that was on the screen, not only the
  // candidate inputs behind it.
  expect(connection.prepare("SELECT count(*) AS n FROM composition").get()).toEqual({ n: 1 });
});

test("PLANTED: an explanation cannot be answered, on the path an operator would use", async () => {
  // **D-0032 rule 5, proved through the surface and not only through the
  // store.** The writer refuses inside its own transaction; what this case adds
  // is that the flow shipped here cannot route around it -- `explain` writes a
  // proposal row like any other, and answering that row is refused for the one
  // reason that matters: authority is a function of `kind` alone.
  const { connection, store, record } = fresh();
  await reserveOne(store, "iter-1");
  const explained = await explainIteration(
    { store, record, now: () => 5_000, present: screen().present },
    "iter-1",
  );
  expect(explained.kind).toBe("explained");
  if (explained.kind !== "explained") {
    return;
  }

  const answered = await recordAnswer(
    { record, now: () => 8_000 },
    {
      proposalId: explained.proposalId,
      outcome: "approved",
      contractDigest: "sha256:whatever-a-person-typed",
      actorId: "operator-1",
    },
  );
  expect(answered.kind).toBe("refused");
  if (answered.kind === "refused") {
    expect(answered.reason).toContain("binds nothing");
  }
  expect(connection.prepare("SELECT count(*) AS n FROM human_decision").get()).toEqual({ n: 0 });
});

test("a successor identity that is already taken is refused before anything is composed", async () => {
  // **The approval this prevents is one nobody could ever spend.** The
  // iteration id is a primary key, so a retry under a taken id cannot be
  // admitted -- and moving to a free id changes the derived run id, hence the
  // grantee, hence the digest that was approved. `allocate()` checks the shape
  // of an id and knows nothing about the store, so the check has to be here.
  const { connection, store, record } = fresh();
  await reserveWithPlan(store, "iter-1", null);

  // The subject's own id is the taken one that is easiest to type by mistake,
  // and it is the case a shape check cannot catch.
  const shows = screen();
  const outcome = await proposeRetry(
    { ...PROPOSE_PORTS, store, record, present: shows.present },
    "iter-1",
    "iter-1",
  );
  expect(outcome.kind).toBe("refused");
  if (outcome.kind === "refused") {
    expect(outcome.reason).toContain("already exists");
  }
  expect(shows.shown).toEqual([]);
  expect(connection.prepare("SELECT count(*) AS n FROM proposal").get()).toEqual({ n: 0 });
  expect(connection.prepare("SELECT count(*) AS n FROM composition").get()).toEqual({ n: 0 });
});
