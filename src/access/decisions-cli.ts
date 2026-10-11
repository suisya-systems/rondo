/**
 * `rondo decisions`: every decision the store holds, one ASCII line each
 * (D-0190 rule 10.4).
 *
 * Read-only: it writes no row, moves no last-look mark and drives no continuo.
 * It prints the option's index and never its text or any body, so a line says
 * who decided what and where to look, and the words stay on the page.
 */
import type { DecisionRow } from "../store/decision-log.js";
import { openAdvisoryRecord } from "../store/sqlite.js";
import { asciiEscape, consoleSeams } from "./console.js";

/** One row as one line, every field named and `-` for an absent one. */
function decisionLine(row: DecisionRow): string {
  return [
    new Date(row.atMs).toISOString(),
    row.kind,
    row.id ?? "-",
    `by=${row.by}`,
    `actor=${row.actor ?? "-"}`,
    `outcome=${row.outcome}`,
    ...(row.option === null ? [] : [`option=${String(row.option)}`]),
    `locator=${row.locator ?? "-"}`,
  ].join(" ");
}

export async function commandDecisions(
  storePath: string,
  sinceMs: number | null,
  attention: boolean,
): Promise<number> {
  const rows = await openAdvisoryRecord(storePath).decisions(sinceMs, attention);
  const lines = rows.length === 0 ? ["no decisions are recorded."] : rows.map(decisionLine);
  for (const line of lines) {
    consoleSeams.write(`${asciiEscape(line)}\n`);
  }
  return 0;
}
