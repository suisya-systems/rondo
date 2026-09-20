import type { LedgerLine } from "../../store/sqlite.js";
import type { WebPorts } from "../page/contract.js";
import {
  backHead,
  CARD,
  CARD_HEADING,
  note,
  PRIMARY,
  publishedReport,
} from "../page/vocabulary.js";
import { endedHow, materialLanguage } from "../page-logic/laps.js";
import type { PageView } from "../page-logic/routes.js";
import type { Threads } from "../page-logic/threads.js";
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
  return framed(
    <>
      <p class="text-[13px] leading-6">{wording.releaseLead}</p>
      <section id="release-work" class={`${CARD} space-y-2`}>
        <h3 class={CARD_HEADING}>{wording.releaseWorkHeading}</h3>
        {root === undefined ? null : (
          <p
            class="text-[13.5px] leading-6 wrap-anywhere whitespace-pre-wrap"
            lang={materialLanguage(root)}
          >
            {root.request}
          </p>
        )}
        {(tips.length === 0 ? records.slice(-1) : tips).map((record) => {
          const published = publishedReport(threads, record.id);
          return (
            <p class="text-[13px] leading-5 text-muted-foreground">
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
      </section>
      <section id="release-files" class={`${CARD} space-y-1`}>
        <h3 class={CARD_HEADING}>{wording.releaseHoldsHeading}</h3>
        <p class="font-mono text-[12.5px] leading-5 wrap-anywhere" lang="">
          {wording.holds(line.paths)}
        </p>
      </section>
      <section id="release-why" class={`${CARD} space-y-1`}>
        <h3 class={CARD_HEADING}>{wording.releaseWhyHeading}</h3>
        {wording.releaseWhy.map((said) => (
          <p class="text-[13px] leading-5">{said}</p>
        ))}
      </section>
      <section id="release-effect" class={`${CARD} space-y-1`}>
        <h3 class={CARD_HEADING}>{wording.releaseEffectHeading}</h3>
        {wording.releaseEffect.map((said) => (
          <p class="text-[13px] leading-5">{said}</p>
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
    </>,
  );
}
