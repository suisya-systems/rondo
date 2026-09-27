/**
 * The model drafter in the resident host (D-0071 section 3 and rule 7.3), over
 * a real store and a fake `claude`.
 *
 * What is held: a request is drafted once and then covered; the person's next
 * message is what makes it due again; a stale run is run again over the new
 * thread; an unavailable run writes its one message and is not retried; and a
 * draft the store refuses still leaves a row covering what it read.
 */
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import { type DrafterHostPorts, drafterHost } from "../../src/access/drafter-host.js";
import { DRAFTER_ISSUE_BOUND_BYTES, forgeBody, ISSUE_READER } from "../../src/access/issue-read.js";
import { draftRequest } from "../../src/access/model-draft/host.js";
import type { DrafterRun } from "../../src/access/model-draft/judgement.js";
import { planDigest } from "../../src/store/plan.js";
import { advisoryRecord, iterationStore } from "../../src/store/sqlite.js";
import { agentTypeDigestOf, planDocument, world } from "./fixtures/drafter.js";

type World = Awaited<ReturnType<typeof world>>;

function hostOver(w: World, answer: (document: string, run: number) => Promise<DrafterRun>) {
  const handed: string[] = [];
  const logged: string[] = [];
  let n = 0;
  const ports: DrafterHostPorts = {
    store: w.store,
    record: w.record,
    now: () => 10_000,
    language: null,
    log: (line) => logged.push(line),
    mintId: (kind) => {
      n += 1;
      return `${kind}-${String(n)}`;
    },
    runDrafter: async (_row, document) => {
      handed.push(document);
      return await answer(document, handed.length);
    },
  };
  return { host: drafterHost(ports), handed, logged };
}

const split = (
  templateDigest: string,
  typeDigest: string,
  summary = "One plan: fix the flaky test.",
): DrafterRun => ({
  kind: "answered",
  costUsd: 0.05,
  finalMessage: JSON.stringify({
    act: "split",
    summary: { text: summary, bases: ["r1"] },
    plans: [
      {
        template_plan_digest: templateDigest,
        agent_type_digest: typeDigest,
        prompt: "Fix the flaky test.",
        bases: ["r1"],
        claim: ["/"],
      },
    ],
  }),
});

async function requestWithPlan() {
  const w = await world();
  const document = planDocument();
  await w.say("r1", "Fix the flaky test.", null, 1_000);
  await w.say("r1-plan", JSON.stringify(document), "r1", 2_000);
  return { w, templateDigest: planDigest(document), typeDigest: agentTypeDigestOf(document) };
}

async function drafterMessages(w: World) {
  const read = await w.record.threadMessages();
  if (read.kind !== "read") throw new Error(read.reason);
  return read.messages.filter((m) => m.authorKind === "drafter");
}

test("a request is drafted once: its proposal, its scope and its summary land, and a second scan runs nothing", async () => {
  const { w, templateDigest, typeDigest } = await requestWithPlan();
  const { host, handed, logged } = hostOver(w, async () => split(templateDigest, typeDigest));
  host.kick();
  await host.idle();
  expect(handed).toHaveLength(1);
  expect((await w.record.readScope("drafted-scope-4")).kind).toBe("read");
  const said = await drafterMessages(w);
  expect(said.map((m) => m.body)).toEqual(["One plan: fix the flaky test."]);
  expect(said[0]?.bases).toEqual([
    { form: "message", messageId: "r1" },
    { form: "proposal", proposalId: "draft-2" },
  ]);
  expect(logged).toEqual(["drafter  r1: split ($0.0500), with a drafted scope"]);
  host.kick();
  await host.idle();
  expect(handed).toHaveLength(1);
});

test("the person's next message makes the request due again, and the run is handed the whole thread", async () => {
  const { w, templateDigest, typeDigest } = await requestWithPlan();
  const { host, handed } = hostOver(w, async () => split(templateDigest, typeDigest));
  host.kick();
  await host.idle();
  await w.say("r1-more", "Keep it under $3.", "r1", 20_000);
  host.kick();
  await host.idle();
  expect(handed).toHaveLength(2);
  expect(handed[1]).toContain("Keep it under $3.");
});

