/**
 * D-0139 (rondo#506): a lap whose rondo process died while it performed is
 * found, ended `failed` with `lost`, and started again by itself once or asked
 * about -- a restart of the host while a lap performs, over a real store file.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";
import { endLost } from "../../src/access/conductor.js";
import {
  againId,
  type LostLapPorts,
  lapLost,
  lostAskId,
  lostLapHost,
  pidAlive,
  startsAgainOnCarryOn,
  stoppedLapOf,
} from "../../src/access/lost-laps.js";
import { EN } from "../../src/access/wording.js";
import { planDigest } from "../../src/store/plan.js";
import type { IterationRecord, PerformingLap } from "../../src/store/records.js";
import { advisoryRecord, iterationStore } from "../../src/store/sqlite.js";

const HOST = "this-host";
const CEILING = 60_000;
const PLAN = { invocation_ceiling_ms: CEILING };

test("a lap is lost only when, on this host, its driver and its child are both gone", () => {
  const lap = (over: Partial<PerformingLap>): PerformingLap => ({
    iterationId: "i",
    driverHost: HOST,
    driverPid: 10,
    lapPid: 11,
    updatedAtMs: 0,
    ...over,
  });
  const dead = () => false;
  const only = (pid: number) => (p: number) => p === pid;
  expect(lapLost(lap({}), CEILING, 1, HOST, dead)).toBe(true);
  // Either still alive: D-0019 rule 12's hold.
  expect(lapLost(lap({}), CEILING, 1, HOST, only(10))).toBe(false);
  expect(lapLost(lap({}), CEILING, 1, HOST, only(11))).toBe(false);
  // Another host's pids say nothing here.
  expect(lapLost(lap({ driverHost: "elsewhere" }), CEILING, 1, HOST, dead)).toBe(false);
  // No child recorded: none spawned, or its pid was never written. The ceiling decides.
  expect(lapLost(lap({ lapPid: null }), CEILING, CEILING, HOST, dead)).toBe(false);
  expect(lapLost(lap({ lapPid: null }), CEILING, CEILING + 1, HOST, dead)).toBe(true);
  expect(lapLost(lap({ lapPid: null }), CEILING, CEILING + 1, HOST, only(10))).toBe(false);
  // Sent before the pids were written: its ceiling decides.
  const unmarked = lap({ driverHost: null, driverPid: null, lapPid: null });
  expect(lapLost(unmarked, CEILING, CEILING, HOST, dead)).toBe(false);
  expect(lapLost(unmarked, CEILING, CEILING + 1, HOST, dead)).toBe(true);
  expect(lapLost(unmarked, null, 10 * CEILING, HOST, dead)).toBe(false);
});

test("D-0149: carry on starts a lap again when it was lost or stopped at its budget or its time limit", () => {
  const row = (over: Partial<IterationRecord>) =>
    ({
      status: "failed",
      failureKind: "refusal",
      reason: "no",
      workspace: "/w",
      topicBranch: "rondo/lap-1",
      ...over,
    }) as IterationRecord;
  const timedOut =
    "session s did not finish its turn within 1800000 ms. The workspace and the fence are left " +
    "exactly as they are -- the refusal is about the turn";
  expect(startsAgainOnCarryOn(row({ failureKind: "lost" }))).toBe(true);
  expect(startsAgainOnCarryOn(row({ failureKind: "budget" }))).toBe(true);
  expect(startsAgainOnCarryOn(row({ reason: timedOut }))).toBe(true);
  // Any other refusal, a defect, or a lap not ended failed is the person's to start.
  expect(startsAgainOnCarryOn(row({}))).toBe(false);
  expect(startsAgainOnCarryOn(row({ failureKind: "defect" }))).toBe(false);
  expect(startsAgainOnCarryOn(row({ status: "abandoned", failureKind: "budget" }))).toBe(false);

  const ask = (messageId: string, bases: Record<string, unknown>[] = [], asks = true) => ({
    messageId,
    asks,
    bases,
  });
  expect(stoppedLapOf(ask("lap-stopped-lap-1"))).toBe("lap-1");
  // A scope's stop over a redo names the lap it redoes.
  expect(
    stoppedLapOf(
      ask("scope-stop-lap-2-5", [
        { form: "message", messageId: "req" },
        { form: "iteration", iterationId: "lap-1" },
      ]),
    ),
  ).toBe("lap-1");
  expect(stoppedLapOf(ask("scope-stop-lap-2-5"))).toBeNull();
  expect(stoppedLapOf(ask("question-lap-1", [{ form: "iteration", iterationId: "lap-1" }]))).toBe(
    null,
  );
});

test("pidAlive: this process lives", () => {
  expect(pidAlive(process.pid)).toBe(true);
});

/** A store with one request and lap `id` performing, sent by a driver now gone. */
async function world(marked: boolean) {
  const connection = new DatabaseSync(join(mkdtempSync(join(tmpdir(), "rondo-lost-")), "s.db"));
  const record = advisoryRecord(connection);
  const store = iterationStore(connection, { maxOccupying: 2, maxLive: 3 });
  await record.messagesBeforeDrafter(0);
  const said = await record.recordThreadMessage({
    messageId: "req-1",
    body: "Do the second part.",
    authorKind: "operator",
    authorId: "ada",
    inReplyTo: null,
    atMs: 1,
    bases: [],
    asks: false,
  });
  expect(said.kind).toBe("recorded");
  const lap = (id: string, supersedes: string | null) => {
    connection
      .prepare(
        "INSERT INTO iteration (id, status, request, plan, plan_digest, attempts, " +
          "identifiers_spent, request_message_id, supersedes_iteration_id, lap_budget_cap_usd, " +
          "created_at_ms, updated_at_ms) VALUES (?, 'performing', 'r', ?, ?, 1, 0, 'req-1', ?, " +
          "2.5, 10, 10)",
      )
      .run(id, JSON.stringify(PLAN), planDigest(PLAN), supersedes);
  };
  return { connection, record, store, lap, marked };
}

