/**
 * Taking a model reading of one lap (D-0065): the composition that gathers what
 * rondo hands over, runs the reviewer, and appends the row.
 *
 * **Three halves, each where it already lives.** `git` and the reviewer process
 * are `../forge.ts`'s, because only that module in this layer may start one;
 * what the document holds and what the answer means are `./judgement.ts`'s,
 * a pure function; the commands the lap ran are the row's, as `lap perform`
 * reported them (continuo D-1112). This file only puts them in order and writes the result, so the order
 * is the one thing here a test has to hold.
 *
 * **After `drive()` returned, never inside it** (D-0065 2.6, D-0029 rule 6). The
 * deterministic reading already landed with the `awaiting_human` transaction;
 * this one arrives later as a second row while the gate's clock runs, and a
 * person who answers first answers without it.
 *
 * **Material, never a decision.** Nothing here refuses, answers or publishes;
 * the lines it returns are printed beside the deterministic reading and say so
 * (D-0065's gate answer (a)).
 */

import {
  materialLanguageSentence,
  showGate,
  type VerifiedContinuo,
} from "../../continuo/invoker.js";
import { decodeLapCommands } from "../../continuo/protocol.js";
import { reviewerFamilyCheck, reviewerRow } from "../../continuo/roles.js";
import { readPlan } from "../../refrain/plan.js";
import {
  type IterationRecord,
  isDeterministicReadingDrafter,
  isModelReadingDrafter,
  latestReading,
  modelReadingDrafter,
} from "../../store/records.js";
import type { ClosingLap, IterationStore } from "../../store/sqlite.js";
import { DETERMINISTIC_DRAFTER } from "../advisory.js";
import { notRereadSentence, type RequestThread, reportToRequest } from "../conductor.js";
import { gatherReviewMaterialFacts, runReviewer } from "../forge.js";
import { hostFailure } from "../host-failure.js";
import {
  modelReadingLines,
  modelReadingOf,
  prepareReview,
  type ReviewMaterial,
  type ReviewTranscript,
} from "./judgement.js";

/**
 * The commands the row holds, as the reviewer's transcript (continuo D-1112).
 *
 * Each state that is not a list of commands is its own reason, because each
 * refuses the reading for a different fact: no reading on the row, continuo
 * unable to say, or a column that does not read.
 */
export function transcriptOfRow(lapCommands: string | null): ReviewTranscript {
  if (lapCommands === null) {
    return {
      kind: "unread",
      reason:
        "the row holds no commands for the lap (it did not reach its gate, or it was written " +
        "before rondo recorded them)",
    };
  }
  const decoded = decodeLapCommands(lapCommands);
  switch (decoded.kind) {
    case "read":
      return decoded;
    case "notReported":
      return {
        kind: "unread",
        reason: "continuo reported that it cannot say which commands the lap ran",
      };
    case "unreadable":
      return { kind: "unread", reason: decoded.reason };
  }
}

/**
 * What taking a model reading reaches, as values a test can replace.
 *
 * The same shape `conductorPorts` gives the loop: the real composition spawns
 * `git`, `codex` and `continuo gate show`, and a unit case holds none of them.
 */
export interface ModelReviewPorts {
  readonly store: IterationStore;
  /** The gate's rationale, or null when there is no gate or it could not be read. */
  readonly rationale: (record: IterationRecord) => Promise<string | null>;
  readonly gather: typeof gatherReviewMaterialFacts;
  readonly runReviewer: typeof runReviewer;
  readonly now: () => number;
  /**
   * Where the landed reading is reported (D-0061 5.3, rondo#218), or null.
   * The gate report went first, so without this the thread never hears it.
   */
  readonly thread?: RequestThread | null;
}

/** The ports the command line uses: the real forge and continuo's gate. */
export function modelReviewPorts(
  continuo: VerifiedContinuo,
  store: IterationStore,
  thread: RequestThread | null = null,
): ModelReviewPorts {
  return {
    store,
    thread,
    rationale: async (record) => {
      const db = record.plan["db"];
      if (record.gateId === null || typeof db !== "string") {
        return null;
      }
      const observed = await showGate(continuo, { db, gateId: record.gateId });
      return observed.kind === "answered" ? observed.payload.rationale : null;
    },
    gather: gatherReviewMaterialFacts,
    runReviewer,
    now: Date.now,
  };
}

/**
 * Take one model reading of an iteration, append it, and return its lines.
 *
 * **Every path appends a row or says why it could not**, including the ones that
 * refuse before anything runs: an `unavailable` model row is the record that a
 * reading was attempted and what stopped it (D-0065 2.4), which a silent skip
 * would not be. The lines are read back from the store rather than rendered
 * from the draft, so what is printed is what the writer's refusals made of it.
 *
 * Never throws: a failure anywhere becomes a line, because the lap this reads
 * has already reached its gate and nothing here may take that away.
 */
