/**
 * The words every screen of the page is drawn with: the class strings D-0059
 * section 1 names, and the few elements that are the same on every screen
 * (rondo#341 step 1).
 *
 * **Here for `page/contract.ts`'s reason, and with one more hazard.** The three
 * screens read these back out of `src/access/web.tsx`, which is the module that
 * draws them: a cycle that holds only because every reference sits inside a
 * function body, and that would resolve to `undefined` the first time one of
 * them wrote `const X = CARD + "..."` at the top level. Lifting the vocabulary
 * below both ends the cycle rather than resting on where a reference happens to
 * sit.
 *
 * **A `.tsx` even for the strings that draw no element.** `page/app.css` scans
 * `src/access/**\/*.tsx` and nothing else, so a class string moved into a `.ts`
 * would stop being compiled into the stylesheet while still being served as
 * markup -- and `page.manifest.json` would disagree with the bytes rather than
 * the screen looking wrong somewhere a person would notice.
 *
 * **The scan reads the prose too.** Tailwind takes every word in this file as a
 * candidate, so a comment that happens to spell a bare utility name adds a rule
 * to the stylesheet and moves the manifest's digest. Nothing below is written
 * for the extractor; this is a note for whoever edits the comments.
 *
 * **Server JSX, as the renderer is.** No `@jsxImportSource` pragma, so this
 * file is `hono/jsx` like `src/access/web.tsx` and the screens it serves, and
 * not the React half that `page/faces.tsx` and its siblings are.
 */
import { BASIS_FORMS, type Basis } from "../../advisory/proposal.js";
import type { IterationRecord, ThreadMessageDraft } from "../../store/records.js";
import { basisLine } from "../advisory.js";
import { type ForgeRead, issueName } from "../issue-read.js";
import { isModelDrafterName } from "../model-draft/judgement.js";
import { viewHref } from "../page-logic/routes.js";
import { lineOf, type Threads } from "../page-logic/threads.js";
import type { Chrome } from "../wording.js";
import type { ThreadLink } from "./thread.js";

/**
 * The design vocabulary, as class strings the Tailwind build can read (D-0059
 * sections 1 and 2).
 *
 * **Written out in full and never assembled**, because `page/app.css` compiles
 * only the class names that appear literally under `src/access/**\/*.tsx`: a
 * class built from a template would be served as markup and never as CSS. The
 * tokens they name (`wait`, `run`, `ok`, `fail`, `faint`, ...) are declared in
 * `page/app.css` in both palettes, so nothing here decides a colour for one
 * mode only.
 *
 * **A marker class leads each string where a test or a reader finds an element
 * by it** (`request`, `basis`, `line`, `label`, `value`, `material`). None is a
 * Tailwind utility, so it names the element and styles nothing.
 */
export const PILL =
  "inline-flex shrink-0 items-center rounded-full border px-2 py-px font-mono text-meta font-medium leading-4 whitespace-nowrap";

/** One tone per state, which is the whole of what a pill says (section 1, Vercel's row). */
export const TONE = {
  wait: "border-wait/40 bg-wait-wash text-wait-ink",
  run: "border-run/35 bg-run-wash text-run-ink",
  ok: "border-border text-ok",
  fail: "border-fail/40 text-fail",
  muted: "border-border text-muted-foreground",
  revise: "border-wait/40 text-wait-ink",
} as const;

export type Tone = keyof typeof TONE;

/**
 * The one filled button shape, at two sizes: the press.
 *
 * **Ink and not amber** (D-0083 rule 10, which says it in those words). It was
 * amber-filled, and amber is the page's one claim that *a person must act*
 * (D-0082 rule 2) -- so every way to another screen was drawn in the colour
 * that was supposed to be rare, and the thread carried four of them above the
 * one press that was actually waiting. The weight a press has is its fill;
 * which colour that fill is is what says whether anything is stopped.
 */
export const PRIMARY =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-foreground font-semibold text-background shadow-xs outline-none hover:bg-foreground/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

