/** @jsxImportSource react */
/**
 * The left face: every request, cut by day (DECISIONS.md D-0083 rules 2, 5
 * and 7).
 *
 * **Weight follows who is blocked** (`D-0082` rule 1, which `D-0083` keeps).
 * A request waiting on the person is bold, carries one amber dot, and is not
 * cut short; everything else recedes, and a finished row may be one line. The
 * amber is the only amber in the list, because amber means *a person must
 * act* and nothing else on this face does.
 *
 * **What a row says**: the person's own words as its title, the repository the
 * work is in (`D-0081`), one sentence of state, and when it last moved. No
 * identifier of rondo's (`D-0076`) -- no lap id, no status enum.
 *
 * **One line, not a mark per row** (rule 7): "below here is what you saw last
 * time" is drawn once, between the rows that arrived since and the rows that
 * did not.
 */

import type { DayCut } from "../page-logic/days.js";
import type { RequestList, RequestRow, RowState } from "../page-logic/list.js";
import type { Chrome } from "../wording.js";

/** Each day cut's heading, from the set in force. */
function headingFor(wording: Chrome, cut: DayCut): string {
  switch (cut) {
    case "today":
      return wording.dayToday;
    case "yesterday":
      return wording.dayYesterday;
    case "lastWeek":
      return wording.dayLastWeek;
    case "month":
      return wording.dayMonth;
    default:
      return wording.dayOlder;
  }
}

/** A row's one sentence of state, from the set in force. */
function stateFor(wording: Chrome, row: RequestRow): string {
  // One row for a request run as several lines, its sentence counting them
  // (D-0098 rule 8.1); the amber is still the row's *your turn* alone.
  if (row.parts != null) {
    return wording.partsSaid(row.parts, false);
  }
  const state: RowState = row.state;
  switch (state) {
    case "waitingOnYou":
      return wording.rowWaitingOnYou;
    case "running":
      return wording.rowRunning;
    case "approved": {
      // **What became of it after the approval** (rondo#376): published or
      // not, and the checks' one word, so the list answers without the forge.
      const published = row.published ?? null;
      if (published === null) {
        return wording.rowApproved;
      }
      const pullRequest = wording.pullRequest(published.number);
      // What the forge did after rondo read it comes first (rondo#411, #413).
      return published.merged !== null
        ? wording.rowMerged(pullRequest)
        : published.closedAtMs !== null
          ? wording.rowClosed(pullRequest)
          : published.conflictsWith !== null
            ? wording.rowConflict(pullRequest)
            : wording.rowPublished(pullRequest, wording.checksWord(published.checks));
    }
    case "finished":
      return wording.rowFinished;
    case "stopped":
      return wording.rowStopped;
    case "drafting":
      return wording.rowDrafting;
    default:
      return wording.rowNotStarted;
  }
}

export interface ListProps {
  readonly wording: Chrome;
  readonly list: RequestList;
  /** Where a request's thread is, composed by the caller so no address is spelled twice. */
  readonly hrefOf: (messageId: string) => string;
  /** When each request last moved, said as a person reads it. */
  readonly agoOf: (atMs: number) => string;
  /** The week's allowance, or null where none has been approved (rule 6). */
  readonly allowance: {
    readonly spent: string;
    readonly approved: string;
    readonly left: string;
  } | null;
  /** The way into a new request, or null with no write port (D-0020 rule 2). */
  readonly newRequestHref: string | null;
  /**
   * The last-looked line's sentence, already said (rule 7).
   *
   * Composed by the caller because it names *when* the person last looked, and
   * only the caller has read that mark. Where they have never looked, the set
   * has its own sentence for that; either way this face draws what it is
   * given rather than deciding which sentence applies.
   */
  readonly lastLookedSaid: string;
  /** The request the centre has open, or null where it has none (rondo#587). */
  readonly openId: string | null;
}

/** Which shape a row's mark is drawn in: one per thing a row can be. */
type Mark = "wait" | "run" | "ok" | "fail" | "done" | "stopped" | "idle";

/**
 * A row's mark, from its state and, once published, its checks.
 *
 * **The shape says the state and the colour only adds to it** (rondo#589,
 * WCAG 1.4.1). Running, done, stopped and not started were one grey dot, so
 * they could not be told apart, and running had lost the turning mark
 * `D-0082` rule 3 keeps for it.
 */
function markOf(row: RequestRow): Mark {
  const checks = row.published?.checks.kind;
  if (row.state === "waitingOnYou") {
    return "wait";
  }
  if (checks === "green") {
    return "ok";
  }
  if (checks === "red") {
    return "fail";
  }
  switch (row.state) {
    case "running":
      return "run";
    case "approved":
    case "finished":
      return "done";
    case "stopped":
      return "stopped";
    default:
      return "idle";
  }
}

/**
 * The shapes are the page's own status glyphs (`glyph` in `vocabulary.tsx`),
 * drawn here in React: a ring round a dot for *your turn*, a turning arc for
 * running, a tick and a cross for the checks, a slashed ring for stopped. A
 * finished row is a plain disc and one not started yet a dashed ring -- the
 * shape with nothing in it.
 */
