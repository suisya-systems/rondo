/**
 * D-0098 rule 1: a drafted plan that waits on an earlier plan of its split is
 * not admitted until that plan's line has landed (`first_landed`), and then
 * starts by itself on the resident host's tick, with the landing as a basis and
 * named in its prompt. A `first` that ends without landing never releases it,
 * and the person is asked once what `then` becomes.
 *
 * The tick is driven with fakes; readiness and the press over a real store
 * file, with a draft written the way the host writes one (as
 * `test/access/drafted-start.test.ts` does).
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test, vi } from "vitest";
import { recordDraftedScopeFromPage, startSplitFromPage } from "../../src/access/cli.js";
import {
  type DraftedStartReadiness,
  draftedStartReadiness,
  ORDER_OPENING,
  planOrder,
} from "../../src/access/drafted-start.js";
import { drafterHost } from "../../src/access/drafter-host.js";
import { draftedPlanRun } from "../../src/access/model-draft/host.js";
import { type OrderHostPorts, orderHost } from "../../src/access/order-host.js";
import type { SplitPayload } from "../../src/advisory/proposal.js";
import { allocate } from "../../src/refrain/allocator.js";
import { admittedPlan, planPayload, type RunPlan } from "../../src/refrain/plan.js";
import { planDigest } from "../../src/store/plan.js";
import type { JsonRecord } from "../../src/store/records.js";
import {
  type AdmittedSplit,
  advisoryRecord,
  iterationStore,
  LANE_LEDGER_AUTHOR,
} from "../../src/store/sqlite.js";
import { agentTypeDigestOf, planDocument } from "./fixtures/drafter.js";

const seams = vi.hoisted(() => ({ pressed: null as unknown[] | null }));
vi.mock("../../src/continuo/invoker.js", async (original) => {
  const real = await original<typeof import("../../src/continuo/invoker.js")>();
  return {
    ...real,
    startContinuo: async (environment?: Readonly<Record<string, string | undefined>>) =>
      seams.pressed === null
        ? await real.startContinuo(environment)
        : { kind: "ready", continuo: {} as never },
  };
});
vi.mock("../../src/access/conductor.js", async (original) => {
  const real = await original<typeof import("../../src/access/conductor.js")>();
  return {
    ...real,
    admit: async (...args: Parameters<typeof real.admit>) => {
      if (seams.pressed === null) return await real.admit(...args);
      seams.pressed.push(...args);
      return { iterationId: null, status: null, lines: ["captured by the test"] };
    },
  };
});

const SPLIT: AdmittedSplit = { scopeDecisionId: "sd-1", proposalId: "p-1", requestMessageId: "r1" };
const COMMIT = "c".repeat(40);

/** The tick's ports over a proposal of `plans`, each plan's readiness a queue the test fills. */
function tick(after: readonly (number | undefined)[], answers: DraftedStartReadiness[][]) {
  const log: string[] = [];
  const started: number[] = [];
  const read: string[] = [];
  const asked: JsonRecord[] = [];
  let released = false;
  const template = `sha256:${"a".repeat(64)}`;
  const payload: SplitPayload = {
    plans: after.map((a) => ({
      template_plan_digest: template,
      prompt: "p",
      agent_type_digest: template,
      bases: [],
      ...(a === undefined ? {} : { after: a }),
    })),
    holes: [],
  };
  const ports: OrderHostPorts = {
    record: {
      admittedSplits: async () => [SPLIT],
      readProposal: async () =>
        ({
          kind: "read",
          proposal: { kind: "split", payload: payload as unknown as JsonRecord },
        }) as never,
      recordThreadMessage: async (draft) => {
        if (asked.some((one) => one["messageId"] === draft.messageId)) {
          return { kind: "refused", reason: "that id is spoken for" };
        }
        asked.push(draft as unknown as JsonRecord);
        return { kind: "recorded" };
      },
    },
    readiness: async (_split, index) =>
      answers[index]?.shift() ?? { kind: "started", iterationId: "x" },
    readHolder: async (lineageId) => {
      read.push(lineageId);
      return {
        released,
        line: released ? "released" : `Line ${lineageId} is not on origin/main yet`,
      };
    },
    start: async (_split, index) => {
      started.push(index);
      return { ok: true, note: "" };
    },
    now: () => 5,
    log: (line) => log.push(line),
  };
  return {
    ports,
    log,
    started,
    read,
    asked,
    land: () => {
      released = true;
    },
  };
}

