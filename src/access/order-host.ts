/**
 * The order tick (D-0098 rule 1.4, D-0127): approving a split's scope is the
 * go, so every part of an approved split starts by itself once it can, read in
 * the resident host -- today the `rondo web` process -- on the minute it
 * already rescans on (`D-0073` rule 7). A part with no `after` starts once it
 * is `ready`, or `held` by lines none of which is in flight; one with `after`
 * starts once its predecessor's line has landed. A part the host has no room
 * for (`busy`, `full`) or another line holds is tried again the next minute:
 * nothing is queued.
 *
 * **Only a landing releases it** (rule 1.2): the release fact is
 * `first_landed`, the landing basis the landing reading writes on `first`'s
 * release row ({@link readHolder}, `IterationStore.landingOf`). A `first` that
 * has ended and holds its claim is read here, so a landing nobody's refusal
 * would read is still found; a `first` that ended without landing never
 * releases, and the person is asked once what `then` becomes (rule 1.5, P3).
 *
 * **The start is the press's own path** ({@link OrderHostPorts.start} is
 * `startSplitFromPage`, deduplicated by plan against a person's simultaneous
 * press), in the approver's name, so the scope's tests, the lane ledger and the
 * readiness are asked exactly as for a press. It answers once the lap's row is
 * reserved (D-0109), so one pass starts two parts and goes on reading landings
 * while they run.
 *
 * **And a person's own start that other work's files held** (rondo#284,
 * D-0157): kept as a `held_start` row by the press, and attempted again here
 * through the press's own path and id once no line holding files in its
 * repository is in flight -- a scoped start asks for the whole repository
 * (D-0073 rule 2.5), so every such line is in its way. The attempt reads the
 * finished holders' landings, as a press's does (rule 7); refused by held files
 * again, or while the host has no room for another lap, or while continuo is
 * not usable, it waits on; started, or refused for a reason waiting does not
 * change, its wait ends and the reason is said, so the page draws the ordinary
 * start again rather than a wait nothing will end.
 */

import { readSplitPayload } from "../advisory/proposal.js";
import type {
  AdvisoryRecord,
  ApprovedSplit,
  HeldStart,
  HostPolicy,
  IterationStore,
} from "../store/sqlite.js";
import { DETERMINISTIC_DRAFTER } from "./advisory.js";
import type { DraftedStartReadiness } from "./drafted-start.js";
import type { Started, StartRefusal } from "./web-app.js";

export interface OrderHostPorts {
  readonly record: Pick<AdvisoryRecord, "readProposal" | "recordThreadMessage" | "openAsksIn">;
  /** Every split under an approval in force (`approvedSplits`). */
  readonly splits: () => Promise<readonly ApprovedSplit[]>;
  /** `draftedStartReadiness` for one plan of an approved split. */
  readonly readiness: (split: ApprovedSplit, planIndex: number) => Promise<DraftedStartReadiness>;
  /** `readHolder` over the lane ledger: reads `first`'s landing and releases it if it landed. */
  readonly readHolder: (
    lineageId: string,
  ) => Promise<{ readonly released: boolean; readonly line: string }>;
  /**
   * `startSplitFromPage` in the approver's name, with a freshly minted
   * iteration id, answered once the lap's row is reserved (`answerOnceReserved`).
   */
  readonly start: (split: ApprovedSplit, planIndex: number) => Promise<Started>;
  /**
   * The person's starts held by files (rondo#284): the rows, the ledger, the
   * host's occupancy and bounds, and `startScopedFromPage` with the row's own
   * input and id, in the approver's name, answered once reserved
   * (`heldStartPort`). Null where no approver can start one -- said, not
   * left out, so a host that forgets it does not compile.
   */
  readonly held: {
    readonly store: Pick<
      IterationStore,
      "read" | "heldStarts" | "settleHeldStart" | "laneLedger" | "occupancy"
    >;
    readonly policy: Pick<HostPolicy, "maxOccupying" | "maxLive">;
    /**
     * Why the approval it waited under is no longer in force, or null. Asked
     * before anything else, so a retired wait ends without asking admission
     * (no stop written) and never outlasts its approval behind a holder.
     */
    readonly retired: (held: HeldStart) => Promise<string | null>;
    readonly start: (held: HeldStart) => Promise<Started>;
  } | null;
  readonly now: () => number;
  readonly log: (line: string) => void;
}

