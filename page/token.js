// The press token, kept current (rondo#674).
//
// Every form on the page carries the token of the process that drew it
// (D-0041 rule 3b), and a host that restarted mints a new one -- so a screen
// drawn before the restart refused the person's next press and asked them to
// reload. The redraw renews the forms of a view that keeps itself current, but
// a screen that holds still (`isLive`) never asked again, and neither did a
// page the browser brought back from its cache.
//
// So this listens on `/events`, which answers with this process's token and
// then ends, and the browser asks again after the `retry` it names: while the
// host is down that is a reconnect that waits, and the first answer after it
// is back is the new token. It is written into every `input[name="token"]`
// and into the notice's `data-notice-token` (`page/chime.js`).
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
  let source = null;
  const listen = () => {
    source = new EventSource("/events");
    source.addEventListener("token", (event) => {
      for (const input of document.querySelectorAll('input[name="token"]')) {
        input.value = event.data;
      }
      for (const at of document.querySelectorAll("[data-notice-token]")) {
        at.setAttribute("data-notice-token", event.data);
      }
    });
  };
  listen();
  // A page brought back from the browser's cache may have had its source
  // closed on the way in; open it again, which also reads the token now.
  addEventListener("pageshow", (event) => {
    if (event.persisted) {
      source?.close();
      listen();
    }
  });
})();
