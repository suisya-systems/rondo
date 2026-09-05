/**
 * continuo's `--json` wire protocol, read at runtime and turned into rondo's
 * own records.
 *
 * D-0015 rule 2: nothing typed crosses the process boundary, so this module is
 * the whole of what rondo knows about continuo's documents, and no type
 * declared here escapes the layer shaped like continuo's own. D-0017 makes it a
 * module of its own, with no capabilities at all: it names no external module,
 * spawns nothing, and reads nothing from disk. Everything below is a pure
 * function of bytes that somebody else collected, which is what makes every
 * refusal path a fast unit case instead of something only a built continuo can
 * reach.
 *
 * **The envelope, as measured at the pinned revision (D-0017).**
 *
 *     exit 0, stdout:  {"schema":"continuo.<verb>/1","ok":true,"db":"...", ...payload}
 *     exit 2, stderr:  {"schema":"continuo.<verb>/1","ok":false,"db":"...",
 *                       "error":{"class":"...","message":"..."}}
 *
 * **Read the discriminator first, and accept what you did not ask for.**
 * `schema` is checked before `ok`, `ok` before the common fields, and the
 * common fields before the payload, because a document whose `schema` rondo
 * does not recognise is a refusal to proceed rather than a value to coerce.
 * Unknown *keys*, by contrast, are accepted everywhere: continuo's `/1` policy
 * is explicit that a verb which grows a field does not change its schema id, so
 * a decoder that refused extra keys would break on continuo's next additive
 * release for no benefit at all. Required keys are required; everything else
 * is somebody else's business.
 *
 * **`error.class` is a hint, not a taxonomy.** continuo says so itself: one
 * class covers several unrelated conditions, and the message is the authority.
 * So this module carries the class through as an opaque string for a human to
 * read and never branches on it.
 *
 * **Six outcomes, and the difference between them is who has to act.**
 * {@link ContinuoResult} is closed over exactly the six, because the answer to
 * "what does rondo do now?" differs for each: an answered call has a payload;
 * an upstream refusal is continuo's answer and belongs to the operator; a prose
 * refusal is the same thing said in words rondo may relay but never parse; a
 * protocol refusal means the seam is not the seam rondo was built against and
 * rondo stops; a defect is rondo's own bug, which an operator should never have
 * been shown; and a timeout is rondo's own ceiling firing, which is a fact this
 * module can *name* but never produce -- only `invoker.ts` owns a timer.
 */

/** The JSON rondo is prepared to see. A wire vocabulary, not a rondo type. */
type JsonValue = string | number | boolean | null | readonly JsonValue[] | JsonObject;

interface JsonObject {
  readonly [key: string]: JsonValue | undefined;
}

/**
 * What one finished invocation produced, before anything is read from it.
 *
 * `status` is null exactly when the child died on a signal, which is how
 * `node:child_process` reports it; both are carried so that the defect message
 * can say which happened. The two streams are separate because continuo's
 * contract splits them -- success on stdout, refusal on stderr -- and a reader
 * that merged them could not tell "refused with a reason" from "printed
 * nothing".
 */
