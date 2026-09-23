import { planField } from "../../store/records.js";
import type { WebPorts } from "../page/contract.js";
import { backHead, CARD, CARD_HEADING, note, PRIMARY } from "../page/vocabulary.js";
import { mergeBlock, resultOf } from "../page-logic/result.js";
import type { PageView } from "../page-logic/routes.js";
import type { Threads } from "../page-logic/threads.js";
import type { Chrome } from "../wording.js";

/**
 * The merge's confirm screen (rondo#437 item 6, D-0112 rule 7): the thread's
 * *merge* leads here, and the press that merges is on this screen.
 *
 * **What happens, then the press**, as publish has it: a merge is the one act
 * on the page nobody can take back from it, and it was one press with nothing
 * between the thread and the act. The screen says where it goes, which commit,
 * that the checks are green on that commit, and that the page cannot undo it.
 *
 * **The commit drawn is the commit pressed.** The form carries it as `head`,
 * and the merge port reads the pull request again and refuses when its head is
 * not that commit (`mergeRefusedMoved`), so a screen left open while the pull
 * request moved merges nothing. The rest of the test is the same
 * {@link mergeBlock} the press asks again over fresh rows.
 */
export async function mergeView(
  ports: WebPorts,
  wording: Chrome,
  view: Extract<PageView, { kind: "merge" }>,
  token: string | null,
  threads: Threads,
): Promise<unknown> {
  const framed = (body: unknown) => (
    <div id="merge" class="space-y-4">
      {backHead(wording, wording.mergeConfirmHeading)}
      {body}
    </div>
  );
  const found = await ports.store.read(view.iterationId);
  if (found.kind !== "read" || ports.mergeable !== true) {
    return framed(note(wording.mergeConfirmNotNow));
  }
  const record = found.record;
  const request = record.requestMessageId;
  const result = resultOf(threads.byId, record.id);
  const holding = (await ports.store.laneLedger()).some(
    (line) => line.releasedBy === null && line.lapIds.includes(record.id),
  );
  const asksWaiting = [...threads.waiting].some((id) => threads.rootOf(id) === request);
  if (result === null || mergeBlock(result, asksWaiting, holding) !== null) {
    return framed(note(wording.mergeConfirmNotNow));
  }
  const head = result.checksCommit ?? "";
  const pullBase = planField(record, "pull_request_base_branch");
  const base = pullBase === "" ? planField(record, "base_branch") : pullBase;
  // A head the lap did not push (rondo#412, D-0102): merging it takes those in.
  const carried =
    result.moved !== null && result.moved.to === head
      ? result.moved.commits.length + result.moved.more
      : null;
  return framed(
    <>
      <section id="merge-target" class={`${CARD} space-y-1`}>
        <h3 class={CARD_HEADING}>{wording.publishTargetHeading}</h3>
        <p class="text-body leading-5">
          {wording.mergeConfirmInto(wording.pullRequest(result.number), base)}
        </p>
        <p class="text-body leading-5">{wording.mergeConfirmCommit(head.slice(0, 7))}</p>
        {carried === null ? null : (
          <p class="text-body leading-5">{wording.nextStepMergeMoved(carried)}</p>
        )}
        <p class="text-body leading-5 font-medium">{wording.mergeConfirmNoUndo}</p>
      </section>
      {token === null ? null : (
        <form
          id={`merge-${record.id}`}
          method="post"
          action={`/merge?lang=${encodeURIComponent(wording.lang)}`}
          class="flex flex-col gap-2"
        >
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="iteration" value={record.id} />
          <input type="hidden" name="request" value={request} />
          <input type="hidden" name="head" value={head} />
          <button
            type="submit"
            data-busy={wording.mergeBusy}
            class={`${PRIMARY} h-10 justify-center self-start px-6 text-sm`}
          >
            {carried === null ? wording.mergeAction : wording.mergeMovedAction}
          </button>
          <p
            data-busy-note=""
            hidden
            role="status"
            class="note text-meta leading-5 text-muted-foreground"
          >
            {wording.mergeBusyNote}
          </p>
        </form>
      )}
    </>,
  );
}
