/**
 * The shapes the durable store persists.
 *
 * Deliberately here rather than in `src/refrain/`: the loop describes what it
 * wants to happen, the store decides what a persisted fact looks like, and the
 * direction of that dependency is what
 * `test/architecture/import-boundaries.test.ts` enforces.
 *
 * D-0019 rule 10 is what turned this file from a skeleton into a schema. The
 * four-field record it used to hold could not express a run, a gate, a contract
 * or a continuo revision, and the four statuses could not say *which* effect
 * was in flight -- which is the one thing a crashed conductor needs to know
 * about the row it finds.
 */

/**
 * JSON as the store holds it: a document it persists verbatim and never reads
 * into.
 *
 * The `RunPlan` is declared in `src/refrain/plan.ts`, because its cadenza-side
 * fields are cadenza's types and the store may not import cadenza -- the store
 * layer names only itself. So the plan crosses into the store as the payload
 * the loop rendered, is stored byte for byte beside the digest of those bytes
 * (D-0019 rule 4), and is handed back unaltered for the loop to re-read. The
 * store is the thing that guarantees the bytes come back; it is not the thing
 * that knows what they mean.
 */
export type JsonValue = string | number | boolean | null | readonly JsonValue[] | JsonRecord;

export interface JsonRecord {
  readonly [key: string]: JsonValue | undefined;
}

/**
 * How far a single iteration of the loop has got.
 *
 * Eleven states, and the split between them is the whole of D-0019 rule 10's
 * safety property: under the partial unique index of `sqlite.ts`, **every
 * non-terminal status is a lock on the whole conductor**, so a non-terminal
 * state with no event that can end it is not an inconvenience -- it is a
 * conductor that never runs again. `RELEASED_BY` below is that table, written
 * down where a reader can find it and where a test can assert it row by row.
 *
 * Four of the eleven need their meaning pinned down rather than guessed from
 * the name:
 *
 *  - **`awaiting_human` means a continuo gate is open on this iteration**, and
 *    nothing else. It always carries a gate id. It is not the general "a person
 *    has to look at this" state, and using it as one is how a design deadlocks
 *    itself.
 *  - **`abandoned` is terminal and is not a failure.** It is where a request
 *    ends correctly without a run: a `refused` classification, a
 *    `needs_approval` lap 1 cannot resume (D-0019 rule 15), or an operator
 *    settling an iteration whose outcome cannot be established. Calling these
 *    `failed` would file a working refusal as a defect.
 *  - **`withdrawal_requested` is reachable only from `awaiting_human`**,
 *    because it is defined by the ask it carries -- `gate close --outcome
 *    withdrawn` on a *named* gate (D-0013). A failure with no gate id has
 *    nothing to ask about.
 *  - **`stalled` is "a person must decide, and there is no gate"**: a corrupt
 *    row, an effect result the union does not cover, a status the interpreter
 *    does not recognise. It exists so those cases have somewhere to go that is
 *    neither a lie (`awaiting_human`, which promises a gate) nor a loss (a
 *    terminal status, which would release the lock on an iteration nobody
 *    understood).
 *
 * `running` was removed rather than renamed. It is the one word that cannot be
 * acted on after a crash: a restart finding it cannot tell whether a run was
 * admitted, whether a lap is still walking, or whether anything was ever sent.
 * `admitting`, `admitted` and `performing` each answer that question.
 */
export type IterationStatus =
  /** Reserved, with the plan and its digest committed and nothing sent. */
  | "planned"
  /** cadenza answered `allowed`; the three digests are committed. */
  | "classified"
  /** The observed continuo revision is committed and `run admit` is in flight. */
  | "admitting"
  /** continuo holds the run; no lap has been sent. */
  | "admitted"
  /** `lap perform` is in flight. The slow step, and no two take the same time. */
  | "performing"
  /** A continuo gate is open on this iteration, and its id is on the row. */
  | "awaiting_human"
  /** The operating surface has been asked for `gate close --outcome withdrawn`. */
  | "withdrawal_requested"
  /** A person must decide and there is no gate to observe. */
  | "stalled"
  /** The gate reached an outcome. Terminal. */
  | "closed"
  /** The request ended correctly without a run, or an operator settled it. Terminal. */
  | "abandoned"
  /** continuo refused, or rondo diagnosed a defect after the child closed. Terminal. */
  | "failed";

/**
 * The three statuses that release the single-flight lock.
 *
 * Written once, here, and read by the generated column in `sqlite.ts`, by the
 * interpreter and by the tests. Repeating the set in a partial index is what
 * D-0019 rule 10 rejected shape A for.
 */
export const TERMINAL_STATUSES = Object.freeze(["closed", "abandoned", "failed"] as const);

/**
 * The two non-terminal statuses that hold **no** capacity (D-0023 rule 2).
 *
 * Written once, here, for the reason {@link TERMINAL_STATUSES} is: the
 * generated `occupying` column in `sqlite.ts`, the bound `maxOccupying` counts
 * against, and the tests that assert one status per row all read this tuple, so
 * the set has one spelling and cannot be narrowed in one place and not another.
 * D-0023's own drafting was wrong here once -- a bound defined over
 * `admitting`/`admitted`/`performing` alone let two `planned` rows pass a bound
 * of one -- and a set stated twice is what made that possible.
 *
 * The criterion is {@link RELEASED_BY}'s own, applied to a second question:
 * **whether anything of this iteration might still be running.** At
 * `awaiting_human` and `withdrawal_requested` nothing is. The `lap perform`
 * process has exited, continuo's delivery lease was released when it did, and
 * no fenced child survives it -- so the row is durable state in front of a
 * person rather than work in flight, and holding an execution slot for it
 * bounds the human's queue depth by the number of laps that may run.
 *
 * **`stalled` is deliberately not here.** It means *unknown* -- a corrupt row,
 * an outcome the union does not cover -- and the one honest answer about a row
 * nobody understands is that something may still be running. It occupies,
 * fail-closed.
 */
export const SUSPENDED_STATUSES = Object.freeze([
  "awaiting_human",
  "withdrawal_requested",
] as const);

