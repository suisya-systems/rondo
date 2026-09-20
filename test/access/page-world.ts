/**
 * A world the page's suites are built over: a store, a lap at its gate, the
 * ports the renderer is handed, and the revise drafter (DECISIONS.md D-0077).
 *
 * **Its own module since the page's rebuild.** `src/access/revise-drafter.ts`'s
 * coverage used to live inside `test/access/web.test.ts`, so replacing the view
 * layer would have deleted the cases that say the drafter writes one row per
 * reading, keeps a draft across a store fault, and discards a draft a newer
 * reading made stale. None of those is about markup. The fixtures live here so
 * both suites can hold them, which is what `planted-lap.ts` already does for a
 * lap.
 *
 * The one case that both drafts and then reads the drawn page -- an
 * unavailable run, whose reason the gate shows -- stays with the renderer,
 * because what it is asserting is markup.
 */
import { DatabaseSync } from "node:sqlite";
import { expect } from "vitest";
import { reviseDrafterHost } from "../../src/access/revise-drafter.js";
import { type PublishReading, operatorPage as renderPage } from "../../src/access/web.js";
import { AnswerPort, type ServedPorts } from "../../src/access/web-app.js";
import { allocate } from "../../src/refrain/allocator.js";
import { admittedPlan, planPayload, type RunPlan, runPlan } from "../../src/refrain/plan.js";
import type { JsonRecord } from "../../src/store/records.js";
import { advisoryRecord, iterationStore } from "../../src/store/sqlite.js";
import { ownLane } from "../lane-claims.js";

export const fresh = () => {
  const connection = new DatabaseSync(":memory:");
  return {
    connection,
    store: iterationStore(connection, { maxOccupying: 4, maxLive: 6 }),
    record: advisoryRecord(connection),
  };
};

/** Put one reserved row at the gate, which is the only state with a button. */
export async function openGate(world: ReturnType<typeof fresh>, id: string): Promise<void> {
  for (const [from, to] of [
    ["planned", "admitting"],
    ["admitting", "admitted"],
    ["admitted", "performing"],
    ["performing", "awaiting_human"],
  ] as const) {
    const outcome = await world.store.transition(
      id,
      from,
      to,
      to === "awaiting_human" ? { gateId: `gate-${id}` } : {},
      2_000,
    );
    if (outcome.kind !== "transitioned") {
      throw new Error(`the fixture did not reach '${to}': ${JSON.stringify(outcome)}`);
    }
  }
}

export async function reserve(
  world: ReturnType<typeof fresh>,
  id: string,
  request: string,
  materialLanguage: string | null = null,
): Promise<void> {
  const outcome = await world.store.reserve({
    id,
    request,
    plan: planFor(id, materialLanguage),
    spend: null,
    scopeSpend: null,
    claim: ownLane(id),
    nowMs: 1_000,
    supersedesIterationId: null,
    requestMessageId: null,
    runId: `rondo-${id}`,
    topicBranch: `rondo/${id}`,
    workspace: `/srv/work/${id}`,
  });
  if (outcome.kind !== "reserved") {
    throw new Error(`the fixture did not reserve: ${JSON.stringify(outcome)}`);
  }
}

export const PLAN: RunPlan = {
  db: "/srv/continuo.db",
  workspaceRoot: "/srv/work",
  baseBranch: "main",
  prompt: "do the thing",
  allowedBash: ["npm run:*"],
  materialLanguage: null,
  reviewCriterion: null,
  repository: "/srv/repo",
  artifactRoot: "/srv/artifacts",
  stateRoot: "/srv/state",
  interlockRoot: "/srv/interlock",
  claudeOrgPath: "/srv/claude-org",
  endpointRecipient: "external-notify",
  endpointDestinationDir: "/srv/dropbox",
  claudeCommand: ["/usr/bin/node", "/opt/claude/cli.js"],
  endpointDb: null,
  endpointModule: null,
  node: null,
  hookScript: null,
  python: null,
  pollIntervalMs: null,
  turnTimeoutMs: 900_000,
  gitTimeoutMs: 60_000,
  identityReadbackTimeoutMs: 30_000,
  gateOptions: ["approve", "revise"],
  gateDeadlineAtMs: null,
  pullRequestBaseBranch: null,
  forgeRepository: null,
  invocationCeilingMs: 1_800_000,
  catalogLayers: [{ layer: "git_url", origin: "o", baseDir: "/srv/catalog", data: {} }],
  projectName: "rondo",
  agentTypeInput: {} as RunPlan["agentTypeInput"],
  parties: {
    grantor: "rondo",
    grantee: "unset",
  } as unknown as RunPlan["parties"],
  intendedAction: {} as RunPlan["intendedAction"],
};

