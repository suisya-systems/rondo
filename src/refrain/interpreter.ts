/**
 * The conductor's effectful half: the one asynchronous module in `src/refrain/`.
 *
 * D-0019 rule 8 splits the loop in two, and this is the half that acts.
 * `./loop.ts` decides -- totally, purely, and testably by handing it a record --
 * and this module executes what it decided. It **holds no state of its own**:
 * every fact it works from arrives either on the `IterationRecord` it read or
 * through the `ConductorPorts` it was handed, so two calls a week apart across a
 * process restart behave the same as two calls in a row, and there is no
 * in-memory continuation for a crash to lose.
 *
 * **It imports no external module**, which is the property D-0019 rule 1 buys
 * with the ports: the effects that own a capability -- a process, a database, a
 * clock -- arrive as parameters, so `test/refrain/` needs no continuo build, no
 * `spawn`, no network and no filesystem. `src/refrain -> src/continuo` stays
 * refused and a planted case in `test/architecture/import-boundaries.test.ts`
 * proves it.
 *
 * **Three rules run through every branch below, and they are the design.**
 *
 *  - **Nothing is sent until the row that will explain it is committed**
 *    (D-0019 rule 10's write order). The observed continuo revision and the run
 *    id reach the store *before* `run admit` is spawned, so a crash in between
 *    leaves a row naming the build and the run rather than a run continuo knows
 *    about and rondo does not.
 *  - **An answer releases the single-flight lock and a silence keeps it.** Under
 *    the partial unique index every non-terminal status is a lock on the whole
 *    conductor, so this is not a stylistic preference: an effect that answered
 *    -- even to refuse -- is an effect whose child is over, and an effect that
 *    answered nothing may still have one running, because rondo's own ceiling
 *    kills the CLI and not the fenced child (D-0019 rule 12). Releasing the lock
 *    on a silence would let a second lap race an orphan, which is the one
 *    outcome this whole design exists to make impossible.
 *  - **Anything that cannot be classified goes to `stalled`, never to
 *    `awaiting_human`.** A status the union does not cover, a plan payload that
 *    will not read back, an effect result in a shape the union does not cover:
 *    all of them halt and ask. `awaiting_human` promises an open gate for
 *    `resume()` to observe, and filing a row there that has no gate is a
 *    non-terminal state with no event able to end it.
 *
 * **On the text this module produces.** rondo's own words in every report line
 * are ASCII (D-0004). A message relayed from continuo or from cadenza is passed
 * through *unedited* -- D-0015 rule 7: relaying prose is not parsing it -- and
 * escaping it to ASCII before it reaches a terminal is the printer's job at the
 * access point, not this module's. Escaping is transport; this module is
 * meaning.
 */
import type {
  IterationFields,
  IterationRecord,
  IterationStatus,
  LapReadingDraft,
} from "../store/records.js";
import { isTerminal } from "../store/records.js";
import { allocate } from "./allocator.js";
import { nextStep, type Step } from "./loop.js";
import {
  type AdmittedPlan,
  admittedPlan,
  planPayload,
  type RunPlan,
  readPlan,
  runPlan,
} from "./plan.js";
import type { LoopPolicy } from "./policy.js";
import type {
  BoundName,
  ClassificationRecord,
  ConductorPorts,
  EffectOutcome,
  GateObservation,
} from "./ports.js";

/**
 * What one call of the conductor did, in a form an operating surface can render
 * without knowing anything about the state machine.
 *
 * Three fields, and each answers a question a caller actually has:
 *
 *  - **`iterationId`** is the row this call was about, or `null` when no row
 *    exists to be about -- a policy stop, or a reservation the single-flight
 *    invariant refused. Those two are the only ways a call ends with nothing
 *    reserved, and the distinction matters because a caller that got an id can
 *    call {@link resume} or {@link abandon} on it and a caller that did not
 *    cannot.
 *  - **`status`** is the status the iteration ended *this call* in, not the
 *    status it will end its life in: a suspended iteration reports
 *    `awaiting_human` and is not finished. `null` accompanies a `null` id.
 *  - **`lines`** is what to show a person, in order. Human-readable rather than
 *    machine-readable on purpose: a surface that wanted to branch on what
 *    happened should branch on `status`, and a second machine-readable
 *    vocabulary of outcome codes would be a third spelling of the state machine
 *    beside `IterationStatus` and `Step`.
 *
 * A richer union -- one variant per ending -- was the rejected alternative. It
 * would put a third closed vocabulary in the tree that has to be kept in step
 * with the other two, and every consumer of it would end up switching on
 * `status` anyway.
 */
export interface ConductorReport {
  readonly iterationId: string | null;
  readonly status: IterationStatus | null;
  readonly lines: readonly string[];
}

/**
 * A bound on how many committed transitions one call may take.
 *
 * The lap-1 arc is a directed acyclic graph of eight edges and its longest path
 * -- `planned` to `awaiting_human` -- is five, so a correct machine cannot reach
 * this number. It exists because a driver that *could* spin is one restart away
 * from spinning forever on a row nobody is watching, and because the failure
 * that would produce it (an edge that returns to a status it just left) is
 * exactly the kind a `switch` cannot rule out. Reaching it is a rondo defect and
 * is filed as one.
 */
const MAX_TRANSITIONS = 12;

/**
 * Admit one request: read the policy, take the lock, and drive the arc until it
 * suspends or ends.
 *
 * **The policy is read first, through `nextStep(null, policy)`, and it is read
 * exactly once** (D-0019 rule 9). `ask_human` there means the request is refused
 * *before a row exists*: no reservation, no lock, and an immediate answer naming
 * the policy that produced it. A conductor that reserved first and asked second
 * would hold the single-flight lock on an iteration whose only exit is a human,
 * for a policy stop -- an ordinary configured outcome, not an incident.
 *
 * **`id` is the caller's and is now the *only* identifier that is** (D-0023).
 * rondo has an allocator, and the run id, the topic branch and the workspace
 * are derived from this one value rather than typed beside it -- so this
 * argument reaches three command lines it never reached before, and it is
 * checked against a closed alphabet here, before `reserve()`, for the reason
 * every other refusal in this function is placed where it is: a value refused
 * before the row costs no row and no lock.
 *
 * Returns when the machine reaches a state that suspends (`awaiting_human`, and
 * the process may then exit) or that is terminal. It never waits on a human.
 */
/**
 * The bound, in the words a person refused by it needs.
 *
 * Two sentences rather than the field name, because `maxOccupying` and
 * `maxLive` are the operator's vocabulary and the person hitting the bound may
 * be neither: what they need to know is *which* thing there is too much of, and
 * the two are genuinely different things -- work in flight, and questions left
 * open.
 */
function describeBound(bound: BoundName): string {
  return bound === "maxOccupying"
    ? "iterations are already executing on this host"
    : "iterations are already open on this host, counting those suspended at a gate";
}

