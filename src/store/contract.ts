import type { AskFrequencyRow } from "./ask-frequency.js";
import type { DecisionRow } from "./decision-log.js";
import type {
  AdmissionRefusal,
  AttentionClaim,
  AttentionCount,
  AttentionInterval,
  CompositionDraft,
  FlowAnswerDraft,
  FlowAskDraft,
  FlowStopDraft,
  GateAnswer,
  GoalDraft,
  HumanDecisionDraft,
  IterationFields,
  IterationRecord,
  IterationStatus,
  JsonRecord,
  JsonValue,
  LaneClaimAsk,
  LaneHolder,
  LapReading,
  LapReadingDraft,
  Occupancy,
  OpenAsk,
  OpenProposal,
  OperatorAttention,
  OperatorVerificationClaim,
  PerformingLap,
  ProposalDraft,
  RecordChange,
  RequestOpener,
  ScopeDecisionDraft,
  ScopeDraft,
  ScopeRefusal,
  ScopeSpent,
  SetupPlanDraft,
  StoredFlowAsk,
  StoredFlowStop,
  StoredGoal,
  StoredProposal,
  StoredScope,
  StoredScopeDecision,
  StoredSetupPlan,
  StoredTranslation,
  StoredTriage,
  StoredTriageDecline,
  ThreadMessageDraft,
  TranslationDraft,
  TriageDeclineDraft,
  UnconsumedDecision,
  WithheldByRule,
  WRITABLE_SCOPE_ACT_KINDS,
} from "./records.js";
import type { StandingPolicyDraft, StoredStandingPolicy } from "./standing-policy.js";

/**
 * Everything `reserve` needs to write the first row.
 *
 * This type and the outcome unions below are stated here **and** in
 * `src/refrain/ports.ts`, structurally identically. They are two statements of
 * one contract, and this is the canonical one, because the store is the
 * implementation and the port is a description of it written in the loop's
 * vocabulary so that the loop can be handed a fake instead (D-0019 rule 1).
 * `src/access/conductor.ts` is where the two are checked against each other:
 * assigning an `IterationStore` to a `StorePort` there is a compile error the
 * moment they drift. The store may not close the loop by importing the port
 * itself -- the store layer names only itself, which is what
 * `test/architecture/import-boundaries.test.ts` enforces.
 */
export interface ReserveInput {
  readonly id: string;
  readonly request: string;
  /** The plan as the loop rendered it; the store digests these bytes. */
  readonly plan: JsonRecord;
  /**
   * The triple the allocator minted for this iteration (D-0023 rule 5).
   *
   * Handed in rather than derived here, because deriving them is a pure
   * function of the iteration id and the workspace root and belongs where the
   * loop can be tested against it. The store's job is the half that needs a
   * transaction: writing the claim in the same `BEGIN IMMEDIATE` as the row, so
   * that no concurrent reservation can be handed a name this one is taking.
   */
  readonly runId: string;
  readonly topicBranch: string;
  readonly workspace: string;
  /**
   * The iteration this one revises, or null for a first lap (D-0030 rule 1).
   *
   * Required rather than optional, so that every caller says which it is: a
   * lineage that can be left off is a lineage a caller forgets, and the row
   * that results is indistinguishable from a first lap for ever. `revise` is
   * the one caller that passes an id today.
   */
  readonly supersedesIterationId: string | null;
  /**
   * The message that opened the request this lap came from, or null
   * (D-0061 rule 4). Required for `supersedesIterationId`'s reason, and refused
   * under the write lock when it names no message that opens a request.
   *
   * **Only a first lap's link is the caller's** (rondo#195). A successor
   * inherits its predecessor row's link, read under the write lock, whatever
   * is passed here.
   */
  readonly requestMessageId: string;
  /**
   * The worker provider this request chose, or null for the host's default
   * (rondo#462).
   *
   * **Carried and never read here**: whether the host is equipped for it is
   * `src/continuo`'s answer and is given at the spawn, so what the store
   * contributes is that the choice lands on the row in the same transaction as
   * the row, and can therefore be shown beside the lap for ever. A successor
   * that names none inherits its predecessor's, as it inherits the request
   * link ({@link inheritedWorkerProvider}).
   */
  readonly workerProvider?: string | null;
  /**
   * The worker this host runs when a request chooses none, as the caller
   * resolved it at the start (rondo#462) -- absent only where the caller could
   * not say.
   *
   * **Resolved by the caller and settled here.** The store cannot read a
   * host's settings and must not try; what it contributes is that the name is
   * fixed onto the row in the row's own transaction, so a later change to the
   * host's default cannot rewrite what a past lap is said to have run on. A
   * caller that leaves it absent leaves `worker_provider` NULL, which the page
   * reads as unknown.
   */
  readonly hostWorkerProvider?: string | null;
  /**
   * The approval this admission spends, or null when nobody approved anything
   * (D-0022 rule 9).
   *
   * **Here rather than in a call of its own, because that is the whole
   * property.** The consumption row and the iteration row are written in one
   * `BEGIN IMMEDIATE`: consuming outside it would produce either an approval
   * spent on an admission that never happened or an admission that ran on an
   * approval nobody subtracted, and both are unrecoverable from the ledger
   * afterwards. Required rather than optional for `supersedesIterationId`'s
   * reason -- a caller that can leave it off is a caller that forgets.
   */
  readonly spend: DecisionSpend | null;
  /**
   * The approved scope this admission is taken under, or null when it is not
   * taken under one (D-0066 rule 3.1).
   *
   * **Beside `spend` and for `spend`'s reason**: the `scope_consumption` row is
   * written in this `BEGIN IMMEDIATE`, beside the iteration row, both or
   * neither (D-0047 rule 1), and the scope's store-side tests are re-made under
   * the same write lock so that two admissions running at once cannot both take
   * the last lap (D-0066 rule 4.3). Required rather than optional for
   * `supersedesIterationId`'s reason. **At most one of `spend` and this is
   * non-null**: an admission is authorised by one approval, and naming two is a
   * defect in the caller rather than a stricter admission.
   */
  readonly scopeSpend: ScopeSpend | null;
  /**
   * The paths a first admission asks to hold (D-0073 rule 2.3), or null for
   * none until its gate (D-0160). **A redo passes null**: it continues its
   * lineage's claim (rule 2.6), and a claim that changes is a successor row
   * this call does not write.
   */
  readonly claim: LaneClaimAsk | null;
  /**
   * The decision-record numbers this admission reserves (D-0098 rule 3.3), or
   * null for none: consecutive, and the first the next above both the default
   * branch's record (the caller's read, named in the prompt already) and every
   * number ever reserved (read here, under the write lock). A first lap's are
   * written beside its first `lane_claim` row, both or neither; a redo's are
   * the one more its gate found it needs. Required for
   * `supersedesIterationId`'s reason.
   */
  readonly numbers: readonly number[] | null;
  readonly nowMs: number;
}

/**
 * One approved scope, as the admission taken under it names it (D-0066 rule 3).
 *
 * **The repository and the workspace root are not here, and that is the
 * point.** The store reads them from `plan` -- the admitted plan it is about to
 * insert -- so the pair tested against `workspaces` is the pair that runs, and
 * never a pair the caller claims beside it. **Nor is the request**: the act's
 * request is the row's own `requestMessageId` (D-0061 rule 4), the link the
 * iteration is written with, so the request tested against `requests` is the one
 * the row records.
 *
 * `agentTypeDigest` is the one tested value a caller does carry: the iteration
 * row does not hold it until classification, after `reserve()`, so it comes
 * from the surface's `classifyPlan` over this same plan. Its drift between that
 * read and this write is the bounded race D-0047 rule 6 accepts and D-0066
 * rule 4.3 names.
 */
export interface ScopeSpend {
  readonly scopeDecisionId: string;
  /** The split proposal the plan came from, or null for an in-scope retry (rule 3.3). */
  readonly proposalId: string | null;
  readonly agentTypeDigest: string;
  /**
   * D-0098 rule 5: this redo is the closing lap, and what the reviewer last
   * read. Written to `closing_lap` beside the consumption, both or neither.
   * Absent or null for every other admission.
   */
  readonly closing?: ClosingLapSpend | null;
}

/** A closing lap as its admission names it (D-0098 rule 5.3). */
export interface ClosingLapSpend {
  /** The tip commit of the predecessor's model reading: what the reviewer last read. */
  readonly readTipCommit: string;
  readonly readingReadAtMs: number;
  /** The below-threshold finding indexes (0-based) of that reading, which the lap answers. */
  readonly findings: readonly number[];
}

/** A closing lap as {@link IterationStore.closingLapOf} reads it back. */
export interface ClosingLap extends ClosingLapSpend {
  readonly iterationId: string;
  readonly predecessorId: string;
}

/**
 * A person's scoped start refused by files another line holds, waiting to be
 * attempted again by the resident host's tick (rondo#284, D-0158). Keyed by the
 * iteration id the form minted, so the attempt is the press's own lap.
 */
