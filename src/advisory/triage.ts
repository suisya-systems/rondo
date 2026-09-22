/**
 * What rondo would ask for next, in one repository (DECISIONS.md D-0097): the
 * layer's half.
 *
 * **The model judges, this ranks** (D-0097 points 2.3 (a) and 5 (a)). Reading
 * "does this go against *they never open a terminal*" is a reading of prose,
 * so a model drafter says which clause each candidate goes against and drafts
 * the request, why and the open points. The order is not the model's: it is
 * the clause violated in the goal's order, then an explicit priority label,
 * then the order the candidates were found in. Effort, dependencies and
 * parallelism never rank.
 *
 * **A model answer becomes a proposal only through {@link readJudgement}**
 * (D-0063 rule 2.2): it checks the answer is in the layer's form and that every
 * candidate it names is one the material holds, which is this proposal's
 * "every basis resolves". A candidate it does not name, or names as going
 * against no clause, is withheld with that reason and never dropped (D-0064
 * O8, D-0097 point 6 (a)).
 *
 * Pure, as the rest of the layer: the material arrives gathered, and nothing
 * here reads a clock, a file or the forge.
 */
import { contentDigest } from "../store/plan.js";
import type { GoalClause, JsonRecord, JsonValue } from "../store/records.js";

/** Where a candidate was found, as a locator a person can follow (D-0032 rule 2). */
export type TriageSource =
  /** An open issue of the repository, read from the forge. */
  | { readonly form: "issue"; readonly repository: string; readonly number: number }
  /** A request whose latest try stopped or failed and was not asked again. */
  | { readonly form: "stopped"; readonly iterationId: string; readonly requestMessageId: string };

/** One thing that might be worth asking for, as the host found it. */
export interface TriageCandidate {
  /** Stable across readings: `issue:OWNER/NAME#N` or `stopped:<request id>`. */
  readonly key: string;
  readonly source: TriageSource;
  /** Its title, or the request's first line. */
  readonly title: string;
  /** The forge's labels, which are the person's way of stating priority (section 1 rule 7). */
  readonly labels: readonly string[];
}

/** What one reading ranks, in one repository. */
export interface TriageMaterial {
  readonly repository: string;
  readonly goalId: string;
  readonly clauses: readonly GoalClause[];
  /** In the order they were found: issues, then stopped work. */
  readonly candidates: readonly TriageCandidate[];
  /** Candidate keys a person put aside with *not now*: withheld, and not handed to the model. */
  readonly putAside: readonly string[];
}

/** One open point and its recommendation, answerable as recommended (section 1 rule 5). */
export interface OpenPoint {
  readonly point: string;
  readonly recommendation: string;
}

/** What the model said about one candidate. */
export interface Judged {
  readonly key: string;
  /** The 1-based clause it goes against, or null when it goes against none. */
  readonly clause: number | null;
  readonly request: string;
  readonly why: string;
  readonly openPoints: readonly OpenPoint[];
}

/** One ranked candidate: the first of a payload is the recommendation. */
export interface Ranked extends Judged {
  readonly clause: number;
  readonly source: TriageSource;
  readonly title: string;
  readonly labels: readonly string[];
}

/** Why a candidate is not shown (D-0064 O8). */
export type WithheldWhy = "no_clause" | "put_aside" | "not_judged" | "below";

export interface TriagePayload {
  readonly repository: string;
  readonly goalId: string;
  /** The recommendation first, then up to {@link RUNNERS_UP} runners-up (point 4.3). */
  readonly ranked: readonly Ranked[];
  readonly withheld: readonly { readonly key: string; readonly why: WithheldWhy }[];
  /** What was read, for the line that tells a quiet triage from one that is not running. */
  readonly read: { readonly issues: number; readonly stopped: number };
  /** Why the reading came to nothing, or null. */
  readonly unavailable: string | null;
}

/** Up to four runners-up (point 4.3). */
export const RUNNERS_UP = 4;

/** The longest request line a proposal carries: one line, as the box's first line. */
const MAX_REQUEST_CHARS = 300;
const MAX_WHY_CHARS = 800;
const MAX_OPEN_POINTS = 4;

