/**
 * A widening that waits for another line's files (D-0073 rule 4.1, D-0201):
 * kept as a `held_widening` row by the press or the gate, and written as a
 * successor claim by the order tick once no other open line holds its paths
 * (`paths_free`, rule 3.5). Inside an approved scope the gate's rows are
 * recorded against that approval (rule 4.4, **Scope binding**).
 *
 * Every function here runs inside the caller's `BEGIN IMMEDIATE`.
 */

import {
  basisForms,
  CHANGED,
  claimBases,
  claimHead,
  insertClaim,
  LANE_LEDGER_AUTHOR,
  lineageLaps,
  lineRecord,
  openLines,
} from "./claims.js";
import { claimCovers, lineShape, sharedPaths } from "./lanes.js";
import { canonicalJson } from "./plan.js";
import type { JsonValue, LaneHolder, WRITABLE_SCOPE_ACT_KINDS } from "./records.js";
import type { SqlRow, StoreConnection } from "./rows.js";
import {
  admittedUnder,
  SELECT_SCOPE,
  scopeDecisionWhere,
  supersededByApproved,
  toScope,
} from "./scope.js";

/** One widening still waiting, oldest first ({@link heldWidenings}). */
export interface HeldWidening {
  readonly wideningId: string;
  readonly lineageId: string;
  /** The paths it waits to add. */
  readonly paths: readonly string[];
  readonly authorKind: "operator" | "drafter";
  readonly authorId: string;
  /** The approval a gate's wait is recorded against, or null for a person's press. */
  readonly scopeDecisionId: string | null;
  readonly heldAtMs: number;
}

/** What one attempt at a wait came to ({@link applyHeldWidening}). */
export type HeldWideningOutcome =
  | { readonly kind: "applied"; readonly lineageId: string; readonly added: readonly string[] }
  /** Another open line still holds some of its paths. */
  | { readonly kind: "waits"; readonly holders: readonly LaneHolder[] }
  /** The wait is over with nothing written, for `reason`. */
  | { readonly kind: "ended"; readonly reason: string };

/** What the gate wrote for a drafted claim under its approval ({@link widenAtGate}). */
export type GateWidening =
  | {
      readonly kind: "widened";
      readonly lineageId: string;
      readonly scopeDecisionId: string;
      readonly added: readonly string[];
      readonly waiting: readonly string[];
    }
  /** Outside every scope nothing is decided (rule 4.4). */
  | { readonly kind: "unscoped" }
  | { readonly kind: "retired"; readonly reason: string }
  | { readonly kind: "unchanged" };

/** The act kind a claim row written under an approval is recorded as (D-0201 rule 5). */
const CLAIM_MOVE: (typeof WRITABLE_SCOPE_ACT_KINDS)[number] = "claim_move";

/**
 * Keep `paths` waiting for line `lineageId`. A wait asking the same paths, by
 * the same author under the same approval, is not kept twice.
 */
export function holdWidening(
  connection: StoreConnection,
  hold: Omit<HeldWidening, "wideningId" | "heldAtMs">,
  nowMs: number,
): void {
  const paths = canonicalJson([...new Set(hold.paths)].sort());
  const same = connection
    .prepare(
      "SELECT 1 FROM held_widening WHERE lineage_id = ? AND paths = ? AND author_id = ? AND " +
        "scope_decision_id IS ? AND settled_at_ms IS NULL",
    )
    .get(hold.lineageId, paths, hold.authorId, hold.scopeDecisionId);
  if (same !== undefined) {
    return;
  }
  const count = Number(
    (
      connection
        .prepare("SELECT COUNT(*) AS n FROM held_widening WHERE lineage_id = ?")
        .get(hold.lineageId) as SqlRow
    )["n"],
  );
  connection
    .prepare(
      "INSERT INTO held_widening (widening_id, lineage_id, paths, author_kind, author_id, " +
        "scope_decision_id, held_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      `${hold.lineageId}:held:${String(count + 1)}`,
      hold.lineageId,
      paths,
      hold.authorKind,
      hold.authorId,
      hold.scopeDecisionId,
      nowMs,
    );
}