const waiting = (
  state: "running" | "awaitingLanding" | "endedUnlanded" | null,
): DraftedStartReadiness => ({
  kind: "ordered",
  after: 0,
  first: state === null ? null : { lineageId: "lap-first", state },
});

test("the tick starts a waiting plan only once its first has landed, and never a plan with no order", async () => {
  const run = { kind: "runnable" } as never;
  const t = tick(
    [undefined, 0],
    [
      [{ kind: "ready", run }],
      [waiting(null), waiting("running"), waiting("awaitingLanding"), waiting("awaitingLanding")],
    ],
  );
  const host = orderHost(t.ports);
  // Not started, running: nothing is read and nothing starts. Plan 0 is the person's press.
  for (let n = 0; n < 2; n += 1) {
    host.kick();
    await host.settled();
  }
  expect(t.started).toEqual([]);
  expect(t.read).toEqual([]);
  // Ended and unread: its landing is read, and not landed starts nothing.
  host.kick();
  await host.settled();
  expect(t.read).toEqual(["lap-first"]);
  expect(t.started).toEqual([]);
  // Landed: the release is written by the reading, readiness is asked again, and it starts.
  t.land();
  const ready = t.ports.readiness;
  let calls = 0;
  const host2 = orderHost({
    ...t.ports,
    readiness: async (split, index) => {
      calls += 1;
      return calls === 1 ? await ready(split, index) : { kind: "ready", run };
    },
  });
  host2.kick();
  await host2.settled();
  expect(t.started).toEqual([1]);
  expect(t.log.at(-1)).toContain("started on its dependency's landing");
});

test("a first that ended without landing holds its then, and the person is asked once, with no start-anyway (D-0098 rule 1.5)", async () => {
  const t = tick(
    [undefined, 0],
    [[], [waiting("endedUnlanded"), waiting("endedUnlanded"), waiting("endedUnlanded")]],
  );
  const host = orderHost(t.ports);
  host.kick();
  await host.settled();
  host.kick();
  await host.settled();
  expect(t.started).toEqual([]);
  expect(t.asked).toHaveLength(1);
  const [ask] = t.asked;
  expect(ask).toMatchObject({
    messageId: "order-unlanded-p-1-1-lap-first",
    authorKind: "drafter",
    inReplyTo: "r1",
    asks: true,
    bases: [
      { form: "message", messageId: "r1" },
      { form: "proposal", proposalId: "p-1" },
      { form: "iteration", iterationId: "lap-first" },
    ],
  });
  const body = String(ask?.["body"]);
  expect(body).toContain("Try part 1 again");
  expect(body).toContain("Drop part 2");
  expect(body).toContain("Recommended: try part 1 again");
  expect(body).not.toMatch(/anyway/i);
  // D-0004: rondo's own words are ASCII.
  expect(/^[\x20-\x7e\n]*$/.test(body)).toBe(true);
  // A second process finds the id spoken for, and says nothing about it.
  const again = orderHost(t.ports);
  again.kick();
  await again.settled();
  expect(t.asked).toHaveLength(1);
  expect(t.log).toEqual([]);
});

