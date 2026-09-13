/**
 * One page, on localhost, that reads.
 *
 * **It is a second view of three commands and not a second system.** `inbox`,
 * `between` and `explain` already compose everything here out of rondo's own
 * rows; this module gathers what they gather and renders it as HTML, so a
 * person can read on a screen what they would otherwise read in a terminal.
 * Nothing new is stored, nothing new is named, and no state exists that a
 * command cannot also show.
 *
 * **What it is not is those three commands in the order they were written**
 * (rondo#145). An operator arrives with three questions -- *what needs me, what
 * is running, what just finished* -- and the page answers them in that order,
 * out of the rows `inbox`, `between` and `explain` already read. rondo's own
 * vocabulary -- bounds, adjacency, the last-look mark, a field-by-field reading
 * of every row -- is one `<details>` below, complete and unchanged. Folded is
 * not hidden: every claim that was on this page is still on it under the same
 * basis, and the lead cites the row each of its lines is read off so that a
 * number is checkable twice over rather than asserted once. The three terminal
 * commands are untouched; this is the web face and only the web face.
 *
 * **Reading is a type; the one write is a runtime fact** (D-0041). The two
 * ports are still `Pick`ed down to the methods that read ({@link WebPorts}), so
 * everything the renderer holds is unable to write and the compiler says so.
 * That is not a preference about web surfaces: the two rows a terminal `inbox`
 * writes -- the count of what was presented (D-0032 rule 10) and the last-look
 * mark (rule 9) -- are claims about a person having been shown something, and a
 * page redrawing every few seconds while nobody is at the desk would make both
 * of them lies. A redraw did not read the inbox, so it still writes neither.
 *
 * **A click, though, is a person answering a gate.** So the page carries one
 * button, and the whole of what it may write arrives as a *second* port holding
 * a single capability (`AnswerPort`, in `src/access/web-app.ts`) rather than a store: the page's
 * writing vocabulary is one sentence long, and widening it is a visible change
 * to a type. No type can tell an unattended redraw from a human's click -- they
 * differ in whether somebody was at the keyboard, which is not in the data -- so
 * two runtime facts do it instead. **D-0054 amended one of them, and narrowed
 * what the pair guarantees.** Two of the three views now carry a library that
 * `GET`s its own address every five seconds and swaps the ledger in place
 * ({@link isLive}; htmx since D-0059 R2), so *"nothing here can emit a `POST`"*
 * has stopped being true of this page -- and D-0059 section 5 moved the rest of
 * it into the write port, which mints a press only from a person's navigation. What still holds -- and what D-0042's invariant now rests
 * on alone -- is the server half of the same fact: a `GET` reaches this
 * renderer, this renderer holds only the read ports, and the compiler says so,
 * so an unattended redraw writes nothing because the code path it reaches
 * cannot write. The forged cross-site `POST` is left to the other two facts,
 * which are untouched: a token minted when this process began listening,
 * rendered into the form and checked on the way in, so a `POST` that carries
 * it came from a page this process served; and `frame-ancestors 'none'` on the
 * way out. That is two facts where there were three, and D-0054 rule 4 accepts
 * it knowingly rather than discovering it.
 *
 * **So the press, and not the render, is this surface's presentation**
 * (D-0042). The framing beside the button is written to the ledger before the
 * gate is answered, by the same `explain` writer the terminal uses -- and if it
 * cannot be written, nothing is answered and the person is told, which is
 * D-0022 rule 18's order applied to a page that had already drawn what it was
 * about to act on. It happens inside the answer port rather than here for
 * D-0041 rule 4's reason: one function is still the whole of what this surface
 * may write.
 *
 * **Two things the terminal got wrong are not repeated here** (rondo#90,
 * rondo#91). A request is shown with its paragraphs intact, because the page
 * has no cp932 console to protect and `white-space: pre-wrap` costs nothing;
 * and a basis is printed once above the claims that rest on it rather than
 * under each of them, because the terminal's repetition is what made a long
 * citation unreadable.
 *
 * **localhost, and no authentication instead of weak authentication.** The
 * server binds `127.0.0.1` and nothing else, so what protects the page is that
 * it is not reachable rather than a password rondo would have to store,
 * rotate and get right.
 *
 * **This module renders and negotiates; it does not serve** (D-0059 rule 2).
 * The server -- routing, the `Host` check, the security headers, the press and
 * the one write route -- is `src/access/web-app.ts`, on Hono. What stays here
 * is rondo's content and D-0056's five steps (D-0059 rule 4), both of which are
 * functions of values and not of a socket, which is also why none of this
 * module's tests needs one.
 *
 * **The markup is server JSX and the look is Tailwind** (D-0059 rules 1 and 2).
 * The strings are the ones this module always drew -- every claim, basis, lap
 * line, fence line and catalogue sentence -- in the elements section 1's bar
 * names: one row per lap with a leading glyph, a state pill and a muted
 * right-aligned column; groups labelled with their counts; a short filled call
 * to action; the press in a bar that stays in reach. `page/app.css` holds both
 * palettes, and the build compiles the classes named in this file.
 */
import { parseAccept } from "hono/utils/accept";
import {
  type AdvisorySnapshot,
  BASIS_FORMS,
  type Basis,
  type Claim,
  type HostSnapshot,
  propose,
  proposeHost,
  UNDETERMINED,
} from "../advisory/proposal.js";
import type { HostPolicy } from "../refrain/policy.js";
import {
  type IterationRecord,
  isApprovableKind,
  isTerminal,
  type NonTerminalStatus,
  type OpenProposal,
  type ThreadMessageDraft,
  WAIT_SIDE,
} from "../store/records.js";
import type { AdvisoryRecord, IterationStore, ReadOutcome } from "../store/sqlite.js";
import { basisLine, gather, gatherHost } from "./advisory.js";
import {
  ago,
  gatherInbox,
  type InboxReadPorts,
  type InboxSnapshot,
  inboxLines,
  type LiveRow,
  locateRunning,
  type TranscriptLocation,
  unblockedBy,
  whereItRuns,
} from "./inbox.js";
import { type Chrome, EN, SHIPPED_SETS, setFor } from "./wording.js";

/**
 * Everything the page is handed: the reading half of the two ports, the host's
 * bounds, whose inbox to draw, and a clock.
 *
 * `actorId` is nullable because an inbox is one person's: with `RONDO_APPROVER`
 * unset there is nobody whose last-look mark the "since you last looked"
 * section could be about, and the page says so rather than drawing somebody's.
 */
export interface WebPorts extends InboxReadPorts {
  readonly store: Pick<
    IterationStore,
    "read" | "readLive" | "readingsFor" | "occupancy" | "terminalIterations"
  >;
  readonly record: InboxReadPorts["record"] &
    Pick<AdvisoryRecord, "admissionRefusals" | "threadMessages">;
  readonly policy: HostPolicy;
  readonly actorId: string | null;
  /**
   * The tag this host stated about its one operator, or null when it stated
   * nothing (D-0055 rule 5, D-0056 rules 2 and 3).
   *
   * **A tag and no longer a set, which is the whole of what D-0056 rule 3 costs
   * this interface.** D-0055 resolved the variable at boot and handed the page
   * the wording; under rule 2 the variable is one *step* of five, and a step
   * that names a tag no set resolves to has to be a step that said nothing so
   * that the browser's list answers instead. A `Chrome` cannot say that -- it
   * is `EN` both for a host that asked for English and for a host that asked
   * for German -- so what arrives is the tag, and {@link resolveLanguage} does
   * the lookup once per request beside the other four steps.
   *
   * Still read from `RONDO_OPERATOR_LANGUAGE` beside `RONDO_APPROVER`, in the
   * one place rondo's other deployment facts are read, and still refused there
   * if it is not a tag (D-0056 rule 9).
   */
  readonly hostLanguage: string | null;
  /**
   * What the lap actually did, as `rondo answer` lists it (D-0029 rule 2).
   *
   * A function for the answer port's reason turned the other way round: the
   * material is read out of a workspace with `git`, and a page that could spawn
   * one would have a capability nothing on this surface should hold. So the
   * caller reads it and this module renders it.
   *
   * It is shown **where the button is** and nowhere else, because the button is
   * where it is needed: a screen that is easier to reach than the terminal must
   * not also be the screen that asks for less before it writes.
   */
  readonly material: LapMaterial | null;
}

/**
 * The lines `rondo answer` prints about the work itself, for one iteration, in
 * the language this request resolved to (D-0056 rule 12).
 *
 * **The set is an argument and not something the port was built with.** It was
 * a closure over the host's set at `src/access/cli.ts`, which was correct while
 * the page had one language for the life of the process and wrong the moment a
 * request can switch it: the fence block's two standing sentences are prose
 * (D-0055 rule 11), and a page that had switched would have shown them in the
 * host's language inside a document declaring another.
 */
export type LapMaterial = (wording: Chrome, record: IterationRecord) => Promise<readonly string[]>;

/**
 * The one word the button carries (D-0041 rule 7).
 *
 * Read from this constant on the way *in* rather than from the posted form: the
 * form's own `body` field is not trusted, so the page's writing vocabulary is
 * one word whatever a hand-written request says.
 */
export const APPROVE_BODY = "approve";

/** How often a live view redraws itself, in seconds: the `<noscript>` refresh and htmx's `every 5s`. */
const REFRESH_SECONDS = 5;

/**
 * Which of the one page's three views is being read.
 *
 * **The whole of this surface's state is in the address**, which is what makes
 * it survivable: the view is a query the server reads, so every redraw --
 * the `<noscript>` refresh, or htmx's own `GET` -- asks for the view
 * being read and is answered with it. A view outlives every redraw because the
 * server is the one holding it, and not because a client remembered anything;
 * D-0054 added a script and D-0059 a library, and neither adds client state or
 * a router.
 *
 * `summary` answers the three questions and nothing else. `reading` adds
 * rondo's own compositions -- the inbox, what spans the live laps, every row's
 * claims under their own pointers. `answer` is one row's whole framing beside
 * its button, and it exists because **the press is the presentation** (D-0042):
 * what a press records is `explainIteration`'s entire claim set, counted as
 * shown, so the page that carries the button has to be the page that carried
 * every one of those claims. A summary with a button would record a
 * presentation that did not happen.
 *
 * Queries on `/` rather than three paths, because the router refuses every path
 * but `/` and a second URL is a second one to get wrong. All three are `GET`s
 * and all three write nothing (D-0041).
 */
export type PageView =
  | { readonly kind: "summary" }
  | { readonly kind: "reading" }
  | { readonly kind: "answer"; readonly iterationId: string }
  /**
   * The request threads (D-0061 rule 4, #220 S1): `requests` lists them and
   * carries the composer for a new one; `thread` is one of them, named by any
   * message in it -- so the address a send redirects to is the message it
   * sent -- with `to` the message the reply box answers, or null for the
   * default ({@link replyTarget}). Both are live: a drafter can write into a
   * thread while a person reads it.
   */
  | { readonly kind: "requests" }
  | {
      readonly kind: "thread";
      readonly messageId: string;
      readonly to: string | null;
    };

/**
 * Whether this view keeps itself current, which is a property of the view and
 * never of the page (D-0054 rule 1).
 *
 * `summary` and `reading` are *what is running* and want to be current, so
 * they carry htmx's poll -- and, with scripting off, the meta refresh inside
 * `<noscript>`. **`answer` updates by nothing at all: no poll, no refresh.** (It
 * does load the key script, which moves focus and follows links and changes
 * nothing on the screen by itself.)
 * It is one row's framing beside its button, read by a person in order to
 * press, and rondo#160's complaint was exactly this screen being re-laid-out
 * under the reader while they read it. It costs no staleness risk, which is why
 * it is deletion rather than machinery: D-0042 re-composes the framing at press
 * time and refuses a press naming a row that is not there, so a page a minute
 * old cannot answer a gate that moved.
 */
function isLive(view: PageView): boolean {
  return view.kind !== "answer";
}

/**
 * The address of one view, for the redraw and for the links between them.
 *
 * **Every address this page composes for itself carries the tag** (D-0056 rule
 * 11). The tag is not optional and there is no overload without it: rule 4
 * makes the URL the only home of the language in force, so an address that
 * dropped it is a page that silently re-resolves -- and with scripting on it
 * would *appear* to stick, because the poll asks for the address it was
 * rendered with. A switch the fold drops is D-0055's failure reproduced by the entry
 * that fixed it, so the parameter is required and the compiler is what asserts
 * rule 11 rather than a comment.
 *
 * `lang` is written last on the two views that already carry a query, so the
 * address reads as *the view, in this language* rather than the other way
 * round.
 */
