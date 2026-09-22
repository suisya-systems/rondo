/**
 * The Japanese set of rondo's own prose, a whole {@link Chrome} (D-0079). The
 * type and the selection among sets are in `src/access/wording.ts`.
 */

import { APPROVED_OUTCOME } from "../../store/records.js";
import { PAGE_JA } from "../page/words.js";
import type { AgentTypeSource, Chrome } from "../wording.js";

/** The same three, as the {@link JA} set says them. */
function agentTypeSourceJa(from: AgentTypeSource): string {
  switch (from) {
    case "iteration":
      return "周回のプラン";
    case "scope":
      return "範囲に記録されたプラン";
    default:
      return "この範囲が記録するプラン";
  }
}

/** A finding's severity as the {@link JA} set names it, wherever it names one. */
function severityJa(severity: string): string {
  return { blocker: "阻害", major: "重大", minor: "軽微", nit: "細部" }[severity] ?? severity;
}

function scopeTestJa(test: string): string {
  switch (test) {
    case "decision":
      return "範囲がまだ承認されていません";
    case "superseded":
      return "この範囲は新しい範囲に置き換えられています";
    case "request":
      return "この範囲はこの依頼を含んでいません";
    case "workspace":
      return "この作業が動く場所を、この範囲は含んでいません";
    case "agent_type":
      return "この作業のエージェント種別を、この範囲は許していません";
    case "contract":
      return "この作業は、そのエージェント種別に許されている以上のことを必要としています";
    case "irreversible":
      return "この作業は、範囲が取り返しのつかない行為として止めているものを行います";
    case "expiry":
      return "範囲の期限が切れています";
    case "laps":
      return "範囲の周回数を使い切っています";
    case "cost":
      return "費用がまだ読めていない周回の引当も含めると、範囲の費用の予算にもう 1 周回分の余裕がありません";
    case "asks":
      return "依頼のスレッドにある問いが、この作業を止めています。どの問いかはスレッドにあります";
    case "grants":
      return "この作業は、続く元の周回より多くを許されることになります";
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
    blockers === 0 ? "" : `阻害 ${String(blockers)} 件`,
    majors === 0 ? "" : `重大 ${String(majors)} 件`,
  ]
    .filter((part) => part !== "")
    .join("、");
}

