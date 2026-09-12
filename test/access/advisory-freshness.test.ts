/**
 * `D-0038`'s planted cases: whether the premise under a proposal has moved,
 * decided per basis and at render time.
 *
 * Kept apart from `advisory.test.ts` because every test here composes a real
 * proposal and then changes the store **underneath it** before calling
 * `showProposal` again -- the one property none of that file's tests need,
 * and the one this entry exists to check.
 */
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import {
  elevateObservation,
  explainIteration,
  proposeRetry,
  showProposal,
} from "../../src/access/advisory.js";
import type { CatalogLayer } from "../../src/cadenza/facade.js";
import { allocate } from "../../src/refrain/allocator.js";
import { admittedPlan, planPayload, type RunPlan, runPlan } from "../../src/refrain/plan.js";
import { CONSERVATIVE_HOST_POLICY } from "../../src/refrain/policy.js";
import { canonicalJson, contentDigest, planDigest } from "../../src/store/plan.js";
import type { JsonRecord, LapReadingDraft } from "../../src/store/records.js";
import { advisoryRecord, iterationStore } from "../../src/store/sqlite.js";

const fresh = () => {
  const connection = new DatabaseSync(":memory:");
  return {
    connection,
    store: iterationStore(connection, CONSERVATIVE_HOST_POLICY),
    record: advisoryRecord(connection),
  };
};

const screen = () => {
  const shown: string[] = [];
  return { shown, present: (lines: readonly string[]) => shown.push(...lines) };
};

const CATALOG_LAYER: CatalogLayer = {
  layer: "tracked",
  origin: "test fixture",
  baseDir: resolve("/srv/catalog"),
  data: {
    schema_version: 1,
    project: {
      rondo: {
        source: { kind: "git_url", url: "https://example.invalid/org/rondo.git" },
        base_branch: "main",
      },
    },
  },
};

const WORKSPACE_ROOT = "/srv/rondo/work";

const PLAN_INPUT: RunPlan = {
  db: "/srv/rondo/control.db",
  workspaceRoot: WORKSPACE_ROOT,
  baseBranch: "main",
  prompt: "teach rondo to count",
  allowedBash: ["npm run:*"],
  materialLanguage: null,
  repository: "/srv/rondo/repo",
  artifactRoot: "/srv/rondo/artifacts",
  stateRoot: "/srv/rondo/state",
  interlockRoot: "/srv/rondo/interlock",
  claudeOrgPath: "/srv/rondo/claude-org",
  endpointRecipient: "external-notify",
  endpointDestinationDir: "/srv/rondo/outbox",
  claudeCommand: ["/usr/bin/node", "/srv/rondo/claude.js"],
  endpointDb: null,
  endpointModule: null,
  node: null,
  hookScript: null,
  python: null,
  pollIntervalMs: null,
  turnTimeoutMs: 900_000,
  gitTimeoutMs: 60_000,
  identityReadbackTimeoutMs: 30_000,
  gateOptions: ["approve", "revise"],
  gateDeadlineAtMs: null,
  pullRequestBaseBranch: null,
  invocationCeilingMs: 1_800_000,
  catalogLayers: [CATALOG_LAYER],
  projectName: "rondo",
  agentTypeInput: {
    agentTypeId: "worker-basic",
    vocabularyVersion: 1,
    granted: ["command.run"],
    askable: ["branch.push"],
    loopPolicy: { maxReviewRounds: 2, noProgressWindow: 3, noProgressRepeat: 2 },
    executorPolicy: { roleName: "worker", modelTier: "standard", reportingDuties: [] },
  },
  parties: { issuer: "rondo-host", grantee: "unset" },
  intendedAction: { capabilities: ["command.run"] },
};

/** An under-specified plan `readPlan` will not decode: `somePlan`'s shape, over `iter-1`'s id. */
const UNDECODABLE_PLAN: JsonRecord = { run_id: "r-broken", workspace: "/srv/work/r-broken" };

