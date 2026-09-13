// The composer script (DECISIONS.md D-0059 section 5a): exactly two duties.
//
// 1. **Keep the unsent draft.** What a person types into the composer
//    (`textarea[data-draft]`, keyed by that attribute: a new request, or one
//    thread's reply) is kept in `sessionStorage` and put back when the page
//    loads, so a navigation -- a press, `Reply` on another message, a language
//    switch -- does not throw it away. It is cleared after a successful send
//    and never before: on htmx's own report that the send succeeded, or, for a
//    native submit, when the page the `303` landed on is anchored at the id
//    that submit carried (the anchor exists only after the send was recorded).
//    `Ctrl`/`Cmd`+`Enter` asks the form to submit, which is the same submit
//    its button makes.
// 2. **Keep the folds a person opened** -- across the in-place redraw, which
//    replaces them shut every five seconds, and across a navigation, so a fold
//    opened before a press is open on the page the press lands on. The ids are
//    kept in `sessionStorage`; any fold with one of them that arrives shut is
//    opened again. With script off `page/app.css` draws every fold open.
//
// **It makes no request and builds no `POST`.** It reads and writes
// `sessionStorage` in this tab and nothing a server reads; the only write this
// page can make is still a form's own submit, minted on the server (section
// 5a). Served under `script-src 'self'`, its digest in `page.manifest.json`.

const store = {
  get(key) {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      value === null ? sessionStorage.removeItem(key) : sessionStorage.setItem(key, value);
    } catch {
      // Storage refused (a private window, a full quota): the page works without it.
    }
  },
};

// -- 1. The draft --

const draftKey = (box) => `rondo:draft:${box.dataset.draft}`;
const box = () => document.querySelector("textarea[data-draft]");

const landed = decodeURIComponent(location.hash.slice(1));
const sentFrom = landed === "" ? null : store.get(`rondo:sent:${landed}`);
if (sentFrom !== null) {
  store.set(sentFrom, null);
  store.set(`rondo:sent:${landed}`, null);
}
const opening = box();
if (opening !== null && opening.value === "") {
  opening.value = store.get(draftKey(opening)) ?? "";
}

document.addEventListener("input", (event) => {
  if (event.target instanceof HTMLTextAreaElement && event.target.dataset.draft !== undefined) {
    store.set(draftKey(event.target), event.target.value === "" ? null : event.target.value);
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
    const current = box();
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
    target.dataset.draft !== undefined
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
new MutationObserver(reopen).observe(document.body, { childList: true, subtree: true });
