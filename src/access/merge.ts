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

import { lineShape } from "../store/lanes.js";
import { isDeterministicReadingDrafter, latestReading, planField } from "../store/records.js";
import { type AdvisoryRecord, type IterationStore, LANE_LEDGER_AUTHOR } from "../store/sqlite.js";
import { reportToRequest } from "./conductor.js";
import {
  type CommandOutcome,
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
  return { ok: true, note: [line ?? "merged", released].join("\n") };
}

/**
 * **A merge rondo made and the forge confirmed is the landing** (rondo#439):
 * the line's files are released at once, with the merge commit as its landing
 * basis (`first_landed`, D-0098 rule 1.1), and not left to the tree reading of
 * D-0073 rule 7 -- which never reads a squash as landed once a later change on
 * the default branch touched the same files. Only into the default branch, and
 * only where the merged lap is the line's one closed tip with nothing in
 * flight: any other line is still owed the tree reading, or the person's
 * release press. Said for the terminal; the merge stands either way.
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
  const read = await ports.store.laneLine(iterationId);
  if (read.kind !== "read") {
    return kept(read.kind === "defect" ? read.reason : "its line is not in this store");
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
    return kept("its line has another lap, which the landing reading still reads");
  }
  const outcome = await ports.store.releaseLane({
    iterationId,
    takenOver: { claimId: line.claim?.claimId ?? null, lapIds: line.laps.map((lap) => lap.id) },
    landed: true,
    authorKind: "drafter",
    authorId: LANE_LEDGER_AUTHOR,
    bases: [
      { form: "iteration", iterationId },
      { form: "landing", branch: into, commit: after.mergeCommit },
    ],
    nowMs: ports.now(),
  });
  return outcome.kind === "released"
    ? `Its files were released: the merge is its landing on '${into}'.`
    : kept(outcome.reason);
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
