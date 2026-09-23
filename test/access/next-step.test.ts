/**
 * The next step, named, weighted and answering its press (rondo#375, lap 11's
 * N-48 and N-52).
 *
 * Four of the owner's seven stops on lap 11 were the page not saying something:
 * *Set the scope* was the quietest thing on a thread where it was the only way
 * forward, *Publish* did not say it opens a pull request, and neither a start
 * nor a publish showed that the press had been received. These hold the markup
 * that says each of those; `page-scripts.test.ts` holds what the script does
 * with it.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

import { PRIMARY, SECONDARY } from "../../src/access/page/vocabulary.js";
import { chromeFor, EN } from "../../src/access/wording.js";
import {
  fresh,
  gateWithChecks,
  openRequest,
  operatorPage,
  portsOver,
  recordAnswer,
} from "./page-world.js";

const DRY_RUN = {
  kind: "ready" as const,
  shown: `sha256:${"a".repeat(64)}`,
  target: {
    workspace: "/tmp/work/i-0001",
    remote: "origin",
    pushUrls: ["https://github.com/suisya-systems/rondo.git"],
    topicBranch: "rondo/i-0001",
    baseBranch: "main",
    headRef: "rondo/i-0001",
    repo: "github.com/suisya-systems/rondo",
    runId: "run-0001",
  },
  title: "feat: a retry budget",
  body: "## What changed\n\n- a retry budget\n",
  warnings: [],
  modelReading: [],
  review: null,
};

/** The class list of the element whose opening tag carries `id="<id>"`. */
function classOf(html: string, id: string): string {
  const tag = html.slice(html.lastIndexOf("<", html.indexOf(`id="${id}"`)));
  return /class="([^"]*)"/.exec(tag.slice(0, tag.indexOf(">")))?.[1] ?? "";
}

/** The opening tag of the first button whose text is `label`. */
function buttonTag(html: string, label: string): string {
  const end = html.indexOf(`>${label}</button>`);
  expect(end).toBeGreaterThan(-1);
  return html.slice(html.lastIndexOf("<button", end), end + 1);
}

const threadOf = (messageId: string) => ({ kind: "thread" as const, messageId, to: null });

/** The next step's own shape: the one filled way forward, at the top. */
const NEXT = `${PRIMARY} mt-3 h-10 justify-center px-6 text-sm`;

/**
 * The next step is drawn once, above the first message, under its heading:
 * the owner's review of the first try was that a filled button at the foot of
 * a long thread, the size of every other, did not stand out (rondo#375).
 */
function drawnOnceOnTop(html: string, id: string) {
  expect(html.split(`id="${id}"`)).toHaveLength(2);
  const at = html.indexOf(`id="${id}"`);
  expect(html.lastIndexOf(EN.nextStepHeading, at)).toBeGreaterThan(-1);
  expect(at).toBeLessThan(html.indexOf('class="msg msg-'));
}

test("a request with no work yet draws *set the scope* filled: it is the only way forward", async () => {
  const world = fresh();
  await openRequest(world, "req-1", "add a retry budget");
  const html = await operatorPage(portsOver(world), "t", threadOf("req-1"));
  expect(classOf(html, "scope-req-1")).toBe(NEXT);
  drawnOnceOnTop(html, "scope-req-1");
  expect(html).toContain(EN.nextStepScope);
  // One way to set it, and not a second copy lower down.
  expect(html.split(`>${EN.scopeAction}</a>`)).toHaveLength(2);
});

test("a thread with a gate waiting leaves the gate as the press, and the scope outlined", async () => {
  const world = fresh();
  await gateWithChecks(world);
  const html = await operatorPage(portsOver(world), "t", threadOf("req-1"));
  expect(classOf(html, "scope-req-1")).toBe(`${SECONDARY} h-7 px-3 text-meta`);
  expect(html).not.toContain(EN.nextStepHeading);
});

test("an approved lap's next step is drawn filled and named for what it does: a pull request", async () => {
  const world = fresh();
  await gateWithChecks(world);
  await recordAnswer(world, "i-0001");
  await world.store.transition(
    "i-0001",
    "awaiting_human",
    "closed",
    { gateOutcome: "answered_and_forwarded" },
    5_000,
  );
  const html = await operatorPage(
    portsOver(world, "ada", [], null, null, async () => DRY_RUN),
    "t",
    threadOf("req-1"),
  );
  expect(classOf(html, "publish-i-0001")).toBe(NEXT);
  drawnOnceOnTop(html, "publish-i-0001");
  expect(html).toContain(EN.nextStepPublish);
  expect(html).toContain(">Open a pull request</a>");
  // The scope is another scope now, and a second filled way would be a choice.
  expect(classOf(html, "scope-req-1")).toBe(`${SECONDARY} h-7 px-3 text-meta`);
  // And in Japanese, from what it does rather than from the English line.
  expect(chromeFor("ja").publishAction).toBe("プルリクエストを作る");
});

