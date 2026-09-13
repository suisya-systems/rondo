/**
 * D-0066 section 4's verdict over hand-built snapshots, and the one call site's
 * refusal half. Every refusing case is paired with its flipped control: the
 * same snapshot with only the tested field changed must reach `inside` (or the
 * next test), so a verdict that refused everything would be red here.
 */
import { resolve } from "node:path";
import { expect, test } from "vitest";

import {
  admitUnderScope,
  gatherScopeSnapshot,
  reviewScopeOf,
  type ScopeAct,
  type ScopeAdmitPorts,
  type ScopeReadPorts,
  type ScopeSnapshot,
  scopeVerdict,
} from "../../src/access/scope.js";
import { allocate } from "../../src/refrain/allocator.js";
import { classifyPlan } from "../../src/refrain/classification.js";
import { admittedPlan, planPayload, type RunPlan, runPlan } from "../../src/refrain/plan.js";
import {
  type JsonRecord,
  type LapReading,
  modelReadingDrafter,
  type ScopePayload,
  type StoredScope,
} from "../../src/store/records.js";

const DIGEST = (c: string) => `sha256:${c.repeat(64)}`;
const AGENT = DIGEST("a");

const PAYLOAD: ScopePayload = {
  requests: ["m-1"],
  workspaces: [{ repository: "/repo", workspace_root: "/work" }],
  agent_types: [AGENT],
  budgets: { laps: 3, review_rounds: 3, cost_usd: 10, cost_reserve_usd: 2, expires_at_ms: 1000 },
  severity_threshold: "major",
  outward_acts: [],
  irreversible_additions: [],
};

const SCOPE: StoredScope = {
  scopeId: "s-1",
  scopeDigest: DIGEST("5"),
  payload: PAYLOAD,
  supersedesScopeId: null,
  authorKind: "operator",
  authorId: "op",
  bases: [],
  createdAtMs: 0,
};

const PLAN = { repository: "/repo", workspaceRoot: "/work" } as RunPlan;

const START: ScopeAct = { kind: "lineage_start", iterationId: "i-2", plan: PLAN, proposalId: "p" };
const REDO: ScopeAct = { kind: "redo", iterationId: "i-2", plan: PLAN, predecessorId: "i-1" };

function reading(severities: readonly ("blocker" | "major" | "minor" | "nit")[]): LapReading {
  return {
    drafter: modelReadingDrafter("gpt-6-astra"),
    verdict: severities.length === 0 ? "clear" : "concerns",
    findings: severities.map((s) => `a ${s} finding`),
    graded: severities.map((severity) => ({ severity, bases: [], basisResolved: true })),
    evidence: null,
    unavailableReason: null,
    iterationId: "i-1",
    readAtMs: 1,
  } as unknown as LapReading;
}

const PREDECESSOR: NonNullable<ScopeSnapshot["predecessor"]> = {
  grants: { kind: "read", granted: ["a", "b"], contractDigestMatches: true },
  readings: { kind: "read", latestModelReading: reading(["major"]), roundsTaken: 1 },
};

function snapshot(
  parts: Partial<ScopeSnapshot> = {},
  payload: Partial<ScopePayload> = {},
): ScopeSnapshot {
  return {
    scope: { ...SCOPE, payload: { ...PAYLOAD, ...payload } },
    decision: {
      scopeDecisionId: "sd-1",
      scopeId: "s-1",
      scopeDigest: SCOPE.scopeDigest,
      outcome: "approved",
      actorId: "op",
      recordedBy: "rondo/cli",
      decidedAtMs: 0,
    },
    supersededByApproved: false,
    spent: { admissions: 0, readCostUsd: 0, unreadLaps: 0 },
    nowMs: 500,
    requestMessageId: "m-1",
    openAsks: [],
    lineageIterationIds: { kind: "read", ids: ["i-1", "i-0"] },
    classification: { kind: "read", outcome: "allowed", agentTypeDigest: AGENT, granted: ["a"] },
    predecessor: PREDECESSOR,
    ...parts,
  };
}

const INSIDE = { kind: "inside" };

test("the baseline snapshot is inside, for both arms", () => {
  expect(scopeVerdict(START, snapshot())).toEqual(INSIDE);
  expect(scopeVerdict(REDO, snapshot())).toEqual(INSIDE);
});

