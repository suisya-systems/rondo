/**
 * **The scope screen's own words** (rondo#233 S3, D-0066 rule 1, rondo#238
 * C2b, D-0074 section 4): the screen a person confirms what the work is and
 * what it may spend on, and the two presses it ends in. Lifted out of
 * `wording.ts`, which is at its size cap, as `page/words.ts` and the other
 * `*-words.ts` sets were; every entry is unchanged by the move, and
 * {@link Chrome} extends this, so each language set is still one whole object.
 */
import type { BudgetLevel } from "../../advisory/budget.js";
import type { AgentTypeSource } from "../wording.js";

export interface ScopeWords {
  // -- The scope screen (rondo#233 S3, D-0066 rule 1) --
  /**
   * The way in, and the screen's own title. One short filled call to action
   * with the longer sentence as the pointer's `title`, the shape
   * {@link answerAction} and {@link answerHere} already have.
   */
  readonly scopeAction: string;
  readonly scopeHeading: string;
  readonly backToThread: string;
  readonly scopeLead: string;
  /**
   * No plan rondo holds, no form: the screen says how one comes to be held,
   * on the page (D-0071 rule 6.2's recommendation, rondo#238).
   */
  readonly scopeNoPlanHeld: string;
  readonly scopePlansUnread: (reason: string) => string;
  /** The plan choice, above the list of plans rondo holds. */
  readonly scopePlanAsk: string;
  /** Where a held plan came from: pasted into this thread, or run by earlier laps. */
  readonly scopePlanFrom: (from: "message" | "iterations" | "setup") => string;
  /** One held plan as a line: where, the agent type's short digest, and where it came from. */
  readonly scopePlanLine: (where: string, agentType: string, from: string) => string;
  /** A plan line another offered plan reads the same as, with when rondo came to hold it (UTC). */
  readonly scopePlanHeldAt: (line: string, at: string) => string;
  /** A plan the address named that rondo no longer offers: said, and the choice put again. */
  readonly scopePlanGone: string;
  /** The drafted scope's screen (rondo#238 C2b, D-0071 rule 5.3). */
  readonly scopeDraftedLead: string;
  readonly scopeDraftedPlansHeading: string;
  readonly scopeDraftedPlan: (n: number) => string;
  /** A drafted plan whose template the draft's snapshot no longer holds. */
  readonly scopeDraftedTemplateGone: string;
  /**
   * Which model a part runs on, and why it may (rondo#473, D-0167): the tier in
   * the person's words, the model and worker beside it, the drafter's grounds
   * for a lighter tier, and each lap's model and cost.
   */
  readonly tierHeading: string;
  /**
   * The tier said plainly: `lighter` is whether the tier's model differs from
   * the `standard` one on this worker, null where rondo cannot say (no worker
   * named, or a tier it has no model for).
   */
  readonly tierSaid: (tier: string | null, lighter: boolean | null) => string;
  readonly tierModel: (model: string, provider: string) => string;
  /** The drafter's grounds for a non-`standard` tier: claims, checked for shape only. */
  readonly tierWhy: string;
  /** One condition of D-0044 rule 1, in the person's words. */
  readonly tierCondition: (condition: string) => string;
  readonly tierLapsHeading: string;
  readonly tierLap: (
    n: number,
    model: string | null,
    provider: string | null,
    costUsd: string | null,
  ) => string;
  /** A drafted value below what rule 4.2 computed: what it was computed as, before the words it rests on. */
  readonly scopeNarrowed: (computed: string) => string;
  /** A threshold the drafter made stricter, and an act it added to the irreversible list, on the person's words. */
  readonly scopeNarrowedStricter: string;
  readonly scopeNarrowedAdded: string;
  /** A draft written after an approval that stands: shown beside it, and what approving it means. */
  readonly scopeRedrafted: string;
  /**
   * The scope screen while a question in the request's thread waits (rondo#431):
   * no scope is offered to approve, and the way is to the question.
   */
  readonly scopeAnswerFirst: string;
  readonly scopeDraftedAction: string;
  readonly scopeDraftedPlain: string;
  readonly scopeDraftedPressNote: string;
  /** One drafted plan under an approved scope, and whether it can start now. */
  readonly planStartAction: string;
  readonly planStartPlain: string;
  readonly planStarted: string;
  readonly planStartedLink: string;
  readonly planBusy: (limit: number) => string;
  readonly planFull: (live: number, limit: number) => string;
  /** Why the scope's own test says no, in plain words: one per test (D-0066 rule 4.2). */
  readonly planOutside: (test: string) => string;
  readonly planUnrunnable: string;
  readonly planUnrunnableWhy: string;
  /** The scope's tests could not be read now: said as that, with rondo's reason folded. */
  readonly planUndecidable: string;
  /** An approved scope no plan rondo holds may run under. */
  readonly scopeNoPlanForScope: string;
  readonly scopeNoApprover: string;
  /**
   * What the plan says, quiet, above the numbers it drafted them from.
   *
   * **`place` is null where the repository is not what tells two plans
   * apart** (`D-0081` rule 4.2, rondo#305), and the sentence is then the
   * workspace root alone. Where a plan's line does say it, it arrives as the
   * person's own name for the place -- never a path and never an
   * `OWNER/NAME` -- so a set writes it as a name and not as a location. The
   * recorded fold hands this the path rondo holds instead, unchanged: that
   * fold is rondo's own record of where it runs, not a label on a choice.
   */
  readonly scopeWorkspace: (place: string | null, root: string) => string;
  readonly scopePlanDigest: (digest: string) => string;
  /**
   * The card's own heading, and the fold the two digests sit in.
   *
   * The card holds the plan, the workspace, the two digests and what the agent
   * type is allowed, and its only heading named the last of those -- so nothing
   * on the screen said plainly *this is the plan rondo will run and where*
   * (rondo#233 S3 screen review). The digests are folded for the same review's
   * other half: three 71-character hashes were a third of the first screenful
   * at 420px, and there is nothing a person does with one. The workspace root
   * and the agent type's tier and grants joined them there on rondo#431: the
   * person reads which repository, and nothing on those lines is theirs to act on.
   */
  readonly scopePlanHeading: string;
  readonly scopeRecordedFold: string;
  /**
   * What this screen cannot tell the person: whether they already approved a
   * scope for this request.
   *
   * The store holds no listing of a request's scopes (`AdvisoryRecord`), so a
   * second press here records and approves a second scope and the screen would
   * not know. Said rather than hidden -- a blank draft presented as if none
   * existed is the screen lying by omission.
   */
  readonly scopeMaybeApproved: string;
  /**
   * One line per listed agent type, read back from the held record (D-0069
   * section 1): what it is allowed, or why that cannot be shown.
   *
   * `from` says where the record was read, and the three are not the same
   * claim: two of them are rows rondo already holds, and `plan` is the plan
   * this very scope would record -- nothing is held yet, and the person is
   * being shown what the press is about to write rather than what it wrote.
   *
   * `granted` are cadenza's own capability keys and stay their own bytes in
   * both sets (rule 3); the prose around them is rewritten.
   */
  readonly scopeHeldBounds: (
    digest: string,
    tier: string,
    granted: readonly string[],
    from: AgentTypeSource,
  ) => string;
  readonly scopeHeldNone: (digest: string) => string;
  readonly scopeHeldUnreadable: (digest: string, reason: string) => string;
  readonly scopeHeldRebuilds: (digest: string, rebuilt: string, from: AgentTypeSource) => string;
  readonly scopeHeldNoBuild: (digest: string, from: AgentTypeSource, reason: string) => string;
  /** The review-rounds control, and the residual of drawing it as links rather than a form. */
  readonly scopeRoundsAsk: string;
  readonly scopeRoundsRedraw: string;
  readonly scopeLapsLabel: string;
  readonly scopeRoundsLabel: string;
  readonly scopeCostLabel: string;
  readonly scopeReserveLabel: string;
  /** The expiry is a native `datetime-local` read as UTC, so the label says UTC. */
  readonly scopeExpiresLabel: string;
  /**
   * How a number follows from its bases, one arm per budget, and the fold the
   * bases themselves sit in.
   *
   * `computeScopeBudgets` returns the arithmetic as facts and not as a sentence
   * (`src/advisory/budget.ts`), because a line it composed was a line no second
   * set could rewrite: rondo#233 S3's screen review found every formula and
   * every basis rendering English inside a Japanese page.
   */
  readonly scopeFormula: (how: string) => string;
  readonly scopeFormulaRounds: string;
  readonly scopeFormulaLaps: (plans: number, rounds: number) => string;
  readonly scopeFormulaReserve: string;
  readonly scopeFormulaCost: (
    plans: number,
    reserve: string,
    laterRounds: number,
    redo: string,
  ) => string;
  readonly scopeFormulaExpires: (laps: number, seconds: number) => string;
  readonly scopeBasesFold: (count: number) => string;
  /**
   * Where one number came from: the laps it was measured over, the fact that
   * nothing in this store measured it, or a number rondo was given.
   *
   * `tier` is the model tier when the measurement fell through to it, and null
   * when the rows are the agent type's own. **No D-number** (rule 5 of this
   * catalogue's own bounds): the default review rounds cited one until
   * rondo#233 S3's screen review found it in front of a person, folded but
   * present, in four of the five budgets.
   */
  /**
   * `level` is which laps were read (D-0140 rule 2): the agent type's own, its
   * tier's (`tier` set), or any lap in the scope's repositories.
   */
  readonly scopeBasisRows: (
    measurement: string,
    laps: number,
    level: BudgetLevel,
    tier: string | null,
  ) => string;
  readonly scopeBasisColdStart: (measurement: string) => string;
  /**
   * Beside a drafted value that rests on a cold start (rondo#378): said next
   * to the number and not only in its formula, because a default drawn like a
   * measurement is read as one. `whole` is false where only some of the
   * listed agent types fell to it.
   */
  readonly scopeColdStartNote: (whole: boolean) => string;
  readonly scopeBasisPlans: (plans: number) => string;
  readonly scopeBasisRounds: (rounds: number, byDefault: boolean) => string;
  readonly scopeBasisReplyAllowance: string;
  /** A `rows` basis's lap, drawn as a link into that lap's answer view and never as an id to copy. */
  readonly scopeBasisLap: (iterationId: string) => string;
  /**
   * The caveat above the budgets (rondo#247): the draft assumes the request is
   * the size of the laps it measured, and nothing recorded can say whether it is.
   */
  readonly scopeSampleHeading: string;
  /** `level` as in {@link scopeBasisRows}. */
  readonly scopeSampleRows: (
    laps: number,
    level: BudgetLevel,
    tier: string | null,
    lowest: string,
    highest: string,
  ) => string;
  readonly scopeSampleColdStart: (reserve: string) => string;
  readonly scopeDefaultsHeading: string;
  readonly scopeDefaultNote: string;
  readonly scopeSeverityLabel: string;
  readonly scopeOutwardLabel: string;
  /** Under the outward acts, when a goal scope's are the default (D-0140 rule 1). */
  readonly scopeOutwardFromGoal: string;
  /**
   * One outward act as a person reads it. The enum value is the token a scope
   * records and `rondo scope` prints, so it stays beside the words rather than
   * being replaced by them (rule 3).
   */
  readonly scopeOutwardAct: (act: string) => string;
  readonly scopeOutwardNone: string;
  readonly scopeIrreversibleNone: string;
  /** D-0066's gate answer 1: what the cost budget does not see, on both states of the screen. */
  readonly scopeCostCaveat: string;
  readonly scopePressNote: string;
  readonly scopePlain: string;
  /**
   * **What the work will do and what it will not, in three sentences** (the
   * scope screen's own axis, `screens/scope-press.tsx`): rondo's words over the
   * scope itself, never a paraphrase of the request.
   */
  readonly scopeWhatHeading: string;
  readonly scopeWhatDoes: (repository: string) => string;
  readonly scopeWhatStops: string;
  /** The acts as a person reads them, already in their words, or none of them. */
  readonly scopeWhatNot: (acts: readonly string[]) => string;
  /** The caps a person reads before pressing: the cost, the redos, the acts. */
  readonly scopeLimitsHeading: string;
  /**
   * **The one press that approves and starts**, and the approval that starts
   * nothing yet beside it. Both are safe to repeat: the scope id and the lap id
   * are minted when the form is drawn, so a double press records one scope and
   * starts one lap (see {@link startAgainSafe}).
   */
  readonly scopeStartAction: string;
  readonly scopeStartPlain: string;
  readonly scopeStartBusy: string;
  readonly scopeOnlyAction: string;
  readonly scopeOnlyPlain: string;
  /** The fold holding the caps' own boxes and where each number came from. */
  readonly scopeNumbersFold: string;
  /** The fold holding the whole of what the side doing the work is sent. */
  readonly scopePromptFold: string;
  /** The fold holding which plan the work runs on and which model does it. */
  readonly scopeDetailsFold: string;
  /** The approval this screen's second state is showing, and the digest it was made over. */
  readonly scopeApproved: (since: string) => string;
  readonly scopeDigest: (digest: string) => string;
  readonly scopeNotThisRequest: string;
  /** What a superseded scope's approval spent, which is part of what a successor decides (rule 1.4). */
  readonly scopePredecessorSpent: (laps: number, usd: string, unread: number) => string;
  readonly scopePredecessorNoApproval: string;
  readonly scopePredecessorUnreadable: (reason: string) => string;
  /**
   * Why this approval has no start button: a later scope replaced it (rule
   * 1.4), and `scopeVerdict` would refuse the press at the `superseded` test.
   * Said where the button was, rather than drawn and refused.
   */
  readonly scopeRetired: string;
  /** The link after {@link scopeRetired} to the approval that replaced it (rondo#676). */
  readonly scopeRetiredLink: string;
}
