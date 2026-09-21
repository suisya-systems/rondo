/**
 * A request naming a repository rondo does not work in, and that repository
 * added from the page (rondo#383, D-0090): which repository a request's work
 * runs in, what rondo infers for the one it adds, and what the press records.
 *
 * The store is real for the same reason `model-draft/host.test.ts`'s is: which
 * plans a request is offered is a claim about rows. The clone is replaced by
 * the port; `gh` and the network are not CI's.
 */
import { expect, test } from "vitest";

import { addRepositoryFromPage } from "../../src/access/cli.js";
import type { CommandOutcome, RepositoryClone } from "../../src/access/forge.js";
import { workRepository } from "../../src/access/issue-read.js";
import { heldPlans, requestRepository } from "../../src/access/model-draft/host.js";
import {
  allowedBashFor,
  COMMON_BASH,
  projectNameOf,
  repositoryParts,
  toolchainsOf,
} from "../../src/access/repository-add.js";
import { readRunPlan } from "../../src/refrain/plan.js";
import type { JsonRecord } from "../../src/store/records.js";
import { planDocument, world } from "./fixtures/drafter.js";

test("the repository a request's work runs in: the named issue's, or the place the person named", () => {
  const work = (body: string, held: (string | null)[]) => workRepository([body], held);
  expect(work("Fix the flaky test.", ["owner/a"])).toEqual({ kind: "open" });
  // A bare number keeps its rule (D-0081 rule 3.4).
  expect(work("Fix #5.", ["owner/a"])).toEqual({ kind: "open" });
  expect(work("Do owner/a#12.", ["owner/a", "owner/b"])).toEqual({
    kind: "held",
    repos: ["owner/a"],
  });
  // Case is not the forge's distinction; the plan's own spelling is kept.
  expect(work("Do owner/a#12.", ["Owner/A"])).toEqual({ kind: "held", repos: ["Owner/A"] });
  expect(work("Do https://github.com/owner/a/issues/12", ["owner/a"])).toEqual({
    kind: "held",
    repos: ["owner/a"],
  });
  // The mismatch rondo#383 is about: an issue elsewhere is not rondo's work.
  expect(work("Do owner/other#12.", ["owner/a"])).toEqual({
    kind: "unheld",
    repo: "owner/other",
    named: "owner/other#12",
  });
  // The person named where the work runs (D-0090 rule 3).
  expect(work("owner/a#12 の件を owner/b で直して", ["owner/b"])).toEqual({
    kind: "held",
    repos: ["owner/b"],
  });
  expect(work("owner/a#12 の件を owner/b で直して", ["owner/a"])).toEqual({
    kind: "unheld",
    repo: "owner/b",
    named: "owner/b",
  });
  // Under another owner too: never drafted silently in the issue's repository.
  expect(work("Fix owner/a#12 in other/b", ["owner/a"])).toEqual({
    kind: "unheld",
    repo: "other/b",
    named: "other/b",
  });
  // A place under a held repository's owner needs no issue beside it.
  expect(work("Make the same change in owner/b", ["owner/a", "owner/b"])).toEqual({
    kind: "held",
    repos: ["owner/b"],
  });
  // A pasted plan's own forge repository is not the person naming a place.
  expect(
    workRepository(
      ["Do owner/other#12.", JSON.stringify({ forge_repository: "owner/a" })],
      ["owner/a"],
    ),
  ).toEqual({ kind: "unheld", repo: "owner/other", named: "owner/other#12" });
  expect(work("Fix owner/a#3 in https://github.com/elsewhere/tool", ["owner/a"])).toEqual({
    kind: "unheld",
    repo: "elsewhere/tool",
    named: "elsewhere/tool",
  });
  // A path is not a place.
  expect(work("owner/a#1: see src/access and docs/README.md", ["owner/a"])).toEqual({
    kind: "held",
    repos: ["owner/a"],
  });
  // A plan naming no forge repository could be the one named: nothing is claimed.
  expect(work("Do owner/other#12.", ["owner/a", null])).toEqual({ kind: "open" });
  // Nothing held is setup's own sentence, not an offer.
  expect(work("Do owner/other#12.", [])).toEqual({ kind: "open" });
});

