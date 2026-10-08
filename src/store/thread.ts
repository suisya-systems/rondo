/**
 * The conversation thread's reads and refusals: what a message may say, which
 * asks are open, what the drafter has covered, and the drafts held for a lap.
 *
 * Split out of `src/store/sqlite.ts` (D-0171), which still owns the driver.
 */

import type {
  OpenAsksReadOutcome,
  StoredReviseDraft,
  ThreadMessagesReadOutcome,
} from "./contract.js";
import { canonicalJson, planDigest } from "./plan.js";
import {
  type AnswerOutcome,
  FLOW_AUTHOR,
  FLOW_AUTHOR_PREFIX,
  isFlowAuthor,
  isQuestion,
  type JsonRecord,
  type LapReading,
  type OpenAsk,
  QUESTION_ID_PREFIX,
  readingContent,
  type ScopeDraft,
  type ThreadMessageDraft,
  WORKER_QUESTION_AUTHOR,
} from "./records.js";
import {
  describe,
  immediateTransaction,
  isRecord,
  type SqlRow,
  type StoreConnection,
} from "./rows.js";

/** The repository a triage payload was read for, or null when it names none. */
export function triageRepository(payload: string): string | null {
  try {
    const read: unknown = JSON.parse(payload);
    return isRecord(read) && typeof read["repository"] === "string" ? read["repository"] : null;
  } catch {
    return null;
  }
}

/** The candidate keys a triage payload proposed: its recommendation and runners-up. */
export function triageKeys(payload: string): readonly string[] {
  try {
    const read: unknown = JSON.parse(payload);
    const ranked = isRecord(read) ? read["ranked"] : null;
    return Array.isArray(ranked)
      ? ranked.flatMap((one: unknown) =>
          isRecord(one) && typeof one["key"] === "string" ? [one["key"]] : [],
        )
      : [];
  } catch {
    return [];
  }
}

/**
 * Each basis form and the fields its locator needs, mirroring the advisory's
 * closed `Basis` union (D-0032 rule 2, plus D-0061 rule 2.6's `message` and
 * rondo#197's `scope`). The store may not import that type, so a form added
 * there is added here too.
 */
const BASIS_LOCATOR_FIELDS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  snapshot: { pointer: "string" },
  iteration: { iterationId: "string" },
  gateTransition: { gateId: "string", transitionSeq: "number" },
  continuoRun: { runId: "string" },
  repository: { path: "string", commit: "string", firstLine: "number", lastLine: "number" },
  message: { messageId: "string" },
  scope: { scopeId: "string" },
  // D-0071 rule 7.3: a drafter message rests on the proposal row its run wrote.
  proposal: { proposalId: "string" },
  // D-0075 rule 2.4: a drafted scope rests on the setup row it records from.
  setup: { setupId: "string" },
  // D-0128 rule 1: a request the flow host injects names the goal it serves.
  goal: { goalId: "string" },
};

/**
 * The newest `revise_draft` row of a lap whose snapshot holds `reading` by
 * content (D-0077 rule 2.2). A row whose bytes will not parse holds nothing.
 */
export function reviseDraftHolding(
  connection: StoreConnection,
  iterationId: string,
  reading: LapReading,
): StoredReviseDraft | null {
  const key = canonicalJson(readingContent(reading));
  const rows = connection
    .prepare(
      "SELECT proposal_id, drafter, payload, snapshot, created_at_ms FROM proposal " +
        "WHERE kind = 'revise_draft' AND iteration_id = ? ORDER BY created_at_ms DESC, rowid DESC",
    )
    .all(iterationId) as SqlRow[];
  for (const row of rows) {
    try {
      const snapshot = JSON.parse(String(row["snapshot"])) as JsonRecord;
      const held = snapshot["reading"];
      const payload = JSON.parse(String(row["payload"])) as unknown;
      if (
        held !== undefined &&
        canonicalJson(held) === key &&
        typeof payload === "object" &&
        payload !== null &&
        !Array.isArray(payload)
      ) {
        return {
          proposalId: String(row["proposal_id"]),
          drafter: String(row["drafter"]),
          payload: payload as JsonRecord,
          createdAtMs: Number(row["created_at_ms"]),
        };
      }
    } catch {
      // Unreadable bytes hold no reading; the next row may.
    }
  }
  return null;
}

