/**
 * "Revise" at the gate becomes a second lap, and the second lap continues the
 * first one's work.
 *
 * Until `src/refrain/revision.ts` existed, `gate_options`' second word was
 * decoration: `rondo answer` carried "please use the existing helper" to
 * continuo exactly as it carried "looks good", closed the gate
 * `answered_and_forwarded` for both, and left the operator to write a
 * thirty-two-field plan by hand. So the claims worth asserting are not that a
 * function returns an object -- they are the four facts that make the second
 * lap a *continuation*, and the four refusals that keep it from being a lap
 * continuo will not accept.
 *
 * The load-bearing one is {@link "the successor is cut from the predecessor's
 * topic branch"}. Everything else in this file is about identifiers; that case
 * is the whole difference between "revise" and "start over".
 */
import { expect, test } from "vitest";

import type {
  AgentTypeInput,
  CatalogLayer,
  IntendedAction,
  IssuanceParties,
} from "../../src/cadenza/facade.js";
import { planPayload, type RunPlan, runPlan } from "../../src/refrain/plan.js";
import { revisionPlan } from "../../src/refrain/revision.js";
import type { IterationRecord, JsonRecord } from "../../src/store/records.js";

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

const PARTIES: IssuanceParties = { issuer: "rondo-host", grantee: "run-1" };
const INTENDED_ACTION: IntendedAction = { capabilities: ["command.run"] };

/** The plan the first lap ran under. */
const FIRST: RunPlan = {
  db: "/srv/rondo/control.db",
  runId: "run-1",
  leaseClaimantId: "rondo-host",
  workspace: "/srv/rondo/work/run-1",
  baseBranch: "main",
  topicBranch: "topic/run-1",
  prompt: "teach rondo to count",
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
  agentTypeInput: AGENT_TYPE_INPUT,
  parties: PARTIES,
  intendedAction: INTENDED_ACTION,
};

/**
 * The predecessor as the store holds it: `closed`, with the plan persisted
 * verbatim (D-0019 rule 4), which is the only thing `revisionPlan` reads off
 * the row besides its id.
 */
function closedRecord(plan: RunPlan = FIRST): IterationRecord {
  return {
    id: "iter-1",
    status: "closed",
    request: plan.prompt,
    plan: planPayload(plan),
    planDigest: "sha256:not-checked-here",
    attempts: 1,
    runId: plan.runId,
    continuoRevision: "38c667b",
    agentTypeDigest: null,
    configDigest: null,
    contractDigest: null,
    classification: "allowed",
    classificationReason: null,
    neutralRoleName: "worker",
    continuoRole: "worker",
    modelTier: "standard",
    model: "claude-x",
    gateId: "gate-1",
    gateStage: "answered",
    gateOutcome: "answered_and_forwarded",
    sessionId: "session-1",
    sessionPath: "walk-1",
    reason: null,
    createdAtMs: 1_000,
    updatedAtMs: 2_000,
  };
}

/** The three identifiers a revision needs, all fresh. */
const FRESH = {
  runId: "run-2",
  topicBranch: "topic/run-2",
  workspace: "/srv/rondo/work/run-2",
} as const;

/** The successor plan, or a failure that says why there was not one. */
function revised(overrides: Partial<Parameters<typeof revisionPlan>[0]> = {}): RunPlan {
  const outcome = revisionPlan({
    predecessor: closedRecord(),
    ...FRESH,
    instruction: "use the existing helper instead of a new one",
    ...overrides,
  });
  if (outcome.kind !== "planned") {
    throw new Error(`expected a successor plan, got a refusal: ${outcome.reason}`);
  }
  return outcome.plan;
}

/** The refusal, or a failure saying the revision was allowed when it should not be. */
function refusalOf(overrides: Partial<Parameters<typeof revisionPlan>[0]>): string {
  const outcome = revisionPlan({
    predecessor: closedRecord(),
    ...FRESH,
    instruction: "use the existing helper instead of a new one",
    ...overrides,
  });
  if (outcome.kind !== "refused") {
    throw new Error("expected a refusal, and the revision was allowed");
  }
  return outcome.reason;
}

/**
 * The one case that is the feature.
 *
 * `A-17`'s inheritance -- reuse the predecessor's `(run id, topic branch,
 * workspace)` -- is scoped to a route where nothing was ever admitted, and a
 * gate exists only after a lap ran, so a revision can never take it: continuo's
 * materialiser requires a topic branch that does not exist and a workspace path
 * that does not exist. What crosses the two laps instead is the branch, as the
 * successor's base, so git cuts the second worktree from the first lap's
 * commits.
 */
test("the successor is cut from the predecessor's topic branch", () => {
  const plan = revised();
  expect(plan.baseBranch).toBe(FIRST.topicBranch);
  expect(plan.baseBranch).not.toBe(FIRST.baseBranch);
});

test("the three identifiers are the caller's, and rondo mints none of them", () => {
  const plan = revised();
  expect(plan.runId).toBe("run-2");
  expect(plan.topicBranch).toBe("topic/run-2");
  expect(plan.workspace).toBe("/srv/rondo/work/run-2");
});

/**
 * `parties.grantee` is the run id spelled a second time, and cadenza answers a
 * contract whose grantee differs with `grantee_mismatch` -- an *answered*
 * classification that ends the iteration at `abandoned` after the row is
 * reserved and the lock taken. A successor that kept the predecessor's grantee
 * would spend a reservation to discover it.
 */
test("the grantee follows the new run id", () => {
  expect(revised().parties.grantee).toBe("run-2");
  expect(revised().parties.issuer).toBe(FIRST.parties.issuer);
});

