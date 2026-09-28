/**
 * rondo#462, end to end: the worker a person picks on the start form is the
 * worker the request's own record names, and the thread reads it back.
 *
 * **One test per case, from the press to the drawn page, with nothing stood in
 * between.** The screen is fetched over HTTP, its own start form is posted as a
 * click posts it, the row is written by the **real store** into a file on disk,
 * and the provider is read back out of the **thread's HTML** fetched over HTTP
 * from that same store. No fake store, no port that catches the input and
 * answers for the rest of the path, and no renderer called with a value a test
 * chose: what each case asserts is that the choice survives the whole way, and
 * a case that stopped anywhere in the middle would assert a link instead.
 *
 * Two things outside rondo are stood in for, as `held-start.test.ts` stands
 * them in: continuo (`startContinuo`), which this host does not have, and the
 * loop's admission (`conductor.admit`), which cannot run without one. The
 * stand-in for the second **reserves through the real store with the two
 * provider arguments it was actually called with**, so what it removes is the
 * walk to the gate and not the forwarding under test -- a caller that dropped
 * either argument writes a row with no provider on it, and every assertion
 * below goes red.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test, vi } from "vitest";
import { scopedStartPress } from "../../src/access/cli.js";
import { viewHref } from "../../src/access/page-logic/routes.js";
import { type ScopedStartInput, ScopePort } from "../../src/access/web-app.js";
import { EN } from "../../src/access/wording.js";
import { allocate } from "../../src/refrain/allocator.js";
import { admittedPlan, planPayload, type RunPlan, readRunPlan } from "../../src/refrain/plan.js";
import { planDigest } from "../../src/store/plan.js";
import type { JsonRecord } from "../../src/store/records.js";
import { scopePayloadWithDefaults } from "../../src/store/records.js";
import { advisoryRecord, type IterationStore, iterationStore } from "../../src/store/sqlite.js";
import {
  AGENT_TYPE_INPUT,
  agentTypeDigestOf,
  planDocument,
  REPOSITORY,
  WORKSPACE_ROOT,
} from "./fixtures/drafter.js";
import { get, portsOver, post, serving, tokenIn, WINDOWS_HEAVY_TIMEOUT_MS } from "./page-world.js";

const seams = vi.hoisted(() => ({
  store: null as IterationStore | null,
  /** What `admit` was called with, so a dropped argument is visible as itself. */
  admitted: [] as {
    id: string;
    workerProvider: string | null;
    hostWorkerProvider: string | null;
  }[],
}));

/**
 * The continuo a start settles, with **the host's workers on it**: the name
 * `admitScopedPlan` resolves the request that chose nothing onto its row is
 * read off this, which is the host fact the page's own list comes from too.
 */
vi.mock("../../src/continuo/invoker.js", async (original) => {
  const real = await original<typeof import("../../src/continuo/invoker.js")>();
  return {
    ...real,
    startContinuo: async () => ({
      kind: "ready",
      continuo: {
        workers: {
          fallback: "claude",
          ready: [
            { provider: "claude" },
            { provider: "codex", codexHome: "/home/op/.codex", codexCommand: "/usr/bin/codex" },
          ],
        },
      } as never,
    }),
  };
});

vi.mock("../../src/access/conductor.js", async (original) => {
  const real = await original<typeof import("../../src/access/conductor.js")>();
  return {
    ...real,
    // The admission as far as the row, and **with the provider arguments as
    // given**: `reserve()` is the real one, so what settles onto the row is the
    // store's own rule about a choice and a resolved default.
    admit: async (...args: Parameters<typeof real.admit>) => {
      const [, , plan, , id, supersedes, , requestMessageId, scopeSpend, claim, numbers] = args;
      const workerProvider = args[11] ?? null;
      const hostWorkerProvider = args[12] ?? null;
      if (seams.store === null) throw new Error("no store");
      seams.admitted.push({ id, workerProvider, hostWorkerProvider });
      const reserved = await seams.store.reserve({
        numbers: numbers ?? null,
        id,
        request: plan.prompt,
        plan: admittedPayload(plan, id),
        spend: null,
        scopeSpend: scopeSpend ?? null,
        claim: claim ?? null,
        nowMs: Date.now(),
        supersedesIterationId: supersedes ?? null,
        requestMessageId,
        workerProvider,
        hostWorkerProvider,
        runId: `rondo-${id}`,
        topicBranch: `rondo/${id}`,
        workspace: `/srv/work/${id}`,
      });
      if (reserved.kind !== "reserved") throw new Error(JSON.stringify(reserved));
      return { iterationId: id, status: "planned", lines: [] };
    },
  };
});

const ENV = { RONDO_APPROVER: "ada" };
const ASKED = "Compare the two workers on this test.";

/** This host runs Claude unless a request says otherwise, and can run Codex. */
const HOST_WORKERS = Object.freeze({ fallback: "claude", ready: ["claude", "codex"] as const });

