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
  pullRequestIn,
  readChecks,
  readingOf,
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
}): Promise<{
  readonly written: readonly Recorded[];
  readonly asked: number;
  /** Which lap each call was about, in order. */
  readonly askedIds: readonly string[];
}> {
  const written: Recorded[] = [];
  const askedIds: string[] = [];
  const messages = options.messageIds.map((messageId) => ({
    messageId,
    // A publish report prints its pull request's address; lap-N opened #N.
    body: messageId.startsWith("report-published-lap-")
      ? `Opened https://github.com/owner/name/pull/${messageId.slice("report-published-lap-".length)}.`
      : "",
    authorKind: "drafter" as const,
    authorId: "rondo/deterministic",
    inReplyTo: "request-1",
    atMs: 1,
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
            plan: { db: "/state/control.db" },
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
    },
    record: {
      threadMessages: async () => ({ kind: "read", messages }) as never,
      recordThreadMessage: async (draft) => {
        written.push({ messageId: draft.messageId, body: draft.body });
        return { kind: "recorded" } as never;
      },
    },
    readChecks: async (request) => {
      const id = `lap-${String(request.number)}`;
      askedIds.push(id);
      return { reading: options.readings?.[id] ?? options.reading, head: `head-of-${id}` };
    },
    host: "github.com",
    now: () => 2,
    log: () => {},
  });
  for (let tick = 0; tick < (options.passes ?? 1); tick += 1) {
    host.kick();
    await host.idle();
  }
  return { written, asked: askedIds.length, askedIds };
}

test("a published lap whose line still holds is read, and its answer is one message", async () => {
  const over = await hostOver({
    reading: { kind: "red", failed: ["build"], cancelled: [], timedOut: [] },
    messageIds: ["request-1", "report-published-lap-1"],
  });
  expect(over.asked).toBe(1);
  expect(over.written).toHaveLength(1);
  expect(over.written[0]?.messageId).toBe("report-checks-lap-1-red");
  // Every answer says rondo did nothing else with the pull request.
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

test("a lap with an answer already is not asked again", async () => {
  const over = await hostOver({
    reading: { kind: "green", counted: 1, skipped: 0 },
    messageIds: ["request-1", "report-published-lap-1", "report-checks-lap-1-red"],
  });
  expect(over).toMatchObject({ written: [], asked: 0 });
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
