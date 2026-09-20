/**
 * The success side of the page's presses, driven over a real continuo
 * (rondo#239).
 *
 * Every press on the page is already tested in both directions **at the port**
 * -- accepted for a native navigate, refused for an htmx/cors/fetch shape, a
 * `GET`, a wrong token, a send value or a replay -- and every refusal that
 * lands before the irreversible act is tested over a real store. What had no
 * test at all was the *act*: the gate that actually closes, the lap that
 * actually runs, the branch that actually moves. #239 is the entry that says
 * so, and this file is the part of it that could be built.
 *
 * ## What is real here, and what is not
 *
 * **Real:** the continuo build (the pinned revision, verified at startup), its
 * control plane, the run it admits, the worktree it materialises, the gate it
 * opens, every verb of the walk that closes that gate, rondo's own store, and
 * the git repository underneath it all.
 *
 * **Not real: what the worker did.** continuo has no verb that opens a gate --
 * a gate exists because `lap perform` opened one over what a worker reported --
 * so a test that wants a real gate has to perform a real lap, and a real lap
 * spawns an agent session. That is the whole reason S1, S3 and S4's success
 * paths were carried as a known limit through #231, #234 and #235. The way
 * through is that `lap perform --claude-command` takes an absolute command
 * *prefix*, and continuo's own suite drives it with
 * `test/session/helpers/fake-claude.mjs` -- a program that speaks the worker
 * CLI's stream-json surface and nothing else. The pin is a commit, so that file
 * is pinned with it, and rondo's CI clones the whole checkout to build
 * `dist/cli.js`, which is what makes it reachable here rather than only
 * locally.
 *
 * So the line this file draws is: **only the worker's turn is stood in for.**
 * Nothing rondo does is faked, and no press is given a seam it does not have in
 * `rondo web`.
 *
 * ## Mandatory in CI, capability-gated locally
 *
 * `test/continuo/smoke.test.ts`'s rule and its spelling: every double-green
 * cell provisions the pinned continuo, so under CI a missing capability is a
 * failure rather than a skip -- a suite that skipped itself there would make a
 * green gate mean nothing about the seam it claims to cover. Locally the skip
 * says exactly what to set.
 *
 * ## The one thing on PATH
 *
 * A lap that stops at `awaiting_human` takes a model reading (D-0065), and the
 * reviewer is `codex`, spawned by name through `PATH`. That reading is not what
 * this file is about, and an unavailable one is a real recorded outcome
 * (D-0065 2.4) rather than a hole -- but on a developer machine with `codex`
 * logged in, leaving it alone would spend a real review inside `npm test`. So a
 * `codex` that exits non-zero is put first on `PATH` for this file, and the
 * reading it produces is asserted as `unavailable` rather than ignored.
 */
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import {
  answerFromPage,
  recordScopeFromPage,
  reviseFromPage,
  startScopedFromPage,
} from "../../src/access/cli.js";
import { agentTypeRecordOf } from "../../src/access/scope.js";
import { newIterationId, newScopeId, type ScopeFormDraft } from "../../src/access/web-app.js";
import { CLI_PATH_ENV, run, startContinuo } from "../../src/continuo/invoker.js";
import { CONTINUO_REVISION } from "../../src/continuo/pin.js";
import { DB_CREATE, GATE_SHOW } from "../../src/continuo/protocol.js";
import { allocate } from "../../src/refrain/allocator.js";
import {
  admittedPlan,
  planPayload,
  type RunPlan,
  readRunPlan,
  runPlan,
} from "../../src/refrain/plan.js";
import { planDigest } from "../../src/store/plan.js";
import type { JsonRecord } from "../../src/store/records.js";
import { advisoryRecord, iterationStore } from "../../src/store/sqlite.js";
import { EVIDENCE, PLAN } from "./page-world.js";

/** Whether this is a CI run, spelled as `vitest.config.ts` spells it (D-0003). */
function inContinuousIntegration(): boolean {
  const raw = process.env.CI;
  return raw !== undefined && raw !== "" && raw !== "false" && raw !== "0";
}

const located = process.env[CLI_PATH_ENV];
/**
 * The pinned checkout, derived from the CLI path rather than named by a second
 * variable: CI points `RONDO_CONTINUO_CLI` at `<checkout>/dist/cli.js`, and a
 * second variable would be a second thing a provisioning step could forget.
 */
