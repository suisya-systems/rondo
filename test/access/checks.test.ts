/**
 * What a pull request's checks come to (rondo#310, continuo D-1113): the
 * mapping of continuo's `ci show` verdict onto rondo's thread answer, the
 * fetch -> observe -> show sequence, and the window the host reads them in.
 *
 * Unit cases over values: `readingOf` over a `ci show` payload, `readChecks`
 * over fake readers, `checksHost` over rows a fake store holds. The `GET`s
 * themselves are `fetchPullRequestChecks`'s, and the fold is continuo's.
 */
import { expect, test } from "vitest";

import {
  type ChecksReaders,
  type ChecksReading,
  checksHost,
  type FailingCheck,
  failingChecksOf,
  type PullRequestFacts,
  pullRequestFactsOf,
  pullRequestIn,
  readChecks,
  readingOf,
  unfinishedRunsOf,
} from "../../src/access/checks-host.js";
import type { CiScope, CiShown } from "../../src/continuo/protocol.js";

function scope(scopeId: string, verdict: string, detail: string | null = null): CiScope {
  return { checkScope: "check_run", scopeId, verdict, detail };
}

function shown(verdict: string, ...scopes: readonly CiScope[]): CiShown {
  return { headSha: "abc1234", verdict, scopes };
}

test("no_run is 'none', and not green", () => {
  expect(readingOf({ headSha: null, verdict: "no_run", scopes: [] })).toEqual({ kind: "none" });
});

test("passed is green, with skipped and neutral counted apart from a pass", () => {
  expect(
    readingOf(
      shown(
        "passed",
        scope("build", "passed", "success"),
        scope("optional", "passed", "neutral"),
        scope("unchanged", "passed", "skipped"),
      ),
    ),
  ).toEqual({ kind: "green", counted: 3, skipped: 2 });
});

test("pending is not green", () => {
  expect(
    readingOf(shown("pending", scope("lint", "passed", "success"), scope("build", "pending"))),
  ).toEqual({ kind: "pending", pending: ["build"] });
});

test("cancelled and timed_out keep their own names, and are red", () => {
  expect(readingOf(shown("timed_out", scope("e2e", "timed_out", "timed_out")))).toEqual({
    kind: "red",
    failed: [],
    cancelled: [],
    timedOut: ["e2e"],
  });
  expect(
    readingOf(
      shown(
        "failed",
        scope("build", "failed", "failure"),
        scope("deploy", "cancelled", "cancelled"),
        scope("lint", "passed", "success"),
      ),
    ),
  ).toEqual({ kind: "red", failed: ["build"], cancelled: ["deploy"], timedOut: [] });
});

test("indeterminate, or a verdict with no name here, is undetermined and never green", () => {
  expect(readingOf(shown("indeterminate"))).toMatchObject({ kind: "undetermined" });
  expect(readingOf(shown("something-new"))).toMatchObject({ kind: "undetermined" });
});

test("the pull request is named by the address its publish report printed", () => {
  expect(pullRequestIn("Opened https://github.com/o/n/pull/12 against 'main'.")).toEqual({
    url: "https://github.com/o/n/pull/12",
    repo: "o/n",
    number: 12,
  });
  expect(pullRequestIn("no address")).toBeNull();
});

// --- fetch, observe, show ----------------------------------------------------

const REQUEST = { host: null, repo: "o/n", number: 12, db: "/state/control.db" } as const;

function readers(options: {
  readonly fetched?: boolean;
  readonly observed?: boolean;
  readonly calls: string[];
}): ChecksReaders {
  return {
    forge: async () => {
      options.calls.push("fetch");
      return options.fetched === false
        ? { kind: "failed", reason: "the forge said no" }
        : { kind: "fetched", pullRequest: "{}", checkRuns: "[]", status: "[]" };
    },
    observe: async (request) => {
      options.calls.push(`observe ${request.repo}#${String(request.pr)} ${request.db}`);
      return options.observed === false
        ? {
            kind: "refused",
            db: request.db,
            errorClass: "GithubChecksUnreadable",
            message: "short",
          }
        : { kind: "answered", db: request.db, payload: { headSha: "abc1234", observed: 1 } };
    },
    show: async (request) => {
      options.calls.push(`show ${request.repo}#${String(request.pr)}`);
      return {
        kind: "answered",
        db: request.db,
        payload: shown("passed", scope("build", "passed", "success")),
      };
    },
  };
}

test("fetch, observe and show, and the head is ci show's", async () => {
  const calls: string[] = [];
  expect(await readChecks(readers({ calls }), REQUEST)).toEqual({
    reading: { kind: "green", counted: 1, skipped: 0 },
    head: "abc1234",
    pullRequest: null,
    failing: [],
    unfinishedRuns: [],
  });
  expect(calls).toEqual(["fetch", "observe o/n#12 /state/control.db", "show o/n#12"]);
});

test("a fetch that failed is undetermined, and continuo is not asked", async () => {
  const calls: string[] = [];
  const read = await readChecks(readers({ fetched: false, calls }), REQUEST);
  expect(read).toMatchObject({ reading: { kind: "undetermined" }, head: null });
  expect(calls).toEqual(["fetch"]);
});

