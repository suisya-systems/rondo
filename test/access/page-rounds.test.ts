/**
 * `page/rounds.js`, run rather than read (rondo#494 items 2 and 3, D-0166): a
 * form whose round changes under the person's words is kept, says what
 * changed, holds a press until they choose, and takes the new round with what
 * they wrote where it still means the same.
 *
 * There is no DOM in this repository's dependencies, so this brings the few
 * nodes the script touches and nothing else; the morph itself is not run, only
 * what rondo tells it (`test/access/page-scripts.test.ts` says why).
 */
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, test } from "vitest";

const kebab = (key: string) => `data-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

class Node {
  readonly attributes = new Map<string, string>();
  children: Node[] = [];
  parent: Node | null = null;
  value = "";
  defaultValue = "";
  type = "";
  tabIndex = 0;
  focused = false;
  private text = "";
  readonly dataset: Record<string, string | undefined>;
  constructor(readonly tag: string) {
    this.dataset = new Proxy(
      {},
      {
        get: (_, key: string) => this.attributes.get(kebab(key)),
        set: (_, key: string, value: string) => {
          this.attributes.set(kebab(key), value);
          return true;
        },
      },
    );
  }
  get textContent(): string {
    return this.text + this.children.map((child) => child.textContent).join(" ");
  }
  set textContent(text: string) {
    this.text = text;
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  append(...nodes: Node[]) {
    for (const node of nodes) {
      node.parent = this;
      this.children.push(node);
    }
  }
  prepend(node: Node) {
    node.parent = this;
    this.children.unshift(node);
  }
  remove() {
    if (this.parent !== null) {
      this.parent.children = this.parent.children.filter((child) => child !== this);
      this.parent = null;
    }
  }
  replaceWith(node: Node) {
    const parent = this.parent;
    if (parent !== null) {
      parent.children = parent.children.map((child) => (child === this ? node : child));
      node.parent = parent;
      this.parent = null;
    }
  }
  cloneNode(): Node {
    const copy = new Node(this.tag);
    for (const [name, value] of this.attributes) copy.attributes.set(name, value);
    copy.value = this.value;
    copy.defaultValue = this.defaultValue;
    copy.text = this.text;
    copy.append(...this.children.map((child) => child.cloneNode()));
    return copy;
  }
  matches(selector: string): boolean {
    return selector.split(",").some((one) => {
      const part = one.trim();
      if (part === "textarea") {
        return this.tag === "textarea";
      }
      if (part === "input:not([type=hidden])") {
        return this.tag === "input" && this.attributes.get("type") !== "hidden";
      }
      if (part === "form") {
        return this.tag === "form";
      }
      const attribute = /^\[([a-z-]+)(?:="(.*)")?\]$/.exec(part);
      if (attribute === null) {
        throw new Error(`no selector ${part}`);
      }
      const [, name, value] = attribute;
      const has = this.attributes.get(name ?? "");
      return has !== undefined && (value === undefined || has === value);
    });
  }
  querySelectorAll(selector: string): Node[] {
    return this.children.flatMap((child) => [
      ...(child.matches(selector) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  querySelector(selector: string): Node | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
  closest(selector: string): Node | null {
    return this.matches(selector) ? this : (this.parent?.closest(selector) ?? null);
  }
  focus() {
    this.focused = true;
  }
  dispatchEvent(event: { type: string }) {
    heardInput.push([this.dataset.roundCarry ?? "", this.value, event.type]);
  }
}
const heardInput: [string, string, string][] = [];

const el = (tag: string, attributes: Record<string, string> = {}, ...children: Node[]) => {
  const node = new Node(tag);
  for (const [name, value] of Object.entries(attributes)) node.attributes.set(name, value);
  node.append(...children);
  return node;
};
const box = (carry: string, drawn: string) => {
  const field = el("textarea", { "data-round-carry": carry });
  field.value = drawn;
  field.defaultValue = drawn;
  return field;
};

/** The flow's ask as the server draws it: a round, its points, and its words. */
function ask(round: string, points: readonly string[], keeps = "issue:o/r#1") {
  return el(
    "form",
    {
      "data-round": round,
      "data-round-keeps": keeps,
      "data-round-said": "the ask changed",
      "data-round-gone": "No longer asked:",
      "data-round-added": "Newly asked:",
      "data-round-use-label": "Use the new points",
      "data-round-keep-label": "Keep answering these",
      "data-round-held-label": "Nothing was sent",
    },
    box("request", "the request"),
    ...points.map((point) =>
      el("li", { "data-round-item": point }, box(`point:${point}`, `answer to ${point}`)),
    ),
  );
}

function page(first: Node) {
  const root = el("main", {}, first);
  const callbacks: { beforeNodeMorphed?: (old: unknown, next: unknown) => unknown } = {};
  const heard = new Map<string, (event: unknown) => void>();
  runInNewContext(readFileSync(new URL("../../page/rounds.js", import.meta.url), "utf8"), {
    Idiomorph: { defaults: { callbacks } },
    HTMLFormElement: {
      [Symbol.hasInstance]: (node: unknown) => node instanceof Node && node.tag === "form",
    },
    Element: Node,
    Event: class {
      constructor(readonly type: string) {}
    },
    CSS: { escape: (text: string) => text },
    document: {
      createElement: (tag: string) => new Node(tag),
      addEventListener: (type: string, listener: (event: unknown) => void) => {
        heard.set(type, listener);
      },
    },
  });
  const form = () => root.children[0] as Node;
  return {
    form,
    notice: () => form().querySelector("[data-round-notice]"),
    /** One redraw: whether the morph was let through to this form. */
    redraw: (next: Node) => callbacks.beforeNodeMorphed?.(form(), next) !== false,
    press: (label: string) => {
      const target = form()
        .querySelectorAll("[data-round-act]")
        .find((one) => one.textContent === label);
      heard.get("click")?.({ target });
    },
    submit: () => {
      let prevented = false;
      heard.get("submit")?.({ target: form(), preventDefault: () => (prevented = true) });
      return !prevented;
    },
  };
}

test("a new round over a form with no edits is left to the morph", () => {
  const tab = page(ask("ask-1", ["a", "b"]));
  expect(tab.redraw(ask("ask-2", ["a"]))).toBe(true);
  expect(tab.notice()).toBe(null);
});

test("a new round over the person's words is kept, says what changed, and holds a press", () => {
  const tab = page(ask("ask-1", ["a", "b", "c", "d"]));
  const typed = tab.form().querySelectorAll("textarea")[2] as Node;
  typed.value = "my own answer to b";
  expect(tab.redraw(ask("ask-2", ["a", "b", "e"]))).toBe(false);
  expect(tab.form().dataset.round).toBe("ask-1");
  expect(typed.value).toBe("my own answer to b");
  const said = tab.notice()?.textContent ?? "";
  expect(said).toContain("the ask changed");
  expect(said).toContain("No longer asked:");
  expect(said).toContain("c");
  expect(said).toContain("Newly asked:");
  expect(said).toContain("e");
  expect(said).toContain("Keep answering these");
  // A press before the person chose is not sent, and lands on the notice.
  expect(tab.submit()).toBe(false);
  expect(tab.notice()?.focused).toBe(true);
  expect(tab.notice()?.textContent).toContain("Nothing was sent");
});

test("keeping the round sends its press, and the same new round does not ask again", () => {
  const tab = page(ask("ask-1", ["a"]));
  (tab.form().querySelectorAll("textarea")[1] as Node).value = "mine";
  tab.redraw(ask("ask-2", ["b"]));
  tab.press("Keep answering these");
  expect(tab.notice()).toBe(null);
  expect(tab.submit()).toBe(true);
  expect(tab.redraw(ask("ask-2", ["b"]))).toBe(false);
  expect(tab.notice()).toBe(null);
  // A later round is said again.
  tab.redraw(ask("ask-3", ["c"]));
  expect(tab.notice()?.textContent).toContain("c");
  // And the server drawing the held round again lets the morph through.
  expect(tab.redraw(ask("ask-1", ["a"]))).toBe(true);
});

test("taking the new round carries what still means the same, and nothing else", () => {
  const tab = page(ask("ask-1", ["a", "b"]));
  const [request, a, b] = tab.form().querySelectorAll("textarea") as [Node, Node, Node];
  request.value = "my request";
  a.value = "mine for a";
  b.value = "mine for b";
  tab.redraw(ask("ask-2", ["a", "z"]));
  heardInput.length = 0;
  tab.press("Use the new points");
  expect(tab.form().dataset.round).toBe("ask-2");
  expect(tab.notice()).toBe(null);
  expect(
    tab
      .form()
      .querySelectorAll("textarea")
      .map((field) => field.value),
  ).toEqual(["my request", "mine for a", "answer to z"]);
  // The carried words are told to `page/composer.js` as typing is.
  expect(heardInput).toEqual([
    ["request", "my request", "input"],
    ["point:a", "mine for a", "input"],
  ]);
});

test("a new round over another candidate takes none of what was written for this one", () => {
  const tab = page(ask("ask-1", ["a"], "issue:o/r#1"));
  const [request, a] = tab.form().querySelectorAll("textarea") as [Node, Node];
  request.value = "my request for #1";
  a.value = "mine for a";
  tab.redraw(ask("ask-2", ["a"], "issue:o/r#2"));
  expect(tab.notice()?.textContent).not.toContain("Keep answering these");
  tab.press("Use the new points");
  expect(tab.form().dataset.round).toBe("ask-2");
  expect(
    tab
      .form()
      .querySelectorAll("textarea")
      .map((field) => field.value),
  ).toEqual(["the request", "answer to a"]);
});

test("a round the server does not say can be kept offers only the new one", () => {
  const tab = page(ask("gate-1", [], ""));
  (tab.form().querySelectorAll("textarea")[0] as Node).value = "my claim";
  tab.redraw(ask("gate-2", [], ""));
  const said = tab.notice()?.textContent ?? "";
  expect(said).toContain("Use the new points");
  expect(said).not.toContain("Keep answering these");
});
