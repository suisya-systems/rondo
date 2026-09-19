/**
 * Raising a running lap's budget (D-0074): the raise press records a successor
 * that differs from the approval only in its budgets and approves it; the lap's
 * next act then spends that successor, and a press naming the old approval is
 * refused; the refusals write nothing.
 *
 * Over a real store file, because the page's presses open the store by path.
 * The lap is put at its gate and its admission row written with SQL, as
 * `test/store/scope-record.test.ts` writes one: nothing here runs continuo, and
 * every refusal below lands before anything would.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import { raiseScopeFromPage, reviseFromPage } from "../../src/access/cli.js";
import { approvalTip } from "../../src/access/scope.js";
import type { RaiseInput } from "../../src/access/web-app.js";
import { contentDigest } from "../../src/store/plan.js";
import type { JsonRecord } from "../../src/store/records.js";
import { advisoryRecord, iterationStore } from "../../src/store/sqlite.js";

const ENV = { RONDO_APPROVER: "ada" };

const PAYLOAD: JsonRecord = {
  requests: ["m-req"],
  workspaces: [{ repository: "/srv/repo", workspace_root: "/srv/work" }],
  agent_types: [`sha256:${"a".repeat(64)}`],
  budgets: { laps: 1, review_rounds: 3, cost_usd: 7.5, cost_reserve_usd: 2.5, expires_at_ms: 9e15 },
  severity_threshold: "major",
  outward_acts: ["push_branch"],
  irreversible_additions: [],
};

const RAISED = {
  laps: 3,
  review_rounds: 3,
  cost_usd: 15,
  cost_reserve_usd: 2.5,
  expires_at_ms: 9e15,
};

/** A request, its approved scope, and one lap at its gate admitted under that approval. */
async function world() {
  const storePath = join(mkdtempSync(join(tmpdir(), "rondo-raise-")), "store.db");
  const connection = new DatabaseSync(storePath);
  const store = iterationStore(connection, { maxOccupying: 4, maxLive: 6 });
  const record = advisoryRecord(connection);
  const said = await record.recordThreadMessage({
    messageId: "m-req",
    body: "Please fix the parser.",
    authorKind: "operator",
    authorId: "ada",
    inReplyTo: null,
    atMs: 1,
    bases: [],
    asks: false,
  });
  expect(said.kind).toBe("recorded");
  // A lap that ran on the agent type, so the scope lists one rondo holds (D-0066 rule 1.2.3).
  const held = await store.reserve({
    id: "lap-held",
    request: "earlier work",
    plan: { run_id: "r-held", repository: "/srv/repo", workspace_root: "/srv/work" },
    runId: "rondo-lap-held",
    topicBranch: "rondo/lap-held",
    workspace: "/srv/work/lap-held",
    supersedesIterationId: null,
    requestMessageId: null,
    spend: null,
    scopeSpend: null,
    nowMs: 1,
  });
  expect(held.kind).toBe("reserved");
  connection
    .prepare("UPDATE iteration SET agent_type_digest = ?, status = 'closed' WHERE id = 'lap-held'")
    .run((PAYLOAD["agent_types"] as string[])[0] ?? "");
  expect(
    await record.recordScope({
      scopeId: "s-1",
      payload: PAYLOAD,
      supersedesScopeId: null,
      authorKind: "operator",
      authorId: "ada",
      bases: [],
      createdAtMs: 1,
      agentTypeRecords: [],
    }),
  ).toEqual({ kind: "recorded" });
  expect(
    await record.recordScopeDecision({
      scopeDecisionId: "sd-1",
      scopeId: "s-1",
      scopeDigest: contentDigest(PAYLOAD),
      outcome: "approved",
      actorId: "ada",
      recordedBy: "rondo/web",
      decidedAtMs: 2,
    }),
  ).toEqual({ kind: "recorded" });
  for (const id of ["lap-gated", "lap-ended"]) {
    const reserved = await store.reserve({
      id,
      request: "Please fix the parser.",
      plan: { run_id: `r-${id}`, repository: "/srv/repo", workspace_root: "/srv/work" },
      runId: `rondo-${id}`,
      topicBranch: `rondo/${id}`,
      workspace: `/srv/work/${id}`,
      supersedesIterationId: null,
      requestMessageId: null,
      spend: null,
      scopeSpend: null,
      nowMs: 3,
    });
    expect(reserved.kind).toBe("reserved");
    connection
      .prepare(
        "INSERT INTO scope_consumption (scope_decision_id, act_kind, subject_id, proposal_id, " +
          "consumed_at_ms) VALUES ('sd-1', 'admission', ?, NULL, 3)",
      )
      .run(id);
  }
  for (const [from, to] of [
    ["planned", "admitting"],
    ["admitting", "admitted"],
    ["admitted", "performing"],
    ["performing", "awaiting_human"],
  ] as const) {
    const moved = await store.transition(
      "lap-gated",
      from,
      to,
      to === "awaiting_human" ? { gateId: "gate-1" } : {},
      4,
    );
    expect(moved.kind).toBe("transitioned");
  }
  const count = (sql: string): number => Number((connection.prepare(sql).get() as { n: number }).n);
  const raise = (parts: Partial<RaiseInput> = {}) =>
    raiseScopeFromPage(ENV, store, storePath, "ada", {
      scopeId: "scope-raise-1",
      requestMessageId: "m-req",
      scopeDecisionId: "sd-1",
      iterationId: "lap-gated",
      budgets: RAISED,
      ...parts,
    });
  return { storePath, connection, store, record, count, raise };
}

const WINDOWS_HEAVY_TIMEOUT_MS = 60_000;

