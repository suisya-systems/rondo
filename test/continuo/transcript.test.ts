/**
 * Reading what a lap spent off a transcript (`D-0046`).
 *
 * The layout under test is continuo's own: `<state root>/<run id>/<session id>/`
 * holding
 * `record.json` and `events-NNN.jsonl`, written here by hand because the
 * question is what rondo does with the bytes rather than what continuo writes.
 * The fixture numbers are the ones lap 5 of the dogfood actually measured
 * (`docs/operations/lap-5-dogfood.md` section 5), so a reader can compare what
 * comes out of this file with what was parsed out of that lap's transcript by
 * hand.
 *
 * **Every case here is a way of getting nothing**, except the two that get
 * something. That ratio is the point: a cost rondo could not read must be three
 * nulls rather than an exception, a zero, or a partially-filled record.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";

import { readLapSpend } from "../../src/continuo/transcript.js";

const SESSION = "59a9bc45-c34a-4a83-b234-2a7f648d3a6f";

/** A run id as `allocator.ts` mints them: `rondo-` plus an iteration id. */
const RUN = "rondo-dogfood-096";

/** Lap 5's terminal `result` event, reduced to the keys this module reads. */
const LAP_5 = {
  type: "result",
  subtype: "success",
  is_error: false,
  total_cost_usd: 1.542,
  num_turns: 38,
  duration_ms: 203_324,
};

/** Three nulls, and the read each of the three reasons for them came from. */
const UNREAD = { totalCostUsd: null, numTurns: null, durationMs: null, source: "unread" };
const NO_RESULT_EVENT = {
  totalCostUsd: null,
  numTurns: null,
  durationMs: null,
  source: "resultEventAbsent",
};
const NO_NUMBERS = {
  totalCostUsd: null,
  numTurns: null,
  durationMs: null,
  source: "resultEvent",
};

/**
 * A session directory, with whatever files the case wants in it.
 *
 * `generation` writes the record; `events` is keyed by generation so a case can
 * put a different transcript under each one.
 */
function sessionDir(options: {
  readonly generation?: unknown;
  readonly events?: Readonly<Record<string, string>>;
  readonly record?: string;
}): string {
  const stateRoot = mkdtempSync(join(tmpdir(), "rondo-transcript-"));
  // `<state root>/<run id>/<session id>`: the flag names the parent and continuo
  // puts one directory per run under it (`lapStateRoot` at the pinned revision).
  const directory = join(stateRoot, RUN, SESSION);
  mkdirSync(directory, { recursive: true });
  if (options.record !== undefined) {
    writeFileSync(join(directory, "record.json"), options.record, "utf8");
  } else if (options.generation !== undefined) {
    writeFileSync(
      join(directory, "record.json"),
      JSON.stringify({ session_id: SESSION, generation: options.generation }),
      "utf8",
    );
  }
  for (const [generation, body] of Object.entries(options.events ?? {})) {
    writeFileSync(join(directory, `events-${generation}.jsonl`), body, "utf8");
  }
  return stateRoot;
}

/** A transcript: one line per event, as the worker CLI writes it. */
const transcript = (...events: readonly unknown[]): string =>
  `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;

test("the three numbers come off the terminal result event", () => {
  const stateRoot = sessionDir({
    generation: 0,
    events: {
      "000": transcript({ type: "system", subtype: "init" }, { type: "assistant" }, LAP_5),
    },
  });

  expect(readLapSpend({ stateRoot, runId: RUN, sessionId: SESSION })).toEqual({
    totalCostUsd: 1.542,
    numTurns: 38,
    durationMs: 203_324,
    source: "resultEvent",
  });
});

test("a lap that spent nothing reads as zero and not as unread", () => {
  // The distinction the nullable columns exist for: a free lap is a fact, and a
  // reader must be able to tell it from a lap whose transcript rondo never read.
  const stateRoot = sessionDir({
    generation: 0,
    events: { "000": transcript({ ...LAP_5, total_cost_usd: 0, num_turns: 0, duration_ms: 0 }) },
  });

  expect(readLapSpend({ stateRoot, runId: RUN, sessionId: SESSION })).toEqual({
    totalCostUsd: 0,
    numTurns: 0,
    durationMs: 0,
    source: "resultEvent",
  });
});

test("the generation comes from the record, so a resumed session reads its newest turn", () => {
  const stateRoot = sessionDir({
    generation: 1,
    events: {
      "000": transcript({ ...LAP_5, total_cost_usd: 9.99 }),
      "001": transcript(LAP_5),
    },
  });

  expect(readLapSpend({ stateRoot, runId: RUN, sessionId: SESSION }).totalCostUsd).toBe(1.542);
});

test("the last result event wins, as it does for continuo reading the same file", () => {
  const stateRoot = sessionDir({
    generation: 0,
    events: { "000": transcript({ ...LAP_5, total_cost_usd: 9.99 }, LAP_5) },
  });

  expect(readLapSpend({ stateRoot, runId: RUN, sessionId: SESSION }).totalCostUsd).toBe(1.542);
});

test("a line that does not parse is skipped rather than refused", () => {
  // A transcript cut mid-write still holds every event before the cut.
  const stateRoot = sessionDir({
    generation: 0,
    events: { "000": `${JSON.stringify(LAP_5)}\n{"type":"assis` },
  });

  expect(readLapSpend({ stateRoot, runId: RUN, sessionId: SESSION }).numTurns).toBe(38);
});

