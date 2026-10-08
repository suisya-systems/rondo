/**
 * Publish inside a scope (rondo#470, D-0126 part 2): which laps the host
 * publishes, what it claims before each leg, over fakes of the store and the
 * press's path.
 */
import { describe, expect, test } from "vitest";

import { GATE_ACTOR } from "../../src/access/gate-host.js";
import type { ScopedPublish } from "../../src/access/page-publish-actions.js";
import { publishHost } from "../../src/access/publish-host.js";
import {
  APPROVED_OUTCOME,
  type FindingSeverity,
  type IterationRecord,
  type LapReading,
} from "../../src/store/records.js";

const evidence = {
  baseRef: "origin/main",
  baseCommit: "a".repeat(40),
  tipCommit: "b".repeat(40),
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
  findings: severities.map((severity) => `a ${severity} thing`),
  graded: severities.map((severity) => ({ severity, bases: [], basisResolved: false })),
  evidence,
  unavailableReason: null,
});

const lap = (id: string, over: Partial<IterationRecord> = {}): IterationRecord =>
  ({
    id,
    requestMessageId: "msg-1",
    status: "closed",
    gateOutcome: APPROVED_OUTCOME,
    gateAnswer: "approve",
    gateAnswerActor: GATE_ACTOR,
    ...over,
  }) as unknown as IterationRecord;

interface World {
  readonly laps: IterationRecord[];
  acts: string[];
  expiresAtMs: number;
  released: boolean;
  readings: readonly LapReading[];
  /** A worker's question over the line, with no reply. */
  asked: boolean;
  publishedIds: string[];
  readonly claims: string[];
  readonly lines: string[];
  kicked: number;
  /** What the press's path does with the claim (the real one claims before each leg). */
  legs: readonly ("push_branch" | "open_pull_request")[];
  /** Run when the press's path starts, after the pass chose the lap. */
  beforeLegs?: () => void;
}

const world = (laps: IterationRecord[]): World => ({
  laps,
  acts: ["push_branch", "open_pull_request"],
  expiresAtMs: 10_000,
  released: false,
  readings: [checks, model(["minor"])],
  asked: false,
  publishedIds: [],
  claims: [],
  lines: [],
  kicked: 0,
  legs: ["push_branch", "open_pull_request"],
});

