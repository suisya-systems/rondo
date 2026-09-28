/**
 * rondo#553 and rondo#554 (D-0160), end to end through the page: the claims
 * that let two lines run.
 *
 * - A line closed at its gate that left nothing gives its files up when the
 *   order tick attempts the part it holds, so that part starts with no press.
 * - A refused draft is drafted once more, so its start claims only the drafted
 *   files and runs beside another line.
 *
 * Over a real store file, a draft written the way the host writes one (a fake
 * `claude` answering), the page served over HTTP and the order tick as
 * `rondo web` builds it. continuo is stood in for, and so is the loop's
 * admission, which here only reserves through the real store -- and, refused
 * by held files, reads the holders' landings and tries once more, as
 * `conductor.admit` does (rondo#280), with the real `readHolder`.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test, vi } from "vitest";

import { recordDraftedScopeFromPage, startSplitFromPage } from "../../src/access/cli.js";
import { draftedStartReadiness } from "../../src/access/drafted-start.js";
import { approvedSplits } from "../../src/access/drafted-view.js";
import { drafterHost } from "../../src/access/drafter-host.js";
import type { DrafterRun } from "../../src/access/model-draft/judgement.js";
import { orderHost } from "../../src/access/order-host.js";
import { viewHref } from "../../src/access/page-logic/routes.js";
import { ScopePort } from "../../src/access/web-app.js";
import { EN } from "../../src/access/wording.js";
import { allocate } from "../../src/refrain/allocator.js";
import { admittedPlan, planPayload, type RunPlan, readRunPlan } from "../../src/refrain/plan.js";
import { planDigest } from "../../src/store/plan.js";
import type { JsonRecord } from "../../src/store/records.js";
import { advisoryRecord, type IterationStore, iterationStore } from "../../src/store/sqlite.js";
import { agentTypeDigestOf, planDocument } from "./fixtures/drafter.js";
import { get, portsOver, post, serving, tokenIn, WINDOWS_HEAVY_TIMEOUT_MS } from "./page-world.js";

const seams = vi.hoisted(() => ({
  store: null as IterationStore | null,
  admitted: [] as string[],
}));
vi.mock("../../src/continuo/invoker.js", async (original) => {
  const real = await original<typeof import("../../src/continuo/invoker.js")>();
  return { ...real, startContinuo: async () => ({ kind: "ready", continuo: {} as never }) };
});
vi.mock("../../src/access/conductor.js", async (original) => {
  const real = await original<typeof import("../../src/access/conductor.js")>();
  return {
    ...real,
    admit: async (...args: Parameters<typeof real.admit>) => {
      const [, , plan, , id, supersedes, , requestMessageId, scopeSpend, claim, numbers] = args;
      const store = seams.store;
      if (store === null) throw new Error("no store");
      seams.admitted.push(id);
      const reserve = async () =>
        await store.reserve({
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
          runId: `rondo-${id}`,
          topicBranch: `rondo/${id}`,
          workspace: `/srv/work/${id}`,
        });
      let reserved = await reserve();
      if (reserved.kind === "laneRefused") {
        // The rondo#280 fallback, as `admit` has it: read each holder, and
        // try once more if one was released.
        const lanes = {
          store,
          readLanding: async () => {
            throw new Error("no landing is read in this test");
          },
          readChangedPaths: async () => {
            throw new Error("no changed paths are read in this test");
          },
          remote: "origin",
        };
        let released = false;
        for (const holder of reserved.holders) {
          released ||= (await real.readHolder(lanes, holder.lineageId, Date.now())).released;
        }
        if (released) {
          reserved = await reserve();
        }
      }
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
const POLICY = { maxOccupying: 4, maxLive: 6 };
const HOLDER_WORDS = "Rename the logger everywhere.";
const CLAIM = ["src/access/scope.ts"];

function admittedPayload(plan: RunPlan, id: string): JsonRecord {
  const allocation = allocate(id, plan.workspaceRoot);
  if (allocation.kind !== "allocated") throw new Error(allocation.reason);
  const admitted = admittedPlan(plan, allocation.allocation);
  if (admitted.kind !== "planned") throw new Error(admitted.reason);
  return planPayload(admitted.plan);
}

/**
 * Line A running on `holds`, and request r1 drafted by the host's drafter
 * answering `answers` in turn, its drafted scope approved; the page served.
 */
