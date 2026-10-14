/**
 * The Japanese set of rondo's own prose, a whole {@link Chrome} (D-0079). The
 * type and the selection among sets are in `src/access/wording.ts`.
 */

import { APPROVED_OUTCOME } from "../../store/records.js";
import type { GateAuto, GateAutoReason } from "../gate-auto.js";
import { EXPLAIN_JA } from "../page/explain-words.js";
import { REFUSAL_JA } from "../page/refusal-words.js";
import { REPORT_JA } from "../page/report-words.js";
import { SINCE_JA } from "../page/since-words.js";
import { TRIAGE_SOURCE_JA } from "../page/triage-words.js";
import { PAGE_JA } from "../page/words.js";
import type { AgentTypeSource, Chrome } from "../wording.js";

/** The same three, as the {@link JA} set says them. */
function agentTypeSourceJa(from: AgentTypeSource): string {
  switch (from) {
    case "iteration":
      return "前の回の計画";
    case "scope":
      return "承認した範囲の記録";
    default:
      return "いま承認する計画";
  }
}

/** A finding's severity as the {@link JA} set names it, wherever it names one. */
function severityJa(severity: string): string {
  return { blocker: "致命的", major: "重大", minor: "軽微", nit: "細かい点" }[severity] ?? severity;
}

/** One reason a gate goes to the person, as the {@link JA} set says it (D-0125). */
function gateAutoReasonJa(reason: GateAutoReason): string {
  switch (reason.kind) {
    case "no_scope":
      return "この作業を含む承認済みの範囲がありません";
    case "scope_declined":
      return "範囲が承認されていません";
    case "scope_superseded":
      return "新しい範囲が設定されました";
    case "scope_expired":
      return "範囲の期限が切れています";
    case "checks_not_clear":
      return "チェックが通っていません";
    case "model_pending":
      return "レビューがまだ届いていません";
    case "model_unavailable":
      return "レビューを受け取れませんでした";
    case "model_ungraded":
      return "レビューの重大度が読み取れません";
    case "model_raised":
      return `${reason.counts
        .map(({ severity, count }) => `${severityJa(severity)} ${String(count)} 件`)
        .join("と")}の指摘`;
    case "tests_unread":
      return "rondo が読み取れるテスト実行がありません";
    case "tests_failed":
      return `テストが ${String(reason.failed)} 件失敗しています`;
    case "tests_errored":
      return "テストのコマンドがエラーで終わっています";
    case "repair_not_reproduced":
      return "失敗したテストを直す回ですが、テストが失敗してから通るようになった記録がありません";
    case "tests_all_skipped":
      return "最後の実行ではテストがすべてスキップされ、何も確認できていません";
    case "question_open":
      return "回答が必要な質問があります";
    case "closing_lap":
      return "残った軽微な指摘を直す";
  }
}

function gateAutoJa(auto: GateAuto): string {
  return auto.kind === "would_not_approve"
    ? `自動では承認しない理由: ${auto.reasons.map(gateAutoReasonJa).join("。")}。`
    : "自動承認の条件をすべて満たしています。";
}

/** The lap a change starts, by its number in the line where it was read. */
function lapJa(next: number | null): string {
  return next === null ? "次の回" : `${String(next)} 回目`;
}

function scopeTestJa(test: string): string {
  switch (test) {
    case "decision":
      return "範囲がまだ承認されていません";
    case "superseded":
      return "この範囲は新しい範囲に置き換わっています";
    case "request":
      return "この依頼は、この範囲に含まれていません";
    case "workspace":
      return "作業場所が、承認した範囲に入っていません";
    case "agent_type":
      return "この作業に使うワーカーの種類が、承認した範囲に入っていません";
    case "contract":
      return "この作業には、このワーカーの種類に許されている以上の権限が必要です";
    case "irreversible":
      return "承認した範囲が、この作業の開始を取り返しのつかない行為として禁じています";
    case "expiry":
      return "範囲の期限が切れています";
    case "laps":
      return "承認した回数を使い切っています";
    case "cost":
      return "もう 1 回分の費用が、承認した予算に収まりません";
    case "asks":
      return "依頼のスレッドに、まだ回答していない質問があります";
    case "grants":
      return "次の回では、ワーカーに許すことが前の回より増えます";
    case "readings":
      return "範囲のレビュー回数を使い切っています";
    default:
      return `範囲の ${test} の判定が通りません`;
  }
}

function filesJa(paths: readonly string[]): string {
  return paths.includes("/") ? "リポジトリ全体" : paths.join("、");
}

/** The same count, as the {@link JA} set says it. */
function raisedJa(blockers: number, majors: number): string {
  return [
    blockers === 0 ? "" : `致命的 ${String(blockers)} 件`,
    majors === 0 ? "" : `重大 ${String(majors)} 件`,
  ]
    .filter((part) => part !== "")
    .join("、");
}

/** The three measurements a basis names, in the Japanese set's words. */
/** A lap's state, as the row's pill says it; `closed` is the pill's own, by its gate outcome. */
const STATE_WORDS: Record<string, string | undefined> = {
  awaiting_human: "あなたの回答待ち",
  withdrawal_requested: "取り下げ依頼中",
  stalled: "停止中",
  planned: "開始中",
  classified: "開始中",
  admitting: "開始中",
  admitted: "開始中",
  performing: "実行中",
  abandoned: "放棄",
  failed: "失敗",
};

/** How a gate closed without a person's answer (`records.ts`, `APPROVED_OUTCOME`'s three others). */
const GATE_OUTCOME_WORDS: Record<string, string | undefined> = {
  withdrawn: "取り下げ",
  expired: "期限切れ",
  unanswerable: "回答できないまま",
};

/** The plan's keys a publish is built from, in the words the publish screen uses. */
const PLAN_FIELD_WORDS: Record<string, string | undefined> = {
  workspace: "作業場所",
  topic_branch: "作業ブランチ",
  base_branch: "取り込み先ブランチ",
};

/** `（…）` around a known word, and nothing for a value only rondo's internals spell. */
function bracketed(word: string | undefined, say: (word: string) => string): string {
  return word === undefined ? "" : `（${say(word)}）`;
}

