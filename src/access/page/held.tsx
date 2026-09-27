/** @jsxImportSource react */
/**
 * English-held text, with the way to read it in the page's language
 * (rondo#490, DECISIONS.md D-0144).
 *
 * **Three shapes, all drawn by the server**, so the page's five-second morph
 * keeps whichever is true: the text as it is (an English page, or nobody who
 * may press and nothing read yet); the text with a press beside it; and, once
 * a reading is stored, the reading in place with the original under a fold
 * that says it is the record, and one line saying when it was read and what it
 * cost.
 *
 * **The press belongs to one form elsewhere on the page** (`form="read-in"`),
 * so it can stand inside another form -- the flow's ask is one -- without
 * nesting forms. Its value is the original, which the route hashes the way
 * {@link heldDigest} does.
 *
 * **A block, never inside a `<p>` or a `<label>`** (Codex, design review): the
 * fold is flow content, and a button inside a label would be the label's
 * control, so a click on the point would spend.
 */
import type { StoredTranslation } from "../../store/records.js";
import { ago } from "../inbox.js";
import { heldAnchor, heldDigest, pressable } from "../read-in.js";
import type { Chrome } from "../wording.js";
import { money } from "./vocabulary.js";

/** What one render knows about reading held text; null on an English page. */
export interface HeldReads {
  /** The stored readings in this page's language, by digest. */
  readonly done: ReadonlyMap<string, StoredTranslation>;
  /** Whether the press may be drawn: the page's one `read-in` form is there. */
  readonly press: boolean;
  readonly nowMs: number;
}

/** The id of the page's one form every press submits. */
export const READ_IN_FORM = "read-in";

export function Held({
  wording,
  reads,
  text,
  className = "",
}: {
  readonly wording: Chrome;
  readonly reads: HeldReads;
  readonly text: string;
  /** The classes the text was drawn with before it was held. */
  readonly className?: string;
}) {
  const digest = heldDigest(text);
  const read = reads.done.get(digest);
  if (read !== undefined) {
    return (
      <div className="held held-read" id={heldAnchor(digest)}>
        <div className={className} lang={wording.lang}>
          {read.text}
        </div>
        <details className="held-original">
          <summary>{wording.readInOriginal}</summary>
          <div className={className} lang="">
            {text}
          </div>
        </details>
        <p className="held-cost" data-ticks="">
          {wording.readInRead(
            wording.age(ago(read.readAtMs, reads.nowMs)),
            read.costUsd === null ? null : money(read.costUsd),
          )}
        </p>
      </div>
    );
  }
  return (
    <div className="held" id={heldAnchor(digest)}>
      <div className={className} lang="">
        {text}
      </div>
      {reads.press && pressable(text) ? (
        <button
          type="submit"
          form={READ_IN_FORM}
          name="text"
          value={text}
          className="held-press"
          data-busy={wording.readInBusy}
        >
          {wording.readInAction}
        </button>
      ) : null}
    </div>
  );
}
