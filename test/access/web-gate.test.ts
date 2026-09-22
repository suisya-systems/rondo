import { expect, test } from "vitest";

import type {} from "../../src/access/inbox.js";
import { viewHref } from "../../src/access/page-logic/routes.js";
import { chromeFor, EN } from "../../src/access/wording.js";
import { contentDigest } from "../../src/store/plan.js";
import { type JsonRecord, scopePayloadWithDefaults } from "../../src/store/records.js";
import {
  draftRevise,
  EVIDENCE,
  fresh,
  gateWithChecks,
  modelFindings,
  newerModelReading,
  openGate,
  operatorPage,
  portsOver,
  REVISE_ANSWER,
  reserve,
  reviseRows,
  seedScopeRequest,
  structured,
} from "./page-world.js";

/**
 * The answer bar and everything after it **inside the centre face**.
 *
 * **Bounded at the right face since rondo#350.** Rule 5's material moved out
 * of the answering box, so the document now carries the fence's calls *after*
 * the bar rather than before it -- and a slice that ran to the end of the page
 * would answer "is there a `<details>` below the bar" with the right face's
 * fold. What these cases are about is the box that holds the press, so the
 * slice stops where that box does. (The readings' coverage was a second such
 * fold until rondo#317 drew it open, under `D-0082` rule 7.)
 */
const barOf = (html: string): string =>
  html.slice(html.indexOf('id="answer-bar"'), html.indexOf('class="face face-side"'));

test("both readings are drawn from the rows on the right face, with the warning by approve (#220 S2)", async () => {
  const world = fresh();
  await gateWithChecks(world);
  const appended = await world.store.appendReading(
    "i-0001",
    {
      drafter: "rondo/model/1/gpt-6-astra",
      verdict: "concerns",
      findings: ["the loop never stops", "the backoff is not capped", "a typo"],
      graded: [
        {
          severity: "blocker",
          bases: [{ kind: "file", path: "src/notifier.ts", line: 41 }],
          basisResolved: true,
        },
        {
          severity: "major",
          bases: [{ kind: "rule", path: "AGENTS.md", line: 12 }],
          basisResolved: false,
        },
        { severity: "nit", bases: [], basisResolved: false },
      ],
      evidence: EVIDENCE,
      unavailableReason: null,
    },
    4_000,
  );
  expect(appended.kind).toBe("appended");
  const html = await operatorPage({ ...portsOver(world, "ada", []), material: structured }, "t", {
    kind: "summary",
  });

  // The two cards, the checks' finding and the model's graded findings.
  expect(html).toContain('id="checks"');
  expect(html).toContain('id="model-review"');
  // **The weight of the one card that was raised on** (rondo#314, D-0082 rule
  // 2's *red means broken*): four cards of one weight left the person to read
  // all four to find the reason they were called, so this one is edged in red
  // and the others are not.
  expect(html).toMatch(/<section\s+id="model-review"\s+class="[^"]*border-l-fail/);
  expect(html.match(/border-l-fail/g)).toHaveLength(1);
  // **On the right face, one under the other** (D-0083 rule 5, rondo#350):
  // the two readings left the centre with the rest of the material, and at
  // 720px a card that was half a 1,040px grid is the whole width.
  expect(html.indexOf('id="checks"')).toBeGreaterThan(html.indexOf('class="face face-side"'));
  expect(html.indexOf('id="checks"')).toBeLessThan(html.indexOf('id="model-review"'));
  expect(html).toContain("a binary file was not read");
  expect(html).toMatch(/severity[^"]*">blocker<\/span><span[^>]*>the loop never stops/);
  expect(html).toMatch(/severity[^"]*">major<\/span>/);
  expect(html).toContain(">src/notifier.ts:41</code>");
  expect(html).toContain(">rule AGENTS.md:12</code>");
  expect(html).toContain("none of these matched the delivered work");
  expect(html).toContain("no basis given");
  expect(html).toContain(">gpt-6-astra</span>");
  // What changed, as rows, and the worker's own words.
  expect(html).toContain("feat: retry budget");
  expect(html).toContain(">+64</span>");
  expect(html).toContain("I could not run the suite.");
  // No recommendation anywhere on the gate.
  expect(html.toLowerCase()).not.toContain("recommend");

  // The warning is inside the bar, before the button, and links to the card.
  // **The bar and not the form** since rondo#233 S4 put the gate's second
  // answer beside the first: two forms cannot nest, so what sticks to the
  // bottom of the window is the `div` around them.
  const bar = barOf(html);
  const form = html.slice(html.indexOf('<form id="approve-form"'), html.indexOf("</form>"));
  expect(bar).toContain("The model review raised 1 blocker and 1 major.");
  expect(bar.indexOf('id="model-raised"')).toBeLessThan(bar.indexOf('type="submit"'));
  expect(bar).toContain('<a href="#model-review"');
  // The claim box rides the press, keyed per gate, and is not cut by the browser.
  expect(form).toMatch(/<textarea name="verified" rows="1" data-draft="claim:i-0001:gate-i-0001"/);
  expect(form).not.toContain("maxlength");
  // Not due: this model reading carries the checks' tip.
  expect(html).not.toContain("may still arrive");
  // Both verdicts pinned in the bar, the model's worst finding first in its pill
  // (the S2 design pass), and what the press records folded shut by default.
  expect(bar).toContain('id="bar-readings"');
  expect(bar).toContain(">1 blocker · 1 major · 1 nit</span>");
  expect(html).toMatch(
    /<details id="records" class="group[^"]*"><summary[^>]*>[\s\S]*?What approve records \(\d+ fields\)/,
  );

  // The full text is still in the document, in its fold.
  expect(html).toMatch(/<details id="material-text"[\s\S]*fence {3}the whole text/);
});

