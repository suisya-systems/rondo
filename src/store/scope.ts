/**
 * Approvals and scopes: spending a decision or a scope, what a scope has spent,
 * where its line of successors ends, and why a spend is refused.
 *
 * Split out of `src/store/sqlite.ts` (D-0171), which still owns the driver.
 */

import type {
  DecisionSpend,
  ReserveInput,
  ReserveOutcome,
  ScopeDecisionReadOutcome,
  ScopeSpend,
  ScopeTip,
} from "./contract.js";
import { contentDigest } from "./plan.js";
import {
  askStandsOver,
  type JsonRecord,
  type JsonValue,
  lapBudgetCap,
  type RequestOpener,
  readScopePayload,
  requestsGoal,
  type ScopePayload,
  type ScopeRefusal,
  type ScopeSpent,
  type ScopeTest,
  type StoredScope,
  type StoredScopeDecision,
  scopeCoversRequest,
  type WRITABLE_SCOPE_ACT_KINDS,
} from "./records.js";
import {
  describe,
  isUniqueViolation,
  LINEAGE_BOUND,
  lineageOf,
  optionalText,
  requireInteger,
  requireText,
  type SqlRow,
  type StoreConnection,
  StoreDefect,
} from "./rows.js";
import { openAsksIn } from "./thread.js";

/**
 * Why a reservation's lineage cannot be written, or null when it can.
 *
 * **Read inside the caller's transaction**, which is what makes the answer
 * worth anything: `BEGIN IMMEDIATE` holds the write lock, so a predecessor
 * that exists when this looks still exists when the row is inserted. The same
 * question asked before the transaction would be a check with a window in it.
 *
 * Rows are never deleted by anything in this file -- `settle` and `transition`
 * both write statuses -- so "the predecessor is not there" means it was never
 * there, and that is a defect in the caller rather than a race it lost.
 */
/**
 * Spend one approval, inside a transaction the caller has already opened
 * (`advisory.md` 6.3, D-0022 rule 9).
 *
 * Returns the refusal in rondo's own words, or null when the consumption row
 * landed. **It opens no transaction of its own**, which is the point: two
 * callers spend a decision -- `consumeDecision`, where the consumption is the
 * whole of the write, and `reserve`, where it is written beside the iteration
 * row that is the issuance under D-0022 rule 17 -- and both need the read, the
 * comparison and the insert under one write lock.
 *
 * **Four refusals, and the fourth is the database's.** The first three are read
 * out of `human_decision`; single use is the primary key on
 * `decision_consumption.decision_id` colliding, caught here rather than
 * checked first, because a check is a window and a key is not. A constraint
 * violation rolls back the statement and not the transaction, so a caller
 * holding an open one may go on to write its own refusal.
 */
export function spendDecision(
  connection: StoreConnection,
  spend: DecisionSpend,
  nowMs: number,
): string | null {
  const { decisionId, contractDigest } = spend;
  const row = connection
    .prepare("SELECT outcome, approved FROM human_decision WHERE decision_id = ?")
    .get(decisionId) as SqlRow | undefined;
  if (row === undefined) {
    // **Not a harmless dangling row.** `decision_consumption` is what
    // `unconsumedDecisions` subtracts, so a consumption naming nothing is a
    // subtraction from a set it was never in -- and the day the id is minted
    // the approval it names is born already spent.
    return (
      `there is no human decision '${decisionId}' in this store to spend: a consumption is ` +
      "the record of an issuance against an answer, and an answer that was never recorded " +
      "cannot have authorised one"
    );
  }
  if (String(row["outcome"]) !== "approved") {
    // D-0032 rule 6 in as many words: a refusal writes no
    // `decision_consumption` row and no delegation row, which is what D-0022
    // rule 18 assumes when it says the composition must outlive a refusal.
    return (
      `the human decision '${decisionId}' declined, and a refusal authorises nothing: D-0032 ` +
      "rule 6 gives a declined answer its own row precisely so that it is not an absence " +
      "somebody can spend"
    );
  }
  const approved = String(row["approved"]);
  if (approved !== contractDigest) {
    // **The digest is what a person approved** (cadenza D-0036), so issuing a
    // different one is issuing something nobody answered for -- and it would
    // spend the real approval on the way past, removing it from
    // `unconsumedDecisions` for ever.
    return (
      `the human decision '${decisionId}' approved '${approved}' and the issuance names ` +
      `'${contractDigest}': the digest is what a person approved, so a contract they did not ` +
      "see is not one this answer can be spent on"
    );
  }
  try {
    connection
      .prepare(
        "INSERT INTO decision_consumption (decision_id, contract_digest, consumed_at_ms) " +
          "VALUES (?, ?, ?)",
      )
      .run(decisionId, contractDigest, nowMs);
  } catch (error) {
    if (isUniqueViolation(error)) {
      // The database's refusal, said in rondo's words rather than the driver's.
      // One human decision authorises at most one issuance (D-0022 rule 9), and
      // this is the collision that enforces it.
      return (
        `the human decision '${decisionId}' has already been spent, and one decision ` +
        "authorises at most one issuance: D-0022 rule 9 makes single use the store's " +
        "guarantee, and it is this row's primary key that holds it"
      );
    }
    throw error;
  }
  return null;
}

