/**
 * A lap's definition of done (rondo#377): the section rondo puts after every
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

/** The line that opens the section. Exported so a lap's prompt can be told from its plan's. */
export const DONE_OPENING = "\n\n---\nDefinition of done";

/**
 * The section, for a plan naming `ruleFiles` (its `review_criterion.rule_files`,
 * or none). The same three asks on every lap; the last line points at the
 * repository's own rules, named when the plan names them.
 */
export function definitionOfDone(ruleFiles: readonly string[]): string {
  return [
    `${DONE_OPENING} (rondo adds this to every lap, whatever the request says):`,
    "- Commit your work on this lap's branch. Work left uncommitted is not delivered.",
    "- Before you report, run the repository's own install and verification, as the repository defines them.",
    "- If the verification cannot run, or does not pass, say so in your report. Never say it passed when it did not run.",
    ruleFiles.length === 0
      ? "The repository says how it installs and verifies in its own files (such as AGENTS.md, CONTRIBUTING.md or README.md): read them first."
      : `The repository's own rules are in ${ruleFiles.join(", ")} in your workspace: read ${ruleFiles.length === 1 ? "it" : "them"} first and follow ${ruleFiles.length === 1 ? "its" : "their"} order of work.`,
  ].join("\n");
}