const realPlan = (iterationId: string, plan: RunPlan = PLAN_INPUT): JsonRecord => {
  const validated = runPlan(plan);
  if (validated.kind !== "planned") {
    throw new Error(`the fixture plan is not a plan: ${validated.reason}`);
  }
  const allocation = allocate(iterationId, WORKSPACE_ROOT);
  if (allocation.kind !== "allocated") {
    throw new Error(`fixture id '${iterationId}' was refused: ${allocation.reason}`);
  }
  const admitted = admittedPlan(validated.plan, allocation.allocation);
  if (admitted.kind !== "planned") {
    throw new Error(`fixture admission failed: ${admitted.reason}`);
  }
  return planPayload(admitted.plan);
};

const reserveWithPlan = async (
  store: ReturnType<typeof fresh>["store"],
  id: string,
  supersedesIterationId: string | null,
  plan: RunPlan = PLAN_INPUT,
) =>
  store.reserve({
    id,
    request: "teach rondo to count",
    plan: realPlan(id, plan),
    spend: null,
    nowMs: 1_000,
    supersedesIterationId,
    runId: `rondo-${id}`,
    topicBranch: `rondo/${id}`,
    workspace: `/srv/work/${id}`,
  });

const PROPOSE_PORTS = { now: () => 7_000, cadenzaRevision: "5d5d9f4" };

/** The one row `proposal` holds, so a test can read and rewrite it. */
const onlyProposalRow = (connection: DatabaseSync): Record<string, unknown> => {
  const rows = connection.prepare("SELECT * FROM proposal").all() as Record<string, unknown>[];
  expect(rows.length).toBe(1);
  const row = rows[0];
  if (row === undefined) {
    throw new Error("no proposal row");
  }
  return row;
};

/** Rewrite a proposal's `snapshot` and/or `payload`, keeping the digests that describe them true. */
function rewriteProposal(
  connection: DatabaseSync,
  proposalId: string,
  fields: { readonly snapshot?: JsonRecord; readonly payload?: JsonRecord },
): void {
  const sets: string[] = [];
  const values: string[] = [];
  if (fields.snapshot !== undefined) {
    sets.push("snapshot = ?", "snapshot_digest = ?");
    values.push(canonicalJson(fields.snapshot), contentDigest(fields.snapshot));
  }
  if (fields.payload !== undefined) {
    sets.push("payload = ?", "proposal_digest = ?");
    values.push(canonicalJson(fields.payload), contentDigest(fields.payload));
  }
  values.push(proposalId);
  connection.prepare(`UPDATE proposal SET ${sets.join(", ")} WHERE proposal_id = ?`).run(...values);
}

test("a candidate finished and merged reads moved, with the digest unchanged (#39's case)", async () => {
  const { store, record } = fresh();
  await reserveWithPlan(store, "iter-0", null);
  await store.settle("iter-0", "the work was not taken", 2_000);
  await reserveWithPlan(store, "iter-1", "iter-0");

  const proposed = await proposeRetry(
    { ...PROPOSE_PORTS, store, record, present: screen().present },
    "run_plan",
    "iter-1",
    "iter-2",
  );
  expect(proposed.kind === "refused" ? proposed.reason : "proposed").toBe("proposed");
  if (proposed.kind !== "proposed") {
    return;
  }
  // **The premise moves after the proposal was shown.** `iter-1` -- the
  // subject, and the recommended candidate -- is settled as though the work it
  // named had been finished and merged underneath the retry rondo proposed.
  await store.settle("iter-1", "finished and merged upstream", 8_000);

  const shows = screen();
  await showProposal(
    {
      store,
      cadenzaRevision: PROPOSE_PORTS.cadenzaRevision,
      record,
      now: () => 9_000,
      present: shows.present,
    },
    proposed.proposalId,
  );
  const rendered = shows.shown.join("\n");

  // The subject's own verdict, on the header line, says the premise moved.
  expect(rendered).toContain(`subject '${"iter-1"}': moved`);
  expect(rendered).toContain("status:");
  // The recommended candidate is `iter-1` itself: its basis line is followed
  // by a freshness line reporting the same movement, over the same field.
  const lines = shows.shown;
  const basisIndex = lines.findIndex((line) => line.includes("[recommended]"));
  expect(basisIndex).toBeGreaterThanOrEqual(0);
  const block = lines.slice(basisIndex, basisIndex + 4).join("\n");
  expect(block).toContain("freshness: moved");
  expect(block).toContain("status: `");
  // **The digest is unchanged, and the line must not claim otherwise.** The
  // plan iter-1 ran under did not change, so the contract it composes is
  // byte-identical; only the sibling field the entry names is what moved.
  expect(block).not.toContain("contractDigest:");
});

