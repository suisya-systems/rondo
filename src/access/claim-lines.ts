/**
 * The gate's report lines about a lap's line and its claim (D-0073 rules 4.4
 * and 5): what the comparison found, and what the widening under an approval
 * wrote (D-0201). Composed from facts the conductor reads; they write nothing.
 * Out of `conductor.ts`, which is at its size cap.
 */
import type { GateWidening } from "../store/sqlite.js";
import type { ClaimComparison } from "./conductor.js";

/** What the gate's widening under an approval wrote, as the report says it (D-0073 rule 4.4's P5). */
export function gateWideningLines(
  iterationId: string,
  widened: GateWidening | { readonly kind: "defect"; readonly reason: string },
): readonly string[] {
  const quoted = (paths: readonly string[]) => paths.map((path) => `'${path}'`).join(", ");
  switch (widened.kind) {
    case "widened":
      return [
        ...(widened.added.length === 0
          ? []
          : [
              `Line ${widened.lineageId} now claims ${quoted(widened.added)}, which lap ` +
                `${iterationId} changed, under approval ${widened.scopeDecisionId}.`,
            ]),
        ...(widened.waiting.length === 0
          ? []
          : [
              `Line ${widened.lineageId} waits to claim ${quoted(widened.waiting)}, which other ` +
                `open lines hold, under approval ${widened.scopeDecisionId}; rondo claims them ` +
                "once they are free.",
            ]),
      ];
    case "retired":
      return [`The claim of lap ${iterationId}'s line was not widened: ${widened.reason}.`];
    case "defect":
      return [`What lap ${iterationId} changed was not claimed: ${widened.reason}.`];
    default:
      return [];
  }
}

export function claimComparisonLines(
  iterationId: string,
  comparison: ClaimComparison,
): readonly string[] {
  if (comparison.kind === "inside") {
    return [];
  }
  if (comparison.kind === "uncompared") {
    return [
      `What lap ${iterationId} changed was not compared with its line's claim: ${comparison.reason}.`,
    ];
  }
  const quoted = (paths: readonly string[]) => paths.map((path) => `'${path}'`).join(", ");
  return [
    ...comparison.held.map(
      (holder) =>
        `Lap ${iterationId} changed ${quoted(holder.sharedPaths)} outside line ` +
        `${comparison.lineageId}'s claim, and line ${holder.lineageId} holds it: the two lines ` +
        "collide there.",
    ),
    ...(comparison.unheld.length === 0
      ? []
      : [
          `Lap ${iterationId} changed ${quoted(comparison.unheld)} outside line ` +
            `${comparison.lineageId}'s claim, and no other open line holds it; the claim is ` +
            "left as it is.",
        ]),
  ];
}