/** The candidates handed to the model: everything found that nobody put aside. */
export function offered(material: TriageMaterial): readonly TriageCandidate[] {
  const aside = new Set(material.putAside);
  return material.candidates.filter((candidate) => !aside.has(candidate.key));
}

/**
 * The digest a reading is taken over: a proposal is rewritten when this moves
 * (point 4.1 (d)), and not on every look.
 */
export function materialDigest(material: TriageMaterial): string {
  return contentDigest(materialDocument(material));
}

/** The material as the snapshot keeps it, verbatim (D-0022 rule 4). */
export function materialDocument(material: TriageMaterial): JsonRecord {
  return {
    repository: material.repository,
    goal_id: material.goalId,
    clauses: material.clauses.map((clause) => ({ said: clause.said, unmetIf: clause.unmetIf })),
    candidates: material.candidates.map((candidate) => ({
      key: candidate.key,
      source: sourceDocument(candidate.source),
      title: candidate.title,
      labels: [...candidate.labels],
    })),
    put_aside: [...material.putAside],
  };
}

export type JudgementReading =
  | { readonly kind: "judged"; readonly judged: readonly Judged[] }
  | { readonly kind: "refused"; readonly reason: string };

/**
 * The model's answer, checked for form (D-0063 rule 2.2). The whole answer is
 * refused on the first fault: a draft that fails the check is not written, and
 * the check is structural -- it does not check the answer is true.
 */
export function readJudgement(material: TriageMaterial, answer: string): JudgementReading {
  const from = answer.indexOf("{");
  const to = answer.lastIndexOf("}");
  if (from < 0 || to < from) {
    return { kind: "refused", reason: "the answer holds no JSON object" };
  }
  let document: unknown;
  try {
    document = JSON.parse(answer.slice(from, to + 1));
  } catch {
    return { kind: "refused", reason: "the answer's JSON does not parse" };
  }
  const list = isRecord(document) ? document["candidates"] : undefined;
  if (!Array.isArray(list)) {
    return { kind: "refused", reason: "the answer has no 'candidates' list" };
  }
  const keys = new Set(offered(material).map((candidate) => candidate.key));
  const seen = new Set<string>();
  const judged: Judged[] = [];
  for (const one of list) {
    if (!isRecord(one)) {
      return { kind: "refused", reason: "a candidate is not an object" };
    }
    const key = one["key"];
    if (typeof key !== "string" || !keys.has(key)) {
      return {
        kind: "refused",
        reason: `the answer names a candidate it was not given: ${text(key)}`,
      };
    }
    if (seen.has(key)) {
      return { kind: "refused", reason: `the answer judges ${key} twice` };
    }
    seen.add(key);
    const clause = one["clause"];
    if (
      clause !== null &&
      !(
        Number.isSafeInteger(clause) &&
        Number(clause) >= 1 &&
        Number(clause) <= material.clauses.length
      )
    ) {
      return {
        kind: "refused",
        reason: `${key} names a clause the goal does not have: ${text(clause)}`,
      };
    }
    const request = one["request"];
    const why = one["why"];
    if (clause !== null) {
      if (typeof request !== "string" || request.trim() === "" || /[\r\n]/.test(request)) {
        return { kind: "refused", reason: `${key} has no one-line request` };
      }
      if (request.length > MAX_REQUEST_CHARS) {
        return { kind: "refused", reason: `${key}'s request is longer than one line` };
      }
      if (typeof why !== "string" || why.trim() === "" || why.length > MAX_WHY_CHARS) {
        return { kind: "refused", reason: `${key} says no why, or too much of one` };
      }
    }
    const points = one["openPoints"] ?? [];
    if (!Array.isArray(points) || points.length > MAX_OPEN_POINTS) {
      return { kind: "refused", reason: `${key}'s open points are not a short list` };
    }
    const openPoints: OpenPoint[] = [];
    for (const point of points) {
      if (
        !isRecord(point) ||
        typeof point["point"] !== "string" ||
        point["point"].trim() === "" ||
        typeof point["recommendation"] !== "string" ||
        point["recommendation"].trim() === ""
      ) {
        // Section 1 rule 5: an open point without its recommendation is not
        // answerable in one word, and the proposal would still be a draft.
        return { kind: "refused", reason: `${key} has an open point without a recommendation` };
      }
      openPoints.push({
        point: point["point"].trim(),
        recommendation: point["recommendation"].trim(),
      });
    }
    judged.push({
      key,
      clause: clause === null ? null : Number(clause),
      request: typeof request === "string" ? request.trim() : "",
      why: typeof why === "string" ? why.trim() : "",
      openPoints,
    });
  }
  return { kind: "judged", judged };
}