const checkout =
  located === undefined || located.trim() === "" ? null : dirname(dirname(located.trim()));
/** continuo's own fake worker CLI, inside the pinned checkout. */
const fakeWorker =
  checkout === null ? null : join(checkout, "test", "session", "helpers", "fake-claude.mjs");
const available = fakeWorker !== null && existsSync(fakeWorker);

if (!available && inContinuousIntegration()) {
  // Not a skip and not a soft warning, for `smoke.test.ts`'s reason: under CI
  // the pinned checkout is provisioned, so its absence means the step did not
  // run -- or that the pin moved to a revision that spells the fake worker's
  // path differently, which is a thing to go and look at rather than to skip.
  throw new Error(
    `${CLI_PATH_ENV} is not set, or the pinned checkout does not hold ` +
      `test/session/helpers/fake-claude.mjs. Every double-green cell provisions the pinned ` +
      `continuo (${CONTINUO_REVISION}); the success side of the page's presses is not optional ` +
      "there (rondo#239).",
  );
}

/** Why this file is not running, in each test's own name, so a skip is legible. */
const skipNote = available
  ? ""
  : ` [skipped: ${CLI_PATH_ENV} is unset, or its checkout holds no ` +
    `test/session/helpers/fake-claude.mjs; point it at a built continuo dist/cli.js at ` +
    `${CONTINUO_REVISION}]`;

/** What the stood-in worker reports, and therefore what the gate is opened over. */
const REPORTED = "I stopped before the push. May I go on?";

if (available) {
  process.env["FAKE_RESULT_TEXT"] = REPORTED;
  // The reviewer, defused. Written for POSIX only: on Windows `spawn` without a
  // shell would not resolve this script anyway, and `codex` is not installed on
  // that runner, so the outcome there is the same spawn failure by another
  // route.
  if (process.platform !== "win32") {
    const shims = mkdtempSync(join(tmpdir(), "rondo-press-shims-"));
    const codex = join(shims, "codex");
    writeFileSync(codex, "#!/bin/sh\nexit 1\n", "utf8");
    chmodSync(codex, 0o755);
    process.env["PATH"] = `${shims}${delimiter}${process.env["PATH"] ?? ""}`;
  }
}

/** A real, cadenza-valid agent type, as `test/access/web-scope.test.ts` holds one. */
const AGENT_TYPE_INPUT = {
  agentTypeId: "worker-basic",
  vocabularyVersion: 1,
  granted: ["command.run"],
  askable: ["branch.push"],
  loopPolicy: { maxReviewRounds: 2, noProgressWindow: 3, noProgressRepeat: 2 },
  executorPolicy: { roleName: "worker", modelTier: "standard", reportingDuties: [] },
};

/**
 * The plan a press actually runs on: {@link PLAN}'s shape with every path
 * pointing at this case's own directories, and the worker CLI standing in.
 */
function pressPlan(dir: string, repository: string): RunPlan {
  return {
    ...PLAN,
    db: join(dir, "continuo.sqlite3"),
    repository,
    workspaceRoot: join(dir, "work"),
    artifactRoot: join(dir, "artifacts"),
    stateRoot: join(dir, "state"),
    interlockRoot: join(dir, "interlock"),
    claudeOrgPath: join(dir, "claude-org"),
    endpointDestinationDir: join(dir, "dropbox"),
    // A path, not a module: nothing here starts an endpoint, and what the lap
    // needs is a configuration value that is absolute and outside the worktree.
    endpointModule: join(dir, "endpoint.js"),
    node: process.execPath,
    claudeCommand: [process.execPath, fakeWorker ?? ""],
    agentTypeInput: AGENT_TYPE_INPUT as unknown as RunPlan["agentTypeInput"],
    parties: { issuer: "rondo-host", grantee: "unset" } as unknown as RunPlan["parties"],
    intendedAction: { capabilities: ["command.run"] } as unknown as RunPlan["intendedAction"],
    // A catalog layer cadenza can actually read: `PLAN`'s carries an empty
    // `data`, which every classification here refuses as undecidable.
    catalogLayers: [
      {
        layer: "tracked",
        origin: "the press fixture",
        baseDir: join(dir, "catalog"),
        data: {
          schema_version: 1,
          project: {
            rondo: {
              source: { kind: "git_url", url: "https://example.invalid/org/rondo.git" },
              base_branch: "main",
            },
          },
        },
      },
    ],
    // The fake worker writes its terminal line at once, so the lap only waits
    // for as long as the poll interval.
    pollIntervalMs: 20,
  };
}

