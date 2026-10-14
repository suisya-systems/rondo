/**
 * The words of the thread explainer (rondo#401, D-0177): what an answer's body
 * says around the explanation, and what the page draws to ask one.
 *
 * **A slice of the catalogue, as `./words.ts` is**: `Chrome` extends it and each
 * set spreads its half in, so `satisfies Chrome` still fails on a missing word.
 * The amounts arrive formatted (`money`), so no entry here formats a number.
 *
 * **No identifier of rondo's reaches the screen** (D-0076): a question names
 * what it is about by a quoted line, never by an id; the id travels hidden.
 */

export interface ExplainWords {
  // -- In an answer's body (`src/access/explainer/judgement.ts`) --
  /** The line every answer carries: explaining decides nothing. */
  readonly explainBand: string;
  /** What a model's answer cost, and the approval it was counted against (its first line). */
  readonly explainCost: (cost: string, request: string) => string;
  /** A model ran and its cost was not reported: the cap was counted in its place. */
  readonly explainCostUnread: (cap: string, request: string) => string;
  /** A cost read above the cap, said rather than hidden. */
  readonly explainOverCap: (cap: string) => string;
  /** No model was asked, so nothing was spent. */
  readonly explainFree: string;
  /** Why no model was asked: nothing approved to count its cost against. */
  readonly explainNoApproval: string;
  /** Why no model was asked: the question spans every request, so no one approval counts it. */
  readonly explainAcrossRequests: string;
  /** The lead of an answer across every request (D-0189). */
  readonly explainAcrossLead: string;
  /** A request named in a line, quoted. */
  readonly explainRequestQuoted: (title: string) => string;
  /** The label of the question itself in an answer across every request. */
  /** Nothing waits on the person anywhere. */
  readonly explainNothingWaits: string;
  /**
   * Across every request, what ended since the person last looked, `when`
   * already said, or in the last day with no mark (rondo#656); and the same
   * said when nothing did.
   */
  readonly explainResultsLead: (when: string | null) => string;
  readonly explainResultsNone: (when: string | null) => string;
  /** The rest past the ones named, each in its request's thread. */
  readonly explainResultsMore: (count: number) => string;
  /** One result: a pull request opened, a try that ended, a request's report. */
  readonly explainOpened: (pullRequest: string) => string;
  /** A try that ended, by its status (`closed`, `failed`, `abandoned`). */
  readonly explainLapEnded: (status: string) => string;
  readonly explainReported: string;
  /**
   * A decision on the request (rondo#656 criterion 4): who took it, and its
   * row's outcome, with the 0-based option an answer pressed.
   */
  readonly explainDecided: (
    by: "you" | "other" | "rondo",
    outcome: string,
    option: number | null,
  ) => string;
  /** Why no model was asked: the approval in force has expired. */
  readonly explainExpired: string;
  /** Why no model was asked: less left than one answer may cost. */
  readonly explainTooLittleLeft: (left: string, cap: string) => string;
  /** A model was asked and gave no answer rondo could stand behind. */
  readonly explainCouldNot: string;
  /** The lead of an answer composed from what rondo holds, with no model. */
  readonly explainFallbackLead: string;
  /** A lap waits at its gate: the answer is not the place to answer it. */
  readonly explainWhereToAnswer: string;
  readonly explainWhereToApprove: string;
  // The fallback's claims: a label, and the value beside it.
  readonly explainAskedAbout: string;
  readonly explainRequest: string;
  readonly explainLap: string;
  readonly explainPublished: string;
  readonly explainChecks: string;
  readonly explainWaiting: string;
  readonly explainWaitsGate: string;
  readonly explainWaitsAsk: string;
  readonly explainWaitsDecide: string;
  readonly explainWaitsScope: string;
  /** A repository to add or setup's plan to record before anything is drafted (rondo#643). */
  readonly explainWaitsPress: string;
  readonly explainOverdue: string;
  /** A wait's reason and how long it has held, already said (`age`). */
  readonly explainHeldFor: (reason: string, held: string) => string;
  /**
   * A lap rondo is waiting on inside its plan's ceiling, and how much longer
   * the plan allows (null: no ceiling rondo can read). Never "progressing"
   * (D-0068 rule 2.2): rondo waits for an answer, it does not watch the work.
   */
  readonly explainInFlight: (held: string, left: string | null) => string;
  readonly explainApproval: string;
  readonly explainSpent: (spent: string, approved: string, left: string) => string;

  // -- On the page, to ask and to draw an answer --
  /** The "?" beside a message or a lap: a labelled button, never a bare mark. */
  readonly askButton: string;
  readonly askButtonTitle: string;
  /** What the reply box is filled with when a "?" was pressed. */
  readonly askPrefill: string;
  /** The line the question quotes, so the person sees what it is about without an id. */
  readonly askQuote: (line: string) => string;
  /** The reply box's second submit: send these words as a question. */
  readonly askSubmit: string;
  /** The band over an answer, drawn as its own block. */
  readonly answerBandHeading: string;
  /** What an answer cost, beside the band. */
  readonly answerCost: (cost: string) => string;
  /** A model ran and its cost was not reported: what was counted in its place. */
  readonly answerCostUnread: (cap: string) => string;
  readonly answerFree: string;
}

