/**
 * Lost laps (D-0139, rondo#506): a lap whose rondo process died before its gate
 * stays where it was for ever, since nothing is left to move it or record its
 * answer. The resident host -- today the `rondo web` process -- reads for them
 * when it starts and on the minute it already rescans on: every lap from
 * `planned` to `performing` (rondo#655; `performing` alone before).
 *
 * **A lap is lost only when nothing of it can still be running.** Its row names
 * the host and pid of the rondo process that sent it and the pid of its `lap
 * perform` child ({@link thisDriver}, `markLapProcess`); it is lost when that
 * host is this one and both pids are gone. A row that names another host, or
 * either pid still alive, is left as it is: that is D-0019 rule 12's hold, kept.
 * A row with no child pid (none spawned, or its write failed) or none at all
 * (reserved before the pids were written) is lost only once its driver is gone
 * and it has stood past its plan's `invocation_ceiling_ms`, which is as long as
 * any rondo process would have waited for it. A row before `performing` has no
 * child to wait for, so its driver being gone is all of it.
 *
 * A lost lap ends `failed` with the kind `lost`: it holds no budget and is not
 * counted as unread (what it spent before it died was never read). Then it is
 * started again once, by itself, under a goal scope or an approved split, and
 * the thread says so; otherwise, or when that start is refused, the stop is
 * asked in the thread, and a person's *carry on* starts it again.
 *
 * A lap a person ended from the page ends `failed` with the kind `ended`
 * (rondo#655): the same as lost for money and for *carry on*, but never started
 * again by itself, since a person decided it should stop.
 */

import { hostname } from "node:os";
import type { ReadOutcome, StorePort } from "../refrain/ports.js";
import type { DrivenLap } from "../store/contract.js";
import type { IterationRecord } from "../store/records.js";
import type { AdvisoryRecord, IterationStore } from "../store/sqlite.js";
import { DETERMINISTIC_DRAFTER } from "./advisory.js";
import { stoppedShort } from "./forge.js";
import type { Chrome } from "./wording.js";

/** Who drives a lap sent from this process (D-0139). */
export function thisDriver(): { readonly driverHost: string; readonly driverPid: number } {
  return { driverHost: hostname(), driverPid: process.pid };
}

/** The statuses `resume()` walks on from; `admitting` and `performing` it only reports. */
const RESUMED: ReadonlySet<string> = new Set(["planned", "classified", "admitted"]);

/**
 * Names this process the driver of a row `resume()` is about to walk from
 * before its gate (rondo#655), so the sweep does not take a lap another process
 * picked up after its first driver died for one nothing drives. A failed write
 * is ignored: the row then keeps its old driver, as it did before.
 */
export async function driveResumed(
  // Optional: the loop's store port does not name it, and the store behind it
  // (`conductorPorts`) does; a port without it marks nothing.
  store: Pick<StorePort, "read"> & Partial<Pick<IterationStore, "markLapProcess">>,
  row: ReadOutcome,
): Promise<void> {
  if (row.kind === "read" && RESUMED.has(row.record.status)) {
    await store.markLapProcess?.(row.record.id, thisDriver()).catch(() => undefined);
  }
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
  lap: DrivenLap,
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
  // rondo#655: no child exists before the lap is sent, so the driver is all of it.
  if (lap.status !== "performing") {
    return true;
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
  // Numbered rather than appended, so a line started again many times keeps an
  // id the allocator accepts (at most 64 characters).
  const numbered = /^(.*)-again-([0-9]+)$/.exec(iterationId);
  return numbered === null
    ? `${iterationId}-again-1`
    : `${numbered[1] ?? ""}-again-${String(Number(numbered[2]) + 1)}`;
}

/** The ask a lost lap stops on, under the stop ask's own id (`lap-stopped-`). */
export function lostAskId(iterationId: string): string {
  return `lap-stopped-${iterationId}`;
}

/** Whether the lap ended lost (D-0139) or ended by a person from the page (rondo#655). */
export function endedLost(lap: IterationRecord): boolean {
  return lap.status === "failed" && (lap.failureKind === "lost" || lap.failureKind === "ended");
}

/**
 * Whether a person's *carry on* at this lap's stop starts it again (D-0139,
 * D-0149, rondo#655): it was lost or ended from the page, or stopped at its
 * budget or its time limit. A lost or ended lap is started again by this host;
 * the others by the answer's own press.
 */
export function startsAgainOnCarryOn(lap: IterationRecord): boolean {
  return endedLost(lap) || stoppedShort(lap);
}

/**
 * The reason a lap ended from the page records: who, then the person's words
 * as a JSON string ending the entry (rondo#655), so {@link personsReason} reads
 * them back whole, whatever punctuation they hold.
 */
export function endedOnThePage(reason: string, actorId: string): string {
  return `${ENDED_BY}${actorId}: ${JSON.stringify(reason)}`;
}

const ENDED_BY = "ended on the page by ";

/**
 * The person's words of {@link endedOnThePage} out of the row's reason. Its
 * entry is the last one, since the end is terminal and nothing is appended
 * after it; a reason without one is answered as it is.
 */
export function personsReason(lap: IterationRecord): string {
  const reason = lap.reason ?? "";
  const words = /ended on the page by \S+: ("(?:[^"\\]|\\.)*")$/.exec(reason)?.[1];
  return words === undefined ? reason : (JSON.parse(words) as string);
}

