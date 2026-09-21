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
  /** At least one failed; the names, as the report gave them. */
  | { readonly kind: "red"; readonly failed: readonly string[] }
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
  };
}

function checksOf(kind: (typeof ANSWERS)[number], body: string): ChecksState {
  if (kind === "none") {
    return { kind: "none" };
  }
  if (kind === "red") {
    const listed = / reports (.*) as failed\./.exec(body)?.[1] ?? "";
    return {
      kind: "red",
      failed: [...listed.matchAll(/'([^']*)'/g)].map((match) => match[1] ?? ""),
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
