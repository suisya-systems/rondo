/**
 * The thread's acts block: where a request can be taken next -- its scope,
 * its publish and its merge -- drawn at the top of the thread (rondo#341
 * moved it out of `src/access/web.tsx`).
 */
import { approvedForPublication, isTerminal } from "../../store/records.js";
import { scopedAuthority } from "../merge.js";
import type { LapUnderRequest } from "../page-logic/laps.js";
import { draftingOver, scopeStanding } from "../page-logic/model.js";
import {
  askHoldsMerge,
  asksOverLine,
  conflictFixBlock,
  mergeBlock,
  resultOf,
} from "../page-logic/result.js";
import { viewHref } from "../page-logic/routes.js";
import { resultLap } from "../page-logic/thread-events.js";
import { type Threads, waitingAsk } from "../page-logic/threads.js";
import { approvalTip } from "../scope.js";
import { heldByLine, waitHolders } from "../screens/scope.js";
import type { Chrome } from "../wording.js";
import type { MintIterationId, WebPorts } from "./contract.js";
import { budgetClosing, raiseBlock } from "./gate-shown.js";
import { draftedNothing } from "./thread-stops.js";
import { PRIMARY, publishedReport, SECONDARY } from "./vocabulary.js";

/**
 * **Where this request can be taken next** (D-0083 rule 6's chain, as
 * addresses): setting its scope, and publishing a lap that is ready.
 *
 * **They are in the thread because the rows that carried them are gone.** The
 * old page drew each on a lap's row; a row is now the person's own words and
 * one sentence of state, with nothing to press (rule 5). The screens they lead
 * to are unchanged, and so are the conditions each is drawn under -- the scope
 * entrance needs a write port, and the publish entrance the same three things
 * the publish screen needs before it draws a button at all.
 */
