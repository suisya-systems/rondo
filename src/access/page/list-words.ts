/**
 * The words the left face's rows say about themselves (rondo#745).
 *
 * **A slice of the catalogue, as `./words.ts` is**: `Chrome` extends it and
 * each set spreads its half in, so `satisfies Chrome` still fails on a missing
 * word.
 *
 * **Three words and a press, because a list is read down and not across.** A
 * row is a name, a state and an age (`page/list.tsx`), and the state is one of
 * these three: the person's turn, work going on, work over. The sentences that
 * say *which* kind of wait it is, or what a publish came to, are still in
 * `./words.ts` -- the row keeps them for its hover, and the thread says them
 * in full.
 *
 * **Composed in the language and never translated into it** (D-0079). The
 * Japanese is not a rendering of the English: the press says what it is
 * holding back in the shape a person reading Japanese counts things in.
 */

export interface ListWords {
  /**
   * What a row says about its state, and the whole of what it says: the
   * person's turn, work going on, work over.
   */
  readonly rowStateYourTurn: string;
  readonly rowStateRunning: string;
  readonly rowStateDone: string;
  /**
   * The press the finished requests past the newest few are shut behind,
   * counting them: `count` is how many are hidden, never how many there are.
   */
  readonly listMoreDone: (count: number) => string;
}

export const LIST_EN: ListWords = {
  rowStateYourTurn: "Your turn",
  rowStateRunning: "In progress",
  rowStateDone: "Done",
  listMoreDone: (count) =>
    count === 1 ? "1 more finished request" : `${String(count)} more finished requests`,
};

export const LIST_JA: ListWords = {
  rowStateYourTurn: "あなたの番",
  rowStateRunning: "進行中",
  rowStateDone: "完了",
  listMoreDone: (count) => `ほかに終わった依頼 ${String(count)} 件`,
};