export interface HeldStart {
  readonly iterationId: string;
  readonly requestMessageId: string;
  readonly scopeDecisionId: string;
  readonly planDigest: string;
  /** The plan's repository as the ledger compares it ({@link repositoryKey}). */
  readonly repository: string;
  readonly heldAtMs: number;
  /**
   * The worker provider the press that waits chose, or null for the host's
   * default (rondo#462).
   *
   * **Kept with the wait because the wait starts the lap.** The tick that
   * attempts a held start again builds the press's input out of this row, and a
   * row that did not carry the choice would start the work on the host's
   * default -- silently moving a person's request onto another worker because
   * another line happened to hold its files.
   */
  readonly workerProvider?: string | null;
}

/**
 * One approval, as the admission that spends it names it.
 *
 * `contractDigest` is **the contract the plan being admitted composes**, not a
 * value copied off the decision row: the store compares the two, and a caller
 * that read the approved digest and handed it straight back would be asking
 * the store to check a value against itself.
 */
export interface DecisionSpend {
  readonly decisionId: string;
  readonly contractDigest: string;
}

/**
 * The two bounds one host admits under (D-0023 rule 12).
 *
 * Read once at the composition root and handed to the store, never taken from
 * a request: `admit()` receives a `LoopPolicy` per call, so a bound placed
 * there would be a bound each request states about the whole host, and "the
 * bound" would become whichever caller arrived last. A host-wide limit any
 * request may restate is not a limit.
 *
 * **`maxIterations` is not either of these numbers.** It is a ceiling on
 * attempts *of one request* and is compared against a fresh iteration's zero
 * attempts before a row exists; these bound *concurrent requests*. Different
 * axes, different owners.
 *
 * Declared here as well as in `src/refrain/policy.ts` for the reason
 * {@link ReserveInput} is: the store may not import the loop, and
 * `src/access/conductor.ts` is where the two are checked against each other.
 */
export interface HostPolicy {
  /**
   * How many iterations may be *executing* at once.
   *
   * Counted over the generated `occupying` column: every non-terminal status
   * except `awaiting_human` and `withdrawal_requested`. **Two by default
   * since D-0124**: the pinned continuo carries D-1104's holder-identity half,
   * so a second concurrent lap is no longer refused there, and `reserve()`'s
   * one `BEGIN IMMEDIATE` is what keeps two admissions from both taking the
   * last slot.
   */
  readonly maxOccupying: number;
  /**
   * How many iterations may be *non-terminal* at once.
   *
   * Counted over `live`. This one may exceed one today, because an iteration
   * suspended at a gate holds no continuo resource, no process and no fenced
   * child -- it is a durable row in front of a person. What it bounds is the
   * leak: worktrees, branches, open runs and unanswered questions.
   */
  readonly maxLive: number;
}

/**
 * Why a reservation did not happen.
 *
 * `atCapacity` is the capacity refusal and is an ordinary answer rather than a
 * fault: a host that is already at its bound says so, and the caller tries
 * again when something ends. It replaces D-0019's `occupied`, which named the
 * one blocking row -- a meaningful answer only while the bound was one.
 *
 * It carries the bound, the occupancy observed and which of the two bounds
 * refused, because that is what a person needs in order to decide whether to
 * wait or to raise a number, and because the occupancy may legitimately read
 * *higher* than the bound (D-0023 rule 27).
 *
 * `unapproved` is the other ordinary refusal: an admission carrying a
 * {@link DecisionSpend} the store would not spend. Nothing is written on it --
 * no row and no consumption -- which is what "fail closed" means here.
 */
export type ReserveOutcome =
  | { readonly kind: "reserved"; readonly record: IterationRecord }
  | {
      readonly kind: "atCapacity";
      readonly bound: BoundName;
      readonly limit: number;
      readonly occupancy: number;
    }
  | { readonly kind: "unapproved"; readonly reason: string }
  /** The scope's re-test under the write lock refused (D-0066 rule 4.3). Nothing is written. */
  | ({ readonly kind: "scopeRefused" } & ScopeRefusal)
  /** The request link names no message that opens a request (D-0061 rule 4). Nothing is written. */
  | { readonly kind: "requestRefused"; readonly reason: string }
  /**
   * The claim would share a path with an open line (D-0073 rule 3.1). Nothing
   * is written; `holders` names each line and the asked paths it holds.
   */
  | {
      readonly kind: "laneRefused";
      readonly paths: readonly string[];
      readonly holders: readonly LaneHolder[];
    }
  /**
   * A number asked for is not above the highest this record has ever had
   * reserved (D-0098 rule 3.3): another admission took it since the caller
   * read. Nothing is written; the caller composes the numbers again from
   * `highest` and retries.
   */
  | { readonly kind: "numbersMoved"; readonly highest: number }
  | { readonly kind: "defect"; readonly reason: string };

/** Which of {@link HostPolicy}'s two bounds an admission was refused by. */
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
 * The third arm is the point. A store that *threw* on a row it cannot decode
 * made `stalled` -- which `records.ts` defines as existing precisely for "a
 * corrupt row, an effect result the union does not cover, a status the
 * interpreter does not recognise" -- unreachable, because every caller that
 * would have driven the iteration there rejected before it could. The row
 * meanwhile still counts as live, so the single-flight lock stayed held by a
 * row nothing could name. `unreadable` is that state given a name the machine
 * can act on, and it carries the id so the answer can say which row.
 */
export type ReadOutcome =
  | { readonly kind: "read"; readonly record: IterationRecord }
  | { readonly kind: "absent" }
  | { readonly kind: "unreadable"; readonly id: string; readonly reason: string };

/**
 * One proposal read back, absent, or a row that will not decode (#39).
 *
 * {@link ReadOutcome}'s three arms, over a different table and for the same
 * reason: the reader that shows an operator what they are answering has to be
 * able to say *"this row is corrupt"* without throwing, because the caller is
 * a screen and the alternative is a stack trace where the decision was.
 */
export type ProposalReadOutcome =
  | { readonly kind: "read"; readonly proposal: StoredProposal }
  | { readonly kind: "absent" }
  | { readonly kind: "unreadable"; readonly reason: string };

/** One scope row read back, absent, or refused as unreadable -- {@link ProposalReadOutcome}'s arms. */
export type ScopeReadOutcome =
  | { readonly kind: "read"; readonly scope: StoredScope }
  | { readonly kind: "absent" }
  | { readonly kind: "unreadable"; readonly reason: string };

/**
 * The agent-type input rondo holds for one digest (D-0069 section 1): from an
 * `agent_type_record` row, or from the plan of an iteration row carrying that
 * digest (D-0062 rule 1.2), absent, or unreadable.
 */
export type HeldAgentTypeOutcome =
  | {
      readonly kind: "read";
      readonly source: "agent_type_record" | "iteration";
      readonly agentTypeInput: JsonValue;
    }
  | { readonly kind: "absent" }
  | { readonly kind: "unreadable"; readonly reason: string };

/** One scope decision read back, absent, or unreadable. */
export type ScopeDecisionReadOutcome =
  | { readonly kind: "read"; readonly decision: StoredScopeDecision }
  | { readonly kind: "absent" }
  | { readonly kind: "unreadable"; readonly reason: string };

/**
 * The open asks in one request's thread, or unreadable when a message's bases
 * will not parse -- fail closed, since an ask whose line cannot be read might
 * stand over any line (D-0066 rule 4.2).
 */
export type OpenAsksReadOutcome =
  | { readonly kind: "read"; readonly asks: readonly OpenAsk[] }
  | { readonly kind: "unreadable"; readonly reason: string };

/**
 * Every request thread's messages, or unreadable when a message's bases will
 * not parse (D-0061 rule 2). The page draws the threads from it; a thread it
 * could only half read would show a conversation with holes nobody can see.
 */
export type ThreadMessagesReadOutcome =
  | { readonly kind: "read"; readonly messages: readonly ThreadMessageDraft[] }
  | { readonly kind: "unreadable"; readonly reason: string };

/** Whether the status-blind termination of {@link IterationStore.settle} landed. */
export type SettleOutcome =
  | { readonly kind: "settled" }
  | { readonly kind: "missing" }
  | { readonly kind: "defect"; readonly reason: string };

/** Whether {@link IterationStore.appendReading} wrote its row. */
export type AppendReadingOutcome =
  | { readonly kind: "appended" }
  | { readonly kind: "absent" }
  | { readonly kind: "defect"; readonly reason: string };

/**
 * The durable surface, as the loop is allowed to see it.
 *
 * Asynchronous even though every implementation below is synchronous, because
 * the port is what a fake, a future connection pool or a store on another
 * process all have to satisfy, and a synchronous signature would be the one
 * shape none of them could take later without changing every caller.
 */
