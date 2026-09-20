/**
 * The operator page, served over a seeded store, for looking at (rondo#233 S3).
 *
 *   npm run build && npm run page:preview
 *
 * **It calls the real command.** The last thing this script does is
 * `main(["web", "--port", "7334"], env)` out of `dist/access/cli.js`, so what a
 * browser gets is rondo's own wiring -- the held plans, the ports, the press
 * checks and all -- and not a second composition root that could drift from the
 * one under test. Everything above that only writes rows, and it writes them
 * through the store's own verbs and never with raw SQL.
 *
 * **Fixed port 7334**, one above the page's default, so a preview never
 * collides with a `rondo web` the operator is already running and a screenshot
 * script can hard-code it.
 *
 * **The temp store is left behind deliberately**: a preview whose rows survive
 * is a preview a person can come back to, and the banner prints where it is.
 *
 * ASCII only in everything printed here (D-0004): this runs on the Windows cell
 * too. The two seeded message bodies are file content rather than console
 * prose, so they are ordinary text.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dist = (name) => new URL(`../dist/${name}`, import.meta.url).href;

let modules;
try {
  modules = {
    sqlite: await import(dist("store/sqlite.js")),
    records: await import(dist("store/records.js")),
    plan: await import(dist("refrain/plan.js")),
    allocator: await import(dist("refrain/allocator.js")),
    cli: await import(dist("access/cli.js")),
    scope: await import(dist("access/scope.js")),
    drafterHost: await import(dist("access/drafter-host.js")),
    storePlan: await import(dist("store/plan.js")),
    forge: await import(dist("access/forge.js")),
    review: await import(dist("access/review.js")),
    wording: await import(dist("access/wording.js")),
  };
} catch {
  process.stderr.write("rondo is not built. Run: npm run build\n");
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), "rondo-preview-"));
const repository = join(dir, "repo");
const workspaceRoot = join(dir, "work");
const storePath = join(dir, "store.db");
const planPath = join(dir, "plan.json");
mkdirSync(repository, { recursive: true });
mkdirSync(workspaceRoot, { recursive: true });

const AGENT_TYPE_INPUT = {
  agentTypeId: "worker-basic",
  vocabularyVersion: 1,
  granted: ["command.run"],
  askable: ["branch.push"],
  loopPolicy: { maxReviewRounds: 2, noProgressWindow: 3, noProgressRepeat: 2 },
  executorPolicy: { roleName: "worker", modelTier: "standard", reportingDuties: [] },
};

const PLAN = {
  db: join(dir, "continuo.db"),
  workspaceRoot,
  baseBranch: "main",
  prompt: "teach rondo to count",
  allowedBash: ["npm run:*"],
  materialLanguage: null,
  reviewCriterion: null,
  repository,
  artifactRoot: join(dir, "artifacts"),
  stateRoot: join(dir, "state"),
  interlockRoot: join(dir, "interlock"),
  claudeOrgPath: join(dir, "claude-org"),
  endpointRecipient: "external-notify",
  endpointDestinationDir: join(dir, "outbox"),
  claudeCommand: [join(dir, "claude")],
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
  // **Named, because `runPlan` asks for it by name** (`D-0081`): the field is
  // nullable and the key is not, so a plan that leaves it out refuses with a
  // message about `trim` rather than about the field.
  forgeRepository: null,
  invocationCeilingMs: 1_800_000,
  catalogLayers: [
    {
      layer: "tracked",
      origin: join(dir, "catalog", "projects.toml"),
      baseDir: join(dir, "catalog"),
      data: {
        schema_version: 1,
        catalog: { allowed_local_roots: [repository] },
        project: {
          rondo: {
            source: { kind: "local_path", path: repository },
            base_branch: "main",
            aliases: [],
          },
        },
      },
    },
  ],
  projectName: "rondo",
  agentTypeInput: AGENT_TYPE_INPUT,
  parties: { issuer: "rondo-host", grantee: "unset" },
  intendedAction: { capabilities: ["command.run"] },
};

const refuse = (line) => {
  process.stderr.write(`${line}\n`);
  process.exit(1);
};

/** The plan the seeded laps ran on, admitted under one id: what the scope screen offers. */
function planDocument(id) {
  const planned = modules.plan.runPlan(PLAN);
  if (planned.kind !== "planned") {
    refuse(`the preview plan is not valid: ${planned.reason}`);
  }
  const allocation = modules.allocator.allocate(id, workspaceRoot);
  if (allocation.kind !== "allocated") {
    refuse(`the preview id does not allocate: ${allocation.reason}`);
  }
  const admitted = modules.plan.admittedPlan(planned.plan, allocation.allocation);
  if (admitted.kind !== "planned") {
    refuse(`the preview allocation is not valid: ${admitted.reason}`);
  }
  return modules.plan.planPayload(admitted.plan);
}

