/**
 * What one model drafter run writes, in one transaction or not at all
 * (D-0071 rules 7.2 and 7.3), and what counts as drafted (rule 3.2).
 *
 * The store is the only place these hold under a write lock, so they are
 * tested here against a real database: a stale run writes nothing, a refusal
 * anywhere in the draft leaves no part of it behind, and a drafter's scope
 * records an agent type only from the bytes of a plan a person pasted,
 * recorded as that person's (the gate's answer to D-0071 point 1).
 */
import { expect, test } from "vitest";

import { planDigest } from "../../src/store/plan.js";
import type {
  JsonRecord,
  ProposalDraft,
  ScopeDraft,
  ThreadMessageDraft,
} from "../../src/store/records.js";
import type { DraftRunWrite } from "../../src/store/sqlite.js";
import {
  AGENT_TYPE_INPUT,
  agentTypeDigestOf,
  planDocument,
  REPOSITORY,
  WORKSPACE_ROOT,
  world,
} from "../access/fixtures/drafter.js";

const DRAFTER = "rondo/drafter/1/claude-opus-5";

function proposal(id: string, covers: readonly string[]): ProposalDraft {
  return {
    proposalId: id,
    kind: "split",
    drafter: DRAFTER,
    payload: { plans: [], holes: [] },
    snapshot: { covers: [...covers], document: "the document", material: {}, cost_usd: 0.05 },
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
    createdAtMs: 9_000,
  };
}

function drafterMessage(
  id: string,
  bases: readonly JsonRecord[],
  inReplyTo = "r1",
  atMs = 9_000,
): ThreadMessageDraft {
  return {
    messageId: id,
    body: "One plan.",
    authorKind: "drafter",
    authorId: DRAFTER,
    inReplyTo,
    atMs,
    bases: [...bases],
    asks: false,
  };
}

function drafterScope(
  typeDigest: string,
  records: ScopeDraft["agentTypeRecords"],
  bases: readonly JsonRecord[],
): ScopeDraft {
  return {
    scopeId: "drafted-scope-1",
    payload: {
      requests: ["r1"],
      workspaces: [{ repository: REPOSITORY, workspace_root: WORKSPACE_ROOT }],
      agent_types: [typeDigest],
      budgets: {
        laps: 3,
        review_rounds: 3,
        cost_usd: 7.5,
        cost_reserve_usd: 2.5,
        expires_at_ms: 9e12,
      },
      severity_threshold: "major",
      outward_acts: [],
      irreversible_additions: [],
    },
    supersedesScopeId: null,
    authorKind: "drafter",
    authorId: DRAFTER,
    bases: [...bases],
    createdAtMs: 9_000,
    agentTypeRecords: records,
  };
}

async function pasted() {
  const w = await world();
  const document = planDocument();
  await w.say("r1", "Fix the flaky test.", null, 1_000);
  await w.say("r1-plan", JSON.stringify(document), "r1", 2_000);
  const typeDigest = agentTypeDigestOf(document);
  const record = {
    agentTypeDigest: typeDigest,
    agentTypeInput: AGENT_TYPE_INPUT,
    planDigest: planDigest(document),
    fromMessageId: "r1-plan",
  };
  return { w, typeDigest, record };
}

const onPlan = [
  { form: "message", messageId: "r1" },
  { form: "message", messageId: "r1-plan" },
  { form: "proposal", proposalId: "draft-1" },
];

