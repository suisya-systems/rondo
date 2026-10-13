import { draftedStartReadiness } from "../drafted-start.js";
import type { DraftedPlanShown } from "../drafted-view.js";
import type { MintIterationId, WebPorts } from "../page/contract.js";
import { chevron, PRIMARY } from "../page/vocabulary.js";
import { type PageView, viewHref } from "../page-logic/routes.js";
import { firstLine, requestWords } from "../page-logic/threads.js";
import type { Chrome } from "../wording.js";

/**
 * Under an approved scope, one drafted plan's way to start, or why it cannot
 * yet (rondo#238 C2b): a button only where C2a's readiness says the start
 * would go through, and the reason everywhere else -- a refused scoped start
 * writes a stop into the thread, so a button that is sure to fail is not drawn.
 */
export async function planStart(
  ports: WebPorts,
  wording: Chrome,
  view: Extract<PageView, { kind: "scope" }>,
  decisionId: string,
  proposalId: string,
  plan: DraftedPlanShown,
  token: string | null,
  newIterationId: MintIterationId | null,
  nowMs: number,
): Promise<unknown> {
  const ready = await draftedStartReadiness(
    { store: ports.store, record: ports.record, policy: ports.policy, nowMs },
    view.messageId,
    decisionId,
    proposalId,
    plan.index,
  );
  // **A plan that waits redraws its own line until it stops waiting**
  // (rondo#674): the scope view holds still (`isLive`), so the start button
  // that room or files would allow never appeared until the person reloaded.
  // Only a waiting line asks again; the one that replaces it -- the start, or
  // the lap started -- carries no trigger, and the asking stops.
  const id = `plan-start-${String(plan.index)}`;
  const waits =
    ready.kind === "busy" ||
    ready.kind === "full" ||
    ready.kind === "held" ||
    ready.kind === "ordered";
  return (
    <div
      id={id}
      {...(waits
        ? {
            "hx-get": viewHref(view, wording.lang),
            "hx-trigger": `every ${String(PLAN_WAIT_SECONDS)}s`,
            "hx-select": `#${id}`,
            "hx-swap": "outerHTML",
          }
        : {})}
    >
      {
        await planStartFor(
          ports,
          wording,
          view,
          decisionId,
          proposalId,
          plan,
          token,
          newIterationId,
          ready,
        )
      }
    </div>
  );
}

/** How often a plan that waits for room or files asks whether it still does, in seconds. */
const PLAN_WAIT_SECONDS = 5;

