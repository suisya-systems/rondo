/**
 * The merge press (rondo#380, `D-0091`): what it reads again before it asks
 * the forge, what it asks, and what it writes.
 *
 * Unit cases over a fake store and a fake forge; the thread's reports are
 * written by the real writer (`reportToRequest`), so the press reads back the
 * sentences rondo actually records.
 */
import { expect, test } from "vitest";

import { reportToRequest } from "../../src/access/conductor.js";
import {
  type CommandOutcome,
  type MergeMethodReading,
  mergeMethodOf,
  type PullRequestState,
} from "../../src/access/forge.js";
import { mergePress, repositoryOf } from "../../src/access/merge.js";
import type { ThreadMessageDraft } from "../../src/store/records.js";

const PR = "https://github.com/owner/name/pull/372";
const TIP = "abc1234";

interface Options {
  readonly checks?: "green" | "red" | null;
  /** A question from rondo still waiting in the request's thread. */
  readonly asking?: boolean;
  readonly released?: boolean;
  readonly before?: PullRequestState;
  readonly after?: PullRequestState;
  readonly method?: MergeMethodReading;
  readonly outcome?: Partial<CommandOutcome>;
  readonly tip?: string;
  /** Another lap of the same request standing at its gate. */
  readonly gated?: boolean;
  /** The pull request moved to this head after the green (rondo#412). */
  readonly movedTo?: string;
  /** And the moved head was read green. */
  readonly movedGreen?: boolean;
  /** The lap is a closing lap (D-0098 rule 5.3). */
  readonly closing?: boolean;
  /** The laps of the lap's line, root first; lap-1 alone and closed by default. */
  readonly laps?: readonly { id: string; status: string; supersedesIterationId: string | null }[];
}

const open: PullRequestState = {
  kind: "read",
  state: "OPEN",
  headCommit: TIP,
  baseBranch: "main",
  defaultBranch: "main",
  mergeCommit: null,
  mergeQueue: false,
};

