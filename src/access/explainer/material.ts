/**
 * What the thread explainer is handed for one question (rondo#401, D-0177):
 * the question, its thread, the laps of the thread's request with what became
 * of them, what waits on the person, and the approval in force.
 *
 * **Reads only, and only rondo's store**: no forge, no continuo, no file. Each
 * function here is a plain read a later read-only MCP can open as it is; the
 * result is JSON, so the explanation's snapshot holds exactly what was read.
 */

import { type Basis, readSplitPayload } from "../../advisory/proposal.js";
import {
  type IterationRecord,
  isTerminal,
  type JsonRecord,
  type NonTerminalStatus,
  QUESTION_ID_PREFIX,
  type ThreadMessageDraft,
  WAIT_SIDE,
} from "../../store/records.js";
import type { AdvisoryRecord, ApprovedSplit, IterationStore } from "../../store/sqlite.js";
import { type DraftedStartReadiness, partsOf } from "../drafted-start.js";
import { draftAwaiting, draftedStanding } from "../drafted-view.js";
import { goalScopeStanding } from "../goal-scope.js";
import { threadOf } from "../model-draft/host.js";
import { currentGoals } from "../page/triage.js";
import { type LapResult, resultOf } from "../page-logic/result.js";
import { lastLooked, sinceLooked, sinceReads } from "../page-logic/since.js";
import { firstLine, type Threads, threadsOf } from "../page-logic/threads.js";
import {
  draftsOwedNow,
  lapsPastTheirCeiling,
  PRESS,
  scopesAwaitingYou,
  waitsOnYou,
} from "../page-logic/waits.js";
import { isRequestReport } from "../request-report.js";

/** One message's body is cut here, so one pasted log does not crowd out the thread. */
const BODY_BOUND = 4_000;

