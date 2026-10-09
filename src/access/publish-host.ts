/**
 * **Publish inside a scope** (rondo#470, D-0126 part 2): a lap whose gate was
 * answered `approve` -- by a person or by rondo under its scope (D-0125) -- and
 * whose scope's approved tip includes both `push_branch` and
 * `open_pull_request` is published in the resident host, today the `rondo web`
 * process, on the minute it already rescans on and right after rondo answers a
 * gate or a person approves one. The act is the press's own path
 * (`publishUnderScope`, `page-publish-actions.ts`), so every refusal of the
 * press holds; the review's verdict is one, and passing it stays a person's act
 * (`--despite-review`, the page's second press). Under rondo's own approval, so
 * is a lap whose model reading is missing, unavailable or raised a finding at
 * or above the line an automatic approval keeps (D-0066 rule 4.2's reading); a
 * person who approved has answered that already (D-0187).
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
import { modelReason } from "./gate-auto.js";
import { GATE_ACTOR } from "./gate-host.js";
import { scopedAuthority } from "./merge.js";
import { askOverLine, resultOf } from "./page-logic/result.js";
import { threadsOf } from "./page-logic/threads.js";
import type { ScopedPublish } from "./page-publish-actions.js";

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
  /** The press's path under a scope (`publishUnderScope`, `page-publish-actions.ts`). */
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
  /**
   * Whether this process has yet to finish its one try of the lap (rondo#619):
   * false once a try returned, published or left for the press, so the page
   * offers the press again over a lap the pass gave up on.
   */
  untried(lapId: string): boolean;
}

export function publishHost(ports: PublishHostPorts): PublishHost {
  let running: Promise<void> | null = null;
  let again = false;
  // ponytail: tried once per lap per process, as a merge on green is tried
  // once; a refusal is the person's press from then on, and a restart tries
  // once more. A retry policy is the upgrade if a transient refusal is felt.
  const tried = new Set<string>();
  // The lap whose try has not returned: still rondo's to publish, to the page
  // (rondo#619). Emptied after every pass, so a try that threw is not.
  const trying = new Set<string>();

  const pass = async (): Promise<void> => {
    while (again) {
      again = false;
      try {
        await publishDue(ports, tried, trying);
      } catch (error) {
        ports.log(`publish  ${describe(error)}`);
      }
      trying.clear();
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
    untried: (lapId) => !tried.has(lapId) || trying.has(lapId),
  };
}

async function publishDue(
  ports: PublishHostPorts,
  tried: Set<string>,
  trying: Set<string>,
): Promise<void> {
  for (const found of await ports.store.terminalIterations()) {
    if (found.kind !== "read" || tried.has(found.record.id)) {
      continue;
    }
    const lapId = found.record.id;
    const authority = await publishable(ports, lapId);
    if (authority === null) {
      continue;
    }
    tried.add(lapId);
    trying.add(lapId);
    const published = await ports.publish(lapId, {
      scopeId: authority.scopeId,
      // **Everything is asked again at each claim** (Codex round 1): a line
      // released, a question asked or a scope replaced while git and the
      // forge were read authorises nothing.
      claim: async (actKind) => {
        const now = await publishable(ports, lapId);
        if (now?.scopeDecisionId !== authority.scopeDecisionId) {
          return {
            kind: "refused",
            reason: "it is no longer rondo's to publish under the scope that allowed it",
          };
        }
        return await ports.record.claimScopedAct({
          actKind,
          scopeDecisionId: authority.scopeDecisionId,
          subjectId: lapId,
          nowMs: ports.now(),
        });
      },
    });
    trying.delete(lapId);
    if (published.ok) {
      ports.log(`publish  ${lapId}: published by rondo under scope '${authority.scopeId}'`);
      ports.published();
    } else {
      ports.log(`publish  ${lapId}: not published by rondo, left for the press: ${published.note}`);
    }
  }
}

/**
 * The approval a lap is published under now, or null where it is not rondo's
 * to publish. The page asks it too (rondo#619), so the card between a
 * person's approval and this pass says rondo is publishing, not *press*.
 */
export async function publishable(
  ports: Pick<PublishHostPorts, "store" | "now"> & {
    readonly record: Omit<PublishHostPorts["record"], "claimScopedAct">;
  },
  lapId: string,
): Promise<Awaited<ReturnType<typeof scopedAuthority>>> {
  const found = await ports.store.read(lapId);
  if (found.kind !== "read" || !approvedForPublication(found.record)) {
    return null;
  }
  const lap = found.record;
  const line = (await ports.store.laneLedger()).find(
    (held) =>
      held.releasedBy === null && held.closedTips.length === 1 && held.closedTips[0] === lap.id,
  );
  const read = await ports.record.threadMessages();
  if (line === undefined || read.kind !== "read") {
    return null;
  }
  const threads = threadsOf(read.messages, new Set(), new Map());
  if (
    resultOf(threads.byId, lap.id) !== null ||
    // D-0066 rule 4.2: no question waits on the person over the act's line.
    (lap.requestMessageId !== null &&
      askOverLine(threads, lap.requestMessageId, line.lapIds) !== null)
  ) {
    return null;
  }
  const authority = await scopedAuthority(ports, lap.id, PUBLISH_ACTS);
  if (authority === null) {
    return null;
  }
  // **A person's approval carries the lap to its pull request** (D-0187):
  // they approved over what the model read, as a merge on green takes it
  // (D-0126 rule 2), so the press would only ask them the same thing twice.
  if (lap.gateAnswerActor !== null && lap.gateAnswerActor !== GATE_ACTOR) {
    return authority;
  }
  // D-0066 rule 4.2: under rondo's own approval, a push or a pull request is
  // inside the scope only where the lap's model reading of its tip is there,
  // readable and below the line, as for an automatic approval.
  const readings = await ports.store.readingsFor(lap.id);
  return modelReason(readings, reviewedReading(readings), { payload: authority.payload }) === null
    ? authority
    : null;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