/**
 * The lap a stop is about, or null for any other ask: its own stop
 * (`lap-stopped-<lap>`), the stop of a start that threw (`start-stopped-<lap>`,
 * rondo#655), or a scope's stop over a redo of it, which names it as the redo's
 * predecessor (`stopTheLine`).
 */
export function stoppedLapOf(ask: {
  readonly messageId: string;
  readonly asks: boolean;
  readonly bases: readonly Readonly<Record<string, unknown>>[];
}): string | null {
  for (const prefix of ["lap-stopped-", START_STOPPED]) {
    if (ask.messageId.startsWith(prefix)) {
      return ask.messageId.slice(prefix.length);
    }
  }
  if (!ask.asks || !ask.messageId.startsWith("scope-stop-")) {
    return null;
  }
  const basis = ask.bases.find((one) => one["form"] === "iteration");
  return typeof basis?.["iterationId"] === "string" ? basis["iterationId"] : null;
}

/** The prefix of the stop a start that threw asks under (`stopTheLeftLap`). */
const START_STOPPED = "start-stopped-";

export interface LostLapPorts {
  readonly store: Pick<IterationStore, "drivenLaps" | "read" | "terminalIterations">;
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
  for (const lap of await ports.store.drivenLaps()) {
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
        ? `the lap was still '${lap.status}' ${String(nowMs - lap.updatedAtMs)} ms after it was ` +
          "last written, past its plan's invocation ceiling, and no process of it was recorded (D-0139)"
        : lap.status !== "performing"
          ? `the rondo process that drove the lap (pid ${String(lap.driverPid)} on ` +
            `${String(lap.driverHost)}) is gone while it was '${lap.status}', before any lap was ` +
            "sent, so nothing will move it on (D-0139, rondo#655)"
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
 * on* started again. A lap ended from the page (rondo#655) is only ever asked
 * about -- the page asks, this writes the ask a pass cut short did not -- and
 * started again on *carry on*.
 */
async function settleTheLost(ports: LostLapPorts, said: Set<string>): Promise<void> {
  const lost = (await ports.store.terminalIterations()).flatMap((one) =>
    one.kind === "read" && endedLost(one.record) ? [one.record] : [],
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
    const asked = stopsOf(read.messages, lap);
    const reported = `report-lost-${lap.id}`;
    if ((await ports.store.read(againId(lap.id))).kind === "read") {
      // Started again by itself, and the host stopped before the thread was told.
      if (asked.length === 0 && !read.messages.some((m) => m.messageId === reported)) {
        await tell(ports, lap, reported, false, restartedReport(lap));
      }
      continue;
    }
    if (asked.length === 0 && lap.failureKind === "ended") {
      await tell(ports, lap, lostAskId(lap.id), true, ports.words.lapEndedAsk(personsReason(lap)));
      continue;
    }
    if (asked.length === 0) {
      const started =
        ports.restart !== null && (await firstLoss(ports, lap)) && (await ports.byItself(lap))
          ? await ports.restart(lap)
          : null;
      if (started?.ok === true) {
        ports.log(`lost     lap '${lap.id}' was started again by itself: ${started.note}`);
        await tell(ports, lap, reported, false, restartedReport(lap));
        continue;
      }
      if (started !== null) {
        ports.log(`lost     lap '${lap.id}' was not started again: ${started.note}`);
        // A scope that refused it has asked already, and one stop is enough:
        // its *carry on* starts the lap again as the lost ask's would.
        const now = await ports.record.threadMessages();
        if (now.kind === "read" && stopsOf(now.messages, lap).length > 0) {
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
        message.answerOutcome === "carry_on" &&
        // rondo#655: a *carry on* given to a start that threw while it was held
        // is not one given to the ending that came after it.
        (!message.inReplyTo.startsWith(START_STOPPED) || message.atMs > lap.updatedAtMs),
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

/** rondo's record that a lost lap was started again by itself (a `report-` message). */
function restartedReport(lap: IterationRecord): string {
  return (
    `Lap '${lap.id}' was lost: ${String(lap.reason)}. rondo started it again by itself ` +
    `as '${againId(lap.id)}' (D-0139).`
  );
}

/**
 * The stops standing for a lost lap: its own ask, a scope's stop over its start
 * again, which names it as the redo's predecessor (`stopTheLine`), and the stop
 * of a start that threw (rondo#655) -- for a lap a person ended, whose ending
 * that stop offered, unless a person answered it while the lap was held (the
 * end then asked afresh, as `endLapFromPage` does); one lost while held is
 * asked about afresh, since that stop still says the lap holds its room.
 */
function stopsOf(
  messages: readonly {
    readonly messageId: string;
    readonly asks: boolean;
    readonly atMs: number;
    readonly inReplyTo: string | null;
    readonly authorKind: string;
    readonly bases: readonly Readonly<Record<string, unknown>>[];
  }[],
  lap: IterationRecord,
): readonly string[] {
  const lapId = lap.id;
  const startStopped = `${START_STOPPED}${lapId}`;
  const answeredWhileHeld = messages.some(
    (m) => m.inReplyTo === startStopped && m.authorKind === "operator" && m.atMs <= lap.updatedAtMs,
  );
  return messages
    .filter(
      (message) =>
        message.messageId === lostAskId(lapId) ||
        (message.messageId === startStopped &&
          ((lap.failureKind === "ended" && !answeredWhileHeld) ||
            message.atMs > lap.updatedAtMs)) ||
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