const store = modules.sqlite.openIterationStore(storePath, { maxOccupying: 4, maxLive: 6 });
const record = modules.sqlite.openAdvisoryRecord(storePath);

writeFileSync(planPath, `${JSON.stringify(planDocument("lap-preview-0001"), null, 2)}\n`, "utf8");

// The agent type the plan records, so the seeded laps carry the digest the
// scope form draws its budgets from: without it every basis is a cold start,
// which is the one thing seeding laps at all is meant to avoid. The laps are
// also what makes the plan one rondo holds, so the scope screen offers it.
const planned = modules.plan.readRunPlan(planDocument("lap-preview-0001"));
const recordedType =
  planned.kind === "planned"
    ? modules.scope.agentTypeRecordOf(planned.plan, planDocument("lap-preview-0001"))
    : { refusal: planned.reason };
const drafted =
  "refusal" in recordedType
    ? { kind: "refused", reason: recordedType.refusal }
    : { kind: "drafted", agentTypeDigest: recordedType.record.agentTypeDigest };

const requestMessageId = "request-preview-0001";

/**
 * One line's own claim (`D-0073` rule 2.3), so the seeded laps do not refuse
 * each other.
 *
 * Without it every first lap claims the whole repository by default and the
 * second one is refused by the lane ledger -- which is correct of the ledger
 * and wrong of a preview, whose laps are meant to stand beside each other. A
 * redo continues its lineage's claim and asks for none.
 */
const laneFor = (id, supersedesIterationId) =>
  supersedesIterationId === null
    ? {
        paths: [`lanes/${id}/`],
        authorKind: "drafter",
        authorId: "rondo/preview",
        bases: [],
      }
    : null;
const now = Date.now();

async function say(draft) {
  const outcome = await record.recordThreadMessage(draft);
  if (outcome.kind !== "recorded") {
    refuse(`the preview message was not recorded: ${outcome.reason}`);
  }
}

/**
 * One ended lap carrying a cost and a duration, for the budgets to read.
 *
 * **Its steps are stamped at the times they would have happened** (rondo#332).
 * They used to all land on the script's own `now`, which left the seeded laps
 * with one start apiece at staggered ages and every check and ending at the
 * same instant -- so the thread drew seven *work started* lines in a row and
 * then eleven endings, in an order no run ever produced. Rule 7's lines are
 * read in time order, and a fold of them is designed against that order, so a
 * fixture whose order is an artefact of the seeding would be designed against
 * nothing. `startedMsAgo` places the lap and `durationMs` closes it.
 */
