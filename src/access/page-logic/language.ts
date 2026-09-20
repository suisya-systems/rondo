/**
 * The chrome's language, resolved per request (DECISIONS.md D-0056).
 *
 * **Lifted out of `src/access/web.tsx` by the page's rebuild.** It is a pure
 * function of what one request said -- a query parameter, a cookie, the host's
 * variable and an `Accept-Language` header -- and answers with a wording set.
 * It draws nothing, so it outlives whatever renders the page: D-0059 rule 4
 * keeps this rondo's own code rather than a library's precisely because every
 * library measured served a language the browser had refused, and that
 * reasoning is about the resolution and not about the view layer it used to
 * sit in.
 *
 * `hono/utils/accept` is named here rather than in the renderer now, and the
 * boundary table's grant moved with it: the tokenizer is this module's, and
 * the weight is still read by rondo (see {@link tagsByWeight}).
 */
import { parseAccept } from "hono/utils/accept";
import { type Chrome, EN, setFor } from "../wording.js";

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
