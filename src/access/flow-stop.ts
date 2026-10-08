/**
 * A flow's stop, as the page reads it (rondo#488).
 *
 * The flow host stops for one of six reasons (`FlowStop`). **Once the flow has
 * a request**, the stop is an ask in that request's thread, and the page finds
 * it there. **Before its first request** there is no thread, so the flow host
 * records the stop as a `flow_stop` row with its facts as fields, and the page
 * reads the newest row of the approval in force.
 *
 * **The facts are kept either way** (rondo#549): an ask in a thread has a
 * `flow_stop` row of its own beside it, named after the ask, which is what lets
 * the page say the ask again rather than draw the sentence the host wrote
 * ({@link flowStopAskedFacts}). Rows are read as the stop itself only while the
 * approval has written no request.
 *
 * **Green only while the flow can start or is running**: a goal scope in force
 * is drawn as stopped when either of the two stands, and running otherwise.
 *
 * Nothing here is a sentence (D-0055 rule 3): the facts travel as fields, and
 * the words for them are in the wording catalogues (D-0079). {@link flowStopBody}
 * is the one composer over those words, and it is here rather than in the host
 * because **both sides of the stop say it**: the host writes it into the
 * request's thread, and the page says it again to whoever is reading
 * (rondo#549).
 */

import type { Skipped, SkipReason } from "../advisory/flow.js";
import {
  type JsonRecord,
  type JsonValue,
  opensFlowRequest,
  type StoredFlowStop,
  scopeCoversRequest,
  type ThreadMessageDraft,
} from "../store/records.js";
import type { AdvisoryRecord } from "../store/sqlite.js";
import type { Chrome } from "./wording.js";

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

/** The id of the flow's reply that takes back the stop `askId` (rondo#549, `withdrawnByFlow`). */
export function withdrawnId(askId: string): string {
  return `flow-withdrawn-${askId}`;
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
    // A stop the flow took back (rondo#549) is no stop: the flow went on.
    if (
      stop === undefined ||
      reason === undefined ||
      messages.some((one) => one.messageId === withdrawnId(stop.messageId))
    ) {
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

/**
 * The stop's words, in the scope stop's layout (`stopBody`, D-0066 rule 4.4)
 * and **in the language of whoever reads them** (D-0079, rondo#549).
 *
 * The host composes this once, in the host operator's words (`hostWords`), and
 * writes it into the request's thread as the record. The page composes it again
 * from the same facts in the language of the person looking at it
 * (`flowStopView`), because the host's language is the machine's setting and
 * the page's is the reader's own (`?lang`, the cookie, the browser). One
 * composer, so the two never drift apart.
 *
 * Everything the ask cites by name stays as it is: what a person reads is a
 * sentence, and a repository, a scope id or a decision id is not one (D-0076).
 */
export function flowStopBody(words: Chrome, repository: string, facts: FlowStopFacts): string {
  return words.flowStopAsk({
    repository,
    why: flowStopWhy(words, facts),
    recommended: words.flowStopAskRecommended(facts.reason),
  });
}

/**
 * Why the flow stopped, as the person reads it: the reason, and under it the
 * facts that reason turns on, each its own line.
 *
 * The keys are the goal screen's own (`flowStopSaid`), so a stop says the same
 * thing wherever it is read; the numbers are formatted as that screen formats
 * them (`money`, `localTime`), which is a token and not prose (D-0055 rule 3).
 */
function flowStopWhy(words: Chrome, facts: FlowStopFacts): string {
  const reason = words.flowStopReason(facts.reason);
  switch (facts.reason) {
    case "expiry":
      return [
        reason,
        words.flowStopExpiredAt(
          new Date(facts.expiresAtMs).toISOString().slice(0, 16).replace("T", " "),
        ),
      ].join("\n");
    case "laps":
      return [reason, words.flowStopLapsUsed(facts.admissions, facts.laps)].join("\n");
    case "cost":
      return [
        reason,
        words.flowStopCostOver(
          facts.spentUsd.toFixed(2),
          facts.committedUsd.toFixed(2),
          facts.budgetUsd.toFixed(2),
        ),
      ].join("\n");
    case "nothing_eligible":
      return [
        reason,
        ...(facts.skipped.length === 0
          ? [words.flowStopRankingEmpty]
          : [
              words.flowStopSkippedHeading,
              ...facts.skipped.map((one) => `- ${one.request}: ${words.flowStopSkipped(one.why)}`),
            ]),
      ].join("\n");
    default:
      return reason;
  }
}

/**
 * The facts behind a stop the flow asked in a thread, for the page to say it
 * again (rondo#549).
 *
 * The host records a `flow_stop` row under the ask's own message id whenever it
 * asks, so the reason and the figures a person acts on are fields the page can
 * read rather than a sentence it would have to parse back out (AGENTS.md's rule
 * on refusals, D-0015 rule 7). A row this build cannot read, or an ask written
 * before the row was kept, gives null -- and then the thread draws the words as
 * they were written, which is what it always did.
 */
export function flowStopAskedFacts(
  stops: readonly StoredFlowStop[],
  messageId: string,
): { readonly facts: FlowStopFacts; readonly repository: string } | null {
  const row = stops.find((one) => one.stopId === messageId);
  const facts = row === undefined ? null : readFlowStopFacts(row.facts);
  return row === undefined || facts === null ? null : { facts, repository: row.repository };
}
