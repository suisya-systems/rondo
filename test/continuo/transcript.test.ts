/**
 * Reading a running lap's log off its transcript (rondo#248 item 3).
 *
 * A finished lap's cost and commands arrive on `lap perform`'s own document
 * (continuo D-1112); what is left here is the page's live log of a lap that has
 * not answered yet. The layout is continuo's own -- `<state root>/<run id>/
 * <session id>/` holding `record.json` and `events-NNN.jsonl` -- written by hand
 * because the question is what rondo does with the bytes.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";

import { lapTranscriptDirectory, readLapLog } from "../../src/continuo/transcript.js";

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

/** The log of the one session a fixture state root holds. */
const logOf = (stateRoot: string) => readLapLog(join(stateRoot, RUN, SESSION));

test("the directory a screen names is the directory this module reads (D-0048 rule 5)", () => {
  // **One composer, asserted as one.** The screen naming a running lap's
  // transcript and the reader opening a finished one must not be two copies of
  // continuo's layout: what `rondo inbox` prints is exactly the directory the
  // fixtures below are written into.
  const directory = lapTranscriptDirectory({
    stateRoot: "/srv/state",
    runId: RUN,
    sessionId: SESSION,
  });
  expect(directory).toBe(join("/srv/state", RUN, SESSION));

  // And it opens nothing: a path for a directory that does not exist is still
  // a path, which is what makes naming one safe on a screen (D-0046 rule 4's
  // grant is unchanged).
  expect(lapTranscriptDirectory({ stateRoot: "/nowhere", runId: RUN, sessionId: SESSION })).toBe(
    join("/nowhere", RUN, SESSION),
  );
});

/** A Claude CLI stream-json tool call, as the module assumes the shape. */
const toolUse = (id: string, name: string, input: unknown) => ({
  type: "assistant",
  message: {
    content: [
      { type: "text", text: "thinking aloud" },
      { type: "tool_use", id, name, input },
    ],
  },
});
const toolResult = (id: string, content: unknown, isError?: boolean) => ({
  type: "user",
  message: {
    content: [
      {
        type: "tool_result",
        tool_use_id: id,
        content,
        ...(isError === undefined ? {} : { is_error: isError }),
      },
    ],
  },
});

test("commands come out with their outputs, line numbers and the final message", () => {
  const stateRoot = sessionDir({
    generation: 0,
    events: {
      "000": transcript(
        { type: "system", subtype: "init" },
        toolUse("t1", "Bash", { command: "npm run verify" }),
        toolResult("t1", "Sandbox is enabled but failed to initialize: EPERM", true),
        toolUse("t2", "Read", { file_path: "AGENTS.md" }),
        toolResult("t2", [
          { type: "text", text: "line one" },
          { type: "image" },
          { type: "text", text: "line two" },
        ]),
        toolUse("t3", "Bash", { command: "git commit -m x" }),
        { ...LAP_5, result: "verify is green" },
      ),
    },
  });

  expect(logOf(stateRoot)).toMatchObject({
    kind: "read",
    commands: [
      {
        index: 2,
        command: "npm run verify",
        output: "Sandbox is enabled but failed to initialize: EPERM",
        isError: true,
      },
      {
        index: 4,
        command: 'Read {"file_path":"AGENTS.md"}',
        output: "line one\nline two",
        isError: false,
      },
      // A call whose result never arrived: no output, and not claimed as an error.
      { index: 6, command: "git commit -m x", output: "", isError: false },
    ],
    finalMessage: "verify is green",
  });
});

test("a transcript with no result event has no final message, and blank lines are not events", () => {
  const stateRoot = sessionDir({
    generation: 0,
    events: { "000": `\n${JSON.stringify(toolUse("t1", "Bash", { command: "ls" }))}\n\n` },
  });

  expect(logOf(stateRoot)).toMatchObject({
    kind: "read",
    commands: [{ index: 2, command: "ls", output: "", isError: false }],
    finalMessage: null,
  });
});

test("a line that is not an event makes the transcript unread, not shorter", () => {
  // A corrupt line with a newline after it would otherwise hand over fewer
  // commands than ran. (A last line with no newline is the one being written;
  // the #248 case below holds that back instead.)
  for (const events of [
    `not json\n${JSON.stringify(toolUse("t1", "Bash", { command: "ls" }))}\n`,
    `${JSON.stringify(toolUse("t1", "Bash", { command: "ls" }))}\n{"type":"us\n`,
  ]) {
    const stateRoot = sessionDir({ generation: 0, events: { "000": events } });
    const reading = logOf(stateRoot);
    expect(reading.kind).toBe("unread");
    expect(reading.kind === "unread" && reading.reason).toContain("is not a JSON event");
  }
});

test("a running lap's unfinished last line is held back and said, and a torn middle is still unread (#248)", () => {
  const ls = JSON.stringify(toolUse("t1", "Bash", { command: "ls" }));
  // Mid-write: the line after the last newline is the one being written.
  const writing = sessionDir({ generation: 0, events: { "000": `${ls}\n{"type":"us` } });
  const directory = join(writing, RUN, SESSION);
  expect(readLapLog(directory)).toEqual({
    kind: "read",
    commands: [{ index: 1, command: "ls", output: "", isError: false }],
    finalMessage: null,
    file: join(directory, "events-000.jsonl"),
    unfinished: true,
  });
  // Every line finished: nothing held back.
  const done = sessionDir({ generation: 0, events: { "000": `${ls}\n` } });
  const read = readLapLog(join(done, RUN, SESSION));
  expect(read.kind === "read" && read.unfinished).toBe(false);
  // A broken line with a newline after it is not being written: still unread.
  const torn = sessionDir({ generation: 0, events: { "000": `not json\n${ls}\n` } });
  expect(readLapLog(join(torn, RUN, SESSION)).kind).toBe("unread");
  // And nothing there is an unread with a reason, never a throw.
  expect(readLapLog(join(tmpdir(), "rondo-no-such-log")).kind).toBe("unread");
});

test("a transcript that cannot be read is unread with a reason, never a throw", () => {
  const noRecord = sessionDir({ events: { "000": transcript(LAP_5) } });
  const noEvents = sessionDir({ generation: 3 });
  for (const stateRoot of [noRecord, noEvents]) {
    const reading = logOf(stateRoot);
    expect(reading.kind).toBe("unread");
    if (reading.kind === "unread") {
      expect(reading.reason).toMatch(/^[\x20-\x7e]+$/);
    }
  }
  const noEventsReading = logOf(noEvents);
  expect(noEventsReading.kind === "unread" && noEventsReading.reason).toContain("events-003.jsonl");
});

test("two result events in one transcript: the final message is the last one's", () => {
  // A resumed turn writes a second `result` event; the rationale the reviewer is
  // handed is the lap's last word, as continuo reads it.
  const stateRoot = sessionDir({
    generation: 0,
    events: {
      "000": transcript(
        { ...LAP_5, result: "first turn: verify could not run" },
        toolUse("t1", "Bash", { command: "npm run verify" }),
        toolResult("t1", "ok"),
        { ...LAP_5, result: "second turn: verify is green" },
      ),
    },
  });

  const reading = logOf(stateRoot);

  expect(reading.kind === "read" && reading.finalMessage).toBe("second turn: verify is green");
});