export interface ExplainerPorts {
  /** What `partsOf` reads too, for a part held by order across every request (rondo#630). */
  readonly store: Pick<IterationStore, "readLive" | "terminalIterations"> &
    Parameters<typeof partsOf>[0]["store"];
  readonly record: Parameters<typeof partsOf>[0]["record"] &
    Pick<
      AdvisoryRecord,
      | "threadMessages"
      | "scopesFor"
      | "scopeDecisionOf"
      | "scopeSupersededByApproved"
      | "readScope"
      | "scopeSpent"
      | "readProposal"
      | "goals"
      | "approvalsInForce"
      | "lastView"
      | "lastActed"
      | "changedSince"
    >;
  /**
   * What the list's *your turn* also reads, for a question across every
   * request (D-0189): the drafts rondo still owes, a request's repository
   * rondo does not hold, and the repositories whose goal flows it draws. The
   * page's own ports; absent, nothing is owed or unheld and no flow is read.
   */
  readonly draftsOwed?: () => Promise<ReadonlySet<string>>;
  readonly unheld?: (requestMessageId: string) => Promise<boolean>;
  readonly triageRepositories?: () => Promise<readonly string[]>;
  /**
   * The approved splits, and whether one plan of one can start now under this
   * host's policy (`draftedStartReadiness`), as the order tick reads them: for
   * an approved plan held by room or by files across every request
   * (rondo#665). Absent, none is read.
   */
  readonly starts?: {
    readonly splits: () => Promise<readonly ApprovedSplit[]>;
    readonly readiness: (split: ApprovedSplit, planIndex: number) => Promise<DraftedStartReadiness>;
  };
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
 * a lap past its plan's ceiling, and a drafted scope nobody has decided.
 *
 * **Across every request, the waits that are not the person's too** (D-0068
 * section 1 rule 2.1, rondo#630): a lap in flight inside its plan's ceiling,
 * which says how long rondo has waited and may still wait and never that it
 * is "progressing" (rule 2.2), and a part held until an earlier part of its
 * split is merged (`held_by_order`, the order being D-0098 rule 1's `after`).
 * `held_by_bound` and `undetermined` are not read here.
 *
 * **And an approved plan not started for want of room or files** (rondo#665):
 * every slot this host allows is taken (`busy`, `full`), or open lines hold
 * files it would claim (`held`), as the scope view says it beside its press.
 */
export type ExplainerWait = (
  | { readonly kind: "gate"; readonly iterationId: string; readonly status: string }
  | { readonly kind: "decide"; readonly iterationId: string; readonly status: string }
  | { readonly kind: "ask"; readonly messageId: string }
  | { readonly kind: "overdue"; readonly iterationId: string; readonly status: string }
  /** `leftMs` is what its plan's ceiling still allows, or null with no ceiling rondo can read. */
  | {
      readonly kind: "inFlight";
      readonly iterationId: string;
      readonly status: string;
      readonly leftMs: number | null;
    }
  /** Part `part` (from 0) waits for part `after` to be merged; `firstLineageId` once that one started. */
  | {
      readonly kind: "order";
      readonly part: number;
      readonly after: number;
      readonly firstLineageId: string | null;
    }
  | { readonly kind: "scope"; readonly scopeId: string }
  /** A request whose next step is a press before any draft, by its opener (rondo#643). */
  | { readonly kind: "press"; readonly messageId: string }
  /**
   * Plan `part` (from 0) of `parts` waits for a slot: `count` of `limit` laps
   * run (`busy`) or are open (`full`).
   */
  | {
      readonly kind: "room";
      readonly requestMessageId: string;
      readonly part: number;
      readonly parts: number;
      readonly full: boolean;
      readonly count: number;
      readonly limit: number;
    }
  /** Plan `part` waits for `paths`, held by work of the requests `holders` (their first lines). */
  | {
      readonly kind: "files";
      readonly requestMessageId: string;
      readonly part: number;
      readonly parts: number;
      readonly paths: readonly string[];
      /** Every holder has finished: it waits for their pull requests, not their laps. */
      readonly finished: boolean;
      readonly holders: readonly string[];
    }
  /** A goal flow the person paused, by the scope that paused it (D-0186). */
  | { readonly kind: "paused"; readonly scopeId: string; readonly repository: string }
) & {
  /**
   * The request it waits in, by its opener's id and first line: set only for a
   * question that opens a thread of its own, whose answer spans every request
   * (rondo#626, D-0189).
   */
  readonly request?: { readonly messageId: string; readonly title: string };
  /** How long it has waited when the question was asked, where a row says since when (D-0068 rule 2.5). */
  readonly forMs?: number;
};

/** Whether the question opened a thread of its own, and so asks across every request (D-0189). */
export const acrossRequests = (material: ExplainerMaterial): boolean =>
  material.requestMessageId.startsWith(QUESTION_ID_PREFIX);

/**
 * A wait's own locator: the question asked, or the lap or scope that waits.
 * A part held by order rests on the line it waits for, or, before that line
 * started, on its request.
 */
export function waitLocator(wait: ExplainerWait): string {
  return wait.kind === "ask" || wait.kind === "press"
    ? `message:${wait.messageId}`
    : wait.kind === "scope" || wait.kind === "paused"
      ? `scope:${wait.scopeId}`
      : wait.kind === "room" || wait.kind === "files"
        ? `message:${wait.requestMessageId}`
        : wait.kind === "order"
          ? wait.firstLineageId === null
            ? `message:${wait.request?.messageId ?? ""}`
            : `iteration:${wait.firstLineageId}`
          : `iteration:${wait.iterationId}`;
}

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
  /**
   * Across every request, what ended since the person last looked (rondo#656);
   * absent on a row written before it was read, and on an answer in a thread.
   */
  readonly results?: ExplainerResults;
}

/**
 * **What ended, off the page's own reading** (rondo#656): the rows *since you
 * last looked* sorts under each request (`page-logic/since.ts`), from the same
 * mark, so the empty centre and this answer cannot disagree. A pull request
 * opened, merged or closed, a lap that failed or was abandoned, and a request's
 * report, each under its request and resting on its own row.
 */
export interface ExplainerResults {
  /** How long before now the person last looked, or null with no mark: the last day is read. */
  readonly forMs: number | null;
  /** Newest request first, at most {@link RESULTS_BOUND}. */
  readonly items: readonly ExplainerResult[];
  /** How many more there were past the bound. */
  readonly more: number;
}

export type ExplainerResult = {
  readonly request: { readonly messageId: string; readonly title: string };
} & (
  | {
      readonly kind: "opened" | "merged" | "closed";
      readonly messageId: string;
      readonly number: string | null;
    }
  | { readonly kind: "report"; readonly messageId: string }
  | {
      readonly kind: "lap";
      readonly iterationId: string;
      readonly status: string;
    }
);

/** How many results the answer names before it only counts the rest. */
export const RESULTS_BOUND = 8;
/** With no mark, the window read instead: the last day. */
const RESULTS_WINDOW_MS = 86_400_000;

export const resultLocator = (result: ExplainerResult): string =>
  result.kind === "lap" ? `iteration:${result.iterationId}` : `message:${result.messageId}`;

/** The report ids that say a pull request moved, and what each says. */
const PULL_REPORTS = [
  ["report-published-", "opened"],
  ["report-merged-", "merged"],
  ["report-closed-", "closed"],
] as const;

/** {@link ExplainerResults}, read off `sinceLooked` from the mark the page reads. */
async function resultsSince(
  ports: ExplainerPorts,
  messages: readonly ThreadMessageDraft[],
  threads: ReturnType<typeof threadsOf>,
  records: readonly IterationRecord[],
  question: ThreadMessageDraft,
  nowMs: number,
): Promise<ExplainerResults> {
  const actorId = question.authorKind === "operator" ? question.authorId : null;
  // The mark as it stood when the question was asked: asking is a press too.
  const sinceMs = actorId === null ? null : await lastLooked(ports.record, actorId, question.atMs);
  const fromMs = sinceMs ?? nowMs - RESULTS_WINDOW_MS;
  const byId = new Map(messages.map((m) => [m.messageId, m]));
  const said = new Map(messages.map((m) => [m.messageId, { body: m.body, atMs: m.atMs }]));
  const reading = sinceLooked(
    await ports.record.changedSince(fromMs),
    fromMs,
    sinceReads(byId, threads.rootOf, actorId, records),
  );
  const items = reading.moved.flatMap((moved): ExplainerResult[] => {
    const request = {
      messageId: moved.messageId,
      title: firstLine(byId.get(moved.messageId)?.body ?? ""),
    };
    const reported = new Set<string>();
    const out: ExplainerResult[] = [];
    for (const messageId of moved.rondoSaid) {
      const message = byId.get(messageId);
      if (message !== undefined && isRequestReport(message)) {
        out.push({ kind: "report", messageId, request });
        continue;
      }
      const pull = PULL_REPORTS.find(([prefix]) => messageId.startsWith(prefix));
      if (pull === undefined) continue;
      const lap = messageId.slice(pull[0].length);
      reported.add(lap);
      out.push({ kind: pull[1], messageId, number: resultOf(said, lap)?.number ?? null, request });
    }
    for (const iterationId of moved.endedLaps) {
      const record = records.find((r) => r.id === iterationId);
      // A lap that closed with its pull request said is said by that.
      if (record === undefined || (record.status === "closed" && reported.has(iterationId))) {
        continue;
      }
      out.push({
        kind: "lap",
        iterationId,
        status: record.status,
        request,
      });
    }
    return out;
  });
  return {
    forMs: sinceMs === null ? null : Math.max(0, nowMs - sinceMs),
    items: items.slice(0, RESULTS_BOUND),
    more: Math.max(0, items.length - RESULTS_BOUND),
  };
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

  // **A question that opens its own thread asks across every request**, and so
  // does one asked again in that thread (rondo#626, D-0189): what waits on the
  // person anywhere, as the list's *your turn* reads it, each wait named by its
  // request. It has no laps and no approval of its own.
  const across = root.startsWith(QUESTION_ID_PREFIX);
  const ownLive = across ? live : live.filter((r) => r.requestMessageId === root);
  const titled = (request: string): Pick<ExplainerWait, "request"> =>
    across
      ? { request: { messageId: request, title: firstLine(said.get(request)?.body ?? "") } }
      : {};
  // How long each has waited, from the row that says since when; only across
  // every request, so the in-thread answer's material stays as it was.
  const since = (atMs: number | undefined): Pick<ExplainerWait, "forMs"> =>
    across && atMs !== undefined ? { forMs: Math.max(0, nowMs - atMs) } : {};
  const lapAt = (id: string) => ownLive.find((r) => r.id === id)?.updatedAtMs;
  const waits: ExplainerWait[] = waitsOnYou(threads, ownLive).flatMap((w): ExplainerWait[] => {
    if (!across && w.root !== root) {
      return [];
    }
    const [kind = "", id = "", status = ""] = w.episode.split(":");
    if (kind === "ask") {
      const messageId = w.episode.slice("ask:".length);
      return [{ kind: "ask", messageId, ...titled(w.root), ...since(said.get(messageId)?.atMs) }];
    }
    // Only a lap at its gate has a gate to answer; a stalled one waits on a decision.
    return [
      {
        kind: status === "awaiting_human" ? "gate" : "decide",
        iterationId: id,
        status,
        ...titled(w.root),
        ...since(lapAt(id)),
      },
    ];
  });
  const overdue = new Set<string>();
  for (const key of lapsPastTheirCeiling(ownLive, nowMs)) {
    const at = key.lastIndexOf(":");
    const iterationId = key.slice(0, at);
    overdue.add(iterationId);
    const request = ownLive.find((r) => r.id === iterationId)?.requestMessageId ?? root;
    waits.push({
      kind: "overdue",
      iterationId,
      status: key.slice(at + 1),
      ...titled(request),
      ...since(lapAt(iterationId)),
    });
  }
  if (across) {
    waits.push(
      ...inFlight(ownLive, overdue, nowMs, titled),
      ...(await heldByOrder(ports, threads, titled)),
      ...(await heldByRoom(ports, said, titled)),
    );
  }

  const scope = across ? null : await approvalInForce(ports, root);
  // A drafted scope nobody has decided: the person's turn is its approval
  // (`scopesAwaitingYou`'s reading).
  if (across) {
    // The page's own predicates (`page-logic/model.ts`), so the answer and the
    // list cannot differ: a redraft owed or a repository not held is no turn.
    const unheld = ports.unheld;
    const scopes = await scopesAwaitingYou(
      {
        record: ports.record,
        unheld: async (id) => (unheld === undefined ? false : await unheld(id).catch(() => false)),
      },
      threads,
      [...live, ...ended],
      await draftsOwedNow(ports),
    );
    for (const w of scopes) {
      waits.push(
        w.episode.startsWith(PRESS)
          ? {
              kind: "press",
              messageId: w.root,
              ...titled(w.root),
              ...since(said.get(w.root)?.atMs),
            }
          : { kind: "scope", scopeId: w.episode.slice("scope:".length), ...titled(w.root) },
      );
    }
    // A paused goal flow is a row under *your turn* too (D-0186), as `triageModel` reads it.
    if (((await ports.triageRepositories?.()) ?? []).length > 0) {
      for (const goal of currentGoals(await ports.record.goals()).values()) {
        const standing = await goalScopeStanding(ports.record, goal.goalId);
        if (standing.kind === "paused") {
          waits.push({
            kind: "paused",
            scopeId: standing.scope.scopeId,
            repository: goal.repository,
          });
        }
      }
    }
  } else {
    const draft = draftAwaiting(await draftedStanding(ports, root), records.length > 0);
    if (draft !== null) {
      waits.push({ kind: "scope", scopeId: draft.scope.scopeId });
    } else if ((await ports.unheld?.(root).catch(() => false)) === true) {
      // The thread's next step: a repository to add or setup's plan (rondo#643).
      waits.push({ kind: "press", messageId: root });
    }
  }
  const results = across
    ? await resultsSince(ports, read.messages, threads, [...live, ...ended], question, nowMs)
    : undefined;
  const about = aboutOf(question.bases);
  const asked =
    about?.form === "message" ? read.messages.find((m) => m.messageId === about.messageId) : null;
  const locators = new Set([
    ...thread.map((m) => `message:${m.messageId}`),
    ...laps.map((lap) => `iteration:${lap.iterationId}`),
    ...(scope === null ? [] : [`scope:${scope.scopeId}`]),
    ...(across ? waits.map(waitLocator) : []),
    ...waits.flatMap((w) => (w.kind === "scope" ? [`scope:${w.scopeId}`] : [])),
    ...(about === null ? [] : [locatorText(about) as string]),
    ...(results?.items.map(resultLocator) ?? []),
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
    ...(results === undefined ? {} : { results }),
  };
}

/**
 * The laps rondo is waiting on inside their plan's ceiling (D-0068's
 * `in_flight`): since when, and how much longer the plan allows. One past its
 * ceiling is `overdue` and said there.
 */
function inFlight(
  live: readonly IterationRecord[],
  overdue: ReadonlySet<string>,
  nowMs: number,
  titled: (request: string) => Pick<ExplainerWait, "request">,
): ExplainerWait[] {
  return live.flatMap((lap): ExplainerWait[] => {
    if (
      isTerminal(lap.status) ||
      WAIT_SIDE[lap.status as NonTerminalStatus] !== "inFlight" ||
      overdue.has(lap.id)
    ) {
      return [];
    }
    const forMs = Math.max(0, nowMs - lap.updatedAtMs);
    const ceiling = lap.plan["invocation_ceiling_ms"];
    return [
      {
        kind: "inFlight",
        iterationId: lap.id,
        status: lap.status,
        leftMs:
          typeof ceiling === "number" && Number.isFinite(ceiling) && ceiling > 0
            ? Math.max(0, ceiling - forMs)
            : null,
        ...titled(lap.requestMessageId),
        forMs,
      },
    ];
  });
}

/**
 * The parts not started because an earlier part of their split is not merged
 * yet (D-0068's `held_by_order`, D-0098 rule 1), as the page's *waiting* part
 * reads it. One whose earlier part ended unmerged is not here: rondo asked the
 * person about it (rule 1.5), and that question is already a wait.
 */
async function heldByOrder(
  ports: ExplainerPorts,
  threads: Threads,
  titled: (request: string) => Pick<ExplainerWait, "request">,
): Promise<ExplainerWait[]> {
  const held: ExplainerWait[] = [];
  for (const root of threads.messages.filter((m) => m.inReplyTo === null)) {
    for (const part of await partsOf(ports, root.messageId)) {
      if (
        part.lineageId === null &&
        part.order.kind === "waiting" &&
        part.order.first?.state !== "endedUnlanded"
      ) {
        held.push({
          kind: "order",
          part: part.index,
          after: part.order.after,
          firstLineageId: part.order.first?.lineageId ?? null,
          ...titled(root.messageId),
        });
      }
    }
  }
  return held;
}

/**
 * The approved plans not started because the host has no slot or open lines
 * hold their files (rondo#665), each read as the scope view reads it. A plan
 * started, held by order, or refused by its scope is not here: it is said
 * elsewhere or not a wait.
 */
async function heldByRoom(
  ports: ExplainerPorts,
  said: ReadonlyMap<string, { readonly body: string }>,
  titled: (request: string) => Pick<ExplainerWait, "request">,
): Promise<ExplainerWait[]> {
  const starts = ports.starts;
  if (starts === undefined) {
    return [];
  }
  const held: ExplainerWait[] = [];
  for (const split of await starts.splits()) {
    const read = await ports.record.readProposal(split.proposalId);
    const payload =
      read.kind === "read" && read.proposal.kind === "split"
        ? readSplitPayload(read.proposal.payload)
        : null;
    if (payload?.kind !== "split") {
      continue;
    }
    const parts = payload.payload.plans.length;
    const request = split.requestMessageId;
    for (let part = 0; part < parts; part++) {
      const ready = await starts.readiness(split, part);
      if (ready.kind === "busy" || ready.kind === "full") {
        held.push({
          kind: "room",
          requestMessageId: request,
          part,
          parts,
          full: ready.kind === "full",
          count: ready.kind === "full" ? ready.live : ready.occupying,
          limit: ready.limit,
          ...titled(request),
        });
      } else if (ready.kind === "held") {
        const holders = await Promise.all(
          ready.holders.map(async ({ line }) => {
            const root = await ports.store.read(line.lineageId);
            return root.kind === "read"
              ? firstLine(said.get(root.record.requestMessageId)?.body ?? "")
              : "";
          }),
        );
        held.push({
          kind: "files",
          requestMessageId: request,
          part,
          parts,
          paths: [...new Set(ready.holders.flatMap(({ paths }) => paths))],
          finished: ready.holders.every(({ line }) => !line.inFlight),
          holders: [...new Set(holders.filter((title) => title !== ""))],
          ...titled(request),
        });
      }
    }
  }
  return held;
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
