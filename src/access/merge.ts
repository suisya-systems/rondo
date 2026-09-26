/**
 * One press of the page's *merge* button (rondo#380, `D-0091`).
 *
 * **A person's act, per act, through the operator's own `gh`.** `D-0064` rule
 * 3.4 keeps merging into a default branch on the irreversible list, approved
 * by a person at the time for that act; `D-0091` lets that approval be a press
 * on the page. rondo holds no credential (`D-0010`): the forge commands are
 * `./forge.ts`'s, run as the operator.
 *
 * **Everything the button was drawn on is read again here**, because a page
 * does not redraw itself between drawing a button and a press of it: the lap,
 * its publish and checks reports, the questions in its thread and its line in
 * the lane ledger go through the same {@link mergeBlock} the page asked, and
 * the head the button carried must still be the head rondo read green. Then
 * the forge is asked, and the merge itself is refused by the forge if the head
 * moved in between (`--match-head-commit`).
 */

import {
  closeRun,
  type RemoveWorkspaceRequest,
  RUN_CLOSE_OUTCOMES,
  removeWorkspace,
  showRun,
  startContinuo,
} from "../continuo/invoker.js";
import type { ContinuoResult } from "../continuo/protocol.js";
import { lineShape } from "../store/lanes.js";
import {
  isDeterministicReadingDrafter,
  type JsonValue,
  latestReading,
  planField,
} from "../store/records.js";
import { type AdvisoryRecord, type IterationStore, LANE_LEDGER_AUTHOR } from "../store/sqlite.js";
import { reportToRequest, type WorktreeOutcome } from "./conductor.js";
import {
  type CommandOutcome,
  deleteLapBase,
  type MergeMethodReading,
  mergePullRequest,
  type PullRequestState,
  readMergeMethod,
  readPullRequest,
} from "./forge.js";
import { type MergeBlock, mergeBlock, resultOf } from "./page-logic/result.js";
import { threadsOf } from "./page-logic/threads.js";
import type { Merged, MergeInput, MergeRefusal } from "./web-app.js";

/** What a merge press reads and writes, as values a test can replace. */
export interface MergePorts {
  readonly store: Pick<
    IterationStore,
    "read" | "readingsFor" | "laneLedger" | "readLive" | "closingLapOf" | "laneLine" | "releaseLane"
  >;
  readonly record: Pick<AdvisoryRecord, "threadMessages" | "recordThreadMessage">;
  readonly now: () => number;
  /**
   * Shared with the checks host, which leaves a lap alone while its press is
   * in flight (rondo#413): the lap ids a press is working on now.
   */
  readonly pressing?: Set<string>;
  /**
   * Read the pull requests again, after a press found the head moved
   * (rondo#412): the thread the person lands back on then says what moved
   * rather than offering the same button. The host's checks pass.
   */
  readonly readAgain?: () => Promise<void>;
  /** Tests replace the forge; the host reaches the real one. */
  readonly forge?: {
    readonly readPullRequest: typeof readPullRequest;
    readonly readMergeMethod: typeof readMergeMethod;
    readonly mergePullRequest: typeof mergePullRequest;
  };
  /** The close-out's git (D-0119); tests replace it, the host reaches the real one. */
  readonly deleteLapBase?: typeof deleteLapBase;
  /** The close-out's worktree removal (rondo#456); {@link continuoWorkspaceRemover} in the host. */
  readonly removeWorkspace: RemoveLapWorkspace;
}

const REFUSED_BY: Readonly<Record<MergeBlock, MergeRefusal>> = {
  notPublished: "mergeRefusedNotPublished",
  notGreen: "mergeRefusedNotGreen",
  asked: "mergeRefusedAsked",
  merged: "mergeRefusedMerged",
  closed: "mergeRefusedClosed",
  landed: "mergeRefusedLanded",
};

/**
 * The press, with one merge per lap in flight: a double press of one button is
 * one act, which the second press waits on and reports.
 */