/**
 * The priority an explicit label states (section 1 rule 7): lower ranks
 * first. `priority:critical` / `P0`, then `priority:high` / `P1`, then no label
 * or a middle one, then `priority:low` / `P3`.
 */
export function labelRank(labels: readonly string[]): number {
  // Only a label that states a priority counts: a `bug` beside `priority:low`
  // must not lift it back to the unlabelled middle.
  const stated = labels.flatMap((label) => {
    const said = label.trim().toLowerCase();
    const named = /^priority[\s:/_-]*(critical|urgent|high|medium|normal|low)$/.exec(said)?.[1];
    const numbered = /^p([0-3])$/.exec(said)?.[1];
    if (named === undefined && numbered === undefined) {
      return [];
    }
    return [
      named === "critical" || named === "urgent" || numbered === "0"
        ? 0
        : named === "high" || numbered === "1"
          ? 1
          : named === "low" || numbered === "3"
            ? 3
            : 2,
    ];
  });
  return stated.length === 0 ? 2 : Math.min(...stated);
}

/** Rank a checked judgement into the payload the page draws (point 2.3 (a)). */
export function rankTriage(material: TriageMaterial, judged: readonly Judged[]): TriagePayload {
  const found = new Map(
    material.candidates.map((candidate, at) => [candidate.key, { candidate, at }]),
  );
  const byKey = new Map(judged.map((one) => [one.key, one]));
  const withheld: { key: string; why: WithheldWhy }[] = [];
  const against: { ranked: Ranked; at: number }[] = [];
  const aside = new Set(material.putAside);
  for (const [at, candidate] of material.candidates.entries()) {
    if (aside.has(candidate.key)) {
      withheld.push({ key: candidate.key, why: "put_aside" });
      continue;
    }
    const one = byKey.get(candidate.key);
    if (one === undefined) {
      withheld.push({ key: candidate.key, why: "not_judged" });
    } else if (one.clause === null) {
      withheld.push({ key: candidate.key, why: "no_clause" });
    } else {
      against.push({
        ranked: {
          ...one,
          clause: one.clause,
          source: candidate.source,
          title: candidate.title,
          labels: candidate.labels,
        },
        at,
      });
    }
  }
  const order = against.toSorted(
    (left, right) =>
      left.ranked.clause - right.ranked.clause ||
      labelRank(left.ranked.labels) - labelRank(right.ranked.labels) ||
      left.at - right.at,
  );
  const shown = order.slice(0, 1 + RUNNERS_UP).map((one) => one.ranked);
  for (const one of order.slice(1 + RUNNERS_UP)) {
    withheld.push({ key: one.ranked.key, why: "below" });
  }
  // Found order for the withheld list too, so two readings of the same
  // material list it the same way.
  withheld.sort((left, right) => (found.get(left.key)?.at ?? 0) - (found.get(right.key)?.at ?? 0));
  return { ...header(material), ranked: shown, withheld, unavailable: null };
}

/** A reading that came to nothing, said with rondo's reason (D-0071 rule 1.5's shape). */
export function unavailableTriage(material: TriageMaterial, reason: string): TriagePayload {
  return { ...header(material), ranked: [], withheld: [], unavailable: reason };
}

