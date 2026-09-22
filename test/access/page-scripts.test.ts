/**
 * The page's own scripts, run rather than read (D-0059's annotation of
 * 2026-09-21, lap 11).
 *
 * The other suites read `page/*.js` as text, which says what a script contains
 * and not what it does. The two properties lap 11 lost are behaviour -- a tab
 * that rang again for a wait it had already rung for, and a redraw that took
 * back what a person had done to the page -- so these run the real files in a
 * `node:vm` context over the few browser objects each one touches, and nothing
 * else. There is no DOM here, so the morph itself is not run: what is held is
 * what rondo tells it, which is the part rondo wrote.
 */
import { runInNewContext } from "node:vm";
import { expect, test } from "vitest";
import { bytesOf } from "./page-world.js";

type Listener = () => void;

interface ChimeOptions {
  /** What `Notification.permission` answers, or null for a browser without it. */
  readonly permission?: "granted" | "denied" | "default" | null;
  /** The tab's `sessionStorage`, shared across the documents one test loads into it. */
  readonly storage?: Map<string, string>;
  /** Whether the person is looking at the tab. */
  readonly looking?: boolean;
}

/**
 * A tab running `page/chime.js`, whose ledger says the waits it is given.
 * `load` is a new document in the same tab: a fresh run of the script over the
 * same `sessionStorage`, which is what a press that navigates does.
 */
function chimeTab(first: readonly string[] | null, options: ChimeOptions = {}) {
  const storage = options.storage ?? new Map<string, string>();
  let waits = first;
  let looking = options.looking ?? false;
  const rung: string[] = [];
  const reports: { to: string; body: string }[] = [];
  const titles: string[] = [];
  const icon = { href: "/icon.svg" };
  let heard = new Map<string, Listener[]>();
  const permission = options.permission === undefined ? "granted" : options.permission;
  class Notification {
    static permission = permission;
    onshow: Listener | null = null;
    constructor(line: string) {
      rung.push(line);
      queueMicrotask(() => this.onshow?.());
    }
  }
  const ledger = {
    getAttribute: (name: string) =>
      ({
        "data-waits": JSON.stringify(waits),
        "data-chime": "Your turn",
        "data-title":
          waits === null || waits.length === 0 ? "rondo" : `(${String(waits.length)}) rondo`,
        "data-title-turn": "Your turn - rondo",
        "data-icon": waits === null || waits.length === 0 ? "/icon.svg" : "/icon-wait.svg",
        "data-notice-to": "/notice",
        "data-notice-token": "t",
      })[name] ?? null,
  };
  const document = {
    title: "rondo",
    get visibilityState() {
      return looking ? "visible" : "hidden";
    },
    hasFocus: () => looking,
    querySelector: (selector: string) =>
      selector === "#ledger" && waits !== null
        ? ledger
        : selector === 'link[rel="icon"]'
          ? {
              getAttribute: () => icon.href,
              setAttribute: (_: string, value: string) => {
                icon.href = value;
              },
            }
          : null,
    addEventListener: (type: string, listener: Listener) => {
      heard.set(type, [...(heard.get(type) ?? []), listener]);
    },
  };
  const load = () => {
    heard = new Map();
    runInNewContext(bytesOf("page/chime.js").toString("utf8"), {
      window: {
        ...(permission === null ? {} : { Notification }),
        focus: () => {},
        addEventListener: (type: string, listener: Listener) => {
          heard.set(type, [...(heard.get(type) ?? []), listener]);
        },
      },
      Notification,
      URLSearchParams,
      fetch: (to: string, init: { body: URLSearchParams }) => {
        reports.push({ to, body: init.body.toString() });
        return Promise.resolve();
      },
      sessionStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
      document: new Proxy(document, {
        set(target, key, value) {
          if (key === "title") {
            titles.push(value as string);
          }
          return Reflect.set(target, key, value);
        },
      }),
    });
  };
  const fire = (type: string) => {
    for (const listener of heard.get(type) ?? []) listener();
  };
  load();
  return {
    rung,
    reports,
    titles,
    icon,
    storage,
    get title() {
      return document.title;
    },
    redraw(next: readonly string[]) {
      waits = next;
      fire("htmx:afterSwap");
    },
    /** A new document in this tab, arriving holding `next`. */
    navigate(next: readonly string[]) {
      waits = next;
      load();
    },
    look() {
      looking = true;
      fire("visibilitychange");
    },
  };
}

