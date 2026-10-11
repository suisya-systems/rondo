/**
 * Which laps a person may end from the page (rondo#655): the ones that can
 * neither go on nor be answered, and so hold their room, money and files until
 * a person decides. One test for the page that draws the way to the press and
 * for the press that checks it again, so a screen gone stale ends nothing.
 */
import type { ReadOutcome } from "../../store/contract.js";
import type { IterationRecord } from "../../store/records.js";
import type { IterationStore } from "../../store/sqlite.js";

/** The longest reason an end press carries: a claim's length, so the form fits a press's body. */
export const MAX_END_REASON_CHARS = 1000;

/** The statuses a lap passes through before its gate opens (`IterationStatus`). */
export const BEFORE_THE_GATE: ReadonlySet<string> = new Set([
  "planned",
  "classified",
  "admitting",
  "admitted",
  "performing",
]);

/**
 * Whether a lap that decodes is one only a person can end: `stalled`, or held
 * before its gate by a start that threw and that rondo could not end
 * (`start-stopped-<lap>` is written over a row still there only then).
 */
export function endable(record: IterationRecord, messageIds: ReadonlySet<string>): boolean {
  return (
    record.status === "stalled" ||
    (BEFORE_THE_GATE.has(record.status) && messageIds.has(`start-stopped-${record.id}`))
  );
}

/** A lap a person may end now: one that decodes, or a live row that will not. */
export type EndableRow = Extract<ReadOutcome, { kind: "read" } | { kind: "unreadable" }>;

/**
 * The lap's row when a person may end it now, else null. A row that will not
 * decode is endable only while it is live, which `readLive` alone says: `read`
 * answers `unreadable` for a closed row with one bad column too.
 */
export async function endableRow(
  store: Pick<IterationStore, "read" | "readLive">,
  iterationId: string,
  messageIds: ReadonlySet<string>,
): Promise<EndableRow | null> {
  const row = await store.read(iterationId);
  if (row.kind === "read") {
    return endable(row.record, messageIds) ? row : null;
  }
  if (row.kind === "absent") {
    return null;
  }
  const live = await store.readLive();
  return live.some((one) => one.kind === "unreadable" && one.id === iterationId) ? row : null;
}