function MarkShape({ mark }: { readonly mark: Mark }) {
  switch (mark) {
    case "wait":
      return (
        <>
          <circle cx="8" cy="8" r="6.2" />
          <circle cx="8" cy="8" r="2.4" fill="currentColor" stroke="none" />
        </>
      );
    case "run":
      return (
        <>
          <circle cx="8" cy="8" r="6.2" opacity="0.3" />
          <path d="M8 1.8a6.2 6.2 0 0 1 6.2 6.2" />
        </>
      );
    case "ok":
      return (
        <>
          <circle cx="8" cy="8" r="6.2" />
          <path d="m5.4 8.2 1.8 1.8 3.4-3.6" />
        </>
      );
    case "fail":
      return (
        <>
          <circle cx="8" cy="8" r="6.2" />
          <path d="m5.8 5.8 4.4 4.4m0-4.4-4.4 4.4" />
        </>
      );
    case "done":
      return <circle cx="8" cy="8" r="5" fill="currentColor" stroke="none" />;
    case "stopped":
      return (
        <>
          <circle cx="8" cy="8" r="6.2" />
          <path d="m3.8 12.2 8.4-8.4" />
        </>
      );
    default:
      return <circle cx="8" cy="8" r="6.2" strokeDasharray="2.6 2.3" />;
  }
}

function Row({
  wording,
  row,
  hrefOf,
  agoOf,
  open,
}: {
  readonly wording: Chrome;
  readonly row: RequestRow;
  readonly hrefOf: (messageId: string) => string;
  readonly agoOf: (atMs: number) => string;
  readonly open: boolean;
}) {
  const waiting = row.state === "waitingOnYou";
  const mark = markOf(row);
  return (
    // **The open request is marked, and every row is a `j`/`k` stop**
    // (rondo#587): the header's hint moves through this list as it does
    // through the centre's rows, and the row the centre is showing says so.
    <a
      className={`list-row${waiting ? " list-row-mine" : ""}`}
      href={hrefOf(row.messageId)}
      data-row=""
      aria-current={open ? "page" : undefined}
    >
      {/*
       * One mark, amber only where a person must act (D-0082 rule 2), green
       * or red where the checks have said so. Hidden from a reader because
       * the sentence beside it says the same.
       */}
      <svg
        className={`list-dot list-dot-${mark}`}
        data-mark={mark}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <MarkShape mark={mark} />
      </svg>
      <div className="list-row-body">
        {/* The person's own words. `lang=""` because rondo does not know what
            language they wrote in (D-0055 rule 8). */}
        <b lang="">{row.title}</b>
        <p>
          {row.repository === null ? null : <span className="list-repo">{row.repository}</span>}
          {stateFor(wording, row)}
        </p>
      </div>
      <time>{agoOf(row.atMs)}</time>
    </a>
  );
}

export function RequestsFace({
  wording,
  list,
  hrefOf,
  agoOf,
  allowance,
  newRequestHref,
  lastLookedSaid,
  openId,
}: ListProps) {
  const empty = list.yourTurn.length === 0 && list.days.length === 0;
  return (
    <div className="list">
      {newRequestHref === null ? null : (
        <a className="list-new" href={newRequestHref}>
          {wording.writeNewRequest}
        </a>
      )}
      {list.yourTurn.length === 0 ? null : (
        <>
          <h6 className="list-heading list-heading-mine">{wording.yourTurn}</h6>
          {list.yourTurn.map((row) => (
            <Row
              key={row.messageId}
              wording={wording}
              row={row}
              hrefOf={hrefOf}
              agoOf={agoOf}
              open={row.messageId === openId}
            />
          ))}
        </>
      )}
      {empty ? <p className="list-empty">{wording.noRequestsYet}</p> : null}
      {list.days.map((group) => (
        <div key={group.cut}>
          <h6 className="list-heading">{headingFor(wording, group.cut)}</h6>
          {group.rows.map((row) => (
            <div key={row.messageId}>
              {row.messageId === list.lastLookedAbove ? (
                <p className="list-since">{lastLookedSaid}</p>
              ) : null}
              <Row
                wording={wording}
                row={row}
                hrefOf={hrefOf}
                agoOf={agoOf}
                open={row.messageId === openId}
              />
            </div>
          ))}
        </div>
      ))}
      {/*
       * The week's allowance, under the list (rule 5). **A spent figure is
       * never shown without the figure it was approved against** (rule 6), so
       * where no allowance has been approved this says that and no number.
       */}
      <div className="list-allowance">
        <span>{wording.weekAllowance}</span>
        {allowance === null ? (
          <b>{wording.weekNoAllowance}</b>
        ) : (
          <b>{wording.weekSpent(allowance.spent, allowance.approved, allowance.left)}</b>
        )}
      </div>
    </div>
  );
}
