/**
 * The scope payload reader (D-0066 rule 1.2), moved out of `records.ts` whole
 * (D-0168: that file is at its size cap). The shapes it reads stay in
 * `records.ts`; this file holds only the strict, total reading of them.
 */
import {
  BELOW_THRESHOLD,
  type BelowThreshold,
  FINDING_SEVERITIES,
  type FindingSeverity,
  type JsonRecord,
  type JsonValue,
  SCOPE_OUTWARD_ACTS,
  type ScopeOutwardAct,
  type ScopePayload,
  type ScopeRequests,
  type ScopeWorkspace,
} from "./records.js";

export type ScopePayloadReading =
  | { readonly kind: "read"; readonly payload: ScopePayload }
  | { readonly kind: "refused"; readonly reason: string };

const SCOPE_KEYS = Object.freeze([
  "requests",
  "workspaces",
  "agent_types",
  "budgets",
  "severity_threshold",
  "outward_acts",
  "irreversible_additions",
  "below_threshold",
]);
const WORKSPACE_KEYS = Object.freeze(["repository", "workspace_root"]);
const BUDGET_KEYS = Object.freeze([
  "laps",
  "review_rounds",
  "cost_usd",
  "cost_reserve_usd",
  "expires_at_ms",
]);
const AGENT_TYPE_DIGEST = /^sha256:[0-9a-f]{64}$/;

/**
 * Read a stored or authored scope payload, **total**: a refusal carrying why,
 * never a throw (D-0066 rule 1.2).
 *
 * Strict on purpose. A payload is approved by digest and then tested field by
 * field under a write lock, so a key this reader does not know is a field a
 * person approved that no test will ever read -- which is a scope wider than it
 * looks. Unknown keys are refused at every level for that reason, and so are
 * duplicates: a list the person reads as "three agent types" that holds two is
 * the screen overstating the scope.
 */
