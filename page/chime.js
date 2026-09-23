// What an open tab does when the person's turn comes (rondo#311 plan 2, and
// rondo#414).
//
// The page already reads itself every five seconds. This is the whole of the
// addition: notice when a wait this tab has never seen appears in one of those
// readings, and say so in three places a person looking elsewhere can see --
// the tab's title, its icon, and (where the browser was given leave) a
// notification from the operating system.
//
// **It decides nothing about waiting.** The waits come off `#ledger`'s
// `data-waits`, which the server writes from the same pass the list's *your
// turn* is drawn from (`src/access/page-logic/waits.ts`), and every word and
// every icon comes off the ledger's other `data-` attributes in the language
// this request resolved. A tab that worked out for itself what "waiting" means
// would be the second reading #206 is about, in a browser.
//
// **A key this tab has not seen, and not a count that went up** (Codex, round
// 3). A second question arriving in a request that was already waiting, or one
// request settling in the same five seconds another opens, leaves the number
// of waiting requests exactly where it was. So what is compared is the set:
// each wait carries a key that is new exactly when the wait is, which is the
// same test the host's own tick makes.
//
// **And a wait this tab has already seen is not rung again** -- while it
// stands, and when it comes back (lap 11). The keys are added up for as long
// as the tab lives and never forgotten.
//
// **For as long as the tab lives, and not the document** (rondo#414). The
// keys are kept in `sessionStorage`, which belongs to the tab and outlives a
// navigation inside it. Lap 12's gate is why: the start press answered only
// when the lap reached its gate, so the document it landed on already held
// the gate, a tab that started again from "whatever the document arrived
// holding" counted it as seen, and nothing rang at all. Now a document that
// arrives holding a wait this tab has never seen rings for it like a redraw
// does. A tab opened fresh -- or one whose storage is refused -- still starts
// from what is on its screen, because the person is looking at it.
//
// **`127.0.0.1` is a secure context**, so `Notification` is available here
// without TLS. It is still absent in some browsers and refused in others, and
// every path below treats that as the ordinary case: the title and the icon
// need no leave from anybody and change regardless.
//
// **What happened is told to the host** (rondo#414): which waits rang, and
// whether the operating system showed a notification or why not, so a lap's
// record can say whether the tab's notice fired rather than guess at it.
//
// Served as a file under `script-src 'self'`, and its digest is in
// `page.manifest.json` beside everything else the browser receives.

const supported = "Notification" in window;
const KEPT = "rondo:seen-waits";

const ledger = () => document.querySelector("#ledger");

/** The wait keys on the element the poll swaps, or null where there are none. */
const waitingNow = () => {
  const said = ledger()?.getAttribute("data-waits") ?? null;
  if (said === null) {
    return null;
  }
  try {
    const keys = JSON.parse(said);
    // An attribute this tab cannot read is a reading it does not have, which
    // is the same case as a view that carries none: nothing rings off it and
    // nothing is remembered from it.
    return Array.isArray(keys) && keys.every((key) => typeof key === "string")
      ? new Set(keys)
      : null;
  } catch {
    return null;
  }
};

/** The keys this tab kept from its earlier documents, or null for a fresh tab. */
const kept = () => {
  try {
    const keys = JSON.parse(sessionStorage.getItem(KEPT) ?? "null");
    return Array.isArray(keys) && keys.every((key) => typeof key === "string")
      ? new Set(keys)
      : null;
  } catch {
    return null;
  }
};

const keep = (keys) => {
  try {
    sessionStorage.setItem(KEPT, JSON.stringify([...keys]));
  } catch {
    // Storage refused: this document still remembers; the next one starts
    // from its own screen, which is how every tab behaved before rondo#414.
  }
};

// Every key this tab has seen. Null until a reading gives it a starting point.
let seen = kept();

// **The title says whose turn it is until the tab is looked at.** Set when a
// new wait rings while the person is elsewhere; cleared the moment the tab is
// visible and focused, which is the only evidence a page has of being seen.
let turn = false;
const looking = () => document.visibilityState === "visible" && document.hasFocus();

