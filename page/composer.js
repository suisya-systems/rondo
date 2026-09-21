// The composer script (DECISIONS.md D-0059 section 5a): exactly two duties.
//
// 1. **Keep the unsent draft.** What a person types into the composer
//    (`textarea[data-draft]`, keyed by that attribute: a new request, or one
//    thread's reply) is kept in `sessionStorage` and put back whenever the
//    boxes are drawn again -- on load, so a navigation (a press, `Reply` on
//    another message, a language switch) does not throw it away, and after an
//    in-place redraw, because since D-0083 the boxes are inside the thread and
//    the five-second swap reaches them. It is cleared after a successful send
//    and never before: on htmx's own report that the send succeeded, or, for a
//    native submit, when the page the `303` landed on is anchored at the id
//    that submit carried (the anchor exists only after the send was recorded).
//    `Ctrl`/`Cmd`+`Enter` asks a send form to submit, which is the same submit
//    its button makes. The approve bar's claim box (#220 S2) is a draft too,
//    keyed per gate, and is never submitted by that chord; neither is an answer
//    to a waiting question (#206), whose form has one button per answer and no
//    submit that means both.
// 2. **Keep the folds a person opened** -- across the in-place redraw, which
//    would otherwise merge them shut every five seconds, and across a navigation, so a fold
//    opened before a press is open on the page the press lands on. The ids are
//    kept in `sessionStorage`; any fold with one of them that arrives shut is
//    opened again. With script off `page/app.css` draws every fold open.
//
// **It makes no request and builds no `POST`.** It reads and writes
// `sessionStorage` in this tab and nothing a server reads; the only write this
// page can make is still a form's own submit, minted on the server (section
// 5a). Served under `script-src 'self'`, its digest in `page.manifest.json`.

// A copy in this document's memory beside `sessionStorage`, so storage that is
// refused (a private window, a full quota) still keeps words across an in-place
// send; only a navigation needs the storage itself (#220 S1, Codex).
const memory = new Map();
const store = {
  get(key) {
    try {
      return sessionStorage.getItem(key) ?? memory.get(key) ?? null;
    } catch {
      return memory.get(key) ?? null;
    }
  },
  set(key, value) {
    value === null ? memory.delete(key) : memory.set(key, value);
    try {
      value === null ? sessionStorage.removeItem(key) : sessionStorage.setItem(key, value);
    } catch {
      // Storage refused: the memory copy above is what is left.
    }
  },
};

// -- 1. The draft --

const draftKey = (box) => `rondo:draft:${box.dataset.draft}`;
// **The box with this draft's own key, and never the first one on the page**
// (Codex, on D-0083): the thread carries several -- the gate's claim, what to
// change beside it, and the reply box under them -- so the first is whichever
// the layout puts first, and clearing it after a send would empty a field
// nobody sent.
const boxFor = (key) => document.querySelector(`textarea[data-draft="${CSS.escape(key)}"]`) ?? null;