export function readScopePayload(json: JsonValue): ScopePayloadReading {
  const refused = (reason: string): ScopePayloadReading => ({
    kind: "refused",
    reason: `the scope payload is refused: ${reason}`,
  });
  if (!isRecord(json)) {
    return refused("it is not a JSON object");
  }
  const unknown = unknownKey(json, SCOPE_KEYS);
  if (unknown !== null) {
    return refused(
      `'${unknown}' is not a scope field, and a field no test reads is a scope wider than it looks`,
    );
  }

  const requestsValue = json["requests"];
  let requests: ScopeRequests;
  if (isRecord(requestsValue)) {
    const extra = unknownKey(requestsValue, ["from_goal"]);
    const goalId = requestsValue["from_goal"];
    if (extra !== null || typeof goalId !== "string" || goalId === "") {
      return refused(
        'requests is a list of message ids or {"from_goal": "<goal_id>"} and nothing else ' +
          "(D-0066 rule 1.2.1, D-0128 rule 1)",
      );
    }
    requests = Object.freeze({ from_goal: goalId });
  } else {
    const named = distinctStrings(requestsValue, "requests", false);
    if (typeof named === "string") {
      return refused(named);
    }
    requests = Object.freeze(named);
  }
  const agentTypes = distinctStrings(json["agent_types"], "agent_types", false);
  if (typeof agentTypes === "string") {
    return refused(agentTypes);
  }
  const malformed = agentTypes.find((digest) => !AGENT_TYPE_DIGEST.test(digest));
  if (malformed !== undefined) {
    return refused(
      `agent_types holds '${malformed}', which is not an agentTypeDigest ('sha256:' and 64 ` +
        "lowercase hex, D-0066 rule 1.2.3)",
    );
  }

  const workspacesValue = json["workspaces"];
  if (!Array.isArray(workspacesValue) || workspacesValue.length === 0) {
    return refused("workspaces must be a non-empty list (D-0066 rule 1.2.2)");
  }
  const workspaces: ScopeWorkspace[] = [];
  const seenPairs = new Set<string>();
  for (const entry of workspacesValue as readonly JsonValue[]) {
    if (!isRecord(entry)) {
      return refused("each workspaces entry must be an object");
    }
    const extra = unknownKey(entry, WORKSPACE_KEYS);
    if (extra !== null) {
      return refused(`'${extra}' is not a workspaces field`);
    }
    const repository = entry["repository"];
    const workspaceRoot = entry["workspace_root"];
    if (typeof repository !== "string" || typeof workspaceRoot !== "string") {
      return refused("each workspaces entry needs a string repository and workspace_root");
    }
    const pair = JSON.stringify([repository, workspaceRoot]);
    if (seenPairs.has(pair)) {
      return refused(`workspaces names (${repository}, ${workspaceRoot}) twice`);
    }
    seenPairs.add(pair);
    workspaces.push(Object.freeze({ repository, workspace_root: workspaceRoot }));
  }

  const budgetsValue = json["budgets"];
  if (!isRecord(budgetsValue)) {
    return refused("budgets must be an object holding all five budgets (D-0066 rule 1.2.4)");
  }
  const extraBudget = unknownKey(budgetsValue, BUDGET_KEYS);
  if (extraBudget !== null) {
    return refused(`'${extraBudget}' is not a budget`);
  }
  const missing = BUDGET_KEYS.find((key) => budgetsValue[key] === undefined);
  if (missing !== undefined) {
    return refused(
      `the budget '${missing}' is missing, and all five are required: a scope with no expiry or ` +
        "no cost bound would be a standing grant (D-0066 rule 1.2.4)",
    );
  }
  const laps = budgetsValue["laps"];
  const reviewRounds = budgetsValue["review_rounds"];
  const costUsd = budgetsValue["cost_usd"];
  const costReserveUsd = budgetsValue["cost_reserve_usd"];
  const expiresAtMs = budgetsValue["expires_at_ms"];
  for (const [name, value] of [
    ["laps", laps],
    ["review_rounds", reviewRounds],
  ] as const) {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
      return refused(`the budget '${name}' must be a whole number of at least 0`);
    }
  }
  for (const [name, value] of [
    ["cost_usd", costUsd],
    ["cost_reserve_usd", costReserveUsd],
  ] as const) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      return refused(`the budget '${name}' must be a finite number of at least 0`);
    }
  }
  if (typeof expiresAtMs !== "number" || !Number.isSafeInteger(expiresAtMs)) {
    return refused("the budget 'expires_at_ms' must be a whole number of milliseconds");
  }

  const threshold = json["severity_threshold"];
  if (!(FINDING_SEVERITIES as readonly unknown[]).includes(threshold)) {
    return refused(
      `severity_threshold must be one of ${FINDING_SEVERITIES.join(", ")} (D-0065 rule 2.2)`,
    );
  }

  const outward = distinctStrings(json["outward_acts"], "outward_acts", true);
  if (typeof outward === "string") {
    return refused(outward);
  }
  for (const act of outward) {
    if (!(SCOPE_OUTWARD_ACTS as readonly string[]).includes(act)) {
      return refused(
        `outward_acts holds '${act}', which is not one of ${SCOPE_OUTWARD_ACTS.join(", ")} ` +
          "(D-0066 rule 1.2.6, D-0064 O7)",
      );
    }
  }

  const additions = distinctStrings(json["irreversible_additions"], "irreversible_additions", true);
  if (typeof additions === "string") {
    return refused(additions);
  }
  if (additions.some((name) => name === "")) {
    return refused("irreversible_additions holds an empty name");
  }

  const belowThreshold = json["below_threshold"];
  if (
    belowThreshold !== undefined &&
    !(BELOW_THRESHOLD as readonly unknown[]).includes(belowThreshold)
  ) {
    return refused(
      `below_threshold must be one of ${BELOW_THRESHOLD.join(", ")} when present (D-0098 rule 5.2)`,
    );
  }

  return {
    kind: "read",
    payload: Object.freeze({
      requests,
      workspaces: Object.freeze(workspaces),
      agent_types: Object.freeze(agentTypes),
      budgets: Object.freeze({
        laps: laps as number,
        review_rounds: reviewRounds as number,
        cost_usd: costUsd as number,
        cost_reserve_usd: costReserveUsd as number,
        expires_at_ms: expiresAtMs,
      }),
      severity_threshold: threshold as FindingSeverity,
      outward_acts: Object.freeze(outward as ScopeOutwardAct[]),
      irreversible_additions: Object.freeze(additions),
      // Absent stays absent, so a payload read and spread again (a raise,
      // D-0074) digests as the one it came from.
      ...(belowThreshold === undefined
        ? {}
        : { below_threshold: belowThreshold as BelowThreshold }),
    }),
  };
}

function isRecord(value: JsonValue | undefined): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unknownKey(record: JsonRecord, known: readonly string[]): string | null {
  return Object.keys(record).find((key) => !known.includes(key)) ?? null;
}

/** A list of distinct strings, or why not. `mayBeEmpty` is false for rule 1.2's non-empty lists. */
function distinctStrings(
  value: JsonValue | undefined,
  name: string,
  mayBeEmpty: boolean,
): string[] | string {
  if (!Array.isArray(value)) {
    return `${name} must be a list`;
  }
  const list = value as readonly JsonValue[];
  if (!mayBeEmpty && list.length === 0) {
    return `${name} must not be empty (D-0066 rule 1.2)`;
  }
  if (list.some((entry) => typeof entry !== "string")) {
    return `${name} must hold only strings`;
  }
  const strings = list as readonly string[];
  if (new Set(strings).size !== strings.length) {
    return `${name} holds a duplicate`;
  }
  return [...strings];
}