/** {@link pressPlan} as a document a person could have pasted into the thread. */
function planDocument(dir: string, repository: string): JsonRecord {
  const plan = pressPlan(dir, repository);
  const validated = runPlan(plan);
  if (validated.kind !== "planned") {
    throw new Error(`the press fixture plan is not valid: ${validated.reason}`);
  }
  const allocation = allocate("press-plan-fixture", plan.workspaceRoot);
  if (allocation.kind !== "allocated") {
    throw new Error(`the press fixture id does not allocate: ${allocation.reason}`);
  }
  const admitted = admittedPlan(validated.plan, allocation.allocation);
  if (admitted.kind !== "planned") {
    throw new Error(`the press fixture allocation is not valid: ${admitted.reason}`);
  }
  return planPayload(admitted.plan);
}

/** A git repository with one commit on `main`, for the lap to be cut from. */
function seedRepository(repository: string): void {
  mkdirSync(repository, { recursive: true });
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", repository, ...args], {
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "rondo test",
        GIT_AUTHOR_EMAIL: "test@example.invalid",
        GIT_COMMITTER_NAME: "rondo test",
        GIT_COMMITTER_EMAIL: "test@example.invalid",
      },
    });
  execFileSync("git", ["init", "--quiet", "--initial-branch", "main", repository]);
  writeFileSync(join(repository, "README.md"), "# base\n", "utf8");
  git("add", "README.md");
  git("commit", "--quiet", "-m", "chore: the base");
}

/** What a press is handed: the approver, and the continuo the page would start. */
const environmentFor = () => ({ RONDO_APPROVER: "ada", [CLI_PATH_ENV]: located ?? "" });

interface PressWorld {
  readonly dir: string;
  readonly db: string;
  readonly storePath: string;
  readonly connection: DatabaseSync;
  readonly store: ReturnType<typeof iterationStore>;
  readonly record: ReturnType<typeof advisoryRecord>;
  readonly requestMessageId: string;
  readonly scopeDecisionId: string;
  readonly planDigest: string;
}

/**
 * Everything standing before a press: a repository, a control plane, a store
 * with a request in it, a plan held against that request, and the person's
 * approval of a scope over it -- all of it through the writers the page uses.
 */
async function pressWorld(label: string): Promise<PressWorld> {
  const dir = mkdtempSync(join(tmpdir(), `rondo-press-${label}-`));
  const repository = join(dir, "repo");
  seedRepository(repository);
  for (const child of ["artifacts", "state", "interlock", "claude-org", "dropbox"]) {
    mkdirSync(join(dir, child), { recursive: true });
  }

  const storePath = join(dir, "store.db");
  const connection = new DatabaseSync(storePath);
  const store = iterationStore(connection, { maxOccupying: 4, maxLive: 6 });
  const record = advisoryRecord(connection);

  // The control plane, created by the pinned build itself: rondo never creates
  // one, and a hand-built schema would be a second answer to what head is.
  const started = await startContinuo(environmentFor());
  if (started.kind !== "ready") {
    // `expect.unreachable` returns `never`, so the reason is surfaced as the
    // whole diagnosis rather than asserted into a boolean (`smoke.test.ts`).
    expect.unreachable(`continuo did not verify: ${started.reason}`);
  }
  const db = join(dir, "continuo.sqlite3");
  const created = await run(started.continuo, DB_CREATE, ["--db", db]);
  if (created.kind !== "answered") {
    throw new Error(`db create did not answer: ${JSON.stringify(created)}`);
  }

  const requestMessageId = `request-${label}`;
  const asked = await record.recordThreadMessage({
    messageId: requestMessageId,
    body: "Add a retry budget, and make it end.",
    authorKind: "operator",
    authorId: "ada",
    inReplyTo: null,
    atMs: 1_000,
    bases: [],
    asks: false,
  });
  expect(asked.kind).toBe("recorded");

  // The plan, pasted into the request's thread as a reply, which is what makes
  // it a plan rondo holds (D-0071 point 1 (a)).
  const document = planDocument(dir, repository);
  const held = await record.recordThreadMessage({
    messageId: `${requestMessageId}-plan`,
    body: JSON.stringify(document),
    authorKind: "operator",
    authorId: "ada",
    inReplyTo: requestMessageId,
    atMs: 1_100,
    bases: [],
    asks: false,
  });
  expect(held.kind).toBe("recorded");
  const readBack = readRunPlan(document);
  if (readBack.kind !== "planned") {
    throw new Error(`the press fixture document does not read back: ${readBack.reason}`);
  }
  const rebuilt = agentTypeRecordOf(readBack.plan, document);
  if ("refusal" in rebuilt) {
    throw new Error(`the press fixture agent type builds no record: ${rebuilt.refusal}`);
  }

  const draft: ScopeFormDraft = {
    scopeId: newScopeId(),
    requestMessageId,
    planDigest: planDigest(document),
    agentTypeDigest: rebuilt.record.agentTypeDigest,
    // Two laps and two rounds: the revise press runs a second lap under this
    // same approval, and a budget of one would refuse it for the right reason
    // at the wrong moment.
    budgets: {
      laps: 4,
      review_rounds: 2,
      cost_usd: 50,
      cost_reserve_usd: 5,
      expires_at_ms: 9_999_999_999_999,
    },
    severityThreshold: "major",
    outwardActs: [],
  };
  const scoped = await recordScopeFromPage(environmentFor(), store, storePath, "ada", draft);
  expect(scoped.ok, scoped.note).toBe(true);
  const scopeDecisionId = scoped.scopeDecisionId;
  if (scopeDecisionId === undefined) {
    throw new Error("the scope press approved nothing");
  }

  return {
    dir,
    db,
    storePath,
    connection,
    store,
    record,
    requestMessageId,
    scopeDecisionId,
    planDigest: draft.planDigest,
  };
}

