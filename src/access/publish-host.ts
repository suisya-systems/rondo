/**
 * **Publish inside a scope** (rondo#470, D-0126 part 2): a lap whose gate was
 * answered `approve` -- by a person or by rondo under its scope (D-0125) -- and
 * whose scope's approved tip includes both `push_branch` and
 * `open_pull_request` is published in the resident host, today the `rondo web`
 * process, on the minute it already rescans on and right after rondo answers a
 * gate. The act is the press's own path (`publishUnderScope`, `cli.ts`), so
 * every refusal of the press holds; the review's verdict is one, and passing it
 * stays a person's act (`--despite-review`, the page's second press). So is a
 * lap whose model reading is missing, unavailable or raised a finding at or
 * above the line an automatic approval keeps (D-0066 rule 4.2's reading).
 *
 * **Claim, then act** (D-0042): each leg's `scope_consumption` row is written
 * right before it runs, asking the scope again first, so a lap is pushed and
 * its pull request opened once whichever approval, pass or process tries.
 *
 * **Only a lap whose line still holds it**, as its line's one closed tip: a
 * line the person released, or a lap another lap continues, is not rondo's to
 * publish.
 */
import { approvedForPublication, reviewedReading } from "../store/records.js";
import type { AdvisoryRecord, IterationStore } from "../store/sqlite.js";
import type { ScopedPublish } from "./cli.js";
import { modelReason } from "./gate-auto.js";
import { scopedAuthority } from "./merge.js";
import { askOverLine, resultOf } from "./page-logic/result.js";
import { threadsOf } from "./page-logic/threads.js";

const PUBLISH_ACTS = ["push_branch", "open_pull_request"] as const;

export interface PublishHostPorts {
  readonly store: Pick<
    IterationStore,
    "terminalIterations" | "read" | "laneLedger" | "readingsFor"
  >;
  readonly record: Pick<
    AdvisoryRecord,
    | "threadMessages"
    | "scopeDecisionAdmitting"
    | "scopeTip"
    | "readScopeDecision"
    | "readScope"
    | "claimScopedAct"
  >;
  /** The press's path under a scope (`publishUnderScope`, `cli.ts`). */
  readonly publish: (
    iterationId: string,
    scoped: ScopedPublish,
  ) => Promise<{ readonly ok: boolean; readonly note: string }>;
  /** After a lap is published: the checks host reads its pull request next. */
  readonly published: () => void;
  readonly now: () => number;
  readonly log: (line: string) => void;
}

export interface PublishHost {
  /** Run one pass now, or once more after the one in flight. Never throws. */
  kick(): void;
  /** Resolves when no pass is in flight (for tests). */
  settled(): Promise<void>;
}

export function publishHost(ports: PublishHostPorts): PublishHost {
  let running: Promise<void> | null = null;
  let again = false;
  // ponytail: tried once per lap per process, as a merge on green is tried
  // once; a refusal is the person's press from then on, and a restart tries
  // once more. A retry policy is the upgrade if a transient refusal is felt.
  const tried = new Set<string>();

  const pass = async (): Promise<void> => {
    while (again) {
      again = false;
      try {
        await publishDue(ports, tried);
      } catch (error) {
        ports.log(`publish  ${describe(error)}`);
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

async function publishDue(ports: PublishHostPorts, tried: Set<string>): Promise<void> {
  const read = await ports.record.threadMessages();
  if (read.kind !== "read") {
    return;
  }
  const threads = threadsOf(read.messages, new Set(), new Map());
  const ledger = await ports.store.laneLedger();
  for (const found of await ports.store.terminalIterations()) {
    if (found.kind !== "read") {
      continue;
    }
    const lap = found.record;
    const line = ledger.find(
      (held) =>
        held.releasedBy === null && held.closedTips.length === 1 && held.closedTips[0] === lap.id,
    );
    if (
      line === undefined ||
      tried.has(lap.id) ||
      !approvedForPublication(lap) ||
      resultOf(threads.byId, lap.id) !== null ||
      // D-0066 rule 4.2: no question waits on the person over the act's line.
      (lap.requestMessageId !== null &&
        askOverLine(threads, lap.requestMessageId, line.lapIds) !== null)
    ) {
      continue;
    }
    const authority = await scopedAuthority(ports, lap.id, PUBLISH_ACTS);
    if (authority === null) {
      continue;
    }
    // D-0066 rule 4.2: a push or a pull request is inside the scope only where
    // the lap's model reading of its tip is there, readable and below the line,
    // as for an automatic approval. A person's approval over a finding is
    // theirs to publish on, with the press.
    const readings = await ports.store.readingsFor(lap.id);
    if (modelReason(readings, reviewedReading(readings), { payload: authority.payload }) !== null) {
      continue;
    }
    tried.add(lap.id);
    const published = await ports.publish(lap.id, {
      scopeId: authority.scopeId,
      claim: async (actKind) => {
        const now = await scopedAuthority(ports, lap.id, PUBLISH_ACTS);
        if (now?.scopeDecisionId !== authority.scopeDecisionId) {
          return {
            kind: "refused",
            reason: "the scope that allowed the publish no longer does, or has been replaced",
          };
        }
        return await ports.record.claimScopedAct({
          actKind,
          scopeDecisionId: authority.scopeDecisionId,
          subjectId: lap.id,
          nowMs: ports.now(),
        });
      },
    });
    if (published.ok) {
      ports.log(`publish  ${lap.id}: published by rondo under scope '${authority.scopeId}'`);
      ports.published();
    } else {
      ports.log(
        `publish  ${lap.id}: not published by rondo, left for the press: ${published.note}`,
      );
    }
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
