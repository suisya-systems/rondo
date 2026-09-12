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
import type {
  JsonRecord,
  LapReading,
  LapReadingDraft,
  ReadingEvidence,
} from "../../src/store/records.js";
import {
  DETERMINISTIC_READING_DRAFTER,
  FINDING_SEVERITIES,
  isDeterministicReadingDrafter,
  isModelReadingDrafter,
  latestReading,
  MODEL_READING_DRAFTER_PREFIX,
  modelReadingDrafter,
  readingCoverage,
  severityAtOrAbove,
} from "../../src/store/records.js";
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
  store.reserve({
    id,
    request: "do the thing",
    plan: somePlan(),
    spend: null,
    nowMs,
    supersedesIterationId: null,
    ...tripleFor(id),
  });

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

test("the coverage of a reading is keyed by its drafter, and states the same ceiling twice", () => {
  // **One spelling for two layers** (rondo#69). `rondo answer` renders a stored
  // reading and the conductor renders a draft, and they may not import each
  // other, so the sentence that says what the reader did not look at lives
  // beside the row. What it must never become is a fixed claim about a reader
  // nobody has written yet: rows are append-only, a model drafter arrives under
  // D-0029 rule 6, and it may well be handed more than this one is.
  const deterministic = readingCoverage(DETERMINISTIC_READING_DRAFTER).join("\n");

  expect(deterministic).toContain("built nothing, ran nothing and tested nothing");
  expect(deterministic).toContain("neither checked nor claimed");
  expect(readingCoverage("rondo/none").join("\n")).toContain("is not recorded");
  expect(readingCoverage("rondo/model/1").join("\n")).not.toContain("built nothing");
  // D-0060 changed what the reader reads, so the version moved and an old row
  // still says what its reader covered.
  expect(deterministic).toContain("git status");
  expect(readingCoverage("rondo/deterministic/1").join("\n")).toContain("committed history only");
});

test("an operator's verification claim is stored as their word, and its absence is nothing", async () => {
  // #70. The store's half of the distinction: an iteration whose operator said
  // what they ran, beside one whose operator said nothing.
  const store = freshStore();
  await reserveOne(store, "i-said");
  await reserveOne(store, "i-silent", 2_000);

  await store.recordVerificationClaim("i-said", "operator-1", "npm run verify, green", 3_000);

  expect(await store.verificationClaimsFor("i-said")).toEqual([
    {
      iterationId: "i-said",
      claimedAtMs: 3_000,
      actorId: "operator-1",
      claim: "npm run verify, green",
    },
  ]);
  expect(await store.verificationClaimsFor("i-silent")).toEqual([]);

  // Append-only: a second claim is a later fact, not a correction of the first.
  await store.recordVerificationClaim("i-said", "operator-2", "read the diff", 4_000);
  expect((await store.verificationClaimsFor("i-said")).map((row) => row.actorId)).toEqual([
    "operator-1",
    "operator-2",
  ]);
});

// D-0065: the model reading's fields, its writer rule and its own append.

const MODEL = "rondo/model/1/gpt-6-astra";
const DELIVERED = `sha256:${"d".repeat(64)}`;

const graded = (): LapReadingDraft => ({
  drafter: MODEL,
  verdict: "concerns",
  findings: ["install never ran before verify", "a finding with no basis"],
  graded: [
    {
      severity: "major",
      bases: [
        { kind: "event", index: 41 },
        { kind: "file", path: "src/a.ts", line: 3 },
        { kind: "commit", sha: "a".repeat(40) },
        { kind: "rule", path: "AGENTS.md", line: 12 },
      ],
      basisResolved: true,
    },
    { severity: "nit", bases: [], basisResolved: false },
  ],
  evidence: { ...EVIDENCE, deliveredDigest: DELIVERED },
  unavailableReason: null,
});

test("a model reading's graded findings and delivered digest round-trip", async () => {
  const store = freshStore();
  await reserveOne(store, "i-0001");

  expect(await store.appendReading("i-0001", graded(), 5_000)).toEqual({ kind: "appended" });

  expect(await store.readingsFor("i-0001")).toEqual([
    { iterationId: "i-0001", readAtMs: 5_000, ...graded() },
  ]);
});

test("a deterministic reading reads back with no graded and no delivered digest keys", async () => {
  const store = freshStore();
  await reserveOne(store, "i-0001");
  await store.transition("i-0001", "planned", "classified", {}, 2_000, clear());

  const stored = (await store.readingsFor("i-0001"))[0];

  expect(stored).not.toHaveProperty("graded");
  expect(stored?.evidence).not.toHaveProperty("deliveredDigest");
});

test("a graded column that does not decode is omitted and the findings stay", async () => {
  const connection = new DatabaseSync(":memory:");
  const store = iterationStore(connection, CONSERVATIVE_HOST_POLICY);
  await reserveOne(store, "i-0001");
  const insert = connection.prepare(
    "INSERT INTO lap_reading (iteration_id, read_at_ms, drafter, verdict, findings, graded) " +
      "VALUES (?, ?, ?, ?, ?, ?)",
  );
  insert.run("i-0001", 2_000, MODEL, "concerns", '["x"]', "not json");
  insert.run(
    "i-0001",
    3_000,
    MODEL,
    "concerns",
    '["x"]',
    '[{"severity":"huge","bases":[],"basisResolved":false}]',
  );
  insert.run("i-0001", 4_000, MODEL, "concerns", '["x"]', "[]");

  const stored = await store.readingsFor("i-0001");

  expect(stored).toHaveLength(3);
  for (const reading of stored) {
    expect(reading).not.toHaveProperty("graded");
    expect(reading.findings).toEqual(["x"]);
  }
});

