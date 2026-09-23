/**
 * A worker's question, carried at its lap's end (D-0098 rule 4): "Secretary:
 * relaying a worker's question", the `D-0064` section 5 row that read empty.
 *
 * **Only at the lap's end** (rule 4, `D-0061` rule 6): the mid-lap channel stays
 * absent. The worker is told by `definitionOfDone` (`./done.ts`) to build and commit
 * everything that does not depend on the answer, then end its report with one
 * fenced ```` ```rondo-question ```` block. That block reaches rondo inside the
 * gate's `rationale`, continuo's word-for-word copy of the worker's last words.
 *
 * **The block is parsed, and nothing else in the rationale is.** `D-0015` rule
 * 7 has rondo relay continuo's prose without interpreting it; the one exception
 * is a block the worker was told to write in a fixed shape, validated the way a
 * drafter's question is (`model-draft/judgement.ts`), and relayed in the
 * worker's own words (`D-0071` rule 5.2). The rest of the rationale is still
 * shown only at the gate, as before.
 *
 * **Silence never answers it** (rule 4.4). The relay writes an ask, and an ask
 * is open until an operator's `carry_on` reply (`D-0072`); nothing here or
 * anywhere writes that reply for the person, and no deadline takes the
 * recommendation.
 */

import type { IterationRecord, JsonRecord, ThreadMessageDraft } from "../store/records.js";
import {
  isDeterministicReadingDrafter,
  latestReading,
  WORKER_QUESTION_AUTHOR,
} from "../store/records.js";
import { type AdvisoryRecord, asRefusal, type IterationStore } from "../store/sqlite.js";

/** The fence's info string: what the worker is told to open its block with. */
export const QUESTION_FENCE = "rondo-question";

/** One option the worker offers: what it is, and what choosing it gives up. */
export interface WorkerOption {
  readonly text: string;
  readonly givesUp: string;
}

/** The block, read. Every string is the worker's, byte for byte. */
export interface WorkerQuestion {
  readonly question: string;
  readonly options: readonly WorkerOption[];
  /** An index into {@link options}. */
  readonly recommended: number;
  readonly recommendation: string;
  /** Which part of the work waits on the answer (rule 4.1). */
  readonly waits: string;
}

export type WorkerQuestionRead =
  | { readonly kind: "none" }
  | { readonly kind: "question"; readonly question: WorkerQuestion }
  | { readonly kind: "unreadable"; readonly reason: string };

const KEYS = ["question", "options", "recommended", "recommendation", "waits"];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function only(value: unknown, keys: readonly string[], what: string): Record<string, unknown> {
  if (!isObject(value)) throw new Error(`${what} is not an object`);
  const extra = Object.keys(value).find((key) => !keys.includes(key));
  if (extra !== undefined) {
    throw new Error(`${what} carries '${extra}', which is not one of ${keys.join(", ")}`);
  }
  return value;
}

