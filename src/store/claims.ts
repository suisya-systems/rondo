/**
 * The lane ledger in SQL: claim rows, number reservations, and the admission
 * and release of a line's files. `src/store/lanes.ts` holds the pure rules these
 * read and write by.
 *
 * Split out of `src/store/sqlite.ts` (D-0171), which still owns the driver.
 */

import type { LedgerLine, ReserveInput } from "./contract.js";
import {
  type LaneLap,
  lineShape,
  mayBeOpen,
  normalizeClaim,
  repositoryKey,
  sharedPaths,
  WHOLE_REPOSITORY,
} from "./lanes.js";
import { canonicalJson } from "./plan.js";
import type { JsonRecord, JsonValue, LaneHolder } from "./records.js";
import {
  LINEAGE_BOUND,
  lineageOf,
  requireText,
  type SqlRow,
  type StoreConnection,
  StoreDefect,
} from "./rows.js";

/**
 * The author id on a claim row rondo writes by rule rather than by drafting:
 * D-0160's line that claims nothing and the paths its gate claims, rule 2.6's
 * re-request and rule 4.3's release
 * when a line ends or lands (D-0073). `drafter` is its kind, as it is for
 * the deterministic reading drafter: a mechanical voice, not a person's.
 */
export const LANE_LEDGER_AUTHOR = "rondo/lane-ledger/1";

/** One `lane_claim` row, decoded. */
interface ClaimRow {
  readonly claimId: string;
  readonly lineageId: string;
  readonly repository: string;
  readonly paths: readonly string[];
  readonly supersedesClaimId: string | null;
  readonly why: string | null;
}

/** A claim row to write. */
interface ClaimWrite {
  readonly lineageId: string;
  readonly repository: string;
  readonly paths: readonly string[];
  readonly supersedesClaimId: string | null;
  readonly authorKind: "operator" | "drafter";
  readonly authorId: string;
  readonly bases: readonly JsonValue[];
  /** Why the paths are as wide as they are (rondo#509); absent says nothing. */
  readonly why?: string | null;
}

const CLAIM_COLUMNS = "claim_id, lineage_id, repository, paths, supersedes_claim_id, why";

function toClaimRow(row: SqlRow): ClaimRow {
  const paths: unknown = JSON.parse(requireText(row, "paths", "lane_claim"));
  if (!Array.isArray(paths) || !paths.every((path) => typeof path === "string")) {
    throw new StoreDefect("a lane_claim row's paths are not a JSON array of strings");
  }
  const supersedes = row["supersedes_claim_id"];
  return {
    claimId: requireText(row, "claim_id", "lane_claim"),
    lineageId: requireText(row, "lineage_id", "lane_claim"),
    repository: requireText(row, "repository", "lane_claim"),
    paths,
    supersedesClaimId: supersedes === null ? null : String(supersedes),
    why: row["why"] === null ? null : String(row["why"]),
  };
}

/**
 * A lineage's in-force claim: the row no successor names (D-0073 rule 2.1),
 * or null when the lineage has never held one. Two such rows is a store the
 * schema's two unique constraints should have made impossible, and it is
 * reported as a defect rather than chosen between.
 */
export function claimHead(connection: StoreConnection, lineageId: string): ClaimRow | null {
  const rows = connection
    .prepare(
      `SELECT ${CLAIM_COLUMNS} FROM lane_claim c WHERE c.lineage_id = ? AND NOT EXISTS ` +
        "(SELECT 1 FROM lane_claim s WHERE s.supersedes_claim_id = c.claim_id)",
    )
    .all(lineageId) as SqlRow[];
  if (rows.length > 1) {
    throw new StoreDefect(`lineage '${lineageId}' has ${String(rows.length)} in-force claims`);
  }
  const [row] = rows;
  return row === undefined ? null : toClaimRow(row);
}

/**
 * Whether a release row's bases say it was written when the line's pull
 * request opened (D-0114): a `published` basis and no `landing` one. Such a
 * line holds no paths and is still owed its landing.
 */
export function isPublishRelease(bases: unknown): boolean {
  const forms = basisForms(bases);
  return forms.includes("published") && !forms.includes("landing");
}

