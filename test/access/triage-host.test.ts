/**
 * What rondo would ask for next, in the resident host (D-0097 points 2.4 (a),
 * 4.1 (d), 4.5 (a) and 6 (a)), over a real store, a fake `gh` and a fake
 * `claude`.
 *
 * What is held: nothing is read before a goal is kept; a reading is one
 * proposal row, and a rescan over the same material spends nothing; a *not
 * now* is kept beside the proposal, is refused for a candidate the proposal
 * did not name, and takes that candidate out of the next reading; a failed
 * forge read writes no row, because "no issues" would propose from the rest;
 * a request no lap was started for is read once its thread has gone quiet; an
 * accepted decision entry with open residual rows is one candidate.
 */
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";
import type { CommandOutcome } from "../../src/access/forge.js";
import {
  type DecisionRecordRead,
  decisionResiduals,
  type TriageHostPorts,
  triageHost,
} from "../../src/access/triage-host.js";
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

function world(
  issues: () => CommandOutcome,
  answer: "answered" | "failed" = "answered",
  /** The request line drafted for a key on the `call`th run, and the operator's language. */
  drafting: {
    readonly request: (key: string, call: number) => string;
    readonly language: string;
  } = {
    request: (key) => `Fix ${key} in o/r`,
    language: "",
  },
  /** The request ids the store holds a lap for. */
  lapped: readonly string[] = [],
  extra: Partial<TriageHostPorts> = {},
) {
  const clock = { ms: 10_000 };
  const record = advisoryRecord(new DatabaseSync(":memory:"));
  const handed: string[] = [];
  const logged: string[] = [];
  let n = 0;
  const ports: TriageHostPorts = {
    store: {
      terminalIterations: async () =>
        await Promise.resolve(
          lapped.map((id) => ({
            kind: "read" as const,
            record: {
              id: `lap-${id}`,
              requestMessageId: id,
              status: "merged",
              updatedAtMs: 1,
              plan: {},
              request: "",
            } as never,
          })),
        ),
      readLive: async () => await Promise.resolve([]),
    },
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
            request: drafting.request(String(key), handed.length),
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
    language: drafting.language === "" ? null : drafting.language,
    log: (line) => logged.push(line),
    ...extra,
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

test("a candidate whose words mix in another script is read once more, and marked if still mixed (rondo#492)", async () => {
  const issues = () =>
    listed([
      { number: 7, title: "the reader drifts", labels: [] },
      { number: 8, title: "setup asks for a shell", labels: [] },
    ]);
  // Lap 18's slip: a Russian word inside a Japanese request line.
  const slipped = "o/r で、読み取りと公開先の репозиторий が食い違う点を直してください。";
  const mended = world(issues, "answered", {
    request: (key, call) =>
      key === "issue:o/r#7" && call === 1 ? slipped : `o/r で ${key} を直してください。`,
    language: "ja",
  });
  await mended.record.recordGoal(goal);
  mended.host.kick();
  await mended.host.idle();
  // Only the slipped candidate is read again, and the second reading is kept.
  expect(mended.handed).toHaveLength(2);
  expect(mended.handed[1]).toContain("key: issue:o/r#7");
  expect(mended.handed[1]).not.toContain("key: issue:o/r#8");
  expect(mended.handed[0]).toContain("in its own script");
  const [row] = await mended.record.latestTriage();
  const payload = readTriagePayload(row?.payload ?? {});
  expect(payload?.ranked.map((one) => [one.key, one.request, one.mixedScript])).toEqual([
    ["issue:o/r#7", "o/r で issue:o/r#7 を直してください。", undefined],
    ["issue:o/r#8", "o/r で issue:o/r#8 を直してください。", undefined],
  ]);
  // Both readings are spent toward the triage's cost.
  expect(row?.snapshot["cost_usd"]).toBe(0.04);

  const still = world(issues, "answered", {
    request: (key) => (key === "issue:o/r#7" ? slipped : `o/r で ${key} を直してください。`),
    language: "ja",
  });
  await still.record.recordGoal(goal);
  still.host.kick();
  await still.host.idle();
  expect(still.handed).toHaveLength(2);
  const [kept] = await still.record.latestTriage();
  // Not mended: shown with its first words and marked, never silently.
  expect(
    readTriagePayload(kept?.payload ?? {})?.ranked.map((one) => [one.request, one.mixedScript]),
  ).toEqual([
    [slipped, true],
    ["o/r で issue:o/r#8 を直してください。", undefined],
  ]);
  expect(still.logged.join("\n")).toContain("1 candidate(s) mixed scripts; 0 mended");
});

test("the drafter is handed the in-force policies by id, and the test for raising a point (D-0193 rule 2)", async () => {
  const w = world(() => listed([{ number: 7, title: "setup asks for a shell", labels: [] }]));
  await w.record.recordGoal(goal);
  w.host.kick();
  await w.host.idle();
  expect(w.handed[0]).toContain('"irreversible"');
  expect(w.handed[0]).not.toContain("standing policies:");
  expect(
    await w.record.recordStandingPolicy({
      policyId: "policy-1",
      body: "Never touch the release workflow",
      authorKind: "operator",
      authorId: "ada",
      bases: [],
      supersedesPolicyId: null,
      createdAtMs: 5_000,
    }),
  ).toEqual({ kind: "recorded" });
  // A policy is material: the next scan reads again, with it named.
  w.host.kick();
  await w.host.idle();
  expect(w.handed).toHaveLength(2);
  expect(w.handed[1]).toContain("- policy-1: Never touch the release workflow");
});

const DAY_MS = 24 * 60 * 60 * 1000;

const said = (messageId: string, body: string, atMs: number, more: object = {}) => ({
  messageId,
  body,
  authorKind: "operator" as const,
  authorId: "ada",
  inReplyTo: null,
  atMs,
  bases: [],
  asks: false,
  ...more,
});

test("a request no lap was started for is read once its thread is a day quiet (rondo#658)", async () => {
  const w = world(() => listed([{ number: 7, title: "setup asks for a shell", labels: [] }]));
  await w.record.recordGoal(goal);
  expect(
    (
      await w.record.recordThreadMessage(
        said("m-1", "Make setup run without a shell\nmore", 10_000),
      )
    ).kind,
  ).toBe("recorded");
  w.host.kick();
  await w.host.idle();
  expect(w.handed[0]).not.toContain("unlapped:");

  w.clock.ms += DAY_MS;
  w.host.kick();
  await w.host.idle();
  // The day passing moves the material, so it is read again with the request in it.
  expect(w.handed).toHaveLength(2);
  expect(w.handed[1]).toContain("key: unlapped:m-1\n  title: Make setup run without a shell");
  const [row] = await w.record.latestTriage();
  const payload = readTriagePayload(row?.payload ?? {});
  expect(payload?.read).toEqual({ issues: 1, stopped: 0, unlapped: 1, residuals: 0 });
  // Its basis is the request itself, a locator a person can follow (D-0032 rule 2).
  expect(payload?.ranked.find((one) => one.key === "unlapped:m-1")?.source).toEqual({
    form: "unlapped",
    requestMessageId: "m-1",
  });
});

test("a request with a lap, one a person stopped and did not ask again, or one still talked about is not left (rondo#658)", async () => {
  const w = world(() => listed([]), "answered", undefined, ["m-lapped"]);
  await w.record.recordGoal(goal);
  for (const draft of [
    said("m-lapped", "Already worked on", 10_000),
    said("m-stopped", "Dropped later", 10_000),
    {
      ...said("ask-1", "Which one?", 11_000),
      authorKind: "drafter" as const,
      authorId: "rondo/deterministic/1",
      inReplyTo: "m-stopped",
      bases: [{ form: "message", messageId: "m-stopped" }],
      asks: true,
    },
    said("m-stop", "Drop it.", 12_000, { inReplyTo: "ask-1", answerOutcome: "stop" }),
    said("m-resumed", "Dropped, then asked again", 1_000),
    {
      ...said("ask-2", "Which one?", 2_000),
      authorKind: "drafter" as const,
      authorId: "rondo/deterministic/1",
      inReplyTo: "m-resumed",
      bases: [{ form: "message", messageId: "m-resumed" }],
      asks: true,
    },
    said("m-stop-2", "Drop it.", 3_000, { inReplyTo: "ask-2", answerOutcome: "stop" }),
    said("m-again", "Do it after all", 4_000, { inReplyTo: "m-resumed" }),
    said("m-talked", "Still being talked about", 10_000),
    said("m-reply", "One more thing", 10_000 + DAY_MS, { inReplyTo: "m-talked" }),
  ]) {
    const outcome = await w.record.recordThreadMessage(draft);
    expect(outcome.kind, JSON.stringify(outcome)).toBe("recorded");
  }
  // Each is kept out by one thing alone: the stopped thread is a day quiet, the talked one is not.
  w.clock.ms = 12_000 + DAY_MS;
  w.host.kick();
  await w.host.idle();
  // Only the request asked for again after its stop is read.
  expect([...(w.handed[0] ?? "").matchAll(/key: (\S+)/g)].map((m) => m[1])).toEqual([
    "unlapped:m-resumed",
  ]);
  const [row] = await w.record.latestTriage();
  expect(readTriagePayload(row?.payload ?? {})?.read).toEqual({
    issues: 0,
    stopped: 0,
    unlapped: 1,
    residuals: 0,
  });
});

const RECORD = [
  "# Decisions",
  "",
  "| ID | Title | Status |",
  "|---|---|---|",
  "| D-0001 | first | accepted |",
  "",
  "## D-0001 — The first",
  "",
  "**Status:** accepted (2026-09-01).",
  "",
  "### Residuals, with who decides",
  "",
  "| Residual | Why not here | Who decides |",
  "|---|---|---|",
  "| A reader for terminal rows | nothing asks yet | a later entry |",
  "| An allocator | done since | the gate *(Annotation:* **answered** — by rondo#1.*)* |",
  "| `--paginate` on the issue list | one page holds them | whoever has more |",
  "",
  "### What would falsify it",
  "",
  "| Falsifier | Read by |",
  "|---|---|",
  "| a person asking twice | nobody |",
  "",
  "## D-0002 — Superseded",
  "",
  "**Status:** superseded by D-0003 (2026-09-02).",
  "",
  "### Residuals",
  "",
  "| Residual | Who |",
  "|---|---|",
  "| left over | a later entry |",
  "",
  "## D-0003 — All answered, or listed",
  "",
  "**Status:** accepted (2026-09-03).",
  "",
  "### Residuals",
  "",
  "| Residual | Who |",
  "|---|---|",
  "| gone | the gate **answered** |",
  "",
  "- a residual written as a list item",
  "",
  "## Appendix",
  "",
  "### Residuals",
  "",
  "| Residual | Who |",
  "|---|---|",
  "| not an entry's | nobody |",
].join("\n");

test("an accepted entry with open residual rows is one candidate, its basis the rows' lines at the commit (rondo#658)", () => {
  expect(decisionResiduals(REPO, "DECISIONS.md", "c0ffee", RECORD)).toEqual([
    {
      key: "residual:D-0001",
      source: {
        form: "residual",
        repository: REPO,
        path: "DECISIONS.md",
        commit: "c0ffee",
        entry: "D-0001",
        lines: { start: 15, end: 17 },
      },
      title: "D-0001 residuals: A reader for terminal rows; `--paginate` on the issue list",
      labels: [],
    },
  ]);
});

test("the residuals of the record a setup names are read, counted and re-read when the record moves (rondo#658)", async () => {
  let record: DecisionRecordRead = { kind: "read", commit: "c0ffee", text: RECORD };
  const asked: { path: string; repo: string }[] = [];
  const w = world(
    () => listed([{ number: 7, title: "setup asks for a shell", labels: [] }]),
    "answered",
    undefined,
    [],
    {
      decisionRecords: async () => await Promise.resolve(new Map([[REPO, "DECISIONS.md"]])),
      readDecisionRecord: async (request) => {
        asked.push({ path: request.path, repo: request.repo });
        return await Promise.resolve(record);
      },
    },
  );
  expect(await w.record.recordGoal(goal)).toEqual({ kind: "recorded" });
  w.host.kick();
  await w.host.idle();
  expect(asked).toEqual([{ path: "DECISIONS.md", repo: REPO }]);
  expect(w.handed[0]).toContain(
    "key: residual:D-0001\n  title: D-0001 residuals: A reader for terminal rows",
  );
  const [row] = await w.record.latestTriage();
  const payload = readTriagePayload(row?.payload ?? {});
  expect(payload?.read).toEqual({ issues: 1, stopped: 0, unlapped: 0, residuals: 1 });
  expect(payload?.ranked.find((one) => one.key === "residual:D-0001")?.source).toMatchObject({
    form: "residual",
    commit: "c0ffee",
    lines: { start: 15, end: 17 },
  });

  // The record moves: a fresh reading re-ranks over it.
  record = { kind: "read", commit: "beef", text: RECORD.replace("| `--paginate`", "| `--all`") };
  w.host.kick(true);
  await w.host.idle();
  expect(w.handed).toHaveLength(2);
  const [moved] = await w.record.latestTriage();
  expect(moved?.proposalId).not.toBe(row?.proposalId);

  // A record that will not read writes nothing, rather than ranking without it.
  record = { kind: "undetermined", reason: "gh api exited 1" };
  w.host.kick(true);
  await w.host.idle();
  expect(w.handed).toHaveLength(2);
  expect((await w.record.latestTriage())[0]?.proposalId).toBe(moved?.proposalId);
  expect(w.logged.join("\n")).toContain("the decision record could not be read (gh api exited 1)");
});