test("an answer to a worker's question does not make the request due: it goes on by the revise (D-0142)", async () => {
  const { w, templateDigest, typeDigest } = await requestWithPlan();
  const { host, handed } = hostOver(w, async () => split(templateDigest, typeDigest));
  host.kick();
  await host.idle();
  const asked = await w.record.recordThreadMessage({
    messageId: "question-lap-1",
    body: "Which file?",
    authorKind: "drafter",
    authorId: "rondo/worker-question/1",
    inReplyTo: "r1",
    atMs: 15_000,
    bases: [{ form: "iteration", iterationId: "lap-1" }],
    asks: true,
  });
  expect(asked.kind).toBe("recorded");
  for (const [id, outcome] of [
    ["a-1", "stop"],
    ["a-2", "carry_on"],
  ] as const) {
    const answered = await w.record.recordThreadMessage({
      messageId: id,
      body: "a.ts",
      authorKind: "operator",
      authorId: "ada",
      inReplyTo: "question-lap-1",
      atMs: 16_000,
      bases: [],
      asks: false,
      answerOutcome: outcome,
    });
    expect(answered.kind).toBe("recorded");
  }
  host.kick();
  await host.idle();
  expect(handed).toHaveLength(1);
  // A message of the person's own still makes it due, and the run reads the answer too.
  await w.say("r1-more", "Keep it under $3.", "r1", 20_000);
  host.kick();
  await host.idle();
  expect(handed).toHaveLength(2);
  expect(handed[1]).toContain("a.ts");
});

test("a run that goes stale is discarded and run again over the new thread (rule 3.3)", async () => {
  const { w, templateDigest, typeDigest } = await requestWithPlan();
  const { host, handed } = hostOver(w, async (_document, run) => {
    if (run === 1) {
      // The person writes while the first run is out.
      await w.say("r1-more", "One more thing.", "r1", 5_000);
    }
    return split(templateDigest, typeDigest);
  });
  host.kick();
  await host.idle();
  expect(handed).toHaveLength(2);
  expect(handed[0]).not.toContain("One more thing.");
  expect(handed[1]).toContain("One more thing.");
  // Only the second run wrote.
  expect(await drafterMessages(w)).toHaveLength(1);
  expect(await w.record.draftedMessageIds("rondo/drafter/")).toEqual(
    new Set(["r1", "r1-plan", "r1-more"]),
  );
});

/** One issue read landing in `r1`'s thread, as `issue-read.ts`'s reader writes it. */
async function readLands(w: World, atMs: number, body: string) {
  const outcome = await w.record.recordThreadMessage({
    messageId: `forge-${String(atMs)}`,
    body: forgeBody({
      named: "#237",
      atMs,
      read: {
        url: "https://github.com/o/r/issues/237",
        number: 237,
        pullRequest: false,
        title: "The one flaky test",
        state: "open",
        author: "ada",
        openedAt: "2026-09-01T00:00:00Z",
        body,
        comments: [{ author: "bob", at: "2026-09-02T00:00:00Z", body: "It is the timer." }],
      },
    }),
    authorKind: "forge",
    authorId: ISSUE_READER,
    inReplyTo: "r1",
    atMs,
    bases: [],
    asks: false,
  });
  if (outcome.kind !== "recorded") throw new Error(JSON.stringify(outcome));
}