export const SELECT_SCOPE =
  "SELECT scope_id, payload, scope_digest, supersedes_scope_id, author_kind, author_id, bases, " +
  "created_at_ms FROM scope";

/** One scope decision by one of its two identifying columns (the column is never caller input). */
export function scopeDecisionWhere(
  connection: StoreConnection,
  column: "scope_decision_id" | "scope_id",
  value: string,
): ScopeDecisionReadOutcome {
  const row = connection.prepare(`${SELECT_SCOPE_DECISION} WHERE ${column} = ?`).get(value);
  if (row === undefined) {
    return { kind: "absent" };
  }
  try {
    return { kind: "read", decision: toScopeDecision(row as SqlRow) };
  } catch (error) {
    if (error instanceof StoreDefect) {
      return { kind: "unreadable", reason: error.message };
    }
    throw error;
  }
}

const SELECT_SCOPE_DECISION =
  "SELECT scope_decision_id, scope_id, scope_digest, outcome, actor_id, recorded_by, " +
  "decided_at_ms FROM scope_decision";

/**
 * One scope row, read into a record, or a `StoreDefect` saying why not.
 *
 * **The digest is re-derived and compared** (`verbatim`'s precedent, D-0022
 * rule 4): a payload whose bytes no longer digest to `scope_digest` is not the
 * row a person approved, and every test the verdict and the store make is
 * against the payload -- so a mismatch is unreadable, never proceeded on. The
 * payload is then read by the same strict reader the writer used.
 */
export function toScope(row: SqlRow): StoredScope {
  const text = requireText(row, "payload", "scope");
  let parsed: unknown;
  let bases: unknown;
  try {
    parsed = JSON.parse(text);
    bases = JSON.parse(requireText(row, "bases", "scope"));
  } catch (error) {
    if (error instanceof StoreDefect) {
      throw error;
    }
    throw new StoreDefect(`the scope row's payload or bases is not JSON: ${describe(error)}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new StoreDefect("the scope row's payload is JSON, but it is not an object");
  }
  if (!Array.isArray(bases)) {
    throw new StoreDefect("the scope row's bases is JSON, but it is not a list");
  }
  const recorded = requireText(row, "scope_digest", "scope");
  const recomputed = contentDigest(parsed as JsonRecord);
  if (recorded !== recomputed) {
    throw new StoreDefect(
      `the scope row's scope_digest is '${recorded}' and its payload digests to '${recomputed}'. ` +
        "The pair no longer describes one scope, so rondo cannot say what a person approved.",
    );
  }
  const reading = readScopePayload(parsed as JsonRecord);
  if (reading.kind === "refused") {
    throw new StoreDefect(`the scope row does not read back: ${reading.reason}`);
  }
  const authorKind = requireText(row, "author_kind", "scope");
  if (authorKind !== "operator" && authorKind !== "drafter") {
    throw new StoreDefect(`the scope row's author_kind '${authorKind}' is not operator or drafter`);
  }
  return Object.freeze({
    scopeId: requireText(row, "scope_id", "scope"),
    scopeDigest: recorded,
    payload: reading.payload,
    supersedesScopeId: optionalText(row, "supersedes_scope_id", "scope"),
    authorKind,
    authorId: requireText(row, "author_id", "scope"),
    bases: Object.freeze(bases as JsonValue[]),
    createdAtMs: requireInteger(row, "created_at_ms", "scope"),
  });
}