export async function threadActs(
  wording: Chrome,
  ports: WebPorts,
  token: string | null,
  requestMessageId: string,
  /** Oldest first, so the index is the try (`lapEvents`'s `tryAt`). */
  laps: readonly LapUnderRequest[],
  threads: Threads,
  /** Whether rondo still owes this request a draft ({@link draftsOwedNow}). */
  owes: (requestMessageId: string) => boolean,
  newIterationId: MintIterationId | null = null,
) {
  // **Where the work would run, before a scope is drafted** (rondo#383,
  // D-0090 rule 1): a request naming a repository rondo does not work in is
  // not drafted, and its next step is adding that repository. Said on a page
  // that cannot write too, since the drafter is held either way; only the
  // button needs a writer. A reckoning that will not read says nothing rather
  // than taking the thread down.
  const where =
    ports.repositoryFor === undefined
      ? null
      : await ports.repositoryFor(requestMessageId).catch(() => null);
  const unheld = where?.work.kind === "unheld" ? where.work : null;
  const unheldCard = (work: { readonly repo: string; readonly named: string }) => (
    <section class="next-step mb-4 rounded-lg border border-wait bg-wait-wash px-4 py-3">
      <h2 class="text-meta leading-5 font-semibold text-wait-ink">{wording.nextStepHeading}</h2>
      <p class="mt-1 text-body leading-6">{wording.nextStepAddRepository(work.named, work.repo)}</p>
      {token === null || ports.addable !== true ? null : (
        <form method="post" action={`/add-repository?lang=${encodeURIComponent(wording.lang)}`}>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="request" value={requestMessageId} />
          <input type="hidden" name="repository" value={work.repo} />
          <button
            type="submit"
            id={`add-repository-${requestMessageId}`}
            class={`${PRIMARY} mt-3 h-10 justify-center px-6 text-sm`}
          >
            {wording.addRepositoryAction}
          </button>
        </form>
      )}
    </section>
  );
  if (token === null) {
    return unheld === null ? null : { next: unheldCard(unheld), acts: <span /> };
  }
  // **Every lap that could still be published, and not the first of them**
  // (Codex): `approvedForPublication` reads a closed row with an approved
  // outcome and says nothing about whether it has been published, so one
  // entrance would go on naming a lap already published while the laps beside
  // it had none. What says it was published is the report rondo wrote into
  // this request's thread.
  const publishable =
    ports.publishing === null
      ? []
      : laps.filter(
          (lap) =>
            approvedForPublication(lap.record) && publishedReport(threads, lap.record.id) === null,
        );
  // **Which of these is the person's next step** (rondo#375, D-0082 rule 1:
  // weight follows who is blocked). On lap 11 the only way forward was the
  // quietest thing on the screen and read as *nothing is happening*: nobody
  // but the person can set a scope or open the pull request. Never while
  // something else in the thread waits on them -- a question, or a gate, whose
  // own box is then what they answer.
  const gated = laps.some((lap) => lap.question === "waiting");
  const waitedOn =
    [...threads.waiting].some((id) => threads.rootOf(id) === requestMessageId) || gated;
  // The question waiting for an answer, which withholds the scope; the band
  // points to it only where no gate is waiting, a gate being answered in its
  // own box (Codex).
  const asked = waitingAsk(threads, requestMessageId);
  // The newest try that can be published, and only that one: two next steps
  // read as a choice with no answer.
  const nextPublish = waitedOn ? null : (publishable.at(-1) ?? null);
  // **The merge, where the strip's lap can be merged now** (rondo#380,
  // `D-0091` rule 1): published, rondo's own latest reading green on the head,
  // nothing in the thread waiting on the person, and its line still holding.
  // The press asks the same `mergeBlock` again over fresh rows.
  const resultRecord = resultLap(laps.map((lap) => lap.record));
  const result = resultRecord === null ? null : resultOf(threads.byId, resultRecord.id);
  const resultLine =
    resultRecord === null
      ? undefined
      : (await ports.store.laneLedger()).find(
          (line) => line.releasedBy === null && line.lapIds.includes(resultRecord.id),
        );
  const nextMerge =
    ports.mergeable !== true || nextPublish !== null || resultRecord === null || result === null
      ? null
      : mergeBlock(
            result,
            // Only the questions and the gates that hold this line (rondo#539,
            // rondo#551), as the press asks (`mergeHold`).
            laps.some(
              (lap) =>
                lap.question === "waiting" &&
                (resultLine?.lapIds ?? [resultRecord.id]).includes(lap.record.id),
            ) || askHoldsMerge(threads, requestMessageId, resultLine?.lapIds ?? [resultRecord.id]),
            resultLine !== undefined,
          ) === null
        ? {
            record: resultRecord,
            // **A head the lap did not push** (rondo#412, `D-0102`): the card
            // says what merging it takes in, which the strip lists above.
            carried:
              result.moved !== null && result.moved.to === result.checksCommit
                ? result.moved.commits.length + result.moved.more
                : null,
          }
        : null;
  // **The conflict fix, where the strip's pull request conflicts** (rondo#417,
  // D-0105): offered on the one test the press asks again, under the approval
  // the lap ran under, and never beside a budget that would refuse it -- the
  // way to raise that budget is drawn in its place (D-0074 rule 4.1).
  // Every lap of the result lap's line, as the ledger holds it and the press
  // reads it (`laneLine`), so a question about a sibling attempt withholds the
  // card here as it refuses the press there (Codex).
  const lineOfResult = async (id: string): Promise<readonly string[]> =>
    (await ports.store.laneLedger()).find((line) => line.lapIds.includes(id))?.lapIds ?? [id];
  const fixLine = resultRecord === null ? [] : await lineOfResult(resultRecord.id);
  const onFixLine = laps.filter((lap) => fixLine.includes(lap.record.id));
  const fixBlock =
    ports.fixesConflicts !== true || newIterationId === null || resultRecord === null
      ? "off"
      : conflictFixBlock(result, {
          // A gate or a question of this line (D-0105 rule 3.1 as D-0138 rule 2
          // narrows it): another part of the request, at its own gate, is
          // answered there and does not decide this one's fix.
          asksWaiting:
            onFixLine.some((lap) => lap.record.status === "awaiting_human") ||
            onFixLine.some((lap) => lap.question === "waiting") ||
            asksOverLine(threads, requestMessageId, fixLine),
          holding: (await ports.store.laneLedger()).some(
            (line) => line.releasedBy === null && line.lapIds.includes(resultRecord.id),
          ),
          succeeded: laps.some((lap) => lap.record.supersedesIterationId === resultRecord.id),
        });
  const fixTip =
    fixBlock !== null || resultRecord === null
      ? null
      : await approvalTip(ports.record, resultRecord.id);
  const nextFix =
    fixTip?.kind !== "tip" || resultRecord === null || result === null || newIterationId === null
      ? null
      : {
          record: resultRecord,
          scopeDecisionId: fixTip.scopeDecisionId,
          closed: await budgetClosing(ports, fixTip.scopeDecisionId, ports.now()),
          pullRequest: wording.pullRequest(result.number),
          // The base is brought in for a conflict only; a red check's repair
          // takes nothing in (rondo#551), so its card names the checks.
          base: result.conflictsWith ?? "",
          red: result.checks.kind === "red" ? result.checks : null,
          successor: newIterationId(),
        };
  const standing =
    waitedOn || laps.length > 0 || unheld !== null
      ? null
      : await scopeStanding(ports, requestMessageId);
  const drafting = standing !== null && draftingOver(standing, owes(requestMessageId));
  // **A start that other work's files hold is waiting** (rondo#284, D-0158):
  // the host's tick starts it by itself, so the step is not the person's.
  // Under the approval in force only: a wait kept under one since replaced
  // will not start, and must not hide the new approval's start (Codex).
  const heldStart =
    standing?.kind === "decided" || standing?.kind === "own"
      ? (await ports.store.heldStarts()).find(
          (held) =>
            held.requestMessageId === requestMessageId &&
            held.scopeDecisionId === standing.scopeDecisionId,
        )
      : undefined;
  const waitsHeld = heldStart !== undefined;
  // Named, as the scope screen names them, with a finished one's release (rondo#553).
  const waitHolding = heldStart === undefined ? [] : await waitHolders(ports, heldStart.repository);
  const scopeHref = (decisionId: string | null) =>
    viewHref(
      { kind: "scope", messageId: requestMessageId, rounds: null, decisionId, plan: null },
      wording.lang,
    );
  const tryName = (lap: LapUnderRequest) =>
    // Which try, where there is more than one to tell apart: three buttons
    // reading *publish* are three a person cannot choose between (D-0076 rule
    // 3.3, as the event lines do it).
    laps.length > 1
      ? wording.evOfTry(laps.indexOf(lap) + 1, wording.publishAction)
      : wording.publishAction;
  /*
   * **The next step, once, at the top of the thread** (rondo#375, the owner's
   * review: *"is making it black enough to stand out?"*). A filled button at
   * the foot of a long thread was below the fold when the thread opened, the
   * same size as everything around it, and a second copy of the same link sat
   * in a message above it. So it is drawn once, above the messages, under a
   * heading that says it is the person's turn and one line that says what is
   * waiting and what pressing does -- in the amber that is spent only on *a
   * person must act* (D-0082 rule 2), because here that is exactly the fact.
   * Not on the right face: that face holds no press (D-0083 rule 5) and drops
   * below the thread at 1280.
   */
  // `data-can-act`: a card that appears, or says something else, on a redraw is
  // washed (rondo#494 item 1) -- the scope card arriving once rondo's draft
  // lands is exactly that change (rondo#495 item 4).
  const card = (id: string, href: string, said: string, label: string) => (
    <section
      class="next-step mb-4 rounded-lg border border-wait bg-wait-wash px-4 py-3"
      data-can-act="next"
    >
      <h2 class="text-meta leading-5 font-semibold text-wait-ink">{wording.nextStepHeading}</h2>
      <p class="mt-1 text-body leading-6">{said}</p>
      <a
        id={id}
        href={href}
        data-open=""
        class={`${PRIMARY} mt-3 h-10 justify-center px-6 text-sm`}
      >
        {label}
      </a>
    </section>
  );
  // The way to the merge (D-0091 rule 1, rondo#437 item 6): a link to the
  // screen that says what merging does and holds the press, as publish's is
  // (D-0112 rule 7). The merge could not be taken back and was one press.
  const mergeCard = (lap: {
    readonly record: { readonly id: string };
    readonly carried: number | null;
  }) =>
    card(
      `merge-${lap.record.id}`,
      viewHref({ kind: "merge", iterationId: lap.record.id }, wording.lang),
      lap.carried === null ? wording.nextStepMerge : wording.nextStepMergeMoved(lap.carried),
      lap.carried === null ? wording.mergeAction : wording.mergeMovedAction,
    );
  // **A lap below a published one updates that pull request** (rondo#417,
  // D-0105): its publish pushes onto it and opens none, so the step says which.
  // Walked up its own line, as `pullRequestUpdated` walks it, never across lines.
  const byLap = new Map(laps.map((lap) => [lap.record.id, lap.record]));
  let above = nextPublish?.record.supersedesIterationId ?? null;
  while (above !== null && publishedReport(threads, above) === null) {
    above = byLap.get(above)?.supersedesIterationId ?? null;
  }
  const openedResult = above === null ? null : resultOf(threads.byId, above);
  const updating = openedResult === null ? null : wording.pullRequest(openedResult.number);
  // Whether its scope has rondo merge it on green (D-0187): the card says so
  // rather than *nothing is merged* over a scope that merges.
  const publishMerges =
    nextPublish !== null &&
    (await scopedAuthority(ports, nextPublish.record.id, ["merge_default_branch"]).catch(
      () => null,
    )) !== null;
  // The conflict fix (rondo#417, D-0105): a press, since the attempt it starts
  // is counted against the approval and nothing is between it and the act.
  // A red check's repair (rondo#551) is the same press, in its own words.
  const fixCard = (fix: NonNullable<typeof nextFix>) => (
    <section class="next-step mb-4 rounded-lg border border-wait bg-wait-wash px-4 py-3">
      <h2 class="text-meta leading-5 font-semibold text-wait-ink">{wording.nextStepHeading}</h2>
      <p class="mt-1 text-body leading-6">
        {fix.red === null
          ? wording.nextStepConflictFix(fix.pullRequest, fix.base)
          : wording.nextStepChecksFix(fix.pullRequest, wording.checksDetail(fix.red))}
      </p>
      {fix.closed !== null ? (
        <div class="mt-3">
          {raiseBlock(wording, fix.closed, requestMessageId, fix.scopeDecisionId, fix.record.id)}
        </div>
      ) : (
        <form
          id={`fix-conflict-${fix.record.id}`}
          method="post"
          action={`/fix-conflict?lang=${encodeURIComponent(wording.lang)}`}
          class="mt-3 flex flex-col gap-2"
        >
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="iteration" value={fix.record.id} />
          <input type="hidden" name="request" value={requestMessageId} />
          <input type="hidden" name="scope_decision" value={fix.scopeDecisionId} />
          <input type="hidden" name="successor" value={fix.successor} />
          <input type="hidden" name="cause" value={fix.red === null ? "conflict" : "red"} />
          <button
            type="submit"
            data-busy={fix.red === null ? wording.conflictFixBusy : wording.checksFixBusy}
            class={`${PRIMARY} h-10 justify-center self-start px-6 text-sm`}
          >
            {fix.red === null ? wording.conflictFixAction : wording.checksFixAction}
          </button>
          <p
            data-busy-note=""
            hidden
            role="status"
            class="note text-meta leading-5 text-muted-foreground"
          >
            {wording.lapBusyNote}
          </p>
        </form>
      )}
    </section>
  );
  // **rondo's turn while its draft is still to come** (rondo#495): a scope
  // pressed now is one decided without rondo's plan, so nothing is offered, and
  // nothing here is amber -- the neutral family is rondo working (D-0082 rule 3).
  const draftingCard = (
    <section class="next-step mb-4 rounded-lg border border-run/35 bg-run-wash px-4 py-3">
      <h2 class="text-meta leading-5 font-semibold text-run-ink">{wording.nextStepRondoHeading}</h2>
      <p class="mt-1 text-body leading-6">{wording.nextStepDrafting}</p>
    </section>
  );
  // The same neutral card for a start rondo keeps waiting (rondo#284).
  const waitsCard = (
    <section class="next-step mb-4 rounded-lg border border-run/35 bg-run-wash px-4 py-3">
      <h2 class="text-meta leading-5 font-semibold text-run-ink">{wording.nextStepRondoHeading}</h2>
      <p class="mt-1 text-body leading-6">{wording.startWaitsHeld}</p>
      {waitHolding.map((holder) => heldByLine(wording, holder, ports.releasable === true))}
    </section>
  );
  const next =
    unheld !== null
      ? unheldCard(unheld)
      : nextFix !== null
        ? fixCard(nextFix)
        : nextMerge !== null
          ? mergeCard(nextMerge)
          : nextPublish !== null
            ? card(
                `publish-${nextPublish.record.id}`,
                viewHref({ kind: "publish", iterationId: nextPublish.record.id }, wording.lang),
                updating === null
                  ? wording.nextStepPublish(publishMerges)
                  : wording.nextStepPublishUpdate(updating, publishMerges),
                updating === null ? tryName(nextPublish) : wording.publishUpdateAction(updating),
              )
            : asked !== null && !gated
              ? // **A question waiting in the thread is the next step** (rondo#431):
                // on lap 13 the band sent the person to a scope while the
                // drafter's question stood, and the start then failed on it.
                card(
                  `answer-${requestMessageId}`,
                  viewHref(
                    { kind: "thread", messageId: requestMessageId, to: asked },
                    wording.lang,
                  ),
                  wording.nextStepAnswer,
                  wording.answerAskAction,
                )
              : standing === null
                ? null
                : drafting
                  ? draftingCard
                  : waitsHeld
                    ? waitsCard
                    : standing.kind === "decided" || standing.kind === "own"
                      ? card(
                          `scope-${requestMessageId}`,
                          // A drafted approval's screen is reached without its decision,
                          // which is how that screen also offers a newer draft beside it
                          // (Codex); the person's own approval is named, since that
                          // screen finds only rondo's drafts by itself.
                          scopeHref(standing.kind === "own" ? standing.scopeDecisionId : null),
                          wording.nextStepStart,
                          wording.nextStepStartAction,
                        )
                      : card(
                          `scope-${requestMessageId}`,
                          scopeHref(null),
                          standing.kind === "drafted"
                            ? wording.nextStepDrafted
                            : draftedNothing(threads, requestMessageId)
                              ? wording.nextStepNoDraft
                              : wording.nextStepScope,
                          wording.scopeAction,
                        );
  const others = publishable.filter((lap) => lap !== nextPublish);
  // **The request's work is still under way** (rondo#437): a lap running or at
  // its gate, or any approved try whose pull request is not yet merged
  // or closed. Another scope is no step of the person's then, so the outlined
  // way to one is not drawn; it comes back once the work has ended.
  const underWay = laps.some((lap) => {
    if (!isTerminal(lap.record.status)) {
      return true;
    }
    // A try a later one supersedes (a conflict fix, a redo) is carried by it:
    // the pull request's end is reported on the later try only.
    if (
      !approvedForPublication(lap.record) ||
      laps.some((later) => later.record.supersedesIterationId === lap.record.id)
    ) {
      return false;
    }
    const ended = resultOf(threads.byId, lap.record.id);
    return ended?.merged == null && ended?.closedAtMs == null;
  });
  // A repository added from the page whose build rondo could not tell: said
  // where the work is, since it bounds what the worker can check (D-0090).
  const unbuilt = where?.work.kind === "held" ? where.unbuilt : [];
  // Nothing to say and nowhere to go: no row at all, not an empty one that
  // leaves a gap at the top of the thread (D-0106).
  const empty =
    unbuilt.length === 0 &&
    others.length === 0 &&
    (standing !== null || unheld !== null || asked !== null || underWay);
  return {
    next,
    // The right face's first step, off the same reading as the card (rondo#495
    // item 3): null where the request has work, a question or no scope to set.
    scopeStep:
      standing === null
        ? null
        : drafting
          ? ("waiting" as const)
          : standing.kind === "decided" || standing.kind === "own"
            ? ("done" as const)
            : ("yours" as const),
    fixOffered: nextFix !== null && nextFix.closed === null,
    // Withheld by a question of this line the person owes (rondo#500): the
    // band says so rather than leaving only "resolve it by hand".
    fixWaits: fixBlock === "asked",
    acts: empty ? null : (
      <p class="thread-acts">
        {unbuilt.map((repo) => (
          <span class="block text-meta leading-5 text-muted-foreground">
            {wording.repositoryUnbuilt(repo)}
          </span>
        ))}
        {/* Outlined: another scope for a request that already has work is a
            way to another screen, and drawn filled it outweighed the box a
            person is actually being waited on by. */}
        {standing !== null || unheld !== null || asked !== null || underWay ? null : (
          <a
            id={`scope-${requestMessageId}`}
            href={scopeHref(null)}
            data-open=""
            class={`${SECONDARY} h-7 px-3 text-meta`}
          >
            {wording.scopeAction}
          </a>
        )}
        {others.map((lap) => (
          <a
            id={`publish-${lap.record.id}`}
            href={viewHref({ kind: "publish", iterationId: lap.record.id }, wording.lang)}
            data-open=""
            class={`${SECONDARY} h-7 px-3 text-meta`}
          >
            {tryName(lap)}
          </a>
        ))}
      </p>
    ),
  };
}