export interface IterationStore {
  /** Commit the `planned` row, or say that a non-terminal iteration exists. */
  reserve(input: ReserveInput): Promise<ReserveOutcome>;
  /**
   * Assert the current status, then write the new one with its fields.
   *
   * **`reading` is written in the same transaction as the transition, and that
   * is D-0029 rule 8 rather than a convenience.** A reading committed after the
   * transition succeeded leaves a window in which the row says
   * `awaiting_human` and no reading exists -- and the person who answers the
   * gate inside that window is the person the reading was taken for. Passing it
   * here rather than offering a second method is what makes the window
   * unreachable instead of merely small: there is no call a caller could make
   * in the wrong order.
   */
  transition(
    id: string,
    from: IterationStatus,
    to: IterationStatus,
    fields: IterationFields,
    nowMs: number,
    reading?: LapReadingDraft | null,
  ): Promise<TransitionOutcome>;
  /**
   * Every reading taken of one iteration, oldest first.
   *
   * What `publish` consults, and the reason D-0029 rule 8 refuses to defer the
   * query: a reading on a row that has reached a terminal status is reachable
   * through nothing else in this file. {@link IterationStore.read} needs an id
   * a caller already has and answers about the iteration rather than about its
   * readings; {@link IterationStore.readLive} filters terminal rows out.
   */
  readingsFor(iterationId: string): Promise<readonly LapReading[]>;
  /**
   * Append a reading that no transition carries: the model reading, which
   * arrives after `drive()` returned while the gate's clock runs (D-0065 2.6).
   *
   * **The opposite of `transition`'s `reading`, and for D-0065's reason.** The
   * deterministic reading must land with the `awaiting_human` transaction
   * (D-0029 rule 8); a model reading taken minutes later has no transition to
   * ride, and holding one open for it would put a model inside `drive()`, which
   * D-0029 rule 6 refuses. Append-only like every reading: it never updates, and
   * the writer's `clear` refusals apply unchanged. An id with no iteration row is
   * `absent` and writes nothing.
   */
  appendReading(
    iterationId: string,
    draft: LapReadingDraft,
    nowMs: number,
  ): Promise<AppendReadingOutcome>;
  /**
   * Record what an operator says they checked, before they are let past the gate.
   *
   * Its own call rather than a parameter of `transition`, which is the opposite
   * of what `reading` above does, and for the opposite reason: a reading is
   * written *by* the transition that produced it, while this is written *before*
   * the act it precedes -- `D-0042` rule 3's order, so that a claim rondo could
   * not store stops the answer instead of vanishing behind it.
   */
  recordVerificationClaim(
    iterationId: string,
    actorId: string,
    claim: string,
    nowMs: number,
  ): Promise<void>;
  /**
   * Record which answer a person gave at a gate (D-0092).
   *
   * Called by the gate walk once continuo has accepted the answer's body, and
   * by nothing else. A second call for the same gate is a no-op: the walk
   * re-issues an identical answer after an interruption, and continuo refuses
   * a different one.
   */
  recordGateAnswer(
    iterationId: string,
    gateId: string,
    answer: GateAnswer,
    actorId: string,
    nowMs: number,
  ): Promise<void>;
  /** Every verification claim made on one iteration, oldest first. */
  verificationClaimsFor(iterationId: string): Promise<readonly OperatorVerificationClaim[]>;
  /**
   * Every iteration that reached a terminal status carrying no reading at all.
   *
   * **The fail-open detector, and it exists because the fail-open is silent.**
   * A lap whose reading was never written closes within minutes and looks from
   * every other read in this file exactly like one that was read and found
   * fine. Without this, "how often does the stage not happen" is not a question
   * the store can answer, and a stage whose absence is unobservable is a stage
   * that can quietly stop running.
   *
   * Ids rather than records: the question is a count and a list to go look at,
   * and returning records would make a row that will not decode able to break
   * the census of the rows that do.
   */
  terminalWithoutReading(): Promise<readonly string[]>;
  /**
   * One iteration by id -- total, and that totality is load-bearing.
   *
   * It answers `absent` when there is no such row and `unreadable` when there
   * is one that will not decode; it does not throw for either. The fix belongs
   * here rather than in a `try`/`catch` upstream because the store is the thing
   * that knows the row did not decode -- a caller can only observe that
   * *something* threw, and would have to guess whether the promise rejected
   * because the row is corrupt or because the connection is gone. The two want
   * opposite responses: one is an iteration to stall and settle, the other is a
   * process that should stop.
   */
  read(id: string): Promise<ReadOutcome>;
  /**
   * Every non-terminal iteration, oldest first.
   *
   * Plural since D-0023: under a bound above one there is no such thing as
   * *the* live iteration, and a singular answer would have been an arbitrary
   * row. Each element is a {@link ReadOutcome} rather than a record so that one
   * row that will not decode does not make the others unreadable -- which is
   * the same totality argument {@link IterationStore.read} makes, applied to a
   * list.
   */
  readLive(): Promise<readonly ReadOutcome[]>;
  /**
   * What stands against the two bounds right now (D-0037 rule 3c).
   *
   * **Counted over the same generated columns `reserve` counts**, which is what
   * keeps D-0023 rule 8's *"the bound and the column are one definition"* true
   * for a reader as well as for the writer. Deriving either number from
   * {@link IterationStore.readLive} would be a second definition -- and would
   * also be wrong about a row that will not decode, which holds a slot and has
   * no status a caller can classify.
   *
   * It is a read and not a reservation: nothing is locked and nothing is
   * admitted, so the answer is what was true when it was asked.
   */
  occupancy(): Promise<Occupancy>;
  /**
   * Every iteration that has reached a terminal status, oldest first.
   *
   * **D-0022's residual, discharged rather than carried** (D-0032 rule 11).
   * {@link IterationStore.read} needs an id a caller already has and
   * {@link IterationStore.readLive} filters terminal rows out, so the abandoned
   * iteration the advisory component exists to explain could not be found at
   * all. D-0029 rule 8 discharged the part its verdicts needed
   * ({@link IterationStore.terminalWithoutReading}); #39's "what changed",
   * #41's inbox and #40's breakdown all need the rest.
   *
   * A {@link ReadOutcome} per row for {@link IterationStore.readLive}'s reason:
   * one row that will not decode must not make the others unreadable.
   */
  terminalIterations(): Promise<readonly ReadOutcome[]>;
  /**
   * Terminate a row by id alone, without decoding it.
   *
   * **A narrow, single-purpose licence, and the only write in this file that
   * does not assert the status it is leaving.** Every other write does, because
   * the closed edge relation of D-0019 rule 6 is the design's safety property
   * and `transition` is where it is enforced against a restart. But a row whose
   * status cannot be read has no status to assert, and refusing to write it is
   * exactly what wedges the conductor: the row keeps `live` set, so `reserve`
   * answers `occupied` forever and no path exists to end it. This is the floor
   * beneath D-0019 rule 11's table, whose last row is an operator's `abandon()`.
   *
   * Reachable **only** from the interpreter's `abandon()`, and only when
   * `read` answered `unreadable`. Nothing else may call it: a caller that can
   * name the status has `transition`, and using this instead would trade the
   * invariant for a convenience.
   */
  settle(id: string, reason: string, nowMs: number): Promise<SettleOutcome>;
  /**
   * The line `iterationId` belongs to (D-0073): its lineage id, its in-force
   * claim, and every lap of its tree, root first. What a landing reading is
   * taken over.
   */
  laneLine(iterationId: string): Promise<LaneLineReadOutcome>;
  /**
   * Release a line's claim with a row of no paths (D-0073 rule 4.3), for one
   * of two causes: a landing reading (rules 6 and 7), which names the head and
   * the laps it was taken over in `takenOver` and is refused as stale when
   * either moved; or the person's release press, which names none.
   *
   * **Only a line with no lap in flight is released.** A line at its gate is
   * ended by `abandon()` (rule 9.3), and its claim goes with it.
   */
  releaseLane(input: LaneReleaseInput): Promise<LaneReleaseOutcome>;
  /**
   * The person writes what an open line holds now (D-0073 rules 4.1 and 4.2,
   * D-0163): one successor row, a widening for the paths it takes and a
   * narrowing for those it gives up. A widening is for a line with a lap in
   * flight and is refused onto a path another open line holds; a narrowing is
   * for a line nothing of which can still commit, and never gives up a path
   * in `changed`. Refused when the line moved under the screen that drew it.
   */
  moveClaim(input: LaneMoveInput): Promise<LaneMoveOutcome>;
  /**
   * Compare the paths a lap changed with its line's in-force claim (D-0073
   * rule 5): which fall outside it, split into those another open line of the
   * repository holds (`D-0067` rule 2's collision) and those nobody holds.
   * Reads only: the ledger does not widen a drafted claim by itself (the
   * person's answer at rondo#283's gate); {@link claimChanged} is the one
   * widening, for a line that declared nothing (D-0160).
   */
  compareLane(input: LaneCompareInput): Promise<LaneCompareOutcome>;
  /**
   * **A line that declared nothing claims what its lap changed** (rondo#554,
   * D-0160): at its gate, the changed paths no other open line holds, added
   * to its claim. Only for a line admitted with no drafted claim (its head
   * `unclaimed`) or one whose claim came this way (`changed`); a drafted
   * claim is left as it is. Writes nothing when no path is left.
   */
  claimChanged(
    input: LaneCompareInput & { readonly nowMs: number },
  ): Promise<
    | { readonly kind: "claimed"; readonly lineageId: string; readonly paths: readonly string[] }
    | { readonly kind: "unchanged" }
    | { readonly kind: "defect"; readonly reason: string }
  >;
  /**
   * Every line the ledger has an answer about, holding or released (D-0073
   * rule 12): what the page says a line owns, what waits on it and whether its
   * work landed. Writes nothing.
   */
  laneLedger(): Promise<readonly LedgerLine[]>;
  /**
   * The decision-record numbers the line of `iterationId` was handed (D-0098
   * rule 3.2), ascending, each with whether a release row names it. Empty for
   * a line that reserved none or is not in this store. Writes nothing.
   */
  numberReservations(iterationId: string): Promise<readonly NumberReservation[]>;
  /**
   * The cap `iterationId` is sent with, computed and written onto its row in
   * one transaction (D-0121 rules 2 and 7), or null where it was admitted under
   * no approval or the approval will not read -- and then nothing is written.
   * One transaction, so two laps sent at once each see the other's cap.
   */
  sendLapBudget(iterationId: string, nowMs: number): Promise<number | null>;
  /**
   * Record which processes drive a `performing` lap (D-0139): the host and pid
   * of the rondo process that sends it, then the pid of its `lap perform`
   * child. Written only while the row is `performing`; it moves no status.
   */
  markLapProcess(
    iterationId: string,
    mark: { readonly driverHost: string; readonly driverPid: number } | { readonly lapPid: number },
  ): Promise<void>;
  /** Every `performing` lap with the processes {@link markLapProcess} wrote (D-0139). */
  performingLaps(): Promise<readonly PerformingLap[]>;
  /**
   * Record which remote `publish` pushed this lap's branch to (rondo#286,
   * D-0153 rule 1), written at the push and read by the landing reading.
   *
   * **The push, not the pull request**: the push is the leg that put the work
   * on a forge, and a publish whose pull request failed pushed all the same.
   * Written again by a later publish of the same lap, which pushed again:
   * where the branch went last is what a reading of it has to ask.
   *
   * It moves no status and asserts none: a publish happens to a lap that is
   * already closed.
   */
  markPublishedRemote(iterationId: string, remote: string, nowMs: number): Promise<void>;
  /**
   * The highest number ever reserved in `record` of `repository` (as
   * `repositoryKey` spells it), released ones included, or 0 (D-0098 rule
   * 3.3): half of the floor an admission's numbers start above.
   */
  highestReserved(repository: string, record: string): Promise<number>;
  /**
   * `first_landed` (D-0098 rule 1.1): the landing that released the line
   * `iterationId` belongs to, or null. Read from its release rows' `landing`
   * basis, which only the landing reading writes (rule 1.5): a release by
   * `abandon`, `fail`, the person's press or "ended with nothing to land"
   * carries none. The latest one, and still read after a retry takes the claim
   * back. Writes nothing.
   */
  landingOf(iterationId: string): Promise<LineLanding | null>;
  /**
   * D-0098 rule 5.3: the closing-lap row `iterationId` was admitted with, or
   * null when it is an ordinary lap. Writes nothing.
   */
  closingLapOf(iterationId: string): Promise<ClosingLap | null>;
  /**
   * rondo#284: keep a start refused by held files as waiting, and say whether
   * it waits. **A second refusal of the same form keeps the one row**, and one
   * whose wait ended without a start waits again. **None is kept while another
   * form of the same plan waits, or once one of them started it** (two tabs,
   * two forms), or the tick would start the plan twice by itself.
   */
  recordHeldStart(held: HeldStart): Promise<boolean>;
  /**
   * Keep that `held`'s form joined the wait `joinedTo` (Codex round 4): a
   * settled row under the form's own id, so the form sent again resolves to
   * the wait's lap rather than starting the work under an id nothing reserved.
   */
  joinHeldStart(held: HeldStart, joinedTo: string): Promise<void>;
  /** The wait a form joined ({@link joinHeldStart}), or null. Writes nothing. */
  heldStartJoin(iterationId: string): Promise<string | null>;
  /** The held starts still waiting, oldest first. Writes nothing. */
  heldStarts(): Promise<readonly HeldStart[]>;
  /** End a held start's wait with what its attempt came to; a settled one is left as it is. */
  settleHeldStart(iterationId: string, outcome: string, nowMs: number): Promise<void>;
}

