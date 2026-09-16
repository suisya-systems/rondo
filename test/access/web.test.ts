/**
 * The operator's page, over a real store.
 *
 * Against `node:sqlite` rather than a stub for `between.test.ts`'s reason: the
 * one property worth asserting here is that a surface which draws itself every
 * few seconds writes **nothing** -- and "no row was written" is a claim about a
 * database rather than about a mock's call log. The one write it may do is
 * asserted the other way round, against a recorded call, because what is under
 * test there is the door rather than the ledger: `answerFromPage` is the
 * command line's own `walkGate` and `resume`, and this file has no continuo.
 * The half of that press which *is* a ledger write -- the framing it rests on
 * (D-0042) -- is asserted against the database, because it is reachable without
 * one. The other two are what the
 * terminal got wrong and this page must not (rondo#90's paragraphs, rondo#91's
 * repeated basis), and both are properties of the bytes that reach a browser.
 */
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import {
  recordPagePress,
  recordScopeFromPage,
  reviseFromPage,
  scopeDraftingFromPlan,
  startScopedFromPage,
} from "../../src/access/cli.js";
import { agentTypeRecordOf, heldAgentTypeLines } from "../../src/access/scope.js";
import {
  type LanguageAsked,
  operatorPage as renderPage,
  resolveLanguage,
  type ScopeDrafting,
} from "../../src/access/web.js";
import {
  AnswerPort,
  newScopeId,
  type ScopeFormDraft,
  type ServedPorts,
  serveOperatorPage,
} from "../../src/access/web-app.js";
import { type Chrome, chromeFor, EN } from "../../src/access/wording.js";
import { allocate } from "../../src/refrain/allocator.js";
import {
  admittedPlan,
  planPayload,
  type RunPlan,
  readRunPlan,
  runPlan,
} from "../../src/refrain/plan.js";
import { contentDigest } from "../../src/store/plan.js";
import { type JsonRecord, scopePayloadWithDefaults } from "../../src/store/records.js";
import { advisoryRecord, iterationStore } from "../../src/store/sqlite.js";

const PLAN: RunPlan = {
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

function planFor(id: string, materialLanguage: string | null = null): JsonRecord {
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
const operatorPage = async (...args: Parameters<typeof renderPage>): Promise<string> =>
  (await renderPage(...args)).replaceAll("&#39;", "'");

const fresh = () => {
  const connection = new DatabaseSync(":memory:");
  return {
    connection,
    store: iterationStore(connection, { maxOccupying: 4, maxLive: 6 }),
    record: advisoryRecord(connection),
  };
};

/** Material that is only its text: no gate question read and no range named. */
const asText = (...lines: string[]) => ({ lines, why: null, work: null });

/** Every press this surface let through, in order. */
type Pressed = { iterationId: string; body: string }[];

function portsOver(
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
    // The scope screen's own door is `test/access/web-app.test.ts`'s too; with
    // no plan this page test draws no scope form (rondo#233 S3).
    plan: null,
    scope: null,
    // The revise press's own door is `test/access/web-app.test.ts`'s, as the
    // approve press's is; what this file tests is the form the page draws for
    // it (rondo#233 S4).
    revise: null,
  };
}

/** Put one reserved row at the gate, which is the only state with a button. */
async function openGate(world: ReturnType<typeof fresh>, id: string): Promise<void> {
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

/**
 * One form post, with headers of our choosing and redirects left alone.
 *
 * **Shaped like a person's press unless a test says otherwise** (D-0059
 * section 5): same-origin, a navigation, `Sec-Fetch-User: ?1` and an `Origin`
 * naming the page -- the headers Chromium sends when a person clicks the
 * native button. A header given as `undefined` is not sent at all.
 */
function post(
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
async function serving(ports: ServedPorts): Promise<{
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
function tokenIn(html: string): string {
  const found = /name="token" value="([^"]+)"/.exec(html)?.[1];
  expect(found).toBeDefined();
  return found ?? "";
}

async function reserve(
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

const rows = (connection: DatabaseSync, table: string): number =>
  Number(
    (
      connection.prepare(`SELECT count(*) AS n FROM ${table}`).get() as {
        n: number;
      }
    ).n,
  );

/** One request carrying a `Host` of our choosing, which `fetch` will not send. */
function withHost(base: string, host: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(`${base}/`, { headers: { host } }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => {
        body += chunk;
      });
      response.on("end", () => {
        resolve({ status: response.statusCode ?? 0, body });
      });
    });
    request.on("error", reject);
    request.end();
  });
}

test("the page shows what inbox, between and explain show", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");

  const html = await operatorPage(portsOver(world));
  const opened = await operatorPage(portsOver(world), null, {
    kind: "reading",
  });

  // The lead answers the operator's questions; the reading is where the three
  // commands' own compositions are, whole (rondo#145).
  expect(html).toContain("do the thing");
  expect(opened).toContain("inbox for 'ada'");
  expect(opened).toContain("what spans the live laps");
  expect(opened).toContain("iteration 'i-0001'");
  // The page says out loud what a redraw does, because a screen that moves a
  // last-look mark by being left open is worse than one that says it does not.
  expect(html).toContain("a redraw writes nothing");
  expect(html).toContain('http-equiv="refresh"');
});

test("looking at the page writes nothing", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  await openGate(world, "i-0001");

  // Three draws of each view, which is what a page that refreshes itself does
  // while nobody is at the desk -- and the redraw of an answering view left
  // open on a desk is the one that matters most, because that view composes the
  // very framing a press records. Each of them would have been a presentation
  // counted and a last-look mark moved if this surface had the command line's
  // ports (D-0041).
  for (let draw = 0; draw < 3; draw += 1) {
    await operatorPage(portsOver(world, "ada", []), "t");
    await operatorPage(portsOver(world, "ada", []), "t", { kind: "reading" });
    await operatorPage(portsOver(world, "ada", []), "t", {
      kind: "answer",
      iterationId: "i-0001",
    });
  }

  expect(rows(world.connection, "proposal")).toBe(0);
  expect(rows(world.connection, "operator_attention")).toBe(0);
  expect(rows(world.connection, "operator_view")).toBe(0);
  expect(rows(world.connection, "human_decision")).toBe(0);
});

test("a press records the framing it rests on, and one that cannot be recorded answers nothing", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  await openGate(world, "i-0001");
  const ports = {
    store: world.store,
    record: world.record,
    now: () => 6_000,
    present: () => undefined,
  };

  expect(await recordPagePress(ports, "i-0001")).toEqual({
    ok: true,
    note: "",
  });

  // The two rows the page drew and never held: the framing itself, and the
  // count of it having reached somebody (D-0042 rule 1). Written on the press
  // and on nothing else -- "looking at the page writes nothing" above is the
  // other half of the same claim, over the same tables.
  expect(rows(world.connection, "proposal")).toBe(1);
  expect(rows(world.connection, "operator_attention")).toBe(1);
  // The mark stays where `rondo inbox` left it: a press is proof one row was
  // read and not proof an inbox was (rule 2).
  expect(rows(world.connection, "operator_view")).toBe(0);

  // Rule 3: a framing that will not record is a sentence the person reads, and
  // the caller stops there rather than walking the gate.
  const missing = await recordPagePress(ports, "i-0404");
  expect(missing.ok).toBe(false);
  expect(missing.note).toContain("nothing was answered");
  expect(rows(world.connection, "proposal")).toBe(1);

  // A framing recorded and not counted complains and lets the press through:
  // the command line exits 1 on the same outcome, and a browser cannot read an
  // exit status, so the line goes to the terminal `rondo web` runs in.
  const said: string[] = [];
  const uncounted = await recordPagePress(
    {
      ...ports,
      now: () => 7_000,
      record: {
        ...world.record,
        recordAttention: async () =>
          await Promise.resolve({
            kind: "refused" as const,
            reason: "the table is locked",
          }),
      },
    },
    "i-0001",
    (line) => said.push(line),
  );
  expect(uncounted.ok).toBe(true);
  expect(said.join("\n")).toContain("recorded and not counted as presented");
  expect(rows(world.connection, "proposal")).toBe(2);
  expect(rows(world.connection, "operator_attention")).toBe(1);
});

test("an empty store renders a page rather than an error", async () => {
  const html = await operatorPage(portsOver(fresh(), null));

  expect(html).toContain("Nothing is waiting on you");
  // No approver, no inbox -- and the page says which **where it is visible**,
  // rather than drawing somebody else's, showing an empty one as though it were
  // theirs, or explaining a missing button only inside the fold.
  expect(lead(html)).toContain("RONDO_APPROVER is not set");
  expect(await operatorPage(portsOver(fresh(), null), null, { kind: "reading" })).toContain(
    "what spans the live laps",
  );
});

test("a request keeps its paragraphs and its markup is text (rondo#90)", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "first line\n\nsecond <b>paragraph</b>");

  const html = await operatorPage(portsOver(world));

  // The newline survives as a newline: the terminal escapes it to a `\u` form
  // (D-0004) because a cp932 console may not encode it, and a browser has no
  // such problem. `white-space: pre-wrap` is what renders it.
  expect(html).toContain("first line\n\nsecond");
  expect(html).not.toContain("\\u000a");
  // ...and the running row that carries it is not cut to one line.
  const request = /<p class="(request[^"]*)"[^>]*>first line/.exec(html)?.[1] ?? "";
  expect(request).toContain("whitespace-pre-wrap");
  expect(request).not.toContain("truncate");
  expect(html).toContain("&lt;b&gt;paragraph&lt;/b&gt;");
  expect(html).not.toContain("<b>paragraph</b>");
});

test("one basis is written once above the claims that rest on it (rondo#91)", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");

  const html = await operatorPage(portsOver(world));
  const bases = [...html.matchAll(/<p class="basis[^"]*">([^<]*)<\/p>/g)].map((match) => match[1]);

  // Every group's basis differs from the one before it, which is what makes the
  // repetition impossible rather than merely absent from this fixture.
  expect(bases.length).toBeGreaterThan(0);
  for (const [at, basis] of bases.entries()) {
    if (at > 0) {
      expect(basis).not.toBe(bases[at - 1]);
    }
  }
});

test("it serves the page on localhost, and only the one page", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");

  const { base, stop, served } = await serving(portsOver(world));

  const page = await fetch(`${base}/`);
  expect(page.status).toBe(200);
  expect(page.headers.get("content-type")).toBe("text/html; charset=utf-8");
  // **The attack neither the token nor the `Host` check reaches.** Another
  // page cannot read this one, so it cannot steal the token -- but it can
  // frame this one under a button of its own, and the click that follows
  // carries the genuine token from the loopback origin. The browser is what
  // refuses that, and only if it is told to.
  // Since D-0059 the policy also says nothing runs that this process did not
  // serve (R2's substitute), so the header is a list and the one directive this
  // test is about is asserted by name.
  const policy = page.headers.get("content-security-policy") ?? "";
  expect(policy.split(/;\s*/)).toContain("frame-ancestors 'none'");
  expect(policy.split(/;\s*/)).toContain("default-src 'self'");
  expect(policy.split(/;\s*/)).toContain("script-src 'self'");
  // **The referrer policy is part of the press, not decoration.** Under
  // `no-referrer` (the middleware's default) a browser sends the form's `POST`
  // with `Origin: null`, which the press refuses -- so a real person's click on
  // `approve` was refused while every hand-written request here passed.
  // Observed in headless Chromium against this page on 2026-09-14.
  expect(page.headers.get("referrer-policy")).toBe("same-origin");
  expect(await page.text()).toContain("waiting for your answer");

  // **The reading is the same page at a second address**, and the redraw it
  // serves points back at that address -- so the fold an operator opened is
  // still open five seconds later, which is what makes it a fold (rondo#145).
  const withReading = await fetch(`${base}/?reading=open`);
  expect(withReading.status).toBe(200);
  const readingHtml = await withReading.text();
  expect(readingHtml).toContain("what spans the live laps");
  expect(readingHtml).toContain('content="5;url=/?reading=open&amp;lang=en"');

  // One page and no router: a typo'd path says so rather than quietly showing
  // the only page there is.
  expect((await fetch(`${base}/inbox`)).status).toBe(404);
  // With no approver there is no write port, so the door is shut at the method
  // rather than at the token: there is nobody this page could answer as.
  expect((await fetch(`${base}/`, { method: "POST" })).status).toBe(403);
  // And a method that is neither a read nor the one write is still refused.
  expect((await fetch(`${base}/`, { method: "DELETE" })).status).toBe(405);

  // **A page on an attacker's domain, rebound to 127.0.0.1, gets nothing.**
  // The socket cannot tell that request from the operator's own -- both arrive
  // on loopback -- and the `Host` header is what does.
  // `fetch` refuses to send a `Host` of its caller's choosing, which is exactly
  // the header under test -- so this one request is made with `node:http`.
  const rebound = await withHost(base, "evil.example");
  expect(rebound.status).toBe(421);
  expect(rebound.body).not.toContain("i-0001");

  stop.abort();
  expect(await served).toBe(0);
});

test("the button is drawn only where there is a gate and somebody to answer it", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  const pressed: Pressed = [];

  const answering = { kind: "answer", iterationId: "i-0001" } as const;

  // Reserved and not yet at a gate: nothing is asking, so nothing is offered --
  // and the view that would carry a button does not invent one either.
  expect(await operatorPage(portsOver(world, "ada", pressed), "t")).not.toContain("<form");
  expect(await operatorPage(portsOver(world, "ada", pressed), "t", answering)).not.toContain(
    "<form",
  );

  await openGate(world, "i-0001");
  // The summary is the way to the button and not the button: it names the row
  // and points at the address that carries the framing a press records.
  const summary = await operatorPage(portsOver(world, "ada", pressed), "t");
  expect(summary).not.toContain("<form");
  expect(summary).toContain('href="/?answer=i-0001&amp;lang=en"');

  const offered = await operatorPage(portsOver(world, "ada", pressed), "t", answering);
  expect(offered).toContain('method="post"');
  expect(offered).toContain("gate-i-0001");
  // **What the press would approve over, beside the press** (D-0029 rule 2).
  // The screen that is easier to reach than the terminal must not also be the
  // screen that asks for less before it writes.
  expect(offered).toContain("work    rondo/i-0001");
  // And a row named by the query that is not at a gate gets neither: the
  // conditions are the same ones `rondo answer` refuses on.
  expect(
    await operatorPage(portsOver(world, "ada", pressed), "t", {
      kind: "answer",
      iterationId: "i-0404",
    }),
  ).not.toContain("<form");

  // No approver, no write port, no button -- even at the same open gate, and
  // not on the answering view either. The page is not a second place rondo will
  // act for an unnamed person. Asked of the server since D-0059: the renderer
  // no longer holds the writer (rule 3a), so *whether there is one* is decided
  // where it is held, and handed down as a token or as nothing.
  const { base, stop, served } = await serving(portsOver(world, null));
  expect(await (await fetch(`${base}/?lang=en`)).text()).not.toContain("<form");
  expect(await (await fetch(`${base}/?answer=i-0001&lang=en`)).text()).not.toContain("<form");
  stop.abort();
  expect(await served).toBe(0);
});

test("a person's press answers the gate and an unattended redraw cannot", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  await openGate(world, "i-0001");
  const pressed: Pressed = [];
  const { base, stop, served } = await serving(portsOver(world, "ada", pressed));

  // Whatever the page draws while nobody is there is a GET, and a GET holds
  // only the reading ports. Three of them, then nothing was answered.
  for (let draw = 0; draw < 3; draw += 1) {
    await fetch(`${base}/`);
  }
  expect(pressed).toEqual([]);

  const token = tokenIn(await (await fetch(`${base}/?answer=i-0001`)).text());
  const answered = await post(base, {
    token,
    iteration: "i-0001",
    body: "revise",
  });

  // The body the form carried is ignored: the button's word is the module's
  // constant, so a hand-written post cannot widen what this surface may say.
  expect(pressed).toEqual([{ iterationId: "i-0001", body: "approve" }]);
  // A redirect and not a page, so a refresh re-reads rather than re-answers --
  // and it carries the tag the press was made under (D-0056 rule 11), so the
  // page the operator lands back on does not re-resolve its language.
  expect(answered.status).toBe(303);
  expect(answered.location).toBe("/?lang=en#lap-i-0001");

  stop.abort();
  expect(await served).toBe(0);
});

test("a form from another page is refused, token first and origin too", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  await openGate(world, "i-0001");
  const pressed: Pressed = [];
  const { base, stop, served } = await serving(portsOver(world, "ada", pressed));
  const token = tokenIn(await (await fetch(`${base}/?answer=i-0001`)).text());

  // **The attack the `Host` check does not reach.** A form on evil.example
  // posting to http://127.0.0.1:7333/ sends exactly the `Host` the operator's
  // own browser sends, so the DNS-rebinding defence passes it through. What it
  // cannot do is read this page, so it cannot carry the token.
  expect((await post(base, { iteration: "i-0001" })).status).toBe(403);
  expect((await post(base, { token: "not-the-token", iteration: "i-0001" })).status).toBe(403);
  // Corroboration rather than the gate: an `Origin` naming somewhere else is
  // refused even when the token is right, which cannot happen and costs little.
  expect(
    (await post(base, { token, iteration: "i-0001" }, { origin: "https://evil.example" })).status,
  ).toBe(403);
  // A token with no iteration names nothing to answer.
  expect((await post(base, { token })).status).toBe(400);

  expect(pressed).toEqual([]);

  stop.abort();
  expect(await served).toBe(0);
});

