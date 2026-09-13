/**
 * The between-laps verb, end to end over a real store (D-0037 rules 1, 2 and 4).
 *
 * Against a real `node:sqlite` for `advisory.test.ts`'s reason exactly: what is
 * worth asserting here is what crosses the seam, and none of it is visible from
 * either side alone --
 *
 *  - the base branch reaches the claim **through the persisted plan**, which is
 *    the only field rule 1 adds by reading into something the snapshot does not
 *    copy;
 *  - the snapshot the drafter read is the snapshot the row keeps, so every
 *    `/laps/n/...` pointer resolves against the bytes that were stored;
 *  - the proposal is recorded **before** anything is rendered and the
 *    presentation is counted **after**, which is rule 4's order and the one
 *    thing a unit test of the drafter cannot see;
 *  - the occupancies come from the store's own generated columns rather than
 *    from a status set this layer spelled itself (D-0023 rule 8).
 *
 * The drafter's own behaviour -- the three families and their totality -- is
 * `test/advisory/host.test.ts`, which needs no database at all.
 */
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import { composeBetweenLaps, type HostPorts } from "../../src/access/advisory.js";
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

/**
 * The plan as an admitted row holds it, on one base branch.
 *
 * Admitted rather than merely validated, because that is what a live row
 * carries: `admittedPlan` is what writes the grantee and the lease claimant
 * from the allocation, and a plan without them is one the reader refuses --
 * which would make every lap in this file's fixtures read as a lap whose plan
 * will not decode.
 */