async function over(options: Options = {}) {
  const messages: ThreadMessageDraft[] = [
    {
      messageId: "request-1",
      body: "fix #291",
      authorKind: "operator",
      authorId: "ada",
      inReplyTo: null,
      atMs: 1,
      bases: [],
      asks: false,
    } as ThreadMessageDraft,
  ];
  const releases: unknown[] = [];
  const store = {
    laneLine: async () =>
      ({
        kind: "read",
        line: {
          lineageId: "lap-1",
          claim: { claimId: "lap-1:1", paths: ["src/"] },
          laps: (
            options.laps ?? [{ id: "lap-1", status: "closed", supersedesIterationId: null }]
          ).map((lap) => ({
            runId: `run-of-${lap.id}`,
            plan: { repository: "/repo", db: "/state/control.db" },
            ...lap,
          })),
        },
      }) as never,
    releaseLane: async (release: unknown) => {
      releases.push(release);
      return { kind: "released", lineageId: "lap-1" } as never;
    },
    read: async (id: string) =>
      ({
        kind: "read",
        record: {
          id,
          requestMessageId: "request-1",
          runId: "run-1",
          plan: { base_branch: "main" },
        },
      }) as never,
    readingsFor: async () =>
      [
        {
          drafter: "rondo/deterministic/2",
          verdict: "clear",
          findings: [],
          readAtMs: 1,
          evidence: { tipCommit: options.tip ?? TIP },
        },
      ] as never,
    readLive: async () =>
      (options.gated === true
        ? [
            {
              kind: "read",
              record: { id: "lap-2", status: "awaiting_human", requestMessageId: "request-1" },
            },
          ]
        : []) as never,
    laneLedger: async () =>
      [
        { lineageId: "lap-1", lapIds: ["lap-1"], releasedBy: options.released ? "rondo" : null },
      ] as never,
    closingLapOf: async (id: string) =>
      options.closing === true
        ? {
            iterationId: id,
            predecessorId: "lap-0",
            readTipCommit: "f".repeat(40),
            readingReadAtMs: 1,
            findings: [0, 2],
          }
        : null,
  };
  const record = {
    threadMessages: async () => ({ kind: "read", messages }) as never,
    recordThreadMessage: async (draft: ThreadMessageDraft) => {
      messages.push(draft);
      return { kind: "recorded" } as never;
    },
  };
  const thread = { record, store };
  await reportToRequest(thread, "lap-1", { kind: "published", pullRequestUrl: PR }, 2);
  if (options.checks !== null) {
    await reportToRequest(
      thread,
      "lap-1",
      {
        kind: "checks",
        commit: TIP,
        reading:
          options.checks === "red"
            ? { kind: "red", failed: ["build"], cancelled: [], timedOut: [] }
            : { kind: "green", counted: 7, skipped: 1 },
      },
      3,
    );
  }
  if (options.movedTo !== undefined) {
    await reportToRequest(
      thread,
      "lap-1",
      {
        kind: "moved",
        pullRequestUrl: PR,
        from: TIP,
        to: options.movedTo,
        commits: [{ sha: options.movedTo, subject: "resolve the conflict" }],
      },
      5,
    );
    if (options.movedGreen === true) {
      await reportToRequest(
        thread,
        "lap-1",
        {
          kind: "checks",
          commit: options.movedTo,
          reading: { kind: "green", counted: 7, skipped: 0 },
          moved: true,
        },
        6,
      );
    }
  }
  if (options.asking === true) {
    messages.push({
      messageId: "ask-1",
      body: "Which one?",
      authorKind: "drafter",
      authorId: "rondo/model/drafter",
      inReplyTo: "request-1",
      atMs: 4,
      bases: [],
      asks: true,
    } as ThreadMessageDraft);
  }
  const asked: string[] = [];
  const deletedBases: string[] = [];
  const removedRuns: string[] = [];
  const supersededRuns: string[] = [];
  let reads = 0;
  const pressing = new Set<string>();
  const world = { rereads: 0, pressedDuring: [] as string[] };
  const press = mergePress({
    store,
    record,
    now: () => 9,
    pressing,
    deleteLapBase: async ({ runId }) => {
      deletedBases.push(runId);
      return { kind: "deleted", branch: `rondo/base/${runId}` };
    },
    // continuo keeps a run it was never told closed (continuo D-1119); a
    // superseded lap's run is closed first (D-0120).
    removeWorkspace: async ({ runId, superseded }) => {
      removedRuns.push(runId);
      if (superseded) {
        supersededRuns.push(runId);
        return { kind: "removed", workspace: `/wt/${runId}`, cancelledRun: runId };
      }
      return runId === "run-of-lap-1"
        ? { kind: "removed", workspace: `/wt/${runId}` }
        : { kind: "kept", runId, reason: `run ${runId} is at status running; close it first` };
    },
    readAgain: async () => {
      // The press has let go of the lap by now, so the checks host reads it.
      world.pressedDuring.push(...pressing);
      world.rereads += 1;
    },
    forge: {
      readPullRequest: async ({ url }) => {
        asked.push(`view ${url}`);
        reads += 1;
        return reads === 1
          ? (options.before ?? open)
          : (options.after ?? { ...open, state: "MERGED", mergeCommit: "def5678" });
      },
      readMergeMethod: async (repo) => {
        asked.push(`methods ${repo}`);
        world.pressedDuring.push(...pressing);
        return options.method ?? { kind: "read", method: "squash" };
      },
      mergePullRequest: async (request) => {
        asked.push(`merge ${request.url} --${request.method} ${request.headCommit}`);
        return {
          commandLine: "gh pr merge",
          status: 0,
          signal: null,
          stdout: "",
          stderr: "",
          spawnError: null,
          ...options.outcome,
        };
      },
    },
  });
  return { press, asked, messages, world, releases, deletedBases, removedRuns, supersededRuns };
}

const input = { iterationId: "lap-1", head: TIP };

