/**
 * The plan is validated once, at rondo's boundary, and the refusal is rondo's.
 *
 * D-0015's exception 2 measured what an operator's typo costs without this
 * file's subject: an empty `--run-id`, `--workspace`, `--base-branch`,
 * `--topic-branch` or `--lease-claimant-id` reaches rondo as **exit 1 and a raw
 * stack**, not a refusal document. D-0019 rule 3 answers that by having the
 * caller pass a complete `RunPlan` and having `runPlan()` refuse it, by field
 * name, before any process starts. So every case here is one shape of "rondo
 * said no first", and the file's real claim is that the validator is not
 * decorative -- each rule is exercised, and each refusal names the field a
 * person has to go and fix.
 *
 * The second half is the round trip. The store persists the plan **verbatim**
 * (D-0019 rule 4) as {@link planPayload}'s rendering and hands the bytes back;
 * {@link readPlan} is what turns them into a plan again, and it re-runs the
 * whole validation rather than trusting whatever wrote the row, because the row
 * may have been written by an older rondo or edited by a person. A payload that
 * will not read is what the interpreter files at `stalled`.
 */
import { expect, test } from "vitest";

import type {
  AgentTypeInput,
  CatalogLayer,
  IntendedAction,
  IssuanceParties,
} from "../../src/cadenza/facade.js";
import { planPayload, type RunPlan, readPlan, runPlan } from "../../src/refrain/plan.js";

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

const PARTIES: IssuanceParties = { issuer: "run-1", grantee: "delegate-1" };
const INTENDED_ACTION: IntendedAction = { capabilities: ["command.run"] };

/** One complete, valid plan, as a caller would hand it over. */
const VALID: RunPlan = {
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
  claudeCommand: ["/usr/bin/node", "/srv/rondo/claude.js"],
  endpointDb: null,
  endpointModule: null,
  node: null,
  hookScript: null,
  python: null,
  pollIntervalMs: null,
  turnTimeoutMs: 900_000,
  gitTimeoutMs: 60_000,
  gateOptions: ["approve", "revise"],
  gateDeadlineAtMs: null,
  invocationCeilingMs: 1_800_000,
  catalogLayers: [CATALOG_LAYER],
  projectName: "rondo",
  agentTypeInput: AGENT_TYPE_INPUT,
  parties: PARTIES,
  intendedAction: INTENDED_ACTION,
};

/** {@link VALID} with one field replaced, so each case names one rule. */
const withField = (patch: Partial<RunPlan>): RunPlan => ({ ...VALID, ...patch });

/** The reason `runPlan` gave, or a failure saying it did not refuse at all. */
function refusalFor(patch: Partial<RunPlan>): string {
  const outcome = runPlan(withField(patch));
  if (outcome.kind !== "refused") {
    throw new Error("the plan was accepted, and this case exists because it must not be");
  }
  return outcome.reason;
}

test("a complete plan is accepted and comes back frozen", () => {
  const outcome = runPlan(VALID);
  expect(outcome.kind).toBe("planned");
  if (outcome.kind !== "planned") {
    return;
  }
  // Frozen because the conductor receives one and never edits a field: a plan
  // that could be changed after validation is a plan whose validation describes
  // something else by the time it is driven.
  expect(Object.isFrozen(outcome.plan)).toBe(true);
  expect(outcome.plan.runId).toBe("run-1");
});

test("an empty operator value is refused by name, rather than reaching continuo", () => {
  // The five fields D-0015's exception 2 names as reaching continuo as a stack.
  for (const field of [
    "runId",
    "workspace",
    "baseBranch",
    "topicBranch",
    "leaseClaimantId",
  ] as const) {
    expect(refusalFor({ [field]: "" })).toContain(`'${field}'`);
  }
});

test("a NUL byte is refused before spawn could throw on it", () => {
  // `spawn` throws *synchronously* on an embedded NUL rather than emitting an
  // error event, so a value carrying one never reaches continuo at all. Refused
  // here, the message names the plan field rather than an argv position.
  expect(refusalFor({ prompt: "do\u0000the thing" })).toContain("NUL");
});

test("a path continuo requires to be absolute is refused when it is not", () => {
  for (const field of [
    "db",
    "workspace",
    "repository",
    "artifactRoot",
    "stateRoot",
    "interlockRoot",
    "claudeOrgPath",
    "endpointDestinationDir",
  ] as const) {
    expect(refusalFor({ [field]: "relative/path" })).toContain("absolute");
  }
});

test("an optional executor path is still absolute when it is given", () => {
  expect(refusalFor({ python: "python3" })).toContain("absolute");
  // ... and null is the way to leave it out, which must stay accepted.
  expect(runPlan(withField({ python: null })).kind).toBe("planned");
});

