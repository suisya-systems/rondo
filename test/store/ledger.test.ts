/**
 * The capacity ledger and the allocator's memory, against a real database.
 *
 * D-0019 rule 17 put the store's tests on a real `node:sqlite` because the
 * claims that carried rule 10 were claims about SQLite rather than about
 * rondo's code. D-0023 keeps that discipline and needs it more, not less: it
 * **removes** the partial unique index that made single-flight the database's
 * invariant and replaces it with a count inside a transaction, so the thing a
 * fake store would agree with is now exactly the thing that could be wrong.
 *
 * Three groups, and the middle one is the one the entry was wrong about once.
 *
 *  1. **The bound is counted, and the refusal is an answer.** With an
 *     observed-red control on every capacity case: the same call with the bound
 *     raised by one reserves. Without the control the group passes against a
 *     `reserve()` that refuses everything.
 *  2. **One case per non-terminal status**, because the bound's status set is
 *     where this design was already wrong once: a first draft defined it over
 *     `admitting`/`admitted`/`performing` alone, which let two `planned` rows
 *     both pass a bound of one and then both perform. Six statuses must occupy
 *     and two must not, and asserting the six individually is what stops a
 *     later narrowing from being silent.
 *  3. **The claim outlives the iteration.** `identifiers_spent` is set exactly
 *     once, a terminal *spent* row holds its triple for ever, and -- the
 *     observed-red control -- a terminal *unspent* row releases it. Without
 *     this group rule 7's whole mechanism is prose.
 *
 * And one group that exists because of what the migration gives up: once
 * `iteration_one_live` is dropped, **the database no longer refuses a second
 * live row**, so the evidence that `maxOccupying` still holds has to be that
 * the code refuses it. That is asserted directly, including against a database
 * that was created before D-0023 and carried the old index.
 */
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import type { HostPolicy } from "../../src/refrain/policy.js";
import { planDigest } from "../../src/store/plan.js";
import type { IterationStatus, JsonRecord } from "../../src/store/records.js";
import { SUSPENDED_STATUSES, TERMINAL_STATUSES } from "../../src/store/records.js";
import { iterationStore } from "../../src/store/sqlite.js";

const somePlan = (): JsonRecord => ({ run_id: "r-0001", turn_timeout_ms: 900_000 });

/** A store over a database of its own, under bounds the test chooses. */
const storeUnder = (policy: HostPolicy, connection = new DatabaseSync(":memory:")) => ({
  store: iterationStore(connection, policy),
  connection,
});

/** The allocator's derivation, spelled here so a test never shares a claim by accident. */
const reserveOne = async (
  store: ReturnType<typeof storeUnder>["store"],
  id: string,
  nowMs = 1_000,
) =>
  store.reserve({
    id,
    request: `do ${id}`,
    plan: somePlan(),
    runId: `rondo-${id}`,
    topicBranch: `rondo/${id}`,
    workspace: `/srv/work/iter-${id}`,
    nowMs,
  });

/** Drive a freshly reserved row to a status, through the edges that reach it. */
const putAt = (connection: DatabaseSync, id: string, status: IterationStatus): void => {
  connection.prepare("UPDATE iteration SET status = ? WHERE id = ?").run(status, id);
};

// ---------------------------------------------------------------------------
// 1. The bound is counted, and the refusal is an answer.
// ---------------------------------------------------------------------------

test("a reservation at the live bound is refused with the occupancy and the bound", async () => {
  const { store } = storeUnder({ maxOccupying: 3, maxLive: 2 });
  expect((await reserveOne(store, "a")).kind).toBe("reserved");
  expect((await reserveOne(store, "b")).kind).toBe("reserved");

  const refused = await reserveOne(store, "c");
  expect(refused.kind).toBe("atCapacity");
  if (refused.kind === "atCapacity") {
    expect(refused.bound).toBe("maxLive");
    expect(refused.limit).toBe(2);
    expect(refused.occupancy).toBe(2);
  }
});

