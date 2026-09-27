/**
 * Lost laps (D-0139, rondo#506): a lap whose rondo process died while it
 * performed stays `performing` for ever, since nothing is left to record its
 * answer. The resident host -- today the `rondo web` process -- reads for them
 * when it starts and on the minute it already rescans on.
 *
 * **A lap is lost only when nothing of it can still be running.** Its row names
 * the host and pid of the rondo process that sent it and the pid of its `lap
 * perform` child ({@link thisDriver}, `markLapProcess`); it is lost when that
 * host is this one and both pids are gone. A row that names another host, or
 * either pid still alive, is left as it is: that is D-0019 rule 12's hold, kept.
 * A row with no child pid (none spawned, or its write failed) or none at all
 * (sent before the pids were written) is lost only once its driver is gone and
 * it has performed past its plan's `invocation_ceiling_ms`, which is as long as
 * any rondo process would have waited for it.
 *
 * A lost lap ends `failed` with the kind `lost`: it holds no budget and is not
 * counted as unread (what it spent before it died was never read). Then it is
 * started again once, by itself, under a goal scope or an approved split, and
 * the thread says so; otherwise, or when that start is refused, the stop is
 * asked in the thread, and a person's *carry on* starts it again.
 */

import { hostname } from "node:os";
import type { IterationRecord, PerformingLap } from "../store/records.js";
import type { AdvisoryRecord, IterationStore } from "../store/sqlite.js";
import { DETERMINISTIC_DRAFTER } from "./advisory.js";
import type { Chrome } from "./wording.js";

/** Who drives a lap sent from this process (D-0139). */
export function thisDriver(): { readonly driverHost: string; readonly driverPid: number } {
  return { driverHost: hostname(), driverPid: process.pid };
}

/** Whether a process with this pid exists: a signal-0 probe, and EPERM is alive. */
export function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * Whether `lap` is lost (D-0139 rule 1). `ceilingMs` is its plan's
 * `invocation_ceiling_ms`, or null where the plan does not say; such a row with
 * no pids is never called lost.
 */
export function lapLost(
  lap: PerformingLap,
  ceilingMs: number | null,
  nowMs: number,
  host: string,
  alive: (pid: number) => boolean,
): boolean {
  if (lap.driverPid === null) {
    return ceilingMs !== null && nowMs - lap.updatedAtMs > ceilingMs;
  }
  if (lap.driverHost !== host || alive(lap.driverPid)) {
    return false;
  }
  // No child recorded: none was spawned, or its pid was never written. Which
  // one cannot be told, so the ceiling decides, as for a row with no pids.
  if (lap.lapPid === null) {
    return ceilingMs !== null && nowMs - lap.updatedAtMs > ceilingMs;
  }
  return !alive(lap.lapPid);
}

/** The id the one start again of a lost lap runs as, so a second pass finds it. */
export function againId(iterationId: string): string {
  return `${iterationId}-again`;
}

/** The ask a lost lap stops on, under the stop ask's own id (`lap-stopped-`). */
export function lostAskId(iterationId: string): string {
  return `lap-stopped-${iterationId}`;
}

export interface LostLapPorts {
  readonly store: Pick<IterationStore, "performingLaps" | "read" | "terminalIterations">;
  readonly record: Pick<AdvisoryRecord, "recordThreadMessage" | "threadMessages">;
  /** Ends the row at `failed` with the kind `lost` (`endLost`); answers the status it ended at. */
  readonly end: (iterationId: string, reason: string) => Promise<string | null>;
  /**
   * Whether the lap runs under a goal scope or an approved split, and so is
   * started again by itself; false where no approver may start it.
   */
  readonly byItself: (lap: IterationRecord) => Promise<boolean>;
  /**
   * Starts the lap again as {@link againId}, under the approval it ran under,
   * in the approver's name; answers once its row is reserved. Null where no
   * approver may start anything.
   */
  readonly restart:
    | ((lap: IterationRecord) => Promise<{ readonly ok: boolean; readonly note: string }>)
    | null;
  readonly words: Chrome;
  readonly host: string;
  readonly alive: (pid: number) => boolean;
  readonly now: () => number;
  readonly log: (line: string) => void;
}

export interface LostLapHost {
  /** Run one pass now, or once more after the one in flight. Never throws. */
  kick(): void;
  /** Resolves when no pass is in flight (for tests). */
  settled(): Promise<void>;
}