function toScopeDecision(row: SqlRow): StoredScopeDecision {
  const outcome = requireText(row, "outcome", "scope decision");
  if (outcome !== "approved" && outcome !== "declined") {
    throw new StoreDefect(
      `the scope decision row's outcome '${outcome}' is not approved or declined`,
    );
  }
  return Object.freeze({
    scopeDecisionId: requireText(row, "scope_decision_id", "scope decision"),
    scopeId: requireText(row, "scope_id", "scope decision"),
    scopeDigest: requireText(row, "scope_digest", "scope decision"),
    outcome,
    actorId: requireText(row, "actor_id", "scope decision"),
    recordedBy: requireText(row, "recorded_by", "scope decision"),
    decidedAtMs: requireInteger(row, "decided_at_ms", "scope decision"),
  });
}

/**
 * What an approval has spent, **counted from rows** (D-0066 rule 3.4).
 *
 * `LEFT JOIN` rather than `JOIN`: a consumption whose iteration is not there
 * cannot be written (the two land in one transaction), and if one were ever
 * found it counts as an unread lap -- holding its reserve -- rather than as a
 * lap that cost nothing. `COALESCE` because `SUM` over no rows is null, and an
 * empty ledger has spent 0.
 */
/**
 * The approval that admitted one lap, or null when no single row says.
 *
 * `LIMIT 2` rather than `LIMIT 1`: two rows would mean two approvals claim one
 * admission, and the honest answer to "which scope is this lap under" is then
 * none at all rather than whichever the database listed first.
 */
export function admittedUnder(connection: StoreConnection, iterationId: string): string | null {
  const rows = connection
    .prepare(
      "SELECT scope_decision_id FROM scope_consumption " +
        "WHERE subject_id = ? AND act_kind = 'admission' LIMIT 2",
    )
    .all(iterationId) as SqlRow[];
  const only = rows.length === 1 ? rows[0] : undefined;
  const decision = only === undefined ? undefined : only["scope_decision_id"];
  return typeof decision === "string" && decision !== "" ? decision : null;
}

/**
 * {@link lapBudgetCap} for one admitted lap, read from rows under the write
 * lock, or null where no single approval admitted it or the approval's scope
 * will not read. A lap whose cost is read counts that; an unread one holds its
 * cap when it was sent with one and its reserve otherwise (D-0121 rule 7),
 * except one continuo refused (D-0152): its turn is over, so it holds the
 * reserve the page counts for it rather than a cap it can no longer spend.
 */
export function lapBudgetCapFor(
  connection: StoreConnection,
  iterationId: string,
  maxOccupying: number,
): number | null {
  const decisionId = admittedUnder(connection, iterationId);
  if (decisionId === null) {
    return null;
  }
  const decision = connection
    .prepare("SELECT scope_id FROM scope_decision WHERE scope_decision_id = ?")
    .get(decisionId) as SqlRow | undefined;
  const scopeRow =
    decision === undefined
      ? undefined
      : (connection
          .prepare(`${SELECT_SCOPE} WHERE scope_id = ?`)
          .get(String(decision["scope_id"])) as SqlRow | undefined);
  if (scopeRow === undefined) {
    return null;
  }
  let budgets: ScopePayload["budgets"];
  try {
    budgets = toScope(scopeRow).payload.budgets;
  } catch (error) {
    if (error instanceof StoreDefect) {
      return null;
    }
    throw error;
  }
  const others = connection
    .prepare(
      "SELECT i.lap_cost_usd AS cost, i.lap_budget_cap_usd AS cap, i.status AS status, " +
        "i.failure_kind AS failure_kind " +
        "FROM scope_consumption c LEFT JOIN iteration i ON i.id = c.subject_id " +
        "WHERE c.scope_decision_id = ? AND c.act_kind = 'admission' AND c.subject_id <> ? " +
        // D-0139: a lost lap holds nothing; what it spent was never read.
        "AND i.failure_kind IS NOT 'lost'",
    )
    .all(decisionId, iterationId) as SqlRow[];
  const basis = { readCostUsd: 0, heldCapsUsd: 0, unreadUncappedLaps: 0, runningLaps: 0 };
  for (const row of others) {
    const cost = row["cost"];
    const cap = row["cap"];
    if (typeof cost === "number") {
      basis.readCostUsd += cost;
    } else if (
      typeof cap === "number" &&
      // D-0152: continuo stops a session it owns before it answers a refusal
      // (its turn ceiling included), so a refused lap spends no more.
      !(row["status"] === "failed" && row["failure_kind"] === "refusal")
    ) {
      // Never below zero: a lap refused for no room holds nothing, and credits nothing back.
      basis.heldCapsUsd += Math.max(0, cap);
    } else {
      basis.unreadUncappedLaps += 1;
    }
    if (row["status"] === "performing") {
      basis.runningLaps += 1;
    }
  }
  basis.readCostUsd += triageCostUnder(connection, decisionId);
  return lapBudgetCap(budgets, basis, maxOccupying);
}

