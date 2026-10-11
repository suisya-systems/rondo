/**
 * rondo#655: a lap only a person can end -- stalled, held by a start that
 * threw, or a row that will not decode -- is ended from the page with their
 * reason, gives back what it held, and the request asks whether to carry on;
 * *carry on* then starts it again through the lost-lap pass. Over a real store.
 */
import { expect, test } from "vitest";
import { endLost } from "../../src/access/conductor.js";
import { endLapFromPage } from "../../src/access/end-lap-host.js";
import { type LostLapPorts, lostAskId, lostLapHost } from "../../src/access/lost-laps.js";
import { PAGE_EN } from "../../src/access/page/words.js";
import { endable } from "../../src/access/page-logic/end-lap.js";
import { JA } from "../../src/access/wording/ja.js";
import { EN } from "../../src/access/wording.js";
import type { IterationRecord } from "../../src/store/records.js";
import { fresh, operatorPage, portsOver, reserve } from "./page-world.js";

const ENV = { RONDO_APPROVER: "ada" };

/** A store with request `req-lap-1` and its lap `lap-1` moved to `status` by hand. */
async function stuck(status: string) {
  const w = fresh();
  await reserve(w, "lap-1", "Fix the login page.\nIt hangs on submit.");
  w.connection.prepare("UPDATE iteration SET status = ? WHERE id = 'lap-1'").run(status);
  return w;
}
type World = Awaited<ReturnType<typeof stuck>>;

const row = async (w: World): Promise<IterationRecord> => {
  const read = await w.store.read("lap-1");
  if (read.kind !== "read") throw new Error(`lap-1 is ${read.kind}`);
  return read.record;
};
const thread = async (w: World) => {
  const read = await w.record.threadMessages();
  if (read.kind !== "read") throw new Error(read.reason);
  return read.messages;
};
const end = (w: World, approver = "ada", reason = "it hung overnight") =>
  endLapFromPage(ENV, w.store, w.record, EN, approver, { iterationId: "lap-1", reason });

/** The lost-lap pass over this store, its start again a spy. */
async function pass(w: World, restarted: string[]) {
  const ports: LostLapPorts = {
    store: w.store,
    record: w.record,
    end: async (id, reason) => await endLost({ store: w.store, now: Date.now }, id, reason),
    byItself: async () => true,
    restart: async (lap) => {
      restarted.push(lap.id);
      return { ok: true, note: "admitted" };
    },
    words: EN,
    host: "this-host",
    alive: () => false,
    now: Date.now,
    log: () => undefined,
  };
  const host = lostLapHost(ports);
  host.kick();
  await host.settled();
}

/** The person's *carry on* at `ask`, given now (`atMs`: before the lap ended, for a stale one). */
const carryOn = async (w: World, ask: string, atMs = Date.now() + 1, messageId = "m-carry") =>
  await w.record.recordThreadMessage({
    messageId,
    body: "Go on.",
    authorKind: "operator",
    authorId: "ada",
    inReplyTo: ask,
    atMs,
    bases: [],
    asks: false,
    answerOutcome: "carry_on",
  });

test("a stalled lap ended from the page frees what it held, asks in the person's words, and carry on starts it", async () => {
  const w = await stuck("stalled");
  expect(await w.store.occupancy()).toMatchObject({ occupying: 1 });
  expect(await end(w)).toEqual({ ok: true, requestMessageId: "req-lap-1" });

  const ended = await row(w);
  expect(ended).toMatchObject({ status: "failed", failureKind: "ended" });
  expect(ended.reason).toContain("it hung overnight (ended on the page by ada)");
  expect(await w.store.occupancy()).toEqual({ occupying: 0, live: 0 });
  const line = (await w.store.laneLedger()).find((one) => one.lapIds.includes("lap-1"));
  expect(line?.paths).toEqual([]);
  const ask = (await thread(w)).find((m) => m.messageId === lostAskId("lap-1"));
  expect(ask).toMatchObject({
    asks: true,
    inReplyTo: "req-lap-1",
    body: EN.lapEndedAsk("it hung overnight"),
  });

  // Never started again by itself, even where it may be: a person decided.
  const restarted: string[] = [];
  await pass(w, restarted);
  expect(restarted).toEqual([]);
  expect((await carryOn(w, lostAskId("lap-1"))).kind).toBe("recorded");
  await pass(w, restarted);
  expect(restarted).toEqual(["lap-1"]);

  // Pressed again over the ended lap: nothing is written twice.
  expect(await end(w)).toMatchObject({ ok: false, why: "endRefusedChanged" });
});

