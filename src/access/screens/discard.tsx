import type { WebPorts } from "../page/contract.js";
import {
  backHead,
  CARD,
  CARD_HEADING,
  DESPITE,
  note,
  PRIMARY,
  SECONDARY,
} from "../page/vocabulary.js";
import type { PageView } from "../page-logic/routes.js";
import { viewHref } from "../page-logic/routes.js";
import type { Chrome } from "../wording.js";

/**
 * The discard screen (rondo#676, D-0198): what will be lost, and the second
 * press. Reached from the publish screen's list of uncommitted changes; the
 * press lands back here with `done`, which says what happened only where the
 * workspace now reads clean.
 */
export async function discardView(
  ports: WebPorts,
  wording: Chrome,
  view: Extract<PageView, { kind: "discard" }>,
  token: string | null,
): Promise<unknown> {
  const publish = viewHref({ kind: "publish", iterationId: view.iterationId }, wording.lang);
  const framed = (body: unknown) => (
    <div id="discard" class="space-y-4">
      {backHead(wording, wording.discardHeading)}
      {body}
    </div>
  );
  const settled = (line: string) =>
    framed(
      <>
        <p id="discard-said" class="text-body leading-6">
          {line}
        </p>
        <a
          href={publish}
          class={`${PRIMARY} h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto`}
        >
          {wording.discardBackToPublish}
        </a>
      </>,
    );
  const found = await ports.store.read(view.iterationId);
  const port = ports.discard ?? null;
  const read = found.kind !== "read" || port === null ? null : await port.read(found.record);
  if (read === null || read.kind === "notOffered") {
    return settled(
      port === null && found.kind === "read"
        ? wording.discardNoApprover
        : wording.discardNotOffered,
    );
  }
  if (read.kind === "clean") {
    return settled(view.done ? wording.discardDone : wording.discardNothing);
  }
  const count = read.paths.length;
  return framed(
    <>
      <p class="text-body leading-6">{wording.discardLead}</p>
      <p class="text-meta leading-5 wrap-anywhere text-muted-foreground" lang="">
        {wording.publishWorkspace(read.workspace)}
      </p>
      <section id="discard-list" class={`${CARD} space-y-2`}>
        <h3 class={CARD_HEADING}>{wording.discardListHeading(count)}</h3>
        {read.elsewhere === null ? null : (
          <p class="text-body leading-5">{wording.publishUncommittedElsewhere(read.elsewhere)}</p>
        )}
        <ul class="space-y-1 font-mono text-id leading-5" lang="">
          {read.paths.map((path) => (
            <li class="wrap-anywhere">{path}</li>
          ))}
        </ul>
        <p class="text-meta leading-5 text-muted-foreground">{wording.discardKeeps}</p>
      </section>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        {token === null ? (
          note(wording.discardNoApprover)
        ) : (
          <form
            id="discard-form"
            method="post"
            action={`/discard?lang=${encodeURIComponent(wording.lang)}`}
          >
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="iteration" value={view.iterationId} />
            <input type="hidden" name="shown" value={read.shown} />
            <button
              type="submit"
              class={`${DESPITE} h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto`}
            >
              {wording.discardAction(count)}
            </button>
          </form>
        )}
        <a
          href={publish}
          class={`${SECONDARY} h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto`}
        >
          {wording.discardCancel}
        </a>
      </div>
    </>,
  );
}