/**
 * The newest `publish_body` row of one lap's gate (rondo#290), or null when the
 * body of that lap has not been composed.
 *
 * **Found by the lap and its gate, and not by the report's own bytes.** The
 * report is continuo's, read across a process boundary, and a reader that had
 * to hold it to find this row could not find it without spawning; the gate is
 * on the lap's row, and a lap has one. A row whose payload will not parse holds
 * no body, and the next row may.
 */
export function publishBodyHolding(
  connection: StoreConnection,
  iterationId: string,
  gateId: string,
): StoredReviseDraft | null {
  const rows = connection
    .prepare(
      "SELECT proposal_id, drafter, payload, snapshot, created_at_ms FROM proposal " +
        "WHERE kind = 'publish_body' AND iteration_id = ? ORDER BY created_at_ms DESC, rowid DESC",
    )
    .all(iterationId) as SqlRow[];
  for (const row of rows) {
    try {
      const snapshot = JSON.parse(String(row["snapshot"])) as JsonRecord;
      const payload = JSON.parse(String(row["payload"])) as unknown;
      if (
        snapshot["gate_id"] === gateId &&
        typeof payload === "object" &&
        payload !== null &&
        !Array.isArray(payload)
      ) {
        return {
          proposalId: String(row["proposal_id"]),
          drafter: String(row["drafter"]),
          payload: payload as JsonRecord,
          createdAtMs: Number(row["created_at_ms"]),
        };
      }
    } catch {
      // Unreadable bytes hold no body; the next row may.
    }
  }
  return null;
}

/**
 * The operator messages at or before `table`'s one row, writing that row on
 * the first call: the moment a host that does this work first ran here.
 * Questions (D-0177) stay in: the set only holds messages back from a host, and
 * no host reads a question as asking for work anyway (`asksForWork`).
 */
export function messagesBeforeEpoch(
  connection: StoreConnection,
  table: "drafter_epoch" | "issue_reader_epoch",
  nowMs: number,
): ReadonlySet<string> {
  const rows = immediateTransaction(connection, () => {
    connection
      .prepare(
        `INSERT INTO ${table} (id, last_rowid, started_at_ms) ` +
          "SELECT 1, COALESCE((SELECT MAX(rowid) FROM conversation_message), 0), ? " +
          `WHERE NOT EXISTS (SELECT 1 FROM ${table})`,
      )
      .run(nowMs);
    return connection
      .prepare(
        "SELECT message_id FROM conversation_message WHERE author_kind = 'operator' " +
          `AND rowid <= (SELECT last_rowid FROM ${table} WHERE id = 1)`,
      )
      .all() as SqlRow[];
  });
  return new Set(rows.map((row) => String(row["message_id"])));
}

/** One drafter row's two sets: what it covers, and what its material held. */
interface DrafterRowCoverage {
  readonly covers: Set<string>;
  readonly held: Set<string>;
}

/** The row `id` names, made on first mention. */
function rowCoverage(rows: Map<string, DrafterRowCoverage>, id: string): DrafterRowCoverage {
  const known = rows.get(id);
  if (known !== undefined) {
    return known;
  }
  const made = { covers: new Set<string>(), held: new Set<string>() };
  rows.set(id, made);
  return made;
}

/**
 * Every operator message a drafter row covers (D-0071 rule 3.2 as `D-0131`
 * narrows it): a row covers a message **only with the issue reads it held**.
 *
 * A row is a proposal whose snapshot lists the message under `covers`, or a
 * drafter message citing it, exactly as rule 3.2 says. What it held is **the
 * material's own membership**, not a time: a proposal's `$.material.thread`
 * lists every message its run was handed, and a drafter message's `message:`
 * bases are what the run that wrote it cited -- an unavailable run cites the
 * reads it held beside the messages it covers (`drafter-host.ts`). A `forge`
 * message answering the operator message that is **not in that membership** is
 * material no covering row read, so the message is not covered and the thread
 * is drafted again over it.
 *
 * Membership rather than a clock because both clocks lie in the same direction
 * (`D-0131` rule 1): a summary is written *after* its run's material was
 * assembled, so its write time would cover a read the draft never saw, and a
 * read's `at_ms` is stamped *before* the repository is resolved and the forge
 * answers, so it can precede a draft it landed after.
 */