/** The title and the icon, off the reading on the screen. */
const show = () => {
  const at = ledger();
  if (at === null) {
    return;
  }
  const title = at.getAttribute(turn ? "data-title-turn" : "data-title");
  if (title !== null && document.title !== title) {
    document.title = title;
  }
  const icon = document.querySelector('link[rel="icon"]');
  const href = at.getAttribute("data-icon");
  // Compared first: a link whose `href` is written again is fetched again,
  // every five seconds, for nothing.
  if (icon !== null && href !== null && icon.getAttribute("href") !== href) {
    icon.setAttribute("href", href);
  }
};

/**
 * Tell the host what the notice did for these waits. Best effort and never
 * retried: the report is the record of a notice, and a notice that cannot be
 * recorded has still been given.
 */
const report = (waits, outcome) => {
  const at = ledger();
  const to = at?.getAttribute("data-notice-to") ?? null;
  const token = at?.getAttribute("data-notice-token") ?? null;
  if (to === null || token === null || typeof fetch !== "function") {
    return;
  }
  // In batches of the route's own limit (Codex, round 1): one navigation can
  // bring more new waits than one report may carry, and a refused report is
  // one never sent again.
  for (let at = 0; at < waits.length; at += 32) {
    const body = new URLSearchParams({ token, outcome });
    for (const wait of waits.slice(at, at + 32)) {
      body.append("wait", wait);
    }
    try {
      fetch(to, { method: "POST", body, credentials: "same-origin" }).catch(() => {});
    } catch {
      // Nothing on the screen depends on it.
    }
  }
};

// **The button, and only while the browser has no answer to keep.** A browser
// grants this from a person's own press, so there is no asking without one;
// once it has been answered, either way, the button offers a choice that has
// already been made and is left hidden.
const ask = document.querySelector("#chime-ask");
if (ask !== null && supported && Notification.permission === "default") {
  ask.hidden = false;
  ask.addEventListener("click", () => {
    ask.hidden = true;
    // `.then` rather than `await`: Safari answers this with a callback and no
    // promise, and a rejected or absent promise here must not take the rest of
    // the script with it.
    try {
      const asked = Notification.requestPermission();
      if (asked !== undefined && typeof asked.catch === "function") {
        asked.catch(() => {});
      }
    } catch {
      // A browser that refuses to be asked has answered the question.
    }
  });
}

const ring = (fresh) => {
  if (!looking()) {
    turn = true;
  }
  show();
  const line = ledger()?.getAttribute("data-chime") ?? null;
  if (!supported) {
    report(fresh, "unsupported");
    return;
  }
  if (Notification.permission !== "granted" || line === null) {
    // `default` is a browser nobody has asked yet; `denied` one that was
    // asked and said no. The two are fixed differently, so they are told
    // apart.
    report(fresh, Notification.permission === "denied" ? "denied" : "notAsked");
    return;
  }
  try {
    // `tag` so that a notification still on screen is replaced rather than
    // stacked: two tabs of the same page are two readings of one fact, and the
    // person is owed one line, not one per tab.
    const shown = new Notification(line, { tag: "rondo-your-turn" });
    // **`show`, and not the constructor returning**, is what says it fired: a
    // browser may take the object and then have the system refuse to draw it.
    shown.onshow = () => report(fresh, "shown");
    shown.onerror = () => report(fresh, "failed");
    // A click brings the person to the tab the notice is about.
    shown.onclick = () => {
      window.focus();
      shown.close();
    };
  } catch {
    // Some browsers refuse a constructed notification outside a service
    // worker. The title and the icon have already changed.
    report(fresh, "failed");
  }
};

/** One reading: the title and icon, and a ring for any wait this tab has not seen. */
const read = () => {
  show();
  const now = waitingNow();
  if (now === null) {
    return;
  }
  // **Only a key we have not seen, and only against a reading we have.** A
  // tab's first reading establishes a starting point instead of ringing off
  // every wait already on the screen.
  if (seen === null) {
    seen = now;
  } else {
    const fresh = [...now].filter((key) => !seen.has(key));
    for (const key of now) {
      seen.add(key);
    }
    if (fresh.length > 0) {
      ring(fresh);
    }
  }
  keep(seen);
};

const seenNow = () => {
  if (turn && looking()) {
    turn = false;
    show();
  }
};

document.addEventListener("htmx:afterSwap", read);
document.addEventListener("visibilitychange", seenNow);
window.addEventListener("focus", seenNow);
read();
