/**
 * When the week's budget reading reaches the page at all (DECISIONS.md D-0207
 * rule 1), read from rows through the screen that derives it.
 *
 * **Why these go through the rendered page.** `page-logic/week.test.ts` holds
 * the arithmetic and `page/empty-side.test.ts` holds what the face draws once
 * it has been handed a bearing -- both by handing one in. Neither can say
 * whether the bearing a real store produces is the right one, and the condition
 * `D-0207` rule 1 states is about rows: a stop that happened, nothing running
 * after it, a request nobody has finished. So every case here writes those rows
 * and reads the answer off the markup the server would send.
 *
 * **The address is `requests` and not `summary`.** The right face is the week's
 * wherever the centre is empty, and the centre is the rule 4 question on the
 * way into a new request whatever is waiting (`src/access/web.tsx`). A gate or
 * a drafted scope waiting on the person takes the centre on `summary`, which is
 * D-0083 rule 3 working as intended -- and would leave half the states below
 * with no week face to assert against.
 */
import { expect, test } from "vitest";

import { drafterHost } from "../../src/access/drafter-host.js";
import { EN } from "../../src/access/wording.js";
import { contentDigest, planDigest } from "../../src/store/plan.js";
import type { JsonRecord } from "../../src/store/records.js";
import {
  planDocument as drafterPlanDocument,
  agentTypeDigestOf as drafterTypeOf,
  world as drafterWorld,
} from "./fixtures/drafter.js";
import { fresh, openGate, openRequest, operatorPage, portsOver, reserve } from "./page-world.js";

const REQUEST = "req-1";
const WORK = "make the CSV import faster";

/** The one budget these cases vary, as a scope payload carries it. */
const budgetsOf = (costUsd: number, reserveUsd = 2.5) => ({
  laps: 3,
  review_rounds: 3,
  cost_usd: costUsd,
  cost_reserve_usd: reserveUsd,
  expires_at_ms: 9e15,
});

/** The agent type the scope lists, recorded with it so rondo holds it (D-0069 section 1). */
const AGENT_TYPE = `sha256:${"a".repeat(64)}`;

const scopePayload = (costUsd: number, reserveUsd?: number): JsonRecord => ({
  requests: [REQUEST],
  workspaces: [{ repository: "/srv/repo", workspace_root: "/srv/work" }],
  agent_types: [AGENT_TYPE],
  budgets: budgetsOf(costUsd, reserveUsd),
  severity_threshold: "major",
  outward_acts: ["push_branch"],
  irreversible_additions: [],
});

/**
 * A request with one approved scope over it.
 *
 * The laps are then admitted under it by `admit` below, as
 * `test/access/raise.test.ts` writes an admission row: nothing here runs
 * continuo, and a reserve that took the store's own scope tests would be
 * asserting those tests rather than this screen's reading.
 */
async function world(costUsd = 5, reserveUsd?: number) {
  const w = fresh();
  await openRequest(w, REQUEST, WORK, 2_000);
  const payload = scopePayload(costUsd, reserveUsd);
  expect(
    await w.record.recordScope({
      scopeId: "s-1",
      payload,
      supersedesScopeId: null,
      authorKind: "operator",
      authorId: "ada",
      bases: [],
      createdAtMs: 2_000,
      // Recorded with the scope, which is how an operator's scope comes to
      // list a type rondo holds (D-0066 rule 1.2.3).
      agentTypeRecords: [
        {
          agentTypeDigest: AGENT_TYPE,
          agentTypeInput: { name: "rondo-lap" },
          planDigest: `sha256:${"b".repeat(64)}`,
        },
      ],
    }),
  ).toEqual({ kind: "recorded" });
  expect(
    await w.record.recordScopeDecision({
      scopeDecisionId: "sd-1",
      scopeId: "s-1",
      scopeDigest: contentDigest(payload),
      outcome: "approved",
      actorId: "ada",
      recordedBy: "rondo/web",
      decidedAtMs: 2_000,
    }),
  ).toEqual({ kind: "recorded" });
  return w;
}