const JA_MEASURE: Record<string, string> = {
  first_lap_cost: "1 回目の費用",
  redo_cost: "やり直しの回の費用",
  lap_duration: "1 回の所要時間",
};

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
export const JA: Chrome = Object.freeze({
  ...PAGE_JA,
  ...EXPLAIN_JA,
  ...SINCE_JA,
  ...REFUSAL_JA,
  ...REPORT_JA,
  ...TRIAGE_SOURCE_JA,
  lang: "ja",

  liveNote: () => "",
  stillNote: "",
  noApproverNote:
    "承認する人がまだ決まっていないため、このページからは承認も作業の開始もできません。下に名前を入れると使えるようになります。",

  // rondo#439: the status in the person's words, one line and no ` -- `.
  endedHead: (status, since, why) =>
    `${since}前に${({ closed: "終了", failed: "失敗", abandoned: "放棄" } as Record<string, string | undefined>)[status] ?? status}・${why}`,
  gateAnswered: (outcome) =>
    outcome === APPROVED_OUTCOME ? "確認で承認された" : `確認に「${outcome}」と回答した`,
  statePill: (status, gateOutcome) =>
    (
      ({
        ...STATE_WORDS,
        closed:
          gateOutcome === "approve" || gateOutcome === APPROVED_OUTCOME
            ? "承認済み"
            : gateOutcome === "revise"
              ? "変更依頼"
              : gateOutcome === null
                ? "完了"
                : `完了: ${gateOutcome}`,
      }) as Record<string, string | undefined>
    )[status] ?? status,
  noReasonRecorded: "理由は記録されていない",
  aboutIteration: (iterationId) =>
    iterationId === null ? "対象の回なし" : `'${iterationId}' について`,
  willNotDecode: (reason) => `読み取れません: ${reason}`,

  spent: (cost, turns, took) => `${cost}、${turns}、${took}`,
  fenceUnknown: "",
  fenceRefusedNothing: "",
  fenceRefused: () => "",

  pressNote: "「承認する」を押すと、承認と一緒に次の内容が記録されます。",
  approveNote: () => "",

  asksWaiting: (count) => `あなたへの質問 ${String(count)}`,
  askWaitingPill: "あなたの回答待ち",
  askStoppedPill: "あなたが止めた作業",
  answerStoppedPill: "この作業を止めた",
  answerCarriedOnPill: "続けた",
  answerChosePill: (option) => `${String(option)} を選んだ`,
  askedChangePill: "変更を頼んだ",
  reviseWaitsOnQuestion:
    "ワーカーの質問に回答するまで、変更を依頼できません。" + "回答内容は記録されます。",
  reviseWaitsLink: "質問へ",
  reviseWaitsOnStopped:
    "ワーカーの質問に「この作業を止める」と回答済みです。新たに依頼する場合、" +
    "質問に「続ける」と答え直してください。回答内容は記録されます。",
  reviseRefusedAsks:
    "変更は送られていません。ワーカーの質問にまだ回答していないか、「この作業を止める」と回答したままです。質問に「続ける」と回答してから、もう一度押してください。回答内容は記録されます。",
  you: "あなた",
  drafterNoDraft:
    "rondo はこの依頼の範囲を下書きできませんでした。範囲は上の「範囲を決める」から、" +
    "自分で決めてください。",
  drafterNoDraftWhy: "止まった理由",
  drafterRedrafted: "最初の下書きが rondo のチェックを通らなかったため、もう一度下書きしました。",
  issueRead: (pullRequest, comments) =>
    `rondo がこの${pullRequest ? "プルリクエストの会話" : "イシュー"}` +
    `${comments === 0 ? "" : `とコメント ${String(comments)} 件`}を読みました。` +
    "ワーカーには書かれたとおりの全文が渡されます。",
  issueReadFold: "読んだ内容",
  issueNotRead: (why) =>
    ({
      no_gh:
        "このコンピュータに GitHub CLI が入っていないため、rondo はこのイシューを読めませんでした",
      signed_out:
        "このコンピュータの rondo が GitHub にサインインしていないため、このイシューを読めませんでした",
      no_repo: "この番号がどのリポジトリのイシューか、rondo には分かりません",
      missing: "このイシューが見つからないか、あなたのアカウントからは見えません",
      refused: "あなたのアカウントでは、このイシューを読めません",
      too_long: "このイシューは長すぎて、ワーカーに渡せません",
      too_many:
        "1 つのメッセージから rondo が読むイシューは 5 件までで、このイシューはそれを超えていました",
      failed: "rondo はこのイシューを読めませんでした",
    })[why] + "。そのためワーカーには、ここにあなたが書いたことだけが渡されます。",
  issueNotReadTail:
    "費用はかかっていません。イシューにしか書いていないことがあれば、別のメッセージで" +
    "書き足してください。",
  issuePending: "rondo はこのイシューをまだ読んでいません。まもなく読みます。",
  scopeIssuesHeading: "この依頼が名指ししたイシュー",
  scopeIssueGiven: "ワーカーに渡す",
  scopeIssueNotGiven: "読めなかったため渡しません",
  scopeIssuePending: "まだ読んでいない",
  scopeDoneHeading: "完了の条件 (どの回のワーカーにも伝えます)",
  scopeDoneAsks: [
    "作業はこの回のブランチにコミットする。",
    "報告の前に、リポジトリが定める手順でインストールと検証を回す。",
    "検証が回せない・通らないときは報告でそう言い、通ったとは言わない。",
  ],
  scopeDoneRules: (files) => `手順はリポジトリの ${files.join("、")} に従うよう伝えます。`,
  scopeDoneNoRules:
    "計画で手順のファイルを指定していないため、ワーカーがリポジトリの文書から手順を探します。",
  scopeDoneExact: "ワーカーに送る文面 (英語)",
  inReplyTo: (who, words) => `${who} への返信: ${words}`,
  basesLabel: "根拠",
  replyAction: "返信する",
  replyingTo: (who, since) => `${who} に返信 · ${since}前`,
  answeringTo: (who, since) => `${who} の質問に回答 · ${since}前`,
  answerAskAction: "回答する",
  answerCarryOnAction: "続ける",
  answerStopAction: "この作業を止める",
  answerOutcomeNote:
    "書いたとおりに送られます。「続ける」を押すともう一度試し、「この作業を止める」を押すと止まったままになります。" +
    "あとから「続ける」こともできます。",
  answerInMyWordsAction: "自分の言葉で回答する",
  answerRecommended: "おすすめ",
  answerOptionsNote:
    "選択肢を押すだけで回答になり、書いた文も一緒に送られます。" +
    "「この作業を止める」を押すと止まったままになり、あとから回答し直せます。",
  answerRaiseAction: "予算を増やして続ける",
  answerReviseNote: "「続ける」を押すと、この回答を渡して次の回をすぐに始めます。",
  answerReviseOptionsNote:
    "選択肢のどれか、または「自分の言葉で回答する」を押すと、この回答を渡して次の回をすぐに始めます。",
  answerReviseDraftLead: "次の回には、下の変更依頼も一緒に渡します。",
  answerReviseCallsSend: "判断が必要な次の点も一緒に送る（回答と食い違う点は回答を優先します）",
  answerRaiseLabel: "これからの予算（USD）",
  answerRaiseRoundsLabel: "この作業のレビュー回数",
  answerRaiseLeft: (left, reserve, enough) =>
    `この承認の残りは $${left} で、次の 1 回に見込む $${reserve} に` +
    `${enough ? "足ります" : "足りません"}。増やすと、予算だけを変えた新しい承認が記録されます。` +
    "",
  answerRaisePaused:
    "この目標に向けた作業は一時停止中のため、ここで予算を増やしてもまた止まります。先に再開してください。",
  newRequestHeading: "新しい依頼",
  requestPlaceholder: "何をしてほしいですか。話すときの言葉のまま書いてください。",
  replyPlaceholder: "返信を書く",
  sendAction: "送信",
  sendNote: "書いたとおりに送られます。直すときは、もう一度返信します。",
  keySend: "送信",
  composerNoApprover:
    "承認する人がまだ決まっていないため、このページからはメッセージを送れません。ページ上部で名前を入れてください。",
  evOfTry: (at, said) => `${String(at)} 回目: ${said}`,
  walkAt: (at, of) => `あなたの番 ${String(at)} ／ ${String(of)}`,
  walkNext: "次へ",
  govSpent: (spent, approved) => `$${spent} ／ $${approved}`,
  govTries: (at, of) => `この範囲で ${String(at)} 回目 ／ ${String(of)} 回まで`,
  chainAnswer: "あなたの答え",
  chainProposal: "プルリクエスト",
  chainMerge: "マージ",
  noSuchThread: "そのメッセージを含む依頼スレッドはありません。",
  threadsUnreadable: (reason) => `依頼スレッドを読めませんでした: ${reason}`,
  notSent: (line) => `送信されませんでした。書いた文は残しています: ${line}`,
  sendRefusedNoApprover:
    "送っていません。承認する人がまだ決まっていません。前の画面に戻り、上部で名前を入れてから、もう一度押してください。",
  sendRefusedForm:
    "このページ自身のフォームから届いていないか、ページが今の rondo より古いものです。ページを読み込み直してから、もう一度送信してください。",
  sendRefusedNoWords: "送る文がありません。",
  sendRefusedNotTaken:
    "返信先のメッセージは、もうスレッドにないようです。いまスレッドにあるメッセージに返信してください。",
  sendRefusedAsk:
    "送信されていません。返信先は回答待ちの質問です。スレッドに戻って「回答する」を押してください。",
  sendRefusedTooLong:
    "このページが受け付けるより長いメッセージです。短くするか、2 つの返信に分けてください。",
  sendRefusedUnknown:
    "rondo はこのメッセージを受け取りませんでした。ページを読み込み直してから、もう一度送信してください。",
  answerRefusedPress:
    "回答は記録されませんでした。人がこのページのボタンを押したときだけ受け付けます。",
  answerRefusedRaise:
    "予算は増えておらず、質問にもまだ答えていません。承認がすでに増やされたか、置き換えられた" +
    "可能性があります。スレッドを読み込み直して、もう一度答えてください。",
  answerRefusedNoWords:
    "「自分の言葉で回答する」には文が要ります。書くか、選択肢のどれかを押してください。",
  replyNotAnswer: "返信しただけでは、このスレッドで待っている質問に答えたことになりません。",
  sendBack: "スレッドに戻る",
  sendBackNote: "ブラウザの「戻る」で、書いた文に戻れます。",
  threadsLiveNote: (seconds) =>
    `${String(seconds)}秒ごとに画面を更新します。記録されるのは送信した文だけで、` +
    "あなたの名前でスレッドに残ります。メッセージを送っても、何かを承認したことにはなりません。",
  approvePlain: "この作業をこのまま受け入れます。",
  approveFace: "承認する",
  approveDespite: "指摘を残したまま承認する",
  approveDespitePlain: "モデルレビューが挙げた点に答えないまま、この作業をこのまま受け入れます。",
  undeterminedFold: (count) => `rondo が判定できなかった項目 ${String(count)} 件`,
  liveShort: (seconds) => `ライブ · ${String(seconds)}秒ごとに更新`,
  stillShort: "読んでいるあいだは更新しません",
  age: (ago) => {
    const unit = ago.slice(-1);
    const units: Record<string, string> = { s: "秒", m: "分", h: "時間", d: "日" };
    return units[unit] === undefined ? ago : `${ago.slice(0, -1)}${units[unit]}`;
  },
  waitingCount: (count) => `${String(count)} 件待ち`,
  signedInAs: (actorId) => `${actorId} として送信・回答します`,
  replyDefault: "最新のメッセージへの返信に戻す",
  blockedCount: (count) => `${String(count)} 件のコマンドを止めた`,
  blockedNothing: "止めたコマンドなし",
  blockedUnknown: "止めたコマンドは不明",
  fenceHeading: "実行の制限:",
  fenceMeaning:
    "これらのコマンドは、この作業では許可されていないため、実行前に止められました。" +
    "止められたものの中に必要な手順（チェック、インストール、push など）があれば、" +
    "結果にその手順が欠けているかもしれません。",
  reportHeading: "ワーカーの報告",
  reportFold: "ワーカーが書いたとおりの全文",
  reportNotRead:
    "ワーカーの報告を読み取れませんでした。報告があれば、下の「記録全文」の中にあります。",
  workHeading: "変わったもの",
  changedAgainst: (baseRef) => `${baseRef} との比較`,
  changedUnreadable:
    "作業場所が読み取れなかったため、この作業で何が変わったかをここには出せません。",
  changedNoRange: "比べる相手のブランチが記録されていないので、変更を一覧にできません。",
  noCommits: "ブランチにコミットはありません。",
  noFiles: "変わったファイルはありません。",
  binaryFile: "バイナリ",
  moreRows: (count) => `ほか ${String(count)} 件`,
  reachHeading: "予定外のファイルへの変更",
  reachCollided: (paths) =>
    `${filesJa(paths)} は別の作業も変更しています。マージのときにぶつかります。` +
    "承認する前に、その作業を確かめてください。",
  reachUnheld: (paths) =>
    `${filesJa(paths)} は予定外のファイルです。ほかの作業とはぶつかりません。`,
  reachUnread:
    "予定外のファイルを変更したかどうかを確かめられませんでした。ほかの作業とぶつかるかどうかは分かりません。",
  checksHeading: "チェック",
  modelHeading: "モデルレビュー",
  verdictPill: (verdict, count) =>
    verdict === "clear"
      ? "指摘なし"
      : verdict === "concerns"
        ? `指摘 ${String(count)} 件`
        : verdict === "unavailable"
          ? "取れず"
          : verdict,
  checksNone: "まだチェックが実施されていません。",
  checksCounted: (commits, files) =>
    `コミット ${String(commits)} 件とファイル ${String(files)} 件を読みました。`,
  whatItRead: "読んだものと読んでいないもの",
  checksReader: "rondo のチェック",
  workerRan: "ワーカーが実行したもの",
  workerRanUnrecorded:
    "この回でワーカーが何を実行したかは記録に残っていないため、テストが走ったかどうかは分かりません。",
  workerRanNone: (commands) =>
    `この回に記録されたコマンド ${String(commands)} 件の中に、rondo が読み取れるテスト実行はありませんでした。`,
  workerCount: (kind, count) =>
    `${{ passed: "成功", failed: "失敗", skipped: "スキップ" }[kind]} ${String(count)}`,
  workerRanErrored: "コマンド自体はエラーで終わっています。",
  workerRanEarlier: (runs) => `これより前にも ${String(runs)} 回実行しています`,
  workerRanSuperseded: () =>
    `ワーカーはこの後にテスト全体をもう一度実行し、エラーなく終わっています。`,
  workerRanSource: () => "",
  readingCovered: (reach) => {
    switch (reach) {
      case "model":
        return "モデルレビューは、この回でコミットされた変更と、ワーカーが実行したコマンドの結果を読んでいます。";
      case "history":
        return (
          `読んだのはコミット済みの履歴だけで、この回で頼まれたとおりのことをしたかどうかは` +
          "判断できません。"
        );
      case "historyAndStatus":
        return (
          `読んだのはコミット済みの履歴と、作業場所に残るコミットされていない変更で、` +
          "この回で頼まれたとおりのことをしたかどうかまでは判断できません。"
        );
      default:
        return "何を見て出した結果かは記録に残っていないため、どこまで確かめたかは分かりません。";
    }
  },
  basisNone: "根拠の指定なし",
  basisUnresolved: "どれも渡した作業と一致しませんでした",
  modelPending: "まだ届いていません。あとから届くことがあります。",
  modelOlder:
    "これは前のコミットに対するレビューです。いまのコミットへのレビューは、あとから届くことがあります。",
  reloadPage: "読み込み直す",
  readingsNote: "最終的に承認するかどうかを決めるのはあなたです。",
  allAsText: "記録全文 (上に出していない項目も含む)",
  claimLabel: "確かめたこと（任意。承認と一緒に記録されます）",
  claimPlaceholder: "例: 手元でテストを実行した / 差分を読んだ / スマートフォンで画面を開いた",
  claimTooLong: (max) =>
    `確かめた内容が長すぎます。${String(max)} 文字までにしてから、もう一度「承認する」を押してください。`,
  claimGateUnread:
    "承認が記録されませんでした。確認の画面に戻って、もう一度「承認する」を押してください。",
  claimGateClosed: "この確認にはすでに回答済みです。",
  claimNotRecorded: "確認の画面に戻って、もう一度「承認する」を押してください。",
  claimHostSetup:
    "確かめた内容を記録できないため、承認は送っておらず、費用もかかっていません。このコンピュータの rondo のセットアップが終わっていないか、動かなくなっています。",
  answerNotDone: "承認は送信されませんでした",
  gateBack: "確認の画面に戻る",
  gateAuto: gateAutoJa,
  approvalNamed: (goal, costUsd) =>
    `${goal ? "目標に向けた承認" : "この依頼の承認"}（$${costUsd} まで）`,
  gateAutoSaid: (approval, approver, line) =>
    [
      `${approver} の${approval}に基づいて、rondo がこの回を承認しました。`,
      "自動承認の条件をすべて満たしていました。",
      "- チェックが通っている",
      `- モデルレビューに、${severityJa(line)}以上の指摘がない`,
      "- ワーカーの最後のテスト実行が通っている",
      "- 回答待ちの質問がない",
      "- 締めの回ではない",
    ].join("\n"),
  gateReviseSaid: (approval, approver, notSent, line, left) =>
    [
      `${approver} の${approval}に基づいて、rondo が変更依頼を下書きし、そのまま送りました。`,
      "自動で送る条件をすべて満たしていました。",
      ...(left.length === 0
        ? []
        : [
            "",
            `${severityJa(line)}未満で、あなたの判断に任せた次の指摘は、この変更依頼に入れていません。`,
            "必要なら、変更を依頼してください。",
            ...left,
          ]),
      ...(notSent === null
        ? []
        : [
            "",
            "変更依頼は送りましたが、次の回は始まっていません。",
            notSent,
            "目標の承認を一時停止するか、予算を増やすか、依頼から作業を始め直してください。",
          ]),
    ].join("\n"),
  modelRaised: (blockers, majors) => `モデルレビューの指摘: ${raisedJa(blockers, majors)}。`,
  modelRaisedLink: "読む",
  severityWord: severityJa,
  severityCount: (severity, count) => `${severityJa(severity)} ${String(count)} 件`,
  readingNotTaken: "結果が出力されませんでした",
  whyNotTaken: "理由",
  checksWorkUnreadable:
    "この作業の変更を現在読み取れないため、この結果がいまの変更と合っているか確認できません。",
  checksNotMatched: "照合できず",
  modelNotTaken: "この作業を読んだのはチェックだけで、モデルレビューは行われていません。",
  neitherReadingTaken: "チェックもモデルレビューも、この作業を読めませんでした。",
  storyHeading: "これまでの経緯",
  storyLaps: (count) =>
    `この作業は、これで ${String(count)} 回目です。下の番号はこの作業の中での回数です。`,
  storyPart: (part, parts) =>
    `この依頼は ${String(parts)} つの作業に分けてあります。この確認は、そのうちの作業 ${String(part)} のものです。`,
  storyLapName: (n, current) => (current ? `${String(n)} 回目 (今回)` : `${String(n)} 回目`),
  storyToldRequest: "依頼の内容に取り組みました。",
  storyToldAsked: "頼まれた変更は次のとおりです。",
  storyToldNotRecorded: "前の回の続きです。何を頼まれたかは記録に残っていません。",
  storyToldContinued: (n) => `${String(n)} 回目が途中で終わったため、その続きを実施しています。`,
  storyChanged: (commits, files) =>
    `${String(commits)} 件のコミットで ${String(files)} ファイルを変更しました。`,
  storyChangedUnread: "コミット内容は読み取れていません。",
  storyNow: "あなたの回答を待っています。",
  storyEnded: (answer, otherwise) =>
    answer === "revise"
      ? "変更依頼を受けて、次の回でやり直しました。"
      : answer === "approve"
        ? "承認されました。"
        : `終わりました (${otherwise})。`,
  storyIntended: "この依頼で変えようとしたこと:",
  storyOthers: "ほかの作業:",
  recordsFold: (count) => `承認したときに記録される内容 (${String(count)} 項目) と記録全文`,
  denialUnreadable: "どのコマンドだったかを rondo は記録できませんでした。",
  modelMayArrive: "モデルレビューはこれから届くかもしれません。",
  reachYourTurn: "rondo があなたの答えを待っています。",
  reachLate: "rondo に、予定の時間を過ぎても終わらない作業があります。",
  chimeAsk: "このタブに通知を許可",
  chimeAskShort: "通知を許可",
  tabTitle: (count) => (count === 0 ? "rondo" : `(${String(count)}) rondo`),
  tabTitleTurn: "あなたの番 — rondo",
  changedMark: "更新されました",
  liveLabel: "ライブ",
  keyMove: "移動",
  keyOpen: "開く",
  keyBack: "戻る",
  keyWrite: "書く",
  keySheet: "キーボードショートカット",
  keyShowSheet: "この一覧を開く",
  textSizeLabel: "文字の大きさ",
  textSizes: ["標準の文字", "大きい文字", "もっと大きい文字"],
  themeLabel: "配色",
  themes: ["ライト", "ダーク", "OS の設定に従う"],

  inboxNote:
    "ここを読んでも「最後に見た」の記録は進みません。進むのは rondo inbox を実行したときだけです。",

  inboxFor: (actorId) => `'${actorId}' の inbox`,
  waitingOnYou: "あなたを待っているもの",
  bindingProposals: (count) => `  承認すると契約になる proposal (${String(count)})`,
  nonBindingProposals: (count) => `  何も拘束しない proposal (${String(count)})`,
  movedOnProposals: (count) =>
    `    ほかに ${String(count)} 件は、対象の回が終わったか新しいものに置き換わっていて、誰も待っていない`,
  takenProposals: (count) =>
    `    ほかに ${String(count)} 件は、引き継ぐはずの名前を別の回がすでに使っていて、承認しても何も動かない`,
  readOneBack: "    選択肢とそれぞれの根拠つきで 1 件を読み直すには: rondo show --proposal-id ID",
  iterationsWaiting: (count) => `  あなたを待っている iteration (${String(count)})`,
  newMark: "  新着",
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
  neverLooked: "  まだ一度も見ていないため、下のどれにも新着の印は付きません",
  nothingChanged: "  なし",
  censusEntry: (kind, count) => `${kind} ${String(count)}`,
  changeLine: (kind, id, since) => `    ${kind}  ${id ?? "(id なし)"}  ${since}前`,
  silenceHeading: "あなたに示されたものと、示されなかったもの",
  countedLine: (what, presented, withheld) =>
    `${what}: 見せた ${String(presented)} 件、見せなかった ${String(withheld)} 件`,
  overAllTime: "全期間",
  sinceLastLook: (since) => `最後に見た ${since}前 から`,
  neverLookedSince: "  最後に見てから: まだ一度も見ていません",
  withheldBy: (ruleName, count) => `'${ruleName}' の規則で見せなかったもの ${String(count)} 件`,
  unnamedRule: "(名前なし)",
  unspentHeading: (count) => `承認されたまま使われていないもの (${String(count)})`,
  unspentLine: (decisionId, proposalId, approved, actorId, since) =>
    `  ${decisionId}  proposal ${proposalId}  ${approved}  '${actorId}' が ${since}前 に`,

  noGateDecide: "確認待ちではありません。人が判断する必要があります",
  noGateReleases: (gateId) =>
    `確認に答えても先へ進みません (${gateId} で停止中)。人が判断する必要があります`,
  suspendedNoGate: "確認の id が記録されないまま中断されたため、どの確認かを rondo は示せません",
  answerGate: (gateId) => `確認 ${gateId} に答える`,
  runsIn: (transcript, workspace) => `${transcript}  場所は ${workspace}`,
  noWorkspace: "(行に workspace がありません)",
  transcriptNotLookedFor: "transcript (まだ始まっていない作業なので探していません)",
  transcriptNotNamed: (reason) => `transcript (名指しできません: ${reason})`,
  transcriptAt: (directory, sessions) =>
    `transcript ${directory}${sessions > 1 ? `  (${String(sessions)} セッション中の最新)` : ""}`,

  declarationCaveat: Object.freeze([
    "ここにあるのは、この回が自分で宣言した許可だけです。",
    "実際に効いている制限のすべてではありません。",
  ]),
  secondFence: Object.freeze([
    "ワーカー側の制限が効いていたかどうかを、rondo は確認していません。",
    "効いていないまま動いた回も、同じように表示されます。",
    "それが分かるのは、確認の画面にあるワーカー自身の報告だけです。",
    "",
  ]),
  lapNestedSandbox:
    "作業を始める前に止めました。rondo が別の Claude Code などの中で動いているため、" +
    "ワーカーを始められません。" +
    "rondo を普段の端末から起動し直してから、" +
    "もう一度試してください。",
  lapTurnTimedOut: (minutes) =>
    `時間切れで止めました。ワーカーが${minutes === null ? "決められた時間" : ` ${String(minutes)} 分`}` +
    "のうちに作業を終えられませんでした。コミットされていない変更は届きません。" +
    "この回の費用は分かりません。" +
    "続けるには、この質問に「続ける」と回答してください。rondo が最後のコミットから始め直します。" +
    "作業を小さく分けて、範囲を決め直すこともできます。",
  lapWorkKept: (branch, commit) =>
    "コミットされていなかった変更は、rondo が未検証の印を付けて、この作業のブランチに 1 つの" +
    `コミットとして残しました（${branch}、${commit.slice(0, 12)}）。届けてはいません。続けると、` +
    "この作業はそこからもう一度始まり、まずその中身を確かめます。",
  lapWorkNotKept: (reason) =>
    "コミットされていなかった変更を rondo は残せませんでした。続けると最後のコミットからやり直しになり、" +
    `その変更は含まれません: ${reason}`,

  scopeAction: "範囲を決める",
  scopeHeading: "この依頼の範囲",
  backToThread: "依頼に戻る",
  scopeLead:
    "範囲はあなたが決めます。数値には、これまでの回の記録から出した値を入れてあります。" +
    "変えたいところを変えて、「範囲を決める」を押してください。" +
    "1 回押せば、記録と承認が済みます。",
  scopeNoPlanHeld: "この依頼に使える計画が、" + "まだ rondo にありません。",
  scopePlansUnread: (reason) => `計画を読み出せなかったため、選べるものがありません: ${reason}`,
  scopePlanAsk: "作業に使う計画",
  scopePlanGone: "選んでいた計画は、この依頼ではもう使えません。下の一覧から選び直してください。",
  scopePlanFrom: (from) =>
    from === "message"
      ? "このスレッドに貼られたもの"
      : from === "setup"
        ? "このコンピュータのセットアップで用意したもの"
        : "前の回で使ったもの",
  scopePlanLine: (where, agentType, from) => `${where}、ワーカーの種類 ${agentType}（${from}）`,
  scopePlanHeldAt: (line, at) => `${line}、${at} UTC から保持`,
  scopeDraftedLead:
    "この依頼の範囲を rondo が下書きしました。作業の内容と、これまでの回の記録から出した予算です。" +
    "そのまま承認するか、値を変えてから承認してください。" +
    "値を変えた場合は、あなたの版が記録されます。",
  scopeDraftedPlansHeading: "rondo が動かそうとしている作業",
  scopeDraftedPlan: (n) => `作業 ${String(n)}`,
  scopeDraftedTemplateGone: "この作業の計画は、もう rondo にありません。",
  tierHeading: "この作業を動かすモデル",
  tierSaid: (tier, lighter) =>
    tier === "standard"
      ? "標準のモデルで動きます。"
      : tier === "mechanical"
        ? lighter === false
          ? "軽いモデル向けと指定されていますが、この提供元には軽いモデルが無いので、ほかの作業と同じモデルで動きます。"
          : "軽くて安いモデルで動きます。結果を人が読まずに確かめられる作業にだけ使えます。"
        : tier === null
          ? "どのモデルで動くか分かりません。下書きにモデルの指定がありません。"
          : `モデルの指定が '${tier}' ですが、rondo にはこれに当てるモデルがありません。`,
  tierModel: (model, provider) => `${model} (提供元 ${provider})`,
  tierWhy:
    "軽いモデルでよいとした理由です (下書きした側の言葉のまま)。rondo が確かめたのは、理由があなたのメッセージに基づいていることだけです。" +
    "理由が正しいかどうかは、承認する前にあなたが判断してください。",
  tierCondition: (condition) =>
    condition === "files_named"
      ? "依頼が対象のファイルを名指ししている"
      : condition === "bounded"
        ? "変更の範囲が限られている"
        : condition === "checks_are_acceptance"
          ? "テストが通れば完了と言える"
          : condition,
  tierLapsHeading: "回ごとのモデルと費用",
  tierLap: (n, model, provider, costUsd) =>
    `${String(n)} 回目: ${model ?? "モデルの記録なし"}` +
    `${provider === null ? "" : ` (提供元 ${provider})`}、` +
    `${costUsd === null ? "費用はまだ読めていません" : `$${costUsd}`}`,
  scopeNarrowed: (computed) => `あなたのメッセージを受けて、rondo が ${computed} から下げました:`,
  scopeNarrowedStricter: "あなたのメッセージを受けて、rondo が「重大」より厳しくしました:",
  scopeNarrowedAdded: "あなたのメッセージを受けて、rondo が加えました:",
  scopeAnswerFirst:
    "依頼のスレッドに、まだ回答していない質問があります。" +
    "回答するまで、範囲は決められません。先に回答してください。",
  scopeRedrafted:
    "下の範囲が承認されたあとで、rondo が下書きし直しました。新しい下書きはこちらです。" +
    "承認すると、この依頼の範囲がもう 1 つ加わり、下の範囲はそのまま残ります。",
  scopeDraftedAction: "承認する",
  scopeDraftedPlain: "この範囲、または値を変えたあなたの版を承認します",
  scopeDraftedPressNote:
    "ボタンを 1 回押せば承認されます。" +
    "値を変えた場合は、変えた値で承認されます。" +
    "承認しただけでは費用はかかりません。",
  planStartAction: "この作業を始める",
  planStartPlain: "この作業を 1 回始めます。費用は承認した予算から使います",
  planStarted: "開始済みです。",
  planStartedLink: "依頼のスレッドを開く",
  planBusy: (limit) =>
    limit === 1
      ? "いまは始められません。同時に動かせるのは 1 回までで、その 1 回がいま動いています。" +
        "それが確認待ちになると始められます。"
      : `いまは始められません。同時に動かせるのは ${String(limit)} 回までで、いま` +
        "そのすべてが動いています。どれかが確認待ちになると始められます。",
  planFull: (live, limit) =>
    `いまは始められません。進行中の回が ${String(live)} 件あり、このコンピュータで同時に持てる上限` +
    `（${String(limit)} 件）です。どれかを終わらせると始められます。`,
  planOutside: (test) => `始められません。${scopeTestJa(test)}。`,
  planUnrunnable:
    "この作業はもう始められません。依頼のスレッドに返信すると、rondo が下書きし直します。",
  planUnrunnableWhy: "止めている理由",
  planUndecidable: "いま、この作業を範囲に照らして確かめられませんでした。",
  scopeNoPlanForScope:
    "承認した範囲に合う計画が rondo にないため、" + "この範囲では作業を始められません。",
  scopeNoApprover:
    "承認する人がまだ決まっていません。ページ上部で名前を入れると、ここで承認できます。",
  // The place is said only where it is what tells two of these apart (D-0081
  // rule 4.2); with nothing to tell apart, the root answers "where" alone.
  // Japanese names the place first and keeps the root beside it in brackets,
  // which is how a Japanese reader carries a qualifier.
  scopeWorkspace: (place, root) => (place === null ? root : `${place}（${root}）`),
  scopePlanDigest: (digest) => `計画 ${digest}`,
  scopePlanHeading: "作業に使う計画と作業場所",
  scopeRecordedFold: "作業場所とワーカーの種類の許可（rondo の記録）",
  scopeMaybeApproved:
    "この依頼の範囲をすでに承認したかどうかは、この画面では分かりません。" +
    "押すと、範囲がもう 1 つ記録されます。先に依頼のスレッドで確かめてください。",
  scopeHeldBounds: (digest, tier, granted, from) =>
    `ワーカーの種類 ${digest}: モデルの規模は ${tier}、許可は` +
    `${granted.length === 0 ? "なし" : granted.join(", ")}` +
    `（${agentTypeSourceJa(from)}から読み取り）`,
  scopeHeldNone: (digest) =>
    `ワーカーの種類 ${digest}: 何が許されているかの記録を rondo は持っていません`,
  scopeHeldUnreadable: (digest, reason) =>
    `ワーカーの種類 ${digest}: 記録を読めないので、何が許されているかを出せません: ${reason}`,
  scopeHeldRebuilds: (digest, rebuilt, from) =>
    `ワーカーの種類 ${digest}: ` +
    `${agentTypeSourceJa(from)}から読み取った記録は ` +
    `${rebuilt} に組み直されるので、何が許されているかを出せません`,
  scopeHeldNoBuild: (digest, from, reason) =>
    `ワーカーの種類 ${digest}: ` +
    `${agentTypeSourceJa(from)}から読み取った記録は` +
    `組み立てられないので、何が許されているかを出せません: ${reason}`,
  scopeRoundsAsk: "レビュー回数",
  scopeRoundsRedraw:
    "レビュー回数を選ぶと、入力した値は下書きの値に戻ります。先にレビュー回数を選んでから、ほかの値を直してください。",
  scopeLapsLabel: "回数",
  scopeRoundsLabel: "レビュー回数",
  scopeCostLabel: "費用（USD）",
  scopeReserveLabel: "費用がまだ分からない回に取っておく額（1 回あたり、USD）",
  scopeExpiresLabel: "有効期限（UTC）",
  scopeFormula: (how) => `計算: ${how}`,
  scopeFormulaRounds: "選んだレビュー回数そのもの",
  scopeFormulaLaps: (plans, rounds) =>
    `作業数 x レビュー回数 = ${String(plans)} x ${String(rounds)}`,
  scopeFormulaReserve: "1 回目の費用で最も高かったものを、0.10 USD 単位で切り上げた値",
  scopeFormulaCost: (plans, reserve, laterRounds, redo) =>
    `作業数 x（取っておく額 + 2 回目以降のレビュー回数 x やり直しの回の費用）= ` +
    `${String(plans)} x（${reserve} + ${String(laterRounds)} x ${redo}）`,
  scopeFormulaExpires: (laps, seconds) =>
    `下書きした時刻 + 回数 x 最も長くかかった回の時間 + 返信のための 1 日 = 下書きした時刻 + ` +
    `${String(laps)} x ${String(seconds)} 秒 + 24 時間`,
  scopeBasesFold: (count) => `この数の出どころ (${String(count)})`,
  scopeBasisRows: (measurement, laps, level) =>
    `${
      level === "agent_type"
        ? "このワーカーの種類"
        : level === "model_tier"
          ? `近い種類のワーカー`
          : "このリポジトリ"
    }の直近 ${String(laps)} 回のうち、` +
    `${JA_MEASURE[measurement] ?? measurement}が最も高かったもの`,
  scopeBasisColdStart: (measurement) =>
    `${JA_MEASURE[measurement] ?? measurement}: 記録された回がまだないため、rondo の` +
    `初期値を使いました`,
  scopeColdStartNote: (whole) =>
    whole
      ? "記録された回がまだないため、この値は rondo の見込みです。" +
        "大きな作業なら上げてください。"
      : "一部は rondo の見込みです。この依頼に使うワーカーの種類のうち、記録された回がまだない" +
        "ものがあります。大きな作業なら上げてください。",
  scopeBasisPlans: (plans) => `作業数: ${String(plans)}`,
  scopeBasisRounds: (rounds, byDefault) =>
    byDefault
      ? `レビュー回数: ${String(rounds)}（誰も選ばなかったときに rondo が使う数）`
      : `レビュー回数: ${String(rounds)}（あなたが選んだ数）`,
  scopeBasisReplyAllowance: "返信のための 1 日。計測した値ではなく、余裕として足した分です",
  scopeBasisLap: (iterationId) => `回 ${iterationId}`,
  scopeSampleHeading: "依頼の大きさが過去の回と同じくらいだとして、予算を出しています",
  scopeSampleRows: (laps, level, _tier, lowest, highest) =>
    `${
      level === "agent_type"
        ? "このワーカーの種類"
        : level === "model_tier"
          ? `このワーカーの種類には記録がないので、近い種類のワーカー`
          : "このワーカーの種類にも近い種類にも記録がないので、このリポジトリの別のワーカーの種類"
    }の 1 回目 ${String(laps)} 件をもとに下書きしました。費用は ` +
    `${lowest === highest ? highest : `${lowest}〜${highest}`} USD で、取っておく額にはその最高値を` +
    `使っています。` +
    `この依頼がそれらと同じくらいの大きさかどうかは分かりません。` +
    `大きいと思うなら、ここで費用を上げてください。1 回目で使い切っても、作業があなたの` +
    `確認に戻ってきたときに増やせます。`,
  scopeSampleColdStart: (reserve) =>
    `この種類のワーカーにも、近い種類にも、このリポジトリにも、記録された回がありません。` +
    `取っておく額 ${reserve} USD は、rondo の見込みです。` +
    `依頼の大きさも分かりません。` +
    `大きな作業なら、ここで費用を上げてください。` +
    `予算の上限で止まったときにも、そこから予算を増やせます。`,
  scopeDefaultsHeading: "rondo が埋めたもの",
  scopeDefaultNote: "rondo の既定値です。依頼の内容から出した値ではありません。",
  scopeSeverityLabel: "この重さ以上の指摘は、直すまでレビューを通さない",
  scopeOutwardLabel: "この範囲で許す、リポジトリの外に影響する操作",
  scopeOutwardFromGoal:
    "このリポジトリの目標で許している操作には、あらかじめチェックを入れてあります。" +
    "自分でやりたいものは、チェックを外してください。",
  scopeOutwardAct: (act) =>
    ({
      push_branch: "ブランチを push する",
      open_pull_request: "プルリクエストを開く",
      merge_default_branch: "チェックが通ればデフォルトブランチにマージする",
    })[act] ?? act,
  scopeOutwardNone: "なし",
  scopeIrreversibleNone: "取り返しのつかない行為は、何も加えていません。",
  scopeCostCaveat:
    "費用の予算に入るのは、各回の費用だけです。モデルレビューの費用は入りません。" +
    "費用がまだ分からない回は、取っておく額の分として見ています。",
  scopePressNote:
    "1 回押すと、この範囲があなたの名前で記録され、承認されます。" +
    "承認しただけでは費用はかかりません。",
  scopePlain: "この範囲を記録して承認します",
  scopeApproved: (since) => `${since}前に承認済み`,
  scopeDigest: (digest) => `識別子 ${digest}`,
  scopeNotThisRequest: "その承認はこの依頼のものではないので、ここには何も表示しません。",
  scopePredecessorSpent: (laps, usd, unread) =>
    `前の範囲では、${String(laps)} 回を動かし、費用が分かっている分で $${usd} を使いました。` +
    `費用がまだ分からない回が ${String(unread)} 回あり、その分は取っておく額で見ています。`,
  scopePredecessorNoApproval: "前の範囲は承認されていないため、何も使っていません。",
  scopePredecessorUnreadable: (reason) => `前の範囲が何を使ったかは読めませんでした: ${reason}`,
  scopeRetired: "あとから承認した範囲に置き換わったため、この範囲からは何も始められません。",
  scopeRetiredLink: "新しい範囲を開く",
  startAction: "作業を始める",
  startPlain: "作業を 1 回始めます。",
  startAgainSafe: "2 回押しても、始まるのは 1 回だけです。" + "",
  workerProviderLabel: "作業を実行する提供元",
  workerProviderDefault: (provider) => `このコンピュータの既定値 (${provider})`,
  workerProviderBefore: "選べるのは作業を始める前だけです。始まったあとは変わりません。",
  workerProviderRan: (provider, chosen) =>
    chosen ? `${provider}（この依頼で選択）` : `${provider}（このコンピュータの既定）`,
  workerProviderUnknown: "不明です。この回では提供元を記録していません。",
  startBeside:
    "ほかの作業と並行して始めます。" +
    "ほかの作業とぶつかったときは、直す作業を rondo が始めるか、" +
    "ボタン 1 つで始められるようにします。",
  startNote: "依頼に書いた言葉が、そのまま作業への指示になります。",
  scopeRefusedNoApprover:
    "記録していません。承認する人がまだ決まっていません。前の画面に戻り、上部で名前を入れてから、もう一度押してください。",
  scopeRefusedPress:
    "何も記録していません。範囲の承認はこのページのボタンを人が押したときだけ行われ、" +
    "スクリプトからはできません。",
  scopeRefusedForm:
    "何も記録していません。そのフォームはこのページのものではありません。読み込み直してから" +
    "押してください。",
  scopeRefusedFields: "予算の数値に使えない値があります。直してから、もう一度押してください。",
  scopeRefusedNotTaken: "範囲の受付に失敗しました。",
  scopeRefusedPlanChanged:
    "この画面を開いたあとに表示していた内容が変わったため、承認は記録されていません。" +
    "「範囲に戻る」で開き直した画面から、選び直して承認してください。",
  scopeRefusedEdited:
    "このフォームはすでに承認済みのため、いま書き換えた値は記録されていません。" +
    "「範囲に戻る」で開き直した画面に新しい値を入れて、承認してください。",
  scopeRefusedNotRead:
    "範囲は保存しましたが、承認はしていません。範囲の画面に戻って、もう一度承認してください。",
  scopeRefusedNotShown:
    "範囲は保存しましたが、承認はしていません。範囲の画面に戻って、もう一度承認してください。",
  scopeRefusedNotApproved:
    "範囲は保存しましたが、承認はしていません。費用もかかっていません。範囲の画面に戻って、もう一度承認してください。",
  startRefusedNoApprover:
    "作業を始めていません。承認する人がまだ決まっていません。前の画面に戻り、上部で名前を入れてから、もう一度押してください。",
  startRefusedPress:
    "作業は始まっていません。" + "範囲の画面に戻って、もう一度ボタンを押してください。",
  startRefusedForm:
    "何も開始していません。そのフォームはこのページのものではありません。読み込み直してから" +
    "押してください。",
  startRefusedNoPlan:
    "選んだ計画は、この依頼ではもう使えません。範囲の画面に戻って、選び直してください。",
  startRefusedNoRequest: "依頼の内容を読み出せませんでした。戻って、もう一度試してください。",
  startRefusedNoContinuo:
    "作業を開始する仕組みが起動しませんでした。時間をおいて、もう一度試してください。",
  startRefusedOutside: (test) =>
    // Said in words, never the test's name (rondo#431): `asks` is a word to ask about.
    `作業は始まっておらず、費用もかかっていません。${scopeTestJa(test)}。` +
    `どうするかの選択肢は、依頼のスレッドのメッセージにあります。`,
  startRefusedNotAdmitted:
    "作業は始まっておらず、費用もかかっていません。承認はそのまま有効です。戻って、もう一度押してください。",
  scopeBack: "範囲に戻る",

  reviseAction: "変更を依頼する",
  revisePlain: (next) => `書いた変更依頼を送り、${lapJa(next)}を始めます。`,
  reviseLabel: "変更してほしいこと",
  revisePlaceholder: "例: パーサーの変更はそのまま、コマンドラインには手を入れないでほしい",
  reviseNote: (next) =>
    `書いた内容がワーカーに渡り、${lapJa(next)}はその内容で作業をやり直します。その回の費用は、いまの承認の予算から使われます。`,
  reviseRaises: (rounds) =>
    `承認したレビュー回数（${String(rounds)} 回）を使い切っています。押すと、まずレビュー回数を引き上げてから、変更を依頼できます。ほかの予算は変わりません。`,
  reviseNoScope:
    "この回は範囲を承認せずに始まったため、ここから変更は依頼できません。今の作業をそのまま承認するか、範囲を承認して依頼を最初からやり直せます。",
  reviseNoScopeAction: "この依頼の範囲を承認する",
  scopeStopToLap: "確認待ちの回を開く",
  scopeStopAskAgain: "同じ依頼を出し直す",
  reviseDraftFinding: (severity, text) => `- ${severityJa(severity)}: ${text}`,
  reviseDraftBases: (bases) => `  場所: ${bases}`,
  reviseDraftChange: (words) => `  直すこと: ${words}`,
  reviseDraftJudgment: "  (判断が要る点のため、送るかどうかはあなたに任せます)",
  reviseDraftTakeIn: (finding) =>
    `- ${finding}\n  直すこと: まずそのコミットを git merge --no-edit で取り込み、競合があれば解消して ` +
    "merge をコミットする。",
  reviseDrafted: "レビューの指摘をもとに rondo が下書きしました。自由に書き換えて構いません。",
  reviseDrafting:
    "レビューの指摘をもとに、変更依頼の下書きを作っています。できあがると入力欄に入ります。" +
    "自分で変更依頼を書いても構いません。",
  reviseUndrafted:
    "rondo が変更内容を下書きできませんでした。" +
    "自分で変更依頼を書いてください。レビューの指摘は上にあります。",
  reviseDraftArrived:
    "書き始めたあとに下書きが届きました。あなたが書いた内容はそのまま残しています。",
  reviseUseDraft: "下書きに置き換える",
  forMaintainer: "このコンピュータで rondo を管理する人向け",
  hostLog: "拒否の直前 2 分間の rondo のログ",
  reviseRefusedNoApprover:
    "変更を依頼していません。承認する人がまだ決まっていません。前の画面に戻り、上部で名前を入れてから、もう一度押してください。",
  reviseRefusedPress:
    "変更依頼は送られていません。この操作は、人がこのページのボタンを押したときだけ受け付けます。",
  reviseRefusedForm: "変更依頼は送られていません。そのフォームはこのページのものではありません。",
  reviseRefusedNoWords:
    "変更依頼は送られていません。入力欄が空でした。変更依頼を書いてから押してください。",
  reviseRefusedGateClosed: "変更依頼は送られていません。この確認はすでに終わっています。",
  reviseRefusedNotItsScope:
    "変更依頼は送られていません。この確認を表示したあとに承認内容が変わりました。確認の画面には、" +
    "いまの承認内容が出ています。",
  reviseRefusedStillRunning:
    "変更依頼は送られていません。先に押した分がまだ処理中です。結果はスレッドに表示されます。",
  reviseRefusedNotSetUp:
    "変更依頼は送られていません。次の回を用意できませんでした。確認はそのままです。" +
    "何が起きたかは、このコンピュータで rondo を管理する人が確かめられます。",
  reviseRefusedNoContinuo:
    "変更依頼は送られていません。作業を依頼する仕組みが起動しませんでした。このコンピュータで rondo を管理する人に確かめてもらってください。",
  reviseRefusedOutside: (test) =>
    `変更依頼は送られておらず、費用もかかっていません。${scopeTestJa(test)}。` +
    `どうするかの選択肢は、依頼のスレッドのメッセージにあります。`,
  reviseRefusedWalkFailed:
    "変更依頼の送信が途中で止まり、次の回も始まっていません。書いた内容はすでに届いているかもしれません。" +
    "もう一度押す前に、戻って確認の状態を確かめてください。" +
    "何が起きたかは、このコンピュータで rondo を管理する人が確かめられます。",
  reviseRefusedNotSettled:
    "変更依頼は届きましたが、次の回は始まっていません。前の回の終了処理が終わっていません。" +
    "何が起きたかは、このコンピュータで rondo を管理する人が確かめられます。",
  reviseRefusedAfterGate:
    "変更依頼は届きましたが、次の回は始まっていません。書いた内容は記録してあります。どうするかの選択肢は、依頼のスレッドのメッセージにあります。",
  reviseRefusedNotStarted:
    "次の回は始まっていません。書いた内容は失われていません。" +
    "何が起きたかは、このコンピュータで rondo を管理する人が確かめられます。",
  reviseForked: "ここでは変更を依頼できません。今の作業をそのまま承認することはできます。",
  reviseRefusedForked:
    "変更依頼は送られておらず、費用もかかっていません。この依頼の予算が別々に 2 回引き上げられていて、どちらを使うかを rondo は決めません。",

  raiseNeeded: (why) =>
    `${why}ため、ここでは変更を依頼できません。予算を引き上げると、変更を依頼できるようになります。今の作業をそのまま承認することもできます。`,
  raiseWhyLaps: (laps) => `承認した ${String(laps)} 回をすべて使っている`,
  raiseWhyCost: (spent, reserve, cost) =>
    `使った分と確保中の分（$${spent}）に、やり直しに確保する $${reserve} を足すと、承認した $${cost} を超える`,
  raiseWhyExpiry: (at) => `承認した期限 ${at} (UTC) を過ぎている`,
  raiseLink: "この承認の予算を引き上げる",
  raiseLead:
    "この依頼で承認した予算を引き上げます。変わるのは予算だけで、作業の内容、作業する場所、" +
    "ワーカーに許すことは承認したときのままです。",
  raiseWasHeading: "承認した内容と、これまでに使った分",
  raiseWas: (laps, cost, until) => `${String(laps)} 回まで、$${cost} まで、${until} (UTC) まで。`,
  raiseUsed: (attempts, usd, unread) =>
    `これまでに ${String(attempts)} 回、$${usd} を使いました` +
    (unread === 0 ? "。" : `（うち ${String(unread)} 回は費用が報告されていません）。`),
  raiseFromHere:
    "新しい予算は、ここから先にさらに使える分です。これまでに使った分は差し引かれません。",
  raiseRetires: "押すと、この承認が前の承認の代わりになります。" + "",
  raiseAskStands:
    "rondo はこの作業を止めて、どう進めるかを質問しています。予算を引き上げても、質問への回答にはなりません。" +
    "依頼のスレッドで質問に回答するまで、作業は止まったままです。",
  raiseAskLink: "質問を読む",
  raiseNotTip: "この予算はすでに引き上げられています。確認に戻って、いまの予算を確かめてください。",
  raisePressNote:
    "押すと、新しい予算があなたの名前で承認され、あなたを待っている作業に戻ります。" +
    "承認しただけでは何も消費しません。",
  raiseAction: "予算を引き上げる",
  raisePlain: "新しい予算を記録して承認します",
  raiseRefusedNotTip:
    "別のタブか別の人が、先に予算を引き上げています。確認に戻って、いまの予算を確かめてください。",
  raiseRefusedForked:
    "この依頼の予算が、別々に 2 回引き上げられています。" + "rondo はどちらも引き上げていません。",
  raiseRefusedNotAtGate: "作業はもう確認を待っていません。確認に戻って、結果を確かめてください。",

  publishAction: "プルリクエストを作る",
  published: (branch) =>
    `公開済みです。${branch === null ? "ブランチ" : `ブランチ ${branch}`} を push し、` +
    "この作業の記録を閉じました。",
  publishedPullRequest: "プルリクエスト",
  holds: (paths) => `この作業が押さえているファイル: ${filesJa(paths)}`,
  notLanded:
    "プルリクエストはまだ作られておらず、この変更もデフォルトブランチで見つかっていません。それまで" +
    "ファイルはこの作業が押さえたままで、同じファイルを使う別の作業は待たされます。",
  landed: "変更はデフォルトブランチに入りました。ファイルは別の作業に使えます。",
  releasedByPerson: "人の判断でファイルが手放されたので、別の作業に使えます。",
  releaseLink: "ファイルを手放す",
  releaseHeading: "この作業が押さえているファイルを手放す",
  releaseLead:
    "この作業は終わっていますが、ファイルを押さえたままです。あなたが手放すか、プルリクエストが" +
    "作られるか、変更がデフォルトブランチで見つかるまで、同じファイルを使う作業は始められません。",
  releaseWorkHeading: "作業",
  releaseBrief: "依頼の全文",
  releaseHoldsHeading: "押さえているファイル",
  releaseWhyHeading: "rondo が自分で手放していない理由",
  releaseWhy: [
    "rondo は、この作業のプルリクエストを作った時点でファイルを手放します。それより前は、" +
      "この変更がデフォルトブランチに入ったと確かめられたときだけ手放します。作業が変えたファイルが" +
      "すべて、作業が残したとおりの中身でデフォルトブランチにあることが条件です。確かめるのは、別の" +
      "作業が同じファイルを求めたときです。",
    "どちらもまだです。まだ公開していない、または別の方法でマージされて、取り込むときに手が" +
      "入った（コンフリクトの解消を含む）、別のリモートに送られた、デフォルトブランチを読めなかった、" +
      "のどれかです。",
    "作業が済んだかどうかを決めるのはあなたです。rondo が見分けられない形でマージ済みのとき、" +
      "またはマージしないと決めたときは、ファイルを手放してください。",
  ],
  releaseEffectHeading: "手放すと起きること",
  releaseEffect: [
    "別の作業がすぐにこのファイルを使えるようになります。",
    "ブランチ、プルリクエスト、作業そのものはそのまま残ります。何も消さず、何も閉じません。",
    "あなたの判断として記録されます。この作業をやり直すと、ファイルはまたこの作業のものになります。",
  ],
  releaseAction: "ファイルを手放す",
  releasePlain:
    "別の作業がこのファイルを使えるようにし、この作業は済んだというあなたの判断を記録します",
  releaseBack: "押さえているファイルの画面に戻る",
  releaseNothingHeld: "この作業はいまファイルを押さえていないので、手放すものはありません。",
  releaseStillOpen:
    "この作業の一部がまだ動いているか、あなたのレビューを待っているので、それが終わるまで" +
    "ファイルは押さえたままです。",
  releaseRefusedNoApprover:
    "ファイルを手放していません。承認する人がまだ決まっていません。前の画面に戻り、上部で名前を入れてから、もう一度押してください。",
  releaseRefusedPress:
    "何も手放していません。この操作は、人がこのページのボタンを押したときだけ受け付けます。",
  releaseRefusedForm:
    "何も手放していません。そのフォームはこのページのものではありません。読み込み直してから" +
    "押してください。",
  releaseRefusedChanged:
    "何も手放していません。画面を表示したあとで、この作業の状態が変わりました（ファイルが" +
    "手放された、またはやり直された）。戻っていまの状態を確かめてください。",
  releaseRefusedNotRecorded:
    "何も手放していません。rondo があなたの判断を記録できませんでした。ファイルはこの作業が" +
    "押さえたままです。もう一度押しても安全です。",
  holdsLink: "押さえるファイルを変える",
  holdsHeading: "この作業が押さえるファイルを変える",
  holdsLead:
    "この作業がこれから押さえるファイルを 1 行に 1 つずつ書いてください。/ で終わるものは" +
    "フォルダです。外したものはすぐに別の作業が使えるようになります。",
  holdsLabel: "押さえるファイル",
  holdsRunning:
    "この作業の一部がまだ動いています。作業対象のファイルを加えることはできますが、除外するのは作業が一旦止まってからになります。",
  holdsAtReview:
    "加えたものはすぐにこの作業が押さえ、別の作業は使えなくなります（別の作業が押さえている" +
    "ものは加えられません）。",
  holdsEnded: "この作業は終わっています。ファイルを外すことはできますが、加えることはできません。",
  holdsStillOpen:
    "この作業の一部がまだ動いているか、あなたのレビューを待っているので、ファイルはまだ" +
    "手放せません。押さえるファイルは下で変えられます。",
  holdsWaiting: (paths) =>
    `${filesJa(paths)} は別の作業が押さえているため、空くのを待っています。空きしだい rondo が` +
    "この作業に加えるので、押し直す必要はありません。",
  holdsAction: "このファイルを押さえる",
  nextStepEnd: "この作業は止まったまま進みません。終わらせるまで、" + "同じ作業を始め直せません。",
  endHeading: "この作業を終わらせる",
  endUnnamed: "rondo が読めなくなった作業",
  unreadableHolds:
    "この作業が残っている間、ほかの作業が待たされることがあります。" +
    "終わらせられるのはあなただけです。",
  endLeadStalled:
    "この作業は途中で止まり、自分では先へ進めません。動いているものはなく、答える質問も" +
    "ありません。終わらせるかどうかはあなたが決め、その理由を記録します。",
  endLeadStarting:
    "この作業は始める途中で止まり、いま動いているものはありません。終わらせるかどうかは" +
    "あなたが決め、その理由を記録します。",
  endLeadUnreadable:
    "rondo はこの作業を読めなくなったので、内容を示すことも、自分で終わらせることもできません。" +
    "このコンピュータで同時に動かせる作業の枠を1つ占有しています。理由を記録して中断することができます。",
  endEffectHeading: "終わらせると起きること",
  endEffect: [
    "この作業はもう動きません。完了ではなく、終了として記録されます。",
    "抑えられていた予算やファイルはすぐに解放されます。",
    "あなたの理由は作業に記録され、依頼のスレッドにも出ます。",
    "依頼そのものは止まりません。続けるか、作業を変えるか、やめるかを、スレッドで改めて聞きます。",
  ],
  endEffectUnnamed:
    "あなたの理由は作業に記録されます。どの依頼の作業か rondo には読めないので、スレッドでの問いかけはありません。",
  endReasonLabel: "終わらせる理由",
  endReasonHint: "あとでこの依頼を読む人のために、自分の言葉で。一行で十分です。",
  endAction: "この作業を終わらせる",
  endPlain: "あなたの判断としてこの作業を終わらせ、理由を記録し、押さえていたものを返します",
  endBack: "作業を終わらせる画面に戻る",
  endBrief: "rondo がワーカーに頼んだ内容（全文）",
  endNoApprover:
    "承認する人がまだ決まっていません。ページ上部で名前を入れると、ここで作業を終わらせられます。",
  endNothingToEnd:
    "ここで終わらせるものはありません。この作業はすでに終わったか、自分で先へ進みました。",
  endRefusedNoApprover:
    "作業を終わらせていません。承認する人がまだ決まっていません。前の画面に戻り、上部で名前を入れてから、もう一度押してください。",
  endRefusedPress:
    "終わらせていません。この操作は、人がこのページのボタンを押したときだけ受け付けます。",
  endRefusedForm:
    "何も終わらせていません。そのフォームはこのページのものではありません。読み込み直してから" +
    "押してください。",
  endRefusedNoReason:
    "何も終わらせていません。先に、終わらせる理由を書いてください。一行で十分です。",
  endRefusedChanged:
    "何も終わらせていません。押したときには、この作業はすでに終わっていたか、先へ進んでいました。" +
    "戻っていまの状態を確かめてください。",
  endRefusedNotRecorded:
    "何も終わらせていません。この作業はいま rondo が動かしているか、rondo があなたの判断を" +
    "記録できませんでした。作業はそのままです。あとでまた止まっていれば、もう一度押しても大丈夫です。",
  holdsPlain: "この作業が押さえるファイルを、あなたの判断として記録します",
  holdsRefusedNoApprover:
    "押さえるファイルを変えていません。承認する人がまだ決まっていません。前の画面に戻り、上部で名前を入れてから、もう一度押してください。",
  holdsRefusedPress:
    "何も変えていません。この操作は、人がこのページのボタンを押したときだけ受け付けます。",
  holdsRefusedForm:
    "何も変えていません。そのフォームはこのページのものではありません。読み込み直してから" +
    "押してください。",
  holdsRefusedChanged:
    "何も変えていません。画面を表示したあとで、この作業の状態が変わりました（レビューに" +
    "来た、やり直された、押さえるファイルが変わった）。戻っていまの状態を確かめてください。",
  holdsRefusedBusy:
    "何も変えていません。この作業の一部がまだ動いていて、外したファイルを変えるかもしれ" +
    "ません。レビューで止まってから外してください。",
  holdsRefusedKept:
    "何も変えていません。外したファイルのうち、この作業がすでに変えたものがあります。それは" +
    "作業が取り込まれるか終わるまで押さえたままです。",
  holdsRefusedUnread:
    "この作業で変えたファイルを rondo が読めなかったため、ファイルを外せませんでした。あとでもう一度試してください。",
  holdsRefusedPaths:
    "書いたファイルの一覧は受け付けられていません。空である、" +
    "パターンが含まれる、いま押さえているものと同じ、終わった作業に加えている、のどれかです。",
  holdsRefusedNotRecorded:
    "何も変えていません。rondo があなたの判断を記録できませんでした。押さえているファイルは" +
    "そのままです。",
  planHeld: (paths) =>
    `待っています。別の作業が ${filesJa(paths)} を変更しています。その作業のプルリクエストが` +
    "作られるか、その作業のファイルが手放されると、rondo がこれを自動で開始します。押す必要は" +
    "ありません。",
  planHeldFinished: (paths) =>
    `待っています。終わった作業が ${filesJa(paths)} を押さえたままです。その作業の` +
    "プルリクエストがまだ作られていないためです。作られるか、ファイルが手放されると、rondo が" +
    "これを自動で開始します。押す必要はありません。",
  planHeldBy: "押さえている作業",
  planHeldWhy: (paths, why) => `${filesJa(paths)} をまとめて押さえている理由: ${why}`,
  startRefusedHeld:
    "何も開始せず、何も消費していません。必要なファイルを別の作業がまだ押さえています。承認は" +
    "そのまま有効です。その作業のプルリクエストが作られるか、ファイルが手放されたら、もう一度" +
    "開始してください。",
  startWaitsHeld:
    "待っています。必要なファイルを別の作業が変更しています。まだ何も開始しておらず、何も" +
    "消費していません。その作業のプルリクエストが作られるか、ファイルが手放されると、rondo が" +
    "これを自動で開始します。押す必要はありません。",
  publishHeading: "この作業のプルリクエストを作る",
  publishLead: "公開すると何が起きるかを示します。実際に公開するのは、下のボタンを押したときです。",
  publishNotYetLead: "まだ何も送信していません。この作業はいまのままでは公開できません。",
  publishReviewLead:
    "まだ何も送信していません。公開すると何が起きるかを示します。" +
    "ただし rondo のチェックがこの作業の内容と合っていないため、押せるのは、それを承知で公開するボタンだけです。",
  publishNotYetHeading: "公開できない理由",
  publishTargetHeading: "押すと起きること",
  publishPushes: (branch, remote) => `ブランチ ${branch} を ${remote} へ push します。`,
  publishOpens: (repo, base) => `${repo} に、${base} 向けのプルリクエストを作ります。`,
  publishCloses: () => "rondo ではこの作業を完了として閉じます。",
  publishPushUrl: (url) => `その push が届くのは ${url} です。`,
  publishWorkspace: (workspace) => `作業は ${workspace} にあります。`,
  publishRequestHeading: "作られるプルリクエスト",
  publishTitleLabel: "タイトル",
  publishBodyLabel: "本文",
  publishBodyLead:
    "本文は、プルリクエストをレビューする人に向けて rondo が英語で書きます。載せるのは、この作業の" +
    "コミットと変えたファイルの一覧、作業がどう進んだかの記録、あなたの依頼の文面で、下に示すとおりに送ります。",
  publishBodyViewLegend: "本文の表示",
  publishBodyPreview: "プレビュー",
  publishBodyRaw: "原文",
  publishBodyRawNote: "この本文が、一字一句このまま送信されます。",
  publishNoticedHeading: "rondo が気づいたこと",
  publishModelHeading: "モデルが読んだこと",
  publishModelNote: "判断の参考です。承認ではありません。",
  publishNote: (merges) =>
    "ボタンを押すと、rondo があなたの名前で push し、プルリクエストを作り、作業の記録を閉じます。" +
    (merges
      ? "チェックが通れば、承認した範囲にしたがって rondo がデフォルトブランチにマージします。"
      : "マージはしません。マージするかどうかはあなたが決めます。") +
    "画面を開いたあとに何か変わっていれば、実行せず、理由を表示します。",
  publishPlain: "このブランチを push し、プルリクエストを作り、作業の記録を閉じます。",
  publishBack: "公開の画面に戻る",
  publishNotOffered:
    "承認する人が決まるまで、このページからは公開できません。ページ上部で名前を入れてください。",
  publishNotClosed: (status) =>
    "この回はまだ確認で承認されていません" +
    bracketed(STATE_WORDS[status], (word) => `いまの状態: ${word}`) +
    "。公開できるのは、確認で承認された回だけです。",
  publishNotApproved: (outcome) =>
    "確認は、誰も回答しないまま終わっています" +
    bracketed(GATE_OUTCOME_WORDS[outcome], (word) => word) +
    "。公開に必要な承認がありません。",
  publishAnswerNotApproval: (answer) =>
    answer === "revise"
      ? "この回の確認には、承認ではなく変更依頼で回答しています。公開するのは、変更依頼のあとの回です。"
      : "この回の確認に、承認と変更依頼のどちらで回答したかの記録が rondo にありません。" +
        "承認の記録がないため、公開しません。",
  publishNoRun: "この作業の記録がないため、閉じるものがありません。",
  publishPlanField: (field) =>
    `この回の計画に${PLAN_FIELD_WORDS[field] ?? field}が記録されていないため、公開できません。`,
  publishNoRepo:
    "この作業のプルリクエストをどのリポジトリに出すか、rondo に記録がありません。" +
    "このコンピュータで rondo を管理する人に、リポジトリを記録してもらってください。",
  publishTargetRefused:
    "push 先が正しいか確認できないため、公開しません。このコンピュータで rondo を管理する人に確かめてもらってください。",
  publishUncommitted: (paths) =>
    `作業場所に、コミットされていない変更が残っています（${paths}）。` +
    "このまま公開すると、この変更はプルリクエストに含まれません。",
  publishUncommittedElsewhere: (branch) =>
    `作業場所のブランチは ${branch} で、公開するブランチとは別です。`,
  publishUncommittedRemedies:
    "この変更を片付けてから公開してください。回をやり直してワーカーにコミットさせるか、作業場所で自分でコミットするか、作業でない変更なら捨てるかです。" +
    "",
  publishStatusUnreadable:
    "作業場所の状態を読めず、コミットされていない変更が残っているか分からないため、公開しません。" +
    "このコンピュータで rondo を管理する人に作業場所を直してもらい、もう一度確かめてください。",
  publishRecheck: "もう一度確かめる",
  publishReviewHeading: "rondo のチェックが通っていません",
  publishReviewNoReading: "この回は、まだ rondo のチェックが実施されていません。" + "",
  publishReviewNotClear: (verdict, count) =>
    verdict === "concerns" && count > 0
      ? `rondo のチェックで、回答していない指摘が ${String(count)} 件あります。` +
        "読んでから、公開するかを決めてください。"
      : verdict === "unavailable"
        ? "rondo のチェックを実施できませんでした。チェックなしで公開するかを決めてください。"
        : "rondo のチェックの結果が「問題なし」ではありません。読んでから、公開するかを決めてください。",
  publishReviewNoEvidence:
    "rondo のチェックは問題なしとしていますが、何を読んだかの計測が記録されていないため、" +
    "突き合わせて確かめられません。",
  publishReviewUnreadable:
    "作業場所をいま読めないため、チェックした内容と公開する内容が同じかどうか確認できません。",
  publishReviewMoved: (readTip, nowTip) =>
    `rondo のチェックは ${readTip} の時点のもので、いま公開するのは ${nowTip} です。` +
    "チェックのあとにコミットが変わっています。",
  publishDespiteFold: "rondo のチェックが通らないままプルリクエストを作る",
  publishDespiteAction: "それでもプルリクエストを作る",
  publishDespiteNote:
    "押すと、rondo のチェックが通らないまま公開します。その判断は、あなたの名前で記録されます。" +
    "",
  publishDespitePlain: "rondo のチェックが通らないまま公開します。",
  scopeBusy: "範囲を記録しています…",
  nextStepHeading: "次にやること",
  nextStepScope:
    "この依頼の範囲（使ってよい費用と触ってよい場所）がまだ決まっていません。範囲を決めると、" +
    "作業を始められます。",
  nextStepDrafted: "rondo が作業の範囲を提案しました。承認すると作業が始まります。",
  nextStepRondoHeading: "rondo の番です",
  nextStepDrafting:
    "rondo が依頼を読んで、計画を下書きしています。下書きができると、確認する範囲が" +
    "ここに出ます。いまのところ、あなたにしていただくことはありません。",
  nextStepNoDraft:
    "rondo はこの依頼の計画を下書きできませんでした。止まった理由は下のスレッドにあります。" +
    "範囲（使ってよい費用と触ってよい場所）をご自身で決めると、作業を始められます。",
  nextStepAnswer: "rondo があなたの回答を待っています。回答するまで、この依頼の作業は進みません。",
  nextStepStart: "範囲は承認済みです。範囲の画面から作業を始めてください。",
  nextStepStartAction: "作業を始める画面へ",
  nextStepPublish: (merges) =>
    "作業は承認済みです。プルリクエストを作ると、レビューに出ます。" +
    (merges
      ? "チェックが通れば、承認した範囲で rondo がデフォルトブランチにマージします。"
      : "マージはしません。"),
  nextStepPublishing: (updating, merges) =>
    (updating === null
      ? "作業は承認済みです。rondo がプルリクエストを作っています。" + "押すボタンはありません。"
      : `競合の解消は承認済みです。rondo が ${updating} を更新しています。` +
        "押すボタンはありません。") +
    (merges
      ? "チェックが通れば、rondo がデフォルトブランチにマージします。"
      : "マージはしません。"),
  nextStepAddRepository: (named, repo) =>
    `この依頼は ${named} を指していますが、rondo はまだ ${repo} で作業したことがないため、` +
    `下書きはありません。追加すると、${repo} をこのコンピュータにコピーし、` +
    `プルリクエストは ${repo} に出します。`,
  nextStepAddProposedRepository: (repo) =>
    `この依頼にはリポジトリが書かれていません。rondo は ${repo} と読みましたが、` +
    `まだ ${repo} で作業したことがないため、下書きはありません。追加すると、${repo} をこのコンピュータにコピーし、` +
    `作業を下書きしてあなたの承認を待ちます。プルリクエストは ${repo} に出します。` +
    `違うリポジトリなら、追加せずに返信で正しいリポジトリを伝えてください。`,
  nextStepRecordSetupPlan: (files) =>
    "セットアップの計画がまだ記録されていないため、この依頼の下書きはありません。" +
    `このコンピュータのセットアップで、計画が ${String(files)} 件書かれています。` +
    "記録すると、rondo がこの依頼を下書きして、あなたの承認を待ちます。",
  nextStepRunSetup:
    "このコンピュータでは rondo のセットアップがまだ実行されていないため、この依頼の下書きはありません。" +
    "rondo を管理する人がセットアップ（rondo のフォルダの scripts/dogfood-env.sh）を一度実行すると、" +
    "rondo がこの依頼を下書きします。",
  recordSetupPlanAction: "セットアップの計画を記録する",
  addRepositoryAction: "このリポジトリを追加する",
  addRepositoryBack: "依頼に戻る",
  repositoryUnbuilt: (repo) =>
    `${repo} のビルド方法が分からないため、ワーカーはファイルの変更とコミットはできますが、` +
    "ビルドとテストは実行できません。",
  addRepositoryRefusedNoApprover:
    "リポジトリを追加していません。承認する人がまだ決まっていません。前の画面に戻り、上部で名前を入れてから、もう一度押してください。",
  addRepositoryRefusedPress:
    "何も追加していません。この操作は、人がこのページのボタンを押したときだけ受け付けます。",
  addRepositoryRefusedForm:
    "何も追加していません。そのフォームはこのページのものではありません。読み込み直してから" +
    "押してください。",
  addRepositoryRefusedInstall:
    "リポジトリを追加していません。このコンピュータに GitHub CLI が入っていません。" +
    "このコンピュータで rondo を管理する人に入れてもらってください。ボタンはそのまま残っているので、あとでもう一度押せます。",
  addRepositoryRefusedSignedOut:
    "リポジトリを追加していません。このコンピュータの rondo が GitHub にサインインしていません。" +
    "サインインしてから、「このリポジトリを追加する」をもう一度押してください。",
  signInAction: "GitHub にサインインする",
  signInBack: "GitHub へのサインインに戻る",
  signInRefusedNoApprover:
    "サインインを始めていません。承認する人がまだ決まっていません。前の画面に戻り、上部で名前を入れてから、もう一度押してください。",
  signInRefusedPress:
    "サインインを始めていません。この操作は、人がこのページのボタンを押したときだけ受け付けます。",
  signInNone:
    "このコンピュータの rondo は GitHub にサインインしていないため、イシューを読んだりリポジトリを追加したりできません。" +
    "サインインは一度だけで済みます。",
  signInWaiting: "GitHub のサインインページを開き、次のコードを入力してください。",
  signInWaitingNote: "GitHub でサインインが済むと、このページは自動で切り替わります。",
  signInDone: "GitHub にサインインしました。元のページに戻って、ボタンをもう一度押してください。",
  signInNoGh:
    "このコンピュータに GitHub CLI が入っていないため、サインインできません。" +
    "このコンピュータで rondo を管理する人に入れてもらってください。",
  signInFailed: "サインインが終わりませんでした。ボタンを押すと、もう一度試せます。",
  addRepositoryRefusedUnseen:
    "何も追加していません。GitHub にそのリポジトリが無いか、あなたのアカウントからは見えません。" +
    "依頼に書いた名前が違っていれば、返信で正しい名前を伝えてください。",
  addRepositoryRefusedFailed:
    "何も追加していません。今回はリポジトリをコピーできませんでした。もう一度押しても" +
    "大丈夫です。止まったところから続けます。",
  addRepositoryRefusedChanged:
    "この依頼にリポジトリを追加する必要はなくなりました。" +
    "依頼に戻って、いまの状態を確認してください。",
  addRepositoryRefusedNoSetup:
    "このコンピュータでは rondo のセットアップが済んでいません。" +
    "rondo を管理する人にセットアップを実施してもらってください。",
  approveBusy: "承認を記録しています…",
  startBusy: "作業を始めています…",
  reviseBusy: "変更を依頼しています…",
  publishBusy: "プルリクエストを作っています…",
  startStoppedHeldSaid: [
    "始めた作業を続けられなくなりました。rondo はこの作業を終わらせられませんでした。",
    "終わらせるまで、同じ作業は始め直せません。" + "",
    "選べること:",
    "- 作業を終わらせる。この依頼の上の「次にやること」から終わらせて、" +
      "ここで「続ける」と回答すると、rondo が作業をもう一度始めます。",
    "- この作業を止める。あきらめるもの: この依頼の作業。",
    "おすすめ: 作業を終わらせる。",
    "このメッセージに回答するまで、この作業は止まったままです。",
  ].join("\n"),
  lapStoppedSaid: (said) =>
    [
      `作業が途中で止まりました。${said ?? "何が起きたかは、このスレッドの作業の行に出ています。"}`,
      "選べること:",
      "- 続ける。作業をもう一度始めます。あきらめるもの: この回でコミットしていない変更。",
      "- この作業を止める。あきらめるもの: この依頼の作業。",
      "おすすめ: 続ける。",
      "このメッセージに回答するまで、この作業は止まったままです。",
    ].join("\n"),
  lapBudgetStoppedSaid: (said) =>
    [
      `作業が予算の上限で止まりました。${said ?? "何が起きたかは、このスレッドの作業の行に出ています。"}`,
      "選べること:",
      "- 予算を増やして続ける。rondo が最後のコミットからもう一度始めます。あきらめるもの: " +
        "増やした分の費用と、この回でコミットしていない変更。",
      "- 同じ予算のまま続ける。あきらめるもの: この回で" +
        "コミットしていない変更。予算の残りが少ないと、また止まります。",
      "- この作業を止める。あきらめるもの: この依頼の作業。",
      "おすすめ: 予算を増やして続ける。",
      "このメッセージに回答するまで、この作業は止まったままです。",
    ].join("\n"),
  lapLostAsk: [
    "作業の途中で rondo が再起動され、この回は失われました。動いているものはなく、" +
      "費用もかかっていません。",
    "選べること:",
    "- この作業をもう一度始める（「続ける」と回答する）。あきらめるもの: 失われた回でコミットしていない変更。",
    "- 作業の内容を変える（「この作業を止める」と回答してから、依頼し直す）。あきらめるもの: この作業。",
    "- 止める（「この作業を止める」と回答する）。あきらめるもの: この作業。",
    "おすすめ: この作業をもう一度始める。",
    "このメッセージに回答するまで、この作業は止まったままです。",
  ].join("\n"),
  lapEndedAsk: (reason) =>
    [
      "この作業はあなたが終わらせました。動いているものはなく、" + "費用もかかっていません。",
      `あなたが書いた理由: ${reason}`,
      "選べること:",
      "- この作業をもう一度始める（「続ける」と回答する）。あきらめるもの: 終わらせた回でコミットしていない変更。",
      "- 作業の内容を変える（「この作業を止める」と回答してから、依頼し直す）。あきらめるもの: この作業。",
      "- 止める（「この作業を止める」と回答する）。あきらめるもの: この作業。",
      "おすすめ: この作業をもう一度始める。理由が作業そのものを変えるべきだという内容なら、作業の内容を変える。",
      "このメッセージに回答するまで、この作業は止まったままです。",
    ].join("\n"),
  lapEndedUnreadableAsk: (reason) =>
    [
      "rondo が読めなくなっていたこの作業を、あなたが終わらせました。" +
        "コミットしていなかった変更は残っていません。",
      `あなたが書いた理由: ${reason}`,
      "選べること:",
      "- 続ける（「続ける」と回答する）。rondo が依頼の内容から、作業を計画し直します。",
      "- 作業の内容を変える（「この作業を止める」と回答してから、依頼し直す）。あきらめるもの: この依頼の作業。",
      "- 止める（「この作業を止める」と回答する）。あきらめるもの: この依頼の作業。",
      "おすすめ: 続ける。",
      "このメッセージに回答するまで、この作業は止まったままです。",
    ].join("\n"),
  flowStopWithdrawn: [
    "この停止は取り下げました。失敗と見ていた依頼が、失敗ではなくなりました。" + "" + "",
    "rondo は目標の依頼を続けます。回答は不要です。",
  ].join("\n"),
  flowDraftRefusedAsk: [
    "rondo はこの依頼の計画を下書きできませんでした。そのため作業は何も始まっていません。" +
      "弾かれたのは rondo が書いた下書きで、あなたの依頼ではありません。",
    "選べること:",
    "- 依頼を言い換えて、もう一度頼む。あきらめるもの: なし。この依頼はこのまま残ります。",
    "- この依頼を止める（「この作業を止める」と回答する）。あきらめるもの: この依頼の作業。",
    "おすすめ: 依頼を言い換えて、もう一度依頼する。",
    "rondo は目標のほかの依頼を続けます。この依頼の下書きを rondo がやり直すことはありません。",
  ].join("\n"),
  startStoppedSaid: [
    "始めた作業を続けられなくなったため、rondo が終わらせました。",
    "動いているものはなく、費用もかかっていません。" + "",
    "選べること:",
    "- もう一度始める。依頼の内容から始め直します。あきらめるもの: この回でできたもの。",
    "- この作業を止める。あきらめるもの: この依頼の作業。",
    "おすすめ: もう一度始める。",
    "このメッセージに回答するまで、この作業は止まったままです。",
  ].join("\n"),
  startBusyNote:
    "受け付けました。作業の準備をしています。動き出したらすぐ依頼のスレッドに移り、" +
    "そこで進み具合が分かります。もう一度押す必要はありません。",
  lapBusyNote:
    "受け付けました。作業が開始されました。確認が必要になると、この画面が切り替わります。" +
    "数分、長いと数十分かかります。もう一度押す必要はありません。" +
    "別のタブで一覧を開くと、作業中だと分かります。",
  publishBusyNote:
    "受け付けました。ブランチを push してプルリクエストを作っています。たいてい 1 分以内に" +
    "終わります。もう一度押す必要はありません。",
  publishRefusedNoApprover:
    "何も公開していません。承認する人がまだ決まっていません。前の画面に戻り、上部で名前を入れてから、もう一度押してください。",
  publishRefusedPress:
    "何も公開していません。公開は人がこのページのボタンを押して行うもので、スクリプトからは" +
    "できません。",
  publishRefusedForm:
    "何も公開していません。そのフォームはこのページのものではありません。読み込み直してから" +
    "押してください。",
  publishRefusedGone: "この回の記録が見つからないため、公開できません。一覧に戻ってください。",
  publishRefusedNotClosed: "公開していません。この回は、確認で承認されていません。",
  publishRefusedNotApproved: "公開していません。この回の確認に承認がありません。",
  publishRefusedNoRun: "公開していません。この回の作業の記録が見つかりません。",
  publishRefusedPlanField: "公開していません。この回の計画に、公開に必要な情報が足りません。",
  publishRefusedNoRepo:
    "何も公開していません。プルリクエストをどのリポジトリに出すか、rondo に記録がありません。" +
    "このコンピュータで rondo を管理する人に記録してもらってください。",
  publishRefusedTarget: () => "何も公開していません。push 先が正しいか確認できませんでした。",
  publishRefusedUncommitted: (detail) =>
    `公開していません。作業場所に、コミットされていない変更が残っています（${detail}）。`,
  publishRefusedStatusUnreadable: () =>
    "公開していません。作業場所の状態を読めず、コミットされていない変更が残っているか" +
    "分かりません。",
  publishRefusedNotRead:
    "公開していません。画面を開いたあとに、rondo のチェックが通らなくなりました。" +
    "公開の画面に戻って、それでも公開するかを決めてください。",
  publishRefusedNothingOverruled:
    "公開していません。rondo のチェックは通っているので、チェックなしで公開する必要はありません。" +
    "公開の画面に戻って、「プルリクエストを作る」を押してください。",
  publishRefusedChanged:
    "何も公開していません。画面に出ていた内容と、いま公開したら起きることが食い違っています。" +
    "読み込み直し、もう一度読んでから押してください。",
  publishRefusedStillRunning:
    "二重には公開していません。この回の公開は、すでに進んでいました。結果は公開の画面に" +
    "表示されます。",
  publishRefusedNoContinuo:
    "公開していません。rondo の一部が起動せず、push も行っていません。" +
    "このコンピュータで rondo を管理する人に確かめてもらってください。",
  publishRefusedPushFailed: () => "何も公開していません。ブランチを push できませんでした。",
  publishRefusedPullRequestFailed: () =>
    "ブランチは push できましたが、プルリクエストは作れませんでした。" +
    "戻って「プルリクエストを作る」をもう一度押してください。" +
    "すでにプルリクエストができていた場合は、残りの手続きだけ済ませます。",
  publishRefusedRunNotClosed:
    "ブランチは push 済みで、プルリクエストもできていますが、作業の記録はまだ閉じていません。" +
    "戻って「プルリクエストを作る」をもう一度押すと閉じます。",
  nextStepMerge:
    "プルリクエストのチェックが通り、回答待ちのものもありません。" +
    "マージすると、プルリクエストのマージ先のブランチに取り込みます。" +
    "マージはこのページからは取り消せません。",
  mergeAction: "プルリクエストをマージする",
  mergeConfirmHeading: "この作業のプルリクエストをマージする",
  mergeConfirmInto: (pullRequest, base) =>
    `${pullRequest} を ${base} へ、リポジトリが許す方法で取り込みます。`,
  mergeConfirmCommit: (commit) =>
    `マージするのはプルリクエストの最新のコミット ${commit} です。チェックはこのコミットで通っています。`,
  mergeConfirmNoUndo:
    "マージはこのページからは取り消せません。この画面を開いたあとにプルリクエストが変わっていれば、" +
    "マージせず、何が変わったかを依頼のスレッドに表示します。",
  mergeConfirmMore: (count) => `ほか ${String(count)} 件`,
  mergeConfirmNotNow: "いまはここからマージできません。次にやることは依頼の画面にあります。",
  nextStepMergeMoved: (count) =>
    `プルリクエストのチェックが通りました。ただし、この作業のものではないコミットが ${String(count)} 件含まれています（上に挙げています）。マージすると、それもいっしょに取り込みます。マージはこのページからは取り消せません。取り込みたくなければ、ボタンを押さないでください。`,
  mergeMovedAction: "そのコミットも含めてマージする",
  mergeBusy: "マージしています…",
  mergeBusyNote:
    "受け付けました。GitHub にマージを依頼しています。ふつうは数秒で終わります。" +
    "もう一度押す必要はありません。",
  mergeBack: "依頼に戻る",
  mergeRefusedNoApprover:
    "マージしていません。承認する人がまだ決まっていません。前の画面に戻り、上部で名前を入れてから、もう一度押してください。",
  mergeRefusedPress:
    "マージしていません。マージは人がこのページのボタンを押して行うもので、スクリプトからは" +
    "できません。",
  mergeRefusedForm:
    "マージしていません。そのフォームはこのページのものではありません。読み込み直してから" +
    "押してください。",
  mergeRefusedGone:
    "マージしていません。この作業がもう読めません。ページを読み込み直してください。",
  mergeRefusedNotPublished: "マージしていません。この作業のプルリクエストがまだありません。",
  mergeRefusedNotGreen:
    "マージしていません。プルリクエストの最新のコミットで、チェックが通ったことを確認できていません。" +
    "チェックの結果を確かめてから、もう一度押してください。",
  mergeRefusedAsked:
    "マージしていません。この作業には、あなたの回答を待っている質問や確認が残っています。" +
    "先に答えてください。",
  mergeRefusedMerged: "マージしていません。このプルリクエストはすでにマージ済みです。",
  mergeRefusedLanded:
    "マージしていません。この作業はすでにデフォルトブランチに入っているので、マージするものが" +
    "残っていません。",
  mergeRefusedMoved:
    "マージしていません。rondo がチェックの結果を確かめたあとで、プルリクエストに新しいコミットが" +
    "加わりました。マージの画面にそのコミットが表示されます。",
  mergeRefusedRetargeted:
    "マージしていません。プルリクエストの取り込み先が、rondo が開いたときのブランチから変わっています。" +
    "GitHub で確かめてください。",
  mergeRefusedClosed: "マージしていません。プルリクエストが閉じられています。",
  mergeRefusedMethod: "マージしていません。リポジトリがどのマージ方法も許していません。",
  mergeRefusedForge:
    "マージしていません。プルリクエストについて GitHub から返事がありませんでした。少し待って" +
    "もう一度押してください。",
  mergeRefusedFailed: (detail) =>
    `マージしていません。GitHub がマージを断りました。返ってきた理由: ${detail}`,
  mergeRefusedQueue:
    "マージしていません。このリポジトリはマージキューを通してマージするので、押した時点では" +
    "マージされません。GitHub でマージしてください。",
  mergeRefusedUnconfirmed:
    "GitHub はマージを受け付けましたが、マージされたことを rondo は確かめられませんでした" +
    "（リポジトリがマージキューを使っているか、GitHub から返事がありませんでした）。" +
    "もう一度押す前に、GitHub でプルリクエストを確かめてください。",
  mergeRefusedInFlight:
    "今回はマージしていません。このプルリクエストのマージはすでに進んでいます。少し待って" +
    "から依頼に戻り、結果を確かめてください。",
  publishRefusedNotStarted:
    "公開を始められませんでした。ここで見た内容は失われていません。" +
    "何が起きたかは、このコンピュータで rondo を管理する人が確かめられます。",
  nextStepConflictFix: (pullRequest, base) =>
    `${pullRequest} は ${base} と競合していて、チェックが動きません。rondo が ${base} を` +
    "取り込んで競合を解消できます。ほかの変更はしません。" +
    "解消した結果は、プルリクエストを更新する前にここで確認できます。",
  nextStepConflictFixing: (pullRequest, base) =>
    `${pullRequest} は ${base} と競合しています。` +
    `承認した範囲で、rondo が ${base} を取り込んで競合を解消しています。ほかの変更はしません。` +
    "押すボタンはありません。解消した結果は、プルリクエストを更新する前にここで確認できます。",
  conflictFixLeft: (reason) => `rondo は自分でこの解消を始めようとしました。${reason}`,
  conflictFixAction: "rondo に競合を解消してもらう",
  conflictFixBusy: "解消を始めています…",
  conflictFixBack: "依頼に戻る",
  nextStepChecksFix: (pullRequest, checks) =>
    `${pullRequest} のチェックが通りませんでした${checks === null ? "" : `（${checks}）`}。rondo がプルリクエストのブランチで` +
    "失敗を再現して直せます。ほかの変更はしません。直した結果は、プルリクエストを更新する前にここで確認できます。",
  checksFixAction: "rondo に失敗したチェックを再現して直してもらう",
  checksFixBusy: "修正を始めています…",
  conflictFixRefusedNoApprover:
    "作業を始めていません。承認する人がまだ決まっていません。前の画面に戻り、上部で名前を入れてから、もう一度押してください。",
  conflictFixRefusedPress:
    "何も始めていません。この操作は、人がこのページのボタンを押したときだけ受け付けます。",
  conflictFixRefusedForm:
    "何も始めていません。そのフォームはこのページのものではありません。読み込み直してから" +
    "押してください。",
  conflictFixRefusedGone:
    "何も始めていません。プルリクエストにもう解消が要らないか、すでに解消が進んでいます。" +
    "ページを読み込み直すと、いまの状態が分かります。",
  conflictFixRefusedNotItsScope:
    "この画面を表示したあとに承認内容が変わったため、解消は始めていません。スレッドは" +
    "いまの承認内容に変わっています。",
  conflictFixRefusedForked:
    "この作業の承認が別々に 2 つあるため、" + "rondo はどちらも使わず、解消は始めていません。",
  conflictFixRefusedNoContinuo:
    "作業を開始する仕組みが起動しませんでした。このコンピュータで rondo を管理する人に確かめてもらってください。",
  conflictFixRefusedNotSetUp:
    "解消の準備ができませんでした。何が起きたかは、このコンピュータで rondo を" +
    "管理する人が確かめられます。",
  conflictFixRefusedOutside: (test) =>
    `何も始めておらず、費用もかかっていません。もう 1 回は承認した範囲を超えます（${test}）。` +
    `選べることは、依頼のスレッドの rondo のメッセージにあります。`,
  conflictFixRefusedNotStarted:
    "解消を始められませんでした。ここで見た内容は失われていません。何が起きたかは、このコンピュータで" +
    " rondo を管理する人が確かめられます。",
  retakeReviewAction: "レビューをもう一度受ける",
  retakeReviewBusy: "レビューをもう一度受けています…",
  retakeReviewBack: "確認に戻る",
  retakeRefusedNoApprover:
    "レビューはやり直していません。承認する人がまだ決まっていません。前の画面に戻り、上部で名前を入れてから、もう一度押してください。",
  retakeRefusedPress:
    "レビューはやり直していません。この操作は、人がこのページのボタンを押したときだけ受け付けます。",
  retakeRefusedForm:
    "レビューはやり直していません。そのフォームはこのページのものではありません。" +
    "読み込み直してから押してください。",
  retakeRefusedGone:
    "レビューはやり直していません。この確認はもう終わっているか、レビューは" +
    "すでにやり直されています。ページを読み込み直すと、いまの状態が分かります。",
  retakeRefusedBudget: (taken, budget) =>
    `レビューはやり直していません。承認したレビュー ${String(budget)} 回のうち ${String(taken)} 回を使っていて、やり直すと 1 回増えます。承認のレビュー回数を引き上げれば、やり直せます。`,
  retakeRefusedForked:
    "レビューはやり直していません。この作業の予算が別々に 2 回引き上げられていて、レビューがあと何回できるかが決まりません。",
  retakeRefusedNoContinuo:
    "レビューはやり直していません。作業を開始する仕組みが起動しませんでした。このコンピュータで rondo を管理する人に確かめてもらってください。",
  nextStepPublishUpdate: (pullRequest, merges) =>
    `競合の解消は承認済みです。公開すると ${pullRequest} に push し、チェックがもう一度` +
    "動きます。" +
    (merges
      ? "チェックが通れば、承認した範囲で rondo がデフォルトブランチにマージします。"
      : "マージはしません。"),
  publishUpdates: (pullRequest, base) =>
    `${base} 向けに開いている ${pullRequest} へ push します。プルリクエストは新しく作りません。`,
  publishUpdateAction: (pullRequest) => `プルリクエスト ${pullRequest} を更新する`,
  publishBusyUpdate: "プルリクエストを更新しています…",
  publishPlainUpdate: "このブランチを開いているプルリクエストへ push し、作業の記録を閉じます。",
  publishNoteUpdate: (merges) =>
    "ボタンを押すと、rondo があなたの名前で、開いているプルリクエストへ push し、作業の記録を閉じます。" +
    (merges
      ? "プルリクエストは新しく作りません。" +
        "チェックが通れば、承認した範囲にしたがって rondo がデフォルトブランチにマージします。"
      : "プルリクエストは作らず、マージもしません。") +
    "画面を開いたあとに何か変わっていたり、" +
    "プルリクエストが閉じていたりすれば、実行せず、理由を表示します。",
} satisfies Chrome);