/** One split under an approval in force, and the request it answers (D-0127). */
export interface ApprovedSplit {
  readonly scopeDecisionId: string;
  readonly proposalId: string;
  readonly requestMessageId: string;
}

/** What {@link IterationStore.landingOf} reads: the default branch and the commit the landing was read at. */
export interface LineLanding {
  readonly branch: string;
  readonly commit: string;
  readonly atMs: number;
}

/** One line as the page is told about it ({@link IterationStore.laneLedger}). */
export interface LedgerLine {
  /** The line's first lap id (D-0030). */
  readonly lineageId: string;
  /** As the ledger compares it ({@link repositoryKey}). */
  readonly repository: string;
  /** The in-force claim row, or null for a line from before the ledger. */
  readonly claimId: string | null;
  /** What it holds now; empty once released. */
  readonly paths: readonly string[];
  /**
   * Why its drafter asked for paths this wide (rondo#509), or null when it said
   * nothing: a claim of files, a claim written by rule, or one from before.
   */
  readonly why: string | null;
  /** Every lap of the line, root first. */
  readonly lapIds: readonly string[];
  /** Some lap has not ended: it holds its paths whatever its diff says (rule 10). */
  readonly inFlight: boolean;
  /** The closed laps no other lap continues (rule 6): what a landing is owed by. */
  readonly closedTips: readonly string[];
  /**
   * Who released it, or null while its work is still owed: while it holds,
   * and after it gave its paths up when its pull request opened (D-0114).
   * `person` is the release press (rule 4.3); `rondo` is a landing read or a
   * line that ended with nothing to land, which `closedTips` tells apart.
   */
  readonly releasedBy: "person" | "rondo" | null;
}

/** One reserved decision-record number ({@link IterationStore.numberReservations}). */
export interface NumberReservation {
  readonly number: number;
  readonly released: boolean;
}

export interface LaneCompareInput {
  /** Any lap of the line. */
  readonly iterationId: string;
  /** Changed paths, already claimable (`claimCover`). */
  readonly paths: readonly string[];
}

export type LaneCompareOutcome =
  | {
      readonly kind: "compared";
      readonly lineageId: string;
      /** Outside the claim and held by no other open line, sorted. */
      readonly unheld: readonly string[];
      /** Outside the claim and held by another open line. */
      readonly held: readonly LaneHolder[];
    }
  | { readonly kind: "absent" }
  | { readonly kind: "defect"; readonly reason: string };

/** One line of the lane ledger, as {@link IterationStore.laneLine} reads it. */
export interface LaneLine {
  readonly lineageId: string;
  /** The in-force claim, or null for a line from before the ledger (which holds `/` while a lap is in flight). */
  readonly claim: { readonly claimId: string; readonly paths: readonly string[] } | null;
  readonly laps: readonly IterationRecord[];
}

export type LaneLineReadOutcome =
  | { readonly kind: "read"; readonly line: LaneLine }
  | { readonly kind: "absent" }
  | { readonly kind: "defect"; readonly reason: string };

export interface LaneReleaseInput {
  /** Any lap of the line. */
  readonly iterationId: string;
  /** The head claim and lap ids a landing reading was taken over; null for the person's press. */
  readonly takenOver: {
    readonly claimId: string | null;
    readonly lapIds: readonly string[];
  } | null;
  /**
   * Whether this release is a landing reading's "landed" (D-0098 rule 3.7): a
   * landed line's number reservations are kept; every other release -- a line
   * that ended with nothing to land, the person's press -- releases them in
   * this transaction (rule 3.4). `takenOver` cannot tell the two apart, so
   * the caller says which.
   */
  readonly landed: boolean;
  readonly authorKind: "operator" | "drafter";
  readonly authorId: string;
  readonly bases: readonly JsonValue[];
  readonly nowMs: number;
}

export type LaneReleaseOutcome =
  | { readonly kind: "released"; readonly lineageId: string }
  | { readonly kind: "refused"; readonly reason: string }
  | { readonly kind: "defect"; readonly reason: string };

