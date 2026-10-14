/**
 * A widening that waits for another line's files (D-0073 rule 4.1, D-0201):
 * kept as a row by the person's press or by the gate under an approval, and
 * written by the order tick once the files are free, with no second press --
 * across a host restart too. Inside an approved scope the gate's rows are
 * recorded against that approval (rule 4.4, Scope binding); outside every
 * scope it writes nothing.
 *
 * The store is real throughout: every claim here is about which rows exist.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import { orderHost } from "../../src/access/order-host.js";
import { contentDigest } from "../../src/store/plan.js";
import type { JsonRecord, LaneClaimAsk } from "../../src/store/records.js";
import {
  advisoryRecord,
  type IterationStore,
  iterationStore,
  type LaneMoveInput,
} from "../../src/store/sqlite.js";
import { openRequest } from "../request-fixture.js";

const ROOMY = { maxOccupying: 100, maxLive: 100 };
const REQUEST = "m-0001";
const REPOSITORY = "/srv/repo";
const AGENT_TYPE = `sha256:${"a".repeat(64)}`;

const SCOPE: JsonRecord = {
  requests: [REQUEST],
  workspaces: [{ repository: REPOSITORY, workspace_root: "/srv/work" }],
  agent_types: [AGENT_TYPE],
  budgets: {
    laps: 6,
    review_rounds: 3,
    cost_usd: 50,
    cost_reserve_usd: 5,
    expires_at_ms: 1_000_000,
  },
  severity_threshold: "major",
  outward_acts: [],
  irreversible_additions: [],
};

const asking = (paths: readonly string[]): LaneClaimAsk => ({
  paths,
  authorKind: "drafter",
  authorId: "rondo/advisory/test",
  bases: [],
});

/** A store over `connection` with the request and one approved scope, `sd-1`. */
async function world(connection: DatabaseSync) {
  const store = iterationStore(connection, ROOMY);
  await openRequest(connection, REQUEST);
  const record = advisoryRecord(connection);
  // The agent type the scope names, already on a row (D-0062 rule 1.2).
  connection
    .prepare(
      "INSERT INTO iteration (id, status, request, plan, plan_digest, attempts, " +
        "agent_type_digest, created_at_ms, updated_at_ms) " +
        "VALUES ('i-held', 'closed', 'r', '{}', 'x', 1, ?, 1, 1)",
    )
    .run(AGENT_TYPE);
  expect(
    await record.recordScope({
      scopeId: "s-1",
      payload: SCOPE,
      supersedesScopeId: null,
      authorKind: "operator",
      authorId: "ada",
      bases: [],
      createdAtMs: 1_000,
      agentTypeRecords: [],
    }),
  ).toEqual({ kind: "recorded" });
  expect(
    await record.recordScopeDecision({
      scopeDecisionId: "sd-1",
      scopeId: "s-1",
      scopeDigest: contentDigest(SCOPE),
      outcome: "approved",
      actorId: "ada",
      recordedBy: "rondo/cli",
      decidedAtMs: 2_000,
    }),
  ).toEqual({ kind: "recorded" });
  const rows = (table: string, where: string, value: string) =>
    connection.prepare(`SELECT * FROM ${table} WHERE ${where} = ? ORDER BY rowid`).all(value);
  return { store, rows };
}

const reserve = async (
  store: IterationStore,
  id: string,
  paths: readonly string[],
  scoped: boolean,
) => {
  const outcome = await store.reserve({
    numbers: null,
    id,
    request: `do ${id}`,
    plan: { run_id: `r-${id}`, repository: REPOSITORY, workspace_root: "/srv/work" },
    runId: `rondo-${id}`,
    topicBranch: `rondo/${id}`,
    workspace: `/srv/work/iter-${id}`,
    supersedesIterationId: null,
    requestMessageId: REQUEST,
    spend: null,
    scopeSpend: scoped
      ? { scopeDecisionId: "sd-1", proposalId: null, agentTypeDigest: AGENT_TYPE }
      : null,
    claim: asking(paths),
    nowMs: 5_000,
  });
  expect(outcome.kind, JSON.stringify(outcome)).toBe("reserved");
};

const PATH = ["planned", "classified", "admitting", "admitted", "performing", "awaiting_human"];

const walk = async (store: IterationStore, id: string, to: "performing" | "awaiting_human") => {
  for (let step = 1; step <= PATH.indexOf(to); step += 1) {
    const from = PATH[step - 1] as "planned";
    const next = PATH[step] as "classified";
    expect((await store.transition(id, from, next, {}, 5_000 + step)).kind).toBe("transitioned");
  }
};

/** End line `id` at its gate and release what it holds, as the person's release press. */
const finishAndRelease = async (store: IterationStore, id: string) => {
  expect(
    (
      await store.transition(
        id,
        "awaiting_human",
        "closed",
        { gateOutcome: "answered_and_forwarded" },
        6_000,
      )
    ).kind,
  ).toBe("transitioned");
  expect(
    (
      await store.releaseLane({
        iterationId: id,
        takenOver: null,
        landed: false,
        authorKind: "operator",
        authorId: "ada",
        bases: [],
        nowMs: 6_100,
      })
    ).kind,
  ).toBe("released");
};

