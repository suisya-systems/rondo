import { CARD, CARD_HEADING, PRIMARY } from "../page/vocabulary.js";
import { viewHref } from "../page-logic/routes.js";
import { firstLine } from "../page-logic/threads.js";
import type { Chrome } from "../wording.js";

/**
 * The page a refused press answers with, in the page's own frame (rondo#439):
 * its stylesheet, its header and a notice, not bare HTML. **One frame for every
 * refusal**, because a refusal is where a person has to find their way on.
 *
 * With script off this page *is* the response, and what the person typed only
 * exists in the browser's own history, so the way back stays a link and the
 * sentence says the back button keeps the draft.
 */
export interface Refused {
  /** The press that was refused, as the tab and the heading say it. */
  readonly title: string;
  /** The id the sentence carries, which a test and a script look for. */
  readonly id: string;
  readonly line: string;
  readonly href: string;
  readonly back: string;
  /**
   * rondo's own reason, when the press reached a port that gave one: the
   * sentence says who can look, and this is what they look at (D-0076 rule
   * 4.2), closed, with where the rest of the host's output is.
   */
  readonly note: string | null;
  /**
   * Each line holding the files a start needed (rondo#439), named by the words
   * the person wrote for its request (D-0076 rule 3.3), with its release where
   * the host holds the release press: the release screen says what releasing
   * does, and has the press.
   */
  readonly holders: readonly { readonly lineageId: string; readonly request: string | null }[];
  readonly releasable: boolean;
}

export async function refusedPage(wording: Chrome, refused: Refused): Promise<string> {
  const page = (
    <html lang={wording.lang}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{refused.title}</title>
        <link rel="stylesheet" href="/app.css" />
        <script src="/text-size.js" />
      </head>
      <body class="min-h-screen bg-background font-sans text-foreground antialiased">
        <header class="border-b border-border bg-background">
          <div class="faces-width mx-auto flex h-12 items-center px-4 sm:px-6">
            <h1 class="text-title font-semibold tracking-tight">
              <a href={viewHref({ kind: "summary" }, wording.lang)}>rondo</a>
            </h1>
          </div>
        </header>
        <main class="mx-auto max-w-2xl space-y-4 px-4 py-6 sm:px-6">
          <h2 class="text-title leading-6 font-semibold">{refused.title}</h2>
          <p
            id={refused.id}
            class="rounded-md border border-wait/40 bg-wait-wash px-3 py-2 text-body leading-6"
          >
            {refused.line}
          </p>
          {refused.holders.map(({ lineageId, request }) => (
            <section class={`held-by ${CARD} space-y-3`}>
              <h3 class={CARD_HEADING}>{wording.planHeldBy}</h3>
              <p class="text-body leading-6 wrap-anywhere" lang="">
                {request === null ? "" : firstLine(request)}
              </p>
              {refused.releasable ? (
                <a
                  href={viewHref({ kind: "release", iterationId: lineageId }, wording.lang)}
                  class={`${PRIMARY} h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto`}
                >
                  {wording.releaseLink}
                </a>
              ) : null}
            </section>
          ))}
          {refused.note === null || refused.note === "" ? null : (
            <details id="refused-reason" class="text-meta text-muted-foreground">
              <summary class="cursor-pointer">{wording.forMaintainer}</summary>
              <p lang="en">{refused.note}</p>
              <p>{wording.hostLog}</p>
            </details>
          )}
          <p class="text-meta leading-5 text-muted-foreground">{wording.sendBackNote}</p>
          <p>
            <a href={refused.href} class="text-link underline-offset-2 hover:underline">
              {refused.back}
            </a>
          </p>
        </main>
      </body>
    </html>
  );
  return `<!doctype html>\n${await page.toString()}\n`;
}
