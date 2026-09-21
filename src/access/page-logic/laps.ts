/**
 * What one lap says about itself, as sentences and orderings rather than as
 * markup (DECISIONS.md D-0046, D-0032, D-0036).
 *
 * **Lifted out of `src/access/web.tsx` by the page's rebuild.** Each of these
 * reads a row and answers with a string, a number or an ordering: what a lap
 * spent, how it ended and why, which of two laps says more about a request,
 * which laps are recent enough to draw. None of them draws, so none of them
 * dies with the view layer; what stayed behind is the part that picks a colour
 * or emits an element.
 *
 * `D-0046`'s distinction is the one to hold while reading these:
 * an unread cost is not a zero, and the three columns say so separately.
 */
import { isNestedSandboxRefusal } from "../../continuo/protocol.js";
import type { IterationRecord } from "../../store/records.js";
import { ago } from "../inbox.js";
import type { Chrome } from "../wording.js";

/**
 * How many ended laps the lead names before it stops counting back (rondo#145).
 *
 * ponytail: a fixed cap, and it caps the *rendering* rather than the read --
 * `terminalIterations` answers the whole ledger and this page sorts it every
 * five seconds. That is fine while a ledger is a session's worth of rows and is
 * the first thing to change if one is not; the store is where a bounded reader
 * would go, not here. *What just finished* is a question about the last few
 * minutes, and every ended row is still readable with `rondo explain`.
 */
export const RECENT_ENDED = 5;

/**
 * The `lang` the plan asked for, on the elements that quote material (D-0053
 * rule 12).
 *
 * **The field's one use at render time, and it is markup rather than a claim.**
 * The request paragraph and the material block carry the tag, which is what a
 * browser uses to pick a font and break a line. That is the legibility
 * complaint rondo#155 opened with, met with an attribute.
 *
 * **Where no ask was made the attribute is `lang=""`** (D-0055 rule 8), which
 * is HTML's own way of saying *the language here is unknown*. It used to be
 * absent, and an absent attribute inherits the document: harmless while the
 * document was always `en` and a guess once the chrome can be the operator's
 * language, because *rondo does not know* would arrive on the screen as *this
 * is Japanese*. The chrome and a row's material may disagree and nothing
 * reconciles them -- each is true about a different thing -- so the one thing
 * this attribute must not do is inherit an answer to a question nobody asked.
 *
 * **Derived from the ask and from nothing else.** rondo never reads material to
 * find out what language it is in (rule 8), so where a worker ignored the ask
 * the attribute is wrong exactly as far as the ask was wrong and no further.
 * Nothing is translated here or anywhere (rule 11): the tag decorates the same
 * bytes the page already quoted.
 *
 * Read off the row's own plan payload rather than through `readRunPlan`,
 * because a page that redraws every five seconds may not refuse a row over a
 * field it is only decorating: absent, null and anything that is not a string
 * all mean *no ask*, which is the same empty attribute. `runPlan` already
 * refused every tag that could reach a written payload, and the JSX renderer
 * escapes the attribute anyway.
 */
export function materialLanguage(record: IterationRecord): string {
  const asked = record.plan["material_language"];
  return typeof asked === "string" ? asked : "";
}

/** The fence column decoded, or `null` where it is not a list (`"null"`, or bytes that will not parse). */
export function decodedDenials(refused: string): readonly unknown[] | null {
  try {
    const parsed: unknown = JSON.parse(refused);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** How an ended lap ended: the status, and the answer or reason beside it. */
export function endedHow(wording: Chrome, record: IterationRecord, nowMs: number): string {
  return wording.endedHead(
    record.status,
    wording.age(ago(record.updatedAtMs, nowMs)),
    endedWhy(wording, record),
  );
}

export function endedWhy(wording: Chrome, record: IterationRecord): string {
  return record.gateOutcome !== null
    ? wording.gateAnswered(record.gateOutcome)
    : record.reason === null
      ? wording.noReasonRecorded
      : // continuo's words name its own verb and an errno (D-0076).
        isNestedSandboxRefusal(record.reason)
        ? wording.lapNestedSandbox
        : record.reason;
}

/** Which of the three questions a row answers, which is what its weight is decided by. */
export type Question = "waiting" | "attention" | "running" | "ended";

/** The lap a request has under it, as the requests list says it (rondo#244). */
export interface LapUnderRequest {
  readonly record: IterationRecord;
  readonly question: Question;
}

/**
 * Which of two laps a request is better said by: a live one, else the newest.
 *
 * **Live outranks terminal whatever their ages** (Codex round 2). A request can
 * hold more than one lap -- a retry beside the lap it supersedes -- and going
 * by age alone would let a failure that ended a minute ago speak for a request
 * whose other lap is still at its gate, and bring back *Set the scope* over
 * work that is still running. What the row answers is *what is this request
 * doing*, and an ended lap only answers that when nothing is left.
 */
export function saysMore(candidate: LapUnderRequest, held: LapUnderRequest | undefined): boolean {
  if (held === undefined) {
    return true;
  }
  const live = (lap: LapUnderRequest) => lap.question !== "ended";
  return live(candidate) === live(held)
    ? held.record.updatedAtMs < candidate.record.updatedAtMs
    : live(candidate);
}

/**
 * The laps that have ended, newest first and only the last few (rondo#145).
 *
 * **An ended row that will not decode is dropped on the terminal side and
 * nowhere else.** The live side shows one, because it holds a slot and
 * understating what is running misleads the one reader deciding whether to
 * start something else; an ended row holds nothing and asks nothing, and it has
 * no `updated_at_ms` to place in a "just finished" list at all. It stays in the
 * ledger and `rondo explain` still refuses it by name. The decoding is the
 * caller's since rondo#244, because the requests list reads the same rows
 * without this slice.
 */
export function endedRecently(records: readonly IterationRecord[]): readonly IterationRecord[] {
  return records
    .toSorted((left, right) => right.updatedAtMs - left.updatedAtMs)
    .slice(0, RECENT_ENDED);
}
