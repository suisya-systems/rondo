/**
 * What was agreed for one request, as the line under its title
 * (DECISIONS.md D-0083 rule 6).
 *
 * **Derived, never stored** (`D-0032` rule 3). Every figure here is read back
 * from rows that already exist -- the lap, the approval it spends, what has
 * been spent against it -- and none of them is a column this line made. A
 * governance line with a cache behind it would be a second answer to "what was
 * agreed", and the two would drift.
 *
 * **A spent figure is never shown without the figure it was approved against**
 * (rule 6, last sentence). The two travel together or neither is drawn: a lap
 * admitted under no approval has spent money that nobody agreed to, and
 * printing the spend alone would read as though somebody had.
 *
 * **Five items, and the sixth is named rather than dropped.** Rule 6 asks for
 * six: repository, when it was asked, spent / approved, which try of how many,
 * **how many things rondo decided without asking**, and what remains. The
 * fifth is not here, and {@link WITHHELD_NOT_READ} says why in one place so
 * that the page can say it too. It is not drawn as zero, because zero is a
 * claim -- *rondo decided nothing without asking* -- and rondo cannot read
 * whether that is true per request yet.
 */
import type { IterationRecord, ScopePayload, ScopeSpent } from "../../store/records.js";
import { SCOPE_OUTWARD_ACTS } from "../../store/records.js";

/**
 * **Why the count of what rondo decided without asking is not in this line.**
 *
 * `attentionBreakdown` (`src/store/sqlite.ts`) counts dispositions over a time
 * interval and cannot be narrowed to one request: its query is bounded by
 * `at_ms` and nothing else, so what it answers about a request is "everything
 * in the window", which is not the same number.
 *
 * The right source is the `attention` table's own `withheld` disposition
 * (`AttentionDisposition` in `src/store/records.ts`, `D-0032` rule 10): a row
 * per decision rondo took without calling a person, which a read narrowed by
 * the request's lineage would count exactly. That read does not exist yet, and
 * writing one is the second slice's -- the right face carries the same count
 * named and explained (rule 6), so it is built once, there.
 */
export const WITHHELD_NOT_READ =
  "attentionBreakdown reads by time interval, not by request; the per-request count comes from " +
  "the attention table's withheld disposition (D-0032 rule 10) and is the right face's, in the " +
  "second slice";

/** One step of rule 6's chain, and where the work stands in it. */
export type ChainStep = "answer" | "proposal" | "merge";

/**
 * - `done`: it has happened.
 * - `waiting`: it is what the work is stopped on now.
 * - `ahead`: it has not happened and nothing says it cannot.
 * - `yours`: rondo will not do it, so it is the person's whatever else is true.
 */
export type StepState = "done" | "waiting" | "ahead" | "yours";

export interface ChainLink {
  readonly step: ChainStep;
  readonly state: StepState;
}

export interface Governance {
  /** The repository the work is in (`D-0081`), or null where the lap names none. */
  readonly repository: string | null;
  /** When the person asked, as milliseconds; the caller says it in its own words. */
  readonly askedAtMs: number;
  /**
   * What has been spent and what was approved, in dollars -- or null where no
   * approval can be read, which is the one state that hides both.
   */
  readonly allowance: { readonly spentUsd: number; readonly approvedUsd: number } | null;
  /** Which try of how many the approval allows, or null with no approval to read it from. */
  readonly tries: { readonly at: number; readonly of: number } | null;
  /** What remains, as rule 6's chain. */
  readonly chain: readonly ChainLink[];
}

/**
 * The line for one lap.
 *
 * `scope` and `spent` are null together where the lap was admitted under no
 * approval, or where the approval did not read: both figures rule 6 pairs come
 * from them, so both are withheld.
 *
 * **The chain is read from the lap's status and the scope's `outward_acts`**,
 * and from nothing else:
 *
 * - *your answer* is `waiting` at a gate, `done` once the lap has left one with
 *   an outcome, and `ahead` before it reaches one.
 * - *proposal* is `yours` where the approval does not permit
 *   `open_pull_request` -- rondo may not open one, so somebody has to -- `done`
 *   only where a proposal was **recorded as made**, and `ahead` otherwise.
 *   Permission plus an ended lap is not evidence: a lap can end failed,
 *   abandoned, or closed and still waiting for the separate publish press, and
 *   a chain that marked those *done* would say a pull request exists when none
 *   does.
 * - *merge* is always `yours`. `merge_default_branch` is not a member of
 *   {@link SCOPE_OUTWARD_ACTS} and the writer refuses it by name, so no scope
 *   can put rondo on this step. Drawing it as *ahead* would suggest rondo were
 *   going to do it.
 */
/**
 * What one approval has spent and what it allows, as the pair rule 6 never
 * separates.
 *
 * **The spend is the figure the store measures a budget against**: what was
 * read, plus the reserve every lap whose cost is not read yet still holds
 * (`D-0046`, `D-0066` rule 3.4.2). It is here rather than inside
 * {@link governanceOf} because the right face sums the same pair over a week
 * (`page-logic/week.ts`), and two places computing a spend differently would
 * be two answers to what has been spent.
 */
export function allowanceOf(approval: {
  readonly payload: ScopePayload;
  readonly spent: ScopeSpent;
}): { readonly spentUsd: number; readonly approvedUsd: number } {
  return {
    spentUsd:
      approval.spent.readCostUsd +
      approval.spent.unreadLaps * approval.payload.budgets.cost_reserve_usd,
    approvedUsd: approval.payload.budgets.cost_usd,
  };
}

export function governanceOf(
  record: IterationRecord,
  repository: string | null,
  askedAtMs: number,
  approval: { readonly payload: ScopePayload; readonly spent: ScopeSpent } | null,
  /**
   * Whether a proposal was recorded as made for this lap -- the published
   * report rondo writes into the request's thread. Read by the caller, because
   * it is a row in the conversation and this module reads none.
   */
  proposed: boolean,
): Governance {
  const answered = record.gateOutcome !== null;
  const atGate = record.status === "awaiting_human";
  const mayPropose =
    approval !== null && approval.payload.outward_acts.includes("open_pull_request");
  return {
    repository,
    askedAtMs,
    allowance: approval === null ? null : allowanceOf(approval),
    tries:
      approval === null
        ? null
        : { at: approval.spent.admissions, of: approval.payload.budgets.laps },
    chain: [
      { step: "answer", state: answered ? "done" : atGate ? "waiting" : "ahead" },
      { step: "proposal", state: proposed ? "done" : mayPropose ? "ahead" : "yours" },
      { step: "merge", state: "yours" },
    ],
  };
}