export async function admit(
  ports: ConductorPorts,
  plan: RunPlan,
  policy: LoopPolicy,
  id: string,
): Promise<ConductorReport> {
  const lines: string[] = [];
  const admission = nextStep(null, policy);
  if (admission.kind !== "reserve") {
    // `nextStep(null, ...)` answers `reserve` or `ask_human` and nothing else,
    // so this covers the policy stop and, in the same breath, any later variant
    // that starts being returned there. Both are "no row was written", which is
    // the only fact a caller needs from this branch.
    lines.push(
      `The policy refused this request before an iteration was reserved: ${describeStep(admission)}.`,
      "No row was written and no lock was taken, so nothing has to be settled by a person.",
    );
    return { iterationId: null, status: null, lines: Object.freeze(lines) };
  }

  // **Validated before the lock, not after it.** `RunPlan` is a structural
  // interface, so a caller can hand over an object literal that never passed
  // through `runPlan()`, and `Object.freeze` is shallow, so a nested field can
  // move after it did. Either way the first check would otherwise be `planOf`'s
  // re-read *after* the row is committed -- and the iteration would then stall
  // holding the single-flight lock until a person abandoned it, for an input
  // error that was knowable before any row existed. This is the same argument
  // the policy stop above makes, applied to the other thing a caller can get
  // wrong: refused before reservation it costs nothing, no row and no lock.
  const validated = runPlan(plan);
  if (validated.kind === "refused") {
    lines.push(
      `The plan was refused before an iteration was reserved: ${validated.reason}`,
      "No row was written and no lock was taken, so nothing has to be settled by a person.",
    );
    return { iterationId: null, status: null, lines: Object.freeze(lines) };
  }

  // **Allocated before the lock and refused before it too** (D-0023 rules 3
  // and 26). The derivation is pure, so this costs no I/O; what it buys is that
  // an iteration id which cannot produce a contained, injective, git-legal
  // triple is refused here rather than inside `lap perform`, after continuo's
  // run row exists for ever.
  const allocation = allocate(id, validated.plan.workspaceRoot);
  if (allocation.kind === "refused") {
    lines.push(
      `The iteration id was refused before an iteration was reserved: ${allocation.reason}`,
      "No row was written and no lock was taken, so nothing has to be settled by a person.",
    );
    return { iterationId: null, status: null, lines: Object.freeze(lines) };
  }

  const admitted = admittedPlan(validated.plan, allocation.allocation);
  if (admitted.kind === "refused") {
    lines.push(
      `The allocated identifiers were refused before an iteration was reserved: ${admitted.reason}`,
      "No row was written and no lock was taken, so nothing has to be settled by a person.",
    );
    return { iterationId: null, status: null, lines: Object.freeze(lines) };
  }

  const reservation = await ports.store.reserve({
    id,
    runId: admitted.plan.runId,
    topicBranch: admitted.plan.topicBranch,
    workspace: admitted.plan.workspace,
    // **The row's request text is the plan's own `prompt`, and there is no
    // second way to supply it.** This used to take a `request` argument beside
    // the plan, which meant the durable row could record what a person asked
    // for while `run admit` sent something else to continuo -- an audit record
    // describing different work from the work the worker did, with nothing in
    // the type system or the store able to notice. One source of truth beats a
    // check that both callers have to remember to satisfy.
    request: validated.plan.prompt,
    plan: planPayload(admitted.plan),
    nowMs: ports.now(),
  });
  switch (reservation.kind) {
    case "atCapacity":
      // D-0023's capacity refusal, as an ordinary answer rather than a fault: a
      // host already at its bound says so, and says which bound and how full it
      // was, because those are the two facts a person needs in order to decide
      // between waiting and raising a number.
      //
      // **The occupancy may read higher than the bound, and the wording must
      // survive that without looking like corruption** (D-0023 rule 27). The
      // bound is an admission control and not a conservation law: `stall()`
      // writes `stalled` from any status, and `resume()` reaches it from
      // `awaiting_human`, so a suspended row can re-enter the occupying set
      // without passing through a reservation.
      //
      // **And it does not drain on its own, which an earlier version of this
      // message got wrong.** The edge is per row, so every suspended iteration
      // can take it independently and the occupying set can reach `maxLive`
      // rather than the bound plus one. `RELEASED_BY` gives `stalled` exactly
      // one releasing event -- an operator's `abandon()` -- so telling a person
      // to wait would be telling them to wait for something that cannot
      // happen. The excess is fail-closed, because nothing of a `stalled` row
      // is running, but it is the operator's to clear.
      lines.push(
        `Refused: ${String(reservation.occupancy)} of a permitted ` +
          `${String(reservation.limit)} ${describeBound(reservation.bound)}.`,
        reservation.occupancy > reservation.limit
          ? "That is more than the bound rather than equal to it, which is expected rather than " +
              "corrupt: an iteration already counted re-entered the set without a reservation, " +
              "which is what happens when a suspended iteration is stalled. Nothing of a " +
              "stalled iteration is running, but nothing ends one either: settle them with " +
              "abandon() before anything further can be admitted."
          : "Try again once one of them reaches a terminal status, settle one with abandon(), " +
              "or raise the bound if this host should be running more at once.",
      );
      return { iterationId: null, status: null, lines: Object.freeze(lines) };
    case "defect":
      lines.push(`The store could not reserve an iteration: ${reservation.reason}`);
      return { iterationId: null, status: null, lines: Object.freeze(lines) };
    case "reserved":
      lines.push(
        `Reserved iteration ${reservation.record.id} at 'planned', holding run id ` +
          `${admitted.plan.runId}, branch ${admitted.plan.topicBranch} and workspace ` +
          `${admitted.plan.workspace}.`,
      );
      return drive(ports, reservation.record, lines);
  }
}

/**
 * Look at one iteration again, from outside, after time has passed.
 *
 * This is D-0019 rule 5's entry point and it is deliberately **one** function
 * rather than two. At a gate it is the single `gate show` observation the design
 * allows: a non-null outcome transitions the iteration to `closed`, and a null
 * outcome -- which is exactly "the gate is still open" -- **changes nothing and
 * says so**. That is what makes it idempotent and safe to call from a surface
 * that cannot be sure whether it already called, and calling it twice after the
 * gate closed writes once, because the second call finds a `closed` row and
 * `nextStep` answers `report`.
 *
 * **It serves `withdrawal_requested` on the identical observation**, and it has
 * to: that state is defined by an ask rondo made to another surface, and if
 * nothing observed the result the ask would be a state with no way out. Nothing
 * here needs to know which of the two states it was called on -- which is
 * precisely why it is one entry point.
 *
 * It is also what a restart calls on a row it found. `nextStep` is what decides
 * whether that row may be acted on, so `planned`, `classified` and `admitted`
 * resume normally and `admitting` and `performing` **stop and report** with the
 * row untouched and the lock still held. That decision is not re-taken here;
 * driving the machine through `nextStep` is what keeps it in one place.
 *
 * **A row that will not decode stops this call.** `resume()` acts on a status,
 * and a row whose status cannot be read has none to act on; guessing one would
 * be writing a transition out of a state nobody established. So it reports and
 * stops, and the report names `abandon()`, which is the one call that can end
 * such a row -- see {@link abandon}.
 */
export async function resume(ports: ConductorPorts, iterationId: string): Promise<ConductorReport> {
  const lines: string[] = [];
  const found = await ports.store.read(iterationId);
  switch (found.kind) {
    case "absent":
      lines.push(`No iteration ${iterationId} exists, so there is nothing to resume.`);
      return { iterationId, status: null, lines: Object.freeze(lines) };
    case "unreadable":
      lines.push(...unreadableRowLines(found.id, found.reason, "resumed"));
      return { iterationId, status: null, lines: Object.freeze(lines) };
    case "read":
      return drive(ports, found.record, lines);
  }
}

/**
 * Ask for an open gate to be withdrawn: the abort edge that has a gate id.
 *
 * Reachable only from `awaiting_human`, because that is the only status that
 * carries the thing this ask names. D-0013 is the whole of the rest: rondo
 * **never writes the outcome** and drives none of the verbs -- `closeOpenGate`
 * hard-codes `actorKind: "human"`, which is why the verb lives on the operating
 * surface and not here. What this function does is record the ask on the row and
 * put it in the report; what closes the gate is a person.
 *
 * And a gate whose close has been *asked for* is not thereby closed. The
 * iteration stays non-terminal at `withdrawal_requested` and is released by the
 * same {@link resume} observation as any other gate, once the outcome is
 * actually there to be observed (`withdrawn`, or `subject_gone` if the operator
 * closed the run and continuo's reconciliation swept the gate).
 *
 * **A row that will not decode stops this call**, for the same reason it stops
 * {@link resume}: the ask names a gate, the gate id is on the row, and a row
 * that does not decode hands over no gate id to name. It reports and points at
 * {@link abandon}.
 */
export async function requestWithdrawal(
  ports: ConductorPorts,
  iterationId: string,
  reason: string,
): Promise<ConductorReport> {
  const lines: string[] = [];
  const found = await ports.store.read(iterationId);
  switch (found.kind) {
    case "absent":
      lines.push(`No iteration ${iterationId} exists, so there is no gate to ask about.`);
      return { iterationId, status: null, lines: Object.freeze(lines) };
    case "unreadable":
      lines.push(...unreadableRowLines(found.id, found.reason, "asked about"));
      return { iterationId, status: null, lines: Object.freeze(lines) };
    case "read":
      break;
  }
  const record = found.record;
  if (record.status === "withdrawal_requested") {
    lines.push(
      `Iteration ${record.id} has already asked for its gate to be withdrawn; nothing was written.`,
      ...outstandingAskLines(record.gateId),
    );
    return finish(record, lines);
  }
  if (record.status !== "awaiting_human") {
    // The ask names a gate, so a status that carries no gate id has nothing to
    // ask about. Sending it anyway would name a gate rondo does not hold.
    lines.push(
      `Iteration ${record.id} is at '${record.status}', and a withdrawal may only be asked for ` +
        "from 'awaiting_human', which is the one status that means a gate is open on this " +
        "iteration.",
      "Nothing was written. An iteration with no gate is settled with abandon().",
    );
    return finish(record, lines);
  }
  const gateId = record.gateId;
  if (gateId === null) {
    return stall(
      ports,
      lines,
      record,
      "the row is at 'awaiting_human' and carries no gate id, so rondo cannot name the gate " +
        "whose withdrawal it would be asking for",
    );
  }

  const committed = await commit(
    ports,
    lines,
    record,
    "withdrawal_requested",
    appendedReason(record, reason),
  );
  if (committed.kind === "blocked") {
    return committed.report;
  }
  lines.push(
    `Iteration ${committed.record.id} is asking for gate ${gateId} to be withdrawn: ${reason}`,
    ...outstandingAskLines(gateId),
  );
  return finish(committed.record, lines);
}

