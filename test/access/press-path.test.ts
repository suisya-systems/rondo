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
 * **Not real either, and only for the publish press: the forge's own CLI.**
 * #239's remaining leg needs a forge that can take a pull request, and no runner
 * has one; the credential-less refusal `test/access/web-publish.test.ts` asserts
 * is the boundary, not the leg. So the publish cases below stand in for `gh`
 * itself -- an executable of that name, first on `PATH` (see
 * {@link standInForPullRequest}) -- and for nothing nearer than that. Everything
 * on rondo's side of that boundary is the real route: the plan is the shared
 * `publishPlanFor`, the push ahead of it is a real `git push` to a real bare
 * repository, `openPullRequest` builds the argument list and starts the process
 * itself, and the run close behind it is the pinned continuo's own `run close`.
 * What the tests read back is the argv the forge's CLI was handed.
 *
 * So the line this file draws is: **only the worker's turn, and the one forge
 * command, are stood in for.** Nothing rondo does is faked, and no press is
 * given a seam it does not have in `rondo web`.
 *
 * ## One thing here is not a press (rondo#228)
 *
 * The two `revise` cases at the end of the file are typed at the terminal rather
 * than pressed: `main` is the entry point, and the argv is what a person writes.
 * They are here because what they have to say needs the same thing the presses
 * need -- **a gate that really stands** -- and a gate exists only where a real
 * lap opened one. A typed `revise` that draws its approval from the record
 * charges that approval and says which one before it walks the gate; the
 * refusals that cost nothing are over a store in
 * `test/access/scope-stop.test.ts`, where no seam is reached at all.
 *
 * ## Mandatory in CI, capability-gated locally
 *
 * `test/continuo/smoke.test.ts`'s rule and its spelling: every double-green
 * cell provisions the pinned continuo, so under CI a missing capability is a
 * failure rather than a skip -- a suite that skipped itself there would make a
 * green gate mean nothing about the seam it claims to cover. Locally the skip
 * says exactly what to set.
 *
 ## No model is ever spawned, and not by luck
 *
 * A lap that stops at `awaiting_human` takes a model reading (D-0065), and the
 * reviewer is a real `codex`. Nothing here spawns one, because the plan these
 * presses run on **names no review criterion**, and D-0029 rule 13 refuses the
 * reading before a process exists: there is nothing to grade against. That is a
 * property of the fixture rather than of the machine, so it holds on a
 * developer's laptop with `codex` logged in exactly as it holds on a runner
 * with no `codex` at all -- and an attempt recorded as `unavailable` is D-0065
 * 2.4's own outcome rather than a hole, so the row is asserted rather than
 * ignored. A defusing trick on `PATH` was tried first and dropped: it could not
 * be written for Windows, where a native `codex.exe` would have run for real.
 */
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import {
  answerFromPage,
  answerUnderScope,
  main,
  publishFromPage,
  publishingForPage,
  raiseScopeFromPage,
  recordScopeFromPage,
  reviseFromPage,
  reviseUnderScope,
  startScopedFromPage,
} from "../../src/access/cli.js";
import { consoleSeams } from "../../src/access/console.js";
import { GATE_ACTOR } from "../../src/access/gate-host.js";
import { agentTypeRecordOf } from "../../src/access/scope.js";
import { newIterationId, newScopeId, type ScopeFormDraft } from "../../src/access/web-app.js";
import { EN } from "../../src/access/wording.js";
import { CLI_PATH_ENV, run, startContinuo } from "../../src/continuo/invoker.js";
import { CONTINUO_REVISION } from "../../src/continuo/pin.js";
import { DB_CREATE, GATE_SHOW, RUN_SHOW } from "../../src/continuo/protocol.js";
import { allocate } from "../../src/refrain/allocator.js";
import {
  admittedPlan,
  planPayload,
  type RunPlan,
  readRunPlan,
  runPlan,
} from "../../src/refrain/plan.js";
import { planDigest } from "../../src/store/plan.js";
import { approvedForPublication, type JsonRecord } from "../../src/store/records.js";
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
const provisioned = fakeWorker !== null && existsSync(fakeWorker);

/**
 * Whether this process may not create a Unix socket -- the one condition under
 * which the pinned continuo refuses `lap perform` (continuo D-1112 rule 4), as
 * it does when this suite runs inside another Claude Code sandbox. The laps here
 * are real, so under that filter they can only be refused; CI runs outside one,
 * and there the question does not skip anything.
 */
async function unixSocketBlocked(): Promise<boolean> {
  if (process.platform !== "linux") {
    return false;
  }
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", (error: NodeJS.ErrnoException) => resolve(error.code === "EPERM"));
    server.listen(`\0rondo-press-path-${String(process.pid)}`, () =>
      server.close(() => resolve(false)),
    );
  });
}
const nested = provisioned && !inContinuousIntegration() && (await unixSocketBlocked());
const available = provisioned && !nested;

