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
  let running: Promise<void> | null = null;
  let again = false;

  const pass = async (): Promise<void> => {
    while (again) {
      again = false;
      let due: readonly string[];
      try {
        due = await scan(ports);
      } catch (error) {
        ports.log(`checks   the published laps could not be scanned: ${describe(error)}`);
        return;
      }
      for (const iterationId of due) {
        // One lap's failure costs that lap: a throw here would end the page's
        // process with it.
        try {
          const line = await readOne(ports, read, iterationId, said);
          if (line !== null) {
            ports.log(`checks   ${iterationId}: ${line}`);
          }
        } catch (error) {
          ports.log(`checks   ${iterationId}: ${describe(error)}; read again on the next scan`);
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
 * Every published lap with no answer yet whose line still holds, oldest report
 * first.
 *
 * **Read off the thread and the ledger, and off nothing else.** Both are rows
 * some other part of rondo already writes, so a restart loses nothing and a
 * publish the command line made while the host runs is found by the next scan.
 */
async function scan(ports: ChecksHostPorts): Promise<readonly string[]> {
  const read = await ports.record.threadMessages();
  if (read.kind !== "read") {
    throw new Error(read.reason);
  }
  const answered = new Set<string>();
  const published: string[] = [];
  for (const message of read.messages) {
    if (message.messageId.startsWith(ANSWER_PREFIX)) {
      // The id is `report-checks-<iterationId>-<kind>`; the lap is what is
      // between the two, and the kind carries no dash.
      const rest = message.messageId.slice(ANSWER_PREFIX.length);
      answered.add(rest.slice(0, rest.lastIndexOf("-")));
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
  return published.filter((id) => !answered.has(id) && holding.has(id));
}

/**
 * Read one lap's checks and write the answer, or say why there is none yet.
 *
 * **A `pending` and an `undetermined` write nothing**, which is what makes the
 * window close on an answer rather than on a deadline: the next scan asks
 * again, and a forge that is down costs nothing but the call.
 *
 * ponytail: a pull request whose checks never finish is re-read once a minute
 * for as long as its line holds. The ledger's release is the bound, and the
 * upgrade if that is not tight enough is a per-lap ceiling like `D-0068`'s
 * patience -- not a number invented here.
 */
async function readOne(
  ports: ChecksHostPorts,
  read: (request: ChecksRequest) => Promise<ChecksReading>,
  iterationId: string,
  said: Set<string>,
): Promise<string | null> {
  const once = (line: string): string | null => {
    if (said.has(iterationId)) {
      return null;
    }
    said.add(iterationId);
    return line;
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
  if (reading.kind === "pending" || reading.kind === "undetermined") {
    return null;
  }
  return await reportToRequest(
    ports,
    iterationId,
    { kind: "checks", commit, reading },
    ports.now(),
  );
}

function describe(error: unknown): string {
  return hostFailure(error).text;
}
