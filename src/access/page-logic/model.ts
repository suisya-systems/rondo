/**
 * What every view of the page reads before it draws anything (rondo#341).
 *
 * `operatorPage` (`src/access/web.tsx`) read, derived and drew every view in
 * one function. This is its first part, moved and not rewritten: the rows the
 * header's count, the list and every face are read off, read once per draw
 * whichever view is asked for -- the summary counts the asks waiting and the
 * header counts them on every view, so none of this is a view's own.
 *
 * **Reads only**, as the page is (D-0041): everything here goes through the
 * read ports, and nothing is drawn -- the faces are composed by their views
 * out of what this returns.
 */
import { readTriagePayload, type TriagePayload } from "../../advisory/triage.js";
import {
  type IterationRecord,
  isTerminal,
  type NonTerminalStatus,
  opensFlowRequest,
  type ScopePayload,
  type ScopeSpent,
  WAIT_SIDE,
} from "../../store/records.js";
import { approvedUnstarted, partsOf } from "../drafted-start.js";
import { draftedStanding } from "../drafted-view.js";
import { flowStopOf } from "../flow-stop.js";
import { goalScopeStanding } from "../goal-scope.js";
import { gatherInbox, type LiveRow } from "../inbox.js";
import { waitingBinding } from "../inbox-current.js";
import { unlandedPrefix } from "../order-host.js";
import type { MintMessageId, WebPorts } from "../page/contract.js";
import type { HeldReads } from "../page/held.js";
import { currentGoals, type GoalScopeState, type TriageReads } from "../page/triage.js";
import { readingsByDigest } from "../read-in.js";
import { approvalTip } from "../scope.js";
import type { Chrome } from "../wording.js";
import { endedRecently, type LapUnderRequest, saysMore } from "./laps.js";
import {
  placeName,
  placeSaid,
  type RequestList,
  repositoryOf,
  requestList,
  rowStateOf,
} from "./list.js";
import { type PartView, partCounts, partViews } from "./parts.js";
import { resultOf } from "./result.js";
import type { PageView } from "./routes.js";
import { firstLine, type Threads, threadsOf } from "./threads.js";
import { draftsOwedNow, scopesAwaitingYou, type Wait, waitsOnYou } from "./waits.js";

/** The newest approval in force over a scope the person wrote, if any. */
async function ownApproval(
  ports: WebPorts,
  requestMessageId: string,
): Promise<{ readonly kind: "own"; readonly scopeDecisionId: string } | null> {
  for (const scope of (await ports.record.scopesFor(requestMessageId)).toReversed()) {
    const decided = await ports.record.scopeDecisionOf(scope.scopeId);
    if (
      decided.kind === "read" &&
      decided.decision.outcome === "approved" &&
      !(await ports.record.scopeSupersededByApproved(scope.scopeId))
    ) {
      return { kind: "own", scopeDecisionId: decided.decision.scopeDecisionId };
    }
  }
  return null;
}

/**
 * Where a request's scope stands: rondo's draft, or its approval, or else the
 * person's own approval in force.
 *
 * **A scope the person set and approved themselves stands too** (Codex):
 * `draftedStanding` follows rondo's drafts only, and saying *nothing has been
 * set* over an approval already given would send them to approve again.
 */
export async function scopeStanding(ports: WebPorts, requestMessageId: string) {
  const drafted = await draftedStanding(ports, requestMessageId);
  return drafted.kind !== "none"
    ? drafted
    : ((await ownApproval(ports, requestMessageId)) ?? drafted);
}

/**
 * **rondo's turn while the draft its scope waits on is still to come**
 * (rondo#495): owed, and no approval in force. A draft already shown yields
 * to the one still owed, since that one is drafted over the newer message.
 * One predicate, so the thread's card, the right face and the list's row
 * cannot disagree about whose turn it is.
 */
export function draftingOver(standing: Awaited<ReturnType<typeof scopeStanding>>, owed: boolean) {
  return owed && (standing.kind === "none" || standing.kind === "drafted");
}

