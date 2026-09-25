/**
 * What the forge says about a pull request rondo opened, read in the resident
 * host -- today the `rondo web` process (rondo#310).
 *
 * **The window this reads is closed at both ends by rows rondo already holds.**
 * It opens with the publish report in the request's thread, which is the whole
 * of "this was published" (`./page/vocabulary.tsx`), and it closes with the
 * first answer this writes. So nothing is asked of the forge about a lap that
 * was never published, and nothing is asked twice about one that has an answer.
 * The lane ledger narrows it further: a line the ledger has released is a line
 * whose work has landed, and a landed change's checks are somebody else's
 * question.
 *
 * **rondo fetches, continuo judges** (`continuo D-1113`). The three documents
 * are fetched through the operator's own `gh` (`fetchPullRequestChecks`,
 * `./forge.ts`, `D-0010`), handed to `continuo ci observe`, which records them
 * as evidence in the lap's own control-plane database, and the verdict is
 * `continuo ci show`'s. What rondo keeps is the mapping of that verdict onto
 * the one line it writes in the request's thread ({@link readingOf}).
 *
 * **A read and no more.** Merging is on `D-0064` rule 3.4's irreversible list
 * and a comment on a pull request is not an act a scope can include
 * (`SCOPE_OUTWARD_ACTS`), so neither is reachable from here and neither is
 * meant to be.
 *
 * **Nobody is woken by it.** Whether a person who is not looking at the page
 * should be told is rondo#311's question, and its mechanism is where that
 * answer belongs; a second delivery path built here would have to be taken back
 * out.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  type CiObserveRequest,
  type CiShowRequest,
  ciObserve,
  ciShow,
  startContinuo,
  type VerifiedContinuo,
} from "../continuo/invoker.js";
import type { CiObserved, CiShown, ContinuoResult } from "../continuo/protocol.js";
import { isDeterministicReadingDrafter, latestReading, planField } from "../store/records.js";
import type { AdvisoryRecord, IterationStore } from "../store/sqlite.js";
import { checksAnswerId, type LapEvent, reportToRequest } from "./conductor.js";
import {
  type CommitsBetween,
  type CommitsBetweenRequest,
  type deleteLapBase,
  fetchPullRequestChecks,
  type PullRequestChecksFetch,
  type PullRequestChecksRequest,
} from "./forge.js";
import { hostFailure } from "./host-failure.js";
import { closeOutMerged } from "./merge.js";
import { type LapResult, resultOf } from "./page-logic/result.js";

/**
 * What continuo's verdict on one pull request comes to, as rondo writes it
 * (rondo#310, `continuo D-1113`).
 *
 * **`undetermined` is its own answer and never a `red`**: a forge that would
 * not answer, or a document continuo refused, says nothing about a pull
 * request, and a screen that read it as a failure would send a person to look
 * at a check that never ran. It writes nothing, so the last answer written
 * stands.
 *
 * **`none` is its own answer too, and it is not a final one.** continuo's
 * `no_run` does not tell a repository with no checks apart from one whose
 * first check has not started, so a `none` is said once and the lap stays due.
 */
export type ChecksReading =
  /**
   * Nothing failed and nothing is still going. `counted` is how many checks
   * reported, and `skipped` how many of those the forge called `skipped` or
   * `neutral`: inside continuo's `passed`, and never said to have passed
   * (rondo#376).
   */
  | { readonly kind: "green"; readonly counted: number; readonly skipped: number }
  /**
   * At least one did not pass. A cancelled or timed-out check keeps its own
   * name (`continuo D-1113`) rather than being called a failure.
   */
  | {
      readonly kind: "red";
      readonly failed: readonly string[];
      readonly cancelled: readonly string[];
      readonly timedOut: readonly string[];
    }
  /** Nothing failed and something has not finished; `pending` names those. */
  | { readonly kind: "pending"; readonly pending: readonly string[] }
  /** Nothing was observed for the pull request's head. */
  | { readonly kind: "none" }
  | { readonly kind: "undetermined"; readonly reason: string };