test("a draft is written whole: the proposal, the drafted scope, the pasted plan's agent type as its author's, and the messages", async () => {
  const { w, typeDigest, record } = await pasted();
  const write: DraftRunWrite = {
    requestMessageId: "r1",
    operatorMessageIds: ["r1", "r1-plan"],
    drafterPrefix: "rondo/drafter/",
    proposal: proposal("draft-1", ["r1", "r1-plan"]),
    scope: drafterScope(typeDigest, [record], onPlan),
    messages: [drafterMessage("drafter-1", [{ form: "proposal", proposalId: "draft-1" }])],
  };
  expect(await w.record.recordDraft(write)).toEqual({ kind: "recorded" });
  expect((await w.record.readScope("drafted-scope-1")).kind).toBe("read");
  expect((await w.record.readProposal("draft-1")).kind).toBe("read");
  // Recorded as the person who pasted the plan, not as the drafter.
  expect(
    w.connection
      .prepare("SELECT recorded_by FROM agent_type_record WHERE agent_type_digest = ?")
      .get(typeDigest),
  ).toEqual({ recorded_by: "ada" });
  expect(await w.record.draftedMessageIds("rondo/drafter/")).toEqual(new Set(["r1", "r1-plan"]));
});

test("a stale run writes nothing: the thread gained an operator message after the document (rule 7.2)", async () => {
  const { w } = await pasted();
  await w.say("r1-more", "Also the other test.", "r1", 3_000);
  const outcome = await w.record.recordDraft({
    requestMessageId: "r1",
    operatorMessageIds: ["r1", "r1-plan"],
    drafterPrefix: "rondo/drafter/",
    proposal: proposal("draft-1", ["r1", "r1-plan"]),
    scope: null,
    messages: [drafterMessage("drafter-1", [{ form: "proposal", proposalId: "draft-1" }])],
  });
  expect(outcome).toEqual({ kind: "stale" });
  expect((await w.record.readProposal("draft-1")).kind).not.toBe("read");
  expect(await w.record.draftedMessageIds("rondo/drafter/")).toEqual(new Set());
});

test("a refusal anywhere leaves no part of the draft behind", async () => {
  const { w, typeDigest, record } = await pasted();
  const outcome = await w.record.recordDraft({
    requestMessageId: "r1",
    operatorMessageIds: ["r1", "r1-plan"],
    drafterPrefix: "rondo/drafter/",
    proposal: proposal("draft-1", ["r1", "r1-plan"]),
    scope: drafterScope(typeDigest, [record], onPlan),
    // Refused: a drafter message resting on a message nobody wrote.
    messages: [drafterMessage("drafter-1", [{ form: "message", messageId: "nowhere" }])],
  });
  expect(outcome.kind).toBe("refused");
  expect((await w.record.readProposal("draft-1")).kind).not.toBe("read");
  expect((await w.record.readScope("drafted-scope-1")).kind).not.toBe("read");
  expect((await w.record.heldAgentType(typeDigest)).kind).toBe("absent");
});

test.each([
  ["from no message", { fromMessageId: undefined }, onPlan, "from no message"],
  [
    "from a message the scope does not cite",
    {},
    [{ form: "message", messageId: "r1" }],
    "does not cite it",
  ],
  [
    "from a message whose body is another plan",
    { planDigest: `sha256:${"0".repeat(64)}` },
    onPlan,
    "is not the plan the record is copied from",
  ],
  [
    "with an input that is not the pasted one",
    { agentTypeInput: { ...AGENT_TYPE_INPUT, granted: ["branch.push"] } },
    onPlan,
    "is not the plan the record is copied from",
  ],
  [
    "from the drafter's own message",
    { fromMessageId: "d-1" },
    [...onPlan, { form: "message", messageId: "d-1" }],
    "no operator message",
  ],
])("a drafter's scope does not record an agent type %s", async (_what, change, bases, reason) => {
  const { w, typeDigest, record } = await pasted();
  await w.record.recordThreadMessage(drafterMessage("d-1", [{ form: "message", messageId: "r1" }]));
  const { fromMessageId: _drop, ...withoutFrom } = record;
  const changed =
    "fromMessageId" in change && change.fromMessageId === undefined
      ? withoutFrom
      : { ...record, ...change };
  const outcome = await w.record.recordScope(drafterScope(typeDigest, [changed], bases));
  expect(outcome.kind).toBe("refused");
  expect(outcome.kind === "refused" && outcome.reason).toContain(reason);
});

