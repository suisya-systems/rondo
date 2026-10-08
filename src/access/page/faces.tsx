/** @jsxImportSource react */
/**
 * The three faces, width by width (DECISIONS.md D-0083 rule 1 as amended by
 * D-0185, and D-0185 rule 3).
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
 * which is the centre face's own constraint rather than the grid's. Each band
 * is a design of its own, 2560 and the half screens beside an editor alike
 * (`page/faces.css` carries the table):
 *
 * | Width | Faces | What scrolls |
 * |---|---|---|
 * | > 2000 | 440 / up to 1,040 / 720 | each face |
 * | 1101-2000 | 260-340 / rest / 320-440 | each face |
 * | 641-1100 | 220-300 / rest, the right face under the thread | the list; the thread with the right face |
 * | <= 640 | one, the list last | the page |
 *
 * **`face-reading` is why the list keeps its place at 641-1100** (rondo#586):
 * the thread and the right face scroll there as one column beside the list,
 * which two sibling faces cannot do without a box around them. Everywhere
 * else it draws no box (`display: contents`). It is a plain `div` so that the
 * `section` and the `aside` keep their roles.
 *
 * What goes under the thread is evidence only: `D-0082` rule 7 holds at every
 * width, so what a press needs stays inside the box that holds the press.
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
      <div className="face-reading">
        <section className="face face-thread">{thread}</section>
        <aside className="face face-side">{side}</aside>
      </div>
    </div>
  );
}
