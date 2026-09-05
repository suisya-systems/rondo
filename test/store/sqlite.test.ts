/**
 * The single-flight invariant is the database's, and the store never guesses.
 *
 * D-0019 rule 17 puts this layer on a **real** `node:sqlite` in-memory
 * database, because the two claims that carry rule 10 are claims about SQLite
 * rather than about this code: that the partial unique index over the generated
 * `live` column actually refuses a second non-terminal row, and that a
 * transition asserting the wrong `from` writes nothing. A fake store would
 * agree with whatever this file asserted.
 *
 * The other three properties here are the ones a crash would expose: the plan
 * comes back verbatim with a digest that does not depend on key order (rule 4);
 * a row committed at `admitting` already names the run id and the observed
 * continuo revision, so the crash between that commit and `run admit` leaves a
 * row that explains the effect that followed (rule 10's write order); and a
 * status edited out of band is a refusal rather than a coercion, which is what
 * makes the interpreter's "anything it cannot classify halts and asks" (rule 8)
 * mean anything at all.
 *
 * That last refusal is an **answer** rather than a rejected promise, and the
 * last group of tests is about why: a row that will not decode still counts as
 * live, so a store that threw left the single-flight lock held by a row nothing
 * could name and no path -- not `read`, not `transition`, not an operator's
 * `abandon()` -- could end. `unreadable` plus `settle` is that path, and the
 * assertion that carries it is the reservation *after* the settle.
 */
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import { planDigest } from "../../src/store/plan.js";
import type { JsonRecord } from "../../src/store/records.js";
import { TERMINAL_STATUSES } from "../../src/store/records.js";
import { iterationStore } from "../../src/store/sqlite.js";

/**
 * A plan payload of the shape `src/refrain/plan.ts` renders.
 *
 * Hand-built rather than produced through `runPlan`, so that this file states
 * what the store is handed without depending on the validator that produced it:
 * the store's contract is "bytes in, the same bytes out", and it holds for a
 * payload rondo's own planner never wrote.
 */
const somePlan = (overrides: JsonRecord = {}): JsonRecord => ({
  run_id: "r-0001",
  workspace: "/srv/work/r-0001",
  topic_branch: "feat/thing",
  claude_command: ["/usr/bin/node", "/opt/claude/cli.js"],
  turn_timeout_ms: 900_000,
  git_timeout_ms: 60_000,
  invocation_ceiling_ms: 1_800_000,
  endpoint_db: null,
  ...overrides,
});

/** A store over a database of its own, so no test can see another's rows. */
const freshStore = () => iterationStore(new DatabaseSync(":memory:"));

const reserveOne = async (store: ReturnType<typeof freshStore>, id: string, nowMs = 1_000) =>
  store.reserve({ id, request: "do the thing", plan: somePlan(), nowMs });

/**
 * The record a read was expected to find.
 *
 * Every test below that reads a healthy row goes through this, so that a read
 * answering `absent` or `unreadable` where the test meant `read` fails naming
 * which it got, rather than failing later on an optional chain that quietly
 * yielded `undefined`.
 */
const readRecord = async (store: ReturnType<typeof freshStore>, id: string) => {
  const outcome = await store.read(id);
  if (outcome.kind !== "read") {
    throw new Error(`reading '${id}' answered '${outcome.kind}' where a record was expected`);
  }
  return outcome.record;
};

test("a reservation commits a planned row that reads back with its plan and digest", async () => {
  const store = freshStore();
  const outcome = await reserveOne(store, "i-0001");

  expect(outcome.kind).toBe("reserved");
  const read = await readRecord(store, "i-0001");
  expect(read.status).toBe("planned");
  expect(read.request).toBe("do the thing");
  expect(read.attempts).toBe(1);
  expect(read.createdAtMs).toBe(1_000);
  expect(read.updatedAtMs).toBe(1_000);
  // Verbatim: the plan that comes back is the plan that went in, field for
  // field, and the digest is the digest of those bytes (D-0019 rule 4).
  expect(read.plan).toEqual(somePlan());
  expect(read.planDigest).toBe(planDigest(somePlan()));
  expect(read.runId).toBeNull();
  expect(read.continuoRevision).toBeNull();
});

