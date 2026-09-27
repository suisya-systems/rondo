/**
 * The organisation's answer at a gate (D-0125 rule 6, rondo#467): what the
 * host claims, answers and reports, over fakes of the store and the walk.
 */
import { describe, expect, test } from "vitest";

import {
  approvedBody,
  GATE_ACTOR,
  gateHost,
  type ScopedAnswer,
  type ScopedRevise,
  type ScopedReviseInput,
  sentBody,
} from "../../src/access/gate-host.js";
import { EN } from "../../src/access/wording.js";
import type { GateDelegation } from "../../src/continuo/invoker.js";
import type {
  FindingSeverity,
  IterationRecord,
  LapReading,
  ThreadMessageDraft,
} from "../../src/store/records.js";

const TIP = "b".repeat(40);
const evidence = {
  baseRef: "origin/main",
  baseCommit: "a".repeat(40),
  tipCommit: TIP,
  materialDigest: "sha256:x",
  commitCount: 1,
  fileCount: 1,
};
const checks: LapReading = {
  iterationId: "i-1",
  readAtMs: 1,
  drafter: "rondo/deterministic/2",
  verdict: "clear",
  findings: [],
  evidence,
  unavailableReason: null,
};
const model = (severities: readonly FindingSeverity[]): LapReading => ({
  iterationId: "i-1",
  readAtMs: 2,
  drafter: "rondo/model/1/gpt-6-astra",
  verdict: severities.length === 0 ? "clear" : "concerns",
  findings: severities.map((s) => `a ${s} thing`),
  graded: severities.map((severity) => ({ severity, bases: [], basisResolved: false })),
  evidence,
  unavailableReason: null,
});
const GREEN_RUN = JSON.stringify([
  {
    index: 1,
    command: "npm test",
    output: " Tests  10 passed (10)",
    output_omitted_chars: 0,
    is_error: false,
  },
]);

const lap = (id: string, gateId: string, over: Partial<IterationRecord> = {}): IterationRecord =>
  ({
    id,
    status: "awaiting_human",
    gateId,
    lapCommands: GREEN_RUN,
    requestMessageId: "msg-1",
    ...over,
  }) as unknown as IterationRecord;

interface World {
  readonly laps: IterationRecord[];
  readings: readonly LapReading[];
  readonly claims: Set<string>;
  readonly answered: { id: string; delegation: GateDelegation }[];
  readonly messages: ThreadMessageDraft[];
  readonly lines: string[];
  answer: ScopedAnswer;
  /** The scope's `requests`: the goal form, or a list of ids. */
  requests: unknown;
  roundsTaken: number;
  /** The stored revise draft's payload, or null for none. */
  draft: Record<string, unknown> | null;
  room: boolean;
  readonly sent: { id: string; input: ScopedReviseInput; recheck: boolean }[];
  sendAs: ScopedRevise;
  beforeRecheck?: () => void;
  /** The approval the line's tip is, as `scopeDecisionAdmitting` and `scopeTip` read it. */
  tip: string;
}

const world = (laps: IterationRecord[]): World => ({
  laps,
  readings: [checks, model(["minor"])],
  claims: new Set(),
  answered: [],
  messages: [],
  lines: [],
  answer: { kind: "delegated" },
  requests: { from_goal: "goal-1" },
  roundsTaken: 1,
  draft: null,
  room: true,
  sent: [],
  sendAs: { kind: "sent" },
  tip: "sd-1",
});