test("every token of the worker command is absolute, not just the first", () => {
  // continuo's own rule and its reason: a bare name would be resolved through
  // PATH, and the fence cannot rest on which directory the worker was started
  // from. The second token is the one a first-token-only check would miss.
  expect(refusalFor({ claudeCommand: ["/usr/bin/node", "claude.js"] })).toContain(
    "claudeCommand[1]",
  );
  expect(refusalFor({ claudeCommand: [] })).toContain("worker CLI");
});

test("a branch name that an argument parser would read as a flag is refused", () => {
  expect(refusalFor({ topicBranch: "--help" })).toContain("flag");
});

test("an identifier carrying whitespace is refused", () => {
  expect(refusalFor({ runId: "run 1" })).toContain("whitespace");
});

test("the endpoint recipient must be one continuo has a handler for", () => {
  const reason = refusalFor({ endpointRecipient: "postbox" });
  // The message names the values that exist, because the person reading it is
  // looking for the one they meant.
  expect(reason).toContain("external-notify");
  expect(reason).toContain("human-gated-effect");
  expect(runPlan(withField({ endpointRecipient: "human-gated-effect" })).kind).toBe("planned");
});

test("the ceiling must be strictly above the two budgets it has to clear", () => {
  // Strict, not `>=`: a ceiling equal to the sum leaves the lease, the git
  // commands, the fence render and the gate ingest exactly no time at all.
  const sum = VALID.turnTimeoutMs + VALID.gitTimeoutMs;
  expect(refusalFor({ invocationCeilingMs: sum })).toContain("not above");
  expect(runPlan(withField({ invocationCeilingMs: sum + 1 })).kind).toBe("planned");
});

test("a ceiling beyond Node's timer range is refused rather than clamped", () => {
  // `setTimeout` holds its delay in a signed 32-bit integer and does not
  // saturate: a larger value is clamped to 1 ms. So the one input whose whole
  // meaning is "wait this long" would silently mean its opposite -- the CLI
  // killed at once, the row left at `performing` holding the single-flight
  // lock, and a rondo defect reported for a lap that had barely started.
  const reason = refusalFor({ invocationCeilingMs: 2_147_483_648 });
  expect(reason).toContain("2147483647");
  expect(runPlan(withField({ invocationCeilingMs: 2_147_483_647 })).kind).toBe("planned");
});

test("a budget that is not a positive whole number of milliseconds is refused", () => {
  for (const value of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(refusalFor({ turnTimeoutMs: value })).toContain("turnTimeoutMs");
  }
});

test("the catalog layers are checked, because cadenza reads no catalog of its own", () => {
  expect(refusalFor({ catalogLayers: [] })).toContain("catalogLayers");
  expect(refusalFor({ catalogLayers: [{ ...CATALOG_LAYER, baseDir: "catalog" }] })).toContain(
    "absolute",
  );
});

// --- the round trip through the store ----------------------------------------

test("a plan survives the payload the store persists, field for field", () => {
  const planned = runPlan(VALID);
  if (planned.kind !== "planned") {
    throw new Error(planned.reason);
  }
  const back = readPlan(planPayload(planned.plan));
  expect(back.kind).toBe("planned");
  if (back.kind !== "planned") {
    return;
  }
  // Equality over the whole record rather than a spot check: the payload is a
  // transcription of thirty-odd fields into snake_case and back, and a field
  // dropped on either side is exactly the failure that a spot check misses.
  expect(back.plan).toEqual(planned.plan);
});

test("a persisted plan that will not read is refused rather than coerced", () => {
  const planned = runPlan(VALID);
  if (planned.kind !== "planned") {
    throw new Error(planned.reason);
  }
  const payload = planPayload(planned.plan);
  // A row may have been written by an older rondo or edited by a person, so the
  // reader validates rather than trusting. This is the case the interpreter
  // files at `stalled`: it does not know what the row means, so it stops.
  expect(readPlan({ ...payload, run_id: 7 }).kind).toBe("refused");
  expect(readPlan({ ...payload, claude_command: "/usr/bin/node" }).kind).toBe("refused");
  expect(readPlan({ ...payload, catalog_layers: [] }).kind).toBe("refused");
});

test("reading a persisted plan re-runs the whole validation, not just the shapes", () => {
  const planned = runPlan(VALID);
  if (planned.kind !== "planned") {
    throw new Error(planned.reason);
  }
  // Every field is the right *type* here and one of them breaks a *rule*. A
  // reader that only checked shapes would hand back a plan whose ceiling is
  // below continuo's own budgets, which is the plan D-0019 rule 12 says must
  // never be driven.
  const back = readPlan({ ...planPayload(planned.plan), invocation_ceiling_ms: 1 });
  expect(back.kind).toBe("refused");
  if (back.kind === "refused") {
    expect(back.reason).toContain("invocationCeilingMs");
  }
});