/** One pull request's checks to read, and where continuo keeps their evidence. */
export interface ChecksRequest extends PullRequestChecksRequest {
  /** The lap's own control-plane database, the one its run was admitted into. */
  readonly db: string;
}

/** A reading, and the head commit continuo judged it on (null when there was none). */
export interface ChecksRead {
  readonly reading: ChecksReading;
  readonly head: string | null;
  /**
   * What the pull request's own document said, where continuo recorded it:
   * null where nothing was fetched, or continuo refused the fetch.
   */
  readonly pullRequest: PullRequestFacts | null;
}

/**
 * The facts of the pull request document the checks were fetched with
 * (rondo#411, rondo#413), read and not judged.
 *
 * **Read here and not asked of continuo** because `ci show` answers none of
 * them: `ci observe` records the state from this same document, and nothing
 * rondo drives gives it back, and nothing in continuo reads `mergeable` or
 * who merged (`D-0102`).
 */
export interface PullRequestFacts {
  readonly state: "open" | "merged" | "closed";
  /**
   * The forge said it cannot merge the pull request as it stands: a conflict
   * with its base. False where it said it can, and where it has not worked
   * that out yet (`mergeable: null`), which is not a conflict.
   */
  readonly conflicting: boolean;
  /** The branch it merges into. */
  readonly base: string;
  /**
   * The base commit the forge compared it against, or null: kept with a
   * conflict so that a later try can take in exactly that base (rondo#417).
   */
  readonly baseCommit: string | null;
  /** Who merged it, as the forge names them, or null. */
  readonly mergedBy: string | null;
  readonly mergeCommit: string | null;
}

/** What the host reaches, as values a test can replace. */
export interface ChecksHostPorts {
  readonly store: Pick<IterationStore, "read" | "readingsFor" | "laneLedger" | "laneLine">;
  readonly record: Pick<AdvisoryRecord, "threadMessages" | "recordThreadMessage">;
  /** The close-out's git (D-0119); tests replace it, the host reaches the real one. */
  readonly deleteLapBase?: typeof deleteLapBase;
  /** Fetch, observe and show; {@link continuoChecksReader} in the host. */
  readonly readChecks: (request: ChecksRequest) => Promise<ChecksRead>;
  /** What a moved head carries past the lap's own (`readCommitsBetween`). */
  readonly readCommits: (request: CommitsBetweenRequest) => Promise<CommitsBetween>;
  /**
   * The laps a merge press is working on now: left alone, so a merge the
   * press made is not read as one made outside rondo before the press has
   * written it (rondo#413).
   */
  readonly pressing?: ReadonlySet<string>;
  /** The forge host, as `publish` reads it (`GH_HOST`), or null for `gh`'s own. */
  readonly host: string | null;
  readonly now: () => number;
  /** One line for the host's terminal. */
  readonly log: (line: string) => void;
}

export interface ChecksHost {
  /** Read what is due now. Returns at once; a pass already in flight is joined. */
  kick(): void;
  /** Resolves once no pass is in flight: for tests and for a clean shutdown. */
  idle(): Promise<void>;
}

/** The prefix `reportToRequest` names a publish report with. */
const PUBLISHED_PREFIX = "report-published-";

/** Who is recorded as having fetched the documents continuo observes. */
const OBSERVER = "rondo";