/** What every view reads, once per draw (rondo#341). */
export interface PageModel {
  readonly nowMs: number;
  readonly threadRead: Awaited<ReturnType<WebPorts["record"]["threadMessages"]>>;
  /** Whether the boxes a person writes in can be drawn: a token and a minter. */
  readonly forms: boolean;
  readonly reads: HeldReads | null;
  /** A view a person writes in (#220 S1). */
  readonly onThreads: boolean;
  readonly inbox: Awaited<ReturnType<typeof gatherInbox>> | null;
  /** The laps on the *waiting on you* side, and the rest that are not over. */
  readonly waiting: readonly IterationRecord[];
  readonly running: readonly IterationRecord[];
  readonly terminal: readonly IterationRecord[];
  readonly ledger: Awaited<ReturnType<WebPorts["store"]["laneLedger"]>>;
  readonly threads: Threads;
  readonly owes: Awaited<ReturnType<typeof draftsOwedNow>>;
  readonly waits: readonly Wait[];
  readonly waitingCount: number;
  readonly allLapsByRequest: ReadonlyMap<string, LapUnderRequest[]>;
  readonly lapUnder: (messageId: string) => LapUnderRequest | null;
  readonly lapsUnder: (messageId: string) => LapUnderRequest[];
  readonly placeOf: (record: IterationRecord | null) => string | null;
  readonly partsOfRequest: (messageId: string) => readonly PartView[];
  readonly requestsList: RequestList;
}

