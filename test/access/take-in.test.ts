/**
 * What a revision must take in first (D-0098 rule 2, built by D-0105), over a
 * real store and a real repository: the landed-paths trigger, the conflict
 * cause rondo#417 passes, and a take-in the predecessor did not pass.
 *
 * git is real because the trigger is a question about history -- which paths
 * the forge's default branch changed since the lap's tip left it -- and the
 * fetch into the successor's own base branch is a ref git writes.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import { revisionTakeIn } from "../../src/access/cli.js";
import { allowedCommandsFor } from "../../src/cadenza/facade.js";
import { allocate } from "../../src/refrain/allocator.js";
import {
  admittedPlan,
  planPayload,
  type RunPlan,
  runPlan,
  type TakeIn,
} from "../../src/refrain/plan.js";
import type { IterationRecord } from "../../src/store/records.js";
import { REQUEST, storeWithRequest } from "../request-fixture.js";

function git(cwd: string, ...args: string[]): string {
  return execFileSync(
    "git",
    [
      "-c",
      "user.name=rondo-test",
      "-c",
      "user.email=rondo-test@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "-c",
      "init.defaultBranch=main",
      ...args,
    ],
    { cwd, encoding: "utf8", stdio: "pipe" },
  ).trim();
}

/**
 * A forge, the clone laps are cut from, and a second clone somebody else
 * lands from. The lap's topic branch changes its own lane and `shared.txt`,
 * which is outside its claim. Answers the clone, the lap's base and tip, and
 * a function that lands `path` on the forge's `main` and returns its head.
 */
function repository() {
  const root = mkdtempSync(join(tmpdir(), "rondo-take-in-"));
  const remote = join(root, "remote.git");
  const repo = join(root, "repo");
  const other = join(root, "other");
  git(root, "init", "--bare", remote);
  git(root, "clone", remote, other);
  writeFileSync(join(other, "shared.txt"), "one\n");
  writeFileSync(join(other, "other.txt"), "one\n");
  git(other, "add", ".");
  git(other, "commit", "-m", "base");
  git(other, "push", "origin", "main");
  git(root, "clone", remote, repo);
  const base = git(repo, "rev-parse", "HEAD");
  git(repo, "switch", "-c", "rondo/i-0001");
  writeFileSync(join(repo, "shared.txt"), "the lap's\n");
  git(repo, "commit", "-am", "the lap");
  const tip = git(repo, "rev-parse", "HEAD");
  git(repo, "switch", "main");
  const land = (path: string): string => {
    writeFileSync(join(other, path), `landed ${path}\n`);
    git(other, "commit", "-am", `land ${path}`);
    git(other, "push", "origin", "main");
    return git(other, "rev-parse", "HEAD");
  };
  return { repo, root, base, tip, land };
}

/** A catalog whose one project lets the worker run `allowedBash` (D-0094). */
const catalog = (allowedBash: readonly string[]): RunPlan["catalogLayers"] => [
  {
    layer: "tracked",
    origin: resolve("/srv/catalog/projects.toml"),
    baseDir: resolve("/srv/catalog"),
    data: {
      schema_version: 1,
      project: {
        rondo: {
          source: { kind: "git_url", url: "https://example.invalid/org/rondo.git" },
          base_branch: "main",
          aliases: [],
          allowed_bash: [...allowedBash],
        },
      },
    },
  },
];

const PLAN = (
  repo: string,
  root: string,
  takeIn: TakeIn | null,
  allowedBash: readonly string[],
): RunPlan => ({
  db: join(root, "continuo.db"),
  workspaceRoot: join(root, "work"),
  baseBranch: "main",
  prompt: "do the thing",
  materialLanguage: null,
  reviewCriterion: null,
  repository: repo,
  artifactRoot: join(root, "artifacts"),
  stateRoot: join(root, "state"),
  interlockRoot: join(root, "interlock"),
  claudeOrgPath: join(root, "claude-org"),
  endpointRecipient: "external-notify",
  endpointDestinationDir: join(root, "dropbox"),
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
  takeIn,
  decisionRecord: null,
  invocationCeilingMs: 1_800_000,
  catalogLayers: catalog(allowedBash),
  projectName: "rondo",
  agentTypeInput: {} as RunPlan["agentTypeInput"],
  parties: { grantor: "rondo", grantee: "unset" } as unknown as RunPlan["parties"],
  intendedAction: {} as RunPlan["intendedAction"],
});

