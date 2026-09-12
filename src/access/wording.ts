/**
 * rondo's own prose, one set per language tag (D-0055).
 *
 * **This is a message catalogue and not a translator** (rule 12). Nothing here
 * converts anything: two strings rondo authored exist and one is selected. The
 * `en` set is the literals that were spelled at the composition sites before
 * this entry, moved verbatim; the `ja` set is a second set of strings rondo
 * wrote. Material -- what a lap composed -- never reaches this file, and is
 * still quoted byte for byte wherever it is shown.
 *
 * **The line is drawn at the span and never at the string literal** (rule 3).
 * A token inside a sentence stays the token, in its own bytes, in the middle of
 * a translated sentence: `rondo inbox`, `RONDO_APPROVER`, `approve`, a status,
 * a gate id and an iteration id are ASCII in both sets. That is why almost
 * every entry below is a function over the tokens it frames rather than a
 * finished line -- a sentence with a hole in it can be rewritten in another
 * language, and a sentence spelled around an interpolation cannot.
 *
 * **A missing string is the English one** (rule 9). A set is a `Partial` merged
 * over `en`, so a screen added with `en` wording only renders English inside an
 * otherwise Japanese page rather than blocking on a translation. That is the
 * cost this takes knowingly: the prose grows with every screen, and the
 * alternative is a rule that says nothing ships untranslated and is broken the
 * first time it is inconvenient.
 *
 * **What is recorded is not here** (rule 4). The claim labels and values a
 * press writes to the ledger are composed in `src/advisory/proposal.ts` and
 * stay English whatever they read like, because a recorded string rondo could
 * have written two ways is a ledger holding two versions of one claim. So the
 * page's own sentences are in this file and the payload's are not, and the
 * bytes a press stores do not depend on the host's language.
 *
 * **The terminal is not a caller of the selection** (rule 10). `inboxLines` and
 * the fence block serve both the page and the console, and the console's
 * strings go through D-0004's ASCII escape, which has no CJK substitutes. So
 * the set is an *argument* to composition rather than a lookup inside it, and
 * the command line passes {@link EN} until D-0004's scope is a decision
 * somebody takes.
 */

import { isLanguageTag } from "../refrain/plan.js";

/**
 * Every sentence rondo composes for the operator to read, keyed by string.
 *
 * `lang` is the one member that is not prose: it is the tag the rest of the set
 * is actually written in, which is what `<html lang>` declares (rule 7). rondo
 * declares what it wrote and never what was asked for, so a well-formed tag
 * this file ships no set for yields the `en` set and the tag `en`.
 */
export interface Chrome {
  /** The tag this set is written in, which is what the document declares. */
  readonly lang: string;

  // -- The page's two standing notes (src/access/web.ts) --
  readonly liveNote: (seconds: number) => string;
  readonly stillNote: string;
  readonly noApproverNote: string;

  // -- The three questions the lead answers --
  readonly waitingHeading: (count: number) => string;
  readonly runningHeading: (count: number) => string;
  readonly endedHeading: (count: number) => string;
  readonly waitingHead: (status: string, waited: string) => string;
  readonly runningHead: (status: string, ran: string) => string;
  readonly endedHead: (status: string, since: string, why: string) => string;
  readonly gateAnswered: (outcome: string) => string;
  readonly noReasonRecorded: string;
  readonly proposalBasis: (proposalId: string) => string;
  readonly proposalHead: (kind: string, waited: string) => string;
  readonly aboutIteration: (iterationId: string | null) => string;
  readonly willNotDecode: (reason: string) => string;

  // -- What a lap spent, and what its fence refused --
  readonly spent: (cost: string, turns: string, took: string) => string;
  readonly costRead: (usd: string) => string;
  readonly costNotRead: string;
  readonly turnsRead: (turns: number) => string;
  readonly turnsNotRead: string;
  readonly durationNotRead: string;
  readonly fenceUnknown: string;
  readonly fenceRefusedNothing: string;
  readonly fenceRefused: (denials: string) => string;

  // -- An idle ledger --
  readonly nothingAtAll: string;
  readonly nothingBasis: string;

  // -- The button, and the way to it --
  readonly pressNote: string;
  readonly approveNote: (gateId: string, word: string) => string;
  readonly answerHere: string;