/**
 * The press made against a finding: the same shape, outlined in amber
 * (D-0083 rule 10).
 *
 * **Outlined rather than filled, and amber rather than ink**, because the two
 * things it has to say at once are *this is the press* and *you are acting
 * over something that was raised*. A filled amber press said the second by
 * spending the page's scarcest colour on its largest area; the outline says it
 * without making the bar the loudest thing on a screen whose loudest thing
 * should be the question.
 */
export const DESPITE =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-md border-2 border-wait bg-wait-wash font-semibold text-wait-ink shadow-xs outline-none hover:bg-wait/15 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

/**
 * The same shape, outlined: the gate's second answer beside its first
 * (rondo#233 S4).
 *
 * **Outlined and not filled, and not because it matters less.** Two filled
 * buttons in one bar read as a choice with no answer at all; one filled and
 * one outlined reads as the recommendation and the other one. Which press
 * wears which is decided by what the readings raised, not by which answer it
 * is (rondo#351): with a finding standing, the filled one is *ask for a
 * change* and approve is {@link DESPITE}; with nothing raised, approve is
 * filled and this is the other one.
 */
export const SECONDARY =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background font-semibold text-foreground shadow-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

/**
 * A status glyph, drawn by the page rather than fetched (section 1: "a status
 * glyph in a leading column").
 *
 * Inline SVG rather than an icon package, because five shapes are fewer lines
 * than the dependency (D-0059 rule 5's ladder), and `aria-hidden` because the
 * state is also the pill's text beside it: the glyph is for the eye across the
 * room and never the only carrier.
 */
export function glyph(tone: Tone | "alert" | "message") {
  const color = {
    wait: "text-wait",
    run: "text-run",
    ok: "text-ok",
    fail: "text-fail",
    muted: "text-faint",
    revise: "text-wait",
    alert: "text-fail",
    message: "text-faint",
  }[tone];
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={`mt-0.5 size-4 shrink-0 ${color}`}
    >
      {tone === "wait" ? (
        <>
          <circle cx="8" cy="8" r="6.2" />
          <circle cx="8" cy="8" r="2.4" fill="currentColor" stroke="none" />
        </>
      ) : tone === "run" ? (
        <>
          <circle cx="8" cy="8" r="6.2" opacity="0.3" />
          <path d="M8 1.8a6.2 6.2 0 0 1 6.2 6.2" class="origin-center motion-safe:animate-spin" />
        </>
      ) : tone === "ok" ? (
        <>
          <circle cx="8" cy="8" r="6.2" />
          <path d="m5.4 8.2 1.8 1.8 3.4-3.6" />
        </>
      ) : tone === "fail" ? (
        <>
          <circle cx="8" cy="8" r="6.2" />
          <path d="m5.8 5.8 4.4 4.4m0-4.4-4.4 4.4" />
        </>
      ) : tone === "revise" ? (
        <path d="M13.2 6.4A5.4 5.4 0 1 0 13.4 9M13.6 2.8v3.8H9.8" />
      ) : tone === "alert" ? (
        <path d="M8 2.2 14.2 13H1.8L8 2.2Zm0 4.3v2.8m0 2v.1" />
      ) : tone === "message" ? (
        <path d="M2.5 4.3c0-1 .8-1.8 1.8-1.8h7.4c1 0 1.8.8 1.8 1.8v5c0 1-.8 1.8-1.8 1.8H7.2L4.4 13.5v-2.4h-.1c-1 0-1.8-.8-1.8-1.8Z" />
      ) : (
        <>
          <circle cx="8" cy="8" r="6.2" />
          <path d="m3.8 12.2 8.4-8.4" />
        </>
      )}
    </svg>
  );
}

/** A plain note in the views' muted box. */
export function note(line: string) {
  return (
    <p class="note rounded-md border border-border bg-muted/60 px-3 py-2 text-body leading-5">
      {line}
    </p>
  );
}

