/**
 * "Revise" at the gate becomes a second lap, and the second lap continues the
 * first one's work.
 *
 * Until `src/refrain/revision.ts` existed, `gate_options`' second word was
 * decoration: `rondo answer` carried "please use the existing helper" to
 * continuo exactly as it carried "looks good", closed the gate
 * `answered_and_forwarded` for both, and left the operator to write a
 * thirty-two-field plan by hand. So the claims worth asserting are not that a
 * function returns an object -- they are the facts that make the second lap a
 * *continuation*, and the one refusal that keeps it from being a lap continuo
 * will not accept.
 *
 * The load-bearing one is {@link "the successor is cut from the predecessor's
 * topic branch"}. Everything else in this file is about identifiers; that case
 * is the whole difference between "revise" and "start over".
 *
 * **D-0023 moved the triple.** `revisionPlan` used to take the successor's
 * `runId`, `topicBranch` and `workspace` as caller-typed fields, and this file
 * used to build its predecessor fixture as a bare `RunPlan` because that is
 * what the caller typed. Now the allocator derives all three from an iteration
 * id, so a predecessor row holds an *admitted* plan -- one with a triple on it
 * -- and this file builds that fixture with the same two functions (`allocate`
 * then `admittedPlan`) production uses, so the fixture and the derivation
 * cannot drift apart. `revisionPlan` itself hands back a `RunPlan`: the triple
 * is no longer part of what it returns, because the allocator mints it later,
 * at `admit()`, from an iteration id this module never sees turned into one.
 */
import { expect, test } from "vitest";

import type {
  AgentTypeInput,
  CatalogLayer,
  IntendedAction,
  IssuanceParties,
} from "../../src/cadenza/facade.js";
import { allocate } from "../../src/refrain/allocator.js";
import {
  type AdmittedPlan,
  admittedPlan,
  planPayload,
  type RunPlan,
  runPlan,
} from "../../src/refrain/plan.js";
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

/**
 * A placeholder grantee, deliberately not any run id the allocator would ever
 * derive. `admittedPlan()` overwrites it, so what a fixture writes here is
 * only ever visible as "the value that got replaced" -- see "every other
 * field is inherited verbatim" below, which relies on that replacement being
 * a real, detectable change.
 */
const PARTIES: IssuanceParties = { issuer: "rondo-host", grantee: "unset" };
const INTENDED_ACTION: IntendedAction = { capabilities: ["command.run"] };

const WORKSPACE_ROOT = "/srv/rondo/work";

