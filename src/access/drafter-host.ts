/**
 * When the model drafter runs, and what a finished run writes (D-0071 section
 * 3 and rule 7.3), in the resident host -- today the `rondo web` process.
 *
 * **Work is found by rows, not by a queue** (rule 3.2). A request is due when
 * an operator message in its thread is covered by no drafter row: no proposal
 * row this drafter wrote lists it under its snapshot's `covers`, and no message
 * of an unavailable run cites it. Every finished run writes one of the two, so
 * nothing stays due after a run over it, a restart loses nothing, and a message
 * the command line wrote while the host runs is found by the next scan.
 *
 * **A row covers a message only with the issue reads it held** (`D-0131` rule
 * 1): a `forge` message answering the operator message that was not in the
 * covering row's own material makes the request due again, so a draft composed
 * before a bare `#N` could be read is composed once more with the issue in its
 * document.
 *
 * **One run at a time, and a stale run writes nothing** (rule 3.3): runs are
 * taken one after another, which is at most one per thread, and the store
 * refuses a write whose thread gained an operator message after its document
 * was assembled; the next scan runs it again over the new thread.
 *
 * **Nobody waits on it** (rule 3.4): {@link DrafterHost.kick} returns at once,
 * and the draft lands as a row the page reads on its next poll.
 */

import {
  asksForWork,
  opensFlowRequest,
  type ProposalDraft,
  requestsGoal,
  type ThreadMessageDraft,
  WORKER_QUESTION_AUTHOR,
} from "../store/records.js";
import type { AdvisoryRecord, StandingPolicyDraft } from "../store/sqlite.js";
import { hostFailure } from "./host-failure.js";
import type { DrafterPorts, DrafterRunResult } from "./model-draft/host.js";
import { draftRequest } from "./model-draft/host.js";
import {
  type DraftedMessage,
  type DraftedPolicy,
  MODEL_DRAFTER_PREFIX,
  POLICY_NOTE_AUTHOR,
  REDRAFT_AUTHOR,
  REPOSITORY_PROPOSAL_AUTHOR,
} from "./model-draft/judgement.js";

const DRAFTER_PREFIX = MODEL_DRAFTER_PREFIX;

/**
 * How long a thread's lease is held (rule 3.3): past the drafter's own timeout
 * (`./forge.ts`), so a live run never loses its lease, and short enough that a
 * host that died holding one frees its thread within a quarter hour.
 */
const LEASE_MS = 15 * 60 * 1000;

/** What the host reaches, as values a test can replace. */
export interface DrafterHostPorts extends DrafterPorts {
  readonly record: DrafterPorts["record"] &
    Pick<
      AdvisoryRecord,
      | "recordDraft"
      | "draftedMessageIds"
      | "claimDraft"
      | "releaseDraft"
      | "messagesBeforeDrafter"
      | "scopesFor"
      | "standingPolicies"
      | "policySources"
    >;
  /** A fresh row id with a readable prefix, as the page mints its own. */
  readonly mintId: (
    kind: "draft" | "drafted-scope" | "drafter" | "drafter-host" | "policy",
  ) => string;
  /** The language the host's operator reads, or null (`RONDO_OPERATOR_LANGUAGE`). */
  readonly language: string | null;
  /** One line for the host's terminal. */
  readonly log: (line: string) => void;
  /** Tests replace the run; the host runs the real one. */
  readonly draft?: typeof draftRequest;
  /**
   * The operator messages still waiting on an issue read (D-0078 section 3.3):
   * a request with one is not due until every reference has its `forge`
   * message. Absent where no reader runs, and then nothing waits.
   */
  readonly issuesUnread?: (
    messages: readonly ThreadMessageDraft[],
  ) => Promise<ReadonlyMap<string, unknown>>;
  /**
   * Whether a request names a repository rondo holds no plan for (rondo#383,
   * D-0090 rule 1): such a request is not due until the person adds it from
   * the page, so no draft is composed in a repository the work is not in.
   * Absent where nothing asks, and then nothing waits.
   */
  readonly awaitsRepository?: (requestMessageId: string) => Promise<boolean>;
  /**
   * Whether a *carry on* to this ask starts the lap it stopped again (D-0149,
   * D-0139): then an answer to it is not drafted, since the start is its work.
   * Absent where nothing starts a lap again, and then every answer is drafted.
   */
  readonly startsAgain?: (ask: ThreadMessageDraft) => Promise<boolean>;
}

