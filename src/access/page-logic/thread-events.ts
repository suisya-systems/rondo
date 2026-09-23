/**
 * The event lines one lap produces (DECISIONS.md D-0083 rule 7).
 *
 * **Read off rows that already exist, and stored nowhere.** rondo holds no
 * event table: what a lap did is its row's own columns and the readings
 * appended to it, and this composes lines from those. A framing that outlived
 * the material it was drawn from could drift from it silently (`D-0032` rule
 * 3), which is the same argument `src/access/inbox.ts` opens with.
 *
 * **What is not here yet, and is not faked.** Rule 7 also puts *rondo decided
 * this without asking* on the time axis, with the hollow dot. Those rows are
 * the `attention` table's `withheld` side (`D-0032` rule 10), and
 * `attentionBreakdown` can be asked for a time interval but not for a
 * request -- so this cannot place them on one request's thread without a
 * reader the store does not have. They are absent rather than approximated:
 * putting another request's count on this thread would be the same kind of
 * lie rule 6 forbids when it refuses a spent figure without its allowance.
 * The `decided` kind exists in `page/events.tsx` and is drawn the moment
 * there is something true to draw with it.
 */

import {
  APPROVED_OUTCOME,
  approvedForPublication,
  type IterationRecord,
  planField,
} from "../../store/records.js";
import type { ThreadEvent } from "../page/events.js";
import type { Chrome } from "../wording.js";
import { refusalSaid } from "./laps.js";
import type { LapResult } from "./result.js";

/**
 * What happened to a lap after its gate, which its own row does not hold
 * (rondo#376): whether the next try was built on it, and what its publish and
 * checks reports say.
 *
 * **Which answer the gate was given is not read from here** (rondo#385,
 * D-0092): it is `record.gateAnswer`. `revised` used to stand in for it, and a
 * change whose next try was refused read as an approval.
 */
export interface AfterGate {
  readonly revised: boolean;
  readonly result: LapResult | null;
}

/** Whether the gate was answered yes, in either spelling the row has carried. */
export function approvedAt(record: IterationRecord): boolean {
  return record.gateOutcome === APPROVED_OUTCOME || record.gateOutcome === "approve";
}

/**
 * Whether another try of the request was built on this one, which is what
 * *ask for a change* leaves behind: a revision's base branch is its
 * predecessor's topic branch (`src/refrain/revision.ts`), and the gate it
 * answered closed exactly as an approval does.
 */
export function revisedIn(record: IterationRecord, laps: readonly IterationRecord[]): boolean {
  const topic = planField(record, "topic_branch");
  return (
    topic !== "" &&
    laps.some((lap) => lap.id !== record.id && planField(lap, "base_branch") === topic)
  );
}

/**
 * The lap a request's result is said by (rondo#376): the newest one whose gate
 * was recorded as approved (D-0092), or null where none was. Oldest first in,
 * as the thread holds them.
 */
export function resultLap(laps: readonly IterationRecord[]): IterationRecord | null {
  return laps.findLast(approvedForPublication) ?? null;
}

/** One reading of a lap, narrowed to what a line is made from. */
export interface ReadingLine {
  readonly drafter: string;
  readonly verdict: string;
  readonly findings: readonly string[];
  readonly atMs: number;
}

/** Whether a reading is the automatic checks rather than a model's. */
function isChecks(drafter: string): boolean {
  return !drafter.startsWith("rondo/model/");
}

/**
 * How an ended lap's last line reads, and what is shut under it (rondo#348).
 *
 * **The whole of what the new column is for.** `failed` used to be one
 * sentence over two failures that mean opposite things to a person, because
 * the kind was dropped where the row was written. Now:
 *
 * - **an upstream refusal is the person's to act on**, so what was said is
 *   relayed into the line itself (D-0076 rule 4.4, `D-0015` rule 7);
 * - **a defect is rondo's**, so the line says that in rondo's stead and the
 *   reason goes into one shut fold marked for whoever maintains rondo (rule
 *   4.5). Nothing of it is inline;
 * - **a row that does not say which** -- every row written before the column,
 *   and every other terminal status -- reads exactly as it read before.
 *
 * A refusal with no reason on the row falls back to the same line too: a
 * relaying sentence with nothing to relay would promise the person words that
 * are not there.
 */
