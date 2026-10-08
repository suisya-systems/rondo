/**
 * A store with one request, a lap at its gate and a question, for the thread
 * explainer's suites (rondo#401, D-0177).
 */

import { contentDigest, planDigest } from "../../../src/store/plan.js";
import type { JsonRecord } from "../../../src/store/records.js";
import { AGENT_TYPE_INPUT, agentTypeDigestOf, planDocument } from "../fixtures/drafter.js";
import { fresh, openGate, openRequest, PLAN, reserve } from "../page-world.js";

export const REQUEST = "request-1";
export const LAP = "lap-1";
export const QUESTION = "question-1";

export type World = ReturnType<typeof fresh>;

/** The request "Fix the flaky test.", its lap waiting at the gate, and a note rondo wrote. */
export async function asked(about: JsonRecord | null = null, body = "What does this mean?") {
  const w = fresh();
  await openRequest(w, REQUEST, "Fix the flaky test.\nIt fails one run in ten.");
  await reserve(w, LAP, "Fix the flaky test.", null, REQUEST);
  await openGate(w, LAP);
  const said = await w.record.recordThreadMessage({
    messageId: "note-1",
    body: "The lap stopped at its gate after 3 commits.",
    authorKind: "drafter",
    authorId: "rondo/flow/1",
    inReplyTo: REQUEST,
    atMs: 2_500,
    bases: [{ form: "message", messageId: REQUEST }],
    asks: false,
  });
  if (said.kind !== "recorded") throw new Error(JSON.stringify(said));
  await ask(w, QUESTION, about, body);
  return w;
}

export async function ask(
  w: World,
  messageId: string,
  about: JsonRecord | null,
  body = "What does this mean?",
): Promise<void> {
  const outcome = await w.record.recordThreadMessage({
    messageId,
    body,
    authorKind: "operator",
    authorId: "ada",
    inReplyTo: REQUEST,
    atMs: 3_000,
    bases: about === null ? [] : [about],
    asks: false,
  });
  if (outcome.kind !== "recorded") throw new Error(JSON.stringify(outcome));
}

/** An approval of `costUsd` in force over the request, expiring at `expiresAtMs`. */
export async function approve(
  w: World,
  costUsd = 10,
  expiresAtMs = 10_000_000,
  requests: JsonRecord[string] = [REQUEST],
): Promise<void> {
  // An agent type the scope records from a plan (D-0066 rule 1.2.3).
  const document = planDocument();
  const digest = agentTypeDigestOf(document);
  const payload: JsonRecord = {
    requests,
    workspaces: [{ repository: PLAN.repository, workspace_root: PLAN.workspaceRoot }],
    agent_types: [digest],
    budgets: {
      laps: 10,
      review_rounds: 3,
      cost_usd: costUsd,
      cost_reserve_usd: 1,
      expires_at_ms: expiresAtMs,
    },
    severity_threshold: "major",
    outward_acts: [],
    irreversible_additions: [],
  };
  const scope = await w.record.recordScope({
    scopeId: "scope-1",
    payload,
    supersedesScopeId: null,
    authorKind: "operator",
    authorId: "ada",
    bases: [],
    createdAtMs: 1,
    agentTypeRecords: [
      {
        agentTypeDigest: digest,
        agentTypeInput: AGENT_TYPE_INPUT,
        planDigest: planDigest(document),
      },
    ],
  });
  if (scope.kind !== "recorded") throw new Error(JSON.stringify(scope));
  const decided = await w.record.recordScopeDecision({
    scopeDecisionId: "sd-1",
    scopeId: "scope-1",
    scopeDigest: contentDigest(payload),
    outcome: "approved",
    actorId: "ada",
    recordedBy: "rondo/cli",
    decidedAtMs: 1,
  });
  if (decided.kind !== "recorded") throw new Error(JSON.stringify(decided));
}