async function endedLap(id, costUsd, durationMs, supersedesIterationId, startedMsAgo, reading) {
  const startedAt = now - startedMsAgo;
  const reserved = await store.reserve({
    id,
    request: "teach rondo to count",
    plan: planDocument(id),
    spend: null,
    scopeSpend: null,
    nowMs: startedAt,
    supersedesIterationId,
    claim: laneFor(id, supersedesIterationId),
    // Every lap names the request it came from (`D-0085`), and the preview's
    // laps are all for the one request it seeds.
    requestMessageId,
    runId: `rondo-${id}`,
    topicBranch: `rondo/${id}`,
    workspace: join(workspaceRoot, id),
  });
  if (reserved.kind !== "reserved") {
    refuse(`the preview lap did not reserve: ${JSON.stringify(reserved)}`);
  }
  // The lap's own clock: admitted at once, read near the end, closed after
  // `durationMs`. The reading is taken on the step that takes one.
  const readAt = startedAt + Math.round(durationMs * 0.8);
  const steps = [
    ["planned", "admitting", {}, startedAt, undefined],
    ["admitting", "admitted", {}, startedAt, undefined],
    [
      "admitted",
      "performing",
      {
        agentTypeDigest: drafted.kind === "drafted" ? drafted.agentTypeDigest : null,
        modelTier: "standard",
      },
      startedAt,
      undefined,
    ],
    ["performing", "awaiting_human", { gateId: `gate-${id}` }, readAt, reading],
    [
      "awaiting_human",
      "closed",
      { gateOutcome: "approve", lapCostUsd: costUsd, lapDurationMs: durationMs },
      startedAt + durationMs,
      undefined,
    ],
  ];
  for (const [from, to, fields, at, taken] of steps) {
    const moved = await store.transition(id, from, to, fields, at, taken);
    if (moved.kind !== "transitioned") {
      refuse(`the preview lap did not reach '${to}': ${JSON.stringify(moved)}`);
    }
  }
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** The deterministic checks, as one lap's reading: clear, or with things raised. */
const checksOf = (findings) => ({
  drafter: modules.records.DETERMINISTIC_READING_DRAFTER,
  verdict: findings.length === 0 ? "clear" : "concerns",
  findings,
  evidence: {
    baseRef: "refs/remotes/origin/main",
    baseCommit: "b".repeat(40),
    tipCommit: "a".repeat(40),
    materialDigest: `sha256:${"c".repeat(64)}`,
    commitCount: 2,
    fileCount: 3,
  },
  unavailableReason: null,
});

await say({
  messageId: requestMessageId,
  body:
    "Teach rondo to count the laps a request has spent.\n\n" +
    "Right now the page says what is running and what has ended, and nothing anywhere says what " +
    "this one request has cost so far. I would like a line on the request that says it, and I " +
    "would like it to be a number I can check rather than one I have to believe.\n\n" +
    "Do not touch the ledger's own counting. Read what is there.",
  authorKind: "operator",
  authorId: "ada",
  inReplyTo: null,
  atMs: now - 32 * HOUR,
  bases: [],
  asks: false,
});
await say({
  messageId: "reply-preview-0001",
  body:
    "Read it back as: the admissions under the request's approval, and the sum of the laps whose " +
    "cost has been read. Laps whose cost is not read yet are counted apart, because a reserve is " +
    "a guess and a sum that folded it in would read as a measurement.",
  authorKind: "drafter",
  authorId: "rondo/deterministic",
  inReplyTo: requestMessageId,
  atMs: now - 31 * HOUR,
  bases: [{ form: "message", messageId: requestMessageId }],
  asks: false,
});

// A second request the model drafter could not draft (rondo#238): the thread
// says so in plain words and offers the scope screen, with the drafter's own
// reason folded. Written before the host first runs, so it drafts nothing new.
await say({
  messageId: "request-preview-0002",
  body: "Make the inbox show newer items first.",
  authorKind: "operator",
  authorId: "ada",
  inReplyTo: null,
  atMs: now - 30 * 60 * 1000,
  bases: [],
  asks: false,
});
await say({
  messageId: "drafter-preview-0002",
  body: "rondo's drafter wrote no draft for this: claude -p exited 1",
  authorKind: "drafter",
  authorId: "rondo/drafter/1/claude-opus-5",
  inReplyTo: "request-preview-0002",
  atMs: now - 29 * 60 * 1000,
  bases: [{ form: "message", messageId: "request-preview-0002" }],
  asks: false,
});

// Three ended laps, one of them a redo, so `first_lap_cost`, `redo_cost` and
// `lap_duration` each find rows rather than three cold starts.
//
// **Laid out as the first three tries of one request** (rondo#332): this
// request is the one the fold is designed against, and a request that was
// tried once does not show the problem the fold exists for. The first two fail
// their checks and the third passes, which is what a retry actually looks like.
await endedLap(
  "lap-preview-0001",
  1.42,
  22 * MINUTE,
  null,
  30 * HOUR,
  checksOf(["the count line reads the iteration table directly"]),
);
await endedLap(
  "lap-preview-0003",
  2.15,
  31 * MINUTE,
  "lap-preview-0001",
  28 * HOUR,
  checksOf(["a redo's cost is added in before its own cost is read"]),
);
await endedLap("lap-preview-0002", 0.86, 14 * MINUTE, null, 26 * HOUR, checksOf([]));

// An approved scope over the same request, recorded through the store's own
// verbs in the order `recordScopeFromPage` uses (rondo#233 S4): record the
// scope, read its digest back, then approve it. The agent-type digest is
// already `iteration`-held from the three ended laps above, so this scope
// records no `agent_type_record` of its own -- an operator's scope may, but
// D-0069 section 1's other door (an iteration row already carrying the
// digest) is open here and a second write would only repeat it. Budgets leave
// a lap and a review round for the waiting lap below to spend, and an expiry
// nowhere near the "now" this script computed.
const scopeId = "scope-preview-0001";
const scopePayload = modules.records.scopePayloadWithDefaults({
  requests: [requestMessageId],
  workspaces: [{ repository, workspace_root: workspaceRoot }],
  agent_types: [drafted.kind === "drafted" ? drafted.agentTypeDigest : ""],
  budgets: {
    laps: 4,
    review_rounds: 3,
    cost_usd: 50,
    cost_reserve_usd: 5,
    expires_at_ms: now + 24 * 60 * 60 * 1000,
  },
  severity_threshold: "major",
  outward_acts: [],
  irreversible_additions: [],
});
const scopeWritten = await record.recordScope({
  scopeId,
  payload: scopePayload,
  supersedesScopeId: null,
  authorKind: "operator",
  authorId: "ada",
  bases: [],
  createdAtMs: now,
  agentTypeRecords: [],
});
if (scopeWritten.kind !== "recorded") {
  refuse(`the preview scope did not record: ${JSON.stringify(scopeWritten)}`);
}
const scopeStored = await record.readScope(scopeId);
if (scopeStored.kind !== "read") {
  refuse(`the preview scope will not read back: ${JSON.stringify(scopeStored)}`);
}
const scopeDecisionId = `scope-decision-${scopeId}`;
const scopeDecided = await record.recordScopeDecision({
  scopeDecisionId,
  scopeId,
  scopeDigest: scopeStored.scope.scopeDigest,
  outcome: "approved",
  actorId: "ada",
  recordedBy: "rondo/page",
  decidedAtMs: now,
});
if (scopeDecided.kind !== "recorded") {
  refuse(`the preview scope decision did not record: ${JSON.stringify(scopeDecided)}`);
}

// One more lap, reserved under that approval and left waiting at the gate
// (rondo#233 S4): the screen this whole preview exists to reach. It carries
// two readings -- the deterministic one every lap gets, and a model reading
// with a blocker and a major finding -- so the gate view draws the red line
// beside approve and rondo's own revise draft has real findings to quote.
const waitingLapId = "lap-preview-0004";
const waitingGateId = `gate-${waitingLapId}`;
const waitingReserved = await store.reserve({
  id: waitingLapId,
  request: "teach rondo to count",
  plan: planDocument(waitingLapId),
  spend: null,
  scopeSpend: {
    scopeDecisionId,
    proposalId: null,
    agentTypeDigest: drafted.kind === "drafted" ? drafted.agentTypeDigest : "",
  },
  nowMs: now - 40 * MINUTE,
  supersedesIterationId: null,
  claim: laneFor(waitingLapId, null),
  requestMessageId,
  runId: `rondo-${waitingLapId}`,
  topicBranch: `rondo/${waitingLapId}`,
  workspace: join(workspaceRoot, waitingLapId),
});
if (waitingReserved.kind !== "reserved") {
  refuse(`the preview waiting lap did not reserve: ${JSON.stringify(waitingReserved)}`);
}
for (const [from, to, fields] of [
  ["planned", "admitting", {}],
  ["admitting", "admitted", {}],
  [
    "admitted",
    "performing",
    {
      agentTypeDigest: drafted.kind === "drafted" ? drafted.agentTypeDigest : null,
      modelTier: "standard",
    },
  ],
]) {
  const moved = await store.transition(waitingLapId, from, to, fields, now - 40 * MINUTE);
  if (moved.kind !== "transitioned") {
    refuse(`the preview waiting lap did not reach '${to}': ${JSON.stringify(moved)}`);
  }
}
const checksReading = {
  drafter: modules.records.DETERMINISTIC_READING_DRAFTER,
  verdict: "clear",
  findings: [],
  evidence: {
    baseRef: "refs/remotes/origin/main",
    baseCommit: "b".repeat(40),
    tipCommit: "a".repeat(40),
    materialDigest: `sha256:${"c".repeat(64)}`,
    commitCount: 3,
    fileCount: 4,
  },
  unavailableReason: null,
};
const finalTransition = await store.transition(
  waitingLapId,
  "performing",
  "awaiting_human",
  { gateId: waitingGateId },
  now - 18 * MINUTE,
  checksReading,
);
if (finalTransition.kind !== "transitioned") {
  refuse(
    `the preview waiting lap did not reach 'awaiting_human': ${JSON.stringify(finalTransition)}`,
  );
}
const modelReading = {
  drafter: modules.records.modelReadingDrafter("gpt-6-astra"),
  verdict: "concerns",
  findings: [
    "the count line reads the iteration table directly instead of the ledger's own tally",
    "a redo's cost is added into the sum before its own cost is read",
  ],
  graded: [
    {
      severity: "blocker",
      bases: [{ kind: "file", path: "src/access/web.tsx", line: 214 }],
      basisResolved: true,
    },
    {
      severity: "major",
      bases: [{ kind: "file", path: "src/store/sqlite.ts", line: 118 }],
      basisResolved: true,
    },
  ],
  evidence: {
    baseRef: "refs/remotes/origin/main",
    baseCommit: "b".repeat(40),
    tipCommit: "a".repeat(40),
    materialDigest: `sha256:${"c".repeat(64)}`,
    commitCount: 3,
    fileCount: 4,
    deliveredDigest: `sha256:${"d".repeat(64)}`,
  },
  unavailableReason: null,
};
const appended = await store.appendReading(waitingLapId, modelReading, now - 11 * MINUTE);
if (appended.kind !== "appended") {
  refuse(`the preview model reading did not append: ${JSON.stringify(appended)}`);
}

/**
 * The forge repository the preview's page may publish to (rondo#233 S5).
 *
 * **A repository that does not exist, on purpose.** The dry-run screen needs a
 * remote whose URL agrees with this name, and nothing in a preview should be
 * able to push a scratch branch to a real repository if somebody presses the
 * button on a machine that happens to hold credentials. The screen is complete
 * either way; the press refuses at the push, in words.
 */
const PREVIEW_REPO = "suisya-systems/rondo-preview-not-a-real-repository";
const PREVIEW_REMOTE_URL = `https://github.com/${PREVIEW_REPO}.git`;

/** One git workspace with a base branch and a lap's commit on its topic branch. */
function workOn(workspace, topicBranch, leaveUncommitted) {
  const git = (...args) =>
    execFileSync("git", ["-C", workspace, ...args], {
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "rondo preview",
        GIT_AUTHOR_EMAIL: "preview@example.invalid",
        GIT_COMMITTER_NAME: "rondo preview",
        GIT_COMMITTER_EMAIL: "preview@example.invalid",
      },
    });
  mkdirSync(workspace, { recursive: true });
  execFileSync("git", ["init", "--quiet", "--initial-branch", "main", workspace], {
    encoding: "utf8",
  });
  writeFileSync(join(workspace, "README.md"), "# the preview's repository\n", "utf8");
  git("add", "README.md");
  git("commit", "--quiet", "-m", "chore: the base this lap was cut from");
  git("checkout", "--quiet", "-b", topicBranch);
  writeFileSync(
    join(workspace, "counter.ts"),
    "export function lapsSpent(rows: readonly { cost: number }[]): number {\n" +
      "  return rows.reduce((sum, row) => sum + row.cost, 0);\n" +
      "}\n",
    "utf8",
  );
  git("add", "counter.ts");
  git(
    "commit",
    "--quiet",
    "-m",
    "feat: count what a request has spent, from the rows that were read",
  );
  git("remote", "add", "origin", PREVIEW_REMOTE_URL);
  if (leaveUncommitted) {
    // D-0060 rule 4's refusal, which is about paths and not about publishing:
    // work in the worktree that the push would leave behind.
    writeFileSync(join(workspace, "notes.md"), "half of the second half\n", "utf8");
  }
}

