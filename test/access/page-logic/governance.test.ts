/**
 * What was agreed for one request (DECISIONS.md D-0083 rule 6).
 *
 * The properties held here are the two rule 6 states outright: **a spent
 * figure is never shown without the figure it was approved against**, and the
 * chain's last step is never rondo's. Beside them are the two things the
 * second slice adds (rondo#350): **where a lap may touch**, which is the
 * approval's and so travels with the pair, and **what rondo decided without
 * asking**, which is now a count of this request's own rows rather than an
 * item the line admitted it could not carry.
 */
import { expect, test } from "vitest";
import { governanceOf } from "../../../src/access/page-logic/governance.js";
import type { IterationRecord, ScopePayload, ScopeSpent } from "../../../src/store/records.js";

const lap = (over: Partial<IterationRecord>): IterationRecord =>
  ({ status: "performing", gateOutcome: null, plan: {}, ...over }) as IterationRecord;

const approval = (
  over: Partial<ScopePayload> = {},
  spent: Partial<ScopeSpent> = {},
): { payload: ScopePayload; spent: ScopeSpent } => ({
  payload: {
    requests: ["m-1"],
    workspaces: [],
    agent_types: [],
    budgets: {
      laps: 3,
      review_rounds: 1,
      cost_usd: 20,
      cost_reserve_usd: 2,
      expires_at_ms: 9_000,
    },
    severity_threshold: "major",
    outward_acts: [],
    irreversible_additions: [],
    ...over,
  } as ScopePayload,
  spent: { admissions: 1, readCostUsd: 5, unreadLaps: 0, ...spent },
});

test("with no approval to read, neither figure is drawn", () => {
  // Rule 6's last sentence, as the one state that hides both: a lap admitted
  // under no approval has spent money nobody agreed to, and a spend printed
  // alone would read as though somebody had.
  const bare = governanceOf(lap({}), "o/r", 1_000, null, false, []);
  expect(bare.allowance).toBeNull();
  expect(bare.tries).toBeNull();
  // And what it does know is still said.
  expect(bare.repository).toBe("o/r");
  expect(bare.askedAtMs).toBe(1_000);
});

test("what is held for an unread lap is its own figure, not part of the spend", () => {
  // `D-0046`: a null cost is *not read*, not zero, and `D-0066` rule 3.4.2
  // makes it hold the reserve until it is. The store's check still adds the
  // two; the page says them apart (rondo#378), because a reserve drawn as
  // spent read as a fact to lap 11's owner and then changed under them.
  const { allowance } = governanceOf(lap({}), null, 1, approval({}, { unreadLaps: 2 }), false, []);
  expect(allowance).toEqual({
    spentUsd: 5,
    heldUsd: 2 * 2,
    heldTries: 2,
    heldInProgress: false,
    approvedUsd: 20,
  });
});

test("the request's tries are listed with their costs, and a running one holds the reserve", () => {
  const laps = [
    lap({ status: "closed", lapCostUsd: 0.79 }),
    lap({ status: "failed", lapCostUsd: null }),
    lap({ status: "performing", lapCostUsd: null }),
  ];
  const all = governanceOf(
    laps[2] as IterationRecord,
    null,
    1,
    approval({}, { readCostUsd: 0.79, unreadLaps: 2 }),
    false,
    [],
    laps,
  );
  expect(all.byTry).toEqual([
    { costUsd: 0.79, running: false },
    { costUsd: null, running: false },
    { costUsd: null, running: true },
  ]);
  // One of the two holding laps ended unread, so *in progress* would be false
  // of it: the plainer sentence is said.
  expect(all.allowance?.heldInProgress).toBe(false);

  const going = governanceOf(
    laps[2] as IterationRecord,
    null,
    1,
    approval({}, { readCostUsd: 0.79, unreadLaps: 1 }),
    false,
    [],
    [laps[0] as IterationRecord, laps[2] as IterationRecord],
  );
  expect(going.allowance?.heldInProgress).toBe(true);
});

