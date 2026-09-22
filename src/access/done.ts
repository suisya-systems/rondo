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

/** The line that opens the section. Exported so a lap's prompt can be told from its plan's. */
export const DONE_OPENING = "\n\n---\nDefinition of done";

/**
 * The section, for a plan naming `ruleFiles` (its `review_criterion.rule_files`,
 * or none). The same asks on every lap; the last line points at the
 * repository's own rules, named when the plan names them.
 */
export function definitionOfDone(ruleFiles: readonly string[]): string {
  return [
    `${DONE_OPENING} (rondo adds this to every lap, whatever the request says):`,
    "- Commit your work on this lap's branch. Work left uncommitted is not delivered.",
    "- Before you report, run the repository's own install and verification, as the repository defines them.",
    "- If the verification cannot run, or does not pass, say so in your report. Never say it passed when it did not run.",
    // **D-0098 rule 4.1: a question at the lap's end, never a guess.** The
    // block's shape is what `./question.ts` reads out of the gate's rationale.
    "- If you need a decision you cannot make yourself: first build, verify and commit everything that does not depend on the answer. Then end your lap with the question. Do not guess.",
    `- To ask, end your report with one fenced block opened by \`\`\`${QUESTION_FENCE} holding one JSON object: {"question": "...", "options": [{"text": "...", "gives_up": "..."}], "recommended": <index of the option you recommend, from 0>, "recommendation": "why", "waits": "which part of the work waits on the answer"}.`,
    ruleFiles.length === 0
      ? "The repository says how it installs and verifies in its own files (such as AGENTS.md, CONTRIBUTING.md or README.md): read them first."
      : `The repository's own rules are in ${ruleFiles.join(", ")} in your workspace: read ${ruleFiles.length === 1 ? "it" : "them"} first and follow ${ruleFiles.length === 1 ? "its" : "their"} order of work.`,
  ].join("\n");
}

/**
 * What rondo puts after a **closing lap's** prompt (D-0098 rule 5.2): the lap
 * pressed after the review exit to fix the findings left below the threshold,
 * which no reviewer reads again (rule 5.3).
 *
 * **Rondo's own words, and none of the person's.** The findings are quoted by
 * the person's instruction above it (the revise box, D-0009); this only asks
 * for a test per fix and says what happens when a fix does not hold (rule
 * 5.4). ASCII (D-0004).
 */
export function closingLapSection(): string {
  return [
    "\n\n---\nClosing fix (rondo adds this because this lap was pressed as the closing lap):",
    "- Fix the findings the instruction above quotes. Nothing else is asked of this lap.",
    "- Write a test for each fix, one that fails without the fix and passes with it, and commit it with the fix.",
    "- No reviewer reads this lap again. If a fix fails its own test, or you find a problem more serious than these findings, say so plainly in your report: the line then stops for a person.",
  ].join("\n");
}