/** The predecessor at its gate, claiming only its own lane, read at `base...tip`. */
async function atGate(
  fixture: ReturnType<typeof repository>,
  takeIn: TakeIn | null = null,
  allowedBash: readonly string[] = allowedCommandsFor([]),
): Promise<{ store: ReturnType<typeof storeWithRequest>; record: IterationRecord }> {
  const store = storeWithRequest(new DatabaseSync(":memory:"), { maxOccupying: 4, maxLive: 6 });
  const id = "i-0001";
  const validated = runPlan(PLAN(fixture.repo, fixture.root, takeIn, allowedBash));
  if (validated.kind !== "planned") throw new Error(validated.reason);
  const allocation = allocate(id, validated.plan.workspaceRoot);
  if (allocation.kind !== "allocated") throw new Error(allocation.reason);
  const admitted = admittedPlan(validated.plan, allocation.allocation);
  if (admitted.kind !== "planned") throw new Error(admitted.reason);
  await store.reserve({
    numbers: null,
    id,
    request: "do the thing",
    plan: planPayload(admitted.plan),
    spend: null,
    scopeSpend: null,
    claim: { paths: ["lanes/"], authorKind: "drafter", authorId: "test", bases: [] },
    nowMs: 1_000,
    supersedesIterationId: null,
    requestMessageId: REQUEST,
    ...allocation.allocation,
  });
  await store.transition(
    id,
    "planned",
    "awaiting_human",
    { model: "claude-opus-5", sessionId: "s-1", lapCommands: "[]", gateId: "g-1" },
    2_000,
    {
      drafter: "rondo/deterministic/2",
      verdict: "clear",
      findings: [],
      evidence: {
        baseRef: "refs/remotes/origin/main",
        baseCommit: fixture.base,
        tipCommit: fixture.tip,
        materialDigest: `sha256:${"c".repeat(64)}`,
        commitCount: 1,
        fileCount: 1,
      },
      unavailableReason: null,
    },
  );
  const read = await store.read(id);
  if (read.kind !== "read") throw new Error("the predecessor did not read back");
  return { store, record: read.record };
}

const SUCCESSOR_BASE = "rondo/base/rondo-i-0002";

test("a lap that changed a path outside its claim that has since landed takes the default branch in", async () => {
  const fixture = repository();
  const landed = fixture.land("shared.txt");
  const { store, record } = await atGate(fixture);

  const decided = await revisionTakeIn(record, "i-0002", store, null);

  expect(decided).toEqual({
    takeIn: {
      commit: landed,
      branch: SUCCESSOR_BASE,
      remoteBranch: "main",
      paths: ["shared.txt"],
      cause: "landed",
    },
  });
  expect(git(fixture.repo, "rev-parse", SUCCESSOR_BASE)).toBe(landed);
});

test("a landing on paths the lap did not touch asks nothing of it (D-0098 rule 2.4)", async () => {
  const fixture = repository();
  fixture.land("other.txt");
  const { store, record } = await atGate(fixture);

  expect(await revisionTakeIn(record, "i-0002", store, null)).toEqual({ takeIn: null });
});

test("rondo#417: a conflict fetches the default branch as the forge has it now, and names no paths", async () => {
  const fixture = repository();
  const head = fixture.land("other.txt");
  const { store, record } = await atGate(fixture);

  expect(await revisionTakeIn(record, "i-0002", store, "conflict")).toEqual({
    takeIn: {
      commit: head,
      branch: SUCCESSOR_BASE,
      remoteBranch: "main",
      paths: [],
      cause: "conflict",
    },
  });
});

test("a take-in the predecessor did not pass is carried as it was, and nothing is fetched", async () => {
  const fixture = repository();
  const head = fixture.land("shared.txt");
  const unpassed: TakeIn = {
    commit: head,
    branch: "rondo/base/rondo-i-0000",
    remoteBranch: "main",
    paths: [],
    cause: "conflict",
  };
  // The lap's tip does not hold `head`: it was never merged in.
  git(fixture.repo, "fetch", "origin", "main");
  const { store, record } = await atGate(fixture, unpassed);

  expect(await revisionTakeIn(record, "i-0002", store, null)).toEqual({ takeIn: unpassed });
  expect(() => git(fixture.repo, "rev-parse", "--verify", SUCCESSOR_BASE)).toThrow();
});

test("a fetch that fails refuses the revision before any gate", async () => {
  const fixture = repository();
  const { store, record } = await atGate(fixture);
  git(fixture.repo, "remote", "remove", "origin");

  const decided = await revisionTakeIn(record, "i-0002", store, "conflict");

  expect("refusal" in decided && decided.refusal).toContain("could not fetch it");
});
