/**
 * A plan an operator would paste into a request thread, and a store to paste
 * it into, for the drafter's tests (D-0071 point 1 (a)).
 */
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { agentTypeRecordOf } from "../../../src/access/scope.js";
import { allocate } from "../../../src/refrain/allocator.js";
import {
  admittedPlan,
  planPayload,
  type RunPlan,
  readRunPlan,
  runPlan,
} from "../../../src/refrain/plan.js";
import type { JsonRecord } from "../../../src/store/records.js";
import { advisoryRecord, iterationStore } from "../../../src/store/sqlite.js";

export const AGENT_TYPE_INPUT = {
  agentTypeId: "worker-basic",
  vocabularyVersion: 1,
  granted: ["command.run"],
  askable: ["branch.push"],
  loopPolicy: { maxReviewRounds: 2, noProgressWindow: 3, noProgressRepeat: 2 },
  executorPolicy: { roleName: "worker", modelTier: "standard", reportingDuties: [] },
};

/**
 * Absolute on the machine the test runs on (`test/access/scope-stop.test.ts`'s
 * `ABS`): cadenza classifies the plan against its catalog, and on Windows a
 * path that is only POSIX-shaped is not the path the catalog resolves.
 */
const ABS = (path: string): string => resolve(path);
export const REPOSITORY = ABS("/srv/repo");
export const WORKSPACE_ROOT = ABS("/srv/work");

export const PLAN = {
  db: ABS("/srv/continuo.db"),
  workspaceRoot: WORKSPACE_ROOT,
  baseBranch: "main",
  prompt: "do the thing",
  allowedBash: ["npm run:*"],
  materialLanguage: null,
  reviewCriterion: null,
  repository: REPOSITORY,
  artifactRoot: ABS("/srv/artifacts"),
  stateRoot: ABS("/srv/state"),
  interlockRoot: ABS("/srv/interlock"),
  claudeOrgPath: ABS("/srv/claude-org"),
  endpointRecipient: "external-notify",
  endpointDestinationDir: ABS("/srv/dropbox"),
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
  invocationCeilingMs: 1_800_000,
  // A catalog cadenza classifies (as `test/access/scope-stop.test.ts` has it),
  // so a scope's verdict over this plan gets past its agent-type test.
  catalogLayers: [
    {
      layer: "tracked",
      origin: `${ABS("/srv/catalog")}/projects.toml`,
      baseDir: ABS("/srv/catalog"),
      data: {
        schema_version: 1,
        catalog: { allowed_local_roots: [REPOSITORY] },
        project: {
          rondo: {
            source: { kind: "local_path", path: REPOSITORY },
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
} as unknown as RunPlan;

/** A plan document as an operator would paste it: validated, allocated, serialised. */
export function planDocument(): JsonRecord {
  const validated = runPlan(PLAN);
  if (validated.kind !== "planned") throw new Error(validated.reason);
  const allocation = allocate("drafter-fixture", PLAN.workspaceRoot);
  if (allocation.kind !== "allocated") throw new Error(allocation.reason);
  const admitted = admittedPlan(validated.plan, allocation.allocation);
  if (admitted.kind !== "planned") throw new Error(admitted.reason);
  return planPayload(admitted.plan);
}

export function agentTypeDigestOf(document: JsonRecord): string {
  const planned = readRunPlan(document);
  if (planned.kind !== "planned") throw new Error(planned.reason);
  const recorded = agentTypeRecordOf(planned.plan, document);
  if ("refusal" in recorded) throw new Error(recorded.refusal);
  return recorded.record.agentTypeDigest;
}

export async function world() {
  const connection = new DatabaseSync(":memory:");
  const store = iterationStore(connection, { maxOccupying: 4, maxLive: 6 });
  const record = advisoryRecord(connection);
  // A drafter host has run on this store before any message below: what a
  // test writes is the drafter's to draft, not the past a host leaves alone.
  await record.messagesBeforeDrafter(0);
  const say = async (messageId: string, body: string, inReplyTo: string | null, atMs: number) => {
    const outcome = await record.recordThreadMessage({
      messageId,
      body,
      authorKind: "operator",
      authorId: "ada",
      inReplyTo,
      atMs,
      bases: [],
      asks: false,
    });
    if (outcome.kind !== "recorded") throw new Error(JSON.stringify(outcome));
  };
  return { connection, store, record, say };
}
