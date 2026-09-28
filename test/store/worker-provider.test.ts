/**
 * rondo#462: the provider a request chose, on the row and in the wait.
 *
 * Against a real `node:sqlite`, for `ledger.test.ts`'s reason: every claim here
 * is a claim about what one transaction wrote and what a migration did to a
 * database written before the column existed, and a fake store would agree with
 * whatever the code happened to do.
 *
 * Four groups, and each is a sentence the feature would be untrue without:
 *
 *  1. **It lands on the row and reads back.** With the observed-red control
 *     beside it -- a reservation that named none reads null -- so the group
 *     cannot pass against a store that writes one provider for everybody.
 *  2. **A successor inherits it, and naming one wins.** This is the half that
 *     makes "the choice is the request's" true across a revise or a retry: a
 *     successor that re-defaulted would move the work onto another worker part
 *     way through a request nobody asked to move.
 *  3. **It is written at reservation and by nothing afterwards**, which is the
 *     whole of the person's answer that the provider may be changed only before
 *     the work starts.
 *  4. **A database written before the column opens, and its rows read null**,
 *     which is what makes null "the person did not choose" rather than a
 *     failure to read.
 *
 * The wait's half (`held_start`) is here too: the tick that starts a held press
 * again builds its input out of that row, so a row that lost the choice would
 * silently run the work on the host's default.
 */
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import type { HostPolicy } from "../../src/refrain/policy.js";
import { planDigest } from "../../src/store/plan.js";
import type { JsonRecord } from "../../src/store/records.js";
import { laneFor } from "../lane-claims.js";
import { REQUEST, storeWithRequest } from "../request-fixture.js";

const somePlan = (): JsonRecord => ({
  run_id: "r-0001",
  repository: "/srv/repo",
  turn_timeout_ms: 900_000,
});

const BOUNDS: HostPolicy = { maxOccupying: 4, maxLive: 6 };

const storeUnder = (connection = new DatabaseSync(":memory:")) => ({
  store: storeWithRequest(connection, BOUNDS),
  connection,
});

const reserveOne = async (
  store: ReturnType<typeof storeUnder>["store"],
  id: string,
  workerProvider: string | null | undefined,
  supersedesIterationId: string | null = null,
) =>
  store.reserve({
    numbers: null,
    id,
    request: `do ${id}`,
    plan: somePlan(),
    runId: `rondo-${id}`,
    topicBranch: `rondo/${id}`,
    workspace: `/srv/work/iter-${id}`,
    supersedesIterationId,
    requestMessageId: REQUEST,
    spend: null,
    scopeSpend: null,
    claim: laneFor(id, supersedesIterationId),
    nowMs: 1_000,
    ...(workerProvider === undefined ? {} : { workerProvider }),
  });

/** The provider on a row, read back through the record the page and the loop read. */
const providerOf = async (
  store: ReturnType<typeof storeUnder>["store"],
  id: string,
): Promise<string | null> => {
  const read = await store.read(id);
  if (read.kind !== "read") {
    throw new Error(`iteration '${id}' did not read: ${read.kind}`);
  }
  return read.record.workerProvider;
};

// ---------------------------------------------------------------------------
// 1. It lands on the row and reads back.
// ---------------------------------------------------------------------------

test("a reservation that named a provider reads it back, and one that named none reads null", async () => {
  const { store } = storeUnder();
  expect((await reserveOne(store, "chose", "codex")).kind).toBe("reserved");
  expect(await providerOf(store, "chose")).toBe("codex");

  // The observed-red control: without it the case above passes against a store
  // that writes `codex` onto every row it reserves.
  expect((await reserveOne(store, "silent", null)).kind).toBe("reserved");
  expect(await providerOf(store, "silent")).toBeNull();

  // A caller with nothing to say says nothing, and that is the same silence.
  expect((await reserveOne(store, "absent", undefined)).kind).toBe("reserved");
  expect(await providerOf(store, "absent")).toBeNull();
});

test("the provider is on the live reading too, so a running lap shows what it runs on", async () => {
  const { store } = storeUnder();
  expect((await reserveOne(store, "live", "codex")).kind).toBe("reserved");
  const live = await store.readLive();
  expect(
    live.map((read) => (read.kind === "read" ? [read.record.id, read.record.workerProvider] : read)),
  ).toEqual([["live", "codex"]]);
});

// ---------------------------------------------------------------------------
// 2. A successor inherits it, and naming one wins.
// ---------------------------------------------------------------------------

test("a successor that names no provider inherits its predecessor's, and one that names a provider keeps it", async () => {
  const { store } = storeUnder();
  expect((await reserveOne(store, "first", "codex")).kind).toBe("reserved");

  // A revise or a retry continues the same request, so it continues the choice.
  expect((await reserveOne(store, "second", null, "first")).kind).toBe("reserved");
  expect(await providerOf(store, "second")).toBe("codex");
  // Two deep: the inheritance is off the predecessor's row, so it carries.
  expect((await reserveOne(store, "third", undefined, "second")).kind).toBe("reserved");
  expect(await providerOf(store, "third")).toBe("codex");

  // And a re-lap may be put on the other provider on purpose.
  expect((await reserveOne(store, "moved", "claude", "third")).kind).toBe("reserved");
  expect(await providerOf(store, "moved")).toBe("claude");
});

