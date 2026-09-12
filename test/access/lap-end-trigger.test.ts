/**
 * The trigger a stopped lap pulls (`D-0043`), measured at the ending rather
 * than at the function.
 *
 * **What this file is here to prove is mostly a set of absences**, and absences
 * are what a green test is worst at. `D-0043` rule 1 fires on one ending and
 * rule 2 names four that must not, so every "does not fire" case below drives
 * the arc to that ending **through the conductor** and then counts the rows --
 * rather than calling the door and asserting it returned nothing, which would
 * prove only that the door was not called.
 *
 * **A real store and a fake continuo.** The advisory reads rondo's own rows and
 * composes contracts through the real cadenza facade, so the store is a real
 * `node:sqlite` database and the plan fixture is one cadenza will build; the
 * continuo seam is injected, as `D-0019` rule 17 requires of everything but the
 * two smokes.
 */
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import type { UnpromptedPorts } from "../../src/access/advisory.js";
import { proposeAfterAbandon } from "../../src/access/advisory.js";
import { abandon, admit, resume } from "../../src/access/conductor.js";
import type { CatalogLayer } from "../../src/cadenza/facade.js";
import type { AdmittedPlan, RunPlan } from "../../src/refrain/plan.js";
import type { LoopPolicy } from "../../src/refrain/policy.js";
import { CONSERVATIVE_HOST_POLICY } from "../../src/refrain/policy.js";
import type {
  ClassificationRecord,
  ConductorPorts,
  ContinuoStarted,
  EffectOutcome,
  GateObservation,
  LapPerformance,
  RunAdmission,
} from "../../src/refrain/ports.js";
import type { LapReadingDraft } from "../../src/store/records.js";
import { advisoryRecord, iterationStore } from "../../src/store/sqlite.js";

const NOW_MS = 1_700_000_000_000;
const SUBJECT = "i-0001";
/** The run id `allocate()` derives from {@link SUBJECT} (D-0023 rule 3). */
const RUN_ID = `rondo-${SUBJECT}`;
const POLICY: LoopPolicy = { autonomy: "ask_before_landing", maxIterations: 1 };

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