test("a tab rings once for a wait, and never again for one it has seen, even after it went away", () => {
  const tab = chimeTab(["gate:i-0001:awaiting_human"]);
  // What the document arrived holding is a starting point, not news.
  tab.redraw(["gate:i-0001:awaiting_human"]);
  expect(tab.rung).toEqual([]);
  // **A reading that drops the wait and the next that has it again** (lap 11):
  // the same turn, and a tab that remembered only its last reading rang for it
  // again on every return.
  tab.redraw([]);
  tab.redraw(["gate:i-0001:awaiting_human"]);
  expect(tab.rung).toEqual([]);
  // A wait it has never seen rings, once.
  tab.redraw(["gate:i-0001:awaiting_human", "ask:m-0002"]);
  tab.redraw(["gate:i-0001:awaiting_human", "ask:m-0002"]);
  tab.redraw(["ask:m-0002"]);
  tab.redraw(["gate:i-0001:awaiting_human", "ask:m-0002"]);
  expect(tab.rung).toEqual(["Your turn"]);
});

test("a tab that arrived on a view with no ledger starts from the first one it sees", () => {
  const tab = chimeTab(null);
  tab.redraw(["gate:i-0001:awaiting_human"]);
  expect(tab.rung).toEqual([]);
  tab.redraw(["gate:i-0001:awaiting_human", "gate:i-0002:awaiting_human"]);
  expect(tab.rung).toEqual(["Your turn"]);
});

test("a document that arrives in the tab already holding a new wait rings for it (lap 12)", () => {
  // Lap 12: the start press answered only at the gate, so the document it
  // landed on arrived holding the gate. A tab that started again from that
  // document's own reading counted the gate as seen and never rang.
  const tab = chimeTab([]);
  tab.navigate(["gate:i-0001:awaiting_human"]);
  expect(tab.rung).toEqual(["Your turn"]);
  // And a reload of what it has already rung for does not ring again.
  tab.navigate(["gate:i-0001:awaiting_human"]);
  expect(tab.rung).toEqual(["Your turn"]);
});

test("a fresh tab does not ring for what is on its screen", () => {
  const tab = chimeTab(["gate:i-0001:awaiting_human"], { storage: new Map() });
  expect(tab.rung).toEqual([]);
  expect(tab.title).toBe("(1) rondo");
  expect(tab.icon.href).toBe("/icon-wait.svg");
});

test("the title says whose turn it is until the tab is looked at, and the icon carries the badge", () => {
  const tab = chimeTab([]);
  expect(tab.title).toBe("rondo");
  expect(tab.icon.href).toBe("/icon.svg");
  tab.redraw(["gate:i-0001:awaiting_human"]);
  expect(tab.title).toBe("Your turn - rondo");
  expect(tab.icon.href).toBe("/icon-wait.svg");
  // A redraw that changes nothing keeps the turn up.
  tab.redraw(["gate:i-0001:awaiting_human"]);
  expect(tab.title).toBe("Your turn - rondo");
  tab.look();
  expect(tab.title).toBe("(1) rondo");
  // Once answered, the badge goes.
  tab.redraw([]);
  expect(tab.title).toBe("rondo");
  expect(tab.icon.href).toBe("/icon.svg");
});