test("a read that lands after the draft is drafted again, and the redraft writes a new split over the issue (D-0131 rule 1)", async () => {
  const { w, templateDigest, typeDigest } = await requestWithPlan();
  const handed: string[] = [];
  let now = 10_000;
  let n = 0;
  const logged: string[] = [];
  const host = drafterHost({
    store: w.store,
    record: w.record,
    now: () => now,
    language: null,
    log: (line) => logged.push(line),
    mintId: (kind) => {
      n += 1;
      return `${kind}-${String(n)}`;
    },
    runDrafter: async (_row, document) => {
      handed.push(document);
      return split(templateDigest, typeDigest, `Fix it: run ${String(handed.length)}.`);
    },
  });
  host.kick();
  await host.idle();
  expect(handed).toHaveLength(1);
  expect(handed[0]).not.toContain("The one flaky test");

  // The read the first draft settled where to make lands after it.
  await readLands(w, 20_000, "It fails one run in ten.");
  now = 30_000;
  host.kick();
  await host.idle();

  // **The redraft is not an empty loop**: it was handed the issue, and what it
  // wrote is a new split and a new summary the person can read.
  expect(handed).toHaveLength(2);
  expect(handed[1]).toContain("The one flaky test");
  expect(handed[1]).toContain("It fails one run in ten.");
  expect(handed[1]).toContain("It is the timer.");
  const said = await drafterMessages(w);
  expect(said.map((m) => m.body)).toEqual(["Fix it: run 1.", "Fix it: run 2."]);
  const latest = await w.record.latestSplitFor("r1", "rondo/drafter/");
  expect(latest).not.toBeNull();
  const written = await w.record.readProposal(latest as string);
  expect(written.kind === "read" && (written.proposal.snapshot["document"] as string)).toContain(
    "The one flaky test",
  );

  // And it stops there: the row it wrote was drafted over the read.
  host.kick();
  await host.idle();
  expect(handed).toHaveLength(2);
});

test("an issue longer than the drafter's bound reaches it cut from the head, and says so (D-0131 rule 2)", async () => {
  const { w, templateDigest, typeDigest } = await requestWithPlan();
  const handed: string[] = [];
  let n = 0;
  const host = drafterHost({
    store: w.store,
    record: w.record,
    now: () => 30_000,
    language: null,
    log: () => undefined,
    mintId: (kind) => {
      n += 1;
      return `${kind}-${String(n)}`;
    },
    runDrafter: async (_row, document) => {
      handed.push(document);
      return split(templateDigest, typeDigest);
    },
  });
  const head = "the head of it. ";
  const tail = "THE TAIL OF IT.";
  await readLands(w, 20_000, head + "x".repeat(DRAFTER_ISSUE_BOUND_BYTES) + tail);
  host.kick();
  await host.idle();
  expect(handed).toHaveLength(1);
  const document = handed[0] as string;
  // The head is there, the tail is not, and the cut is named where it is read.
  expect(document).toContain(head);
  expect(document).not.toContain(tail);
  expect(document).not.toContain("It is the timer.");
  expect(document).toContain(`rondo cut this issue to its first ${DRAFTER_ISSUE_BOUND_BYTES}`);
  expect(document).toContain('A read carrying "cut" holds only the start of that issue');
});

test("an unavailable run writes one drafter message citing what it could not draft, and is not retried (rule 1.5)", async () => {
  const w = await world();
  await w.say("r1", "Fix the flaky test.", null, 1_000);
  const { host, handed } = hostOver(w, async () => ({
    kind: "failed",
    reason: "claude exited 1",
  }));
  host.kick();
  await host.idle();
  host.kick();
  await host.idle();
  expect(handed).toHaveLength(1);
  const said = await drafterMessages(w);
  expect(said).toEqual([
    expect.objectContaining({
      body: "rondo's drafter wrote no draft for this: claude exited 1",
      asks: false,
      inReplyTo: "r1",
      bases: [{ form: "message", messageId: "r1" }],
    }),
  ]);
});

test("a draft the store refuses still covers what it read: it becomes an unavailable run naming the refusal", async () => {
  const { w, templateDigest, typeDigest } = await requestWithPlan();
  const { host, handed } = hostOver(w, async () => split(templateDigest, typeDigest));
  // The run's proposal id is taken already, so its draft cannot land.
  const taken = await w.record.recordProposal({
    proposalId: "draft-2",
    kind: "split",
    drafter: "someone-else",
    payload: { plans: [], holes: [] },
    snapshot: {},
    derivation: null,
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
    createdAtMs: 1_500,
  });
  expect(taken.kind).toBe("recorded");
  host.kick();
  await host.idle();
  host.kick();
  await host.idle();
  expect(handed).toHaveLength(1);
  const said = await drafterMessages(w);
  expect(said).toHaveLength(1);
  expect(said[0]?.body).toContain(
    "rondo's drafter wrote no draft for this: the draft could not be recorded",
  );
  expect((await w.record.readScope("drafted-scope-4")).kind).not.toBe("read");
});