test("a held plan is attempted only when every holder has finished", async () => {
  const run = { kind: "runnable" } as never;
  const holder = (inFlight: boolean) => ({ line: { inFlight } as never, paths: ["src/"] });
  const t = tick(
    [undefined, 0],
    [
      [],
      [
        { kind: "held", run, holders: [holder(true)] },
        { kind: "held", run, holders: [holder(false)] },
      ],
    ],
  );
  const host = orderHost(t.ports);
  host.kick();
  await host.settled();
  expect(t.started).toEqual([]);
  host.kick();
  await host.settled();
  expect(t.started).toEqual([1]);
});

// ---------------------------------------------------------------------------
// Over a real store: readiness, the press's refusal, and the admission on a landing.

const PROMPTS = ["Change the library.", "Move the pin onto it."];
const CLAIMS = [["lib/"], ["pin/"]];
const ENV = { RONDO_APPROVER: "ada" };
const WINDOWS_HEAVY_TIMEOUT_MS = 60_000;

async function chain() {
  const dir = mkdtempSync(join(tmpdir(), "rondo-order-"));
  const storePath = join(dir, "store.db");
  const connection = new DatabaseSync(storePath);
  const record = advisoryRecord(connection);
  const store = iterationStore(connection, { maxOccupying: 4, maxLive: 6 });
  await record.messagesBeforeDrafter(0);
  const document = planDocument();
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
  await say("r1", "Change the library, then move the pin.", null, 1_000);
  await say("r1-plan", JSON.stringify(document), "r1", 2_000);
  const typeDigest = agentTypeDigestOf(document);
  let n = 0;
  const host = drafterHost({
    store,
    record,
    now: () => 10_000,
    language: null,
    log: () => undefined,
    mintId: (kind) => {
      n += 1;
      return `${kind}-${String(n)}`;
    },
    runDrafter: async () => ({
      kind: "answered",
      costUsd: 0.05,
      finalMessage: JSON.stringify({
        act: "split",
        summary: { text: "Two plans in order.", bases: ["r1"] },
        plans: PROMPTS.map((prompt, i) => ({
          template_plan_digest: planDigest(document),
          agent_type_digest: typeDigest,
          prompt,
          bases: ["r1"],
          claim: CLAIMS[i],
          ...(i === 1 ? { after: 0 } : {}),
        })),
      }),
    }),
  });
  host.kick();
  await host.idle();
  const scopeRow = connection
    .prepare("SELECT scope_id FROM scope WHERE author_kind = 'drafter'")
    .get() as { scope_id: string };
  const proposalRow = connection
    .prepare("SELECT proposal_id FROM proposal WHERE kind = 'split'")
    .get() as { proposal_id: string };
  const scope = await record.readScope(scopeRow.scope_id);
  if (scope.kind !== "read") throw new Error("the drafted scope did not read");
  const approved = await recordDraftedScopeFromPage(ENV, storePath, "ada", {
    draftScopeId: scope.scope.scopeId,
    draftDigest: scope.scope.scopeDigest,
    scopeId: "scope-mine-1",
    budgets: scope.scope.payload.budgets,
    severityThreshold: scope.scope.payload.severity_threshold,
    outwardActs: scope.scope.payload.outward_acts,
  });
  return {
    storePath,
    connection,
    record,
    store,
    typeDigest,
    proposalId: proposalRow.proposal_id,
    decision: approved.scopeDecisionId as string,
  };
}

function admittedPayload(plan: RunPlan, id: string): JsonRecord {
  const allocation = allocate(id, plan.workspaceRoot);
  if (allocation.kind !== "allocated") throw new Error(allocation.reason);
  const admitted = admittedPlan(plan, allocation.allocation);
  if (admitted.kind !== "planned") throw new Error(admitted.reason);
  return planPayload(admitted.plan);
}