export function coveredMessageIds(connection: StoreConnection, drafterPrefix: string): Set<string> {
  const rows = new Map<string, DrafterRowCoverage>();
  // The CASE rather than a WHERE: the planner may run json_each before a
  // filter, and a malformed document must read as empty, not raise.
  const snapshot = "CASE WHEN json_valid(p.snapshot) THEN p.snapshot ELSE '{}' END";
  for (const row of connection
    .prepare(
      `SELECT p.proposal_id AS row_id, j.value AS id FROM proposal p, json_each(${snapshot}, ` +
        "'$.covers') j WHERE substr(p.drafter, 1, length(?)) = ?",
    )
    .all(drafterPrefix, drafterPrefix) as SqlRow[]) {
    rowCoverage(rows, `proposal:${String(row["row_id"])}`).covers.add(String(row["id"]));
  }
  for (const row of connection
    .prepare(
      `SELECT p.proposal_id AS row_id, json_extract(j.value, '$.messageId') AS id FROM proposal p, ` +
        `json_each(${snapshot}, '$.material.thread') j WHERE substr(p.drafter, 1, length(?)) = ? ` +
        "AND json_type(j.value) = 'object'",
    )
    .all(drafterPrefix, drafterPrefix) as SqlRow[]) {
    const id = row["id"];
    if (typeof id === "string") {
      rowCoverage(rows, `proposal:${String(row["row_id"])}`).held.add(id);
    }
  }
  // A drafter message holds what it cites; only the operator messages among
  // them are covered, so citing the reads a run held adds nothing to `covers`.
  for (const row of connection
    .prepare(
      "SELECT m.message_id AS row_id, json_extract(j.value, '$.messageId') AS id, " +
        "(SELECT c.author_kind FROM conversation_message c WHERE c.message_id = " +
        "json_extract(j.value, '$.messageId')) AS cited_kind FROM conversation_message m, " +
        "json_each(CASE WHEN json_valid(m.bases) THEN m.bases ELSE '[]' END) j " +
        "WHERE m.author_kind = 'drafter' AND substr(m.author_id, 1, length(?)) = ? " +
        "AND json_type(j.value) = 'object' AND json_extract(j.value, '$.form') = 'message'",
    )
    .all(drafterPrefix, drafterPrefix) as SqlRow[]) {
    const id = row["id"];
    if (typeof id !== "string") {
      continue;
    }
    const coverage = rowCoverage(rows, `message:${String(row["row_id"])}`);
    coverage.held.add(id);
    if (row["cited_kind"] !== "forge") {
      coverage.covers.add(id);
    }
  }
  const reads = new Map<string, Set<string>>();
  for (const row of connection
    .prepare(
      "SELECT message_id, in_reply_to FROM conversation_message " +
        "WHERE author_kind = 'forge' AND in_reply_to IS NOT NULL",
    )
    .all() as SqlRow[]) {
    const answered = String(row["in_reply_to"]);
    const held = reads.get(answered) ?? new Set<string>();
    held.add(String(row["message_id"]));
    reads.set(answered, held);
  }
  const covered = new Set<string>();
  for (const { covers, held } of rows.values()) {
    for (const id of covers) {
      if ([...(reads.get(id) ?? [])].every((read) => held.has(read))) {
        covered.add(id);
      }
    }
  }
  return covered;
}

/**
 * The person's questions (D-0177, `question-` ids) no drafter named with
 * `drafterPrefix` has answered yet, oldest first. Answered means a drafter
 * message under the prefix **replies to** the question and cites it by a
 * `message:` basis, as `recordAnswer` writes one. Citing alone is not answering:
 * an answer to one question may cite another, which is still owed its own.
 */
export function unansweredQuestionIds(
  connection: StoreConnection,
  drafterPrefix: string,
): string[] {
  return (
    connection
      .prepare(
        "SELECT q.message_id FROM conversation_message q WHERE q.author_kind = 'operator' " +
          "AND substr(q.message_id, 1, length(?)) = ? AND NOT EXISTS (SELECT 1 FROM " +
          "conversation_message m, json_each(CASE WHEN json_valid(m.bases) THEN m.bases " +
          "ELSE '[]' END) j WHERE m.author_kind = 'drafter' AND " +
          "m.in_reply_to = q.message_id AND substr(m.author_id, 1, length(?)) = ? AND " +
          "json_type(j.value) = 'object' AND " +
          "json_extract(j.value, '$.form') = 'message' AND " +
          "json_extract(j.value, '$.messageId') = q.message_id) ORDER BY q.rowid",
      )
      .all(QUESTION_ID_PREFIX, QUESTION_ID_PREFIX, drafterPrefix, drafterPrefix) as SqlRow[]
  ).map((row) => String(row["message_id"]));
}