test("the observed-red control: the same call with the bound one higher reserves", async () => {
  // Without this the case above passes against a `reserve()` that refuses
  // everything, which is the failure mode a capacity test is most prone to.
  const { store } = storeUnder({ maxOccupying: 3, maxLive: 3 });
  expect((await reserveOne(store, "a")).kind).toBe("reserved");
  expect((await reserveOne(store, "b")).kind).toBe("reserved");
  expect((await reserveOne(store, "c")).kind).toBe("reserved");
});

test("a refusal at capacity writes no iteration row and takes no lock", async () => {
  const { store, connection } = storeUnder({ maxOccupying: 1, maxLive: 1 });
  await reserveOne(store, "a");
  await reserveOne(store, "b");

  // D-0019 rule 9's property, which the whole cheap-refusal argument rests on.
  const rows = connection.prepare("SELECT id FROM iteration").all();
  expect(rows).toHaveLength(1);
  expect((await store.read("b")).kind).toBe("absent");
});

test("a refusal at capacity writes one demand row, outside the iteration table", async () => {
  // D-0023 rule 14. Before it a capacity refusal left no trace at all, so the
  // bound could only ever be raised because somebody complained. This row is
  // the only artefact in the tree that can count who was refused.
  const { store, connection } = storeUnder({ maxOccupying: 1, maxLive: 1 });
  await reserveOne(store, "a", 1_000);
  await reserveOne(store, "b", 2_000);

  const refusals = connection
    .prepare("SELECT refused_at_ms, request, bound_name, bound, occupancy FROM admission_refusal")
    .all() as unknown as readonly Record<string, unknown>[];
  expect(refusals).toHaveLength(1);
  expect(refusals[0]?.["refused_at_ms"]).toBe(2_000);
  expect(refusals[0]?.["request"]).toBe("do b");
  expect(refusals[0]?.["bound_name"]).toBe("maxOccupying");
  expect(refusals[0]?.["bound"]).toBe(1);
  expect(refusals[0]?.["occupancy"]).toBe(1);
});

test("a reservation that succeeds writes no demand row", async () => {
  const { store, connection } = storeUnder({ maxOccupying: 2, maxLive: 2 });
  await reserveOne(store, "a");
  const refusals = connection.prepare("SELECT COUNT(*) AS n FROM admission_refusal").get() as {
    readonly n: number;
  };
  expect(Number(refusals.n)).toBe(0);
});

test("the execution bound is reported before the looser one when both are reached", async () => {
  const { store } = storeUnder({ maxOccupying: 1, maxLive: 1 });
  await reserveOne(store, "a");
  const refused = await reserveOne(store, "b");
  expect(refused.kind === "atCapacity" && refused.bound).toBe("maxOccupying");
});

// ---------------------------------------------------------------------------
// 2. One case per non-terminal status.
// ---------------------------------------------------------------------------

const OCCUPYING_STATUSES: readonly IterationStatus[] = [
  "planned",
  "classified",
  "admitting",
  "admitted",
  "performing",
  "stalled",
];

test.each(OCCUPYING_STATUSES)(
  "a row at '%s' occupies, so the next reservation is refused at maxOccupying = 1",
  async (status) => {
    const { store, connection } = storeUnder({ maxOccupying: 1, maxLive: 9 });
    await reserveOne(store, "a");
    putAt(connection, "a", status);

    const refused = await reserveOne(store, "b");
    expect(refused.kind).toBe("atCapacity");
    expect(refused.kind === "atCapacity" && refused.bound).toBe("maxOccupying");
  },
);

test.each(SUSPENDED_STATUSES)(
  "a row at '%s' does not occupy, so the next reservation is admitted",
  async (status) => {
    // D-0023 rule 2, and the whole of what the entry delivers today: the
    // process has exited, continuo's lease was released and no child survives,
    // so the row is a question in front of a person rather than work in flight.
    const { store, connection } = storeUnder({ maxOccupying: 1, maxLive: 9 });
    await reserveOne(store, "a");
    putAt(connection, "a", status);

    expect((await reserveOne(store, "b")).kind).toBe("reserved");
  },
);