export interface InvocationOutput {
  readonly status: number | null;
  readonly signal: string | null;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * What rondo got out of a continuo invocation.
 *
 * Deliberately parameterised by rondo's own payload type: a caller of
 * {@link decode} holds a `ContinuoResult<GateList>`, never a continuo document.
 */
export type ContinuoResult<T> =
  /** Exit 0 and a document rondo understood. `db` is null only for the one
   *  unwrapped verb, which carries no envelope to read it from; `revision` is
   *  not here at all, because it is the startup record's job rather than a
   *  per-call claim. */
  | { readonly kind: "answered"; readonly db: string | null; readonly payload: T }
  /** Exit 2 and a refusal envelope. continuo's answer, addressed to a person. */
  | {
      readonly kind: "refused";
      readonly db: string;
      readonly errorClass: string;
      readonly message: string;
    }
  /** Exit 2 whose stderr is not a document: an argparse-level refusal, in
   *  prose. Relayed verbatim (escaped at the terminal boundary), never parsed. */
  | { readonly kind: "refusedInProse"; readonly text: string }
  /** The seam did not answer in the protocol rondo was built against. rondo
   *  stops rather than guessing what the document meant. */
  | { readonly kind: "protocolRefusal"; readonly reason: string }
  /** rondo called continuo wrong, or the process failed. Never an operator's
   *  fault, and never relayed as though it were continuo's answer. */
  | { readonly kind: "invokerDefect"; readonly reason: string }
  /**
   * **rondo's own ceiling fired, and nothing came back.**
   *
   * A sixth variant rather than a sixth spelling of `invokerDefect`, and the
   * difference is not cosmetic: rondo's ceiling firing is not the same fact as
   * a defect diagnosed after the child closed. rondo's timer kills the *CLI*
   * and not the fenced child continuo started, so a ceiling that fired means a
   * worker may still be alive with nobody polling it, while every other defect
   * is a process that is over.
   *
   * The conductor's single-flight invariant turns on exactly that difference:
   * an answer -- even a refusal -- releases the lock, and a silence keeps it
   * (D-0019 rules 11 and 12). Folding the two together would let the next lap
   * be admitted while an orphan was still writing to the same worktree, which
   * is the one race the invariant exists to prevent.
   *
   * {@link decode} never produces it. It is a fact about a timer, and the timer
   * is `invoker.ts`'s.
   */
  | { readonly kind: "timedOut"; readonly reason: string };

/**
 * What rondo reads out of one verb's document.
 *
 * A contract per verb rather than one big decoder, because the schema id and
 * the payload reader have to agree and this is the only place they can be
 * written down together. `command` is the argv prefix the invoker puts on the
 * command line, so the verb's name, its schema and its reader travel as one
 * value and cannot drift apart in three files.
 */
export interface VerbContract<T> {
  readonly command: readonly string[];
  readonly schema: string;
  /**
   * How long rondo will wait for this verb before it gives up.
   *
   * **Per verb, because the number bounds a verb and not a seam** (D-0019
   * rule 12). A single module-level constant was wrong by an order of magnitude
   * the moment `lap perform` existed: continuo's own default turn timeout is
   * fifteen minutes, and a sixty-second ceiling would have killed every real
   * lap at one fifteenth of the time continuo expected to spend. Carried beside
   * the schema and the reader so the three facts about a verb travel as one
   * value, which is the same argument `command` is here for.
   *
   * The invoker may override it per call; see `LAP_PERFORM`, which is the one
   * verb whose real bound is the operator's declared patience rather than
   * anything rondo can write down.
   */
  readonly timeoutMs: number;
  readonly read: (payload: JsonObject) => T;
}

/** Every field this module failed to read, as the path a human would name. */
class PayloadMismatch extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayloadMismatch";
  }
}

// --- reading fields ---------------------------------------------------------

function requireString(document: JsonObject, key: string): string {
  const value = document[key];
  if (typeof value !== "string") {
    throw new PayloadMismatch(`'${key}' is ${describe(value)}, and a string was required`);
  }
  return value;
}

function requireNumber(document: JsonObject, key: string): number {
  const value = document[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new PayloadMismatch(`'${key}' is ${describe(value)}, and a finite number was required`);
  }
  return value;
}

function requireBoolean(document: JsonObject, key: string): boolean {
  const value = document[key];
  if (typeof value !== "boolean") {
    throw new PayloadMismatch(`'${key}' is ${describe(value)}, and a boolean was required`);
  }
  return value;
}

/**
 * A field continuo answers with a string or with `null`, and always answers.
 *
 * `gate show`'s `outcome` is null while the gate is open and `run_id` is null
 * for a gate scoped to something other than a run, so a decoder that demanded a
 * string would refuse continuo's ordinary answers. **Absent is not null**: at
 * the pinned revision every one of these keys is emitted on every document that
 * carries it, so a missing key is a document that does not match the shape
 * rondo pinned, and folding the two together would be the decoder declining to
 * validate exactly where it looks like it is validating. Null is an answer;
 * absence is a defect.
 */
function nullableString(document: JsonObject, key: string): string | null {
  const value = document[key];
  if (value === undefined) {
    throw new PayloadMismatch(`'${key}' is absent, and a string or null was required`);
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new PayloadMismatch(`'${key}' is ${describe(value)}, and a string or null was required`);
  }
  return value;
}