if (!provisioned && inContinuousIntegration()) {
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
  : nested
    ? " [skipped: this process may not create a Unix socket, so continuo refuses every lap " +
      "(continuo D-1112); run the suite outside the enclosing sandbox]"
    : ` [skipped: ${CLI_PATH_ENV} is unset, or its checkout holds no ` +
      `test/session/helpers/fake-claude.mjs; point it at a built continuo dist/cli.js at ` +
      `${CONTINUO_REVISION}]`;

/** What the stood-in worker reports, and therefore what the gate is opened over. */
const REPORTED = "I stopped before the push. May I go on?";

if (available) {
  // The one switch continuo's fake worker is told anything through: it is
  // spawned by continuo with a copy of this process's environment.
  process.env["FAKE_RESULT_TEXT"] = REPORTED;
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
              // cadenza D-0041: the agent type grants command.run, so the
              // project must declare what it may run; absent grants nothing.
              allowed_bash: ["npm run:*"],
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

/**
 * A git repository with one commit on `main`, pushed to a bare `origin` beside
 * it: a first lap is cut from the forge's branch, fetched at admission
 * (rondo#407), so a repository with no forge is one no lap starts in.
 */
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
  const forge = `${repository}.git`;
  execFileSync("git", ["init", "--quiet", "--bare", "--initial-branch", "main", forge]);
  git("remote", "add", "origin", forge);
  git("push", "--quiet", "origin", "main");
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
    // `unavailable`: D-0065 2.4 says an attempt that was stopped is recorded
    // rather than skipped, so its absence here would mean the press skipped a
    // step. Its reason is asserted too, because that reason is what says no
    // model was spawned on any machine (see the header).
    const readings = await world.store.readingsFor(iterationId);
    const model = readings.filter((reading) => reading.drafter.startsWith("rondo/model/"));
    expect(model).toHaveLength(1);
    expect(model[0]?.verdict).toBe("unavailable");
    expect(model[0]?.unavailableReason).toContain("review criterion");
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
    // **Which answer it was** (rondo#385, D-0092): recorded by the walk, and
    // named by the press rather than by the words carried.
    expect(read.record.gateAnswer).toBe("approve");
  },
  PRESS_TIMEOUT_MS,
);

test.skipIf(!available)(
  `the organisation's answer closes the real gate, recorded by continuo as delegated (#467)${skipNote}`,
  async () => {
    const world = await pressWorld("delegated");
    const { iterationId } = await startOnePress(world);
    const read = await world.store.read(iterationId);
    if (read.kind !== "read") {
      throw new Error("the started lap would not read");
    }
    const answered = await answerUnderScope(
      environmentFor(),
      world.store,
      world.storePath,
      read.record,
      { onBehalfOf: "ada", authorityRef: world.scopeDecisionId },
    );
    expect(answered).toEqual({ kind: "delegated" });

    // **continuo's record**: the answer is a delegate's, naming the person and
    // the approval, and never a human press (continuo D-1121).
    const gate = await gateOf(world, read.record.gateId ?? "");
    expect(gate.outcome).toBe("answered_and_forwarded");
    const control = new DatabaseSync(world.db, { readOnly: true });
    try {
      expect(
        control
          .prepare(
            "SELECT actor_kind, actor_id, on_behalf_of, authority_ref FROM gate_transition " +
              "WHERE gate_id = ? AND to_stage = 'answered'",
          )
          .all(read.record.gateId),
      ).toEqual([
        {
          actor_kind: "delegate",
          actor_id: GATE_ACTOR,
          on_behalf_of: "ada",
          authority_ref: world.scopeDecisionId,
        },
      ]);
    } finally {
      control.close();
    }

    // **And rondo's**: the row settled, and the answer recorded as approve.
    const after = await world.store.read(iterationId);
    if (after.kind !== "read") {
      throw new Error("the answered lap would not read");
    }
    expect(after.record.status).toBe("closed");
    expect(after.record.gateAnswer).toBe("approve");
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
    // **And the first lap says it was asked to change, not approved**
    // (rondo#385, D-0092): the record, and so no pull request is offered for it.
    const first = await world.store.read(iterationId);
    if (first.kind !== "read") {
      throw new Error("the revised lap would not read");
    }
    expect(first.record.gateAnswer).toBe("revise");
    expect(approvedForPublication(first.record)).toBe(false);
  },
  PRESS_TIMEOUT_MS,
);

