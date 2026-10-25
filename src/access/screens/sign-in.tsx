import { SIGN_IN_ROUTE } from "../github-sign-in-route.js";
import type { WebPorts } from "../page/contract.js";
import { backHead, CARD, chevron, note, PRIMARY } from "../page/vocabulary.js";
import { viewHref } from "../page-logic/routes.js";
import type { Chrome } from "../wording.js";

/** How often a waiting sign-in asks again whether GitHub has answered. */
const SIGN_IN_WAIT_SECONDS = 3;

/**
 * The sign-in screen (rondo#676): where this computer's `gh` stands with
 * GitHub, and the one press that signs it in. **While it waits it redraws
 * itself** (rondo#674's way): the code stays on screen until GitHub answers,
 * then the sentence that says so replaces it and the asking stops.
 */
export function signInView(ports: WebPorts, wording: Chrome, token: string | null): unknown {
  const port = ports.signIn ?? null;
  const state = port === null ? { kind: "none" as const } : port.now();
  // Where `gh` is missing and rondo can fetch it, the one press does both (D-0204).
  const fetches = state.kind === "installable" || state.kind === "installFailed";
  const press =
    port === null || token === null ? null : (
      <form method="post" action={`${SIGN_IN_ROUTE}?lang=${encodeURIComponent(wording.lang)}`}>
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          data-row=""
          class={`${PRIMARY} h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto`}
        >
          {fetches ? wording.signInInstallAction : wording.signInAction}
        </button>
      </form>
    );
  const body =
    state.kind === "waiting" ? (
      <section class={`${CARD} space-y-3`}>
        <p class="text-body leading-6">{wording.signInWaiting}</p>
        <p class="font-mono text-title font-semibold tracking-widest" lang="">
          {state.code}
        </p>
        <p>
          <a
            href={state.url}
            target="_blank"
            rel="noreferrer"
            class="text-link underline-offset-2 hover:underline"
          >
            {state.url}
          </a>
        </p>
        <p class="text-meta leading-5 text-muted-foreground">{wording.signInWaitingNote}</p>
      </section>
    ) : // The press stays after a sign-in (Codex round 1): one GitHub later
    // revoked is signed in again without a restart.
    state.kind === "signedIn" ? (
      <>
        {note(wording.signInDone)}
        {press}
      </>
    ) : state.kind === "noGh" ? (
      // Nothing rondo can fetch here, so no press: it would only say this again.
      note(wording.signInNoGh)
    ) : state.kind === "installable" ? (
      <>
        {note(wording.signInInstallable)}
        {press}
      </>
    ) : state.kind === "failed" || state.kind === "installFailed" ? (
      <>
        {note(state.kind === "failed" ? wording.signInFailed : wording.signInInstallFailed)}
        <details class="group text-meta text-muted-foreground">
          <summary class="flex cursor-pointer list-none items-center gap-2 select-none [&::-webkit-details-marker]:hidden">
            {chevron()}
            {wording.forMaintainer}
          </summary>
          <p class="mt-1 wrap-anywhere whitespace-pre-wrap" lang="en">
            {state.reason}
          </p>
        </details>
        {press}
      </>
    ) : (
      <>
        {note(wording.signInNone)}
        {press}
      </>
    );
  return (
    <div id="sign-in" class="space-y-4">
      {backHead(wording, wording.signInAction)}
      <div
        id="sign-in-state"
        class="space-y-3"
        {...(state.kind === "waiting"
          ? {
              "hx-get": viewHref({ kind: "signIn" }, wording.lang),
              "hx-trigger": `every ${String(SIGN_IN_WAIT_SECONDS)}s`,
              "hx-select": "#sign-in-state",
              "hx-swap": "outerHTML",
            }
          : {})}
      >
        {body}
      </div>
    </div>
  );
}