/** The `scope_consumption` row an admission under the approval writes. */
function admit(w: ReturnType<typeof fresh>, iterationId: string): void {
  w.connection
    .prepare(
      "INSERT INTO scope_consumption (scope_decision_id, act_kind, subject_id, proposal_id, " +
        "consumed_at_ms) VALUES ('sd-1', 'admission', ?, NULL, 2500)",
    )
    .run(iterationId);
}

/** A lap of the request, walked to `performing`: the state nothing has stopped. */
async function working(w: ReturnType<typeof fresh>, id: string): Promise<void> {
  await reserve(w, id, WORK, null, REQUEST);
  admit(w, id);
  for (const [from, to] of [
    ["planned", "admitting"],
    ["admitting", "admitted"],
    ["admitted", "performing"],
  ] as const) {
    expect((await w.store.transition(id, from, to, {}, 3_000)).kind).toBe("transitioned");
  }
}

/**
 * A lap of the request whose work a person took in at its gate: reserved,
 * admitted, walked to its gate and closed on *approve*.
 *
 * Nothing about its budget is written, so the one thing it is in these cases is
 * an ending -- which is what a stop beside it is read against.
 */
async function takenIn(w: ReturnType<typeof fresh>, id: string, closedAtMs: number): Promise<void> {
  await reserve(w, id, WORK, null, REQUEST);
  admit(w, id);
  await openGate(w, id);
  expect(
    (
      await w.store.transition(
        id,
        "awaiting_human",
        "closed",
        { gateOutcome: "approve" },
        closedAtMs,
      )
    ).kind,
  ).toBe("transitioned");
}

/**
 * The page the week's face is on, with every lap read as admitted under the
 * approval -- which is `portsOver`'s own stand-in for the admitting row
 * (rondo#233 S4).
 */
const page = async (w: ReturnType<typeof fresh>): Promise<string> =>
  await operatorPage(portsOver(w, "ada", [], null, "sd-1"), "t", { kind: "requests" });

/** What the face says where the week's money is drawn, and what it never says. */
const BUDGET_WORDS = [EN.weekBudgetHeldUp, EN.weekBudgetYours];
const FIGURES = [EN.weekSpentFigure, EN.weekLeft, EN.weekAllowance, EN.weekNoAllowance];

/**
 * The whole week's reading withheld: neither reason, and none of the figures
 * that only it draws.
 *
 * **A request's own allowance is not the week's** (`D-0207` rule 2), so the
 * card under *work under way* keeps its own pair and the money on it is not
 * evidence against this. Where nothing is running, nothing on the face reads in
 * dollars at all, and the cases that leave it empty say so themselves.
 */
function expectWithheld(html: string): void {
  for (const said of [...BUDGET_WORDS, ...FIGURES]) expect(html).not.toContain(said);
  // Rule 4: the face is shorter, not gone -- the rest of the seven days stands.
  for (const said of [EN.sevenDays, EN.weekAsked, EN.weekFinished]) expect(html).toContain(said);
}

test("a lap its own spend cap stopped, with nothing running after it, puts the week's money on the face", async () => {
  // D-0121's stop, at the gate the lap reached having spent all the room its
  // scope left it: the person's next move is a larger budget, so rule 1 draws
  // the figures and says which of the two reasons it is here for.
  const w = await world(5);
  await reserve(w, "i-0001", WORK, null, REQUEST);
  admit(w, "i-0001");
  await openGate(w, "i-0001");
  expect(
    (
      await w.store.transition(
        "i-0001",
        "awaiting_human",
        "awaiting_human",
        { lapCostUsd: 5, lapBudgetCapUsd: 5 },
        3_000,
      )
    ).kind,
  ).toBe("transitioned");
  const html = await page(w);
  expect(html).toContain(EN.weekBudgetHeldUp);
  expect(html).toContain(EN.weekBudgetHeldUpNext);
  expect(html).not.toContain(EN.weekBudgetYours);
  // Rule 3: where it is drawn, the pair is the approvals in force as before.
  expect(html).toContain("$5.00 of $5.00");
});

