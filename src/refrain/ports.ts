/**
 * What the conductor is handed, in the conductor's own vocabulary.
 *
 * This module is D-0019 rule 1. The interpreter needs *effects* -- a verified
 * continuo, an admitted run, a walked lap, an observed gate -- and an effect
 * can arrive as an injected port whose type is declared here rather than as an
 * import that crosses a layer. So `src/refrain -> src/continuo` stays refused,
 * `src/refrain/`'s external allowance stays empty, and `test/refrain/` needs no
 * continuo build, no `spawn` and no network. The composition root in
 * `src/access/conductor.ts` is what wires the real thing in.
 *
 * **The cost, named rather than hidden.** These result types are a second
 * vocabulary beside `src/continuo/protocol.ts`'s outcomes, and somebody has to
 * translate. That cost is already paid by an accepted decision: D-0015 rule 2
 * says nothing typed crosses the process boundary and D-0017 rule 8 says no
 * continuo type leaves the layer, so a translation into rondo's own records
 * exists whichever way this went.
 *
 * **Four outcomes, not five, and the fourth is why this union exists at all.**
 * The continuo layer answers in five, and folding them into three would have
 * lost the distinction the single-flight invariant turns on: an effect that
 * *answered* -- even to refuse -- is an effect whose child is over, and an
 * effect that answered *nothing* may still have one running. D-0019 rule 12
 * measures why: rondo's ceiling kills the CLI and not the fenced child. So
 * `refused` and `defect` release the lock and `noAnswer` keeps it, and the
 * interpreter reads exactly that difference.
 */
import type {
  IterationFields,
  IterationRecord,
  IterationStatus,
  JsonRecord,
} from "../store/records.js";
import type { AdmittedPlan } from "./plan.js";

/**
 * What one effect produced.
 *
 * `refused` carries continuo's own words, which rondo relays and never parses
 * (D-0015 rule 7). `defect` is rondo's fault and an operator should never have
 * been shown it. `noAnswer` is the one that is neither: nothing came back, so
 * rondo knows nothing about what is or is not still running.
 */
export type EffectOutcome<T> =
  | { readonly kind: "answered"; readonly value: T }
  | {
      readonly kind: "refused";
      readonly message: string;
      /**
       * The session the refused effect was about, when it named one.
       *
       * **A fact rondo may act on, carried beside words rondo may only relay.**
       * `message` is written for a person and is free to be reworded by any
       * later continuo commit; the identity is a field, and D-0015 rule 7 is
       * the standing rule that the first may never be mined for the second.
       * Absent means the effect named no session, and the interpreter writes
       * nothing rather than a value it inferred.
       *
       * Optional on the shared union rather than on a lap-only one, because the
       * translation into this vocabulary is a single generic function in the
       * composition root (`asEffect`) and a second union would make the lap the
       * one effect that had to go round it. Only `performLap` can carry a value
       * today: continuo's envelope has exactly one verb that names its session
       * on a refusal (`continuo D-1102`).
       */
      readonly sessionId?: string;
    }
  | { readonly kind: "defect"; readonly reason: string }
  | { readonly kind: "noAnswer"; readonly reason: string };

/** What `startContinuo` hands back: the revision it *observed* (D-0015 rule 6). */
export interface ContinuoStarted {
  readonly revision: string;
}

/** What `run admit` hands back, cut to what an iteration row records. */
export interface RunAdmission {
  readonly runId: string;
  readonly status: string;
  /** The continuo role the neutral name mapped to (D-0019 rule 13). */
  readonly continuoRole: string;
}

/**
 * What `lap perform` hands back.
 *
 * `sessionPath` is the walk's own name -- `started`, `respawned`, `resumed` --
 * and **not a filesystem path**. continuo's own header says so, and a record
 * that named it a path would mislead every reader downstream.
 */
export interface LapPerformance {
  /**
   * The run the lap says it walked.
   *
   * Carried so the interpreter can check it against the run the plan named,
   * exactly as it checks `run admit`'s answer and `gate show`'s. Without it the
   * gate id would be the only thing to come back from the one step that takes
   * minutes, with no identity to compare -- and a schema-valid payload about a
   * different run would attach *that* run's gate to this iteration, which a
   * later `resume()` would then close on.
   */
  readonly runId: string;
  readonly gateId: string;
  readonly sessionId: string;
  readonly sessionPath: string;
  readonly endpointLeaseFailure: string | null;
  readonly elapsedDeadlineAtMs: number | null;
  /**
   * The model the lap **ran on**, as continuo reported it, or null when the
   * choice fell through to the worker CLI's own default.
   *
   * An observation and not rondo's request; {@link requestedModel} is the
   * request, and the interpreter compares the two.
   */
  readonly model: string | null;
  /**
   * The model rondo **asked for**: what the executor-policy adapter selected for
   * the plan's model tier, and null only when the port refused before driving.
   *
   * Carried beside the answer for `runId`'s reason, one step further out: an
   * identity rondo sent back beside the identity that came back is the only way
   * a caller can tell "the lap ran what I asked for" from "the lap ran, and I do
   * not know on what". The two values are the interpreter's to compare, exactly
   * as it compares the run id it planned against the run id the lap names.
   */
  readonly requestedModel: string | null;
}

