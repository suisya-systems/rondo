/**
 * A line gives its paths up when its pull request opens (D-0114, rondo#441):
 * other work may take them at once, the line keeps its decision-record
 * numbers and is still owed its landing, which a later release writes over
 * the publish's (`first_landed`, D-0098 rule 1.1), and a redo takes back the
 * paths the publish gave up.
 */
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import { releasePublished } from "../../src/access/merge.js";
import type { LaneClaimAsk } from "../../src/store/records.js";
import { LANE_LEDGER_AUTHOR, type ReserveInput } from "../../src/store/sqlite.js";
import { REQUEST, storeWithRequest } from "../request-fixture.js";

const REPOSITORY = "/srv/repo";
const URL = "https://github.com/o/r/pull/7";

const fresh = () =>
  storeWithRequest(new DatabaseSync(":memory:"), { maxOccupying: 100, maxLive: 100 });

type Store = ReturnType<typeof fresh>;

const asking = (paths: readonly string[]): LaneClaimAsk => ({
  paths,
  authorKind: "drafter",
  authorId: "rondo/advisory/test",
  bases: [{ form: "message", messageId: "m-1" }],
});

const input = (id: string, parts: Partial<ReserveInput> = {}): ReserveInput => ({
  id,
  request: `do ${id}`,
  plan: { run_id: `r-${id}`, repository: REPOSITORY, decision_record: "DECISIONS.md" },
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

const lineOf = async (store: Store, id: string) =>
  (await store.laneLedger()).find((line) => line.lapIds.includes(id));

const landing = (store: Store, id: string, claimId: string, lapIds: readonly string[]) =>
  store.releaseLane({
    iterationId: id,
    takenOver: { claimId, lapIds },
    landed: true,
    authorKind: "drafter",
    authorId: LANE_LEDGER_AUTHOR,
    bases: [{ form: "landing", branch: "main", commit: "c0ffee" }],
    nowMs: 9,
  });

test("a publish frees the paths and keeps the numbers; the line is still owed its landing", async () => {
  const store = fresh();
  await reserved(store, input("a", { claim: asking(["src/a/"]), numbers: [10] }));
  // At its gate the line keeps its paths, and the publish says so.
  await walk(store, "a", "awaiting_human");
  expect(await releasePublished(store, "a", URL, 5)).toMatch(/not released/);
  expect((await store.reserve(input("b", { claim: asking(["src/a/x.ts"]) }))).kind).toBe(
    "laneRefused",
  );
  await store.transition("a", "awaiting_human", "closed", { gateOutcome: "approved" }, 3_000);

  expect(await releasePublished(store, "a", URL, 6)).toBe(
    "Its files were released: its pull request is open.",
  );
  await reserved(store, input("b", { claim: asking(["src/a/x.ts"]) }));
  expect(await lineOf(store, "a")).toMatchObject({ paths: [], releasedBy: null });
  expect((await store.numberReservations("a")).map((one) => one.released)).toEqual([false]);
  expect(await store.landingOf("a")).toBeNull();
  // A second publish of the same line has nothing to give up.
  expect(await releasePublished(store, "a", URL, 7)).toMatch(/nothing to release/);

  // The landing is written over the publish's row, and reads as `first_landed`.
  expect((await landing(store, "a", "a:2", ["a"])).kind).toBe("released");
  expect(await store.landingOf("a")).toEqual(
    expect.objectContaining({ branch: "main", commit: "c0ffee" }),
  );
  expect(await lineOf(store, "a")).toMatchObject({ releasedBy: "rondo" });
  expect((await store.numberReservations("a")).map((one) => one.released)).toEqual([false]);
  // And nothing more is written over a landing.
  expect((await landing(store, "a", "a:3", ["a"])).kind).toBe("refused");
});

test("the person's press ends a published line and gives its numbers up", async () => {
  const store = fresh();
  await reserved(store, input("a", { claim: asking(["src/a/"]), numbers: [10] }));
  await walk(store, "a", "closed");
  await releasePublished(store, "a", null, 6);
  const pressed = await store.releaseLane({
    iterationId: "a",
    takenOver: null,
    landed: false,
    authorKind: "operator",
    authorId: "oidc|operator-1",
    bases: [{ form: "iteration", iterationId: "a" }],
    nowMs: 9,
  });
  expect(pressed.kind).toBe("released");
  expect(await lineOf(store, "a")).toMatchObject({ releasedBy: "person" });
  expect((await store.numberReservations("a")).map((one) => one.released)).toEqual([true]);
});

test("a redo of a published line takes back the paths its publish gave up, and waits on a holder", async () => {
  const store = fresh();
  await reserved(store, input("a", { claim: asking(["src/a/"]) }));
  await walk(store, "a", "closed");
  await releasePublished(store, "a", URL, 6);
  await reserved(store, input("b", { claim: asking(["src/a/x.ts"]) }));
  // A conflict fix is a lap, and a lap holds its paths: it waits for `b`.
  expect(await store.reserve(input("a-r2", { supersedesIterationId: "a" }))).toMatchObject({
    kind: "laneRefused",
    holders: [{ lineageId: "b" }],
  });
  await walk(store, "b", "closed");
  await releasePublished(store, "b", URL, 7);
  await reserved(store, input("a-r2", { supersedesIterationId: "a" }));
  expect(await lineOf(store, "a")).toMatchObject({ paths: ["src/a/"] });
});

test("a redo after a landing over a publish takes back the paths, not the whole repository", async () => {
  const store = fresh();
  await reserved(store, input("a", { claim: asking(["src/a/"]) }));
  await walk(store, "a", "closed");
  await releasePublished(store, "a", URL, 6);
  expect((await landing(store, "a", "a:2", ["a"])).kind).toBe("released");
  await reserved(store, input("a-r2", { supersedesIterationId: "a" }));
  expect(await lineOf(store, "a")).toMatchObject({ paths: ["src/a/"] });
});