/** A view's head: the way back to the summary, and what the view is. */
export function backHead(wording: Chrome, heading: string) {
  return (
    <header class="space-y-2">
      <div class="flex min-w-0 items-center gap-2">
        <a
          href={viewHref({ kind: "summary" }, wording.lang)}
          data-back=""
          class="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          title={wording.keyBack}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="size-4"
          >
            <path d="M13 8H3m4-4-4 4 4 4" />
          </svg>
          <span class="sr-only">{wording.keyBack}</span>
        </a>
        <h2 class="min-w-0 flex-1 truncate text-title leading-6 font-semibold">{heading}</h2>
      </div>
    </header>
  );
}

/**
 * Where a publish's outcome is read back from: the report `reportToRequest`
 * writes into the request thread once all three legs are done (rondo#245).
 *
 * **The thread message is the fact, and rondo holds no other.** It is written
 * after the push, the pull request and the run close have all succeeded and
 * never before, so its presence is the whole of "this was published" --
 * `publishFromPage` deliberately persists nothing about how far a publish that
 * failed had got (`src/access/cli.ts`, the `publishRefusedPullRequestFailed`
 * arm), because that would be a durable record of somebody else's state.
 *
 * **A lap whose row names no request has no report**, because there is no
 * thread to write one into. That row keeps its publish link after a publish,
 * which is the state this page was in for every row before this: nothing is
 * made worse, and nothing here can invent the fact.
 *
 * The id is the one `reportToRequest` mints (`src/access/conductor.ts`), and
 * the URL is read off the sentence it composed rather than stored twice.
 */
export function publishedReport(
  threads: Threads,
  iterationId: string,
): { url: string | null } | null {
  const report = threads.byId.get(`report-published-${iterationId}`);
  if (report === undefined) {
    return null;
  }
  return { url: /https?:\/\/[^\s]+/.exec(report.body)?.[0] ?? null };
}

/** A card on the answer view: one section of what a press is made over. */
export const CARD = "min-w-0 rounded-lg border border-border bg-card px-4 py-3";

export const CARD_HEADING = "text-body leading-6 font-semibold";

/**
 * A row's state as a pill and its age (the page's third design pass on #220):
 * a word a person reads rather than the status enum. The head sentence the
 * terminal prints -- status, age, answer -- stays whole in `title`.
 */
function stateHead(wording: Chrome, record: IterationRecord, tone: Tone, age: string, raw: string) {
  return (
    <span class="head inline-flex items-center gap-2 whitespace-nowrap" title={raw}>
      <span
        class={`inline-flex shrink-0 items-center rounded-full border px-2 py-px text-meta font-medium leading-4 whitespace-nowrap ${TONE[tone]}`}
      >
        {wording.statePill(record.status, record.gateOutcome)}
      </span>
      <span class="tabular-nums">{age}</span>
    </span>
  );
}

/** A pill in the row's sans face, as {@link stateHead} draws one. */
export function pill(tone: Tone, text: string, extra = "") {
  return (
    <span
      class={`inline-flex shrink-0 items-center rounded-full border px-2 py-px text-meta font-medium leading-4 whitespace-nowrap ${TONE[tone]} ${extra}`}
    >
      {text}
    </span>
  );
}

/** `open` names the fold that turns it, where one fold sits inside another. */
export function chevron(open = "group-open:rotate-90") {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={`size-3.5 shrink-0 text-faint transition-transform ${open}`}
    >
      <path d="m6 3.5 4.5 4.5L6 12.5" />
    </svg>
  );
}

/** Where an issue's name links to (D-0076 rule 3.4): its address, when rondo knows it. */
export function issueHref(read: ForgeRead): string | null {
  return "read" in read ? read.read.url : /^https?:\/\//.test(read.named) ? read.named : null;
}

