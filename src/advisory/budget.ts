/**
 * A drafted scope's five budgets, computed from recorded laps (D-0071 rule 4.2).
 *
 * **Pure and total.** A function of the listed agent types, the number of plans,
 * the review rounds, the iteration rows and the draft time, so every value is
 * re-derivable from the rows it names. Every store gets a value for every field:
 * a measurement no row holds falls through to its cold start, never to a hole
 * (rule 4.3, D-0066 rule 1.2.4).
 *
 * **Every value carries its bases** (rule 4.2's last item): the iteration rows it
 * was read from, or the words {@link COLD_START}. A value is never returned
 * without them, so a screen can show where each number came from.
 */

/** The words a value not measured in this store carries (rule 4.2). */
export const COLD_START = "cold start: not measured in this store";

/** Rule 4.2.2: the reserve laps 8 and 9 chose by hand. */
export const COLD_START_RESERVE_USD = 2.5;
/** Rule 4.2.6: above every recorded lap duration. */
export const COLD_START_LAP_DURATION_MS = 30 * 60 * 1000;
/** Rule 4.2.6: the person's replies. Not a measurement (D-0071 residual). */
export const REPLY_ALLOWANCE_MS = 24 * 60 * 60 * 1000;
/** D-0064 rule 3.1.4. */
export const DEFAULT_REVIEW_ROUNDS = 3;
/** Rule 4.2.1: rows read per level. */
const SAMPLE = 10;

/** The fields of an iteration row the function reads. */
export interface BudgetRow {
  readonly id: string;
  readonly agentTypeDigest: string | null;
  readonly modelTier: string | null;
  readonly supersedesIterationId: string | null;
  readonly lapCostUsd: number | null;
  readonly lapDurationMs: number | null;
  readonly createdAtMs: number;
}

/** A listed agent type, with its tier read back from the held record, or null when none reads. */
export interface BudgetAgentType {
  readonly digest: string;
  readonly modelTier: string | null;
}

export interface BudgetInput {
  readonly agentTypes: readonly BudgetAgentType[];
  /** `P`: the number of plans the scope covers. */
  readonly plans: number;
  readonly reviewRounds?: number;
  readonly rows: readonly BudgetRow[];
  /** The draft time (rule 4.2.6). */
  readonly draftedAtMs: number;
}

export type Measurement = "first_lap_cost" | "redo_cost" | "lap_duration";

/**
 * Where one measurement came from, for one listed agent type.
 *
 * `text` is a sentence a person reads at a glance; `iterationIds` are the rows,
 * for a screen to link rather than for anyone to copy.
 */
export type BudgetBasis =
  | {
      readonly kind: "rows";
      readonly measurement: Measurement;
      readonly agentTypeDigest: string;
      readonly level: "agent_type" | "model_tier";
      readonly modelTier: string | null;
      /** The highest value those rows hold. */
      readonly value: number;
      readonly iterationIds: readonly string[];
      readonly text: string;
    }
  | {
      readonly kind: "cold_start";
      readonly measurement: Measurement;
      readonly agentTypeDigest: string | null;
      readonly value: number;
      readonly text: string;
    }
  | { readonly kind: "given"; readonly text: string };

export interface BudgetValue {
  readonly value: number;
  /** How the value follows from its bases, in words. */
  readonly formula: string;
  readonly bases: readonly BudgetBasis[];
}

export interface ScopeBudgets {
  readonly laps: BudgetValue;
  readonly review_rounds: BudgetValue;
  readonly cost_usd: BudgetValue;
  readonly cost_reserve_usd: BudgetValue;
  readonly expires_at_ms: BudgetValue;
}

const LABEL: Record<Measurement, string> = {
  first_lap_cost: "first-lap cost",
  redo_cost: "redo cost",
  lap_duration: "lap duration",
};

function measured(row: BudgetRow, measurement: Measurement): number | null {
  switch (measurement) {
    case "first_lap_cost":
      return row.supersedesIterationId === null ? row.lapCostUsd : null;
    case "redo_cost":
      return row.supersedesIterationId === null ? null : row.lapCostUsd;
    case "lap_duration":
      return row.lapDurationMs;
  }
}