/** A plan cadenza will build, whose agent type offers exactly one askable key. */
const PLAN: RunPlan = {
  db: "/srv/rondo/control.db",
  workspaceRoot: "/srv/rondo/work",
  baseBranch: "main",
  prompt: "teach rondo to count",
  allowedBash: ["npm run:*"],
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

/** The same plan under an agent type whose author offered nothing to promote. */
const PLAN_WITH_NOTHING_ASKABLE: RunPlan = {
  ...PLAN,
  agentTypeInput: { ...PLAN.agentTypeInput, askable: [] },
};

const CLEAR_READING: LapReadingDraft = {
  drafter: "rondo/deterministic/1",
  verdict: "clear",
  findings: [],
  evidence: {
    baseRef: "refs/heads/main",
    baseCommit: "b".repeat(40),
    tipCommit: "a".repeat(40),
    materialDigest: `sha256:${"c".repeat(64)}`,
    commitCount: 2,
    fileCount: 3,
  },
  unavailableReason: null,
};

interface Answers {
  classify: EffectOutcome<ClassificationRecord>;
  showGate: EffectOutcome<GateObservation>;
}

const ALLOWED: EffectOutcome<ClassificationRecord> = {
  kind: "answered",
  value: {
    outcome: "allowed",
    reason: "granted",
    agentTypeDigest: "sha256:agent",
    configDigest: "sha256:config",
    contractDigest: "sha256:contract",
    neutralRoleName: "worker",
    modelTier: "standard",
  },
};

const STARTED: EffectOutcome<ContinuoStarted> = {
  kind: "answered",
  value: { revision: "44f62336" },
};

const RUN_CREATED: EffectOutcome<RunAdmission> = {
  kind: "answered",
  value: { runId: RUN_ID, status: "created", continuoRole: "worker" },
};

const LAP_OPENED_A_GATE: EffectOutcome<LapPerformance> = {
  kind: "answered",
  value: {
    runId: RUN_ID,
    gateId: "gate-1",
    sessionId: "session-1",
    sessionPath: "started",
    endpointLeaseFailure: null,
    elapsedDeadlineAtMs: null,
    model: "claude-fixture",
    requestedModel: "claude-fixture",
  },
};

interface Harness {
  readonly connection: DatabaseSync;
  readonly ports: ConductorPorts;
  readonly advisory: UnpromptedPorts;
  readonly answers: Answers;
}

/**
 * A conductor over a real store and an injected seam.
 *
 * `answers` is mutable so one arc can be driven past a gate that was open when
 * it was first looked at -- which is the only way to reach `closed` through the
 * conductor rather than by writing the status into the row.
 */
function harness(classify: EffectOutcome<ClassificationRecord> = ALLOWED): Harness {
  const connection = new DatabaseSync(":memory:");
  const store = iterationStore(connection, CONSERVATIVE_HOST_POLICY);
  const answers: Answers = {
    classify,
    showGate: { kind: "answered", value: { gateId: "gate-1", stage: "received", outcome: null } },
  };
  const ports: ConductorPorts = {
    store,
    now: () => NOW_MS,
    classify: () => Promise.resolve(answers.classify),
    startContinuo: () => Promise.resolve(STARTED),
    admitRun: () => Promise.resolve(RUN_CREATED),
    performLap: () => Promise.resolve(LAP_OPENED_A_GATE),
    showGate: (_plan: AdmittedPlan, _gateId: string) => Promise.resolve(answers.showGate),
    readLapWork: () => Promise.resolve({ kind: "answered", value: CLEAR_READING }),
  };
  return {
    connection,
    ports,
    answers,
    advisory: {
      store,
      record: advisoryRecord(connection),
      now: () => NOW_MS,
      // Never called: this door shows nobody anything (D-0043 rule 9). It
      // throws rather than ignoring the lines, so a call would be a red test
      // and not a silent one.
      present: () => {
        throw new Error("the unprompted door presented something");
      },
      cadenzaRevision: "5d5d9f4",
    },
  };
}

const rowsIn = (connection: DatabaseSync, table: string): Record<string, unknown>[] =>
  connection.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];

/** cadenza answering `needs_approval`, which is the ending rondo#105 is about. */
const NEEDS_APPROVAL: EffectOutcome<ClassificationRecord> = {
  kind: "answered",
  value: {
    outcome: "needs_approval",
    reason: "branch.push is askable and was asked for",
    agentTypeDigest: "sha256:agent",
    configDigest: "sha256:config",
    contractDigest: "sha256:contract",
    neutralRoleName: "worker",
    modelTier: "standard",
  },
};

test("a needs_approval leaves a contract_keys proposal, its compositions, and no attention row", async () => {
  // **The whole of rule 1, rule 4, rule 6 and rule 9 in one arc.** The lap ends
  // where rondo#105 measured an empty table, and what stands there afterwards
  // is an option set a person can answer -- composed for a successor identity
  // rondo minted, recorded with nobody having been shown anything.
  const h = harness(NEEDS_APPROVAL);

  const report = await admit(h.ports, h.advisory, PLAN, POLICY, SUBJECT);
  expect(report.status).toBe("abandoned");

  const proposals = rowsIn(h.connection, "proposal");
  expect(proposals.length).toBe(1);
  expect(proposals[0]?.["kind"]).toBe("contract_keys");
  expect(proposals[0]?.["iteration_id"]).toBe(SUBJECT);
  // Derived from the subject and carrying no clock (rule 10).
  expect(proposals[0]?.["proposal_id"]).toBe(`contract_keys-${SUBJECT}-r2`);
  // Unchanged, and one promotion of the fixture's single askable key.
  expect(rowsIn(h.connection, "composition").length).toBe(2);
  // Rule 9: nobody was shown this, so nothing claims they were.
  expect(rowsIn(h.connection, "operator_attention").length).toBe(0);
  expect(report.lines.join("\n")).toContain(`contract_keys-${SUBJECT}-r2`);
});

