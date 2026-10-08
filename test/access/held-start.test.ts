/**
 * rondo#284 (D-0158): a person's start that another line's files hold waits,
 * and starts by itself once they are free -- with no second press.
 *
 * Driven through the page: the scope screen is fetched over HTTP, its own start
 * form pressed, the order tick run as the resident host runs it, and the page
 * fetched again. continuo is stood in for (`startContinuo`), and so is the
 * loop's admission (`conductor.admit`), which here only reserves -- **through
 * the real store**, so the lane ledger is what refuses the start and what lets
 * it through. Everything between the press and that reservation is rondo's own.
 *
 * **Since D-0160 a start with no drafted claim claims nothing** (rondo#554), so
 * files no longer hold it: a wait is now a drafted part's, or one kept before
 * D-0160. The admission here is handed `/` in its place (`seams.unclaimed`) so
 * the wait's own mechanics stay under test; the last test hands it nothing.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test, vi } from "vitest";
import { heldStartPort, releaseFromPage, scopedStartPress } from "../../src/access/cli.js";
import { releasePublished } from "../../src/access/merge.js";
import { orderHost } from "../../src/access/order-host.js";
import { viewHref } from "../../src/access/page-logic/routes.js";
import { ReleasePort, type ScopedStartInput, ScopePort } from "../../src/access/web-app.js";
import { EN } from "../../src/access/wording.js";
import { allocate } from "../../src/refrain/allocator.js";
import { admittedPlan, planPayload, type RunPlan, readRunPlan } from "../../src/refrain/plan.js";
import { planDigest } from "../../src/store/plan.js";
import type { JsonRecord } from "../../src/store/records.js";
import { scopePayloadWithDefaults } from "../../src/store/records.js";
import {
  type AdvisoryRecord,
  advisoryRecord,
  type IterationStore,
  iterationStore,
} from "../../src/store/sqlite.js";
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
  admitted: [] as string[],
  /** What an admission with no drafted claim is handed: `/`, as before D-0160, or nothing. */
  unclaimed: null as { paths: string[]; authorKind: "drafter"; authorId: string; bases: [] } | null,
}));
vi.mock("../../src/continuo/invoker.js", async (original) => {
  const real = await original<typeof import("../../src/continuo/invoker.js")>();
  return { ...real, startContinuo: async () => ({ kind: "ready", continuo: {} as never }) };
});
vi.mock("../../src/access/conductor.js", async (original) => {
  const real = await original<typeof import("../../src/access/conductor.js")>();
  return {
    ...real,
    // The admission, as far as the row: `reserve()` under its lock decides.
    admit: async (...args: Parameters<typeof real.admit>) => {
      const [, , plan, , id, supersedes, , requestMessageId, scopeSpend, claim, numbers] = args;
      if (seams.store === null) throw new Error("no store");
      seams.admitted.push(id);
      const reserved = await seams.store.reserve({
        numbers: numbers ?? null,
        id,
        request: plan.prompt,
        plan: admittedPayload(plan, id),
        spend: null,
        scopeSpend: scopeSpend ?? null,
        claim: claim ?? seams.unclaimed,
        nowMs: Date.now(),
        supersedesIterationId: supersedes ?? null,
        requestMessageId,
        runId: `rondo-${id}`,
        topicBranch: `rondo/${id}`,
        workspace: `/srv/work/${id}`,
      });
      if (reserved.kind === "laneRefused") {
        return {
          iterationId: null,
          status: null,
          lines: ["Refused: held."],
          laneRefusal: { paths: reserved.paths, holders: reserved.holders },
        };
      }
      if (reserved.kind !== "reserved") throw new Error(JSON.stringify(reserved));
      return { iterationId: id, status: "planned", lines: [] };
    },
  };
});

const ENV = { RONDO_APPROVER: "ada" };
const HOLDER_WORDS = "Rename the logger everywhere.";

function admittedPayload(plan: RunPlan, id: string): JsonRecord {
  const allocation = allocate(id, plan.workspaceRoot);
  if (allocation.kind !== "allocated") throw new Error(allocation.reason);
  const admitted = admittedPlan(plan, allocation.allocation);
  if (admitted.kind !== "planned") throw new Error(admitted.reason);
  return planPayload(admitted.plan);
}

/**
 * Line A holding `src/` and running; request B with a pasted plan and an
 * approved scope; the page served over HTTP; and the order tick with the
 * held-start ports `rondo web` gives it.
 */
