/**
 * The person's standing policies (D-0067 rule 6): what they want kept across
 * requests, as rows of their own, immutable and append-only with no status.
 *
 * **The in-force policies are the rows no successor names**, and a successor
 * with an empty body retires the one it names (rule 6.3). A drafter may add a
 * policy, only from the person's own messages (rule 6.2); only an operator
 * writes a successor, so a drafter can never weaken or retire one.
 */

import type { RecordOutcome } from "./contract.js";
import type { JsonRecord } from "./records.js";
import { describe, immediateTransaction, type SqlRow, type StoreConnection } from "./rows.js";

/** One `standing_policy` row as a writer takes it (D-0067 rule 6.1). */
export interface StandingPolicyDraft {
  readonly policyId: string;
  /** The policy as written, never paraphrased after it is stored; empty only on a retiring successor. */
  readonly body: string;
  readonly authorKind: "operator" | "drafter";
  readonly authorId: string;
  /** `message:` locators for a drafter's row (rule 6.2); an operator's may be empty. */
  readonly bases: readonly JsonRecord[];
  readonly supersedesPolicyId: string | null;
  readonly createdAtMs: number;
}

/** One row read back. */
export type StoredStandingPolicy = StandingPolicyDraft;

/**
 * Why the store refuses `draft`, or null (D-0067 rules 6.2 and 6.3).
 *
 * Held here, under the caller's write lock, because the in-force set is read
 * off the rows: a successor checked outside the lock could fork a policy.
 */
export function standingPolicyRefusal(
  connection: StoreConnection,
  draft: StandingPolicyDraft,
): string | null {
  const id = draft.policyId;
  if (draft.authorKind !== "operator" && draft.authorKind !== "drafter") {
    return `'${id}' is written by '${String(draft.authorKind)}', and a policy is an operator's or a drafter's (D-0067 rule 6.1)`;
  }
  if (connection.prepare("SELECT 1 FROM standing_policy WHERE policy_id = ?").get(id)) {
    return `a policy row '${id}' is already recorded, and a policy row is never rewritten (D-0067 rule 6)`;
  }
  if (draft.authorKind === "drafter" && draft.supersedesPolicyId !== null) {
    return (
      `'${id}' is a drafter's row naming '${draft.supersedesPolicyId}' as the one it replaces, and ` +
      "only an operator changes or retires a policy: a drafter can add one and never weaken one (D-0067 rule 6.3)"
    );
  }
  if (draft.supersedesPolicyId === null && draft.body.trim() === "") {
    return `'${id}' says nothing and replaces nothing: only a successor may be empty, and it retires the policy it names (D-0067 rule 6.3)`;
  }
  if (draft.supersedesPolicyId !== null) {
    const named = connection
      .prepare(
        "SELECT body, (SELECT 1 FROM standing_policy s WHERE s.supersedes_policy_id = p.policy_id) " +
          "AS replaced FROM standing_policy p WHERE policy_id = ?",
      )
      .get(draft.supersedesPolicyId) as SqlRow | undefined;
    if (named === undefined || named["replaced"] !== null || named["body"] === "") {
      return `'${id}' replaces '${draft.supersedesPolicyId}', which is no policy in force (D-0067 rule 6.3)`;
    }
  }
  if (draft.authorKind === "drafter") {
    if (draft.bases.length === 0) {
      return (
        `'${id}' is a drafter's policy with no basis: it is drafted from what the person said, ` +
        "and holds the messages they said it in (D-0067 rule 6.2)"
      );
    }
    for (const basis of draft.bases) {
      const said =
        basis["form"] === "message" &&
        typeof basis["messageId"] === "string" &&
        connection
          .prepare(
            "SELECT 1 FROM conversation_message WHERE message_id = ? AND author_kind = 'operator'",
          )
          .get(basis["messageId"]) !== undefined;
      if (!said) {
        return (
          `a basis of '${id}' is ${JSON.stringify(basis)}, which is no message the person wrote: ` +
          "a drafted policy rests only on the person's own words (D-0067 rule 6.2)"
        );
      }
    }
  }
  return null;
}

/** Append one row; the caller holds the write lock and has asked {@link standingPolicyRefusal}. */
export function insertStandingPolicy(
  connection: StoreConnection,
  draft: StandingPolicyDraft,
): void {
  connection
    .prepare(
      "INSERT INTO standing_policy (policy_id, body, author_kind, author_id, bases, " +
        "supersedes_policy_id, created_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      draft.policyId,
      draft.body,
      draft.authorKind,
      draft.authorId,
      JSON.stringify(draft.bases),
      draft.supersedesPolicyId,
      draft.createdAtMs,
    );
}

/** {@link AdvisoryRecord.recordStandingPolicy}: the refusal and the write under one lock. */
export function recordStandingPolicy(
  connection: StoreConnection,
  draft: StandingPolicyDraft,
): RecordOutcome {
  try {
    return immediateTransaction<RecordOutcome>(connection, () => {
      const refusal = standingPolicyRefusal(connection, draft);
      if (refusal !== null) {
        return { kind: "refused", reason: refusal };
      }
      insertStandingPolicy(connection, draft);
      return { kind: "recorded" };
    });
  } catch (error) {
    return { kind: "defect", reason: describe(error) };
  }
}

/**
 * Every policy in force, oldest first (D-0067 rule 6.3): the rows no successor
 * names, less the empty successors that retired what they named.
 */
export function inForcePolicies(connection: StoreConnection): readonly StoredStandingPolicy[] {
  return (
    connection
      .prepare(
        "SELECT * FROM standing_policy p WHERE body <> '' AND NOT EXISTS (SELECT 1 FROM " +
          "standing_policy s WHERE s.supersedes_policy_id = p.policy_id) ORDER BY created_at_ms, rowid",
      )
      .all() as SqlRow[]
  ).map((row) => {
    let bases: unknown;
    try {
      bases = JSON.parse(String(row["bases"]));
    } catch {
      bases = [];
    }
    return {
      policyId: String(row["policy_id"]),
      body: String(row["body"]),
      authorKind: row["author_kind"] === "drafter" ? "drafter" : "operator",
      authorId: String(row["author_id"]),
      bases: Array.isArray(bases) ? (bases as JsonRecord[]) : [],
      supersedesPolicyId:
        row["supersedes_policy_id"] === null ? null : String(row["supersedes_policy_id"]),
      createdAtMs: Number(row["created_at_ms"]),
    };
  });
}