test("the plan digest does not depend on the order the plan's keys were written in", async () => {
  const store = freshStore();
  const forwards: JsonRecord = { run_id: "r-0001", workspace: "/w", turn_timeout_ms: 1 };
  const backwards: JsonRecord = { turn_timeout_ms: 1, workspace: "/w", run_id: "r-0001" };

  await store.reserve({ id: "i-0001", request: "one", plan: forwards, nowMs: 1 });
  await store.transition("i-0001", "planned", "closed", {}, 2);
  await store.reserve({ id: "i-0002", request: "two", plan: backwards, nowMs: 3 });

  const first = await readRecord(store, "i-0001");
  const second = await readRecord(store, "i-0002");
  expect(second.planDigest).toBe(first.planDigest);
  // Two encodings of one plan are one plan, which is the whole reason the row
  // holds a canonical rendering rather than whatever JSON.stringify produced.
  expect(second.plan).toEqual(first.plan);
});

test("the partial unique index refuses a second live iteration and names the first", async () => {
  const store = freshStore();
  await reserveOne(store, "i-0001");

  const second = await reserveOne(store, "i-0002", 2_000);

  // rondo#8: the constant 1, refusing. Not a defect -- a conductor that is
  // already conducting saying so.
  expect(second).toEqual({ kind: "occupied", liveIterationId: "i-0001" });
  expect(await store.read("i-0002")).toEqual({ kind: "absent" });
});

test("a non-terminal status other than planned holds the lock just as hard", async () => {
  const store = freshStore();
  await reserveOne(store, "i-0001");
  await store.transition("i-0001", "planned", "awaiting_human", { gateId: "g-1" }, 2_000);

  expect(await reserveOne(store, "i-0002", 3_000)).toEqual({
    kind: "occupied",
    liveIterationId: "i-0001",
  });
});

for (const terminal of TERMINAL_STATUSES) {
  test(`a new reservation is accepted once the live iteration reaches ${terminal}`, async () => {
    const store = freshStore();
    await reserveOne(store, "i-0001");
    await store.transition("i-0001", "planned", terminal, { reason: "settled" }, 2_000);

    // Every terminal status releases the lock, and all three are asserted
    // because the generated column's CASE is the only place that set is spelled
    // in SQL -- a status dropped from it would be a conductor that never runs
    // again, and only the missing case would show it.
    expect(await reserveOne(store, "i-0002", 3_000)).toMatchObject({ kind: "reserved" });
    expect(await store.readLive()).toMatchObject({ kind: "read", record: { id: "i-0002" } });
  });
}

test("readLive is absent when every iteration is terminal", async () => {
  const store = freshStore();
  await reserveOne(store, "i-0001");
  expect(await store.readLive()).toMatchObject({ kind: "read", record: { id: "i-0001" } });

  await store.transition("i-0001", "planned", "abandoned", { reason: "operator" }, 2_000);
  // `absent` rather than a null record: "no live iteration" is an ordinary
  // answer the caller acts on, and it is not the same fact as "there is a live
  // iteration and it will not decode".
  expect(await store.readLive()).toEqual({ kind: "absent" });
});

test("a transition from an unexpected status is refused and writes nothing", async () => {
  const store = freshStore();
  await reserveOne(store, "i-0001");
  await store.transition("i-0001", "planned", "classified", { classification: "allowed" }, 2_000);

  const refused = await store.transition(
    "i-0001",
    "planned",
    "admitting",
    { runId: "r-0001", continuoRevision: "abc123" },
    3_000,
  );

  expect(refused).toEqual({ kind: "unexpectedStatus", found: "classified" });
  // Re-read rather than trust the refusal: the claim is that the rolled-back
  // transaction left the row alone, and only the database can say so.
  const row = await readRecord(store, "i-0001");
  expect(row.status).toBe("classified");
  expect(row.runId).toBeNull();
  expect(row.continuoRevision).toBeNull();
  expect(row.updatedAtMs).toBe(2_000);
});

