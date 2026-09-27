/**
 * A request run as several lines, as the page says it (DECISIONS.md D-0098
 * rule 8, D-0129): one standing per part, and the counts the list's row and the
 * line under the title say.
 *
 * **In the person's words and by the person's names** (`D-0076`): a part is
 * *part N*, the number the split's plans carry on the scope screen and in rule
 * 1.5's question; no line, claim, order or wait reason is named as itself.
 *
 * **Amber only for *your turn*** (rule 8.1, `D-0082` rule 1): a part waiting on
 * an earlier part's landing is a wait rondo clears itself, so it is counted
 * apart from what waits on the person. The one wait that is the person's is an
 * earlier part that ended without being merged (rule 1.5), where rondo has
 * asked in the thread what becomes of this one.
 */

import { pathsOverlap, repositoryKey, WHOLE_REPOSITORY } from "../../store/lanes.js";
import { approvedForPublication, type IterationRecord, isTerminal } from "../../store/records.js";
import type { PartRead } from "../drafted-start.js";
import type { LapResult } from "./result.js";

/** A pull request as the page links it: its address and its number, either possibly unread. */
export interface PullRequestLink {
  readonly url: string | null;
  readonly number: string | null;
}

/** What an unstarted part waits on: an earlier part's landing (D-0098 rule 1). */
export interface PartWait {
  /** The earlier part's index, from 0. */
  readonly after: number;
  /** Where that part stands: not started, running, ended and not yet read as merged, or ended unmerged. */
  readonly first: "notStarted" | "running" | "awaitingLanding" | "endedUnlanded";
  /**
   * The earlier part's repository, said only where it is not this part's own
   * (rule 8.2: a wait on another repository names it), or null.
   */
  readonly place: string | null;
  /** The earlier part's pull request, where it has one to wait on. */
  readonly pullRequest: PullRequestLink | null;
  /** Rule 1.5's question in the thread, by its message id, while it stands; else null. */
  readonly askId: string | null;
}

/**
 * - `yours`: a lap of the part is at its gate, or an earlier part ended
 *   unmerged and rondo has asked what this one becomes.
 * - `running`: a lap of the part is under way.
 * - `waiting`: not started, and held until an earlier part is merged.
 * - `toStart`: not started, and held by nothing of its split.
 * - `merged`, `finished`, `stopped`: its lap ended, and how.
 */
export type PartStanding =
  | "yours"
  | "running"
  | "waiting"
  | "toStart"
  | "merged"
  | "finished"
  | "stopped";

export interface PartView {
  readonly index: number;
  readonly standing: PartStanding;
  /** Set exactly where the part is not started and waits on an earlier one. */
  readonly wait: PartWait | null;
  /** The part's own published pull request, or null before one. */
  readonly pullRequest: PullRequestLink | null;
  /** The part's laps, oldest first. */
  readonly laps: readonly IterationRecord[];
  /** The paths the part asked to hold; null claims the whole repository. */
  readonly claim: readonly string[] | null;
  /** The part's repository, or null where its template is gone. */
  readonly repository: string | null;
}

/** What {@link partViews} reads besides the parts: the rows the page already holds. */
export interface PartReads {
  /** Every lap of the line whose first lap is `lineageId`, oldest first. */
  readonly lapsOf: (lineageId: string) => readonly IterationRecord[];
  readonly resultOf: (iterationId: string) => LapResult | null;
  /** The person's name for a repository (`placeName` in `list.ts`), or null. */
  readonly placeOf: (repository: string) => string | null;
  /** The open question about part `index` whose id starts so, or null. */
  readonly askOf: (index: number) => string | null;
}

function linkOf(result: LapResult | null): PullRequestLink | null {
  return result === null ? null : { url: result.url, number: result.number };
}

/** The newest lap of the part whose gate was recorded as approved, as the thread's result reads. */
function publishedOf(laps: readonly IterationRecord[], reads: PartReads): LapResult | null {
  const approved = laps.findLast(approvedForPublication);
  return approved === undefined ? null : reads.resultOf(approved.id);
}