test("an unavailable run writes its reason and is not retried; the next reading is drafted as its own (D-0077 rules 2.2, 4.2)", async () => {
  const world = fresh();
  await gateWithChecks(world);
  await modelFindings(world);
  expect(await draftRevise(world, null)).toHaveLength(1);
  expect(reviseRows(world).map((r) => r.payload)).toEqual([
    { kind: "unavailable", reason: "claude exited 1" },
  ]);
  expect(await draftRevise(world, REVISE_ANSWER)).toHaveLength(0);

  await newerModelReading(world, "the log is too loud", 6_000);
  expect(
    await draftRevise(world, { lead: null, findings: [{ finding: 1, change: "Quieter." }] }),
  ).toHaveLength(1);
  const html = await operatorPage(
    { ...portsOver(world, "ada", [], null, "decision-1"), material: structured },
    "t",
    { kind: "summary" },
    EN,
    null,
    null,
    () => "lap-00000000-0000-4000-8000-000000000007",
  );
  expect(html).toContain("- [major] the log is too loud\n  to change: Quieter.");
  expect(html).not.toContain("rondo could not draft what to change");
});

test("the revise drafter drafts only where the gate view draws a revise form (D-0077 rule 2.1)", async () => {
  // No approval: the view says a change is not offered, so nothing is spent.
  const unapproved = fresh();
  await gateWithChecks(unapproved);
  await modelFindings(unapproved);
  expect(await draftRevise(unapproved, REVISE_ANSWER, { admitted: null })).toHaveLength(0);

  // A clear reading has nothing to quote.
  const clear = fresh();
  await gateWithChecks(clear);
  const appended = await clear.store.appendReading(
    "i-0001",
    {
      drafter: "rondo/model/1/gpt-6-astra",
      verdict: "clear",
      findings: [],
      graded: [],
      evidence: EVIDENCE,
      unavailableReason: null,
    },
    4_000,
  );
  expect(appended.kind).toBe("appended");
  expect(await draftRevise(clear, REVISE_ANSWER)).toHaveLength(0);

  // Only the deterministic reading: there is nothing the drafter may read yet.
  const early = fresh();
  await gateWithChecks(early);
  expect(await draftRevise(early, REVISE_ANSWER)).toHaveLength(0);
  expect(reviseRows(early)).toHaveLength(0);
});