test("a green head with nothing waiting merges by the repository's method and says where it went", async () => {
  const world = await over();
  const merged = await world.press(input);
  expect(merged.ok).toBe(true);
  expect(world.asked).toEqual([
    `view ${PR}`,
    "methods github.com/owner/name",
    `merge ${PR} --squash ${TIP}`,
    `view ${PR}`,
  ]);
  const report = world.messages.find((message) => message.messageId === "report-merged-lap-1");
  expect(report?.body).toBe(
    `Lap 'lap-1' was merged on a person's press on the page: pull request ${PR} went into ` +
      "'main' by squash as commit 'def5678'.",
  );
  expect(report?.inReplyTo).toBe("request-1");
  // D-0119: the press closes the line out, every lap's base branch.
  expect(world.deletedBases).toEqual(["run-of-lap-1"]);
  const closeOut = world.messages.find(
    (message) => message.messageId === "report-closeout-lap-1",
  )?.body;
  expect(closeOut).toContain("deleted 'rondo/base/run-of-lap-1'");
  // rondo#456: and its worktree, through continuo, after the base branch.
  expect(world.removedRuns).toEqual(["run-of-lap-1"]);
  expect(closeOut).toContain("Worktrees: removed '/wt/run-of-lap-1'.");
  expect(merged.ok && merged.note).toContain("report-closeout-lap-1");
});

test("D-0098 rule 5.3: a closing lap's merge says it was not re-read and names what the reviewer last read", async () => {
  const world = await over({ closing: true });
  const merged = await world.press(input);
  expect(merged.ok).toBe(true);
  const report = world.messages.find((message) => message.messageId === "report-merged-lap-1");
  expect(report?.body).toBe(
    `Lap 'lap-1' was merged on a person's press on the page: pull request ${PR} went into ` +
      "'main' by squash as commit 'def5678'. This was the closing lap and it was not re-read: " +
      `the reviewer last read commit '${"f".repeat(40)}', not this one. It answers the ` +
      "finding(s) left below the threshold numbered 1, 3 in that reading.",
  );
});

test("nothing is asked of the forge where the button would not be drawn", async () => {
  for (const [options, why] of [
    [{ checks: null }, "mergeRefusedNotGreen"],
    [{ checks: "red" }, "mergeRefusedNotGreen"],
    [{ asking: true }, "mergeRefusedAsked"],
    [{ gated: true }, "mergeRefusedAsked"],
    [{ released: true }, "mergeRefusedLanded"],
    // The lap pushed another commit than the one rondo read green.
    [{ tip: "fff0000" }, "mergeRefusedMoved"],
  ] as const) {
    const world = await over(options);
    const merged = await world.press(input);
    expect(merged).toMatchObject({ ok: false, why });
    expect(world.asked).toEqual([]);
  }
  // A button drawn for another head is a press about something else.
  const world = await over();
  expect(await world.press({ ...input, head: "0000000" })).toMatchObject({
    why: "mergeRefusedMoved",
  });
  expect(world.asked).toEqual([]);
});

test("a pull request that moved, closed or merged on the forge is not merged again", async () => {
  for (const [before, why] of [
    [{ ...open, headCommit: "fff0000" }, "mergeRefusedMoved"],
    // Retargeted on the forge: the head and its green are the same, the
    // destination is not the one it was published against.
    // Its own refusal (rondo#412): nothing rondo reads again redraws it.
    [{ ...open, baseBranch: "release" }, "mergeRefusedRetargeted"],
    // A queue merges later, not on this press.
    [{ ...open, mergeQueue: true }, "mergeRefusedQueue"],
    [{ ...open, state: "CLOSED" }, "mergeRefusedClosed"],
    [{ ...open, state: "MERGED" }, "mergeRefusedMerged"],
    [{ kind: "undetermined", reason: "rate limited" }, "mergeRefusedForge"],
  ] as const) {
    const world = await over({ before });
    expect(await world.press(input)).toMatchObject({ ok: false, why });
    expect(world.asked.some((line) => line.startsWith("merge "))).toBe(false);
  }
});

test("the forge's refusal is carried as it said it, and nothing is reported merged", async () => {
  const world = await over({
    outcome: { status: 1, stderr: "Pull request is not mergeable: review required\n" },
  });
  const merged = await world.press(input);
  expect(merged).toMatchObject({
    ok: false,
    why: "mergeRefusedFailed",
    detail: "Pull request is not mergeable: review required",
  });
  expect(world.messages.some((message) => message.messageId === "report-merged-lap-1")).toBe(false);
  expect(world.deletedBases).toEqual([]);
});