/** The rows every view is drawn off, read once per draw. */
export async function pageModel(
  ports: WebPorts,
  token: string | null,
  view: PageView,
  wording: Chrome,
  newId: MintMessageId | null,
): Promise<PageModel> {
  const nowMs = ports.now();
  // **Read on every view**: the summary counts the asks waiting and the header
  // counts them for every view. A thread that will not read is said, never
  // drawn half (see `threadMessages`).
  const threadRead = await ports.record.threadMessages();
  const forms = token !== null && newId !== null;
  /**
   * **What this page knows about reading English-held text** (rondo#490): the
   * stored readings in its language, read once, and whether the press may be
   * drawn. Null on an English page, where there is nothing to read it into.
   */
  const reads: HeldReads | null =
    wording.lang === "en"
      ? null
      : {
          done: readingsByDigest(await ports.record.translations(wording.lang)),
          press: token !== null && ports.translating === true,
          nowMs,
        };
  /**
   * **A view a person writes in.** Since D-0083 rule 3 the summary is a
   * request's thread with the boxes in it, so it is one of these: a reload
   * would throw a half-written draft away, which is what this decides
   * (#220 S1).
   */
  const onThreads = view.kind === "requests" || view.kind === "thread" || view.kind === "summary";
  const inbox = ports.actorId === null ? null : await gatherInbox(ports, ports.actorId);
  const live: LiveRow[] = (await ports.store.readLive()).flatMap((outcome): LiveRow[] => {
    switch (outcome.kind) {
      case "read":
        return [{ kind: "read", record: outcome.record }];
      case "unreadable":
        return [{ kind: "unreadable", id: outcome.id, reason: outcome.reason }];
      default:
        return [];
    }
  });
  // **The whole terminal history, and the last few of it** (rondo#244, Codex):
  // the summary's *what just finished* is the last five, while the requests
  // list is not bounded at all -- so a request whose lap fell out of those five
  // would have gone back to saying nothing about it. The slice is the summary's
  // and not the store's.
  const terminal = (await ports.store.terminalIterations()).flatMap((outcome): IterationRecord[] =>
    outcome.kind === "read" ? [outcome.record] : [],
  );
  // **The ledger, read once per draw** (D-0073 rule 12): what each line keeps,
  // and whether its work landed. A finished line still keeping its files is
  // listed however long ago it ended: it is the one ended thing that still
  // costs other work something, so it cannot fall off *just finished*.
  const ledger = await ports.store.laneLedger();
  // Named apart from `lineOf`, which is a message's first line: this is the
  // ledger line a lap belongs to.
  const lineFor = new Map(ledger.flatMap((line) => line.lapIds.map((id) => [id, line] as const)));
  /** A finished line keeping its files, said on its closed tips' rows. */
  const keeping = (record: IterationRecord) => {
    const line = lineFor.get(record.id);
    return line !== undefined &&
      !line.inFlight &&
      line.paths.length > 0 &&
      line.claimId !== null &&
      line.closedTips.includes(record.id)
      ? line
      : null;
  };
  const ended = endedRecently(terminal);
  // Older than *just finished* and still keeping files: its own group, so an
  // ending from weeks ago is not said to have just happened.
  const keptOlder = terminal
    .filter((record) => keeping(record) !== null && !ended.includes(record))
    .toSorted((left, right) => right.updatedAtMs - left.updatedAtMs);
  const waiting: IterationRecord[] = [];
  const running: IterationRecord[] = [];
  for (const row of live) {
    if (row.kind !== "read") {
      continue;
    }
    const side = isTerminal(row.record.status)
      ? null
      : WAIT_SIDE[row.record.status as NonTerminalStatus];
    (side === "waitingOnYou" ? waiting : running).push(row.record);
  }
  const unreadable = live.filter((row) => row.kind === "unreadable");
  const threadRows = threadRead.kind === "read" ? threadRead.messages : [];
  const threads = threadsOf(
    threadRows,
    new Set([...waiting, ...running, ...keptOlder, ...ended, ...unreadable].map((row) => row.id)),
    // A reader that will not answer says nothing is waiting, rather than
    // taking the page down with it.
    ports.issuesUnread === undefined
      ? new Map()
      : await ports.issuesUnread(threadRows).catch(() => new Map()),
  );
  /**
   * **Whose turn it is, read once and read here** (rondo#311).
   *
   * This was a local expression inside the list's `map`, which was fine while
   * the screen was the only thing that asked. It is not any more: the host
   * reaches a person who is not looking at the screen off the same question
   * (`src/access/reach.ts`), and an open tab rings off it. A second reading of
   * *is it my turn* would eventually send somebody to a screen with nothing
   * waiting on it -- #206's failure, which is this page and the store
   * disagreeing about an open question, with a person's attention spent on it.
   *
   * **Any lap of the request, not the one that speaks for it** (Codex, from
   * when this was written here): `saysMore` would let a newer running lap hide
   * an older one still at its gate, and the request would drop out of *your
   * turn* -- and out of D-0083 rule 3's selection -- with an unanswered
   * question on it. `waitsOnYou` reads every lap for that reason.
   */
  /** The drafts rondo still owes, read once for the thread, its right face and the list (rondo#495). */
  const owes = await draftsOwedNow(ports);
  /** Drafted scopes ready for the person's approval (rondo#534), by the thread card's conditions. */
  const scopeWaits = await scopesAwaitingYou(
    {
      record: ports.record,
      // A reckoning that will not read draws the card, as the thread does.
      unheld: async (id) =>
        ports.repositoryFor === undefined
          ? false
          : (await ports.repositoryFor(id).catch(() => null))?.work.kind === "unheld",
    },
    threads,
    [...waiting, ...running, ...terminal],
    owes,
  );
  const waits = [...waitsOnYou(threads, [...waiting, ...running]), ...scopeWaits];
  /** The requests of those, which is the row the list draws and the person opens. */
  const turnsHere = new Set(waits.map((wait) => wait.root));
  // **Only the ones an answer can settle** (D-0032 rule 5). `openProposals`
  // returns every proposal nobody has decided, and an explanation is
  // undecidable by construction -- `recordDecision` refuses the non-binding
  // kinds -- so every press this page makes would leave a row here for ever and
  // the count would climb with each approval. The test is
  // `isApprovableKind`, the closed set the compiler checks, which is what
  // `inbox` splits on too; the rest are in the reading, in the inbox's own two
  // sections, where they are material rather than a queue.
  // One whose successor identity another lap already holds is not counted
  // either: approving it cannot run anything (D-0176, `waitingBinding`).
  const open = inbox === null ? [] : waitingBinding(inbox.open, inbox.taken);
  // **One count of what waits on the person** (#220 S1): the header pill and the
  // summary's *waiting for your answer* heading both say this number -- gates,
  // questions in threads, and proposals an answer can settle -- so they cannot
  // disagree.
  // A question answered *stop this line* is held but no longer waits on the
  // person (D-0110 rule 2), as in `waitsOnYou`.
  // A drafted scope ready to approve is one more (rondo#534).
  const waitingCount =
    waiting.length + threads.waiting.size - threads.stopped.size + open.length + scopeWaits.length;

  /** The link onto the scope screen, drawn on a request wherever one is listed. */
  // **Which request each lap is under** (rondo#244), off the rows already
  // read: a lap names the request it was started from, so the requests list
  // can say what became of one instead of going on offering the entrance.
  // Newest wins, which is the same order every other list here is in.
  const lapsByRequest = new Map<string, LapUnderRequest>();
  /**
   * **Every lap of a request and not only the one that says most** (Codex).
   * `saysMore` picks one row to speak for a request in a list, which is what a
   * row is; the thread is the request itself, so it draws every lap's events,
   * and the box is offered for whichever lap is at a gate -- a request with a
   * running retry beside a lap still waiting would otherwise have no way to
   * answer the one that waits, now that there is no per-lap address.
   */
  const allLapsByRequest = new Map<string, LapUnderRequest[]>();
  for (const [question, group] of [
    ["waiting", waiting],
    ["running", running],
    ["ended", terminal],
  ] as const) {
    for (const record of group) {
      const request = record.requestMessageId;
      if (saysMore({ record, question }, lapsByRequest.get(request))) {
        lapsByRequest.set(request, { record, question });
      }
      allLapsByRequest.set(request, [
        ...(allLapsByRequest.get(request) ?? []),
        { record, question },
      ]);
    }
  }
  const lapUnder = (messageId: string) => lapsByRequest.get(messageId) ?? null;
  const lapsUnder = (messageId: string) => allLapsByRequest.get(messageId) ?? [];

  /*
   * **Where the page names a repository, and where it stays unsaid**
   * (D-0081 rule 4.2 and its gate's answer 4, rondo#305). One store serves
   * several repositories, and the work of all of them is one list -- so the
   * repository is drawn where the person could not otherwise tell two things
   * apart, and nowhere else. What tells two of these apart otherwise is the
   * person's own words: every face draws a request by the first line of the
   * message that opened it, so that line is the key, and the place is said
   * only where two requests on the list read the same without it.
   *
   * **A request is one entry, whatever has run under it.** The key is the
   * request's own title, so a request whose laps ran in two repositories is
   * counted once and names neither: there is one request on the list, and
   * nothing to mistake it for. A request nothing has run for is in the set
   * too -- it is drawn, and its title is one another's can read the same as.
   *
   * The set is the whole of the list this page read, so one answer holds
   * across the faces: a row, the running work beside an empty centre and the
   * line under a request's title never disagree about whether the place is
   * worth saying.
   */
  const titleUnder = (record: IterationRecord): string =>
    firstLine(threads.byId.get(record.requestMessageId)?.body ?? record.request);
  const listedTitles: string[] = threads.messages
    .filter((message) => message.inReplyTo === null)
    .map((root) => firstLine(root.body));
  const placeOf = (record: IterationRecord | null): string | null =>
    record === null
      ? null
      : placeSaid(
          { otherwise: titleUnder(record), repository: repositoryOf(record) },
          listedTitles,
        );

  /*
   * **A request run as several lines** (D-0098 rule 8, D-0129): the parts of
   * its approved split, each with its laps, read once for the list's row, the
   * line under the title and the right face's steps.
   */
  const lapById = new Map(
    [...allLapsByRequest.values()].flat().map((lap) => [lap.record.id, lap.record] as const),
  );
  const lapsOfLine = (lineageId: string): readonly IterationRecord[] =>
    (ledger.find((line) => line.lineageId === lineageId)?.lapIds ?? [lineageId])
      .flatMap((id) => lapById.get(id) ?? [])
      .toSorted((left, right) => left.createdAtMs - right.createdAtMs);
  const partsByRequest = new Map<string, readonly PartView[]>(
    await Promise.all(
      threads.messages
        .filter((message) => message.inReplyTo === null)
        .map(async (root) => {
          const parts = await partsOf(ports, root.messageId);
          const proposalId = parts[0]?.proposalId ?? "";
          return [
            root.messageId,
            partViews(parts, {
              lapsOf: lapsOfLine,
              resultOf: (id) => resultOf(threads.byId, id),
              placeOf: placeName,
              // Rule 1.5's question about the part: standing, or answered *stop*.
              askOf: (index) => {
                const asks = [...threads.waiting].filter(
                  (id) =>
                    threads.rootOf(id) === root.messageId &&
                    id.startsWith(unlandedPrefix({ proposalId }, index)),
                );
                const open = asks.find((id) => !threads.stopped.has(id));
                return open !== undefined ? { open } : asks.length > 0 ? "dropped" : null;
              },
            }),
          ] as const;
        }),
    ),
  );
  const partsOfRequest = (messageId: string) => partsByRequest.get(messageId) ?? [];
  /*
   * **Work approved and not begun outranks a stopped lap** (rondo#512): a
   * request whose split was drafted again after its lap stopped, and approved,
   * has not been given up, whatever that lap's ending says.
   */
  const unstarted = new Set(
    (
      await Promise.all(
        threads.messages
          .filter((message) => message.inReplyTo === null)
          .map(async (root) =>
            (await approvedUnstarted(ports, root.messageId)) ? [root.messageId] : [],
          ),
      )
    ).flat(),
  );

  /*
   * **rondo's turn on the list as in the thread** (rondo#495 item 3): a request
   * with no lap whose draft rondo still owes, by the thread card's own
   * predicate. Asked only of the owed ones, so the rest cost nothing.
   */
  const drafting = new Set(
    (
      await Promise.all(
        threads.messages
          .filter(
            (message) =>
              message.inReplyTo === null &&
              owes(message.messageId) &&
              lapUnder(message.messageId) === null,
          )
          .map(async (root) =>
            draftingOver(await scopeStanding(ports, root.messageId), true) ? [root.messageId] : [],
          ),
      )
    ).flat(),
  );

  /*
   * **The left face's rows** (D-0083 rules 2, 5 and 7). Every request the
   * store holds, named by the person's own words, with the repository its
   * work is in and one sentence of state. What waits on the person is lifted
   * out of the time order by `requestList`; everything else is cut by day.
   */
  const listRows = threads.messages
    .filter((message) => message.inReplyTo === null)
    .map((root) => {
      const members = threads.messages.filter(
        (message) => threads.rootOf(message.messageId) === root.messageId,
      );
      const lap = lapUnder(root.messageId);
      return {
        messageId: root.messageId,
        title: firstLine(root.body),
        repository: placeOf(lap?.record ?? null),
        state: ((state) =>
          state === "stopped" && unstarted.has(root.messageId)
            ? "notStarted"
            : state === "notStarted" && drafting.has(root.messageId)
              ? "drafting"
              : state)(
          rowStateOf(lap?.record ?? null, turnsHere.has(root.messageId), (record) =>
            isTerminal(record.status),
          ),
        ),
        // What an approved row goes on to say: published or not, and its
        // checks (rondo#376). Read for every row, since it is a map lookup.
        published: lap === null ? null : resultOf(threads.byId, lap.record.id),
        parts: (() => {
          const parts = partsOfRequest(root.messageId);
          return parts.length === 0 ? null : partCounts(parts);
        })(),
        atMs: Math.max(...members.map((message) => message.atMs)),
      };
    });
  const requestsList = requestList(listRows, inbox?.sinceMs ?? null, nowMs);
  return {
    nowMs,
    threadRead,
    forms,
    reads,
    onThreads,
    inbox,
    waiting,
    running,
    terminal,
    ledger,
    threads,
    owes,
    waits,
    waitingCount,
    allLapsByRequest,
    lapUnder,
    lapsUnder,
    placeOf,
    partsOfRequest,
    requestsList,
  };
}

