/**
 * What the scope screen reads for a drafted request (rondo#238 C2b): the draft
 * waiting on the person, the approval that already decided it, and the drafted
 * plans behind an approved scope -- over a draft written the way the host
 * writes one, in memory.
 */
import { expect, test } from "vitest";
import { draftedPlansUnder, draftedStanding } from "../../src/access/drafted-view.js";
import { drafterHost } from "../../src/access/drafter-host.js";
import { planDigest } from "../../src/store/plan.js";
import type { JsonRecord, StoredScope } from "../../src/store/records.js";
import { agentTypeDigestOf, planDocument, REPOSITORY, world } from "./fixtures/drafter.js";

const PROMPTS = ["Fix the scope screen cost box.", "Title-case the approve button."];

/** A request with a pasted plan, drafted into two plans; `narrow` adds "keep it under $3". */
async function drafted(narrow = false) {
  const w = await world();
  const document = planDocument();
  await w.say("r1", "Two things, please.", null, 1_000);
  await w.say("r1-plan", JSON.stringify(document), "r1", 1_100);
  if (narrow) {
    await w.say("r1-cap", "Keep it under $3.", "r1", 1_200);
  }
  const typeDigest = agentTypeDigestOf(document);
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
        plans: PROMPTS.map((prompt) => ({
          template_plan_digest: planDigest(document),
          agent_type_digest: typeDigest,
          prompt,
          bases: ["r1"],
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
  return { ...w, draft: read.scope, proposalId, typeDigest };
}

type Drafted = Awaited<ReturnType<typeof drafted>>;

async function decide(w: Drafted, scope: StoredScope, outcome: "approved" | "declined") {
  const decided = await w.record.recordScopeDecision({
    scopeDecisionId: `decision-${scope.scopeId}`,
    scopeId: scope.scopeId,
    scopeDigest: scope.scopeDigest,
    outcome,
    actorId: "ada",
    recordedBy: "test",
    decidedAtMs: 2_000,
  });
  if (decided.kind !== "recorded") throw new Error(JSON.stringify(decided));
  return `decision-${scope.scopeId}`;
}

/** The person's changed version of the draft (D-0071 rule 5.3), cost lowered to 2. */
async function successorOf(w: Drafted, scopeId: string): Promise<StoredScope> {
  const payload = {
    ...(w.draft.payload as unknown as JsonRecord),
    budgets: { ...w.draft.payload.budgets, cost_usd: 2 },
  } as JsonRecord;
  const written = await w.record.recordScope({
    scopeId,
    payload,
    supersedesScopeId: w.draft.scopeId,
    authorKind: "operator",
    authorId: "ada",
    bases: [{ form: "scope", scopeId: w.draft.scopeId }],
    createdAtMs: 1_900,
    agentTypeRecords: [],
  });
  if (written.kind !== "recorded") throw new Error(JSON.stringify(written));
  const read = await w.record.readScope(scopeId);
  if (read.kind !== "read") throw new Error("the successor did not read");
  return read.scope;
}

test("a fresh draft stands as drafted: its plans, its split, and budgets recomputed to the drafted values", async () => {
  const w = await drafted();
  const standing = await draftedStanding(w, "r1");
  expect(standing.kind).toBe("drafted");
  if (standing.kind !== "drafted") return;
  const shown = standing.drafted;
  expect(shown.scope.scopeId).toBe(w.draft.scopeId);
  expect(shown.proposalId).toBe(w.proposalId);
  expect(shown.plans.map((p) => [p.index, p.split.prompt, p.repository])).toEqual([
    [0, PROMPTS[0], REPOSITORY],
    [1, PROMPTS[1], REPOSITORY],
  ]);
  // Nothing narrowed: rule 4.2 over the snapshot gives the values the draft holds.
  const budgets = w.draft.payload.budgets;
  expect(shown.computed.laps.value).toBe(budgets.laps);
  expect(shown.computed.review_rounds.value).toBe(budgets.review_rounds);
  expect(shown.computed.cost_usd.value).toBe(budgets.cost_usd);
  expect(shown.computed.cost_reserve_usd.value).toBe(budgets.cost_reserve_usd);
  // Stored to the minute the form shows it at, so an untouched press matches.
  expect(Math.floor(shown.computed.expires_at_ms.value / 60_000) * 60_000).toBe(
    budgets.expires_at_ms,
  );
  expect(budgets.expires_at_ms % 60_000).toBe(0);
  expect(shown.narrowed).toEqual([]);
});

test("a narrowed draft carries the person's words it rests on, and a value below the computed one", async () => {
  const w = await drafted(true);
  const standing = await draftedStanding(w, "r1");
  if (standing.kind !== "drafted") throw new Error(standing.kind);
  expect(standing.drafted.narrowed).toEqual([{ field: "cost_usd", messageId: "r1-cap" }]);
  expect(w.draft.payload.budgets.cost_usd).toBe(3);
  expect(standing.drafted.computed.cost_usd.value).toBeGreaterThan(3);
});

test("no drafter's scope for the request is none", async () => {
  const w = await world();
  await w.say("r1", "Fix it.", null, 1_000);
  expect(await draftedStanding(w, "r1")).toEqual({ kind: "none" });
});

test("approved as drafted, or as the person's successor, the standing is the approval; declined, the form is the person's", async () => {
  const asDrafted = await drafted();
  const onDraft = await decide(asDrafted, asDrafted.draft, "approved");
  expect(await draftedStanding(asDrafted, "r1")).toEqual({
    kind: "decided",
    scopeDecisionId: onDraft,
    newer: null,
  });

  const edited = await drafted();
  const mine = await successorOf(edited, "scope-mine-1");
  const onMine = await decide(edited, mine, "approved");
  expect(await draftedStanding(edited, "r1")).toEqual({
    kind: "decided",
    scopeDecisionId: onMine,
    newer: null,
  });

  const declined = await drafted();
  await decide(declined, declined.draft, "declined");
  expect(await draftedStanding(declined, "r1")).toEqual({ kind: "none" });
});

test("the drafted plans stand behind the drafter's scope and the person's successor of it, and behind no scope of the person's own", async () => {
  const w = await drafted();
  const underDraft = await draftedPlansUnder(w, w.draft);
  expect(underDraft?.proposalId).toBe(w.proposalId);
  expect(underDraft?.plans.map((p) => p.split.prompt)).toEqual(PROMPTS);

  const mine = await successorOf(w, "scope-mine-1");
  const underMine = await draftedPlansUnder(w, mine);
  expect(underMine?.proposalId).toBe(w.proposalId);
  expect(underMine?.plans).toHaveLength(2);

  const own = await w.record.recordScope({
    scopeId: "scope-own-1",
    payload: w.draft.payload as unknown as JsonRecord,
    supersedesScopeId: null,
    authorKind: "operator",
    authorId: "ada",
    bases: [],
    createdAtMs: 1_950,
    agentTypeRecords: [],
  });
  expect(own.kind).toBe("recorded");
  const ownRead = await w.record.readScope("scope-own-1");
  if (ownRead.kind !== "read") throw new Error("own scope did not read");
  expect(await draftedPlansUnder(w, ownRead.scope)).toBeNull();
});

/** Run the drafter again over the thread, as the host does on the person's next message. */
async function redraft(w: Drafted, narrowings: readonly unknown[] = []) {
  let n = 100;
  const host = drafterHost({
    store: w.store,
    record: w.record,
    now: () => 2_500,
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
        summary: { text: "Redrafted.", bases: ["r1"] },
        plans: PROMPTS.map((prompt) => ({
          template_plan_digest: planDigest(planDocument()),
          agent_type_digest: w.typeDigest,
          prompt,
          bases: ["r1"],
        })),
        narrowings,
      }),
    }),
  });
  host.kick();
  await host.idle();
}

