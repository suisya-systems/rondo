/**
 * The conductor's arc, its refusal branches, and the two invariants a green
 * test can most easily fail to hold.
 *
 * What this file defends, in order of how much it is worth:
 *
 *  - **Single-flight is a lock, and an answer releases it while a silence keeps
 *    it.** The fake store below enforces "at most one non-terminal iteration"
 *    itself, so the interpreter is tested against the rule rather than against a
 *    permissive stub. A stub that accepted every reservation would let every
 *    case here pass while the property under test was false.
 *  - **Provenance is committed before the effect it explains.** The observed
 *    continuo revision and the run id reach the store *before* `run admit` is
 *    called, and that is asserted on the recorded **call order** rather than on
 *    the final row, because a final row is equally consistent with the reverse
 *    order (D-0019 rule 10's write order).
 *  - **`resume()` is idempotent.** An open gate changes nothing; a closed gate
 *    is written once however many times it is observed.
 *  - **D-0019 rule 10's releasing-event table, a case per row.** Every
 *    non-terminal status is driven to its release *through the interpreter* and
 *    the resulting status is asserted. The table is the enumeration of what must
 *    be covered, and the drivers are typed by it, so a status added to the union
 *    without a releasing event fails this file rather than wedging a conductor.
 *
 * **Injected fakes only** (D-0019 rule 17): no continuo build, no `spawn`, no
 * network, no filesystem and no database. Real cadenza and real continuo stay
 * confined to the two existing smokes, and the full lap is a documented manual
 * procedure.
 */
import { expect, test } from "vitest";

import type {
  AgentTypeInput,
  CatalogLayer,
  IntendedAction,
  IssuanceParties,
} from "../../src/cadenza/facade.js";
import {
  abandon,
  admit,
  type ConductorReport,
  requestWithdrawal,
  resume,
} from "../../src/refrain/interpreter.js";
import { planPayload, type RunPlan, runPlan } from "../../src/refrain/plan.js";
import type { LoopPolicy } from "../../src/refrain/policy.js";
import { CONSERVATIVE_POLICY } from "../../src/refrain/policy.js";
import type {
  ClassificationRecord,
  ConductorPorts,
  ContinuoStarted,
  EffectOutcome,
  GateObservation,
  LapPerformance,
  ReadOutcome,
  ReserveInput,
  ReserveOutcome,
  RunAdmission,
  SettleOutcome,
  StorePort,
  TransitionOutcome,
} from "../../src/refrain/ports.js";
import type {
  IterationFields,
  IterationRecord,
  IterationStatus,
  NonTerminalStatus,
} from "../../src/store/records.js";
import { isTerminal, RELEASED_BY } from "../../src/store/records.js";

/** Autonomy and a ceiling that both permit one admission. */
const PERMISSIVE: LoopPolicy = { autonomy: "ask_before_landing", maxIterations: 1 };

/** The clock the ports hand over. Fixed, because nothing here reasons about time. */
const NOW_MS = 1_700_000_000_000;

// --- the fakes ---------------------------------------------------------------

/** One committed transition, as the store saw it. */
interface Move {
  readonly from: IterationStatus;
  readonly to: IterationStatus;
}

/**
 * An in-memory store that enforces the invariant the real one enforces.
 *
 * The single-live-iteration rule is the point of writing a fake rather than
 * stubbing: under the real schema it is a partial unique index, and a fake that
 * accepted a second reservation would quietly make every single-flight case in
 * this file vacuous. `transition` asserts the `from` status for the same reason
 * -- that assertion *is* the closed edge relation, and a fake that ignored it
 * would test a machine nobody is going to run.
 *
 * It refuses a row it cannot decode for the same reason, and that refusal is the
 * one this file was previously missing. A fake whose `read` always answered made
 * the interpreter's whole "the row will not decode" path look covered while it
 * was unreachable against the real store, which throws inside its decoder and
 * answers `unreadable`. The three shapes below are the real store's: `read` and
 * `readLive` answer `unreadable` with the id and the reason, `transition`
 * answers `defect` because the status will not decode inside the transaction,
 * and `settle` writes by id alone without decoding anything. Matching all three
 * is what stops the two from drifting silently.
 */
class FakeStore implements StorePort {
  readonly rows = new Map<string, IterationRecord>();
  readonly moves: Move[] = [];

  /**
   * Ids the fake will not decode, with the reason the real store would give.
   *
   * The row itself is still in `rows`, which is the situation being modelled: a
   * row that is *there*, counts as live, and cannot be read.
   */
  readonly corrupt = new Map<string, string>();

  /** Run just before a transition is applied, so a test can move the row underneath a call. */
  beforeTransition: (() => void) | null = null;

  /**
   * The same, but armed for one *named* transition.
   *
   * A case that needs the row moved underneath a specific commit cannot use the
   * hook above: by the time it could set it, `admit()` is already several
   * transitions in. Naming the target status is how a test says "block exactly
   * this write".
   */
  beforeTransitionTo: { readonly to: IterationStatus; readonly hook: () => void } | null = null;

  constructor(private readonly calls: string[]) {}

  reserve(input: ReserveInput): Promise<ReserveOutcome> {
    this.calls.push("reserve");
    for (const row of this.rows.values()) {
      if (!isTerminal(row.status)) {
        return Promise.resolve({ kind: "occupied", liveIterationId: row.id });
      }
    }
    const record: IterationRecord = {
      ...blankRecord(input.id, "planned"),
      request: input.request,
      plan: input.plan,
      planDigest: "sha256:fake",
      createdAtMs: input.nowMs,
      updatedAtMs: input.nowMs,
    };
    this.rows.set(record.id, record);
    return Promise.resolve({ kind: "reserved", record });
  }

  transition(
    id: string,
    from: IterationStatus,
    to: IterationStatus,
    fields: IterationFields,
    nowMs: number,
  ): Promise<TransitionOutcome> {
    this.calls.push(`transition:${from}->${to}`);
    if (this.beforeTransition !== null) {
      const hook = this.beforeTransition;
      this.beforeTransition = null;
      hook();
    }
    if (this.beforeTransitionTo !== null && this.beforeTransitionTo.to === to) {
      const armed = this.beforeTransitionTo;
      this.beforeTransitionTo = null;
      armed.hook();
    }
    const row = this.rows.get(id);
    if (row === undefined) {
      return Promise.resolve({ kind: "missing" });
    }
    const refusal = this.corrupt.get(id);
    if (refusal !== undefined) {
      // The real store decodes the row *inside* the transaction to assert the
      // status it is leaving, so a row that will not decode is a `defect` there
      // and not an `unexpectedStatus`: there is no status to have found.
      return Promise.resolve({ kind: "defect", reason: refusal });
    }
    if (row.status !== from) {
      return Promise.resolve({ kind: "unexpectedStatus", found: row.status });
    }
    const next: IterationRecord = { ...row, ...fields, status: to, updatedAtMs: nowMs };
    this.rows.set(id, next);
    this.moves.push({ from, to });
    return Promise.resolve({ kind: "transitioned", record: next });
  }

