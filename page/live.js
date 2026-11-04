// What the page hears from the host (rondo#674, rondo#742).
//
// One stream, `/events`, carrying two things.
//
// **The press token, kept current** (rondo#674). Every form on the page
// carries the token of the process that drew it (D-0041 rule 3b), and a host
// that restarted mints a new one -- so a screen drawn before the restart
// refused the person's next press and asked them to reload. The stream's first
// frame is this process's token, and it is written into every
// `input[name="token"]` and into the notice's `data-notice-token`
// (`page/chime.js`).
//
// **The word that this page has changed** (rondo#742). The host compares the
// view this page is on with the bytes the page is standing on and says
// `change` only where they differ; this fires one `rondo:change` on the body,
// which is the trigger `#ledger` waits on (`src/access/page/document.tsx`), so
// htmx makes one `GET` and morphs what differs. There is no timer on either
// side: while nothing changes, nothing here runs. The view the host compares
// is the one in this page's own query, so the address carries it.
//
// **And which draw of the page this is**, which the address carries too
// (`at`). The host stamped `#ledger` with its own mark of what it had seen
// written when it drew this page, and the host's first word is decided by
// comparing that mark with the mark it holds now -- so a change made between
// this page's own `GET` and this stream, or while this page was away, or by a
// host that has since restarted, is one redraw rather than something the
// reader never hears about. The attribute is read on every open, not once:
// the redraw morphs `#ledger` and brings the mark of the draw it carried, so
// a stream opened again later says where this page actually is.
//
// **It decides nothing a press is checked on.** The press is still a person's
// click on a form this origin drew, minted on the server (D-0059 section 5a);
// this only keeps the token in that form the one the server now holds, which
// is what reloading the page used to do.
//
// `retry` is the host's, so a host that is down is a reconnect that waits.
// Inside a function for `page/changed.js`'s reason: classic scripts share one
// top-level scope. Served under `script-src 'self'`, its digest in
// `page.manifest.json`.

(() => {
  if (typeof EventSource === "undefined") {
    return;
  }
  let source = null;
  const changed = () => {
    document.body.dispatchEvent(new CustomEvent("rondo:change", { bubbles: false }));
  };
  /** Where this page is now: the view it is on, and the draw it is holding. */
  const asking = () => {
    const search = location.search;
    const drawn = document.getElementById("ledger")?.getAttribute("data-drawn-at");
    const at = drawn ? `${search === "" ? "?" : "&"}at=${encodeURIComponent(drawn)}` : "";
    return `/events${search}${at}`;
  };
  const listen = () => {
    source = new EventSource(asking());
    source.addEventListener("token", (event) => {
      for (const input of document.querySelectorAll('input[name="token"]')) {
        input.value = event.data;
      }
      for (const at of document.querySelectorAll("[data-notice-token]")) {
        at.setAttribute("data-notice-token", event.data);
      }
    });
    source.addEventListener("change", changed);
  };
  listen();
  // A page brought back from the browser's cache may have had its source
  // closed on the way in; open it again, which also reads the token now -- and
  // hands back the mark this page was last drawn at, so anything written while
  // it was away is one redraw the host asks for and nothing is redrawn where
  // nothing moved.
  addEventListener("pageshow", (event) => {
    if (event.persisted) {
      source?.close();
      listen();
    }
  });
})();
