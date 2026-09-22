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
 * **All six of rule 6's items, and the right face carries the same in full.**
 * Repository, when it was asked, spent / approved, which try of how many, how
 * many things rondo decided without asking, and what remains as the chain.
 * The fifth was the one this module could not read while the only reader was
 * `attentionBreakdown`, which answers over a time interval and not over a
 * request; `withheldFor` is that reader, so the count is a fact about this
 * request rather than a figure borrowed from a window.
 *
 * **What the right face adds to the line is not a second set of facts.** Rule
 * 6 puts the same things in full on the right: the allowance with what is
 * left, the tries, **where a lap may touch**, the steps to the end, and the
 * withholdings named with the rule behind each. {@link Governance} therefore
 * carries the whole of it and the line draws the part that fits on a line.
 */
import type { IterationRecord, ScopePayload, ScopeSpent } from "../../store/records.js";
import { type IterationStatus, SCOPE_OUTWARD_ACTS } from "../../store/records.js";
import type { Allowance } from "./week.js";

/** One try's cost, as the right face lists it. */
export interface TryCost {
  readonly costUsd: number | null;
  readonly running: boolean;
}

/**
 * The statuses whose cost is still to come: a lap's cost is read when `lap
 * perform` returns, so a lap past it -- at a gate, stalled, withdrawing -- with
 * no cost has none coming, and is not *in progress* however open it is.
 */
const COST_TO_COME: readonly IterationStatus[] = [
  "planned",
  "classified",
  "admitting",
  "admitted",
  "performing",
];

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
   * What has been spent, what is held, and what was approved, in dollars -- or
   * null where no approval can be read, which is the one state that hides all.
   */
  readonly allowance: Allowance | null;
  /**
   * **What each try of the request cost, oldest first** (rondo#378): the
   * detail under the request's total. A cost of null is not read yet --
   * `running` says whether that is because the try is still going.
   */
  readonly byTry: readonly TryCost[];
  /** Which try of how many the approval allows, or null with no approval to read it from. */
  readonly tries: { readonly at: number; readonly of: number } | null;
  /** What remains, as rule 6's chain. */
  readonly chain: readonly ChainLink[];
  /**
   * **Where a lap may touch** (rule 6): the repositories and workspace roots
   * the approval names, and the outward acts it permits.
   *
   * Null together with {@link allowance} and {@link tries}: all three are the
   * approval's, and a request admitted under none has no agreed reach to draw.
   * An empty `acts` is not the same as no approval -- it is an approval that
   * permits rondo nothing outward, which is a thing to say.
   */
  readonly touches: {
    readonly places: readonly { readonly repository: string; readonly root: string }[];
    readonly acts: readonly string[];
  } | null;
  /**
   * **What rondo decided without asking, about this request** (rule 6's fifth
   * item): how many, and the rule behind each, heaviest first.
   *
   * Zero is drawn, and it is not the claim the old line refused to make. That
   * refusal was about a count nothing could narrow to a request; this one is
   * read from the withheld rows tied to this request, so zero says *no
   * withholding about this request was recorded* -- which is what D-0032
   * rule 10's table is for.
   */
  readonly decided: {
    readonly count: number;
    readonly byRule: readonly { readonly ruleName: string; readonly count: number }[];
  };
}

/**
 * What one approval has spent, what it holds, and what it allows, as the
 * figures rule 6 never separates.
 *
 * **Spent and held are two figures, and the store's check adds them**
 * (rondo#378). The store measures a budget against what was read plus the
 * reserve every lap whose cost is not read yet still holds (`D-0046`, `D-0066`
 * rule 3.4.2), and that sum stays the check. But a reserve is a guess made
 * before the lap ran: drawn as *spent*, it read as a fact -- in lap 11, $0.79
 * spent plus $2.50 held for the running try was drawn as $3.29 spent, and the
 * owner remembered "about three dollars" for a request that cost $1.65 -- and
 * then changed under them. So the page says what was spent and, beside it,
 * what is held.
 *
 * It is here rather than inside {@link governanceOf} because the right face
 * sums the same figures over a week (`page-logic/week.ts`), and two places
 * computing a spend differently would be two answers to what has been spent.
 */
export function allowanceOf(approval: {
  readonly payload: ScopePayload;
  readonly spent: ScopeSpent;
}): Allowance {
  return {
    spentUsd: approval.spent.readCostUsd,
    heldUsd: approval.spent.unreadLaps * approval.payload.budgets.cost_reserve_usd,
    heldTries: approval.spent.unreadLaps,
    heldInProgress: false,
    approvedUsd: approval.payload.budgets.cost_usd,
  };
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
 * - *merge* is always `yours` here. `merge_default_branch` is not a member of
 *   {@link SCOPE_OUTWARD_ACTS} and the writer refuses it by name, so no scope
 *   can put rondo on this step. Drawing it as *ahead* would suggest rondo were
 *   going to do it. The page marks it `done` once the thread says it was
 *   merged (rondo#413), which is a row this module does not read.
 */
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
  /**
   * The withholdings recorded about this request, by rule -- the store's own
   * `withheldFor`, read by the caller because this module reads no rows.
   */
  withheld: readonly { readonly ruleName: string; readonly count: number }[],
  /**
   * Every lap of the request, oldest first, so each try's cost can be listed
   * and the request's total read across all of them (rondo#378).
   */
  laps: readonly Pick<IterationRecord, "status" | "lapCostUsd">[] = [record],
): Governance {
  const answered = record.gateOutcome !== null;
  const atGate = record.status === "awaiting_human";
  const mayPropose =
    approval !== null && approval.payload.outward_acts.includes("open_pull_request");
  const byTry = laps.map((lap) => ({
    costUsd: lap.lapCostUsd,
    running: lap.lapCostUsd === null && COST_TO_COME.includes(lap.status),
  }));
  return {
    repository,
    askedAtMs,
    allowance: approval === null ? null : heldFor(allowanceOf(approval), byTry),
    byTry,
    tries:
      approval === null
        ? null
        : { at: approval.spent.admissions, of: approval.payload.budgets.laps },
    chain: [
      { step: "answer", state: answered ? "done" : atGate ? "waiting" : "ahead" },
      { step: "proposal", state: proposed ? "done" : mayPropose ? "ahead" : "yours" },
      { step: "merge", state: "yours" },
    ],
    touches:
      approval === null
        ? null
        : {
            places: approval.payload.workspaces.map((place) => ({
              repository: place.repository,
              root: place.workspace_root,
            })),
            acts: [...approval.payload.outward_acts],
          },
    decided: {
      count: withheld.reduce((sum, rule) => sum + rule.count, 0),
      // Heaviest first, and by name where two weigh the same, so the order is
      // the reader's and not the query's.
      byRule: [...withheld].toSorted(
        (left, right) => right.count - left.count || left.ruleName.localeCompare(right.ruleName),
      ),
    },
  };
}

/**
 * Whether what is held is held for tries still going -- said *for the try in
 * progress* -- or for some whose cost was never read, which a person cannot
 * wait out. Only where every unread lap under the approval is a running try of
 * this request is the first true; an approval spanning other requests, or a
 * try that ended unread, gets the plainer sentence, which is true of both.
 */
function heldFor(allowance: Allowance, byTry: readonly TryCost[]): Allowance {
  const running = byTry.filter((one) => one.running).length;
  return { ...allowance, heldInProgress: running > 0 && running === allowance.heldTries };
}