test.each<[string, ScopeSnapshot, "outside" | "undecidable", string]>([
  [
    "a declined decision",
    snapshot({ decision: { ...snapshot().decision, outcome: "declined" } }),
    "outside",
    "decision",
  ],
  [
    "a decision over another digest",
    snapshot({ decision: { ...snapshot().decision, scopeDigest: DIGEST("6") } }),
    "outside",
    "decision",
  ],
  ["an approved successor", snapshot({ supersededByApproved: true }), "outside", "superseded"],
  ["an unreadable request (R1)", snapshot({ requestMessageId: null }), "undecidable", "request"],
  ["a request not listed", snapshot({ requestMessageId: "m-9" }), "outside", "request"],
  [
    "a workspace root not listed",
    snapshot({}, { workspaces: [{ repository: "/repo", workspace_root: "/work/" }] }),
    "outside",
    "workspace",
  ],
  [
    "an unclassifiable plan",
    snapshot({ classification: { kind: "unreadable", reason: "no project" } }),
    "undecidable",
    "agent_type",
  ],
  [
    "an agent type not listed",
    snapshot({}, { agent_types: [DIGEST("b")] }),
    "outside",
    "agent_type",
  ],
  [
    "a contract that needs approval",
    snapshot({
      classification: {
        kind: "read",
        outcome: "needs_approval",
        agentTypeDigest: AGENT,
        granted: [],
      },
    }),
    "outside",
    "contract",
  ],
  [
    "an admission the scope adds to the irreversible list",
    snapshot({}, { irreversible_additions: ["admission"] }),
    "outside",
    "irreversible",
  ],
  ["now at the expiry", snapshot({ nowMs: 1000 }), "outside", "expiry"],
  [
    "the laps spent",
    snapshot({ spent: { admissions: 3, readCostUsd: 0, unreadLaps: 0 } }),
    "outside",
    "laps",
  ],
  [
    "a laps budget of 0",
    snapshot({}, { budgets: { ...PAYLOAD.budgets, laps: 0 } }),
    "outside",
    "laps",
  ],
  [
    "cost past the budget by the reserve of unread laps",
    snapshot({ spent: { admissions: 2, readCostUsd: 4.5, unreadLaps: 2 } }),
    "outside",
    "cost",
  ],
  ["unreadable asks (R1)", snapshot({ openAsks: null }), "undecidable", "asks"],
  ["an ask over the lineage", snapshot({ openAsks: [{ iterationId: "i-0" }] }), "outside", "asks"],
])("%s refuses at its own test", (_name, snap, kind, testName) => {
  expect(scopeVerdict(REDO, snap)).toMatchObject({ kind, test: testName });
});

test("controls: each boundary one step inside is inside", () => {
  expect(scopeVerdict(REDO, snapshot({ nowMs: 999 }))).toEqual(INSIDE);
  expect(
    scopeVerdict(REDO, snapshot({ spent: { admissions: 2, readCostUsd: 0, unreadLaps: 0 } })),
  ).toEqual(INSIDE);
  // Exact equality is inside: 4 read + (2 unread + this one) * 2 = 10.
  expect(
    scopeVerdict(REDO, snapshot({ spent: { admissions: 2, readCostUsd: 4, unreadLaps: 2 } })),
  ).toEqual(INSIDE);
  // A read cost replaces the reserve: 9 read + this one's 2 = 11 > 10, while 7.8 + 2 = 9.8 is inside.
  expect(
    scopeVerdict(REDO, snapshot({ spent: { admissions: 2, readCostUsd: 9, unreadLaps: 0 } })).kind,
  ).toBe("outside");
  expect(
    scopeVerdict(REDO, snapshot({ spent: { admissions: 2, readCostUsd: 7.8, unreadLaps: 0 } })),
  ).toEqual(INSIDE);
});

test("the first failing test decides the name", () => {
  // Both the request and the laps fail; the request comes first.
  expect(
    scopeVerdict(
      REDO,
      snapshot({ requestMessageId: null, spent: { admissions: 9, readCostUsd: 0, unreadLaps: 0 } }),
    ),
  ).toMatchObject({ kind: "undecidable", test: "request" });
});

