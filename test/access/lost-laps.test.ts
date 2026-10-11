/**
 * D-0139 (rondo#506, rondo#655): a lap whose rondo process died before its gate
 * is found, ended `failed` with `lost`, and started again by itself once or
 * asked about -- a restart of the host while a lap performs or is admitted,
 * over a real store file. A lap a person ended from the page is only asked
 * about, and started again on *carry on*.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";
import { endLost } from "../../src/access/conductor.js";
import {
  againId,
  endedOnThePage,
  type LostLapPorts,
  lapLost,
  lostAskId,
  lostLapHost,
  personsReason,
  pidAlive,
  startsAgainOnCarryOn,
  stoppedLapOf,
} from "../../src/access/lost-laps.js";
import { EN } from "../../src/access/wording.js";
import type { DrivenLap } from "../../src/store/contract.js";
import { planDigest } from "../../src/store/plan.js";
import type { IterationRecord, IterationStatus } from "../../src/store/records.js";
import { advisoryRecord, iterationStore } from "../../src/store/sqlite.js";

const HOST = "this-host";
const CEILING = 60_000;
const PLAN = { invocation_ceiling_ms: CEILING };

test("a lap is lost only when, on this host, its driver and its child are both gone", () => {
  const lap = (over: Partial<DrivenLap>): DrivenLap => ({
    iterationId: "i",
    status: "performing",
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
  // rondo#655: before its lap is sent no child exists, so a gone driver is all of it.
  for (const status of ["planned", "classified", "admitting", "admitted"] as const) {
    expect(lapLost(lap({ status, lapPid: null }), CEILING, 1, HOST, dead)).toBe(true);
    expect(lapLost(lap({ status, lapPid: null }), CEILING, 1, HOST, only(10))).toBe(false);
    expect(lapLost(lap({ status, driverHost: "elsewhere" }), CEILING, 1, HOST, dead)).toBe(false);
    // Reserved before the driver was written: its ceiling decides, as for a lap sent.
    expect(lapLost({ ...unmarked, status }, CEILING, CEILING, HOST, dead)).toBe(false);
    expect(lapLost({ ...unmarked, status }, CEILING, CEILING + 1, HOST, dead)).toBe(true);
  }
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
  expect(startsAgainOnCarryOn(row({ failureKind: "ended" }))).toBe(true);
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
  // rondo#655: a start that threw asks its stop under its own id.
  expect(stoppedLapOf(ask("start-stopped-lap-1"))).toBe("lap-1");
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

test("rondo#655: the person's words are read back from the reason a page end records", () => {
  const ended = (reason: string | null) => ({ reason }) as IterationRecord;
  const said = endedOnThePage("the worker hung", "ada");
  expect(said).toBe("the worker hung (ended on the page by ada)");
  expect(personsReason(ended(said))).toBe("the worker hung");
  // rondo's earlier entries before it are left out.
  expect(personsReason(ended(`classify answered nothing; ${said}`))).toBe("the worker hung");
  expect(personsReason(ended("no page end here"))).toBe("no page end here");
  expect(personsReason(ended(null))).toBe("");
});

test("pidAlive: this process lives", () => {
  expect(pidAlive(process.pid)).toBe(true);
});

/** A store with one request and lap `id` at `status` (performing by default). */
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
  const lap = (id: string, supersedes: string | null, status: IterationStatus = "performing") => {
    connection
      .prepare(
        "INSERT INTO iteration (id, status, request, plan, plan_digest, attempts, " +
          "identifiers_spent, request_message_id, supersedes_iteration_id, lap_budget_cap_usd, " +
          "created_at_ms, updated_at_ms) VALUES (?, ?, 'r', ?, ?, 1, 0, 'req-1', ?, " +
          "2.5, 10, 10)",
      )
      .run(id, status, JSON.stringify(PLAN), planDigest(PLAN), supersedes);
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
  expect(await w.store.drivenLaps()).toEqual([]);
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

test("rondo#655: a restart while a lap is admitted ends it lost, frees its room, and asks the stop", async () => {
  const w = await world(true);
  w.lap("lap-2", null, "admitting");
  // Its driver, written at reservation, is gone; no child was ever sent.
  await w.store.markLapProcess("lap-2", { driverHost: HOST, driverPid: 999_001 });
  expect(await w.store.drivenLaps()).toMatchObject([{ iterationId: "lap-2", status: "admitting" }]);
  expect((await w.store.occupancy()).occupying).toBe(1);
  const ports = portsOf(w);
  await pass(ports);
  const ended = await row(w, "lap-2");
  expect(ended).toMatchObject({ status: "failed", failureKind: "lost" });
  expect(ended.reason).toContain("'admitting'");
  expect(await w.store.drivenLaps()).toEqual([]);
  expect(await w.store.occupancy()).toEqual({ occupying: 0, live: 0 });
  const ask = (await messages(w)).find((m) => m.messageId === lostAskId("lap-2"));
  expect(ask).toMatchObject({ asks: true, inReplyTo: "req-1", body: EN.lapLostAsk });
});

test("rondo#655: a lap before its gate whose driver lives, or that names none and is young, is left", async () => {
  const w = await world(true);
  w.lap("lap-2", null, "admitting");
  w.lap("lap-3", null, "planned");
  await w.store.markLapProcess("lap-2", { driverHost: HOST, driverPid: 999_001 });
  await pass(portsOf(w, { alive: (pid) => pid === 999_001 }));
  expect((await row(w, "lap-2")).status).toBe("admitting");
  // Reserved before the driver was written: lost only past its ceiling.
  expect((await row(w, "lap-3")).status).toBe("planned");
  await pass(portsOf(w, { alive: (pid) => pid === 999_001, now: () => 11 + CEILING }));
  expect((await row(w, "lap-3")).failureKind).toBe("lost");
  expect((await row(w, "lap-2")).status).toBe("admitting");
});

test("rondo#655: a lap ended from the page is never started again by itself, and carry on starts it", async () => {
  const w = await world(true);
  w.lap("lap-2", null, "stalled");
  const reason = endedOnThePage("the worker hung", "ada");
  expect(await endLost({ store: w.store, now: () => 20 }, "lap-2", reason, "ended")).toBe("failed");
  expect(await w.store.occupancy()).toEqual({ occupying: 0, live: 0 });
  const restarted: string[] = [];
  const ports = portsOf(w, {
    byItself: async () => true,
    restart: async (lap) => {
      restarted.push(lap.id);
      return { ok: true, note: "admitted" };
    },
  });
  // The page's ask was never written (a pass cut short): this writes it, in the person's words.
  await pass(ports);
  expect(restarted).toEqual([]);
  const asked = (await messages(w)).filter((m) => m.messageId === lostAskId("lap-2"));
  expect(asked).toHaveLength(1);
  expect(asked[0]).toMatchObject({ asks: true, body: EN.lapEndedAsk("the worker hung") });
  await pass(ports);
  expect(restarted).toEqual([]);
  expect((await messages(w)).filter((m) => m.messageId === lostAskId("lap-2"))).toHaveLength(1);
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

test("rondo#655: a lap lost while its start's stop stood is asked afresh, and an earlier carry on is not read", async () => {
  const w = await world(true);
  w.lap("lap-2", null, "admitting");
  await w.store.markLapProcess("lap-2", { driverHost: HOST, driverPid: 999_001 });
  // What `stopTheLeftLap` writes when it could not end the lap, answered while still held.
  for (const [messageId, authorKind, inReplyTo, atMs, asks, answerOutcome] of [
    ["start-stopped-lap-2", "drafter", "req-1", 15, true, undefined],
    ["m-early", "operator", "start-stopped-lap-2", 16, false, "carry_on"],
  ] as const) {
    await w.record.recordThreadMessage({
      messageId,
      body: messageId === "m-early" ? "Go on." : EN.startStoppedHeldSaid,
      authorKind,
      authorId: authorKind === "operator" ? "ada" : "rondo/advisory/deterministic",
      inReplyTo,
      atMs,
      bases: [
        { form: "message", messageId: "req-1" },
        { form: "iteration", iterationId: "lap-2" },
      ],
      asks,
      ...(answerOutcome === undefined ? {} : { answerOutcome }),
    });
  }
  const restarted: string[] = [];
  const ports = portsOf(w, {
    restart: async (lap) => {
      restarted.push(lap.id);
      return { ok: true, note: "admitted" };
    },
  });
  await pass(ports);
  expect((await row(w, "lap-2")).failureKind).toBe("lost");
  // The start's stop still says the lap holds its room: the loss is asked on its own.
  const ask = (await messages(w)).find((m) => m.messageId === lostAskId("lap-2"));
  expect(ask).toMatchObject({ asks: true, body: EN.lapLostAsk });
  await pass(ports);
  expect(restarted).toEqual([]);
});