export interface DrafterHost {
  /** Look for due requests now. Returns at once; runs already in flight are joined. */
  kick(): void;
  /** Resolves once no scan or run is in flight: for tests and for a clean shutdown. */
  idle(): Promise<void>;
  /**
   * The requests this host still owes a draft (rondo#495): due, being drafted,
   * or waiting on an issue read first. The page reads it so it does not offer a
   * scope before rondo's plan exists. Throws where the threads cannot be read.
   */
  owed(): Promise<ReadonlySet<string>>;
}

export function drafterHost(ports: DrafterHostPorts): DrafterHost {
  const draft = ports.draft ?? draftRequest;
  // A request whose write could not be made at all, by the latest operator
  // message it was run over: not run again until the person writes again
  // (rule 1.5's "not retried"), so a store that refuses does not cost a draft
  // on every scan.
  const givenUp = new Map<string, string>();
  // Said once per host, so the terminal says why old threads sit undrafted.
  let saidPast = false;
  // Who this process is to the lease (rule 3.3), so a second host over the
  // same store does not pay for a thread this one is already drafting.
  const holder = ports.mintId("drafter-host");
  let running: Promise<void> | null = null;
  let again = false;

  const loop = async (): Promise<void> => {
    while (again) {
      again = false;
      let due: readonly Due[];
      try {
        const scanned = await scan(ports, givenUp);
        due = scanned.due;
        if (!saidPast && scanned.past > 0) {
          saidPast = true;
          ports.log(
            `drafter  ${String(scanned.past)} request thread(s) predate the drafter on this store and ` +
              "are not drafted: nothing is spent on them unless the person replies in one",
          );
        }
      } catch (error) {
        ports.log(`drafter  the threads could not be scanned: ${describe(error)}`);
        return;
      }
      for (const one of due) {
        // One request's failure is logged and costs only that request: a
        // throw here would end the page's process with it.
        let written: "written" | "stale" | "failed" | "held";
        try {
          const nowMs = ports.now();
          if (
            !(await ports.record.claimDraft(one.requestMessageId, holder, nowMs, nowMs + LEASE_MS))
          ) {
            written = "held";
          } else {
            try {
              // Still due now that it is ours: the list was read before the
              // runs ahead of it, and another host may have drafted it since.
              const still = (await scan(ports, givenUp)).due.some(
                (d) => d.requestMessageId === one.requestMessageId,
              );
              written = still
                ? await write(ports, await draft(ports, one.requestMessageId, ports.language))
                : "held";
            } finally {
              await ports.record.releaseDraft(one.requestMessageId, holder);
            }
          }
        } catch (error) {
          // **A throw is a fault of the moment** -- a locked database, a
          // lease that could not be taken -- and not the store answering this
          // draft: the request stays due for the next scan. Only a refusal
          // `write` returned is given up on (rule 1.5).
          ports.log(
            `drafter  ${one.requestMessageId}: ${describe(error)}; tried again on the next scan`,
          );
          written = "held";
        }
        if (written === "stale") {
          again = true;
        } else if (written === "failed") {
          givenUp.set(one.requestMessageId, one.operatorKey);
        }
      }
    }
  };

  const kick = (): void => {
    again = true;
    if (running === null) {
      running = loop().finally(() => {
        running = null;
        // A kick that landed after the loop's last look and before this
        // reaction would otherwise wait for the next rescan.
        if (again) {
          kick();
        }
      });
    }
  };
  return {
    kick,
    owed: async () => (await scan(ports, givenUp)).owed,
    async idle() {
      while (running !== null) {
        await running;
      }
    },
  };
}

