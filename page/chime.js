// What an open tab does when the person's turn comes (rondo#311, plan 2).
//
// The page already reads itself every five seconds. This is the whole of the
// addition: notice when the number of requests waiting on the person goes *up*
// between two of those readings, and ring once.
//
// **It decides nothing about waiting.** The waits come off `#ledger`'s
// `data-waits`, which the server writes from the same pass the list's *your
// turn* is drawn from (`src/access/page-logic/waits.ts`), and the sentence
// comes off `data-chime` in the language this request resolved. A tab that
// worked out for itself what "waiting" means would be the second reading #206
// is about, in a browser.
//
// **A key this tab has not seen, and not a count that went up** (Codex, round
// 3). A second question arriving in a request that was already waiting, or one
// request settling in the same five seconds another opens, leaves the number
// of waiting requests exactly where it was -- and on a machine with no
// notification program this tab is the only way the person hears anything. So
// what is compared is the set: each wait carries a key that is new exactly
// when the wait is, which is the same test the host's own tick makes.
//
// **And a wait that is still standing is not rung again.** A key already seen
// is a turn the person has been told about, or has decided to leave; ringing
// on every poll while it stands is a program nobody leaves open.
//
// **`127.0.0.1` is a secure context**, so `Notification` is available here
// without TLS. It is still absent in some browsers and refused in others, and
// every path below treats that as the ordinary case: with no notifications the
// page is exactly the page it was.
//
// **Nothing here is remembered across a reload.** The count starts again from
// whatever the document arrived holding, so a reload does not ring for what
// was already on the screen when it was pressed -- and a tab reopened in the
// morning rings for nothing, because the person is looking at it.
//
// Served as a file under `script-src 'self'`, and its digest is in
// `page.manifest.json` beside everything else the browser receives.

const supported = "Notification" in window;

/** The wait keys on the element the poll swaps, or null where there are none. */
const waitingNow = () => {
  const at = document.querySelector("#ledger");
  const said = at === null ? null : at.getAttribute("data-waits");
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

/** The sentence the server composed, or null where this view carries none. */
const sentence = () => document.querySelector("#ledger")?.getAttribute("data-chime") ?? null;

// What the last reading of this tab held. A view with no `#ledger` -- the
// answer view, which has no refresh either -- leaves this null, and the first
// view that has one is a starting point rather than a set of new keys.
let waiting = waitingNow();

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

const ring = () => {
  const line = sentence();
  if (!supported || Notification.permission !== "granted" || line === null) {
    return;
  }
  try {
    // `tag` so that a notification still on screen is replaced rather than
    // stacked: two tabs of the same page are two readings of one fact, and the
    // person is owed one line, not one per tab.
    new Notification(line, { tag: "rondo-your-turn" });
  } catch {
    // Some browsers refuse a constructed notification outside a service
    // worker. The screen is unchanged, which is the failure that costs least.
  }
};

document.addEventListener("htmx:afterSwap", () => {
  const now = waitingNow();
  if (now === null) {
    return;
  }
  // **Only a key we have not seen, and only against a reading we have.** The
  // first swap after a view that carried none establishes a starting point
  // instead of ringing off every wait already on the screen.
  if (waiting !== null && [...now].some((key) => !waiting.has(key))) {
    ring();
  }
  waiting = now;
});