test("a tab being looked at changes its count but does not take the title over", () => {
  const tab = chimeTab([], { looking: true });
  tab.redraw(["gate:i-0001:awaiting_human"]);
  expect(tab.titles).not.toContain("Your turn - rondo");
  expect(tab.title).toBe("(1) rondo");
});

test("the host is told what the notice did, for each wait it rang for", async () => {
  const shown = chimeTab([]);
  shown.redraw(["gate:i-0001:awaiting_human", "ask:m-0002"]);
  await Promise.resolve();
  expect(shown.reports).toEqual([
    {
      to: "/notice",
      body: "token=t&outcome=shown&wait=gate%3Ai-0001%3Aawaiting_human&wait=ask%3Am-0002",
    },
  ]);
  for (const [permission, outcome] of [
    ["default", "notAsked"],
    ["denied", "denied"],
    [null, "unsupported"],
  ] as const) {
    const tab = chimeTab([], { permission });
    tab.redraw(["gate:i-0001:awaiting_human"]);
    expect(tab.rung).toEqual([]);
    expect(tab.reports.map((sent) => sent.body)).toEqual([
      `token=t&outcome=${outcome}&wait=gate%3Ai-0001%3Aawaiting_human`,
    ]);
    // The title and the icon need no leave from anybody.
    expect(tab.title).toBe("Your turn - rondo");
  }
});

class HTMLDetailsElement {}
class HTMLButtonElement {
  dataset: Record<string, string> = {};
  textContent = "";
  readonly attributes = new Map<string, string>();
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
}
/** A form with its buttons and the note beside them: all the press duty touches. */
class HTMLFormElement {
  dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly note = { hidden: true };
  constructor(
    readonly method: string,
    readonly buttons: readonly HTMLButtonElement[],
  ) {}
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  querySelector() {
    return null;
  }
  querySelectorAll(selector: string) {
    return selector === "button"
      ? this.buttons
      : selector === "[data-busy-note]"
        ? [this.note]
        : [];
  }
}
class HTMLTextAreaElement {
  dataset: Record<string, string> = {};
  value = "";
  defaultValue = "";
}

/**
 * A page running `page/composer.js` over one draft box and its note; or, with
 * `take`, over the new-request box drawn holding a request taken from what
 * rondo would ask for next (D-0097 point 4.4), over `kept` storage.
 */
function composerPage(
  take: { key: string; drawn: string; kept: [string, string][] } | null = null,
) {
  const heard = new Map<string, ((event?: unknown) => void)[]>();
  const stored = new Map<string, string>(
    take === null
      ? [
          ["rondo:draft:reply:m-0001", "my own words"],
          ["rondo:drew:reply:m-0001", "rondo's first draft"],
        ]
      : take.kept,
  );
  const box = new HTMLTextAreaElement();
  box.dataset =
    take === null ? { draft: "reply:m-0001" } : { draft: "request", draftTake: take.key };
  box.value = take === null ? "my own words" : take.drawn;
  box.defaultValue = take === null ? "rondo's first draft" : take.drawn;
  const arrived = { dataset: { draftArrived: "reply:m-0001" }, hidden: true };
  const holds = { dataset: { draftState: "reply:m-0001" }, hidden: false };
  const Idiomorph: {
    defaults: {
      ignoreActiveValue?: boolean;
      callbacks: {
        beforeAttributeUpdated?: (name: string, element: unknown) => unknown;
        beforeNodeMorphed?: (old: unknown, next: unknown) => unknown;
      };
    };
  } = { defaults: { callbacks: {} } };
  runInNewContext(bytesOf("page/composer.js").toString("utf8"), {
    Idiomorph,
    HTMLDetailsElement,
    HTMLTextAreaElement,
    HTMLFormElement,
    HTMLButtonElement,
    addEventListener: () => {},
    CSS: { escape: (text: string) => text },
    location: { hash: "" },
    sessionStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
      removeItem: (key: string) => stored.delete(key),
    },
    MutationObserver: class {
      observe() {}
    },
    document: {
      body: {},
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: (selector: string) =>
        selector === "textarea[data-draft]"
          ? [box]
          : selector === "textarea[data-draft-take]"
            ? take === null
              ? []
              : [box]
            : selector === "[data-draft-arrived]"
              ? [arrived]
              : selector === "[data-draft-state]"
                ? [holds]
                : [],
      addEventListener: (type: string, listener: (event?: unknown) => void) => {
        heard.set(type, [...(heard.get(type) ?? []), listener]);
      },
    },
  });
  return {
    /** Submit `form` as a press of `submitter`; answers whether it was cancelled. */
    submit(form: HTMLFormElement, submitter: HTMLButtonElement | null, cancelled = false) {
      const event = {
        target: form,
        submitter,
        defaultPrevented: cancelled,
        preventDefault() {
          event.defaultPrevented = true;
        },
      };
      for (const listener of heard.get("submit") ?? []) listener(event);
      return event.defaultPrevented;
    },
    box,
    stored,
    arrived,
    holds,
    Idiomorph,
    redraw() {
      for (const listener of heard.get("htmx:afterSwap") ?? []) listener();
    },
  };
}