interface Due {
  readonly requestMessageId: string;
  /** The thread's operator messages, as one key: what a give-up is keyed on. */
  readonly operatorKey: string;
}

/**
 * Every request with an operator message no drafter row covers, oldest first,
 * and how many request threads hold only messages from before the drafter.
 */
async function scan(
  ports: DrafterHostPorts,
  givenUp: ReadonlyMap<string, string>,
): Promise<{
  readonly due: readonly Due[];
  readonly owed: ReadonlySet<string>;
  readonly past: number;
}> {
  const read = await ports.record.threadMessages();
  if (read.kind !== "read") {
    throw new Error(read.reason);
  }
  const covered = await ports.record.draftedMessageIds(DRAFTER_PREFIX);
  // **The past is not drafted unasked**: a message written before a drafter
  // host first ran here makes no thread due. A reply the person writes now
  // does, and that run reads the whole thread, old messages included.
  const before = await ports.record.messagesBeforeDrafter(ports.now());
  const parent = new Map(read.messages.map((m) => [m.messageId, m.inReplyTo]));
  const rootOf = (id: string): string => {
    let at = id;
    for (let hops = 0; hops < read.messages.length; hops += 1) {
      const up = parent.get(at);
      if (up === undefined || up === null) {
        return at;
      }
      at = up;
    }
    return at;
  };
  const unread =
    ports.issuesUnread === undefined ? new Map() : await ports.issuesUnread(read.messages);
  const operatorIds = new Map<string, string[]>();
  const uncovered = new Set<string>();
  // A draft is never composed while a read is still to come (D-0078 section 3.3).
  const reading = new Set<string>();
  const past = new Set<string>();
  for (const m of read.messages) {
    // The flow host's opener is due as a person's message is (rondo#469): a
    // goal scope a person approved stands behind it (D-0128 rule 5).
    if (
      !asksForWork(m) ||
      answersWorkerQuestion(m, read.messages) ||
      stopsDrafterAsk(m, read.messages) ||
      (await answersStartAgain(ports, m, read.messages))
    ) {
      continue;
    }
    const root = rootOf(m.messageId);
    // A root that is not an operator's opening message, or the flow's, opens no request.
    const opening = read.messages.find((one) => one.messageId === root);
    if (opening === undefined || !asksForWork(opening) || opening.inReplyTo !== null) {
      continue;
    }
    operatorIds.set(root, [...(operatorIds.get(root) ?? []), m.messageId]);
    if (unread.has(m.messageId)) {
      reading.add(root);
    }
    if (!covered.has(m.messageId)) {
      (before.has(m.messageId) ? past : uncovered).add(root);
    }
  }
  const due: Due[] = [];
  const owed = new Set<string>();
  for (const root of uncovered) {
    const key = [...(operatorIds.get(root) ?? [])].sort().join("\n");
    if (
      givenUp.get(root) !== key &&
      (ports.awaitsRepository === undefined || !(await ports.awaitsRepository(root)))
    ) {
      // Reading an issue first is still rondo's turn (rondo#495): owed, not yet due.
      owed.add(root);
      if (!reading.has(root)) {
        due.push({ requestMessageId: root, operatorKey: key });
      }
    }
  }
  return { due, owed, past: [...past].filter((root) => !uncovered.has(root)).length };
}

/**
 * Whether `m` is the person's answer to a worker's question (D-0142): its
 * words go to the next lap by the revise its press makes (D-0098 rule 4.5), so
 * drafting them as well would start the same work twice. It is still in the
 * thread a later run reads.
 */