test("the gate offers a change beside approve, drafted from the findings and editable (#233 S4)", async () => {
  const world = fresh();
  await gateWithChecks(world);
  await modelFindings(world);
  await draftRevise(world, REVISE_ANSWER);
  const html = await operatorPage(
    { ...portsOver(world, "ada", [], null, "decision-1"), material: structured },
    "t",
    { kind: "summary" },
    EN,
    null,
    null,
    () => "lap-00000000-0000-4000-8000-000000000001",
  );
  const bar = barOf(html);

  // **Two answers in one bar, and two forms**: approve posts to the summary's
  // address as it always did, the change posts to its own route.
  expect(bar).toContain('<form id="approve-form" method="post" action="/?lang=en"');
  expect(bar).toContain('<form id="revise-form" method="post" action="/revise?lang=en"');
  // **Both answers are presses, and neither is inside a fold** (rondo#351,
  // D-0082 rule 7): the change used to be a `<details>` summary and only the
  // despite press was a button, so the screen drew the exception and folded
  // the recommendation.
  expect(bar).toContain(">Ask for a change</button>");
  expect(bar).toContain('<div id="revise">');
  expect(bar.slice(bar.indexOf('id="revise"'))).not.toContain("<details");
  // **And with a finding standing, the recommendation is the filled one**
  // (D-0083 rules 9.3 and 10): ink, never amber -- the bar's rule and the
  // despite press already carry the page's one claim that a person must act.
  expect(bar).toMatch(
    /<button type="submit"[^>]*class="[^"]*bg-foreground[^"]*">Ask for a change</,
  );
  // Every id the press carries is rondo's, and none of them is typed.
  expect(bar).toContain('<input type="hidden" name="iteration" value="i-0001"/>');
  expect(bar).toContain('<input type="hidden" name="scope_decision" value="decision-1"/>');
  expect(bar).toContain(
    '<input type="hidden" name="successor" value="lap-00000000-0000-4000-8000-000000000001"/>',
  );
  // **The drafter's draft is the field's content, and rondo quotes every
  // finding in it with its severity and bases** (D-0077 rule 3.4): the lead and
  // each finding's words are the drafter's, the quotes are the reading's, in
  // the reading's order whatever order the answer named them in.
  const opened = bar.indexOf('<textarea name="body"');
  const box = bar.slice(opened, bar.indexOf("</textarea>", opened));
  expect(box).toContain(
    ">Keep the retry budget, but make it end.\n\n" +
      "- [blocker] the loop never stops\n  where: src/notifier.ts:41\n" +
      "  to change: Stop after the budget's last try.\n    Say so in the log.\n\n" +
      "- [major] the backoff is not capped\n  where: rule AGENTS.md:12\n" +
      "  to change: Cap the backoff at 30 seconds.",
  );
  expect(box).toContain('data-draft="revise:i-0001:gate-i-0001"');
  // **No deterministic draft anywhere** (D-0077 rule 4.2): the stand-in's lead is gone.
  expect(html).not.toContain("Please fix what the model review raised");
  expect(bar).toMatch(
    /<p id="revise-draft-state" data-draft-state="revise:i-0001:gate-i-0001"[^>]*>rondo drafted this from what the review found\./,
  );
  // The note for a draft that lands over the person's own words is drawn
  // hidden, for the composer script to show (rule 4.4).
  expect(bar).toMatch(
    /<p id="revise-draft-arrived" data-draft-arrived="revise:i-0001:gate-i-0001" hidden/,
  );
  expect(box).not.toContain("maxlength");
  // The change is offered, and approve is not refused by it: the same form
  // posting to the same address, whatever the model raised (D-0065 as
  // annotated). What rondo#237 moved is the face, not the press -- the answer
  // carried to the gate is still 'approve'.
  expect(bar).toContain(">approve despite what was raised</button>");
  expect(bar).toContain("title=\"answers gate gate-i-0001 as 'approve'");
  expect(bar).not.toContain('id="revise-none"');
  // **The press against a finding is outlined in amber, and never filled in
  // it** (D-0083 rule 10, rondo#314): the fill is what says *this is the
  // press*, and amber is what says *a person must act* -- the bar's own rule
  // carries that, so the colour is not also spent on the button's whole area.
  expect(bar).toMatch(
    /<button type="submit"[^>]*class="[^"]*border-wait[^"]*">approve despite what was raised</,
  );
  expect(bar).not.toMatch(/<button type="submit"[^>]*class="[^"]*bg-wait /);
  expect(bar.slice(0, bar.indexOf(">"))).toContain("border-t-2 border-wait");
});

test("a lap admitted under no approval is told so where the change would be (#233 S4)", async () => {
  const world = fresh();
  await gateWithChecks(world);
  await modelFindings(world);
  const html = await operatorPage(
    { ...portsOver(world, "ada", []), material: structured },
    "t",
    { kind: "summary" },
    EN,
    null,
    null,
    () => "lap-00000000-0000-4000-8000-000000000002",
  );
  expect(html).toContain('id="revise-none"');
  expect(html).toContain("has no budget to be counted against");
  expect(html).not.toContain('id="revise-form"');
  // Approving is untouched by the absence of the other answer.
  expect(html).toContain(">approve despite what was raised</button>");
});

/**
 * The lap at the gate admitted under an approval of one lap, which it spent
 * (D-0074 rule 4.1): a request, its scope and approval, and the admission row.
 */
async function spentGate(world: ReturnType<typeof fresh>): Promise<void> {
  await seedScopeRequest(world, "m-req", "Fix the parser.");
  await gateWithChecks(world);
  await modelFindings(world);
  world.connection
    .prepare(
      "UPDATE iteration SET request_message_id = 'm-req', agent_type_digest = ? WHERE id = 'i-0001'",
    )
    .run(`sha256:${"a".repeat(64)}`);
  const payload = scopePayloadWithDefaults({
    requests: ["m-req"],
    workspaces: [{ repository: "/srv/repo", workspace_root: "/srv/work" }],
    agent_types: [`sha256:${"a".repeat(64)}`],
    budgets: {
      laps: 1,
      review_rounds: 3,
      cost_usd: 7.5,
      cost_reserve_usd: 2.5,
      expires_at_ms: 4_000_000_000_000,
    },
    severity_threshold: "major",
    outward_acts: [],
    irreversible_additions: [],
  } as JsonRecord);
  expect(
    await world.record.recordScope({
      scopeId: "s-1",
      payload,
      supersedesScopeId: null,
      authorKind: "operator",
      authorId: "ada",
      bases: [],
      createdAtMs: 1,
      agentTypeRecords: [],
    }),
  ).toEqual({ kind: "recorded" });
  expect(
    await world.record.recordScopeDecision({
      scopeDecisionId: "sd-1",
      scopeId: "s-1",
      scopeDigest: contentDigest(payload as unknown as JsonRecord),
      outcome: "approved",
      actorId: "ada",
      recordedBy: "rondo/web",
      decidedAtMs: 2,
    }),
  ).toEqual({ kind: "recorded" });
  world.connection
    .prepare(
      "INSERT INTO scope_consumption (scope_decision_id, act_kind, subject_id, proposal_id, " +
        "consumed_at_ms) VALUES ('sd-1', 'admission', 'i-0001', NULL, 3)",
    )
    .run();
}