async function world(holds: readonly string[], answers: readonly DrafterRun[]) {
  const dir = mkdtempSync(join(tmpdir(), "rondo-claims-for-parallel-"));
  const storePath = join(dir, "store.db");
  const connection = new DatabaseSync(storePath);
  const record = advisoryRecord(connection);
  const store = iterationStore(connection, POLICY);
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
  const document = planDocument();
  await say("rA", HOLDER_WORDS, null, 500);
  // A's request predates the drafter here, so only r1 is drafted.
  await record.messagesBeforeDrafter(700);
  await say("r1", "Fix the scope screen's cost box.", null, 1_000);
  await say("r1-plan", JSON.stringify(document), "r1", 2_000);

  // The drafter, as `rondo web` runs it.
  let n = 0;
  let run = 0;
  const drafted: string[] = [];
  const drafter = drafterHost({
    store,
    record,
    // The wall clock: the scope it drafts expires from now, and the presses read it.
    now: Date.now,
    language: null,
    log: (line) => drafted.push(line),
    mintId: (kind) => {
      n += 1;
      return `${kind}-${String(n)}`;
    },
    runDrafter: async () => {
      run += 1;
      const answer = answers[run - 1];
      if (answer === undefined) throw new Error(`no answer for run ${String(run)}`);
      return answer;
    },
  });
  drafter.kick();
  await drafter.idle();
  const scopeRow = connection
    .prepare("SELECT scope_id FROM scope WHERE author_kind = 'drafter'")
    .get() as { scope_id: string } | undefined;
  if (scopeRow === undefined) throw new Error(`nothing was drafted: ${drafted.join(" / ")}`);
  const draft = await record.readScope(scopeRow.scope_id);
  if (draft.kind !== "read") throw new Error("the drafted scope did not read");
  const approved = await recordDraftedScopeFromPage(ENV, storePath, "ada", {
    draftScopeId: draft.scope.scopeId,
    draftDigest: draft.scope.scopeDigest,
    scopeId: "scope-mine-1",
    budgets: draft.scope.payload.budgets,
    severityThreshold: draft.scope.payload.severity_threshold,
    outwardActs: draft.scope.payload.outward_acts,
  });
  const decision = approved.scopeDecisionId;
  if (decision === undefined) throw new Error(approved.note);

  // Line A, in the same repository, running: started after the draft, so the
  // drafter's templates are r1's pasted plan and nothing of A's.
  const planned = readRunPlan(document);
  if (planned.kind !== "planned") throw new Error(planned.reason);
  const reserved = await store.reserve({
    numbers: null,
    id: "lap-a",
    request: HOLDER_WORDS,
    plan: admittedPayload(planned.plan, "lap-a"),
    spend: null,
    scopeSpend: null,
    claim: { paths: [...holds], authorKind: "drafter", authorId: "test", bases: [] },
    nowMs: 2_500,
    supersedesIterationId: null,
    requestMessageId: "rA",
    runId: "rondo-lap-a",
    topicBranch: "rondo/lap-a",
    workspace: "/srv/work/lap-a",
  });
  expect(reserved.kind).toBe("reserved");
  for (const [from, to] of [
    ["planned", "admitting"],
    ["admitting", "admitted"],
    ["admitted", "performing"],
  ] as const) {
    expect((await store.transition("lap-a", from, to, {}, 2_600)).kind).toBe("transitioned");
  }

  const notThis = async () => await Promise.resolve({ ok: false, note: "not this route" });
  let presses = 0;
  const { base, stop, served } = await serving({
    ...portsOver({ connection, store, record }, "ada", []),
    scope: new ScopePort(notThis, notThis, null, async (input) => {
      presses += 1;
      return await startSplitFromPage(ENV, store, storePath, "ada", POLICY, input);
    }),
  });
  const logged: string[] = [];
  const never = async (): Promise<never> => {
    throw new Error("not asked in this test");
  };
  // `rondo web`'s order tick over the approved splits.
  const tick = orderHost({
    record,
    splits: async () => await approvedSplits({ record }),
    readiness: async (split, planIndex) =>
      await draftedStartReadiness(
        { store, record, policy: POLICY, nowMs: Date.now() },
        split.requestMessageId,
        split.scopeDecisionId,
        split.proposalId,
        planIndex,
      ),
    readHolder: never,
    start: async (split, planIndex) =>
      await startSplitFromPage(ENV, store, storePath, "ada", POLICY, {
        iterationId: `lap-part-${String(planIndex)}`,
        requestMessageId: split.requestMessageId,
        scopeDecisionId: split.scopeDecisionId,
        proposalId: split.proposalId,
        planIndex,
      }),
    held: null,
    now: Date.now,
    log: (line) => logged.push(line),
  });
  const scopePath = viewHref(
    { kind: "scope", messageId: "r1", rounds: null, decisionId: decision, plan: null },
    "en",
  );
  return {
    store,
    base,
    logged,
    runs: () => run,
    presses: () => presses,
    screen: async () => (await get(base, scopePath)).body.replaceAll("&#39;", "'"),
    thread: async () =>
      (
        await get(base, viewHref({ kind: "thread", messageId: "r1", to: null }, "en"))
      ).body.replaceAll("&#39;", "'"),
    pass: async () => {
      tick.kick();
      await tick.settled();
    },
    /** Line A to its gate and closed there, its reading at the commit it was cut from. */
    closeALeavingNothing: async () => {
      const at = "a".repeat(40);
      const gated = await store.transition("lap-a", "performing", "awaiting_human", {}, 3_000, {
        drafter: "rondo/deterministic/2",
        verdict: "concerns",
        findings: ["the topic branch is at the same commit as main, so this lap left nothing"],
        evidence: {
          baseRef: "refs/remotes/origin/main",
          baseCommit: at,
          tipCommit: at,
          materialDigest: "sha256:x",
          commitCount: 0,
          fileCount: 0,
        },
        unavailableReason: null,
      });
      expect(gated.kind, JSON.stringify(gated)).toBe("transitioned");
      const closed = await store.transition(
        "lap-a",
        "awaiting_human",
        "closed",
        { gateOutcome: "answered_and_forwarded" },
        3_100,
      );
      expect(closed.kind).toBe("transitioned");
    },
    stop: async () => {
      stop.abort();
      expect(await served).toBe(0);
    },
  };
}

