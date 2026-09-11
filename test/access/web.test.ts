/**
 * The read-only page, over a real store.
 *
 * Against `node:sqlite` rather than a stub for `between.test.ts`'s reason: the
 * one property worth asserting here is that a surface which draws itself every
 * few seconds writes **nothing** -- and "no row was written" is a claim about a
 * database rather than about a mock's call log. The other two are what the
 * terminal got wrong and this page must not (rondo#90's paragraphs, rondo#91's
 * repeated basis), and both are properties of the bytes that reach a browser.
 */
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import { operatorPage, serveOperatorPage, type WebPorts } from "../../src/access/web.js";
import { allocate } from "../../src/refrain/allocator.js";
import { admittedPlan, planPayload, type RunPlan, runPlan } from "../../src/refrain/plan.js";
import type { JsonRecord } from "../../src/store/records.js";
import { advisoryRecord, iterationStore } from "../../src/store/sqlite.js";

const PLAN: RunPlan = {
  db: "/srv/continuo.db",
  workspaceRoot: "/srv/work",
  baseBranch: "main",
  prompt: "do the thing",
  allowedBash: ["npm run:*"],
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

function planFor(id: string): JsonRecord {
  const validated = runPlan(PLAN);
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

const fresh = () => {
  const connection = new DatabaseSync(":memory:");
  return {
    connection,
    store: iterationStore(connection, { maxOccupying: 4, maxLive: 6 }),
    record: advisoryRecord(connection),
  };
};

function portsOver(world: ReturnType<typeof fresh>, actorId: string | null = "ada"): WebPorts {
  return {
    store: world.store,
    record: world.record,
    now: () => 5_000,
    policy: { maxOccupying: 4, maxLive: 6 },
    actorId,
  };
}

async function reserve(
  world: ReturnType<typeof fresh>,
  id: string,
  request: string,
): Promise<void> {
  const outcome = await world.store.reserve({
    id,
    request,
    plan: planFor(id),
    nowMs: 1_000,
    supersedesIterationId: null,
    runId: `rondo-${id}`,
    topicBranch: `rondo/${id}`,
    workspace: `/srv/work/${id}`,
  });
  if (outcome.kind !== "reserved") {
    throw new Error(`the fixture did not reserve: ${JSON.stringify(outcome)}`);
  }
}

const rows = (connection: DatabaseSync, table: string): number =>
  Number((connection.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n);

test("the page shows what inbox, between and explain show", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");

  const html = await operatorPage(portsOver(world));

  expect(html).toContain("inbox for 'ada'");
  expect(html).toContain("what spans the live laps");
  expect(html).toContain("iteration 'i-0001'");
  expect(html).toContain("do the thing");
  // The page says out loud what it is, because a screen that looks like the
  // operator surface and answers nothing is worse than one that says so.
  expect(html).toContain("Read-only");
  expect(html).toContain('http-equiv="refresh"');
});

test("looking at the page writes nothing", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");

  // Three draws, which is what a page that refreshes itself does while nobody
  // is at the desk. Each of them would have been a presentation counted and a
  // last-look mark moved if this surface had the command line's ports.
  for (let draw = 0; draw < 3; draw += 1) {
    await operatorPage(portsOver(world));
  }

  expect(rows(world.connection, "proposal")).toBe(0);
  expect(rows(world.connection, "operator_attention")).toBe(0);
  expect(rows(world.connection, "operator_view")).toBe(0);
  expect(rows(world.connection, "human_decision")).toBe(0);
});

test("an empty store renders a page rather than an error", async () => {
  const html = await operatorPage(portsOver(fresh(), null));

  expect(html).toContain("what spans the live laps");
  // No approver, no inbox -- and the page says which, rather than drawing
  // somebody else's or showing an empty one as though it were theirs.
  expect(html).toContain("RONDO_APPROVER is not set");
});

test("a request keeps its paragraphs and its markup is text (rondo#90)", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "first line\n\nsecond <b>paragraph</b>");

  const html = await operatorPage(portsOver(world));

  // The newline survives as a newline: the terminal escapes it to a `\u` form
  // (D-0004) because a cp932 console may not encode it, and a browser has no
  // such problem. `white-space: pre-wrap` is what renders it.
  expect(html).toContain("first line\n\nsecond");
  expect(html).not.toContain("\\u000a");
  expect(html).toContain("&lt;b&gt;paragraph&lt;/b&gt;");
  expect(html).not.toContain("<b>paragraph</b>");
});

test("one basis is written once above the claims that rest on it (rondo#91)", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");

  const html = await operatorPage(portsOver(world));
  const bases = [...html.matchAll(/<p class="basis">([^<]*)<\/p>/g)].map((match) => match[1]);

  // Every group's basis differs from the one before it, which is what makes the
  // repetition impossible rather than merely absent from this fixture.
  expect(bases.length).toBeGreaterThan(0);
  for (const [at, basis] of bases.entries()) {
    if (at > 0) {
      expect(basis).not.toBe(bases[at - 1]);
    }
  }
});

test("it serves the page on localhost, and only the one page", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");

  let announced = "";
  const stop = new AbortController();
  const served = serveOperatorPage(
    portsOver(world),
    0,
    (line) => {
      announced = line;
    },
    () => {
      throw new Error("the server refused to listen");
    },
    stop.signal,
  );
  // `listen` is asynchronous; the announcement is what says the socket is up.
  while (announced === "") {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  const base = /(http:\/\/127\.0\.0\.1:\d+)\//.exec(announced)?.[1] ?? "";
  expect(base).not.toBe("");

  const page = await fetch(`${base}/`);
  expect(page.status).toBe(200);
  expect(page.headers.get("content-type")).toBe("text/html; charset=utf-8");
  expect(await page.text()).toContain("what spans the live laps");

  // One page and no router: a typo'd path says so rather than quietly showing
  // the only page there is.
  expect((await fetch(`${base}/inbox`)).status).toBe(404);
  // Read-only reaches the method too: nothing here answers a POST.
  expect((await fetch(`${base}/`, { method: "POST" })).status).toBe(405);

  stop.abort();
  expect(await served).toBe(0);
});