export function mergePress(ports: MergePorts): (input: MergeInput) => Promise<Merged> {
  const running = new Map<string, Promise<Merged>>();
  return async (input) => {
    const already = running.get(input.iterationId);
    if (already !== undefined) {
      return await already;
    }
    const merging = mergeOnce(ports, input);
    running.set(input.iterationId, merging);
    ports.pressing?.add(input.iterationId);
    let merged: Merged;
    try {
      merged = await merging;
    } finally {
      running.delete(input.iterationId);
      ports.pressing?.delete(input.iterationId);
    }
    // After the press has let go of the lap, so the pass reads it.
    if (merged.why === "mergeRefusedMoved") {
      await ports.readAgain?.();
    }
    return merged;
  };
}

async function mergeOnce(ports: MergePorts, input: MergeInput): Promise<Merged> {
  const forge = ports.forge ?? { readPullRequest, readMergeMethod, mergePullRequest };
  const found = await ports.store.read(input.iterationId);
  if (found.kind !== "read") {
    return refused("mergeRefusedGone", `iteration '${input.iterationId}' did not read`);
  }
  const record = found.record;
  const read = await ports.record.threadMessages();
  if (read.kind !== "read") {
    return refused("mergeRefusedGone", `the request thread did not read: ${read.reason}`);
  }
  const threads = threadsOf(read.messages, new Set(), new Map());
  const result = resultOf(threads.byId, record.id);
  const holding = (await ports.store.laneLedger()).some(
    (line) => line.releasedBy === null && line.lapIds.includes(record.id),
  );
  // **A question or a gate of this request still waiting on the person** is
  // `D-0064`'s P2 to P4 item open: an ask nobody carried on, or another lap
  // of the same request standing at its gate.
  const gated = (await ports.store.readLive()).some(
    (live) =>
      live.kind === "read" &&
      live.record.status === "awaiting_human" &&
      live.record.requestMessageId === record.requestMessageId,
  );
  const block = mergeBlock(
    result,
    gated || [...threads.waiting].some((id) => threads.rootOf(id) === record.requestMessageId),
    holding,
  );
  if (block !== null || result === null || result.url === null) {
    return refused(REFUSED_BY[block ?? "notPublished"], `the merge is not offered: ${block}`);
  }
  // **The head the button was drawn for, the head rondo read green and the
  // head `publish` pushed are one commit**, or this press is about something
  // the person was not shown. **Or the head it moved to** (rondo#412, `D-0102`):
  // one the page showed as moved, with what it carries, and read green there.
  const tip = tipOf(await ports.store.readingsFor(record.id));
  const head = result.checksCommit;
  if (
    tip === null ||
    head === null ||
    input.head !== head ||
    (tip !== head && result.moved?.to !== head)
  ) {
    return refused(
      "mergeRefusedMoved",
      `the press was drawn for '${input.head}', rondo read '${head}' green and ` +
        `the lap pushed '${tip ?? "(none recorded)"}'`,
    );
  }
  const url = result.url;
  const before = await forge.readPullRequest({ url });
  if (before.kind !== "read") {
    return refused("mergeRefusedForge", before.reason);
  }
  if (before.state !== "OPEN") {
    return refused(
      before.state === "MERGED" ? "mergeRefusedMerged" : "mergeRefusedClosed",
      `the forge says the pull request is ${before.state}`,
    );
  }
  // **Where it goes is part of what was published** (Codex round 2): a pull
  // request retargeted on the forge keeps its head and its green, and a press
  // made over the old destination approves nothing about the new one. The
  // branch `publish` opened it against is the plan's, as `publishPlanFor`
  // reads it.
  const revisionBase = planField(record, "pull_request_base_branch");
  const opened = revisionBase === "" ? planField(record, "base_branch") : revisionBase;
  if (before.headCommit !== head) {
    return refused(
      "mergeRefusedMoved",
      `the pull request is at '${before.headCommit}', and rondo read '${head}' green`,
    );
  }
  // Its own refusal: nothing rondo reads again would redraw the page for it.
  if (before.baseBranch !== opened) {
    return refused(
      "mergeRefusedRetargeted",
      `the pull request goes into '${before.baseBranch}', and was opened into '${opened}'`,
    );
  }
  if (before.mergeQueue) {
    return refused("mergeRefusedQueue", "the base branch merges through a queue");
  }
  const repo = repositoryOf(url);
  const method: MergeMethodReading =
    repo === null
      ? { kind: "undetermined", reason: `'${url}' names no repository` }
      : await forge.readMergeMethod(repo);
  if (method.kind !== "read") {
    return refused(
      method.kind === "none" ? "mergeRefusedMethod" : "mergeRefusedForge",
      method.kind === "none" ? "the repository allows no merge method" : method.reason,
    );
  }
  const merged = await forge.mergePullRequest({
    url,
    method: method.method,
    headCommit: head,
  });
  const failure = commandFailure(merged);
  if (failure !== null) {
    return { ...refused("mergeRefusedFailed", merged.commandLine), detail: failure };
  }
  // **What the forge says now, and not what the command printed**: a merge
  // queue accepts a merge it has not made, and only the state tells them apart.
  // A report of a merge is for good, so one the forge will not confirm is not
  // written (Codex round 1): the queue may still reject it.
  const after: PullRequestState = await forge.readPullRequest({ url });
  if (after.kind !== "read" || after.state !== "MERGED") {
    return refused(
      "mergeRefusedUnconfirmed",
      after.kind === "read"
        ? `the forge accepted the merge and says ${after.state}`
        : `the forge accepted the merge and did not answer after it: ${after.reason}`,
    );
  }
  // D-0098 rule 5.3: a closing lap's merge says it merged bytes no reviewer
  // read, and which commit the reviewer last read.
  const closing = await ports.store.closingLapOf(record.id);
  const line = await reportToRequest(
    ports,
    record.id,
    {
      kind: "merged",
      pullRequestUrl: url,
      into: before.baseBranch,
      method: method.method,
      mergeCommit: after.mergeCommit,
      notReread: closing,
    },
    ports.now(),
  );
  // Where the forge says it went after the merge, not before: a retarget in
  // between is not something `--match-head-commit` refuses (Codex round 1).
  const released = await releaseMerged(ports, record.id, after.baseBranch, after);
  const closedOut = await closeOutMerged(ports, record.id);
  return {
    ok: true,
    note: [line ?? "merged", released, ...(closedOut === null ? [] : [closedOut])].join("\n"),
  };
}

