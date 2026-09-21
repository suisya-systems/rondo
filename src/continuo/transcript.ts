/**
 * A running lap's log, read off the worker's own transcript (rondo#248 item 3).
 *
 * **What is left here after continuo D-1112, and why it is left.** A finished
 * lap's cost and commands now arrive on `lap perform`'s own document, so rondo
 * no longer reads them from a file. A lap that is *still running* has no such
 * document yet -- `lap perform` answers only when the turn has ended -- so the
 * page's live log still reads the transcript continuo is writing. It stays until
 * `run show` names a running lap's transcript itself (continuo#218).
 *
 * **The one module in `src/continuo/` that reads a file, and the whole of what
 * it may do to one**: two reads at a path it computes -- `record.json` for the
 * generation, then that generation's `events-NNN.jsonl` -- and no write, no
 * delete, no directory walk (`D-0046` rule 4). Nothing here throws.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Where the transcript is: `<state root>/<run id>/<session id>/`.
 *
 * **The run id is in the path and that is continuo's layout, not a guess**
 * (`lapStateRoot` at the pinned revision): the flag names the *parent*, and the
 * directory a provider is actually built over is one per run, derived from the
 * run id so that two laps cannot share it.
 *
 * **rondo joins the run id rather than re-encoding it, and that is safe for
 * every identifier rondo mints.** continuo turns a run id into a directory name
 * through an encoder -- `%XX` for anything outside `[a-z0-9._-]`, a trailing dot
 * escaped, a Windows device name escaped -- and rondo does not carry a second
 * copy of it: `allocator.ts` mints every run id as `rondo-` plus an iteration id
 * matching `[a-z][a-z0-9_-]{0,63}`, which is already inside that safe set, never
 * ends in a dot, and cannot be a reserved name because of the prefix. So the
 * encoding is the identity here, and a second implementation of somebody else's
 * filesystem rules is the thing most likely to disagree with it later.
 *
 * If that ever stops holding, the directory is simply not found and the log
 * reads as unread, which is a fact rondo reports rather than a guess.
 */
export interface LapTranscriptRequest {
  /** The `--state-root` rondo passed to `lap perform`: the *parent*. */
  readonly stateRoot: string;
  /** The `--run-id` rondo passed, which names the directory under it. */
  readonly runId: string;
  /** The session: what `lap perform` answered with, or -- for a lap that is
   *  still running -- what `run show` names (D-0048). */
  readonly sessionId: string;
}

/**
 * Where a lap's transcript is, as a path and without opening anything.
 *
 * **Exported so that the screen naming the directory and the reader opening it
 * compose it in one place** (D-0048 rule 5). A second `join` on a surface would
 * be a second copy of continuo's directory rules -- the thing this module's own
 * header says is most likely to drift from them -- and naming a path is not
 * reading one, so this widens no capability: the grant D-0046 rule 4 gives this
 * module is unchanged, and a caller holding this string has exactly what an
 * operator has.
 */
export function lapTranscriptDirectory(request: LapTranscriptRequest): string {
  return join(request.stateRoot, request.runId, request.sessionId);
}

/**
 * One command a lap ran, and what it returned (D-0065 rule 1.2.4).
 *
 * `index` is the 1-based line number of the `tool_use` event in the transcript
 * file, which is how the docs cite a transcript (`events-000.jsonl L41`) and
 * what a reviewer's `event` basis names. `output` is the matching
 * `tool_result`'s text, or the empty string when the transcript holds none (a
 * lap cut off mid-call); `isError` is that result's own flag, false when absent.
 */
export interface TranscriptCommand {
  readonly index: number;
  readonly command: string;
  readonly output: string;
  readonly isError: boolean;
}

/** A lap's transcript reduced to its commands and final message, or why not. */
export type LapTranscriptReading =
  | {
      readonly kind: "read";
      readonly commands: readonly TranscriptCommand[];
      readonly finalMessage: string | null;
    }
  | { readonly kind: "unread"; readonly reason: string };

/**
 * What the page reads of a running lap's log: the transcript's commands, final
 * message, the file it came from, and whether a last line was held back.
 */
export type LapLogReading =
  | (Extract<LapTranscriptReading, { kind: "read" }> & {
      /** The transcript file read, so a person can find the whole of it. */
      readonly file: string;
      /** A last line with no newline yet: the lap is still writing it. */
      readonly unfinished: boolean;
    })
  | Extract<LapTranscriptReading, { kind: "unread" }>;

