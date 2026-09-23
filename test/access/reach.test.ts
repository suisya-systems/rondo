/**
 * Reaching a person who is not looking at the screen (rondo#311), over a real
 * store.
 *
 * Three properties are what this file exists for, and each of them is a thing
 * the feature is worthless or harmful without:
 *
 *  - **it goes out for the two things that are worth it**, a turn and a lap
 *    past its own plan's patience, **and for nothing else** -- an ordinary
 *    ending is not a notification, which is `D-0068`'s own line about what the
 *    patrol does not detect, applied to what gets sent;
 *  - **it goes out once per episode and never again**, through the
 *    `operator_attention` row and its partial unique index and not through
 *    anything held in memory -- so a restart does not repeat the morning;
 *  - **a notification that did not go out is said**, because the failure this
 *    feature can have and not notice is a program that stopped working and a
 *    person who is waiting to be told.
 *
 * The last block runs the real spawn, because *"a program that did not deliver
 * returns non-zero"* is a claim about a child process and not about a port.
 */
import { expect, test } from "vitest";
import {
  type NotifyOutcome,
  notifierAt,
  REACH_SUBJECT,
  reachThePerson,
} from "../../src/access/reach.js";
import { chromeFor, EN } from "../../src/access/wording.js";
import { fresh, openGate, openRequest, reserve } from "./page-world.js";

/** Walk one reserved row to terminal `failed` at `atMs`, the way a cut try ends. */
async function stop(world: ReturnType<typeof fresh>, id: string, atMs: number): Promise<void> {
  for (const [from, to] of [
    ["planned", "admitting"],
    ["admitting", "admitted"],
    ["admitted", "performing"],
  ] as const) {
    await world.store.transition(id, from, to, {}, 2_000);
  }
  const ended = await world.store.transition(
    id,
    "performing",
    "failed",
    { reason: "the turn ran out", failureKind: "refusal" },
    atMs,
  );
  if (ended.kind !== "transitioned") {
    throw new Error(`the fixture did not stop: ${JSON.stringify(ended)}`);
  }
}

/** The tick, with the program and the console recorded rather than run. */
function tickOver(
  world: ReturnType<typeof fresh>,
  over: { readonly fails?: string; readonly nowMs?: number; readonly since?: number } = {},
) {
  const sent: string[] = [];
  const said: string[] = [];
  const ports = {
    store: world.store,
    record: world.record,
    now: () => over.nowMs ?? 50_000,
    since: over.since ?? 0,
    words: EN,
    notify: async (sentence: string): Promise<NotifyOutcome> => {
      sent.push(sentence);
      return over.fails === undefined
        ? { kind: "reached" }
        : { kind: "failed", reason: over.fails };
    },
    say: (line: string) => {
      said.push(line);
    },
  };
  return { sent, said, ports, run: async () => await reachThePerson(ports) };
}

/** The `presented` subjects this tick has claimed, in insertion order. */
const claimed = (world: ReturnType<typeof fresh>) =>
  world.connection
    .prepare(
      "SELECT subject_id FROM operator_attention WHERE subject_kind = ? " +
        "AND disposition = 'presented' ORDER BY rowid",
    )
    .all(REACH_SUBJECT)
    .map((row) => String((row as Record<string, unknown>)["subject_id"]));

test("nothing waiting reaches nobody, and claims nothing", async () => {
  const world = fresh();
  await reserve(world, "a", "do the thing");
  const tick = tickOver(world);
  await tick.run();
  expect(tick.sent).toEqual([]);
  expect(claimed(world)).toEqual([]);
});

test("a lap at its gate is one line, in the person's own words", async () => {
  const world = fresh();
  await reserve(world, "a", "do the thing");
  await openGate(world, "a");
  const tick = tickOver(world);
  await tick.run();
  expect(tick.sent).toEqual([EN.reachYourTurn]);
  expect(claimed(world)).toEqual(["gate:a:awaiting_human"]);
});