/** The stop a start that threw writes over a lap it could not end (`stopTheLeftLap`). */
const startStopped = async (w: World) =>
  await w.record.recordThreadMessage({
    messageId: "start-stopped-lap-1",
    body: EN.startStoppedHeldSaid,
    authorKind: "drafter",
    authorId: "rondo/advisory/deterministic",
    inReplyTo: "req-lap-1",
    atMs: 2_000,
    bases: [
      { form: "message", messageId: "req-lap-1" },
      { form: "iteration", iterationId: "lap-1" },
    ],
    asks: true,
  });

test("a start rondo could not end is ended under its own stop: no second ask, and carry on starts it", async () => {
  const w = await stuck("admitting");
  const messageIds = new Set<string>();
  expect(endable(await row(w), messageIds)).toBe(false);
  expect(await end(w)).toMatchObject({ ok: false, why: "endRefusedChanged" });
  await startStopped(w);
  expect(endable(await row(w), new Set(["start-stopped-lap-1"]))).toBe(true);
  // Its stop leads to the end screen too.
  const ports = { ...portsOver(w), endsLaps: true };
  const held = await operatorPage(
    ports,
    "tok",
    { kind: "thread", messageId: "req-lap-1", to: null },
    EN,
  );
  expect(held).toContain('id="end-lap-1"');
  expect(await end(w)).toMatchObject({ ok: true });
  expect(await row(w)).toMatchObject({ status: "failed", failureKind: "ended" });
  expect((await thread(w)).map((m) => m.messageId)).not.toContain(lostAskId("lap-1"));
  const restarted: string[] = [];
  await pass(w, restarted);
  expect(restarted).toEqual([]);
  await carryOn(w, "start-stopped-lap-1");
  await pass(w, restarted);
  expect(restarted).toEqual(["lap-1"]);
  // The thread says who ended it.
  const after = await operatorPage(
    ports,
    "tok",
    { kind: "thread", messageId: "req-lap-1", to: null },
    EN,
  );
  expect(after).toContain(PAGE_EN.evEnded);
  // With no ask of its own, the thread still shows the person's words.
  expect(after).toContain(PAGE_EN.evEndedReason);
  expect(after).toContain("it hung overnight");
});

test("a carry on given while the start was held is not one for the ending: the end asks afresh", async () => {
  const w = await stuck("admitting");
  await startStopped(w);
  expect((await carryOn(w, "start-stopped-lap-1", 2_500, "m-early")).kind).toBe("recorded");
  expect(await end(w)).toMatchObject({ ok: true });
  expect((await thread(w)).map((m) => m.messageId)).toContain(lostAskId("lap-1"));
  const restarted: string[] = [];
  await pass(w, restarted);
  expect(restarted).toEqual([]);
  await carryOn(w, lostAskId("lap-1"));
  await pass(w, restarted);
  expect(restarted).toEqual(["lap-1"]);
});

test("an ending whose fresh ask was never written is asked about by the lost-lap pass", async () => {
  const w = await stuck("admitting");
  await startStopped(w);
  await carryOn(w, "start-stopped-lap-1", 2_500, "m-early");
  // The press ended the row, and the host stopped before the fresh ask.
  const status = await endLost(
    { store: w.store, now: Date.now },
    "lap-1",
    "it hung overnight (ended on the page by ada)",
    "ended",
  );
  expect(status).toBe("failed");
  const restarted: string[] = [];
  await pass(w, restarted);
  expect(restarted).toEqual([]);
  expect((await thread(w)).map((m) => m.messageId)).toContain(lostAskId("lap-1"));
  await carryOn(w, lostAskId("lap-1"));
  await pass(w, restarted);
  expect(restarted).toEqual(["lap-1"]);
});

test("a press that loses its race to the lost-lap pass says nothing was ended by it", async () => {
  const w = await stuck("stalled");
  let reads = 0;
  // The pass ends the lap between the press's check and its write.
  const racing = Object.create(w.store, {
    read: {
      value: async (id: string) => {
        reads += 1;
        if (reads === 2) {
          await endLost({ store: w.store, now: Date.now }, id, "gone", "lost");
        }
        return await w.store.read(id);
      },
    },
  });
  expect(
    await endLapFromPage(ENV, racing, w.record, EN, "ada", { iterationId: "lap-1", reason: "r" }),
  ).toMatchObject({ ok: false, why: "endRefusedChanged" });
  expect(await row(w)).toMatchObject({ failureKind: "lost" });
  expect((await thread(w)).map((m) => m.messageId)).toEqual(["req-lap-1"]);
});

