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
    openProposals: async () => {
      events.push("read");
      return await record.openProposals();
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

test("a live row that will not decode is on the screen", () => {
  const rendered = inboxLines("operator-1", {
    ...EMPTY,
    live: [{ kind: "unreadable", id: "i-0009", reason: "status column is 'wat'" }],
  }).join("\n");
  expect(rendered).toContain("i-0009  will not decode: status column is 'wat'");
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