/** Wait for a lap rondo's own send started in the background to reach a status it stops at. */
async function settledLap(world: PressWorld, iterationId: string) {
  for (const deadline = Date.now() + PRESS_TIMEOUT_MS; Date.now() < deadline; ) {
    const read = await world.store.read(iterationId);
    if (
      read.kind === "read" &&
      !["planned", "classified", "admitting", "admitted", "performing"].includes(read.record.status)
    ) {
      return read.record;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`lap '${iterationId}' did not settle`);
}

test.skipIf(!available)(
  `rondo's send of a drafted change answers the real gate as delegated and starts the next lap (D-0145)${skipNote}`,
  async () => {
    const world = await pressWorld("scoped-revise");
    const { iterationId, gateId } = await startOnePress(world);
    await readingAtTheGate(world, iterationId);
    const read = await world.store.read(iterationId);
    if (read.kind !== "read") {
      throw new Error("the started lap would not read");
    }
    const successorId = newIterationId();
    const sent = await reviseUnderScope(
      environmentFor(),
      world.store,
      world.storePath,
      "ada",
      EN,
      read.record,
      {
        successorId,
        scopeDecisionId: world.scopeDecisionId,
        body: "Cap the backoff at thirty seconds.",
        delegation: { onBehalfOf: "ada", authorityRef: world.scopeDecisionId },
        recheck: async () => true,
      },
    );
    expect(sent).toEqual({ kind: "sent" });
    const successor = await settledLap(world, successorId);
    expect(successor.supersedesIterationId).toBe(iterationId);
    expect(successor.status).toBe("awaiting_human");

    // **continuo's record**: the change is a delegate's, never a human press.
    const control = new DatabaseSync(world.db, { readOnly: true });
    try {
      expect(
        control
          .prepare(
            "SELECT actor_kind, actor_id, on_behalf_of, authority_ref FROM gate_transition " +
              "WHERE gate_id = ? AND to_stage = 'answered'",
          )
          .all(gateId),
      ).toEqual([
        {
          actor_kind: "delegate",
          actor_id: GATE_ACTOR,
          on_behalf_of: "ada",
          authority_ref: world.scopeDecisionId,
        },
      ]);
    } finally {
      control.close();
    }
    const first = await world.store.read(iterationId);
    if (first.kind !== "read") {
      throw new Error("the revised lap would not read");
    }
    expect(first.record.gateAnswer).toBe("revise");
  },
  PRESS_TIMEOUT_MS * 2,
);

test.skipIf(!available)(
  `rondo's send whose re-test fails walks nothing and starts nothing (D-0145)${skipNote}`,
  async () => {
    const world = await pressWorld("scoped-revise-moved");
    const { iterationId, gateId } = await startOnePress(world);
    await readingAtTheGate(world, iterationId);
    const read = await world.store.read(iterationId);
    if (read.kind !== "read") {
      throw new Error("the started lap would not read");
    }
    const successorId = newIterationId();
    const sent = await reviseUnderScope(
      environmentFor(),
      world.store,
      world.storePath,
      "ada",
      EN,
      read.record,
      {
        successorId,
        scopeDecisionId: world.scopeDecisionId,
        body: "Cap the backoff at thirty seconds.",
        delegation: { onBehalfOf: "ada", authorityRef: world.scopeDecisionId },
        recheck: async () => false,
      },
    );
    expect(sent).toMatchObject({ kind: "notSent", answered: false });
    expect((await gateOf(world, gateId)).outcome).toBeNull();
    expect((await world.store.read(successorId)).kind).toBe("absent");
  },
  PRESS_TIMEOUT_MS,
);

// --- rondo#228: the approval a typed `revise` draws, over a real gate ----------

/**
 * `rondo revise` as a person types it, with stdout and stderr captured.
 *
 * `main` and not `commandRevise`: what the two cases below are about is the
 * command's own order -- the approval drawn from the record before anything is
 * read from the seam, the line said before the gate is walked, the refusal that
 * is the command's exit -- and dispatch is part of that.
 */
async function typed(
  world: PressWorld,
  argv: readonly string[],
): Promise<{ readonly code: number; readonly text: string }> {
  const out: string[] = [];
  const write = consoleSeams.write;
  const writeError = consoleSeams.writeError;
  consoleSeams.write = (text: string) => void out.push(text);
  consoleSeams.writeError = (text: string) => void out.push(text);
  try {
    const code = await main([...argv], {
      ...environmentFor(),
      RONDO_STORE: world.storePath,
      // The bounds `pressWorld`'s own store was opened with, so the second lap
      // is not refused by a narrower default than the fixture's.
      RONDO_MAX_OCCUPYING: "4",
      RONDO_MAX_LIVE: "6",
    });
    return { code, text: out.join("") };
  } finally {
    consoleSeams.write = write;
    consoleSeams.writeError = writeError;
  }
}

/** The questions a refusal wrote into the request's thread, as the drafter asks them. */
function asked(world: PressWorld): Record<string, unknown>[] {
  return world.connection
    .prepare(
      "SELECT message_id, in_reply_to, author_kind, asks, body FROM conversation_message " +
        "WHERE asks = 1 ORDER BY at_ms, message_id",
    )
    .all() as Record<string, unknown>[];
}

/**
 * The success side of the draw (`D-0157` rules 2 and 4), driven as the terminal
 * drives it.
 *
 * **Why it is here and not beside the draw's own tests.** What the gate feedback
 * on rondo#228 asked for is proof of the wiring: that the approval the record
 * names is the one actually charged, and that the line naming it is said *before*
 * the gate is walked. Both need a gate that really stands, and a gate exists only
 * because a real lap opened one -- this file's ground (see the header). A test of
 * `reviseApproval`'s return value, or of the command over a store with no gate,
 * cannot say either thing.
 */
test.skipIf(!available)(
  `a typed revise with no --scope-decision-id charges the approval the lap was admitted under, and says which before the walk (rondo#228)${skipNote}`,
  async () => {
    const world = await pressWorld("revise-drawn");
    const { iterationId, gateId } = await startOnePress(world);
    await readingAtTheGate(world, iterationId);
    // The record the draw reads: the lap's `admission` row names the approval,
    // and one admission stands under it.
    expect(await world.record.scopeDecisionAdmitting(iterationId)).toBe(world.scopeDecisionId);
    expect((await world.record.scopeSpent(world.scopeDecisionId)).admissions).toBe(1);

    const successorId = newIterationId();
    const { code, text } = await typed(world, [
      "revise",
      "--actor-id",
      "ada",
      "--body=Cap the backoff at thirty seconds.",
      "--iteration-id",
      successorId,
    ]);
    expect(code, text).toBe(0);

    // **(2) The line comes before the walk.** Both are said by this command, so
    // their order in what it printed is the order they happened in: the person
    // reads which approval is being spent, and why, ahead of the first
    // irreversible step.
    const said = text.indexOf(
      `spending approval '${world.scopeDecisionId}', the approval iteration '${iterationId}' ` +
        "was admitted under",
    );
    expect(said, text).toBeGreaterThanOrEqual(0);
    const walked = text.indexOf(`gate ${gateId} is at stage`);
    expect(walked, text).toBeGreaterThan(said);

    // **(1) The drawn approval is charged.** A second `admission` row, under the
    // approval nobody typed, with the second lap as its subject -- which is the
    // round the scope exists to count, and the one lap 9's N-33 lost.
    expect(await world.record.scopeDecisionAdmitting(successorId)).toBe(world.scopeDecisionId);
    expect((await world.record.scopeSpent(world.scopeDecisionId)).admissions).toBe(2);

    // And the lap it charged for really ran: the gate carried the instruction,
    // the first row says it was asked to change, and the second stands at a gate
    // of its own.
    expect((await gateOf(world, gateId)).outcome).toBe("answered_and_forwarded");
    const first = await world.store.read(iterationId);
    if (first.kind !== "read") {
      throw new Error("the revised lap would not read");
    }
    expect(first.record.gateAnswer).toBe("revise");
    const successor = await world.store.read(successorId);
    if (successor.kind !== "read") {
      throw new Error(`the revision would not read: ${JSON.stringify(successor)}`);
    }
    expect(successor.record.supersedesIterationId).toBe(iterationId);
    expect(successor.record.status).toBe("awaiting_human");
    expect(successor.record.gateId).not.toBe(gateId);
  },
  PRESS_TIMEOUT_MS * 2,
);

/**
 * The drawn approval that is no longer usable (`D-0157` rules 2 and 4), over the
 * command and over a real gate.
 *
 * **The case rondo must not be clever about.** A raise is a successor approval
 * of a *rewritten* scope, and it is standing right there, one walk away
 * (`approvalTip`, `D-0074` section 2). Spending it would be rondo picking a
 * budget nobody gave this correction, so the recorded approval is resolved as it
 * is, its supersession is the verdict's own refusal, and the refusal stops the
 * command and asks the person in the request's thread (`D-0066` rule 4.4).
 */
test.skipIf(!available)(
  `a typed revise whose drawn approval was superseded stops, asks in the request's thread, and leaves the gate where it stood (rondo#228)${skipNote}`,
  async () => {
    const world = await pressWorld("revise-superseded");
    const { iterationId, gateId } = await startOnePress(world);
    await readingAtTheGate(world, iterationId);

    // The person raises the budget on the page while the lap waits: a successor
    // scope, approved, which retires the approval the lap was admitted under
    // (D-0074 section 4). The admission row still names the old one.
    const raised = await raiseScopeFromPage(environmentFor(), world.store, world.storePath, "ada", {
      scopeId: newScopeId(),
      requestMessageId: world.requestMessageId,
      scopeDecisionId: world.scopeDecisionId,
      iterationId,
      budgets: {
        laps: 8,
        review_rounds: 2,
        cost_usd: 50,
        cost_reserve_usd: 5,
        expires_at_ms: 9_999_999_999_999,
      },
    });
    expect(raised.ok, `${raised.why ?? ""}: ${raised.note}`).toBe(true);
    const successorApproval = raised.scopeDecisionId ?? "";
    expect(successorApproval).not.toBe("");
    expect(await world.record.scopeDecisionAdmitting(iterationId)).toBe(world.scopeDecisionId);

    const successorId = newIterationId();
    const asksBefore = asked(world).length;
    const { code, text } = await typed(world, [
      "revise",
      "--actor-id",
      "ada",
      "--body=Cap the backoff at thirty seconds.",
      "--iteration-id",
      successorId,
    ]);

    // **(1) It stops there**, at the verdict's own `superseded` test, and the
    // approval it drew is the one on the record: the successor's id appears
    // nowhere, because rondo never went looking for it.
    expect(code, text).toBe(2);
    expect(text).toContain(`spending approval '${world.scopeDecisionId}'`);
    expect(text).not.toContain(successorApproval);
    expect(text).toContain("at the superseded test");
    expect(text).toContain("nothing was admitted and nothing was spent");
    expect(text).toContain("The gate was not touched: your instruction was not sent.");

    // **(2) The person is asked**, in the request's thread, and the command says
    // which message holds the line.
    const questions = asked(world);
    expect(questions).toHaveLength(asksBefore + 1);
    const stop = questions[questions.length - 1];
    expect(stop).toMatchObject({
      in_reply_to: world.requestMessageId,
      author_kind: "drafter",
      asks: 1,
    });
    expect(String(stop?.["body"])).toContain("superseded test");
    expect(text).toContain(`The line is stopped by message '${String(stop?.["message_id"])}'`);

    // **(3) The gate is where it stood**, nothing was charged to either
    // approval, and there is no second lap.
    expect((await gateOf(world, gateId)).outcome).toBeNull();
    const first = await world.store.read(iterationId);
    if (first.kind !== "read") {
      throw new Error("the gated lap would not read");
    }
    expect(first.record.status).toBe("awaiting_human");
    expect(first.record.gateAnswer).toBeNull();
    expect((await world.store.read(successorId)).kind).toBe("absent");
    expect((await world.record.scopeSpent(world.scopeDecisionId)).admissions).toBe(1);
    expect((await world.record.scopeSpent(successorApproval)).admissions).toBe(0);
  },
  PRESS_TIMEOUT_MS,
);

/** One git command in `directory`, with an identity, as `seedRepository` runs one. */
function git(directory: string, ...args: string[]): string {
  return execFileSync("git", ["-C", directory, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "rondo test",
      GIT_AUTHOR_EMAIL: "test@example.invalid",
      GIT_COMMITTER_NAME: "rondo test",
      GIT_COMMITTER_EMAIL: "test@example.invalid",
    },
  });
}