export function viewHref(view: PageView, tag: string): string {
  const lang = `lang=${encodeURIComponent(tag)}`;
  switch (view.kind) {
    case "reading":
      return `/?reading=open&${lang}`;
    case "answer":
      return `/?answer=${encodeURIComponent(view.iterationId)}&${lang}`;
    case "requests":
      return `/?requests=open&${lang}`;
    case "thread":
      return `/?thread=${encodeURIComponent(view.messageId)}${
        view.to === null ? "" : `&to=${encodeURIComponent(view.to)}`
      }&${lang}`;
    default:
      return `/?${lang}`;
  }
}

/**
 * The name of the one cookie this surface holds (D-0056 rule 5).
 *
 * **One value, and the entry's three clauses about what it is not.** It never
 * reaches the store, the ledger, a record kind, a plan field or a last-look
 * mark; it authorises nothing, because D-0041 rule 3(b)'s per-process token
 * stays in the form and is still the only thing that lets a `POST` write; and
 * it is a seed rather than a second home of the state, because rule 4 means the
 * tag in force is always the URL's.
 */
export const LANG_COOKIE = "lang";

/**
 * How long the memory outlives the tab, in seconds.
 *
 * **Months rather than a session** (D-0056 rule 5): an operator who switched
 * the page once is answering *what language do you read* and not *what language
 * is this tab*, and a memory that died with the browser would ask them again
 * every morning, which is the papercut the entry exists to close.
 */
export const LANG_COOKIE_SECONDS = 180 * 24 * 60 * 60;

/**
 * The remembered tag off a request's `Cookie` header, or null when there is
 * none.
 *
 * **Read raw, and not percent-decoded.** The value rondo writes is a set's own
 * tag -- `en` or `ja`, inside `[a-z]` -- so there is nothing to decode, and
 * `decodeURIComponent` is a function that *throws* on input it does not like
 * (`lang=%` is a `URIError`). This runs on every request to the page, so a
 * throw here would turn a stray cookie into a page that does not render rather
 * than a preference ignored -- and the cookie jar for
 * `localhost` is shared with whatever else on this machine has served a page,
 * so the header is not rondo's to trust the shape of. A value that is not a
 * tag resolves to nothing through {@link setFor}, which is the same answer
 * decoding it would have reached.
 */
function cookieTag(header: string | undefined): string | null {
  if (header === undefined) {
    return null;
  }
  for (const pair of header.split(";")) {
    const at = pair.indexOf("=");
    if (at !== -1 && pair.slice(0, at).trim() === LANG_COOKIE) {
      return pair.slice(at + 1).trim();
    }
  }
  return null;
}

/**
 * The tags one `Accept-Language` header offers, best first.
 *
 * **`q` order, and that is the whole of the reading** (D-0056 rule 6). The
 * header's grammar says it is a list with weights and not a ranking, so the
 * tags are sorted by weight -- absent meaning `1`, ties keeping the order they
 * were written in -- and then tried through lookup one at a time.
 *
 * **A `q` of zero is a refusal and not a low preference**, so those tags are
 * dropped here rather than tried last: `de;q=1, ja;q=0` must not reach the `ja`
 * set on its way past unsupported German. `*` is *no preference* and is
 * skipped. No basic filtering, no alternatives list, no best-fit.
 */
function tagsByWeight(header: string | undefined): readonly string[] {
  // **The list is split by `hono/utils/accept` and weighed here** (D-0059 rule
  // 4). The library's tokenizer handles the grammar -- quoted strings, stray
  // separators, whitespace -- and is what rondo no longer carries. Its *weight*
  // is not used: it reads a `Q=0` as `q=1`, because it looks the parameter up
  // by its lowercase name, which turns a refusal into the strongest preference
  // in the list. So the weight is re-read off the parameters below with the
  // grammar D-0056 rule 6 already tested, and the library's sort is undone by
  // sorting again on that weight.
  const offered: { tag: string; q: number; at: number }[] = [];
  // **`at` is the position the tag was written at, not the library's**: the
  // library has already sorted on its own weight, so `ja;q=0.5, en;Q=0.5`
  // comes back English first, and a tie broken on that order is broken by the
  // misread weight. So each entry is matched back to its first unclaimed
  // occurrence in the header as written.
  const written = (header ?? "").split(",").map((part) => part.split(";")[0]?.trim() ?? "");
  const claimed = new Set<number>();
  for (const { type, params } of parseAccept(header ?? "")) {
    const tag = type.trim();
    const found = written.findIndex((one, index) => one === tag && !claimed.has(index));
    claimed.add(found);
    // Not found only for a spelling the split above cannot see (a comma inside
    // a quoted parameter); such a tag goes after every tag it could place.
    const at = found === -1 ? written.length : found;
    // `*` is the only member of the grammar that is not a tag, and it says
    // nothing rather than something this page could look up.
    if (tag === "" || tag === "*") {
      continue;
    }
    const weight = Object.entries(params)
      // Case-insensitive, because RFC 9110 parameter names are.
      .filter(([name]) => name.trim().toLowerCase() === "q")
      // The fraction's digits are optional because RFC 9110's `qvalue` says so
      // -- `0*3DIGIT` after the point -- so `q=0.` is a spelling of zero and
      // must read as the refusal it is. A pattern demanding a digit there would
      // leave it unparseable, fall back to the default weight of 1, and turn an
      // explicit *do not send me this* into the strongest preference in the
      // list, which is rule 6's q=0 case failing in the one direction that
      // matters.
      .map(([, value]) => /^\s*(\d+(?:\.\d*)?)\s*$/.exec(value)?.[1])
      .find((found) => found !== undefined);
    const q = weight === undefined ? 1 : Number(weight);
    if (!Number.isFinite(q) || q <= 0) {
      continue;
    }
    offered.push({ tag, q, at });
  }
  // `at` is compared explicitly rather than leaning on a stable sort: "stable
  // within a weight" is the entry's wording and is a property of the result
  // rather than of the engine running it.
  return offered
    .sort((left, right) => right.q - left.q || left.at - right.at)
    .map((one) => one.tag);
}

/** Everything rule 2 reads, in one object so the order below is the only order. */
export interface LanguageAsked {
  /** `?lang=` on this request. */
  readonly query: string | null;
  /** The raw `Cookie` header, from which rule 5's one cookie is read. */
  readonly cookie: string | undefined;
  /** `RONDO_OPERATOR_LANGUAGE`, as the host stated it. */
  readonly host: string | null;
  /** The raw `Accept-Language` header. */
  readonly header: string | undefined;
}

/**
 * The wording set one request resolves to: rule 2's five steps, in order, first
 * answer winning.
 *
 * **Five, not four and not a merge.** Each step is one party saying something,
 * ordered by how specifically it was said about *this page and this reader* --
 * the parameter on this request, then the operator's own remembered switch,
 * then the host's statement about its one operator, then the browser's
 * preference for the web at large -- and the last is a floor rather than a
 * party. **A step that names a tag no set resolves to is a step that said
 * nothing**, which is why every step goes through {@link setFor} and not
 * `chromeFor`: English is reached once, at the bottom, and never four times on
 * the way down.
 *
 * **The host's variable sits above the browser's list** (rule 3). A variable is
 * a person stating a fact about this deployment's one operator and is what the
 * terminal reads; a header is a browser-wide preference set for the web at
 * large. So a host that has spoken is not overridden by a browser default, and
 * the browser decides the first visit exactly when the host has said nothing --
 * which is the common case and the one the operator was answering about.
 *
 * One readable function rather than a condition spread over the renderer, so
 * that the order is a thing a reader can check against the entry.
 */
export function resolveLanguage(asked: LanguageAsked): Chrome {
  const named = setFor(asked.query) ?? setFor(cookieTag(asked.cookie)) ?? setFor(asked.host);
  if (named !== null) {
    return named;
  }
  for (const tag of tagsByWeight(asked.header)) {
    const set = setFor(tag);
    if (set !== null) {
      return set;
    }
  }
  return EN;
}

/**
 * Whether this request's URL asked for a language the rest of rule 2 would not
 * have answered -- which is what a switch is, and what the canonicalising
 * redirect of rule 4 is not.
 *
 * **The one condition the memory is written on** (D-0056 rule 5), and it is
 * stated by comparing two resolutions rather than by trying to tell a click
 * from anything else. `?lang=ja` on a host with no memory and no Japanese
 * browser is a switch and is remembered. `?lang=ja` arrived at by a redirect
 * from a `ja` cookie is the answer the other steps already gave, and writes
 * nothing. `?lang=de` over a remembered `ja` resolves to nothing at step 1, so
 * the other steps answer `ja` either way and **the memory is not touched**
 * (rule 9) -- and `?lang=!!` does the same.
 */
export function isSwitch(asked: LanguageAsked, resolved: Chrome): boolean {
  return resolveLanguage({ ...asked, query: null }).lang !== resolved.lang;
}

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
const PILL =
  "inline-flex shrink-0 items-center rounded-full border px-2 py-px font-mono text-xs font-medium leading-4 whitespace-nowrap";

/** One tone per state, which is the whole of what a pill says (section 1, Vercel's row). */
const TONE = {
  wait: "border-wait/40 bg-wait-wash text-wait-ink",
  run: "border-run/35 bg-run-wash text-run-ink",
  ok: "border-border text-ok",
  fail: "border-fail/40 text-fail",
  muted: "border-border text-muted-foreground",
  revise: "border-wait/40 text-wait-ink",
} as const;

type Tone = keyof typeof TONE;

/** The one filled button shape, at two sizes: the way to a press, and the press. */
const PRIMARY =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-wait font-semibold text-wait-foreground shadow-xs outline-none hover:bg-wait/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

/**
 * A row a person can move to with `j`/`k` (D-0059 rule 5): focusable by script
 * and not by Tab, so the tab order is still the links and the one button.
 *
 * **Focus is a tint and a left bar, and never a box** (the third design pass on
 * #220): a ring drawn inside the waiting card's amber rule gave the row two left
 * edges, so the focused row's bar covers the rule instead of sitting beside it.
 */
const ROW =
  "grid grid-cols-[1rem_minmax(0,1fr)] gap-x-3 px-4 py-2.5 outline-none first:rounded-t-lg last:rounded-b-lg focus-visible:bg-accent focus-visible:shadow-[inset_3px_0_0_var(--color-ring)] sm:grid-cols-[1rem_minmax(0,1fr)_auto]";

/** The muted, right-aligned column of identifiers (section 1, GitHub's run list): a locator, so a step below the metadata. */
const META =
  "col-start-2 flex gap-x-2 font-mono text-[11px] leading-6 whitespace-nowrap text-faint tabular-nums max-sm:hidden sm:col-start-auto sm:justify-end";

/**
 * The metadata line under a row's title: its sentences run on one line, parted
 * by a middle dot the stylesheet draws, so the separator is not a character in
 * the document and a reader without CSS still gets the sentences as they were.
 *
 * **Every sentence carries its dot, and the dot that would lead a line is cut
 * off** (the S1 design pass on #220): the line sits a dot's width to the left
 * inside a box that clips ({@link metaLine}), so a sentence that wraps to a new
 * line starts clean instead of with a stray `·`. Direct children must be plain
 * spans: a pill goes inside one.
 */
const META_LINE =
  "-ml-3 flex flex-wrap items-center gap-y-0.5 text-[12.5px] leading-5 text-muted-foreground [&>span]:relative [&>span]:pl-3 [&>span]:before:absolute [&>span]:before:left-[0.3rem] [&>span]:before:text-faint [&>span]:before:content-['·']";

/** {@link META_LINE} inside the box that clips its leading dots. */
function metaLine(children: unknown, extra = "") {
  return (
    <div class="mt-0.5 overflow-hidden">
      <p class={`${META_LINE} ${extra}`}>{children}</p>
    </div>
  );
}

/** A row focusable by `j`/`k` that is not a list item: the answer view's claim groups. */
const FOCUS_ROW =
  "outline-none focus-visible:bg-accent focus-visible:shadow-[inset_3px_0_0_var(--color-ring)]";

/**
 * A status glyph, drawn by the page rather than fetched (section 1: "a status
 * glyph in a leading column").
 *
 * Inline SVG rather than an icon package, because five shapes are fewer lines
 * than the dependency (D-0059 rule 5's ladder), and `aria-hidden` because the
 * state is also the pill's text beside it: the glyph is for the eye across the
 * room and never the only carrier.
 */
