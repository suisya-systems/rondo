/**
 * The consumer `rondo#107` measured as missing, driven end to end.
 *
 * **What this file proves is mostly that things do not happen**, so every claim
 * of an absence is made against a control that reaches the same code with one
 * thing changed. A `decision_consumption` table that stays empty proves nothing
 * on its own -- it was empty before this work existed, which is the whole of
 * `#107`.
 *
 * The chain runs for real: a lap ends `abandoned`, `D-0043`'s trigger records a
 * `contract_keys` proposal, a person approves one option's digest, and
 * `approvedRetry` + `admit()` spend that approval on an admission. The store is
 * a real `node:sqlite` database and contracts are composed through the real
 * cadenza facade; only the continuo seam is injected (`D-0019` rule 17).
 */
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import type { ProposePorts } from "../../src/access/advisory.js";
import { approvedRetry, proposeRetry, recordAnswer } from "../../src/access/advisory.js";
import { admit } from "../../src/access/conductor.js";
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
import { canonicalJson, planDigest } from "../../src/store/plan.js";
import type { JsonRecord, LapReadingDraft } from "../../src/store/records.js";
import { advisoryRecord, iterationStore } from "../../src/store/sqlite.js";

const NOW_MS = 1_700_000_000_000;
const SUBJECT = "i-0001";
/** The identity `D-0043` rule 6 mints for a first retry of {@link SUBJECT}. */
const SUCCESSOR = `${SUBJECT}-r2`;
const PROPOSAL_ID = `contract_keys-${SUBJECT}`;
const APPROVER = "operator-1";
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

const answered = (outcome: string): EffectOutcome<ClassificationRecord> => ({
  kind: "answered",
  value: {
    outcome,
    reason: outcome === "allowed" ? "granted" : "branch.push is askable and was asked for",
    agentTypeDigest: "sha256:agent",
    configDigest: "sha256:config",
    contractDigest: "sha256:contract",
    neutralRoleName: "worker",
    modelTier: "standard",
  },
});

const STARTED: EffectOutcome<ContinuoStarted> = {
  kind: "answered",
  value: { revision: "44f62336" },
};

interface Harness {
  readonly connection: DatabaseSync;
  readonly ports: ConductorPorts;
  readonly advisory: ProposePorts;
  readonly answers: { classify: EffectOutcome<ClassificationRecord> };
}

/**
 * A conductor over a real store and an injected seam.
 *
 * `admitRun` and `performLap` echo **the plan's own run id** rather than a
 * constant: a retry runs under a second identity, and a seam that answered with
 * the first one's would stall the row on the identity check the interpreter
 * makes -- a fixture failure wearing the costume of a real one.
 */
function harness(classify: EffectOutcome<ClassificationRecord>): Harness {
  const connection = new DatabaseSync(":memory:");
  const store = iterationStore(connection, CONSERVATIVE_HOST_POLICY);
  const answers = { classify };
  const lapFor = (plan: AdmittedPlan): EffectOutcome<LapPerformance> => ({
    kind: "answered",
    value: {
      runId: plan.runId,
      gateId: `gate-${plan.runId}`,
      sessionId: "session-1",
      sessionPath: "started",
      endpointLeaseFailure: null,
      elapsedDeadlineAtMs: null,
      model: "claude-fixture",
      requestedModel: "claude-fixture",
      permissionDenials: "",
      // Null and not zero (`D-0046`): this fixture's seam reports no
      // transcript, and nothing in this file is about what a lap cost. A zero
      // here would be the fixture claiming a lap that spent nothing.
      costUsd: null,
      turns: null,
      durationMs: null,
      spendSource: "unread",
    },
  });
  const admission = (plan: AdmittedPlan): EffectOutcome<RunAdmission> => ({
    kind: "answered",
    value: { runId: plan.runId, status: "created", continuoRole: "worker" },
  });
  const openGate: EffectOutcome<GateObservation> = {
    kind: "answered",
    value: { gateId: "gate-1", stage: "received", outcome: null },
  };
  const ports: ConductorPorts = {
    store,
    now: () => NOW_MS,
    classify: () => Promise.resolve(answers.classify),
    startContinuo: () => Promise.resolve(STARTED),
    admitRun: (plan: AdmittedPlan) => Promise.resolve(admission(plan)),
    performLap: (plan: AdmittedPlan) => Promise.resolve(lapFor(plan)),
    showGate: () => Promise.resolve(openGate),
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
      // Never called: the unprompted door shows nobody anything (D-0043 rule 9).
      present: () => {
        throw new Error("the unprompted door presented something");
      },
      cadenzaRevision: "5d5d9f4",
    },
  };
}

