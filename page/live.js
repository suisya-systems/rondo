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
// **Which is why this script reopens the stream itself.** A browser left to
// reconnect a dropped `EventSource` asks the address it was given and sends
// the id of the last frame it *received*, and neither of those says what this
// page is showing now: a redraw that was asked for and then failed to fetch,
// or was cut off mid-fetch, leaves `#ledger` on the older draw, and a
// reconnect that claimed otherwise would be agreed with and the older draw
// would stay on the screen. So a stream that fails is closed here and opened
// again after a wait of this script's own, on an address built from `#ledger`
// as it stands at that moment.
//
// **And one answer, and one only, ends the asking.** A host with no form to
// draw and nothing to watch answers `/events` with a `204`, which is how it
// says there is nothing here to listen to. Asking that again on a backoff
// would be the very thing rondo#742 removed -- a page and a host doing work
// every few seconds while nothing changes -- so a `204` is the end of
// listening, and nothing else is.
//
// **Which the state of the source cannot say.** `EventSource` reports that a
// stream failed and never reports why: a `204`, an HTTP `500` from a host
// part-way through starting, and a host that is not listening at all each
// arrive as one `error` with the source in `CLOSED`, because anything that is
// not a `200` of the right type ends that source for good. Reading `CLOSED`
// as "there is nothing here" gives up on a host that is about to come back
// and leaves the page on an old screen for as long as it stays open. So the
// ground for stopping is read off the answer itself: on a failure, and only
// then, this asks the same address once with `fetch` and looks at the status.
// `204` is the end; every other answer, and a request that could not be made
// at all, is a host to ask again.
//
// **A growing wait, so that neither side works while nothing changes.** A
// host that is down is asked again after a second, then two, then five, then
// every thirty; a stream that opens resets that, so the next drop is answered
// as quickly as the first. No wait is ever running while a stream is open,
// and the page that comes back is redrawn by the host's own comparison
// against the draw it is holding -- so what was written while it was down is
// one redraw and a quiet host is still silence.
//
// **It decides nothing a press is checked on.** The press is still a person's
// click on a form this origin drew, minted on the server (D-0059 section 5a);
// this only keeps the token in that form the one the server now holds, which
// is what reloading the page used to do.
//
// Inside a function for `page/changed.js`'s reason: classic scripts share one
// top-level scope. Served under `script-src 'self'`, its digest in
// `page.manifest.json`.

(() => {
  if (typeof EventSource === "undefined") {
    return;
  }
  // What this page waits before it opens a failed stream again, growing and
  // then capped: a host that is down is asked less and less often, and a host
  // that comes back is found within half a minute of coming back.
  const AGAIN_MS = [1000, 2000, 5000, 30000];
  // The one answer that means there is nothing here to listen to: no token to
  // hand out and no bell to watch.
  const NOTHING_TO_HEAR = 204;
  let source = null;
  let again = null;
  // How many times in a row a stream has failed, which is the wait before the
  // next attempt. A stream that opens puts it back to none.
  let failures = 0;
  // Which stream this page is on. An `error` from a stream this page has
  // already replaced decides nothing, and the asking below is awaited, so the
  // answer to it is only acted on while the stream that failed is still the
  // one being listened for.
  let era = 0;
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
  /**
   * Whether the answer this address gives is the one that ends the asking.
   *
   * One request, made only after a failure, whose body is dropped as soon as
   * the status has been read -- so a host that is up and would have held a
   * stream open is not left holding a second one. A request that could not be
   * made at all is a host to ask again, which is the same answer as any status
   * that is not the `204`.
   */
  const ending = async () => {
    if (typeof fetch === "undefined") {
      return false;
    }
    const drop = new AbortController();
    try {
      const answer = await fetch(asking(), {
        headers: { accept: "text/event-stream" },
        cache: "no-store",
        signal: drop.signal,
      });
      return answer.status === NOTHING_TO_HEAR;
    } catch {
      return false;
    } finally {
      drop.abort();
    }
  };
  const listen = () => {
    if (again !== null) {
      clearTimeout(again);
      again = null;
    }
    source?.close();
    era += 1;
    const mine = era;
    source = new EventSource(asking());
    // A stream that opened is a host that is up: whatever this page waited to
    // get here is spent, and the next failure waits the shortest spacing.
    source.addEventListener("open", () => {
      failures = 0;
    });
    source.addEventListener("token", (event) => {
      for (const input of document.querySelectorAll('input[name="token"]')) {
        input.value = event.data;
      }
      for (const at of document.querySelectorAll("[data-notice-token]")) {
        at.setAttribute("data-notice-token", event.data);
      }
    });
    source.addEventListener("change", changed);
    // The browser would reconnect this itself, at the address it was given and
    // with the id it last received; closing it here is what keeps the next
    // stream's `at` the draw this page is really showing. Whether there is a
    // next stream at all is decided by what the address answers, and never by
    // the state of the source: `CLOSED` is every failure there is, from the
    // `204` that ends the asking to the `500` of a host that is starting up.
    source.addEventListener("error", () => {
      if (mine !== era) {
        return;
      }
      source?.close();
      source = null;
      void (async () => {
        const done = await ending();
        if (mine !== era || done || again !== null) {
          return;
        }
        const waits = AGAIN_MS[failures < AGAIN_MS.length ? failures : AGAIN_MS.length - 1];
        failures += 1;
        again = setTimeout(listen, waits);
      })();
    });
  };
  listen();
  // A page brought back from the browser's cache may have had its source
  // closed on the way in; open it again, which also reads the token now -- and
  // hands back the mark this page was last drawn at, so anything written while
  // it was away is one redraw the host asks for and nothing is redrawn where
  // nothing moved.
  addEventListener("pageshow", (event) => {
    if (event.persisted) {
      listen();
    }
  });
})();
