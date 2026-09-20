import { expect, test } from "vitest";

import type {} from "../../src/access/inbox.js";
import { chromeFor, EN } from "../../src/access/wording.js";
import type { ThreadMessageDraft } from "../../src/store/records.js";
import {
  bytesOf,
  digestOf,
  fresh,
  keysCode,
  MINTED,
  mint,
  operatorPage,
  portsOver,
  reserve,
  serving,
} from "./page-world.js";

/** The text a browser reads out of an escaped element body. */
const unescaped = (html: string): string =>
  html
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&");

const ROOT_BODY =
  "Please look at the flaky test.\n\n  It fails <b>one run in five</b> & only on CI.\n";
const ASK_BODY = "Which runner should I read first?\n\nThe Linux one has the most failures.";
const LATER_BODY = "noted";

/** A request by `ada`, a drafter's asking reply resting on three locators, and a report that asks nothing. */
async function seedThread(world: ReturnType<typeof fresh>): Promise<void> {
  await reserve(world, "i-0001", "do the thing");
  const drafts = [
    {
      messageId: "request-a",
      body: ROOT_BODY,
      authorKind: "operator",
      authorId: "ada",
      inReplyTo: null,
      atMs: 1_000,
      bases: [],
      asks: false,
    },
    {
      messageId: "ask-b",
      body: ASK_BODY,
      authorKind: "drafter",
      authorId: "rondo-drafter",
      inReplyTo: "request-a",
      atMs: 2_000,
      bases: [
        { form: "message", messageId: "request-a" },
        { form: "iteration", iterationId: "i-0001" },
        { form: "continuoRun", runId: "rondo-i-0001" },
      ],
      asks: true,
    },
    {
      messageId: "report-c",
      body: LATER_BODY,
      authorKind: "drafter",
      authorId: "rondo-drafter",
      inReplyTo: "request-a",
      atMs: 3_000,
      bases: [{ form: "iteration", iterationId: "i-0001" }],
      asks: false,
    },
  ] as const;
  for (const draft of drafts) {
    const outcome = await world.record.recordThreadMessage(draft);
    expect(outcome.kind, JSON.stringify(outcome)).toBe("recorded");
  }
}

/** Every message body the page drew, as a browser reads it. */
const bodiesIn = (html: string): readonly string[] =>
  [...html.matchAll(/<p lang="">([\s\S]*?)<\/p>/g)].map((found) => unescaped(found[1] ?? ""));

/** One message's `<article>`, by its id. */
const messageIn = (html: string, id: string): string =>
  /<article id="[^"]*"[\s\S]*?<\/article>/.exec(
    html.slice(html.indexOf(`<article id="${id}"`)),
  )?.[0] ?? "";

test("the thread runs in the order it happened, and a reply names the line it answers", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  const drafts = [
    ["request-a", "operator", "ada", null, 1_000, false],
    ["report-b", "drafter", "rondo-drafter", "request-a", 2_000, false],
    ["report-c", "drafter", "rondo-drafter", "report-b", 3_000, false],
    ["ask-d", "drafter", "rondo-drafter", "report-c", 4_000, true],
  ] as const;
  for (const [messageId, authorKind, authorId, inReplyTo, atMs, asks] of drafts) {
    const outcome = await world.record.recordThreadMessage({
      messageId,
      body: messageId,
      authorKind,
      authorId,
      inReplyTo,
      atMs,
      bases: authorKind === "drafter" ? [{ form: "iteration", iterationId: "i-0001" }] : [],
      asks,
    });
    expect(outcome.kind, JSON.stringify(outcome)).toBe("recorded");
  }
  const html = await operatorPage(
    portsOver(world, "ada", []),
    "t",
    { kind: "thread", messageId: "request-a", to: null },
    EN,
    mint,
  );

  // **The axis is time** (D-0083 rule 2). rondo#199 used to lift an open ask
  // above the reports that came before it, so a person met the question
  // first; D-0083 replaced that with one stream in the order things happened
  // -- the question is marked where it is, and the box to answer it is under
  // the thread whatever the order.
  expect(bodiesIn(html)).toEqual(["request-a", "report-b", "report-c", "ask-d"]);
  expect(messageIn(html, "ask-d")).toContain("data-waiting");
  // A message drawn right under the one it answers needs no line saying so.
  expect(messageIn(html, "ask-d")).not.toContain("in reply to");
  expect(messageIn(html, "report-c")).not.toContain("in reply to");
});

