/**
 * The lap-reading record: written with the transition, immutable, enumerable
 * (D-0029 rules 8, 10 and 11).
 *
 * Against a real `node:sqlite` in-memory database, for D-0019 rule 17's reason:
 * the properties under test here are the database's -- one transaction, a row
 * that a refused transition does not write, and a query that returns terminal
 * rows nothing else in the store returns -- and a fake would be asserting the
 * fake.
 */
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import { CONSERVATIVE_HOST_POLICY } from "../../src/refrain/policy.js";
import type { JsonRecord, LapReadingDraft, ReadingEvidence } from "../../src/store/records.js";
import { iterationStore } from "../../src/store/sqlite.js";

const somePlan = (): JsonRecord => ({
  run_id: "r-0001",
  workspace: "/srv/work/r-0001",
  topic_branch: "feat/thing",
});

const freshStore = () => iterationStore(new DatabaseSync(":memory:"), CONSERVATIVE_HOST_POLICY);

const tripleFor = (id: string) => ({
  runId: `rondo-${id}`,
  topicBranch: `rondo/${id}`,
  workspace: `/srv/work/iter-${id}`,
});

const reserveOne = async (store: ReturnType<typeof freshStore>, id: string, nowMs = 1_000) =>
  store.reserve({ id, request: "do the thing", plan: somePlan(), nowMs, ...tripleFor(id) });

const EVIDENCE: ReadingEvidence = {
  baseRef: "refs/remotes/origin/main",
  baseCommit: "b".repeat(40),
  tipCommit: "a".repeat(40),
  materialDigest: `sha256:${"c".repeat(64)}`,
  commitCount: 2,
  fileCount: 5,
};

const clear = (parts: Partial<LapReadingDraft> = {}): LapReadingDraft => ({
  drafter: "rondo/deterministic/1",
  verdict: "clear",
  findings: [],
  evidence: EVIDENCE,
  unavailableReason: null,
  ...parts,
});

test("a reading committed with a transition is readable afterwards", async () => {
  const store = freshStore();
  await reserveOne(store, "i-0001");

  const moved = await store.transition("i-0001", "planned", "classified", {}, 2_000, clear());

  expect(moved.kind).toBe("transitioned");
  const readings = await store.readingsFor("i-0001");
  expect(readings).toHaveLength(1);
  expect(readings[0]).toEqual({
    iterationId: "i-0001",
    readAtMs: 2_000,
    drafter: "rondo/deterministic/1",
    verdict: "clear",
    findings: [],
    evidence: EVIDENCE,
    unavailableReason: null,
  });
});

test("a refused transition writes no reading, because both are one transaction", async () => {
  // **D-0029 rule 8's whole point, observed rather than argued.** The status
  // assertion runs before the reading is appended and inside the same
  // `BEGIN IMMEDIATE`, so a transition another writer already moved past
  // records nothing -- there is no reading of a suspend that did not happen.
  const store = freshStore();
  await reserveOne(store, "i-0001");
  await store.transition("i-0001", "planned", "classified", {}, 2_000);

  const refused = await store.transition("i-0001", "planned", "admitting", {}, 3_000, clear());

  expect(refused).toEqual({ kind: "unexpectedStatus", found: "classified" });
  expect(await store.readingsFor("i-0001")).toEqual([]);
});

test("a transition with no reading writes none, and says nothing about one", async () => {
  const store = freshStore();
  await reserveOne(store, "i-0001");

  await store.transition("i-0001", "planned", "classified", {}, 2_000);

  expect(await store.readingsFor("i-0001")).toEqual([]);
});

