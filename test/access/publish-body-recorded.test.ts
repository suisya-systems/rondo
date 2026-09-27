/**
 * The composed body the page publishes (D-0079 section 4, rondo#290): composed
 * once from the lap's report, recorded as a `publish_body` row, and read from
 * that row by the preview and by the press alike.
 *
 * **Why a row at all**, and the whole of what these cases are about: the page's
 * preview and its press each compose the publish plan, and the body is inside
 * the digest the press compares against what the screen showed. A model's answer
 * is not the same twice, so a second composing run would refuse every press --
 * and the pull request that does open carries the body that was recorded.
 */
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";
import {
  type ComposedBody,
  publishBodyDrafterName,
  publishBodyOnce,
  recordedPublishBody,
} from "../../src/access/publish-body.js";
import { pullRequestText } from "../../src/access/pull-request.js";
import { drafterRow } from "../../src/continuo/roles.js";
import { allocate } from "../../src/refrain/allocator.js";
import { admittedPlan, planPayload, runPlan } from "../../src/refrain/plan.js";
import type { IterationRecord } from "../../src/store/records.js";
import { advisoryRecord, iterationStore } from "../../src/store/sqlite.js";
import { ownLane } from "../lane-claims.js";
import { openRequest, REQUEST } from "../request-fixture.js";
import { PLAN } from "./page-world.js";

/** The lap's report, as a lap asked for Japanese leaves it: the worker's own words. */
const REPORT = [
  "## 変更の要旨",
  "ページからの publish でも、記録した英語の本文が使われるようにしました。",
  "",
  "## 確認結果",
  "npm run verify を通しました。",
].join("\n");

const SECTIONS: ComposedBody = {
  summary: "The page's publish now uses the body rondo recorded for the lap.",
  grounds: "D-0079 section 4 requires the body to be English, composed from the report.",
  verification: "The repository's own verification was run and it passed.",
};

const ITERATION = "lap-00000000-0000-4000-8000-0000000000d1";

/** One closed lap at its gate, whose plan asked its worker for Japanese. */
async function closedLap(materialLanguage: string | null): Promise<{
  readonly record: IterationRecord;
  readonly store: ReturnType<typeof iterationStore>;
  readonly advisory: ReturnType<typeof advisoryRecord>;
}> {
  const connection = new DatabaseSync(":memory:");
  const store = iterationStore(connection, { maxOccupying: 4, maxLive: 6 });
  const advisory = advisoryRecord(connection);
  await openRequest(connection);
  const planned = runPlan({ ...PLAN, materialLanguage });
  if (planned.kind !== "planned") {
    throw new Error(`the fixture plan is not valid: ${planned.reason}`);
  }
  const allocation = allocate(ITERATION, "/tmp/rondo-publish-body");
  if (allocation.kind !== "allocated") {
    throw new Error(`the fixture id does not allocate: ${allocation.reason}`);
  }
  const admitted = admittedPlan(planned.plan, allocation.allocation);
  if (admitted.kind !== "planned") {
    throw new Error(`the fixture allocation is not valid: ${admitted.reason}`);
  }
  const payload = planPayload(admitted.plan);
  const reserved = await store.reserve({
    numbers: null,
    id: ITERATION,
    request: "count the laps",
    plan: payload,
    spend: null,
    scopeSpend: null,
    claim: ownLane(ITERATION),
    nowMs: 1_000,
    supersedesIterationId: null,
    requestMessageId: REQUEST,
    runId: `rondo-${ITERATION}`,
    topicBranch: String(payload["topic_branch"]),
    workspace: String(payload["workspace"]),
  });
  expect(reserved.kind).toBe("reserved");
  for (const [from, to, fields] of [
    ["planned", "admitting", {}],
    ["admitting", "admitted", {}],
    ["admitted", "performing", {}],
    ["performing", "awaiting_human", { gateId: `gate-${ITERATION}` }],
    ["awaiting_human", "closed", { gateOutcome: "answered_and_forwarded" }],
  ] as const) {
    const moved = await store.transition(ITERATION, from, to, fields, 2_000, undefined);
    expect(moved.kind, to).toBe("transitioned");
  }
  const read = await store.read(ITERATION);
  if (read.kind !== "read") {
    throw new Error("the fixture row would not read");
  }
  return { record: read.record, store, advisory };
}

