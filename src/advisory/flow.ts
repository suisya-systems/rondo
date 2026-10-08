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
  /**
   * The drafter ran over it and wrote no split: its draft was refused, or its
   * run was unavailable (rondo#549). One refused model output is not the
   * request's work, and nothing of the request has run.
   */
  | "draft_refused"
  /** Its plan is drafted and it has not started: a person has not answered, or no slot was free. */
  | "waiting_to_start"
  | "running"
  /**
   * Its latest lap was lost to a restart of rondo (D-0139) and the start again
   * that lap is owed has not been reserved yet (rondo#549). The lap answered
   * nothing, so how the line ends is the successor's to say.
   */
  | "lost"
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
  /** The request line and why as the person answered them (rondo#492), or null: the ranking's. */
  readonly request?: string | null;
  readonly why?: string | null;
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
  /**
   * The last two injections whose work ended, ended `failed` or `abandoned`.
   * A refused draft and a lost lap are not among them (rondo#549): see
   * {@link ENDED}.
   */
  | "failed_twice"
  | "injection_pending"
  | "open_ask"
  /** An ask over a candidate's open points waits on the person: not a failure (rondo#487). */
  | "points_asked"
  | "no_slot"
  | "nothing_eligible";

/**
 * Why a ranked candidate is not one the flow may start by itself (rondo#488).
 * Open points are not a reason: they are asked first (rondo#487).
 */
export type SkipReason = "started" | "put_aside" | "not_issue";

/** One candidate of the ranking the flow passed over, and why. */
export interface Skipped {
  readonly key: string;
  readonly request: string;
  readonly why: SkipReason;
}

export type FlowPick =
  | {
      readonly kind: "inject";
      /** In the person's words where they edited them in the ask (rondo#492). */
      readonly candidate: Ranked;
      readonly messageId: string;
      /** The person's answers to its open points; empty when it had none. */
      readonly answers: readonly Answered[];
    }
  /** The candidate has open points nobody answered: ask them first (rondo#487). */
  | { readonly kind: "ask"; readonly candidate: Ranked; readonly askId: string }
  | { readonly kind: "wait"; readonly reason: Exclude<WaitReason, "nothing_eligible"> }
  /** Every ranked candidate, each with why it is passed over (rondo#488). */
  | {
      readonly kind: "wait";
      readonly reason: "nothing_eligible";
      readonly skipped: readonly Skipped[];
    };

/** How many injected lines in a row may end `failed` or `abandoned` before the flow stops. */
export const FAILURES_TO_STOP = 2;

/**
 * The states in which an injection's **work** ended, and the only ones
 * `failed_twice` counts over (rondo#549).
 *
 * Two states are deliberately not here, because neither is an end the
 * request's work reached:
 *
 *  - `draft_refused` -- one model output rondo refused (`D-0071` rule 7.1) or
 *    could not obtain. No lap of the request ever ran, so there is no work to
 *    call failed; the next move is another draft or a question, not a stop.
 *  - `lost` -- the host restarted and took the lap's driver with it
 *    (`D-0139`). The lap answered nothing and holds no budget, and it is
 *    started again; the successor is what says how the line ended.
 *
 * They are not counted **and take no place in the window**, so two lines that
 * really failed still stop the flow with a refused draft or a lost lap
 * between them.
 */
const ENDED: readonly InjectionState[] = ["closed", "failed", "abandoned"];

/** Of {@link ENDED}, the ends that are the request's own work failing. */
const FAILED: readonly InjectionState[] = ["failed", "abandoned"];

/**
 * The states in which an injection is still on its way to a lap, and so holds
 * the flow: nothing further is asked for while one of its own requests has yet
 * to start. `lost` is one of them because the lap it is owed is started again
 * (`D-0139` rule 3), or the person is asked at the stop.
 */
const PENDING: readonly InjectionState[] = ["drafting", "waiting_to_start", "lost"];

/**
 * Whether the last two injections whose work ended both ended failed or
 * abandoned: the `failed_twice` stop, read on its own so the flow host can tell
 * a stop it asked earlier that no longer stands (rondo#549).
 */
export function failedTwice(injections: readonly Injection[]): boolean {
  const last = injections.filter((one) => ENDED.includes(one.state)).slice(-FAILURES_TO_STOP);
  return last.length === FAILURES_TO_STOP && last.every((one) => FAILED.includes(one.state));
}