/**
 * The operator's escape hatch, and the last row of every path that cannot end
 * itself.
 *
 * Admitted from **every** non-terminal status, not only from the rows of
 * D-0019 rule 10's table that name it. The named rows are the design; this is
 * the floor, and it is what guarantees no status -- now or later -- can be added
 * to this machine with no way out at all. Under the partial unique index that
 * guarantee is not tidiness: a non-terminal state nobody can leave is a
 * conductor that never runs again.
 *
 * **It drives no continuo verb, and there is no verb here that is rondo's to
 * drive.** If a gate is open, closing it is D-0013's ask -- see
 * {@link requestWithdrawal}. If a run is open, closing it is D-0010's operator.
 * Abandoning is rondo recording, honestly and durably, that it no longer knows
 * what is happening, which is the only thing it can truthfully do about a lap
 * whose outcome it cannot establish.
 *
 * **It is the one function that must not fail on a row that will not decode**,
 * because those are exactly the rows that need it. `abandon()` is the last row
 * of D-0019 rule 11's table, and a row whose status cannot be read still holds
 * the single-flight lock: every status-asserting write refuses it, so if this
 * call refused it too the conductor would never run again. So when `read`
 * answers `unreadable` this call goes to `store.settle`, the status-blind
 * termination by id alone -- the one place that licence is used, and the reason
 * it exists.
 */
export async function abandon(
  ports: ConductorPorts,
  iterationId: string,
  reason: string,
): Promise<ConductorReport> {
  const lines: string[] = [];
  const found = await ports.store.read(iterationId);
  switch (found.kind) {
    case "absent":
      lines.push(`No iteration ${iterationId} exists, so there is nothing to abandon.`);
      return { iterationId, status: null, lines: Object.freeze(lines) };
    case "unreadable":
      return settleUnreadable(ports, lines, found.id, found.reason, reason);
    case "read":
      break;
  }
  const record = found.record;
  if (beingDriven.has(record.id)) {
    // See {@link beingDriven}. Refused rather than queued: there is nothing to
    // wait for that would make the answer different, and the caller needs to
    // know now that the row was not settled.
    lines.push(
      `Iteration ${record.id} is being driven by this process right now, so it was not ` +
        "abandoned.",
      "Abandoning it here would release the single-flight lock while an invocation of rondo's " +
        "own is still awaiting an answer, which would let a second iteration be reserved against " +
        "a worker that is still running.",
      "Wait for the call in flight to return -- it suspends at the gate or reports -- and then " +
        "abandon the row if its outcome still cannot be established.",
    );
    return finish(record, lines);
  }
  if (isTerminal(record.status)) {
    lines.push(
      `Iteration ${record.id} is already terminal at '${record.status}'; nothing was written.`,
    );
    return finish(record, lines);
  }

  const previous = record.status;
  const committed = await commit(ports, lines, record, "abandoned", appendedReason(record, reason));
  if (committed.kind === "blocked") {
    return committed.report;
  }
  lines.push(
    `Iteration ${committed.record.id} was abandoned from '${previous}': ${reason}`,
    "'abandoned' is terminal and is not a failure: it records that rondo no longer claims to " +
      "know this iteration's outcome. The single-flight lock is released.",
    "No continuo verb was driven by this, because none of them is rondo's to drive here.",
  );
  if (committed.record.gateId !== null) {
    lines.push(
      `A gate may still be open: ${committed.record.gateId}. Closing it is a person's, through ` +
        "'gate close' on the operating surface (D-0013).",
    );
  }
  // **Guarded on `identifiersSpent` rather than on the run id, and D-0023 is
  // why.** Before it, the run id was written by the transition into
  // `admitting`, so "the row names a run" and "a run was admitted" were the
  // same fact. The allocator now writes the run id at `reserve()`, so every row
  // names one from `planned` onward and this warning would fire for an
  // iteration that spawned nothing -- telling an operator to go and close a run
  // continuo has never heard of. `identifiersSpent` is the bit that still means
  // what `runId` used to.
  if (committed.record.identifiersSpent !== 0) {
    lines.push(
      `A run may still be open under id ${committed.record.runId ?? "(unrecorded)"}. Closing it ` +
        "is the operator's (D-0010), and 'gate list' is how a person finds out whether a gate " +
        "exists for it.",
    );
  }
  return finish(committed.record, lines);
}

/**
 * End a row that will not decode, by id alone.
 *
 * The only call of `store.settle` in this tree, and it may stay that way: the
 * store's own doc comment states the licence as narrow and single-purpose, and
 * what makes it narrow is that exactly one branch of one function reaches it.
 * Every other write in this module asserts the status it is leaving, which is
 * the closed edge relation and the safety property -- but this row has no
 * readable status to assert, and refusing to write it is what leaves the
 * conductor with no path forward at all.
 *
 * Why the row did not decode is recorded beside the operator's reason: the
 * status-blind write is the unusual one, and a person reading the settled row
 * afterwards should be able to see why it was used.
 */
async function settleUnreadable(
  ports: ConductorPorts,
  lines: string[],
  id: string,
  decodeReason: string,
  reason: string,
): Promise<ConductorReport> {
  lines.push(`Iteration ${id} exists but will not decode: ${decodeReason}`);
  const outcome = await ports.store.settle(
    id,
    `${reason}; the row did not decode: ${decodeReason}`,
    ports.now(),
  );
  switch (outcome.kind) {
    case "settled":
      lines.push(
        `Iteration ${id} was settled at 'abandoned' by id alone, without decoding it: ${reason}`,
        "That write asserted no previous status, because a row whose status cannot be read has " +
          "none to assert. It is the one place rondo writes that way, and abandon() is the one " +
          "call that reaches it.",
        "'abandoned' is terminal, so the single-flight lock is released and a new iteration can " +
          "be reserved.",
        "rondo cannot say whether a run or a gate is open under this iteration, because the row " +
          "did not decode. 'gate list' and continuo's own run listing are how a person finds out, " +
          "and closing either is theirs (D-0010, D-0013).",
      );
      return { iterationId: id, status: "abandoned", lines: Object.freeze(lines) };
    case "missing":
      lines.push(
        `Iteration ${id} no longer exists in the store, so there was nothing left to settle.`,
      );
      return { iterationId: id, status: null, lines: Object.freeze(lines) };
    case "defect":
      lines.push(
        `Stopped: the store could not settle iteration ${id}: ${outcome.reason}`,
        "The row is unchanged and still holds the single-flight lock, and this is the last call " +
          "that could have released it, so a person has to look at the database itself.",
      );
      return { iterationId: id, status: null, lines: Object.freeze(lines) };
  }
}

// --- the driver -------------------------------------------------------------

/**
 * Take committed transitions until the machine reaches a state that suspends or
 * ends.
 *
 * `nextStep` is asked at every turn rather than the arc being written out here,
 * so there is exactly one place that decides what follows what. The policy is
 * not passed: D-0019 rule 9 gives it one reader, at admission, and `nextStep`
 * does not consult it for a record that exists.
 */
/**
 * The iterations this **process** is driving right now.
 *
 * The one piece of process-local state in the module, and the exception is
 * narrow enough to state exactly: it is a fact about *this process*, not about
 * the iteration, so it is not a conductor state, is not persisted, and
 * deliberately does not survive a restart.
 *
 * It exists because {@link abandon} is otherwise unsafe against a lap that is
 * still being awaited here. D-0019 rule 11 gives `abandon()` to a `performing`
 * row **with no answer** -- a row a restart found, or one whose invocation gave
 * up -- and in that case releasing the single-flight lock is the operator's
 * assertion that nothing of theirs is running. But an operator calling
 * `abandon()` while `performLap` is still awaited *in this process* is asserting
 * something rondo can see is false: the row would go terminal at once, a second
 * iteration could be reserved against a worker that is still writing to the same
 * worktree, and the later `performing -> awaiting_human` write would find
 * `unexpectedStatus` with no way to put the lock back.
 *
 * After a restart the set is empty, which is exactly right: that is when the row
 * really is a `performing` row with no answer, and `abandon()` must work.
 */
const beingDriven = new Set<string>();

