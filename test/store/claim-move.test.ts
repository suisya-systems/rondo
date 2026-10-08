/**
 * A claim widened and narrowed while its line is open (D-0073 rules 4.1 and
 * 4.2, D-0163): one successor row the person writes, a widening only for work
 * still going and never onto another open line's paths, a narrowing only once
 * nothing of the line can still commit and never giving up a changed path.
 */
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import { changedDropped, claimMove, quiescent } from "../../src/store/lanes.js";
import type { LaneClaimAsk } from "../../src/store/records.js";
import type { LaneMoveInput, ReserveInput } from "../../src/store/sqlite.js";
import { REQUEST, storeWithRequest } from "../request-fixture.js";

const REPOSITORY = "/srv/repo";

const fresh = () => {
  const connection = new DatabaseSync(":memory:");
  const store = storeWithRequest(connection, { maxOccupying: 100, maxLive: 100 });
  const rows = (lineage: string) =>
    connection
      .prepare(
        "SELECT claim_id, paths, supersedes_claim_id, author_kind, author_id, bases " +
          "FROM lane_claim WHERE lineage_id = ? ORDER BY rowid",
      )
      .all(lineage) as Record<string, unknown>[];
  return { store, rows };
};

type Store = ReturnType<typeof fresh>["store"];

const asking = (paths: readonly string[]): LaneClaimAsk => ({
  paths,
  authorKind: "drafter",
  authorId: "rondo/advisory/test",
  bases: [{ form: "message", messageId: "m-1" }],
});

const input = (id: string, claim: LaneClaimAsk | null): ReserveInput => ({
  id,
  request: `do ${id}`,
  plan: { run_id: `r-${id}`, repository: REPOSITORY },
  runId: `rondo-${id}`,
  topicBranch: `rondo/${id}`,
  workspace: `/srv/work/${id}`,
  supersedesIterationId: null,
  requestMessageId: REQUEST,
  spend: null,
  scopeSpend: null,
  claim,
  numbers: null,
  nowMs: 1_000,
});

const reserved = async (store: Store, id: string, claim: LaneClaimAsk | null) => {
  const outcome = await store.reserve(input(id, claim));
  expect(outcome.kind, JSON.stringify(outcome)).toBe("reserved");
};

const PATH = ["planned", "classified", "admitting", "admitted", "performing", "awaiting_human"];