test("a redraft after an approval is shown beside it, never in its place: the approval and its starts stand", async () => {
  const w = await drafted();
  const approved = await decide(w, w.draft, "approved");
  await w.say("r1-more", "One more thing.", "r1", 2_000);
  await redraft(w);
  const standing = await draftedStanding(w, "r1");
  expect(standing.kind).toBe("decided");
  if (standing.kind !== "decided") return;
  expect(standing.scopeDecisionId).toBe(approved);
  expect(standing.newer?.scope.scopeId).not.toBe(w.draft.scopeId);
  expect(standing.newer?.plans).toHaveLength(2);
});

test("a narrowing that rests on the request itself is cited, and a stated cost is kept to the cent the form shows", async () => {
  const w = await drafted();
  // A second run over a newer message, narrowing on the opening request's words.
  await w.say("r1-more", "And the budget is in the request.", "r1", 2_000);
  await redraft(w, [{ field: "cost_usd", value: 3.337, basis: "r1" }]);
  const standing = await draftedStanding(w, "r1");
  if (standing.kind !== "drafted") throw new Error(standing.kind);
  expect(standing.drafted.narrowed).toEqual([{ field: "cost_usd", messageId: "r1" }]);
  expect(standing.drafted.scope.payload.budgets.cost_usd).toBe(3.33);
});