function words(value: unknown, what: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${what} is not a non-empty string`);
  }
  return value;
}

/**
 * The worker's question in a lap's rationale: the block after the **last**
 * ```` ```rondo-question ```` line, since the instruction asks for it at the
 * end of the report, up to the first closing ```` ``` ```` line after it.
 * `none` when no line opens such a fence (a mention inside a sentence is not
 * one); `unreadable` when one opens and does not read, so a question that was
 * asked is never mistaken for one that was not.
 *
 * **Line by line, from the last opener**, so an earlier fence left open cannot
 * swallow the real block, and the scan is linear in the rationale's length:
 * the worker's last words are not rondo's, and a rationale of repeated openers
 * must not stall the host.
 */
export function readWorkerQuestion(rationale: string): WorkerQuestionRead {
  const lines = rationale.split(/\r?\n/);
  const opener = new RegExp(`^[ \\t]*\`\`\`${QUESTION_FENCE}[ \\t]*$`);
  let start = -1;
  for (let i = lines.length - 1; i >= 0 && start === -1; i -= 1) {
    if (opener.test(lines[i] ?? "")) start = i;
  }
  if (start === -1) {
    return { kind: "none" };
  }
  const end = lines.findIndex((line, i) => i > start && /^[ \t]*```[ \t]*$/.test(line));
  if (end === -1) {
    return { kind: "unreadable", reason: `the ${QUESTION_FENCE} block is not closed` };
  }
  try {
    const q = only(JSON.parse(lines.slice(start + 1, end).join("\n")), KEYS, "the question");
    if (!Array.isArray(q["options"])) throw new Error("the question's options is not a list");
    const options = q["options"].map((one: unknown, i) => {
      const option = only(one, ["text", "gives_up"], `option ${String(i)}`);
      return {
        text: words(option["text"], `option ${String(i)}'s text`),
        givesUp: words(option["gives_up"], `option ${String(i)}'s gives_up`),
      };
    });
    if (options.length === 0) throw new Error("the question has no options");
    const recommended = q["recommended"];
    if (
      typeof recommended !== "number" ||
      !Number.isSafeInteger(recommended) ||
      recommended < 0 ||
      recommended >= options.length
    ) {
      throw new Error(`the question recommends ${JSON.stringify(recommended)}, which is no option`);
    }
    return {
      kind: "question",
      question: {
        question: words(q["question"], "the question's text"),
        options,
        recommended,
        recommendation: words(q["recommendation"], "the question's recommendation"),
        waits: words(q["waits"], "the question's waits"),
      },
    };
  } catch (error) {
    return { kind: "unreadable", reason: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * The ask's body: **the worker's words, rondo's numbering, and the commit**
 * (rule 4.2). The commit is the one rondo measured -- the deterministic
 * reading's `tipCommit` -- and not one the worker named, so "what was built and
 * committed" is evidence. No label of rondo's is added, so the body stays in
 * the one language the worker was asked to write in.
 */
export function questionBody(question: WorkerQuestion, tipCommit: string): string {
  return [
    question.question,
    "",
    ...question.options.flatMap((option, i) => [
      `${String(i + 1)}. ${option.text}`,
      `   ${option.givesUp}`,
    ]),
    "",
    `${String(question.recommended + 1)}. ${question.recommendation}`,
    "",
    question.waits,
    "",
    tipCommit,
  ].join("\n");
}

/** What {@link relayQuestion} reads and writes. */
export interface QuestionPorts {
  readonly record: Pick<AdvisoryRecord, "recordThreadMessage">;
  readonly store: Pick<IterationStore, "read" | "readingsFor">;
  /** The gate's rationale, or null when there is no gate or it could not be read. */
  readonly rationale: (record: IterationRecord) => Promise<string | null>;
}

/**
 * Put a lap's question to the person, when it ended with one (rule 4.2).
 *
 * The ask is message `question-<iterationId>`, `asks: true`, a `drafter`
 * message by {@link WORKER_QUESTION_AUTHOR}, replying to the request's root,
 * with bases `[iteration, continuoRun]`. The `iteration` basis is what makes
 * `askStandsOver` hold the line's `revise` until the person answers (rule 4.3):
 * nothing else waits.
 *
 * - **Nothing committed, nothing put** (rule 4.2: "a question about nothing the
 *   person can see is not put"). With a deterministic reading whose tip is its
 *   base, no ask is written; the lap stays an ordinary gate, still the
 *   person's turn, with the worker's words in its rationale.
 * - **Not read is not nothing committed**: with no reading of the lap's
 *   commits, or one rondo could not take, the question is still put, and the
 *   line where the commit goes says rondo could not read it.
 * - **An unreadable block is said, not dropped, and still holds its line**:
 *   an ask under the same id, sending the person to the gate's rationale, so
 *   silence does not settle a question rondo could not parse (rule 4.4).
 * - **Once per lap**: the id is the lap's, and the store refuses a second row
 *   under it.
 *
 * Returns a line for the report, or null when the lap asked nothing.
 */
export async function relayQuestion(
  ports: QuestionPorts,
  iterationId: string,
  nowMs: number,
): Promise<string | null> {
  const found = await ports.store.read(iterationId);
  if (found.kind !== "read") return null;
  const row = found.record;
  const rationale = await ports.rationale(row);
  if (rationale === null) return null;
  const read = readWorkerQuestion(rationale);
  if (read.kind === "none") return null;
  const messageId = `question-${iterationId}`;
  const reading = latestReading(
    await ports.store.readingsFor(iterationId),
    isDeterministicReadingDrafter,
  );
  const evidence = reading?.evidence ?? null;
  let body: string;
  if (read.kind === "unreadable") {
    body =
      `Lap '${iterationId}' ended with a question rondo could not read (${read.reason}). ` +
      "Its words are in the gate's rationale; answer at the gate.";
  } else if (evidence !== null && evidence.tipCommit === evidence.baseCommit) {
    return `Lap '${iterationId}' asked a question with nothing committed, so it was not put to the request '${row.requestMessageId}'.`;
  } else {
    body = questionBody(
      read.question,
      evidence?.tipCommit ?? "(rondo could not read what this lap committed)",
    );
  }
  const bases: JsonRecord[] = [
    { form: "iteration", iterationId },
    ...(row.runId === null ? [] : [{ form: "continuoRun", runId: row.runId }]),
  ];
  const draft: ThreadMessageDraft = {
    messageId,
    body,
    authorKind: "drafter",
    authorId: WORKER_QUESTION_AUTHOR,
    inReplyTo: row.requestMessageId,
    atMs: nowMs,
    bases,
    asks: true,
  };
  // `asRefusal`: this writer says the same thing about an id already spoken
  // for as it did before the store told the two apart.
  const outcome = asRefusal(await ports.record.recordThreadMessage(draft));
  return outcome.kind === "recorded"
    ? `Put the lap's question to the request '${row.requestMessageId}' as message '${messageId}'.`
    : `The lap's question was not put to the request '${row.requestMessageId}': ${outcome.reason}`;
}

/** A lap's question and the person's `carry_on` answer to it, both as written. */
export interface AnsweredQuestion {
  readonly question: string;
  readonly answer: string;
}

/**
 * The question lap `iterationId` put and the person's answer, or null while it
 * stands unanswered (or was never put). The answer is the latest operator
 * reply that carries `carry_on` (`D-0072`); a `stop` answers nothing here.
 */
export function answeredQuestion(
  messages: readonly ThreadMessageDraft[],
  iterationId: string,
): AnsweredQuestion | null {
  const messageId = `question-${iterationId}`;
  const asked = messages.find((m) => m.messageId === messageId && m.asks);
  if (asked === undefined) return null;
  const answer = messages
    .filter(
      (m) =>
        m.inReplyTo === messageId && m.authorKind === "operator" && m.answerOutcome === "carry_on",
    )
    .reduce<ThreadMessageDraft | null>((l, m) => (l === null || m.atMs >= l.atMs ? m : l), null);
  return answer === null ? null : { question: asked.body, answer: answer.body };
}

/**
 * The `revise` box's text for an answered question (rule 4.5): the question
 * and the answer, **each byte for byte** (`D-0009`) between rondo's own
 * ASCII lines. The question carries the commit the lap ended at, so the next
 * lap is told what it builds on; `revisionPrompt` adds that the commits are on
 * its branch.
 */
export function questionRevise(answered: AnsweredQuestion): string {
  return [
    "You ended your last lap with this question:",
    "---",
    answered.question,
    "---",
    "The person answered, word for word:",
    "---",
    answered.answer,
    "---",
    "Continue the work that waited on this answer.",
  ].join("\n");
}
