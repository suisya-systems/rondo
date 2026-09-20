/** @jsxImportSource react */
/**
 * The centre face: one request's thread (DECISIONS.md D-0083 rule 5).
 *
 * **The unit of the page is this** (rule 2). A request's own words open it,
 * rondo's reading of them answers, and then the record of the work runs down
 * the middle: event lines for what happened, reports for what was produced,
 * the question when there is one, the box to answer in, and under all of it --
 * always -- a box to add to the request.
 *
 * **Prose stays at 45 to 90 characters at every width** (rule 1). Width buys
 * faces, so the centre does not grow with the window; `page/thread.css` holds
 * the measure.
 *
 * **What this face does not decide.** Whether a question is being asked, and
 * what answering it costs, are the answering box's (`D-0083` rule 9, whose
 * elements `test/access/gate-elements.test.ts` holds down). This face places
 * it; it does not compose it.
 */
import type { ReactNode } from "react";
import { EventLine, LastLookedLine, type ThreadEvent } from "./events.js";

/** A word that leads somewhere, or -- with no address for it -- just the word. */
export interface ThreadLink {
  readonly said: string;
  readonly href: string | null;
  /** What a pointer shows: the locator itself, never printed as prose. */
  readonly title?: string;
}

/** One thing said in the thread, by a person or by rondo. */
export interface ThreadMessage {
  readonly id: string;
  /** Who spoke, which is a column and never a property of the prose (D-0061 rule 2.3). */
  readonly who: "person" | "rondo";
  /** The voice as the store records it, for a reader that is not a person. */
  readonly voice: string;
  /** The name to put on it, already said by the caller. */
  readonly said: string;
  /** The words, as written: never trimmed, reflowed or paraphrased. */
  readonly body: string;
  /**
   * What is drawn in place of the words, where the words are not prose a
   * person wrote: what rondo read of a named issue (D-0078 section 4), or a
   * drafter run that drafted nothing (rondo#238). Null is the ordinary case,
   * and then {@link body} is drawn.
   */
  readonly drawn: ReactNode | null;
  readonly at: string;
  /** The exact moment, for the pointer: the age is what is read. */
  readonly atTitle: string;
  /**
   * The mark that this question still waits on the person (D-0072 rule 3), in
   * the words that say *which* of the two reasons it waits for. Null on
   * everything else, which is what makes it a mark.
   */
  readonly waiting: string | null;
  /** What this message answered, where it was said (D-0072 rule 1). */
  readonly answered: string | null;
  /**
   * What the message rests on, each leading where it points (D-0061 rule 2.6)
   * -- **never an id to copy**. Rule 5 names this as rondo's way back to the
   * words it read.
   */
  readonly bases: readonly ThreadLink[];
  readonly basesLabel: string;
  /**
   * The issues this message named that rondo has not read yet (D-0078 section
   * 4.3): said until the host's read lands as its own message under it, so a
   * name that never gets read is visibly waiting rather than silently absent.
   */
  readonly pending: readonly string[];
  readonly pendingSaid: string;
  /**
   * The line it answers, said only where that is neither the message above it
   * nor the request itself -- which is how every reply reads by default.
   */
  readonly inReplyTo: ThreadLink | null;
  /** The way to point the box at this message; null with no write port. */
  readonly reply: { readonly href: string; readonly said: string } | null;
}

export interface ThreadProps {
  /** The request's own first words, as its title. */
  readonly title: string;
  /** Rule 6's line, composed by the caller; null where nothing is known to say. */
  readonly governance: ReactNode;
  /**
   * Where this request stands among the ones waiting, and the way to the next
   * (rule 3's *your turn 1 / 3, next*).
   *
   * **The walk goes in the same order the list does** -- oldest first -- so a
   * person with three things waiting meets the one that has been waiting
   * longest and can keep going without choosing each time. Null where this
   * request is not one of them: a position among things that wait is not a
   * thing a request that waits on nobody has.
   */
  readonly walk: {
    readonly said: string;
    readonly nextHref: string | null;
    readonly nextSaid: string;
  } | null;
  /**
   * The thread in the order it happened, messages and event lines together.
   *
   * **One stream rather than two lists.** Rule 5 names the parts in the order
   * a person meets them -- the words, rondo's reading, the event lines, the
   * reports, the question -- and that order is time. Drawing the messages and
   * then the events would put the record of the work after the report it
   * produced, which is not how it happened.
   */
  readonly items: readonly ThreadItem[];
  /** Where the reading stopped, among the items (rule 7). */
  readonly lastLookedAbove: string | null;
  readonly lastLookedSaid: string;
  /**
   * The box to answer in, where a question is standing (rule 9), and the box
   * to add to the request, which is always there (rule 5).
   *
   * Both arrive as they are: this face decides where they sit and not what is
   * in them.
   */
  readonly answering: ReactNode;
  readonly adding: ReactNode;
  /**
   * The screens this request can be taken to next -- setting its scope,
   * publishing a lap that is ready (`D-0083` rule 6's chain, as addresses).
   *
   * **They are here because the rows that carried them are gone.** The old
   * page put each on the lap's row; the row's replacement is a list entry that
   * carries the person's own words and one sentence of state, and nothing to
   * press. A screen rondo still has and no page leads to is a screen only a
   * typed address reaches.
   */
  readonly acts: ReactNode;
}