const rowsIn = (connection: DatabaseSync, table: string): Record<string, unknown>[] =>
  connection.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];

/** Every contract this proposal put on the screen, in the order the options hold them. */
const composed = (connection: DatabaseSync): string[] =>
  (
    connection
      .prepare("SELECT contract_digest FROM composition ORDER BY composition_id")
      .all() as Record<string, unknown>[]
  ).map((row) => String(row["contract_digest"]));

/**
 * A lap that stopped, a proposal behind it, and one option approved.
 *
 * The **second** option is approved on purpose: the first is the contract the
 * subject already ran under, so approving it would make "the retry runs what
 * was approved" true of a digest that was true anyway.
 */
async function approvedChain(): Promise<{
  readonly h: Harness;
  readonly decisionId: string;
  readonly approved: string;
}> {
  const h = harness(answered("needs_approval"));
  const stopped = await admit(h.ports, h.advisory, PLAN, POLICY, SUBJECT);
  expect(stopped.status).toBe("abandoned");
  const digests = composed(h.connection);
  expect(digests.length).toBe(2);
  const approved = digests[1] as string;
  const answer = await recordAnswer(
    { record: h.advisory.record, now: () => NOW_MS },
    { proposalId: PROPOSAL_ID, outcome: "approved", contractDigest: approved, actorId: APPROVER },
  );
  expect(answer.kind).toBe("answered");
  // Nothing has been spent yet, which is the state `#107` measured: the
  // approval is on the books and the consumption table is empty.
  expect(rowsIn(h.connection, "decision_consumption").length).toBe(0);
  return {
    h,
    decisionId: answer.kind === "answered" ? answer.decisionId : "",
    approved,
  };
}

test("approving, then retrying, consumes the decision exactly once and admits under it", async () => {
  const { h, decisionId, approved } = await approvedChain();

  const resolved = await approvedRetry(h.advisory, PROPOSAL_ID);
  expect(resolved.kind).toBe("resolved");
  if (resolved.kind !== "resolved") {
    return;
  }
  // The plan the approval authorises is the subject's, under the agent-type
  // input whose contract is the approved digest -- the promoted key, not the
  // one the subject ran under.
  expect(resolved.retry.successorId).toBe(SUCCESSOR);
  expect(resolved.retry.subjectId).toBe(SUBJECT);
  expect(resolved.retry.contractDigest).toBe(approved);
  expect(resolved.retry.plan.agentTypeInput.granted).toContain("branch.push");
  expect(resolved.retry.plan.agentTypeInput.askable).not.toContain("branch.push");

  h.answers.classify = answered("allowed");
  const report = await admit(h.ports, h.advisory, resolved.retry.plan, POLICY, SUCCESSOR, SUBJECT, {
    decisionId,
    contractDigest: approved,
  });
  expect(report.iterationId).toBe(SUCCESSOR);
  expect(report.status).toBe("awaiting_human");

  // **One consumption, naming the decision and the digest.** `#107`'s
  // measurement was this table staying empty; this is the same measurement with
  // the opposite answer.
  const spent = rowsIn(h.connection, "decision_consumption");
  expect(spent.length).toBe(1);
  expect(spent[0]?.["decision_id"]).toBe(decisionId);
  expect(spent[0]?.["contract_digest"]).toBe(approved);
  // And it is gone from the "approved and never spent" query D-0022 rule 19
  // asks for, which is the only reader that makes the row load-bearing.
  expect(await h.advisory.record.unconsumedDecisions()).toEqual([]);
  // The row it authorised records the lineage, written in the same transaction.
  const successor = await h.advisory.store.read(SUCCESSOR);
  expect(successor.kind).toBe("read");
  if (successor.kind === "read") {
    expect(successor.record.supersedesIterationId).toBe(SUBJECT);
  }
});

