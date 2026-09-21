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

import type { ChecksState } from "../page-logic/result.js";

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
  /**
   * A lap that closed with no answer recorded on its gate. **It never says the
   * work was taken in** (rondo#376): `closed` means the gate ended, and a merge
   * is nothing rondo does or watches.
   */
  readonly evFinished: string;
  /**
   * What the person answered at the gate, said as that answer (rondo#376).
   *
   * `evApproved` is an approval, and says whether it has been published yet:
   * approve, publish and merge are three acts, and a line that read as the
   * last of them after only the first is what lap 11 measured.
   * `evAskedChange` is the same gate answered by asking for a change -- the
   * row alone cannot tell the two apart, the next try built on this one can.
   * `evClosedUnapproved` is a gate that ended any other way.
   *
   * **Which answer it was is rondo's record, not the next try** (rondo#385,
   * D-0092). `evAskedChangeNoNextTry` is a change asked for whose next try did
   * not start -- refused on budget or scope, say -- which used to read as an
   * approval. `evAnswerUnrecorded` is a lap answered before rondo kept that
   * record and with no next try to show it was a change: rondo does not know,
   * so it says so and offers no pull request.
   */
  readonly evApproved: (published: boolean) => string;
  readonly evAskedChange: string;
  readonly evAskedChangeNoNextTry: string;
  readonly evAnswerUnrecorded: string;
  readonly evClosedUnapproved: string;
  /** The line a publish is said as; the pull request is the link after it. */
  readonly evPublished: string;
  /** The line a checks answer is said as: the pull request, and what its checks came to. */
  readonly evChecks: (pullRequest: string, word: string, detail: string | null) => string;
  readonly evStopped: string;
  /**
   * The two ways an attempt can fail, which are not one line (rondo#348).
   *
   * **The row now says whose failure it was, so the page may stop saying both
   * the same way.** `evRefused` is D-0076 rule 4.4: something outside said no,
   * the person has a next move, and what was said is relayed as itself rather
   * than reworded (`D-0015` rule 7). `evBroke` is rule 4.5: rondo's own fault,
   * said in one sentence that asks nothing of the person, with rondo's reason
   * shut in the fold `evBrokeReason` labels for whoever maintains rondo. A row
   * that does not carry the kind -- every row written before the column -- goes
   * on saying `evStopped`.
   */
  readonly evRefused: (said: string) => string;
  readonly evBroke: string;
  readonly evBrokeReason: string;
  readonly evChecksPassed: string;
  readonly evChecksFailed: string;
  readonly evReadingClear: string;
  readonly evReadingRaised: (findings: number) => string;
  readonly evReadingUnavailable: string;
  /**
   * The line a folded run of event lines is drawn as (rule 7's fold,
   * rondo#332).
   *
   * `foldTry` says a settled attempt by the one thing worth reading about it,
   * with how many lines are shut behind it. `foldSeen` says a stretch the
   * person has already read, which has nothing worth naming in it -- that is
   * the whole claim -- so it says only how much.
   */
  readonly foldTry: (said: string, lines: number) => string;
  readonly foldSeen: (lines: number) => string;
  /** What the fold offers, on the line itself: the same word open or shut. */
  readonly foldOpen: string;
  /** What a person wrote, and what rondo said, as the name on a message. */
  readonly saidByYou: string;
  readonly saidByRondo: string;
  /** The empty centre, where nothing waits (rule 4). */
  readonly emptyAsk: string;
  readonly emptyLead: string;
  /**
   * The empty state's right face (rule 4): the last seven days, and what is
   * running.
   *
   * The labels name the noun, so the figure beside one is bare in English and
   * carries its counter in Japanese -- which is why `weekThings` and
   * `weekTimes` are two words rather than one with a unit appended.
   */
  readonly sevenDays: string;
  readonly weekAsked: string;
  readonly weekFinished: string;
  readonly weekAnswered: string;
  readonly weekDecided: string;
  readonly weekSpentFigure: string;
  readonly weekLeft: string;
  readonly weekThings: (count: number) => string;
  readonly weekTimes: (count: number) => string;
  /** What is running, under the week (rule 4), and the sentence under it. */
  readonly runningHeading: string;
  readonly runningNone: string;
  /**
   * The line under the running work: none of it needs the person.
   *
   * **The claim the whole face rests on** (rule 4, `D-0064`): a person is
   * called rarely by design, so a face full of work that nobody is being asked
   * about has to say that it is not a queue.
   */
  readonly runningNote: string;
  /**
   * The steps to a request's end (rule 4), and what each one is.
   *
   * `stepPublish` is opening the pull request (rondo#376): approve, publish
   * and merge are three acts in that order, and the row says each apart.
   */
  readonly stepWork: string;
  readonly stepChecks: string;
  readonly stepReading: string;
  readonly stepApproval: string;
  readonly stepPublish: string;
  readonly stepLanding: string;
  /**
   * What became of the work after the gate, said as a state (rondo#376).
   *
   * **Drawn by the page in the person's language, beside rondo's reports,
   * which stay English** (`D-0055` rule 4). `pullRequest` names one as a
   * person does (`#372`); `checksWord` is the one word the colour goes with,
   * and `checksDetail` the counts behind it, or null where there are none to
   * say. A skipped check is said as skipped and never as passed.
   */
  readonly pullRequest: (number: string | null) => string;
  readonly checksWord: (checks: ChecksState) => string;
  readonly checksDetail: (checks: ChecksState) => string | null;
  /**
   * The strip under the title: what was answered, published and merged. A
   * merge is said as done only where a person's press on this page made it
   * (rondo#380), with where it went and how; otherwise it is said as whose it
   * is and never as not done, because a merge on the forge itself is not one
   * rondo watches.
   */
  readonly resultApproved: string;
  readonly resultNotPublished: string;
  readonly resultPublished: string;
  readonly resultChecks: string;
  readonly resultNotMerged: string;
  readonly resultMerged: (into: string, method: string) => string;
  /** The same result as a list row's one sentence. */
  readonly rowApproved: string;
  readonly rowPublished: (pullRequest: string, checks: string) => string;
  /**
   * What a basis names where it is not a message (D-0076): the kind of thing
   * it is, and never the identifier the store holds it under (lap 11, N-52).
   */
  readonly basisKind: (form: string) => string | null;
  /** Where a step stands: done, the one it is on now, not yet, or the person's. */
  readonly stepDone: string;
  readonly stepNow: string;
  readonly stepAhead: string;
  readonly stepYours: string;
  /**
   * The right face of a request (rule 5's two tiers).
   *
   * `sideMaterial` heads the material while a question is standing;
   * `sideKnownSoFar` heads the same tier when nothing is being asked, which is
   * rule 5's own second name for it. `sideAgreed` heads what was agreed.
   */
  readonly sideMaterial: string;
  readonly sideKnownSoFar: string;
  readonly sideAgreed: string;
  /** What was agreed, in full (rule 6), as the labels on the right face. */
  readonly govTriesLabel: string;
  /**
   * What is held beside what was spent (rondo#378): `pair` is `govSpent`'s,
   * and the reserve follows it as its own figure rather than inside the spend.
   * `inProgress` says the tries holding it are still going; otherwise the
   * sentence says only that their cost is not known yet, true of both.
   */
  readonly govHeld: (pair: string, held: string, tries: number, inProgress: boolean) => string;
  /** The request's cost across every try, and each try's as the detail under it. */
  readonly govByTryLabel: string;
  readonly govByTry: (total: string, tries: readonly string[]) => string;
  readonly govTryCost: (at: number, cost: string | null, running: boolean) => string;
  readonly govTouchLabel: string;
  readonly govStepsLabel: string;
  /**
   * The outward acts an approval permits, said as acts and never as their
   * names in the record (D-0076): `govAct` words one, `govActs` joins them,
   * and `govActsNone` is an approval that permits nothing outward -- which is
   * a thing to say and not an absence.
   */
  readonly govAct: (act: string) => string;
  readonly govActs: (acts: readonly string[]) => string;
  readonly govActsNone: string;
  /**
   * What rondo decided without asking, about **this request** (rule 6's fifth
   * item).
   *
   * `govDecided` is the count on the one-line strip under the title;
   * `govDecidedNone` is the sentence on the right face where nothing was
   * withheld about this request. Zero is said rather than hidden: the count is
   * now read from this request's own withheld rows, so nothing is claimed that
   * was not recorded.
   */
  readonly govDecided: (count: number) => string;
  readonly govDecidedNone: string;
  /**
   * The findings quoted in the answering box, unfolded (rule 9.4).
   *
   * The cards they come from are on the right face since rule 5's material
   * moved there, and that face drops below the thread at 1280 -- so the box
   * says what is being answered over, in the readers' own words.
   */
  readonly standingHeading: string;
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
  evFinished: "Finished.",
  evApproved: (published) =>
    published
      ? "You approved the work."
      : "You approved the work. It is not published yet: no pull request has been opened.",
  evAskedChange: "You asked for a change. The next try works on it.",
  evAskedChangeNoNextTry: "You asked for a change. The next try has not started.",
  evAnswerUnrecorded:
    "The confirmation was answered, but there is no record of whether it was an approval or " +
    "a change request, so no pull request is offered for it.",
  evClosedUnapproved: "The confirmation closed without an approval.",
  evPublished: "Published, and a pull request was opened:",
  evChecks: (pullRequest, word, detail) =>
    `The checks on ${pullRequest}: ${word}${detail === null ? "" : ` (${detail})`}.`,
  evStopped: "Stopped.",
  evRefused: (said) => `Stopped, because this was turned down: ${said}`,
  evBroke: "Stopped by a fault in rondo itself. Nothing you asked for was wrong.",
  evBrokeReason: "What rondo recorded, for whoever looks after it",
  evChecksPassed: "The automatic checks all passed.",
  evChecksFailed: "The automatic checks did not pass.",
  evReadingClear: "Another model read the change and raised nothing.",
  evReadingRaised: (findings) =>
    findings === 1
      ? "Another model read the change and raised one thing."
      : `Another model read the change and raised ${String(findings)} things.`,
  evReadingUnavailable: "Another model could not read the change.",
  foldTry: (said, lines) => `${said} (${String(lines)} lines)`,
  foldSeen: (lines) =>
    lines === 1 ? "1 line you had already read" : `${String(lines)} lines you had already read`,
  foldOpen: "show",
  saidByYou: "You",
  saidByRondo: "rondo",
  emptyAsk: "What would you like to ask for?",
  emptyLead: "Write it in your own words. If anything is unclear, rondo asks before it starts.",
  sevenDays: "The last seven days",
  weekAsked: "Asked",
  weekFinished: "Finished",
  weekAnswered: "You answered",
  weekDecided: "rondo decided without asking",
  weekSpentFigure: "Spent",
  weekLeft: "Left of what was approved",
  weekThings: (count) => String(count),
  weekTimes: (count) => String(count),
  runningHeading: "Work under way",
  runningNone: "Nothing is being worked on.",
  runningNote: "All of this carries on without you. rondo asks only when it has to.",
  stepWork: "Work",
  stepChecks: "Automatic checks",
  stepReading: "Read again",
  stepApproval: "Your approval",
  stepPublish: "Pull request",
  stepLanding: "Merge",
  pullRequest: (number) => (number === null ? "the pull request" : `#${number}`),
  checksWord: (checks) =>
    ({ running: "running", green: "green", red: "red", none: "none reported" })[checks.kind],
  checksDetail: (checks) => {
    switch (checks.kind) {
      case "green":
        return checks.passed !== null && checks.skipped !== null
          ? checks.skipped === 0
            ? `all ${String(checks.passed)} passed`
            : `${String(checks.passed)} passed, ${String(checks.skipped)} skipped`
          : checks.counted === null
            ? "none failed"
            : `${String(checks.counted)} checks, none failed`;
      case "red": {
        // Each outcome under its own word (continuo D-1113): a cancelled or
        // timed-out check is not called a failure.
        const said = (
          [
            ["failed", checks.failed],
            ["cancelled", checks.cancelled],
            ["timed out", checks.timedOut],
          ] as const
        )
          .filter(([, names]) => names.length > 0)
          .map(
            ([word, names]) =>
              `${word}: ${names.slice(0, 3).join(", ")}${names.length > 3 ? ` and ${String(names.length - 3)} more` : ""}`,
          );
        return said.length === 0 ? null : said.join("; ");
      }
      case "none":
        return "the forge has reported no check yet";
      default:
        return "not finished yet";
    }
  },
  resultApproved: "Approved",
  resultNotPublished: "Not published yet: no pull request has been opened.",
  resultPublished: "Pull request opened:",
  resultChecks: "Checks",
  resultNotMerged: "Merging is yours: once the checks pass, you can merge it from this page.",
  resultMerged: (into, method) =>
    `Merged into ${into}${
      (
        {
          squash: " (squashed into one commit)",
          merge: " (with a merge commit)",
          rebase: " (rebased)",
        } as Record<string, string>
      )[method] ?? ""
    }`,
  rowApproved: "Approved, not published yet",
  rowPublished: (pullRequest, checks) => `Pull request ${pullRequest}, checks ${checks}`,
  basisKind: (form) =>
    ({
      iteration: "the work on this request",
      gateTransition: "a confirmation",
      continuoRun: "the run of the work",
      scope: "the agreed scope",
      proposal: "rondo's proposal",
      setup: "the setup",
      snapshot: "what was recorded at the time",
    })[form] ?? null,
  stepDone: "done",
  stepNow: "under way",
  stepAhead: "not yet",
  stepYours: "yours",
  sideMaterial: "What this rests on",
  sideKnownSoFar: "What is known so far",
  sideAgreed: "What was agreed for this",
  govTriesLabel: "Tries",
  govHeld: (pair, held, tries, inProgress) =>
    inProgress
      ? `${pair}, with $${held} held for ${tries === 1 ? "the try" : `the ${String(tries)} tries`} in progress`
      : `${pair}, with $${held} held for ${tries === 1 ? "a try" : `${String(tries)} tries`} whose cost is not known yet`,
  govByTryLabel: "Across all tries",
  govByTry: (total, tries) => `$${total} (${tries.join(", ")})`,
  govTryCost: (at, cost, running) =>
    `try ${String(at)} ${cost === null ? (running ? "in progress" : "cost not reported") : `$${cost}`}`,
  govTouchLabel: "Where it may touch",
  govStepsLabel: "What remains before this ends",
  govAct: (act) => (act === "open_pull_request" ? "open a pull request" : "push a branch"),
  govActs: (acts) => `rondo may ${acts.join(", ")}`,
  govActsNone: "rondo may put nothing outside this machine.",
  govDecided: (count) =>
    count === 1 ? "decided without asking: 1" : `decided without asking: ${String(count)}`,
  govDecidedNone: "Nothing about this was decided without asking you.",
  standingHeading: "What was raised",
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
  evFinished: "終わりました。",
  evApproved: (published) =>
    published
      ? "承認しました。"
      : "承認しました。まだ公開していません（プルリクエストはまだありません）。",
  evAskedChange: "変更を頼みました。次の回でやり直します。",
  evAskedChangeNoNextTry: "変更を頼みました。次の回は始まっていません。",
  evAnswerUnrecorded:
    "確認には答えていますが、承認か変更依頼か、記録がありません。そのため、プルリクエストは出しません。",
  evClosedUnapproved: "承認されないまま、確認が閉じました。",
  evPublished: "公開しました。プルリクエストを開きました:",
  evChecks: (pullRequest, word, detail) =>
    `${pullRequest} のチェック: ${word}${detail === null ? "" : `（${detail}）`}`,
  evStopped: "取りやめました。",
  evRefused: (said) => `断られたため、ここで止まりました: ${said}`,
  evBroke: "rondo 自身の不具合で止まりました。依頼のしかたに問題があったわけではありません。",
  evBrokeReason: "rondo が記録した内容（rondo を保守する人向け）",
  evChecksPassed: "自動チェックはすべて通りました。",
  evChecksFailed: "自動チェックが通りませんでした。",
  evReadingClear: "別の AI が変更を読み直し、指摘はありませんでした。",
  evReadingRaised: (findings) =>
    `別の AI が変更を読み直し、指摘を ${String(findings)} 件出しました。`,
  evReadingUnavailable: "別の AI は変更を読めませんでした。",
  foldTry: (said, lines) => `${said}（${String(lines)} 行）`,
  foldSeen: (lines) => `ここまでに読んだぶん ${String(lines)} 行`,
  foldOpen: "ひらく",
  saidByYou: "あなた",
  saidByRondo: "rondo",
  emptyAsk: "何を頼みますか",
  emptyLead: "ふだんの言葉で書いてください。はっきりしないところがあれば、始める前に聞き返します。",
  sevenDays: "この 7 日間",
  weekAsked: "頼んだ",
  weekFinished: "終わった",
  weekAnswered: "あなたが答えた",
  weekDecided: "rondo が聞かずに決めた",
  weekSpentFigure: "使った費用",
  weekLeft: "承認した枠の残り",
  weekThings: (count) => `${String(count)} 件`,
  weekTimes: (count) => `${String(count)} 回`,
  runningHeading: "進んでいる仕事",
  runningNone: "いま進んでいる仕事はありません。",
  runningNote: "どれも、あなたの返事がなくても進みます。必要になったときだけお知らせします。",
  stepWork: "作業",
  stepChecks: "自動チェック",
  stepReading: "読み直し",
  stepApproval: "あなたの承認",
  stepPublish: "プルリクエスト",
  stepLanding: "取り込み（マージ）",
  pullRequest: (number) => (number === null ? "プルリクエスト" : `#${number}`),
  checksWord: (checks) =>
    ({ running: "実行中", green: "緑", red: "赤", none: "報告なし" })[checks.kind],
  checksDetail: (checks) => {
    switch (checks.kind) {
      case "green":
        return checks.passed !== null && checks.skipped !== null
          ? checks.skipped === 0
            ? `${String(checks.passed)} 件すべて通過`
            : `${String(checks.passed)} 件通過、${String(checks.skipped)} 件スキップ`
          : checks.counted === null
            ? "失敗なし"
            : `${String(checks.counted)} 件、失敗なし`;
      case "red": {
        const said = (
          [
            ["失敗", checks.failed],
            ["キャンセル", checks.cancelled],
            ["タイムアウト", checks.timedOut],
          ] as const
        )
          .filter(([, names]) => names.length > 0)
          .map(
            ([word, names]) =>
              `${word}: ${names.slice(0, 3).join("、")}${names.length > 3 ? ` ほか ${String(names.length - 3)} 件` : ""}`,
          );
        return said.length === 0 ? null : said.join("／");
      }
      case "none":
        return "まだチェックが報告されていません";
      default:
        return "終わるのを待っています";
    }
  },
  resultApproved: "承認済み",
  resultNotPublished: "まだ公開していません（プルリクエストはありません）。",
  resultPublished: "プルリクエストを開きました:",
  resultChecks: "チェック",
  resultNotMerged: "マージはあなたが行います。チェックが通れば、このページからマージできます。",
  resultMerged: (into, method) =>
    `${into} にマージしました${
      (
        {
          squash: "（1 つのコミットにまとめて）",
          merge: "（マージコミットで）",
          rebase: "（リベースで）",
        } as Record<string, string>
      )[method] ?? ""
    }`,
  rowApproved: "承認済み・まだ公開していません",
  rowPublished: (pullRequest, checks) => `プルリクエスト ${pullRequest}・チェック ${checks}`,
  basisKind: (form) =>
    ({
      iteration: "この依頼の作業",
      gateTransition: "確認の記録",
      continuoRun: "作業の実行記録",
      scope: "取り決めた範囲",
      proposal: "rondo の提案",
      setup: "セットアップ",
      snapshot: "その時点の記録",
    })[form] ?? null,
  stepDone: "済み",
  stepNow: "進行中",
  stepAhead: "まだ",
  stepYours: "あなた",
  sideMaterial: "この確認の材料",
  sideKnownSoFar: "いまわかっていること",
  sideAgreed: "この依頼の取り決め",
  govTriesLabel: "やり直し",
  govHeld: (pair, held, tries, inProgress) =>
    inProgress
      ? `${pair} ・ 実行中の${tries === 1 ? "回" : ` ${String(tries)} 回`}のために $${held} を確保`
      : `${pair} ・ 費用がまだ分からない ${String(tries)} 回分として $${held} を確保`,
  govByTryLabel: "全回の合計",
  govByTry: (total, tries) => `$${total}（${tries.join(" ・ ")}）`,
  govTryCost: (at, cost, running) =>
    `${String(at)} 回目 ${cost === null ? (running ? "実行中" : "費用の報告なし") : `$${cost}`}`,
  govTouchLabel: "触れてよい範囲",
  govStepsLabel: "終わるまでの手順",
  govAct: (act) => (act === "open_pull_request" ? "プルリクエストを開く" : "ブランチを送る"),
  govActs: (acts) => `rondo は${acts.join("・")}ことができます`,
  govActsNone: "rondo はこの機械の外へ何も出しません。",
  govDecided: (count) => `聞かずに決めたこと ${String(count)} 件`,
  govDecidedNone: "この依頼について、聞かずに決めたことはありません。",
  standingHeading: "挙がっている点",
} satisfies PageWords);
