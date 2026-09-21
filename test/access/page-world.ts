/**
 * A world the page's suites are built over: a store, a lap at its gate, the
 * ports the renderer is handed, and the revise drafter (DECISIONS.md D-0077).
 *
 * **Its own module since the page's rebuild.** `src/access/revise-draft/host.ts`'s
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
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { expect } from "vitest";
import type { PublishReading } from "../../src/access/page/contract.js";
import { reviseDrafterHost } from "../../src/access/revise-draft/host.js";
import { operatorPage as renderPage } from "../../src/access/web.js";
import { AnswerPort, type ServedPorts, serveOperatorPage } from "../../src/access/web-app.js";
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

/** One request, opened by a person, for a lap to belong to. */
export async function openRequest(
  world: ReturnType<typeof fresh>,
  messageId: string,
  body: string,
  atMs = 500,
): Promise<void> {
  const outcome = await world.record.recordThreadMessage({
    messageId,
    body,
    authorKind: "operator",
    authorId: "ada",
    inReplyTo: null,
    atMs,
    bases: [],
    asks: false,
  });
  if (outcome.kind !== "recorded") {
    throw new Error(`the fixture did not record the request: ${JSON.stringify(outcome)}`);
  }
}

export async function reserve(
  world: ReturnType<typeof fresh>,
  id: string,
  request: string,
  materialLanguage: string | null = null,
  /**
   * The message that opened the request this lap came from (D-0061 rule 4).
   *
   * **Left out, this helper opens one.** Every lap names a request since
   * `start` requires `--message-id`, and the page draws a lap only through
   * the thread it belongs to (D-0083 rule 2), so a fixture with no request
   * is a fixture with no page. Given, the caller has already written that
   * message and this helper leaves the conversation alone.
   */
  requestMessageId?: string,
): Promise<void> {
  if (requestMessageId === undefined) {
    requestMessageId = `req-${id}`;
    await openRequest(world, requestMessageId, request);
  }
  const outcome = await world.store.reserve({
    id,
    request,
    plan: planFor(id, materialLanguage),
    spend: null,
    scopeSpend: null,
    claim: ownLane(id),
    nowMs: 1_000,
    supersedesIterationId: null,
    requestMessageId,
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
  await openRequest(world, "req-1", "add a retry budget");
  await reserve(world, "i-0001", "add a retry budget", null, "req-1");
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
      drafter: String(row.drafter),
      payload: JSON.parse(String(row.payload)) as JsonRecord,
      snapshot: JSON.parse(String(row.snapshot)) as JsonRecord,
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

/**
 * Whether some text can be read without opening anything -- `gate-elements`'
 * own question, asked here for the same reason: a fold is not a drop, and a
 * collision behind one is still a collision the reader has to go looking for.
 */
export function readableWithoutOpening(html: string, text: string): boolean {
  const at = html.indexOf(text);
  if (at === -1) {
    return false;
  }
  let depth = 0;
  const shut: number[] = [];
  for (const found of html.slice(0, at).matchAll(/<details\b[^>]*>|<\/details>/g)) {
    if (found[0].startsWith("</")) {
      depth -= 1;
      if (shut.at(-1) === depth) {
        shut.pop();
      }
    } else {
      if (!/\bopen\b/.test(found[0])) {
        shut.push(depth);
      }
      depth += 1;
    }
  }
  return shut.length === 0;
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

// -- What the page's suites drive the served page with (rondo#335) --
//
// These were `test/access/web.test.ts`'s own helpers while that file held every
// view. The file is now one file per screen, and a helper more than one of them
// reaches for lives here, so that no screen's suite has to import from another
// screen's suite.

/**
 * The tests marked with this build a real git repository or write an on-disk
 * store, and are the heaviest thing in this file on a Windows runner
 * (rondo#222, #191). A floor under Windows process and filesystem variance,
 * not a budget.
 *
 * **What this file costs per cell, healthy and when it goes wrong, is recorded
 * in `docs/operations/ci-timing.md` with the run ids.** Read that before
 * changing this number: it was deliberately not raised on rondo#332, because
 * the overruns seen there are twenty-fold against a limit that already had
 * twenty-fold headroom, which is not what a limit set too low looks like.
 */
export const WINDOWS_HEAVY_TIMEOUT_MS = 60_000;

/**
 * One form post, with headers of our choosing and redirects left alone.
 *
 * **Shaped like a person's press unless a test says otherwise** (D-0059
 * section 5): same-origin, a navigation, `Sec-Fetch-User: ?1` and an `Origin`
 * naming the page -- the headers Chromium sends when a person clicks the
 * native button. A header given as `undefined` is not sent at all.
 */
export function post(
  base: string,
  form: Record<string, string>,
  headers: Record<string, string | undefined> = {},
): Promise<{ status: number; body: string; location: string | undefined }> {
  const encoded = new URLSearchParams(form).toString();
  const sent = Object.fromEntries(
    Object.entries({
      origin: base,
      "sec-fetch-site": "same-origin",
      "sec-fetch-mode": "navigate",
      "sec-fetch-user": "?1",
      ...headers,
    }).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      `${base}/`,
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "content-length": String(Buffer.byteLength(encoded)),
          ...sent,
        },
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => {
          body += chunk;
        });
        response.on("end", () => {
          resolve({
            status: response.statusCode ?? 0,
            body,
            location: response.headers.location,
          });
        });
      },
    );
    request.on("error", reject);
    request.end(encoded);
  });
}

