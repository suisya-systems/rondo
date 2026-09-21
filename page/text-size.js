// The text size a person chose (rondo#379, D-0059 R3 as its annotation of
// 2026-09-22 widens it): one duty, remembering it.
//
// The header draws three buttons (`[data-text-size-choice]`); pressing one puts
// its step on the root element as `data-text-size`, which is all `page/app.css`
// reads to move every step of the type scale, and keeps it in `localStorage`,
// so every tab and every later visit in this browser opens at it.
//
// **Loaded without `defer`, in the head, after the stylesheet**, so the root
// carries the step before the body is parsed and the page is never drawn at
// one size and then another. The five-second redraw merges `#ledger` only; the
// root element and the header are outside it, so a redraw cannot take the
// choice back.
//
// **It makes no request and builds no `POST`.** It reads and writes one
// `localStorage` key in this browser and nothing a server reads: the choice is
// not a cookie (`D-0056` rule 5 keeps its one). With the storage refused (a
// private window, blocked site data) the choice lasts until the page is
// loaded again. With script off the buttons stay hidden (`.js-only`) and the
// page is the default scale. Served under `script-src 'self'`, its digest in
// `page.manifest.json`.

const KEY = "rondo:text-size";
// The steps `page/app.css` has a rule for; "" is the default, drawn with no
// attribute at all. Anything else in storage is ignored rather than trusted.
const STEPS = ["", "large", "larger"];

const apply = (step) => {
  const known = STEPS.includes(step) ? step : "";
  if (known === "") {
    document.documentElement.removeAttribute("data-text-size");
  } else {
    document.documentElement.setAttribute("data-text-size", known);
  }
  for (const button of document.querySelectorAll("[data-text-size-choice]")) {
    button.setAttribute(
      "aria-pressed",
      String(button.getAttribute("data-text-size-choice") === known),
    );
  }
};

const stored = () => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};

apply(stored());
// The buttons do not exist yet while this runs in the head.
document.addEventListener("DOMContentLoaded", () => apply(stored()));

document.addEventListener("click", (event) => {
  const button =
    event.target instanceof Element ? event.target.closest("[data-text-size-choice]") : null;
  if (button === null) {
    return;
  }
  const step = button.getAttribute("data-text-size-choice") ?? "";
  apply(step);
  try {
    step === "" ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, step);
  } catch {
    // Storage refused: the choice holds on this page until it is loaded again.
  }
});

// Another tab of this page chose: follow it, so two tabs do not disagree.
window.addEventListener("storage", (event) => {
  if (event.key === KEY || event.key === null) {
    apply(stored());
  }
});