test("a request thread is drawn whole: every body byte for byte, voices apart, bases as links, the ask marked", async () => {
  const world = fresh();
  await seedThread(world);
  const html = await operatorPage(
    portsOver(world, "ada", []),
    "t",
    { kind: "thread", messageId: "report-c", to: null },
    EN,
    mint,
  );

  // **The words as written, in order, with their paragraphs and their spaces**
  // (D-0061 rule 2.2, rondo#90), and a `<b>` in them is text.
  expect(bodiesIn(html)).toEqual([ROOT_BODY, ASK_BODY, LATER_BODY]);
  expect(html).not.toContain("<b>one run");

  // **Two voices, told apart by more than the prose** (rule 2.3): who wrote it
  // by name, the voice as an attribute, and the column the thread draws it in
  // -- the badge beside the name went with the card the old thread drew.
  const root = messageIn(html, "request-a");
  const ask = messageIn(html, "ask-b");
  const report = messageIn(html, "report-c");
  expect(root).toContain('data-voice="operator"');
  expect(root).toContain('class="msg msg-person"');
  expect(root).toContain(">you</span>");
  expect(ask).toContain('data-voice="drafter"');
  expect(ask).toContain('class="msg msg-rondo"');
  expect(ask).toContain(">rondo-drafter</span>");

  // **The ask that waits is marked, and only it** (rule 2.7): nothing replies to it.
  expect(ask).toContain("data-waiting");
  expect(ask).toContain("Waiting on you");
  expect(root).not.toContain("data-waiting");
  expect(report).not.toContain("data-waiting");

  // **Bases go where they point, never an id to copy**: the cited message by
  // its words and an anchor; a form this page has no view for is said and not
  // linked. A lap used to lead to its section of the reading fold, and with
  // D-0083 there is no page-wide place a lap id leads to, so it is named.
  expect(ask).toContain('href="#request-a"');
  expect(ask).toContain("you: Please look at the flaky test.");
  expect(ask).toMatch(/<span class="basis" title="iteration i-0001">/);
  expect(ask).toMatch(/<span class="basis" title="continuo run rondo-i-0001">/);
  // A report replies to the request, which is how every reply reads by
  // default, so it names no parent line of its own.
  expect(report).not.toContain("in reply to");
  // **A waiting ask is answered on the page** (#220 S1): its own link aims the
  // box at it, labelled as answering, and nothing sends the person to a terminal.
  expect(ask).toContain('id="reply-ask-b"');
  expect(ask).toContain(">Answer</a>");
  expect(html).not.toContain("rondo reply");

  // **No message id is printed as text**: each is an anchor and an attribute.
  for (const id of ["request-a", "ask-b", "report-c"]) {
    expect(html).not.toContain(`>${id}<`);
  }

  // **The box answers the waiting question by default, on a press**: a native
  // `POST` to `/answer-ask` with no `hx-post` (D-0059 section 5a's falsifier,
  // D-0069 rule 5), one button per answer, and a target line of who and when.
  // It carries the id rondo minted -- once, hidden, never shown -- and says
  // it survives the redraw, so no redraw touches a draft.
  expect(html).toContain('<form id="composer" method="post" action="/answer-ask?lang=en" class=');
  expect(html).not.toContain("hx-post");
  expect(html).toContain('<input type="hidden" name="in_reply_to" value="ask-b"/>');
  expect(html.split(MINTED.reply)).toHaveLength(2);
  expect(html).toContain(`<input type="hidden" name="message_id" value="${MINTED.reply}"/>`);
  expect(html).toMatch(/Answering rondo-drafter's question, \d+s ago/);
  // **Two presses, each naming the answer it is** (D-0072 rule 4): the route
  // refuses a press naming neither, so a form with one unnamed button would
  // answer nothing. `name`/`value` on the button is what a native submit sends,
  // so this works with script off.
  // **Filled in ink and not in amber** (D-0083 rule 10, rondo#314): the press
  // is the filled one of the two, and amber is kept for the claim that a
  // person must act rather than spent on every press that exists.
  expect(html).toMatch(
    /<button type="submit" name="outcome" value="carry_on" class="[^"]*bg-foreground[^"]*">Carry on<\/button>/,
  );
  expect(html).toMatch(
    /<button type="submit" name="outcome" value="stop" class="[^"]*">Stop this line<\/button>/,
  );
  // The stop is drawn before the carry-on, so the press that releases work is
  // not the one under the thumb by accident.
  expect(html.indexOf('value="stop"')).toBeLessThan(html.indexOf('value="carry_on"'));
  // And the note under the box says what each of them does.
  expect(html).toContain("Stop this line keeps it stopped");
  // **The send chord is not advertised here** (#206, Codex): it submits without
  // naming a button, so on this one form it would answer nothing -- and it is
  // guarded in `page/composer.js` rather than left to be pressed and refused.
  expect(html).not.toContain("Ctrl/⌘");
  expect(html).not.toContain('class="not-answer');
  // **The redraw does not cost the draft.** The box used to sit outside the
  // element the poll swaps; since D-0083 rule 5 it is inside the thread, so
  // the swap reaches it and `page/composer.js` is what puts the words back --
  // the same mechanism that already covered a send's own swap of this form.
  expect(composerCode()).toContain('"textarea[data-draft]"');
  expect(html).toContain('data-draft="');
  // Every message carries its own way to be replied to, which retargets the box.
  expect(report).toContain('href="/?thread=request-a&amp;to=report-c&amp;lang=en"');
  // The thread polls, but with script off it does not reload a draft away.
  expect(html).toContain('hx-get="/?thread=report-c&amp;lang=en"');
  expect(html).not.toContain('http-equiv="refresh"');
});