export function checksHost(ports: ChecksHostPorts): ChecksHost {
  // A lap whose reading could not be taken for a reason that is about the lap
  // and not about the moment -- no pull request address, no database -- is
  // said once and then left alone: it is due on every scan for ever, and a line
  // per minute in the terminal is a line nobody reads.
  const said = new Set<string>();
  // The lap a pass stopped on, so the next one starts after it rather than at
  // it. **Without this a halt is head-of-line blocking**: an `undetermined`
  // that is about one lap and not about the forge -- a repository rondo cannot
  // read, a document continuo refuses -- would end every pass at the same lap
  // and nothing behind it would ever be read (Codex round 2).
  let stoppedAt: string | null = null;
  let running: Promise<void> | null = null;
  let again = false;

  const pass = async (): Promise<void> => {
    while (again) {
      again = false;
      let due: readonly Due[];
      try {
        due = await scan(ports);
      } catch (error) {
        ports.log(`checks   the published laps could not be scanned: ${describe(error)}`);
        return;
      }
      for (const one of after(due, stoppedAt)) {
        if (ports.pressing?.has(one.iterationId) === true) {
          continue;
        }
        // One lap's failure costs that lap: a throw here would end the page's
        // process with it.
        try {
          const answer = await readOne(ports, one, said);
          if (answer.line !== null) {
            ports.log(`checks   ${one.iterationId}: ${answer.line}`);
          }
          // **A reading that could not be taken ends the pass.** The reason is
          // usually the forge's and not the lap's -- a rate limit, a
          // credential, a network -- and asking it again about every other
          // published lap in the same second is how a poller turns one refusal
          // into a hundred. The next tick asks again, starting where this one
          // stopped.
          //
          // ponytail: no `Retry-After` is read and no clock is kept; one
          // refusal costs one pass. Honouring the header is the upgrade if a
          // minute turns out to be too soon.
          if (answer.halt) {
            stoppedAt = one.iterationId;
            return;
          }
        } catch (error) {
          ports.log(`checks   ${one.iterationId}: ${describe(error)}; read again on the next scan`);
        }
      }
    }
  };

  const kick = (): void => {
    again = true;
    if (running === null) {
      running = pass().finally(() => {
        running = null;
        if (again) {
          kick();
        }
      });
    }
  };
  return {
    kick,
    async idle() {
      while (running !== null) {
        await running;
      }
    },
  };
}

/**
 * The due laps, starting after the one the last pass stopped on.
 *
 * A rotation and not a filter: the lap that stopped the pass is read last
 * rather than skipped, so a forge that has come back is noticed and a lap whose
 * own reading never determines costs one call a tick instead of every other
 * lap's turn.
 */
function after(due: readonly Due[], stoppedAt: string | null): readonly Due[] {
  const at = due.findIndex((one) => one.iterationId === stoppedAt);
  return at === -1 ? due : [...due.slice(at + 1), ...due.slice(0, at + 1)];
}

/** One published lap that is still being read, and what its thread already says. */
interface Due {
  readonly iterationId: string;
  /** The publish report's body, which carries the pull request's address. */
  readonly published: string;
  /** Every message id in the thread store, so a line already written is not written again. */
  readonly said: ReadonlySet<string>;
  /** What the page reads off those lines now, so a rerun that flips it is said again. */
  readonly shown: LapResult | null;
}

/**
 * Every published lap this is still reading, with what its thread already says.
 *
 * **Read off the thread and the ledger, and off nothing else.** Both are rows
 * some other part of rondo already writes, so a restart loses nothing and a
 * publish the command line made while the host runs is found by the next scan.
 *
 * **The reading ends with the pull request, and not with its checks**
 * (rondo#411 to #413). A green or a red used to close it, which left a pull
 * request merged, closed, pushed to or found conflicting afterwards unread and
 * the page saying the same thing for ever. What closes it now is the forge
 * saying the pull request is merged or closed -- a `report-merged-` or a
 * `report-closed-` line -- or the ledger: once the line's work has landed, its
 * pull request is a later question's.
 */
