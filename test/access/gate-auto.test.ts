import { describe, expect, test } from "vitest";

import { type GateAutoInput, type GateScope, gateAuto } from "../../src/access/gate-auto.js";
import type { WorkerRuns } from "../../src/access/page-logic/laps.js";
import { JA } from "../../src/access/wording/ja.js";
import { EN } from "../../src/access/wording.js";
import type { FindingSeverity, LapReading, ScopePayload } from "../../src/store/records.js";

const TIP = "b".repeat(40);
const evidence = (tipCommit = TIP) => ({
  baseRef: "origin/main",
  baseCommit: "a".repeat(40),
  tipCommit,
  materialDigest: "sha256:x",
  commitCount: 1,
  fileCount: 1,
});

const checks = (verdict: "clear" | "concerns" = "clear"): LapReading => ({
  iterationId: "i-1",
  readAtMs: 1,
  drafter: "rondo/deterministic/2",
  verdict,
  findings: verdict === "clear" ? [] : ["a binary file was not read"],
  evidence: evidence(),
  unavailableReason: null,
});

const model = (severities: readonly FindingSeverity[], tipCommit = TIP): LapReading => ({
  iterationId: "i-1",
  readAtMs: 2,
  drafter: "rondo/model/1/gpt-6-astra",
  verdict: severities.length === 0 ? "clear" : "concerns",
  findings: severities.map((s) => `a ${s} thing`),
  graded: severities.map((severity) => ({ severity, bases: [], basisResolved: false })),
  evidence: evidence(tipCommit),
  unavailableReason: null,
});

const green: WorkerRuns = {
  kind: "ran",
  last: { index: 4, command: "npm test", passed: 10, failed: 0, skipped: 1, isError: false },
  earlier: 0,
  supersededBy: null,
};

// Only the fields the evaluator reads: the expiry and the review threshold.
const scope = (over: Partial<GateScope> = {}, threshold: FindingSeverity = "major"): GateScope => ({
  outcome: "approved",
  supersededByApproved: false,
  payload: {
    budgets: { expires_at_ms: 10_000, review_rounds: 3 },
    severity_threshold: threshold,
  } as unknown as ScopePayload,
  ...over,
});

const input = (over: Partial<GateAutoInput> = {}): GateAutoInput => ({
  readings: [checks(), model(["minor", "nit"])],
  runs: green,
  repair: null,
  questionOpen: false,
  closing: false,
  scope: scope(),
  nowMs: 5_000,
  ...over,
});

const reasons = (over: Partial<GateAutoInput>) => {
  const auto = gateAuto(input(over));
  return auto.kind === "would_approve" ? [] : auto.reasons.map((r) => r.kind);
};