/** What the stood-in forge answers with where it opens one. */
const PULL_REQUEST_URL = "https://github.com/suisya-systems/rondo/pull/4242";

/** What a stood-in forge CLI was handed, and what it answered with. */
interface StoodInForge {
  /** The directory to put first on `PATH`; the `gh` inside it is the stand-in. */
  readonly pathEntry: string;
  /** Every argv a `gh pr create` was handed, in the order they were run. */
  asked(): readonly (readonly string[])[];
}

/**
 * A stand-in for the forge's CLI, at the boundary where rondo hands the work
 * over: an executable named `gh`, first on `PATH`.
 *
 * **Why here and not a module seam.** What #239's remaining leg has no test for
 * is rondo's route to the forge, and the last stretch of that route is inside
 * `openPullRequest`: the `--repo`/`--base`/`--head`/`--title`/`--body` argument
 * list, and the `spawn` that carries it to a process with `shell: false`. A
 * stand-in for that function would skip exactly the part under test, so the
 * stand-in is the *program* instead -- and the argv it recorded is what the tests
 * read back, which is the strongest thing a test can say about a command line it
 * did not compose.
 *
 * **Only `pr create`, and only the answer.** Every other `gh` invocation --
 * whatever the plan's own reads reach for -- is handed to the operator's own `gh`
 * with the `PATH` rondo's process was started with, so nothing else about this
 * suite changes shape when the stand-in is installed.
 *
 * The argv is recorded NUL-separated because a pull request's body has newlines
 * in it, and one file per invocation because "how many times" is an assertion
 * the refusal cases make. The shape -- a POSIX shell script written to a
 * temporary directory with `mode: 0o755` -- is `test/access/forge.test.ts`'s
 * `fakeReviewer`, and so is its one limit: see {@link publishPress}.
 */