function answersWorkerQuestion(
  m: ThreadMessageDraft,
  messages: readonly ThreadMessageDraft[],
): boolean {
  return (
    m.answerOutcome !== undefined &&
    messages.some(
      (asked) => asked.messageId === m.inReplyTo && asked.authorId === WORKER_QUESTION_AUTHOR,
    )
  );
}

/**
 * Whether `m` is a *stop* on the drafter's own ask (D-0190 rule 8): the person
 * declined every option, so drafting again would put the same ask back. It is
 * still in the thread, and a later operator message makes the request due again.
 */
function stopsDrafterAsk(m: ThreadMessageDraft, messages: readonly ThreadMessageDraft[]): boolean {
  return (
    m.answerOutcome === "stop" &&
    messages.some(
      (asked) =>
        asked.messageId === m.inReplyTo &&
        asked.asks &&
        asked.authorKind === "drafter" &&
        asked.authorId.startsWith(MODEL_DRAFTER_PREFIX),
    )
  );
}

/**
 * Whether `m` answers a stop whose lap a *carry on* starts again (D-0149):
 * either outcome, as for a worker's question. A *carry on* starts the lap with
 * the person's words, and a *stop* ends the line; drafting either would start
 * work nobody asked for. It is still in the thread a later run reads.
 */
async function answersStartAgain(
  ports: DrafterHostPorts,
  m: ThreadMessageDraft,
  messages: readonly ThreadMessageDraft[],
): Promise<boolean> {
  if (m.answerOutcome === undefined || ports.startsAgain === undefined) {
    return false;
  }
  const asked = messages.find((one) => one.messageId === m.inReplyTo);
  return asked !== undefined && (await ports.startsAgain(asked));
}

/**
 * Write one finished run (D-0071 rule 7.3), or say why not. A drafted write the
 * store refuses becomes an unavailable run naming the refusal, because a run
 * that passed rondo's own check and still wrote nothing would leave its
 * messages due for ever.
 */
