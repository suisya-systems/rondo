/**
 * N > 1, driven through `admit()` and `resume()` against a real store.
 *
 * Issue #8's third checkbox asks for `test/refrain` cases covering ordering,
 * refusal at capacity, and the resumption of one iteration while others are
 * performing. Two of the three are not the tests their names suggest, and this
 * file says so rather than inventing the promise the names imply.
 *
 * **These run against the real SQLite store rather than a fake**, which is the
 * opposite of the choice `interpreter.test.ts` makes and is deliberate. The
 * interpreter's own tests are about the arc a single iteration walks and a fake
 * store is the right instrument for that. What is under test *here* is the
 * interaction between the loop and the ledger -- whether the count, the bound
 * and the transaction actually compose -- and a fake store would agree with
 * whatever this file asserted about them.
 *
 * The interpreter is driven only as far as its first port, because everything
 * past `classify` needs continuo. That is enough: the capacity decision happens
 * in `reserve()`, before any port is reached, so a plan whose classification
 * refuses still exercises the whole of what these cases are about and leaves
 * the row at a terminal status the next case can reason about.
 */
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import { admit } from "../../src/refrain/interpreter.js";
import type { AdmittedPlan, RunPlan } from "../../src/refrain/plan.js";
import { admittedPlan, planPayload, runPlan } from "../../src/refrain/plan.js";
import type { HostPolicy, LoopPolicy } from "../../src/refrain/policy.js";
import type { ClassificationRecord, ConductorPorts, EffectOutcome } from "../../src/refrain/ports.js";
import { allocate } from "../../src/refrain/allocator.js";
import type { IterationStatus } from "../../src/store/records.js";
import { iterationStore } from "../../src/store/sqlite.js";

const START_POLICY: LoopPolicy = { autonomy: "ask_before_landing", maxIterations: 1 };

const PLAN: RunPlan = {
  db: "/srv/continuo.db",
  workspaceRoot: "/srv/work",
  baseBranch: "main",
  prompt: "do the thing",
  repository: "/srv/repo",
  artifactRoot: "/srv/artifacts",
  stateRoot: "/srv/state",
  interlockRoot: "/srv/interlock",
  claudeOrgPath: "/srv/claude-org",
  endpointRecipient: "external-notify",
  endpointDestinationDir: "/srv/dropbox",
  claudeCommand: ["/usr/bin/node", "/opt/claude/cli.js"],
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
  catalogLayers: [{ layer: "git_url", origin: "o", baseDir: "/srv/catalog", data: {} }],
  projectName: "rondo",
  agentTypeInput: {} as RunPlan["agentTypeInput"],
  parties: { grantor: "rondo", grantee: "unset" } as unknown as RunPlan["parties"],
  intendedAction: {} as RunPlan["intendedAction"],
};

/** The admitted plan for one id, as `admit()` itself would build it. */
const admittedFor = (id: string): AdmittedPlan => {
  const validated = runPlan(PLAN);
  if (validated.kind !== "planned") {
    throw new Error(`the fixture plan is not valid: ${validated.reason}`);
  }
  const allocation = allocate(id, PLAN.workspaceRoot);
  if (allocation.kind !== "allocated") {
    throw new Error(`the fixture id '${id}' does not allocate: ${allocation.reason}`);
  }
  const admitted = admittedPlan(validated.plan, allocation.allocation);
  if (admitted.kind !== "planned") {
    throw new Error(`the fixture allocation is not valid: ${admitted.reason}`);
  }
  return admitted.plan;
};

/**
 * Ports over a real store whose `classify` refuses.
 *
 * The refusal ends each iteration at terminal `abandoned` *after* the row is
 * reserved, which is exactly what these cases need: the reservation is the
 * thing under test, and a lap is not something a unit test may run.
 */
const portsOver = (policy: HostPolicy) => {
  const connection = new DatabaseSync(":memory:");
  const store = iterationStore(connection, policy);
  let clock = 1_000;
  const ports: ConductorPorts = {
    store,
    now: () => {
      clock += 1;
      return clock;
    },
    classify: async (): Promise<EffectOutcome<ClassificationRecord>> => ({
      kind: "answered",
      value: {
        outcome: "refused",
        reason: "the fixture refuses, so no lap is ever spawned",
        agentTypeDigest: "sha256:a",
        configDigest: "sha256:b",
        contractDigest: "sha256:c",
        neutralRoleName: "worker",
        modelTier: "standard",
      },
    }),
    startContinuo: async () => ({ kind: "answered", value: { revision: "abc1234" } }),
    admitRun: async () => ({ kind: "refused", message: "no continuo in this test" }),
    performLap: async () => ({ kind: "refused", message: "no continuo in this test" }),
    showGate: async () => ({ kind: "refused", message: "no continuo in this test" }),
  };
  return { ports, store, connection };
};