test("the worker's commands are read off the repository's own files, for TypeScript, Go, Python and Rust", () => {
  expect(toolchainsOf(["package.json", "package-lock.json"])).toEqual(["npm"]);
  expect(toolchainsOf(["package.json"])).toEqual(["npm"]);
  expect(toolchainsOf(["package.json", "pnpm-lock.yaml"])).toEqual(["pnpm"]);
  expect(toolchainsOf(["package.json", "yarn.lock"])).toEqual(["yarn"]);
  expect(toolchainsOf(["package.json", "bun.lockb"])).toEqual(["bun"]);
  expect(toolchainsOf(["go.mod", "go.sum"])).toEqual(["go"]);
  expect(toolchainsOf(["pyproject.toml", "uv.lock"])).toEqual(["uv"]);
  expect(toolchainsOf(["pyproject.toml", "poetry.lock"])).toEqual(["poetry"]);
  expect(toolchainsOf(["requirements-dev.txt"])).toEqual(["pip"]);
  expect(toolchainsOf(["Cargo.toml", "Cargo.lock"])).toEqual(["cargo"]);
  expect(toolchainsOf(["Cargo.toml", "package.json", "pnpm-lock.yaml"])).toEqual(["pnpm", "cargo"]);
  expect(toolchainsOf(["README.md", "Makefile"])).toEqual([]);

  expect(allowedBashFor([])).toEqual(COMMON_BASH);
  const both = allowedBashFor(["go", "cargo"]);
  expect(both).toEqual(expect.arrayContaining([...COMMON_BASH, "go test:*", "cargo test:*"]));
  expect(new Set(both).size).toBe(both.length);
  expect(allowedBashFor(["npm"])).toContain("npm ci --ignore-scripts");
});

test("a repository's name is only ever a directory under setup's root, and a project cadenza accepts", () => {
  expect(repositoryParts("owner/name")).toEqual({ owner: "owner", name: "name" });
  for (const bad of ["../name", "owner/..", "a/b/c", "owner", "owner/na me"]) {
    expect(repositoryParts(bad), bad).toBeNull();
  }
  expect(projectNameOf("123org", "My.App")).toBe("repo-123org-my-app");
  expect(projectNameOf("owner", "x".repeat(80))).toHaveLength(64);
});

/** Setup's plan as `rondo setup-plan` records it, for `forge` repository `repo`. */
function setupDocument(repo: string | null, repository = "/srv/repo"): JsonRecord {
  const {
    run_id: _runId,
    lease_claimant_id: _claimant,
    workspace: _workspace,
    topic_branch: _branch,
    ...plan
  } = planDocument();
  return {
    ...plan,
    parties: { ...(plan["parties"] as JsonRecord), grantee: "rondo-allocates-this" },
    prompt: "a placeholder",
    repository,
    forge_repository: repo,
  };
}

const ENV = { RONDO_APPROVER: "ada" };

function ran(
  stdout: string,
  status: number | null = 0,
  stderr = "",
  spawnError: string | null = null,
) {
  return {
    commandLine: "gh repo clone",
    status,
    signal: null,
    stdout,
    stderr,
    spawnError,
  } satisfies CommandOutcome;
}

const cloned =
  (files: string, branch = "main") =>
  async (): Promise<RepositoryClone> =>
    await Promise.resolve({ clone: ran(""), branch: ran(`${branch}\n`), files: ran(files) });

test("an added repository is setup's plan with the repository's own facts, and the request is then drafted there", async () => {
  const w = await world();
  await w.record.recordSetupPlan({
    setupId: "setup-1",
    plan: setupDocument("owner/a"),
    recordedBy: "ada",
    recordedAtMs: 500,
  });
  await w.say("r1", "Do owner/other#12.", null, 1_000);
  const ports = { store: w.store, record: w.record, now: () => 5_000 };
  expect((await requestRepository(ports, "r1")).work).toEqual({
    kind: "unheld",
    repo: "owner/other",
    named: "owner/other#12",
  });

  const asked: [string, string][] = [];
  const added = await addRepositoryFromPage(
    ENV,
    w,
    "ada",
    { requestMessageId: "r1", repo: "owner/other" },
    async (repo, into) => {
      asked.push([repo, into]);
      return await cloned("go.mod\ngo.sum\nREADME.md\n", "trunk")();
    },
  );
  expect(added).toEqual({ ok: true });
  const root = String(setupDocument(null)["workspace_root"]).replace(/[/\\][^/\\]+$/, "");
  const into = `${root}/repositories/owner/other`;
  expect(asked).toEqual([["owner/other", into]]);

  const rows = await w.record.setupPlans();
  expect(rows).toHaveLength(2);
  const plan = rows[1]?.plan ?? {};
  expect(readRunPlan(plan).kind).toBe("planned");
  expect(rows[1]?.recordedBy).toBe("ada");
  expect(plan["repository"]).toBe(into);
  expect(plan["base_branch"]).toBe("trunk");
  expect(plan["forge_repository"]).toBe("owner/other");
  expect(plan["project_name"]).toBe("owner-other");
  expect(plan["allowed_bash"]).toEqual(allowedBashFor(["go"]));
  // What is the host's and not the repository's is setup's, untouched.
  for (const key of ["db", "workspace_root", "claude_command", "agent_type_input", "node"]) {
    expect(plan[key], key).toEqual(setupDocument(null)[key]);
  }

  // The request is now drafted on the added repository's plan, and only it.
  expect((await requestRepository(ports, "r1")).work).toEqual({
    kind: "held",
    repos: ["owner/other"],
  });
  expect((await heldPlans(ports, "r1")).map((p) => p.forgeRepository)).toEqual(["owner/other"]);
  // A request naming nothing is offered both, as before.
  await w.say("r2", "Fix the flaky test.", null, 2_000);
  expect((await heldPlans(ports, "r2")).map((p) => p.forgeRepository).sort()).toEqual([
    "owner/a",
    "owner/other",
  ]);
});

