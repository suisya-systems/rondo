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
document.addEventListener("submit", (event) => {
  const draft = event.target.querySelector?.("textarea[data-draft]");
  const id = event.target.querySelector?.("input[name=message_id]")?.value;
  if (draft && id) {
    store.set(`rondo:sent:${id}`, draftKey(draft));
  }
});

document.addEventListener("htmx:afterRequest", (event) => {
  const draft = event.detail.elt.querySelector?.("textarea[data-draft]");
  if (draft && event.detail.successful) {
    store.set(draftKey(draft), null);
    draft.value = "";
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