/**
 * The instruction is a delta, and a worker handed only the delta has lost the
 * request it is a delta of. So the original prompt survives verbatim, the
 * instruction survives verbatim, and the second worker is told where the first
 * lap's commits are -- because it is the one fact it cannot read off its own
 * prompt.
 */
test("the prompt keeps the first request, the instruction, and where the work is", () => {
  const plan = revised({ instruction: "use the existing helper instead of a new one" });
  expect(plan.prompt.startsWith(FIRST.prompt)).toBe(true);
  expect(plan.prompt).toContain("use the existing helper instead of a new one");
  expect(plan.prompt).toContain(FIRST.topicBranch);
  expect(plan.prompt).toContain("iter-1");
});

/** D-0004: everything rondo composes is ASCII, and this string reaches a command line. */
test("the composed prompt is ASCII", () => {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: the point is the range.
  expect(/^[\x20-\x7e\n]*$/.test(revised().prompt)).toBe(true);
});

/**
 * Everything else comes off the row.
 *
 * Asserted as "the payloads differ in exactly these keys" rather than field by
 * field, because the claim is about the fields nobody thought to list: a plan
 * field added later is inherited by `...plan` automatically, and a field this
 * module starts overwriting by accident fails here rather than in a lap.
 */
test("every other field is inherited verbatim", () => {
  const before = planPayload(FIRST) as Record<string, unknown>;
  const after = planPayload(revised()) as Record<string, unknown>;
  const changed = Object.keys(after).filter(
    (key) => JSON.stringify(after[key]) !== JSON.stringify(before[key]),
  );
  expect(changed.sort()).toEqual(
    [
      "base_branch",
      "parties",
      "prompt",
      "pull_request_base_branch",
      "run_id",
      "topic_branch",
      "workspace",
    ].sort(),
  );
});

/**
 * The cost of cutting from the predecessor's branch, paid in the field beside
 * it.
 *
 * continuo's materialiser calls `baseBranch` both "the branch the topic branch
 * is cut from" and "the branch the lap's pull request is opened against", and a
 * revision is where those stop being the same thing: the predecessor's topic
 * branch is local to the machine that ran the lap and nothing pushes it
 * (`D-0010` leaves publishing to the operator, who publishes the last lap and
 * not each one), so a pull request opened against it names a branch no forge
 * has. This was found by running `publish --dry-run` on a real revised
 * iteration, whose pull-request leg came back naming `dogfood/revise-001`.
 */
test("the pull request still targets the branch the first lap was cut from", () => {
  expect(revised().pullRequestBaseBranch).toBe(FIRST.baseBranch);
});

test("a chain of revisions keeps the first lap's base rather than walking back one link", () => {
  const second = revised();
  const third = revisionPlan({
    predecessor: closedRecord(second),
    runId: "run-3",
    topicBranch: "topic/run-3",
    workspace: "/srv/rondo/work/run-3",
    instruction: "closer, but the helper takes two arguments",
  });
  if (third.kind !== "planned") {
    throw new Error(`expected a successor plan, got a refusal: ${third.reason}`);
  }
  // Cut from the second lap's branch, published against the first lap's base.
  expect(third.plan.baseBranch).toBe(second.topicBranch);
  expect(third.plan.pullRequestBaseBranch).toBe(FIRST.baseBranch);
});

test("a repeated run id is refused, and the refusal says what continues instead", () => {
  const reason = refusalOf({ runId: FIRST.runId });
  expect(reason).toContain("'runId'");
  expect(reason).toContain("D-0057");
  expect(reason).toContain("branch, not the identifier");
});

test("a repeated topic branch is refused", () => {
  const reason = refusalOf({ topicBranch: FIRST.topicBranch });
  expect(reason).toContain("'topicBranch'");
  expect(reason).toContain("does not already exist");
});

test("a repeated workspace is refused", () => {
  const reason = refusalOf({ workspace: FIRST.workspace });
  expect(reason).toContain("'workspace'");
  expect(reason).toContain("worktree");
});

/**
 * An instant is not a duration.
 *
 * The predecessor's `gateDeadlineAtMs` is behind the second lap before it
 * starts, so carrying it forward would open a gate already past its deadline
 * and the person who asked for the revision would be the one to find out.
 * Choosing a new one would be rondo deciding how long a human has to answer.
 */
test("an inherited absolute gate deadline is refused rather than carried or shifted", () => {
  const deadlined = runPlan({ ...FIRST, gateDeadlineAtMs: 1_700_000_000_000 });
  if (deadlined.kind !== "planned") {
    throw new Error(`the fixture plan is not a plan: ${deadlined.reason}`);
  }
  const reason = refusalOf({ predecessor: closedRecord(deadlined.plan) });
  expect(reason).toContain("gateDeadlineAtMs");
  expect(reason).toContain("instant rather than a duration");
});

/**
 * The persisted plan is re-read and re-validated, never trusted: the bytes may
 * have been written by an older rondo or edited by a person, and a revision
 * built on a plan that will not read is a lap addressed to nothing.
 */
test("a predecessor whose plan will not read back is refused", () => {
  const record = { ...closedRecord(), plan: { run_id: "run-1" } as JsonRecord };
  const reason = refusalOf({ predecessor: record });
  expect(reason).toContain("will not read back");
  expect(reason).toContain("iter-1");
});

/**
 * The successor goes through the same validator every other plan does, so a
 * fresh identifier that is not a legal one is refused here -- before the gate
 * is walked, which is the ordering `src/access/cli.ts` depends on.
 */
test("an unusable fresh identifier is refused by the plan validator", () => {
  expect(refusalOf({ workspace: "relative/path" })).toContain("workspace");
  expect(refusalOf({ runId: "" })).toContain("runId");
});