/** An issue's own name, as a link where there is an address for it. */
export function issueNameLink(read: ForgeRead) {
  const href = issueHref(read);
  return href === null ? (
    <span class="font-medium">{issueName(read)}</span>
  ) : (
    <a href={href} class="font-medium text-link hover:underline" title={href}>
      {issueName(read)}
    </a>
  );
}

/** Who wrote a message, as a person reads it: their own messages are "you". */
export function whoWrote(
  wording: Chrome,
  message: ThreadMessageDraft,
  actorId: string | null,
): string {
  if (message.authorKind === "operator" && message.authorId === actorId) {
    return wording.you;
  }
  // **A model drafter signs as rondo** (rondo#238, #259): its row name --
  // `rondo/drafter/1/<model-id>` -- is a version and a model a person would
  // have to ask about. The row keeps it; the voice badge beside this says it
  // is the drafter.
  // **A read of an issue signs as rondo too** (D-0078 section 3.1): rondo read
  // it; the badge beside this says it is an issue.
  return (message.authorKind === "drafter" && isModelDrafterName(message.authorId)) ||
    message.authorKind === "forge"
    ? "rondo"
    : message.authorId;
}

/**
 * One basis of a message, as a chip that goes where it points (#220 S1).
 *
 * **Never an id to copy.** A `message` basis is the words it cites and a link
 * to them; an `iteration` basis links to that lap's section of the reading. The
 * other forms have no view on this page yet, so they are the terminal's own
 * {@link basisLine} and not a link -- a chip that led nowhere would be worse
 * than one that says so by not being blue. A basis that is not a locator is
 * shown as its JSON rather than dropped, so nothing the drafter cited is lost.
 */
/**
 * One basis as a word that leads where it points: the cited message by its
 * words and an anchor, everything else named and not linked.
 */
export function basisWord(
  wording: Chrome,
  basis: Readonly<Record<string, unknown>>,
  threads: Threads,
  root: string | null,
  actorId: string | null,
): ThreadLink {
  const form = basis["form"];
  let said: string;
  let href: string | null = null;
  if (form === "message" && typeof basis["messageId"] === "string") {
    const cited = threads.byId.get(basis["messageId"]);
    said =
      cited === undefined
        ? basisLine({ form: "message", messageId: basis["messageId"] }, {})
        : `${whoWrote(wording, cited, actorId)}: ${lineOf(cited)}`;
    if (cited !== undefined) {
      href =
        threads.rootOf(cited.messageId) === root
          ? `#${encodeURIComponent(cited.messageId)}`
          : `${viewHref({ kind: "thread", messageId: cited.messageId, to: null }, wording.lang)}#${encodeURIComponent(cited.messageId)}`;
    }
  } else if (form === "iteration" && typeof basis["iterationId"] === "string") {
    // A lap used to point at its section in the reading fold; with the fold
    // gone (D-0083) there is no page-wide place a lap id leads to, so the
    // basis is named and not linked.
    said = basisLine({ form: "iteration", iterationId: basis["iterationId"] }, {});
  } else if (form === "snapshot") {
    said = `snapshot ${String(basis["pointer"])}`;
  } else if ((BASIS_FORMS as readonly unknown[]).includes(form)) {
    said = basisLine(basis as unknown as Basis, {});
  } else {
    said = JSON.stringify(basis);
  }
  return { said, href, title: said };
}

/** A budget number in a box: whole for a count, two decimals for money. */
export const money = (value: number) => value.toFixed(2);

/**
 * An expiry as a native `datetime-local` reads and writes it, **in UTC**.
 *
 * A person does not read or type a Unix millisecond, and a page with no script
 * cannot know the browser's zone -- so the one value has one meaning, the label
 * says which (`scopeExpiresLabel` names UTC), and the route parses the same
 * `YYYY-MM-DDTHH:MM` back as UTC. Where `datetime-local` is unsupported the
 * browser degrades to a text box of that shape, which the route reads
 * identically.
 */
export function localTime(atMs: number): string {
  return new Date(atMs).toISOString().slice(0, 16);
}
