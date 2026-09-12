/**
 * Taking a model reading of one lap (D-0065): the composition that gathers what
 * rondo hands over, runs the reviewer, and appends the row.
 *
 * **Three halves, each where it already lives.** `git` and the reviewer process
 * are `./forge.ts`'s, because only that module in this layer may start one;
 * what the document holds and what the answer means are `./model-review.ts`'s,
 * a pure function; the transcript is `src/continuo/transcript.ts`'s two-file
 * read. This file only puts them in order and writes the result, so the order
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

import { materialLanguageSentence, showGate, type VerifiedContinuo } from "../continuo/invoker.js";
import { reviewerRow } from "../continuo/roles.js";
import { readLapCommands } from "../continuo/transcript.js";
import { readPlan } from "../refrain/plan.js";
import {
  type IterationRecord,
  isDeterministicReadingDrafter,
  isModelReadingDrafter,
  latestReading,
  modelReadingDrafter,
} from "../store/records.js";
import type { IterationStore } from "../store/sqlite.js";
import { gatherReviewMaterialFacts, runReviewer } from "./forge.js";
import {
  modelReadingLines,
  modelReadingOf,
  prepareReview,
  type ReviewMaterial,
} from "./model-review.js";

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
  readonly readCommands: typeof readLapCommands;
  readonly now: () => number;
}

/** The ports the command line uses: the real forge, the real transcript, continuo's gate. */
export function modelReviewPorts(
  continuo: VerifiedContinuo,
  store: IterationStore,
): ModelReviewPorts {
  return {
    store,
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
    readCommands: readLapCommands,
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
    return [
      `model review  no model reading was taken: ${error instanceof Error ? error.message : String(error)}`,
    ];
  }
}

async function take(ports: ModelReviewPorts, iterationId: string): Promise<readonly string[]> {
  const { store } = ports;
  const read = await store.read(iterationId);
  if (read.kind !== "read") {
    return [`model review  iteration '${iterationId}' could not be read (${read.kind}).`];
  }
  const record = read.record;
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
    return stored === null
      ? ["model review  the reading was recorded and did not read back."]
      : modelReadingLines(stored);
  };
  const unavailable = (reason: string) =>
    append({
      drafter: modelReadingDrafter(reviewer.model),
      verdict: "unavailable",
      findings: Object.freeze([]),
      evidence: null,
      unavailableReason: reason,
    });

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
    const facts = await ports.gather({
      workspace: plan.workspace,
      evidence: deterministic.evidence,
      ruleFiles: criterion.ruleFiles,
    });
    material =
      facts.kind === "unreadable"
        ? facts
        : {
            evidence: deterministic.evidence,
            diff: facts.diff,
            commits: facts.commits,
            // What continuo received: the prompt, plus the language sentence
            // when the plan asked for one (`src/continuo/invoker.ts`).
            prompt:
              plan.materialLanguage === null
                ? plan.prompt
                : `${plan.prompt}\n\n${materialLanguageSentence(plan.materialLanguage)}`,
            transcript:
              record.sessionId === null
                ? { kind: "unread", reason: "the row names no session" }
                : ports.readCommands({
                    stateRoot: plan.stateRoot,
                    runId: plan.runId,
                    sessionId: record.sessionId,
                  }),
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
