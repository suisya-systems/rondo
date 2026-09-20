import { expect, test } from "vitest";

import { draftedStanding } from "../../src/access/drafted-view.js";
import { drafterHost } from "../../src/access/drafter-host.js";
import type {} from "../../src/access/inbox.js";
import { forgeBody, ISSUE_READER, namedIssues } from "../../src/access/issue-read.js";
import { draftedPlanRun } from "../../src/access/model-drafter.js";
import type { ServedPorts } from "../../src/access/web-app.js";
import { type Chrome, chromeFor, EN } from "../../src/access/wording.js";
import { allocate } from "../../src/refrain/allocator.js";
import { admittedPlan, planPayload } from "../../src/refrain/plan.js";
import { planDigest } from "../../src/store/plan.js";
import { ownLane } from "../lane-claims.js";
import {
  planDocument as drafterPlanDocument,
  agentTypeDigestOf as drafterTypeOf,
  world as drafterWorld,
} from "./fixtures/drafter.js";
import {
  fresh,
  mint,
  openGate,
  operatorPage,
  portsOver,
  reserve,
  seedScopeRequest,
} from "./page-world.js";

/** More ended laps than the summary's "what just finished" window holds. */
const RECENT_ENDED_OVERFLOW = 6;

/** A lap that is running: reserved and walked as far as `performing`. */
async function runningLap(
  world: ReturnType<typeof fresh>,
  id: string,
  request: string,
): Promise<void> {
  await reserve(world, id, request);
  for (const [from, to] of [
    ["planned", "admitting"],
    ["admitting", "admitted"],
    ["admitted", "performing"],
  ] as const) {
    const moved = await world.store.transition(id, from, to, {}, 2_000);
    expect(moved.kind).toBe("transitioned");
  }
}

test("a request with a lap under it says the lap's state instead of offering the scope again (#244)", async () => {
  const world = fresh();
  const requestId = "request-running";
  await seedScopeRequest(world, requestId, "Fix the flaky test, please.");
  await runningLap(world, "i-0001", "Fix the flaky test, please.");
  world.connection
    .prepare("UPDATE iteration SET request_message_id = ? WHERE id = ?")
    .run(requestId, "i-0001");
  const ports = portsOver(world, "ada", []);

  // **The list says the lap's state** (D-0083 rule 5): one sentence, no lap id
  // and no status enum. The *Set the scope* entrance that used to sit on the
  // row went with the old list -- D-0083's row carries the person's words, the
  // repository and one sentence, and nothing to press.
  const live = await operatorPage(ports, "t", { kind: "requests" });
  const row = live.slice(live.indexOf("Fix the flaky test, please."));
  expect(row).toContain("Working on it");
  expect(live).not.toContain("Set the scope");

  // **And comes back when the lap has ended**: asking for more work on an
  // answered request is a real act, and the row says what became of the first.
  const closed = await world.store.transition(
    "i-0001",
    "performing",
    "closed",
    { gateOutcome: "approve" },
    5_000,
  );
  expect(closed.kind).toBe("transitioned");
  const after = await operatorPage(ports, "t", { kind: "requests" });
  const ended = after.slice(after.indexOf("Fix the flaky test, please."));
  expect(ended).toContain("Finished");

  // **The summary's five-row window is the summary's** (Codex round 1). The
  // requests list is not bounded, so a lap that has dropped out of *what just
  // finished* must still be what its request says about itself -- otherwise a
  // recorded outcome quietly becomes "nobody has started anything".
  for (let n = 0; n < RECENT_ENDED_OVERFLOW; n += 1) {
    const id = `i-other-${String(n)}`;
    await reserve(world, id, "another request entirely");
    const moved = await world.store.transition(id, "planned", "abandoned", {}, 6_000 + n);
    expect(moved.kind).toBe("transitioned");
  }
  const later = await operatorPage(ports, "t", { kind: "requests" });
  const pushedOut = later.slice(later.indexOf("Fix the flaky test, please."));
  expect(pushedOut).toContain("Finished");

  // **A live lap speaks for its request over a terminal one, however new**
  // (Codex round 2). A retry can end while the lap it supersedes is still at
  // its gate; going by age alone would have shown only the ending and brought
  // the entrance back over work that is still live.
  await reserve(world, "i-0002", "Fix the flaky test, please.");
  await openGate(world, "i-0002");
  world.connection
    .prepare("UPDATE iteration SET request_message_id = ? WHERE id = ?")
    .run(requestId, "i-0002");
  const failed = await world.store.transition("i-0001", "closed", "closed", {}, 9_000);
  expect(failed.kind).toBe("transitioned");
  const alive = await operatorPage(ports, "t", { kind: "requests" });
  const stillLive = alive.slice(alive.indexOf("Fix the flaky test, please."));
  expect(stillLive).toContain("Waiting on your answer");

  // A request nobody has started anything for says that, and not a state it
  // does not have.
  await seedScopeRequest(world, "request-idle", "And this one too, some time.");
  const both = await operatorPage(ports, "t", { kind: "requests" });
  const idle = both.slice(both.indexOf("And this one too, some time."));
  expect(idle).toContain("Not started yet");
});