export function planFor(id: string, materialLanguage: string | null = null): JsonRecord {
  const validated = runPlan({ ...PLAN, materialLanguage });
  if (validated.kind !== "planned") {
    throw new Error(`the fixture plan is not valid: ${validated.reason}`);
  }
  const allocation = allocate(id, PLAN.workspaceRoot);
  if (allocation.kind !== "allocated") {
    throw new Error(`the fixture id '${id}' does not allocate: ${allocation.reason}`);
  }
  const admitted = admittedPlan(validated.plan, allocation.allocation);
  if (admitted.kind !== "planned") {
    throw new Error(`the fixture allocation is not valid: ${admitted.reason}`);
  }
  return planPayload(admitted.plan);
}

export const EVIDENCE = {
  baseRef: "origin/main",
  baseCommit: "a".repeat(40),
  tipCommit: "b".repeat(40),
  materialDigest: "sha256:x",
  commitCount: 2,
  fileCount: 1,
};

/** A lap at its gate with the deterministic reading carried by its transition. */
export async function gateWithChecks(world: ReturnType<typeof fresh>): Promise<void> {
  await reserve(world, "i-0001", "add a retry budget");
  await openGate(world, "i-0001");
  const carried = await world.store.transition(
    "i-0001",
    "awaiting_human",
    "awaiting_human",
    { permissionDenials: '[{"tool_name":"Bash","tool_input":{"command":"rm -rf /srv"}}]' },
    3_000,
    {
      drafter: "rondo/deterministic/2",
      verdict: "concerns",
      findings: ["a binary file was not read"],
      evidence: EVIDENCE,
      unavailableReason: null,
    },
  );
  expect(carried.kind).toBe("transitioned");
}

/** The model reading the S4 tests draft from: one blocker and one major, with bases. */
export async function modelFindings(world: ReturnType<typeof fresh>): Promise<void> {
  const appended = await world.store.appendReading(
    "i-0001",
    {
      drafter: "rondo/model/1/gpt-6-astra",
      verdict: "concerns",
      findings: ["the loop never stops", "the backoff is not capped"],
      graded: [
        {
          severity: "blocker",
          bases: [{ kind: "file", path: "src/notifier.ts", line: 41 }],
          basisResolved: true,
        },
        {
          severity: "major",
          bases: [{ kind: "rule", path: "AGENTS.md", line: 12 }],
          basisResolved: true,
        },
      ],
      evidence: EVIDENCE,
      unavailableReason: null,
    },
    4_000,
  );
  expect(appended.kind).toBe("appended");
}

export let reviseIds = 0;

/**
 * One run of the revise drafter over the lap at the gate (D-0077), with the
 * model's answer given: what the resident host writes for the view to read.
 */
export async function draftRevise(
  world: ReturnType<typeof fresh>,
  answer: unknown,
  opts: {
    readonly admitted?: string | null;
    readonly during?: () => Promise<void>;
    /** Stands in for the store's write, to fail it. */
    readonly write?: (
      real: ReturnType<typeof fresh>["record"]["recordReviseDraft"],
    ) => ReturnType<typeof fresh>["record"]["recordReviseDraft"];
    /** Kicks before the host is let go: one host, several scans. */
    readonly scans?: number;
  } = {},
): Promise<string[]> {
  const documents: string[] = [];
  const admitted = opts.admitted === undefined ? "decision-1" : opts.admitted;
  const host = reviseDrafterHost({
    store: world.store,
    record: {
      ...world.record,
      scopeDecisionAdmitting: async () => admitted,
      recordReviseDraft:
        opts.write?.(world.record.recordReviseDraft.bind(world.record)) ??
        world.record.recordReviseDraft.bind(world.record),
    },
    runDrafter: async (_row, document) => {
      documents.push(document);
      await opts.during?.();
      return answer === null
        ? { kind: "failed", reason: "claude exited 1" }
        : {
            kind: "answered",
            costUsd: 0.01,
            finalMessage: typeof answer === "string" ? answer : JSON.stringify(answer),
          };
    },
    now: () => 4_500,
    // One counter across hosts: two hosts over one store mint distinct ids.
    mintId: (kind) => {
      reviseIds += 1;
      return `${kind}-${String(reviseIds)}`;
    },
    language: null,
    log: () => undefined,
  });
  for (let scan = 0; scan < (opts.scans ?? 1); scan += 1) {
    host.kick();
    await host.idle();
  }
  return documents;
}

/** The revise drafts written for a lap, as the store holds them. */
export const reviseRows = (world: ReturnType<typeof fresh>) =>
  world.connection
    .prepare(
      "SELECT drafter, payload, snapshot FROM proposal WHERE kind = 'revise_draft' ORDER BY rowid",
    )
    .all()
    .map((row) => ({
      drafter: String(row["drafter"]),
      payload: JSON.parse(String(row["payload"])) as JsonRecord,
      snapshot: JSON.parse(String(row["snapshot"])) as JsonRecord,
    }));

