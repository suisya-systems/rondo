// The one script rondo owns on its page (DECISIONS.md D-0059 rule 5, R3).
//
// Three keys and one class, and that is the whole vocabulary: `j` and `k` move
// focus between the rows the server rendered (`[data-row]`), `Enter` follows the
// focused row's server-rendered link (`[data-open]`), and `Esc` follows the
// view's server-rendered way back (`[data-back]`). Following a link is a
// navigation `GET` to an address the server wrote into the page. It constructs
// no request of its own, reads no form, submits nothing and holds no state: the
// only `POST` this page can produce is still the native form's submit, and the
// press it carries is minted only from a person's click (D-0059 section 5).
//
// **It draws nothing a person must read** (D-0054 rule 7). The first line adds
// `js` to the root element, which is what un-hides the key hints and the live
// indicator (`.js-only` in `page/app.css`): with this file absent, blocked or
// broken, the hints stay hidden rather than advertising keys that do nothing,
// and every view is still the complete document the server rendered.
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
  const rows = [...document.querySelectorAll("[data-row]")];
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