test("the sentence that says a second start press is safe is in both catalogues (#244)", () => {
  // Half-translated is worse than untranslated here: a Japanese page would
  // fall into English in the middle of the one paragraph beside the press.
  expect(EN.startAgainSafe).not.toBe("");
  expect(chromeFor("ja").startAgainSafe).not.toBe(EN.startAgainSafe);
  expect(chromeFor("ja").startAgainSafe).toContain("2 回目の押下は 1 回目にまとめられ");
});

const DRAFTED_PROMPTS = ["Fix the scope screen cost box.", "Title-case the approve button."];

/**
 * A request the model drafter drafted into two plans over a pasted plan, the
 * way the host writes one (rondo#238 C2b), in memory; `narrow` adds the
 * person's "keep it under $3" and the drafter's narrowing on it.
 */
async function draftedRequest(narrow = false) {
  const w = await drafterWorld();
  const document = drafterPlanDocument();
  await w.say("r1", "Two things, please.", null, 1_000);
  await w.say("r1-plan", JSON.stringify(document), "r1", 1_100);
  if (narrow) {
    await w.say("r1-cap", "Keep it under $3.", "r1", 1_200);
  }
  const typeDigest = drafterTypeOf(document);
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
        summary: { text: "Two plans.", bases: ["r1"] },
        plans: DRAFTED_PROMPTS.map((prompt) => ({
          template_plan_digest: planDigest(document),
          agent_type_digest: typeDigest,
          prompt,
          bases: ["r1"],
          claim: ["/"],
        })),
        narrowings: narrow ? [{ field: "cost_usd", value: 3, basis: "r1-cap" }] : [],
      }),
    }),
  });
  host.kick();
  await host.idle();
  const scopeId = (
    w.connection.prepare("SELECT scope_id FROM scope WHERE author_kind = 'drafter'").get() as {
      scope_id: string;
    }
  ).scope_id;
  const proposalId = (
    w.connection.prepare("SELECT proposal_id FROM proposal WHERE kind = 'split'").get() as {
      proposal_id: string;
    }
  ).proposal_id;
  const read = await w.record.readScope(scopeId);
  if (read.kind !== "read") throw new Error("the drafted scope did not read");
  return { ...w, draft: read.scope, proposalId };
}

const scopeScreen = (decisionId: string | null) =>
  ({ kind: "scope", messageId: "r1", rounds: null, decisionId, plan: null }) as const;

test("a drafted request's scope screen is the draft: its plans, its values in the boxes, and one approve press (rondo#238 C2b)", async () => {
  const w = await draftedRequest();
  const ports = portsOver(w, "ada", []);
  const budgets = w.draft.payload.budgets;
  for (const wording of [EN, chromeFor("ja")]) {
    const page = await operatorPage(
      ports,
      "t",
      scopeScreen(null),
      wording,
      mint,
      () => "scope-x",
      () => "lap-y",
    );
    expect(page).toContain(wording.scopeDraftedLead);
    expect(page).toContain('id="scope-draft-form"');
    expect(page).not.toContain('id="scope-form"');
    expect(page).toContain(`action="/scope-draft?lang=${wording.lang}"`);
    expect(page).toContain(`<input type="hidden" name="draft_scope" value="${w.draft.scopeId}"/>`);
    expect(page).toContain(
      `<input type="hidden" name="draft_digest" value="${w.draft.scopeDigest}"/>`,
    );
    expect(page).toContain('id="drafted-plans"');
    for (const prompt of DRAFTED_PROMPTS) {
      expect(page).toContain(prompt);
    }
    expect(page).toContain(`value="${String(budgets.laps)}"`);
    expect(page).toContain(`value="${budgets.cost_usd.toFixed(2)}"`);
    expect(page).toContain(wording.scopeDraftedAction);
    // Nothing narrowed, so nothing says it was.
    expect(page).not.toContain(wording.scopeNarrowed(budgets.cost_usd.toFixed(2)));
  }
});

test("a narrowed drafted value says what it was computed as, and links the person's words it rests on (rondo#238 C2b)", async () => {
  const w = await draftedRequest(true);
  const standing = await draftedStanding(w, "r1");
  if (standing.kind !== "drafted") throw new Error(standing.kind);
  const computed = standing.drafted.computed.cost_usd.value.toFixed(2);
  const page = await operatorPage(
    portsOver(w, "ada", []),
    "t",
    scopeScreen(null),
    EN,
    mint,
    () => "scope-x",
    () => "lap-y",
  );
  expect(page).toContain('value="3.00"');
  expect(page).toContain(EN.scopeNarrowed(computed));
  // To the thread view at that message: the scope screen draws no messages,
  // so a bare anchor would lead nowhere.
  expect(page).toContain('href="/?thread=r1-cap&amp;lang=en#r1-cap"');
  expect(page).not.toContain('href="#r1-cap"');
});