test("a lap the budget refused to send puts it there too, with every lap of its request ended", async () => {
  // The other half of D-0121 rule 5: no room was left, so the lap was never
  // sent and ends `failed`. Every lap of the request is then terminal, which is
  // the state "a request still being worked on" read as finished -- and it is
  // the case rule 1 names first.
  const w = await world(5);
  await working(w, "i-0001");
  expect(
    (
      await w.store.transition(
        "i-0001",
        "performing",
        "failed",
        {
          failureKind: "budget",
          reason: "LapBudgetExhausted",
          lapCostUsd: 0,
          lapBudgetCapUsd: -1,
        },
        4_000,
      )
    ).kind,
  ).toBe("transitioned");
  const html = await page(w);
  expect(html).toContain(EN.weekBudgetHeldUp);
  expect(html).toContain(EN.weekBudgetHeldUpNext);
});

test("a budget refusal with no cost or cap read on the row is still a stop", async () => {
  // The other spelling of D-0121 rule 5 on its own. The `cost` scope test can
  // refuse to send a lap before anything of its own has been read, which
  // leaves `failed` with `failureKind: "budget"` and no pair for
  // `reachedBudgetCap` to compare -- so the kind of failure is the only thing
  // this stop can be recognised by, and the person's next move is the same
  // larger budget.
  const w = await world(5);
  await working(w, "i-0001");
  expect(
    (
      await w.store.transition(
        "i-0001",
        "performing",
        "failed",
        { failureKind: "budget", reason: "LapBudgetExhausted" },
        4_000,
      )
    ).kind,
  ).toBe("transitioned");
  const stopped = await w.store.read("i-0001");
  expect(stopped.kind).toBe("read");
  if (stopped.kind === "read") {
    // The row the reading is derived from: neither figure is there to compare.
    expect(stopped.record.lapCostUsd).toBeNull();
    expect(stopped.record.lapBudgetCapUsd).toBeNull();
  }
  const html = await page(w);
  expect(html).toContain(EN.weekBudgetHeldUp);
  expect(html).toContain(EN.weekBudgetHeldUpNext);
});

test("a stop after an earlier lap was taken in stays on the face, and a later closing takes it off", async () => {
  // Whether a stop has been answered is asked of the stop. A request whose
  // first lap was taken in and whose follow-up work then ran out of budget is
  // stopped now, and reading *finished* over the whole request would have let
  // the older closing answer the newer stop -- the one state rule 1 names
  // first, drawn for no request at all.
  const w = await world(5);
  await takenIn(w, "i-0001", 4_000);
  expectWithheld(await page(w));
  await working(w, "i-0002");
  expect(
    (
      await w.store.transition(
        "i-0002",
        "performing",
        "failed",
        { failureKind: "budget", reason: "LapBudgetExhausted", lapCostUsd: 5, lapBudgetCapUsd: 5 },
        5_000,
      )
    ).kind,
  ).toBe("transitioned");
  const html = await page(w);
  expect(html).toContain(EN.weekBudgetHeldUp);
  expect(html).toContain(EN.weekBudgetHeldUpNext);
  // And an ending *after* the stop is what answers it: the raise was pressed,
  // the next lap ran, and its work was taken in.
  await takenIn(w, "i-0003", 6_000);
  expectWithheld(await page(w));
});

test("an approval whose room is spoken for by a lap still running is no budget holding work up", async () => {
  // The reading this entry's first draft got wrong. $2.50 approved with $2.50
  // held for the one lap whose cost is not read yet leaves nothing -- and
  // nothing has been refused: the hold is a guess made before the lap ran
  // (`page-logic/governance.ts`), and the work is going fine. A person asked
  // to raise a budget here would be answering a question nobody has asked.
  const w = await world(2.5, 2.5);
  await working(w, "i-0001");
  const html = await page(w);
  expectWithheld(html);
  // And the running request's own pair is untouched (rule 2): the hold the
  // week would have called a stop is still said where the work is.
  expect(html).toContain("of $2.50");
});