/** A flow ask's points read back; a row that will not read asks nothing. */
export function flowPoints(
  json: string,
): { readonly point: string; readonly recommendation: string }[] {
  let points: unknown;
  try {
    points = JSON.parse(json);
  } catch {
    return [];
  }
  return Array.isArray(points)
    ? points.flatMap((one: unknown) =>
        isRecord(one) &&
        typeof one["point"] === "string" &&
        typeof one["recommendation"] === "string"
          ? [{ point: one["point"], recommendation: one["recommendation"] }]
          : [],
      )
    : [];
}

/**
 * Every operator message in a request's thread -- the request and every reply
 * under it, through any voice (D-0071 rule 7.2) -- and the flow host's opener,
 * which asks for the work as a person's message does (rondo#469, `asksForWork`).
 * A person's question is left out (D-0177): it asks for an explanation, not the
 * work, so asking one while a split draft runs does not make that draft stale.
 */
export function threadOperatorMessages(
  connection: StoreConnection,
  requestMessageId: string,
): string[] {
  return (
    connection
      .prepare(
        "WITH RECURSIVE thread(id) AS (SELECT ? UNION " +
          "SELECT m.message_id FROM conversation_message m JOIN thread t ON m.in_reply_to = t.id) " +
          "SELECT m.message_id FROM conversation_message m JOIN thread t ON m.message_id = t.id " +
          "WHERE (m.author_kind = 'operator' AND substr(m.message_id, 1, length(?)) <> ?) OR " +
          "(m.author_kind = 'drafter' AND m.in_reply_to IS NULL AND " +
          "substr(m.author_id, 1, length(?)) = ?)",
      )
      .all(
        requestMessageId,
        QUESTION_ID_PREFIX,
        QUESTION_ID_PREFIX,
        FLOW_AUTHOR_PREFIX,
        FLOW_AUTHOR_PREFIX,
      ) as SqlRow[]
  ).map((row) => String(row["message_id"]));
}

/**
 * Where a drafter's scope records an agent type from, or why it may not
 * (D-0071 point 1 (a), section 6.2): an operator message in the thread the
 * scope rests on, whose body is the plan the record is copied from.
 *
 * The store cannot rebuild the digest (D-0006), so what it checks is what it
 * can read itself: the message is an operator's, the scope cites it, its body's
 * `agent_type_input` is the record's byte for byte in canonical form, and its
 * body is the plan the record names.
 */
export function pastedPlanRefusal(
  connection: StoreConnection,
  draft: ScopeDraft,
  recorded: ScopeDraft["agentTypeRecords"][number],
): { readonly authorId: string } | { readonly refusal: string } {
  const where = `the drafter's scope '${draft.scopeId}' records the agent type '${recorded.agentTypeDigest}'`;
  const messageId = recorded.fromMessageId;
  if (messageId === undefined) {
    return {
      refusal:
        `${where} from no message: a drafter's scope records one only from a plan a person ` +
        "pasted into the thread, and a drafter's lists only agent types already held " +
        "otherwise (D-0071 section 6.2, D-0022 rule 7)",
    };
  }
  if (
    !draft.bases.some(
      (basis) =>
        typeof basis === "object" &&
        basis !== null &&
        !Array.isArray(basis) &&
        (basis as JsonRecord)["form"] === "message" &&
        (basis as JsonRecord)["messageId"] === messageId,
    )
  ) {
    return { refusal: `${where} from '${messageId}' and does not cite it (D-0071 point 1 (a))` };
  }
  const row = connection
    .prepare("SELECT body, author_kind, author_id FROM conversation_message WHERE message_id = ?")
    .get(messageId) as SqlRow | undefined;
  if (row === undefined || row["author_kind"] !== "operator") {
    return {
      refusal: `${where} from '${messageId}', which is no operator message: the bytes must be a person's (D-0071 point 1 (a))`,
    };
  }
  if (isQuestion({ authorKind: "operator", messageId })) {
    return {
      refusal: `${where} from '${messageId}', which is a question: a plan pasted to ask about it is no plan offered (D-0177 rule 2)`,
    };
  }
  let plan: unknown;
  try {
    plan = JSON.parse(String(row["body"]));
  } catch {
    plan = null;
  }
  const input =
    typeof plan === "object" && plan !== null && !Array.isArray(plan)
      ? (plan as JsonRecord)["agent_type_input"]
      : undefined;
  if (
    input === undefined ||
    canonicalJson(input) !== canonicalJson(recorded.agentTypeInput) ||
    planDigest(plan as JsonRecord) !== recorded.planDigest
  ) {
    return {
      refusal:
        `${where} from '${messageId}', whose body is not the plan the record is copied from: ` +
        "a record is the person's bytes, never a copy that differs (D-0071 section 5.1)",
    };
  }
  return { authorId: String(row["author_id"]) };
}

