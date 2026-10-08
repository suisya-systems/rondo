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
 */
import { type IterationRecord, isTerminal } from "../../store/records.js";
import { ago } from "../inbox.js";
import type { WebPorts } from "../page/contract.js";
import { EmptySide, type SideWork } from "../page/empty-side.js";
import { allowanceOf } from "../page-logic/governance.js";
import { approvalOf, type PageModel } from "../page-logic/model.js";
import { viewHref } from "../page-logic/routes.js";
import { firstLine } from "../page-logic/threads.js";
import { type Allowance, finishedAt, stepsOf, WEEK_MS, weekFigures } from "../page-logic/week.js";
import type { Chrome } from "../wording.js";

/** The week's face, read and composed. */
export async function weekSide(
  ports: WebPorts,
  wording: Chrome,
  { nowMs, threads, running, allLapsByRequest, placeOf }: PageModel,
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
          askedAtMs: threads.messages
            .filter((message) => message.inReplyTo === null)
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
        },
        nowMs,
      ),
      running: sideRunning,
      hrefOf: (messageId) => viewHref({ kind: "thread", messageId, to: null }, wording.lang),
    }),
  };
}
