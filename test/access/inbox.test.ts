/**
 * The inbox, over a real store and over hand-built snapshots.
 *
 * Two kinds of property live here and they are kept apart on purpose:
 *
 *  - **the order of the writes** (D-0032 rule 9, D-0036's stated ceiling),
 *    which needs a real database and an observed sequence, because it is a
 *    property of *when* things happen and not of what is rendered;
 *  - **what the screen says**, which needs no database at all: `inboxLines` is
 *    a pure function of an {@link InboxSnapshot}, so the partition, the two
 *    voices and the silence are asserted against a world written by hand.
 */
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import { type InboxSnapshot, inboxLines, showInbox } from "../../src/access/inbox.js";
import { CONSERVATIVE_HOST_POLICY } from "../../src/refrain/policy.js";
import type { IterationRecord, IterationStatus, JsonRecord } from "../../src/store/records.js";
import { WAIT_SIDE } from "../../src/store/records.js";
import { advisoryRecord, iterationStore } from "../../src/store/sqlite.js";

const somePlan = (): JsonRecord => ({ run_id: "r-0001", workspace: "/srv/work/r-0001" });

const fresh = () => {
  const connection = new DatabaseSync(":memory:");
  return {
    connection,
    store: iterationStore(connection, CONSERVATIVE_HOST_POLICY),
    record: advisoryRecord(connection),
  };
};

const reserveOne = async (store: ReturnType<typeof fresh>["store"], id: string, nowMs = 1_000) =>
  store.reserve({
    id,
    request: "teach revise to name the flags it takes",
    plan: somePlan(),
    nowMs,
    supersedesIterationId: null,
    runId: `rondo-${id}`,
    topicBranch: `rondo/${id}`,
    workspace: `/srv/work/iter-${id}`,
  });

const screen = () => {
  const shown: string[] = [];
  return { shown, present: (lines: readonly string[]) => shown.push(...lines) };
};

/** One live row, as the renderer takes it. */
const liveRow = (id: string, status: IterationStatus, updatedAtMs = 1_000): IterationRecord =>
  ({
    id,
    status,
    request: "do the thing",
    planDigest: "sha256:plan",
    attempts: 1,
    supersedesIterationId: null,
    continuoRevision: null,
    agentTypeDigest: null,
    configDigest: null,
    contractDigest: null,
    classification: null,
    classificationReason: null,
    modelTier: null,
    model: null,
    gateId: null,
    gateStage: null,
    gateOutcome: null,
    reason: null,
    runId: `rondo-${id}`,
    topicBranch: `rondo/${id}`,
    workspace: `/srv/work/${id}`,
    sessionId: `session-${id}`,
    sessionPath: `/srv/sessions/${id}`,
    plan: somePlan(),
    createdAtMs: updatedAtMs,
    updatedAtMs,
  }) as unknown as IterationRecord;

const EMPTY: InboxSnapshot = {
  atMs: 10_000,
  sinceMs: null,
  live: [],
  open: [],
  changed: [],
  attention: [],
  unspent: [],
};

// --- the order of the writes (D-0032 rule 9) ------------------------------

test("the mark is sampled before the reads and written after the render", async () => {
  // **The ceiling D-0036 names, held at its designed width.** The mark is the
  // bound the render's own queries used: sampled first, written last. Sampling
  // at the end would lose every row committed while the render ran -- silently,
  // because the next look asks for changes strictly after the mark. This test
  // is what fails if the two ever swap.
  const { store, record } = fresh();
  await reserveOne(store, "i-0001");

  const events: string[] = [];
  const clock = [5_000, 9_999];
  const watched = {
    ...record,
    lastView: async (actorId: string) => {
      events.push("read");
      return await record.lastView(actorId);
    },
    openProposals: async (uptoMs: number) => {
      events.push(`read upto ${String(uptoMs)}`);
      return await record.openProposals(uptoMs);
    },
    recordAttention: async (row: Parameters<typeof record.recordAttention>[0]) => {
      events.push("count");
      return await record.recordAttention(row);
    },
    recordView: async (actorId: string, viewedAtMs: number) => {
      events.push(`mark ${String(viewedAtMs)}`);
      return await record.recordView(actorId, viewedAtMs);
    },
  };

  const shows = {
    shown: [] as string[],
    present: (lines: readonly string[]) => {
      events.push("render");
      shows.shown.push(...lines);
    },
  };
  const outcome = await showInbox(
    {
      store,
      record: watched,
      present: shows.present,
      now: () => {
        events.push("clock");
        return clock.shift() ?? 99_999;
      },
    },
    "operator-1",
  );

  expect(outcome.kind).toBe("shown");
  // **The clock is the first thing that happens**, before any read: a bound
  // sampled after the reads would not cover the rows those reads saw.
  expect(events[0]).toBe("clock");
  // And it is read **once**: the second value is still unspent, so nothing
  // later re-sampled it.
  expect(clock).toEqual([9_999]);
  expect(events.indexOf("read")).toBeLessThan(events.indexOf("render"));
  // **The read the look writes about is bounded by the mark it will write.**
  // Otherwise a proposal that landed after the sample is counted as presented
  // at a moment before it existed.
  expect(events).toContain("read upto 5000");
  expect(events.indexOf("render")).toBeLessThan(events.lastIndexOf("mark 5000"));
  expect(events.at(-1)).toBe("mark 5000");
  // And the mark that was written is the bound, not a later clock.
  expect(await record.lastView("operator-1")).toBe(5_000);
});

