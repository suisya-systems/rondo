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

/** A request opened by somebody other than the person looking, so it moves no mark of theirs. */
async function openedBy(
  world: ReturnType<typeof fresh>,
  authorId: string,
  messageId: string,
  body: string,
  atMs: number,
) {
  const outcome = await world.record.recordThreadMessage({
    messageId,
    body,
    authorKind: "operator",
    authorId,
    inReplyTo: null,
    atMs,
    bases: [],
    asks: false,
  });
  expect(outcome.kind).toBe("recorded");
}

test("the empty centre says what moved since the mark, under the box", async () => {
  const world = fresh();
  await openRequest(world, "req-old", "Tidy the README", 500);
  await world.record.recordView("ada", 1_000);
  await openedBy(world, "bo", "req-new", "Add a dark theme", 2_000);
  const html = await operatorPage(portsOver(world, "ada", []), "t", { kind: "summary" });
  const centre = html.slice(html.indexOf('class="empty-centre"'));
  expect(centre).toContain(EN.sinceHeading(EN.age("4s")));
  expect(centre).toContain("Add a dark theme");
  // What was there before the mark is not news.
  expect(centre).not.toContain("Tidy the README");
  // Nothing on it sends the person to a terminal (D-0173 K3).
  expect(centre).not.toContain("rondo inbox");
});

test("a press on the page moves the mark, with no terminal and no write of its own", async () => {
  const world = fresh();
  // Never looked and never pressed: nothing is marked yet.
  const never = await operatorPage(portsOver(world, "ada", []), "t", { kind: "summary" });
  expect(never).toContain(EN.sinceNever);
  expect(never).not.toContain("rondo inbox");
  // Somebody else's request is news; the person's own request, written later, is
  // the press that says they were here -- so the earlier one is not news any more.
  await openedBy(world, "bo", "req-bo", "Add a dark theme", 1_000);
  await openRequest(world, "req-ada", "Tidy the README", 3_000);
  expect(await world.record.lastActed("ada")).toBe(3_000);
  expect(await world.record.lastView("ada")).toBeNull();
  const quiet = await operatorPage(portsOver(world, "ada", []), "t", { kind: "summary" });
  expect(quiet).toContain(EN.sinceNothing(EN.age("2s")));
  // The list's line reads the same mark: both requests sit above it as seen.
  expect(quiet).not.toContain(EN.lastLookedNever);
  // Moved past the press by a later one of somebody else's, the centre says so.
  await openedBy(world, "bo", "req-bo-2", "Name the release", 4_000);
  const moved = await operatorPage(portsOver(world, "ada", []), "t", { kind: "summary" });
  expect(moved.slice(moved.indexOf('class="empty-centre"'))).toContain("Name the release");
});

test("with no actor there is no mark to have looked from, and no section", async () => {
  const world = fresh();
  await openRequest(world, "req-old", "Tidy the README", 500);
  const nobody = await operatorPage(portsOver(world, null, []), "t", { kind: "summary" });
  expect(nobody).not.toContain('class="since"');
});
