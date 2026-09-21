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
class HTMLTextAreaElement {
  dataset: Record<string, string> = {};
  value = "";
  defaultValue = "";
}

/** A page running `page/composer.js` over one draft box and its note. */
function composerPage() {
  const heard = new Map<string, Listener[]>();
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
      callbacks: { beforeAttributeUpdated?: (name: string, element: unknown) => unknown };
    };
  } = { defaults: { callbacks: {} } };
  runInNewContext(bytesOf("page/composer.js").toString("utf8"), {
    Idiomorph,
    HTMLDetailsElement,
    HTMLTextAreaElement,
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
      addEventListener: (type: string, listener: Listener) => {
        heard.set(type, [...(heard.get(type) ?? []), listener]);
      },
    },
  });
  return {
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
  expect(Idiomorph.defaults.ignoreActiveValue).toBe(true);
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