function standInForPullRequest(
  dir: string,
  answers: { readonly status: number; readonly stdout: string; readonly stderr: string },
): StoodInForge {
  const root = mkdtempSync(join(dir, "forge-cli-"));
  const asked = join(root, "asked");
  mkdirSync(asked);
  writeFileSync(join(root, "stdout"), answers.stdout, "utf8");
  writeFileSync(join(root, "stderr"), answers.stderr, "utf8");
  writeFileSync(
    join(root, "gh"),
    [
      "#!/bin/sh",
      'if [ "$1" = "pr" ] && [ "$2" = "create" ]; then',
      "  i=0",
      `  while [ -e '${asked}/'$i ]; do i=$((i+1)); done`,
      `  printf '%s\\0' "$@" > '${asked}/'$i`,
      `  cat '${join(root, "stdout")}'`,
      `  cat '${join(root, "stderr")}' >&2`,
      `  exit ${String(answers.status)}`,
      "fi",
      `PATH='${process.env.PATH ?? ""}' exec gh "$@"`,
      "",
    ].join("\n"),
    { mode: 0o755 },
  );
  return {
    pathEntry: root,
    asked: () =>
      readdirSync(asked)
        .map((name) => Number(name))
        .sort((left, right) => left - right)
        .map((index) => {
          const written = readFileSync(join(asked, String(index)), "utf8");
          // One trailing NUL per argument, so the split leaves an empty tail.
          return written.split("\0").slice(0, -1);
        }),
  };
}

