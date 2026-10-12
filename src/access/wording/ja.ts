/**
 * The Japanese set of rondo's own prose, a whole {@link Chrome} (D-0079). The
 * type and the selection among sets are in `src/access/wording.ts`.
 */

import { APPROVED_OUTCOME } from "../../store/records.js";
import type { GateAuto, GateAutoReason } from "../gate-auto.js";
import { EXPLAIN_JA } from "../page/explain-words.js";
import { REPORT_JA } from "../page/report-words.js";
import { SINCE_JA } from "../page/since-words.js";
import { PAGE_JA } from "../page/words.js";
import type { AgentTypeSource, Chrome } from "../wording.js";

/** The same three, as the {@link JA} set says them. */
function agentTypeSourceJa(from: AgentTypeSource): string {
  switch (from) {
    case "iteration":
      return "その回の計画";
    case "scope":
      return "範囲に記録された計画";
    default:
      return "この範囲に記録された計画";
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
      return "範囲が新しいものに置き換わっています";
    case "scope_expired":
      return "範囲の期限が切れています";
    case "checks_not_clear":
      return "チェックが通っていません";
    case "model_pending":
      return "モデルレビューがまだ届いていません";
    case "model_unavailable":
      return "モデルレビューを受け取れませんでした";
    case "model_ungraded":
      return "モデルレビューの重大度が読み取れません";
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
      return "修正の回で、失敗の再現と、そのあとテストが通った実行が見つかりません";
    case "tests_all_skipped":
      return "最後の実行ではテストがすべてスキップされていて、何も確かめられていません";
    case "question_open":
      return "答えていない質問があります";
    case "closing_lap":
      return "締めの回です";
  }
}