/** What a close-out reads and writes (D-0119). */
export interface CloseOutPorts {
  readonly store: Pick<IterationStore, "read" | "readingsFor" | "laneLine">;
  readonly record: Pick<AdvisoryRecord, "recordThreadMessage">;
  readonly now: () => number;
  /** Tests replace git; the host reaches the real one. */
  readonly deleteLapBase?: typeof deleteLapBase;
  readonly removeWorkspace: RemoveLapWorkspace;
}

/**
 * `superseded` is a lap another lap of the line replaced (D-0120): its run is
 * closed as `cancelled` first when it is not terminal yet, and the answer
 * names the run it closed.
 */
export type RemoveLapWorkspace = (
  request: RemoveWorkspaceRequest & { readonly superseded: boolean },
) => Promise<WorktreeOutcome & { readonly cancelledRun?: string }>;

/** Who closes a superseded lap's run in continuo's lease row: rondo, not a person (D-0120). */
export const CLOSE_OUT_ACTOR = "rondo/close-out/1";

/**
 * `continuo workspace remove` (continuo D-1119) for the close-out, started on
 * first use as {@link continuoChecksReader} is. Asked once per lap and never
 * retried: a refusal keeps the worktree, and nothing here forces it.
 */
export function continuoWorkspaceRemover(
  environment: Readonly<Record<string, string | undefined>>,
): RemoveLapWorkspace {
  let started: ReturnType<typeof startContinuo> | null = null;
  return async (request) => {
    const kept = (reason: string): WorktreeOutcome => ({
      kind: "kept",
      runId: request.runId,
      reason,
    });
    started ??= startContinuo(environment);
    const startup = await started;
    if (startup.kind === "refused") {
      started = null;
      return kept(`continuo is not usable: ${startup.reason}`);
    }
    const target = { db: request.db, runId: request.runId };
    let cancelled: { cancelledRun?: string } = {};
    // D-0120: a superseded lap's run was never published, so nothing closed
    // it. A run show that does not answer leaves the removal to say why.
    if (request.superseded) {
      const shown = await showRun(startup.continuo, target);
      if (shown.kind === "answered" && !RUN_CLOSE_OUTCOMES.includes(shown.payload.status)) {
        const closed = await closeRun(startup.continuo, {
          ...target,
          outcome: "cancelled",
          actorId: CLOSE_OUT_ACTOR,
        });
        if (closed.kind !== "answered") {
          return kept(`its run was not closed: ${reasonOf(closed)}`);
        }
        cancelled = { cancelledRun: request.runId };
      }
    }
    const result = await removeWorkspace(startup.continuo, target);
    if (result.kind !== "answered") {
      return { ...kept(reasonOf(result)), ...cancelled };
    }
    return {
      kind: result.payload.outcome === "absent" ? "absent" : "removed",
      workspace: result.payload.workspace,
      ...cancelled,
    };
  };
}

