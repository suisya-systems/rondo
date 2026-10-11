/**
 * The advisory record over a connection: the thread, proposals, decisions,
 * scopes, goals and the drafts and asks the flow writes.
 *
 * Split out of `src/store/sqlite.ts` (D-0171), which still owns the driver and
 * opens the connection this is handed.
 */

import { type AskFrequencyRow, readAskFrequency } from "./ask-frequency.js";
import { askOptionsJson } from "./ask-options.js";
import {
  type AdvisoryRecord,
  type AnswerWrite,
  type AnswerWriteOutcome,
  asRefusal,
  type DraftRunWrite,
  type DraftWriteOutcome,
  type HeldAgentTypeOutcome,
  type MessageRecordOutcome,
  type OpenAsksReadOutcome,
  type ProposalReadOutcome,
  type RecordOutcome,
  type ScopeDecisionReadOutcome,
  type ScopeReadOutcome,
  type ScopeTip,
  type StoredReviseDraft,
  type ThreadMessagesReadOutcome,
} from "./contract.js";
import { type DecisionRow, readDecisions } from "./decision-log.js";
import { canonicalJson, contentDigest, planDigest } from "./plan.js";
import {
  type AdmissionRefusal,
  type AttentionClaim,
  type AttentionCount,
  type AttentionInterval,
  type CompositionDraft,
  type FlowAnswerDraft,
  type FlowAskDraft,
  type FlowStopDraft,
  type GoalDraft,
  type HumanDecisionDraft,
  isApprovableKind,
  isModelReadingDrafter,
  isQuestion,
  type JsonRecord,
  type JsonValue,
  type LapReading,
  latestReading,
  namedRequests,
  type OpenProposal,
  type OperatorAttention,
  type ProposalDraft,
  type RecordChange,
  type RequestOpener,
  readingContent,
  requestsGoal,
  type ScopeDecisionDraft,
  type ScopeDraft,
  type ScopeSpent,
  type SetupPlanDraft,
  type StoredFlowAsk,
  type StoredFlowStop,
  type StoredGoal,
  type StoredScope,
  type StoredSetupPlan,
  type StoredTranslation,
  type StoredTriage,
  type StoredTriageDecline,
  scopeCoversRequest,
  type ThreadMessageDraft,
  type TranslationDraft,
  type TriageDeclineDraft,
  type UnconsumedDecision,
  type WithheldByRule,
  type WRITABLE_SCOPE_ACT_KINDS,
} from "./records.js";
import {
  describe,
  immediateTransaction,
  isRecord,
  isUniqueViolation,
  lineageOf,
  readingsOf,
  type SqlRow,
  type StoreConnection,
  StoreDefect,
  toProposal,
} from "./rows.js";
import {
  addFlowWords,
  addMissingColumns,
  CHANGE_SOURCES,
  CHANGES_SINCE_SQL,
  CONVERSATION_ADDED_COLUMNS,
  SCHEMA,
} from "./schema.js";
import {
  admittedUnder,
  forkedBy,
  requestOpenerOf,
  requestStanding,
  SELECT_SCOPE,
  scopeDecisionWhere,
  spendDecision,
  spentUnder,
  supersededByApproved,
  tipOf,
  toScope,
} from "./scope.js";
import { readScopePayload } from "./scope-payload.js";
import {
  inForcePolicies,
  insertStandingPolicy,
  policySources,
  recordStandingPolicy,
  type StandingPolicyDraft,
  type StoredStandingPolicy,
  standingPolicyRefusal,
} from "./standing-policy.js";
import {
  coveredMessageIds,
  flowPoints,
  messagesBeforeEpoch,
  openAsksIn,
  pastedPlanRefusal,
  publishBodyHolding,
  reviseDraftHolding,
  setupPlanRefusal,
  threadMessageRefusal,
  threadMessages,
  threadOperatorMessages,
  triageKeys,
  triageRepository,
  unansweredQuestionIds,
} from "./thread.js";

/** Thrown inside a draft's transaction to roll back what it already inserted. */
class DraftRefusal extends Error {}

/**
 * Where an explainer write breaks D-0177's shape, or null. Checked before the
 * transaction: an answer binds nothing and asks nothing, is the explainer's own
 * voice on both rows, replies to the question it cites, and cites the
 * explanation it is the prose of -- the citation `unansweredQuestionIds` reads.
 */
function answerFault(write: AnswerWrite): AnswerWriteOutcome | null {
  const { proposal, message, questionId } = write;
  const cites = (form: string, key: string, id: string): boolean =>
    message.bases.some((basis) => basis["form"] === form && basis[key] === id);
  const faults: readonly (readonly [boolean, string, string])[] = [
    [proposal.kind !== "explanation", "proposal.kind", "an answer's proposal is an explanation"],
    [proposal.derivation === null, "proposal.derivation", "an explanation names its derivation"],
    [
      !proposal.drafter.startsWith(write.drafterPrefix),
      "proposal.drafter",
      `the explainer writes under '${write.drafterPrefix}'`,
    ],
    [message.authorKind !== "drafter", "message.authorKind", "an answer is a drafter message"],
    [
      message.authorId !== proposal.drafter,
      "message.authorId",
      "the answer and its explanation have one author",
    ],
    [message.asks, "message.asks", "an explanation asks nothing"],
    [message.answerOutcome !== undefined, "message.answerOutcome", "an answer answers no ask"],
    [message.inReplyTo !== questionId, "message.inReplyTo", "an answer replies to its question"],
    [
      !cites("message", "messageId", questionId) ||
        !cites("proposal", "proposalId", proposal.proposalId),
      "message.bases",
      "an answer cites its question and its explanation",
    ],
  ];
  const fault = faults.find(([broken]) => broken);
  return fault === undefined ? null : { kind: "malformed", field: fault[1], reason: fault[2] };
}

/**
 * The advisory record over an open connection.
 *
 * Applies {@link SCHEMA} for {@link iterationStore}'s reason -- every statement
 * in it is `IF NOT EXISTS`, so opening either port over either database is
 * idempotent and neither has to be opened first. It does **not** run
 * {@link migrate}: that is the `iteration` table's column history, and nothing
 * here reads a column the migration adds.
 */
