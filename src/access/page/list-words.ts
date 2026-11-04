/**
 * The words the left face's rows say (DECISIONS.md D-0083 rule 2).
 *
 * **A slice of the catalogue, as `./since-words.ts` is**: `Chrome` extends it
 * and each set spreads its half in, so `satisfies Chrome` still fails on a
 * missing word. It is its own slice rather than another pair of entries in
 * `./words.ts` because that file is at its line budget
 * (`scripts/file-size.mjs`), and a slice is what this repository does with the
 * words of one face when it is.
 *
 * **Three words and no more** (rondo#746). A row says where its request stands
 * in one of them: it is the person's turn, it is in progress, or it is done.
 * *Your turn* is not here -- it is `yourTurn` in `./words.ts`, the word the
 * heading over those rows already says, and one claim said twice in a
 * catalogue is two strings that can come to disagree.
 *
 * **Done covers everything nothing further happens to**: a request finished, a
 * request given up on, and a thread that asked rondo a question rather than
 * for work. Three words cannot tell those apart, and what became of a request
 * is on its thread, which is where the account of it belongs.
 *
 * **The count is composed in each language and not translated** (`D-0079`):
 * the English chooses between a singular and a plural the Japanese does not
 * have, and the Japanese counts with its own counter.
 */

export interface ListWords {
  /** A row whose request is under way, rondo's to carry on with. */
  readonly listRunning: string;
  /** A row whose request nothing further happens to. */
  readonly listDone: string;
  /**
   * The press that gives back the done requests older than the three the list
   * always shows, naming how many are behind it (rondo#746).
   */
  readonly listMoreDone: (count: number) => string;
}

export const LIST_EN: ListWords = {
  listRunning: "In progress",
  listDone: "Done",
  listMoreDone: (count) =>
    count === 1 ? "One more done request" : `${String(count)} more done requests`,
};

export const LIST_JA: ListWords = {
  listRunning: "進行中",
  listDone: "完了",
  listMoreDone: (count) => `ほかに完了した依頼 ${String(count)} 件`,
};