test("a row that will not decode is settled by id, frees its room, and is asked about in its request", async () => {
  const w = await stuck("stalled");
  w.connection.prepare("UPDATE iteration SET plan_digest = 'corrupt' WHERE id = 'lap-1'").run();
  expect((await w.store.read("lap-1")).kind).toBe("unreadable");
  expect(await end(w, "ada", "rondo cannot read it")).toEqual({
    ok: true,
    requestMessageId: "req-lap-1",
  });
  const status = w.connection.prepare("SELECT status FROM iteration WHERE id = 'lap-1'").get();
  expect(status).toEqual({ status: "abandoned" });
  expect(await w.store.occupancy()).toEqual({ occupying: 0, live: 0 });
  const ask = (await thread(w)).find((m) => m.messageId === lostAskId("lap-1"));
  expect(ask?.body).toBe(EN.lapEndedUnreadableAsk("rondo cannot read it"));
  // Settled, it is no longer one to end, though it still will not decode.
  expect(await end(w)).toMatchObject({ ok: false, why: "endRefusedChanged" });
});

test("a press as somebody else, or over a lap at its gate, ends nothing", async () => {
  const w = await stuck("stalled");
  expect(await end(w, "bob")).toMatchObject({ ok: false, why: "endRefusedNotRecorded" });
  expect((await row(w)).status).toBe("stalled");
  w.connection.prepare("UPDATE iteration SET status = 'awaiting_human' WHERE id = 'lap-1'").run();
  expect(await end(w)).toMatchObject({ ok: false, why: "endRefusedChanged" });
  expect((await row(w)).status).toBe("awaiting_human");
  expect((await thread(w)).map((m) => m.messageId)).toEqual(["req-lap-1"]);
});

test("the thread's next step leads to the end screen, which names the work and holds the press in both languages", async () => {
  const w = await stuck("stalled");
  const ports = { ...portsOver(w), endsLaps: true };
  const threadPage = await operatorPage(
    ports,
    "tok",
    { kind: "thread", messageId: "req-lap-1", to: null },
    EN,
  );
  expect(threadPage).toContain('id="end-lap-1"');
  expect(threadPage).toContain('href="/?end=lap-1&amp;lang=en"');
  expect(threadPage).toContain(EN.nextStepEnd);

  for (const wording of [EN, JA]) {
    const screen = await operatorPage(ports, "tok", { kind: "end", iterationId: "lap-1" }, wording);
    expect(screen).toContain("Fix the login page.");
    expect(screen).toContain(wording.endLeadStalled);
    expect(screen).toContain(`action="/end-lap?lang=${wording.lang}"`);
    expect(screen).toContain('name="reason"');
    expect(screen).toContain(wording.endAction);
    expect(screen).not.toMatch(/\blog\b|ログ|journal/i);
  }
  // No approver behind the page: no press, and the screen says why.
  const unheld = await operatorPage(
    { ...ports, endsLaps: false },
    "tok",
    { kind: "end", iterationId: "lap-1" },
    EN,
  );
  expect(unheld).not.toContain('action="/end-lap');
  expect(unheld).toContain(EN.endNoApprover);
});

test("a row that will not decode is drawn on the list and in its request, leading to its end screen", async () => {
  const w = await stuck("admitted");
  w.connection.prepare("UPDATE iteration SET plan_digest = 'corrupt' WHERE id = 'lap-1'").run();
  const ports = { ...portsOver(w), endsLaps: true };
  const page = await operatorPage(ports, "tok", { kind: "summary" }, EN);
  expect(page).toContain("data-unreadable");
  expect(page).toContain('href="/?end=lap-1&amp;lang=en"');
  expect(page).toContain(EN.unreadableHolds);
  // Drawn under *Your turn*, so counted in the one count the pill says.
  expect(page).toContain(EN.waitingCount(1));
  const inThread = await operatorPage(
    ports,
    "tok",
    { kind: "thread", messageId: "req-lap-1", to: null },
    EN,
  );
  expect(inThread).toContain('id="end-lap-1"');
  const screen = await operatorPage(ports, "tok", { kind: "end", iterationId: "lap-1" }, JA);
  expect(screen).toContain(JA.endLeadUnreadable);
  expect(screen).toContain("Fix the login page.");
});

test("no sentence the page says about these laps sends the person to a log or a command", () => {
  for (const wording of [EN, JA]) {
    const said = [
      wording.startStoppedHeldSaid,
      wording.lapEndedAsk("r"),
      wording.lapEndedUnreadableAsk("r"),
      wording.nextStepEnd,
      wording.unreadableHolds,
      wording.endLeadStalled,
      wording.endLeadStarting,
      wording.endLeadUnreadable,
      ...wording.endEffect,
      wording.endEffectUnnamed,
      wording.endNoApprover,
      wording.endNothingToEnd,
      wording.endRefusedNoApprover,
      wording.endRefusedPress,
      wording.endRefusedForm,
      wording.endRefusedNoReason,
      wording.endRefusedChanged,
      wording.endRefusedNotRecorded,
    ];
    for (const one of said) {
      expect(one).not.toMatch(/\blog\b|ログ|journal|rondo abandon|`/i);
    }
  }
});
