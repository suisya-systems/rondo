// What an open tab does when the person's turn comes (rondo#311, plan 2).
//
// The page already reads itself every five seconds. This is the whole of the
// addition: notice when the number of requests waiting on the person goes *up*
// between two of those readings, and ring once.
//
// **It decides nothing about waiting.** The number comes off `#ledger`'s
// `data-turns`, which the server writes from the same reading the list's
// *your turn* is drawn from (`src/access/page-logic/waits.ts`), and the
// sentence comes off `data-chime` in the language this request resolved. A tab
// that worked out for itself what "waiting" means would be the second reading
// #206 is about, in a browser.
//
// **Up, and not merely non-zero.** A turn that is still waiting is one the
// person has already been rung for, or has decided to leave; ringing on every
// poll while it stands is a program nobody leaves open.
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

/** The number on the element the poll swaps, or null where there is none. */
const waitingNow = () => {
  const at = document.querySelector("#ledger");
  const said = at === null ? null : at.getAttribute("data-turns");
  if (said === null) {
    return null;
  }
  const count = Number(said);
  return Number.isInteger(count) && count >= 0 ? count : null;
};

/** The sentence the server composed, or null where this view carries none. */
const sentence = () => document.querySelector("#ledger")?.getAttribute("data-chime") ?? null;

// What the last reading of this tab said. A view with no `#ledger` -- the
// answer view, which has no refresh either -- leaves this null, and the first
// view that has one is a starting point rather than a rise from zero.
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
  // **Only a rise, and only against a reading we have.** The first swap after
  // a view that had no count establishes one instead of ringing off it.
  if (waiting !== null && now > waiting) {
    ring();
  }
  waiting = now;
});
