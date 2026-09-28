/**
 * What one lap says about itself, as sentences and orderings rather than as
 * markup (DECISIONS.md D-0046, D-0032, D-0036).
 *
 * **Lifted out of `src/access/web.tsx` by the page's rebuild.** Each of these
 * reads a row and answers with a string, a number or an ordering: what a lap
 * spent, how it ended and why, which of two laps says more about a request,
 * which laps are recent enough to draw. None of them draws, so none of them
 * dies with the view layer; what stayed behind is the part that picks a colour
 * or emits an element.
 *
 * `D-0046`'s distinction is the one to hold while reading these:
 * an unread cost is not a zero, and the three columns say so separately.
 */
import {
  decodeLapCommands,
  isNestedSandboxRefusal,
  isTurnTimeoutRefusal,
  type LapCommand,
} from "../../continuo/protocol.js";
import type { IterationRecord } from "../../store/records.js";
import { ago } from "../inbox.js";
import type { Chrome } from "../wording.js";

/**
 * How many ended laps the lead names before it stops counting back (rondo#145).
 *
 * ponytail: a fixed cap, and it caps the *rendering* rather than the read --
 * `terminalIterations` answers the whole ledger and this page sorts it every
 * five seconds. That is fine while a ledger is a session's worth of rows and is
 * the first thing to change if one is not; the store is where a bounded reader
 * would go, not here. *What just finished* is a question about the last few
 * minutes, and every ended row is still readable with `rondo explain`.
 */
export const RECENT_ENDED = 5;

/**
 * The `lang` the plan asked for, on the elements that quote material (D-0053
 * rule 12).
 *
 * **The field's one use at render time, and it is markup rather than a claim.**
 * The request paragraph and the material block carry the tag, which is what a
 * browser uses to pick a font and break a line. That is the legibility
 * complaint rondo#155 opened with, met with an attribute.
 *
 * **Where no ask was made the attribute is `lang=""`** (D-0055 rule 8), which
 * is HTML's own way of saying *the language here is unknown*. It used to be
 * absent, and an absent attribute inherits the document: harmless while the
 * document was always `en` and a guess once the chrome can be the operator's
 * language, because *rondo does not know* would arrive on the screen as *this
 * is Japanese*. The chrome and a row's material may disagree and nothing
 * reconciles them -- each is true about a different thing -- so the one thing
 * this attribute must not do is inherit an answer to a question nobody asked.
 *
 * **Derived from the ask and from nothing else.** rondo never reads material to
 * find out what language it is in (rule 8), so where a worker ignored the ask
 * the attribute is wrong exactly as far as the ask was wrong and no further.
 * Nothing is translated here or anywhere (rule 11): the tag decorates the same
 * bytes the page already quoted.
 *
 * Read off the row's own plan payload rather than through `readRunPlan`,
 * because a page that redraws every five seconds may not refuse a row over a
 * field it is only decorating: absent, null and anything that is not a string
 * all mean *no ask*, which is the same empty attribute. `runPlan` already
 * refused every tag that could reach a written payload, and the JSX renderer
 * escapes the attribute anyway.
 */
export function materialLanguage(record: IterationRecord): string {
  const asked = record.plan["material_language"];
  return typeof asked === "string" ? asked : "";
}