test("an observe continuo refused is undetermined, and its last verdict is not shown", async () => {
  // continuo wrote nothing (exit 2), so its last verdict is about an earlier
  // fetch; reporting it now would be a reading of nothing (continuo D-1113).
  const calls: string[] = [];
  const read = await readChecks(readers({ observed: false, calls }), REQUEST);
  expect(read).toMatchObject({ reading: { kind: "undetermined" }, head: null });
  expect(calls).toEqual(["fetch", "observe o/n#12 /state/control.db"]);
});

// --- the window the host reads in -------------------------------------------

interface Recorded {
  readonly messageId: string;
  readonly body: string;
}

/**
 * A host over one published lap, with the ledger, the thread and the reading
 * handed in. Returns what it wrote and what it asked the forge.
 */
async function hostOver(options: {
  readonly reading: ChecksReading;
  readonly messageIds: readonly string[];
  readonly releasedBy?: "person" | "rondo" | null;
  /** The laps the ledger's one holding line covers. */
  readonly lapIds?: readonly string[];
  /** A reading for one lap, where it differs from `reading`. */
  readonly readings?: Readonly<Record<string, ChecksReading>>;
  /** How many ticks to run. One by default. */
  readonly passes?: number;
  /** The head the forge reads, where it is not the one the lap pushed. */
  readonly head?: string;
  /** What the pull request's own document said (rondo#411, #413). */
  readonly pullRequest?: PullRequestFacts;
  /** The laps a merge press holds. */
  readonly pressing?: ReadonlySet<string>;
  /** What the forge says on each pass, in order; one pass each. */
  readonly steps?: readonly {
    readonly reading: ChecksReading;
    readonly head?: string;
    readonly pullRequest?: PullRequestFacts;
    readonly failing?: readonly FailingCheck[];
    readonly unfinishedRuns?: readonly number[];
    /** The host's clock on this pass, where it is not `100 * (pass + 1)`. */
    readonly atMs?: number;
  }[];
  /** The failing check runs the forge's document lists (rondo#551). */
  readonly failing?: readonly FailingCheck[];
  readonly unfinishedRuns?: readonly number[];
  /**
   * Given, the host re-runs failed checks (rondo#551): whether the lap's scope
   * allows it, and whether the forge refuses the `POST`.
   */
  readonly rerun?: {
    readonly authorised: boolean;
    /** Every `POST` refused, or only these run ids'. */
    readonly refuse?: boolean | readonly number[];
  };
  /** Run while the forge is being read, as a press starting then would. */
  readonly duringRead?: () => void;
  /** A message's body, where it is not the one the fixture composes. */
  readonly bodies?: Readonly<Record<string, string>>;
  /** Given, the host merges on green (D-0126) through this; its calls are kept. */
  readonly mergeOnGreen?: string | null;
}): Promise<{
  /** Each merge on green asked, as `lap head` (D-0126). */
  readonly mergesAsked: readonly string[];
  /** Each re-run `POST`, as its run id (rondo#551). */
  readonly posts: readonly number[];
  readonly written: readonly Recorded[];
  /** The run ids whose `rondo/base/` branch the close-out deleted (D-0119). */
  readonly deletedBases: readonly string[];
  readonly asked: number;
  /** Which lap each call was about, in order. */
  readonly askedIds: readonly string[];
}> {
  const written: Recorded[] = [];
  const askedIds: string[] = [];
  const deletedBases: string[] = [];
  const mergesAsked: string[] = [];
  const posts: number[] = [];
  let tick = 0;
  let clock = 100;
  const messages: {
    messageId: string;
    body: string;
    authorKind: "drafter";
    authorId: string;
    inReplyTo: string | null;
    atMs: number;
    bases: never[];
    asks: boolean;
  }[] = options.messageIds.map((messageId, at) => ({
    messageId,
    // A publish report prints its pull request's address; lap-N opened #N. An
    // answer names the lap's own head, as the real writer's does.
    body:
      options.bodies?.[messageId] ??
      (messageId.startsWith("report-published-lap-")
        ? `Opened https://github.com/owner/name/pull/${messageId.slice("report-published-lap-".length)}.`
        : messageId.startsWith("report-checks-lap-1-")
          ? "Lap 'lap-1' is read on commit 'commit-of-lap-1'"
          : ""),
    authorKind: "drafter" as const,
    authorId: "rondo/deterministic",
    inReplyTo: "request-1",
    atMs: 1 + at,
    bases: [],
    asks: false,
  }));
  const host = checksHost({
    store: {
      read: async (id) =>
        ({
          kind: "read",
          record: {
            id,
            requestMessageId: "request-1",
            runId: "run-1",
            topicBranch: "rondo/topic",
            plan: { db: "/state/control.db", repository: "/repo" },
          },
        }) as never,
      // The commit is the lap's, so a fake reading can be per lap.
      readingsFor: async (id) =>
        [
          {
            drafter: "rondo/deterministic/2",
            verdict: "clear",
            findings: [],
            readAtMs: 1,
            evidence: { tipCommit: `commit-of-${id}` },
          },
        ] as never,
      laneLedger: async () =>
        [
          {
            lineageId: "lap-1",
            lapIds: options.lapIds ?? ["lap-1"],
            releasedBy: options.releasedBy ?? null,
          },
        ] as never,
      laneLine: async () => ({ kind: "absent" }),
    },
    deleteLapBase: async (request) => {
      deletedBases.push(request.runId);
      return { kind: "deleted", branch: `rondo/base/${request.runId}` };
    },
    removeWorkspace: async (request) => ({ kind: "absent", workspace: `/wt/${request.runId}` }),
    record: {
      threadMessages: async () => ({ kind: "read", messages }) as never,
      recordThreadMessage: async (draft) => {
        written.push({ messageId: draft.messageId, body: draft.body });
        // What is written is read back on the next pass, as the store does.
        messages.push({
          messageId: draft.messageId,
          body: draft.body,
          authorKind: "drafter",
          authorId: "rondo/deterministic",
          inReplyTo: "request-1",
          atMs: clock,
          bases: [],
          asks: false,
        });
        return { kind: "recorded" } as never;
      },
    },
    readChecks: async (request) => {
      const id = `lap-${String(request.number)}`;
      askedIds.push(id);
      options.duringRead?.();
      const step = options.steps?.[tick] ?? options;
      return {
        reading: options.readings?.[id] ?? step.reading,
        head: step.head ?? `commit-of-${id}`,
        pullRequest: step.pullRequest ?? null,
        failing: step.failing ?? options.failing ?? [],
        unfinishedRuns: step.unfinishedRuns ?? options.unfinishedRuns ?? [],
      };
    },
    readCommits: async (request) => ({
      kind: "read",
      commits: [{ sha: request.to, subject: "resolve the conflict" }],
      total: request.to === "many" ? 300 : 1,
    }),
    ...(options.pressing === undefined ? {} : { pressing: options.pressing }),
    ...(options.mergeOnGreen === undefined
      ? {}
      : {
          mergeOnGreen: async (iterationId: string, head: string) => {
            mergesAsked.push(`${iterationId} ${head}`);
            return options.mergeOnGreen ?? null;
          },
        }),
    ...(options.rerun === undefined
      ? {}
      : {
          rerun: {
            authorised: async () => options.rerun?.authorised === true,
            rerunFailedJobs: async (request: { readonly runId: number }) => {
              posts.push(request.runId);
              const refuse = options.rerun?.refuse;
              return refuse === true || (Array.isArray(refuse) && refuse.includes(request.runId))
                ? {
                    kind: "refused" as const,
                    runId: request.runId,
                    reason: "HTTP 403 from the forge",
                  }
                : { kind: "rerun" as const, runId: request.runId };
            },
          },
        }),
    host: "github.com",
    now: () => clock,
    log: () => {},
  });
  for (tick = 0; tick < (options.steps?.length ?? options.passes ?? 1); tick += 1) {
    clock = options.steps?.[tick]?.atMs ?? 100 * (tick + 1);
    host.kick();
    await host.idle();
  }
  return { written, deletedBases, asked: askedIds.length, askedIds, mergesAsked, posts };
}

