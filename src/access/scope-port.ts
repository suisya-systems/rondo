/**
 * The page's port over a scope and the laps it admits (D-0059 section 5a, the
 * rondo#233 S3 rows, rondo#238 C2b, D-0074 section 4, D-0128). **Lifted out of
 * `web-app.ts`, which is at its size cap**, as `line-ports.ts` and
 * `scope-form.ts` were before it, and unchanged by the move: the press is
 * checked here through {@link spendPress}, exactly as it was checked there.
 */
import {
  type DraftedScopeFormDraft,
  type GoalPauseFromWeb,
  type GoalPauseInput,
  type GoalScopeFromWeb,
  type GoalScopeInput,
  type PlanStartFromWeb,
  type PlanStartInput,
  type Press,
  type RaiseFromWeb,
  type RaiseInput,
  type RecordDraftedScopeFromWeb,
  type RecordScopeFromWeb,
  type ScopedStartFromWeb,
  type ScopedStartInput,
  type ScopeFormDraft,
  type ScopeRecorded,
  type Started,
  spendPress,
} from "./web-app.js";

/** What a port says when what it was handed is not a person's press. */
const NO_PRESS_RECORDED = "nothing was recorded: this was not a person's press";
const NO_PRESS_STARTED = "nothing was started: this was not a person's press";

/**
 * The third thing this surface may write (D-0059 section 5a, the two rondo#233
 * S3 rows): a scope with its approval, and a lap started under that approval.
 *
 * **Both checks are inside this capability**, as the press check is in
 * `AnswerPort` and the send check in `SayPort`: whoever holds this
 * object reaches neither implementation without a press `mintPress`
 * minted and nobody has spent. Two methods on one class rather than two classes
 * because they are one screen's two presses over one approval, and a caller
 * that could hold the start without the record could start a lap under a scope
 * this surface never showed anybody.
 */
export class ScopePort {
  readonly #record: RecordScopeFromWeb;
  readonly #start: ScopedStartFromWeb;
  readonly #recordDrafted: RecordDraftedScopeFromWeb | null;
  readonly #startPlan: PlanStartFromWeb | null;
  readonly #raise: RaiseFromWeb | null;
  readonly #goal: { readonly record: GoalScopeFromWeb; readonly pause: GoalPauseFromWeb } | null;

  constructor(
    record: RecordScopeFromWeb,
    start: ScopedStartFromWeb,
    /** The drafted scope's two presses (rondo#238 C2b); null where the host offers none. */
    recordDrafted: RecordDraftedScopeFromWeb | null = null,
    startPlan: PlanStartFromWeb | null = null,
    /** The raise press (D-0074 section 4); null where the host offers none. */
    raise: RaiseFromWeb | null = null,
    /** The goal scope's approve and pause presses (D-0128); null where the host offers none. */
    goal: { readonly record: GoalScopeFromWeb; readonly pause: GoalPauseFromWeb } | null = null,
  ) {
    this.#record = record;
    this.#start = start;
    this.#recordDrafted = recordDrafted;
    this.#startPlan = startPlan;
    this.#raise = raise;
    this.#goal = goal;
  }

  /** Record a goal scope and approve it, on one press (the person's P1, D-0128). */
  async recordGoal(press: Press, input: GoalScopeInput): Promise<ScopeRecorded> {
    if (this.#goal === null || !spendPress(press)) {
      return { ok: false, note: NO_PRESS_RECORDED };
    }
    return await this.#goal.record(input);
  }

  /** Pause a goal scope: its `laps: 0` successor, recorded and approved as a raise is. */
  async pauseGoal(press: Press, input: GoalPauseInput): Promise<ScopeRecorded> {
    if (this.#goal === null || !spendPress(press)) {
      return { ok: false, note: NO_PRESS_RECORDED };
    }
    return await this.#goal.pause(input);
  }