type World = Awaited<ReturnType<typeof world>>;

function portsOf(
  w: World,
  over: Partial<LostLapPorts> = {},
): LostLapPorts & { readonly lines: string[] } {
  const lines: string[] = [];
  return {
    store: w.store,
    record: w.record,
    end: async (id, reason) => await endLost({ store: w.store, now: () => 20 }, id, reason),
    byItself: async () => false,
    restart: null,
    words: EN,
    host: HOST,
    alive: () => false,
    now: () => 20,
    log: (line) => lines.push(line),
    lines,
    ...over,
  };
}

async function pass(ports: LostLapPorts) {
  const host = lostLapHost(ports);
  host.kick();
  await host.settled();
}

const row = async (w: World, id: string): Promise<IterationRecord> => {
  const read = await w.store.read(id);
  if (read.kind !== "read")
    throw new Error(`${id} is ${read.kind}: ${"reason" in read ? read.reason : ""}`);
  return read.record;
};

const messages = async (w: World) => {
  const read = await w.record.threadMessages();
  if (read.kind !== "read") throw new Error(read.reason);
  return read.messages;
};

test("a restart while a lap performs: the lap is lost, holds nothing, and the stop is asked", async () => {
  const w = await world(true);
  w.lap("lap-2", null);
  await w.store.markLapProcess("lap-2", { driverHost: HOST, driverPid: 999_001 });
  await w.store.markLapProcess("lap-2", { lapPid: 999_002 });
  await w.store.markLapProcess("lap-2", { lapPid: 999_002 });
  await pass(portsOf(w));
  const ended = await row(w, "lap-2");
  expect(ended.status).toBe("failed");
  expect(ended.failureKind).toBe("lost");
  expect(await w.store.performingLaps()).toEqual([]);
  const ask = (await messages(w)).find((m) => m.messageId === lostAskId("lap-2"));
  expect(ask).toMatchObject({ asks: true, inReplyTo: "req-1", body: EN.lapLostAsk });
  expect(EN.lapLostAsk).toContain("Starting this part again");
  expect(EN.lapLostAsk).toContain("Changing the work");
  expect(EN.lapLostAsk).toContain("Recommended: starting this part again.");
});

