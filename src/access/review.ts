/**
 * The reading of a lap's work, and the one place its verdict is decided.
 *
 * **Facts in `./forge.ts`, judgement here.** That is the division that module
 * states for itself -- "what a pull request's title and body are made of is a
 * rule about pull requests, and it lives in `./cli.ts` as a pure function over
 * this value" -- and D-0029 rule 5 takes it for a second question. `git` is run
 * over there, by the one module in this layer that may start a process; this
 * file is a total function over what it answered, so the verdict is a unit case
 * with no repository on disk.
 *
 * **Why the reader is deterministic in the first cut.** D-0019 rule 7 refused a
 * model-judged evaluator for three reasons, and D-0029 records that only the
 * third has expired: a non-deterministic verdict on the path to the one human
 * contact, and a verdict that cannot be a unit case, are both still true of a
 * model. Neither is true of this. A model drafter arrives later as a different
 * `drafter` value on the *same* record kind (D-0022 rule 13), which is what
 * lets it arrive without a schema change -- and, under D-0029 rule 11, with a
 * second evidence clause this reader does not need, because here the reader
 * *is* the measurement.
 *
 * **What this cannot say, stated where somebody would otherwise assume it.**
 * The input is commit subjects and per-file line counts. Every question
 * expressible over that vocabulary is a question about *shape*: whether there
 * are commits, whether there are files, whether the branch is anywhere other
 * than where it started. An authorisation check deleted inside a function reads
 * here as `1 file, +0 -3`. That ceiling is D-0029 rule 9's, it is the reason
 * this file's verdict is material for a person rather than a check, and it is
 * why nothing downstream treats `clear` as permission.
 */

import { contentDigest } from "../store/plan.js";
import type { LapReadingDraft, ReadingEvidence } from "../store/records.js";

import type { LapWorkInspection } from "./forge.js";

/**
 * Who produced a reading, when this file did.
 *
 * A version is in the string on purpose. The row is append-only and outlives
 * the code that wrote it, so "which reader said this" has to be answerable
 * from the row alone; a bare `"deterministic"` would make every past verdict
 * appear to have been taken under today's rules.
 */
export const DETERMINISTIC_DRAFTER = "rondo/deterministic/1";

/**
 * The remote whose tracking ref a reading prefers when it resolves the base.
 *
 * **Exported so that both ends of D-0029 rule 10's comparison use the same
 * one.** The reading is taken hours before `publish`, by a composition root
 * with no command line to read a remote from, so it takes this; `publish` has a
 * `--remote` an operator may have typed. Re-measuring the reading's range with
 * the operator's remote would compare two different ranges and call the
 * difference staleness.
 */
export const READING_REMOTE = "origin";

/**
 * The digest of the material a reading was taken over.
 *
 * Over the resolved range and the whole of what `git` reported about it, not
 * over the ref names: names are where to look, and D-0029 rule 10 compares what
 * was there. It goes through `contentDigest` so that a reading's digest and a
 * plan's are the same function of the same canonical encoding -- one algorithm,
 * one spelling, and a mismatch that means what it says.
 */
export function materialDigestOf(inspection: Extract<LapWorkInspection, { kind: "read" }>): string {
  return contentDigest({
    base_ref: inspection.baseRef,
    base_commit: inspection.baseCommit,
    tip_commit: inspection.tipCommit,
    commits: inspection.commits.map((commit) => ({
      sha: commit.abbreviatedSha,
      subject: commit.subject,
    })),
    files: inspection.files.map((file) => ({
      path: file.path,
      added: file.added,
      deleted: file.deleted,
    })),
  });
}

/**
 * The evidence a `clear` may be written beside, or null when there is none.
 *
 * Exported because `publish` compares a stored reading against a fresh
 * inspection and must build the second half of that comparison the same way the
 * first half was built. Two spellings of "the same work" would be a staleness
 * check that passed for the wrong reason.
 */
export function evidenceOf(
  inspection: Extract<LapWorkInspection, { kind: "read" }>,
): ReadingEvidence {
  return {
    baseRef: inspection.baseRef,
    baseCommit: inspection.baseCommit,
    tipCommit: inspection.tipCommit,
    materialDigest: materialDigestOf(inspection),
    commitCount: inspection.commits.length,
    fileCount: inspection.files.length,
  };
}

/**
 * One reading of what a lap produced.
 *
 * **`unreadable` becomes `unavailable`, never `clear`.** This is the single
 * line D-0029 rule 10 turns on, and it is the fail-open the whole stage exists
 * to refuse: a workspace nobody could read and a workspace that was read and
 * found fine are different facts, and collapsing them would leave a record
 * saying a reading happened where none did. `publish` then refuses both alike,
 * which is what makes the difference cost a keystroke rather than nothing.
 *
 * **The criterion is this function.** D-0029 rule 13 splits where an exit
 * criterion lives: for this drafter it is code, changed through a pull request
 * and auditable as a diff, and it therefore cannot be absent or unreadable.
 * The "no criterion" branch that rule also describes belongs to a model
 * drafter, which is not built here -- so it is stated rather than stubbed, and
 * a reader looking for the missing branch should look at rule 13 and not at
 * this file.
 */
export function readingOf(inspection: LapWorkInspection): LapReadingDraft {
  if (inspection.kind === "unreadable") {
    return {
      drafter: DETERMINISTIC_DRAFTER,
      verdict: "unavailable",
      findings: Object.freeze([]),
      evidence: null,
      unavailableReason: inspection.reason,
    };
  }

  const findings: string[] = [];
  // Three questions, and each is about where the branch is rather than about
  // what is in it. The tip check is not implied by the commit count: the log is
  // `--no-merges`, so a branch whose only commit is a merge reports no commits
  // while standing somewhere other than its base, and a branch reset back onto
  // its base reports no commits while standing exactly on it. Those are
  // different things to say to a person.
  if (inspection.tipCommit === inspection.baseCommit) {
    findings.push(
      `the topic branch is at the same commit as ${inspection.baseRef}, so this lap left nothing`,
    );
  } else if (inspection.commits.length === 0) {
    findings.push(
      `the topic branch adds no non-merge commits to ${inspection.baseRef}, though it is not at it`,
    );
  }
  if (inspection.files.length === 0) {
    findings.push(`the topic branch changes no files against ${inspection.baseRef}`);
  }

  return {
    drafter: DETERMINISTIC_DRAFTER,
    verdict: findings.length === 0 ? "clear" : "concerns",
    findings: Object.freeze([...findings]),
    evidence: evidenceOf(inspection),
    unavailableReason: null,
  };
}
