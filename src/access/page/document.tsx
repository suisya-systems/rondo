/**
 * The document every view is drawn in (rondo#341): the head, the header, the
 * `#ledger` the redraw swaps and the foot's account of itself.
 *
 * `operatorPage` (`src/access/web.tsx`) drew this at the end of one function
 * that also read and derived every view; it is moved here unchanged, and the
 * faces arrive as markup a view has already composed (`facesMarkup`), so what
 * this draws is true of the whole page and of no one view.
 */
import { raw } from "hono/html";
import type { PageModel } from "../page-logic/model.js";
import type { PageView } from "../page-logic/routes.js";
import { viewHref } from "../page-logic/routes.js";
import { firstLine, type Threads } from "../page-logic/threads.js";
import type { Wait } from "../page-logic/waits.js";
import { type Chrome, SHIPPED_SETS } from "../wording.js";
import type { HeldReads } from "./held.js";
import { READ_IN_FORM } from "./held.js";
import { PILL, TONE } from "./vocabulary.js";

/** How often a live view redraws itself, in seconds: the `<noscript>` refresh and htmx's `every 5s`. */
const REFRESH_SECONDS = 5;

/** The tab's icon: the plain mark, or the mark with the amber badge while anything waits (rondo#414). */
const tabIcon = (waitingCount: number): string =>
  waitingCount === 0 ? "/icon.svg" : "/icon-wait.svg";

/** A key as the keyboard shows it. */
export function kbd(key: string) {
  return (
    <kbd class="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-card px-1 font-mono text-xs text-muted-foreground shadow-[inset_0_-1px_0_var(--color-border)]">
      {key}
    </kbd>
  );
}

/** What the document says of the page around the faces a view composed. */
export interface PageDocument {
  readonly wording: Chrome;
  readonly view: PageView;
  readonly actorId: string | null;
  readonly token: string | null;
  readonly threads: Threads;
  readonly threadRead: PageModel["threadRead"];
  readonly reads: HeldReads | null;
  readonly waits: readonly Wait[];
  readonly waitingCount: number;
  /** A view a person writes in (#220 S1). */
  readonly onThreads: boolean;
  readonly forms: boolean;
  /** Whether the view keeps itself current (`isLive`). */
  readonly keepsCurrent: boolean;
  /** Whether a person may be writing on this view (#220 S1). */
  readonly writingHere: boolean;
  /** The three faces, as `facesMarkup` composed them. */
  readonly faces: string;
}

