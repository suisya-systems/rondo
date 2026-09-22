/**
 * The order tick (D-0098 rule 1.4): a drafted plan that waits on an earlier
 * plan of its split starts by itself once that plan's line has landed, read in
 * the resident host -- today the `rondo web` process -- on the minute it
 * already rescans on (`D-0073` rule 7).
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
 * readiness are asked exactly as for a press. Nothing here admits a plan
 * without an order: those stay the person's to press.
 */

import { readSplitPayload } from "../advisory/proposal.js";
import type { AdmittedSplit, AdvisoryRecord } from "../store/sqlite.js";
import { DETERMINISTIC_DRAFTER } from "./advisory.js";
import type { DraftedStartReadiness } from "./drafted-start.js";

export interface OrderHostPorts {
  readonly record: Pick<AdvisoryRecord, "admittedSplits" | "readProposal" | "recordThreadMessage">;
  /** `draftedStartReadiness` for one plan of an admitted split. */
  readonly readiness: (split: AdmittedSplit, planIndex: number) => Promise<DraftedStartReadiness>;
  /** `readHolder` over the lane ledger: reads `first`'s landing and releases it if it landed. */
  readonly readHolder: (
    lineageId: string,
  ) => Promise<{ readonly released: boolean; readonly line: string }>;
  /** `startSplitFromPage` in the approver's name, with a freshly minted iteration id. */
  readonly start: (
    split: AdmittedSplit,
    planIndex: number,
  ) => Promise<{ readonly ok: boolean; readonly note: string }>;
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
      let splits: readonly AdmittedSplit[];
      try {
        splits = await ports.record.admittedSplits();
      } catch (error) {
        ports.log(`order    the admitted splits could not be read: ${describe(error)}`);
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
  split: AdmittedSplit,
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
    if (plan.after === undefined) {
      continue;
    }
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
      await askUnlanded(ports, said, split, index, ready.after, ready.first.lineageId);
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
    const started = await ports.start(split, index);
    ports.log(
      `order    ${split.proposalId} plan ${String(index)}: ` +
        (started.ok ? "started on its dependency's landing" : `not started: ${started.note}`),
    );
  }
}

/**
 * D-0098 rule 1.5: `first` ended without landing, so `then` is held for good
 * until the person says what it becomes. One ask, P3, with one recommendation;
 * **no "start anyway"**, which no entry decides.
 *
 * Its bases are the request and `first`'s line, so it holds `first`'s retry
 * until the person answers (D-0066 rule 4.4), and holds no unrelated plan of
 * the request. The id names the plan and the line, so the tick writes it once.
 */
async function askUnlanded(
  ports: OrderHostPorts,
  said: Set<string>,
  split: AdmittedSplit,
  index: number,
  after: number,
  firstLineageId: string,
): Promise<void> {
  const messageId = `order-unlanded-${split.proposalId}-${String(index)}-${firstLineageId}`;
  if (said.has(messageId)) {
    return;
  }
  said.add(messageId);
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
  // the ask is already in the thread, and that is not a failure.
  if (outcome.kind === "defect") {
    ports.log(
      `order    the question about plan ${String(index)} was not written: ${outcome.reason}`,
    );
  }
}

/** The ask's words: rondo's own, ASCII (D-0004), in `stopBody`'s layout (`./scope.ts`). */
export function unlandedBody(index: number, after: number, firstLineageId: string): string {
  const then = `part ${String(index + 1)}`;
  const first = `part ${String(after + 1)}`;
  return [
    `Waiting: ${then} of this request starts only once ${first} is merged, and ${first} ` +
      `(line '${firstLineageId}') ended without being merged, so ${then} will not start by itself.`,
    "Options:",
    `- Try ${first} again. Gives up: nothing of the chain; ${then} still waits, and starts by ` +
      `itself once ${first} is merged.`,
    `- Drop ${then}. Gives up: ${then}'s work; the rest of the request carries on.`,
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