/** Each basis's `form`, in order. */
export function basisForms(bases: unknown): readonly unknown[] {
  return Array.isArray(bases)
    ? bases.map((basis: unknown) =>
        typeof basis === "object" && basis !== null
          ? (basis as Record<string, unknown>)["form"]
          : undefined,
      )
    : [];
}

/**
 * Whether an empty claim row is a line that declared nothing, not a release
 * (rondo#554, D-0160): it holds no paths yet and is still open.
 */
export function isUnclaimed(bases: unknown): boolean {
  return basisForms(bases).includes("unclaimed");
}

/** One claim row's bases, parsed. */
export function claimBases(connection: StoreConnection, claimId: string): unknown {
  const row = connection.prepare("SELECT bases FROM lane_claim WHERE claim_id = ?").get(claimId) as
    | SqlRow
    | undefined;
  return row === undefined ? [] : JSON.parse(String(row["bases"]));
}

/** Write one claim row, its id the lineage's next ordinal. Inside the caller's transaction. */
export function insertClaim(connection: StoreConnection, write: ClaimWrite, nowMs: number): void {
  const count = Number(
    (
      connection
        .prepare("SELECT COUNT(*) AS n FROM lane_claim WHERE lineage_id = ?")
        .get(write.lineageId) as SqlRow
    )["n"],
  );
  connection
    .prepare(
      "INSERT INTO lane_claim (claim_id, lineage_id, repository, paths, supersedes_claim_id, " +
        "author_kind, author_id, bases, created_at_ms, why) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      `${write.lineageId}:${String(count + 1)}`,
      write.lineageId,
      write.repository,
      canonicalJson([...write.paths]),
      write.supersedesClaimId,
      write.authorKind,
      write.authorId,
      canonicalJson([...write.bases]),
      nowMs,
      write.why ?? null,
    );
}

/** A lineage tree's laps, root first, or null when the walk passes its bound. */
export function lineageLaps(connection: StoreConnection, anyId: string): readonly LaneLap[] | null {
  const ids = lineageOf(connection, anyId);
  if (ids === null) {
    return null;
  }
  const read = connection.prepare(
    "SELECT id, status, supersedes_iteration_id FROM iteration WHERE id = ?",
  );
  return ids.flatMap((id) => {
    const row = read.get(id) as SqlRow | undefined;
    return row === undefined ? [] : [toLaneLap(row)];
  });
}

function toLaneLap(row: SqlRow): LaneLap {
  const supersedes = row["supersedes_iteration_id"];
  return {
    id: String(row["id"]),
    status: String(row["status"]),
    supersedesIterationId: supersedes === null ? null : String(supersedes),
  };
}

/** The repository a stored plan names, as the ledger compares it ({@link repositoryKey}). */
function planRepository(plan: JsonRecord): string | null {
  return repositoryKey(plan["repository"]);
}

/** The decision record a stored plan names (D-0098 rule 3.1), or null. */
function planRecord(plan: JsonRecord): string | null {
  const record = plan["decision_record"];
  return typeof record === "string" ? record : null;
}

/** The decision record the root lap of `lineageId` names, or null. */
export function lineRecord(connection: StoreConnection, lineageId: string): string | null {
  const row = connection
    .prepare(
      "SELECT json_extract(plan, '$.decision_record') AS r FROM iteration " +
        "WHERE id = ? AND json_valid(plan)",
    )
    .get(lineageId) as SqlRow | undefined;
  return typeof row?.["r"] === "string" ? row["r"] : null;
}

/**
 * The number half of an admission, decided under `reserve()`'s write lock
 * (D-0098 rule 3.3): nothing to reserve, the rows to write beside the
 * iteration row, `numbersMoved` when another admission took a number since
 * the caller read, or a defect in the caller. **The store checks above what
 * it can read**, every number ever reserved in the record; the default
 * branch's floor is the caller's git read, already named in the prompt.
 */
type NumberAdmission =
  | { readonly kind: "none" }
  | {
      readonly kind: "write";
      readonly repository: string;
      readonly record: string;
      readonly lineageId: string;
      readonly numbers: readonly number[];
    }
  | { readonly kind: "numbersMoved"; readonly highest: number }
  | { readonly kind: "defect"; readonly reason: string };

