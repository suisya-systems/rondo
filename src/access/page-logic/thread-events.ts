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
): readonly ThreadEvent[] {
  const events: ThreadEvent[] = [
    {
      id: `${record.id}:started`,
      kind: "other",
      said: wording.evStarted,
      at: at(record.createdAtMs),
    },
  ];
  for (const [index, reading] of readings.entries()) {
    const id = `${record.id}:reading:${String(index)}`;
    if (reading.verdict === "unavailable") {
      events.push({ id, kind: "other", said: wording.evReadingUnavailable, at: at(reading.atMs) });
      continue;
    }
    const clear = reading.findings.length === 0;
    events.push({
      id,
      // Green for passed and red for failed, which is the whole of what the
      // dot says (D-0082 rule 2).
      kind: clear ? "passed" : "failed",
      said: isChecks(reading.drafter)
        ? clear
          ? wording.evChecksPassed
          : wording.evChecksFailed
        : clear
          ? wording.evReadingClear
          : wording.evReadingRaised(reading.findings.length),
      at: at(reading.atMs),
    });
  }
  if (isTerminal(record.status)) {
    const closed = record.status === "closed";
    events.push({
      id: `${record.id}:ended`,
      kind: closed ? "passed" : "other",
      said: closed ? wording.evFinished : wording.evStopped,
      at: at(record.updatedAtMs),
    });
  }
  return events;
}
