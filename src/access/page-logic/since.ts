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
 * one number, said on the page and pointing nowhere else (`D-0173` K3: a step to
 * a terminal is off the line).
 */
import { type IterationStatus, isTerminal, type RecordChange } from "../../store/records.js";
import type { AdvisoryRecord } from "../../store/sqlite.js";

/** The change kinds whose id is a lap's: each says that lap moved. */
/**
 * A gate answer is among them as its lap moving, and not as the person's act:
 * `changedSince` carries no actor, and rondo answers some gates itself.
 */
const LAP_KINDS: ReadonlySet<string> = new Set([
  "iteration",
  "gate_answer",
  "lap_reading",
  "operator_verification_claim",
  "scope_consumption",
  "held_start",
]);

/** One request that moved, and how, counted off the changed rows. */
export interface MovedRequest {
  readonly messageId: string;
  /** The person looking wrote the request itself since the mark. */
  readonly asked: boolean;
  /** Messages rondo (its drafter, or the forge) wrote into the thread. */
  readonly rondoWrote: number;
  /** Messages the person wrote into the thread, the request itself aside. */
  readonly youWrote: number;
  /** Messages somebody else wrote into it, the request itself among them. */
  readonly othersWrote: number;
  /** Distinct laps that moved. */
  readonly lapsMoved: number;
  /** Of those, the ones that ended since the mark. */
  readonly lapsEnded: number;
  /** Those laps' ids, which the answer across every request names one by one (rondo#656). */
  readonly endedLaps: readonly string[];
  /** The ids of the messages rondo wrote into the thread, which `rondoWrote` counts. */
  readonly rondoSaid: readonly string[];
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
  /**
   * Who wrote a message, as the person looking reads it -- themselves, another
   * person, or rondo -- or undefined for a message this draw did not read.
   */
  readonly authorOf: (messageId: string) => "you" | "other" | "rondo" | undefined;
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
      rondoSaid: string[];
      youWrote: number;
      othersWrote: number;
      laps: Set<string>;
      ended: Set<string>;
      atMs: number;
    }
  >();
  let elsewhere = 0;
  const under = (requestId: string, atMs: number) => {
    const entry = byRequest.get(requestId) ?? {
      asked: false,
      rondoSaid: [],
      youWrote: 0,
      othersWrote: 0,
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
      if (author === "other") {
        entry.othersWrote += 1;
      } else if (root === change.id && author === "you") {
        // A request rondo opened itself (a goal flow's) is rondo's message.
        entry.asked = true;
      } else if (author === "you") {
        entry.youWrote += 1;
      } else {
        entry.rondoSaid.push(change.id);
      }
      continue;
    }
    const lap = LAP_KINDS.has(change.kind) ? reads.lapOf(change.id) : null;
    if (lap === null) {
      elsewhere += 1;
      continue;
    }
    const entry = under(lap.requestId, change.atMs);
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
        rondoWrote: entry.rondoSaid.length,
        youWrote: entry.youWrote,
        othersWrote: entry.othersWrote,
        lapsMoved: entry.laps.size,
        lapsEnded: entry.ended.size,
        endedLaps: [...entry.ended],
        rondoSaid: entry.rondoSaid,
        atMs: entry.atMs,
      }))
      .toSorted((left, right) => right.atMs - left.atMs),
    elsewhere,
  };
}

/**
 * **Where the person last looked** (rondo#631, D-0083 rules 4 and 7): the later
 * of the terminal's mark and one past the person's own last press, read off
 * rows that press already wrote. The page and the answer across every request
 * (rondo#656) both read it here, so they cannot disagree about where the
 * person stopped. `beforeMs` leaves out marks and presses from then on: the
 * question an answer is written for is itself a press, and is not where the
 * person looked.
 */
export async function lastLooked(
  record: Pick<AdvisoryRecord, "lastView" | "lastActed">,
  actorId: string,
  beforeMs?: number,
): Promise<number | null> {
  const viewed = await record.lastView(actorId, beforeMs);
  const acted = await record.lastActed(actorId, beforeMs);
  return acted === null ? viewed : Math.max(viewed ?? acted + 1, acted + 1);
}

/**
 * The reads {@link sinceLooked} sorts with, over the messages and laps one
 * draw read: the page's centre and the answer across every request (rondo#656)
 * build them here, so a row is one request's on both. Another person's
 * message is theirs, not the one looking's (Codex).
 */
export function sinceReads(
  byId: ReadonlyMap<string, { readonly authorKind: string; readonly authorId: string }>,
  rootOf: SinceReads["rootOf"],
  actorId: string | null,
  records: readonly {
    readonly id: string;
    readonly requestMessageId: string;
    readonly status: IterationStatus;
    readonly updatedAtMs: number;
  }[],
): SinceReads {
  const laps = new Map(
    records.map((record) => [
      record.id,
      {
        requestId: record.requestMessageId,
        ended: isTerminal(record.status),
        updatedAtMs: record.updatedAtMs,
      },
    ]),
  );
  return {
    authorOf: (messageId) => {
      const message = byId.get(messageId);
      if (message === undefined) {
        return undefined;
      }
      return message.authorKind !== "operator"
        ? "rondo"
        : message.authorId === actorId
          ? "you"
          : "other";
    },
    rootOf,
    lapOf: (iterationId) => laps.get(iterationId) ?? null,
  };
}
