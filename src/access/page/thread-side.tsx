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
import type { PartView } from "../page-logic/parts.js";
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
  /**
   * One step per part where the request runs as several lines (D-0098 rule
   * 8.2, D-0129), in the split's order; empty for a request run as one.
   */
  readonly parts?: readonly PartStep[];
}

/** A link a part's step carries: a pull request, or a question in the thread. */
export interface PartLink {
  readonly href: string;
  readonly said: string;
}

/** One part's step, already said. */
export interface PartStep {
  readonly name: string;
  readonly said: string;
  /**
   * The part is the person's (rule 8.2): the one amber on this face, since
   * what it waits on is a question or a gate and not something rondo clears.
   */
  readonly yours: boolean;
  readonly links: readonly PartLink[];
}

/**
 * A part's step in the person's words (rule 8.2): what it waits on, and the
 * pull request or the question that says why, with nothing to press here --
 * a part that waits on an earlier one's merge starts by itself.
 */
export function partStepOf(
  wording: Chrome,
  view: PartView,
  /**
   * The merged pull request the part's next attempt merges in first (rule
   * 8.5, `takeInFrom`), or null.
   */
  takeIn: PartView["pullRequest"] = null,
  /**
   * The address that puts this part's gate in the box, where the box shows
   * another part's (D-0129), or null.
   */
  gateHref: string | null = null,
): PartStep {
  const alone = partStepAlone(wording, view);
  const step =
    gateHref === null
      ? alone
      : { ...alone, links: [...alone.links, { href: gateHref, said: wording.partGateLink }] };
  return takeIn === null
    ? step
    : {
        ...step,
        said: wording.partThen(step.said, wording.partTakeIn),
        links: [
          ...step.links,
          ...(takeIn.url === null
            ? []
            : [{ href: takeIn.url, said: wording.pullRequest(takeIn.number) }]),
        ],
      };
}

function partStepAlone(wording: Chrome, view: PartView): PartStep {
  const name = wording.partName(view.index + 1);
  const pullRequest = (pr: PartView["pullRequest"]): PartLink[] =>
    pr?.url == null ? [] : [{ href: pr.url, said: wording.pullRequest(pr.number) }];
  const wait = view.wait;
  // Dropped by the person's *stop* to rule 1.5's question (D-0103 rule 1.6).
  if (wait !== null && view.standing === "stopped") {
    return { name, said: wording.partStopped, yours: false, links: [] };
  }
  if (wait !== null && wait.first === "endedUnlanded") {
    return {
      name,
      said: wording.partUnlanded(wait.after),
      // The person's only while the question stands.
      yours: view.standing === "yours",
      links:
        wait.askId === null
          ? []
          : [{ href: `#${encodeURIComponent(wait.askId)}`, said: wording.partUnlandedLink }],
    };
  }
  if (wait !== null) {
    return {
      name,
      said: wording.partWaiting(
        wait.after,
        wait.place,
        wait.pullRequest === null ? null : wording.pullRequest(wait.pullRequest.number),
      ),
      yours: false,
      links: pullRequest(wait.pullRequest),
    };
  }
  switch (view.standing) {
    case "yours":
      return { name, said: wording.partYours, yours: true, links: [] };
    case "running":
      return { name, said: wording.partRunning, yours: false, links: [] };
    case "merged":
      return { name, said: wording.partMerged, yours: false, links: pullRequest(view.pullRequest) };
    case "finished":
      return {
        name,
        said: wording.partFinished,
        yours: false,
        links: pullRequest(view.pullRequest),
      };
    case "stopped":
      return { name, said: wording.partStopped, yours: false, links: [] };
    default:
      return { name, said: wording.partToStart, yours: false, links: [] };
  }
}

