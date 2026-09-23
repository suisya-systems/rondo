/**
 * A request's thread, as the page reads it (DECISIONS.md D-0061 rule 2).
 *
 * **Lifted out of `src/access/web.tsx` by the page's rebuild.** Which request
 * a message belongs to, which asks still wait on a person, and which message a
 * reply box answers are facts about the conversation, not about how it is
 * drawn -- so they survive the view layer being replaced.
 *
 * **The page must agree with the store about a waiting ask or it has no
 * working answering path** (#206, Codex): a question the page thought closed
 * would be drawn with a reply box, and the reply would be refused by the write
 * port while the line stayed held. That agreement is what {@link threadsOf}
 * computes, off the same rows `openAsksIn` queries.
 */
import type { AnswerOutcome, ThreadMessageDraft } from "../../store/records.js";
import { issueName, type NamedIssue, parseForgeRead } from "../issue-read.js";

/**
 * The request threads as the page reads them (D-0061 rule 2), with the two
 * facts every thread view needs derived once per render: which request a
 * message belongs to, and which asks still wait on the person.
 *
 * **An ask waits while no answer of the person's has carried it on** (D-0072
 * rule 3), which is the reading `openAsksIn` queries -- read here off the same
 * rows rather than asked once per request, because the page draws every thread.
 * An ordinary reply, a drafter's report and an answer that says to stop all
 * leave it waiting, and **the page must agree with the store about this or it
 * has no working answering path**: a question the page thought closed would be
 * drawn with a Reply box, and the reply would be refused by the write port
 * while the line stayed held (#206, Codex).
 */
export interface Threads {
  readonly messages: readonly ThreadMessageDraft[];
  readonly byId: ReadonlyMap<string, ThreadMessageDraft>;
  readonly rootOf: (messageId: string) => string | null;
  readonly waiting: ReadonlySet<string>;
  /**
   * Of {@link waiting}, the questions the person answered by stopping the line
   * (D-0072 rule 3): `OpenAsk.answeredStop` read off the same rows.
   *
   * **Both are held, and the difference is the record.** An unanswered question
   * says nobody has been back to it; a stopped one says the person has, and
   * said to stop. Telling someone who wrote "stop this line" that nobody has
   * answered is the thing this set exists to stop the page doing.
   */
  readonly stopped: ReadonlySet<string>;
  /** The operator messages with issues not read yet, and which (D-0078 section 4.3). */
  readonly unread: ReadonlyMap<string, readonly NamedIssue[]>;
  /**
   * The laps the reading view draws a section for, so an `iteration` basis is
   * a link only when its anchor exists (#220 S1, Codex): a cited lap older than
   * the reading's window is named and not linked to nowhere.
   */
  readonly inReading: ReadonlySet<string>;
}

export function threadsOf(
  messages: readonly ThreadMessageDraft[],
  inReading: ReadonlySet<string>,
  unread: ReadonlyMap<string, readonly NamedIssue[]>,
): Threads {
  const byId = new Map(messages.map((message) => [message.messageId, message]));
  // Only an operator's `carry_on` closes a question (D-0072 rule 3). The
  // `author_kind` is rule 4.4's "the person's reply" read literally: a drafter
  // message threaded under a stop does not release it.
  const answered = (outcome: AnswerOutcome): ReadonlySet<string> =>
    new Set(
      messages.flatMap((message) =>
        message.authorKind === "operator" &&
        message.answerOutcome === outcome &&
        message.inReplyTo !== null
          ? [message.inReplyTo]
          : [],
      ),
    );
  const carriedOn = answered("carry_on");
  const stoppedBy = answered("stop");
  // ponytail: a walk per message per render, which is O(messages x depth); a
  // thread is a conversation's worth of rows. A `root` column is the upgrade.
  const rootOf = (messageId: string): string | null => {
    let at = byId.get(messageId);
    const seen = new Set<string>();
    while (at !== undefined && at.inReplyTo !== null && !seen.has(at.messageId)) {
      seen.add(at.messageId);
      at = byId.get(at.inReplyTo);
    }
    return at?.inReplyTo === null ? at.messageId : null;
  };
  return {
    messages,
    byId,
    rootOf,
    waiting: new Set(
      messages
        .filter((message) => message.asks && !carriedOn.has(message.messageId))
        .map((message) => message.messageId),
    ),
    stopped: new Set(
      messages
        .filter(
          (message) =>
            message.asks && !carriedOn.has(message.messageId) && stoppedBy.has(message.messageId),
        )
        .map((message) => message.messageId),
    ),
    unread,
    inReading,
  };
}

/**
 * The latest question in `root`'s thread still waiting for the person's
 * answer, or null (rondo#431): while it waits, the answer is the way forward,
 * not a scope. One the person answered by stopping is not waiting for an
 * answer, though it still holds the line (D-0072 rule 3).
 */
export function waitingAsk(threads: Threads, root: string): string | null {
  return (
    threads.messages.findLast(
      (message) =>
        threads.waiting.has(message.messageId) &&
        !threads.stopped.has(message.messageId) &&
        threads.rootOf(message.messageId) === root,
    )?.messageId ?? null
  );
}

/** The first line of a message that says anything, for a chip or a list row. */
export function firstLine(body: string): string {
  return body.split("\n").find((line) => line.trim() !== "") ?? body;
}

/**
 * A lap's request as the person wrote it (rondo#439), as the list and the
 * thread name it: the brief rondo composed from it is not their words. The
 * brief only where the message is not there to read.
 */
export function requestWords(
  messages: readonly ThreadMessageDraft[],
  lap: { readonly requestMessageId: string; readonly request: string },
): string {
  return (
    messages.find((message) => message.messageId === lap.requestMessageId)?.body ?? lap.request
  );
}

/** {@link firstLine} of a message, where a read issue is its name and title, not its JSON. */
export function lineOf(message: ThreadMessageDraft): string {
  const read = message.authorKind === "forge" ? parseForgeRead(message.body) : null;
  return read === null
    ? firstLine(message.body)
    : `${issueName(read)}${"read" in read ? ` ${read.read.title}` : ""}`;
}

/**
 * The message a reply box answers: the one the person pointed at with `Reply`,
 * else the latest question still waiting in the thread, else the latest
 * message **the other party** wrote, else the thread's latest message.
 * `answers` is whether the target is a waiting question, which the box then
 * answers on a press (`/answer-ask`) rather than a send.
 *
 * **Not the person's own latest by default** (the S1 design pass on #220): a box
 * that read "Replying to you" under a drafter's question pointed a person at
 * their own words. A conversation answers the other side.
 */
export function replyTarget(
  threads: Threads,
  view: { readonly messageId: string; readonly to: string | null },
  actorId: string | null,
): {
  readonly root: string;
  readonly target: ThreadMessageDraft;
  readonly answers: boolean;
  readonly asksWaiting: boolean;
} | null {
  const root = threads.rootOf(view.messageId);
  if (root === null) {
    return null;
  }
  const members = threads.messages.filter((message) => threads.rootOf(message.messageId) === root);
  const asks = members.filter((message) => threads.waiting.has(message.messageId));
  const pointed = view.to === null ? undefined : threads.byId.get(view.to);
  const theirs = members.filter(
    (message) => !(message.authorKind === "operator" && message.authorId === actorId),
  );
  const target =
    (pointed !== undefined && members.includes(pointed) ? pointed : undefined) ??
    asks.at(-1) ??
    theirs.at(-1) ??
    members.at(-1);
  return target === undefined
    ? null
    : {
        root,
        target,
        answers: threads.waiting.has(target.messageId),
        asksWaiting: asks.length > 0,
      };
}
