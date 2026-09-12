/**
 * What one lap's turn spent, read off the worker's own transcript.
 *
 * **Why this is a read of a file and not a field of a payload.**
 * `continuo.lap.perform/1` carries twelve fields and none of them is a cost:
 * continuo reads the terminal `result` event for the worker's *report* and for
 * whether the turn errored, and it neither keeps nor forwards the three
 * accounting numbers beside it (`total_cost_usd`, `num_turns`, `duration_ms`).
 * So the only place those numbers exist is the transcript continuo wrote them
 * to, and the three values needed to find it are ones rondo already holds:
 * `--state-root` and `--run-id`, which rondo passes, and the session id, which
 * `lap perform` answers with. Asking continuo to report them instead would be an
 * upstream change and a pin move; `D-0046` takes this side and says what would
 * move it.
 *
 * **The one module in `src/continuo/` that reads a file, and the whole of what
 * it may do to one.** `invoker.ts` owns the spawn and `protocol.ts` owns the
 * pure decode; this owns two reads at a path it computes and nothing else --
 * no write, no delete, no directory walk (`D-0046` rule 4). Keeping it out of
 * `invoker.ts` is `D-0017`'s habit rather than fastidiousness: a capability is
 * granted to the module that needs it, so "which module can touch the
 * filesystem" stays answerable by reading one grant.
 *
 * **Nothing here throws and nothing here is a defect.** A transcript that is
 * missing, truncated, unreadable or carries no `result` event answers
 * {@link NOTHING_READ} -- three nulls -- because a cost rondo could not read
 * must not cost an iteration whose gate is already open, exactly as `D-0029`
 * rule 3 has it for the independent reading. The three nulls are then the
 * record: a lap rondo holds no cost for reads differently from a lap that cost
 * nothing, which is the distinction `D-0046` rule 3 is about.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The three accounting numbers a worker's terminal `result` event carries.
 *
 * **Time and money are separate quantities and both are kept.** A lap can sit
 * well inside `invocationCeilingMs` and cost seven times the one before it
 * (`D-0044`'s table, lap 3 against lap 2), so a duration is not a price and
 * neither stands in for the other.
 *
 * `null` is "rondo did not read this", never "zero": the difference between a
 * lap whose transcript could not be read and a lap that spent nothing is a
 * difference a reader has to be able to see.
 */
export interface LapSpend {
  readonly totalCostUsd: number | null;
  readonly numTurns: number | null;
  readonly durationMs: number | null;
}

/** What every unreadable transcript answers, and the thing a null column says. */
const NOTHING_READ: LapSpend = Object.freeze({
  totalCostUsd: null,
  numTurns: null,
  durationMs: null,
});

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
 * If that ever stops holding, the directory is simply not found and the answer
 * is three nulls -- a lap whose cost rondo did not read, which is a fact it
 * reports rather than a number it invents.
 */
export interface LapSpendRequest {
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
export function lapTranscriptDirectory(request: LapSpendRequest): string {
  return join(request.stateRoot, request.runId, request.sessionId);
}

/**
 * Read what the lap's last turn spent, or answer three nulls.
 *
 * The generation comes from continuo's own `record.json` rather than from a
 * directory listing, because it is the generation continuo read the report off:
 * a resumed session writes a second transcript beside the first, and the newest
 * one is the turn this lap walked. Taking the number from the record is also
 * what keeps this module's filesystem reach at two named files.
 */
export function readLapSpend(request: LapSpendRequest): LapSpend {
  const directory = lapTranscriptDirectory(request);
  const generation = generationOf(readText(join(directory, "record.json")));
  if (generation === null) {
    return NOTHING_READ;
  }
  // `events-{generation:03d}.jsonl`, continuo's own spelling, and not truncated
  // above 999 for the same reason it is not truncated there.
  const transcript = readText(
    join(directory, `events-${String(generation).padStart(3, "0")}.jsonl`),
  );
  return transcript === null ? NOTHING_READ : spendOf(transcript);
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

/**
 * The **last** `result` event of the transcript, as continuo reads it too.
 *
 * A turn writes one; a transcript that somehow carries two is read as the
 * second, which is the rule continuo applies to the same file for the same
 * reason. Lines that do not parse are skipped rather than refused: a transcript
 * whose tail was truncated mid-write still holds every event before the cut.
 */
function spendOf(transcript: string): LapSpend {
  let spend = NOTHING_READ;
  for (const line of transcript.split("\n")) {
    const event = parseObject(line);
    if (event === null || event.type !== "result") {
      continue;
    }
    spend = {
      totalCostUsd: numberAt(event, "total_cost_usd"),
      numTurns: numberAt(event, "num_turns"),
      durationMs: numberAt(event, "duration_ms"),
    };
  }
  return spend;
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

/** A finite number, or null. Never coerced: a cost read off a string is a guess. */
function numberAt(event: Record<string, unknown>, key: string): number | null {
  const value = event[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
