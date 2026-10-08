/**
 * What a gate has shown before a press: the framing, material, readings and
 * revise box composed for the one row being answered ({@link shownBeforePress}),
 * and the budget and review-round closings that turn a revise into a raise
 * (rondo#341 moved it out of `src/access/web.tsx`).
 */
import { type AdvisorySnapshot, type Claim, propose } from "../../advisory/proposal.js";
import {
  type IterationRecord,
  isModelReadingDrafter,
  type LapReading,
  latestReading,
  type ScopePayload,
  type ScopeSpent,
} from "../../store/records.js";
import { gather } from "../advisory.js";
import { type GateAuto, gateAuto, repairOf } from "../gate-auto.js";
import { gateScope } from "../gate-host.js";
import {
  reviewPolicyOf,
  reviewRoundDecision,
  reviewRoundsAlong,
} from "../model-review/judgement.js";
import { workerRuns } from "../page-logic/laps.js";
import type { PullRequestLink } from "../page-logic/parts.js";
import { viewHref } from "../page-logic/routes.js";
import { type AnsweredQuestion, questionRevise } from "../question.js";
import { type ReviseBox, reviseBoxOf, reviseLabels } from "../revise-draft/judgement.js";
import { approvalTip, budgetRefusal, reviewScopeOf } from "../scope.js";
import type { Chrome } from "../wording.js";
import type { LapMaterialRead, WebPorts } from "./contract.js";
import { localTime, money, SECONDARY } from "./vocabulary.js";

/**
 * **The answer goes into the box, word for word** (D-0098 rule 4.5, D-0103
 * rule 4.6): once the person has carried a worker's question on, the revise
 * box opens holding the question and the answer as `questionRevise` quotes
 * them, ahead of anything the reading drafted.
 */
function withAnswer(box: ReviseBox, answered: AnsweredQuestion | null): ReviseBox {
  if (answered === null) {
    return box;
  }
  const quoted = questionRevise(answered);
  return {
    kind: "drafted",
    text: box.kind === "drafted" ? `${quoted}\n\n${box.text}` : quoted,
    answer: true,
  };
}

/** Read the revise box for one lap's readings (D-0077 rule 2.2's "drafted"). */
export async function reviseBox(
  ports: WebPorts,
  wording: Chrome,
  iterationId: string,
  readings: readonly LapReading[],
): Promise<ReviseBox> {
  const model = latestReading(readings, isModelReadingDrafter);
  const row = model === null ? null : await ports.record.reviseDraftFor(iterationId, model);
  return reviseBoxOf(readings, row, reviseLabels(wording));
}

/** Whether a row carries a question this page can put a button under. */
export function answerable(record: IterationRecord, token: string | null): token is string {
  return token !== null && record.status === "awaiting_human" && record.gateId !== null;
}

/** One iteration, explained the way `rondo explain` explains it. */

/** What a press on one row would be recorded as having shown, composed for that row. */
export interface Shown {
  readonly claims: readonly Claim[];
  readonly snapshot: AdvisorySnapshot;
  readonly material: LapMaterialRead | null;
  /** The row's readings, which the two reading cards are drawn from. */
  readonly readings: readonly LapReading[];
  /**
   * The approval a revise here spends: the approved tip of the chain that
   * starts at the one this lap was admitted under (D-0074 section 2), or null
   * when it was admitted under none (rondo#233 S4).
   *
   * **Read here so that the revise form can carry it and nobody types it.** A
   * lap with none gets no revise press: D-0070 counts the second lap against
   * the first's approval, and there is nothing here to count it against.
   */
  readonly scopeDecisionId: string | null;
  /** Its line has two approved tips, so no approval is spent (D-0074 rule 2.1). */
  readonly forked: boolean;
  /**
   * The budget that would refuse the revise's lap, computed before any press
   * with the verdict's own arithmetic (D-0074 rule 4.1), or null when none does.
   */
  readonly closedBy: BudgetClosed | null;
  /**
   * The review rounds, where they are what would refuse the revise's lap at
   * the readings test (D-0065 4.3), or null (rondo#547).
   */
  readonly roundsClosing: { readonly taken: number; readonly budget: number } | null;
  /** The budgets of the approval a revise spends, or null where none reads. */
  readonly budgets: ScopePayload["budgets"] | null;
  /** The revise box's content and what is said beside it (D-0077 section 4). */
  readonly revise: ReviseBox;
  /**
   * The question over this lap's line that still holds it, by its message id,
   * and whether the person answered it by stopping the line -- or null
   * (rondo#448). The scope's verdict refuses a revise while it stands
   * (`askStandsOver`, D-0072 rule 3), so the form says so before the press.
   */
  readonly questionOpen: { readonly id: string; readonly stopped: boolean } | null;
  /**
   * The worker's question this lap put, as the revise box says it (D-0098
   * rule 8.4, D-0103's gate point 2), or null where it put none.
   */
  readonly workerQuestion: WorkerQuestionBox | null;
  /**
   * The merged pull request of another part this lap's next attempt merges in
   * first (D-0098 rule 8.5, `takeInFrom`), or absent where none.
   */
  readonly takeIn?: PullRequestLink | null;
  /** Whether rondo would approve this gate automatically, and why not (D-0125). */
  readonly auto: GateAuto;
}

