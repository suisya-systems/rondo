/**
 * Decision-record numbers in the store (D-0098 rule 3): `reserve()` writes a
 * line's reservations beside its first claim, both or neither; a number is
 * handed out once, released ones included; every release that is not a
 * landing gives the numbers up; and the record is a shared-append path two
 * open lines may both claim.
 */
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import type { LaneClaimAsk } from "../../src/store/records.js";
import { LANE_LEDGER_AUTHOR, type ReserveInput } from "../../src/store/sqlite.js";
import { REQUEST, storeWithRequest } from "../request-fixture.js";

const REPOSITORY = "/srv/repo";
const RECORD = "DECISIONS.md";

const fresh = () => {
  const connection = new DatabaseSync(":memory:");
  const store = storeWithRequest(connection, { maxOccupying: 100, maxLive: 100 });
  const rows = () =>
    connection
      .prepare(
        "SELECT reservation_id, repository, record, number, lineage_id, releases_reservation_id " +
          "FROM number_reservation ORDER BY rowid",
      )
      .all() as Record<string, unknown>[];
  return { connection, store, rows };
};

type Store = ReturnType<typeof fresh>["store"];

const asking = (paths: readonly string[]): LaneClaimAsk => ({
  paths,
  authorKind: "drafter",
  authorId: "rondo/advisory/test",
  bases: [{ form: "message", messageId: "m-1" }],
});

const input = (id: string, parts: Partial<ReserveInput> = {}): ReserveInput => ({
  id,
  request: `do ${id}`,
  plan: { run_id: `r-${id}`, repository: REPOSITORY, decision_record: RECORD },
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
  ...parts,
});

const reserved = async (store: Store, reserve: ReserveInput) => {
  const outcome = await store.reserve(reserve);
  expect(outcome.kind, JSON.stringify(outcome)).toBe("reserved");
};

const walk = async (store: Store, id: string, to: "awaiting_human" | "closed") => {
  const path = ["planned", "classified", "admitting", "admitted", "performing", "awaiting_human"];
  for (let step = 1; step < path.length; step += 1) {
    const from = path[step - 1] as "planned";
    const next = path[step] as "classified";
    expect((await store.transition(id, from, next, {}, 1_000 + step)).kind).toBe("transitioned");
  }
  if (to === "closed") {
    const closed = await store.transition(
      id,
      "awaiting_human",
      "closed",
      { gateOutcome: "answered_and_forwarded" },
      2_000,
    );
    expect(closed.kind).toBe("transitioned");
  }
};

const numbersOf = async (store: Store, id: string) =>
  (await store.numberReservations(id)).map((one) => [one.number, one.released]);

test("numbers are written beside the first claim, and a refused admission writes neither", async () => {
  const { store, rows } = fresh();
  await reserved(store, input("a", { claim: asking(["src/a/", RECORD]), numbers: [112, 113] }));
  expect(rows()).toEqual([
    {
      reservation_id: "a:n112",
      repository: REPOSITORY,
      record: RECORD,
      number: 112,
      lineage_id: "a",
      releases_reservation_id: null,
    },
    {
      reservation_id: "a:n113",
      repository: REPOSITORY,
      record: RECORD,
      number: 113,
      lineage_id: "a",
      releases_reservation_id: null,
    },
  ]);
  expect(await store.highestReserved(REPOSITORY, RECORD)).toBe(113);
  // A lane refusal is before the numbers are written: nothing of it lands.
  const refused = await store.reserve(
    input("b", { claim: asking(["src/a/x.ts"]), numbers: [114] }),
  );
  expect(refused.kind).toBe("laneRefused");
  expect(rows()).toHaveLength(2);
  expect(await store.highestReserved(REPOSITORY, RECORD)).toBe(113);
});

test("a number another admission took since the caller read is refused, and nothing is written", async () => {
  const { store, rows } = fresh();
  await reserved(store, input("a", { claim: asking(["src/a/"]), numbers: [5] }));
  expect(await store.reserve(input("b", { claim: asking(["src/b/"]), numbers: [5] }))).toEqual({
    kind: "numbersMoved",
    highest: 5,
  });
  expect((await store.read("b")).kind).toBe("absent");
  expect(rows()).toHaveLength(1);
  // Numbers a plan names no record for, or that are not consecutive, are the caller's defect.
  expect(
    (
      await store.reserve(
        input("c", {
          plan: { run_id: "r-c", repository: REPOSITORY },
          claim: asking(["src/c/"]),
          numbers: [6],
        }),
      )
    ).kind,
  ).toBe("defect");
  expect(
    (await store.reserve(input("d", { claim: asking(["src/d/"]), numbers: [6, 8] }))).kind,
  ).toBe("defect");
});

