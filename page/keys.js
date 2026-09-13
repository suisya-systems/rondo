// The one script rondo owns on its page (DECISIONS.md D-0059 rule 5, R3).
//
// Three keys, one class and the open folds, and that is the whole vocabulary: `j` and `k` move
// focus between the rows the server rendered (`[data-row]`), `Enter` follows the
// focused row's server-rendered link (`[data-open]`), and `Esc` follows the
// view's server-rendered way back (`[data-back]`). Following a link is a
// navigation `GET` to an address the server wrote into the page. It constructs
// no request of its own, reads no form, submits nothing and holds nothing a
// server reads -- only which folds are open, below: the
// only `POST` this page can produce is still the native form's submit, and the
// press it carries is minted only from a person's click or key (D-0059 section 5).
//
// **It draws nothing a person must read** (D-0054 rule 7). The first line adds
// `js` to the root element, which is what un-hides the key hints and the live
// indicator (`.js-only` in `page/app.css`): with this file absent, blocked or
// broken, the hints stay hidden rather than advertising keys that do nothing,
// and every view is still the complete document the server rendered.
//
// **And the folds a person opened stay open** (D-0059 section 5a, R3): the
// reading's sections are `<details>` the server always renders shut, and the
// in-place redraw replaces them every five seconds. So the ids of the folds a
// person opened are kept in memory for the life of this document, and any fold
// with one of those ids that arrives shut is opened again. Nothing is stored
// past a navigation and nothing is sent; with script off `page/app.css` draws
// every fold open instead.
//
// Served as a file under `script-src 'self'`, and its digest is in
// `page.manifest.json` beside everything else the browser receives (R1).

document.documentElement.classList.add("js");

document.addEventListener("keydown", (event) => {
  // A modifier means the person meant the browser's shortcut, and a key typed
  // into a field is text; neither is this script's.
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }
  if (event.target instanceof Element && event.target.closest("input, textarea, select")) {
    return;
  }
  // Only rows on screen: a row inside a shut fold cannot take focus.
  const rows = [...document.querySelectorAll("[data-row]")].filter(
    (row) => row.getClientRects().length > 0,
  );
  const at = rows.indexOf(document.activeElement);
  if (event.key === "j" || event.key === "k") {
    // From no row, either key lands on the first: there is nothing above it.
    const to = at === -1 ? 0 : at + (event.key === "j" ? 1 : -1);
    const row = rows[Math.min(Math.max(to, 0), rows.length - 1)];
    if (row !== undefined) {
      event.preventDefault();
      row.focus();
      row.scrollIntoView({ block: "nearest" });
    }
  } else if (event.key === "Enter" && at !== -1) {
    const open = rows[at].querySelector("a[data-open]");
    if (open !== null) {
      event.preventDefault();
      open.click();
    }
  } else if (event.key === "Escape") {
    const back = document.querySelector("a[data-back]");
    if (back !== null) {
      event.preventDefault();
      back.click();
    }
  }
});

// **And a selection the person is making is not swapped out from under them.**
// The redraw replaces every node in the ledger, which clears a text selection
// even when nothing changed; so while one exists the redraw's request is
// cancelled before it is sent, and the next one five seconds later is asked
// again. Cancelling is the only thing done with that request -- none is built.
document.addEventListener("htmx:beforeRequest", (event) => {
  if (!(document.getSelection()?.isCollapsed ?? true)) {
    event.preventDefault();
  }
});

// **And a redraw that brings back what is already on screen swaps nothing.**
// The swap replaces every node in the ledger, which resets what the browser
// keeps per element -- a scroll offset, a caret, a hover -- even when not one
// byte changed. So the ledger the server last sent is kept as text, and a
// response whose ledger is the same text is not swapped in. Compared against
// what the server sent and never against the live document, whose folds this
// script opens. A redraw that did change something still swaps, and resets
// those offsets: a known limit, not one this script hides.
let lastLedger = document.getElementById("ledger")?.outerHTML ?? null;
document.addEventListener("htmx:beforeSwap", (event) => {
  const arrived = new DOMParser()
    .parseFromString(event.detail.serverResponse, "text/html")
    .getElementById("ledger")?.outerHTML;
  if (arrived !== undefined && arrived === lastLedger) {
    event.detail.shouldSwap = false;
  } else if (arrived !== undefined) {
    lastLedger = arrived;
  }
});

const opened = new Set();
// `toggle` does not bubble, so it is heard on the way down.
document.addEventListener(
  "toggle",
  (event) => {
    const fold = event.target;
    if (fold instanceof HTMLDetailsElement && fold.id !== "") {
      fold.open ? opened.add(fold.id) : opened.delete(fold.id);
    }
  },
  true,
);
new MutationObserver(() => {
  for (const id of opened) {
    const fold = document.getElementById(id);
    if (fold instanceof HTMLDetailsElement && !fold.open) {
      fold.open = true;
    }
  }
}).observe(document.body, { childList: true, subtree: true });
