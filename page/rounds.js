// A form a person is filling in is not swapped under them (rondo#494 items 2
// and 3, DECISIONS.md D-0166).
//
// The five-second redraw merges in place (`src/access/web.tsx`, D-0054 rule
// 2), and a form the server draws under the same id can come back as a
// different form: the flow's ask as a new round of points, the claim or the
// revise box as another gate's. `page/composer.js` keeps what was typed under
// the *old* form's key, and the morph then hands the field the new form's
// words -- so on lap 18 the owner, halfway through four answers, was looking
// at three of rondo's own, and the press sent them.
//
// So: **a form whose `data-round` changes while a field holds the person's
// words is kept as it is**, and a notice inside it says what changed, with the
// two ways on: take the new form, or -- where the server says the old one can
// still be answered, by drawing the same `data-round-keeps` on both -- keep
// answering this one. Until one is chosen a press of the kept form is held
// here and the notice is what it lands on; the page sends nothing.
//
// **It decides nothing about the forms.** Which form is which is the server's
// `data-round`; what counts as one item of it, and what moves to the new form
// when it is taken, are `data-round-item` and `data-round-carry`; every word
// it shows is on the form, in the person's language (D-0079). A form with no
// edits is left to the morph, and `page/changed.js` washes the change.
//
// Classic script, so everything is inside a function (`page/changed.js` says
// why); its digest is in `page.manifest.json`.

(() => {
  if (typeof Idiomorph === "undefined") {
    return;
  }
  const NOTICE = "data-round-notice";

  /** Each kept form: the server's newest form for it, and the round declined. */
  const held = new WeakMap();

  /** Whether a field of the form holds words the server did not draw. */
  const edited = (form) =>
    [...form.querySelectorAll("textarea, input:not([type=hidden])")].some(
      (field) => field.value !== field.defaultValue,
    );

  const items = (form) =>
    [...form.querySelectorAll("[data-round-item]")].map((item) => item.dataset.roundItem);

  /** The second form can be answered instead of the first, as the server drew them. */
  const keeps = (form, next) =>
    (form.dataset.roundKeeps ?? "") !== "" && form.dataset.roundKeeps === next.dataset.roundKeeps;

  const line = (tag, text) => {
    const node = document.createElement(tag);
    node.textContent = text;
    return node;
  };

  const list = (form, label, said) => {
    if (said.length === 0) {
      return [];
    }
    const ul = document.createElement("ul");
    for (const one of said) {
      ul.append(line("li", one));
    }
    return [line("p", form.dataset[label] ?? ""), ul];
  };

  const button = (form, act, label) => {
    const press = line("button", form.dataset[label] ?? "");
    press.type = "button";
    press.dataset.roundAct = act;
    return press;
  };

  /** The notice, drawn again for the newest form; textContent only. */
  const notify = (form, next) => {
    form.querySelector(`[${NOTICE}]`)?.remove();
    const before = items(form);
    const after = items(next);
    const notice = document.createElement("div");
    notice.setAttribute(NOTICE, "");
    notice.setAttribute("role", "alert");
    notice.tabIndex = -1;
    const acts = document.createElement("div");
    acts.append(button(form, "use", "roundUseLabel"));
    if (keeps(form, next)) {
      acts.append(button(form, "keep", "roundKeepLabel"));
    }
    notice.append(
      line("p", form.dataset.roundSaid ?? ""),
      ...list(
        form,
        "roundGone",
        before.filter((one) => !after.includes(one)),
      ),
      ...list(
        form,
        "roundAdded",
        after.filter((one) => !before.includes(one)),
      ),
      acts,
    );
    form.prepend(notice);
  };

  const prior = Idiomorph.defaults.callbacks.beforeNodeMorphed;
  Idiomorph.defaults.callbacks.beforeNodeMorphed = (old, next) => {
    if (
      old instanceof HTMLFormElement &&
      old.dataset.round !== undefined &&
      // A pressed form is `page/composer.js`'s: it is on its way to another page.
      old.dataset.pressed === undefined &&
      next instanceof HTMLFormElement
    ) {
      const kept = held.get(old);
      if (next.dataset.round !== old.dataset.round && (kept !== undefined || edited(old))) {
        held.set(old, { next: next.cloneNode(true), declined: kept?.declined ?? null });
        if (kept?.declined !== next.dataset.round) {
          notify(old, next);
        }
        return false;
      }
      // The server is drawing the form the person holds again: nothing to say.
      held.delete(old);
    }
    return prior?.(old, next);
  };

  document.addEventListener("click", (event) => {
    const press = event.target instanceof Element ? event.target.closest("[data-round-act]") : null;
    const form = press?.closest("form");
    const kept = form ? held.get(form) : undefined;
    if (kept === undefined) {
      return;
    }
    form.querySelector(`[${NOTICE}]`)?.remove();
    if (press.dataset.roundAct === "keep") {
      kept.declined = kept.next.dataset.round;
      return;
    }
    // **What the person wrote goes with them where it still means the same**:
    // a field with the same `data-round-carry` on the new form, and only for
    // the same candidate -- one's request is not another's (Codex). The input
    // event is what `page/composer.js` keeps a draft from.
    const fresh = kept.next;
    const carried = keeps(form, fresh) ? form.querySelectorAll("[data-round-carry]") : [];
    for (const field of carried) {
      const to = fresh.querySelector(
        `[data-round-carry="${CSS.escape(field.dataset.roundCarry)}"]`,
      );
      if (to !== null && field.value !== field.defaultValue) {
        to.value = field.value;
      }
    }
    held.delete(form);
    form.replaceWith(fresh);
    for (const field of fresh.querySelectorAll("[data-round-carry]")) {
      if (field.value !== field.defaultValue) {
        field.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
  });

  // **A press of a form whose round changed, before the person chose, is not
  // sent** (rondo#494 item 2): it would answer what they were not looking at.
  // Capture, so it is cancelled before `page/composer.js` marks it pressed.
  document.addEventListener(
    "submit",
    (event) => {
      const notice = event.target.querySelector?.(`[${NOTICE}]`);
      if (notice) {
        event.preventDefault();
        notice.querySelector("[data-round-held]")?.remove();
        const said = line("p", event.target.dataset.roundHeldLabel ?? "");
        said.dataset.roundHeld = "";
        notice.append(said);
        notice.focus();
      }
    },
    true,
  );
})();
