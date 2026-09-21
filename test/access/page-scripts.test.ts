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

/** A tab running `page/chime.js`, whose ledger says the waits it is given. */
function chimeTab(first: readonly string[] | null) {
  let waits = first;
  const rung: string[] = [];
  const heard = new Map<string, Listener[]>();
  class Notification {
    static permission = "granted";
    constructor(line: string) {
      rung.push(line);
    }
  }
  const ledger = {
    getAttribute: (name: string) =>
      name === "data-waits" ? JSON.stringify(waits) : name === "data-chime" ? "Your turn" : null,
  };
  runInNewContext(bytesOf("page/chime.js").toString("utf8"), {
    window: { Notification },
    Notification,
    document: {
      querySelector: (selector: string) =>
        selector === "#ledger" && waits !== null ? ledger : null,
      addEventListener: (type: string, listener: Listener) => {
        heard.set(type, [...(heard.get(type) ?? []), listener]);
      },
    },
  });
  return {
    rung,
    redraw(next: readonly string[]) {
      waits = next;
      for (const listener of heard.get("htmx:afterSwap") ?? []) listener();
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

/** A page running `page/composer.js` over one draft box and its note. */
function composerPage() {
  const heard = new Map<string, ((event?: unknown) => void)[]>();
  const stored = new Map<string, string>([
    ["rondo:draft:reply:m-0001", "my own words"],
    ["rondo:drew:reply:m-0001", "rondo's first draft"],
  ]);
  const box = new HTMLTextAreaElement();
  box.dataset = { draft: "reply:m-0001" };
  box.value = "my own words";
  box.defaultValue = "rondo's first draft";
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
