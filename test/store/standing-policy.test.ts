/**
 * D-0067 rule 6: a standing policy is a row of its own, and the store's
 * refusals keep a drafter from weakening one. Each refusal below is a planted
 * row the writer must turn away, against a real database.
 */
import { expect, test } from "vitest";

import type { StandingPolicyDraft } from "../../src/store/sqlite.js";
import { world } from "../access/fixtures/drafter.js";

const DRAFTER = "rondo/drafter/12/claude-opus-5";

function policy(over: Partial<StandingPolicyDraft> = {}): StandingPolicyDraft {
  return {
    policyId: "policy-1",
    body: "Run at most two requests at once.",
    authorKind: "drafter",
    authorId: DRAFTER,
    bases: [{ form: "message", messageId: "r1" }],
    supersedesPolicyId: null,
    createdAtMs: 2_000,
    ...over,
  };
}

async function said() {
  const w = await world();
  await w.say("r1", "From now on, run at most two requests at once.", null, 1_000);
  return w;
}

const inForce = async (w: Awaited<ReturnType<typeof said>>) =>
  (await w.record.standingPolicies()).map((p) => [p.policyId, p.body]);

test("a drafter keeps a policy from the person's own words, and it is in force", async () => {
  const w = await said();
  expect(await w.record.recordStandingPolicy(policy())).toEqual({ kind: "recorded" });
  expect(await w.record.standingPolicies()).toEqual([policy()]);
});

test("planted: a drafter's successor is refused, so a drafter can never weaken or retire a policy (rule 6.3)", async () => {
  const w = await said();
  await w.record.recordStandingPolicy(policy());
  for (const body of ["", "Run as many requests at once as you like."]) {
    const outcome = await w.record.recordStandingPolicy(
      policy({ policyId: "policy-2", body, supersedesPolicyId: "policy-1" }),
    );
    expect(outcome.kind).toBe("refused");
    expect(outcome.kind === "refused" && outcome.reason).toContain("only an operator");
  }
  expect(await inForce(w)).toEqual([["policy-1", "Run at most two requests at once."]]);
});

test("planted: a drafter's policy that rests on nothing the person wrote is refused (rule 6.2)", async () => {
  const w = await said();
  await w.record.recordThreadMessage({
    messageId: "d1",
    body: "I read your request.",
    authorKind: "drafter",
    authorId: DRAFTER,
    inReplyTo: "r1",
    atMs: 1_500,
    bases: [{ form: "message", messageId: "r1" }],
    asks: false,
  });
  for (const bases of [
    [],
    [{ form: "message", messageId: "d1" }],
    [{ form: "message", messageId: "nowhere" }],
    [{ form: "proposal", proposalId: "r1" }],
  ]) {
    const outcome = await w.record.recordStandingPolicy(policy({ bases }));
    expect(outcome.kind, JSON.stringify(bases)).toBe("refused");
  }
  expect(await w.record.standingPolicies()).toEqual([]);
});

test("an operator retires a policy with an empty successor, and changes one with a full one", async () => {
  const w = await said();
  await w.record.recordStandingPolicy(policy());
  await w.record.recordStandingPolicy(policy({ policyId: "policy-a", body: "Write in English." }));
  const operator = { authorKind: "operator" as const, authorId: "ada", bases: [] };
  expect(
    await w.record.recordStandingPolicy(
      policy({ ...operator, policyId: "policy-3", body: "", supersedesPolicyId: "policy-1" }),
    ),
  ).toEqual({ kind: "recorded" });
  expect(
    await w.record.recordStandingPolicy(
      policy({
        ...operator,
        policyId: "policy-b",
        body: "Write in Japanese.",
        supersedesPolicyId: "policy-a",
      }),
    ),
  ).toEqual({ kind: "recorded" });
  expect(await inForce(w)).toEqual([["policy-b", "Write in Japanese."]]);
  // Neither a retired policy nor a replaced one can be replaced again: one successor each.
  for (const [id, named] of [
    ["policy-4", "policy-1"],
    ["policy-5", "policy-3"],
    ["policy-6", "policy-a"],
  ] as const) {
    const outcome = await w.record.recordStandingPolicy(
      policy({ ...operator, policyId: id, body: "", supersedesPolicyId: named }),
    );
    expect(outcome.kind, named).toBe("refused");
  }
});

test("an empty policy that replaces nothing, and a second row under one id, are refused", async () => {
  const w = await said();
  const operator = { authorKind: "operator" as const, authorId: "ada", bases: [] };
  expect((await w.record.recordStandingPolicy(policy({ ...operator, body: "  " }))).kind).toBe(
    "refused",
  );
  expect(await w.record.recordStandingPolicy(policy(operator))).toEqual({ kind: "recorded" });
  expect((await w.record.recordStandingPolicy(policy(operator))).kind).toBe("refused");
});

test("a refused policy leaves no part of the draft behind, and a message may cite a kept one", async () => {
  const w = await said();
  const note = {
    messageId: "note-1",
    body: "Run at most two requests at once.",
    authorKind: "drafter" as const,
    authorId: "rondo/policy-note/1",
    inReplyTo: "r1",
    atMs: 2_000,
    bases: [{ form: "policy", policyId: "policy-1" }],
    asks: false,
  };
  const write = {
    requestMessageId: "r1",
    operatorMessageIds: ["r1"],
    drafterPrefix: "rondo/drafter/",
    proposal: null,
    scope: null,
    messages: [note],
  };
  const refused = await w.record.recordDraft({
    ...write,
    policies: [policy({ supersedesPolicyId: "policy-0" })],
  });
  expect(refused.kind).toBe("refused");
  expect((await w.record.threadMessages()).kind === "read").toBe(true);
  expect(w.connection.prepare("SELECT count(*) AS n FROM conversation_message").get()).toEqual({
    n: 1,
  });
  // Without the policy row, the note's `policy:` basis locates nothing.
  expect((await w.record.recordDraft(write)).kind).toBe("refused");
  expect(await w.record.recordDraft({ ...write, policies: [policy()] })).toEqual({
    kind: "recorded",
  });
  expect(await inForce(w)).toEqual([["policy-1", "Run at most two requests at once."]]);
});

test("the decision log lists a policy kept, changed and retired", async () => {
  const w = await said();
  await w.record.recordStandingPolicy(policy());
  await w.record.recordStandingPolicy(
    policy({
      policyId: "policy-2",
      authorKind: "operator",
      authorId: "ada",
      bases: [],
      body: "",
      supersedesPolicyId: "policy-1",
      createdAtMs: 3_000,
    }),
  );
  const rows = (await w.record.decisions(2_000, false)).filter(
    (row) => row.kind === "standing_policy",
  );
  expect(rows.map((row) => [row.id, row.by, row.outcome, row.locator])).toEqual([
    ["policy-1", "rondo", "kept", null],
    ["policy-2", "person", "retired", "policy-1"],
  ]);
});
