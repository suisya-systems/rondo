/**
 * What became of a lap after its gate: published or not, and what its checks
 * came to (rondo#376).
 *
 * **Read off the reports rondo already wrote, and stored nowhere.** A publish
 * and a checks answer are each one message `reportToRequest` writes into the
 * request's thread (`src/access/conductor.ts`), and those messages are the
 * whole of the fact (`page/vocabulary.tsx`'s `publishedReport`). They stay in
 * English (`D-0055` rule 4); this reads them back so the page can *draw* the
 * result as a state in the person's language beside them.
 *
 * **The figures are read off the sentence**, as the URL already is: the id says
 * which answer it is, and the body carries the counts. The shape of those
 * sentences is pinned by `test/access/page/result.test.ts` against the writer.
 * A body this cannot read still yields the answer its id names, with the
 * figures unknown rather than guessed.
 */

/** What the forge last said about a published lap's checks. */
export type ChecksState =
  /** Published, and no answer yet: the checks are still going, or not read yet. */
  | { readonly kind: "running" }
  /**
   * Nothing failed. `passed` and `skipped` are null for an answer written
   * before the report counted skipped checks apart (rondo#376), and then only
   * `counted` is known.
   */
  | {
      readonly kind: "green";
      readonly counted: number | null;
      readonly passed: number | null;
      readonly skipped: number | null;
    }
  /**
   * At least one did not pass; the names, as the report gave them, under what
   * each came to (`continuo D-1113`). A report written before that said every
   * one as failed, so for it the other two lists are empty.
   */
  | {
      readonly kind: "red";
      readonly failed: readonly string[];
      readonly cancelled: readonly string[];
      readonly timedOut: readonly string[];
    }
  /** The forge reported no check of any kind, so far. */
  | { readonly kind: "none" };

export interface LapResult {
  /** The pull request's address, or null where the report printed none. */
  readonly url: string | null;
  /** Its number, as a person names it (`#372`), or null where the address has none. */
  readonly number: string | null;
  /** When it was published. */
  readonly atMs: number;
  readonly checks: ChecksState;
  /** When the checks answer was written; null while they are running. */
  readonly checksAtMs: number | null;
  /**
   * The commit the latest checks answer is about -- the head `publish` pushed
   * -- or null where there is no answer or its sentence names none.
   */
  readonly checksCommit: string | null;
  /**
   * Where a person's merge press put it (rondo#380), or null where rondo has
   * merged nothing. A merge made on the forge itself is not seen here.
   */
  readonly merged: {
    readonly into: string;
    readonly method: string;
    readonly atMs: number;
  } | null;
}

interface Said {
  readonly body: string;
  readonly atMs: number;
}

const ANSWERS = ["green", "red", "none"] as const;

/** The result of one lap, or null where it has not been published. */
export function resultOf(byId: ReadonlyMap<string, Said>, iterationId: string): LapResult | null {
  const published = byId.get(`report-published-${iterationId}`);
  if (published === undefined) {
    return null;
  }
  const url = /https?:\/\/[^\s]+/.exec(published.body)?.[0] ?? null;
  // The newest answer wins: a pull request that went red and then green has
  // both lines in the thread (`reportToRequest`), and the state is the last.
  const latest = ANSWERS.flatMap((kind) => {
    const said = byId.get(`report-checks-${iterationId}-${kind}`);
    return said === undefined ? [] : [{ kind, said }];
  }).toSorted((left, right) => right.said.atMs - left.said.atMs)[0];
  return {
    url,
    number: url === null ? null : (/\/pull\/(\d+)/.exec(url)?.[1] ?? null),
    atMs: published.atMs,
    checks: latest === undefined ? { kind: "running" } : checksOf(latest.kind, latest.said.body),
    checksAtMs: latest?.said.atMs ?? null,
    checksCommit:
      latest === undefined ? null : (/on commit '([^']+)'/.exec(latest.said.body)?.[1] ?? null),
    merged: mergedOf(byId.get(`report-merged-${iterationId}`)),
  };
}

function mergedOf(said: Said | undefined): LapResult["merged"] {
  if (said === undefined) {
    return null;
  }
  const read = / went into '([^']+)' by (\w+)/.exec(said.body);
  return { into: read?.[1] ?? "", method: read?.[2] ?? "", atMs: said.atMs };
}

/**
 * Why a merge press is not offered, or null where it is (rondo#380, `D-0091`
 * rule 1).
 *
 * **One test for the page and for the press**: the button is drawn where this
 * is null, and the press reads the rows again and asks it again, so a button
 * left on a screen that has since moved merges nothing.
 *
 * - `notPublished`: there is no pull request to merge.
 * - `notGreen`: rondo's own latest reading is not green, or names no commit.
 * - `asked`: a question in the request's thread still waits on the person --
 *   `D-0064`'s "no P2 to P4 item open".
 * - `merged`: this press already merged it.
 * - `landed`: the line was released, so its work is on the default branch by
 *   some other way (`D-0073` rule 7).
 */
export type MergeBlock = "notPublished" | "notGreen" | "asked" | "merged" | "landed";

export function mergeBlock(
  result: LapResult | null,
  asksWaiting: boolean,
  holding: boolean,
): MergeBlock | null {
  if (result === null || result.number === null) {
    return "notPublished";
  }
  if (result.merged !== null) {
    return "merged";
  }
  if (!holding) {
    return "landed";
  }
  if (result.checks.kind !== "green" || result.checksCommit === null) {
    return "notGreen";
  }
  return asksWaiting ? "asked" : null;
}

function checksOf(kind: (typeof ANSWERS)[number], body: string): ChecksState {
  if (kind === "none") {
    return { kind: "none" };
  }
  if (kind === "red") {
    // One clause per outcome, `'a', 'b' as failed; 'c' as cancelled`, in the
    // order `checksBody` writes them (`src/access/conductor.ts`).
    const listed = / the forge reports (.*)\. rondo read this/.exec(body)?.[1] ?? "";
    const as = (outcome: string): string[] =>
      listed
        .split("; ")
        .filter((clause) => clause.endsWith(` as ${outcome}`))
        .flatMap((clause) => [...clause.matchAll(/'([^']*)'/g)].map((match) => match[1] ?? ""));
    return {
      kind: "red",
      failed: as("failed"),
      cancelled: as("cancelled"),
      timedOut: as("timed out"),
    };
  }
  const counted = /reported (\d+) check\(s\)/.exec(body)?.[1];
  // An answer written before rondo#376 said "every one of them passed" over
  // skipped checks too, so it carries no split and none is invented for it.
  const split = /(\d+) passed and (\d+) (?:was|were) skipped/.exec(body);
  return {
    kind: "green",
    counted: counted === undefined ? null : Number(counted),
    passed: split === null ? null : Number(split[1]),
    skipped: split === null ? null : Number(split[2]),
  };
}