test("a second admission on a spent decision is refused, and admits nothing", async () => {
  const { h, decisionId, approved } = await approvedChain();
  const resolved = await approvedRetry(h.advisory, PROPOSAL_ID);
  if (resolved.kind !== "resolved") {
    throw new Error("the chain did not resolve");
  }
  h.answers.classify = answered("allowed");
  const spend = { decisionId, contractDigest: approved };
  const first = await admit(
    h.ports,
    h.advisory,
    resolved.retry.plan,
    POLICY,
    SUCCESSOR,
    SUBJECT,
    spend,
  );
  expect(first.iterationId).toBe(SUCCESSOR);

  // The same approval, offered again under a free identity. Everything else is
  // identical, so what refuses it is single use and nothing else.
  const second = await admit(
    h.ports,
    h.advisory,
    resolved.retry.plan,
    POLICY,
    `${SUBJECT}-r3`,
    SUBJECT,
    spend,
  );
  expect(second.iterationId).toBeNull();
  expect(second.lines.join("\n")).toContain("has already been spent");
  expect(rowsIn(h.connection, "decision_consumption").length).toBe(1);
  // No row under the second identity: the refusal happened before the insert.
  expect((await h.advisory.store.read(`${SUBJECT}-r3`)).kind).toBe("absent");
});

test("a digest that is not the approved one stops the admission and spends nothing", async () => {
  const { h, decisionId, approved } = await approvedChain();
  const resolved = await approvedRetry(h.advisory, PROPOSAL_ID);
  if (resolved.kind !== "resolved") {
    throw new Error("the chain did not resolve");
  }
  h.answers.classify = answered("allowed");

  // The contract the subject already ran under: a real digest, composed by the
  // same proposal, and **not** the one this person approved.
  const otherOption = composed(h.connection)[0] as string;
  expect(otherOption).not.toBe(approved);
  const refused = await admit(
    h.ports,
    h.advisory,
    resolved.retry.plan,
    POLICY,
    SUCCESSOR,
    SUBJECT,
    { decisionId, contractDigest: otherOption },
  );

  expect(refused.iterationId).toBeNull();
  expect(refused.lines.join("\n")).toContain("the digest is what a person approved");
  // Nothing ran and nothing was spent: no iteration under the successor's
  // identity, no consumption row, and the approval still spendable.
  expect((await h.advisory.store.read(SUCCESSOR)).kind).toBe("absent");
  expect(rowsIn(h.connection, "decision_consumption").length).toBe(0);
  expect((await h.advisory.record.unconsumedDecisions()).length).toBe(1);

  // **The control.** The same call with the approved digest admits, so what the
  // assertions above measured is the comparison and not a broken fixture.
  const admitted = await admit(
    h.ports,
    h.advisory,
    resolved.retry.plan,
    POLICY,
    SUCCESSOR,
    SUBJECT,
    { decisionId, contractDigest: approved },
  );
  expect(admitted.iterationId).toBe(SUCCESSOR);
  expect(rowsIn(h.connection, "decision_consumption").length).toBe(1);
});

test("an admission that fails after the approval is spent leaves it unspent", async () => {
  // **The atomicity, measured rather than asserted.** The successor's identity
  // is taken between the approval and the admission (D-0043 rule 8's first
  // refusal), so `reserve()` spends the decision and *then* collides on the
  // iteration table's primary key. If the consumption were its own transaction
  // -- the shape `#107` warns about -- the approval would now be gone and no
  // row would stand against it. It is inside the admission's transaction, so
  // the rollback takes both.
  const { h, decisionId, approved } = await approvedChain();
  const resolved = await approvedRetry(h.advisory, PROPOSAL_ID);
  if (resolved.kind !== "resolved") {
    throw new Error("the chain did not resolve");
  }
  h.answers.classify = answered("allowed");
  // Somebody else takes the identity first, by the ordinary door.
  const taken = await admit(h.ports, h.advisory, PLAN, POLICY, SUCCESSOR);
  expect(taken.iterationId).toBe(SUCCESSOR);

  const report = await admit(h.ports, h.advisory, resolved.retry.plan, POLICY, SUCCESSOR, SUBJECT, {
    decisionId,
    contractDigest: approved,
  });
  expect(report.iterationId).toBeNull();
  expect(rowsIn(h.connection, "decision_consumption").length).toBe(0);
  expect((await h.advisory.record.unconsumedDecisions()).map((row) => row.decisionId)).toEqual([
    decisionId,
  ]);
});

