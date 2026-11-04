/**
 * **The scope screen's own axis, as five pieces** (the screen that confirms
 * what the work is and what it may spend): what the work does and what it does
 * not, the caps a person reads before pressing, the one press that approves and
 * starts with the quieter one beside it, and the two folds everything else went
 * into. Lifted out of `screens/scope.tsx`, which is at its size cap.
 */
import type { ScopeOutwardAct } from "../../store/records.js";
import { CARD, CARD_HEADING, chevron, money, PRIMARY, SECONDARY } from "../page/vocabulary.js";
import type { Chrome } from "../wording.js";

const whole = (value: number) => String(Math.trunc(value));

/**
 * **What the work will do and what it will not, in three sentences**: the first
 * thing this screen shows, and one of the five things it always shows.
 *
 * rondo's own words over the scope itself -- where it runs, that it stops and
 * asks rather than going further, and which outward acts it is allowed. Never a
 * paraphrase of the request: the request's own words are at the head of the
 * screen, and the words the worker is sent are a press away ({@link
 * promptFold}).
 */
export function whatBlock(
  wording: Chrome,
  repositories: readonly string[],
  outward: readonly ScopeOutwardAct[],
) {
  return (
    <section id="scope-what" class={`${CARD} space-y-1`}>
      <h3 class={CARD_HEADING}>{wording.scopeWhatHeading}</h3>
      <p class="text-body leading-6">
        {wording.scopeWhatDoes(
          repositories.length === 0 ? wording.scopeOutwardNone : repositories.join(", "),
        )}
      </p>
      <p class="text-body leading-6">{wording.scopeWhatStops}</p>
      <p class="text-body leading-6">
        {wording.scopeWhatNot(outward.map((act) => wording.scopeOutwardAct(act)))}
      </p>
    </section>
  );
}

/**
 * **The three caps a person reads before pressing**: the cost, the redos, and
 * what is left to the worker. Drawn as the approved state's record is, so the
 * screen before the press and the screen after it read the same way.
 *
 * The other two budgets a scope holds -- the laps and the expiry -- are in the
 * fold with their boxes: they are derived from these two, and a screen that
 * showed five numbers to approve was five numbers to check.
 */
export function limitsBlock(
  wording: Chrome,
  costUsd: number,
  reviewRounds: number,
  outward: readonly ScopeOutwardAct[],
) {
  return (
    <section id="scope-limits" class={`${CARD} space-y-1`}>
      <h3 class={CARD_HEADING}>{wording.scopeLimitsHeading}</h3>
      <dl class="grid gap-x-4 gap-y-1 text-body leading-6 sm:grid-cols-2">
        {(
          [
            [wording.scopeCostLabel, money(costUsd)],
            [wording.scopeRoundsLabel, whole(reviewRounds)],
            [
              wording.scopeOutwardLabel,
              outward.length === 0
                ? wording.scopeOutwardNone
                : outward.map((act) => wording.scopeOutwardAct(act)).join(", "),
            ],
          ] as const
        ).map(([label, value]) => (
          <div class="flex min-w-0 items-baseline justify-between gap-3 border-b border-border/60 py-0.5">
            <dt class="text-meta text-muted-foreground">{label}</dt>
            <dd class="text-meta tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * **One press approves and starts; a second, quieter one only approves.**
 *
 * Approving and starting used to be two presses on two states of this screen: a
 * person read the caps, approved, and then had to find the start on the state
 * the `303` landed them on. The main press does both now, and the one that
 * stops after the approval is the secondary -- still there, because an approval
 * given now and spent later is a thing a person does.
 *
 * **Both are the same form's submits, and the main one is told apart by its own
 * field** (`start=1`): a browser posts the name and value of the button that
 * was pressed and of no other, so which of the two acts this is cannot be
 * forged by a hand-written body into the *wider* one -- the wider act is the
 * one that needs the field, and a body without it only approves.
 *
 * **Neither starts twice.** The scope id and the lap id are minted when the
 * form is drawn, so a second press of either carries the same two ids: the
 * store refuses the second scope, and `startScopedFromPage` joins a second
 * start of one lap id to the first (D-0061 rule 2.1, rondo#244).
 */
export function approvePresses(wording: Chrome, plainId: string, onlyPlainId: string) {
  return (
    <div class="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3">
      <button
        type="submit"
        name="start"
        value="1"
        data-row=""
        aria-describedby={plainId}
        data-busy={wording.scopeStartBusy}
        class={`${PRIMARY} h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto sm:self-start`}
      >
        {wording.scopeStartAction}
      </button>
      <span id={plainId} class="note sr-only">
        {wording.scopeStartPlain}
      </span>
      <button
        type="submit"
        data-row=""
        aria-describedby={onlyPlainId}
        data-busy={wording.scopeBusy}
        class={`${SECONDARY} h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto sm:self-start`}
      >
        {wording.scopeOnlyAction}
      </button>
      <span id={onlyPlainId} class="note sr-only">
        {wording.scopeOnlyPlain}
      </span>
      <p
        data-busy-note=""
        hidden
        role="status"
        class="note text-meta leading-5 text-muted-foreground"
      >
        {wording.startBusyNote}
      </p>
      {/* **The one press that spends money, saying what the refusals already
          say** (rondo#244): the join is real, and a guarantee nobody is told
          about is paid for in suspicion. */}
      <p class="note text-meta leading-5 text-muted-foreground">{wording.startAgainSafe}</p>
    </div>
  );
}

/**
 * **The caps' own boxes and their bases, behind one press.** Editing a cap and
 * reading where its number came from are both work a person does *sometimes*;
 * the number itself is above, unfolded, on every visit.
 *
 * Folded is not dropped (D-0029 rule 2): every box and every basis is in the
 * document, and with script off `page/app.css` draws the fold open.
 */
export function numbersFold(wording: Chrome, inside: unknown) {
  return (
    <details id="scope-numbers" class="group rounded-md border border-border">
      <summary class="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-1.5 text-meta leading-5 text-muted-foreground outline-none select-none hover:bg-accent focus-visible:bg-accent [&::-webkit-details-marker]:hidden">
        {chevron()}
        {wording.scopeNumbersFold}
      </summary>
      <div class="space-y-4 border-t border-border p-3">{inside}</div>
    </details>
  );
}

/**
 * **The whole of what the side doing the work is sent, behind one press**: the
 * drafter's prompt for a part, the rule files a lap is pointed at, rondo's own
 * definition of done, and the exact words of it. It used to be unfolded, which
 * put three screens of instructions between the caps and the press.
 */
export function promptFold(wording: Chrome, inside: unknown, id?: string) {
  return (
    <details class="group rounded-md border border-border" {...(id === undefined ? {} : { id })}>
      <summary class="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-1.5 text-meta leading-5 text-muted-foreground outline-none select-none hover:bg-accent focus-visible:bg-accent [&::-webkit-details-marker]:hidden">
        {chevron()}
        {wording.scopePromptFold}
      </summary>
      <div class="space-y-2 border-t border-border p-3">{inside}</div>
    </details>
  );
}
