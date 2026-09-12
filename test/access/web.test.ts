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
import { request as httpRequest } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";

import { recordPagePress } from "../../src/access/cli.js";
import { operatorPage, serveOperatorPage, type WebPorts } from "../../src/access/web.js";
import { allocate } from "../../src/refrain/allocator.js";
import { admittedPlan, planPayload, type RunPlan, runPlan } from "../../src/refrain/plan.js";
import type { JsonRecord } from "../../src/store/records.js";
import { advisoryRecord, iterationStore } from "../../src/store/sqlite.js";

const PLAN: RunPlan = {
  db: "/srv/continuo.db",
  workspaceRoot: "/srv/work",
  baseBranch: "main",
  prompt: "do the thing",
  allowedBash: ["npm run:*"],
  materialLanguage: null,
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
  parties: { grantor: "rondo", grantee: "unset" } as unknown as RunPlan["parties"],
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

const fresh = () => {
  const connection = new DatabaseSync(":memory:");
  return {
    connection,
    store: iterationStore(connection, { maxOccupying: 4, maxLive: 6 }),
    record: advisoryRecord(connection),
  };
};

/** Every press this surface let through, in order. */
type Pressed = { iterationId: string; body: string }[];

function portsOver(
  world: ReturnType<typeof fresh>,
  actorId: string | null = "ada",
  pressed: Pressed | null = null,
): WebPorts {
  return {
    store: world.store,
    record: world.record,
    now: () => 5_000,
    // The page draws `inbox`'s lines, so it carries `inbox`'s one outward
    // port; nothing in these tests runs a lap, so it is never asked (D-0048
    // rule 6 asks only of `performing` rows).
    locateTranscript: async () => ({ kind: "unknown", reason: "no continuo in this test" }),
    policy: { maxOccupying: 4, maxLive: 6 },
    actorId,
    material: pressed === null ? null : async (record) => [`work    rondo/${record.id}`],
    answer:
      pressed === null
        ? null
        : async (iterationId, body) => {
            pressed.push({ iterationId, body });
            return await Promise.resolve({ ok: true, note: "answered" });
          },
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

/** One form post, with headers of our choosing and redirects left alone. */
function post(
  base: string,
  form: Record<string, string>,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: string; location: string | undefined }> {
  const encoded = new URLSearchParams(form).toString();
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      `${base}/`,
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "content-length": String(Buffer.byteLength(encoded)),
          ...headers,
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
async function serving(ports: WebPorts): Promise<{
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
    nowMs: 1_000,
    supersedesIterationId: null,
    runId: `rondo-${id}`,
    topicBranch: `rondo/${id}`,
    workspace: `/srv/work/${id}`,
  });
  if (outcome.kind !== "reserved") {
    throw new Error(`the fixture did not reserve: ${JSON.stringify(outcome)}`);
  }
}

const rows = (connection: DatabaseSync, table: string): number =>
  Number((connection.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n);

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
  const opened = await operatorPage(portsOver(world), null, { kind: "reading" });

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

  expect(await recordPagePress(ports, "i-0001")).toEqual({ ok: true, note: "" });

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
          await Promise.resolve({ kind: "refused" as const, reason: "the table is locked" }),
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
  expect(html).toContain("&lt;b&gt;paragraph&lt;/b&gt;");
  expect(html).not.toContain("<b>paragraph</b>");
});

test("one basis is written once above the claims that rest on it (rondo#91)", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");

  const html = await operatorPage(portsOver(world));
  const bases = [...html.matchAll(/<p class="basis">([^<]*)<\/p>/g)].map((match) => match[1]);

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
  expect(page.headers.get("content-security-policy")).toBe("frame-ancestors 'none'");
  expect(await page.text()).toContain("waiting for your answer");

  // **The reading is the same page at a second address**, and the redraw it
  // serves points back at that address -- so the fold an operator opened is
  // still open five seconds later, which is what makes it a fold (rondo#145).
  const withReading = await fetch(`${base}/?reading=open`);
  expect(withReading.status).toBe(200);
  const readingHtml = await withReading.text();
  expect(readingHtml).toContain("what spans the live laps");
  expect(readingHtml).toContain('content="5;url=/?reading=open"');

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
  expect(summary).toContain('href="/?answer=i-0001"');

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
  // act for an unnamed person.
  expect(await operatorPage(portsOver(world, null), "t")).not.toContain("<form");
  expect(await operatorPage(portsOver(world, null), "t", answering)).not.toContain("<form");
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
  const answered = await post(base, { token, iteration: "i-0001", body: "revise" });

  // The body the form carried is ignored: the button's word is the module's
  // constant, so a hand-written post cannot widen what this surface may say.
  expect(pressed).toEqual([{ iterationId: "i-0001", body: "approve" }]);
  // A redirect and not a page, so a refresh re-reads rather than re-answers.
  expect(answered.status).toBe(303);
  expect(answered.location).toBe("/");

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
  const ports: WebPorts = {
    ...portsOver(world),
    material: async () => await Promise.resolve(["work    rondo/i-0001"]),
    answer: async () =>
      await Promise.resolve({ ok: false, note: "continuo is not usable: no CLI" }),
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
  return html.slice(0, html.indexOf('<p class="fold">'));
}

/** The fold: what the second address of the page adds below the link. */
function reading(html: string): string {
  return html.slice(html.indexOf('<p class="fold">'));
}

test("an idle store says zero once rather than nine times (rondo#145)", async () => {
  const html = await operatorPage(portsOver(fresh()));
  const opened = await operatorPage(portsOver(fresh()), null, { kind: "reading" });

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
  expect(opened).toContain('content="5;url=/?reading=open"');
  expect(html).toContain('content="5;url=/"');
});

test("the page is ordered by the operator's three questions (rondo#145)", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");

  const html = await operatorPage(portsOver(world));
  const at = (heading: string) => lead(html).indexOf(heading);
  const opened = await operatorPage(portsOver(world), null, { kind: "reading" });

  expect(at("waiting for your answer")).toBeGreaterThan(-1);
  expect(at("running now")).toBeGreaterThan(at("waiting for your answer"));
  expect(at("just finished")).toBeGreaterThan(at("running now"));
  // rondo's own vocabulary is below the questions, not in place of them.
  expect(at("what spans the live laps")).toBe(-1);
  expect(html).toContain('href="/?reading=open"');
  expect(reading(opened)).toContain("what spans the live laps");
});

test("the three questions are told apart in the markup, not only in the order (rondo#153)", async () => {
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");

  const html = lead(await operatorPage(portsOver(world)));

  // The order alone put the three questions in a row and gave them the same
  // weight; the class is the whole of what a stylesheet has to weigh them by,
  // and each section carries exactly one.
  expect(html).toContain('<section class="waiting">');
  expect(html).toContain('<section class="running">');
  expect(html).toContain('<section class="ended">');
  // Both palettes are declared rather than inherited from the user agent, so a
  // dark reader gets rondo's contrast and not the browser's (rondo#153).
  const page = await operatorPage(portsOver(world));
  expect(page).toContain("@media (prefers-color-scheme: dark)");
  // Still no script, and still nothing but the one form that can write.
  expect(page).not.toContain("<script");
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
  expect(lead(html)).toContain('<p class="basis">iteration i-0001</p>');

  // **The button is on the page that showed what a press records** (D-0042
  // rules 1 and 4). `recordPagePress` stores `explainIteration`'s entire claim
  // set and counts it as presented, so every one of those claims has to have
  // reached the browser: a summary with a button would record a presentation
  // that did not happen, and two dozen claims per waiting row on the summary is
  // the screen rondo#145 is about. So the summary is the way there and the
  // answering view is the press.
  expect(html).not.toContain("<form");
  expect(lead(html)).toContain('href="/?answer=i-0001"');
  expect(answering).toContain('method="post"');
  expect(answering).toContain("What pressing approve records as shown");
  expect(answering).toContain("snapshot /iteration/lapCostUsd = 1.42");
  expect(answering).toContain("snapshot /iteration/lapDurationMs = null");
  expect(answering).toContain("work    rondo/i-0001");
  // The redraw is pointed back at the view being read, so the page an operator
  // is deciding on is still there five seconds later.
  expect(answering).toContain('content="5;url=/?answer=i-0001"');

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
  expect(lead(html)).toContain("closed 1s ago -- gate answered 'approve'");
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
      { store: world.store, record: world.record, now: () => 4_000, present: () => undefined },
      "i-0001",
    ),
  ).toEqual({ ok: true, note: "" });
  expect(rows(world.connection, "proposal")).toBe(1);

  const html = await operatorPage(portsOver(world));
  const opened = await operatorPage(portsOver(world), null, { kind: "reading" });

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
      material: async () => await Promise.resolve(["なぜ止まったか"]),
    },
    "t",
    { kind: "answer", iterationId: "i-0001" },
  );

  // The two elements rule 12 names, and nothing else: the request paragraph the
  // lap wrote for this operator, and the block a press records as shown.
  expect(html).toContain('<p class="request" lang="ja">');
  expect(html).toContain('<pre class="material" lang="ja">');
  // **The chrome stays English**, because it is rondo's own vocabulary about
  // its own record and this entry gives it no language.
  expect(html).toContain('<html lang="en">');
  // **Nothing is translated** (rule 11): the same bytes, with an attribute.
  expect(html).toContain("重みが足りない");
  expect(html).toContain("なぜ止まったか");
});

test("a lap nobody asked a language of carries no lang at all, and that is not `en`", async () => {
  // Rule 10's distinction, on the surface where it is visible: null means
  // *nobody asked*, so the element inherits the document and claims nothing --
  // as against `lang="en"`, which would be rondo asserting an ask nobody made.
  const world = fresh();
  await reserve(world, "i-0001", "do the thing");
  await openGate(world, "i-0001");
  const html = await operatorPage(
    {
      ...portsOver(world, "ada", []),
      material: async () => await Promise.resolve(["why it stopped"]),
    },
    "t",
    { kind: "answer", iterationId: "i-0001" },
  );

  expect(html).toContain('<p class="request">');
  expect(html).toContain('<pre class="material">');
  expect(html).not.toContain('class="request" lang=');
  expect(html).not.toContain('class="material" lang=');
});