  read(id: string): Promise<ReadOutcome> {
    const row = this.rows.get(id);
    if (row === undefined) {
      return Promise.resolve({ kind: "absent" });
    }
    const refusal = this.corrupt.get(id);
    if (refusal !== undefined) {
      return Promise.resolve({ kind: "unreadable", id, reason: refusal });
    }
    return Promise.resolve({ kind: "read", record: row });
  }

  readLive(): Promise<ReadOutcome> {
    for (const row of this.rows.values()) {
      if (!isTerminal(row.status)) {
        return this.read(row.id);
      }
    }
    return Promise.resolve({ kind: "absent" });
  }

  /**
   * Terminate a row by id alone, decoding nothing.
   *
   * Status-blind, exactly as the real one is: no `from` is asserted, because a
   * row whose status cannot be read has none to assert. The write replaces the
   * column that would not decode, so the row stops being corrupt -- which is the
   * point of the operation, and what a case asserting the released lock is
   * actually asserting.
   */
  settle(id: string, reason: string, nowMs: number): Promise<SettleOutcome> {
    this.calls.push("settle");
    const row = this.rows.get(id);
    if (row === undefined) {
      return Promise.resolve({ kind: "missing" });
    }
    this.rows.set(id, { ...row, status: "abandoned", reason, updatedAtMs: nowMs });
    this.corrupt.delete(id);
    return Promise.resolve({ kind: "settled" });
  }

  /** Put a row in place directly, which is what a restart finds. */
  seed(record: IterationRecord): void {
    this.rows.set(record.id, record);
  }

  /** A row that is there, counts as live, and will not decode. */
  seedCorrupt(record: IterationRecord, reason: string): void {
    this.rows.set(record.id, record);
    this.corrupt.set(record.id, reason);
  }

  /** The committed transitions, as `from->to` strings, in order. */
  path(): string[] {
    return this.moves.map((move) => `${move.from}->${move.to}`);
  }
}

/** Every field of a row that no case here reads, at its empty value. */
function blankRecord(id: string, status: IterationStatus): IterationRecord {
  return {
    id,
    status,
    request: "do the thing",
    plan: planPayload(PLAN),
    planDigest: "sha256:fake",
    attempts: 1,
    runId: null,
    continuoRevision: null,
    agentTypeDigest: null,
    configDigest: null,
    contractDigest: null,
    classification: null,
    classificationReason: null,
    neutralRoleName: null,
    continuoRole: null,
    modelTier: null,
    model: null,
    gateId: null,
    gateStage: null,
    gateOutcome: null,
    sessionId: null,
    sessionPath: null,
    reason: null,
    createdAtMs: NOW_MS,
    updatedAtMs: NOW_MS,
  };
}

/** What each of the five effect ports will answer, mutable between calls. */
interface Answers {
  classify: EffectOutcome<ClassificationRecord>;
  startContinuo: EffectOutcome<ContinuoStarted>;
  admitRun: EffectOutcome<RunAdmission>;
  performLap: EffectOutcome<LapPerformance>;
  showGate: EffectOutcome<GateObservation>;
}

function successfulAnswers(): Answers {
  return {
    classify: {
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
    },
    startContinuo: { kind: "answered", value: { revision: "44f62336" } },
    admitRun: {
      kind: "answered",
      value: { runId: "run-1", status: "created", continuoRole: "worker" },
    },
    performLap: {
      kind: "answered",
      value: {
        runId: "run-1",
        gateId: "gate-1",
        sessionId: "session-1",
        sessionPath: "started",
        endpointLeaseFailure: null,
        elapsedDeadlineAtMs: null,
        model: MODEL,
        requestedModel: MODEL,
      },
    },
    showGate: {
      kind: "answered",
      value: { gateId: "gate-1", stage: "received", outcome: null },
    },
  };
}

interface Harness {
  readonly ports: ConductorPorts;
  readonly store: FakeStore;
  /** Store operations and effect calls, interleaved, in the order they happened. */
  readonly calls: string[];
  readonly answers: Answers;
}

function harness(overrides: Partial<Answers> = {}): Harness {
  const calls: string[] = [];
  const store = new FakeStore(calls);
  const answers: Answers = { ...successfulAnswers(), ...overrides };
  const ports: ConductorPorts = {
    store,
    now: () => NOW_MS,
    classify: () => {
      calls.push("classify");
      return Promise.resolve(answers.classify);
    },
    startContinuo: () => {
      calls.push("startContinuo");
      return Promise.resolve(answers.startContinuo);
    },
    admitRun: (_plan: RunPlan, neutralRoleName: string) => {
      calls.push(`admitRun:${neutralRoleName}`);
      return Promise.resolve(answers.admitRun);
    },
    performLap: () => {
      calls.push("performLap");
      return Promise.resolve(answers.performLap);
    },
    showGate: (_plan: RunPlan, gateId: string) => {
      calls.push(`showGate:${gateId}`);
      return Promise.resolve(answers.showGate);
    },
  };
  return { ports, store, calls, answers };
}

/** The five effect names, for asserting that none of them was driven. */
const EFFECT_CALLS = ["classify", "startContinuo", "admitRun", "performLap", "showGate"];

function effectCalls(calls: readonly string[]): string[] {
  return calls.filter((call) => EFFECT_CALLS.some((name) => call.startsWith(name)));
}

// --- the plan ----------------------------------------------------------------

const CATALOG_LAYER: CatalogLayer = {
  layer: "repo",
  origin: "test fixture",
  baseDir: "/srv/rondo/catalog",
  data: {},
};

const AGENT_TYPE_INPUT: AgentTypeInput = {
  agentTypeId: "worker-basic",
  vocabularyVersion: 1,
  granted: ["command.run"],
  askable: ["branch.push"],
  loopPolicy: { maxReviewRounds: 2, noProgressWindow: 3, noProgressRepeat: 2 },
  executorPolicy: { roleName: "worker", modelTier: "standard", reportingDuties: [] },
};

/**
 * The model every successful lap in this file both asks for and reports.
 *
 * One constant for both halves of the pair, because the interpreter's check is
 * that they are equal: a case that wants them to differ says so at its own site,
 * and every other case is about something else.
 */
const MODEL = "claude-opus-5";

/** The grantee is the run id: `runPlan` refuses any other value. */
const PARTIES: IssuanceParties = { issuer: "rondo-host", grantee: "run-1" };

const INTENDED_ACTION: IntendedAction = { capabilities: ["command.run"] };

/**
 * One complete, valid plan.
 *
 * Built through `runPlan` rather than cast into shape: the interpreter reads the
 * plan back out of the row through `readPlan`, which re-runs the whole
 * validation, so a fixture that skipped it would fail every case for a reason
 * that had nothing to do with the interpreter.
 */
