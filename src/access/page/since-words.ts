/**
 * The words of *since you last looked*, under the request box in the empty
 * centre (DECISIONS.md D-0083 rule 4, rondo#631): the heading takes when,
 * already said, and each moved request is one sentence.
 *
 * **A slice of the catalogue, as `./words.ts` is**: `Chrome` extends it and each
 * set spreads its half in, so `satisfies Chrome` still fails on a missing word.
 *
 * **Nothing here sends the person to a terminal** (`D-0173` K3): a row under no
 * request is counted on the page and pointed nowhere else.
 */
import type { MovedRequest } from "../page-logic/since.js";

export interface SinceWords {
  readonly sinceHeading: (when: string) => string;
  readonly sinceNothing: (when: string) => string;
  readonly sinceNever: string;
  readonly sinceSaid: (moved: MovedRequest) => string;
  readonly sinceMore: (count: number) => string;
  readonly sinceElsewhere: (count: number) => string;
}

export const SINCE_EN: SinceWords = {
  sinceHeading: (when) => `What moved since you last looked, ${when} ago`,
  sinceNothing: (when) => `Nothing has moved since you last looked, ${when} ago.`,
  sinceNever:
    "Nothing is marked as moved yet. Once you send or answer something here, what moves after it is shown here.",
  sinceSaid: (moved) => {
    const times = (count: number, one: string, many: string) =>
      count === 1 ? one : `${String(count)} ${many}`;
    const parts = [
      ...(moved.asked ? ["you asked for it"] : []),
      ...(moved.rondoWrote > 0
        ? [`rondo wrote ${times(moved.rondoWrote, "a message", "messages")}`]
        : []),
      ...(moved.youWrote > 0
        ? [`you wrote ${times(moved.youWrote, "a message", "messages")}`]
        : []),
      ...(moved.othersWrote > 0
        ? [`someone else wrote ${times(moved.othersWrote, "a message", "messages")}`]
        : []),
      ...(moved.lapsEnded > 0
        ? [
            moved.lapsEnded === moved.lapsMoved
              ? `${times(moved.lapsEnded, "a lap", "laps")} ended`
              : `${times(moved.lapsMoved, "a lap", "laps")} moved and ${String(moved.lapsEnded)} ended`,
          ]
        : moved.lapsMoved > 0
          ? [`${times(moved.lapsMoved, "a lap", "laps")} moved`]
          : []),
    ];
    const sentence = parts.join(", ");
    // rondo's name keeps its lower case at the head of a sentence too.
    return sentence.startsWith("rondo")
      ? `${sentence}.`
      : `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
  },
  sinceMore: (count) =>
    count === 1 ? "One more request moved." : `${String(count)} more requests moved.`,
  sinceElsewhere: (count) =>
    `${count === 1 ? "One more record" : `${String(count)} more records`} changed under no request.`,
};

export const SINCE_JA: SinceWords = {
  sinceHeading: (when) => `前回見てから（${when}前）動いたこと`,
  sinceNothing: (when) => `前回見てから（${when}前）動いたものはありません。`,
  sinceNever:
    "まだ印がありません。ここで何かを送るか答えると、それより後に動いたものをここに示します。",
  sinceSaid: (moved) => {
    const parts = [
      ...(moved.asked ? ["あなたが依頼しました"] : []),
      ...(moved.rondoWrote > 0 ? [`rondo が ${String(moved.rondoWrote)} 件書きました`] : []),
      ...(moved.youWrote > 0 ? [`あなたが ${String(moved.youWrote)} 件書きました`] : []),
      ...(moved.othersWrote > 0 ? [`ほかの人が ${String(moved.othersWrote)} 件書きました`] : []),
      ...(moved.lapsEnded > 0
        ? [
            moved.lapsEnded === moved.lapsMoved
              ? `${String(moved.lapsEnded)} 周が終わりました`
              : `${String(moved.lapsMoved)} 周が動き、うち ${String(moved.lapsEnded)} 周が終わりました`,
          ]
        : moved.lapsMoved > 0
          ? [`${String(moved.lapsMoved)} 周が動きました`]
          : []),
    ];
    return `${parts.join("。")}。`;
  },
  sinceMore: (count) => `ほかに ${String(count)} 件の依頼が動きました。`,
  sinceElsewhere: (count) => `どの依頼にも属さない記録も ${String(count)} 件変わりました。`,
};