function endedLine(
  wording: Chrome,
  record: IterationRecord,
  after: AfterGate,
): { readonly said: string; readonly aside?: ThreadEvent["aside"]; readonly yours?: true } {
  if (record.status === "closed") {
    // **What was answered, and nothing it did not do** (rondo#376): `closed`
    // is the gate ending. It used to read *taken in*, which in Japanese says
    // merged, over work nobody had even pushed.
    if (record.gateOutcome === null) {
      return { said: wording.evFinished };
    }
    if (!approvedAt(record)) {
      return { said: wording.evClosedUnapproved };
    }
    // **What the person pressed, from the record rondo made when it carried
    // the answer** (rondo#385, D-0092), and not from whether a next try exists:
    // a change whose next try was refused has none, and read as an approval.
    // A lap answered before the record existed falls back to the old reading
    // only where it cannot be wrong -- a next try built on it is a change --
    // and otherwise says rondo does not know.
    const answer = record.gateAnswer ?? (after.revised ? "revise" : null);
    if (answer === "approve") {
      return { said: wording.evApproved(after.result !== null) };
    }
    if (answer === "revise") {
      return { said: after.revised ? wording.evAskedChange : wording.evAskedChangeNoNextTry };
    }
    return { said: wording.evAnswerUnrecorded };
  }
  if (record.status !== "failed" || record.reason === null) {
    return { said: wording.evStopped };
  }
  switch (record.failureKind) {
    case "refusal":
      // The person's to act on, so the fold leaves it on the axis (D-0082
      // rule 7): this is the only place that still knows the failure was a
      // refusal rather than a stop, and the fold will not read the sentence
      // back to find out (rondo#317).
      // continuo refusals rondo knows by their words are told in rondo's
      // words instead (D-0076, `refusalSaid`).
      return {
        said: refusalSaid(wording, record, record.reason) ?? wording.evRefused(record.reason),
        yours: true,
      };
    case "defect":
      return {
        said: wording.evBroke,
        aside: { said: wording.evBrokeReason, text: record.reason },
      };
    default:
      return { said: wording.evStopped };
  }
}

/**
 * The lines one lap contributes, oldest first.
 *
 * `isTerminal` is handed in rather than imported so this stays a function of
 * what it was given: the store owns which statuses are terminal, and this owns
 * what a person reads about them.
 */
export function lapEvents(
  wording: Chrome,
  record: IterationRecord,
  readings: readonly ReadingLine[],
  isTerminal: (status: string) => boolean,
  at: (atMs: number) => string,
  /**
   * Which try of the request this lap is, or null where it is the only one.
   *
   * **Said because otherwise the record is unreadable** (D-0076 rule 3.3, and
   * the mock's own lines). A request with four laps draws four *work started*
   * and four *finished*, and a person cannot tell which ending belongs to
   * which attempt -- so the line says the try, which is a thing a person has
   * (rule 6 counts tries too) and not an identifier of rondo's. With one lap
   * there is nothing to tell apart and the number would be noise.
   */
  tryAt: number | null = null,
  after: AfterGate = { revised: false, result: null },
): readonly ThreadEvent[] {
  const said = (line: string) => (tryAt === null ? line : wording.evOfTry(tryAt, line));
  const events: ThreadEvent[] = [
    {
      id: `${record.id}:started`,
      kind: "other",
      said: said(wording.evStarted),
      at: at(record.createdAtMs),
      atMs: record.createdAtMs,
      tryAt,
    },
  ];
  for (const [index, reading] of readings.entries()) {
    const id = `${record.id}:reading:${String(index)}`;
    if (reading.verdict === "unavailable") {
      events.push({
        id,
        kind: "other",
        said: said(wording.evReadingUnavailable),
        at: at(reading.atMs),
        atMs: reading.atMs,
        tryAt,
      });
      continue;
    }
    const clear = reading.findings.length === 0;
    events.push({
      id,
      // Green for passed and red for failed, which is the whole of what the
      // dot says (D-0082 rule 2).
      kind: clear ? "passed" : "failed",
      said: said(
        isChecks(reading.drafter)
          ? clear
            ? wording.evChecksPassed
            : wording.evChecksFailed
          : clear
            ? wording.evReadingClear
            : wording.evReadingRaised(reading.findings.length),
      ),
      at: at(reading.atMs),
      atMs: reading.atMs,
      tryAt,
    });
  }
  if (isTerminal(record.status)) {
    const ended = endedLine(wording, record, after);
    events.push({
      id: `${record.id}:ended`,
      // The person's own answer is drawn in ink (D-0082 rule 2); green is for
      // a check that passed, and an answered gate is not one.
      kind: record.status === "closed" && record.gateOutcome !== null ? "person" : "other",
      said: said(ended.said),
      at: at(record.updatedAtMs),
      atMs: record.updatedAtMs,
      tryAt,
      // Spread rather than set, so a line with nothing shut under it -- and
      // nothing for the person to do about it -- is the same object it has
      // always been.
      ...(ended.aside === undefined ? {} : { aside: ended.aside }),
      ...(ended.yours === undefined ? {} : { yours: ended.yours }),
    });
  }
  const result = after.result;
  if (result !== null) {
    const pullRequest = wording.pullRequest(result.number);
    events.push({
      id: `${record.id}:published`,
      kind: "other",
      said: said(result.pushedOnto ? wording.evPushedOnto : wording.evPublished),
      at: at(result.atMs),
      atMs: result.atMs,
      tryAt,
      ...(result.url === null ? {} : { href: result.url, linkSaid: pullRequest }),
    });
    if (result.checksAtMs !== null) {
      events.push({
        id: `${record.id}:checks`,
        kind:
          result.checks.kind === "green"
            ? "passed"
            : result.checks.kind === "red"
              ? "failed"
              : "other",
        said: said(
          wording.evChecks(
            pullRequest,
            wording.checksWord(result.checks),
            wording.checksDetail(result.checks),
          ),
        ),
        at: at(result.checksAtMs),
        atMs: result.checksAtMs,
        tryAt,
      });
    }
  }
  return events;
}