test("an ask with no iteration holds back a lineage start and not a redo (rule 4.4)", () => {
  const unattached = snapshot({ openAsks: [{ iterationId: null }] });
  expect(scopeVerdict(START, unattached)).toMatchObject({ kind: "outside", test: "asks" });
  expect(scopeVerdict(REDO, unattached)).toEqual(INSIDE);
  // An ask on another lineage stops neither.
  const elsewhere = snapshot({ openAsks: [{ iterationId: "i-other" }] });
  expect(scopeVerdict(START, elsewhere)).toEqual(INSIDE);
  expect(scopeVerdict(REDO, elsewhere)).toEqual(INSIDE);
});

test("a lineage start reads no predecessor and no reading", () => {
  expect(scopeVerdict(START, snapshot({ predecessor: null }))).toEqual(INSIDE);
  expect(scopeVerdict(REDO, snapshot({ predecessor: null }))).toMatchObject({
    kind: "undecidable",
    test: "grants",
  });
});

test("redo grants: widened is outside, equal is inside, unreadable or drifted is undecidable", () => {
  const withGrants = (
    grants: NonNullable<ScopeSnapshot["predecessor"]>["grants"],
    granted: readonly string[] = ["a"],
  ) =>
    snapshot({
      classification: { kind: "read", outcome: "allowed", agentTypeDigest: AGENT, granted },
      predecessor: { ...PREDECESSOR, grants },
    });
  const same = { kind: "read", granted: ["a"], contractDigestMatches: true } as const;
  expect(scopeVerdict(REDO, withGrants(same))).toEqual(INSIDE);
  expect(scopeVerdict(REDO, withGrants(same, ["a", "net"]))).toMatchObject({
    kind: "outside",
    test: "grants",
    reason: expect.stringContaining("net"),
  });
  expect(scopeVerdict(REDO, withGrants({ ...same, contractDigestMatches: false }))).toMatchObject({
    kind: "undecidable",
    test: "grants",
  });
  expect(scopeVerdict(REDO, withGrants({ kind: "unreadable", reason: "gone" }))).toMatchObject({
    kind: "undecidable",
    test: "grants",
  });
});

test("redo readings: exit and revise are inside, stop is outside, none is undecidable", () => {
  const withReading = (latest: LapReading | null, roundsTaken: number) =>
    snapshot({
      predecessor: {
        ...PREDECESSOR,
        readings: { kind: "read", latestModelReading: latest, roundsTaken },
      },
    });
  // exit: only below the threshold, even with the budget spent (D-0065 rule 4.3's exit).
  expect(scopeVerdict(REDO, withReading(reading(["minor"]), 3))).toEqual(INSIDE);
  // revise: at the threshold with rounds left.
  expect(scopeVerdict(REDO, withReading(reading(["major"]), 2))).toEqual(INSIDE);
  // stop: the budget spent.
  expect(scopeVerdict(REDO, withReading(reading(["major"]), 3))).toMatchObject({
    kind: "outside",
    test: "readings",
  });
  // stop: unavailable (D-0065 rule 5.4).
  const unavailable = {
    ...reading([]),
    verdict: "unavailable",
    unavailableReason: "timed out",
  } as LapReading;
  expect(scopeVerdict(REDO, withReading(unavailable, 1))).toMatchObject({
    kind: "outside",
    test: "readings",
    reason: expect.stringContaining("timed out"),
  });
  // Q-a: no model reading at all.
  expect(scopeVerdict(REDO, withReading(null, 0))).toMatchObject({
    kind: "undecidable",
    test: "readings",
  });
  expect(
    scopeVerdict(
      REDO,
      snapshot({
        predecessor: { ...PREDECESSOR, readings: { kind: "unreadable", reason: "x" } },
      }),
    ),
  ).toMatchObject({ kind: "undecidable", test: "readings" });
});

