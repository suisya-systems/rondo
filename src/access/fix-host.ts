/**
 * **The conflict fix rondo starts by itself** (D-0194, rondo#557): a line
 * admitted with no drafted claim (D-0160 rule 4) whose published pull request
 * conflicts with its base is followed by its conflict fix (D-0105) with no
 * press, under an approval that starts a lost lap by itself (D-0139: a goal
 * scope, or a split its request runs as). The person chose to run such a line
 * beside other work, and the collision is the cost they accepted for it.
 *
 * **The press's own path** (`conflictFixFromPage`), in the approver's name, as
 * a publish inside a scope runs the publish press's: every refusal of the press
 * holds, and the attempt is the scope's `redo` like any revise. A budget that
 * would refuse it refuses it here too, and nothing is spent.
 *
 * **Once per lap per process.** A try that started nothing leaves the lap to the
 * press, and the page says why (`left`). A fix that started and then failed is
 * a failed lap like any other: the person's to retry. A red check's repair
 * (rondo#551) stays a press.
 */
import type { IterationRecord } from "../store/records.js";
import { approvedForPublication } from "../store/records.js";
import type { AdvisoryRecord, IterationStore } from "../store/sqlite.js";
import { asksOverLine, conflictFixBlock, resultOf } from "./page-logic/result.js";
import { type Threads, threadsOf } from "./page-logic/threads.js";
import { approvalTip } from "./scope.js";
import type { ConflictFixed, ConflictFixInput } from "./web-app.js";

type OfferStore = Pick<IterationStore, "laneLine" | "readLive" | "laneLedger">;

/**
 * Whether the conflict fix is offered on `record` now, asked over fresh rows:
 * the press asks it before it starts anything, and this host before it tries.
 */
export async function conflictFixOffered(
  store: OfferStore,
  threads: Pick<Threads, "byId" | "waiting" | "rootOf">,
  record: IterationRecord,
): Promise<{
  readonly block: ReturnType<typeof conflictFixBlock> | "nothingToFix";
  readonly fresh: ReturnType<typeof resultOf>;
}> {
  const line = await store.laneLine(record.id);
  const lineIds = line.kind === "read" ? line.line.laps.map((lap) => lap.id) : [record.id];
  // A gate of this line only (D-0138 rule 2): another part's gate is its own.
  const gated = (await store.readLive()).some(
    (live) =>
      live.kind === "read" &&
      live.record.status === "awaiting_human" &&
      lineIds.includes(live.record.id),
  );
  const fresh = resultOf(threads.byId, record.id);
  const block = !approvedForPublication(record)
    ? "nothingToFix"
    : conflictFixBlock(fresh, {
        // A gate waiting, or a question about this line (D-0105); a question
        // about the request as a whole does not withhold the fix.
        asksWaiting: gated || asksOverLine(threads, record.requestMessageId, lineIds),
        holding: (await store.laneLedger()).some(
          (one) => one.releasedBy === null && one.lapIds.includes(record.id),
        ),
        succeeded:
          line.kind !== "read" ||
          line.line.laps.some((lap) => lap.supersedesIterationId === record.id),
      });
  return { block, fresh };
}

export interface FixHostPorts {
  readonly store: OfferStore &
    Pick<IterationStore, "terminalIterations" | "read" | "startedUnclaimed">;
  readonly record: Pick<AdvisoryRecord, "threadMessages" | "scopeDecisionAdmitting" | "scopeTip">;
  /** Whether the lap's approval starts a lost lap by itself (`startsByItself`, D-0139). */
  readonly byItself: (lap: IterationRecord) => Promise<boolean>;
  /** The press's path (`conflictFixFromPage`), in the approver's name. */
  readonly fix: (input: ConflictFixInput) => Promise<ConflictFixed>;
  readonly mintId: () => string;
  readonly log: (line: string) => void;
}

export interface FixHost {
  /** Run one pass now, or once more after the one in flight. Never throws. */
  kick(): void;
  /** Resolves when no pass and no try is in flight (for tests). */
  settled(): Promise<void>;
  /**
   * Whether rondo is to start, or is starting, the fix of `lapId` itself: the
   * page draws no press over it. False once a try started nothing.
   */
  starting(lapId: string): Promise<boolean>;
  /** What this process's try of `lapId` came to when it started nothing, or null. */
  left(lapId: string): ConflictFixed | null;
}

export function fixHost(ports: FixHostPorts): FixHost {
  let running: Promise<void> | null = null;
  let again = false;
  // ponytail: tried once per lap per process, as a publish inside a scope is;
  // a restart tries once more. A stored mark is the upgrade if that is felt.
  const tried = new Set<string>();
  const left = new Map<string, ConflictFixed>();
  // A try runs to the fix's gate, so the pass does not wait on it.
  const trying = new Map<string, Promise<void>>();

  const due = async (): Promise<void> => {
    for (const found of await ports.store.terminalIterations()) {
      if (found.kind !== "read" || tried.has(found.record.id)) {
        continue;
      }
      const lap = found.record;
      const scopeDecisionId = await fixable(ports, lap);
      if (scopeDecisionId === null) {
        continue;
      }
      tried.add(lap.id);
      const successorId = ports.mintId();
      ports.log(`fix  ${lap.id}: rondo is resolving its conflict as '${successorId}'`);
      const settle = async (fixed: ConflictFixed): Promise<void> => {
        if (!fixed.ok) {
          left.set(lap.id, fixed);
          ports.log(`fix  ${lap.id}: not started by rondo, left for the press: ${fixed.note}`);
        }
      };
      const fixing = ports
        .fix({ iterationId: lap.id, successorId, scopeDecisionId, cause: "conflict" })
        .then(settle, async (error: unknown) => {
          await settle({ ok: false, why: "conflictFixRefusedNotStarted", note: describe(error) });
        })
        .finally(() => trying.delete(lap.id));
      trying.set(lap.id, fixing);
    }
  };

  const pass = async (): Promise<void> => {
    while (again) {
      again = false;
      try {
        await due();
      } catch (error) {
        ports.log(`fix  ${describe(error)}`);
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
      while (running !== null || trying.size > 0) {
        await running;
        await Promise.all(trying.values());
      }
    },
    async starting(lapId) {
      if (trying.has(lapId)) {
        return true;
      }
      if (tried.has(lapId)) {
        return false;
      }
      const found = await ports.store.read(lapId);
      return found.kind === "read" && (await fixable(ports, found.record)) !== null;
    },
    left: (lapId) => left.get(lapId) ?? null,
  };
}

/**
 * The approval rondo starts the fix of `lap` under, or null where the fix is
 * the person's press: not offered now, a red check's repair, a line that was
 * admitted with a drafted claim, or an approval that starts nothing by itself.
 */
async function fixable(ports: FixHostPorts, lap: IterationRecord): Promise<string | null> {
  if (!approvedForPublication(lap) || !(await ports.store.startedUnclaimed(lap.id))) {
    return null;
  }
  const read = await ports.record.threadMessages();
  if (read.kind !== "read") {
    return null;
  }
  const threads = threadsOf(read.messages, new Set(), new Map());
  const { block, fresh } = await conflictFixOffered(ports.store, threads, lap);
  if (block !== null || fresh?.checks.kind !== "conflict") {
    return null;
  }
  const tip = await approvalTip(ports.record, lap.id);
  return tip.kind === "tip" && (await ports.byItself(lap)) ? tip.scopeDecisionId : null;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