test("a second look reports what changed since the first, inclusive of the mark", async () => {
  // D-0032 rule 11 wired to rule 9: the first look writes the bound, the
  // second asks `changedSince` with it. Inclusive, so a row bearing exactly
  // the mark may be shown twice -- the failure the rule accepts rather than
  // losing one for ever.
  const { store, record } = fresh();
  await reserveOne(store, "i-0001");
  const first = screen();
  await showInbox({ store, record, present: first.present, now: () => 5_000 }, "operator-1");
  expect(first.shown.join("\n")).toContain("you have never looked");

  // Recorded **after** the first look's mark, so it is what the diff is about.
  await record.recordProposal({
    proposalId: "p-0001",
    kind: "run_plan",
    drafter: "rondo/advisory/deterministic",
    payload: { options: [] },
    snapshot: {},
    derivation: null,
    iterationId: "i-0001",
    supersedesIterationId: null,
    supersedesProposalId: null,
    predecessorPlanDigest: null,
    predecessorContractDigest: null,
    agentTypeDigest: null,
    configDigest: null,
    contractDigest: null,
    continuoRevision: null,
    cadenzaRevision: null,
    elevatedFromMessageId: null,
    elevatedByActorId: null,
    createdAtMs: 5_500,
  });
  const second = screen();
  const outcome = await showInbox(
    { store, record, present: second.present, now: () => 6_000 },
    "operator-1",
  );
  expect(outcome.kind).toBe("shown");
  const rendered = second.shown.join("\n");
  expect(rendered).toContain("since your last look");
  // The census names the kind and the count; the row itself follows.
  expect(rendered).toContain("proposal 1");
  // And rule 9 and rule 11 meet on the line the operator actually reads: the
  // proposal that landed after the mark is the one marked NEW.
  expect(rendered).toContain("p-0001  run_plan  about 'i-0001'");
  expect(rendered).toContain("NEW");
});

test("a subject drawn twice is counted once, and the second look still succeeds", async () => {
  // D-0036 rule 1, which exists **for** this surface: the inbox is looked at
  // repeatedly across gaps, so counting per render would report one unanswered
  // proposal as twenty presentations. The second write stores nothing and
  // reports success -- not a refusal, because the invariant "every presented
  // subject has a row" still holds.
  const { connection, store, record } = fresh();
  await reserveOne(store, "i-0001");
  await record.recordProposal({
    proposalId: "p-0001",
    kind: "run_plan",
    drafter: "rondo/advisory/deterministic",
    payload: { options: [] },
    snapshot: {},
    derivation: null,
    iterationId: "i-0001",
    supersedesIterationId: null,
    supersedesProposalId: null,
    predecessorPlanDigest: null,
    predecessorContractDigest: null,
    agentTypeDigest: null,
    configDigest: null,
    contractDigest: null,
    continuoRevision: null,
    cadenzaRevision: null,
    elevatedFromMessageId: null,
    elevatedByActorId: null,
    createdAtMs: 2_000,
  });

  for (const atMs of [5_000, 6_000, 7_000]) {
    const outcome = await showInbox(
      { store, record, present: screen().present, now: () => atMs },
      "operator-1",
    );
    expect(outcome.kind).toBe("shown");
  }
  expect(
    connection
      .prepare("SELECT count(*) AS n FROM operator_attention WHERE disposition = 'presented'")
      .get(),
  ).toEqual({ n: 1 });
  expect(connection.prepare("SELECT at_ms FROM operator_attention").get()).toEqual({
    at_ms: 5_000,
  });
});

test("a look whose mark could not be written says so, and the screen still stands", async () => {
  const { store, record } = fresh();
  await reserveOne(store, "i-0001");
  const shows = screen();
  const outcome = await showInbox(
    {
      store,
      record: { ...record, recordView: async () => ({ kind: "defect", reason: "disk gone" }) },
      present: shows.present,
      now: () => 5_000,
    },
    "operator-1",
  );
  expect(outcome.kind).toBe("shownIncomplete");
  if (outcome.kind !== "shownIncomplete") {
    return;
  }
  expect(outcome.reasons.join(" ")).toContain("disk gone");
  expect(outcome.reasons.join(" ")).toContain("report the same changes again");
  expect(shows.shown.length).toBeGreaterThan(0);
});