/**
 * One closed lap a person approved, with a real workspace to publish from
 * (rondo#233 S5).
 *
 * `answered_and_forwarded` and not `approve`: that is the one gate outcome that
 * records a person having answered, and it is what `approvedForPublication`
 * asks for. The reading is recorded over what git actually reports, so the
 * screen shows the publish rather than the reading's refusal -- except on the
 * lap that is meant to refuse, where the paths left behind are the point.
 */
async function publishableLap(
  id,
  leaveUncommitted,
  staleReading = false,
  startedMsAgo = 40 * MINUTE,
) {
  const payload = planDocument(id);
  const workspace = payload.workspace;
  const topicBranch = payload.topic_branch;
  workOn(workspace, topicBranch, leaveUncommitted);
  const reserved = await store.reserve({
    id,
    request: "teach rondo to count",
    plan: payload,
    spend: null,
    scopeSpend: null,
    nowMs: now - startedMsAgo,
    supersedesIterationId: null,
    claim: laneFor(id, null),
    requestMessageId,
    runId: `rondo-${id}`,
    topicBranch,
    workspace,
  });
  if (reserved.kind !== "reserved") {
    refuse(`the preview publishable lap did not reserve: ${JSON.stringify(reserved)}`);
  }
  // The reading is taken over the range the reader saw, which is the range
  // `publish` re-reads it against (`readingRangeOf`).
  const read = await modules.forge.inspectLapWork({
    workspace,
    remote: modules.review.READING_REMOTE,
    baseBranch: payload.base_branch,
    topicBranch,
  });
  if (read.kind !== "read") {
    refuse(`the preview workspace would not read: ${JSON.stringify(read)}`);
  }
  const measured = modules.review.evidenceOf(read);
  const reading = {
    drafter: modules.records.DETERMINISTIC_READING_DRAFTER,
    verdict: "clear",
    findings: [],
    // A stale reading is one taken over a tip that is not the tip now: the lap
    // was read, and then the branch moved. That is D-0060 rule 5's refusal, and
    // the only thing on this page that overrules it is the second press.
    evidence: staleReading ? { ...measured, tipCommit: "9".repeat(40) } : measured,
    unavailableReason: null,
  };
  // Stamped at the times they would have happened, for the reason `endedLap`
  // gives (rondo#332): this lap is one of the request's tries and its lines
  // are read in time order with the rest.
  const startedAt = now - startedMsAgo;
  const lapMs = 18 * MINUTE;
  for (const [from, to, fields, taken, at] of [
    ["planned", "admitting", {}, undefined, startedAt],
    ["admitting", "admitted", {}, undefined, startedAt],
    [
      "admitted",
      "performing",
      {
        agentTypeDigest: drafted.kind === "drafted" ? drafted.agentTypeDigest : null,
        modelTier: "standard",
      },
      undefined,
      startedAt,
    ],
    [
      "performing",
      "awaiting_human",
      { gateId: `gate-${id}` },
      reading,
      startedAt + Math.round(lapMs * 0.8),
    ],
    [
      "awaiting_human",
      "closed",
      { gateOutcome: "answered_and_forwarded", lapCostUsd: 1.1, lapDurationMs: lapMs },
      undefined,
      startedAt + lapMs,
    ],
  ]) {
    const moved = await store.transition(id, from, to, fields, at, taken);
    if (moved.kind !== "transitioned") {
      refuse(`the preview publishable lap did not reach '${to}': ${JSON.stringify(moved)}`);
    }
  }
  return id;
}