function host(w: World) {
  const byId = new Map(w.laps.map((record) => [record.id, record]));
  return publishHost({
    store: {
      terminalIterations: async () => w.laps.map((record) => ({ kind: "read", record }) as const),
      read: async (id: string) => ({ kind: "read", record: byId.get(id) }),
      readingsFor: async () => w.readings,
      laneLedger: async () =>
        w.laps.map((record) => ({
          lapIds: [record.id],
          closedTips: [record.id],
          releasedBy: w.released ? "person" : null,
        })),
    } as never,
    record: {
      threadMessages: async () => ({
        kind: "read",
        messages: [
          {
            messageId: "msg-1",
            body: "do it",
            authorKind: "operator",
            authorId: "ada",
            inReplyTo: null,
            atMs: 0,
            bases: [],
            asks: false,
          },
          ...(w.asked
            ? [
                {
                  messageId: "ask-1",
                  body: "which one?",
                  authorKind: "drafter",
                  authorId: "rondo/worker/1",
                  inReplyTo: "msg-1",
                  atMs: 1,
                  bases: [{ form: "iteration", iterationId: "i-1" }],
                  asks: true,
                },
              ]
            : []),
          ...w.publishedIds.map((id) => ({
            messageId: `report-published-${id}`,
            body: `Lap '${id}' was published: pull request https://f/o/r/pull/1 was opened.`,
            authorKind: "drafter",
            authorId: "rondo/deterministic/1",
            inReplyTo: "msg-1",
            atMs: 1,
            bases: [],
            asks: false,
          })),
        ],
      }),
      scopeDecisionAdmitting: async () => "sd-1",
      scopeTip: async () => ({ kind: "absent" }),
      readScopeDecision: async () => ({
        kind: "read",
        decision: { scopeDecisionId: "sd-1", scopeId: "scope-1", outcome: "approved" },
      }),
      readScope: async () => ({
        kind: "read",
        scope: {
          payload: { outward_acts: w.acts, budgets: { expires_at_ms: w.expiresAtMs } },
        },
      }),
      claimScopedAct: async (claim: { actKind: string; subjectId: string }) => {
        const key = `${claim.actKind} ${claim.subjectId}`;
        if (w.claims.includes(key)) {
          return { kind: "refused", reason: "already claimed" };
        }
        w.claims.push(key);
        return { kind: "recorded" };
      },
    } as never,
    publish: async (iterationId: string, scoped: ScopedPublish) => {
      expect(scoped.scopeId).toBe("scope-1");
      w.beforeLegs?.();
      for (const leg of w.legs) {
        const claimed = await scoped.claim(leg);
        if (claimed.kind !== "recorded") {
          return { ok: false, note: claimed.reason };
        }
      }
      w.publishedIds.push(iterationId);
      return { ok: true, note: "" };
    },
    published: () => {
      w.kicked += 1;
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

describe("publishHost (rondo#470)", () => {
  test("an approved lap under a scope with both acts is claimed leg by leg and published", async () => {
    const w = world([lap("i-1")]);
    await pass(w);
    expect(w.claims).toEqual(["push_branch i-1", "open_pull_request i-1"]);
    expect(w.publishedIds).toEqual(["i-1"]);
    expect(w.kicked).toBe(1);
    expect(w.lines).toEqual(["publish  i-1: published by rondo under scope 'scope-1'"]);
    // Published is published: a second pass, or a second host, does nothing.
    await pass(w);
    expect(w.publishedIds).toEqual(["i-1"]);
  });

  test("nothing is published without both acts, past expiry, or off a line the person released", async () => {
    const one = world([lap("i-1")]);
    one.acts = ["push_branch"];
    const expired = world([lap("i-1")]);
    expired.expiresAtMs = 5_000;
    const released = world([lap("i-1")]);
    released.released = true;
    for (const w of [one, expired, released]) {
      await pass(w);
      expect(w.claims).toEqual([]);
      expect(w.publishedIds).toEqual([]);
    }
  });

  test("a lap not approved -- revised, or closed without an answer -- is not published", async () => {
    const w = world([
      lap("i-1", { gateAnswer: "revise" }),
      lap("i-2", { gateOutcome: "withdrawn" }),
      lap("i-3", { status: "failed" }),
    ]);
    await pass(w);
    expect(w.claims).toEqual([]);
  });

  test("a scope replaced between the read and the claim authorises nothing, and the lap is the person's", async () => {
    const w = world([lap("i-1")]);
    const h = host(w);
    // The first read sees both acts; the claim reads the scope again.
    let reads = 0;
    w.legs = ["push_branch"];
    Object.defineProperty(w, "acts", {
      get: () => {
        reads += 1;
        return reads === 1 ? ["push_branch", "open_pull_request"] : [];
      },
    });
    h.kick();
    await h.settled();
    expect(w.claims).toEqual([]);
    expect(w.publishedIds).toEqual([]);
    expect(w.lines[0]).toContain("not published by rondo, left for the press");
    // Tried once: the next pass leaves it alone.
    h.kick();
    await h.settled();
    expect(w.lines).toHaveLength(1);
  });

  test("a leg already claimed, by another process, is not taken again", async () => {
    const w = world([lap("i-1")]);
    w.claims.push("push_branch i-1");
    await pass(w);
    expect(w.publishedIds).toEqual([]);
    expect(w.lines[0]).toContain("already claimed");
  });

  test("D-0066 rule 4.2: a model finding at or above the line, no model reading, or an open question leaves it to the press", async () => {
    const raised = world([lap("i-1")]);
    raised.readings = [checks, model(["major"])];
    const unread = world([lap("i-1")]);
    unread.readings = [checks];
    const asked = world([lap("i-1")]);
    asked.asked = true;
    for (const w of [raised, unread, asked]) {
      await pass(w);
      expect(w.claims).toEqual([]);
      expect(w.publishedIds).toEqual([]);
    }
  });

  test("D-0187: a person's approval over a finding, or with no model reading, is published; a question still holds it", async () => {
    const raised = world([lap("i-1", { gateAnswerActor: "ada" })]);
    raised.readings = [checks, model(["major"])];
    const unread = world([lap("i-1", { gateAnswerActor: "ada" })]);
    unread.readings = [checks];
    for (const w of [raised, unread]) {
      await pass(w);
      expect(w.publishedIds).toEqual(["i-1"]);
    }
    const asked = world([lap("i-1", { gateAnswerActor: "ada" })]);
    asked.asked = true;
    // An answer with no actor recorded is not read as a person's.
    const unnamed = world([lap("i-1", { gateAnswerActor: null })]);
    unnamed.readings = [checks, model(["major"])];
    for (const w of [asked, unnamed]) {
      await pass(w);
      expect(w.publishedIds).toEqual([]);
    }
  });

  test("a line the person releases while the push is read is not published (Codex round 1)", async () => {
    const w = world([lap("i-1")]);
    w.beforeLegs = () => {
      w.released = true;
    };
    await pass(w);
    expect(w.claims).toEqual([]);
    expect(w.publishedIds).toEqual([]);
    expect(w.lines[0]).toContain("no longer rondo's to publish");
  });
});
