/** @jsxImportSource react */
/**
 * The three faces, and the folds between them (DECISIONS.md D-0083 rules 1
 * and 8).
 *
 * **The first React component on the page, and the reason the runtime is
 * mixed.** `tsconfig.json` sets `jsxImportSource` to `hono/jsx` for the whole
 * tree, because the screens this rebuild does not touch -- the scope screen
 * and the publish screen -- are server JSX and stay that way. The pragma above
 * overrides it for this file only, which `tsc` honours per file: the emitted
 * import is `react/jsx-runtime` here and `hono/jsx/jsx-runtime` there.
 *
 * **Width buys faces, never line length** (rule 1). The three faces stop at
 * 2,200px and are centred; prose stays at 45 to 90 characters at every width,
 * which is the centre face's own constraint rather than the grid's. The folds
 * are rule 8's table, and they are written here as one declaration rather than
 * spread over the elements, so a reader can check them against it:
 *
 * | Width | Faces | What folds |
 * |---|---|---|
 * | 2560 | 440 / 1,040 / 720 | nothing |
 * | 1600 | 340 / rest / 440 | the right face's cards go one across |
 * | 1280 | 300 / rest | the right face drops under the thread |
 *
 * What drops at 1280 is evidence only: `D-0082` rule 7 holds at every width,
 * so what a press needs stays inside the box that holds the press.
 */
import type { ReactNode } from "react";

export interface FacesProps {
  /** Every request, cut by day: the left face (rule 5). */
  readonly list: ReactNode;
  /** The thread and the box to answer in: the centre face (rule 5). */
  readonly thread: ReactNode;
  /**
   * The material and what was agreed: the right face (rule 5).
   *
   * Null draws the frame and nothing in it, which is this slice's state: the
   * governance the face carries is the second slice's, and the empty state's
   * right face is the third's (D-0083 gate point 7).
   */
  readonly side: ReactNode;
}

export function Faces({ list, thread, side }: FacesProps) {
  return (
    <div className="page-faces">
      <nav className="face face-list">{list}</nav>
      <section className="face face-thread">{thread}</section>
      <aside className="face face-side">{side}</aside>
    </div>
  );
}