/** The widenings still waiting, oldest first. */
export function heldWidenings(connection: StoreConnection): readonly HeldWidening[] {
  return (
    connection
      .prepare(
        "SELECT widening_id, lineage_id, paths, author_kind, author_id, scope_decision_id, " +
          "held_at_ms FROM held_widening WHERE settled_at_ms IS NULL ORDER BY held_at_ms, widening_id",
      )
      .all() as SqlRow[]
  ).map((row) =>
    Object.freeze({
      wideningId: String(row["widening_id"]),
      lineageId: String(row["lineage_id"]),
      paths: JSON.parse(String(row["paths"])) as string[],
      authorKind: row["author_kind"] === "operator" ? "operator" : "drafter",
      authorId: String(row["author_id"]),
      scopeDecisionId:
        typeof row["scope_decision_id"] === "string" ? row["scope_decision_id"] : null,
      heldAtMs: Number(row["held_at_ms"]),
    }),
  );
}

/**
 * Attempt one wait (D-0201 rule 3): end it where its approval is no longer in
 * force, its line takes no more paths or holds none, or its paths are already
 * covered; keep it while another open line holds any of them; otherwise write
 * them as one successor row by whoever asked, and settle it `applied`.
 */
export function applyHeldWidening(
  connection: StoreConnection,
  wideningId: string,
  nowMs: number,
): HeldWideningOutcome {
  const wait = heldWidenings(connection).find((one) => one.wideningId === wideningId);
  const settle = (outcome: string): void => {
    connection
      .prepare(
        "UPDATE held_widening SET settled_at_ms = ?, outcome = ? " +
          "WHERE widening_id = ? AND settled_at_ms IS NULL",
      )
      .run(nowMs, outcome, wideningId);
  };
  const ended = (reason: string): HeldWideningOutcome => {
    settle(reason);
    return { kind: "ended", reason };
  };
  if (wait === undefined) {
    return { kind: "ended", reason: "the wait is over already" };
  }
  if (wait.scopeDecisionId !== null) {
    const retired = scopeRetired(connection, wait.scopeDecisionId, nowMs);
    if (retired !== null) {
      return ended(retired);
    }
  }
  const head = claimHead(connection, wait.lineageId);
  if (head === null || head.paths.length === 0) {
    return ended("the line holds no files now: it was released, or its pull request opened");
  }
  const laps = lineageLaps(connection, wait.lineageId);
  if (laps === null || !lineShape(laps).inFlight) {
    return ended("every lap of the line has ended, so it takes no more files");
  }
  const record = lineRecord(connection, wait.lineageId);
  const asked = wait.paths.filter((path) => path !== record && !claimCovers(head.paths, path));
  if (asked.length === 0) {
    settle("applied");
    return { kind: "applied", lineageId: wait.lineageId, added: [] };
  }
  const holders = holdersOf(connection, head.repository, wait.lineageId, asked, record);
  if (holders.length > 0) {
    return { kind: "waits", holders };
  }
  writeWidening(
    connection,
    {
      lineageId: wait.lineageId,
      head,
      added: asked,
      authorKind: wait.authorKind,
      authorId: wait.authorId,
      scopeDecisionId: wait.scopeDecisionId,
      basis: { form: "held_widening", wideningId },
    },
    nowMs,
  );
  settle("applied");
  return { kind: "applied", lineageId: wait.lineageId, added: asked };
}

/**
 * **The gate widens a drafted claim under its approval** (D-0073 rules 4.4
 * and 5, D-0201 rule 4): of `paths`, the changed paths outside the claim of
 * `iterationId`'s line, those no other open line holds are added now and the
 * rest wait, each recorded against the approval that admitted the lap. A lap
 * admitted outside every scope, or under an approval no longer in force,
 * writes nothing. A line that declared nothing is `claimChanged`'s.
 */