test("an approved drafted scope offers each plan its own start, and says so where one cannot start (rondo#238 C2b)", async () => {
  const w = await draftedRequest();
  const decided = await w.record.recordScopeDecision({
    scopeDecisionId: "decision-draft",
    scopeId: w.draft.scopeId,
    scopeDigest: w.draft.scopeDigest,
    outcome: "approved",
    actorId: "ada",
    recordedBy: "test",
    decidedAtMs: 2_000,
  });
  expect(decided.kind).toBe("recorded");
  const ports = portsOver(w, "ada", []);
  const render = async (p: ServedPorts, wording: Chrome = EN) =>
    await operatorPage(
      p,
      "t",
      scopeScreen("decision-draft"),
      wording,
      mint,
      () => "scope-x",
      () => "lap-y",
    );
  const starts = (page: string) => page.split('action="/start-plan?lang=').length - 1;

  const ready = await render(ports);
  expect(ready).toContain('id="drafted-plans"');
  expect(starts(ready)).toBe(2);
  expect(ready).toContain('<input type="hidden" name="plan_index" value="0"/>');
  expect(ready).toContain('<input type="hidden" name="plan_index" value="1"/>');
  expect(ready).toContain(`<input type="hidden" name="proposal" value="${w.proposalId}"/>`);
  // The person's held-plan start is not drawn under a drafted scope.
  expect(ready).not.toContain('id="start-form"');

  // A lap admitted from plan 0 exactly: plan 0 is started, and plan 1 -- which
  // claims the whole repository too -- is held by it (D-0073 rule 3.1): the
  // reason and the work holding it by its request, and no press while that
  // work is still running, since it cannot have landed.
  const run = await draftedPlanRun(w, "r1", w.proposalId, 0);
  if (run.kind !== "runnable") throw new Error(run.reason);
  const allocation = allocate("lap-plan-0", run.plan.workspaceRoot);
  if (allocation.kind !== "allocated") throw new Error(allocation.reason);
  const admitted = admittedPlan(run.plan, allocation.allocation);
  if (admitted.kind !== "planned") throw new Error(admitted.reason);
  const reserved = await w.store.reserve({
    id: "lap-plan-0",
    request: "Two things, please.",
    plan: planPayload(admitted.plan),
    spend: null,
    scopeSpend: null,
    claim: ownLane("lap-plan-0"),
    nowMs: 3_000,
    supersedesIterationId: null,
    requestMessageId: "r1",
    runId: "rondo-lap-plan-0",
    topicBranch: "rondo/lap-plan-0",
    workspace: "/srv/work/lap-plan-0",
  });
  expect(reserved.kind).toBe("reserved");
  const once = await render(ports);
  expect(starts(once)).toBe(0);
  expect(once).toContain(EN.planStarted);
  expect(once).toContain(`#${encodeURIComponent("lap-lap-plan-0")}`);
  expect(once.replaceAll("&#39;", "'")).toContain(EN.planHeld(["/"]));
  expect(once).toContain(EN.planHeldBy);
  expect(once).toContain("Two things, please.");
  expect(once).not.toContain(EN.planHeldTry);
  expect(once).not.toContain("?release=");

  // No room: the reason, and no button to press.
  const full = await render({ ...ports, policy: { maxOccupying: 4, maxLive: 1 } });
  expect(starts(full)).toBe(0);
  expect(full).toContain(EN.planFull(1, 1));

  // The scope's own test says no -- expired -- in words, in both languages.
  const late = { ...ports, now: () => 9_000_000_000_000 };
  for (const wording of [EN, chromeFor("ja")]) {
    const expired = await render(late, wording);
    expect(starts(expired)).toBe(0);
    expect(expired).toContain(wording.planOutside("expiry"));
    expect(expired).not.toContain("expiry test");
  }

  // Plan 0's work finishes without being found on the default branch: plan 1
  // is still held, said as held by finished work, and now both the start
  // (which reads that landing first, D-0073 rule 7) and the release are drawn.
  for (const [from, to] of [
    ["planned", "admitting"],
    ["admitting", "admitted"],
    ["admitted", "performing"],
    ["performing", "awaiting_human"],
  ] as const) {
    expect((await w.store.transition("lap-plan-0", from, to, {}, 4_000)).kind).toBe("transitioned");
  }
  expect(
    (
      await w.store.transition(
        "lap-plan-0",
        "awaiting_human",
        "closed",
        { gateOutcome: "approve" },
        5_000,
      )
    ).kind,
  ).toBe("transitioned");
  const finished = (await render(ports)).replaceAll("&#39;", "'");
  expect(finished).toContain(EN.planHeldFinished(["/"]));
  expect(finished).not.toContain(EN.planHeld(["/"]));
  expect(finished).toContain(EN.planHeldTry);
  expect(starts(finished)).toBe(1);
  expect(finished).toContain("/?release=lap-plan-0&amp;lang=en");
});