/** A status that ends an iteration, and therefore frees the conductor. */
export type TerminalStatus = (typeof TERMINAL_STATUSES)[number];

/** A status that holds the lock, and therefore owes a releasing event. */
export type NonTerminalStatus = Exclude<IterationStatus, TerminalStatus>;

export function isTerminal(status: IterationStatus): status is TerminalStatus {
  // `includes` over the frozen tuple rather than a second literal union: the
  // set has one spelling, and adding a terminal status is one edit.
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

/**
 * Every non-terminal status, beside the event that ends it.
 *
 * D-0019 rule 10's table, as data rather than as prose, so that
 * `test/refrain/` can assert it a case per row: for every non-terminal status
 * the named event leaves it, and a state added later without a releasing event
 * fails a test rather than wedging a conductor.
 *
 * The two `*_no_answer` rows are the ones worth reading twice. A `performing`
 * iteration that **received a refusal** releases the lock; one that **received
 * nothing** does not. The difference is not how bad the outcome was -- it is
 * whether anything might still be running, because rondo's own ceiling kills
 * the CLI and not the fenced child (D-0019 rule 12).
 *
 * **That criterion answers a second question, and D-0023 is the entry that
 * asked it.** Read as "what ends this status", the table is about liveness.
 * Read as "is anything of this iteration running", the same column decides
 * whether the row should occupy an execution slot at all -- and it gives the
 * opposite answer from the schema for exactly two rows. `awaiting_human` and
 * `withdrawal_requested` are released by an event that comes from *outside*
 * the iteration, because by then the process has exited and nothing of it
 * survives; every other non-terminal row is released by something of its own
 * that is still in flight. {@link SUSPENDED_STATUSES} is those two rows, and
 * it is that reading made into a set. No row is added or removed here by
 * D-0023: the table was already right, and was already answering both.
 */
export const RELEASED_BY: Readonly<Record<NonTerminalStatus, readonly string[]>> = Object.freeze({
  planned: ["the interpreter, immediately"],
  classified: ["the interpreter, immediately"],
  admitting: ["run admit answering", "an operator's abandon() when nothing answered"],
  admitted: ["the interpreter, immediately"],
  performing: ["lap perform answering", "an operator's abandon() when nothing answered"],
  awaiting_human: ["resume() observing a non-null gate outcome", "the abort edge"],
  withdrawal_requested: ["resume() observing a non-null gate outcome"],
  stalled: ["an operator's abandon()"],
});

/**
 * Which side of the wait one live iteration is on (D-0036 rule 5).
 *
 * **A two-way partition, exhaustive over the eight non-terminal statuses, and
 * written out rather than illustrated.** #41 section 4 describes three sides --
 * waiting on you, waiting on CI, still running -- and rule 5 refuses the third:
 * no `IterationStatus` member means "waiting on CI", because CI runs inside
 * `lap perform`, and obtaining the distinction would mean widening what rondo
 * may read for something the operator cannot act on either way.
 *
 * **A `Record<NonTerminalStatus, ...>` for {@link RELEASED_BY}'s reason**, and
 * rule 5 names that reason: a status added to the union and forgotten here is a
 * **type error** rather than an iteration missing from the inbox at the moment
 * the operator came back to find out what is live. `planned` and `classified`
 * are why the lists are written in full -- they are durable rows a crash leaves
 * standing, not moments inside a function, and two illustrative lists would
 * drop exactly them.
 *
 * The terminal three are absent because a closed item is not a wait at all: it
 * belongs to D-0032 rule 11's terminal enumeration, which is a different region
 * of the screen.
 */
export const WAIT_SIDE: Readonly<Record<NonTerminalStatus, "waitingOnYou" | "inFlight">> =
  Object.freeze({
    // The two suspended statuses (`SUSPENDED_STATUSES`) plus the one that means
    // a person must decide and there is no gate.
    awaiting_human: "waitingOnYou",
    withdrawal_requested: "waitingOnYou",
    stalled: "waitingOnYou",
    planned: "inFlight",
    classified: "inFlight",
    admitting: "inFlight",
    admitted: "inFlight",
    performing: "inFlight",
  });

/**
 * One iteration of the loop, as the store holds it.
 *
 * Every field is nullable that can legitimately be unknown at the moment the
 * row is written, and none is nullable that cannot: the write order of D-0019
 * rule 10 is what decides which is which, and it exists so that a crash leaves
 * a row that explains the effect it preceded rather than one that does not.
 *
 * The store reads no clock. `createdAtMs` and `updatedAtMs` are the caller's,
 * because a record whose timestamp came from inside the store is a record whose
 * time cannot be controlled from a test.
 */
export interface IterationRecord {
  /** Opaque identity minted by the caller, never by the loop's planner. */
  readonly id: string;
  readonly status: IterationStatus;
  /** The one-line request, exactly as a person wrote it. */
  readonly request: string;
  /**
   * The plan the caller handed over, verbatim (D-0019 rule 4).
   *
   * Verbatim rather than digested-only because a digest detects change and does
   * not hand back the plan a past run used, and continuo persists the admitted
   * intent rather than the executor paths or the agent type -- so this row is
   * the only place "under what plan did this run happen" is answerable.
   */
  readonly plan: JsonRecord;
  /** `sha256:...` over the canonical rendering of {@link plan}. */
  readonly planDigest: string;
  /**
   * How many attempts this iteration has had.
   *
   * One, in lap 1, always: there is no back-edge, because a second attempt
   * needs a fresh (run id, topic branch, workspace) triple that D-0012 records
   * nothing allocates. The field is persisted rather than counted in memory
   * because a host that restarted and began counting from zero would have no
   * ceiling at all, and it is what the ceiling in `src/refrain/loop.ts` is
   * compared against.
   */
  readonly attempts: number;
  /**
   * The three identifiers rondo minted for this iteration (D-0023 rule 5).
   *
   * They are on the row rather than in a fourth table because a table holding
   * exactly one row per iteration, keyed by the iteration, is a table shaped
   * like a column. `runId` predates D-0023 and was written later, at
   * `admitting`, from the plan the caller had typed; under the allocator all
   * three are written by `reserve()` in the same `BEGIN IMMEDIATE` as the row,
   * because the claim they represent is what makes a second iteration safe and
   * a claim committed after the row is a claim with a window in it.
   *
   * **The claim is not a lock and is never released.** {@link
   * identifiersSpent} is what says whether it may be, and the three partial
   * unique indexes over the generated `holds_identifiers` column in
   * `sqlite.ts` are what enforce it.
   */
  readonly runId: string | null;
  readonly topicBranch: string | null;
  readonly workspace: string | null;
  /**
   * Whether this iteration's identifiers have been handed to continuo.
   *
   * Zero until the one transition into `admitting` sets it to one, and never
   * back. It is the difference between a triple that was *used* and one that
   * was merely *held*: once `run admit` is spawned continuo owns a run under
   * that id, git owns the branch, and the filesystem owns the worktree, so the
   * names are spent for ever and no later iteration may be handed them --
   * including after this row reaches a terminal status.
   *
   * A terminal row that is **unspent** releases its triple, which is the only
   * reason this is a column rather than a constant. Nothing in the tree
   * inherits a released triple today; the column exists so that the schema
   * cannot make such an inheritance unsafe later without the change being
   * visible here. See D-0023's own note on `advisory.md`'s unratified `A-17`.
   */
  readonly identifiersSpent: number;
  /**
   * The iteration this one is a revision of, or null for a first lap (D-0030).
   *
   * **The lineage D-0027 rule 9 deferred**, and the deferral was to "the entry
   * that adds a migration to the store" -- which D-0023 did, on the schema
   * half, so this is a column and an `ALTER TABLE` rather than a design. What
   * it replaces is an inference: a successor's `base_branch` equals its
   * predecessor's `topic_branch`, so a reader could *guess* the succession from
   * two branch names and could not tell a real one from two laps whose names
   * happen to line up.
   *
   * **Written once, by `reserve()`, in the same transaction as the row, and by
   * nothing afterwards.** It is a fact about how the row came to exist -- the
   * same grade of fact as the three identifiers beside it -- and a record of
   * where a lap came from that a later transition could rewrite is a record of
   * where somebody would prefer it had come from. {@link IterationFields} omits
   * it for that reason, as it omits the triple (D-0023 rule 5).
   *
   * **Null is not "unknown", it is "no predecessor".** Every first lap has it,
   * and every row written before D-0030 has it -- which are the same fact to a
   * reader, deliberately: a database that predates the column holds no
   * revision it could have recorded, because `revise` had nowhere to write one.
   */
  readonly supersedesIterationId: string | null;
  /**
   * The continuo revision `startContinuo` **observed**, not the one the pin
   * expected.
   *
   * D-0015 rule 6 and D-0017 rule 5 deferred this field to "the issue that
   * gives rondo a store"; this is it. Committed *before* `run admit` is
   * spawned, so a crash between the two leaves a row naming the run id and the
   * build, which is what makes recovery possible at all.
   */
  readonly continuoRevision: string | null;
  /** cadenza's digests, committed at `classified`. */
  readonly agentTypeDigest: string | null;
  readonly configDigest: string | null;
  readonly contractDigest: string | null;
  /** cadenza's classification outcome and its own reason, unedited. */
  readonly classification: string | null;
  readonly classificationReason: string | null;
  /**
   * The continuo role the neutral name mapped to (D-0019 rule 13).
   *
   * Persisted beside cadenza's neutral name rather than instead of it, because
   * a mis-mapping onto a *valid* role is undetected at both ends and the only
   * way a person can ever notice one is by reading both.
   */
  readonly neutralRoleName: string | null;
  readonly continuoRole: string | null;
  /**
   * cadenza's model tier, and the model the lap actually ran on (D-0021).
   *
   * Both, for the reason both role columns exist: a tier is what an agent type
   * declared and a model id is what a lap cost, and the pair is the only place a
   * person can see which model a tier was worth on the day the lap ran. The
   * model is the value **continuo reported** rather than the one rondo selected;
   * they are checked against each other before this column is written, and
   * recording the request in place of the observation would make the check
   * unable to fail.
   */
  readonly modelTier: string | null;
  readonly model: string | null;
  /**
   * The gate `lap perform` opened, and where it stood when the row was last
   * written.
   *
   * `gateStage` is written at the suspend -- where continuo opens every gate,
   * `received` -- and again by each observation, so a row that names a gate
   * names a stage for it too (issue #21). A null stage beside a non-null id is
   * a row written before that was true, not a gate whose stage is unknown.
   * `gateOutcome` stays null until an observation finds one, because only a
   * terminal gate has one.
   */
  readonly gateId: string | null;
  readonly gateStage: string | null;
  readonly gateOutcome: string | null;
  /** The session the lap walked, and the walk's own name (not a path). */
  readonly sessionId: string | null;
  readonly sessionPath: string | null;
  /**
   * What the worker's fence refused, as continuo reported it with the lap (#88).
   *
   * **Three states, and no two of them may be read alike.** SQL `null` is rondo
   * holding no reading at all -- a row that never reached a suspend, or one
   * written before this column existed. The text `"null"` is continuo saying it
   * could not tell, and the text of an array is continuo saying what was
   * refused, `[]` included. `continuo D-1110` argues the last distinction and
   * this column exists to carry it: a screen that showed "we cannot tell whether
   * the verification ran" as "nothing was refused" is the mistake the key was
   * added for.
   *
   * continuo's own document rather than a rondo shape, for the reason
   * {@link plan} is stored verbatim: what a reader gets is the bytes rondo read,
   * and a re-encoding would be a second rendering to keep true.
   */
  readonly permissionDenials: string | null;
  /**
   * What the lap spent: dollars, turns, and the worker's own wall clock
   * (`D-0046`).
   *
   * **Three columns because they are three quantities.** `lapDurationMs` is the
   * turn's measured duration and is not a price: lap 3 of the dogfood ran well
   * inside its `invocationCeilingMs` and cost seven times lap 2 (`D-0044`).
   * Recording one of the three and deriving the others is what five dogfood
   * records had to do by hand, out of `events-000.jsonl`, because rondo kept
   * none of them (rondo#96).
   *
   * **`null` is "rondo did not read it", and zero is zero.** The value is read
   * off the worker's terminal `result` event at the suspend, and a transcript
   * that was missing or carried no such event leaves all three null -- a
   * different fact from a lap that cost nothing, which is why these are
   * nullable columns rather than counters defaulting to 0.
   */
  readonly lapCostUsd: number | null;
  readonly lapTurns: number | null;
  readonly lapDurationMs: number | null;
  /**
   * Why this iteration failed, stalled, or is asking for a withdrawal.
   *
   * One column for all three because the question a reader asks is the same --
   * "what happened here?" -- and the status already says which kind of answer
   * it is.
   */
  readonly reason: string | null;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
}

/**
 * The fields a transition may write beside the new status.
 *
 * A partial of the record minus the identity, the status and the timestamps:
 * the first two are the transition's own arguments and the last are the
 * store's to stamp from the clock the caller passed. Spelling it as a type
 * rather than accepting a loose object is what keeps a typo from being a
 * silently ignored column.
 *
 * **The three allocated identifiers are omitted too, and that is D-0023 rule 5
 * enforced by the type rather than by a comment.** `reserve()` writes them
 * inside the transaction that writes the row, and a transition that could
 * write them again would be a second authority for the fact the partial unique
 * indexes rest on -- a row could move its own claim off a name it had already
 * been admitted under. `identifiersSpent` stays writable because the one
 * transition into `admitting` is exactly what sets it.
 *
 * **`supersedesIterationId` is omitted for the same reason and a second one**
 * (D-0030 rule 2). It is fixed at reservation, so nothing later has anything
 * to say about it -- and a lineage a transition could write is a lineage that
 * can be composed after the fact, which is the difference between a record and
 * an assertion.
 */
export type IterationFields = Partial<
  Omit<
    IterationRecord,
    | "id"
    | "status"
    | "createdAtMs"
    | "updatedAtMs"
    | "runId"
    | "topicBranch"
    | "workspace"
    | "supersedesIterationId"
  >
>;

/**
 * What one independent reading of a lap's work concluded (D-0029).
 *
 * **The three verdicts are not a scale.** `clear` and `concerns` are what a
 * reading that happened says; `unavailable` is what the absence of a reading
 * says, and it is a first-class answer rather than a missing row -- because a
 * row that is simply absent and a row that says "nothing could be read" are the
 * same fact to a reader who never looks, and the whole point of D-0029 rule 10
 * is that `publish` treats them alike and a person can tell them apart.
 *
 * **`clear` is the only one that carries an obligation**, and it is the store's
 * to enforce: a `clear` may be written only beside rondo's own measurement of
 * what was read (D-0029 rule 11). See {@link LapReading.evidence}.
 */
export type ReadingVerdict = "clear" | "concerns" | "unavailable";

/**
 * rondo's own measurement of the work a reading was taken over.
 *
 * **Not the reader's account of what it read.** Every field here comes from
 * `git` as rondo ran it, which is what makes the row evidence rather than
 * testimony -- the distinction D-0029 rule 11 exists to draw, and the reason
 * the empty pass (a reviewer that read nothing and answered "no findings") is
 * detectable here at all.
 *
 * `tipCommit` is load-bearing twice over: it is half the evidence, and it is
 * the whole of the staleness check `publish` makes (D-0029 rule 10). A reading
 * is about the commits it read, and `publish` pushes the branch as it is then.
 */
export interface ReadingEvidence {
  /** The ref the range was taken from, as a name. */
  readonly baseRef: string;
  /** That ref resolved, so the range is identified and not merely named. */
  readonly baseCommit: string;
  /** The topic branch resolved: the commit `publish` would push. */
  readonly tipCommit: string;
  /** A digest over the material, so "the same work" is one comparison. */
  readonly materialDigest: string;
  readonly commitCount: number;
  readonly fileCount: number;
}

/**
 * One reading, as the store holds it. Immutable and append-only.
 *
 * There is no `status` column and no writer that updates: a row that could be
 * rewritten to `clear` would be a record of what somebody wished had been read
 * (D-0022 rule 4, applied to a second record kind by D-0029 rule 8).
 *
 * `drafter` names who produced it. It exists so that a model drafter's row and
 * the deterministic one are the *same* record kind rather than two -- D-0022
 * rule 13's grade, which is what lets a later entry admit a model reader
 * without a schema change.
 */
export interface LapReadingDraft {
  /** Who produced it: the deterministic reader today, a model drafter later. */
  readonly drafter: string;
  readonly verdict: ReadingVerdict;
  /** Empty on `clear`. One line each; never prose rondo composed about a person. */
  readonly findings: readonly string[];
  /** Null exactly when the verdict is `unavailable`. */
  readonly evidence: ReadingEvidence | null;
  /** Why nothing could be read. Null unless the verdict is `unavailable`. */
  readonly unavailableReason: string | null;
}

/**
 * A draft as the store holds it, once the row it is about has been named.
 *
 * The identity and the clock are added by the store rather than by the reader,
 * for the reason every other timestamp in this file is the caller's: the reader
 * has no business knowing which row it is being written beside, and a reading
 * that named its own iteration could name the wrong one.
 */
export interface LapReading extends LapReadingDraft {
  readonly iterationId: string;
  readonly readAtMs: number;
}

/**
 * What an operator says they did to check a lap's work before answering its
 * gate (#70).
 *
 * **It is a claim and the type says so, because rondo did not watch it
 * happen.** When a lap cannot verify itself the verification falls to the
 * person at the gate, who runs it in a terminal rondo has no view of. The one
 * fact rondo holds is that somebody typed a sentence saying what they ran, at
 * the moment they answered -- so that is what the row holds, attributed and
 * dated, and nothing here may be read as rondo's own observation (`D-0032`
 * rule 1: a claim is recorded beside its basis, and the basis of this one is
 * the operator's own word).
 *
 * **What it buys is a distinction the record could not make.** Before it, a
 * closed gate said "a person answered" and stopped; "a person who ran the suite
 * first" and "a person who read the diff" were the same row. The claim's
 * presence or absence separates them, and its absence is not evidence that
 * nothing was checked -- only that nothing was said.
 */
export interface OperatorVerificationClaim {
  readonly iterationId: string;
  readonly claimedAtMs: number;
  /** The person whose word this is -- the same actor that answered the gate. */
  readonly actorId: string;
  /** What they say they ran, in their own words, byte for byte as typed. */
  readonly claim: string;
}

/**
 * Who produced a reading when rondo's own deterministic reader did (D-0029
 * rule 5).
 *
 * **A version is in the string on purpose.** The row is append-only and
 * outlives the code that wrote it, so "which reader said this" has to be
 * answerable from the row alone; a bare `"deterministic"` would make every past
 * verdict appear to have been taken under today's rules.
 *
 * It lives beside the row rather than beside the reader because
 * {@link readingCoverage} is read from two layers that may not import each
 * other, and a second spelling of this string is a mislabelled row nobody would
 * notice.
 */
export const DETERMINISTIC_READING_DRAFTER = "rondo/deterministic/2";

/**
 * The same reader before D-0060, which read committed history only. Its rows
 * are still in stores, and still say what that reader covered.
 */
const DETERMINISTIC_READING_DRAFTER_V1 = "rondo/deterministic/1";

/**
 * What a reading by this drafter did *not* look at, said wherever it says what
 * it found (rondo#69).
 *
 * **The defect this answers is a claim of coverage, not a claim of authority.**
 * Every screen that prints a reading already labels it material rather than an
 * approval. On 2026-09-12 one of them printed `read and nothing raised`
 * directly beneath the worker's own account of not having been able to run the
 * verification at all, and only a human noticed that the two lines contradicted
 * each other: what a reader takes from "nothing raised" is that a check
 * happened, and the check that mattered most had not. D-0029 rule 9 had already
 * decided the reach -- *"green but not upholding it"* is in its list of what
 * this stage cannot catch, because no module under `src/` may run a test suite
 * -- and recorded it in a file nobody reads while a gate is open. This says it
 * where the claim is made.
 *
 * **Keyed by the drafter, because the rows outlive the reader.** A fixed line
 * would itself be a fixed claim about what some later reader looked at, which
 * is this same defect one turn on; so an unrecognised drafter -- a model one
 * under rule 6, or the `rondo/none` an absent reading is attributed to -- says
 * that its reach is not recorded rather than guessing at it.
 */
export function readingCoverage(drafter: string): readonly string[] {
  if (drafter !== DETERMINISTIC_READING_DRAFTER && drafter !== DETERMINISTIC_READING_DRAFTER_V1) {
    return Object.freeze([
      "What this reader looked at is not recorded, so nothing here says what it covered.",
    ]);
  }
  // Wrapped where a terminal would otherwise wrap it, in the shape the
  // neighbouring screens use: the caller indents these, and a sentence that ran
  // past the width would be the one line on the screen that folded.
  return Object.freeze([
    "It built nothing, ran nothing and tested nothing: rondo cannot run a lap's work.",
    "Whether the verification this lap was asked for ran is neither checked nor claimed here.",
    drafter === DETERMINISTIC_READING_DRAFTER_V1
      ? "It read committed history only, and it cannot tell whether the lap did what was asked."
      : "It read committed history and git status, and cannot tell whether the lap did what was asked.",
  ]);
}

/**
 * The five voices a proposal may speak in (D-0022 rule 4's closed union).
 *
 * A closed union rather than free text because an unrecognised kind is a row
 * the reader refuses rather than guesses at, and because D-0032 rule 5 makes
 * this column the **only** thing that decides whether a proposal can be
 * answered at all. Written once, here, for the reason
 * {@link TERMINAL_STATUSES} is: the set has one spelling, and
 * {@link APPROVABLE_PROPOSAL_KINDS} is a subset of it the compiler checks.
 */
export const PROPOSAL_KINDS = Object.freeze([
  "agent_type",
  "run_plan",
  "contract_keys",
  "widening_successor",
  "explanation",
] as const);

export type ProposalKind = (typeof PROPOSAL_KINDS)[number];

/**
 * The four kinds a human may answer, and the whole of D-0032 rule 5's authority
 * rule.
 *
 * **`explanation` is the one that is absent, and its absence is the rule.** An
 * explanation binds nothing, ever: it is the third voice, and D-0032 rule 8
 * keeps explaining and reviewing apart so that *"it was explained well"* can
 * never come to function as *"it passed"*.
 *
 * **There is deliberately no `approvable` column** (D-0032 rule 5, for `A-11`'s
 * reason). Two authorities with no precedence is not stricter, it is
 * unanswerable: a row whose `kind` says `explanation` and whose flag says
 * approvable has no rule for which wins. And a flag can be flipped by a writer
 * that meant well, where a closed union plus a writer refusal cannot.
 *
 * **`drafter` is excluded on purpose**, for D-0022 rule 13's reason: the record
 * is identical whichever drafter produced it, and authority that followed
 * `drafter` would reverse that rule by implication the first time a model
 * drafted an approvable kind.
 */
export const APPROVABLE_PROPOSAL_KINDS = Object.freeze([
  "agent_type",
  "run_plan",
  "contract_keys",
  "widening_successor",
] as const satisfies readonly ProposalKind[]);

/**
 * Whether a human decision may name this kind at all.
 *
 * Total over `string` rather than over {@link ProposalKind}, because the value
 * it is asked about comes out of a database column and a row a person edited
 * with `sqlite3` is one edit away from any string. An unrecognised kind is not
 * approvable, which is the same answer D-0022 rule 4's reader refusal gives and
 * is reached here without a second spelling of the union.
 */
export function isApprovableKind(kind: string): kind is ProposalKind {
  return (APPROVABLE_PROPOSAL_KINDS as readonly string[]).includes(kind);
}

/**
 * One proposal, as the caller hands it to the store (D-0022 rule 4).
 *
 * Immutable and append-only once written: there is no `status` column and no
 * writer that updates, which is the grade D-0022 rule 4 claims and the reason a
 * proposal that was never approved stays readable for ever as the thing that
 * was not taken.
 *
 * **`payload` carries the alternatives and the recommendation, and it is one
 * document rather than sibling rows** (D-0032 rule 1). The store holds it
 * verbatim beside a digest of those bytes and never reads into it, exactly as
 * it holds a plan: a group of option rows can be half-written, so a reader
 * could see a recommendation without the options it was chosen against -- and
 * the framing #39 identifies as the hazard *is* the set of alternatives, so
 * splitting it across rows would make the framing the one part of the proposal
 * `proposalDigest` does not cover.
 *
 * **There is no rendered `summary`, and its absence is D-0032 rule 3.** What a
 * gate shows is composed at render time from the option set and its bases; a
 * stored summary is a framing that outlives the material it was drawn from and
 * can drift from it silently.
 *
 * **`candidateContractDigest` is absent rather than nullable**, which is
 * D-0022 rule 4's "null on a proposal, always" taken at its word: a digest here
 * would be the advisory claiming to have composed something. The column exists
 * in the schema under a `CHECK` that keeps it null, so the claim is enforced
 * rather than merely written down, and no field here can fill it.
 */
export interface ProposalDraft {
  /** The reference every other row uses. Minted by the caller. */
  readonly proposalId: string;
  readonly kind: ProposalKind;
  /** Who or what drafted it (D-0022 rule 13), as an identifier and never as an authority. */
  readonly drafter: string;
  /** The ordered option set, verbatim (D-0032 rule 1). */
  readonly payload: JsonRecord;
  /**
   * The snapshot the advisory was handed, **verbatim**, so a proposal can be
   * re-derived and not only re-read (D-0022 rule 4).
   *
   * It is also what makes D-0032 rule 2 affordable: a basis that points into
   * this snapshot renders inline with no copy and no second source of truth,
   * because the material the advisory actually read is in the row. The snapshot
   * **never carries a gate answer's body** -- that fact's one home is continuo.
   */
  readonly snapshot: JsonRecord;
  /**
   * How an `explanation` was derived, and null for every other kind
   * (D-0032 rule 8).
   *
   * A diagram drawn from identifier names and one derived from call structure
   * or from tests that actually ran render identically, and without this the
   * reader cannot spot-check -- fluency reads as understanding. It is a closed
   * union whose **members** D-0032 leaves to the entry that admits a model
   * explainer, so the store holds the string and the schema holds only the one
   * property the entry fixed: non-null exactly when `kind` is `explanation`.
   */
  readonly derivation: string | null;
  /** The lineage of `advisory.md` sections 6.2 and 7. */
  readonly iterationId: string | null;
  readonly supersedesIterationId: string | null;
  readonly supersedesProposalId: string | null;
  /** What the diff or the widening is *against*, so a later reader is not diffing an unknown. */
  readonly predecessorPlanDigest: string | null;
  readonly predecessorContractDigest: string | null;
  /** The three cadenza digests the referenced iteration was classified under. */
  readonly agentTypeDigest: string | null;
  readonly configDigest: string | null;
  readonly contractDigest: string | null;
  /** The observed continuo build, and the pin the facade was compiled against. */
  readonly continuoRevision: string | null;
  readonly cadenzaRevision: string | null;
  /**
   * The message an operator elevated into this proposal, and who elevated it
   * (D-0032 rule 7). **Null together**, and the schema holds that.
   *
   * #41's chain -- observation, elevation, proposal, approval, contract -- has
   * one link nothing recorded, and it is the link where authority enters: an
   * observation constrains nothing until a human takes it up. There is no new
   * table because the observation already has a home (`D-0020` rule 5), and the
   * one constraint D-0032 places on that unwritten schema is that the message
   * id be durable and immutable.
   */
  readonly elevatedFromMessageId: string | null;
  readonly elevatedByActorId: string | null;
  /** The caller's clock, never the store's. */
  readonly createdAtMs: number;
}

/**
 * The contract the human was **shown**, written before it is presented
 * (D-0022 rule 18).
 *
 * A proposal carries candidate *inputs*; the contract on the screen is a
 * different fact with a different author, and it must outlive both a refusal
 * and a crash -- otherwise a refused widening leaves a ledger recording which
 * keys were suggested and not which contract was presented. Immutable, like
 * everything else in `advisory.md` 6.2.
 */
export interface CompositionDraft {
  readonly compositionId: string;
  /** The proposal whose candidate inputs this was composed from. */
  readonly proposalId: string;
  /** The `DelegationContract`'s fields **as issued**, verbatim, so the digest can be recomputed. */
  readonly contract: JsonRecord;
  /**
   * The digest of the contract as cadenza computed it.
   *
   * The caller's rather than the store's: the digest a human approves is
   * cadenza's own, and a second one taken here over a different rendering would
   * be a second authority for the one value `D-0020` rule 4 fact 1 says must be
   * recomputable rather than trusted.
   */
  readonly contractDigest: string;
  /** The predecessor this supersedes, where there is one. */
  readonly supersedesContractDigest: string | null;
  /** The cadenza pin that composed it -- the pin's mobility is a fact, not a forecast. */
  readonly cadenzaRevision: string;
  readonly composedAtMs: number;
}

/**
 * What a person answered, and it is a fact about a person (D-0032 rule 6).
 *
 * **`declined` is a row rather than an absence**, which is the whole of the
 * rule: without it #41's inbox cannot tell what is waiting on the operator from
 * what the operator has already settled. A declined decision writes no
 * `decision_consumption` row and no delegation row, which is what D-0022
 * rule 18 already assumes when it says the composition must outlive a refusal.
 */
export type DecisionOutcome = "approved" | "declined";

/**
 * One human decision, immutable and single-use (D-0022 rule 9).
 *
 * The row is never updated. Single use is a `decision_consumption` row whose
 * primary key is the decision id, taken in the same `BEGIN IMMEDIATE` as the
 * issuance it authorises -- a second attempt collides on the primary key and is
 * refused by the database rather than by a check somebody remembered to write
 * (`advisory.md` 6.3).
 *
 * **It does not carry #40's count of what reached the operator** (D-0032
 * rule 6): an answer is a fact about a person and a presentation is a fact
 * about the surface, and {@link OperatorAttention} holds the second.
 */
export interface HumanDecisionDraft {
  readonly decisionId: string;
  /**
   * The proposal answered, and the whole of what D-0032 rule 5 refuses on.
   *
   * The writer reads this row's `kind` inside its own transaction and refuses
   * the decision when the kind is one an answer cannot bind -- so authority is
   * a function of `kind` alone, enforced where a restart cannot argue with it.
   */
  readonly proposalId: string;
  readonly outcome: DecisionOutcome;
  /**
   * The `composition.contract_digest` the person approved, and null on a
   * `declined`.
   *
   * A reference into the composition table rather than a copy of the contract,
   * so *"what did the human actually see"* is answerable without a delegation
   * row existing at all.
   */
  readonly approved: string | null;
  /** The predecessor digest the approved contract supersedes, or null. */
  readonly predecessor: string | null;
  /** The approver: an OIDC subject on rondo's allowlist (`D-0020` rule 2). */
  readonly actorId: string;
  /** The surface's own identity, which is not the approver's. */
  readonly recordedBy: string;
  /**
   * continuo's transition, on route G, and null together on route S.
   *
   * A reference and never a copy: the body is continuo's and `A-8` gives that
   * fact exactly one home (`advisory.md` 5.1). Route S has no gate to name, and
   * inventing one would be rondo manufacturing the appearance of a question a
   * run never asked.
   */
  readonly gateId: string | null;
  readonly gateTransitionSeq: number | null;
  readonly decidedAtMs: number;
}

/** Whether a subject was put in front of the operator, or kept from them. */
export type AttentionDisposition = "presented" | "withheld";

/**
 * One row of both sides of the silence (D-0032 rule 10).
 *
 * **One table rather than two, because the numerator and the denominator have
 * to come from the same place.** A withheld-only table makes the count of what
 * *was* put to the operator somebody else's problem, and the only candidate is
 * {@link HumanDecisionDraft}, which counts answers and not presentations: with
 * six proposals on the screen and none answered yet it reports zero.
 *
 * **A row rather than a column on the thing presented**, for two reasons. The
 * most common withholding has nothing to carry a column -- it was never
 * composed into a proposal at all, which is why {@link subjectId} is nullable.
 * And a `presented_at_ms` written onto a proposal row would be an update to a
 * record D-0022 rule 4 makes immutable. `admission_refusal` is the precedent
 * and the shape is deliberately its.
 *
 * **What this cannot prove, stated rather than implied**: a suppression that
 * writes no row is invisible here, so the table bounds the *accountable*
 * silence and not the total.
 *
 * **A presentation is counted once per subject, not once per render** (D-0036
 * rule 1). A second `presented` row for a `(subjectKind, subjectId)` already
 * counted stores nothing and reports `recorded`. So *when* a subject was first
 * shown is preserved and *how often* is not, and the missing count is not
 * recoverable from this table afterwards.
 */
export interface OperatorAttention {
  readonly atMs: number;
  /** What sort of thing this was: a proposal, an iteration, a reading. */
  readonly subjectKind: string;
  /** Its id, or null when nothing was ever composed to have one. */
  readonly subjectId: string | null;
  readonly disposition: AttentionDisposition;
  /**
   * The policy behind a withholding. **Required on a `withheld` row, and it is
   * the point of the table.**
   *
   * *"Suppressed 40"* is a number; *"suppressed 40, of which 31 by the
   * duplicate-delivery rule"* is a record. A withholding whose rule cannot be
   * named is a judgement with no policy behind it, and the writer refuses it.
   */
  readonly ruleName: string | null;
}

/**
 * An approval that was never spent (D-0022 rule 19's acceptance criterion).
 *
 * Under D-0022 rule 17 an approved plan that is never admitted leaves no trace
 * anywhere else: cadenza holds nothing, continuo was never told, and the
 * iteration that would have carried it does not exist. Without this query,
 * *"the human approved something that never ran"* is a state the ledger cannot
 * report.
 *
 * A `declined` decision is **not** listed, and that is rule 6 rather than a
 * filter chosen here: a refusal consumes nothing by design, so listing one as
 * an unspent approval would report every refusal as an outstanding issuance.
 */
export interface UnconsumedDecision {
  readonly decisionId: string;
  readonly proposalId: string;
  /** The digest that was approved and never issued against. */
  readonly approved: string;
  readonly actorId: string;
  readonly decidedAtMs: number;
}

/**
 * One proposal nobody has answered (D-0032 rule 6, #41 section 1).
 *
 * **The question `human_decision` cannot be asked directly.** Rule 6 makes
 * *declined* a row rather than an absence, so "what is still waiting on the
 * operator" is the proposals with no decision row at all -- and that is the
 * numerator of #41's inbox, not of its accounting.
 *
 * `kind` travels because authority is a function of it alone (D-0032 rule 5):
 * the screen separates the voice that becomes a contract from the voice that
 * binds nothing, and it must do that without reading anybody's prose.
 */
export interface OpenProposal {
  readonly proposalId: string;
  readonly kind: string;
  /** The iteration it is about, or null for a proposal about no row. */
  readonly iterationId: string | null;
  readonly createdAtMs: number;
}

/**
 * What stands against the two bounds right now (D-0037 rule 3c).
 *
 * **Read off the generated columns the bounds are defined against**, and that
 * is D-0023 rule 8 rather than a convenience: `maxOccupying` counts the
 * `occupying` column and `maxLive` counts `live`, so "the bound and the column
 * are one definition". A caller that re-derived either from a status set it
 * spelled itself would be a second definition of a bound, and the first time
 * the two disagreed the screen would report a host at a capacity it is not at.
 */
export interface Occupancy {
  readonly occupying: number;
  readonly live: number;
}

/**
 * One admission a bound refused (D-0023 rule 14), as a reader gets it back.
 *
 * **The only row in the store that records work deliberately not started**:
 * a refusal costs no `iteration` row at all, so without this table the fact
 * that somebody asked and was told no is not recoverable from anywhere.
 *
 * `boundName` is a plain string rather than {@link AttentionDisposition}'s kind
 * of closed union, for `OpenProposal.kind`'s reason: a bound name this rondo
 * does not know is still a refusal an operator was given, and the screen
 * reports it rather than dropping it.
 */
export interface AdmissionRefusal {
  readonly refusedAtMs: number;
  readonly request: string;
  readonly boundName: string;
  readonly bound: number;
  readonly occupancy: number;
}

/**
 * One line of the silence (D-0032 rule 10, #41 section 5).
 *
 * *"Six were put to you, forty were not, here is the breakdown"* is one
 * `GROUP BY` over one table, and this is one of its rows. `ruleName` is null on
 * the presented side, where there is no policy to name, and non-null on the
 * withheld side, where the writer refuses a row without one.
 */
/**
 * The interval one breakdown answers over (D-0037 rule 6).
 *
 * **A `WHERE` clause rather than a column, and rather than a second table.**
 * #40 asks that an operator be able to reconstruct what was withheld from them
 * *in a given interval*; `operator_attention` already carries `at_ms` on every
 * row and is append-only, so the material was there and only the query was
 * missing. A stored count would be a second home for a fact the rows already
 * hold.
 *
 * **Both bounds are inclusive, and both may be null**, which is the shape every
 * other bound in this store has: `changedSince` includes the mark because a row
 * bearing exactly it may or may not have been displayed, and `openProposals`
 * includes its upper bound because that is the moment the render wrote about.
 * A null bound is "unbounded on that side", so an interval with two nulls is
 * the count over all of time -- the answer this enumeration gave before it
 * could be asked anything narrower.
 *
 * **What this cannot prove is unchanged** (D-0032 rule 10's own residue): a
 * suppression that writes no row is invisible here, so an interval bounds the
 * *accountable* silence and not the total.
 */
export interface AttentionInterval {
  readonly fromMs: number | null;
  readonly toMs: number | null;
}

export interface AttentionCount {
  readonly disposition: AttentionDisposition;
  readonly ruleName: string | null;
  readonly count: number;
}

/**
 * One record that landed at or after a mark (D-0032 rule 11's third query).
 *
 * A pointer rather than a record, for {@link UnconsumedDecision}'s opposite
 * reason: the question *"what changed since I last looked"* is a count and a
 * list to go look at, and returning eight row shapes as a union would make one
 * row that will not decode able to break the census of the rows that do.
 */
export interface RecordChange {
  /** Which table it came from. */
  readonly kind: string;
  /** Its own reference, or null for a row whose subject never had one. */
  readonly id: string | null;
  /** The caller's clock, as that record kind spells it. */
  readonly atMs: number;
}

/**
 * One proposal read back out of the store, so that a person can answer it
 * later than the moment it was drafted (#39).
 *
 * **The fields are the row's, and the screen is composed from them** (D-0032
 * rule 3). What makes this worth a reader at all is that `payload` and
 * `snapshot` are the two the store holds **verbatim**: the options, the
 * recommendation and every basis are in the first, and the material a
 * `snapshot` basis points into is in the second. Without a reader over those
 * two, #39's answerable shape exists only in the terminal the drafter printed
 * it to, and a gate is answerable exactly once.
 *
 * **`kind` is not decoded against {@link PROPOSAL_KINDS}**, for
 * {@link OpenProposal}'s reason: a kind this rondo does not know is still a row
 * an operator is waiting on, and the reader that decides what may be *approved*
 * is `recordDecision` rather than this one.
 *
 * **`decisions` is the rows and not a boolean**, because D-0032 rule 6 makes
 * *declined* and *never answered* different facts. A screen that showed only
 * whether an answer exists would put the same word on a proposal the operator
 * settled and one nobody has looked at.
 *
 * **It is a list, and the schema is why.** Nothing makes `human_decision`
 * unique per `proposal_id`: the one uniqueness the table carries is over a
 * continuo gate transition, and a route-S answer names none. So a decline and
 * a later approval are two rows, and a reader that returned the first would
 * report a proposal as refused while `unconsumedDecisions` reports a spendable
 * approval against it. Every answer is read, oldest first, and the screen shows
 * them all.
 */
export interface StoredProposal {
  readonly proposalId: string;
  readonly kind: string;
  readonly drafter: string;
  /** The ordered option set or the claim list, verbatim (D-0032 rule 1). */
  readonly payload: JsonRecord;
  /** What the advisory read, verbatim: what a `snapshot` basis resolves against. */
  readonly snapshot: JsonRecord;
  readonly derivation: string | null;
  readonly iterationId: string | null;
  readonly elevatedFromMessageId: string | null;
  readonly elevatedByActorId: string | null;
  readonly createdAtMs: number;
  /**
   * The pin that composed this proposal's contracts, and null on an
   * `explanation` (D-0022 rule 18).
   *
   * **Read back so a re-gather at render time can say when it differs**
   * (`D-0038` rule 5): a re-gather run under a different cadenza than the one
   * that composed this row would report every candidate's digest as moved for
   * a reason that has nothing to do with the material, so the screen states
   * the pin difference once rather than as noise on every option.
   */
  readonly cadenzaRevision: string | null;
  /** What people answered, oldest first, and empty while nobody has (D-0032 rule 6). */
  readonly decisions: readonly StoredDecision[];
}

/** One answer, as the ledger holds it (D-0022 rule 9, D-0032 rule 6). */
export interface StoredDecision {
  readonly decisionId: string;
  readonly outcome: string;
  /** The contract digest an approval names, and null on a refusal. */
  readonly approved: string | null;
  readonly actorId: string;
  readonly decidedAtMs: number;
}