test("a refusal from the write port is shown rather than redirected away", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  await openGate(world, "i-0001");
  const ports: ServedPorts = {
    ...portsOver(world),
    material: async () => await Promise.resolve(asText("work    rondo/i-0001")),
    answer: new AnswerPort(
      async () =>
        await Promise.resolve({
          ok: false,
          note: "continuo is not usable: no CLI",
        }),
    ),
  };
  const { base, stop, served } = await serving(ports);
  const token = tokenIn(await (await fetch(`${base}/?answer=i-0001`)).text());

  const refused = await post(base, { token, iteration: "i-0001" });
  // 303 back to a page still showing the same open gate would be the one answer
  // a person cannot act on: they pressed the button and nothing appears to have
  // happened. The reason is the response.
  expect(refused.status).toBe(409);
  expect(refused.body).toContain("continuo is not usable");

  stop.abort();
  expect(await served).toBe(0);
});

/** The visible page: everything a browser draws before the fold is opened. */
function lead(html: string): string {
  return html.slice(0, html.indexOf('<p id="fold"'));
}

/** The fold: what the second address of the page adds below the link. */
function reading(html: string): string {
  return html.slice(html.indexOf('<p id="fold"'));
}

test("an idle store says zero once rather than nine times (rondo#145)", async () => {
  const html = await operatorPage(portsOver(fresh()));
  const opened = await operatorPage(portsOver(fresh()), null, {
    kind: "reading",
  });

  // The measurement in the issue: nine phrasings of nothing, of which this is
  // the shape. One sentence now stands where they did, and it carries what it
  // rests on -- which is not the same as the page having stopped saying it.
  expect(lead(html)).toContain(
    "Nothing is waiting on you, nothing is running, and nothing has finished.",
  );
  expect(lead(html)).not.toContain("proposals that bind nothing");
  expect(lead(html)).not.toContain("an admission a bound refused");
  expect(lead(html)).not.toContain("you have never looked");
  // Folded and not hidden (D-0032): every one of them is still on the page,
  // under the basis it always had.
  expect(reading(opened)).toContain("proposals that bind nothing (0)");
  expect(reading(opened)).toContain("an admission a bound refused");
  expect(reading(opened)).toContain("snapshot /refusals = []");
  // **The fold survives the redraw, because the URL holds it open and not the
  // browser.** A `<details>` would be shut again five seconds later, and a page
  // with no script could not reopen it -- which would make this a hiding.
  expect(opened).toContain('content="5;url=/?reading=open&amp;lang=en"');
  expect(html).toContain('content="5;url=/?lang=en"');
});

test("the page is ordered by the operator's three questions (rondo#145)", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");

  const html = await operatorPage(portsOver(world));
  const at = (heading: string) => lead(html).indexOf(heading);
  const opened = await operatorPage(portsOver(world), null, {
    kind: "reading",
  });

  expect(at("waiting for your answer")).toBeGreaterThan(-1);
  expect(at("running now")).toBeGreaterThan(at("waiting for your answer"));
  expect(at("just finished")).toBeGreaterThan(at("running now"));
  // rondo's own vocabulary is below the questions, not in place of them.
  expect(at("what spans the live laps")).toBe(-1);
  expect(html).toContain('href="/?reading=open&amp;lang=en"');
  expect(reading(opened)).toContain("what spans the live laps");
});

test("the three questions are told apart in the markup, not only in the order (rondo#153)", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");

  const html = lead(await operatorPage(portsOver(world)));

  // The order alone put the three questions in a row and gave them the same
  // weight; `data-question` is the whole of what the markup weighs them by,
  // and each group carries exactly one.
  expect(html).toContain('<section data-question="waiting"');
  expect(html).toContain('<section data-question="running"');
  expect(html).toContain('<section data-question="ended"');
  // Both palettes are declared rather than inherited from the user agent, so a
  // dark reader gets rondo's contrast and not the browser's (rondo#153). Since
  // D-0059 they are the stylesheet's source rather than an inline block.
  const page = await operatorPage(portsOver(world));
  expect(bytesOf("page/app.css").toString("utf8")).toContain("@media (prefers-color-scheme: dark)");
  expect(page).toContain('<link rel="stylesheet" href="/app.css"/>');
  // No *inline* script and no inline style, and still nothing but the one form
  // that can write: what the page executes is files this process serves under
  // `script-src 'self'`, each named in the served-file manifest (D-0059 R1).
  expect(page).not.toMatch(/<script(?![^>]*\bsrc=)/);
  expect(page).not.toContain("<style");
});

test("a lap at a gate carries its cost and its fence beside the button (rondo#145)", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  await openGate(world, "i-0001");
  const settled = await world.store.transition(
    "i-0001",
    "awaiting_human",
    "awaiting_human",
    { lapCostUsd: 1.42, lapTurns: 18, permissionDenials: '["Bash(rm:*)"]' },
    3_000,
  );
  expect(settled.kind).toBe("transitioned");

  const html = await operatorPage(portsOver(world, "ada", []), "t");
  const answering = await operatorPage(portsOver(world, "ada", []), "t", {
    kind: "answer",
    iterationId: "i-0001",
  });

  // What it cost (#124), what its fence refused (#122) and what releases it,
  // on the row a person came to act on -- and the row cited once above them
  // rather than a basis under each (rondo#91).
  expect(lead(html)).toContain("cost $1.42, 18 turns, duration not read");
  // The bytes continuo wrote, as HTML text: the array is quoted in the column
  // and the page escapes rather than re-encodes it.
  expect(lead(html)).toContain("the fence refused [&quot;Bash(rm:*)&quot;]");
  expect(lead(html)).toContain("answer gate gate-i-0001");
  // The column shows the id alone and keeps the basis it abbreviates as `title`.
  expect(lead(html)).toContain('title="iteration i-0001"><p class="basis">i-0001</p>');
  // The state is a pill a person reads, with the status sentence as its `title`.
  expect(lead(html)).toContain(">Waiting on you</span>");
  expect(lead(html)).toContain('title="awaiting_human -- waiting ');

  // **The button is on the page that showed what a press records** (D-0042
  // rules 1 and 4). `recordPagePress` stores `explainIteration`'s entire claim
  // set and counts it as presented, so every one of those claims has to have
  // reached the browser: a summary with a button would record a presentation
  // that did not happen, and two dozen claims per waiting row on the summary is
  // the screen rondo#145 is about. So the summary is the way there and the
  // answering view is the press.
  expect(html).not.toContain("<form");
  expect(lead(html)).toContain('href="/?answer=i-0001&amp;lang=en"');
  expect(answering).toContain('method="post"');
  expect(answering).toContain("What pressing approve records as shown");
  expect(answering).toContain("snapshot /iteration/lapCostUsd = 1.42");
  expect(answering).toContain("snapshot /iteration/lapDurationMs = null");
  expect(answering).toContain("work    rondo/i-0001");
  // **And it holds still while they read it** (D-0054 rule 1). This view used
  // to point a meta refresh back at itself, which kept the address but still
  // threw the document away under the reader every five seconds -- rondo#160's
  // complaint, observed on lapja-001. It now updates by nothing at all, and
  // nothing is staler for it: D-0042 re-composes this framing at press time and
  // refuses a press naming a row that is not there.
  expect(answering).not.toContain('http-equiv="refresh"');

  // A summary reads neither the framing nor the material: both cost a read per
  // row, on a surface that redraws every five seconds.
  expect(html).not.toContain("What pressing approve records as shown");
  expect(html).not.toContain("work    rondo/i-0001");
});

test("a lap that has ended is on the page it just left (rondo#145)", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  await openGate(world, "i-0001");
  const closed = await world.store.transition(
    "i-0001",
    "awaiting_human",
    "closed",
    { gateOutcome: "approve" },
    4_000,
  );
  expect(closed.kind).toBe("transitioned");

  const html = await operatorPage(portsOver(world));

  expect(lead(html)).toContain("just finished (1)");
  // The pill says the outcome; the terminal's head sentence is its `title`.
  expect(lead(html)).toContain(">Approved</span>");
  expect(lead(html)).toContain("1s ago");
  expect(lead(html)).toContain(`title="closed 1s ago -- gate answered 'approve'"`);
  // Nothing is running and nothing is waiting, and the page says each once.
  expect(lead(html)).toContain("waiting for your answer (0)");
  expect(lead(html)).toContain("running now (0)");
});

test("an explanation nobody can answer is not a thing waiting on you (rondo#145)", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  await openGate(world, "i-0001");

  // Every press records one of these (D-0042 rule 1), and `openProposals`
  // returns it for ever: `recordDecision` refuses the non-binding kinds, so
  // nothing can ever settle it. Counting it as waiting would make the queue
  // climb by one with each approval and never come back down.
  expect(
    await recordPagePress(
      // Before the bound this page's clock reads: `openProposals` is asked
      // `uptoMs`, so a proposal recorded after it would be outside the window
      // for a reason that has nothing to do with what is under test here.
      {
        store: world.store,
        record: world.record,
        now: () => 4_000,
        present: () => undefined,
      },
      "i-0001",
    ),
  ).toEqual({ ok: true, note: "" });
  expect(rows(world.connection, "proposal")).toBe(1);

  const html = await operatorPage(portsOver(world));
  const opened = await operatorPage(portsOver(world), null, {
    kind: "reading",
  });

  // One row waits: the iteration at its gate. The explanation is material, and
  // it is in the reading where the inbox already lists it by authority.
  expect(lead(html)).toContain("waiting for your answer (1)");
  expect(reading(opened)).toContain("proposals that bind nothing (1)");
});

test("the elements that quote material carry the lang the plan asked for (D-0053 rule 12)", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "重みが足りない", "ja");
  await openGate(world, "i-0001");
  const html = await operatorPage(
    {
      ...portsOver(world, "ada", []),
      material: async () => await Promise.resolve(asText("なぜ止まったか")),
    },
    "t",
    { kind: "answer", iterationId: "i-0001" },
  );

  // The two elements rule 12 names, and nothing else: the request paragraph the
  // lap wrote for this operator, and the block a press records as shown.
  expect(html).toMatch(/<p class="request[^"]*" lang="ja">/);
  expect(html).toMatch(/<pre class="material[^"]*" lang="ja">/);
  // **The chrome is `en` because this host asked for nothing**, which is what
  // D-0055 rule 7 leaves unchanged: the document names the language rondo
  // actually wrote it in, and with no ask that is still English.
  expect(html).toContain('<html lang="en">');
  // **Nothing is translated** (rule 11): the same bytes, with an attribute.
  expect(html).toContain("重みが足りない");
  expect(html).toContain("なぜ止まったか");
});

test('a lap nobody asked a language of says so with `lang=""` (D-0055 rule 8)', async () => {
  // **The empty string is HTML's own way of saying *the language here is
  // unknown***, and it is what rondo has to say once the document stops being
  // `en`. The absent attribute this carried before inherited the chrome, which
  // was harmless while the chrome was always English and would turn *rondo does
  // not know* into a guess on the way past under a `ja` host.
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  await openGate(world, "i-0001");
  const ports = {
    ...portsOver(world, "ada", []),
    material: async () => await Promise.resolve(asText("why it stopped")),
  };
  const view = { kind: "answer", iterationId: "i-0001" } as const;
  const html = await operatorPage(ports, "t", view);

  expect(html).toMatch(/<p class="request[^"]*" lang="">/);
  expect(html).toMatch(/<pre class="material[^"]*" lang="">/);
  // It does not become the chrome's tag on a host that asked for one, which is
  // the whole of what the empty string is here to refuse: the two attributes
  // are true about different things and nothing reconciles them.
  const inJapanese = await operatorPage(ports, "t", view, chromeFor("ja"));
  expect(inJapanese).toContain('<html lang="ja">');
  expect(inJapanese).toMatch(/<p class="request[^"]*" lang="">/);
  expect(inJapanese).toMatch(/<pre class="material[^"]*" lang="">/);
});

/**
 * The files a view loads, resolved from the repository root the way
 * `src/access/web-app.ts` resolves them.
 */
const ROOT = new URL("../../", import.meta.url);

const bytesOf = (path: string): Buffer => readFileSync(new URL(path, ROOT));

const digestOf = (bytes: Buffer | string): string =>
  createHash("sha256").update(bytes).digest("hex");

/** Every `<script>` start tag in one document. */
const scriptTagsIn = (html: string): readonly string[] =>
  [...html.matchAll(/<script\b[^>]*>/g)].map((found) => found[0]);

/** What is left of a document when its scripts never run (D-0054 rule 7). */
const withoutScripts = (html: string): string =>
  html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");

/** `page/keys.js` with its commentary removed, so a claim is read off code. */
const keysCode = (): string =>
  bytesOf("page/keys.js")
    .toString("utf8")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");

test("liveness is per view: two views poll and swap, and the answer view updates by nothing", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  await openGate(world, "i-0001");
  const ports = portsOver(world, "ada", []);

  const summary = await operatorPage(ports, "t");
  const opened = await operatorPage(ports, "t", { kind: "reading" });
  const answering = await operatorPage(ports, "t", {
    kind: "answer",
    iterationId: "i-0001",
  });

  for (const [html, href] of [
    [summary, "/?lang=en"],
    [opened, "/?reading=open&amp;lang=en"],
  ] as const) {
    // htmx, then rondo's key script, both deferred so neither runs before the
    // document, and both served by this process (D-0059 R1, R2): root-relative
    // paths and no scheme anywhere, because a CDN tag is the one distribution
    // D-0054 rule 5 refused and R1 did not reopen.
    expect(scriptTagsIn(html)).toEqual([
      '<script src="/htmx.min.js" defer="">',
      '<script src="/keys.js" defer="">',
      '<script src="/composer.js" defer="">',
    ]);
    expect(html).not.toContain("//cdn");
    expect(scriptTagsIn(html).filter((tag) => tag.includes("://"))).toEqual([]);
    // **The refresh is a `GET` of this view's own address**, and the one
    // element it swaps is the ledger (D-0054 rules 1 and 2, R3).
    expect(html).toContain(
      `<div id="ledger" class="space-y-8" hx-get="${href}" hx-trigger="every 5s" hx-select="#ledger" hx-swap="outerHTML" hx-select-oob="#waiting-count">`,
    );
    expect([...html.matchAll(/hx-[a-z-]+=/g)].map((found) => found[0])).toEqual([
      "hx-get=",
      "hx-trigger=",
      "hx-select=",
      "hx-swap=",
      "hx-select-oob=",
    ]);
    // **R2's substitute is the library's configuration**, and it is on the
    // page rather than assumed from htmx's defaults.
    const config = JSON.parse(
      (/<meta name="htmx-config" content="([^"]*)"/.exec(html)?.[1] ?? "{}").replaceAll(
        "&quot;",
        '"',
      ),
    ) as Record<string, unknown>;
    expect(config).toEqual({
      selfRequestsOnly: true,
      allowEval: false,
      allowScriptTags: false,
      historyEnabled: false,
      includeIndicatorStyles: false,
      // A refused send lands under the draft rather than nowhere (#220 S1).
      responseHandling: [
        { code: "204", swap: false },
        { code: "[23]..", swap: true },
        {
          code: "[45]..",
          swap: true,
          error: true,
          target: "#composer-note",
          select: "#send-refused",
          swapOverride: "innerHTML",
        },
      ],
    });
    // The meta refresh has not been deleted -- it has moved, and it is what a
    // browser with scripting off still runs on.
    expect(html).toContain(`<noscript><meta http-equiv="refresh" content="5;url=${href}"/>`);
    expect(html).toContain("Redraws every 5s, and a redraw writes nothing");
  }
  // **What the reading view shows is inside what the refresh swaps**: `#ledger`
  // holds the fold and the reading sections, counted by `<div>` depth from
  // `#ledger`'s own opening tag.
  const ledgerAt = opened.indexOf('<div id="ledger"');
  const depthAt = (marker: string): number => {
    const at = opened.indexOf(marker);
    expect(at, marker).toBeGreaterThan(ledgerAt);
    const between = opened.slice(ledgerAt, at);
    return (between.match(/<div[\s>]/g) ?? []).length - (between.match(/<\/div>/g) ?? []).length;
  };
  expect(depthAt('<p id="fold"')).toBeGreaterThan(0);
  expect(depthAt('<div id="reading"')).toBeGreaterThan(0);

  // **The answer view updates by nothing at all** (D-0054 rule 1): no poll, no
  // library, no refresh, not even inside `<noscript>` -- it has no auto-update
  // in either mode, so there is nothing to degrade to. It carries only the key
  // script, which moves focus and follows links and changes nothing by itself.
  // And the composer script, whose fold keeping is what holds a fold the
  // person opened here across the press (#220 S1); it redraws nothing.
  expect(scriptTagsIn(answering)).toEqual([
    '<script src="/keys.js" defer="">',
    '<script src="/composer.js" defer="">',
  ]);
  expect(answering).not.toMatch(/hx-[a-z]+=/);
  expect(answering).not.toContain("htmx");
  expect(answering).not.toContain('http-equiv="refresh"');
  expect(answering).not.toContain("<noscript>");
  expect(answering).toContain("This view does not update itself");
  // And it is still the view with the button on it.
  expect(answering).toContain('method="post"');
});

