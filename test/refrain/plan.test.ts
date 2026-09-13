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
 * **D-0023 split the validator in two.** `runPlan()` still refuses everything
 * an operator types into a plan file, but `runId`, `topicBranch` and
 * `workspace` are no longer among those fields: the allocator mints them from
 * an iteration id, and only `workspaceRoot` (the directory they are derived
 * under) remains the caller's. The checks that used to run on the operator's
 * typing of those three fields, plus `leaseClaimantId`, now run on the
 * allocator's output inside `admittedPlan()` -- the same functions
 * (`requireIdentifier`, `requireAbsolute`, `requireNotOptionShaped`), asserting
 * that the derivation produced something continuo will accept rather than that
 * the operator did.
 *
 * The second half is the round trip. The store persists the plan **verbatim**
 * (D-0019 rule 4) as {@link planPayload}'s rendering and hands the bytes back;
 * {@link readPlan} is what turns them into an admitted plan again, and it
 * re-runs the whole validation rather than trusting whatever wrote the row,
 * because the row may have been written by an older rondo or edited by a
 * person. A payload that will not read is what the interpreter files at
 * `stalled`.
 */
import { readFileSync } from "node:fs";

import { expect, test } from "vitest";

import type {
  AgentTypeInput,
  CatalogLayer,
  IntendedAction,
  IssuanceParties,
} from "../../src/cadenza/facade.js";
import type { Allocation } from "../../src/refrain/allocator.js";
import {
  admittedPlan,
  PLAN_PAYLOAD_VERSION,
  planPayload,
  type ReviewCriterion,
  type RunPlan,
  readPlan,
  readRunPlan,
  runPlan,
} from "../../src/refrain/plan.js";
import { planDigest } from "../../src/store/plan.js";
import type { JsonRecord } from "../../src/store/records.js";

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
 * The grantee is the run id spelled a second time. `admittedPlan` overwrites
 * this field with the allocation's run id and then asserts the equality
 * (D-0023 rule 9), rather than `runPlan` insisting on it up front.
 */
const PARTIES: IssuanceParties = { issuer: "rondo-host", grantee: "run-1" };
const INTENDED_ACTION: IntendedAction = { capabilities: ["command.run"] };

/**
 * One complete, valid plan, as a caller would hand it over.
 *
 * `runId`, `topicBranch`, `workspace` and `leaseClaimantId` are gone: the
 * allocator mints them from an iteration id (D-0023 rule 9). `workspaceRoot`
 * is what replaces them here -- the directory the caller still chooses, with
 * the component under it derived rather than typed.
 */
