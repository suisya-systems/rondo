/**
 * The scope card waits for rondo's draft (rondo#495, lap 18).
 *
 * Right after the owner sent a request the thread showed the amber *set the
 * scope* card while the drafter had only read the linked issue; the draft came
 * 43 seconds later. A scope pressed then is one decided without rondo's plan.
 * These hold the three surfaces that say whose turn it is -- the card at the
 * top of the thread, the right face's steps and the list's row -- to one
 * reading of whether rondo still owes the draft.
 */
import { expect, test } from "vitest";

import { drafterHost } from "../../src/access/drafter-host.js";
import { explainerHost } from "../../src/access/explainer/host.js";
import { gatherExplainerMaterial } from "../../src/access/explainer/material.js";
import type { WebPorts } from "../../src/access/page/contract.js";
import { PAGE_EN } from "../../src/access/page/words.js";
import { REACH_SUBJECT, reachThePerson } from "../../src/access/reach.js";
import { EN } from "../../src/access/wording.js";
import { planDigest } from "../../src/store/plan.js";
import { agentTypeDigestOf, world as drafterWorld, planDocument } from "./fixtures/drafter.js";
import {
  fresh,
  openGate,
  openRequest,
  operatorPage,
  portsOver,
  recordAnswer,
  reserve,
} from "./page-world.js";

const threadOf = (messageId: string) => ({ kind: "thread" as const, messageId, to: null });

const owing = (world: ReturnType<typeof fresh>, owed: () => Promise<ReadonlySet<string>>) =>
  ({ ...portsOver(world), draftsOwed: owed }) satisfies WebPorts;

/** The card at the top of the thread, from its section to its end. */
function nextCard(html: string): string {
  const at = html.indexOf('class="next-step');
  expect(at).toBeGreaterThan(-1);
  const start = html.lastIndexOf("<section", at);
  return html.slice(start, html.indexOf("</section>", start));
}

test("while rondo owes the draft, the thread says it is rondo's turn and offers no scope", async () => {
  const world = fresh();
  await openRequest(world, "req-1", "Do #200, please.");
  const html = await operatorPage(
    owing(world, async () => new Set(["req-1"])),
    "t",
    threadOf("req-1"),
  );
  const card = nextCard(html);
  expect(card).toContain(EN.nextStepRondoHeading);
  expect(card).toContain(EN.nextStepDrafting);
  // Not amber, and nothing to press: neither the filled card nor the outlined way.
  expect(card).not.toContain("border-wait");
  expect(html).not.toContain(EN.nextStepHeading);
  expect(html).not.toContain('id="scope-req-1"');
  // The right face agrees: the plan and its scope are under way, and not yours.
  expect(html).toMatch(
    new RegExp(`side-step-waiting[^>]*><span>${PAGE_EN.stepScope}</span><b>${PAGE_EN.stepNow}`),
  );
  // And the list's row says rondo is on it, outside *your turn*.
  expect(html).toContain(PAGE_EN.rowDrafting);
  expect(html).not.toContain("list-row-mine");
});

test("once nothing is owed, the scope card appears, marked for the redraw's wash (rondo#494)", async () => {
  const world = fresh();
  await openRequest(world, "req-1", "add a retry budget");
  const html = await operatorPage(
    owing(world, async () => new Set()),
    "t",
    threadOf("req-1"),
  );
  const card = nextCard(html);
  expect(card).toContain('data-can-act="next"');
  expect(card).toContain(EN.nextStepScope);
  expect(html).toContain('id="scope-req-1"');
  expect(html).toMatch(
    new RegExp(`side-step-yours[^>]*><span>${PAGE_EN.stepScope}</span><b>${PAGE_EN.stepYours}`),
  );
  expect(html).not.toContain(PAGE_EN.rowDrafting);
  expect(html).toContain(PAGE_EN.rowNotStarted);
});

test("a drafter that drafted nothing hands the scope to the person, saying so (rondo#495 item 2)", async () => {
  const world = fresh();
  await openRequest(world, "req-1", "Do #200, please.");
  const said = await world.record.recordThreadMessage({
    messageId: "drafter-1",
    body: "rondo's drafter wrote no draft for this: claude -p exited 1",
    authorKind: "drafter",
    authorId: "rondo/drafter/6/claude-opus-5",
    inReplyTo: "req-1",
    atMs: 600,
    bases: [{ form: "message", messageId: "req-1" }],
    asks: false,
  });
  expect(said.kind).toBe("recorded");
  const html = await operatorPage(
    owing(world, async () => new Set()),
    "t",
    threadOf("req-1"),
  );
  const card = nextCard(html);
  expect(card).toContain(EN.nextStepNoDraft);
  expect(card).not.toContain(EN.nextStepScope);
  expect(html).toContain('id="scope-req-1"');
});

