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
function stateFor(wording: Chrome, state: RowState): string {
  switch (state) {
    case "waitingOnYou":
      return wording.rowWaitingOnYou;
    case "running":
      return wording.rowRunning;
    case "finished":
      return wording.rowFinished;
    case "stopped":
      return wording.rowStopped;
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
}

function Row({
  wording,
  row,
  hrefOf,
  agoOf,
}: {
  readonly wording: Chrome;
  readonly row: RequestRow;
  readonly hrefOf: (messageId: string) => string;
  readonly agoOf: (atMs: number) => string;
}) {
  const waiting = row.state === "waitingOnYou";
  return (
    <a className={`list-row${waiting ? " list-row-mine" : ""}`} href={hrefOf(row.messageId)}>
      {/*
       * One dot, amber only where a person must act. A row that needs nobody
       * carries a neutral one, so the column stays aligned and the colour is
       * the whole of what it says (D-0082 rule 2).
       */}
      <i className={`list-dot${waiting ? " list-dot-wait" : ""}`} aria-hidden="true" />
      <div className="list-row-body">
        {/* The person's own words. `lang=""` because rondo does not know what
            language they wrote in (D-0055 rule 8). */}
        <b lang="">{row.title}</b>
        <p>
          {row.repository === null ? null : <span className="list-repo">{row.repository}</span>}
          {stateFor(wording, row.state)}
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
            <Row key={row.messageId} wording={wording} row={row} hrefOf={hrefOf} agoOf={agoOf} />
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
              <Row wording={wording} row={row} hrefOf={hrefOf} agoOf={agoOf} />
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