const PLAN: RunPlan = (() => {
  const outcome = runPlan({
    db: "/srv/rondo/control.db",
    runId: "run-1",
    leaseClaimantId: "rondo-host",
    workspace: "/srv/rondo/work/run-1",
    baseBranch: "main",
    topicBranch: "topic/run-1",
    prompt: "do the thing",
    repository: "/srv/rondo/repo",
    artifactRoot: "/srv/rondo/artifacts",
    stateRoot: "/srv/rondo/state",
    interlockRoot: "/srv/rondo/interlock",
    claudeOrgPath: "/srv/rondo/claude-org",
    endpointRecipient: "external-notify",
    endpointDestinationDir: "/srv/rondo/outbox",
    claudeCommand: ["/usr/bin/claude"],
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
    invocationCeilingMs: 1_800_000,
    catalogLayers: [CATALOG_LAYER],
    projectName: "rondo",
    agentTypeInput: AGENT_TYPE_INPUT,
    parties: PARTIES,
    intendedAction: INTENDED_ACTION,
  });
  if (outcome.kind !== "planned") {
    throw new Error(`the fixture plan is not a plan: ${outcome.reason}`);
  }
  return outcome.plan;
})();

/** One admission, with the fixture plan and a policy that permits it. */
function admitOnce(h: Harness, id = "i-0001"): Promise<ConductorReport> {
  return admit(h.ports, PLAN, PERMISSIVE, id);
}

/**
 * The row a case wants to look at, or null when there is none.
 *
 * A case that asks for a row it seeded as corrupt has made a mistake -- the
 * refusal is what the interpreter is under test about, not what an assertion
 * reads through -- so this throws rather than returning something to assert on.
 */
async function readRow(store: FakeStore, id: string): Promise<IterationRecord | null> {
  const found = await store.read(id);
  switch (found.kind) {
    case "read":
      return found.record;
    case "absent":
      return null;
    case "unreadable":
      throw new Error(`the fake refused to decode row ${found.id}: ${found.reason}`);
  }
}

/** Whether any line of a report contains this fragment. */
function says(report: ConductorReport, fragment: string): boolean {
  return report.lines.some((line) => line.includes(fragment));
}

// --- the arc -----------------------------------------------------------------

test("a whole successful admission commits the arc's states in order", async () => {
  const h = harness();
  const report = await admitOnce(h);

  expect(h.store.path()).toEqual([
    "planned->classified",
    "classified->admitting",
    "admitting->admitted",
    "admitted->performing",
    "performing->awaiting_human",
  ]);
  expect(report.status).toBe("awaiting_human");
  expect(report.iterationId).toBe("i-0001");
  expect(says(report, "suspending")).toBe(true);
});

test("the conductor returns at the open gate and does not observe it", async () => {
  // D-0019 rule 5: no timer, no poll loop, no in-memory continuation. The
  // observation is `resume()`'s, from outside, later.
  const h = harness();
  await admitOnce(h);
  expect(effectCalls(h.calls)).toEqual([
    "classify",
    "startContinuo",
    "admitRun:worker",
    "performLap",
  ]);
});

test("the row at the open gate carries the gate, the session and the walk's name", async () => {
  const h = harness();
  await admitOnce(h);
  const row = await readRow(h.store, "i-0001");
  expect(row?.gateId).toBe("gate-1");
  expect(row?.sessionId).toBe("session-1");
  // `sessionPath` is the walk's own name and not a filesystem path.
  expect(row?.sessionPath).toBe("started");
  expect(row?.continuoRole).toBe("worker");
  expect(row?.neutralRoleName).toBe("worker");
});

test("what a lap reported that the row has no column for is not lost", async () => {
  const h = harness({
    performLap: {
      kind: "answered",
      value: {
        runId: "run-1",
        gateId: "gate-1",
        sessionId: "session-1",
        sessionPath: "resumed",
        endpointLeaseFailure: "outbox-delivery held by another claimant",
        elapsedDeadlineAtMs: 42,
        model: MODEL,
        requestedModel: MODEL,
      },
    },
  });
  const report = await admitOnce(h);
  const row = await readRow(h.store, "i-0001");
  expect(row?.reason).toContain("outbox-delivery held by another claimant");
  expect(row?.reason).toContain("42");
  expect(says(report, "endpoint lease failure")).toBe(true);
});

test("the gate id survives a commit another writer blocked", async () => {
  // The lap answered and named a gate; an operator abandoned the row while it
  // was walking, so the suspend cannot be committed. The gate is open in
  // continuo all the same, and only a person can close it -- so the id rondo
  // learned has to reach the report even though it never reached the row.
  const h = harness();
  h.store.beforeTransitionTo = {
    to: "awaiting_human",
    hook: () => {
      h.store.seed({ ...blankRecord("i-0001", "abandoned"), reason: "an operator settled it" });
    },
  };

  const report = await admitOnce(h);
  expect(report.status).toBe("abandoned");
  expect(says(report, "another writer moved it")).toBe(true);
  expect(says(report, "gate-1")).toBe(true);
  expect(says(report, "session-1")).toBe(true);
  // Not claimed, because it did not happen: nothing is suspended at a gate the
  // row does not carry.
  expect(says(report, "suspending")).toBe(false);
});

// --- the write order ---------------------------------------------------------

test("the observed revision and the run id are committed before run admit is called", async () => {
  // Asserted on the call order and not on the final row: the final row is
  // equally consistent with the reverse order, and the reverse order is the one
  // that leaves a run continuo knows about and rondo does not.
  const h = harness();
  await admitOnce(h);

  const committed = h.calls.indexOf("transition:classified->admitting");
  const admitted = h.calls.indexOf("admitRun:worker");
  expect(committed).toBeGreaterThanOrEqual(0);
  expect(admitted).toBeGreaterThan(committed);
  expect(h.calls.indexOf("startContinuo")).toBeLessThan(committed);
});

test("nothing is classified before the row that will explain it exists", async () => {
  const h = harness();
  await admitOnce(h);
  expect(h.calls.indexOf("reserve")).toBeLessThan(h.calls.indexOf("classify"));
});

test("the lap is sent only after 'performing' is committed", async () => {
  const h = harness();
  await admitOnce(h);
  expect(h.calls.indexOf("transition:admitted->performing")).toBeLessThan(
    h.calls.indexOf("performLap"),
  );
});

// --- every refusal branch ----------------------------------------------------

test("a classification cadenza refused ends the iteration at abandoned", async () => {
  const h = harness({ classify: { kind: "refused", message: "ProjectNotFoundError: no 'rondo'" } });
  const report = await admitOnce(h);
  expect(report.status).toBe("abandoned");
  expect(h.store.path()).toEqual(["planned->abandoned"]);
  // cadenza's own words, relayed rather than translated.
  expect(says(report, "ProjectNotFoundError: no 'rondo'")).toBe(true);
});

test("a refused action ends at abandoned, which is not a failure", async () => {
  const h = harness({
    classify: {
      kind: "answered",
      value: {
        outcome: "refused",
        reason: "no_capability",
        agentTypeDigest: "sha256:agent",
        configDigest: "sha256:config",
        contractDigest: "sha256:contract",
        neutralRoleName: "worker",
        modelTier: "standard",
      },
    },
  });
  const report = await admitOnce(h);
  expect(report.status).toBe("abandoned");
  const row = await readRow(h.store, "i-0001");
  // The digests are committed even though the request ends here: they are what
  // says which contract produced the refusal.
  expect(row?.contractDigest).toBe("sha256:contract");
  expect(row?.classification).toBe("refused");
  expect(effectCalls(h.calls)).toEqual(["classify"]);
});

