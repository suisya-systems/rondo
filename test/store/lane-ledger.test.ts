/**
 * The lane ledger in the store (D-0073 rules 2-4): `reserve()` allocates a
 * claim and refuses an admission that would share a path with an open line,
 * every way a line ends writes its release in the same transaction, and a
 * release a landing reading causes is refused when the line moved under it.
 *
 * The one property is rule 3's: no path is held by two open lines of one
 * repository. Every test here either reaches for a second holder and is
 * refused, or ends the first and is then admitted.
 */
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import { CONSERVATIVE_HOST_POLICY } from "../../src/refrain/policy.js";
import type { LaneClaimAsk } from "../../src/store/records.js";
import { LANE_LEDGER_AUTHOR, type ReserveInput } from "../../src/store/sqlite.js";
import { REQUEST, storeWithRequest } from "../request-fixture.js";

const REPOSITORY = "/srv/repo";

const fresh = () => {
  const connection = new DatabaseSync(":memory:");
  // Wide bounds: the capacity ledger is not what this file measures (rule 3.6).
  const store = storeWithRequest(connection, { maxOccupying: 100, maxLive: 100 });
  const claims = () =>
    connection
      .prepare(
        "SELECT claim_id, lineage_id, repository, paths, supersedes_claim_id, author_kind, " +
          "author_id FROM lane_claim ORDER BY rowid",
      )
      .all() as Record<string, unknown>[];
  const iterations = () =>
    Number((connection.prepare("SELECT COUNT(*) AS n FROM iteration").get() as { n: number }).n);
  return { connection, store, claims, iterations };
};

const asking = (paths: readonly string[]): LaneClaimAsk => ({
  paths,
  authorKind: "drafter",
  authorId: "rondo/advisory/test",
  bases: [{ form: "message", messageId: "m-1" }],
});

/** A drafted claim on the whole repository (D-0073 rule 2.2): since D-0160 a
 * line admitted with no drafted claim holds nothing, so a test that needs a
 * line overlapping every other asks for '/' outright. */
const whole = asking(["/"]);

const input = (
  id: string,
  parts: Partial<ReserveInput> & { readonly repository?: string } = {},
): ReserveInput => {
  const { repository = REPOSITORY, ...rest } = parts;
  return {
    id,
    request: `do ${id}`,
    plan: { run_id: `r-${id}`, repository },
    runId: `rondo-${id}`,
    topicBranch: `rondo/${id}`,
    workspace: `/srv/work/${id}`,
    supersedesIterationId: null,
    requestMessageId: REQUEST,
    spend: null,
    scopeSpend: null,
    claim: null,
    numbers: null,
    nowMs: 1_000,
    ...rest,
  };
};

type Store = ReturnType<typeof fresh>["store"];

const reserved = async (store: Store, reserve: ReserveInput) => {
  const outcome = await store.reserve(reserve);
  expect(outcome.kind, JSON.stringify(outcome)).toBe("reserved");
};

/** Walk a reserved row to `status` along legal edges, as the loop would. */
const walk = async (store: Store, id: string, to: "awaiting_human" | "closed") => {
  const path = ["planned", "classified", "admitting", "admitted", "performing", "awaiting_human"];
  for (let step = 1; step < path.length; step += 1) {
    const from = path[step - 1] as "planned";
    const next = path[step] as "classified";
    expect((await store.transition(id, from, next, {}, 1_000 + step)).kind).toBe("transitioned");
  }
  if (to === "closed") {
    expect(
      (
        await store.transition(
          id,
          "awaiting_human",
          "closed",
          { gateOutcome: "answered_and_forwarded" },
          2_000,
        )
      ).kind,
    ).toBe("transitioned");
  }
};