async function drive(
  ports: ConductorPorts,
  from: IterationRecord,
  lines: string[],
): Promise<ConductorReport> {
  beingDriven.add(from.id);
  try {
    return await driveSteps(ports, from, lines);
  } finally {
    // `finally`, so a rejection anywhere below cannot leave an iteration marked
    // as driven forever -- which would turn a transient fault into the same
    // wedged conductor this guard exists to prevent, only harder to see.
    beingDriven.delete(from.id);
  }
}

async function driveSteps(
  ports: ConductorPorts,
  from: IterationRecord,
  lines: string[],
): Promise<ConductorReport> {
  let record = from;
  for (let taken = 0; taken < MAX_TRANSITIONS; taken += 1) {
    const result = await takeStep(ports, nextStep(record), record, lines);
    if (result.kind === "finished") {
      return result.report;
    }
    record = result.record;
  }
  // Unreachable for a machine whose edges all move forward; see MAX_TRANSITIONS.
  return stall(
    ports,
    lines,
    record,
    `the interpreter took ${String(MAX_TRANSITIONS)} transitions without reaching a state that ` +
      "suspends or ends, which is a rondo defect rather than anything about this request",
  );
}

/** A step either moved the row on, or the call is over. */
type StepResult =
  | { readonly kind: "advanced"; readonly record: IterationRecord }
  | { readonly kind: "finished"; readonly report: ConductorReport };

/**
 * Execute one planned step.
 *
 * The `switch` is exhaustive over `Step`, which under D-0002's strictness makes
 * a variant added to the union and not handled here a compile error rather than
 * a runtime surprise.
 */
async function takeStep(
  ports: ConductorPorts,
  step: Step,
  record: IterationRecord,
  lines: string[],
): Promise<StepResult> {
  switch (step.kind) {
    case "classify":
      return classifyStep(ports, record, lines);
    case "admit":
      return admitStep(ports, record, lines);
    case "perform":
      return performStep(ports, record, lines);
    case "observe_gate":
      return observeStep(ports, record, lines);
    case "report":
      lines.push(...closedReportLines(record));
      return { kind: "finished", report: finish(record, lines) };
    case "rest":
      lines.push(
        `Iteration ${record.id} is terminal at '${record.status}' and there is nothing further ` +
          "to do.",
        ...(record.reason === null ? [] : [`Recorded reason: ${record.reason}`]),
      );
      return { kind: "finished", report: finish(record, lines) };
    case "ask_human":
      return { kind: "finished", report: await askHumanStep(ports, record, lines) };
    case "reserve":
      // `reserve` is the answer to "no iteration exists", and one does. Reaching
      // it here means `nextStep` and this driver disagree about what a record
      // is, which is a rondo defect and not a fact about the request.
      return {
        kind: "finished",
        report: await stall(
          ports,
          lines,
          record,
          "the planner asked for a reservation on an iteration that already exists, which is a " +
            "rondo defect",
        ),
      };
  }
}

/**
 * `ask_human` covers two different things, and only one of them is a defect.
 *
 * `admitting`, `performing` and `stalled` are the design's own "stop and report,
 * the row keeps the lock" states, and a restart that finds one must **not act**:
 * `run admit` refuses a duplicate run id and relying on that refusal to discover
 * what happened is guessing with a mutating verb, and `lap perform` cannot be
 * re-entered on an admitted run while a fenced child may still be alive with
 * nobody polling it. Anything else reaching `ask_human` is a status this
 * interpreter does not recognise, and that is what `stalled` is for.
 */
async function askHumanStep(
  ports: ConductorPorts,
  record: IterationRecord,
  lines: string[],
): Promise<ConductorReport> {
  switch (record.status) {
    case "admitting":
    case "performing":
    case "stalled":
      lines.push(
        `Iteration ${record.id} is at '${record.status}' and a person has to settle it. Nothing ` +
          "was written and no continuo verb was driven.",
        ...(record.reason === null ? [] : [`Recorded reason: ${record.reason}`]),
        ...heldLockLines(record),
      );
      return finish(record, lines);
    default:
      return stall(
        ports,
        lines,
        record,
        `the row's status is '${record.status}', which this interpreter does not recognise; it ` +
          "was read out of a database rondo does not have exclusive authorship of",
      );
  }
}

// --- the four effect steps --------------------------------------------------

/**
 * `planned` -> cadenza's answer.
 *
 * `allowed` moves to `classified` with the three digests, the outcome and the
 * neutral role name. **`refused` and `needs_approval` both end the iteration at
 * terminal `abandoned`**, with cadenza's own reason (D-0019 rule 15). Neither
 * reaches `awaiting_human`, and that is not a preference: there is no gate for
 * `resume()` to observe, and the status is non-terminal, so the first askable
 * request would hold the single-flight lock with no event able to release it.
 *
 * `needs_approval` is a dead end in lap 1 and the report says so plainly.
 * Resuming one requires a widening successor contract, which rondo may not
 * compose (D-0009, D-0018 rule 7 -- `delegate` and `adopt` are not imported at
 * all), so asking again is a new iteration.
 */
async function classifyStep(
  ports: ConductorPorts,
  record: IterationRecord,
  lines: string[],
): Promise<StepResult> {
  const plan = await planOf(ports, record, lines);
  if (plan.kind === "unreadable") {
    return { kind: "finished", report: plan.report };
  }
  const outcome = await ports.classify(plan.plan);
  switch (outcome.kind) {
    case "answered":
      return classifiedBy(ports, record, lines, outcome.value);
    case "refused":
      // cadenza refused the *inputs* -- an unknown project, an agent-type input
      // it will not build a record from. The request ends correctly without a
      // run and nothing was spawned, so this is `abandoned` rather than
      // `failed`: filing a working refusal as a defect is the thing
      // `records.ts` says `abandoned` exists to avoid.
      return terminal(
        ports,
        record,
        lines,
        "abandoned",
        { reason: outcome.message },
        `cadenza refused before any classification could be made: ${outcome.message}`,
      );
    case "defect":
      // rondo's own fault, and nothing external happened: no run, no child, no
      // gate. Terminal `failed` releases the lock, which is safe here precisely
      // because there is nothing that could still be running. `stalled` was the
      // rejected alternative -- it would hold the lock over a situation that is
      // fully understood.
      return terminal(
        ports,
        record,
        lines,
        "failed",
        { reason: outcome.reason },
        `Classification hit a rondo defect and nothing was sent to continuo: ${outcome.reason}`,
      );
    case "noAnswer":
      // Nothing came back. An answer releases the lock and a silence keeps it,
      // uniformly, and this is the first place that rule bites: the interpreter
      // does not get to assume that a port which answered nothing left nothing
      // behind.
      return {
        kind: "finished",
        report: await stall(
          ports,
          lines,
          record,
          `classification answered nothing: ${outcome.reason}`,
        ),
      };
    default:
      return {
        kind: "finished",
        report: await stall(ports, lines, record, unhandledOutcome(outcome)),
      };
  }
}

/** The three digests and the verdict, committed, and the arc's first fork. */
async function classifiedBy(
  ports: ConductorPorts,
  record: IterationRecord,
  lines: string[],
  answer: ClassificationRecord,
): Promise<StepResult> {
  const digests: IterationFields = {
    agentTypeDigest: answer.agentTypeDigest,
    configDigest: answer.configDigest,
    contractDigest: answer.contractDigest,
    classification: answer.outcome,
    classificationReason: answer.reason,
    neutralRoleName: answer.neutralRoleName,
    modelTier: answer.modelTier,
  };
  switch (answer.outcome) {
    case "allowed": {
      const committed = await commit(ports, lines, record, "classified", digests);
      if (committed.kind === "blocked") {
        return { kind: "finished", report: committed.report };
      }
      lines.push(`cadenza allowed the action (${answer.reason}); the three digests are committed.`);
      return { kind: "advanced", record: committed.record };
    }
    case "refused":
      return terminal(
        ports,
        record,
        lines,
        "abandoned",
        { ...digests, reason: answer.reason },
        `cadenza refused the action (${answer.reason}). The request ends here without a run, ` +
          "which is what 'abandoned' means; it is not a failure.",
      );
    case "needs_approval":
      return terminal(
        ports,
        record,
        lines,
        "abandoned",
        { ...digests, reason: answer.reason },
        `cadenza answered needs_approval (${answer.reason}). In lap 1 that is a dead end: ` +
          "resuming one needs a widening successor contract, which rondo may never compose " +
          "(D-0009). Asking again is a new iteration.",
      );
    default:
      // cadenza's outcome vocabulary is three values; a fourth is a shape this
      // interpreter cannot classify, so it halts and asks rather than guessing
      // which of the three it most resembles.
      return {
        kind: "finished",
        report: await stall(
          ports,
          lines,
          record,
          `the classifier answered with outcome '${answer.outcome}', which is not one of ` +
            "cadenza's three",
        ),
      };
  }
}