test("the reply box points at the message a person chose, and a thread nobody wrote is said", async () => {
  const world = fresh();
  await seedThread(world);
  const ports = portsOver(world, "ada", []);
  const chosen = await operatorPage(
    ports,
    "t",
    { kind: "thread", messageId: "request-a", to: "report-c" },
    EN,
    mint,
  );
  expect(chosen).toContain('<input type="hidden" name="in_reply_to" value="report-c"/>');
  expect(chosen).toContain("autofocus");
  // Pointed elsewhere, it is a send, and it says it does not answer the question.
  expect(chosen).toContain('action="/reply?lang=en" hx-post="/reply?lang=en"');
  expect(chosen).toContain("Replying to rondo-drafter, ");
  expect(chosen).toContain('class="not-answer');
  expect(chosen).toContain("does not answer the question waiting in this thread");
  const nowhere = await operatorPage(
    ports,
    "t",
    { kind: "thread", messageId: "no-such", to: null },
    EN,
    mint,
  );
  expect(nowhere).toContain("No request thread holds that message.");
  expect(nowhere).not.toContain('id="composer"');
});

test("with no approver the threads are read and never written: no form, and the reason said", async () => {
  const world = fresh();
  await seedThread(world);
  const ports = portsOver(world, null);
  for (const view of [
    { kind: "thread", messageId: "request-a", to: null },
    { kind: "requests" },
  ] as const) {
    // No token and no minter: the server hands neither without a say port.
    const html = await operatorPage(ports, null, view, EN, null);
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<textarea");
    expect(html).toContain("RONDO_APPROVER is not set, so there is nobody this page could send as");
    expect(bodiesIn(html).length > 0 || html.includes("Please look at the flaky test.")).toBe(true);
    expect(html).not.toContain(">Reply</a>");
  }
});