/** What `gate show` hands back. `outcome` is null exactly while the gate is open. */
export interface GateObservation {
  readonly gateId: string;
  readonly stage: string;
  readonly outcome: string | null;
}

/**
 * What the classifier answered, in cadenza's own words.
 *
 * `outcome` is cadenza's `allowed` / `needs_approval` / `refused` and `reason`
 * is cadenza's reason, neither translated: rondo reads the answer and never
 * re-derives it (D-0018 rule 7).
 */
export interface ClassificationRecord {
  readonly outcome: string;
  readonly reason: string;
  readonly agentTypeDigest: string;
  readonly configDigest: string;
  readonly contractDigest: string;
  readonly neutralRoleName: string;
  /**
   * cadenza's `executorPolicy.modelTier`, neutral and unmapped.
   *
   * Read here and mapped in the continuo layer, for `neutralRoleName`'s reason:
   * a concrete model id is the invocation adapter's vocabulary and not
   * cadenza's, and the loop never names one (D-0021).
   */
  readonly modelTier: string;
}

/**
 * Why a reservation did not happen.
 *
 * `atCapacity` is the capacity refusal and is an ordinary answer rather than a
 * fault: a host already at its bound says so, and the caller tries again when
 * something ends. It replaces D-0019's `occupied`, whose single
 * `liveIterationId` named the one blocking row -- an answer that only means
 * anything while the bound is one.
 */
export type ReserveOutcome =
  | { readonly kind: "reserved"; readonly record: IterationRecord }
  | {
      readonly kind: "atCapacity";
      readonly bound: BoundName;
      readonly limit: number;
      readonly occupancy: number;
    }
  | { readonly kind: "defect"; readonly reason: string };

/** Which of the host's two bounds an admission was refused by (D-0023 rule 8). */
export type BoundName = "maxOccupying" | "maxLive";

/** Why a transition did not happen. */
export type TransitionOutcome =
  | { readonly kind: "transitioned"; readonly record: IterationRecord }
  /** The row was not in the status the caller asserted. The closed edge
   *  relation, enforced where it can actually be enforced. */
  | { readonly kind: "unexpectedStatus"; readonly found: IterationStatus }
  | { readonly kind: "missing" }
  | { readonly kind: "defect"; readonly reason: string };

/**
 * What a read found: the record, no row at all, or a row that will not decode.
 *
 * The third arm is the point, and it is why this union exists rather than
 * `IterationRecord | null`. A store that *threw* on a row it cannot decode made
 * `stalled` -- which `records.ts` defines as existing precisely for "a corrupt
 * row, an effect result the union does not cover, a status the interpreter does
 * not recognise" -- unreachable, because every caller that would have driven the
 * iteration there rejected before it could. The row meanwhile still counts as
 * live under the partial unique index, so the single-flight lock stayed held by
 * a row nothing could name. `unreadable` is that state given a name the machine
 * can act on, and it carries the id so the answer can say which row.
 */
export type ReadOutcome =
  | { readonly kind: "read"; readonly record: IterationRecord }
  | { readonly kind: "absent" }
  | { readonly kind: "unreadable"; readonly id: string; readonly reason: string };

/** Whether the status-blind termination of {@link StorePort.settle} landed. */
export type SettleOutcome =
  | { readonly kind: "settled" }
  | { readonly kind: "missing" }
  | { readonly kind: "defect"; readonly reason: string };

/**
 * The durable surface, as the loop is allowed to see it.
 *
 * `read`/`write` is gone (D-0019 rule 10): a write that takes a whole record
 * cannot express "only if the row is still `admitted`", and an in-memory mutex
 * cannot survive a restart. What replaces it is two operations with
 * transactions inside them, and a reader.
 *
 * Asynchronous on the port even though the SQLite implementation is
 * synchronous, because the port is what a fake, a future connection pool or a
 * store on another process all have to satisfy, and a synchronous signature
 * would be the one shape none of them could take later without changing every
 * caller.
 *
 * This interface and the four outcome unions above are stated here **and** in
 * `src/store/sqlite.ts`, structurally identically. They are two statements of
 * one contract -- the store's is the canonical one, because it is the
 * implementation, and this one is a description of it written in the loop's
 * vocabulary so that the loop can be handed a fake instead (D-0019 rule 1).
 * `src/access/conductor.ts` is where the two are checked against each other:
 * assigning an `IterationStore` to a `StorePort` there is a compile error the
 * moment they drift. Neither file imports the other, because `src/refrain` may
 * not depend on the store's implementation and the store layer names only
 * itself, which is what `test/architecture/import-boundaries.test.ts` enforces.
 */