test("a lap still driven, or of another host, is left performing", async () => {
  const w = await world(true);
  w.lap("lap-2", null);
  await w.store.markLapProcess("lap-2", { driverHost: HOST, driverPid: 999_001 });
  await w.store.markLapProcess("lap-2", { lapPid: 999_002 });
  await pass(portsOf(w, { alive: (pid) => pid === 999_001 }));
  expect((await row(w, "lap-2")).status).toBe("performing");
  await w.store.markLapProcess("lap-2", { driverHost: "elsewhere", driverPid: 999_001 });
  await pass(portsOf(w));
  expect((await row(w, "lap-2")).status).toBe("performing");
  expect(await messages(w)).toHaveLength(1);
});

test("a lap sent before the pids were written is lost once past its ceiling", async () => {
  const w = await world(false);
  w.lap("lap-2", null);
  await pass(portsOf(w, { now: () => 10 + CEILING }));
  expect((await row(w, "lap-2")).status).toBe("performing");
  await pass(portsOf(w, { now: () => 11 + CEILING }));
  expect((await row(w, "lap-2")).failureKind).toBe("lost");
});

test("under a goal scope or an approved split it starts again by itself, once, and the thread says so", async () => {
  const w = await world(true);
  w.lap("lap-2", null);
  const restarted: string[] = [];
  const ports = portsOf(w, {
    byItself: async () => true,
    restart: async (lap) => {
      restarted.push(lap.id);
      return { ok: true, note: "admitted" };
    },
  });
  await w.store.markLapProcess("lap-2", { driverHost: HOST, driverPid: 999_001 });
  await w.store.markLapProcess("lap-2", { lapPid: 999_002 });
  await pass(ports);
  expect(restarted).toEqual(["lap-2"]);
  const said = await messages(w);
  expect(said.map((m) => m.messageId)).toContain("report-lost-lap-2");
  expect(said.find((m) => m.messageId === "report-lost-lap-2")?.asks).toBe(false);
  expect(said.map((m) => m.messageId)).not.toContain(lostAskId("lap-2"));

  // Its start again is lost too: not a second time by itself; the stop is asked.
  w.lap(againId("lap-2"), "lap-2");
  await w.store.markLapProcess(againId("lap-2"), { driverHost: HOST, driverPid: 999_003 });
  await w.store.markLapProcess(againId("lap-2"), { lapPid: 999_004 });
  await pass(ports);
  expect(restarted).toEqual(["lap-2"]);
  expect((await messages(w)).map((m) => m.messageId)).toContain(lostAskId(againId("lap-2")));
});

test("a start again that is refused falls back to the stop ask", async () => {
  const w = await world(true);
  w.lap("lap-2", null);
  await w.store.markLapProcess("lap-2", { driverHost: HOST, driverPid: 999_001 });
  await w.store.markLapProcess("lap-2", { lapPid: 999_002 });
  const ports = portsOf(w, {
    byItself: async () => true,
    restart: async () => ({ ok: false, note: "the budget is spent" }),
  });
  await pass(ports);
  expect((await messages(w)).map((m) => m.messageId)).toContain(lostAskId("lap-2"));
  expect(ports.lines.join("\n")).toContain("the budget is spent");
});

test("a person's carry on starts a lost lap again", async () => {
  const w = await world(true);
  w.lap("lap-2", null);
  await w.store.markLapProcess("lap-2", { driverHost: HOST, driverPid: 999_001 });
  await w.store.markLapProcess("lap-2", { lapPid: 999_002 });
  const restarted: string[] = [];
  const ports = portsOf(w, {
    restart: async (lap) => {
      restarted.push(lap.id);
      return { ok: true, note: "admitted" };
    },
  });
  await pass(ports);
  // Not under a goal scope or a split: asked, and nothing started yet.
  expect(restarted).toEqual([]);
  const answered = await w.record.recordThreadMessage({
    messageId: "m-carry",
    body: "Go on.",
    authorKind: "operator",
    authorId: "ada",
    inReplyTo: lostAskId("lap-2"),
    atMs: 30,
    bases: [],
    asks: false,
    answerOutcome: "carry_on",
  });
  expect(answered.kind).toBe("recorded");
  await pass(ports);
  expect(restarted).toEqual(["lap-2"]);
});

