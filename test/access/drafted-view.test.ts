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
  expect(shown.computed.expires_at_ms.value).toBe(budgets.expires_at_ms);
  // The request and the pasted plan are not narrowing words.
  expect(shown.narrowedBy).toEqual([]);
});

test("a narrowed draft carries the person's words it rests on, and a value below the computed one", async () => {
  const w = await drafted(true);
  const standing = await draftedStanding(w, "r1");
  if (standing.kind !== "drafted") throw new Error(standing.kind);
  expect(standing.drafted.narrowedBy).toEqual(["r1-cap"]);
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
  });

  const edited = await drafted();
  const mine = await successorOf(edited, "scope-mine-1");
  const onMine = await decide(edited, mine, "approved");
  expect(await draftedStanding(edited, "r1")).toEqual({
    kind: "decided",
    scopeDecisionId: onMine,
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