test("the morph is told to leave a fold's open and a draft's words to the person, and nothing else", () => {
  const { Idiomorph } = composerPage();
  const leaves = Idiomorph.defaults.callbacks.beforeAttributeUpdated;
  expect(leaves).toBeTypeOf("function");
  if (leaves === undefined) return;
  // **A fold stays open until the person shuts it** (lap 11): the server never
  // draws `open`, so a morph left alone would take it off every five seconds.
  expect(leaves("open", new HTMLDetailsElement())).toBe(false);
  // **And the words in a draft box stay the person's**, focused or not.
  const draft = new HTMLTextAreaElement();
  draft.dataset = { draft: "claim:i-0001:gate-i-0001" };
  expect(leaves("value", draft)).toBe(false);
  // By this callback alone, and not by idiomorph's `ignoreActiveValue`, which
  // would also keep a new draft out of the focused box's `defaultValue`, where
  // the note that says a draft arrived reads it (Codex).
  expect(Idiomorph.defaults.ignoreActiveValue).toBeUndefined();
  // Everything else the server sent arrives: a fold's other attributes, a box
  // that is not a draft, and an `open` on anything that is not a fold.
  expect(leaves("class", new HTMLDetailsElement())).not.toBe(false);
  expect(leaves("value", new HTMLTextAreaElement())).not.toBe(false);
  expect(leaves("open", new HTMLTextAreaElement())).not.toBe(false);
});

test("a draft that landed under the person's words is said after a merged redraw", () => {
  const page = composerPage();
  expect(page.arrived.hidden).toBe(true);
  // The morph kept the person's words in the box and moved rondo's new draft
  // into `defaultValue` alone (D-0077 rule 4.4): the box's value still matches
  // what was kept, which used to read as "nothing new arrived".
  page.box.defaultValue = "rondo's second draft";
  page.redraw();
  expect(page.box.value).toBe("my own words");
  expect(page.arrived.hidden).toBe(false);
  expect(page.holds.hidden).toBe(true);
});

test("a box the morph reuses for a different draft takes the server's words, not the last draft's", () => {
  const { Idiomorph } = composerPage();
  const { beforeNodeMorphed, beforeAttributeUpdated } = Idiomorph.defaults.callbacks;
  if (beforeNodeMorphed === undefined || beforeAttributeUpdated === undefined) {
    throw new Error("the composer did not configure the morph");
  }
  const box = new HTMLTextAreaElement();
  box.dataset = { draft: "claim:i-0001:gate-1" };
  // The same draft arriving again: the person's words stay.
  beforeNodeMorphed(box, { dataset: { draft: "claim:i-0001:gate-1" } });
  expect(beforeAttributeUpdated("value", box)).toBe(false);
  // **The next gate's claim box, arriving where the last one was** (Codex,
  // round 2): words typed for one gate must not be shown or sent under the
  // next, so this once the value is the server's.
  beforeNodeMorphed(box, { dataset: { draft: "claim:i-0001:gate-2" } });
  box.dataset = { draft: "claim:i-0001:gate-2" };
  expect(beforeAttributeUpdated("value", box)).not.toBe(false);
  // And after that, it is the person's again.
  expect(beforeAttributeUpdated("value", box)).toBe(false);
});