export function numberAdmission(connection: StoreConnection, input: ReserveInput): NumberAdmission {
  if (input.numbers === null) {
    return { kind: "none" };
  }
  const repository = planRepository(input.plan);
  const record = planRecord(input.plan);
  const numbers = input.numbers;
  const first = numbers[0];
  if (repository === null || record === null) {
    return {
      kind: "defect",
      reason: `iteration '${input.id}' was handed numbers, and its plan names no decision record`,
    };
  }
  if (
    first === undefined ||
    !numbers.every((number, i) => Number.isSafeInteger(number) && number === first + i) ||
    first < 1
  ) {
    return {
      kind: "defect",
      reason: `iteration '${input.id}' was handed numbers that are not consecutive whole numbers`,
    };
  }
  const lineageId =
    input.supersedesIterationId === null
      ? input.id
      : lineageOf(connection, input.supersedesIterationId)?.[0];
  if (lineageId === undefined) {
    return { kind: "defect", reason: `the lineage of '${input.id}' is unreadable` };
  }
  const highest = highestNumber(connection, repository, record);
  return first <= highest
    ? { kind: "numbersMoved", highest }
    : { kind: "write", repository, record, lineageId, numbers };
}

/** The highest number ever reserved in `record` of `repository`, released ones included, or 0. */
export function highestNumber(
  connection: StoreConnection,
  repository: string,
  record: string,
): number {
  const row = connection
    .prepare("SELECT MAX(number) AS n FROM number_reservation WHERE repository = ? AND record = ?")
    .get(repository, record) as SqlRow;
  return row["n"] === null ? 0 : Number(row["n"]);
}

/** Write a line's reservations. Inside the caller's transaction. */
export function insertReservations(
  connection: StoreConnection,
  write: Extract<NumberAdmission, { kind: "write" }>,
  iterationId: string,
  nowMs: number,
): void {
  const insert = connection.prepare(
    "INSERT INTO number_reservation (reservation_id, repository, record, number, lineage_id, " +
      "releases_reservation_id, bases, created_at_ms) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)",
  );
  for (const number of write.numbers) {
    insert.run(
      `${write.lineageId}:n${String(number)}`,
      write.repository,
      write.record,
      number,
      write.lineageId,
      canonicalJson([{ form: "iteration", iterationId }]),
      nowMs,
    );
  }
}

/**
 * Release every reservation of `lineageId` no row releases yet (D-0098 rule
 * 3.4): a successor row each, repeating the triple. Inside the transaction
 * that releases the line's claim, or ends it.
 */
export function releaseReservations(
  connection: StoreConnection,
  lineageId: string,
  bases: readonly JsonValue[],
  nowMs: number,
): void {
  const open = connection
    .prepare(
      "SELECT reservation_id, repository, record, number FROM number_reservation r " +
        "WHERE r.lineage_id = ? AND r.releases_reservation_id IS NULL AND NOT EXISTS " +
        "(SELECT 1 FROM number_reservation s WHERE s.releases_reservation_id = r.reservation_id)",
    )
    .all(lineageId) as SqlRow[];
  const insert = connection.prepare(
    "INSERT INTO number_reservation (reservation_id, repository, record, number, lineage_id, " +
      "releases_reservation_id, bases, created_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const row of open) {
    const id = String(row["reservation_id"]);
    insert.run(
      `${id}:released`,
      row["repository"] as string,
      row["record"] as string,
      Number(row["number"]),
      lineageId,
      id,
      canonicalJson([...bases]),
      nowMs,
    );
  }
}

