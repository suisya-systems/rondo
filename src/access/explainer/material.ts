/**
 * What the thread explainer is handed for one question (rondo#401, D-0177):
 * the question, its thread, the laps of the thread's request with what became
 * of them, what waits on the person, and the approval in force.
 *
 * **Reads only, and only rondo's store**: no forge, no continuo, no file. Each
 * function here is a plain read a later read-only MCP can open as it is; the
 * result is JSON, so the explanation's snapshot holds exactly what was read.
 */

import type { Basis } from "../../advisory/proposal.js";
import type { IterationRecord, JsonRecord, ThreadMessageDraft } from "../../store/records.js";
import type { AdvisoryRecord, IterationStore } from "../../store/sqlite.js";
import { draftAwaiting, draftedStanding } from "../drafted-view.js";
import { threadOf } from "../model-draft/host.js";
import { type LapResult, resultOf } from "../page-logic/result.js";
import { threadsOf } from "../page-logic/threads.js";
import { lapsPastTheirCeiling, waitsOnYou } from "../page-logic/waits.js";

/** One message's body is cut here, so one pasted log does not crowd out the thread. */
const BODY_BOUND = 4_000;

export interface ExplainerPorts {
  readonly store: Pick<IterationStore, "readLive" | "terminalIterations">;
  readonly record: Pick<
    AdvisoryRecord,
    | "threadMessages"
    | "scopesFor"
    | "scopeDecisionOf"
    | "scopeSupersededByApproved"
    | "readScope"
    | "scopeSpent"
    | "readProposal"
  >;
}

export interface ExplainerMessage {
  readonly messageId: string;
  readonly authorKind: string;
  readonly authorId: string;
  readonly inReplyTo: string | null;
  readonly atMs: number;
  readonly body: string;
}

export interface ExplainerLap {
  readonly iterationId: string;
  readonly status: string;
  readonly gateId: string | null;
  readonly gateStage: string | null;
  readonly gateOutcome: string | null;
  readonly reason: string | null;
  readonly failureKind: string | null;
  readonly model: string | null;
  readonly modelTier: string | null;
  readonly lapCostUsd: number | null;
  readonly supersedesIterationId: string | null;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
  /** Published, its pull request and checks, merged: read off rondo's own reports. */
  readonly result: LapResult | null;
}

/**
 * A reason something waits, as `waits.ts` reads it: a lap at its gate
 * (`awaiting_human`), a lap held for the person's decision with no gate to
 * answer (`stalled`, `withdrawal_requested`), a question asked of the person,
 * a lap past its plan's ceiling, and a drafted scope nobody has decided. Not
 * D-0068's whole reading of a wait; the things rondo already says are waiting.
 */
export type ExplainerWait =
  | { readonly kind: "gate"; readonly iterationId: string; readonly status: string }
  | { readonly kind: "decide"; readonly iterationId: string; readonly status: string }
  | { readonly kind: "ask"; readonly messageId: string }
  | { readonly kind: "overdue"; readonly iterationId: string; readonly status: string }
  | { readonly kind: "scope"; readonly scopeId: string };

/** The approval in force for the request, with what is left of it. */
export interface ExplainerScope {
  readonly decisionId: string;
  readonly scopeId: string;
  readonly approvedUsd: number;
  readonly spentUsd: number;
  /** The reserve held for laps whose cost is not read yet. */
  readonly heldUsd: number;
  readonly leftUsd: number;
  readonly expiresAtMs: number;
}

export interface ExplainerMaterial {
  readonly question: {
    readonly messageId: string;
    readonly body: string;
    /** What the "?" was pressed beside, or null for free text from the reply box. */
    readonly about: Basis | null;
    readonly origin: "button" | "text";
  };
  /** The message that opened the request the question was asked in. */
  readonly requestMessageId: string;
  readonly thread: readonly ExplainerMessage[];
  readonly laps: readonly ExplainerLap[];
  readonly waits: readonly ExplainerWait[];
  readonly scope: ExplainerScope | null;
  /** When the question is about a message rondo wrote, its words: the words asked about (D-0173 K4). */
  readonly words: string | null;
  /** Every locator an answer may cite, as {@link locatorText} writes it. */
  readonly locators: readonly string[];
}