// A fragment that is not valid percent-encoding is not a landing, and must not
// stop the rest of this script (#220 S1, Codex).
let landed = "";
try {
  landed = decodeURIComponent(location.hash.slice(1));
} catch {
  landed = "";
}
const sentFrom = landed === "" ? null : store.get(`rondo:sent:${landed}`);
if (sentFrom !== null) {
  store.set(sentFrom, null);
  store.set(`rondo:sent:${landed}`, null);
}
// **Every box on the page and not the first one** (rondo#233 S4): the gate now
// carries two -- the claim beside `approve`, and what to change beside *ask for
// a change* -- and restoring only the first would throw away the words a person
// edited into the other on the way back from a refused press. A kept draft wins
// over what the server drew, which matters for exactly one of them: the revise
// box arrives holding rondo's own draft, and a person who rewrote it gets their
// own words back rather than the draft again. Emptying the box is kept as an
// empty draft (the `input` listener below), so a redraw does not put rondo's
// words back under a person who deleted them -- and a load reads that as no
// draft, which is how clearing the box and reloading brings the draft back.
//
// **A draft that landed after the person began is said, not put in** (D-0077
// rule 4.4): what the server drew when they began is kept beside their words,
// and a box that now arrives holding something else shows the note drawn for
// it in place of the line saying the box holds the draft -- their words stay,
// and the note says how to see the draft.
const drewKey = (box) => `rondo:drew:${box.dataset.draft}`;
// **Run on every swap and not only on load** (D-0083): the boxes are inside
// the thread now, so the five-second redraw replaces them and hands back what
// the server drew. Restoring only at load meant a claim being typed vanished
// on the next poll, and a revise box a person had rewritten came back holding
// rondo's draft again. A box whose value already matches is left alone, so
// restoring does not move a caret.
const restore = (afterSwap) => {
  for (const opening of document.querySelectorAll("textarea[data-draft]")) {
    const kept = store.get(draftKey(opening));
    // **An empty string is a person who cleared the box** (Codex), and the two
    // callers read it differently on purpose. After a swap it is restored: the
    // revise box arrives holding rondo's draft, and a redraw that treated
    // *emptied* as *no draft* would put those words back five seconds after
    // they were deleted. On a load it is not, which is what keeps clearing the
    // box and reloading the way rondo's own draft comes back. `null` is the
    // absence either way -- nothing typed, or a send that cleared it -- and
    // then the server's own value stands.
    if (kept === null || (kept === "" && !afterSwap)) {
      continue;
    }
    // Read before the value is compared and not after it: since the redraw
    // morphs, a box a person is writing in keeps their words, so "the value
    // already matches" no longer means nothing new was drawn under it -- the
    // morph moved the server's words into `defaultValue` alone.
    const drawn = opening.defaultValue;
    if (drawn !== "" && drawn !== kept && drawn !== (store.get(drewKey(opening)) ?? "")) {
      for (const note of document.querySelectorAll("[data-draft-arrived]")) {
        if (note.dataset.draftArrived === opening.dataset.draft) {
          note.hidden = false;
        }
      }
      for (const line of document.querySelectorAll("[data-draft-state]")) {
        if (line.dataset.draftState === opening.dataset.draft) {
          line.hidden = true;
        }
      }
    }
    if (opening.value !== kept) {
      opening.value = kept;
    }
  }
};
restore(false);

document.addEventListener("input", (event) => {
  if (event.target instanceof HTMLTextAreaElement && event.target.dataset.draft !== undefined) {
    const emptied = event.target.value === "";
    // Emptied is kept as the empty string and not as an absence: `restore`
    // above puts it back after a redraw and not on a load, which is what lets
    // clearing the box and reloading bring rondo's own draft back.
    store.set(draftKey(event.target), event.target.value);
    // What was drawn when the person began, kept until they empty the box:
    // editing words put back over a later draft must not make that draft
    // look like the one they began from.
    if (emptied) {
      store.set(drewKey(event.target), null);
    } else if (store.get(drewKey(event.target)) === null) {
      store.set(drewKey(event.target), event.target.defaultValue);
    }
  }
});

// Which draft a submit carried, by the id it carried, for the landing above.
// **Only a native submit**: htmx has already cancelled the one it sends (its
// listener on the form runs before this one on the document), and that send
// never lands on a page load, so a marker left for it would outlive the send
// and wipe a later draft on any load anchored at that id -- a basis chip that
// cites the message, a reload (#220 S1 review).
document.addEventListener("submit", (event) => {
  const draft = event.target.querySelector?.("textarea[data-draft]");
  const id = event.target.querySelector?.("input[name=message_id]")?.value;
  if (draft && id && !event.defaultPrevented) {
    store.set(`rondo:sent:${id}`, draftKey(draft));
  }
});

// The words a send carried, so that only those are cleared when it succeeds:
// the box stays editable while the send is in flight, and what a person typed
// meanwhile was never sent (#220 S1, Codex).
// Read back from this tab's store and not off the box, because the response
// has replaced the form (its target can change mode) by the time htmx says the
// send succeeded; the input listener above kept the store current meanwhile.
let sending = null;
document.addEventListener("htmx:beforeRequest", (event) => {
  const draft = event.detail.elt.querySelector?.("textarea[data-draft]");
  if (draft) {
    sending = draft.value;
  }
});