function reasonOf(result: Exclude<ContinuoResult<unknown>, { kind: "answered" }>): string {
  switch (result.kind) {
    case "refused":
      return result.message;
    case "refusedInProse":
      return result.text;
    default:
      return result.reason;
  }
}

/**
 * **The close-out after a merge** (rondo#403, D-0119), run by whichever of the
 * two paths wrote the merge line: the press above, or the checks host reading
 * a merge made on the forge. It deletes every `rondo/base/<runId>` its line's
 * laps were cut from -- rondo's own refs (D-0100), holding nobody's commits --
 * and says in the thread what it deleted, what git refused, and what it keeps:
 * the topic branch. Then it asks continuo to remove each lap's worktree
 * (rondo#456, continuo D-1119) and says which went and which continuo kept,
 * with why, closing a superseded lap's run as `cancelled` first (rondo#457,
 * D-0120). A close without a merge closes nothing out.
 *
 * ponytail: run once, right after the merge line; a host stopped between the
 * two leaves the branches and worktrees for the person, and a retry sweep is the upgrade if
 * that is ever seen.
 */
export async function closeOutMerged(
  ports: CloseOutPorts,
  iterationId: string,
): Promise<string | null> {
  const found = await ports.store.read(iterationId);
  if (found.kind !== "read") {
    return null;
  }
  const line = await ports.store.laneLine(iterationId);
  const laps = line.kind === "read" ? line.line.laps : [found.record];
  const remove = ports.deleteLapBase ?? deleteLapBase;
  const deleted: string[] = [];
  const refused: { branch: string; reason: string }[] = [];
  for (const lap of laps) {
    const repository = planField(lap, "repository");
    if (lap.runId === null || repository === "") {
      continue;
    }
    const outcome = await remove({ repository, runId: lap.runId });
    if (outcome.kind === "deleted") {
      deleted.push(outcome.branch);
    } else if (outcome.kind === "refused") {
      refused.push({ branch: outcome.branch, reason: outcome.reason });
    }
  }
  // After the base refs, and only for a lap continuo ran: a lap with no run
  // never had a worktree. Superseded is a lap another lap of the line
  // replaced; a sibling tip nothing replaced may still be published, so its
  // run is left open (D-0120).
  const replaced = new Set(laps.map((lap) => lap.supersedesIterationId));
  const worktrees: WorktreeOutcome[] = [];
  const cancelled: string[] = [];
  for (const lap of laps) {
    const db = planField(lap, "db");
    if (lap.runId !== null && db !== "") {
      const { cancelledRun, ...outcome } = await ports.removeWorkspace({
        db,
        runId: lap.runId,
        superseded: lap.id !== iterationId && replaced.has(lap.id),
      });
      worktrees.push(outcome);
      if (cancelledRun !== undefined) {
        cancelled.push(cancelledRun);
      }
    }
  }
  return await reportToRequest(
    ports,
    iterationId,
    {
      kind: "closedOut",
      deleted,
      refused,
      worktrees,
      cancelled,
      topicBranch: found.record.topicBranch ?? planField(found.record, "topic_branch"),
    },
    ports.now(),
  );
}

/**
 * **A merge rondo made and the forge confirmed is the landing** (rondo#439):
 * the line's files are released at once, with the merge commit as its landing
 * basis (`first_landed`, D-0098 rule 1.1), and not left to the tree reading of
 * D-0073 rule 7 -- which never reads a squash as landed once a later change on
 * the default branch touched the same files. Only into the default branch, and
 * only where the merged lap is the line's one closed tip with nothing in
 * flight: any other line is still owed the tree reading, or the person's
 * release press. A line that gave its paths up when its pull request opened
 * (D-0114) gets its landing row here, over the publish's. Said for the
 * terminal; the merge stands either way.
 */