test("a model drafter's clear without a delivered digest is stored as unavailable", async () => {
  // D-0029 V-11's second clause: evidence of the workspace is not evidence of
  // what the model was handed.
  const store = freshStore();
  await reserveOne(store, "i-0001");

  await store.appendReading(
    "i-0001",
    { drafter: MODEL, verdict: "clear", findings: [], evidence: EVIDENCE, unavailableReason: null },
    2_000,
  );
  await store.appendReading(
    "i-0001",
    {
      drafter: MODEL,
      verdict: "clear",
      findings: [],
      evidence: { ...EVIDENCE, deliveredDigest: DELIVERED },
      unavailableReason: null,
    },
    3_000,
  );

  const [refused, kept] = await store.readingsFor("i-0001");
  expect(refused?.verdict).toBe("unavailable");
  expect(refused?.evidence).toBeNull();
  expect(refused?.unavailableReason).toContain("no digest of the material rondo delivered");
  expect(kept?.verdict).toBe("clear");
  expect(kept?.evidence?.deliveredDigest).toBe(DELIVERED);
});

test("a deterministic clear needs no delivered digest", async () => {
  const store = freshStore();
  await reserveOne(store, "i-0001");

  await store.appendReading("i-0001", clear({ drafter: DETERMINISTIC_READING_DRAFTER }), 2_000);

  expect((await store.readingsFor("i-0001"))[0]?.verdict).toBe("clear");
});

test("appendReading refuses an iteration id with no row and writes nothing", async () => {
  const store = freshStore();

  expect(await store.appendReading("i-nobody", graded(), 2_000)).toEqual({ kind: "absent" });
  expect(await store.readingsFor("i-nobody")).toEqual([]);
});

test("a lap_reading table without the D-0065 columns gains them on open", async () => {
  const connection = new DatabaseSync(":memory:");
  connection.exec(
    "CREATE TABLE lap_reading (iteration_id TEXT NOT NULL, read_at_ms INTEGER NOT NULL, " +
      "drafter TEXT NOT NULL, verdict TEXT NOT NULL, findings TEXT NOT NULL, base_ref TEXT, " +
      "base_commit TEXT, tip_commit TEXT, material_digest TEXT, commit_count INTEGER, " +
      "file_count INTEGER, unavailable_reason TEXT)",
  );
  connection
    .prepare(
      "INSERT INTO lap_reading (iteration_id, read_at_ms, drafter, verdict, findings) " +
        "VALUES (?, ?, ?, ?, ?)",
    )
    .run("i-0001", 1_500, DETERMINISTIC_READING_DRAFTER, "concerns", '["old"]');

  const store = iterationStore(connection, CONSERVATIVE_HOST_POLICY);
  iterationStore(connection, CONSERVATIVE_HOST_POLICY); // idempotent re-open
  await reserveOne(store, "i-0001");
  await store.appendReading("i-0001", graded(), 5_000);

  const readings = await store.readingsFor("i-0001");
  expect(readings[0]).not.toHaveProperty("graded");
  expect(readings[0]?.findings).toEqual(["old"]);
  expect(readings[1]?.graded).toEqual(graded().graded);
});

test("a model drafter's coverage says what it was handed, that it ran nothing, and delivery only", () => {
  const said = readingCoverage(modelReadingDrafter("gpt-6-astra")).join("\n");

  expect(said).toContain("committed diff, the commit messages, the prompt");
  expect(said).toContain("ran nothing");
  expect(said).toContain("that it was understood is not provable");
  expect(said).not.toContain("built nothing");
  expect(said).not.toContain("is not recorded");
  expect(readingCoverage(MODEL_READING_DRAFTER_PREFIX).join("\n")).toContain("is not recorded");
});

test("drafter predicates and latestReading pick the newest of each kind", () => {
  const at = (drafter: string, readAtMs: number): LapReading => ({
    iterationId: "i-0001",
    readAtMs,
    drafter,
    verdict: "concerns",
    findings: [],
    evidence: null,
    unavailableReason: null,
  });
  const readings = [
    at("rondo/deterministic/1", 1),
    at(MODEL, 2),
    at(DETERMINISTIC_READING_DRAFTER, 3),
    at("rondo/model/1/other", 4),
    at("rondo/none", 5),
  ];

  expect(modelReadingDrafter("gpt-6-astra")).toBe(MODEL);
  expect(isModelReadingDrafter("rondo/model/1")).toBe(false);
  expect(isDeterministicReadingDrafter("rondo/deterministic/1")).toBe(true);
  expect(latestReading(readings, isDeterministicReadingDrafter)?.readAtMs).toBe(3);
  expect(latestReading(readings, isModelReadingDrafter)?.readAtMs).toBe(4);
  expect(latestReading([], isModelReadingDrafter)).toBeNull();
  expect(severityAtOrAbove("blocker", "major")).toBe(true);
  expect(severityAtOrAbove("major", "major")).toBe(true);
  expect(severityAtOrAbove("minor", "major")).toBe(false);
  expect(FINDING_SEVERITIES).toEqual(["blocker", "major", "minor", "nit"]);
});