test("no draft is paid for where a spent budget draws the way to raise it instead of the form (D-0077 rule 2.1)", async () => {
  const world = fresh();
  await spentGate(world);
  expect(await draftRevise(world, REVISE_ANSWER, { admitted: "sd-1" })).toHaveLength(0);
  expect(reviseRows(world)).toHaveLength(0);
});

test("a gate whose approval is spent says which budget and offers to raise it, instead of a change it would refuse (D-0074 rule 4.1)", async () => {
  const world = fresh();
  await spentGate(world);
  const gate = async () =>
    await operatorPage(
      { ...portsOver(world, "ada", []), material: structured },
      "t",
      { kind: "summary" },
      EN,
      null,
      null,
      () => "lap-00000000-0000-4000-8000-000000000004",
    );
  const html = await gate();
  expect(html).toContain('id="raise"');
  expect(html).toContain("the one attempt you approved is used");
  expect(html).toContain("Nothing has been asked or spent.");
  expect(html).toContain(">Raise this approval's budget</a>");
  expect(html).toContain("/?scope=m-req&amp;raise=sd-1&amp;gate=i-0001&amp;lang=en");
  // No press that would be refused, and approving is untouched.
  expect(html).not.toContain('id="revise-form"');
  expect(html).toContain(">approve despite what was raised</button>");
  // D-0076: nothing rondo made is in the sentence.
  const opened = html.indexOf("<p", html.indexOf('id="raise"'));
  const said = html.slice(html.indexOf(">", opened) + 1, html.indexOf("</p>", opened));
  expect(said).not.toMatch(/sd-1|scope|\blap|\bgate/);

  // Raised: the change is offered again, and spends the new approval.
  const first = await world.record.readScope("s-1");
  if (first.kind !== "read") throw new Error("the fixture scope did not read");
  const payload = scopePayloadWithDefaults({
    ...(first.scope.payload as unknown as JsonRecord),
    budgets: { ...first.scope.payload.budgets, laps: 3 },
  } as JsonRecord);
  await world.record.recordScope({
    scopeId: "s-2",
    payload,
    supersedesScopeId: "s-1",
    authorKind: "operator",
    authorId: "ada",
    bases: [{ form: "scope", scopeId: "s-1" }],
    createdAtMs: 5,
    agentTypeRecords: [],
  });
  await world.record.recordScopeDecision({
    scopeDecisionId: "sd-2",
    scopeId: "s-2",
    scopeDigest: contentDigest(payload as unknown as JsonRecord),
    outcome: "approved",
    actorId: "ada",
    recordedBy: "rondo/web",
    decidedAtMs: 6,
  });
  const after = await gate();
  expect(after).not.toContain('id="raise"');
  expect(after).toContain('<input type="hidden" name="scope_decision" value="sd-2"/>');
});

test("the raise screen shows what was approved and used, redraws the budgets, and posts only budgets (D-0074 rule 4.2)", async () => {
  const world = fresh();
  await spentGate(world);
  const view = {
    kind: "scope" as const,
    messageId: "m-req",
    rounds: null,
    decisionId: null,
    plan: null,
    raise: { decisionId: "sd-1", iterationId: "i-0001" },
  };
  const html = await operatorPage(
    portsOver(world, "ada", []),
    "t",
    view,
    EN,
    null,
    () => "scope-00000000-0000-4000-8000-000000000001",
    null,
  );
  expect(html).toContain("Only the budget changes");
  expect(html).toContain("Up to 1 attempt and $7.50");
  expect(html).toContain("Used so far: 1 attempt and $0.00, with 1 whose cost is not known yet.");
  expect(html).toContain("The new budget counts from now on.");
  expect(html).toContain("the earlier approval starts nothing new");
  expect(html).toContain('<form id="raise-form" method="post" action="/raise?lang=en"');
  expect(html).toContain('<input type="hidden" name="raise" value="sd-1"/>');
  expect(html).toContain('<input type="hidden" name="iteration" value="i-0001"/>');
  expect(html).toContain(
    '<input type="hidden" name="scope_id" value="scope-00000000-0000-4000-8000-000000000001"/>',
  );
  // The five budgets, rounds editable here; nothing else the scope holds is a box.
  for (const name of ["laps", "review_rounds", "cost_usd", "cost_reserve_usd", "expires_at_ms"]) {
    expect(html).toContain(`name="${name}"`);
  }
  expect(html).not.toMatch(/name="review_rounds"[^>]*readonly/);
  expect(html).not.toContain('name="severity_threshold"');
  expect(html).not.toContain('name="outward_acts"');
  expect(html).not.toContain(">Record and approve");
  expect(html).toContain(">Raise the budget</button>");
  // The address carries the state, so the language switch keeps it.
  expect(viewHref(view, "ja")).toBe("/?scope=m-req&raise=sd-1&gate=i-0001&lang=ja");

  // Somebody raised it already: no form, and the way back to the gate.
  world.connection
    .prepare(
      "INSERT INTO scope (scope_id, payload, scope_digest, supersedes_scope_id, author_kind, " +
        "author_id, bases, created_at_ms) SELECT 's-2', payload, scope_digest, 's-1', author_kind, " +
        "author_id, bases, created_at_ms FROM scope WHERE scope_id = 's-1'",
    )
    .run();
  world.connection
    .prepare(
      "INSERT INTO scope_decision (scope_decision_id, scope_id, scope_digest, outcome, actor_id, " +
        "recorded_by, decided_at_ms) SELECT 'sd-2', 's-2', scope_digest, 'approved', actor_id, " +
        "recorded_by, decided_at_ms FROM scope_decision WHERE scope_decision_id = 'sd-1'",
    )
    .run();
  const stale = await operatorPage(
    portsOver(world, "ada", []),
    "t",
    view,
    EN,
    null,
    () => "scope-00000000-0000-4000-8000-000000000002",
    null,
  );
  expect(stale).toContain("This budget has already been raised");
  expect(stale).not.toContain('id="raise-form"');
  // The way back to the gate, which since D-0083 rule 3 is the request's thread.
  expect(stale).toContain('href="/?thread=m-req&amp;lang=en"');
});