/**
 * Every open line of `repository` but `exceptLineage`, with the paths it holds
 * (D-0073 rules 3.1 and 3.3). Read inside the caller's transaction.
 *
 * **A line with a claim holds its head's paths**, and a head that still holds
 * paths is counted whatever its laps say: every way a line stops being open
 * writes a release (rule 4.3), so a head holding paths is an open line or a
 * missed release, and the second fails closed.
 *
 * **A line admitted before the ledger holds `/` while a lap of it has not
 * ended** (the migration D-0073 left to the building change, answered at
 * rondo#250's gate: rule 2.5's whole repository, for a line in flight or at its
 * gate only). It has no claim row at all. A pre-ledger line whose laps have all
 * ended is not open to the ledger, closed tips included: a squash merge hides
 * whether its work landed, rule 6 cannot read it over the lines that changed
 * the same files since, and holding it would refuse every admission of a
 * repository with history. What that gives up: a pre-ledger line closed and not
 * yet merged can have its paths taken, and the collision is met at merge.
 */
export function openLines(
  connection: StoreConnection,
  repository: string,
  exceptLineage: string,
): readonly { readonly lineageId: string; readonly paths: readonly string[] }[] {
  const lines: { lineageId: string; paths: readonly string[] }[] = [];
  const heads = connection
    .prepare(
      `SELECT ${CLAIM_COLUMNS} FROM lane_claim c WHERE c.repository = ? AND NOT EXISTS ` +
        "(SELECT 1 FROM lane_claim s WHERE s.supersedes_claim_id = c.claim_id)",
    )
    .all(repository) as SqlRow[];
  for (const head of heads.map(toClaimRow)) {
    if (head.lineageId !== exceptLineage && head.paths.length > 0) {
      lines.push({ lineageId: head.lineageId, paths: head.paths });
    }
  }
  for (const [root, tree] of unclaimedTrees(connection, repository)) {
    if (root !== exceptLineage && lineShape(tree.laps).inFlight) {
      lines.push({ lineageId: root, paths: [WHOLE_REPOSITORY] });
    }
  }
  return lines;
}

/**
 * The lineage trees that have never held a claim row, by root: the lines
 * admitted before the ledger, of `repository` or of every repository when it
 * is null. What {@link openLines} counts as holding `/` while in flight.
 */
function unclaimedTrees(
  connection: StoreConnection,
  repository: string | null,
): ReadonlyMap<string, { readonly repository: string; readonly laps: readonly LaneLap[] }> {
  const claimed = new Set(
    connection
      .prepare("SELECT DISTINCT lineage_id FROM lane_claim")
      .all()
      .map((row) => String((row as SqlRow)["lineage_id"])),
  );
  // ponytail: every lap in the store is read to find the pre-ledger lines of
  // this repository; a column on the iteration row when a store holds enough
  // laps to feel it.
  const laps = (
    connection
      .prepare(
        "SELECT id, status, supersedes_iteration_id, json_extract(plan, '$.repository') AS r " +
          "FROM iteration WHERE json_valid(plan)",
      )
      .all() as SqlRow[]
  ).flatMap((row) => {
    const key = repositoryKey(row["r"]);
    return key === null || (repository !== null && key !== repository)
      ? []
      : [{ lap: toLaneLap(row), repository: key }];
  });
  const byId = new Map(laps.map((one) => [one.lap.id, one.lap]));
  const rootOf = (lap: LaneLap): string => {
    let current = lap;
    for (let depth = 0; depth < LINEAGE_BOUND; depth += 1) {
      const parent =
        current.supersedesIterationId === null
          ? undefined
          : byId.get(current.supersedesIterationId);
      if (parent === undefined) {
        return current.id;
      }
      current = parent;
    }
    return current.id;
  };
  const trees = new Map<string, { repository: string; laps: LaneLap[] }>();
  for (const one of laps) {
    const root = rootOf(one.lap);
    if (claimed.has(root)) {
      continue;
    }
    const tree = trees.get(root) ?? { repository: one.repository, laps: [] };
    tree.laps.push(one.lap);
    trees.set(root, tree);
  }
  return trees;
}

/**
 * Every line the ledger has an answer about (D-0073 rule 12): each lineage with
 * a claim row, holding its head's paths or released, and each pre-ledger line
 * in flight, holding `/` as {@link openLines} counts it. Read only; what the
 * page draws ownership, waiting and landing from.
 */
