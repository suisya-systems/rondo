/** @jsxImportSource react */
/**
 * The right face with nothing waiting (DECISIONS.md D-0083 rule 4, gate point
 * 7's last slice).
 *
 * **What rule 4 puts here**: the last seven days -- asked, finished, answered
 * by the person, decided by rondo without asking, spent, left of the week's
 * allowance -- and each running request with its allowance and the five steps
 * to its end.
 *
 * **The week's two money figures are now conditional** (`D-0207` rule 1): they
 * are drawn where a budget is holding work up or a decision about one is the
 * person's, and in the ordinary case the face is four figures shorter rather
 * than carrying a reading that needs nobody. A running request's own allowance
 * is not the week's and is unchanged (rule 2).
 *
 * **No amber appears on it** (rule 4). Nothing on this face is waiting on the
 * person -- that is the whole claim of the state it belongs to -- so the one
 * colour that means *a person must act* (`D-0082` rule 2) would be a lie here.
 * The step a lap is on now is marked by weight and by a word, not by amber.
 *
 * **Not a queue, and it says so.** A face listing four running requests could
 * be read as four things to keep an eye on, which is the opposite of what
 * `D-0064` designs for, so the line under the work says that all of it carries
 * on without the person.
 *
 * **Every press this face could have is somewhere else** (`D-0082` rule 7):
 * what a press needs is inside the box that holds the press, and there is no
 * box here. The title of a running request is a link into its thread, which is
 * where anything is answered.
 */
import type { Allowance, WeekFigures, WorkStep } from "../page-logic/week.js";
import type { Chrome } from "../wording.js";
import { spendSaid } from "./governance.js";
import { SideSteps } from "./steps.js";

/** A figure in dollars, in the shape `govSpent` writes one (`D-0082`'s scale). */
function dollars(value: number): string {
  return `$${value.toFixed(2)}`;
}

/** One running request, as this face draws it: what it spends, and where it is. */
export interface SideWork {
  readonly messageId: string;
  readonly title: string;
  readonly repository: string | null;
  /** How long it has been going, already said: only the caller has read the clock. */
  readonly goingSaid: string;
  readonly allowance: Allowance | null;
  readonly tries: { readonly at: number; readonly of: number } | null;
  readonly steps: readonly WorkStep[];
}

export interface EmptySideProps {
  readonly wording: Chrome;
  readonly figures: WeekFigures;
  readonly running: readonly SideWork[];
  /** Where a request's thread is, composed by the caller so no address is spelled twice. */
  readonly hrefOf: (messageId: string) => string;
}

export function EmptySide({ wording, figures, running, hrefOf }: EmptySideProps) {
  return (
    <div className="side">
      <h2 className="side-heading">{wording.sevenDays}</h2>
      {/*
       * The week's six figures, each in a cell of its own: the label is what
       * it counts and the figure is the thing to read, which is the shape the
       * mock-up the gate chose puts them in.
       */}
      <dl className="side-week">
        <div>
          <dt>{wording.weekAsked}</dt>
          <dd>{wording.weekThings(figures.asked)}</dd>
        </div>
        <div>
          <dt>{wording.weekFinished}</dt>
          <dd>{wording.weekThings(figures.finished)}</dd>
        </div>
        <div>
          <dt>{wording.weekAnswered}</dt>
          <dd>{wording.weekTimes(figures.answered)}</dd>
        </div>
        <div>
          <dt>{wording.weekDecided}</dt>
          <dd>{wording.weekThings(figures.decidedWithoutAsking)}</dd>
        </div>
        {/*
         * **The budget only where it bears on what the person can do**
         * (`D-0207` rule 1), and then with the reason it is here and the next
         * thing to do beside it (rule 5). With room left and nothing for the
         * person to decide, `figures.budget` is null and not one cell of this
         * is drawn -- and nothing takes its place (rule 4): a sentence saying
         * the budget is healthy is the standing reading in other words.
         *
         * **Both figures or neither where it is drawn** (rule 6, kept by
         * `D-0207` rule 3). With no approval to read, one sentence stands for
         * the pair rather than a spend nobody agreed to.
         */}
        {figures.budget === null ? null : (
          <>
            <div className="side-week-wide">
              <dt>
                {figures.budget.bearing === "holdingUp"
                  ? wording.weekBudgetHeldUp
                  : wording.weekBudgetYours}
              </dt>
              <dd>
                {figures.budget.bearing === "holdingUp"
                  ? wording.weekBudgetHeldUpNext
                  : wording.weekBudgetYoursNext}
              </dd>
            </div>
            {figures.budget.allowance === null ? (
              <div className="side-week-wide">
                <dt>{wording.weekAllowance}</dt>
                <dd>{wording.weekNoAllowance}</dd>
              </div>
            ) : (
              <>
                <div>
                  <dt>{wording.weekSpentFigure}</dt>
                  <dd>{spendSaid(wording, figures.budget.allowance)}</dd>
                </div>
                <div>
                  <dt>{wording.weekLeft}</dt>
                  <dd>{dollars(figures.budget.allowance.leftUsd)}</dd>
                </div>
              </>
            )}
          </>
        )}
      </dl>
      <h2 className="side-heading">{wording.runningHeading}</h2>
      {running.length === 0 ? (
        <p className="side-note">{wording.runningNone}</p>
      ) : (
        running.map((work) => (
          <div className="side-work" key={work.messageId}>
            {/* The person's own words. `lang=""` because rondo does not know
                what language they wrote in (D-0055 rule 8). */}
            <a className="side-work-title" href={hrefOf(work.messageId)} lang="">
              {work.title}
            </a>
            <p className="side-work-gov">
              {work.repository === null ? null : (
                <span className="side-repo">{work.repository}</span>
              )}
              <span>{work.goingSaid}</span>
              <span>
                {work.allowance === null
                  ? wording.weekNoAllowance
                  : spendSaid(wording, work.allowance)}
              </span>
              {work.tries === null ? null : (
                <span>{wording.govTries(work.tries.at, work.tries.of)}</span>
              )}
            </p>
            {/* The five steps to its end (rule 4), drawn by the component
                rule 6's face draws them with. */}
            <SideSteps wording={wording} steps={work.steps} />
          </div>
        ))
      )}
      {running.length === 0 ? null : <p className="side-note">{wording.runningNote}</p>}
    </div>
  );
}
