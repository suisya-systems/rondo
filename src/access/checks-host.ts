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
import { planField } from "../store/records.js";
import type { AdvisoryRecord, IterationStore } from "../store/sqlite.js";
import { reportToRequest } from "./conductor.js";
import {
  fetchPullRequestChecks,
  type PullRequestChecksFetch,
  type PullRequestChecksRequest,
} from "./forge.js";
import { hostFailure } from "./host-failure.js";

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
}

/** What the host reaches, as values a test can replace. */
export interface ChecksHostPorts {
  readonly store: Pick<IterationStore, "read" | "readingsFor" | "laneLedger">;
  readonly record: Pick<AdvisoryRecord, "threadMessages" | "recordThreadMessage">;
  /** Fetch, observe and show; {@link continuoChecksReader} in the host. */
  readonly readChecks: (request: ChecksRequest) => Promise<ChecksRead>;
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

/** The prefix every answer this host writes is named with. */
const ANSWER_PREFIX = "report-checks-";

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
  /** The answers already written for it: `green`, `red` or `none`. */
  readonly answered: ReadonlySet<string>;
}

/**
 * Every published lap this is still reading, with what its thread already says.
 *
 * **Read off the thread and the ledger, and off nothing else.** Both are rows
 * some other part of rondo already writes, so a restart loses nothing and a
 * publish the command line made while the host runs is found by the next scan.
 *
 * **A green or a red closes the reading; a `none` does not.** Those two are the
 * forge having answered about this pull request. A `none` is nothing observed
 * yet, and it arrives most often in the seconds after a push, before the first
 * check is registered -- so closing on it would leave the pull request this
 * exists for unread. What closes the window in that case is the ledger: once
 * the line's work has landed, its checks are a later question's.
 */
async function scan(ports: ChecksHostPorts): Promise<readonly Due[]> {
  const read = await ports.record.threadMessages();
  if (read.kind !== "read") {
    throw new Error(read.reason);
  }
  const answers = new Map<string, Set<string>>();
  const published: { readonly iterationId: string; readonly body: string }[] = [];
  for (const message of read.messages) {
    if (message.messageId.startsWith(ANSWER_PREFIX)) {
      // The id is `report-checks-<iterationId>-<kind>`; the kind carries no
      // dash, so everything before the last one is the lap -- which may hold
      // any number of its own.
      const rest = message.messageId.slice(ANSWER_PREFIX.length);
      const cut = rest.lastIndexOf("-");
      const at = answers.get(rest.slice(0, cut)) ?? new Set<string>();
      at.add(rest.slice(cut + 1));
      answers.set(rest.slice(0, cut), at);
    } else if (message.messageId.startsWith(PUBLISHED_PREFIX)) {
      published.push({
        iterationId: message.messageId.slice(PUBLISHED_PREFIX.length),
        body: message.body,
      });
    }
  }
  // **A released line is out of the window.** `releasedBy` is non-null once a
  // landing reading or the person's press let the line's paths go (D-0073 rule
  // 4.3), and a change that has landed is past the question this asks.
  const holding = new Set(
    (await ports.store.laneLedger())
      .filter((line) => line.releasedBy === null)
      .flatMap((line) => line.lapIds),
  );
  return published.flatMap(({ iterationId, body }) => {
    const answered = answers.get(iterationId) ?? new Set<string>();
    if (answered.has("green") || answered.has("red") || !holding.has(iterationId)) {
      return [];
    }
    return [{ iterationId, published: body, answered }];
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
  const { reading, head } = await ports.readChecks({ host: ports.host, ...address, db });
  if (reading.kind === "pending") {
    return { line: null, halt: false };
  }
  if (reading.kind === "undetermined") {
    // Said once per lap, for `once`'s reason, and the pass stops: what did not
    // answer is usually the forge, and the next lap would ask the same of it.
    return { ...once(`its checks could not be judged: ${reading.reason}`), halt: true };
  }
  if (head === null) {
    return { ...once("continuo judged its checks on no head commit"), halt: false };
  }
  if (reading.kind === "none" && due.answered.has("none")) {
    return { line: null, halt: false };
  }
  const line = await reportToRequest(
    ports,
    iterationId,
    { kind: "checks", commit: head, reading },
    ports.now(),
  );
  return { line, halt: false };
}

/** `OWNER/NAME` and the number out of a pull request's address, or null. */
export function pullRequestIn(text: string): { repo: string; number: number } | null {
  const read = /https?:\/\/[^/\s]+\/([^/\s]+\/[^/\s]+)\/pull\/(\d+)/.exec(text);
  return read === null ? null : { repo: read[1] ?? "", number: Number(read[2]) };
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
  return { reading: readingOf(shown.payload), head: shown.payload.headSha };
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