test("what rondo read of a named issue is said under the message, and the scope screen says which the worker is given (D-0078 section 4)", async () => {
  const world = fresh();
  const requestId = "request-issues";
  await seedScopeRequest(world, requestId, "Fix #237, #404 and #9.");
  const read = async (messageId: string, body: string) => {
    const outcome = await world.record.recordThreadMessage({
      messageId,
      body,
      authorKind: "forge",
      authorId: ISSUE_READER,
      inReplyTo: requestId,
      atMs: 2_000,
      bases: [],
      asks: false,
    });
    if (outcome.kind !== "recorded") throw new Error(JSON.stringify(outcome));
  };
  await read(
    "forge-237",
    forgeBody({
      named: "#237",
      atMs: 2_000,
      read: {
        url: "https://github.com/o/r/issues/237",
        number: 237,
        pullRequest: false,
        title: "The worker cannot read issues",
        state: "open",
        author: "bob",
        openedAt: "2026-09-01T00:00:00Z",
        body: "Item one.\nItem two.",
        comments: [{ author: "cy", at: "2026-09-02T00:00:00Z", body: "Item one is done." }],
      },
    }),
  );
  await read(
    "forge-404",
    forgeBody({
      named: "#404",
      atMs: 2_000,
      failed: { why: "missing", detail: "gh api repos/o/r/issues/404: gh: Not Found (HTTP 404)" },
    }),
  );
  const ports = {
    ...portsOver(world, "ada", []),
    // #9 is still to be read.
    issuesUnread: async () => new Map([[requestId, namedIssues("#9")]]),
  };
  const thread = await operatorPage(
    ports,
    "t",
    { kind: "thread", messageId: requestId, to: null },
    EN,
    mint,
    () => "x",
    () => "y",
  );
  const card = thread.slice(thread.indexOf('id="forge-237"'));
  expect(card).toContain('href="https://github.com/o/r/issues/237"');
  expect(card).toContain("The worker cannot read issues");
  expect(card).toContain(EN.issueRead(false, 1));
  expect(card.indexOf("<details")).toBeLessThan(card.indexOf("Item one is done."));
  // Signed as rondo, never as the reader's row name, and never as its JSON.
  expect(card.slice(0, card.indexOf("</header>"))).toContain(">rondo</span>");
  expect(thread).not.toContain("rondo_issue_read");
  const failed = thread.slice(thread.indexOf('id="forge-404"'));
  expect(failed).toContain(EN.issueNotRead("missing"));
  expect(failed).toContain(EN.issueNotReadTail);
  expect(failed.indexOf("<details")).toBeLessThan(failed.indexOf("HTTP 404"));
  expect(thread).toContain(EN.issuePending);

  const scope = await operatorPage(
    ports,
    "t",
    { kind: "scope", messageId: requestId, rounds: null, decisionId: null, plan: null },
    EN,
    mint,
    () => "x",
    () => "y",
  );
  const issues = scope.slice(scope.indexOf("scope-issues"), scope.indexOf("</section>"));
  expect(issues).toContain(EN.scopeIssuesHeading);
  expect(issues).toMatch(/data-issue="given".*#237.*given to the worker/s);
  expect(issues).toMatch(/data-issue="not-given".*#404/s);
  expect(issues).toMatch(/data-issue="pending".*#9/s);

  // #237 named again and not read yet: said as pending, not as its older read.
  const again = await operatorPage(
    { ...ports, issuesUnread: async () => new Map([[requestId, namedIssues("#237 #9")]]) },
    "t",
    { kind: "scope", messageId: requestId, rounds: null, decisionId: null, plan: null },
    EN,
    mint,
    () => "x",
    () => "y",
  );
  const pendingAgain = again.slice(again.indexOf("scope-issues"), again.indexOf("</section>"));
  expect(pendingAgain).not.toContain('data-issue="given"');
  expect(pendingAgain).toMatch(/data-issue="pending".*#237/s);

  const ja = await operatorPage(
    ports,
    "t",
    { kind: "thread", messageId: requestId, to: null },
    chromeFor("ja"),
    mint,
    () => "x",
    () => "y",
  );
  expect(ja).toContain(chromeFor("ja").issueNotRead("missing"));
  expect(ja).toContain(chromeFor("ja").issuePending);
});