test("every view is whole with the script gone", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  await openGate(world, "i-0001");
  const ports = portsOver(world, "ada", []);

  // The document a browser with scripting disabled draws, and the document a
  // browser whose scripts 404 is left holding: the same one, because nothing
  // on this page is produced by script (D-0054 rule 7).
  const summary = withoutScripts(await operatorPage(ports, "t"));
  const opened = withoutScripts(await operatorPage(ports, "t", { kind: "reading" }));
  const answering = withoutScripts(
    await operatorPage(ports, "t", { kind: "answer", iterationId: "i-0001" }),
  );

  // What needs the operator, where to go to answer it, and the liveness a
  // scriptless browser has.
  expect(summary).toContain("do the thing");
  expect(summary).toContain("waiting for your answer");
  expect(summary).toContain('href="/?answer=i-0001&amp;lang=en"');
  expect(summary).toContain('<meta http-equiv="refresh" content="5;url=/?lang=en"/>');

  // Every claim under its own basis, unchanged.
  expect(opened).toContain("inbox for 'ada'");
  expect(opened).toContain("iteration 'i-0001'");

  // **And the press**: the form, the gate it answers, the one word it carries
  // and the material it is answered over. A button only script renders is the
  // first thing rule 7 names as a violation of it -- and the press is a native
  // form, never an `hx-post`, because only a person's navigation mints one
  // (D-0059 section 5).
  expect(answering).toContain('method="post"');
  expect(answering).toContain('<button type="submit"');
  expect(answering).not.toContain("hx-post");
  expect(answering).toContain("gate-i-0001");
  expect(answering).toContain("work    rondo/i-0001");
  expect(tokenIn(answering)).toBe("t");

  // **What only the script makes true is marked so, and hidden until it runs**
  // (D-0059 R3): the key hints and the live indicator. `page/app.css` hides
  // `.js-only` unless `page/keys.js` has put `js` on the root element.
  expect(summary).toMatch(/<span class="js-only [^"]*"><span[^>]*><\/span>live<\/span>/);
  expect(summary).not.toContain('<html lang="en" class="js"');
  expect(bytesOf("page/app.css").toString("utf8")).toContain("html:not(.js) .js-only");
});

test("an unattended poll writes nothing, however many times it goes round", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  await openGate(world, "i-0001");
  const pressed: Pressed = [];
  // With an approver, so the write port exists and is simply never reached: a
  // page that wrote nothing because it had nothing to write with would not be
  // asserting anything (D-0041 rule 4).
  const { base, stop, served } = await serving(portsOver(world, "ada", pressed));

  // **What the refresh does, done over the socket it would use.** Five rounds
  // of each live view plus the answering one, which is what a page left open on
  // a desk for half a minute issues while nobody is there. Every one of them is
  // the request htmx's poll makes -- a `GET` of the address being read, with
  // htmx's own headers -- and every one reaches a renderer holding only the
  // read ports, and a port that mints no press from a `GET` (D-0059 R4).
  for (let poll = 0; poll < 5; poll += 1) {
    for (const address of ["/", "/?reading=open", "/?answer=i-0001"]) {
      const response = await fetch(`${base}${address}`, {
        headers: {
          "hx-request": "true",
          "hx-current-url": `${base}${address}`,
        },
      });
      expect(response.status).toBe(200);
    }
  }

  // The four tables a presentation, a look, a decision or a proposal would
  // land in (D-0042, D-0032 rules 9 and 10).
  expect(rows(world.connection, "proposal")).toBe(0);
  expect(rows(world.connection, "operator_attention")).toBe(0);
  expect(rows(world.connection, "operator_view")).toBe(0);
  expect(rows(world.connection, "human_decision")).toBe(0);
  // And nothing was answered, which is the same claim at the other port.
  expect(pressed).toEqual([]);

  stop.abort();
  expect(await served).toBe(0);
});

test("it serves rondo's key script as the bytes the tree holds, and D-0054's two files no more", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  const { base, stop, served } = await serving(portsOver(world));

  // **The served bytes are the tree's bytes.** Not "a file was served": the
  // digest of what came down the socket, against the source the build copies
  // (the manifest's own check is `test/access/web-app.test.ts`).
  const keys = await fetch(`${base}/keys.js`);
  expect(keys.status).toBe(200);
  expect(keys.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
  expect(digestOf(Buffer.from(await keys.arrayBuffer()))).toBe(digestOf(bytesOf("page/keys.js")));

  // **R2 retired the vendored morph and its poller**, so their addresses are
  // the 404 any other path is -- not a stale copy left in reach.
  expect((await fetch(`${base}/idiomorph-0.8.0.min.js`)).status).toBe(404);
  expect((await fetch(`${base}/poll.js`)).status).toBe(404);
  expect((await fetch(`${base}/package.json`)).status).toBe(404);
  expect((await fetch(`${base}/../package.json`)).status).toBe(404);
  // And a script path is not a second door: the only writable address is `/`,
  // so a POST to one is the same 404 a POST to any other path is.
  expect((await fetch(`${base}/keys.js`, { method: "POST" })).status).toBe(404);

  stop.abort();
  expect(await served).toBe(0);
});

test("rondo's own script moves focus and follows the server's links, and asks for nothing", () => {
  const code = keysCode();

  // **Its three targets are elements the server rendered**: the rows, the
  // row's link, and the view's way back (D-0059 rule 5, R3).
  expect(code).toContain('"[data-row]"');
  expect(code).toContain('"a[data-open]"');
  expect(code).toContain('"a[data-back]"');
  // And the one mark it leaves, which is what un-hides the hints (rule 7).
  expect(code).toContain('document.documentElement.classList.add("js")');

  // **No request of its own.** Following a rendered link is a navigation `GET`
  // the server wrote the address of; everything else a script could ask for is
  // asserted absent, so D-0054 rule 6's audit is still one file's worth of
  // `not.toContain`.
  for (const forbidden of [
    "fetch",
    "POST",
    "method",
    "XMLHttpRequest",
    "EventSource",
    "WebSocket",
    "sendBeacon",
    "FormData",
    "submit",
    "localStorage",
    "sessionStorage",
    "eval",
    "innerHTML",
    "document.write",
    "location.href =",
    "htmx.",
  ]) {
    expect(code).not.toContain(forbidden);
  }
  // **The two htmx events it hears are the refresh about to be sent and about
  // to be swapped, and all it may do at either is decline**: cancel the
  // request while a person holds a text selection, and skip a swap that would
  // bring back the same ledger. Declining asks for nothing.
  expect([...code.matchAll(/htmx:[A-Za-z]+/g)].map((found) => found[0])).toEqual([
    "htmx:beforeRequest",
    "htmx:beforeSwap",
  ]);
});

test("a running row says why rondo could not check for a log, not that there is none (#220 S2)", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "not started");
  await reserve(world, "i-0002", "performing");
  for (const [from, to] of [
    ["planned", "admitting"],
    ["admitting", "admitted"],
    ["admitted", "performing"],
  ] as const) {
    expect((await world.store.transition("i-0002", from, to, {}, 2_000)).kind).toBe("transitioned");
  }
  const html = await operatorPage(portsOver(world, "ada", []), "t");
  expect(html).toContain("could not check for a log: no continuo in this test");
  expect(html).toContain("log not looked for yet");
  expect(html).not.toContain("log not found");
});

test("every repeated block in the lead carries the identity the refresh restores focus by", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "the one at a gate");
  await reserve(world, "i-0002", "the one still running");
  await openGate(world, "i-0001");
  for (const [from, to] of [
    ["planned", "admitting"],
    ["admitting", "admitted"],
    ["admitted", "performing"],
  ] as const) {
    expect((await world.store.transition("i-0002", from, to, {}, 2_000)).kind).toBe("transitioned");
  }

  const html = await operatorPage(portsOver(world, "ada", []), "t");

  // **Identity and not position** (D-0054 rule 2, D-0059 R2). htmx swaps the
  // ledger and puts focus back on the element whose `id` held it, and `j`/`k`
  // focus is on these rows: a row with no id would drop the reader's place on
  // every refresh, and silently -- the page would still look right.
  const ids = [...html.matchAll(/<li id="([^"]+)" data-row=""/g)].map((found) => found[1]);
  expect(ids).toContain("lap-i-0001");
  expect(ids).toContain("lap-i-0002");
  // Unique, because an id the document repeats is an id focus cannot return to.
  expect(new Set(ids).size).toBe(ids.length);
  // And no row without one.
  expect([...html.matchAll(/<li(?! id=)[^>]*data-row/g)]).toEqual([]);
  // The same holds for every link inside the swapped ledger, which a keyboard
  // reader reaches by Tab rather than by `j`/`k`: one with no id loses focus to
  // the document on the next refresh.
  const ledger = html.slice(html.indexOf('id="ledger"'));
  expect([...ledger.matchAll(/<a(?! id=)[\s>]/g)]).toEqual([]);
});

/**
 * D-0055: rondo's chrome is prose the operator reads, and its language comes
 * from the host's one operator.
 *
 * The four properties the entry asks the implementing change to show are below,
 * and the middle one is the one that would cost something if it broke: the
 * bytes a press records must not depend on the host's language, because a
 * ledger holding two wordings of one claim cannot answer *which version was
 * under the button* (rule 4, and D-0042's invariant with it).
 */

/** The same world twice, so two hosts can be pressed against separately. */
async function waitingWorld(): Promise<ReturnType<typeof fresh>> {
  const world = fresh();
  await reserve(world, "i-0001", "重みが足りない", "ja");
  await openGate(world, "i-0001");
  return world;
}

/** Every stored byte of what a press wrote, in the order the rows were made. */
function recorded(connection: DatabaseSync): unknown[] {
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

test("the bytes a press records do not depend on the host's language (D-0055 rule 4)", async () => {
  // **Pressed on both hosts after both have drawn the row**, because the press
  // is the presentation (D-0042): what is asserted is not that one function
  // ignores an argument, but that the whole path an operator walks -- render,
  // read, press -- writes the same ledger under `en` and under `ja`.
  const worlds = [
    { world: await waitingWorld(), wording: EN },
    { world: await waitingWorld(), wording: chromeFor("ja") },
  ];
  const drawn: string[] = [];
  for (const { world, wording } of worlds) {
    const ports = {
      ...portsOver(world, "ada", []),
      material: async () => await Promise.resolve(asText("why it stopped")),
    };
    drawn.push(await operatorPage(ports, "t", { kind: "answer", iterationId: "i-0001" }, wording));
    expect(
      await recordPagePress(
        {
          store: world.store,
          record: world.record,
          now: () => 6_000,
          present: () => undefined,
        },
        "i-0001",
      ),
    ).toEqual({ ok: true, note: "" });
  }

  // The whole of rule 4 in one assertion: the payload, the digest over it, the
  // snapshot it was drawn from and the presentation counted beside it are the
  // same bytes on an English host and on a Japanese one.
  expect(recorded(worlds[1]?.world.connection as DatabaseSync)).toEqual(
    recorded(worlds[0]?.world.connection as DatabaseSync),
  );
  // Not vacuously, in both directions: each press did write, and the two hosts
  // were reading genuinely different documents when they pressed.
  expect(rows(worlds[0]?.world.connection as DatabaseSync, "proposal")).toBe(1);
  expect(rows(worlds[1]?.world.connection as DatabaseSync, "proposal")).toBe(1);
  expect(drawn[1]).not.toBe(drawn[0]);
});

test("a ja host reads in Japanese and leaves every token in its own bytes", async () => {
  const world = await waitingWorld();
  const ja = chromeFor("ja");
  const ports = {
    ...portsOver(world, "ada", []),
    material: async () => await Promise.resolve(asText("why it stopped")),
  };
  const summary = await operatorPage(ports, "t", { kind: "summary" }, ja);
  const reading = await operatorPage(ports, "t", { kind: "reading" }, ja);

  // Prose, on the three screens the operator actually reads -- including the
  // fold rule 3 of D-0053's falsifier fired on.
  expect(summary).toContain("あなたの答えを待っているもの (1)");
  expect(summary).toContain("描き直しは何も書き込みません");
  expect(reading).toContain("ここを読んでも最後に見た印は動きません");
  expect(reading).toContain("承認すると契約になる proposal (0)");
  expect(reading).toContain("まだ一度も見ていません");

  // **Tokens, verbatim and in the middle of the translated sentences** (rule 2
  // and rule 3): what the operator types, and what they match against the
  // store, `rondo show` and continuo's own output.
  expect(reading).toContain("rondo inbox");
  expect(summary).toContain("approve");
  expect(summary).toContain("awaiting_human");
  expect(summary).toContain("gate-i-0001");
  expect(summary).toContain("i-0001");
  // Nothing is transliterated, glossed, or given a parenthesis.
  expect(reading).not.toContain("ロンド");
  // Material is still quoted byte for byte, under the tag its plan asked for.
  expect(summary).toContain("重みが足りない");
  expect(summary).toMatch(/<p class="request[^"]*" lang="ja">/);

  // **What the ledger records stays English even here** (rule 4): the claim
  // labels beside the button are the bytes a press stores.
  const answering = await operatorPage(ports, "t", { kind: "answer", iterationId: "i-0001" }, ja);
  expect(answering).toContain("approve を押すと");
  expect(answering).toMatch(/<dt class="label[^"]*">request<\/dt>/);
});

test("<html lang> names the set rondo wrote, and never the tag that was asked for", async () => {
  const world = await waitingWorld();
  const declared = async (wording: Chrome): Promise<string> =>
    /<html lang="([^"]*)">/.exec(
      await operatorPage(portsOver(world, "ada", []), null, { kind: "summary" }, wording),
    )?.[1] ?? "";

  expect(await declared(EN)).toBe("en");
  expect(await declared(chromeFor("ja"))).toBe("ja");
  expect(await declared(chromeFor("JA"))).toBe("ja");
  // **A well-formed tag this tree ships no wording for.** The page is English,
  // so it says `en`: rondo does not declare an intention as a fact (rule 7).
  expect(await declared(chromeFor("de-CH-1901"))).toBe("en");
  expect(await declared(chromeFor(null))).toBe("en");
});

test("every view is complete under each of the three answers to the language question", async () => {
  // Unset, a tag with no wording, and a tag with one: three hosts, three views
  // each, and the same page in all nine -- rule 9's partial set is shippable
  // because a missing string is the English one and never a missing screen.
  const world = await waitingWorld();
  for (const wording of [chromeFor(null), chromeFor("de-CH-1901"), chromeFor("ja")]) {
    const ports = {
      ...portsOver(world, "ada", []),
      material: async () => await Promise.resolve(asText("why it stopped")),
    };
    const views = [
      await operatorPage(ports, "t", { kind: "summary" }, wording),
      await operatorPage(ports, "t", { kind: "reading" }, wording),
      await operatorPage(ports, "t", { kind: "answer", iterationId: "i-0001" }, wording),
    ];
    for (const html of views) {
      expect(html).toContain(`<html lang="${wording.lang}">`);
      expect(html).toContain(wording.waitingHeading(1));
      expect(html).toContain("</html>");
      // No key went missing on the way through a set that does not hold it.
      expect(html).not.toContain("undefined");
    }
    // The fold still carries rondo's own accounting, and the button its note.
    expect(views[1]).toContain(wording.inboxHeading);
    expect(views[2]).toContain(wording.approvePlain);
    expect(views[2]).toContain(`title="${wording.approveNote("gate-i-0001", "approve")}"`);
    // Every undetermined claim is still in the answer view, inside its one fold.
    expect(views[2]).toContain('<details id="undetermined"');
  }
});

/**
 * D-0056: the chrome's language follows the browser and is remembered, and the
 * resolution is never silent.
 *
 * Three groups, and they are three different kinds of claim. **The five steps**
 * are a pure function and are asserted as one, each step winning over the one
 * below it and losing to the one above. **The redirect and the cookie** are
 * properties of a response and are asserted over a socket, because "one 303
 * and no loop" and "no `Set-Cookie` on this one" are claims about wire bytes.
 * **What the press records** is asserted against the database, for D-0055 rule
 * 4's reason with the query, the cookie and the header added to it (rule 13).
 */

/** Rule 2's four inputs, defaulted to a host and a browser that said nothing. */
function askedWith(over: Partial<LanguageAsked> = {}): LanguageAsked {
  return {
    query: null,
    cookie: undefined,
    host: null,
    header: undefined,
    ...over,
  };
}

/** The tag one set of inputs resolves to. */
function resolvedTag(over: Partial<LanguageAsked> = {}): string {
  return resolveLanguage(askedWith(over)).lang;
}