/**
 * **What was agreed for this request** (D-0083 rule 6), read for the one lap
 * the centre is drawing and for no other: the approval the lap spends, and
 * what has been spent against it. Both or neither -- rule 6 refuses a spent
 * figure without the figure it was approved against, and `governanceOf`
 * takes them as one argument for that reason.
 */
export async function approvalOf(
  ports: WebPorts,
  record: IterationRecord,
): Promise<{ decisionId: string; payload: ScopePayload; spent: ScopeSpent } | null> {
  const tip = await approvalTip(ports.record, record.id);
  if (tip.kind !== "tip") {
    return null;
  }
  const decided = await ports.record.readScopeDecision(tip.scopeDecisionId);
  if (decided.kind !== "read") {
    return null;
  }
  const stored = await ports.record.readScope(decided.decision.scopeId);
  if (stored.kind !== "read") {
    return null;
  }
  return {
    // **The approval's own id, for the week's sum** (rule 4): several laps
    // of one request spend one approval, so a week that added them up per
    // lap would count the same allowance as many times as it was retried.
    decisionId: tip.scopeDecisionId,
    payload: stored.scope.payload,
    spent: await ports.record.scopeSpent(tip.scopeDecisionId),
  };
}

/**
 * **What rondo would ask for next** (D-0097), read here and drawn on the
 * empty centre, on the goal page, in the box a person took a candidate into,
 * and as one line in a finished thread. Reads only: the host writes the rows.
 */