/**
 * `classified` -> a verified build, a committed provenance row, and an admitted
 * run.
 *
 * Two effects and one commit between them, and the order is D-0019 rule 10's:
 * the revision `startContinuo` **observed** and the run id from the plan are
 * committed at `admitting` **before** `run admit` is spawned. A crash between
 * the two therefore leaves a row naming the build and the run, which is the
 * thing that makes recovery possible at all. The reverse order would leave a run
 * continuo knows about and rondo does not.
 */
async function admitStep(
  ports: ConductorPorts,
  record: IterationRecord,
  lines: string[],
): Promise<StepResult> {
  const plan = await planOf(ports, record, lines);
  if (plan.kind === "unreadable") {
    return { kind: "finished", report: plan.report };
  }
  const neutralRoleName = record.neutralRoleName;
  if (neutralRoleName === null) {
    return {
      kind: "finished",
      report: await stall(
        ports,
        lines,
        record,
        "the row is at 'classified' and carries no neutral role name, so there is nothing for " +
          "the continuo layer to map onto a roster name (D-0019 rule 13)",
      ),
    };
  }

  const started = await ports.startContinuo();
  switch (started.kind) {
    case "answered":
      break;
    case "refused":
    case "defect":
      // Nothing was spawned that admits anything, so nothing can be running and
      // terminal `failed` is safe. Leaving the row at `classified` would wedge
      // the conductor on a build problem a person can only see by reading it.
      return terminal(
        ports,
        record,
        lines,
        "failed",
        { reason: messageOf(started) },
        `The continuo build could not be verified, and no run was admitted: ${messageOf(started)}`,
      );
    case "noAnswer":
      return {
        kind: "finished",
        report: await stall(
          ports,
          lines,
          record,
          `verifying the continuo build answered nothing: ${started.reason}`,
        ),
      };
    default:
      return {
        kind: "finished",
        report: await stall(ports, lines, record, unhandledOutcome(started)),
      };
  }

  const admitting = await commit(ports, lines, record, "admitting", {
    continuoRevision: started.value.revision,
    // **The one transition that spends the identifiers** (D-0023 rule 7). Set
    // here and nowhere else, because this is the edge after which continuo owns
    // a run under that id, git owns the branch and the filesystem owns the
    // worktree -- so the three names are spent, and the row goes on holding
    // them for ever, including after it reaches a terminal status.
    //
    // Committed *before* `run admit` is spawned, which is D-0019 rule 10's
    // write order applied to the claim as well as to the run id: a crash
    // between this commit and the spawn must leave the names held, because the
    // spawn may nonetheless have happened.
    //
    // The run id itself is no longer written here. It was put on the row by
    // `reserve()`, inside the transaction that took the capacity, and
    // `IterationFields` now makes writing it again a type error.
    identifiersSpent: 1,
  });
  if (admitting.kind === "blocked") {
    return { kind: "finished", report: admitting.report };
  }
  lines.push(
    `continuo build verified at revision ${started.value.revision}; run id ` +
      `${plan.plan.runId} and that revision are committed before anything is spawned.`,
  );

  const admitted = await ports.admitRun(plan.plan, neutralRoleName);
  switch (admitted.kind) {
    case "answered": {
      if (admitted.value.runId !== plan.plan.runId) {
        return {
          kind: "finished",
          report: await stall(
            ports,
            lines,
            admitting.record,
            `continuo admitted run '${admitted.value.runId}' where the plan named ` +
              `'${plan.plan.runId}', so rondo's row and continuo's would describe different runs`,
          ),
        };
      }
      const next = await commit(ports, lines, admitting.record, "admitted", {
        continuoRole: admitted.value.continuoRole,
      });
      if (next.kind === "blocked") {
        return { kind: "finished", report: next.report };
      }
      lines.push(
        `continuo admitted run ${admitted.value.runId} at status '${admitted.value.status}' ` +
          `under role '${admitted.value.continuoRole}' (neutral name '${neutralRoleName}').`,
      );
      return { kind: "advanced", record: next.record };
    }
    case "refused":
    case "defect":
      // An answer arrived, so the CLI is over. continuo's refusal families all
      // fire before a child exists, and no lap has been sent yet in any case.
      return terminal(
        ports,
        admitting.record,
        lines,
        "failed",
        { reason: messageOf(admitted) },
        `continuo did not admit the run: ${messageOf(admitted)}`,
      );
    case "noAnswer":
      // The row **stays** `admitting` and keeps the lock. A run may or may not
      // exist under that id, and rondo will not re-admit to find out: `run
      // admit` refuses a duplicate run id, and relying on that refusal to
      // discover what happened is guessing with a mutating verb.
      return {
        kind: "finished",
        report: await holdAt(
          ports,
          lines,
          admitting.record,
          `run admit answered nothing: ${admitted.reason}`,
          [
            "The row stays at 'admitting' and keeps the single-flight lock, because a run may or " +
              "may not exist under that id and rondo will not re-admit to find out.",
            "An operator settles this with abandon(); 'gate list' and continuo's own run " +
              "listing are how a person finds out what actually happened.",
          ],
        ),
      };
    default:
      return {
        kind: "finished",
        report: await stall(ports, lines, admitting.record, unhandledOutcome(admitted)),
      };
  }
}

/**
 * `admitted` -> `performing` -> the suspend at the open gate.
 *
 * `performing` is committed **before** the lap is sent, for the same reason the
 * revision is: nothing is sent to continuo until the row that will explain it is
 * committed. This is the one step that takes minutes.
 *
 * The three answers are the whole of D-0019 rule 10's two `performing` rows:
 *
 *  - **answered** -- the gate the lap names is already open at stage `received`,
 *    so the row moves to `awaiting_human` with everything learned and **the
 *    interpreter returns**. The process may exit: there is no timer, no poll
 *    loop and no in-memory continuation. `resume()` is what comes next, from
 *    outside, after a person has answered.
 *  - **refused or defect** -- an answer arrived, so the `lap perform` process is
 *    over and no worker of its is still running. Terminal `failed` with
 *    continuo's own words, and the lock **is** released, correctly. A refusal
 *    that names its session (`continuo D-1102`) also writes that id to the row's
 *    `session_id`, so a failed lap is as findable afterwards as a suspended one:
 *    the identity comes from continuo's own field and never from its message,
 *    which D-0015 rule 7 forbids rondo to parse.
 *  - **noAnswer** -- rondo's own ceiling fired, or rondo died performing. A
 *    fenced child may still be alive, because rondo's timer kills the CLI and
 *    not the worker (D-0019 rule 12). The row **stays** `performing` and keeps
 *    the lock, and it is reported as a rondo defect requiring a human -- never
 *    as a lap that failed.
 */
