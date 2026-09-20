/** @jsxImportSource react */
/**
 * The seam between the page that is being replaced and the page replacing it
 * (DECISIONS.md D-0083).
 *
 * **This module exists to be deleted.** The faces are React
 * ({@link ../page/faces.tsx}); the things inside them are still the server JSX
 * the renderer has always produced. Rather than convert the whole screen in
 * one change -- which is what makes a rebuild unreviewable -- each face takes
 * its contents as markup the renderer already rendered, and hands it to React
 * as-is. As a face's contents become React components, its string goes away,
 * and when the last one goes, so does this file.
 *
 * **The one thing this must not do is transform the markup.** What arrives has
 * already been escaped by the renderer that produced it; re-escaping would
 * double it and parsing it would be a second opinion about what the page says.
 * So it is injected verbatim, which is the whole of {@link Raw}.
 */
import { Faces } from "./faces.js";

/**
 * Markup the renderer already produced, placed inside a React tree untouched.
 *
 * The rule this answers is about *content* -- text from a person, a forge or a
 * model -- and none of that reaches here: what is passed is a face's worth of
 * markup this process rendered a moment ago, from values it had already
 * escaped. The transforming module (`markdown.ts`) is still the only thing
 * that decides what HTML may exist at all (D-0059).
 */
export function Raw({ html }: { readonly html: string }) {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: the page's own already-escaped markup, crossing the server-JSX/React seam
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

/** One face's contents: React where it has been rebuilt, markup where it has not. */
export type FaceContent = { readonly rendered: string } | { readonly react: React.ReactNode };

function contentOf(content: FaceContent | null): React.ReactNode {
  if (content === null) {
    return null;
  }
  return "react" in content ? content.react : <Raw html={content.rendered} />;
}

export interface ShellProps {
  readonly list: FaceContent | null;
  readonly thread: FaceContent | null;
  readonly side: FaceContent | null;
}

/**
 * The three faces with their contents, ready to be rendered to markup by the
 * caller and placed in the document.
 */
export function Shell({ list, thread, side }: ShellProps) {
  return <Faces list={contentOf(list)} thread={contentOf(thread)} side={contentOf(side)} />;
}