test("the review budget is the scope's: 0 stops where 3 revises", () => {
  const round1 = { predecessor: PREDECESSOR };
  expect(
    scopeVerdict(REDO, snapshot(round1, { budgets: { ...PAYLOAD.budgets, review_rounds: 0 } })),
  ).toMatchObject({ kind: "outside", test: "readings" });
  expect(
    scopeVerdict(REDO, snapshot(round1, { budgets: { ...PAYLOAD.budgets, review_rounds: 3 } })),
  ).toEqual(INSIDE);
  // And so is the threshold: a 'major' finding under 'blocker' exits.
  expect(
    scopeVerdict(
      REDO,
      snapshot(round1, {
        budgets: { ...PAYLOAD.budgets, review_rounds: 0 },
        severity_threshold: "blocker",
      }),
    ),
  ).toEqual(INSIDE);
  expect(reviewScopeOf(PAYLOAD)).toEqual({
    budgets: { reviewRounds: 3 },
    severityThreshold: "major",
  });
});

function ports(snap: ScopeSnapshot, admitted: unknown[]): ScopeAdmitPorts {
  return {
    store: {
      read: async (id) => ({
        kind: "read",
        record: { id, supersedesIterationId: null, plan: {}, contractDigest: null } as never,
      }),
      readingsFor: async () => [],
    },
    record: {
      readScope: async () => ({ kind: "read", scope: snap.scope }),
      readScopeDecision: async () => ({ kind: "read", decision: snap.decision }),
      scopeSpent: async () => snap.spent,
      scopeSupersededByApproved: async () => snap.supersededByApproved,
    },
    nowMs: () => 500,
    admit: async (...args) => {
      admitted.push(args);
      return { iterationId: "i-2", status: "closed", lines: [] };
    },
  };
}

test("PLANTED: an undecidable verdict never calls admit, and names its test", async () => {
  // The production gatherer passes a null request (R1), so every scoped act on
  // this tree ends here -- with nothing admitted and nothing spent.
  const admitted: unknown[] = [];
  const outcome = await admitUnderScope(ports(snapshot(), admitted), "sd-1", REDO);
  expect(outcome).toMatchObject({ kind: "refused", verdict: "undecidable", test: "request" });
  expect(admitted).toEqual([]);

  const missing = ports(snapshot(), admitted);
  const absent: ScopeAdmitPorts = {
    ...missing,
    record: { ...missing.record, readScopeDecision: async () => ({ kind: "absent" }) },
  };
  expect(await admitUnderScope(absent, "sd-9", START)).toMatchObject({
    kind: "refused",
    test: "decision",
  });
  expect(admitted).toEqual([]);
});

// --- The gatherer -----------------------------------------------------------
//
// Every admitUnderScope case above stops at R1's null request, so nothing there
// reads what the gatherer computed for a redo. These call it directly over a
// fake store holding a real, classifiable stored plan and a three-link chain.

const ABS = (p: string) => resolve(p);

function storedPlan(): { payload: JsonRecord; contractDigest: string } {
  const repository = ABS("/srv/rondo/repo");
  const workspaceRoot = ABS("/srv/rondo/work");
  const planned = runPlan({
    db: ABS("/srv/rondo/control.db"),
    workspaceRoot,
    baseBranch: "main",
    prompt: "teach rondo to count",
    allowedBash: ["npm run:*"],
    materialLanguage: null,
    reviewCriterion: null,
    repository,
    artifactRoot: ABS("/srv/rondo/artifacts"),
    stateRoot: ABS("/srv/rondo/state"),
    interlockRoot: ABS("/srv/rondo/interlock"),
    claudeOrgPath: ABS("/srv/rondo/claude-org"),
    endpointRecipient: "external-notify",
    endpointDestinationDir: ABS("/srv/rondo/outbox"),
    claudeCommand: [ABS("/usr/bin/claude")],
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
    catalogLayers: [
      {
        layer: "tracked",
        origin: `${ABS("/srv/catalog")}/projects.toml`,
        baseDir: ABS("/srv/catalog"),
        data: {
          schema_version: 1,
          catalog: { allowed_local_roots: [repository] },
          project: {
            rondo: {
              source: { kind: "local_path", path: repository },
              base_branch: "main",
              aliases: [],
            },
          },
        },
      },
    ],
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
  });
  if (planned.kind !== "planned") throw new Error(planned.reason);
  const allocation = allocate("i-1", workspaceRoot);
  if (allocation.kind !== "allocated") throw new Error(allocation.reason);
  const admitted = admittedPlan(planned.plan, allocation.allocation);
  if (admitted.kind !== "planned") throw new Error(admitted.reason);
  const classified = classifyPlan(admitted.plan);
  if (classified.kind !== "answered") throw new Error("the fixture plan did not classify");
  return { payload: planPayload(admitted.plan), contractDigest: classified.value.contractDigest };
}