/**
 * A lap the publish press can be pressed on: started, answered *approve*, with
 * a commit on its topic branch and the screen already drawn.
 *
 * Every step is a press: the lap is `startScopedFromPage`'s real one and the
 * approval is `answerFromPage`'s real gate walk, so what is published here is
 * an approval continuo recorded rather than a row a fixture wrote.
 *
 * **The commit is the worker's turn, which is this file's one stood-in** (see
 * the header): continuo's fake worker reports words and writes nothing, so the
 * test commits on the branch the lap is checked out on. Without it the topic
 * branch would be the base commit and "the ref moved" would say nothing about
 * the push.
 */
async function publishableLap(label: string) {
  const world = await pressWorld(label);
  const { iterationId } = await startOnePress(world);
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
  const read = await world.store.read(iterationId);
  if (read.kind !== "read") {
    throw new Error(`the approved lap would not read: ${JSON.stringify(read)}`);
  }
  const record = read.record;
  const workspace = record.workspace ?? "";
  writeFileSync(join(workspace, "RETRY.md"), "# a retry budget, and it ends\n", "utf8");
  // `--all` rather than the one path: D-0060 rule 4 refuses a publish over a
  // worktree holding anything uncommitted, and what a worker leaves behind is
  // its own business -- so the stood-in turn ends the way a real one does, with
  // a clean tree, whatever else the materialisation put there.
  git(workspace, "add", "--all");
  git(workspace, "commit", "--quiet", "-m", "feat: a retry budget");
  const tip = git(workspace, "rev-parse", "HEAD").trim();

  // The remote is the bare repository `seedRepository` pushed `main` to, which
  // the lap's worktree inherits as `origin`; `--repo` is a forge name, so the
  // two cannot agree and the mismatch is overruled rather than hidden, as
  // `test/access/web-publish.test.ts` overrules it for the same pair.
  const asked = { repo: "suisya-systems/rondo", remote: "origin", allowRemoteMismatch: true };
  // **The screen the press is pressed from** (D-0059 section 5a Q1), drawn by
  // the page's own reader over the page's own thread. No body is composed on
  // either side -- the press reads the row a preview would have recorded and
  // finds none -- so the two agree and no model is run (see the header).
  const preview = await publishingForPage(
    environmentFor(),
    world.store,
    asked,
    record,
    world.record,
  );
  if (preview.kind !== "ready") {
    throw new Error(`the approved lap draws no publish screen: ${JSON.stringify(preview)}`);
  }
  return {
    world,
    iterationId,
    runId: record.runId ?? "",
    /** The forge `seedRepository` made: a real remote, and where the push lands. */
    bare: join(world.dir, "repo.git"),
    tip,
    asked,
    preview,
    /**
     * Whether the screen carries a reading to overrule. A lap whose reader had
     * nothing to say about work committed after it read is exactly the screen
     * that offers the override, so the press answers the question the screen
     * asked rather than a fixed `false` that would refuse for the wrong reason.
     */
    despiteReview: preview.review !== null,
  };
}

/**
 * One publish press, with the stood-in `gh` on `PATH` for the length of it.
 *
 * The press is the page's own `publishFromPage`, called with the screen's digest
 * -- nothing about the press is arranged here beyond where `gh` is found.
 */
async function pressPublish(
  lap: Awaited<ReturnType<typeof publishableLap>>,
  answers: { readonly status: number; readonly stdout: string; readonly stderr: string },
) {
  const forge = standInForPullRequest(lap.world.dir, answers);
  const path = process.env.PATH;
  process.env.PATH = `${forge.pathEntry}${delimiter}${path ?? ""}`;
  try {
    const pressed = await publishFromPage(
      environmentFor(),
      lap.world.store,
      lap.world.storePath,
      "ada",
      lap.asked,
      {
        iterationId: lap.iterationId,
        shown: lap.preview.shown,
        despiteReview: lap.despiteReview,
      },
    );
    return { pressed, asked: forge.asked() };
  } finally {
    if (path === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = path;
    }
  }
}

/**
 * The publish cases, which need the stood-in `gh` and therefore a POSIX shell.
 *
 * `test/access/forge.test.ts` draws the same line for the same reason: a
 * stand-in written as a `#!/bin/sh` script cannot be reached on Windows, where
 * `spawn` without a shell resolves no `.cmd` shim (`src/access/forge.ts`'s own
 * note). The Linux cell -- the one that provisions the pinned continuo the rest
 * of this file needs -- is what drives this leg under CI.
 */
