/**
 * `rondo decisions`: every decision the store holds, one ASCII line each
 * (D-0190 rule 10.4). `rondo asks`, `rondo raises` and `rondo explains` beside
 * it, under the same rules below.
 *
 * Read-only: it writes no row, moves no last-look mark and drives no continuo.
 * It prints the option's index and never its text or any body, so a line says
 * who decided what and where to look, and the words stay on the page.
 */
import type { AskFrequencyRow } from "../store/ask-frequency.js";
import type { DecisionRow } from "../store/decision-log.js";
import type { TriageJudgementRow } from "../store/judgement-signals.js";
import { openAdvisoryRecord, openJudgementSignals } from "../store/sqlite.js";
import type { ParsedCommand } from "./cli-parse.js";
import { asciiEscape, consoleSeams } from "./console.js";
import { MODEL_DRAFTER_PREFIX } from "./model-draft/judgement.js";
import { asDecision } from "./page/triage.js";

/** The read-only commands' lines of `rondo --help`, in its columns. */
export const DECISION_READS_USAGE = `  rondo decisions [--since TIME] [--attention]
                          every decision held, oldest first: who took it, its
                          outcome, the option index pressed, the row it is
                          about. Writes nothing. --since is ISO 8601, inclusive;
                          --attention adds what was presented or withheld
  rondo asks              per request, the drafter's asks back and how many
                          presses took its recommendation. --since as above
  rondo raises            per triage reading, points raised vs decided, raised
                          ones answered as recommended, and sent decided ones
                          the person replied to. --since as above
  rondo explains          per thing asked about, how often the explainer was
                          asked (the K4 signal). --since as above`;

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

function print(lines: readonly string[]): number {
  for (const line of lines) {
    consoleSeams.write(`${asciiEscape(line)}\n`);
  }
  return 0;
}

/**
 * `rondo raises`: per triage reading, what would falsify its raised-or-decided
 * reading (rondo#659, `D-0193`): a line per reading, then one over them all
 * whose three shares are the three falsifiers. Ids and counts only.
 */
async function commandRaises(storePath: string, sinceMs: number | null): Promise<number> {
  const rows = openJudgementSignals(storePath).triageJudgement(sinceMs, asDecision);
  const sum = (pick: (row: TriageJudgementRow) => number): number =>
    rows.reduce((total, row) => total + pick(row), 0);
  const [candidates, raising, answeredPoints, asRecommended, sentDecided, replied] = [
    sum((row) => row.candidates),
    sum((row) => row.raising),
    sum((row) => row.answeredPoints),
    sum((row) => row.asRecommended),
    sum((row) => row.sentDecided),
    sum((row) => row.replied),
  ];
  return print([
    ...rows.map((row) =>
      [
        new Date(row.atMs).toISOString(),
        `reading=${row.reading}`,
        `repository=${row.repository}`,
        `candidates=${String(row.candidates)}`,
        `raising=${String(row.raising)}`,
        `raised=${String(row.raised)}`,
        `decided=${String(row.decided)}`,
        `asks=${String(row.asks)}`,
        `answered=${String(row.answered)}`,
        `answered_points=${String(row.answeredPoints)}`,
        `as_recommended=${String(row.asRecommended)}`,
        `sent_decided=${String(row.sentDecided)}`,
        `replied=${String(row.replied)}`,
      ].join(" "),
    ),
    [
      `readings=${String(rows.length)}`,
      `candidates=${String(candidates)}`,
      `raised=${String(sum((row) => row.raised))}`,
      `decided=${String(sum((row) => row.decided))}`,
      `raising_share=${ratio(raising, candidates)}`,
      `as_recommended_share=${ratio(asRecommended, answeredPoints)}`,
      `replied_share=${ratio(replied, sentDecided)}`,
    ].join(" "),
  ]);
}

/**
 * `rondo explains`: the K4 signals, one line per thing asked about, most asked
 * first, then one over them all (rondo#659, `D-0177`). The thing is its basis,
 * ids only; `-` is a question typed into the reply box about nothing pressed.
 */
async function commandExplains(storePath: string, sinceMs: number | null): Promise<number> {
  const rows = openJudgementSignals(storePath).explainSignals(sinceMs);
  return print([
    ...rows.map((row) =>
      [
        `about=${row.about ?? "-"}`,
        `asked=${String(row.asked)}`,
        `button=${String(row.button)}`,
        `text=${String(row.text)}`,
        `first=${new Date(row.firstAtMs).toISOString()}`,
        `last=${new Date(row.lastAtMs).toISOString()}`,
      ].join(" "),
    ),
    `things=${String(rows.length)} asked=${String(rows.reduce((total, row) => total + row.asked, 0))}`,
  ]);
}

/** The read-only commands this module serves, by name. */
export function commandDecisionReads(
  storePath: string,
  parsed: Pick<ParsedCommand, "command" | "sinceMs" | "attention">,
): Promise<number> {
  switch (parsed.command) {
    case "asks":
      return commandAsks(storePath, parsed.sinceMs);
    case "raises":
      return commandRaises(storePath, parsed.sinceMs);
    case "explains":
      return commandExplains(storePath, parsed.sinceMs);
    default:
      return commandDecisions(storePath, parsed.sinceMs, parsed.attention);
  }
}