function gateAutoJa(auto: GateAuto): string {
  return auto.kind === "would_not_approve"
    ? `自動では承認しません: ${auto.reasons.map(gateAutoReasonJa).join("、")}。`
    : "rondo ならこの回を自動で承認します。";
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
      return "この範囲は新しいものに置き換わっています";
    case "request":
      return "この依頼は、この範囲に含まれていません";
    case "workspace":
      return "この作業が動く場所は、この範囲に含まれていません";
    case "agent_type":
      return "この作業のエージェント種別は、この範囲では許可されていません";
    case "contract":
      return "この作業には、そのエージェント種別に許された以上の権限が要ります";
    case "irreversible":
      return "この作業には、範囲が取り返しのつかない操作として禁じているものが含まれます";
    case "expiry":
      return "範囲の期限が切れています";
    case "laps":
      return "範囲で承認した回数を使い切っています";
    case "cost":
      return "費用がまだ確定していない回の分も見込むと、範囲の予算にもう 1 回分の余裕がありません";
    case "asks":
      return "依頼のスレッドにある質問が、この作業を止めています。どの質問かはスレッドで分かります";
    case "grants":
      return "この作業に許すことが、前の回より増えます";
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
  ...REPORT_JA,
  lang: "ja",

  liveNote: (seconds) =>
    `${String(seconds)}秒ごとに画面を更新しますが、更新では何も記録しません。「最後に見た」の記録も、
見た回数も変わりません。記録するのは「承認する」ボタンだけで、押した時点の説明を記録してから
確認に答えます。`,
  stillNote: `この画面はひとりでに書き換わりません。ボタンを押したときに記録されるのは、いま読んでいる
内容そのものだからです。読むだけでは何も記録されず、「最後に見た」の記録も見た回数も変わりません。
記録するのは「承認する」ボタンだけで、押した時点の説明を記録してから確認に答えます。`,
  noApproverNote:
    "RONDO_APPROVER が設定されていないため、このページは誰として答えるのかが決まらず、" +
    "その人の inbox も表示できません。",

  // rondo#439: the status in the person's words, one line and no ` -- `.
  endedHead: (status, since, why) =>
    `${since}前に${({ closed: "終了", failed: "失敗", abandoned: "放棄" } as Record<string, string | undefined>)[status] ?? status}・${why}`,
  gateAnswered: (outcome) =>
    outcome === APPROVED_OUTCOME ? "確認で承認された" : `確認に '${outcome}' と答えた`,
  statePill: (status, gateOutcome) =>
    (
      ({
        awaiting_human: "あなたの回答待ち",
        withdrawal_requested: "取り下げ依頼中",
        stalled: "止まっている",
        planned: "開始中",
        classified: "開始中",
        admitting: "開始中",
        admitted: "開始中",
        performing: "実行中",
        closed:
          gateOutcome === "approve" || gateOutcome === APPROVED_OUTCOME
            ? "承認済み"
            : gateOutcome === "revise"
              ? "変更を頼んだ"
              : gateOutcome === null
                ? "完了"
                : `完了: ${gateOutcome}`,
        abandoned: "放棄",
        failed: "失敗",
      }) as Record<string, string | undefined>
    )[status] ?? status,
  noReasonRecorded: "理由は記録されていない",
  aboutIteration: (iterationId) =>
    iterationId === null ? "対象の回なし" : `'${iterationId}' について`,
  willNotDecode: (reason) => `読み取れません: ${reason}`,

  spent: (cost, turns, took) => `${cost}、${turns}、${took}`,
  fenceUnknown: "実行の制限: 何を止めたかは記録に残っていません",
  fenceRefusedNothing: "実行の制限で止めたコマンドはありません",
  fenceRefused: (denials) => `実行の制限で止めたコマンド: ${denials}`,

  pressNote: "「承認する」を押したときに、見たうえで答えたと記録される内容と、その答えの対象です。",
  approveNote: (gateId, word) => `確認 ${gateId} に '${word}' と答えます。rondo answer と同じです`,

  asksWaiting: (count) => `あなたへの質問 ${String(count)}`,
  askWaitingPill: "あなたの回答待ち",
  askStoppedPill: "あなたが止めた作業",
  answerStoppedPill: "この作業を止めた",
  answerCarriedOnPill: "続けた",
  answerChosePill: (option) => `${String(option)} を選んだ`,
  askedChangePill: "変更を頼んだ",
  reviseWaitsOnQuestion:
    "作業者の質問に答えるまで、変更は頼めません。" +
    "ここに書いた文は、質問に答えて戻ってきても残っています。",
  reviseWaitsLink: "質問へ",
  reviseWaitsOnStopped:
    "作業者の質問に「この作業を止める」と答えているため、変更は頼めません。頼むには、" +
    "質問に「続ける」と答え直してください。ここに書いた文は、戻ってきても残っています。",
  reviseRefusedAsks:
    "変更は送られていません。作業者の質問がまだこの作業を止めています。答えていないか、" +
    "止めると答えたままです。確認待ちも予算もそのままです。質問に「続ける」と答えてから、もう一度" +
    "押してください。書いた文は欄に残っています。",
  you: "あなた",
  drafterNoDraft:
    "この依頼の下書きを rondo が作れなかったため、提案はまだありません。範囲はあなたが" +
    "決められます。",
  drafterNoDraftWhy: "止まった理由",
  drafterRedrafted: "最初の下書きは通らなかったため、rondo がもう一度下書きしました。",
  issueRead: (pullRequest, comments) =>
    `rondo がこの${pullRequest ? "プルリクエストの会話" : "イシュー"}` +
    `${comments === 0 ? "" : `とコメント ${String(comments)} 件`}を読みました。` +
    "作業者には書かれたとおりの全文が渡されます。",
  issueReadFold: "読んだ内容",
  issueNotRead: (why) =>
    ({
      no_gh: "このコンピュータの rondo はまだイシューを読めません",
      signed_out: "このコンピュータの rondo はまだイシューを読めません",
      no_repo: "このコンピュータの rondo には、この番号がどのリポジトリのものか分かりません",
      missing: "このイシューが見つからないか、あなたのアカウントからは見えません",
      refused: "あなたのアカウントでは、このイシューを見る権限がありません",
      too_long: "イシューが長すぎて丸ごとは渡せません。一部だけを渡すこともしません",
      too_many:
        "1 つのメッセージから rondo が読むイシューは 5 件までで、このイシューは 6 件目以降でした",
      failed: "rondo はこのイシューを読めませんでした",
    })[why] + "。そのため作業者には、ここにあなたが書いたことだけが渡されます。",
  issueNotReadTail:
    "費用はかかっていません。イシューに書いてあって依頼には書いていないことがあれば、別のメッセージで" +
    "伝えてください。",
  issuePending: "rondo はまだこのイシューを読んでいません。rondo が動いている間に読みます。",
  scopeIssuesHeading: "この依頼が名指ししたイシュー",
  scopeIssueGiven: "作業者に渡す",
  scopeIssueNotGiven: "渡さない (読めなかったため)",
  scopeIssuePending: "まだ読んでいない",
  scopeDoneHeading: "完了の条件 (rondo がどの回にも付けます)",
  scopeDoneAsks: [
    "作業はこの回のブランチにコミットする。",
    "報告の前に、リポジトリが定める手順でインストールと検証を回す。",
    "検証が回せない・通らないときは報告でそう言い、通ったとは言わない。",
  ],
  scopeDoneRules: (files) => `手順はリポジトリの ${files.join("、")} に従うよう伝えます。`,
  scopeDoneNoRules:
    "この計画では手順を書いたファイルを指定していないため、作業者がリポジトリの文書から手順を探します。",
  scopeDoneExact: "作業者に送る文面 (英語)",
  inReplyTo: (who, words) => `${who} への返信: ${words}`,
  basesLabel: "根拠",
  replyAction: "返信する",
  replyingTo: (who, since) => `${who} に返信 · ${since}前`,
  answeringTo: (who, since) => `${who} の質問に答える · ${since}前`,
  answerAskAction: "答える",
  answerCarryOnAction: "続ける",
  answerStopAction: "この作業を止める",
  answerOutcomeNote:
    "書いたとおりに送られます。「続ける」を押すともう一度試し、「この作業を止める」を押すと止めたままになります。" +
    "あとから「続ける」こともできます。",
  answerInMyWordsAction: "自分の言葉で答える",
  answerRecommended: "おすすめ",
  answerOptionsNote:
    "選択肢はどれも押すだけで答えになり、書いた文も一緒に送られます。" +
    "「この作業を止める」は止めたままにし、あとから答え直せます。",
  answerRaiseAction: "予算を増やして続ける",
  answerReviseNote: "「続ける」を押すと、この答えを渡して次の回をすぐに始めます。",
  answerReviseOptionsNote:
    "選択肢のどれか、または「自分の言葉で答える」を押すと、この答えを渡して次の回をすぐに始めます。",
  answerReviseDraftLead: "次の回には、下の変更も一緒に渡します。",
  answerReviseCallsSend: "判断が要る次の点も一緒に送る（回答と食い違う点は回答に従います）:",
  answerRaiseLabel: "これからの予算（USD）",
  answerRaiseRoundsLabel: "この作業のレビュー回数",
  answerRaiseLeft: (left, reserve, enough) =>
    `この承認の残りは $${left} で、次の 1 回に見込む $${reserve} に` +
    `${enough ? "足ります" : "足りません"}。増やすと、予算だけを変えた新しい承認が記録され、` +
    "これまでに使った額は元の承認に残ります。",
  answerRaisePaused:
    "この目標に向けた作業は一時停止中のため、ここで予算を増やしてもまた止まります。先に再開してください。",
  newRequestHeading: "新しい依頼",
  requestPlaceholder: "何をしてほしいですか。話すときの言葉のまま書いてください。",
  replyPlaceholder: "返信を書く",
  sendAction: "送信",
  sendNote: "書いたとおりに送られます。直すときは、もう一度返信します。",
  keySend: "送信",
  composerNoApprover:
    "RONDO_APPROVER が設定されていないため、このページが誰として送るのかが決まりません。スレッドは読めますが、書き込めません。",
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
    "RONDO_APPROVER が設定されていないため、このページが誰として送るのかが決まりません。",
  sendRefusedForm:
    "このページ自身のフォームから届いていないか、ページが今の rondo より古いものです。ページを読み込み直してから、もう一度送信してください。",
  sendRefusedNoWords: "送る文がありません。",
  sendRefusedNotTaken:
    "このメッセージは記録されませんでした。返信先のメッセージがスレッドに無いのかもしれません。スレッドを読み込み直してから、もう一度試してください。",
  sendRefusedAsk:
    "返信先は、まだあなたの答えを待っている質問です。スレッドを開いて「答える」を押してください。",
  sendRefusedTooLong:
    "このページが受け付けるより長いメッセージです。短くするか、2 つの返信に分けてください。",
  sendRefusedUnknown:
    "rondo はこのメッセージを受け取りませんでした。ページを読み込み直してから、もう一度送信してください。",
  answerRefusedPress:
    "答えは、このページのボタンを押したときだけ受け付けます。スレッドを読み込み直して、もう一度ボタンを押してください。",
  answerRefusedRaise:
    "予算は増えておらず、質問にもまだ答えていません。承認がすでに増やされたか、置き換えられた" +
    "可能性があります。スレッドを読み込み直して、もう一度答えてください。",
  answerRefusedNoWords:
    "「自分の言葉で答える」には文が要ります。書くか、選択肢のどれかを押してください。",
  replyNotAnswer: "返信しただけでは、このスレッドで待っている質問に答えたことになりません。",
  sendBack: "スレッドに戻る",
  sendBackNote: "ブラウザの「戻る」で、書いた文に戻れます。",
  threadsLiveNote: (seconds) =>
    `${String(seconds)}秒ごとに画面を更新しますが、更新では何も記録しません。記録するのは送信だけで、` +
    "書いた文をそのまま RONDO_APPROVER の名前でスレッドに残します。メッセージを送っても、何かを承認したことにはなりません。",
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
  signedInAs: (actorId) => `${actorId} として送り、答えます`,
  replyDefault: "最新のメッセージへの返信に戻す",
  blockedCount: (count) => `${String(count)} 件のコマンドを止めた`,
  blockedNothing: "止めたコマンドなし",
  blockedUnknown: "止めたコマンドは不明",
  fenceHeading: "実行の制限:",
  fenceMeaning:
    "これらのコマンドは、この回に許された範囲の外だったため、実行前に止められました。何も変えていません。" +
    "作業者はこれらなしで作業を続けました。止めたものの中に作業に必要な手順 (チェック、インストール、push など) があれば、" +
    "結果にその手順が欠けているかもしれませんが、必要だったかどうかは rondo には判断できません。",
  reportHeading: "作業者の報告",
  reportFold: "作業者が書いたとおりの全文",
  reportNotRead: "作業者の報告は読み取れませんでした。報告があれば、下の全文の中にあります。",
  workHeading: "変わったもの",
  changedAgainst: (baseRef) => `${baseRef} との比較`,
  changedUnreadable:
    "作業する場所を読み取れなかったため、この作業で何が変わったかをここには出せません。" +
    "作業する場所がまだ残っているかどうかは、このコンピュータで rondo を管理する人に確かめてもらえます。",
  changedNoRange: "比べる相手のブランチが記録されていないので、変更を一覧にできません。",
  noCommits: "ブランチにコミットはありません。",
  noFiles: "変わったファイルはありません。",
  binaryFile: "バイナリ",
  moreRows: (count) => `ほか ${String(count)} 件`,
  reachHeading: "受け持つファイルの外に出た変更",
  reachCollided: (paths) =>
    `この作業は ${filesJa(paths)} を変更しましたが、別の作業が受け持っているファイルです。` +
    "同じファイルを二つの作業が書き換えているので、マージのときにぶつかります。" +
    "承認する前に、もう一方の作業を見てください。",
  reachUnheld: (paths) =>
    `この作業は ${filesJa(paths)} を変更しましたが、自分が受け持つと言ったファイルの外です。` +
    "ほかに受け持っている作業はないので、止まるものはありません。受け持つ範囲は広げていません。" +
    "広げるかどうかは、あなたが決めます。",
  reachUnread:
    "この作業が変更したものと、受け持つファイルとを突き合わせられませんでした。" +
    "別の作業のファイルが混じっているかどうかは、rondo には分かりません。",
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
  checksNone:
    "この作業をチェックした記録がありません。公開するときに、そのまま進めてよいかを尋ねます。",
  checksCounted: (commits, files) =>
    `コミット ${String(commits)} 件とファイル ${String(files)} 件を読みました。`,
  whatItRead: "読んだものと読んでいないもの",
  checksReader: "rondo のチェック",
  workerRan: "作業者が実行したもの",
  workerRanUnrecorded:
    "この回で作業者が何を実行したかは記録に残っていないため、テストが走ったかどうかは rondo には分かりません。",
  workerRanNone: (commands) =>
    `この回に記録されたコマンド ${String(commands)} 件の中に、rondo が読み取れるテスト実行はありませんでした。` +
    "テストが走らなかった、という意味ではありません。",
  workerCount: (kind, count) =>
    `${{ passed: "成功", failed: "失敗", skipped: "スキップ" }[kind]} ${String(count)}`,
  workerRanErrored: "コマンド自体はエラーで終わっています。",
  workerRanEarlier: (runs) => `これより前にも ${String(runs)} 回実行しています`,
  workerRanSuperseded: (line) =>
    `作業者はこの後にテスト全体をもう一度実行し (作業記録 ${String(line)} 行目)、そちらはエラーなく終わっています。` +
    "そのため、この失敗はこの回の結果ではありません。テストが失敗することを確かめるために、作業者がわざとコードを壊してから戻した可能性があります。",
  workerRanSource: (line) =>
    `この回に記録されたコマンド (作業記録 ${String(line)} 行目) を rondo が読み取ったものです。` +
    "rondo が実行したのではありません。",
  readingCovered: (reach) => {
    const built =
      "ビルドもテストも、何も実行していません。rondo はこの回の作業を動かせないためです。" +
      "この回に求められた検証が実際に行われたかどうかは確かめておらず、行われたとも言っていません。";
    switch (reach) {
      case "model":
        return (
          "読んだのは、コミット済みの差分、コミットメッセージ、この回への指示、作業記録に残ったコマンドと" +
          "その出力、それに渡されたリポジトリの決まりごとです。自分では何も実行していません。" +
          "判定の前提となる情報は渡しましたが、それが理解されたかどうかは確かめようがありません。"
        );
      case "history":
        return (
          `${built}読んだのはコミット済みの履歴だけで、この回が頼まれたとおりのことをしたかどうかは` +
          "判断できません。"
        );
      case "historyAndStatus":
        return (
          `${built}読んだのはコミット済みの履歴と、作業する場所に残るコミットされていない変更で、` +
          "この回が頼まれたとおりのことをしたかどうかは判断できません。"
        );
      default:
        return "このレビューが何を見たかは記録に残っていないため、どこまで確かめたかは分かりません。";
    }
  },
  basisNone: "根拠の指定なし",
  basisUnresolved: "どれも渡した作業と一致しませんでした",
  modelPending: "まだ届いていません。あとから届くことがあります。",
  modelOlder: "前のコミットを読んだ結果です。いまのコミットの分は、あとから届くことがあります。",
  reloadPage: "読み込み直す",
  readingsNote:
    "どちらの結果も、判断の前提として見てください。どちらも何かを承認するものではなく、承認するかどうかを決めるのはあなたです。",
  allAsText: "記録全文 (上に出していない項目も含む)",
  claimLabel: "確かめたこと (承認と一緒に記録されます)",
  claimPlaceholder: "例: 手元でテストを実行した / 差分を読んだ / スマートフォンで画面を開いた",
  claimTooLong: (max) =>
    `確かめた内容が長すぎます。このページで受け付けられるのは ${String(max)} 文字までです。短くしてから、もう一度「承認する」を押してください。`,
  claimGateUnread:
    "この確認待ちを rondo が読めなかったため、確かめた内容は記録していません。確認の画面に戻って、もう一度お試しください。",
  claimGateClosed:
    "この確認にはすでに答えが出ていたため、確かめた内容は記録していません。確認の画面に戻ると、どう終わったかが分かります。",
  claimNotRecorded:
    "確かめた内容を rondo が記録できなかったため、答えは送っていません。確認の画面に戻って、もう一度お試しください。",
  claimHostSetup:
    "このコンピュータの rondo は、確かめた内容を記録できません。そのため答えは送っておらず、費用もかかっていません。" +
    "このコンピュータのセットアップが終わっていないか、途中で動かなくなっています。" +
    "もう一度「承認する」を押しても結果は同じです。理由は、このコンピュータで rondo を管理する人が調べられます。",
  answerNotDone: "答えは送られませんでした",
  gateBack: "確認に戻る",
  gateAuto: gateAutoJa,
  approvalNamed: (goal, costUsd) =>
    `${goal ? "目標に向けた承認" : "この依頼の承認"}（$${costUsd} まで）`,
  gateAutoSaid: (approval, approver, line) =>
    [
      `${approver} の${approval}に基づいて、rondo がこの回を自動で承認しました。`,
      "次の条件をすべて満たしていたためです。",
      "- チェックが通っている",
      `- 同じコミットのモデルレビューに、${severityJa(line)}以上の指摘がない`,
      "- 作業者が最後に実行したテストが通っている",
      "- この作業に、答えの出ていない質問がない",
      "- 締めの回ではない",
    ].join("\n"),
  gateReviseSaid: (approval, approver, notSent, line, left) =>
    [
      `${approver} の${approval}に基づいて、rondo が下書きした変更の依頼を、rondo 自身が送りました。`,
      "人がボタンを押さなくても送れる次の条件を、すべて満たしていたためです。",
      "- 承認を止めていたのはレビューの指摘だけで、下書きがそのすべてに触れている",
      `- ${severityJa(line)}以上の指摘のどれも、下書きは人の判断が要るものとしていない`,
      "- レビューの回数と予算が残っている",
      "- この作業に、答えの出ていない質問がない",
      ...(left.length === 0
        ? []
        : [
            "",
            `${severityJa(line)}より軽く、下書きが判断をあなたに任せた次の指摘は、送った依頼には入れていません。`,
            "必要なら、あなたから変更を頼んでください。",
            ...left,
          ]),
      ...(notSent === null
        ? []
        : [
            "",
            "変更の依頼は届いているかもしれませんが、次の回は始まっていません。",
            notSent,
            "目標の承認をいったん止めるか、予算を増やすか、依頼の画面から作業をもう一度始めてください。",
          ]),
    ].join("\n"),
  modelRaised: (blockers, majors) => `モデルレビューの指摘: ${raisedJa(blockers, majors)}。`,
  modelRaisedLink: "読む",
  severityWord: severityJa,
  severityCount: (severity, count) => `${severityJa(severity)} ${String(count)} 件`,
  readingNotTaken: "結果を取れなかったため、判定の前提になるものがありません。",
  whyNotTaken: "理由",
  checksWorkUnreadable:
    "何が変わったかをいま読み取れないため、この結果を作業と照らし合わせられません。",
  checksNotMatched: "照合できず",
  modelNotTaken: "読んだのはチェックだけです。モデルレビューは取れていません。",
  neitherReadingTaken: "チェックもモデルレビューも、この作業を読めませんでした。",
  storyHeading: "これまでの経緯",
  storyLaps: (count) =>
    `この作業は、これで ${String(count)} 回目です。下の番号はこの作業の中での回数で、依頼全体の通し番号ではありません。`,
  storyPart: (part, parts) =>
    `この依頼は ${String(parts)} つの作業に分けてあります。この確認は、そのうちの作業 ${String(part)} のものです。`,
  storyLapName: (n, current) => (current ? `${String(n)} 回目 (今回)` : `${String(n)} 回目`),
  storyToldRequest: "依頼の内容に取り組みました。",
  storyToldAsked: "頼まれた変更は次のとおりです。",
  storyToldNotRecorded: "前の回の続きです。何を頼まれたかは記録に残っていません。",
  storyToldContinued: (n) => `${String(n)} 回目が途中で終わったため、その続きに取り組みました。`,
  storyChanged: (commits, files) =>
    `${String(commits)} 件のコミットで ${String(files)} ファイルを変更しました。`,
  storyChangedUnread: "コミット内容は読み取れていません。",
  storyNow: "いま、あなたの答えを待っています。",
  storyEnded: (answer, otherwise) =>
    answer === "revise"
      ? "確認で変更を頼まれ、差し戻されました。"
      : answer === "approve"
        ? "確認で承認されました。"
        : `終わりました (${otherwise})。`,
  storyIntended: "この依頼で変えようとしたこと (下書きした側の言葉のまま):",
  storyOthers: "ほかの作業:",
  recordsFold: (count) => `承認したときに記録される内容 (${String(count)} 項目) と記録全文`,
  denialUnreadable: "どのコマンドだったかを rondo は記録できませんでした。",
  modelMayArrive: "モデルレビューはこれから届くかもしれません。",
  reachYourTurn: "rondo があなたの答えを待っています。",
  reachLate: "rondo で、予定の時間を過ぎても終わらないものがあります。",
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
    "ここにあるのは、この実行が自分で宣言した許可だけで、実際に効いている制限の全体では",
    "ありません。役割のテンプレートも同じ許可一覧に加わりますが、rondo はここでそれを読みません。",
  ]),
  secondFence: Object.freeze([
    "作業者自身のサンドボックスは二重目の守りですが、rondo はそれを見ていません。何も",
    "拒否しないまま起動に失敗することがあるため、サンドボックスが無効なまま動いた回も、",
    "そうでない回とまったく同じように表示されます。それを伝えたことがあるのは、確認に",
    "置かれた作業者自身の説明だけです (D-0050)。",
  ]),
  lapNestedSandbox:
    "作業を始める前に止めました。rondo が別のサンドボックスの中（たいていは別の Claude Code " +
    "の中）で動いているため、作業者が自分のサンドボックスを立ち上げられず、このまま" +
    "ではコマンドが守られないまま実行されてしまいます。rondo を普段の端末から起動し直してから、" +
    "もう一度お試しください。",
  lapTurnTimedOut: (minutes) =>
    `時間切れで止めました。作業者が${minutes === null ? "決められた時間" : ` ${String(minutes)} 分`}` +
    "のうちに作業を終えられなかったため、途中で止めています。それまでの変更は作業する場所に残っていますが、" +
    "コミットされていない変更は届けられません。この回にかかった費用は報告" +
    "されていないため分かりません。続けるには、この停止に「続ける」と答えてください。rondo がこの作業の" +
    "コミットからもう一度始めます。作業を小さく分けて、範囲を決め直すこともできます。",
  lapWorkKept: (branch, commit) =>
    "コミットされていなかった変更は、rondo が未検証の印を付けて、この作業のブランチに 1 つの" +
    `コミットとして残しました（${branch}、${commit.slice(0, 12)}）。届けてはいません。続けると、` +
    "この作業はそこからもう一度始まり、まずその中身を確かめます。",
  lapWorkNotKept: (reason) =>
    "コミットされていなかった変更を rondo は残せませんでした。変更は作業する場所にだけあり、やり直しは" +
    `そこから始まりません: ${reason}`,

  scopeAction: "範囲を決める",
  scopeHeading: "この依頼の範囲",
  backToThread: "依頼に戻る",
  scopeLead:
    "この範囲はあなたが決めます。計画は rondo が持っているものから選び、数値は rondo の記録に" +
    "あるこれまでの回から出しています。読んで、変えたいところを変えてください。ボタンを 1 回押せば、" +
    "記録と承認が同時に済みます。",
  scopeNoPlanHeld:
    "この作業に使える計画を rondo はまだ持っていません。このコンピュータでの rondo のセットアップから、" +
    "まだ計画を受け取っていないためです。",
  scopePlansUnread: (reason) =>
    `rondo が持っている計画を読めなかったので、選べるものがありません: ${reason}`,
  scopePlanAsk: "作業に使う計画",
  scopePlanGone: "選んだ計画は、この依頼ではもう使えなくなりました。次の中から選び直してください。",
  scopePlanFrom: (from) =>
    from === "message"
      ? "このスレッドに貼られたもの"
      : from === "setup"
        ? "このコンピュータのセットアップで用意したもの"
        : "前の回が使ったもの",
  scopePlanLine: (where, agentType, from) => `${where}、エージェント種別 ${agentType}（${from}）`,
  scopePlanHeldAt: (line, at) => `${line}、${at} UTC から保持`,
  scopeDraftedLead:
    "この依頼の範囲を rondo が下書きしました。下に挙げた作業と、rondo の記録にあるこれまでの回から" +
    "出した予算です。そのまま承認するか、先に値を変えてください。値を変えた場合は、rondo の" +
    "下書きの代わりにあなたの版が記録されます。",
  scopeDraftedPlansHeading: "rondo が動かそうとしている作業",
  scopeDraftedPlan: (n) => `作業 ${String(n)}`,
  scopeDraftedTemplateGone: "この下書きの元になった計画を、rondo はもう持っていません。",
  tierHeading: "この作業を動かすモデル",
  tierSaid: (tier, lighter) =>
    tier === "standard"
      ? "標準のモデルです。人が読んで受け入れる作業に、rondo が普段使うモデルです。"
      : tier === "mechanical"
        ? lighter === false
          ? "軽いモデル向けと指定されていますが、この提供元には軽いモデルが無いので、ほかの作業と同じモデルで動きます。"
          : "軽くて安いモデルです。人が読まなくても結果を確かめられる作業にだけ使えます。"
        : tier === null
          ? "分かりません。この作業のモデルの段階が、下書きに記録されていません。"
          : `段階 '${tier}' です。この段階に当てるモデルが rondo にはありません。`,
  tierModel: (model, provider) => `${model} (提供元 ${provider})`,
  tierWhy:
    "軽いモデルでよいとした理由です (下書きした側の言葉のまま)。rondo が確かめたのは、理由が書かれていて" +
    "あなたのメッセージに基づいていることだけで、正しいかどうかは確かめていません。承認する前に、あなたが判断してください。",
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
  scopeNarrowed: (computed) =>
    `あなたがここに書いた内容を受けて、rondo が ${computed} から下げました:`,
  scopeNarrowedStricter: "あなたがここに書いた内容を受けて、rondo が「重大」より厳しくしました:",
  scopeNarrowedAdded: "あなたがここに書いた内容を受けて、rondo が加えました:",
  scopeAnswerFirst:
    "この依頼のスレッドで、rondo があなたの答えを待っています。答えるまで、範囲はここでは" +
    "決められません。先にスレッドで答えてください。",
  scopeRedrafted:
    "下の範囲が承認されたあとで、rondo が下書きし直しました。新しい下書きはこちらです。" +
    "承認すると、この依頼の範囲がもう 1 つ加わり、下の範囲はそのまま残ります。",
  scopeDraftedAction: "承認する",
  scopeDraftedPlain: "この範囲、または値を変えたあなたの版を承認します",
  scopeDraftedPressNote:
    "ボタンを 1 回押せば承認されます。値を変えた場合は、下書きの代わりにあなたの版が記録され、" +
    "承認されます。承認しただけでは費用はかかりません。各回は、始まる時点でこの範囲に照らして" +
    "判定されます。",
  planStartAction: "この作業を始める",
  planStartPlain: "この作業を 1 回始めます。承認した範囲の回数と費用から使います",
  planStarted: "開始済みです。",
  planStartedLink: "この回を開く",
  planBusy: (limit) =>
    limit === 1
      ? "いまは始められません。同時に動かせるのは 1 回までで、その 1 回がいま動いています。" +
        "それが確認待ちになると、ここに開始ボタンが出ます。"
      : `いまは始められません。同時に動かせるのは ${String(limit)} 回までで、いま` +
        "そのすべてが動いています。どれかが確認待ちになると、ここに開始ボタンが出ます。",
  planFull: (live, limit) =>
    `いまは始められません。進行中の回が ${String(live)} 件あり、このコンピュータで同時に動かせる上限` +
    `（${String(limit)} 件）に達しています。どれかが終わると、ここに開始ボタンが出ます。`,
  planOutside: (test) => `始められません。${scopeTestJa(test)}。`,
  planUnrunnable:
    "この作業はもう動かせません。依頼のスレッドに返信すると、rondo が下書きし直します。",
  planUnrunnableWhy: "止めている理由",
  planUndecidable: "いま、この作業を範囲に照らして確かめられませんでした。",
  scopeNoPlanForScope:
    "この範囲が許す場所とエージェント種別の計画を rondo はまだ持っていないので、この範囲で" +
    "開始できるものがありません。それに合う計画を依頼のスレッドに返信として貼ってください。",
  scopeNoApprover:
    "RONDO_APPROVER が設定されていないため、このページからは誰の名前でも範囲を承認できません。",
  // The place is said only where it is what tells two of these apart (D-0081
  // rule 4.2); with nothing to tell apart, the root answers "where" alone.
  // Japanese names the place first and keeps the root beside it in brackets,
  // which is how a Japanese reader carries a qualifier.
  scopeWorkspace: (place, root) => (place === null ? root : `${place}（${root}）`),
  scopePlanDigest: (digest) => `計画 ${digest}`,
  scopePlanHeading: "rondo が動かす計画と、動かす場所",
  scopeRecordedFold: "作業する場所とエージェント種別の許可（rondo の記録）",
  scopeMaybeApproved:
    "この依頼の範囲をすでに承認したかどうかは、この画面からは分かりません。どちらにしてもこれは" +
    "新しい下書きで、ボタンを押すと範囲がもう 1 つ記録されます。",
  scopeHeldBounds: (digest, tier, granted, from) =>
    `エージェント種別 ${digest}: モデルの規模は ${tier}、許可は` +
    `${granted.length === 0 ? "なし" : granted.join(", ")}` +
    `（${agentTypeSourceJa(from)}から読み取り）`,
  scopeHeldNone: (digest) =>
    `エージェント種別 ${digest}: 何が許されているかの記録を rondo は持っていません`,
  scopeHeldUnreadable: (digest, reason) =>
    `エージェント種別 ${digest}: 記録を読めないので、何が許されているかを出せません: ${reason}`,
  scopeHeldRebuilds: (digest, rebuilt, from) =>
    `エージェント種別 ${digest}: ` +
    `${agentTypeSourceJa(from)}から読み取った記録は ` +
    `${rebuilt} に組み直されるので、何が許されているかを出せません`,
  scopeHeldNoBuild: (digest, from, reason) =>
    `エージェント種別 ${digest}: ` +
    `${agentTypeSourceJa(from)}から読み取った記録は` +
    `組み立てられないので、何が許されているかを出せません: ${reason}`,
  scopeRoundsAsk: "レビュー回数",
  scopeRoundsRedraw:
    "回数を選ぶと予算を計画から計算し直すため、入力した値は rondo の下書きに戻ります。",
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
    `作業数 x（取っておく額 + 2 回目以降のレビュー回数 x やり直しの費用）= ` +
    `${String(plans)} x（${reserve} + ${String(laterRounds)} x ${redo}）`,
  scopeFormulaExpires: (laps, seconds) =>
    `下書きした時刻 + 回数 x 最も長くかかった回の時間 + 返信のための 1 日 = 下書きした時刻 + ` +
    `${String(laps)} x ${String(seconds)} 秒 + 24 時間`,
  scopeBasesFold: (count) => `この数の出どころ (${String(count)})`,
  scopeBasisRows: (measurement, laps, level, tier) =>
    `${
      level === "agent_type"
        ? "このエージェント種別"
        : level === "model_tier"
          ? `段階 ${String(tier)}`
          : "このリポジトリ"
    }の直近 ${String(laps)} 回のうち、` +
    `${JA_MEASURE[measurement] ?? measurement}が最も高かったもの`,
  scopeBasisColdStart: (measurement) =>
    `${JA_MEASURE[measurement] ?? measurement}: rondo の記録には一度も計測した値がないため、rondo の` +
    `初期値を使いました`,
  scopeColdStartNote: (whole) =>
    whole
      ? "まだ記録された回がないため、この値は rondo の見込みで、計測した値ではありません。" +
        "大きな作業なら上げてください。"
      : "一部は rondo の見込みです。挙げたエージェント種別のうち、まだ記録された回がない" +
        "ものがあります。大きな作業なら上げてください。",
  scopeBasisPlans: (plans) => `作業数: ${String(plans)}`,
  scopeBasisRounds: (rounds, byDefault) =>
    byDefault
      ? `レビュー回数: ${String(rounds)}（誰も選ばなかったときに rondo が使う数）`
      : `レビュー回数: ${String(rounds)}（あなたが選んだ数）`,
  scopeBasisReplyAllowance:
    "あなたが返信するための 1 日。計測した値ではなく、余裕として足した分です",
  scopeBasisLap: (iterationId) => `${iterationId} の回`,
  scopeSampleHeading: "この予算は、依頼の大きさが過去の回と同じくらいだと見て出しています",
  scopeSampleRows: (laps, level, tier, lowest, highest) =>
    `${
      level === "agent_type"
        ? "このエージェント種別"
        : level === "model_tier"
          ? `まだ記録のないエージェント種別なので、同じ段階 ${String(tier)} の別のエージェント種別`
          : "このエージェント種別にもその段階にも記録がないので、このリポジトリの別のエージェント種別"
    }の 1 回目 ${String(laps)} 件をもとに下書きしました。費用は ` +
    `${lowest === highest ? highest : `${lowest}〜${highest}`} USD で、取っておく額にはその最高値を` +
    `使っています。rondo が記録しているのは各回にかかった費用だけで、どれだけの作業をしたかは` +
    `記録していません。そのため、この依頼がそれらと同じくらいの大きさかどうかは分かりません。` +
    `大きいと思うなら、ここで費用を上げてください。1 回目で使い切っても、作業があなたの` +
    `確認に戻ってきたときに増やせます。`,
  scopeSampleColdStart: (reserve) =>
    `このエージェント種別にも、その段階にも、このリポジトリにも、記録された回がありません。` +
    `そのため取っておく額は rondo の見込みの ${reserve} USD で、rondo が計測できた別の場所での 1 回目` +
    `の費用に合わせた値です。ここで計測した値ではなく、依頼の大きさも分かりません。` +
    `大きな作業なら、ここで費用を上げてください。予算の上限で止まったときは、その質問から` +
    `予算を増やして続けられます。`,
  scopeDefaultsHeading: "rondo が埋めたもの",
  scopeDefaultNote: "rondo の既定値です。依頼の内容から出したものではありません。",
  scopeSeverityLabel: "この重さ以上の指摘が出たら、レビューはそこで止まる",
  scopeOutwardLabel: "この範囲で許す、外に影響する行為",
  scopeOutwardFromGoal:
    "この依頼も同じ目標に向けた作業なので、このリポジトリの目標の範囲で許しているものに、" +
    "あらかじめチェックを入れてあります。自分の手でやりたいものは外してください。",
  scopeOutwardAct: (act) =>
    ({
      push_branch: "ブランチを push する",
      open_pull_request: "プルリクエストを開く",
      merge_default_branch: "チェックが通れば既定ブランチにマージする",
    })[act] ?? act,
  scopeOutwardNone: "なし",
  scopeIrreversibleNone: "取り返しのつかない行為の一覧には、何も加えません。",
  scopeCostCaveat:
    "費用の予算に含まれるのは、各回そのものの費用だけです。レビュー側の費用は含まれません。" +
    "費用がまだ分からない回は、取っておく額の分を使ったものとして扱いますが、その額は見込みです。",
  scopePressNote:
    "ボタンを 1 回押すと、この範囲があなたの名前で記録され、承認されます。承認しただけでは費用は" +
    "かかりません。実際の行為は、その都度この範囲に照らして判定されます。",
  scopePlain: "この範囲を記録して承認します",
  scopeApproved: (since) => `${since}前に承認済み`,
  scopeDigest: (digest) => `識別子 ${digest}`,
  scopeNotThisRequest: "その承認はこの依頼のものではないので、ここには何も表示しません。",
  scopePredecessorSpent: (laps, usd, unread) =>
    `前の範囲では、これまでに ${String(laps)} 回と、費用が分かっている分で $${usd} を使いました。` +
    `費用がまだ分からない回が ${String(unread)} 回あり、その分は取っておく額で見ています。`,
  scopePredecessorNoApproval: "前の範囲は承認されたことがないため、何も使っていません。",
  scopePredecessorUnreadable: (reason) => `前の範囲が何を使ったかは読めませんでした: ${reason}`,
  scopeRetired:
    "あとから承認した範囲に置き換わったため、この範囲からは何も始められません。" +
    "始めるなら、新しいほうの範囲から始めてください。",
  startAction: "作業を始める",
  startPlain: "この承認のもとで作業を 1 回始めます",
  startAgainSafe:
    "二度押しても、始まるのは 1 回だけです。2 度目に押した分は 1 度目にまとめられ、それ以上は" +
    "始まりません。",
  workerProviderLabel: "作業を実行する提供元",
  workerProviderDefault: (provider) => `このコンピュータの既定値 (${provider})`,
  workerProviderBefore: "選べるのは作業を始める前だけです。始まったあとは変わりません。",
  workerProviderRan: (provider, chosen) =>
    chosen ? `${provider} (この依頼で選んだもの)` : `${provider} (このコンピュータの既定値)`,
  workerProviderUnknown:
    "不明です。この回は、rondo が提供元を記録するようになる前に始まっています。",
  startBeside:
    "この作業には計画がないため、ほかの作業と並行して始めます。ほかの作業とぶつかったときは、" +
    "承認が作業を自動で進めるものなら rondo が直す作業を自分で始め、そうでなければ直す作業を" +
    "ボタン 1 つで始められるようにします。",
  startNote:
    "依頼に書いた言葉が、そのまま作業への指示になります。回の名前は rondo が付けるので、" +
    "あなたが決める必要はありません。",
  scopeRefusedNoApprover:
    "何も記録していません。RONDO_APPROVER が設定されていないため、このページからは誰の名前でも" +
    "範囲を承認できません。",
  scopeRefusedPress:
    "何も記録していません。範囲の承認はこのページのボタンを人が押したときだけ行われ、" +
    "スクリプトからはできません。",
  scopeRefusedForm:
    "何も記録していません。そのフォームはこのページのものではありません。読み込み直してから" +
    "押してください。",
  scopeRefusedFields:
    "何も記録していません。数値のどれかが rondo の受け付けられる値ではありません。予算を確かめてから" +
    "押してください。",
  scopeRefusedNotTaken: "何も記録していません。rondo の記録がこの範囲を受け付けませんでした。",
  scopeRefusedPlanChanged:
    "何も記録していません。画面に出ていた計画は、この依頼ではもう選べません。" +
    "ページを読み込み直して、選び直してください。",
  scopeRefusedEdited:
    "何も記録していません。このフォームの範囲はすでに記録され、承認も済んでいます。いま書き換えた内容は" +
    "記録してある内容と違います。ページを読み込み直して、新しい範囲を下書きしてください。",
  scopeRefusedNotRead: "範囲は記録しましたが、読み戻せなかったので承認はしていません。",
  scopeRefusedNotShown:
    "範囲は記録しましたが、あなたに見せたという記録を残せなかったので、承認は" + "していません。",
  scopeRefusedNotApproved: "範囲は記録しましたが、承認はしていません。何も消費していません。",
  startRefusedNoApprover:
    "何も開始していません。RONDO_APPROVER が設定されていないため、このページでは誰の名前でも" +
    "作業を始められません。",
  startRefusedPress:
    "何も開始していません。作業を始められるのは、人がこのページのボタンを押したときだけです。" +
    "スクリプトからは始められません。",
  startRefusedForm:
    "何も開始していません。そのフォームはこのページのものではありません。読み込み直してから" +
    "押してください。",
  startRefusedNoPlan:
    "何も開始していません。選んだ計画が、この依頼で使える計画のなかにありません。",
  startRefusedNoRequest:
    "何も開始していません。依頼の内容を読み戻せなかったので、作業者に頼める内容がありません。",
  startRefusedNoContinuo: "何も開始していません。作業を動かす仕組みが起動しませんでした。",
  startRefusedOutside: (test) =>
    // Said in words, never the test's name (rondo#431): `asks` is a word to ask about.
    `何も開始せず、何も消費していません。承認した範囲の外の作業です。${scopeTestJa(test)}。` +
    `どうするかの選択肢は、依頼のスレッドのメッセージに書いてあります。`,
  startRefusedNotAdmitted:
    "何も開始せず、何も消費していません。承認はそのまま有効です。もう一度押しても問題ありません。",
  scopeBack: "範囲に戻る",

  reviseAction: "変更を頼む",
  revisePlain: (next) =>
    `書いた内容をこの確認に送り、同じ承認のもとで${lapJa(next)}をその内容で動かします。`,
  reviseLabel: "変更してほしいこと",
  revisePlaceholder: "例: パーサーの変更はそのまま、コマンドラインには手を入れないでほしい",
  reviseNote: (next) =>
    `書いた言葉はそのまま確認に渡り、${lapJa(next)}はその言葉で作業をやり直します。` +
    "その回の費用は、この回を動かした承認の予算から使われます。回の名前は rondo が" +
    "付けるので、入力は要りません。",
  reviseRaises: (rounds) =>
    `承認したレビュー回数 (${String(rounds)} 回) は使い切っています。押すと、まずレビュー回数を` +
    "下の数まで引き上げ、続けて変更を頼みます。引き上げは新しい承認として記録され、今の承認と" +
    "置き換わります。ほかの予算は変わりません。",
  reviseNoScope:
    "この回は承認した範囲のもとで始めたものではないので、次の回に使える予算がありません。" +
    "ここから変更を頼むことはできません。",
  reviseDraftFinding: (severity, text) => `- ${severityJa(severity)}: ${text}`,
  reviseDraftBases: (bases) => `  場所: ${bases}`,
  reviseDraftChange: (words) => `  直すこと: ${words}`,
  reviseDraftJudgment: "  (判断が要る点のため、送るかどうかはあなたに任せます)",
  reviseDraftTakeIn: (finding) =>
    `- ${finding}\n  直すこと: まずそのコミットを git merge --no-edit で取り込み、競合があれば解消して ` +
    "merge をコミットする。",
  reviseDrafted:
    "レビューの指摘をもとに rondo が下書きしました。好きに書き換えてください。送る内容を決めるのはあなたです。",
  reviseDrafting:
    "レビューの指摘をもとに、変更内容の下書きを作っています。1〜2 分後にページを読み込み直すと表示されます。" +
    "待たずに、いま自分で書いても構いません。",
  reviseUndrafted:
    "今回は rondo が変更内容を下書きできませんでした。このレビューについて下書きをやり直すことはありません。" +
    "変更してほしいことを自分で書いてください。レビューの指摘は上にあります。",
  reviseDraftArrived:
    "書き始めたあとに下書きが届いたので、あなたが書いた内容をそのまま残しています。下書きを見るには、" +
    "欄を空にしてからページを読み込み直してください。",
  forMaintainer: "このコンピュータで rondo を管理する人向け",
  hostLog:
    "rondo が出力した残りはホストのログで読めます（journalctl --user -u rondo.service。" +
    "ホストを rondo web で手で起動した場合は、そのターミナル）。",
  reviseRefusedNoApprover:
    "何も答えていません。RONDO_APPROVER が設定されていないため、このページでは誰の名前でも" +
    "答えられません。",
  reviseRefusedPress:
    "何も答えていません。確認に答えられるのは、人がこのページのボタンを押したときだけです。" +
    "スクリプトからは答えられません。",
  reviseRefusedForm:
    "何も答えていません。そのフォームはこのページのものではありません。読み込み直してから" +
    "押してください。",
  reviseRefusedNoWords: "何も答えていません。変更を頼むには内容が要りますが、入力欄が空でした。",
  reviseRefusedGateClosed:
    "何も答えていません。この回の確認はもう閉じています。戻って、どう終わったかを" +
    "確かめてください。",
  reviseRefusedNotItsScope:
    "何も答えていません。使おうとしている承認が、この回を動かした承認と違います。" +
    "確認のページを読み込み直してから押してください。",
  reviseRefusedStillRunning:
    "何も答えていません。この確認には別の言葉ですでに答えていて、その処理がまだ続いています。" +
    "終わるのを待ってから、確認のページを読み込み直して状態を確かめてください。",
  reviseRefusedNotSetUp:
    "何も答えておらず、確認にも触れていません。次の回を用意できませんでした。" +
    "何が起きたかは、このコンピュータで rondo を管理する人が確かめられます。",
  reviseRefusedNoContinuo: "何も答えていません。作業を動かす仕組みが起動しませんでした。",
  reviseRefusedOutside: (test) =>
    `何も答えず、何も消費していません。次の回は、この回を動かした範囲の外です。${scopeTestJa(test)}。` +
    `確認はそのままです。どうするかの選択肢は、依頼のスレッドのメッセージに書いてあります。`,
  reviseRefusedWalkFailed:
    "確認への答えが途中で終わり、次の回も始まっていません。書いた言葉はすでに確認に" +
    "届いているかもしれません。もう一度押す前に、戻って確認の状態を確かめてください。" +
    "何が起きたかは、このコンピュータで rondo を管理する人が確かめられます。",
  reviseRefusedNotSettled:
    "確認には書いた言葉で答えましたが、次の回は始まっていません。答えた回の後始末が" +
    "終わりませんでした。何も消費していません。" +
    "何が起きたかは、このコンピュータで rondo を管理する人が確かめられます。",
  reviseRefusedAfterGate:
    "確認には書いた言葉で答えましたが、次の回は始まっていません。承認がもう 1 回分を" +
    "受け付けませんでした。書いた内容は記録してあります。どうするかの選択肢は、依頼のスレッドの" +
    "メッセージに書いてあります。",
  reviseRefusedNotStarted:
    "次の回は始まっていません。ここで書いた内容は失われていません。" +
    "何が起きたかは、このコンピュータで rondo を管理する人が確かめられます。",
  reviseForked:
    "ここでは変更を頼めません。この依頼で承認した予算が、別々に 2 回引き上げられています。" +
    "rondo はどちらを使うかを選びません。何も消費していません。今の作業をそのまま承認する" +
    "ことはできます。",
  reviseRefusedForked:
    "何も答えず、何も消費していません。この依頼で承認した予算が、別々に 2 回引き上げられて" +
    "います。rondo はどちらを使うかを選びません。",

  raiseNeeded: (why) =>
    `変更を頼むと作業をもう 1 回やり直しますが、${why}ため、ここでは頼めません。` +
    "何も頼んでおらず、何も消費していません。予算を引き上げれば、ここからまた変更を" +
    "頼めます。今の作業をそのまま承認することもできます。",
  raiseWhyLaps: (laps) => `承認した ${String(laps)} 回をすべて使っている`,
  raiseWhyCost: (spent, reserve, cost) =>
    `やり直しは費用が確定するまで $${reserve} を取り置く必要があり、すでに使った分と取り置いている分の ` +
    `$${spent} と合わせると、承認した $${cost} を超える`,
  raiseWhyExpiry: (at) => `承認した期限 ${at} (UTC) を過ぎている`,
  raiseLink: "この承認の予算を引き上げる",
  raiseLead:
    "この依頼で承認した予算を引き上げます。変わるのは予算だけで、作業の内容、作業する場所、" +
    "作業者に許すことは承認したときのままです。",
  raiseWasHeading: "承認した内容と、これまでに使った分",
  raiseWas: (laps, cost, until) => `${String(laps)} 回まで、$${cost} まで、${until} (UTC) まで。`,
  raiseUsed: (attempts, usd, unread) =>
    `これまでに ${String(attempts)} 回、$${usd} を使いました` +
    (unread === 0 ? "。" : `（うち ${String(unread)} 回は費用が報告されていません）。`),
  raiseFromHere:
    "新しい予算は、これから先の分です。これまでに使った分は前の承認に含まれたままで、新しい" +
    "予算からは引かれません。たとえば費用を $15 に引き上げると、合計で $15 ではなく、ここからさらに " +
    "$15 まで使えます。",
  raiseRetires:
    "押すと、前の承認のもとでは何も新しく始まらなくなります。前の承認が対象にしていた依頼" +
    "すべてについて、この承認が代わりになります。",
  raiseAskStands:
    "rondo はこの作業を先に止めて、どう進めるかをあなたに質問しています。予算を引き上げても、" +
    "その質問への答えにはなりません。依頼のスレッドで続けるよう伝えるまで、作業は止まったままです。",
  raiseAskLink: "質問を読む",
  raiseNotTip:
    "予算はすでに引き上げられていて、ここから引き上げるものはありません。戻って、今" +
    "有効な予算を確かめてください。",
  raisePressNote:
    "ボタンを 1 回押すと、新しい予算をあなたの名前で記録して承認し、あなたを待っている作業に戻ります。" +
    "承認しただけでは何も消費しません。",
  raiseAction: "予算を引き上げる",
  raisePlain: "新しい予算を記録して承認します",
  raiseRefusedNotTip:
    "何も記録していません。別のタブか別の人が、先に予算を引き上げています。" +
    "戻って、今有効な予算を確かめてください。",
  raiseRefusedForked:
    "何も記録していません。この依頼で承認した予算が、別々に 2 回引き上げられています。rondo は" +
    "どちらをさらに引き上げるかを選びません。",
  raiseRefusedNotAtGate:
    "何も記録していません。作業はもうあなたを待っていないので、予算を引き上げる対象が" +
    "ありません。戻って結果を確かめてください。",

  publishAction: "プルリクエストを作る",
  published: (branch) =>
    `公開しました。${branch === null ? "ブランチ" : `ブランチ ${branch}`} を push し、` +
    "この作業の記録を閉じました。",
  publishedPullRequest: "プルリクエスト",
  holds: (paths) => `この作業が押さえているファイル: ${filesJa(paths)}`,
  notLanded:
    "プルリクエストはまだ作られておらず、この変更も既定ブランチで見つかっていません。それまで" +
    "ファイルはこの作業が押さえたままで、同じファイルを使う別の作業は待たされます。",
  landed: "変更は既定ブランチに入りました。ファイルは別の作業に使えます。",
  releasedByPerson: "人の判断でファイルが手放されたので、別の作業に使えます。",
  releaseLink: "ファイルを手放す",
  releaseHeading: "この作業が押さえているファイルを手放す",
  releaseLead:
    "この作業は終わっていますが、ファイルを押さえたままです。あなたが手放すか、プルリクエストが" +
    "作られるか、変更が既定ブランチで見つかるまで、同じファイルを使う作業は始められません。",
  releaseWorkHeading: "作業",
  releaseBrief: "rondo が作業者に頼んだ内容（全文）",
  releaseHoldsHeading: "押さえているファイル",
  releaseWhyHeading: "rondo が自分で手放していない理由",
  releaseWhy: [
    "rondo は、この作業のプルリクエストを作った時点でファイルを手放します。それより前は、" +
      "この変更が既定ブランチに入ったと確かめられたときだけ手放します。作業が変えたファイルが" +
      "すべて、作業が残したとおりの中身で既定ブランチにあることが条件です。確かめるのは、別の" +
      "作業が同じファイルを求めたときです。",
    "どちらもまだです。まだ公開していない、または別の方法でマージされて、取り込むときに手が" +
      "入った（コンフリクトの解消を含む）、別のリモートに送られた、既定ブランチを読めなかった、" +
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
    "何も手放していません。このコンピュータの rondo はまだあなたが誰かを知らないので、ここでは" +
    "あなたとして何も決められません。",
  releaseRefusedPress:
    "何も手放していません。人がこのページのボタンを押したときだけできる操作で、スクリプトからは" +
    "できません。",
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
    "この作業の一部がまだ動いています。ファイルを加えることはいまできます。外すのは、作業が" +
    "レビューで止まってからです。",
  holdsAtReview:
    "加えたものはすぐにこの作業が押さえ、別の作業は使えなくなります（別の作業が押さえている" +
    "ものは加えられません）。",
  holdsEnded: "この作業は終わっています。ファイルを外すことはできますが、加えることはできません。",
  holdsStillOpen:
    "この作業の一部がまだ動いているか、あなたのレビューを待っているので、ファイルはまだ" +
    "手放せません。押さえるファイルは下で変えられます。",
  othersHold: (paths) => `別の作業が押さえているファイル: ${filesJa(paths)}`,
  holdsAction: "このファイルを押さえる",
  nextStepEnd:
    "この作業は止まったまま、自分では先へ進めません。終わらせられるのは人だけです。それまでこの" +
    "作業は、このコンピュータで同時に動かせる作業の 1 つ分と、取り置いた金額と、押さえたファイルを持ち続けるので、同じ作業を始め直せません。",
  endHeading: "この作業を終わらせる",
  endUnnamed: "rondo が読めなくなった作業",
  unreadableHolds:
    "このコンピュータで同時に動かせる作業の 1 つ分をまだ占めているので、ほかの作業が待たされているかもしれません。" +
    "終わらせられるのはあなただけです。",
  endLeadStalled:
    "この作業は途中で止まり、自分では先へ進めません。動いているものはなく、答える質問も" +
    "ありません。終わらせるかどうかはあなたが決め、その理由を記録します。",
  endLeadStarting:
    "この作業は始める途中で止まり、いま動いているものはありません。終わらせるかどうかは" +
    "あなたが決め、その理由を記録します。",
  endLeadUnreadable:
    "rondo はこの作業を読めなくなったので、内容を示すことも、自分で終わらせることもできません。" +
    "それでも、このコンピュータで同時に動かせる作業の 1 つ分は占めたままです。終わらせるかどうかはあなたが決め、その理由を記録します。",
  endEffectHeading: "終わらせると起きること",
  endEffect: [
    "この作業はもう動きません。完了ではなく、終了として記録されます。",
    "このコンピュータで占めていた作業 1 つ分、取り置いた金額、押さえていたファイルは、すぐに空きます。",
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
  endBrief: "rondo が作業者に頼んだ内容（全文）",
  endNoApprover:
    "この作業を終わらせられるのは rondo が知っている人だけですが、このコンピュータの rondo はまだ" +
    "あなたが誰かを知りません。",
  endNothingToEnd:
    "ここで終わらせるものはありません。この作業はすでに終わったか、自分で先へ進みました。",
  endRefusedNoApprover:
    "何も終わらせていません。このコンピュータの rondo はまだあなたが誰かを知らないので、ここでは" +
    "あなたとして何も決められません。",
  endRefusedPress:
    "何も終わらせていません。人がこのページのボタンを押したときだけできる操作で、スクリプトからはできません。" +
    "ページを読み込み直してから、もう一度押してください。",
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
    "何も変えていません。このコンピュータの rondo はまだあなたが誰かを知らないので、ここでは" +
    "あなたとして何も決められません。",
  holdsRefusedPress:
    "何も変えていません。人がこのページのボタンを押したときだけできる操作で、スクリプトからは" +
    "できません。",
  holdsRefusedForm:
    "何も変えていません。そのフォームはこのページのものではありません。読み込み直してから" +
    "押してください。",
  holdsRefusedChanged:
    "何も変えていません。画面を表示したあとで、この作業の状態が変わりました（レビューに" +
    "来た、やり直された、押さえるファイルが変わった）。戻っていまの状態を確かめてください。",
  holdsRefusedHeld:
    "何も変えていません。加えたファイルを別の作業が押さえています。開いている作業どうしが" +
    "同じファイルを押さえることはありません。",
  holdsRefusedBusy:
    "何も変えていません。この作業の一部がまだ動いていて、外したファイルを変えるかもしれ" +
    "ません。レビューで止まってから外してください。",
  holdsRefusedKept:
    "何も変えていません。外したファイルのうち、この作業がすでに変えたものがあります。それは" +
    "作業が取り込まれるか終わるまで押さえたままです。",
  holdsRefusedUnread:
    "何も変えていません。この作業が変えたファイルを rondo が読めなかったので、どのファイルも外しません。",
  holdsRefusedPaths:
    "何も変えていません。書いたファイルの一覧は、そのままでは受け付けられません。空である、" +
    "パターンが含まれる、いま押さえているものと同じ、終わった作業にファイルを加えている、のどれかです。",
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
  publishLead:
    "まだ何もこのコンピュータの外に出ていません。公開すると何が起きるかを、いま読み取って示します。実際に公開するのは下のボタンだけです。",
  publishNotYetLead:
    "まだ何もこのコンピュータの外に出ていません。この作業は、いまのままでは公開できません。",
  publishReviewLead:
    "まだ何もこのコンピュータの外に出ていません。公開すると何が起きるかを、いま読み取って示します。" +
    "ただし、この作業のモデルレビューが作業の内容と合っていないため、ここで押せるのは、それを承知で進めるボタンだけです。",
  publishNotYetHeading: "公開できない理由",
  publishTargetHeading: "押すと起きること",
  publishPushes: (branch, remote) => `ブランチ ${branch} を ${remote} へ push します。`,
  publishOpens: (repo, base) => `${repo} に、${base} 向けのプルリクエストを作ります。`,
  publishCloses: () => "rondo の記録では、この作業を完了として閉じます。",
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
  publishModelNote:
    "あなたの判断の参考です。承認ではなく、この画面の内容がこれで決まったわけでもありません。",
  publishNote: (merges) =>
    "ボタンを押すと、rondo があなたの名前で push し、プルリクエストを作り、作業の記録を閉じます。" +
    (merges
      ? "チェックが通れば、承認した範囲にしたがって rondo が既定ブランチにマージします。"
      : "マージはしません。マージするかどうかはあなたが決めます。") +
    "画面を開いたあとに何か変わっていれば、実行せず、理由を表示します。",
  publishPlain: "このブランチを push し、プルリクエストを作り、作業の記録を閉じます。",
  publishBack: "公開の画面に戻る",
  publishNotOffered:
    "このページからは公開できません。公開するには、このコンピュータの rondo が公開者として受け付ける人が必要ですが、" +
    "その指定がないまま起動されています。公開者は、ページを起動するときに rondo へ渡します。",
  publishNotClosed: (status) =>
    `この回は ${status} の状態です。公開できるのは、人が確認で承認した作業だけです。`,
  publishNotApproved: (outcome) =>
    `確認が ${outcome} で終わっていて、人が答えたものではないため、` +
    "公開の根拠になる承認がありません。",
  publishAnswerNotApproval: (answer) =>
    answer === "revise"
      ? "この回の確認には、承認ではなく変更の依頼で答えています。公開の根拠になる承認がありません。"
      : "この回の確認には、rondo がどちらの答えかを記録するようになる前に答えています。" +
        "承認か変更の依頼かが分からないため、推測では公開しません。",
  publishNoRun: "この作業の記録がないため、閉じるものがありません。",
  publishPlanField: (field) =>
    `この回の計画に ${field} が記録されていません。公開はその計画から組み立てるので、このままでは` +
    "公開できません。",
  publishNoRepo:
    "この回には、プルリクエストを出す先が記録されていません。このコンピュータにも指定が" +
    "ありません。ここでは決められません。出す先は、作業する場所を用意するときに、" +
    "このコンピュータで rondo を管理する人が記録します。",
  publishTargetRefused: (reason) => `rondo が保証できる push 先がありません。${reason}`,
  publishUncommitted: (paths) =>
    `作業する場所に、ブランチに載っていない変更が残っています (${paths})。push してもそれは` +
    "残されたままで、ここのボタンでは変えられません。",
  publishUncommittedElsewhere: (branch) =>
    `作業する場所では ${branch} がチェックアウトされていて、push するブランチと違います。`,
  publishUncommittedRemedies:
    "公開のことではなく、そのパスのことを片付けてください。回をやり直して作業者自身にコミットさせ" +
    "読み直させる、作業する場所で自分でコミットする、作業でないなら捨てる、のどれかです。",
  publishStatusUnreadable: (reason) =>
    `作業する場所で git status が読めません (${reason})。push がコミットされていない変更を` +
    "残したままにするかどうかが分からず、ここのボタンでは変えられません。git status が" +
    "答えるように作業する場所を直してから、もう一度来てください。",
  publishReviewHeading: "モデルレビューがこの作業と合っていません",
  publishReviewNoReading:
    "この作業のモデルレビューがありません。「読んでいない」と「読んだが指摘なし」を" +
    "同じに見せないため、公開はここで止めるのが既定です。",
  publishReviewNotClear: (verdict, findings) =>
    `この作業のモデルレビューの結果は '${verdict}' です${findings === "" ? "" : `: ${findings}`}。` +
    "これで何かが決まるわけでも、公開を禁じるものでもありません。あなたがまだ答えていない指摘です。",
  publishReviewNoEvidence:
    "モデルレビューは問題なしとしていますが、何を読んだかの計測が記録されていないため、" +
    "突き合わせて確かめられません。",
  publishReviewUnreadable: (reason) =>
    `いま作業する場所を読めないため (${reason})、モデルレビューの結果と push する内容を` +
    "突き合わせられません。",
  publishReviewMoved: (readTip, nowTip) =>
    `モデルレビューは ${readTip} の時点のもので、いま push するのは ${nowTip} です。レビューが` +
    "この作業の内容と合わなくなっています。",
  publishDespiteFold: "モデルレビューと合わないままプルリクエストを作る",
  publishDespiteAction: "それでもプルリクエストを作る",
  publishDespiteNote:
    "決めるのはあなたです。そのための専用のボタンを、もう 1 回押す必要があります。あなたが" +
    "決めたことを rondo が記録します。モデルレビューの結果はそのまま残ります。",
  publishDespitePlain: "上のモデルレビューがこの作業と合わないまま公開します。",
  scopeBusy: "範囲を記録しています…",
  nextStepHeading: "次にやること",
  nextStepScope:
    "この依頼の範囲（使ってよい費用と触ってよい場所）がまだ決まっていません。範囲を決めると、" +
    "作業を始められます。",
  nextStepDrafted: "rondo が作業の範囲を提案しました。読んで承認すると、作業を始められます。",
  nextStepRondoHeading: "rondo の番です",
  nextStepDrafting:
    "rondo が依頼を読んで、計画を下書きしています。下書きができると、あなたに見てもらう範囲が" +
    "ここに出ます。いまのところ、あなたにしていただくことはありません。",
  nextStepNoDraft:
    "rondo はこの依頼の計画を下書きできませんでした。止まった理由は下のスレッドにあります。" +
    "範囲（使ってよい費用と触ってよい場所）をご自身で決めると、作業を始められます。",
  nextStepAnswer:
    "rondo があなたの答えを待っています。答えるまで、この依頼の作業は先へ進みません。",
  nextStepStart: "範囲は承認済みです。範囲の画面から作業を始めてください。",
  nextStepStartAction: "作業を始める画面へ",
  nextStepPublish: (merges) =>
    "作業は承認済みです。プルリクエストを作ると、ブランチを push してレビューに出します。" +
    (merges
      ? "チェックが通れば、承認した範囲にしたがって rondo が既定ブランチにマージします。"
      : "マージはしません。"),
  nextStepPublishing: (updating, merges) =>
    (updating === null
      ? "作業は承認済みです。承認した範囲にしたがって、rondo がいまプルリクエストを作っています。" +
        "押すボタンはありません。"
      : `競合の解消は承認済みです。承認した範囲にしたがって、rondo がいま ${updating} に push しています。` +
        "押すボタンはありません。") +
    (merges ? "チェックが通れば、rondo が既定ブランチにマージします。" : "マージはしません。"),
  nextStepAddRepository: (named, repo) =>
    `この依頼には ${named} が書かれていますが、rondo はまだ ${repo} で作業したことがないため、` +
    `計画の下書きはしていません。追加すると、${repo} をこのコンピュータの、ほかのリポジトリと` +
    `同じ場所にコピーし、プルリクエストも ${repo} に出します。`,
  nextStepAddProposedRepository: (repo) =>
    `この依頼には、どのリポジトリで作業するかが書かれていません。rondo は ${repo} だと読みましたが、` +
    `${repo} で作業する計画がまだないため、下書きはしていません。追加すると、${repo} をこのコンピュータの、` +
    "ほかのリポジトリと同じ場所にコピーし、そこで作業の下書きを作ってあなたの承認を待ち、" +
    `プルリクエストも ${repo} に出します。違うリポジトリなら、追加せずに、返信で正しいリポジトリを伝えてください。`,
  nextStepRecordSetupPlan: (files) =>
    "このリポジトリで作業する計画がまだ rondo にないため、依頼の下書きはしていません。このコンピュータの" +
    `セットアップは計画ファイルを ${String(files)} 件書き出しましたが、rondo への記録がまだです。残っているのは` +
    "その記録だけです。記録すると、rondo がこの依頼の下書きを作り、あなたの承認を待ちます。",
  nextStepRunSetup:
    "このリポジトリで作業する計画がまだ rondo にないため、依頼の下書きはしていません。このコンピュータでは" +
    "セットアップがまだ実行されていません。このコンピュータで rondo を管理する人が、rondo のフォルダにある" +
    "scripts/dogfood-env.sh を一度実行すると、rondo がこの依頼の下書きを自分で作ります。",
  recordSetupPlanAction: "セットアップの計画を記録する",
  addRepositoryAction: "このリポジトリを追加する",
  addRepositoryBack: "依頼に戻る",
  repositoryUnbuilt: (repo) =>
    `${repo} のビルド方法が rondo には分からなかったため、作業者はファイルの変更とコミットは` +
    "できますが、ビルドやテストは実行できません。",
  addRepositoryRefusedNoApprover:
    "何も追加していません。このコンピュータの rondo はまだあなたが誰かを知らないので、ここでは" +
    "あなたとして何も決められません。",
  addRepositoryRefusedPress:
    "何も追加していません。人がこのページのボタンを押したときだけできる操作で、スクリプトからは" +
    "できません。",
  addRepositoryRefusedForm:
    "何も追加していません。そのフォームはこのページのものではありません。読み込み直してから" +
    "押してください。",
  addRepositoryRefusedInstall:
    "何も追加していません。このコンピュータの rondo が、あなたの名前で GitHub につながりません。" +
    "これを直せるのは、このコンピュータで rondo を管理する人です。直ったあと、同じボタンをもう一度押せます。",
  addRepositoryRefusedUnseen:
    "何も追加していません。GitHub にそのリポジトリが無いか、あなたのアカウントからは見えません。" +
    "依頼に書いた名前が違っていれば、返信で正しい名前を伝えてください。",
  addRepositoryRefusedFailed:
    "何も追加していません。今回はリポジトリをコピーできませんでした。もう一度押しても" +
    "大丈夫です。止まったところから続けます。",
  addRepositoryRefusedChanged:
    "何も追加していません。依頼が変わったか、rondo がすでにそこで作業しているため、このリポジトリを" +
    "追加する必要がなくなっています。依頼に戻って、いまの状態を確かめてください。",
  addRepositoryRefusedNoSetup:
    "何も追加していません。このコンピュータの rondo には、リポジトリを置く場所がまだ" +
    "設定されていません。これを直せるのは、このコンピュータで rondo を管理する人です。",
  approveBusy: "承認を記録しています…",
  startBusy: "作業を始めています…",
  reviseBusy: "変更を頼んでいます…",
  publishBusy: "プルリクエストを作っています…",
  startStoppedHeldSaid: [
    "始めた作業を続けられなくなりました。rondo は自分ではこの作業を終わらせられませんでした。",
    "この作業はまだ、このコンピュータで同時に動かせる作業の 1 つ分を使ったままで、取り置いた費用と受け持つ" +
      "ファイルも戻っていません。終わらせるまで、同じ作業は始め直せません。何が起きたかは、この作業の記録に残っています。",
    "選べること:",
    "- 作業を終わらせる。この依頼の上にある「次にやること」から行えます。理由を書くと rondo が" +
      "受け持っていたものを戻します。そのあとここで「続ける」と答えると、作業をもう一度始めます。",
    "- この作業を止める。あきらめるもの: この依頼の作業。受け持っているものは戻りません。",
    "おすすめ: 作業を終わらせる。",
    "このメッセージに答えるまで、この作業は止まったままです。",
  ].join("\n"),
  lapStoppedSaid: (said) =>
    [
      `作業が途中で止まりました。${said ?? "何が起きたかは、このスレッドの作業の行に出ています。"}`,
      "選べること:",
      "- 続ける。作業をもう一度始めます。あきらめるもの: この回で変更してコミットしていない分。",
      "- この作業を止める。あきらめるもの: この依頼の作業。",
      "おすすめ: 続ける。",
      "このメッセージに答えるまで、この作業は止まったままです。",
    ].join("\n"),
  lapBudgetStoppedSaid: (said) =>
    [
      `作業が予算の上限で止まりました。${said ?? "何が起きたかは、このスレッドの作業の行に出ています。"}`,
      "選べること:",
      "- 予算を増やして続ける。rondo がこの作業のコミットからもう一度始めます。あきらめるもの: " +
        "増やした分の費用と、この回で変更してコミットしていない分。",
      "- 同じ予算のまま続ける。rondo が同じようにもう一度始めます。あきらめるもの: この回で" +
        "変更してコミットしていない分。予算の残りが少ないと、また止まります。",
      "- この作業を止める。あきらめるもの: この依頼の作業。",
      "おすすめ: 予算を増やして続ける。",
      "このメッセージに答えるまで、この作業は止まったままです。",
    ].join("\n"),
  lapLostAsk: [
    "作業の途中で rondo が再起動され、この回は失われました。いま動いているものはなく、" +
      "取り置いていた費用は戻しました。",
    "選べること:",
    "- この作業をもう一度始める（「続ける」と答える）。あきらめるもの: 失われた回で変更してコミットしていない分。",
    "- 作業の内容を変える（「この作業を止める」と答えてから、変えた内容で依頼し直す）。あきらめるもの: この作業のここまでの流れ。",
    "- 止める（「この作業を止める」と答える）。あきらめるもの: この作業。",
    "おすすめ: この作業をもう一度始める。",
    "このメッセージに答えるまで、この作業は止まったままです。",
  ].join("\n"),
  lapEndedAsk: (reason) =>
    [
      "この作業はあなたが終わらせました。動いているものはなく、このコンピュータで同時に動かせる作業の 1 つ分、" +
        "取り置いていた費用、受け持っていたファイルは戻しました。",
      `あなたが書いた理由: ${reason}`,
      "選べること:",
      "- この作業をもう一度始める（「続ける」と答える）。あきらめるもの: 終わらせた回で変更してコミットしていない分。",
      "- 作業の内容を変える（「この作業を止める」と答えてから、変えた内容で依頼し直す）。あきらめるもの: この作業のここまでの流れ。",
      "- 止める（「この作業を止める」と答える）。あきらめるもの: この作業。",
      "おすすめ: この作業をもう一度始める。ただし、書いた理由が作業そのものを変えるべきだという内容なら別です。",
      "このメッセージに答えるまで、この作業は止まったままです。",
    ].join("\n"),
  lapEndedUnreadableAsk: (reason) =>
    [
      "rondo が読めなくなっていたこの依頼の作業を、あなたが終わらせました。このコンピュータで同時に動かせる作業の 1 つ分は" +
        "戻しました。コミットしていなかった変更は残っていません。",
      `あなたが書いた理由: ${reason}`,
      "選べること:",
      "- 続ける（「続ける」と答える）。rondo が依頼の内容から、作業を計画し直します。",
      "- 作業の内容を変える（「この作業を止める」と答えてから、変えた内容で依頼し直す）。あきらめるもの: ここまでの流れ。",
      "- 止める（「この作業を止める」と答える）。あきらめるもの: この依頼の作業。",
      "おすすめ: 続ける。",
      "このメッセージに答えるまで、この作業は止まったままです。",
    ].join("\n"),
  flowStopWithdrawn: [
    "この停止は取り消しました。rondo が直近に始めた 2 つの依頼は、もう両方が失敗とは判定されて" +
      "いません。rondo が下書きを弾いた依頼や、再起動で失われたあと始め直した回は、失敗した依頼には" +
      "入りません。",
    "rondo はこの質問を取り下げ、目標の依頼を続けて出します。ここで答えることはありません。",
  ].join("\n"),
  flowDraftRefusedAsk: [
    "rondo はこの依頼の計画を下書きできませんでした。そのため作業は何も始まっていません。" +
      "弾かれたのは rondo が書いた下書きで、あなたの依頼ではありません。",
    "選べること:",
    "- 依頼を言い換えて、もう一度頼む。あきらめるもの: なし。この依頼はこのまま残ります。",
    "- この依頼を止める（「この作業を止める」と答える）。あきらめるもの: この依頼の作業。",
    "おすすめ: 依頼を言い換えて、もう一度頼む。",
    "rondo は目標のほかの依頼を続けて出しますが、この依頼の下書きを自分からやり直すことはしません。",
  ].join("\n"),
  startStoppedSaid: [
    "始めた作業を続けられなくなったため、rondo が終わらせました。",
    "いま動いているものはありません。このコンピュータで同時に動かせる作業の 1 つ分も、取り置いていた費用も、受け持っていた" +
      "ファイルも戻しました。何が起きたかは、この作業の記録に残っています。",
    "選べること:",
    "- もう一度始める。依頼の内容から始め直します。あきらめるもの: この回でできたもの。",
    "- この作業を止める。あきらめるもの: この依頼の作業。",
    "おすすめ: もう一度始める。",
    "このメッセージに答えるまで、この作業は止まったままです。",
  ].join("\n"),
  startBusyNote:
    "受け付けました。作業の準備をしています。動き出したらすぐ依頼のスレッドに移り、" +
    "そこで進み具合が分かります。もう一度押す必要はありません。",
  lapBusyNote:
    "受け付けました。いま作業が動いていて、確認をお願いするところまで進むとこの画面が切り替わります。" +
    "数分、長いと数十分かかります。もう一度押す必要はありません。" +
    "別のタブで一覧を開くと、作業中だと分かります。",
  publishBusyNote:
    "受け付けました。ブランチを push してプルリクエストを作っています。たいてい 1 分以内に" +
    "終わります。もう一度押す必要はありません。",
  publishRefusedNoApprover:
    "何も公開していません。RONDO_APPROVER が未設定なので、このページが誰として公開するか" +
    "決まりません。",
  publishRefusedPress:
    "何も公開していません。公開は人がこのページのボタンを押して行うもので、スクリプトからは" +
    "できません。",
  publishRefusedForm:
    "何も公開していません。そのフォームはこのページのものではありません。読み込み直してから" +
    "押してください。",
  publishRefusedGone:
    "何も公開していません。この回がもう読めなくなっています。一覧に戻ってください。",
  publishRefusedNotClosed:
    "何も公開していません。この回は、確認で承認されて終わったものではありません。",
  publishRefusedNotApproved:
    "何も公開していません。確認が、人が答えないまま終わっていて、公開してよいという承認が" +
    "ありません。",
  publishRefusedNoRun: "何も公開していません。閉じるべき作業の記録がありません。",
  publishRefusedPlanField: "何も公開していません。この回の計画に、公開に必要な情報が欠けています。",
  publishRefusedNoRepo:
    "何も公開していません。この回にも、このコンピュータの設定にも、プルリクエストを出す先の" +
    "リポジトリが記録されていません。",
  publishRefusedTarget: (detail) =>
    `何も公開していません。push の宛先を rondo が保証できません。${detail}`,
  publishRefusedUncommitted: (detail) =>
    `何も公開していません。コミットされていない変更が作業する場所に残っています (${detail})。`,
  publishRefusedStatusUnreadable: (detail) =>
    "何も公開していません。git status が読めず、コミットされていない変更が残っているか" +
    `分かりません (${detail})。`,
  publishRefusedNotRead:
    "何も公開していません。この作業のモデルレビューが、push する内容と合っていません。" +
    "画面を読み込み直してください。レビューと合わないまま公開するには、そのための別のボタンを押します。",
  publishRefusedNothingOverruled:
    "何も公開していません。モデルレビューはこの作業と合っているので、押し切るものがありません。" +
    "画面を読み込み直して、ふつうの公開ボタンを押してください。",
  publishRefusedChanged:
    "何も公開していません。画面に出ていた内容と、いま公開したら起きることが食い違っています。" +
    "読み込み直し、もう一度読んでから押してください。",
  publishRefusedStillRunning:
    "二重には公開していません。この回の公開は、別の内容を表示していた画面からすでに進んでいます。" +
    "終わるのを待って、読み込み直してください。",
  publishRefusedNoContinuo:
    "何も公開していません。作業の記録を閉じる仕組みが起動しないため、最後まで終えられない" +
    "push は行いません。",
  publishRefusedPushFailed: (detail) =>
    `何も公開していません。ブランチを push できませんでした。${detail}`,
  publishRefusedPullRequestFailed: (detail) =>
    `ブランチは push できましたが、プルリクエストは作れませんでした。${detail} その前にプルリクエストが` +
    "できていたかどうかは、rondo には分かりません。もう一度押す前に GitHub で確かめてください。" +
    "すでにあるプルリクエストは、もう一度押しても作れません。できていた場合、残っているのは" +
    "作業の記録を閉じることだけです。そのためのコマンドは、このコンピュータで rondo を管理する人が確かめられます。",
  publishRefusedRunNotClosed:
    "ブランチは push 済みで、プルリクエストもできています。残っているのは作業の記録を閉じることだけで、" +
    "それがまだ終わっていません。" +
    "何が起きたかは、このコンピュータで rondo を管理する人が確かめられます。",
  nextStepMerge:
    "プルリクエストの最新のコミットでチェックが通り、あなたの答えを待っているものも残っていません。" +
    "マージすると、プルリクエストの取り込み先のブランチへ、リポジトリで許されている方法で" +
    "取り込みます。マージはこのページからは取り消せません。",
  mergeAction: "プルリクエストをマージする",
  mergeConfirmHeading: "この作業のプルリクエストをマージする",
  mergeConfirmInto: (pullRequest, base) =>
    `${pullRequest} を ${base} へ、リポジトリが許す方法で取り込みます。`,
  mergeConfirmCommit: (commit) =>
    `取り込むのはプルリクエストの最新のコミット ${commit} です。チェックはこのコミットで通っています。`,
  mergeConfirmNoUndo:
    "マージはこのページからは取り消せません。この画面を開いたあとにプルリクエストに変化があれば、" +
    "マージせずに、何が変わったかを依頼のスレッドに表示します。",
  mergeConfirmMore: (count) => `ほか ${String(count)} 件`,
  mergeConfirmNotNow: "いまはここからマージできません。依頼に戻ると、次にやることが出ています。",
  nextStepMergeMoved: (count) =>
    `プルリクエストの最新のコミットでチェックが通りました。ただし、この最新のコミットには、この作業のものではないコミットが ${String(count)} 件含まれています（上に挙げています）。マージすると、それらもいっしょに、プルリクエストの取り込み先のブランチへ、リポジトリで許されている方法で取り込みます。マージはこのページからは取り消せません。それらを取り込みたくなければ、ボタンを押さないでください。`,
  mergeMovedAction: "そのコミットも含めてマージする",
  mergeBusy: "マージしています…",
  mergeBusyNote:
    "受け付けました。rondo が GitHub にプルリクエストのマージを頼んでいます。ふつうは数秒で終わります。" +
    "もう一度押す必要はありません。",
  mergeBack: "依頼に戻る",
  mergeRefusedNoApprover:
    "マージしていません。このコンピュータの rondo はまだあなたが誰かを知らないので、ここでは" +
    "あなたとして何も決められません。",
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
    "マージしていません。プルリクエストの最新のコミットでチェックが通ったことを、rondo はまだ" +
    "確かめられていません。チェックが終わるのを待って、もう一度押してください。",
  mergeRefusedAsked:
    "マージしていません。この作業には、あなたの答えを待っている質問や確認が残っています。" +
    "先に答えてください。",
  mergeRefusedMerged: "マージしていません。このプルリクエストはすでにマージ済みです。",
  mergeRefusedLanded:
    "マージしていません。この作業はすでに既定ブランチに入っているので、マージするものが" +
    "残っていません。",
  mergeRefusedMoved:
    "マージしていません。rondo がチェックの結果を確かめたあとで、プルリクエストに新しいコミットが" +
    "加わっています。ページを読み込み直すと、そのコミットが表示されます。",
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
    "何も公開していません。ここで見た内容は失われていません。" +
    "何が起きたかは、このコンピュータで rondo を管理する人が確かめられます。",
  nextStepConflictFix: (pullRequest, base) =>
    `${pullRequest} は ${base} と競合していて、チェックが動きません。rondo に ${base} を` +
    "取り込ませて競合を解消できます。ほかの変更はしません。解消した結果は push の前にここに戻ってくるので、" +
    "あなたの確認を待ってから進みます。",
  nextStepConflictFixing: (pullRequest, base) =>
    `${pullRequest} は ${base} と競合しています。この作業は計画を持たずにほかの作業と並行して始めたものなので、` +
    `承認された範囲で rondo が自分から ${base} を取り込み、競合を解消しています。ほかの変更はしません。` +
    "押すボタンはありません。この解消もほかの作業と同じく、確認待ちで止まります。",
  conflictFixLeft: (reason) => `rondo は自分でこの解消を始めようとしました。${reason}`,
  conflictFixAction: "rondo に競合を解消してもらう",
  conflictFixBusy: "解消を始めています…",
  conflictFixBack: "依頼に戻る",
  nextStepChecksFix: (pullRequest, checks) =>
    `${pullRequest} のチェックが通りませんでした${checks === null ? "" : `（${checks}）`}。rondo にプルリクエストのブランチで` +
    "失敗を再現させて直せます。ほかの変更はしません。直した結果は push の前にここに戻ってくるので、あなたの確認を待ってから進みます。",
  checksFixAction: "rondo に失敗したチェックを再現して直してもらう",
  checksFixBusy: "修正を始めています…",
  conflictFixRefusedNoApprover:
    "何も始めていません。このコンピュータの rondo はまだあなたが誰かを知らないので、ここでは" +
    "あなたとして何も決められません。",
  conflictFixRefusedPress:
    "何も始めていません。人がこのページのボタンを押したときだけできる操作で、スクリプトからは" +
    "できません。",
  conflictFixRefusedForm:
    "何も始めていません。そのフォームはこのページのものではありません。読み込み直してから" +
    "押してください。",
  conflictFixRefusedGone:
    "何も始めていません。プルリクエストにもう解消が要らないか、すでに解消が進んでいます。" +
    "ページを読み込み直すと、いまの状態が分かります。",
  conflictFixRefusedNotItsScope:
    "何も始めていません。使おうとした承認が、この作業が動いた承認と違います。ページを" +
    "読み込み直してから押してください。",
  conflictFixRefusedForked:
    "何も始めていません。この作業の承認が別々に 2 回引き上げられていて、どちらが有効か" +
    "rondo には決められません。",
  conflictFixRefusedNoContinuo: "何も始めていません。作業を動かす仕組みが起動しません。",
  conflictFixRefusedNotSetUp:
    "何も始めていません。解消の準備ができませんでした。何が起きたかは、このコンピュータで rondo を" +
    "管理する人が確かめられます。",
  conflictFixRefusedOutside: (test) =>
    `何も始めておらず、費用も使っていません。もう 1 回試すことは、この作業が動いた承認の範囲を超えます` +
    `（${test} の判定で外れました）。選べることは、依頼のスレッドのメッセージに書いてあります。`,
  conflictFixRefusedNotStarted:
    "何も始めていません。ここで見た内容は失われていません。何が起きたかは、このコンピュータで" +
    " rondo を管理する人が確かめられます。",
  retakeReviewAction: "レビューをもう一度受ける",
  retakeReviewBusy: "レビューをもう一度受けています…",
  retakeReviewBack: "確認に戻る",
  retakeRefusedNoApprover:
    "レビューはやり直していません。このコンピュータの rondo はまだあなたが誰かを知らないので、" +
    "ここではあなたとして何も決められません。",
  retakeRefusedPress:
    "レビューはやり直していません。人がこのページのボタンを押したときだけできる操作で、" +
    "スクリプトからはできません。",
  retakeRefusedForm:
    "レビューはやり直していません。そのフォームはこのページのものではありません。" +
    "読み込み直してから押してください。",
  retakeRefusedGone:
    "レビューはやり直していません。この確認はもう答えを待っていないか、レビューは" +
    "すでにやり直されています。ページを読み込み直すと、いまの状態が分かります。",
  retakeRefusedBudget: (taken, budget) =>
    `レビューはやり直していません。この作業は、承認した範囲で認めたレビュー ${String(budget)} 回の` +
    `うち ${String(taken)} 回を使っていて、やり直すと 1 回増えます。範囲のレビュー回数を` +
    "引き上げれば、やり直せます。",
  retakeRefusedForked:
    "レビューはやり直していません。この作業の承認が別々に 2 回引き上げられていて、レビューが" +
    "あと何回できるかが決まりません。どちらが有効かは rondo には決められません。",
  retakeRefusedNoContinuo: "レビューはやり直していません。作業を動かす仕組みが起動しません。",
  nextStepPublishUpdate: (pullRequest, merges) =>
    `競合の解消は承認済みです。公開すると ${pullRequest} に push し、チェックがもう一度` +
    "動きます。" +
    (merges
      ? "チェックが通れば、承認した範囲にしたがって rondo が既定ブランチにマージします。"
      : "マージはしません。"),
  publishUpdates: (pullRequest, base) =>
    `${base} 向けに開いている ${pullRequest} へ push します。プルリクエストは新しく作りません。`,
  publishUpdateAction: (pullRequest) => `プルリクエスト ${pullRequest} を更新する`,
  publishBusyUpdate: "プルリクエストを更新しています…",
  publishPlainUpdate: "このブランチを開いているプルリクエストへ push し、作業の記録を閉じます。",
  publishNoteUpdate: (merges) =>
    "ボタンを押すと、rondo があなたの名前で、開いているプルリクエストへ push し、作業の記録を閉じます。" +
    (merges
      ? "プルリクエストは作りません。" +
        "チェックが通れば、承認した範囲にしたがって rondo が既定ブランチにマージします。"
      : "プルリクエストは作らず、マージもしません。") +
    "画面を開いたあとに何か変わっていたり、" +
    "プルリクエストが閉じていたりすれば、実行せず、理由を表示します。",
} satisfies Chrome);