test("D-0072: the page keeps a question waiting until an answer carries it on, as the store does", async () => {
  // Codex, on #206: if the page closed a question the store still holds, it
  // would draw a Reply box for it, and that reply would be refused by the write
  // port -- leaving no way to release the hold from the page at all. So the two
  // readings have to agree, and this is the test that they do.
  const world = fresh();
  await seedThread(world);
  const ports = portsOver(world, "ada", []);
  const answered = async (messageId: string, parts: Partial<ThreadMessageDraft>): Promise<void> => {
    const outcome = await world.record.recordThreadMessage({
      messageId,
      body: "this line: stop it",
      authorKind: "operator",
      authorId: "ada",
      inReplyTo: "ask-b",
      atMs: 4_000,
      bases: [],
      asks: false,
      ...parts,
    });
    expect(outcome.kind, JSON.stringify(outcome)).toBe("recorded");
  };
  /** What the store says, and what the page drew, about the one ask. */
  const openInStore = async (): Promise<readonly string[]> => {
    const read = await world.record.openAsksIn("request-a");
    return read.kind === "read" ? read.asks.map((ask) => ask.messageId) : ["unreadable"];
  };
  const page = async (): Promise<string> =>
    await operatorPage(ports, "t", { kind: "summary" }, EN, mint);

  // A bare reply: the store holds the line, and so does the page.
  // **What the page draws is the request the question is in** (D-0083 rule
  // 3): the count the two readings have to agree on is the chrome's, and the
  // mark is on the question itself rather than on a row that stands for it.
  await answered("m-chat", {});
  expect(await openInStore()).toEqual(["ask-b"]);
  expect(await page()).toContain(">1 waiting</a>");

  // An answer that stops: still held, still drawn as waiting.
  await answered("m-stop", { answerOutcome: "stop", atMs: 5_000 });
  expect(await openInStore()).toEqual(["ask-b"]);
  const stopped = await page();
  expect(stopped).toContain(">1 waiting</a>");
  expect(messageIn(stopped, "ask-b")).toContain("data-waiting");

  // **The page says which of the two reasons a question is still held for, and
  // what the answer was** (D-0072 rules 1 and 3, Codex): the words are kept
  // byte for byte either way, so without these marks two answers that read
  // alike and did opposite things would be one entry in the thread.
  const thread = await operatorPage(
    ports,
    "t",
    { kind: "thread", messageId: "ask-b", to: null },
    EN,
    mint,
  );
  expect(messageIn(thread, "ask-b")).toContain(">You stopped this line</span>");
  expect(messageIn(thread, "ask-b")).not.toContain(">Waiting on you</span>");
  expect(messageIn(thread, "m-stop")).toContain(">Stopped this line</span>");
  // A reply that answered nothing is marked as neither.
  expect(messageIn(thread, "m-chat")).not.toContain(">Stopped this line</span>");
  expect(messageIn(thread, "m-chat")).not.toContain(">Carried on</span>");
  // The page a person arrives on says it too, because it is the same thread.
  expect(stopped).toContain(">You stopped this line</span>");

  // The answer that carries on is the one that ends it, in both readings.
  await answered("m-go", { answerOutcome: "carry_on", body: "go on", atMs: 6_000 });
  expect(await openInStore()).toEqual([]);
  const released = await page();
  // Nothing waits, so the chrome's one count is empty rather than 1, and the
  // question carries no mark.
  expect(released).toContain('<span id="waiting-count" class="empty:hidden"></span>');
  expect(released).not.toContain("data-waiting");
  // And the answer that released it is marked as the one that carried on.
  const onward = await operatorPage(
    ports,
    "t",
    { kind: "thread", messageId: "ask-b", to: null },
    EN,
    mint,
  );
  expect(messageIn(onward, "m-go")).toContain(">Carried on</span>");
  expect(messageIn(onward, "ask-b")).not.toContain(">You stopped this line</span>");
});

test("the summary counts an ask waiting on the person and leads to the reply, and the requests list reads at a glance", async () => {
  const world = fresh();
  await seedThread(world);
  const ports = portsOver(world, "ada", []);

  // **The page a person arrives on is the request that waits on them**
  // (D-0083 rule 3): no list of asks in between, and the question is marked
  // where it stands in the thread. It used to be a summary that counted the
  // asks and linked to each.
  const summary = await operatorPage(ports, "t", { kind: "summary" }, EN, mint);
  expect(messageIn(summary, "ask-b")).toContain("data-waiting");
  expect(summary).toContain("Please look at the flaky test.");
  // The header's way in, on every view, with the count the redraw renews.
  expect(summary).toContain('href="/?requests=open&amp;lang=en"');
  // One count in the chrome, and it leads to the same page (#220 S1).
  expect(summary).toMatch(
    /<span id="waiting-count" class="empty:hidden"><a href="\/\?lang=en" [^>]*>1 waiting<\/a>/,
  );
  // And the box to answer it is on that page, not one address away.
  expect(summary).toContain('id="composer"');

  // **The list is the left face on every view** (D-0083 rule 5): the person's
  // own words, one sentence of state, and when it last moved -- no count of
  // messages and no identifier of rondo's (D-0076).
  const requests = await operatorPage(ports, "t", { kind: "requests" }, EN, mint);
  expect(requests).toContain(EN.yourTurn);
  expect(requests).toContain("Waiting on your answer");
  expect(requests).toContain('href="/?thread=request-a&amp;lang=en"');
  // **A new request is a native submit**: where it lands is its own thread, a
  // different view, so it is not swapped into this one.
  expect(requests).toContain('<form id="composer" method="post" action="/request?lang=en" class=');
  expect(requests).not.toContain("hx-post");
  expect(requests).toContain(`value="${MINTED.request}"`);
  expect(requests).not.toContain('name="in_reply_to"');
});