/** The three measurements a basis names, in the Japanese set's words. */
const JA_MEASURE: Record<string, string> = {
  first_lap_cost: "初回周回の費用",
  redo_cost: "やり直した周回の費用",
  lap_duration: "周回の所要時間",
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
  lang: "ja",

  liveNote: (seconds) =>
    `${String(seconds)}秒ごとに描き直しますが、描き直しは何も書き込みません。最後に見た印は動かず、
提示も数えられません。書き込むのは approve ボタンだけで、押した時点の説明を記録してからゲートに
答えます。`,
  stillNote: `押したときに記録されるのは、いま読んでいる内容そのものです。だから読んでいるあいだ、
画面がひとりでに書き換わることはありません。読むこと自体は何も書き込みません -- 最後に見た印は動かず、提示も
数えられません。書き込むのは approve ボタンだけで、押した時点の説明を記録してからゲートに答えます。`,
  noApproverNote:
    "RONDO_APPROVER が設定されていないので、このページが誰として答えることもできず、" +
    "その人の inbox も描けません。",

  endedHead: (status, since, why) => `${status} ${since}前 -- ${why}`,
  gateAnswered: (outcome) =>
    outcome === APPROVED_OUTCOME ? "ゲートで承認された" : `ゲートに '${outcome}' と答えた`,
  statePill: (status, gateOutcome) =>
    (
      ({
        awaiting_human: "あなたの回答待ち",
        withdrawal_requested: "取り下げ依頼中",
        stalled: "停止中",
        planned: "開始中",
        classified: "開始中",
        admitting: "開始中",
        admitted: "開始中",
        performing: "実行中",
        closed:
          gateOutcome === "approve" || gateOutcome === APPROVED_OUTCOME
            ? "承認済み"
            : gateOutcome === "revise"
              ? "差し戻し"
              : gateOutcome === null
                ? "完了"
                : `完了: ${gateOutcome}`,
        abandoned: "放棄",
        failed: "失敗",
      }) as Record<string, string | undefined>
    )[status] ?? status,
  noReasonRecorded: "理由は記録されていない",
  aboutIteration: (iterationId) =>
    iterationId === null ? "どの iteration についてでもない" : `'${iterationId}' について`,
  willNotDecode: (reason) => `読み取れません: ${reason}`,

  spent: (cost, turns, took) => `${cost}、${turns}、${took}`,
  fenceUnknown: "fence: continuo は何を拒否したか答えられませんでした",
  fenceRefusedNothing: "fence は何も拒否しませんでした",
  fenceRefused: (denials) => `fence が拒否したもの: ${denials}`,

  pressNote: "「承認する」を押すと「提示された」として記録される内容と、その対象:",
  approveNote: (gateId, word) =>
    `ゲート ${gateId} に '${word}' と答えます。rondo answer と同じ動作です`,

  asksWaiting: (count) => `あなたへの質問 ${String(count)}`,
  askWaitingPill: "あなたの回答待ち",
  askStoppedPill: "あなたが止めた線",
  answerStoppedPill: "この線を止めた",
  answerCarriedOnPill: "続けた",
  you: "あなた",
  drafterNoDraft:
    "rondo はこの依頼の下書きを作れなかったので、まだ何も提案されていません。範囲はご自身で" +
    "決められます。",
  drafterNoDraftWhy: "止まった理由",
  issueRead: (pullRequest, comments) =>
    `rondo がこの${pullRequest ? "プルリクエストの会話" : "イシュー"}` +
    `${comments === 0 ? "" : `とコメント ${String(comments)} 件`}を読みました。` +
    "作業者には書かれたとおりの全文が渡されます。",
  issueReadFold: "読んだ内容",
  issueNotRead: (why) =>
    ({
      no_gh: "この環境の rondo はまだイシューを読めません",
      signed_out: "この環境の rondo はまだイシューを読めません",
      no_repo: "この環境の rondo は、この番号がどのリポジトリのものかを知りません",
      missing: "このイシューが見つからないか、あなたのアカウントからは見えません",
      refused: "このイシューへのアクセスが、あなたのアカウントでは拒否されました",
      too_long: "イシューが長すぎて丸ごとは渡せず、一部だけを渡すこともしていません",
      too_many: "rondo が 1 つのメッセージから読むイシューは 5 件までで、これはその先でした",
      failed: "rondo はこのイシューを読めませんでした",
    })[why] + "。そのため作業者には、ここにあなたが書いたことだけが渡されます。",
  issueNotReadTail:
    "費用はかかっていません。イシューに依頼にないことが書かれていれば、別のメッセージで伝えて" +
    "ください。",
  issuePending: "rondo はまだこれを読んでいません。rondo がここで動いている間に読みます。",
  scopeIssuesHeading: "この依頼が名指ししたイシュー",
  scopeIssueGiven: "作業者に渡す",
  scopeIssueNotGiven: "渡さない: 読めなかった",
  scopeIssuePending: "まだ読んでいない",
  scopeDoneHeading: "完了の定義 (rondo がどの作業にも付けます)",
  scopeDoneAsks: [
    "作業はこの作業のブランチにコミットする。",
    "報告の前に、リポジトリが定める手順でインストールと検証を回す。",
    "検証が回せない・通らないときは報告でそう言い、通ったとは言わない。",
  ],
  scopeDoneRules: (files) => `手順はリポジトリの ${files.join("、")} に従うよう伝えます。`,
  scopeDoneNoRules:
    "このプランはリポジトリの規則ファイルを名指していないので、手順は作業者がリポジトリの文書から探します。",
  scopeDoneExact: "作業者に送る文面 (英語)",
  inReplyTo: (who, words) => `${who} への返信: ${words}`,
  basesLabel: "根拠",
  replyAction: "返信する",
  replyingTo: (who, since) => `${who} に返信 · ${since}前`,
  answeringTo: (who, since) => `${who} の質問に回答 · ${since}前`,
  answerAskAction: "回答する",
  answerCarryOnAction: "続ける",
  answerStopAction: "この線を止める",
  answerOutcomeNote:
    "書いたとおりに送られます。「続ける」は仕事をもう一度試させ、「この線を止める」は止めたままにします。" +
    "あとから「続ける」こともできます。",
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
  govTries: (at, of) => `${String(at)} 回目 ／ ${String(of)} 回まで`,
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
    "会話がこのメッセージを記録しませんでした。返信先のメッセージがスレッドに無いのかもしれません。スレッドを読み込み直してから、もう一度試してください。",
  sendRefusedAsk:
    "返信先は、まだあなたの回答を待っている質問です。スレッドを開いて「回答する」を押してください。",
  sendRefusedTooLong:
    "このページが受け付けるより長いメッセージです。短くするか、2 つの返信に分けてください。",
  sendRefusedUnknown:
    "rondo はこのメッセージを受け取りませんでした。ページを読み込み直してから、もう一度送信してください。",
  answerRefusedPress:
    "回答は「回答する」ボタンを押したときだけ受け付けます。スレッドを読み込み直して、もう一度「回答する」を押してください。",
  replyNotAnswer: "返信しただけでは、このスレッドで待っている質問に答えたことになりません。",
  sendBack: "スレッドに戻る",
  sendBackNote: "ブラウザの「戻る」で、書いた文に戻れます。",
  threadsLiveNote: (seconds) =>
    `${String(seconds)}秒ごとに描き直しますが、描き直しは何も書き込みません。ここで書き込むのは送信だけで、` +
    "書いた文をそのまま RONDO_APPROVER の名前でスレッドに記録します。メッセージは何も承認しません。",
  approvePlain: "この作業をこのまま受け入れます。",
  approveFace: "承認する",
  approveDespite: "指摘を残したまま承認する",
  approveDespitePlain: "モデルレビューが挙げた点に答えないまま、この作業をこのまま受け入れます。",
  undeterminedFold: (count) => `rondo が決められなかった項目 ${String(count)} 件`,
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
  whyStopped: "止まった理由",
  whyNotRead: "作業者自身の説明は読み取れませんでした。読めていれば下のテキストにあります。",
  workHeading: "変わったもの",
  changedAgainst: (baseRef) => `${baseRef} との比較`,
  changedUnreadable:
    "作業場所を読み取れなかったため、この作業で何が変わったかをここには出せません。" +
    "作業場所がまだ残っているかどうかは、このマシンで rondo を管理する人に確かめてもらえます。",
  changedNoRange: "比べる相手のブランチが記録されていないので、変更を一覧にできません。",
  noCommits: "ブランチにコミットはありません。",
  noFiles: "変わったファイルはありません。",
  binaryFile: "バイナリ",
  moreRows: (count) => `ほか ${String(count)} 件`,
  reachHeading: "押さえているファイルの外に出たもの",
  reachCollided: (paths) =>
    `この作業は ${filesJa(paths)} を変更しましたが、これは別の作業が押さえているファイルです。` +
    "同じファイルを二つの作業が書き換えているので、取り込むときにぶつかります。" +
    "承認する前に、もう一方の作業を見てください。",
  reachUnheld: (paths) =>
    `この作業は ${filesJa(paths)} を変更しましたが、これは自分で押さえると言ったファイルの外です。` +
    "ほかに押さえている作業はないので、止まるものはありません。押さえる範囲は広げていません。" +
    "広げるかどうかを決めるのはあなたです。",
  reachUnread:
    "この作業が変更したものと、押さえているファイルとを突き合わせられませんでした。" +
    "ここに別の作業のファイルが混じっているかどうかは、rondo には言えません。",
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
    "作業をチェックした記録がありません。公開するときに、それで進めてよいかを確認します。",
  checksCounted: (commits, files) =>
    `コミット ${String(commits)} 件とファイル ${String(files)} 件を読みました。`,
  whatItRead: "読んだものと読んでいないもの",
  readingCovered: (reach) => {
    const built =
      "ビルドもテストも、何かの実行もしていません。rondo は周回の作業を動かせないためです。" +
      "この周回に求められた検証が実際に行われたかどうかは、確かめてもいなければ、行われたとも言っていません。";
    switch (reach) {
      case "model":
        return (
          "読んだのは、コミット済みの差分、コミットメッセージ、周回への指示、作業記録に残ったコマンドと" +
          "その出力、それに渡されたリポジトリの決まりごとです。自分では何も実行していません。" +
          "材料は渡しましたが、それが理解されたかどうかは確かめようがありません。"
        );
      case "history":
        return (
          `${built}読んだのはコミット済みの履歴だけで、周回が頼まれたとおりのことをしたかどうかは` +
          "判断できません。"
        );
      case "historyAndStatus":
        return (
          `${built}読んだのはコミット済みの履歴と、作業場所に残るコミットされていない変更で、` +
          "周回が頼まれたとおりのことをしたかどうかは判断できません。"
        );
      default:
        return "この読み手が何を見たかは記録されていないため、どこまで確かめたかはここでは言えません。";
    }
  },
  basisNone: "根拠の指定なし",
  basisUnresolved: "どれも渡した作業と一致しませんでした",
  modelPending: "まだ届いていません。これから届くかもしれません。",
  modelOlder:
    "以前のコミットを読んだ結果です。いまのコミットを読んだ結果は、これから届くかもしれません。",
  reloadPage: "読み込み直す",
  readingsNote: "どちらの読み取りも判断材料です。どちらも何も承認しません。答えるのはあなたです。",
  allAsText: "記録全文 (上に出していない項目も含む)",
  claimLabel: "確認したこと (承認と一緒に記録されます)",
  claimPlaceholder: "例: 手元でテストを実行した / 差分を読んだ / スマートフォンで画面を開いた",
  claimTooLong: (max) =>
    `確認した内容が、このページで受け付ける ${String(max)} 文字より長くなっています。短くしてから、もう一度 approve を押してください。`,
  claimGateUnread:
    "rondo がこのゲートを読めなかったため、確認した内容は記録していません。ゲートに戻って、もう一度試してください。",
  claimGateClosed:
    "ゲートがすでに回答済みだったため、確認した内容は記録していません。ゲートに戻ると、どう終わったかを確認できます。",
  claimNotRecorded:
    "rondo が確認した内容を記録できなかったため、何も回答していません。ゲートに戻って、もう一度試してください。",
  claimHostSetup:
    "この環境の rondo は、確認した内容を記録できません。そのため何も回答しておらず、費用もかかっていません。" +
    "この環境のセットアップが終わっていないか、動かなくなっています。" +
    "もう一度 approve を押しても同じです。この環境の rondo を用意した人なら、理由を見られます。",
  answerNotDone: "回答されませんでした",
  gateBack: "ゲートに戻る",
  modelRaised: (blockers, majors) => `モデルレビューの指摘: ${raisedJa(blockers, majors)}。`,
  modelRaisedLink: "読む",
  severityWord: severityJa,
  severityCount: (severity, count) => `${severityJa(severity)} ${String(count)} 件`,
  readingNotTaken: "読み取りを取れなかったため、判断材料はありません。",
  whyNotTaken: "理由",
  checksWorkUnreadable:
    "いまは変わったものを読み取れないため、この読み取りを作業と照らし合わせられません。",
  checksNotMatched: "照合できず",
  modelNotTaken: "チェックだけが読みました。モデルレビューは取れていません。",
  neitherReadingTaken: "チェックもモデルレビューも、この作業を読めませんでした。",
  recordsFold: (count) => `承認したときに記録される内容 (${String(count)} 項目) と記録全文`,
  denialUnreadable: "どのコマンドだったかを rondo は記録できませんでした。",
  modelMayArrive: "モデルレビューはこれから届くかもしれません。",
  reachYourTurn: "rondo があなたの答えを待っています。",
  reachLate: "rondo に、かかると決めていた時間を過ぎても終わらないものがあります。",
  chimeAsk: "自分の番になったら、このタブで知らせる",
  liveLabel: "ライブ",
  keyMove: "移動",
  keyOpen: "開く",
  keyBack: "戻る",
  keyWrite: "書く",
  textSizeLabel: "文字の大きさ",
  textSizes: ["標準の文字", "大きい文字", "もっと大きい文字"],

  inboxNote: "ここを読んでも最後に見た印は動きません。印を動かすのは rondo inbox です。",

  inboxFor: (actorId) => `'${actorId}' の inbox`,
  waitingOnYou: "あなたを待っているもの",
  bindingProposals: (count) => `  承認すると契約になる proposal (${String(count)})`,
  nonBindingProposals: (count) => `  何も拘束しない proposal (${String(count)})`,
  readOneBack: "    選択肢と各々の根拠つきで 1 件読み直す: rondo show --proposal-id ID",
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
  neverLooked: "  まだ一度も見ていません: 以下に new の印は付きません",
  nothingChanged: "  なし",
  censusEntry: (kind, count) => `${kind} ${String(count)}`,
  changeLine: (kind, id, since) => `    ${kind}  ${id ?? "(id なし)"}  ${since}前`,
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
    "ここにあるのは run 自身の declaration で、fence の全体ではありません。continuo は",
    "role のテンプレートを同じ allow リストへ展開しますが、rondo はここでそれを読みません。",
  ]),
  secondFence: Object.freeze([
    "worker 自身の sandbox は第二の封じ込めですが、rondo はそれを観測しません。何も拒否",
    "しないまま起動に失敗しうるので、sandbox が無効なまま走った lap もそうでない lap と",
    "まったく同じように表示されます。それを報告したことがあるのは、ゲートに置かれた",
    "worker 自身の記述だけです (D-0050)。",
  ]),
  lapNestedSandbox:
    "作業を始める前に止めました。rondo が別のサンドボックスの中（たいていは別の Claude Code " +
    "の中）で動いているため、作業する側が自分のサンドボックスを立ち上げられず、このまま" +
    "ではコマンドが守られずに実行されてしまいます。rondo を普段の端末から起動し直してから、" +
    "もう一度試してください。",

  scopeAction: "範囲を決める",
  scopeHeading: "この依頼の範囲",
  backToThread: "依頼に戻る",
  scopeLead:
    "範囲を決めるのはあなたです。プランは rondo が持っているものから選び、数値はこのストアに" +
    "記録された周回から出しています。読んで、変えたいところを変えてください。1 回押せば記録と" +
    "承認の両方が行われます。",
  scopeNoPlanHeld:
    "この作業に使えるプランを rondo はまだ持っていません。このマシンでの rondo のセットアップから、" +
    "まだプランを受け取っていないためです。",
  scopePlansUnread: (reason) =>
    `rondo が持っているプランを読めなかったので、選べるものがありません: ${reason}`,
  scopePlanAsk: "作業に使うプラン",
  scopePlanGone:
    "選んだプランは、この依頼ではもう使えなくなりました。次の中から選び直してください。",
  scopePlanFrom: (from) =>
    from === "message"
      ? "このスレッドに貼られたもの"
      : from === "setup"
        ? "このマシンのセットアップで用意したもの"
        : "以前の周回が使ったもの",
  scopePlanLine: (where, agentType, from) => `${where}、エージェント種別 ${agentType}（${from}）`,
  scopePlanHeldAt: (line, at) => `${line}、${at} UTC から保持`,
  scopeDraftedLead:
    "この依頼の範囲を rondo が下書きしました。下の作業と、このストアに記録された周回から出した" +
    "予算です。そのまま承認するか、先に値を変えてください。変えた場合は、rondo の下書きの" +
    "代わりにあなたの版が記録されます。",
  scopeDraftedPlansHeading: "rondo が動かそうとしている作業",
  scopeDraftedPlan: (n) => `作業 ${String(n)}`,
  scopeDraftedTemplateGone: "この下書きの元になったプランを、rondo はもう持っていません。",
  scopeNarrowed: (computed) => `ここに書かれた内容に合わせて、rondo が ${computed} から下げました:`,
  scopeNarrowedStricter: "ここに書かれた内容に合わせて、rondo が「重大」より厳しくしました:",
  scopeNarrowedAdded: "ここに書かれた内容に合わせて、rondo が加えました:",
  scopeRedrafted:
    "上の範囲が承認されたあとで、rondo が下書きし直しました。新しい下書きは下にあります。" +
    "承認すると、この依頼の範囲がもう 1 つ加わり、上の範囲はそのまま残ります。",
  scopeDraftedAction: "承認する",
  scopeDraftedPlain: "この範囲、または値を変えたあなたの版を承認します",
  scopeDraftedPressNote:
    "1 回押せば承認されます。値を変えた場合は、rondo が下書きの代わりにあなたの版を記録して" +
    "承認します。承認しただけでは何も消費しません。周回は始まる時点で毎回この範囲に照らして" +
    "判定されます。",
  planStartAction: "この作業を始める",
  planStartPlain: "この作業で周回を 1 つ始め、承認した範囲に数えます",
  planStarted: "開始済みです。",
  planStartedLink: "周回を開く",
  planBusy: (limit) =>
    limit === 1
      ? "まだ空きがありません。同時に動かせる周回は 1 件までで、いまその 1 件が動いています。" +
        "その周回がゲートまで進むと、ここに開始ボタンが出ます。"
      : `まだ空きがありません。同時に動かせる周回は ${String(limit)} 件までで、いま` +
        "そのすべてが動いています。どれかがゲートまで進むと、ここに開始ボタンが出ます。",
  planFull: (live, limit) =>
    `まだ空きがありません。開いている周回が ${String(live)} 件あり、このホストが許す上限` +
    `（${String(limit)} 件）です。どれかが終わると、ここに開始ボタンが出ます。`,
  planOutside: (test) => `始められません。${scopeTestJa(test)}。`,
  planUnrunnable: "もう動かせなくなりました。依頼のスレッドに返信すると、下書きし直されます。",
  planUnrunnableWhy: "止めている理由",
  planUndecidable: "いま、この作業を範囲に照らして確かめられませんでした。",
  scopeNoPlanForScope:
    "この範囲が許す場所とエージェント種別のプランを rondo はまだ持っていないので、この範囲で" +
    "開始できるものがありません。それに合うプランを依頼のスレッドに返信として貼ってください。",
  scopeNoApprover:
    "RONDO_APPROVER が設定されていないので、このページが誰として範囲を承認することもできません。",
  scopeWorkspace: (repository, root) => `${repository}（${root}）`,
  scopePlanDigest: (digest) => `プラン ${digest}`,
  scopeAgentType: (digest) => `エージェント種別 ${digest}`,
  scopeAgentTypeBounds: "そのエージェント種別に許されていることと、それをどこから読んだか",
  scopePlanHeading: "rondo が動かすプランと、動かす場所",
  scopeDigestsFold: "rondo が記録するダイジェスト",
  scopeMaybeApproved:
    "この依頼の範囲をすでに承認済みかどうかは、ここからは分かりません。どちらであってもこれは" +
    "新しい下書きで、押せば 2 つめが記録されます。",
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
    "数を選ぶと予算はプランから引き直されるので、入力した値は rondo の下書きに戻ります。",
  scopeLapsLabel: "周回数",
  scopeRoundsLabel: "レビュー回数",
  scopeCostLabel: "費用（USD）",
  scopeReserveLabel: "費用未読の周回ごとの引当（USD）",
  scopeExpiresLabel: "有効期限（UTC）",
  scopeFormula: (how) => `計算: ${how}`,
  scopeFormulaRounds: "選んだレビュー回数そのもの",
  scopeFormulaLaps: (plans, rounds) =>
    `プラン数 x レビュー回数 = ${String(plans)} x ${String(rounds)}`,
  scopeFormulaReserve: "最も高かった初回周回の費用を、0.10 USD 単位で切り上げた値",
  scopeFormulaCost: (plans, reserve, laterRounds, redo) =>
    `プラン数 x（引当 + 2 回目以降のラウンド数 x やり直し費用）= ` +
    `${String(plans)} x（${reserve} + ${String(laterRounds)} x ${redo}）`,
  scopeFormulaExpires: (laps, seconds) =>
    `下書き時刻 + 周回数 x 最長の周回 + 返信のための 1 日 = 下書き時刻 + ` +
    `${String(laps)} x ${String(seconds)} 秒 + 24 時間`,
  scopeBasesFold: (count) => `この数の出どころ (${String(count)})`,
  scopeBasisRows: (measurement, laps, tier) =>
    `${tier === null ? "このエージェント種別" : `tier ${tier}`}の直近 ${String(laps)} 周回のうち、` +
    `${JA_MEASURE[measurement] ?? measurement}が最も高かったもの`,
  scopeBasisColdStart: (measurement) =>
    `${JA_MEASURE[measurement] ?? measurement}: このストアでは一度も測っていないので、rondo の` +
    `初期値を使いました`,
  scopeColdStartNote: (whole) =>
    whole
      ? "ここではまだ周回が記録されていないため、この値は rondo の既定値で、測った値ではありません。"
      : "一部は rondo の既定値です。挙げたエージェント種別のうち、ここでまだ周回が記録されていないものがあります。",
  scopeBasisPlans: (plans) => `プラン数: ${String(plans)}`,
  scopeBasisRounds: (rounds, byDefault) =>
    byDefault
      ? `レビュー回数: ${String(rounds)}（誰も選ばなかったときに rondo が使う数）`
      : `レビュー回数: ${String(rounds)}（あなたが選んだ数）`,
  scopeBasisReplyAllowance: "あなたの返信のための 1 日。測った値ではなく、見込みの余裕です",
  scopeBasisLap: (iterationId) => `周回 ${iterationId}`,
  scopeSampleHeading: "依頼の大きさが過去の周回と同じくらいだと見て、予算を出しています",
  scopeSampleRows: (laps, tier, lowest, highest) =>
    `${
      tier === null
        ? "このエージェント種別"
        : `まだ記録のないエージェント種別なので、同じ tier ${tier} の別のエージェント種別`
    }の初回周回 ${String(laps)} 件をもとに下書きしました。費用は ` +
    `${lowest === highest ? highest : `${lowest}〜${highest}`} USD で、引当にはその最高値を` +
    `使っています。rondo が記録しているのは周回にかかった費用だけで、どれだけの作業をしたかは` +
    `記録していません。そのため、この依頼がそれらと同じくらいの大きさかどうかは分かりません。` +
    `大きいと思うなら、ここで費用を上げてください。初回の作業で使い切っても、作業があなたの` +
    `確認に戻ってきたときに引き上げられます。`,
  scopeSampleColdStart: (reserve) =>
    `このエージェント種別にも、その tier にも、記録された周回がありません。そのため引当は ` +
    `rondo の初期値 ${reserve} USD で、誰かが測った値ではありません。依頼がどれだけの大きさ` +
    `かも分かりません。小さな変更では済まないと思うなら、ここで費用を上げてください。作業が` +
    `あなたの確認に戻ってきたときに引き上げることもできます。`,
  scopeDefaultsHeading: "rondo が埋めたもの",
  scopeDefaultNote: "既定値で、依頼から導いたものではありません。",
  scopeSeverityLabel: "この重大度以上の指摘が出たら 1 ラウンド終了",
  scopeOutwardLabel: "この範囲で許す外向きの行為",
  scopeOutwardAct: (act) =>
    ({
      push_branch: "ブランチを push する",
      open_pull_request: "プルリクエストを開く",
    })[act] ?? act,
  scopeOutwardNone: "なし",
  scopeIrreversibleNone: "取り返しのつかない行為の一覧には何も足しません。",
  scopeCostCaveat:
    "費用の予算は周回そのものの費用だけを数えます。レビュー側の費用は数えず、費用がまだ読めて" +
    "いない周回は引当を保持しますが、これは見積もりです。",
  scopePressNote:
    "1 回押すと、この範囲があなたの名前で記録され、承認されます。承認しただけでは何も消費" +
    "しません。行為はそれが取られた時点で毎回この範囲に照らして判定されます。",
  scopePlain: "この範囲を記録して承認します",
  scopeApproved: (since) => `${since}前に承認済み`,
  scopeDigest: (digest) => `ダイジェスト ${digest}`,
  scopeNotThisRequest: "その承認はこの依頼のものではないので、ここには何も表示しません。",
  scopePredecessorSpent: (laps, usd, unread) =>
    `これが置き換える範囲は、これまでに ${String(laps)} 周回と読み取り済み $${usd} を使い、` +
    `費用がまだ読めていない ${String(unread)} 周回が引当を保持しています。`,
  scopePredecessorNoApproval:
    "これが置き換える範囲は承認されたことがないので、何も使っていません。",
  scopePredecessorUnreadable: (reason) =>
    `置き換える範囲が何を使ったかは読めませんでした: ${reason}`,
  scopeRetired:
    "後から入った範囲に置き換えられたので、ここで承認した範囲では何も始まりません。" +
    "始めるなら、新しいほうの範囲で始めることになります。",
  startAction: "作業を始める",
  startPlain: "この承認のもとで 1 周回を始めます",
  startAgainSafe:
    "二度押しても、始まる周回は 1 つです。2 回目の押下は 1 回目にまとめられ、それ以上は" +
    "始まりません。",
  startNote:
    "依頼に書いた言葉が、そのまま作業への指示になります。周回の名前は rondo が付けるので、" +
    "あなたが決める必要はありません。",
  scopeRefusedNoApprover:
    "何も記録していません。RONDO_APPROVER が設定されていないので、このページが誰として範囲を" +
    "承認することもできません。",
  scopeRefusedPress:
    "何も記録していません。範囲の承認はこのページのボタンを人が押したときだけ行われ、" +
    "スクリプトからはできません。",
  scopeRefusedForm:
    "何も記録していません。そのフォームはこのページのものではありません。読み込み直してから" +
    "押してください。",
  scopeRefusedFields:
    "何も記録していません。数値のどれかが rondo の使える値になっていません。予算を確かめてから" +
    "押してください。",
  scopeRefusedNotTaken: "何も記録していません。ストアがこの範囲を受け付けませんでした。",
  scopeRefusedPlanChanged:
    "何も記録していません。あの画面のプランは、もうこの依頼で rondo が選べるものではありません。" +
    "読み込み直して、選び直してください。",
  scopeRefusedEdited:
    "今回は何も記録していません。そのフォームはすでに記録・承認済みで、いま変えた内容は" +
    "保存されている内容とは違います。読み込み直して、新しい範囲を下書きしてください。",
  scopeRefusedNotRead: "範囲は記録されましたが読み戻せないので、承認はしていません。",
  scopeRefusedNotShown:
    "範囲は記録されましたが、あなたに見せたことを rondo が書き残せなかったので、承認は" +
    "していません。",
  scopeRefusedNotApproved: "範囲は記録されましたが、承認されていません。何も消費されていません。",
  startRefusedNoApprover:
    "何も開始していません。RONDO_APPROVER が設定されていないので、このページが誰として作業を" +
    "始めることもできません。",
  startRefusedPress:
    "何も開始していません。作業の開始はこのページのボタンを人が押したときだけ行われ、" +
    "スクリプトからはできません。",
  startRefusedForm:
    "何も開始していません。そのフォームはこのページのものではありません。読み込み直してから" +
    "押してください。",
  startRefusedNoPlan:
    "何も開始していません。選んだプランが、この依頼で使えるプランのなかにありません。",
  startRefusedNoRequest:
    "何も開始していません。依頼を読み戻せなかったので、作業に頼むことがありません。",
  startRefusedNoContinuo: "何も開始していません。作業を動かす部分が起動しません。",
  startRefusedOutside: (test) =>
    `何も開始せず、何も消費していません。承認した範囲の外にある作業で、${test} の判定で` +
    `外れました。選択肢は依頼のスレッドに書かれたメッセージにあります。`,
  startRefusedNotAdmitted:
    "何も開始せず、何も消費していません。承認はそのまま有効なので、もう一度押しても安全です。",
  scopeBack: "範囲に戻る",

  reviseAction: "変更を依頼する",
  revisePlain: "書かれた内容をこのゲートに送り、同じ承認のもとで 2 周目をその内容で動かします。",
  reviseLabel: "変更してほしいこと",
  revisePlaceholder: "例: パーサーの変更はそのまま、コマンドラインには手を入れないでほしい",
  reviseNote:
    "書かれた言葉はそのままゲートに渡り、2 周目はその言葉で作業をやり直すよう頼まれます。" +
    "その周回と費用は、この周回が動いた承認の枠に数えられます。周回の名前は rondo が" +
    "付けるので、入力の必要はありません。",
  reviseNoScope:
    "承認済みの範囲のもとで始めた周回ではないため、2 周目を数える枠がありません。" +
    "ここから変更を依頼することはできません。",
  reviseDraftFinding: (severity, text) => `- ${severityJa(severity)}: ${text}`,
  reviseDraftBases: (bases) => `  場所: ${bases}`,
  reviseDraftChange: (words) => `  直すこと: ${words}`,
  reviseDrafted:
    "レビューで見つかった点から rondo が下書きしました。自由に編集できます。送る内容はあなたのものです。",
  reviseDrafting:
    "レビューで見つかった点から、変更内容の下書きを作成中です。1〜2 分後にページを再読み込みすると表示されます。" +
    "待つ必要はなく、今すぐ自分で書くこともできます。",
  reviseUndrafted:
    "今回は rondo が変更内容を下書きできませんでした。このレビューについて再度試みることはありません。" +
    "変更してほしいことをご自身で書いてください。レビューで見つかった点は上にあります。",
  reviseDraftArrived:
    "書き始めた後に下書きが届きましたが、あなたの書いた内容をそのまま残しています。下書きを見るには、" +
    "欄を空にしてからページを再読み込みしてください。",
  forMaintainer: "このマシンで rondo を管理する人向け",
  hostLog:
    "rondo が出力したそれ以外の内容はホストのログにあります: journalctl --user -u rondo.service" +
    "（ホストを rondo web で手動で起動した場合は、そのターミナル）。",
  reviseRefusedNoApprover:
    "何も回答していません。RONDO_APPROVER が未設定なので、このページが誰として回答するか" +
    "決まりません。",
  reviseRefusedPress:
    "何も回答していません。ゲートへの回答は人がこのページのボタンを押して行うもので、" +
    "スクリプトにはできません。",
  reviseRefusedForm:
    "何も回答していません。そのフォームはこのページのものではありません。読み込み直してから" +
    "押してください。",
  reviseRefusedNoWords: "何も回答していません。変更の依頼には内容が要りますが、入力欄が空でした。",
  reviseRefusedGateClosed:
    "何も回答していません。開いているゲートがもう残っていません。戻って結果を" +
    "確認してください。",
  reviseRefusedNotItsScope:
    "何も回答していません。消費しようとしている承認は、この周回が動いた承認ではありません。" +
    "ゲートを読み込み直してから押してください。",
  reviseRefusedStillRunning:
    "何も回答していません。ゲートには別の言葉ですでに回答していて、その処理が続いています。" +
    "終わるのを待ってから、ゲートを読み込み直して状態を確認してください。",
  reviseRefusedNotSetUp:
    "何も回答せず、ゲートにも触れていません。2 周目を用意できませんでした。" +
    "何が起きたかは、このマシンで rondo を管理する人が確かめられます。",
  reviseRefusedNoContinuo: "何も回答していません。作業を動かす部分が起動しません。",
  reviseRefusedOutside: (test) =>
    `何も回答せず、何も消費していません。2 周目はこの周回が動いた範囲の外で、${test} の判定で` +
    `外れました。ゲートはそのままです。選択肢は依頼のスレッドに書かれたメッセージにあります。`,
  reviseRefusedWalkFailed:
    "ゲートへの回答が途中で終わり、2 周目も開始していません。書かれた言葉はすでにゲートに" +
    "届いているかもしれません。もう一度押す前に、戻ってゲートの状態を確認してください。" +
    "何が起きたかは、このマシンで rondo を管理する人が確かめられます。",
  reviseRefusedNotSettled:
    "ゲートには書かれた言葉で回答しましたが、2 周目は開始していません。回答した周回の後始末が" +
    "終わりませんでした。何も消費していません。" +
    "何が起きたかは、このマシンで rondo を管理する人が確かめられます。",
  reviseRefusedAfterGate:
    "ゲートには書かれた言葉で回答しましたが、2 周目は開始していません。承認がもう 1 周回を" +
    "受け付けませんでした。書かれた内容は記録されています。選択肢は依頼のスレッドに書かれた" +
    "メッセージにあります。",
  reviseRefusedNotStarted:
    "2 周目は開始していません。ここで書いた内容は失われていません。" +
    "何が起きたかは、このマシンで rondo を管理する人が確かめられます。",
  reviseForked:
    "ここでは変更を依頼できません。この依頼で承認した予算が別々に 2 回引き上げられていて、" +
    "rondo はどちらを使うかを選びません。何も消費していません。今の作業をそのまま承認する" +
    "ことはできます。",
  reviseRefusedForked:
    "何も回答せず、何も消費していません。この依頼で承認した予算が別々に 2 回引き上げられて" +
    "いて、rondo はどちらを使うかを選びません。",

  raiseNeeded: (why) =>
    `変更を依頼すると作業をもう 1 回やり直しますが、${why}ため、ここでは依頼できません。` +
    "何も依頼しておらず、何も消費していません。予算を引き上げると、ここからまた変更を依頼" +
    "できます。今の作業をそのまま承認することもできます。",
  raiseWhyLaps: (laps) => `承認した ${String(laps)} 回をすべて使っている`,
  raiseWhyCost: (spent, reserve, cost) =>
    `やり直しには費用が分かるまで $${reserve} を確保する必要があり、すでに使ったか確保している ` +
    `$${spent} と合わせると承認した $${cost} を超える`,
  raiseWhyExpiry: (at) => `承認した期限 ${at} (UTC) を過ぎている`,
  raiseLink: "この承認の予算を引き上げる",
  raiseLead:
    "この依頼で承認した予算を引き上げます。変わるのは予算だけで、作業の内容、作業する場所、" +
    "作業者に許すことは承認したときのままです。",
  raiseWasHeading: "承認した内容と、これまでに使った分",
  raiseWas: (laps, cost, until) => `${String(laps)} 回まで、$${cost} まで、${until} (UTC) まで。`,
  raiseUsed: (attempts, usd, unread) =>
    `これまでに ${String(attempts)} 回、$${usd} を使いました` +
    (unread === 0 ? "。" : `（うち ${String(unread)} 回はまだ費用が分かっていません）。`),
  raiseFromHere:
    "新しい予算はこれから先の分です。これまでに使った分は前の承認に数えられたままで、新しい" +
    "予算からは引かれません。費用を $15 に引き上げると、合計 $15 ではなく、ここからさらに " +
    "$15 まで使えます。",
  raiseRetires:
    "押すと、前の承認ではこれ以降何も新しく始まりません。前の承認が対象にしていたすべての" +
    "依頼についてです。この承認がその代わりになります。",
  raiseAskStands:
    "rondo はこの作業を以前止めて、どう進めるかをあなたに尋ねています。予算を引き上げても" +
    "その回答にはなりません。依頼のスレッドで続けるよう伝えるまで、作業は止まったままです。",
  raiseAskLink: "尋ねた内容を読む",
  raiseNotTip:
    "予算はすでに引き上げられていて、ここから引き上げるものはありません。戻って、今" +
    "有効な予算を確認してください。",
  raisePressNote:
    "1 回押すと、新しい予算があなたの名前で記録・承認され、あなたを待っている作業に戻ります。" +
    "承認しただけでは何も消費しません。",
  raiseAction: "予算を引き上げる",
  raisePlain: "新しい予算を記録して承認します",
  raiseRefusedNotTip:
    "何も記録していません。別のタブか別の人が、先に予算を引き上げています。" +
    "戻って、今有効な予算を確認してください。",
  raiseRefusedForked:
    "何も記録していません。この依頼で承認した予算が別々に 2 回引き上げられていて、rondo は" +
    "どちらをさらに引き上げるかを選びません。",
  raiseRefusedNotAtGate:
    "何も記録していません。作業はもうあなたを待っていないので、予算を引き上げる対象が" +
    "ありません。戻って結果を確認してください。",

  publishAction: "プルリクエストを作る",
  published: (branch, runId) =>
    `公開済み: ${branch === null ? "ブランチ" : `ブランチ ${branch}`} を push し、` +
    `${runId === null ? "run" : `run ${runId}`} を閉じました。`,
  publishedPullRequest: "プルリクエスト",
  holds: (paths) => `この作業が押さえているファイル: ${filesJa(paths)}`,
  notLanded:
    "この変更はまだ既定ブランチで見つかっていません。それまでファイルはこの作業が押さえたままで、" +
    "同じファイルを使う別の作業は待つことになります。",
  landed: "変更は既定ブランチに入りました。ファイルは別の作業に使えます。",
  releasedByPerson: "人の判断でファイルが手放されたので、別の作業に使えます。",
  releaseLink: "ファイルを手放す",
  releaseHeading: "この作業が押さえているファイルを手放す",
  releaseLead:
    "この作業は終わっていますが、ファイルを押さえたままです。あなたが手放すか、変更が既定" +
    "ブランチで見つかるまで、同じファイルを使う作業は始められません。",
  releaseWorkHeading: "作業",
  releaseHoldsHeading: "押さえているファイル",
  releaseWhyHeading: "rondo が自分で手放していない理由",
  releaseWhy: [
    "rondo は、この変更が既定ブランチに入ったと確かめられた時点でファイルを手放します。" +
      "作業が変えたファイルがすべて、作業が残したとおりの中身で既定ブランチにあることが条件です。" +
      "確かめるのは、別の作業が同じファイルを求めたときです。",
    "まだ確かめられていません。まだマージされていない、取り込むときに手が入った" +
      "（コンフリクトの解消を含む）、別のリモートに送られた、既定ブランチを読めなかった、" +
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
    "何も手放していません。この端末の rondo はまだあなたが誰かを知らないので、ここでは" +
    "あなたとして何も決められません。",
  releaseRefusedPress:
    "何も手放していません。これは人がこのページのボタンを押して行うもので、スクリプトからは" +
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
  planHeld: (paths) =>
    `まだ始められません。別の作業が ${filesJa(paths)} を変更しています。その作業の変更が既定` +
    "ブランチに入るか、その作業のファイルが手放されれば始められます。",
  planHeldFinished: (paths) =>
    `まだ始められません。終わった作業が ${filesJa(paths)} を押さえたままです。その変更がまだ既定` +
    "ブランチで見つかっていないためです。見つかるか、ファイルが手放されれば始められます。",
  planHeldBy: "押さえている作業",
  planHeldTry:
    "その作業は終わっています。開始するときに、まずその変更が既定ブランチに入っているかを確かめます。",
  startRefusedHeld:
    "何も開始せず、何も消費していません。必要なファイルを別の作業がまだ押さえています。承認は" +
    "そのまま有効です。その作業の変更が既定ブランチに入るか、ファイルが手放されたら、もう一度" +
    "開始してください。",
  publishHeading: "この作業のプルリクエストを作る",
  publishLead:
    "公開すると何が起きるかを、いまの状態から読み取って示します。下のボタンを押すまで、何も起きません。",
  publishNotYetLead: "まだ何も送信していません。いまのままでは公開できません。",
  publishReviewLead:
    "まだ何も送信していません。公開すると何が起きるかを、いまの状態から読み取って示します。" +
    "作業の読み取りはそこまで及んでいないので、押せるのは、それを承知で進めるボタンだけです。",
  publishNotYetHeading: "何が止めているか",
  publishTargetHeading: "何が起きるか",
  publishPushes: (branch, remote) => `ブランチ ${branch} を ${remote} へ push します。`,
  publishOpens: (repo, base) => `${repo} に、${base} 向けのプルリクエストを作ります。`,
  publishCloses: (runId) => `実行 ${runId} を完了として閉じます。`,
  publishPushUrl: (url) => `その push が届くのは ${url} です。`,
  publishWorkspace: (workspace) => `作業は ${workspace} にあります。`,
  publishRequestHeading: "作られるプルリクエスト",
  publishTitleLabel: "タイトル",
  publishBodyLabel: "本文",
  publishBodyViewLegend: "本文の表示",
  publishBodyPreview: "プレビュー",
  publishBodyRaw: "原文",
  publishBodyRawNote: "この本文が、一字一句このまま送信されます。",
  publishNoticedHeading: "rondo が気づいたこと",
  publishModelHeading: "モデルが読んだこと",
  publishModelNote: "判断の材料です。承認ではなく、上の内容がこれで決まったわけでもありません。",
  publishNote:
    "ボタンを押すと、rondo があなたの名前で push し、プルリクエストを作り、run を閉じます。" +
    "マージはしません。画面を開いたあとに何か変わっていれば、実行せず、理由を表示します。",
  publishPlain: "このブランチを push し、プルリクエストを作り、run を閉じます。",
  publishBack: "公開の画面に戻る",
  publishNotOffered:
    "ここからは公開できません。公開には、このホストが受け付ける公開者が要りますが、" +
    "それがないまま起動されています。公開者はページを起動するときに rondo へ渡します。",
  publishNotClosed: (status) =>
    `周回が ${status} の状態です。公開できるのは、人がゲートで承認した作業だけです。`,
  publishNotApproved: (outcome) =>
    `ゲートが ${outcome} で終わっていて、人が回答したわけではないため、` +
    "公開してよいという承認がありません。",
  publishAnswerNotApproval: (answer) =>
    answer === "revise"
      ? "この周回のゲートには、承認ではなく変更の依頼で答えています。公開してよいという承認がありません。"
      : "この周回のゲートには、rondo がどちらの答えかを記録するようになる前に答えています。" +
        "承認か変更依頼かが分からないため、推測で公開はしません。",
  publishNoRun: "run の記録がないため、閉じる run がありません。",
  publishPlanField: (field) =>
    `公開は周回の plan から組み立てますが、その plan に ${field} がありません。このままでは` +
    "公開できません。",
  publishNoRepo:
    "この周回には、プルリクエストを出す先が記録されていません。このホストにも指定が" +
    "ありません。ここからは決められません。出す先は、作業する場所を用意するときに、" +
    "rondo を入れた人が記録します。",
  publishTargetRefused: (reason) => `push の宛先を rondo が保証できません: ${reason}`,
  publishUncommitted: (paths) =>
    `ワークスペースにブランチへ載っていない作業が残っています: ${paths}。push はそれを` +
    "置き去りにしますし、ここのボタンでは変えられません。",
  publishUncommittedElsewhere: (branch) =>
    `ワークスペースは ${branch} をチェックアウトしており、push 対象のブランチではありません。`,
  publishUncommittedRemedies:
    "公開ではなくそのパスについて答えてください。周回をやり直して作業自体をコミットさせ" +
    "読み直させる、ワークスペースで自分でコミットする、作業でないなら捨てる、のいずれかです。",
  publishStatusUnreadable: (reason) =>
    `ワークスペースで git status が読めません (${reason})。push がコミットされていない作業を` +
    "置き去りにするかどうか分かりませんし、ここのボタンでは変えられません。git status が" +
    "答えるようにワークスペースを直してから、もう一度来てください。",
  publishReviewHeading: "読み取りがこの作業を説明していません",
  publishReviewNoReading:
    "この作業を独立に読んだものがありません。「読まれていない」と「読んで何も出なかった」が" +
    "同じに見えてはいけないので、既定では公開はここで止まります。",
  publishReviewNotClear: (verdict, findings) =>
    `作業を読んだ結果は '${verdict}' です${findings === "" ? "" : `: ${findings}`}。` +
    "結論でも拒否権でもなく、まだ誰も答えていない指摘です。",
  publishReviewNoEvidence:
    "読み取りは何も出なかったと言っていますが、何を読んだかの測定が記録されていないため、" +
    "照合する相手がありません。",
  publishReviewUnreadable: (reason) =>
    `いまワークスペースを読めません (${reason})。そのため、読み取りと push される内容を` +
    "照合できません。",
  publishReviewMoved: (readTip, nowTip) =>
    `読み取りは ${readTip} に対して取られ、push されるのは ${nowTip} です。もうこの作業を` +
    "説明していません。",
  publishDespiteFold: "その読み取りなしでプルリクエストを作る",
  publishDespiteAction: "それでもプルリクエストを作る",
  publishDespiteNote:
    "これを決めるのはあなたで、そのための押下は別に 1 回必要です。rondo はあなたが決めたことを" +
    "記録します。読み取りはそのまま残ります。",
  publishDespitePlain: "上の読み取りがこの作業を説明していないまま公開します。",
  scopeBusy: "範囲を記録しています…",
  nextStepHeading: "次にやること",
  nextStepScope:
    "この依頼の範囲（使ってよい費用と触ってよい場所）がまだ決まっていません。範囲を決めると、" +
    "作業を始められます。",
  nextStepDrafted: "rondo が作業の範囲を提案しました。確認して承認すると、作業を始められます。",
  nextStepStart: "範囲は承認済みです。範囲の画面から作業を始めてください。",
  nextStepStartAction: "作業を始める画面へ",
  nextStepPublish:
    "作業は承認済みです。プルリクエストを作ると、ブランチを push してレビューに出します。" +
    "マージはしません。",
  nextStepAddRepository: (named, repo) =>
    `この依頼は ${named} を名指ししていますが、rondo はまだ ${repo} で作業していないので、` +
    `何も下書きしていません。追加すると、${repo} を rondo のほかのリポジトリと同じ場所に` +
    `このコンピュータへコピーし、プルリクエストは ${repo} に出します。`,
  addRepositoryAction: "このリポジトリを追加する",
  addRepositoryBack: "依頼に戻る",
  repositoryUnbuilt: (repo) =>
    `rondo には ${repo} のビルド方法が分からなかったので、作業者はファイルの変更とコミットは` +
    "できますが、ビルドやテストは実行できません。",
  addRepositoryRefusedNoApprover:
    "何も追加していません。この端末の rondo はまだあなたが誰かを知らないので、ここでは" +
    "あなたとして何も決められません。",
  addRepositoryRefusedPress:
    "何も追加していません。これは人がこのページのボタンを押して行うもので、スクリプトからは" +
    "できません。",
  addRepositoryRefusedForm:
    "何も追加していません。そのフォームはこのページのものではありません。読み込み直してから" +
    "押してください。",
  addRepositoryRefusedInstall:
    "何も追加していません。このコンピュータの rondo は、あなたとして GitHub に届きません。" +
    "見られるのは、ここに rondo を入れた人です。直ったら、ボタンはそのまま残っているので" +
    "もう一度押せます。",
  addRepositoryRefusedUnseen:
    "何も追加していません。GitHub にそのリポジトリが無いか、あなたのアカウントからは見えません。" +
    "依頼に書いた名前が違っていれば、返信で正しい名前を伝えてください。",
  addRepositoryRefusedFailed:
    "何も追加していません。今回はリポジトリをコピーできませんでした。もう一度押しても" +
    "大丈夫です。止まったところから続けます。",
  addRepositoryRefusedChanged:
    "何も追加していません。この依頼はもう、rondo が作業していないリポジトリを名指ししていません。" +
    "戻っていまの状態を確かめてください。",
  addRepositoryRefusedNoSetup:
    "何も追加していません。このコンピュータの rondo の設定が、リポジトリを置く場所をまだ" +
    "rondo に渡していません。見られるのは、ここに rondo を入れた人です。",
  approveBusy: "承認を記録しています…",
  startBusy: "作業を始めています…",
  reviseBusy: "変更を依頼しています…",
  publishBusy: "プルリクエストを作っています…",
  lapBusyNote:
    "受け付けました。いま作業が動いていて、確認をお願いする所まで進むとこの画面が切り替わります。" +
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
    "何も公開していません。周回がもう読めなくなっています。一覧に戻ってください。",
  publishRefusedNotClosed: "何も公開していません。周回が、承認されたゲートで終わっていません。",
  publishRefusedNotApproved:
    "何も公開していません。ゲートが人の回答なしに終わっていて、公開してよいという承認が" +
    "ありません。",
  publishRefusedNoRun: "何も公開していません。閉じる run がありません。",
  publishRefusedPlanField:
    "何も公開していません。この周回の plan に、公開の組み立てに要るものが欠けています。",
  publishRefusedNoRepo:
    "何も公開していません。この周回にも、このホストにも、プルリクエストを出す先の記録が" +
    "ありません。",
  publishRefusedTarget: (detail) =>
    `何も公開していません。push の宛先を rondo が保証できません。${detail}`,
  publishRefusedUncommitted: (detail) =>
    `何も公開していません。ワークスペースにブランチへ載っていない作業が残っています (${detail})。`,
  publishRefusedStatusUnreadable: (detail) =>
    "何も公開していません。git status が読めず、ブランチへ載っていない作業が残っているか" +
    `分かりません (${detail})。`,
  publishRefusedNotRead:
    "何も公開していません。この作業の読み取りが、push される内容を説明していません。" +
    "この画面を読み込み直してください。それを踏み越えて公開するには、別の押下が要ります。",
  publishRefusedNothingOverruled:
    "何も公開していません。読み取りはこの作業を説明しているので、踏み越えるものがありません。" +
    "この画面を読み込み直して、公開を押してください。",
  publishRefusedChanged:
    "何も公開していません。画面に出ていた内容と、いま公開したら起きることが食い違っています。" +
    "読み込み直し、もう一度読んでから押してください。",
  publishRefusedStillRunning:
    "二重には公開していません。別の内容を読んだ画面から、すでに公開の処理が進んでいます。" +
    "終わるのを待ってから読み込み直してください。",
  publishRefusedNoContinuo:
    "何も公開していません。run を閉じる部分が起動しないため、rondo は最後まで終えられない" +
    "push を行いません。",
  publishRefusedPushFailed: (detail) =>
    `何も公開していません。ブランチを push できませんでした。${detail}`,
  publishRefusedPullRequestFailed: (detail) =>
    `ブランチは push 済みで、プルリクエストは作れませんでした。${detail} その前に作られていたか` +
    "どうかは rondo が持っている情報ではありません。もう一度押す前にフォージ側を見てください。" +
    "すでにあるプルリクエストを 2 回目の押下で作ることはできません。ある場合、残っているのは " +
    "run を閉じることだけで、そのための 1 行は、このマシンで rondo を管理する人が確かめられます。",
  publishRefusedRunNotClosed:
    "ブランチは push 済みで、プルリクエストも作られています。run が閉じていません。残っているのは" +
    "その 1 つです。" +
    "何が起きたかは、このマシンで rondo を管理する人が確かめられます。",
  nextStepMerge:
    "プルリクエストの最新のコミットでチェックが緑になり、あなたの回答を待っているものも" +
    "ありません。マージすると、プルリクエストを作った先のブランチへ、リポジトリが許す方法で" +
    "取り込みます。このページからは取り消せません。",
  mergeAction: "プルリクエストをマージする",
  nextStepMergeMoved: (count) =>
    `プルリクエストの最新のコミットでチェックが緑になりました。このコミットには、この作業のものではないコミットが ${String(count)} 件含まれています（上に挙げています）。マージすると、それらもいっしょに、プルリクエストを作った先のブランチへ、リポジトリが許す方法で取り込みます。このページからは取り消せません。取り込みたくなければ、押さないでください。`,
  mergeMovedAction: "そのコミットも含めてマージする",
  mergeBusy: "マージしています…",
  mergeBusyNote:
    "受け付けました。rondo がプルリクエストのマージを依頼しています。ふつうは数秒で終わります。" +
    "もう一度押す必要はありません。",
  mergeBack: "依頼に戻る",
  mergeRefusedNoApprover:
    "マージしていません。この端末の rondo はまだあなたが誰かを知らないので、ここでは" +
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
    "マージしていません。プルリクエストの最新のコミットで、チェックが緑だと rondo はまだ" +
    "読めていません。終わるのを待ってから、もう一度押してください。",
  mergeRefusedAsked:
    "マージしていません。この依頼には、あなたの回答を待っている質問や確認が残っています。" +
    "先に答えてください。",
  mergeRefusedMerged: "もう一度はマージしていません。このプルリクエストはマージ済みです。",
  mergeRefusedLanded:
    "マージしていません。この作業はすでに既定のブランチに入っているので、マージするものが" +
    "残っていません。",
  mergeRefusedMoved:
    "マージしていません。rondo がチェックを緑と読んだあとで、プルリクエストに新しいコミットが" +
    "加わっています。ページを読み込み直すと表示されます。",
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
  publishRefusedNotStarted:
    "何も公開していません。ここで見た内容は失われていません。" +
    "何が起きたかは、このマシンで rondo を管理する人が確かめられます。",
} satisfies Chrome);