test("a repository whose build rondo cannot tell is added with the common commands, and the page is told", async () => {
  const w = await world();
  await w.record.recordSetupPlan({
    setupId: "setup-1",
    plan: setupDocument("owner/a"),
    recordedBy: "ada",
    recordedAtMs: 500,
  });
  await w.say("r1", "Do owner/docs#1.", null, 1_000);
  const added = await addRepositoryFromPage(
    ENV,
    w,
    "ada",
    { requestMessageId: "r1", repo: "owner/docs" },
    cloned("README.md\nMakefile\n"),
  );
  expect(added).toEqual({ ok: true });
  expect((await w.record.setupPlans())[1]?.plan["allowed_bash"]).toEqual(COMMON_BASH);
  const ports = { store: w.store, record: w.record, now: () => 5_000 };
  expect(await requestRepository(ports, "r1")).toEqual({
    work: { kind: "held", repos: ["owner/docs"] },
    unbuilt: ["owner/docs"],
  });
});

test("a clone that fails records nothing and says which of three things went wrong; no setup is its own refusal", async () => {
  const w = await world();
  const input = { requestMessageId: "r1", repo: "owner/other" };
  await w.say("r1", "Do owner/other#12.", null, 1_000);
  // Nothing held: the request names no repository to add, whatever the form says.
  expect(await addRepositoryFromPage(ENV, w, "ada", input, cloned("go.mod\n"))).toMatchObject({
    ok: false,
    why: "addRepositoryRefusedChanged",
  });
  // A plan pasted into the thread is held, but setup gave no root to clone under.
  await w.say("r1-plan", JSON.stringify(setupDocument("owner/a")), "r1", 1_500);
  expect(await addRepositoryFromPage(ENV, w, "ada", input, cloned("go.mod\n"))).toMatchObject({
    ok: false,
    why: "addRepositoryRefusedNoSetup",
  });

  await w.record.recordSetupPlan({
    setupId: "setup-1",
    plan: setupDocument("owner/a"),
    recordedBy: "ada",
    recordedAtMs: 500,
  });
  const failing = (outcome: CommandOutcome) => async (): Promise<RepositoryClone> =>
    await Promise.resolve({ clone: outcome, branch: null, files: null });
  for (const [outcome, why] of [
    [ran("", null, "", "spawn gh ENOENT"), "addRepositoryRefusedInstall"],
    [
      ran("", 4, "To get started with GitHub CLI, please run:  gh auth login"),
      "addRepositoryRefusedInstall",
    ],
    [
      ran("", 1, "GraphQL: Could not resolve to a Repository with the name 'owner/other'."),
      "addRepositoryRefusedUnseen",
    ],
    [ran("", 128, "fatal: unable to access: Could not resolve host"), "addRepositoryRefusedFailed"],
  ] as const) {
    const answered = await addRepositoryFromPage(ENV, w, "ada", input, failing(outcome));
    expect(answered, outcome.stderr).toMatchObject({ ok: false, why });
  }
  // Only the repository the request names: not another, and not a path.
  for (const repo of ["owner/else", "../escape"]) {
    expect(
      await addRepositoryFromPage(ENV, w, "ada", { ...input, repo }, cloned("go.mod\n")),
      repo,
    ).toMatchObject({ ok: false, why: "addRepositoryRefusedChanged" });
  }
  expect(
    await addRepositoryFromPage(
      ENV,
      w,
      "ada",
      { requestMessageId: "no-such-request", repo: "owner/other" },
      cloned("go.mod\n"),
    ),
  ).toMatchObject({ ok: false, why: "addRepositoryRefusedChanged" });
  // Not the approver: nothing is recorded as anyone else.
  expect(await addRepositoryFromPage(ENV, w, "mallory", input, cloned("go.mod\n"))).toMatchObject({
    ok: false,
  });
  expect(await w.record.setupPlans()).toHaveLength(1);
});
