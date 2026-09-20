/**
 * The chrome's language, resolved per request (DECISIONS.md D-0056 rule 2).
 *
 * **Its own file since the page's rebuild.** These cases used to live in
 * `test/access/web.test.ts`, so the coverage of the resolution was a passenger
 * on the renderer's suite: rebuilding the view layer would have deleted it
 * without anything going red. The resolution is a pure function of one
 * request's four inputs and draws nothing, so it is tested where it lives and
 * survives whatever renders the page.
 *
 * D-0059 rule 4 is what these cases protect: every library measured served a
 * language the browser had refused (a `q` of zero, a capital `Q`, an
 * ill-formed tag truncated into a set), which is why the resolution is rondo's
 * own code. These are the cases that say it still behaves.
 *
 * The socket-level cases -- the one `303`, the `Set-Cookie`, what a served
 * document declares about itself -- stay with the server they are claims
 * about.
 */
import { expect, test } from "vitest";
import { type LanguageAsked, resolveLanguage } from "../../../src/access/page-logic/language.js";

/** Rule 2's four inputs, defaulted to a host and a browser that said nothing. */
function askedWith(over: Partial<LanguageAsked> = {}): LanguageAsked {
  return {
    query: null,
    cookie: undefined,
    host: null,
    header: undefined,
    ...over,
  };
}

/** The tag one set of inputs resolves to. */
function resolvedTag(over: Partial<LanguageAsked> = {}): string {
  return resolveLanguage(askedWith(over)).lang;
}

test("rule 2 is five steps and the first answer wins, each step losing to the one above", () => {
  // **Step 5 is the floor**: nobody said anything, so English.
  expect(resolvedTag()).toBe("en");

  // **Step 4, the browser's list**, which answers exactly when nothing above
  // it did -- the case the operator was actually answering about.
  expect(resolvedTag({ header: "ja" })).toBe("ja");

  // **Step 3 beats step 4**: a host that has spoken is not overridden by a
  // browser-wide default (rule 3). Both directions, so this is the order and
  // not one lucky pair.
  expect(resolvedTag({ host: "en", header: "ja" })).toBe("en");
  expect(resolvedTag({ host: "ja", header: "en" })).toBe("ja");

  // **Step 2 beats step 3**: the operator's own remembered switch outranks the
  // host's statement about them.
  expect(resolvedTag({ cookie: "lang=ja", host: "en", header: "en" })).toBe("ja");
  expect(resolvedTag({ cookie: "lang=en", host: "ja", header: "ja" })).toBe("en");

  // **Step 1 beats everything**, which is what makes rule 4's canonical URL the
  // whole of the state, so a redraw of a view's own address keeps its language.
  expect(resolvedTag({ query: "ja", cookie: "lang=en", host: "en", header: "en" })).toBe("ja");
  expect(resolvedTag({ query: "en", cookie: "lang=ja", host: "ja", header: "ja" })).toBe("en");

  // **A step naming a tag no set resolves to is a step that said nothing**, so
  // the next one answers rather than English being reached four times over.
  expect(resolvedTag({ query: "de", host: "ja" })).toBe("ja");
  expect(resolvedTag({ host: "de", header: "ja" })).toBe("ja");
  expect(resolvedTag({ query: "de", cookie: "lang=de", host: "de", header: "de" })).toBe("en");
  // The cookie is read out of a header that carries others beside it.
  expect(resolvedTag({ cookie: "other=1; lang=ja; third=x", host: "en" })).toBe("ja");
});

test("a tag is resolved by BCP 47 lookup at every one of rule 2's steps (rule 6)", () => {
  // `ja-JP` is what a host states and what a browser sends, and it is the
  // papercut this entry exists to close -- at all four steps, because they all
  // carry the same kind of thing.
  expect(resolvedTag({ query: "ja-JP" })).toBe("ja");
  expect(resolvedTag({ cookie: "lang=ja-JP" })).toBe("ja");
  expect(resolvedTag({ host: "ja-JP" })).toBe("ja");
  expect(resolvedTag({ header: "ja-JP" })).toBe("ja");
  // Case folded, which is all BCP 47 says about comparing two tags.
  expect(resolvedTag({ query: "JA-jp" })).toBe("ja");

  // **The singleton step, which is the one that is easy to write backwards**
  // (RFC 4647 section 3.4): truncating `ja-x-private` at its last hyphen leaves
  // `ja-x`, and a trailing single-character subtag is dropped together with the
  // subtag that introduced it rather than looked up as a set.
  expect(resolvedTag({ query: "ja-x-private" })).toBe("ja");
  // The RFC's own worked example's shape -- `zh-Hant-CN-x-private1-private2`
  // reaching `zh` -- written against the one set this tree ships, so the
  // assertion is about the truncation and not about a `zh` set that would have
  // matched at the first step anyway.
  expect(resolvedTag({ query: "ja-Hant-CN-x-private1-private2" })).toBe("ja");
  // English is the last stop and is reachable by name, which is what keeps the
  // switch from being a one-way door (rule 8).
  expect(resolvedTag({ query: "en-GB" })).toBe("en");
  expect(resolvedTag({ query: "en", host: "ja" })).toBe("en");
  // Truncation stops at the primary subtag rather than wrapping to English via
  // some shorter match: `de` is a step saying nothing, not a step saying `en`.
  expect(resolveLanguage(askedWith({ query: "de-CH-1901", host: "ja" })).lang).toBe("ja");
});