/**
 * Where a drafter's scope records an agent type from a setup row, or why it
 * may not (D-0075 rule 2.4): `pastedPlanRefusal`'s check with the row standing
 * where the message stood. The scope cites the row by a `setup` basis, the row
 * exists, its plan's `agent_type_input` is the record's byte for byte in
 * canonical form, and its plan is the one the record names. The record is the
 * row's `recorded_by`'s.
 */
export function setupPlanRefusal(
  connection: StoreConnection,
  draft: ScopeDraft,
  recorded: ScopeDraft["agentTypeRecords"][number],
  setupId: string,
): { readonly authorId: string } | { readonly refusal: string } {
  const where = `the drafter's scope '${draft.scopeId}' records the agent type '${recorded.agentTypeDigest}' from setup '${setupId}'`;
  if (
    !draft.bases.some(
      (basis) =>
        typeof basis === "object" &&
        basis !== null &&
        !Array.isArray(basis) &&
        (basis as JsonRecord)["form"] === "setup" &&
        (basis as JsonRecord)["setupId"] === setupId,
    )
  ) {
    return { refusal: `${where} and does not cite it (D-0075 rule 2.4)` };
  }
  const row = connection
    .prepare("SELECT plan, plan_digest, recorded_by FROM setup_plan WHERE setup_id = ?")
    .get(setupId) as SqlRow | undefined;
  if (row === undefined) {
    return { refusal: `${where}, which is no setup row (D-0075 rule 2.4)` };
  }
  let plan: unknown;
  try {
    plan = JSON.parse(String(row["plan"]));
  } catch {
    plan = null;
  }
  const input =
    typeof plan === "object" && plan !== null && !Array.isArray(plan)
      ? (plan as JsonRecord)["agent_type_input"]
      : undefined;
  if (
    input === undefined ||
    canonicalJson(input) !== canonicalJson(recorded.agentTypeInput) ||
    planDigest(plan as JsonRecord) !== recorded.planDigest
  ) {
    return {
      refusal:
        `${where}, whose plan is not the plan the record is copied from: a record is setup's ` +
        "bytes, never a copy that differs (D-0075 rule 2.4)",
    };
  }
  return { authorId: String(row["recorded_by"]) };
}

/**
 * Why a thread message may not be written, or null (D-0061 rules 2 and 3).
 *
 * Read inside the writer's transaction, so the message a reply or a basis
 * names is still there when the row lands. The duplicate id is the insert's own
 * refusal and is not repeated here.
 */
