/**
 * The words of a request's report (DECISIONS.md D-0064 P5, rondo#630): what
 * came of each part of a split request, once every part has ended.
 *
 * **A slice of the catalogue, as `./words.ts` is**: `Chrome` extends it and each
 * set spreads its half in, so `satisfies Chrome` still fails on a missing word.
 * The amounts arrive formatted (`money`), and a part is named by `partName`.
 *
 * **Sentences a person reads as they are** (`D-0173` K3): no identifier of
 * rondo's, and nothing that sends anyone to a terminal. A pull request is
 * named by its number, as a person names one.
 */

/** What came of one part, as the report says it. */
export interface PartOutcome {
  /** The part as `partName` names it. */
  readonly part: string;
  readonly standing: "merged" | "stopped";
  /** The part's pull request as `pullRequest` names it, or null where it has none. */
  readonly pullRequest: string | null;
  readonly tries: number;
  /** What the tries whose cost was read spent, formatted; null where no cost was read. */
  readonly spent: string | null;
  /** The tries whose cost was never reported. */
  readonly unread: number;
}

export interface ReportWords {
  /** The first line: every part has ended, and how many of each. */
  readonly reportLead: (merged: number, stopped: number) => string;
  readonly reportPart: (outcome: PartOutcome) => string;
  /** The whole report's first line where the split had one part (rondo#651): no part to name. */
  readonly reportOne: (outcome: PartOutcome) => string;
  /** The gates rondo answered itself under the person's approval (D-0125): decided without asking. */
  readonly reportByRondo: (gates: number) => string;
  /** The times rondo stopped at the edge of the approved scope and asked (`D-0064` rule 3.3). */
  readonly reportScopeExits: (count: number) => string;
  /** The parts whose work was not done. */
  readonly reportUndone: (parts: readonly string[]) => string;
  readonly reportAsksNothing: string;
}

const tries = (count: number) => (count === 1 ? "1 try" : `${String(count)} tries`);

/** What came of a part, after its name. */
const outcomeEn = (o: PartOutcome) =>
  `${
    o.standing === "merged"
      ? `merged (${o.pullRequest ?? "its pull request"})`
      : "stopped before it was finished"
  }. ${
    o.tries === 0
      ? "It never started"
      : o.spent === null
        ? `${tries(o.tries)}; ${o.tries === 1 ? "its" : "their"} cost was not reported`
        : `${tries(o.tries)}, $${o.spent} spent${
            o.unread === 0
              ? ""
              : `; the cost of ${o.unread === 1 ? "1 try was" : `${String(o.unread)} tries were`} not reported`
          }`
  }.`;

export const REPORT_EN: ReportWords = {
  reportLead: (merged, stopped) =>
    `Every part of this request has ended: ${[
      ...(merged > 0 ? [`${String(merged)} merged`] : []),
      ...(stopped > 0 ? [`${String(stopped)} stopped`] : []),
    ].join(", ")}.`,
  reportPart: (o) => `${o.part}: ${outcomeEn(o)}`,
  reportOne: (o) => `This request has ended: ${outcomeEn(o)}`,
  reportByRondo: (gates) =>
    `Under your approval, rondo answered ${gates === 1 ? "1 gate" : `${String(gates)} gates`} itself, without asking you.`,
  reportUndone: (parts) => `Not finished: ${parts.join(", ")}.`,
  reportScopeExits: (count) =>
    `rondo reached the edge of your approval and stopped to ask you ${count === 1 ? "once" : `${String(count)} times`}.`,
  reportAsksNothing: "This report asks nothing of you.",
};

const outcomeJa = (o: PartOutcome) =>
  `${
    o.standing === "merged"
      ? `マージ済み（${o.pullRequest ?? "プルリクエスト"}）`
      : "途中で止まりました"
  }。${
    o.tries === 0
      ? "一度も始まりませんでした"
      : o.spent === null
        ? `${String(o.tries)} 回試しましたが、費用は記録されていません`
        : `${String(o.tries)} 回試して $${o.spent} 使いました${
            o.unread === 0 ? "" : `。うち ${String(o.unread)} 回は費用が記録されていません`
          }`
  }。`;

export const REPORT_JA: ReportWords = {
  reportLead: (merged, stopped) =>
    `この依頼の作業はすべて終わりました（${[
      ...(merged > 0 ? [`マージ済み ${String(merged)} 件`] : []),
      ...(stopped > 0 ? [`途中で止まったもの ${String(stopped)} 件`] : []),
    ].join("、")}）。`,
  reportPart: (o) => `${o.part}: ${outcomeJa(o)}`,
  reportOne: (o) => `この依頼は${outcomeJa(o)}`,
  reportByRondo: (gates) =>
    `承認した範囲の内側だったため、確認 ${String(gates)} 件には rondo が自分で答え、あなたには尋ねませんでした。`,
  reportUndone: (parts) => `終わらなかったのは${parts.join("、")} です。`,
  reportScopeExits: (count) =>
    `承認した範囲の限度に達して rondo が止まり、あなたに尋ねたことが ${String(count)} 度ありました。`,
  reportAsksNothing: "この報告について、あなたがすることはありません。",
};