/** A second model reading of the lap at the gate, with one finding. */
export async function newerModelReading(
  world: ReturnType<typeof fresh>,
  finding: string,
  atMs: number,
) {
  const appended = await world.store.appendReading(
    "i-0001",
    {
      drafter: "rondo/model/1/gpt-6-astra",
      verdict: "concerns",
      findings: [finding],
      graded: [{ severity: "major", bases: [], basisResolved: false }],
      evidence: EVIDENCE,
      unavailableReason: null,
    },
    atMs,
  );
  expect(appended.kind).toBe("appended");
}

/** A draft that addresses both of {@link modelFindings}' findings, with a lead. */
export const REVISE_ANSWER = {
  lead: "Keep the retry budget, but make it end.",
  findings: [
    { finding: 2, change: "Cap the backoff at 30 seconds." },
    { finding: 1, change: "Stop after the budget's last try.\nSay so in the log." },
  ],
};

/**
 * The page as a person's browser reads its text.
 *
 * **One spelling normalised, and only one.** `hono/jsx` escapes `'` as `&#39;`
 * where the hand-written renderer left it alone (D-0059 rule 2), which is the
 * same character to every browser. The catalogue's sentences quote tokens in
 * `'...'`, so the content assertions below are made against the character and
 * not against which of two correct spellings the escaper chose. Every other
 * escape -- `&lt;`, `&quot;`, `&amp;` -- is still asserted as written.
 */
export const operatorPage = async (...args: Parameters<typeof renderPage>): Promise<string> =>
  (await renderPage(...args)).replaceAll("&#39;", "'");

/** Material that is only its text: no gate question read and no range named. */
export const asText = (...lines: string[]) => ({ lines, why: null, work: null });

/** Every press this surface let through, in order. */
export type Pressed = { iterationId: string; body: string }[];

export function portsOver(
  world: ReturnType<typeof fresh>,
  actorId: string | null = "ada",
  pressed: Pressed | null = null,
  // **The host's statement as a tag, and one step of five** (D-0056 rule 3).
  // The set a page is rendered in is the fourth argument to `operatorPage`
  // rather than a member of the ports, because five steps decide it per
  // request; `null` is a host that said nothing.
  hostLanguage: string | null = null,
  // **The approval the lap at the gate was admitted under** (rondo#233 S4), or
  // null for a lap admitted under none -- which is the real reader's answer for
  // every row these tests reserve, and the state the gate says *no change from
  // here* in. The row itself is `test/store/scope-record.test.ts`'s.
  scopeDecision: string | null = null,
  // **The dry-run the publish screen is drawn from** (rondo#233 S5), or null
  // for a host that named no forge repository -- which is every other test
  // here, and the state the summary draws no publish link in.
  publishing: PublishReading | null = null,
): ServedPorts {
  return {
    store: world.store,
    record:
      scopeDecision === null
        ? world.record
        : { ...world.record, scopeDecisionAdmitting: async () => scopeDecision },
    hostLanguage,
    now: () => 5_000,
    // The page draws `inbox`'s lines, so it carries `inbox`'s one outward
    // port; nothing in these tests runs a lap, so it is never asked (D-0048
    // rule 6 asks only of `performing` rows).
    locateTranscript: async () => ({
      kind: "unknown",
      reason: "no continuo in this test",
    }),
    // Asked only on the log screen, and only after `locateTranscript` named a
    // directory -- which it never does here unless a test says so.
    readLog: () => ({ kind: "unread", reason: "no transcript in this test" }),
    policy: { maxOccupying: 4, maxLive: 6 },
    actorId,
    material:
      pressed === null ? null : async (_wording, record) => asText(`work    rondo/${record.id}`),
    answer:
      pressed === null
        ? null
        : new AnswerPort(async (iterationId, body) => {
            pressed.push({ iterationId, body });
            return await Promise.resolve({ ok: true, note: "answered" });
          }),
    // The thread's sends are `test/access/web-app.test.ts`'s door; this page
    // test draws no send form.
    say: null,
    // The scope screen's own door is `test/access/web-app.test.ts`'s too.
    scope: null,
    // The revise press's own door is `test/access/web-app.test.ts`'s, as the
    // approve press's is; what this file tests is the form the page draws for
    // it (rondo#233 S4). The publish press is the same split (rondo#233 S5):
    // the door is that file's, the screen is this one's.
    revise: null,
    publish: null,
    release: null,
    releasable: actorId !== null,
    publishing,
  };
}

export const structured = async () =>
  await Promise.resolve({
    lines: ["work    rondo/i-0001", "fence   the whole text"],
    why: "I could not run the suite.",
    work: {
      kind: "read" as const,
      baseRef: "origin/main",
      baseCommit: "a".repeat(40),
      tipCommit: "b".repeat(40),
      commits: [{ abbreviatedSha: "3f2a1c9", subject: "feat: retry budget" }],
      files: [{ path: "src/notifier.ts", added: 64, deleted: 12 }],
      uncommitted: [],
      checkedOut: "rondo/i-0001",
    },
  });
