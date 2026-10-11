/**
 * What a scope form posts, read as values (rondo#233 S3, rondo#238 C2b):
 * lifted out of `web-app.ts` unchanged, so the router stays under its size cap.
 */

import {
  FINDING_SEVERITIES,
  type FindingSeverity,
  SCOPE_OUTWARD_ACTS,
  type ScopeOutwardAct,
} from "../store/records.js";
import type { ScopeFormDraft } from "./web-app.js";

/** A whole count of at least 0, as a form posts one, or null when it is not one. */
export function wholeNumber(value: unknown): number | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  const read = Number(value);
  return Number.isSafeInteger(read) && read >= 0 ? read : null;
}

/** An amount of at least 0, as a form posts one, or null when it is not one. */
function amount(value: unknown): number | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  const read = Number(value);
  return Number.isFinite(read) && read >= 0 ? read : null;
}

/**
 * The expiry as the form posts it: a native `datetime-local`'s wall clock,
 * **read as UTC**.
 *
 * A person does not read or type a Unix millisecond, and with no script on the
 * screen the browser's zone is not a fact this process has. So the field has
 * one meaning, the label says which (`scopeExpiresLabel` names UTC), and a
 * browser with no `datetime-local` degrades to a text box of the same shape
 * that this reads identically.
 */
function expiryMs(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    return null;
  }
  const at = Date.parse(`${value}Z`);
  return Number.isFinite(at) ? at : null;
}

/**
 * What one scope form posted, read as values -- or null when one of them is not
 * a value rondo can use.
 *
 * Refused rather than repaired: a budget silently corrected is a person
 * approving a scope they did not draft.
 */
export function scopeDraftOf(
  form: Record<string, unknown>,
  scopeId: string,
  requestMessageId: string,
): ScopeFormDraft | null {
  const planDigest = form["plan_digest"];
  const agentTypeDigest = form["agent_type"];
  if (typeof planDigest !== "string" || typeof agentTypeDigest !== "string") {
    return null;
  }
  const values = scopeValuesOf(form);
  return values === null
    ? null
    : { scopeId, requestMessageId, planDigest, agentTypeDigest, ...values };
}

/**
 * The values a scope form posts -- the five budgets, the threshold, the outward
 * acts -- read as values, or null when one is not a value rondo can use. Shared
 * by the person's own form and the drafted one (rondo#238 C2b), so a budget is
 * read one way whichever screen posted it.
 */
export function scopeValuesOf(form: Record<string, unknown>): {
  readonly budgets: ScopeFormDraft["budgets"];
  readonly severityThreshold: FindingSeverity;
  readonly outwardActs: readonly ScopeOutwardAct[];
} | null {
  const budgets = budgetsOf(form);
  if (budgets === null) {
    return null;
  }
  const severity = form["severity_threshold"];
  if (
    typeof severity !== "string" ||
    !(FINDING_SEVERITIES as readonly string[]).includes(severity)
  ) {
    return null;
  }
  const posted = form["outward_acts"];
  const acts = posted === undefined ? [] : Array.isArray(posted) ? posted : [posted];
  if (
    !acts.every(
      (act): act is ScopeOutwardAct =>
        typeof act === "string" && (SCOPE_OUTWARD_ACTS as readonly string[]).includes(act),
    )
  ) {
    return null;
  }
  return {
    budgets,
    severityThreshold: severity as FindingSeverity,
    outwardActs: acts,
  };
}

/** The five budgets a scope form posts, or null when one is not a value rondo can use. */
export function budgetsOf(form: Record<string, unknown>): ScopeFormDraft["budgets"] | null {
  const laps = wholeNumber(form["laps"]);
  const reviewRounds = wholeNumber(form["review_rounds"]);
  const costUsd = amount(form["cost_usd"]);
  const costReserveUsd = amount(form["cost_reserve_usd"]);
  const expiresAtMs = expiryMs(form["expires_at_ms"]);
  if (
    laps === null ||
    reviewRounds === null ||
    costUsd === null ||
    costReserveUsd === null ||
    expiresAtMs === null
  ) {
    return null;
  }
  return {
    laps,
    review_rounds: reviewRounds,
    cost_usd: costUsd,
    cost_reserve_usd: costReserveUsd,
    expires_at_ms: expiresAtMs,
  };
}