/**
 * A field continuo answers with an object or with `null`, and always answers.
 *
 * The third reader under {@link nullableString}'s absent-is-not-null rule, and
 * it exists for `lap perform`'s `endpoint_lease_failure`: continuo says of that
 * key, in its own words, that it is "always present, and `null` when there is
 * nothing to say", and adds that a host which had to tell an absent key from a
 * null one to learn the lap was clean would be reading the absence of evidence
 * as evidence. So absence is a defect here exactly as it is there.
 */
function nullableObject(document: JsonObject, key: string): JsonObject | null {
  const value = document[key];
  if (value === undefined) {
    throw new PayloadMismatch(`'${key}' is absent, and an object or null was required`);
  }
  if (value === null) {
    return null;
  }
  if (!isJsonObject(value)) {
    throw new PayloadMismatch(`'${key}' is ${describe(value)}, and an object or null was required`);
  }
  return value;
}

function requireObjectArray(document: JsonObject, key: string): readonly JsonObject[] {
  const value = document[key];
  if (!Array.isArray(value)) {
    throw new PayloadMismatch(`'${key}' is ${describe(value)}, and an array was required`);
  }
  return value.map((element, index) => {
    if (!isJsonObject(element)) {
      throw new PayloadMismatch(
        `'${key}[${index}]' is ${describe(element)}, and an object was required`,
      );
    }
    return element;
  });
}

function requireObject(document: JsonObject, key: string): JsonObject {
  const value = document[key];
  if (!isJsonObject(value)) {
    throw new PayloadMismatch(`'${key}' is ${describe(value)}, and an object was required`);
  }
  return value;
}

/** What a value is, in the words a mismatch message needs. */
function describe(value: JsonValue | undefined): string {
  if (value === undefined) {
    return "absent";
  }
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "an array";
  }
  return `a ${typeof value}`;
}

/**
 * One field, read through a variable key.
 *
 * A helper rather than `document.schema`, which would also find `toString` and
 * every other prototype name, and rather than `document["schema"]`, which the
 * linter rewrites into exactly that. The readers above all index with a
 * parameter for the same reason; this is the one call site that had a literal.
 */