async function lines() {
  const dir = mkdtempSync(join(tmpdir(), "rondo-held-start-"));
  const storePath = join(dir, "store.db");
  const connection = new DatabaseSync(storePath);
  const policy = { maxOccupying: 4, maxLive: 6 };
  const store = iterationStore(connection, policy);
  const record = advisoryRecord(connection);
  seams.store = store;
  seams.admitted = [];
  seams.unclaimed = { paths: ["/"], authorKind: "drafter", authorId: "before-d-0160", bases: [] };
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
  await say("rA", HOLDER_WORDS, null, 1_000);
  await say("rB", "Fix the flaky clock test.", null, 1_100);
  const document = planDocument();
  await say("rB-plan", JSON.stringify(document), "rB", 1_200);
  const typeDigest = agentTypeDigestOf(document);
  const scoped = await record.recordScope({
    scopeId: "scope-b",
    payload: scopePayloadWithDefaults({
      requests: ["rB"],
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
    createdAtMs: 1_300,
    agentTypeRecords: [
      {
        agentTypeDigest: typeDigest,
        agentTypeInput: AGENT_TYPE_INPUT,
        planDigest: planDigest(document),
      },
    ],
  });
  expect(scoped.kind, JSON.stringify(scoped)).toBe("recorded");
  const stored = await record.readScope("scope-b");
  if (stored.kind !== "read") throw new Error(JSON.stringify(stored));
  const decided = await record.recordScopeDecision({
    scopeDecisionId: "decision-b",
    scopeId: "scope-b",
    scopeDigest: stored.scope.scopeDigest,
    outcome: "approved",
    actorId: "ada",
    recordedBy: "rondo/page",
    decidedAtMs: 1_500,
  });
  expect(decided.kind).toBe("recorded");

  // Line A: the same repository, holding `src/`, running.
  const planned = readRunPlan(document);
  if (planned.kind !== "planned") throw new Error(planned.reason);
  const reserved = await store.reserve({
    numbers: null,
    id: "lap-a",
    request: HOLDER_WORDS,
    plan: admittedPayload(planned.plan, "lap-a"),
    spend: null,
    scopeSpend: null,
    claim: { paths: ["src/"], authorKind: "drafter", authorId: "test", bases: [] },
    nowMs: 2_000,
    supersedesIterationId: null,
    requestMessageId: "rA",
    runId: "rondo-lap-a",
    topicBranch: "rondo/lap-a",
    workspace: "/srv/work/lap-a",
  });
  expect(reserved.kind).toBe("reserved");
  const walk = async (steps: readonly (readonly [string, string])[]) => {
    for (const [from, to] of steps) {
      const moved = await store.transition(
        "lap-a",
        from as "planned",
        to as "admitting",
        to === "closed" ? { gateOutcome: "approve" } : {},
        2_100,
      );
      expect(moved.kind).toBe("transitioned");
    }
  };
  await walk([
    ["planned", "admitting"],
    ["admitting", "admitted"],
    ["admitted", "performing"],
  ]);

  // The page's own start press, answered once reserved, as `rondo web` wires it.
  const start = async (input: ScopedStartInput) =>
    await scopedStartPress(ENV, store, storePath, "ada", record, EN, input);
  let presses = 0;
  const notThis = async () => await Promise.resolve({ ok: false, note: "not this route" });
  const { base, stop, served } = await serving({
    // The page draws a press only where its host has an approver (`answer`).
    ...portsOver({ connection, store, record }, "ada", []),
    scope: new ScopePort(notThis, async (input) => {
      presses += 1;
      return await start(input);
    }),
    release: new ReleasePort(async (input) => await releaseFromPage(ENV, store, "ada", input)),
  });
  const logged: string[] = [];
  const never = async (): Promise<never> => {
    throw new Error("no split in this store");
  };
  // `rondo web`'s order tick, with no split to walk and its held-start port
  // built by the function `rondo web` builds it with.
  const tickOver = (over: Pick<AdvisoryRecord, "recordThreadMessage" | "approvalsInForce">) =>
    orderHost({
      record,
      splits: async () => [],
      readiness: never,
      readHolder: never,
      start: never,
      held: heldStartPort(ENV, store, storePath, "ada", over, EN, policy),
      now: Date.now,
      log: (line) => logged.push(line),
    });
  const tick = tickOver(record);
  const scopePath = viewHref(
    { kind: "scope", messageId: "rB", rounds: null, decisionId: "decision-b", plan: null },
    "en",
  );
  const screen = async () => (await get(base, scopePath)).body.replaceAll("&#39;", "'");
  const threadPath = viewHref({ kind: "thread", messageId: "rB", to: null }, "en");
  const thread = async () => (await get(base, threadPath)).body.replaceAll("&#39;", "'");
  return {
    store,
    tickOver,
    thread,
    base,
    logged,
    screen,
    presses: () => presses,
    closeA: () =>
      walk([
        ["performing", "awaiting_human"],
        ["awaiting_human", "closed"],
      ]),
    pass: async () => {
      tick.kick();
      await tick.settled();
    },
    stop: async () => {
      stop.abort();
      expect(await served).toBe(0);
    },
  };
}

/** Press the scope screen's start form, as a person's click posts it. */
async function pressStart(w: Awaited<ReturnType<typeof lines>>) {
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
    },
    {},
    "/start?lang=en",
  );
  return { iteration, pressed };
}