export interface StorePort {
  /**
   * Commit the `planned` row, or say that a non-terminal iteration exists.
   *
   * The refusal is the database's, not a promise: see the partial unique index
   * in `src/store/sqlite.ts`.
   */
  reserve(input: ReserveInput): Promise<ReserveOutcome>;
  /** Assert the current status, then write the new one with its fields. */
  transition(
    id: string,
    from: IterationStatus,
    to: IterationStatus,
    fields: IterationFields,
    nowMs: number,
  ): Promise<TransitionOutcome>;
  /**
   * One iteration by id -- total, and that totality is load-bearing.
   *
   * It answers `absent` when there is no such row and `unreadable` when there is
   * one that will not decode; it does not reject for either. The totality
   * belongs to the store rather than to a `try`/`catch` here because the store
   * is the thing that knows the *row* did not decode -- the interpreter could
   * only observe that something threw, and would have to guess whether it was a
   * corrupt row or a connection that is gone. Those two want opposite
   * responses: one is an iteration to stall and settle, the other is a process
   * that should stop.
   */
  read(id: string): Promise<ReadOutcome>;
  /**
   * Every non-terminal iteration, oldest first (D-0023 rule 15).
   *
   * Plural because under a bound above one there is no such thing as *the* live
   * iteration, and a singular answer would have been an arbitrary row. Each
   * element is a {@link ReadOutcome} rather than a record so that one row that
   * will not decode does not make the rest unreadable.
   */
  readLive(): Promise<readonly ReadOutcome[]>;
  /**
   * Terminate a row by id alone, without decoding it.
   *
   * **A narrow, single-purpose licence, and the only write on this port that
   * does not assert the status it is leaving.** Every other write does, because
   * the closed edge relation of D-0019 rule 6 is the design's safety property
   * and `transition` is where it is enforced against a second writer. But a row
   * whose status cannot be read has no status to assert, and refusing to write
   * it is exactly what wedges the conductor: the row stays non-terminal, so
   * `reserve` answers `occupied` forever and no path exists to end it. This is
   * the floor beneath D-0019 rule 11's table, whose last row is an operator's
   * `abandon()`.
   *
   * Reachable **only** from the interpreter's `abandon()`, and only when `read` answered
   * `unreadable`. Nothing else may call it: a caller that can name the status
   * has `transition`, and using this instead would trade the invariant for a
   * convenience.
   */
  settle(id: string, reason: string, nowMs: number): Promise<SettleOutcome>;
}

/** Everything `reserve` needs to write the first row. */
export interface ReserveInput {
  readonly id: string;
  readonly request: string;
  /** The plan as the loop rendered it; the store digests these bytes. */
  readonly plan: JsonRecord;
  /**
   * The triple the allocator minted for this iteration (D-0023 rule 5).
   *
   * Written by `reserve()` in the same transaction as the row, because the
   * claim is what makes a second admission safe and a claim committed after the
   * row is a claim with a window in it.
   */
  readonly runId: string;
  readonly topicBranch: string;
  readonly workspace: string;
  readonly nowMs: number;
}

/**
 * Everything the interpreter is handed.
 *
 * Every field is a function or a record, and none of them is a module: that is
 * the whole point of the file. `now` is a port for the same reason the store
 * does not read the clock -- a conductor whose time cannot be controlled from a
 * test is a conductor whose deadlines cannot be tested.
 */
export interface ConductorPorts {
  readonly store: StorePort;
  readonly now: () => number;
  /**
   * Resolve the project, build the agent-type record, issue the initial
   * contract and classify the intended action -- cadenza's four calls, as one
   * port because they are one step of the arc (D-0019 rule 15) and because
   * their intermediate values are cadenza's rather than rondo's.
   *
   * It answers rather than refuses: `classify()` is total and pure, so
   * `refused` and `needs_approval` arrive as values here and the *interpreter*
   * is what turns them into terminal `abandoned`.
   */
  readonly classify: (plan: AdmittedPlan) => Promise<EffectOutcome<ClassificationRecord>>;
  readonly startContinuo: () => Promise<EffectOutcome<ContinuoStarted>>;
  readonly admitRun: (
    plan: AdmittedPlan,
    neutralRoleName: string,
  ) => Promise<EffectOutcome<RunAdmission>>;
  readonly performLap: (
    plan: AdmittedPlan,
    modelTier: string,
  ) => Promise<EffectOutcome<LapPerformance>>;
  readonly showGate: (
    plan: AdmittedPlan,
    gateId: string,
  ) => Promise<EffectOutcome<GateObservation>>;
}