test("a press answers at once: its buttons are marked disabled, it says what it is doing, and a second is cancelled", () => {
  const page = composerPage();
  const other = new HTMLButtonElement();
  const pressed = new HTMLButtonElement();
  pressed.dataset = { busy: "Starting the work..." };
  pressed.textContent = "Start the work";
  const form = new HTMLFormElement("post", [other, pressed]);
  expect(page.submit(form, pressed)).toBe(false);
  // **Marked, not made `disabled`** (rondo#375): the form's data is read after
  // this, and a disabled submitter would be left out of it -- an answer's
  // `outcome` with it.
  for (const button of [other, pressed]) {
    expect(button.attributes.get("aria-disabled")).toBe("true");
  }
  expect(form.attributes.get("aria-busy")).toBe("true");
  expect(pressed.textContent).toBe("Starting the work...");
  expect(form.note.hidden).toBe(false);
  // A second press of the same form goes nowhere.
  expect(page.submit(form, pressed)).toBe(true);
  // And the redraw leaves the pressed form as it is, or the button would come
  // back as it was drawn while the press is still on its way.
  const morphed = page.Idiomorph.defaults.callbacks.beforeNodeMorphed;
  expect(morphed?.(form, form)).toBe(false);
  expect(morphed?.(new HTMLFormElement("post", []), form)).not.toBe(false);
});

test("a send htmx took, and a form that only reads, are not presses", () => {
  const page = composerPage();
  const button = new HTMLButtonElement();
  button.dataset = { busy: "Sending..." };
  const sent = new HTMLFormElement("post", [button]);
  page.submit(sent, button, true);
  expect(button.attributes.size).toBe(0);
  const read = new HTMLFormElement("get", [button]);
  expect(page.submit(read, button)).toBe(false);
  expect(button.attributes.size).toBe(0);
  expect(read.note.hidden).toBe(true);
});

/**
 * A tab running `page/text-size.js` (rondo#379): a root element, the header's
 * three buttons once the document is parsed, and a `localStorage` that holds
 * `saved` -- or throws on every call when `saved` is `"refused"`.
 */
function textSizeTab(saved: string | null | "refused") {
  const storage = new Map<string, string>();
  if (saved !== null && saved !== "refused") storage.set("rondo:text-size", saved);
  const refuse = () => {
    throw new Error("SecurityError");
  };
  const localStorage =
    saved === "refused"
      ? { getItem: refuse, setItem: refuse, removeItem: refuse }
      : {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
          removeItem: (key: string) => storage.delete(key),
        };
  class Element {
    readonly attributes = new Map<string, string>();
    getAttribute(name: string) {
      return this.attributes.get(name) ?? null;
    }
    setAttribute(name: string, value: string) {
      this.attributes.set(name, value);
    }
    removeAttribute(name: string) {
      this.attributes.delete(name);
    }
    closest(selector: string) {
      return selector === "[data-text-size-choice]" && this.attributes.has("data-text-size-choice")
        ? this
        : null;
    }
  }
  const root = new Element();
  const buttons = ["", "large", "larger"].map((step) => {
    const button = new Element();
    button.setAttribute("data-text-size-choice", step);
    return button;
  });
  let parsed = false;
  const heard = new Map<string, ((event: unknown) => void)[]>();
  const listen = (type: string, listener: (event: unknown) => void) => {
    heard.set(type, [...(heard.get(type) ?? []), listener]);
  };
  const fire = (type: string, event: unknown = {}) => {
    for (const listener of heard.get(type) ?? []) listener(event);
  };
  runInNewContext(bytesOf("page/text-size.js").toString("utf8"), {
    Element,
    localStorage,
    window: { addEventListener: listen },
    document: {
      documentElement: root,
      querySelectorAll: (selector: string) =>
        selector === "[data-text-size-choice]" && parsed ? buttons : [],
      addEventListener: listen,
    },
  });
  return {
    root,
    storage,
    pressed: () => buttons.map((button) => button.getAttribute("aria-pressed")),
    parse() {
      parsed = true;
      fire("DOMContentLoaded");
    },
    press(at: number) {
      fire("click", { target: buttons[at] });
    },
    otherTab(step: string) {
      storage.set("rondo:text-size", step);
      fire("storage", { key: "rondo:text-size" });
    },
  };
}