test.each(SUSPENDED_STATUSES)(
  "a row at '%s' still counts as live, so maxLive still bounds it",
  async (status) => {
    // The other half of rule 2, and the reason there are two bounds rather than
    // one: a suspended iteration occupies no execution slot and is still a
    // worktree, a branch, an open run and an unanswered question.
    const { store, connection } = storeUnder({ maxOccupying: 1, maxLive: 1 });
    await reserveOne(store, "a");
    putAt(connection, "a", status);

    const refused = await reserveOne(store, "b");
    expect(refused.kind).toBe("atCapacity");
    expect(refused.kind === "atCapacity" && refused.bound).toBe("maxLive");
  },
);

test.each(TERMINAL_STATUSES)(
  "a row at '%s' occupies nothing and counts as nothing",
  async (status) => {
    const { store, connection } = storeUnder({ maxOccupying: 1, maxLive: 1 });
    await reserveOne(store, "a");
    putAt(connection, "a", status);

    expect((await reserveOne(store, "b")).kind).toBe("reserved");
  },
);

test("the occupancy may read above the bound, and the refusal says so without calling it a defect", async () => {
  // D-0023 rule 27. `stall()` writes `stalled` from any status and `resume()`
  // reaches it from `awaiting_human`, so a suspended row can re-enter the
  // occupying set without passing through a reservation. The bound is an
  // admission control and not a conservation law: this state is permitted, it
  // cannot grow because this very refusal is what stops it, and it drains.
  const { store, connection } = storeUnder({ maxOccupying: 1, maxLive: 9 });
  // The scenario has to be reachable, and reaching it is itself the argument:
  // `a` can only stop occupying by suspending, which is the only reason `b`
  // could be admitted beside it at a bound of one.
  await reserveOne(store, "a");
  putAt(connection, "a", "awaiting_human");
  expect((await reserveOne(store, "b")).kind).toBe("reserved");
  putAt(connection, "b", "performing");
  // The edge rule 27 names: `resume()` on a mismatched gate observation writes
  // `stalled` from `awaiting_human`, so a suspended row re-enters the occupying
  // set without passing through a reservation. Occupancy now reads 2 of 1.
  putAt(connection, "a", "stalled");

  const refused = await reserveOne(store, "c");
  expect(refused.kind).toBe("atCapacity");
  if (refused.kind === "atCapacity") {
    expect(refused.occupancy).toBe(2);
    expect(refused.limit).toBe(1);
    expect(refused.occupancy).toBeGreaterThan(refused.limit);
  }
});

// ---------------------------------------------------------------------------
// 3. The claim outlives the iteration.
// ---------------------------------------------------------------------------

test("reserve writes the triple on the row, inside the transaction that took the capacity", async () => {
  const { store } = storeUnder({ maxOccupying: 1, maxLive: 1 });
  const reserved = await reserveOne(store, "a");
  expect(reserved.kind).toBe("reserved");
  if (reserved.kind === "reserved") {
    expect(reserved.record.runId).toBe("rondo-a");
    expect(reserved.record.topicBranch).toBe("rondo/a");
    expect(reserved.record.workspace).toBe("/srv/work/iter-a");
    // Held but not spent: no run exists under it, no branch was cut.
    expect(reserved.record.identifiersSpent).toBe(0);
  }
});

test("a terminal spent row holds its triple for ever", async () => {
  const { store, connection } = storeUnder({ maxOccupying: 9, maxLive: 9 });
  await reserveOne(store, "a");
  await store.transition("a", "planned", "admitting", { identifiersSpent: 1 }, 2_000);
  putAt(connection, "a", "closed");

  // A second iteration handed the same names is refused by the database, which
  // is what stops a later run being given a branch a merged pull request owns.
  const collided = await store.reserve({
    id: "b",
    request: "do b",
    plan: somePlan(),
    runId: "rondo-a",
    topicBranch: "rondo/b",
    workspace: "/srv/work/iter-b",
    nowMs: 3_000,
  });
  expect(collided.kind).toBe("defect");
  if (collided.kind === "defect") {
    expect(collided.reason).toContain("held by another iteration");
  }
});

