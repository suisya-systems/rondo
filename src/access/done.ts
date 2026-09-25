/**
 * A lap's definition of done (D-0089, rondo#377): the section rondo puts after every
 * lap's request, whatever the request says, so a one-line request still asks
 * for committed work and the repository's own verification.
 *
 * **The drafter writes what to change; this says when it is done.** Lap 11's
 * first try ended on an empty branch because the drafted prompt did not say
 * "commit" and nothing else in the lap did (`docs/operations/lap-11-dogfood.md`
 * N-47). So the words are not left to the drafter or the person to remember:
 * they are a known constant, plus the rule files the plan names, which are the
 * repository's own words and are also what the model reviewer is handed.
 *
 * **ASCII** (D-0004), like every other string rondo puts on continuo's command
 * line.
 */

import { readRunPlan } from "../refrain/plan.js";
import type { JsonRecord } from "../store/records.js";
import { QUESTION_FENCE } from "./question.js";

/**
 * The rule files a plan document names (`review_criterion.rule_files`), or
 * none: what {@link definitionOfDone} points a lap run on that plan at.
 */
export function planRuleFiles(document: JsonRecord): readonly string[] {
  const planned = readRunPlan(document);
  return planned.kind === "planned" ? (planned.plan.reviewCriterion?.ruleFiles ?? []) : [];
}

/**
 * The worker's turn budget a plan document declares (`turn_timeout_ms`), or
 * null for a document that does not read as a plan: what
 * {@link definitionOfDone} tells a lap run on that plan it has.
 */
export function planTurnTimeoutMs(document: JsonRecord): number | null {
  const planned = readRunPlan(document);
  return planned.kind === "planned" ? planned.plan.turnTimeoutMs : null;
}

/** The line that opens the section. Exported so a lap's prompt can be told from its plan's. */
export const DONE_OPENING = "\n\n---\nDefinition of done";

/**
 * The section, for a plan naming `ruleFiles` (its `review_criterion.rule_files`,
 * or none) and giving the worker `turnTimeoutMs` (its `turn_timeout_ms`). The
 * same asks on every lap; the last line points at the repository's own rules,
 * named when the plan names them.
 *
 * **The time the lap has is said, with what a stop keeps** (D-0110 rule 1,
 * rondo#432). Lap 13's try was cut at its turn budget mid-change, with 15 files
 * edited and nothing committed, and a next try is cut from the last try's
 * commits (`src/refrain/revision.ts`). So the worker is told the budget in
 * minutes and to commit each working step as it goes. Null says nothing, for
 * a caller with no plan to read it from.
 */
export function definitionOfDone(
  ruleFiles: readonly string[],
  turnTimeoutMs: number | null,
): string {
  return [
    `${DONE_OPENING} (rondo adds this to every lap, whatever the request says):`,
    "- Commit your work on this lap's branch. Work left uncommitted is not delivered.",
    ...(turnTimeoutMs === null
      ? []
      : [
          `- This lap has ${String(Math.round(turnTimeoutMs / 60_000))} minutes; a lap still working then is stopped. Commit each working step as you go: a stop keeps only what is committed.`,
        ]),
    "- Before you report, run the repository's own install and verification, as the repository defines them.",
    "- If the verification cannot run, or does not pass, say so in your report. Never say it passed when it did not run.",
    // **D-0098 rule 4.1: a question at the lap's end, never a guess.** The
    // block's shape is what `./question.ts` reads out of the gate's rationale.
    "- If you need a decision you cannot make yourself: first build, verify and commit everything that does not depend on the answer. Then end your lap with the question. Do not guess.",
    `- To ask, end your report with one fenced block opened by \`\`\`${QUESTION_FENCE} holding one JSON object: {"question": "...", "options": [{"text": "...", "gives_up": "..."}], "recommended": <index of the option you recommend, from 0>, "recommendation": "why", "waits": "which part of the work waits on the answer"}.`,
    // rondo#448: lap 17's first question came back in English although its
    // report was asked for in Japanese -- a JSON block reads as data. It is
    // relayed to the person word for word, so it says whose words they are.
    "- Every string in that block is relayed to the person word for word: write it in the same language as the rest of your report, never in English because the block is JSON.",
    ruleFiles.length === 0
      ? "The repository says how it installs and verifies in its own files (such as AGENTS.md, CONTRIBUTING.md or README.md): read them first."
      : `The repository's own rules are in ${ruleFiles.join(", ")} in your workspace: read ${ruleFiles.length === 1 ? "it" : "them"} first and follow ${ruleFiles.length === 1 ? "its" : "their"} order of work.`,
  ].join("\n");
}

/** One finding a closing lap is asked to fix: its number in the reading, the reviewer's words, its bases. */
export interface ClosingFinding {
  readonly number: number;
  readonly text: string;
  readonly bases: readonly string[];
}

/**
 * What rondo puts after a **closing lap's** prompt (D-0098 rule 5.2): the lap
 * pressed after the review exit to fix the findings left below the threshold,
 * which no reviewer reads again (rule 5.3).
 *
 * **It quotes the findings, with their bases**, from the same reading the
 * closing lap's record names, so the findings the lap is recorded as
 * answering are the findings it was given -- whatever the person's own words
 * above say (D-0009 keeps those untouched). It asks for a test per fix. Rule
 * 5.4's stop is observed on rondo's own reading of the branch only, so the
 * worker is told its report goes to the person, not that the report stops
 * the line. rondo's words are ASCII (D-0004); the findings are the reviewer's.
 */
export function closingLapSection(findings: readonly ClosingFinding[]): string {
  return [
    "\n\n---\nClosing fix (rondo adds this because this lap was pressed as the closing lap):",
    "- Fix these findings, which the last review left below the threshold. Nothing else is asked of this lap.",
    ...findings.map(
      (finding) =>
        `  ${String(finding.number)}. ${finding.text} (bases: ${finding.bases.length === 0 ? "none" : finding.bases.join(", ")})`,
    ),
    "- Write a test for each fix, one that fails without the fix and passes with it, and commit it with the fix.",
    "- No reviewer reads this lap again. If a fix fails its own test, or you find a problem more serious than these findings, say so plainly in your report: a person reads it at the gate.",
  ].join("\n");
}