test("an approval whose contract the material no longer composes resolves to nothing", async () => {
  // D-0022 rule 17's comparison, reached from the other side: the option set is
  // recomposed from the store as it stands now, and the approved digest is no
  // longer among what it produces. Nothing is admitted, nothing is spent, and
  // the refusal says so rather than running the nearest contract.
  const { h, decisionId } = await approvedChain();
  // The material moves: the agent type's author withdraws the key the approved
  // option promoted and offers a different one, so the contract that was
  // approved is no longer among what this proposal's own gatherer composes.
  const row = (await h.advisory.store.read(SUBJECT)) as { record: { plan: JsonRecord } };
  const moved = {
    ...row.record.plan,
    agent_type_input: {
      ...(row.record.plan["agent_type_input"] as JsonRecord),
      askable: ["commit.create"],
    },
  } as JsonRecord;
  // The digest moves with the bytes: the store refuses a row whose pair no
  // longer describes one plan, and a fixture that skipped this would measure
  // that refusal instead of the one this test is about.
  h.connection
    .prepare("UPDATE iteration SET plan = ?, plan_digest = ? WHERE id = ?")
    .run(canonicalJson(moved), planDigest(moved), SUBJECT);

  const resolved = await approvedRetry(h.advisory, PROPOSAL_ID);
  expect(resolved.kind).toBe("refused");
  if (resolved.kind === "refused") {
    expect(resolved.reason).toContain("composes");
  }
  expect(rowsIn(h.connection, "decision_consumption").length).toBe(0);
  expect((await h.advisory.record.unconsumedDecisions()).map((each) => each.decisionId)).toEqual([
    decisionId,
  ]);
});

test("an admission carrying no approval consumes nothing, with a spendable one in the store", async () => {
  // **The absence with its control.** An ordinary `rondo start` runs beside an
  // unspent approval and leaves it alone -- and the only difference between
  // this call and the one below it is the argument that carries the approval,
  // so an implementation that consumed on every admission would fail the first
  // half and an implementation that consumed on none would fail the second.
  const { h, decisionId, approved } = await approvedChain();
  h.answers.classify = answered("allowed");

  const unrelated = await admit(h.ports, h.advisory, PLAN, POLICY, "i-0009");
  expect(unrelated.iterationId).toBe("i-0009");
  expect(rowsIn(h.connection, "decision_consumption").length).toBe(0);
  expect((await h.advisory.record.unconsumedDecisions()).length).toBe(1);

  const resolved = await approvedRetry(h.advisory, PROPOSAL_ID);
  if (resolved.kind !== "resolved") {
    throw new Error("the chain did not resolve");
  }
  const spent = await admit(h.ports, h.advisory, resolved.retry.plan, POLICY, SUCCESSOR, SUBJECT, {
    decisionId,
    contractDigest: approved,
  });
  expect(spent.iterationId).toBe(SUCCESSOR);
  expect(rowsIn(h.connection, "decision_consumption").length).toBe(1);
});

test("a declined proposal resolves to nothing, and an unanswered one to nothing either", async () => {
  // D-0032 rule 6: a refusal is a row, and it authorises nothing. Both halves
  // are measured on the same proposal, before and after an answer exists.
  const h = harness(answered("needs_approval"));
  await admit(h.ports, h.advisory, PLAN, POLICY, SUBJECT);

  const unanswered = await approvedRetry(h.advisory, PROPOSAL_ID);
  expect(unanswered.kind).toBe("refused");

  await recordAnswer(
    { record: h.advisory.record, now: () => NOW_MS },
    { proposalId: PROPOSAL_ID, outcome: "declined", contractDigest: null, actorId: APPROVER },
  );
  const declined = await approvedRetry(h.advisory, PROPOSAL_ID);
  expect(declined.kind).toBe("refused");
  expect(rowsIn(h.connection, "decision_consumption").length).toBe(0);
});