async function performStep(
  ports: ConductorPorts,
  record: IterationRecord,
  lines: string[],
): Promise<StepResult> {
  const plan = await planOf(ports, record, lines);
  if (plan.kind === "unreadable") {
    return { kind: "finished", report: plan.report };
  }
  const modelTier = record.modelTier;
  if (modelTier === null) {
    return {
      kind: "finished",
      report: await stall(
        ports,
        lines,
        record,
        "the row is at 'admitted' and carries no model tier, so there is nothing for the " +
          "continuo layer to price into a model id, and a lap rondo cannot price is a lap it " +
          "does not start (D-0021)",
      ),
    };
  }
  const performing = await commit(ports, lines, record, "performing", {});
  if (performing.kind === "blocked") {
    return { kind: "finished", report: performing.report };
  }
  lines.push("Sending one lap; this is the step that takes minutes.");

  const walked = await ports.performLap(plan.plan, modelTier);
  switch (walked.kind) {
    case "answered": {
      const lap = walked.value;
      if (lap.runId !== plan.plan.runId) {
        // The same check `admitStep` makes on `run admit`'s answer and
        // `gateSeen` makes on the gate's, and it belongs here most of all: this
        // is the one step that takes minutes, and its answer is what supplies
        // the gate id the iteration then suspends on. Attaching another run's
        // gate to this row would mean a later `resume()` closing this iteration
        // on an outcome that was never about it.
        return {
          kind: "finished",
          report: await stall(
            ports,
            lines,
            performing.record,
            `continuo walked a lap for run '${lap.runId}' where the plan named ` +
              `'${plan.plan.runId}', so the gate it named is not this iteration's to suspend on`,
          ),
        };
      }
      if (lap.model !== lap.requestedModel) {
        // **Named before it is stalled**, for the reason the lines below are
        // said before they are committed: the lap ran and a gate is open, and a
        // gate rondo learned about and then never named is an open gate nobody
        // can find. This is not terminal `failed` either -- that arm is for an
        // answer that says the lap did not happen, and this one says it happened
        // on something other than what rondo asked for, which is a person's
        // question about an open gate rather than a lap to retry.
        lines.push(
          `The lap answered. Gate ${lap.gateId} is already open; session ${lap.sessionId} was ` +
            `${lap.sessionPath}.`,
        );
        return {
          kind: "finished",
          report: await stall(
            ports,
            lines,
            performing.record,
            `continuo reports the lap ran on ${spelledModel(lap.model)} where rondo asked for ` +
              `${spelledModel(lap.requestedModel)}, so what the iteration cost is not what its ` +
              "agent type declared",
          ),
        };
      }
      // **The independent reading, here and nowhere else** (D-0029 rules 4
      // and 8). Here because this is the only point in the arc at which the
      // work exists and nothing a person can act on has been written yet: the
      // row is durably `performing`, so a crash leaves the same row it would
      // have left a line earlier. Nowhere else because the two neighbouring
      // places are both wrong -- before the identity checks above the lap may
      // not even be this iteration's, and after the suspend commit the person
      // is already being asked.
      //
      // **It adds no state and it cannot fail the step.** `performing` already
      // occupies capacity and already owns its two releasing events, so
      // RELEASED_BY, SUSPENDED_STATUSES and the ledger are untouched; and every
      // outcome of the port that is not an answer becomes an `unavailable`
      // reading rather than a stall, because a reading nobody could take must
      // not cost an iteration whose gate is already open.
      const read = await ports.readLapWork(plan.plan);
      const reading: LapReadingDraft =
        read.kind === "answered"
          ? read.value
          : {
              drafter: UNREAD_DRAFTER,
              verdict: "unavailable",
              findings: Object.freeze([]),
              evidence: null,
              unavailableReason: messageOf(read),
            };
      // **Said before it is committed, on purpose.** A blocked commit -- an
      // operator who called abandon() while the lap was walking -- drops these
      // facts from the row, and the gate id is the one thing only a person can
      // act on: a gate rondo learned about and then never named is an open gate
      // nobody can find. So the lines go in first and are in the report on both
      // paths, and only the suspension itself is claimed after the write.
      lines.push(
        ...readingLines(reading),
        `The lap answered. Gate ${lap.gateId} is already open; session ${lap.sessionId} was ` +
          `${lap.sessionPath}.`,
        ...(lap.endpointLeaseFailure === null
          ? []
          : [`continuo reported an endpoint lease failure: ${lap.endpointLeaseFailure}`]),
        ...(lap.elapsedDeadlineAtMs === null
          ? []
          : [`continuo reported an elapsed deadline at ${String(lap.elapsedDeadlineAtMs)}ms.`]),
      );
      const suspended = await commit(
        ports,
        lines,
        performing.record,
        "awaiting_human",
        {
          gateId: lap.gateId,
          sessionId: lap.sessionId,
          // continuo's own header says this is the walk's own name -- `started`,
          // `respawned`, `resumed` -- and not a filesystem path. The record's
          // field is named after continuo's field so a reader can match them.
          sessionPath: lap.sessionPath,
          // continuo's own answer rather than rondo's request: the two were just
          // checked to be the same value, and recording the observation is what
          // makes that check able to fail (D-0015 rule 6's habit, applied to a
          // second measured field).
          model: lap.model,
          ...lapNoteFields(
            performing.record.reason,
            lap.endpointLeaseFailure,
            lap.elapsedDeadlineAtMs,
          ),
        },
        // The one write of D-0029 rule 8: the reading lands inside the same
        // `BEGIN IMMEDIATE` as the suspend, or neither lands.
        reading,
      );
      if (suspended.kind === "blocked") {
        return { kind: "finished", report: suspended.report };
      }
      lines.push(
        "The conductor is suspending here. There is no timer and no poll loop, and the process " +
          "may exit; call resume() once a person has answered the gate.",
      );
      return { kind: "finished", report: finish(suspended.record, lines) };
    }
    case "refused":
    case "defect": {
      const session = refusedSessionId(walked);
      if (session !== undefined) {
        // **Said before it is committed**, exactly as the answered path says its
        // gate id first and for the same reason: a blocked commit -- an operator
        // who called abandon() while the lap was walking, or a store that
        // refused -- drops the fact from the row, and an identity rondo learned
        // about and then never named is a worker that may still be running with
        // nobody able to name it. The line is in the report on both paths; only
        // the column is claimed after the write.
        lines.push(
          `continuo names the session the lap refused over: ${session}. It is what a transcript ` +
            "read or a 'session stop' is keyed on.",
        );
      }
      return terminal(
        ports,
        performing.record,
        lines,
        "failed",
        // The identity is written beside the reason, into the column that has
        // always been there for it, and only when continuo named one: a failed
        // lap whose session is unknown keeps a null rather than a guess.
        { reason: messageOf(walked), ...(session === undefined ? {} : { sessionId: session }) },
        `The lap did not complete: ${messageOf(walked)}`,
        // The lock is released on both spellings, because an answer means the
        // CLI is over -- D-0019 rule 11, unchanged. What the second spelling
        // does not repeat is the blanket claim that nothing of the lap's is
        // still running: continuo names a session on a refusal precisely
        // because the states that carry one are the ones a person may still
        // have to act on, and its own teardown stops a session it still owns
        // rather than promising rondo that one was never there.
        session === undefined
          ? [
              "An answer arrived, so the 'lap perform' process is over and no worker of its is " +
                "still running. The single-flight lock is released.",
            ]
          : [
              "An answer arrived, so the 'lap perform' process is over and the single-flight " +
                "lock is released.",
              "continuo stops a session it still owns before it answers a refusal, so this is " +
                "not the ceiling-fired case that keeps the lock. The id above is what a person " +
                "checks that against, and it is on the row.",
            ],
      );
    }
    case "noAnswer":
      return {
        kind: "finished",
        report: await holdAt(
          ports,
          lines,
          performing.record,
          `lap perform answered nothing: ${walked.reason}`,
          [
            "This is a rondo defect requiring a human, and not a lap that failed: nothing came " +
              "back, so rondo knows nothing about what is or is not still running.",
            "The row stays at 'performing' and keeps the single-flight lock. A fenced child may " +
              "still be alive -- rondo's ceiling kills the CLI and not the worker -- and " +
              "releasing the lock here would let a second lap race an orphan.",
            "A gate may or may not exist. 'gate list' is how a person finds out; an operator " +
              "then settles the row with abandon().",
          ],
        ),
      };
    default:
      return {
        kind: "finished",
        report: await stall(ports, lines, performing.record, unhandledOutcome(walked)),
      };
  }
}

/**
 * The one gate observation, and the only place `closed` is written.
 *
 * A failed observation is not a fact about the gate, so a refusal, a defect or a
 * silence from `gate show` **changes nothing**: the row stays where it was, and
 * a later `resume()` can look again. That is the same reasoning as the null
 * outcome and is why observing is safe to retry where admitting and performing
 * are not -- `gate show` only observes.
 */
async function observeStep(
  ports: ConductorPorts,
  record: IterationRecord,
  lines: string[],
): Promise<StepResult> {
  const gateId = record.gateId;
  if (gateId === null) {
    return {
      kind: "finished",
      report: await stall(
        ports,
        lines,
        record,
        `the row is at '${record.status}', which means a gate is open on this iteration, and it ` +
          "carries no gate id",
      ),
    };
  }
  const plan = await planOf(ports, record, lines);
  if (plan.kind === "unreadable") {
    return { kind: "finished", report: plan.report };
  }

  const seen = await ports.showGate(plan.plan, gateId);
  switch (seen.kind) {
    case "answered":
      return gateSeen(ports, record, lines, gateId, seen.value);
    case "refused":
    case "defect":
    case "noAnswer":
      lines.push(
        `The gate could not be observed, so nothing was written: ${messageOf(seen)}`,
        `Iteration ${record.id} stays at '${record.status}'. Observing is idempotent, so ` +
          "resume() can be called again.",
        ...outstandingAskLines(record.status === "withdrawal_requested" ? gateId : null),
      );
      return { kind: "finished", report: finish(record, lines) };
    default:
      return {
        kind: "finished",
        report: await stall(ports, lines, record, unhandledOutcome(seen)),
      };
  }
}