function fieldValue(document: JsonObject, key: string): JsonValue | undefined {
  return document[key];
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// --- rondo's records --------------------------------------------------------

/** `db create`: the database exists, at a schema version rondo can state. */
export interface DatabaseCreated {
  readonly schemaVersion: number;
  readonly headVersion: number;
}

/** `run admit`: the run exists. The event ids are continuo's bookkeeping and
 *  are accepted, unread, rather than mirrored into a rondo record lap 1 has no
 *  use for. */
export interface RunAdmitted {
  readonly runId: string;
  readonly status: string;
  readonly createdAtMs: number;
}

/** One row of `gate list`. */
export interface OpenGate {
  readonly gateId: string;
  readonly gateType: string;
  /** Null for a gate that is not scoped to a run: continuo's `OpenGateSummary`
   *  carries `string | null` and emits the column verbatim, so a decoder that
   *  demanded a string would fail on a subject-scoped gate and call continuo's
   *  ordinary answer a protocol break. */
  readonly runId: string | null;
  readonly stage: string;
  readonly deadlineAtMs: number | null;
}

/** `gate show`, cut to what a host asks it: which gate, where it stands, and
 *  whether it has an outcome yet. The relays and transitions are read past. */
export interface GateDetail {
  readonly gateId: string;
  readonly gateType: string;
  /** Nullable for the same reason as {@link OpenGate.runId}. */
  readonly runId: string | null;
  readonly stage: string;
  readonly outcome: string | null;
}

/**
 * `gate close`, which answers in the envelope as of the pinned revision
 * (`continuo D-0092`, rondo D-0017 rule 1).
 *
 * `closed` is whether *this* call performed the close: `false` is the
 * idempotent repeat of an identical close and is a success, not a refusal. The
 * two stages are equal today by construction and are both read anyway, under
 * continuo's own names, so a close that one day does move a stage reads the
 * same way.
 */
export interface GateClosed {
  readonly gateId: string;
  readonly closed: boolean;
  readonly outcome: string | null;
  readonly fromStage: string | null;
  readonly toStage: string | null;
}

/**
 * `measure report`, which is the one verb whose success is NOT an envelope.
 *
 * Exit 0 and stdout is an unwrapped document identified by `report_kind`, with
 * no `schema` and no `ok` (D-0015 rule 4). rondo reads the kind and nothing
 * else in lap 1: the report's body is a measurement surface rondo has no
 * decision about yet, and inventing records for it here would be modelling
 * continuo rather than consuming it.
 */
export interface MeasureReport {
  readonly reportKind: string;
}

/**
 * `lap perform`: one admitted run walked to an open gate.
 *
 * The eleven fields continuo's `report()` writes under `--json`, read whole
 * rather than cut down: this is the one verb whose document is the *only*
 * record of what a lap did, and every field on it is either something the
 * conductor stores against the iteration or the handle on something it does.
 */
export interface LapPerformed {
  readonly runId: string;
  /** The worktree the run was materialised into. A real path, unlike the one
   *  below. */
  readonly workspace: string;
  readonly topicBranch: string;
  readonly baseCommit: string;
  readonly sessionId: string;
  /**
   * **The walk's own name for the road it took, and NOT a filesystem path.**
   *
   * `started`, `respawned` or `resumed`. continuo's own header says so where it
   * writes the field, and the human line beside the session id says it too. The
   * rondo field is named `sessionPath` because renaming continuo's key on the
   * way in would hide which key this is, and this comment is the price of that:
   * a decoder that called it a path -- or a record that let a reader infer one
   * from the name alone -- would mislead every reader downstream, and the ones
   * furthest downstream are the ones who would try to open it.
   */
  readonly sessionPath: string;
  /** The gate the conductor then suspends on (D-0019 rule 5). */
  readonly gateId: string;
  /** continuo's bookkeeping for the ingested report, and the only handle on
   *  it. */
  readonly eventId: string;
  readonly eventSeq: number;
  /**
   * Why the outbox delivery lease could not be taken, or null when it was.
   *
   * Reduced to continuo's own message: continuo sends `{ "message": ... }`
   * because `successLine` takes primitives and an `Error` handed to a JSON
   * encoder is whatever its enumerable fields happen to be -- for an `Error`,
   * nothing. rondo carries the one field that object has rather than mirroring
   * a wrapper with a single key.
   */
  readonly endpointLeaseFailure: string | null;
  /** A gate deadline that had already passed when the report arrived: continuo
   *  drops it and opens the gate anyway rather than losing the report. */
  readonly elapsedDeadlineAtMs: number | null;
}

// --- the verb contracts -----------------------------------------------------

/**
 * How long a *control-plane* verb may take before rondo gives up.
 *
 * A ceiling on a hang rather than a performance budget: the measured cost of a
 * driven verb is about a tenth of a second (D-0015), so a minute is three
 * orders of magnitude of headroom and still bounded, which is what a test suite
 * and an interactive host both need from a subprocess.
 *
 * This is the number that used to be `invoker.ts`'s one module-level constant,
 * and its justification came with it: it is a true statement about these five
 * verbs and was never true of `lap perform`, which walks a worker. Naming it
 * here, beside the contracts it bounds, is D-0019 rule 12 part 1.
 */
const CONTROL_PLANE_TIMEOUT_MS = 60_000;

export const DB_CREATE: VerbContract<DatabaseCreated> = {
  command: ["db", "create"],
  schema: "continuo.db.create/1",
  timeoutMs: CONTROL_PLANE_TIMEOUT_MS,
  read: (payload) => ({
    schemaVersion: requireNumber(payload, "schema_version"),
    headVersion: requireNumber(payload, "head_version"),
  }),
};

export const RUN_ADMIT: VerbContract<RunAdmitted> = {
  command: ["run", "admit"],
  schema: "continuo.run.admit/1",
  timeoutMs: CONTROL_PLANE_TIMEOUT_MS,
  read: (payload) => ({
    runId: requireString(payload, "run_id"),
    status: requireString(payload, "status"),
    createdAtMs: requireNumber(payload, "created_at_ms"),
  }),
};

export const GATE_LIST: VerbContract<readonly OpenGate[]> = {
  command: ["gate", "list"],
  schema: "continuo.gate.list/1",
  timeoutMs: CONTROL_PLANE_TIMEOUT_MS,
  read: (payload) =>
    requireObjectArray(payload, "gates").map((gate) => ({
      gateId: requireString(gate, "gate_id"),
      gateType: requireString(gate, "gate_type"),
      runId: nullableString(gate, "run_id"),
      stage: requireString(gate, "stage"),
      deadlineAtMs: nullableNumber(gate, "deadline_at_ms"),
    })),
};

export const GATE_SHOW: VerbContract<GateDetail> = {
  command: ["gate", "show"],
  schema: "continuo.gate.show/1",
  timeoutMs: CONTROL_PLANE_TIMEOUT_MS,
  read: (payload) => ({
    gateId: requireString(payload, "gate_id"),
    gateType: requireString(payload, "gate_type"),
    runId: nullableString(payload, "run_id"),
    stage: requireString(payload, "stage"),
    outcome: nullableString(payload, "outcome"),
  }),
};

export const GATE_CLOSE: VerbContract<GateClosed> = {
  command: ["gate", "close"],
  schema: "continuo.gate.close/1",
  timeoutMs: CONTROL_PLANE_TIMEOUT_MS,
  read: (payload) => ({
    gateId: requireString(payload, "gate_id"),
    closed: requireBoolean(payload, "closed"),
    outcome: nullableString(payload, "outcome"),
    fromStage: nullableString(payload, "from_stage"),
    toStage: nullableString(payload, "to_stage"),
  }),
};

/**
 * The floor under `lap perform`'s ceiling, and never the ceiling itself.
 *
 * continuo's own default turn timeout is fifteen minutes, and the turn is only
 * the middle of the invocation: before it, `lap perform` takes the global
 * delivery lease, materialises a worktree and renders a fence; after it,
 * ingests the report and opens the gate. So this number is the smallest value
 * that is not obviously wrong, not an estimate of a lap -- and the invoker
 * overrides it on every call with the plan's `invocationCeilingMs`, which is
 * the operator's declared patience (D-0019 rule 12).
 */
const LAP_PERFORM_FLOOR_MS = 900_000;

export const LAP_PERFORM: VerbContract<LapPerformed> = {
  command: ["lap", "perform"],
  // Read off continuo's `src/lap/cli.ts` at the pinned revision, where it is
  // declared as `PERFORM_SCHEMA`, rather than assembled from the verb's name.
  schema: "continuo.lap.perform/1",
  timeoutMs: LAP_PERFORM_FLOOR_MS,
  read: (payload) => ({
    runId: requireString(payload, "run_id"),
    workspace: requireString(payload, "workspace"),
    topicBranch: requireString(payload, "topic_branch"),
    baseCommit: requireString(payload, "base_commit"),
    sessionId: requireString(payload, "session_id"),
    sessionPath: requireString(payload, "session_path"),
    gateId: requireString(payload, "gate_id"),
    eventId: requireString(payload, "event_id"),
    eventSeq: requireNumber(payload, "event_seq"),
    endpointLeaseFailure: leaseFailureMessage(payload),
    elapsedDeadlineAtMs: nullableNumber(payload, "elapsed_deadline_at_ms"),
  }),
};

/**
 * `endpoint_lease_failure`, reduced to the message inside it.
 *
 * A helper rather than an inline expression, because the field is read in two
 * steps and the second one is easy to get wrong: `nullableObject` decides
 * whether continuo had anything to say, and only then is there a `message` to
 * require. Reading it the other way round would turn a clean lap into a
 * mismatch on a key that was never supposed to be there.
 */
function leaseFailureMessage(payload: JsonObject): string | null {
  const failure = nullableObject(payload, "endpoint_lease_failure");
  return failure === null ? null : requireString(failure, "message");
}

/**
 * A deadline continuo answers with `null` for a gate that has none.
 *
 * Absent is a defect here for the reason {@link nullableString} gives: the key
 * is always emitted, so its absence is not the same fact as its being null.
 */
function nullableNumber(document: JsonObject, key: string): number | null {
  const value = document[key];
  if (value === undefined) {
    throw new PayloadMismatch(`'${key}' is absent, and a finite number or null was required`);
  }
  if (value === null) {
    return null;
  }
  return requireNumber(document, key);
}

// --- the decoder ------------------------------------------------------------

/**
 * The three-valued host contract, applied to one finished invocation.
 *
 * Exit 0: parse stdout. Exit 2: parse stderr, which is *either* a document or
 * argparse prose. Anything else -- including a death by signal -- is rondo's
 * own defect (D-0015 rule 3).
 *
 * **Where the hard cases land, and why the line is drawn there.** A document
 * that parses and carries a `schema` rondo does not decode -- an unknown
 * version, or another verb's -- is a **protocol refusal**: the seam answered in
 * a shape rondo was not built against, which is exactly what the `/1`
 * discriminator exists to let a host notice, and what rondo does about it is
 * re-pin or learn the new shape.
 *
 * A document that carries the *right* schema and will not read is a **rondo
 * defect** instead, and that is deliberate. rondo verified this build's
 * revision against a committed sha before driving it, so a `continuo.<verb>/1`
 * document from that exact build whose known fields are the wrong type is not
 * an upstream surprise -- it is rondo's model of a build it pinned being wrong.
 * Filing it as a protocol refusal would blunt the one signal the pin exists to
 * make loud. An exit 0 with nothing to parse at all lands here too, for the
 * plainer reason that a process which answered success and said nothing did not
 * disagree about a protocol, it failed.
 */
export function decode<T>(contract: VerbContract<T>, output: InvocationOutput): ContinuoResult<T> {
  if (output.signal !== null) {
    return {
      kind: "invokerDefect",
      reason: `continuo ${verbName(contract)} was killed by signal ${output.signal}`,
    };
  }
  if (output.status === 0) {
    return decodeSuccess(contract, output.stdout);
  }
  if (output.status === 2) {
    return decodeRefusal(contract, output.stderr);
  }
  return {
    kind: "invokerDefect",
    reason:
      `continuo ${verbName(contract)} exited ${describeStatus(output.status)}, which is ` +
      "neither the success nor the refusal the host contract defines. rondo called it wrong, " +
      `or the process failed. stderr: ${output.stderr.trim()}`,
  };
}

/**
 * An exit status in words.
 *
 * `null` with no signal is the case this exists for: it is not supposed to
 * happen, `String(null)` in the middle of a sentence reads as a typo, and the
 * one thing an operator needs to be told is that the process ended without
 * saying how.
 */
function describeStatus(status: number | null): string {
  return status === null ? "with no status and no signal" : String(status);
}

/**
 * `measure report`, special-cased by name.
 *
 * A separate entry point rather than a flag on {@link decode}, so that the
 * envelope reader never has to hold an "unless this verb" branch: the one verb
 * that is outside the envelope is the one verb with its own function.
 *
 * **It is outside the envelope on *every* path, not only on success**, and that
 * is read off continuo's `src/measurement/cli.ts` at the pinned revision rather
 * than assumed: the module mounts `--json` and never calls the envelope's
 * `successLine` or `refusalLine` at all, because there `--json` is only another
 * spelling of `--format json`. So an exit 2 here is argparse prose, full stop.
 * An earlier draft of this module invented a `continuo.measure.report/1` schema
 * for the refusal path; no such document exists, and a decoder that named it
 * would have asserted an upstream contract rondo made up.
 */
export function decodeMeasureReport(output: InvocationOutput): ContinuoResult<MeasureReport> {
  if (output.signal !== null) {
    return {
      kind: "invokerDefect",
      reason: `continuo measure report was killed by signal ${output.signal}`,
    };
  }
  if (output.status === 2) {
    return { kind: "refusedInProse", text: output.stderr.trim() };
  }
  if (output.status !== 0) {
    return {
      kind: "invokerDefect",
      reason:
        `continuo measure report exited ${describeStatus(output.status)}, which is neither ` +
        `the success nor the refusal the host contract defines. stderr: ${output.stderr.trim()}`,
    };
  }
  const document = parsed(output.stdout);
  if (document === null) {
    return {
      kind: "invokerDefect",
      reason: "continuo measure report exited 0 and stdout held no JSON document",
    };
  }
  try {
    return {
      kind: "answered",
      // No envelope, so no `db`: the report's own header carries the path, and
      // an empty string here would be rondo inventing a field continuo did not
      // send. The unwrapped verb is the reason this field is nullable at all.
      db: null,
      payload: { reportKind: requireString(document, "report_kind") },
    };
  } catch (error) {
    return unreadable("measure report", "the unwrapped report", error);
  }
}

function decodeSuccess<T>(contract: VerbContract<T>, stdout: string): ContinuoResult<T> {
  const document = parsed(stdout);
  if (document === null) {
    return {
      kind: "invokerDefect",
      reason:
        `continuo ${verbName(contract)} exited 0 and stdout held no JSON document. ` +
        `stdout: ${stdout.trim()}`,
    };
  }
  const wrongSchema = schemaMismatch(contract, document);
  if (wrongSchema !== null) {
    return wrongSchema;
  }
  try {
    if (requireBoolean(document, "ok") !== true) {
      throw new PayloadMismatch("'ok' is false on a document that arrived with exit 0");
    }
    return {
      kind: "answered",
      db: requireString(document, "db"),
      payload: contract.read(document),
    };
  } catch (error) {
    return unreadable(verbName(contract), `a '${contract.schema}' success document`, error);
  }
}

function decodeRefusal<T>(contract: VerbContract<T>, stderr: string): ContinuoResult<T> {
  const document = parsed(stderr);
  if (document === null) {
    // Not a document, and that is an ordinary answer rather than a fault: a
    // parser-level refusal is prose by design (D-0015 rule 3). rondo surfaces
    // continuo's own words and adds no diagnosis of its own.
    return { kind: "refusedInProse", text: stderr.trim() };
  }
  const wrongSchema = schemaMismatch(contract, document);
  if (wrongSchema !== null) {
    return wrongSchema;
  }
  try {
    if (requireBoolean(document, "ok") !== false) {
      throw new PayloadMismatch("'ok' is true on a document that arrived with exit 2");
    }
    const error = requireObject(document, "error");
    return {
      kind: "refused",
      db: requireString(document, "db"),
      errorClass: requireString(error, "class"),
      message: requireString(error, "message"),
    };
  } catch (error) {
    return unreadable(verbName(contract), `a '${contract.schema}' refusal document`, error);
  }
}

/**
 * The discriminator check, run before anything else is read.
 *
 * Returns null when the schema is the expected one, and the refusal itself when
 * it is not -- including when the key is absent or is not a string, because
 * "this document does not say what it is" and "this document says it is
 * something else" are the same answer: rondo does not proceed.
 */
function schemaMismatch<T>(
  contract: VerbContract<T>,
  document: JsonObject,
): ContinuoResult<T> | null {
  const schema = fieldValue(document, "schema");
  if (schema === contract.schema) {
    return null;
  }
  if (typeof schema !== "string") {
    return {
      kind: "protocolRefusal",
      reason:
        `continuo ${verbName(contract)} answered with a document carrying no 'schema' ` +
        `string, so rondo cannot tell what shape it is. ${contract.schema} was expected.`,
    };
  }
  return {
    kind: "protocolRefusal",
    reason:
      `continuo ${verbName(contract)} answered in schema '${schema}', and rondo decodes ` +
      `'${contract.schema}'. A schema rondo does not recognise is a refusal to proceed, ` +
      "not a document to coerce: re-pin continuo, or teach rondo the new shape.",
  };
}

/**
 * A document rondo recognised and could not read, reported as rondo's defect.
 *
 * The schema matched, so this is not the seam having moved out from under a
 * pin rondo can re-take -- it is rondo's model of the build it pinned being
 * wrong, and the person who can fix it is a rondo author. The failing field is
 * named, because "could not read it" without a field is a bug report nobody can
 * act on.
 */
function unreadable<T>(verb: string, what: string, error: unknown): ContinuoResult<T> {
  const detail = error instanceof PayloadMismatch ? error.message : String(error);
  return {
    kind: "invokerDefect",
    reason: `continuo ${verb} answered with ${what} that rondo could not read: ${detail}.`,
  };
}

/**
 * One JSON object out of a stream, or null when there is not one.
 *
 * Null covers every way this can fail to be a document -- empty output,
 * argparse prose, a JSON array, a bare string -- because the callers all want
 * the same answer to all of them, and the difference between "not JSON" and
 * "JSON but not an object" is not one an operator can act on.
 */
function parsed(stream: string): JsonObject | null {
  const text = stream.trim();
  if (text === "") {
    return null;
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  return isJsonObject(value as JsonValue) ? (value as JsonObject) : null;
}

/** The verb as it is spelled on a command line, for a message. */
function verbName<T>(contract: VerbContract<T>): string {
  return contract.command.join(" ");
}
