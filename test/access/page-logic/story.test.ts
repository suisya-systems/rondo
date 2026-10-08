/**
 * The story card's account of what each lap was asked (rondo#497, rondo#547):
 * a lap started again after one that ended with no gate answer -- lost, or
 * stopped at its budget or time -- carries that lap on, and says which.
 */
import { expect, test } from "vitest";

import { endedWhy } from "../../../src/access/page-logic/laps.js";
import { lapStory } from "../../../src/access/page-logic/story.js";
import { chromeFor } from "../../../src/access/wording.js";
import type { IterationRecord } from "../../../src/store/records.js";

function lap(
  id: string,
  createdAtMs: number,
  supersedesIterationId: string | null,
  gateAnswer: IterationRecord["gateAnswer"],
): IterationRecord {
  return {
    id,
    createdAtMs,
    supersedesIterationId,
    gateAnswer,
    plan: {},
  } as unknown as IterationRecord;
}

test("a lap after one that ended with no gate answer carries it on, by its number", () => {
  const story = lapStory(
    [lap("i-3", 3, "i-2", null), lap("i-1", 1, null, "approve"), lap("i-2", 2, "i-1", null)],
    () => [],
  );
  expect(story.map((one) => one.told)).toEqual([
    { kind: "request" },
    // Its predecessor was answered, and not with words this lap can quote.
    { kind: "notRecorded" },
    { kind: "continued", lap: 2 },
  ]);
});

test("a lost lap and a fault end in the person's words, never rondo's English reason (rondo#547)", () => {
  const ja = chromeFor("ja");
  const ended = (failureKind: string) =>
    endedWhy(ja, {
      gateOutcome: null,
      failureKind,
      reason: "the rondo process that sent the lap (pid 1 on h) ... are both gone (D-0139)",
    } as unknown as IterationRecord);
  expect(ended("lost")).toBe(ja.evLost);
  expect(ended("defect")).toBe(ja.evBroke);
});