export function lostLapHost(ports: LostLapPorts): LostLapHost {
  // What this process already said, so a start that stays refused is not a line a minute.
  const said = new Set<string>();
  let running: Promise<void> | null = null;
  let again = false;
  const pass = async (): Promise<void> => {
    while (again) {
      again = false;
      try {
        await endTheLost(ports);
        await settleTheLost(ports, said);
      } catch (error) {
        ports.log(`lost     ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  };
  const kick = (): void => {
    again = true;
    if (running === null) {
      running = pass().finally(() => {
        running = null;
      });
    }
  };
  return {
    kick,
    async settled() {
      while (running !== null) {
        await running;
      }
    },
  };
}

async function endTheLost(ports: LostLapPorts): Promise<void> {
  for (const lap of await ports.store.performingLaps()) {
    const row = await ports.store.read(lap.iterationId);
    if (row.kind !== "read") {
      continue;
    }
    const ceiling = row.record.plan["invocation_ceiling_ms"];
    const nowMs = ports.now();
    if (
      !lapLost(lap, typeof ceiling === "number" ? ceiling : null, nowMs, ports.host, ports.alive)
    ) {
      continue;
    }
    const reason =
      lap.driverPid === null
        ? `the lap was still performing ${String(nowMs - lap.updatedAtMs)} ms after it was sent, ` +
          "past its plan's invocation ceiling, and no process of it was recorded (D-0139)"
        : `the rondo process that sent the lap (pid ${String(lap.driverPid)} on ` +
          `${String(lap.driverHost)}) and its lap perform child ` +
          `(${lap.lapPid === null ? "never recorded, and past its ceiling" : `pid ${String(lap.lapPid)}`}) are both ` +
          "gone, so nothing will record its answer (D-0139)";
    const status = await ports.end(lap.iterationId, reason);
    ports.log(`lost     lap '${lap.iterationId}' was lost: ${reason}`);
    if (status !== "failed") {
      ports.log(`lost     lap '${lap.iterationId}' was not ended; it is '${String(status)}'`);
    }
  }
}

/** Whether the lap is not itself the start again of a lost lap: it is started again once. */
async function firstLoss(ports: LostLapPorts, lap: IterationRecord): Promise<boolean> {
  if (lap.supersedesIterationId === null) {
    return true;
  }
  const before = await ports.store.read(lap.supersedesIterationId);
  return before.kind !== "read" || before.record.failureKind !== "lost";
}

/**
 * Every lost lap not started again yet (D-0139 rule 3), read from the rows
 * rather than remembered, so a pass cut short -- the host stopped between the
 * end and the ask -- is finished by the next: started again by itself where it
 * may be and has not been asked about, else asked, and on the person's *carry
 * on* started again.
 */
async function settleTheLost(ports: LostLapPorts, said: Set<string>): Promise<void> {
  const lost = (await ports.store.terminalIterations()).flatMap((one) =>
    one.kind === "read" && one.record.failureKind === "lost" ? [one.record] : [],
  );
  if (lost.length === 0) {
    return;
  }
  const read = await ports.record.threadMessages();
  if (read.kind !== "read") {
    ports.log(`lost     the threads did not read: ${read.reason}`);
    return;
  }
  for (const lap of lost) {
    if ((await ports.store.read(againId(lap.id))).kind === "read") {
      continue;
    }
    const asked = stopsOf(read.messages, lap.id);
    if (asked.length === 0) {
      const started =
        ports.restart !== null && (await firstLoss(ports, lap)) && (await ports.byItself(lap))
          ? await ports.restart(lap)
          : null;
      if (started?.ok === true) {
        ports.log(`lost     lap '${lap.id}' was started again by itself: ${started.note}`);
        await tell(
          ports,
          lap,
          `report-lost-${lap.id}`,
          false,
          `Lap '${lap.id}' was lost: ${String(lap.reason)}. rondo started it again by itself ` +
            `as '${againId(lap.id)}' (D-0139).`,
        );
        continue;
      }
      if (started !== null) {
        ports.log(`lost     lap '${lap.id}' was not started again: ${started.note}`);
        // A scope that refused it has asked already, and one stop is enough:
        // its *carry on* starts the lap again as the lost ask's would.
        const now = await ports.record.threadMessages();
        if (now.kind === "read" && stopsOf(now.messages, lap.id).length > 0) {
          continue;
        }
      }
      await tell(ports, lap, lostAskId(lap.id), true, ports.words.lapLostAsk);
      continue;
    }
    const carriedOn = read.messages.some(
      (message) =>
        message.inReplyTo !== null &&
        asked.includes(message.inReplyTo) &&
        message.authorKind === "operator" &&
        message.answerOutcome === "carry_on",
    );
    if (!carriedOn || ports.restart === null) {
      continue;
    }
    const started = await ports.restart(lap);
    const line = `lost     lap '${lap.id}' was ${started.ok ? "" : "not "}started again: ${started.note}`;
    if (!said.has(line)) {
      said.add(line);
      ports.log(line);
    }
  }
}

/**
 * The stops standing for a lost lap: its own ask, and a scope's stop over its
 * start again, which names it as the redo's predecessor (`stopTheLine`).
 */
function stopsOf(
  messages: readonly {
    readonly messageId: string;
    readonly asks: boolean;
    readonly bases: readonly Readonly<Record<string, unknown>>[];
  }[],
  lapId: string,
): readonly string[] {
  return messages
    .filter(
      (message) =>
        message.messageId === lostAskId(lapId) ||
        (message.asks &&
          message.messageId.startsWith("scope-stop-") &&
          message.bases.some(
            (basis) => basis["form"] === "iteration" && basis["iterationId"] === lapId,
          )),
    )
    .map((message) => message.messageId);
}

async function tell(
  ports: LostLapPorts,
  lap: IterationRecord,
  messageId: string,
  asks: boolean,
  body: string,
): Promise<void> {
  const outcome = await ports.record.recordThreadMessage({
    messageId,
    body,
    authorKind: "drafter",
    authorId: DETERMINISTIC_DRAFTER,
    inReplyTo: lap.requestMessageId,
    atMs: ports.now(),
    bases: [
      { form: "message", messageId: lap.requestMessageId },
      { form: "iteration", iterationId: lap.id },
    ],
    asks,
  });
  if (outcome.kind !== "recorded" && outcome.kind !== "duplicate") {
    ports.log(`lost     the thread was not told about lap '${lap.id}': ${outcome.reason}`);
  }
}