  // -- The fold, and the sections inside it --
  readonly openReading: string;
  readonly hideReading: string;
  readonly inboxHeading: string;
  readonly inboxNote: string;
  readonly inboxNoApprover: string;
  readonly betweenHeading: string;
  readonly betweenNote: string;
  readonly iterationHeading: (iterationId: string) => string;
  readonly explainNote: string;

  // -- The inbox's own lines (src/access/inbox.ts), page and terminal alike --
  readonly inboxFor: (actorId: string) => string;
  readonly waitingOnYou: string;
  readonly bindingProposals: (count: number) => string;
  readonly nonBindingProposals: (count: number) => string;
  readonly readOneBack: string;
  readonly iterationsWaiting: (count: number) => string;
  readonly newMark: string;
  readonly proposalLine: (
    proposalId: string,
    kind: string,
    about: string,
    waited: string,
  ) => string;
  readonly waitingLine: (
    iterationId: string,
    status: string,
    waited: string,
    unblockedBy: string,
  ) => string;
  readonly inFlightHeading: (count: number) => string;
  readonly inFlightLine: (
    iterationId: string,
    status: string,
    since: string,
    where: string,
  ) => string;
  readonly unreadableLine: (id: string, reason: string) => string;
  readonly changedHeading: (since: string, records: number) => string;
  readonly changedHeadingNever: string;
  readonly neverLooked: string;
  readonly nothingChanged: string;
  readonly censusEntry: (kind: string, count: number) => string;
  readonly changeLine: (kind: string, id: string | null, since: string) => string;
  readonly noId: string;
  readonly silenceHeading: string;
  readonly countedLine: (what: string, presented: number, withheld: number) => string;
  readonly overAllTime: string;
  readonly sinceLastLook: (since: string) => string;
  readonly neverLookedSince: string;
  readonly withheldBy: (ruleName: string, count: number) => string;
  readonly unnamedRule: string;
  readonly unspentHeading: (count: number) => string;
  readonly unspentLine: (
    decisionId: string,
    proposalId: string,
    approved: string,
    actorId: string,
    since: string,
  ) => string;

  // -- What releases a waiting row, and where a running one writes --
  readonly noGateDecide: string;
  readonly noGateReleases: (gateId: string) => string;
  readonly suspendedNoGate: string;
  readonly answerGate: (gateId: string) => string;
  readonly runsIn: (transcript: string, workspace: string) => string;
  readonly noWorkspace: string;
  readonly transcriptNotLookedFor: string;
  readonly transcriptNotNamed: (reason: string) => string;
  readonly transcriptAt: (directory: string, sessions: number) => string;

  // -- The fence block's two standing pieces (rule 11, src/access/cli.ts) --
  /**
   * *"This is the run's own declaration, not the whole fence"*.
   *
   * The declaration is not the fence, and saying so is the whole point of that
   * screen: continuo renders the role's own template into the same
   * `permissions.allow` -- on a worker that is six `git` specs rondo never
   * declared and cannot see from here. A list headed "allowed to run" would
   * have been rondo asserting a fence it did not read, which is the habit that
   * block exists to break.
   */
  readonly declarationCaveat: readonly string[];
  /**
   * The containment rondo does not observe, said on every lap and derived from
   * nothing (`D-0050` rules 3 and 4).
   *
   * **Why the worker's sandbox reaches neither half of that block.** It fails
   * *open*: the call runs, with weaker containment than it was meant to have,
   * and nothing is refused. So it cannot appear in `permission_denials`, which
   * records calls the fence turned *down* -- the field's own shape says so,
   * every entry carrying a `tool_name` and the `tool_input` of a call that did
   * not happen -- and it is not in the declaration either, because the
   * declaration is a list of subjects and this is not about a subject. N-16
   * (`docs/operations/lap-6-dogfood.md`) measured the consequence: a lap whose
   * first Bash call left the sandbox disabled for four more, printing there as
   * a clean run. Only the worker's own paragraph at the gate said otherwise.
   *
   * **Why a constant and not a line of `provenance`.** The caveat beside it --
   * {@link declarationCaveat} -- is composed on the paths where the delegation
   * record was actually read, so a lap whose continuo could not be reached
   * prints none of it. This sentence has to survive all of those, and it must
   * survive them for a reason rather than by luck: it is a claim about
   * **rondo's record**, which rondo is the authority on, and not about this
   * lap, which rondo has nothing to suspect with (`D-0050` rule 4). A sentence
   * printed only when rondo suspected something would be the second kind. Held
   * here so that "it is not derived from the lap" is a property of one entry
   * rather than of every branch above it.
   *
   * **D-0050 rule 4's argument is for its unconditionality and not for its
   * language** (D-0055 rule 11). It is printed on every lap and derived from
   * nothing, in whatever language rondo wrote it -- and `D-0053` rule 3's
   * inference, that a claim about the record is therefore a claim nobody has to
   * read, is what D-0055 reverses by name.
   *
   * **It does not report that a lap failed open.** It reports that the screen
   * cannot tell, and says where the only account of it has ever been
   * (`D-0050` rule 5b: the gate's own `rationale`, which the same commands
   * print).
   */
  readonly secondFence: readonly string[];
}