export async function triageModel(
  ports: WebPorts,
  threads: Threads,
): Promise<Required<TriageReads>> {
  const triageRepositories = (await ports.triageRepositories?.()) ?? [];
  const goals = triageRepositories.length === 0 ? [] : await ports.record.goals();
  /*
   * **Whether rondo works toward each goal on its own** (D-0128): the goal
   * scope in force over the newest goal of each repository, and the requests
   * the flow already started, so a candidate it started reads *started*.
   */
  const goalScopes = new Map<string, GoalScopeState>();
  for (const goal of currentGoals(goals).values()) {
    const standing = await goalScopeStanding(ports.record, goal.goalId);
    if (standing.kind === "none") continue;
    // Green only while the flow can start or runs (rondo#488).
    const stop =
      standing.kind === "running"
        ? await flowStopOf(ports.record, threads.messages, goal.goalId, standing.scopeDecisionId)
        : null;
    goalScopes.set(
      goal.goalId,
      stop === null ? { state: standing.kind } : { state: "stopped", stop },
    );
  }
  const flowOpeners = threads.messages.flatMap((message) =>
    opensFlowRequest(message)
      ? message.bases.flatMap((basis) =>
          basis["form"] === "goal" && typeof basis["goalId"] === "string"
            ? [{ messageId: message.messageId, goalId: basis["goalId"] }]
            : [],
        )
      : [],
  );
  const latestTriage = triageRepositories.length === 0 ? [] : await ports.record.latestTriage();
  const flowAsks = goalScopes.size === 0 ? [] : await ports.record.flowAsks();
  const putAside = latestTriage.length === 0 ? [] : await ports.record.triageDeclines();
  const triagePayloads = new Map(
    latestTriage.flatMap((row): [string, TriagePayload][] => {
      const payload = readTriagePayload(row.payload);
      return payload === null ? [] : [[row.proposalId, payload]];
    }),
  );
  return {
    repositories: triageRepositories,
    goals,
    latest: latestTriage,
    payloads: triagePayloads,
    goalScopes,
    flowOpeners,
    flowAsks,
    putAside,
  };
}