/** The ports one composing run reaches, with the drafter and the report counted. */
function ports(
  advisory: ReturnType<typeof advisoryRecord>,
  report: string | null,
  answer: unknown = SECTIONS,
) {
  const documents: string[] = [];
  let reports = 0;
  return {
    documents,
    reports: () => reports,
    ports: {
      record: advisory,
      report: async () => {
        reports += 1;
        return report;
      },
      runDrafter: async (document: string) => {
        documents.push(document);
        return {
          kind: "answered" as const,
          costUsd: null,
          finalMessage: JSON.stringify(answer),
        };
      },
      drafter: drafterRow(),
      mintId: () => `publish-body-${String(documents.length)}`,
      now: () => 3_000,
    },
  };
}

test("the body is composed once from the lap's report, recorded, and read back by the press (rondo#290)", async () => {
  const { record, advisory } = await closedLap("ja");
  const subject = { iterationId: record.id, gateId: `gate-${record.id}` };
  // Nothing is recorded yet, so the press before a screen finds no body.
  expect(await recordedPublishBody(advisory, subject)).toBe(null);

  const first = ports(advisory, REPORT);
  const composed = await publishBodyOnce(first.ports, subject, "ja");
  expect(composed).toEqual({ kind: "composed", ...SECTIONS });
  // **The report is what it was composed from**, read through the port that has
  // continuo, and handed over as material in the language the lap asked for.
  expect(first.reports()).toBe(1);
  expect(first.documents[0]).toContain(REPORT);
  expect(first.documents[0]).toContain("IETF language tag 'ja'");

  // **The row, under the composing's own name and version** (`D-0077` rule
  // 1.2's shape): a body must never read as a revise draft or a drafted scope.
  const row = await advisory.publishBodyFor(subject.iterationId, subject.gateId);
  expect(row?.drafter).toBe(publishBodyDrafterName(drafterRow()));
  expect(row?.drafter).toMatch(/^rondo\/publish-body\/1\//);
  expect(row?.payload).toEqual({ kind: "composed", ...SECTIONS });

  // **A second pass composes nothing.** The preview runs on every redraw and the
  // press runs again inside itself; both read the row, so both have one body.
  const again = ports(advisory, REPORT, { ...SECTIONS, summary: "Something else entirely." });
  expect(await publishBodyOnce(again.ports, subject, "ja")).toEqual(composed);
  expect(again.documents).toHaveLength(0);
  expect(again.reports()).toBe(0);
  // The press itself reads and composes nothing at all: no report, no drafter.
  expect(await recordedPublishBody(advisory, subject)).toEqual(composed);
});

test("two previews running at once compose one body between them (rondo#290)", async () => {
  const { record, advisory } = await closedLap("ja");
  const subject = { iterationId: record.id, gateId: `gate-${record.id}` };
  // **The page redraws while it is drawing**: two passes reach this together,
  // and what must not happen is two model answers and two rows. The second pass
  // joins the first's run rather than putting the question again, so there is
  // one document, one row and one body -- and a body that differed between two
  // open screens would refuse whichever press came second.
  const passes = [
    ports(advisory, REPORT),
    ports(advisory, REPORT, { ...SECTIONS, summary: "Something else entirely." }),
  ];
  const both = await Promise.all(
    passes.map(async (pass) => await publishBodyOnce(pass.ports, subject, "ja")),
  );
  expect(both[0]).toEqual(both[1]);
  expect(both[0]).toEqual({ kind: "composed", ...SECTIONS });
  // **Composed once, not composed twice and reconciled**: a drafter run is
  // spent, and the answer the losing pass would have thrown away is never asked
  // for at all.
  expect(passes.reduce((all, pass) => all + pass.documents.length, 0)).toBe(1);
  expect(passes.reduce((all, pass) => all + pass.reports(), 0)).toBe(1);
  // One row, whichever pass wrote it, and it is what a press reads.
  expect(await recordedPublishBody(advisory, subject)).toEqual(both[0]);
});

test("a report that would not read is recorded as such, so the screen and the press still agree (rondo#290)", async () => {
  const { record, advisory } = await closedLap("ja");
  const subject = { iterationId: record.id, gateId: `gate-${record.id}` };
  const first = ports(advisory, null);
  const outcome = await publishBodyOnce(first.ports, subject, "ja");
  expect(outcome?.kind).toBe("unavailable");
  expect(first.documents).toHaveLength(0);
  // Recorded all the same: a body that is missing is missing on both surfaces,
  // which is what keeps the press's digest the screen's.
  expect(await recordedPublishBody(advisory, subject)).toEqual(outcome);
  // And a later pass does not spend on it again.
  const again = ports(advisory, REPORT);
  expect(await publishBodyOnce(again.ports, subject, "ja")).toEqual(outcome);
  expect(again.reports()).toBe(0);
});

test("the recorded body is the body the pull request is opened with, and the report is not in it (rondo#290)", async () => {
  const { record, advisory } = await closedLap("ja");
  const subject = { iterationId: record.id, gateId: `gate-${record.id}` };
  await publishBodyOnce(ports(advisory, REPORT).ports, subject, "ja");
  const composedBody = await recordedPublishBody(advisory, subject);

  // What `publish` hands the forge: `pullRequestText`'s body over the plan's
  // record and the recorded sections, which is the string `gh pr create` is
  // given (`publishPlanFor`, `commandPublish`).
  const text = pullRequestText({
    record,
    runId: record.runId ?? "run-0001",
    topicBranch: "rondo/lap",
    baseBranch: "main",
    headIsQualified: false,
    work: { kind: "unreadable", part: "history", reason: "not read here" },
    predecessor: null,
    verificationClaims: [],
    composedBody,
  });
  expect(text.body).toContain(SECTIONS.summary);
  expect(text.body).toContain(SECTIONS.grounds);
  expect(text.body).toContain(SECTIONS.verification);
  // **The report's own words are nowhere in it** (rule 4.2): what reaches the
  // body is the English account of it and nothing else.
  expect(text.body).not.toContain("変更の要旨");
});

test("a lap that asked its worker for no language still records a composed body (rondo#290)", async () => {
  const { record, advisory } = await closedLap(null);
  const subject = { iterationId: record.id, gateId: `gate-${record.id}` };
  // **The plan names no language, and the composing runs anyway.** What the row
  // holds is the language the lap *asked* for, and a lap that asked for none
  // still reports in whatever language the request was written in -- which is
  // the case whose body used to reach the forge with no English account in it.
  expect(record.plan["material_language"]).toBe(null);
  const first = ports(advisory, REPORT);
  expect(await publishBodyOnce(first.ports, subject, null)).toEqual({
    kind: "composed",
    ...SECTIONS,
  });
  expect(first.documents[0]).toContain(REPORT);
  // The document says the language was not asked for rather than naming one.
  expect(first.documents[0]).toContain("no particular language");
  expect(first.documents[0]).not.toContain("IETF language tag '");
  expect(await recordedPublishBody(advisory, subject)).toEqual({ kind: "composed", ...SECTIONS });
});

test("a row that would not write leaves the preview reading no body, as the press does (rondo#290)", async () => {
  const { record, advisory } = await closedLap("ja");
  // **The row is what both surfaces read, so a write that fails is a body both
  // of them do without.** A press finds no row and composes nothing
  // (`pressedPublishBody`); a preview whose row would not write answers the same
  // null, and the two therefore render one body rather than disagreeing over the
  // digest the press compares.
  const subject = { iterationId: record.id, gateId: "gate-not-this-lap" };
  const first = ports(advisory, REPORT);
  expect(await publishBodyOnce(first.ports, subject, "ja")).toBe(null);
  expect(await recordedPublishBody(advisory, subject)).toBe(null);
});