function PartSteps({ parts }: { readonly parts: readonly PartStep[] }) {
  return (
    <ol className="side-parts">
      {parts.map((part) => (
        <li
          className={`side-part${part.yours ? " side-part-yours" : ""}`}
          key={part.name}
          // A step on this face too (rondo#494 item 1), washed when it moves.
          data-can-act="step"
        >
          <span>{part.name}</span>
          <p>
            {part.said}
            {part.links.map((link) => (
              <span key={link.href}>
                {" "}
                <a href={link.href}>{link.said}</a>
              </span>
            ))}
          </p>
        </li>
      ))}
    </ol>
  );
}

/** A figure in dollars, in the shape `govSpent` writes one (`D-0082`'s scale). */
function dollars(value: number): string {
  return `$${value.toFixed(2)}`;
}

function Agreed({
  wording,
  governance,
  steps,
  parts,
}: {
  readonly wording: Chrome;
  readonly governance: Governance;
  readonly steps: readonly WorkStep[];
  readonly parts: readonly PartStep[];
}) {
  const { allowance, atBudgetCap, byTry, tries, touches, decided, worker } = governance;
  return (
    <section className="side-gov">
      <h2 className="side-heading">{wording.sideAgreed}</h2>
      <dl className="side-week">
        {/*
         * **Which worker did the work** (rondo#462), and whether the person
         * chose it: the record of the choice, where what was agreed for the
         * request is read. Before rondo#462 the answer lived only in the host's
         * environment, which is the terminal the goal's clause 3 is about.
         *
         * **Read off the row and off nothing else.** The name comes from the
         * lap's own `workerProvider`, which reservation settles -- the person's
         * pick, or the host's default resolved at the start. A null is a lap
         * from before rondo recorded either, and that says so rather than
         * naming the default the host runs now over a lap that ran on another.
         */}
        <div className="side-week-wide">
          <dt>{wording.workerProviderLabel}</dt>
          <dd>
            {worker === null
              ? wording.workerProviderUnknown
              : wording.workerProviderRan(worker.provider, worker.chosen)}
          </dd>
        </div>
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
            {/* D-0121: a lap that spent all the room the budget left it. */}
            {atBudgetCap === null ? null : (
              <div className="side-week-wide">
                <dt>{wording.govAtCapLabel}</dt>
                <dd>
                  {wording.govAtCap(atBudgetCap.costUsd.toFixed(2), atBudgetCap.capUsd.toFixed(2))}
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
      {/* Each part's wait is one step of what remains (D-0098 rule 8.2); the
          five steps under it are the part being answered. */}
      {parts.length === 0 ? null : (
        <>
          <h4 className="side-parts-heading">{wording.partsHeading}</h4>
          <PartSteps parts={parts} />
        </>
      )}
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

export function ThreadSide({
  wording,
  governance,
  steps,
  material,
  asking,
  parts = [],
}: ThreadSideProps) {
  const agreed = <Agreed wording={wording} governance={governance} steps={steps} parts={parts} />;
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

/**
 * The right face of a request with no lap yet (rondo#495): the plan and its
 * scope, then the steps still ahead. No agreement to show beside them -- none
 * has been approved, or none has run.
 */
export function ScopeSide({
  wording,
  steps,
}: {
  readonly wording: Chrome;
  readonly steps: readonly WorkStep[];
}) {
  return (
    <div className="side">
      <section className="side-gov">
        <h2 className="side-heading">{wording.govStepsLabel}</h2>
        <SideSteps wording={wording} steps={steps} />
      </section>
    </div>
  );
}

/**
 * The right face of a split no part of which has started yet (D-0098 rule 8.2):
 * there is no lap to read an agreement or five steps from, and the parts' waits
 * are still what remains before the request ends.
 */
export function PartsSide({
  wording,
  parts,
}: {
  readonly wording: Chrome;
  readonly parts: readonly PartStep[];
}) {
  return (
    <div className="side">
      <section className="side-gov">
        <h2 className="side-heading">{wording.govStepsLabel}</h2>
        <h4 className="side-parts-heading">{wording.partsHeading}</h4>
        <PartSteps parts={parts} />
      </section>
    </div>
  );
}
