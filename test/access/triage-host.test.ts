/**
 * What rondo would ask for next, in the resident host (D-0097 points 2.4 (a),
 * 4.1 (d), 4.5 (a) and 6 (a)), over a real store, a fake `gh` and a fake
 * `claude`.
 *
 * What is held: nothing is read before a goal is kept; a reading is one
 * proposal row, and a rescan over the same material spends nothing; a *not
 * now* is kept beside the proposal, is refused for a candidate the proposal
 * did not name, and takes that candidate out of the next reading; a failed
 * forge read writes no row, because "no issues" would propose from the rest.
 */
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";
import type { CommandOutcome } from "../../src/access/forge.js";
import { type TriageHostPorts, triageHost } from "../../src/access/triage-host.js";
import { readTriagePayload } from "../../src/advisory/triage.js";
import { advisoryRecord } from "../../src/store/sqlite.js";

const REPO = "o/r";

const listed = (issues: { number: number; title: string; labels: string[] }[]): CommandOutcome => ({
  commandLine: "gh api repos/o/r/issues",
  status: 0,
  signal: null,
  stdout: issues.map((one) => JSON.stringify(one)).join("\n"),
  stderr: "",
  spawnError: null,
});

function world(issues: () => CommandOutcome, answer: "answered" | "failed" = "answered") {
  const clock = { ms: 10_000 };
  const record = advisoryRecord(new DatabaseSync(":memory:"));
  const handed: string[] = [];
  const logged: string[] = [];
  let n = 0;
  const ports: TriageHostPorts = {
    store: { terminalIterations: async () => [], readLive: async () => [] },
    record,
    repositories: async () => [REPO],
    listIssues: async () => await Promise.resolve(issues()),
    runDrafter: async (_row, document) => {
      handed.push(document);
      if (answer === "failed") {
        return await Promise.resolve({ kind: "failed" as const, reason: "claude -p exited 1" });
      }
      const keys = [...document.matchAll(/key: (\S+)/g)].map((match) => match[1]);
      return await Promise.resolve({
        kind: "answered" as const,
        costUsd: 0.02,
        finalMessage: JSON.stringify({
          candidates: keys.map((key) => ({
            key,
            clause: 1,
            request: `Fix ${String(key)} in o/r`,
            why: "A terminal is required today.",
            openPoints: [],
          })),
        }),
      });
    },
    forgeHost: null,
    now: () => clock.ms,
    mintId: () => {
      n += 1;
      return `triage-${String(n)}`;
    },
    language: null,
    log: (line) => logged.push(line),
  };
  return { record, host: triageHost(ports), handed, logged, clock };
}

const goal = {
  goalId: "goal-1",
  repository: REPO,
  clauses: [{ said: "they never open a terminal", unmetIf: "a terminal is ever required" }],
  writtenBy: "ada",
  writtenAtMs: 1_000,
};

test("nothing is read before a goal is kept, and once kept one reading is one row", async () => {
  const w = world(() => listed([{ number: 7, title: "setup asks for a shell", labels: [] }]));
  w.host.kick();
  await w.host.idle();
  expect(w.handed).toEqual([]);
  expect(await w.record.latestTriage()).toEqual([]);

  expect(await w.record.recordGoal(goal)).toEqual({ kind: "recorded" });
  w.host.kick();
  await w.host.idle();
  const [row] = await w.record.latestTriage();
  expect(row?.repository).toBe(REPO);
  const payload = readTriagePayload(row?.payload ?? {});
  expect(payload?.ranked.map((one) => one.key)).toEqual(["issue:o/r#7"]);
  expect(row?.snapshot["cost_usd"]).toBe(0.02);

  // The same material again: no second run, no second row.
  w.host.kick();
  await w.host.idle();
  expect(w.handed).toHaveLength(1);
  expect(await w.record.latestTriage()).toHaveLength(1);
});

test("a not now is kept only for a candidate the proposal named, and the next reading withholds it", async () => {
  const w = world(() =>
    listed([
      { number: 7, title: "setup asks for a shell", labels: [] },
      { number: 8, title: "a word nobody knows", labels: ["priority:high"] },
    ]),
  );
  await w.record.recordGoal(goal);
  w.host.kick();
  await w.host.idle();
  const [first] = await w.record.latestTriage();
  const proposalId = first?.proposalId ?? "";
  const refused = await w.record.recordTriageDecline({
    declineId: "d-0",
    proposalId,
    candidate: "issue:o/r#99",
    declinedBy: "ada",
    declinedAtMs: 2_000,
  });
  expect(refused.kind).toBe("refused");
  expect(
    await w.record.recordTriageDecline({
      declineId: "d-1",
      proposalId,
      candidate: "issue:o/r#8",
      declinedBy: "ada",
      declinedAtMs: 2_000,
    }),
  ).toEqual({ kind: "recorded" });
  expect((await w.record.triageDeclines()).map((one) => one.repository)).toEqual([REPO]);

  w.host.kick();
  await w.host.idle();
  expect(w.handed).toHaveLength(2);
  expect(w.handed[1]).not.toContain("key: issue:o/r#8");
  const [second] = await w.record.latestTriage();
  const payload = readTriagePayload(second?.payload ?? {});
  expect(payload?.ranked.map((one) => one.key)).toEqual(["issue:o/r#7"]);
  expect(payload?.withheld).toEqual([{ key: "issue:o/r#8", why: "put_aside" }]);
});

test("a failed forge read writes no row: it is not 'no issues'", async () => {
  const w = world(() => ({ ...listed([]), status: 1, stderr: "HTTP 502" }));
  await w.record.recordGoal(goal);
  w.host.kick();
  await w.host.idle();
  expect(await w.record.latestTriage()).toEqual([]);
  expect(w.logged.join("\n")).toContain("the open issues could not be read");
});

test("a goal row is refused without a clause, and the newest row of a repository is its goal", async () => {
  const w = world(() => listed([]));
  expect((await w.record.recordGoal({ ...goal, clauses: [] })).kind).toBe("refused");
  await w.record.recordGoal(goal);
  await w.record.recordGoal({ ...goal, goalId: "goal-2", writtenAtMs: 5_000 });
  expect((await w.record.recordGoal(goal)).kind).toBe("refused");
  expect((await w.record.goals()).map((one) => one.goalId)).toEqual(["goal-1", "goal-2"]);
});

test("a reading that came to nothing is read again after an hour, not on the next scan", async () => {
  const w = world(
    () => listed([{ number: 7, title: "setup asks for a shell", labels: [] }]),
    "failed",
  );
  await w.record.recordGoal(goal);
  w.host.kick();
  await w.host.idle();
  const [row] = await w.record.latestTriage();
  expect(readTriagePayload(row?.payload ?? {})?.unavailable).toBe("claude -p exited 1");
  w.clock.ms += 59 * 60 * 1000;
  w.host.kick();
  await w.host.idle();
  expect(w.handed).toHaveLength(1);
  w.clock.ms += 2 * 60 * 1000;
  w.host.kick();
  await w.host.idle();
  expect(w.handed).toHaveLength(2);
});