async function scan(ports: ChecksHostPorts): Promise<readonly Due[]> {
  const read = await ports.record.threadMessages();
  if (read.kind !== "read") {
    throw new Error(read.reason);
  }
  const said = new Set(read.messages.map((message) => message.messageId));
  const byId = new Map(read.messages.map((message) => [message.messageId, message]));
  // **A released line is out of the window.** `releasedBy` is non-null once a
  // landing reading or the person's press let the line's paths go (D-0073 rule
  // 4.3), and a change that has landed is past the question this asks.
  const holding = new Set(
    (await ports.store.laneLedger())
      .filter((line) => line.releasedBy === null)
      .flatMap((line) => line.lapIds),
  );
  // **A pull request a later lap was pushed onto is that lap's to read**
  // (rondo#417, D-0105): a conflict fix moves the head of the pull request
  // it fixes, and the lap it fixed would otherwise read its own head as moved
  // and, at the merge, a merge made outside rondo.
  const takenOver = (message: { readonly body: string; readonly atMs: number }): boolean => {
    const url = pullRequestIn(message.body)?.url;
    return read.messages.some(
      (later) =>
        later.messageId.startsWith(PUBLISHED_PREFIX) &&
        later.atMs > message.atMs &&
        later.body.includes("were pushed onto") &&
        pullRequestIn(later.body)?.url === url,
    );
  };
  return read.messages.flatMap((message) => {
    if (!message.messageId.startsWith(PUBLISHED_PREFIX)) {
      return [];
    }
    const iterationId = message.messageId.slice(PUBLISHED_PREFIX.length);
    return said.has(`report-merged-${iterationId}`) ||
      said.has(`report-closed-${iterationId}`) ||
      !holding.has(iterationId) ||
      takenOver(message)
      ? []
      : [{ iterationId, published: message.body, said, shown: resultOf(byId, iterationId) }];
  });
}

/** What one lap's reading came to: a line for the terminal, and whether to stop. */
interface Answer {
  readonly line: string | null;
  /** The reading could not be taken, so this pass asks nothing more. */
  readonly halt: boolean;
}

/**
 * Read one lap's checks and write the answer, or say why there is none yet.
 *
 * **A `pending` and an `undetermined` write nothing**, which is what makes the
 * window close on an answer rather than on a deadline: the next scan asks
 * again, and a forge that is down costs nothing but the call. A `none` writes
 * once and keeps the lap due, because "no check yet" and "no check ever" are
 * the same answer and only one of them is worth closing on.
 *
 * ponytail: a pull request whose checks never finish is re-read once a minute
 * for as long as its line holds. The ledger's release is the bound, and the
 * upgrade if that is not tight enough is a per-lap ceiling like `D-0068`'s
 * patience -- not a number invented here.
 */