test("an unavailable run's message covers the operator messages it cites", async () => {
  const { w } = await pasted();
  const outcome = await w.record.recordDraft({
    requestMessageId: "r1",
    operatorMessageIds: ["r1", "r1-plan"],
    drafterPrefix: "rondo/drafter/",
    proposal: null,
    scope: null,
    messages: [
      drafterMessage("drafter-1", [
        { form: "message", messageId: "r1" },
        { form: "message", messageId: "r1-plan" },
      ]),
    ],
  });
  expect(outcome).toEqual({ kind: "recorded" });
  expect(await w.record.draftedMessageIds("rondo/drafter/")).toEqual(new Set(["r1", "r1-plan"]));
  // Another drafter's rows are not this one's coverage.
  expect(await w.record.draftedMessageIds("rondo/other/")).toEqual(new Set());
});

test("a drafter message may not rest on a proposal row that does not exist", async () => {
  const { w } = await pasted();
  const outcome = await w.record.recordThreadMessage(
    drafterMessage("drafter-1", [{ form: "proposal", proposalId: "draft-none" }]),
  );
  expect(outcome.kind).toBe("refused");
  expect(outcome.kind === "refused" && outcome.reason).toContain("no proposal row");
});

test("a second host's run over a thread already drafted writes nothing (rule 3.2's coverage, under the lock)", async () => {
  const { w } = await pasted();
  const once = (id: string): DraftRunWrite => ({
    requestMessageId: "r1",
    operatorMessageIds: ["r1", "r1-plan"],
    drafterPrefix: "rondo/drafter/",
    proposal: proposal(id, ["r1", "r1-plan"]),
    scope: null,
    messages: [],
  });
  expect(await w.record.recordDraft(once("draft-1"))).toEqual({ kind: "recorded" });
  expect(await w.record.recordDraft(once("draft-2"))).toEqual({ kind: "covered" });
  expect((await w.record.readProposal("draft-2")).kind).not.toBe("read");
});

/** One issue read, as the reader writes it into a request's thread. */
async function readLands(w: Awaited<ReturnType<typeof world>>, atMs: number) {
  const outcome = await w.record.recordThreadMessage({
    messageId: `forge-${String(atMs)}`,
    body: JSON.stringify({
      rondo_issue_read: 1,
      named: "#237",
      at_ms: atMs,
      read: {
        url: "https://github.com/o/r/issues/237",
        number: 237,
        pullRequest: false,
        title: "The flaky test",
        state: "open",
        author: "ada",
        openedAt: "2026-09-01T00:00:00Z",
        body: "It fails one run in ten.",
        comments: [],
      },
    }),
    authorKind: "forge",
    authorId: "rondo/issue-reader",
    inReplyTo: "r1",
    atMs,
    bases: [],
    asks: false,
  });
  if (outcome.kind !== "recorded") throw new Error(JSON.stringify(outcome));
}

/**
 * One run's write, holding the thread its material listed: `held` is the
 * membership `D-0131` rule 1 reckons coverage by, and no time on the row says
 * anything about it.
 *
 * A `summary` is the run's own last message, and it is a covering row in its
 * own right: it cites the operator messages the run answered, so the coverage
 * read processes it, and its `atMs` is the run's *end*. That is the row whose
 * write time the first cut compared, and it is later than a read that landed
 * while the run was working -- which the run never saw.
 */
function draftedOver(
  id: string,
  held: readonly string[],
  summary: { readonly id: string; readonly atMs: number } | null = null,
): DraftRunWrite {
  return {
    requestMessageId: "r1",
    operatorMessageIds: ["r1", "r1-plan"],
    drafterPrefix: "rondo/drafter/",
    proposal: {
      ...proposal(id, ["r1", "r1-plan"]),
      snapshot: {
        covers: ["r1", "r1-plan"],
        material: { thread: held.map((messageId) => ({ messageId })) },
      },
    },
    scope: null,
    messages:
      summary === null
        ? []
        : [
            drafterMessage(
              summary.id,
              [
                { form: "message", messageId: "r1" },
                { form: "message", messageId: "r1-plan" },
                { form: "proposal", proposalId: id },
              ],
              "r1",
              summary.atMs,
            ),
          ],
  };
}

