/**
 * When rondo reads what it would ask for next, and what a reading writes
 * (DECISIONS.md D-0097), in the resident host beside the drafter.
 *
 * **One stored proposal per repository, rewritten when its material moves**
 * (point 4.1 (d)): a repository with a goal is read when the digest of what it
 * would rank -- the goal, the open issues, the stopped work and what was put
 * aside -- differs from the one its latest `triage` row was ranked over. So a
 * rescan that finds nothing new spends nothing, and a page load never reads
 * anything (the page's reads write nothing).
 *
 * **Before a goal exists nothing is read** (point 2.4 (a)): the page offers a
 * drafted goal instead, and there is nothing to rank against.
 *
 * **It writes nothing outside rondo** (point 6 (a)): the forge is read through
 * the operator's `gh`, and the one write is a proposal row in rondo's store.
 *
 * What it reads, of point 1 (b)'s list: the repository's open issues and a
 * request whose latest try stopped or failed and was not asked again. The
 * residuals of rondo's decisions, requests left without a lap and what rondo
 * decided without asking are not read yet (the PR that built this names them).
 */
import {
  type Judged,
  materialDigest,
  materialDocument,
  offered,
  rankTriage,
  readJudgement,
  type TriageCandidate,
  type TriageMaterial,
  type TriagePayload,
  triagePayloadDocument,
  unavailableTriage,
} from "../advisory/triage.js";
import { drafterRow } from "../continuo/roles.js";
import type { IterationRecord, JsonRecord } from "../store/records.js";
import type { AdvisoryRecord, IterationStore } from "../store/sqlite.js";
import type { CommandOutcome, runDrafter } from "./forge.js";
import { hostFailure } from "./host-failure.js";

/** The name its rows are written under: never the split drafter's prefix, so it covers no message. */
export const TRIAGE_DRAFTER_PREFIX = "rondo/triage/1/";

/**
 * How long one listing of a repository's issues is used before it is read
 * again, unless a person's press asks for a fresh reading.
 *
 * ponytail: a fixed ten minutes; a forge webhook or an ETag read when a
 * repository's issues move faster than that and it is felt.
 */
const ISSUES_FRESH_MS = 10 * 60 * 1000;

/**
 * How long a reading that came to nothing stands before the same material is
 * read again: long enough that a drafter which keeps failing spends once an
 * hour and not once a minute.
 */
const UNAVAILABLE_RETRY_MS = 60 * 60 * 1000;

/** What the host reaches, as values a test can replace. */
export interface TriageHostPorts {
  readonly store: Pick<IterationStore, "terminalIterations" | "readLive">;
  readonly record: Pick<
    AdvisoryRecord,
    "threadMessages" | "goals" | "triageDeclines" | "latestTriage" | "recordProposal"
  >;
  /** The repositories rondo works in, `OWNER/NAME` (`D-0081`). */
  readonly repositories: () => Promise<readonly string[]>;
  readonly listIssues: (request: {
    readonly host: string | null;
    readonly repo: string;
  }) => Promise<CommandOutcome>;
  readonly runDrafter: typeof runDrafter;
  /** The forge host for `--hostname`, or null. */
  readonly forgeHost: string | null;
  readonly now: () => number;
  readonly mintId: () => string;
  /** The language the operator reads, or null. */
  readonly language: string | null;
  readonly log: (line: string) => void;
}

export interface TriageHost {
  /** Read again now; `fresh` re-lists the forge's issues too. Returns at once. */
  kick(fresh?: boolean): void;
  /** Resolves once nothing is in flight. */
  idle(): Promise<void>;
}

export function triageHost(ports: TriageHostPorts): TriageHost {
  const listed = new Map<string, { readonly atMs: number; readonly issues: TriageCandidate[] }>();
  let running: Promise<void> | null = null;
  let again = false;
  let fresh = false;

  const loop = async (): Promise<void> => {
    while (again) {
      again = false;
      const forceFresh = fresh;
      fresh = false;
      try {
        await pass(ports, listed, forceFresh);
      } catch (error) {
        ports.log(`triage   the next request could not be read: ${hostFailure(error).text}`);
      }
    }
  };
  const kick = (fresher = false): void => {
    again = true;
    fresh = fresh || fresher;
    if (running === null) {
      running = loop().finally(() => {
        running = null;
        if (again) {
          kick();
        }
      });
    }
  };
  return {
    kick,
    async idle() {
      while (running !== null) {
        await running;
      }
    },
  };
}

