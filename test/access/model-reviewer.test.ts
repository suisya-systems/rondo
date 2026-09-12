/**
 * Taking a model reading, over a real store and fake processes (D-0065).
 *
 * The composition's whole job is order: which reading's range is handed over,
 * what is refused before anything spawns, and that the row appended is what the
 * screen then prints. `git`, `codex` and `continuo` are replaced by the ports;
 * the store is real, because "a row was appended and reads back" is a claim
 * about a database. What a real model finds is not here (D-0029 `V-12`).
 */
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import { lapMaterialLines } from "../../src/access/cli.js";
import type { ReviewMaterialFacts } from "../../src/access/forge.js";
import type { ReviewerRun } from "../../src/access/model-review.js";
import { type ModelReviewPorts, takeModelReading } from "../../src/access/model-reviewer.js";
import { EN } from "../../src/access/wording.js";
import { allocate } from "../../src/refrain/allocator.js";
import {
  admittedPlan,
  planPayload,
  type ReviewCriterion,
  type RunPlan,
  runPlan,
} from "../../src/refrain/plan.js";
import { contentDigest } from "../../src/store/plan.js";
import type { JsonRecord, LapReadingDraft, ReadingEvidence } from "../../src/store/records.js";
import { iterationStore } from "../../src/store/sqlite.js";

const PLAN: RunPlan = {
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
  invocationCeilingMs: 1_800_000,
  catalogLayers: [{ layer: "git_url", origin: "o", baseDir: "/srv/catalog", data: {} }],
  projectName: "rondo",
  agentTypeInput: {} as RunPlan["agentTypeInput"],
  parties: { grantor: "rondo", grantee: "unset" } as unknown as RunPlan["parties"],
  intendedAction: {} as RunPlan["intendedAction"],
};

const CRITERION: ReviewCriterion = {
  severities: {
    blocker: "wrong or unsafe to merge",
    major: "a claim the material contradicts",
    minor: "worth fixing",
    nit: "style",
  },
  ruleFiles: ["AGENTS.md"],
};

function planFor(id: string, criterion: ReviewCriterion | null): JsonRecord {
  const validated = runPlan({
    ...PLAN,
    reviewCriterion: criterion,
    materialLanguage: "ja",
  });
  if (validated.kind !== "planned") throw new Error(validated.reason);
  const allocation = allocate(id, PLAN.workspaceRoot);
  if (allocation.kind !== "allocated") throw new Error(allocation.reason);
  const admitted = admittedPlan(validated.plan, allocation.allocation);
  if (admitted.kind !== "planned") throw new Error(admitted.reason);
  return planPayload(admitted.plan);
}

const EVIDENCE: ReadingEvidence = {
  baseRef: "refs/remotes/origin/main",
  baseCommit: "b".repeat(40),
  tipCommit: "a".repeat(40),
  materialDigest: `sha256:${"c".repeat(64)}`,
  commitCount: 1,
  fileCount: 1,
};

const DETERMINISTIC: LapReadingDraft = {
  drafter: "rondo/deterministic/2",
  verdict: "clear",
  findings: [],
  evidence: EVIDENCE,
  unavailableReason: null,
};

const FACTS: ReviewMaterialFacts = {
  kind: "read",
  diff: [
    "diff --git a/src/check.ts b/src/check.ts",
    "--- a/src/check.ts",
    "+++ b/src/check.ts",
    "@@ -1,3 +1,1 @@",
    "-if (!allowed) {",
    "-  throw new Error('no');",
    " run();",
    "",
  ].join("\n"),
  commits: [{ sha: "a".repeat(40), message: "fix: speed up run" }],
  ruleFiles: [{ path: "AGENTS.md", content: "Never remove an authorisation check.\n" }],
};

async function world(
  options: {
    readonly criterion?: ReviewCriterion | null;
    readonly model?: string;
    readonly reading?: LapReadingDraft | null;
  } = {},
) {
  const store = iterationStore(new DatabaseSync(":memory:"), { maxOccupying: 4, maxLive: 6 });
  const id = "i-0001";
  await store.reserve({
    id,
    request: "do the thing",
    plan: planFor(id, options.criterion === undefined ? CRITERION : options.criterion),
    spend: null,
    nowMs: 1_000,
    supersedesIterationId: null,
    runId: "rondo-i-0001",
    topicBranch: "rondo/i-0001",
    workspace: "/srv/work/iter-i-0001",
  });
  await store.transition(
    id,
    "planned",
    "awaiting_human",
    { model: options.model ?? "claude-opus-5", sessionId: "s-1", gateId: "g-1" },
    2_000,
    options.reading === undefined ? DETERMINISTIC : options.reading,
  );
  const calls = { gather: 0, run: [] as string[], commands: 0 };
  const answer = (document: string): ReviewerRun => ({
    kind: "answered",
    finalMessage: JSON.stringify({
      findings: [
        {
          severity: "major",
          text: "the commit says it speeds run up and the diff deletes the authorisation check",
          bases: [
            { kind: "file", path: "src/check.ts", line: 1 },
            { kind: "rule", path: "AGENTS.md", line: 1 },
          ],
        },
      ],
    }),
    deliveredDigest: contentDigest({ delivered: document }),
  });
  const ports: ModelReviewPorts = {
    store,
    rationale: async () => "I sped run up and verified it",
    gather: async (request) => {
      calls.gather += 1;
      expect(request.evidence).toEqual(EVIDENCE);
      expect(request.ruleFiles).toEqual(["AGENTS.md"]);
      return FACTS;
    },
    runReviewer: async (_row, document) => {
      calls.run.push(document);
      return answer(document);
    },
    readCommands: (request) => {
      calls.commands += 1;
      expect(request).toEqual({ stateRoot: "/srv/state", runId: "rondo-i-0001", sessionId: "s-1" });
      return {
        kind: "read",
        commands: [{ index: 3, command: "npm run verify", output: "ok", isError: false }],
        finalMessage: "done",
      };
    },
    now: () => 3_000,
  };
  return { store, id, ports, calls };
}