/** The press answers that it waits, and the page says so with nothing to press. */
async function heldAndWaiting(w: Awaited<ReturnType<typeof lines>>) {
  const { iteration, pressed } = await pressStart(w);
  // Accepted, not refused: nothing tells the person to press again.
  expect(pressed.status).toBe(202);
  const answer = pressed.body.replaceAll("&#39;", "'");
  expect(answer).toContain(EN.startWaitsHeld);
  expect(answer).not.toContain(EN.startRefusedHeld);
  expect(answer).toContain(HOLDER_WORDS);
  // A still runs: named, with no release to offer (rondo#553), only what it keeps (D-0163).
  expect(answer).not.toContain(`>${EN.releaseLink}<`);
  expect(answer).toContain(`>${EN.holdsLink}<`);
  expect((await w.store.read(iteration)).kind).toBe("absent");
  expect(seams.admitted).toEqual([iteration]);

  // The scope screen: the waiting words and who holds the files, no start form.
  const waiting = await w.screen();
  expect(waiting).toContain('id="start-waits"');
  expect(waiting).toContain(EN.startWaitsHeld);
  expect(waiting.slice(waiting.indexOf('id="start-waits"'))).toContain(HOLDER_WORDS);
  expect(waiting).not.toContain('id="start-form"');
  expect(waiting).not.toContain('action="/start?');
  // The thread's next step says it waits, and no longer sends the person to start it.
  const threadWaiting = await w.thread();
  expect(threadWaiting).toContain(EN.startWaitsHeld);
  expect(threadWaiting).not.toContain(EN.nextStepStart);
  // Both name the work holding the files, and offer no release while it runs
  // (rondo#553): only changing what it keeps (D-0163).
  const card = threadWaiting.slice(threadWaiting.indexOf(EN.startWaitsHeld));
  expect(card.slice(0, card.indexOf("</section>"))).toContain(HOLDER_WORDS);
  expect(waiting).not.toContain(`>${EN.releaseLink}<`);
  expect(threadWaiting).not.toContain(`>${EN.releaseLink}<`);
  expect(waiting).toContain(`>${EN.holdsLink}<`);
  expect(threadWaiting).toContain(`>${EN.holdsLink}<`);

  // A second form of the same plan (another tab) keeps the one waiting row, so
  // the tick cannot start the plan twice by itself.
  await w.store.recordHeldStart({
    iterationId: "lap-other-tab",
    requestMessageId: "rB",
    scopeDecisionId: "decision-b",
    planDigest: (await w.store.heldStarts())[0]?.planDigest ?? "",
    repository: REPOSITORY,
    heldAtMs: Date.now(),
  });
  expect((await w.store.heldStarts()).map((held) => held.iterationId)).toEqual([iteration]);

  // A tick while A runs attempts nothing: A cannot have landed.
  await w.pass();
  expect(seams.admitted).toEqual([iteration]);
  expect((await w.store.heldStarts()).map((held) => held.iterationId)).toEqual([iteration]);

  // A finished but its pull request is not open: the tick attempts it (which
  // is where a landing would be read), is refused by the files again, and B
  // keeps waiting on the one row -- said once, not every minute.
  await w.closeA();
  await w.pass();
  await w.pass();
  expect(seams.admitted).toEqual([iteration, iteration, iteration]);
  expect((await w.store.read(iteration)).kind).toBe("absent");
  expect((await w.store.heldStarts()).map((held) => held.iterationId)).toEqual([iteration]);
  expect(w.logged.filter((line) => line.includes("finished work still holds"))).toHaveLength(1);
  // A finished: the scope screen and the thread's next step both link to its
  // release, where the press answer did before (rondo#553).
  const finished = await w.screen();
  expect(finished).toContain(EN.startWaitsHeld);
  expect(finished.slice(finished.indexOf('id="start-waits"'))).toContain(
    'href="/?release=lap-a&amp;lang=en"',
  );
  const threadFinished = await w.thread();
  const finishedCard = threadFinished.slice(threadFinished.indexOf(EN.startWaitsHeld));
  expect(finishedCard.slice(0, finishedCard.indexOf("</section>"))).toContain(
    'href="/?release=lap-a&amp;lang=en"',
  );
  return iteration;
}