test("the sentence is the set this host resolved, and not the English one", async () => {
  // D-0079: what the person reads is composed in their language. This is the
  // one surface rondo writes that they may read without the page in front of
  // them, so a host whose operator reads Japanese must not reach them in
  // English.
  const world = fresh();
  await reserve(world, "a", "do the thing");
  await openGate(world, "a");
  const tick = tickOver(world);
  const sent: string[] = [];
  await reachThePerson({
    ...tick.ports,
    words: chromeFor("ja"),
    notify: async (sentence) => {
      sent.push(sentence);
      return { kind: "reached" };
    },
  });
  expect(sent).toEqual([chromeFor("ja").reachYourTurn]);
  expect(sent[0]).not.toBe(EN.reachYourTurn);
});

test("the same gate on the next minute reaches nobody a second time", async () => {
  const world = fresh();
  await reserve(world, "a", "do the thing");
  await openGate(world, "a");
  const tick = tickOver(world);
  await tick.run();
  await tick.run();
  await tick.run();
  expect(tick.sent).toEqual([EN.reachYourTurn]);
  expect(claimed(world)).toEqual(["gate:a:awaiting_human"]);
});

test("a host that restarts does not repeat the morning", async () => {
  // The dedupe is the row and not anything this process holds, so a second
  // tick built from nothing still knows what the first one sent.
  const world = fresh();
  await reserve(world, "a", "do the thing");
  await openGate(world, "a");
  await tickOver(world).run();
  const after = tickOver(world);
  await after.run();
  expect(after.sent).toEqual([]);
});

test("a question standing in a thread is a turn too", async () => {
  const world = fresh();
  await openRequest(world, "req-only", "have a look at this");
  const asked = await world.record.recordThreadMessage({
    messageId: "ask",
    body: "which of these did you mean?",
    authorKind: "drafter",
    authorId: "the drafter",
    inReplyTo: "req-only",
    atMs: 600,
    bases: [{ form: "message", messageId: "req-only" }],
    asks: true,
  });
  expect(asked.kind).toBe("recorded");
  const tick = tickOver(world);
  await tick.run();
  expect(tick.sent).toEqual([EN.reachYourTurn]);
  expect(claimed(world)).toEqual(["ask:ask"]);
});

test("an ordinary ending is not a notification", async () => {
  // D-0068 section 2 rule 5's shape, applied to what is sent: work finishing
  // is what is supposed to happen, and a program that says so every time
  // teaches the person to ignore the two that matter.
  const world = fresh();
  await reserve(world, "a", "do the thing");
  await openGate(world, "a");
  const answered = await world.store.transition("a", "awaiting_human", "closed", {}, 3_000);
  expect(answered.kind).toBe("transitioned");
  const tick = tickOver(world);
  await tick.run();
  expect(tick.sent).toEqual([]);
  expect(claimed(world)).toEqual([]);
});

test("a lap past its own plan's patience is the other line", async () => {
  const world = fresh();
  await reserve(world, "a", "do the thing");
  // `reserve` leaves the row `planned` at 1_000, and the fixture plan declares
  // half an hour of patience, so this is a clock past that and not a threshold
  // of the test's own.
  const tick = tickOver(world, { nowMs: 1_000 + 1_800_000 + 1 });
  await tick.run();
  expect(tick.sent).toEqual([EN.reachLate]);
  expect(claimed(world)).toEqual(["late:a:planned"]);
});

test("everything new in one minute is still one line", async () => {
  const world = fresh();
  await reserve(world, "a", "do the thing");
  await openGate(world, "a");
  await reserve(world, "b", "do the other thing");
  await openGate(world, "b");
  const tick = tickOver(world);
  await tick.run();
  expect(tick.sent).toEqual([EN.reachYourTurn]);
  // Both are claimed, so neither is sent again on its own next minute.
  expect(claimed(world).toSorted()).toEqual(["gate:a:awaiting_human", "gate:b:awaiting_human"]);
});