test("a candidate no longer in the re-gathered set reads moved, and one re-ordered still reads unmoved", async () => {
  // **Identity, and never index.** The stored snapshot below carries the two
  // real candidates in reverse order, plus a third that no re-gather will ever
  // produce -- proving the reader matches candidates by `iterationId` rather
  // than by position.
  const { connection, store, record } = fresh();
  await reserveWithPlan(store, "iter-0", null);
  await store.settle("iter-0", "the work was not taken", 2_000);
  await reserveWithPlan(store, "iter-1", "iter-0");

  const proposed = await proposeRetry(
    { ...PROPOSE_PORTS, store, record, present: screen().present },
    "run_plan",
    "iter-1",
    "iter-2",
  );
  expect(proposed.kind === "refused" ? proposed.reason : "proposed").toBe("proposed");
  if (proposed.kind !== "proposed") {
    return;
  }

  const row = onlyProposalRow(connection);
  const snapshot = JSON.parse(String(row["snapshot"])) as {
    iteration: unknown;
    successor: unknown;
    candidates: Record<string, unknown>[];
  };
  expect(snapshot.candidates.length).toBe(2);
  const [real0, real1] = snapshot.candidates;
  if (real0 === undefined || real1 === undefined) {
    throw new Error("the fixture proposal did not compose two candidates");
  }
  const ghost = { ...real1, iterationId: "iter-9", contractDigest: `sha256:${"9".repeat(64)}` };
  // Reversed real order, plus the ghost that left the set (or was never in
  // it): candidate 0 is what composition recommended, now last.
  const reordered = { ...snapshot, candidates: [real1, ghost, real0] } as unknown as JsonRecord;
  const payload = {
    options: [
      {
        label: "alternative",
        value: real1["contractDigest"],
        basis: { form: "snapshot", pointer: "/candidates/0/contractDigest" },
      },
      {
        label: "ghost",
        value: ghost["contractDigest"],
        basis: { form: "snapshot", pointer: "/candidates/1/contractDigest" },
      },
      {
        label: "recommended",
        value: real0["contractDigest"],
        basis: { form: "snapshot", pointer: "/candidates/2/contractDigest" },
      },
    ],
    recommended: 2,
  } as unknown as JsonRecord;
  rewriteProposal(connection, proposed.proposalId, { snapshot: reordered, payload });

  const shows = screen();
  await showProposal(
    {
      store,
      cadenzaRevision: PROPOSE_PORTS.cadenzaRevision,
      record,
      now: () => 9_000,
      present: shows.present,
    },
    proposed.proposalId,
  );
  const rendered = shows.shown.join("\n");

  expect(rendered).toContain("[alternative] alternative");
  // The ghost candidate is gone from what rondo reads now.
  const ghostIndex = shows.shown.findIndex((line) => line.includes("ghost"));
  expect(ghostIndex).toBeGreaterThanOrEqual(0);
  expect(shows.shown.slice(ghostIndex, ghostIndex + 4).join("\n")).toContain(
    "freshness: moved (no longer present in what rondo reads now)",
  );
  // Both real candidates read unmoved despite the reversed order: they were
  // matched by their own iteration id, not by array position.
  expect(rendered).toContain("2 unmoved, 1 moved, 0 undetermined");
});