test("an issue read that landed after a drafter row leaves the message it answers uncovered (D-0131 rule 1)", async () => {
  const { w } = await pasted();
  expect(await w.record.recordDraft(draftedOver("draft-1", ["r1", "r1-plan"]))).toEqual({
    kind: "recorded",
  });
  expect(await w.record.draftedMessageIds("rondo/drafter/")).toEqual(new Set(["r1", "r1-plan"]));

  // The read lands afterwards: material the covering row did not have, so the
  // message it answers is drafted again and a second run is not "covered".
  await readLands(w, 12_000);
  expect(await w.record.draftedMessageIds("rondo/drafter/")).toEqual(new Set(["r1-plan"]));
  expect(
    await w.record.recordDraft(draftedOver("draft-2", ["r1", "r1-plan", "forge-12000"])),
  ).toEqual({ kind: "recorded" });

  // **And it does not spin**: the second row was drafted over the read, so the
  // thread is covered again and a third run writes nothing.
  expect(await w.record.draftedMessageIds("rondo/drafter/")).toEqual(new Set(["r1", "r1-plan"]));
  expect(await w.record.recordDraft(draftedOver("draft-3", ["r1", "r1-plan"]))).toEqual({
    kind: "covered",
  });
});

test("a read the covering row's material held changes nothing", async () => {
  const { w } = await pasted();
  await readLands(w, 5_000);
  expect(
    await w.record.recordDraft(draftedOver("draft-1", ["r1", "r1-plan", "forge-5000"])),
  ).toEqual({ kind: "recorded" });
  expect(await w.record.draftedMessageIds("rondo/drafter/")).toEqual(new Set(["r1", "r1-plan"]));
});

test("a read that lands while the run is drafting is not covered by the summary written after it", async () => {
  const { w } = await pasted();
  // The material was assembled at 9_000 without the read; the read lands at
  // 12_000 while the run is still working; the run's summary is written last,
  // at 15_000. Every clock on the row is therefore *after* the read, and the
  // summary is a covering row the coverage read processes -- so a comparison of
  // times would call `r1` covered and the redraft would never happen.
  const write = draftedOver("draft-1", ["r1", "r1-plan"], { id: "drafter-1", atMs: 15_000 });
  await readLands(w, 12_000);
  expect(await w.record.recordDraft(write)).toEqual({ kind: "recorded" });
  // Membership, not the clock: neither the proposal's material nor the
  // summary's citations hold `forge-12000`, so `r1` is drafted again.
  expect(await w.record.draftedMessageIds("rondo/drafter/")).toEqual(new Set(["r1-plan"]));

  // And the redraft writes something: a run handed the read covers `r1`, and
  // the summary of *that* run does not un-cover it.
  expect(
    await w.record.recordDraft(
      draftedOver("draft-2", ["r1", "r1-plan", "forge-12000"], {
        id: "drafter-2",
        atMs: 18_000,
      }),
    ),
  ).toEqual({ kind: "recorded" });
  expect((await w.record.readProposal("draft-2")).kind).toBe("read");
  expect(await w.record.draftedMessageIds("rondo/drafter/")).toEqual(new Set(["r1", "r1-plan"]));
});

