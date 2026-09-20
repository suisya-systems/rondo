/**
 * A world for the revise drafter (DECISIONS.md D-0077), shared by the cases
 * that are about the drafter and the ones that are about the page drawing its
 * result.
 *
 * **Its own module since the page's rebuild.** `src/access/revise-drafter.ts`'s
 * coverage used to live inside `test/access/web.test.ts`, so replacing the view
 * layer would have deleted the cases that say the drafter writes one row per
 * reading, keeps a draft across a store fault, and discards a draft a newer
 * reading made stale. None of those is about markup. The fixtures live here so
 * both suites can hold them, which is what `planted-lap.ts` already does for a
 * lap.
 *
 * The one case that both drafts and then reads the drawn page -- an
 * unavailable run, whose reason the gate shows -- stays with the renderer,
 * because what it is asserting is markup.
 */
import { DatabaseSync } from "node:sqlite";
import { expect } from "vitest";
import { reviseDrafterHost } from "../../src/access/revise-drafter.js";
import { allocate } from "../../src/refrain/allocator.js";
import { admittedPlan, planPayload, type RunPlan, runPlan } from "../../src/refrain/plan.js";
import type { JsonRecord } from "../../src/store/records.js";
import { advisoryRecord, iterationStore } from "../../src/store/sqlite.js";
import { ownLane } from "../lane-claims.js";

export const fresh = () => {
  const connection = new DatabaseSync(":memory:");
  return {
    connection,
    store: iterationStore(connection, { maxOccupying: 4, maxLive: 6 }),
    record: advisoryRecord(connection),
  };
};

/** Put one reserved row at the gate, which is the only state with a button. */
export async function openGate(world: ReturnType<typeof fresh>, id: string): Promise<void> {
  for (const [from, to] of [
    ["planned", "admitting"],
    ["admitting", "admitted"],
    ["admitted", "performing"],
    ["performing", "awaiting_human"],
  ] as const) {
    const outcome = await world.store.transition(
      id,
      from,
      to,
      to === "awaiting_human" ? { gateId: `gate-${id}` } : {},
      2_000,
    );
    if (outcome.kind !== "transitioned") {
      throw new Error(`the fixture did not reach '${to}': ${JSON.stringify(outcome)}`);
    }
  }
}

export async function reserve(
  world: ReturnType<typeof fresh>,
  id: string,
  request: string,
  materialLanguage: string | null = null,
): Promise<void> {
  const outcome = await world.store.reserve({
    id,
    request,
    plan: planFor(id, materialLanguage),
    spend: null,
    scopeSpend: null,
    claim: ownLane(id),
    nowMs: 1_000,
    supersedesIterationId: null,
    requestMessageId: null,
    runId: `rondo-${id}`,
    topicBranch: `rondo/${id}`,
    workspace: `/srv/work/${id}`,
  });
  if (outcome.kind !== "reserved") {
    throw new Error(`the fixture did not reserve: ${JSON.stringify(outcome)}`);
  }
}

export const PLAN: RunPlan = {
  db: "/srv/continuo.db",
  workspaceRoot: "/srv/work",
  baseBranch: "main",
  prompt: "do the thing",
  allowedBash: ["npm run:*"],
  materialLanguage: null,
  reviewCriterion: null,
  repository: "/srv/repo",
  artifactRoot: "/srv/artifacts",
  stateRoot: "/srv/state",
  interlockRoot: "/srv/interlock",
  claudeOrgPath: "/srv/claude-org",
  endpointRecipient: "external-notify",
  endpointDestinationDir: "/srv/dropbox",
  claudeCommand: ["/usr/bin/node", "/opt/claude/cli.js"],
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
  forgeRepository: null,
  invocationCeilingMs: 1_800_000,
  catalogLayers: [{ layer: "git_url", origin: "o", baseDir: "/srv/catalog", data: {} }],
  projectName: "rondo",
  agentTypeInput: {} as RunPlan["agentTypeInput"],
  parties: {
    grantor: "rondo",
    grantee: "unset",
  } as unknown as RunPlan["parties"],
  intendedAction: {} as RunPlan["intendedAction"],
};

export function planFor(id: string, materialLanguage: string | null = null): JsonRecord {
  const validated = runPlan({ ...PLAN, materialLanguage });
  if (validated.kind !== "planned") {
    throw new Error(`the fixture plan is not valid: ${validated.reason}`);
  }
  const allocation = allocate(id, PLAN.workspaceRoot);
  if (allocation.kind !== "allocated") {
    throw new Error(`the fixture id '${id}' does not allocate: ${allocation.reason}`);
  }
  const admitted = admittedPlan(validated.plan, allocation.allocation);
  if (admitted.kind !== "planned") {
    throw new Error(`the fixture allocation is not valid: ${admitted.reason}`);
  }
  return planPayload(admitted.plan);
}

export const EVIDENCE = {
  baseRef: "origin/main",
  baseCommit: "a".repeat(40),
  tipCommit: "b".repeat(40),
  materialDigest: "sha256:x",
  commitCount: 2,
  fileCount: 1,
};