/**
 * Null outcome means the gate is open; anything else means it is terminal.
 *
 * **The observation has to be about the gate the row names**, and that is
 * checked before anything is written. It is the symmetric case of `admitStep`'s
 * run-id check, and it matters more here, because what follows a non-null
 * outcome is `closed` -- a terminal, lock-releasing transition. Writing one from
 * an observation about a different gate would end an iteration on a fact about
 * something else, so a mismatch stalls and asks instead.
 */
async function gateSeen(
  ports: ConductorPorts,
  record: IterationRecord,
  lines: string[],
  gateId: string,
  seen: GateObservation,
): Promise<StepResult> {
  if (seen.gateId !== gateId) {
    return {
      kind: "finished",
      report: await stall(
        ports,
        lines,
        record,
        `the gate observation is about gate '${seen.gateId}' where the row names '${gateId}', so ` +
          "rondo's row and the observation would describe different gates",
      ),
    };
  }
  if (seen.outcome === null) {
    // Exactly "the gate is still open". Nothing is written, which is what makes
    // resume() safe to call from a surface that cannot be sure.
    lines.push(
      `Gate ${seen.gateId} is still open at stage '${seen.stage}'. Nothing was written and ` +
        `iteration ${record.id} stays at '${record.status}'.`,
      ...outstandingAskLines(record.status === "withdrawal_requested" ? seen.gateId : null),
    );
    return { kind: "finished", report: finish(record, lines) };
  }
  const committed = await commit(ports, lines, record, "closed", {
    gateStage: seen.stage,
    gateOutcome: seen.outcome,
  });
  if (committed.kind === "blocked") {
    return { kind: "finished", report: committed.report };
  }
  lines.push(`Gate ${seen.gateId} reached outcome '${seen.outcome}' at stage '${seen.stage}'.`);
  return { kind: "advanced", record: committed.record };
}

// --- committing -------------------------------------------------------------

/**
 * Who a reading is attributed to when no reader produced one.
 *
 * A named value rather than the deterministic reader's name, because the row
 * has to be able to say "the reading did not happen" and not "the reader looked
 * and found nothing". Those are the two facts D-0029 rule 10 exists to keep
 * apart, and attributing an absence to the reader would erase the difference in
 * the one place it is recorded.
 */
const UNREAD_DRAFTER = "rondo/none";

/**
 * What the operator is told about the reading, above the gate id.
 *
 * One line per finding, and a line even when there is nothing to say: a person
 * shown nothing cannot tell a clean reading from a stage that did not run,
 * which is the distinction the row keeps and the one `publish` refuses on.
 * Every string here is rondo's own and is ASCII (D-0004).
 */
function readingLines(reading: LapReadingDraft): readonly string[] {
  switch (reading.verdict) {
    case "clear":
      return [
        `An independent reading of the work found nothing to raise (${reading.drafter}). It read ` +
          `${String(reading.evidence?.commitCount ?? 0)} commit(s) and ` +
          `${String(reading.evidence?.fileCount ?? 0)} file(s); this is material for you, not an ` +
          "approval.",
      ];
    case "concerns":
      return [
        `An independent reading of the work raised ${String(reading.findings.length)} point(s) ` +
          `(${reading.drafter}):`,
        ...reading.findings.map((finding) => `  - ${finding}`),
        "That is material for you to weigh. It settles nothing, and the answer is still yours.",
      ];
    default:
      return [
        "No independent reading of the work could be taken: " +
          `${reading.unavailableReason ?? "no reason recorded"}.`,
        "'rondo publish' will refuse once on this, for the same reason it refuses a reading that " +
          "raised something: unread and read-and-fine must not look alike.",
      ];
  }
}

/** A transition either happened, or the call is over and says why. */
type CommitResult =
  | { readonly kind: "committed"; readonly record: IterationRecord }
  | { readonly kind: "blocked"; readonly report: ConductorReport };

/**
 * One committed transition, asserting the status this call last saw.
 *
 * **`unexpectedStatus` means another writer moved the row underneath this one**,
 * and the answer is to report and stop. Not to retry -- the state this call
 * reasoned from is gone -- and not to force it, because forcing is how two
 * writers both believe they hold the conductor.
 */
async function commit(
  ports: ConductorPorts,
  lines: string[],
  record: IterationRecord,
  to: IterationStatus,
  fields: IterationFields,
  reading: LapReadingDraft | null = null,
): Promise<CommitResult> {
  const outcome = await ports.store.transition(
    record.id,
    record.status,
    to,
    fields,
    ports.now(),
    reading,
  );
  switch (outcome.kind) {
    case "transitioned":
      return { kind: "committed", record: outcome.record };
    case "unexpectedStatus":
      lines.push(
        `Stopped: iteration ${record.id} was '${record.status}' when this call read it and is ` +
          `'${outcome.found}' now, so another writer moved it. Nothing was written by this call, ` +
          "and it will not be retried or forced.",
      );
      return {
        kind: "blocked",
        report: { iterationId: record.id, status: outcome.found, lines: Object.freeze(lines) },
      };
    case "missing":
      lines.push(`Stopped: iteration ${record.id} no longer exists in the store.`);
      return {
        kind: "blocked",
        report: { iterationId: record.id, status: null, lines: Object.freeze(lines) },
      };
    case "defect":
      lines.push(`Stopped: the store could not write the transition to '${to}': ${outcome.reason}`);
      return {
        kind: "blocked",
        report: { iterationId: record.id, status: record.status, lines: Object.freeze(lines) },
      };
  }
}

/** A terminal transition, its reason, and the lines that explain it. */
async function terminal(
  ports: ConductorPorts,
  record: IterationRecord,
  lines: string[],
  to: IterationStatus,
  fields: IterationFields,
  headline: string,
  extra: readonly string[] = [],
): Promise<StepResult> {
  const committed = await commit(ports, lines, record, to, fields);
  if (committed.kind === "blocked") {
    return { kind: "finished", report: committed.report };
  }
  lines.push(headline, ...extra, `Iteration ${committed.record.id} ended at '${to}'.`);
  return { kind: "finished", report: finish(committed.record, lines) };
}

/**
 * Record why an effect answered nothing, without moving the row.
 *
 * A self-transition rather than a silent return: the reason belongs on the row a
 * person will find later, and the row's status is the lock they will have to
 * release. `from` and `to` are the same status, which the store's assertion
 * accepts and which says exactly what happened -- nothing moved.
 */
async function holdAt(
  ports: ConductorPorts,
  lines: string[],
  record: IterationRecord,
  reason: string,
  extra: readonly string[],
): Promise<ConductorReport> {
  const committed = await commit(
    ports,
    lines,
    record,
    record.status,
    appendedReason(record, reason),
  );
  if (committed.kind === "blocked") {
    return committed.report;
  }
  lines.push(reason, ...extra);
  return finish(committed.record, lines);
}

/**
 * File an iteration nobody can classify at `stalled`, and stop.
 *
 * `stalled` and not `awaiting_human`: the latter promises an open gate for
 * `resume()` to observe, and there is none. `stalled` and not a terminal status
 * either, which would release the single-flight lock on an iteration nobody
 * understood. It is released by an operator's `abandon()` and by nothing else,
 * which is D-0019 rule 10's row for it.
 */
async function stall(
  ports: ConductorPorts,
  lines: string[],
  record: IterationRecord,
  reason: string,
): Promise<ConductorReport> {
  if (record.status === "stalled") {
    lines.push(`Iteration ${record.id} is already stalled: ${reason}`, ...heldLockLines(record));
    return finish(record, lines);
  }
  const committed = await commit(ports, lines, record, "stalled", appendedReason(record, reason));
  if (committed.kind === "blocked") {
    return committed.report;
  }
  lines.push(
    `Iteration ${committed.record.id} stalled: ${reason}`,
    "'stalled' means a person must decide and there is no gate to observe. Nothing proceeds " +
      "from here on its own.",
    ...heldLockLines(committed.record),
  );
  return finish(committed.record, lines);
}

// --- small shared pieces ----------------------------------------------------

/** The plan a step needs, or the stall that ends the call because it will not read. */
type PlanLookup =
  | { readonly kind: "read"; readonly plan: AdmittedPlan }
  | { readonly kind: "unreadable"; readonly report: ConductorReport };

/**
 * The persisted plan, read back.
 *
 * The other half of "persist it verbatim" (D-0019 rule 4), and it re-runs the
 * full validation rather than trusting whatever wrote the row: the bytes may
 * have been written by an older rondo, or edited by a person. A payload that
 * will not read is a row this interpreter cannot classify, so it stalls -- the
 * plan is what every remaining effect is addressed to, and there is no partial
 * version of it worth acting on.
 */