/** Rule 4.2.1: the 10 most recent rows holding the measurement, by digest, then by tier. */
function lookUp(
  rows: readonly BudgetRow[],
  agentType: BudgetAgentType | null,
  measurement: Measurement,
  coldStart: number,
): BudgetBasis {
  const recent = (match: (row: BudgetRow) => boolean) =>
    rows
      .filter((row) => match(row) && measured(row, measurement) !== null)
      .sort((a, b) => b.createdAtMs - a.createdAtMs || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
      .slice(0, SAMPLE);
  const levels: readonly (readonly ["agent_type" | "model_tier", BudgetRow[]])[] =
    agentType === null
      ? []
      : [
          ["agent_type", recent((row) => row.agentTypeDigest === agentType.digest)],
          [
            "model_tier",
            agentType.modelTier === null
              ? []
              : recent((row) => row.modelTier === agentType.modelTier),
          ],
        ];
  for (const [level, found] of levels) {
    if (agentType === null || found.length === 0) continue;
    const value = Math.max(...found.map((row) => measured(row, measurement) as number));
    const of = level === "agent_type" ? "this agent type" : `tier ${agentType.modelTier}`;
    return {
      kind: "rows",
      measurement,
      agentTypeDigest: agentType.digest,
      level,
      modelTier: agentType.modelTier,
      value,
      iterationIds: found.map((row) => row.id),
      text: `highest ${LABEL[measurement]} of the ${found.length} most recent recorded lap${found.length === 1 ? "" : "s"} of ${of}`,
    };
  }
  return {
    kind: "cold_start",
    measurement,
    agentTypeDigest: agentType?.digest ?? null,
    value: coldStart,
    text: `${LABEL[measurement]}: ${COLD_START}`,
  };
}

/** Each listed agent type's lookup, or one cold start when none is listed. */
function lookUpAll(input: BudgetInput, measurement: Measurement, coldStart: number): BudgetBasis[] {
  const types = input.agentTypes.length === 0 ? [null] : input.agentTypes;
  return types.map((type) => lookUp(input.rows, type, measurement, coldStart));
}

function highest(bases: readonly BudgetBasis[]): number {
  return Math.max(...bases.map((basis) => (basis.kind === "given" ? 0 : basis.value)));
}

/** Rule 4.2.2: up to the next 0.10 USD. The epsilon keeps 1.2 from reading as 1.3. */
const tenthUp = (usd: number) => Math.ceil(Math.round(usd * 1e6) / 1e5) / 10;
const cents = (usd: number) => Math.round(usd * 100) / 100;

/** D-0071 rule 4.2 over the rows given. Throws only on a caller's malformed count. */
export function computeScopeBudgets(input: BudgetInput): ScopeBudgets {
  const rounds = input.reviewRounds ?? DEFAULT_REVIEW_ROUNDS;
  for (const [name, n] of [
    ["plans", input.plans],
    ["reviewRounds", rounds],
  ] as const) {
    if (!Number.isSafeInteger(n) || n < 0)
      throw new Error(`${name} must be a whole number of at least 0`);
  }
  const P = input.plans;

  const firstBases = lookUpAll(input, "first_lap_cost", COLD_START_RESERVE_USD);
  const reserve = tenthUp(highest(firstBases));
  // Rule 4.2.3: a redo cost no row holds is the reserve.
  const redoBases = lookUpAll(input, "redo_cost", reserve);
  const redo = tenthUp(highest(redoBases));
  const durationBases = lookUpAll(input, "lap_duration", COLD_START_LAP_DURATION_MS);
  const longest = highest(durationBases);

  const laps = P * rounds;
  const roundsBasis: BudgetBasis = {
    kind: "given",
    text:
      input.reviewRounds === undefined
        ? `review rounds: the default ${DEFAULT_REVIEW_ROUNDS} (D-0064 rule 3.1.4)`
        : `review rounds: ${rounds}, as given`,
  };
  const plansBasis: BudgetBasis = { kind: "given", text: `plans: ${P}` };
  return {
    review_rounds: { value: rounds, formula: "review rounds", bases: [roundsBasis] },
    laps: {
      value: laps,
      formula: `plans x review rounds = ${P} x ${rounds}`,
      bases: [plansBasis, roundsBasis],
    },
    cost_reserve_usd: {
      value: reserve,
      formula: "highest first-lap cost, rounded up to the next 0.10 USD",
      bases: firstBases,
    },
    cost_usd: {
      value: cents(P * (reserve + Math.max(rounds - 1, 0) * Math.max(redo, reserve))),
      formula:
        `plans x (reserve + (review rounds - 1) x max(redo, reserve)) = ` +
        `${P} x (${reserve.toFixed(2)} + ${Math.max(rounds - 1, 0)} x ${Math.max(redo, reserve).toFixed(2)})`,
      bases: [plansBasis, roundsBasis, ...firstBases, ...redoBases],
    },
    expires_at_ms: {
      value: input.draftedAtMs + laps * longest + REPLY_ALLOWANCE_MS,
      formula: `draft time + laps x longest lap duration + 24 h = draft time + ${laps} x ${Math.round(longest / 1000)} s + 24 h`,
      bases: [
        plansBasis,
        roundsBasis,
        ...durationBases,
        { kind: "given", text: "24 h for the person's replies: not a measurement" },
      ],
    },
  };
}