test("a pass cut short after the end is finished by the next: the lost row is asked about", async () => {
  const w = await world(true);
  w.lap("lap-2", null);
  // Ended by an earlier pass that stopped before it asked anything.
  expect(await endLost({ store: w.store, now: () => 20 }, "lap-2", "gone")).toBe("failed");
  expect((await messages(w)).map((m) => m.messageId)).not.toContain(lostAskId("lap-2"));
  await pass(portsOf(w));
  expect((await messages(w)).map((m) => m.messageId)).toContain(lostAskId("lap-2"));
  // Asked once, not a second time on the next pass.
  await pass(portsOf(w));
  expect((await messages(w)).filter((m) => m.messageId === lostAskId("lap-2"))).toHaveLength(1);
});

test("a scope that refuses the start again asks once, and its carry on starts the lap", async () => {
  const w = await world(true);
  w.lap("lap-2", null);
  await w.store.markLapProcess("lap-2", { driverHost: HOST, driverPid: 999_001 });
  await w.store.markLapProcess("lap-2", { lapPid: 999_002 });
  let refuse = true;
  const tried: string[] = [];
  const ports = portsOf(w, {
    byItself: async () => true,
    restart: async (lap) => {
      tried.push(lap.id);
      if (!refuse) return { ok: true, note: "admitted" };
      // What `stopTheLine` writes for a refused redo: an ask naming the predecessor.
      await w.record.recordThreadMessage({
        messageId: "scope-stop-lap-2-again-20",
        body: "Stopped: the scope's laps are spent.",
        authorKind: "drafter",
        authorId: "rondo/advisory/deterministic",
        inReplyTo: "req-1",
        atMs: 20,
        bases: [
          { form: "message", messageId: "req-1" },
          { form: "iteration", iterationId: "lap-2" },
        ],
        asks: true,
      });
      return { ok: false, note: "the laps are spent" };
    },
  });
  await pass(ports);
  const ids = (await messages(w)).map((m) => m.messageId);
  expect(ids).toContain("scope-stop-lap-2-again-20");
  expect(ids).not.toContain(lostAskId("lap-2"));
  // Standing: not tried again every minute.
  await pass(ports);
  expect(tried).toEqual(["lap-2"]);
  refuse = false;
  const answered = await w.record.recordThreadMessage({
    messageId: "m-carry",
    body: "Raised.",
    authorKind: "operator",
    authorId: "ada",
    inReplyTo: "scope-stop-lap-2-again-20",
    atMs: 30,
    bases: [],
    asks: false,
    answerOutcome: "carry_on",
  });
  expect(answered.kind).toBe("recorded");
  await pass(ports);
  expect(tried).toEqual(["lap-2", "lap-2"]);
});

test("a start again's id stays one the allocator accepts, however often a line is started again", () => {
  const first = "lap-11d45296-d5a7-41b7-8983-66162d48963c";
  expect(againId(first)).toBe(`${first}-again-1`);
  expect(againId(`${first}-again-1`)).toBe(`${first}-again-2`);
  let id = first;
  for (let n = 0; n < 1000; n += 1) id = againId(id);
  expect(id).toBe(`${first}-again-1000`);
  expect(id.length).toBeLessThanOrEqual(64);
});

test("a start again whose report was never written is reported on the next pass", async () => {
  const w = await world(true);
  w.lap("lap-2", null);
  expect(await endLost({ store: w.store, now: () => 20 }, "lap-2", "gone")).toBe("failed");
  // Its start again was reserved; the host stopped before the thread was told.
  w.lap(againId("lap-2"), "lap-2");
  await pass(portsOf(w));
  const ids = (await messages(w)).map((m) => m.messageId);
  expect(ids).toContain("report-lost-lap-2");
  expect(ids).not.toContain(lostAskId("lap-2"));
});