function admittedPayload(plan: RunPlan, id: string): JsonRecord {
  const allocation = allocate(id, plan.workspaceRoot);
  if (allocation.kind !== "allocated") throw new Error(allocation.reason);
  const admitted = admittedPlan(plan, allocation.allocation);
  if (admitted.kind !== "planned") throw new Error(admitted.reason);
  return planPayload(admitted.plan);
}

/** An apostrophe in rondo's sentences is an entity by the time it is markup. */
const plain = (html: string) => html.replaceAll("&#39;", "'").replaceAll("&#x27;", "'");

/**
 * A request with a pasted plan, an approved scope, a store on disk, and the
 * page served over HTTP with this host's workers on its ports.
 */
async function world(workers: { fallback: string; ready: readonly string[] } = HOST_WORKERS) {
  const dir = mkdtempSync(join(tmpdir(), "rondo-start-worker-"));
  const storePath = join(dir, "store.db");
  const connection = new DatabaseSync(storePath);
  const store = iterationStore(connection, { maxOccupying: 4, maxLive: 6 });
  const record = advisoryRecord(connection);
  seams.store = store;
  seams.admitted = [];
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
  await say("req", ASKED, null, 1_000);
  const document = planDocument();
  await say("req-plan", JSON.stringify(document), "req", 1_100);
  const typeDigest = agentTypeDigestOf(document);
  const scoped = await record.recordScope({
    scopeId: "scope",
    payload: scopePayloadWithDefaults({
      requests: ["req"],
      workspaces: [{ repository: REPOSITORY, workspace_root: WORKSPACE_ROOT }],
      agent_types: [typeDigest],
      budgets: {
        laps: 3,
        review_rounds: 1,
        cost_usd: 5,
        cost_reserve_usd: 1,
        expires_at_ms: 9_999_999_999_999,
      },
      severity_threshold: "major",
      outward_acts: [],
      irreversible_additions: [],
    }),
    supersedesScopeId: null,
    authorKind: "operator",
    authorId: "ada",
    bases: [],
    createdAtMs: 1_200,
    agentTypeRecords: [
      {
        agentTypeDigest: typeDigest,
        agentTypeInput: AGENT_TYPE_INPUT,
        planDigest: planDigest(document),
      },
    ],
  });
  expect(scoped.kind, JSON.stringify(scoped)).toBe("recorded");
  const stored = await record.readScope("scope");
  if (stored.kind !== "read") throw new Error(JSON.stringify(stored));
  const decided = await record.recordScopeDecision({
    scopeDecisionId: "decision",
    scopeId: "scope",
    scopeDigest: stored.scope.scopeDigest,
    outcome: "approved",
    actorId: "ada",
    recordedBy: "rondo/page",
    decidedAtMs: 1_300,
  });
  expect(decided.kind, JSON.stringify(decided)).toBe("recorded");
  // The plan is checked here for the reason `held-start.test.ts` checks it: a
  // fixture plan that will not read refuses the start for its own reason, and
  // this file would then be asserting nothing about a provider.
  const planned = readRunPlan(document);
  if (planned.kind !== "planned") throw new Error(planned.reason);

  const notThis = async () => await Promise.resolve({ ok: false, note: "not this route" });
  const served = async (over: { fallback: string; ready: readonly string[] }) =>
    await serving({
      ...portsOver({ connection, store, record }, "ada", []),
      workers: over,
      scope: new ScopePort(
        notThis,
        async (input: ScopedStartInput) =>
          await scopedStartPress(ENV, store, storePath, "ada", record, EN, input),
      ),
    });
  const page = await served(workers);
  const scopePath = viewHref(
    { kind: "scope", messageId: "req", rounds: null, decisionId: "decision", plan: null },
    "en",
  );
  const threadPath = viewHref({ kind: "thread", messageId: "req", to: null }, "en");
  return {
    store,
    connection,
    /** The thread as a person reads it, from this server or another host's. */
    thread: async (from: string = page.base) => plain((await get(from, threadPath)).body),
    screen: async () => plain((await get(page.base, scopePath)).body),
    /**
     * The same store served by a host whose default has moved since: the
     * observed-red control on reading the provider off the row. A page that
     * named the host's default at drawing time would relabel the lap below.
     */
    movedDefault: async () =>
      await served({ fallback: "codex", ready: ["claude", "codex"] as const }),
    base: page.base,
    stop: async () => {
      page.stop.abort();
      expect(await page.served).toBe(0);
    },
  };
}

/**
 * Press the scope screen's start form, posting `worker_provider` as the select
 * would: the empty string where the person left the default option alone.
 */
