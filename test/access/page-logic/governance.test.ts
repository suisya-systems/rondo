/**
 * What was agreed for one request (DECISIONS.md D-0083 rule 6).
 *
 * The properties held here are the two rule 6 states outright: **a spent
 * figure is never shown without the figure it was approved against**, and the
 * chain's last step is never rondo's. The third is the entry's own honesty
 * requirement -- the item this line does not carry is named in the module
 * rather than drawn as a zero.
 */
import { expect, test } from "vitest";
import { governanceOf, WITHHELD_NOT_READ } from "../../../src/access/page-logic/governance.js";
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
  const bare = governanceOf(lap({}), "o/r", 1_000, null, false);
  expect(bare.allowance).toBeNull();
  expect(bare.tries).toBeNull();
  // And what it does know is still said.
  expect(bare.repository).toBe("o/r");
  expect(bare.askedAtMs).toBe(1_000);
});

test("the spend counts the reserve every unread lap still holds", () => {
  // `D-0046`: a null cost is *not read*, not zero, and `D-0066` rule 3.4.2
  // makes it hold the reserve until it is. The figure on the line is the one
  // the store measures the budget against, or the page would say there was
  // room the press is about to refuse.
  const { allowance } = governanceOf(lap({}), null, 1, approval({}, { unreadLaps: 2 }), false);
  expect(allowance).toEqual({ spentUsd: 5 + 2 * 2, approvedUsd: 20 });
});

test("the chain reads the lap's status, and its last step is never rondo's", () => {
  const atGate = governanceOf(lap({ status: "awaiting_human" }), null, 1, approval(), false);
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
  );
  expect(ended.chain[1]).toEqual({ step: "proposal", state: "ahead" });

  // Before a gate, the answer is ahead rather than waiting: nothing is asking.
  expect(governanceOf(lap({ status: "planned" }), null, 1, approval(), false).chain[0]).toEqual({
    step: "answer",
    state: "ahead",
  });
});

test("the item this line does not carry is named, and names its right source", () => {
  // Five of rule 6's six. The sixth is absent rather than zero, and the reason
  // is written down where the next slice will look for it.
  expect(WITHHELD_NOT_READ).toContain("attentionBreakdown");
  expect(WITHHELD_NOT_READ).toContain("withheld");
  expect(WITHHELD_NOT_READ).toContain("D-0032 rule 10");
});
