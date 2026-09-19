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
 * **One run at a time, and a stale run writes nothing** (rule 3.3): runs are
 * taken one after another, which is at most one per thread, and the store
 * refuses a write whose thread gained an operator message after its document
 * was assembled; the next scan runs it again over the new thread.
 *
 * **Nobody waits on it** (rule 3.4): {@link DrafterHost.kick} returns at once,
 * and the draft lands as a row the page reads on its next poll.
 */

import type { ProposalDraft, ThreadMessageDraft } from "../store/records.js";
import type { AdvisoryRecord } from "../store/sqlite.js";
import type { DrafterPorts, DrafterRunResult } from "./model-drafter.js";
import { draftRequest } from "./model-drafter.js";

/** What every row a model drafter writes is named under (D-0071 rule 1.4). */
const DRAFTER_PREFIX = "rondo/drafter/";

/** What the host reaches, as values a test can replace. */
export interface DrafterHostPorts extends DrafterPorts {
  readonly record: DrafterPorts["record"] &
    Pick<AdvisoryRecord, "recordDraft" | "draftedMessageIds">;
  /** A fresh row id with a readable prefix, as the page mints its own. */
  readonly mintId: (kind: "draft" | "drafted-scope" | "drafter") => string;
  /** The language the host's operator reads, or null (`RONDO_OPERATOR_LANGUAGE`). */
  readonly language: string | null;
  /** One line for the host's terminal. */
  readonly log: (line: string) => void;
  /** Tests replace the run; the host runs the real one. */
  readonly draft?: typeof draftRequest;
}

export interface DrafterHost {
  /** Look for due requests now. Returns at once; runs already in flight are joined. */
  kick(): void;
  /** Resolves once no scan or run is in flight: for tests and for a clean shutdown. */
  idle(): Promise<void>;
}

export function drafterHost(ports: DrafterHostPorts): DrafterHost {
  const draft = ports.draft ?? draftRequest;
  // A request whose write could not be made at all, by the latest operator
  // message it was run over: not run again until the person writes again
  // (rule 1.5's "not retried"), so a store that refuses does not cost a draft
  // on every scan.
  const givenUp = new Map<string, string>();
  let running: Promise<void> | null = null;
  let again = false;

  const loop = async (): Promise<void> => {
    while (again) {
      again = false;
      let due: readonly Due[];
      try {
        due = await dueRequests(ports, givenUp);
      } catch (error) {
        ports.log(`drafter  the threads could not be scanned: ${describe(error)}`);
        return;
      }
      for (const one of due) {
        const result = await draft(ports, one.requestMessageId, ports.language);
        const written = await write(ports, result);
        if (written === "stale") {
          again = true;
        } else if (written === "failed") {
          givenUp.set(one.requestMessageId, one.latestOperatorMessageId);
        }
      }
    }
  };

  return {
    kick() {
      again = true;
      if (running === null) {
        running = loop().finally(() => {
          running = null;
        });
      }
    },
    async idle() {
      while (running !== null) {
        await running;
      }
    },
  };
}

interface Due {
  readonly requestMessageId: string;
  readonly latestOperatorMessageId: string;
}

/** Every request with an operator message no drafter row covers, oldest first. */
async function dueRequests(
  ports: DrafterHostPorts,
  givenUp: ReadonlyMap<string, string>,
): Promise<readonly Due[]> {
  const read = await ports.record.threadMessages();
  if (read.kind !== "read") {
    throw new Error(read.reason);
  }
  const covered = await ports.record.draftedMessageIds(DRAFTER_PREFIX);
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
  const latest = new Map<string, string>();
  const uncovered = new Set<string>();
  for (const m of read.messages) {
    if (m.authorKind !== "operator") {
      continue;
    }
    const root = rootOf(m.messageId);
    // A root that is not an operator's opening message opens no request.
    const opening = read.messages.find((one) => one.messageId === root);
    if (opening === undefined || opening.authorKind !== "operator" || opening.inReplyTo !== null) {
      continue;
    }
    latest.set(root, m.messageId);
    if (!covered.has(m.messageId)) {
      uncovered.add(root);
    }
  }
  return [...uncovered].flatMap((root) => {
    const last = latest.get(root) as string;
    return givenUp.get(root) === last
      ? []
      : [{ requestMessageId: root, latestOperatorMessageId: last }];
  });
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
): Promise<"written" | "stale" | "failed"> {
  const material = result.material;
  if (material === null) {
    ports.log(
      `drafter  nothing was written: ${result.outcome.kind === "unavailable" ? result.outcome.reason : "no material"}`,
    );
    return "failed";
  }
  const operatorIds = material.thread
    .filter((m) => m.authorKind === "operator")
    .map((m) => m.messageId);
  const latestOperatorMessageId = operatorIds[operatorIds.length - 1] as string;
  const nowMs = ports.now();
  const cost = result.costUsd === null ? "cost not reported" : `$${result.costUsd.toFixed(4)}`;

  const unavailable = async (reason: string): Promise<"written" | "stale" | "failed"> => {
    const covered = await ports.record.draftedMessageIds(DRAFTER_PREFIX);
    const cites = operatorIds.filter((id) => !covered.has(id));
    const outcome = await ports.record.recordDraft({
      requestMessageId: material.requestMessageId,
      latestOperatorMessageId,
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
          bases: (cites.length === 0 ? [latestOperatorMessageId] : cites).map((messageId) => ({
            form: "message",
            messageId,
          })),
          asks: false,
        },
      ],
    });
    if (outcome.kind === "stale") {
      return "stale";
    }
    if (outcome.kind !== "recorded") {
      ports.log(`drafter  ${material.requestMessageId}: nothing was written: ${outcome.reason}`);
      return "failed";
    }
    ports.log(`drafter  ${material.requestMessageId}: no draft (${cost}): ${reason}`);
    return "written";
  };

  if (result.outcome.kind === "unavailable") {
    return await unavailable(result.outcome.reason);
  }
  const drafted = result.outcome;
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
    bases: [...message.bases.map((messageId) => ({ form: "message", messageId })), onProposal],
    asks: message.asks,
  }));
  const outcome = await ports.record.recordDraft({
    requestMessageId: material.requestMessageId,
    latestOperatorMessageId,
    proposal,
    scope:
      drafted.scope === null
        ? null
        : {
            scopeId: ports.mintId("drafted-scope"),
            payload: drafted.scope.payload,
            supersedesScopeId: null,
            authorKind: "drafter",
            authorId: result.drafter,
            bases: [...drafted.scope.bases, onProposal],
            createdAtMs: nowMs,
            agentTypeRecords: drafted.scope.agentTypeRecords.map((r) => ({
              agentTypeDigest: r.agentTypeDigest,
              agentTypeInput: r.agentTypeInput,
              planDigest: r.planDigest,
              fromMessageId: r.messageId,
            })),
          },
    messages,
  });
  if (outcome.kind === "stale") {
    return "stale";
  }
  if (outcome.kind !== "recorded") {
    return await unavailable(`the draft could not be recorded: ${outcome.reason}`);
  }
  ports.log(
    `drafter  ${material.requestMessageId}: ${drafted.act} (${cost})` +
      `${drafted.scope === null ? "" : ", with a drafted scope"}`,
  );
  return "written";
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