test("a citation broken at composition reads undetermined, never unmoved", async () => {
  const { connection, store, record } = fresh();
  await reserveWithPlan(store, "iter-1", null);

  const proposed = await proposeRetry(
    { ...PROPOSE_PORTS, store, record, present: screen().present },
    "run_plan",
    "iter-1",
    "iter-2",
  );
  expect(proposed.kind === "refused" ? proposed.reason : "proposed").toBe("proposed");
  if (proposed.kind !== "proposed") {
    return;
  }
  const row = onlyProposalRow(connection);
  const snapshot = JSON.parse(String(row["snapshot"])) as JsonRecord;
  const payload = JSON.parse(String(row["payload"])) as {
    options: { label: string; value: string; basis: { form: string; pointer: string } }[];
    recommended: number;
  };
  const broken = {
    ...payload,
    options: payload.options.map((option, index) =>
      index === 0
        ? { ...option, basis: { form: "snapshot", pointer: "/candidates/9/contractDigest" } }
        : option,
    ),
  };
  rewriteProposal(connection, proposed.proposalId, {
    payload: broken as unknown as JsonRecord,
    snapshot,
  });

  const shows = screen();
  await showProposal(
    {
      store,
      cadenzaRevision: PROPOSE_PORTS.cadenzaRevision,
      record,
      now: () => 9_000,
      present: shows.present,
    },
    proposed.proposalId,
  );
  const rendered = shows.shown.join("\n");
  expect(rendered).toContain("does not resolve");
  expect(rendered).toContain(
    "freshness: undetermined (this citation does not resolve in the stored snapshot)",
  );
  expect(rendered).not.toContain("freshness: unmoved (this citation does not resolve");
});

test("a gatherer that refuses reads undetermined for every basis, with its reason on the screen", async () => {
  const { connection, store, record } = fresh();
  await reserveWithPlan(store, "iter-1", null);

  const proposed = await proposeRetry(
    { ...PROPOSE_PORTS, store, record, present: screen().present },
    "run_plan",
    "iter-1",
    "iter-2",
  );
  expect(proposed.kind === "refused" ? proposed.reason : "proposed").toBe("proposed");
  if (proposed.kind !== "proposed") {
    return;
  }
  // The subject's plan is corrupted underneath the proposal, so a re-gather
  // cannot compose anything to compare against.
  connection
    .prepare("UPDATE iteration SET plan = ?, plan_digest = ? WHERE id = ?")
    .run(canonicalJson(UNDECODABLE_PLAN), planDigest(UNDECODABLE_PLAN), "iter-1");

  const shows = screen();
  await showProposal(
    {
      store,
      cadenzaRevision: PROPOSE_PORTS.cadenzaRevision,
      record,
      now: () => 9_000,
      present: shows.present,
    },
    proposed.proposalId,
  );
  const rendered = shows.shown.join("\n");
  expect(rendered).toContain("will not decode");
  expect(rendered).toContain("undetermined");
  expect(rendered).not.toContain("0 undetermined");
});

test("a cadenza pin that differs from the one that composed this row is said once", async () => {
  const { store, record } = fresh();
  await reserveWithPlan(store, "iter-1", null);

  const proposed = await proposeRetry(
    { ...PROPOSE_PORTS, store, record, present: screen().present },
    "run_plan",
    "iter-1",
    "iter-2",
  );
  expect(proposed.kind === "refused" ? proposed.reason : "proposed").toBe("proposed");
  if (proposed.kind !== "proposed") {
    return;
  }

  const shows = screen();
  await showProposal(
    { store, cadenzaRevision: "a-different-pin", record, now: () => 9_000, present: shows.present },
    proposed.proposalId,
  );
  const rendered = shows.shown.join("\n");
  expect(rendered).toContain(
    `cadenza pin moved: this proposal's contracts were composed under '${PROPOSE_PORTS.cadenzaRevision}', ` +
      "and rondo is running 'a-different-pin'",
  );
});