test("rule 2 is five steps and the first answer wins, each step losing to the one above", () => {
  // **Step 5 is the floor**: nobody said anything, so English.
  expect(resolvedTag()).toBe("en");

  // **Step 4, the browser's list**, which answers exactly when nothing above
  // it did -- the case the operator was actually answering about.
  expect(resolvedTag({ header: "ja" })).toBe("ja");

  // **Step 3 beats step 4**: a host that has spoken is not overridden by a
  // browser-wide default (rule 3). Both directions, so this is the order and
  // not one lucky pair.
  expect(resolvedTag({ host: "en", header: "ja" })).toBe("en");
  expect(resolvedTag({ host: "ja", header: "en" })).toBe("ja");

  // **Step 2 beats step 3**: the operator's own remembered switch outranks the
  // host's statement about them.
  expect(resolvedTag({ cookie: "lang=ja", host: "en", header: "en" })).toBe("ja");
  expect(resolvedTag({ cookie: "lang=en", host: "ja", header: "ja" })).toBe("en");

  // **Step 1 beats everything**, which is what makes rule 4's canonical URL the
  // whole of the state, so a redraw of a view's own address keeps its language.
  expect(resolvedTag({ query: "ja", cookie: "lang=en", host: "en", header: "en" })).toBe("ja");
  expect(resolvedTag({ query: "en", cookie: "lang=ja", host: "ja", header: "ja" })).toBe("en");

  // **A step naming a tag no set resolves to is a step that said nothing**, so
  // the next one answers rather than English being reached four times over.
  expect(resolvedTag({ query: "de", host: "ja" })).toBe("ja");
  expect(resolvedTag({ host: "de", header: "ja" })).toBe("ja");
  expect(resolvedTag({ query: "de", cookie: "lang=de", host: "de", header: "de" })).toBe("en");
  // The cookie is read out of a header that carries others beside it.
  expect(resolvedTag({ cookie: "other=1; lang=ja; third=x", host: "en" })).toBe("ja");
});

test("a tag is resolved by BCP 47 lookup at every one of rule 2's steps (rule 6)", () => {
  // `ja-JP` is what a host states and what a browser sends, and it is the
  // papercut this entry exists to close -- at all four steps, because they all
  // carry the same kind of thing.
  expect(resolvedTag({ query: "ja-JP" })).toBe("ja");
  expect(resolvedTag({ cookie: "lang=ja-JP" })).toBe("ja");
  expect(resolvedTag({ host: "ja-JP" })).toBe("ja");
  expect(resolvedTag({ header: "ja-JP" })).toBe("ja");
  // Case folded, which is all BCP 47 says about comparing two tags.
  expect(resolvedTag({ query: "JA-jp" })).toBe("ja");

  // **The singleton step, which is the one that is easy to write backwards**
  // (RFC 4647 section 3.4): truncating `ja-x-private` at its last hyphen leaves
  // `ja-x`, and a trailing single-character subtag is dropped together with the
  // subtag that introduced it rather than looked up as a set.
  expect(resolvedTag({ query: "ja-x-private" })).toBe("ja");
  // The RFC's own worked example's shape -- `zh-Hant-CN-x-private1-private2`
  // reaching `zh` -- written against the one set this tree ships, so the
  // assertion is about the truncation and not about a `zh` set that would have
  // matched at the first step anyway.
  expect(resolvedTag({ query: "ja-Hant-CN-x-private1-private2" })).toBe("ja");
  // English is the last stop and is reachable by name, which is what keeps the
  // switch from being a one-way door (rule 8).
  expect(resolvedTag({ query: "en-GB" })).toBe("en");
  expect(resolvedTag({ query: "en", host: "ja" })).toBe("en");
  // Truncation stops at the primary subtag rather than wrapping to English via
  // some shorter match: `de` is a step saying nothing, not a step saying `en`.
  expect(resolveLanguage(askedWith({ query: "de-CH-1901", host: "ja" })).lang).toBe("ja");
});

test("Accept-Language is read by q, a q of zero is a refusal, and * says nothing (rule 6)", () => {
  // Highest weight first, and not the order the list is written in.
  expect(resolvedTag({ header: "en;q=0.5, ja;q=0.9" })).toBe("ja");
  expect(resolvedTag({ header: "ja;q=0.1, en;q=0.8" })).toBe("en");
  // Absent means 1.
  expect(resolvedTag({ header: "ja, en;q=0.9" })).toBe("ja");
  // **A tie keeps the order the list was written in**, however the parameter
  // name is cased: the tokenizer reads `Q=0.5` as 1 and sorts English first,
  // and a tie broken on its order would be broken by that misreading.
  expect(resolvedTag({ header: "ja;q=0.5, en;Q=0.5" })).toBe("ja");
  expect(resolvedTag({ header: "en;Q=0.5, ja;q=0.5" })).toBe("en");
  // **A q of zero is a refusal and not a low preference**, so `ja` is dropped
  // before lookup runs rather than tried after unsupported German: this header
  // must reach the step below rather than the `ja` set.
  expect(resolvedTag({ header: "de;q=1, ja;q=0" })).toBe("en");
  expect(resolveLanguage(askedWith({ header: "de;q=1, ja;q=0", host: "en" })).lang).toBe("en");
  // **Zero has more than one legal spelling**, and each is a refusal: RFC
  // 9110's `qvalue` allows zero digits after the point, so `q=0.` and `q=0.00`
  // are the same *do not send me this*. Read as unparseable they would fall
  // back to the default weight of 1 and make an explicit refusal the strongest
  // preference in the list, which is this rule failing in the one direction
  // that matters.
  for (const zero of ["0", "0.", "0.0", "0.00", "0.000"]) {
    expect(resolvedTag({ header: `ja;q=${zero}, en;q=0.5` })).toBe("en");
    expect(resolveLanguage(askedWith({ header: `ja;q=${zero}` })).lang).toBe("en");
  }
  // A `1` with the same trailing point is still one, and not a refusal.
  expect(resolvedTag({ header: "ja;q=1., en;q=0.5" })).toBe("ja");
  // And the refusal is of that tag only: a second tag still answers.
  expect(resolvedTag({ header: "ja;q=0, en;q=0.3" })).toBe("en");
  // **`*` is no preference and is skipped**, so a bare one reaches the step
  // below rather than picking a set for the operator.
  expect(resolvedTag({ header: "*" })).toBe("en");
  expect(resolveLanguage(askedWith({ header: "*", host: "ja" })).lang).toBe("ja");
  expect(resolvedTag({ header: "*;q=1, ja;q=0.2" })).toBe("ja");
  // Whitespace and an unparseable weight are not a crash: the header is a
  // browser's and this page is total about what it is handed.
  expect(resolvedTag({ header: "  ja ; q=0.9 , en;q=0.3 " })).toBe("ja");
  // An absent weight really is 1 and not a default below an explicit one, so
  // the bare tag here outranks the weighted one whatever order they are in.
  expect(resolvedTag({ header: "  ja ; q=0.9 , en " })).toBe("en");
  // **A weight that is not a number is a weight that was not given**, and so
  // the tag is offered at 1 rather than dropped: `q=0` is the only refusal in
  // this grammar, and a garbled parameter is not the browser withdrawing a
  // language the operator may well read.
  expect(resolvedTag({ header: "ja;q=x" })).toBe("ja");
  expect(resolvedTag({ header: "" })).toBe("en");
});

/** One `GET`, with headers of our choosing and the redirect left where it is. */
async function get(
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
          const vary = response.headers["vary"];
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

/** The tag one served document declares about itself (rule 7). */
function declaredIn(html: string): string {
  return /<html lang="([^"]*)">/.exec(html)?.[1] ?? "";
}

test("an ill-formed tag resolves to nothing rather than truncating into a set (rule 9)", () => {
  // **The truncation is what makes this the wrong way round if the grammar is
  // not checked first.** `ja-!!` and `ja-` each reach `ja` by cutting at a
  // hyphen, so a syntax error would resolve -- and, being a language the other
  // steps would not have answered, would write rule 5's memory on its way past.
  // Rule 9 says an ill-formed `lang` resolves to nothing and leaves the memory
  // alone, so the step must say nothing and the next one must answer.
  for (const bad of ["ja-!!", "ja-", "-ja", "ja_JP", "j", "日本語", "ja ", "%", ""]) {
    expect(resolvedTag({ query: bad })).toBe("en");
    expect(resolveLanguage(askedWith({ query: bad, cookie: "lang=en" })).lang).toBe("en");
    // The one that would have been a silent switch: an English memory must
    // survive an ill-formed ask that happens to start with a shipped tag.
    expect(resolveLanguage(askedWith({ query: bad, host: "ja" })).lang).toBe("ja");
  }
  // Every step is checked, not just the query: a header or a cookie carrying
  // rubbish says nothing rather than truncating into a set.
  expect(resolveLanguage(askedWith({ cookie: "lang=ja-!!", host: "en" })).lang).toBe("en");
  expect(resolveLanguage(askedWith({ header: "ja-!!", host: "en" })).lang).toBe("en");
  // And what the grammar admits still resolves, so this is a check and not a
  // second, narrower lookup.
  expect(resolvedTag({ query: "ja-JP" })).toBe("ja");
  expect(resolvedTag({ query: "ja-x-private" })).toBe("ja");
  expect(resolvedTag({ query: "zh-Hant" })).toBe("en");
});

test("a cookie that is not a tag is ignored and does not take the server down", async () => {
  // **`decodeURIComponent` throws on `lang=%`**, and `resolveLanguage` runs
  // synchronously in the request callback -- outside the two promise handlers
  // -- so decoding the value would end the process rather than ignore a
  // preference. The cookie jar for `localhost` is shared with whatever else on
  // this machine has served a page, so this header is not rondo's to trust.
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  const { base, stop, served } = await serving(portsOver(world, "ada", null, "ja"));

  for (const cookie of ["lang=%", "lang=%zz", "lang=", "lang", "lang=ja%2DJP", "other=%"]) {
    const answered = await get(base, "/?lang=ja", { cookie });
    expect(answered.status).toBe(200);
    expect(declaredIn(answered.body)).toBe("ja");
  }
  // Still serving, which is the whole of the claim.
  expect((await get(base, "/?lang=ja")).status).toBe(200);

  stop.abort();
  expect(await served).toBe(0);
});

test("the resolution is never silent: one 303 names the set, and a request naming it is served", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  const { base, stop, served } = await serving(portsOver(world, "ada", null, "ja"));

  // **A bare `/` gains one** (rule 4): the operator can read, copy, bookmark
  // and change whatever rondo resolved, which is the whole answer to a header
  // being invisible on the screen it changes.
  const bare = await get(base, "/");
  expect(bare.status).toBe(303);
  expect(bare.location).toBe("/?lang=ja");

  // **`?lang=ja-JP` is canonicalised to the set it actually reached**, and
  // `?lang=de` to whatever the remaining steps answered.
  expect((await get(base, "/?lang=ja-JP")).location).toBe("/?lang=ja");
  expect((await get(base, "/?lang=de")).location).toBe("/?lang=ja");
  // An ill-formed tag is not a refusal: it resolves to nothing and the address
  // is redirected to the tag of the set that answered (rule 9).
  expect((await get(base, "/?lang=!!")).location).toBe("/?lang=ja");

  // **The no-loop property, asserted rather than reasoned about**: the
  // redirect's target is served, because a set's own tag resolves to itself.
  const arrived = await get(base, "/?lang=ja");
  expect(arrived.status).toBe(200);
  expect(arrived.location).toBeNull();
  expect(declaredIn(arrived.body)).toBe("ja");
  // The same for English, in both directions of the switch (rule 8).
  const english = await get(base, "/?lang=en");
  expect(english.status).toBe(200);
  expect(declaredIn(english.body)).toBe("en");

  // The view survives the canonicalisation, so a redirect never costs the
  // operator their place.
  expect((await get(base, "/?reading=open")).location).toBe("/?reading=open&lang=ja");
  expect((await get(base, "/?answer=i-0001")).location).toBe("/?answer=i-0001&lang=ja");

  // **The bytes depend on two request headers now, and a shared cache is
  // entitled to know.**
  expect(arrived.vary).toBe("accept-language, cookie");

  stop.abort();
  expect(await served).toBe(0);
});

test("<html lang> names the set rondo wrote whichever of the four inputs chose it (rule 7)", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  const { base, stop, served } = await serving(portsOver(world, "ada", null, null));

  // The header, which is the input D-0055 refused and this entry takes.
  expect(declaredIn((await get(base, "/?lang=ja", { "accept-language": "ja-JP" })).body)).toBe(
    "ja",
  );
  // The cookie, and the query naming what it resolved to.
  expect(declaredIn((await get(base, "/?lang=ja", { cookie: "lang=ja-JP" })).body)).toBe("ja");
  // **Nothing a request carries can make the document lie**: a browser asking
  // for German gets English and a document saying `en`.
  const german = await get(base, "/", { "accept-language": "de" });
  expect(german.location).toBe("/?lang=en");
  expect(declaredIn((await get(base, "/?lang=en", { "accept-language": "de" })).body)).toBe("en");

  stop.abort();
  expect(await served).toBe(0);
});

test("the memory is one cookie, written by a switch and by nothing else (rule 5)", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  const { base, stop, served } = await serving(portsOver(world, "ada", null, null));

  // **A switch**: this URL asked for a language the remaining steps would not
  // have answered, which is what the link in the chrome produces.
  const switched = await get(base, "/?lang=ja");
  expect(switched.status).toBe(200);
  expect(switched.cookie).toContain("lang=ja");
  // The four attributes rule 5 names, and an expiry in months rather than a
  // session -- a switch answers *what language do you read*, not *this tab*.
  expect(switched.cookie).toContain("Path=/");
  expect(switched.cookie).toContain("SameSite=Strict");
  expect(switched.cookie).toContain("HttpOnly");
  expect(switched.cookie).toMatch(/Max-Age=\d{7,}/);

  // **Not on a response whose language the other steps would have given
  // anyway**: an address arrived at by canonicalisation is not a switch.
  expect((await get(base, "/?lang=ja", { cookie: "lang=ja" })).cookie).toBeNull();
  expect((await get(base, "/?lang=en")).cookie).toBeNull();
  const remembered = await serving(portsOver(world, "ada", null, "ja"));
  expect((await get(remembered.base, "/?lang=ja")).cookie).toBeNull();
  remembered.stop.abort();
  expect(await remembered.served).toBe(0);

  // **`?lang=de` over a remembered `ja` lands on `/?lang=ja` and leaves the
  // memory as it was** -- the case a credential-less redraw would otherwise
  // morph to English five seconds after it rendered. `?lang=!!` does the same.
  for (const asked of ["/?lang=de", "/?lang=!!"]) {
    const over = await get(base, asked, { cookie: "lang=ja" });
    expect(over.status).toBe(303);
    expect(over.location).toBe("/?lang=ja");
    expect(over.cookie).toBeNull();
  }
  // And the switch goes back: `en` is a tag any step may name (rule 8).
  expect((await get(base, "/?lang=en", { cookie: "lang=ja" })).cookie).toContain("lang=en");

  // **htmx's redraw is not a switch**: it is a same-origin XHR that sends and
  // stores cookies, so a tab left on `ja` would otherwise rewrite the memory
  // another tab just switched to `en`, every five seconds.
  for (const poll of [
    { "hx-request": "true" },
    { "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" },
  ]) {
    expect((await get(base, "/?lang=ja", { cookie: "lang=en", ...poll })).cookie).toBeNull();
  }
  expect(
    (
      await get(base, "/?lang=ja", {
        cookie: "lang=en",
        "sec-fetch-mode": "navigate",
      })
    ).cookie,
  ).toContain("lang=ja");

  stop.abort();
  expect(await served).toBe(0);
});

test("every address a ja page composes for itself carries ja (rule 11)", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing", "ja");
  await openGate(world, "i-0001");
  const pressed: Pressed = [];
  const { base, stop, served } = await serving(portsOver(world, "ada", pressed, "ja"));

  const summary = (await get(base, "/?lang=ja")).body;
  const opened = (await get(base, "/?reading=open&lang=ja")).body;
  const answering = (await get(base, "/?answer=i-0001&lang=ja")).body;

  // The fold's link, the answer view's link, and the `<noscript>` refresh.
  expect(summary).toContain('href="/?reading=open&amp;lang=ja"');
  expect(opened).toContain('href="/?lang=ja"');
  expect(summary).toContain('href="/?answer=i-0001&amp;lang=ja"');
  expect(summary).toContain('content="5;url=/?lang=ja"');
  expect(opened).toContain('content="5;url=/?reading=open&amp;lang=ja"');
  // The form's action.
  expect(answering).toContain('action="/?lang=ja"');

  // **And the `303` after a press**, which is the address the operator actually
  // lands back on: a redirect that dropped the tag would re-resolve the page
  // the moment rondo told them something was written.
  const token = tokenIn(answering);
  const answered = await post(base, { token, iteration: "i-0001" }, { origin: base });
  expect(answered.status).toBe(303);
  expect(answered.location).toBe("/?lang=ja#lap-i-0001");
  expect(pressed).toEqual([{ iterationId: "i-0001", body: "approve" }]);

  stop.abort();
  expect(await served).toBe(0);
});

test("the switch is a link in the chrome, one per shipped set other than the one on screen (rule 10)", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  const { base, stop, served } = await serving(portsOver(world, "ada", null, null));

  // **Labelled with that language's own name in its own language**, which is
  // what makes the label the same bytes in every set -- and the link carries
  // the view, so switching never costs the reader their place.
  const english = (await get(base, "/?lang=en")).body;
  expect(english).toContain('<a href="/?lang=ja" lang="ja">日本語</a>');
  expect(english).not.toContain(">English<");

  const japanese = (await get(base, "/?lang=ja")).body;
  expect(japanese).toContain('<a href="/?lang=en" lang="en">English</a>');
  expect(japanese).not.toContain(">日本語<");

  // Beside the fold's link and on every view, because a path the operator
  // cannot find is a safeguard present in the markup and absent in practice.
  const opened = (await get(base, "/?reading=open&lang=en")).body;
  expect(opened).toContain('<a href="/?reading=open&amp;lang=ja" lang="ja">日本語</a>');

  stop.abort();
  expect(await served).toBe(0);
});