/** Walk a reserved row to `to` along legal edges, as the loop would. */
const walk = async (store: Store, id: string, to: "performing" | "awaiting_human" | "closed") => {
  const last = to === "closed" ? PATH.length - 1 : PATH.indexOf(to);
  for (let step = 1; step <= last; step += 1) {
    const from = PATH[step - 1] as "planned";
    const next = PATH[step] as "classified";
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

const move = (
  id: string,
  claimId: string,
  paths: readonly string[],
  changed: readonly string[] | null = [],
): LaneMoveInput => ({
  iterationId: id,
  takenOver: { claimId, lapIds: [id] },
  paths,
  changed,
  authorId: "oidc|operator-1",
  nowMs: 9,
});

test("the arithmetic: a move is what it takes and what it gives up, and nothing needs a pattern", () => {
  expect(claimMove(["src/"], ["src/", "docs/"])).toEqual({
    kind: "move",
    paths: ["docs/", "src/"],
    added: ["docs/"],
    dropped: [],
  });
  // A directory replaced with the file under it gives the rest of it up.
  expect(claimMove(["src/"], ["src/a.ts"])).toEqual({
    kind: "move",
    paths: ["src/a.ts"],
    added: [],
    dropped: ["src/"],
  });
  expect(claimMove(["src/"], ["src/a.ts", "src/"]).kind).toBe("refused");
  expect(claimMove(["src/"], [])).toMatchObject({ kind: "refused" });
  expect(claimMove(["src/"], ["src/*.ts"])).toMatchObject({ kind: "refused" });
  expect(changedDropped(["src/"], ["src/a.ts"], ["src/a.ts", "src/b.ts", "lib/c.ts"])).toEqual([
    "src/b.ts",
  ]);
  expect(quiescent([{ status: "awaiting_human" }, { status: "closed" }])).toBe(true);
  expect(quiescent([{ status: "withdrawal_requested" }])).toBe(true);
  expect(quiescent([{ status: "performing" }])).toBe(false);
  expect(quiescent([{ status: "stalled" }])).toBe(false);
});

test("a running line widens onto a free path as the person's row, and never onto another open line's", async () => {
  const { store, rows } = fresh();
  await reserved(store, "a", asking(["src/"]));
  await reserved(store, "b", asking(["docs/"]));
  await walk(store, "a", "performing");

  expect(await store.moveClaim(move("a", "a:1", ["src/", "docs/runbook.md"], null))).toEqual({
    kind: "held",
    holders: [{ lineageId: "b", sharedPaths: ["docs/runbook.md"] }],
  });
  expect(rows("a")).toHaveLength(1);

  expect(await store.moveClaim(move("a", "a:1", ["src/", "lib/"], null))).toEqual({
    kind: "moved",
    lineageId: "a",
    added: ["lib/"],
    dropped: [],
  });
  expect(rows("a")[1]).toEqual({
    claim_id: "a:2",
    paths: '["lib/","src/"]',
    supersedes_claim_id: "a:1",
    author_kind: "operator",
    author_id: "oidc|operator-1",
    bases: JSON.stringify([{ form: "iteration", iterationId: "a" }, { form: "widened" }]),
  });
  // It holds them now: an admission onto them is refused.
  expect((await store.reserve(input("c", asking(["lib/x.ts"])))).kind).toBe("laneRefused");
});

test("a narrowing waits until nothing of the line can commit, and keeps every path it changed", async () => {
  const { store, rows } = fresh();
  await reserved(store, "a", asking(["src/", "docs/"]));
  await walk(store, "a", "performing");
  expect(await store.moveClaim(move("a", "a:1", ["src/"]))).toEqual({ kind: "busy" });

  expect((await store.transition("a", "performing", "awaiting_human", {}, 3_000)).kind).toBe(
    "transitioned",
  );
  // Unread is answered as busy: what the line changed is not known.
  expect(await store.moveClaim(move("a", "a:1", ["src/"], null))).toEqual({ kind: "busy" });
  expect(await store.moveClaim(move("a", "a:1", ["src/"], ["docs/x.md", "src/y.ts"]))).toEqual({
    kind: "kept",
    paths: ["docs/x.md"],
  });
  expect(rows("a")).toHaveLength(1);

  // At its gate, with docs/ untouched: given to other work at once (C5).
  expect(await store.moveClaim(move("a", "a:1", ["src/"], ["src/y.ts"]))).toEqual({
    kind: "moved",
    lineageId: "a",
    added: [],
    dropped: ["docs/"],
  });
  await reserved(store, "b", asking(["docs/"]));
  // A directory replaced with the file it changed gives the rest of it up.
  expect(
    await store.moveClaim({ ...move("a", "a:2", ["src/y.ts"], ["src/y.ts"]), nowMs: 10 }),
  ).toMatchObject({ kind: "moved", dropped: ["src/"] });
  await reserved(store, "c", asking(["src/z.ts"]));
});

test("a move over a line that moved under the screen, or one holding nothing, writes nothing", async () => {
  const { store, rows } = fresh();
  await reserved(store, "a", asking(["src/"]));
  await walk(store, "a", "awaiting_human");
  expect(await store.moveClaim(move("a", "a:0", ["src/a.ts"]))).toEqual({ kind: "stale" });
  expect(
    await store.moveClaim({
      ...move("a", "a:1", ["src/a.ts"]),
      takenOver: { claimId: "a:1", lapIds: [] },
    }),
  ).toEqual({ kind: "stale" });
  // Empty is a release, which is its own press.
  expect(await store.moveClaim(move("a", "a:1", []))).toMatchObject({ kind: "refused" });
  expect(await store.moveClaim(move("a", "a:1", ["src/"]))).toMatchObject({ kind: "refused" });
  expect(rows("a")).toHaveLength(1);

  // A line that declared nothing is claimed by its gate, not by this press (D-0160).
  await reserved(store, "free", null);
  await walk(store, "free", "performing");
  expect(await store.moveClaim(move("free", "free:1", ["lib/"]))).toMatchObject({
    kind: "refused",
  });
});

test("a finished line takes no more paths but still gives untouched ones up", async () => {
  const { store } = fresh();
  await reserved(store, "a", asking(["src/", "docs/"]));
  await walk(store, "a", "closed");
  expect(await store.moveClaim(move("a", "a:1", ["src/", "docs/", "lib/"], null))).toMatchObject({
    kind: "refused",
  });
  expect(await store.moveClaim(move("a", "a:1", ["src/"], ["src/a.ts"]))).toMatchObject({
    kind: "moved",
    dropped: ["docs/"],
  });
});

test("a line whose gate claims what it changed keeps that after the person moves it (D-0160)", async () => {
  const { store, rows } = fresh();
  await reserved(store, "free", null);
  await walk(store, "free", "awaiting_human");
  expect(
    await store.claimChanged({ iterationId: "free", paths: ["src/a.ts", "docs/b.md"], nowMs: 5 }),
  ).toMatchObject({ kind: "claimed" });
  expect(await store.moveClaim(move("free", "free:2", ["src/a.ts"], ["src/a.ts"]))).toMatchObject({
    kind: "moved",
    dropped: ["docs/b.md"],
  });
  expect(JSON.parse(String(rows("free")[2]?.["bases"]))).toContainEqual({ form: "changed" });
});

test("a move that both widens and narrows a running line is refused whole: nothing is written", async () => {
  const { store, rows } = fresh();
  await reserved(store, "a", asking(["src/"]));
  await walk(store, "a", "performing");
  expect(await store.moveClaim(move("a", "a:1", ["lib/"], null))).toEqual({ kind: "busy" });
  expect(rows("a")).toHaveLength(1);
});