async function write(
  ports: DrafterHostPorts,
  result: DrafterRunResult,
): Promise<"written" | "stale" | "failed" | "held"> {
  const material = result.material;
  if (material === null) {
    // **Nothing was read, so nothing was spent or written**: a store that would
    // not read is a fault of the moment, and the request stays due for the next
    // scan rather than being given up on (Codex round 4 on rondo#264).
    ports.log(
      `drafter  nothing was written: ${result.outcome.kind === "unavailable" ? result.outcome.reason : "no material"}; tried again on the next scan`,
    );
    return "held";
  }
  const operatorIds = material.thread.filter(asksForWork).map((m) => m.messageId);
  const latestOperatorMessageId = operatorIds[operatorIds.length - 1] as string;
  const nowMs = ports.now();
  const cost = result.costUsd === null ? "cost not reported" : `$${result.costUsd.toFixed(4)}`;

  const unavailable = async (reason: string): Promise<"written" | "stale" | "failed" | "held"> => {
    const covered = await ports.record.draftedMessageIds(DRAFTER_PREFIX);
    const cites = operatorIds.filter((id) => !covered.has(id));
    const outcome = await ports.record.recordDraft({
      requestMessageId: material.requestMessageId,
      operatorMessageIds: operatorIds,
      drafterPrefix: DRAFTER_PREFIX,
      proposal: null,
      scope: null,
      messages: [
        {
          messageId: ports.mintId("drafter"),
          // Composed by rondo and not by the model, so it states only what
          // rondo knows: that there is no draft, and why.
          body: `rondo's drafter wrote no draft for this: ${reason}`,
          authorKind: "drafter",
          authorId: result.drafter,
          inReplyTo: latestOperatorMessageId,
          atMs: nowMs,
          // **And the reads this run's material held** (`D-0131` rule 1): an
          // unavailable run writes no proposal, so its message's citations are
          // the only record of what it was handed. Without them the next scan
          // would find the thread due over the same read for ever.
          bases: [
            ...(cites.length === 0 ? [latestOperatorMessageId] : cites),
            ...material.thread.flatMap((m) => (m.authorKind === "forge" ? [m.messageId] : [])),
          ].map((messageId) => ({ form: "message", messageId })),
          asks: false,
        },
      ],
    });
    if (outcome.kind === "stale") {
      return "stale";
    }
    if (outcome.kind === "covered") {
      return "written";
    }
    if (outcome.kind !== "recorded") {
      ports.log(`drafter  ${material.requestMessageId}: nothing was written: ${outcome.reason}`);
      return "failed";
    }
    ports.log(`drafter  ${material.requestMessageId}: no draft (${cost}): ${reason}`);
    return "written";
  };

  if (result.outcome.kind === "unavailable") {
    // **A run the model answered or failed is drafted once more** (rondo#554,
    // D-0160, narrowing D-0071 rule 1.5): a refused draft otherwise leaves the
    // request with no drafted claim, and its start would take the whole
    // repository. A refusal before the model (`document` null: material over
    // the bound, not an opener) would only come out the same. Counted in the
    // store, by the note under the latest operator message, so a restart
    // does not draft it a third time.
    const thread = await ports.record.threadMessages();
    const retried =
      thread.kind !== "read" ||
      thread.messages.some(
        (m) =>
          m.authorKind === "drafter" &&
          m.authorId === REDRAFT_AUTHOR &&
          m.inReplyTo === latestOperatorMessageId,
      );
    if (result.document !== null && !retried) {
      const outcome = await ports.record.recordDraft({
        requestMessageId: material.requestMessageId,
        operatorMessageIds: operatorIds,
        drafterPrefix: DRAFTER_PREFIX,
        proposal: null,
        scope: null,
        messages: [
          {
            messageId: ports.mintId("drafter"),
            body: `rondo's drafter wrote no draft for this, so rondo drafts it once more: ${result.outcome.reason}`,
            authorKind: "drafter",
            authorId: REDRAFT_AUTHOR,
            inReplyTo: latestOperatorMessageId,
            atMs: nowMs,
            bases: [{ form: "message", messageId: latestOperatorMessageId }],
            asks: false,
          },
        ],
      });
      if (outcome.kind === "recorded") {
        ports.log(
          `drafter  ${material.requestMessageId}: no draft (${cost}), drafted once more: ${result.outcome.reason}`,
        );
        // Run again now: the note covers nothing, so the request is still due.
        return "stale";
      }
      if (outcome.kind === "stale" || outcome.kind === "covered") {
        return outcome.kind === "stale" ? "stale" : "written";
      }
      ports.log(`drafter  ${material.requestMessageId}: nothing was written: ${outcome.reason}`);
      return "failed";
    }
    return await unavailable(result.outcome.reason);
  }
  const drafted = result.outcome;
  if (drafted.repository !== undefined) {
    return await proposeRepository(
      ports,
      result.drafter,
      material,
      drafted,
      drafted.repository,
      cost,
    );
  }
  // **A request a goal scope covers is drafted a split and no scope of its own**
  // (rondo#469): the goal scope is its approval, and D-0127's tick starts it.
  const opener = material.thread.find((m) => m.messageId === material.requestMessageId);
  const underGoal =
    opener !== undefined &&
    opensFlowRequest(opener) &&
    (await ports.record.scopesFor(material.requestMessageId)).some(
      (scope) => requestsGoal(scope.payload.requests) !== null,
    );
  const draftedScope = underGoal ? null : drafted.scope;
  const proposalId = ports.mintId("draft");
  const onProposal = { form: "proposal", proposalId };
  const proposal: ProposalDraft = {
    proposalId,
    kind: "split",
    drafter: result.drafter,
    // Rule 7.3: written even when the run drafts nothing -- plans, holes, or neither.
    payload: (drafted.split ?? { plans: [], holes: [] }) as unknown as ProposalDraft["payload"],
    // Rule 2.3: the document as handed over, beside the material it was
    // rendered from so the computed scope re-derives from the row (rule 7.1),
    // the operator messages the run covers (rule 3.2), and what it cost.
    snapshot: {
      covers: operatorIds,
      document: result.document,
      material: material as unknown as ProposalDraft["snapshot"],
      cost_usd: result.costUsd,
      // Which stated value won each narrowed field, and on whose words
      // (D-0071 rule 4.1): what the scope screen cites beside that field.
      narrowed: (draftedScope?.narrowed ?? []).map((n) => ({
        field: n.field,
        value: n.value,
        message_id: n.basisMessageId,
      })),
    },
    derivation: null,
    iterationId: null,
    supersedesIterationId: null,
    supersedesProposalId: null,
    predecessorPlanDigest: null,
    predecessorContractDigest: null,
    agentTypeDigest: null,
    configDigest: null,
    contractDigest: null,
    continuoRevision: null,
    cadenzaRevision: null,
    elevatedFromMessageId: null,
    elevatedByActorId: null,
    createdAtMs: nowMs,
  };
  const messages: ThreadMessageDraft[] = drafted.messages.map((message) => ({
    messageId: ports.mintId("drafter"),
    body: message.body,
    authorKind: "drafter",
    authorId: result.drafter,
    inReplyTo: latestOperatorMessageId,
    atMs: nowMs,
    bases: [
      ...message.bases.map((messageId) => ({ form: "message", messageId })),
      ...(message.policies ?? []).map((policyId) => ({ form: "policy", policyId })),
      onProposal,
    ],
    asks: message.asks,
    // D-0190 rule 4: the question's options ride beside its body to the write.
    ...(message.askOptions === undefined ? {} : { askOptions: message.askOptions }),
  }));
  const kept = await keptPolicies(ports, result.drafter, drafted, latestOperatorMessageId, nowMs);
  messages.push(...kept.notes);
  const outcome = await ports.record.recordDraft({
    requestMessageId: material.requestMessageId,
    operatorMessageIds: operatorIds,
    drafterPrefix: DRAFTER_PREFIX,
    proposal,
    policies: kept.policies,
    scope:
      draftedScope === null
        ? null
        : {
            scopeId: ports.mintId("drafted-scope"),
            payload: draftedScope.payload,
            supersedesScopeId: null,
            authorKind: "drafter",
            authorId: result.drafter,
            bases: [...draftedScope.bases, onProposal],
            createdAtMs: nowMs,
            agentTypeRecords: draftedScope.agentTypeRecords.map((r) => ({
              agentTypeDigest: r.agentTypeDigest,
              agentTypeInput: r.agentTypeInput,
              planDigest: r.planDigest,
              ...("setupId" in r ? { fromSetupId: r.setupId } : { fromMessageId: r.messageId }),
            })),
          },
    messages,
  });
  if (outcome.kind === "stale") {
    return "stale";
  }
  if (outcome.kind === "covered") {
    ports.log(
      `drafter  ${material.requestMessageId}: already drafted elsewhere; this run wrote nothing`,
    );
    return "written";
  }
  if (outcome.kind !== "recorded") {
    return await unavailable(`the draft could not be recorded: ${outcome.reason}`);
  }
  ports.log(
    `drafter  ${material.requestMessageId}: ${drafted.act} (${cost})` +
      `${draftedScope === null ? (underGoal ? ", under its goal scope" : "") : ", with a drafted scope"}`,
  );
  return "written";
}