test("the resolved set reaches the material port and not only the chrome (rule 12)", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  await openGate(world, "i-0001");
  // The port is handed the set the *request* resolved to, so the fence block's
  // standing sentences follow the page rather than the host it was started on.
  const asked: string[] = [];
  const ports: ServedPorts = {
    ...portsOver(world, "ada", [], "en"),
    material: async (wording) => {
      asked.push(wording.lang);
      return await Promise.resolve(asText(`set     ${wording.lang}`));
    },
  };
  const { base, stop, served } = await serving(ports);

  expect((await get(base, "/?answer=i-0001&lang=ja")).body).toContain("set     ja");
  expect((await get(base, "/?answer=i-0001&lang=en")).body).toContain("set     en");
  expect(asked).toEqual(["ja", "en"]);

  stop.abort();
  expect(await served).toBe(0);
});

test("the bytes a press records depend on neither the query, the cookie nor the header (rule 13)", async () => {
  // D-0055 rule 4's assertion with this entry's three new inputs added to it:
  // one ledger, one wording of one claim, whatever the page read like. Each
  // host reaches `ja` by a *different* one of the three, so what is asserted is
  // the invariant and not one input being ignored.
  const reachedJaBy: Record<string, string>[] = [
    { cookie: "lang=ja" },
    { "accept-language": "ja-JP" },
    {},
  ];
  const worlds = [];
  for (const [at, headers] of reachedJaBy.entries()) {
    const world = await waitingWorld();
    // The third host is the query's: `?lang=ja` with nothing else saying so.
    const { base, stop, served } = await serving(portsOver(world, "ada", [], null));
    const drawn = await get(base, at === 2 ? "/?answer=i-0001&lang=ja" : "/?answer=i-0001", {
      ...headers,
      ...(at === 2 ? {} : { cookie: headers.cookie ?? "" }),
    });
    // Whichever input chose it, the page that was read was Japanese.
    const body =
      drawn.status === 200 ? drawn.body : (await get(base, drawn.location ?? "/", headers)).body;
    expect(declaredIn(body)).toBe("ja");
    expect(
      await recordPagePress(
        {
          store: world.store,
          record: world.record,
          now: () => 6_000,
          present: () => undefined,
        },
        "i-0001",
      ),
    ).toEqual({ ok: true, note: "" });
    stop.abort();
    expect(await served).toBe(0);
    worlds.push(world);
  }

  // One assertion over three hosts: the payload, the digest over it, the
  // snapshot it was drawn from and the presentation counted beside it are the
  // same bytes whichever of rule 2's steps chose the language.
  const first = recorded(worlds[0]?.connection as DatabaseSync);
  for (const world of worlds.slice(1)) {
    expect(recorded(world.connection as DatabaseSync)).toEqual(first);
  }
  // Not vacuously: each press did write.
  for (const world of worlds) {
    expect(rows(world.connection as DatabaseSync, "proposal")).toBe(1);
  }
});

// -- The request threads (D-0061 rule 4, D-0059 section 5a's send, #220 S1) --

/** The ids a composer would carry, minted in the shape the server mints them. */
const MINTED = {
  request: "request-00000000-0000-4000-8000-000000000001",
  reply: "reply-00000000-0000-4000-8000-000000000002",
} as const;
const mint = (kind: "request" | "reply"): string => MINTED[kind];

/** The text a browser reads out of an escaped element body. */
const unescaped = (html: string): string =>
  html
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&");

const ROOT_BODY =
  "Please look at the flaky test.\n\n  It fails <b>one run in five</b> & only on CI.\n";
const ASK_BODY = "Which runner should I read first?\n\nThe Linux one has the most failures.";
const LATER_BODY = "noted";

/** A request by `ada`, a drafter's asking reply resting on three locators, and a report that asks nothing. */
async function seedThread(world: ReturnType<typeof fresh>): Promise<void> {
  await reserve(world, "i-0001", "do the thing");
  const drafts = [
    {
      messageId: "request-a",
      body: ROOT_BODY,
      authorKind: "operator",
      authorId: "ada",
      inReplyTo: null,
      atMs: 1_000,
      bases: [],
      asks: false,
    },
    {
      messageId: "ask-b",
      body: ASK_BODY,
      authorKind: "drafter",
      authorId: "rondo-drafter",
      inReplyTo: "request-a",
      atMs: 2_000,
      bases: [
        { form: "message", messageId: "request-a" },
        { form: "iteration", iterationId: "i-0001" },
        { form: "continuoRun", runId: "rondo-i-0001" },
      ],
      asks: true,
    },
    {
      messageId: "report-c",
      body: LATER_BODY,
      authorKind: "drafter",
      authorId: "rondo-drafter",
      inReplyTo: "request-a",
      atMs: 3_000,
      bases: [{ form: "iteration", iterationId: "i-0001" }],
      asks: false,
    },
  ] as const;
  for (const draft of drafts) {
    const outcome = await world.record.recordThreadMessage(draft);
    expect(outcome.kind, JSON.stringify(outcome)).toBe("recorded");
  }
}

/** Every message body the page drew, as a browser reads it. */
const bodiesIn = (html: string): readonly string[] =>
  [...html.matchAll(/<p class="body [^"]*" lang="">([\s\S]*?)<\/p>/g)].map((found) =>
    unescaped(found[1] ?? ""),
  );

/** One message's `<li>`, by its id. */
const messageIn = (html: string, id: string): string =>
  /<li id="[^"]*"[\s\S]*?<\/li>/.exec(html.slice(html.indexOf(`<li id="${id}"`)))?.[0] ?? "";