test("a published lap whose line still holds is read, and its answer is one message", async () => {
  const over = await hostOver({
    reading: { kind: "red", failed: ["build"], cancelled: [], timedOut: [] },
    messageIds: ["request-1", "report-published-lap-1"],
  });
  expect(over.asked).toBe(1);
  expect(over.written).toHaveLength(1);
  expect(over.written[0]?.messageId).toBe("report-checks-lap-1-red");
  // Every answer says what rondo does not do with the pull request.
  expect(over.written[0]?.body).toContain("does not merge");
  expect(over.written[0]?.body).toContain("'build'");
});

test("a lap that was never published is not asked about", async () => {
  const over = await hostOver({
    reading: { kind: "green", counted: 1, skipped: 0 },
    messageIds: ["request-1"],
  });
  expect(over).toMatchObject({ written: [], asked: 0 });
});

test("an answer already written is not written again, and the pull request is still read", async () => {
  // A green or a red no longer ends the reading (rondo#411 to #413): what the
  // forge does to the pull request afterwards is still the page's.
  const over = await hostOver({
    reading: { kind: "red", failed: ["build"], cancelled: [], timedOut: [] },
    messageIds: ["request-1", "report-published-lap-1", "report-checks-lap-1-red"],
  });
  expect(over).toMatchObject({ written: [], asked: 1 });
});

test("a line the ledger has released is out of the window", async () => {
  const over = await hostOver({
    reading: { kind: "green", counted: 1, skipped: 0 },
    messageIds: ["request-1", "report-published-lap-1"],
    releasedBy: "rondo",
  });
  expect(over).toMatchObject({ written: [], asked: 0 });
});

test("a 'none' said once does not close the reading: a check registered later is still read", async () => {
  // The forge cannot tell "no check yet" from "no check ever", and a publish is
  // read seconds after the push, so closing on `none` would leave the pull
  // request this exists for unread (Codex round 1, P1).
  const after = await hostOver({
    reading: { kind: "red", failed: ["build"], cancelled: [], timedOut: [] },
    messageIds: ["request-1", "report-published-lap-1", "report-checks-lap-1-none"],
  });
  expect(after.asked).toBe(1);
  expect(after.written[0]?.messageId).toBe("report-checks-lap-1-red");
});

test("a 'none' is said once and not once a minute", async () => {
  const again = await hostOver({
    reading: { kind: "none" },
    messageIds: ["request-1", "report-published-lap-1", "report-checks-lap-1-none"],
  });
  expect(again.asked).toBe(1);
  expect(again.written).toEqual([]);
});

