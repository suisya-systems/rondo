/**
 * *Since you last looked* in the empty centre (DECISIONS.md D-0083 rule 4,
 * rondo#631).
 *
 * The reading is the inbox's `changed` rows sorted under their requests; what
 * could quietly break is which bucket a row lands in, that nothing is dropped
 * (a row under no request is counted), and that a lap closed before the mark
 * is not said to have ended again. The last cases read the drawn page, because
 * a digest composed and never placed is the gap rondo#631 names.
 */
import { expect, test } from "vitest";
import { type SinceReads, sinceLooked } from "../../../src/access/page-logic/since.js";
import { JA } from "../../../src/access/wording/ja.js";
import { EN } from "../../../src/access/wording.js";
import { fresh, openRequest, operatorPage, portsOver } from "../page-world.js";

const MESSAGES: Record<string, { author: string; root: string }> = {
  "req-a": { author: "operator", root: "req-a" },
  "a-rondo": { author: "drafter", root: "req-a" },
  "a-you": { author: "operator", root: "req-a" },
  "req-b": { author: "operator", root: "req-b" },
};
const LAPS: Record<string, { requestId: string; ended: boolean; updatedAtMs: number }> = {
  "lap-1": { requestId: "req-b", ended: true, updatedAtMs: 150 },
  "lap-2": { requestId: "req-b", ended: true, updatedAtMs: 50 },
  "lap-3": { requestId: "req-b", ended: false, updatedAtMs: 160 },
};
const reads: SinceReads = {
  authorOf: (id) => MESSAGES[id]?.author,
  rootOf: (id) => MESSAGES[id]?.root ?? null,
  lapOf: (id) => LAPS[id] ?? null,
};

test("each changed row lands under its request, and the rest are counted", () => {
  const reading = sinceLooked(
    [
      { kind: "conversation_message", id: "a-rondo", atMs: 110 },
      { kind: "conversation_message", id: "a-you", atMs: 120 },
      { kind: "conversation_message", id: "req-a", atMs: 105 },
      { kind: "iteration", id: "lap-1", atMs: 150 },
      { kind: "lap_reading", id: "lap-1", atMs: 140 },
      { kind: "lap_reading", id: "lap-2", atMs: 130 },
      { kind: "gate_answer", id: "lap-3", atMs: 160 },
      { kind: "proposal", id: "p-1", atMs: 170 },
      { kind: "operator_attention", id: null, atMs: 170 },
      { kind: "conversation_message", id: "not-drawn", atMs: 170 },
    ],
    100,
    reads,
  );
  expect(reading.moved).toEqual([
    {
      messageId: "req-b",
      asked: false,
      rondoWrote: 0,
      youWrote: 0,
      youAnswered: 1,
      lapsMoved: 3,
      // lap-2 closed before the mark: a reading landing on it is not an ending.
      lapsEnded: 1,
      atMs: 160,
    },
    {
      messageId: "req-a",
      asked: true,
      rondoWrote: 1,
      youWrote: 1,
      youAnswered: 0,
      lapsMoved: 0,
      lapsEnded: 0,
      atMs: 120,
    },
  ]);
  expect(reading.elsewhere).toBe(3);
});

test("a moved request is said as one sentence, in each language", () => {
  const moved = {
    messageId: "req-b",
    asked: false,
    rondoWrote: 2,
    youWrote: 0,
    youAnswered: 1,
    lapsMoved: 3,
    lapsEnded: 1,
    atMs: 0,
  };
  // rondo's name keeps its lower case at the head of the sentence.
  expect(EN.sinceSaid(moved)).toBe(
    "rondo wrote 2 messages, you answered a gate, 3 laps moved and 1 ended.",
  );
  expect(JA.sinceSaid(moved)).toBe(
    "rondo が 2 件書きました。あなたが 1 回答えました。3 周が動き、うち 1 周が終わりました。",
  );
  expect(EN.sinceSaid({ ...moved, rondoWrote: 0, asked: true })).toBe(
    "You asked for it, you answered a gate, 3 laps moved and 1 ended.",
  );
});

test("the empty centre says what moved since the mark, under the box", async () => {
  const world = fresh();
  await openRequest(world, "req-old", "Tidy the README", 500);
  await world.record.recordView("ada", 1_000);
  await openRequest(world, "req-new", "Add a dark theme", 2_000);
  const html = await operatorPage(portsOver(world, "ada", []), "t", { kind: "summary" });
  const centre = html.slice(html.indexOf('class="empty-centre"'));
  expect(centre).toContain(EN.sinceHeading(EN.age("4s")));
  expect(centre).toContain("Add a dark theme");
  expect(centre).toContain(
    EN.sinceSaid({
      messageId: "req-new",
      asked: true,
      rondoWrote: 0,
      youWrote: 0,
      youAnswered: 0,
      lapsMoved: 0,
      lapsEnded: 0,
      atMs: 2_000,
    }),
  );
  // What was there before the mark is not news.
  expect(centre).not.toContain("Tidy the README");
});

test("with nothing since the mark, and with no mark, the centre says which", async () => {
  const world = fresh();
  await openRequest(world, "req-old", "Tidy the README", 500);
  const never = await operatorPage(portsOver(world, "ada", []), "t", { kind: "summary" });
  expect(never).toContain(EN.sinceNever);
  await world.record.recordView("ada", 1_000);
  const quiet = await operatorPage(portsOver(world, "ada", []), "t", { kind: "summary" });
  expect(quiet).toContain(EN.sinceNothing(EN.age("4s")));
  // No actor, no mark to have looked from: the section is not drawn at all.
  const nobody = await operatorPage(portsOver(world, null, []), "t", { kind: "summary" });
  expect(nobody).not.toContain('class="since"');
});