test("with no minted lap id there is no change form at all (#233 S4)", async () => {
  const world = fresh();
  await gateWithChecks(world);
  await modelFindings(world);
  const html = await operatorPage(
    { ...portsOver(world, "ada", [], null, "decision-1"), material: structured },
    "t",
    { kind: "summary" },
  );
  expect(html).not.toContain('id="revise-form"');
  expect(html).not.toContain('id="revise-none"');
});

test("a gate with no model findings drafts nothing, and still offers the change (#233 S4)", async () => {
  const world = fresh();
  await gateWithChecks(world);
  const appended = await world.store.appendReading(
    "i-0001",
    {
      drafter: "rondo/model/1/gpt-6-astra",
      verdict: "clear",
      findings: [],
      graded: [],
      evidence: EVIDENCE,
      unavailableReason: null,
    },
    4_000,
  );
  expect(appended.kind).toBe("appended");
  const html = await operatorPage(
    { ...portsOver(world, "ada", [], null, "decision-1"), material: structured },
    "t",
    { kind: "summary" },
    EN,
    null,
    null,
    () => "lap-00000000-0000-4000-8000-000000000003",
  );
  const bar = barOf(html);
  expect(bar).toContain('id="revise-form"');
  // An empty box with its example, and no lead line about findings there are none of.
  expect(bar).toMatch(/<textarea name="body"[^>]*><\/textarea>/);
  expect(bar).not.toContain("Please fix what the model review raised:");
  expect(bar).toContain("keep the change to the parser");
  // **It is a press here too, and it is the outlined one** (rondo#351): with
  // nothing raised, approve is the recommendation, so the filled press is
  // approve and the change is the other answer beside it.
  expect(bar).toMatch(
    /<button type="submit"[^>]*class="[^"]*bg-background[^"]*">Ask for a change</,
  );
  expect(bar).toMatch(/<button type="submit"[^>]*class="[^"]*bg-foreground[^"]*">approve</);
});

test("the change is offered in the page's language, and the findings stay the reviewer's words (#233 S4)", async () => {
  const world = fresh();
  await gateWithChecks(world);
  await modelFindings(world);
  const html = await operatorPage(
    { ...portsOver(world, "ada", [], null, "decision-1"), material: structured },
    "t",
    { kind: "summary" },
    chromeFor("ja"),
    null,
    null,
    () => "lap-00000000-0000-4000-8000-000000000004",
  );
  const bar = barOf(html);
  // The change is a press in Japanese too, and not a fold (rondo#351).
  expect(bar).toContain(">変更を依頼する</button>");
  expect(bar.slice(bar.indexOf('id="revise"'))).not.toContain("<details");
  // Before a draft lands, the box is empty and the view says one is coming,
  // in the page's language (D-0077 rule 4.3).
  expect(bar).toMatch(/<textarea name="body"[^>]*><\/textarea>/);
  expect(bar).toContain("変更内容の下書きを作成中です");

  await draftRevise(world, REVISE_ANSWER);
  const drafted = await operatorPage(
    { ...portsOver(world, "ada", [], null, "decision-1"), material: structured },
    "t",
    { kind: "summary" },
    chromeFor("ja"),
    null,
    null,
    () => "lap-00000000-0000-4000-8000-000000000004",
  );
  const box = drafted.slice(drafted.indexOf('id="answer-bar"'));
  // Quoted, not translated (D-0055 rule 4): the finding and its basis as given.
  expect(box).toContain("- 阻害: the loop never stops");
  expect(box).toContain("場所: src/notifier.ts:41");
  expect(box).toContain("直すこと: Cap the backoff at 30 seconds.");
  expect(box).not.toContain("モデルレビューが挙げた点を直してください");
});

test("a draft is being written: an empty box, a sentence, and the press not held back (D-0077 rule 4.3)", async () => {
  const world = fresh();
  await gateWithChecks(world);
  await modelFindings(world);
  const html = await operatorPage(
    { ...portsOver(world, "ada", [], null, "decision-1"), material: structured },
    "t",
    { kind: "summary" },
    EN,
    null,
    null,
    () => "lap-00000000-0000-4000-8000-000000000005",
  );
  const bar = barOf(html);
  expect(bar).toMatch(/<textarea name="body"[^>]*><\/textarea>/);
  expect(bar).toContain("A draft of what to change is being written");
  expect(bar).toContain(">Ask for a change</button>");
  // No finding is put in the box by anyone but the drafter.
  expect(bar).not.toContain("- [blocker] the loop never stops");
});