test(
  "a differing pin does not also report every candidate as independently moved, but a real " +
    "material change beside it still reads moved",
  async () => {
    // **Rule 5's fourth edge, taken literally.** A digest is a function of the
    // pin (`issueFor`), so once the pin line has already said the pin moved,
    // comparing `contractDigest` again on every candidate would report the
    // same one fact as though each candidate had moved on its own -- the
    // "reporting each option as though it had moved on its own" the entry
    // refuses. The candidate's digest here is rewritten as a stand-in for what
    // an old pin would have produced; a real field beside it (`status`) is
    // also wrong, and that one must still surface.
    const { connection, store, record } = fresh();
    await reserveWithPlan(store, "iter-1", null);

    const proposed = await proposeRetry(
      { ...PROPOSE_PORTS, store, record, present: screen().present },
      "run_plan",
      "iter-1",
      "iter-2",
    );
    expect(proposed.kind === "refused" ? proposed.reason : "proposed").toBe("proposed");
    if (proposed.kind !== "proposed") {
      return;
    }

    const row = onlyProposalRow(connection);
    const snapshot = JSON.parse(String(row["snapshot"])) as {
      iteration: unknown;
      successor: unknown;
      candidates: Record<string, unknown>[];
    };
    const [real0] = snapshot.candidates;
    if (real0 === undefined) {
      throw new Error("the fixture proposal did not compose a candidate");
    }
    const rewritten = {
      ...snapshot,
      candidates: [
        {
          ...real0,
          status: "no-longer-the-real-status",
          contractDigest: `sha256:${"1".repeat(64)}`,
        },
      ],
    } as unknown as JsonRecord;
    rewriteProposal(connection, proposed.proposalId, { snapshot: rewritten });

    const shows = screen();
    await showProposal(
      {
        store,
        cadenzaRevision: "a-different-pin",
        record,
        now: () => 9_000,
        present: shows.present,
      },
      proposed.proposalId,
    );
    const rendered = shows.shown.join("\n");
    expect(rendered).toContain("cadenza pin moved:");
    const basisIndex = shows.shown.findIndex((line) => line.includes("[recommended]"));
    expect(basisIndex).toBeGreaterThanOrEqual(0);
    const block = shows.shown.slice(basisIndex, basisIndex + 4).join("\n");
    // Moved, and for the real field -- not for the digest the pin already explains.
    expect(block).toContain("freshness: moved");
    expect(block).toContain("status: `no-longer-the-real-status` -> `");
    expect(block).not.toContain("contractDigest:");
  },
);

test("a proposal whose bases are all external reads undetermined, never as though nothing moved", async () => {
  const { store, record } = fresh();
  await reserveWithPlan(store, "iter-1", null);

  await record.recordProposal({
    proposalId: "p-elevated",
    kind: "explanation",
    drafter: "rondo/advisory/deterministic",
    payload: {
      claims: [
        {
          label: "observation",
          value: "the branch already has this fix",
          basis: {
            form: "repository",
            path: "src/foo.ts",
            commit: "abc123",
            firstLine: 1,
            lastLine: 2,
          },
        },
      ],
    },
    snapshot: { iteration: { id: "iter-1", status: "planned" } },
    derivation: "store_rows",
    iterationId: "iter-1",
    supersedesIterationId: null,
    supersedesProposalId: null,
    predecessorPlanDigest: null,
    predecessorContractDigest: null,
    agentTypeDigest: null,
    configDigest: null,
    contractDigest: null,
    continuoRevision: null,
    cadenzaRevision: null,
    elevatedFromMessageId: null,
    elevatedByActorId: null,
    createdAtMs: 5_000,
  });

  const shows = screen();
  await showProposal(
    {
      store,
      cadenzaRevision: PROPOSE_PORTS.cadenzaRevision,
      record,
      now: () => 9_000,
      present: shows.present,
    },
    "p-elevated",
  );
  const rendered = shows.shown.join("\n");
  expect(rendered).toContain("0 unmoved, 0 moved, 1 undetermined");
  expect(rendered).not.toContain("1 unmoved, 0 moved, 0 undetermined");
  expect(rendered).toContain("policy nothing in");
});