export function ledgerLines(connection: StoreConnection): readonly LedgerLine[] {
  const lines: LedgerLine[] = [];
  const heads = connection
    .prepare(
      `SELECT ${CLAIM_COLUMNS}, author_kind, bases FROM lane_claim c WHERE NOT EXISTS ` +
        "(SELECT 1 FROM lane_claim s WHERE s.supersedes_claim_id = c.claim_id) " +
        "ORDER BY created_at_ms, claim_id",
    )
    .all() as SqlRow[];
  for (const row of heads) {
    const head = toClaimRow(row);
    const laps = lineageLaps(connection, head.lineageId) ?? [];
    const shape = lineShape(laps);
    lines.push({
      lineageId: head.lineageId,
      repository: head.repository,
      claimId: head.claimId,
      paths: head.paths,
      why: head.why,
      lapIds: laps.map((lap) => lap.id),
      inFlight: shape.inFlight,
      closedTips: shape.closedTips,
      // A line released when its pull request opened holds no paths and is
      // still owed its landing (D-0114), so it is not said to be released.
      // Nor is a line that declared nothing and has not changed anything yet
      // (D-0160).
      releasedBy:
        head.paths.length > 0 ||
        isPublishRelease(JSON.parse(String(row["bases"]))) ||
        isUnclaimed(JSON.parse(String(row["bases"])))
          ? null
          : row["author_kind"] === "operator"
            ? "person"
            : "rondo",
    });
  }
  for (const [root, tree] of unclaimedTrees(connection, null)) {
    const shape = lineShape(tree.laps);
    if (shape.inFlight) {
      lines.push({
        lineageId: root,
        repository: tree.repository,
        claimId: null,
        paths: [WHOLE_REPOSITORY],
        why: null,
        lapIds: tree.laps.map((lap) => lap.id),
        inFlight: true,
        closedTips: shape.closedTips,
        releasedBy: null,
      });
    }
  }
  return lines;
}

/**
 * The lane half of an admission, decided under `reserve()`'s write lock
 * (D-0073 rules 2.4-2.6 and 3.1): nothing to write, a claim row to write beside
 * the iteration row, a refusal naming the lines it would share a path with, or
 * a defect in the caller.
 */
type LaneAdmission =
  | { readonly kind: "continue" }
  | { readonly kind: "write"; readonly write: ClaimWrite }
  | {
      readonly kind: "refused";
      readonly paths: readonly string[];
      readonly holders: readonly LaneHolder[];
    }
  | { readonly kind: "defect"; readonly reason: string };