/** The fence column decoded, or `null` where it is not a list (`"null"`, or bytes that will not parse). */
export function decodedDenials(refused: string): readonly unknown[] | null {
  try {
    const parsed: unknown = JSON.parse(refused);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** How an ended lap ended: the status, and the answer or reason beside it. */
export function endedHow(wording: Chrome, record: IterationRecord, nowMs: number): string {
  return wording.endedHead(
    record.status,
    wording.age(ago(record.updatedAtMs, nowMs)),
    endedWhy(wording, record),
  );
}

export function endedWhy(wording: Chrome, record: IterationRecord): string {
  return record.gateOutcome !== null
    ? wording.gateAnswered(record.gateOutcome)
    : record.reason === null
      ? wording.noReasonRecorded
      : (refusalSaid(wording, record, record.reason) ?? record.reason);
}

/**
 * The person's sentence for a continuo refusal rondo knows by its pinned words,
 * or null where it is not one of them and continuo's words are relayed.
 *
 * continuo's words name its own verb, an errno, a session id or milliseconds
 * (D-0076), so these two are said in rondo's words instead (rondo#432 for the
 * second). The turn budget is read off the plan, which is what the lap was
 * given, rather than out of continuo's sentence.
 */
export function refusalSaid(
  wording: Chrome,
  record: IterationRecord,
  reason: string,
): string | null {
  if (isNestedSandboxRefusal(reason)) {
    return wording.lapNestedSandbox;
  }
  if (isTurnTimeoutRefusal(reason)) {
    const budget = record.plan["turn_timeout_ms"];
    return wording.lapTurnTimedOut(
      typeof budget === "number" && budget > 0 ? Math.round(budget / 60_000) : null,
    );
  }
  return null;
}

/** Which of the three questions a row answers, which is what its weight is decided by. */
export type Question = "waiting" | "attention" | "running" | "ended";

/** The lap a request has under it, as the requests list says it (rondo#244). */
export interface LapUnderRequest {
  readonly record: IterationRecord;
  readonly question: Question;
}

/**
 * Which of two laps a request is better said by: a live one, else the newest.
 *
 * **Live outranks terminal whatever their ages** (Codex round 2). A request can
 * hold more than one lap -- a retry beside the lap it supersedes -- and going
 * by age alone would let a failure that ended a minute ago speak for a request
 * whose other lap is still at its gate, and bring back *Set the scope* over
 * work that is still running. What the row answers is *what is this request
 * doing*, and an ended lap only answers that when nothing is left.
 */
export function saysMore(candidate: LapUnderRequest, held: LapUnderRequest | undefined): boolean {
  if (held === undefined) {
    return true;
  }
  const live = (lap: LapUnderRequest) => lap.question !== "ended";
  return live(candidate) === live(held)
    ? held.record.updatedAtMs < candidate.record.updatedAtMs
    : live(candidate);
}

/**
 * The laps that have ended, newest first and only the last few (rondo#145).
 *
 * **An ended row that will not decode is dropped on the terminal side and
 * nowhere else.** The live side shows one, because it holds a slot and
 * understating what is running misleads the one reader deciding whether to
 * start something else; an ended row holds nothing and asks nothing, and it has
 * no `updated_at_ms` to place in a "just finished" list at all. It stays in the
 * ledger and `rondo explain` still refuses it by name. The decoding is the
 * caller's since rondo#244, because the requests list reads the same rows
 * without this slice.
 */
export function endedRecently(records: readonly IterationRecord[]): readonly IterationRecord[] {
  return records
    .toSorted((left, right) => right.updatedAtMs - left.updatedAtMs)
    .slice(0, RECENT_ENDED);
}

/**
 * One test run the worker made, as rondo read it off the lap's commands
 * (D-0104, rondo#410): the command, the runner's own counts, and whether the
 * command itself ended in error (a green suite under a `verify` whose lint
 * then failed is both). `index` is the transcript line continuo cites.
 */
export interface WorkerTestRun {
  readonly index: number;
  readonly command: string;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly isError: boolean;
}

/**
 * What the worker itself ran, apart from any reader's statement about itself
 * (D-0104, rondo#410). Three answers, and none of them is a zero:
 *
 * - `unrecorded`: the row holds no commands, continuo said it cannot say, or
 *   the column does not read -- so nothing can be said about the worker's run.
 * - `none`: the commands read, and none of them printed a test summary rondo
 *   knows. That is not "no tests ran": a runner rondo cannot read is the same
 *   row.
 * - `ran`: the last run the worker made, and how many it made before it.
 *   Where that run failed or ended in error, `supersededBy` names a later
 *   test command of the same lap that finished without error (rondo#497).
 *
 * rondo reads this; it runs nothing (D-0029 rule 9 is unchanged).
 */
export type WorkerRuns =
  | { readonly kind: "unrecorded" }
  | { readonly kind: "none"; readonly commandCount: number }
  | {
      readonly kind: "ran";
      readonly last: WorkerTestRun;
      readonly earlier: number;
      readonly supersededBy: LaterCleanRun | null;
    };

/** A test command after the last readable run that exited 0 and printed no summary rondo reads. */
export interface LaterCleanRun {
  readonly index: number;
  readonly command: string;
}

export function workerRuns(lapCommands: string | null): WorkerRuns {
  const decoded = lapCommands === null ? null : decodeLapCommands(lapCommands);
  if (decoded === null || decoded.kind !== "read") {
    return { kind: "unrecorded" };
  }
  const runs = testRuns(decoded.commands);
  const last = runs.at(-1);
  if (last === undefined) {
    return { kind: "none", commandCount: decoded.commands.length };
  }
  // The latest whole-suite command after it decides, whichever way it ended:
  // a clean one earlier than a failed one supersedes nothing (Codex, rondo#497).
  const later =
    last.failed > 0 || last.isError
      ? decoded.commands.findLast((c) => c.index > last.index && wholeSuiteCommand(c.command))
      : undefined;
  return {
    kind: "ran",
    last,
    earlier: runs.length - 1,
    supersededBy:
      later === undefined || later.isError ? null : { index: later.index, command: later.command },
  };
}

/** Every command that printed a test summary rondo reads, in order. */
function testRuns(commands: readonly LapCommand[]): WorkerTestRun[] {
  return commands.flatMap((c) => {
    const counts = testSummary(c.output);
    return counts === null
      ? []
      : [{ index: c.index, command: c.command, ...counts, isError: c.isError }];
  });
}

/**
 * Whether a repair lap (rondo#551) showed the failure it was sent to fix and
 * then a passing run, read off its commands as {@link workerRuns} reads them:
 *
 * - `reproduced`: a test run that failed, and after it one that passed with at
 *   least one test that ran and did not end in error.
 * - `allSkipped`: the last test run passed nothing and failed nothing -- every
 *   test skipped, which proves nothing either way.
 * - `unrecorded`: no test run rondo can read.
 * - `notReproduced`: anything else, a pass never preceded by the failure
 *   included.
 */
export type RepairRuns = "reproduced" | "notReproduced" | "allSkipped" | "unrecorded";

export function repairRuns(lapCommands: string | null): RepairRuns {
  const decoded = lapCommands === null ? null : decodeLapCommands(lapCommands);
  const runs = decoded?.kind === "read" ? testRuns(decoded.commands) : [];
  const last = runs.at(-1);
  if (last === undefined) {
    return "unrecorded";
  }
  if (last.passed === 0 && last.failed === 0) {
    return "allSkipped";
  }
  const failedAt = runs.findIndex((run) => run.failed > 0);
  return failedAt !== -1 &&
    runs.slice(failedAt + 1).some((run) => run.failed === 0 && run.passed > 0 && !run.isError)
    ? "reproduced"
    : "notReproduced";
}

/**
 * A command that runs the repository's whole test suite and nothing else, so
 * its exit status is the suite's own (rondo#497). The case it is for: a worker
 * breaks the code on purpose to see a test fail, puts it back, and runs
 * `npm run verify > log 2>&1`, whose output holds no summary. A clean exit of
 * that command is the lap's last verification, and the failure before it no
 * longer speaks for the lap.
 *
 * **A closed list of invocations, with no arguments**: an argument can narrow
 * the suite to one file or ask for `--help`, and a prefix (`echo`, `!`) or a
 * pipe, `;` or `||` can end the command at 0 whatever the suite did. So the
 * command is, after an optional `cd <dir> &&` and with its output redirected
 * or not, exactly one of these.
 *
 * ponytail: the invocations by name, as {@link SUMMARY_LINE} is; another
 * runner's clean exit supersedes nothing, and the upgrade is a line here.
 */
function wholeSuiteCommand(command: string): boolean {
  const bare = command
    .trim()
    .replace(/^cd\s+[^\s;&|`$()]+\s*&&\s*/, "")
    // A target may name a variable (`$TMPDIR/v.log`) and never substitute a command.
    .replace(/\s+(?:\d?>>?|&>)\s*(?:\$\{?\w+\}?|[^\s;&|`$()])+/g, "")
    .replace(/\s+\d>&\d/g, "")
    .trim();
  return WHOLE_SUITE.test(bare);
}

const WHOLE_SUITE =
  /^(?:(?:npm|pnpm|yarn|bun) (?:run )?(?:test|verify)|(?:npx )?vitest(?: run)?|(?:npx )?jest|pytest(?: -q)?|python3? -m pytest(?: -q)?|cargo test|go test \.\/\.\.\.|make (?:test|check|verify))$/;

// vitest `Tests  1 failed | 1842 passed (1843)`, jest `Tests: 1 failed, 40
// passed, 41 total`, pytest `==== 1 failed, 40 passed in 1.20s ====` and its
// `-q` form without the rules. `Test Files` is vitest's other line and
// deliberately not matched; pytest's form must open on a count, so a line that
// merely ends in a duration is not taken for one.
// ponytail: three runners by their summary line; another runner reads as
// `none`, and the upgrade is a runner's line added here.
const SUMMARY_LINE =
  /^\s*(?:Tests:?\s+\d.*(?:\(\d+\)|\d+ total)|(?:=+ )?\d+ (?:passed|failed|errors?|skipped|xfailed|xpassed|deselected|warnings?)\b.* in [\d.]+s\b.*)\s*$/;
// biome-ignore lint/suspicious/noControlCharactersInRegex: ESC opens the colour codes stripped here
const ANSI = /\u001b\[[0-9;]*m/g;

/** The last test summary in one command's output, or null. */
export function testSummary(
  output: string,
): { readonly passed: number; readonly failed: number; readonly skipped: number } | null {
  const line = output
    .replace(ANSI, "")
    .split("\n")
    .findLast((l) => SUMMARY_LINE.test(l));
  if (line === undefined) {
    return null;
  }
  const count = (words: string) =>
    [...line.matchAll(new RegExp(`(\\d+) (?:${words})\\b`, "g"))].reduce(
      (sum, m) => sum + Number(m[1]),
      0,
    );
  return {
    passed: count("passed"),
    failed: count("failed|errors?"),
    skipped: count("skipped|todo"),
  };
}