test("a turn is carried in front of a late lap when both are new", async () => {
  // The one the person can act on is the one worth the line they get.
  const world = fresh();
  await reserve(world, "late", "the slow one");
  await reserve(world, "gate", "the one at its gate");
  await openGate(world, "gate");
  const tick = tickOver(world, { nowMs: 1_000 + 1_800_000 + 1 });
  await tick.run();
  expect(tick.sent).toEqual([EN.reachYourTurn]);
  expect(claimed(world)).toContain("late:late:planned");
});

test("with no program on this machine nothing is claimed, so nothing is lost", async () => {
  // A machine that grows a notifier later must still be told about what was
  // waiting before it did.
  const world = fresh();
  await reserve(world, "a", "do the thing");
  await openGate(world, "a");
  await reachThePerson({ ...tickOver(world).ports, notify: null });
  expect(claimed(world)).toEqual([]);
  const after = tickOver(world);
  await after.run();
  expect(after.sent).toEqual([EN.reachYourTurn]);
});

test("a notification that did not go out is said, and is not sent again", async () => {
  const world = fresh();
  await reserve(world, "a", "do the thing");
  await openGate(world, "a");
  const tick = tickOver(world, { fails: "'/opt/notify' ended with status 1" });
  await tick.run();
  expect(tick.sent).toEqual([EN.reachYourTurn]);
  expect(tick.said.join("\n")).toContain("ended with status 1");
  // The trade this takes, written down: the episode was claimed before the
  // program ran, so a failure costs one notification rather than turning into
  // one attempt a minute for as long as the gate stands.
  const after = tickOver(world);
  await after.run();
  expect(after.sent).toEqual([]);
});

test("a thread that will not read does not take the tick down", async () => {
  const world = fresh();
  await reserve(world, "a", "do the thing");
  await openGate(world, "a");
  const tick = tickOver(world);
  await reachThePerson({
    ...tick.ports,
    record: {
      ...world.record,
      threadMessages: async () => ({ kind: "unreadable", reason: "a torn row" }),
    },
  });
  // The lap's own gate is still read and still sent: half a reading beats a
  // host whose minute tick throws.
  expect(tick.sent).toEqual([EN.reachYourTurn]);
});

/*
 * The real spawn. What is being checked is the claim the implementation rests
 * on -- **that rondo can tell a program that did not run from one that did** --
 * and that is a fact about a child process, so these run one.
 *
 * `process.execPath` is the program, because node is on every cell this suite
 * runs on and the call shape under test is *one argument*: `--version` exits
 * 0, a path that is not a file exits non-zero, and a program that is not there
 * does not start at all.
 */
test("a program that ran and returned nothing is reached", async () => {
  const notify = notifierAt(process.execPath);
  expect(notify).not.toBeNull();
  expect(await notify?.("--version")).toEqual({ kind: "reached" });
});

test("a program that returned non-zero is a failure with its status in it", async () => {
  const outcome = await notifierAt(process.execPath)?.("./this-is-not-a-file-anybody-has");
  expect(outcome?.kind).toBe("failed");
  expect(outcome?.kind === "failed" ? outcome.reason : "").toMatch(/ended with status [^0]/);
});

test("a program that is no longer where setup found it is a failure", async () => {
  const outcome = await notifierAt("/no/such/program/on/this/machine")?.("anything");
  expect(outcome?.kind).toBe("failed");
});

test("no program at all is no port at all", () => {
  expect(notifierAt(null)).toBeNull();
  expect(notifierAt("")).toBeNull();
});