async function planOf(
  ports: ConductorPorts,
  record: IterationRecord,
  lines: string[],
): Promise<PlanLookup> {
  const outcome = readPlan(record.plan);
  if (outcome.kind === "planned") {
    return { kind: "read", plan: outcome.plan };
  }
  return {
    kind: "unreadable",
    report: await stall(
      ports,
      lines,
      record,
      `the persisted plan will not read back: ${outcome.reason}`,
    ),
  };
}

/**
 * A model in a sentence a person reads, including the case where there is none.
 *
 * `null` is spelled out rather than rendered as an empty quotation, because it
 * is the one value in this comparison that is a *fact about a choice not being
 * made*: continuo reports it when nothing named a model and the worker CLI's own
 * default applied. A reader who saw `''` would look for a configuration mistake
 * where there is a missing flag.
 */
function spelledModel(model: string | null): string {
  return model === null ? "no model at all (the worker CLI's own default)" : `model '${model}'`;
}

/**
 * What `lap perform` reported that the row has no column of its own for.
 *
 * `endpoint_lease_failure` and `elapsed_deadline_at_ms` are two of the twelve
 * fields the decoder reads, and neither is a column of D-0019 rule 10's row.
 * (The twelfth, `model`, *did* get a column of its own under D-0021 -- as its
 * own decision, recorded there, and not by widening this helper.)
 * Losing them was the wrong answer -- an endpoint lease failure is exactly what
 * a person reading a suspended iteration needs to see -- so they are folded into
 * `reason`, which is the one column that carries free text, and they are in the
 * report lines as well. Adding two columns was the rejected alternative: the row
 * is the store's schema and D-0019's decision, and widening it here would be a
 * schema decision taken inside an implementation diff.
 *
 * It appends rather than replaces, through {@link appendReason}, for the same
 * reason it exists: `reason` is one column shared by everything that has free
 * text to record, so a writer that overwrote it would lose whatever the last
 * one put there -- which is exactly the loss this helper was written to prevent.
 */
function lapNoteFields(
  existing: string | null,
  endpointLeaseFailure: string | null,
  elapsedDeadlineAtMs: number | null,
): IterationFields {
  const notes: string[] = [];
  if (endpointLeaseFailure !== null) {
    notes.push(`endpoint lease failure: ${endpointLeaseFailure}`);
  }
  if (elapsedDeadlineAtMs !== null) {
    notes.push(`elapsed deadline at ${String(elapsedDeadlineAtMs)}ms`);
  }
  return notes.length === 0 ? {} : { reason: appendReason(existing, notes.join("; ")) };
}

/**
 * The `reason` column, kept rather than replaced.
 *
 * Every writer of this column shares it -- {@link lapNoteFields}'s endpoint
 * lease failure and elapsed deadline, a withdrawal's ask, a hold's silence, a
 * stall's diagnosis -- and each of them is something a person reading the row
 * afterwards needs. Overwriting is how the endpoint lease failure a lap reported
 * disappears the moment anything else has something to say, and the row is the
 * durable copy: the report lines are gone with the process.
 *
 * A repeated addition is not appended twice, because `resume()` and `abandon()`
 * are callable as often as a surface likes and a column that grew by one copy
 * per call would end up unreadable for the same reason it exists to be read.
 */
function appendReason(existing: string | null, addition: string): string {
  if (existing === null || existing === "") {
    return addition;
  }
  // **Whole entries, not substrings.** `includes()` would drop a new reason
  // merely *contained* in an old one -- an operator's `timeout` swallowed by an
  // existing `endpoint lease failure: timeout after 60 seconds` -- and the
  // reason column is the one place a person can reconstruct afterwards what
  // happened, so silently losing what they said is the failure worth avoiding.
  // The separator is what an entry is delimited by, so it is what an entry is
  // compared as.
  const entries = existing.split("; ");
  return entries.includes(addition) ? existing : `${existing}; ${addition}`;
}

/** {@link appendReason} as the field a transition writes. */
function appendedReason(record: IterationRecord, addition: string): IterationFields {
  return { reason: appendReason(record.reason, addition) };
}

/**
 * The session a refused effect named, or nothing.
 *
 * **Only a refusal can carry one, and the only source is the field.** continuo
 * names the session of a `lap perform` refusal in a key of its own precisely so
 * that a host does not have to read it out of a sentence written for a person
 * (`continuo D-1102`, D-0015 rule 7), and rondo's own defects have no session to
 * name at all -- a defect is rondo calling continuo wrong, which happens on this
 * side of the process boundary. So the two arms that share the terminal
 * transition do not share this field, and a `defect` answers `undefined` here by
 * construction rather than by a check that could later be forgotten.
 */
function refusedSessionId(outcome: EffectOutcome<unknown>): string | undefined {
  return outcome.kind === "refused" ? outcome.sessionId : undefined;
}

/** continuo's or cadenza's own words, whichever kind of non-answer this is. */
function messageOf(outcome: EffectOutcome<unknown>): string {
  switch (outcome.kind) {
    case "refused":
      return outcome.message;
    case "defect":
    case "noAnswer":
      return outcome.reason;
    case "answered":
      return "the effect answered";
  }
}

/**
 * An effect result in a shape the union does not cover.
 *
 * The `never` parameter is the compile-time half: a variant added to
 * `EffectOutcome` and not handled makes this call a type error, which is what
 * D-0019 rule 8 asks the exhaustive `switch` for. The runtime half is real all
 * the same -- the value came through a port, and a port is implemented by an
 * adapter or a fake that TypeScript did not check at the boundary.
 */
function unhandledOutcome(outcome: never): string {
  return `an effect answered in a shape this interpreter does not cover: ${describe(outcome)}`;
}

/** A value as text, without ever throwing on the way. */
function describe(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "undefined";
  } catch {
    return "a value that cannot be rendered as text";
  }
}

/** A step, named for a person who is being told the policy refused them. */
function describeStep(step: Step): string {
  return step.kind === "ask_human" ? `the policy asks about ${step.about}` : step.kind;
}

/** The report a `closed` iteration owes, and D-0010 is most of it. */
function closedReportLines(record: IterationRecord): readonly string[] {
  return [
    `Iteration ${record.id} is closed.`,
    `Gate outcome: ${record.gateOutcome ?? "not recorded"}.`,
    `Run id: ${record.runId ?? "not recorded"}; continuo revision: ` +
      `${record.continuoRevision ?? "not recorded"}.`,
    "The run row is still 'created'. Nothing was pushed, nothing was landed, and publishing " +
      "this work is the operator's, not rondo's (D-0010).",
  ];
}

/** What a person needs to know about a row that is still holding the lock. */
function heldLockLines(record: IterationRecord): readonly string[] {
  return [
    `'${record.status}' is not terminal, so iteration ${record.id} still holds the ` +
      "single-flight lock and no new iteration can be reserved until a person settles it with " +
      "abandon().",
  ];
}

/**
 * What a call that cannot read the row it was given has to say.
 *
 * Two facts and one instruction, and all three are load-bearing. The row is
 * still non-terminal as far as the partial unique index is concerned, so it
 * holds the single-flight lock and nothing else can be reserved while it stands
 * -- and every status-asserting write refuses it, so `resume()` and
 * `requestWithdrawal()` cannot be the way out however often they are called.
 * `abandon()` is, because it is the one call that settles a row by id alone, and
 * saying so is the difference between a report and a dead end.
 */
function unreadableRowLines(id: string, reason: string, verb: string): readonly string[] {
  return [
    `Iteration ${id} exists but will not decode, so it cannot be ${verb}: ${reason}`,
    "Nothing was written and no continuo verb was driven: a row whose status cannot be read has " +
      "no status to act on, and rondo does not guess one.",
    `Iteration ${id} is still non-terminal as far as the store is concerned, so it holds the ` +
      "single-flight lock and no new iteration can be reserved until somebody takes it.",
    "abandon() is the way out. It is the one call that settles a row it cannot read, by id alone.",
  ];
}

/** The standing ask of D-0013, repeated wherever a reader might act on it. */
function outstandingAskLines(gateId: string | null): readonly string[] {
  if (gateId === null) {
    return [];
  }
  return [
    `Outstanding ask: a person closes gate ${gateId} with 'gate close --outcome withdrawn'. ` +
      "rondo never writes a gate outcome and drove no verb here (D-0013).",
    "A gate whose close has been asked for is not thereby closed; resume() is what observes the " +
      "result.",
  ];
}

/** One report, from the row it is about. */
function finish(record: IterationRecord, lines: string[]): ConductorReport {
  return { iterationId: record.id, status: record.status, lines: Object.freeze([...lines]) };
}
