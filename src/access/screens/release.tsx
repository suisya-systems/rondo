import type { LedgerLine } from "../../store/sqlite.js";
import type { WebPorts } from "../page/contract.js";
import {
  backHead,
  CARD,
  CARD_HEADING,
  chevron,
  note,
  PRIMARY,
  publishedReport,
} from "../page/vocabulary.js";
import { endedHow, materialLanguage } from "../page-logic/laps.js";
import type { PageView } from "../page-logic/routes.js";
import { firstLine, requestWords, type Threads } from "../page-logic/threads.js";
import type { Chrome } from "../wording.js";

/**
 * The release screen (D-0073 rule 4.3, rondo#288): which work keeps the files,
 * what it was doing, why rondo has not released them, what releasing does, and
 * the press.
 *
 * **The work is named by what the person knows** (D-0076 rule 3.3): their
 * request's words and how each attempt ended, never a line or a lap id. The
 * form carries the claim and the laps it was drawn over, so the press refuses
 * a line that moved under the screen.
 */

export async function releaseView(
  ports: WebPorts,
  wording: Chrome,
  view: Extract<PageView, { kind: "release" }>,
  token: string | null,
  ledger: readonly LedgerLine[],
  threads: Threads,
  nowMs: number,
): Promise<unknown> {
  const framed = (body: unknown) => (
    <div id="release" class="space-y-4">
      {backHead(wording, wording.releaseHeading)}
      {body}
    </div>
  );
  const line = ledger.find((one) => one.lapIds.includes(view.iterationId));
  if (line === undefined || line.paths.length === 0 || line.claimId === null) {
    // Where a release press lands (the route redirects here), so it says so.
    return framed(
      note(line?.releasedBy === "person" ? wording.releasedByPerson : wording.releaseNothingHeld),
    );
  }
  if (line.inFlight) {
    return framed(note(wording.releaseStillOpen));
  }
  const records = (await Promise.all(line.lapIds.map((id) => ports.store.read(id)))).flatMap(
    (outcome) => (outcome.kind === "read" ? [outcome.record] : []),
  );
  const root = records[0];
  const tips = records.filter((record) => line.closedTips.includes(record.id));
  // **Named by the words the person wrote for it** (rondo#439), as the list
  // and the thread name it, in one line; the brief rondo composed from them is
  // folded under it, so the press is not below a page of rondo's own text.
  const named = root === undefined ? "" : firstLine(requestWords([...threads.byId.values()], root));
  return framed(
    <>
      <p class="text-body leading-6">{wording.releaseLead}</p>
      {/* What releasing does and the press first (rondo#439): they are what
          this screen is for (D-0082 rule 7), and the work is who it is for. */}
      <section id="release-effect" class={`${CARD} space-y-1`}>
        <h3 class={CARD_HEADING}>{wording.releaseEffectHeading}</h3>
        {wording.releaseEffect.map((said) => (
          <p class="text-body leading-5">{said}</p>
        ))}
      </section>
      {/* No approver, no press: the page says at the top why (`publishView`'s rule). */}
      {token === null ? null : (
        <form
          id="release-form"
          method="post"
          action={`/release?lang=${encodeURIComponent(wording.lang)}`}
          class="flex flex-col gap-2"
        >
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="iteration" value={view.iterationId} />
          <input type="hidden" name="claim" value={line.claimId} />
          <input type="hidden" name="laps" value={line.lapIds.join(" ")} />
          <button
            type="submit"
            data-row=""
            aria-describedby="release-plain"
            class={`${PRIMARY} h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto sm:self-start`}
          >
            {wording.releaseAction}
          </button>
          <span id="release-plain" class="note sr-only">
            {wording.releasePlain}
          </span>
        </form>
      )}
      <section id="release-work" class={`${CARD} space-y-2`}>
        <h3 class={CARD_HEADING}>{wording.releaseWorkHeading}</h3>
        {root === undefined ? null : (
          <p class="text-title leading-6 wrap-anywhere" lang="">
            {named}
          </p>
        )}
        {(tips.length === 0 ? records.slice(-1) : tips).map((record) => {
          const published = publishedReport(threads, record.id);
          return (
            <p class="text-body leading-5 text-muted-foreground">
              {endedHow(wording, record, nowMs)}
              {published === null || published.url === null ? null : (
                <>
                  {" "}
                  <a href={published.url} class="font-medium text-link hover:underline">
                    {wording.publishedPullRequest}
                  </a>
                </>
              )}
            </p>
          );
        })}
        {root === undefined ? null : (
          <details id="release-brief" class="group">
            <summary class="flex cursor-pointer list-none items-center gap-2 rounded-md py-1 text-meta leading-5 text-muted-foreground outline-none select-none hover:text-link focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              {chevron()}
              {wording.releaseBrief}
            </summary>
            <p
              class="mt-2 text-body leading-6 wrap-anywhere whitespace-pre-wrap"
              lang={materialLanguage(root)}
            >
              {root.request}
            </p>
          </details>
        )}
      </section>
      {/* What the line holds and why it is held, under the press (D-0106,
          rondo#408): what releasing does stays above it, since that is what
          the press needs (D-0082 rule 7). */}
      <section id="release-files" class={`${CARD} space-y-1`}>
        <h3 class={CARD_HEADING}>{wording.releaseHoldsHeading}</h3>
        <p class="font-mono text-meta leading-5 wrap-anywhere" lang="">
          {wording.holds(line.paths)}
        </p>
      </section>
      <section id="release-why" class={`${CARD} space-y-1`}>
        <h3 class={CARD_HEADING}>{wording.releaseWhyHeading}</h3>
        {wording.releaseWhy.map((said) => (
          <p class="text-body leading-5">{said}</p>
        ))}
      </section>
    </>,
  );
}