/** {@link planStart}'s line for one readiness: the start, or why not yet. */
async function planStartFor(
  ports: WebPorts,
  wording: Chrome,
  view: Extract<PageView, { kind: "scope" }>,
  decisionId: string,
  proposalId: string,
  plan: DraftedPlanShown,
  token: string | null,
  newIterationId: MintIterationId | null,
  ready: Awaited<ReturnType<typeof draftedStartReadiness>>,
): Promise<unknown> {
  const line = (text: string) => (
    <p class="note rounded-md border border-border bg-muted/60 px-3 py-2 text-body leading-5">
      {text}
    </p>
  );
  const startForm = () =>
    token === null || newIterationId === null ? null : (
      <form
        method="post"
        action={`/start-plan?lang=${encodeURIComponent(wording.lang)}`}
        class="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end"
      >
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="request" value={view.messageId} />
        <input type="hidden" name="scope_decision" value={decisionId} />
        <input type="hidden" name="proposal" value={proposalId} />
        <input type="hidden" name="plan_index" value={String(plan.index)} />
        {/* Minted at render, as every start's is: rondo names the lap. */}
        <input type="hidden" name="iteration" value={newIterationId()} />
        <button
          type="submit"
          data-row=""
          title={wording.planStartPlain}
          data-busy={wording.startBusy}
          class={`${PRIMARY} h-9 w-full justify-center px-5 text-sm sm:w-auto`}
        >
          {wording.planStartAction}
        </button>
        <p
          data-busy-note=""
          hidden
          role="status"
          class="note text-meta leading-5 text-muted-foreground sm:basis-full sm:text-right"
        >
          {wording.startBusyNote}
        </p>
      </form>
    );
  switch (ready.kind) {
    case "ready":
      return startForm();
    case "held": {
      // **Who holds the files, by their request** (D-0076 rule 3.3), and **no
      // press**: the host's tick attempts it once every holder has finished,
      // which is where its landing is read (D-0073 rule 7, rondo#284). By the
      // words the person wrote for the holding request (rondo#439).
      const read = await ports.record.threadMessages();
      const messages = read.kind === "read" ? read.messages : [];
      const holders = await Promise.all(
        ready.holders.map(async ({ line }) => {
          const root = await ports.store.read(line.lineageId);
          return {
            line,
            request: root.kind === "read" ? requestWords(messages, root.record) : null,
          };
        }),
      );
      const finished = ready.holders.every(({ line }) => !line.inFlight);
      const paths = [...new Set(ready.holders.flatMap(({ paths }) => paths))];
      return (
        <div class="space-y-1.5">
          {line(finished ? wording.planHeldFinished(paths) : wording.planHeld(paths))}
          {holders.map(({ line: holder, request }) => (
            <p class="flex flex-wrap items-baseline gap-x-2 text-body leading-5">
              <span class="text-muted-foreground">{wording.planHeldBy}</span>
              <span class="min-w-0 truncate" lang="">
                {request === null ? "" : firstLine(request)}
              </span>
              {token === null || ports.releasable !== true ? null : (
                <a
                  href={viewHref({ kind: "release", iterationId: holder.lineageId }, wording.lang)}
                  class="text-link underline-offset-2 hover:underline"
                >
                  {holder.inFlight ? wording.holdsLink : wording.releaseLink}
                </a>
              )}
              {/* **Why so wide, where it said** (rondo#509): the words its
                  drafter gave for claiming a directory, kept on its claim. */}
              {holder.why === null || !holder.paths.some((path) => path.endsWith("/")) ? null : (
                <span class="basis-full text-meta leading-5 text-muted-foreground">
                  {wording.planHeldWhy(
                    holder.paths.filter((path) => path.endsWith("/")),
                    holder.why,
                  )}
                </span>
              )}
            </p>
          ))}
        </div>
      );
    }
    case "started":
      return (
        <p class="note flex flex-wrap items-center gap-x-2 text-body leading-5">
          <span>{wording.planStarted}</span>
          <a
            href={viewHref({ kind: "thread", messageId: view.messageId, to: null }, wording.lang)}
            class="text-link underline-offset-2 hover:underline"
          >
            {wording.planStartedLink}
          </a>
        </p>
      );
    // D-0098 rule 1: no press while `first` has not landed; it starts by itself.
    // The sentence is the thread's step for the part (rule 8.2).
    case "ordered":
      return line(
        ready.first?.state === "endedUnlanded"
          ? wording.partUnlanded(ready.after)
          : wording.partWaiting(ready.after, null, null),
      );
    case "busy":
      return line(wording.planBusy(ready.limit));
    case "full":
      return line(wording.planFull(ready.live, ready.limit));
    case "outside":
      return line(wording.planOutside(ready.test));
    case "undecidable":
    case "unrunnable":
      return (
        <div class="space-y-1">
          {line(ready.kind === "undecidable" ? wording.planUndecidable : wording.planUnrunnable)}
          <details class="group">
            <summary class="flex cursor-pointer list-none items-center gap-2 text-meta leading-5 text-muted-foreground select-none [&::-webkit-details-marker]:hidden">
              {chevron()}
              {wording.planUnrunnableWhy}
            </summary>
            <p class="mt-1 text-meta leading-5 wrap-anywhere text-muted-foreground" lang="en">
              {ready.reason}
            </p>
          </details>
        </div>
      );
  }
}