/** The plan the first lap ran under, before the allocator touched it. */
const FIRST_INPUT: RunPlan = {
  db: "/srv/rondo/control.db",
  workspaceRoot: WORKSPACE_ROOT,
  baseBranch: "main",
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
 * Admit one plan under one iteration id, the way `admit()` really does: derive
 * the triple with {@link allocate}, then fold it on with {@link admittedPlan}.
 * A helper rather than a literal so a predecessor fixture cannot silently
 * diverge from what the allocator would actually produce.
 */
function admit(iterationId: string, plan: RunPlan): AdmittedPlan {
  const allocation = allocate(iterationId, WORKSPACE_ROOT);
  if (allocation.kind !== "allocated") {
    throw new Error(`fixture iteration id '${iterationId}' was refused: ${allocation.reason}`);
  }
  const outcome = admittedPlan(plan, allocation.allocation);
  if (outcome.kind !== "planned") {
    throw new Error(`fixture admission for '${iterationId}' was refused: ${outcome.reason}`);
  }
  return outcome.plan;
}

const FIRST = admit(
  "iter-1",
  (() => {
    const outcome = runPlan(FIRST_INPUT);
    if (outcome.kind !== "planned") {
      throw new Error(`the fixture plan is not a plan: ${outcome.reason}`);
    }
    return outcome.plan;
  })(),
);

/**
 * The predecessor as the store holds it: `closed`, with the *admitted* plan
 * persisted verbatim (D-0019 rule 4) -- run id, topic branch and workspace
 * included, because that is what a real predecessor row holds once `admit()`
 * has run. `revisionPlan` reads the plan back off this row (plus the row's
 * own id); the row's `runId`/`topicBranch`/`workspace` columns exist for the
 * store's own bookkeeping (D-0023 rule 5) and are set here to match, but
 * `revisionPlan` does not read them off the row -- only off the plan.
 */
function closedRecord(id: string, plan: AdmittedPlan): IterationRecord {
  return {
    id,
    status: "closed",
    request: plan.prompt,
    plan: planPayload(plan),
    planDigest: "sha256:not-checked-here",
    attempts: 1,
    runId: plan.runId,
    topicBranch: plan.topicBranch,
    workspace: plan.workspace,
    identifiersSpent: 1,
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

const PREDECESSOR = closedRecord("iter-1", FIRST);

/** The successor's iteration id, fresh, in every test that does not say otherwise. */
const FRESH_ITERATION_ID = "iter-2";

/** The successor plan, or a failure that says why there was not one. */
function revised(overrides: Partial<Parameters<typeof revisionPlan>[0]> = {}): RunPlan {
  const outcome = revisionPlan({
    predecessor: PREDECESSOR,
    iterationId: FRESH_ITERATION_ID,
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
    predecessor: PREDECESSOR,
    iterationId: FRESH_ITERATION_ID,
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

/**
 * **D-0023 rule 9.** `revisionPlan` used to take the successor's run id, topic
 * branch and workspace as caller-typed fields and pass them straight through;
 * now it takes only an iteration id, and the plan it returns is a bare
 * `RunPlan` that carries none of the triple at all -- the allocator derives
 * that later, at `admit()`, purely as a function of the iteration id. What
 * used to be "the caller's three values pass through unminted" is now "there
 * is nothing here for rondo to mint or not mint": the identifiers do not exist
 * until `admittedPlan()` puts them on, and when it does, they are exactly what
 * {@link allocate} derives from the same iteration id this test used.
 */
test("rondo mints no identifiers here -- the allocator derives them later, from the iteration id alone", () => {
  const plan = revised();
  expect(Object.hasOwn(plan, "runId")).toBe(false);
  expect(Object.hasOwn(plan, "topicBranch")).toBe(false);
  expect(Object.hasOwn(plan, "workspace")).toBe(false);

  const admitted = admit(FRESH_ITERATION_ID, plan);
  expect(admitted.runId).toBe("rondo-iter-2");
  expect(admitted.topicBranch).toBe("rondo/iter-2");
  expect(admitted.workspace).toBe(`${WORKSPACE_ROOT}/iter-iter-2`);
});

/**
 * `parties.grantee` is the run id spelled a second time, and cadenza answers a
 * contract whose grantee differs with `grantee_mismatch` -- an *answered*
 * classification that ends the iteration at `abandoned` after the row is
 * reserved and the lock taken.
 *
 * **`revisionPlan` no longer rewrites it (D-0023 rule 9).** The successor's run
 * id does not exist yet at this point -- it is minted from the iteration id at
 * `admit()` -- so there is nothing correct `revisionPlan` could write here. The
 * predecessor's grantee rides through unchanged in the plan this function
 * returns, and `admittedPlan()` is what overwrites it, from the same
 * allocation that mints the run id, and then asserts the two agree.
 */
test("the grantee rides through unchanged here, and the allocator overwrites it at admit time", () => {
  const plan = revised();
  expect(plan.parties.grantee).toBe(FIRST.runId);
  expect(plan.parties.issuer).toBe(FIRST.parties.issuer);

  const admitted = admit(FRESH_ITERATION_ID, plan);
  expect(admitted.parties.grantee).toBe(admitted.runId);
  expect(admitted.parties.grantee).toBe("rondo-iter-2");
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
 * Asserted as "the plan differs in exactly these fields" rather than field by
 * field, because the claim is about the fields nobody thought to list: a plan
 * field added later is inherited by `...plan` automatically, and a field this
 * module starts overwriting by accident fails here rather than in a lap.
 *
 * Compared as `RunPlan`s directly rather than through {@link planPayload},
 * because `revisionPlan` now returns a `RunPlan` and `planPayload` takes only
 * an `AdmittedPlan` -- the very fields the old comparison singled out
 * (`run_id`, `topic_branch`, `workspace`) are the ones D-0023 removed from
 * what this function returns at all.
 */
test("every other field is inherited verbatim", () => {
  const before = FIRST_INPUT as unknown as Record<string, unknown>;
  const after = revised() as unknown as Record<string, unknown>;
  const changed = Object.keys(after).filter(
    (key) => JSON.stringify(after[key]) !== JSON.stringify(before[key]),
  );
  expect(changed.sort()).toEqual(
    ["baseBranch", "parties", "prompt", "pullRequestBaseBranch"].sort(),
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
  const secondAdmitted = admit(FRESH_ITERATION_ID, second);
  const third = revisionPlan({
    predecessor: closedRecord(FRESH_ITERATION_ID, secondAdmitted),
    iterationId: "iter-3",
    instruction: "closer, but the helper takes two arguments",
  });
  if (third.kind !== "planned") {
    throw new Error(`expected a successor plan, got a refusal: ${third.reason}`);
  }
  // Cut from the second lap's branch, published against the first lap's base.
  expect(third.plan.baseBranch).toBe(secondAdmitted.topicBranch);
  expect(third.plan.pullRequestBaseBranch).toBe(FIRST.baseBranch);
});

/**
 * **The one remaining identifier refusal.** The three old refusals (a repeated
 * run id, a repeated topic branch, a repeated workspace) collapsed into this
 * one under D-0023: all three are now derived from the iteration id, so they
 * repeat exactly when the id does, and one id compared once is the whole
 * check.
 */
test("a successor iteration id equal to the predecessor's is refused, and the refusal says what continues instead", () => {
  const reason = refusalOf({ iterationId: PREDECESSOR.id });
  expect(reason).toContain("'--iteration-id'");
  expect(reason).toContain("the iteration being revised");
  expect(reason).toContain("second lap is a second run");
  expect(reason).toContain("base branch is the first lap's topic branch");
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
  const deadlined = runPlan({ ...FIRST_INPUT, gateDeadlineAtMs: 1_700_000_000_000 });
  if (deadlined.kind !== "planned") {
    throw new Error(`the fixture plan is not a plan: ${deadlined.reason}`);
  }
  const deadlinedAdmitted = admit("iter-1", deadlined.plan);
  const reason = refusalOf({ predecessor: closedRecord("iter-1", deadlinedAdmitted) });
  expect(reason).toContain("gateDeadlineAtMs");
  expect(reason).toContain("instant rather than a duration");
});

/**
 * The persisted plan is re-read and re-validated, never trusted: the bytes may
 * have been written by an older rondo or edited by a person, and a revision
 * built on a plan that will not read is a lap addressed to nothing.
 */
test("a predecessor whose plan will not read back is refused", () => {
  const record = { ...PREDECESSOR, plan: { run_id: "run-1" } as JsonRecord };
  const reason = refusalOf({ predecessor: record });
  expect(reason).toContain("will not read back");
  expect(reason).toContain("iter-1");
});

/**
 * **What used to be validated here now happens one step later.** When a
 * caller typed the successor's identifiers, `revisionPlan` ran them through
 * the same validator every other plan does, before the gate was touched. Under
 * D-0023 `revisionPlan` takes only an iteration id and does not shape-check it
 * at all -- {@link "a successor iteration id equal to the predecessor's is
 * refused..."} above is the only check this module still makes on it. A
 * malformed id (one {@link allocate}'s alphabet would refuse) is not caught
 * here; it is caught by `allocate()` itself, at `admit()`, which runs after
 * this function returns and before the row is reserved (D-0019 rule 9). This
 * test documents that boundary rather than asserting a refusal this module no
 * longer produces.
 */
test("a malformed iteration id passes revisionPlan unchecked -- allocate() is what refuses it, at admit()", () => {
  const plan = revised({ iterationId: "Not An Id!" });
  expect(plan.baseBranch).toBe(FIRST.topicBranch);

  const allocation = allocate("Not An Id!", WORKSPACE_ROOT);
  expect(allocation.kind).toBe("refused");
});