test("a line holding the whole repository refuses a second with nothing written (D-0160: '/' is asked outright)", async () => {
  const { connection, store, claims, iterations } = fresh();
  await reserved(store, input("a", { claim: whole }));
  expect(claims()).toEqual([
    {
      claim_id: "a:1",
      lineage_id: "a",
      repository: REPOSITORY,
      paths: '["/"]',
      supersedes_claim_id: null,
      author_kind: "drafter",
      author_id: "rondo/advisory/test",
    },
  ]);

  const refused = await store.reserve(input("b", { claim: asking(["docs/"]) }));
  expect(refused).toEqual({
    kind: "laneRefused",
    paths: ["docs/"],
    holders: [{ lineageId: "a", sharedPaths: ["docs/"] }],
  });
  // No act and no consumption: no row, no claim.
  expect(iterations()).toBe(1);
  expect(claims()).toHaveLength(1);
  // The refusal is recorded beside the capacity refusal, naming the holder (rule 3.1).
  expect(
    connection
      .prepare("SELECT request, bound_name, bound, occupancy, holders FROM admission_refusal")
      .all(),
  ).toEqual([
    {
      request: "do b",
      bound_name: "laneClaim",
      bound: 0,
      occupancy: 1,
      holders: '[{"lineageId":"a","sharedPaths":["docs/"]}]',
    },
  ]);
});

test("disjoint claims run together; a directory over a claimed file, or another repository's line, decides as it should", async () => {
  const { store, claims } = fresh();
  await reserved(
    store,
    input("page", { claim: asking(["src/access/web.tsx", "src/access/wording.ts"]) }),
  );
  await reserved(store, input("docs", { claim: asking(["docs/operations/"]) }));
  expect(await store.reserve(input("store", { claim: asking(["src/access/"]) }))).toMatchObject({
    kind: "laneRefused",
    holders: [{ lineageId: "page", sharedPaths: ["src/access/"] }],
  });
  // The same paths in another repository share nothing (rule 3: "of one repository").
  await reserved(
    store,
    input("elsewhere", { repository: "/srv/other", claim: asking(["src/access/"]) }),
  );
  expect(claims().map((row) => row["paths"])).toEqual([
    '["src/access/web.tsx","src/access/wording.ts"]',
    '["docs/operations/"]',
    '["src/access/"]',
  ]);
});

test("a malformed drafted claim is a defect in the caller and writes nothing; an ask with no paths claims nothing yet (D-0160)", async () => {
  const { store, claims, iterations } = fresh();
  expect((await store.reserve(input("a", { claim: asking(["src/*.ts"]) }))).kind).toBe("defect");
  expect((await store.reserve(input("c", { plan: { run_id: "r" } }))).kind).toBe("defect");
  expect(iterations()).toBe(0);
  // No paths is no longer malformed: the line holds nothing until its gate,
  // keeping the bases it was asked on (D-0160).
  await reserved(store, input("b", { claim: asking([]) }));
  expect(claims()).toEqual([
    expect.objectContaining({ claim_id: "b:1", paths: "[]", supersedes_claim_id: null }),
  ]);
});

test("a redo continues its lineage's claim and writes no row; a redo carrying a claim is a defect", async () => {
  const { store, claims } = fresh();
  await reserved(store, input("a", { claim: asking(["src/"]) }));
  await walk(store, "a", "awaiting_human");
  await reserved(store, input("a-r2", { supersedesIterationId: "a" }));
  expect(claims()).toHaveLength(1);
  expect(
    (await store.reserve(input("a-r3", { supersedesIterationId: "a", claim: asking(["src/"]) })))
      .kind,
  ).toBe("defect");
});

test("a line at its gate or closed keeps its claim; an abandoned or failed line releases it in the same transaction", async () => {
  const { store, claims } = fresh();
  // Each line asks for '/' outright: one with no drafted claim holds nothing
  // (D-0160), and this test is about a holder keeping or giving up its paths.
  await reserved(store, input("gated", { claim: whole }));
  await walk(store, "gated", "awaiting_human");
  expect((await store.reserve(input("next", { claim: whole }))).kind).toBe("laneRefused");

  await store.transition("gated", "awaiting_human", "closed", {}, 3_000);
  // Closed and not landed: still open (rule 3.3).
  expect((await store.reserve(input("next", { claim: whole }))).kind).toBe("laneRefused");

  const { store: other, claims: otherClaims } = fresh();
  await reserved(other, input("x", { claim: whole }));
  expect((await other.transition("x", "planned", "failed", {}, 5)).kind).toBe("transitioned");
  expect(otherClaims().at(-1)).toMatchObject({
    claim_id: "x:2",
    paths: "[]",
    supersedes_claim_id: "x:1",
    author_id: LANE_LEDGER_AUTHOR,
  });
  await reserved(other, input("y", { claim: whole }));

  await reserved(other, input("z", { repository: "/srv/z", claim: whole }));
  expect((await other.transition("z", "planned", "abandoned", {}, 5)).kind).toBe("transitioned");
  await reserved(other, input("z2", { repository: "/srv/z", claim: whole }));
  expect(claims()).toHaveLength(1);
});

