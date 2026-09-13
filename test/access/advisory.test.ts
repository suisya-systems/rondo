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
  type Elevation,
  elevateObservation,
  explainIteration,
  proposeRetry,
  recordAnswer,
  showProposal,
} from "../../src/access/advisory.js";
import type { CatalogLayer } from "../../src/cadenza/facade.js";
import { allocate } from "../../src/refrain/allocator.js";
import { admittedPlan, planPayload, type RunPlan, runPlan } from "../../src/refrain/plan.js";
import { CONSERVATIVE_HOST_POLICY } from "../../src/refrain/policy.js";
import type { JsonRecord, ProposalDraft } from "../../src/store/records.js";
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
    spend: null,
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

/**
 * rondo#90, measured as finding N-5 of `docs/operations/lap-2-dogfood.md`.
 *
 * `--prompt-file` (#72) exists so that a request can be more than one
 * paragraph, and this line rendered all 2154 characters of one through
 * `asciiEscape`: a literal `\n` at every paragraph break, unwrapped, and then a
 * 200-character prefix of the same text under it as its basis. It is #68's
 * distinction one screen over -- a value that *is* the whole of what is shown
 * keeps its paragraphs, where a value folded into a line rondo composed may
 * not.
 *
 * **The non-ASCII check runs over the bytes and not over the string**, for
 * `console.test.ts`'s reason exactly: vitest captures stdout through a UTF-8
 * path, which is how an escape that D-0004 forbids would ship green.
 */