export function laneAdmission(connection: StoreConnection, input: ReserveInput): LaneAdmission {
  const repository = planRepository(input.plan);
  if (repository === null) {
    return {
      kind: "defect",
      reason: `iteration '${input.id}' was reserved with a plan that names no repository to claim in`,
    };
  }
  const byRule = { authorKind: "drafter", authorId: LANE_LEDGER_AUTHOR } as const;
  const bases = [{ form: "iteration", iterationId: input.id }];
  let write: ClaimWrite;
  if (input.supersedesIterationId === null) {
    // **A plan admitted with no drafted claim claims nothing yet** (rondo#554,
    // D-0160, replacing rule 2.5's `/`): it runs beside every line, and its
    // gate claims what it changed (`claimChanged`). An ask with no paths is
    // the same, carrying the bases it was asked on.
    let paths: readonly string[] = [];
    if (input.claim !== null && input.claim.paths.length > 0) {
      const asked = normalizeClaim(input.claim.paths);
      if (asked.kind === "refused") {
        return { kind: "defect", reason: `the claim drafted for '${input.id}': ${asked.reason}` };
      }
      paths = asked.paths;
    }
    write =
      input.claim === null || paths.length === 0
        ? {
            lineageId: input.id,
            repository,
            paths,
            supersedesClaimId: null,
            ...byRule,
            bases: [...(input.claim?.bases ?? bases), UNCLAIMED],
          }
        : {
            lineageId: input.id,
            repository,
            paths,
            supersedesClaimId: null,
            authorKind: input.claim.authorKind,
            authorId: input.claim.authorId,
            bases: input.claim.bases,
            why: input.claim.why ?? null,
          };
  } else {
    if (input.claim !== null) {
      return {
        kind: "defect",
        reason:
          `the redo '${input.id}' was handed a claim, and a redo continues its lineage's claim ` +
          "(D-0073 rule 2.6): a claim that changes is a successor row, not an admission's",
      };
    }
    const lineageId = lineageOf(connection, input.supersedesIterationId)?.[0];
    if (lineageId === undefined) {
      return {
        kind: "defect",
        reason: `the lineage of '${input.supersedesIterationId}' is unreadable`,
      };
    }
    const head = claimHead(connection, lineageId);
    if (
      head !== null &&
      (head.paths.length > 0 || isUnclaimed(claimBases(connection, head.claimId)))
    ) {
      return { kind: "continue" };
    }
    // A released line retried takes back what the release gave up (rule 2.6),
    // and a line from before the ledger, or released without ever holding a
    // claim, claims nothing yet, as a first admission with no drafted claim
    // does (D-0160). The paths given up are the last row that held any: a
    // published line's landing is a second empty row over its publish's
    // (D-0114).
    let given: ClaimRow | undefined;
    let from = head?.supersedesClaimId ?? null;
    while (from !== null) {
      const row = connection
        .prepare(`SELECT ${CLAIM_COLUMNS} FROM lane_claim WHERE claim_id = ?`)
        .get(from) as SqlRow | undefined;
      given = row === undefined ? undefined : toClaimRow(row);
      from = given === undefined || given.paths.length > 0 ? null : given.supersedesClaimId;
    }
    const taken = given === undefined || given.paths.length === 0 ? null : given;
    write = {
      lineageId,
      repository,
      paths: taken === null ? [] : taken.paths,
      supersedesClaimId: head === null ? null : head.claimId,
      ...byRule,
      // A claim a gate took from what the line changed stays one (D-0160), so
      // the redo's gate goes on claiming what it changes.
      bases:
        taken === null
          ? [...bases, UNCLAIMED]
          : basisForms(claimBases(connection, taken.claimId)).includes("changed")
            ? [...bases, CHANGED]
            : bases,
      // The paths taken back keep the words that said why they were asked.
      why: taken === null ? null : taken.why,
    };
  }
  const holders = openLines(connection, repository, write.lineageId).flatMap((line) => {
    const shared = sharedPaths(write.paths, line.paths, planRecord(input.plan));
    return shared.length === 0 ? [] : [{ lineageId: line.lineageId, sharedPaths: shared }];
  });
  return holders.length === 0
    ? { kind: "write", write }
    : { kind: "refused", paths: write.paths, holders };
}

/** The basis that marks a claim row as a line that declared nothing (D-0160). */
const UNCLAIMED = { form: "unclaimed" } as const;

/** The basis that marks a claim row a gate took from what its line changed (D-0160). */
export const CHANGED = { form: "changed" } as const;

/**
 * Release a line's claim when the status just written leaves nothing of it open
 * (D-0073 rule 4.3): no lap in flight and no closed tip, so nothing is owed to
 * the default branch. Inside the transaction that wrote the status, both or
 * neither. A line that holds nothing -- released already, or from before the
 * ledger -- writes nothing.
 */
export function releaseIfEnded(
  connection: StoreConnection,
  iterationId: string,
  nowMs: number,
): void {
  const laps = lineageLaps(connection, iterationId);
  const root = laps?.[0];
  if (laps === null || root === undefined || mayBeOpen(lineShape(laps))) {
    return;
  }
  // Before the claim and whatever the claim is: a line that holds no paths
  // may still hold numbers, and nothing of an ended line lands (D-0098 rule
  // 3.4).
  releaseReservations(connection, root.id, [{ form: "iteration", iterationId }], nowMs);
  const head = claimHead(connection, root.id);
  if (
    head === null ||
    (head.paths.length === 0 && !isUnclaimed(claimBases(connection, head.claimId)))
  ) {
    return;
  }
  insertClaim(
    connection,
    {
      lineageId: root.id,
      repository: head.repository,
      paths: [],
      supersedesClaimId: head.claimId,
      authorKind: "drafter",
      authorId: LANE_LEDGER_AUTHOR,
      bases: [{ form: "iteration", iterationId }],
    },
    nowMs,
  );
}