/** A lap at its gate with the deterministic reading carried by its transition. */
export async function gateWithChecks(world: ReturnType<typeof fresh>): Promise<void> {
  await reserve(world, "i-0001", "add a retry budget");
  await openGate(world, "i-0001");
  const carried = await world.store.transition(
    "i-0001",
    "awaiting_human",
    "awaiting_human",
    { permissionDenials: '[{"tool_name":"Bash","tool_input":{"command":"rm -rf /srv"}}]' },
    3_000,
    {
      drafter: "rondo/deterministic/2",
      verdict: "concerns",
      findings: ["a binary file was not read"],
      evidence: EVIDENCE,
      unavailableReason: null,
    },
  );
  expect(carried.kind).toBe("transitioned");
}

/** The model reading the S4 tests draft from: one blocker and one major, with bases. */
export async function modelFindings(world: ReturnType<typeof fresh>): Promise<void> {
  const appended = await world.store.appendReading(
    "i-0001",
    {
      drafter: "rondo/model/1/gpt-6-astra",
      verdict: "concerns",
      findings: ["the loop never stops", "the backoff is not capped"],
      graded: [
        {
          severity: "blocker",
          bases: [{ kind: "file", path: "src/notifier.ts", line: 41 }],
          basisResolved: true,
        },
        {
          severity: "major",
          bases: [{ kind: "rule", path: "AGENTS.md", line: 12 }],
          basisResolved: true,
        },
      ],
      evidence: EVIDENCE,
      unavailableReason: null,
    },
    4_000,
  );
  expect(appended.kind).toBe("appended");
}

export let reviseIds = 0;

/**
 * One run of the revise drafter over the lap at the gate (D-0077), with the
 * model's answer given: what the resident host writes for the view to read.
 */
export async function draftRevise(
  world: ReturnType<typeof fresh>,
  answer: unknown,
  opts: {
    readonly admitted?: string | null;
    readonly during?: () => Promise<void>;
    /** Stands in for the store's write, to fail it. */
    readonly write?: (
      real: ReturnType<typeof fresh>["record"]["recordReviseDraft"],
    ) => ReturnType<typeof fresh>["record"]["recordReviseDraft"];
    /** Kicks before the host is let go: one host, several scans. */
    readonly scans?: number;
  } = {},
): Promise<string[]> {
  const documents: string[] = [];
  const admitted = opts.admitted === undefined ? "decision-1" : opts.admitted;
  const host = reviseDrafterHost({
    store: world.store,
    record: {
      ...world.record,
      scopeDecisionAdmitting: async () => admitted,
      recordReviseDraft:
        opts.write?.(world.record.recordReviseDraft.bind(world.record)) ??
        world.record.recordReviseDraft.bind(world.record),
    },
    runDrafter: async (_row, document) => {
      documents.push(document);
      await opts.during?.();
      return answer === null
        ? { kind: "failed", reason: "claude exited 1" }
        : {
            kind: "answered",
            costUsd: 0.01,
            finalMessage: typeof answer === "string" ? answer : JSON.stringify(answer),
          };
    },
    now: () => 4_500,
    // One counter across hosts: two hosts over one store mint distinct ids.
    mintId: (kind) => {
      reviseIds += 1;
      return `${kind}-${String(reviseIds)}`;
    },
    language: null,
    log: () => undefined,
  });
  for (let scan = 0; scan < (opts.scans ?? 1); scan += 1) {
    host.kick();
    await host.idle();
  }
  return documents;
}

/** The revise drafts written for a lap, as the store holds them. */
export const reviseRows = (world: ReturnType<typeof fresh>) =>
  world.connection
    .prepare(
      "SELECT drafter, payload, snapshot FROM proposal WHERE kind = 'revise_draft' ORDER BY rowid",
    )
    .all()
    .map((row) => ({
      drafter: String(row["drafter"]),
      payload: JSON.parse(String(row["payload"])) as JsonRecord,
      snapshot: JSON.parse(String(row["snapshot"])) as JsonRecord,
    }));

/** A second model reading of the lap at the gate, with one finding. */
export async function newerModelReading(
  world: ReturnType<typeof fresh>,
  finding: string,
  atMs: number,
) {
  const appended = await world.store.appendReading(
    "i-0001",
    {
      drafter: "rondo/model/1/gpt-6-astra",
      verdict: "concerns",
      findings: [finding],
      graded: [{ severity: "major", bases: [], basisResolved: false }],
      evidence: EVIDENCE,
      unavailableReason: null,
    },
    atMs,
  );
  expect(appended.kind).toBe("appended");
}

/** A draft that addresses both of {@link modelFindings}' findings, with a lead. */
export const REVISE_ANSWER = {
  lead: "Keep the retry budget, but make it end.",
  findings: [
    { finding: 2, change: "Cap the backoff at 30 seconds." },
    { finding: 1, change: "Stop after the budget's last try.\nSay so in the log." },
  ],
};
