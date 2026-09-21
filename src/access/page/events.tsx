/** @jsxImportSource react */
/**
 * The event line (DECISIONS.md D-0083 rule 7).
 *
 * **Everything between messages that is not prose is one line**: a dot, a
 * sentence, the time at the right edge. One line and one height, so a thread
 * reads as a conversation with a margin of record beside it rather than as a
 * log with paragraphs in it. The mock measured this at 28px and 48 characters
 * at 14px, which is inside rule 1's 45 to 90.
 *
 * **The dot's colour is the kind, and follows `D-0082` rule 2**: ink for the
 * person's own act, green for passed, red for failed, hollow for *rondo
 * decided this without asking*, neutral for the rest. **No amber**: amber
 * means *a person must act*, and an event line is a thing that has already
 * happened. What waits on a person is the question box, not a line in the
 * record.
 *
 * **A decision made without asking is on the time axis at the moment it was
 * made**, which is what makes the right face's count and the thread agree:
 * they are the same things, counted in one place and placed in the other.
 */
import type { ReactNode } from "react";
import type { FoldLine } from "../page-logic/event-fold.js";

/** What kind of thing happened, which is the whole of what the dot says. */
export type EventKind = "person" | "passed" | "failed" | "decided" | "other";

export interface ThreadEvent {
  /** Stable within a thread, so a redraw keeps the reader's place. */
  readonly id: string;
  readonly kind: EventKind;
  /** One sentence, in the person's language, naming no identifier of rondo's (D-0076). */
  readonly said: string;
  /** The time, at the right edge, as a person reads it. */
  readonly at: string;
  /**
   * The same moment as milliseconds, which the line itself does not draw.
   * Rule 7's *you last looked down to here* is placed by comparing it with
   * the mark, and the placing is the caller's: only it has read the mark.
   */
  readonly atMs: number;
  /**
   * Which try of the request this line belongs to, or null where the request
   * has only one (`lapEvents`). The line itself does not draw it -- the
   * sentence already says it -- and it is here so that a fold can group by the
   * attempt without parsing the words back (`page-logic/event-fold.ts`).
   */
  readonly tryAt?: number | null;
  /**
   * That this line is the person's to act on, and so is never folded away
   * (D-0082 rule 7, rondo#317).
   *
   * **A fold holds evidence, never the thing the press needs**, and the one
   * line on the thread that is not evidence is the one an upstream refusal is
   * relayed into: rule 4.4 gives the person a next move, and a fold summary
   * said by the checks that failed before it would leave that move readable
   * only by opening the fold. The exception is the one `decided` already has
   * (`page-logic/event-fold.ts`), for the same reason: it belongs on the time
   * axis at the moment it happened.
   *
   * Set where the line is composed, because that is where the row still says
   * which kind of failure it was (`page-logic/thread-events.ts`); the fold
   * cannot tell a refusal from an ordinary stop by reading the sentence back.
   */
  readonly yours?: boolean;
  /** Where the evidence for this line is, when there is somewhere to go. */
  readonly href?: string;
  /** What that link says; required where `href` is given. */
  readonly linkSaid?: string;
  /**
   * rondo's own reason for what happened, shut (D-0076 rule 4.5, rondo#348).
   *
   * **One closed fold, labelled for whoever maintains rondo on this machine,
   * and nothing of it inline.** It is drawn only where the row says the
   * failure was rondo's own: an upstream refusal is the person's to act on and
   * is said in the line itself (rule 4.4). The person is never asked to open
   * this, and what is in it is the reason as rondo received it.
   */
  readonly aside?: {
    readonly said: string;
    readonly text: string;
  };
}

/** One line: a dot, a sentence, the time -- and, where there is one, rondo's own reason under it. */
export function EventLine({ event }: { readonly event: ThreadEvent }) {
  return (
    <>
      <div className={`ev ev-${event.kind}`}>
        <i className="ev-dot" aria-hidden="true" />
        <p>
          {event.said}
          {event.href === undefined ? null : (
            <>
              {" "}
              <a href={event.href}>{event.linkSaid}</a>
            </>
          )}
        </p>
        <time>{event.at}</time>
      </div>
      {event.aside === undefined ? null : (
        /*
         * Shut, and a `<details>` for `FoldedLine`'s reason: opening it is the
         * browser's own act, so a reason nobody opens costs the page no state
         * and no address. `lang=""` because the reason is rondo's own words as
         * it received them and rondo does not know what language they are in
         * (D-0055 rule 8) -- it is quoted here, never translated.
         */
        <details className="ev-aside">
          <summary>{event.aside.said}</summary>
          <p lang="">{event.aside.text}</p>
        </details>
      )}
    </>
  );
}

/**
 * The line that says where the person's reading stopped (rule 7).
 *
 * **One in the thread and one in the list, and no row carries a *new* of its
 * own.** Drawn as a rule with the sentence in it, so it reads as a place in
 * the record rather than as a thing that happened.
 */
export function LastLookedLine({ said }: { readonly said: string }) {
  return <p className="thread-since">{said}</p>;
}

/**
 * A folded run of event lines: one line, with the lines kept inside it.
 *
 * **`<details>` and nothing else.** The lines are in the page, shut, and
 * opening one is the browser's own act -- no state of the page's and no
 * address of its own. It stays open until the person shuts it: the five-second
 * redraw merges into the nodes already here and leaves a fold's `open` alone
 * (`page/composer.js`), so a redraw does not shut it; a navigation draws the
 * page again and does. The alternative was an address per fold, which
 * would put a reading position into the URL that the language switch and every
 * redraw would then have to carry (`D-0056` rule 11).
 *
 * The marker is the dot's column, so a shut fold reads as one more line in the
 * record rather than as a control beside it.
 *
 * **A fold may hold folds.** `D-0086` puts what the person has already read
 * over the top of what was already folded by try, so opening the outer one
 * gives back six folded tries rather than eighteen raw lines. A message is
 * never inside one, so this draws only the two kinds that can be.
 */
export function FoldedLine({ fold, open }: { readonly fold: FoldLine; readonly open: string }) {
  return (
    <details className="ev-fold">
      <summary>
        <span className="ev-fold-said">{fold.said}</span>
        <span className="ev-fold-open">{open}</span>
        <time>{fold.at}</time>
      </summary>
      {fold.inside.map((item) =>
        item.kind === "fold" ? (
          <FoldedLine key={item.id} fold={item} open={open} />
        ) : item.kind === "event" ? (
          <EventLine key={item.event.id} event={item.event} />
        ) : null,
      )}
    </details>
  );
}

/**
 * A run of event lines, with the last-looked line in its place.
 *
 * `lastLookedAbove` is the id of the event the line sits above, or null for
 * no line -- which is either that the person has never looked, or that they
 * have seen all of it.
 */
export function EventLines({
  events,
  lastLookedAbove,
  lastLookedSaid,
}: {
  readonly events: readonly ThreadEvent[];
  readonly lastLookedAbove: string | null;
  readonly lastLookedSaid: string;
}): ReactNode {
  return (
    <>
      {events.map((event) => (
        <div key={event.id}>
          {event.id === lastLookedAbove ? <LastLookedLine said={lastLookedSaid} /> : null}
          <EventLine event={event} />
        </div>
      ))}
    </>
  );
}