function planOn(id: string, baseBranch: string): JsonRecord {
  const validated = runPlan({ ...PLAN, baseBranch });
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

const screen = () => {
  const shown: string[] = [];
  return { shown, present: (lines: readonly string[]) => shown.push(...lines) };
};

/** One live row on a base branch -- or, given a document, on whatever it holds. */
async function reserve(
  store: ReturnType<typeof fresh>["store"],
  id: string,
  plan: string | JsonRecord = "main",
): Promise<void> {
  const outcome = await store.reserve({
    id,
    request: `do ${id}`,
    plan: typeof plan === "string" ? planOn(id, plan) : plan,
    spend: null,
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

function portsOver(
  world: ReturnType<typeof fresh>,
  shows: ReturnType<typeof screen>,
  nowMs = 5_000,
): HostPorts {
  return {
    store: world.store,
    record: world.record,
    now: () => nowMs,
    present: shows.present,
    policy: { maxOccupying: 4, maxLive: 6 },
  };
}

const onlyProposal = (connection: DatabaseSync): Record<string, unknown> => {
  const rows = connection.prepare("SELECT * FROM proposal").all() as Record<string, unknown>[];
  expect(rows.length).toBe(1);
  const row = rows[0];
  if (row === undefined) {
    throw new Error("no proposal row");
  }
  return row;
};

// --- rule 2: the gathering ------------------------------------------------

test("every live lap is gathered, with its triple and the base branch out of its plan", async () => {
  const world = fresh();
  await reserve(world.store, "i-0001");
  await reserve(world.store, "i-0002");
  await reserve(world.store, "i-0003", "release/2");

  const shows = screen();
  expect((await composeBetweenLaps(portsOver(world, shows))).kind).toBe("explained");

  const snapshot = JSON.parse(String(onlyProposal(world.connection)["snapshot"])) as {
    laps: { iteration: { id: string }; runId: string; topicBranch: string; baseBranch: string }[];
  };
  expect(snapshot.laps.map((lap) => lap.iteration.id)).toEqual(["i-0001", "i-0002", "i-0003"]);
  // **The base branch reached the snapshot through the persisted plan**, which
  // is rule 1's one read into something the snapshot does not copy.
  expect(snapshot.laps.map((lap) => lap.baseBranch)).toEqual(["main", "main", "release/2"]);
  // And the `D-0023` triple, which is what turns an adjacency into two working
  // trees a person can open.
  expect(snapshot.laps[0]?.runId).toBe("rondo-i-0001");
  expect(snapshot.laps[0]?.topicBranch).toBe("rondo/i-0001");

  // **The plan itself is not copied** (rule 1): the claim rests on the base
  // branch alone, and a thirty-field plan no claim reads would be paying for
  // re-derivability nothing uses.
  expect(snapshot.laps[0]).not.toHaveProperty("plan");
  expect(snapshot.laps[0]?.iteration).toHaveProperty("planDigest");

  const rendered = shows.shown.join("\n");
  expect(rendered).toContain("open against 'main' beside 'i-0002'");
  expect(rendered).toContain("open against 'main' beside 'i-0001'");
  // The adjacency is not reported as a collision, and the screen says so once
  // rather than in every claim.
  expect(rendered).toContain("an adjacency is not a collision");
});

test("a lap whose persisted plan will not decode is undetermined rather than dropped", async () => {
  const world = fresh();
  await reserve(world.store, "i-0001");
  // A row whose `plan` is a JSON object the plan reader refuses. The row itself
  // still decodes, so it is a live lap with a base branch rondo cannot name.
  await reserve(world.store, "i-0002", { run_id: "r", workspace: "/srv/work/r" });

  const shows = screen();
  expect((await composeBetweenLaps(portsOver(world, shows))).kind).toBe("explained");

  const snapshot = JSON.parse(String(onlyProposal(world.connection)["snapshot"])) as {
    laps: { iteration: { id: string }; baseBranch: string | null }[];
  };
  expect(snapshot.laps).toHaveLength(2);
  expect(snapshot.laps[1]?.baseBranch).toBe(null);
  expect(shows.shown.join("\n")).toContain("open against: undetermined");
});

test("terminal laps are not gathered, and the occupancies come from the store", async () => {
  const world = fresh();
  await reserve(world.store, "i-0001");
  await reserve(world.store, "i-0002");
  const ended = await world.store.transition(
    "i-0002",
    "planned",
    "abandoned",
    { reason: "the operator said so" },
    2_000,
  );
  expect(ended.kind).toBe("transitioned");

  const shows = screen();
  expect((await composeBetweenLaps(portsOver(world, shows))).kind).toBe("explained");

  const snapshot = JSON.parse(String(onlyProposal(world.connection)["snapshot"])) as {
    laps: unknown[];
    bounds: { maxOccupying: number; maxLive: number; occupying: number; live: number };
  };
  expect(snapshot.laps).toHaveLength(1);
  // Counted over the generated columns the bounds are defined against, and
  // carrying the operator's own policy beside them.
  expect(snapshot.bounds).toEqual({ maxOccupying: 4, maxLive: 6, occupying: 1, live: 1 });
  const rendered = shows.shown.join("\n");
  expect(rendered).toContain("live laps: 1");
  expect(rendered).toContain("bound 'maxLive': 6");
  // One lap left, so there is no adjacency -- and the family still speaks.
  expect(rendered).toContain("two live laps open against one base branch: none");
});

/**
 * rondo#91, measured as finding N-6 of `docs/operations/lap-2-dogfood.md`.
 *
 * Three families rest on `/laps` -- `live laps` and the two that report having
 * found nothing -- and each of them printed the whole snapshot of the live laps
 * under it: 3104 characters of request text, three times, in the measured run.
 * The three claims differ and their basis does not, so the repetition pushed
 * the facts apart and buried them in a repeated citation of one document.
 *
 * **What may not be repaired by dropping a basis** (D-0037 rule 1's "each claim
 * carries a basis"), which is why the count of claims carrying the locator is
 * asserted beside the count of citations of the material.
 */
test("the basis three families share is cited once, with the claims that rest on it named", async () => {
  const world = fresh();
  await reserve(world.store, "i-0001");

  const shows = screen();
  expect((await composeBetweenLaps(portsOver(world, shows))).kind).toBe("explained");

  const rendered = shows.shown.join("\n");
  // The material is beside its pointer exactly once, however many claims rest
  // on it.
  expect(rendered.split("snapshot /laps = ")).toHaveLength(2);
  // And all three claims still carry the basis, as the locator.
  expect(
    shows.shown.filter((line) => line.endsWith("basis: snapshot /laps (cited once below)")),
  ).toHaveLength(3);
  expect(rendered).toContain(
    "3 claims rest on it: 'live laps', 'two live laps open against one base branch', " +
      "'one finding read on more than one live lap'",
  );
  // **The facts are adjacent on the screen**, which is what the repetition
  // cost: each claim is one line with one line of basis under it, so the next
  // claim is two lines down rather than a screen away.
  const at = (label: string) => shows.shown.findIndex((line) => line.startsWith(`  ${label}:`));
  expect(at("two live laps open against one base branch") - at("live laps")).toBe(2);
  expect(
    at("one finding read on more than one live lap") -
      at("two live laps open against one base branch"),
  ).toBe(2);
  // A pointer only one claim rests on keeps its material where it was: this is
  // a repair to a repeated citation, not to citing at all.
  expect(rendered).toContain("basis: snapshot /bounds/maxLive = 6");
});

test("the admission refusals the bound wrote are gathered and claimed", async () => {
  const connection = new DatabaseSync(":memory:");
  const world = {
    connection,
    store: iterationStore(connection, { maxOccupying: 1, maxLive: 1 }),
    record: advisoryRecord(connection),
  };
  await reserve(world.store, "i-0001");
  // The second admission is refused by the bound, which writes the only row in
  // the store that records work deliberately not started.
  const refused = await world.store.reserve({
    id: "i-0002",
    request: "a second thing nobody got to start",
    plan: planOn("i-0002", "main"),
    spend: null,
    nowMs: 3_000,
    supersedesIterationId: null,
    requestMessageId: null,
    runId: "rondo-i-0002",
    topicBranch: "rondo/i-0002",
    workspace: "/srv/work/i-0002",
  });
  expect(refused.kind).toBe("atCapacity");

  const shows = screen();
  const outcome = await composeBetweenLaps({
    store: world.store,
    record: world.record,
    now: () => 5_000,
    present: shows.present,
    policy: { maxOccupying: 1, maxLive: 1 },
  });
  expect(outcome.kind).toBe("explained");

  const rendered = shows.shown.join("\n");
  expect(rendered).toContain("a second thing nobody got to start");
  expect(rendered).toContain("an admission a bound refused");
  // rondo reports it and takes no act: nothing was admitted and no bound moved.
  expect((await world.store.readLive()).length).toBe(1);
});

// --- rule 4: the order ----------------------------------------------------

test("the proposal is recorded with its snapshot verbatim, about no iteration", async () => {
  const world = fresh();
  await reserve(world.store, "i-0001");
  await reserve(world.store, "i-0002");

  const shows = screen();
  const outcome = await composeBetweenLaps(portsOver(world, shows));
  expect(outcome.kind).toBe("explained");

  const row = onlyProposal(world.connection);
  expect(row["kind"]).toBe("explanation");
  expect(row["derivation"]).toBe("store_rows");
  expect(row["created_at_ms"]).toBe(5_000);
  // **Null, and it is the field that says what kind of subject this is**: the
  // composition is about the laps between which it sits and about no one row.
  expect(row["iteration_id"]).toBe(null);
  expect(row["candidate_contract_digest"]).toBe(null);

  // Every `snapshot` basis is a pointer into these bytes, so the pointer the
  // screen printed has to resolve against what the row kept.
  const snapshot = JSON.parse(String(row["snapshot"])) as Record<string, unknown>;
  expect(Object.keys(snapshot).sort()).toEqual(["bounds", "laps", "refusals", "unreadable"]);
  expect(shows.shown.join("\n")).toContain('basis: snapshot /laps/0/iteration/id = "i-0001"');
});

test("nothing reaches the screen when the row was not recorded", async () => {
  const world = fresh();
  await reserve(world.store, "i-0001");

  const shows = screen();
  const outcome = await composeBetweenLaps({
    ...portsOver(world, shows),
    record: {
      ...world.record,
      recordProposal: async () => ({ kind: "defect", reason: "the disk is full" }),
    },
  });

  // A framing an operator reads and the ledger does not hold is the failure the
  // whole record exists to prevent, so the order is asserted from the failing
  // side rather than inferred from the passing one.
  expect(outcome.kind).toBe("refused");
  expect(shows.shown).toEqual([]);
});

test("the presentation is counted once, after it was shown", async () => {
  const world = fresh();
  await reserve(world.store, "i-0001");

  const shows = screen();
  const first = await composeBetweenLaps(portsOver(world, shows));
  expect(first.kind).toBe("explained");

  const counted = await world.record.attentionBreakdown();
  expect(counted).toEqual([{ disposition: "presented", ruleName: null, count: 1 }]);
  // **`ruleName` is null because this verb withholds nothing** (rule 5): every
  // live lap entered the snapshot, so there is no policy to name.
  expect(counted[0]?.ruleName).toBe(null);

  // A second composition one millisecond later is a second subject, and the
  // count is of subjects on both sides.
  const second = await composeBetweenLaps(portsOver(world, screen(), 5_001));
  expect(second.kind).toBe("explained");
  expect(await world.record.attentionBreakdown()).toEqual([
    { disposition: "presented", ruleName: null, count: 2 },
  ]);
});

test("a composition that was shown and not counted says its accounting is short", async () => {
  const world = fresh();
  await reserve(world.store, "i-0001");

  const shows = screen();
  const outcome = await composeBetweenLaps({
    ...portsOver(world, shows),
    record: {
      ...world.record,
      recordAttention: async () => ({ kind: "defect", reason: "the disk is full" }),
    },
  });

  // Not a refusal: the operator has read it and the proposal is in the ledger.
  // It is the one case where the surface has to say that its own accounting is
  // short rather than that nothing was shown.
  expect(outcome.kind).toBe("presentedUncounted");
  expect(shows.shown.length).toBeGreaterThan(0);
  expect(onlyProposal(world.connection)["kind"]).toBe("explanation");
});

test("an empty host composes rather than refusing, and says it looked", async () => {
  const world = fresh();

  const shows = screen();
  expect((await composeBetweenLaps(portsOver(world, shows))).kind).toBe("explained");

  // "nothing spans the laps" and "rondo did not look" are different screens,
  // and a verb that refused on an empty host would collapse them.
  const rendered = shows.shown.join("\n");
  expect(rendered).toContain("live laps: 0");
  expect(rendered).toContain("two live laps open against one base branch: none");
  expect(rendered).toContain("one finding read on more than one live lap: none");
  expect(rendered).toContain("an admission a bound refused: none");
});

test("it binds nothing, and the screen says so", async () => {
  const world = fresh();
  const shows = screen();
  await composeBetweenLaps(portsOver(world, shows));

  // D-0032 rule 5 from the screen's side: this kind binds nothing and
  // `recordDecision` will refuse an answer that names it.
  expect(shows.shown.join("\n")).toContain("this explanation binds nothing");
});