/**
 * The canonical text of the locators an answer may cite, the shape
 * `rondo propose --basis` reads. Only the forms a question can be about, and
 * the ones the material offers.
 */
export function locatorText(basis: Basis): string | null {
  switch (basis.form) {
    case "message":
      return `message:${basis.messageId}`;
    case "iteration":
      return `iteration:${basis.iterationId}`;
    case "scope":
      return `scope:${basis.scopeId}`;
    case "gateTransition":
      return `gate:${basis.gateId}#${String(basis.transitionSeq)}`;
    default:
      return null;
  }
}

/** {@link locatorText} read back; null for a text it does not write. */
export function basisOf(text: string): Basis | null {
  const at = text.indexOf(":");
  const rest = text.slice(at + 1);
  if (at === -1 || rest === "") {
    return null;
  }
  switch (text.slice(0, at)) {
    case "message":
      return { form: "message", messageId: rest };
    case "iteration":
      return { form: "iteration", iterationId: rest };
    case "scope":
      return { form: "scope", scopeId: rest };
    case "gate": {
      const hash = rest.lastIndexOf("#");
      const seq = rest.slice(hash + 1);
      return hash > 0 && /^\d+$/.test(seq)
        ? { form: "gateTransition", gateId: rest.slice(0, hash), transitionSeq: Number(seq) }
        : null;
    }
    default:
      return null;
  }
}

/**
 * A question's stored basis as one of the four forms a question may name, or
 * null. The store checked its fields when it wrote the row (`BASIS_LOCATOR_FIELDS`).
 */
function aboutOf(bases: readonly JsonRecord[]): Basis | null {
  const first = bases[0];
  const text = first === undefined ? null : locatorText(first as unknown as Basis);
  return text === null ? null : basisOf(text);
}

const cut = (body: string): string =>
  body.length > BODY_BOUND ? `${body.slice(0, BODY_BOUND)}...` : body;

/**
 * The material for `questionId`. Throws only when a source will not read at
 * all, or the question is not in the store; the host answers from nothing then.
 */