test("needs_approval ends at abandoned too, and never at awaiting_human", async () => {
  // Spelling it `awaiting_human` would be wrong twice: there is no gate for
  // resume() to observe, and the status is non-terminal, so the first askable
  // request would hold the single-flight lock with no event able to release it.
  const h = harness({
    classify: {
      kind: "answered",
      value: {
        outcome: "needs_approval",
        reason: "askable",
        agentTypeDigest: "sha256:agent",
        configDigest: "sha256:config",
        contractDigest: "sha256:contract",
        neutralRoleName: "worker",
        modelTier: "standard",
      },
    },
  });
  const report = await admitOnce(h);
  expect(report.status).toBe("abandoned");
  expect(h.store.path()).toEqual(["planned->abandoned"]);
  expect(says(report, "needs_approval")).toBe(true);
});

test("a continuo build that will not verify ends at failed with nothing spawned", async () => {
  const h = harness({
    startContinuo: { kind: "refused", message: "revision mismatch: expected 44f6, saw dead" },
  });
  const report = await admitOnce(h);
  expect(report.status).toBe("failed");
  expect(h.store.path()).toEqual(["planned->classified", "classified->failed"]);
  expect(effectCalls(h.calls)).toEqual(["classify", "startContinuo"]);
  expect(says(report, "revision mismatch: expected 44f6, saw dead")).toBe(true);
});

test("a run continuo refused ends at failed, in continuo's own words", async () => {
  const h = harness({ admitRun: { kind: "refused", message: "run id already admitted" } });
  const report = await admitOnce(h);
  expect(report.status).toBe("failed");
  expect(h.store.path()).toEqual([
    "planned->classified",
    "classified->admitting",
    "admitting->failed",
  ]);
  expect(says(report, "run id already admitted")).toBe(true);
});

test("an admission that answered nothing keeps the row at admitting and keeps the lock", async () => {
  const h = harness({ admitRun: { kind: "noAnswer", reason: "the ceiling fired" } });
  const report = await admitOnce(h);
  expect(report.status).toBe("admitting");
  const row = await readRow(h.store, "i-0001");
  expect(row?.status).toBe("admitting");
  expect(row?.reason).toContain("the ceiling fired");
  expect(says(report, "abandon()")).toBe(true);

  // The lock is still held: a second request is refused by the store's own rule.
  const second = await admitOnce(h, "i-0002");
  expect(second.iterationId).toBeNull();
  expect(second.status).toBeNull();
});

test("a lap that answered a refusal ends at failed and releases the lock", async () => {
  const h = harness({ performLap: { kind: "refused", message: "LeaseHeld: outbox-delivery" } });
  const report = await admitOnce(h);
  expect(report.status).toBe("failed");
  expect(h.store.path().at(-1)).toBe("performing->failed");
  expect(says(report, "LeaseHeld: outbox-delivery")).toBe(true);

  // An answer means the child is over, so the conductor is free again.
  const second = await admitOnce(h, "i-0002");
  expect(second.iterationId).toBe("i-0002");
});

test("a refusal that names its session writes the id to the row it failed", async () => {
  // `continuo D-1102` puts the session on a `lap perform` refusal as a field of
  // its own, and this is what rondo does with it: a failed lap is as findable
  // afterwards as a suspended one. The column has always been there; before
  // this it was written only on the path that suspends.
  const h = harness({
    performLap: {
      kind: "refused",
      message: "LapRefused: the turn outlived --turn-timeout-ms",
      sessionId: "session-9",
    },
  });
  const report = await admitOnce(h);

  expect(report.status).toBe("failed");
  const row = await readRow(h.store, "i-0001");
  expect(row?.sessionId).toBe("session-9");
  expect(row?.reason).toContain("the turn outlived");
  // Named in the report as well as written to the row, for the reason the gate
  // id is: an identity rondo learned about and never said is a worker that may
  // still be running with nobody able to name it.
  expect(says(report, "session-9")).toBe(true);
});

test("a refusal that names no session leaves the column null rather than guessing", async () => {
  // The refusal quotes an id in its sentence, as continuo's messages always
  // have, and rondo records nothing: the message is written for a person and is
  // never the source of identity (D-0015 rule 7).
  const h = harness({
    performLap: {
      kind: "refused",
      message: "IdentityUnconfirmed: the identity 'session-9' was committed and never confirmed",
    },
  });
  const report = await admitOnce(h);

  expect(report.status).toBe("failed");
  const row = await readRow(h.store, "i-0001");
  expect(row?.sessionId).toBeNull();
  expect(says(report, "session-9")).toBe(true);
  // The id reaches the operator only inside continuo's own sentence, which
  // rondo relayed whole. No line of rondo's own claims it as the session.
  expect(says(report, "continuo names the session")).toBe(false);
});

test("a lap that hit a rondo defect has no session to name", async () => {
  const h = harness({ performLap: { kind: "defect", reason: "rondo called continuo wrong" } });
  const report = await admitOnce(h);

  expect(report.status).toBe("failed");
  expect((await readRow(h.store, "i-0001"))?.sessionId).toBeNull();
  expect(says(report, "continuo names the session")).toBe(false);
});

test("a lap that answered nothing stays performing, keeps the lock, and is a rondo defect", async () => {
  const h = harness({ performLap: { kind: "noAnswer", reason: "rondo's ceiling fired" } });
  const report = await admitOnce(h);

  expect(report.status).toBe("performing");
  const row = await readRow(h.store, "i-0001");
  expect(row?.status).toBe("performing");
  expect(row?.reason).toContain("rondo's ceiling fired");
  // Never reported as a lap that failed: nothing came back, so rondo knows
  // nothing about what is or is not still running.
  expect(says(report, "rondo defect requiring a human")).toBe(true);
  expect(says(report, "gate list")).toBe(true);

  const second = await admitOnce(h, "i-0002");
  expect(second.iterationId).toBeNull();
});

// --- resume ------------------------------------------------------------------

test("resume on a gate that is still open changes nothing and says so", async () => {
  const h = harness();
  await admitOnce(h);
  const before = h.store.path().length;

  const report = await resume(h.ports, "i-0001");
  expect(report.status).toBe("awaiting_human");
  expect(h.store.path().length).toBe(before);
  expect(says(report, "still open")).toBe(true);
});