/** Put a reserved row at a status the arc cannot reach in a unit test. */
const putAt = (connection: DatabaseSync, id: string, status: IterationStatus): void => {
  connection.prepare("UPDATE iteration SET status = ? WHERE id = ?").run(status, id);
};

// ---------------------------------------------------------------------------
// Refusal at capacity, through the interpreter.
// ---------------------------------------------------------------------------

test("a second admission while one is executing is refused, and says which bound", async () => {
  const { ports, connection } = portsOver({ maxOccupying: 1, maxLive: 3 });
  await admit(ports, PLAN, START_POLICY, "iter-a");
  putAt(connection, "iter-a", "performing");

  const second = await admit(ports, PLAN, START_POLICY, "iter-b");
  expect(second.iterationId).toBeNull();
  expect(second.status).toBeNull();
  expect(second.lines.join("\n")).toContain("1 of a permitted 1");
  expect(second.lines.join("\n")).toContain("already executing");
});

test("the observed-red control: the same admission at a bound of two is accepted", async () => {
  const { ports, connection } = portsOver({ maxOccupying: 2, maxLive: 3 });
  await admit(ports, PLAN, START_POLICY, "iter-a");
  putAt(connection, "iter-a", "performing");

  const second = await admit(ports, PLAN, START_POLICY, "iter-b");
  expect(second.iterationId).toBe("iter-b");
});

test("a refused admission writes no row, so the id stays free", async () => {
  const { ports, store, connection } = portsOver({ maxOccupying: 1, maxLive: 3 });
  await admit(ports, PLAN, START_POLICY, "iter-a");
  putAt(connection, "iter-a", "performing");
  await admit(ports, PLAN, START_POLICY, "iter-b");

  expect((await store.read("iter-b")).kind).toBe("absent");
  // And the identifiers it would have claimed are unclaimed, so the same
  // request may be admitted under the same id once capacity frees.
  putAt(connection, "iter-a", "closed");
  const retried = await admit(ports, PLAN, START_POLICY, "iter-b");
  expect(retried.iterationId).toBe("iter-b");
});

test("an iteration id that is not a rondo identifier is refused before any row", async () => {
  const { ports, connection } = portsOver({ maxOccupying: 1, maxLive: 3 });
  const refused = await admit(ports, PLAN, START_POLICY, "../other");

  expect(refused.iterationId).toBeNull();
  expect(refused.lines.join("\n")).toContain("lowercase letter");
  expect(connection.prepare("SELECT COUNT(*) AS n FROM iteration").get()).toMatchObject({ n: 0 });
  // And no demand row either: this is not a host that was too busy, it is a
  // request that was not well formed, and counting it as demand would inflate
  // the evidence the bound is later raised on.
  expect(connection.prepare("SELECT COUNT(*) AS n FROM admission_refusal").get()).toMatchObject({
    n: 0,
  });
});

// ---------------------------------------------------------------------------
// Two live at once: the property D-0023 actually delivers.
// ---------------------------------------------------------------------------

test("two iterations are live at once when one of them is suspended", async () => {
  // **The whole of what this entry delivers today**, and the shape the operator
  // asked to see: one iteration suspended in front of a person, another
  // executing, both non-terminal, with no continuo change of any kind.
  const { ports, store, connection } = portsOver({ maxOccupying: 1, maxLive: 3 });
  await admit(ports, PLAN, START_POLICY, "iter-a");
  putAt(connection, "iter-a", "awaiting_human");

  const second = await admit(ports, PLAN, START_POLICY, "iter-b");
  expect(second.iterationId).toBe("iter-b");
  putAt(connection, "iter-b", "performing");

  const live = await store.readLive();
  expect(live.map((outcome) => (outcome.kind === "read" ? outcome.record.id : outcome.kind))).toEqual([
    "iter-a",
    "iter-b",
  ]);
  // One lap at a time, several questions open at once.
  const third = await admit(ports, PLAN, START_POLICY, "iter-c");
  expect(third.iterationId).toBeNull();
  expect(third.lines.join("\n")).toContain("already executing");
});

test("each live iteration keeps its own identifiers, and they do not collide", async () => {
  const { ports, store, connection } = portsOver({ maxOccupying: 1, maxLive: 3 });
  await admit(ports, PLAN, START_POLICY, "iter-a");
  putAt(connection, "iter-a", "awaiting_human");
  await admit(ports, PLAN, START_POLICY, "iter-b");

  const a = await store.read("iter-a");
  const b = await store.read("iter-b");
  expect(a.kind === "read" && a.record.runId).toBe("rondo-iter-a");
  expect(b.kind === "read" && b.record.runId).toBe("rondo-iter-b");
  expect(a.kind === "read" && a.record.workspace).toBe("/srv/work/iter-iter-a");
  expect(b.kind === "read" && b.record.workspace).toBe("/srv/work/iter-iter-b");
});