test("the size a person chose is on the root before the body exists, and the pressed step is marked once it does", () => {
  const tab = textSizeTab("larger");
  // Before anything is parsed: this is what keeps the first paint at the size.
  expect(tab.root.getAttribute("data-text-size")).toBe("larger");
  tab.parse();
  expect(tab.pressed()).toEqual(["false", "false", "true"]);
});

test("a press moves the scale and is remembered; the default step leaves no attribute and no key", () => {
  const tab = textSizeTab(null);
  tab.parse();
  expect(tab.root.getAttribute("data-text-size")).toBe(null);
  expect(tab.pressed()).toEqual(["true", "false", "false"]);
  tab.press(1);
  expect(tab.root.getAttribute("data-text-size")).toBe("large");
  expect(tab.storage.get("rondo:text-size")).toBe("large");
  expect(tab.pressed()).toEqual(["false", "true", "false"]);
  tab.press(0);
  expect(tab.root.getAttribute("data-text-size")).toBe(null);
  expect(tab.storage.has("rondo:text-size")).toBe(false);
  expect(tab.pressed()).toEqual(["true", "false", "false"]);
});

test("a stored value the stylesheet has no step for is the default, not an attribute", () => {
  const tab = textSizeTab('"><script>');
  tab.parse();
  expect(tab.root.getAttribute("data-text-size")).toBe(null);
  expect(tab.pressed()).toEqual(["true", "false", "false"]);
});

test("refused storage still lets a press change the size on this page", () => {
  const tab = textSizeTab("refused");
  tab.parse();
  tab.press(2);
  expect(tab.root.getAttribute("data-text-size")).toBe("larger");
  expect(tab.pressed()).toEqual(["false", "false", "true"]);
});

test("a choice made in another tab is followed here", () => {
  const tab = textSizeTab(null);
  tab.parse();
  tab.otherTab("large");
  expect(tab.root.getAttribute("data-text-size")).toBe("large");
  expect(tab.pressed()).toEqual(["false", "true", "false"]);
});

test("a taken request wins over a draft kept for another take, and a reload of the same take keeps the edits", () => {
  // A was taken once, then B was taken and edited; now the person presses A
  // again (Codex, round 2: a marker per take kept B's words here).
  const switched = composerPage({
    key: "p-1:A",
    drawn: "A's request",
    kept: [
      ["rondo:took:p-1:A", "1"],
      ["rondo:took", "p-1:B"],
      ["rondo:draft:request", "B, edited"],
    ],
  });
  expect(switched.box.value).toBe("A's request");
  expect(switched.stored.get("rondo:took")).toBe("p-1:A");
  // The same address again (a reload): what they typed since stays.
  const reloaded = composerPage({
    key: "p-1:A",
    drawn: "A's request",
    kept: [
      ["rondo:took", "p-1:A"],
      ["rondo:draft:request", "A, edited"],
    ],
  });
  expect(reloaded.box.value).toBe("A, edited");
});