/** The next tick starts B by itself: one admission, its wait settled, no second press. */
async function startsByItself(w: Awaited<ReturnType<typeof lines>>, iteration: string) {
  const before = seams.admitted.length;
  await w.pass();
  expect(seams.admitted.slice(before)).toEqual([iteration]);
  const row = await w.store.read(iteration);
  expect(row.kind).toBe("read");
  if (row.kind === "read") {
    expect(row.record.requestMessageId).toBe("rB");
  }
  expect(await w.store.heldStarts()).toEqual([]);
  expect(w.logged.at(-1)).toBe(`order    ${iteration}: started once its files were free`);
  // Settled, so nothing is attempted again.
  await w.pass();
  expect(seams.admitted.slice(before)).toEqual([iteration]);
  const after = await w.screen();
  expect(after).not.toContain('id="start-waits"');
  expect(after).not.toContain(EN.startWaitsHeld);
  expect(await w.thread()).not.toContain(EN.startWaitsHeld);
  expect(w.presses()).toBe(1);
}

test(
  "a start another line's files hold waits, and starts by itself once that line's pull request opens (rondo#284)",
  async () => {
    const w = await lines();
    try {
      const iteration = await heldAndWaiting(w);
      expect(await releasePublished(w.store, "lap-a", "https://example.invalid/pr/1", 3_000)).toBe(
        "Its files were released: its pull request is open.",
      );
      await startsByItself(w, iteration);
    } finally {
      await w.stop();
    }
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);

test(
  "a start another line's files hold starts by itself once the person releases them on the page (rondo#284)",
  async () => {
    const w = await lines();
    try {
      const iteration = await heldAndWaiting(w);
      const line = (await w.store.laneLedger()).find((one) => one.lineageId === "lap-a");
      if (line?.claimId === null || line === undefined) throw new Error("no claim");
      const releasePage = await get(
        w.base,
        viewHref({ kind: "release", iterationId: "lap-a" }, "en"),
      );
      const released = await post(
        w.base,
        {
          token: tokenIn(releasePage.body),
          iteration: "lap-a",
          claim: line.claimId,
          laps: line.lapIds.join(" "),
        },
        {},
        "/release?lang=en",
      );
      expect(released.status).toBe(303);
      await startsByItself(w, iteration);
    } finally {
      await w.stop();
    }
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);

test(
  "a press from another tab's form once the files are free joins the wait: one lap, which the tick then settles (rondo#284)",
  async () => {
    const w = await lines();
    try {
      // The other tab's page, drawn before the first press: its own form and id.
      const other = await w.screen();
      const form = other.slice(other.indexOf('id="start-form"'));
      const field = (name: string) =>
        new RegExp(`name="${name}" value="([^"]+)"`).exec(form)?.[1] ?? "";
      const otherId = field("iteration");
      const iteration = await heldAndWaiting(w);
      expect(otherId).not.toBe(iteration);
      expect(await releasePublished(w.store, "lap-a", "https://example.invalid/pr/1", 3_000)).toBe(
        "Its files were released: its pull request is open.",
      );
      const pressed = await post(
        w.base,
        {
          token: tokenIn(other),
          request: field("request"),
          scope_decision: field("scope_decision"),
          plan: field("plan"),
          iteration: otherId,
        },
        {},
        "/start?lang=en",
      );
      expect(pressed.status).toBe(303);
      // Started under the wait's own id, not the other tab's.
      expect((await w.store.read(otherId)).kind).toBe("absent");
      expect((await w.store.read(iteration)).kind).toBe("read");
      // The tick finds the row there and settles the wait without a second lap.
      const before = seams.admitted.length;
      await w.pass();
      await w.pass();
      expect(seams.admitted.length).toBe(before);
      expect(await w.store.heldStarts()).toEqual([]);
      // The other tab's form sent again, however often and whatever the lap's
      // line holds, is that lap's press: nothing new is admitted and no wait
      // is kept (Codex rounds 2 and 4).
      const resend = async () =>
        await post(
          w.base,
          {
            token: tokenIn(other),
            request: field("request"),
            scope_decision: field("scope_decision"),
            plan: field("plan"),
            iteration: otherId,
          },
          {},
          "/start?lang=en",
        );
      const admitted = seams.admitted.length;
      expect((await resend()).status).toBe(303);
      expect((await resend()).status).toBe(303);
      expect(seams.admitted.length).toBe(admitted);
      expect((await w.store.read(otherId)).kind).toBe("absent");
      expect(await w.store.heldStarts()).toEqual([]);
    } finally {
      await w.stop();
    }
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);

test(
  "a second tab's press held by the line its first tab started does not wait, so the work never runs twice by itself (rondo#284)",
  async () => {
    const w = await lines();
    try {
      // Two tabs, each with its own form, drawn while A still holds the files.
      const forms = [await w.screen(), await w.screen()].map((page) => {
        const form = page.slice(page.indexOf('id="start-form"'));
        const field = (name: string) =>
          new RegExp(`name="${name}" value="([^"]+)"`).exec(form)?.[1] ?? "";
        return {
          token: tokenIn(page),
          request: field("request"),
          scope_decision: field("scope_decision"),
          plan: field("plan"),
          iteration: field("iteration"),
        };
      });
      await w.closeA();
      expect(await releasePublished(w.store, "lap-a", "https://example.invalid/pr/1", 3_000)).toBe(
        "Its files were released: its pull request is open.",
      );
      const [first, second] = forms;
      if (first === undefined || second === undefined) throw new Error("no forms");
      expect(first.iteration).not.toBe(second.iteration);
      // The first tab starts at once: nothing holds the files now.
      expect((await post(w.base, first, {}, "/start?lang=en")).status).toBe(303);
      expect((await w.store.read(first.iteration)).kind).toBe("read");
      // The second is held by the line the first started: told to start again,
      // and no wait is kept for the tick to run the same work by itself.
      const again = await post(w.base, second, {}, "/start?lang=en");
      expect(again.status).toBe(409);
      expect(again.body.replaceAll("&#39;", "'")).toContain(EN.startRefusedHeld);
      expect(await w.store.heldStarts()).toEqual([]);
    } finally {
      await w.stop();
    }
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);

test(
  "a start that waited under an approval since retired ends its wait without asking admission, so no stop is written (rondo#284)",
  async () => {
    const w = await lines();
    try {
      const { iteration, pressed } = await pressStart(w);
      expect(pressed.status).toBe(202);
      await w.closeA();
      expect(await releasePublished(w.store, "lap-a", "https://example.invalid/pr/1", 3_000)).toBe(
        "Its files were released: its pull request is open.",
      );
      const before = seams.admitted.length;
      const retired = w.tickOver({
        recordThreadMessage: async (draft) => {
          throw new Error(`nothing is written: ${draft.messageId}`);
        },
        approvalsInForce: async () => [],
      });
      retired.kick();
      await retired.settled();
      expect(seams.admitted.slice(before)).toEqual([]);
      expect((await w.store.read(iteration)).kind).toBe("absent");
      expect(await w.store.heldStarts()).toEqual([]);
      expect(w.logged.at(-1)).toBe(
        `order    ${iteration}: not started: the approval 'decision-b' it waited under is no longer in force`,
      );
      // The wait over, the scope screen draws its start again.
      expect(await w.screen()).toContain('id="start-form"');
    } finally {
      await w.stop();
    }
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);

test(
  "a person's start with no drafted claim runs beside a line holding files, and claims nothing until its gate (rondo#554, D-0160)",
  async () => {
    const w = await lines();
    try {
      seams.unclaimed = null;
      // Said before it is pressed: no plan, so it starts beside other work.
      const form = await w.screen();
      expect(form.slice(form.indexOf('id="start-form"'))).toContain(EN.startBeside);
      const { iteration, pressed } = await pressStart(w);
      // Started at once: nothing waits, and nothing was refused.
      expect(pressed.status).toBe(303);
      expect((await w.store.read(iteration)).kind).toBe("read");
      expect(await w.store.heldStarts()).toEqual([]);
      const ledger = await w.store.laneLedger();
      expect(ledger.find((line) => line.lineageId === "lap-a")?.paths).toEqual(["src/"]);
      // Open and holding nothing: not said to be released.
      expect(ledger.find((line) => line.lineageId === iteration)).toMatchObject({
        paths: [],
        inFlight: true,
        releasedBy: null,
      });
    } finally {
      await w.stop();
    }
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);