/**
 * The strings as they were before D-0055, moved and not rewritten.
 *
 * This is also the fallback every other set is merged over, and the set the
 * terminal is handed unconditionally (rule 10).
 */
export const EN: Chrome = Object.freeze({
  lang: "en",

  liveNote: (seconds) =>
    `Redraws every ${String(seconds)}s, and a redraw writes nothing: no last-look
mark moves and no presentation is counted. The one thing that writes is the approve button, which
records the explanation you pressed on and then answers the gate.`,
  stillNote: `This view does not update itself: what a press records is the framing you are
reading, so it holds still while you read it. Reading it writes nothing -- no last-look mark moves
and no presentation is counted. The one thing that writes is the approve button, which records the
explanation you pressed on and then answers the gate.`,
  noApproverNote:
    "RONDO_APPROVER is not set, so there is nobody this page could answer as, and no inbox of " +
    "theirs to draw.",

  waitingHeading: (count) => `waiting for your answer (${String(count)})`,
  runningHeading: (count) => `running now (${String(count)})`,
  endedHeading: (count) => `just finished (${String(count)})`,
  waitingHead: (status, waited) => `${status} -- waiting ${waited}`,
  runningHead: (status, ran) => `${status} -- running ${ran}`,
  endedHead: (status, since, why) => `${status} ${since} ago -- ${why}`,
  gateAnswered: (outcome) => `gate answered '${outcome}'`,
  noReasonRecorded: "no reason recorded",
  proposalBasis: (proposalId) =>
    `read it back with its options and what each rests on: rondo show --proposal-id ${proposalId}`,
  proposalHead: (kind, waited) => `${kind} -- waiting ${waited}`,
  aboutIteration: (iterationId) =>
    iterationId === null ? "about no iteration" : `about '${iterationId}'`,
  willNotDecode: (reason) => `will not decode: ${reason}`,

  spent: (cost, turns, took) => `${cost}, ${turns}, ${took}`,
  costRead: (usd) => `cost $${usd}`,
  costNotRead: "cost not read",
  turnsRead: (turns) => `${String(turns)} turns`,
  turnsNotRead: "turns not read",
  durationNotRead: "duration not read",
  fenceUnknown: "the fence: continuo could not tell what it refused",
  fenceRefusedNothing: "the fence refused nothing",
  fenceRefused: (denials) => `the fence refused ${denials}`,

  nothingAtAll: "Nothing is waiting on you, nothing is running, and nothing has finished.",
  nothingBasis:
    "every live row and every ended row in this ledger; the reading below cites what each read " +
    "found",

  pressNote: "What pressing approve records as shown, and what it would be over:",
  approveNote: (gateId, word) =>
    `answers gate ${gateId} as '${word}', which is what rondo answer does`,
  answerHere: "read what a press would record, and answer there",

  openReading: "the reading these rest on: every claim with its basis, and rondo's own accounting",
  hideReading: "hide the reading",
  inboxHeading: "the inbox",
  inboxNote: "Reading this does not move your last-look mark: that is what rondo inbox does.",
  inboxNoApprover: "RONDO_APPROVER is not set, so there is no identity whose inbox this would be.",
  betweenHeading: "what spans the live laps",
  betweenNote:
    "An adjacency is not a collision: two laps open against one base branch is where to look, " +
    "not what was found.",
  iterationHeading: (iterationId) => `iteration '${iterationId}'`,
  explainNote: "This explanation binds nothing: it is not a proposal and cannot be approved.",

  inboxFor: (actorId) => `inbox for '${actorId}'`,
  waitingOnYou: "waiting on you",
  bindingProposals: (count) =>
    `  proposals that become contracts when you approve them (${String(count)})`,
  nonBindingProposals: (count) => `  proposals that bind nothing (${String(count)})`,
  readOneBack:
    "    read one back, with its options and what each rests on: rondo show --proposal-id ID",
  iterationsWaiting: (count) => `  iterations waiting on you (${String(count)})`,
  newMark: "  NEW",
  proposalLine: (proposalId, kind, about, waited) =>
    `    ${proposalId}  ${kind}  ${about}  waiting ${waited}`,
  waitingLine: (iterationId, status, waited, unblockedBy) =>
    `    ${iterationId}  ${status}  ${waited}  ${unblockedBy}`,
  inFlightHeading: (count) => `in flight (${String(count)})`,
  inFlightLine: (iterationId, status, since, where) =>
    `  ${iterationId}  ${status}  ${since}  ${where}`,
  unreadableLine: (id, reason) => `  ${id}  will not decode: ${reason}`,
  changedHeading: (since, records) =>
    `since your last look ${since} ago (${String(records)} records)`,
  changedHeadingNever: "since your last look",
  neverLooked: "  you have never looked: nothing below is marked new",
  nothingChanged: "  nothing",
  censusEntry: (kind, count) => `${kind} ${String(count)}`,
  changeLine: (kind, id, since) => `    ${kind}  ${id ?? "(no id)"}  ${since} ago`,
  noId: "(no id)",
  silenceHeading: "what was put to you and what was not",
  countedLine: (what, presented, withheld) =>
    `${what}: presented ${String(presented)}, withheld ${String(withheld)}`,
  overAllTime: "over all of time",
  sinceLastLook: (since) => `since your last look ${since} ago`,
  neverLookedSince: "  since your last look: you have never looked",
  withheldBy: (ruleName, count) => `withheld by '${ruleName}' ${String(count)}`,
  unnamedRule: "(unnamed)",
  unspentHeading: (count) => `approved and never spent (${String(count)})`,
  unspentLine: (decisionId, proposalId, approved, actorId, since) =>
    `  ${decisionId}  proposal ${proposalId}  ${approved}  by '${actorId}' ${since} ago`,

  noGateDecide: "no gate: a person has to decide",
  noGateReleases: (gateId) =>
    `no gate answer releases this (stopped at ${gateId}): a person has to decide`,
  suspendedNoGate: "suspended with no gate id recorded: rondo cannot name the gate",
  answerGate: (gateId) => `answer gate ${gateId}`,
  runsIn: (transcript, workspace) => `${transcript}  in ${workspace}`,
  noWorkspace: "(no workspace on the row)",
  transcriptNotLookedFor: "transcript (not looked for on a row that has not started one)",
  transcriptNotNamed: (reason) => `transcript (not named: ${reason})`,
  transcriptAt: (directory, sessions) =>
    `transcript ${directory}${sessions > 1 ? `  (newest of ${String(sessions)} sessions)` : ""}`,

  declarationCaveat: Object.freeze([
    "This is the run's own declaration, not the whole fence: continuo renders the",
    "role's template into the same allow list, and rondo does not read that here.",
  ]),
  secondFence: Object.freeze([
    "The worker's own sandbox is a second containment, and rondo does not observe",
    "it: it can fail to start without refusing anything, so a lap that ran with it",
    "disabled prints here exactly like one that did not. The worker's own account",
    "at the gate is the only place that has ever reported it (D-0050).",
  ]),
} satisfies Chrome);

