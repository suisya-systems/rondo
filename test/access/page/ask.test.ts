/**
 * Asking rondo on the page (rondo#401, D-0177): the "?" beside every message
 * and beside the try on the right face, the reply box in question mode, the
 * reply box's second submit, the band over an explainer answer, and a cited
 * lap that leads to where its gate is answered.
 */
import { expect, test } from "vitest";

import { answerBands, gatesOf } from "../../../src/access/page/ask.js";
import { basisWord } from "../../../src/access/page/vocabulary.js";
import { threadsOf } from "../../../src/access/page-logic/threads.js";
import { chromeFor, EN } from "../../../src/access/wording.js";
import {
  EXPLAINER_PREFIX,
  type IterationRecord,
  type ProposalDraft,
} from "../../../src/store/records.js";
import { fresh, mint, openGate, operatorPage, portsOver, reserve } from "../page-world.js";

const EXPLAINER = `${EXPLAINER_PREFIX}1/claude-sonnet-5`;
const QUESTION = "question-00000000-0000-4000-8000-000000000003";

/** A request with its lap at the gate, a note citing the lap, a question and its answer. */
async function asked(snapshot: ProposalDraft["snapshot"] = { cost_usd: 0.03, cap_usd: 0.5 }) {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  await openGate(world, "i-0001");
  const write = async (draft: Parameters<typeof world.record.recordThreadMessage>[0]) => {
    const outcome = await world.record.recordThreadMessage(draft);
    expect(outcome.kind, JSON.stringify(outcome)).toBe("recorded");
  };
  await write({
    messageId: "note-1",
    body: "The lap is waiting at its gate.",
    authorKind: "drafter",
    authorId: "rondo/advisory/deterministic",
    inReplyTo: "req-i-0001",
    atMs: 600,
    bases: [{ form: "iteration", iterationId: "i-0001" }],
    asks: false,
  });
  await write({
    messageId: QUESTION,
    body: "What does this mean?",
    authorKind: "operator",
    authorId: "ada",
    inReplyTo: "note-1",
    atMs: 700,
    bases: [{ form: "message", messageId: "note-1" }],
    asks: false,
  });
  const answered = await world.record.recordAnswer({
    questionId: QUESTION,
    drafterPrefix: EXPLAINER_PREFIX,
    proposal: {
      proposalId: "explanation-1",
      kind: "explanation",
      drafter: EXPLAINER,
      payload: { claims: [] },
      snapshot,
      derivation: "model",
      iterationId: null,
      supersedesIterationId: null,
      supersedesProposalId: null,
      predecessorPlanDigest: null,
      predecessorContractDigest: null,
      agentTypeDigest: null,
      configDigest: null,
      contractDigest: null,
      continuoRevision: null,
      cadenzaRevision: null,
      elevatedFromMessageId: null,
      elevatedByActorId: null,
      createdAtMs: 800,
    },
    message: {
      messageId: "answer-1",
      body: "It means the lap waits for you.",
      authorKind: "drafter",
      authorId: EXPLAINER,
      inReplyTo: QUESTION,
      atMs: 800,
      bases: [
        { form: "message", messageId: QUESTION },
        { form: "proposal", proposalId: "explanation-1" },
      ],
      asks: false,
    },
    claim: null,
  });
  expect(answered.kind).toBe("answered");
  return world;
}

const thread = (to: string | null, ask?: string) =>
  ({
    kind: "thread",
    messageId: "req-i-0001",
    to,
    ...(ask === undefined ? {} : { ask }),
  }) as const;

const page = async (world: ReturnType<typeof fresh>, view = thread(null), wording = EN) =>
  await operatorPage(portsOver(world), "t", view, wording, mint);

/** The reply box's form, as drawn. */
const composer = (html: string): string =>
  /<form id="composer"[\s\S]*?<\/form>/.exec(html)?.[0] ?? "";

test('every message carries a "?" that asks about it, and the try on the right face carries one', async () => {
  const html = await page(await asked());
  for (const id of ["req-i-0001", "note-1", QUESTION, "answer-1"]) {
    const article = new RegExp(`<article id="${id}"[\\s\\S]*?</article>`).exec(html)?.[0] ?? "";
    expect(article, id).toContain('class="msg-ask"');
    expect(article, id).toContain(`ask=message%3A${encodeURIComponent(id)}`);
  }
  // Labelled, never a bare mark; and no id on screen.
  expect(html).toContain(">? What does this mean</a>");
  expect(html).toMatch(/<p class="side-ask"><a class="ask" href="[^"]*ask=iteration%3Ai-0001/);
});

test('with no write port there is no "?" to press', async () => {
  const world = await asked();
  const html = await operatorPage(portsOver(world), null, thread(null), EN, null);
  expect(html).not.toContain("msg-ask");
  expect(html).not.toContain('class="ask"');
});

test('a "?" puts the reply box in question mode: human words, the locator hidden, posted to /question', async () => {
  const html = await page(await asked(), thread("note-1", "message:note-1"));
  const form = composer(html);
  expect(form).toContain('action="/question?lang=en"');
  expect(form).toContain('<input type="hidden" name="about" value="message:note-1"/>');
  expect(form).toContain('<input type="hidden" name="in_reply_to" value="note-1"/>');
  expect(form).toContain('data-draft-take="ask:message:note-1"');
  expect(form).toContain(
    "What does this mean?\nAbout: &quot;The lap is waiting at its gate.&quot;</textarea>",
  );
  // Asking is never the answering press, and it has no second submit.
  expect(form).not.toContain('name="outcome"');
  expect(form).not.toContain('formaction="');
  expect(form).toContain(">Ask rondo</button>");
  // **A question keeps its own draft**: pressing "?" leaves an unsent reply
  // under the reply's key, and leaving question mode leaves the question here.
  expect(form).toContain('data-draft="ask:req-i-0001"');
  // The way out is back to the thread's default box.
  expect(form).toContain('href="/?thread=req-i-0001&amp;lang=en"');
});