test("a forge that will not answer ends the pass rather than asking it once per lap", async () => {
  const over = await hostOver({
    reading: { kind: "undetermined", reason: "gh exited 1" },
    messageIds: [
      "request-1",
      "report-published-lap-1",
      "report-published-lap-2",
      "report-published-lap-3",
    ],
    lapIds: ["lap-1", "lap-2", "lap-3"],
  });
  expect(over).toMatchObject({ written: [], asked: 1 });
});

test("a lap whose own reading never determines does not starve the ones behind it", async () => {
  // A halt is not head-of-line blocking: an `undetermined` about one lap --
  // a repository rondo cannot read, a count that never adds up -- would
  // otherwise end every pass at the same lap, for ever (Codex round 2, P1).
  const over = await hostOver({
    reading: { kind: "red", failed: ["build"], cancelled: [], timedOut: [] },
    readings: { "lap-1": { kind: "undetermined", reason: "gh exited 1" } },
    messageIds: [
      "request-1",
      "report-published-lap-1",
      "report-published-lap-2",
      "report-published-lap-3",
    ],
    lapIds: ["lap-1", "lap-2", "lap-3"],
    passes: 2,
  });
  expect(over.askedIds).toEqual(["lap-1", "lap-2", "lap-3", "lap-1"]);
  expect(over.written.map((one) => one.messageId)).toEqual([
    "report-checks-lap-2-red",
    "report-checks-lap-3-red",
  ]);
});

test("pending writes nothing, so the next scan asks again", async () => {
  const over = await hostOver({
    reading: { kind: "pending", pending: ["build"] },
    messageIds: ["request-1", "report-published-lap-1"],
  });
  expect(over.asked).toBe(1);
  expect(over.written).toEqual([]);
});

test("an undetermined reading writes nothing: a forge that will not answer is not a red", async () => {
  const over = await hostOver({
    reading: { kind: "undetermined", reason: "gh exited 1" },
    messageIds: ["request-1", "report-published-lap-1"],
  });
  expect(over.written).toEqual([]);
});

// --- what the forge did to the pull request (rondo#411 to #413) --------------

const OPEN: PullRequestFacts = {
  state: "open",
  conflicting: false,
  base: "main",
  baseCommit: "base123",
  mergedBy: null,
  mergeCommit: null,
};

test("the pull request's document gives its state, its conflict and who merged it", () => {
  const doc = (fields: object) =>
    JSON.stringify({ state: "open", base: { ref: "main", sha: "base123" }, ...fields });
  expect(pullRequestFactsOf(doc({ mergeable: false }))).toEqual({ ...OPEN, conflicting: true });
  // Not worked out yet is not a conflict.
  expect(pullRequestFactsOf(doc({ mergeable: null }))).toEqual(OPEN);
  expect(
    pullRequestFactsOf(
      doc({
        state: "closed",
        merged_at: "2026-09-22T00:00:00Z",
        merged_by: { login: "someone" },
        merge_commit_sha: "m1",
      }),
    ),
  ).toMatchObject({ state: "merged", mergedBy: "someone", mergeCommit: "m1" });
  expect(pullRequestFactsOf(doc({ state: "closed", merged_at: null }))).toMatchObject({
    state: "closed",
    mergedBy: null,
  });
  expect(pullRequestFactsOf("{}")).toBeNull();
  expect(pullRequestFactsOf("not json")).toBeNull();
});

test("a conflict is said once per head, with why no check runs", async () => {
  const over = await hostOver({
    reading: { kind: "none" },
    pullRequest: { ...OPEN, conflicting: true },
    messageIds: ["request-1", "report-published-lap-1"],
  });
  // No answer is written beside it: the runs it would be about are from before.
  expect(over.written.map((one) => one.messageId)).toEqual([
    "report-conflict-lap-1-commit-of-lap-1",
  ]);
  expect(over.written[0]?.body).toContain("runs no checks");
  const again = await hostOver({
    reading: { kind: "none" },
    pullRequest: { ...OPEN, conflicting: true },
    messageIds: ["request-1", "report-published-lap-1"],
    steps: [
      { reading: { kind: "none" }, pullRequest: { ...OPEN, conflicting: true } },
      { reading: { kind: "none" }, pullRequest: { ...OPEN, conflicting: true } },
    ],
  });
  expect(again.written.map((one) => one.messageId)).toEqual([
    "report-conflict-lap-1-commit-of-lap-1",
  ]);
});

test("a head the lap did not push is said with what it carries, and its checks are its own", async () => {
  const over = await hostOver({
    reading: { kind: "green", counted: 1, skipped: 0 },
    head: "fff0000",
    pullRequest: OPEN,
    messageIds: ["request-1", "report-published-lap-1", "report-checks-lap-1-green"],
  });
  expect(over.written.map((one) => one.messageId)).toEqual([
    "report-moved-lap-1-fff0000",
    "report-checks-lap-1-green-fff0000",
  ]);
  expect(over.written[0]?.body).toContain("- 'fff0000' resolve the conflict");
});

