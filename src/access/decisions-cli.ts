/**
 * `rondo decisions`: every decision the store holds, one ASCII line each
 * (D-0190 rule 10.4). `rondo asks` beside it, under the same rules below.
 *
 * Read-only: it writes no row, moves no last-look mark and drives no continuo.
 * It prints the option's index and never its text or any body, so a line says
 * who decided what and where to look, and the words stay on the page.
 */
import type { AskFrequencyRow } from "../store/ask-frequency.js";
import type { DecisionRow } from "../store/decision-log.js";
import { openAdvisoryRecord } from "../store/sqlite.js";
import type { ParsedCommand } from "./cli-parse.js";
import { asciiEscape, consoleSeams } from "./console.js";
import { MODEL_DRAFTER_PREFIX } from "./model-draft/judgement.js";

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

async function commandDecisions(
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

/** `n / d` to two places, or `-` when there is nothing to divide by. */
const ratio = (n: number, d: number): string => (d === 0 ? "-" : (n / d).toFixed(2));

/**
 * `rondo asks`: how often the drafter asked back, one line per request it wrote
 * in, then one line over them all (rondo#637, `D-0189`'s A2). Read-only and
 * body-free, `commandDecisions`'s rule; ids and counts only.
 */
async function commandAsks(storePath: string, sinceMs: number | null): Promise<number> {
  const rows = await openAdvisoryRecord(storePath).askFrequency(sinceMs, MODEL_DRAFTER_PREFIX);
  const sum = (pick: (row: AskFrequencyRow) => number): number =>
    rows.reduce((total, row) => total + pick(row), 0);
  const asks = sum((row) => row.asks);
  const pressed = sum((row) => row.pressed);
  const recommended = sum((row) => row.recommended);
  const lines = [
    ...rows.map((row) =>
      [
        new Date(row.atMs).toISOString(),
        `request=${row.request}`,
        `asks=${String(row.asks)}`,
        `unanswered=${String(row.unanswered)}`,
        `pressed=${String(row.pressed)}`,
        `recommended=${String(row.recommended)}`,
      ].join(" "),
    ),
    [
      `requests=${String(rows.length)}`,
      `asked_in=${String(rows.filter((row) => row.asks > 0).length)}`,
      `asks=${String(asks)}`,
      `asks_per_request=${ratio(asks, rows.length)}`,
      `pressed=${String(pressed)}`,
      `recommended=${String(recommended)}`,
      `recommended_share=${ratio(recommended, pressed)}`,
    ].join(" "),
  ];
  for (const line of lines) {
    consoleSeams.write(`${asciiEscape(line)}\n`);
  }
  return 0;
}

/** The two read-only commands this module serves, by name. */
export function commandDecisionReads(
  storePath: string,
  parsed: Pick<ParsedCommand, "command" | "sinceMs" | "attention">,
): Promise<number> {
  return parsed.command === "asks"
    ? commandAsks(storePath, parsed.sinceMs)
    : commandDecisions(storePath, parsed.sinceMs, parsed.attention);
}
