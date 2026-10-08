/**
 * When the thread explainer answers, and the one write an answer is
 * (rondo#401, D-0177), in the resident host beside the drafter.
 *
 * **A person's press is the only trigger**: a question is a row the page wrote
 * under `question-` (the "?" or the reply box's "Ask rondo"). Each one no
 * explainer message cites yet is answered once, serially, in this process:
 * gather, admit, run one turn with no tools (`runDrafter`, the drafter's own
 * safety frame), check the answer's form, and on any failure answer from the
 * records instead. Nothing here throws to its caller.
 */

import type { Claim } from "../../advisory/proposal.js";
import { explainerRow } from "../../continuo/roles.js";
import { EXPLAINER_PREFIX, type JsonRecord, type JsonValue } from "../../store/records.js";
import type { AdvisoryRecord } from "../../store/sqlite.js";
import type { runDrafter } from "../forge.js";
import { hostFailure } from "../host-failure.js";
import { chromeFor } from "../wording.js";
import {
  type AnswerCost,
  admission,
  answerBody,
  DETERMINISTIC_EXPLAINER,
  deterministicAnswer,
  EXPLAINER_CAP_USD,
  explainerDocument,
  explainerName,
  readExplanation,
  type Unexplained,
} from "./judgement.js";
import {
  type ExplainerMaterial,
  type ExplainerPorts,
  gatherExplainerMaterial,
} from "./material.js";

export interface ExplainerHostPorts extends ExplainerPorts {
  readonly record: ExplainerPorts["record"] &
    Pick<AdvisoryRecord, "recordAnswer" | "unansweredQuestionIds">;
  readonly runDrafter: typeof runDrafter;
  readonly now: () => number;
  readonly mintId: (kind: "draft" | "drafter") => string;
  /** The language the person reads, or null. */
  readonly language: string | null;
  readonly log: (line: string) => void;
}

export interface ExplainerHost {
  /** Answer what is asked now. Returns at once. */
  kick(): void;
  /** Resolves once nothing is in flight. */
  idle(): Promise<void>;
}

export function explainerHost(ports: ExplainerHostPorts): ExplainerHost {
  // A question whose answer the store refused is not run again in this
  // process, so a store that refuses does not cost a model run per scan.
  const givenUp = new Set<string>();
  // A run whose answer is not written yet, kept so the next scan writes it
  // without running (and paying for) the model again.
  const unwritten = new Map<string, Finished>();
  let running: Promise<void> | null = null;
  let again = false;

  const loop = async (): Promise<void> => {
    while (again) {
      again = false;
      let due: readonly string[];
      try {
        due = await ports.record.unansweredQuestionIds(EXPLAINER_PREFIX);
      } catch (error) {
        ports.log(`explain  the questions could not be read: ${hostFailure(error).text}`);
        return;
      }
      for (const questionId of due.filter((id) => !givenUp.has(id))) {
        try {
          if (!(await answer(ports, questionId, unwritten))) {
            givenUp.add(questionId);
          }
        } catch (error) {
          // A fault of the moment: the question stays due for the next scan.
          ports.log(
            `explain  ${questionId}: ${hostFailure(error).text}; tried again on the next scan`,
          );
        }
      }
    }
  };
  const kick = (): void => {
    again = true;
    if (running === null) {
      running = loop().finally(() => {
        running = null;
        if (again) {
          kick();
        }
      });
    }
  };
  return {
    kick,
    async idle() {
      while (running !== null) {
        await running;
      }
    },
  };
}

/** What one question's run settled, before anything is written. */
interface Finished {
  readonly material: ExplainerMaterial;
  readonly document: string | null;
  readonly costUsd: number | null;
  readonly explained: { readonly answer: string; readonly claims: readonly Claim[] } | null;
  readonly why: Unexplained | null;
  /** The approval a model run is counted under; null when no model process ran. */
  readonly countedUnder: string | null;
}

/** Gather, admit and run once. Never throws past a gather that will not read. */
async function settle(ports: ExplainerHostPorts, questionId: string): Promise<Finished> {
  const material = await gatherExplainerMaterial(ports, questionId, ports.now());
  const admitted = admission(material, ports.now());
  if (admitted.kind !== "admitted") {
    return {
      material,
      document: null,
      costUsd: null,
      explained: null,
      why: admitted,
      countedUnder: null,
    };
  }
  const document = explainerDocument(material, ports.language);
  let run: Awaited<ReturnType<typeof runDrafter>>;
  try {
    run = await ports.runDrafter(explainerRow(), document);
  } catch (error) {
    run = { kind: "failed", reason: `the explainer could not be run: ${hostFailure(error).text}` };
  }
  if (run.kind === "failed") {
    // A model that ran is counted, whatever it answered: its spend is real.
    // One that never started spent nothing, and is not counted.
    return {
      material,
      document,
      costUsd: null,
      explained: null,
      why: { kind: "failed", reason: run.reason },
      countedUnder: run.notStarted === true ? null : admitted.scopeDecisionId,
    };
  }
  const read = readExplanation(material, run.finalMessage);
  return {
    material,
    document,
    costUsd: run.costUsd,
    explained: read.kind === "read" ? read : null,
    why: read.kind === "read" ? null : { kind: "refused", reason: read.reason },
    countedUnder: admitted.scopeDecisionId,
  };
}