export function threadMessageRefusal(
  connection: StoreConnection,
  draft: ThreadMessageDraft,
): string | null {
  if (
    draft.authorKind !== "operator" &&
    draft.authorKind !== "drafter" &&
    draft.authorKind !== "forge"
  ) {
    return `a thread message is written by an operator, a drafter or rondo's issue reader, and '${String(draft.authorKind)}' is none of them (D-0061 rule 2.3, D-0078 section 3.1)`;
  }
  if (draft.authorId.trim() === "") {
    return "a thread message names who wrote it, and its author id is blank (D-0061 rule 2.3)";
  }
  if (draft.body === "") {
    return "a thread message holds the words as written, and this one holds none (D-0061 rule 2.2)";
  }
  if (draft.authorKind === "drafter" && draft.bases.length === 0) {
    return (
      `the drafter message '${draft.messageId}' carries no basis, and a sentence rondo composes ` +
      "about a request must lead back to the words it rests on: D-0061 rule 2.6 refuses one " +
      "resting on nothing"
    );
  }
  const isThreadMessage = (id: string): boolean =>
    connection
      .prepare(
        "SELECT 1 FROM conversation_message WHERE message_id = ? AND author_kind IS NOT NULL",
      )
      .get(id) !== undefined;
  if (draft.inReplyTo !== null && !isThreadMessage(draft.inReplyTo)) {
    return (
      `'${draft.messageId}' replies to '${draft.inReplyTo}', which is no message in a request ` +
      "thread: a reply to nothing would be a thread nobody can follow back (D-0061 rule 2.4)"
    );
  }
  // **A read answers the message that named the issue, and nothing else**
  // (D-0078 section 3.1): a `forge` row opening a request, or under a
  // drafter's words, would be the forge speaking where only a person asked.
  // The flow host's opener is the one drafter row that asks for work, under a
  // goal scope a person approved (rondo#469), so its issue is read too.
  if (
    draft.authorKind === "forge" &&
    (draft.inReplyTo === null ||
      connection
        .prepare(
          "SELECT 1 FROM conversation_message WHERE message_id = ? AND (author_kind = " +
            "'operator' OR (author_kind = 'drafter' AND in_reply_to IS NULL AND " +
            "substr(author_id, 1, length(?)) = ?))",
        )
        .get(draft.inReplyTo, FLOW_AUTHOR_PREFIX, FLOW_AUTHOR_PREFIX) === undefined)
  ) {
    return (
      `'${draft.messageId}' is what rondo read of an issue, and it replies to no operator ` +
      "message: a read is only ever of an issue a person's message named (D-0078 section 3.1)"
    );
  }
  const outcomeRefusal = answerOutcomeRefusal(connection, draft);
  if (outcomeRefusal !== null) {
    return outcomeRefusal;
  }
  for (const basis of draft.bases) {
    const form = basis["form"];
    const fields = typeof form === "string" ? BASIS_LOCATOR_FIELDS[form] : undefined;
    if (
      fields === undefined ||
      !Object.entries(fields).every(([field, type]) => typeof basis[field] === type)
    ) {
      return (
        `a basis of '${draft.messageId}' is ${canonicalJson(basis)}, which is not a complete ` +
        "locator in any form D-0032 rule 2 and D-0061 rule 2.6 define"
      );
    }
    if (basis["form"] === "message") {
      const target = basis["messageId"];
      const found =
        typeof target === "string" &&
        connection
          .prepare("SELECT 1 FROM conversation_message WHERE message_id = ?")
          .get(target) !== undefined;
      if (!found) {
        return (
          `a basis of '${draft.messageId}' is message:${String(target)}, which is no message in ` +
          "the conversation: a locator to nothing is a basis nobody can follow (D-0061 rule 2.6)"
        );
      }
    }
    if (
      basis["form"] === "scope" &&
      connection
        .prepare("SELECT 1 FROM scope WHERE scope_id = ?")
        .get(basis["scopeId"] as string) === undefined
    ) {
      return (
        `a basis of '${draft.messageId}' is scope:${String(basis["scopeId"])}, which is no scope ` +
        "row: a locator to nothing is a basis nobody can follow (D-0061 rule 2.6)"
      );
    }
    if (
      basis["form"] === "proposal" &&
      connection
        .prepare("SELECT 1 FROM proposal WHERE proposal_id = ?")
        .get(basis["proposalId"] as string) === undefined
    ) {
      return (
        `a basis of '${draft.messageId}' is proposal:${String(basis["proposalId"])}, which is no ` +
        "proposal row: a locator to nothing is a basis nobody can follow (D-0061 rule 2.6)"
      );
    }
    if (
      basis["form"] === "setup" &&
      connection
        .prepare("SELECT 1 FROM setup_plan WHERE setup_id = ?")
        .get(basis["setupId"] as string) === undefined
    ) {
      return (
        `a basis of '${draft.messageId}' is setup:${String(basis["setupId"])}, which is no ` +
        "setup row: a locator to nothing is a basis nobody can follow (D-0061 rule 2.6)"
      );
    }
    if (
      basis["form"] === "goal" &&
      connection.prepare("SELECT 1 FROM goal WHERE goal_id = ?").get(basis["goalId"] as string) ===
        undefined
    ) {
      return (
        `a basis of '${draft.messageId}' is goal:${String(basis["goalId"])}, which is no ` +
        "goal row: a locator to nothing is a basis nobody can follow (D-0061 rule 2.6)"
      );
    }
  }
  return null;
}