test("resume after the gate closes writes once, however many times it is called", async () => {
  const h = harness();
  await admitOnce(h);
  h.answers.showGate = {
    kind: "answered",
    value: { gateId: "gate-1", stage: "answered", outcome: "approved" },
  };

  const first = await resume(h.ports, "i-0001");
  expect(first.status).toBe("closed");
  const second = await resume(h.ports, "i-0001");
  expect(second.status).toBe("closed");

  expect(h.store.path().filter((move) => move.endsWith("->closed"))).toEqual([
    "awaiting_human->closed",
  ]);
  // The second call did not even look at the gate: a `closed` row owes a
  // report, not an observation, so the idempotence is not "observe again and
  // write the same thing" -- it is "do not observe again at all".
  expect(h.calls.filter((call) => call.startsWith("showGate")).length).toBe(1);
});

test("the report on a closed iteration says publishing is the operator's", async () => {
  const h = harness();
  await admitOnce(h);
  h.answers.showGate = {
    kind: "answered",
    value: { gateId: "gate-1", stage: "answered", outcome: "approved" },
  };
  const report = await resume(h.ports, "i-0001");

  expect(says(report, "still 'created'")).toBe(true);
  expect(says(report, "Nothing was pushed")).toBe(true);
  expect(says(report, "D-0010")).toBe(true);
  expect(says(report, "44f62336")).toBe(true);
});

test("resume serves withdrawal_requested on the identical observation", async () => {
  const h = harness();
  await admitOnce(h);
  await requestWithdrawal(h.ports, "i-0001", "the operator changed their mind");

  const open = await resume(h.ports, "i-0001");
  expect(open.status).toBe("withdrawal_requested");

  h.answers.showGate = {
    kind: "answered",
    value: { gateId: "gate-1", stage: "closed", outcome: "withdrawn" },
  };
  const closed = await resume(h.ports, "i-0001");
  expect(closed.status).toBe("closed");
  expect(h.store.path().at(-1)).toBe("withdrawal_requested->closed");
});

test("a gate that could not be observed leaves the row exactly where it was", async () => {
  // A failed observation is not a fact about the gate, and `gate show` only
  // observes, so retrying is safe where re-admitting and re-performing are not.
  const h = harness();
  await admitOnce(h);
  h.answers.showGate = { kind: "defect", reason: "the decoder could not read the answer" };

  const report = await resume(h.ports, "i-0001");
  expect(report.status).toBe("awaiting_human");
  expect(h.store.path().at(-1)).toBe("performing->awaiting_human");
});

test("an observation about a different gate is never written as a closed row", async () => {
  // The symmetric case of the run-id check in `admitStep`, and it matters more:
  // what follows a non-null outcome is `closed`, which is terminal and releases
  // the lock. Ending an iteration on a fact about something else is the one
  // thing that must not happen here.
  const h = harness();
  await admitOnce(h);
  h.answers.showGate = {
    kind: "answered",
    value: { gateId: "gate-9", stage: "answered", outcome: "approved" },
  };

  const report = await resume(h.ports, "i-0001");
  expect(report.status).toBe("stalled");
  expect(h.store.path().at(-1)).toBe("awaiting_human->stalled");
  expect(says(report, "different gates")).toBe(true);
});

// --- restart -----------------------------------------------------------------

test("a restart that finds a performing row stops and reports without acting", async () => {
  const h = harness();
  h.store.seed({ ...blankRecord("i-0001", "performing"), runId: "run-1" });

  const report = await resume(h.ports, "i-0001");
  expect(report.status).toBe("performing");
  expect((await readRow(h.store, "i-0001"))?.status).toBe("performing");
  expect(effectCalls(h.calls)).toEqual([]);
  expect(h.store.path()).toEqual([]);
  expect(says(report, "single-flight lock")).toBe(true);
});

test("a restart that finds an admitting row stops and reports without re-admitting", async () => {
  const h = harness();
  h.store.seed({ ...blankRecord("i-0001", "admitting"), runId: "run-1" });

  const report = await resume(h.ports, "i-0001");
  expect(report.status).toBe("admitting");
  expect(effectCalls(h.calls)).toEqual([]);
});

test("a restart that finds a classified row resumes normally", async () => {
  // Nothing external has been sent from `classified`, so this is the branch
  // that may proceed.
  const h = harness();
  h.store.seed({
    ...blankRecord("i-0001", "classified"),
    neutralRoleName: "worker",
    modelTier: "standard",
  });

  const report = await resume(h.ports, "i-0001");
  expect(report.status).toBe("awaiting_human");
  expect(h.store.path()).toEqual([
    "classified->admitting",
    "admitting->admitted",
    "admitted->performing",
    "performing->awaiting_human",
  ]);
});

// --- single-flight -----------------------------------------------------------

test("a second admission while an iteration is live is refused and writes nothing", async () => {
  const h = harness();
  await admitOnce(h);

  const second = await admitOnce(h, "i-0002");
  expect(second.iterationId).toBeNull();
  expect(second.status).toBeNull();
  expect(says(second, "i-0001")).toBe(true);
  expect(await readRow(h.store, "i-0002")).toBeNull();
});

test("each terminal status frees the conductor for the next admission", async () => {
  // One case per terminal status, driven through the interpreter rather than
  // seeded, so what is asserted is that the *arc* reaches them.
  const scenarios: readonly (readonly [IterationStatus, Partial<Answers>])[] = [
    ["abandoned", { classify: { kind: "refused", message: "cadenza said no" } }],
    ["failed", { startContinuo: { kind: "refused", message: "build unverified" } }],
    ["closed", {}],
  ];
  for (const [expected, overrides] of scenarios) {
    const h = harness(overrides);
    const first = await admitOnce(h);
    if (expected === "closed") {
      h.answers.showGate = {
        kind: "answered",
        value: { gateId: "gate-1", stage: "answered", outcome: "approved" },
      };
      await resume(h.ports, "i-0001");
    } else {
      expect(first.status).toBe(expected);
    }
    expect((await readRow(h.store, "i-0001"))?.status).toBe(expected);

    const second = await admitOnce(h, "i-0002");
    expect(second.iterationId).toBe("i-0002");
  }
});

// --- the abort edge ----------------------------------------------------------

test("a withdrawal is asked for, recorded, and drives no continuo verb", async () => {
  const h = harness();
  await admitOnce(h);
  const before = effectCalls(h.calls).length;

  const report = await requestWithdrawal(h.ports, "i-0001", "the request was wrong");
  expect(report.status).toBe("withdrawal_requested");
  const row = await readRow(h.store, "i-0001");
  expect(row?.gateId).toBe("gate-1");
  expect(row?.reason).toBe("the request was wrong");
  // rondo never writes the outcome and never drives the verb (D-0013).
  expect(row?.gateOutcome).toBeNull();
  expect(effectCalls(h.calls).length).toBe(before);
  expect(says(report, "gate close --outcome withdrawn")).toBe(true);
});

test("a withdrawal may only be asked for where a gate is open", async () => {
  const h = harness();
  h.store.seed(blankRecord("i-0001", "performing"));

  const report = await requestWithdrawal(h.ports, "i-0001", "no gate here");
  expect(report.status).toBe("performing");
  expect(h.store.path()).toEqual([]);
  expect(says(report, "abandon()")).toBe(true);
});