test("a merge the forge accepted and did not confirm is said as that, and never reported merged", async () => {
  for (const after of [
    { ...open, state: "OPEN" },
    { kind: "undetermined", reason: "timed out" },
  ] as const) {
    const world = await over({ after });
    expect(await world.press(input)).toMatchObject({ ok: false, why: "mergeRefusedUnconfirmed" });
    expect(world.messages.some((message) => message.messageId === "report-merged-lap-1")).toBe(
      false,
    );
  }
});

test("the method is the repository's: the one it allows, else squash, merge, rebase in that order", () => {
  const allows = (squash: boolean, merge: boolean, rebase: boolean) =>
    mergeMethodOf(
      JSON.stringify({
        squashMergeAllowed: squash,
        mergeCommitAllowed: merge,
        rebaseMergeAllowed: rebase,
      }),
    );
  expect(allows(true, false, false)).toEqual({ kind: "read", method: "squash" });
  expect(allows(false, true, false)).toEqual({ kind: "read", method: "merge" });
  expect(allows(false, false, true)).toEqual({ kind: "read", method: "rebase" });
  expect(allows(true, true, true)).toEqual({ kind: "read", method: "squash" });
  expect(allows(false, true, true)).toEqual({ kind: "read", method: "merge" });
  expect(allows(false, false, false)).toEqual({ kind: "none" });
  // A field the forge did not send is not a "no".
  expect(mergeMethodOf(JSON.stringify({ squashMergeAllowed: false }))).toMatchObject({
    kind: "undetermined",
  });
  expect(mergeMethodOf("not json")).toMatchObject({ kind: "undetermined" });
});

test("the repository is read off the address the forge printed", () => {
  expect(repositoryOf(PR)).toBe("github.com/owner/name");
  expect(repositoryOf("https://ghe.example/o/n/pull/9")).toBe("ghe.example/o/n");
  expect(repositoryOf("https://github.com/owner/name/issues/372")).toBeNull();
});

test("a press refused because the head moved has the pull request read again, after it lets go", async () => {
  const world = await over({ before: { ...open, headCommit: "fff0000" } });
  expect(await world.press(input)).toMatchObject({ ok: false, why: "mergeRefusedMoved" });
  expect(world.world.rereads).toBe(1);
  // The lap was in the press's hands while it asked, and not when it re-read.
  expect(world.world.pressedDuring).toEqual([]);
  const other = await over({ before: { ...open, baseBranch: "release" } });
  await other.press(input);
  expect(other.world.rereads).toBe(0);
});

test("while a press is in flight the checks host is told to leave the lap alone", async () => {
  const world = await over();
  expect((await world.press(input)).ok).toBe(true);
  expect(world.world.pressedDuring).toEqual(["lap-1"]);
});

test("a head the page showed as moved, and read green there, is merged by that head (D-0102)", async () => {
  const moved = "fff0000";
  const world = await over({
    movedTo: moved,
    movedGreen: true,
    before: { ...open, headCommit: moved },
  });
  expect((await world.press({ iterationId: "lap-1", head: moved })).ok).toBe(true);
  expect(world.asked).toContain(`merge ${PR} --squash ${moved}`);
});

test("a moved head is not merged on the green of the head the lap pushed", async () => {
  // Moved, and nothing read on the new head yet: the old green is not its.
  const pending = await over({ movedTo: "fff0000", before: { ...open, headCommit: "fff0000" } });
  expect(await pending.press(input)).toMatchObject({ ok: false, why: "mergeRefusedNotGreen" });
  expect(await pending.press({ iterationId: "lap-1", head: "fff0000" })).toMatchObject({
    ok: false,
    why: "mergeRefusedNotGreen",
  });
  // A head nobody showed the person is not one a press can name.
  const unshown = await over({ before: { ...open, headCommit: "fff0000" } });
  expect(await unshown.press({ iterationId: "lap-1", head: "fff0000" })).toMatchObject({
    ok: false,
    why: "mergeRefusedMoved",
  });
  expect(pending.asked.concat(unshown.asked).some((line) => line.startsWith("merge "))).toBe(false);
});

