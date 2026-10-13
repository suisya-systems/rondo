/**
 * The words of where a triage candidate came from and what a reading read
 * (DECISIONS.md D-0097 point 1 (b), rondo#658): one per source, so a source
 * added to triage adds its words here.
 *
 * **A slice of the catalogue, as `./words.ts` is**: `Chrome` extends it and each
 * set spreads its half in, so `satisfies Chrome` still fails on a missing word.
 */

export interface TriageSourceWords {
  readonly triageIssue: (repository: string, number: number) => string;
  readonly triageStopped: string;
  readonly triageUnlapped: string;
  readonly triageReadIssues: (count: number) => string;
  readonly triageReadStopped: (count: number) => string;
  readonly triageReadUnlapped: (count: number) => string;
}

export const TRIAGE_SOURCE_EN: TriageSourceWords = {
  triageIssue: (repository, number) => `${repository}#${String(number)}`,
  triageStopped: "the request whose work stopped",
  triageUnlapped: "the request whose work never started",
  triageReadIssues: (count) => (count === 1 ? "1 open issue" : `${String(count)} open issues`),
  triageReadStopped: (count) =>
    count === 1 ? "1 request whose work stopped" : `${String(count)} requests whose work stopped`,
  triageReadUnlapped: (count) =>
    count === 1
      ? "1 request whose work never started"
      : `${String(count)} requests whose work never started`,
};

export const TRIAGE_SOURCE_JA: TriageSourceWords = {
  triageIssue: (repository, number) => `${repository}#${String(number)}`,
  triageStopped: "作業が止まった依頼",
  triageUnlapped: "作業が始まらなかった依頼",
  triageReadIssues: (count) => `開いているイシュー ${String(count)} 件`,
  triageReadStopped: (count) => `作業が止まった依頼 ${String(count)} 件`,
  triageReadUnlapped: (count) => `作業が始まらなかった依頼 ${String(count)} 件`,
};