test("a read of what is owed that fails withholds the scope rather than offering it (Codex)", async () => {
  const world = fresh();
  await openRequest(world, "req-1", "add a retry budget");
  const html = await operatorPage(
    owing(world, async () => {
      throw new Error("the threads could not be read");
    }),
    "t",
    threadOf("req-1"),
  );
  expect(nextCard(html)).toContain(EN.nextStepDrafting);
  expect(html).not.toContain('id="scope-req-1"');
});

test("with no drafter host, nothing is owed and the page is as it was", async () => {
  const world = fresh();
  await openRequest(world, "req-1", "add a retry budget");
  const html = await operatorPage(portsOver(world), "t", threadOf("req-1"));
  expect(nextCard(html)).toContain(EN.nextStepScope);
  expect(html).not.toContain(EN.nextStepDrafting);
});

/** Run rondo's drafter once over the thread, as the host does on the person's message. */
async function draft(w: Awaited<ReturnType<typeof drafterWorld>>, atMs: number) {
  const document = planDocument();
  let n = atMs;
  const host = drafterHost({
    store: w.store,
    record: w.record,
    now: () => atMs,
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
            agent_type_digest: agentTypeDigestOf(document),
            prompt: "Fix the cost box.",
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
}

/** A request rondo's drafter has drafted a scope for, waiting on the person's approval. */
async function drafted() {
  const w = await drafterWorld();
  await w.say("r1", "Fix the cost box.", null, 1_000);
  await w.say("r1-plan", JSON.stringify(planDocument()), "r1", 1_100);
  await draft(w, 1_500);
  const { scope_id: scopeId } = w.connection
    .prepare("SELECT scope_id FROM scope WHERE author_kind = 'drafter'")
    .get() as { scope_id: string };
  return { ...w, scopeId };
}

test("a drafted scope ready to approve is the person's turn: the list, the header and the tab (rondo#534)", async () => {
  const w = await drafted();
  const html = await operatorPage(
    { ...portsOver(w), draftsOwed: async () => new Set() },
    "t",
    threadOf("r1"),
  );
  expect(nextCard(html)).toContain(EN.nextStepDrafted);
  expect(html).toContain("list-row-mine");
  expect(html).toContain(EN.waitingCount(1));
  expect(html).toContain(`data-waits="[&quot;scope:${w.scopeId}&quot;]"`);
});

test("while rondo still owes a newer draft, the scope waiting on it is not the person's turn (D-0151)", async () => {
  const w = await drafted();
  const html = await operatorPage(
    {
      ...portsOver(w),
      draftsOwed: async () => new Set(["r1"]),
    },
    "t",
    threadOf("r1"),
  );
  expect(html).not.toContain("list-row-mine");
  expect(html).toContain('data-waits="[]"');
});

test("the host reaches the person once for a drafted scope, not while a draft is owed, and for the press while a repository is to add", async () => {
  const w = await drafted();
  const sent: string[] = [];
  const tick = (over: {
    readonly draftsOwed?: () => Promise<ReadonlySet<string>>;
    readonly unheld?: (id: string) => Promise<boolean>;
  }) =>
    reachThePerson({
      store: w.store,
      record: w.record,
      now: () => 50_000,
      words: EN,
      notify: async (sentence) => {
        sent.push(sentence);
        return { kind: "reached" };
      },
      say: () => undefined,
      ...over,
    });
  await tick({ draftsOwed: async () => new Set(["r1"]) });
  expect(sent).toEqual([]);
  // A repository to add first is the person's press, and their turn (rondo#643).
  await tick({ unheld: async () => true });
  expect(sent).toEqual([EN.reachYourTurn]);
  await tick({});
  await tick({});
  expect(sent).toEqual([EN.reachYourTurn, EN.reachYourTurn]);
  expect(
    w.connection
      .prepare("SELECT subject_id FROM operator_attention WHERE subject_kind = ?")
      .all(REACH_SUBJECT)
      .map((row) => (row as { subject_id: string }).subject_id),
  ).toEqual(["press:r1", `scope:${w.scopeId}`]);
});

test("a follow-up drafted after a merged lap is the person's turn, and its draft leads the scope page (rondo#621)", async () => {
  const w = await drafted();
  const read = await w.record.readScope(w.scopeId);
  if (read.kind !== "read") throw new Error("the drafted scope did not read");
  const approved = await w.record.recordScopeDecision({
    scopeDecisionId: "decision-1",
    scopeId: w.scopeId,
    scopeDigest: read.scope.scopeDigest,
    outcome: "approved",
    actorId: "ada",
    recordedBy: "test",
    decidedAtMs: 1_600,
  });
  expect(approved.kind).toBe("recorded");
  // The approved lap, published and merged, as the issue's request #617 was.
  await reserve(w, "lap-1", "Fix the cost box.", null, "r1");
  await openGate(w, "lap-1");
  await recordAnswer(w, "lap-1");
  const closed = await w.store.transition(
    "lap-1",
    "awaiting_human",
    "closed",
    { gateOutcome: "answered_and_forwarded" },
    3_000,
  );
  expect(closed.kind).toBe("transitioned");
  for (const [id, body] of [
    [
      "report-published-lap-1",
      "Lap 'lap-1' was published: pull request https://f/o/r/pull/617 was opened.",
    ],
    [
      "report-merged-lap-1",
      "Lap 'lap-1' was merged on a person's press on the page: pull request #617 went into 'main' by squash.",
    ],
  ] as const) {
    const said = await w.record.recordThreadMessage({
      messageId: id,
      body,
      authorKind: "drafter",
      authorId: "rondo/deterministic/1",
      inReplyTo: "r1",
      atMs: 3_100,
      bases: [{ form: "iteration", iterationId: "lap-1" }],
      asks: false,
    });
    expect(said.kind).toBe("recorded");
  }
  const ports = { ...portsOver(w), draftsOwed: async () => new Set<string>() };
  const merged = await operatorPage(ports, "t", threadOf("r1"));
  expect(merged).toContain(PAGE_EN.rowMerged(EN.pullRequest("617")));
  expect(merged).not.toContain("list-row-mine");

  // The person's follow-up, drafted again: a new scope waits on them.
  await w.say("r1-more", "One more thing.", "r1", 4_000);
  await draft(w, 4_500);
  const { scope_id: newer } = w.connection
    .prepare("SELECT scope_id FROM scope WHERE author_kind = 'drafter' AND scope_id <> ?")
    .get(w.scopeId) as { scope_id: string };
  const html = await operatorPage(ports, "t", threadOf("r1"));
  expect(html).toContain("list-row-mine");
  expect(html).toContain(PAGE_EN.rowWaitingOnYou);
  expect(html).not.toContain(PAGE_EN.rowMerged(EN.pullRequest("617")));
  expect(html).toContain(EN.waitingCount(1));
  expect(html).toContain(`data-waits="[&quot;scope:${newer}&quot;]"`);

  // The scope page puts the waiting draft above the approval already given.
  const scope = await operatorPage(ports, "t", {
    kind: "scope",
    messageId: "r1",
    rounds: null,
    decisionId: null,
    plan: null,
  });
  const redrafted = scope.indexOf(EN.scopeRedrafted);
  expect(redrafted).toBeGreaterThan(-1);
  const given = scope.indexOf(EN.scopeDigest(read.scope.scopeDigest));
  expect(given).toBeGreaterThan(-1);
  expect(redrafted).toBeLessThan(given);
});

test("asked across every request, rondo names a drafted scope only where the list does (D-0189)", async () => {
  const w = await drafted();
  const said = await w.record.recordThreadMessage({
    messageId: "question-across",
    body: "What is waiting on me?",
    authorKind: "operator",
    authorId: "ada",
    inReplyTo: null,
    atMs: 2_000,
    bases: [],
    asks: false,
  });
  expect(said.kind).toBe("recorded");
  const scopes = async (over: {
    readonly draftsOwed?: () => Promise<ReadonlySet<string>>;
    readonly unheld?: (id: string) => Promise<boolean>;
  }) =>
    (
      await gatherExplainerMaterial(
        { store: w.store, record: w.record, ...over },
        "question-across",
        3_000,
      )
    ).waits.filter((wait) => wait.kind === "scope");
  expect(await scopes({})).toEqual([
    {
      kind: "scope",
      scopeId: w.scopeId,
      request: { messageId: "r1", title: "Fix the cost box." },
    },
  ]);
  // A redraft rondo owes, or a repository to add first: no turn on the list, none in the answer.
  expect(await scopes({ draftsOwed: async () => new Set(["r1"]) })).toEqual([]);
  expect(await scopes({ unheld: async () => true })).toEqual([]);
});

test("an answer across every request leads to the scope's request, not to a scope screen of the question's", async () => {
  const w = await drafted();
  await w.record.recordThreadMessage({
    messageId: "question-across",
    body: "What is waiting on me?",
    authorKind: "operator",
    authorId: "ada",
    inReplyTo: null,
    atMs: 2_000,
    bases: [],
    asks: false,
  });
  let n = 0;
  const host = explainerHost({
    store: w.store,
    record: w.record,
    runDrafter: async () => {
      throw new Error("no model is asked across every request");
    },
    now: () => 3_000,
    mintId: (kind) => {
      n += 1;
      return `${kind}-x${String(n)}`;
    },
    language: null,
    log: () => undefined,
  });
  host.kick();
  await host.idle();
  const html = await operatorPage(
    { ...portsOver(w), draftsOwed: async () => new Set() },
    "t",
    threadOf("question-across"),
  );
  const answer = /<article id="drafter-x[^"]*"[\s\S]*?<\/article>/.exec(html)?.[0] ?? "";
  expect(answer).toContain(EN.explainWaitsScope);
  expect(answer).toContain('href="/?thread=r1&amp;lang=en#r1"');
  expect(answer).not.toContain("?scope=question-across");
});
