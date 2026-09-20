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
 * **A read and no more.** `readChecks` is two `GET`s through the operator's own
 * `gh` (`./forge.ts`); merging is on `D-0064` rule 3.4's irreversible list and
 * a comment on a pull request is not an act a scope can include
 * (`SCOPE_OUTWARD_ACTS`), so neither is reachable from here and neither is
 * meant to be. What this produces is one line in the request's thread.
 *
 * **Nobody is woken by it.** Whether a person who is not looking at the page
 * should be told is rondo#311's question, and its mechanism is where that
 * answer belongs; a second delivery path built here would have to be taken back
 * out.
 */

import {
  type IterationRecord,
  isDeterministicReadingDrafter,
  latestReading,
} from "../store/records.js";
import type { AdvisoryRecord, IterationStore } from "../store/sqlite.js";
import { reportToRequest } from "./conductor.js";
import { type ChecksReading, type ChecksRequest, readChecks } from "./forge.js";
import { hostFailure } from "./host-failure.js";

/** What the host reaches, as values a test can replace. */
export interface ChecksHostPorts {
  readonly store: Pick<IterationStore, "read" | "readingsFor" | "laneLedger">;
  readonly record: Pick<AdvisoryRecord, "threadMessages" | "recordThreadMessage">;
  /** Tests replace the read; the host reads the real forge. */
  readonly readChecks?: (request: ChecksRequest) => Promise<ChecksReading>;
  /**
   * Which repository a lap's pull request is in, as `publish` resolves it: the
   * lap's own plan's slug, or the host's `--repo` for a plan that carries none
   * (`D-0081` rule 3.2). Null for a lap with neither, which is a lap this
   * cannot ask about.
   */
  readonly repository: (record: IterationRecord) => string | null;
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

export function checksHost(ports: ChecksHostPorts): ChecksHost {
  const read = ports.readChecks ?? readChecks;
  // A lap whose reading could not be taken for a reason that is about the lap
  // and not about the moment -- no repository, no commit to ask about -- is
  // said once and then left alone: it is due on every scan for ever, and a line
  // per minute in the terminal is a line nobody reads.
  const said = new Set<string>();
  // The lap a pass stopped on, so the next one starts after it rather than at
  // it. **Without this a halt is head-of-line blocking**: an `undetermined`
  // that is about one lap and not about the forge -- a repository rondo cannot
  // read, a count that never adds up -- would end every pass at the same lap
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
          const answer = await readOne(ports, read, one, said);
          if (answer.line !== null) {
            ports.log(`checks   ${one.iterationId}: ${answer.line}`);
          }
          // **A forge that would not answer about one lap ends the pass.** The
          // reason is usually the forge's and not the lap's -- a rate limit, a
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
 * forge having answered about this commit. A `none` is the forge having nothing
 * to say yet, and it arrives most often in the seconds after a push, before the
 * first check is registered -- so closing on it would leave the pull request
 * this exists for unread. What closes the window in that case is the ledger:
 * once the line's work has landed, its checks are a later question's.
 */
async function scan(ports: ChecksHostPorts): Promise<readonly Due[]> {
  const read = await ports.record.threadMessages();
  if (read.kind !== "read") {
    throw new Error(read.reason);
  }
  const answers = new Map<string, Set<string>>();
  const published: string[] = [];
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
      published.push(message.messageId.slice(PUBLISHED_PREFIX.length));
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
  return published.flatMap((iterationId) => {
    const answered = answers.get(iterationId) ?? new Set<string>();
    if (answered.has("green") || answered.has("red") || !holding.has(iterationId)) {
      return [];
    }
    return [{ iterationId, answered }];
  });
}

/** What one lap's reading came to: a line for the terminal, and whether to stop. */
interface Answer {
  readonly line: string | null;
  /** The forge would not answer, so this pass asks it nothing more. */
  readonly halt: boolean;
}

/**
 * Read one lap's checks and write the answer, or say why there is none yet.
 *
 * **A `pending` and an `undetermined` write nothing**, which is what makes the
 * window close on an answer rather than on a deadline: the next scan asks
 * again, and a forge that is down costs nothing but the call. A `none` writes
 * once and keeps the lap due, because "no check yet" and "no check ever" are
 * the same answer from the forge and only one of them is worth closing on.
 *
 * ponytail: a pull request whose checks never finish is re-read once a minute
 * for as long as its line holds. The ledger's release is the bound, and the
 * upgrade if that is not tight enough is a per-lap ceiling like `D-0068`'s
 * patience -- not a number invented here.
 */
async function readOne(
  ports: ChecksHostPorts,
  read: (request: ChecksRequest) => Promise<ChecksReading>,
  due: Due,
  said: Set<string>,
): Promise<Answer> {
  const iterationId = due.iterationId;
  const once = (line: string): Answer => {
    if (said.has(iterationId)) {
      return { line: null, halt: false };
    }
    said.add(iterationId);
    return { line, halt: false };
  };
  const found = await ports.store.read(iterationId);
  if (found.kind !== "read") {
    return once("its row did not read, so its checks were not asked for");
  }
  const repo = ports.repository(found.record);
  if (repo === null) {
    return once(
      "its plan names no repository and this rondo was given no --repo, so there is " +
        "nothing to ask about its checks",
    );
  }
  // **The commit off the lap's own reading**, which is the commit `publish`
  // pushed and the same value the landing reading is taken over
  // (`./conductor.ts`). Reading it here rather than holding a pull request
  // number is why this needs no column of its own.
  const commit = latestReading(
    await ports.store.readingsFor(iterationId),
    isDeterministicReadingDrafter,
  )?.evidence?.tipCommit;
  if (commit === undefined || commit === null || commit === "") {
    return once("it carries no reading of the commit it pushed, so its checks cannot be named");
  }
  const reading = await read({ host: ports.host, repo, commit });
  if (reading.kind === "pending") {
    return { line: null, halt: false };
  }
  if (reading.kind === "undetermined") {
    // Said once per lap, for `once`'s reason, and the pass stops: the forge is
    // what did not answer, and the next lap would ask the same thing of it.
    return { ...once(`the forge did not answer about its checks: ${reading.reason}`), halt: true };
  }
  if (reading.kind === "none" && due.answered.has("none")) {
    return { line: null, halt: false };
  }
  const line = await reportToRequest(
    ports,
    iterationId,
    { kind: "checks", commit, reading },
    ports.now(),
  );
  return { line, halt: false };
}

function describe(error: unknown): string {
  return hostFailure(error).text;
}