const publishPress = test.skipIf(!available || process.platform === "win32");

/** Why a publish case is not running, where it is the platform rather than the pin. */
const publishSkipNote =
  available && process.platform === "win32"
    ? " [skipped: the stood-in gh is a POSIX shell script, which spawn cannot reach on Windows; " +
      "the Linux cell drives this leg]"
    : skipNote;

/** The run's status, as the pinned continuo holds it: `completed` once closed. */
async function runStatus(lap: Awaited<ReturnType<typeof publishableLap>>): Promise<string> {
  const started = await startContinuo(environmentFor());
  if (started.kind !== "ready") {
    throw new Error(`continuo did not verify: ${started.reason}`);
  }
  const observed = await run(started.continuo, RUN_SHOW, [
    "--db",
    lap.world.db,
    "--run-id",
    lap.runId,
  ]);
  if (observed.kind !== "answered") {
    throw new Error(`run show did not answer: ${JSON.stringify(observed)}`);
  }
  return observed.payload.status;
}

/**
 * The run's whole row in continuo's control plane, column for column.
 *
 * Read straight out of the database, as the delegated case above reads
 * `gate_transition`, because what a refused close-out has to be held to is *no
 * change at all* rather than a status that is still not `completed`: a close
 * writes the status and the row's `updated_at_ms`, so the row is the evidence.
 */
function runRow(lap: Awaited<ReturnType<typeof publishableLap>>): unknown {
  const control = new DatabaseSync(lap.world.db, { readOnly: true });
  try {
    return control.prepare("SELECT * FROM run WHERE run_id = ?").all(lap.runId);
  } finally {
    control.close();
  }
}

/** The line the thread carries where a lap was published, or undefined for none. */
async function publishedLine(
  lap: Awaited<ReturnType<typeof publishableLap>>,
): Promise<string | undefined> {
  const read = await lap.world.record.threadMessages();
  if (read.kind !== "read") {
    throw new Error(`the thread would not read: ${JSON.stringify(read)}`);
  }
  return read.messages.find(
    (message) => message.messageId === `report-published-${lap.iterationId}`,
  )?.body;
}

publishPress(
  `the publish press opens the pull request the screen showed, over a real push (#233 S5, #239)${publishSkipNote}`,
  async () => {
    const lap = await publishableLap("publish-open");
    const { pressed, asked } = await pressPublish(lap, {
      status: 0,
      stdout: `${PULL_REQUEST_URL}\n`,
      stderr: "",
    });
    expect(pressed.ok, `${pressed.why ?? ""}: ${pressed.note}`).toBe(true);

    // **The command line the forge's CLI was handed, argument for argument**, as
    // that program recorded it -- so this is rondo's own `openPullRequest`
    // spelling `pr create` and spawning it, and not a test's idea of either. And
    // it is the act the screen described, field for field: the press re-plans and
    // re-digests before it runs anything (D-0042 rules 2 and 3), so this is the
    // one assertion that says the screen and the act are the same publish rather
    // than two computations that happened to agree.
    expect(asked).toEqual([
      [
        "pr",
        "create",
        "--repo",
        lap.preview.target.repo,
        "--base",
        lap.preview.target.baseBranch,
        "--head",
        lap.preview.target.headRef,
        "--title",
        lap.preview.title,
        "--body",
        lap.preview.body,
      ],
    ]);

    // **And the push it stands on was a real push.** The bare repository holds
    // the topic branch at the commit the worktree is on -- a ref that was not
    // there before this press, and that no refusal path could have made.
    expect(git(lap.bare, "rev-parse", `refs/heads/${lap.preview.target.topicBranch}`).trim()).toBe(
      lap.tip,
    );

    // **What stays readable afterwards** (D-0153 rule 1, rondo#286): the remote
    // the work went to, on the row, and the pull request's address in the
    // request's own thread, which is where a person goes looking for it.
    const after = await lap.world.store.read(lap.iterationId);
    expect(after.kind === "read" ? after.record.publishedRemote : null).toBe("origin");
    expect(await publishedLine(lap)).toContain(PULL_REQUEST_URL);
  },
  PRESS_TIMEOUT_MS,
);