test("cadenza refusing the action fires the same trigger", async () => {
  // The second of rule 1's three grant-shaped endings. It is a different branch
  // of the interpreter and lands on the same terminal status, which is the
  // property rule 1 is stated over.
  const h = harness({
    kind: "answered",
    value: {
      outcome: "refused",
      reason: "the catalog and the lap name two repositories",
      agentTypeDigest: "sha256:agent",
      configDigest: "sha256:config",
      contractDigest: "sha256:contract",
      neutralRoleName: "worker",
      modelTier: "standard",
    },
  });

  const report = await admit(h.ports, h.advisory, PLAN, POLICY, SUBJECT);
  expect(report.status).toBe("abandoned");
  expect(rowsIn(h.connection, "proposal").length).toBe(1);
});

test("a classification refused before any classification fires it too", async () => {
  // Rule 1's third ending: the effect itself refused, so no cadenza answer
  // exists at all. The row is still `abandoned` and still grant-shaped enough
  // to be worth an option set.
  const h = harness({ kind: "refused", message: "ProjectNotFoundError: no 'rondo'" });

  const report = await admit(h.ports, h.advisory, PLAN, POLICY, SUBJECT);
  expect(report.status).toBe("abandoned");
  expect(rowsIn(h.connection, "proposal").length).toBe(1);
});

test("a failed lap proposes nothing", async () => {
  // Rule 2. A `defect` is rondo's own fault or a build that would not verify,
  // and an option set of contracts answers none of it.
  const h = harness({ kind: "defect", reason: "the continuo build could not be verified" });

  const report = await admit(h.ports, h.advisory, PLAN, POLICY, SUBJECT);
  expect(report.status).toBe("failed");
  expect(rowsIn(h.connection, "proposal").length).toBe(0);
  expect(rowsIn(h.connection, "composition").length).toBe(0);
});

test("an open gate proposes nothing, and neither does the closing of it", async () => {
  // Rule 2's two remaining endings, driven through the conductor in one arc.
  // `awaiting_human` is a question somebody else already asked, and `closed` is
  // an ending `resume()` writes -- and `resume()` has no trigger at all.
  const h = harness();

  const first = await admit(h.ports, h.advisory, PLAN, POLICY, SUBJECT);
  expect(first.status).toBe("awaiting_human");
  expect(rowsIn(h.connection, "proposal").length).toBe(0);

  h.answers.showGate = {
    kind: "answered",
    value: { gateId: "gate-1", stage: "forwarded", outcome: "answered_and_forwarded" },
  };
  const second = await resume(h.ports, SUBJECT);
  expect(second.status).toBe("closed");
  expect(rowsIn(h.connection, "proposal").length).toBe(0);
});

test("a person abandoning a lap themselves proposes nothing", async () => {
  // Rule 2's fourth exclusion, and the reason the trigger is placed on the arc
  // rather than on the status: this row ends `abandoned` like the first case in
  // this file, and nothing is written, because a person with their hands on the
  // keyboard can type `rondo propose`.
  const h = harness();

  await admit(h.ports, h.advisory, PLAN, POLICY, SUBJECT);
  expect(rowsIn(h.connection, "proposal").length).toBe(0);
  const report = await abandon(h.ports, SUBJECT, "I am taking this one by hand");

  expect(report.status).toBe("abandoned");
  expect(rowsIn(h.connection, "proposal").length).toBe(0);

  // **The control for the absence above**, and the reason it is worth writing:
  // without it this case is equally consistent with a door that could not have
  // written anything about this row. Called by hand on the row `abandon()` just
  // wrote, the same door writes a proposal -- so what the two assertions
  // measure is the wiring and not an inability.
  const byHand = await proposeAfterAbandon(h.advisory, SUBJECT);
  expect(byHand.kind).toBe("proposed");
  expect(rowsIn(h.connection, "proposal").length).toBe(1);
});