const press = (id: string, claimId: string, paths: readonly string[]): LaneMoveInput => ({
  iterationId: id,
  takenOver: { claimId, lapIds: [id] },
  paths,
  changed: null,
  authorId: "ada",
  nowMs: 5_500,
});

const head = async (store: IterationStore, id: string) => {
  const line = await store.laneLine(id);
  return line.kind === "read" ? line.line.claim?.paths : undefined;
};

test("a press onto held files writes what it can now and keeps the rest waiting", async () => {
  const { store } = await world(new DatabaseSync(":memory:"));
  await reserve(store, "a", ["src/"], false);
  await reserve(store, "b", ["docs/"], false);
  await walk(store, "a", "performing");
  await walk(store, "b", "awaiting_human");

  expect(await store.moveClaim(press("a", "a:1", ["src/", "lib/", "docs/x.md"]))).toEqual({
    kind: "waits",
    lineageId: "a",
    added: ["lib/"],
    dropped: [],
    waiting: ["docs/x.md"],
    holders: [{ lineageId: "b", sharedPaths: ["docs/x.md"] }],
  });
  expect(await head(store, "a")).toEqual(["lib/", "src/"]);
  // Waiting is all it does while b holds them: no second line holds one path.
  const [wait] = await store.heldWidenings();
  expect(await store.applyHeldWidening(wait?.wideningId ?? "", 5_600)).toMatchObject({
    kind: "waits",
  });
  expect(await head(store, "a")).toEqual(["lib/", "src/"]);

  // b lets them go: the wait is written as the person's row, with no press.
  await finishAndRelease(store, "b");
  expect(await store.applyHeldWidening(wait?.wideningId ?? "", 6_200)).toEqual({
    kind: "applied",
    lineageId: "a",
    added: ["docs/x.md"],
  });
  expect(await head(store, "a")).toEqual(["docs/x.md", "lib/", "src/"]);
  expect(await store.heldWidenings()).toEqual([]);
  const line = await store.laneLedger();
  expect(line.find((one) => one.lineageId === "a")?.claimId).toBe("a:3");
});

test("a press whose every kept file is held is refused, since keeping none is a release", async () => {
  const { store } = await world(new DatabaseSync(":memory:"));
  await reserve(store, "a", ["src/"], false);
  await reserve(store, "b", ["docs/"], false);
  await walk(store, "a", "awaiting_human");
  expect(await store.moveClaim(press("a", "a:1", ["docs/x.md"]))).toMatchObject({
    kind: "refused",
  });
  expect(await store.heldWidenings()).toEqual([]);
});

test("a wait ends with nothing written once its line has ended", async () => {
  const { store } = await world(new DatabaseSync(":memory:"));
  await reserve(store, "a", ["src/"], false);
  await reserve(store, "b", ["docs/"], false);
  await walk(store, "a", "awaiting_human");
  await walk(store, "b", "awaiting_human");
  await store.moveClaim(press("a", "a:1", ["src/", "docs/x.md"]));
  const [wait] = await store.heldWidenings();
  // a ends with an unmerged closed lap: it keeps its claim, and takes no more.
  expect(
    (
      await store.transition(
        "a",
        "awaiting_human",
        "closed",
        { gateOutcome: "answered_and_forwarded" },
        6_000,
      )
    ).kind,
  ).toBe("transitioned");
  await finishAndRelease(store, "b");
  expect(await store.applyHeldWidening(wait?.wideningId ?? "", 7_000)).toMatchObject({
    kind: "ended",
  });
  expect(await head(store, "a")).toEqual(["src/"]);
  expect(await store.heldWidenings()).toEqual([]);
});

test("inside an approved scope the gate widens a drafted claim and records each row against the approval", async () => {
  const { store, rows } = await world(new DatabaseSync(":memory:"));
  await reserve(store, "a", ["src/"], true);
  await reserve(store, "b", ["docs/"], false);
  await walk(store, "a", "awaiting_human");
  await walk(store, "b", "awaiting_human");

  expect(
    await store.widenAtGate({ iterationId: "a", paths: ["lib/x.ts", "docs/y.md"], nowMs: 5_700 }),
  ).toEqual({
    kind: "widened",
    lineageId: "a",
    scopeDecisionId: "sd-1",
    added: ["lib/x.ts"],
    waiting: ["docs/y.md"],
  });
  expect(await head(store, "a")).toEqual(["lib/x.ts", "src/"]);
  expect(rows("scope_consumption", "act_kind", "claim_move")).toMatchObject([
    { scope_decision_id: "sd-1", subject_id: "a:2" },
  ]);
  expect(JSON.parse(String(rows("lane_claim", "claim_id", "a:2")[0]?.["bases"]))).toContainEqual({
    form: "scope_decision",
    scopeDecisionId: "sd-1",
  });
  // The same gate looked at again writes nothing twice.
  await store.widenAtGate({ iterationId: "a", paths: ["lib/x.ts", "docs/y.md"], nowMs: 5_800 });
  expect(await store.heldWidenings()).toHaveLength(1);
  expect(rows("scope_consumption", "act_kind", "claim_move")).toHaveLength(1);

  // The held one is written once b lets it go, and recorded against the same approval.
  await finishAndRelease(store, "b");
  const [wait] = await store.heldWidenings();
  expect(wait).toMatchObject({ authorKind: "drafter", scopeDecisionId: "sd-1" });
  expect((await store.applyHeldWidening(wait?.wideningId ?? "", 6_200)).kind).toBe("applied");
  expect(await head(store, "a")).toEqual(["docs/y.md", "lib/x.ts", "src/"]);
  expect(rows("scope_consumption", "act_kind", "claim_move")).toMatchObject([
    { subject_id: "a:2" },
    { subject_id: "a:3" },
  ]);
});

