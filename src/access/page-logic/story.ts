/**
 * What happened on the way to a gate, as the gate's first card says it
 * (rondo#497): each lap of the line in order, what it was asked to do, what
 * it committed, and how it ended.
 *
 * **Read, never composed.** Every sentence is rondo's over a recorded fact:
 * the words a change was asked with are quoted from the prompt of the lap they
 * started (`revisionInstruction`), the figures are the checks' evidence, and
 * the ending is the gate's answer. Nothing is summarised, so where a fact is
 * not recorded the card says so rather than guessing.
 */
import { revisionInstruction } from "../../refrain/revision.js";
import {
  type IterationRecord,
  isDeterministicReadingDrafter,
  isModelReadingDrafter,
  type LapReading,
  latestReading,
} from "../../store/records.js";

/** How many blockers and majors one model reading left open. */
export interface RaisedCounts {
  readonly blockers: number;
  readonly majors: number;
}

/**
 * What a model reading raised at or above `major`, or null where it raised
 * none (D-0065 as annotated from #220). Counted from the graded findings, so a
 * reading whose severities did not decode counts nothing here -- its findings
 * are still every one of them on the card.
 *
 * **The count and not the sentence** (rondo#237), because several screens say
 * it: the line by the gate's button, the row of a lap somebody approved over
 * it, and the story of the laps before a gate (rondo#497).
 */
export function raisedIn(reading: LapReading | null): RaisedCounts | null {
  const graded = reading?.graded ?? [];
  const blockers = graded.filter((finding) => finding.severity === "blocker").length;
  const majors = graded.filter((finding) => finding.severity === "major").length;
  return blockers === 0 && majors === 0 ? null : { blockers, majors };
}

/**
 * What a lap was asked to do: the request itself (the line's first lap), the
 * words a revise at the gate before it added, the carrying on of an earlier lap
 * that ended without a gate answer (a lost or stopped lap started again,
 * rondo#547), or not recorded -- a conflict fix, or a prompt whose shape rondo
 * does not know.
 */
export type StoryTold =
  | { readonly kind: "request" }
  | { readonly kind: "asked"; readonly words: string }
  /** `lap` is the earlier lap's number in the line, from 1. */
  | { readonly kind: "continued"; readonly lap: number }
  | { readonly kind: "notRecorded" };

export interface StoryLap {
  readonly record: IterationRecord;
  readonly told: StoryTold;
  /** The checks' count of the lap's commits and files, or null where no reading holds one. */
  readonly commits: number | null;
  readonly files: number | null;
  /** What the lap's latest model reading raised at or above `major`, or null. */
  readonly raised: RaisedCounts | null;
}

/**
 * The laps of one line, oldest first, each said as the story card says it.
 * `line` is the line's laps in any order; the gated lap is one of them.
 */
export function lapStory(
  line: readonly IterationRecord[],
  readingsOf: (iterationId: string) => readonly LapReading[],
): readonly StoryLap[] {
  const laps = line.toSorted((left, right) => left.createdAtMs - right.createdAtMs);
  return laps.map((record, index): StoryLap => {
    const beforeIndex = laps.findIndex((lap) => lap.id === record.supersedesIterationId);
    const before = laps[beforeIndex];
    const words =
      before === undefined || before.gateAnswer !== "revise"
        ? null
        : revisionInstruction(before, record);
    const readings = readingsOf(record.id);
    const evidence = latestReading(readings, isDeterministicReadingDrafter)?.evidence ?? null;
    return {
      record,
      told:
        index === 0
          ? { kind: "request" }
          : words !== null
            ? { kind: "asked", words }
            : before !== undefined && before.gateAnswer === null
              ? { kind: "continued", lap: beforeIndex + 1 }
              : { kind: "notRecorded" },
      commits: evidence?.commitCount ?? null,
      files: evidence?.fileCount ?? null,
      raised: raisedIn(latestReading(readings, isModelReadingDrafter)),
    };
  });
}