export const EXPLAIN_EN: ExplainWords = Object.freeze({
  explainBand: "This is an explanation, not an approval or a decision.",
  explainCost: (cost, request) =>
    `This answer cost $${cost}, counted against the approval of "${request}".`,
  explainCostUnread: (cap, request) =>
    `What this answer cost was not reported, so the $${cap} an answer may cost is counted ` +
    `against the approval of "${request}".`,
  explainOverCap: (cap) => `That is over the $${cap} an answer may cost.`,
  explainFree: "This answer spent nothing: no model was asked.",
  explainNoApproval:
    "No model was asked: this request has no approval in force to count the cost against.",
  explainAcrossRequests:
    "No model was asked: a question about every request is answered from rondo's records alone.",
  explainAcrossLead:
    "Here is what waits on you, and what rondo is still waiting on, request by request.",
  explainRequestQuoted: (title) => `"${title}"`,
  explainNothingWaits: "nothing waits on you now",
  explainResultsLead: (when) =>
    when === null
      ? "What happened in the last day:"
      : `What happened since you last looked, ${when} ago:`,
  explainResultsNone: (when) =>
    when === null
      ? "Nothing happened in the last day."
      : `Nothing happened since you last looked, ${when} ago.`,
  explainResultsMore: (count) => `And ${String(count)} more; open a request to see its own.`,
  explainOpened: (pullRequest) => `Pull request ${pullRequest}, opened`,
  explainLapEnded: (status) =>
    status === "failed"
      ? "a try failed"
      : status === "abandoned"
        ? "a try was abandoned"
        : "a try was closed",
  explainReported: "its report is ready to read",
  explainDecided: (by, outcome, option) =>
    `${{ you: "you", other: "someone else", rondo: "rondo" }[by]} ${
      outcome === "carry_on"
        ? option === null
          ? "answered: carry on"
          : `answered with option ${String(option + 1)}`
        : outcome === "stop"
          ? "answered: stop"
          : outcome === "approve"
            ? "approved at the gate"
            : outcome === "revise"
              ? "asked for changes at the gate"
              : outcome === "started"
                ? "let a held start begin"
                : outcome === "refused"
                  ? "refused a held start"
                  : "held a start"
    }`,
  explainExpired: "No model was asked: the approval for this request has expired.",
  explainTooLittleLeft: (left, cap) =>
    `No model was asked: the approval has $${left} left, less than the $${cap} an answer may cost.`,
  explainCouldNot:
    "rondo's explainer gave no answer rondo could check against what it holds, so this is " +
    "composed from the records alone.",
  explainFallbackLead: "Here is what rondo holds about this.",
  explainWhereToAnswer:
    "A lap in this thread waits for your answer at its gate. Answer it there: a reply here " +
    "answers nothing.",
  explainWhereToApprove:
    "A drafted scope for this request waits for your approval. Approve or change it on its " +
    "scope screen: a reply here approves nothing.",
  explainAskedAbout: "What you asked about",
  explainRequest: "The request",
  explainLap: "A try",
  explainPublished: "Pull request",
  explainChecks: "Checks",
  explainWaiting: "Waiting",
  explainWaitsGate: "on your answer at its gate",
  explainWaitsAsk: "on your answer to a question",
  explainWaitsDecide: "on your decision, with no gate to answer",
  explainWaitsScope: "on your approval of the drafted scope",
  explainWaitsPress: "on your next step before rondo can start",
  explainOverdue: "past the time its plan allowed",
  explainHeldFor: (reason, held) => `${reason}, for ${held}`,
  explainInFlight: (held, left) =>
    left === null
      ? `a try has run for ${held}; its plan sets no time limit`
      : `a try has run for ${held}, with up to ${left} more under its plan`,
  explainApproval: "Approval",
  explainSpent: (spent, approved, left) =>
    `$${spent} spent of $${approved} approved, $${left} left`,

  askButton: "? What does this mean",
  askButtonTitle:
    "Ask rondo what this means. The answer explains; it approves and decides nothing.",
  askPrefill: "What does this mean?",
  askQuote: (line) => `About: "${line}"`,
  askSubmit: "Ask rondo",
  answerBandHeading: "Explanation, not an approval or a decision",
  answerCost: (cost) => `This answer cost $${cost}.`,
  answerCostUnread: (cap) => `What this answer cost was not reported; $${cap} was counted.`,
  answerFree: "This answer spent nothing.",
} satisfies ExplainWords);

