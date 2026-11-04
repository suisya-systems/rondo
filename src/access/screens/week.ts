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
  /**
   * **The requests whose work has been taken somewhere**: every lap under them
   * has ended, and one of them either closed or was settled by a person. A
   * budget cannot be holding such a request up -- there is nothing left of it
   * to stop, and the stop the person already answered is this week's history
   * rather than this week's obstacle.
   *
   * **A request whose every lap ended `failed` is not one of them.** That is
   * exactly the state a budget stop leaves behind: the lap is terminal, nothing
   * replaced it, and raising the budget is what starts the next one. Reading
   * *finished* off "every lap is terminal" alone would have withheld the
   * reading in the one case `D-0207` rule 1 names first.
   */
  const settled = new Set(
    [...allLapsByRequest.entries()]
      .filter(
        ([, laps]) =>
          laps.every((lap) => isTerminal(lap.record.status)) &&
          laps.some((lap) => lap.record.status === "closed" || lap.record.status === "abandoned"),
      )
      .map(([requestMessageId]) => requestMessageId),
  );
  /*
   * **Why the week's budget is on this face, or that it is not** (`D-0207`
   * rule 1). One fact makes it worth drawing as *holding work up*: a budget
   * that stopped a lap and is still standing in the way of the request it
   * stopped. Beside it is a scope waiting for the person, which is where a
   * budget is set or raised. With neither, the figures are withheld and nothing
   * stands in their place (rule 4).
   *
   * **Every path to "holding work up" goes through the same three tests**, and
   * that is this entry's own rule rather than a tidying: a budget is drawn only
   * where it is in the way of work and the person has a move to make.
   *
   * 1. *The budget actually stopped something* ({@link budgetStopped}): a lap
   *    its own spend cap stopped (`D-0121`), or one that ended on the budget's
   *    refusal to send it. An approval with no room left under laps still
   *    running is **not** one of these -- what has exhausted it is the reserve
   *    held for work that is going fine, and a person asked to raise a budget
   *    there would be answering a question nobody has been asked.
   * 2. *Nothing is running under that request now*, so the stop is where the
   *    work stands rather than something a later lap carried on from.
   * 3. *The request has not been taken in or ended* ({@link settled}). A cap
   *    that stopped a lap stays written on its row for ever, so a request
   *    raised after it and since finished would otherwise keep this face
   *    drawing the week's money for the rest of the window.
   */
  const workingNow = new Set(running.map((record) => record.requestMessageId));
  const bearing = budgetBearing({
    holdingUp: touched.some(
      (lap) =>
        budgetStopped(lap.record) &&
        !workingNow.has(lap.record.requestMessageId) &&
        !settled.has(lap.record.requestMessageId),
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