/**
 * One scoped start press, awaited: the lap the page's button starts, run for
 * real, and the row it left behind.
 */
async function startOnePress(world: PressWorld): Promise<{ iterationId: string; gateId: string }> {
  const iterationId = newIterationId();
  const started = await startScopedFromPage(environmentFor(), world.store, world.storePath, "ada", {
    iterationId,
    requestMessageId: world.requestMessageId,
    scopeDecisionId: world.scopeDecisionId,
    planDigest: world.planDigest,
  });
  expect(started.ok, `${started.why ?? ""}: ${started.note}`).toBe(true);
  const read = await world.store.read(iterationId);
  if (read.kind !== "read") {
    throw new Error(`the started lap would not read: ${JSON.stringify(read)}`);
  }
  expect(read.record.status).toBe("awaiting_human");
  const gateId = read.record.gateId;
  expect(gateId).not.toBeNull();
  return { iterationId, gateId: gateId ?? "" };
}

/** A lap's own gate, as continuo holds it. */
async function gateOf(world: PressWorld, gateId: string) {
  const started = await startContinuo(environmentFor());
  if (started.kind !== "ready") {
    throw new Error(`continuo did not verify: ${started.reason}`);
  }
  const observed = await run(started.continuo, GATE_SHOW, ["--db", world.db, "--gate-id", gateId]);
  if (observed.kind !== "answered") {
    throw new Error(`gate show did not answer: ${JSON.stringify(observed)}`);
  }
  return observed.payload;
}

/**
 * The model reading the revise press requires, written into the store.
 *
 * **The reviewer is a model, and this file does not run one** (see the header:
 * `codex` is defused here on purpose). D-0065 5.4 makes a reading that is
 * `unavailable` a refusal of the revise press, so without this the press under
 * test is never reached -- and what #239 says has no test is the press, not the
 * reading. So the reading is supplied as store state, exactly as
 * `page-world.ts`'s `modelFindings` supplies it to every other S4 test; the
 * gate walk and the second lap it gates are still the real ones.
 */
async function readingAtTheGate(world: PressWorld, iterationId: string): Promise<void> {
  const appended = await world.store.appendReading(
    iterationId,
    {
      drafter: "rondo/model/1/gpt-6-astra",
      verdict: "concerns",
      findings: ["the backoff is not capped"],
      graded: [
        {
          severity: "major",
          bases: [{ kind: "file", path: "README.md", line: 1 }],
          basisResolved: true,
        },
      ],
      evidence: EVIDENCE,
      unavailableReason: null,
    },
    // Now, not a fixed instant: the scoped start already appended its own
    // (unavailable) reading at wall-clock time, and what the readings test
    // weighs is the latest one.
    Date.now(),
  );
  expect(appended.kind).toBe("appended");
}