/** What the revise box says about a worker's question (D-0098 rule 8.4). */
interface WorkerQuestionBox {
  /** The person's `carry_on` answer, with the question, or null while it stands. */
  readonly answered: AnsweredQuestion | null;
  /** How long it has waited, already said, while it stands; null once answered. */
  readonly waitedSaid: string | null;
  /** Which part the lap is, from 1, where the request runs as several lines. */
  readonly part: number | null;
  /** The parts that wait for this one to be merged, from 1. */
  readonly releases: readonly number[];
}

/**
 * The way to raise a budget that closes the change path, in place of a press
 * it would refuse (D-0074 rule 4.1): the revise form's, and the conflict-fix
 * card's (rondo#417, D-0105), since both start one more attempt.
 */
export function raiseBlock(
  wording: Chrome,
  closed: BudgetClosed,
  requestMessageId: string,
  scopeDecisionId: string,
  iterationId: string,
) {
  const { budgets, spent } = closed;
  const why =
    closed.test === "laps"
      ? wording.raiseWhyLaps(budgets.laps)
      : closed.test === "cost"
        ? wording.raiseWhyCost(
            money(spent.readCostUsd + spent.unreadLaps * budgets.cost_reserve_usd),
            money(budgets.cost_reserve_usd),
            money(budgets.cost_usd),
          )
        : wording.raiseWhyExpiry(localTime(budgets.expires_at_ms).replace("T", " "));
  return (
    <div id="raise" class="space-y-2">
      <p class="note text-meta leading-5 text-muted-foreground">{wording.raiseNeeded(why)}</p>
      <a
        href={viewHref(
          {
            kind: "scope",
            messageId: requestMessageId,
            rounds: null,
            decisionId: null,
            plan: null,
            raise: { decisionId: scopeDecisionId, iterationId },
          },
          wording.lang,
        )}
        class={`${SECONDARY} h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto`}
      >
        {wording.raiseLink}
      </a>
    </div>
  );
}

/** Which budget closes the change path, and the numbers the sentence says it with. */
interface BudgetClosed {
  readonly test: string;
  readonly budgets: ScopePayload["budgets"];
  readonly spent: ScopeSpent;
}

/** Whether one approval's budgets would refuse one more attempt now, and which. */
export async function budgetClosing(
  ports: WebPorts,
  scopeDecisionId: string,
  nowMs: number,
): Promise<BudgetClosed | null> {
  const decided = await ports.record.readScopeDecision(scopeDecisionId);
  if (decided.kind !== "read") {
    return null;
  }
  const stored = await ports.record.readScope(decided.decision.scopeId);
  if (stored.kind !== "read") {
    return null;
  }
  const budgets = stored.scope.payload.budgets;
  const spent = await ports.record.scopeSpent(scopeDecisionId);
  const refused = budgetRefusal(budgets, spent, nowMs);
  return refused === null ? null : { test: refused.test, budgets, spent };
}

/**
 * Whether the review rounds would refuse one more lap of this line, with the
 * readings test's own arithmetic (D-0065 4.3): the decision stops at the
 * approved budget and would not stop with one round more. A reading that is
 * unavailable or ungraded stops whatever the budget, so it is not this.
 */
export async function roundsClosing(
  ports: WebPorts,
  scopeDecisionId: string,
  iterationId: string,
  readings: readonly LapReading[],
): Promise<Pick<Shown, "roundsClosing" | "budgets">> {
  const none = { roundsClosing: null, budgets: null };
  const decided = await ports.record.readScopeDecision(scopeDecisionId);
  if (decided.kind !== "read") {
    return none;
  }
  const stored = await ports.record.readScope(decided.decision.scopeId);
  if (stored.kind !== "read") {
    return none;
  }
  const budgets = stored.scope.payload.budgets;
  const latest = latestReading(readings, isModelReadingDrafter);
  const lineage = await ports.record.lineageOf(iterationId);
  if (latest === null || lineage === null) {
    return { roundsClosing: null, budgets };
  }
  const links = [];
  for (const id of lineage) {
    links.push({ readings: id === iterationId ? readings : await ports.store.readingsFor(id) });
  }
  const taken = reviewRoundsAlong(links);
  const policy = reviewPolicyOf(reviewScopeOf(stored.scope.payload));
  const stops = (roundBudget: number): boolean =>
    reviewRoundDecision({ latest, roundsTaken: taken, policy: { ...policy, roundBudget } }).kind ===
    "stop";
  return {
    roundsClosing:
      stops(policy.roundBudget) && !stops(taken + 1) ? { taken, budget: policy.roundBudget } : null,
    budgets,
  };
}