// --- what the screen says (no database) -----------------------------------

test("the wait is a two-way partition, and every live status is on one side", () => {
  // **D-0036 rule 5 read off the type rather than off a list written here.**
  // `WAIT_SIDE` is a `Record<NonTerminalStatus, ...>`, so a status added to the
  // union and forgotten is a compile error; this asserts the second half --
  // that every member the table names actually reaches a section of the
  // screen, and that `planned` and `classified` are among them.
  const live = Object.keys(WAIT_SIDE).map((status, index) =>
    liveRow(`i-${String(index)}`, status as IterationStatus),
  );
  const rendered = inboxLines("operator-1", {
    ...EMPTY,
    live: live.map((record) => ({ kind: "read", record })),
  }).join("\n");
  for (const [index, status] of Object.keys(WAIT_SIDE).entries()) {
    expect(rendered).toContain(`i-${String(index)}  ${status}`);
  }
  expect(rendered).toContain("iterations waiting on you (3)");
  // **The gate, or its absence, is read off the row.** Two of the three
  // waiting statuses suspend at a named gate; the fixture above has no gate id
  // on any of them, so all three say so rather than implying `rondo answer`
  // would work.
  expect(rendered).toContain("no gate: a person has to decide");
  expect(rendered).toContain("in flight (5)");
});

test("an in-flight row names its workspace (#71)", () => {
  // **The half of the brief's falsifier a `performing` row can actually
  // carry.** `workspace` is written by `reserve()` before the lap starts, so
  // it is on every in-flight row from the moment it exists.
  const record = liveRow("i-running", "performing");
  const rendered = inboxLines("operator-1", {
    ...EMPTY,
    live: [{ kind: "read", record }],
  }).join("\n");
  expect(rendered).toContain(`in ${String(record.workspace)}`);
});

test("an in-flight row with no session recorded says so rather than inventing one", () => {
  // **The state every `performing` row is actually in.** `sessionId` is
  // `null` on the row for the whole time a lap is genuinely running --
  // `interpreter.ts`'s `performLap` step commits `performing` with no session
  // fields and writes them only once the lap has already answered -- so the
  // line says that plainly instead of printing `null` or nothing at all.
  const record = { ...liveRow("i-running", "performing"), sessionId: null };
  const rendered = inboxLines("operator-1", {
    ...EMPTY,
    live: [{ kind: "read", record }],
  }).join("\n");
  expect(rendered).toContain("session (no session recorded on this row yet)");
  expect(rendered).toContain(`in ${String(record.workspace)}`);
});

test("whereItRuns reads back a session once the row carries one", () => {
  // **Exercises the true branch, without claiming it is reachable today.**
  // No in-flight status writes `sessionId` under the current interpreter (see
  // the test above), so this is the fallback's counterpart rather than a
  // scenario `rondo inbox` shows in practice.
  const record = liveRow("i-running", "performing");
  const rendered = inboxLines("operator-1", {
    ...EMPTY,
    live: [{ kind: "read", record }],
  }).join("\n");
  expect(rendered).toContain(`session ${String(record.sessionId)}`);
});

test("a live row that will not decode is on the screen", () => {
  const rendered = inboxLines("operator-1", {
    ...EMPTY,
    live: [{ kind: "unreadable", id: "i-0009", reason: "status column is 'wat'" }],
  }).join("\n");
  expect(rendered).toContain("i-0009  will not decode: status column is 'wat'");
  // **And it is in the count above it.** The row holds a slot; a section
  // reading `in flight (0)` over a printed row would report capacity that is
  // not there, to the reader deciding whether to start something else.
  expect(rendered).toContain("in flight (1)");
});

test("the two voices are separated by kind and by nothing else", () => {
  // #41 section 2: the voice that becomes a contract and the voice that binds
  // nothing must be distinguishable **without reading their prose**. Both rows
  // below carry the same drafter and the same subject; only `kind` differs.
  const rendered = inboxLines("operator-1", {
    ...EMPTY,
    open: [
      { proposalId: "p-plan", kind: "run_plan", iterationId: "i-1", createdAtMs: 9_000 },
      { proposalId: "p-said", kind: "explanation", iterationId: "i-1", createdAtMs: 9_000 },
      { proposalId: "p-huh", kind: "from_the_future", iterationId: "i-1", createdAtMs: 9_000 },
    ],
  }).join("\n");
  const binding = rendered.indexOf("become contracts when you approve them (1)");
  const nonBinding = rendered.indexOf("bind nothing (2)");
  expect(binding).toBeGreaterThanOrEqual(0);
  expect(nonBinding).toBeGreaterThan(binding);
  // A kind this rondo does not know is **not** approvable and is not dropped
  // either: it is waiting on somebody, and it is rendered as the voice that
  // binds nothing, which is the same answer `isApprovableKind` gives.
  expect(rendered.slice(nonBinding)).toContain("p-huh");
  expect(rendered.slice(binding, nonBinding)).toContain("p-plan");
});