test("merged or closed on the forge ends the reading, and only a merge is closed out", async () => {
  const merged = await hostOver({
    reading: { kind: "green", counted: 1, skipped: 0 },
    pullRequest: { ...OPEN, state: "merged", mergedBy: "someone", mergeCommit: "m1" },
    messageIds: ["request-1", "report-published-lap-1"],
  });
  expect(merged.written.map((one) => one.messageId)).toEqual([
    "report-merged-lap-1",
    "report-closeout-lap-1",
  ]);
  expect(merged.written[0]?.body).toContain("by 'someone'");
  // D-0119: rondo's base branch goes and the topic branch stays; rondo#456:
  // the worktree is continuo's to remove, here already gone.
  expect(merged.deletedBases).toEqual(["run-1"]);
  expect(merged.written[1]?.body).toContain("deleted 'rondo/base/run-1'");
  expect(merged.written[1]?.body).toContain("topic branch 'rondo/topic' is kept");
  expect(merged.written[1]?.body).toContain("Worktrees: already gone '/wt/run-1'.");
  const closed = await hostOver({
    reading: { kind: "none" },
    pullRequest: { ...OPEN, state: "closed" },
    messageIds: ["request-1", "report-published-lap-1"],
  });
  expect(closed.written.map((one) => one.messageId)).toEqual(["report-closed-lap-1"]);
  expect(closed.deletedBases).toEqual([]);
  // And the scan leaves the lap alone afterwards.
  for (const ended of ["report-merged-lap-1", "report-closed-lap-1"]) {
    const after = await hostOver({
      reading: { kind: "none" },
      messageIds: ["request-1", "report-published-lap-1", ended],
    });
    expect(after.asked).toBe(0);
  }
});

test("D-0126: a green just written on the lap's own head asks for a merge on green", async () => {
  const green = { kind: "green", counted: 1, skipped: 0 } as const;
  const once = await hostOver({
    reading: green,
    pullRequest: OPEN,
    messageIds: ["request-1", "report-published-lap-1"],
    mergeOnGreen: "merged",
  });
  expect(once.mergesAsked).toEqual(["lap-1 commit-of-lap-1"]);
  // Not on a red, a pending, or a conflict.
  for (const options of [
    { reading: { kind: "red", failed: ["build"], cancelled: [], timedOut: [] } },
    { reading: { kind: "pending", pending: ["build"] } },
    { reading: green, pullRequest: { ...OPEN, conflicting: true } },
  ] as const) {
    const over = await hostOver({
      pullRequest: OPEN,
      messageIds: ["request-1", "report-published-lap-1"],
      mergeOnGreen: "merged",
      ...options,
    });
    expect(over.mergesAsked).toEqual([]);
  }
  // Nor on a head the lap did not push: that is the person's (D-0102).
  const moved = await hostOver({
    reading: green,
    head: "fff0000",
    pullRequest: OPEN,
    messageIds: ["request-1", "report-published-lap-1"],
    mergeOnGreen: "merged",
  });
  expect(moved.mergesAsked).toEqual([]);
});

test("rondo#551: a merge on green is asked again on each scan while the lap's own head reads green", async () => {
  const green = { kind: "green", counted: 1, skipped: 0 } as const;
  const said = ["request-1", "report-published-lap-1", "report-checks-lap-1-green"];
  // A green said before -- a restart, a throw, a deploy since -- with nothing
  // withheld on record, and one withheld on this head or another.
  for (const messageIds of [
    said,
    [...said, "report-withheld-lap-1-commit-of-lap-1-asked-question-ask-1"],
    [...said, "report-withheld-lap-1-0ther00-claim"],
  ]) {
    const again = await hostOver({
      reading: green,
      pullRequest: OPEN,
      messageIds,
      mergeOnGreen: null,
      passes: 2,
    });
    // Nothing new is written: the green stands, and the merge is asked again.
    expect(again.written).toEqual([]);
    expect(again.mergesAsked).toEqual(["lap-1 commit-of-lap-1", "lap-1 commit-of-lap-1"]);
  }
  // Not once the checks are no longer green, and not once the claim on this
  // head is spent: that is the person's press.
  for (const options of [
    {
      reading: { kind: "red", failed: ["build"], cancelled: [], timedOut: [] },
      messageIds: said,
    },
    ...["claim", "mergeRefusedFailed", "mergeRefusedUnconfirmed"].map((token) => ({
      reading: green,
      messageIds: [...said, `report-withheld-lap-1-commit-of-lap-1-${token}`],
    })),
  ] as const) {
    const over = await hostOver({ pullRequest: OPEN, mergeOnGreen: null, ...options });
    expect(over.mergesAsked).toEqual([]);
  }
});

test("a lap a merge press holds is left alone", async () => {
  const over = await hostOver({
    reading: { kind: "green", counted: 1, skipped: 0 },
    pullRequest: { ...OPEN, state: "merged" },
    messageIds: ["request-1", "report-published-lap-1"],
    pressing: new Set(["lap-1"]),
  });
  expect(over).toMatchObject({ written: [], asked: 0 });
});

test("a rerun that flips a head back to an answer already said is said again, so red is not read as green", async () => {
  const over = await hostOver({
    reading: { kind: "red", failed: ["build"], cancelled: [], timedOut: [] },
    messageIds: [
      "request-1",
      "report-published-lap-1",
      "report-checks-lap-1-red",
      "report-checks-lap-1-green",
    ],
  });
  expect(over.written.map((one) => one.messageId)).toEqual(["report-checks-lap-1-red-t100"]);
  // The same answer as the newest is not said again.
  const same = await hostOver({
    reading: { kind: "green", counted: 1, skipped: 0 },
    messageIds: [
      "request-1",
      "report-published-lap-1",
      "report-checks-lap-1-red",
      "report-checks-lap-1-green",
    ],
  });
  expect(same.written).toEqual([]);
});