/**
 * Why a message may not carry the answer it carries, or null (D-0072 rule 2).
 *
 * **Four refusals, and each one keeps a reading off the row that the row cannot
 * support.** An answer is a person's (D-0066 rule 4.4 says "the person's
 * reply"), it answers one question and not the thread at large, and it is one of
 * two words. Held here rather than at the surface because the answer is what
 * releases work: `openAsksIn` reads this column under the write lock (rule
 * 4.3), so anything that could write a value this reader would honour has to be
 * refused where the write happens, not where one caller happens to be careful.
 */
function answerOutcomeRefusal(
  connection: StoreConnection,
  draft: ThreadMessageDraft,
): string | null {
  const outcome = draft.answerOutcome;
  if (outcome === undefined) {
    return null;
  }
  if (outcome !== "carry_on" && outcome !== "stop") {
    return (
      `'${draft.messageId}' carries the answer '${String(outcome)}', and an answer is ` +
      "'carry_on' or 'stop' (D-0072 rule 1)"
    );
  }
  if (draft.authorKind !== "operator") {
    return (
      `'${draft.messageId}' is a drafter message carrying the answer '${outcome}', and what ends ` +
      "a stop is the person's answer and never rondo's own (D-0066 rule 4.4, D-0072 rule 2)"
    );
  }
  if (draft.inReplyTo === null) {
    return (
      `'${draft.messageId}' carries the answer '${outcome}' and replies to nothing: an answer ` +
      "answers one question, and a message that opens a request answers none (D-0072 rule 2)"
    );
  }
  const asked =
    connection
      .prepare("SELECT 1 FROM conversation_message WHERE message_id = ? AND asks = 1")
      .get(draft.inReplyTo) !== undefined;
  if (!asked) {
    return (
      `'${draft.messageId}' carries the answer '${outcome}' and replies to '${draft.inReplyTo}', ` +
      "which asks nothing: only a question put to the person can be answered (D-0072 rule 2)"
    );
  }
  return null;
}

/**
 * The open asks in the thread `requestMessageId` opens (D-0061 rule 2.7, D-0066
 * rule 4.2): messages whose `in_reply_to` chain reaches the root, the root
 * included, with `asks = 1` that **no operator's `carry_on` answer has carried
 * on** (D-0072 rule 3).
 *
 * **It opens on the absence of a `carry_on`, not on the presence of a `stop`**,
 * and that is the whole of #206. Before D-0072 any reply at all closed an ask,
 * so "stop this line" released the line as surely as "go on" and the row could
 * not tell the two apart (lap 8's N-31). Now an ordinary reply, a drafter's
 * report and a `stop` answer all leave the ask standing, and the one thing that
 * ends a stop is the person pressing the answer that says to carry on. The
 * `author_kind` in the same clause is D-0066 rule 4.4's "**the person's**
 * reply" read literally: no message rondo writes about a request can release
 * the hold rondo put on it.
 *
 * `answeredStop` comes back per row so a refusal can say which of the two
 * reasons it is standing for; nothing in the verdict branches on it.
 *
 * `UNION` rather than `UNION ALL` in the thread walk, so it terminates even
 * over a cycle nobody could write through `recordThreadMessage`.
 */