/**
 * Japanese, because it is the language of the operator who raised rondo#155 and
 * rondo#166.
 *
 * **Every token is the same bytes it is in {@link EN}.** `RONDO_APPROVER`,
 * `rondo inbox`, `rondo answer`, `rondo show --proposal-id ID`, `approve`, a
 * status, a record kind, a gate id, a proposal id and an iteration id are
 * things the operator types or matches against the store, `rondo show` and
 * continuo's own output (rule 2), so they sit in these sentences untranslated,
 * unglossed and without a parenthesis. What is rewritten is the prose around
 * them.
 *
 * The indentation of the inbox's lines is `en`'s, to the space: those lines are
 * read as a column in a `<pre>`, and a set that re-decided the leading spaces
 * would make the two languages two layouts.
 */
const JA: Partial<Chrome> = Object.freeze({
  lang: "ja",

  liveNote: (seconds) =>
    `${String(seconds)}秒ごとに描き直しますが、描き直しは何も書き込みません。最後に見た印は動かず、
提示も数えられません。書き込むのは approve ボタンだけで、押した時点の説明を記録してからゲートに
答えます。`,
  stillNote: `この画面は自分では更新しません。押したときに記録されるのはいま読んでいるこの内容なので、
読んでいるあいだ動きません。読むこと自体は何も書き込みません -- 最後に見た印は動かず、提示も
数えられません。書き込むのは approve ボタンだけで、押した時点の説明を記録してからゲートに答えます。`,
  noApproverNote:
    "RONDO_APPROVER が設定されていないので、このページが誰として答えることもできず、" +
    "その人の inbox も描けません。",

  waitingHeading: (count) => `あなたの答えを待っているもの (${String(count)})`,
  runningHeading: (count) => `いま動いているもの (${String(count)})`,
  endedHeading: (count) => `ちょうど終わったもの (${String(count)})`,
  waitingHead: (status, waited) => `${status} -- ${waited} 待機中`,
  runningHead: (status, ran) => `${status} -- ${ran} 実行中`,
  endedHead: (status, since, why) => `${status} ${since}前 -- ${why}`,
  gateAnswered: (outcome) => `ゲートに '${outcome}' と答えた`,
  noReasonRecorded: "理由は記録されていない",
  proposalBasis: (proposalId) =>
    `選択肢と各々の根拠つきで読み直す: rondo show --proposal-id ${proposalId}`,
  proposalHead: (kind, waited) => `${kind} -- ${waited} 待機中`,
  aboutIteration: (iterationId) =>
    iterationId === null ? "どの iteration についてでもない" : `'${iterationId}' について`,
  willNotDecode: (reason) => `読み取れません: ${reason}`,

  spent: (cost, turns, took) => `${cost}、${turns}、${took}`,
  costRead: (usd) => `費用 $${usd}`,
  costNotRead: "費用は読めていない",
  turnsRead: (turns) => `${String(turns)} ターン`,
  turnsNotRead: "ターン数は読めていない",
  durationNotRead: "所要時間は読めていない",
  fenceUnknown: "fence: continuo は何を拒否したか答えられませんでした",
  fenceRefusedNothing: "fence は何も拒否しませんでした",
  fenceRefused: (denials) => `fence が拒否したもの: ${denials}`,

  nothingAtAll: "あなたを待っているものも、動いているものも、終わったものもありません。",
  nothingBasis:
    "この台帳の live な行と終了した行のすべて。下の読み下しが、それぞれの読み取りで何が見つかったかを示します",

  pressNote: "approve を押すと「提示された」として記録される内容と、その対象:",
  approveNote: (gateId, word) =>
    `ゲート ${gateId} に '${word}' と答えます。rondo answer と同じ動作です`,
  answerHere: "押したときに何が記録されるかを読み、そこで答える",

  openReading: "これらが立っている読み下し: 根拠つきのすべての claim と、rondo 自身の会計",
  hideReading: "読み下しを閉じる",
  inboxHeading: "inbox",
  inboxNote: "ここを読んでも最後に見た印は動きません。印を動かすのは rondo inbox です。",
  inboxNoApprover: "RONDO_APPROVER が設定されていないので、誰の inbox かを決められません。",
  betweenHeading: "live な lap にまたがっているもの",
  betweenNote:
    "隣接は衝突ではありません。ひとつの base branch に対して 2 つの lap が開いているというのは、" +
    "見るべき場所であって、見つかった事実ではありません。",
  iterationHeading: (iterationId) => `iteration '${iterationId}'`,
  explainNote: "この説明は何も拘束しません。proposal ではないので、承認することもできません。",

  inboxFor: (actorId) => `'${actorId}' の inbox`,
  waitingOnYou: "あなたを待っているもの",
  bindingProposals: (count) => `  承認すると契約になる proposal (${String(count)})`,
  nonBindingProposals: (count) => `  何も拘束しない proposal (${String(count)})`,
  readOneBack: "    選択肢と各々の根拠つきで 1 件読み直す: rondo show --proposal-id ID",
  iterationsWaiting: (count) => `  あなたを待っている iteration (${String(count)})`,
  newMark: "  NEW",
  proposalLine: (proposalId, kind, about, waited) =>
    `    ${proposalId}  ${kind}  ${about}  ${waited} 待機中`,
  waitingLine: (iterationId, status, waited, unblockedBy) =>
    `    ${iterationId}  ${status}  ${waited}  ${unblockedBy}`,
  inFlightHeading: (count) => `実行中 (${String(count)})`,
  inFlightLine: (iterationId, status, since, where) =>
    `  ${iterationId}  ${status}  ${since}  ${where}`,
  unreadableLine: (id, reason) => `  ${id}  読み取れません: ${reason}`,
  changedHeading: (since, records) =>
    `最後に見てから ${since}前 に変わったもの (${String(records)} 件)`,
  changedHeadingNever: "最後に見てから",
  neverLooked: "  まだ一度も見ていません: 以下に new の印は付きません",
  nothingChanged: "  なし",
  censusEntry: (kind, count) => `${kind} ${String(count)}`,
  changeLine: (kind, id, since) => `    ${kind}  ${id ?? "(id なし)"}  ${since}前`,
  noId: "(id なし)",
  silenceHeading: "あなたに示されたものと、示されなかったもの",
  countedLine: (what, presented, withheld) =>
    `${what}: 提示 ${String(presented)}、留保 ${String(withheld)}`,
  overAllTime: "全期間",
  sinceLastLook: (since) => `最後に見た ${since}前 から`,
  neverLookedSince: "  最後に見てから: まだ一度も見ていません",
  withheldBy: (ruleName, count) => `'${ruleName}' により留保 ${String(count)}`,
  unnamedRule: "(名前なし)",
  unspentHeading: (count) => `承認されたまま使われていないもの (${String(count)})`,
  unspentLine: (decisionId, proposalId, approved, actorId, since) =>
    `  ${decisionId}  proposal ${proposalId}  ${approved}  '${actorId}' が ${since}前 に`,

  noGateDecide: "ゲートはありません: 人が判断する必要があります",
  noGateReleases: (gateId) =>
    `ゲートに答えても解除されません (${gateId} で停止): 人が判断する必要があります`,
  suspendedNoGate: "gate id が記録されないまま中断されたので、rondo はゲートを名指しできません",
  answerGate: (gateId) => `ゲート ${gateId} に答える`,
  runsIn: (transcript, workspace) => `${transcript}  場所は ${workspace}`,
  noWorkspace: "(行に workspace がありません)",
  transcriptNotLookedFor: "transcript (まだ開始していない行なので探していません)",
  transcriptNotNamed: (reason) => `transcript (名指しできません: ${reason})`,
  transcriptAt: (directory, sessions) =>
    `transcript ${directory}${sessions > 1 ? `  (${String(sessions)} セッション中の最新)` : ""}`,

  declarationCaveat: Object.freeze([
    "これは run 自身の declaration であって fence の全体ではありません。continuo は",
    "role のテンプレートを同じ allow リストへ展開しますが、rondo はここでそれを読みません。",
  ]),
  secondFence: Object.freeze([
    "worker 自身の sandbox は第二の封じ込めですが、rondo はそれを観測しません。何も拒否",
    "しないまま起動に失敗しうるので、sandbox が無効なまま走った lap もそうでない lap と",
    "まったく同じように表示されます。それを報告したことがあるのは、ゲートに置かれた",
    "worker 自身の記述だけです (D-0050)。",
  ]),
} satisfies Partial<Chrome>);