/**
 * One question answered and written. False when the store refused the write.
 *
 * **A run is paid for once**: it is held in `unwritten` until a write lands, so
 * a store fault (`defect`) or a throw after the run writes the same answer on
 * the next scan; and a model answer the store refuses is written again as the
 * records' answer, carrying the same count, so its spend still lands.
 */
async function answer(
  ports: ExplainerHostPorts,
  questionId: string,
  unwritten: Map<string, Finished>,
): Promise<boolean> {
  const finished = unwritten.get(questionId) ?? (await settle(ports, questionId));
  unwritten.set(questionId, finished);
  let written = await write(ports, questionId, finished);
  if ((written.kind === "refused" || written.kind === "malformed") && finished.explained !== null) {
    const { reason } = written;
    ports.log(`explain  ${questionId}: the model's answer was not written (${reason})`);
    written = await write(ports, questionId, {
      ...finished,
      explained: null,
      why: { kind: "refused", reason },
    });
  }
  if (written.kind !== "defect") {
    unwritten.delete(questionId);
  }
  const { explained, why, costUsd } = finished;
  switch (written.kind) {
    case "answered":
      ports.log(
        `explain  ${questionId}: ${explained === null ? `answered from the records (${why?.kind ?? "?"})` : "answered"}` +
          (costUsd === null ? "" : ` ($${costUsd.toFixed(4)})`),
      );
      return true;
    case "alreadyAnswered":
      return true;
    case "malformed":
      ports.log(`explain  ${questionId}: not written, ${written.field}: ${written.reason}`);
      return false;
    case "notAQuestion":
      ports.log(`explain  ${questionId}: not written, it is not a question`);
      return false;
    case "refused":
      ports.log(`explain  ${questionId}: not written: ${written.reason}`);
      return false;
    case "defect":
      // A fault of the store's, not an answer to this write: written next scan.
      ports.log(
        `explain  ${questionId}: not written: ${written.reason}; tried again on the next scan`,
      );
      return true;
  }
}

async function write(
  ports: ExplainerHostPorts,
  questionId: string,
  finished: Finished,
): ReturnType<ExplainerHostPorts["record"]["recordAnswer"]> {
  const words = chromeFor(ports.language);
  const { material, document, costUsd, explained, why, countedUnder } = finished;
  const { answer: prose, claims } =
    explained ?? deterministicAnswer(material, words, why ?? { kind: "noApproval" });
  const cost: AnswerCost = countedUnder === null ? { kind: "free" } : { kind: "counted", costUsd };
  const drafter = explained === null ? DETERMINISTIC_EXPLAINER : explainerName(explainerRow());
  const proposalId = ports.mintId("draft");
  const atMs = ports.now();
  const text = answerBody(words, material, prose, claims, cost);
  const bases = uniqueBases([
    ...claims.map((claim) => claim.basis as unknown as JsonRecord),
    // The lap waiting at its gate, or the drafted scope waiting for approval,
    // so the page can lead to where it is answered.
    ...material.waits.flatMap((w): JsonRecord[] =>
      w.kind === "gate"
        ? [{ form: "iteration", iterationId: w.iterationId }]
        : w.kind === "scope"
          ? [{ form: "scope", scopeId: w.scopeId }]
          : [],
    ),
    { form: "message", messageId: questionId },
    { form: "proposal", proposalId },
  ]);
  return await ports.record.recordAnswer({
    questionId,
    drafterPrefix: EXPLAINER_PREFIX,
    proposal: {
      proposalId,
      kind: "explanation",
      drafter,
      payload: { claims: claims as unknown as JsonValue },
      snapshot: {
        material: material as unknown as JsonValue,
        document,
        cost_usd: costUsd,
        cost_read: costUsd !== null,
        cap_usd: EXPLAINER_CAP_USD,
        unexplained: why === null ? null : (why as unknown as JsonValue),
        // D-0173 K4: being asked is the signal that what was written did not explain itself.
        signal: signal(material),
        // Whether this answer's run is counted, and the text the page draws under its band.
        counted: countedUnder !== null,
        page: text.page,
      },
      derivation: explained === null ? "store_rows" : "model",
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
      createdAtMs: atMs,
    },
    message: {
      messageId: ports.mintId("drafter"),
      body: text.body,
      authorKind: "drafter",
      authorId: drafter,
      inReplyTo: questionId,
      atMs,
      bases,
      asks: false,
    },
    claim: countedUnder === null ? null : { scopeDecisionId: countedUnder, nowMs: atMs },
  });
}

function signal(material: ExplainerMaterial): JsonRecord {
  return {
    kind: "D-0173 K4",
    questionId: material.question.messageId,
    origin: material.question.origin,
    about: material.question.about as unknown as JsonValue,
  };
}

function uniqueBases(bases: readonly JsonRecord[]): JsonRecord[] {
  const seen = new Set<string>();
  return bases.filter((basis) => {
    const key = JSON.stringify(basis);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
