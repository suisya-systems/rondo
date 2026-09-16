/**
 * The operator page, served over a seeded store, for looking at (rondo#233 S3).
 *
 *   npm run build && npm run page:preview
 *
 * **It calls the real command.** The last thing this script does is
 * `main(["web", "--port", "7334"], env)` out of `dist/access/cli.js`, so what a
 * browser gets is rondo's own wiring -- `RONDO_PLAN`, the ports, the press
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

/** The plan document the page reads through RONDO_PLAN, admitted under one id. */
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
// scope form drafts its budgets from: without it every basis is a cold start,
// which is the one thing seeding laps at all is meant to avoid.
const drafted = await modules.cli.scopeDraftingFromPlan(planPath, record, modules.wording.EN);

const requestMessageId = "request-preview-0001";
const now = Date.now();

async function say(draft) {
  const outcome = await record.recordThreadMessage(draft);
  if (outcome.kind !== "recorded") {
    refuse(`the preview message was not recorded: ${outcome.reason}`);
  }
}

/** One ended lap carrying a cost and a duration, for the budgets to read. */
async function endedLap(id, costUsd, durationMs, supersedesIterationId) {
  const reserved = await store.reserve({
    id,
    request: "teach rondo to count",
    plan: planDocument(id),
    spend: null,
    scopeSpend: null,
    nowMs: now - durationMs,
    supersedesIterationId,
    requestMessageId: null,
    runId: `rondo-${id}`,
    topicBranch: `rondo/${id}`,
    workspace: join(workspaceRoot, id),
  });
  if (reserved.kind !== "reserved") {
    refuse(`the preview lap did not reserve: ${JSON.stringify(reserved)}`);
  }
  const steps = [
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
    ["performing", "awaiting_human", { gateId: `gate-${id}` }],
    [
      "awaiting_human",
      "closed",
      { gateOutcome: "approve", lapCostUsd: costUsd, lapDurationMs: durationMs },
    ],
  ];
  for (const [from, to, fields] of steps) {
    const moved = await store.transition(id, from, to, fields, now);
    if (moved.kind !== "transitioned") {
      refuse(`the preview lap did not reach '${to}': ${JSON.stringify(moved)}`);
    }
  }
}

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
  atMs: now - 90 * 60 * 1000,
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
  atMs: now - 60 * 60 * 1000,
  bases: [{ form: "message", messageId: requestMessageId }],
  asks: false,
});

// Three ended laps, one of them a redo, so `first_lap_cost`, `redo_cost` and
// `lap_duration` each find rows rather than three cold starts.
await endedLap("lap-preview-0001", 1.42, 22 * 60 * 1000, null);
await endedLap("lap-preview-0002", 0.86, 14 * 60 * 1000, null);
await endedLap("lap-preview-0003", 2.15, 31 * 60 * 1000, "lap-preview-0001");

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
  nowMs: now - 8 * 60 * 1000,
  supersedesIterationId: null,
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
  const moved = await store.transition(waitingLapId, from, to, fields, now);
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
  now,
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
const appended = await store.appendReading(waitingLapId, modelReading, now);
if (appended.kind !== "appended") {
  refuse(`the preview model reading did not append: ${JSON.stringify(appended)}`);
}

const base = "http://127.0.0.1:7334";
process.stdout.write(
  [
    `store:   ${storePath}`,
    `plan:    ${planPath}`,
    drafted.kind === "drafted"
      ? `agent:   ${drafted.agentTypeDigest}`
      : `agent:   the plan was refused: ${drafted.reason}`,
    `gate id: ${waitingGateId}`,
    "",
    "The gate view of the waiting lap is the S4 screen (rondo#233): its approve bar",
    "offers revise beside approve, and the revise form's draft quotes the blocker and",
    "major findings seeded onto it. Open this first, at 1280 and at 420 wide:",
    `open:    ${base}/?answer=${waitingLapId}&lang=en`,
    `also:    ${base}/?answer=${waitingLapId}&lang=ja`,
    "",
    "The scope screens from S3 are still here:",
    `also:    ${base}/?scope=${requestMessageId}&lang=en`,
    `also:    ${base}/?scope=${requestMessageId}&lang=ja`,
    `also:    ${base}/?requests=open&lang=en`,
    "",
    "The scoped start press refuses in words under this preview, because there is no",
    "continuo here to run a lap. That refusal screen is one of the screens worth",
    "photographing.",
    "",
  ].join("\n"),
);

process.exitCode = await modules.cli.main(["web", "--port", "7334"], {
  ...process.env,
  RONDO_STORE: storePath,
  RONDO_APPROVER: "ada",
  RONDO_PLAN: planPath,
  RONDO_MAX_LIVE: "6",
  RONDO_MAX_OCCUPYING: "4",
});