// The two publish screens worth photographing: one that would publish, and one
// that refuses on D-0060 rule 4 because the workspace still holds work.
// **Where this person's reading stopped** (D-0083 rule 7, D-0061 rule 2.5).
// Seeded two hours back, so the thread has tries above the line and tries
// below it: without a mark there is no line at all, and rule 8's fold -- and
// anything rondo#332 designs beside it -- has nothing to be measured against.
const viewed = await record.recordView("ada", now - 2 * HOUR);
if (viewed.kind !== "recorded") {
  refuse(`the preview view mark did not record: ${JSON.stringify(viewed)}`);
}

const publishableLapId = await publishableLap("lap-preview-0005", false, false, 24 * HOUR);
const refusingLapId = await publishableLap("lap-preview-0006", true, false, 5 * HOUR);
// The third publish screen: the work is publishable, and the reading no longer
// describes it, so the only press offered is the one that overrules it.
const staleLapId = await publishableLap("lap-preview-0007", false, true, 3 * HOUR);

// Two requests the model drafter drafted (rondo#238 C2b), written the way a
// run writes them -- a real host over this store, with a fixed answer standing
// in for claude. The drafter's epoch is taken first, so everything seeded above
// stays the store's past and these two are the drafter's to draft.
await record.messagesBeforeDrafter(now);
const pastedPlan = planDocument("lap-preview-0001");
const agentTypeDigest = drafted.kind === "drafted" ? drafted.agentTypeDigest : "";
async function draftedRequest(requestId, body, extra) {
  await say({
    messageId: requestId,
    body,
    authorKind: "operator",
    authorId: "ada",
    inReplyTo: null,
    atMs: now - 20 * 60 * 1000,
    bases: [],
    asks: false,
  });
  await say({
    messageId: `${requestId}-plan`,
    body: JSON.stringify(pastedPlan),
    authorKind: "operator",
    authorId: "ada",
    inReplyTo: requestId,
    atMs: now - 19 * 60 * 1000,
    bases: [],
    asks: false,
  });
  if (extra !== null) {
    await say({
      messageId: `${requestId}-budget`,
      body: extra,
      authorKind: "operator",
      authorId: "ada",
      inReplyTo: requestId,
      atMs: now - 18 * 60 * 1000,
      bases: [],
      asks: false,
    });
  }
  let n = 0;
  const host = modules.drafterHost.drafterHost({
    store,
    record,
    now: () => now - 17 * 60 * 1000,
    language: null,
    log: () => undefined,
    mintId: (kind) => {
      n += 1;
      return `${kind}-${requestId}-${String(n)}`;
    },
    runDrafter: async () => ({
      kind: "answered",
      costUsd: 0.06,
      finalMessage: JSON.stringify({
        act: "split",
        summary: { text: "Two independent changes, drafted as two plans.", bases: [requestId] },
        plans: [
          {
            template_plan_digest: modules.storePlan.planDigest(pastedPlan),
            agent_type_digest: agentTypeDigest,
            prompt:
              "On the scope screen, let the cost box take a whole-dollar amount typed without " +
              'cents ("3" as well as "3.00"). Change only that box\'s parsing and its tests.',
            bases: [requestId],
          },
          {
            template_plan_digest: modules.storePlan.planDigest(pastedPlan),
            agent_type_digest: agentTypeDigest,
            prompt:
              'On the gate screen, make the approve button\'s label read "Approve" in title ' +
              "case. Change only the label, not the value it records.",
            bases: [requestId],
          },
        ],
        narrowings:
          extra === null ? [] : [{ field: "cost_usd", value: 4, basis: `${requestId}-budget` }],
      }),
    }),
  });
  host.kick();
  await host.idle();
}
await draftedRequest(
  "request-preview-0003",
  "Two things, please: the scope screen's cost box should take whole dollars, and the gate's approve button should say Approve.",
  "Keep the whole thing under $4.",
);
await draftedRequest(
  "request-preview-0004",
  "Two small fixes: whole dollars in the cost box, and a title-case Approve on the gate.",
  null,
);
// The second one approved as drafted, so its screen shows each plan's start.
const draftScope = (await record.scopesFor("request-preview-0004")).find(
  (one) => one.authorKind === "drafter",
);
if (draftScope !== undefined) {
  const approvedDraft = await modules.cli.recordDraftedScopeFromPage(
    { RONDO_APPROVER: "ada" },
    storePath,
    "ada",
    {
      draftScopeId: draftScope.scopeId,
      draftDigest: draftScope.scopeDigest,
      scopeId: "scope-preview-0004-mine",
      budgets: draftScope.payload.budgets,
      severityThreshold: draftScope.payload.severity_threshold,
      outwardActs: draftScope.payload.outward_acts,
    },
  );
  if (!approvedDraft.ok) {
    refuse(`the preview's drafted scope did not approve: ${approvedDraft.note}`);
  }
}