export interface LaneMoveInput {
  /** Any lap of the line. */
  readonly iterationId: string;
  /** The head claim and lap ids the screen was drawn over. */
  readonly takenOver: { readonly claimId: string; readonly lapIds: readonly string[] };
  /** The claim the line is to hold, as the person wrote it. */
  readonly paths: readonly string[];
  /**
   * What the line has changed (D-0073 rule 4.2), read over the laps in
   * `takenOver`; null when it was not read, and a narrowing over that is
   * answered `busy`.
   */
  readonly changed: readonly string[] | null;
  readonly authorId: string;
  readonly nowMs: number;
}

/** One arm per next move the person has (rondo#348). */
export type LaneMoveOutcome =
  | {
      readonly kind: "moved";
      readonly lineageId: string;
      readonly added: readonly string[];
      readonly dropped: readonly string[];
    }
  /** The line moved under the screen: read it again. */
  | { readonly kind: "stale" }
  /** A widening onto paths other open lines hold: nothing was written. */
  | { readonly kind: "held"; readonly holders: readonly LaneHolder[] }
  /** A lap of the line may still commit, so it gives nothing up yet. */
  | { readonly kind: "busy" }
  /** A narrowing would give up paths the line changed. */
  | { readonly kind: "kept"; readonly paths: readonly string[] }
  | { readonly kind: "refused"; readonly reason: string }
  | { readonly kind: "defect"; readonly reason: string };

/**
 * Run `body` inside `BEGIN IMMEDIATE`, committing it or rolling it back.
 *
 * `BEGIN IMMEDIATE` rather than the default deferred transaction for the
 * reason continuo gives on its own admission path: under a deferred
 * transaction the write lock is taken at the *first write*, which leaves a
 * window in which two readers have both decided they may proceed. Taking the
 * write lock at `BEGIN` closes it, and the serialisation is then the
 * database's -- it holds across two processes, not merely across two callers
 * in one.
 *
 * At module scope rather than inside {@link iterationStore} because
 * {@link advisoryRecord} needs the same guarantee for D-0032 rule 5's refusal,
 * and a second copy of this function would be a second answer to "what does
 * this store do about concurrency".
 */
/**
 * Whether a write to the advisory record landed, or why it did not.
 *
 * **`refused` and `defect` are two different answers and the split is
 * load-bearing.** A refusal is this store declining to record something D-0032
 * says must not be recorded -- an answer to a proposal that binds nothing, a
 * withholding whose rule cannot be named -- and it is a fact about the caller's
 * request, not a fault. A defect is the store failing. A caller that collapsed
 * them would report a policy refusal as an outage, and the refusals are the
 * whole of what rules 5 and 10 buy.
 */
export type RecordOutcome =
  | { readonly kind: "recorded" }
  | { readonly kind: "refused"; readonly reason: string }
  | { readonly kind: "defect"; readonly reason: string };

/**
 * What a message write came to, with **the id already spoken for as its own
 * arm** (rondo#200).
 *
 * A duplicate id is not one refusal among many: a caller whose id is
 * deterministic -- a report named after the gate it describes -- writes it
 * again precisely to fill a gap it cannot see, and "already there" is that
 * caller's success. It used to arrive as prose inside `refused`, which left
 * `includes("already in the conversation")` as the only way to branch on it
 * (AGENTS.md section 1: a refusal whose next move differs gets its own arm).
 *
 * The id it carries is the one the caller handed in; the arm says nothing
 * about what the other row's body is, because the store does not compare one.
 * A caller that cannot tell a repeat from a different message reusing an id --
 * every operator-composed id -- still refuses, through {@link asRefusal}.
 */
export type MessageRecordOutcome =
  | RecordOutcome
  | { readonly kind: "duplicate"; readonly messageId: string };

/**
 * D-0036 rule 3's refusal, for a caller that has no use for the distinction.
 *
 * The prose is the one the store said before `duplicate` was an arm, so a
 * surface that printed it prints the same sentence.
 */
export function asRefusal(outcome: MessageRecordOutcome): RecordOutcome {
  return outcome.kind === "duplicate"
    ? { kind: "refused", reason: duplicateReason(outcome.messageId) }
    : outcome;
}

/** The sentence {@link asRefusal} refuses with, for a caller composing its own. */
export function duplicateReason(messageId: string): string {
  return (
    `the message '${messageId}' is already in the conversation, and a message id is ` +
    "durable and immutable (D-0036 rule 3): a second row under one id would let a " +
    "reference that has already been elevated come to mean something else"
  );
}

/** What one drafter run hands the store to write (D-0071 rule 7.3). */
export interface DraftRunWrite {
  readonly requestMessageId: string;
  /**
   * Every operator message of the thread the run's document held (rule 7.2).
   * A set and not the latest by clock: a reply written under a clock that
   * stepped back is still a message the document did not hold.
   */
  readonly operatorMessageIds: readonly string[];
  /** What the drafter's rows are named under, for {@link AdvisoryRecord.draftedMessageIds}. */
  readonly drafterPrefix: string;
  /** Null only for an unavailable run, which writes its message and nothing else (rule 1.5). */
  readonly proposal: ProposalDraft | null;
  readonly scope: ScopeDraft | null;
  readonly messages: readonly ThreadMessageDraft[];
  /**
   * Standing policies the run drafted from the person's words (D-0067 rule
   * 6.2), written before the messages so a message may cite one. Absent is none.
   */
  readonly policies?: readonly StandingPolicyDraft[];
}

export type DraftWriteOutcome =
  | RecordOutcome
  | { readonly kind: "stale" }
  /** Another run already covered the thread (a second host): nothing is written twice. */
  | { readonly kind: "covered" };

/**
 * What the thread explainer writes for one question (D-0177), all in one
 * transaction or nothing: the `explanation` proposal, which binds nothing
 * (D-0032 rule 5), the drafter's answer replying to the question, and -- when
 * a model ran under an approval -- the `explanation_reading` claim that counts
 * its cost there.
 */
export interface AnswerWrite {
  readonly questionId: string;
  /** What the explainer's rows are named under; the proposal's drafter and the message's author start with it. */
  readonly drafterPrefix: string;
  readonly proposal: ProposalDraft;
  /** Asks nothing, replies to the question, and cites it and the proposal by their bases. */
  readonly message: ThreadMessageDraft;
  /** The approval in force a model's answer counts against; null when no model ran. */
  readonly claim: { readonly scopeDecisionId: string; readonly nowMs: number } | null;
}

/**
 * How {@link AdvisoryRecord.recordAnswer} ended. `malformed` names the field
 * of the write that breaks D-0177's shape and nothing is written;
 * `alreadyAnswered` is a second writer finding the answer in place.
 */
export type AnswerWriteOutcome =
  | { readonly kind: "answered"; readonly proposalId: string; readonly messageId: string }
  | { readonly kind: "alreadyAnswered"; readonly questionId: string }
  | { readonly kind: "notAQuestion"; readonly questionId: string }
  | { readonly kind: "malformed"; readonly field: string; readonly reason: string }
  | { readonly kind: "refused"; readonly reason: string }
  | { readonly kind: "defect"; readonly reason: string };

/** One revise draft as a reader needs it (D-0077 rule 5.1): whose it is and what it holds. */
export interface StoredReviseDraft {
  readonly proposalId: string;
  readonly drafter: string;
  /** `{kind: "drafted", lead, changes}` or `{kind: "unavailable", reason}`, as written. */
  readonly payload: JsonRecord;
  readonly createdAtMs: number;
}

/**
 * The advisory record, as D-0032 leaves it.
 *
 * A second port over the same connection rather than more methods on
 * {@link IterationStore}, because they answer different questions for different
 * callers: the loop drives one iteration and never reads a proposal, and the
 * operator's surface reads proposals and drives no iteration. The one method
 * that belongs to the iteration table -- {@link IterationStore.terminalIterations}
 * -- stayed there, beside the two reads it completes.
 *
 * **There is no reader for a proposal, a composition or a decision here, and
 * that is scope rather than an omission.** D-0032 rule 12 names the DDL, the
 * writer refusals of rules 5 and 10, rule 5's planted case and rule 11's three
 * queries as this work, in that order; reading a row back into a rendered shape
 * is the surface's, and D-0032 rule 2's reader refusal -- a basis whose form is
 * not one of the closed union's members -- belongs with it. What ships here is
 * what the entry listed.
 */