test("a transition on an iteration that does not exist is missing, not a defect", async () => {
  const store = freshStore();
  expect(await store.transition("i-nope", "planned", "classified", {}, 1_000)).toEqual({
    kind: "missing",
  });
});

test("the row committed at admitting names the run id and the observed revision", async () => {
  const store = freshStore();
  await reserveOne(store, "i-0001");
  await store.transition(
    "i-0001",
    "planned",
    "classified",
    {
      classification: "allowed",
      classificationReason: "within the contract",
      agentTypeDigest: "sha256:a",
      configDigest: "sha256:c",
      contractDigest: "sha256:t",
      neutralRoleName: "worker",
    },
    2_000,
  );

  const admitting = await store.transition(
    "i-0001",
    "classified",
    "admitting",
    { runId: "r-0001", continuoRevision: "44f62336108b86cab5da791111ffa0e5b73cd01a" },
    3_000,
  );

  expect(admitting.kind).toBe("transitioned");
  // The write order of D-0019 rule 10: this row is committed *before*
  // `run admit` is spawned, so a crash between the two leaves a row naming the
  // run id and the build that ran it. The reverse order would leave a run
  // continuo knows about and rondo does not.
  const crashed = await readRecord(store, "i-0001");
  expect(crashed.status).toBe("admitting");
  expect(crashed.runId).toBe("r-0001");
  expect(crashed.continuoRevision).toBe("44f62336108b86cab5da791111ffa0e5b73cd01a");
  // Everything learned at `classified` is still on the row, because a
  // transition writes the fields it was given and clears nothing else.
  expect(crashed.agentTypeDigest).toBe("sha256:a");
  expect(crashed.neutralRoleName).toBe("worker");
});

test("a transition hands back the row as the database holds it", async () => {
  const store = freshStore();
  await reserveOne(store, "i-0001");

  const outcome = await store.transition(
    "i-0001",
    "planned",
    "awaiting_human",
    { gateId: "g-1", gateStage: "received", sessionId: "s-1", sessionPath: "started" },
    2_000,
  );

  expect(outcome).toMatchObject({ kind: "transitioned" });
  const reread = await readRecord(store, "i-0001");
  if (outcome.kind !== "transitioned") {
    throw new Error("the transition did not happen");
  }
  // The returned record is the re-read row and not the caller's intent: the two
  // differ exactly when a write did not land, which is the case worth seeing.
  expect(outcome.record).toEqual(reread);
  expect(outcome.record.updatedAtMs).toBe(2_000);
  expect(outcome.record.sessionPath).toBe("started");
});

test("a status edited out of band is unreadable rather than a coercion", async () => {
  const connection = new DatabaseSync(":memory:");
  const store = iterationStore(connection);
  await reserveOne(store, "i-0001");

  // A person with sqlite3 is one edit away from any string at all, so this is
  // an ordinary branch rather than a defensive one.
  connection.prepare("UPDATE iteration SET status = ? WHERE id = ?").run("gremlin", "i-0001");

  // The claim is unchanged -- the store refuses rather than guesses -- but it
  // is an answer and not a rejection, because a rejecting read is what left the
  // interpreter with no way to reach `stalled` and no way to release the lock.
  const read = await store.read("i-0001");
  expect(read).toMatchObject({ kind: "unreadable", id: "i-0001" });
  expect(read.kind === "unreadable" && read.reason).toMatch(/gremlin/);
  // And the same row through the live read, which is how a restart finds it:
  // the row still holds the lock, so the answer has to name it.
  expect(await store.readLive()).toMatchObject({ kind: "unreadable", id: "i-0001" });
  // A transition is still a defect that names itself, rather than an
  // `unexpectedStatus` naming a status that is not one.
  const outcome = await store.transition("i-0001", "planned", "classified", {}, 2_000);
  expect(outcome).toMatchObject({ kind: "defect" });
});