export function widenAtGate(
  connection: StoreConnection,
  iterationId: string,
  paths: readonly string[],
  nowMs: number,
): GateWidening {
  const laps = lineageLaps(connection, iterationId);
  const root = laps?.[0];
  const head = root === undefined ? null : claimHead(connection, root.id);
  if (laps === null || root === undefined || head === null || head.paths.length === 0) {
    return { kind: "unchanged" };
  }
  const forms = basisForms(claimBases(connection, head.claimId));
  if (forms.includes("unclaimed") || forms.includes("changed") || !lineShape(laps).inFlight) {
    return { kind: "unchanged" };
  }
  const scopeDecisionId = admittedUnder(connection, iterationId);
  if (scopeDecisionId === null) {
    return { kind: "unscoped" };
  }
  const retired = scopeRetired(connection, scopeDecisionId, nowMs);
  if (retired !== null) {
    return { kind: "retired", reason: retired };
  }
  const record = lineRecord(connection, root.id);
  const outside = [...new Set(paths)].filter(
    (path) => path !== record && !claimCovers(head.paths, path),
  );
  const held = new Set(
    holdersOf(connection, head.repository, root.id, outside, record).flatMap(
      (holder) => holder.sharedPaths,
    ),
  );
  const added = outside.filter((path) => !held.has(path)).sort();
  const waiting = [...held].sort();
  if (added.length === 0 && waiting.length === 0) {
    return { kind: "unchanged" };
  }
  if (added.length > 0) {
    writeWidening(
      connection,
      {
        lineageId: root.id,
        head,
        added,
        authorKind: "drafter",
        authorId: LANE_LEDGER_AUTHOR,
        scopeDecisionId,
        basis: { form: "iteration", iterationId },
      },
      nowMs,
    );
  }
  if (waiting.length > 0) {
    holdWidening(
      connection,
      {
        lineageId: root.id,
        paths: waiting,
        authorKind: "drafter",
        authorId: LANE_LEDGER_AUTHOR,
        scopeDecisionId,
      },
      nowMs,
    );
  }
  return { kind: "widened", lineageId: root.id, scopeDecisionId, added, waiting };
}

/** The other open lines of `repository` holding any of `paths`, the record left out. */
export function holdersOf(
  connection: StoreConnection,
  repository: string,
  lineageId: string,
  paths: readonly string[],
  record: string | null,
): readonly LaneHolder[] {
  return openLines(connection, repository, lineageId).flatMap((line) => {
    const shared = sharedPaths(paths, line.paths, record);
    return shared.length === 0 ? [] : [{ lineageId: line.lineageId, sharedPaths: shared }];
  });
}

/** One successor row adding `added`, and its `claim_move` under an approval where there is one. */
function writeWidening(
  connection: StoreConnection,
  write: {
    readonly lineageId: string;
    readonly head: NonNullable<ReturnType<typeof claimHead>>;
    readonly added: readonly string[];
    readonly authorKind: "operator" | "drafter";
    readonly authorId: string;
    readonly scopeDecisionId: string | null;
    readonly basis: JsonValue;
  },
  nowMs: number,
): void {
  const { head, scopeDecisionId } = write;
  // A line whose gates claim what it changed (D-0160) keeps that basis.
  const forms = basisForms(claimBases(connection, head.claimId));
  const claimId = insertClaim(
    connection,
    {
      lineageId: write.lineageId,
      repository: head.repository,
      paths: [...new Set([...head.paths, ...write.added])].sort(),
      supersedesClaimId: head.claimId,
      authorKind: write.authorKind,
      authorId: write.authorId,
      bases: [
        write.basis,
        { form: "widened" },
        ...(scopeDecisionId === null ? [] : [{ form: "scope_decision", scopeDecisionId }]),
        ...(forms.includes("changed") ? [CHANGED] : []),
      ],
      why: head.why,
    },
    nowMs,
  );
  if (scopeDecisionId !== null) {
    connection
      .prepare(
        "INSERT INTO scope_consumption (scope_decision_id, act_kind, subject_id, proposal_id, " +
          "consumed_at_ms) VALUES (?, ?, ?, NULL, ?)",
      )
      .run(scopeDecisionId, CLAIM_MOVE, claimId, nowMs);
  }
}

/**
 * Why approval `scopeDecisionId` no longer authorises a new act, or null while
 * it is in force (D-0066 rules 1.4 and 2.1): approved, its scope readable, no
 * approved successor, and not expired.
 */
export function scopeRetired(
  connection: StoreConnection,
  scopeDecisionId: string,
  nowMs: number,
): string | null {
  const decision = scopeDecisionWhere(connection, "scope_decision_id", scopeDecisionId);
  if (decision.kind !== "read" || decision.decision.outcome !== "approved") {
    return `the approval '${scopeDecisionId}' is not an approved scope decision in this store`;
  }
  const { scopeId } = decision.decision;
  const row = connection.prepare(`${SELECT_SCOPE} WHERE scope_id = ?`).get(scopeId) as
    | SqlRow
    | undefined;
  if (row === undefined) {
    return `the approval '${scopeDecisionId}' names no scope in this store`;
  }
  if (supersededByApproved(connection, scopeId)) {
    return `the approval '${scopeDecisionId}' has an approved successor`;
  }
  try {
    if (nowMs >= toScope(row).payload.budgets.expires_at_ms) {
      return `the approval '${scopeDecisionId}' has expired`;
    }
  } catch {
    return `the scope of approval '${scopeDecisionId}' cannot be read`;
  }
  return null;
}