/** Each part's standing, in the split's order. */
export function partViews(parts: readonly PartRead[], reads: PartReads): readonly PartView[] {
  return parts.map((part): PartView => {
    const laps = part.lineageId === null ? [] : reads.lapsOf(part.lineageId);
    const result = publishedOf(laps, reads);
    const pullRequest = linkOf(result);
    if (part.lineageId !== null) {
      const standing: PartStanding = laps.some((lap) => lap.status === "awaiting_human")
        ? "yours"
        : laps.some((lap) => !isTerminal(lap.status))
          ? "running"
          : result?.merged != null
            ? "merged"
            : laps.at(-1)?.status === "closed"
              ? "finished"
              : "stopped";
      return {
        index: part.index,
        standing,
        wait: null,
        pullRequest,
        laps,
        claim: part.claim,
        repository: part.repository,
      };
    }
    if (part.order.kind !== "waiting") {
      return {
        index: part.index,
        standing: "toStart",
        wait: null,
        pullRequest,
        laps,
        claim: part.claim,
        repository: part.repository,
      };
    }
    const after = part.order.after;
    const earlier = parts.find((other) => other.index === after);
    const earlierLaps = earlier?.lineageId == null ? [] : reads.lapsOf(earlier.lineageId);
    const first = part.order.first?.state ?? "notStarted";
    const askId = first === "endedUnlanded" ? reads.askOf(part.index) : null;
    const place =
      earlier?.repository == null || earlier.repository === part.repository
        ? null
        : reads.placeOf(earlier.repository);
    return {
      index: part.index,
      // Rule 1.5 put a question in the thread: this part is the person's now.
      standing: first === "endedUnlanded" ? "yours" : "waiting",
      wait: {
        after,
        first,
        place,
        pullRequest: linkOf(publishedOf(earlierLaps, reads)),
        askId,
      },
      pullRequest,
      laps,
      claim: part.claim,
      repository: part.repository,
    };
  });
}

/** The parts counted as the row's sentence says them (rule 8.1). */
export interface PartCounts {
  readonly total: number;
  readonly running: number;
  readonly yours: number;
  readonly waiting: number;
  /**
   * The one other repository every waiting part waits on, or null where they
   * wait inside their own or on more than one.
   */
  readonly waitingOn: string | null;
  readonly toStart: number;
  readonly finished: number;
  readonly stopped: number;
}

/** The counts over `views`, merged counted as finished. */
export function partCounts(views: readonly PartView[]): PartCounts {
  const count = (...standings: PartStanding[]) =>
    views.filter((view) => standings.includes(view.standing)).length;
  const places = [
    ...new Set(views.filter((view) => view.standing === "waiting").map((view) => view.wait?.place)),
  ];
  return {
    total: views.length,
    running: count("running"),
    yours: count("yours"),
    waiting: count("waiting"),
    waitingOn: places.length === 1 ? (places[0] ?? null) : null,
    toStart: count("toStart"),
    finished: count("merged", "finished"),
    stopped: count("stopped"),
  };
}

/** Whether `iterationId` is a lap of `view`'s part. */
export function holdsLap(view: PartView, iterationId: string): boolean {
  return view.laps.some((lap) => lap.id === iterationId);
}

/**
 * The merged part whose files the lap at `iterationId` reached outside its own
 * (D-0098 rule 2.1, the case rule 8.5 says): the next attempt starts by merging
 * what it landed. `reached` is the gate's comparison of the lap's changes with
 * its claim -- the paths other work holds and the ones nobody holds. Read from
 * the other part's claim, so it says what the revise press will decide with
 * `git` (`revisionTakeIn`); null where no merged part claimed those paths.
 */
export function takeInFrom(
  views: readonly PartView[],
  iterationId: string,
  /** The lap's own repository: a take-in fetches and compares only that one. */
  repository: string | null,
  reached: readonly string[],
): PartView | null {
  return (
    views.find(
      (view) =>
        view.standing === "merged" &&
        !holdsLap(view, iterationId) &&
        repository !== null &&
        view.repository !== null &&
        repositoryKey(view.repository) === repositoryKey(repository) &&
        reached.some((path) =>
          (view.claim ?? [WHOLE_REPOSITORY]).some((held) => pathsOverlap(held, path)),
        ),
    ) ?? null
  );
}
