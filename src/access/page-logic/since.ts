/**
 * What moved since the person last looked, per request (DECISIONS.md D-0083
 * rule 4, rondo#631).
 *
 * **The inbox's `changed` reading and no second one.** Rule 4 puts *since you
 * last looked* in the empty centre, and the terminal's `rondo inbox` already
 * reads it: every row that landed at or after the last-look mark, inclusive of
 * the mark (`D-0032` rule 11). This module only sorts those rows under the
 * request each one belongs to, so the centre can say one sentence per request
 * rather than a census of tables -- which is rule 4's *as sentences* and
 * `D-0076`'s refusal to put a table name on the screen.
 *
 * **A row with no request is counted, not dropped.** A proposal, a decision,
 * an attention row and the like belong to no one request's thread, and a
 * digest that left them out would read as *nothing else happened*. They are
 * one number, and the terminal lists each.
 */
import type { RecordChange } from "../../store/records.js";

/** The change kinds whose id is a lap's: each says that lap moved. */
const LAP_KINDS: ReadonlySet<string> = new Set([
  "iteration",
  "lap_reading",
  "operator_verification_claim",
  "scope_consumption",
  "held_start",
]);

/** One request that moved, and how, counted off the changed rows. */
export interface MovedRequest {
  readonly messageId: string;
  /** The request itself was written since the mark. */
  readonly asked: boolean;
  /** Messages rondo (its drafter, or the forge) wrote into the thread. */
  readonly rondoWrote: number;
  /** Messages the person wrote into the thread, the request itself aside. */
  readonly youWrote: number;
  /** Gates the person answered on this request's laps. */
  readonly youAnswered: number;
  /** Distinct laps that moved. */
  readonly lapsMoved: number;
  /** Of those, the ones that ended since the mark. */
  readonly lapsEnded: number;
  /** The newest change under it, which orders the list. */
  readonly atMs: number;
}

export interface SinceLooked {
  /** Newest first. */
  readonly moved: readonly MovedRequest[];
  /** Rows that landed since the mark under no request. */
  readonly elsewhere: number;
}

/** What the reading needs to know about the rows it sorts. */
export interface SinceReads {
  /** The message's author kind, or undefined for a message this draw did not read. */
  readonly authorOf: (messageId: string) => string | undefined;
  readonly rootOf: (messageId: string) => string | null;
  /** A lap's request and whether it has ended, and when it last moved, or null. */
  readonly lapOf: (
    iterationId: string,
  ) => { readonly requestId: string; readonly ended: boolean; readonly updatedAtMs: number } | null;
}

export function sinceLooked(
  changed: readonly RecordChange[],
  sinceMs: number,
  reads: SinceReads,
): SinceLooked {
  const byRequest = new Map<
    string,
    {
      asked: boolean;
      rondoWrote: number;
      youWrote: number;
      youAnswered: number;
      laps: Set<string>;
      ended: Set<string>;
      atMs: number;
    }
  >();
  let elsewhere = 0;
  const under = (requestId: string, atMs: number) => {
    const entry = byRequest.get(requestId) ?? {
      asked: false,
      rondoWrote: 0,
      youWrote: 0,
      youAnswered: 0,
      laps: new Set<string>(),
      ended: new Set<string>(),
      atMs,
    };
    entry.atMs = Math.max(entry.atMs, atMs);
    byRequest.set(requestId, entry);
    return entry;
  };
  for (const change of changed) {
    if (change.id === null) {
      elsewhere += 1;
      continue;
    }
    if (change.kind === "conversation_message") {
      const author = reads.authorOf(change.id);
      const root = reads.rootOf(change.id);
      if (author === undefined || root === null) {
        elsewhere += 1;
        continue;
      }
      const entry = under(root, change.atMs);
      if (root === change.id) {
        entry.asked = true;
      } else if (author === "operator") {
        entry.youWrote += 1;
      } else {
        entry.rondoWrote += 1;
      }
      continue;
    }
    const lap =
      LAP_KINDS.has(change.kind) || change.kind === "gate_answer" ? reads.lapOf(change.id) : null;
    if (lap === null) {
      elsewhere += 1;
      continue;
    }
    const entry = under(lap.requestId, change.atMs);
    if (change.kind === "gate_answer") {
      entry.youAnswered += 1;
    }
    entry.laps.add(change.id);
    // **Ended since the mark, not merely ended**: a reading that lands on a
    // lap closed last week moves it without ending it again.
    if (lap.ended && lap.updatedAtMs >= sinceMs) {
      entry.ended.add(change.id);
    }
  }
  return {
    moved: [...byRequest]
      .map(([messageId, entry]) => ({
        messageId,
        asked: entry.asked,
        rondoWrote: entry.rondoWrote,
        youWrote: entry.youWrote,
        youAnswered: entry.youAnswered,
        lapsMoved: entry.laps.size,
        lapsEnded: entry.ended.size,
        atMs: entry.atMs,
      }))
      .toSorted((left, right) => right.atMs - left.atMs),
    elsewhere,
  };
}