test("a draft that misses a finding is not shown and not repaired: an empty box and why, in a closed fold (D-0077 rule 4.1)", async () => {
  const world = fresh();
  await gateWithChecks(world);
  await modelFindings(world);
  // Addresses finding 1 only.
  await draftRevise(world, { lead: null, findings: [{ finding: 1, change: "Stop it." }] });
  const html = await operatorPage(
    { ...portsOver(world, "ada", [], null, "decision-1"), material: structured },
    "t",
    { kind: "summary" },
    EN,
    null,
    null,
    () => "lap-00000000-0000-4000-8000-000000000006",
  );
  const bar = barOf(html);
  expect(bar).toMatch(/<textarea name="body"[^>]*><\/textarea>/);
  expect(bar).not.toContain("Stop it.");
  expect(bar).toContain("rondo could not draft what to change this time");
  // rondo's own reason is in the one closed fold, never inline (D-0076 rule 4.5).
  expect(bar).toMatch(
    /<details id="revise-why" class="group"><summary[^>]*>[\s\S]*?For whoever maintains rondo on this machine<\/summary><p[^>]*>the draft was refused \(D-0077 rule 4\.1\): finding 2 is not addressed<\/p><\/details>/,
  );
  expect(bar.replace(/<details id="revise-why"[\s\S]*?<\/details>/, "")).not.toContain(
    "finding 2 is not addressed",
  );
  expect(bar).not.toContain('id="revise-draft-arrived"');
});

test("a model reading not yet taken is said as pending, beside the checks and by the button (#220 S2)", async () => {
  const world = fresh();
  await gateWithChecks(world);
  const html = await operatorPage({ ...portsOver(world, "ada", []), material: structured }, "t", {
    kind: "summary",
  });
  expect(html).toContain("Not here yet; it may still arrive.");
  expect(html).not.toContain("reading it first");
  expect(html).toContain('href="/?thread=req-1&amp;lang=en" class="font-medium text-link');
  expect(html).toContain("The model review may still arrive.");
  expect(html).not.toContain('id="model-raised"');
});

test("an unavailable model reading of these commits is its outcome, not a pending one (#220 S2)", async () => {
  const world = fresh();
  await gateWithChecks(world);
  const appended = await world.store.appendReading(
    "i-0001",
    {
      drafter: "rondo/model/1/gpt-6-astra",
      verdict: "unavailable",
      findings: [],
      evidence: null,
      unavailableReason: "the plan names no review criterion",
    },
    4_000,
  );
  expect(appended.kind).toBe("appended");
  const html = await operatorPage({ ...portsOver(world, "ada", []), material: structured }, "t", {
    kind: "summary",
  });
  expect(html).toContain("the plan names no review criterion");
  expect(html).toContain("No reading could be taken, so there is nothing from it to weigh.");
  expect(html).toContain("Only the checks read this; the model review was not taken.");
  expect(html).not.toContain("may still arrive");
  expect(html).not.toContain("earlier commits");
  // **And when the checks could not read it either, the bar does not say they
  // did** (#220 S2, Codex).
  // The deterministic reading lands with a transition (D-0029 rule 8).
  const checksGone = await world.store.transition(
    "i-0001",
    "awaiting_human",
    "awaiting_human",
    {},
    5_000,
    {
      drafter: "rondo/deterministic/2",
      verdict: "unavailable",
      findings: [],
      evidence: null,
      unavailableReason: "the workspace could not be read",
    },
  );
  expect(checksGone.kind).toBe("transitioned");
  const neither = await operatorPage(
    { ...portsOver(world, "ada", []), material: structured },
    "t",
    { kind: "summary" },
  );
  expect(neither).toContain("Neither the checks nor the model review could read this work.");
  expect(neither).not.toContain("Only the checks read this");
});

// -- The three residues S2 left on the gate screen (rondo#237) --

test("approve says which of the two approvals it is when a blocker is open (#237)", async () => {
  const world = fresh();
  await gateWithChecks(world);
  await modelFindings(world);
  const ports = { ...portsOver(world, "ada", []), material: structured };
  const html = await operatorPage(ports, "t", { kind: "summary" });
  const bar = barOf(html);

  // **The face moves; the press does not.** D-0065 refuses no approval over a
  // model finding, so this is still one form, to the same address, answering
  // the gate as 'approve' -- and the red line it is read beside is still there.
  expect(bar).toContain(">approve despite what was raised</button>");
  expect(bar).not.toContain(">approve</button>");
  expect(bar).toContain(
    "Accept this work as it is, with what the model review raised left unanswered.",
  );
  expect(bar).toContain("title=\"answers gate gate-i-0001 as 'approve'");
  expect(bar).toContain('<form id="approve-form" method="post" action="/?lang=en"');
  expect(bar).toContain("The model review raised 1 blocker and 1 major.");

  // **A major on its own moves it too**, which is what D-0065's threshold is.
  const majorOnly = fresh();
  await gateWithChecks(majorOnly);
  const only = await majorOnly.store.appendReading(
    "i-0001",
    {
      drafter: "rondo/model/1/gpt-6-astra",
      verdict: "concerns",
      findings: ["the backoff is not capped"],
      graded: [{ severity: "major", bases: [], basisResolved: false }],
      evidence: EVIDENCE,
      unavailableReason: null,
    },
    4_000,
  );
  expect(only.kind).toBe("appended");
  const major = await operatorPage(
    { ...portsOver(majorOnly, "ada", []), material: structured },
    "t",
    { kind: "summary" },
  );
  expect(major).toContain(">approve despite what was raised</button>");
});

