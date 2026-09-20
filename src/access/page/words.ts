/**
 * The words the rebuilt page adds (DECISIONS.md D-0083, D-0079).
 *
 * **A slice of the catalogue, not a second catalogue.** `Chrome` extends this,
 * and each shipped set spreads its own half in, so there is still one object
 * per language and `satisfies Chrome` still fails on a missing word. It is a
 * separate file only so that `src/access/wording.ts` does not grow by the size
 * of a new screen: the words live next to the faces that say them.
 *
 * **Composed in the language and never translated into it** (D-0079). The
 * Japanese below is not a rendering of the English; each set is written for a
 * person reading that language, which is why the day headings differ in shape
 * (English names a span, Japanese names the day) and why neither carries the
 * other's punctuation.
 *
 * **No identifier of rondo's reaches the screen** (D-0076): nothing here says
 * a lap id, a gate id, a status enum or a digest. What a row says about its
 * state is a sentence a person wrote for another person.
 */

/** Where a request sits on the time axis, said as a heading (D-0083 rule 2). */
export interface DayWords {
  readonly dayToday: string;
  readonly dayYesterday: string;
  readonly dayLastWeek: string;
  readonly dayMonth: string;
  readonly dayOlder: string;
}

export interface PageWords extends DayWords {
  /** The heading over the requests waiting on the person (rule 2's one exception). */
  readonly yourTurn: string;
  /** The way into a new request, at the top of the list (rule 5, left face). */
  readonly writeNewRequest: string;
  /** The list's own empty state: no request has been made yet. */
  readonly noRequestsYet: string;
  /**
   * The line drawn once in the list and once in the thread (rule 7).
   *
   * It takes when the person last looked, already said as a person reads it,
   * because the sentence differs in shape between the sets.
   */
  readonly lastLookedHere: (when: string) => string;
  /** The same line, where this actor has never looked before. */
  readonly lastLookedNever: string;
  /** The week's allowance, under the list (rule 5, left face). */
  readonly weekAllowance: string;
  /** Spent, approved and what is left, as one line. */
  readonly weekSpent: (spent: string, approved: string, left: string) => string;
  /** Where no allowance has been approved, so no spend may be shown beside it (rule 6). */
  readonly weekNoAllowance: string;
  /** A request's state, in one sentence, on its row in the list (rule 5). */
  readonly rowWaitingOnYou: string;
  readonly rowRunning: string;
  readonly rowFinished: string;
  readonly rowStopped: string;
  readonly rowNotStarted: string;
  /**
   * The event lines a lap produces (rule 7).
   *
   * Each is one sentence and names no identifier of rondo's (D-0076): what a
   * person reads is what happened, not which row it happened to.
   */
  readonly evStarted: string;
  readonly evFinished: string;
  readonly evStopped: string;
  readonly evChecksPassed: string;
  readonly evChecksFailed: string;
  readonly evReadingClear: string;
  readonly evReadingRaised: (findings: number) => string;
  readonly evReadingUnavailable: string;
  /** What a person wrote, and what rondo said, as the name on a message. */
  readonly saidByYou: string;
  readonly saidByRondo: string;
  /** The empty centre, where nothing waits (rule 4). */
  readonly emptyAsk: string;
  readonly emptyLead: string;
}

export const PAGE_EN: PageWords = Object.freeze({
  yourTurn: "Your turn",
  writeNewRequest: "Write a new request",
  noRequestsYet: "Nothing has been asked for yet.",
  dayToday: "Today",
  dayYesterday: "Yesterday",
  dayLastWeek: "Earlier this week",
  dayMonth: "This month",
  dayOlder: "Older",
  lastLookedHere: (when) => `Below here is what you saw last time (${when})`,
  lastLookedNever: "Below here is everything so far",
  weekAllowance: "This week's allowance",
  weekSpent: (spent, approved, left) => `${spent} of ${approved}, ${left} left`,
  weekNoAllowance: "No allowance approved yet",
  rowWaitingOnYou: "Waiting on your answer",
  rowRunning: "Working on it",
  rowFinished: "Finished",
  rowStopped: "Stopped",
  rowNotStarted: "Not started yet",
  evStarted: "Work started.",
  evFinished: "Finished, and the work was taken in.",
  evStopped: "Stopped.",
  evChecksPassed: "The automatic checks all passed.",
  evChecksFailed: "The automatic checks did not pass.",
  evReadingClear: "Another model read the change and raised nothing.",
  evReadingRaised: (findings) =>
    findings === 1
      ? "Another model read the change and raised one thing."
      : `Another model read the change and raised ${String(findings)} things.`,
  evReadingUnavailable: "Another model could not read the change.",
  saidByYou: "You",
  saidByRondo: "rondo",
  emptyAsk: "What would you like to ask for?",
  emptyLead: "Write it in your own words. If anything is unclear, rondo asks before it starts.",
} satisfies PageWords);

export const PAGE_JA: PageWords = Object.freeze({
  yourTurn: "あなたの番",
  writeNewRequest: "新しい依頼を書く",
  noRequestsYet: "まだ何も頼んでいません。",
  dayToday: "今日",
  dayYesterday: "きのう",
  dayLastWeek: "今週のはじめ",
  dayMonth: "今月",
  dayOlder: "それより前",
  lastLookedHere: (when) => `ここから下は前回（${when}）に見たもの`,
  lastLookedNever: "ここから下はこれまでのすべて",
  weekAllowance: "今週の枠",
  weekSpent: (spent, approved, left) => `${spent} ／ ${approved}　残り ${left}`,
  weekNoAllowance: "まだ枠が決まっていません",
  rowWaitingOnYou: "あなたの返事を待っています",
  rowRunning: "作業中です",
  rowFinished: "終わりました",
  rowStopped: "取りやめました",
  rowNotStarted: "まだ始まっていません",
  evStarted: "作業を始めました。",
  evFinished: "終わりました。変更は取り込み済みです。",
  evStopped: "取りやめました。",
  evChecksPassed: "自動チェックはすべて通りました。",
  evChecksFailed: "自動チェックが通りませんでした。",
  evReadingClear: "別の AI が変更を読み直し、指摘はありませんでした。",
  evReadingRaised: (findings) =>
    `別の AI が変更を読み直し、指摘を ${String(findings)} 件出しました。`,
  evReadingUnavailable: "別の AI は変更を読めませんでした。",
  saidByYou: "あなた",
  saidByRondo: "rondo",
  emptyAsk: "何を頼みますか",
  emptyLead: "ふだんの言葉で書いてください。はっきりしないところがあれば、始める前に聞き返します。",
} satisfies PageWords);
