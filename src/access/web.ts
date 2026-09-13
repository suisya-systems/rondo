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
 * what the pair guarantees.** Two of the three views now carry a script that
 * `GET`s its own address every five seconds and morphs the result in place
 * ({@link isLive}), so *"nothing here can emit a `POST`"* has stopped being
 * true of this page. What still holds -- and what D-0042's invariant now rests
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
 */
import { parseAccept } from "hono/utils/accept";
import {
  type AdvisorySnapshot,
  type Claim,
  type HostSnapshot,
  propose,
  proposeHost,
} from "../advisory/proposal.js";
import type { HostPolicy } from "../refrain/policy.js";
import {
  type IterationRecord,
  isApprovableKind,
  isTerminal,
  type NonTerminalStatus,
  type OpenProposal,
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
  readonly record: InboxReadPorts["record"] & Pick<AdvisoryRecord, "admissionRefusals">;
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

/**
 * The page's stylesheet, as the exact bytes between `<style>` and `</style>`.
 *
 * **A constant so that its digest can be the policy** (D-0059 rule 6, R4's
 * `default-src 'self'`). The server's CSP admits this one inline block by its
 * `sha256` and no other inline style, which keeps `style-src` from needing
 * `'unsafe-inline'` while the views are still this module's hand-written
 * markup. It goes when the views move onto the built `app.css`.
 */
export const PAGE_STYLE = `/* A ledger read by one person many times a day, so: two type roles, one spacing
   scale, and three states that do not weigh the same.

   Both palettes are written out rather than inherited. color-scheme is kept
   so the button and the scrollbars follow the reader's setting, but every
   surface, rule and ink below is a token declared in both modes -- a page that
   leaned on the user-agent defaults would have its contrast decided elsewhere,
   and the one thing this screen has to hold is that 'waiting' reads as waiting
   from across a room. */
:root {
  color-scheme: light dark;
  /* Space is a scale, not a per-element decision (rondo#153). */
  --s1: .25rem; --s2: .5rem; --s3: .75rem; --s4: 1.25rem; --s5: 2rem;
  /* Values are monospace because they are a ledger and columns must line up;
     headings, notes and labels are not, because they are prose about it. */
  /* The tertiary ink is the floor: it carries the basis lines, the claim
     labels and an ended lap's own request, which are text a person reads
     rather than decoration. Both values clear 4.5:1 against all three grounds
     they land on -- page, section surface and the waiting wash -- so recessive
     is a step down in weight and never a step below legible. */
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --sans: ui-sans-serif, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --bg: #eceef1;
  --surface: #fbfcfd;
  --ink: #14181c;
  --ink-2: #4b545d;
  --ink-3: #646d77;
  --rule: #d2d8de;
  --link: #0f5480;
  --wait-edge: #b26206;
  --wait-ink: #8a4b04;
  --wait-wash: #fbf1e0;
  --wait-press: #a75c06;
  --wait-press-ink: #fffaf3;
  --run-edge: #2a79ad;
  --run-ink: #1b5a83;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f1214;
    --surface: #171b1f;
    --ink: #e3e7ea;
    --ink-2: #a2abb3;
    --ink-3: #848e97;
    --rule: #292f35;
    --link: #6cb2e6;
    --wait-edge: #d18e2f;
    --wait-ink: #e9b25f;
    --wait-wash: #221a0d;
    --wait-press: #d18e2f;
    --wait-press-ink: #17130c;
    --run-edge: #3d86bb;
    --run-ink: #7dbce5;
  }
}
body { background: var(--bg); color: var(--ink);
  font: 14px/1.55 var(--mono); margin: 0 auto; max-width: 64rem;
  padding: var(--s5) var(--s4); }
/* Every block starts at zero and the scale puts it back, so no two margins
   stack and nothing carries a spacing decision of its own. */
h1, h2, p, pre, form { margin: 0; }
body > * + * { margin-top: var(--s4); }
h1 { color: var(--ink-3); font: 600 .75rem/1 var(--sans); letter-spacing: .16em;
  text-transform: uppercase; }
h2 { color: var(--ink-2); font: 600 .95rem/1.3 var(--sans); margin: 0 0 var(--s3); }
section { background: var(--surface); border-left: 3px solid var(--rule);
  padding: var(--s3) var(--s4); }
section + section { margin-top: var(--s3); }
a { color: var(--link); text-underline-offset: .2em; }
pre { white-space: pre-wrap; word-break: break-word; margin: 0; }
.note, .basis, .label { color: var(--ink-3); font-family: var(--sans); }
.note { color: var(--ink-2); font-size: .8125rem; }
.basis { font-size: .75rem; }
.group { border-left: 2px solid var(--rule); padding-left: var(--s3); }
.group + .group { margin-top: var(--s3); }
.lap > * + *, .group > * + * { margin-top: var(--s1); }
/* Laps are separated by a hairline rather than each carrying a rule of its own:
   the section's own edge already says which question they answer. */
.lap + .lap { border-top: 1px solid var(--rule); margin-top: var(--s3);
  padding-top: var(--s3); }
.head { font-weight: 600; }
.request, .line, .value { white-space: pre-wrap; word-break: break-word; }
.line { color: var(--ink-2); font-size: .8125rem; }
.claim { display: grid; grid-template-columns: minmax(9rem, 14rem) 1fr; gap: var(--s3); }
.label { font-size: .8125rem; }
pre, .material { background: var(--bg); border: 1px solid var(--rule);
  font-size: .8125rem; padding: var(--s2) var(--s3); }
.material { margin-top: var(--s3); }

/* *What needs me* is the only part of this page anybody can act on, so it is
   the only part that is allowed to shout: its own wash, a heavier edge, the
   request set a size larger, and the one button on the page. */
.waiting { background: var(--wait-wash); border-left: 4px solid var(--wait-edge); }
.waiting h2 { color: var(--wait-ink); font-size: 1.05rem; font-weight: 700; }
.waiting .head { color: var(--wait-ink); font-size: .9375rem; }
.waiting .request { font-size: .9375rem; }
.waiting .lap + .lap { border-top-color: var(--wait-edge); }
.running { border-left-color: var(--run-edge); }
.running h2 { color: var(--run-ink); }
/* An ended lap is over: it is on the page to be checked against, not read, so
   it recedes to the page's own ground and to secondary ink. (No section's own
   heading text is spelled in this stylesheet -- the lead is found by position
   on the page, and a comment naming one would be found first.) */
.ended { background: none; }
.ended h2, .ended .head, .ended .request { color: var(--ink-3); }
.ended .head { font-weight: 500; }
.idle { border-left-color: var(--rule); }
.nothing { color: var(--ink-2); font-family: var(--sans); font-size: 1rem; }

.approve { align-items: center; display: flex; flex-wrap: wrap; gap: var(--s3);
  margin-top: var(--s4); }
.approve button { background: var(--wait-press); border: 0; color: var(--wait-press-ink);
  cursor: pointer; font: 600 .875rem var(--sans); letter-spacing: .04em;
  padding: .55rem 1.75rem; }
.approve button:hover { filter: brightness(1.08); }
:focus-visible { outline: 2px solid var(--wait-edge); outline-offset: 2px; }
.fold { border-top: 1px solid var(--rule); font-family: var(--sans);
  font-size: .8125rem; margin-top: var(--s5); padding-top: var(--s3); }
/* The switch sits with the fold's link and reads as the same kind of thing: the
   two ways off this screen, in the same type at the same size (D-0056 rule 10).
   No second rule above it -- one line separates the chrome from the ledger, and
   a second would make the switch a footer of its own. */
.switch { font-family: var(--sans); font-size: .8125rem; margin-top: var(--s2); }
@media (max-width: 40rem) {
  body { padding: var(--s4) var(--s3); }
  section { padding: var(--s3); }
  .claim { grid-template-columns: 1fr; gap: 0; }
}
`;

/** How often a live view redraws itself, in seconds. Matches `page/poll.js`. */
const REFRESH_SECONDS = 5;

/**
 * Which of the one page's three views is being read.
 *
 * **The whole of this surface's state is in the address**, which is what makes
 * it survivable: the view is a query the server reads, so every redraw --
 * the `<noscript>` refresh, or the script's own `GET` -- asks for the view
 * being read and is answered with it. A view outlives every redraw because the
 * server is the one holding it, and not because a client remembered anything;
 * D-0054 adds a script and deliberately does not add client state or a router.
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
  | { readonly kind: "answer"; readonly iterationId: string };

/**
 * Whether this view keeps itself current, which is a property of the view and
 * never of the page (D-0054 rule 1).
 *
 * `summary` and `reading` are *what is running* and want to be current, so
 * they carry the script -- and, with scripting off, the meta refresh inside
 * `<noscript>`. **`answer` updates by nothing at all: no script, no refresh.**
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
 * would *appear* to stick, because the poller fetches whatever the address bar
 * holds. A switch the fold drops is D-0055's failure reproduced by the entry
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
  for (const [at, { type, params }] of parseAccept(header ?? "").entries()) {
    const tag = type.trim();
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
  // rather than of the engine running it. (`at` is the library's order, which
  // differs from the written order only where the library's weight differs
  // from this one.)
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

/** Text as HTML text: the four characters that would otherwise be markup. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Claims under the basis they rest on, each basis written once (rondo#91).
 *
 * Consecutive claims are grouped, never reordered: the order of the claims is
 * the payload's own and rondo does not rank them, so a grouping that sorted by
 * basis would be this surface inventing an emphasis the drafter did not have.
 */
function claimsHtml(claims: readonly Claim[], snapshot: object): string {
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
  return groups
    .map(
      (group) =>
        `<div class="group"><p class="basis">${escapeHtml(withoutRepeat(group))}</p>${group.claims
          .map(
            (claim) =>
              `<p class="claim"><span class="label">${escapeHtml(claim.label)}</span>` +
              `<span class="value">${escapeHtml(claim.value)}</span></p>`,
          )
          .join("")}</div>`,
    )
    .join("");
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
 * One section, and the one thing its markup carries beyond its content: which
 * of the three questions it answers.
 *
 * The class is the whole of what the visual weight rests on. *Waiting*,
 * *running* and *ended* are the same shape and the same words as before -- what
 * differs is that a stylesheet can now tell them apart, which is what makes a
 * page ordered by the three questions read as three questions rather than as
 * one uniform list (rondo#153). No section is drawn on the strength of the
 * class and none is hidden by it, so a browser that loads no CSS still gets
 * every claim in the same order.
 */
function section(heading: string, note: string, body: string, weight = ""): string {
  return (
    `<section${weight === "" ? "" : ` class="${weight}"`}><h2>${escapeHtml(heading)}</h2>` +
    (note === "" ? "" : `<p class="note">${escapeHtml(note)}</p>`) +
    `${body}</section>`
  );
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
 * all mean *no ask*, which is the same empty attribute list. `runPlan` already
 * refused every tag that could reach a written payload, so what arrives here is
 * `[A-Za-z0-9-]` -- escaped anyway, because the escaping is what makes that
 * sentence a property of this function rather than of a file two modules away.
 */
function langAttribute(record: IterationRecord): string {
  const asked = record.plan["material_language"];
  return typeof asked === "string" ? ` lang="${escapeHtml(asked)}"` : ' lang=""';
}

/**
 * One lap in the lead, with the row it rests on cited once above it (D-0032,
 * rondo#91).
 *
 * Every line in the block is read off **one iteration row**, so the basis is
 * that row and it is written once -- the shape {@link claimsHtml} already uses
 * for a shared snapshot pointer. The field-level pointers are not dropped: the
 * reading below carries every one of these fields as its own claim under its own
 * `snapshot /iteration/...` locator. That is what makes this a fold and not a
 * hiding.
 *
 * {@link basisLine} is called rather than the string being spelled here,
 * because a second spelling of a basis is a second thing an operator has to
 * learn to trust. The `iteration` form reads no snapshot, so it is handed none.
 *
 * **The `id` is what makes the morph identity-based rather than positional**
 * (D-0054 rule 2). These blocks come and go -- a lap ends, a gate opens -- and
 * with no id on them idiomorph matches the repeated children by position: a
 * list going from `[A, B]` to `[B]` is then A's node rewritten into B and B's
 * own node removed, which takes the reader's focus with it if it was on the
 * answer link inside. The row id is already unique per document and already the
 * thing every line here is read off, so it is also the identity the merge
 * should use. The two other repeated blocks in the lead (an open proposal, a
 * row that will not decode) carry one for the same reason.
 */
function lapHtml(
  record: IterationRecord,
  head: string,
  lines: readonly (string | null)[],
  tail = "",
): string {
  const basis = basisLine({ form: "iteration", iterationId: record.id }, {});
  return (
    `<div class="lap" id="lap-${escapeHtml(record.id)}"><p class="basis">${escapeHtml(basis)}</p>` +
    `<p class="head">${escapeHtml(head)}</p>` +
    `<p class="request"${langAttribute(record)}>${escapeHtml(record.request)}</p>` +
    lines
      .filter((line): line is string => line !== null)
      .map((line) => `<p class="line">${escapeHtml(line)}</p>`)
      .join("") +
    tail +
    `</div>`
  );
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
  const why =
    record.gateOutcome !== null
      ? wording.gateAnswered(record.gateOutcome)
      : (record.reason ?? wording.noReasonRecorded);
  return wording.endedHead(record.status, ago(record.updatedAtMs, nowMs), why);
}

/**
 * *What needs me* -- the laps stopped at a question, and the proposals open.
 *
 * First because it is the only part of the page an operator can act on, which
 * is `inbox`'s own argument for the same order. The button and the material it
 * would be pressed over are **here** rather than in the reading below, because
 * D-0042 makes the press this surface's presentation: what a person is shown
 * before they write has to be beside the thing they press.
 */
function waitingHtml(
  wording: Chrome,
  waiting: readonly IterationRecord[],
  open: readonly OpenProposal[],
  nowMs: number,
  token: string | null,
  shown: ReadonlyMap<string, string>,
): string {
  return section(
    wording.waitingHeading(waiting.length + open.length),
    "",
    waiting
      .map((record) =>
        lapHtml(
          record,
          wording.waitingHead(record.status, ago(record.updatedAtMs, nowMs)),
          [unblockedBy(wording, record), spentLine(wording, record), fenceLine(wording, record)],
          shown.has(record.id)
            ? approveHtml(wording, record, token, shown.get(record.id) ?? "")
            : answerHref(wording, record, token),
        ),
      )
      .join("") +
      open
        .map(
          (proposal) =>
            `<div class="lap" id="proposal-${escapeHtml(proposal.proposalId)}">` +
            `<p class="basis">${escapeHtml(wording.proposalBasis(proposal.proposalId))}</p>` +
            `<p class="head">${escapeHtml(
              wording.proposalHead(proposal.kind, ago(proposal.createdAtMs, nowMs)),
            )}</p>` +
            `<p class="line">${escapeHtml(wording.aboutIteration(proposal.iterationId))}</p></div>`,
        )
        .join(""),
    "waiting",
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
 * A live row that will not decode is here rather than missing, for the inbox's
 * reason: it holds a slot, so leaving it out would understate what is running.
 */
function runningHtml(
  wording: Chrome,
  running: readonly IterationRecord[],
  unreadable: readonly LiveRow[],
  transcripts: ReadonlyMap<string, TranscriptLocation>,
  nowMs: number,
): string {
  return section(
    wording.runningHeading(running.length + unreadable.length),
    "",
    running
      .map((record) =>
        lapHtml(record, wording.runningHead(record.status, ago(record.updatedAtMs, nowMs)), [
          whereItRuns(wording, record, transcripts.get(record.id)),
          spentLine(wording, record),
          fenceLine(wording, record),
        ]),
      )
      .join("") +
      unreadable
        .map((row) =>
          row.kind === "unreadable"
            ? `<div class="lap" id="unreadable-${escapeHtml(row.id)}">` +
              `<p class="head">${escapeHtml(row.id)}</p>` +
              `<p class="line">${escapeHtml(wording.willNotDecode(row.reason))}</p></div>`
            : "",
        )
        .join(""),
    "running",
  );
}

/** *What just finished* -- the last few endings, newest first (rondo#145). */
function endedHtml(wording: Chrome, ended: readonly IterationRecord[], nowMs: number): string {
  return section(
    wording.endedHeading(ended.length),
    "",
    ended
      .map((record) =>
        lapHtml(record, endedHow(wording, record, nowMs), [
          spentLine(wording, record),
          fenceLine(wording, record),
        ]),
      )
      .join(""),
    "ended",
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
function nothingHtml(wording: Chrome): string {
  return (
    `<section class="idle"><p class="nothing">${escapeHtml(wording.nothingAtAll)}</p>` +
    `<p class="basis">${escapeHtml(wording.nothingBasis)}</p></section>`
  );
}

/** The inbox section: the same lines `rondo inbox` prints, and no mark moved. */
function inboxHtml(ports: WebPorts, wording: Chrome, snapshot: InboxSnapshot | null): string {
  if (snapshot === null || ports.actorId === null) {
    return section(wording.inboxHeading, wording.inboxNoApprover, "");
  }
  return section(
    wording.inboxHeading,
    wording.inboxNote,
    `<pre>${escapeHtml(inboxLines(wording, ports.actorId, snapshot).join("\n"))}</pre>`,
  );
}

/** The between-laps section: `rondo between`'s composition, unrecorded. */
function betweenHtml(wording: Chrome, snapshot: HostSnapshot): string {
  return section(
    wording.betweenHeading,
    wording.betweenNote,
    claimsHtml(proposeHost(snapshot).payload.claims, snapshot),
  );
}

/**
 * The one button, drawn only where there is something for it to answer.
 *
 * Three conditions, and each is a different way of not having a question in
 * front of a person: no write port (nobody to act as), a status that is not
 * `awaiting_human` (nothing is asking), or no gate id on the row (the status
 * says a gate is open and the row does not name one, which `answer` refuses
 * too). A button drawn anyway would be one that fails when pressed.
 *
 * `method="post"` is not decoration: the redraw above is a document `GET`, and
 * this form is the only thing on the page that can produce anything else.
 */
function approveHtml(
  wording: Chrome,
  record: IterationRecord,
  token: string | null,
  material: string,
): string {
  if (token === null || record.status !== "awaiting_human" || record.gateId === null) {
    return "";
  }
  return (
    material +
    `<form class="approve" method="post" action="${escapeHtml(
      viewHref({ kind: "summary" }, wording.lang),
    )}">` +
    `<input type="hidden" name="token" value="${escapeHtml(token)}">` +
    `<input type="hidden" name="iteration" value="${escapeHtml(record.id)}">` +
    `<button type="submit">${escapeHtml(APPROVE_BODY)}</button>` +
    `<span class="note">${escapeHtml(wording.approveNote(record.gateId, APPROVE_BODY))}</span>` +
    `</form>`
  );
}

/**
 * The way to the button, drawn on exactly the rows that would have one.
 *
 * The conditions are {@link approveHtml}'s, so a link is never offered into a
 * view that would refuse to draw a button -- and the words say what the second
 * address adds, because *"answer"* on its own would read as though the press
 * were here.
 */
function answerHref(wording: Chrome, record: IterationRecord, token: string | null): string {
  if (token === null || record.status !== "awaiting_human" || record.gateId === null) {
    return "";
  }
  return `<p class="line"><a href="${escapeHtml(
    viewHref({ kind: "answer", iterationId: record.id }, wording.lang),
  )}">${escapeHtml(wording.answerHere)}</a></p>`;
}

/** One iteration, explained the way `rondo explain` explains it. */
function explainHtml(wording: Chrome, record: IterationRecord, snapshot: AdvisorySnapshot): string {
  return section(
    wording.iterationHeading(record.id),
    wording.explainNote,
    claimsHtml(propose(snapshot).payload.claims, snapshot),
  );
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
): Promise<ReadonlyMap<string, string>> {
  const shown = new Map<string, string>();
  if (token === null || view.kind !== "answer") {
    return shown;
  }
  for (const record of waiting) {
    if (
      record.id !== view.iterationId ||
      record.status !== "awaiting_human" ||
      record.gateId === null
    ) {
      continue;
    }
    const snapshot = gather(record, await ports.store.readingsFor(record.id));
    // The set this request resolved to and not the host's (D-0056 rule 12):
    // the fence block's standing sentences are inside these lines.
    const material =
      ports.material === null ? null : (await ports.material(wording, record)).join("\n");
    shown.set(
      record.id,
      `<p class="note">${escapeHtml(wording.pressNote)}</p>` +
        claimsHtml(propose(snapshot).payload.claims, snapshot) +
        (material === null
          ? ""
          : `<pre class="material"${langAttribute(record)}>${escapeHtml(material)}</pre>`),
    );
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
 * The whole page: the three questions an operator arrives with, and then the
 * reading the answers rest on (rondo#145).
 *
 * **The order is the argument, and it is the operator's rather than rondo's.**
 * What is on the screen first is what needs them, then what is running, then
 * what just ended -- which is `inbox`'s own order carried to the surface a
 * person actually looks at, and not the order `inbox`, `between` and `explain`
 * happen to be laid out in. rondo's own vocabulary -- bounds, adjacency,
 * last-look marks, a field-by-field reading of every row -- is one `<details>`
 * below, unchanged and complete.
 *
 * **Folded is not hidden** (D-0032). Every claim that was on this page before
 * is still on it, under the same basis, in the same words; what moved is which
 * of them an operator has to read past to answer *does anything need me*. The
 * lead cites the row each of its lines is read off, once, and the reading below
 * cites the field -- so a number in the lead is checkable twice over rather
 * than asserted once.
 *
 * **Nothing here writes** (D-0041). Every read above is a read, the `<details>`
 * is a browser's own element and carries no script, and the only thing on the
 * page that can produce anything but a `GET` is still the one form.
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
): Promise<string> {
  const nowMs = ports.now();
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

  const keepsCurrent = isLive(view);
  // **The token arrives null exactly when there is no writer** (D-0041 rule 4,
  // D-0059 rule 3a): the renderer is handed the reading ports and nothing that
  // could write, so whether a button is drawn is decided by the one caller that
  // does hold the writer (`src/access/web-app.ts`) and handed down as a token.
  const pressToken = token;
  const shown = await shownBeforePress(ports, wording, waiting, pressToken, view);

  const lead =
    waiting.length + running.length + ended.length + open.length + unreadable.length === 0
      ? nothingHtml(wording)
      : [
          waitingHtml(wording, waiting, open, nowMs, pressToken, shown),
          runningHtml(wording, running, unreadable, transcripts, nowMs),
          endedHtml(wording, ended, nowMs),
        ].join("\n");

  const reading =
    view.kind !== "reading"
      ? ""
      : [
          inboxHtml(ports, wording, inbox),
          betweenHtml(wording, host),
          ...(await Promise.all(
            [...waiting, ...running, ...ended]
              .filter((record) => !shown.has(record.id))
              .map(async (record) =>
                explainHtml(
                  wording,
                  record,
                  gather(record, await ports.store.readingsFor(record.id)),
                ),
              ),
          )),
          ...unreadable.map((row) =>
            row.kind === "unreadable"
              ? section(
                  wording.iterationHeading(row.id),
                  "",
                  `<pre>${escapeHtml(wording.willNotDecode(row.reason))}</pre>`,
                )
              : "",
          ),
        ].join("\n");

  return `<!doctype html>
${
  // **The document declares the language rondo actually wrote it in, and never
  // the one that was asked for** (D-0055 rule 7). `wording.lang` is the tag of
  // the set that was selected, so a well-formed tag this tree ships no set for
  // renders an English page that says `en` -- which is what the document *is*.
  // rondo does not declare an intention as a fact.
  //
  // Escaped like anything else that reaches markup: the tag was already refused
  // outside `[A-Za-z0-9-]` where it was read, and the escaping is what makes
  // that a property of this line rather than of a file two modules away.
  `<html lang="${escapeHtml(wording.lang)}">`
}
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${
  // **What keeps a live view current, in both modes** (D-0054 rules 1 and 7).
  //
  // With scripting on, the two files below poll this same address and morph
  // the answer in place, so the reader's scroll position, selection and focus
  // survive the redraw. With scripting off, the meta refresh inside
  // `<noscript>` keeps exactly the liveness this page had before D-0054 --
  // throwing the document away every five seconds, which is what rondo#160
  // complained about and is still better than a screen that goes stale
  // without saying so.
  //
  // `defer` on both, in this order: it is what guarantees `Idiomorph` is
  // defined before `poll.js` runs, and what keeps either from running before
  // the document it morphs exists. Neither draws anything -- the whole
  // document is already here, rendered by the server (rule 7).
  //
  // The `answer` view reaches none of this: it has no script and no refresh,
  // so there is nothing for it to degrade to either.
  keepsCurrent
    ? `<noscript><meta http-equiv="refresh" content="${String(
        REFRESH_SECONDS,
      )};url=${escapeHtml(viewHref(view, wording.lang))}"></noscript>
<script src="/idiomorph-0.8.0.min.js" defer></script>
<script src="/poll.js" defer></script>
`
    : ""
}<title>rondo</title>
<style>
${PAGE_STYLE}</style>
</head>
<body>
<h1>rondo</h1>
${
  // **Each view says which of the two it is**, because "redraws every 5s" on a
  // view that does not would be the page's own copy lying about the one
  // property D-0054 rule 1 spends itself on. Both branches say the same thing
  // about writing, which is the fact that did not change: a read writes
  // nothing, whoever or whatever issued it.
  keepsCurrent
    ? `<p class="note">${escapeHtml(wording.liveNote(REFRESH_SECONDS))}</p>`
    : `<p class="note">${escapeHtml(wording.stillNote)}</p>`
}
${
  // **Said on the visible page and not only in the reading.** With no approver
  // there is no write port and so no button anywhere, and a page that explained
  // that only inside the fold would leave an operator looking for a button that
  // is missing for a reason rondo knows and did not say (D-0020 rule 2).
  ports.actorId === null ? `<p class="note">${escapeHtml(wording.noApproverNote)}</p>` : ""
}
${lead}
<p class="fold"><a href="${escapeHtml(
    viewHref(view.kind === "reading" ? { kind: "summary" } : { kind: "reading" }, wording.lang),
  )}">${escapeHtml(view.kind === "reading" ? wording.hideReading : wording.openReading)}</a></p>
${
  // **The switch, and it is the first element of this chrome that exists in
  // order to be operated rather than read** (D-0056 rule 10). One link per
  // shipped set other than the one on screen, beside the fold's link, labelled
  // with that language's own name in its own language -- so the label is the
  // same bytes in every set and needs no special case for going back.
  //
  // **It keeps the view it was pressed on**, because a switch that returned the
  // reader to the summary would cost them their place to change a word; and it
  // is a `GET` that writes nothing to the ledger, which is the whole of what
  // D-0041 rule 4 asks of it. It is also the only thing on this page that
  // writes rule 5's memory.
  `<p class="switch">${[...SHIPPED_SETS]
    .filter(([tag]) => tag !== wording.lang)
    .map(
      ([tag, endonym]) =>
        `<a href="${escapeHtml(viewHref(view, tag))}" lang="${escapeHtml(tag)}">` +
        `${escapeHtml(endonym)}</a>`,
    )
    .join(" ")}</p>`
}
${reading}
</body>
</html>
`;
}
