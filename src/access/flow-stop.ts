/**
 * A flow's stop, as the page reads it (rondo#488).
 *
 * The flow host stops for one of six reasons (`FlowStop`). **Once the flow has
 * a request**, the stop is an ask in that request's thread, and the page finds
 * it there. **Before its first request** there is no thread, so the flow host
 * records the stop as a `flow_stop` row with its facts as fields, and the page
 * reads the newest row of the approval in force.
 *
 * **Green only while the flow can start or is running**: a goal scope in force
 * is drawn as stopped when either of the two stands, and running otherwise.
 *
 * Nothing here is a sentence (D-0055 rule 3): the facts travel as fields, and
 * the words for them are in the wording catalogues (D-0079).
 */

import type { Skipped, SkipReason } from "../advisory/flow.js";
import {
  type JsonRecord,
  type JsonValue,
  opensFlowRequest,
  scopeCoversRequest,
  type ThreadMessageDraft,
} from "../store/records.js";
import type { AdvisoryRecord } from "../store/sqlite.js";

/** Why the flow stops and asks the person (rondo#469). */
export type FlowStop =
  | "newer_goal"
  | "expiry"
  | "laps"
  | "cost"
  | "failed_twice"
  | "nothing_eligible";

const FLOW_STOPS: readonly FlowStop[] = [
  "newer_goal",
  "expiry",
  "laps",
  "cost",
  "failed_twice",
  "nothing_eligible",
];

/** A stop and the facts a person acts on, one arm per reason (AGENTS.md, rondo#348). */
export type FlowStopFacts =
  | { readonly reason: "newer_goal"; readonly goalId: string; readonly newestGoalId: string }
  | { readonly reason: "expiry"; readonly expiresAtMs: number }
  | { readonly reason: "laps"; readonly admissions: number; readonly laps: number }
  | {
      readonly reason: "cost";
      readonly committedUsd: number;
      readonly budgetUsd: number;
      readonly spentUsd: number;
      readonly reserveUsd: number;
      readonly unreadLaps: number;
    }
  | { readonly reason: "failed_twice" }
  | { readonly reason: "nothing_eligible"; readonly skipped: readonly Skipped[] };

/** How the stops an approval raises are named, as asks and as rows. */
export function stopPrefix(scopeDecisionId: string): string {
  return `flow-stop-${scopeDecisionId}-`;
}

const SKIPS: readonly SkipReason[] = ["started", "put_aside", "not_issue"];

/** A `flow_stop` row's facts, read back; null for bytes this build does not read. */
export function readFlowStopFacts(facts: JsonRecord): FlowStopFacts | null {
  const num = (key: string): number | null =>
    typeof facts[key] === "number" ? (facts[key] as number) : null;
  switch (facts["reason"]) {
    case "newer_goal": {
      const goalId = facts["goalId"];
      const newestGoalId = facts["newestGoalId"];
      return typeof goalId === "string" && typeof newestGoalId === "string"
        ? { reason: "newer_goal", goalId, newestGoalId }
        : null;
    }
    case "expiry": {
      const expiresAtMs = num("expiresAtMs");
      return expiresAtMs === null ? null : { reason: "expiry", expiresAtMs };
    }
    case "laps": {
      const admissions = num("admissions");
      const laps = num("laps");
      return admissions === null || laps === null ? null : { reason: "laps", admissions, laps };
    }
    case "cost": {
      const [committedUsd, budgetUsd, spentUsd, reserveUsd, unreadLaps] = [
        "committedUsd",
        "budgetUsd",
        "spentUsd",
        "reserveUsd",
        "unreadLaps",
      ].map(num);
      return committedUsd == null ||
        budgetUsd == null ||
        spentUsd == null ||
        reserveUsd == null ||
        unreadLaps == null
        ? null
        : { reason: "cost", committedUsd, budgetUsd, spentUsd, reserveUsd, unreadLaps };
    }
    case "failed_twice":
      return { reason: "failed_twice" };
    case "nothing_eligible": {
      const skipped = facts["skipped"];
      if (!Array.isArray(skipped)) return null;
      const read = skipped.flatMap((one: JsonValue): Skipped[] => {
        if (typeof one !== "object" || one === null || Array.isArray(one)) return [];
        const { key, request, why } = one as JsonRecord;
        return typeof key === "string" &&
          typeof request === "string" &&
          SKIPS.includes(why as SkipReason)
          ? [{ key, request, why: why as SkipReason }]
          : [];
      });
      return read.length === skipped.length ? { reason: "nothing_eligible", skipped: read } : null;
    }
    default:
      return null;
  }
}

/**
 * Where a goal scope in force stands against its stop: asked in the thread of
 * the flow's latest request (`askedIn`; `open` while it waits on an answer),
 * recorded before the first request (`facts`), or null while the flow can
 * start or runs.
 *
 * **An answered stop still stands** (Codex round 1): the flow asks each stop
 * once, so after a *carry on* over a limit that is still spent it stops again
 * without a new question. It stands until the flow writes a request, whose
 * thread is then the one read.
 */
export type FlowStopRead =
  | {
      readonly kind: "asked";
      readonly reason: FlowStop;
      readonly askedIn: string;
      readonly open: boolean;
    }
  | { readonly kind: "recorded"; readonly facts: FlowStopFacts; readonly atMs: number };

export async function flowStopOf(
  record: Pick<AdvisoryRecord, "openAsksIn" | "flowStops">,
  messages: readonly ThreadMessageDraft[],
  goalId: string,
  scopeDecisionId: string,
): Promise<FlowStopRead | null> {
  const prefix = stopPrefix(scopeDecisionId);
  // The flow host's own test for the goal's requests (`flowHost`'s openers).
  const latest = messages
    .filter(
      (message) => opensFlowRequest(message) && scopeCoversRequest({ from_goal: goalId }, message),
    )
    .at(-1);
  if (latest !== undefined) {
    // The flow's stops in that thread, newest last, as `askStop` names them.
    const stop = messages
      .filter(
        (message) =>
          message.inReplyTo === latest.messageId &&
          message.asks &&
          message.messageId.startsWith(prefix),
      )
      .at(-1);
    const rest = stop?.messageId.slice(prefix.length);
    const reason = FLOW_STOPS.find((one) => rest?.startsWith(`${one}-`));
    if (stop === undefined || reason === undefined) {
      return null;
    }
    const asks = await record.openAsksIn(latest.messageId);
    // Waiting on an answer, not answered `stop`: that one stays open to hold
    // the work, and has been answered (Codex round 4).
    const open =
      asks.kind === "read" &&
      asks.asks.some((one) => one.messageId === stop.messageId && !one.answeredStop);
    return { kind: "asked", reason, askedIn: latest.messageId, open };
  }
  // ponytail: the newest row stands until a request is written, so a stop the
  // flow has since got past without writing one (a newer ranking with room
  // only later) reads stopped until then; a "cleared" row if that misleads.
  const row = (await record.flowStops())
    .filter((one) => one.scopeDecisionId === scopeDecisionId)
    .at(-1);
  const facts = row === undefined ? null : readFlowStopFacts(row.facts);
  return row === undefined || facts === null ? null : { kind: "recorded", facts, atMs: row.atMs };
}