function glyph(tone: Tone | "alert" | "message") {
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

/**
 * The tone of an ended lap: a failure is red, a gate sent back is an amber loop,
 * and everything else that finished is quiet -- so the outcome shows without
 * reading the head sentence that says it (the third design pass on #220).
 */
function endedTone(record: IterationRecord): Tone {
  if (record.status === "failed") {
    return "fail";
  }
  if (record.gateOutcome === "revise") {
    return "revise";
  }
  return record.status === "closed" ? "ok" : "muted";
}

/** The tone of any lap by its status: the reading's folds use it for their glyph. */
function statusTone(record: IterationRecord): Tone {
  if (isTerminal(record.status)) {
    return endedTone(record);
  }
  return WAIT_SIDE[record.status as NonTerminalStatus] === "waitingOnYou" ? "wait" : "run";
}

/**
 * Claims under the basis they rest on, each basis written once (rondo#91).
 *
 * Consecutive claims are grouped, never reordered: the order of the claims is
 * the payload's own and rondo does not rank them, so a grouping that sorted by
 * basis would be this surface inventing an emphasis the drafter did not have.
 *
 * **A definition list, two columns wide and one column narrow**: the label is
 * the muted term and the value is what a person reads, so the eye runs down the
 * values and not across a sentence. The basis heads its group in mono, because
 * it is a locator and not prose.
 */
function claimsView(claims: readonly Claim[], snapshot: object, focusable = false) {
  const groups: { basis: string; claims: Claim[] }[] = [];
  for (const claim of claims) {
    const basis = basisLine(claim.basis, snapshot);
    const last = groups.at(-1);
    if (last !== undefined && last.basis === basis) {
      last.claims.push(claim);
    } else {
      groups.push({ basis, claims: [claim] });
    }
  }
  return (
    // **One line per claim, with its basis as the trailing muted cell** (the
    // design pass on #220): the basis still comes first in the document, so a
    // reader without CSS meets the locator above the claims it covers, and only
    // `order-last` moves it to the right. A value that is `undetermined` is
    // drawn in faint ink and never folded away: the press records every claim
    // as shown (D-0042), so every claim stays on the screen.
    //
    // **The basis is a locator and is drawn as one** (the third design pass):
    // smaller than the value and trailing it at every width -- under `sm` it
    // follows the claims rather than heading them, where above them it doubled
    // each row's height. An `undetermined` row is a step tighter and fainter,
    // so the rows that carry a value are the ones the eye lands on. Where the
    // claims are the answer view's, each group is a `j`/`k` stop.
    <div class="divide-y divide-border rounded-md border border-border">
      {groups.map((group) => (
        <div
          class={`flex flex-col sm:flex-row sm:items-start ${focusable ? FOCUS_ROW : ""}`}
          {...(focusable ? { "data-row": "", tabindex: -1 } : {})}
        >
          {/* One quiet line, cut with an ellipsis; the whole locator is its `title`. */}
          <p
            class="basis order-last truncate px-3 pb-1.5 font-mono text-[10px] leading-4 text-faint/75 sm:w-[32%] sm:shrink-0 sm:py-2 sm:text-right"
            title={withoutRepeat(group)}
          >
            {withoutRepeat(group)}
          </p>
          <dl class="min-w-0 flex-1 divide-y divide-border/60">
            {group.claims.map((claim) => (
              <div
                class={
                  claim.value === UNDETERMINED
                    ? "claim grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 px-3 py-1 sm:grid-cols-[minmax(8rem,11rem)_minmax(0,1fr)] sm:gap-x-4"
                    : "claim grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 px-3 py-1.5 sm:grid-cols-[minmax(8rem,11rem)_minmax(0,1fr)] sm:gap-x-4"
                }
              >
                <dt
                  class={
                    claim.value === UNDETERMINED
                      ? "label text-[12px] leading-5 text-faint"
                      : "label text-[12.5px] leading-5 text-muted-foreground"
                  }
                >
                  {claim.label}
                </dt>
                <dd
                  class={
                    claim.value === UNDETERMINED
                      ? "value text-[12px] leading-5 wrap-anywhere whitespace-pre-wrap text-faint italic"
                      : "value text-[13px] leading-5 font-medium wrap-anywhere whitespace-pre-wrap"
                  }
                >
                  {claim.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

/**
 * One basis line, with the inline copy dropped when it says what the claim
 * above it already says.
 *
 * The terminal prints the cited material beside the pointer because a person
 * reading one line cannot open the snapshot (D-0032 rule 2). On a page where
 * the claim's value is *right there*, the same material twice -- once as prose
 * and once JSON-escaped -- is the repetition rondo#91 is about, and the
 * escaped copy is the one that is harder to read. The pointer stays: what is
 * dropped is a duplicate of the value, never the locator.
 */
function withoutRepeat(group: { basis: string; claims: readonly Claim[] }): string {
  const only = group.claims.length === 1 ? group.claims[0] : undefined;
  const tail = only === undefined ? "" : ` = ${JSON.stringify(only.value)}`;
  return tail !== "" && group.basis.endsWith(tail)
    ? group.basis.slice(0, -tail.length)
    : group.basis;
}

/**
 * How many ended laps the lead names before it stops counting back (rondo#145).
 *
 * ponytail: a fixed cap, and it caps the *rendering* rather than the read --
 * `terminalIterations` answers the whole ledger and this page sorts it every
 * five seconds. That is fine while a ledger is a session's worth of rows and is
 * the first thing to change if one is not; the store is where a bounded reader
 * would go, not here. *What just finished* is a question about the last few
 * minutes, and every ended row is still readable with `rondo explain`.
 */
const RECENT_ENDED = 5;

/**
 * The `lang` the plan asked for, on the elements that quote material (D-0053
 * rule 12).
 *
 * **The field's one use at render time, and it is markup rather than a claim.**
 * The request paragraph and the material block carry the tag, which is what a
 * browser uses to pick a font and break a line. That is the legibility
 * complaint rondo#155 opened with, met with an attribute.
 *
 * **Where no ask was made the attribute is `lang=""`** (D-0055 rule 8), which
 * is HTML's own way of saying *the language here is unknown*. It used to be
 * absent, and an absent attribute inherits the document: harmless while the
 * document was always `en` and a guess once the chrome can be the operator's
 * language, because *rondo does not know* would arrive on the screen as *this
 * is Japanese*. The chrome and a row's material may disagree and nothing
 * reconciles them -- each is true about a different thing -- so the one thing
 * this attribute must not do is inherit an answer to a question nobody asked.
 *
 * **Derived from the ask and from nothing else.** rondo never reads material to
 * find out what language it is in (rule 8), so where a worker ignored the ask
 * the attribute is wrong exactly as far as the ask was wrong and no further.
 * Nothing is translated here or anywhere (rule 11): the tag decorates the same
 * bytes the page already quoted.
 *
 * Read off the row's own plan payload rather than through `readRunPlan`,
 * because a page that redraws every five seconds may not refuse a row over a
 * field it is only decorating: absent, null and anything that is not a string
 * all mean *no ask*, which is the same empty attribute. `runPlan` already
 * refused every tag that could reach a written payload, and the JSX renderer
 * escapes the attribute anyway.
 */
function materialLanguage(record: IterationRecord): string {
  const asked = record.plan["material_language"];
  return typeof asked === "string" ? asked : "";
}

/**
 * What the lap spent, or nothing at all when rondo read none of it (`D-0046`).
 *
 * **Absent from the lead is not absent from the page.** All three columns are
 * null until the lap suspends, and a running lap carrying three `undetermined`s
 * is three lines that say nothing -- which is the failure rondo#145 measured.
 * The reading below still prints each of the three under its own pointer, so
 * the distinction between *rondo did not read this* and *this cost nothing*
 * survives where it is checkable. Where any one of them **was** read the line
 * is drawn and the other two say so by name.
 */
function spentLine(wording: Chrome, record: IterationRecord): string | null {
  if (record.lapCostUsd === null && record.lapTurns === null && record.lapDurationMs === null) {
    return null;
  }
  const cost =
    record.lapCostUsd === null
      ? wording.costNotRead
      : wording.costRead(record.lapCostUsd.toFixed(2));
  const turns =
    record.lapTurns === null ? wording.turnsNotRead : wording.turnsRead(record.lapTurns);
  // `ago` over a duration rather than over a clock: the same reading of the
  // same number of milliseconds, which is what keeps `7m` on this page the
  // same `7m` the inbox prints.
  const took =
    record.lapDurationMs === null ? wording.durationNotRead : ago(0, record.lapDurationMs);
  return wording.spent(cost, turns, took);
}

/**
 * What the worker's fence refused, in the three states the column has (#122).
 *
 * SQL null is rondo holding no reading, and is a line the lead does not draw:
 * every row before its first suspend is in that state and a screen that said so
 * on each of them would be back to counting zeros. The text `"null"` is continuo
 * saying it could not tell, which is **not** the same as nothing having been
 * refused and is the distinction the column was added to carry -- so it gets a
 * line of its own. The bytes are printed as continuo wrote them.
 */
function fenceLine(wording: Chrome, record: IterationRecord): string | null {
  const refused = record.permissionDenials;
  if (refused === null) {
    return null;
  }
  if (refused === "null") {
    return wording.fenceUnknown;
  }
  return refused === "[]" ? wording.fenceRefusedNothing : wording.fenceRefused(refused);
}

/** How an ended lap ended: the status, and the answer or reason beside it. */
function endedHow(wording: Chrome, record: IterationRecord, nowMs: number): string {
  return wording.endedHead(
    record.status,
    wording.age(ago(record.updatedAtMs, nowMs)),
    endedWhy(wording, record),
  );
}

function endedWhy(wording: Chrome, record: IterationRecord): string {
  return record.gateOutcome !== null
    ? wording.gateAnswered(record.gateOutcome)
    : (record.reason ?? wording.noReasonRecorded);
}

/**
 * A row's state as a pill and its age (the page's third design pass on #220):
 * a word a person reads rather than the status enum. The head sentence the
 * terminal prints -- status, age, answer -- stays whole in `title`.
 */
function stateHead(wording: Chrome, record: IterationRecord, tone: Tone, age: string, raw: string) {
  return (
    <span class="head inline-flex items-center gap-2 whitespace-nowrap" title={raw}>
      <span
        class={`inline-flex shrink-0 items-center rounded-full border px-2 py-px text-[11.5px] font-medium leading-4 whitespace-nowrap ${TONE[tone]}`}
      >
        {wording.statePill(record.status, record.gateOutcome)}
      </span>
      <span class="tabular-nums">{age}</span>
    </span>
  );
}

/** Which of the three questions a row answers, which is what its weight is decided by. */
type Question = "waiting" | "attention" | "running" | "ended";

/**
 * One lap as one row, with the row it rests on cited once beside it (D-0032,
 * rondo#91).
 *
 * **The shape is section 1's bar**: a status glyph in the leading column; the
 * request as the row's title; the state as a pill; the basis and the age in a
 * muted right-aligned column of tabular figures; and every line the lead used
 * to stack -- the head sentence, what releases it, what it spent, what its
 * fence refused, where it runs -- as one muted metadata line under the title.
 * Nothing that was on the page left it: the same strings, in fewer lines.
 *
 * **Waiting reads from across the room and finished recedes** (section 2's
 * shared gap): a waiting row's request is set larger, whole and with its
 * paragraphs (rondo#90), because it is what a person came to answer; a running
 * row's request is one line; an ended one is one line in secondary ink.
 *
 * {@link basisLine} is called rather than the string being spelled here,
 * because a second spelling of a basis is a second thing an operator has to
 * learn to trust. The `iteration` form reads no snapshot, so it is handed none.
 *
 * **The `id` is what keeps a person's place across the in-place refresh**
 * (D-0054 rule 2, D-0059 R2). htmx swaps the ledger and puts focus back on the
 * element whose `id` held it, and `j`/`k` focus is on these rows -- so a row
 * with no id, or one whose id moved to another lap, would drop the reader's
 * place every five seconds. The row id is already unique per document and
 * already the thing every line here is read off.
 */
function lapRow(
  question: Question,
  record: IterationRecord,
  head: unknown,
  lines: readonly unknown[],
  tail: unknown = null,
  below: unknown = null,
) {
  const tone: Tone =
    question === "waiting" ? "wait" : question === "running" ? "run" : endedTone(record);
  return (
    <li id={`lap-${record.id}`} data-row="" tabindex={-1} class={ROW}>
      {glyph(tone)}
      <div class="min-w-0">
        <p
          class={
            question === "waiting"
              ? "request text-[15px] leading-6 font-semibold wrap-anywhere whitespace-pre-wrap"
              : question === "running"
                ? "request text-sm leading-6 font-medium wrap-anywhere whitespace-pre-wrap"
                : "request truncate text-sm leading-6 font-medium text-muted-foreground"
          }
          // **Only an ended row is cut to one line** (rondo#90): a waiting or
          // running request is shown whole with its paragraphs, and an ended
          // one keeps its whole text in `title` for the pointer that asks.
          {...(question === "ended" ? { title: record.request } : {})}
          lang={materialLanguage(record)}
        >
          {record.request}
        </p>
        {/*
         * **The state is said once, by the head** (the design pass on #220):
         * the head sentence already names the status and the age, and the
         * glyph carries it for the eye, so a pill and an age column repeating
         * both were the same fact three times over.
         */}
        {/*
         * Under `sm` a running or ended row's metadata stops at two lines: a
         * transcript path wrapped to four there, and the whole of it is in the
         * reading. A waiting row's is never cut -- it says what releases it.
         */}
        {metaLine(
          <>
            {head}
            {lines
              .filter((line) => line !== null)
              .map((line) =>
                typeof line === "string" ? (
                  <span class="line min-w-0 wrap-anywhere whitespace-pre-wrap">{line}</span>
                ) : (
                  line
                ),
              )}
          </>,
          question === "waiting" ? "" : "max-sm:max-h-15 max-sm:overflow-hidden",
        )}
        {tail}
      </div>
      {/* The id alone; the basis it abbreviates is the column's `title`. */}
      <div class={META} title={basisLine({ form: "iteration", iterationId: record.id }, {})}>
        <p class="basis">{record.id}</p>
      </div>
      {below === null ? null : <div class="col-span-full">{below}</div>}
    </li>
  );
}

/**
 * One of the three questions: a group label that carries its count, and its
 * rows (section 1, Vercel's hierarchy of group, row and metadata).
 *
 * `data-question` is the whole of what the visual weight rests on, as the
 * section's class was before (rondo#153): *waiting*, *running* and *ended* are
 * the same shape and the same words, and what differs is how much each is
 * allowed to shout. No group is drawn on the strength of it and none is hidden
 * by it, so a browser that loads no CSS still gets every claim in the same
 * order. An empty group is its label alone, which is how *running now (0)* is
 * said once.
 */
function questionGroup(question: Question, heading: string, rows: readonly unknown[]) {
  return (
    <section data-question={question} class="space-y-2">
      {/*
       * One heading style for the three (the design pass on #220): they are
       * the same level, so the rows below and not the heading carry which of
       * them shouts.
       */}
      {/*
       * Above the rows in weight as well as in order (the third design pass):
       * foreground ink, and the first letter raised by the stylesheet so the
       * catalogue's sentence reads as a heading without changing its bytes.
       */}
      <h2 class="text-sm leading-6 font-semibold text-foreground first-letter:uppercase">
        {heading}
      </h2>
      {rows.length === 0 ? null : (
        <ul
          class={
            question === "waiting"
              ? "divide-y divide-wait/20 rounded-lg border border-wait/35 bg-card shadow-[inset_3px_0_0_var(--color-wait)]"
              : question === "attention"
                ? "divide-y divide-fail/20 rounded-lg border border-fail/35 bg-card"
                : question === "running"
                  ? "divide-y divide-border rounded-lg border border-border bg-card"
                  : "divide-y divide-border/70 rounded-lg border border-border/70"
          }
        >
          {rows}
        </ul>
      )}
    </section>
  );
}

/**
 * *What needs me* -- the laps stopped at a question, and the proposals open.
 *
 * First because it is the only part of the page an operator can act on, which
 * is `inbox`'s own argument for the same order. The button and the material it
 * would be pressed over are **here** rather than in the reading below, because
 * D-0042 makes the press this surface's presentation: what a person is shown
 * before they write has to be beside the thing they press.
 *
 * **The row being answered is hoisted to the top of its group** (D-0059 section
 * 2, second round): it opens in place into the framing, the material and the
 * press, so the one thing the view is about is the first thing on it.
 */
function waitingView(
  wording: Chrome,
  waiting: readonly IterationRecord[],
  open: readonly OpenProposal[],
  nowMs: number,
  token: string | null,
  shown: ReadonlyMap<string, Shown>,
  threads: Threads,
  actorId: string | null,
  count: number,
) {
  const asks = threads.messages.filter((message) => threads.waiting.has(message.messageId));
  const hoisted = [
    ...waiting.filter((record) => shown.has(record.id)),
    ...waiting.filter((record) => !shown.has(record.id)),
  ];
  return questionGroup("waiting", wording.waitingHeading(count), [
    ...hoisted.map((record) => {
      const framing = shown.get(record.id);
      return lapRow(
        "waiting",
        record,
        stateHead(
          wording,
          record,
          "wait",
          wording.age(ago(record.updatedAtMs, nowMs)),
          wording.waitingHead(record.status, wording.age(ago(record.updatedAtMs, nowMs))),
        ),
        [unblockedBy(wording, record), spentLine(wording, record), fenceLine(wording, record)],
        framing === undefined ? answerLink(wording, record, token) : null,
        framing === undefined ? null : approveView(wording, record, token, framing),
      );
    }),
    // **An ask in a request thread waits on the person too** (D-0061 rule 2.7,
    // #220 S1): its words, the request it was asked in, and the way to reply --
    // which lands on the thread with the reply box already pointed at it.
    ...asks.map((ask) => {
      const root = threads.rootOf(ask.messageId);
      const request = root === null ? undefined : threads.byId.get(root);
      return (
        <li id={`ask-${ask.messageId}`} data-row="" tabindex={-1} class={ROW}>
          {glyph("wait")}
          <div class="min-w-0">
            <p
              class="request line-clamp-2 text-[15px] leading-6 font-semibold wrap-anywhere"
              title={ask.body}
              lang=""
            >
              {firstLine(ask.body)}
            </p>
            {metaLine(
              <>
                <span class="head inline-flex items-center gap-2 whitespace-nowrap">
                  <span
                    class={`inline-flex shrink-0 items-center rounded-full border px-2 py-px text-[11.5px] font-medium leading-4 whitespace-nowrap ${TONE.wait}`}
                  >
                    {wording.askWaitingPill}
                  </span>
                  <span class="tabular-nums">{wording.age(ago(ask.atMs, nowMs))}</span>
                </span>
                <span>{whoWrote(wording, ask, actorId)}</span>
                {request === undefined ? null : (
                  <span class="line min-w-0 truncate" lang="">
                    {wording.askedIn(firstLine(request.body))}
                  </span>
                )}
              </>,
            )}
            <p class="mt-2">
              <a
                id={`reply-to-${ask.messageId}`}
                href={`${viewHref(
                  { kind: "thread", messageId: root ?? ask.messageId, to: ask.messageId },
                  wording.lang,
                )}#${ask.messageId}`}
                data-open=""
                class={`${PRIMARY} h-7 px-3 text-[13px]`}
              >
                {wording.openThread}
              </a>
            </p>
          </div>
        </li>
      );
    }),
    ...open.map((proposal) => (
      <li id={`proposal-${proposal.proposalId}`} data-row="" tabindex={-1} class={ROW}>
        {glyph("wait")}
        <div class="min-w-0">
          <p class="head text-[15px] leading-6 font-semibold wrap-anywhere">
            {wording.proposalHead(proposal.kind, wording.age(ago(proposal.createdAtMs, nowMs)))}
          </p>
          {metaLine(
            <>
              <span class="line wrap-anywhere">{wording.aboutIteration(proposal.iterationId)}</span>
              <span class="basis font-mono text-[11.5px] wrap-anywhere text-faint">
                {wording.proposalBasis(proposal.proposalId)}
              </span>
            </>,
          )}
        </div>
        <div class={META}>
          <p>{proposal.proposalId}</p>
        </div>
      </li>
    )),
  ]);
}

/**
 * *What needs attention* -- a live row rondo cannot read (the S1 design pass on
 * #220).
 *
 * **Its own group, with a sentence a person can act on.** Under *running* it was
 * the loudest thing on the page -- a raw decode error in red mono under an id
 * for a title -- and said nothing a reader could do. It still holds a slot, so it
 * is still on the screen: a human title, one line saying what broke and what to
 * do, and the reason itself byte for byte inside a fold (and in the reading's own
 * section for the row).
 */
function attentionView(wording: Chrome, unreadable: readonly LiveRow[]) {
  const rows = unreadable.flatMap((row) => (row.kind === "unreadable" ? [row] : []));
  if (rows.length === 0) {
    return null;
  }
  return questionGroup(
    "attention",
    wording.attentionHeading(rows.length),
    rows.map((row) => (
      <li id={`unreadable-${row.id}`} data-row="" tabindex={-1} class={ROW}>
        {glyph("alert")}
        <div class="min-w-0">
          <p class="head text-sm leading-6 font-semibold">{wording.unreadableTitle}</p>
          <p class="line text-[12.5px] leading-5 text-muted-foreground">
            {wording.unreadableAction(row.id)}
          </p>
          <details id={`unreadable-reason-${row.id}`} class="group mt-1">
            <summary class="cursor-pointer text-[12px] leading-5 text-faint select-none hover:text-foreground">
              {wording.unreadableDetail}
            </summary>
            <p class="basis mt-1 font-mono text-[11px] leading-4 wrap-anywhere text-faint">
              {wording.willNotDecode(row.reason)}
            </p>
          </details>
        </div>
        <div class={META}>
          <p>{row.id}</p>
        </div>
      </li>
    )),
  );
}

/**
 * *What is running* -- every live lap that is not waiting on anybody.
 *
 * The line under each is {@link whereItRuns}: the transcript directory continuo
 * is writing into and the workspace to `ls`. That is what rondo holds about a
 * lap in flight -- it names a place and claims no liveness (D-0048 rule 3) --
 * and it is what an operator asking *is this progressing* can actually open.
 *
 * A live row that will not decode is not here but in {@link attentionView},
 * above: it is on the page rather than missing, and it is the one row nobody can
 * read, so it is not counted among the laps that are running.
 */
function runningView(
  wording: Chrome,
  running: readonly IterationRecord[],
  transcripts: ReadonlyMap<string, TranscriptLocation>,
  nowMs: number,
) {
  return questionGroup("running", wording.runningHeading(running.length), [
    ...running.map((record) =>
      lapRow(
        "running",
        record,
        stateHead(
          wording,
          record,
          "run",
          wording.age(ago(record.updatedAtMs, nowMs)),
          wording.runningHead(record.status, wording.age(ago(record.updatedAtMs, nowMs))),
        ),
        [
          runsWhere(wording, record, transcripts.get(record.id)),
          spentLine(wording, record),
          fenceLine(wording, record),
        ],
      ),
    ),
  ]);
}

/**
 * {@link whereItRuns}, with the workspace kept whole as one unit: at a narrow
 * width a wrapped `in` with its path cut off below was a stray word. The bytes
 * are the catalogue's; only the span boundary is this function's.
 */
function runsWhere(
  wording: Chrome,
  record: IterationRecord,
  located: TranscriptLocation | undefined,
) {
  const whole = whereItRuns(wording, record, located);
  const place = wording.runsIn("", record.workspace ?? wording.noWorkspace);
  if (!whole.endsWith(place)) {
    return whole;
  }
  const gap = /^\s*/.exec(place)?.[0] ?? "";
  return (
    <span class="line min-w-0 wrap-anywhere whitespace-pre-wrap">
      {whole.slice(0, whole.length - place.length)}
      {gap}
      <span
        class="inline-block max-w-full overflow-hidden align-bottom text-ellipsis whitespace-pre"
        title={place.slice(gap.length)}
      >
        {place.slice(gap.length)}
      </span>
    </span>
  );
}

/** *What just finished* -- the last few endings, newest first (rondo#145). */
function endedView(wording: Chrome, ended: readonly IterationRecord[], nowMs: number) {
  return questionGroup(
    "ended",
    wording.endedHeading(ended.length),
    ended.map((record) =>
      lapRow(
        "ended",
        record,
        stateHead(
          wording,
          record,
          endedTone(record),
          wording.endedAgo(wording.age(ago(record.updatedAtMs, nowMs))),
          endedHow(wording, record, nowMs),
        ),
        [
          // The pill already says a closed lap's answer; anything else it ended on is a line.
          record.status === "closed" && record.gateOutcome !== null
            ? null
            : endedWhy(wording, record),
          spentLine(wording, record),
          fenceLine(wording, record),
        ],
      ),
    ),
  );
}

/**
 * The one line an idle store gets, in place of nine ways of saying zero
 * (rondo#145).
 *
 * **Its basis is the reading below, and the reading is on this page.** The
 * three questions are answered off two reads -- every live row and every ended
 * row -- and the locators for what those reads found (`snapshot /laps`,
 * `snapshot /refusals`, and the rest) are in the fold, cited there exactly as
 * they were before. So nothing is asserted here without a basis; what changed
 * is that the basis is cited once for the three claims instead of once per
 * phrasing of zero.
 */
function nothingView(wording: Chrome) {
  return (
    <section
      data-question="idle"
      class="flex gap-3 rounded-lg border border-dashed border-border px-5 py-6"
    >
      {glyph("ok")}
      <div class="space-y-1">
        <p class="nothing text-base leading-6 font-medium">{wording.nothingAtAll}</p>
        <p class="basis font-mono text-[11.5px] leading-5 text-faint">{wording.nothingBasis}</p>
      </div>
    </section>
  );
}

/**
 * One section of the reading: a heading, the note that says what reading it
 * does not do, and its body.
 *
 * **One fold per section, one line when shut** (the third design pass on #220):
 * eleven claim tables drawn open made an 11,000-pixel page nobody could scan.
 * The server always renders the fold shut (D-0059 section 5a) and the whole
 * body is still in the document; the key script re-opens what a person opened
 * after each in-place swap, and with script off `page/app.css` draws every fold
 * open, because the `<noscript>` refresh would shut one within five seconds.
 * The `<summary>` is the `j`/`k` stop, and `Enter` on it is the browser's own
 * toggle. `lead` is what the shut line shows beside the heading.
 */
function readingSection(
  heading: string,
  note: string,
  body: unknown,
  id: string,
  lead: unknown = null,
) {
  return (
    <details id={id} class="group rounded-lg border border-border bg-card">
      <summary
        id={`${id}-summary`}
        data-row=""
        class="flex cursor-pointer list-none items-center gap-3 rounded-lg px-4 py-2.5 outline-none select-none hover:bg-accent focus-visible:bg-accent focus-visible:shadow-[inset_3px_0_0_var(--color-ring)] sm:px-5 [&::-webkit-details-marker]:hidden"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-3.5 shrink-0 text-faint transition-transform group-open:rotate-90"
        >
          <path d="m6 3.5 4.5 4.5L6 12.5" />
        </svg>
        <h2 class="shrink-0 text-sm leading-6 font-semibold">{heading}</h2>
        {lead}
      </summary>
      <div class="space-y-3 border-t border-border px-4 py-4 sm:px-5">
        {note === "" ? null : (
          <p class="note text-[13px] leading-5 text-muted-foreground">{note}</p>
        )}
        {body}
      </div>
    </details>
  );
}

/** A block of lines read as columns, which may scroll sideways rather than rewrap. */
const PRE =
  "overflow-x-auto rounded-md border border-border bg-muted/50 p-3 font-mono text-[12px] leading-5 whitespace-pre";

/** The inbox section: the same lines `rondo inbox` prints, and no mark moved. */
function inboxView(ports: WebPorts, wording: Chrome, snapshot: InboxSnapshot | null) {
  if (snapshot === null || ports.actorId === null) {
    return readingSection(wording.inboxHeading, wording.inboxNoApprover, null, "reading-inbox");
  }
  return readingSection(
    wording.inboxHeading,
    wording.inboxNote,
    <pre class={PRE}>{inboxLines(wording, ports.actorId, snapshot).join("\n")}</pre>,
    "reading-inbox",
  );
}

/** The between-laps section: `rondo between`'s composition, unrecorded. */
function betweenView(wording: Chrome, snapshot: HostSnapshot) {
  return readingSection(
    wording.betweenHeading,
    wording.betweenNote,
    claimsView(proposeHost(snapshot).payload.claims, snapshot),
    "reading-between",
  );
}

/** Whether a row carries a question this page can put a button under. */
function answerable(record: IterationRecord, token: string | null): token is string {
  return token !== null && record.status === "awaiting_human" && record.gateId !== null;
}

/**
 * The press, drawn only where there is something for it to answer.
 *
 * Three conditions, and each is a different way of not having a question in
 * front of a person: no write port (nobody to act as), a status that is not
 * `awaiting_human` (nothing is asking), or no gate id on the row (the status
 * says a gate is open and the row does not name one, which `answer` refuses
 * too). A button drawn anyway would be one that fails when pressed.
 *
 * **The framing first and the button in a bar that stays in reach** (D-0059
 * section 2): the form sticks to the bottom of the window for as long as the
 * framing it answers is on screen, so a 21-claim table never puts `approve`
 * below the fold -- and it is still after every claim in the document, so a
 * reader without CSS meets the press where it always was.
 *
 * **A native form, and nothing else can press it** (D-0059 section 5): no
 * `hx-post`, no script, a real `<button type="submit">`. `method="post"` is not
 * decoration: the refresh is a `GET`, and this form is the only thing on the
 * page that can produce anything else -- and only a person's click produces the
 * `Sec-Fetch-User: ?1` the press is minted from.
 */
function approveView(
  wording: Chrome,
  record: IterationRecord,
  token: string | null,
  framing: Shown,
) {
  if (!answerable(record, token) || record.gateId === null) {
    return null;
  }
  const known = framing.claims.filter((claim) => claim.value !== UNDETERMINED);
  const unknown = framing.claims.filter((claim) => claim.value === UNDETERMINED);
  return (
    <div id="answering" class="mt-3 space-y-3">
      <p class="note text-[13px] leading-5 text-muted-foreground">{wording.pressNote}</p>
      {/*
       * **The claims that carry a value first, the undetermined ones in one
       * fold** (the third design pass on #220). Folded is not dropped: the fold
       * and every claim in it are in the document (D-0042), and with script
       * off `page/app.css` draws it open.
       */}
      {known.length === 0 ? null : claimsView(known, framing.snapshot, true)}
      {unknown.length === 0 ? null : (
        <details id="undetermined" class="group rounded-md border border-border">
          <summary
            data-row=""
            class="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-[12.5px] leading-5 text-muted-foreground outline-none select-none hover:bg-accent focus-visible:bg-accent focus-visible:shadow-[inset_3px_0_0_var(--color-ring)] [&::-webkit-details-marker]:hidden"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="size-3.5 shrink-0 text-faint transition-transform group-open:rotate-90"
            >
              <path d="m6 3.5 4.5 4.5L6 12.5" />
            </svg>
            {wording.undeterminedFold(unknown.length)}
          </summary>
          <div class="border-t border-border [&>div]:rounded-none [&>div]:border-0">
            {claimsView(unknown, framing.snapshot, true)}
          </div>
        </details>
      )}
      {framing.material === null ? null : (
        <pre
          class="material overflow-x-auto rounded-md border border-border bg-muted/50 p-3 font-mono text-[12px] leading-5 wrap-anywhere whitespace-pre-wrap"
          lang={materialLanguage(record)}
        >
          {framing.material}
        </pre>
      )}
      <form
        method="post"
        action={viewHref({ kind: "summary" }, wording.lang)}
        // A solid bar with a rule and a lift on top, so where it overlaps the
        // claims it reads as the window's footer and not as a row of the
        // table; full width under `sm`, where it is the bottom sheet. The lift
        // is shallow and the material ends a gap above it, so where the bar
        // rests at the end of the framing it covers nothing.
        class="sticky bottom-0 z-[1] -mx-4 mt-5 flex flex-col gap-2 border-t border-border bg-card px-4 py-3 shadow-[0_-4px_10px_-8px_rgb(0_0_0/0.3)] sm:flex-row sm:items-center sm:gap-3"
      >
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="iteration" value={record.id} />
        {/*
         * The last `j`/`k` stop, by focus alone: moving to the button presses
         * nothing, and `Enter` on it is the browser's own activation of a
         * native submit -- a person's key, which is what mints a press.
         */}
        <button
          type="submit"
          data-row=""
          class={`${PRIMARY} h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto`}
        >
          {APPROVE_BODY}
        </button>
        <span
          class="note min-w-0 text-[13px] leading-5 text-muted-foreground"
          title={wording.approveNote(record.gateId, APPROVE_BODY)}
        >
          {wording.approvePlain}
        </span>
      </form>
    </div>
  );
}

/**
 * The way to the button, drawn on exactly the rows that would have one.
 *
 * The conditions are {@link approveView}'s, so a link is never offered into a
 * view that would refuse to draw a button. **A short filled call to action with
 * the longer sentence beside it** (section 2's shared gap): the button says what
 * to do and the sentence says what the second address adds, because *answer* on
 * its own would read as though the press were here. `data-open` is what `Enter`
 * follows from a focused row.
 */
function answerLink(wording: Chrome, record: IterationRecord, token: string | null) {
  if (!answerable(record, token)) {
    return null;
  }
  return (
    <p class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
      {/* An `id` because a keyboard reader tabbed here keeps focus across the
          refresh only through one: htmx restores focus by the old element's id. */}
      <a
        id={`answer-${record.id}`}
        href={viewHref({ kind: "answer", iterationId: record.id }, wording.lang)}
        data-open=""
        class={`${PRIMARY} h-7 px-3 text-[13px]`}
        // **One verb per card, no helper prose beside it** (the S1 design
        // pass): every waiting row is title, one meta line, one action, and
        // what the second address adds is the pointer's `title`.
        title={wording.answerHere}
      >
        {wording.answerAction}
      </a>
    </p>
  );
}

/** One iteration, explained the way `rondo explain` explains it. */
function explainView(wording: Chrome, record: IterationRecord, snapshot: AdvisorySnapshot) {
  return readingSection(
    wording.iterationHeading(record.id),
    wording.explainNote,
    claimsView(propose(snapshot).payload.claims, snapshot),
    `read-${record.id}`,
    <>
      {glyph(statusTone(record))}
      <span
        class="min-w-0 truncate text-[13px] leading-6 text-muted-foreground"
        lang={materialLanguage(record)}
      >
        {record.request}
      </span>
    </>,
  );
}

/** What a press on one row would be recorded as having shown, composed for that row. */
interface Shown {
  readonly claims: readonly Claim[];
  readonly snapshot: AdvisorySnapshot;
  readonly material: string | null;
}

/**
 * What a press would be recorded as having shown, for the rows that carry a
 * button (D-0042 rules 1 and 4).
 *
 * **The ledger row a press writes is `explainIteration`'s whole proposal**, and
 * it is counted as presented. So the whole of it has to be on the page beside
 * the button, or rondo would be recording a framing the operator was never
 * shown -- the one thing the fold must not cost. The three questions above are
 * a summary and this is not: it is every claim under its own basis, the same
 * bytes the press stores, drawn where the press is.
 *
 * **It is composed for one row, and only on the view that is about that row.**
 * The summary links here rather than carrying this: the material shells out to
 * `git` in the caller and the framing reads the row's readings, so a page that
 * redraws every five seconds must do neither for a row nobody is answering --
 * and a summary carrying two dozen claims per waiting row is the screen
 * rondo#145 is about. A row that has left its gate since the link was drawn
 * composes nothing here and so draws no button, which is the same refusal
 * `rondo answer` makes.
 */
async function shownBeforePress(
  ports: WebPorts,
  wording: Chrome,
  waiting: readonly IterationRecord[],
  token: string | null,
  view: PageView,
): Promise<ReadonlyMap<string, Shown>> {
  const shown = new Map<string, Shown>();
  if (view.kind !== "answer") {
    return shown;
  }
  for (const record of waiting) {
    if (record.id !== view.iterationId || !answerable(record, token)) {
      continue;
    }
    const snapshot = gather(record, await ports.store.readingsFor(record.id));
    // The set this request resolved to and not the host's (D-0056 rule 12):
    // the fence block's standing sentences are inside these lines.
    const material =
      ports.material === null ? null : (await ports.material(wording, record)).join("\n");
    shown.set(record.id, {
      claims: propose(snapshot).payload.claims,
      snapshot,
      material,
    });
  }
  return shown;
}

/**
 * The laps that have ended, newest first and only the last few (rondo#145).
 *
 * **An ended row that will not decode is dropped here and nowhere else.** The
 * live side shows one, because it holds a slot and understating what is running
 * misleads the one reader deciding whether to start something else; an ended row
 * holds nothing and asks nothing, and it has no `updated_at_ms` to place in a
 * "just finished" list at all. It stays in the ledger and `rondo explain` still
 * refuses it by name.
 */
function endedRecently(outcomes: readonly ReadOutcome[]): readonly IterationRecord[] {
  return outcomes
    .flatMap((outcome) => (outcome.kind === "read" ? [outcome.record] : []))
    .sort((left, right) => right.updatedAtMs - left.updatedAtMs)
    .slice(0, RECENT_ENDED);
}

/**
 * The request threads as the page reads them (D-0061 rule 2), with the two
 * facts every thread view needs derived once per render: which request a
 * message belongs to, and which asks still wait on the person.
 *
 * **An ask waits while nothing replies to it**, which is rule 2.7's own
 * definition and the one `openAsksIn` queries -- read here off the same rows
 * rather than asked once per request, because the page draws every thread.
 */
interface Threads {
  readonly messages: readonly ThreadMessageDraft[];
  readonly byId: ReadonlyMap<string, ThreadMessageDraft>;
  readonly rootOf: (messageId: string) => string | null;
  readonly waiting: ReadonlySet<string>;
}

function threadsOf(messages: readonly ThreadMessageDraft[]): Threads {
  const byId = new Map(messages.map((message) => [message.messageId, message]));
  const replied = new Set(messages.flatMap((message) => message.inReplyTo ?? []));
  // ponytail: a walk per message per render, which is O(messages x depth); a
  // thread is a conversation's worth of rows. A `root` column is the upgrade.
  const rootOf = (messageId: string): string | null => {
    let at = byId.get(messageId);
    const seen = new Set<string>();
    while (at !== undefined && at.inReplyTo !== null && !seen.has(at.messageId)) {
      seen.add(at.messageId);
      at = byId.get(at.inReplyTo);
    }
    return at?.inReplyTo === null ? at.messageId : null;
  };
  return {
    messages,
    byId,
    rootOf,
    waiting: new Set(
      messages
        .filter((message) => message.asks && !replied.has(message.messageId))
        .map((message) => message.messageId),
    ),
  };
}

/** The first line of a message that says anything, for a chip or a list row. */
function firstLine(body: string): string {
  return body.split("\n").find((line) => line.trim() !== "") ?? body;
}

/** Who wrote a message, as a person reads it: their own messages are "you". */
function whoWrote(wording: Chrome, message: ThreadMessageDraft, actorId: string | null): string {
  return message.authorKind === "operator" && message.authorId === actorId
    ? wording.you
    : message.authorId;
}

/** A locator drawn as a chip: quiet, one line, the whole of it in `title`. */
const CHIP =
  "inline-flex max-w-full min-w-0 items-center gap-1 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[11px] leading-4 text-muted-foreground";

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
function basisChip(
  wording: Chrome,
  basis: Readonly<Record<string, unknown>>,
  threads: Threads,
  root: string | null,
  actorId: string | null,
) {
  const form = basis["form"];
  let label: string;
  let href: string | null = null;
  if (form === "message" && typeof basis["messageId"] === "string") {
    const cited = threads.byId.get(basis["messageId"]);
    label =
      cited === undefined
        ? basisLine({ form: "message", messageId: basis["messageId"] }, {})
        : `${whoWrote(wording, cited, actorId)}: ${firstLine(cited.body)}`;
    if (cited !== undefined) {
      href =
        threads.rootOf(cited.messageId) === root
          ? `#${cited.messageId}`
          : `${viewHref({ kind: "thread", messageId: cited.messageId, to: null }, wording.lang)}#${cited.messageId}`;
    }
  } else if (form === "iteration" && typeof basis["iterationId"] === "string") {
    label = basisLine({ form: "iteration", iterationId: basis["iterationId"] }, {});
    href = `${viewHref({ kind: "reading" }, wording.lang)}#read-${basis["iterationId"]}`;
  } else if (form === "snapshot") {
    label = `snapshot ${String(basis["pointer"])}`;
  } else if ((BASIS_FORMS as readonly unknown[]).includes(form)) {
    label = basisLine(basis as unknown as Basis, {});
  } else {
    label = JSON.stringify(basis);
  }
  const text = (
    <span class={form === "message" ? "max-w-[26rem] truncate" : "truncate font-mono"}>
      {label}
    </span>
  );
  return href === null ? (
    <span class={`basis ${CHIP}`} title={label}>
      {text}
    </span>
  ) : (
    <a href={href} class={`basis ${CHIP} hover:border-ring/60 hover:text-foreground`} title={label}>
      {text}
    </a>
  );
}

/**
 * One message in a thread (D-0061 rule 2): who wrote it and in which voice, how
 * long ago, the words byte for byte with their paragraphs (rondo#90), what it
 * rests on, and -- where it asks and nothing has replied -- the one mark that
 * it waits on the person.
 *
 * **The voices are told apart three ways, none of them alone**: an initial in a
 * round mark (blue for the drafter), a badge that names the drafter's voice, and
 * a blue wash on its card. **Every card starts at the same left edge** (the S1
 * design pass on #220): leaning the voices to opposite sides made the column
 * zig-zag by 40px with nothing saying why. The id is never printed: the age is
 * the message's link to itself, and `Reply` is how a person points at it --
 * drawn on hover or focus where a pointer can hover (`page/app.css`), and always
 * with script off or on touch.
 */
function messageView(
  wording: Chrome,
  threads: Threads,
  message: ThreadMessageDraft,
  previous: ThreadMessageDraft | undefined,
  root: string,
  nowMs: number,
  actorId: string | null,
  forms: boolean,
) {
  const waiting = threads.waiting.has(message.messageId);
  const parent = message.inReplyTo === null ? undefined : threads.byId.get(message.inReplyTo);
  const drafter = message.authorKind === "drafter";
  // **The way to point the reply box here**, a navigation `GET` that writes
  // nothing, quiet in the header. On an ask still waiting it is labelled as
  // answering, because the box it points then answers on a press.
  const replyLink = (
    <a
      id={`reply-${message.messageId}`}
      href={viewHref({ kind: "thread", messageId: root, to: message.messageId }, wording.lang)}
      data-open=""
      class="reply-link rounded px-1 font-medium text-link hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {waiting ? wording.answerAskAction : wording.replyAction}
    </a>
  );
  return (
    <li
      id={message.messageId}
      data-row=""
      tabindex={-1}
      data-voice={message.authorKind}
      {...(waiting ? { "data-waiting": "" } : {})}
      class="message grid scroll-mt-28 scroll-mb-40 grid-cols-1 gap-x-3 sm:grid-cols-[1.75rem_minmax(0,1fr)] rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
    >
      <span
        aria-hidden="true"
        class={
          drafter
            ? "mt-2 hidden size-7 sm:inline-flex items-center justify-center rounded-full bg-run-wash text-[12px] font-semibold text-run-ink ring-1 ring-run/30"
            : "mt-2 hidden size-7 sm:inline-flex items-center justify-center rounded-full bg-muted text-[12px] font-semibold text-foreground ring-1 ring-border"
        }
      >
        {whoWrote(wording, message, actorId).slice(0, 1).toUpperCase()}
      </span>
      <article
        class={
          waiting
            ? "rounded-lg border border-wait/45 bg-card shadow-[inset_3px_0_0_var(--color-wait)]"
            : drafter
              ? "rounded-lg border border-run/25 bg-run-wash/40"
              : "rounded-lg border border-border bg-card"
        }
      >
        <header class="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 pt-2.5 text-[12.5px] leading-5">
          <span class="author font-semibold text-foreground">
            {whoWrote(wording, message, actorId)}
          </span>
          {drafter ? (
            <span class={`voice ${PILL} font-sans ${TONE.run}`}>{wording.drafterVoice}</span>
          ) : message.authorId === actorId ? null : (
            <span class={`voice ${PILL} font-sans ${TONE.muted}`}>{wording.operatorVoice}</span>
          )}
          {waiting ? (
            <span class={`${PILL} font-sans ${TONE.wait}`}>{wording.askWaitingPill}</span>
          ) : null}
          <a
            href={`#${message.messageId}`}
            class="text-faint tabular-nums hover:text-foreground"
            title={new Date(message.atMs).toISOString()}
          >
            {wording.age(ago(message.atMs, nowMs))}
          </a>
          <span class="flex-1" />
          {forms ? replyLink : null}
        </header>
        {/*
         * Said only where the reply is to neither the message above it nor the
         * request itself, which is what every reply is read as by default.
         */}
        {parent !== undefined &&
        parent.messageId !== previous?.messageId &&
        parent.messageId !== root ? (
          <a
            href={`#${parent.messageId}`}
            class="mx-4 mt-1 flex min-w-0 items-center gap-1.5 text-[12px] leading-5 text-muted-foreground hover:text-foreground"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="size-3.5 shrink-0 text-faint"
            >
              <path d="M3.5 2.5v5a3 3 0 0 0 3 3h6m-3-3 3 3-3 3" />
            </svg>
            <span class="truncate">
              {wording.inReplyTo(whoWrote(wording, parent, actorId), firstLine(parent.body))}
            </span>
          </a>
        ) : null}
        {/* The words as written: no trim, no reflow (D-0061 rule 2.2). Their language is unknown (D-0055 rule 8). */}
        <p
          class="body px-4 pt-1 pb-3 text-[14px] leading-6 wrap-anywhere whitespace-pre-wrap"
          lang=""
        >
          {message.body}
        </p>
        {message.bases.length === 0 ? null : (
          <div class="bases flex flex-wrap items-center gap-1.5 border-t border-border/60 px-4 py-2">
            <span class="text-[11px] font-medium text-faint">{wording.basesLabel}</span>
            {message.bases.map((basis) => basisChip(wording, basis, threads, root, actorId))}
          </div>
        )}
      </article>
    </li>
  );
}

/** Every message of the thread `messageId` belongs to, oldest first, or a line saying there is none. */
function threadView(
  wording: Chrome,
  threads: Threads,
  view: { readonly messageId: string },
  nowMs: number,
  actorId: string | null,
  forms: boolean,
) {
  const root = threads.rootOf(view.messageId);
  if (root === null) {
    return (
      <p class="note rounded-lg border border-dashed border-border px-5 py-6 text-[13px]">
        {wording.noSuchThread}
      </p>
    );
  }
  const members = threads.messages.filter((message) => threads.rootOf(message.messageId) === root);
  const request = threads.byId.get(root);
  const waitingHere = members.filter((message) => threads.waiting.has(message.messageId)).length;
  return (
    <div class="space-y-4">
      {/*
       * **The thread names itself** (the S1 design pass on #220): the request's
       * first words as its title, one state line, and a way back drawn at every
       * width -- `Esc` is a key hint, and there is none at a phone's width or
       * with script off. Sticky under the page's bar, so the title stays in
       * view down a long thread. With script off the thread does not reload
       * itself (a draft would be lost), so the header says how to see new
       * messages, where a reader looks for it.
       */}
      <header class="thread-head sticky top-12 z-[4] border-b border-border bg-background/95 py-2.5 backdrop-blur-sm">
        <div class="flex min-w-0 items-center gap-2">
          <a
            href={viewHref({ kind: "requests" }, wording.lang)}
            class="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            title={wording.backToRequests}
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
            <span class="sr-only">{wording.backToRequests}</span>
          </a>
          <h2
            class="request min-w-0 flex-1 truncate text-[15px] leading-6 font-semibold"
            title={request?.body}
            lang=""
          >
            {request === undefined ? null : firstLine(request.body)}
          </h2>
          {forms ? (
            <noscript>
              <a
                href={viewHref({ kind: "thread", messageId: root, to: null }, wording.lang)}
                class="shrink-0 text-[12.5px] font-medium text-link hover:underline"
                title={wording.threadNoReload}
              >
                {wording.reloadThread}
              </a>
            </noscript>
          ) : null}
        </div>
        <div class="ml-9 overflow-hidden">
          <p class={META_LINE}>
            {waitingHere === 0 ? null : (
              <span>
                <span class={`${PILL} font-sans ${TONE.wait}`}>{wording.askWaitingPill}</span>
              </span>
            )}
            <span>
              {wording.threadSize(
                members.length,
                wording.age(ago(Math.max(...members.map((message) => message.atMs)), nowMs)),
              )}
            </span>
            {request === undefined ? null : (
              <span>{wording.threadStarted(wording.age(ago(request.atMs, nowMs)))}</span>
            )}
          </p>
        </div>
      </header>
      <ol data-thread={root} class="space-y-4">
        {members.map((message, at) =>
          messageView(wording, threads, message, members[at - 1], root, nowMs, actorId, forms),
        )}
      </ol>
    </div>
  );
}

/**
 * Every request, the ones with an ask waiting first and then by when they last
 * moved (#220 S1). One row each: the request's first words, whose it is, how
 * big and how recent its thread is, and a pill counting what waits on the
 * person. The row's words are the link into the thread, so opening one is a
 * click or `Enter`, never an id.
 */
function requestsView(wording: Chrome, threads: Threads, nowMs: number, actorId: string | null) {
  const rows = threads.messages
    .filter((message) => message.inReplyTo === null)
    .map((root) => {
      const members = threads.messages.filter(
        (message) => threads.rootOf(message.messageId) === root.messageId,
      );
      return {
        root,
        size: members.length,
        lastMs: Math.max(...members.map((message) => message.atMs)),
        waiting: members.filter((message) => threads.waiting.has(message.messageId)).length,
      };
    })
    .sort(
      (left, right) =>
        Number(right.waiting > 0) - Number(left.waiting > 0) || right.lastMs - left.lastMs,
    );
  return (
    <section data-question="requests" class="space-y-2">
      <h2 class="text-sm leading-6 font-semibold text-foreground first-letter:uppercase">
        {wording.requestsHeading(rows.length)}
      </h2>
      {rows.length === 0 ? (
        <p class="note rounded-lg border border-dashed border-border px-5 py-6 text-[13px] text-muted-foreground">
          {wording.noRequests}
        </p>
      ) : (
        <ul class="divide-y divide-border rounded-lg border border-border bg-card">
          {rows.map((row) => (
            <li id={`request-${row.root.messageId}`} data-row="" tabindex={-1} class={ROW}>
              {glyph(row.waiting > 0 ? "wait" : "message")}
              <div class="min-w-0">
                <a
                  id={`open-${row.root.messageId}`}
                  href={viewHref(
                    { kind: "thread", messageId: row.root.messageId, to: null },
                    wording.lang,
                  )}
                  data-open=""
                  class="request line-clamp-2 text-sm leading-6 font-medium wrap-anywhere hover:underline"
                  title={row.root.body}
                  lang=""
                >
                  {firstLine(row.root.body)}
                </a>
                {metaLine(
                  <>
                    {row.waiting > 0 ? (
                      <span>
                        <span class={`${PILL} font-sans ${TONE.wait}`}>
                          {wording.asksWaiting(row.waiting)}
                        </span>
                      </span>
                    ) : null}
                    <span>{whoWrote(wording, row.root, actorId)}</span>
                    <span>{wording.threadSize(row.size, wording.age(ago(row.lastMs, nowMs)))}</span>
                  </>,
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The message a reply box answers: the one the person pointed at with `Reply`,
 * else the latest question still waiting in the thread, else the latest
 * message **the other party** wrote, else the thread's latest message.
 * `answers` is whether the target is a waiting question, which the box then
 * answers on a press (`/answer-ask`) rather than a send.
 *
 * **Not the person's own latest by default** (the S1 design pass on #220): a box
 * that read "Replying to you" under a drafter's question pointed a person at
 * their own words. A conversation answers the other side.
 */
function replyTarget(
  threads: Threads,
  view: { readonly messageId: string; readonly to: string | null },
  actorId: string | null,
): {
  readonly root: string;
  readonly target: ThreadMessageDraft;
  readonly answers: boolean;
  readonly asksWaiting: boolean;
} | null {
  const root = threads.rootOf(view.messageId);
  if (root === null) {
    return null;
  }
  const members = threads.messages.filter((message) => threads.rootOf(message.messageId) === root);
  const asks = members.filter((message) => threads.waiting.has(message.messageId));
  const pointed = view.to === null ? undefined : threads.byId.get(view.to);
  const theirs = members.filter(
    (message) => !(message.authorKind === "operator" && message.authorId === actorId),
  );
  const target =
    (pointed !== undefined && members.includes(pointed) ? pointed : undefined) ??
    asks.at(-1) ??
    theirs.at(-1) ??
    members.at(-1);
  return target === undefined
    ? null
    : {
        root,
        target,
        answers: threads.waiting.has(target.messageId),
        asksWaiting: asks.length > 0,
      };
}

/** A message id minted for one form (`newMessageId` in `src/access/web-app.ts`). */
export type MintMessageId = (kind: "request" | "reply") => string;

/**
 * The box a person writes into: a new request on `requests`, a reply on
 * `thread` (D-0061 rule 4, D-0059 section 5a's send).
 *
 * **Outside the ledger, so no redraw touches a draft.** The poll swaps
 * `#ledger`; this form is after it, and what a send must renew -- the minted
 * id, the reply's target, a refusal note -- is `#composer-fields`, which only
 * this form's own response replaces (`hx-select-oob`).
 *
 * **Two ways to send, one route.** With script off it is a native `POST` and
 * the `303` lands on the thread at the message sent. With script on a reply is
 * htmx's `hx-post`: the thread is swapped in, the box stays where it is, and
 * `page/composer.js` clears the draft. A new request stays a native submit,
 * because where it lands is a different view -- its own thread -- and a swap
 * would draw that thread under the requests' address.
 *
 * **Aimed at a waiting question, the box is a press** (#220 S1): action
 * `/answer-ask`, a native `POST` with no `hx-post` in either mode, and a filled
 * button labelled as answering. Answering an ask releases the hold D-0069
 * rule 5 puts on work, and D-0059 section 5a's falsifier says a message that
 * moves work needs a press, which only a person's navigation mints.
 *
 * **The id is minted here, at render, and carried hidden** (D-0061 rule 2.1):
 * the same form sent twice is one id, and the store refuses the second. It is
 * never printed. With no approver there is no form, and the box's place says
 * why (D-0020 rule 2).
 */
function composerView(
  wording: Chrome,
  view: PageView,
  threads: Threads,
  token: string | null,
  newId: MintMessageId | null,
  actorId: string | null,
  nowMs: number,
) {
  if (view.kind !== "requests" && view.kind !== "thread") {
    return null;
  }
  if (token === null || newId === null) {
    return (
      <p class="note rounded-md border border-border bg-muted/60 px-3 py-2 text-[13px] leading-5">
        {wording.composerNoApprover}
      </p>
    );
  }
  const replying = view.kind === "thread" ? replyTarget(threads, view, actorId) : null;
  if (view.kind === "thread" && replying === null) {
    return null;
  }
  const kind = replying === null ? "request" : "reply";
  const answers = replying?.answers === true;
  const action = `/${answers ? "answer-ask" : kind}?lang=${encodeURIComponent(wording.lang)}`;
  return (
    <form
      id="composer"
      method="post"
      action={action}
      {...(replying === null || answers
        ? {}
        : {
            "hx-post": action,
            "hx-target": "#ledger",
            "hx-select": "#ledger",
            "hx-swap": "outerHTML show:window:bottom",
            "hx-select-oob": "#composer-fields,#waiting-count",
            // **One send per press, visibly** (the S1 design pass): the button
            // is disabled while its request is in flight. The store's refusal
            // of a repeated id is still what makes a double send one message.
            "hx-disabled-elt": "find button[type='submit']",
          })}
      class={
        replying === null
          ? "rounded-xl border border-border bg-card shadow-xs focus-within:border-ring/60"
          : "sticky bottom-3 z-[5] rounded-xl sm:ml-10 border border-border bg-card shadow-[0_6px_24px_-12px_rgb(0_0_0/0.35)] focus-within:border-ring/60"
      }
    >
      {replying === null ? (
        <h2 class="px-4 pt-3 text-sm leading-6 font-semibold">{wording.newRequestHeading}</h2>
      ) : null}
      <div id="composer-fields">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="message_id" value={newId(kind)} />
        {replying === null ? null : (
          <>
            <input type="hidden" name="in_reply_to" value={replying.target.messageId} />
            <div class="mx-4 mt-2.5 flex min-w-0 items-center gap-1">
              <a
                href={`#${replying.target.messageId}`}
                class="replying flex min-w-0 items-center gap-1.5 text-[12px] leading-5 text-muted-foreground hover:text-foreground"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="size-3.5 shrink-0 text-faint"
                >
                  <path d="M3.5 2.5v5a3 3 0 0 0 3 3h6m-3-3 3 3-3 3" />
                </svg>
                <span class="truncate">
                  {(answers ? wording.answeringTo : wording.replyingTo)(
                    whoWrote(wording, replying.target, actorId),
                    wording.age(ago(replying.target.atMs, nowMs)),
                  )}
                </span>
              </a>
              {
                // **A target chosen by hand can be let go** (the S1 design
                // pass): a navigation back to the thread's default target, which
                // keeps the draft (`page/composer.js`).
                view.kind === "thread" && view.to !== null ? (
                  <a
                    href={viewHref(
                      { kind: "thread", messageId: replying.root, to: null },
                      wording.lang,
                    )}
                    class="inline-flex size-5 shrink-0 items-center justify-center rounded text-faint hover:bg-accent hover:text-foreground"
                    title={wording.replyDefault}
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      class="size-3"
                    >
                      <path d="m4 4 8 8m0-8-8 8" />
                    </svg>
                    <span class="sr-only">{wording.replyDefault}</span>
                  </a>
                ) : null
              }
            </div>
            {/*
             * **Said where the words are typed** (#220 S1 review): a person who
             * came for a question waiting in this thread would otherwise send
             * their answer to the message above and see nothing say it did not
             * reach the question (see `replyTarget`).
             */}
            {replying.asksWaiting && !answers ? (
              <p class="not-answer mx-4 mt-0.5 text-[12px] leading-5 text-faint">
                {wording.replyNotAnswer}
              </p>
            ) : null}
          </>
        )}
        {/* Where htmx puts a refusal (the page's `responseHandling`); the draft stays. */}
        <p
          id="composer-note"
          role="status"
          data-refused={wording.notSent(wording.sendRefusedUnknown)}
          class="px-4 pt-2 text-[12.5px] leading-5 text-fail empty:hidden"
        />
      </div>
      <label for="composer-body" class="sr-only">
        {replying === null
          ? wording.newRequestHeading
          : answers
            ? wording.answerAskAction
            : wording.replyAction}
      </label>
      <textarea
        id="composer-body"
        name="body"
        required
        rows={replying === null ? 4 : 3}
        placeholder={replying === null ? wording.requestPlaceholder : wording.replyPlaceholder}
        data-draft={replying === null ? "request" : `reply:${replying.root}`}
        {...(view.kind === "thread" && view.to !== null ? { autofocus: true } : {})}
        // **The box grows with the words** (the S1 design pass): at a fixed
        // two rows a three-line draft scrolled its first line out of sight
        // under the line above it. Capped, then it scrolls.
        class="block max-h-[40vh] min-h-[4.5rem] w-full resize-y bg-transparent px-4 pt-2 text-[14px] leading-6 outline-none [field-sizing:content] placeholder:text-faint"
      />
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pt-1 pb-2.5">
        <span class="note px-1 text-[11.5px] leading-5 text-faint">{wording.sendNote}</span>
        <span class="ml-auto flex items-center gap-3">
          <span class="js-only hidden items-center gap-1 text-[11.5px] text-faint sm:flex">
            {kbd("Ctrl/⌘")}
            {kbd("↵")}
            <span>{wording.keySend}</span>
          </span>
          <button
            type="submit"
            class={
              answers
                ? `${PRIMARY} h-9 px-4 text-sm`
                : "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-foreground px-4 text-sm font-semibold text-background shadow-xs outline-none hover:bg-foreground/85 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-wait disabled:opacity-60"
            }
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="size-3.5"
            >
              <path d="M8 13V3m-4 4 4-4 4 4" />
            </svg>
            {answers ? wording.answerAskAction : wording.sendAction}
          </button>
        </span>
      </div>
    </form>
  );
}

/** A key as the keyboard shows it. */
function kbd(key: string) {
  return (
    <kbd class="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-card px-1 font-mono text-xs text-muted-foreground shadow-[inset_0_-1px_0_var(--color-border)]">
      {key}
    </kbd>
  );
}

/**
 * The whole page: the three questions an operator arrives with, and then the
 * reading the answers rest on (rondo#145).
 *
 * **The order is the argument, and it is the operator's rather than rondo's.**
 * What is on the screen first is what needs them, then what is running, then
 * what just ended -- which is `inbox`'s own order carried to the surface a
 * person actually looks at, and not the order `inbox`, `between` and `explain`
 * happen to be laid out in. rondo's own vocabulary -- bounds, adjacency,
 * last-look marks, a field-by-field reading of every row -- is at a second
 * address below, unchanged and complete.
 *
 * **Folded is not hidden** (D-0032). Every claim that was on this page before
 * is still on it, under the same basis, in the same words; what moved is which
 * of them an operator has to read past to answer *does anything need me*. The
 * lead cites the row each of its lines is read off, once, and the reading below
 * cites the field -- so a number in the lead is checkable twice over rather
 * than asserted once.
 *
 * **Nothing here writes** (D-0041). Every read above is a read, the refresh and
 * the key script issue nothing but `GET`s, and the only thing on the page that
 * can produce anything but a `GET` is still the one form.
 *
 * **Server JSX, rendered to one string** (D-0059 rule 2): `hono/jsx` escapes
 * every text child and attribute, which is what the hand-written `escapeHtml`
 * did, so a request's `<b>` is still text.
 */
export async function operatorPage(
  ports: WebPorts,
  token: string | null = null,
  view: PageView = { kind: "summary" },
  // **The set this request resolved to, and not a property of the process**
  // (D-0056 rule 2). It was `ports.wording` while a host had one language for
  // the life of the server; it is an argument now because five steps decide it
  // per request and the renderer is downstream of that decision, not part of
  // it. `EN` by default for the same reason `token` and `view` have defaults:
  // a caller that has said nothing gets the page this was before.
  wording: Chrome = EN,
  /**
   * Mints the id a composer form carries (D-0061 rule 2.1), or null where
   * there is no say port: no minter, no form. Handed down by
   * `src/access/web-app.ts` for the token's reason -- the renderer holds
   * nothing that writes, and is not granted `node:crypto` either.
   */
  newId: MintMessageId | null = null,
): Promise<string> {
  const nowMs = ports.now();
  // **Read on every view**: the summary counts the asks waiting and the header
  // counts them for every view. A thread that will not read is said, never
  // drawn half (see `threadMessages`).
  const threadRead = await ports.record.threadMessages();
  const threads = threadsOf(threadRead.kind === "read" ? threadRead.messages : []);
  const forms = token !== null && newId !== null;
  const onThreads = view.kind === "requests" || view.kind === "thread";
  const host = await gatherHost(ports);
  const inbox = ports.actorId === null ? null : await gatherInbox(ports, ports.actorId);
  const live: LiveRow[] = (await ports.store.readLive()).flatMap((outcome): LiveRow[] => {
    switch (outcome.kind) {
      case "read":
        return [{ kind: "read", record: outcome.record }];
      case "unreadable":
        return [{ kind: "unreadable", id: outcome.id, reason: outcome.reason }];
      default:
        return [];
    }
  });
  const ended = endedRecently(await ports.store.terminalIterations());
  const waiting: IterationRecord[] = [];
  const running: IterationRecord[] = [];
  for (const row of live) {
    if (row.kind !== "read") {
      continue;
    }
    const side = isTerminal(row.record.status)
      ? null
      : WAIT_SIDE[row.record.status as NonTerminalStatus];
    (side === "waitingOnYou" ? waiting : running).push(row.record);
  }
  const unreadable = live.filter((row) => row.kind === "unreadable");
  // **Only the ones an answer can settle** (D-0032 rule 5). `openProposals`
  // returns every proposal nobody has decided, and an explanation is
  // undecidable by construction -- `recordDecision` refuses the non-binding
  // kinds -- so every press this page makes would leave a row here for ever and
  // the count would climb with each approval. The test is
  // {@link isApprovableKind}, the closed set the compiler checks, which is what
  // `inbox` splits on too; the rest are in the reading, in the inbox's own two
  // sections, where they are material rather than a queue.
  const open = (inbox?.open ?? []).filter((proposal) => isApprovableKind(proposal.kind));
  // Reused rather than asked again when the inbox already asked: it is a
  // continuo subprocess per running lap, and this page redraws itself.
  const transcripts = inbox?.transcripts ?? (await locateRunning(ports, live));
  // **One count of what waits on the person** (#220 S1): the header pill and the
  // summary's *waiting for your answer* heading both say this number -- gates,
  // questions in threads, and proposals an answer can settle -- so they cannot
  // disagree.
  const waitingCount = waiting.length + threads.waiting.size + open.length;

  const keepsCurrent = isLive(view);
  // **The token arrives null exactly when there is no writer** (D-0041 rule 4,
  // D-0059 rule 3a): the renderer is handed the reading ports and nothing that
  // could write, so whether a button is drawn is decided by the one caller that
  // does hold the writer (`src/access/web-app.ts`) and handed down as a token.
  const shown = await shownBeforePress(ports, wording, waiting, token, view);

  // ponytail: the thread views still gather the laps above, as the summary
  // does, on every redraw; skip those reads for them if a redraw costs.
  const readingSections =
    view.kind !== "reading"
      ? []
      : [
          inboxView(ports, wording, inbox),
          betweenView(wording, host),
          ...(await Promise.all(
            [...waiting, ...running, ...ended].map(async (record) =>
              explainView(
                wording,
                record,
                gather(record, await ports.store.readingsFor(record.id)),
              ),
            ),
          )),
          ...unreadable.map((row) =>
            row.kind === "unreadable"
              ? readingSection(
                  wording.iterationHeading(row.id),
                  "",
                  <pre class={PRE}>{wording.willNotDecode(row.reason)}</pre>,
                  `read-${row.id}`,
                  glyph("alert"),
                )
              : null,
          ),
        ];

  const here = viewHref(view, wording.lang);
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
          // and swaps the ledger in place, so the reader's scroll and focus
          // survive. The `answer` view reaches none of this: it has no refresh
          // in either mode, so there is nothing for it to degrade to.
          keepsCurrent ? (
            <>
              {
                // **Not where a person may be writing** (#220 S1): with script
                // off a reload would throw a half-written draft away, so a
                // view with a composer does not reload itself and says so.
                onThreads && forms ? null : (
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
        <title>rondo</title>
        <link rel="stylesheet" href="/app.css" />
        {
          // `defer` on both, in this order: htmx is defined before the key
          // script runs, and neither runs before the document exists. Neither
          // draws anything a person must read -- the whole document is already
          // here, rendered by the server (D-0054 rule 7).
          keepsCurrent ? <script src="/htmx.min.js" defer /> : null
        }
        <script src="/keys.js" defer />
        <script src="/composer.js" defer />
      </head>
      <body class="min-h-screen bg-background font-sans text-foreground antialiased">
        <header class="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-sm">
          <div class="mx-auto flex h-12 max-w-5xl items-center gap-3 px-4 sm:px-6">
            <h1 class="text-[15px] font-semibold tracking-tight">
              {
                // `data-back` is what `Esc` follows; on the summary there is
                // nowhere further back to go, so it is absent there, and on a
                // thread the way back is the requests link beside this.
                view.kind === "summary" || view.kind === "thread" ? (
                  <a href={here}>rondo</a>
                ) : (
                  <a href={viewHref({ kind: "summary" }, wording.lang)} data-back="">
                    rondo
                  </a>
                )
              }
            </h1>
            {/*
             * **The way into the requests, on every view** (#220 S1), and beside
             * it the count of everything waiting on the person -- the same number
             * as the summary's heading, and a link to that summary. The count is
             * its own element so a redraw can renew it out of band: the header
             * is not swapped.
             */}
            <span aria-hidden="true" class="text-faint">
              /
            </span>
            <a
              href={viewHref({ kind: "requests" }, wording.lang)}
              class={`inline-flex items-center gap-1.5 text-[13px] hover:text-foreground ${onThreads ? "font-medium text-foreground" : "text-muted-foreground"}`}
              {...(view.kind === "thread" ? { "data-back": "" } : {})}
              {...(view.kind === "requests" ? { "aria-current": "page" } : {})}
            >
              {wording.requestsNav}
            </a>
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
                    class="hidden max-w-[16rem] truncate text-[13px] text-foreground xl:inline"
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
                 */}
                <span class={`js-only ${PILL} gap-1.5 font-sans ${TONE.ok}`}>
                  <span class="size-1.5 rounded-full bg-ok motion-safe:animate-pulse" />
                  {wording.liveLabel}
                </span>
              </>
            ) : null}
            <span class="flex-1" />
            {
              // **Whose name a send and a press are recorded under** (the S1
              // design pass), in place of a sentence naming the variable.
              ports.actorId === null ? null : (
                <span
                  class="hidden items-center gap-1.5 text-[12.5px] text-muted-foreground lg:inline-flex"
                  title={wording.signedInAs(ports.actorId)}
                >
                  <span class="inline-flex size-5 items-center justify-center rounded-full bg-muted text-[10.5px] font-semibold text-foreground ring-1 ring-border">
                    {ports.actorId.slice(0, 1).toUpperCase()}
                  </span>
                  {ports.actorId}
                </span>
              )
            }
            <span class="js-only hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              {
                // Each view names only the keys that do something on it: the
                // answer view's rows (its claim groups and the press) have no
                // link to open, and the summary has nowhere to go back to.
                <>
                  {kbd("j")}
                  {kbd("k")}
                  <span class="mr-2">{wording.keyMove}</span>
                  {view.kind === "answer" ? null : (
                    <>
                      {kbd("↵")}
                      <span class="mr-2">{wording.keyOpen}</span>
                    </>
                  )}
                </>
              }
              {view.kind === "summary" ? null : (
                <>
                  {kbd("esc")}
                  <span class="mr-2">{wording.keyBack}</span>
                  {onThreads && forms ? (
                    <>
                      {kbd("r")}
                      <span class="ml-0.5">{wording.keyWrite}</span>
                    </>
                  ) : null}
                </>
              )}
            </span>
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
              // Muted, so the one thing in the header in colour is the live state.
              <nav class="switch flex shrink-0 gap-3 whitespace-nowrap text-[13px] text-muted-foreground [&>a]:hover:text-foreground [&>a]:hover:underline">
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
        <main class="mx-auto max-w-5xl space-y-6 px-4 pt-6 pb-12 sm:px-6">
          {
            // **Said on the visible page and not only in the reading.** With no
            // approver there is no write port and so no button anywhere, and a
            // page that explained that only inside the fold would leave an
            // operator looking for a button that is missing for a reason rondo
            // knows and did not say (D-0020 rule 2).
            ports.actorId === null ? (
              <p class="note rounded-md border border-border bg-muted/60 px-3 py-2 text-[13px] leading-5">
                {wording.noApproverNote}
              </p>
            ) : null
          }
          {threadRead.kind === "unreadable" ? (
            <p class="note rounded-md border border-fail/40 px-3 py-2 text-[13px] leading-5 text-fail">
              {wording.threadsUnreadable(threadRead.reason)}
            </p>
          ) : null}
          {view.kind === "requests"
            ? composerView(wording, view, threads, token, newId, ports.actorId, nowMs)
            : null}
          {
            // **The ledger is what the refresh swaps**, and only on a live
            // view: htmx `GET`s this view's own address every five seconds and
            // takes `#ledger` out of the document that comes back. There is no
            // fragment endpoint -- the response is the whole page a navigating
            // browser gets (D-0054 rule 2) -- so there is no second rendering
            // of anything to keep true.
            <div
              id="ledger"
              class="space-y-8"
              {...(keepsCurrent
                ? {
                    "hx-get": here,
                    "hx-trigger": "every 5s",
                    "hx-select": "#ledger",
                    "hx-swap": "outerHTML",
                    "hx-select-oob": "#waiting-count",
                  }
                : {})}
            >
              {view.kind === "requests" ? (
                requestsView(wording, threads, nowMs, ports.actorId)
              ) : view.kind === "thread" ? (
                threadView(wording, threads, view, nowMs, ports.actorId, forms)
              ) : waiting.length +
                  running.length +
                  ended.length +
                  open.length +
                  unreadable.length +
                  threads.waiting.size ===
                0 ? (
                nothingView(wording)
              ) : (
                <>
                  {waitingView(
                    wording,
                    waiting,
                    open,
                    nowMs,
                    token,
                    shown,
                    threads,
                    ports.actorId,
                    waitingCount,
                  )}
                  {attentionView(wording, unreadable)}
                  {runningView(wording, running, transcripts, nowMs)}
                  {endedView(wording, ended, nowMs)}
                </>
              )}
              {onThreads ? null : (
                <p id="fold" class="border-t border-border pt-4 text-[13px]">
                  <a
                    id="fold-link"
                    href={viewHref(
                      view.kind === "reading" ? { kind: "summary" } : { kind: "reading" },
                      wording.lang,
                    )}
                    class="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    {...(view.kind === "reading" ? { "data-back": "" } : {})}
                  >
                    {view.kind === "reading" ? wording.hideReading : wording.openReading}
                  </a>
                </p>
              )}
              {
                // **The fold and the reading are inside the swap too**: on
                // `?reading=open` they are drawn from the same ledger, and a
                // reading left outside `#ledger` would stay at first load
                // under a note that says the view redraws.
                readingSections.length === 0 ? null : (
                  <div id="reading" class="space-y-2">
                    {readingSections}
                  </div>
                )
              }
            </div>
          }
          {view.kind === "thread"
            ? composerView(wording, view, threads, token, newId, ports.actorId, nowMs)
            : null}
          {
            // **Each view says which of the two it is**, because "redraws every
            // 5s" on a view that does not would be the page's own copy lying
            // about the one property D-0054 rule 1 spends itself on. Both say
            // the same thing about writing, which is the fact that did not
            // change: a read writes nothing, whoever or whatever issued it.
            // At the foot rather than the head (the design pass on #220): it is
            // the page's account of itself, and what needs the reader leads.
            // **One short line, and the account in its `title`** (the S1 design
            // pass): the sentences are the page's account of itself for the
            // reader who asks, not prose every reader has to read past.
            <p class="note max-w-3xl text-[11.5px] leading-5 text-faint">
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
                  // script off nothing redraws in place, and a thread with a box
                  // does not reload at all, so "live" would be false there.
                  keepsCurrent ? (
                    <span class="js-only">{wording.liveShort(REFRESH_SECONDS)}</span>
                  ) : (
                    wording.stillShort
                  )
                }
              </span>
            </p>
          }
          {onThreads && forms && view.kind === "requests" ? (
            <noscript>
              <p class="note max-w-3xl text-[11.5px] leading-5 text-faint">
                {wording.threadNoReload}
              </p>
            </noscript>
          ) : null}
        </main>
      </body>
    </html>
  );
  return `<!doctype html>\n${await page.toString()}\n`;
}