describe("gateAuto (D-0125)", () => {
  test("would approve: clear checks, no finding at or above major on the same tip, a green run, nothing open", () => {
    expect(gateAuto(input())).toEqual({ kind: "would_approve" });
    expect(EN.gateAuto(gateAuto(input()))).toBe("rondo would approve this automatically.");
  });

  test("each rule sends the gate to the person on its own", () => {
    expect(reasons({ scope: null })).toEqual(["no_scope"]);
    expect(reasons({ scope: scope({ outcome: "declined" }) })).toEqual(["scope_declined"]);
    expect(reasons({ scope: scope({ supersededByApproved: true }) })).toEqual(["scope_superseded"]);
    expect(reasons({ nowMs: 10_000 })).toEqual(["scope_expired"]);
    expect(reasons({ readings: [checks("concerns"), model([])] })).toEqual(["checks_not_clear"]);
    expect(reasons({ readings: [checks()] })).toEqual(["model_pending"]);
    expect(reasons({ readings: [checks(), model([], "c".repeat(40))] })).toEqual(["model_pending"]);
    expect(
      reasons({
        readings: [
          checks(),
          { ...model([]), verdict: "unavailable", evidence: null, unavailableReason: "x" },
        ],
      }),
    ).toEqual(["model_unavailable"]);
    const { graded: _, ...ungraded } = model(["minor"]);
    expect(reasons({ readings: [checks(), ungraded] })).toEqual(["model_ungraded"]);
    expect(reasons({ runs: { kind: "unrecorded" } })).toEqual(["tests_unread"]);
    expect(reasons({ runs: { kind: "none", commandCount: 3 } })).toEqual(["tests_unread"]);
    expect(reasons({ runs: { ...green, last: { ...green.last, failed: 2 } } })).toEqual([
      "tests_failed",
    ]);
    expect(reasons({ runs: { ...green, last: { ...green.last, isError: true } } })).toEqual([
      "tests_errored",
    ]);
    // A failure a later clean test command superseded is not the lap's (rondo#497).
    expect(
      reasons({
        runs: {
          ...green,
          last: { ...green.last, failed: 2, isError: true },
          supersededBy: { index: 9, command: "npm run verify > log 2>&1" },
        },
      }),
    ).toEqual([]);
    expect(reasons({ questionOpen: true })).toEqual(["question_open"]);
    expect(reasons({ closing: true })).toEqual(["closing_lap"]);
  });

  test("the line is min(scope threshold, major): a looser scope still stops at major, a stricter one below it", () => {
    const readings = [checks(), model(["major", "minor"])];
    // A scope that clears only blockers still sends a major to the person.
    const loose = gateAuto(input({ readings, scope: scope({}, "blocker") }));
    expect(loose).toEqual({
      kind: "would_not_approve",
      reasons: [{ kind: "model_raised", counts: [{ severity: "major", count: 1 }] }],
    });
    expect(EN.gateAuto(loose)).toBe("Not approved automatically: 1 major finding.");
    // A scope whose threshold is minor counts the minor too.
    const strict = gateAuto(input({ readings, scope: scope({}, "minor") }));
    expect(strict).toEqual({
      kind: "would_not_approve",
      reasons: [
        {
          kind: "model_raised",
          counts: [
            { severity: "major", count: 1 },
            { severity: "minor", count: 1 },
          ],
        },
      ],
    });
    // With no scope the default threshold (major) is the line.
    expect(gateAuto(input({ readings, scope: null }))).toMatchObject({
      reasons: [{ kind: "no_scope" }, { kind: "model_raised" }],
    });
  });

  test("every reason that holds is said, in the person's language", () => {
    const auto = gateAuto(
      input({
        readings: [checks(), model(["blocker", "major", "major"])],
        runs: { kind: "unrecorded" },
        questionOpen: true,
      }),
    );
    expect(EN.gateAuto(auto)).toBe(
      "Not approved automatically: 1 blocker finding and 2 major findings; " +
        "no test run rondo can read; a question is open.",
    );
    expect(JA.gateAuto(auto)).toBe(
      "自動では承認しません: 阻害 1 件と重大 2 件の指摘、rondo が読み取れるテスト実行がありません、質問が開いています。",
    );
  });

  test("a repair lap (rondo#551) is sent to the person unless it showed the failure and then a pass", () => {
    expect(reasons({ repair: "reproduced" })).toEqual([]);
    expect(reasons({ repair: "notReproduced" })).toEqual(["repair_not_reproduced"]);
    expect(reasons({ repair: "unrecorded" })).toEqual(["repair_not_reproduced"]);
    expect(reasons({ repair: "allSkipped" })).toEqual(["tests_all_skipped"]);
    // A lap that is not a repair is read as it always was.
    expect(reasons({ repair: null })).toEqual([]);
    const auto = gateAuto(input({ repair: "allSkipped" }));
    expect(EN.gateAuto(auto)).toBe(
      "Not approved automatically: every test in the last run was skipped, so it shows nothing.",
    );
    expect(JA.gateAuto(auto)).toBe(
      "自動では承認しません: 最後の実行ではテストがすべてスキップされ、何も確かめていません。",
    );
    expect(EN.gateAuto(gateAuto(input({ repair: "notReproduced" })))).toBe(
      "Not approved automatically: the repair did not show the failing checks fail and then a run that passed.",
    );
  });
});
