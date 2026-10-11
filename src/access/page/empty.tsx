/** @jsxImportSource react */
/**
 * The centre with nothing waiting (DECISIONS.md D-0083 rule 4).
 *
 * **Empty is the ordinary state.** A person is called rarely by design
 * (`D-0064`), so the state the page is in most of the time is this one -- and
 * what it does is ask *what do you want to ask for?* rather than show an empty
 * thread or a list of things that need nobody.
 *
 * **No amber appears on it**, because nothing here is waiting on a person.
 *
 * **The lower third is empty, and it is meant to be.** After the request box
 * and what is under it, nothing is drawn, and nothing is to be found to draw
 * there. The gate permitted this rather than merely allowing it to happen:
 * a screen with nothing to ask of a person is quiet, which is the same claim
 * `D-0082` rule 2 makes of colour -- the ordinary state is told from the
 * exceptional one by how little is on it. A person taking that quiet for a
 * page that has not finished loading is the falsifier, and the reason the
 * heading is a question rather than a blank.
 *
 * **What rondo would ask for next sits under the box** (D-0097 point 4.7 (a),
 * annotating `D-0083` rule 4): nothing *waiting on the person* is drawn in the
 * lower third, and the advisory's proposal, in ink, may be. On a day nothing
 * goes against a goal it is one sentence and the third stays quiet.
 *
 * **Then *since you last looked*, as sentences** (rule 4, rondo#631): one per
 * request that moved, read off the inbox's own `changed` rows and the same
 * last-look mark the list's line is drawn at, so the two cannot disagree about
 * where the person stopped. In ink and never amber: what moved is news, and
 * none of it waits on the person -- *your turn* says that. The most recent
 * reports are still to come; the right face of this state is the third
 * slice's (gate point 7).
 */
import type { ReactNode } from "react";
import type { SinceLooked } from "../page-logic/since.js";
import type { Chrome } from "../wording.js";

/** How many moved requests are named before the rest are only counted. */
const SINCE_SHOWN = 5;

/** *Since you last looked*, ready to draw, or the fact that there is no mark yet. */
export type SinceView =
  | { readonly kind: "never" }
  | {
      readonly kind: "looked";
      /** When the person last looked, already said. */
      readonly when: string;
      readonly reading: SinceLooked;
      /** A request's own first line, its repository, its address, and how long ago it moved. */
      readonly titleOf: (messageId: string) => string;
      readonly placeOf: (messageId: string) => string | null;
      readonly hrefOf: (messageId: string) => string;
      readonly ageOf: (atMs: number) => string;
    };

export interface EmptyCentreProps {
  readonly wording: Chrome;
  /** The box a new request is written in, or null with no write port (D-0020 rule 2). */
  readonly composer: ReactNode;
  /** What rondo would ask for next (`./triage.tsx`), or null. */
  readonly triage?: ReactNode;
  /** What moved since the person last looked, or null where no actor is known. */
  readonly since?: SinceView | null;
}

export function EmptyCentre({ wording, composer, triage = null, since = null }: EmptyCentreProps) {
  return (
    <div className="empty-centre">
      <h1>{wording.emptyAsk}</h1>
      <p className="empty-lead">{wording.emptyLead}</p>
      {composer}
      {triage}
      {since === null ? null : <Since wording={wording} since={since} />}
    </div>
  );
}

function Since({ wording, since }: { readonly wording: Chrome; readonly since: SinceView }) {
  if (since.kind === "never") {
    return (
      <section className="since">
        <p className="since-quiet">{wording.sinceNever}</p>
      </section>
    );
  }
  const { reading } = since;
  if (reading.moved.length === 0 && reading.elsewhere === 0) {
    return (
      <section className="since">
        <p className="since-quiet">{wording.sinceNothing(since.when)}</p>
      </section>
    );
  }
  const shown = reading.moved.slice(0, SINCE_SHOWN);
  const more = reading.moved.length - shown.length;
  return (
    <section className="since" aria-labelledby="since-heading">
      <h2 id="since-heading">{wording.sinceHeading(since.when)}</h2>
      {shown.length === 0 ? null : (
        <ol className="since-list">
          {shown.map((moved) => {
            const place = since.placeOf(moved.messageId);
            // The thread's event grammar: a dot, and ink where the person's own
            // hand is in what moved (`.ev-person`); the rest is rondo's.
            const yours = moved.asked || moved.youWrote > 0;
            return (
              <li key={moved.messageId} className={yours ? "since-yours" : undefined}>
                <span className="since-dot" aria-hidden="true" />
                {/* The person's own words: `lang=""` (D-0055 rule 8). */}
                <a className="since-title" href={since.hrefOf(moved.messageId)} lang="">
                  {since.titleOf(moved.messageId)}
                </a>
                <span className="since-at">{since.ageOf(moved.atMs)}</span>
                <p className="since-said">
                  {place === null ? null : <span className="since-repo">{place}</span>}
                  {wording.sinceSaid(moved)}
                </p>
              </li>
            );
          })}
        </ol>
      )}
      {more === 0 && reading.elsewhere === 0 ? null : (
        <p className="since-rest">
          {more === 0 ? null : wording.sinceMore(more)}
          {more !== 0 && reading.elsewhere !== 0 ? " " : null}
          {reading.elsewhere === 0 ? null : wording.sinceElsewhere(reading.elsewhere)}
        </p>
      )}
    </section>
  );
}
