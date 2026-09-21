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
}

const open: PullRequestState = {
  kind: "read",
  state: "OPEN",
  headCommit: TIP,
  baseBranch: "main",
  mergeCommit: null,
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
  const store = {
    read: async (id: string) =>
      ({
        kind: "read",
        record: { id, requestMessageId: "request-1", runId: "run-1", plan: "{}" },
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
            ? { kind: "red", failed: ["build"] }
            : { kind: "green", counted: 7, skipped: 1 },
      },
      3,
    );
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
  let reads = 0;
  const press = mergePress({
    store,
    record,
    now: () => 9,
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
  return { press, asked, messages };
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