test("a reading is taken over the deterministic range, appended, and printed from the row", async () => {
  const { store, id, ports, calls } = await world();

  const lines = await takeModelReading(ports, id);

  expect(calls.gather).toBe(1);
  expect(calls.run).toHaveLength(1);
  const document = calls.run[0] ?? "";
  // The prompt as continuo received it, the rationale as a claim, the commands.
  expect(document).toContain("do the thing");
  expect(document).toContain("IETF language tag ja");
  expect(document).toContain("I sped run up and verified it");
  expect(document).toContain("npm run verify");
  expect(document).toContain("Never remove an authorisation check.");

  const readings = await store.readingsFor(id);
  expect(readings.map((r) => r.drafter)).toEqual([
    "rondo/deterministic/2",
    "rondo/model/1/gpt-6-astra",
  ]);
  const model = readings[1];
  expect(model?.verdict).toBe("concerns");
  expect(model?.graded?.[0]?.severity).toBe("major");
  expect(model?.graded?.[0]?.basisResolved).toBe(true);
  expect(model?.evidence?.deliveredDigest).toBe(contentDigest({ delivered: document }));
  expect(model?.evidence?.tipCommit).toBe(EVIDENCE.tipCommit);

  const said = lines.join("\n");
  expect(said).toContain("[major]");
  expect(said).toContain("src/check.ts:1");
  expect(said).toContain("material for you, not a check");
});

test("a plan with no criterion is refused before anything is gathered or spawned", async () => {
  const { store, id, ports, calls } = await world({ criterion: null });

  const lines = await takeModelReading(ports, id);

  expect(calls.gather).toBe(0);
  expect(calls.run).toEqual([]);
  const model = (await store.readingsFor(id)).at(-1);
  expect(model?.drafter).toBe("rondo/model/1/gpt-6-astra");
  expect(model?.verdict).toBe("unavailable");
  expect(model?.unavailableReason).toContain("D-0029 rule 13");
  expect(lines.join("\n")).toContain("no model reading could be taken");
});

test("a lap run under the reviewer's own family is refused without spawning", async () => {
  const { store, id, ports, calls } = await world({ model: "gpt-6-astra" });

  await takeModelReading(ports, id);

  expect(calls.run).toEqual([]);
  const model = (await store.readingsFor(id)).at(-1);
  expect(model?.verdict).toBe("unavailable");
  expect(model?.unavailableReason).toContain("D-0065 rule 3.3");
});

test("no deterministic range means no hand-over, recorded as unavailable", async () => {
  const { store, id, ports, calls } = await world({
    reading: { ...DETERMINISTIC, verdict: "unavailable", evidence: null, unavailableReason: "x" },
  });

  await takeModelReading(ports, id);

  expect(calls.gather).toBe(0);
  expect(calls.run).toEqual([]);
  expect((await store.readingsFor(id)).at(-1)?.unavailableReason).toContain("D-0065 1.2.1");
});

test("unreadable material and a failed run are rows, and a throw is a line", async () => {
  const unreadable = await world();
  await takeModelReading(
    { ...unreadable.ports, gather: async () => ({ kind: "unreadable", reason: "no AGENTS.md" }) },
    unreadable.id,
  );
  expect((await unreadable.store.readingsFor(unreadable.id)).at(-1)?.unavailableReason).toContain(
    "no AGENTS.md",
  );

  const failed = await world();
  await takeModelReading(
    { ...failed.ports, runReviewer: async () => ({ kind: "failed", reason: "exited 1" }) },
    failed.id,
  );
  expect((await failed.store.readingsFor(failed.id)).at(-1)?.unavailableReason).toContain(
    "exited 1",
  );

  const thrown = await world();
  const lines = await takeModelReading(
    {
      ...thrown.ports,
      gather: async () => {
        throw new Error("boom");
      },
    },
    thrown.id,
  );
  expect(lines.join("\n")).toContain("boom");
});

test("the gate screen keeps the deterministic reading as the review and adds the model's as material", async () => {
  // A row with no range, so the screen reaches no git (fence-material.test.ts).
  const store = iterationStore(new DatabaseSync(":memory:"), { maxOccupying: 4, maxLive: 6 });
  await store.reserve({
    id: "i-0002",
    request: "do the thing",
    plan: { run_id: "rondo-i-0002" },
    spend: null,
    nowMs: 1_000,
    supersedesIterationId: null,
    runId: "rondo-i-0002",
    topicBranch: "rondo/i-0002",
    workspace: "/srv/work/iter-i-0002",
  });
  await store.transition("i-0002", "planned", "awaiting_human", {}, 2_000, DETERMINISTIC);
  await store.appendReading(
    "i-0002",
    {
      drafter: "rondo/model/1/gpt-6-astra",
      verdict: "concerns",
      findings: ["the check is gone"],
      graded: [{ severity: "blocker", bases: [], basisResolved: false }],
      evidence: { ...EVIDENCE, deliveredDigest: `sha256:${"d".repeat(64)}` },
      unavailableReason: null,
    },
    3_000,
  );
  const read = await store.read("i-0002");
  if (read.kind !== "read") throw new Error(read.kind);

  const said = (await lapMaterialLines(EN, store, read.record, null)).join("\n");

  // The deterministic `clear` is still the review line, although the model row is newer.
  expect(said).toContain("review  read the commits and the files, and raised nothing");
  expect(said).toContain("[blocker] the check is gone");
  expect(said).toContain("no basis resolved");
});