test("a thread whose root is not an operator's request is not drafted", async () => {
  const w = await world();
  await w.record.recordThreadMessage({
    messageId: "d0",
    body: "A report.",
    authorKind: "drafter",
    authorId: "rondo/deterministic",
    inReplyTo: null,
    atMs: 1_000,
    bases: [{ form: "iteration", iterationId: "i-1" }],
    asks: false,
  });
  const { host, handed } = hostOver(w, async () => ({ kind: "failed", reason: "unused" }));
  host.kick();
  await host.idle();
  expect(handed).toEqual([]);
});

test("a run that throws is logged and costs only its own request; the host goes on", async () => {
  const w = await world();
  await w.say("r1", "First.", null, 1_000);
  await w.say("r2", "Second.", null, 2_000);
  const logged: string[] = [];
  let n = 0;
  const host = drafterHost({
    store: w.store,
    record: w.record,
    now: () => 10_000,
    language: null,
    log: (line) => logged.push(line),
    mintId: (kind) => {
      n += 1;
      return `${kind}-${String(n)}`;
    },
    runDrafter: async () => ({ kind: "failed", reason: "no claude" }),
    draft: async (ports, requestMessageId, language) => {
      if (requestMessageId === "r1") {
        throw new Error("the disk is full");
      }
      return await draftRequest(ports, requestMessageId, language);
    },
  });
  host.kick();
  await host.idle();
  expect(logged).toContain("drafter  r1: the disk is full; tried again on the next scan");
  expect((await drafterMessages(w)).map((m) => m.inReplyTo)).toEqual(["r2"]);
});

test("a thread another host is drafting is left to it: nothing runs and nothing is given up", async () => {
  const w = await world();
  await w.say("r1", "Fix it.", null, 1_000);
  expect(await w.record.claimDraft("r1", "the-other-host", 0, 10_000_000)).toBe(true);
  const { host, handed } = hostOver(w, async () => ({ kind: "failed", reason: "unused" }));
  host.kick();
  await host.idle();
  expect(handed).toEqual([]);
  await w.record.releaseDraft("r1", "the-other-host");
  host.kick();
  await host.idle();
  expect(handed).toHaveLength(1);
});

test("a thread drafted by another host while this one worked through its list is not run again", async () => {
  const w = await world();
  await w.say("r1", "First.", null, 1_000);
  await w.say("r2", "Second.", null, 2_000);
  const { host, handed } = hostOver(w, async (_document, run) => {
    if (run === 1) {
      // While r1 is out, another host drafts r2.
      await w.record.recordDraft({
        requestMessageId: "r2",
        operatorMessageIds: ["r2"],
        drafterPrefix: "rondo/drafter/",
        proposal: null,
        scope: null,
        messages: [
          {
            messageId: "elsewhere-1",
            body: "rondo's drafter wrote no draft for this: elsewhere",
            authorKind: "drafter",
            authorId: "rondo/drafter/1/claude-opus-5",
            inReplyTo: "r2",
            atMs: 3_000,
            bases: [{ form: "message", messageId: "r2" }],
            asks: false,
          },
        ],
      });
    }
    return { kind: "failed", reason: "no claude" };
  });
  host.kick();
  await host.idle();
  expect(handed).toHaveLength(1);
});

test("a lease that cannot be taken for a moment leaves the request due for the next scan", async () => {
  const w = await world();
  await w.say("r1", "Fix it.", null, 1_000);
  let busy = true;
  const handed: string[] = [];
  const host = drafterHost({
    store: w.store,
    record: {
      ...w.record,
      claimDraft: async (...args: Parameters<typeof w.record.claimDraft>) => {
        if (busy) {
          throw new Error("database is locked");
        }
        return await w.record.claimDraft(...args);
      },
    },
    now: () => 10_000,
    language: null,
    log: () => undefined,
    mintId: (kind) => `${kind}-x`,
    runDrafter: async (_row, document) => {
      handed.push(document);
      return { kind: "failed", reason: "no claude" };
    },
  });
  host.kick();
  await host.idle();
  expect(handed).toEqual([]);
  busy = false;
  host.kick();
  await host.idle();
  expect(handed).toHaveLength(1);
});