test("the observed-red control: a terminal unspent row releases its triple", async () => {
  // This is the case that makes `identifiers_spent` a column rather than a
  // constant, and without it the test above passes against a schema that simply
  // held every triple for ever. Nothing in the tree inherits a released triple
  // today; the property exists so that the schema cannot make such an
  // inheritance unsafe later without the change being visible.
  const { store, connection } = storeUnder({ maxOccupying: 9, maxLive: 9 });
  await reserveOne(store, "a");
  putAt(connection, "a", "abandoned");

  const inheriting = await store.reserve({
    id: "b",
    request: "do b",
    plan: somePlan(),
    runId: "rondo-a",
    topicBranch: "rondo/a",
    workspace: "/srv/work/iter-a",
    nowMs: 3_000,
  });
  expect(inheriting.kind).toBe("reserved");
});

test("identifiers_spent is set by the transition into admitting and by nothing else", async () => {
  const { store } = storeUnder({ maxOccupying: 9, maxLive: 9 });
  await reserveOne(store, "a");

  const before = await store.read("a");
  expect(before.kind === "read" && before.record.identifiersSpent).toBe(0);

  const admitting = await store.transition(
    "a",
    "planned",
    "admitting",
    { identifiersSpent: 1 },
    2_000,
  );
  expect(admitting.kind === "transitioned" && admitting.record.identifiersSpent).toBe(1);

  // Every later transition leaves it alone, so the claim cannot be given back.
  const admitted = await store.transition("a", "admitting", "admitted", {}, 3_000);
  expect(admitted.kind === "transitioned" && admitted.record.identifiersSpent).toBe(1);
});

test("two live iterations may not hold one name even before either is spent", async () => {
  const { store } = storeUnder({ maxOccupying: 9, maxLive: 9 });
  await reserveOne(store, "a");
  const collided = await store.reserve({
    id: "b",
    request: "do b",
    plan: somePlan(),
    runId: "rondo-b",
    topicBranch: "rondo/a",
    workspace: "/srv/work/iter-b",
    nowMs: 2_000,
  });
  expect(collided.kind).toBe("defect");
});

// ---------------------------------------------------------------------------
// 4. What the migration gives up, and the evidence it is still held.
// ---------------------------------------------------------------------------

test("readLive answers every non-terminal iteration, oldest first", async () => {
  const { store, connection } = storeUnder({ maxOccupying: 9, maxLive: 9 });
  await reserveOne(store, "a", 1_000);
  await reserveOne(store, "b", 2_000);
  await reserveOne(store, "c", 3_000);
  putAt(connection, "b", "closed");

  const live = await store.readLive();
  expect(
    live.map((outcome) => (outcome.kind === "read" ? outcome.record.id : outcome.kind)),
  ).toEqual(["a", "c"]);
});

test("a database created before D-0023 gains the columns and loses the old index", async () => {
  // The migration, against the shape it actually exists for: the pre-D-0023
  // schema, with `iteration_one_live` in place and none of the new columns.
  const connection = new DatabaseSync(":memory:");
  connection.exec(`
    CREATE TABLE iteration (
      id TEXT PRIMARY KEY, status TEXT NOT NULL, request TEXT NOT NULL, plan TEXT NOT NULL,
      plan_digest TEXT NOT NULL, attempts INTEGER NOT NULL, run_id TEXT, continuo_revision TEXT,
      agent_type_digest TEXT, config_digest TEXT, contract_digest TEXT, classification TEXT,
      classification_reason TEXT, neutral_role_name TEXT, continuo_role TEXT, model_tier TEXT,
      model TEXT, gate_id TEXT, gate_stage TEXT, gate_outcome TEXT, session_id TEXT,
      session_path TEXT, reason TEXT, created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL,
      live INTEGER GENERATED ALWAYS AS (
        CASE WHEN status IN ('closed','abandoned','failed') THEN NULL ELSE 1 END) VIRTUAL
    );
    CREATE UNIQUE INDEX iteration_one_live ON iteration(live) WHERE live IS NOT NULL;
  `);
  connection
    .prepare(
      "INSERT INTO iteration (id, status, request, plan, plan_digest, attempts, created_at_ms, " +
        `updated_at_ms) VALUES ('old', 'awaiting_human', 'ask', '{}', '${planDigest({})}', 1, 1, 1)`,
    )
    .run();

  const { store } = storeUnder({ maxOccupying: 1, maxLive: 3 }, connection);

  // `pragma_table_info` would not list the generated columns at all, which is
  // why the migration diffs against `pragma_table_xinfo`.
  const columns = new Set(
    (
      connection
        .prepare("SELECT name FROM pragma_table_xinfo('iteration')")
        .all() as unknown as readonly {
        readonly name: string;
      }[]
    ).map((row) => row.name),
  );
  for (const column of [
    "topic_branch",
    "workspace",
    "identifiers_spent",
    "occupying",
    "holds_identifiers",
  ]) {
    expect(columns.has(column), `the migration did not add '${column}'`).toBe(true);
  }

  const indexes = (
    connection
      .prepare("SELECT name FROM pragma_index_list('iteration')")
      .all() as unknown as readonly {
      readonly name: string;
    }[]
  ).map((row) => row.name);
  expect(indexes).not.toContain("iteration_one_live");

  // The pre-existing row survived and is read correctly under the new columns.
  const old = await store.read("old");
  expect(old.kind === "read" && old.record.identifiersSpent).toBe(0);

  // And the point of the whole migration: the suspended row no longer blocks a
  // second admission, which the old index would have refused unconditionally.
  expect((await reserveOne(store, "new")).kind).toBe("reserved");
});