const GREEN: ChecksReading = { kind: "green", counted: 1, skipped: 0 };

test("a conflict resolved on a head already green is green again, and a conflict that returns is said again", async () => {
  const over = await hostOver({
    reading: GREEN,
    messageIds: ["request-1", "report-published-lap-1"],
    steps: [
      { reading: GREEN, pullRequest: OPEN },
      { reading: GREEN, pullRequest: { ...OPEN, conflicting: true } },
      { reading: GREEN, pullRequest: OPEN },
      { reading: GREEN, pullRequest: { ...OPEN, conflicting: true } },
    ],
  });
  expect(over.written.map((one) => one.messageId)).toEqual([
    "report-checks-lap-1-green",
    "report-conflict-lap-1-commit-of-lap-1",
    "report-checks-lap-1-green-t300",
    "report-conflict-lap-1-commit-of-lap-1-t400",
  ]);
});

test("a branch pushed away and back is said both ways, and back reads as not moved", async () => {
  const over = await hostOver({
    reading: GREEN,
    messageIds: ["request-1", "report-published-lap-1"],
    steps: [
      { reading: GREEN, head: "fff0000" },
      { reading: GREEN },
      { reading: GREEN, head: "fff0000" },
      { reading: GREEN, head: "fff0000" },
    ],
  });
  expect(over.written.map((one) => one.messageId)).toEqual([
    "report-moved-lap-1-fff0000",
    "report-checks-lap-1-green-fff0000",
    "report-moved-lap-1-commit-of-lap-1",
    "report-checks-lap-1-green",
    "report-moved-lap-1-fff0000-t300",
    "report-checks-lap-1-green-fff0000-t300",
  ]);
});

test("a press that starts while the pull request is being read keeps its merge its own", async () => {
  const pressing = new Set<string>();
  const over = await hostOver({
    reading: GREEN,
    pullRequest: { ...OPEN, state: "merged" },
    messageIds: ["request-1", "report-published-lap-1"],
    pressing,
    duringRead: () => pressing.add("lap-1"),
  });
  expect(over).toMatchObject({ written: [], asked: 1 });
});

test("a conflict on a head pushed away and back is said again, and the count is the forge's total (Codex round 3)", async () => {
  const conflicting = { ...OPEN, conflicting: true };
  const over = await hostOver({
    reading: { kind: "none" },
    messageIds: ["request-1", "report-published-lap-1"],
    steps: [
      { reading: { kind: "none" }, pullRequest: conflicting },
      { reading: { kind: "none" }, head: "many", pullRequest: conflicting },
      { reading: { kind: "none" }, pullRequest: conflicting },
    ],
  });
  expect(over.written.map((one) => one.messageId)).toEqual([
    "report-conflict-lap-1-commit-of-lap-1",
    "report-moved-lap-1-many",
    "report-conflict-lap-1-many",
    "report-moved-lap-1-commit-of-lap-1",
    "report-conflict-lap-1-commit-of-lap-1-t300",
  ]);
  // 300 carried, one listed: the rest are counted and not dropped.
  expect(over.written[1]?.body).toContain("300 commit(s) on it are not the lap's");
  expect(over.written[1]?.body).toContain("- and 299 more");
});

test("rondo#417: a pull request a conflict fix was pushed onto is read for the fix, not for the lap it fixed", async () => {
  const over = await hostOver({
    reading: { kind: "green", counted: 1, skipped: 0 },
    messageIds: ["request-1", "report-published-lap-1", "report-published-lap-2"],
    lapIds: ["lap-1", "lap-2"],
    // The push moved the pull request's head to the fix's own tip.
    head: "commit-of-lap-2",
    bodies: {
      "report-published-lap-2":
        "Lap 'lap-2' was published: its commits were pushed onto 'rondo/lap-1', the branch of " +
        "pull request https://github.com/owner/name/pull/1 which stays open, and run 'r' was closed completed.",
    },
  });
  expect(over.asked).toBe(1);
  expect(over.written.map((one) => one.messageId)).toEqual([
    expect.stringMatching(/^report-checks-lap-2-green/),
  ]);
});

// --- rondo#551: the first red on a head re-runs its failed Actions jobs once --

test("rondo#551: failing check runs are read off the forge's document, with the Actions run each is in", () => {
  const job = (run: number, job: number) =>
    `https://github.com/o/n/actions/runs/${String(run)}/job/${String(job)}`;
  const printed = JSON.stringify([
    {
      total_count: 3,
      check_runs: [
        {
          id: 111,
          name: "build",
          status: "completed",
          conclusion: "failure",
          details_url: job(9, 1),
        },
        {
          id: 112,
          name: "lint",
          status: "completed",
          conclusion: "success",
          details_url: job(9, 2),
        },
        {
          id: 113,
          name: "ci/jenkins",
          status: "completed",
          conclusion: "failure",
          details_url: "https://jenkins.example/job/7",
        },
      ],
    },
    {
      total_count: 3,
      check_runs: [
        {
          id: 114,
          name: "slow",
          status: "completed",
          conclusion: "timed_out",
          details_url: job(10, 3),
        },
        {
          id: 115,
          name: "gone",
          status: "completed",
          conclusion: "cancelled",
          details_url: job(10, 4),
        },
        { id: 116, name: "e2e", status: "in_progress", conclusion: null, details_url: job(11, 5) },
      ],
    },
  ]);
  expect(failingChecksOf(printed)).toEqual([
    { checkRunId: 111, runId: 9, name: "build" },
    { checkRunId: 113, runId: null, name: "ci/jenkins" },
    { checkRunId: 114, runId: 10, name: "slow" },
    { checkRunId: 115, runId: 10, name: "gone" },
  ]);
  expect(unfinishedRunsOf(printed)).toEqual([11]);
  // A commit status document has no check runs; nothing unreadable is guessed.
  expect(failingChecksOf(JSON.stringify([{ state: "failure", statuses: [] }]))).toEqual([]);
  expect(failingChecksOf("not json")).toEqual([]);
});