test("abandon writes a terminal row from a non-terminal one and drives no verb", async () => {
  const h = harness();
  h.store.seed({ ...blankRecord("i-0001", "stalled"), reason: "a row nobody understood" });

  const report = await abandon(h.ports, "i-0001", "settled by hand");
  expect(report.status).toBe("abandoned");
  expect(h.store.path()).toEqual(["stalled->abandoned"]);
  expect(effectCalls(h.calls)).toEqual([]);
  expect(says(report, "No continuo verb was driven")).toBe(true);
});

test("abandon on an already terminal row writes nothing", async () => {
  const h = harness();
  h.store.seed(blankRecord("i-0001", "closed"));

  const report = await abandon(h.ports, "i-0001", "again");
  expect(report.status).toBe("closed");
  expect(h.store.path()).toEqual([]);
});

test("a withdrawal keeps what the lap already recorded on the row", async () => {
  // `reason` is one column shared by every writer that has free text, and the
  // endpoint lease failure a lap reported is exactly what a person reading a
  // withdrawn iteration needs. A writer that replaced the column would lose it.
  const h = harness({
    performLap: {
      kind: "answered",
      value: {
        runId: "run-1",
        gateId: "gate-1",
        sessionId: "session-1",
        sessionPath: "started",
        endpointLeaseFailure: "outbox-delivery held by another claimant",
        elapsedDeadlineAtMs: null,
        model: MODEL,
        requestedModel: MODEL,
      },
    },
  });
  await admitOnce(h);

  await requestWithdrawal(h.ports, "i-0001", "the request was wrong");
  const row = await readRow(h.store, "i-0001");
  expect(row?.reason).toContain("outbox-delivery held by another claimant");
  expect(row?.reason).toContain("the request was wrong");
});

// --- a row the store cannot read ---------------------------------------------

/** A row that is there, holds the lock, and will not decode. */
const CORRUPT_REASON = "status 'gremlin' is not one of the eleven";

function corruptHarness(status: IterationStatus = "performing"): Harness {
  const h = harness();
  h.store.seedCorrupt({ ...blankRecord("i-0001", status), runId: "run-1" }, CORRUPT_REASON);
  return h;
}

test("resume on a row that will not decode reports rather than rejecting", async () => {
  // Before the store became total this rejected, and the interpreter's stall
  // path -- which `records.ts` says `stalled` exists for -- was unreachable
  // against the real store while looking covered here.
  const h = corruptHarness();

  const report = await resume(h.ports, "i-0001");
  expect(report.iterationId).toBe("i-0001");
  expect(report.status).toBeNull();
  expect(says(report, CORRUPT_REASON)).toBe(true);
  expect(says(report, "abandon()")).toBe(true);
  expect(says(report, "single-flight lock")).toBe(true);
  expect(h.store.path()).toEqual([]);
  expect(effectCalls(h.calls)).toEqual([]);
});

test("requestWithdrawal on a row that will not decode reports and names abandon", async () => {
  const h = corruptHarness("awaiting_human");

  const report = await requestWithdrawal(h.ports, "i-0001", "the request was wrong");
  expect(report.status).toBeNull();
  expect(says(report, CORRUPT_REASON)).toBe(true);
  expect(says(report, "abandon()")).toBe(true);
  expect(h.store.path()).toEqual([]);
  expect(effectCalls(h.calls)).toEqual([]);
});

test("abandon settles a row it cannot read, and the lock is genuinely released", async () => {
  // The last row of D-0019 rule 10's table, on the rows that need it most.
  // `transition` cannot help here -- it answers `defect` on a row whose status
  // will not decode -- so `settle` is the only write left, and if it did not
  // exist this conductor would never run again.
  const h = corruptHarness();

  const report = await abandon(h.ports, "i-0001", "settled by hand");
  expect(report.status).toBe("abandoned");
  expect(h.calls).toContain("settle");
  expect(says(report, "by id alone")).toBe(true);
  const row = await readRow(h.store, "i-0001");
  expect(row?.status).toBe("abandoned");
  // Why the status-blind write was used is on the row, not only in the report.
  expect(row?.reason).toContain(CORRUPT_REASON);
  expect(row?.reason).toContain("settled by hand");

  // Asserted on a fresh admission rather than on the call returning: the lock is
  // the partial unique index, and what proves it was released is the store
  // accepting a reservation it would otherwise refuse.
  const second = await admitOnce(h, "i-0002");
  expect(second.iterationId).toBe("i-0002");
  expect(second.status).toBe("awaiting_human");
});

test("settle is reached from nowhere but a row that would not decode", async () => {
  // The licence is narrow because exactly one branch of one function uses it. A
  // whole arc, an observation, a withdrawal and an abandon on readable rows go
  // through `transition`, which asserts the status it is leaving.
  const h = harness();
  await admitOnce(h);
  await resume(h.ports, "i-0001");
  await requestWithdrawal(h.ports, "i-0001", "the request was wrong");
  await abandon(h.ports, "i-0001", "settled by hand");
  expect(h.calls).not.toContain("settle");
});

// --- D-0019 rule 10's releasing-event table, a case per row ------------------

/**
 * How each non-terminal status is driven to its release, through the
 * interpreter.
 *
 * Typed as a total record over `NonTerminalStatus`, which is the compile-time
 * half: a status added to the union without an entry here is a type error. The
 * runtime half is below -- each driver actually takes the named event and
 * returns the status the row reached, so an entry that names an event which
 * does not in fact leave the status fails rather than passing by being written
 * down.
 */
const RELEASE_DRIVERS: Readonly<Record<NonTerminalStatus, () => Promise<IterationStatus>>> = {
  planned: () => leavingStatusInArc("planned"),
  classified: () => leavingStatusInArc("classified"),
  admitting: () => leavingStatusInArc("admitting"),
  admitted: () => leavingStatusInArc("admitted"),
  performing: () => leavingStatusInArc("performing"),
  awaiting_human: async () => {
    const h = harness();
    await admitOnce(h);
    h.answers.showGate = {
      kind: "answered",
      value: { gateId: "gate-1", stage: "answered", outcome: "approved" },
    };
    await resume(h.ports, "i-0001");
    return statusLeft(h.store, "awaiting_human");
  },
  withdrawal_requested: async () => {
    const h = harness();
    await admitOnce(h);
    await requestWithdrawal(h.ports, "i-0001", "withdrawn by the operator");
    h.answers.showGate = {
      kind: "answered",
      value: { gateId: "gate-1", stage: "closed", outcome: "withdrawn" },
    };
    await resume(h.ports, "i-0001");
    return statusLeft(h.store, "withdrawal_requested");
  },
  stalled: async () => {
    const h = harness();
    h.store.seed(blankRecord("i-0001", "stalled"));
    await abandon(h.ports, "i-0001", "an operator settled it");
    return statusLeft(h.store, "stalled");
  },
};

/** The five statuses one successful admission passes through and leaves. */
async function leavingStatusInArc(status: IterationStatus): Promise<IterationStatus> {
  const h = harness();
  await admitOnce(h);
  return statusLeft(h.store, status);
}