const base = "http://127.0.0.1:7334";
process.stdout.write(
  [
    `store:   ${storePath}`,
    `plan:    ${planPath} (paste it into a thread to offer it there)`,
    drafted.kind === "drafted"
      ? `agent:   ${drafted.agentTypeDigest}`
      : `agent:   the plan was refused: ${drafted.reason}`,
    `gate id: ${waitingGateId}`,
    "",
    "The box to answer in is inside the request's thread (D-0083 rule 9), and the",
    "page a person arrives on is the request that waits on them (rule 3) -- so the",
    "bare address is the screen to open first, at 2560, 1600 and 1280:",
    `open:    ${base}/?lang=en`,
    `also:    ${base}/?lang=ja`,
    `thread:  ${base}/?thread=${requestMessageId}&lang=en`,
    "",
    "The scope screens from S3 are still here:",
    `also:    ${base}/?scope=${requestMessageId}&lang=en`,
    `also:    ${base}/?scope=${requestMessageId}&lang=ja`,
    `also:    ${base}/?requests=open&lang=en`,
    "",
    `publish: ${base}/?publish=${publishableLapId}&lang=en`,
    `also:    ${base}/?publish=${publishableLapId}&lang=ja`,
    "",
    "The publish screen shows what publishing would do, read just now out of a real",
    "git workspace: the push target, the pull request's title and body, and the one",
    "press. The second one refuses on D-0060 rule 4, because that workspace still",
    "holds a path the push would leave behind:",
    `also:    ${base}/?publish=${refusingLapId}&lang=en`,
    "",
    "The third holds a reading taken over a tip the branch has moved off, so the",
    "ordinary press is not drawn at all and the only one offered is the second press",
    "that overrules it (D-0060 rule 5):",
    `also:    ${base}/?publish=${staleLapId}&lang=en`,
    "",
    "Pressing publish under this preview refuses in words at the push: the remote is",
    "a repository that does not exist, on purpose.",
    "",
    "A request the model drafter could not draft: the thread says so plainly and",
    "offers the scope screen, whose plan is the one the seeded laps ran on (rondo#238):",
    `also:    ${base}/?thread=request-preview-0002&lang=en`,
    `also:    ${base}/?scope=request-preview-0002&lang=ja`,
    "",
    "Two requests the model drafter drafted (rondo#238 C2b): one waiting on you, with a",
    "budget narrowed by a message, and one approved, with each plan's start:",
    `also:    ${base}/?scope=request-preview-0003&lang=ja`,
    `also:    ${base}/?scope=request-preview-0004&lang=ja`,
    "",
    "The drafter runs in this process too: a message sent from the page is drafted",
    "by a real claude, if one is installed here. The seeded rows predate it and are",
    "left alone.",
    "",
    "The scoped start press refuses in words under this preview, because there is no",
    "continuo here to run a lap. That refusal screen is one of the screens worth",
    "photographing.",
    "",
  ].join("\n"),
);

process.exitCode = await modules.cli.main(["web", "--port", "7334", "--repo", PREVIEW_REPO], {
  ...process.env,
  RONDO_STORE: storePath,
  RONDO_APPROVER: "ada",
  RONDO_MAX_LIVE: "6",
  RONDO_MAX_OCCUPYING: "4",
});