test("the chain reads the lap's status, and its last step is never rondo's", () => {
  const atGate = governanceOf(lap({ status: "awaiting_human" }), null, 1, approval(), false, []);
  expect(atGate.chain).toEqual([
    { step: "answer", state: "waiting" },
    // The approval permits no outward act, so nobody but a person opens one.
    { step: "proposal", state: "yours" },
    { step: "merge", state: "yours" },
  ]);

  // **`merge_default_branch` is not a scope's to grant** (D-0064 rule 3.4, and
  // the store refuses the name), so no approval can move the last step off
  // *yours*. Drawing it as *ahead* would say rondo was going to do it.
  const permissive = governanceOf(
    lap({ status: "closed", gateOutcome: "approve" }),
    null,
    1,
    approval({ outward_acts: ["push_branch", "open_pull_request"] }),
    true,
    [],
  );
  expect(permissive.chain).toEqual([
    { step: "answer", state: "done" },
    { step: "proposal", state: "done" },
    { step: "merge", state: "yours" },
  ]);

  // **Permission and an ended lap are not evidence a proposal was made**
  // (Codex): a lap can end failed, abandoned, or closed and still waiting for
  // the publish press, and a chain that marked those done would say a pull
  // request exists when none does.
  const ended = governanceOf(
    lap({ status: "closed", gateOutcome: "approve" }),
    null,
    1,
    approval({ outward_acts: ["open_pull_request"] }),
    false,
    [],
  );
  expect(ended.chain[1]).toEqual({ step: "proposal", state: "ahead" });

  // Before a gate, the answer is ahead rather than waiting: nothing is asking.
  expect(governanceOf(lap({ status: "planned" }), null, 1, approval(), false, []).chain[0]).toEqual(
    {
      step: "answer",
      state: "ahead",
    },
  );
});

test("where a lap may touch is the approval's, so it is absent with the approval", () => {
  // Rule 6 pairs the reach with the allowance: all three of the pair, the
  // tries and the places come off one approval, and a lap admitted under none
  // has no agreed reach to draw rather than an empty one.
  expect(governanceOf(lap({}), null, 1, null, false, []).touches).toBeNull();

  const reached = governanceOf(
    lap({}),
    null,
    1,
    approval({
      workspaces: [{ repository: "o/r", workspace_root: "/w" }],
      outward_acts: ["push_branch"],
    }),
    false,
    [],
  );
  expect(reached.touches).toEqual({
    places: [{ repository: "o/r", root: "/w" }],
    acts: ["push_branch"],
  });

  // An approval that permits nothing outward is not the same as no approval:
  // it is a reach with nothing in it, and the face says so.
  expect(governanceOf(lap({}), null, 1, approval(), false, []).touches).toEqual({
    places: [],
    acts: [],
  });
});

test("what rondo decided without asking is counted, and named heaviest first", () => {
  // The item the line used to admit it could not carry. Zero is drawn now,
  // because it is read from this request's own withheld rows: nothing was
  // recorded about this request, which is a fact and not a claim about every
  // silence rondo has ever kept.
  const quiet = governanceOf(lap({}), null, 1, null, false, []);
  expect(quiet.decided).toEqual({ count: 0, byRule: [] });

  const decided = governanceOf(lap({}), null, 1, null, false, [
    { ruleName: "duplicate-delivery", count: 2 },
    { ruleName: "already-answered", count: 9 },
    { ruleName: "below-threshold", count: 2 },
  ]);
  expect(decided.decided.count).toBe(13);
  // Heaviest first, and by name where two weigh the same, so the order is the
  // reader's and not the query's.
  expect(decided.decided.byRule.map((rule) => rule.ruleName)).toEqual([
    "already-answered",
    "below-threshold",
    "duplicate-delivery",
  ]);
});
