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
  asks: [],
  ...over,
});

const picked = (over: Partial<FlowInput> = {}) => {
  const pick = pickNext(input(over));
  return pick.kind === "wait" ? pick.reason : `${pick.kind} ${pick.candidate.key}`;
};

test("it injects the first ranked candidate under a deterministic id", () => {
  expect(pickNext(input())).toEqual({
    kind: "inject",
    candidate: issue(1),
    messageId: "flow-sd-1-issue:o/r#1",
    answers: [],
  });
});

test("it takes only an issue not put aside and not injected before", () => {
  expect(
    picked({
      triage: triage([stopped, issue(2), issue(3), issue(4)]),
      putAside: ["issue:o/r#2"],
      injections: [injection(3, "closed")],
    }),
  ).toBe("inject issue:o/r#4");
});

test("nothing eligible waits", () => {
  expect(picked({ triage: triage([stopped]) })).toBe("nothing_eligible");
  expect(picked({ triage: triage([]) })).toBe("nothing_eligible");
});

test("a candidate with open points is asked first, then injected with the answers (rondo#487)", () => {
  const asked = (answers: string[] | null) => [
    { candidateKey: "issue:o/r#1", points: ["p", "p"], answers },
  ];
  expect(pickNext(input({ triage: triage([issue(1, 2), issue(2)]) }))).toEqual({
    kind: "ask",
    candidate: issue(1, 2),
    askId: "flow-ask-sd-1-issue:o/r#1-1",
  });
  // An open ask holds the flow, and no second one is raised.
  expect(picked({ triage: triage([issue(1, 2), issue(2)]), asks: asked(null) })).toBe(
    "points_asked",
  );
  expect(pickNext(input({ triage: triage([issue(1, 2)]), asks: asked(["a", "b"]) }))).toEqual({
    kind: "inject",
    candidate: issue(1, 2),
    messageId: "flow-sd-1-issue:o/r#1",
    answers: [
      { point: "p", answer: "a" },
      { point: "p", answer: "b" },
    ],
  });
  // Put aside, or gone from the ranking, the ask holds nothing.
  expect(
    picked({
      triage: triage([issue(1, 2), issue(2)]),
      asks: asked(null),
      putAside: ["issue:o/r#1"],
    }),
  ).toBe("inject issue:o/r#2");
  expect(picked({ triage: triage([issue(2)]), asks: asked(null) })).toBe("inject issue:o/r#2");
});

test("an answer stands when a re-ranking words its points differently, and goes in as asked (rondo#504)", () => {
  const reranked: Ranked = {
    ...issue(1),
    openPoints: [
      { point: "p1", recommendation: "r" },
      { point: "p3", recommendation: "r" },
    ],
  };
  const answered = [{ candidateKey: "issue:o/r#1", points: ["p1", "p2"], answers: ["a", "b"] }];
  expect(pickNext(input({ triage: triage([reranked]), asks: answered }))).toEqual({
    kind: "inject",
    candidate: reranked,
    messageId: "flow-sd-1-issue:o/r#1",
    answers: [
      { point: "p1", answer: "a" },
      { point: "p2", answer: "b" },
    ],
  });
  // An ask over it left open after an earlier answer does not hold it; the newest answer is sent.
  const later = [
    ...answered,
    { candidateKey: "issue:o/r#1", points: ["p3"], answers: ["c"] },
    { candidateKey: "issue:o/r#1", points: ["p4"], answers: null },
  ];
  expect(pickNext(input({ triage: triage([reranked]), asks: later }))).toMatchObject({
    kind: "inject",
    answers: [{ point: "p3", answer: "c" }],
  });
});

test("an open ask still holds a candidate with no open points: only an answered one passes it (rondo#504)", () => {
  const open = [{ candidateKey: "issue:o/r#2", points: ["p"], answers: null }];
  expect(picked({ triage: triage([issue(1), issue(2, 1)]), asks: open })).toBe("points_asked");
});

test("ask, re-rank, answer: the answered candidate injects before the ranking's first is asked (rondo#504)", () => {
  // Asked over #1; a re-ranking put #2 first before the person answered.
  const answered = [{ candidateKey: "issue:o/r#1", points: ["p", "p"], answers: ["a", "b"] }];
  expect(pickNext(input({ triage: triage([issue(2, 1), issue(1, 2)]), asks: answered }))).toEqual({
    kind: "inject",
    candidate: issue(1, 2),
    messageId: "flow-sd-1-issue:o/r#1",
    answers: [
      { point: "p", answer: "a" },
      { point: "p", answer: "b" },
    ],
  });
  // A second ask over #2 still open does not hold the answered one back.
  const both = [...answered, { candidateKey: "issue:o/r#2", points: ["p"], answers: null }];
  expect(picked({ triage: triage([issue(2, 1), issue(1, 2)]), asks: both })).toBe(
    "inject issue:o/r#1",
  );
  // It waits for a slot rather than asking another candidate meanwhile.
  expect(
    picked({
      triage: triage([issue(2, 1), issue(1, 2)]),
      asks: answered,
      occupancy: { occupying: 1, live: 1 },
    }),
  ).toBe("no_slot");
  // Injected, put aside or gone from the ranking, the answer no longer leads.
  expect(
    picked({
      triage: triage([issue(2, 1), issue(1, 2)]),
      asks: answered,
      injections: [injection(1, "running")],
    }),
  ).toBe("ask issue:o/r#2");
  expect(
    picked({
      triage: triage([issue(2, 1), issue(1, 2)]),
      asks: answered,
      putAside: ["issue:o/r#1"],
    }),
  ).toBe("ask issue:o/r#2");
  expect(picked({ triage: triage([issue(2, 1)]), asks: answered })).toBe("ask issue:o/r#2");
  // An ask over #1 left open once #1 started holds nothing.
  expect(
    picked({
      triage: triage([issue(2, 1), issue(1, 2)]),
      asks: [...answered, { candidateKey: "issue:o/r#1", points: ["p"], answers: null }],
      injections: [injection(1, "running")],
    }),
  ).toBe("ask issue:o/r#2");
});

test("nothing eligible says each candidate it passed over, and why (rondo#488)", () => {
  expect(
    pickNext(
      input({
        triage: triage([stopped, issue(2), issue(3)]),
        putAside: ["issue:o/r#2"],
        injections: [injection(3, "closed")],
      }),
    ),
  ).toEqual({
    kind: "wait",
    reason: "nothing_eligible",
    skipped: [
      { key: "stopped:request-1", request: "do #0", why: "not_issue" },
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
  expect(picked({ injections: [injection(9, "running")] })).toBe("inject issue:o/r#1");
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
  expect(ended("failed", "closed", "failed")).toBe("inject issue:o/r#1");
  expect(ended("failed")).toBe("inject issue:o/r#1");
  expect(ended("failed", "failed", "closed")).toBe("inject issue:o/r#1");
});