const RED: ChecksReading = { kind: "red", failed: ["build", "lint"], cancelled: [], timedOut: [] };
const FAILING: readonly FailingCheck[] = [
  { checkRunId: 111, runId: 9, name: "build" },
  { checkRunId: 222, runId: 9, name: "lint" },
  { checkRunId: 333, runId: 10, name: "build" },
];
const PUBLISHED = ["request-1", "report-published-lap-1"];

test("rondo#551: a first red under a merge scope re-runs each failed run once, and its stale red is not said again", async () => {
  const over = await hostOver({
    reading: RED,
    pullRequest: OPEN,
    messageIds: PUBLISHED,
    rerun: { authorised: true },
    mergeOnGreen: null,
    steps: [
      { reading: RED, pullRequest: OPEN, failing: FAILING },
      // The forge has not queued new attempts yet: the same runs fail.
      { reading: RED, pullRequest: OPEN, failing: FAILING },
      { reading: { kind: "pending", pending: ["build"] }, pullRequest: OPEN },
      { reading: GREEN, pullRequest: OPEN },
    ],
  });
  expect(over.posts).toEqual([9, 10]);
  expect(over.written.map((one) => one.messageId)).toEqual([
    "report-checks-lap-1-red",
    "report-rerun-lap-1-commit-of-lap-1",
    "report-checks-lap-1-green",
  ]);
  expect(over.written[1]?.body).toContain(
    "rondo re-ran the failed checks 'build', 'lint' of pull request " +
      "https://github.com/owner/name/pull/1 on commit 'commit-of-lap-1' once " +
      "(check runs 111, 222, 333)",
  );
  // Green after the re-run is the merge on green, as ever.
  expect(over.mergesAsked).toEqual(["lap-1 commit-of-lap-1"]);
});

test("rondo#551: still red on new attempts after the re-run is said red again, and not re-run twice", async () => {
  const again = [{ checkRunId: 444, runId: 9, name: "build" }];
  const over = await hostOver({
    reading: RED,
    pullRequest: OPEN,
    messageIds: PUBLISHED,
    rerun: { authorised: true },
    steps: [
      { reading: RED, pullRequest: OPEN, failing: FAILING },
      { reading: RED, pullRequest: OPEN, failing: again },
      { reading: RED, pullRequest: OPEN, failing: again },
    ],
  });
  expect(over.posts).toEqual([9, 10]);
  expect(over.written.map((one) => one.messageId)).toEqual([
    "report-checks-lap-1-red",
    "report-rerun-lap-1-commit-of-lap-1",
    "report-checks-lap-1-red-t200",
  ]);
});

test("rondo#551: a red that is not rondo's to re-run says why once, and is never posted", async () => {
  const cases = [
    {
      // Another app's check has no Actions run.
      options: {
        reading: { ...RED, failed: ["ci/jenkins"] },
        failing: [{ checkRunId: 1, runId: null, name: "ci/jenkins" }],
        rerun: { authorised: true },
      },
      id: "notActions",
      said: "'ci/jenkins' is not a GitHub Actions job",
      posts: [],
    },
    {
      // A commit status is red and no check run failed.
      options: { failing: [], rerun: { authorised: true } },
      id: "notActions",
      said: "'build', 'lint' are not GitHub Actions jobs",
      posts: [],
    },
    {
      options: { failing: FAILING, rerun: { authorised: false } },
      id: "noScope",
      said: "no approved scope of this lap includes merging",
      posts: [],
    },
    {
      options: { failing: FAILING, rerun: { authorised: true, refuse: true } },
      id: "refused",
      said: "the forge refused to re-run workflow run 9: HTTP 403 from the forge",
      posts: [9, 10],
    },
  ] as const;
  for (const one of cases) {
    const over = await hostOver({
      reading: RED,
      pullRequest: OPEN,
      messageIds: PUBLISHED,
      passes: 2,
      ...one.options,
    });
    expect(over.posts).toEqual(one.posts);
    expect(over.written.map((written) => written.messageId)).toEqual([
      "report-checks-lap-1-red",
      `report-rerun-lap-1-commit-of-lap-1-${one.id}`,
    ]);
    expect(over.written[1]?.body).toContain(one.said);
    expect(over.written[1]?.body).toContain("The thread offers the repair");
  }
});