const VALID: RunPlan = {
  db: "/srv/rondo/control.db",
  workspaceRoot: "/srv/rondo/work-root",
  baseBranch: "main",
  prompt: "do the thing",
  allowedBash: ["npm run:*"],
  materialLanguage: null,
  reviewCriterion: null,
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

/** The allocation `admittedPlan` places onto {@link VALID}, matching `run-1`. */
const ALLOCATION: Allocation = {
  runId: "run-1",
  topicBranch: "topic/run-1",
  workspace: "/srv/rondo/work/run-1",
  leaseClaimantId: "rondo-host",
};

/** {@link VALID} with one field replaced, so each case names one rule. */
const withField = (patch: Partial<RunPlan>): RunPlan => ({ ...VALID, ...patch });

/** {@link ALLOCATION} with one field replaced. */
const withAllocation = (patch: Partial<Allocation>): Allocation => ({ ...ALLOCATION, ...patch });

/** The reason `runPlan` gave, or a failure saying it did not refuse at all. */
function refusalFor(patch: Partial<RunPlan>): string {
  const outcome = runPlan(withField(patch));
  if (outcome.kind !== "refused") {
    throw new Error("the plan was accepted, and this case exists because it must not be");
  }
  return outcome.reason;
}

/**
 * The reason `admittedPlan` gave for a validated {@link VALID} plan and a
 * patched allocation, or a failure saying it did not refuse at all.
 */
function admissionRefusalFor(patch: Partial<Allocation>): string {
  const planned = runPlan(VALID);
  if (planned.kind !== "planned") {
    throw new Error(planned.reason);
  }
  const outcome = admittedPlan(planned.plan, withAllocation(patch));
  if (outcome.kind !== "refused") {
    throw new Error("the allocation was accepted, and this case exists because it must not be");
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
  // `runId` no longer lives on `RunPlan` (D-0023 rule 9): it is the
  // allocation's, folded on by `admittedPlan`.
  const admitted = admittedPlan(outcome.plan, ALLOCATION);
  expect(admitted.kind).toBe("planned");
  if (admitted.kind === "planned") {
    expect(admitted.plan.runId).toBe("run-1");
    expect(Object.isFrozen(admitted.plan)).toBe(true);
  }
});

test("an empty operator value is refused by name, rather than reaching continuo", () => {
  // `baseBranch` is the one of D-0015's exception 2's five fields still typed
  // by the operator on `RunPlan` itself.
  expect(refusalFor({ baseBranch: "" })).toContain("'baseBranch'");
  // The other four -- `runId`, `workspace`, `topicBranch`, `leaseClaimantId` --
  // are minted by the allocator now (D-0023 rule 9), so an empty value in one
  // of them is a refusal from `admittedPlan`, not from `runPlan`.
  expect(admissionRefusalFor({ runId: "" })).toContain("'runId'");
  expect(admissionRefusalFor({ workspace: "" })).toContain("'workspace'");
  expect(admissionRefusalFor({ topicBranch: "" })).toContain("'topicBranch'");
  expect(admissionRefusalFor({ leaseClaimantId: "" })).toContain("'leaseClaimantId'");
});

test("a NUL byte is refused before spawn could throw on it", () => {
  // `spawn` throws *synchronously* on an embedded NUL rather than emitting an
  // error event, so a value carrying one never reaches continuo at all. Refused
  // here, the message names the plan field rather than an argv position.
  expect(refusalFor({ prompt: "do the thing" })).toContain("NUL");
});

test("a path continuo requires to be absolute is refused when it is not", () => {
  for (const field of [
    "db",
    "workspaceRoot",
    "repository",
    "artifactRoot",
    "stateRoot",
    "interlockRoot",
    "claudeOrgPath",
    "endpointDestinationDir",
  ] as const) {
    expect(refusalFor({ [field]: "relative/path" })).toContain("absolute");
  }
  // `workspace` moved to the allocation (D-0023 rule 9); the absoluteness rule
  // travelled with it into `admittedPlan`.
  expect(admissionRefusalFor({ workspace: "relative/path" })).toContain("absolute");
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
  // `topicBranch` is the allocation's now (D-0023 rule 9); the flag-shape rule
  // travelled with it into `admittedPlan`.
  expect(admissionRefusalFor({ topicBranch: "--help" })).toContain("flag");
});

test("an identifier carrying whitespace is refused", () => {
  // `runId` is the allocation's now (D-0023 rule 9).
  expect(admissionRefusalFor({ runId: "run 1" })).toContain("whitespace");
});

test("the endpoint recipient must be one continuo has a handler for", () => {
  const reason = refusalFor({ endpointRecipient: "postbox" });
  // The message names the values that exist, because the person reading it is
  // looking for the one they meant.
  expect(reason).toContain("external-notify");
  expect(reason).toContain("human-gated-effect");
  expect(runPlan(withField({ endpointRecipient: "human-gated-effect" })).kind).toBe("planned");
});

test("the ceiling must be strictly above the three budgets it has to clear", () => {
  // Strict, not `>=`: a ceiling equal to the sum leaves the lease, the git
  // commands, the fence render and the gate ingest exactly no time at all.
  const sum = VALID.turnTimeoutMs + VALID.gitTimeoutMs + VALID.identityReadbackTimeoutMs;
  expect(refusalFor({ invocationCeilingMs: sum })).toContain("not above");
  expect(runPlan(withField({ invocationCeilingMs: sum + 1 })).kind).toBe("planned");
});

test("the read-back budget is counted into the floor, not left out of it", () => {
  // The case that fails if D-0021's third budget is added to the plan and not
  // to the sum: a ceiling that clears the first two and not the third would
  // pass, and rondo's timer could fire while the lap was still inside a window
  // rondo itself declared.
  const withoutReadback = VALID.turnTimeoutMs + VALID.gitTimeoutMs + 1;
  expect(refusalFor({ invocationCeilingMs: withoutReadback })).toContain(
    "identityReadbackTimeoutMs",
  );
});

test("the read-back budget is required and is a positive whole number of milliseconds", () => {
  // continuo defaults it to 30 s, and rondo states it anyway: the two budgets
  // beside it are stated for the same reason (D-0019 rule 12, D-0021).
  for (const value of [0, -1, 1.5, Number.NaN]) {
    expect(refusalFor({ identityReadbackTimeoutMs: value })).toContain("identityReadbackTimeoutMs");
  }
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

test("admittedPlan writes the grantee from the allocation rather than trusting the caller's", () => {
  // Before D-0023, `runId` was the caller's to type, so a `parties.grantee`
  // that disagreed with it was a caller mistake `runPlan` refused before
  // cadenza could answer `grantee_mismatch` (an *answered* classification that
  // ends the iteration at terminal `abandoned` after a row was reserved and the
  // single-flight lock taken -- the dogfood lost an iteration to exactly this,
  // F-6).
  //
  // `runId` is the allocation's now, so a caller can no longer supply a
  // mismatched grantee for `runPlan` to catch: `admittedPlan` folds the
  // allocation's run id onto `parties.grantee` itself, overwriting whatever the
  // caller wrote, and only then asserts the equality it just created (D-0023
  // rule 9). That assertion is a defect check on rondo's own two writes rather
  // than a caller-reachable refusal -- it stays in place so a later edit that
  // filled one of the two from somewhere else would fail loudly here instead of
  // silently at cadenza, after a lap -- but there is no longer an input a test
  // can hand it that reaches the refusal branch. What a test *can* show is the
  // overwrite: a plan built with a stale or absent grantee still comes out
  // correct.
  const planned = runPlan(VALID);
  if (planned.kind !== "planned") {
    throw new Error(planned.reason);
  }
  const mismatched: RunPlan = {
    ...planned.plan,
    parties: { issuer: "rondo-host", grantee: "delegate-1" },
  };
  const admitted = admittedPlan(mismatched, ALLOCATION);
  expect(admitted.kind).toBe("planned");
  if (admitted.kind === "planned") {
    // Overwritten to the allocation's run id, not the caller's stale value.
    expect(admitted.plan.parties.grantee).toBe("run-1");
    expect(admitted.plan.parties.grantee).toBe(admitted.plan.runId);
  }
});

test("a plan whose parties are not a table is refused, not thrown on", () => {
  // `RunPlan` is structural, so a caller can hand over a value that never
  // passed `runPlan()`; the validator's contract is to refuse, and reading
  // `.grantee` off `null` would be a throw instead.
  for (const parties of [null, undefined, "run-1"]) {
    expect(refusalFor({ parties: parties as unknown as IssuanceParties })).toContain("'parties'");
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
  const admitted = admittedPlan(planned.plan, ALLOCATION);
  if (admitted.kind !== "planned") {
    throw new Error(admitted.reason);
  }
  const back = readPlan(planPayload(admitted.plan));
  expect(back.kind).toBe("planned");
  if (back.kind !== "planned") {
    return;
  }
  // Equality over the whole record rather than a spot check: the payload is a
  // transcription of thirty-odd fields into snake_case and back, and a field
  // dropped on either side is exactly the failure that a spot check misses.
  expect(back.plan).toEqual(admitted.plan);
});

test("a persisted plan that will not read is refused rather than coerced", () => {
  const planned = runPlan(VALID);
  if (planned.kind !== "planned") {
    throw new Error(planned.reason);
  }
  const admitted = admittedPlan(planned.plan, ALLOCATION);
  if (admitted.kind !== "planned") {
    throw new Error(admitted.reason);
  }
  const payload = planPayload(admitted.plan);
  // A row may have been written by an older rondo or edited by a person, so the
  // reader validates rather than trusting. This is the case the interpreter
  // files at `stalled`: it does not know what the row means, so it stops.
  expect(readPlan({ ...payload, run_id: 7 }).kind).toBe("refused");
  expect(readPlan({ ...payload, claude_command: "/usr/bin/node" }).kind).toBe("refused");
  expect(readPlan({ ...payload, catalog_layers: [] }).kind).toBe("refused");
  // The parties are persisted opaquely, so a row edited by hand can carry no
  // grantee at all, or no table at all. A missing table is still refused
  // rather than thrown on; a missing *grantee* inside an otherwise-fine table
  // is not a refusal any more, because `admittedPlan` overwrites `.grantee`
  // with the allocation's run id unconditionally (D-0023 rule 9) rather than
  // reading it back and checking its type -- so a hand-edited row with no
  // grantee at all still reads, corrected in the same write that would have
  // corrected a stale one.
  const noGrantee = readPlan({ ...payload, parties: { issuer: "rondo-host" } });
  expect(noGrantee.kind).toBe("planned");
  if (noGrantee.kind === "planned") {
    expect(noGrantee.plan.parties.grantee).toBe(noGrantee.plan.runId);
  }
  expect(readPlan({ ...payload, parties: "run-1" }).kind).toBe("refused");
  expect(readPlan({ ...payload, parties: ["rondo-host", "run-1"] }).kind).toBe("refused");
});

/**
 * The payload's version, and what each of the two shapes means (D-0028).
 *
 * `pull_request_base_branch` (D-0027) and `workspace_root` (D-0023) were both
 * added to the payload after rows existed, and **the plan column is persisted
 * verbatim** (D-0019 rule 4): the store hands the bytes back unaltered, so a
 * strict read would make every iteration written before either field
 * unreadable -- filed at `stalled` by the interpreter, and met by `publish` on
 * a row whose lap has already been paid for.
 *
 * Before this entry each was tolerated by its own relaxation, and the second
 * one had already shown that the pattern does not scale. Now the bytes say
 * which shape they are: **no `payload_version` key is v0**, which is every row
 * rondo wrote before this entry and every plan file a person has typed, and the
 * ladder supplies for a v0 payload exactly what v0 could not carry. At v1
 * every field is strict again, which is the property the per-field relaxation
 * was eroding.
 */
const payloadOf = (): JsonRecord => {
  const planned = runPlan(VALID);
  if (planned.kind !== "planned") {
    throw new Error(planned.reason);
  }
  const admitted = admittedPlan(planned.plan, ALLOCATION);
  if (admitted.kind !== "planned") {
    throw new Error(admitted.reason);
  }
  return planPayload(admitted.plan);
};

/** The same payload in the shape rondo wrote before the version key existed. */
const asVersionZero = (payload: JsonRecord): JsonRecord => {
  const legacy = { ...payload } as Record<string, unknown>;
  delete legacy["payload_version"];
  delete legacy["workspace_root"];
  delete legacy["pull_request_base_branch"];
  // v0 predates the declaration as well: the key arrived with the v2 rung
  // (`continuo D-1110`), so a document from before the version key existed
  // cannot have carried it either.
  delete legacy["allowed_bash"];
  return legacy as JsonRecord;
};

test("the version a payload declares is the height a v0 document climbs to", () => {
  // **Not `payload === PLAN_PAYLOAD_VERSION`, which is a tautology.** What is
  // under test is that the number written into fresh bytes is the same number a
  // v0 document arrives at after the ladder has run -- so a step appended
  // without the version following it would put the two apart. The constant is
  // derived from the ladder's length for that reason; this is the property that
  // derivation buys, asserted from outside the module.
  const written = payloadOf()["payload_version"];
  const climbed = readPlan(asVersionZero(payloadOf()));
  expect(climbed.kind).toBe("planned");
  expect(written).toBe(PLAN_PAYLOAD_VERSION);
  // Every rung below the current version has a step, and the top is not a rung:
  // a document declaring the current version is left exactly as it is, which is
  // what makes climbing idempotent.
  expect(readPlan({ ...payloadOf(), payload_version: PLAN_PAYLOAD_VERSION }).kind).toBe("planned");
});

test("a v0 payload reads, and the ladder supplies exactly what v0 could not carry", () => {
  const back = readPlan(asVersionZero(payloadOf()));
  expect(back.kind).toBe("planned");
  if (back.kind === "planned") {
    // Absent *means* something: no revision has touched this plan.
    expect(back.plan.pullRequestBaseBranch).toBe(null);
    // Absent means only that an older rondo did not record it, so the value is
    // derived -- the root the workspace actually had, its parent.
    expect(back.plan.workspaceRoot).toBe("/srv/rondo/work");
    // Absent *means* something here too, and the meaning is a measurement of
    // what those runs got: no `--allow-bash` was passed before
    // `continuo D-1110` existed, so nothing reached the rendered allow list.
    expect(back.plan.allowedBash).toEqual([]);
  }
});

test("a v1 payload predates the declaration, and climbs to one that declares nothing", () => {
  // **The rung that matters for a live iteration across the pin move.** A row
  // written by the rondo of an hour ago declares v1 and has no `allowed_bash`;
  // refusing it by name would file a running iteration at `stalled` for a key
  // its writer could not have written.
  const payload = { ...payloadOf() } as Record<string, unknown>;
  delete payload["allowed_bash"];
  // The literal version this rung climbs from, rather than one below the top of
  // the ladder: the second spelling names *the newest rung* and would silently
  // stop exercising this one the moment a third was appended -- which is what it
  // did when D-0053's language rung arrived.
  payload["payload_version"] = 1;
  const back = readPlan(payload as JsonRecord);
  expect(back.kind).toBe("planned");
  if (back.kind === "planned") {
    expect(back.plan.allowedBash).toEqual([]);
  }

  // At the current version the field is strict again, which is what the rung
  // buys: a row rondo wrote today with the key missing is a row rondo cannot
  // read, rather than one silently read as declaring nothing.
  const current = { ...payloadOf() } as Record<string, unknown>;
  delete current["allowed_bash"];
  const strict = readPlan(current as JsonRecord);
  expect(strict.kind).toBe("refused");
  if (strict.kind === "refused") {
    expect(strict.reason).toContain("allowed_bash");
  }
});

test("a v2 payload predates the language ask, and climbs to one that asked for nothing", () => {
  // **Absent is null and is not `en` (D-0053 rule 10).** A lap whose material
  // happens to be English because that is what its worker wrote is not a lap
  // that was asked for English, and supplying `en` here would put an ask into
  // an already-written record that nobody ever made.
  const payload = { ...payloadOf() } as Record<string, unknown>;
  delete payload["material_language"];
  payload["payload_version"] = 2;
  const back = readPlan(payload as JsonRecord);
  expect(back.kind).toBe("planned");
  if (back.kind === "planned") {
    expect(back.plan.materialLanguage).toBe(null);
  }

  // And the stored bytes are untouched by the climb, which is rule 13: the rung
  // reads an older payload, it does not rewrite one.
  expect(payload["material_language"]).toBeUndefined();

  // At the current version an absent key is a row rondo wrote without one,
  // which is a row rondo cannot read -- the same strictness the rung above buys.
  const current = { ...payloadOf() } as Record<string, unknown>;
  delete current["material_language"];
  const strict = readPlan(current as JsonRecord);
  expect(strict.kind).toBe("refused");
  if (strict.kind === "refused") {
    expect(strict.reason).toContain("material_language");
  }
});

test("a language ask is a tag or nothing, and a sentence is neither", () => {
  // Shape, never a registry: rondo holds no table of languages (rule 7).
  expect(runPlan(withField({ materialLanguage: "ja" })).kind).toBe("planned");
  expect(runPlan(withField({ materialLanguage: "zh-Hant" })).kind).toBe("planned");
  expect(runPlan(withField({ materialLanguage: null })).kind).toBe("planned");
  for (const bad of ["ja_JP", "", "Japanese please", "j", '"><script>']) {
    const outcome = runPlan(withField({ materialLanguage: bad }));
    expect(outcome.kind).toBe("refused");
  }
});

test("the ask survives the round trip, and the payload spells it material_language", () => {
  const planned = runPlan(withField({ materialLanguage: "ja" }));
  if (planned.kind !== "planned") {
    throw new Error(planned.reason);
  }
  const admitted = admittedPlan(planned.plan, ALLOCATION);
  if (admitted.kind !== "planned") {
    throw new Error(admitted.reason);
  }
  const payload = planPayload(admitted.plan);
  expect(payload["material_language"]).toBe("ja");
  const back = readPlan(payload);
  expect(back.kind).toBe("planned");
  if (back.kind === "planned") {
    expect(back.plan.materialLanguage).toBe("ja");
  }
});

test("a declaration survives the round trip in the plan's own order", () => {
  // Order is the plan's and is not rondo's to sort: the declaration is a record
  // of what was asked for, and `admitRun` appends one `--allow-bash` per
  // subject in this order.
  const subjects = ["npm ci --ignore-scripts", "npm run:*", "node vendor/pin.mjs:*"];
  const planned = runPlan(withField({ allowedBash: subjects }));
  if (planned.kind !== "planned") {
    throw new Error(planned.reason);
  }
  const admitted = admittedPlan(planned.plan, ALLOCATION);
  if (admitted.kind !== "planned") {
    throw new Error(admitted.reason);
  }
  const back = readPlan(planPayload(admitted.plan));
  expect(back.kind).toBe("planned");
  if (back.kind === "planned") {
    expect(back.plan.allowedBash).toEqual(subjects);
  }
});

test("a malformed Bash subject is refused here, where continuo answers one with a stack", () => {
  // Each rule below is continuo's, read off `LapRunIntent`'s constructor at the
  // pinned revision, and each is restated because `LapRunIntentUsageError` is
  // outside the refusal family continuo answers as a document: `run_cli.ts`
  // says in its own words that it escapes as a stack trace and exit 1. So this
  // is D-0015 exception 2's shape, on a field that arrived after it.
  expect(refusalFor({ allowedBash: [""] })).toContain("allowedBash[0]");
  expect(refusalFor({ allowedBash: ["npm run:*", "   "] })).toContain("allowedBash[1]");
  expect(refusalFor({ allowedBash: ["npm\nrun"] })).toContain("control character");
  // A parenthesis would spell half of somebody else's rule: continuo
  // interpolates the subject into `Bash(<subject>)`, so the spec spelling is
  // the mistake to catch and the message says which spelling to use instead.
  const wrapped = refusalFor({ allowedBash: ["Bash(npm run:*)"] });
  expect(wrapped).toContain("Bash(<subject>)");
  expect(wrapped).toContain("'npm run:*'");
  // "Anything" is not a declaration. `*`, `**`, `:*` and `* *` are all refused;
  // `npm run:*` is not, which is the boundary the test exists to pin.
  for (const anything of ["*", "**", ":*", "* *"]) {
    expect(refusalFor({ allowedBash: [anything] })).toContain("narrower than");
  }
  expect(runPlan(withField({ allowedBash: ["npm run:*"] })).kind).toBe("planned");
  // And declaring nothing is a plan, which is every lap that does not build.
  expect(runPlan(withField({ allowedBash: [] })).kind).toBe("planned");
});

test("a v0 workspace at a filesystem root derives the root, not the empty string", () => {
  // **The branch an earlier version of this repair got wrong.** Slicing at the
  // separator gives `""` for a worktree at `/legacy` and `"C:"` for one at
  // `C:\\legacy`, neither of which is an absolute path -- so `requireAbsolute`
  // would refuse and the live iteration the ladder exists to rescue would be
  // stranded anyway. The separator is kept in exactly those two cases.
  const rooted = (workspace: string): string | null => {
    const back = readPlan({ ...asVersionZero(payloadOf()), workspace });
    return back.kind === "planned" ? back.plan.workspaceRoot : null;
  };
  expect(rooted("/legacy")).toBe("/");
  expect(rooted("C:\\legacy")).toBe("C:\\");
  expect(rooted("/srv/legacy")).toBe("/srv");

  // A workspace with no separator has no parent to name, so nothing is derived
  // and the payload is refused by name rather than repaired into a guess.
  const guessed = readPlan({ ...asVersionZero(payloadOf()), workspace: "legacy" });
  expect(guessed.kind).toBe("refused");
  if (guessed.kind === "refused") {
    expect(guessed.reason).toContain("workspace_root");
  }
});

test("a v1 payload is strict again: the field the relaxation used to cover is required", () => {
  // **This is what the version buys.** Before it, an absent
  // `pull_request_base_branch` was tolerated in every payload for ever, so a
  // current row that had lost the key read as though a revision had never
  // happened. Now the tolerance is scoped to the shape that needed it.
  const payload = { ...payloadOf() } as Record<string, unknown>;
  delete payload["pull_request_base_branch"];
  const back = readPlan(payload as JsonRecord);
  expect(back.kind).toBe("refused");
  if (back.kind === "refused") {
    expect(back.reason).toContain("pull_request_base_branch");
  }
});

test("the ladder supplies what was absent and never repairs what is present and wrong", () => {
  const payload = payloadOf();
  // Present and the wrong type, in both shapes: still refused, because the
  // ladder's job is to say what an older shape meant and not to coerce.
  expect(readPlan({ ...payload, pull_request_base_branch: 7 }).kind).toBe("refused");
  expect(readPlan({ ...asVersionZero(payload), pull_request_base_branch: 7 }).kind).toBe("refused");
  expect(readPlan({ ...asVersionZero(payload), workspace_root: 7 }).kind).toBe("refused");

  // And the tolerance is the ladder's two keys wide. Every other field absent
  // is still a payload rondo did not write, at either version.
  const legacy = asVersionZero(payload) as Record<string, unknown>;
  for (const key of ["base_branch", "invocation_ceiling_ms", "workspace"]) {
    // The refusal must name the key that went missing. Asserting only that a
    // refusal happened would pass for the wrong reason: a v0 document with no
    // `workspace` is also a document the ladder cannot derive a
    // `workspace_root` for, so it would be refused either way.
    for (const shape of [payload as Record<string, unknown>, legacy]) {
      const { [key]: _absent, ...missing } = shape;
      const back = readPlan(missing as JsonRecord);
      expect(back.kind).toBe("refused");
      if (back.kind === "refused") {
        expect(back.reason).toContain(key === "workspace" ? "workspace" : key);
      }
    }
  }
});

test("a payload from a newer rondo is refused by name rather than read as current", () => {
  // **The half a per-field relaxation could never provide.** A payload written
  // by a newer rondo may carry a changed meaning for a field this code does
  // read; ignoring its unknown keys would act on it silently. The refusal names
  // both versions, so the sentence an operator meets says what to run.
  const back = readPlan({ ...payloadOf(), payload_version: PLAN_PAYLOAD_VERSION + 1 });
  expect(back.kind).toBe("refused");
  if (back.kind === "refused") {
    expect(back.reason).toContain(String(PLAN_PAYLOAD_VERSION + 1));
    expect(back.reason).toContain(String(PLAN_PAYLOAD_VERSION));
    expect(back.reason).toContain("newer rondo");
  }
});

test("a version that is not a whole number is refused rather than rounded", () => {
  const payload = payloadOf();
  for (const declared of ["1", 1.5, -1, null, Number.NaN]) {
    const back = readPlan({ ...payload, payload_version: declared as never });
    expect(back.kind).toBe("refused");
    if (back.kind === "refused") {
      expect(back.reason).toContain("payload_version");
    }
  }
});

/**
 * The ladder runs at the plan-file entry too, and the operator's protection
 * survives it.
 *
 * `readRunPlan` is what `src/access/cli.ts` hands a person's plan file, and
 * `readPlan` reaches it through the same call. A migration applied at one entry
 * and not the other would be a payload that reads back out of the store and
 * refuses out of a copy of itself -- and a copy of a past row's plan column is
 * a valid plan file by `docs/operations/rondo-cli.md`'s own promise.
 */
test("a plan file with no version reads, and one that declares v1 is held to v1", () => {
  const file = { ...asVersionZero(payloadOf()) } as Record<string, unknown>;
  for (const minted of ["run_id", "lease_claimant_id", "workspace", "topic_branch"]) {
    delete file[minted];
  }
  // A person's plan file carries no `workspace` (D-0023 rule 9 forbids it), so
  // nothing is derived for them and `workspace_root` is theirs to supply.
  file["workspace_root"] = "/srv/rondo/work-root";

  const read = readRunPlan(file as JsonRecord);
  expect(read.kind).toBe("planned");
  if (read.kind === "planned") {
    expect(read.plan.pullRequestBaseBranch).toBe(null);
  }

  // The same document declaring v1 is held to v1, which is what makes the
  // version a statement about the bytes rather than a decoration. The literal
  // `1` rather than `PLAN_PAYLOAD_VERSION`: this case is about the rung that
  // introduced `pull_request_base_branch`'s strictness, and the ladder has
  // grown a rung above it (`allowed_bash`) whose own tolerance would otherwise
  // be the thing under test.
  const declared = { ...file, payload_version: 1 };
  const held = readRunPlan(declared as JsonRecord);
  expect(held.kind).toBe("refused");
  if (held.kind === "refused") {
    expect(held.reason).toContain("pull_request_base_branch");
  }
});

test("an operator who omits 'workspace_root' is still refused by name, not handed a guess", () => {
  // **The property D-0023 rule 28 protected, kept by the guard rather than by
  // the call site.** The derivation fires only when the payload carries a
  // `workspace` -- one of the three identifiers a plan file may not carry at
  // all -- so a person's omission is a refusal and not a workspace somewhere
  // they did not name.
  const file = { ...asVersionZero(payloadOf()) } as Record<string, unknown>;
  for (const minted of ["run_id", "lease_claimant_id", "workspace", "topic_branch"]) {
    delete file[minted];
  }
  const read = readRunPlan(file as JsonRecord);
  expect(read.kind).toBe("refused");
  if (read.kind === "refused") {
    expect(read.reason).toContain("workspace_root");
  }
});

test("a copy of an old row's plan column is a plan file, which is what the runbook promises", () => {
  // The one document whose behaviour changes: a pre-D-0023 row's plan column
  // could not have carried `workspace_root`, and now reads with the root that
  // row actually had instead of being refused for a field the copy could not
  // have held.
  const read = readRunPlan(asVersionZero(payloadOf()));
  expect(read.kind).toBe("planned");
  if (read.kind === "planned") {
    expect(read.plan.workspaceRoot).toBe("/srv/rondo/work");
  }
});

test("reading a persisted plan re-runs the whole validation, not just the shapes", () => {
  const planned = runPlan(VALID);
  if (planned.kind !== "planned") {
    throw new Error(planned.reason);
  }
  const admitted = admittedPlan(planned.plan, ALLOCATION);
  if (admitted.kind !== "planned") {
    throw new Error(admitted.reason);
  }
  // Every field is the right *type* here and one of them breaks a *rule*. A
  // reader that only checked shapes would hand back a plan whose ceiling is
  // below continuo's own budgets, which is the plan D-0019 rule 12 says must
  // never be driven.
  const back = readPlan({ ...planPayload(admitted.plan), invocation_ceiling_ms: 1 });
  expect(back.kind).toBe("refused");
  if (back.kind === "refused") {
    expect(back.reason).toContain("invocationCeilingMs");
  }
});

// --- the review criterion (D-0065 section 1.2.6) ------------------------------

const CRITERION: ReviewCriterion = {
  severities: {
    blocker: "the change breaks the build or loses data",
    major: "a claim the diff or transcript contradicts",
    minor: "a rule file line not followed",
    nit: "wording",
  },
  ruleFiles: ["AGENTS.md", "docs/rules.md"],
};

test("a review criterion is accepted, survives the round trip and is spelled review_criterion", () => {
  const planned = runPlan(withField({ reviewCriterion: CRITERION }));
  if (planned.kind !== "planned") {
    throw new Error(planned.reason);
  }
  expect(Object.isFrozen(planned.plan.reviewCriterion)).toBe(true);
  const admitted = admittedPlan(planned.plan, ALLOCATION);
  if (admitted.kind !== "planned") {
    throw new Error(admitted.reason);
  }
  const payload = planPayload(admitted.plan);
  expect(payload["review_criterion"]).toEqual({
    severities: CRITERION.severities,
    rule_files: ["AGENTS.md", "docs/rules.md"],
  });
  const back = readPlan(payload);
  expect(back.kind).toBe("planned");
  if (back.kind === "planned") {
    expect(back.plan.reviewCriterion).toEqual(CRITERION);
  }
  // A plan file is the same document without the minted identifiers.
  const file = { ...payload } as Record<string, unknown>;
  for (const minted of ["run_id", "lease_claimant_id", "workspace", "topic_branch"]) {
    delete file[minted];
  }
  const read = readRunPlan(file as JsonRecord);
  expect(read.kind === "planned" && read.plan.reviewCriterion).toEqual(CRITERION);
  // Null is the absence of a criterion and is a plan.
  expect(runPlan(withField({ reviewCriterion: null })).kind).toBe("planned");
});

test("the dogfood plan's default criterion is one a plan file admits (rondo#205)", () => {
  // `scripts/dogfood-env.sh` writes this file into its plan as
  // `review_criterion`. Without one every dogfood lap's model reading was
  // `unavailable` and no in-scope retry could be admitted; this holds the
  // default to the plan-file reader without paying for a lap.
  const script = readFileSync("scripts/dogfood-env.sh", "utf8");
  expect(script).toContain('"$repo_root/scripts/dogfood-review-criterion.json"');
  expect(script).toContain("review_criterion: JSON.parse(");
  const criterion = JSON.parse(
    readFileSync("scripts/dogfood-review-criterion.json", "utf8"),
  ) as JsonRecord;

  const file = { ...asVersionZero(payloadOf()), review_criterion: criterion } as Record<
    string,
    unknown
  >;
  for (const minted of ["run_id", "lease_claimant_id", "workspace", "topic_branch"]) {
    delete file[minted];
  }
  file["workspace_root"] = "/srv/rondo/work-root";
  const read = readRunPlan(file as JsonRecord);
  if (read.kind !== "planned") {
    throw new Error(read.reason);
  }
  expect(read.plan.reviewCriterion?.severities.blocker).toContain("what the request asks");
  expect(read.plan.reviewCriterion?.ruleFiles).toEqual([]);
});

test("a criterion with an empty meaning or a rule path outside the tree is refused by name", () => {
  const severities = (patch: Partial<ReviewCriterion["severities"]>): ReviewCriterion => ({
    ...CRITERION,
    severities: { ...CRITERION.severities, ...patch },
  });
  expect(refusalFor({ reviewCriterion: severities({ major: " " }) })).toContain(
    "reviewCriterion.severities.major",
  );
  expect(refusalFor({ reviewCriterion: severities({ nit: 7 as unknown as string }) })).toContain(
    "reviewCriterion.severities.nit",
  );
  for (const path of [
    "",
    "/etc/passwd",
    "../AGENTS.md",
    "docs/../../x",
    "./AGENTS.md",
    "docs//rules.md",
    "C:\\rules.md",
    "docs\\rules.md",
    "\\\\host\\share",
    "AGENTS\n.md",
  ]) {
    expect(refusalFor({ reviewCriterion: { ...CRITERION, ruleFiles: [path] } })).toContain(
      "reviewCriterion.ruleFiles[0]",
    );
  }
  const many = Array.from({ length: 21 }, (_, index) => `rules/${String(index)}.md`);
  expect(refusalFor({ reviewCriterion: { ...CRITERION, ruleFiles: many } })).toContain(
    "at most 20",
  );
  expect(
    runPlan(withField({ reviewCriterion: { ...CRITERION, ruleFiles: many.slice(1) } })).kind,
  ).toBe("planned");
  expect(runPlan(withField({ reviewCriterion: { ...CRITERION, ruleFiles: [] } })).kind).toBe(
    "planned",
  );
  for (const shape of [7, "AGENTS.md", [], { severities: null, ruleFiles: [] }]) {
    expect(refusalFor({ reviewCriterion: shape as unknown as ReviewCriterion })).toContain(
      "reviewCriterion",
    );
  }
  expect(
    refusalFor({
      reviewCriterion: { ...CRITERION, ruleFiles: "AGENTS.md" as unknown as string[] },
    }),
  ).toContain("reviewCriterion.ruleFiles");
});

test("a v3 payload predates the criterion, and climbs to one that wrote none", () => {
  const payload = { ...payloadOf() } as Record<string, unknown>;
  delete payload["review_criterion"];
  payload["payload_version"] = 3;
  const back = readPlan(payload as JsonRecord);
  expect(back.kind).toBe("planned");
  if (back.kind === "planned") {
    expect(back.plan.reviewCriterion).toBe(null);
  }
  expect(payload["review_criterion"]).toBeUndefined();
  expect(PLAN_PAYLOAD_VERSION).toBe(4);

  // At the current version an absent key is strict, and a malformed one is
  // refused rather than read as no criterion.
  const current = { ...payloadOf() } as Record<string, unknown>;
  delete current["review_criterion"];
  const strict = readPlan(current as JsonRecord);
  expect(strict.kind === "refused" && strict.reason).toContain("review_criterion");
  for (const bad of [
    7,
    [],
    { severities: {}, rule_files: [] },
    { severities: CRITERION.severities },
  ]) {
    expect(readPlan({ ...payloadOf(), review_criterion: bad as never }).kind).toBe("refused");
  }
});

test("setting a criterion changes the plan digest", () => {
  const planned = runPlan(withField({ reviewCriterion: CRITERION }));
  if (planned.kind !== "planned") {
    throw new Error(planned.reason);
  }
  const admitted = admittedPlan(planned.plan, ALLOCATION);
  if (admitted.kind !== "planned") {
    throw new Error(admitted.reason);
  }
  expect(planDigest(planPayload(admitted.plan))).not.toBe(planDigest(payloadOf()));
});