async function readOne(ports: ChecksHostPorts, due: Due, said: Set<string>): Promise<Answer> {
  const iterationId = due.iterationId;
  const once = (line: string): Answer => {
    if (said.has(iterationId)) {
      return { line: null, halt: false };
    }
    said.add(iterationId);
    return { line, halt: false };
  };
  // **The pull request the publish report printed**: its base repository and
  // number are what `ci observe` is keyed by, and the address is the one the
  // forge answered when the pull request was opened -- never a number read
  // against whichever repository the host is told about today.
  const address = pullRequestIn(due.published);
  if (address === null) {
    return once("its publish report names no pull request, so its checks cannot be asked for");
  }
  const found = await ports.store.read(iterationId);
  if (found.kind !== "read") {
    return once("its row did not read, so its checks were not asked for");
  }
  // **The lap's own control-plane database**, the one its run was admitted
  // into and its lap performed against: the CI evidence continuo records sits
  // beside the run it is about.
  const db = planField(found.record, "db");
  if (db === "") {
    return once("its plan names no control-plane database, so its checks have nowhere to go");
  }
  const { reading, head, pullRequest } = await ports.readChecks({
    host: ports.host,
    repo: address.repo,
    number: address.number,
    db,
  });
  if (reading.kind === "undetermined") {
    // Said once per lap, for `once`'s reason, and the pass stops: what did not
    // answer is usually the forge, and the next lap would ask the same of it.
    return { ...once(`its checks could not be judged: ${reading.reason}`), halt: true };
  }
  // **Merged or closed is the end of the reading** (rondo#413), whatever the
  // checks say: one line, and the scan leaves the lap alone after it.
  // A press that began while this read was in flight is asked again here: its
  // own merge is its to write, and not one made outside rondo (Codex round 1).
  if (pullRequest !== null && pullRequest.state !== "open") {
    if (ports.pressing?.has(iterationId) === true) {
      return { line: null, halt: false };
    }
    const ended: LapEvent =
      pullRequest.state === "merged"
        ? {
            kind: "mergedOutside",
            pullRequestUrl: address.url,
            into: pullRequest.base,
            by: pullRequest.mergedBy,
            mergeCommit: pullRequest.mergeCommit,
          }
        : { kind: "closed", pullRequestUrl: address.url };
    const line = await reportToRequest(ports, iterationId, ended, ports.now());
    // D-0119: a merge is closed out; a close without one keeps everything.
    const closedOut =
      ended.kind === "mergedOutside" ? await closeOutMerged(ports, iterationId) : null;
    return {
      line: [line, closedOut].filter((one) => one !== null).join("\n") || null,
      halt: false,
    };
  }
  if (head === null) {
    return { ...once("continuo judged its checks on no head commit"), halt: false };
  }
  const shown = due.shown;
  const lines: string[] = [];
  // **Written where the page does not say it already**: a line never written
  // is written, and one written before is said again, under its time, where a
  // newer line has since said otherwise -- a head that went red, green and red
  // again, a branch pushed back to a head it had, a conflict that came back
  // (Codex round 1). Without it the page keeps the newer line for ever.
  const say = async (messageId: string, shownNow: boolean, event: LapEvent): Promise<void> => {
    if (due.said.has(messageId) && shownNow) {
      return;
    }
    const retold = due.said.has(messageId) ? { retold: ports.now() } : {};
    const line = await reportToRequest(ports, iterationId, { ...event, ...retold }, ports.now());
    if (line !== null) {
      lines.push(line);
    }
  };
  // **A head the lap did not push** (rondo#412): somebody pushed to the
  // branch outside rondo. Said once per head, with what it carries, before
  // anything about its checks -- the checks are about commits the person has
  // not been shown. A branch pushed back to the lap's own head is said too,
  // with nothing carried, and the page then reads it as not moved.
  const tip = latestReading(
    await ports.store.readingsFor(iterationId),
    isDeterministicReadingDrafter,
  )?.evidence?.tipCommit;
  const known = tip !== undefined && tip !== null && tip !== "";
  const moved = known && tip !== head;
  // The head the page reads the pull request at, which a move said here changes.
  const headChanged = known && head !== (shown?.moved?.to ?? tip);
  if (headChanged) {
    let commits: CommitsBetween = { kind: "read", commits: [], total: 0 };
    if (moved) {
      commits = await ports.readCommits({
        host: ports.host,
        repo: address.repo,
        from: tip,
        to: head,
      });
    }
    if (commits.kind !== "read") {
      return {
        ...once(`what its new head carries could not be read: ${commits.reason}`),
        halt: true,
      };
    }
    await say(`report-moved-${iterationId}-${head}`, false, {
      kind: "moved",
      pullRequestUrl: address.url,
      from: tip,
      to: head,
      commits: commits.commits,
      total: commits.total,
    });
  }
  // **A conflict is why no check runs** (rondo#411): the forge starts no
  // workflow on a pull request it cannot merge, and an answer beside it is
  // about runs from before it -- so none is written while it stands, and the
  // first one after it is what ends it on the page.
  if (pullRequest?.conflicting === true) {
    await say(
      `report-conflict-${iterationId}-${head}`,
      !headChanged && shown?.checks.kind === "conflict",
      {
        kind: "conflict",
        pullRequestUrl: address.url,
        head,
        base: pullRequest.base,
        baseCommit: pullRequest.baseCommit,
      },
    );
  } else if (reading.kind !== "pending") {
    await say(
      checksAnswerId(iterationId, reading.kind, head, moved),
      shown?.checks.kind === reading.kind &&
        (shown.checksCommit === null || shown.checksCommit === head),
      { kind: "checks", commit: head, reading, moved },
    );
  }
  return { line: lines.length === 0 ? null : lines.join(" "), halt: false };
}