test("a multi-paragraph request is quoted over its own lines rather than escaped onto one", async () => {
  const { store, record } = fresh();
  const request = [
    "Repair the rendering defect measured as N-5.",
    "",
    "The request reaches the operator through the advisory — and the em-dash in this " +
      "sentence is the other half of what #68 repaired one screen over, which is why a " +
      "paragraph this long is here to be wrapped.",
  ].join("\n");
  const reserved = await store.reserve({
    id: "i-0001",
    request,
    plan: somePlan(),
    spend: null,
    nowMs: 1_000,
    supersedesIterationId: null,
    runId: "rondo-i-0001",
    topicBranch: "rondo/i-0001",
    workspace: "/srv/work/iter-i-0001",
  });
  expect(reserved.kind).toBe("reserved");

  const shows = screen();
  const outcome = await explainIteration(
    { store, record, now: () => 5_000, present: shows.present },
    "i-0001",
  );
  expect(outcome.kind).toBe("explained");

  const rendered = shows.shown.join("\n");
  // The defect's own signature: a paragraph break spelled as an escape.
  expect(rendered).not.toContain("\\u000a");
  expect(rendered).toContain(
    `request: 3 lines, ${String(request.length)} characters, quoted in full:`,
  );
  expect(shows.shown).toContain("    | Repair the rendering defect measured as N-5.");
  // The em-dash is spelled with the ASCII lookalike rather than `—`
  // (rondo#68's table), which is the second half of the same repair.
  expect(rendered).toContain("advisory -- and the em-dash");
  expect(rendered).not.toContain("\\u2014");
  // Wrapped: the third paragraph is wider than the column, so it reaches the
  // screen as more than one line and none of them is wider than the column.
  const quoted = shows.shown.filter((line) => line.startsWith("    |"));
  expect(quoted.length).toBeGreaterThan(3);
  for (const line of quoted) {
    expect(line.length).toBeLessThanOrEqual("    | ".length + 88);
  }
  // **The basis is still there** (D-0032 rule 2) and stops repeating a prefix
  // of the value quoted immediately above it.
  expect(rendered).toContain(
    "basis: snapshot /iteration/request = the value quoted above, in full",
  );
  // A claim whose value fits on its line is unmoved: the quoting is for the
  // value that could not fit, not a new shape for every claim.
  expect(rendered).toContain("  status: planned");
  expect(rendered).toContain('basis: snapshot /iteration/status = "planned"');
  // D-0004, over the bytes of everything this screen composed itself.
  expect(
    Buffer.from(rendered, "utf8").every((byte) => byte === 0x0a || (byte >= 0x20 && byte <= 0x7e)),
  ).toBe(true);
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

// --- elevate: the two columns, and the refusals on the way to them ---------

/** One observation, as `elevate` hands it over. */
const anObservation = (): Elevation => ({
  messageId: "m-0001",
  actorId: "operator-1",
  observation: {
    label: "observation",
    value: "this plan was already merged last week",
    basis: { form: "iteration", iterationId: "i-0001" },
  },
});

test("it elevates an observation, and the row records which message and who", async () => {
  // **D-0032 rule 7's pair, written for the first time** (#41 section 3): the
  // chain observation -> proposal is a fact in the ledger rather than a
  // convention, and it is a fact about *this* proposal rather than a separate
  // table nobody joins.
  const { connection, store, record } = fresh();
  await reserveOne(store, "i-0001");

  const shows = screen();
  const outcome = await elevateObservation(
    { store, record, now: () => 5_000, present: shows.present },
    "i-0001",
    anObservation(),
  );
  expect(outcome.kind).toBe("explained");

  const row = onlyProposal(connection);
  expect(row["elevated_from_message_id"]).toBe("m-0001");
  expect(row["elevated_by_actor_id"]).toBe("operator-1");
  // The message the reference names is in the conversation, which is what
  // D-0036 rule 4 refuses a proposal for lacking.
  expect(
    connection
      .prepare("SELECT count(*) AS n FROM conversation_message WHERE message_id = ?")
      .get("m-0001"),
  ).toEqual({ n: 1 });
  // The derivation says a person is in this payload (D-0032 rule 8).
  expect(row["derivation"]).toBe("operator_elevation");
  // Still the kind that binds nothing: this cut reaches proposal and stops.
  expect(row["kind"]).toBe("explanation");

  const rendered = shows.shown.join("\n");
  expect(rendered).toContain("elevated from message 'm-0001' by 'operator-1'");
  expect(rendered).toContain("observation: this plan was already merged last week");
  expect(rendered).toContain("basis: iteration i-0001");
  expect(rendered).toContain("binds nothing");
});

test("an observation whose message id is already spoken for is refused, and nothing is proposed", async () => {
  // **The CLI-reachable half of D-0036 rule 3.** A message id is immutable, and
  // the store holds no body, so it cannot tell a repeat of one message from a
  // different message reusing an id. Refusing is the answer that cannot
  // silently be wrong -- and the proposal that would have cited it is not
  // written either.
  const { connection, store, record } = fresh();
  await reserveOne(store, "i-0001");
  expect(await record.recordMessage("m-0001")).toEqual({ kind: "recorded" });

  const shows = screen();
  const outcome = await elevateObservation(
    { store, record, now: () => 5_000, present: shows.present },
    "i-0001",
    anObservation(),
  );
  expect(outcome.kind).toBe("refused");
  expect(connection.prepare("SELECT count(*) AS n FROM proposal").get()).toEqual({ n: 0 });
  expect(shows.shown).toEqual([]);
});

test("an iteration that is not there costs no message id", async () => {
  // The order is deliberate: a message id is spent for ever once appended, so
  // the commonest mistake -- a typo'd iteration id -- must not burn the name
  // the operator is about to retype.
  const { connection, store, record } = fresh();
  const outcome = await elevateObservation(
    { store, record, now: () => 5_000, present: screen().present },
    "i-ghost",
    anObservation(),
  );
  expect(outcome.kind).toBe("refused");
  expect(connection.prepare("SELECT count(*) AS n FROM conversation_message").get()).toEqual({
    n: 0,
  });
});

test("a proposal that cannot be written leaves the message id unspent", async () => {
  // **One gesture, one transaction** (`recordElevation`). A message id is spent
  // for ever once appended (D-0036 rule 3), so a message beside a proposal that
  // was not written would cost the operator the name they chose and leave a row
  // in the conversation with no observation behind it. Planted with a proposal
  // row already sitting under the id this elevation would mint, because the
  // real failures here are store faults.
  const { connection, store, record } = fresh();
  await reserveOne(store, "i-0001");
  connection
    .prepare(
      "INSERT INTO proposal (proposal_id, kind, drafter, payload, proposal_digest, snapshot, " +
        "snapshot_digest, derivation, created_at_ms) " +
        "VALUES (?, 'explanation', 'x', '{}', 'd', '{}', 'd', 'store_rows', 1)",
    )
    .run("elevation-m-0001");

  const shows = screen();
  const outcome = await elevateObservation(
    { store, record, now: () => 5_000, present: shows.present },
    "i-0001",
    anObservation(),
  );
  expect(outcome.kind).toBe("refused");
  // The message was rolled back with the proposal: the operator can retype
  // 'm-0001' once the fault is fixed.
  expect(connection.prepare("SELECT count(*) AS n FROM conversation_message").get()).toEqual({
    n: 0,
  });
  expect(shows.shown).toEqual([]);
});

test("a pointer at something no snapshot holds does not resolve, and does not throw", async () => {
  // **A pointer can now come from an operator** (`--basis snapshot:/...`), and
  // `constructor` is on every object while being in no snapshot. Walking into
  // it would render a function as a citation -- and, before the own-property
  // check, would throw *after* the message and the proposal were written,
  // leaving a spent message id and nothing on the screen.
  const { connection, store, record } = fresh();
  await reserveOne(store, "i-0001");

  const shows = screen();
  const outcome = await elevateObservation(
    { store, record, now: () => 5_000, present: shows.present },
    "i-0001",
    {
      ...anObservation(),
      observation: {
        label: "observation",
        value: "pointed at nothing the row holds",
        basis: { form: "snapshot", pointer: "/constructor" },
      },
    },
  );
  expect(outcome.kind).toBe("explained");
  expect(shows.shown.join("\n")).toContain("basis: snapshot /constructor = does not resolve");
  expect(connection.prepare("SELECT count(*) AS n FROM proposal").get()).toEqual({ n: 1 });

  // The same for an array: `length` is on every array and is in no snapshot,
  // and RFC 6901 addresses an array by index only. An index that is there
  // still resolves, which is what keeps this a check rather than a ban.
  const more = screen();
  await elevateObservation({ store, record, now: () => 6_000, present: more.present }, "i-0001", {
    ...anObservation(),
    messageId: "m-0002",
    observation: {
      label: "observation",
      value: "counted the readings",
      basis: { form: "snapshot", pointer: "/readings/length" },
    },
  });
  expect(more.shown.join("\n")).toContain("basis: snapshot /readings/length = does not resolve");
  expect(more.shown.join("\n")).toContain('basis: snapshot /iteration/status = "planned"');
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
  allowedBash: ["npm run:*"],
  materialLanguage: null,
  reviewCriterion: null,
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

const realPlan = (iterationId: string, plan: RunPlan = PLAN_INPUT): JsonRecord => {
  const validated = runPlan(plan);
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
  plan: RunPlan = PLAN_INPUT,
) =>
  store.reserve({
    id,
    request: "teach rondo to count",
    plan: realPlan(id, plan),
    spend: null,
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
    "run_plan",
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
  // Said out loud, because approving is not starting: the screen names the verb
  // that spends the answer, and says that verb refuses a contract that moved.
  expect(rendered).toContain("'rondo retry' is what");
  expect(rendered).toContain("refuses unless the contract still composes to what you approved");
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
    "run_plan",
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
    "run_plan",
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
    "run_plan",
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
    "run_plan",
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
    "run_plan",
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
    "run_plan",
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

/** The same plan under a wider agent type: what a lineage's alternative looks like. */
const WIDER_PLAN: RunPlan = {
  ...PLAN_INPUT,
  agentTypeInput: {
    ...PLAN_INPUT.agentTypeInput,
    agentTypeId: "worker-wide",
    granted: ["command.run", "worktree.write"],
    askable: ["branch.push"],
  },
};

test("agent_type offers the agent types the lineage ran under, and recommends the row's own", async () => {
  // **D-0022 rule 17's widening, as an option set.** A retry's grants are its
  // agent type's, so this is the kind that widens -- and the recommendation is
  // still the agent type the row already had, because rondo proposes candidates
  // and a person decides a widening (`D-0009`).
  const { connection, store, record } = fresh();
  await reserveWithPlan(store, "iter-0", null, WIDER_PLAN);
  await store.settle("iter-0", "the work was not taken", 2_000);
  await reserveWithPlan(store, "iter-1", "iter-0");

  const shows = screen();
  const outcome = await proposeRetry(
    { ...PROPOSE_PORTS, store, record, present: shows.present },
    "agent_type",
    "iter-1",
    "iter-2",
  );
  expect(outcome.kind === "refused" ? outcome.reason : "proposed").toBe("proposed");
  if (outcome.kind !== "proposed") {
    return;
  }

  const row = onlyProposal(connection);
  expect(row["kind"]).toBe("agent_type");
  expect(row["derivation"]).toBe(null);
  expect(row["cadenza_revision"]).toBe("5d5d9f4");

  expect(outcome.options.length).toBe(2);
  // **Distinct digests are what makes them separately answerable**: two options
  // carrying one value would be two ways to record an approval the ledger
  // cannot tell apart, because `human_decision.approved` names a digest.
  expect(new Set(outcome.options.map((option) => option.value)).size).toBe(2);
  const rendered = shows.shown.join("\n");
  expect(rendered).toContain("(agent_type)");
  expect(rendered).toContain("[recommended] run 'iter-2' under agent type 'worker-basic'");
  expect(rendered).toContain("[alternative] run 'iter-2' under agent type 'worker-wide'");

  // Every option's digest is a contract this proposal composed, in option order.
  const compositions = connection
    .prepare("SELECT * FROM composition WHERE proposal_id = ? ORDER BY composition_id")
    .all(outcome.proposalId) as Record<string, unknown>[];
  expect(compositions.map((one) => String(one["contract_digest"]))).toEqual(
    outcome.options.map((option) => option.value),
  );
  // The widened option really is the wider contract, in the bytes cadenza
  // digested rather than only in the label.
  const wider = JSON.parse(String(compositions[1]?.["contract"])) as Record<string, unknown>;
  expect(wider["granted"]).toEqual(["command.run", "worktree.write"]);
});

test("an agent type the lineage repeats is one option, not two identical ones", async () => {
  // Two agent types with one digest issue one contract. Offering both would put
  // two options with the same value on the screen, and an approval could not say
  // which was taken -- so they are one candidate, and the first is the row's own.
  const { store, record } = fresh();
  await reserveWithPlan(store, "iter-0", null);
  await store.settle("iter-0", "the work was not taken", 2_000);
  await reserveWithPlan(store, "iter-1", "iter-0");

  const outcome = await proposeRetry(
    { ...PROPOSE_PORTS, store, record, present: screen().present },
    "agent_type",
    "iter-1",
    "iter-2",
  );
  expect(outcome.kind === "refused" ? outcome.reason : "proposed").toBe("proposed");
  if (outcome.kind !== "proposed") {
    return;
  }
  expect(outcome.options.length).toBe(1);
  expect(outcome.options[0]?.label).toContain("worker-basic");
});

test("contract_keys offers one promotion per askable key, and recommends promoting none", async () => {
  // **One key at a time, and only a key the agent type's author already listed
  // as askable.** Promoting two at once would ask a person to approve two
  // widenings with one answer; a key from outside `askable` would be rondo
  // inventing a grant nobody offered.
  const { connection, store, record } = fresh();
  await reserveWithPlan(store, "iter-1", null);

  const shows = screen();
  const outcome = await proposeRetry(
    { ...PROPOSE_PORTS, store, record, present: shows.present },
    "contract_keys",
    "iter-1",
    "iter-2",
  );
  expect(outcome.kind === "refused" ? outcome.reason : "proposed").toBe("proposed");
  if (outcome.kind !== "proposed") {
    return;
  }

  expect(onlyProposal(connection)["kind"]).toBe("contract_keys");
  // The fixture's agent type asks for one key, so: unchanged, and one promotion.
  expect(outcome.options.length).toBe(2);
  const rendered = shows.shown.join("\n");
  expect(rendered).toContain("[recommended] leave the keys as they are");
  expect(rendered).toContain("[alternative] grant 'branch.push'");

  const compositions = connection
    .prepare("SELECT * FROM composition WHERE proposal_id = ? ORDER BY composition_id")
    .all(outcome.proposalId) as Record<string, unknown>[];
  const unchanged = JSON.parse(String(compositions[0]?.["contract"])) as Record<string, unknown>;
  const promoted = JSON.parse(String(compositions[1]?.["contract"])) as Record<string, unknown>;
  expect(unchanged["granted"]).toEqual(["command.run"]);
  expect(unchanged["askable"]).toEqual(["branch.push"]);
  // **The key moved rather than being copied**, which is what makes it a
  // promotion: cadenza requires the two lists to be disjoint, and a key in both
  // would be a contract that cannot exist.
  expect(promoted["granted"]).toEqual(["branch.push", "command.run"]);
  expect(promoted["askable"]).toEqual([]);
});

test("an approval of a widening names the widened contract and nothing else", async () => {
  // The point of the pair: what the ledger records is the contract that was on
  // the screen, so "which widening did a person approve" is answerable from the
  // decision row and the composition it references.
  const { connection, store, record } = fresh();
  await reserveWithPlan(store, "iter-1", null);
  const proposed = await proposeRetry(
    { ...PROPOSE_PORTS, store, record, present: screen().present },
    "contract_keys",
    "iter-1",
    "iter-2",
  );
  expect(proposed.kind).toBe("proposed");
  if (proposed.kind !== "proposed") {
    return;
  }
  const widening = proposed.options[1];

  const answered = await recordAnswer(
    { record, now: () => 8_000 },
    {
      proposalId: proposed.proposalId,
      outcome: "approved",
      contractDigest: widening?.value ?? "",
      actorId: "operator-1",
    },
  );
  expect(answered.kind).toBe("answered");

  const approved = String(
    (connection.prepare("SELECT approved FROM human_decision").get() as Record<string, unknown>)[
      "approved"
    ],
  );
  expect(approved).toBe(widening?.value);
  const contract = connection
    .prepare("SELECT contract FROM composition WHERE contract_digest = ?")
    .get(approved) as Record<string, unknown>;
  expect(JSON.parse(String(contract["contract"]))["granted"]).toEqual([
    "branch.push",
    "command.run",
  ]);
});

test("an alternative whose plan will not decode is refused rather than omitted", async () => {
  // **The same rule `run_plan` follows, on the agent type.** The alternative
  // exists and rondo could not read it, so a one-option set in front of a person
  // who really had two would be the framing this record exists to prevent.
  const { connection, store, record } = fresh();
  await reserveOne(store, "iter-0");
  await store.settle("iter-0", "the work was not taken", 2_000);
  await reserveWithPlan(store, "iter-1", "iter-0");

  const outcome = await proposeRetry(
    { ...PROPOSE_PORTS, store, record, present: screen().present },
    "agent_type",
    "iter-1",
    "iter-2",
  );
  expect(outcome.kind).toBe("refused");
  if (outcome.kind === "refused") {
    expect(outcome.reason).toContain("iter-0");
    expect(outcome.reason).toContain("will not decode");
  }
  expect(connection.prepare("SELECT count(*) AS n FROM proposal").get()).toEqual({ n: 0 });
});

test("an agent type cadenza will not build is a refusal and not a crash", async () => {
  // **`readPlan` carries `agentTypeInput` through as opaque data** -- the store
  // may not name a cadenza type -- so a plan that decodes says nothing about
  // whether its key lists are lists. A row from an older build, or edited with
  // `sqlite3`, has to reach an operator as a sentence rather than as a stack.
  const { connection, store, record } = fresh();
  const malformed = realPlan("iter-1") as Record<string, unknown>;
  malformed["agent_type_input"] = {
    ...(malformed["agent_type_input"] as Record<string, unknown>),
    askable: null,
  };
  await store.reserve({
    id: "iter-1",
    request: "teach rondo to count",
    plan: malformed as JsonRecord,
    spend: null,
    nowMs: 1_000,
    supersedesIterationId: null,
    runId: "rondo-iter-1",
    topicBranch: "rondo/iter-1",
    workspace: "/srv/work/iter-1",
  });

  const outcome = await proposeRetry(
    { ...PROPOSE_PORTS, store, record, present: screen().present },
    "contract_keys",
    "iter-1",
    "iter-2",
  );
  expect(outcome.kind).toBe("refused");
  expect(connection.prepare("SELECT count(*) AS n FROM proposal").get()).toEqual({ n: 0 });
});

// --- Reading one stored proposal back (#39) -------------------------------

/** One stored option set, in the shape the drafters emit (D-0032 rules 1 and 2). */
const storedOptions = (): JsonRecord => ({
  options: [
    {
      label: "run the retry under the plan of i-0001",
      value: `sha256:${"a".repeat(64)}`,
      basis: { form: "snapshot", pointer: "/iteration/status" },
    },
    {
      label: "run it under the predecessor's plan",
      value: `sha256:${"b".repeat(64)}`,
      basis: { form: "iteration", iterationId: "i-0000" },
    },
  ],
  recommended: 0,
});

const storedProposal = (payload: JsonRecord): ProposalDraft => ({
  proposalId: "p-0001",
  kind: "run_plan",
  drafter: "rondo/advisory/deterministic",
  payload,
  snapshot: { iteration: { id: "i-0001", status: "needs_approval" } },
  derivation: null,
  iterationId: "i-0001",
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
  createdAtMs: 5_000,
});

test("a proposal is answerable from the row alone, long after it was drafted", async () => {
  // **#39's falsifier, taken literally.** An operator reading only this screen
  // sees the options in the record's own order, which one is recommended, what
  // each rests on *with the material under it*, whether anybody has answered,
  // and what answering forecloses. Nothing here re-composes the proposal: it is
  // the row, read back, which is the whole difference between a gate that is
  // answerable once and one that is answerable later.
  const { store, record } = fresh();
  await record.recordProposal(storedProposal(storedOptions()));

  const shows = screen();
  const outcome = await showProposal(
    { store, cadenzaRevision: "cadenza@abcdef0", record, now: () => 9_000, present: shows.present },
    "p-0001",
  );

  expect(outcome).toEqual({ kind: "shown" });
  const rendered = shows.shown.join("\n");
  expect(rendered).toContain("proposal 'p-0001'  run_plan  about iteration 'i-0001'");
  // The order is the payload's, and the recommendation is marked where it sits.
  expect(rendered).toContain("[recommended] run the retry under the plan of i-0001");
  expect(rendered).toContain("[alternative] run it under the predecessor's plan");
  // D-0032 rule 2: the inline form carries the material, resolved against the
  // row's own verbatim snapshot rather than against anything re-read.
  expect(rendered).toContain('basis: snapshot /iteration/status = "needs_approval"');
  expect(rendered).toContain("basis: iteration i-0000");
  // D-0032 rule 6, and rule 4's consequence computed from `kind`.
  expect(rendered).toContain("nobody has answered this yet");
  expect(rendered).toContain("what answering forecloses:");
  // The line that says how to answer it, which is what makes the screen
  // answerable rather than merely readable.
  expect(rendered).toContain("Next: rondo decide --proposal-id p-0001");
  expect(rendered).toContain(`contract: sha256:${"a".repeat(64)}`);
  expect(rendered).toContain("an approval is spendable once");
});

test("showing one proposal twice counts one presentation", async () => {
  // D-0036 rule 1: a presentation is counted once per subject and not once per
  // render, so a proposal read five times before it is answered leaves the
  // ratio #40 asked for a count of subjects on both sides. The second write
  // stores nothing and reports success.
  const { store, record } = fresh();
  await record.recordProposal(storedProposal(storedOptions()));

  const shows = screen();
  const ports = {
    store,
    cadenzaRevision: "cadenza@abcdef0",
    record,
    now: () => 9_000,
    present: shows.present,
  };
  expect(await showProposal(ports, "p-0001")).toEqual({ kind: "shown" });
  expect(await showProposal(ports, "p-0001")).toEqual({ kind: "shown" });

  expect(await record.attentionBreakdown()).toEqual([
    { disposition: "presented", ruleName: null, count: 1 },
  ]);
});

test("a settled proposal says so, and an explanation says it cannot be answered", async () => {
  // Two screens that must not read like an open question: one the operator has
  // already answered (D-0032 rule 6), and one that binds nothing at all
  // (rule 5). A settled proposal rendered like an open one is the screen that
  // gets answered twice.
  const { store, record } = fresh();
  await record.recordProposal(storedProposal(storedOptions()));
  await record.recordComposition({
    compositionId: "c-0001",
    proposalId: "p-0001",
    contract: { grantee: "rondo/i-0001" },
    contractDigest: `sha256:${"a".repeat(64)}`,
    supersedesContractDigest: null,
    cadenzaRevision: "cadenza@abcdef0",
    composedAtMs: 6_000,
  });
  await record.recordDecision({
    decisionId: "d-0001",
    proposalId: "p-0001",
    outcome: "declined",
    approved: null,
    predecessor: null,
    actorId: "oidc|operator-1",
    recordedBy: COMMAND_LINE_SURFACE,
    gateId: null,
    gateTransitionSeq: null,
    decidedAtMs: 7_000,
  });
  await record.recordProposal({
    ...storedProposal({ claims: [] }),
    proposalId: "p-0002",
    kind: "explanation",
    derivation: "store_rows",
  });

  const settled = screen();
  await showProposal(
    {
      store,
      cadenzaRevision: "cadenza@abcdef0",
      record,
      now: () => 9_000,
      present: settled.present,
    },
    "p-0001",
  );
  const binding = screen();
  await showProposal(
    {
      store,
      cadenzaRevision: "cadenza@abcdef0",
      record,
      now: () => 9_000,
      present: binding.present,
    },
    "p-0002",
  );

  expect(settled.shown.join("\n")).toContain("declined by 'oidc|operator-1'");
  expect(settled.shown.join("\n")).toContain("it is settled");
  // No "Next:" on a settled proposal: it would invite a second answer the
  // store refuses, after the person has already decided.
  expect(settled.shown.join("\n")).not.toContain("Next:");
  expect(binding.shown.join("\n")).toContain("cannot be answered");
});

test("a proposal that is not there, and one that will not read, are refusals", async () => {
  // The whole subject is one row here, so half a proposal is the failure mode
  // rather than the fallback: a person is about to approve one of its options.
  const { connection, store, record } = fresh();
  await record.recordProposal(storedProposal(storedOptions()));
  connection.prepare("UPDATE proposal SET snapshot = ? WHERE proposal_id = ?").run("{}", "p-0001");

  const shows = screen();
  const ports = {
    store,
    cadenzaRevision: "cadenza@abcdef0",
    record,
    now: () => 9_000,
    present: shows.present,
  };

  expect(await showProposal(ports, "p-9999")).toEqual({
    kind: "refused",
    reason: "there is no proposal 'p-9999'",
  });
  const unreadable = await showProposal(ports, "p-0001");
  expect(unreadable.kind).toBe("refused");
  expect(shows.shown).toEqual([]);
});

test("a payload rondo cannot place is on the screen saying so", async () => {
  // D-0032 rule 2's closure, from the reader's side: a basis form outside the
  // union is refused rather than rendered as prose. The screen says the payload
  // will not read, because an operator who asked to see a proposal and got a
  // clean empty screen would read it as "there is nothing to decide".
  const { store, record } = fresh();
  await record.recordProposal(
    storedProposal({
      options: [{ label: "widen", value: "sha256:x", basis: { form: "because I said so" } }],
      recommended: 0,
    }),
  );

  const shows = screen();
  await showProposal(
    { store, cadenzaRevision: "cadenza@abcdef0", record, now: () => 9_000, present: shows.present },
    "p-0001",
  );

  expect(shows.shown.join("\n")).toContain("will not read");
  expect(shows.shown.join("\n")).toContain("not one of");
});

test("two answers against one proposal are both on the screen, with the count", async () => {
  // The schema permits it -- `human_decision` is unique over a continuo gate
  // transition and not over `proposal_id` -- and nothing here can rank two
  // answers, because D-0022 rule 9 counts issuances per decision. So both are
  // shown and the number is said out loud, rather than the screen picking one.
  const { store, record } = fresh();
  await record.recordProposal(storedProposal(storedOptions()));
  await record.recordComposition({
    compositionId: "c-0001",
    proposalId: "p-0001",
    contract: { grantee: "rondo/i-0001" },
    contractDigest: `sha256:${"a".repeat(64)}`,
    supersedesContractDigest: null,
    cadenzaRevision: "cadenza@abcdef0",
    composedAtMs: 6_000,
  });
  const answer = {
    proposalId: "p-0001",
    predecessor: null,
    actorId: "oidc|operator-1",
    recordedBy: COMMAND_LINE_SURFACE,
    gateId: null,
    gateTransitionSeq: null,
  };
  await record.recordDecision({
    ...answer,
    decisionId: "d-0001",
    outcome: "declined",
    approved: null,
    decidedAtMs: 7_000,
  });
  await record.recordDecision({
    ...answer,
    decisionId: "d-0002",
    outcome: "approved",
    approved: `sha256:${"a".repeat(64)}`,
    decidedAtMs: 8_000,
  });

  const shows = screen();
  await showProposal(
    { store, cadenzaRevision: "cadenza@abcdef0", record, now: () => 9_000, present: shows.present },
    "p-0001",
  );

  const rendered = shows.shown.join("\n");
  expect(rendered).toContain("declined by 'oidc|operator-1' as decision 'd-0001'");
  expect(rendered).toContain("approved by 'oidc|operator-1' as decision 'd-0002'");
  expect(rendered).toContain("2 answers were recorded against this proposal");
  expect(rendered).not.toContain("Next:");
});
