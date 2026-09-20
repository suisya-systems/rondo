/**
 * What a commit's checks come to (rondo#310): the join over the two forge
 * documents, and the window the host reads them in.
 *
 * Unit cases, because both are total functions over values -- `joinChecks` over
 * what `gh` printed, `checksHost` over rows a fake store holds. The `GET`s
 * themselves are `readChecks`'s and are not exercised here.
 */
import { expect, test } from "vitest";

import { checksHost } from "../../src/access/checks-host.js";
import { type ChecksReading, joinChecks } from "../../src/access/forge.js";

/** A combined-status document with the given contexts. */
function status(...statuses: readonly { context: string; state: string }[]): string {
  return JSON.stringify({ state: "whatever", total_count: statuses.length, statuses });
}

/** A check-runs document with the given runs. */
function runs(
  ...check_runs: readonly { name: string; status: string; conclusion: string | null }[]
): string {
  return JSON.stringify({ total_count: check_runs.length, check_runs });
}

test("a commit nobody reported a check for is 'none', and not green", () => {
  expect(joinChecks(status(), runs())).toEqual({ kind: "none" });
});

test("both documents are read, so a check run cannot hide behind a green status", () => {
  expect(
    joinChecks(
      status({ context: "ci/lint", state: "success" }),
      runs({ name: "build", status: "completed", conclusion: "failure" }),
    ),
  ).toEqual({ kind: "red", failed: ["build"] });
});

test("a failure outranks a run still going", () => {
  expect(
    joinChecks(
      status({ context: "ci/lint", state: "failure" }),
      runs({ name: "build", status: "in_progress", conclusion: null }),
    ),
  ).toEqual({ kind: "red", failed: ["ci/lint"] });
});

test("a run that is not finished is pending whatever conclusion it carries", () => {
  expect(
    joinChecks(status(), runs({ name: "build", status: "queued", conclusion: "success" })),
  ).toEqual({ kind: "pending", pending: ["build"] });
});

test("neutral and skipped are checks that ran and asked for nothing", () => {
  expect(
    joinChecks(
      status({ context: "ci/lint", state: "success" }),
      runs(
        { name: "optional", status: "completed", conclusion: "neutral" },
        { name: "unchanged", status: "completed", conclusion: "skipped" },
      ),
    ),
  ).toEqual({ kind: "green", counted: 3 });
});

test("a conclusion this does not know the name of is never green", () => {
  expect(
    joinChecks(status(), runs({ name: "build", status: "completed", conclusion: "cancelled" })),
  ).toEqual({ kind: "red", failed: ["build"] });
});

test("a page the forge counted and did not send is undetermined, and never a green", () => {
  // 31 check runs on the commit, 30 in hand: the failure is on the page that
  // did not arrive, so this must not report green (Codex round 1, P1).
  const short = JSON.stringify({
    total_count: 31,
    check_runs: Array.from({ length: 30 }, (_, at) => ({
      name: `ci-${String(at)}`,
      status: "completed",
      conclusion: "success",
    })),
  });
  expect(joinChecks(status(), short)).toMatchObject({ kind: "undetermined" });
});

test("every page is read, so a failure on the second one is still a red", () => {
  const pages = JSON.stringify([
    { total_count: 2, check_runs: [{ name: "one", status: "completed", conclusion: "success" }] },
    { total_count: 2, check_runs: [{ name: "two", status: "completed", conclusion: "failure" }] },
  ]);
  expect(joinChecks(status(), pages)).toEqual({ kind: "red", failed: ["two"] });
});

test("an answer that is not the shape expected is undetermined, and not 'none'", () => {
  expect(joinChecks("not json at all", runs())).toMatchObject({ kind: "undetermined" });
  expect(joinChecks(JSON.stringify({ state: "success" }), runs())).toMatchObject({
    kind: "undetermined",
  });
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
}): Promise<{ readonly written: readonly Recorded[]; readonly asked: number }> {
  const written: Recorded[] = [];
  let asked = 0;
  const messages = options.messageIds.map((messageId) => ({
    messageId,
    body: "",
    authorKind: "drafter" as const,
    authorId: "rondo/deterministic",
    inReplyTo: "request-1",
    atMs: 1,
    bases: [],
    asks: false,
  }));
  const host = checksHost({
    store: {
      read: async () =>
        ({
          kind: "read",
          record: { id: "lap-1", requestMessageId: "request-1", runId: "run-1", plan: "{}" },
        }) as never,
      readingsFor: async () =>
        [
          {
            drafter: "rondo/deterministic/2",
            verdict: "clear",
            findings: [],
            readAtMs: 1,
            evidence: { tipCommit: "c0ffee" },
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
    readChecks: async () => {
      asked += 1;
      return options.reading;
    },
    repository: () => "owner/name",
    host: "github.com",
    now: () => 2,
    log: () => {},
  });
  host.kick();
  await host.idle();
  return { written, asked };
}

test("a published lap whose line still holds is read, and its answer is one message", async () => {
  const over = await hostOver({
    reading: { kind: "red", failed: ["build"] },
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
    reading: { kind: "green", counted: 1 },
    messageIds: ["request-1"],
  });
  expect(over).toEqual({ written: [], asked: 0 });
});

test("a lap with an answer already is not asked again", async () => {
  const over = await hostOver({
    reading: { kind: "green", counted: 1 },
    messageIds: ["request-1", "report-published-lap-1", "report-checks-lap-1-red"],
  });
  expect(over).toEqual({ written: [], asked: 0 });
});

test("a line the ledger has released is out of the window", async () => {
  const over = await hostOver({
    reading: { kind: "green", counted: 1 },
    messageIds: ["request-1", "report-published-lap-1"],
    releasedBy: "rondo",
  });
  expect(over).toEqual({ written: [], asked: 0 });
});

test("a 'none' said once does not close the reading: a check registered later is still read", async () => {
  // The forge cannot tell "no check yet" from "no check ever", and a publish is
  // read seconds after the push, so closing on `none` would leave the pull
  // request this exists for unread (Codex round 1, P1).
  const after = await hostOver({
    reading: { kind: "red", failed: ["build"] },
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
  expect(over).toEqual({ written: [], asked: 1 });
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