export function spentUnder(connection: StoreConnection, scopeDecisionId: string): ScopeSpent {
  const row = connection
    .prepare(
      "SELECT COUNT(*) AS admissions, COALESCE(SUM(i.lap_cost_usd), 0) AS read_cost, " +
        // D-0139: a lost lap is not unread; it holds no reserve.
        "COALESCE(SUM(CASE WHEN i.lap_cost_usd IS NULL AND i.failure_kind IS NOT 'lost' " +
        "THEN 1 ELSE 0 END), 0) AS unread " +
        "FROM scope_consumption c LEFT JOIN iteration i ON i.id = c.subject_id " +
        "WHERE c.scope_decision_id = ? AND c.act_kind = 'admission'",
    )
    .get(scopeDecisionId) as SqlRow;
  return Object.freeze({
    admissions: Number(row["admissions"]),
    readCostUsd: Number(row["read_cost"]) + triageCostUnder(connection, scopeDecisionId),
    unreadLaps: Number(row["unread"]),
  });
}

/**
 * What the triage readings claimed under an approval cost (rondo#469): each
 * reading's `cost_usd`, as its snapshot recorded it. A reading that reported
 * no cost adds nothing, as a reading of it would say.
 */
function triageCostUnder(connection: StoreConnection, scopeDecisionId: string): number {
  const row = connection
    .prepare(
      "SELECT COALESCE(SUM(json_extract(CASE WHEN json_valid(p.snapshot) THEN p.snapshot " +
        "ELSE '{}' END, '$.cost_usd')), 0) AS cost FROM scope_consumption c " +
        "JOIN proposal p ON p.proposal_id = c.subject_id " +
        "WHERE c.scope_decision_id = ? AND c.act_kind = 'triage_reading'",
    )
    .get(scopeDecisionId) as SqlRow;
  return Number(row["cost"]);
}

/**
 * Whether any successor of `scopeId`, at any depth, has an approved decision
 * (D-0066 rule 1.4).
 *
 * **Transitive**: once a successor is approved the predecessor authorises no new
 * act, and a grandchild approved over an unanswered child retires the
 * grandparent just as surely -- the person approved a row that replaces the
 * whole chain above it. A successor that is only drafted, or declined, retires
 * nothing. `UNION` rather than `UNION ALL`, so a cycle nobody could write through
 * `recordScope` would still terminate.
 */
export function supersededByApproved(connection: StoreConnection, scopeId: string): boolean {
  return (
    connection
      .prepare(
        "WITH RECURSIVE descendant(scope_id) AS (" +
          "SELECT scope_id FROM scope WHERE supersedes_scope_id = ? " +
          "UNION SELECT s.scope_id FROM scope s JOIN descendant d ON s.supersedes_scope_id = d.scope_id" +
          ") SELECT 1 FROM scope_decision WHERE outcome = 'approved' " +
          "AND scope_id IN (SELECT scope_id FROM descendant) LIMIT 1",
      )
      .get(scopeId) !== undefined
  );
}

interface Descendant {
  readonly scopeId: string;
  readonly parent: string;
  /** Its approval's id, or null when it has none. */
  readonly approved: string | null;
}