test("outside every scope, or under an approval no longer in force, the gate writes nothing", async () => {
  const { store, rows } = await world(new DatabaseSync(":memory:"));
  await reserve(store, "a", ["src/"], false);
  await reserve(store, "c", ["etc/"], true);
  await walk(store, "a", "awaiting_human");
  await walk(store, "c", "awaiting_human");
  expect(await store.widenAtGate({ iterationId: "a", paths: ["lib/x.ts"], nowMs: 5_700 })).toEqual({
    kind: "unscoped",
  });
  expect(await head(store, "a")).toEqual(["src/"]);
  // Past the approval's expiry.
  expect(
    await store.widenAtGate({ iterationId: "c", paths: ["lib/x.ts"], nowMs: 2_000_000 }),
  ).toMatchObject({ kind: "retired" });
  expect(await head(store, "c")).toEqual(["etc/"]);
  expect(rows("scope_consumption", "act_kind", "claim_move")).toEqual([]);
  expect(await store.heldWidenings()).toEqual([]);
});

test("the order tick writes a wait kept before a restart, with no press", async () => {
  const path = join(mkdtempSync(join(tmpdir(), "rondo-held-widening-")), "store.db");
  const before = await world(new DatabaseSync(path));
  await reserve(before.store, "a", ["src/"], false);
  await reserve(before.store, "b", ["docs/"], false);
  await walk(before.store, "a", "performing");
  await walk(before.store, "b", "awaiting_human");
  expect((await before.store.moveClaim(press("a", "a:1", ["src/", "docs/x.md"]))).kind).toBe(
    "waits",
  );
  await finishAndRelease(before.store, "b");

  // A new process over the same file: only the row carries the wait.
  const store = iterationStore(new DatabaseSync(path), ROOMY);
  const log: string[] = [];
  const tick = orderHost({
    record: {} as never,
    splits: async () => [],
    readiness: async () => {
      throw new Error("no split to read");
    },
    readHolder: async () => ({ released: false, line: "" }),
    start: async () => {
      throw new Error("nothing to start");
    },
    held: null,
    widenings: { store },
    now: () => 7_000,
    log: (line) => {
      log.push(line);
    },
  });
  tick.kick();
  await tick.settled();
  expect(await head(store, "a")).toEqual(["docs/x.md", "src/"]);
  expect(await store.heldWidenings()).toEqual([]);
  expect(log).toEqual(["order    line a took docs/x.md once other work let them go"]);
});

test("the order tick reads a finished holder's landing before it waits on", async () => {
  const { store } = await world(new DatabaseSync(":memory:"));
  await reserve(store, "a", ["src/"], false);
  await reserve(store, "b", ["docs/"], false);
  await walk(store, "a", "performing");
  await walk(store, "b", "awaiting_human");
  await store.moveClaim(press("a", "a:1", ["src/", "docs/x.md"]));
  // b is finished and still holds its files until its landing is read.
  expect(
    (
      await store.transition(
        "b",
        "awaiting_human",
        "closed",
        { gateOutcome: "answered_and_forwarded" },
        6_000,
      )
    ).kind,
  ).toBe("transitioned");
  const read: string[] = [];
  const tick = orderHost({
    record: {} as never,
    splits: async () => [],
    readiness: async () => {
      throw new Error("no split to read");
    },
    // The landing reading releases b, as `readHolder` does when it landed.
    readHolder: async (lineageId) => {
      read.push(lineageId);
      const released = await store.releaseLane({
        iterationId: lineageId,
        takenOver: null,
        landed: true,
        authorKind: "drafter",
        authorId: "rondo/lane-ledger/1",
        bases: [],
        nowMs: 6_500,
      });
      return { released: released.kind === "released", line: "" };
    },
    start: async () => {
      throw new Error("nothing to start");
    },
    held: null,
    widenings: { store },
    now: () => 7_000,
    log: () => undefined,
  });
  tick.kick();
  await tick.settled();
  expect(read).toEqual(["b"]);
  expect(await head(store, "a")).toEqual(["docs/x.md", "src/"]);
});