test("a result event that carries none of the three numbers is not an unread transcript", () => {
  // The fake worker continuo's own tests spawn writes exactly this shape: a
  // terminal `result` event with an outcome and no accounting. It is the case
  // rondo#130 is about: three nulls, and a transcript that was read perfectly
  // well -- so the source has to say `resultEvent` and not `unread`.
  const stateRoot = sessionDir({
    generation: 0,
    events: {
      "000": transcript({ type: "result", subtype: "success", terminal_reason: "completed" }),
    },
  });

  expect(readLapSpend({ stateRoot, runId: RUN, sessionId: SESSION })).toEqual(NO_NUMBERS);
});

test("a number that is not a number is not coerced", () => {
  const stateRoot = sessionDir({
    generation: 0,
    events: { "000": transcript({ ...LAP_5, total_cost_usd: "1.542", num_turns: null }) },
  });

  expect(readLapSpend({ stateRoot, runId: RUN, sessionId: SESSION })).toEqual({
    totalCostUsd: null,
    numTurns: null,
    durationMs: 203_324,
    source: "resultEvent",
  });
});

test("a transcript with no result event at all reads as three nulls, and says so", () => {
  const stateRoot = sessionDir({
    generation: 0,
    events: { "000": transcript({ type: "system" }, { type: "assistant" }) },
  });

  expect(readLapSpend({ stateRoot, runId: RUN, sessionId: SESSION })).toEqual(NO_RESULT_EVENT);
});

test("every way the files can be missing or unusable reads as an unread transcript", () => {
  const cases: Readonly<Record<string, string>> = {
    "no run directory": mkdtempSync(join(tmpdir(), "rondo-transcript-")),
    "no record": sessionDir({ events: { "000": transcript(LAP_5) } }),
    "a record that is not JSON": sessionDir({
      record: "{",
      events: { "000": transcript(LAP_5) },
    }),
    "a record with no generation": sessionDir({
      record: JSON.stringify({ session_id: SESSION }),
      events: { "000": transcript(LAP_5) },
    }),
    "a generation that is not a number": sessionDir({
      generation: "0",
      events: { "000": transcript(LAP_5) },
    }),
    "a generation whose transcript is absent": sessionDir({
      generation: 2,
      events: { "000": transcript(LAP_5) },
    }),
  };

  for (const [name, stateRoot] of Object.entries(cases)) {
    expect(readLapSpend({ stateRoot, runId: RUN, sessionId: SESSION }), name).toEqual(UNREAD);
  }
});

test("an empty transcript was read, so it is not a transcript rondo could not read", () => {
  // The file opened and holds no `result` event, which is a different fact from
  // a file that would not open -- the same distinction one line down.
  const stateRoot = sessionDir({ generation: 0, events: { "000": "" } });

  expect(readLapSpend({ stateRoot, runId: RUN, sessionId: SESSION })).toEqual(NO_RESULT_EVENT);
});

test("a run id under another run's directory is not this lap's cost", () => {
  // The run id is part of the path because continuo puts one directory per run
  // under the flag, so a reader of another run's directory finds nothing here
  // rather than the wrong lap's bill.
  const stateRoot = sessionDir({ generation: 0, events: { "000": transcript(LAP_5) } });

  expect(readLapSpend({ stateRoot, runId: "rondo-other", sessionId: SESSION })).toEqual(UNREAD);
});

test("a generation above 999 is not truncated", () => {
  // continuo pads to three digits and does not cut above them, so
  // `events-1000.jsonl` is the name of generation 1000 on both sides.
  const stateRoot = sessionDir({ generation: 1000, events: { "1000": transcript(LAP_5) } });

  expect(readLapSpend({ stateRoot, runId: RUN, sessionId: SESSION }).numTurns).toBe(38);
});