async function pass(
  ports: TriageHostPorts,
  listed: Map<string, { readonly atMs: number; readonly issues: TriageCandidate[] }>,
  fresh: boolean,
): Promise<void> {
  const repositories = await ports.repositories();
  const goals = new Map((await ports.record.goals()).map((goal) => [goal.repository, goal]));
  const latest = new Map((await ports.record.latestTriage()).map((row) => [row.repository, row]));
  const declines = await ports.record.triageDeclines();
  const stopped = await stoppedWork(ports, repositories);
  for (const repository of repositories) {
    const goal = goals.get(repository);
    if (goal === undefined) {
      continue;
    }
    const nowMs = ports.now();
    let issues = listed.get(repository);
    if (fresh || issues === undefined || nowMs - issues.atMs >= ISSUES_FRESH_MS) {
      const read = await ports.listIssues({ host: ports.forgeHost, repo: repository });
      const parsed = openIssues(repository, read);
      if (parsed === null) {
        ports.log(
          `triage   ${repository}: the open issues could not be read (${read.commandLine}); ` +
            "read again on the next scan",
        );
        continue;
      }
      issues = { atMs: nowMs, issues: parsed };
      listed.set(repository, issues);
    }
    const material: TriageMaterial = {
      repository,
      goalId: goal.goalId,
      clauses: goal.clauses,
      candidates: [...issues.issues, ...(stopped.get(repository) ?? [])],
      putAside: [
        ...new Set(
          declines.filter((one) => one.repository === repository).map((one) => one.candidate),
        ),
      ],
    };
    const digest = materialDigest(material);
    const last = latest.get(repository);
    // A reading that came to nothing is read again after a while, so a
    // passing failure does not silence a quiet repository for good; one that
    // ranked is kept until its material moves.
    if (
      last !== undefined &&
      last.snapshot["material_digest"] === digest &&
      ((last.payload["unavailable"] ?? null) === null ||
        nowMs - last.createdAtMs < UNAVAILABLE_RETRY_MS)
    ) {
      continue;
    }
    await read(ports, material, digest);
  }
}

/** One reading of one repository, written as one proposal row whatever it came to. */
async function read(ports: TriageHostPorts, material: TriageMaterial, digest: string) {
  const row = drafterRow();
  let payload: TriagePayload;
  let document: string | null = null;
  let costUsd: number | null = null;
  if (offered(material).length === 0) {
    // Nothing to judge: nothing is spent, and the page says what was read.
    payload = rankTriage(material, []);
  } else {
    document = triageDocument(material, ports.language);
    const run = await ports.runDrafter(row, document);
    if (run.kind === "failed") {
      payload = unavailableTriage(material, run.reason);
    } else {
      costUsd = run.costUsd;
      const judged = readJudgement(material, run.finalMessage);
      payload =
        judged.kind === "judged"
          ? rankTriage(material, judged.judged as readonly Judged[])
          : unavailableTriage(material, judged.reason);
    }
  }
  const nowMs = ports.now();
  const snapshot: JsonRecord = {
    material: materialDocument(material),
    material_digest: digest,
    document,
    cost_usd: costUsd,
    read_at_ms: nowMs,
  };
  const written = await ports.record.recordProposal({
    proposalId: ports.mintId(),
    kind: "triage",
    drafter: `${TRIAGE_DRAFTER_PREFIX}${row.model}`,
    payload: triagePayloadDocument(payload),
    snapshot,
    derivation: null,
    iterationId: null,
    supersedesIterationId: null,
    supersedesProposalId: null,
    predecessorPlanDigest: null,
    predecessorContractDigest: null,
    agentTypeDigest: null,
    configDigest: null,
    contractDigest: null,
    continuoRevision: null,
    cadenzaRevision: null,
    elevatedFromMessageId: null,
    elevatedByActorId: null,
    createdAtMs: nowMs,
  });
  ports.log(
    written.kind === "recorded"
      ? `triage   ${material.repository}: ${
          payload.unavailable === null
            ? `${String(payload.ranked.length)} candidate(s) ranked`
            : `no proposal: ${payload.unavailable}`
        }`
      : `triage   ${material.repository}: the proposal was not recorded: ${written.reason}`,
  );
}

/**
 * The open issues `gh` listed, or null when the listing failed or did not
 * read -- a failed read is not "no issues", which would propose from the rest.
 */