export function openAsksIn(
  connection: StoreConnection,
  requestMessageId: string,
): OpenAsksReadOutcome {
  const rows = connection
    .prepare(
      "WITH RECURSIVE thread(id) AS (SELECT ? " +
        "UNION SELECT m.message_id FROM conversation_message m JOIN thread t ON m.in_reply_to = t.id" +
        ") SELECT m.message_id, m.bases, m.author_id, EXISTS (SELECT 1 FROM conversation_message s " +
        "WHERE s.in_reply_to = m.message_id AND s.author_kind = 'operator' " +
        "AND s.answer_outcome = 'stop') AS answered_stop " +
        "FROM conversation_message m " +
        "WHERE m.message_id IN (SELECT id FROM thread) AND m.asks = 1 AND NOT EXISTS " +
        "(SELECT 1 FROM conversation_message r WHERE r.in_reply_to = m.message_id " +
        "AND r.author_kind = 'operator' AND r.answer_outcome = 'carry_on') " +
        // `withdrawnByFlow`: a flow question the flow replied to is closed.
        "AND NOT (m.author_id = ? AND EXISTS (SELECT 1 FROM conversation_message w " +
        "WHERE w.in_reply_to = m.message_id AND w.author_id = ?)) " +
        "ORDER BY m.at_ms, m.message_id",
    )
    .all(requestMessageId, FLOW_AUTHOR, FLOW_AUTHOR) as SqlRow[];
  const asks: OpenAsk[] = [];
  for (const row of rows) {
    const messageId = String(row["message_id"]);
    let bases: unknown;
    try {
      bases = row["bases"] === null ? [] : JSON.parse(String(row["bases"]));
    } catch (error) {
      return {
        kind: "unreadable",
        reason: `the bases of message '${messageId}' are not JSON: ${describe(error)}`,
      };
    }
    if (!Array.isArray(bases)) {
      return {
        kind: "unreadable",
        reason: `the bases of message '${messageId}' are JSON, but not a list`,
      };
    }
    const iterationIds: string[] = [];
    for (const basis of bases) {
      if (typeof basis !== "object" || basis === null) {
        return {
          kind: "unreadable",
          reason: `a basis of message '${messageId}' is not a locator`,
        };
      }
      const { form, iterationId } = basis as Record<string, unknown>;
      if (form === "iteration") {
        if (typeof iterationId !== "string") {
          return {
            kind: "unreadable",
            reason: `an iteration basis of message '${messageId}' names no iteration id`,
          };
        }
        iterationIds.push(iterationId);
      }
    }
    asks.push(
      Object.freeze({
        messageId,
        iterationIds: Object.freeze(iterationIds),
        answeredStop: Number(row["answered_stop"]) === 1,
        ...(row["author_id"] === WORKER_QUESTION_AUTHOR ? { lineOnly: true as const } : {}),
        ...(isFlowAuthor(row["author_id"]) ? { holdsNothing: true as const } : {}),
      }),
    );
  }
  return { kind: "read", asks: Object.freeze(asks) };
}

/**
 * Every thread message, oldest first (D-0061 rule 2): `at_ms`, then `rowid`,
 * so two messages written in one millisecond keep the order they were written
 * in. Fail closed on bases that will not parse, for {@link openAsksIn}'s reason.
 */
export function threadMessages(connection: StoreConnection): ThreadMessagesReadOutcome {
  const rows = connection
    .prepare(
      "SELECT message_id, body, author_kind, author_id, in_reply_to, at_ms, bases, asks, " +
        "answer_outcome FROM conversation_message WHERE author_kind IS NOT NULL " +
        "ORDER BY at_ms, rowid",
    )
    .all() as SqlRow[];
  const messages: ThreadMessageDraft[] = [];
  for (const row of rows) {
    const messageId = String(row["message_id"]);
    let bases: unknown;
    try {
      bases = row["bases"] === null ? [] : JSON.parse(String(row["bases"]));
    } catch (error) {
      return {
        kind: "unreadable",
        reason: `the bases of message '${messageId}' are not JSON: ${describe(error)}`,
      };
    }
    if (!Array.isArray(bases) || !bases.every((one) => typeof one === "object" && one !== null)) {
      return {
        kind: "unreadable",
        reason: `the bases of message '${messageId}' are not a list of locators`,
      };
    }
    messages.push(
      Object.freeze({
        messageId,
        body: String(row["body"] ?? ""),
        authorKind:
          row["author_kind"] === "drafter" || row["author_kind"] === "forge"
            ? row["author_kind"]
            : "operator",
        authorId: String(row["author_id"] ?? ""),
        inReplyTo: row["in_reply_to"] === null ? null : String(row["in_reply_to"]),
        atMs: Number(row["at_ms"] ?? 0),
        bases: Object.freeze(bases as JsonRecord[]),
        asks: Number(row["asks"]) === 1,
        // Spread rather than set, because `exactOptionalPropertyTypes` makes
        // "absent" and "present and undefined" two different drafts, and the
        // one this row is holds no answer (D-0072 rule 1).
        ...(row["answer_outcome"] === null || row["answer_outcome"] === undefined
          ? {}
          : { answerOutcome: String(row["answer_outcome"]) as AnswerOutcome }),
      }),
    );
  }
  return { kind: "read", messages: Object.freeze(messages) };
}