/**
 * The sets this tree ships, by the tag they are written in.
 *
 * **`en` is a member, and that is `D-0056` rule 8.** It is still the fallback
 * every set is merged over -- its entry overrides nothing -- but it has to be
 * reachable *by name* as well, or a `ja` host, a `ja` memory or a `ja` browser
 * would be a one-way door and the switch of rule 10 would need a special case
 * for going back. So `en` names the English set and a tag nobody wrote a set
 * for names none, which are two different answers here even though they render
 * the same document: one is a step of rule 2 answering and the other is a step
 * saying nothing.
 *
 * There is still no registry and no negotiation. What replaced the exact match
 * is lookup and nothing else ({@link setFor}).
 */
const SETS: ReadonlyMap<string, Partial<Chrome>> = new Map([
  ["en", {}],
  ["ja", JA],
]);

/**
 * Every set this tree ships, named in its own language.
 *
 * **The label is the language's own name, which is what makes it the same bytes
 * in every set** (`D-0056` rule 10): `English` reads as `English` on a Japanese
 * page and `日本語` reads as `日本語` on an English one, so the switch is a
 * list of names rather than an entry in {@link Chrome} that each set would
 * translate into a word its reader cannot use. Not prose, and so not a member
 * of the catalogue at all.
 */
export const SHIPPED_SETS: ReadonlyMap<string, string> = new Map([
  ["en", "English"],
  ["ja", "日本語"],
]);