/** The status the row moved to when it left `status`, or the status itself. */
function statusLeft(store: FakeStore, status: IterationStatus): IterationStatus {
  const move = store.moves.find((candidate) => candidate.from === status);
  return move === undefined ? status : move.to;
}

test("every non-terminal status has an event in the interpreter that leaves it", async () => {
  // D-0019 rule 10's table, driven rather than restated: under the partial
  // unique index a non-terminal state nobody can leave is a conductor that
  // never runs again, so a status added later with no releasing event has to
  // fail here.
  const covered = Object.keys(RELEASED_BY) as NonTerminalStatus[];
  expect(covered.length).toBe(8);

  for (const status of covered) {
    const reached = await RELEASE_DRIVERS[status]();
    expect(reached, `nothing leaves '${status}'`).not.toBe(status);
    expect(RELEASED_BY[status].length).toBeGreaterThan(0);
  }
});

test("the two no-answer rows of that table hold their status on purpose", async () => {
  // The pair worth reading twice: an effect that answered releases the lock and
  // an effect that answered nothing does not. Their release is the operator's
  // abandon(), which the row above already drives for `stalled`; here it is
  // driven for these two.
  for (const [held, overrides] of [
    ["admitting", { admitRun: { kind: "noAnswer", reason: "silence" } }],
    ["performing", { performLap: { kind: "noAnswer", reason: "silence" } }],
  ] as const) {
    const h = harness(overrides);
    await admitOnce(h);
    expect((await readRow(h.store, "i-0001"))?.status).toBe(held);

    const settled = await abandon(h.ports, "i-0001", "an operator settled it");
    expect(settled.status).toBe("abandoned");
    // abandon() drives no continuo verb, and there is no gate id on either row
    // for it to have named one about.
    expect(h.calls.some((call) => call.startsWith("showGate"))).toBe(false);
  }
});

// --- what cannot be classified halts and asks -------------------------------

test("a policy stop takes no lock and writes no row", async () => {
  const h = harness();
  const report = await admit(h.ports, PLAN, CONSERVATIVE_POLICY, "i-0001");

  expect(report.iterationId).toBeNull();
  expect(report.status).toBeNull();
  expect(h.calls).toEqual([]);
  expect(h.store.rows.size).toBe(0);
});

test("a plan payload that will not read back stalls rather than proceeding", async () => {
  const h = harness();
  h.store.seed({ ...blankRecord("i-0001", "planned"), plan: { db: 7 } });

  const report = await resume(h.ports, "i-0001");
  expect(report.status).toBe("stalled");
  expect(effectCalls(h.calls)).toEqual([]);
  expect(says(report, "will not read back")).toBe(true);
});

test("a status the union does not cover stalls, and never awaits a human", async () => {
  const h = harness();
  h.store.seed({ ...blankRecord("i-0001", "half_done" as IterationStatus) });

  const report = await resume(h.ports, "i-0001");
  // `awaiting_human` would promise a gate that does not exist; a terminal
  // status would release the lock on an iteration nobody understood.
  expect(report.status).toBe("stalled");
  expect(h.store.path()).toEqual(["half_done->stalled"]);
});

test("an effect result in a shape the union does not cover stalls too", async () => {
  // The runtime half of the exhaustive switch: the value came through a port,
  // and a port is implemented by an adapter TypeScript did not check at the
  // boundary.
  const h = harness({
    classify: { kind: "maybe" } as unknown as EffectOutcome<ClassificationRecord>,
  });
  const report = await admitOnce(h);
  expect(report.status).toBe("stalled");
  expect(says(report, "does not cover")).toBe(true);
});

test("a row moved by another writer stops the call rather than being forced", () => {
  return (async () => {
    const h = harness();
    await admitOnce(h);
    h.answers.showGate = {
      kind: "answered",
      value: { gateId: "gate-1", stage: "answered", outcome: "approved" },
    };
    // Another writer settles the iteration between this call's read and its
    // write, which is exactly what `unexpectedStatus` reports.
    h.store.beforeTransition = () => {
      h.store.seed({ ...blankRecord("i-0001", "abandoned"), gateId: "gate-1" });
    };

    const report = await resume(h.ports, "i-0001");
    expect(report.status).toBe("abandoned");
    expect(says(report, "another writer moved it")).toBe(true);
    // Not retried and not forced: the state this call reasoned from is gone.
    expect(h.store.path().at(-1)).toBe("performing->awaiting_human");
    expect((await readRow(h.store, "i-0001"))?.status).toBe("abandoned");
  })();
});

test("resume on an iteration that does not exist says so and writes nothing", async () => {
  const h = harness();
  const report = await resume(h.ports, "i-0404");
  expect(report.iterationId).toBe("i-0404");
  expect(report.status).toBeNull();
  expect(h.store.rows.size).toBe(0);
});

test("the row's request text is the plan's prompt, with no second way to supply it", async () => {
  // `admit` used to take a `request` argument beside the plan, so the durable
  // row could record what a person asked for while `run admit` sent the plan's
  // prompt to continuo -- an audit record describing different work from the
  // work the worker did, with nothing able to notice. There is one source now,
  // and this pins it: the column and the argv come from the same field.
  const h = harness();
  await admitOnce(h);
  const row = await readRow(h.store, "i-0001");
  expect(row?.request).toBe(PLAN.prompt);
});

test("abandon() refuses while this process is still driving the iteration", async () => {
  // D-0019 rule 11 gives abandon() a `performing` row **with no answer** -- one
  // a restart found, or one whose invocation gave up -- and there releasing the
  // lock is the operator's assertion that nothing of theirs is running. An
  // operator calling it while `performLap` is still awaited HERE is asserting
  // something rondo can see is false: the row would go terminal at once, a
  // second iteration could be reserved against a worker still writing to the
  // same worktree, and the later `performing -> awaiting_human` write would
  // find `unexpectedStatus` with no way to put the lock back.
  let releaseLap: (() => void) | null = null;
  const lapIsWalking = new Promise<void>((resolve) => {
    releaseLap = resolve;
  });
  const base = harness();
  const answered = base.answers.performLap;
  // The ports are readonly, so the slow lap is substituted by building a new
  // record around the harness's rather than by assigning into it: the store,
  // the call log and every other answer stay the harness's own, which is what
  // keeps the case about the guard and not about a second fake.
  const h: Harness = {
    ...base,
    ports: {
      ...base.ports,
      performLap: async () => {
        base.calls.push("performLap");
        releaseLap?.();
        // Slow rather than never-resolving: the window is what the case is
        // about, and the second half needs the call to finish.
        await new Promise((resolve) => setTimeout(resolve, 25));
        return answered;
      },
    },
  };

  const walking = admitOnce(h);
  await lapIsWalking;

  const refused = await abandon(h.ports, "i-0001", "an operator gave up");
  expect(refused.status).toBe("performing");
  expect(refused.lines.join(" ")).toContain("being driven by this process");
  expect((await readRow(h.store, "i-0001"))?.status).toBe("performing");

  // And once the call in flight has returned, the row is settleable again --
  // the guard is a window, not a new way for a row to become unreachable.
  await walking;
  const settled = await abandon(h.ports, "i-0001", "an operator gave up");
  expect(settled.status).toBe("abandoned");
});