test("a plan column that is not JSON is unreadable through both reads", async () => {
  const connection = new DatabaseSync(":memory:");
  const store = iterationStore(connection);
  await reserveOne(store, "i-0001");

  connection.prepare("UPDATE iteration SET plan = ? WHERE id = ?").run("{not json", "i-0001");

  const read = await store.read("i-0001");
  expect(read).toMatchObject({ kind: "unreadable", id: "i-0001" });
  expect(read.kind === "unreadable" && read.reason).toMatch(/not JSON/);
  expect(await store.readLive()).toMatchObject({ kind: "unreadable", id: "i-0001" });
});

test("settle ends a row that will not decode, and the lock is then free", async () => {
  const connection = new DatabaseSync(":memory:");
  const store = iterationStore(connection);
  await reserveOne(store, "i-0001");
  connection.prepare("UPDATE iteration SET status = ? WHERE id = ?").run("gremlin", "i-0001");

  expect(await store.settle("i-0001", "an operator settled an unreadable row", 2_000)).toEqual({
    kind: "settled",
  });

  // This reservation is the whole point of `settle`: before it existed the
  // corrupt row kept `live` set and every path out of it was closed, so the
  // conductor never ran again. Proving the row is now readable is not enough --
  // the lock has to be provably released.
  expect(await reserveOne(store, "i-0002", 3_000)).toMatchObject({ kind: "reserved" });
  const settled = await readRecord(store, "i-0001");
  expect(settled.status).toBe("abandoned");
  expect(settled.reason).toBe("an operator settled an unreadable row");
  expect(settled.updatedAtMs).toBe(2_000);
});

test("settle on an id with no row is missing and writes nothing", async () => {
  const store = freshStore();
  await reserveOne(store, "i-0001");

  expect(await store.settle("i-nope", "settled", 2_000)).toEqual({ kind: "missing" });

  // The live iteration is untouched, which is the assertion that separates
  // "wrote nothing" from "reported nothing": a settle by the wrong id must not
  // have released somebody else's lock.
  expect(await store.readLive()).toMatchObject({ kind: "read", record: { id: "i-0001" } });
  const live = await readRecord(store, "i-0001");
  expect(live.status).toBe("planned");
  expect(live.updatedAtMs).toBe(1_000);
});

test("settle also ends an ordinary readable row, because it is status-blind", async () => {
  const store = freshStore();
  await reserveOne(store, "i-0001");
  await store.transition("i-0001", "planned", "awaiting_human", { gateId: "g-1" }, 2_000);

  // Not the intended caller -- `abandon()` reaches this only after `read`
  // answered `unreadable` -- but the licence is deliberately unconditional, and
  // a test that pretended otherwise would be describing a guard the code does
  // not have.
  expect(await store.settle("i-0001", "an operator settled it", 3_000)).toEqual({
    kind: "settled",
  });
  const settled = await readRecord(store, "i-0001");
  expect(settled.status).toBe("abandoned");
  expect(settled.gateId).toBe("g-1");
  expect(await store.readLive()).toEqual({ kind: "absent" });
});

test("a digest that does not describe the plan beside it is refused", async () => {
  const store = freshStore();
  await reserveOne(store, "i-0001");

  const outcome = await store.transition(
    "i-0001",
    "planned",
    "classified",
    { plan: somePlan({ run_id: "r-0002" }), planDigest: "sha256:not-the-digest" },
    2_000,
  );

  expect(outcome).toMatchObject({ kind: "defect" });
  const row = await readRecord(store, "i-0001");
  expect(row.status).toBe("planned");
  expect(row.plan).toEqual(somePlan());
});

test("reserving the same iteration id twice is a defect, not an occupied conductor", async () => {
  const store = freshStore();
  await reserveOne(store, "i-0001");
  await store.transition("i-0001", "planned", "closed", {}, 2_000);

  // The lock is free, so this is not single-flight refusing: it is rondo
  // minting an id it already used, which an operator must never be told to
  // wait out.
  expect(await reserveOne(store, "i-0001", 3_000)).toMatchObject({ kind: "defect" });
});
