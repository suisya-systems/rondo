// What the five-second redraw changed, said in colour (rondo#494 item 1).
//
// The page redraws itself every five seconds and merges the result in place
// (`src/access/web.tsx`, D-0054 rule 2), so an ask, a stop, a candidate card
// or a step on the right face can become a different thing under a person's
// eyes with nothing on the screen saying so. Lap 18 measured what that costs:
// the owner was answering an ask of four points, triage read the candidate
// again, the ask became a new round of three, and the owner could tell that
// something had moved but not what, or that it mattered.
//
// So: **an element the person can act on whose words changed in a redraw is
// washed in colour for a moment, and the wash fades back.** Nothing else on
// the page moves, nothing is scrolled, and no focus is taken -- a person
// typing into the box that changed keeps their caret and their words
// (`page/composer.js`), and this only makes the change visible.
//
// **It decides nothing about what changed.** The server marks each element a
// person can act on with `data-can-act`, and this compares the words that
// element shows against the words it showed before the swap. Two consequences
// worth naming:
//
// - **A wash is about the words, not about the clock.** Text that moves with
//   the clock rather than with the content -- *read 3m ago* -- carries
//   `data-ticks` and is left out of the comparison, or every card on the page
//   would wash itself once a minute and the wash would come to mean nothing.
// - **A text a person typed is not the words compared.** The comparison reads
//   the document's text, and a field's kept draft lives in the field's value,
//   so typing into a box never washes it; what washes it is the server
//   sending different words for it.
//
// **The nodes are their own identity.** The swap is idiomorph's morph: an
// element that survives a redraw is the same node, so the words before are
// kept in a `WeakMap` on the node and there is no key to invent, and an
// element the redraw created is new and washes for that.
//
// **The fade, and the mark instead of it, are `page/app.css`'s.** This sets
// one attribute and removes it when the animation ends; with
// `prefers-reduced-motion` the stylesheet draws no animation, so no
// `animationend` arrives, the attribute stays, and the rule draws the static
// *updated* mark from the attribute's own value. The word is the person's
// language, resolved by the server on `#ledger` beside the chime's sentence
// (`page/chime.js`), because a script that chose a word for itself would be
// choosing it in one language.
//
// Served as a file under `script-src 'self'`, and its digest is in
// `page.manifest.json` beside everything the browser receives.
//
// **Everything below is inside a function, and that is not a style** (the gate
// of 2026-09-27). A classic `<script src>` shares one top-level scope with
// every other classic script on the page, so a `const` here with a name
// `page/chime.js` also declares is a redeclaration: the browser refuses the
// *whole file* with a `SyntaxError` before its first line runs, and the wash
// silently does not exist. That is exactly what shipped -- `ledger` and `read`
// were declared in both -- and reading either file alone could not show it.
// The bindings are shut in here so this file can name what it likes;
// `test/access/page-scripts.test.ts` runs every one of the page's scripts in
// **one** global, in the order the document loads them, so the next collision
// is a red test rather than a page that quietly stops working.

(() => {
  /** What the server marks as an element a person can act on. */
  const WATCHED = "[data-can-act]";
  /** What this script sets on one that changed; the stylesheet draws it. */
  const MARK = "data-just-changed";

  const ledger = () => document.querySelector("#ledger");

  /** The word the mark carries, in the language this document was drawn in. */
  const word = () => ledger()?.getAttribute("data-changed-word") ?? null;

  /**
   * The words an element shows, with the text that moves on its own left out
   * and whitespace flattened: a redraw that only re-wrapped a line is not a
   * change.
   */
  const said = (element) => {
    let words = element.textContent ?? "";
    for (const ticking of element.querySelectorAll("[data-ticks]")) {
      const moves = ticking.textContent ?? "";
      if (moves !== "") {
        words = words.replace(moves, " ");
      }
    }
    return words.replace(/\s+/g, " ").trim();
  };

  /** The words each watched node showed when it was last read. */
  const before = new WeakMap();
  /** What this script marked, so the next change clears it first. */
  let marked = [];

  const wash = (element) => {
    element.setAttribute(MARK, word() ?? "");
    marked.push(element);
    // **Cleared when the fade ends**, so the next change can fade again: an
    // attribute that is already there restarts no animation. With reduced
    // motion there is no animation and none of these ever arrives, which is
    // what leaves the static mark standing.
    element.addEventListener(
      "animationend",
      () => {
        element.removeAttribute(MARK);
      },
      { once: true },
    );
  };

  /**
   * One reading. `first` is the document as it arrived: it establishes what the
   * words were and washes nothing, because a person is looking at the page they
   * asked for and not at a change to it.
   */
  const read = (first) => {
    const changed = [];
    const now = [];
    for (const element of document.querySelectorAll(WATCHED)) {
      const words = said(element);
      now.push([element, words]);
      const was = before.get(element);
      if (!first && words !== was) {
        changed.push(element);
      }
    }
    for (const [element, words] of now) {
      before.set(element, words);
    }
    if (changed.length === 0) {
      return;
    }
    // **The marks of an earlier redraw go when a later one lands.** Under
    // reduced motion a mark is static and would otherwise add up until every
    // element on the page said it had just changed.
    for (const element of marked) {
      element.removeAttribute(MARK);
    }
    marked = [];
    for (const element of changed) {
      wash(element);
    }
  };

  document.addEventListener("htmx:afterSwap", () => read(false));
  read(true);
})();