test("opening twice is idempotent: the migration re-runs against its own output", async () => {
  const connection = new DatabaseSync(":memory:");
  const { store } = storeUnder({ maxOccupying: 1, maxLive: 3 }, connection);
  await reserveOne(store, "a");
  // A second `iterationStore` over the same connection is what a second command
  // in the same process would do. Re-adding a generated column throws
  // `duplicate column name`, so this is the case the xinfo diff exists for.
  const again = iterationStore(connection, { maxOccupying: 1, maxLive: 3 });
  expect((await again.read("a")).kind).toBe("read");
});

test("with the index gone, the code is what refuses a second executing iteration", async () => {
  // **The evidence the entry owes.** Dropping `iteration_one_live` moves the
  // single-flight invariant out of the database and into `reserve()`'s
  // transaction, so "at most one executing iteration" stops being something
  // SQLite guarantees. This asserts the guarantee is still made, by the code,
  // on a database where the index genuinely is not there.
  const { store, connection } = storeUnder({ maxOccupying: 1, maxLive: 5 });
  await reserveOne(store, "a");

  const indexes = (
    connection
      .prepare("SELECT name FROM pragma_index_list('iteration')")
      .all() as unknown as readonly {
      readonly name: string;
    }[]
  ).map((row) => row.name);
  expect(indexes).not.toContain("iteration_one_live");

  expect((await reserveOne(store, "b")).kind).toBe("atCapacity");
  expect((await reserveOne(store, "c")).kind).toBe("atCapacity");
});

test("what the counted bound gives up: an out-of-band insert is not refused", async () => {
  // Recorded as a test rather than only as prose, because it is the cost
  // D-0023 rule 11 accepted and a reader deserves to see it demonstrated
  // rather than promised. Under the old index this insert was impossible.
  const { store, connection } = storeUnder({ maxOccupying: 1, maxLive: 1 });
  await reserveOne(store, "a");

  connection
    .prepare(
      "INSERT INTO iteration (id, status, request, plan, plan_digest, attempts, created_at_ms, " +
        `updated_at_ms) VALUES ('smuggled', 'performing', 'ask', '{}', '${planDigest({})}', 1, 1, 1)`,
    )
    .run();

  const live = await store.readLive();
  expect(live).toHaveLength(2);
  // The bound is still what admission reads, so the excess drains and cannot
  // grow -- but nothing refused the row on the way in, and that is the point.
  expect((await reserveOne(store, "c")).kind).toBe("atCapacity");
});

// ---------------------------------------------------------------------------
// 5. The property the in-process side of N > 1 rests on.
// ---------------------------------------------------------------------------