test("a request's second turn is sent, and is not taken for a repeat of its first", async () => {
  // Codex, round 1: the claim used to be keyed by the request, so everything
  // after a request's first question went out to nobody -- which is most of
  // what a request is. A request outlives any one of its waits, and this is
  // the case that says so: a question, answered, and then a gate.
  const world = fresh();
  await openRequest(world, "req-a", "have a look at this");
  const asked = await world.record.recordThreadMessage({
    messageId: "ask",
    body: "which of these did you mean?",
    authorKind: "drafter",
    authorId: "the drafter",
    inReplyTo: "req-a",
    atMs: 600,
    bases: [{ form: "message", messageId: "req-a" }],
    asks: true,
  });
  expect(asked.kind).toBe("recorded");

  const tick = tickOver(world);
  await tick.run();
  expect(tick.sent).toEqual([EN.reachYourTurn]);

  // The person answers it, and a lap started from the request reaches a gate.
  const carried = await world.record.recordThreadMessage({
    messageId: "reply",
    body: "the first one",
    authorKind: "operator",
    authorId: "ada",
    inReplyTo: "ask",
    atMs: 700,
    bases: [],
    asks: false,
    answerOutcome: "carry_on",
  });
  expect(carried.kind).toBe("recorded");
  await reserve(world, "a", "do the thing", null, "req-a");
  await openGate(world, "a");

  const after = tickOver(world);
  await after.run();
  expect(after.sent).toEqual([EN.reachYourTurn]);
  expect(claimed(world).toSorted()).toEqual(["ask:ask", "gate:a:awaiting_human"]);
});

test("two hosts over one store send one line between them, not one each", async () => {
  // Codex, round 2. Nothing stops two `rondo web` processes from opening the
  // same store on two ports, and a tick that asked *has this been sent* and
  // then wrote *it has* would leave a window in which both answered no. The
  // claim is one statement, and the writer whose insert landed is the one that
  // sends: the unique index deduplicates rows, and this deduplicates
  // deliveries.
  const world = fresh();
  await reserve(world, "a", "do the thing");
  await openGate(world, "a");

  const one = tickOver(world);
  const two = tickOver(world);
  await Promise.all([one.run(), two.run()]);

  expect([...one.sent, ...two.sent]).toEqual([EN.reachYourTurn]);
  expect(claimed(world)).toEqual(["gate:a:awaiting_human"]);
});

test("a store that will not take the claim is said, and nothing is sent on it", async () => {
  const world = fresh();
  await reserve(world, "a", "do the thing");
  await openGate(world, "a");
  const tick = tickOver(world);
  const said: string[] = [];
  const sent: string[] = [];
  await reachThePerson({
    ...tick.ports,
    record: {
      ...world.record,
      claimAttention: async () => ({ kind: "defect", reason: "the database is locked" }),
    },
    notify: async (sentence) => {
      sent.push(sentence);
      return { kind: "reached" };
    },
    say: (line) => {
      said.push(line);
    },
  });
  expect(sent).toEqual([]);
  expect(said.join("\n")).toContain("the database is locked");
});

test("a lap that stopped short reaches the person once, in their words (rondo#432)", async () => {
  // Lap 13: a try cut by its turn budget reached neither the host's program
  // nor the tab. A stop is terminal, so it was on neither side of *whose turn*.
  const world = fresh();
  await reserve(world, "a", "do the thing");
  await stop(world, "a", 3_000);
  const tick = tickOver(world, { since: 2_500 });
  await tick.run();
  expect(tick.sent).toEqual([EN.reachStopped]);
  expect(claimed(world)).toEqual(["stopped:a"]);

  const again = tickOver(world, { since: 2_500 });
  await again.run();
  expect(again.sent).toEqual([]);
  expect(chromeFor("ja").reachStopped).not.toBe(EN.reachStopped);
});

test("a stop from before the host started is not told, so an upgrade does not replay history", async () => {
  const world = fresh();
  await reserve(world, "a", "do the thing");
  await stop(world, "a", 3_000);
  const tick = tickOver(world, { since: 3_001 });
  await tick.run();
  expect(tick.sent).toEqual([]);
  expect(claimed(world)).toEqual([]);
});

test("a turn and a stop in one minute is one line, and it is the turn", async () => {
  const world = fresh();
  await reserve(world, "a", "do the thing");
  await openGate(world, "a");
  await reserve(world, "b", "do the other thing");
  await stop(world, "b", 3_000);
  const tick = tickOver(world);
  await tick.run();
  expect(tick.sent).toEqual([EN.reachYourTurn]);
  expect(claimed(world).toSorted()).toEqual(["gate:a:awaiting_human", "stopped:b"]);
});