test("starting a host on a store with history spends nothing on the past; a reply in an old thread drafts that thread, and nothing else", async () => {
  const connection = new DatabaseSync(":memory:");
  const store = iterationStore(connection, { maxOccupying: 4, maxLive: 6 });
  const record = advisoryRecord(connection);
  const say = async (messageId: string, body: string, inReplyTo: string | null, atMs: number) =>
    await record.recordThreadMessage({
      messageId,
      body,
      authorKind: "operator",
      authorId: "ada",
      inReplyTo,
      atMs,
      bases: [],
      asks: false,
    });
  // Written before any drafter host ran here.
  await say("old-1", "An old request.", null, 1_000);
  await say("old-2", "Another old one.", null, 2_000);
  const handed: string[] = [];
  const logged: string[] = [];
  let n = 0;
  const host = drafterHost({
    store,
    record,
    now: () => 10_000,
    language: null,
    log: (line) => logged.push(line),
    mintId: (kind) => {
      n += 1;
      return `${kind}-${String(n)}`;
    },
    runDrafter: async (_row, document) => {
      handed.push(document);
      return { kind: "failed", reason: "no claude" };
    },
  });
  host.kick();
  await host.idle();
  expect(handed).toEqual([]);
  expect(logged).toEqual([
    "drafter  2 request thread(s) predate the drafter on this store and are not drafted: nothing is spent on them unless the person replies in one",
  ]);
  // A new request, and a reply in one old thread.
  await say("new-1", "A new request.", null, 20_000);
  await say("old-1-reply", "Picking this back up.", "old-1", 21_000);
  host.kick();
  await host.idle();
  expect(handed).toHaveLength(2);
  expect(
    handed.some((d) => d.includes("An old request.") && d.includes("Picking this back up.")),
  ).toBe(true);
  expect(handed.some((d) => d.includes("Another old one."))).toBe(false);
  // Said once per host.
  expect(logged.filter((line) => line.includes("predate"))).toHaveLength(1);
});

test("a run whose material could not be read is tried again on the next scan, not given up", async () => {
  const w = await world();
  await w.say("r1", "Fix it.", null, 1_000);
  let unreadable = true;
  const handed: string[] = [];
  const host = drafterHost({
    store: w.store,
    record: w.record,
    now: () => 10_000,
    language: null,
    log: () => undefined,
    mintId: (kind) => `${kind}-x`,
    runDrafter: async (_row, document) => {
      handed.push(document);
      return { kind: "failed", reason: "no claude" };
    },
    draft: async (ports, requestMessageId, language) =>
      unreadable
        ? {
            drafter: "rondo/drafter/1/claude-opus-5",
            material: null,
            document: null,
            costUsd: null,
            outcome: { kind: "unavailable", reason: "the thread will not read" },
          }
        : await draftRequest(ports, requestMessageId, language),
  });
  host.kick();
  await host.idle();
  expect(handed).toEqual([]);
  unreadable = false;
  host.kick();
  await host.idle();
  expect(handed).toHaveLength(1);
});

test("a request naming a repository rondo does not work in is not drafted until it is added (rondo#383)", async () => {
  const { w, templateDigest, typeDigest } = await requestWithPlan();
  let unheld = true;
  const handed: string[] = [];
  let n = 0;
  const host = drafterHost({
    store: w.store,
    record: w.record,
    now: () => 10_000,
    language: null,
    log: () => undefined,
    mintId: (kind) => {
      n += 1;
      return `${kind}-${String(n)}`;
    },
    runDrafter: async (_row, document) => {
      handed.push(document);
      return await Promise.resolve(split(templateDigest, typeDigest));
    },
    awaitsRepository: async (id) => await Promise.resolve(id === "r1" && unheld),
  });
  host.kick();
  await host.idle();
  expect(handed).toHaveLength(0);
  expect(await drafterMessages(w)).toEqual([]);
  // Added from the page: the same request is due on the next scan.
  unheld = false;
  host.kick();
  await host.idle();
  expect(handed).toHaveLength(1);
});