/**
 * **Write a `repository` act as rondo's proposal** (D-0191 rule 3.2): the
 * drafter's summary, then the repository's address on a line of its own, under
 * {@link REPOSITORY_PROPOSAL_AUTHOR}. It covers no operator message, so the
 * request is drafted again once the repository is added; until then it waits
 * for `D-0090`'s press, as one the person named does.
 */
async function proposeRepository(
  ports: DrafterHostPorts,
  drafter: string,
  material: NonNullable<DrafterRunResult["material"]>,
  drafted: DraftedPolicies & { readonly messages: readonly DraftedMessage[] },
  repository: string,
  cost: string,
): Promise<"written" | "stale" | "failed" | "held"> {
  const operatorIds = material.thread.filter(asksForWork).map((m) => m.messageId);
  const latest = operatorIds[operatorIds.length - 1] as string;
  const summary = drafted.messages[0];
  const nowMs = ports.now();
  // A policy the person stated beside it is kept now, not after the press.
  const kept = await keptPolicies(ports, drafter, drafted, latest, nowMs);
  const outcome = await ports.record.recordDraft({
    requestMessageId: material.requestMessageId,
    operatorMessageIds: operatorIds,
    drafterPrefix: DRAFTER_PREFIX,
    proposal: null,
    scope: null,
    policies: kept.policies,
    messages: [
      {
        messageId: ports.mintId("drafter"),
        body: `${summary?.body ?? ""}\n\nhttps://github.com/${repository}`,
        authorKind: "drafter",
        authorId: REPOSITORY_PROPOSAL_AUTHOR,
        inReplyTo: latest,
        atMs: nowMs,
        bases: [
          ...(summary?.bases ?? [latest]).map((messageId) => ({ form: "message", messageId })),
          ...(summary?.policies ?? []).map((policyId) => ({ form: "policy", policyId })),
        ],
        asks: false,
      },
      ...kept.notes,
    ],
  });
  if (outcome.kind === "stale" || outcome.kind === "covered") {
    return outcome.kind === "stale" ? "stale" : "written";
  }
  if (outcome.kind !== "recorded") {
    ports.log(`drafter  ${material.requestMessageId}: nothing was written: ${outcome.reason}`);
    return "failed";
  }
  ports.log(`drafter  ${material.requestMessageId}: proposed ${repository} (${cost})`);
  return "written";
}