interface Link {
  readonly supersedes: string | null;
  readonly readings: readonly LapReading[];
  readonly contractDigest?: string | null;
}

function gatherPorts(links: Record<string, Link>): ScopeReadPorts {
  const { payload, contractDigest } = storedPlan();
  const base = ports(snapshot(), []);
  return {
    store: {
      read: async (id) => {
        const link = links[id];
        if (link === undefined) return { kind: "absent" } as never;
        return {
          kind: "read",
          record: {
            id,
            supersedesIterationId: link.supersedes,
            plan: payload,
            contractDigest:
              link.contractDigest === undefined ? contractDigest : link.contractDigest,
          } as never,
        };
      },
      readingsFor: async (id) => links[id]?.readings ?? [],
    },
    record: base.record,
  };
}

async function gatheredRedo(links: Record<string, Link>): Promise<ScopeSnapshot> {
  const gathered = await gatherScopeSnapshot(gatherPorts(links), "sd-1", REDO, 500);
  if (gathered.kind !== "gathered") throw new Error(gathered.reason);
  return gathered.snapshot;
}

test("the gatherer walks the chain newest first and reads the predecessor's latest model reading", async () => {
  const snap = await gatheredRedo({
    "i-1": { supersedes: "i-0", readings: [reading(["major"])] },
    "i-0": { supersedes: "i-root", readings: [reading(["blocker"])] },
    "i-root": { supersedes: null, readings: [] },
  });
  expect(snap.lineageIterationIds).toEqual({ kind: "read", ids: ["i-1", "i-0", "i-root"] });
  const readings = snap.predecessor?.readings;
  if (readings?.kind !== "read") throw new Error("the readings did not read");
  // Two links carry a model reading: the whole chain is counted, not the tip alone.
  expect(readings.roundsTaken).toBe(2);
  // The tip is the predecessor; its reading is the 'major' one, not the root's 'blocker'.
  expect(readings.latestModelReading?.graded).toEqual(reading(["major"]).graded);
  expect(snap.predecessor?.grants).toMatchObject({ kind: "read", contractDigestMatches: true });
  expect(snap.requestMessageId).toBeNull();

  // Control: a single-link chain counts one round.
  const one = await gatheredRedo({ "i-1": { supersedes: null, readings: [reading(["major"])] } });
  expect(one.predecessor?.readings).toMatchObject({ kind: "read", roundsTaken: 1 });
});

test("the predecessor's contract digest must be present and equal to its recomposition", async () => {
  const drifted = await gatheredRedo({
    "i-1": { supersedes: null, readings: [], contractDigest: DIGEST("9") },
  });
  expect(drifted.predecessor?.grants).toMatchObject({ contractDigestMatches: false });
  const missing = await gatheredRedo({
    "i-1": { supersedes: null, readings: [], contractDigest: null },
  });
  expect(missing.predecessor?.grants).toMatchObject({ contractDigestMatches: false });
  const matching = await gatheredRedo({ "i-1": { supersedes: null, readings: [] } });
  expect(matching.predecessor?.grants).toMatchObject({
    kind: "read",
    granted: ["command.run"],
    contractDigestMatches: true,
  });
});

test("a cyclic or broken lineage gathers as unreadable, not as a hang or a short chain", async () => {
  const cyclic = await gatheredRedo({
    "i-1": { supersedes: "i-0", readings: [] },
    "i-0": { supersedes: "i-1", readings: [] },
  });
  expect(cyclic.lineageIterationIds).toMatchObject({ kind: "unreadable" });
  expect(cyclic.predecessor?.readings).toMatchObject({ kind: "unreadable" });
  const broken = await gatheredRedo({ "i-1": { supersedes: "i-gone", readings: [] } });
  expect(broken.lineageIterationIds).toMatchObject({ kind: "unreadable" });
  // Control: the same chain ending properly reads.
  const ended = await gatheredRedo({
    "i-1": { supersedes: "i-0", readings: [] },
    "i-0": { supersedes: null, readings: [] },
  });
  expect(ended.lineageIterationIds).toEqual({ kind: "read", ids: ["i-1", "i-0"] });
});