export async function takeModelReading(
  ports: ModelReviewPorts,
  iterationId: string,
): Promise<readonly string[]> {
  try {
    return await take(ports, iterationId);
  } catch (error) {
    return [`model review  no model reading was taken: ${hostFailure(error).text}`];
  }
}

async function take(ports: ModelReviewPorts, iterationId: string): Promise<readonly string[]> {
  const { store } = ports;
  const read = await store.read(iterationId);
  if (read.kind !== "read") {
    return [`model review  iteration '${iterationId}' could not be read (${read.kind}).`];
  }
  const record = read.record;
  // **A closing lap is not read again** (D-0098 rule 5.3): no row is appended,
  // so it is not a round (D-0065 4.1) and no further redo from it is decidable
  // (the scope verdict's readings test) -- one closing lap by construction.
  const closing = await store.closingLapOf(record.id);
  if (closing !== null) {
    return await closingLap(ports, record, closing);
  }
  const reviewer = reviewerRow();

  const append = async (
    draft: Parameters<IterationStore["appendReading"]>[1],
  ): Promise<readonly string[]> => {
    const appended = await store.appendReading(record.id, draft, ports.now());
    if (appended.kind !== "appended") {
      return [
        `model review  the reading was not recorded (${appended.kind === "defect" ? appended.reason : "no such iteration"}).`,
      ];
    }
    const stored = latestReading(await store.readingsFor(record.id), isModelReadingDrafter);
    if (stored === null) {
      return ["model review  the reading was recorded and did not read back."];
    }
    const reported =
      ports.thread === undefined || ports.thread === null
        ? null
        : await reportToRequest(ports.thread, record.id, { kind: "modelReading" }, ports.now());
    return reported === null ? modelReadingLines(stored) : [...modelReadingLines(stored), reported];
  };
  const unavailable = (reason: string) =>
    append({
      drafter: modelReadingDrafter(reviewer.model),
      verdict: "unavailable",
      findings: Object.freeze([]),
      evidence: null,
      unavailableReason: reason,
    });

  // **The family before anything spawns** (D-0065 rule 3.3). `prepareReview`
  // asks the same question, but only after the material is gathered, and a lap
  // the reviewer may not read would then have started `git`, read a transcript
  // and asked continuo for a rationale for nothing. Asked here first, a
  // same-family or unknown-model lap spawns nothing at all; `prepareReview`
  // keeps its own check, so the pure function stays total on its own.
  const family = reviewerFamilyCheck(reviewer, record.model);
  if (family.kind === "refused") {
    return await unavailable(family.reason);
  }

  // **The deterministic reading's range, or no reading.** Both readings must be
  // about the same commits (D-0065 1.2.1); a model reading over a range rondo
  // did not resolve would be about something the other reading never saw.
  const deterministic = latestReading(
    await store.readingsFor(record.id),
    isDeterministicReadingDrafter,
  );
  if (deterministic === null || deterministic.evidence === null) {
    return await unavailable(
      "the deterministic reading resolved no range, so there are no commits to hand over (D-0065 1.2.1).",
    );
  }
  const planned = readPlan(record.plan);
  if (planned.kind === "refused") {
    return await unavailable(`the row's plan does not read: ${planned.reason}`);
  }
  const plan = planned.plan;
  const criterion = plan.reviewCriterion;

  let material: ReviewMaterial | { readonly kind: "unreadable"; readonly reason: string };
  if (criterion === null) {
    // Nothing is gathered for a plan with no criterion: `prepareReview` refuses
    // on the criterion before it looks at the material (D-0029 rule 13).
    material = { kind: "unreadable", reason: "the plan names no review criterion" };
  } else {
    // **A lap that took the default branch in is read from what it took in**
    // (D-0103 rule 2.6, D-0105): its own range starts at its predecessor's tip,
    // so the merge would hand over every change the default branch brought as
    // if the worker had written it. From the take-in commit to the same tip is
    // the line's work against the base as it now is, the resolution included.
    const evidence =
      plan.takeIn === null
        ? deterministic.evidence
        : {
            ...deterministic.evidence,
            baseRef: plan.takeIn.branch,
            baseCommit: plan.takeIn.commit,
          };
    const facts = await ports.gather({
      workspace: plan.workspace,
      evidence,
      ruleFiles: criterion.ruleFiles,
    });
    material =
      facts.kind === "unreadable"
        ? facts
        : {
            evidence,
            diff: facts.diff,
            commits: facts.commits,
            // What continuo received: the prompt, plus the language sentence
            // when the plan asked for one (`src/continuo/invoker.ts`).
            prompt:
              plan.materialLanguage === null
                ? plan.prompt
                : `${plan.prompt}\n\n${materialLanguageSentence(plan.materialLanguage)}`,
            transcript: transcriptOfRow(record.lapCommands),
            rationale: await ports.rationale(record),
            deterministicFindings: deterministic.findings,
            criterion,
            ruleFiles: facts.ruleFiles,
          };
  }

  const prepared = prepareReview({ reviewer, lapModel: record.model, criterion, material });
  if (prepared.kind === "refused") {
    return await append(prepared.draft);
  }
  if ("kind" in material) {
    // Unreachable: `prepareReview` refuses unreadable material. Kept so the
    // type narrows without a cast.
    return await unavailable(material.reason);
  }
  const run = await ports.runReviewer(reviewer, prepared.document);
  return await append(modelReadingOf({ reviewer, prepared, material, run }));
}