test("a grantee that is not the run id is refused before a row exists", async () => {
  // The one cross-field rule the dogfood paid a whole iteration for (F-6):
  // cadenza would answer the mismatch as `grantee_mismatch`, an *answered*
  // classification, only after `reserve` had committed a row and taken the
  // single-flight lock. Refused at the plan, nothing is reserved and no port
  // is called, and the very next admission with the grantee corrected succeeds.
  const h = harness();
  const report = await admit(
    h.ports,
    { ...PLAN, parties: { issuer: "rondo-host", grantee: "delegate-1" } },
    PERMISSIVE,
    "i-0001",
  );
  expect(report.iterationId).toBeNull();
  expect(report.lines.join(" ")).toContain("'parties.grantee'");
  expect(report.lines.join(" ")).toContain("grantee_mismatch");
  expect(h.calls).toEqual([]);
  expect(await readRow(h.store, "i-0001")).toBeNull();
  expect((await admitOnce(h)).status).toBe("awaiting_human");
});

test("an invalid plan is refused before a row exists, so it takes no lock", async () => {
  // `RunPlan` is a structural interface and `Object.freeze` is shallow, so a
  // caller can hand over something that never passed `runPlan()`. Caught only
  // by the post-commit re-read, such a plan would stall an iteration that then
  // holds the single-flight lock until a person abandoned it -- for an input
  // error knowable before any row existed. Refused here it costs nothing, and
  // the very next admission with a good plan must succeed.
  const h = harness();
  const report = await admit(
    h.ports,
    { ...PLAN, workspace: "relative/path" },
    PERMISSIVE,
    "i-0001",
  );
  expect(report.iterationId).toBeNull();
  expect(report.lines.join(" ")).toContain("before an iteration was reserved");
  expect(h.calls).toEqual([]);
  expect(await readRow(h.store, "i-0001")).toBeNull();

  expect((await admitOnce(h)).status).toBe("awaiting_human");
});

test("a lap answering for another run stalls rather than adopting its gate", async () => {
  // The check `admitStep` makes on `run admit`'s answer, applied where it
  // matters most: this answer is what supplies the gate the iteration suspends
  // on, so adopting another run's would mean a later resume() closing this
  // iteration on an outcome that was never about it.
  const h = harness({
    performLap: {
      kind: "answered",
      value: {
        runId: "run-9",
        gateId: "gate-9",
        sessionId: "session-1",
        sessionPath: "started",
        endpointLeaseFailure: null,
        elapsedDeadlineAtMs: null,
        model: MODEL,
        requestedModel: MODEL,
      },
    },
  });
  const report = await admitOnce(h);
  expect(report.status).toBe("stalled");
  expect(report.lines.join(" ")).toContain("run-9");
  expect((await readRow(h.store, "i-0001"))?.gateId).toBeNull();
});

test("a lap that ran on another model stalls, and the open gate is named first", async () => {
  // The identity check the run id gets, applied to the second identity a lap
  // answers with (D-0021). It is a stall and not terminal `failed`, because the
  // lap DID happen and a gate IS open: this is a person's question about that
  // gate, not a lap to retry -- and the gate id has to be in the report or the
  // open gate is one nobody can find.
  const h = harness({
    performLap: {
      kind: "answered",
      value: {
        runId: "run-1",
        gateId: "gate-1",
        sessionId: "session-1",
        sessionPath: "started",
        endpointLeaseFailure: null,
        elapsedDeadlineAtMs: null,
        model: "some-other-model",
        requestedModel: MODEL,
      },
    },
  });
  const report = await admitOnce(h);
  expect(report.status).toBe("stalled");
  expect(says(report, "gate-1")).toBe(true);
  expect(report.lines.join(" ")).toContain("some-other-model");
  expect(report.lines.join(" ")).toContain(MODEL);
  // Nothing about the gate is committed: the row was not moved to
  // `awaiting_human`, so a later resume() cannot close on a lap rondo could not
  // account for.
  expect((await readRow(h.store, "i-0001"))?.gateId).toBeNull();
});

test("a lap that named no model at all is the same stall, spelled for a reader", async () => {
  // `null` is continuo saying the choice fell through to the worker CLI's own
  // default -- which is exactly what rondo passes `--model` to prevent, so a
  // null here means the flag rondo believes it sent did not take effect.
  const h = harness({
    performLap: {
      kind: "answered",
      value: {
        runId: "run-1",
        gateId: "gate-1",
        sessionId: "session-1",
        sessionPath: "started",
        endpointLeaseFailure: null,
        elapsedDeadlineAtMs: null,
        model: null,
        requestedModel: MODEL,
      },
    },
  });
  const report = await admitOnce(h);
  expect(report.status).toBe("stalled");
  expect(report.lines.join(" ")).toContain("worker CLI's own default");
});

test("a clean lap records the model continuo reported, beside the tier it came from", async () => {
  // Both, because a tier is what an agent type declared and a model id is what
  // the lap cost: the pair is the only place a person can see what a tier was
  // worth on the day the lap ran.
  const h = harness();
  expect((await admitOnce(h)).status).toBe("awaiting_human");
  const row = await readRow(h.store, "i-0001");
  expect(row?.modelTier).toBe("standard");
  expect(row?.model).toBe(MODEL);
});

test("an admitted row with no model tier stalls rather than driving an unpriced lap", async () => {
  // The model tier's version of the neutral role name's check at `admitting`:
  // a row that reached here without one cannot be priced, and a lap rondo
  // cannot price is a lap it does not start.
  const h = harness();
  h.store.seed({
    ...blankRecord("i-0001", "admitted"),
    neutralRoleName: "worker",
    runId: "run-1",
  });

  const report = await resume(h.ports, "i-0001");
  expect(report.status).toBe("stalled");
  expect(report.lines.join(" ")).toContain("model tier");
});

test("a reason contained in an earlier one is still recorded", async () => {
  // The dedup compares whole entries, not substrings: an operator's "timeout"
  // must not be swallowed by an existing "endpoint lease failure: timeout after
  // 60 seconds". The reason column is the one place a person reconstructs what
  // happened afterwards, so silently dropping what they said is the failure
  // worth avoiding.
  const h = harness({
    performLap: {
      kind: "answered",
      value: {
        runId: "run-1",
        gateId: "gate-1",
        sessionId: "session-1",
        sessionPath: "started",
        endpointLeaseFailure: "timeout after 60 seconds",
        elapsedDeadlineAtMs: null,
        model: MODEL,
        requestedModel: MODEL,
      },
    },
  });
  await admitOnce(h);
  await abandon(h.ports, "i-0001", "timeout");
  const reason = (await readRow(h.store, "i-0001"))?.reason ?? "";
  expect(reason).toContain("timeout after 60 seconds");
  expect(reason.split("; ")).toContain("timeout");
});