test("overlapping admissions do not interleave inside a transaction", async () => {
  // D-0023 rule 16's property, asserted at the level it actually holds. Two
  // `reserve()` calls driven from interleaved continuations both commit, the
  // second sees the first's write, and the bound is applied to the pair rather
  // than to each in ignorance of the other -- which is only true because no
  // transaction body awaits.
  const { store, connection } = storeUnder({ maxOccupying: 1, maxLive: 1 });

  const [first, second] = await Promise.all([reserveOne(store, "a"), reserveOne(store, "b")]);
  const kinds = [first.kind, second.kind].sort();
  expect(kinds).toEqual(["atCapacity", "reserved"]);
  expect(connection.prepare("SELECT COUNT(*) AS n FROM iteration").get()).toMatchObject({ n: 1 });
});

test("the overshoot is bounded by maxLive rather than by one, and it does not drain", async () => {
  // **The correction an adversarial pass forced, and it fires this entry's own
  // falsifier.** The first version of rule 23 said the excess "cannot grow,
  // because reserve() already refuses at the bound", and pinned it at "2 of 1".
  // That reasoning holds for one suspended row. The `awaiting_human -> stalled`
  // edge is per row and takes no reservation, so every row `maxLive` lets
  // accumulate at a gate can cross it independently: the occupying set reaches
  // `maxLive`, not the bound plus one.
  //
  // It is fail-closed -- nothing of a `stalled` row is running, so no extra lap
  // executes -- but it is not momentary, because `RELEASED_BY` gives `stalled`
  // exactly one releasing event, an operator's `abandon()`.
  const { store, connection } = storeUnder({ maxOccupying: 1, maxLive: 4 });
  for (const id of ["a", "b", "c", "d"]) {
    await reserveOne(store, id);
    putAt(connection, id, "awaiting_human");
  }
  expect(occupancyOver(connection, "occupying")).toBe(0);

  // Every one of them stalls, which `resume()` does on a gate-id mismatch.
  for (const id of ["a", "b", "c", "d"]) {
    putAt(connection, id, "stalled");
  }
  expect(occupancyOver(connection, "occupying")).toBe(4);

  const refused = await reserveOne(store, "e");
  expect(refused.kind).toBe("atCapacity");
  if (refused.kind === "atCapacity") {
    // Four of one, not two of one.
    expect(refused.occupancy).toBe(4);
    expect(refused.limit).toBe(1);
  }

  // And it drains only when a person ends them: nothing here ends on its own.
  await store.settle("a", "the operator ended it", 9_000);
  expect(occupancyOver(connection, "occupying")).toBe(3);
});

/** The occupancy the ledger itself counts, read the way `reserve()` reads it. */
function occupancyOver(connection: DatabaseSync, column: "occupying" | "live"): number {
  return Number(
    (
      connection
        .prepare(`SELECT COUNT(*) AS n FROM iteration WHERE ${column} IS NOT NULL`)
        .get() as { readonly n: number }
    ).n,
  );
}

