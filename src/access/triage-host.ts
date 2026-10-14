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
 * What it reads, of point 1 (b)'s list: the repository's open issues, a
 * request whose latest try stopped or failed and was not asked again, a
 * request no lap was ever started for whose thread has gone quiet, and the
 * accepted decision entries whose residuals are still open (rondo#658). What
 * rondo decided without asking is not read yet (rondo#658 names it).
 */
import {
  type Judged,
  materialDigest,
  materialDocument,
  mixesScripts,
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
import { asksForWork, type IterationRecord, type JsonRecord } from "../store/records.js";
import type { AdvisoryRecord, IterationStore } from "../store/sqlite.js";
import { type CommandOutcome, queryFailure, runCommand, type runDrafter } from "./forge.js";
import { hostFailure } from "./host-failure.js";
import { workRepository } from "./issue-read.js";

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

/**
 * How long a request's thread stays quiet, with no lap ever started for it,
 * before triage reads it as left (rondo#658): a request still being drafted,
 * or answered today, is not left.
 *
 * ponytail: a fixed day; a reading of what the thread waits on (a draft owed,
 * an approved part waiting for its predecessor) if a day is felt as wrong.
 */
const UNLAPPED_QUIET_MS = 24 * 60 * 60 * 1000;

/** What the host reaches, as values a test can replace. */
export interface TriageHostPorts {
  readonly store: Pick<IterationStore, "terminalIterations" | "readLive">;
  readonly record: Pick<
    AdvisoryRecord,
    "threadMessages" | "goals" | "triageDeclines" | "latestTriage" | "recordProposal"
  > &
    Partial<Pick<AdvisoryRecord, "standingPolicies">>;
  /** The repositories rondo works in, `OWNER/NAME` (`D-0081`). */
  readonly repositories: () => Promise<readonly string[]>;
  readonly listIssues: (request: {
    readonly host: string | null;
    readonly repo: string;
  }) => Promise<CommandOutcome>;
  /** Each repository's decision record path, where a setup plan names one (D-0098 rule 3). */
  readonly decisionRecords?: () => Promise<ReadonlyMap<string, string>>;
  readonly readDecisionRecord?: (request: {
    readonly host: string | null;
    readonly repo: string;
    readonly path: string;
  }) => Promise<DecisionRecordRead>;
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
  const own = await ownRecord(ports, repositories);
  const records = (await ports.decisionRecords?.()) ?? new Map<string, string>();
  // D-0193 rule 2: whole, by id, so a point can be raised against one.
  const policies = ((await ports.record.standingPolicies?.()) ?? []).map((policy) => ({
    id: policy.policyId,
    body: policy.body,
  }));
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
      // The record is read on the issues' clock: a failed read is not "no
      // residuals", which would re-rank over the rest.
      const path = records.get(repository);
      const record =
        path === undefined || ports.readDecisionRecord === undefined
          ? ({ kind: "none" } as const)
          : await ports.readDecisionRecord({ host: ports.forgeHost, repo: repository, path });
      if (record.kind === "undetermined") {
        ports.log(
          `triage   ${repository}: the decision record could not be read (${record.reason}); ` +
            "read again on the next scan",
        );
        continue;
      }
      issues = {
        atMs: nowMs,
        issues: [
          ...parsed,
          ...(record.kind === "read" && path !== undefined
            ? decisionResiduals(repository, path, record.commit, record.text)
            : []),
        ],
      };
      listed.set(repository, issues);
    }
    const material: TriageMaterial = {
      repository,
      goalId: goal.goalId,
      clauses: goal.clauses,
      candidates: [
        ...issues.issues.filter((one) => one.source.form === "issue"),
        ...(own.stopped.get(repository) ?? []),
        ...(own.unlapped.get(repository) ?? []),
        ...issues.issues.filter((one) => one.source.form === "residual"),
      ],
      putAside: [
        ...new Set(
          declines.filter((one) => one.repository === repository).map((one) => one.candidate),
        ),
      ],
      policies,
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
      if (judged.kind === "judged") {
        const mended = await mendScripts(ports, row, material, judged.judged);
        costUsd = mended.costUsd === null ? costUsd : (costUsd ?? 0) + mended.costUsd;
        payload = rankTriage(material, mended.judged);
      } else {
        payload = unavailableTriage(material, judged.reason);
      }
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
 * **A candidate whose words mix in another script is read once more**
 * (rondo#492): Cyrillic in a Japanese reading is the model's slip, and the
 * request line is what the flow sends. Only those candidates are read again;
 * one the second reading does not mend keeps its first words and is marked,
 * so the page says so rather than drawing it as sound.
 */
async function mendScripts(
  ports: TriageHostPorts,
  row: ReturnType<typeof drafterRow>,
  material: TriageMaterial,
  judged: readonly Judged[],
): Promise<{ readonly judged: readonly Judged[]; readonly costUsd: number | null }> {
  const mixed = new Set(
    judged.filter((one) => mixesScripts(one, ports.language)).map((one) => one.key),
  );
  if (mixed.size === 0) {
    return { judged, costUsd: null };
  }
  const again: TriageMaterial = {
    ...material,
    candidates: material.candidates.filter((one) => mixed.has(one.key)),
  };
  const run = await ports.runDrafter(row, triageDocument(again, ports.language));
  const reread = run.kind === "failed" ? null : readJudgement(again, run.finalMessage);
  const mended = new Map(
    reread?.kind === "judged"
      ? reread.judged
          .filter((one) => one.clause !== null && !mixesScripts(one, ports.language))
          .map((one) => [one.key, one])
      : [],
  );
  ports.log(
    `triage   ${material.repository}: ${String(mixed.size)} candidate(s) mixed scripts; ` +
      `${String(mended.size)} mended on a second reading`,
  );
  return {
    judged: judged.map((one) =>
      mixed.has(one.key) ? (mended.get(one.key) ?? { ...one, mixedScript: true }) : one,
    ),
    costUsd: run.kind === "failed" ? null : run.costUsd,
  };
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

/** How long one read of the record may take; nothing waits on it. */
const RECORD_READ_TIMEOUT_MS = 60_000;

/** What {@link readDecisionRecord} found on the forge's default branch. */
export type DecisionRecordRead =
  | { readonly kind: "read"; readonly commit: string; readonly text: string }
  /** No commit on the default branch has touched the path: nothing recorded yet. */
  | { readonly kind: "none" }
  | { readonly kind: "undetermined"; readonly reason: string };

/**
 * One repository's decision record for triage (rondo#658): the last commit on
 * the default branch that touched it, and the file at that commit. The commit
 * is the one a locator names (D-0032 rule 2), and it moves only when the record
 * does, so a merge elsewhere does not re-rank. A read through the operator's
 * own `gh`, as `listOpenIssues` is.
 */
export async function readDecisionRecord(request: {
  readonly host: string | null;
  readonly repo: string;
  readonly path: string;
}): Promise<DecisionRecordRead> {
  const host = request.host === null ? [] : ["--hostname", request.host];
  const last = await runCommand(
    "gh",
    [
      "api",
      ...host,
      `repos/${request.repo}/commits?path=${encodeURIComponent(request.path)}&per_page=1`,
      "--jq",
      ".[0].sha // empty",
    ],
    RECORD_READ_TIMEOUT_MS,
  );
  const lastFailure = queryFailure(last);
  if (lastFailure !== null) {
    return { kind: "undetermined", reason: lastFailure };
  }
  const commit = last.stdout.trim();
  if (commit === "") {
    return { kind: "none" };
  }
  const file = await runCommand(
    "gh",
    [
      "api",
      ...host,
      "-H",
      "Accept: application/vnd.github.raw+json",
      `repos/${request.repo}/contents/${request.path.split("/").map(encodeURIComponent).join("/")}?ref=${commit}`,
    ],
    RECORD_READ_TIMEOUT_MS,
  );
  const fileFailure = queryFailure(file);
  return fileFailure === null
    ? { kind: "read", commit, text: file.stdout }
    : { kind: "undetermined", reason: fileFailure };
}

/**
 * The accepted entries of a decision record whose residual tables still hold
 * open rows, one candidate per entry (rondo#658; the owner's option (a)): a
 * table row under a `### Residuals` heading, past its header and separator,
 * is open unless it says **answered**, as rondo#703 marked one. A superseded
 * entry is not read, nor a residual written as a list rather than a table.
 *
 * Its basis is the record at `commit`, from the first open row to the last
 * (D-0032 rule 2); its title is the entry and each open row's first cell, so
 * an edited row moves the digest.
 */
export function decisionResiduals(
  repository: string,
  path: string,
  commit: string,
  text: string,
): TriageCandidate[] {
  const found: TriageCandidate[] = [];
  let entry: { id: string; accepted: boolean | null; rows: { at: number; cell: string }[] } | null =
    null;
  let inResiduals = false;
  let tableRow = 0;
  const close = () => {
    const rows = entry?.accepted === true ? entry.rows : [];
    const first = rows[0];
    const last = rows.at(-1);
    if (entry !== null && first !== undefined && last !== undefined) {
      found.push({
        key: `residual:${entry.id}`,
        source: {
          form: "residual",
          repository,
          path,
          commit,
          entry: entry.id,
          lines: { start: first.at, end: last.at },
        },
        title: `${entry.id} residuals: ${rows.map((row) => row.cell).join("; ")}`,
        labels: [],
      });
    }
  };
  text.split("\n").forEach((line, at) => {
    const heading = /^## (D-\d+)\b/.exec(line);
    if (heading !== null || line.startsWith("## ")) {
      close();
      entry = heading === null ? null : { id: heading[1] ?? "", accepted: null, rows: [] };
      inResiduals = false;
      return;
    }
    if (entry === null) {
      return;
    }
    if (entry.accepted === null && line.startsWith("**Status:**")) {
      entry.accepted = /^\*\*Status:\*\*\s*accepted\b/.test(line);
    }
    if (line.startsWith("### ")) {
      inResiduals = /^### Residuals\b/.test(line);
      tableRow = 0;
      return;
    }
    if (!inResiduals || !line.startsWith("|")) {
      tableRow = 0;
      return;
    }
    tableRow += 1;
    // The first two lines of a table are its header and separator.
    if (tableRow > 2 && !line.includes("**answered**")) {
      entry.rows.push({ at: at + 1, cell: line.split("|")[1]?.trim() ?? "" });
    }
  });
  close();
  return found;
}

/**
 * What triage reads of rondo's own record, by repository (point 1 (b)):
 *
 * - `stopped`: requests whose latest try stopped or failed, and which nobody
 *   asked again ("laps that stopped or failed and were not asked again"). A
 *   request with a try still going is not stopped.
 * - `unlapped`: requests no lap was ever started for, whose thread has been
 *   quiet for {@link UNLAPPED_QUIET_MS} and which a person did not stop
 *   ("requests left unfinished", rondo#658).
 *
 * A thread that will not read throws: reading it as empty would drop every
 * request from the material and re-rank over what is left.
 */
async function ownRecord(
  ports: TriageHostPorts,
  repositories: readonly string[],
): Promise<{
  readonly stopped: ReadonlyMap<string, TriageCandidate[]>;
  readonly unlapped: ReadonlyMap<string, TriageCandidate[]>;
}> {
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
  if (thread.kind !== "read") {
    throw new Error(`the thread will not read: ${thread.reason}`);
  }
  const bodies = new Map(thread.messages.map((message) => [message.messageId, message.body]));
  const add = (found: Map<string, TriageCandidate[]>, repository: string, one: TriageCandidate) => {
    found.set(repository, [...(found.get(repository) ?? []), one]);
  };
  const only = repositories.length === 1 ? (repositories[0] ?? null) : null;

  const stopped = new Map<string, TriageCandidate[]>();
  for (const [request, row] of latestOf) {
    if (live.has(request) || (row.status !== "failed" && row.status !== "abandoned")) {
      continue;
    }
    const named = row.plan["forge_repository"];
    const repository = typeof named === "string" && named !== "" ? named : only;
    if (repository === null) {
      continue;
    }
    add(stopped, repository, {
      key: `stopped:${request}`,
      source: { form: "stopped", iterationId: row.id, requestMessageId: request },
      title: (bodies.get(request) ?? row.request).split("\n")[0]?.trim() ?? "",
      labels: [],
    });
  }

  // Every message under its request's opener, so a thread's newest message
  // and its words are read once.
  const parent = new Map(thread.messages.map((m) => [m.messageId, m.inReplyTo]));
  const rootOf = (id: string): string => {
    let at = id;
    for (let hops = 0; hops < thread.messages.length; hops += 1) {
      const up = parent.get(at);
      if (up === undefined || up === null) {
        return at;
      }
      at = up;
    }
    return at;
  };
  const threads = new Map<string, (typeof thread.messages)[number][]>();
  for (const message of thread.messages) {
    const root = rootOf(message.messageId);
    threads.set(root, [...(threads.get(root) ?? []), message]);
  }
  const unlapped = new Map<string, TriageCandidate[]>();
  const nowMs = ports.now();
  for (const [root, messages] of threads) {
    const opener = messages.find((m) => m.messageId === root);
    // A stop holds until the person asks for the work again after it, as the
    // drafter reads a thread (`stopsDrafterAsk`).
    const stoppedAtMs = Math.max(
      ...messages.filter((m) => m.answerOutcome === "stop").map((m) => m.atMs),
    );
    if (
      opener === undefined ||
      opener.inReplyTo !== null ||
      !asksForWork(opener) ||
      live.has(root) ||
      latestOf.has(root) ||
      !messages.some((m) => m.atMs > stoppedAtMs && m.answerOutcome !== "stop" && asksForWork(m)) ||
      nowMs - Math.max(...messages.map((m) => m.atMs)) < UNLAPPED_QUIET_MS
    ) {
      continue;
    }
    // Where the person's words put the work, as the drafter reads it (D-0090);
    // a request that names none is the only repository's, or nobody's.
    const work = workRepository(
      messages.filter((m) => asksForWork(m)).map((m) => m.body),
      repositories,
    );
    const repository =
      work.kind === "held"
        ? work.repos.length === 1
          ? (work.repos[0] ?? null)
          : null
        : work.kind === "open"
          ? only
          : null;
    if (repository === null) {
      continue;
    }
    add(unlapped, repository, {
      key: `unlapped:${root}`,
      source: { form: "unlapped", requestMessageId: root },
      title: opener.body.split("\n")[0]?.trim() ?? "",
      labels: [],
    });
  }
  return { stopped, unlapped };
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
    "- openPoints: at most four decisions to be made before the work can start, each with your",
    "  recommendation. Empty if none. Write the recommendation as the decision itself",
    "  ('Keep it as an open question'), not as advice ('I recommend keeping it open').",
    "  Give each point a raise saying whether the person must decide it:",
    '  - "dispute": the options give up different things the person owns: what a user sees,',
    "    a decision already recorded, a permission granted, or a cost past the budget;",
    '  - "irreversible": choosing it commits to an act rondo cannot undo: merging into the default',
    "    branch, a release or package, deleting what rondo did not create, sending anything to",
    "    anyone but the person and the pull request, or spending past the budget;",
    '  - "policy": the options differ in whether they go against one of the person\'s standing',
    '    policies below; name it in "policy" by its id;',
    "  - null: none of these. The options differ only in how the work gets done; rondo decides it",
    "    as you recommend and writes it down where the person can change it. Most points are null.",
    language === null
      ? ""
      : `Write request, why and openPoints in the language tagged ${language}, in its own script; ` +
        "names and code may stay in Latin letters. No word of another language.",
    "",
    "Goal:",
    clauses,
    "",
    ...((material.policies ?? []).length === 0
      ? []
      : [
          "The person's standing policies:",
          ...(material.policies ?? []).map((policy) => `- ${policy.id}: ${policy.body}`),
          "",
        ]),
    "Candidates:",
    candidates,
    material.putAside.length === 0
      ? ""
      : `\nThe person put these aside with "not now", which says something about the goal: ${material.putAside.join(", ")}`,
    "",
    "Answer with one JSON object and nothing else:",
    '{"candidates":[{"key":"...","clause":1,"request":"...","why":"...","openPoints":[{"point":"...","recommendation":"...","raise":null}]}]}',
  ].join("\n");
}