/** Every scope below `scopeId` at any depth, `supersededByApproved`'s walk with the rows kept. */
function descendantsOf(connection: StoreConnection, scopeId: string): readonly Descendant[] {
  const rows = connection
    .prepare(
      "WITH RECURSIVE descendant(scope_id, parent) AS (" +
        "SELECT scope_id, supersedes_scope_id FROM scope WHERE supersedes_scope_id = ? " +
        "UNION SELECT s.scope_id, s.supersedes_scope_id FROM scope s " +
        "JOIN descendant d ON s.supersedes_scope_id = d.scope_id" +
        ") SELECT d.scope_id, d.parent, sd.scope_decision_id AS approved FROM descendant d " +
        "LEFT JOIN scope_decision sd ON sd.scope_id = d.scope_id AND sd.outcome = 'approved'",
    )
    .all(scopeId) as SqlRow[];
  return rows.map((row) => ({
    scopeId: String(row["scope_id"]),
    parent: String(row["parent"]),
    approved: typeof row["approved"] === "string" ? row["approved"] : null,
  }));
}

/** Of `rows`, the approved ones with no approved row below them: the chain's tips. */
function approvedTips(rows: readonly Descendant[]): readonly Descendant[] {
  const parentOf = new Map(rows.map((row) => [row.scopeId, row.parent]));
  const covered = new Set<string>();
  for (const row of rows) {
    if (row.approved === null) {
      continue;
    }
    // Everything above an approved row has an approved descendant.
    for (let at = parentOf.get(row.scopeId); at !== undefined && !covered.has(at); ) {
      covered.add(at);
      at = parentOf.get(at);
    }
  }
  return rows.filter((row) => row.approved !== null && !covered.has(row.scopeId));
}

/**
 * The approved tip of the chain below one approval (D-0074 section 2.1): with no
 * approved descendant it is the approval itself, and with two it is `forked`,
 * because picking one would spend a grant the person never chose for this lap.
 */
export function tipOf(connection: StoreConnection, scopeDecisionId: string): ScopeTip {
  const row = connection
    .prepare("SELECT scope_id FROM scope_decision WHERE scope_decision_id = ?")
    .get(scopeDecisionId) as SqlRow | undefined;
  if (row === undefined) {
    return { kind: "absent" };
  }
  const tips = approvedTips(descendantsOf(connection, String(row["scope_id"])));
  const [only] = tips;
  if (only === undefined) {
    return { kind: "tip", scopeDecisionId };
  }
  return tips.length === 1 && only.approved !== null
    ? { kind: "tip", scopeDecisionId: only.approved }
    : {
        kind: "forked",
        scopeDecisionIds: tips.flatMap((tip) => (tip.approved === null ? [] : [tip.approved])),
      };
}

/**
 * The approved scope that approving `scopeId` would put a second line beside,
 * or null (D-0074 rule 1.3): the nearest approved scope above it -- or, with
 * none, the top of its chain -- must have no approved descendant outside
 * `scopeId`'s own subtree. A scope that replaces nothing forks nothing.
 */
export function forkedBy(connection: StoreConnection, scopeId: string): string | null {
  const parentOf = connection.prepare("SELECT supersedes_scope_id FROM scope WHERE scope_id = ?");
  const approvedAt = connection.prepare(
    "SELECT 1 FROM scope_decision WHERE scope_id = ? AND outcome = 'approved'",
  );
  const up = (id: string): string | null => {
    const found = (parentOf.get(id) as SqlRow | undefined)?.["supersedes_scope_id"];
    return typeof found === "string" ? found : null;
  };
  let anchor: string | null = null;
  const seen = new Set<string>();
  for (let at = up(scopeId); at !== null && !seen.has(at); at = up(at)) {
    seen.add(at);
    anchor = at;
    if (approvedAt.get(at) !== undefined) {
      break;
    }
  }
  if (anchor === null) {
    return null;
  }
  const own = new Set(descendantsOf(connection, scopeId).map((row) => row.scopeId));
  const other = descendantsOf(connection, anchor).find(
    (row) => row.approved !== null && row.scopeId !== scopeId && !own.has(row.scopeId),
  );
  return other === undefined ? null : other.scopeId;
}

/**
 * The scope's spend, inside `reserve()`'s transaction (D-0066 rules 3.1, 3.2
 * and 4.3): the store-side re-tests, then the consumption row. Returns the
 * refusal, or null when the row landed.
 *
 * **The re-tests are D-0066 rule 4.3's list**, in the verdict's order, made again under
 * the write lock so that two admissions running at once cannot both take the
 * last lap (D-0047 rule 1's reason). The tests rule 4.3 leaves to the snapshot
 * (the agent type record, the grant, the readings) are not repeated here;
 * `agentTypeDigest` is compared with the list, and its own drift between the
 * surface's classification and this write is D-0047 rule 6's bounded race.
 */
