// The palette a person chose (rondo#590, D-0184): one duty, remembering it,
// the way `page/text-size.js` remembers the text size.
//
// The header draws three buttons (`[data-theme-choice]`): light, dark, and the
// operating system's setting. Pressing light or dark puts it on the root
// element as `data-theme`, which `page/app.css` reads to pin `color-scheme`, and
// keeps it in `localStorage`, so every tab and every later visit in this
// browser opens in it. The system choice is the default: no attribute and no
// key, and `prefers-color-scheme` decides as it did before.
//
// **Loaded without `defer`, in the head, after the stylesheet**, so the root
// carries the choice before the body is parsed and the page is never drawn in
// one palette and then the other. The redraw merges `#ledger` only, which
// holds neither the root element nor the header.
//
// **It makes no request and builds no `POST`.** It reads and writes one
// `localStorage` key in this browser and nothing a server reads. With the
// storage refused the choice lasts until the page is loaded again; with script
// off the buttons stay hidden (`.js-only`) and the page follows the system.
// Served under `script-src 'self'`, its digest in `page.manifest.json`. In
// a block of its own: `page/text-size.js` declares the same names in the one
// global every classic script shares.

{
  const KEY = "rondo:theme";
  // The choices `page/app.css` has a rule for; "" is the system's, drawn with no
  // attribute at all. Anything else in storage is ignored rather than trusted.
  const CHOICES = ["", "light", "dark"];

  const apply = (choice) => {
    const known = CHOICES.includes(choice) ? choice : "";
    if (known === "") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", known);
    }
    for (const button of document.querySelectorAll("[data-theme-choice]")) {
      button.setAttribute(
        "aria-pressed",
        String(button.getAttribute("data-theme-choice") === known),
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
      event.target instanceof Element ? event.target.closest("[data-theme-choice]") : null;
    if (button === null) {
      return;
    }
    const choice = button.getAttribute("data-theme-choice") ?? "";
    apply(choice);
    try {
      choice === "" ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, choice);
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
}