export interface AdvisoryRecord {
  /**
   * Append one message to the operator conversation -- **or refuse it**
   * (D-0036 rule 3).
   *
   * The id is all a message is here (see the `conversation_message` DDL), so
   * this takes one and returns one of three answers. A second call under an id
   * that already exists is **refused rather than taken as a no-op**: the store
   * holds no body, so it cannot tell a repeat of one message from a different
   * message reusing an id, and rule 3's first property is that the id is
   * immutable. Refusing is the answer that cannot silently be wrong.
   */
  recordMessage(messageId: string): Promise<RecordOutcome>;
  /**
   * Append one message to a request thread -- **or refuse it** (D-0061 rules
   * 2 and 3).
   *
   * Refused, inside one `BEGIN IMMEDIATE`: an id already in the conversation
   * (D-0036 rule 3); an author kind that is not `operator` or `drafter`; a blank
   * author id or an empty body; an `inReplyTo` that is no thread message; a
   * `drafter` message with no bases (rule 2.6); and a `message:` basis naming
   * no message in the conversation, for D-0036 rule 4's reason. Nothing
   * updates or deletes a message: a correction is a reply.
   *
   * **An id already in the conversation leaves as `duplicate`** and not as one
   * refusal among many (rondo#200), because the callers differ on what it
   * means: a report named after the gate it describes is *already reported*,
   * and an operator's own id is D-0036 rule 3's refusal. `asRefusal` turns the
   * arm back into the second.
   */
  recordThreadMessage(draft: ThreadMessageDraft): Promise<MessageRecordOutcome>;
  /**
   * Append one immutable proposal (D-0022 rule 4) -- **or refuse it**
   * (D-0036 rule 4).
   *
   * A draft naming an `elevatedFromMessageId` that is no message in the
   * conversation is refused, in the shape D-0032 rule 5 already uses: the
   * lookup and the insert happen inside one `BEGIN IMMEDIATE`, so the message
   * that was there when the reference was checked is still there when the row
   * lands. A dangling reference would make the chain #41 section 3 asks to
   * record indistinguishable from one that was never recorded -- and it would
   * do so afterwards, when the message that justified the proposal is what a
   * reader went looking for.
   */
  recordProposal(draft: ProposalDraft): Promise<RecordOutcome>;
  /**
   * Append one message **and** the proposal elevated from it, or neither
   * (#41 section 3, D-0036 rules 3 and 4).
   *
   * **One transaction, because it is one gesture.** A message id is spent for
   * ever once appended (rule 3), so a message written beside a proposal that
   * was not is an id the operator cannot retype and a row in the conversation
   * with no observation behind it -- a conversation that lies about what was
   * said, produced by a store fault rather than by anyone. Either both rows
   * land or the operator retries with the name they already chose.
   *
   * It also makes D-0036 rule 4 unreachable from this writer rather than
   * merely refused by it: the message the proposal names is inserted first, in
   * the same transaction. The refusal still guards `recordProposal`, which is
   * where a caller can hand over a reference it did not write.
   */
  recordElevation(messageId: string, draft: ProposalDraft): Promise<RecordOutcome>;
  /** Append the contract that is about to be presented (D-0022 rule 18). */
  recordComposition(draft: CompositionDraft): Promise<RecordOutcome>;
  /**
   * Append what a person answered -- **or refuse it** (D-0032 rules 5 and 6).
   *
   * The refusal is the rule: the proposal's `kind` is read inside this method's
   * own `BEGIN IMMEDIATE` and an answer naming a kind that binds nothing is
   * refused there. Authority is a function of `kind` alone, and this is where
   * that stops being a sentence.
   *
   * **A second refusal joins it in that transaction** (D-0049 rule 2): an
   * approval whose `approved` is no `composition` row of the proposal it names
   * is a dangling reference, and it is refused for D-0036 rule 4's reason --
   * a reference to a row that is not there makes the chain unrecordable rather
   * than recorded. It is a question about what was *presented* and never about
   * what still composes; the second belongs to the spend (D-0047 rule 4).
   */
  recordDecision(draft: HumanDecisionDraft): Promise<RecordOutcome>;
  /**
   * Spend one decision, once (`advisory.md` 6.3).
   *
   * The primary key on `decision_consumption.decision_id` is what makes a
   * second issuance impossible, and it is the database's refusal rather than a
   * check somebody remembered to write. **The delegation row joins this
   * transaction when `D-0020` rule 4's table lands**; until then the
   * consumption is the whole of what rondo has to write, and the guarantee it
   * carries is unchanged.
   */
  consumeDecision(
    decisionId: string,
    contractDigest: string,
    nowMs: number,
  ): Promise<RecordOutcome>;
  /**
   * Append the mark for one look (D-0032 rule 9).
   *
   * `viewedAtMs` is **the bound the render's own query used**, sampled before
   * the render read anything and written after it finished. Passing the clock
   * at the end instead loses every row committed while the render was running.
   */
  recordView(actorId: string, viewedAtMs: number): Promise<RecordOutcome>;
  /**
   * Where one actor's reading stopped, or null if they have never looked.
   *
   * The `t` that {@link AdvisoryRecord.changedSince} is asked with, which is
   * what makes rule 9's two columns worth storing. `MAX` rather than the last
   * row inserted: the marks are the caller's clocks and this asks how far the
   * reading has reached, which is the largest of them and not the newest row.
   */
  lastView(actorId: string): Promise<number | null>;
  /**
   * The latest moment this actor did something rondo dated, or null if they
   * never have (rondo#631): a message written, a gate answered, a proposal or
   * a scope decided. A read over rows that already exist, and no mark of its
   * own -- the page takes a person's own press as the latest sure sign of
   * having looked, where a page that only redraws writes nothing (D-0041).
   */
  lastActed(actorId: string): Promise<number | null>;
  /**
   * Append one side of the silence -- **or refuse it** (D-0032 rule 10).
   *
   * A `withheld` row whose `ruleName` is absent or blank is refused: a
   * withholding whose rule cannot be named is a judgement with no policy behind
   * it, and *"suppressed 40"* is a number where *"suppressed 40, of which 31 by
   * the duplicate-delivery rule"* is a record.
   */
  recordAttention(row: OperatorAttention): Promise<RecordOutcome>;
  /**
   * Count a presentation **and say whether this call was the one that counted
   * it** (D-0036 rule 1, from the writer's side).
   *
   * `recordAttention` reports `recorded` either way, because a repeat is a
   * no-op by design and that is right for a surface whose only duty is to be
   * counted once. A caller that *acts* on the first presentation and must not
   * act twice needs the difference, and rondo#311's tick is the first such
   * caller: a second notification about a thing the person has already been
   * told about is the reminder `D-0068` section 2 rule 5 refuses.
   *
   * **Asked as one statement, and not as a read and then a write** (Codex,
   * round 2). Two hosts over one store -- which nothing stops, and which two
   * `rondo web` processes on two ports are -- would both read an episode as
   * unsent before either wrote its row, and both would send. The unique index
   * deduplicates rows and not deliveries; what makes a delivery unique is
   * being the writer whose `INSERT` actually inserted, which is what this
   * answers. A single statement takes the write lock for its own duration, so
   * there is no window here to serialise.
   */
  claimAttention(row: OperatorAttention): Promise<AttentionClaim>;
  /**
   * Every proposal nobody has answered, oldest first (D-0032 rule 6).
   *
   * **A left anti-join and not a status column.** There is no `answered` flag
   * on `proposal` -- the row is immutable -- so "still waiting on a person" is
   * the absence of a `human_decision` naming it, which rule 6 made a
   * distinguishable fact by making *declined* a row of its own.
   *
   * `uptoMs` is the caller's bound, inclusive: rule 9 says the mark is *the
   * bound the render's own query used*, and this is the read the surface
   * writes about -- a proposal counted as presented at a moment before it
   * existed would be a row in `operator_attention` that no clock explains.
   */
  openProposals(uptoMs: number): Promise<readonly OpenProposal[]>;
  /**
   * One proposal, read back whole, so a gate is answerable later than the
   * moment it was drafted (#39).
   *
   * **Total, like {@link IterationStore.read} and for its reason**: a row whose
   * `payload` or `snapshot` will not parse is `unreadable` carrying why, not a
   * throw and not an empty screen. The operator is being asked to approve
   * something, and a renderer that silently showed fewer options than the row
   * holds would be the worst possible outcome of a decode fault.
   *
   * **Both digests are re-derived rather than re-read** (D-0022 rule 4's
   * *"re-derived and not only re-read"*, `requireMatchingDigest`'s precedent
   * for the plan). A payload whose bytes no longer digest to the value stored
   * beside them is not a proposal an operator should be answering, and the one
   * moment that is worth finding out is the moment before they answer it.
   */
  readProposal(proposalId: string): Promise<ProposalReadOutcome>;
  /**
   * The silence, as one `GROUP BY` over one table (D-0032 rule 10).
   *
   * Both dispositions in one answer, because the ratio is the point: a
   * numerator counted here and a denominator counted somewhere else would be
   * two quantities with no sentence between them.
   *
   * **`interval` bounds it, and that is #40's falsifier rather than a
   * convenience** (D-0037 rule 6). #40 asks that an operator be able to
   * reconstruct what was withheld from them *in a given interval*, by rule and
   * by count; without a bound this answers over all of time, which is a number
   * nobody can attach to a morning. Omitting it is the unbounded count, which
   * is what the inbox still shows beside the narrower one.
   */
  attentionBreakdown(interval?: AttentionInterval): Promise<readonly AttentionCount[]>;
  /**
   * The same silence, narrowed to **one request** rather than to an interval
   * (D-0083 rule 6's fifth item).
   *
   * **Why a second read and not an argument to the one above.** That one
   * answers over a window and groups both dispositions, because the ratio is
   * what an interval is asked for. This one answers "what did rondo decide
   * without asking *about this*", which is the withheld side alone and has no
   * denominator: a request nobody was asked about is not a request rondo was
   * silent about six times out of ten.
   *
   * **The join is the proposal, and the ceiling is stated rather than
   * hidden.** A withholding names its subject, and a subject is tied to a
   * request by the proposal's own lap or by the message it was elevated from.
   * A row whose `subject_id` is null -- the most common withholding, which was
   * never composed into a proposal at all -- belongs to no request and is not
   * counted here. That is D-0032 rule 10's own residue narrowed, and it is why
   * the page says *decided without asking* of a request and never *decided
   * nothing*.
   */
  withheldFor(requestMessageId: string): Promise<readonly WithheldByRule[]>;
  /**
   * Every admission a bound refused, oldest first (D-0023 rule 14, D-0037
   * rule 3c).
   *
   * **The rows are already written and nothing has ever read them**:
   * {@link AdvisoryRecord.changedSince} counts one as a change and says nothing
   * about what it was, so *"work deliberately not started"* -- #40's third
   * measured case -- has had no reader at all. This is that reader and nothing
   * more: no bound is raised here and no admission is retried.
   *
   * Unbounded, for D-0037 rule 5's reason: this surface withholds nothing, and
   * a cap taken inside a query would be a withholding that names no rule.
   */
  admissionRefusals(): Promise<readonly AdmissionRefusal[]>;
  /** Every approval that was never spent (D-0022 rule 19, D-0032 rule 11). */
  unconsumedDecisions(): Promise<readonly UnconsumedDecision[]>;
  /**
   * Every record that landed at or after `tMs`, oldest first (D-0032 rule 11).
   *
   * **Inclusive of the bound**, which is rule 9's shape and not an off-by-one:
   * the mark is the upper limit the render's own queries used, so a row bearing
   * exactly that timestamp may or may not have been displayed. The failure this
   * accepts is showing something twice; the failure it avoids is losing
   * something for ever.
   */
  changedSince(tMs: number): Promise<readonly RecordChange[]>;
  /**
   * Every decision the store holds at or after `sinceMs` (inclusive; null for
   * all), oldest first, with `operator_attention` only when `attention` asks
   * for it (D-0190 rule 10). Derived from the rows the writers wrote, and kept
   * apart from {@link AdvisoryRecord.changedSince}'s sources.
   */
  decisions(sinceMs: number | null, attention: boolean): Promise<readonly DecisionRow[]>;
  /**
   * How often a drafter under `drafterPrefix` asked back in each request opened
   * at or after `sinceMs`, and how often the person pressed its recommended
   * option (rondo#637). Derived, like {@link AdvisoryRecord.decisions}.
   */
  askFrequency(sinceMs: number | null, drafterPrefix: string): Promise<readonly AskFrequencyRow[]>;
  /**
   * Append one scope row -- **or refuse it** (D-0066 section 1).
   *
   * In one `BEGIN IMMEDIATE`: the payload is read by `readScopePayload`; a
   * `drafter` row with no bases is refused (rule 1.5); a `supersedesScopeId`
   * naming no row, or this row, is refused; every `requests` id must be a
   * message that opens a request and every `agent_types` digest a record rondo
   * already holds; an id already taken is refused.
   *
   * **D-0069 section 1**: `agentTypeRecords` are written as `agent_type_record`
   * rows in the same transaction, before the `agent_types` test, so a digest an
   * operator's plan recorded counts as held. Only an `operator` row may record
   * one, and only for a digest its own `agent_types` lists; a digest already
   * recorded writes nothing (append-only). The whole write rolls back with a
   * refusal, so a refused scope leaves no record behind. The payload is stored as
   * canonical JSON beside `contentDigest` over it.
   */
  recordScope(draft: ScopeDraft): Promise<RecordOutcome>;
  /**
   * Append a person's answer to one scope row -- **or refuse it** (D-0066
   * section 2): a scope that is not a row, a digest that is not the row's
   * (rule 2.2), and a second decision on one row (rule 2.3).
   */
  recordScopeDecision(draft: ScopeDecisionDraft): Promise<RecordOutcome>;
  /** One scope row, its digest re-derived; a mismatch is `unreadable` (`verbatim`'s precedent). */
  readScope(scopeId: string): Promise<ScopeReadOutcome>;
  /**
   * Every scope row that lists one request, oldest first (rondo#238 C2b): the
   * scope screen's way to the scope a drafter drafted for it and to the
   * person's own scope that replaced it. A row that will not read is skipped.
   */
  scopesFor(requestMessageId: string): Promise<readonly StoredScope[]>;
  /** The message opening a request, or null for any other id (D-0128 rule 1's goal test). */
  requestOpener(messageId: string): Promise<RequestOpener | null>;
  /**
   * The held record behind one agent-type digest, for the scope's screen to
   * read the tier and grants back from (D-0069 section 1): an
   * `agent_type_record` row first, else the earliest iteration row with that
   * `agent_type_digest`.
   */
  heldAgentType(agentTypeDigest: string): Promise<HeldAgentTypeOutcome>;
  /**
   * Every digest an `agent_type_record` row holds, oldest first: the half of
   * the held agent types the iteration rows do not already name (D-0071 rule
   * 2.1.2). Each is read back through {@link heldAgentType}.
   */
  heldAgentTypeDigests(): Promise<readonly string[]>;
  /**
   * Append one setup row (D-0075 rule 2.2). A row whose plan names another
   * `repository` than the rows already here is admitted: one store's setup
   * rows are **this host's repositories'**, and setup run again under the same
   * root is how a repository is added (D-0081 rule 5, withdrawing D-0075 rule
   * 1.1). Refused only for a `setup_id` this store already holds.
   */
  recordSetupPlan(draft: SetupPlanDraft): Promise<RecordOutcome>;
  /** Every setup row, oldest first. A row whose bytes will not parse is skipped. */
  setupPlans(): Promise<readonly StoredSetupPlan[]>;
  /**
   * Append one goal row (D-0097 point 2.1 (a)). Refused for an id already
   * held, a goal with no clause, and a clause with nothing said in either half.
   */
  recordGoal(draft: GoalDraft): Promise<RecordOutcome>;
  /** Every goal row, oldest first; the newest of a repository is its goal. */
  goals(): Promise<readonly StoredGoal[]>;
  /**
   * Append one standing policy (D-0067 rule 6). Refused for a drafter's row
   * with no `message:` basis to an operator message or naming a predecessor,
   * an empty row that retires nothing, and a successor of a policy not in force.
   */
  recordStandingPolicy(draft: StandingPolicyDraft): Promise<RecordOutcome>;
  /** Every policy in force, oldest first: no successor names it and it is not empty. */
  standingPolicies(): Promise<readonly StoredStandingPolicy[]>;
  /** Every message a policy row rests on, in force or not: words never kept from again. */
  policySources(): Promise<ReadonlySet<string>>;
  /**
   * Record a *not now* (D-0097 point 4.5 (a)). Refused when the proposal is
   * not a triage row, or the candidate is not one it proposed.
   */
  recordTriageDecline(draft: TriageDeclineDraft): Promise<RecordOutcome>;
  /** Every *not now*, oldest first. */
  triageDeclines(): Promise<readonly StoredTriageDecline[]>;
  /**
   * Record a stop the flow met before its first request (rondo#488). Refused
   * for an id already held: the same stop is recorded once.
   */
  recordFlowStop(draft: FlowStopDraft): Promise<RecordOutcome>;
  /** Every flow stop, oldest first. */
  flowStops(): Promise<readonly StoredFlowStop[]>;
  /**
   * Record one reading in the person's language (rondo#490). A second write
   * under the same digest and language is `duplicate`: the first stands.
   */
  recordTranslation(
    draft: TranslationDraft,
  ): Promise<RecordOutcome | { readonly kind: "duplicate" }>;
  /** Every reading in one language, oldest first. */
  translations(language: string): Promise<readonly StoredTranslation[]>;
  /**
   * Record the flow host's ask over a candidate's open points (rondo#487). A
   * second write under the same id is `duplicate`: the ask is asked once.
   */
  recordFlowAsk(draft: FlowAskDraft): Promise<RecordOutcome | { readonly kind: "duplicate" }>;
  /**
   * Record a person's answer to a flow ask. Refused when the ask is not
   * there, is answered already, or the answers do not match its points.
   */
  recordFlowAnswer(draft: FlowAnswerDraft): Promise<RecordOutcome>;
  /** Every flow ask with its answer, oldest first. */
  flowAsks(): Promise<readonly StoredFlowAsk[]>;
  /** The newest triage proposal of each repository, oldest repository first. */
  latestTriage(): Promise<readonly StoredTriage[]>;
  /**
   * What one model drafter run writes, **all in one transaction or nothing**
   * (D-0071 rule 7.3): its proposal row, the scope it drafted, and its thread
   * messages -- or, for an unavailable run, its one message. `stale` when the
   * request's thread gained an operator message after the run's document was
   * assembled (rule 7.2), and then nothing is written.
   */
  recordDraft(write: DraftRunWrite): Promise<DraftWriteOutcome>;
  /**
   * Every operator message a drafter row covers (D-0071 rule 3.2): one a
   * proposal row by a drafter named with `drafterPrefix` lists under its
   * snapshot's `covers`, or one such a drafter's message cites by `message:`
   * -- and only where that row's material held every issue read answering it
   * (`D-0131` rule 1). A `forge` message a row cites is material it held, not
   * a message it covers, so it is never in this set.
   */
  draftedMessageIds(drafterPrefix: string): Promise<ReadonlySet<string>>;
  /** One explainer answer (D-0177), all or nothing; see {@link AnswerWrite}. */
  recordAnswer(write: AnswerWrite): Promise<AnswerWriteOutcome>;
  /**
   * The person's questions (`question-` ids, D-0177) that no drafter message
   * named with `drafterPrefix` cites by `message:` yet, oldest first.
   */
  unansweredQuestionIds(drafterPrefix: string): Promise<readonly string[]>;
  /**
   * The newest split a drafter named with `drafterPrefix` wrote for
   * `requestMessageId` (its snapshot's material names the request), or null
   * (rondo#469: a request a goal scope covers has no drafted scope to find it by).
   */
  latestSplitFor(requestMessageId: string, drafterPrefix: string): Promise<string | null>;
  /**
   * Take the one drafter run of a thread (D-0071 rule 3.3) until `untilMs`,
   * or learn that another holder has it. True when `holder` now holds it.
   */
  claimDraft(
    requestMessageId: string,
    holder: string,
    nowMs: number,
    untilMs: number,
  ): Promise<boolean>;
  /** Give a thread's run back; a lease another holder took since is left alone. */
  releaseDraft(requestMessageId: string, holder: string): Promise<void>;
  /**
   * What one run of the revise drafter writes (D-0077 rules 2.3 and 5.1): its
   * one `revise_draft` proposal row, **or nothing**. Under one lock with the
   * write: `stale` when the lap is no longer waiting at `gateId`, or its latest
   * model reading is no longer the one the snapshot holds under `reading`;
   * `covered` when a revise draft already holds that reading, so a second host
   * writes nothing twice.
   */
  recordReviseDraft(proposal: ProposalDraft, gateId: string): Promise<DraftWriteOutcome>;
  /**
   * The newest revise draft of `iterationId` whose snapshot holds `reading`,
   * compared by content (D-0077 rule 2.2, D-0051), or null when none does:
   * that reading has not been drafted.
   */
  reviseDraftFor(iterationId: string, reading: LapReading): Promise<StoredReviseDraft | null>;
  /**
   * What one composing of a pull request's English body writes (`D-0079`
   * section 4, rondo#290): its one `publish_body` proposal row, **or nothing**.
   * Under one lock with the write: `stale` when the lap is no longer closed at
   * `gateId`, and `covered` when a row already holds that gate, so the body a
   * screen showed is the body a press publishes however many times either runs.
   */
  recordPublishBody(proposal: ProposalDraft, gateId: string): Promise<DraftWriteOutcome>;
  /**
   * The newest composed body of `iterationId` at `gateId`, or null when none is
   * recorded: this lap's body has not been composed. Read by the preview and by
   * the press, which is what makes them one body (rondo#290).
   */
  publishBodyFor(iterationId: string, gateId: string): Promise<StoredReviseDraft | null>;
  /**
   * The operator messages written before a model drafter host first ran on
   * this store, recording that moment on the first call. A host never drafts a
   * thread for these alone: starting one must not spend on the past unasked.
   */
  messagesBeforeDrafter(nowMs: number): Promise<ReadonlySet<string>>;
  /**
   * {@link messagesBeforeDrafter} for D-0078's issue reader: the operator
   * messages written before a host that reads named issues first ran on this
   * store. Their issues are not read unasked.
   */
  messagesBeforeIssueReader(nowMs: number): Promise<ReadonlySet<string>>;
  readScopeDecision(scopeDecisionId: string): Promise<ScopeDecisionReadOutcome>;
  /**
   * The one decision on a scope row, or `absent` while nobody has answered it.
   * One, because the writer refuses a second (D-0066 rule 2.3); the verb reads
   * it to say what a predecessor's approval spent before its successor is
   * approved (rule 1.4).
   */
  scopeDecisionOf(scopeId: string): Promise<ScopeDecisionReadOutcome>;
  /** What an approval has spent, counted from its consumption rows (D-0066 rule 3.4). */
  scopeSpent(scopeDecisionId: string): Promise<ScopeSpent>;
  /**
   * The approval one lap was admitted under, read off its `admission`
   * consumption row, or null when it was admitted under none (rondo#233 S4,
   * rondo#228's reading of the same row).
   *
   * **It is what lets a surface name a scope nobody typed.** The page offers an
   * in-scope revise at a gate, and the alternative to this read is a person
   * copying a decision id off an earlier screen -- which is the thing the page
   * exists not to ask for. Null, and never a guess, when the row is not there
   * or when more than one names this lap: an `admission` is written once per
   * lap inside `reserve()`'s transaction, so a second row is a store this
   * reader has no business choosing between.
   */
  scopeDecisionAdmitting(iterationId: string): Promise<string | null>;
  /**
   * Every approval still in force, oldest first: `approved`, and no successor of
   * its scope at any depth approved (D-0066 rule 1.4). Where the order tick
   * finds the splits it starts (D-0127). Writes nothing.
   */
  approvalsInForce(): Promise<
    readonly { readonly scopeDecisionId: string; readonly scopeId: string }[]
  >;
  /**
   * Whether some successor of this scope, at any depth, carries an `approved`
   * decision (D-0066 rule 1.4). A drafted-only or declined successor retires
   * nothing.
   */
  scopeSupersededByApproved(scopeId: string): Promise<boolean>;
  /**
   * The approved tip of the chain that starts at this approval (D-0074
   * section 2.1): the approved descendant of its scope with no approved
   * descendant of its own, or the approval itself when nothing below it is
   * approved. **`forked` when there are two such tips**, which D-0074 rule 1.3
   * keeps from being written and this reader does not choose between.
   */
  scopeTip(scopeDecisionId: string): Promise<ScopeTip>;
  /**
   * Claim an act under an approved scope before taking it -- claim, then act,
   * as `D-0042` -- so a second attempt is refused: a merge on green
   * (`merge_default_branch`, D-0126 rule 3, subject the iteration id), the
   * organisation's gate answer (`gate_answer`, D-0125 rule 5, subject the gate
   * id), a scoped publish's push and pull request (`push_branch`,
   * `open_pull_request`, rondo#470, subject the iteration id), or a triage
   * reading the flow host injects from (`triage_reading`, rondo#469, subject
   * the triage proposal id), or an explainer's answer (`explanation_reading`,
   * D-0177, subject the explanation proposal id; `recordAnswer` claims it in its
   * own transaction). **One per subject, whichever approval claims it**:
   * the key alone would let a successor approval claim the same subject again.
   */
  claimScopedAct(claim: {
    readonly actKind: Exclude<(typeof WRITABLE_SCOPE_ACT_KINDS)[number], "admission">;
    readonly scopeDecisionId: string;
    readonly subjectId: string;
    readonly nowMs: number;
  }): Promise<RecordOutcome>;
  /**
   * The messages with `asks` set and no reply in the thread `requestMessageId`
   * opens, each with the iterations its bases name (D-0061 rule 2.7, D-0066
   * rule 4.2). The same query `reserve()` re-tests under the write lock.
   */
  openAsksIn(requestMessageId: string): Promise<OpenAsksReadOutcome>;
  /**
   * Every thread message in the conversation, oldest first, in the shape its
   * writer was handed (D-0061 rule 2): the page's thread view reads it. An
   * elevation's id-only row is no thread message and is not here.
   */
  threadMessages(): Promise<ThreadMessagesReadOutcome>;
  /**
   * Every iteration in `iterationId`'s lineage: all that share its root, the end
   * of its `supersedes` chain (D-0030, D-0066 rule 4.2), or null when a walk
   * passes the bound. The same query `reserve()` re-tests under the write lock.
   */
  lineageOf(iterationId: string): Promise<readonly string[] | null>;
}

/** What {@link AdvisoryRecord.scopeTip} answers (D-0074 section 2.1). */
export type ScopeTip =
  | { readonly kind: "tip"; readonly scopeDecisionId: string }
  | { readonly kind: "forked"; readonly scopeDecisionIds: readonly string[] }
  | { readonly kind: "absent" };
