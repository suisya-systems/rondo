/**
 * The model drafter in the resident host (D-0071 section 3 and rule 7.3), over
 * a real store and a fake `claude`.
 *
 * What is held: a request is drafted once and then covered; the person's next
 * message is what makes it due again; a stale run is run again over the new
 * thread; an unavailable run writes its one message and is not retried; and a
 * draft the store refuses still leaves a row covering what it read.
 */
import { expect, test } from "vitest";

import { type DrafterHostPorts, drafterHost } from "../../src/access/drafter-host.js";
import type { DrafterRun } from "../../src/access/model-draft.js";
import { draftRequest } from "../../src/access/model-drafter.js";
import { planDigest } from "../../src/store/plan.js";
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

const split = (templateDigest: string, typeDigest: string): DrafterRun => ({
  kind: "answered",
  costUsd: 0.05,
  finalMessage: JSON.stringify({
    act: "split",
    summary: { text: "One plan: fix the flaky test.", bases: ["r1"] },
    plans: [
      {
        template_plan_digest: templateDigest,
        agent_type_digest: typeDigest,
        prompt: "Fix the flaky test.",
        bases: ["r1"],
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