/**
 * The set a tag reaches by BCP 47 lookup, or null when no set does.
 *
 * **RFC 4647 section 3.4, and the whole of `D-0056` rule 6's algorithm.**
 * Truncate the tag at its last hyphen and try again until a set matches, and
 * **truncate once more whenever that leaves a trailing single-character
 * subtag** -- so `ja-x-private` reaches `ja` and never stops at a bare `ja-x`,
 * which is the RFC's own worked example (`zh-Hant-CN-x-private1-private2`
 * reaching `zh`) and the one step of it that is easy to write backwards. No
 * basic filtering, no alternatives list, no best-fit.
 *
 * **Null is a step of rule 2 saying nothing, and is why this is not
 * {@link chromeFor}.** A well-formed tag this tree ships no set for has to let
 * the *next* step answer rather than resolve to English itself, or the host's
 * variable saying `de` would silence the browser's list. English is the floor
 * of the resolution and not the answer of every step in it.
 *
 * **Ill-formed asks resolve to nothing, and the grammar is checked before the
 * truncation rather than after it** (D-0056 rule 9). Truncation is what makes
 * this the wrong way round if it is skipped: `ja-!!` and `ja-` each reach `ja`
 * by cutting at a hyphen, so a syntax error would *resolve* -- and, being a
 * language the other steps would not have answered, would write rule 5's
 * memory. Rule 9 says an ill-formed `lang` resolves to nothing and does not
 * overwrite the memory, so the check is here, where every step of rule 2 passes
 * through it. The grammar is `src/refrain/plan.ts`'s, shared rather than
 * restated, which is the grammar D-0056 cites when it says rule 9's
 * unknown-tag case is about a well-formed tag rondo ships no set for and not
 * about a syntax error.
 */