/** One host over the world; two hosts over one world are two processes sharing a store. */
function host(w: World) {
  return gateHost({
    store: {
      readLive: async () => w.laps.map((record) => ({ kind: "read", record }) as const),
      readingsFor: async () => w.readings,
      closingLapOf: async () => null,
      laneLedger: async () => [],
    } as never,
    record: {
      scopeDecisionAdmitting: async () => "sd-1",
      scopeTip: async () =>
        w.tip === "sd-1" ? { kind: "absent" } : { kind: "tip", scopeDecisionId: w.tip },
      readScopeDecision: async () => ({
        kind: "read",
        decision: {
          scopeDecisionId: "sd-1",
          scopeId: "scope-1",
          outcome: "approved",
          actorId: "happy_ryo",
        },
      }),
      readScope: async () => ({
        kind: "read",
        scope: {
          payload: {
            requests: w.requests,
            budgets: {
              expires_at_ms: 10_000,
              review_rounds: 3,
              laps: 10,
              cost_usd: 100,
              cost_reserve_usd: 5,
            },
            severity_threshold: "major",
          },
        },
      }),
      // Each earlier link of the line took one round (D-0065 4.1).
      lineageOf: async (id: string) => [
        ...Array.from({ length: w.roundsTaken - 1 }, (_, i) => `earlier-${String(i)}`),
        id,
      ],
      scopeSpent: async () => ({ admissions: 1, readCostUsd: 1, unreadLaps: 0 }),
      reviseDraftFor: async () => (w.draft === null ? null : { payload: w.draft }),
      scopeSupersededByApproved: async () => false,
      // The store's key: one row per gate, whichever approval claims it.
      claimScopedAct: async (claim: { actKind: string; subjectId: string }) => {
        const key = `${claim.actKind} ${claim.subjectId}`;
        if (w.claims.has(key)) {
          return { kind: "refused", reason: "already claimed" };
        }
        w.claims.add(key);
        return { kind: "recorded" };
      },
      threadMessages: async () => ({ kind: "read", messages: w.messages }),
      recordThreadMessage: async (draft: ThreadMessageDraft) => {
        w.messages.push(draft);
        return { kind: "recorded" };
      },
    } as never,
    answer: async (record, delegation) => {
      // Claimed before the walk (D-0125 rule 5).
      expect(w.claims.has(`gate_answer ${record.gateId}`)).toBe(true);
      w.answered.push({ id: record.id, delegation });
      return w.answer;
    },
    revise: {
      send: async (record, input) => {
        expect(w.claims.has(`gate_answer ${record.gateId}`)).toBe(true);
        w.beforeRecheck?.();
        w.sent.push({ id: record.id, input, recheck: await input.recheck() });
        return w.sendAs;
      },
      hasRoom: async () => w.room,
      words: EN,
      mintId: () => "i-next",
    },
    now: () => 5_000,
    log: (line) => w.lines.push(line),
  });
}

async function pass(w: World): Promise<void> {
  const h = host(w);
  h.kick();
  await h.settled();
}

describe("gateHost (D-0125 rule 6)", () => {
  test("a gate that would be approved is claimed, answered as delegated and reported", async () => {
    const w = world([lap("i-1", "g-1")]);
    await pass(w);
    expect([...w.claims]).toEqual(["gate_answer g-1"]);
    expect(w.answered).toEqual([
      { id: "i-1", delegation: { onBehalfOf: "happy_ryo", authorityRef: "sd-1" } },
    ]);
    expect(w.messages).toHaveLength(1);
    expect(w.messages[0]).toMatchObject({
      messageId: "gate-auto-g-1",
      inReplyTo: "msg-1",
      asks: false,
      body: approvedBody("scope-1", "happy_ryo", "major"),
    });
    expect(w.messages[0]?.body).toContain("Approved by rondo under scope 'scope-1'");
    expect(GATE_ACTOR).toBe("rondo/gate/1");
  });

  test("a gate that would not be approved is left alone, and nothing is claimed", async () => {
    const w = world([lap("i-1", "g-1")]);
    w.readings = [checks, model(["major"])];
    await pass(w);
    const unrun = world([lap("i-2", "g-2", { lapCommands: null })]);
    await pass(unrun);
    for (const each of [w, unrun]) {
      expect(each.claims.size).toBe(0);
      expect(each.answered).toEqual([]);
      expect(each.messages).toEqual([]);
    }
  });

  test("a lap that put a worker's question is the person's, answered or not (D-0142)", async () => {
    const w = world([lap("i-1", "g-1")]);
    const at = { authorKind: "drafter", atMs: 1, bases: [] } as const;
    w.messages.push(
      {
        ...at,
        messageId: "question-i-1",
        body: "which?",
        authorId: "rondo/worker-question/1",
        inReplyTo: "msg-1",
        asks: true,
      },
      // Carried on: the ask is closed, and the answer goes on by the revise.
      {
        ...at,
        messageId: "answer-1",
        body: "this one",
        authorKind: "operator",
        authorId: "ada",
        inReplyTo: "question-i-1",
        asks: false,
        answerOutcome: "carry_on",
      },
    );
    await pass(w);
    expect(w.claims.size).toBe(0);
    expect(w.answered).toEqual([]);
  });

  test("two lines in flight, and two hosts, answer each gate once", async () => {
    const w = world([lap("i-1", "g-1"), lap("i-2", "g-2")]);
    const a = host(w);
    const b = host(w);
    a.kick();
    b.kick();
    a.kick();
    await Promise.all([a.settled(), b.settled()]);
    await pass(w);
    expect(w.answered.map((answer) => answer.id).sort()).toEqual(["i-1", "i-2"]);
    expect(w.messages.map((message) => message.messageId).sort()).toEqual([
      "gate-auto-g-1",
      "gate-auto-g-2",
    ]);
  });

  test("an answer continuo does not hold as rondo's is not reported, and not tried again", async () => {
    const w = world([lap("i-1", "g-1")]);
    w.answer = { kind: "notDelegated", note: "not approved by rondo, left for the person" };
    await pass(w);
    await pass(w);
    expect(w.answered).toHaveLength(1);
    expect(w.messages).toEqual([]);
    expect(w.lines.join("\n")).toContain("left for the person");
  });
});

