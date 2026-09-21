/** @jsxImportSource react */
/**
 * The right face of a request (DECISIONS.md D-0083 rules 5 and 6, gate point
 * 7's second slice).
 *
 * **Two tiers, and which one is on top is a fact about the state.** Rule 5:
 * above, *the material for this confirmation* -- what changed, the checks, the
 * model's reading; below, *what was agreed for this request*. And: **with
 * nothing being asked, the agreement moves to the top and what is known so far
 * sits under it.** So the order is not a layout choice, it is the answer to
 * whether a person is being asked something, which is why it is one boolean
 * here and not two components.
 *
 * **The material arrives already drawn.** It is the renderer's server JSX and
 * crosses the seam as markup, exactly as the boxes in the thread do
 * (`page/shell.tsx`): this face decides where it sits and not what is in it.
 *
 * **No amber, and no press.** Amber means *a person must act* (`D-0082` rule
 * 2) and the one thing acting is the box in the thread; a press needs what it
 * is answered over inside the box that holds it (rule 7), and this face drops
 * below the thread at 1280. So every figure here is a fact to read, and the
 * one place anything is answered is the centre.
 *
 * **Rule 6's ban is kept twice over**: a spent figure is never drawn without
 * the figure it was approved against, which is why the pair, the tries and
 * *where it may touch* stand or fall together -- all three are the approval's,
 * and with no approval read the face says so in one sentence instead.
 */
import type { ReactNode } from "react";
import type { Governance } from "../page-logic/governance.js";
import type { WorkStep } from "../page-logic/week.js";
import type { Chrome } from "../wording.js";
import { spendSaid } from "./governance.js";
import { SideSteps } from "./steps.js";

export interface ThreadSideProps {
  readonly wording: Chrome;
  /** What was agreed for this request, in full (rule 6). */
  readonly governance: Governance;
  /** What remains before this ends, as the five steps of the lap being answered. */
  readonly steps: readonly WorkStep[];
  /**
   * The material for this confirmation (rule 5), already drawn; null where
   * there is none -- no lap has been read, or none is at a gate.
   */
  readonly material: ReactNode | null;
  /**
   * Whether a question is standing. It decides the order of the two tiers and
   * what the material is called: *the material for this confirmation* while
   * something is being asked, *what is known so far* when nothing is.
   */
  readonly asking: boolean;
}

/** A figure in dollars, in the shape `govSpent` writes one (`D-0082`'s scale). */
function dollars(value: number): string {
  return `$${value.toFixed(2)}`;
}

function Agreed({
  wording,
  governance,
  steps,
}: {
  readonly wording: Chrome;
  readonly governance: Governance;
  readonly steps: readonly WorkStep[];
}) {
  const { allowance, byTry, tries, touches, decided } = governance;
  return (
    <section className="side-gov">
      <h2 className="side-heading">{wording.sideAgreed}</h2>
      <dl className="side-week">
        {/*
         * **Both figures or neither, and the tries with them** (rule 6). One
         * sentence stands for the whole approval where none reads, rather than
         * a spend nobody agreed to and a count of tries against no ceiling.
         */}
        {allowance === null ? (
          <div className="side-week-wide">
            <dt>{wording.weekAllowance}</dt>
            <dd>{wording.weekNoAllowance}</dd>
          </div>
        ) : (
          <>
            <div>
              <dt>{wording.weekSpentFigure}</dt>
              <dd>{spendSaid(wording, allowance)}</dd>
            </div>
            <div>
              <dt>{wording.weekLeft}</dt>
              {/* What is held is not left: the store's check counts it as spent. */}
              <dd>
                {dollars(
                  Math.max(0, allowance.approvedUsd - allowance.spentUsd - allowance.heldUsd),
                )}
              </dd>
            </div>
            {/*
             * **The request across every try, each try as the detail**
             * (rondo#378). With one try there is nothing to add up, and the
             * spend above already says it.
             */}
            {byTry.length < 2 ? null : (
              <div className="side-week-wide">
                <dt>{wording.govByTryLabel}</dt>
                <dd>
                  {wording.govByTry(
                    byTry.reduce((sum, one) => sum + (one.costUsd ?? 0), 0).toFixed(2),
                    byTry.map((one, index) =>
                      wording.govTryCost(index + 1, one.costUsd?.toFixed(2) ?? null, one.running),
                    ),
                  )}
                </dd>
              </div>
            )}
            {tries === null ? null : (
              <div>
                <dt>{wording.govTriesLabel}</dt>
                <dd>{wording.govTries(tries.at, tries.of)}</dd>
              </div>
            )}
          </>
        )}
      </dl>
      {/*
       * **Where a lap may touch** (rule 6): the places the approval names and
       * the acts it permits. An approval that permits nothing outward is a
       * thing to say, so an empty list of acts is a sentence and not an
       * absence.
       */}
      {touches === null ? null : (
        <div className="side-touch">
          <h3>{wording.govTouchLabel}</h3>
          <ul>
            {touches.places.map((place) => (
              <li key={`${place.repository}\u0000${place.root}`}>
                <span className="side-repo">{place.repository}</span>
                <span className="side-root" lang="">
                  {place.root}
                </span>
              </li>
            ))}
          </ul>
          <p>
            {touches.acts.length === 0
              ? wording.govActsNone
              : wording.govActs(touches.acts.map((act) => wording.govAct(act)))}
          </p>
        </div>
      )}
      <h3 className="side-sub">{wording.govStepsLabel}</h3>
      <SideSteps wording={wording} steps={steps} />
      {/*
       * **What rondo decided without asking** (rule 6), counted and named.
       * The rule behind each *is* "why it did not need you" (`D-0064` O8): a
       * withholding whose rule cannot be named is refused at the writer, so
       * there is no row here whose reason is missing, and no separate screen
       * to send a person to for one.
       */}
      <div className="side-decided">
        <h3>{wording.weekDecided}</h3>
        {decided.count === 0 ? (
          <p className="side-note">{wording.govDecidedNone}</p>
        ) : (
          <>
            <p className="side-decided-count">{wording.weekThings(decided.count)}</p>
            <ul>
              {decided.byRule.map((rule) => (
                <li key={rule.ruleName}>
                  <span lang="">{rule.ruleName}</span>
                  <b>{wording.weekThings(rule.count)}</b>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}

export function ThreadSide({ wording, governance, steps, material, asking }: ThreadSideProps) {
  const agreed = <Agreed wording={wording} governance={governance} steps={steps} />;
  const known =
    material === null ? null : (
      <section className="side-material">
        <h2 className="side-heading">{asking ? wording.sideMaterial : wording.sideKnownSoFar}</h2>
        {material}
      </section>
    );
  return (
    <div className="side">
      {asking ? (
        <>
          {known}
          {agreed}
        </>
      ) : (
        <>
          {agreed}
          {known}
        </>
      )}
    </div>
  );
}