test("a draft changed twice keeps its drafted work: the approval two changes deep stands, and its plans are the draft's", async () => {
  const w = await drafted();
  const first = await successorOf(w, "scope-mine-1");
  await decide(w, first, "approved");
  // A later change of the person's version, as `rondo scope --supersedes-scope-id` writes one.
  const written = await w.record.recordScope({
    scopeId: "scope-mine-2",
    payload: {
      ...(first.payload as unknown as JsonRecord),
      budgets: { ...first.payload.budgets, cost_usd: 1 },
    } as JsonRecord,
    supersedesScopeId: first.scopeId,
    authorKind: "operator",
    authorId: "ada",
    bases: [{ form: "scope", scopeId: first.scopeId }],
    createdAtMs: 2_100,
    agentTypeRecords: [],
  });
  if (written.kind !== "recorded") throw new Error(JSON.stringify(written));
  const second = await w.record.readScope("scope-mine-2");
  if (second.kind !== "read") throw new Error("the second change did not read");
  const approved = await decide(w, second.scope, "approved");

  expect(await draftedStanding(w, "r1")).toEqual({
    kind: "decided",
    scopeDecisionId: approved,
    newer: null,
  });
  const plans = await draftedPlansUnder(w, second.scope);
  expect(plans?.scope.scopeId).toBe(w.draft.scopeId);
  expect(plans?.plans).toHaveLength(2);
});

test("a draft retired by an approved scope that no longer names the request is not offered again", async () => {
  const w = await drafted();
  await w.say("r2", "Another request.", null, 1_800);
  // An operator's change of the draft that covers only the other request, as
  // `rondo scope --supersedes-scope-id` can write one.
  const written = await w.record.recordScope({
    scopeId: "scope-elsewhere",
    payload: { ...(w.draft.payload as unknown as JsonRecord), requests: ["r2"] } as JsonRecord,
    supersedesScopeId: w.draft.scopeId,
    authorKind: "operator",
    authorId: "ada",
    bases: [{ form: "scope", scopeId: w.draft.scopeId }],
    createdAtMs: 1_900,
    agentTypeRecords: [],
  });
  if (written.kind !== "recorded") throw new Error(JSON.stringify(written));
  const elsewhere = await w.record.readScope("scope-elsewhere");
  if (elsewhere.kind !== "read") throw new Error("the change did not read");
  await decide(w, elsewhere.scope, "approved");
  expect(await draftedStanding(w, "r1")).toEqual({ kind: "none" });
});