test("rondo#551: a run still going is re-run once it finishes, and a moved head is not rondo's to re-run", async () => {
  const over = await hostOver({
    reading: RED,
    pullRequest: OPEN,
    messageIds: PUBLISHED,
    rerun: { authorised: true },
    steps: [
      { reading: RED, pullRequest: OPEN, failing: FAILING, unfinishedRuns: [10] },
      { reading: RED, pullRequest: OPEN, failing: FAILING },
    ],
  });
  expect(over.posts).toEqual([9, 10]);
  expect(over.written.map((one) => one.messageId)).toEqual([
    "report-checks-lap-1-red",
    "report-rerun-lap-1-commit-of-lap-1",
  ]);
  const moved = await hostOver({
    reading: RED,
    head: "fff0000",
    pullRequest: OPEN,
    messageIds: PUBLISHED,
    failing: FAILING,
    rerun: { authorised: true },
  });
  expect(moved.posts).toEqual([]);
  expect(moved.written.some((one) => one.messageId.startsWith("report-rerun-"))).toBe(false);
});

test("rondo#551: a red commit status beside a failing Actions job is not re-run, and names the status", async () => {
  const over = await hostOver({
    reading: { ...RED, failed: ["build", "lint", "ci/status"] } as ChecksReading,
    pullRequest: OPEN,
    messageIds: PUBLISHED,
    failing: FAILING,
    rerun: { authorised: true },
  });
  expect(over.posts).toEqual([]);
  expect(over.written.map((one) => one.messageId)).toEqual([
    "report-checks-lap-1-red",
    "report-rerun-lap-1-commit-of-lap-1-notActions",
  ]);
  expect(over.written[1]?.body).toContain("'ci/status' is not a GitHub Actions job");
});

test("rondo#551: a re-run the forge takes for some runs and refuses for others ran, and the refused run's red is said", async () => {
  const over = await hostOver({
    reading: RED,
    pullRequest: OPEN,
    messageIds: PUBLISHED,
    rerun: { authorised: true, refuse: [10] },
    steps: [
      { reading: RED, pullRequest: OPEN, failing: FAILING },
      { reading: RED, pullRequest: OPEN, failing: FAILING },
    ],
  });
  expect(over.posts).toEqual([9, 10]);
  expect(over.written.map((one) => one.messageId)).toEqual([
    "report-checks-lap-1-red",
    "report-rerun-lap-1-commit-of-lap-1",
    // Check run 333 was in the refused run, so its red is not the re-run's.
    "report-checks-lap-1-red-t200",
  ]);
  expect(over.written[1]?.body).toContain("(check runs 111, 222)");
  expect(over.written[1]?.body).toContain(
    "The forge refused to re-run workflow run 10: HTTP 403 from the forge.",
  );
});

test("rondo#551: a re-run's red unanswered for half an hour is said red again, and the repair offered", async () => {
  const over = await hostOver({
    reading: RED,
    pullRequest: OPEN,
    messageIds: PUBLISHED,
    rerun: { authorised: true },
    steps: [
      { reading: RED, pullRequest: OPEN, failing: FAILING },
      { reading: RED, pullRequest: OPEN, failing: FAILING, atMs: 200 + 29 * 60 * 1000 },
      { reading: RED, pullRequest: OPEN, failing: FAILING, atMs: 100 + 30 * 60 * 1000 },
    ],
  });
  expect(over.posts).toEqual([9, 10]);
  expect(over.written.map((one) => one.messageId)).toEqual([
    "report-checks-lap-1-red",
    "report-rerun-lap-1-commit-of-lap-1",
    `report-checks-lap-1-red-t${String(100 + 30 * 60 * 1000)}`,
  ]);
});

test("rondo#551: a re-run already on record for this head is not posted again after a restart", async () => {
  const over = await hostOver({
    reading: RED,
    pullRequest: OPEN,
    messageIds: [...PUBLISHED, "report-checks-lap-1-red", "report-rerun-lap-1-commit-of-lap-1"],
    bodies: {
      "report-rerun-lap-1-commit-of-lap-1":
        "Lap 'lap-1' failed its checks, so rondo re-ran the failed checks 'build', 'lint' of " +
        "pull request https://github.com/owner/name/pull/1 on commit 'commit-of-lap-1' once " +
        "(check runs 111, 222, 333).",
    },
    failing: FAILING,
    rerun: { authorised: true },
  });
  expect(over.posts).toEqual([]);
  expect(over.written).toEqual([]);
});

test("rondo#551: a merge refusal only a person or a new head changes is not asked again each scan", async () => {
  const said = ["request-1", "report-published-lap-1", "report-checks-lap-1-green"];
  for (const token of ["mergeRefusedQueue", "mergeRefusedRetargeted", "mergeRefusedMethod"]) {
    const over = await hostOver({
      reading: GREEN,
      pullRequest: OPEN,
      messageIds: [...said, `report-withheld-lap-1-commit-of-lap-1-${token}`],
      mergeOnGreen: null,
    });
    expect(over.mergesAsked).toEqual([]);
  }
  // A transient forge refusal, and an approval replaced before the claim, are.
  for (const token of ["mergeRefusedForge", "scopeChanged"]) {
    const over = await hostOver({
      reading: GREEN,
      pullRequest: OPEN,
      messageIds: [...said, `report-withheld-lap-1-commit-of-lap-1-${token}`],
      mergeOnGreen: null,
    });
    expect(over.mergesAsked).toEqual(["lap-1 commit-of-lap-1"]);
  }
});
