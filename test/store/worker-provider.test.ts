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
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import { ThreadSide } from "../../src/access/page/thread-side.js";
import { governanceOf } from "../../src/access/page-logic/governance.js";
import { EN } from "../../src/access/wording.js";
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
  /**
   * The worker this host runs when the request chooses none, as the
   * composition root resolved it at the start (rondo#462). Absent in the cases
   * that are about the choice itself, which is what leaves the row's provider
   * null there.
   */
  hostWorkerProvider: string | null | undefined = undefined,
) =>
  store.reserve({
    ...(hostWorkerProvider === undefined ? {} : { hostWorkerProvider }),
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
    live.map((read) =>
      read.kind === "read" ? [read.record.id, read.record.workerProvider] : read,
    ),
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
  // the type-level rule, asserted as behaviour through the one door a caller
  // has. A cast, because a caller that could name it would not compile.
  const named = await store.transition(
    "fixed",
    "planned",
    "classified",
    { workerProvider: "claude" } as unknown as Parameters<typeof store.transition>[3],
    2_000,
  );
  // The store has no column a transition could put it in, so it refuses rather
  // than writing it -- and the choice on the row is untouched.
  expect(named.kind).toBe("defect");
  expect(await providerOf(store, "fixed")).toBe("codex");

  // The observed-red control: the same edge with a field a transition *may*
  // write commits, so the refusal above is about the provider and not about a
  // transition this fixture could never make.
  const allowed = await store.transition(
    "fixed",
    "planned",
    "classified",
    { classification: "allowed" },
    2_000,
  );
  expect(allowed.kind).toBe("transitioned");
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

// ---------------------------------------------------------------------------
// 5. From the row to the thread: what a lap ran on stays what it ran on.
// ---------------------------------------------------------------------------

/**
 * The provider a lap ran on, as the thread's right face says it -- through the
 * real store, the page's own reading and the page's own markup, with nothing
 * injected between them (rondo#462, the gate's second point).
 *
 * `governanceOf` takes no host default now, which is the fix: there is no
 * argument by which the setting a host runs *today* could reach a line about a
 * lap that ran yesterday. This renders to markup rather than asserting on the
 * reading, so the claim is about what a person sees.
 */
const threadSays = async (
  store: ReturnType<typeof storeUnder>["store"],
  id: string,
): Promise<string> => {
  const read = await store.read(id);
  if (read.kind !== "read") {
    throw new Error(`iteration '${id}' did not read: ${read.kind}`);
  }
  return renderToStaticMarkup(
    ThreadSide({
      wording: EN,
      asking: false,
      material: null,
      governance: governanceOf(read.record, "o/r", 1_000, null, false, [], [read.record]),
      steps: [],
      parts: [],
    }),
  );
};

/** An apostrophe is an HTML entity by the time the sentence is markup. */
const said = (text: string) => text.replaceAll("'", "&#x27;");

test("a request that chose nothing records the host's default, and the thread names it as the default", async () => {
  const { store } = storeUnder();
  expect((await reserveOne(store, "plain", null, null, "claude")).kind).toBe("reserved");

  // The name is on the row, settled at the start -- not left for a screen to
  // derive from whatever the host is set to when the screen is drawn.
  expect(await providerOf(store, "plain")).toBe("claude");
  const drawn = await threadSays(store, "plain");
  expect(drawn).toContain(EN.workerProviderLabel);
  expect(drawn).toContain(said(EN.workerProviderRan("claude", false)));

  // And a chosen provider is drawn as the person's own, over the same default.
  expect((await reserveOne(store, "chosen", "codex", null, "claude")).kind).toBe("reserved");
  expect(await providerOf(store, "chosen")).toBe("codex");
  const chose = await threadSays(store, "chosen");
  expect(chose).toContain(said(EN.workerProviderRan("codex", true)));
  expect(chose).not.toContain("claude");
});

test("moving the host's default afterwards does not relabel a lap that already ran", async () => {
  // **The blocker this issue came back for.** The thread used to read the
  // host's current default for a request that chose none, so a host restarted
  // onto Codex restated every past Claude lap as a Codex one. The row settles
  // it at the start, so the second host below changes nothing a person reads.
  const { store } = storeUnder();
  expect((await reserveOne(store, "before", null, null, "claude")).kind).toBe("reserved");
  const first = await threadSays(store, "before");

  // The host's default moves. Nothing about the lap moved with it.
  expect((await reserveOne(store, "after", null, null, "codex")).kind).toBe("reserved");
  expect(await providerOf(store, "before")).toBe("claude");
  expect(await threadSays(store, "before")).toBe(first);
  expect(first).toContain(said(EN.workerProviderRan("claude", false)));
  // The observed-red control: the later lap does read the later default, so
  // the case above is not passing against a store that ignores the host.
  expect(await providerOf(store, "after")).toBe("codex");
});

test("a lap from before rondo recorded any of this is drawn as unknown, not as today's default", async () => {
  const { store } = storeUnder();
  expect((await reserveOne(store, "old", undefined)).kind).toBe("reserved");
  expect(await providerOf(store, "old")).toBeNull();

  const drawn = await threadSays(store, "old");
  expect(drawn).toContain(EN.workerProviderUnknown);
  expect(drawn).not.toContain(said(EN.workerProviderRan("claude", false)));
});

test("a successor inherits a choice and never a resolved default", async () => {
  const { store } = storeUnder();
  // A choice is the person's, for the request, so it carries across a revise.
  expect((await reserveOne(store, "chose", "codex", null, "claude")).kind).toBe("reserved");
  expect((await reserveOne(store, "again", null, "chose", "claude")).kind).toBe("reserved");
  expect(await providerOf(store, "again")).toBe("codex");

  // A default is a record of what one lap ran on rather than an instruction
  // about the next, so the successor resolves the host's default again -- and
  // the row still says it was the default and not a pick.
  expect((await reserveOne(store, "fell", null, null, "claude")).kind).toBe("reserved");
  expect((await reserveOne(store, "later", null, "fell", "codex")).kind).toBe("reserved");
  expect(await providerOf(store, "later")).toBe("codex");
  expect(await threadSays(store, "later")).toContain(said(EN.workerProviderRan("codex", false)));
});
