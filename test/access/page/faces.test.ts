/**
 * The three faces, rendered on the server (DECISIONS.md D-0083 rule 1 and
 * D-0185).
 *
 * **What this file is really asserting is that the two JSX runtimes coexist.**
 * `tsconfig.json` points the whole tree at `hono/jsx`, because the screens this
 * rebuild does not touch are server JSX and stay that way; `faces.tsx`
 * overrides that per file with a pragma. Compiling is not the same as running,
 * so this renders the component through `react-dom/server` and reads the
 * markup: if the pragma were dropped, or the runtimes fought, this is where it
 * would show rather than in a browser.
 *
 * The folds themselves are CSS (`page/faces.css`) and are not asserted here --
 * a media query is not a thing a string of markup can answer for. What is
 * asserted is that each face is present and carries what it was handed, so a
 * face silently swallowing its contents is caught.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { Faces } from "../../../src/access/page/faces.js";
import { fresh, gateWithChecks, operatorPage, portsOver } from "../page-world.js";

test("the three faces are rendered, each carrying what it was handed", () => {
  const html = renderToStaticMarkup(
    Faces({ list: "every request", thread: "the thread", side: "the material" }),
  );
  expect(html).toContain("every request");
  expect(html).toContain("the thread");
  expect(html).toContain("the material");
  // The order is the reading order: list, thread, side (rule 5's table).
  expect(html.indexOf("every request")).toBeLessThan(html.indexOf("the thread"));
  expect(html.indexOf("the thread")).toBeLessThan(html.indexOf("the material"));
});

test("the thread and the right face share one reading column, and the list is outside it", () => {
  // rondo#586 (D-0185 rule 2): at 641-1100 that column is what scrolls beside
  // the list, so the list keeps its place while a thread is read. Its CSS is
  // not asserted here; what is, is that the box exists around exactly these two.
  const html = renderToStaticMarkup(Faces({ list: "L", thread: "T", side: "S" }));
  const reading = html.indexOf('<div class="face-reading">');
  expect(reading).toBeGreaterThan(html.indexOf("L"));
  expect(html.indexOf('class="face face-thread"')).toBeGreaterThan(reading);
  expect(html.indexOf('class="face face-side"')).toBeGreaterThan(reading);
  expect(html.endsWith("</aside></div></div>")).toBe(true);
});

test("the right face draws its frame with nothing in it, which is this slice's state", () => {
  // The governance the right face carries is the second slice's, and the empty
  // state's right face is the third's (D-0083 gate point 7). A null side is
  // the frame and no content -- not a missing face.
  const html = renderToStaticMarkup(Faces({ list: "l", thread: "t", side: null }));
  expect(html).toContain("face-side");
  expect(html).toContain("l");
  expect(html).toContain("t");
});

test("React rendered this, and not the tree's default JSX runtime", () => {
  // `hono/jsx` returns its own node type and renders `class`; React renders
  // `className` as `class` too, so the tell is not the attribute. What says
  // React ran is that `renderToStaticMarkup` accepted the element at all --
  // it throws on a foreign node -- and that the element is a React element.
  const element = Faces({ list: null, thread: null, side: null });
  expect(typeof element).toBe("object");
  expect(renderToStaticMarkup(element)).toContain("page-faces");
});

test("the page itself is drawn as three faces", async () => {
  // The shell is on the live page, not only in the component above: this
  // renders what the server would answer with and looks for the faces.
  const world = fresh();
  await gateWithChecks(world);
  const html = await operatorPage(portsOver(world, "ada", []), "t", { kind: "summary" });
  expect(html).toContain("page-faces");
  expect(html).toContain("face-list");
  expect(html).toContain("face-thread");
  expect(html).toContain("face-side");
  // And the centre still carries the page it always did, rather than an
  // empty frame: the list and the right face are the slices still to come.
  expect(html).toContain("<main>");
});