/** The request id an injection is sent under: the same pick always names the same message. */
export function flowMessageId(scopeDecisionId: string, candidateKey: string): string {
  return `flow-${scopeDecisionId}-${candidateKey}`;
}

/**
 * The id an ask over a candidate's open points is raised under: the `round`th
 * ask over that candidate, so the same pick names the same ask.
 */
export function flowAskId(scopeDecisionId: string, candidateKey: string, round: number): string {
  return `flow-ask-${scopeDecisionId}-${candidateKey}-${String(round)}`;
}

/** What the flow would inject next, or why it waits. */
export function pickNext(input: FlowInput): FlowPick {
  const wait = (reason: Exclude<WaitReason, "nothing_eligible">): FlowPick => ({
    kind: "wait",
    reason,
  });
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
  if (failedTwice(input.injections)) {
    return wait("failed_twice");
  }
  if (input.injections.some((one) => PENDING.includes(one.state))) {
    return wait("injection_pending");
  }
  if (input.ownOpenAsk) {
    return wait("open_ask");
  }
  const aside = new Set(input.putAside);
  const noSlot =
    input.occupancy.occupying >= input.bounds.maxOccupying ||
    input.occupancy.live >= input.bounds.maxLive;
  const injected = new Set(input.injections.map((one) => one.candidateKey));
  const skip = (one: Ranked): SkipReason | null =>
    injected.has(one.key)
      ? "started"
      : aside.has(one.key)
        ? "put_aside"
        : one.source.form !== "issue"
          ? "not_issue"
          : null;
  const eligible = input.triage.ranked.filter((one) => skip(one) === null);
  // **A candidate the person answered comes first** (rondo#504): the answer is
  // what the flow was waiting for, so it is not passed over for the ranking's
  // first candidate, which would ask the person again elsewhere.
  const answeredKeys = new Set(
    input.asks.filter((ask) => ask.answers !== null).map((ask) => ask.candidateKey),
  );
  const candidate =
    eligible.find((one) => answeredKeys.has(one.key)) ??
    (eligible[0] as (typeof eligible)[number] | undefined);
  if (candidate === undefined) {
    if (noSlot) {
      return wait("no_slot");
    }
    return {
      kind: "wait",
      reason: "nothing_eligible",
      skipped: input.triage.ranked.flatMap((one) => {
        const why = skip(one);
        return why === null ? [] : [{ key: one.key, request: one.request, why }];
      }),
    };
  }
  // **An answer stands for its candidate** (rondo#504): triage words the
  // points afresh on every reading, so a re-ranking's points cannot be matched
  // to the ones answered. The newest answer goes in as asked and as answered,
  // and an ask open over another candidate does not hold it back.
  const asked = input.asks.filter((ask) => ask.candidateKey === candidate.key);
  const answered = asked.findLast((ask) => ask.answers !== null);
  const inject = (): FlowPick =>
    noSlot
      ? wait("no_slot")
      : {
          kind: "inject",
          candidate: {
            ...candidate,
            request: answered?.request ?? candidate.request,
            why: answered?.why ?? candidate.why,
          },
          messageId: flowMessageId(input.scopeDecisionId, candidate.key),
          answers:
            answered?.points.map((point, at) => ({
              point,
              answer: answered.answers?.[at] ?? "",
            })) ?? [],
        };
  if (answered !== undefined) {
    return inject();
  }
  // **One ask at a time** (rondo#487): an unanswered one holds the flow while
  // its candidate is still ranked, not put aside and not started; *not now* is
  // a way to decline it. An ask left open when an earlier answer started its
  // candidate holds nothing (rondo#504).
  const ranked = new Set(input.triage.ranked.map((one) => one.key));
  if (
    input.asks.some(
      (ask) =>
        ask.answers === null &&
        ranked.has(ask.candidateKey) &&
        !aside.has(ask.candidateKey) &&
        !injected.has(ask.candidateKey),
    )
  ) {
    return wait("points_asked");
  }
  if (candidate.openPoints.length === 0) {
    return inject();
  }
  return noSlot
    ? wait("no_slot")
    : {
        kind: "ask",
        candidate,
        askId: flowAskId(input.scopeDecisionId, candidate.key, asked.length + 1),
      };
}