test("a 'clear' with no measurement behind it is refused and stored as unavailable", async () => {
  // D-0029 rule 11. The refusal is of the *clear*, not of the transition: a
  // reader's defect must not strand a row at `performing` with a gate already
  // open, so the row moves and the verdict does not survive.
  const store = freshStore();
  await reserveOne(store, "i-0001");

  const moved = await store.transition(
    "i-0001",
    "planned",
    "classified",
    {},
    2_000,
    clear({ evidence: null }),
  );

  expect(moved.kind).toBe("transitioned");
  const stored = (await store.readingsFor("i-0001"))[0];
  expect(stored?.verdict).toBe("unavailable");
  expect(stored?.evidence).toBeNull();
  expect(stored?.unavailableReason).toContain("no measurement of what was read");
});

test("a 'clear' whose measurement is half missing is refused the same way", async () => {
  // Every field, not any field: a digest with no tip cannot answer rule 10 and
  // a tip with no digest cannot answer rule 11, so a partial measurement is the
  // shape a defect takes rather than a weaker kind of evidence.
  const store = freshStore();
  await reserveOne(store, "i-0001");

  await store.transition(
    "i-0001",
    "planned",
    "classified",
    {},
    2_000,
    clear({ evidence: { ...EVIDENCE, tipCommit: "" } }),
  );

  expect((await store.readingsFor("i-0001"))[0]?.verdict).toBe("unavailable");
});

test("a 'concerns' with no measurement is stored as it is, because it claims nothing", async () => {
  // The asymmetry is deliberate and is D-0022 rule 11's grade: a clean verdict
  // is the one that would unlock something if anything treated it as
  // permission, so it is the one that carries an obligation. A point raised
  // needs no evidence to be worth showing a person.
  const store = freshStore();
  await reserveOne(store, "i-0001");

  await store.transition(
    "i-0001",
    "planned",
    "classified",
    {},
    2_000,
    clear({ verdict: "concerns", findings: ["it left nothing"], evidence: null }),
  );

  const stored = (await store.readingsFor("i-0001"))[0];
  expect(stored?.verdict).toBe("concerns");
  expect(stored?.findings).toEqual(["it left nothing"]);
});

test("findings survive characters a separator would have broken", async () => {
  const store = freshStore();
  await reserveOne(store, "i-0001");
  const awkward = ["a tab\there", 'a "quote" and a ; semicolon', "a newline\nand more"];

  await store.transition(
    "i-0001",
    "planned",
    "classified",
    {},
    2_000,
    clear({ verdict: "concerns", findings: awkward }),
  );

  expect((await store.readingsFor("i-0001"))[0]?.findings).toEqual(awkward);
});

test("a second reading is appended beside the first, oldest first", async () => {
  // Append-only: a later reading is a later fact and not a correction, so both
  // stay readable and the newest is what a caller takes.
  const store = freshStore();
  await reserveOne(store, "i-0001");

  await store.transition("i-0001", "planned", "classified", {}, 2_000, clear());
  await store.transition(
    "i-0001",
    "classified",
    "admitting",
    {},
    3_000,
    clear({ verdict: "concerns", findings: ["something later"] }),
  );

  const readings = await store.readingsFor("i-0001");
  expect(readings.map((reading) => reading.verdict)).toEqual(["clear", "concerns"]);
  expect(readings.at(-1)?.readAtMs).toBe(3_000);
});

test("readings are scoped to their own iteration", async () => {
  const store = freshStore();
  await reserveOne(store, "i-0001");
  await store.transition("i-0001", "planned", "closed", {}, 2_000, clear());
  await reserveOne(store, "i-0002", 3_000);
  await store.transition("i-0002", "planned", "closed", {}, 4_000, clear({ verdict: "concerns" }));

  expect((await store.readingsFor("i-0001"))[0]?.verdict).toBe("clear");
  expect((await store.readingsFor("i-0002"))[0]?.verdict).toBe("concerns");
});

test("terminal iterations with no reading are enumerable, and read ones are not listed", async () => {
  // **The fail-open detector** (D-0029 rule 8). Without it, a lap whose reading
  // was never written closes within minutes and is indistinguishable from one
  // that was read and found fine, because `read` needs an id already known and
  // `readLive` filters terminal rows out.
  const store = freshStore();
  await reserveOne(store, "i-unread", 1_000);
  await store.transition("i-unread", "planned", "closed", {}, 2_000);
  await reserveOne(store, "i-read", 3_000);
  await store.transition("i-read", "planned", "closed", {}, 4_000, clear());
  await reserveOne(store, "i-live", 5_000);

  const unread = await store.terminalWithoutReading();

  expect(unread).toEqual(["i-unread"]);
});