test("a request thread is drawn whole: every body byte for byte, voices apart, bases as links, the ask marked", async () => {
  const world = fresh();
  await seedThread(world);
  const html = await operatorPage(
    portsOver(world, "ada", []),
    "t",
    { kind: "thread", messageId: "report-c", to: null },
    EN,
    mint,
  );

  // **The words as written, in order, with their paragraphs and their spaces**
  // (D-0061 rule 2.2, rondo#90), and a `<b>` in them is text.
  expect(bodiesIn(html)).toEqual([ROOT_BODY, ASK_BODY, LATER_BODY]);
  expect(html).not.toContain("<b>one run");

  // **Two voices, told apart by more than the prose** (rule 2.3): a badge on
  // the drafter's, and "you" on the person's own.
  const root = messageIn(html, "request-a");
  const ask = messageIn(html, "ask-b");
  const report = messageIn(html, "report-c");
  expect(root).toContain('data-voice="operator"');
  expect(root).toContain(">you</span>");
  expect(ask).toContain('data-voice="drafter"');
  expect(ask).toContain(">drafter</span>");

  // **The ask that waits is marked, and only it** (rule 2.7): nothing replies to it.
  expect(ask).toContain("data-waiting");
  expect(ask).toContain("Waiting on you");
  expect(root).not.toContain("data-waiting");
  expect(report).not.toContain("data-waiting");

  // **Bases are chips that go where they point, never an id to copy**: the
  // cited message by its words and an anchor, the lap by its reading section;
  // a form this page has no view for is said and not linked.
  expect(ask).toContain('href="#request-a"');
  expect(ask).toContain("you: Please look at the flaky test.");
  expect(ask).toContain('href="/?reading=open&amp;lang=en#read-i-0001"');
  expect(ask).toMatch(/<span class="basis [^"]*" title="continuo run rondo-i-0001">/);
  // A report replies to the request, which is how every reply reads by
  // default, so it names no parent line of its own.
  expect(report).not.toContain("in reply to");
  // **A waiting ask is answered on the page** (#220 S1): its own link aims the
  // box at it, labelled as answering, and nothing sends the person to a terminal.
  expect(ask).toContain('id="reply-ask-b"');
  expect(ask).toContain(">Answer</a>");
  expect(html).not.toContain("rondo reply");

  // **No message id is printed as text**: each is an anchor and an attribute.
  for (const id of ["request-a", "ask-b", "report-c"]) {
    expect(html).not.toContain(`>${id}<`);
  }

  // **The box answers the waiting question by default, on a press**: a native
  // `POST` to `/answer-ask` with no `hx-post` (D-0059 section 5a's falsifier,
  // D-0069 rule 5), a filled Answer button, and a target line of who and when.
  // It carries the id rondo minted -- once, hidden, never shown -- and sits
  // outside the ledger the redraw swaps, so no redraw touches a draft.
  expect(html).toContain('<form id="composer" method="post" action="/answer-ask?lang=en" class=');
  expect(html).not.toContain("hx-post");
  expect(html).toContain('<input type="hidden" name="in_reply_to" value="ask-b"/>');
  expect(html.split(MINTED.reply)).toHaveLength(2);
  expect(html).toContain(`<input type="hidden" name="message_id" value="${MINTED.reply}"/>`);
  expect(html).toMatch(/Answering rondo-drafter's question, \d+s ago/);
  expect(html).toMatch(/<button type="submit" class="[^"]*bg-wait[^"]*">[\s\S]*?Answer<\/button>/);
  expect(html).not.toContain('class="not-answer');
  const ledgerAt = html.indexOf('<div id="ledger"');
  const composerAt = html.indexOf('<form id="composer"');
  const between = html.slice(ledgerAt, composerAt);
  expect((between.match(/<div[\s>]/g) ?? []).length).toBe((between.match(/<\/div>/g) ?? []).length);
  // Every message carries its own way to be replied to, which retargets the box.
  expect(report).toContain('href="/?thread=request-a&amp;to=report-c&amp;lang=en"');
  // The thread polls, but with script off it does not reload a draft away.
  expect(html).toContain('hx-get="/?thread=report-c&amp;lang=en"');
  expect(html).not.toContain('http-equiv="refresh"');
});

test("the reply box points at the message a person chose, and a thread nobody wrote is said", async () => {
  const world = fresh();
  await seedThread(world);
  const ports = portsOver(world, "ada", []);
  const chosen = await operatorPage(
    ports,
    "t",
    { kind: "thread", messageId: "request-a", to: "report-c" },
    EN,
    mint,
  );
  expect(chosen).toContain('<input type="hidden" name="in_reply_to" value="report-c"/>');
  expect(chosen).toContain("autofocus");
  // Pointed elsewhere, it is a send, and it says it does not answer the question.
  expect(chosen).toContain('action="/reply?lang=en" hx-post="/reply?lang=en"');
  expect(chosen).toContain("Replying to rondo-drafter, ");
  expect(chosen).toContain('class="not-answer');
  expect(chosen).toContain("does not answer the question waiting in this thread");
  const nowhere = await operatorPage(
    ports,
    "t",
    { kind: "thread", messageId: "no-such", to: null },
    EN,
    mint,
  );
  expect(nowhere).toContain("No request thread holds that message.");
  expect(nowhere).not.toContain('id="composer"');
});

test("with no approver the threads are read and never written: no form, and the reason said", async () => {
  const world = fresh();
  await seedThread(world);
  const ports = portsOver(world, null);
  for (const view of [
    { kind: "thread", messageId: "request-a", to: null },
    { kind: "requests" },
  ] as const) {
    // No token and no minter: the server hands neither without a say port.
    const html = await operatorPage(ports, null, view, EN, null);
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<textarea");
    expect(html).toContain("RONDO_APPROVER is not set, so there is nobody this page could send as");
    expect(bodiesIn(html).length > 0 || html.includes("Please look at the flaky test.")).toBe(true);
    expect(html).not.toContain(">Reply</a>");
  }
});

test("the summary counts an ask waiting on the person and leads to the reply, and the requests list reads at a glance", async () => {
  const world = fresh();
  await seedThread(world);
  const ports = portsOver(world, "ada", []);

  const summary = await operatorPage(ports, "t", { kind: "summary" }, EN, mint);
  expect(summary).toContain("waiting for your answer (1)");
  expect(summary).toContain('<li id="ask-ask-b"');
  expect(summary).toContain('href="/?thread=request-a&amp;to=ask-b&amp;lang=en#ask-b"');
  expect(summary).toContain("asked in: Please look at the flaky test.");
  // The header's way in, on every view, with the count the redraw renews.
  expect(summary).toContain('href="/?requests=open&amp;lang=en"');
  // One count, the summary heading's own, beside it (#220 S1).
  expect(summary).toMatch(
    /<span id="waiting-count" class="empty:hidden"><a href="\/\?lang=en" [^>]*>1 waiting<\/a>/,
  );
  // The summary draws no composer.
  expect(summary).not.toContain('id="composer"');

  const requests = await operatorPage(ports, "t", { kind: "requests" }, EN, mint);
  expect(requests).toContain("requests (1)");
  expect(requests).toContain("1 question waiting on you");
  expect(requests).toContain('href="/?thread=request-a&amp;lang=en" data-open=""');
  expect(requests).toContain("3 messages, last 2s ago");
  // **A new request is a native submit**: where it lands is its own thread, a
  // different view, so it is not swapped into this one.
  expect(requests).toContain('<form id="composer" method="post" action="/request?lang=en" class=');
  expect(requests).not.toContain("hx-post");
  expect(requests).toContain(`value="${MINTED.request}"`);
  expect(requests).not.toContain('name="in_reply_to"');
});

test("the threads speak Japanese where the page does, tokens and words untouched", async () => {
  const world = fresh();
  await seedThread(world);
  const html = await operatorPage(
    portsOver(world, "ada", []),
    "t",
    { kind: "thread", messageId: "request-a", to: null },
    chromeFor("ja"),
    mint,
  );
  expect(html).toContain(">下書き役</span>");
  expect(html).toContain(">あなた</span>");
  expect(html).toContain("あなたの回答待ち");
  expect(html).toContain("rondo-drafter の質問に回答 · ");
  expect(html).toContain(">回答する</button>");
  expect(html).toContain('action="/answer-ask?lang=ja"');
  expect(bodiesIn(html)).toEqual([ROOT_BODY, ASK_BODY, LATER_BODY]);
});

/** `page/composer.js` with its commentary removed, so a claim is read off code. */
const composerCode = (): string =>
  bytesOf("page/composer.js")
    .toString("utf8")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");

test("the composer script keeps a draft and the open folds, and makes no request of its own", async () => {
  const code = composerCode();
  // Its two duties, by what they touch (D-0059 section 5a).
  expect(code).toContain('"textarea[data-draft]"');
  expect(code).toContain("sessionStorage");
  expect(code).toContain("HTMLDetailsElement");
  // Ctrl/Cmd+Enter asks the form for the submit its own button makes.
  expect(code).toContain("requestSubmit()");
  for (const forbidden of [
    "fetch",
    "POST",
    "XMLHttpRequest",
    "EventSource",
    "WebSocket",
    "sendBeacon",
    "FormData",
    "localStorage",
    "eval",
    "innerHTML",
    "document.write",
    "location.href =",
    "htmx.",
    ".submit()",
  ]) {
    expect(code).not.toContain(forbidden);
  }
  // The two htmx events it hears are a send's start, where it notes the words
  // sent, and its end, where it clears only those from the draft.
  expect([...code.matchAll(/htmx:[A-Za-z]+/g)].map((found) => found[0])).toEqual([
    "htmx:beforeRequest",
    "htmx:afterRequest",
  ]);
  // A refusal with no `#send-refused` (csrf, Host, a defect) still says "not sent", as text.
  expect(code).toContain("note.textContent = note.dataset.refused");
  // And keys.js no longer keeps folds: one place does.
  expect(keysCode()).not.toContain("toggle");

  const world = fresh();
  const { base, stop, served } = await serving(portsOver(world));
  const served_ = await fetch(`${base}/composer.js`);
  expect(served_.status).toBe(200);
  expect(digestOf(Buffer.from(await served_.arrayBuffer()))).toBe(
    digestOf(bytesOf("page/composer.js")),
  );
  stop.abort();
  expect(await served).toBe(0);
});

// -- The gate reading (#220 S2) --

const EVIDENCE = {
  baseRef: "origin/main",
  baseCommit: "a".repeat(40),
  tipCommit: "b".repeat(40),
  materialDigest: "sha256:x",
  commitCount: 2,
  fileCount: 1,
};

/** A lap at its gate with the deterministic reading carried by its transition. */
async function gateWithChecks(world: ReturnType<typeof fresh>): Promise<void> {
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

const structured = async () =>
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

test("the answer view draws both readings side by side from the rows, with the warning by approve (#220 S2)", async () => {
  const world = fresh();
  await gateWithChecks(world);
  const appended = await world.store.appendReading(
    "i-0001",
    {
      drafter: "rondo/model/1/gpt-6-astra",
      verdict: "concerns",
      findings: ["the loop never stops", "the backoff is not capped", "a typo"],
      graded: [
        {
          severity: "blocker",
          bases: [{ kind: "file", path: "src/notifier.ts", line: 41 }],
          basisResolved: true,
        },
        {
          severity: "major",
          bases: [{ kind: "rule", path: "AGENTS.md", line: 12 }],
          basisResolved: false,
        },
        { severity: "nit", bases: [], basisResolved: false },
      ],
      evidence: EVIDENCE,
      unavailableReason: null,
    },
    4_000,
  );
  expect(appended.kind).toBe("appended");
  const html = await operatorPage({ ...portsOver(world, "ada", []), material: structured }, "t", {
    kind: "answer",
    iterationId: "i-0001",
  });

  // The two cards, the checks' finding and the model's graded findings.
  expect(html).toContain('id="checks"');
  expect(html).toContain('id="model-review"');
  expect(html).toMatch(/class="grid items-start gap-3 lg:grid-cols-2"><section id="checks"/);
  expect(html).toContain("a binary file was not read");
  expect(html).toMatch(/severity[^"]*">blocker<\/span><span[^>]*>the loop never stops/);
  expect(html).toMatch(/severity[^"]*">major<\/span>/);
  expect(html).toContain(">src/notifier.ts:41</code>");
  expect(html).toContain(">rule AGENTS.md:12</code>");
  expect(html).toContain("none of these matched the delivered work");
  expect(html).toContain("no basis given");
  expect(html).toContain(">gpt-6-astra</span>");
  // What changed, as rows, and the worker's own words.
  expect(html).toContain("feat: retry budget");
  expect(html).toContain(">+64</span>");
  expect(html).toContain("I could not run the suite.");
  // No recommendation anywhere on the gate.
  expect(html.toLowerCase()).not.toContain("recommend");

  // The warning is inside the bar, before the button, and links to the card.
  // **The bar and not the form** since rondo#233 S4 put the gate's second
  // answer beside the first: two forms cannot nest, so what sticks to the
  // bottom of the window is the `div` around them.
  const bar = html.slice(html.indexOf('id="answer-bar"'));
  const form = html.slice(html.indexOf('<form id="approve-form"'), html.indexOf("</form>"));
  expect(bar).toContain("The model review raised 1 blocker and 1 major.");
  expect(bar.indexOf('id="model-raised"')).toBeLessThan(bar.indexOf('type="submit"'));
  expect(bar).toContain('<a href="#model-review"');
  // The claim box rides the press, keyed per gate, and is not cut by the browser.
  expect(form).toMatch(/<textarea name="verified" rows="1" data-draft="claim:i-0001:gate-i-0001"/);
  expect(form).not.toContain("maxlength");
  // Not due: this model reading carries the checks' tip.
  expect(html).not.toContain("may still arrive");
  // Both verdicts pinned in the bar, the model's worst finding first in its pill
  // (the S2 design pass), and what the press records folded shut by default.
  expect(bar).toContain('id="bar-readings"');
  expect(bar).toContain(">1 blocker · 1 major · 1 nit</span>");
  expect(html).toMatch(
    /<details id="records" class="group[^"]*"><summary[^>]*>[\s\S]*?What approve records \(\d+ fields\)/,
  );

  // The full text is still in the document, in its fold.
  expect(html).toMatch(/<details id="material-text"[\s\S]*fence {3}the whole text/);
});

/** The model reading the S4 tests draft from: one blocker and one major, with bases. */
async function modelFindings(world: ReturnType<typeof fresh>): Promise<void> {
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

test("the gate offers a change beside approve, drafted from the findings and editable (#233 S4)", async () => {
  const world = fresh();
  await gateWithChecks(world);
  await modelFindings(world);
  const html = await operatorPage(
    { ...portsOver(world, "ada", [], null, "decision-1"), material: structured },
    "t",
    { kind: "answer", iterationId: "i-0001" },
    EN,
    null,
    null,
    () => "lap-00000000-0000-4000-8000-000000000001",
  );
  const bar = html.slice(html.indexOf('id="answer-bar"'));

  // **Two answers in one bar, and two forms**: approve posts to the summary's
  // address as it always did, the change posts to its own route.
  expect(bar).toContain('<form id="approve-form" method="post" action="/?lang=en"');
  expect(bar).toContain('<form id="revise-form" method="post" action="/revise?lang=en"');
  expect(bar).toContain("Ask for a change instead");
  expect(bar).toContain(">Ask for a change</button>");
  // Every id the press carries is rondo's, and none of them is typed.
  expect(bar).toContain('<input type="hidden" name="iteration" value="i-0001"/>');
  expect(bar).toContain('<input type="hidden" name="scope_decision" value="decision-1"/>');
  expect(bar).toContain(
    '<input type="hidden" name="successor" value="lap-00000000-0000-4000-8000-000000000001"/>',
  );
  // **rondo's draft is the field's content, and it quotes the findings with
  // their severities and bases** (D-0065 rule 5.3): a placeholder is not sent,
  // and the words are the reviewer's own.
  const opened = bar.indexOf('<textarea name="body"');
  const box = bar.slice(opened, bar.indexOf("</textarea>", opened));
  expect(box).toContain("Please fix what the model review raised:");
  expect(box).toContain("- [blocker] the loop never stops");
  expect(box).toContain("where: src/notifier.ts:41");
  expect(box).toContain("- [major] the backoff is not capped");
  expect(box).toContain("where: rule AGENTS.md:12");
  expect(box).toContain('data-draft="revise:i-0001:gate-i-0001"');
  expect(box).not.toContain("maxlength");
  // The change is offered, and approve is not qualified by it: the same button
  // with the same word, whatever the model raised (D-0065 as annotated).
  expect(bar).toContain(">approve</button>");
  expect(bar).not.toContain('id="revise-none"');
});

test("a lap admitted under no approval is told so where the change would be (#233 S4)", async () => {
  const world = fresh();
  await gateWithChecks(world);
  await modelFindings(world);
  const html = await operatorPage(
    { ...portsOver(world, "ada", []), material: structured },
    "t",
    { kind: "answer", iterationId: "i-0001" },
    EN,
    null,
    null,
    () => "lap-00000000-0000-4000-8000-000000000002",
  );
  expect(html).toContain('id="revise-none"');
  expect(html).toContain("has no budget to be counted against");
  expect(html).not.toContain('id="revise-form"');
  // Approving is untouched by the absence of the other answer.
  expect(html).toContain(">approve</button>");
});

test("with no minted lap id there is no change form at all (#233 S4)", async () => {
  const world = fresh();
  await gateWithChecks(world);
  await modelFindings(world);
  const html = await operatorPage(
    { ...portsOver(world, "ada", [], null, "decision-1"), material: structured },
    "t",
    { kind: "answer", iterationId: "i-0001" },
  );
  expect(html).not.toContain('id="revise-form"');
  expect(html).not.toContain('id="revise-none"');
});

test("a gate with no model findings drafts nothing, and still offers the change (#233 S4)", async () => {
  const world = fresh();
  await gateWithChecks(world);
  const appended = await world.store.appendReading(
    "i-0001",
    {
      drafter: "rondo/model/1/gpt-6-astra",
      verdict: "clear",
      findings: [],
      graded: [],
      evidence: EVIDENCE,
      unavailableReason: null,
    },
    4_000,
  );
  expect(appended.kind).toBe("appended");
  const html = await operatorPage(
    { ...portsOver(world, "ada", [], null, "decision-1"), material: structured },
    "t",
    { kind: "answer", iterationId: "i-0001" },
    EN,
    null,
    null,
    () => "lap-00000000-0000-4000-8000-000000000003",
  );
  const bar = html.slice(html.indexOf('id="answer-bar"'));
  expect(bar).toContain('id="revise-form"');
  // An empty box with its example, and no lead line about findings there are none of.
  expect(bar).toMatch(/<textarea name="body"[^>]*><\/textarea>/);
  expect(bar).not.toContain("Please fix what the model review raised:");
  expect(bar).toContain("keep the change to the parser");
});

test("the change is offered in the page's language, and the findings stay the reviewer's words (#233 S4)", async () => {
  const world = fresh();
  await gateWithChecks(world);
  await modelFindings(world);
  const html = await operatorPage(
    { ...portsOver(world, "ada", [], null, "decision-1"), material: structured },
    "t",
    { kind: "answer", iterationId: "i-0001" },
    chromeFor("ja"),
    null,
    null,
    () => "lap-00000000-0000-4000-8000-000000000004",
  );
  const bar = html.slice(html.indexOf('id="answer-bar"'));
  expect(bar).toContain("承認せずに変更を依頼する");
  expect(bar).toContain(">変更を依頼する</button>");
  expect(bar).toContain("モデルレビューが挙げた点を直してください:");
  // Quoted, not translated (D-0055 rule 4): the finding and its basis as given.
  expect(bar).toContain("- [blocker] the loop never stops");
  expect(bar).toContain("場所: src/notifier.ts:41");
});

test("a model reading not yet taken is said as pending, beside the checks and by the button (#220 S2)", async () => {
  const world = fresh();
  await gateWithChecks(world);
  const html = await operatorPage({ ...portsOver(world, "ada", []), material: structured }, "t", {
    kind: "answer",
    iterationId: "i-0001",
  });
  expect(html).toContain("Not here yet; it may still arrive.");
  expect(html).not.toContain("reading it first");
  expect(html).toContain('href="/?answer=i-0001&amp;lang=en" class="font-medium text-link');
  expect(html).toContain("The model review may still arrive.");
  expect(html).not.toContain('id="model-raised"');
});

test("an unavailable model reading of these commits is its outcome, not a pending one (#220 S2)", async () => {
  const world = fresh();
  await gateWithChecks(world);
  const appended = await world.store.appendReading(
    "i-0001",
    {
      drafter: "rondo/model/1/gpt-6-astra",
      verdict: "unavailable",
      findings: [],
      evidence: null,
      unavailableReason: "the plan names no review criterion",
    },
    4_000,
  );
  expect(appended.kind).toBe("appended");
  const html = await operatorPage({ ...portsOver(world, "ada", []), material: structured }, "t", {
    kind: "answer",
    iterationId: "i-0001",
  });
  expect(html).toContain("the plan names no review criterion");
  expect(html).toContain("No reading could be taken, so there is nothing from it to weigh.");
  expect(html).toContain("Only the checks read this; the model review was not taken.");
  expect(html).not.toContain("may still arrive");
  expect(html).not.toContain("earlier commits");
  // **And when the checks could not read it either, the bar does not say they
  // did** (#220 S2, Codex).
  // The deterministic reading lands with a transition (D-0029 rule 8).
  const checksGone = await world.store.transition(
    "i-0001",
    "awaiting_human",
    "awaiting_human",
    {},
    5_000,
    {
      drafter: "rondo/deterministic/2",
      verdict: "unavailable",
      findings: [],
      evidence: null,
      unavailableReason: "the workspace could not be read",
    },
  );
  expect(checksGone.kind).toBe("transitioned");
  const neither = await operatorPage(
    { ...portsOver(world, "ada", []), material: structured },
    "t",
    { kind: "answer", iterationId: "i-0001" },
  );
  expect(neither).toContain("Neither the checks nor the model review could read this work.");
  expect(neither).not.toContain("Only the checks read this");
});

test("an approved lap's row says back the claim its press carried (#220 S2 design pass)", async () => {
  const world = fresh();
  await gateWithChecks(world);
  await world.store.recordVerificationClaim("i-0001", "ada", "ran npm test", 4_000);
  const closed = await world.store.transition(
    "i-0001",
    "awaiting_human",
    "closed",
    { gateOutcome: "approve" },
    5_000,
  );
  expect(closed.kind).toBe("transitioned");
  const html = await operatorPage(portsOver(world, "ada", []), "t", { kind: "summary" });
  expect(html).toContain("you said you checked: ran npm test");
  // Another operator's claim is theirs, never "you" (#220 S2, Codex).
  const other = await operatorPage(portsOver(world, "grace", []), "t", { kind: "summary" });
  expect(other).toContain("ada said they checked: ran npm test");
  expect(other).not.toContain("you said you checked");
});

test("what the fence blocked is on the gate, each call in words, not only in the text fold (#220 S2)", async () => {
  const world = fresh();
  await gateWithChecks(world);
  const html = await operatorPage({ ...portsOver(world, "ada", []), material: structured }, "t", {
    kind: "answer",
    iterationId: "i-0001",
  });
  const card = html.slice(html.indexOf('<section id="fence"'), html.indexOf('id="material-text"'));
  expect(card).toContain("The fence:");
  expect(card).toContain("blocked 1 command");
  expect(card).toContain("Bash  &quot;rm -rf /srv&quot;");
  expect(html).toContain("The full record as text, including what is not shown above");
});

test("no approver, no claim box; the summary row says its facts plainly and keeps the raw ones (#220 S2)", async () => {
  const world = fresh();
  await gateWithChecks(world);
  const bare = await operatorPage(portsOver(world, null), null, {
    kind: "answer",
    iterationId: "i-0001",
  });
  expect(bare).not.toContain('name="verified"');
  expect(bare).not.toContain("<form");

  const html = await operatorPage(portsOver(world, "ada", []), "t");
  expect(lead(html)).toContain(">blocked 1 command</span>");
  expect(lead(html)).not.toContain(">the fence refused");
  expect(lead(html)).not.toContain(">answer gate gate-i-0001");
  // The facts are still in the document, as titles.
  expect(lead(html)).toContain('title="the fence refused [{&quot;tool_name&quot;');
  expect(lead(html)).toContain("answer gate gate-i-0001");
});

test("an unreadable row links to its reason in the reading instead of naming a command (#220 S2)", async () => {
  const world = fresh();
  await reserve(world, "i-0002", "a row whose plan was corrupted");
  world.connection
    .prepare("UPDATE iteration SET plan = ? WHERE id = ?")
    .run('{"not":"a plan"}', "i-0002");
  const html = await operatorPage(portsOver(world, "ada", []), "t");
  expect(lead(html)).not.toContain("rondo explain");
  expect(lead(html)).toContain('href="/?reading=open&amp;lang=en#read-i-0002-reason"');
  expect(lead(html)).toContain(">Read what went wrong</a>");
  const read = await operatorPage(portsOver(world, "ada", []), "t", { kind: "reading" });
  expect(read).toContain('<pre id="read-i-0002-reason"');

  const ja = await operatorPage(
    portsOver(world, "ada", []),
    "t",
    { kind: "summary" },
    chromeFor("ja"),
  );
  expect(ja).toContain(">何が起きたかを読む</a>");
});

// -- The scope screen (rondo#233 S3, D-0066 rule 1) --

/**
 * A real, cadenza-valid agent type. `PLAN.agentTypeInput` above is `{}`
 * (no test on that fixture's path ever built a record from it), but the scope
 * screen calls `agentTypeRecordOf` on every render and cadenza refuses `{}`.
 */
const SCOPE_AGENT_TYPE_INPUT = {
  agentTypeId: "worker-basic",
  vocabularyVersion: 1,
  granted: ["command.run"],
  askable: ["branch.push"],
  loopPolicy: { maxReviewRounds: 2, noProgressWindow: 3, noProgressRepeat: 2 },
  executorPolicy: { roleName: "worker", modelTier: "standard", reportingDuties: [] },
};

const SCOPE_PLAN: RunPlan = {
  ...PLAN,
  agentTypeInput: SCOPE_AGENT_TYPE_INPUT as unknown as RunPlan["agentTypeInput"],
  parties: { issuer: "rondo-host", grantee: "unset" } as unknown as RunPlan["parties"],
  intendedAction: { capabilities: ["command.run"] } as unknown as RunPlan["intendedAction"],
};

/** The plan document `RONDO_PLAN` would name, as `scopeDraftingFromPlan` reads it. */
function scopePlanDocument(): JsonRecord {
  const validated = runPlan(SCOPE_PLAN);
  if (validated.kind !== "planned") {
    throw new Error(`the scope fixture plan is not valid: ${validated.reason}`);
  }
  const allocation = allocate("scope-plan-fixture", SCOPE_PLAN.workspaceRoot);
  if (allocation.kind !== "allocated") {
    throw new Error(`the scope fixture id does not allocate: ${allocation.reason}`);
  }
  const admitted = admittedPlan(validated.plan, allocation.allocation);
  if (admitted.kind !== "planned") {
    throw new Error(`the scope fixture allocation is not valid: ${admitted.reason}`);
  }
  return planPayload(admitted.plan);
}

/**
 * `RONDO_PLAN`, written to a real file (`scopeDraftingFromPlan` reads a path,
 * never a document), plus the two digests the screen will draft with -- read
 * the same way `scopeDraftingFromPlan` does, so a fixture and the render it
 * feeds can never silently diverge.
 */
function scopePlanFile(dir: string): { file: string; agentTypeDigest: string; planDigest: string } {
  const document = scopePlanDocument();
  const file = join(dir, "plan.json");
  writeFileSync(file, JSON.stringify(document), "utf8");
  const planned = readRunPlan(document);
  if (planned.kind !== "planned") {
    throw new Error(`the scope fixture document does not read back: ${planned.reason}`);
  }
  const recorded = agentTypeRecordOf(planned.plan, document);
  if ("refusal" in recorded) {
    throw new Error(`the scope fixture agent type builds no record: ${recorded.refusal}`);
  }
  return {
    file,
    agentTypeDigest: recorded.record.agentTypeDigest,
    planDigest: contentDigest(document),
  };
}

/** `WebPorts.plan`, over one file on disk (rondo#233 S3). */
function planPortOver(file: string, record: ReturnType<typeof fresh>["record"]): ScopeDrafting {
  return async (wording) => await scopeDraftingFromPlan(file, record, wording);
}

/** A request message that opens a thread, for the scope screen to draft over. */
async function seedScopeRequest(
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

/**
 * A closed lap with a cost and a duration, for `scopeBudgetsFromStore`'s
 * `rows` bases (D-0071 rule 4.2). `store.reserve` has no verb for "a worker
 * reported this cost" -- those three columns are read off a real transcript at
 * a suspend -- so they are set with SQL after the row exists, exactly as
 * `test/store/scope-record.test.ts` already does for the same reading.
 */
async function seedEndedLap(
  world: ReturnType<typeof fresh>,
  id: string,
  opts: {
    agentTypeDigest: string;
    costUsd: number;
    durationMs: number;
    supersedesIterationId?: string | null;
  },
): Promise<void> {
  const outcome = await world.store.reserve({
    id,
    request: "seeded for the scope screen's budgets",
    // The plan `heldAgentType`'s "iteration" source rebuilds `agentTypeInput`
    // from, when no `agent_type_record` row holds the digest -- it must be
    // {@link SCOPE_AGENT_TYPE_INPUT}'s plan, or the digest column and the
    // input the record rebuilds from disagree (rondo#233 S3).
    plan: scopePlanDocument(),
    spend: null,
    scopeSpend: null,
    nowMs: 1_000,
    supersedesIterationId: opts.supersedesIterationId ?? null,
    requestMessageId: null,
    runId: `rondo-${id}`,
    topicBranch: `rondo/${id}`,
    workspace: `/srv/work/${id}`,
  });
  if (outcome.kind !== "reserved") {
    throw new Error(`the scope fixture did not reserve '${id}': ${JSON.stringify(outcome)}`);
  }
  world.connection
    .prepare(
      "UPDATE iteration SET status = 'closed', lap_cost_usd = ?, lap_duration_ms = ?, " +
        "agent_type_digest = ? WHERE id = ?",
    )
    .run(opts.costUsd, opts.durationMs, opts.agentTypeDigest, id);
}

test("the scope screen drafts a form pre-filled from the request and the plan, every budget's formula and bases shown, the defaults marked as defaults", async () => {
  const world = fresh();
  await seedScopeRequest(world, "request-scope-1", "Fix the flaky test, please.");
  const dir = mkdtempSync(join(tmpdir(), "rondo-scope-"));
  const { file: planFile, agentTypeDigest, planDigest } = scopePlanFile(dir);
  await seedEndedLap(world, "i-scope-1", { agentTypeDigest, costUsd: 1.2, durationMs: 6 * 60_000 });
  await seedEndedLap(world, "i-scope-2", {
    agentTypeDigest,
    costUsd: 3.4,
    durationMs: 9 * 60_000,
    supersedesIterationId: "i-scope-1",
  });

  const ports = { ...portsOver(world, "ada", []), plan: planPortOver(planFile, world.record) };
  const html = await operatorPage(
    ports,
    "t",
    { kind: "scope", messageId: "request-scope-1", rounds: null, decisionId: null },
    EN,
    mint,
    () => "MINT-SCOPE-1",
    () => "MINT-LAP-1",
  );

  // Pre-filled from the seeded request and the plan (rondo#233 S3): the
  // request's own words, its id carried hidden, the plan's two digests and its
  // workspace, and the agent type's grants read back from the held record.
  expect(html).toContain("Fix the flaky test, please.");
  expect(html).toContain('<input type="hidden" name="request" value="request-scope-1"/>');
  expect(html).toContain('<input type="hidden" name="scope_id" value="MINT-SCOPE-1"/>');
  expect(html).toContain(`agent type ${agentTypeDigest}`);
  expect(html).toContain(`plan ${planDigest}`);
  expect(html).toContain(`${SCOPE_PLAN.repository} at ${SCOPE_PLAN.workspaceRoot}`);
  expect(html).toContain("tier standard, granted command.run");

  // Every budget's formula, and its bases folded but present.
  expect(html).toContain("how: plans x review rounds = 1 x 3");
  expect(html).toContain("where this came from");
  // A `rows` basis's laps are links into their answer view, never bare text.
  expect(html).toContain('href="/?answer=i-scope-1&amp;lang=en"');
  expect(html).toContain('href="/?answer=i-scope-2&amp;lang=en"');
  expect(html).not.toContain(">i-scope-1<");
  expect(html).not.toContain(">i-scope-2<");

  // The deterministic defaults, marked as defaults and not derived from the
  // request (rondo#233 S3 -- `severity_threshold`, `outward_acts` and
  // `irreversible_additions` are none of them editable here).
  expect(html).toMatch(/<option value="major"[^>]*selected/);
  expect(html).not.toContain("checked=");
  expect(html).toContain("No act is added to the irreversible list.");
  expect(html).toContain("A default, not derived from your request.");

  // **What the screen cannot check, said** (rondo#233 S3 screen review): there
  // is no listing of a request's scopes, so a blank draft is not evidence
  // there is no approval already.
  expect(html).toContain("rondo cannot tell from here whether you have already approved a scope");
  // **The card says which plan, and the digests are folded**: three
  // 71-character hashes as plain text were a third of the first screenful at
  // 420px, and there is nothing a person does with one.
  expect(html).toContain("The plan rondo will run, and where it will run it");
  expect(html).toContain("The digests rondo will record");
  expect(html.indexOf("The digests rondo will record")).toBeLessThan(
    html.indexOf(`plan ${planDigest}`),
  );
  // The two digests it was drawn from ride along, for the write to compare its
  // own re-read against -- never as a second authority for what is recorded.
  expect(html).toContain(`<input type="hidden" name="plan_digest" value="${planDigest}"/>`);
  expect(html).toContain(`<input type="hidden" name="agent_type" value="${agentTypeDigest}"/>`);

  // No script needed to draft or to press it.
  expect(html).not.toContain("hx-get");
  expect(html).not.toContain('http-equiv="refresh"');
});

test("choosing review rounds redraws the budgets from the plan, with script off", async () => {
  const world = fresh();
  await seedScopeRequest(world, "request-scope-rounds", "Do the thing.");
  const dir = mkdtempSync(join(tmpdir(), "rondo-scope-"));
  const { file: planFile } = scopePlanFile(dir);
  const ports = { ...portsOver(world, "ada", []), plan: planPortOver(planFile, world.record) };
  const view = (rounds: number | null) =>
    ({ kind: "scope", messageId: "request-scope-rounds", rounds, decisionId: null }) as const;

  const defaulted = await operatorPage(
    ports,
    "t",
    view(null),
    EN,
    mint,
    () => "x",
    () => "y",
  );
  const five = await operatorPage(
    ports,
    "t",
    view(5),
    EN,
    mint,
    () => "x",
    () => "y",
  );

  // D-0064 rule 3.1.4's default is 3 review rounds, over one plan: laps = 3.
  expect(defaulted).toContain('value="3"');
  expect(defaulted).not.toContain('value="5"');
  // Asking for 5 redraws every budget that depends on it, laps included.
  expect(five).toContain('value="5"');
  expect(five).not.toContain('value="3"');

  // **Explicit links, not a `method="get"` form** (rondo#233 S3): a link works
  // identically with script off, so nothing here needs `hx-get`.
  expect(five).toContain('href="/?scope=request-scope-rounds&amp;rounds=0&amp;lang=en"');
  expect(five).not.toContain("hx-get");
  expect(five).not.toContain('method="get"');
});

test("the approval reads what its predecessor spent, and repeats that the reviewer's own cost is never counted", async () => {
  const world = fresh();
  const requestId = "request-scope-pred";
  await seedScopeRequest(world, requestId, "Please continue the migration.");
  const dir = mkdtempSync(join(tmpdir(), "rondo-scope-"));
  const { file: planFile, agentTypeDigest } = scopePlanFile(dir);
  await seedEndedLap(world, "i-scope-pred", { agentTypeDigest, costUsd: 4.5, durationMs: 60_000 });

  const payload: JsonRecord = scopePayloadWithDefaults({
    requests: [requestId],
    workspaces: [{ repository: SCOPE_PLAN.repository, workspace_root: SCOPE_PLAN.workspaceRoot }],
    agent_types: [agentTypeDigest],
    budgets: {
      laps: 1,
      review_rounds: 1,
      cost_usd: 5,
      cost_reserve_usd: 1,
      expires_at_ms: 9_999_999_999,
    },
    severity_threshold: "major",
    outward_acts: [],
    irreversible_additions: [],
  });

  await world.record.recordScope({
    scopeId: "scope-pred",
    payload,
    supersedesScopeId: null,
    authorKind: "operator",
    authorId: "ada",
    bases: [],
    createdAtMs: 1_000,
    agentTypeRecords: [],
  });
  const predStored = await world.record.readScope("scope-pred");
  if (predStored.kind !== "read") {
    throw new Error(`the scope fixture predecessor did not record: ${JSON.stringify(predStored)}`);
  }
  await world.record.recordScopeDecision({
    scopeDecisionId: "decision-pred",
    scopeId: "scope-pred",
    scopeDigest: predStored.scope.scopeDigest,
    outcome: "approved",
    actorId: "ada",
    recordedBy: "rondo/page",
    decidedAtMs: 1_500,
  });
  // One admission planted directly against the predecessor's decision, as
  // `test/store/scope-record.test.ts` plants one for the same reading (D-0066
  // rule 3.4) rather than replaying `admitUnderScope`'s whole verdict.
  world.connection
    .prepare(
      "INSERT INTO scope_consumption (scope_decision_id, act_kind, subject_id, proposal_id, " +
        "consumed_at_ms) VALUES ('decision-pred', 'admission', 'i-scope-pred', NULL, 2000)",
    )
    .run();

  await world.record.recordScope({
    scopeId: "scope-succ",
    payload,
    supersedesScopeId: "scope-pred",
    authorKind: "operator",
    authorId: "ada",
    bases: [],
    createdAtMs: 3_000,
    agentTypeRecords: [],
  });
  const succStored = await world.record.readScope("scope-succ");
  if (succStored.kind !== "read") {
    throw new Error(`the scope fixture successor did not record: ${JSON.stringify(succStored)}`);
  }
  await world.record.recordScopeDecision({
    scopeDecisionId: "decision-succ",
    scopeId: "scope-succ",
    scopeDigest: succStored.scope.scopeDigest,
    outcome: "approved",
    actorId: "ada",
    recordedBy: "rondo/page",
    decidedAtMs: 3_500,
  });

  const ports = { ...portsOver(world, "ada", []), plan: planPortOver(planFile, world.record) };
  const html = await operatorPage(
    ports,
    "t",
    { kind: "scope", messageId: requestId, rounds: null, decisionId: "decision-succ" },
    EN,
    mint,
    () => "x",
    () => "y",
  );

  // D-0066 rule 1.4: what a predecessor's approval spent is read on its
  // successor's own screen, in laps and read dollars, with unread laps named.
  expect(html).toContain("has spent 1 laps and $4.50 read");
  expect(html).toContain("with 0 laps whose cost is not read yet holding their reserve");
  // D-0066's first gate answer, said again beside the approval and not only on the form.
  expect(html).toContain(
    "the reviewer's cost is not counted, and a lap whose cost is not read yet holds the reserve",
  );
  expect(html).toContain('id="start-form"');

  // **The retired approval's own screen draws no start button** (rule 1.4).
  // `scopeVerdict` refuses that press at the `superseded` test, so drawing it
  // is the screen offering a press it already knows cannot work; it says why
  // instead (rondo#233 S3 press review).
  const retired = await operatorPage(
    ports,
    "t",
    { kind: "scope", messageId: requestId, rounds: null, decisionId: "decision-pred" },
    EN,
    mint,
    () => "x",
    () => "y",
  );
  expect(retired).toContain("A later scope has replaced this one");
  expect(retired).not.toContain('id="start-form"');
});

test("the scope screen speaks Japanese, and every id, digest and 'rondo' token stays ASCII", async () => {
  const world = fresh();
  const requestId = "request-scope-ja";
  await seedScopeRequest(world, requestId, "テストの不安定さを直してください。");
  const dir = mkdtempSync(join(tmpdir(), "rondo-scope-"));
  const { file: planFile, agentTypeDigest, planDigest } = scopePlanFile(dir);
  await seedEndedLap(world, "i-scope-ja", { agentTypeDigest, costUsd: 1, durationMs: 60_000 });
  const ports = { ...portsOver(world, "ada", []), plan: planPortOver(planFile, world.record) };

  const html = await operatorPage(
    ports,
    "t",
    { kind: "scope", messageId: requestId, rounds: null, decisionId: null },
    chromeFor("ja"),
    mint,
    () => "x",
    () => "y",
  );

  expect(html).toContain("この依頼の範囲");
  expect(html).toContain("範囲を決める");
  expect(html).toContain(
    "rondo がプランとこのストアに記録された周回から下書きしました。読んで、変えたいところを変えてください。",
  );
  expect(html).toContain("既定値で、依頼から導いたものではありません。");
  expect(html).toContain(`エージェント種別 ${agentTypeDigest}`);
  expect(html).toContain(`プラン ${planDigest}`);

  // **The evidence layer is in Japanese too** (rondo#233 S3 screen review).
  // The formulas, the bases and the agent type's bounds are the whole reason
  // the fold exists, and every one of them rendered English inside this page
  // while `computeScopeBudgets` composed the sentence itself. The numbers,
  // digests and capability keys they frame stay their own bytes (rule 3).
  expect(html).toContain("計算: プラン数 x レビュー回数 = 1 x 3");
  expect(html).toContain("この数の出どころ");
  expect(html).toContain("レビュー回数: 3（誰も選ばなかったときに rondo が使う数）");
  expect(html).toContain("初回周回の費用が最も高かったもの");
  expect(html).toContain("あなたの返信のための 1 日");
  expect(html).toContain("tier standard、許可はcommand.run");
  expect(html).toContain("ブランチを push する");
  expect(html).toContain("重大 (major)");
  // Not one English sentence left in the fold, and no D-number in front of
  // anybody in either language (this catalogue's own rule).
  expect(html).not.toContain("highest");
  expect(html).not.toContain("most recent recorded lap");
  expect(html).not.toContain("held from");
  expect(html).not.toContain("D-0064");
  // The EN-only sentence this screen did not draw in Japanese.
  expect(html).not.toContain("Set the scope");
  // D-0055 rule 3: ids, digests and the `rondo` token stay ASCII in JA too.
  expect(agentTypeDigest).toMatch(/^[\x20-\x7E]+$/);
  expect(planDigest).toMatch(/^[\x20-\x7E]+$/);
  expect(html).toContain(">rondo</");
});

test("rendering the scope screen writes nothing, however many times or in which state it is drawn", async () => {
  const world = fresh();
  const requestId = "request-scope-idle";
  await seedScopeRequest(world, requestId, "Look at this.");
  const dir = mkdtempSync(join(tmpdir(), "rondo-scope-"));
  const { file: planFile, agentTypeDigest } = scopePlanFile(dir);
  await seedEndedLap(world, "i-scope-idle", { agentTypeDigest, costUsd: 1, durationMs: 60_000 });
  const ports = { ...portsOver(world, "ada", []), plan: planPortOver(planFile, world.record) };

  for (let i = 0; i < 5; i++) {
    await operatorPage(
      ports,
      "t",
      { kind: "scope", messageId: requestId, rounds: i % 4, decisionId: null },
      EN,
      mint,
      () => "x",
      () => "y",
    );
  }
  // With no port, too (no `RONDO_APPROVER`): the plan is still read, and the
  // form is not drawn at all, buttons included (rondo#233 S3).
  const bare = await operatorPage(
    ports,
    null,
    { kind: "scope", messageId: requestId, rounds: null, decisionId: null },
    EN,
    null,
    null,
    null,
  );
  expect(bare).not.toContain("<form");
  expect(bare).not.toContain("<button");
  expect(bare).toContain(
    "RONDO_APPROVER is not set, so there is nobody this page could approve a scope as.",
  );

  expect(rows(world.connection, "scope")).toBe(0);
  expect(rows(world.connection, "scope_decision")).toBe(0);
  expect(rows(world.connection, "operator_attention")).toBe(0);
});

test("the record-scope press writes the scope, reads it back, counts it and approves it with the digest read back -- and never a decision when the write refused", async () => {
  const dir = mkdtempSync(join(tmpdir(), "rondo-scope-write-"));
  const storePath = join(dir, "store.db");
  const record = advisoryRecord(new DatabaseSync(storePath));
  const requestId = "request-scope-write";
  await record.recordThreadMessage({
    messageId: requestId,
    body: "Please fix it.",
    authorKind: "operator",
    authorId: "ada",
    inReplyTo: null,
    atMs: 1_000,
    bases: [],
    asks: false,
  });
  const plan = scopePlanFile(dir);
  const planFile = plan.file;
  const environment = { RONDO_APPROVER: "ada" };
  const draft: ScopeFormDraft = {
    scopeId: newScopeId(),
    requestMessageId: requestId,
    planDigest: plan.planDigest,
    agentTypeDigest: plan.agentTypeDigest,
    budgets: {
      laps: 1,
      review_rounds: 1,
      cost_usd: 5,
      cost_reserve_usd: 1,
      expires_at_ms: 9_999_999_999,
    },
    severityThreshold: "major",
    outwardActs: [],
  };

  const recorded = await recordScopeFromPage(environment, storePath, "ada", planFile, draft);
  expect(recorded.ok).toBe(true);
  expect(recorded.why).toBeUndefined();
  expect(recorded.scopeDecisionId).toBeDefined();

  const stored = await record.readScope(draft.scopeId);
  expect(stored.kind).toBe("read");
  const decision = await record.readScopeDecision(recorded.scopeDecisionId as string);
  expect(decision.kind).toBe("read");
  if (decision.kind === "read" && stored.kind === "read") {
    // D-0066 rule 2.2: the digest approved is the digest read back, never one
    // a form posted -- true here by construction (`recordScopeFromPage`'s own
    // order), not by a person copying a line.
    expect(decision.decision.scopeDigest).toBe(stored.scope.scopeDigest);
    expect(decision.decision.outcome).toBe("approved");
  }
  // Presented, once, for the row this press wrote (D-0042 rule 3).
  const attention = new DatabaseSync(storePath)
    .prepare(
      "SELECT count(*) AS n FROM operator_attention " +
        "WHERE subject_kind = 'scope' AND subject_id = ? AND disposition = 'presented'",
    )
    .get(draft.scopeId) as { n: number };
  expect(Number(attention.n)).toBe(1);

  // A second row, over a request this store never heard of: `recordScope`
  // refuses it, and a decision is never recorded for a scope that was not
  // taken (D-0036 rule 1's order -- write, present, count).
  const refusedDraft: ScopeFormDraft = {
    ...draft,
    scopeId: newScopeId(),
    requestMessageId: "no-such-request",
  };
  const refused = await recordScopeFromPage(environment, storePath, "ada", planFile, refusedDraft);
  expect(refused.ok).toBe(false);
  expect(refused.why).toBe("scopeRefusedNotTaken");
  expect(refused.scopeDecisionId).toBeUndefined();
  expect(await record.readScope(refusedDraft.scopeId)).toEqual({ kind: "absent" });
  expect(rows(new DatabaseSync(storePath), "scope_decision")).toBe(1);
});

test("a plan that moved between the draw and the press records nothing, because the approval would name a workspace nobody saw", async () => {
  // **The hole rule 2.2 leaves open by itself** (rondo#233 S3 press review).
  // The write re-reads the plan, as it must, and the two fields the form does
  // not post -- the workspace and the agent type -- are exactly the ones that
  // say where the work may act. The digest approved is the row's own either
  // way, so rule 2.2's letter holds while the person approves a repository
  // they never read. The form carries what it was drawn from; this compares.
  const dir = mkdtempSync(join(tmpdir(), "rondo-scope-moved-"));
  const storePath = join(dir, "store.db");
  const record = advisoryRecord(new DatabaseSync(storePath));
  const requestId = "request-scope-moved";
  await record.recordThreadMessage({
    messageId: requestId,
    body: "Please fix it.",
    authorKind: "operator",
    authorId: "ada",
    inReplyTo: null,
    atMs: 1_000,
    bases: [],
    asks: false,
  });
  const plan = scopePlanFile(dir);
  const drawn: ScopeFormDraft = {
    scopeId: newScopeId(),
    requestMessageId: requestId,
    planDigest: plan.planDigest,
    agentTypeDigest: plan.agentTypeDigest,
    budgets: {
      laps: 1,
      review_rounds: 1,
      cost_usd: 5,
      cost_reserve_usd: 1,
      expires_at_ms: 9_999_999_999,
    },
    severityThreshold: "major",
    outwardActs: [],
  };

  // The file moves while the person is reading the screen it was drawn from.
  // Absolute, because a repository on a plan is a path (`requireAbsolute`):
  // the point is a *valid* plan naming somewhere else, not a broken one.
  const moved = { ...scopePlanDocument(), repository: "/srv/other-repo" };
  writeFileSync(plan.file, JSON.stringify(moved), "utf8");

  const refused = await recordScopeFromPage(
    { RONDO_APPROVER: "ada" },
    storePath,
    "ada",
    plan.file,
    drawn,
  );
  expect(refused.ok).toBe(false);
  expect(refused.why).toBe("scopeRefusedPlanChanged");
  expect(refused.scopeDecisionId).toBeUndefined();
  // Nothing at all: not the scope, not the presentation, not the approval.
  expect(await record.readScope(drawn.scopeId)).toEqual({ kind: "absent" });
  expect(rows(new DatabaseSync(storePath), "scope")).toBe(0);
  expect(rows(new DatabaseSync(storePath), "scope_decision")).toBe(0);

  // And the same press against the plan it was drawn from still records.
  writeFileSync(plan.file, JSON.stringify(scopePlanDocument()), "utf8");
  const recorded = await recordScopeFromPage(
    { RONDO_APPROVER: "ada" },
    storePath,
    "ada",
    plan.file,
    drawn,
  );
  expect(recorded.ok).toBe(true);
});

test("a second press of an edited form is refused, and never reported as an approval of numbers that were replaced", async () => {
  // The id is minted per draw, so the store refuses the second row on the id
  // and the approval already there reads back -- which is a screen saying
  // *approved* about a budget the person has just replaced (rondo#233 S3 press
  // review). The id says which form this is; the payload says whether it is
  // still the same scope.
  const dir = mkdtempSync(join(tmpdir(), "rondo-scope-edited-"));
  const storePath = join(dir, "store.db");
  const record = advisoryRecord(new DatabaseSync(storePath));
  const requestId = "request-scope-edited";
  await record.recordThreadMessage({
    messageId: requestId,
    body: "Please fix it.",
    authorKind: "operator",
    authorId: "ada",
    inReplyTo: null,
    atMs: 1_000,
    bases: [],
    asks: false,
  });
  const plan = scopePlanFile(dir);
  const environment = { RONDO_APPROVER: "ada" };
  const draft: ScopeFormDraft = {
    scopeId: newScopeId(),
    requestMessageId: requestId,
    planDigest: plan.planDigest,
    agentTypeDigest: plan.agentTypeDigest,
    budgets: {
      laps: 3,
      review_rounds: 1,
      cost_usd: 5,
      cost_reserve_usd: 1,
      expires_at_ms: 9_999_999_999,
    },
    severityThreshold: "major",
    outwardActs: [],
  };
  const first = await recordScopeFromPage(environment, storePath, "ada", plan.file, draft);
  expect(first.ok).toBe(true);

  // The same form, back from the browser's history, with one number changed.
  const edited: ScopeFormDraft = { ...draft, budgets: { ...draft.budgets, laps: 10 } };
  const again = await recordScopeFromPage(environment, storePath, "ada", plan.file, edited);
  expect(again.ok).toBe(false);
  expect(again.why).toBe("scopeRefusedEdited");
  expect(again.scopeDecisionId).toBeUndefined();

  // What is stored is still the first press's scope, approved once.
  const stored = await record.readScope(draft.scopeId);
  expect(stored.kind === "read" && stored.scope.payload.budgets.laps).toBe(3);
  expect(rows(new DatabaseSync(storePath), "scope")).toBe(1);
  expect(rows(new DatabaseSync(storePath), "scope_decision")).toBe(1);

  // An unedited re-press -- a double click, a resend after a slow write -- is
  // still the write it repeats, and still lands on the approval it made.
  const repeated = await recordScopeFromPage(environment, storePath, "ada", plan.file, draft);
  expect(repeated.ok).toBe(true);
  expect(repeated.scopeDecisionId).toBe(first.scopeDecisionId);
  expect(rows(new DatabaseSync(storePath), "scope_decision")).toBe(1);
});

test("a scoped start press that names a row already there admits nothing, rather than asking the request a question nobody asked", async () => {
  // **The replay the minted id makes possible** (rondo#233 S3, the Codex review
  // of this branch). The iteration id is minted when the form is drawn, so back
  // and submit posts the id the first press already admitted. Sending it through
  // the scope test again is not harmless: the lap it started has spent the
  // budget it was testing against, so the verdict fails and the refusal writes
  // an **asking message into the request's thread** (D-0066 rule 4.4) which then
  // holds the line (D-0069 rule 5) -- a question nobody asked, stopping the
  // work, because somebody pressed back. The guard runs before continuo is
  // started, which is what makes this reachable in a file with no continuo.
  const dir = mkdtempSync(join(tmpdir(), "rondo-start-replay-"));
  const storePath = join(dir, "store.db");
  const connection = new DatabaseSync(storePath);
  const record = advisoryRecord(connection);
  const store = iterationStore(connection, { maxOccupying: 4, maxLive: 6 });
  const requestId = "request-start-replay";
  await record.recordThreadMessage({
    messageId: requestId,
    body: "Please do it.",
    authorKind: "operator",
    authorId: "ada",
    inReplyTo: null,
    atMs: 1_000,
    bases: [],
    asks: false,
  });
  const iterationId = "lap-already-there";
  const reserved = await store.reserve({
    id: iterationId,
    request: "Please do it.",
    plan: planFor(iterationId),
    spend: null,
    scopeSpend: null,
    nowMs: 1_000,
    supersedesIterationId: null,
    requestMessageId: requestId,
    runId: `rondo-${iterationId}`,
    topicBranch: `rondo/${iterationId}`,
    workspace: `/srv/work/${iterationId}`,
  });
  expect(reserved.kind).toBe("reserved");

  const before = rows(connection, "conversation_message");
  const started = await startScopedFromPage(
    { RONDO_APPROVER: "ada" },
    store,
    storePath,
    "ada",
    scopePlanFile(dir).file,
    {
      iterationId,
      requestMessageId: requestId,
      scopeDecisionId: "scope-decision-nobody-approved",
    },
  );
  // The press is the one that made the row, so it is not a refusal to show.
  expect(started.ok).toBe(true);
  expect(started.why).toBeUndefined();
  // And nothing was asked of the request: the thread is exactly as it was.
  expect(rows(connection, "conversation_message")).toBe(before);
  // Not vacuous: a scope decision nobody approved is what the second press
  // carries, and it reached no scope test at all -- one iteration row, still.
  expect(rows(connection, "iteration")).toBe(1);
});

test("a revise press on a stale page answers nothing, and writes no framing for it (#233 S4)", async () => {
  // **The three refusals that catch a page that went stale**, which is what a
  // page redrawing itself every five seconds sometimes is: a lap that is not
  // there, one that has ended, and one whose row names no gate. None of them is
  // a person answering, so none of them puts a framing in the ledger and none
  // of them starts continuo (D-0042 rule 3's order, `answerFromPage`'s reading
  // of it). Reachable in a file with no continuo for exactly that reason.
  const dir = mkdtempSync(join(tmpdir(), "rondo-revise-stale-"));
  const storePath = join(dir, "store.db");
  const connection = new DatabaseSync(storePath);
  const store = iterationStore(connection, { maxOccupying: 4, maxLive: 6 });
  const ended = "lap-ended";
  const reserved = await store.reserve({
    id: ended,
    request: "Please do it.",
    plan: planFor(ended),
    spend: null,
    scopeSpend: null,
    nowMs: 1_000,
    supersedesIterationId: null,
    requestMessageId: null,
    runId: `rondo-${ended}`,
    topicBranch: `rondo/${ended}`,
    workspace: `/srv/work/${ended}`,
  });
  expect(reserved.kind).toBe("reserved");

  const pressing = (iterationId: string) =>
    reviseFromPage({ RONDO_APPROVER: "ada" }, store, storePath, "ada", {
      iterationId,
      successorId: "lap-00000000-0000-4000-8000-000000000009",
      scopeDecisionId: "sd-0001",
      body: "narrow it to the parser",
    });

  // A lap that is at its gate, and was admitted under no approval: the page
  // draws no revise form on one, and a press that names an approval anyway is
  // refused before the gate is touched (Codex round 2 -- the hidden field is
  // compared against the admission row and never trusted).
  const gated = "lap-gated";
  const openedReserve = await store.reserve({
    id: gated,
    request: "Please do it.",
    plan: planFor(gated),
    spend: null,
    scopeSpend: null,
    nowMs: 1_000,
    supersedesIterationId: null,
    requestMessageId: null,
    runId: `rondo-${gated}`,
    topicBranch: `rondo/${gated}`,
    workspace: `/srv/work/${gated}`,
  });
  expect(openedReserve.kind).toBe("reserved");
  for (const [from, to] of [
    ["planned", "admitting"],
    ["admitting", "admitted"],
    ["admitted", "performing"],
    ["performing", "awaiting_human"],
  ] as const) {
    const moved = await store.transition(
      gated,
      from,
      to,
      to === "awaiting_human" ? { gateId: `gate-${gated}` } : {},
      2_000,
    );
    expect(moved.kind).toBe("transitioned");
  }

  const absent = await pressing("lap-not-there");
  expect(absent.ok).toBe(false);
  expect(absent.why).toBe("reviseRefusedGateClosed");
  // A row that is live but names no gate: the button is not drawn on one, and
  // a press that arrives anyway answers nothing.
  const noGate = await pressing(ended);
  expect(noGate.ok).toBe(false);
  expect(noGate.why).toBe("reviseRefusedGateClosed");
  // The approval the press named is not the one this lap was admitted under --
  // it was admitted under none -- so nothing is answered and no gate is walked.
  const wrongScope = await pressing(gated);
  expect(wrongScope.ok).toBe(false);
  expect(wrongScope.why).toBe("reviseRefusedNotItsScope");
  // Nothing was recorded for either: no proposal, no attention row, no message.
  expect(rows(connection, "proposal")).toBe(0);
  expect(rows(connection, "conversation_message")).toBe(0);
  expect(rows(connection, "scope_consumption")).toBe(0);
});

test("a second revise press of one form joins the first only when it says the same thing (#233 S4)", async () => {
  // **The successor's id is minted per draw, so a double click carries one id**
  // -- and so does a press made from the same form after the browser's Back
  // button, with the words edited since (Codex round 3). The first is the press
  // that is running and the second is its repeat; the third is a different
  // instruction, and answering *sent* over words that were never sent is the
  // failure this screen exists not to have. Both presses here refuse before
  // continuo, on the lap's own state, which is what makes this reachable in a
  // file with no continuo -- what is under test is which of them joined.
  const dir = mkdtempSync(join(tmpdir(), "rondo-revise-twice-"));
  const storePath = join(dir, "store.db");
  const connection = new DatabaseSync(storePath);
  const store = iterationStore(connection, { maxOccupying: 4, maxLive: 6 });
  const successorId = "lap-00000000-0000-4000-8000-00000000000a";
  const pressing = (body: string) =>
    reviseFromPage({ RONDO_APPROVER: "ada" }, store, storePath, "ada", {
      iterationId: "lap-not-there",
      successorId,
      scopeDecisionId: "sd-0001",
      body,
    });

  const [first, same, other] = await Promise.all([
    pressing("narrow it to the parser"),
    pressing("narrow it to the parser"),
    pressing("actually, leave the parser alone"),
  ]);
  // The repeat is the press that made it: the same answer, whatever it was.
  expect(same).toEqual(first);
  // The one carrying other words is refused, and says the first is running.
  expect(other.ok).toBe(false);
  expect(other.why).toBe("reviseRefusedStillRunning");
  expect(rows(connection, "proposal")).toBe(0);
});

test("the first scope in a store shows what its agent type is allowed, read from the plan the press will record", async () => {
  // **D-0069 section 1 in the one case the store cannot answer** (rondo#233 S3,
  // Codex round 3). A fresh store holds no `agent_type_record` and has run no
  // lap, so the held read is absent and the line could only say rondo holds no
  // record -- while the form goes on offering the press. The person would be
  // approving a hash, which is what that section exists to stop. The plan the
  // press is about to record is what the record is built from, so it answers
  // before the press; nothing is written by asking it.
  const world = fresh();
  const dir = mkdtempSync(join(tmpdir(), "rondo-scope-firstplan-"));
  const plan = scopePlanFile(dir);

  const drafted = await scopeDraftingFromPlan(plan.file, world.record, EN);
  expect(drafted.kind).toBe("drafted");
  if (drafted.kind !== "drafted") return;
  const line = drafted.heldLines.join("\n");
  expect(line).toContain(plan.agentTypeDigest);
  expect(line).toContain("tier ");
  expect(line).toContain("read from the plan this scope records");
  // Not the blind line: that one is still what a digest with no plan behind it
  // gets, which is the assertion that keeps this from passing vacuously.
  expect(line).not.toContain("rondo holds no record of what it is allowed");
  expect(
    (await heldAgentTypeLines(EN, world.record, ["sha256:" + "0".repeat(64)])).join("\n"),
  ).toContain("rondo holds no record of what it is allowed");

  // Asking wrote nothing: the record is still the press's to write.
  expect(rows(world.connection, "agent_type_record")).toBe(0);
  expect(rows(world.connection, "scope")).toBe(0);

  // And it is said in the page's language too, not only in English.
  const ja = await scopeDraftingFromPlan(plan.file, world.record, chromeFor("ja"));
  expect(ja.kind).toBe("drafted");
  if (ja.kind === "drafted") {
    expect(ja.heldLines.join("\n")).toContain("この範囲が記録するプラン");
  }
});