export function spendScope(
  connection: StoreConnection,
  input: ReserveInput,
  spend: ScopeSpend,
): Extract<ReserveOutcome, { kind: "scopeRefused" | "unapproved" }> | null {
  const refusal = scopeRefusal(connection, input, spend);
  if (refusal !== null) {
    return { kind: "scopeRefused", ...refusal };
  }
  // An admission's act kind (D-0066 rule 3.2).
  const actKind: (typeof WRITABLE_SCOPE_ACT_KINDS)[number] = "admission";
  try {
    connection
      .prepare(
        "INSERT INTO scope_consumption (scope_decision_id, act_kind, subject_id, proposal_id, " +
          "consumed_at_ms) VALUES (?, ?, ?, ?, ?)",
      )
      .run(spend.scopeDecisionId, actKind, input.id, spend.proposalId, input.nowMs);
    // D-0098 rule 5.3: the closing lap's marker, in the same transaction.
    const closing = spend.closing ?? null;
    if (closing !== null) {
      if (input.supersedesIterationId === null) {
        throw new Error(
          `the closing lap '${input.id}' names no predecessor, and only a redo closes a review`,
        );
      }
      connection
        .prepare(
          "INSERT INTO closing_lap (iteration_id, predecessor_id, read_tip_commit, " +
            "reading_read_at_ms, findings, created_at_ms) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(
          input.id,
          input.supersedesIterationId,
          closing.readTipCommit,
          closing.readingReadAtMs,
          JSON.stringify(closing.findings),
          input.nowMs,
        );
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        kind: "unapproved",
        reason:
          `the admission of '${input.id}' is already recorded under scope decision ` +
          `'${spend.scopeDecisionId}', and the same act is never recorded twice against one ` +
          "approval (D-0066 rule 3.1)",
      };
    }
    throw error;
  }
  return null;
}

/**
 * Whether `messageId` is a message, and whether it opens a request: a thread
 * message (`author_kind` set) with no `in_reply_to` (D-0061 rules 1, 2.4 and
 * 4). The one statement of that test, for a lap's request link and a scope's
 * `requests` alike.
 */
export function requestStanding(
  connection: StoreConnection,
  messageId: string,
): "absent" | "opens" | "not_a_request" {
  const row = connection
    .prepare("SELECT author_kind, in_reply_to FROM conversation_message WHERE message_id = ?")
    .get(messageId) as SqlRow | undefined;
  if (row === undefined) {
    return "absent";
  }
  return row["author_kind"] !== null && row["in_reply_to"] === null ? "opens" : "not_a_request";
}

/**
 * The row opening a request, or null for an id that opens none. Bases that do
 * not parse read as none, which a goal scope covers nothing of (D-0128 rule 1).
 */
export function requestOpenerOf(
  connection: StoreConnection,
  messageId: string,
): RequestOpener | null {
  const row = connection
    .prepare(
      "SELECT author_id, bases FROM conversation_message " +
        "WHERE message_id = ? AND author_kind IS NOT NULL AND in_reply_to IS NULL",
    )
    .get(messageId) as SqlRow | undefined;
  if (row === undefined) {
    return null;
  }
  let bases: unknown = [];
  try {
    bases = JSON.parse(String(row["bases"] ?? "[]"));
  } catch {
    bases = [];
  }
  return {
    messageId,
    authorId: String(row["author_id"] ?? ""),
    bases: Array.isArray(bases) ? (bases as JsonValue[]) : [],
  };
}

/** Why `messageId` cannot be a lap's request link, or null when it can (D-0061 rule 4). */
export function requestRefusal(connection: StoreConnection, messageId: string): string | null {
  const standing = requestStanding(connection, messageId);
  if (standing === "opens") {
    return null;
  }
  return (
    `'${messageId}' ${standing === "absent" ? "is no message in the conversation" : "is a message that does not open a request"}, ` +
    "and a lap names the message that opened its request or none (D-0061 rule 4). Nothing was " +
    "written: no iteration was reserved and no approval was spent."
  );
}