/** One thing in the thread: something said, or something that happened. */
export type ThreadItem =
  | { readonly kind: "message"; readonly message: ThreadMessage }
  | { readonly kind: "event"; readonly event: ThreadEvent };

/** What identifies an item, for the last-looked line and for a stable redraw. */
function idOf(item: ThreadItem): string {
  return item.kind === "message" ? item.message.id : item.event.id;
}

function Word({ link, className }: { readonly link: ThreadLink; readonly className: string }) {
  return link.href === null ? (
    <span className={className} title={link.title}>
      {link.said}
    </span>
  ) : (
    <a className={className} href={link.href} title={link.title}>
      {link.said}
    </a>
  );
}

function Message({ message }: { readonly message: ThreadMessage }) {
  return (
    <article
      id={message.id}
      className={`msg msg-${message.who}`}
      data-voice={message.voice}
      {...(message.waiting === null ? {} : { "data-waiting": "" })}
    >
      <div className="msg-body">
        <h5>
          <span className="msg-who">{message.said}</span>
          {message.waiting === null ? null : <span className="msg-wait">{message.waiting}</span>}
          {message.answered === null ? null : (
            <span className="msg-answered">{message.answered}</span>
          )}
          {/*
           * **The age is the message's link to itself** and the id is never
           * printed: an id is for a screen to link by, not for anyone to
           * copy (D-0071 rule 4.2).
           */}
          <a className="msg-at" href={`#${encodeURIComponent(message.id)}`} title={message.atTitle}>
            <time>{message.at}</time>
          </a>
          {message.reply === null ? null : (
            <a
              className="msg-reply"
              id={`reply-${message.id}`}
              href={message.reply.href}
              data-open=""
            >
              {message.reply.said}
            </a>
          )}
        </h5>
        {message.inReplyTo === null ? null : <Word link={message.inReplyTo} className="msg-back" />}
        {/*
         * `lang=""` is HTML's own way of saying *the language here is
         * unknown* (D-0055 rule 8): rondo does not read the words to find
         * out what language they are in, and an absent attribute would
         * inherit the chrome's, which is a guess.
         */}
        {message.drawn ?? <p lang="">{message.body}</p>}
        {message.pending.map((named) => (
          <p className="msg-pending" key={named}>
            <b>{named}</b> {message.pendingSaid}
          </p>
        ))}
        {message.bases.length === 0 ? null : (
          <p className="msg-bases">
            <span className="msg-bases-label">{message.basesLabel}</span>
            {message.bases.map((basis) => (
              <Word key={basis.said} link={basis} className="basis" />
            ))}
          </p>
        )}
      </div>
    </article>
  );
}

export function ThreadFace({
  title,
  governance,
  walk,
  items,
  lastLookedAbove,
  lastLookedSaid,
  answering,
  adding,
  acts,
}: ThreadProps) {
  return (
    <div className="thread">
      <header className="thread-head">
        <h1 lang="">{title}</h1>
        {/*
         * **Governance is permanent, in one line under the title, at every
         * width** (rule 6). It is not a fold and not a card: a person
         * answering a question should not have to go looking for what was
         * agreed.
         */}
        {governance}
        {walk === null ? null : (
          <p className="thread-walk">
            <span>{walk.said}</span>
            {walk.nextHref === null ? null : (
              <a href={walk.nextHref} data-open="">
                {walk.nextSaid}
              </a>
            )}
          </p>
        )}
      </header>
      {items.map((item) => (
        <div key={idOf(item)}>
          {idOf(item) === lastLookedAbove ? <LastLookedLine said={lastLookedSaid} /> : null}
          {item.kind === "message" ? (
            <Message message={item.message} />
          ) : (
            <EventLine event={item.event} />
          )}
        </div>
      ))}
      {acts}
      {answering}
      {adding}
    </div>
  );
}
