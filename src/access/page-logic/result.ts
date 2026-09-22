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
  | { readonly kind: "none" }
  /**
   * The pull request conflicts with its base, so the forge runs no check on
   * it (rondo#411): nothing will come until somebody resolves it.
   */
  | { readonly kind: "conflict" };

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
   * Where it was merged, or null where it has not been: by a person's press on
   * the page (rondo#380), with how, or on the forge outside rondo (rondo#413),
   * with who the forge says merged it where it said.
   */
  readonly merged: {
    readonly into: string;
    /** How a press merged it; null for a merge made outside rondo. */
    readonly method: string | null;
    readonly outside: boolean;
    readonly by: string | null;
    readonly atMs: number;
  } | null;
  /** When it was closed on the forge without a merge (rondo#413), or null. */
  readonly closedAtMs: number | null;
  /** The base it conflicts with, where that is why no check runs now (rondo#411). */
  readonly conflictsWith: string | null;
  /**
   * Where the pull request moved to after rondo read it (rondo#412), or null:
   * the head the lap pushed, the head it is at now, and what that carries. The
   * checks above are then the new head's.
   */
  readonly moved: {
    readonly from: string;
    readonly to: string;
    readonly commits: readonly { readonly sha: string; readonly subject: string }[];
    /** How many more it carries than the report listed. */
    readonly more: number;
  } | null;
}

interface Said {
  readonly body: string;
  readonly atMs: number;
}

/**
 * The result of one lap, or null where it has not been published.
 *
 * ponytail: every message is walked once per lap for the lines named by a
 * head (`report-checks-<lap>-<kind>-<head>`, `report-moved-`,
 * `report-conflict-`); an index by lap is the upgrade if a store's thread
 * grows long enough for the list to feel it.
 */
export function resultOf(byId: ReadonlyMap<string, Said>, iterationId: string): LapResult | null {
  const published = byId.get(`report-published-${iterationId}`);
  if (published === undefined) {
    return null;
  }
  const url = /https?:\/\/[^\s]+/.exec(published.body)?.[0] ?? null;
  const answers: { kind: "green" | "red" | "none"; commit: string | null; said: Said }[] = [];
  let movedSaid: Said | undefined;
  let conflictSaid: Said | undefined;
  const newest = (left: Said | undefined, right: Said): Said =>
    left === undefined || right.atMs >= left.atMs ? right : left;
  // **Only this lap's lines**: its id may be the start of another lap's.
  const own = `Lap '${iterationId}' `;
  for (const [id, said] of byId) {
    if (!said.body.startsWith(own)) {
      continue;
    }
    const answer = /^(green|red|none)(?:-[0-9a-f]+)?(?:-t\d+)?$/.exec(
      id.startsWith(`report-checks-${iterationId}-`)
        ? id.slice(`report-checks-${iterationId}-`.length)
        : "",
    )?.[1] as "green" | "red" | "none" | undefined;
    if (answer !== undefined) {
      answers.push({
        kind: answer,
        commit: /on commit '([^']+)'/.exec(said.body)?.[1] ?? null,
        said,
      });
    } else if (id.startsWith(`report-moved-${iterationId}-`)) {
      movedSaid = newest(movedSaid, said);
    } else if (id.startsWith(`report-conflict-${iterationId}-`)) {
      conflictSaid = newest(conflictSaid, said);
    }
  }
  const moved = movedOf(movedSaid);
  // **The checks are about the head the pull request is at**: once it moved,
  // an answer about another head says nothing about this one (rondo#412) --
  // the lap's own head included, once it was pushed back to it. The newest
  // answer wins: a pull request that went red and then green has both lines
  // in the thread (`reportToRequest`), and the state is the last.
  const at = /is at commit '([^']+)'/.exec(movedSaid?.body ?? "")?.[1] ?? null;
  const latest = answers
    .filter((one) => at === null || one.commit === at)
    .toSorted((left, right) => right.said.atMs - left.said.atMs)[0];
  // **A conflict stands on its head until a check answers there** (rondo#411):
  // no answer is written while it stands (`checksHost`), so one on that head
  // newer than the conflict means it was resolved without a push.
  const conflictHead = /on commit '([^']+)'/.exec(conflictSaid?.body ?? "")?.[1] ?? null;
  const conflicting =
    conflictSaid !== undefined &&
    conflictHead !== null &&
    (at === null || conflictHead === at) &&
    !answers.some((one) => one.commit === conflictHead && one.said.atMs > conflictSaid.atMs);
  return {
    url,
    number: url === null ? null : (/\/pull\/(\d+)/.exec(url)?.[1] ?? null),
    atMs: published.atMs,
    checks: conflicting
      ? { kind: "conflict" }
      : latest === undefined
        ? { kind: "running" }
        : checksOf(latest.kind, latest.said.body),
    checksAtMs: conflicting ? (conflictSaid?.atMs ?? null) : (latest?.said.atMs ?? null),
    checksCommit: conflicting ? null : (latest?.commit ?? null),
    merged: mergedOf(byId.get(`report-merged-${iterationId}`)),
    closedAtMs: byId.get(`report-closed-${iterationId}`)?.atMs ?? null,
    conflictsWith: conflicting
      ? (/its base '([^']+)'/.exec(conflictSaid?.body ?? "")?.[1] ?? "")
      : null,
    moved,
  };
}

function mergedOf(said: Said | undefined): LapResult["merged"] {
  if (said === undefined) {
    return null;
  }
  // A merge outside rondo names who, where the forge said (rondo#413); a
  // press's names how (rondo#380).
  const outside = / is merged into '([^']+)'(?: by '([^']+)')?/.exec(said.body);
  if (outside !== null) {
    return {
      into: outside[1] ?? "",
      method: null,
      outside: true,
      by: outside[2] ?? null,
      atMs: said.atMs,
    };
  }
  const read = / went into '([^']+)' by (\w+)/.exec(said.body);
  return {
    into: read?.[1] ?? "",
    method: read?.[2] ?? "",
    outside: false,
    by: null,
    atMs: said.atMs,
  };
}

/** Both heads and the listed commits off a moved report (`movedBody`, `conductor.ts`). */
function movedOf(said: Said | undefined): LapResult["moved"] {
  if (said === undefined) {
    return null;
  }
  const to = /is at commit '([^']+)'/.exec(said.body)?.[1];
  const from = /the head the lap pushed and rondo read is '([^']+)'/.exec(said.body)?.[1];
  // Pushed back to the head the lap pushed: not moved any more (Codex round 1).
  if (to === undefined || from === undefined || to === from) {
    return null;
  }
  return {
    from,
    to,
    commits: [...said.body.matchAll(/^- '([0-9a-f]+)' (.*)$/gm)].map((line) => ({
      sha: line[1] ?? "",
      subject: line[2] ?? "",
    })),
    more: Number(/^- and (\d+) more$/m.exec(said.body)?.[1] ?? 0),
  };
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
 * - `merged`: it is merged, by a press or outside rondo.
 * - `closed`: it was closed on the forge without a merge (rondo#413).
 * - `landed`: the line was released, so its work is on the default branch by
 *   some other way (`D-0073` rule 7).
 */
export type MergeBlock = "notPublished" | "notGreen" | "asked" | "merged" | "closed" | "landed";

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
  if (result.closedAtMs !== null) {
    return "closed";
  }
  if (!holding) {
    return "landed";
  }
  if (result.checks.kind !== "green" || result.checksCommit === null) {
    return "notGreen";
  }
  return asksWaiting ? "asked" : null;
}

function checksOf(kind: "green" | "red" | "none", body: string): ChecksState {
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