test("with nothing that heavy raised, approve keeps its one word (#237)", async () => {
  const world = fresh();
  await gateWithChecks(world);
  // A nit is a finding and not an override: the threshold is blocker or major.
  const appended = await world.store.appendReading(
    "i-0001",
    {
      drafter: "rondo/model/1/gpt-6-astra",
      verdict: "concerns",
      findings: ["a typo"],
      graded: [{ severity: "nit", bases: [], basisResolved: false }],
      evidence: EVIDENCE,
      unavailableReason: null,
    },
    4_000,
  );
  expect(appended.kind).toBe("appended");
  const html = await operatorPage({ ...portsOver(world, "ada", []), material: structured }, "t", {
    kind: "summary",
  });
  const bar = barOf(html);
  expect(bar).toContain(">approve</button>");
  expect(bar).toContain("Accept this work as it is.");
  expect(bar).not.toContain("despite");
  expect(html).not.toContain('id="model-raised"');
  // **With nothing raised the press is ink, and it is the filled one**
  // (D-0083 rule 10, rondo#314).
  expect(bar).toMatch(/<button type="submit"[^>]*class="[^"]*bg-foreground[^"]*">approve</);
  // Nothing was raised, so no card is edged in red (D-0082 rule 2).
  expect(html).not.toContain("border-l-fail");
});

test("the qualified approve is in the page's language too (#237)", async () => {
  const world = fresh();
  await gateWithChecks(world);
  await modelFindings(world);
  const html = await operatorPage(
    { ...portsOver(world, "ada", []), material: structured },
    "t",
    { kind: "summary" },
    chromeFor("ja"),
  );
  const bar = barOf(html);
  expect(bar).toContain(">指摘を残したまま承認する</button>");
  expect(bar).toContain("モデルレビューが挙げた点に答えないまま、この作業をこのまま受け入れます。");
  // The answer carried to the gate is a token and stays ASCII (D-0055 rule 3).
  expect(bar).toContain("'approve'");
});

test("a lap nobody approved says nothing about what was raised (#237)", async () => {
  const world = fresh();
  await gateWithChecks(world);
  await modelFindings(world);
  // The same readings, and a gate that ended without a person saying yes: the
  // line is about an override, and nothing was overridden here.
  const closed = await world.store.transition(
    "i-0001",
    "awaiting_human",
    "closed",
    { gateOutcome: "withdrawn" },
    5_000,
  );
  expect(closed.kind).toBe("transitioned");
  const html = await operatorPage(portsOver(world, "ada", []), "t", { kind: "summary" });
  expect(html).not.toContain("open in the model review");
});

/** A lap at its gate whose deterministic reading raised nothing at all. */
async function gateWithClearChecks(world: ReturnType<typeof fresh>): Promise<void> {
  await reserve(world, "i-0001", "add a retry budget");
  await openGate(world, "i-0001");
  const carried = await world.store.transition(
    "i-0001",
    "awaiting_human",
    "awaiting_human",
    {},
    3_000,
    {
      drafter: "rondo/deterministic/2",
      verdict: "clear",
      findings: [],
      evidence: EVIDENCE,
      unavailableReason: null,
    },
  );
  expect(carried.kind).toBe("transitioned");
}

/**
 * The class a pill was drawn with, so a test can see its tone and not only its
 * words (rondo#243, the model review's major on lap 10).
 *
 * **Because the wording alone does not seal the fix.** rondo#237 is two
 * changes at once: over work that cannot be read, a `clear` stops saying
 * *nothing raised* **and** stops being green. The tests asserted the first and
 * never the second, so a regression that restored the green pill while keeping
 * the new sentence -- or that kept a verdict's colour where only its words were
 * meant to change -- would pass the suite unchanged. The tone is the half a
 * person reads first across a room.
 */
function pillTone(html: string, text: string): string {
  const at = html.indexOf(`>${text}</span>`);
  expect(at).toBeGreaterThan(-1);
  const opens = '<span class="';
  const open = html.lastIndexOf(opens, at);
  expect(open).toBeGreaterThan(-1);
  return html.slice(open + opens.length, html.indexOf('"', open + opens.length));
}