test(
  "an agent_type proposal's candidates carry no status: the subject finishing underneath it " +
    "still moves the header, though every basis reads unmoved",
  async () => {
    const { store, record } = fresh();
    await reserveWithPlan(store, "iter-1", null);

    const proposed = await proposeRetry(
      { ...PROPOSE_PORTS, store, record, present: screen().present },
      "contract_keys",
      "iter-1",
      "iter-2",
    );
    expect(proposed.kind === "refused" ? proposed.reason : "proposed").toBe("proposed");
    if (proposed.kind !== "proposed") {
      return;
    }
    // The subject finishes underneath the proposal. No candidate carries a
    // status field at all, so no basis is touched by it -- only the subject's
    // own comparison sees it.
    await store.settle("iter-1", "finished and merged upstream", 8_000);

    const shows = screen();
    await showProposal(
      {
        store,
        cadenzaRevision: PROPOSE_PORTS.cadenzaRevision,
        record,
        now: () => 9_000,
        present: shows.present,
      },
      proposed.proposalId,
    );
    const rendered = shows.shown.join("\n");
    expect(rendered).toContain("subject 'iter-1': moved");
    expect(rendered).toMatch(/\d+ unmoved, 0 moved, 0 undetermined/);
  },
);

const CLEAR: LapReadingDraft = {
  drafter: "rondo/deterministic/1",
  verdict: "clear",
  findings: [],
  evidence: {
    baseRef: "refs/remotes/origin/main",
    baseCommit: "b".repeat(40),
    tipCommit: "a".repeat(40),
    materialDigest: `sha256:${"c".repeat(64)}`,
    commitCount: 2,
    fileCount: 5,
  },
  unavailableReason: null,
};

test("two readings from the same drafter are matched by which reading each is, not by drafter alone", async () => {
  // **The identity a reading is matched by is the drafter *and* which of that
  // drafter's readings this is.** D-0029 appends a second reading beside the
  // first rather than replacing it, so matching by drafter alone would pair
  // both stored claims to whichever fresh reading happens to come first --
  // reporting the unchanged second reading as moved the instant it was
  // composed, which is exactly the false alarm rule 6 refuses to manufacture.
  const { store, record } = fresh();
  await reserveWithPlan(store, "iter-1", null);
  await store.transition("iter-1", "planned", "classified", {}, 2_000, {
    ...CLEAR,
    verdict: "concerns",
    findings: ["first reading's own finding"],
  });
  await store.transition("iter-1", "classified", "admitting", {}, 3_000, {
    ...CLEAR,
    verdict: "clear",
  });

  const explained = await explainIteration(
    { store, record, now: () => 4_000, present: screen().present },
    "iter-1",
  );
  expect(explained.kind).toBe("explained");
  if (explained.kind !== "explained") {
    return;
  }

  const shows = screen();
  await showProposal(
    { store, cadenzaRevision: "cadenza@abcdef0", record, now: () => 5_000, present: shows.present },
    explained.proposalId,
  );
  const rendered = shows.shown.join("\n");
  // Nothing changed between composition and this render, so nothing may read
  // moved -- including the two same-drafter readings, whose verdicts differ
  // from each other and would be reported as moved if either were compared
  // against the other's fresh row instead of its own.
  expect(rendered).not.toContain("freshness: moved");
  expect(rendered).toContain("independent reading (rondo/deterministic/1): concerns");
  expect(rendered).toContain("independent reading (rondo/deterministic/1): clear");
});