test("a lap answered with a change, or with no record of which answer, offers no pull request (rondo#385)", async () => {
  // Publishing cannot be taken back, so the way onto it is drawn only over an
  // approval rondo recorded (D-0092) -- never over a change the person asked
  // for whose next try was refused, and never on a guess.
  for (const answer of ["revise", null] as const) {
    const world = fresh();
    await gateWithChecks(world);
    if (answer !== null) {
      await recordAnswer(world, "i-0001", answer);
    }
    await world.store.transition(
      "i-0001",
      "awaiting_human",
      "closed",
      { gateOutcome: "answered_and_forwarded" },
      5_000,
    );
    const html = await operatorPage(
      portsOver(world, "ada", [], null, null, async () => DRY_RUN),
      "t",
      threadOf("req-1"),
    );
    expect(html).not.toContain("publish-i-0001");
    expect(html).not.toContain(EN.nextStepPublish);
  }
});

test("every press says what it is doing once pressed, and a long one what it waits on", async () => {
  const world = fresh();
  await gateWithChecks(world);
  // The gate's approve. Its *ask for a change* needs an approval to count a
  // second lap against, which this lap has none of; the source check below
  // holds that one.
  const gate = await operatorPage(portsOver(world), "t", threadOf("req-1"));
  expect(gate).toContain(`data-busy="${EN.approveBusy}"`);
  await world.store.transition(
    "i-0001",
    "awaiting_human",
    "closed",
    { gateOutcome: "answered_and_forwarded" },
    5_000,
  );
  const publish = await operatorPage(
    portsOver(world, "ada", [], null, null, async () => DRY_RUN),
    "t",
    { kind: "publish", iterationId: "i-0001" },
  );
  expect(buttonTag(publish, EN.publishAction)).toContain(`data-busy="${EN.publishBusy}"`);
  // Hidden until the press: with script off the landing page is what answers.
  expect(publish).toContain(`hidden="" role="status"`);
  expect(publish).toContain(EN.publishBusyNote);
});

const source = (path: string) =>
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../..", path), "utf8");

test("the presses that start a lap carry their busy label and what a lap waits on", () => {
  // *Ask for a change* starts the second lap, and waits on it as a start does.
  const revise = source("src/access/web.tsx");
  expect(revise).toContain("data-busy={wording.reviseBusy}");
  // And so does the conflict fix's attempt (rondo#417, D-0105).
  expect(revise).toContain("data-busy={wording.conflictFixBusy}");
  expect(revise.match(/\{wording\.lapBusyNote\}/g)).toHaveLength(2);
  const scope = source("src/access/screens/scope.tsx");
  // Both starts -- the plan's own and the one under an approval -- and every
  // scope press, each of the three drawn twice: at the form's top and again
  // under its last box (D-0106 rule 7).
  expect(scope.match(/data-busy=\{wording\.startBusy\}/g)).toHaveLength(2);
  expect(scope.match(/\{wording\.startBusyNote\}/g)).toHaveLength(2);
  expect(scope.match(/data-busy=\{wording\.scopeBusy\}/g)).toHaveLength(6);
});

test("setup's last word is the one that opens the page, and no terminal step comes after it", () => {
  const setup = source("scripts/dogfood-env.sh");
  const ready = setup.slice(setup.lastIndexOf("cat <<READY"), setup.lastIndexOf("\nREADY"));
  const lines = ready.split("\n").filter((line) => line.trim() !== "");
  expect(lines.at(-1)).toBe("  rondo");
  // The terminal's way in is kept, beside the environment, and not on screen.
  expect(ready).not.toContain("bin/rondo.mjs");
  expect(ready).toContain("$terminal_notes");
  expect(setup).toMatch(/cat >"\$terminal_notes" <<TERMINAL[\s\S]*bin\/rondo\.mjs start/);
});

