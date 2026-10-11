/**
 * D-0067 rules 6.2 and 6.3 on the page: a policy rondo kept from the person's
 * words is said under those words with one press that takes it back, and once
 * taken back the note says so and offers nothing.
 */
import { expect, test } from "vitest";

import { POLICY_NOTE_AUTHOR } from "../../src/access/model-draft/judgement.js";
import { chromeFor, EN } from "../../src/access/wording.js";
import { fresh, operatorPage, portsOver } from "./page-world.js";

const THREAD = { kind: "thread" as const, messageId: "req-1", to: null };
const BODY = "Never touch the release workflow.";

async function kept() {
  const world = fresh();
  const say = async (draft: Parameters<typeof world.record.recordThreadMessage>[0]) => {
    const outcome = await world.record.recordThreadMessage(draft);
    expect(outcome.kind, JSON.stringify(outcome)).toBe("recorded");
  };
  await say({
    messageId: "req-1",
    body: "Fix the flaky test. From now on, never touch the release workflow.",
    authorKind: "operator",
    authorId: "ada",
    inReplyTo: null,
    atMs: 1_000,
    bases: [],
    asks: false,
  });
  expect(
    await world.record.recordStandingPolicy({
      policyId: "policy-1",
      body: BODY,
      authorKind: "drafter",
      authorId: "rondo/drafter/12/m",
      bases: [{ form: "message", messageId: "req-1" }],
      supersedesPolicyId: null,
      createdAtMs: 2_000,
    }),
  ).toEqual({ kind: "recorded" });
  await say({
    messageId: "note-1",
    body: BODY,
    authorKind: "drafter",
    authorId: POLICY_NOTE_AUTHOR,
    inReplyTo: "req-1",
    atMs: 2_000,
    bases: [
      { form: "message", messageId: "req-1" },
      { form: "policy", policyId: "policy-1" },
    ],
    asks: false,
  });
  return world;
}

const forms = (html: string) =>
  html.match(/<form action="\/forget-policy[^"]*" method="post"/g) ?? [];

test("a kept policy is said under its words, with the one press that takes it back", async () => {
  const world = await kept();
  const ja = chromeFor("ja");
  const html = await operatorPage({ ...portsOver(world), triageWritable: true }, "t", THREAD, ja);
  expect(html).toContain(ja.policyKept);
  expect(forms(html)).toEqual(['<form action="/forget-policy?lang=ja" method="post"']);
  const form = html.slice(html.indexOf('action="/forget-policy'));
  expect(form).toContain('name="token" value="t"');
  expect(form).toContain('name="policy" value="policy-1"');
  expect(form).toContain('name="back" value="/?thread=req-1&amp;lang=ja#note-1"');
  expect(form).toContain(`>${ja.policyForgetAction}</button>`);
  // The summary that cites it names it in the person's words, never by its id.
  expect(html).not.toContain(">policy policy-1<");
  // With no approver's port, the note is said and no form is drawn.
  const unpressable = await operatorPage(portsOver(world), "t", THREAD, EN);
  expect(unpressable).toContain(EN.policyKept);
  expect(forms(unpressable)).toEqual([]);
});

test("a policy taken back says so, and offers nothing more", async () => {
  const world = await kept();
  expect(
    await world.record.recordStandingPolicy({
      policyId: "policy-2",
      body: "",
      authorKind: "operator",
      authorId: "ada",
      bases: [],
      supersedesPolicyId: "policy-1",
      createdAtMs: 3_000,
    }),
  ).toEqual({ kind: "recorded" });
  const html = await operatorPage({ ...portsOver(world), triageWritable: true }, "t", THREAD, EN);
  expect(html).toContain(EN.policyForgotten);
  expect(html).not.toContain(EN.policyKept);
  expect(forms(html)).toEqual([]);
});
