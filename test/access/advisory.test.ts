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
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import { explainIteration } from "../../src/access/advisory.js";
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