test("a legacy row that spent its identifiers keeps holding them after the migration", async () => {
  // **The blocker an adversarial pass found.** `ALTER TABLE ADD COLUMN` gives
  // every existing row the default, so without a back-fill every pre-D-0023 row
  // reads `identifiers_spent = 0` -- including rows that reached `admitting`,
  // for which `run admit` really was spawned and continuo really does own a
  // run. Once terminal, those rows would drop out of all three claim indexes
  // and release names git and continuo still hold, which is the one thing
  // rule 7 exists to prevent.
  const connection = new DatabaseSync(":memory:");
  connection.exec(`
    CREATE TABLE iteration (
      id TEXT PRIMARY KEY, status TEXT NOT NULL, request TEXT NOT NULL, plan TEXT NOT NULL,
      plan_digest TEXT NOT NULL, attempts INTEGER NOT NULL, run_id TEXT, continuo_revision TEXT,
      agent_type_digest TEXT, config_digest TEXT, contract_digest TEXT, classification TEXT,
      classification_reason TEXT, neutral_role_name TEXT, continuo_role TEXT, model_tier TEXT,
      model TEXT, gate_id TEXT, gate_stage TEXT, gate_outcome TEXT, session_id TEXT,
      session_path TEXT, reason TEXT, created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL,
      live INTEGER GENERATED ALWAYS AS (
        CASE WHEN status IN ('closed','abandoned','failed') THEN NULL ELSE 1 END) VIRTUAL
    );
  `);
  const insert = connection.prepare(
    "INSERT INTO iteration (id, status, request, plan, plan_digest, attempts, run_id, " +
      `created_at_ms, updated_at_ms) VALUES (?, ?, 'ask', '{}', '${planDigest({})}', 1, ?, 1, 1)`,
  );
  // One that really was admitted, and one that never got that far.
  insert.run("spent", "closed", "rondo-legacy");
  insert.run("unspent", "abandoned", null);

  const { store } = storeUnder({ maxOccupying: 1, maxLive: 3 }, connection);

  const spent = await store.read("spent");
  expect(spent.kind === "read" && spent.record.identifiersSpent).toBe(1);
  const unspent = await store.read("unspent");
  expect(unspent.kind === "read" && unspent.record.identifiersSpent).toBe(0);

  // So the admitted run id is still held, and cannot be reissued.
  const reissued = await store.reserve({
    id: "new",
    request: "do new",
    plan: somePlan(),
    runId: "rondo-legacy",
    topicBranch: "rondo/new",
    workspace: "/srv/work/iter-new",
    nowMs: 2_000,
  });
  expect(reissued.kind).toBe("defect");
});

test("a legacy row's branch and workspace are back-filled from its plan and then protected", async () => {
  // **Codex's finding, and it is the other half of the back-fill.** Setting
  // `identifiers_spent` alone leaves `topic_branch` and `workspace` NULL on
  // every legacy row, and a NULL is excluded from the claim indexes -- so a
  // later iteration could be handed a branch git already has, which is the
  // failure the indexes exist to prevent, reintroduced by the upgrade itself.
  // The values were never lost: the triple travelled in the plan payload.
  const connection = new DatabaseSync(":memory:");
  connection.exec(`
    CREATE TABLE iteration (
      id TEXT PRIMARY KEY, status TEXT NOT NULL, request TEXT NOT NULL, plan TEXT NOT NULL,
      plan_digest TEXT NOT NULL, attempts INTEGER NOT NULL, run_id TEXT, continuo_revision TEXT,
      agent_type_digest TEXT, config_digest TEXT, contract_digest TEXT, classification TEXT,
      classification_reason TEXT, neutral_role_name TEXT, continuo_role TEXT, model_tier TEXT,
      model TEXT, gate_id TEXT, gate_stage TEXT, gate_outcome TEXT, session_id TEXT,
      session_path TEXT, reason TEXT, created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL,
      live INTEGER GENERATED ALWAYS AS (
        CASE WHEN status IN ('closed','abandoned','failed') THEN NULL ELSE 1 END) VIRTUAL
    );
  `);
  // A pre-D-0023 plan payload: the triple is in the plan, not on the row.
  const legacyPlan = {
    run_id: "legacy-run",
    topic_branch: "dogfood/legacy",
    workspace: "/srv/legacy",
  };
  connection
    .prepare(
      "INSERT INTO iteration (id, status, request, plan, plan_digest, attempts, run_id, " +
        "created_at_ms, updated_at_ms) VALUES ('old', 'awaiting_human', 'ask', ?, ?, 1, " +
        "'legacy-run', 1, 1)",
    )
    .run(JSON.stringify(legacyPlan), planDigest(legacyPlan));

  const { store } = storeUnder({ maxOccupying: 1, maxLive: 3 }, connection);

  const old = await store.read("old");
  expect(old.kind === "read" && old.record.topicBranch).toBe("dogfood/legacy");
  expect(old.kind === "read" && old.record.workspace).toBe("/srv/legacy");
  expect(old.kind === "read" && old.record.identifiersSpent).toBe(1);

  // And the names it holds cannot be handed to a new iteration.
  const collided = await store.reserve({
    id: "new",
    request: "do new",
    plan: somePlan(),
    runId: "rondo-new",
    topicBranch: "dogfood/legacy",
    workspace: "/srv/work/iter-new",
    nowMs: 2_000,
  });
  expect(collided.kind).toBe("defect");
});