test("a live iteration with no reading is not a fail-open and is not listed", async () => {
  const store = freshStore();
  await reserveOne(store, "i-0001");

  await store.transition("i-0001", "planned", "performing", {}, 2_000);

  expect(await store.terminalWithoutReading()).toEqual([]);
});

test("an unrecognised stored verdict reads as unavailable rather than as a pass", async () => {
  // A row a person edited with `sqlite3` is one edit away from any string at
  // all. The one answer that must never be produced by a decoder is `clear`,
  // because that is the only verdict `publish` does not refuse on.
  const connection = new DatabaseSync(":memory:");
  const store = iterationStore(connection, CONSERVATIVE_HOST_POLICY);
  await reserveOne(store, "i-0001");
  connection
    .prepare(
      "INSERT INTO lap_reading (iteration_id, read_at_ms, drafter, verdict, findings) " +
        "VALUES (?, ?, ?, ?, ?)",
    )
    .run("i-0001", 2_000, "somebody", "approved", "[]");

  const stored = (await store.readingsFor("i-0001"))[0];

  expect(stored?.verdict).toBe("unavailable");
  expect(stored?.unavailableReason).toContain("which this rondo does not know");
});

test("stored findings that are not a list of strings read as one finding saying so", async () => {
  const connection = new DatabaseSync(":memory:");
  const store = iterationStore(connection, CONSERVATIVE_HOST_POLICY);
  await reserveOne(store, "i-0001");
  connection
    .prepare(
      "INSERT INTO lap_reading (iteration_id, read_at_ms, drafter, verdict, findings) " +
        "VALUES (?, ?, ?, ?, ?)",
    )
    .run("i-0001", 2_000, "somebody", "concerns", "not json at all");

  const stored = (await store.readingsFor("i-0001"))[0];

  expect(stored?.findings).toHaveLength(1);
  expect(stored?.findings[0]).toContain("do not read as a list of strings");
});

test("the reading table arrives on a database that predates it", async () => {
  // `SCHEMA` is exec'd on every open and every statement in it is
  // `IF NOT EXISTS`, so a store opened over an older database gains the table
  // without a column migration -- which is what `ADDED_COLUMNS` cannot express
  // and does not need to here.
  const connection = new DatabaseSync(":memory:");
  connection.exec(
    "CREATE TABLE iteration (id TEXT PRIMARY KEY, status TEXT NOT NULL, request TEXT NOT NULL, " +
      "plan TEXT NOT NULL, plan_digest TEXT NOT NULL, attempts INTEGER NOT NULL, " +
      "run_id TEXT, continuo_revision TEXT, agent_type_digest TEXT, config_digest TEXT, " +
      "contract_digest TEXT, classification TEXT, classification_reason TEXT, " +
      "neutral_role_name TEXT, continuo_role TEXT, model_tier TEXT, model TEXT, gate_id TEXT, " +
      "gate_stage TEXT, gate_outcome TEXT, session_id TEXT, session_path TEXT, reason TEXT, " +
      "created_at_ms INTEGER NOT NULL, updated_at_ms INTEGER NOT NULL, " +
      "live INTEGER GENERATED ALWAYS AS (CASE WHEN status IN ('closed','abandoned','failed') " +
      "THEN NULL ELSE 1 END) VIRTUAL)",
  );

  const store = iterationStore(connection, CONSERVATIVE_HOST_POLICY);
  await reserveOne(store, "i-0001");
  await store.transition("i-0001", "planned", "closed", {}, 2_000, clear());

  expect((await store.readingsFor("i-0001"))[0]?.verdict).toBe("clear");
});
