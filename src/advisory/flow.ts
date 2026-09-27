/**
 * Which goal-ranked candidate rondo would inject next, in one repository
 * (D-0128, rondo#466): the flow's pure half.
 *
 * A flow keeps work moving by asking for the goal's next request itself. This
 * module only says what it would ask for, or why it waits: nothing here is
 * wired, nothing is written, and nothing reads a clock, a file or the store.
 * The material arrives gathered, as it does for triage (D-0097).
 *
 * **It never ranks.** The order is the latest triage proposal's
 * (`rankTriage`); the picker takes the first ranked candidate it may
 * inject, and waits rather than reaching past the proposal when there is none.
 *
 * **Nothing here is a sentence** (D-0055 rules 3 and 12): a wait says its
 * reason as a kind, and the words for it live in the wording catalogues.
 */
import type { Occupancy } from "../store/records.js";

import type { Ranked, TriagePayload } from "./triage.js";

/** Where one earlier injection of this flow stands. */
export type InjectionState =
  /** Its request was sent and no plan is drafted yet. */
  | "drafting"
  /** Its plan is drafted and it has not started: a person has not answered, or no slot was free. */
  | "waiting_to_start"
  | "running"
  | "closed"
  | "failed"
  | "abandoned";

/** One request this flow injected earlier. */
export interface Injection {
  readonly candidateKey: string;
  readonly messageId: string;
  readonly state: InjectionState;
}

export interface FlowInput {
  /** The scope decision the flow runs under: it names every injection's id. */
  readonly scopeDecisionId: string;
  /** The newest goal of the repository (D-0097 point 2.1 (a)), or null when none was written. */
  readonly goal: { readonly goalId: string } | null;
  /** The latest triage proposal's payload, or null when there is none. */
  readonly triage: TriagePayload | null;
  /** Candidate keys a person put aside with *not now*, read after the proposal was. */
  readonly putAside: readonly string[];
  /** This flow's earlier injections, oldest first. */
  readonly injections: readonly Injection[];
  readonly occupancy: Occupancy;
  /** The admission bounds the occupancy is counted against (D-0023). */
  readonly bounds: { readonly maxOccupying: number; readonly maxLive: number };
  /**
   * Whether an open ask stands in the thread of one of this flow's own
   * requests. A wait on the person elsewhere does not hold the flow back.
   */
  readonly ownOpenAsk: boolean;
  /**
   * The asks over open points this flow's goal raised (rondo#487), under any
   * approval of it: an answered one carries the person's answers, in the
   * order of the points it asked.
   */
  readonly asks: readonly FlowAsked[];
}

/** One ask over a candidate's open points, and the answers once given. */
export interface FlowAsked {
  readonly candidateKey: string;
  /** The points as asked: the ranking may say them differently by the time they are answered. */
  readonly points: readonly string[];
  readonly answers: readonly string[] | null;
}

/** One open point as the person answered it. */
export interface Answered {
  readonly point: string;
  readonly answer: string;
}

export type WaitReason =
  | "no_goal"
  | "no_triage"
  /** The proposal was ranked against a goal that is no longer the newest. */
  | "stale_triage"
  | "triage_unavailable"
  /** The last two injections that ended, ended `failed` or `abandoned`. */
  | "failed_twice"
  | "injection_pending"
  | "open_ask"
  /** An ask over a candidate's open points waits on the person: not a failure (rondo#487). */
  | "points_asked"
  | "no_slot"
  | "nothing_eligible";

export type FlowPick =
  | {
      readonly kind: "inject";
      readonly candidate: Ranked;
      readonly messageId: string;
      /** The person's answers to its open points; empty when it had none. */
      readonly answers: readonly Answered[];
    }
  /** The candidate has open points nobody answered: ask them first (rondo#487). */
  | { readonly kind: "ask"; readonly candidate: Ranked; readonly askId: string }
  | { readonly kind: "wait"; readonly reason: WaitReason };

/** How many injected lines in a row may end `failed` or `abandoned` before the flow stops. */
export const FAILURES_TO_STOP = 2;

/** The request id an injection is sent under: the same pick always names the same message. */
export function flowMessageId(scopeDecisionId: string, candidateKey: string): string {
  return `flow-${scopeDecisionId}-${candidateKey}`;
}

/**
 * The id an ask over a candidate's open points is raised under: the `round`th
 * ask over that candidate, so the same pick names the same ask, and points the
 * ranking added since an answer are asked again under the next round.
 */
export function flowAskId(scopeDecisionId: string, candidateKey: string, round: number): string {
  return `flow-ask-${scopeDecisionId}-${candidateKey}-${String(round)}`;
}

/** What the flow would inject next, or why it waits. */
export function pickNext(input: FlowInput): FlowPick {
  const wait = (reason: WaitReason): FlowPick => ({ kind: "wait", reason });
  if (input.goal === null) {
    return wait("no_goal");
  }
  if (input.triage === null) {
    return wait("no_triage");
  }
  if (input.triage.goalId !== input.goal.goalId) {
    return wait("stale_triage");
  }
  if (input.triage.unavailable !== null) {
    return wait("triage_unavailable");
  }
  const ended = input.injections.filter(
    (one) => one.state === "closed" || one.state === "failed" || one.state === "abandoned",
  );
  const last = ended.slice(-FAILURES_TO_STOP);
  if (
    last.length === FAILURES_TO_STOP &&
    last.every((one) => one.state === "failed" || one.state === "abandoned")
  ) {
    return wait("failed_twice");
  }
  if (
    input.injections.some((one) => one.state === "drafting" || one.state === "waiting_to_start")
  ) {
    return wait("injection_pending");
  }
  if (input.ownOpenAsk) {
    return wait("open_ask");
  }
  const aside = new Set(input.putAside);
  // **One ask at a time** (rondo#487): an unanswered one holds the flow while
  // its candidate is still ranked and not put aside; *not now* is a way to
  // decline it.
  const ranked = new Set(input.triage.ranked.map((one) => one.key));
  if (
    input.asks.some(
      (ask) => ask.answers === null && ranked.has(ask.candidateKey) && !aside.has(ask.candidateKey),
    )
  ) {
    return wait("points_asked");
  }
  if (
    input.occupancy.occupying >= input.bounds.maxOccupying ||
    input.occupancy.live >= input.bounds.maxLive
  ) {
    return wait("no_slot");
  }
  const injected = new Set(input.injections.map((one) => one.candidateKey));
  const candidate = input.triage.ranked.find(
    (one) => one.source.form === "issue" && !aside.has(one.key) && !injected.has(one.key),
  );
  if (candidate === undefined) {
    return wait("nothing_eligible");
  }
  // An answer counts when it answered every point the ranking holds now: a
  // re-ranking can add a point nobody was asked.
  const asked = input.asks.filter((ask) => ask.candidateKey === candidate.key);
  const answered = asked.findLast(
    (ask) =>
      ask.answers !== null && candidate.openPoints.every((one) => ask.points.includes(one.point)),
  );
  if (candidate.openPoints.length > 0 && answered === undefined) {
    return {
      kind: "ask",
      candidate,
      askId: flowAskId(input.scopeDecisionId, candidate.key, asked.length + 1),
    };
  }
  return {
    kind: "inject",
    candidate,
    messageId: flowMessageId(input.scopeDecisionId, candidate.key),
    answers:
      answered?.points.map((point, at) => ({ point, answer: answered.answers?.[at] ?? "" })) ?? [],
  };
}
