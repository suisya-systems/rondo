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
 * **What a row says, always, is three things** (rondo#746): the person's own
 * short name for the request -- their first line, cut to the row -- one word of
 * state (`rowWord`), and when it last moved. Never the request's text, and no
 * identifier of rondo's (`D-0076`) -- no lap id, no status enum. The sentences
 * a row used to carry are kept on its hover, and the account they summarised is
 * on the request's own thread. The repository is still said where two requests
 * would otherwise read the same (`D-0081` rule 4.2), which is not one of the
 * three because it is not always shown.
 *
 * **The done requests fold** (rondo#746). The three newest keep their place in
 * the time order and the rest are behind one press that names how many it
 * holds, so a list a person reads for what is still moving does not grow with
 * everything that has ever ended.
 *
 * **One line, not a mark per row** (rule 7): "below here is what you saw last
 * time" is drawn once, between the rows that arrived since and the rows that
 * did not -- inside the fold where that position is one of the rows the fold
 * took, which opens it, because a line nobody can see is no line.
 *
 * **The week's allowance is no longer a line under the list** (`D-0207`
 * rules 1 and 5). Rule 5 of `D-0083` put one here and it stood on every view:
 * a figure a person reads, decides nothing about, and reads again tomorrow,
 * which is what `D-0082` rule 1 keeps off a face. The week's reading is now
 * drawn only where a budget is holding work up or a decision about one is the
 * person's, and this face reads no budget at all -- the figures that answer
 * for a *stopped* lap are on the screen where it stopped, and the week's pair
 * is on the empty right face (`page/empty-side.tsx`). Nothing replaces the
 * line (`D-0207` rule 4).
 */

import type { DayCut } from "../page-logic/days.js";
import {
  type FlowAskRow,
  type RequestList,
  type RequestRow,
  type RowState,
  type RowWord,
  rowWord,
} from "../page-logic/list.js";
import { flowAskAnchor, viewHref } from "../page-logic/routes.js";
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
  // The flow's stop, not the request, is what waits (rondo#611, D-0188).
  if (row.flowStop === true) {
    return wording.rowFlowStopped;
  }
  // A press, not an answer, is what waits (rondo#643).
  if (row.press === true) {
    return wording.rowPressWaits;
  }
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
    case "question":
      return wording.rowQuestion;
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

/** Which shape a row's mark is drawn in: one per word a row can say. */
type Mark = "wait" | "run" | "done";

/**
 * A row's mark, which is its word drawn (rondo#746).
 *
 * **The shape says the state and the colour only adds to it** (rondo#589,
 * WCAG 1.4.1), and what it says is now exactly what the word beside it says.
 * There were seven shapes against three words, so the mark went on claiming
 * differences the row no longer makes -- the checks' tick and cross, a slashed
 * ring for a request given up on. Those belong to the account on the thread.
 */
function markOf(word: RowWord): Mark {
  switch (word) {
    case "yourTurn":
      return "wait";
    case "running":
      return "run";
    default:
      return "done";
  }
}

/**
 * The shapes are the page's own status glyphs (`glyph` in `vocabulary.tsx`),
 * drawn here in React: a ring round a dot for *your turn*, a turning arc for in
 * progress, and a plain disc for done.
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
    default:
      return <circle cx="8" cy="8" r="5" fill="currentColor" stroke="none" />;
  }
}

/** The word a row says, from the set in force (rondo#746). */
function wordFor(wording: Chrome, word: RowWord): string {
  switch (word) {
    case "yourTurn":
      // The heading's own word, said once in the catalogue.
      return wording.yourTurn;
    case "running":
      return wording.listRunning;
    default:
      return wording.listDone;
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
  const word = rowWord(row);
  const mark = markOf(word);
  const said = stateFor(wording, row);
  return (
    // **The open request is marked, and every row is a `j`/`k` stop**
    // (rondo#587): the header's hint moves through this list as it does
    // through the centre's rows, and the row the centre is showing says so.
    <a
      className={`list-row${waiting ? " list-row-mine" : ""}`}
      href={hrefOf(row.messageId)}
      data-row=""
      aria-current={open ? "page" : undefined}
      // **Every row is one line now (rondo#746), so every row keeps what it
      // cut on hover** (rondo#592, which gave the hover to the cut rows only).
      // The whole of the person's first line is here, the repository where the
      // row does not draw it, and the one sentence of state the row no longer
      // says: which kind of wait is in play (rondo#611, #643), what became of
      // the publication (rondo#376, #411) and the parts counted (D-0098 rule
      // 8.1). The authoritative account is on the request's own thread.
      title={[row.title, row.repository, said].filter((line) => line !== null).join("\n")}
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
        {/* The person's own words, their first line and cut to the row's own
            (rondo#746). `lang=""` because rondo does not know what language
            they wrote in (D-0055 rule 8). */}
        <b lang="">{row.title}</b>
        {/* Said only where two requests would otherwise read the same
            (D-0081 rule 4.2), so it is not one of the row's three things. */}
        {row.repository === null ? null : <span className="list-repo">{row.repository}</span>}
      </div>
      {/* The second of the three: one word, never a sentence. */}
      <p>{wordFor(wording, word)}</p>
      <time>{agoOf(row.atMs)}</time>
    </a>
  );
}

/**
 * One row of the time order, with the last-looked line above it where the line
 * falls there (rule 7).
 *
 * The line is one position in the whole order and the fold hides part of that
 * order (rondo#746), so the rows behind the press are drawn through this too:
 * the line is the same line wherever it falls, and the alternative is a reading
 * position that vanishes whenever the fold happens to hold it.
 */
function RowInOrder({
  wording,
  row,
  hrefOf,
  agoOf,
  openId,
  lastLookedAbove,
  lastLookedSaid,
}: {
  readonly wording: Chrome;
  readonly row: RequestRow;
  readonly hrefOf: (messageId: string) => string;
  readonly agoOf: (atMs: number) => string;
  readonly openId: string | null;
  readonly lastLookedAbove: string | null;
  readonly lastLookedSaid: string;
}) {
  return (
    <div>
      {row.messageId === lastLookedAbove ? <p className="list-since">{lastLookedSaid}</p> : null}
      <Row
        wording={wording}
        row={row}
        hrefOf={hrefOf}
        agoOf={agoOf}
        open={row.messageId === openId}
      />
    </div>
  );
}

/**
 * **A paused goal flow is the person's turn** (rondo#606, D-0173 K3): nothing
 * but the person resumes it, and the screen that does was reached only by its
 * address. So it stands with the requests that wait on them, at their weight
 * and in their amber, and leads to that screen -- a link, never the press
 * (approving is made over what the screen shows, D-0128).
 */
function PausedRow({
  wording,
  repository,
}: {
  readonly wording: Chrome;
  readonly repository: string;
}) {
  return (
    <a
      className="list-row list-row-mine"
      href={viewHref({ kind: "goalScope", repository }, wording.lang)}
      data-row=""
      data-paused=""
    >
      <svg
        className="list-dot list-dot-wait"
        data-mark="paused"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="6.2" />
        <path d="M6.4 5.6v4.8m3.2-4.8v4.8" />
      </svg>
      <div className="list-row-note">
        <b>{wording.triageGoalScopePaused}</b>
        <p>
          <span className="list-repo">{repository}</span>
          {wording.triageGoalScopeResume}
        </p>
      </div>
    </a>
  );
}

/**
 * **A goal flow waiting on the person's answers is their turn** (rondo#633,
 * D-0192): it starts nothing until they answer, and the questions are drawn
 * only in the triage block on the front. So it stands with the requests that
 * wait, at their weight and with their mark, says what it asks of the person
 * and what it would start, and leads straight to the questions' form -- a
 * link, never the press (the answer is made point by point there).
 */
function AskingRow({
  wording,
  row,
  agoOf,
}: {
  readonly wording: Chrome;
  readonly row: FlowAskRow;
  readonly agoOf: (atMs: number) => string;
}) {
  return (
    <a
      className="list-row list-row-mine"
      href={`${viewHref({ kind: "requests" }, wording.lang)}#${flowAskAnchor(row.repository)}`}
      data-row=""
      data-asking=""
    >
      <svg
        className="list-dot list-dot-wait"
        data-mark="wait"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <MarkShape mark="wait" />
      </svg>
      <div className="list-row-note">
        <b>{wording.rowFlowAsks(row.points)}</b>
        <p>
          <span className="list-repo">{row.repository}</span>
          {/* The request in the ranking's words, which rondo does not know the language of. */}
          <span lang="">{row.request}</span>
        </p>
      </div>
      <time>{agoOf(row.askedAtMs)}</time>
    </a>
  );
}

/**
 * **A lap rondo can no longer read is the person's turn** (rondo#655): it
 * keeps its room until somebody ends it, and nothing else on the page can name
 * it. A link to the screen that ends it, as {@link PausedRow} is.
 */
function UnreadableRow({ wording, id }: { readonly wording: Chrome; readonly id: string }) {
  return (
    <a
      className="list-row list-row-mine"
      href={viewHref({ kind: "end", iterationId: id }, wording.lang)}
      data-row=""
      data-unreadable=""
    >
      <svg
        className="list-dot list-dot-wait"
        data-mark="wait"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <MarkShape mark="wait" />
      </svg>
      <div className="list-row-note">
        <b>{wording.endUnnamed}</b>
        <p>{wording.unreadableHolds}</p>
      </div>
    </a>
  );
}

export function RequestsFace({
  wording,
  list,
  hrefOf,
  agoOf,
  newRequestHref,
  lastLookedSaid,
  openId,
}: ListProps) {
  const paused = list.paused ?? [];
  const asking = list.asking ?? [];
  const unreadable = list.unreadable ?? [];
  const empty = list.yourTurn.length === 0 && list.days.length === 0;
  return (
    <div className="list">
      {newRequestHref === null ? null : (
        <a className="list-new" href={newRequestHref}>
          {wording.writeNewRequest}
        </a>
      )}
      {list.yourTurn.length === 0 &&
      paused.length === 0 &&
      asking.length === 0 &&
      unreadable.length === 0 ? null : (
        <>
          <h6 className="list-heading list-heading-mine">{wording.yourTurn}</h6>
          {paused.map((repository) => (
            <PausedRow key={repository} wording={wording} repository={repository} />
          ))}
          {asking.map((row) => (
            <AskingRow key={row.repository} wording={wording} row={row} agoOf={agoOf} />
          ))}
          {unreadable.map((id) => (
            <UnreadableRow key={id} wording={wording} id={id} />
          ))}
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
            <RowInOrder
              key={row.messageId}
              wording={wording}
              row={row}
              hrefOf={hrefOf}
              agoOf={agoOf}
              openId={openId}
              lastLookedAbove={list.lastLookedAbove}
              lastLookedSaid={lastLookedSaid}
            />
          ))}
        </div>
      ))}
      {/*
       * **The done requests older than the newest three, behind one press**
       * (rondo#746). The rows are in the page, shut, and opening is the
       * browser's own act -- `<details>` and nothing else, as the thread's
       * folds are (`page/events.tsx`): no state of the page's and no address
       * of its own, so neither grows with a reading position. Nothing at all
       * is drawn where there are no more than three.
       */}
      {list.moreDone.length === 0 ? null : (
        <details
          className="list-fold"
          // Open where the request the centre is showing is one of these
          // (rondo#587): a person reading a request must be able to find it on
          // the list, and the mark that says which row it is cannot be seen
          // through a shut fold. The same holds of the last-looked line: where
          // the position it marks is in here -- which is where every request
          // the person had already seen is one the fold took -- a shut fold
          // would be the line not being drawn at all.
          open={list.moreDone.some(
            (row) => row.messageId === openId || row.messageId === list.lastLookedAbove,
          )}
        >
          <summary>{wording.listMoreDone(list.moreDone.length)}</summary>
          {list.moreDone.map((row) => (
            <RowInOrder
              key={row.messageId}
              wording={wording}
              row={row}
              hrefOf={hrefOf}
              agoOf={agoOf}
              openId={openId}
              lastLookedAbove={list.lastLookedAbove}
              lastLookedSaid={lastLookedSaid}
            />
          ))}
        </details>
      )}
    </div>
  );
}
