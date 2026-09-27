/**
 * The flow picker (D-0128, rondo#466): which goal-ranked candidate rondo
 * would inject next, or why it waits. One case per rule.
 */
import { expect, test } from "vitest";

import {
  type FlowInput,
  type Injection,
  type InjectionState,
  pickNext,
} from "../../src/advisory/flow.js";
import type { Ranked, TriagePayload } from "../../src/advisory/triage.js";

const issue = (number: number, openPoints = 0): Ranked => ({
  key: `issue:o/r#${String(number)}`,
  clause: 1,
  request: `do #${String(number)}`,
  why: "why",
  openPoints: Array.from({ length: openPoints }, () => ({ point: "p", recommendation: "r" })),
  source: { form: "issue", repository: "o/r", number },
  title: `issue ${String(number)}`,
  labels: [],
});

const stopped: Ranked = {
  ...issue(0),
  key: "stopped:request-1",
  source: { form: "stopped", iterationId: "it-1", requestMessageId: "request-1" },
};

const triage = (ranked: Ranked[], unavailable: string | null = null): TriagePayload => ({
  repository: "o/r",
  goalId: "goal-1",
  ranked,
  withheld: [],
  read: { issues: ranked.length, stopped: 0 },
  unavailable,
});

const injection = (number: number, state: InjectionState): Injection => ({
  candidateKey: `issue:o/r#${String(number)}`,
  messageId: `flow-sd-1-issue:o/r#${String(number)}`,
  state,
});

const input = (over: Partial<FlowInput> = {}): FlowInput => ({
  scopeDecisionId: "sd-1",
  goal: { goalId: "goal-1" },
  triage: triage([issue(1), issue(2)]),
  putAside: [],
  injections: [],
  occupancy: { occupying: 0, live: 0 },
  bounds: { maxOccupying: 1, maxLive: 3 },
  ownOpenAsk: false,
  ...over,
});

const picked = (over: Partial<FlowInput> = {}) => {
  const pick = pickNext(input(over));
  return pick.kind === "inject" ? pick.candidate.key : pick.reason;
};

test("it injects the first ranked candidate under a deterministic id", () => {
  expect(pickNext(input())).toEqual({
    kind: "inject",
    candidate: issue(1),
    messageId: "flow-sd-1-issue:o/r#1",
  });
});

test("it takes only an issue with no open points, not put aside and not injected before", () => {
  expect(
    picked({
      triage: triage([stopped, issue(1, 1), issue(2), issue(3), issue(4)]),
      putAside: ["issue:o/r#2"],
      injections: [injection(3, "closed")],
    }),
  ).toBe("issue:o/r#4");
});

test("nothing eligible waits", () => {
  expect(picked({ triage: triage([stopped, issue(1, 2)]) })).toBe("nothing_eligible");
  expect(picked({ triage: triage([]) })).toBe("nothing_eligible");
});

test("nothing eligible says each candidate it passed over, and why (rondo#488)", () => {
  expect(
    pickNext(
      input({
        triage: triage([stopped, issue(1, 1), issue(2), issue(3)]),
        putAside: ["issue:o/r#2"],
        injections: [injection(3, "closed")],
      }),
    ),
  ).toEqual({
    kind: "wait",
    reason: "nothing_eligible",
    skipped: [
      { key: "stopped:request-1", request: "do #0", why: "not_issue" },
      { key: "issue:o/r#1", request: "do #1", why: "open_points" },
      { key: "issue:o/r#2", request: "do #2", why: "put_aside" },
      { key: "issue:o/r#3", request: "do #3", why: "started" },
    ],
  });
});

test("no goal, no triage, a stale triage or an unavailable one waits", () => {
  expect(picked({ goal: null })).toBe("no_goal");
  expect(picked({ triage: null })).toBe("no_triage");
  expect(picked({ goal: { goalId: "goal-2" } })).toBe("stale_triage");
  expect(picked({ triage: triage([issue(1)], "the model did not answer") })).toBe(
    "triage_unavailable",
  );
});

test("an earlier injection still drafting or waiting to start holds the flow; a running one does not", () => {
  expect(picked({ injections: [injection(9, "drafting")] })).toBe("injection_pending");
  expect(picked({ injections: [injection(9, "waiting_to_start")] })).toBe("injection_pending");
  expect(picked({ injections: [injection(9, "running")] })).toBe("issue:o/r#1");
});

test("an open ask on the flow's own requests holds it; a free slot is required", () => {
  expect(picked({ ownOpenAsk: true })).toBe("open_ask");
  expect(picked({ occupancy: { occupying: 1, live: 1 } })).toBe("no_slot");
  expect(picked({ occupancy: { occupying: 0, live: 3 } })).toBe("no_slot");
});

test("two consecutive ended injections failed or abandoned stop the flow", () => {
  const ended = (...states: InjectionState[]) =>
    picked({ injections: states.map((state, at) => injection(10 + at, state)) });
  expect(ended("failed", "abandoned")).toBe("failed_twice");
  expect(ended("failed", "running", "failed")).toBe("failed_twice");
  expect(ended("failed", "closed", "failed")).toBe("issue:o/r#1");
  expect(ended("failed")).toBe("issue:o/r#1");
  expect(ended("failed", "failed", "closed")).toBe("issue:o/r#1");
});