test("a scope the person approved themselves is a start to go to, not a scope to set again (Codex)", async () => {
  const world = fresh();
  await openRequest(world, "req-1", "add a retry budget");
  const ports = portsOver(world);
  // The person's own scope, approved and in force: what the store answers is
  // all this reads, so the three reads are answered as the store would.
  const record = Object.assign(Object.create(ports.record), {
    scopesFor: async () => [{ scopeId: "s-1", authorKind: "operator", authorId: "ada" }],
    scopeDecisionOf: async () => ({
      kind: "read",
      decision: { outcome: "approved", scopeDecisionId: "sd-1" },
    }),
    scopeSupersededByApproved: async () => false,
  }) as typeof ports.record;
  const html = await operatorPage({ ...ports, record }, "t", threadOf("req-1"));
  drawnOnceOnTop(html, "scope-req-1");
  expect(html).toContain(EN.nextStepStart);
  expect(html).not.toContain(EN.nextStepScope);
  expect(html).toContain("decision=sd-1");
});

test("an approved draft of rondo's is reached without its decision, so a newer draft stays on its screen (Codex)", async () => {
  const world = fresh();
  await openRequest(world, "req-1", "add a retry budget");
  const ports = portsOver(world);
  const record = Object.assign(Object.create(ports.record), {
    scopesFor: async () => [
      {
        scopeId: "d-1",
        authorKind: "drafter",
        authorId: "rondo/drafter/1/claude-opus-5",
        supersedesScopeId: null,
      },
    ],
    scopeDecisionOf: async () => ({
      kind: "read",
      decision: { outcome: "approved", scopeDecisionId: "sd-draft" },
    }),
    scopeSupersededByApproved: async () => false,
  }) as typeof ports.record;
  const html = await operatorPage({ ...ports, record }, "t", threadOf("req-1"));
  drawnOnceOnTop(html, "scope-req-1");
  expect(html).toContain(EN.nextStepStart);
  expect(html).toContain('href="/?scope=req-1&amp;lang=en"');
  expect(html).not.toContain("decision=sd-draft");
});

test("a request naming a repository rondo does not work in says so, and its one step is adding it (rondo#383)", async () => {
  const world = fresh();
  await openRequest(world, "req-1", "Do owner/other#12.");
  const ports = {
    ...portsOver(world),
    addable: true,
    repositoryFor: async () =>
      await Promise.resolve({
        work: { kind: "unheld" as const, repo: "owner/other", named: "owner/other#12" },
        unbuilt: [],
      }),
  };
  const html = await operatorPage(ports, "t", threadOf("req-1"));
  drawnOnceOnTop(html, "add-repository-req-1");
  expect(classOf(html, "add-repository-req-1")).toBe(NEXT);
  // Up to the first apostrophe, which the renderer escapes its own way.
  const said = EN.nextStepAddRepository("owner/other#12", "owner/other");
  expect(html).toContain(said.slice(0, said.indexOf("'")));
  expect(html).toContain('action="/add-repository?lang=en"');
  expect(html).toContain('name="repository" value="owner/other"');
  // No scope is offered for work in a repository rondo does not hold.
  expect(html).not.toContain('id="scope-req-1"');

  // A page that cannot write still says why nothing is drafted; only the
  // button needs a writer.
  for (const [readOnly, token] of [
    [{ ...ports, addable: false }, "t"],
    [ports, null],
  ] as const) {
    const said = await operatorPage(readOnly, token, threadOf("req-1"));
    expect(said).toContain(EN.nextStepHeading);
    expect(said).toContain("rondo does not work in owner/other yet");
    expect(said).not.toContain('id="add-repository-req-1"');
    expect(said).not.toContain('action="/add-repository');
  }

  // Added, and rondo could not tell how it builds: said where the work is.
  const unbuilt = {
    ...portsOver(world),
    addable: true,
    repositoryFor: async () =>
      await Promise.resolve({
        work: { kind: "held" as const, repos: ["owner/other"] },
        unbuilt: ["owner/other"],
      }),
  };
  const after = await operatorPage(unbuilt, "t", threadOf("req-1"));
  expect(after).not.toContain('id="add-repository-req-1"');
  expect(after).toContain(EN.repositoryUnbuilt("owner/other"));
  expect(classOf(after, "scope-req-1")).toBe(NEXT);
});