test("a digest from another proposal's option set is refused at the answer, on the real chain", async () => {
  // **N-20, on the infrastructure that produced it** (D-0049 rule 2). Two laps
  // stop, each leaving a `contract_keys` proposal with its own composed option
  // set; the operator answers the second proposal with a digest off the first.
  // Every value here was composed by the real cadenza facade, so nothing about
  // the typed digest is malformed -- it is simply an answer to a question this
  // proposal never asked.
  const h = harness(answered("needs_approval"));
  await admit(h.ports, h.advisory, PLAN, POLICY, "i-0000");
  const first = composed(h.connection);
  await admit(
    h.ports,
    h.advisory,
    { ...PLAN, prompt: "teach rondo to count, but differently" },
    POLICY,
    "i-0001",
    "i-0000",
  );
  const second = composed(h.connection).filter((digest) => !first.includes(digest));
  // The premise, asserted rather than assumed: the two proposals put different
  // contracts on the screen, so the crossed digest really is foreign to the
  // second one.
  expect(first.length).toBeGreaterThan(0);
  expect(second.length).toBeGreaterThan(0);
  const theirs = first[0] as string;
  const proposals = rowsIn(h.connection, "proposal").map((row) => String(row["proposal_id"]));
  const mine = proposals[proposals.length - 1] as string;

  const crossed = await recordAnswer(
    { record: h.advisory.record, now: () => NOW_MS },
    { proposalId: mine, outcome: "approved", contractDigest: theirs, actorId: APPROVER },
  );

  expect(crossed.kind).toBe("refused");
  if (crossed.kind === "refused") {
    expect(crossed.reason).toContain("no option this proposal put on");
    // The option set is printed, so the operator can retype off the refusal.
    expect(crossed.reason).toContain(second[0] as string);
  }
  // **No row anywhere**: not the approval, and not the consumption it would
  // have authorised. The state N-20 recorded was an approval that lived for
  // ever on D-0022 rule 19's list; there is nothing here to live on it.
  expect(rowsIn(h.connection, "human_decision").length).toBe(0);
  expect(rowsIn(h.connection, "decision_consumption").length).toBe(0);

  // **The control, one thing changed**: the same operator, the same proposal,
  // a digest that proposal did put on the screen. It is recorded, and it is
  // spendable -- which is what makes the refusal above a refusal of one case
  // rather than of route S.
  const straight = await recordAnswer(
    { record: h.advisory.record, now: () => NOW_MS },
    {
      proposalId: mine,
      outcome: "approved",
      contractDigest: second[0] as string,
      actorId: APPROVER,
    },
  );
  expect(straight.kind).toBe("answered");
  expect(rowsIn(h.connection, "human_decision").length).toBe(1);
});

test("an approval whose digest two options share is refused rather than resolved by order", async () => {
  // **`run_plan` is where one digest can name two plans.** `issueFor` composes a
  // contract from the project, the agent type and the parties, so two plans in
  // one lineage that differ only in their prompt reach the same contract -- and
  // `human_decision.approved` names a digest and nothing else. Taking the first
  // match would be rondo deciding which set of instructions a person meant.
  const h = harness(answered("needs_approval"));
  await admit(h.ports, h.advisory, PLAN, POLICY, "i-0000");
  await admit(
    h.ports,
    h.advisory,
    { ...PLAN, prompt: "teach rondo to count, but differently" },
    POLICY,
    "i-0001",
    "i-0000",
  );

  const shown: string[] = [];
  const proposal = await proposeRetry(
    { ...h.advisory, present: (lines) => shown.push(...lines) },
    "run_plan",
    "i-0001",
    "i-0009",
  );
  expect(proposal.kind).toBe("proposed");
  if (proposal.kind !== "proposed") {
    return;
  }
  // The premise, asserted rather than assumed: two options, one digest.
  expect(proposal.options.length).toBe(2);
  const digests = proposal.options.map((option) => option.value);
  expect(digests[0]).toBe(digests[1]);

  await recordAnswer(
    { record: h.advisory.record, now: () => NOW_MS },
    {
      proposalId: proposal.proposalId,
      outcome: "approved",
      contractDigest: digests[0] as string,
      actorId: APPROVER,
    },
  );
  const resolved = await approvedRetry(h.advisory, proposal.proposalId);
  expect(resolved.kind).toBe("refused");
  if (resolved.kind === "refused") {
    expect(resolved.reason).toContain("does not say which of them was taken");
  }
  expect(rowsIn(h.connection, "decision_consumption").length).toBe(0);
});
