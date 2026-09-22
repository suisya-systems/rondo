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
 * What this slice draws is the ask and the box. *Since you last looked* and
 * the most recent reports are the same slice's next change; the right face of
 * this state is the third slice's (gate point 7).
 */
import type { ReactNode } from "react";
import type { Chrome } from "../wording.js";

export interface EmptyCentreProps {
  readonly wording: Chrome;
  /** The box a new request is written in, or null with no write port (D-0020 rule 2). */
  readonly composer: ReactNode;
  /** What rondo would ask for next (`./triage.tsx`), or null. */
  readonly triage?: ReactNode;
}

export function EmptyCentre({ wording, composer, triage = null }: EmptyCentreProps) {
  return (
    <div className="empty-centre">
      <h1>{wording.emptyAsk}</h1>
      <p className="empty-lead">{wording.emptyLead}</p>
      {composer}
      {triage}
    </div>
  );
}
