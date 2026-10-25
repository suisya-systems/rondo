/**
 * Naming the repository a lap's pull request goes to, from the publish screen
 * (rondo#676, D-0202): the box, the press, and what a later publish reads.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { recordedRepository } from "../../src/access/forge-preflight.js";
import type { PublishShown } from "../../src/access/page/contract.js";
import { PublishRepositoryPort } from "../../src/access/publish-repository.js";
import { chromeFor } from "../../src/access/wording.js";
import type { JsonRecord } from "../../src/store/records.js";
import type { IterationStore } from "../../src/store/sqlite.js";
import { planDocument } from "./fixtures/drafter.js";
import { fresh, get, PLAN, portsOver, post, reserve, serving, tokenIn } from "./page-world.js";

const EN = chromeFor("en");
const ASKED = { repo: null, remote: "origin", allowRemoteMismatch: false };

/** A workspace on branch `topic` whose origin is `url`. */
function workspace(url: string): string {
  const repo = mkdtempSync(join(tmpdir(), "rondo-publish-repo-"));
  const git = (...args: string[]) => execFileSync("git", ["-C", repo, ...args]);
  git("init", "--quiet", "--initial-branch=topic");
  git(
    "-c",
    "user.email=t@example.com",
    "-c",
    "user.name=t",
    "commit",
    "--quiet",
    "--allow-empty",
    "-m",
    "base",
  );
  git("remote", "add", "origin", url);
  return repo;
}

/** The world's store, with the lap's plan pushing from `repo`. */
function storeAt(store: IterationStore, repo: string): IterationStore {
  return new Proxy(store, {
    get(target, key) {
      if (key === "read") {
        return async (id: string) => {
          const found = await target.read(id);
          return found.kind !== "read"
            ? found
            : {
                ...found,
                record: {
                  ...found.record,
                  plan: { ...found.record.plan, workspace: repo, topic_branch: "topic" },
                },
              };
        };
      }
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

/** Setup's plan for the fixture's repository, naming no forge repository. */
function setupDocument(): JsonRecord {
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
    repository: PLAN.repository,
    forge_repository: null,
  };
}

const noRepo = async (): Promise<PublishShown> => ({ kind: "refused", block: { why: "noRepo" } });

test("the person names the repository; rondo checks it against the push and keeps it for the repository", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "add a retry budget");
  const repo = workspace("git@github.com:acme/widget.git");
  const store = storeAt(world.store, repo);
  const port = new PublishRepositoryPort(
    store,
    world.record,
    "ada",
    { RONDO_APPROVER: "ada" },
    ASKED,
  );
  const { base, stop, served } = await serving({
    ...portsOver(world, "ada", [], null, null, noRepo),
    store,
    publishRepository: port,
  });
  const say = (body: string) => body.replaceAll("&#39;", "'");

  const page = (await get(base, "/?publish=i-0001&lang=en")).body;
  expect(say(page)).toContain(EN.publishNoRepo);
  expect(page).toContain('action="/publish-repository?lang=en"');
  expect(page).not.toContain("maintains rondo");
  const token = tokenIn(page);
  const press = (repository: string, headers: Record<string, string | undefined> = {}) =>
    post(base, { token, iteration: "i-0001", repository }, headers, "/publish-repository");

  expect((await press("acme/widget", { "sec-fetch-user": undefined })).status).toBe(403);
  const shape = await press("widget");
  expect(shape.status).toBe(400);
  expect(say(shape.body)).toContain(EN.publishRepoRefusedShape);
  // No setup plan for the repository yet: nowhere to keep it.
  const unset = await press("acme/widget");
  expect(unset.status).toBe(409);
  expect(say(unset.body)).toContain(EN.publishRepoRefusedNoPlan);

  await world.record.recordSetupPlan({
    setupId: "setup-1",
    plan: setupDocument(),
    recordedBy: "ada",
    recordedAtMs: 500,
  });
  // A name that is not where the workspace pushes is not kept.
  const elsewhere = await press("acme/other");
  expect(elsewhere.status).toBe(409);
  expect(say(elsewhere.body)).toContain(EN.publishRepoRefusedMismatch);
  expect(await recordedRepository(world.record, PLAN.repository)).toBeNull();

  const pressed = await press(" acme/widget ");
  expect(pressed.status).toBe(303);
  expect(pressed.location).toBe("/?publish=i-0001&lang=en");
  expect(await recordedRepository(world.record, PLAN.repository)).toBe("acme/widget");
  // Named once, a stale screen names nothing over it.
  const again = await press("acme/widget");
  expect(again.status).toBe(409);
  expect(say(again.body)).toContain(EN.publishRepoRefusedChanged);
  stop.abort();
  expect(await served).toBe(0);
});

test("a host that allows a remote mismatch still keeps only where the push goes, and two presses keep one name", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "add a retry budget");
  await world.record.recordSetupPlan({
    setupId: "setup-1",
    plan: setupDocument(),
    recordedBy: "ada",
    recordedAtMs: 500,
  });
  const store = storeAt(world.store, workspace("https://github.com/acme/widget.git"));
  const port = new PublishRepositoryPort(
    store,
    world.record,
    "ada",
    { RONDO_APPROVER: "ada" },
    { ...ASKED, allowRemoteMismatch: true },
  );
  const { base, stop, served } = await serving({
    ...portsOver(world, "ada", [], null, null, noRepo),
    store,
    publishRepository: port,
  });
  const token = tokenIn((await get(base, "/?publish=i-0001&lang=en")).body);
  const press = (repository: string) =>
    post(base, { token, iteration: "i-0001", repository }, {}, "/publish-repository");

  expect((await press("upstream/widget")).status).toBe(409);
  const both = await Promise.all([press("acme/widget"), press("acme/widget")]);
  expect(both.map((one) => one.status).sort()).toEqual([303, 409]);
  expect((await world.record.setupPlans()).length).toBe(2);
  stop.abort();
  expect(await served).toBe(0);
});

test("with nobody named as approver there is no box and no press", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "add a retry budget");
  const { base, stop, served } = await serving({
    ...portsOver(world, null, [], null, null, noRepo),
    publishRepository: null,
  });
  const page = (await get(base, "/?publish=i-0001&lang=en")).body;
  expect(page).not.toContain('action="/publish-repository');
  const pressed = await post(
    base,
    { token: "t", iteration: "i-0001", repository: "acme/widget" },
    {},
    "/publish-repository",
  );
  expect(pressed.status).toBe(403);
  stop.abort();
  expect(await served).toBe(0);
});