/**
 * What a press would be recorded as having shown, for the rows that carry a
 * button (D-0042 rules 1 and 4).
 *
 * **The ledger row a press writes is `explainIteration`'s whole proposal**, and
 * it is counted as presented. So the whole of it has to be on the page beside
 * the button, or rondo would be recording a framing the operator was never
 * shown -- the one thing the fold must not cost. The three questions above are
 * a summary and this is not: it is every claim under its own basis, the same
 * bytes the press stores, drawn where the press is.
 *
 * **It is composed for one row, and only on the view that is about that row.**
 * The summary links here rather than carrying this: the material shells out to
 * `git` in the caller and the framing reads the row's readings, so a page that
 * redraws every five seconds must do neither for a row nobody is answering --
 * and a summary carrying two dozen claims per waiting row is the screen
 * rondo#145 is about. A row that has left its gate since the link was drawn
 * composes nothing here and so draws no button, which is the same refusal
 * `rondo answer` makes.
 */
export async function shownBeforePress(
  ports: WebPorts,
  wording: Chrome,
  waiting: readonly IterationRecord[],
  token: string | null,
  /**
   * The lap the centre face is about to draw an answering box for, where the
   * selected request has one at its gate (D-0083 rules 3 and 9).
   *
   * **The gate's material is composed for one row and only where it is being
   * answered.** That was `view.kind === "answer"` while the gate was a screen
   * of its own; since the box lives in the thread, it is *the request the
   * centre is showing*. The cost is the same -- one row's readings, its
   * material and its approval tip -- and the reason is unchanged: a page that
   * redraws every five seconds must not shell out to `git` for a row nobody
   * is answering.
   */
  answeringLapId: string | null = null,
  /** The question over a lap's line that waits on the person, or null ({@link Shown.questionOpen}). */
  questionOver: (record: IterationRecord) => Promise<Shown["questionOpen"]> = async () => null,
  /** The worker's question this lap put, or null ({@link Shown.workerQuestion}). */
  workerQuestionOf: (record: IterationRecord) => WorkerQuestionBox | null = () => null,
): Promise<ReadonlyMap<string, Shown>> {
  const shown = new Map<string, Shown>();
  const wanted = answeringLapId;
  if (wanted === null) {
    return shown;
  }
  for (const record of waiting) {
    if (record.id !== wanted || !answerable(record, token)) {
      continue;
    }
    const readings = await ports.store.readingsFor(record.id);
    const snapshot = gather(record, readings);
    // The set this request resolved to and not the host's (D-0056 rule 12):
    // the fence block's standing sentences are inside these lines.
    const material = ports.material === null ? null : await ports.material(wording, record);
    const tip = await approvalTip(ports.record, record.id);
    const questionOpen = await questionOver(record);
    const workerQuestion = workerQuestionOf(record);
    shown.set(record.id, {
      claims: propose(snapshot).payload.claims,
      snapshot,
      material,
      readings,
      scopeDecisionId: tip.kind === "tip" ? tip.scopeDecisionId : null,
      forked: tip.kind === "forked",
      closedBy:
        tip.kind === "tip" ? await budgetClosing(ports, tip.scopeDecisionId, ports.now()) : null,
      ...(tip.kind === "tip"
        ? await roundsClosing(ports, tip.scopeDecisionId, record.id, readings)
        : { roundsClosing: null, budgets: null }),
      revise: withAnswer(
        await reviseBox(ports, wording, record.id, readings),
        workerQuestion?.answered ?? null,
      ),
      questionOpen,
      workerQuestion,
      auto: gateAuto({
        readings,
        runs: workerRuns(record.lapCommands),
        repair: repairOf(record),
        // A lap that put a worker's question is never rondo's to approve (D-0142).
        questionOpen: questionOpen !== null || workerQuestion !== null,
        closing: (await ports.store.closingLapOf(record.id)) !== null,
        scope: tip.kind === "tip" ? await gateScope(ports.record, tip.scopeDecisionId) : null,
        nowMs: ports.now(),
      }),
    });
  }
  return shown;
}