/** The drafter's answer: one plan of r1's pasted template, claiming `claim`, resting on `basis`. */
function split(claim: readonly string[], basis = "r1"): DrafterRun {
  const document = planDocument();
  return {
    kind: "answered",
    costUsd: 0.05,
    finalMessage: JSON.stringify({
      act: "split",
      summary: { text: "One plan: the cost box.", bases: [basis] },
      plans: [
        {
          template_plan_digest: planDigest(document),
          agent_type_digest: agentTypeDigestOf(document),
          prompt: "Fix the scope screen's cost box.",
          bases: [basis],
          claim,
        },
      ],
    }),
  };
}

test(
  "rondo#553: a line closed at its gate that left nothing gives its files up, and the part it held starts with no press",
  async () => {
    const w = await world(["src/"], [split(CLAIM)]);
    try {
      // A runs: the part is held, named by its request, with no release to offer.
      await w.pass();
      expect(seams.admitted).toEqual([]);
      const running = await w.screen();
      expect(running).toContain(EN.planHeld(CLAIM));
      expect(running).toContain(HOLDER_WORDS);
      expect(running).not.toContain("?release=");

      // A is closed at its gate having left nothing, and nothing publishes it.
      await w.closeALeavingNothing();
      const finished = await w.screen();
      expect(finished).toContain(EN.planHeldFinished(CLAIM));
      expect(finished).toContain('href="/?release=lap-a&amp;lang=en"');

      // The tick attempts the part; reading A's holder releases it, and the
      // part starts -- no press, and no release pressed.
      await w.pass();
      expect(seams.admitted, w.logged.join("\n")).toEqual(["lap-part-0"]);
      expect((await w.store.read("lap-part-0")).kind).toBe("read");
      const ledger = await w.store.laneLedger();
      expect(ledger.find((line) => line.lineageId === "lap-a")).toMatchObject({
        paths: [],
        releasedBy: "rondo",
      });
      expect(ledger.find((line) => line.lineageId === "lap-part-0")?.paths).toEqual(CLAIM);
      expect(w.presses()).toBe(0);
      const started = await w.screen();
      expect(started).toContain(EN.planStarted);
      expect(started).not.toContain("?release=");
    } finally {
      await w.stop();
    }
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);

test(
  "rondo#554: a refused draft is drafted once more, and its start claims only its files and runs beside another line",
  async () => {
    // The first answer cites a message that is not in the thread (D-0071 rule
    // 7.1, as on lap 19); the second is a draft.
    const w = await world(["docs/"], [split(CLAIM, "r-not-in-the-thread"), split(CLAIM)]);
    try {
      expect(w.runs()).toBe(2);
      // The thread says which happened: refused, drafted once more -- and the
      // draft, not a request with none.
      const thread = await w.thread();
      expect(thread).toContain(EN.drafterRedrafted);
      expect(thread).not.toContain(EN.drafterNoDraft);

      // The person presses the part's start on the scope screen.
      const page = await w.screen();
      const form = page.slice(page.indexOf('action="/start-plan?lang=en"'));
      const fields = Object.fromEntries(
        [...form.slice(0, form.indexOf("</form>")).matchAll(/name="([^"]+)" value="([^"]*)"/g)].map(
          (m) => [m[1], m[2]],
        ),
      );
      const pressed = await post(
        w.base,
        { ...fields, token: tokenIn(page) },
        {},
        "/start-plan?lang=en",
      );
      expect(pressed.status).toBe(303);
      const iteration = String(fields["iteration"]);
      expect((await w.store.read(iteration)).kind).toBe("read");
      // Its drafted files and nothing else, beside A, which still runs.
      const ledger = await w.store.laneLedger();
      expect(ledger.find((line) => line.lineageId === iteration)).toMatchObject({
        paths: CLAIM,
        inFlight: true,
      });
      expect(ledger.find((line) => line.lineageId === "lap-a")).toMatchObject({
        paths: ["docs/"],
        inFlight: true,
      });
    } finally {
      await w.stop();
    }
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);

test("rondo#553: a finished line approved at its gate keeps its files though its issues closed: its publish is still owed", async () => {
  const connection = new DatabaseSync(
    join(mkdtempSync(join(tmpdir(), "rondo-claims-approved-")), "store.db"),
  );
  const store = iterationStore(connection, POLICY);
  const said = await advisoryRecord(connection).recordThreadMessage({
    messageId: "r1",
    body: "Fix it.",
    authorKind: "operator",
    authorId: "ada",
    inReplyTo: null,
    atMs: 500,
    bases: [],
    asks: false,
  });
  expect(said.kind).toBe("recorded");
  const planned = readRunPlan(planDocument());
  if (planned.kind !== "planned") throw new Error(planned.reason);
  // A line that changed something, closed at its gate: approved or not.
  const finish = async (id: string, answer: "approve" | null) => {
    const reserved = await store.reserve({
      numbers: null,
      id,
      request: "Fix it.",
      plan: admittedPayload(planned.plan, id),
      spend: null,
      scopeSpend: null,
      claim: { paths: [`${id}/`], authorKind: "drafter", authorId: "test", bases: [] },
      nowMs: 1_000,
      supersedesIterationId: null,
      requestMessageId: "r1",
      runId: `rondo-${id}`,
      topicBranch: `rondo/${id}`,
      workspace: `/srv/work/${id}`,
    });
    expect(reserved.kind).toBe("reserved");
    for (const [from, to] of [
      ["planned", "admitting"],
      ["admitting", "admitted"],
      ["admitted", "performing"],
    ] as const) {
      expect((await store.transition(id, from, to, {}, 1_100)).kind).toBe("transitioned");
    }
    const gated = await store.transition(
      id,
      "performing",
      "awaiting_human",
      { gateId: `g-${id}` },
      1_200,
      {
        drafter: "rondo/deterministic/2",
        verdict: "clear",
        findings: [],
        evidence: {
          baseRef: "refs/remotes/origin/main",
          baseCommit: "a".repeat(40),
          tipCommit: "c".repeat(40),
          materialDigest: "sha256:x",
          commitCount: 1,
          fileCount: 1,
        },
        unavailableReason: null,
      },
    );
    expect(gated.kind, JSON.stringify(gated)).toBe("transitioned");
    if (answer !== null) {
      await store.recordGateAnswer(id, `g-${id}`, answer, "ada", 1_300);
    }
    const closed = await store.transition(
      id,
      "awaiting_human",
      "closed",
      { gateOutcome: "answered_and_forwarded" },
      1_400,
    );
    expect(closed.kind).toBe("transitioned");
  };
  await finish("approved", "approve");
  await finish("answered", null);
  const conductor = await vi.importActual<typeof import("../../src/access/conductor.js")>(
    "../../src/access/conductor.js",
  );
  const lanes = {
    store,
    readLanding: async () => {
      throw new Error("no landing is read in this test");
    },
    readChangedPaths: async () => {
      throw new Error("no changed paths are read in this test");
    },
    remote: "origin",
    issuesClosed: async () => true,
  };
  // Approved and not yet pushed: the publish is still to come, so it holds.
  expect((await conductor.readHolder(lanes, "approved", 2_000)).released).toBe(false);
  // Not approved, left work, its issues closed: nothing will publish it.
  expect((await conductor.readHolder(lanes, "answered", 2_000)).released).toBe(true);
});