/** The address, `OWNER/NAME` and the number of the pull request a text names, or null. */
export function pullRequestIn(text: string): { url: string; repo: string; number: number } | null {
  const read = /https?:\/\/[^/\s]+\/([^/\s]+\/[^/\s]+)\/pull\/(\d+)/.exec(text);
  return read === null ? null : { url: read[0], repo: read[1] ?? "", number: Number(read[2]) };
}

/**
 * The facts of a pull request document as `gh api repos/O/N/pulls/N` printed
 * it, or null where it does not carry a state and a base: then nothing is
 * said about the pull request, and its checks are read as before.
 */
export function pullRequestFactsOf(printed: string): PullRequestFacts | null {
  let json: unknown;
  try {
    json = JSON.parse(printed);
  } catch {
    return null;
  }
  const at = (from: unknown, key: string): unknown =>
    typeof from === "object" && from !== null ? (from as Record<string, unknown>)[key] : undefined;
  const text = (value: unknown): string | null =>
    typeof value === "string" && value !== "" ? value : null;
  const state = at(json, "state");
  const base = text(at(at(json, "base"), "ref"));
  if ((state !== "open" && state !== "closed") || base === null) {
    return null;
  }
  // The forge's own rule for a closed pull request: merged where it carries a
  // merge time, closed unmerged otherwise (as `ci observe` reads it).
  const merged = state === "closed" && text(at(json, "merged_at")) !== null;
  return {
    state: state === "open" ? "open" : merged ? "merged" : "closed",
    conflicting: at(json, "mergeable") === false,
    base,
    baseCommit: text(at(at(json, "base"), "sha")),
    mergedBy: merged ? text(at(at(json, "merged_by"), "login")) : null,
    mergeCommit: merged ? text(at(json, "merge_commit_sha")) : null,
  };
}

/**
 * continuo's verdict on a pull request's head, as the thread says it
 * (`continuo D-1113` rule 5).
 *
 * Green is `passed` and nothing else. `pending` is not green. A `failed`,
 * `timed_out` or `cancelled` is red, with each check named under what it came
 * to. `no_run` is `none`. `indeterminate`, or a verdict this build has no name
 * for, is not a verdict rondo can write.
 */
export function readingOf(shown: CiShown): ChecksReading {
  const named = (verdict: string): readonly string[] =>
    shown.scopes.filter((scope) => scope.verdict === verdict).map((scope) => scope.scopeId);
  switch (shown.verdict) {
    case "passed":
      return {
        kind: "green",
        counted: shown.scopes.length,
        // The forge's own word tells a skip apart inside `passed` (rondo#376).
        skipped: shown.scopes.filter(
          (scope) => scope.detail === "skipped" || scope.detail === "neutral",
        ).length,
      };
    case "failed":
    case "timed_out":
    case "cancelled":
      return {
        kind: "red",
        failed: named("failed"),
        cancelled: named("cancelled"),
        timedOut: named("timed_out"),
      };
    case "pending":
      return { kind: "pending", pending: named("pending") };
    case "no_run":
      return { kind: "none" };
    default:
      return {
        kind: "undetermined",
        reason: `continuo judged the checks '${shown.verdict}', which is not a result`,
      };
  }
}

/** The three continuo-facing steps, as values a test can replace. */
export interface ChecksReaders {
  readonly forge: (request: PullRequestChecksRequest) => Promise<PullRequestChecksFetch>;
  readonly observe: (request: CiObserveRequest) => Promise<ContinuoResult<CiObserved>>;
  readonly show: (request: CiShowRequest) => Promise<ContinuoResult<CiShown>>;
}