async function pressStart(w: Awaited<ReturnType<typeof world>>, chosen: string) {
  const page = await w.screen();
  expect(page).toContain('id="start-form"');
  const form = page.slice(page.indexOf('id="start-form"'));
  const field = (name: string) =>
    new RegExp(`name="${name}" value="([^"]+)"`).exec(form)?.[1] ?? "";
  const iteration = field("iteration");
  expect(iteration).not.toBe("");
  const pressed = await post(
    w.base,
    {
      token: tokenIn(page),
      request: field("request"),
      scope_decision: field("scope_decision"),
      plan: field("plan"),
      iteration,
      worker_provider: chosen,
    },
    {},
    "/start?lang=en",
  );
  return { iteration, pressed, form };
}

test(
  "a start that chooses no worker records the host's default, and the thread names it as the default (rondo#462)",
  async () => {
    const w = await world();
    try {
      const { iteration, pressed, form } = await pressStart(w, "");
      // The form said which worker it would use before it was pressed, so the
      // name was on the screen rather than behind a terminal.
      expect(form).toContain('<select name="worker_provider"');
      expect(plain(form)).toContain(EN.workerProviderDefault("claude"));
      expect(form).toContain('<option value="codex">codex</option>');
      expect(pressed.status).toBe(303);

      // The row the press wrote: the name the host's default resolved to at the
      // start, marked as the default rather than as anyone's choice.
      const row = await w.store.read(iteration);
      expect(row.kind, JSON.stringify(row)).toBe("read");
      if (row.kind !== "read") throw new Error("no row");
      expect(row.record.workerProvider).toBe("claude");
      expect(row.record.workerProviderChosen).toBe(false);
      // Nothing was chosen, and the default reached `reserve()` from the seam.
      expect(seams.admitted).toEqual([
        { id: iteration, workerProvider: null, hostWorkerProvider: "claude" },
      ]);

      // And the thread says so, off that row.
      const thread = await w.thread();
      expect(thread).toContain(EN.workerProviderLabel);
      expect(thread).toContain(EN.workerProviderRan("claude", false));
      expect(thread).not.toContain(EN.workerProviderRan("claude", true));
      expect(thread).not.toContain(EN.workerProviderUnknown);

      // **The host's default moved afterwards**: the same store, served by a
      // host that now runs Codex by default, still says this lap ran on Claude.
      const moved = await w.movedDefault();
      try {
        const after = await w.thread(moved.base);
        expect(after).toContain(EN.workerProviderRan("claude", false));
        expect(after).not.toContain(EN.workerProviderRan("codex", false));
      } finally {
        moved.stop.abort();
        expect(await moved.served).toBe(0);
      }
    } finally {
      await w.stop();
    }
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);

test(
  "a lap whose row records no worker is drawn as unknown, and no back-fill invents one (rondo#462)",
  async () => {
    // **The only row that has none is one written before rondo recorded it**, so
    // this makes one: the press writes a row and the column is emptied under it,
    // which is what a store from before this column looks like once
    // `addMissingColumns` has added it with no back-fill. rondo is unreleased
    // and those rows are not worth migrating; what matters is that the page says
    // it does not know rather than naming the worker this host runs today.
    const w = await world();
    try {
      const { iteration } = await pressStart(w, "codex");
      w.connection
        .prepare("UPDATE iteration SET worker_provider = NULL, worker_provider_chosen = NULL")
        .run();
      const row = await w.store.read(iteration);
      if (row.kind !== "read") throw new Error(JSON.stringify(row));
      expect(row.record.workerProvider).toBeNull();
      const thread = await w.thread();
      expect(thread).toContain(EN.workerProviderLabel);
      expect(thread).toContain(EN.workerProviderUnknown);
      expect(thread).not.toContain(EN.workerProviderRan("claude", false));
      expect(thread).not.toContain(EN.workerProviderRan("codex", true));
    } finally {
      await w.stop();
    }
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);

test(
  "a start that chooses the other worker records that choice, and the thread names it as chosen (rondo#462)",
  async () => {
    const w = await world();
    try {
      const { iteration, pressed } = await pressStart(w, "codex");
      expect(pressed.status).toBe(303);
      const row = await w.store.read(iteration);
      expect(row.kind, JSON.stringify(row)).toBe("read");
      if (row.kind !== "read") throw new Error("no row");
      expect(row.record.workerProvider).toBe("codex");
      expect(row.record.workerProviderChosen).toBe(true);
      // The form's own field reached the admission; the host's default came
      // with it and lost, which is what "over the host's default" means.
      expect(seams.admitted).toEqual([
        { id: iteration, workerProvider: "codex", hostWorkerProvider: "claude" },
      ]);

      const thread = await w.thread();
      expect(thread).toContain(EN.workerProviderRan("codex", true));
      // Not as the default, and not as the worker the host would have run.
      expect(thread).not.toContain(EN.workerProviderRan("codex", false));
      expect(thread).not.toContain(EN.workerProviderRan("claude", false));
    } finally {
      await w.stop();
    }
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);