/** A server on an ephemeral port, and the base URL it announced. */
export async function serving(ports: ServedPorts): Promise<{
  base: string;
  stop: AbortController;
  served: Promise<number>;
}> {
  let announced = "";
  const stop = new AbortController();
  const served = serveOperatorPage(
    ports,
    0,
    (line) => {
      announced = line;
    },
    () => {
      throw new Error("the server refused to listen");
    },
    stop.signal,
  );
  // `listen` is asynchronous; the announcement is what says the socket is up.
  while (announced === "") {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  const base = /(http:\/\/127\.0\.0\.1:\d+)\//.exec(announced)?.[1] ?? "";
  expect(base).not.toBe("");
  return { base, stop, served };
}

/** The token this process minted, as the page rendered it into its form. */
export function tokenIn(html: string): string {
  const found = /name="token" value="([^"]+)"/.exec(html)?.[1];
  expect(found).toBeDefined();
  return found ?? "";
}

export const rows = (connection: DatabaseSync, table: string): number =>
  Number(
    (
      connection.prepare(`SELECT count(*) AS n FROM ${table}`).get() as {
        n: number;
      }
    ).n,
  );

/**
 * The files a view loads, resolved from the repository root the way
 * `src/access/web-app.ts` resolves them.
 */
const ROOT = new URL("../../", import.meta.url);

export const bytesOf = (path: string): Buffer => readFileSync(new URL(path, ROOT));

export const digestOf = (bytes: Buffer | string): string =>
  createHash("sha256").update(bytes).digest("hex");

/** `page/keys.js` with its commentary removed, so a claim is read off code. */
export const keysCode = (): string =>
  bytesOf("page/keys.js")
    .toString("utf8")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");

/** Every stored byte of what a press wrote, in the order the rows were made. */
export function recorded(connection: DatabaseSync): unknown[] {
  return [
    connection
      .prepare(
        "SELECT kind, drafter, payload, proposal_digest, snapshot, snapshot_digest, " +
          "iteration_id FROM proposal ORDER BY rowid",
      )
      .all(),
    connection
      .prepare(
        "SELECT subject_kind, subject_id, disposition, rule_name FROM operator_attention " +
          "ORDER BY rowid",
      )
      .all(),
  ];
}

/** One `GET`, with headers of our choosing and the redirect left where it is. */
export async function get(
  base: string,
  path: string,
  headers: Record<string, string> = {},
): Promise<{
  status: number;
  location: string | null;
  cookie: string | null;
  vary: string | null;
  body: string;
}> {
  // **A navigation unless the caller says otherwise**, over `node:http`:
  // undici's fetch always sends `sec-fetch-mode: cors`, which is what a redraw
  // sends, and rule 5's cookie is written only on a navigation.
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      `${base}${path}`,
      { headers: { "sec-fetch-mode": "navigate", ...headers } },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => {
          body += chunk;
        });
        response.on("end", () => {
          const vary = response.headers.vary;
          resolve({
            status: response.statusCode ?? 0,
            location: response.headers.location ?? null,
            cookie: response.headers["set-cookie"]?.join(", ") ?? null,
            vary: vary === undefined ? null : String(vary),
            body,
          });
        });
      },
    );
    request.on("error", reject);
    request.end();
  });
}

/** The ids a composer would carry, minted in the shape the server mints them. */
export const MINTED = {
  request: "request-00000000-0000-4000-8000-000000000001",
  reply: "reply-00000000-0000-4000-8000-000000000002",
} as const;
export const mint = (kind: "request" | "reply"): string => MINTED[kind];

/** A request message that opens a thread, for the scope screen to draft over. */
export async function seedScopeRequest(
  world: ReturnType<typeof fresh>,
  messageId: string,
  body: string,
): Promise<void> {
  const outcome = await world.record.recordThreadMessage({
    messageId,
    body,
    authorKind: "operator",
    authorId: "ada",
    inReplyTo: null,
    atMs: 1_000,
    bases: [],
    asks: false,
  });
  if (outcome.kind !== "recorded") {
    throw new Error(`the scope fixture request did not record: ${JSON.stringify(outcome)}`);
  }
}