test("rondo#439: a merge into the default branch is the line's landing, and its files are released at once", async () => {
  const world = await over();
  const merged = await world.press(input);
  expect(merged.ok).toBe(true);
  expect(world.releases).toEqual([
    {
      iterationId: "lap-1",
      takenOver: { claimId: "lap-1:1", lapIds: ["lap-1"] },
      landed: true,
      authorKind: "drafter",
      authorId: "rondo/lane-ledger/1",
      bases: [
        { form: "iteration", iterationId: "lap-1" },
        { form: "landing", branch: "main", commit: "def5678" },
      ],
      nowMs: 9,
    },
  ]);
  expect(merged.note).toContain("Its files were released");
});

test("rondo#439: a merge that is not the line's whole landing leaves its files to the landing reading", async () => {
  for (const options of [
    // Into a branch that is not the default one: not a landing (D-0073 rule 6).
    {
      before: { ...open, defaultBranch: "trunk" },
      after: { ...open, state: "MERGED", defaultBranch: "trunk", mergeCommit: "def5678" },
    },
    // Retargeted off the default branch during the merge: where it went is the after's.
    { after: { ...open, state: "MERGED", baseBranch: "release", mergeCommit: "def5678" } },
    // Another lap of the line is still running.
    {
      laps: [
        { id: "lap-1", status: "closed", supersedesIterationId: null },
        { id: "lap-2", status: "running", supersedesIterationId: "lap-1" },
      ],
    },
    // Another closed tip of the line is owed its own landing.
    {
      laps: [
        { id: "lap-0", status: "closed", supersedesIterationId: null },
        { id: "lap-1", status: "closed", supersedesIterationId: "lap-0" },
        { id: "lap-3", status: "closed", supersedesIterationId: "lap-0" },
      ],
    },
  ] as const) {
    const world = await over(options as Options);
    const merged = await world.press(input);
    expect(merged.ok).toBe(true);
    expect(world.releases).toEqual([]);
    expect(merged.note).toContain("Its files were not released on the merge");
  }
});

test("rondo#456: every lap's worktree is asked for once, and one continuo keeps is said with why", async () => {
  // lap-3 is a second tip nothing replaced: it may still be published, so its
  // run is not rondo's to close and continuo keeps its worktree.
  const world = await over({
    laps: [
      { id: "lap-0", status: "closed", supersedesIterationId: null },
      { id: "lap-1", status: "closed", supersedesIterationId: "lap-0" },
      { id: "lap-3", status: "closed", supersedesIterationId: "lap-0" },
    ],
  });
  const merged = await world.press(input);
  expect(merged.ok).toBe(true);
  // Once each, and never again with force: a kept worktree stays kept.
  expect(world.removedRuns).toEqual(["run-of-lap-0", "run-of-lap-1", "run-of-lap-3"]);
  expect(
    world.messages.find((message) => message.messageId === "report-closeout-lap-1")?.body,
  ).toContain(
    "Worktrees: removed '/wt/run-of-lap-0'; removed '/wt/run-of-lap-1'; kept for run " +
      "'run-of-lap-3': run run-of-lap-3 is at status running; close it first.",
  );
});

test("rondo#457: only a lap another lap of the line replaced has its run closed, and the thread names it", async () => {
  const world = await over({
    laps: [
      { id: "lap-0", status: "closed", supersedesIterationId: null },
      { id: "lap-1", status: "closed", supersedesIterationId: "lap-0" },
      { id: "lap-3", status: "closed", supersedesIterationId: "lap-0" },
    ],
  });
  expect((await world.press(input)).ok).toBe(true);
  // Not the merged lap, whose run publish closed, and not the sibling tip.
  expect(world.supersededRuns).toEqual(["run-of-lap-0"]);
  expect(
    world.messages.find((message) => message.messageId === "report-closeout-lap-1")?.body,
  ).toContain("rondo closed the run of its superseded lap as cancelled: 'run-of-lap-0'.");
});
