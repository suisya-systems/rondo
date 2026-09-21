/** @jsxImportSource react */
/**
 * What became of the work, under the request's title (rondo#376).
 *
 * **The result as a state, in the person's language.** rondo's reports of a
 * publish and of its checks stay in the thread in English (`D-0055` rule 4);
 * lap 11's owner had them on screen and still went to the forge to find out
 * whether a pull request existed, where it was, and whether it was green. So
 * the page draws those three answers here, where the title is, and not as one
 * more line down the thread.
 *
 * **Three acts, in order, each said apart**: the approval, the pull request,
 * and the merge. The merge is said as done where a person's press on this page
 * made it (rondo#380), with the branch it went into and how; otherwise as whose
 * it is and never as not done, since a merge on the forge itself is not one
 * rondo watches.
 */
import type { LapResult } from "../page-logic/result.js";
import type { Chrome } from "../wording.js";

export function ResultLine({
  wording,
  result,
}: {
  readonly wording: Chrome;
  /** The approved lap's publish, or null where it has not been published. */
  readonly result: LapResult | null;
}) {
  const detail = result === null ? null : wording.checksDetail(result.checks);
  return (
    <ol className="result">
      <li className="result-done">{wording.resultApproved}</li>
      {result === null ? (
        <li className="result-ahead">{wording.resultNotPublished}</li>
      ) : (
        <>
          <li className="result-done">
            {wording.resultPublished}{" "}
            {result.url === null ? (
              <b>{wording.pullRequest(result.number)}</b>
            ) : (
              <a href={result.url}>{wording.pullRequest(result.number)}</a>
            )}
          </li>
          {/* Colour and a word together, so neither is the only carrier. */}
          <li className={`result-checks result-checks-${result.checks.kind}`}>
            {wording.resultChecks} <b>{wording.checksWord(result.checks)}</b>
            {detail === null ? null : <span> {detail}</span>}
          </li>
        </>
      )}
      {result?.merged == null ? (
        <li className="result-ahead">{wording.resultNotMerged}</li>
      ) : (
        <li className="result-done result-merged">
          {wording.resultMerged(result.merged.into, result.merged.method)}
        </li>
      )}
    </ol>
  );
}