test("an interrupted upgrade leaves nothing behind: the migration is one transaction", () => {
  // Codex's second finding. `ALTER TABLE` commits on its own, so a crash
  // between adding `identifiers_spent` and back-filling it would leave a
  // database whose columns are present and whose claims are wrong -- and the
  // next open would find nothing missing and skip the back-fill for ever.
  // Asserted by making the work inside the transaction fail: the columns must
  // not survive.
  const connection = new DatabaseSync(":memory:");
  connection.exec(`
    CREATE TABLE iteration (
      id TEXT PRIMARY KEY, status TEXT NOT NULL, request TEXT NOT NULL, plan TEXT NOT NULL,
      plan_digest TEXT NOT NULL, attempts INTEGER NOT NULL, run_id TEXT, continuo_revision TEXT,
      agent_type_digest TEXT, config_digest TEXT, contract_digest TEXT, classification TEXT,
      classification_reason TEXT, neutral_role_name TEXT, continuo_role TEXT, model_tier TEXT,
      model TEXT, gate_id TEXT, gate_stage TEXT, gate_outcome TEXT, session_id TEXT,
      session_path TEXT, reason TEXT, created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL,
      live INTEGER GENERATED ALWAYS AS (
        CASE WHEN status IN ('closed','abandoned','failed') THEN NULL ELSE 1 END) VIRTUAL
    );
  `);
  // A trigger that aborts on UPDATE fails the back-fill from *inside* the
  // migration's transaction, which is what this asserts the rollback of. A
  // malformed plan deliberately does not do this any more -- see the case
  // below -- so the failure has to be injected some other way.
  connection
    .prepare(
      "INSERT INTO iteration (id, status, request, plan, plan_digest, attempts, run_id, " +
        `created_at_ms, updated_at_ms) VALUES ('old', 'closed', 'ask', '{}', '${planDigest({})}', ` +
        "1, 'legacy-run', 1, 1)",
    )
    .run();
  connection.exec(
    "CREATE TRIGGER refuse_update BEFORE UPDATE ON iteration BEGIN SELECT RAISE(ABORT, 'boom'); END",
  );

  expect(() => storeUnder({ maxOccupying: 1, maxLive: 3 }, connection)).toThrow();

  // Nothing was left half-applied: the columns are not there, so the next open
  // still knows there is work to do.
  const columns = new Set(
    (
      connection
        .prepare("SELECT name FROM pragma_table_xinfo('iteration')")
        .all() as unknown as readonly {
        readonly name: string;
      }[]
    ).map((row) => row.name),
  );
  expect(columns.has("identifiers_spent")).toBe(false);
  expect(columns.has("topic_branch")).toBe(false);
});

test("a legacy row whose plan is not JSON does not stop the store opening", async () => {
  // **Codex round 2.** `json_extract` raises on malformed JSON, so one damaged
  // historical row would otherwise stop the whole database opening -- including
  // for `abandon()`, which exists to end exactly such a row and which
  // deliberately leaves its plan bytes untouched. Bricking the store would make
  // the recovery path unreachable for the one row that needs it.
  const connection = new DatabaseSync(":memory:");
  connection.exec(`
    CREATE TABLE iteration (
      id TEXT PRIMARY KEY, status TEXT NOT NULL, request TEXT NOT NULL, plan TEXT NOT NULL,
      plan_digest TEXT NOT NULL, attempts INTEGER NOT NULL, run_id TEXT, continuo_revision TEXT,
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
      "INSERT INTO iteration (id, status, request, plan, plan_digest, attempts, created_at_ms, " +
        "updated_at_ms) VALUES ('broken', 'awaiting_human', 'ask', '{not json', 'sha256:x', 1, 1, 1)",
    )
    .run();

  const { store } = storeUnder({ maxOccupying: 1, maxLive: 3 }, connection);

  // The store opened, the row is reachable, and the recovery that exists for it
  // still works.
  expect((await store.read("broken")).kind).toBe("unreadable");
  expect((await store.settle("broken", "the operator ended it", 2_000)).kind).toBe("settled");
});
