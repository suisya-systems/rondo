/** @jsxImportSource react */
/**
 * The steps to a request's end, as a row (DECISIONS.md D-0083 rules 4 and 6).
 *
 * **One component because it is one thing said twice.** Rule 4 puts these five
 * steps under each running request on the empty state's right face; rule 6 puts
 * *what remains before this ends* on the right face of a request being
 * answered. They are the same five steps read from the same lap, and two
 * copies of the row would be two answers to where the work stands.
 */
import type { StepName, WorkStep } from "../page-logic/week.js";
import type { Chrome } from "../wording.js";

function stepSaid(wording: Chrome, name: StepName): string {
  switch (name) {
    case "work":
      return wording.stepWork;
    case "checks":
      return wording.stepChecks;
    case "reading":
      return wording.stepReading;
    case "approval":
      return wording.stepApproval;
    case "publish":
      return wording.stepPublish;
    default:
      return wording.stepLanding;
  }
}

function stateSaid(wording: Chrome, step: WorkStep): string {
  switch (step.state) {
    case "done":
      return wording.stepDone;
    case "waiting":
      return wording.stepNow;
    case "yours":
      return wording.stepYours;
    default:
      return wording.stepAhead;
  }
}

/**
 * The five steps, across the card.
 *
 * An ordered list because it is an order: what is done, what it is on, what is
 * still ahead. **No amber** -- the step a lap is on now is told by weight and
 * by a word, which is rule 4's constraint and holds on rule 6's face too: the
 * one thing waiting on the person is the box in the thread, not a step in a
 * row of five.
 */
export function SideSteps({
  wording,
  steps,
}: {
  readonly wording: Chrome;
  readonly steps: readonly WorkStep[];
}) {
  return (
    <ol className="side-steps">
      {steps.map((step) => (
        <li className={`side-step side-step-${step.state}`} key={step.name}>
          <span>{stepSaid(wording, step.name)}</span>
          <b>{stateSaid(wording, step)}</b>
        </li>
      ))}
    </ol>
  );
}