export function openIssues(repository: string, read: CommandOutcome): TriageCandidate[] | null {
  if (read.spawnError !== null || read.status !== 0) {
    return null;
  }
  const issues: TriageCandidate[] = [];
  for (const line of read.stdout.split("\n")) {
    if (line.trim() === "") {
      continue;
    }
    let one: unknown;
    try {
      one = JSON.parse(line);
    } catch {
      return null;
    }
    if (typeof one !== "object" || one === null) {
      return null;
    }
    const { number, title, labels } = one as Record<string, unknown>;
    if (typeof number !== "number" || typeof title !== "string") {
      return null;
    }
    issues.push({
      key: `issue:${repository}#${String(number)}`,
      source: { form: "issue", repository, number },
      title,
      labels: Array.isArray(labels)
        ? labels.filter((label): label is string => typeof label === "string")
        : [],
    });
  }
  return issues;
}

/**
 * Requests whose latest try stopped or failed, and which nobody asked again,
 * by repository (point 1 (b): "laps that stopped or failed and were not asked
 * again"). A request with a try still going is not stopped.
 */
async function stoppedWork(
  ports: TriageHostPorts,
  repositories: readonly string[],
): Promise<ReadonlyMap<string, TriageCandidate[]>> {
  const rows = (outcomes: readonly { kind: string; record?: IterationRecord }[]) =>
    outcomes.flatMap((one) =>
      one.kind === "read" && one.record !== undefined ? [one.record] : [],
    );
  const live = new Set(rows(await ports.store.readLive()).map((row) => row.requestMessageId));
  const latestOf = new Map<string, IterationRecord>();
  for (const row of rows(await ports.store.terminalIterations())) {
    const held = latestOf.get(row.requestMessageId);
    if (held === undefined || row.updatedAtMs >= held.updatedAtMs) {
      latestOf.set(row.requestMessageId, row);
    }
  }
  const thread = await ports.record.threadMessages();
  const bodies = new Map(
    thread.kind === "read"
      ? thread.messages.map((message) => [message.messageId, message.body] as const)
      : [],
  );
  const found = new Map<string, TriageCandidate[]>();
  for (const [request, row] of latestOf) {
    if (live.has(request) || (row.status !== "failed" && row.status !== "abandoned")) {
      continue;
    }
    const named = row.plan["forge_repository"];
    const repository =
      typeof named === "string" && named !== ""
        ? named
        : repositories.length === 1
          ? (repositories[0] ?? null)
          : null;
    if (repository === null) {
      continue;
    }
    const title = (bodies.get(request) ?? row.request).split("\n")[0]?.trim() ?? "";
    const list = found.get(repository) ?? [];
    list.push({
      key: `stopped:${request}`,
      source: { form: "stopped", iterationId: row.id, requestMessageId: request },
      title,
      labels: [],
    });
    found.set(repository, list);
  }
  return found;
}

/**
 * What the model is handed: the goal, the candidates and the answer's form.
 * The model is asked only which clause each goes against and to draft the
 * request; the order is computed afterwards (`rankTriage`).
 */
export function triageDocument(material: TriageMaterial, language: string | null): string {
  const clauses = material.clauses
    .map(
      (clause, at) =>
        `${String(at + 1)}. ${clause.said}${clause.unmetIf === "" ? "" : ` (unmet if: ${clause.unmetIf})`}`,
    )
    .join("\n");
  const candidates = offered(material)
    .map(
      (candidate) =>
        `- key: ${candidate.key}\n  title: ${candidate.title}` +
        (candidate.labels.length === 0 ? "" : `\n  labels: ${candidate.labels.join(", ")}`),
    )
    .join("\n");
  return [
    `You are ranking work for the repository ${material.repository} against a goal its owner wrote down.`,
    "For each candidate below, decide which numbered clause of the goal it goes against: the",
    "clause that stays unmet until this work is done. A candidate that goes against no clause gets",
    "clause null. Do not rank; do not judge effort or priority. Only name the clause.",
    "",
    "For every candidate with a clause, also write:",
    "- request: the request a person would send to rondo to do this work, in one line, naming the",
    `  repository ${material.repository}.`,
    "- why: one or two sentences on how it goes against that clause.",
    "- openPoints: at most four decisions the person would have to make before the work can start,",
    "  each with your recommendation, so that answering 'as recommended' is enough. Empty if none.",
    language === null
      ? ""
      : `Write request, why and openPoints in the language tagged ${language}.`,
    "",
    "Goal:",
    clauses,
    "",
    "Candidates:",
    candidates,
    material.putAside.length === 0
      ? ""
      : `\nThe person put these aside with "not now", which says something about the goal: ${material.putAside.join(", ")}`,
    "",
    "Answer with one JSON object and nothing else:",
    '{"candidates":[{"key":"...","clause":1,"request":"...","why":"...","openPoints":[{"point":"...","recommendation":"..."}]}]}',
  ].join("\n");
}
