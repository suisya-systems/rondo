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
  /** `lap perform` is in flight. The one step that takes minutes. */
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
  /** The run id continuo was asked to admit. From the plan, so known early. */
  readonly runId: string | null;
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
  /** The gate `lap perform` opened, and where it stands when last observed. */
  readonly gateId: string | null;
  readonly gateStage: string | null;
  readonly gateOutcome: string | null;
  /** The session the lap walked, and the walk's own name (not a path). */
  readonly sessionId: string | null;
  readonly sessionPath: string | null;
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
 */
export type IterationFields = Partial<
  Omit<IterationRecord, "id" | "status" | "createdAtMs" | "updatedAtMs">
>;