test("an agent type with nothing askable is recorded as nothing, and says so", async () => {
  // Rule 5. `promotionsOf` offers the contract the subject ran under plus one
  // option per askable key, so an author who offered none leaves a set of one
  // -- and an option set of one is not a choice.
  const h = harness(NEEDS_APPROVAL);

  const report = await admit(h.ports, h.advisory, PLAN_WITH_NOTHING_ASKABLE, POLICY, SUBJECT);
  expect(report.status).toBe("abandoned");
  expect(rowsIn(h.connection, "proposal").length).toBe(0);
  expect(report.lines.join("\n")).toContain("declares no askable key");
});

test("a successor identity that is taken is skipped, and the next free one is minted", async () => {
  // Rule 6's probe. The name is derived, so the *first free* derivation is the
  // one minted: a taken `-r2` is not a refusal, and it is not a collision
  // either, because nothing has been admitted under it here.
  const h = harness(NEEDS_APPROVAL);
  const store = iterationStore(h.connection, CONSERVATIVE_HOST_POLICY);
  await store.reserve({
    id: `${SUBJECT}-r2`,
    request: "an earlier retry, already spent",
    plan: { run_id: "rondo-i-0001-r2" },
    nowMs: NOW_MS - 1_000,
    supersedesIterationId: null,
    runId: `rondo-${SUBJECT}-r2`,
    topicBranch: `rondo/${SUBJECT}-r2`,
    workspace: `/srv/rondo/work/iter-${SUBJECT}-r2`,
  });
  await store.settle(`${SUBJECT}-r2`, "it was taken by hand", NOW_MS - 500);

  await admit(h.ports, h.advisory, PLAN, POLICY, SUBJECT);

  const proposals = rowsIn(h.connection, "proposal");
  expect(proposals.length).toBe(1);
  expect(proposals[0]?.["proposal_id"]).toBe(`contract_keys-${SUBJECT}-r3`);
});

test("the pin the trigger needs being unreadable does not refuse the lap", async () => {
  // Rule 11. The lap does not need `cadenza.pin.json`; only the row saying
  // which cadenza composed a contract does. So the absence is carried as a
  // value, the iteration's own outcome stands, and the report says why there is
  // no proposal.
  const h = harness(NEEDS_APPROVAL);

  const report = await admit(
    h.ports,
    { unavailable: "cadenza.pin.json could not be read: ENOENT" },
    PLAN,
    POLICY,
    SUBJECT,
  );

  expect(report.status).toBe("abandoned");
  expect(rowsIn(h.connection, "proposal").length).toBe(0);
  expect(report.lines.join("\n")).toContain("cadenza.pin.json could not be read");
});

test("an advisory that throws leaves the ending exactly where the arc put it", async () => {
  // Rule 11's other half, and the reason the `catch` in `proposeLine` is total:
  // this runs after a terminal transition is committed, so there is no failure
  // here worth turning an ended lap into an exception a surface has to decide
  // what to do with.
  const h = harness(NEEDS_APPROVAL);
  const raising: UnpromptedPorts = {
    ...(h.advisory as Extract<UnpromptedPorts, { store: unknown }>),
    store: {
      ...(h.advisory as Extract<UnpromptedPorts, { store: unknown }>).store,
      read: () => {
        throw new Error("the database is gone");
      },
    },
  };

  const report = await admit(h.ports, raising, PLAN, POLICY, SUBJECT);

  expect(report.status).toBe("abandoned");
  expect(rowsIn(h.connection, "proposal").length).toBe(0);
  expect(report.lines.join("\n")).toContain("the advisory raised");
});

test("the same subject proposed twice writes one row, and the store is what refuses the second", async () => {
  // Rule 10. The id is derived, so a second attempt composes the same one and
  // collides on the primary key -- which is the whole of the idempotence this
  // door needs. Driven directly, because `admit()` cannot be re-entered on an
  // iteration id the store already holds.
  const h = harness(NEEDS_APPROVAL);
  await admit(h.ports, h.advisory, PLAN, POLICY, SUBJECT);
  expect(rowsIn(h.connection, "proposal").length).toBe(1);

  const second = await proposeAfterAbandon(h.advisory, SUBJECT);

  expect(second.kind).toBe("silent");
  expect(rowsIn(h.connection, "proposal").length).toBe(1);
});