test("a recorded 'clear' is not drawn as a pass over work that cannot be read (#237)", async () => {
  const world = fresh();
  await gateWithClearChecks(world);
  const gone = async () =>
    await Promise.resolve({
      lines: ["work    rondo/i-0001"],
      why: null,
      work: {
        kind: "unreadable" as const,
        part: "history" as const,
        reason: "neither refs/remotes/origin/main nor refs/heads/main is a ref in /srv/work",
      },
    });
  const html = await operatorPage({ ...portsOver(world, "ada", []), material: gone }, "t", {
    kind: "summary",
  });

  // **Not in the card and not in the bar** -- the bar is the one a person
  // scanning reads, and it kept the green pill through S2.
  expect(html).not.toContain(">nothing raised</span>");
  const card = html.slice(html.indexOf('<section id="checks"'));
  const bar = barOf(html);
  expect(card).toContain(">not matched</span>");
  expect(bar).toContain(">not matched</span>");
  // **And the tone, beside the words** (rondo#243). A pill that said *not
  // matched* in the green a pass is drawn in would be the same claim back.
  for (const where of [card, bar]) {
    expect(pillTone(where, "not matched")).toContain("text-muted-foreground");
    expect(pillTone(where, "not matched")).not.toContain("text-ok");
  }
  // And the sentence that says why is still beside the count it disagrees with.
  expect(html).toContain(
    "What changed cannot be read now, so this reading cannot be matched against the work.",
  );
  expect(html).toContain("Read 2 commits and 1 file.");

  // Read, and the verdict is the verdict: nothing else about the card moved.
  const read = await operatorPage({ ...portsOver(world, "ada", []), material: structured }, "t", {
    kind: "summary",
  });
  expect(read).toContain(">nothing raised</span>");
  expect(read).not.toContain(">not matched</span>");
  // Read, and the pass is green again: the colour is the verdict's, and it
  // comes back with the work rather than being muted for good.
  expect(pillTone(read, "nothing raised")).toContain("text-ok");
});

test("a reading that raised something keeps its own word where the work is gone (#237)", async () => {
  const world = fresh();
  await gateWithChecks(world);
  const gone = async () =>
    await Promise.resolve({
      lines: ["work    rondo/i-0001"],
      why: null,
      work: {
        kind: "unreadable" as const,
        part: "history" as const,
        reason: "the workspace is not a git repository",
      },
    });
  const html = await operatorPage({ ...portsOver(world, "ada", []), material: gone }, "t", {
    kind: "summary",
  });
  // `1 raised` is not a pass, so it is not replaced -- only its colour goes.
  expect(html).toContain(">1 raised</span>");
  expect(html).not.toContain(">not matched</span>");
  // **"Only its colour goes" is the claim, so the colour is what is asserted**
  // (rondo#243): muted where the work is gone, and the verdict's own amber
  // where it is there. Neither of those was under test before.
  expect(pillTone(html, "1 raised")).toContain("text-muted-foreground");
  const read = await operatorPage({ ...portsOver(world, "ada", []), material: structured }, "t", {
    kind: "summary",
  });
  expect(pillTone(read, "1 raised")).toContain("text-wait-ink");
  expect(pillTone(read, "1 raised")).not.toContain("text-muted-foreground");
});

test("what the fence blocked is on the gate, each call in words, not only in the text fold (#220 S2)", async () => {
  const world = fresh();
  await gateWithChecks(world);
  const html = await operatorPage({ ...portsOver(world, "ada", []), material: structured }, "t", {
    kind: "summary",
  });
  // The fence is on the right face since rondo#350, above the checks; what it
  // says about each call is unchanged, and the text fold is still in the box.
  const card = html.slice(html.indexOf('<section id="fence"'), html.indexOf('id="checks"'));
  expect(card).toContain("The fence:");
  expect(card).toContain("blocked 1 command");
  expect(card).toContain("Bash  &quot;rm -rf /srv&quot;");
  expect(html).toContain("The full record as text, including what is not shown above");
});

test("what a reading did not look at is beside its verdict and not behind a fold (D-0082 rule 7)", async () => {
  // **The shape rondo#317 names**: a pill saying *1 raised* is read as "a check
  // happened", and the sentence saying which check cannot happen at all -- the
  // one rondo#69 was opened for -- was in a shut `<details>` on both cards. It
  // is what a person needs in order to press honestly, so rule 7 keeps it out
  // of the fold; `rondo answer`'s report has printed it beside the verdict all
  // along (`src/refrain/interpreter.ts`).
  const world = fresh();
  await gateWithChecks(world);
  await modelFindings(world);
  const html = await operatorPage({ ...portsOver(world, "ada", []), material: structured }, "t", {
    kind: "summary",
  });
  const checks = html.slice(html.indexOf('id="checks"'), html.indexOf('id="model-review"'));
  const model = html.slice(html.indexOf('id="model-review"'), html.indexOf(EN.readingsNote));
  // The label the summary carried is still there, and the sentences under it
  // are readable where the verdict is: neither card holds a fold at all now.
  for (const card of [checks, model]) {
    expect(card).toContain(EN.whatItRead);
    expect(card).not.toContain("<details");
  }
  expect(checks).toContain("It built nothing, ran nothing and tested nothing");
  expect(checks).toContain("neither checked nor claimed here");
  expect(model).toContain("ran nothing itself");
  expect(model).toContain("that it was understood is not provable");
});