test("a question waiting in the thread is the next step, and no scope is offered beside it (rondo#431)", async () => {
  // Lap 13: the drafter asked which of three options, and the band still said
  // *set the scope*; the approval that followed was refused at start on the
  // question it had not waited for.
  const world = fresh();
  await openRequest(world, "req-1", "Do #200, please.");
  const asked = await world.record.recordThreadMessage({
    messageId: "ask-1",
    body: "Which of the three options?",
    authorKind: "drafter",
    authorId: "rondo/drafter/6/claude-opus-5",
    inReplyTo: "req-1",
    atMs: 600,
    bases: [{ form: "message", messageId: "req-1" }],
    asks: true,
  });
  expect(asked.kind).toBe("recorded");
  const ports = portsOver(world);
  const html = await operatorPage(ports, "t", threadOf("req-1"));
  drawnOnceOnTop(html, "answer-req-1");
  expect(classOf(html, "answer-req-1")).toBe(NEXT);
  expect(html).toContain(EN.nextStepAnswer);
  expect(html).toContain('href="/?thread=req-1&amp;to=ask-1&amp;lang=en"');
  // Neither filled nor outlined: a scope is not a way forward while it waits.
  expect(html).not.toContain('id="scope-req-1"');
  expect(html).not.toContain(EN.nextStepScope);

  // The scope screen, reached by its address, offers nothing to approve either.
  const screen = await operatorPage(ports, "t", {
    kind: "scope",
    messageId: "req-1",
    rounds: null,
    decisionId: null,
    plan: null,
  });
  expect(screen).toContain(EN.scopeAnswerFirst.slice(0, EN.scopeAnswerFirst.indexOf("'")));
  expect(screen).toContain('href="/?thread=req-1&amp;to=ask-1&amp;lang=en"');
  expect(screen).not.toContain('id="scope-form"');
  expect(screen).not.toContain('id="scope-draft-form"');

  // Answered, the scope is the next step again.
  await world.record.recordThreadMessage({
    messageId: "reply-1",
    body: "Option 1.",
    authorKind: "operator",
    authorId: "ada",
    inReplyTo: "ask-1",
    atMs: 700,
    bases: [],
    asks: false,
    answerOutcome: "carry_on",
  });
  const after = await operatorPage(ports, "t", threadOf("req-1"));
  expect(after).not.toContain('id="answer-req-1"');
  expect(classOf(after, "scope-req-1")).toBe(NEXT);
});

test("a gate waiting keeps its own box as the press, even beside a question in the thread (Codex)", async () => {
  const world = fresh();
  await gateWithChecks(world);
  const asked = await world.record.recordThreadMessage({
    messageId: "ask-1",
    body: "Which of the three options?",
    authorKind: "drafter",
    authorId: "rondo/drafter/6/claude-opus-5",
    inReplyTo: "req-1",
    atMs: 600,
    bases: [{ form: "message", messageId: "req-1" }],
    asks: true,
  });
  expect(asked.kind).toBe("recorded");
  const html = await operatorPage(portsOver(world), "t", threadOf("req-1"));
  expect(html).not.toContain(EN.nextStepHeading);
  expect(html).not.toContain('id="answer-req-1"');
});

test("a question the person answered by stopping is not drawn as one waiting for an answer (Codex)", async () => {
  const world = fresh();
  await openRequest(world, "req-1", "Do #200, please.");
  for (const draft of [
    {
      messageId: "ask-1",
      body: "Which of the three options?",
      authorKind: "drafter" as const,
      authorId: "rondo/drafter/6/claude-opus-5",
      inReplyTo: "req-1",
      atMs: 600,
      bases: [{ form: "message", messageId: "req-1" }],
      asks: true,
    },
    {
      messageId: "reply-1",
      body: "Stop here.",
      authorKind: "operator" as const,
      authorId: "ada",
      inReplyTo: "ask-1",
      atMs: 700,
      bases: [],
      asks: false,
      answerOutcome: "stop" as const,
    },
  ]) {
    expect((await world.record.recordThreadMessage(draft)).kind).toBe("recorded");
  }
  const html = await operatorPage(portsOver(world), "t", threadOf("req-1"));
  expect(html).not.toContain('id="answer-req-1"');
  expect(html).not.toContain(EN.nextStepAnswer);
});

test("a start refused at a scope test says the test in words, never its name (rondo#431)", () => {
  // Lap 13 printed `asks` to the person: a word they had to ask about.
  for (const wording of [EN, chromeFor("ja")]) {
    const said = wording.startRefusedOutside("asks");
    expect(said).not.toMatch(/\basks\b/);
    expect(said).toContain(wording.lang === "ja" ? "問い" : "question");
  }
});