test("a `/readings` citation for no reading at all reads moved once a reading arrives", async () => {
  // **`propose()`'s whole-array citation, per rule 1's other case: a pointer
  // into a top-level record is that record**, and here the "record" pointed at
  // is the readings collection itself -- cited exactly when there was nothing
  // to point an element at.
  const { store, record } = fresh();
  await reserveWithPlan(store, "iter-1", null);

  const explained = await explainIteration(
    { store, record, now: () => 4_000, present: screen().present },
    "iter-1",
  );
  expect(explained.kind).toBe("explained");
  if (explained.kind !== "explained") {
    return;
  }

  await store.transition("iter-1", "planned", "classified", {}, 5_000, CLEAR);

  const shows = screen();
  await showProposal(
    { store, cadenzaRevision: "cadenza@abcdef0", record, now: () => 6_000, present: shows.present },
    explained.proposalId,
  );
  const rendered = shows.shown.join("\n");
  expect(rendered).toContain("independent reading: undetermined");
  const basisIndex = shows.shown.findIndex((line) => line.includes("basis: snapshot /readings ="));
  expect(basisIndex).toBeGreaterThanOrEqual(0);
  expect(shows.shown.slice(basisIndex, basisIndex + 2).join("\n")).toContain(
    "freshness: moved (0 at composition, 1 now)",
  );
});

test("an operator's whole-array `/readings` citation over unchanged readings reads unmoved", async () => {
  // **Key order is not content.** The row holds this array however the store
  // wrote it (`canonicalJson`'s alphabetised keys); the re-gather builds each
  // reading as a fresh object literal in its own field order. Comparing the
  // two by `JSON.stringify` would read the identical content as moved for no
  // reason but which one built its keys first -- codex's own finding.
  const { store, record } = fresh();
  await reserveWithPlan(store, "iter-1", null);
  await store.transition("iter-1", "planned", "classified", {}, 2_000, CLEAR);

  const elevated = await elevateObservation(
    { store, record, now: () => 3_000, present: screen().present },
    "iter-1",
    {
      messageId: "m-0001",
      actorId: "operator-1",
      observation: {
        label: "observation",
        value: "none of the readings raised a concern",
        basis: { form: "snapshot", pointer: "/readings" },
      },
    },
  );
  expect(elevated.kind).toBe("explained");
  if (elevated.kind !== "explained") {
    return;
  }

  const shows = screen();
  await showProposal(
    { store, cadenzaRevision: "cadenza@abcdef0", record, now: () => 4_000, present: shows.present },
    elevated.proposalId,
  );
  const rendered = shows.shown.join("\n");
  const basisIndex = shows.shown.findIndex((line) => line.includes("basis: snapshot /readings ="));
  expect(basisIndex).toBeGreaterThanOrEqual(0);
  expect(shows.shown.slice(basisIndex, basisIndex + 2).join("\n")).toContain("freshness: unmoved");
  expect(rendered).not.toContain("freshness: moved");
});

