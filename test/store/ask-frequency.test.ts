/**
 * rondo#637: how often the drafter asks back, read from the thread's own rows,
 * and `rondo asks`.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import { main } from "../../src/access/cli.js";
import { parseCommand } from "../../src/access/cli-parse.js";
import { consoleSeams } from "../../src/access/console.js";
import { openAdvisoryRecord } from "../../src/store/sqlite.js";

const D = "rondo/drafter/";
const OPTIONS = (recommended: number) =>
  `{"options":[{"text":"a","gives_up":"x"},{"text":"b","gives_up":"y"},` +
  `{"text":"c","gives_up":"z"}],"recommended":${String(recommended)}}`;

function freshStore(): string {
  const path = join(mkdtempSync(join(tmpdir(), "rondo-asks-")), "store.db");
  openAdvisoryRecord(path);
  return path;
}

function seed(path: string): void {
  const db = new DatabaseSync(path);
  const put = db.prepare(
    "INSERT INTO conversation_message (message_id, body, author_kind, author_id, in_reply_to, " +
      "at_ms, asks, answer_outcome, ask_options, answer_option) VALUES (?, 'w', ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const rows: [
    string,
    string,
    string,
    string | null,
    number,
    number | null,
    string | null,
    string | null,
    number | null,
  ][] = [
    // r1: two asks, one deeper in the thread; the recommendation taken once.
    ["r1", "operator", "me", null, 10, null, null, null, null],
    ["r1-ask1", "drafter", `${D}m`, "r1", 11, 1, null, OPTIONS(1), null],
    ["r1-ans1", "operator", "me", "r1-ask1", 12, null, "carry_on", null, 1],
    ["r1-ask2", "drafter", `${D}m`, "r1-ans1", 13, 1, null, OPTIONS(0), null],
    ["r1-ans2", "operator", "me", "r1-ask2", 14, null, "carry_on", null, 2],
    ["r1-plan", "drafter", `${D}m`, "r1-ans2", 15, null, null, null, null],
    // r2: drafted with no ask -- counts, as zero.
    ["r2", "operator", "me", null, 20, null, null, null, null],
    ["r2-plan", "drafter", `${D}m`, "r2", 21, null, null, null, null],
    // r3: the drafter never wrote in it -- not counted.
    ["r3", "operator", "me", null, 30, null, null, null, null],
    // r4: an ask still open, an old ask with no options answered in words,
    // and another writer's ask whose option press is not the drafter's.
    ["r4", "operator", "me", null, 40, null, null, null, null],
    ["r4-ask1", "drafter", `${D}m`, "r4", 41, 1, null, OPTIONS(0), null],
    ["r4-old", "drafter", `${D}m`, "r4", 42, 1, null, null, null],
    ["r4-oldans", "operator", "me", "r4-old", 43, null, "stop", null, null],
    ["r4-wq", "drafter", "rondo/worker-question/1", "r4", 44, 1, null, OPTIONS(0), null],
    ["r4-wqans", "operator", "me", "r4-wq", 45, null, "carry_on", null, 0],
  ];
  for (const row of rows) {
    put.run(...row);
  }
  db.close();
}

test("one row per request the drafter wrote in, counted from the thread", async () => {
  const path = freshStore();
  seed(path);
  expect(await openAdvisoryRecord(path).askFrequency(null, D)).toEqual([
    { request: "r1", atMs: 10, asks: 2, unanswered: 0, pressed: 2, recommended: 1 },
    { request: "r2", atMs: 20, asks: 0, unanswered: 0, pressed: 0, recommended: 0 },
    { request: "r4", atMs: 40, asks: 2, unanswered: 1, pressed: 0, recommended: 0 },
  ]);
  expect((await openAdvisoryRecord(path).askFrequency(20, D)).map((r) => r.request)).toEqual([
    "r2",
    "r4",
  ]);
  expect(await openAdvisoryRecord(freshStore()).askFrequency(null, D)).toEqual([]);
});

test("parse: asks takes --since and nothing else", () => {
  const parsed = parseCommand(["asks", "--since", "1970-01-01T00:00:00.020Z"]);
  expect(parsed.kind === "parsed" && [parsed.parsed.command, parsed.parsed.sinceMs]).toEqual([
    "asks",
    20,
  ]);
  expect(parseCommand(["asks", "--attention"]).kind).toBe("refused");
});

test("rondo asks prints a line per request and one over them all", async () => {
  const run = async (path: string): Promise<string[]> => {
    const out: string[] = [];
    const originalWrite = consoleSeams.write;
    consoleSeams.write = (text: string) => {
      out.push(text);
    };
    try {
      expect(await main(["asks"], { RONDO_STORE: path })).toBe(0);
    } finally {
      consoleSeams.write = originalWrite;
    }
    return out.join("").trimEnd().split("\n");
  };
  const path = freshStore();
  seed(path);
  expect(await run(path)).toEqual([
    "1970-01-01T00:00:00.010Z request=r1 asks=2 unanswered=0 pressed=2 recommended=1",
    "1970-01-01T00:00:00.020Z request=r2 asks=0 unanswered=0 pressed=0 recommended=0",
    "1970-01-01T00:00:00.040Z request=r4 asks=2 unanswered=1 pressed=0 recommended=0",
    "requests=3 asked_in=2 asks=4 asks_per_request=1.33 pressed=2 recommended=1 recommended_share=0.50",
  ]);
  expect(await run(freshStore())).toEqual([
    "requests=0 asked_in=0 asks=0 asks_per_request=- pressed=0 recommended=0 recommended_share=-",
  ]);
});