export function advisoryRecord(connection: StoreConnection): AdvisoryRecord {
  connection.exec(SCHEMA);
  // The thread's columns, for a database this port opens before the iteration
  // store has migrated it: `changedSince` names `at_ms`.
  immediateTransaction(connection, () => {
    addMissingColumns(connection, "conversation_message", CONVERSATION_ADDED_COLUMNS);
    addFlowWords(connection);
  });

  /**
   * Run one insert, translating a throw into an outcome.
   *
   * Bare rather than wrapped in `BEGIN IMMEDIATE`, and that is not a shortcut:
   * a single statement takes the write lock for its own duration, so there is
   * no window between a decision and a write to serialise. `recordDecision` is
   * the one writer here that reads before it writes, and it is the one that
   * takes a transaction.
   */
  const insert = (sql: string, values: readonly (string | number | null)[]): RecordOutcome => {
    try {
      connection.prepare(sql).run(...values);
      return { kind: "recorded" };
    } catch (error) {
      return { kind: "defect", reason: describe(error) };
    }
  };

  /**
   * Append one message, **inside whatever transaction the caller holds**.
   *
   * Shared by `recordMessage` and `recordElevation` so that "a message id is
   * durable and immutable" (D-0036 rule 3) has one implementation and one
   * refusal, whether the operator's observation arrives on its own or as half
   * of an elevation.
   */
  const insertMessage = (messageId: string, thread?: ThreadMessageDraft): MessageRecordOutcome => {
    try {
      if (thread === undefined) {
        connection
          .prepare("INSERT INTO conversation_message (message_id) VALUES (?)")
          .run(messageId);
      } else {
        connection
          .prepare(
            "INSERT INTO conversation_message (message_id, body, author_kind, author_id, " +
              "in_reply_to, at_ms, bases, asks, answer_outcome, ask_options, answer_option) " +
              "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .run(
            messageId,
            thread.body,
            thread.authorKind,
            thread.authorId,
            thread.inReplyTo,
            thread.atMs,
            canonicalJson([...thread.bases]),
            thread.asks ? 1 : 0,
            thread.answerOutcome ?? null,
            thread.askOptions === undefined ? null : askOptionsJson(thread.askOptions),
            thread.answerOption ?? null,
          );
      }
      return { kind: "recorded" };
    } catch (error) {
      if (isUniqueViolation(error)) {
        // The database's answer, said in rondo's words rather than the
        // driver's -- `consumeDecision`'s precedent. This is D-0036 rule 3's
        // first property observed firing: an id already spoken for cannot be
        // spoken for again, so nothing a proposal already elevated from can
        // come to mean something else.
        //
        // It leaves as its own arm and not as prose inside `refused`
        // (rondo#200): whether it is a refusal is the caller's to say, and
        // `asRefusal` says it for every caller whose id an operator composed.
        return { kind: "duplicate", messageId };
      }
      return { kind: "defect", reason: describe(error) };
    }
  };

  /**
   * Insert one proposal with D-0036 rule 4's lookup in front of it, **inside
   * whatever transaction the caller holds**.
   *
   * The lookup and the insert must share a transaction -- the same question
   * asked before it would be a check with a window in it, and the write lock is
   * what makes the message that was there when the reference was checked the
   * message that is still there when the row lands (`recordDecision`'s shape,
   * for `recordDecision`'s reason). Which transaction that is belongs to the
   * caller, because `recordElevation` writes the message inside the same one.
   *
   * A failing insert throws, which rolls the caller's transaction back.
   */
  const insertProposal = (draft: ProposalDraft): RecordOutcome => {
    // Encoded before the insert: `canonicalJson` refuses a value it cannot
    // round-trip, and a proposal whose payload cannot be encoded is rondo
    // handing the store something rondo should not have built. That is a defect
    // and not a refusal, and it reaches the caller's catch as one.
    const payload = canonicalJson(draft.payload);
    const snapshot = canonicalJson(draft.snapshot);
    if (draft.elevatedFromMessageId !== null) {
      const row = connection
        .prepare("SELECT 1 FROM conversation_message WHERE message_id = ?")
        .get(draft.elevatedFromMessageId);
      if (row === undefined) {
        return {
          kind: "refused",
          reason:
            `the proposal '${draft.proposalId}' is elevated from ` +
            `'${draft.elevatedFromMessageId}', which is no message in this conversation: ` +
            "D-0036 rule 4 refuses a dangling elevation, because a reference to nothing " +
            "is indistinguishable from a chain that was never recorded at exactly the " +
            "moment a reader goes looking for what justified the proposal",
        };
      }
    }
    // `candidate_contract_digest` is named by no column list here, so the
    // insert leaves it NULL and the schema's `CHECK` keeps it there
    // (D-0022 rule 4).
    connection
      .prepare(
        "INSERT INTO proposal (proposal_id, kind, drafter, payload, proposal_digest, snapshot, " +
          "snapshot_digest, derivation, iteration_id, supersedes_iteration_id, " +
          "supersedes_proposal_id, predecessor_plan_digest, predecessor_contract_digest, " +
          "agent_type_digest, config_digest, contract_digest, continuo_revision, " +
          "cadenza_revision, elevated_from_message_id, elevated_by_actor_id, created_at_ms) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        draft.proposalId,
        draft.kind,
        draft.drafter,
        payload,
        contentDigest(draft.payload),
        snapshot,
        contentDigest(draft.snapshot),
        draft.derivation,
        draft.iterationId,
        draft.supersedesIterationId,
        draft.supersedesProposalId,
        draft.predecessorPlanDigest,
        draft.predecessorContractDigest,
        draft.agentTypeDigest,
        draft.configDigest,
        draft.contractDigest,
        draft.continuoRevision,
        draft.cadenzaRevision,
        draft.elevatedFromMessageId,
        draft.elevatedByActorId,
        draft.createdAtMs,
      );
    return { kind: "recorded" };
  };

  /**
   * One `scope_consumption` claim, **inside whatever transaction the caller
   * holds**: true when written, false when the subject is already claimed under
   * any approval (`claimScopedAct`'s one-per-subject rule).
   */
  const insertClaim = (
    scopeDecisionId: string,
    actKind: (typeof WRITABLE_SCOPE_ACT_KINDS)[number],
    subjectId: string,
    nowMs: number,
  ): boolean =>
    Number(
      connection
        .prepare(
          "INSERT INTO scope_consumption (scope_decision_id, act_kind, subject_id, proposal_id, " +
            "consumed_at_ms) SELECT ?, ?, ?, NULL, ? WHERE NOT EXISTS (SELECT 1 FROM " +
            "scope_consumption WHERE act_kind = ? AND subject_id = ?)",
        )
        .run(scopeDecisionId, actKind, subjectId, nowMs, actKind, subjectId).changes,
    ) === 1;

  /**
   * One scope row and the agent types it records, **with no transaction of its
   * own**: {@link AdvisoryRecord.recordScope} takes one around it, and
   * {@link AdvisoryRecord.recordDraft} writes it inside the draft's (D-0071
   * rule 7.3). Every refusal is decided before any insert.
   */
  const insertScope = (draft: ScopeDraft): RecordOutcome => {
    const reading = readScopePayload(draft.payload);
    if (reading.kind === "refused") {
      return { kind: "refused", reason: reading.reason };
    }
    if (draft.authorKind === "drafter" && draft.bases.length === 0) {
      // D-0066 rule 1.5, as D-0061 rule 2.6 refuses a drafter message with
      // none: a drafted scope is material, and material with no bases is a
      // claim nobody can check before approving it.
      return {
        kind: "refused",
        reason:
          `the scope '${draft.scopeId}' was drafted with no bases: D-0066 rule 1.5 refuses a ` +
          "drafter's scope that names nothing it was drafted from, because a person approving " +
          "it would have nothing to check it against",
      };
    }
    const successorOf = draft.supersedesScopeId;
    if (successorOf === draft.scopeId) {
      return {
        kind: "refused",
        reason:
          `the scope '${draft.scopeId}' names itself as the scope it supersedes, and a ` +
          "change to a scope is a new row under an id of its own (D-0066 rule 1.4)",
      };
    }
    if (
      successorOf !== null &&
      connection.prepare("SELECT 1 FROM scope WHERE scope_id = ?").get(successorOf) === undefined
    ) {
      return {
        kind: "refused",
        reason:
          `the scope '${draft.scopeId}' supersedes '${successorOf}', which is no scope in ` +
          "this store: a successor of nothing would retire nothing while reading as a " +
          "change (D-0066 rule 1.4, D-0049 rule 2's dangling-reference shape)",
      };
    }
    // **Each request is a message that opens one** (D-0066 rule 1.2.1,
    // D-0061 rule 1): a thread message with no `in_reply_to`, by the same
    // test `reserve()` makes of a lap's request link. An elevation's bare
    // id or a reply is a message, and neither is a request.
    const goalScope = requestsGoal(reading.payload.requests);
    if (
      goalScope !== null &&
      connection.prepare("SELECT 1 FROM goal WHERE goal_id = ?").get(goalScope) === undefined
    ) {
      return {
        kind: "refused",
        reason:
          `the scope '${draft.scopeId}' covers the requests from goal '${goalScope}', which is ` +
          "no goal row: a scope over a goal nobody wrote covers nothing a reader can follow " +
          "(D-0128 rule 1)",
      };
    }
    for (const messageId of namedRequests(reading.payload.requests)) {
      const standing = requestStanding(connection, messageId);
      if (standing !== "opens") {
        return {
          kind: "refused",
          reason:
            `the scope '${draft.scopeId}' names the request '${messageId}', which ` +
            `${standing === "absent" ? "is no message in this conversation" : "is a message that does not open a request"}: ` +
            "a scope over a request nobody made covers nothing a reader can follow " +
            "(D-0066 rule 1.2.1)",
        };
      }
    }
    // **D-0069 section 1: an operator's plan records its agent type with
    // the scope.** Only an operator's row, because a drafter recording
    // what it then selects is the hole D-0022 rule 7 refuses; only a
    // listed digest, because a record exists only for a scope a person
    // will be asked to approve. **Every refusal is decided before any
    // insert**: `immediateTransaction` commits what a body returns, so a
    // refusal after an insert would leave a record with no scope.
    //
    // **D-0071's answer to its first point widens "only an operator's row" by
    // one case and keeps its reason**: a drafter's scope records an agent type
    // only from a plan a person pasted into an operator message, copied from
    // that message's bytes and recorded as that message's author's. The
    // drafter selects; the bytes and the author are the person's.
    const recordedBy = new Map<string, string>();
    for (const recorded of draft.agentTypeRecords) {
      if (draft.authorKind === "operator") {
        recordedBy.set(recorded.agentTypeDigest, draft.authorId);
      } else {
        const from =
          recorded.fromSetupId === undefined
            ? pastedPlanRefusal(connection, draft, recorded)
            : setupPlanRefusal(connection, draft, recorded, recorded.fromSetupId);
        if ("refusal" in from) {
          return { kind: "refused", reason: from.refusal };
        }
        recordedBy.set(recorded.agentTypeDigest, from.authorId);
      }
      if (!reading.payload.agent_types.includes(recorded.agentTypeDigest)) {
        return {
          kind: "refused",
          reason:
            `the scope '${draft.scopeId}' records the agent type ` +
            `'${recorded.agentTypeDigest}' from a plan and does not list it: a record ` +
            "is written only for a scope a person will be asked to approve over it " +
            "(D-0069 section 1)",
        };
      }
    }
    const recordedHere = draft.agentTypeRecords.map((recorded) => recorded.agentTypeDigest);
    // **"A record rondo already holds" is D-0062 rule 1.2's**: the
    // agentTypeInput of a plan on an iteration row whose agent_type_digest
    // equals the digest, or an agent_type_record row an operator's plan
    // wrote (D-0069 section 1). A proposal naming a digest does not count --
    // a proposal is a draft, and a draft citing a digest is not the record
    // the digest names.
    for (const digest of reading.payload.agent_types) {
      if (
        !recordedHere.includes(digest) &&
        connection
          .prepare(
            "SELECT 1 FROM iteration WHERE agent_type_digest = ? " +
              "UNION ALL SELECT 1 FROM agent_type_record WHERE agent_type_digest = ? LIMIT 1",
          )
          .get(digest, digest) === undefined
      ) {
        return {
          kind: "refused",
          reason:
            `the scope '${draft.scopeId}' lists the agent type '${digest}', which is no ` +
            "record rondo holds: D-0066 rule 1.2.3 lists agent types rondo already holds " +
            "(D-0062 rule 1.2, an iteration row with that agent_type_digest, or D-0069 " +
            "section 1, one an operator's scope recorded from a plan), and a digest " +
            "nobody can read back bounds no tier and no grant",
        };
      }
    }
    // The first record of a digest is the record (append-only).
    for (const recorded of draft.agentTypeRecords) {
      connection
        .prepare(
          "INSERT INTO agent_type_record (agent_type_digest, agent_type_input, plan_digest, " +
            "recorded_by, recorded_at_ms) VALUES (?, ?, ?, ?, ?) " +
            "ON CONFLICT (agent_type_digest) DO NOTHING",
        )
        .run(
          recorded.agentTypeDigest,
          canonicalJson(recorded.agentTypeInput),
          recorded.planDigest,
          recordedBy.get(recorded.agentTypeDigest) ?? draft.authorId,
          draft.createdAtMs,
        );
    }
    connection
      .prepare(
        "INSERT INTO scope (scope_id, payload, scope_digest, supersedes_scope_id, " +
          "author_kind, author_id, bases, created_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        draft.scopeId,
        canonicalJson(draft.payload),
        contentDigest(draft.payload),
        successorOf,
        draft.authorKind,
        draft.authorId,
        canonicalJson(draft.bases),
        draft.createdAtMs,
      );
    return { kind: "recorded" };
  };

  return {
    async recordMessage(messageId: string): Promise<RecordOutcome> {
      // An operator composed this id, so a second row under it stays the
      // refusal D-0036 rule 3 asks for: nothing here can tell a repeat of one
      // observation from a different one reusing the name.
      return asRefusal(insertMessage(messageId));
    },

    async recordThreadMessage(draft: ThreadMessageDraft): Promise<MessageRecordOutcome> {
      try {
        return immediateTransaction<MessageRecordOutcome>(connection, () => {
          const refusal = threadMessageRefusal(connection, draft);
          if (refusal !== null) {
            return { kind: "refused", reason: refusal };
          }
          return insertMessage(draft.messageId, draft);
        });
      } catch (error) {
        return { kind: "defect", reason: describe(error) };
      }
    },

    async recordProposal(draft: ProposalDraft): Promise<RecordOutcome> {
      // **The transaction is taken whether or not anything was elevated.** A
      // single insert needs none, but two spellings of "record a proposal" --
      // one transactional and one not -- would be two answers to what this
      // writer does about concurrency, chosen by a column's nullness.
      try {
        return immediateTransaction<RecordOutcome>(connection, () => insertProposal(draft));
      } catch (error) {
        return { kind: "defect", reason: describe(error) };
      }
    },

    async recordElevation(messageId: string, draft: ProposalDraft): Promise<RecordOutcome> {
      try {
        return immediateTransaction<RecordOutcome>(connection, () => {
          // The same refusal as `recordMessage`'s, for the same reason: the
          // elevation's message id is the operator's word, not a name rondo
          // derived.
          const appended = asRefusal(insertMessage(messageId));
          if (appended.kind !== "recorded") {
            return appended;
          }
          const recorded = insertProposal(draft);
          if (recorded.kind !== "recorded") {
            // **Unreachable by construction, and thrown rather than returned
            // so that it cannot quietly commit.** The only non-recorded answer
            // `insertProposal` gives is D-0036 rule 4's dangling refusal, and
            // the message it would be dangling from was just inserted in this
            // same transaction. A failing insert throws instead, which rolls
            // back. If this is ever reached the two writers have drifted, and
            // a spent message id would be the quietest possible symptom.
            throw new StoreDefect(
              `the elevation of '${messageId}' was refused after its message was appended, ` +
                `which cannot happen while the two are one transaction: ${recorded.reason}`,
            );
          }
          return recorded;
        });
      } catch (error) {
        return { kind: "defect", reason: describe(error) };
      }
    },

    async recordComposition(draft: CompositionDraft): Promise<RecordOutcome> {
      let contract: string;
      try {
        contract = canonicalJson(draft.contract);
      } catch (error) {
        return { kind: "defect", reason: describe(error) };
      }
      return insert(
        "INSERT INTO composition (composition_id, proposal_id, contract, contract_digest, " +
          "supersedes_contract_digest, cadenza_revision, composed_at_ms) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          draft.compositionId,
          draft.proposalId,
          contract,
          // cadenza's digest, stored as it was given. **Not recomputed here**:
          // the digest a human approves is cadenza's own, and a second one
          // taken over this module's rendering would be a second authority for
          // the one value D-0020 rule 4 fact 1 says must be recomputable rather
          // than trusted. The contract is beside it so a reader can do exactly
          // that recomputation.
          draft.contractDigest,
          draft.supersedesContractDigest,
          draft.cadenzaRevision,
          draft.composedAtMs,
        ],
      );
    },

    async recordDecision(draft: HumanDecisionDraft): Promise<RecordOutcome> {
      try {
        return immediateTransaction<RecordOutcome>(connection, () => {
          // **The read and the write in one `BEGIN IMMEDIATE`, and that is the
          // whole of D-0032 rule 5.** The same question asked before the
          // transaction would be a check with a window in it: the write lock is
          // what makes the kind that was read the kind that is still there when
          // the row lands.
          const row = connection
            .prepare("SELECT kind FROM proposal WHERE proposal_id = ?")
            .get(draft.proposalId);
          if (row === undefined) {
            return {
              kind: "refused",
              reason:
                `a human decision must name a proposal, and '${draft.proposalId}' is not a row ` +
                "in this store: D-0032 rule 5 makes authority a function of the proposal's " +
                "kind, and there is no kind here to read",
            };
          }
          const proposalKind = String((row as SqlRow)["kind"]);
          if (proposalKind === "split") {
            // D-0066 rule 5.1: a split binds through the scope that lists its
            // agent type, and D-0062 rule 3's per-split approval is retired. The
            // kind is not approvable either way; this only says the right why.
            return {
              kind: "refused",
              reason:
                `proposal '${draft.proposalId}' is a split, which is never approved per split: ` +
                "its agent type is approved by a scope that lists it (D-0066 rule 5.1, which " +
                "retires D-0062 rule 3)",
            };
          }
          if (!isApprovableKind(proposalKind)) {
            // **The refusal fires for an unrecognised kind too, and by the same
            // line.** A kind this rondo does not know is not in the approvable
            // set, so D-0022 rule 4's "refuse rather than guess at" is reached
            // without a second spelling of the union -- and the one answer that
            // must never be produced is "approvable".
            return {
              kind: "refused",
              reason:
                `proposal '${draft.proposalId}' has kind '${proposalKind}', which binds nothing ` +
                "and cannot be answered: D-0032 rule 5 makes authority a function of kind " +
                "alone, and an explanation is material a person reads rather than a thing a " +
                "person approves",
            };
          }
          if (draft.outcome === "approved" && draft.approved !== null) {
            // **D-0049 rule 2, in the transaction that is already open.** The
            // schema calls `approved` a reference into `composition`, and
            // nothing enforced it: an approval naming a digest this proposal
            // never carried was recorded, refused one command later at the
            // spend, and left on D-0022 rule 19's *approved and never spent*
            // list for ever, where a real unspent approval also lives.
            //
            // **What is checked is that the contract was on this proposal's
            // screen, and never that it still composes.** D-0022 rule 18 makes
            // `composition` exactly the option set that was presented, and
            // those rows are immutable -- so this question is settled for ever
            // once settled. Whether some option composes the digest *today* is
            // the other question, it is time-varying, and D-0047 rule 4 answers
            // it at the spend over the lineage read fresh. Asking it here would
            // make whether a person's answer can be recorded depend on the
            // state of the world in the second they typed it (D-0049 rule 4).
            //
            // **The two column combinations the schema already refuses are left
            // to it**: a decline carrying a digest, and an approval carrying
            // none, are `human_decision`'s own CHECK (D-0032 rule 12), and a
            // refusal spoken here first would answer them in this rule's words
            // instead of in the schema's.
            const digests = connection
              .prepare(
                "SELECT contract_digest FROM composition WHERE proposal_id = ? " +
                  "ORDER BY composition_id",
              )
              .all(draft.proposalId)
              .map((option) => String((option as SqlRow)["contract_digest"]));
            if (!digests.includes(draft.approved)) {
              // **The refusal names the digests, because the transaction has
              // already read them** (D-0049 rule 3). An operator who mistyped
              // one needs the option set, and a proposal that put nothing on a
              // screen says so rather than listing an empty line.
              return {
                kind: "refused",
                reason:
                  `the approval of proposal '${draft.proposalId}' names contract ` +
                  `'${draft.approved}', which is no option this proposal put on the screen: ` +
                  "D-0032's schema makes human_decision.approved a reference into composition, " +
                  "and D-0049 rule 2 refuses a dangling one -- an answer to a question this " +
                  "proposal never asked is not a record of what a person decided. " +
                  (digests.length === 0
                    ? "This proposal recorded no contract at all, so there is nothing it can " +
                      "be answered with (D-0022 rule 18)"
                    : `Its contracts are: ${digests.join(", ")}`),
              };
            }
          }
          connection
            .prepare(
              "INSERT INTO human_decision (decision_id, proposal_id, outcome, approved, " +
                "predecessor, actor_id, recorded_by, gate_id, gate_transition_seq, " +
                "decided_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .run(
              draft.decisionId,
              draft.proposalId,
              draft.outcome,
              draft.approved,
              draft.predecessor,
              draft.actorId,
              draft.recordedBy,
              draft.gateId,
              draft.gateTransitionSeq,
              draft.decidedAtMs,
            );
          return { kind: "recorded" };
        });
      } catch (error) {
        return { kind: "defect", reason: describe(error) };
      }
    },

    async consumeDecision(
      decisionId: string,
      contractDigest: string,
      nowMs: number,
    ): Promise<RecordOutcome> {
      try {
        // **The read and the insert in one `BEGIN IMMEDIATE`**, for
        // `recordDecision`'s reason: an approval checked in one transaction and
        // spent in another is a check with a window in it.
        return immediateTransaction<RecordOutcome>(connection, () => {
          const refusal = spendDecision(connection, { decisionId, contractDigest }, nowMs);
          return refusal === null ? { kind: "recorded" } : { kind: "refused", reason: refusal };
        });
      } catch (error) {
        return { kind: "defect", reason: describe(error) };
      }
    },

    async recordView(actorId: string, viewedAtMs: number): Promise<RecordOutcome> {
      return insert("INSERT INTO operator_view (actor_id, viewed_at_ms) VALUES (?, ?)", [
        actorId,
        viewedAtMs,
      ]);
    },

    async lastView(actorId: string): Promise<number | null> {
      const row = connection
        .prepare("SELECT MAX(viewed_at_ms) AS mark FROM operator_view WHERE actor_id = ?")
        .get(actorId) as SqlRow | undefined;
      const mark = row === undefined ? null : row["mark"];
      // `MAX` over no rows is one row holding NULL rather than no row at all,
      // so "never looked" arrives here as a null column and not as an absent
      // result. Both are answered the same way, because both are the same fact.
      return mark === null || mark === undefined ? null : Number(mark);
    },

    async lastActed(actorId: string): Promise<number | null> {
      const row = connection
        .prepare(
          "SELECT MAX(at) AS acted FROM (" +
            "SELECT MAX(at_ms) AS at FROM conversation_message " +
            "WHERE author_kind = 'operator' AND author_id = ? " +
            "UNION ALL SELECT MAX(answered_at_ms) FROM gate_answer WHERE actor_id = ? " +
            "UNION ALL SELECT MAX(decided_at_ms) FROM human_decision WHERE actor_id = ? " +
            "UNION ALL SELECT MAX(decided_at_ms) FROM scope_decision WHERE actor_id = ?)",
        )
        .get(actorId, actorId, actorId, actorId) as SqlRow | undefined;
      const acted = row === undefined ? null : row["acted"];
      return acted === null || acted === undefined ? null : Number(acted);
    },

    async recordAttention(row: OperatorAttention): Promise<RecordOutcome> {
      if (row.disposition === "withheld" && (row.ruleName ?? "").trim() === "") {
        // **D-0032 rule 10's writer refusal.** The schema's `CHECK` already
        // refuses a null or an empty string, which covers a row inserted from
        // outside this code; this covers the blank one it cannot see and, more
        // to the point, says what happened in the vocabulary the caller reads.
        return {
          kind: "refused",
          reason:
            "an operator_attention row that withheld something must name the rule that " +
            "withheld it: D-0032 rule 10 refuses a withholding whose rule cannot be named, " +
            "because that is a judgement with no policy behind it and it is the named rule " +
            "that turns a suppressed count into a record",
        };
      }
      // **D-0036 rule 1: a second presentation of one subject stores nothing and
      // reports success.** The conflict target names the partial index rather
      // than being left bare, so a unique constraint added here later is a
      // defect the caller hears about instead of a write this silently drops.
      return insert(
        "INSERT INTO operator_attention (at_ms, subject_kind, subject_id, disposition, " +
          "rule_name) VALUES (?, ?, ?, ?, ?) " +
          "ON CONFLICT (subject_kind, subject_id) WHERE disposition = 'presented' DO NOTHING",
        [row.atMs, row.subjectKind, row.subjectId, row.disposition, row.ruleName],
      );
    },

    async claimAttention(row: OperatorAttention): Promise<AttentionClaim> {
      try {
        // The same statement `recordAttention` writes, read for what it did:
        // `ON CONFLICT ... DO NOTHING` changes one row when it inserted and
        // none when the subject was already counted.
        const done = connection
          .prepare(
            "INSERT INTO operator_attention (at_ms, subject_kind, subject_id, disposition, " +
              "rule_name) VALUES (?, ?, ?, ?, ?) " +
              "ON CONFLICT (subject_kind, subject_id) WHERE disposition = 'presented' DO NOTHING",
          )
          .run(row.atMs, row.subjectKind, row.subjectId, row.disposition, row.ruleName);
        return Number(done.changes) > 0 ? { kind: "claimed" } : { kind: "alreadyCounted" };
      } catch (error) {
        return { kind: "defect", reason: describe(error) };
      }
    },

    async openProposals(uptoMs: number): Promise<readonly OpenProposal[]> {
      return connection
        .prepare(
          "SELECT proposal_id, kind, iteration_id, drafter, created_at_ms FROM proposal " +
            "WHERE created_at_ms <= ? " +
            "AND proposal_id NOT IN (SELECT proposal_id FROM human_decision) " +
            "ORDER BY created_at_ms, proposal_id",
        )
        .all(uptoMs)
        .map((row) => {
          const record = row as SqlRow;
          const iterationId = record["iteration_id"];
          return {
            proposalId: String(record["proposal_id"]),
            // **Not decoded against `PROPOSAL_KINDS`.** A kind this rondo does
            // not know is still a row an operator is waiting on, and the screen
            // reports it as a voice it cannot place rather than dropping it --
            // which is the reader refusal of D-0022 rule 4 applied where the
            // question is "what is waiting" and not "what may be approved".
            kind: String(record["kind"]),
            iterationId: iterationId === null ? null : String(iterationId),
            drafter: String(record["drafter"]),
            createdAtMs: Number(record["created_at_ms"]),
          };
        });
    },

    async readProposal(proposalId: string): Promise<ProposalReadOutcome> {
      const row = connection
        .prepare(
          "SELECT proposal_id, kind, drafter, payload, proposal_digest, snapshot, " +
            "snapshot_digest, derivation, iteration_id, elevated_from_message_id, " +
            "elevated_by_actor_id, cadenza_revision, created_at_ms FROM proposal WHERE proposal_id = ?",
        )
        .get(proposalId);
      if (row === undefined) {
        return { kind: "absent" };
      }
      // The answers are read in the same call rather than left to the caller:
      // "what is this" and "has it been settled" are one question at the only
      // screen that asks either, and two reads would let a proposal render as
      // open because the second one was forgotten (D-0032 rule 6).
      //
      // **All of them, and not the first.** Nothing makes `human_decision`
      // unique per `proposal_id` -- its one unique index is over a continuo
      // gate transition, which a route-S answer does not name -- so a decline
      // followed by an approval is two rows. Returning the earliest would
      // report the proposal as refused while `unconsumedDecisions` reports a
      // spendable approval against it, which is the ledger contradicting the
      // screen at the point where both are about what a person did.
      const answers = connection
        .prepare(
          "SELECT decision_id, outcome, approved, actor_id, decided_at_ms FROM human_decision " +
            "WHERE proposal_id = ? ORDER BY decided_at_ms, decision_id",
        )
        .all(proposalId);
      try {
        return {
          kind: "read",
          proposal: toProposal(row as SqlRow, answers as SqlRow[]),
        };
      } catch (error) {
        if (error instanceof StoreDefect) {
          return { kind: "unreadable", reason: error.message };
        }
        throw error;
      }
    },

    async attentionBreakdown(interval?: AttentionInterval): Promise<readonly AttentionCount[]> {
      const fromMs = interval?.fromMs ?? null;
      const toMs = interval?.toMs ?? null;
      return connection
        .prepare(
          // **Both bounds inclusive, and a null bound is no bound** -- see
          // {@link AttentionInterval}. Written as `? IS NULL OR` rather than as
          // a statement assembled per case so that there is one query and one
          // place the two comparisons can be read: four bound parameters and no
          // interpolation, which is this file's rule everywhere but the two
          // column names chosen from a frozen tuple.
          "SELECT disposition, rule_name, count(*) AS n FROM operator_attention " +
            "WHERE (? IS NULL OR at_ms >= ?) AND (? IS NULL OR at_ms <= ?) " +
            "GROUP BY disposition, rule_name ORDER BY disposition, rule_name",
        )
        .all(fromMs, fromMs, toMs, toMs)
        .map((row) => {
          const record = row as SqlRow;
          const ruleName = record["rule_name"];
          return {
            disposition: record["disposition"] === "withheld" ? "withheld" : "presented",
            ruleName: ruleName === null ? null : String(ruleName),
            count: Number(record["n"]),
          } as const;
        });
    },

    async withheldFor(requestMessageId: string): Promise<readonly WithheldByRule[]> {
      return connection
        .prepare(
          // One statement and no interpolation, like every other read here.
          // `rule_name` cannot be null on a withheld row: the table's CHECK
          // refuses one, so the grouping is over a value that is always there.
          // **The kind is part of the identity** (Codex): a subject is a
          // `(subjectKind, subjectId)` pair, and the table admits iterations
          // and readings beside proposals -- so matching the id alone would
          // attribute a withholding about another kind of subject to this
          // request the moment two id spaces met.
          "SELECT rule_name, count(*) AS n FROM operator_attention " +
            "WHERE disposition = 'withheld' AND subject_kind = 'proposal' " +
            "AND subject_id IS NOT NULL AND subject_id IN (" +
            "SELECT proposal_id FROM proposal WHERE elevated_from_message_id = ? OR " +
            "iteration_id IN (SELECT id FROM iteration WHERE request_message_id = ?)) " +
            "GROUP BY rule_name ORDER BY rule_name",
        )
        .all(requestMessageId, requestMessageId)
        .map((row) => {
          const record = row as SqlRow;
          return { ruleName: String(record["rule_name"]), count: Number(record["n"]) } as const;
        });
    },

    async admissionRefusals(): Promise<readonly AdmissionRefusal[]> {
      return connection
        .prepare(
          "SELECT refused_at_ms, request, bound_name, bound, occupancy FROM admission_refusal " +
            "ORDER BY refused_at_ms, rowid",
        )
        .all()
        .map((row) => {
          const record = row as SqlRow;
          return {
            refusedAtMs: Number(record["refused_at_ms"]),
            request: String(record["request"]),
            boundName: String(record["bound_name"]),
            bound: Number(record["bound"]),
            occupancy: Number(record["occupancy"]),
          } as const;
        });
    },

    async unconsumedDecisions(): Promise<readonly UnconsumedDecision[]> {
      // **`outcome = 'approved'` is D-0032 rule 6 and not a filter chosen
      // here.** A refusal consumes nothing by design, so without this clause
      // every declined proposal would be reported as an approval that never
      // ran -- which is the opposite of what D-0022 rule 19 asks the query for.
      return connection
        .prepare(
          "SELECT decision_id, proposal_id, approved, actor_id, decided_at_ms " +
            "FROM human_decision WHERE outcome = 'approved' AND decision_id NOT IN " +
            "(SELECT decision_id FROM decision_consumption) ORDER BY decided_at_ms, decision_id",
        )
        .all()
        .map((row) => {
          const record = row as SqlRow;
          return {
            decisionId: String(record["decision_id"]),
            proposalId: String(record["proposal_id"]),
            approved: String(record["approved"]),
            actorId: String(record["actor_id"]),
            decidedAtMs: Number(record["decided_at_ms"]),
          };
        });
    },

    async changedSince(tMs: number): Promise<readonly RecordChange[]> {
      return connection
        .prepare(CHANGES_SINCE_SQL)
        .all(...CHANGE_SOURCES.map(() => tMs))
        .map((row) => {
          const record = row as SqlRow;
          const id = record["id"];
          return {
            kind: String(record["kind"]),
            // Null rather than an empty string, and it is
            // `operator_attention.subject_id` that produces it: the most common
            // withholding was never composed into anything with an id, and a
            // reader that saw `""` would go looking for a row named that.
            id: id === null || id === undefined ? null : String(id),
            atMs: Number(record["at_ms"]),
          };
        });
    },

    async decisions(sinceMs: number | null, attention: boolean): Promise<readonly DecisionRow[]> {
      return readDecisions(connection, sinceMs, attention);
    },

    async askFrequency(
      sinceMs: number | null,
      drafterPrefix: string,
    ): Promise<readonly AskFrequencyRow[]> {
      return readAskFrequency(connection, sinceMs, drafterPrefix);
    },

    async recordScope(draft: ScopeDraft): Promise<RecordOutcome> {
      try {
        return immediateTransaction<RecordOutcome>(connection, () => insertScope(draft));
      } catch (error) {
        if (isUniqueViolation(error)) {
          return {
            kind: "refused",
            reason:
              `a scope with id '${draft.scopeId}' already exists, and a scope is never edited: ` +
              "a change is a successor under an id of its own (D-0066 rule 1.4)",
          };
        }
        return { kind: "defect", reason: describe(error) };
      }
    },

    async recordScopeDecision(draft: ScopeDecisionDraft): Promise<RecordOutcome> {
      try {
        return immediateTransaction<RecordOutcome>(connection, () => {
          // D-0066 rule 2.2 in D-0049 rule 2's shape: the read and the insert
          // share the write lock, so the digest that matched is the row's.
          const row = connection
            .prepare("SELECT scope_digest FROM scope WHERE scope_id = ?")
            .get(draft.scopeId) as SqlRow | undefined;
          if (row === undefined) {
            return {
              kind: "refused",
              reason:
                `a scope decision must name a scope, and '${draft.scopeId}' is not a row in this ` +
                "store: an answer to a scope nobody wrote approves nothing (D-0066 rule 2.2)",
            };
          }
          const digest = String(row["scope_digest"]);
          if (digest !== draft.scopeDigest) {
            return {
              kind: "refused",
              reason:
                `the decision on scope '${draft.scopeId}' names digest '${draft.scopeDigest}', and ` +
                `the row's digest is '${digest}': the approval must name what was shown ` +
                "(D-0066 rule 2.2, D-0049 rule 2)",
            };
          }
          // **One approved line per chain** (D-0066 rule 1.4, read over the chain
          // by D-0074 rule 1.3), decided under the same lock as the insert: two
          // changes to one scope pressed from two tabs -- or two raises drawn
          // over one approval -- would otherwise both be approved, each a grant
          // with a budget of its own, and a running lap's walk to its tip would
          // have two answers.
          const fork = draft.outcome === "approved" ? forkedBy(connection, draft.scopeId) : null;
          if (fork !== null) {
            return {
              kind: "refused",
              reason:
                `the scope '${draft.scopeId}' replaces a line the approved scope '${fork}' ` +
                "already replaced, and a scope is replaced once: approving both would leave two " +
                "grants with budgets of their own (D-0066 rule 1.4, D-0074 rule 1.3)",
            };
          }
          connection
            .prepare(
              "INSERT INTO scope_decision (scope_decision_id, scope_id, scope_digest, outcome, " +
                "actor_id, recorded_by, decided_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?)",
            )
            .run(
              draft.scopeDecisionId,
              draft.scopeId,
              draft.scopeDigest,
              draft.outcome,
              draft.actorId,
              draft.recordedBy,
              draft.decidedAtMs,
            );
          return { kind: "recorded" };
        });
      } catch (error) {
        if (isUniqueViolation(error) && error.message.includes("scope_decision.scope_id")) {
          return {
            kind: "refused",
            reason:
              `the scope '${draft.scopeId}' already has a decision, and D-0066 rule 2.3 allows one ` +
              "per scope row: a person who changes their mind answers a new row with the same " +
              "payload",
          };
        }
        if (isUniqueViolation(error)) {
          return {
            kind: "refused",
            reason:
              `a scope decision with id '${draft.scopeDecisionId}' already exists, and a decision ` +
              "row is never rewritten (D-0066 rule 5.2)",
          };
        }
        return { kind: "defect", reason: describe(error) };
      }
    },

    async readScope(scopeId: string): Promise<ScopeReadOutcome> {
      const row = connection.prepare(`${SELECT_SCOPE} WHERE scope_id = ?`).get(scopeId);
      if (row === undefined) {
        return { kind: "absent" };
      }
      try {
        return { kind: "read", scope: toScope(row as SqlRow) };
      } catch (error) {
        if (error instanceof StoreDefect) {
          return { kind: "unreadable", reason: error.message };
        }
        throw error;
      }
    },

    async recordDraft(write: DraftRunWrite): Promise<DraftWriteOutcome> {
      try {
        return immediateTransaction<DraftWriteOutcome>(connection, () => {
          const now = threadOperatorMessages(connection, write.requestMessageId);
          const held = new Set(write.operatorMessageIds);
          if (now.some((id) => !held.has(id))) {
            return { kind: "stale" };
          }
          // Under the same lock: a thread every operator message of which a
          // drafter row already covers is drafted, and nothing is written twice
          // (rule 3.2's coverage).
          const covered = coveredMessageIds(connection, write.drafterPrefix);
          if (now.length > 0 && now.every((id) => covered.has(id))) {
            return { kind: "covered" };
          }
          // **All or nothing**: a refusal after the first insert is thrown, so
          // the transaction rolls back rather than committing half a draft.
          const must = (outcome: RecordOutcome, what: string): void => {
            if (outcome.kind !== "recorded") {
              throw new DraftRefusal(`${what}: ${outcome.reason}`);
            }
          };
          if (write.proposal !== null) {
            must(insertProposal(write.proposal), "the proposal was refused");
          }
          if (write.scope !== null) {
            must(insertScope(write.scope), "the drafted scope was refused");
          }
          for (const policy of write.policies ?? []) {
            const refusal = standingPolicyRefusal(connection, policy);
            if (refusal !== null) {
              throw new DraftRefusal(`a drafted policy was refused: ${refusal}`);
            }
            insertStandingPolicy(connection, policy);
          }
          for (const message of write.messages) {
            const refusal = threadMessageRefusal(connection, message);
            if (refusal !== null) {
              throw new DraftRefusal(`a drafter message was refused: ${refusal}`);
            }
            must(
              asRefusal(insertMessage(message.messageId, message)),
              "a drafter message was refused",
            );
          }
          return { kind: "recorded" };
        });
      } catch (error) {
        if (error instanceof DraftRefusal) {
          return { kind: "refused", reason: error.message };
        }
        return { kind: "defect", reason: describe(error) };
      }
    },

    async draftedMessageIds(drafterPrefix: string): Promise<ReadonlySet<string>> {
      return coveredMessageIds(connection, drafterPrefix);
    },

    async recordAnswer(write: AnswerWrite): Promise<AnswerWriteOutcome> {
      const malformed = answerFault(write);
      if (malformed !== null) {
        return malformed;
      }
      const { proposal, message } = write;
      try {
        return immediateTransaction<AnswerWriteOutcome>(connection, () => {
          const asked = connection
            .prepare("SELECT author_kind FROM conversation_message WHERE message_id = ?")
            .get(write.questionId) as SqlRow | undefined;
          if (
            asked === undefined ||
            !isQuestion({ authorKind: String(asked["author_kind"]), messageId: write.questionId })
          ) {
            return { kind: "notAQuestion", questionId: write.questionId };
          }
          if (!unansweredQuestionIds(connection, write.drafterPrefix).includes(write.questionId)) {
            return { kind: "alreadyAnswered", questionId: write.questionId };
          }
          // All or nothing, as `recordDraft`: a refusal after the first insert
          // is thrown so the transaction rolls back.
          const inserted = insertProposal(proposal);
          if (inserted.kind !== "recorded") {
            throw new DraftRefusal(`the explanation was refused: ${inserted.reason}`);
          }
          const refusal = threadMessageRefusal(connection, message);
          const written =
            refusal === null ? asRefusal(insertMessage(message.messageId, message)) : null;
          if (written === null || written.kind !== "recorded") {
            throw new DraftRefusal(`the answer was refused: ${refusal ?? written?.reason}`);
          }
          if (
            write.claim !== null &&
            !insertClaim(
              write.claim.scopeDecisionId,
              "explanation_reading",
              proposal.proposalId,
              write.claim.nowMs,
            )
          ) {
            throw new DraftRefusal(
              `the explanation '${proposal.proposalId}' is already claimed under a scope`,
            );
          }
          return {
            kind: "answered",
            proposalId: proposal.proposalId,
            messageId: message.messageId,
          };
        });
      } catch (error) {
        if (error instanceof DraftRefusal) {
          return { kind: "refused", reason: error.message };
        }
        return { kind: "defect", reason: describe(error) };
      }
    },

    async unansweredQuestionIds(drafterPrefix: string): Promise<readonly string[]> {
      return unansweredQuestionIds(connection, drafterPrefix);
    },

    async latestSplitFor(requestMessageId: string, drafterPrefix: string) {
      const row = connection
        .prepare(
          "SELECT proposal_id FROM proposal WHERE kind = 'split' " +
            "AND substr(drafter, 1, length(?)) = ? AND json_extract(CASE WHEN " +
            "json_valid(snapshot) THEN snapshot ELSE '{}' END, '$.material.requestMessageId') = ? " +
            "ORDER BY created_at_ms DESC, rowid DESC LIMIT 1",
        )
        .get(drafterPrefix, drafterPrefix, requestMessageId) as SqlRow | undefined;
      return row === undefined ? null : String(row["proposal_id"]);
    },

    async claimDraft(
      requestMessageId: string,
      holder: string,
      nowMs: number,
      untilMs: number,
    ): Promise<boolean> {
      return immediateTransaction(connection, () => {
        const row = connection
          .prepare("SELECT holder, until_ms FROM drafter_lease WHERE request_message_id = ?")
          .get(requestMessageId) as SqlRow | undefined;
        if (row !== undefined && row["holder"] !== holder && Number(row["until_ms"]) > nowMs) {
          return false;
        }
        connection
          .prepare(
            "INSERT INTO drafter_lease (request_message_id, holder, until_ms) VALUES (?, ?, ?) " +
              "ON CONFLICT (request_message_id) DO UPDATE SET holder = excluded.holder, " +
              "until_ms = excluded.until_ms",
          )
          .run(requestMessageId, holder, untilMs);
        return true;
      });
    },

    async messagesBeforeDrafter(nowMs: number): Promise<ReadonlySet<string>> {
      return messagesBeforeEpoch(connection, "drafter_epoch", nowMs);
    },

    async messagesBeforeIssueReader(nowMs: number): Promise<ReadonlySet<string>> {
      return messagesBeforeEpoch(connection, "issue_reader_epoch", nowMs);
    },

    async recordReviseDraft(proposal: ProposalDraft, gateId: string): Promise<DraftWriteOutcome> {
      if (proposal.kind !== "revise_draft" || proposal.iterationId === null) {
        return {
          kind: "defect",
          reason: `a revise draft is a 'revise_draft' proposal naming its lap, and '${proposal.proposalId}' is not`,
        };
      }
      const iterationId = proposal.iterationId;
      try {
        return immediateTransaction<DraftWriteOutcome>(connection, () => {
          const lap = connection
            .prepare("SELECT status, gate_id FROM iteration WHERE id = ?")
            .get(iterationId) as SqlRow | undefined;
          if (
            lap === undefined ||
            lap["status"] !== "awaiting_human" ||
            lap["gate_id"] !== gateId
          ) {
            return { kind: "stale" };
          }
          const latest = latestReading(readingsOf(connection, iterationId), isModelReadingDrafter);
          const held = proposal.snapshot["reading"];
          if (
            latest === null ||
            held === undefined ||
            canonicalJson(readingContent(latest)) !== canonicalJson(held)
          ) {
            return { kind: "stale" };
          }
          if (reviseDraftHolding(connection, iterationId, latest) !== null) {
            return { kind: "covered" };
          }
          return insertProposal(proposal);
        });
      } catch (error) {
        return { kind: "defect", reason: describe(error) };
      }
    },

    async reviseDraftFor(
      iterationId: string,
      reading: LapReading,
    ): Promise<StoredReviseDraft | null> {
      return reviseDraftHolding(connection, iterationId, reading);
    },

    async recordPublishBody(proposal: ProposalDraft, gateId: string): Promise<DraftWriteOutcome> {
      if (proposal.kind !== "publish_body" || proposal.iterationId === null) {
        return {
          kind: "defect",
          reason:
            "a composed body is a 'publish_body' proposal naming its lap, and " +
            `'${proposal.proposalId}' is not`,
        };
      }
      const iterationId = proposal.iterationId;
      try {
        return immediateTransaction<DraftWriteOutcome>(connection, () => {
          const lap = connection
            .prepare("SELECT status, gate_id FROM iteration WHERE id = ?")
            .get(iterationId) as SqlRow | undefined;
          // **Closed at this gate, which is the only lap a publish is of.** A
          // lap that moved on is a body composed from a report that is no
          // longer the last word on this work.
          if (lap === undefined || lap["status"] !== "closed" || lap["gate_id"] !== gateId) {
            return { kind: "stale" };
          }
          if (publishBodyHolding(connection, iterationId, gateId) !== null) {
            return { kind: "covered" };
          }
          return insertProposal(proposal);
        });
      } catch (error) {
        return { kind: "defect", reason: describe(error) };
      }
    },

    async publishBodyFor(iterationId: string, gateId: string): Promise<StoredReviseDraft | null> {
      return publishBodyHolding(connection, iterationId, gateId);
    },

    async releaseDraft(requestMessageId: string, holder: string): Promise<void> {
      connection
        .prepare("DELETE FROM drafter_lease WHERE request_message_id = ? AND holder = ?")
        .run(requestMessageId, holder);
    },

    async scopesFor(requestMessageId: string): Promise<readonly StoredScope[]> {
      const ids = (
        connection
          .prepare(
            // A named scope lists the id; a goal scope (D-0128) is a candidate
            // tested against the opener below.
            "SELECT s.scope_id FROM scope s WHERE json_valid(s.payload) AND (" +
              "json_type(s.payload, '$.requests') = 'object' OR (" +
              "json_type(s.payload, '$.requests') = 'array' AND EXISTS (" +
              "SELECT 1 FROM json_each(s.payload, '$.requests') j WHERE j.value = ?))) " +
              "ORDER BY s.created_at_ms, s.rowid",
          )
          .all(requestMessageId) as SqlRow[]
      ).map((row) => String(row["scope_id"]));
      const opener = requestOpenerOf(connection, requestMessageId);
      const scopes: StoredScope[] = [];
      for (const id of ids) {
        const read = await this.readScope(id);
        if (
          read.kind === "read" &&
          (requestsGoal(read.scope.payload.requests) === null ||
            (opener !== null && scopeCoversRequest(read.scope.payload.requests, opener)))
        ) {
          scopes.push(read.scope);
        }
      }
      return scopes;
    },

    async requestOpener(messageId: string): Promise<RequestOpener | null> {
      return requestOpenerOf(connection, messageId);
    },

    async recordSetupPlan(draft: SetupPlanDraft): Promise<RecordOutcome> {
      const plan = canonicalJson(draft.plan);
      return immediateTransaction(connection, () => {
        // A row for another repository than the rows already here is admitted:
        // one store and one host serve several repositories, and which
        // repository a row is for is the plan's own `repository` (D-0081 rule
        // 5, withdrawing D-0075 rule 1.1). Nothing migrates -- the table is
        // append-only and a store nobody adds a repository to is unchanged.
        if (
          connection.prepare("SELECT 1 FROM setup_plan WHERE setup_id = ?").get(draft.setupId) !==
          undefined
        ) {
          return { kind: "refused", reason: `a setup row '${draft.setupId}' is already recorded` };
        }
        connection
          .prepare(
            "INSERT INTO setup_plan (setup_id, plan, plan_digest, recorded_by, recorded_at_ms) " +
              "VALUES (?, ?, ?, ?, ?)",
          )
          .run(draft.setupId, plan, planDigest(draft.plan), draft.recordedBy, draft.recordedAtMs);
        return { kind: "recorded" };
      });
    },

    async recordGoal(draft: GoalDraft): Promise<RecordOutcome> {
      if (draft.repository.trim() === "") {
        return { kind: "refused", reason: "a goal names the repository it is for" };
      }
      if (draft.clauses.length === 0) {
        return { kind: "refused", reason: "a goal holds at least one clause (D-0097 point 2.2)" };
      }
      if (draft.clauses.some((clause) => clause.said.trim() === "")) {
        return { kind: "refused", reason: "every clause of a goal says something" };
      }
      const clauses = canonicalJson(
        draft.clauses.map((clause) => ({ said: clause.said, unmetIf: clause.unmetIf })),
      );
      return immediateTransaction(connection, () => {
        if (
          connection.prepare("SELECT 1 FROM goal WHERE goal_id = ?").get(draft.goalId) !== undefined
        ) {
          return { kind: "refused", reason: `a goal row '${draft.goalId}' is already recorded` };
        }
        connection
          .prepare(
            "INSERT INTO goal (goal_id, repository, clauses, written_by, written_at_ms) " +
              "VALUES (?, ?, ?, ?, ?)",
          )
          .run(draft.goalId, draft.repository, clauses, draft.writtenBy, draft.writtenAtMs);
        return { kind: "recorded" };
      });
    },

    async recordStandingPolicy(draft: StandingPolicyDraft): Promise<RecordOutcome> {
      return recordStandingPolicy(connection, draft);
    },

    async standingPolicies(): Promise<readonly StoredStandingPolicy[]> {
      return inForcePolicies(connection);
    },

    async policySources(): Promise<ReadonlySet<string>> {
      return policySources(connection);
    },

    async goals(): Promise<readonly StoredGoal[]> {
      return (
        connection.prepare("SELECT * FROM goal ORDER BY written_at_ms, rowid").all() as SqlRow[]
      ).flatMap((row) => {
        let clauses: unknown;
        try {
          clauses = JSON.parse(String(row["clauses"]));
        } catch {
          return [];
        }
        if (!Array.isArray(clauses)) {
          return [];
        }
        return [
          {
            goalId: String(row["goal_id"]),
            repository: String(row["repository"]),
            clauses: clauses.flatMap((clause: unknown) =>
              typeof clause === "object" &&
              clause !== null &&
              typeof (clause as JsonRecord)["said"] === "string" &&
              typeof (clause as JsonRecord)["unmetIf"] === "string"
                ? [
                    {
                      said: String((clause as JsonRecord)["said"]),
                      unmetIf: String((clause as JsonRecord)["unmetIf"]),
                    },
                  ]
                : [],
            ),
            writtenBy: String(row["written_by"]),
            writtenAtMs: Number(row["written_at_ms"]),
          },
        ];
      });
    },

    async recordTriageDecline(draft: TriageDeclineDraft): Promise<RecordOutcome> {
      return immediateTransaction(connection, () => {
        const row = connection
          .prepare("SELECT kind, payload FROM proposal WHERE proposal_id = ?")
          .get(draft.proposalId) as SqlRow | undefined;
        if (row === undefined || row["kind"] !== "triage") {
          return {
            kind: "refused",
            reason: `'${draft.proposalId}' is not a proposal of what to ask next`,
          };
        }
        if (!triageKeys(String(row["payload"])).includes(draft.candidate)) {
          return {
            kind: "refused",
            reason: `'${draft.candidate}' is not a candidate that proposal named`,
          };
        }
        if (
          connection
            .prepare("SELECT 1 FROM triage_decline WHERE decline_id = ?")
            .get(draft.declineId) !== undefined
        ) {
          return { kind: "refused", reason: `a decline '${draft.declineId}' is already recorded` };
        }
        connection
          .prepare(
            "INSERT INTO triage_decline (decline_id, proposal_id, candidate, declined_by, " +
              "declined_at_ms) VALUES (?, ?, ?, ?, ?)",
          )
          .run(
            draft.declineId,
            draft.proposalId,
            draft.candidate,
            draft.declinedBy,
            draft.declinedAtMs,
          );
        return { kind: "recorded" };
      });
    },

    async recordFlowAsk(
      draft: FlowAskDraft,
    ): Promise<RecordOutcome | { readonly kind: "duplicate" }> {
      return immediateTransaction(connection, () => {
        if (
          connection.prepare("SELECT 1 FROM flow_ask WHERE ask_id = ?").get(draft.askId) !==
          undefined
        ) {
          return { kind: "duplicate" as const };
        }
        if (draft.points.length === 0) {
          return { kind: "refused" as const, reason: `'${draft.askId}' asks no point` };
        }
        connection
          .prepare(
            "INSERT INTO flow_ask (ask_id, repository, goal_id, scope_decision_id, proposal_id, " +
              "candidate, points, asked_at_ms, request, why) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .run(
            draft.askId,
            draft.repository,
            draft.goalId,
            draft.scopeDecisionId,
            draft.proposalId,
            draft.candidate,
            canonicalJson(
              draft.points.map((one) => ({ point: one.point, recommendation: one.recommendation })),
            ),
            draft.askedAtMs,
            draft.request,
            draft.why,
          );
        return { kind: "recorded" as const };
      });
    },

    async recordFlowAnswer(draft: FlowAnswerDraft): Promise<RecordOutcome> {
      return immediateTransaction(connection, () => {
        const ask = connection
          .prepare("SELECT points FROM flow_ask WHERE ask_id = ?")
          .get(draft.askId) as SqlRow | undefined;
        if (ask === undefined) {
          return { kind: "refused", reason: `'${draft.askId}' is no question rondo asked` };
        }
        if (
          connection.prepare("SELECT 1 FROM flow_answer WHERE ask_id = ?").get(draft.askId) !==
          undefined
        ) {
          return { kind: "refused", reason: `'${draft.askId}' is answered already` };
        }
        const points = flowPoints(String(ask["points"]));
        if (
          draft.answers.length !== points.length ||
          draft.answers.some((answer) => answer.trim() === "")
        ) {
          return {
            kind: "refused",
            reason: `'${draft.askId}' asks ${String(points.length)} points, and each needs an answer`,
          };
        }
        // The request is one line, as the box's first line; the why is not empty.
        const request = draft.request?.replace(/\s*[\r\n]+\s*/g, " ").trim() ?? null;
        const why = draft.why?.trim() ?? null;
        if (request === "" || why === "") {
          return {
            kind: "refused",
            reason: `'${draft.askId}' needs a request and a why`,
          };
        }
        connection
          .prepare(
            "INSERT INTO flow_answer (ask_id, answers, answered_by, answered_at_ms, request, why) " +
              "VALUES (?, ?, ?, ?, ?, ?)",
          )
          .run(
            draft.askId,
            canonicalJson(draft.answers.map((answer) => answer.trim())),
            draft.answeredBy,
            draft.answeredAtMs,
            request,
            why,
          );
        return { kind: "recorded" };
      });
    },

    async flowAsks(): Promise<readonly StoredFlowAsk[]> {
      return (
        connection
          .prepare(
            "SELECT k.*, a.answers, a.answered_by, a.answered_at_ms, " +
              "a.request AS answered_request, a.why AS answered_why FROM flow_ask k " +
              "LEFT JOIN flow_answer a ON a.ask_id = k.ask_id ORDER BY k.asked_at_ms, k.rowid",
          )
          .all() as SqlRow[]
      ).map((row) => {
        let answers: unknown = null;
        try {
          answers = row["answers"] === null ? null : JSON.parse(String(row["answers"]));
        } catch {
          answers = null;
        }
        return {
          askId: String(row["ask_id"]),
          repository: String(row["repository"]),
          goalId: String(row["goal_id"]),
          scopeDecisionId: String(row["scope_decision_id"]),
          proposalId: String(row["proposal_id"]),
          candidate: String(row["candidate"]),
          points: flowPoints(String(row["points"])),
          request: row["request"] === null ? null : String(row["request"]),
          why: row["why"] === null ? null : String(row["why"]),
          askedAtMs: Number(row["asked_at_ms"]),
          answer: Array.isArray(answers)
            ? {
                answers: answers.map(String),
                request: row["answered_request"] === null ? null : String(row["answered_request"]),
                why: row["answered_why"] === null ? null : String(row["answered_why"]),
                answeredBy: String(row["answered_by"]),
                answeredAtMs: Number(row["answered_at_ms"]),
              }
            : null,
        };
      });
    },

    async triageDeclines(): Promise<readonly StoredTriageDecline[]> {
      return (
        connection
          .prepare(
            "SELECT d.*, p.payload FROM triage_decline d JOIN proposal p " +
              "ON p.proposal_id = d.proposal_id ORDER BY d.declined_at_ms, d.rowid",
          )
          .all() as SqlRow[]
      ).map((row) => ({
        declineId: String(row["decline_id"]),
        proposalId: String(row["proposal_id"]),
        candidate: String(row["candidate"]),
        declinedBy: String(row["declined_by"]),
        declinedAtMs: Number(row["declined_at_ms"]),
        repository: triageRepository(String(row["payload"])) ?? "",
      }));
    },

    async recordFlowStop(draft: FlowStopDraft): Promise<RecordOutcome> {
      return immediateTransaction(connection, () => {
        if (
          connection.prepare("SELECT 1 FROM flow_stop WHERE stop_id = ?").get(draft.stopId) !==
          undefined
        ) {
          return { kind: "refused", reason: `a flow stop '${draft.stopId}' is already recorded` };
        }
        connection
          .prepare(
            "INSERT INTO flow_stop (stop_id, scope_decision_id, repository, facts, at_ms) " +
              "VALUES (?, ?, ?, ?, ?)",
          )
          .run(
            draft.stopId,
            draft.scopeDecisionId,
            draft.repository,
            canonicalJson(draft.facts),
            draft.atMs,
          );
        return { kind: "recorded" };
      });
    },

    async flowStops(): Promise<readonly StoredFlowStop[]> {
      return (
        connection.prepare("SELECT * FROM flow_stop ORDER BY at_ms, rowid").all() as SqlRow[]
      ).flatMap((row) => {
        let facts: unknown;
        try {
          facts = JSON.parse(String(row["facts"]));
        } catch {
          return [];
        }
        return isRecord(facts)
          ? [
              {
                stopId: String(row["stop_id"]),
                scopeDecisionId: String(row["scope_decision_id"]),
                repository: String(row["repository"]),
                facts,
                atMs: Number(row["at_ms"]),
              },
            ]
          : [];
      });
    },

    async recordTranslation(
      draft: TranslationDraft,
    ): Promise<RecordOutcome | { readonly kind: "duplicate" }> {
      const written = connection
        .prepare(
          "INSERT OR IGNORE INTO translation " +
            "(digest, language, text, drafter, cost_usd, read_at_ms) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(
          draft.digest,
          draft.language,
          draft.text,
          draft.drafter,
          draft.costUsd,
          draft.readAtMs,
        );
      return Number(written.changes) === 0 ? { kind: "duplicate" } : { kind: "recorded" };
    },

    async translations(language: string): Promise<readonly StoredTranslation[]> {
      return (
        connection
          .prepare("SELECT * FROM translation WHERE language = ? ORDER BY read_at_ms, rowid")
          .all(language) as SqlRow[]
      ).map((row) => ({
        digest: String(row["digest"]),
        language: String(row["language"]),
        text: String(row["text"]),
        drafter: String(row["drafter"]),
        costUsd: typeof row["cost_usd"] === "number" ? row["cost_usd"] : null,
        readAtMs: Number(row["read_at_ms"]),
      }));
    },

    async latestTriage(): Promise<readonly StoredTriage[]> {
      const newest = new Map<string, StoredTriage>();
      for (const row of connection
        .prepare(
          "SELECT proposal_id, drafter, payload, snapshot, created_at_ms FROM proposal " +
            "WHERE kind = 'triage' ORDER BY created_at_ms, rowid",
        )
        .all() as SqlRow[]) {
        let payload: unknown;
        let snapshot: unknown;
        try {
          payload = JSON.parse(String(row["payload"]));
          snapshot = JSON.parse(String(row["snapshot"]));
        } catch {
          continue;
        }
        const repository = triageRepository(String(row["payload"]));
        if (repository === null || !isRecord(payload) || !isRecord(snapshot)) {
          continue;
        }
        // Deleted first so the map's order is each repository's newest row.
        newest.delete(repository);
        newest.set(repository, {
          proposalId: String(row["proposal_id"]),
          drafter: String(row["drafter"]),
          repository,
          payload,
          snapshot,
          createdAtMs: Number(row["created_at_ms"]),
        });
      }
      return [...newest.values()];
    },

    async setupPlans(): Promise<readonly StoredSetupPlan[]> {
      return (
        connection
          .prepare("SELECT * FROM setup_plan ORDER BY recorded_at_ms, rowid")
          .all() as SqlRow[]
      ).flatMap((row) => {
        let plan: unknown;
        try {
          plan = JSON.parse(String(row["plan"]));
        } catch {
          return [];
        }
        if (typeof plan !== "object" || plan === null || Array.isArray(plan)) {
          return [];
        }
        return [
          {
            setupId: String(row["setup_id"]),
            plan: plan as JsonRecord,
            planDigest: planDigest(plan as JsonRecord),
            recordedBy: String(row["recorded_by"]),
            recordedAtMs: Number(row["recorded_at_ms"]),
          },
        ];
      });
    },

    async heldAgentTypeDigests(): Promise<readonly string[]> {
      return (
        connection
          .prepare(
            "SELECT agent_type_digest FROM agent_type_record ORDER BY recorded_at_ms, agent_type_digest",
          )
          .all() as SqlRow[]
      ).map((row) => String(row["agent_type_digest"]));
    },

    async heldAgentType(agentTypeDigest: string): Promise<HeldAgentTypeOutcome> {
      const recorded = connection
        .prepare("SELECT agent_type_input FROM agent_type_record WHERE agent_type_digest = ?")
        .get(agentTypeDigest) as SqlRow | undefined;
      const ran =
        recorded === undefined
          ? (connection
              .prepare(
                "SELECT id, plan FROM iteration WHERE agent_type_digest = ? " +
                  "ORDER BY created_at_ms, id LIMIT 1",
              )
              .get(agentTypeDigest) as SqlRow | undefined)
          : undefined;
      if (recorded === undefined && ran === undefined) {
        return { kind: "absent" };
      }
      try {
        if (recorded !== undefined) {
          return {
            kind: "read",
            source: "agent_type_record",
            agentTypeInput: JSON.parse(String(recorded["agent_type_input"])) as JsonValue,
          };
        }
        const plan = JSON.parse(String(ran?.["plan"])) as unknown;
        const input =
          plan !== null && typeof plan === "object" && !Array.isArray(plan)
            ? (plan as JsonRecord)["agent_type_input"]
            : undefined;
        if (input === undefined) {
          return {
            kind: "unreadable",
            reason: `the plan of iteration '${String(ran?.["id"])}' carries no agent_type_input`,
          };
        }
        return { kind: "read", source: "iteration", agentTypeInput: input };
      } catch (error) {
        return { kind: "unreadable", reason: describe(error) };
      }
    },

    async readScopeDecision(scopeDecisionId: string): Promise<ScopeDecisionReadOutcome> {
      return scopeDecisionWhere(connection, "scope_decision_id", scopeDecisionId);
    },

    async scopeDecisionOf(scopeId: string): Promise<ScopeDecisionReadOutcome> {
      return scopeDecisionWhere(connection, "scope_id", scopeId);
    },

    async scopeSpent(scopeDecisionId: string): Promise<ScopeSpent> {
      return spentUnder(connection, scopeDecisionId);
    },

    async scopeDecisionAdmitting(iterationId: string): Promise<string | null> {
      return admittedUnder(connection, iterationId);
    },

    async approvalsInForce() {
      const rows = connection
        .prepare(
          "SELECT scope_decision_id, scope_id FROM scope_decision WHERE outcome = 'approved' " +
            "ORDER BY decided_at_ms, scope_decision_id",
        )
        .all() as SqlRow[];
      return rows
        .map((row) => ({
          scopeDecisionId: String(row["scope_decision_id"]),
          scopeId: String(row["scope_id"]),
        }))
        .filter(({ scopeId }) => !supersededByApproved(connection, scopeId));
    },

    async scopeSupersededByApproved(scopeId: string): Promise<boolean> {
      return supersededByApproved(connection, scopeId);
    },

    async scopeTip(scopeDecisionId: string): Promise<ScopeTip> {
      return tipOf(connection, scopeDecisionId);
    },

    async claimScopedAct(claim): Promise<RecordOutcome> {
      const actKind: (typeof WRITABLE_SCOPE_ACT_KINDS)[number] = claim.actKind;
      try {
        return insertClaim(claim.scopeDecisionId, actKind, claim.subjectId, claim.nowMs)
          ? { kind: "recorded" }
          : {
              kind: "refused",
              reason:
                `'${actKind}' of '${claim.subjectId}' is already claimed under a scope, and ` +
                "it is taken once (D-0126 rule 3, D-0125 rule 5, rondo#470)",
            };
      } catch (error) {
        return { kind: "defect", reason: describe(error) };
      }
    },

    async openAsksIn(requestMessageId: string): Promise<OpenAsksReadOutcome> {
      return openAsksIn(connection, requestMessageId);
    },

    async threadMessages(): Promise<ThreadMessagesReadOutcome> {
      return threadMessages(connection);
    },

    async lineageOf(iterationId: string): Promise<readonly string[] | null> {
      return lineageOf(connection, iterationId);
    },
  };
}