test("the database refuses a second reservation of one number, released or not", () => {
  const { connection } = fresh();
  const insert = connection.prepare(
    "INSERT INTO number_reservation (reservation_id, repository, record, number, lineage_id, " +
      "releases_reservation_id, bases, created_at_ms) VALUES (?, ?, ?, 7, ?, ?, '[]', 1)",
  );
  insert.run("a:n7", REPOSITORY, RECORD, "a", null);
  insert.run("a:n7:released", REPOSITORY, RECORD, "a", "a:n7");
  expect(() => insert.run("b:n7", REPOSITORY, RECORD, "b", null)).toThrow(/UNIQUE/);
  // Another record, or another repository, is another sequence.
  insert.run("c:n7", REPOSITORY, "docs/ADR.md", "c", null);
  insert.run("d:n7", "/srv/other", RECORD, "d", null);
});

test("a line that ends, abandoned, failed or settled, gives its numbers up and they are never handed out again", async () => {
  const { store } = fresh();
  await reserved(store, input("gone", { claim: asking(["src/gone/"]), numbers: [1] }));
  expect((await store.transition("gone", "planned", "abandoned", {}, 5)).kind).toBe("transitioned");
  expect(await numbersOf(store, "gone")).toEqual([[1, true]]);

  await reserved(store, input("broke", { claim: asking(["src/broke/"]), numbers: [2] }));
  expect((await store.transition("broke", "planned", "failed", {}, 5)).kind).toBe("transitioned");
  expect(await numbersOf(store, "broke")).toEqual([[2, true]]);

  // A released number is a gap: the next is above it.
  expect(await store.highestReserved(REPOSITORY, RECORD)).toBe(2);
  expect(
    await store.reserve(input("again", { claim: asking(["src/again/"]), numbers: [2] })),
  ).toEqual({ kind: "numbersMoved", highest: 2 });

  await reserved(store, input("stuck", { claim: asking(["src/stuck/"]), numbers: [3] }));
  expect((await store.settle("stuck", "gone", 6)).kind).toBe("settled");
  expect(await numbersOf(store, "stuck")).toEqual([[3, true]]);
});

test("a landing keeps the line's numbers, and the person's press or nothing to land releases them", async () => {
  const { store } = fresh();
  const release = (iterationId: string, landed: boolean) =>
    store.releaseLane({
      iterationId,
      takenOver: landed ? { claimId: `${iterationId}:1`, lapIds: [iterationId] } : null,
      landed,
      authorKind: landed ? "drafter" : "operator",
      authorId: landed ? LANE_LEDGER_AUTHOR : "oidc|operator-1",
      bases: [{ form: "iteration", iterationId }],
      nowMs: 9,
    });
  await reserved(store, input("landed", { claim: asking(["src/landed/"]), numbers: [10] }));
  await walk(store, "landed", "closed");
  expect((await release("landed", true)).kind).toBe("released");
  expect(await numbersOf(store, "landed")).toEqual([[10, false]]);

  await reserved(store, input("pressed", { claim: asking(["src/pressed/"]), numbers: [11] }));
  await walk(store, "pressed", "closed");
  expect((await release("pressed", false)).kind).toBe("released");
  expect(await numbersOf(store, "pressed")).toEqual([[11, true]]);
});

test("one more number is reserved at a redo, on the line's lineage, without a second claim", async () => {
  const { store } = fresh();
  await reserved(store, input("a", { claim: asking(["src/a/"]), numbers: [20] }));
  await walk(store, "a", "closed");
  await reserved(store, input("a-r2", { supersedesIterationId: "a", numbers: [21] }));
  expect(await numbersOf(store, "a-r2")).toEqual([
    [20, false],
    [21, false],
  ]);
});

test("the record is a shared-append path: two open lines both claim it, and nothing else is shared", async () => {
  const { store } = fresh();
  await reserved(store, input("a", { claim: asking(["src/a/", RECORD]), numbers: [1] }));
  await reserved(store, input("b", { claim: asking(["src/b/", RECORD]), numbers: [2] }));
  const refused = await store.reserve(input("c", { claim: asking(["src/a/", RECORD]) }));
  expect(refused).toMatchObject({
    kind: "laneRefused",
    holders: [{ lineageId: "a", sharedPaths: ["src/a/"] }],
  });
  // A plan naming no record shares it as an ordinary path.
  const plain = await store.reserve(
    input("d", { plan: { run_id: "r-d", repository: REPOSITORY }, claim: asking([RECORD]) }),
  );
  expect(plain.kind).toBe("laneRefused");
  // Changing the record is neither outside the claim nor a collision.
  expect(await store.compareLane({ iterationId: "a", paths: [RECORD, "src/b/x.ts"] })).toEqual({
    kind: "compared",
    lineageId: "a",
    unheld: [],
    held: [{ lineageId: "b", sharedPaths: ["src/b/x.ts"] }],
  });
});