/** Eight subprocesses and a git materialisation; a floor under runner variance. */
const PRESS_TIMEOUT_MS = 180_000;

test.skipIf(!available)(
  `the scoped start press runs a real lap and leaves a person being asked something (#233 S3)${skipNote}`,
  async () => {
    const world = await pressWorld("start");
    const { iterationId, gateId } = await startOnePress(world);

    // **The gate is continuo's, and it stands over what the worker reported.**
    // A press that had admitted a run and stopped, or one whose lap had failed,
    // would not reach here: the row is at `awaiting_human` because continuo
    // opened a gate and rondo read it back.
    const gate = await gateOf(world, gateId);
    expect(gate.outcome).toBeNull();
    expect(gate.runId).not.toBeNull();
    expect(gate.rationale).toContain(REPORTED);

    // **The worktree is on disk, cut from the repository the plan named.** The
    // lap materialised it; nothing in this test wrote it.
    const read = await world.store.read(iterationId);
    if (read.kind !== "read") {
      throw new Error("the started lap would not read");
    }
    expect(existsSync(read.record.workspace ?? "")).toBe(true);

    // **And the reading that a scoped start takes at the gate is there**, as
    // `unavailable`: the reviewer is defused for this file, and D-0065 2.4 says
    // an attempt that was stopped is recorded rather than skipped -- so its
    // absence here would mean the press skipped a step, not that a model was
    // missing.
    const readings = await world.store.readingsFor(iterationId);
    const model = readings.filter((reading) => reading.drafter.startsWith("rondo/model/"));
    expect(model).toHaveLength(1);
    expect(model[0]?.verdict).toBe("unavailable");
  },
  PRESS_TIMEOUT_MS,
);

test.skipIf(!available)(
  `the approve press closes the real gate it was drawn over (#233 S1)${skipNote}`,
  async () => {
    const world = await pressWorld("answer");
    const { iterationId, gateId } = await startOnePress(world);

    // Open, and answered by nobody, until the press below.
    expect((await gateOf(world, gateId)).outcome).toBeNull();

    const answered = await answerFromPage(
      environmentFor(),
      world.store,
      world.storePath,
      "ada",
      iterationId,
      "Go on.",
      null,
    );
    expect(answered.ok, answered.note).toBe(true);

    // **continuo's own answer**: the gate is closed, and closed as the walk's
    // last ack closes one -- `answered_and_forwarded`, which is continuo's
    // outcome and not in `gate close`'s vocabulary at all.
    const gate = await gateOf(world, gateId);
    expect(gate.outcome).toBe("answered_and_forwarded");

    // **And rondo's**: the row settled, on continuo's answer rather than on the
    // press's own say-so.
    const read = await world.store.read(iterationId);
    if (read.kind !== "read") {
      throw new Error("the answered lap would not read");
    }
    expect(read.record.status).toBe("closed");
  },
  PRESS_TIMEOUT_MS,
);

test.skipIf(!available)(
  `the revise press answers the real gate and runs the second lap under the same approval (#233 S4)${skipNote}`,
  async () => {
    const world = await pressWorld("revise");
    const { iterationId, gateId } = await startOnePress(world);
    await readingAtTheGate(world, iterationId);
    const successorId = newIterationId();

    const revised = await reviseFromPage(environmentFor(), world.store, world.storePath, "ada", {
      iterationId,
      successorId,
      scopeDecisionId: world.scopeDecisionId,
      body: "Cap the backoff at thirty seconds.",
    });
    expect(revised.ok, `${revised.why ?? ""}: ${revised.note}`).toBe(true);

    // The first lap's gate carried the person's words and is gone.
    const gate = await gateOf(world, gateId);
    expect(gate.outcome).toBe("answered_and_forwarded");

    // And the second lap ran, on its own run in the same control plane, under
    // the approval the first ran under.
    const successor = await world.store.read(successorId);
    if (successor.kind !== "read") {
      throw new Error(`the revision would not read: ${JSON.stringify(successor)}`);
    }
    expect(successor.record.supersedesIterationId).toBe(iterationId);
    expect(successor.record.status).toBe("awaiting_human");
    expect(successor.record.gateId).not.toBe(gateId);
  },
  PRESS_TIMEOUT_MS,
);