/** Walk a reserved row to `closed` along legal edges, as the loop would. */
async function close(w: Awaited<ReturnType<typeof chain>>, id: string) {
  const path = ["planned", "classified", "admitting", "admitted", "performing", "awaiting_human"];
  for (let step = 1; step < path.length; step += 1) {
    const outcome = await w.store.transition(
      id,
      path[step - 1] as "planned",
      path[step] as "classified",
      {},
      11_000 + step,
    );
    expect(outcome.kind).toBe("transitioned");
  }
  const closed = await w.store.transition(
    id,
    "awaiting_human",
    "closed",
    { gateOutcome: "answered_and_forwarded" },
    12_000,
  );
  expect(closed.kind).toBe("transitioned");
}

test(
  "a plan after another waits through every state of its first, and starts on the landing with it as basis and instruction (D-0098 rules 1.2 and 1.6)",
  async () => {
    const w = await chain();
    const ports = { store: w.store, record: w.record, policy: { maxOccupying: 4, maxLive: 6 } };
    const readiness = () =>
      draftedStartReadiness({ ...ports, nowMs: 20_000 }, "r1", w.decision, w.proposalId, 1);
    // First not started: held, and the press admits nothing.
    expect(await readiness()).toEqual({ kind: "ordered", after: 0, first: null });
    const pressed = await startSplitFromPage(ENV, w.store, w.storePath, "ada", ports.policy, {
      iterationId: "lap-too-early",
      requestMessageId: "r1",
      scopeDecisionId: w.decision,
      proposalId: w.proposalId,
      planIndex: 1,
    });
    expect(pressed).toMatchObject({ ok: false, why: "startRefusedNotAdmitted" });
    expect(pressed.note).toContain("waits until plan 0");
    expect((await w.store.read("lap-too-early")).kind).toBe("absent");

    // First started and abandoned: released with no landing, held for good.
    const first = await draftedPlanRun(w, "r1", w.proposalId, 0);
    if (first.kind !== "runnable") throw new Error("plan 0 does not run");
    const reserve = (id: string, supersedes: string | null) =>
      w.store.reserve({
        numbers: null,
        id,
        request: "Change the library, then move the pin.",
        plan: admittedPayload(first.plan, id),
        spend: null,
        scopeSpend:
          supersedes === null
            ? {
                scopeDecisionId: w.decision,
                proposalId: w.proposalId,
                agentTypeDigest: w.typeDigest,
              }
            : null,
        claim: supersedes === null ? first.claim : null,
        nowMs: 15_000,
        supersedesIterationId: supersedes,
        requestMessageId: "r1",
        runId: `rondo-${id}`,
        topicBranch: `rondo/${id}`,
        workspace: `/srv/work/${id}`,
      });
    expect((await reserve("lap-first", null)).kind).toBe("reserved");
    // Where the tick looks: the split an approval admitted a plan of.
    expect(await w.record.admittedSplits()).toEqual([
      { scopeDecisionId: w.decision, proposalId: w.proposalId, requestMessageId: "r1" },
    ]);
    const state = async () => {
      const ready = await readiness();
      return ready.kind === "ordered" ? ready.first?.state : ready.kind;
    };
    expect(await state()).toBe("running");
    expect((await w.store.transition("lap-first", "planned", "abandoned", {}, 16_000)).kind).toBe(
      "transitioned",
    );
    expect(await state()).toBe("endedUnlanded");
    // The tick over the real rows: nothing starts, and one question is asked.
    const tickPorts: OrderHostPorts = {
      record: w.record,
      readiness: async (split, index) =>
        await draftedStartReadiness(
          { ...ports, nowMs: 20_000 },
          split.requestMessageId,
          split.scopeDecisionId,
          split.proposalId,
          index,
        ),
      readHolder: async () => ({ released: false, line: "not asked" }),
      start: async () => {
        throw new Error("nothing starts behind a first that did not land");
      },
      now: () => 16_500,
      log: (said) => {
        throw new Error(said);
      },
    };
    for (let n = 0; n < 2; n += 1) {
      const host = orderHost(tickPorts);
      host.kick();
      await host.settled();
    }
    expect(
      w.connection
        .prepare("SELECT message_id, author_kind, asks FROM conversation_message WHERE asks = 1")
        .all(),
    ).toEqual([
      {
        message_id: `order-unlanded-${w.proposalId}-1-lap-first`,
        author_kind: "drafter",
        asks: 1,
      },
    ]);

    // Retried, it runs and holds again; closed, it awaits its landing reading.
    expect((await reserve("lap-first-r2", "lap-first")).kind).toBe("reserved");
    expect(await state()).toBe("running");
    await close(w, "lap-first-r2");
    expect(await state()).toBe("awaitingLanding");

    // The landing reading's release is the fact: then is ready, on that commit.
    const line = await w.store.laneLine("lap-first");
    if (line.kind !== "read") throw new Error("no line");
    const released = await w.store.releaseLane({
      iterationId: "lap-first",
      takenOver: {
        claimId: line.line.claim?.claimId ?? null,
        lapIds: ["lap-first", "lap-first-r2"],
      },
      landed: true,
      authorKind: "drafter",
      authorId: LANE_LEDGER_AUTHOR,
      bases: [
        { form: "iteration", iterationId: "lap-first-r2" },
        { form: "landing", branch: "main", commit: COMMIT },
      ],
      nowMs: 17_000,
    });
    expect(released.kind).toBe("released");
    expect((await readiness()).kind).toBe("ready");
    const then = await draftedPlanRun(w, "r1", w.proposalId, 1);
    if (then.kind !== "runnable") throw new Error("plan 1 does not run");
    expect(await planOrder(ports, "r1", w.proposalId, then)).toEqual({
      kind: "landed",
      landing: {
        lineageId: "lap-first",
        repository: first.repository,
        branch: "main",
        commit: COMMIT,
      },
    });

    // The press (the tick's own path) admits it with the landing as basis and instruction.
    seams.pressed = [];
    vi.useFakeTimers({ toFake: ["Date"], now: 20_000 });
    try {
      const result = await startSplitFromPage(ENV, w.store, w.storePath, "ada", ports.policy, {
        iterationId: "lap-then",
        requestMessageId: "r1",
        scopeDecisionId: w.decision,
        proposalId: w.proposalId,
        planIndex: 1,
      });
      expect(result.note, JSON.stringify(result)).toContain("captured by the test");
      // conductor.admit(ports, advisory, plan, policy, id, supersedes, spend, request, scopeSpend, claim)
      const [, , plan, , id, , , , , claim] = seams.pressed;
      expect(id).toBe("lap-then");
      const prompt = (plan as RunPlan).prompt;
      expect(prompt.startsWith(`${PROMPTS[1]}${ORDER_OPENING}`)).toBe(true);
      expect(prompt).toContain(`is at commit ${COMMIT}`);
      expect(prompt).toContain(first.repository);
      expect(claim).toMatchObject({
        paths: ["pin/"],
        bases: expect.arrayContaining([
          {
            form: "landing",
            lineageId: "lap-first",
            repository: first.repository,
            branch: "main",
            commit: COMMIT,
          },
        ]),
      });
      // Admitted, that lap is this plan started: rondo's section is not the plan's.
      expect(
        (
          await w.store.reserve({
            numbers: null,
            id: "lap-then",
            request: "Change the library, then move the pin.",
            plan: admittedPayload(plan as RunPlan, "lap-then"),
            spend: null,
            scopeSpend: null,
            claim: claim as never,
            nowMs: 21_000,
            supersedesIterationId: null,
            requestMessageId: "r1",
            runId: "rondo-lap-then",
            topicBranch: "rondo/lap-then",
            workspace: "/srv/work/lap-then",
          })
        ).kind,
      ).toBe("reserved");
      expect(await readiness()).toEqual({ kind: "started", iterationId: "lap-then" });
    } finally {
      vi.useRealTimers();
      seams.pressed = null;
    }
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);