test("settle's escape hatch releases the line it ends", async () => {
  const { store, claims } = fresh();
  // '/' asked outright, so the release is what admits `b` (D-0160).
  await reserved(store, input("a", { claim: whole }));
  expect((await store.settle("a", "stuck", 9)).kind).toBe("settled");
  expect(claims().map((row) => row["paths"])).toEqual(['["/"]', "[]"]);
  await reserved(store, input("b", { claim: whole }));
});

test("a line with no drafted claim holds nothing and runs beside any line; its gate claims what it changed that nobody holds (D-0160)", async () => {
  const { connection, store, claims } = fresh();
  await reserved(store, input("wide", { claim: whole }));
  await reserved(store, input("free"));
  await reserved(store, input("free2"));
  expect(claims().find((row) => row["lineage_id"] === "free")).toEqual({
    claim_id: "free:1",
    lineage_id: "free",
    repository: REPOSITORY,
    paths: "[]",
    supersedes_claim_id: null,
    author_kind: "drafter",
    author_id: LANE_LEDGER_AUTHOR,
  });
  // Open, not released: it holds nothing yet.
  expect((await store.laneLedger()).find((line) => line.lineageId === "free")).toMatchObject({
    paths: [],
    releasedBy: null,
  });
  expect((await store.transition("wide", "planned", "abandoned", {}, 5)).kind).toBe("transitioned");
  await reserved(store, input("src", { claim: asking(["src/"]) }));

  // At its gate: the changed paths `src` holds are left to it.
  expect(
    await store.claimChanged({ iterationId: "free", paths: ["src/a.ts", "docs/x.md"], nowMs: 9 }),
  ).toEqual({ kind: "claimed", lineageId: "free", paths: ["docs/x.md"] });
  const row = connection
    .prepare("SELECT paths, supersedes_claim_id, bases FROM lane_claim WHERE claim_id = 'free:2'")
    .get() as Record<string, unknown>;
  expect(row).toEqual({
    paths: '["docs/x.md"]',
    supersedes_claim_id: "free:1",
    bases: JSON.stringify([{ form: "iteration", iterationId: "free" }, { form: "changed" }]),
  });
  // Now it holds them: another unclaimed line's gate cannot take them too.
  expect(
    await store.claimChanged({ iterationId: "free2", paths: ["docs/x.md"], nowMs: 10 }),
  ).toEqual({ kind: "unchanged" });
  // A drafted claim is never widened (rondo#283).
  expect(await store.claimChanged({ iterationId: "src", paths: ["lib/y.ts"], nowMs: 11 })).toEqual({
    kind: "unchanged",
  });
});

test("a closed lap revised into a redo that failed owes nothing, so the redo's failure releases the line", async () => {
  const { store, claims } = fresh();
  await reserved(store, input("a", { claim: asking(["src/"]) }));
  await walk(store, "a", "closed");
  await reserved(store, input("a-r2", { supersedesIterationId: "a" }));
  expect((await store.transition("a-r2", "planned", "failed", {}, 9)).kind).toBe("transitioned");
  expect(claims().at(-1)).toMatchObject({ paths: "[]", supersedes_claim_id: "a:1" });
  await reserved(store, input("b", { claim: asking(["src/"]) }));
});

test("a released line retried asks back what it gave up, and is tested as a first admission (rule 2.6)", async () => {
  const { connection, store, claims } = fresh();
  const why = "every table may change";
  await reserved(store, input("a", { claim: { ...asking(["src/store/"]), why } }));
  expect((await store.transition("a", "planned", "abandoned", {}, 5)).kind).toBe("transitioned");
  await reserved(store, input("b", { claim: asking(["src/"]) }));
  // `a` gave up src/store/, which `b` now holds: the retry is refused.
  expect(await store.reserve(input("a-r2", { supersedesIterationId: "a" }))).toMatchObject({
    kind: "laneRefused",
    paths: ["src/store/"],
    holders: [{ lineageId: "b", sharedPaths: ["src/store/"] }],
  });
  expect((await store.transition("b", "planned", "abandoned", {}, 6)).kind).toBe("transitioned");
  await reserved(store, input("a-r2", { supersedesIterationId: "a" }));
  expect(
    claims()
      .filter((row) => row["lineage_id"] === "a")
      .at(-1),
  ).toMatchObject({
    claim_id: "a:3",
    paths: '["src/store/"]',
    supersedes_claim_id: "a:2",
  });
  // The paths taken back keep the words that said why (rondo#509); the
  // release between them, which holds nothing, says nothing.
  expect(
    connection.prepare("SELECT why FROM lane_claim WHERE lineage_id = 'a' ORDER BY rowid").all(),
  ).toEqual([{ why }, { why: null }, { why }]);
});

