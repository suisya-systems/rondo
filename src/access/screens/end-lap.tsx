import type { WebPorts } from "../page/contract.js";
import { backHead, CARD, CARD_HEADING, chevron, note, PRIMARY } from "../page/vocabulary.js";
import { endableRow, MAX_END_REASON_CHARS } from "../page-logic/end-lap.js";
import { materialLanguage } from "../page-logic/laps.js";
import type { PageView } from "../page-logic/routes.js";
import { firstLine, requestWords, type Threads } from "../page-logic/threads.js";
import type { Chrome } from "../wording.js";

/**
 * The end screen (rondo#655): which work, why only a person can end it, what
 * ending does, and the press with the person's reason. Modelled on the release
 * screen: the work is named by the person's own words, never an id, and the
 * form carries only the lap, so the press checks again whether it may end it.
 *
 * It reads the row without decoding it, since a row that will not decode is one
 * of the three this screen is for.
 */
export async function endLapView(
  ports: WebPorts,
  wording: Chrome,
  view: Extract<PageView, { kind: "end" }>,
  token: string | null,
  threads: Threads,
): Promise<unknown> {
  const framed = (body: unknown) => (
    <div id="end" class="space-y-4">
      {backHead(wording, wording.endHeading)}
      {body}
    </div>
  );
  const row = await endableRow(ports.store, view.iterationId, new Set(threads.byId.keys()));
  if (row === null) {
    return framed(note(wording.endNothingToEnd));
  }
  const record = row.kind === "read" ? row.record : null;
  // The host asks in the thread only where it knows the request (end-lap-host.ts).
  const asksInThread = row.kind === "read" || row.requestMessageId !== null;
  const request =
    record === null
      ? row.kind === "unreadable" && row.requestMessageId !== null
        ? threads.byId.get(row.requestMessageId)?.body
        : undefined
      : requestWords([...threads.byId.values()], record);
  return framed(
    <>
      <p class="text-title leading-6 wrap-anywhere" lang={request === undefined ? undefined : ""}>
        {request === undefined ? wording.endUnnamed : firstLine(request)}
      </p>
      <p class="text-body leading-6">
        {record === null
          ? wording.endLeadUnreadable
          : record.status === "stalled"
            ? wording.endLeadStalled
            : wording.endLeadStarting}
      </p>
      <section id="end-effect" class={`${CARD} space-y-1`}>
        <h3 class={CARD_HEADING}>{wording.endEffectHeading}</h3>
        {(asksInThread
          ? wording.endEffect
          : [...wording.endEffect.slice(0, 2), wording.endEffectUnnamed]
        ).map((said) => (
          <p class="text-body leading-5">{said}</p>
        ))}
      </section>
      {/* No approver, no press: the screen says why in its place. */}
      {token === null ? (
        note(wording.endNoApprover)
      ) : (
        <form
          id="end-form"
          method="post"
          action={`/end-lap?lang=${encodeURIComponent(wording.lang)}`}
          class="flex flex-col gap-2"
        >
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="iteration" value={view.iterationId} />
          <label for="end-reason" class="text-meta leading-5 text-muted-foreground">
            {wording.endReasonLabel}
          </label>
          <textarea
            id="end-reason"
            name="reason"
            required
            rows={3}
            maxlength={MAX_END_REASON_CHARS}
            aria-describedby="end-hint"
            class="w-full rounded-md border border-border bg-background px-3 py-2 text-body leading-6"
          />
          <p id="end-hint" class="text-meta leading-5 text-muted-foreground">
            {wording.endReasonHint}
          </p>
          <button
            type="submit"
            aria-describedby="end-plain"
            class={`${PRIMARY} h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto sm:self-start`}
          >
            {wording.endAction}
          </button>
          <span id="end-plain" class="note sr-only">
            {wording.endPlain}
          </span>
        </form>
      )}
      {record === null ? null : (
        <details id="end-brief" class="group">
          <summary class="flex cursor-pointer list-none items-center gap-2 rounded-md py-1 text-meta leading-5 text-muted-foreground outline-none select-none hover:text-link focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            {chevron()}
            {wording.endBrief}
          </summary>
          <p
            class="mt-2 text-body leading-6 wrap-anywhere whitespace-pre-wrap"
            lang={materialLanguage(record)}
          >
            {record.request}
          </p>
        </details>
      )}
    </>,
  );
}