/**
 * A closing lap at its gate (D-0098 rules 5.3 and 5.4): say it was not
 * re-read, in the thread and on the screen, and **stop the line** when its
 * deterministic reading is not `clear` -- a fix that fails its own test is not
 * closed quietly. The stop is D-0064 rule 3.3's scope exit: one drafter
 * message with `asks` set over this lap, which holds the merge (`mergeBlock`'s
 * `asked`) and any further admission (the scope's asks test) until a person
 * answers it. Its id is the lap's and the tip its reading read, so a second
 * reading of one tip writes nothing, and a lap that resumes into a new gate
 * and fails again is stopped again rather than found spoken for.
 *
 * ponytail: "a finding at or above the threshold" is observed only through the
 * deterministic reading; the worker's report reaches the person at the gate
 * and is not read here (D-0103 rule 5.7). Red checks on the pull request
 * already hold the merge as `notGreen`, and writing a stop on them belongs to
 * the checks host.
 */
async function closingLap(
  ports: ModelReviewPorts,
  record: IterationRecord,
  closing: ClosingLap,
): Promise<readonly string[]> {
  const lines = [`model review  not re-read. ${notRereadSentence(closing)}`];
  const thread = ports.thread ?? null;
  if (thread !== null) {
    lines.push(
      (await reportToRequest(thread, record.id, { kind: "closingFix", ...closing }, ports.now())) ??
        "",
    );
  }
  const deterministic = latestReading(
    await ports.store.readingsFor(record.id),
    isDeterministicReadingDrafter,
  );
  if (deterministic?.verdict === "clear") {
    return lines.filter((line) => line !== "");
  }
  const said =
    deterministic === null
      ? "has no deterministic reading"
      : `has a deterministic reading of '${deterministic.verdict}' with ` +
        `${String(deterministic.findings.length)} finding(s)`;
  lines.push(`model review  the closing lap ${said}, so the line stops (D-0098 rule 5.4).`);
  if (thread === null) {
    lines.push("model review  no request thread is wired, so no stop was written.");
    return lines.filter((line) => line !== "");
  }
  const messageId = `closing-stop-${record.id}-${deterministic?.evidence?.tipCommit ?? "unread"}`;
  const outcome = await thread.record.recordThreadMessage({
    messageId,
    body: [
      `Stopped: the closing lap '${record.id}' ${said}, and no reviewer reads it again, so it ` +
        "is not closed quietly (D-0098 rule 5.4).",
      notRereadSentence(closing),
      "Options:",
      "- A revise from this lap pressed without a scope, which the reviewer reads like any " +
        "other lap. Gives up: the closing lap's promise of no further round. (A revise under " +
        "a scope cannot follow a closing lap: it has no reading to test.)",
      `- Stopping this line. Gives up: the closing fix; the work the reviewer last read ` +
        `(commit '${closing.readTipCommit}') is what this line has.`,
      "Recommended: a revise without a scope: the fix is small, and a reading is what it lacks.",
      "This line stays stopped until this message is answered.",
    ].join("\n"),
    authorKind: "drafter",
    authorId: DETERMINISTIC_DRAFTER,
    inReplyTo: record.requestMessageId,
    atMs: ports.now(),
    bases: [
      { form: "message", messageId: record.requestMessageId },
      { form: "iteration", iterationId: record.id },
    ],
    asks: true,
  });
  lines.push(
    outcome.kind === "recorded"
      ? `model review  the stop was written to the request's thread as '${messageId}'.`
      : `model review  the stop was not written: ${outcome.reason}`,
  );
  return lines.filter((line) => line !== "");
}