test("a successor of a lap that chose nothing chooses nothing: inheriting is not inventing a default", async () => {
  const { store } = storeUnder();
  expect((await reserveOne(store, "plain", null)).kind).toBe("reserved");
  expect((await reserveOne(store, "again", null, "plain")).kind).toBe("reserved");
  expect(await providerOf(store, "again")).toBeNull();
});

// ---------------------------------------------------------------------------
// 3. Written at reservation and by nothing afterwards.
// ---------------------------------------------------------------------------

test("no transition can move a running lap onto another provider", async () => {
  const { store } = storeUnder();
  expect((await reserveOne(store, "fixed", "codex")).kind).toBe("reserved");
  // The fields a transition may write are `IterationFields`, which omits it:
  // this is the type-level rule asserted as behaviour, through the one door a
  // caller has. A cast, because a caller that could write it would not compile.
  await store.transition("fixed", "classified", {
    workerProvider: "claude",
  } as unknown as Parameters<typeof store.transition>[2]);
  expect(await providerOf(store, "fixed")).toBe("codex");
});

// ---------------------------------------------------------------------------
// 4. A database written before the column.
// ---------------------------------------------------------------------------

test("a database written before the column gains it, and the rows already there read null", async () => {
  const connection = new DatabaseSync(":memory:");
  // The shape this migration exists for: the iteration table without
  // `worker_provider`, with a row in it.
  connection.exec(`
    CREATE TABLE iteration (
      id TEXT PRIMARY KEY, status TEXT NOT NULL, request TEXT NOT NULL, plan TEXT NOT NULL,
      plan_digest TEXT NOT NULL, attempts INTEGER NOT NULL, run_id TEXT,
      request_message_id TEXT, continuo_revision TEXT,
      agent_type_digest TEXT, config_digest TEXT, contract_digest TEXT, classification TEXT,
      classification_reason TEXT, neutral_role_name TEXT, continuo_role TEXT, model_tier TEXT,
      model TEXT, gate_id TEXT, gate_stage TEXT, gate_outcome TEXT, session_id TEXT,
      session_path TEXT, reason TEXT, created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL,
      live INTEGER GENERATED ALWAYS AS (
        CASE WHEN status IN ('closed','abandoned','failed') THEN NULL ELSE 1 END) VIRTUAL
    );
  `);
  connection
    .prepare(
      "INSERT INTO iteration (id, status, request, plan, plan_digest, attempts, " +
        "request_message_id, created_at_ms, updated_at_ms) " +
        `VALUES ('old', 'awaiting_human', 'ask', '{}', '${planDigest({})}', 1, 'req-fixture', 1, 1)`,
    )
    .run();

  const { store } = storeUnder(connection);
  const columns = new Set(
    (
      connection
        .prepare("SELECT name FROM pragma_table_xinfo('iteration')")
        .all() as unknown as readonly { readonly name: string }[]
    ).map((row) => row.name),
  );
  expect(columns.has("worker_provider"), "the migration did not add 'worker_provider'").toBe(true);
  // Null is "nobody chose", which for a row written before anybody could is
  // the truth about it -- and it reads rather than failing the select list.
  expect(await providerOf(store, "old")).toBeNull();
  // And the migrated database still writes a choice.
  expect((await reserveOne(store, "after", "codex")).kind).toBe("reserved");
  expect(await providerOf(store, "after")).toBe("codex");
});

// ---------------------------------------------------------------------------
// The wait's half: a held start keeps the choice the press made.
// ---------------------------------------------------------------------------

test("a held start keeps the provider its press chose, and one that chose none keeps null", async () => {
  const { store } = storeUnder();
  const held = (iterationId: string, workerProvider: string | null) => ({
    iterationId,
    requestMessageId: "r1",
    scopeDecisionId: "decision-1",
    planDigest: `sha256:${iterationId}`,
    repository: "/srv/repo",
    heldAtMs: 1_000,
    workerProvider,
  });

  expect(await store.recordHeldStart(held("lap-codex", "codex"))).toBe(true);
  expect(await store.recordHeldStart(held("lap-plain", null))).toBe(true);
  expect(
    (await store.heldStarts()).map((one) => [one.iterationId, one.workerProvider ?? null]),
  ).toEqual([
    ["lap-codex", "codex"],
    ["lap-plain", null],
  ]);
});

test("a database written before the wait carried a provider gains the column", async () => {
  const connection = new DatabaseSync(":memory:");
  connection.exec(`
    CREATE TABLE held_start (
      iteration_id TEXT PRIMARY KEY, request_message_id TEXT NOT NULL,
      scope_decision_id TEXT NOT NULL, plan_digest TEXT NOT NULL, repository TEXT NOT NULL,
      held_at_ms INTEGER NOT NULL, settled_at_ms INTEGER, outcome TEXT
    );
    INSERT INTO held_start (iteration_id, request_message_id, scope_decision_id, plan_digest,
      repository, held_at_ms) VALUES ('lap-old', 'r1', 'decision-1', 'sha256:p', '/srv/repo', 1);
  `);
  const { store } = storeUnder(connection);
  expect((await store.heldStarts()).map((one) => one.workerProvider ?? null)).toEqual([null]);
});