test("Accept-Language is read by q, a q of zero is a refusal, and * says nothing (rule 6)", () => {
  // Highest weight first, and not the order the list is written in.
  expect(resolvedTag({ header: "en;q=0.5, ja;q=0.9" })).toBe("ja");
  expect(resolvedTag({ header: "ja;q=0.1, en;q=0.8" })).toBe("en");
  // Absent means 1.
  expect(resolvedTag({ header: "ja, en;q=0.9" })).toBe("ja");
  // **A tie keeps the order the list was written in**, however the parameter
  // name is cased: the tokenizer reads `Q=0.5` as 1 and sorts English first,
  // and a tie broken on its order would be broken by that misreading.
  expect(resolvedTag({ header: "ja;q=0.5, en;Q=0.5" })).toBe("ja");
  expect(resolvedTag({ header: "en;Q=0.5, ja;q=0.5" })).toBe("en");
  // **A q of zero is a refusal and not a low preference**, so `ja` is dropped
  // before lookup runs rather than tried after unsupported German: this header
  // must reach the step below rather than the `ja` set.
  expect(resolvedTag({ header: "de;q=1, ja;q=0" })).toBe("en");
  expect(resolveLanguage(askedWith({ header: "de;q=1, ja;q=0", host: "en" })).lang).toBe("en");
  // **Zero has more than one legal spelling**, and each is a refusal: RFC
  // 9110's `qvalue` allows zero digits after the point, so `q=0.` and `q=0.00`
  // are the same *do not send me this*. Read as unparseable they would fall
  // back to the default weight of 1 and make an explicit refusal the strongest
  // preference in the list, which is this rule failing in the one direction
  // that matters.
  for (const zero of ["0", "0.", "0.0", "0.00", "0.000"]) {
    expect(resolvedTag({ header: `ja;q=${zero}, en;q=0.5` })).toBe("en");
    expect(resolveLanguage(askedWith({ header: `ja;q=${zero}` })).lang).toBe("en");
  }
  // A `1` with the same trailing point is still one, and not a refusal.
  expect(resolvedTag({ header: "ja;q=1., en;q=0.5" })).toBe("ja");
  // And the refusal is of that tag only: a second tag still answers.
  expect(resolvedTag({ header: "ja;q=0, en;q=0.3" })).toBe("en");
  // **`*` is no preference and is skipped**, so a bare one reaches the step
  // below rather than picking a set for the operator.
  expect(resolvedTag({ header: "*" })).toBe("en");
  expect(resolveLanguage(askedWith({ header: "*", host: "ja" })).lang).toBe("ja");
  expect(resolvedTag({ header: "*;q=1, ja;q=0.2" })).toBe("ja");
  // Whitespace and an unparseable weight are not a crash: the header is a
  // browser's and this page is total about what it is handed.
  expect(resolvedTag({ header: "  ja ; q=0.9 , en;q=0.3 " })).toBe("ja");
  // An absent weight really is 1 and not a default below an explicit one, so
  // the bare tag here outranks the weighted one whatever order they are in.
  expect(resolvedTag({ header: "  ja ; q=0.9 , en " })).toBe("en");
  // **A weight that is not a number is a weight that was not given**, and so
  // the tag is offered at 1 rather than dropped: `q=0` is the only refusal in
  // this grammar, and a garbled parameter is not the browser withdrawing a
  // language the operator may well read.
  expect(resolvedTag({ header: "ja;q=x" })).toBe("ja");
  expect(resolvedTag({ header: "" })).toBe("en");
});

test("an ill-formed tag resolves to nothing rather than truncating into a set (rule 9)", () => {
  // **The truncation is what makes this the wrong way round if the grammar is
  // not checked first.** `ja-!!` and `ja-` each reach `ja` by cutting at a
  // hyphen, so a syntax error would resolve -- and, being a language the other
  // steps would not have answered, would write rule 5's memory on its way past.
  // Rule 9 says an ill-formed `lang` resolves to nothing and leaves the memory
  // alone, so the step must say nothing and the next one must answer.
  for (const bad of ["ja-!!", "ja-", "-ja", "ja_JP", "j", "日本語", "ja ", "%", ""]) {
    expect(resolvedTag({ query: bad })).toBe("en");
    expect(resolveLanguage(askedWith({ query: bad, cookie: "lang=en" })).lang).toBe("en");
    // The one that would have been a silent switch: an English memory must
    // survive an ill-formed ask that happens to start with a shipped tag.
    expect(resolveLanguage(askedWith({ query: bad, host: "ja" })).lang).toBe("ja");
  }
  // Every step is checked, not just the query: a header or a cookie carrying
  // rubbish says nothing rather than truncating into a set.
  expect(resolveLanguage(askedWith({ cookie: "lang=ja-!!", host: "en" })).lang).toBe("en");
  expect(resolveLanguage(askedWith({ header: "ja-!!", host: "en" })).lang).toBe("en");
  // And what the grammar admits still resolves, so this is a check and not a
  // second, narrower lookup.
  expect(resolvedTag({ query: "ja-JP" })).toBe("ja");
  expect(resolvedTag({ query: "ja-x-private" })).toBe("ja");
  expect(resolvedTag({ query: "zh-Hant" })).toBe("en");
});