test("nothing waiting is a section that says zero, not a section that vanishes", () => {
  const rendered = inboxLines("operator-1", EMPTY).join("\n");
  expect(rendered).toContain("become contracts when you approve them (0)");
  expect(rendered).toContain("iterations waiting on you (0)");
  expect(rendered).toContain("in flight (0)");
  expect(rendered).toContain("presented 0, withheld 0");
  expect(rendered).toContain("approved and never spent (0)");
});

test("the silence is both sides of one table, broken down by the rule", () => {
  const rendered = inboxLines("operator-1", {
    ...EMPTY,
    attention: [
      { disposition: "presented", ruleName: null, count: 6 },
      { disposition: "withheld", ruleName: "duplicate-delivery", count: 31 },
      { disposition: "withheld", ruleName: "already-answered", count: 9 },
    ],
  }).join("\n");
  expect(rendered).toContain("presented 6, withheld 40");
  expect(rendered).toContain("withheld by 'duplicate-delivery' 31");
  expect(rendered).toContain("withheld by 'already-answered' 9");
});

test("NEW marks only what landed since the mark, and only when there is a mark", () => {
  const open = [{ proposalId: "p-new", kind: "run_plan", iterationId: "i-1", createdAtMs: 9_000 }];
  const changed = [{ kind: "proposal", id: "p-new", atMs: 9_000 }];
  expect(
    inboxLines("operator-1", { ...EMPTY, open, changed, sinceMs: 8_000 }).join("\n"),
  ).toContain("p-new  run_plan  about 'i-1'  waiting 1s  NEW");
  // A first look marks nothing new: everything would be, which is true and
  // useless.
  expect(inboxLines("operator-1", { ...EMPTY, open }).join("\n")).not.toContain("NEW");
});

test("a proposal that lands after the bound is not counted as presented before it existed", async () => {
  // D-0032 rule 9's own words: the mark is *the bound the render's own query
  // used*. The proposal below is created after the look's sample, so this look
  // neither shows it nor stamps an `operator_attention` row for it at a moment
  // it did not exist. The next look, whose bound is later, does both.
  const { connection, store, record } = fresh();
  await reserveOne(store, "i-0001");
  await record.recordProposal({
    proposalId: "p-late",
    kind: "run_plan",
    drafter: "rondo/advisory/deterministic",
    payload: { options: [] },
    snapshot: {},
    derivation: null,
    iterationId: "i-0001",
    supersedesIterationId: null,
    supersedesProposalId: null,
    predecessorPlanDigest: null,
    predecessorContractDigest: null,
    agentTypeDigest: null,
    configDigest: null,
    contractDigest: null,
    continuoRevision: null,
    cadenzaRevision: null,
    elevatedFromMessageId: null,
    elevatedByActorId: null,
    createdAtMs: 8_000,
  });

  const early = screen();
  await showInbox({ store, record, present: early.present, now: () => 5_000 }, "operator-1");
  expect(early.shown.join("\n")).not.toContain("p-late");
  expect(connection.prepare("SELECT count(*) AS n FROM operator_attention").get()).toEqual({
    n: 0,
  });

  const later = screen();
  await showInbox({ store, record, present: later.present, now: () => 9_000 }, "operator-1");
  expect(later.shown.join("\n")).toContain("p-late");
  expect(connection.prepare("SELECT at_ms FROM operator_attention").get()).toEqual({
    at_ms: 9_000,
  });
});

test("a stalled row is never offered a gate to answer, even when it kept one", () => {
  // `stall()` changes the status and leaves `gate_id` where it was, so a
  // stalled row can still be carrying the gate it suspended at -- and
  // `resume()` does not observe gates in that status. Offering it would send
  // the operator to answer something that cannot release the row.
  const stalled = { ...liveRow("i-0011", "stalled"), gateId: "g-0011" } as IterationRecord;
  const suspended = { ...liveRow("i-0007", "awaiting_human"), gateId: "g-0007" } as IterationRecord;
  const rendered = inboxLines("operator-1", {
    ...EMPTY,
    live: [
      { kind: "read", record: stalled },
      { kind: "read", record: suspended },
    ],
  }).join("\n");
  expect(rendered).toContain("no gate answer releases this (stopped at g-0011)");
  expect(rendered).toContain("i-0007  awaiting_human");
  expect(rendered).toContain("answer gate g-0007");
});
