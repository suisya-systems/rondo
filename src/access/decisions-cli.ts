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
 * `D-0197`'s thresholds: each of `D-0193`'s falsifiers is breached when its
 * share is at least `share` over at least `minimum` of its denominator.
 */
export const FALSIFIER_THRESHOLDS = {
  raising: { share: 0.8, minimum: 20 },
  asRecommended: { share: 0.9, minimum: 10 },
  replied: { share: 0.5, minimum: 10 },
} as const;

/** `D-0197` rule 2: a thing asked about this often in the window trips K4. */
export const K4_REPEAT = 2;

/** `yes` or `no` against a threshold, or `-` with too little to judge (`D-0197` rule 1). */
export function breached(n: number, d: number, at: { share: number; minimum: number }): string {
  if (d < at.minimum) {
    return "-";
  }
  return n / d >= at.share ? "yes" : "no";
}

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
 * whose three shares are the three falsifiers, each with whether it breaches
 * `D-0197`'s threshold. Ids and counts only.
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
      `raising_breached=${breached(raising, candidates, FALSIFIER_THRESHOLDS.raising)}`,
      `as_recommended_breached=${breached(asRecommended, answeredPoints, FALSIFIER_THRESHOLDS.asRecommended)}`,
      `replied_breached=${breached(replied, sentDecided, FALSIFIER_THRESHOLDS.replied)}`,
    ].join(" "),
  ]);
}

/**
 * `rondo explains`: the K4 signals, one line per thing asked about, most asked
 * first, then one over them all (rondo#659, `D-0177`). The thing is its basis,
 * ids only; `-` is a question typed into the reply box about nothing pressed.
 * The last line says whether K4 tripped by `D-0197` rule 2.
 */
async function commandExplains(storePath: string, sinceMs: number | null): Promise<number> {
  const rows = openJudgementSignals(storePath).explainSignals(sinceMs);
  // A typed question (`about` null) is about nothing pressed, so it never repeats a thing.
  const repeated = rows.filter((row) => row.about !== null && row.asked >= K4_REPEAT).length;
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
    [
      `things=${String(rows.length)}`,
      `asked=${String(rows.reduce((total, row) => total + row.asked, 0))}`,
      `repeated=${String(repeated)}`,
      `k4_tripped=${repeated > 0 ? "yes" : "no"}`,
    ].join(" "),
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