test("acting on one iteration writes nothing to another", async () => {
  // The interpreter-level half of issue #8's third case. It is the easy
  // assertion and the weak one -- the assertion that matters is the store's,
  // that two transactions do not interleave -- but it is worth pinning, because
  // a surface that resolved "the live iteration" would fail it.
  const { ports, store, connection } = portsOver({ maxOccupying: 1, maxLive: 3 });
  await admit(ports, PLAN, START_POLICY, "iter-a");
  putAt(connection, "iter-a", "awaiting_human");
  await admit(ports, PLAN, START_POLICY, "iter-b");
  putAt(connection, "iter-b", "performing");

  const before = await store.read("iter-b");
  await admit(ports, PLAN, START_POLICY, "iter-c");
  const after = await store.read("iter-b");
  expect(after).toEqual(before);
});

// ---------------------------------------------------------------------------
// Ordering: the case that pins the absence of a promise.
// ---------------------------------------------------------------------------

test("two admissions racing at the bound produce exactly one row and one refusal", async () => {
  // Not "the first caller wins" -- see the case below. The property that *is*
  // promised is that the count and the insert are atomic, so a race can never
  // produce two reservations or two refusals.
  const { ports, store, connection } = portsOver({ maxOccupying: 1, maxLive: 1 });

  const [first, second] = await Promise.all([
    admit(ports, PLAN, START_POLICY, "iter-a"),
    admit(ports, PLAN, START_POLICY, "iter-b"),
  ]);

  const reserved = [first, second].filter((report) => report.iterationId !== null);
  const refused = [first, second].filter((report) => report.iterationId === null);
  expect(reserved).toHaveLength(1);
  expect(refused).toHaveLength(1);
  expect(connection.prepare("SELECT COUNT(*) AS n FROM iteration").get()).toMatchObject({ n: 1 });
  expect((await store.readLive()).length).toBeLessThanOrEqual(1);
});

test("no ordering is promised, and starvation is possible", async () => {
  // **This case exists to record a decision rather than to defend a behaviour.**
  // Nothing in the tree queues: `admit()` refuses immediately and returns. A
  // FIFO promise would need a durable queue, a restart story for it and an
  // owner, and D-0023 rule 21 sends all three to D-0020's operating surface.
  //
  // So what is asserted is the *absence*: a refused request leaves no trace
  // that any later admission consults, which means a caller may be refused
  // arbitrarily many times while others succeed. A later reader finds a
  // decision here rather than a gap, and a future queue will fail this test,
  // which is the point.
  const { ports, connection } = portsOver({ maxOccupying: 1, maxLive: 1 });
  await admit(ports, PLAN, START_POLICY, "iter-a");
  putAt(connection, "iter-a", "performing");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    expect((await admit(ports, PLAN, START_POLICY, "iter-b")).iterationId).toBeNull();
  }
  putAt(connection, "iter-a", "closed");

  // `iter-c` arrives last and is admitted anyway: being refused three times
  // bought `iter-b` no priority whatsoever.
  expect((await admit(ports, PLAN, START_POLICY, "iter-c")).iterationId).toBe("iter-c");

  // The demand rows are the only record that anyone was ever refused, which is
  // exactly what rule 14 is for.
  expect(connection.prepare("SELECT COUNT(*) AS n FROM admission_refusal").get()).toMatchObject({
    n: 3,
  });
});

// ---------------------------------------------------------------------------
// The plan payload's own backward compatibility.
// ---------------------------------------------------------------------------

test("a plan payload written before D-0023 still reads, and keeps its own workspace", async () => {
  // The `plan` column is persisted verbatim, so adding `workspaceRoot` to
  // `RunPlan` makes older bytes fail their own re-validation -- and `readPlan`
  // runs on the way back *into* a live iteration, so the failure would arrive
  // as `stalled` on rows a person is already waiting on. The root is derived
  // from the stored workspace's parent, which is what it actually was.
  const admitted = admittedFor("iter-a");
  const payload = { ...planPayload(admitted) };
  delete (payload as Record<string, unknown>)["workspace_root"];

  const { readPlan } = await import("../../src/refrain/plan.js");
  const read = readPlan(payload);
  expect(read.kind).toBe("planned");
  if (read.kind === "planned") {
    expect(read.plan.workspace).toBe("/srv/work/iter-iter-a");
    expect(read.plan.workspaceRoot).toBe("/srv/work");
    // The identifiers come off the row rather than being re-derived, so a row
    // whose triple was not a function of its own id still reads correctly.
    expect(read.plan.runId).toBe("rondo-iter-a");
  }
});