test("a read stamped before the material but recorded after the draft is still not covered", async () => {
  const { w } = await pasted();
  expect(await w.record.recordDraft(draftedOver("draft-1", ["r1", "r1-plan"]))).toEqual({
    kind: "recorded",
  });
  // The reader stamps `at_ms` before it resolves the repository and asks the
  // forge, so the row lands with a time before the draft's material. Coverage
  // must not read that as "the draft had it".
  await readLands(w, 1);
  expect(await w.record.draftedMessageIds("rondo/drafter/")).toEqual(new Set(["r1-plan"]));
  expect(await w.record.recordDraft(draftedOver("draft-2", ["r1", "r1-plan", "forge-1"]))).toEqual({
    kind: "recorded",
  });
  expect(await w.record.draftedMessageIds("rondo/drafter/")).toEqual(new Set(["r1", "r1-plan"]));
});

test("an unavailable run's message covers a message with the reads it cites, and does not spin", async () => {
  const { w } = await pasted();
  await readLands(w, 12_000);
  const unavailable = (id: string, cites: readonly string[]): DraftRunWrite => ({
    requestMessageId: "r1",
    operatorMessageIds: ["r1", "r1-plan"],
    drafterPrefix: "rondo/drafter/",
    proposal: null,
    scope: null,
    messages: [
      drafterMessage(
        id,
        cites.map((messageId) => ({ form: "message", messageId })),
      ),
    ],
  });
  // Citing only the operator messages leaves the read uncovered: the run that
  // wrote it was handed no issue.
  expect(await w.record.recordDraft(unavailable("drafter-1", ["r1", "r1-plan"]))).toEqual({
    kind: "recorded",
  });
  expect(await w.record.draftedMessageIds("rondo/drafter/")).toEqual(new Set(["r1-plan"]));
  // Citing the read it held covers the message, so the next scan finds nothing.
  expect(
    await w.record.recordDraft(unavailable("drafter-2", ["r1", "r1-plan", "forge-12000"])),
  ).toEqual({ kind: "recorded" });
  expect(await w.record.draftedMessageIds("rondo/drafter/")).toEqual(new Set(["r1", "r1-plan"]));
});

test("a damaged row covers nothing and does not stop the coverage read", async () => {
  const { w } = await pasted();
  w.connection
    .prepare(
      "INSERT INTO proposal (proposal_id, kind, drafter, payload, proposal_digest, snapshot, " +
        "snapshot_digest, created_at_ms) VALUES ('p-bad', 'split', 'rondo/drafter/1/x', '{}', 'd', " +
        "'not json', 'd', 1)",
    )
    .run();
  expect(await w.record.draftedMessageIds("rondo/drafter/")).toEqual(new Set());
});

test("a reply is new to a run even when its clock is older than the message the run read last (rule 7.2)", async () => {
  const { w } = await pasted();
  // Written after the run's document, under a clock that stepped back.
  await w.say("r1-late", "One more thing.", "r1", 500);
  const outcome = await w.record.recordDraft({
    requestMessageId: "r1",
    operatorMessageIds: ["r1", "r1-plan"],
    drafterPrefix: "rondo/drafter/",
    proposal: proposal("draft-1", ["r1", "r1-plan"]),
    scope: null,
    messages: [],
  });
  expect(outcome).toEqual({ kind: "stale" });
});

test("one host holds a thread's run at a time, until it gives it back or its lease lapses (rule 3.3)", async () => {
  const { w } = await pasted();
  expect(await w.record.claimDraft("r1", "host-a", 1_000, 2_000)).toBe(true);
  expect(await w.record.claimDraft("r1", "host-b", 1_500, 2_500)).toBe(false);
  // Another thread is its own lease.
  expect(await w.record.claimDraft("r9", "host-b", 1_500, 2_500)).toBe(true);
  // A release by someone else leaves the lease with its holder.
  await w.record.releaseDraft("r1", "host-b");
  expect(await w.record.claimDraft("r1", "host-b", 1_500, 2_500)).toBe(false);
  await w.record.releaseDraft("r1", "host-a");
  expect(await w.record.claimDraft("r1", "host-b", 1_600, 2_600)).toBe(true);
  // A holder that died is outlived by its lease's end.
  expect(await w.record.claimDraft("r1", "host-a", 2_600, 3_600)).toBe(true);
});