export const EXPLAIN_JA: ExplainWords = Object.freeze({
  explainBand: "この回答は説明です。承認や決定ではありません。",
  explainCost: (cost, request) =>
    `この回答の費用は $${cost} で、「${request}」で承認した予算から差し引きました。`,
  explainCostUnread: (cap, request) =>
    `この回答の費用は報告されなかったため、1 回答あたりの上限 $${cap} を「${request}」で承認した予算から差し引きました。`,
  explainOverCap: (cap) => `1 回答あたりの上限 $${cap} を超えています。`,
  explainFree: "この回答に費用はかかっていません。",
  explainNoApproval:
    "この依頼の範囲はまだ承認されていないため、rondo の記録にあることだけを回答しています。範囲を承認すると、次の質問から詳しく回答します。",
  explainAcrossRequests: "rondo の記録にあることだけを回答しています。",
  explainAcrossLead:
    "依頼ごとに、あなたの対応を待っているものと、rondo 側で進行中のものをまとめます。",
  explainRequestQuoted: (title) => `「${title}」`,
  explainNothingWaits: "あなたの対応を待っているものはありません",
  explainResultsLead: (when) =>
    when === null ? "この 1 日に起きたこと:" : `${when}前に見てから起きたこと:`,
  explainResultsNone: (when) =>
    when === null
      ? "この 1 日、動きはありませんでした。"
      : `${when}前に見てから、動きはありません。`,
  explainResultsMore: (count) => `ほかに ${String(count)} 件。それぞれの依頼を開くと見られます。`,
  explainOpened: (pullRequest) => `プルリクエスト ${pullRequest}・作成`,
  explainLapEnded: (status) =>
    status === "failed"
      ? "作業が失敗して終わりました"
      : status === "abandoned"
        ? "作業が途中で打ち切られました"
        : "作業が閉じられました",
  explainReported: "報告が読めるようになりました",
  explainDecided: (by, outcome, option) =>
    `${{ you: "あなた", other: "ほかの人", rondo: "rondo" }[by]}が${
      outcome === "carry_on"
        ? option === null
          ? "「続ける」と答えました"
          : `選択肢 ${String(option + 1)} を選びました`
        : outcome === "stop"
          ? "「止める」と答えました"
          : outcome === "approve"
            ? "ゲートで承認しました"
            : outcome === "revise"
              ? "ゲートで修正を求めました"
              : outcome === "started"
                ? "保留していた開始を進めました"
                : outcome === "refused"
                  ? "保留していた開始を断りました"
                  : "開始を保留しました"
    }`,
  explainExpired:
    "この依頼の承認は期限が切れているため、rondo の記録にあることだけを回答しています。承認し直すと、次の質問から詳しく回答します。",
  explainTooLittleLeft: (left, cap) =>
    `承認した予算の残りが $${left} で、1 回答あたりの上限 $${cap} に足りないため、rondo の記録にあることだけを回答しています。予算を引き上げると、次の質問から詳しく回答します。`,
  explainCouldNot: "詳しい回答を用意できなかったため、rondo の記録にあることだけを回答しています。",
  explainFallbackLead: "rondo の記録にあることをまとめます。",
  explainWhereToAnswer:
    "確認待ちの回には、その回の確認の画面で回答してください。ここに返信しても確認の回答にはなりません。",
  explainWhereToApprove:
    "承認待ちの範囲は、範囲の画面で承認するか変更してください。ここに返信しても承認にはなりません。",
  explainAskedAbout: "質問の対象",
  explainRequest: "依頼",
  explainLap: "作業の回",
  explainPublished: "プルリクエスト",
  explainChecks: "チェック",
  explainWaiting: "待っていること",
  explainWaitsGate: "確認へのあなたの回答",
  explainWaitsAsk: "質問へのあなたの回答",
  explainWaitsDecide: "あなたの判断（依頼の画面で決めます）",
  explainWaitsScope: "範囲の下書きへのあなたの承認",
  explainWaitsPress: "依頼の画面でのあなたの次の操作",
  explainOverdue: "計画で見込んだ時間を過ぎています",
  explainHeldFor: (reason, held) => `${reason}（${held}前から）`,
  explainInFlight: (held, left) =>
    left === null
      ? `いまの回は ${held}前から続いています（計画に時間の上限はありません）`
      : `いまの回は ${held}前から続いています（計画の上限まであと ${left}）`,
  explainApproval: "承認",
  explainSpent: (spent, approved, left) =>
    `承認した $${approved} のうち $${spent} を使用、残り $${left}`,

  askButton: "？ これはどういう意味",
  askButtonTitle: "rondo に意味を尋ねます。答えは説明だけで、承認も決定もしません。",
  askPrefill: "これはどういう意味ですか？",
  askQuote: (line) => `「${line}」について`,
  askSubmit: "rondo に尋ねる",
  answerBandHeading: "説明であって、承認や決定ではありません",
  answerCost: (cost) => `この回答の費用は $${cost} です。`,
  answerCostUnread: (cap) =>
    `この回答の費用は報告されなかったため、上限の $${cap} を差し引きました。`,
  answerFree: "この回答に費用はかかっていません。",
} satisfies ExplainWords);