test("a reading backdated under an already-composed proposal reads unmoved, never moved (D-0051)", async () => {
  // D-0038's original failure mode: a reading appended with an earlier
  // `readAtMs` than one already composed into a proposal used to shift the
  // stored side's position out from under the drafter-plus-occurrence
  // identity. Content is the identity now, so a clock regression on an
  // unrelated, later-appended reading cannot move the first one at all.
  const { store, record } = fresh();
  await reserveWithPlan(store, "iter-1", null);
  await store.transition("iter-1", "planned", "classified", {}, 2_000, CLEAR);

  const explained = await explainIteration(
    { store, record, now: () => 4_000, present: screen().present },
    "iter-1",
  );
  expect(explained.kind).toBe("explained");
  if (explained.kind !== "explained") {
    return;
  }

  // Appended after composition, and backdated well before it.
  await store.transition("iter-1", "classified", "admitting", {}, 1_000, {
    ...CLEAR,
    drafter: "rondo/deterministic/2",
    verdict: "concerns",
    findings: ["a second drafter's finding"],
  });

  const shows = screen();
  await showProposal(
    { store, cadenzaRevision: "cadenza@abcdef0", record, now: () => 5_000, present: shows.present },
    explained.proposalId,
  );
  const rendered = shows.shown.join("\n");
  expect(rendered).toContain("1 readings at composition, 2 now");
  // The reading composed at rule 1 is unaffected by the second, backdated
  // one arriving after it -- content matches it regardless of clock or order.
  const basisIndex = shows.shown.findIndex((line) =>
    line.includes("basis: snapshot /readings/0/verdict"),
  );
  expect(basisIndex).toBeGreaterThanOrEqual(0);
  expect(shows.shown.slice(basisIndex, basisIndex + 2).join("\n")).toContain("freshness: unmoved");
});

test("two content-identical readings from one drafter are matched and not collapsed to one (D-0051)", async () => {
  // Rule 1's accepted cost: two readings whose stored fields agree are one
  // value twice as far as the snapshot is concerned, and the ordinal keeps
  // the count of them rather than telling them apart. Both must still be
  // matched (unmoved), and both must still render as two separate claims.
  const { store, record } = fresh();
  await reserveWithPlan(store, "iter-1", null);
  await store.transition("iter-1", "planned", "classified", {}, 2_000, CLEAR);
  await store.transition("iter-1", "classified", "admitting", {}, 3_000, CLEAR);

  const explained = await explainIteration(
    { store, record, now: () => 4_000, present: screen().present },
    "iter-1",
  );
  expect(explained.kind).toBe("explained");
  if (explained.kind !== "explained") {
    return;
  }

  const shows = screen();
  await showProposal(
    { store, cadenzaRevision: "cadenza@abcdef0", record, now: () => 5_000, present: shows.present },
    explained.proposalId,
  );
  const rendered = shows.shown.join("\n");
  expect(rendered).not.toContain("freshness: moved");
  const occurrences = shows.shown.filter((line) =>
    line.includes("independent reading (rondo/deterministic/1): clear"),
  );
  expect(occurrences.length).toBe(2);
});

test("a second reading arriving under a composed proposal says so once, as a count (D-0051 rule 5)", async () => {
  const { store, record } = fresh();
  await reserveWithPlan(store, "iter-1", null);
  await store.transition("iter-1", "planned", "classified", {}, 2_000, CLEAR);

  const explained = await explainIteration(
    { store, record, now: () => 4_000, present: screen().present },
    "iter-1",
  );
  expect(explained.kind).toBe("explained");
  if (explained.kind !== "explained") {
    return;
  }

  await store.transition("iter-1", "classified", "admitting", {}, 5_000, {
    ...CLEAR,
    drafter: "rondo/deterministic/2",
    verdict: "concerns",
  });

  const shows = screen();
  await showProposal(
    { store, cadenzaRevision: "cadenza@abcdef0", record, now: () => 6_000, present: shows.present },
    explained.proposalId,
  );
  const rendered = shows.shown.join("\n");
  expect(rendered).toContain("1 readings at composition, 2 now");
  // The one basis composed at rule 1 still reads unmoved; the count is what
  // carries the news that a second reading exists.
  const basisIndex = shows.shown.findIndex((line) =>
    line.includes("basis: snapshot /readings/0/verdict"),
  );
  expect(basisIndex).toBeGreaterThanOrEqual(0);
  expect(shows.shown.slice(basisIndex, basisIndex + 2).join("\n")).toContain("freshness: unmoved");
});
