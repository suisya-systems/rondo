/**
 * The right face with nothing waiting (D-0083 rule 4, and gate point 7's last
 * slice): the last seven days, and each running request with its allowance and
 * the five steps to its end -- its reads and its drawing, as one view's own
 * (rondo#341).
 *
 * **Only where it is drawn.** These are reads nothing else on the page needs
 * -- a window of changes, the attention rows' own count, and one approval per
 * lap that moved this week -- so a thread view pays for none of them: the page
 * calls this only where the centre is empty.
 *
 * **No figure here is stored** (`D-0032` rule 3): the week is counted from
 * rows that already exist each time it is drawn.
 *
 * **The money is read whatever the bearing says, and drawn only where it
 * bears** (`D-0207` rule 1). The approvals are already being walked to answer
 * *is a budget holding anything up*, so reading the pair costs nothing more; it
 * is the drawing that is narrowed, and the face is handed a null budget in the
 * ordinary case rather than figures it would have to decide about itself.
 */
import {
  type IterationRecord,
  isQuestion,
  isTerminal,
  reachedBudgetCap,
} from "../../store/records.js";
import { ago } from "../inbox.js";
import type { WebPorts } from "../page/contract.js";
import { EmptySide, type SideWork } from "../page/empty-side.js";
import { allowanceOf } from "../page-logic/governance.js";
import { approvalOf, type PageModel } from "../page-logic/model.js";
import { viewHref } from "../page-logic/routes.js";
import { firstLine } from "../page-logic/threads.js";
import { scopeAwaits } from "../page-logic/waits.js";
import {
  type Allowance,
  budgetBearing,
  finishedAt,
  stepsOf,
  WEEK_MS,
  weekFigures,
} from "../page-logic/week.js";
import type { Chrome } from "../wording.js";

/**
 * **Whether the budget stopped this lap**, which is the one fact `D-0207`
 * rule 1 draws the week's money as *holding work up* for.
 *
 * Two spellings of one event, because a budget stops a lap at two moments:
 * mid-turn, when it spends the room its scope left it (`D-0121`, the row's own
 * cost against its own cap), and at the start, when the `cost` scope test
 * refuses to send it at all (`failureKind: "budget"`, `D-0121` rule 5). Both
 * leave a person the same next move, which is a larger budget.
 *
 * **An approval with no room left is not here**, and that is the point: the
 * room an approval has left is a sum over laps that may all be running
 * perfectly well, and the reserve those laps hold is a guess made before they
 * ran (`page-logic/governance.ts`'s {@link allowanceOf}). A reading drawn off
 * that sum told a person their work was stopped while it was in fact going
 * fine, and asked them to raise a budget nothing had refused.
 */
function budgetStopped(record: IterationRecord): boolean {
  return (
    reachedBudgetCap(record.lapCostUsd, record.lapBudgetCapUsd) ||
    (record.status === "failed" && record.failureKind === "budget")
  );
}

/** Whether a lap's work was taken in or dropped, which are the two ends a person gives it. */
function takenSomewhere(record: IterationRecord): boolean {
  return record.status === "closed" || record.status === "abandoned";
}

/**
 * **Whether this stop is still the one in the way**, asked of the stop and not
 * of its request.
 *
 * A request is not one thing that is either finished or not: it is a chain of
 * laps, and a stop sits at one point in that chain. Reading *finished* over the
 * whole chain -- every lap terminal, and one of them closed or settled by a
 * person -- let a closing from earlier in the chain answer a stop that happened
 * after it, so a request whose first lap was taken in and whose follow-up work
 * then ran out of budget drew nothing at all. The budget was holding work up
 * and the face said so for no request.
 *
 * So each stop is asked about on its own, and three things answer it:
 *
 * 1. *The lap is still going.* A lap whose cost has reached its cap but which
 *    has not stopped on it yet is work in progress, not a stop: nothing is
 *    waiting for the person, and `running` is where the page says so.
 * 2. *This lap's own work was taken in or dropped.* A cap stays written on a
 *    row for ever, so the lap a person approved at its gate having spent all
 *    of its budget is history rather than an obstacle.
 * 3. *Something later answered it* -- a lap of the same request still going,
 *    which is the stop carried on from, or one taken somewhere no earlier than
 *    this stop, which is the work having gone where it was meant to go. An
 *    ending **before** the stop answers nothing, which is the whole of the
 *    distinction this function exists for.
 */
function stopStillStanding(
  stopped: IterationRecord,
  laps: readonly IterationRecord[],
  runningNow: ReadonlySet<string>,
): boolean {
  if (runningNow.has(stopped.id) || takenSomewhere(stopped)) {
    return false;
  }
  return !laps.some(
    (other) =>
      other.id !== stopped.id &&
      (!isTerminal(other.status) ||
        (takenSomewhere(other) && other.updatedAtMs >= stopped.updatedAtMs)),
  );
}