test(
  "a raise is a successor that changes only the budgets, approved on one press, and the lap's next act spends it (D-0074 sections 1, 2, 4)",
  async () => {
    const w = await world();
    const raised = await w.raise();
    expect(raised.ok).toBe(true);
    const decision = raised.scopeDecisionId ?? "";
    // One scope row naming its predecessor, with every field but the budgets
    // copied from the stored row, and its approval.
    const read = await w.record.readScope("scope-raise-1");
    expect(read.kind).toBe("read");
    if (read.kind !== "read") return;
    expect(read.scope.supersedesScopeId).toBe("s-1");
    expect(read.scope.authorKind).toBe("operator");
    expect(read.scope.bases).toEqual([{ form: "scope", scopeId: "s-1" }]);
    const { budgets, ...rest } = read.scope.payload as unknown as JsonRecord;
    const { budgets: _was, ...before } = PAYLOAD;
    expect(rest).toEqual(before);
    expect(budgets).toEqual(RAISED);
    expect(await w.record.scopeDecisionOf("scope-raise-1")).toMatchObject({
      kind: "read",
      decision: { scopeDecisionId: decision, outcome: "approved" },
    });
    // The lap's approval is now the successor; the old one is retired.
    expect(await approvalTip(w.record, "lap-gated")).toEqual({
      kind: "tip",
      scopeDecisionId: decision,
    });
    expect(await w.record.scopeSupersededByApproved("s-1")).toBe(true);

    // A second press of the same form is the write it repeats.
    const again = await w.raise();
    expect(again).toMatchObject({ ok: true, scopeDecisionId: decision });
    // A second raise drawn over the old approval, from another tab: refused, and nothing written.
    const stale = await w.raise({ scopeId: "scope-raise-2" });
    expect(stale).toMatchObject({ ok: false, why: "raiseRefusedNotTip" });
    expect(w.count("SELECT count(*) AS n FROM scope")).toBe(2);
    expect(w.count("SELECT count(*) AS n FROM scope_decision")).toBe(2);
    // Raising the raise is the ordinary next step.
    const next = await w.raise({ scopeId: "scope-raise-3", scopeDecisionId: decision });
    expect(next.ok).toBe(true);

    // A revise posting the old approval is refused before the gate is touched.
    const revised = await reviseFromPage(ENV, w.store, w.storePath, "ada", {
      iterationId: "lap-gated",
      successorId: "lap-00000000-0000-4000-8000-000000000001",
      scopeDecisionId: "sd-1",
      body: "fix the parser",
    });
    expect(revised).toMatchObject({ ok: false, why: "reviseRefusedNotItsScope" });
    expect(w.count("SELECT count(*) AS n FROM proposal")).toBe(0);
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);

test(
  "a raise that cannot be taken says why and writes nothing (D-0074 rule 4.4)",
  async () => {
    const w = await world();
    // The lap is no longer at a gate, or was never there.
    expect(await w.raise({ iterationId: "lap-ended" })).toMatchObject({
      ok: false,
      why: "raiseRefusedNotAtGate",
    });
    expect(await w.raise({ iterationId: "lap-nowhere" })).toMatchObject({
      ok: false,
      why: "raiseRefusedNotAtGate",
    });
    // A request the approval does not list, or an approval that is not one.
    expect(await w.raise({ requestMessageId: "m-other" })).toMatchObject({
      ok: false,
      why: "scopeRefusedNotTaken",
    });
    expect(await w.raise({ scopeDecisionId: "sd-none" })).toMatchObject({
      ok: false,
      why: "scopeRefusedNotTaken",
    });
    // Nobody this page may act as.
    expect(
      await raiseScopeFromPage({}, w.store, w.storePath, "ada", {
        scopeId: "scope-raise-1",
        requestMessageId: "m-req",
        scopeDecisionId: "sd-1",
        iterationId: "lap-gated",
        budgets: RAISED,
      }),
    ).toMatchObject({ ok: false, why: "scopeRefusedNotTaken" });
    expect(w.count("SELECT count(*) AS n FROM scope")).toBe(1);

    // A line with two approved tips, as a store from before D-0074 rule 1.3
    // could hold: no raise and no revise, and rondo picks neither.
    for (const id of ["s-x", "s-y"]) {
      w.connection
        .prepare(
          "INSERT INTO scope (scope_id, payload, scope_digest, supersedes_scope_id, author_kind, " +
            "author_id, bases, created_at_ms) SELECT ?, payload, scope_digest, 's-1', author_kind, " +
            "author_id, bases, created_at_ms FROM scope WHERE scope_id = 's-1'",
        )
        .run(id);
      w.connection
        .prepare(
          "INSERT INTO scope_decision (scope_decision_id, scope_id, scope_digest, outcome, " +
            "actor_id, recorded_by, decided_at_ms) SELECT ?, ?, scope_digest, 'approved', actor_id, " +
            "recorded_by, decided_at_ms FROM scope_decision WHERE scope_decision_id = 'sd-1'",
        )
        .run(`sd-${id}`, id);
    }
    expect(await w.raise({ scopeDecisionId: "sd-s-x" })).toMatchObject({
      ok: false,
      why: "raiseRefusedForked",
    });
    const revised = await reviseFromPage(ENV, w.store, w.storePath, "ada", {
      iterationId: "lap-gated",
      successorId: "lap-00000000-0000-4000-8000-000000000002",
      scopeDecisionId: "sd-s-x",
      body: "fix the parser",
    });
    expect(revised).toMatchObject({ ok: false, why: "reviseRefusedForked" });
    expect(revised.note).toContain("sd-s-x");
    expect(revised.note).toContain("sd-s-y");
    expect(w.count("SELECT count(*) AS n FROM scope")).toBe(3);
    expect(w.count("SELECT count(*) AS n FROM proposal")).toBe(0);
  },
  WINDOWS_HEAVY_TIMEOUT_MS,
);