document.addEventListener("htmx:afterRequest", (event) => {
  // **Only the send's own request** (#220 S1, Codex): after an outerHTML swap
  // htmx reports the redraw's end on a surviving ancestor, whose descendants
  // include the box, so the element alone would take a poll for a send.
  if (event.detail.requestConfig?.verb !== "post") {
    return;
  }
  const draft = event.detail.elt.querySelector?.("textarea[data-draft]");
  if (draft && event.detail.successful) {
    const now = store.get(draftKey(draft)) ?? "";
    // Words added after the sent ones are what is left; a draft rewritten
    // meanwhile is kept whole, since which part was sent cannot be told.
    const rest =
      sending !== null && now.startsWith(sending) ? now.slice(sending.length).trimStart() : now;
    const unsent = rest === "" ? null : rest;
    store.set(draftKey(draft), unsent);
    const current = boxFor(draft.dataset.draft);
    if (current !== null) {
      current.value = unsent ?? "";
    }
  }
  // A refusal that came from before the send route (Hono's own `csrf`, the
  // `Host` check, a defect) carries no `#send-refused` for htmx to put under the
  // draft; the note says the catalogue's generic line instead of nothing.
  const note = document.getElementById("composer-note");
  if (draft && event.detail.failed && note !== null && note.textContent === "") {
    note.textContent = note.dataset.refused ?? "";
  }
});

document.addEventListener("keydown", (event) => {
  const target = event.target;
  if (
    event.key === "Enter" &&
    (event.ctrlKey || event.metaKey) &&
    target instanceof HTMLTextAreaElement &&
    target.dataset.draft !== undefined &&
    // **Never the approve press** (#220 S2): the claim box keeps its draft here
    // too, and a chord typed while writing a claim must not answer a gate. Only
    // a send carries a message id.
    target.form?.querySelector("input[name=message_id]") &&
    // **Never a waiting question either** (#206, D-0072 rule 4): that form has
    // one button per answer, and which of them is pressed is the whole content
    // of the press. `requestSubmit()` names no submitter, so the chord would
    // send no answer at all -- and rondo must not pick one. A person answering
    // presses the answer they mean; the hint for this chord is not drawn there.
    !target.form?.querySelector("button[name=outcome]")
  ) {
    event.preventDefault();
    target.form?.requestSubmit();
  }
});

// -- 2. The folds --

const FOLDS = "rondo:folds";
let opened;
try {
  opened = new Set(JSON.parse(store.get(FOLDS) ?? "[]"));
} catch {
  opened = new Set();
}
const reopen = () => {
  for (const id of opened) {
    const fold = document.getElementById(id);
    if (fold instanceof HTMLDetailsElement && !fold.open) {
      fold.open = true;
    }
  }
};
// `toggle` does not bubble, so it is heard on the way down.
document.addEventListener(
  "toggle",
  (event) => {
    const fold = event.target;
    if (fold instanceof HTMLDetailsElement && fold.id !== "") {
      fold.open ? opened.add(fold.id) : opened.delete(fold.id);
      store.set(FOLDS, JSON.stringify([...opened]));
    }
  },
  true,
);
reopen();
// Both duties run on every swap: the folds a person opened, and the words they
// typed. A swap that replaced either would be the redraw taking something back
// that nobody sent. The observer hears a node that arrived; `htmx:afterSwap`
// hears a redraw that was merged into nodes already here, which adds none.
const redrawn = () => {
  reopen();
  restore(true);
};
new MutationObserver(redrawn).observe(document.body, { childList: true, subtree: true });
document.addEventListener("htmx:afterSwap", redrawn);

// **And the merge itself is told what is the person's** (D-0054 rule 2, as
// D-0059's annotation of 2026-09-21 restores it). The redraw is idiomorph's
// morph, which keeps the nodes a person is standing on -- a face's scroll, the
// caret -- but would still copy the server's attributes and values onto them.
// Two of those are the two duties above: a fold's `open`, which the server
// never draws and a person's click gave, and the words in a draft box. So the
// morph leaves exactly those alone, and everything else the server sent
// arrives. It makes no request; it is configuration of the swap htmx already
// does.
if (typeof Idiomorph !== "undefined") {
  Idiomorph.defaults.ignoreActiveValue = true;
  Idiomorph.defaults.callbacks.beforeAttributeUpdated = (name, element) =>
    !(
      (name === "open" && element instanceof HTMLDetailsElement) ||
      (name === "value" &&
        element instanceof HTMLTextAreaElement &&
        element.dataset.draft !== undefined)
    );
}