test('a "?" on a lap asks about it with no quote, and in Japanese keeps lang=ja', async () => {
  const ja = chromeFor("ja");
  const html = await page(await asked(), thread(null, "iteration:i-0001"), ja);
  const form = composer(html);
  expect(form).toContain('action="/question?lang=ja"');
  expect(form).toContain('name="about" value="iteration:i-0001"');
  expect(form).toContain(`${ja.askPrefill}</textarea>`);
});

test("an unreadable ask leaves the box an ordinary reply", async () => {
  const form = composer(await page(await asked(), thread(null, "nonsense")));
  expect(form).toContain('action="/reply?lang=en"');
  expect(form).not.toContain('name="about"');
});

test("an ordinary reply box can send its words as a question", async () => {
  const form = composer(await page(await asked(), thread("note-1")));
  expect(form).toContain('action="/reply?lang=en"');
  expect(form).toContain('formaction="/question?lang=en"');
  expect(form).not.toContain('name="about"');
  expect(form).toContain('data-draft="reply:req-i-0001"');
  // Both submits are disabled while a send is in flight: htmx's `find` takes one match.
  expect(form).toContain(
    "hx-disabled-elt=\"find button[type='submit']:not([formaction]), find button[formaction]\"",
  );
});

test("an explainer answer is drawn under its band, with what it cost", async () => {
  const html = await page(await asked());
  const answer = /<article id="answer-1"[\s\S]*?<\/article>/.exec(html)?.[0] ?? "";
  expect(answer).toContain(
    '<p class="msg-band" role="note"><b>Explanation, not an approval or a decision</b>' +
      "<span>This answer cost $0.03.</span></p>",
  );
  // Only an answer of the explainer's carries one.
  expect(html.match(/class="msg-band"/g)).toHaveLength(1);
});

test("under its band the page draws the answer without the band and cost its body repeats", async () => {
  const html = await page(await asked({ cost_usd: 0.03, cap_usd: 0.5, page: "It means waiting." }));
  const answer = /<article id="answer-1"[\s\S]*?<\/article>/.exec(html)?.[0] ?? "";
  expect(answer).toContain('<p lang="">It means waiting.</p>');
  expect(answer).not.toContain("It means the lap waits for you.");
});

test("the band says a free answer cost nothing, and an unreported one what was counted", async () => {
  const bands = async (snapshot: ProposalDraft["snapshot"]) => {
    const world = await asked(snapshot);
    const read = await world.record.threadMessages();
    if (read.kind !== "read") throw new Error("unread");
    return (await answerBands(world.record, read.messages, EN)).get("answer-1")?.cost;
  };
  expect(await bands({ cost_usd: null, cap_usd: 0.5, unexplained: { kind: "noApproval" } })).toBe(
    EN.answerFree,
  );
  expect(await bands({ cost_usd: null, cap_usd: 0.5, unexplained: { kind: "failed" } })).toBe(
    EN.answerCostUnread("0.50"),
  );
  // A run that never started is not counted, whatever its reason says.
  expect(
    await bands({ cost_usd: null, cap_usd: 0.5, unexplained: { kind: "failed" }, counted: false }),
  ).toBe(EN.answerFree);
  // A read cost over the cap says so in the band, which is all the page shows of it (Codex).
  expect(await bands({ cost_usd: 0.03, cap_usd: 0.5 })).toBe(EN.answerCost("0.03"));
  expect(await bands({ cost_usd: 0.61, cap_usd: 0.5 })).toBe(
    `${EN.answerCost("0.61")} ${EN.explainOverCap("0.50")}`,
  );
});

test("a cited lap waiting at its gate leads to where it is answered", async () => {
  const html = await page(await asked());
  const note = /<article id="note-1"[\s\S]*?<\/article>/.exec(html)?.[0] ?? "";
  expect(note).toContain(
    '<a class="basis" href="/?thread=req-i-0001&amp;gate=i-0001&amp;lang=en#answering"',
  );
});

test("basisWord links a gate's transition and an approval, and names a lap with no gate", () => {
  const threads = threadsOf([], new Set(), new Map());
  const gates = gatesOf([
    { id: "i-1", status: "awaiting_human", gateId: "g-1" },
    { id: "i-2", status: "performing", gateId: null },
  ] as unknown as IterationRecord[]);
  const word = (basis: Record<string, unknown>) =>
    basisWord(EN, basis, threads, "r", "ada", gates).href;
  expect(word({ form: "gateTransition", gateId: "g-1", transitionSeq: 2 })).toBe(
    "/?thread=r&gate=i-1&lang=en#answering",
  );
  expect(word({ form: "iteration", iterationId: "i-2" })).toBeNull();
  expect(word({ form: "scope", scopeId: "s-1" })).toBe("/?scope=r&lang=en");
  // Without a thread there is nowhere to lead.
  expect(basisWord(EN, { form: "scope", scopeId: "s-1" }, threads, null, "ada").href).toBeNull();
});