export async function gatherExplainerMaterial(
  ports: ExplainerPorts,
  questionId: string,
  nowMs: number,
): Promise<ExplainerMaterial> {
  const read = await ports.record.threadMessages();
  if (read.kind !== "read") {
    throw new Error(`the thread will not read: ${read.reason}`);
  }
  const question = read.messages.find((m) => m.messageId === questionId);
  if (question === undefined) {
    throw new Error(`'${questionId}' is not a message in the store`);
  }
  const threads = threadsOf(read.messages, new Set(), new Map());
  const root = threads.rootOf(questionId) ?? questionId;
  const inThread = threadOf(read.messages, root);
  const own = read.messages.filter((m) => inThread.has(m.messageId));
  const thread = own.map((m: ThreadMessageDraft) => ({
    messageId: m.messageId,
    authorKind: m.authorKind,
    authorId: m.authorId,
    inReplyTo: m.inReplyTo,
    atMs: m.atMs,
    body: cut(m.body),
  }));

  const live = (await ports.store.readLive()).flatMap((o) => (o.kind === "read" ? [o.record] : []));
  const ended = (await ports.store.terminalIterations()).flatMap((o) =>
    o.kind === "read" ? [o.record] : [],
  );
  const records = [...live, ...ended]
    .filter((r) => r.requestMessageId === root)
    .sort((a, b) => a.createdAtMs - b.createdAtMs || (a.id < b.id ? -1 : 1));
  const said = new Map(read.messages.map((m) => [m.messageId, { body: m.body, atMs: m.atMs }]));
  const laps = records.map((r: IterationRecord) => ({
    iterationId: r.id,
    status: r.status,
    gateId: r.gateId,
    gateStage: r.gateStage,
    gateOutcome: r.gateOutcome,
    reason: r.reason,
    failureKind: r.failureKind,
    model: r.model,
    modelTier: r.modelTier,
    lapCostUsd: r.lapCostUsd,
    supersedesIterationId: r.supersedesIterationId,
    createdAtMs: r.createdAtMs,
    updatedAtMs: r.updatedAtMs,
    result: resultOf(said, r.id),
  }));

  const ownLive = live.filter((r) => r.requestMessageId === root);
  const waits: ExplainerWait[] = waitsOnYou(threads, ownLive).flatMap((w): ExplainerWait[] => {
    if (w.root !== root) {
      return [];
    }
    const [kind = "", id = "", status = ""] = w.episode.split(":");
    if (kind === "ask") {
      return [{ kind: "ask", messageId: w.episode.slice("ask:".length) }];
    }
    // Only a lap at its gate has a gate to answer; a stalled one waits on a decision.
    return [{ kind: status === "awaiting_human" ? "gate" : "decide", iterationId: id, status }];
  });
  for (const key of lapsPastTheirCeiling(ownLive, nowMs)) {
    const at = key.lastIndexOf(":");
    waits.push({ kind: "overdue", iterationId: key.slice(0, at), status: key.slice(at + 1) });
  }

  const scope = await approvalInForce(ports, root);
  // A drafted scope nobody has decided: the person's turn is its approval
  // (`scopesAwaitingYou`'s reading).
  const draft = draftAwaiting(await draftedStanding(ports, root), records.length > 0);
  if (draft !== null) {
    waits.push({ kind: "scope", scopeId: draft.scope.scopeId });
  }
  const about = aboutOf(question.bases);
  const asked =
    about?.form === "message" ? read.messages.find((m) => m.messageId === about.messageId) : null;
  const locators = new Set([
    ...thread.map((m) => `message:${m.messageId}`),
    ...laps.map((lap) => `iteration:${lap.iterationId}`),
    ...(scope === null ? [] : [`scope:${scope.scopeId}`]),
    ...waits.flatMap((w) => (w.kind === "scope" ? [`scope:${w.scopeId}`] : [])),
    ...(about === null ? [] : [locatorText(about) as string]),
  ]);
  return {
    question: {
      messageId: questionId,
      body: question.body,
      about,
      origin: about === null ? "text" : "button",
    },
    requestMessageId: root,
    thread,
    laps,
    waits,
    scope,
    words:
      asked === undefined || asked === null || asked.authorKind === "operator"
        ? null
        : cut(asked.body),
    locators: [...locators],
  };
}

/**
 * The newest approval over a scope for `requestMessageId` that no approved
 * successor replaced -- rondo's drafted scope or the person's own -- with what
 * has been spent and held against it, or null.
 *
 * A goal's approval (D-0128) that covers a request the flow opened is one of
 * them (`scopesFor` returns it): the week's allowance sums it like any other,
 * and the triage reading is already counted against it (rondo#469).
 */
async function approvalInForce(
  ports: ExplainerPorts,
  requestMessageId: string,
): Promise<ExplainerScope | null> {
  for (const scope of (await ports.record.scopesFor(requestMessageId)).toReversed()) {
    const decided = await ports.record.scopeDecisionOf(scope.scopeId);
    if (
      decided.kind !== "read" ||
      decided.decision.outcome !== "approved" ||
      (await ports.record.scopeSupersededByApproved(scope.scopeId))
    ) {
      continue;
    }
    const stored = await ports.record.readScope(scope.scopeId);
    if (stored.kind !== "read") {
      return null;
    }
    const { budgets } = stored.scope.payload;
    const spent = await ports.record.scopeSpent(decided.decision.scopeDecisionId);
    const heldUsd = spent.unreadLaps * budgets.cost_reserve_usd;
    return {
      decisionId: decided.decision.scopeDecisionId,
      scopeId: scope.scopeId,
      approvedUsd: budgets.cost_usd,
      spentUsd: spent.readCostUsd,
      heldUsd,
      leftUsd: Math.max(0, budgets.cost_usd - spent.readCostUsd - heldUsd),
      expiresAtMs: budgets.expires_at_ms,
    };
  }
  return null;
}