test("a store from before a claim said why gains the column, and its rows say nothing (rondo#509)", async () => {
  const connection = new DatabaseSync(":memory:");
  connection.exec(
    "CREATE TABLE lane_claim (claim_id TEXT PRIMARY KEY, lineage_id TEXT NOT NULL, " +
      "repository TEXT NOT NULL, paths TEXT NOT NULL, supersedes_claim_id TEXT UNIQUE, " +
      "author_kind TEXT NOT NULL, author_id TEXT NOT NULL, bases TEXT NOT NULL, " +
      "created_at_ms INTEGER NOT NULL)",
  );
  connection
    .prepare(
      "INSERT INTO lane_claim VALUES ('old:1', 'old', ?, '[\"docs/\"]', NULL, 'drafter', 'x', '[]', 1)",
    )
    .run(REPOSITORY);
  const store = storeWithRequest(connection, { maxOccupying: 100, maxLive: 100 });
  expect((await store.laneLedger()).find((line) => line.lineageId === "old")).toMatchObject({
    paths: ["docs/"],
    why: null,
  });
});

test("a line from before the ledger holds '/' only while a lap of it has not ended (the migration, rondo#250)", async () => {
  const { connection, store, claims } = fresh();
  const legacy = (id: string, status: string, supersedes: string | null = null) =>
    connection
      .prepare(
        "INSERT INTO iteration (id, status, request, plan, plan_digest, attempts, identifiers_spent, " +
          "supersedes_iteration_id, request_message_id, created_at_ms, updated_at_ms) " +
          "VALUES (?, ?, 'r', ?, 'x', 1, 1, ?, ?, 1, 1)",
      )
      .run(id, status, JSON.stringify({ repository: REPOSITORY }), supersedes, REQUEST);
  // Finished before the ledger, closed tips included: not open to it (a squash
  // merge hides whether a closed one landed, so holding it would hold for ever).
  legacy("old-done", "abandoned");
  legacy("old-closed", "closed");
  legacy("old-gated", "awaiting_human");
  expect(await store.reserve(input("new", { claim: asking(["docs/"]) }))).toEqual({
    kind: "laneRefused",
    paths: ["docs/"],
    holders: [{ lineageId: "old-gated", sharedPaths: ["docs/"] }],
  });
  // A line in flight holds its paths and is not released by a press.
  expect((await store.releaseLane(press("old-gated"))).kind).toBe("refused");
  // Nor is a finished one, which holds nothing.
  expect((await store.releaseLane(press("old-closed"))).kind).toBe("refused");
  // Its row predates the ledger and does not decode (no digest), so the hatch ends it.
  expect((await store.settle("old-gated", "gone", 3)).kind).toBe("settled");
  expect(claims()).toEqual([]);
  await reserved(store, input("new", { claim: asking(["docs/"]) }));
  // A redo of a pre-ledger line is tested like a first admission with no
  // drafted claim: it claims nothing yet, so it runs beside `new` (D-0160,
  // replacing rule 2.5's whole repository).
  await reserved(store, input("old-r2", { supersedesIterationId: "old-closed" }));
  expect(claims().filter((row) => row["lineage_id"] === "old-closed")).toEqual([
    expect.objectContaining({ claim_id: "old-closed:1", paths: "[]", supersedes_claim_id: null }),
  ]);
});

const press = (iterationId: string) => ({
  iterationId,
  takenOver: null,
  landed: false,
  authorKind: "operator" as const,
  authorId: "oidc|operator-1",
  bases: [{ form: "iteration", iterationId }],
  nowMs: 7,
});