export function setFor(tag: string | null): Chrome | null {
  if (tag === null || !isLanguageTag(tag)) {
    return null;
  }
  let candidate = tag.toLowerCase();
  for (;;) {
    const set = SETS.get(candidate);
    if (set !== undefined) {
      return Object.freeze({ ...EN, ...set });
    }
    const cut = candidate.lastIndexOf("-");
    if (cut === -1) {
      return null;
    }
    candidate = candidate.slice(0, cut);
    // The step above leaves `ja-x` from `ja-x-private`; a single-character
    // subtag is a singleton and never a set anybody wrote, so the RFC drops it
    // together with the subtag that introduced it.
    if (/-.$/.test(candidate)) {
      candidate = candidate.slice(0, candidate.lastIndexOf("-"));
    }
  }
}

/**
 * The wording one tag reaches, with English as the last stop.
 *
 * {@link setFor} with `D-0056` rule 2's floor applied -- which is the whole
 * resolution for a caller that has one tag and no further steps to fall to.
 *
 * **`lang` comes back naming what was selected and never what was asked**
 * (`D-0055` rule 7). A well-formed tag this tree ships no set for yields `en`
 * and the document then declares `en`, because that is what the document is:
 * rondo does not declare an intention as a fact. A set that is only half
 * written is still that set's tag -- the English strings inside it are the
 * fallback rule 9 makes shippable on purpose, and not a different document.
 */
export function chromeFor(tag: string | null): Chrome {
  return setFor(tag) ?? EN;
}
