/**
 * Rendering a React face to markup the server JSX document can hold
 * (DECISIONS.md D-0083, D-0059 rule 2).
 *
 * **One place where the two runtimes meet.** The document -- `<html>`, the
 * bar, the foot note -- is still `hono/jsx`, and the faces inside it are
 * React. Something has to turn one into a string the other can place, and
 * doing it in one named function keeps that from being scattered through the
 * renderer.
 *
 * **Static markup, not hydratable markup.** `renderToStaticMarkup` emits no
 * hydration hints, which is right for this slice: nothing in the faces is
 * interactive yet, and the client bundle hydrates only the islands that mark
 * themselves. When a face needs to be hydrated it gets a root of its own with
 * its props beside it (`page/client/main.tsx`), and that root is what
 * `renderToString` would be for -- a change to make deliberately rather than
 * by rendering everything as if it were live.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { Shell, type ShellProps } from "./shell.js";

/** The three faces as markup, for the document to place. */
export function facesMarkup(props: ShellProps): string {
  return renderToStaticMarkup(Shell(props));
}