publishPress(
  `the publish press whose pull request is refused stops before continuo's close (#233 S5, #239)${publishSkipNote}`,
  async () => {
    const lap = await publishableLap("publish-refused");
    const before = runRow(lap);
    const { pressed, asked } = await pressPublish(lap, {
      status: 1,
      stdout: "",
      stderr: "GraphQL: A pull request already exists for suisya-systems:rondo/press-path.\n",
    });

    // The refusal the screen shows, carrying the forge's own words -- which
    // arrived as that program's own stderr, over the same boundary the success
    // case's answer came over.
    expect(pressed.ok).toBe(false);
    expect(pressed.why).toBe("publishRefusedPullRequestFailed");
    expect(pressed.note).toContain("the branch is pushed");
    expect(pressed.detail).toContain("A pull request already exists");
    expect(asked).toHaveLength(1);

    // **The push ahead of it happened all the same, and is recorded**: the leg
    // that cannot be taken back is the one before this, and the row says where
    // it went so the landing reading has a basis for a publish that stopped
    // half way (rondo#286, D-0153 rule 1).
    expect(git(lap.bare, "rev-parse", `refs/heads/${lap.preview.target.topicBranch}`).trim()).toBe(
      lap.tip,
    );
    const after = await lap.world.store.read(lap.iterationId);
    expect(after.kind === "read" ? after.record.publishedRemote : null).toBe("origin");

    // **And it stopped before the close, which cannot be taken back either**:
    // continuo refuses a second `run close`, so a press that closed the run on
    // its way past a failed pull request would leave the one state the screen
    // exists to avoid. The run's row is exactly the row it was before the press,
    // read back through the pinned build as well as out of the table, and nothing
    // in the thread says this lap was published.
    expect(await runStatus(lap)).not.toBe("completed");
    expect(runRow(lap)).toEqual(before);
    expect(await publishedLine(lap)).toBeUndefined();
  },
  PRESS_TIMEOUT_MS,
);

publishPress(
  `the publish press closes the real run behind the pull request and reports it (#233 S5, #239)${publishSkipNote}`,
  async () => {
    const lap = await publishableLap("publish-close");
    expect(await runStatus(lap)).not.toBe("completed");
    const { pressed } = await pressPublish(lap, {
      status: 0,
      stdout: `${PULL_REQUEST_URL}\n`,
      stderr: "",
    });
    expect(pressed.ok, `${pressed.why ?? ""}: ${pressed.note}`).toBe(true);

    // **continuo's own row, read back through the pinned build**: the close is
    // the operator's observation that the work landed, and `completed` is the
    // terminal status it recorded. Nothing here wrote that row but the press.
    expect(await runStatus(lap)).toBe("completed");

    // **And the record a person reads afterwards**: the lap is reported as
    // published, in the request's thread, with the pull request's address.
    expect(await publishedLine(lap)).toContain(PULL_REQUEST_URL);
  },
  PRESS_TIMEOUT_MS,
);

publishPress(
  `a close-out continuo refuses leaves the run exactly as it was (#233 S5, #239)${publishSkipNote}`,
  async () => {
    const lap = await publishableLap("publish-close-refused");
    // The row the close-out would have written, as it stands before the press.
    const before = runRow(lap);
    expect(await runStatus(lap)).not.toBe("completed");

    // **The condition is made to hold at the close-out itself, and not a leg
    // earlier**: continuo's control plane is made unwritable just before the
    // press, so the two legs ahead run exactly as they do in the success case
    // above -- the same push to the same bare repository, the same pull request
    // over the same boundary -- and the only leg that cannot take its write is
    // the close. Nothing stands in for continuo: reads still answer, and the
    // refusal is the pinned build's own over a database it may not write.
    chmodSync(lap.world.db, 0o444);
    let pressed: Awaited<ReturnType<typeof pressPublish>>;
    try {
      pressed = await pressPublish(lap, {
        status: 0,
        stdout: `${PULL_REQUEST_URL}\n`,
        stderr: "",
      });
    } finally {
      // Writable again before anything is read back, so that what the assertions
      // below read is continuo answering normally about an untouched row rather
      // than continuo answering about a database it cannot open as it usually
      // does.
      chmodSync(lap.world.db, 0o644);
    }
    expect(pressed.pressed.ok).toBe(false);
    expect(pressed.pressed.why).toBe("publishRefusedRunNotClosed");
    expect(pressed.pressed.note).toContain("the run did not close");

    // The two legs ahead of it did run: this is the close-out's own refusal and
    // not a refusal that stopped the press earlier.
    expect(pressed.asked).toHaveLength(1);
    expect(git(lap.bare, "rev-parse", `refs/heads/${lap.preview.target.topicBranch}`).trim()).toBe(
      lap.tip,
    );

    // **And the refused close-out changed nothing that lasts.** A close cannot be
    // taken back -- continuo's `run` table refuses to reopen a terminal status at
    // all (`run_status_is_forward_only`) -- so what this has to show is not a
    // status that is merely still open but a row that is untouched, column for
    // column, `updated_at_ms` included. Read both ways: out of the table, and
    // back through the pinned build.
    expect(runRow(lap)).toEqual(before);
    expect(await runStatus(lap)).not.toBe("completed");

    // **And rondo says nothing it cannot stand behind**: the thread carries no
    // published line, because the close-out did not finish. A person is sent to
    // the terminal `rondo web` runs in, where the refusal was relayed.
    expect(await publishedLine(lap)).toBeUndefined();
  },
  PRESS_TIMEOUT_MS,
);