test("a landing's release is refused as stale when a claim row or a lap was written after the reading", async () => {
  const { store } = fresh();
  // '/' asked outright (D-0160), so `b`'s admission shows the release took.
  await reserved(store, input("a", { claim: whole }));
  await walk(store, "a", "closed");
  const read = await store.laneLine("a");
  if (read.kind !== "read") throw new Error("no line");
  expect(read.line.claim).toEqual({ claimId: "a:1", paths: ["/"] });
  const landed = (lapIds: readonly string[], claimId: string | null) => ({
    iterationId: "a",
    takenOver: { claimId, lapIds },
    landed: true,
    authorKind: "drafter" as const,
    authorId: LANE_LEDGER_AUTHOR,
    bases: [],
    nowMs: 9,
  });
  expect((await store.releaseLane(landed(["a", "a-r2"], "a:1"))).kind).toBe("refused");
  expect((await store.releaseLane(landed(["a"], null))).kind).toBe("refused");
  expect(await store.releaseLane(landed(["a"], "a:1"))).toEqual({
    kind: "released",
    lineageId: "a",
  });
  // Released once: a second reading over the same line holds nothing to release.
  expect((await store.releaseLane(landed(["a"], "a:2"))).kind).toBe("refused");
  await reserved(store, input("b", { claim: whole }));
});

test("first_landed is only a landing's release: never an abandon, a failure or the person's press (D-0098 rules 1.1 and 1.5)", async () => {
  const { store } = fresh();
  const landing = { form: "landing", branch: "main", commit: "c".repeat(40) };
  // The landing reading's release carries the landing basis.
  await reserved(store, input("a", { claim: asking(["src/"]) }));
  await walk(store, "a", "closed");
  expect(await store.landingOf("a")).toBeNull();
  expect(
    (
      await store.releaseLane({
        iterationId: "a",
        takenOver: { claimId: "a:1", lapIds: ["a"] },
        landed: true,
        authorKind: "drafter",
        authorId: LANE_LEDGER_AUTHOR,
        bases: [{ form: "iteration", iterationId: "a" }, landing],
        nowMs: 9,
      })
    ).kind,
  ).toBe("released");
  expect(await store.landingOf("a")).toEqual({ branch: "main", commit: "c".repeat(40), atMs: 9 });
  // Still read after a retry takes the claim back and ends without landing.
  await reserved(store, input("a-r2", { supersedesIterationId: "a" }));
  expect(await store.landingOf("a-r2")).toEqual({
    branch: "main",
    commit: "c".repeat(40),
    atMs: 9,
  });
  // The person's press, an abandon and a failure release with no landing.
  await reserved(store, input("b", { claim: asking(["docs/"]) }));
  await walk(store, "b", "closed");
  expect((await store.releaseLane(press("b"))).kind).toBe("released");
  await reserved(store, input("c", { claim: asking(["test/"]) }));
  expect((await store.transition("c", "planned", "abandoned", {}, 5)).kind).toBe("transitioned");
  await reserved(store, input("d", { claim: asking(["lib/"]) }));
  expect((await store.transition("d", "planned", "failed", {}, 5)).kind).toBe("transitioned");
  for (const id of ["b", "c", "d", "nobody"]) {
    expect(await store.landingOf(id), id).toBeNull();
  }
});

test("one in-force claim per line is the database's: a second successor of one head, or a second root, is refused", () => {
  const { connection } = fresh();
  const insert = (claimId: string, supersedes: string | null) =>
    connection
      .prepare(
        "INSERT INTO lane_claim (claim_id, lineage_id, repository, paths, supersedes_claim_id, " +
          "author_kind, author_id, bases, created_at_ms) VALUES (?, 'a', '/r', '[]', ?, 'drafter', 't', '[]', 1)",
      )
      .run(claimId, supersedes);
  insert("a:1", null);
  insert("a:2", "a:1");
  expect(() => insert("a:3", "a:1")).toThrow(/UNIQUE/);
  expect(() => insert("a:4", null)).toThrow(/UNIQUE/);
  expect(() => insert("a:5", "x")).not.toThrow();
  expect(() =>
    connection
      .prepare(
        "INSERT INTO lane_claim (claim_id, lineage_id, repository, paths, author_kind, author_id, " +
          "bases, created_at_ms) VALUES ('b:1', 'b', '/r', '[]', 'someone', 't', '[]', 1)",
      )
      .run(),
  ).toThrow(/CHECK/);
});