test("once the work is going again, the stop that was answered comes off the face", async () => {
  // The raise was pressed and a lap is running under the request: the budget
  // was holding work up and is not now, and the stop on the older row stays
  // written there for ever.
  const w = await world(5);
  await working(w, "i-0001");
  expect(
    (
      await w.store.transition(
        "i-0001",
        "performing",
        "failed",
        { failureKind: "budget", reason: "LapBudgetExhausted", lapCostUsd: 5, lapBudgetCapUsd: 5 },
        4_000,
      )
    ).kind,
  ).toBe("transitioned");
  expect(await page(w)).toContain(EN.weekBudgetHeldUp);
  await working(w, "i-0002");
  expectWithheld(await page(w));
});

test("a request whose work was taken in draws no budget, however it was stopped on the way", async () => {
  // A cap that stopped a lap is written on its row for ever, so a request
  // raised after it and since finished would otherwise keep the week's money
  // on this face for the rest of the window.
  const w = await world(5);
  await reserve(w, "i-0001", WORK, null, REQUEST);
  admit(w, "i-0001");
  await openGate(w, "i-0001");
  expect(
    (
      await w.store.transition(
        "i-0001",
        "awaiting_human",
        "closed",
        { gateOutcome: "approve", lapCostUsd: 5, lapBudgetCapUsd: 5 },
        4_000,
      )
    ).kind,
  ).toBe("transitioned");
  const html = await page(w);
  expectWithheld(html);
  // Nothing is running either, so no figure on the face reads in dollars.
  expect(html).not.toContain("$");
});

test("a scope waiting to be approved draws the week's money as the person's to decide", async () => {
  // Rule 1's second case, and the one state the figures are drawn in with
  // nothing stopped: a scope is where a budget is set, so the decision is
  // theirs. The drafted scope is written the way the drafter host writes one,
  // because what makes it a wait is the draft nobody has decided.
  const w = await draftedRequest();
  const html = await operatorPage(portsOver(w, "ada", []), "t", { kind: "requests" });
  expect(html).toContain(EN.weekBudgetYours);
  expect(html).toContain(EN.weekBudgetYoursNext);
  expect(html).not.toContain(EN.weekBudgetHeldUp);
  // No approval reads for a draft nobody has approved, so rule 6's sentence
  // stands for the pair rather than a spend nobody agreed to.
  expect(html).toContain(EN.weekNoAllowance);
});

test("a request with nothing stopped and no scope waiting draws no budget at all", async () => {
  // The ordinary case: an approval with room left and a lap going fine. Not a
  // null figure inside a drawn reading -- the whole reading is withheld, and
  // rule 4 puts nothing in its place.
  const w = await world(50);
  await working(w, "i-0001");
  expectWithheld(await page(w));
});

/**
 * A request the model drafter drafted one plan for, waiting on the person's
 * approval -- `test/access/web-scope-underway.test.ts`'s fixture, narrowed to
 * the one state this file needs.
 */
async function draftedRequest() {
  const w = await drafterWorld();
  const document = drafterPlanDocument();
  await w.say("r1", "Two things, please.", null, 1_000);
  await w.say("r1-plan", JSON.stringify(document), "r1", 1_100);
  let n = 0;
  const host = drafterHost({
    store: w.store,
    record: w.record,
    now: () => 1_500,
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
        summary: { text: "One plan.", bases: ["r1"] },
        plans: [
          {
            template_plan_digest: planDigest(document),
            agent_type_digest: drafterTypeOf(document),
            prompt: "Fix the scope screen cost box.",
            bases: ["r1"],
            claim: ["/"],
          },
        ],
        narrowings: [],
      }),
    }),
  });
  host.kick();
  await host.idle();
  return w;
}