/** The week's face, read and composed. */
export async function weekSide(
  ports: WebPorts,
  wording: Chrome,
  { nowMs, threads, running, waits, allLapsByRequest, placeOf }: PageModel,
) {
  const weekFromMs = nowMs - WEEK_MS;
  /*
   * **The person's own answers, from the two tables that hold them**: an
   * answer to a proposal (`human_decision`) and an approval of a scope
   * (`scope_decision`), which are different acts and never the same press --
   * plus the answers written into a thread, which this render already holds.
   */
  const weekChanges = await ports.record.changedSince(weekFromMs);
  const weekAttention = await ports.record.attentionBreakdown({
    fromMs: weekFromMs,
    toMs: nowMs,
  });
  /*
   * **The week's money is the approvals in force, and a raise starts at zero**
   * (D-0074 rule 2 and section 3.2). Budgets are per approved row, so the pair
   * is read off the tip of each chain -- one entry per approval and not per
   * lap, because a retried request spends the one approval it was admitted
   * under. What a predecessor spent before a raise stays written under the
   * predecessor and is the scope screen's to show (section 4.2); adding it in
   * here would make a raise read as a total across the chain, which is the
   * misreading rule 2 exists to prevent.
   */
  const weekApprovals = new Map<string, Allowance>();
  const touched = [...allLapsByRequest.values()]
    .flat()
    .filter((lap) => Math.max(lap.record.createdAtMs, lap.record.updatedAtMs) >= weekFromMs);
  for (const approval of await Promise.all(touched.map((lap) => approvalOf(ports, lap.record)))) {
    if (approval !== null) {
      weekApprovals.set(approval.decisionId, allowanceOf(approval));
    }
  }
  /*
   * **Why the week's budget is on this face, or that it is not** (`D-0207`
   * rule 1). One fact makes it worth drawing as *holding work up*: a budget
   * that stopped a lap, and that stop still standing where the work stopped.
   * Beside it is a scope waiting for the person, which is where a budget is set
   * or raised. With neither, the figures are withheld and nothing stands in
   * their place (rule 4).
   *
   * **Every path to "holding work up" goes through the same two tests**, and
   * that is this entry's own rule rather than a tidying: a budget is drawn only
   * where it is in the way of work and the person has a move to make.
   *
   * 1. *The budget actually stopped something* ({@link budgetStopped}): a lap
   *    its own spend cap stopped (`D-0121`), or one that ended on the budget's
   *    refusal to send it. An approval with no room left under laps still
   *    running is **not** one of these -- what has exhausted it is the reserve
   *    held for work that is going fine, and a person asked to raise a budget
   *    there would be answering a question nobody has been asked.
   * 2. *Nothing has answered that stop* ({@link stopStillStanding}): the lap is
   *    not still going, its own work was not taken in or dropped, and no lap of
   *    the same request carried on from it or ended where it was meant to. The
   *    question is asked of the stop, so a closing that happened before it
   *    cannot answer it.
   */
  const workingNow = new Set(running.map((record) => record.id));
  const lapsOf = (requestMessageId: string): readonly IterationRecord[] =>
    (allLapsByRequest.get(requestMessageId) ?? []).map((lap) => lap.record);
  const bearing = budgetBearing({
    holdingUp: touched.some(
      (lap) =>
        budgetStopped(lap.record) &&
        stopStillStanding(lap.record, lapsOf(lap.record.requestMessageId), workingNow),
    ),
    yours: scopeAwaits(waits),
  });
  const sideRunning: SideWork[] = await Promise.all(
    // Newest first, which is the order every other list on this page is in.
    running
      .toSorted((left, right) => right.createdAtMs - left.createdAtMs)
      .map(async (record): Promise<SideWork> => {
        const approval = await approvalOf(ports, record);
        return {
          messageId: record.requestMessageId,
          // The person's own words, as the list names a row (rule 2). The
          // lap's own `request` stands in only where the message it was
          // started from has gone.
          title: firstLine(threads.byId.get(record.requestMessageId)?.body ?? record.request),
          repository: placeOf(record),
          goingSaid: wording.age(ago(record.createdAtMs, nowMs)),
          allowance: approval === null ? null : allowanceOf(approval),
          tries:
            approval === null
              ? null
              : { at: approval.spent.admissions, of: approval.payload.budgets.laps },
          steps: stepsOf(record, await ports.store.readingsFor(record.id)),
        };
      }),
  );
  return {
    react: EmptySide({
      wording,
      figures: weekFigures(
        {
          // A question to rondo asks for no work, so it is not a request asked (D-0189).
          askedAtMs: threads.messages
            .filter((message) => message.inReplyTo === null && !isQuestion(message))
            .map((message) => message.atMs),
          /*
           * **A request and not a lap, and only one that has stopped**
           * (`page-logic/week.ts`): the laps are grouped by their request,
           * and a request with anything still running under it has not
           * finished however many of its laps have closed.
           */
          finishedAtMs: finishedAt(
            [...allLapsByRequest.values()].map((laps) =>
              laps.map((lap) => ({
                status: lap.record.status,
                updatedAtMs: lap.record.updatedAtMs,
              })),
            ),
            (status) => isTerminal(status as IterationRecord["status"]),
          ),
          answeredAtMs: [
            ...weekChanges
              .filter(
                (change) => change.kind === "human_decision" || change.kind === "scope_decision",
              )
              .map((change) => change.atMs),
            ...threads.messages
              .filter(
                (message) =>
                  message.authorKind === "operator" && message.answerOutcome !== undefined,
              )
              .map((message) => message.atMs),
          ],
          decidedWithoutAsking: weekAttention
            .filter((count) => count.disposition === "withheld")
            .reduce((sum, count) => sum + count.count, 0),
          allowances: [...weekApprovals.values()],
          bearing,
        },
        nowMs,
      ),
      running: sideRunning,
      hrefOf: (messageId) => viewHref({ kind: "thread", messageId, to: null }, wording.lang),
    }),
  };
}