/**
 * The transcript of a lap that may still be running (rondo#248 item 3), at
 * the directory `locateTranscript` named.
 *
 * **The same two named files, and one difference.** A running lap is mid-write,
 * so a last line with no newline after it is the line it is writing, not a
 * torn transcript: it is held back and said to be (`unfinished`) rather than
 * making the whole log unread. Every other line that is not an event still
 * makes it unread.
 */
export function readLapLog(directory: string): LapLogReading {
  const generation = generationOf(readText(join(directory, "record.json")));
  if (generation === null) {
    return {
      kind: "unread",
      reason: "the lap's record.json could not be read or names no generation",
    };
  }
  const file = join(directory, `events-${String(generation).padStart(3, "0")}.jsonl`);
  const transcript = readText(file);
  if (transcript === null) {
    return { kind: "unread", reason: `the lap's transcript ${file} could not be read` };
  }
  const end = transcript.lastIndexOf("\n") + 1;
  const reading = commandsOf(transcript.slice(0, end));
  return reading.kind === "unread"
    ? reading
    : { ...reading, file, unfinished: transcript.slice(end).trim() !== "" };
}

/** Reduce a transcript's lines to tool calls paired with their results. */
function commandsOf(transcript: string): LapTranscriptReading {
  const commands: {
    index: number;
    id: unknown;
    command: string;
    output: string;
    isError: boolean;
  }[] = [];
  let finalMessage: string | null = null;
  for (const [lineIndex, line] of transcript.split("\n").entries()) {
    if (line.trim() === "") {
      continue;
    }
    const event = parseObject(line);
    // **A line that is not an event makes the whole transcript unread**, not a
    // shorter one. Skipping it would hand the reviewer a transcript missing
    // commands or outputs under a coverage line saying it read them, and a
    // truncated file would pass as a complete one (D-0065 rule 1.2.4).
    if (event === null) {
      return {
        kind: "unread",
        reason: `the lap's transcript line ${String(lineIndex + 1)} is not a JSON event, so no part of it is read`,
      };
    }
    if (event.type === "result") {
      finalMessage = typeof event.result === "string" ? event.result : null;
      continue;
    }
    for (const block of contentBlocks(event)) {
      if (block.type === "tool_use") {
        commands.push({
          index: lineIndex + 1,
          id: block.id,
          command: commandText(block),
          output: "",
          isError: false,
        });
      } else if (block.type === "tool_result") {
        const call = commands.find((c) => c.id !== undefined && c.id === block.tool_use_id);
        if (call !== undefined) {
          call.output = resultText(block.content);
          call.isError = block.is_error === true;
        }
      }
    }
  }
  return {
    kind: "read",
    commands: commands.map(({ index, command, output, isError }) => ({
      index,
      command,
      output,
      isError,
    })),
    finalMessage,
  };
}

/** An event's `message.content` blocks that are objects, or none. */
function contentBlocks(event: Record<string, unknown>): Record<string, unknown>[] {
  const message = event.message;
  if (typeof message !== "object" || message === null) {
    return [];
  }
  const content = (message as Record<string, unknown>).content;
  return Array.isArray(content)
    ? content.filter(
        (block): block is Record<string, unknown> =>
          typeof block === "object" && block !== null && !Array.isArray(block),
      )
    : [];
}

/** A `Bash` call's command, or any other tool's name and JSON input. */
function commandText(block: Record<string, unknown>): string {
  const name = typeof block.name === "string" ? block.name : "unknown-tool";
  const input = block.input;
  if (name === "Bash" && typeof input === "object" && input !== null) {
    const command = (input as Record<string, unknown>).command;
    if (typeof command === "string") {
      return command;
    }
  }
  return `${name} ${JSON.stringify(input ?? null)}`;
}

/** A `tool_result`'s content as text: a string, or its text blocks joined. */
function resultText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((part) =>
      typeof part === "object" && part !== null && typeof part.text === "string" ? part.text : "",
    )
    .filter((text) => text !== "")
    .join("\n");
}

/** One file, or null for every reason a read can fail. */
function readText(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/** continuo's `record.json`, reduced to the one key this module needs. */
function generationOf(record: string | null): number | null {
  if (record === null) {
    return null;
  }
  const parsed = parseObject(record);
  const generation = parsed === null ? undefined : parsed.generation;
  return typeof generation === "number" && Number.isSafeInteger(generation) && generation >= 0
    ? generation
    : null;
}

/** One line as a JSON object, or null for anything else -- including an array. */
function parseObject(text: string): Record<string, unknown> | null {
  if (text.trim() === "") {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : null;
}