export interface OrderHost {
  /** Run one pass now, or once more after the one in flight. Never throws. */
  kick(): void;
  /** Resolves when no pass is in flight (for tests). */
  settled(): Promise<void>;
}

export function orderHost(ports: OrderHostPorts): OrderHost {
  // What this process already said about a plan, so a wait that stays the same
  // is not a line a minute. The ask itself is idempotent by its id.
  const said = new Set<string>();
  let running: Promise<void> | null = null;
  let again = false;

  const pass = async (): Promise<void> => {
    while (again) {
      again = false;
      let splits: readonly ApprovedSplit[];
      try {
        splits = await ports.splits();
      } catch (error) {
        ports.log(`order    the approved splits could not be read: ${describe(error)}`);
        return;
      }
      for (const split of splits) {
        // One split's failure costs that split, never the page's process.
        try {
          await readSplit(ports, split, said);
        } catch (error) {
          ports.log(`order    ${split.proposalId}: ${describe(error)}`);
        }
      }
      if (ports.held !== null) {
        try {
          await readHeldStarts(ports, ports.held, said);
        } catch (error) {
          ports.log(`order    the held starts could not be read: ${describe(error)}`);
        }
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

async function readSplit(
  ports: OrderHostPorts,
  split: ApprovedSplit,
  said: Set<string>,
): Promise<void> {
  const read = await ports.record.readProposal(split.proposalId);
  if (read.kind !== "read" || read.proposal.kind !== "split") {
    return;
  }
  const payload = readSplitPayload(read.proposal.payload);
  if (payload.kind !== "split") {
    return;
  }
  for (const [index, plan] of payload.payload.plans.entries()) {
    let ready = await ports.readiness(split, index);
    // `first` has ended and still holds its claim: read its landing now, which
    // writes `first_landed` if it landed, then ask again.
    if (ready.kind === "ordered" && ready.first?.state === "awaitingLanding") {
      const holder = await ports.readHolder(ready.first.lineageId);
      if (!holder.released) {
        sayOnce(ports, said, `${split.proposalId}/${String(index)}`, holder.line);
        continue;
      }
      ready = await ports.readiness(split, index);
    }
    if (ready.kind === "ordered" && ready.first?.state === "endedUnlanded") {
      await askUnlanded(ports, said, split, index, ready.after, ready.first);
      continue;
    }
    // D-0098 rule 1.3: a part the scope does not admit is not started, and
    // it is said rather than skipped in silence; the page draws the same
    // reason where the press is.
    if (ready.kind === "outside" || ready.kind === "undecidable") {
      sayOnce(
        ports,
        said,
        `${split.proposalId}/${String(index)}`,
        `${split.proposalId} plan ${String(index)} is not started by itself: ${ready.reason}`,
      );
      continue;
    }
    // A held plan is attempted only where every holder has finished, as the
    // page draws its press: the attempt reads their landings (D-0073 rule 7).
    const startable =
      ready.kind === "ready" ||
      (ready.kind === "held" && ready.holders.every(({ line }) => !line.inFlight));
    if (!startable) {
      continue;
    }
    // Rule 1.5's "drop": the person answered `stop` to the unlanded ask, so a
    // later landing of a retried `first` does not start this plan by itself.
    if (await dropped(ports, split, index)) {
      sayOnce(
        ports,
        said,
        `${split.proposalId}/${String(index)}`,
        `${split.proposalId} plan ${String(index)} was dropped by the person and is not started`,
      );
      continue;
    }
    const started = await ports.start(split, index);
    // Held by files again: it waits, said once rather than every minute.
    if (started.why === "startWaitsHeld") {
      sayOnce(
        ports,
        said,
        `${split.proposalId}/${String(index)}`,
        `${split.proposalId} plan ${String(index)} waits: other work still holds its files`,
      );
      continue;
    }
    ports.log(
      `order    ${split.proposalId} plan ${String(index)}: ` +
        (!started.ok
          ? `not started: ${started.note}`
          : plan.after === undefined
            ? "started under its approved scope"
            : "started on its dependency's landing"),
    );
  }
}

/**
 * The refusals a held start waits through (rondo#284): the files again (or the
 * same refusal where its row could not be written again -- the row this reads
 * is still there), and a continuo not usable now. Any other ends the wait.
 */
const WAITS_THROUGH: ReadonlySet<StartRefusal | undefined> = new Set([
  "startWaitsHeld",
  "startRefusedHeld",
  "startRefusedNoContinuo",
] as const);

/** Attempt each held start whose repository no line holding files is in flight in (rondo#284). */
async function readHeldStarts(
  ports: OrderHostPorts,
  held: NonNullable<OrderHostPorts["held"]>,
  said: Set<string>,
): Promise<void> {
  const waiting = await held.store.heldStarts();
  for (const one of waiting) {
    const id = one.iterationId;
    // One start's failure costs that start, never the pass.
    try {
      // **Its lap is already there** -- a press joined the wait and started it
      // (`scopedStartPress`): the wait is over, before its own line, now in
      // flight, is read as the work it waits on.
      if ((await held.store.read(id)).kind !== "absent") {
        await held.store.settleHeldStart(id, "started", ports.now());
        ports.log(`order    ${id}: started by a press`);
        continue;
      }
      const retired = await held.retired(one);
      if (retired !== null) {
        await held.store.settleHeldStart(id, retired, ports.now());
        ports.log(`order    ${id}: not started: ${retired}`);
        continue;
      }
      // Read again for each: a start this pass made holds files and a slot.
      const lines = await held.store.laneLedger();
      if (lines.some((l) => l.repository === one.repository && l.paths.length > 0 && l.inFlight)) {
        sayOnce(ports, said, id, `${id} waits: other work in flight holds files it needs`);
        continue;
      }
      // **No room, no attempt** (`draftedStartReadiness`'s capacity test): a
      // full host refuses at `reserve()` in words the press cannot tell from a
      // refusal for good, so the tick never asks it there.
      if (!(await room(held))) {
        sayOnce(ports, said, id, `${id} waits: this host has no room for another lap`);
        continue;
      }
      const started = await held.start(one);
      // Refused while the host filled up since it looked: that refusal is the
      // capacity one as likely as not, so it waits on rather than ends.
      if (WAITS_THROUGH.has(started.why) || (!started.ok && !(await room(held)))) {
        const why =
          started.why === "startRefusedNoContinuo"
            ? "continuo is not usable now"
            : started.why === "startWaitsHeld" || started.why === "startRefusedHeld"
              ? "finished work still holds files it needs"
              : "this host has no room for another lap";
        sayOnce(ports, said, id, `${id} waits: ${why}`);
        continue;
      }
      await held.store.settleHeldStart(id, started.ok ? "started" : started.note, ports.now());
      ports.log(
        `order    ${id}: ` +
          (started.ok ? "started once its files were free" : `not started: ${started.note}`),
      );
    } catch (error) {
      ports.log(`order    ${id}: ${describe(error)}`);
    }
  }
}

/** Whether the host has a slot for one more lap, as `draftedStartReadiness` asks it (D-0023, D-0124). */
async function room(held: NonNullable<OrderHostPorts["held"]>): Promise<boolean> {
  const occupancy = await held.store.occupancy();
  return occupancy.live < held.policy.maxLive && occupancy.occupying < held.policy.maxOccupying;
}

/**
 * D-0098 rule 1.5: `first` ended without landing, so `then` is held for good
 * until the person says what it becomes. One ask, P3, with one recommendation;
 * **no "start anyway"**, which no entry decides.
 *
 * Its bases are the request and `first`'s line, so it holds `first`'s retry
 * until the person answers (D-0066 rule 4.4), and holds no unrelated plan of
 * the request. The id names the plan and the line's latest lap, so the tick
 * writes it once per ending: a retry keeps the lineage, and a retry that ends
 * unlanded too is asked about again rather than found spoken for.
 */
async function askUnlanded(
  ports: OrderHostPorts,
  said: Set<string>,
  split: ApprovedSplit,
  index: number,
  after: number,
  first: { readonly lineageId: string; readonly lastLapId: string },
): Promise<void> {
  const firstLineageId = first.lineageId;
  const messageId = `${unlandedPrefix(split, index)}${first.lastLapId}`;
  if (said.has(messageId)) {
    return;
  }
  const outcome = await ports.record.recordThreadMessage({
    messageId,
    body: unlandedBody(index, after, firstLineageId),
    authorKind: "drafter",
    authorId: DETERMINISTIC_DRAFTER,
    inReplyTo: split.requestMessageId,
    atMs: ports.now(),
    bases: [
      { form: "message", messageId: split.requestMessageId },
      { form: "proposal", proposalId: split.proposalId },
      { form: "iteration", iterationId: firstLineageId },
    ],
    asks: true,
  });
  // A second process, or this one after a restart, finds the id spoken for:
  // the ask is already in the thread, and that is not a failure. Any other
  // outcome is said, and asked again on the next pass.
  //
  // The store's own arm since rondo#200; this read the refusal's prose for it
  // before there was one, which is the reading the issue set out to remove.
  if (outcome.kind === "recorded" || outcome.kind === "duplicate") {
    said.add(messageId);
    return;
  }
  ports.log(`order    the question about plan ${String(index)} was not written: ${outcome.reason}`);
}

/** How rule 1.5's question about plan `index` is named, before the lap that ended. */
export function unlandedPrefix(split: Pick<ApprovedSplit, "proposalId">, index: number): string {
  return `order-unlanded-${split.proposalId}-${String(index)}-`;
}

/** Whether an unlanded ask about this plan stands answered `stop` (rule 1.5's drop). */
async function dropped(ports: OrderHostPorts, split: ApprovedSplit, index: number) {
  const open = await ports.record.openAsksIn(split.requestMessageId);
  if (open.kind !== "read") {
    // Unreadable is not a drop, and not a go: start nothing on it.
    throw new Error(open.reason);
  }
  return open.asks.some(
    (ask) => ask.answeredStop && ask.messageId.startsWith(unlandedPrefix(split, index)),
  );
}

/** The ask's words: rondo's own, ASCII (D-0004), in `stopBody`'s layout (`./scope.ts`). */
export function unlandedBody(index: number, after: number, firstLineageId: string): string {
  const then = `part ${String(index + 1)}`;
  const first = `part ${String(after + 1)}`;
  return [
    `Waiting: ${then} of this request starts only once ${first} is merged, and ${first} ` +
      `(line '${firstLineageId}') ended without being merged, so ${then} will not start by itself.`,
    "Options:",
    `- Try ${first} again (answer carry on, then retry it). Gives up: nothing of the chain; ` +
      `${then} still waits, and starts by itself once ${first} is merged.`,
    `- Drop ${then} (answer stop). Gives up: ${then}'s work, which then never starts by ` +
      "itself; the rest of the request carries on.",
    `Recommended: try ${first} again, since ${then} was drafted to build on its merged change.`,
    `Part ${String(index + 1)} stays held until ${first} is merged.`,
  ].join("\n");
}
function sayOnce(ports: OrderHostPorts, said: Set<string>, key: string, line: string): void {
  if (!said.has(`${key}\n${line}`)) {
    said.add(`${key}\n${line}`);
    ports.log(`order    ${line}`);
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
