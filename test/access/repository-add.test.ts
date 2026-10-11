/**
 * A request naming a repository rondo does not work in, and that repository
 * added from the page (rondo#383, D-0090): which repository a request's work
 * runs in, what rondo infers for the one it adds, and what the press records.
 *
 * The store is real for the same reason `model-draft/host.test.ts`'s is: which
 * plans a request is offered is a claim about rows. The clone is replaced by
 * the port; `gh` and the network are not CI's.
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { drafterHost } from "../../src/access/drafter-host.js";
import {
  type CommandOutcome,
  type RepositoryClone,
  sameForgeRepository,
} from "../../src/access/forge.js";
import { workRepository } from "../../src/access/issue-read.js";
import { heldPlans, requestRepository } from "../../src/access/model-draft/host.js";
import { REPOSITORY_PROPOSAL_AUTHOR } from "../../src/access/model-draft/judgement.js";
import { addRepositoryFromPage, recordSetupPlansFromPage } from "../../src/access/page-actions.js";
import { projectNameOf, repositoryParts } from "../../src/access/repository-add.js";
import { allowedCommandsFor, COMMON_BASH } from "../../src/cadenza/facade.js";
import { readRunPlan } from "../../src/refrain/plan.js";
import { planDigest } from "../../src/store/plan.js";
import type { JsonRecord } from "../../src/store/records.js";
import { agentTypeDigestOf, planDocument, world } from "./fixtures/drafter.js";

/** The added plan's catalog project's `allowed_bash` (D-0094). */
function catalogAllowedBash(plan: JsonRecord): unknown {
  const layers = plan["catalog_layers"] as { data: { project: Record<string, JsonRecord> } }[];
  return layers[0]?.data.project[String(plan["project_name"])]?.["allowed_bash"];
}

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
  // Sentence punctuation is not part of an address, and `.git` names the same one.
  for (const said of [
    "Fix owner/a#1 in https://github.com/owner/b.",
    "Fix owner/a#1 in https://github.com/owner/b/, please",
    "owner/a#1 を https://github.com/owner/b.git で直して",
  ]) {
    expect(work(said, ["owner/a", "owner/b"]), said).toEqual({ kind: "held", repos: ["owner/b"] });
  }
  expect(work("Fix owner/a#1 in https://github.com/vercel/next.js", ["owner/a"])).toEqual({
    kind: "unheld",
    repo: "vercel/next.js",
    named: "vercel/next.js",
  });
  // A reply corrects the place: the newest message naming one decides.
  expect(workRepository(["Do owner/typo#12.", "Sorry, I meant owner/a#12."], ["owner/a"])).toEqual({
    kind: "held",
    repos: ["owner/a"],
  });
  expect(workRepository(["Do owner/a#12.", "Keep it short."], ["owner/a"])).toEqual({
    kind: "held",
    repos: ["owner/a"],
  });
  // An issue on another forge host names no place: cloning by OWNER/NAME would
  // find github.com's repository of that name, not the one linked.
  expect(work("Do https://github.example.com/owner/p/issues/12", ["owner/a"])).toEqual({
    kind: "open",
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

test("a clone already on disk is used only when its origin is the repository asked for", () => {
  for (const url of [
    "https://github.com/owner/other.git",
    "https://github.com/Owner/Other",
    "git@github.com:owner/other.git",
    "ssh://git@github.com/owner/other.git",
  ]) {
    expect(sameForgeRepository(url, "owner/other"), url).toBe(true);
  }
  for (const url of [
    "https://github.com/owner/else.git",
    "",
    "/srv/other",
    // The same two names elsewhere are not the repository asked for.
    "https://other.example/owner/other.git",
    "/srv/owner/other",
    "git@other.example:owner/other.git",
  ]) {
    expect(sameForgeRepository(url, "owner/other"), url).toBe(false);
  }
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
  // The one list the worker may run lives on the catalog project (D-0094),
  // computed by cadenza over the clone's top-level files (cadenza D-0040).
  expect(plan).not.toHaveProperty("allowed_bash");
  expect(catalogAllowedBash(plan)).toEqual(allowedCommandsFor(["go.mod", "go.sum", "README.md"]));
  expect(catalogAllowedBash(plan)).toContain("go test:*");
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
  expect(catalogAllowedBash((await w.record.setupPlans())[1]?.plan ?? {})).toEqual(COMMON_BASH);
  const ports = { store: w.store, record: w.record, now: () => 5_000 };
  expect(await requestRepository(ports, "r1")).toEqual({
    work: { kind: "held", repos: ["owner/docs"] },
    unbuilt: ["owner/docs"],
    proposed: false,
    planless: false,
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

test("work in a repository no plan is for: the drafter proposes it, the press adds it, and the request is drafted there (D-0191 rule 3)", async () => {
  const w = await world();
  await w.record.recordSetupPlan({
    setupId: "setup-1",
    plan: setupDocument("owner/a"),
    recordedBy: "ada",
    recordedAtMs: 500,
  });
  await w.say("r1", "Fix the typo on the docs site.", null, 1_000);
  const ports = { store: w.store, record: w.record, now: () => 5_000 };
  const awaits = async (id: string) => {
    const where = await requestRepository(ports, id);
    return where.work.kind === "unheld" || where.planless;
  };
  const handed: string[] = [];
  let n = 0;
  const host = drafterHost({
    store: w.store,
    record: w.record,
    now: () => 10_000,
    language: null,
    log: () => undefined,
    mintId: (kind) => {
      n += 1;
      return `${kind}-${String(n)}`;
    },
    awaitsRepository: awaits,
    runDrafter: async (_row, document) => {
      handed.push(document);
      if (handed.length === 1) {
        return {
          kind: "answered",
          costUsd: 0.01,
          finalMessage: JSON.stringify({
            act: "repository",
            summary: { text: "The docs site is owner/site.", bases: ["r1"] },
            repository: "owner/site",
          }),
        };
      }
      const added = (await w.record.setupPlans())[1]?.plan ?? {};
      return {
        kind: "answered",
        costUsd: 0.02,
        finalMessage: JSON.stringify({
          act: "split",
          summary: { text: "One plan: fix the typo.", bases: ["r1"] },
          plans: [
            {
              template_plan_digest: planDigest(added),
              agent_type_digest: agentTypeDigestOf(added),
              prompt: "Fix the typo.",
              bases: ["r1"],
              claim: ["/"],
            },
          ],
        }),
      };
    },
  });

  host.kick();
  await host.idle();
  expect(handed).toHaveLength(1);
  // The model wrote no fact of this machine: only the name, in rondo's proposal.
  const read = await w.record.threadMessages();
  if (read.kind !== "read") throw new Error(read.reason);
  const proposal = read.messages.find((m) => m.authorId === REPOSITORY_PROPOSAL_AUTHOR);
  expect(proposal?.body).toBe("The docs site is owner/site.\n\nhttps://github.com/owner/site");
  expect(await requestRepository(ports, "r1")).toMatchObject({
    work: { kind: "unheld", repo: "owner/site" },
    proposed: true,
    planless: false,
  });
  // Waiting for the person's press: nothing more is drafted or paid for.
  host.kick();
  await host.idle();
  expect(handed).toHaveLength(1);

  // The press: setup's plan with owner/site's own facts, assembled by rondo.
  expect(
    await addRepositoryFromPage(
      ENV,
      w,
      "ada",
      { requestMessageId: "r1", repo: "owner/site" },
      cloned("README.md\n"),
    ),
  ).toEqual({ ok: true });
  host.kick();
  await host.idle();
  expect(handed).toHaveLength(2);
  const after = await w.record.threadMessages();
  if (after.kind !== "read") throw new Error(after.reason);
  // Drafted over the added repository's plan: a split, with its summary.
  expect(after.messages.at(-1)?.body).toBe("One plan: fix the typo.");
  expect(after.messages.at(-1)?.bases).toContainEqual(
    expect.objectContaining({ form: "proposal" }),
  );
  expect((await requestRepository(ports, "r1")).work).toEqual({
    kind: "held",
    repos: ["owner/site"],
  });
});

test("a reply after rondo's proposal ends it: the request is drafted again over the reply (D-0191 rule 3.4)", async () => {
  const w = await world();
  await w.record.recordSetupPlan({
    setupId: "setup-1",
    plan: setupDocument("owner/a"),
    recordedBy: "ada",
    recordedAtMs: 500,
  });
  await w.say("r1", "Fix the typo on the docs site.", null, 1_000);
  await w.record.recordThreadMessage({
    messageId: "p1",
    body: "The docs site is owner/site.\n\nhttps://github.com/owner/site",
    authorKind: "drafter",
    authorId: REPOSITORY_PROPOSAL_AUTHOR,
    inReplyTo: "r1",
    atMs: 2_000,
    bases: [{ form: "message", messageId: "r1" }],
    asks: false,
  });
  const ports = { store: w.store, record: w.record, now: () => 5_000 };
  expect((await requestRepository(ports, "r1")).proposed).toBe(true);
  await w.say("r2", "No, it is in this repository.", "r1", 3_000);
  expect(await requestRepository(ports, "r1")).toMatchObject({
    work: { kind: "open" },
    proposed: false,
  });
});

test("a store with no plan records the one setup left beside it, on one press, and only then (D-0191 rule 2)", async () => {
  const w = await world();
  await w.say("r1", "Fix the flaky test.", null, 1_000);
  const ports = { store: w.store, record: w.record, now: () => 5_000 };
  expect((await requestRepository(ports, "r1")).planless).toBe(true);

  const directory = mkdtempSync(join(tmpdir(), "rondo-setup-files-"));
  const storePath = join(directory, "rondo-iterations.sqlite3");
  // Nothing beside the store: setup has not run, and the press records nothing.
  expect(await recordSetupPlansFromPage(ENV, w, "ada", storePath, "r1")).toMatchObject({
    ok: false,
    why: "addRepositoryRefusedNoSetup",
  });
  writeFileSync(join(directory, "plan-owner-a.json"), JSON.stringify(setupDocument("owner/a")));
  // Not setup's name, and not a plan: neither is offered.
  writeFileSync(join(directory, "notes.json"), JSON.stringify(setupDocument("owner/b")));
  writeFileSync(join(directory, "plan-broken.json"), "{");
  expect(await recordSetupPlansFromPage(ENV, w, "ada", storePath, "r1")).toEqual({ ok: true });
  const rows = await w.record.setupPlans();
  expect(rows.map((r) => r.plan["forge_repository"])).toEqual(["owner/a"]);
  expect(rows[0]?.recordedBy).toBe("ada");
  expect((await requestRepository(ports, "r1")).planless).toBe(false);
  // A stale page records nothing twice.
  expect(await recordSetupPlansFromPage(ENV, w, "ada", storePath, "r1")).toMatchObject({
    ok: false,
    why: "addRepositoryRefusedChanged",
  });
});