/**
 * Why the scope does not cover this admission, as {@link ScopeRefusal}, or null
 * (D-0066 rule 4.3). `undecidable` where a row the test needs cannot be read.
 *
 * **The asks test runs right after the request test, ahead of the scope's
 * fields and budgets**, in the surface's verdict too. A stopping message is
 * what keeps a line stopped (rule 4.4), so while it stands the question is the
 * answer: tested after the budgets, a spent budget would answer again on every
 * attempt and each refusal would write another stop.
 */
function scopeRefusal(
  connection: StoreConnection,
  input: ReserveInput,
  spend: ScopeSpend,
): ScopeRefusal | null {
  const outside = (test: ScopeTest, reason: string): ScopeRefusal => ({
    verdict: "outside",
    test,
    reason,
  });
  const undecidable = (test: ScopeTest, reason: string): ScopeRefusal => ({
    verdict: "undecidable",
    test,
    reason,
  });
  const decisionId = spend.scopeDecisionId;
  // 1. The decision exists and is approved.
  const decisionRow = connection
    .prepare(
      "SELECT scope_id, scope_digest, outcome FROM scope_decision WHERE scope_decision_id = ?",
    )
    .get(decisionId) as SqlRow | undefined;
  if (decisionRow === undefined) {
    return undecidable(
      "decision",
      `there is no scope decision '${decisionId}' in this store: an act under a scope names an ` +
        "approval a person recorded (D-0066 rule 3.1)",
    );
  }
  if (String(decisionRow["outcome"]) !== "approved") {
    return outside(
      "decision",
      `the scope decision '${decisionId}' declined, and a declined scope authorises nothing ` +
        "(D-0066 rule 2.1, D-0032 rule 6)",
    );
  }
  // 2. The scope row exists and its digest is the decision's.
  const scopeId = String(decisionRow["scope_id"]);
  const scopeRow = connection.prepare(`${SELECT_SCOPE} WHERE scope_id = ?`).get(scopeId) as
    | SqlRow
    | undefined;
  if (scopeRow === undefined) {
    return undecidable(
      "decision",
      `the scope decision '${decisionId}' names scope '${scopeId}', which is no row in this store`,
    );
  }
  let scope: StoredScope;
  try {
    scope = toScope(scopeRow);
  } catch (error) {
    if (error instanceof StoreDefect) {
      return undecidable(
        "decision",
        `the scope '${scopeId}' cannot be read, so nothing is admitted under it: ${error.message}`,
      );
    }
    throw error;
  }
  const approvedDigest = String(decisionRow["scope_digest"]);
  if (scope.scopeDigest !== approvedDigest) {
    return outside(
      "decision",
      `the scope decision '${decisionId}' approved digest '${approvedDigest}' and scope ` +
        `'${scopeId}' digests to '${scope.scopeDigest}': the approval names what was shown ` +
        "(D-0066 rule 1.3)",
    );
  }
  // 3. Not superseded by an approved successor, at any depth.
  if (supersededByApproved(connection, scopeId)) {
    return outside(
      "superseded",
      `the scope '${scopeId}' has an approved successor, and once a successor is approved the ` +
        "predecessor authorises no new act (D-0066 rule 1.4)",
    );
  }
  const { payload } = scope;
  // 4. The request: the row's own link, listed. `requestRefusal` has already
  // refused, earlier in `reserve()`, an id that opens no request, so this asks
  // only whether the scope covers it (D-0066 rule 1.2.1).
  const request = input.requestMessageId;
  const opener = requestOpenerOf(connection, request);
  if (opener === null || !scopeCoversRequest(payload.requests, opener)) {
    return outside(
      "request",
      requestsGoal(payload.requests) === null
        ? `the request '${request}' is not one scope '${scopeId}' lists, ` +
            "and a scope covers only the requests it lists (D-0066 rule 1.2.1)"
        : `the request '${request}' is not one the flow injected from goal ` +
            `'${requestsGoal(payload.requests)}', and scope '${scopeId}' covers only those ` +
            "(D-0128 rule 1)",
    );
  }
  // 5. No open ask over the act's line, read under the write lock (rules 4.2
  // and 4.3): the lineage is every lap sharing the predecessor's root, empty for
  // a lineage start.
  const asks = openAsksIn(connection, request);
  if (asks.kind === "unreadable") {
    return undecidable(
      "asks",
      `whether a question stands over this line cannot be read, so it is outside: ${asks.reason}`,
    );
  }
  const lineage = lineageOf(connection, input.supersedesIterationId);
  if (lineage === null) {
    return undecidable(
      "asks",
      `the lineage through '${String(input.supersedesIterationId)}' does not end within ` +
        `${LINEAGE_BOUND} links, so whether a question stands over it cannot be read`,
    );
  }
  // D-0069 rule 5: a lineage start naming no proposal is held by every open ask.
  const unproposedStart = input.supersedesIterationId === null && spend.proposalId === null;
  const standing = asks.asks.find((ask) => askStandsOver(ask, lineage, unproposedStart));
  if (standing !== undefined) {
    return outside(
      "asks",
      standing.answeredStop
        ? `the message '${standing.messageId}' asks a question the person answered by stopping ` +
            "this line, and it stands over it: an answer that stops leaves the question standing, " +
            "and only an answer that carries on lets the line go on (D-0072 rule 3)"
        : `the message '${standing.messageId}' asks a question nobody has answered, and it stands ` +
            "over this line: the person's answer to carry on is what lets it go on (D-0066 rule " +
            "4.4, D-0072 rule 3)",
    );
  }
  // D-0098 rule 5.5: **one closing lap per line**, tested where the marker is
  // written. An unscoped redo or a retry from a closing lap is read again, and
  // its reading could exit once more; the lineage's earlier marker is what
  // keeps that exit from buying a second closing lap under the same scope.
  if ((spend.closing ?? null) !== null) {
    const marked = connection.prepare("SELECT 1 FROM closing_lap WHERE iteration_id = ?");
    const earlier = lineage.find((id) => marked.get(id) !== undefined);
    if (earlier !== undefined) {
      return outside(
        "readings",
        `the lap '${earlier}' of this line was already its closing lap, and a scope's ` +
          "fix_unread allows one closing lap per line (D-0098 rule 5.5)",
      );
    }
  }
  // 6. The admitted plan's own pair, byte for byte.
  const repository = input.plan["repository"];
  const workspaceRoot = input.plan["workspace_root"];
  if (
    typeof repository !== "string" ||
    typeof workspaceRoot !== "string" ||
    !payload.workspaces.some(
      (pair) => pair.repository === repository && pair.workspace_root === workspaceRoot,
    )
  ) {
    return outside(
      "workspace",
      `the plan's repository and workspace root (${String(repository)}, ${String(workspaceRoot)}) ` +
        `are not a pair scope '${scopeId}' lists (D-0066 rule 1.2.2)`,
    );
  }
  // 7. The agent type.
  if (!payload.agent_types.includes(spend.agentTypeDigest)) {
    return outside(
      "agent_type",
      `the agent type '${spend.agentTypeDigest}' is not one scope '${scopeId}' lists ` +
        "(D-0066 rule 1.2.3)",
    );
  }
  const { budgets } = payload;
  // 8. Expiry, against the act's own clock: at the instant itself it has expired.
  if (input.nowMs >= budgets.expires_at_ms) {
    return outside(
      "expiry",
      `the scope '${scopeId}' expired at ${budgets.expires_at_ms} and this admission is at ` +
        `${input.nowMs}: an expiry refuses the next act (D-0066 rule 3.4.4)`,
    );
  }
  const spent = spentUnder(connection, decisionId);
  // 9. Laps.
  if (spent.admissions >= budgets.laps) {
    return outside(
      "laps",
      `the scope decision '${decisionId}' has admitted ${spent.admissions} of ${budgets.laps} ` +
        "laps, and a spent budget refuses the next admission (D-0066 rule 3.4.1)",
    );
  }
  // 10. Cost: what was read, plus a reserve for every unread lap including this one.
  const committed = spent.readCostUsd + (spent.unreadLaps + 1) * budgets.cost_reserve_usd;
  if (committed > budgets.cost_usd) {
    return outside(
      "cost",
      `the scope decision '${decisionId}' would commit ${committed} USD against a budget of ` +
        `${budgets.cost_usd}: ${spent.readCostUsd} read, plus ${budgets.cost_reserve_usd} reserved ` +
        `for each of ${spent.unreadLaps} unread laps and this one (D-0066 rule 3.4.2)`,
    );
  }
  return null;
}