test("the threads speak Japanese where the page does, tokens and words untouched", async () => {
  const world = fresh();
  await seedThread(world);
  const html = await operatorPage(
    portsOver(world, "ada", []),
    "t",
    { kind: "thread", messageId: "request-a", to: null },
    chromeFor("ja"),
    mint,
  );
  // The name each voice signs with; the badge beside it went with the card
  // the old thread drew (D-0083 rule 5).
  expect(html).toContain(">あなた</span>");
  expect(html).toContain("あなたの回答待ち");
  expect(html).toContain("rondo-drafter の質問に回答 · ");
  expect(html).toContain(">続ける</button>");
  expect(html).toContain(">この線を止める</button>");
  expect(html).toContain('action="/answer-ask?lang=ja"');
  expect(bodiesIn(html)).toEqual([ROOT_BODY, ASK_BODY, LATER_BODY]);
});

/** `page/composer.js` with its commentary removed, so a claim is read off code. */
const composerCode = (): string =>
  bytesOf("page/composer.js")
    .toString("utf8")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");

test("the composer script keeps a draft and the open folds, and makes no request of its own", async () => {
  const code = composerCode();
  // Its two duties, by what they touch (D-0059 section 5a).
  expect(code).toContain('"textarea[data-draft]"');
  expect(code).toContain("sessionStorage");
  expect(code).toContain("HTMLDetailsElement");
  // **Both duties run on every swap and not only on load** (Codex, on D-0083):
  // the boxes are inside the thread now, so the five-second redraw replaces
  // them -- a claim being typed would vanish, and a revise box a person had
  // rewritten would come back holding rondo's draft again.
  expect(code).toMatch(/new MutationObserver\(\(\) => \{\s*reopen\(\);\s*restore\(true\);/);
  // **And a box a person emptied stays empty across the redraw** (Codex): the
  // revise box arrives holding rondo's draft, so treating *emptied* as *no
  // draft* would put those words back five seconds after they were deleted.
  // A load reads it the other way, which is how rondo's draft comes back.
  expect(code).toContain('kept === "" && !afterSwap');
  // **And a send clears the box it was sent from** (Codex, on D-0083): the
  // thread carries several drafts -- the gate's claim, what to change beside
  // it, the reply under them -- so "the first textarea on the page" would
  // empty a field nobody sent.
  expect(code).toContain("textarea[data-draft=");
  // Ctrl/Cmd+Enter asks the form for the submit its own button makes.
  expect(code).toContain("requestSubmit()");
  // **And never on a form whose submit has to name an answer** (#206, D-0072
  // rule 4): `requestSubmit()` names no submitter, so the chord would send an
  // answer nobody chose. The two guards are the gate's claim box and this.
  expect(code).toContain('!target.form?.querySelector("button[name=outcome]")');
  for (const forbidden of [
    "fetch",
    "POST",
    "XMLHttpRequest",
    "EventSource",
    "WebSocket",
    "sendBeacon",
    "FormData",
    "localStorage",
    "eval",
    "innerHTML",
    "document.write",
    "location.href =",
    "htmx.",
    ".submit()",
  ]) {
    expect(code).not.toContain(forbidden);
  }
  // The two htmx events it hears are a send's start, where it notes the words
  // sent, and its end, where it clears only those from the draft.
  expect([...code.matchAll(/htmx:[A-Za-z]+/g)].map((found) => found[0])).toEqual([
    "htmx:beforeRequest",
    "htmx:afterRequest",
  ]);
  // A refusal with no `#send-refused` (csrf, Host, a defect) still says "not sent", as text.
  expect(code).toContain("note.textContent = note.dataset.refused");
  // And keys.js no longer keeps folds: one place does.
  expect(keysCode()).not.toContain("toggle");

  const world = fresh();
  const { base, stop, served } = await serving(portsOver(world));
  const served_ = await fetch(`${base}/composer.js`);
  expect(served_.status).toBe(200);
  expect(digestOf(Buffer.from(await served_.arrayBuffer()))).toBe(
    digestOf(bytesOf("page/composer.js")),
  );
  stop.abort();
  expect(await served).toBe(0);
});