/**
 * Fetch, observe, show (`continuo D-1113`).
 *
 * **A fetch that failed, or an `observe` continuo refused, is `undetermined`
 * and `show` is not asked**: continuo wrote nothing, and its last verdict is
 * about an earlier fetch, so reporting it now would say something about a
 * moment nobody read.
 */
export async function readChecks(
  readers: ChecksReaders,
  request: ChecksRequest,
): Promise<ChecksRead> {
  const undetermined = (reason: string): ChecksRead => ({
    reading: { kind: "undetermined", reason },
    head: null,
    pullRequest: null,
  });
  const fetched = await readers.forge(request);
  if (fetched.kind !== "fetched") {
    return undetermined(`the forge did not answer: ${fetched.reason}`);
  }
  // **The files are transport**, as `./delegation.ts`'s record is: continuo
  // reads documents by path, and what it keeps is its own rows, so the
  // directory is removed as soon as `observe` has answered.
  let directory: string;
  const at = (name: string): string => join(directory, name);
  try {
    directory = mkdtempSync(join(tmpdir(), "rondo-checks-"));
  } catch (error) {
    return undetermined(`no directory for the forge's documents: ${describe(error)}`);
  }
  try {
    try {
      writeFileSync(at("pull-request.json"), fetched.pullRequest, "utf8");
      writeFileSync(at("check-runs.json"), fetched.checkRuns, "utf8");
      writeFileSync(at("status.json"), fetched.status, "utf8");
    } catch (error) {
      return undetermined(`the forge's documents could not be written: ${describe(error)}`);
    }
    const observed = await readers.observe({
      db: request.db,
      repo: request.repo,
      pr: request.number,
      pullRequest: at("pull-request.json"),
      checkRuns: at("check-runs.json"),
      status: at("status.json"),
      observer: OBSERVER,
    });
    if (observed.kind !== "answered") {
      return undetermined(`continuo did not record them: ${unanswered(observed)}`);
    }
  } finally {
    try {
      rmSync(directory, { recursive: true, force: true });
    } catch {
      // Three small files left in the temp dir cost nothing; a throw here
      // would lose a reading that was already recorded.
    }
  }
  const shown = await readers.show({ db: request.db, repo: request.repo, pr: request.number });
  if (shown.kind !== "answered") {
    return undetermined(`continuo did not answer: ${unanswered(shown)}`);
  }
  return {
    reading: readingOf(shown.payload),
    head: shown.payload.headSha,
    // What continuo recorded is the same document, so it is read only once
    // `observe` took it.
    pullRequest: pullRequestFactsOf(fetched.pullRequest),
  };
}

/**
 * {@link readChecks} over the operator's `gh` and the pinned continuo, started
 * once on first use (`D-0015` rule 6). A continuo that will not start is an
 * `undetermined` reading and asked again on the next scan.
 */
export function continuoChecksReader(
  environment: Readonly<Record<string, string | undefined>>,
): (request: ChecksRequest) => Promise<ChecksRead> {
  let verified: VerifiedContinuo | null = null;
  return async (request) => {
    if (verified === null) {
      const startup = await startContinuo(environment);
      if (startup.kind === "refused") {
        return {
          reading: { kind: "undetermined", reason: `continuo is not usable: ${startup.reason}` },
          head: null,
          pullRequest: null,
        };
      }
      verified = startup.continuo;
    }
    const continuo = verified;
    return await readChecks(
      {
        forge: fetchPullRequestChecks,
        observe: async (one) => await ciObserve(continuo, one),
        show: async (one) => await ciShow(continuo, one),
      },
      request,
    );
  };
}

function unanswered(result: Exclude<ContinuoResult<unknown>, { kind: "answered" }>): string {
  switch (result.kind) {
    case "refused":
      return result.message;
    case "refusedInProse":
      return result.text;
    default:
      return result.reason;
  }
}

function describe(error: unknown): string {
  return hostFailure(error).text;
}
