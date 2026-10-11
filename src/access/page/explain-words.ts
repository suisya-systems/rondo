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
  explainBand: "これは説明です。承認や決定ではありません。",
  explainCost: (cost, request) =>
    `この回答の費用は $${cost} で、「${request}」の承認に数えました。`,
  explainCostUnread: (cap, request) =>
    `この回答の費用は報告されなかったため、1 回の上限 $${cap} を「${request}」の承認に数えました。`,
  explainOverCap: (cap) => `1 回の上限 $${cap} を超えています。`,
  explainFree: "この回答に費用はかかっていません。モデルには尋ねていません。",
  explainNoApproval: "モデルには尋ねていません。この依頼には費用を数える承認がまだありません。",
  explainAcrossRequests:
    "モデルには尋ねていません。すべての依頼にまたがる質問には、rondo の記録だけから答えます。",
  explainAcrossLead:
    "あなたを待っているものと、rondo がまだ待っているものを、依頼ごとにまとめます。",
  explainRequestQuoted: (title) => `「${title}」`,
  explainNothingWaits: "いまあなたを待っているものはありません",
  explainExpired: "モデルには尋ねていません。この依頼の承認は期限が切れています。",
  explainTooLittleLeft: (left, cap) =>
    `モデルには尋ねていません。承認の残りが $${left} で、1 回の上限 $${cap} に足りません。`,
  explainCouldNot:
    "説明役の答えを rondo の記録と照らし合わせて確かめられなかったため、記録だけから組み立てました。",
  explainFallbackLead: "rondo の記録にあることをまとめます。",
  explainWhereToAnswer:
    "このスレッドの試行がゲートであなたの回答を待っています。回答はゲートで行ってください。ここへの返信は回答になりません。",
  explainWhereToApprove:
    "この依頼の下書きスコープがあなたの承認を待っています。承認や変更はスコープ画面で行ってください。ここへの返信は承認になりません。",
  explainAskedAbout: "質問の対象",
  explainRequest: "依頼",
  explainLap: "試行",
  explainPublished: "プルリクエスト",
  explainChecks: "チェック",
  explainWaiting: "待っているもの",
  explainWaitsGate: "ゲートでのあなたの回答",
  explainWaitsAsk: "質問へのあなたの回答",
  explainWaitsDecide: "答えるゲートのない、あなたの判断",
  explainWaitsScope: "下書きスコープへのあなたの承認",
  explainWaitsPress: "rondo が始めるのに要る、あなたの次の一手",
  explainOverdue: "計画の想定時間を過ぎています",
  explainHeldFor: (reason, held) => `${reason}（${held}前から）`,
  explainInFlight: (held, left) =>
    left === null
      ? `試行が ${held}前から動いています（計画に時間の上限はありません）`
      : `試行が ${held}前から動いています（計画の上限まであと最大 ${left}）`,
  explainApproval: "承認",
  explainSpent: (spent, approved, left) =>
    `承認 $${approved} のうち $${spent} を使用、残り $${left}`,

  askButton: "？ これはどういう意味",
  askButtonTitle: "rondo に意味を尋ねます。答えは説明だけで、承認も決定もしません。",
  askPrefill: "これはどういう意味ですか？",
  askQuote: (line) => `対象:「${line}」`,
  askSubmit: "rondo に尋ねる",
  answerBandHeading: "説明であって、承認や決定ではありません",
  answerCost: (cost) => `この回答の費用は $${cost} です。`,
  answerCostUnread: (cap) => `この回答の費用は報告されなかったため、$${cap} を数えました。`,
  answerFree: "この回答に費用はかかっていません。",
} satisfies ExplainWords);