  /** Record a budgets-only successor of one approval and approve it, on one press. */
  async raise(press: Press, input: RaiseInput): Promise<ScopeRecorded> {
    if (this.#raise === null || !spendPress(press)) {
      return { ok: false, note: NO_PRESS_RECORDED };
    }
    return await this.#raise(input);
  }

  /** Approve one drafted scope, as drafted or as the person changed it, on one press. */
  async recordDrafted(press: Press, form: DraftedScopeFormDraft): Promise<ScopeRecorded> {
    if (this.#recordDrafted === null || !spendPress(press)) {
      return { ok: false, note: NO_PRESS_RECORDED };
    }
    return await this.#recordDrafted(form);
  }

  /** Start one drafted plan under one approved scope, on one press. */
  async startPlan(press: Press, input: PlanStartInput): Promise<Started> {
    if (this.#startPlan === null || !spendPress(press)) {
      return { ok: false, note: NO_PRESS_STARTED };
    }
    return await this.#startPlan(input);
  }

  /** Record one drafted scope and approve it, on one press. */
  async recordAndApprove(press: Press, draft: ScopeFormDraft): Promise<ScopeRecorded> {
    if (!spendPress(press)) {
      return { ok: false, note: NO_PRESS_RECORDED };
    }
    return await this.#record(draft);
  }

  /** Start one lap under one approved scope, on one press. */
  async start(press: Press, input: ScopedStartInput): Promise<Started> {
    if (!spendPress(press)) {
      return { ok: false, note: NO_PRESS_STARTED };
    }
    return await this.#start(input);
  }

  /**
   * **Record one scope, approve it, and start the work -- on one press** (the
   * scope screen's main press).
   *
   * An arrival mints one press and a port spends it, so a route cannot reach
   * two of this capability's implementations from one person's click. That is
   * what this method is for: the press is checked and spent **here, once**, and
   * the two acts then run inside the capability that already holds both. The
   * alternative -- minting a second press, or spending one twice -- would
   * weaken the one rule that makes a write on this page a person's act.
   *
   * **The start is attempted only on an approval that was recorded**, and under
   * the approval read back off the row rather than one the form carried: the
   * caller composes the start from `recorded.scopeDecisionId`.
   */
  async recordApproveAndStart(
    press: Press,
    draft: ScopeFormDraft,
    start: (scopeDecisionId: string) => ScopedStartInput,
  ): Promise<Both> {
    return await both(
      press,
      async () => await this.#record(draft),
      async (id) => await this.#start(start(id)),
    );
  }

  /**
   * {@link recordApproveAndStart} for a drafted scope: the draft approved -- as
   * drafted, or as the person changed it -- and its first part started.
   *
   * **The first part and no other** (D-0098 rule 1): the parts after it are
   * ordered behind it and start by themselves once it lands, so one press is
   * the whole split under way.
   */
  async recordDraftedAndStart(
    press: Press,
    form: DraftedScopeFormDraft,
    start: (scopeDecisionId: string) => PlanStartInput,
  ): Promise<Both> {
    const drafted = this.#recordDrafted;
    const plan = this.#startPlan;
    if (drafted === null || plan === null) {
      spendPress(press);
      return { recorded: { ok: false, note: NO_PRESS_RECORDED }, started: null };
    }
    return await both(
      press,
      async () => await drafted(form),
      async (id) => await plan(start(id)),
    );
  }
}

/** What one press that approves and starts came to: the approval, and the start it allowed. */
export interface Both {
  readonly recorded: ScopeRecorded;
  readonly started: Started | null;
}

/** One press, two acts: spent once here, and the start only on an approval recorded. */
async function both(
  press: Press,
  approve: () => Promise<ScopeRecorded>,
  start: (scopeDecisionId: string) => Promise<Started>,
): Promise<Both> {
  if (!spendPress(press)) {
    return { recorded: { ok: false, note: NO_PRESS_RECORDED }, started: null };
  }
  const recorded = await approve();
  if (!recorded.ok || recorded.scopeDecisionId === undefined) {
    return { recorded, started: null };
  }
  return { recorded, started: await start(recorded.scopeDecisionId) };
}