async function releaseMerged(
  ports: MergePorts,
  iterationId: string,
  into: string,
  after: Extract<PullRequestState, { kind: "read" }>,
): Promise<string> {
  const kept = (why: string) => `Its files were not released on the merge: ${why}.`;
  if (after.mergeCommit === null) {
    return kept("the forge named no merge commit");
  }
  if (after.defaultBranch !== into) {
    return kept(`it went into '${into}', and the default branch is '${after.defaultBranch}'`);
  }
  const outcome = await releaseOnlyTip(ports.store, iterationId, ports.now(), {
    landed: true,
    bases: [
      { form: "iteration", iterationId },
      { form: "landing", branch: into, commit: after.mergeCommit },
    ],
  });
  return outcome === null
    ? `Its files were released: the merge is its landing on '${into}'.`
    : kept(outcome);
}

/**
 * **Opening the pull request gives the line's files up** (D-0114, rondo#441):
 * the claim protects two lines working at once, and from here the forge's
 * conflict reading and the checks cover what is left. The row carries a
 * `published` basis, so the line keeps its decision-record numbers and is
 * still owed its landing: the merge press, the landing reading or the
 * person's press writes the row that ends it (`first_landed`, D-0098 rule
 * 1.1, unchanged). Only where the published lap is the line's one closed tip
 * with nothing in flight, as {@link releaseMerged}. Said for the terminal;
 * the pull request stands either way.
 */
export async function releasePublished(
  store: Pick<IterationStore, "laneLine" | "releaseLane">,
  iterationId: string,
  pullRequestUrl: string | null,
  nowMs: number,
): Promise<string> {
  const outcome = await releaseOnlyTip(store, iterationId, nowMs, {
    landed: false,
    bases: [
      { form: "iteration", iterationId },
      { form: "published", ...(pullRequestUrl === null ? {} : { pullRequestUrl }) },
    ],
  });
  return outcome === null
    ? "Its files were released: its pull request is open."
    : `Its files were not released on the publish: ${outcome}.`;
}

/** Release a line whose one closed tip is `iterationId`; null when released, else why not. */
async function releaseOnlyTip(
  store: Pick<IterationStore, "laneLine" | "releaseLane">,
  iterationId: string,
  nowMs: number,
  release: { readonly landed: boolean; readonly bases: readonly JsonValue[] },
): Promise<string | null> {
  const read = await store.laneLine(iterationId);
  if (read.kind !== "read") {
    return read.kind === "defect" ? read.reason : "its line is not in this store";
  }
  const { line } = read;
  const shape = lineShape(
    line.laps.map((lap) => ({
      id: lap.id,
      status: lap.status,
      supersedesIterationId: lap.supersedesIterationId,
    })),
  );
  if (shape.inFlight || shape.closedTips.join() !== iterationId) {
    return "its line has another lap, which the landing reading still reads";
  }
  const outcome = await store.releaseLane({
    iterationId,
    takenOver: { claimId: line.claim?.claimId ?? null, lapIds: line.laps.map((lap) => lap.id) },
    ...release,
    authorKind: "drafter",
    authorId: LANE_LEDGER_AUTHOR,
    nowMs,
  });
  return outcome.kind === "released" ? null : outcome.reason;
}

function refused(why: MergeRefusal, note: string): Merged {
  return { ok: false, why, note: `nothing was merged: ${note}` };
}

/** The lap's own reading of the commit it pushed, or null where it has none. */
function tipOf(readings: Awaited<ReturnType<IterationStore["readingsFor"]>>): string | null {
  const tip = latestReading(readings, isDeterministicReadingDrafter)?.evidence?.tipCommit;
  return tip === undefined || tip === null || tip === "" ? null : tip;
}

/** `HOST/OWNER/NAME` off a pull request's address, or null where it is not one. */
export function repositoryOf(url: string): string | null {
  const read = /^https?:\/\/([^/\s]+)\/([^/\s]+)\/([^/\s]+)\/pull\/\d+\/?$/.exec(url);
  return read === null ? null : `${read[1]}/${read[2]}/${read[3]}`;
}

function commandFailure(outcome: CommandOutcome): string | null {
  if (outcome.spawnError !== null) {
    return outcome.spawnError;
  }
  return outcome.status === 0 ? null : outcome.stderr.trim();
}