describe("rondo sends the drafted change under a goal scope (D-0145)", () => {
  const plain = { kind: "drafted", lead: null, changes: ["Fix it."], judgment: [] };
  const blocked = (): World => {
    const w = world([lap("i-1", "g-1")]);
    w.readings = [checks, model(["blocker"])];
    w.draft = plain;
    return w;
  };

  test("a gate withheld only by a plain finding is claimed and answered with the box's text", async () => {
    const w = blocked();
    await pass(w);
    expect([...w.claims]).toEqual(["gate_answer g-1"]);
    expect(w.answered).toEqual([]);
    expect(w.sent).toHaveLength(1);
    expect(w.sent[0]).toMatchObject({
      id: "i-1",
      recheck: true,
      input: {
        successorId: "i-next",
        scopeDecisionId: "sd-1",
        body: "- [blocker] a blocker thing\n  to change: Fix it.",
        delegation: { onBehalfOf: "happy_ryo", authorityRef: "sd-1" },
      },
    });
    expect(w.messages).toHaveLength(1);
    expect(w.messages[0]).toMatchObject({
      messageId: "gate-revise-g-1",
      inReplyTo: "msg-1",
      asks: false,
      body: sentBody("scope-1", "happy_ryo", { kind: "sent" }),
    });
    // Sent once: the claim is spent.
    await pass(w);
    expect(w.sent).toHaveLength(1);
  });

  test.each<[string, (w: World) => void]>([
    ["a scope that names its requests", (w) => (w.requests = ["msg-1"])],
    ["a finding marked a judgment call", (w) => (w.draft = { ...plain, judgment: [0] })],
    ["a draft from before the mark", (w) => (w.draft = { ...plain, judgment: undefined })],
    ["no draft yet", (w) => (w.draft = null)],
    ["the rounds spent", (w) => (w.roundsTaken = 3)],
    [
      "a failed test run",
      (w) => {
        w.laps[0] = lap("i-1", "g-1", {
          lapCommands: GREEN_RUN.replace('"is_error":false', '"is_error":true'),
        });
      },
    ],
    [
      "a checks finding the box does not quote",
      (w) =>
        (w.readings = [{ ...checks, verdict: "concerns", findings: ["lint"] }, model(["blocker"])]),
    ],
    [
      "a worker's question on the lap",
      (w) =>
        w.messages.push({
          messageId: "question-i-1",
          body: "which?",
          authorKind: "drafter",
          authorId: "rondo/worker-question/1",
          inReplyTo: "msg-1",
          atMs: 1,
          bases: [],
          asks: true,
        }),
    ],
  ])("the press stays the person's with %s, and nothing is claimed", async (_what, change) => {
    const w = blocked();
    change(w);
    await pass(w);
    expect(w.claims.size).toBe(0);
    expect(w.sent).toEqual([]);
  });

  test("a host at its bound claims nothing, and sends on a later pass", async () => {
    const w = blocked();
    w.room = false;
    await pass(w);
    expect(w.claims.size).toBe(0);
    w.room = true;
    await pass(w);
    expect(w.sent).toHaveLength(1);
  });

  test("the re-test before the walk fails once the draft has moved", async () => {
    const w = blocked();
    // The draft turns into a judgment call between the pass and the walk.
    w.beforeRecheck = () => {
      w.draft = { ...plain, judgment: [0] };
    };
    await pass(w);
    expect(w.sent).toHaveLength(1);
    expect(w.sent[0]?.recheck).toBe(false);
  });

  test("the re-test before the walk fails once another approval is the tip", async () => {
    const w = blocked();
    w.beforeRecheck = () => {
      w.tip = "sd-2";
    };
    await pass(w);
    expect(w.sent[0]?.recheck).toBe(false);
  });

  test("a send whose next lap did not start after the gate says so; one that answered nothing says nothing", async () => {
    const w = blocked();
    w.sendAs = { kind: "notSent", note: "the host is full", answered: true };
    await pass(w);
    expect(w.messages[0]?.body).toContain("the next lap did not start:\nthe host is full");
    const quiet = blocked();
    quiet.sendAs = { kind: "notSent", note: "a person answered first", answered: false };
    await pass(quiet);
    expect(quiet.messages).toEqual([]);
    expect(quiet.lines.join("\n")).toContain("a person answered first");
  });
});
