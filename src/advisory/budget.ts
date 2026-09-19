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
 * was read from, or the fact that nothing in this store measured it. A value is
 * never returned without them, so a screen can show where each number came from.
 *
 * **Nothing here is a sentence** (D-0055 rules 3 and 12). A basis and a formula
 * are the facts they are made of -- which measurement, at which level, over how
 * many rows -- and the words for them live in one catalogue per language
 * (`src/access/wording.ts`). This module composed English here until rondo#233
 * S3's screen review found a Japanese page whose every formula and every basis
 * was English: a pre-interpolated line is a line no second set can rewrite.
 */

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
 * `iterationIds` are the rows, for a screen to link rather than for anyone to
 * copy. A `given` basis is a number nobody measured, and `given` says which of
 * the three it is, because each is said in its own words.
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
      /**
       * The lowest, so a screen can say how far apart the sample is (rondo#247).
       * Not used in any arithmetic: the budget is the highest, and stays it.
       */
      readonly lowest: number;
      readonly iterationIds: readonly string[];
    }
  | {
      readonly kind: "cold_start";
      readonly measurement: Measurement;
      readonly agentTypeDigest: string | null;
      readonly value: number;
    }
  | {
      readonly kind: "given";
      readonly given: "plans" | "review_rounds" | "reply_allowance";
      readonly value: number;
      /** `review_rounds` only: no caller named one, so D-0064's default stands. */
      readonly byDefault: boolean;
    };

/**
 * How one value follows from its bases: the arithmetic, with the numbers that
 * went into it, for a catalogue to say in either language.
 *
 * One member per field rather than a tree of operators: five budgets have five
 * fixed shapes, and an expression tree would be a small language nobody asked
 * for and a screen would still have to spell out arm by arm.
 */
export type BudgetFormula =
  | { readonly kind: "review_rounds" }
  | { readonly kind: "laps"; readonly plans: number; readonly reviewRounds: number }
  | { readonly kind: "cost_reserve_usd" }
  | {
      readonly kind: "cost_usd";
      readonly plans: number;
      readonly reserveUsd: number;
      /** The rounds after the first, each budgeted at `redoUsd`. */
      readonly laterRounds: number;
      readonly redoUsd: number;
    }
  | { readonly kind: "expires_at_ms"; readonly laps: number; readonly longestMs: number };

export interface BudgetValue {
  readonly value: number;
  /** How the value follows from its bases (the words are the catalogue's). */
  readonly formula: BudgetFormula;
  readonly bases: readonly BudgetBasis[];
}

export interface ScopeBudgets {
  readonly laps: BudgetValue;
  readonly review_rounds: BudgetValue;
  readonly cost_usd: BudgetValue;
  readonly cost_reserve_usd: BudgetValue;
  readonly expires_at_ms: BudgetValue;
}

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
    const values = found.map((row) => measured(row, measurement) as number);
    return {
      kind: "rows",
      measurement,
      agentTypeDigest: agentType.digest,
      level,
      modelTier: agentType.modelTier,
      value: Math.max(...values),
      lowest: Math.min(...values),
      iterationIds: found.map((row) => row.id),
    };
  }
  return {
    kind: "cold_start",
    measurement,
    agentTypeDigest: agentType?.digest ?? null,
    value: coldStart,
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
    given: "review_rounds",
    value: rounds,
    byDefault: input.reviewRounds === undefined,
  };
  const plansBasis: BudgetBasis = { kind: "given", given: "plans", value: P, byDefault: false };
  const laterRounds = Math.max(rounds - 1, 0);
  const redoUsd = Math.max(redo, reserve);
  return {
    review_rounds: { value: rounds, formula: { kind: "review_rounds" }, bases: [roundsBasis] },
    laps: {
      value: laps,
      formula: { kind: "laps", plans: P, reviewRounds: rounds },
      bases: [plansBasis, roundsBasis],
    },
    cost_reserve_usd: {
      value: reserve,
      formula: { kind: "cost_reserve_usd" },
      bases: firstBases,
    },
    cost_usd: {
      value: cents(P * (reserve + laterRounds * redoUsd)),
      formula: { kind: "cost_usd", plans: P, reserveUsd: reserve, laterRounds, redoUsd },
      bases: [plansBasis, roundsBasis, ...firstBases, ...redoBases],
    },
    expires_at_ms: {
      value: input.draftedAtMs + laps * longest + REPLY_ALLOWANCE_MS,
      formula: { kind: "expires_at_ms", laps, longestMs: longest },
      bases: [
        plansBasis,
        roundsBasis,
        ...durationBases,
        {
          kind: "given",
          given: "reply_allowance",
          value: REPLY_ALLOWANCE_MS,
          byDefault: false,
        },
      ],
    },
  };
}
