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
 * and the merge. The merge is said as done where it was made -- by a press on
 * this page (rondo#380), with the branch it went into and how, or on the forge
 * (rondo#413), with who merged it -- and as closed where the forge closed it
 * unmerged; otherwise as whose it is.
 *
 * **What the forge did after rondo read it is said here too** (rondo#411,
 * rondo#412): a conflict that is why no check runs, with what to do about it,
 * and a head somebody else moved, with the commits it carries -- the checks
 * are then the new head's.
 */
import type { LapResult } from "../page-logic/result.js";
import type { Chrome } from "../wording.js";

/** A commit as a person names one. */
function short(sha: string): string {
  return sha.slice(0, 7);
}

export function ResultLine({
  wording,
  result,
  conflictFix = null,
}: {
  readonly wording: Chrome;
  /** The approved lap's publish, or null where it has not been published. */
  readonly result: LapResult | null;
  /**
   * Where rondo's fix of a conflict stands (rondo#417, D-0105): offered by the
   * card above, or an attempt at it running; null for neither.
   */
  readonly conflictFix?: "offered" | "running" | null;
}) {
  const detail = result === null ? null : wording.checksDetail(result.checks);
  const moved = result?.moved ?? null;
  const merged = result?.merged ?? null;
  return (
    <ol className="result">
      <li className="result-done">{wording.resultApproved}</li>
      {result === null ? (
        <li className="result-ahead">{wording.resultNotPublished}</li>
      ) : (
        <>
          <li className="result-done">
            {result.pushedOnto ? wording.resultPushedOnto : wording.resultPublished}{" "}
            {result.url === null ? (
              <b>{wording.pullRequest(result.number)}</b>
            ) : (
              <a href={result.url}>{wording.pullRequest(result.number)}</a>
            )}
          </li>
          {moved === null ? null : (
            <li className="result-moved">
              {moved.commits.length + moved.more === 0
                ? wording.resultMovedNone(short(moved.from), short(moved.to))
                : wording.resultMoved(
                    short(moved.from),
                    short(moved.to),
                    moved.commits.length + moved.more,
                  )}
              {moved.commits.length === 0 ? null : (
                <ul className="result-commits">
                  {moved.commits.map((commit) => (
                    <li key={commit.sha}>
                      <code>{short(commit.sha)}</code> {commit.subject}
                    </li>
                  ))}
                  {moved.more === 0 ? null : <li>{wording.resultMovedMore(moved.more)}</li>}
                </ul>
              )}
            </li>
          )}
          {/* Colour and a word together, so neither is the only carrier. */}
          <li className={`result-checks result-checks-${result.checks.kind}`}>
            {wording.resultChecks} <b>{wording.checksWord(result.checks)}</b>
            {detail === null ? null : <span> {detail}</span>}
          </li>
          {result.conflictsWith === null ? null : (
            <>
              <li className="result-note">
                {wording.resultConflict(wording.pullRequest(result.number), result.conflictsWith)}
              </li>
              <li className="result-note result-act">
                {conflictFix === "running"
                  ? wording.resultConflictFixing(result.conflictsWith)
                  : conflictFix === "offered"
                    ? wording.resultConflictDoOffered(result.conflictsWith)
                    : wording.resultConflictDo(result.conflictsWith)}
              </li>
            </>
          )}
        </>
      )}
      {merged !== null ? (
        <>
          <li className="result-done result-merged">
            {merged.outside
              ? wording.resultMergedOutside(merged.into, merged.by)
              : wording.resultMerged(merged.into, merged.method ?? "")}
          </li>
          {result?.closedOut == null ? null : (
            <li className="result-done">
              {wording.resultClosedOut(result.closedOut.deleted, result.closedOut.refused)}
            </li>
          )}
        </>
      ) : result?.closedAtMs == null ? (
        <li className="result-ahead">{wording.resultNotMerged}</li>
      ) : (
        <li className="result-ended">{wording.resultClosed}</li>
      )}
    </ol>
  );
}