test("the capacity ledger still answers its own question beside the claim (rule 3.6)", async () => {
  const connection = new DatabaseSync(":memory:");
  const store = storeWithRequest(connection, CONSERVATIVE_HOST_POLICY);
  await reserved(store, input("a", { claim: asking(["a/"]) }));
  await reserved(store, input("b", { claim: asking(["b/"]) }));
  expect((await store.reserve(input("c", { claim: asking(["c/"]) }))).kind).toBe("atCapacity");
});

test("one repository spelled two ways is one ledger: a trailing '/' or a '.' segment is no second repository", async () => {
  const { store, claims } = fresh();
  // '/' asked outright: a line with no drafted claim is refused by nobody (D-0160).
  await reserved(store, input("a", { claim: whole }));
  for (const spelling of ["/srv/repo/", "/srv/./repo", "/srv//repo", "/srv/x/../repo"]) {
    expect(
      (await store.reserve(input(`b-${spelling}`, { repository: spelling, claim: whole }))).kind,
    ).toBe("laneRefused");
  }
  expect(claims().map((row) => row["repository"])).toEqual(["/srv/repo"]);
});

test("the ledger as the page reads it: what each line holds, whether it is in flight, and who released it (rule 12)", async () => {
  const { connection, store } = fresh();
  // Holding and in flight; holding and finished; landed (released by a
  // reading); released by a person; ended with nothing to land.
  await reserved(store, input("run", { claim: { ...asking(["src/run/"]), why: "it runs" } }));
  await reserved(store, input("kept", { claim: asking(["src/kept/"]) }));
  await walk(store, "kept", "closed");
  await reserved(store, input("landed", { claim: asking(["src/landed/"]) }));
  await walk(store, "landed", "closed");
  expect(
    await store.releaseLane({
      iterationId: "landed",
      takenOver: { claimId: "landed:1", lapIds: ["landed"] },
      landed: true,
      authorKind: "drafter",
      authorId: LANE_LEDGER_AUTHOR,
      bases: [],
      nowMs: 9,
    }),
  ).toEqual({ kind: "released", lineageId: "landed" });
  await reserved(store, input("pressed", { claim: asking(["src/pressed/"]) }));
  await walk(store, "pressed", "closed");
  expect((await store.releaseLane(press("pressed"))).kind).toBe("released");
  await reserved(store, input("gone", { claim: asking(["src/gone/"]) }));
  expect((await store.transition("gone", "planned", "abandoned", { reason: "x" }, 5)).kind).toBe(
    "transitioned",
  );
  // A line from before the ledger, in flight, holds the whole repository of
  // its own; another repository's, so nothing above is refused over it.
  connection
    .prepare(
      "INSERT INTO iteration (id, status, request, plan, plan_digest, attempts, identifiers_spent, " +
        "supersedes_iteration_id, created_at_ms, updated_at_ms) VALUES (?, ?, 'r', ?, 'x', 1, 1, NULL, 1, 1)",
    )
    .run("old", "awaiting_human", JSON.stringify({ repository: "/srv/other/." }));

  const byLine = new Map((await store.laneLedger()).map((line) => [line.lineageId, line]));
  expect(byLine.get("run")).toEqual({
    lineageId: "run",
    repository: REPOSITORY,
    claimId: "run:1",
    paths: ["src/run/"],
    why: "it runs",
    lapIds: ["run"],
    inFlight: true,
    closedTips: [],
    releasedBy: null,
  });
  expect(byLine.get("kept")).toMatchObject({
    paths: ["src/kept/"],
    inFlight: false,
    closedTips: ["kept"],
    releasedBy: null,
  });
  expect(byLine.get("landed")).toMatchObject({
    claimId: "landed:2",
    paths: [],
    closedTips: ["landed"],
    releasedBy: "rondo",
  });
  expect(byLine.get("pressed")).toMatchObject({ paths: [], releasedBy: "person" });
  expect(byLine.get("gone")).toMatchObject({ paths: [], closedTips: [], releasedBy: "rondo" });
  expect(byLine.get("old")).toEqual({
    lineageId: "old",
    repository: "/srv/other",
    claimId: null,
    paths: ["/"],
    why: null,
    lapIds: ["old"],
    inFlight: true,
    closedTips: [],
    releasedBy: null,
  });
  expect(byLine.size).toBe(6);
});
