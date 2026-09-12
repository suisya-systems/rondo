// The whole of the script rondo runs (DECISIONS.md D-0054 rule 6).
//
// One method, one address, one target: it issues `GET`s of the address it is
// already on, and morphs the document that comes back into the one on screen.
// That is the entire vocabulary, and it is the point rather than a starting
// position -- what D-0041 rule 3(a) used to secure by there being no script at
// all now rests on the server not having the write verb behind a `GET`
// (D-0054 rule 3), and on this file not growing a second thing it can ask for.
// It constructs no `POST`, reads no form, holds no state, and names no address
// but its own: the only `POST` this page can produce is still the form's
// submit, which requires a person to press.
//
// **The server sends the same bytes to this fetch as to a navigating browser**
// (rule 2). There is no fragment endpoint and no partial template, so there is
// no second rendering of anything to keep true -- the response is a whole
// document, and the morph is what makes replacing it survivable: `innerHTML`
// would discard the scroll position, the selection and the focus the operator
// is standing on, which is the entire complaint rondo#160 opened with.
//
// **Nothing a person must read or press is produced here** (rule 7). This file
// only replaces what the server just sent again; with it absent, blocked or
// broken the page is the complete document the server rendered, and the
// `<noscript>` meta refresh keeps the liveness the page had before D-0054.
// A failed fetch is therefore swallowed rather than shown: a page that stops
// updating is correct and static, and an error banner drawn by script would be
// the first thing on this page that only script can say.
//
// Served as a file rather than inlined so that what runs is bytes the tree
// holds, beside the pinned bytes of `vendor/idiomorph-0.8.0.min.js`.

// Matches the `<noscript>` refresh and D-0054 rule 2's cadence. Not read from
// the page: a number this file can be told is a number a page could be made to
// say, and five seconds is the agreed freshness rather than a setting.
const EVERY_MS = 5000;

// `setTimeout` chained after each attempt rather than `setInterval`: a redraw
// that takes longer than the cadence must delay the next one, not queue a
// second read of the same ledger behind it.
const tick = async () => {
  try {
    // `location.href` and nothing derived from it, so the request is always
    // literally the view being read -- including its query, which is where the
    // whole of this surface's state lives (`src/access/web.ts`).
    const response = await fetch(location.href, {
      headers: { accept: "text/html" },
      // The address is this page's own and the method is a read; no credentials
      // are wanted and none are sent.
      credentials: "omit",
    });
    if (response.ok) {
      // The whole document against the whole document. idiomorph merges
      // `<head>` and keeps every node it can prove is the same one, which is
      // what preserves the reader's place.
      Idiomorph.morph(document, await response.text());
    }
  } catch {
    // The process is gone, or the read failed. The page on screen stays the
    // last complete document the server rendered, and the next tick tries
    // again.
  }
  setTimeout(tick, EVERY_MS);
};

setTimeout(tick, EVERY_MS);