/** The whole document, as the one string the server sends. */
export async function pageDocument({
  wording,
  view,
  actorId,
  token,
  threads,
  threadRead,
  reads,
  waits,
  waitingCount,
  onThreads,
  forms,
  keepsCurrent,
  writingHere,
  faces,
}: PageDocument): Promise<string> {
  const here = viewHref(view, wording.lang);
  // **The keys that do something on this view**, for the hints and the `?`
  // sheet alike; the summary has nowhere to go back to.
  const keys: readonly (readonly [string, string])[] = [
    ["j k", wording.keyMove],
    ["↵", wording.keyOpen],
    ...(view.kind === "summary"
      ? []
      : ([
          ["esc", wording.keyBack],
          ...(onThreads && forms ? ([["r", wording.keyWrite]] as const) : []),
        ] as const)),
  ];
  const page = (
    // **The document declares the language rondo actually wrote it in, and
    // never the one that was asked for** (D-0055 rule 7). `wording.lang` is the
    // tag of the set that was selected, so a well-formed tag this tree ships no
    // set for renders an English page that says `en` -- which is what the
    // document *is*. rondo does not declare an intention as a fact.
    <html lang={wording.lang}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {
          // **What keeps a live view current, in both modes** (D-0054 rules 1
          // and 7, D-0059 R2). With scripting off, the meta refresh inside
          // `<noscript>` throws the document away every five seconds, which is
          // still better than a screen that goes stale without saying so. With
          // scripting on, htmx polls this same address (below, on `#ledger`)
          // and morphs the ledger in place, so the reader's scroll and focus
          // survive. The `answer` view reaches none of this: it has no refresh
          // in either mode, so there is nothing for it to degrade to.
          keepsCurrent ? (
            <>
              {
                // **Not where a person may be writing** (#220 S1): with script
                // off a reload would throw a half-written draft away, so a
                // view with a composer does not reload itself and says so.
                writingHere ? null : (
                  <noscript>
                    <meta http-equiv="refresh" content={`${String(REFRESH_SECONDS)};url=${here}`} />
                  </noscript>
                )
              }
              {/*
               * R2's substitute, as the library's own configuration: requests
               * to this origin only, no `eval`, no script out of a response, no
               * history cache, and no inline indicator style the CSP would
               * refuse anyway.
               */}
              <meta
                name="htmx-config"
                content={JSON.stringify({
                  selfRequestsOnly: true,
                  allowEval: false,
                  allowScriptTags: false,
                  historyEnabled: false,
                  includeIndicatorStyles: false,
                  // **The tab's title is `page/chime.js`'s** (rondo#414): htmx
                  // would write the response's `<title>` straight after
                  // `htmx:afterSwap` and take *your turn* back off the tab.
                  ignoreTitle: true,
                  // **A refused send is shown where the draft is** (#220 S1):
                  // htmx swaps no error by default, so a `409` would change
                  // nothing on the screen. The send routes answer htmx with a
                  // `#send-refused` line, and it goes into the composer's note;
                  // the draft is not touched.
                  responseHandling: [
                    { code: "204", swap: false },
                    { code: "[23]..", swap: true },
                    {
                      code: "[45]..",
                      swap: true,
                      error: true,
                      target: "#composer-note",
                      select: "#send-refused",
                      swapOverride: "innerHTML",
                    },
                  ],
                })}
              />
            </>
          ) : null
        }
        {/*
         * **The count and the badge in the tab strip** (rondo#414), drawn by
         * the server so a document says them before any script runs;
         * `page/chime.js` keeps them current from `#ledger` as the poll
         * redraws it.
         */}
        <title>{wording.tabTitle(waitingCount)}</title>
        <link rel="icon" type="image/svg+xml" href={tabIcon(waitingCount)} />
        <link rel="stylesheet" href="/app.css" />
        {
          // **Not deferred, and before the body** (rondo#379): it puts the
          // text size a person chose on the root element before anything is
          // drawn, so the page does not paint at one size and jump to another.
          // `theme.js` does the same for the palette (rondo#590).
        }
        <script src="/text-size.js" />
        <script src="/theme.js" />
        {
          // `defer` on all of them, in this order: htmx is defined before its
          // morph extension registers with it, and both before the key and
          // composer scripts run; none runs before the document exists. None
          // draws anything a person must read -- the whole document is already
          // here, rendered by the server (D-0054 rule 7).
          keepsCurrent ? (
            <>
              <script src="/htmx.min.js" defer />
              <script src="/idiomorph-ext.min.js" defer />
            </>
          ) : null
        }
        <script src="/keys.js" defer />
        <script src="/composer.js" defer />
        <script src="/chime.js" defer />
        {
          // **What the redraw changed, said in colour** (rondo#494 item 1). It
          // listens for the swap htmx makes, so it is loaded where the page
          // keeps itself current and nowhere else: a view that holds still
          // changes nothing under anybody.
          keepsCurrent ? <script src="/changed.js" defer /> : null
        }
        {
          // **A form being filled in is not swapped under the person**
          // (rondo#494 items 2 and 3, D-0166): it hooks the same morph, after
          // `page/composer.js` has, so it is loaded where the morph is.
          keepsCurrent ? <script src="/rounds.js" defer /> : null
        }
      </head>
      <body class="page-shell min-h-screen bg-background font-sans text-foreground antialiased">
        <header class="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-sm">
          {/*
           * As wide as the faces (`.faces-width`), and **no item wraps**
           * (rondo#379): in a 1,024px column a larger text size folded
           * "依頼" and the key hints one character to a line. **The row
           * does** (rondo#593): on a phone the items need more than the
           * screen, and a row that cannot wrap ran off its right edge, so an
           * item that does not fit moves whole to a second line.
           */}
          <div class="faces-width mx-auto flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 whitespace-nowrap px-4 py-2 sm:px-6">
            <h1 class="text-title font-semibold tracking-tight">
              {
                // `data-back` is what `Esc` follows; on the summary there is
                // nowhere further back to go, so it is absent there. A thread's
                // way back is the bare address too (D-0096): the header's
                // requests link it used to follow is gone.
                view.kind === "summary" || view.kind === "scope" ? (
                  <a href={here}>rondo</a>
                ) : (
                  <a href={viewHref({ kind: "summary" }, wording.lang)} data-back="">
                    rondo
                  </a>
                )
              }
            </h1>
            {/*
             * The count of everything waiting on the person -- the same number
             * as the summary's heading, and a link to that summary. The count is
             * its own element so a redraw can renew it out of band: the header
             * is not swapped. The "Requests" link #220 S1 put before it is
             * closed (D-0096): it led to the new-request view, which the list's
             * own "write a new request" already reaches.
             */}
            <span id="waiting-count" class="empty:hidden">
              {waitingCount === 0 ? null : (
                // **Said as what it counts** (the S1 design pass): a bare `1`
                // beside "Requests" read as a count of requests.
                <a
                  href={viewHref({ kind: "summary" }, wording.lang)}
                  class={`${PILL} px-1.5 font-sans ${TONE.wait} hover:underline`}
                >
                  {wording.waitingCount(waitingCount)}
                </a>
              )}
            </span>
            {
              // The thread's own crumb, where there is room for it; the thread
              // header names it at every width.
              view.kind === "thread" && threads.rootOf(view.messageId) !== null ? (
                <>
                  <span aria-hidden="true" class="hidden text-faint xl:inline">
                    /
                  </span>
                  <span
                    class="hidden max-w-[16rem] truncate text-meta text-foreground xl:inline"
                    lang=""
                  >
                    {firstLine(threads.byId.get(threads.rootOf(view.messageId) ?? "")?.body ?? "")}
                  </span>
                </>
              ) : null
            }
            {keepsCurrent ? (
              <>
                {/*
                 * **Script only** (the third design pass): with script off the
                 * meta refresh reloads the document, which the foot note says,
                 * and a *live* pill there claimed an in-place redraw that is not
                 * happening.
                 *
                 * **Muted, because it is not a state** (rondo#593): green is
                 * *finished well* (D-0082 rule 3), and a page redrawing itself
                 * has finished nothing.
                 */}
                <span class={`js-only ${PILL} gap-1.5 font-sans ${TONE.muted}`}>
                  <span class="size-1.5 rounded-full bg-muted-foreground motion-safe:animate-pulse" />
                  {wording.liveLabel}
                </span>
                {/*
                 * **Asking the browser for leave to ring** (rondo#311, plan
                 * 2), and the only reason it is a button rather than a line of
                 * script: a browser grants this from a person's own press and
                 * from nothing else, so a tab that asked on its own would
                 * either be refused or would put a permission box in front of
                 * somebody who had pressed nothing.
                 *
                 * **Hidden until `page/chime.js` decides otherwise**, which is
                 * `js-only`'s reason twice over: with no script it does
                 * nothing, and with script it is drawn only while the browser
                 * still has no answer to keep. Outside `#ledger` on purpose --
                 * the poll swaps that subtree every five seconds, and a button
                 * whose state this tab decided would be replaced by the
                 * server's idea of it twice a minute.
                 */}
                <button
                  type="button"
                  id="chime-ask"
                  hidden
                  class={`js-only ${PILL} gap-1.5 font-sans border-link/40 text-link hover:underline`}
                >
                  {wording.chimeAsk}
                </button>
              </>
            ) : null}
            <span class="flex-1" />
            {
              // **Whose name a send and a press are recorded under** (the S1
              // design pass), in place of a sentence naming the variable.
              actorId === null ? null : (
                <span
                  class="hidden items-center gap-1.5 text-meta text-muted-foreground lg:inline-flex"
                  title={wording.signedInAs(actorId)}
                >
                  <span class="inline-flex size-5 items-center justify-center rounded-full bg-muted text-id font-semibold text-foreground ring-1 ring-border">
                    {actorId.slice(0, 1).toUpperCase()}
                  </span>
                  {actorId}
                </span>
              )
            }
            {/*
             * **Where they fit, and only there** (rondo#379). Measured on the
             * thread with the actor shown: the header's items need about
             * 1,060px at the default size in English and 1,200px at the
             * largest, of which the hints are 300 to 335; below `xl` they would
             * push the switch off the row, so they are left out there, and the
             * keys still work -- and the `?` beside them lists them at every
             * width (rondo#588).
             */}
            <span class="js-only hidden items-center gap-1.5 text-xs text-muted-foreground xl:flex">
              {keys.map(([key, word]) => (
                <>
                  {key.split(" ").map(kbd)}
                  <span class="mr-2">{word}</span>
                </>
              ))}
            </span>
            {/*
             * **The keys, at every width** (rondo#588). A native popover: the
             * button opens it with no script, `?` opens it from
             * `page/keys.js`, and `Esc` or a click outside shuts it. Script
             * only, as the hints are: with script off no key does anything.
             * Outside `#ledger`, so the redraw never shuts it.
             */}
            <button
              type="button"
              popovertarget="key-sheet"
              aria-label={wording.keySheet}
              title={wording.keySheet}
              class="js-only inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border font-mono text-meta text-muted-foreground hover:text-foreground"
            >
              ?
            </button>
            <div
              id="key-sheet"
              popover="auto"
              role="dialog"
              aria-labelledby="key-sheet-title"
              class="m-auto w-64 max-w-[calc(100vw-2rem)] whitespace-normal rounded-md border border-border bg-card p-4 text-body text-foreground shadow-lg"
            >
              <h2 id="key-sheet-title" class="mb-3 text-meta font-semibold">
                {wording.keySheet}
              </h2>
              <dl class="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-meta">
                {[...keys, ["?", wording.keyShowSheet] as const].map(([key, word]) => (
                  <>
                    <dt class="flex gap-1">{key.split(" ").map(kbd)}</dt>
                    <dd class="text-muted-foreground">{word}</dd>
                  </>
                ))}
              </dl>
            </div>
            {/*
             * **The text size, which a person can change** (rondo#379). Three
             * steps of the one type scale, each an "A" drawn at the step it
             * sets, so the control reads as what it does in either language;
             * the step's name is the button's accessible name and its tooltip.
             * `page/text-size.js` moves the scale and remembers the choice in
             * this browser, and marks the pressed step (`aria-pressed`). Script
             * only, because without it a press would do nothing; outside
             * `#ledger`, so the redraw never draws it back.
             */}
            <fieldset
              aria-label={wording.textSizeLabel}
              class="js-only inline-flex shrink-0 items-center rounded-md border border-border"
            >
              {(["", "large", "larger"] as const).map((step, at) => (
                <button
                  type="button"
                  data-text-size-choice={step}
                  aria-pressed="false"
                  aria-label={wording.textSizes[at]}
                  title={wording.textSizes[at]}
                  class={`inline-flex h-7 min-w-7 items-center justify-center px-1 font-semibold leading-none text-muted-foreground hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground ${["text-id", "text-body", "text-title"][at]}`}
                >
                  A
                </button>
              ))}
            </fieldset>
            {/*
             * **The palette, which a person can change** (rondo#590, D-0184).
             * Light, dark, or as the system is set (the default). Built as the
             * text-size control is: `page/theme.js` puts the choice on the
             * root, remembers it in this browser and marks the pressed one.
             */}
            <fieldset
              aria-label={wording.themeLabel}
              class="js-only inline-flex shrink-0 items-center rounded-md border border-border"
            >
              {(["light", "dark", ""] as const).map((choice, at) => (
                <button
                  type="button"
                  data-theme-choice={choice}
                  aria-pressed="false"
                  aria-label={wording.themes[at]}
                  title={wording.themes[at]}
                  class="inline-flex h-7 min-w-7 items-center justify-center px-1 text-body leading-none text-muted-foreground hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground"
                >
                  {["\u2600\ufe0e", "\u263e\ufe0e", "\u25d0"][at]}
                </button>
              ))}
            </fieldset>
            {
              // **The switch, and it is the first element of this chrome that
              // exists in order to be operated rather than read** (D-0056 rule
              // 10). One link per shipped set other than the one on screen,
              // labelled with that language's own name in its own language --
              // so the label is the same bytes in every set and needs no special
              // case for going back. **It keeps the view it was pressed on**,
              // and it is a `GET` that writes nothing to the ledger. It is also
              // the only thing on this page that writes rule 5's memory. The
              // links carry no class of their own; the nav styles them, so a
              // link is still exactly its address, its tag and its name.
              // Muted, so the one thing in the header in colour is the waiting count.
              <nav class="switch flex shrink-0 gap-3 whitespace-nowrap text-meta text-muted-foreground [&>a]:hover:text-foreground [&>a]:hover:underline">
                {[...SHIPPED_SETS]
                  .filter(([tag]) => tag !== wording.lang)
                  .map(([tag, endonym]) => (
                    <a href={viewHref(view, tag)} lang={tag}>
                      {endonym}
                    </a>
                  ))}
              </nav>
            }
          </div>
        </header>
        {/*
         * **The three faces** (D-0083 rules 1 and 5). The faces are React and
         * the things inside them are still this renderer's server JSX, so the
         * centre is handed over as markup (`src/access/page/shell.tsx`, which
         * exists to be deleted as each face is rebuilt). The left and right
         * faces are frames with nothing in them yet: the list is this slice's
         * next change, the right face's governance is the second slice's, and
         * the empty state's right face is the third's (gate point 7).
         */}
        <main>
          {
            // **Said on the visible page, whichever face a person is on**
            // (D-0020 rule 2). With no approver there is no write port and so
            // no button anywhere; a page that left this to one screen would
            // have an operator looking for a button that is missing for a
            // reason rondo knows and did not say. It sits above the faces
            // because it is true of the whole page and not of one of them.
            actorId === null ? (
              <p class="note faces-width mx-auto w-full rounded-md border border-border bg-muted/60 px-3 py-2 text-body leading-5">
                {wording.noApproverNote}
              </p>
            ) : null
          }
          {
            // A thread read that fails while the page is open must be said by
            // the redraw that shows the empty list, and must go away with the
            // redraw that recovers (#220 S1, Codex). Above the faces, because
            // with the threads unreadable there is no centre to put it in.
            threadRead.kind === "unreadable" ? (
              <p class="note faces-width mx-auto w-full rounded-md border border-fail/40 px-3 py-2 text-body leading-5 text-fail">
                {wording.threadsUnreadable(threadRead.reason)}
              </p>
            ) : null
          }
          {/*
           * **What the refresh swaps is the faces** (D-0054 rules 1 and 2,
           * D-0059 R3). htmx `GET`s this view's own address every five seconds
           * and takes `#ledger` out of the document that comes back. There is
           * no fragment endpoint -- the response is the whole page a
           * navigating browser gets -- so there is no second rendering of
           * anything to keep true.
           *
           * **Merged in place, never replaced** (D-0054 rule 2, as D-0059's
           * annotation of 2026-09-21 restores it). The swap is idiomorph's
           * `morph:outerHTML`: the nodes a person is standing on stay the same
           * nodes, so a face's scroll offset, an opened fold, a caret and the
           * words in a box survive a redraw that changed something beside
           * them. A plain `outerHTML` swap built every node again, and lap 11
           * measured what that costs a reader every five seconds.
           *
           * It wrapped the status groups while the page was a ledger of laps;
           * since D-0083 what goes stale is the thread and the list beside it,
           * so the wrapper moved out here. The name stayed: `hx-get` and
           * `hx-select` have to agree with each other, and renaming it would
           * only churn the selector.
           */}
          {/*
           * **What the tab rings off** (rondo#311, plan 2), below. The waits
           * themselves and not a count of them (Codex, round 3): a second
           * question arriving in a request that was already waiting, or one
           * request settling as another opens, leaves a count where it was
           * and would have left the tab silent. Each wait carries a key that
           * is new exactly when the wait is, so the tab rings on a key it has
           * not seen -- the same test the host's own tick makes, off the same
           * pass, so the screen, the notification and the chime cannot
           * disagree about what is waiting.
           *
           * The sentence rides along because it is the person's language,
           * which this request resolved and the browser did not.
           */}
          <div
            id="ledger"
            data-waits={JSON.stringify(waits.map((wait) => wait.episode))}
            data-chime={wording.reachYourTurn}
            // **The word a changed element wears where there is no motion to
            // read** (rondo#494 item 1), beside the chime's sentence and for
            // its reason: the language is this request's, and
            // `page/changed.js` must not pick a word of its own.
            data-changed-word={wording.changedMark}
            data-title={wording.tabTitle(waitingCount)}
            data-title-turn={wording.tabTitleTurn}
            data-icon={tabIcon(waitingCount)}
            {...(token === null ? {} : { "data-notice-to": "/notice", "data-notice-token": token })}
            {...(keepsCurrent
              ? {
                  "hx-get": here,
                  "hx-trigger": "every 5s",
                  "hx-select": "#ledger",
                  "hx-ext": "morph",
                  "hx-swap": "morph:outerHTML",
                  "hx-select-oob": "#waiting-count",
                }
              : {})}
          >
            {raw(faces)}
          </div>
          {
            // **Each view says which of the two it is**, because "redraws
            // every 5s" on a view that does not would be the page's own copy
            // lying about the one property D-0054 rule 1 spends itself on.
            // Both say the same thing about writing, which is the fact that
            // did not change: a read writes nothing, whoever or whatever
            // issued it. At the foot rather than the head (the design pass on
            // #220): it is the page's account of itself, and what needs the
            // reader leads. **One short line, and the account in its
            // `title`** (the S1 design pass).
            //
            // **Outside the swap**, because it is true of the document and not
            // of the faces; the header's live pill is its pair and is outside
            // too. As wide as the header and the notes (rondo#593), so its
            // first word sits under the header's first.
            <p class="note faces-width mx-auto w-full px-4 py-1 text-meta leading-5 text-faint sm:px-6">
              <span
                title={
                  onThreads
                    ? wording.threadsLiveNote(REFRESH_SECONDS)
                    : keepsCurrent
                      ? wording.liveNote(REFRESH_SECONDS)
                      : wording.stillNote
                }
              >
                {
                  // **Script only, as the header's live pill** (#220 S1): with
                  // script off nothing redraws in place, and a thread with a
                  // box does not reload at all, so "live" would be false there.
                  keepsCurrent ? (
                    <span class="js-only">{wording.liveShort(REFRESH_SECONDS)}</span>
                  ) : (
                    wording.stillShort
                  )
                }
              </span>
            </p>
          }
        </main>
        {
          // **The one form every *read in my language* press submits**
          // (rondo#490): outside the ledger and every other form, so a press
          // inside the flow's ask does not nest a form, and the redraw never
          // touches it.
          reads?.press === true && token !== null ? (
            <form
              id={READ_IN_FORM}
              method="post"
              action={`/read-in?lang=${encodeURIComponent(wording.lang)}`}
              hidden
            >
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="back" value={here} />
            </form>
          ) : null
        }
      </body>
    </html>
  );

  return `<!doctype html>\n${await page.toString()}\n`;
}
