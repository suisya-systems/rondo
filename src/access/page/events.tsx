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
  /** Where the evidence for this line is, when there is somewhere to go. */
  readonly href?: string;
  /** What that link says; required where `href` is given. */
  readonly linkSaid?: string;
}

/** One line: a dot, a sentence, the time. */
export function EventLine({ event }: { readonly event: ThreadEvent }) {
  return (
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