type DraftedPolicies = { readonly policies?: readonly DraftedPolicy[] };

/**
 * The standing policies one run keeps from the person's words, and the note
 * listing each under them (D-0067 rule 6.2 and its gate's point 2 (a)).
 *
 * **Only from words no earlier run drafted and no policy row rests on**: a
 * message is drafted once, and a policy the person took back stays taken back
 * even where an issue read makes its words due again (Codex on rondo#632).
 */
async function keptPolicies(
  ports: DrafterHostPorts,
  drafter: string,
  drafted: DraftedPolicies,
  inReplyTo: string,
  nowMs: number,
): Promise<{ policies: StandingPolicyDraft[]; notes: ThreadMessageDraft[] }> {
  if ((drafted.policies ?? []).length === 0) {
    return { policies: [], notes: [] };
  }
  const covered = await ports.record.draftedMessageIds(DRAFTER_PREFIX);
  const sources = await ports.record.policySources();
  const policies = (drafted.policies ?? [])
    .filter((policy) => policy.bases.every((id) => !covered.has(id) && !sources.has(id)))
    .map(
      (policy): StandingPolicyDraft => ({
        policyId: ports.mintId("policy"),
        body: policy.body,
        authorKind: "drafter",
        authorId: drafter,
        bases: policy.bases.map((messageId) => ({ form: "message", messageId })),
        supersedesPolicyId: null,
        createdAtMs: nowMs,
      }),
    );
  // Its words, under which the page offers the person a press to take it back.
  const notes = policies.map(
    (policy): ThreadMessageDraft => ({
      messageId: ports.mintId("drafter"),
      body: policy.body,
      authorKind: "drafter",
      authorId: POLICY_NOTE_AUTHOR,
      inReplyTo,
      atMs: nowMs,
      bases: [...policy.bases, { form: "policy", policyId: policy.policyId }],
      asks: false,
    }),
  );
  return { policies, notes };
}

function describe(error: unknown): string {
  return hostFailure(error).text;
}