function header(material: TriageMaterial) {
  return {
    repository: material.repository,
    goalId: material.goalId,
    read: {
      issues: material.candidates.filter((candidate) => candidate.source.form === "issue").length,
      stopped: material.candidates.filter((candidate) => candidate.source.form === "stopped")
        .length,
    },
  };
}

/** A payload as the proposal row holds it. */
export function triagePayloadDocument(payload: TriagePayload): JsonRecord {
  return {
    repository: payload.repository,
    goal_id: payload.goalId,
    ranked: payload.ranked.map((one) => ({
      key: one.key,
      clause: one.clause,
      request: one.request,
      why: one.why,
      open_points: one.openPoints.map((point) => ({
        point: point.point,
        recommendation: point.recommendation,
      })),
      source: sourceDocument(one.source),
      title: one.title,
      labels: [...one.labels],
    })),
    withheld: payload.withheld.map((one) => ({ key: one.key, why: one.why })),
    read: { issues: payload.read.issues, stopped: payload.read.stopped },
    unavailable: payload.unavailable,
  };
}

/**
 * A stored payload read back for the page, or null when it is not one this
 * rondo wrote: a row that will not read is not drawn, rather than drawn half.
 */
export function readTriagePayload(document: JsonRecord): TriagePayload | null {
  const ranked = document["ranked"];
  const withheld = document["withheld"];
  const read = document["read"];
  if (
    typeof document["repository"] !== "string" ||
    typeof document["goal_id"] !== "string" ||
    !Array.isArray(ranked) ||
    !Array.isArray(withheld) ||
    !isRecord(read) ||
    (document["unavailable"] !== null && typeof document["unavailable"] !== "string")
  ) {
    return null;
  }
  const readRanked: Ranked[] = [];
  for (const one of ranked) {
    if (!isRecord(one)) {
      return null;
    }
    const source = readSource(one["source"]);
    const points = one["open_points"];
    if (
      source === null ||
      typeof one["key"] !== "string" ||
      typeof one["clause"] !== "number" ||
      typeof one["request"] !== "string" ||
      typeof one["why"] !== "string" ||
      typeof one["title"] !== "string" ||
      !Array.isArray(one["labels"]) ||
      !Array.isArray(points)
    ) {
      return null;
    }
    readRanked.push({
      key: one["key"],
      clause: one["clause"],
      request: one["request"],
      why: one["why"],
      title: one["title"],
      labels: one["labels"].filter((label): label is string => typeof label === "string"),
      source,
      openPoints: points.flatMap((point) =>
        isRecord(point) &&
        typeof point["point"] === "string" &&
        typeof point["recommendation"] === "string"
          ? [{ point: point["point"], recommendation: point["recommendation"] }]
          : [],
      ),
    });
  }
  return {
    repository: document["repository"],
    goalId: document["goal_id"],
    ranked: readRanked,
    withheld: withheld.flatMap((one) =>
      isRecord(one) && typeof one["key"] === "string" && typeof one["why"] === "string"
        ? [{ key: one["key"], why: one["why"] as WithheldWhy }]
        : [],
    ),
    read: { issues: Number(read["issues"] ?? 0), stopped: Number(read["stopped"] ?? 0) },
    unavailable: (document["unavailable"] as string | null) ?? null,
  };
}

function sourceDocument(source: TriageSource): JsonRecord {
  return source.form === "issue"
    ? { form: "issue", repository: source.repository, number: source.number }
    : {
        form: "stopped",
        iteration_id: source.iterationId,
        request_message_id: source.requestMessageId,
      };
}

function readSource(value: JsonValue | undefined): TriageSource | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    value["form"] === "issue" &&
    typeof value["repository"] === "string" &&
    typeof value["number"] === "number"
  ) {
    return { form: "issue", repository: value["repository"], number: value["number"] };
  }
  if (
    value["form"] === "stopped" &&
    typeof value["iteration_id"] === "string" &&
    typeof value["request_message_id"] === "string"
  ) {
    return {
      form: "stopped",
      iterationId: value["iteration_id"],
      requestMessageId: value["request_message_id"],
    };
  }
  return null;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value : (JSON.stringify(value) ?? String(value));
}
