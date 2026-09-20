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
import type { IterationRecord } from "../../store/records.js";
import type { ThreadEvent } from "../page/events.js";
import type { Chrome } from "../wording.js";

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
): { readonly said: string; readonly aside?: ThreadEvent["aside"] } {
  if (record.status === "closed") {
    return { said: wording.evFinished };
  }
  if (record.status !== "failed" || record.reason === null) {
    return { said: wording.evStopped };
  }
  switch (record.failureKind) {
    case "refusal":
      return { said: wording.evRefused(record.reason) };
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
    const ended = endedLine(wording, record);
    events.push({
      id: `${record.id}:ended`,
      kind: record.status === "closed" ? "passed" : "other",
      said: said(ended.said),
      at: at(record.updatedAtMs),
      atMs: record.updatedAtMs,
      tryAt,
      // Spread rather than set, so a line with nothing shut under it is the
      // same object it has always been.
      ...(ended.aside === undefined ? {} : { aside: ended.aside }),
    });
  }
  return events;
}
