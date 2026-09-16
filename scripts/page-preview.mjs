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

const base = "http://127.0.0.1:7334";
process.stdout.write(
  [
    `store:   ${storePath}`,
    `plan:    ${planPath}`,
    drafted.kind === "drafted"
      ? `agent:   ${drafted.agentTypeDigest}`
      : `agent:   the plan was refused: ${drafted.reason}`,
    `open:    ${base}/?scope=${requestMessageId}&lang=en`,
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
