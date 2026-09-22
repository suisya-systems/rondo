/**
 * Only a person's press can write (D-0059 sections 5 and 5a, R4, rule 9).
 *
 * The `test/access/web-*.test.ts` files are the page over a real store, one
 * per screen. This file is the
 * door, over a spy port: what is under test is **whether the answer port was
 * reached with a write**, and "the spy recorded nothing" is that claim exactly.
 * Three halves, as rule 9 lists them:
 *
 * - **(a) the press** -- minted for a native navigation carrying `?1` and the
 *   token, and refused for every other shape a request to the one write route
 *   can take, the htmx `hx-post` among them;
 * - **(b) the vocabulary** -- the running app's own `app.routes`, enumerated,
 *   against the closed table of write routes;
 * - **(c) the audit's planted writers** -- a `GET` handler, a middleware, a
 *   mounted sub-app and a loader that reads the token, each calling the port
 *   directly during an ordinary `GET`, and a `fetch`-shaped `POST` -- carried
 *   as tests that must fail to write. Each planted writer is served over a real
 *   socket and sent every press header a person's click carries, so what
 *   refuses it is the request's method and the press, not a missing header.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { type Context, Hono } from "hono";
import { expect, test } from "vitest";

import {
  type AddedRepository,
  type AddRepositoryInput,
  AddRepositoryPort,
  AnswerPort,
  createApp,
  type DraftedScopeFormDraft,
  type GoalInput,
  MAX_CLAIM_CHARS,
  type Merged,
  type MergeInput,
  MergePort,
  mintPress,
  mintSend,
  type NotNowInput,
  newIterationId,
  newMessageId,
  newScopeId,
  type PageEnv,
  type PlanStartInput,
  type Press,
  type PublishInput,
  PublishPort,
  type RaiseInput,
  type ReleaseInput,
  ReleasePort,
  type ReviseInput,
  RevisePort,
  SayPort,
  type ScopedStartInput,
  type ScopeFormDraft,
  ScopePort,
  type ScopeRecorded,
  type Send,
  type SentMessage,
  type ServedPorts,
  serveApp,
  TriagePort,
  type TriageWritten,
} from "../../src/access/web-app.js";
import { chromeFor, EN } from "../../src/access/wording.js";
import { advisoryRecord } from "../../src/store/sqlite.js";

const TOKEN = "the-process-token";

/** Every write the port let through to its implementation. */
type Written = { iterationId: string; body: string; claim?: string }[];

/** Every message the say port let through to its implementation. */
type Sent = SentMessage[];

/** Every scope the scope port recorded and approved, as the spy's implementation saw it. */
type Scoped = ScopeFormDraft[];

/** Every scoped start the scope port admitted, as the spy's implementation saw it. */
type Started = ScopedStartInput[];

/** Every revise the revise port admitted, as the spy's implementation saw it. */
type Revised = ReviseInput[];

/** Every publish the publish port admitted, as the spy's implementation saw it. */
type Published = PublishInput[];

/**
 * Ports that hold a spy writer and nothing a `POST` reads.
 *
 * The write route reads only the host's language off the reading half, so the
 * rest is absent and a route that tried to render would fail loudly.
 */
function spyPorts(
  written: Written,
  sent: Sent = [],
  scoped: Scoped = [],
  started: Started = [],
  revised: Revised = [],
  published: Published = [],
): ServedPorts {
  return {
    hostLanguage: null,
    answer: new AnswerPort(async (iterationId, body, claim) => {
      // A claim is listed only when one reached the implementation.
      written.push({ iterationId, body, ...(claim === null ? {} : { claim }) });
      return await Promise.resolve({ ok: true, note: "" });
    }),
    // The port reads the thread on a reply, to refuse answering an ask by a send.
    say: new SayPort(
      async (message) => {
        sent.push(message);
        return await Promise.resolve({ ok: true, note: "" });
      },
      async () => await Promise.resolve({ kind: "read", messages: [] }),
    ),
    scope: new ScopePort(
      async (draft) => {
        scoped.push(draft);
        return await Promise.resolve({ ok: true, note: "", scopeDecisionId: "decision-1" });
      },
      async (input) => {
        started.push(input);
        return await Promise.resolve({ ok: true, note: "" });
      },
    ),
    revise: new RevisePort(async (input) => {
      revised.push(input);
      return await Promise.resolve({ ok: true, note: "" });
    }),
    publish: new PublishPort(async (input) => {
      published.push(input);
      return await Promise.resolve({ ok: true, note: "" });
    }),
  } as unknown as ServedPorts;
}

/** The scope port out of the ports, typed as present. */
function scopeOf(ports: ServedPorts): ScopePort {
  if (ports.scope === null) {
    throw new Error("the fixture has no scope port");
  }
  return ports.scope;
}

/** The say port out of the ports, typed as present. */
function sayOf(ports: ServedPorts): SayPort {
  if (ports.say === null) {
    throw new Error("the fixture has no say port");
  }
  return ports.say;
}

/** The revise port out of the ports, typed as present. */
function reviseOf(ports: ServedPorts): RevisePort {
  if (ports.revise === null) {
    throw new Error("the fixture has no revise port");
  }
  return ports.revise;
}

/** The publish port out of the ports, typed as present. */
function publishOf(ports: ServedPorts): PublishPort {
  if (ports.publish === null) {
    throw new Error("the fixture has no publish port");
  }
  return ports.publish;
}

/** The port out of the ports, typed as present. */
function portOf(ports: ServedPorts): AnswerPort {
  if (ports.answer === null) {
    throw new Error("the fixture has no port");
  }
  return ports.answer;
}

/** An app served on an ephemeral port, until `stop` aborts. */
async function served(app: Hono<PageEnv>): Promise<{
  base: string;
  stop: AbortController;
  closed: Promise<number>;
}> {
  const stop = new AbortController();
  let bound = 0;
  const closed = serveApp(
    app,
    0,
    (at) => {
      bound = at;
    },
    () => {
      throw new Error("the server refused to listen");
    },
    stop.signal,
  );
  while (bound === 0) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  return { base: `http://127.0.0.1:${String(bound)}`, stop, closed };
}

/**
 * The headers Chromium sends when a person clicks the page's native button
 * (D-0059 section 5, measured), for a page served at `base`.
 */
function pressHeaders(base: string): Record<string, string> {
  return {
    origin: base,
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "navigate",
    "sec-fetch-user": "?1",
    "sec-fetch-dest": "document",
  };
}

/**
 * One request over `node:http`, which sends the `Sec-Fetch-*` and `Origin`
 * headers it is given; a header given as `undefined` is not sent.
 */
function send(
  base: string,
  path: string,
  method: string,
  headers: Record<string, string | undefined>,
  form: Record<string, string> | null = null,
): Promise<{ status: number; body: string; location: string | undefined }> {
  const encoded = form === null ? "" : new URLSearchParams(form).toString();
  const sent = Object.fromEntries(
    Object.entries({
      ...(form === null
        ? {}
        : {
            "content-type": "application/x-www-form-urlencoded",
            "content-length": String(Buffer.byteLength(encoded)),
          }),
      ...headers,
    }).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
  return new Promise((resolve, reject) => {
    const outgoing = httpRequest(`${base}${path}`, { method, headers: sent }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => {
        body += chunk;
      });
      response.on("end", () => {
        resolve({ status: response.statusCode ?? 0, body, location: response.headers.location });
      });
    });
    outgoing.on("error", reject);
    outgoing.end(encoded);
  });
}

// The gate's form as the page draws it since D-0083 rule 3: it carries the
// request the lap is for, because that thread is where the press was made and
// where its `303` and its refusals go back to.
const FORM = { token: TOKEN, iteration: "i-0001", request: "req-1" };

/**
 * A record-scope form, as the page draws it: the hidden ids it minted and the
 * five budget numbers a person set (rondo#233 S3, D-0066 rule 1).
 */
function scopeForm(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    token: TOKEN,
    request: "req-1",
    scope_id: newScopeId(),
    // The two digests the form was drawn from, which the write compares its own
    // re-read of the plan against (rondo#233 S3 press review).
    plan_digest: `sha256:${"0".repeat(64)}`,
    agent_type: `sha256:${"1".repeat(64)}`,
    laps: "3",
    review_rounds: "2",
    cost_usd: "10",
    cost_reserve_usd: "2",
    expires_at_ms: "2026-01-01T00:00",
    severity_threshold: "major",
    ...overrides,
  };
}

/** A scoped-start form, as the page draws it: hidden ids only, no typed prompt. */
/** The held plan a start form names (rondo#238): read again in the port, never posted whole. */
const PLAN_DIGEST = `sha256:${"2".repeat(64)}`;

function startForm(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    token: TOKEN,
    request: "req-1",
    scope_decision: "decision-1",
    iteration: newIterationId(),
    plan: PLAN_DIGEST,
    ...overrides,
  };
}

/**
 * A revise form, as the page draws it: the lap being answered, the successor
 * minted at render (`newIterationId()`), the approval it runs under, and
 * rondo's draft, left with the leading and trailing space a person's edit box
 * carries but a press does not (rondo#233 S4).
 */
function reviseForm(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    token: TOKEN,
    iteration: "i-0001",
    request: "req-1",
    successor: newIterationId(),
    scope_decision: "decision-1",
    body: "  fix the parser, and leave the command line alone  ",
    ...overrides,
  };
}

/**
 * The digest a publish screen drew, as the press carries it back (rondo#233
 * S5). Its value is the renderer's; what this file tests is that it is carried
 * and that nothing is published without one.
 */
const SHOWN = `sha256:${"a".repeat(64)}`;

/**
 * A publish form, as the page draws it: the lap, the digest of the dry-run it
 * was drawn from, and nothing a person typed. The override press adds one more
 * field, and this form is the one without it.
 */
function publishForm(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    token: TOKEN,
    iteration: "i-0001",
    request: "req-1",
    shown: SHOWN,
    ...overrides,
  };
}

/** A publish form with its `shown` field dropped: a press from no screen. */
function withoutShown(form: Record<string, string>): Record<string, string> {
  const rest = { ...form };
  delete rest["shown"];
  return rest;
}

/** A form with its `token` field dropped, the shape a request with no token takes. */
function withoutToken(form: Record<string, string>): Record<string, string> {
  const rest = { ...form };
  delete rest["token"];
  return rest;
}

test("(a) a person's native press is minted, and it writes the one word once", async () => {
  const written: Written = [];
  const { base, stop, closed } = await served(createApp(spyPorts(written), TOKEN));

  const pressed = await send(base, "/?lang=en", "POST", pressHeaders(base), {
    ...FORM,
    body: "revise",
  });
  expect(pressed.status).toBe(303);
  expect(pressed.location).toBe("/?thread=req-1&lang=en");
  // The form's `body` is not read: the port's word is the page's one word.
  expect(written).toEqual([{ iterationId: "i-0001", body: "approve" }]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(a) every other shape of request to the write route is refused and writes nothing", async () => {
  const written: Written = [];
  const { base, stop, closed } = await served(createApp(spyPorts(written), TOKEN));
  const person = pressHeaders(base);

  const refusals: [string, Record<string, string | undefined>, Record<string, string>][] = [
    // A script's `form.submit()` with no gesture: a navigation, and no `?1`.
    ["missing Sec-Fetch-User", { ...person, "sec-fetch-user": undefined }, FORM],
    // htmx's `hx-post`, whether a person clicked or not (D-0059 section 5a).
    [
      "an htmx hx-post",
      {
        ...person,
        "hx-request": "true",
        "sec-fetch-mode": "cors",
        "sec-fetch-dest": "empty",
        "sec-fetch-user": undefined,
      },
      FORM,
    ],
    // `fetch(..., {method: "POST"})` from this page's own origin.
    [
      "a same-origin fetch",
      { ...person, "sec-fetch-mode": "cors", "sec-fetch-user": undefined },
      FORM,
    ],
    ["a wrong token", person, { ...FORM, token: "not-the-token" }],
    ["no token", person, { iteration: "i-0001" }],
    ["a foreign Origin", { ...person, origin: "https://evil.example" }, FORM],
    ["a cross-site Sec-Fetch-Site", { ...person, "sec-fetch-site": "cross-site" }, FORM],
    ["a same-site Sec-Fetch-Site", { ...person, "sec-fetch-site": "same-site" }, FORM],
    ["no Origin at all", { ...person, origin: undefined }, FORM],
    ["an opaque Origin", { ...person, origin: "null" }, FORM],
  ];
  for (const [shape, headers, form] of refusals) {
    const answered = await send(base, "/", "POST", headers, form);
    expect(answered.status, shape).toBe(403);
    expect(answered.body, shape).not.toBe("");
  }
  // Another verb never reaches a route at all; that a `GET` cannot mint a press
  // is (c) below.
  expect((await send(base, "/", "PUT", person, FORM)).status).toBe(405);

  expect(written).toEqual([]);
  stop.abort();
  expect(await closed).toBe(0);
});

test("(a) a request that never crossed the socket mints nothing, whatever its headers say", async () => {
  // In-process a writer can build a request with every press header and the
  // token: `Sec-Fetch-*` are forbidden to a page, not to Node. It is refused
  // because no listener registered it.
  // It goes as far as forging the adapter's own binding, the parsed socket
  // request a press reads its method and headers off.
  const written: Written = [];
  const app = createApp(spyPorts(written), TOKEN);
  const headers = {
    host: "127.0.0.1",
    ...pressHeaders("http://127.0.0.1"),
    "content-type": "application/x-www-form-urlencoded",
  };
  const forged = await app.request(
    "http://127.0.0.1/",
    { method: "POST", headers, body: new URLSearchParams(FORM).toString() },
    { incoming: { method: "POST", headers } },
  );
  expect(forged.status).toBe(403);
  expect(written).toEqual([]);
});

test("(a) a press is one write: the port spends it, and a request mints at most one", async () => {
  const written: Written = [];
  const ports = spyPorts(written);
  const app = createApp(ports, TOKEN);
  const outcomes: string[] = [];
  // A write route planted beside the real one, pressed by a person: it tries to
  // turn one press into two writes, and one request into two presses.
  app.post("/twice", async (c) => {
    const form = await c.req.parseBody();
    const first = mintPress(c, form["token"]);
    if (!("press" in first)) {
      return c.text(first.line, first.status);
    }
    outcomes.push(String((await portOf(ports).answer(first.press, "i-0001")).ok));
    outcomes.push(String((await portOf(ports).answer(first.press, "i-0002")).ok));
    outcomes.push("press" in mintPress(c, form["token"]) ? "minted" : "refused");
    return c.text("done");
  });
  const { base, stop, closed } = await served(app);

  expect((await send(base, "/twice", "POST", pressHeaders(base), FORM)).status).toBe(200);
  expect(outcomes).toEqual(["true", "false", "refused"]);
  expect(written).toEqual([{ iterationId: "i-0001", body: "approve" }]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(scope) a person's native press records one scope and approves it, once", async () => {
  const scoped: Scoped = [];
  const { base, stop, closed } = await served(createApp(spyPorts([], [], scoped), TOKEN));

  const form = scopeForm();
  const pressed = await send(base, "/scope", "POST", pressHeaders(base), form);
  expect(pressed.status).toBe(303);
  // The plan the scope was drawn over rides along, so the start is that plan's (rondo#238).
  expect(pressed.location).toBe(
    `/?scope=req-1&decision=decision-1&plan=${encodeURIComponent(`sha256:${"0".repeat(64)}`)}&lang=en#scope`,
  );
  expect(scoped).toEqual([
    {
      scopeId: form["scope_id"],
      requestMessageId: "req-1",
      planDigest: form["plan_digest"],
      agentTypeDigest: form["agent_type"],
      budgets: {
        laps: 3,
        review_rounds: 2,
        cost_usd: 10,
        cost_reserve_usd: 2,
        expires_at_ms: Date.parse("2026-01-01T00:00Z"),
      },
      severityThreshold: "major",
      outwardActs: [],
    },
  ]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(scope) every other shape of request to the record-scope route is refused and writes nothing", async () => {
  const scoped: Scoped = [];
  const { base, stop, closed } = await served(createApp(spyPorts([], [], scoped), TOKEN));
  const person = pressHeaders(base);

  const refusals: [string, Record<string, string | undefined>, Record<string, string>][] = [
    ["missing Sec-Fetch-User", { ...person, "sec-fetch-user": undefined }, scopeForm()],
    [
      "an htmx hx-post",
      {
        ...person,
        "hx-request": "true",
        "sec-fetch-mode": "cors",
        "sec-fetch-dest": "empty",
        "sec-fetch-user": undefined,
      },
      scopeForm(),
    ],
    [
      "a same-origin fetch",
      { ...person, "sec-fetch-mode": "cors", "sec-fetch-user": undefined },
      scopeForm(),
    ],
    ["a GET-shaped POST with a wrong token", person, scopeForm({ token: "not-the-token" })],
    ["no token", person, withoutToken(scopeForm())],
    ["a foreign Origin", { ...person, origin: "https://evil.example" }, scopeForm()],
    ["a cross-site Sec-Fetch-Site", { ...person, "sec-fetch-site": "cross-site" }, scopeForm()],
    ["a same-site Sec-Fetch-Site", { ...person, "sec-fetch-site": "same-site" }, scopeForm()],
    ["no Origin at all", { ...person, origin: undefined }, scopeForm()],
    ["an opaque Origin", { ...person, origin: "null" }, scopeForm()],
  ];
  for (const [shape, headers, form] of refusals) {
    const answered = await send(base, "/scope", "POST", headers, form);
    expect(answered.status, shape).toBe(403);
    expect(answered.body, shape).not.toBe("");
  }
  expect((await send(base, "/scope", "GET", person)).status).toBe(404);
  expect(scoped).toEqual([]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(scope) a refused press writes nothing and leads back to the screen it was pressed on, at the rounds it was drawn at", async () => {
  const scoped: Scoped = [];
  const { base, stop, closed } = await served(createApp(spyPorts([], [], scoped), TOKEN));
  const person = pressHeaders(base);

  // The form is drawn from the plan, so a press missing what it was drawn from
  // is a press from something that is not this page's form (rondo#233 S3 press
  // review). Refused rather than re-read, because a plan read at press time
  // with nothing to compare it against is the hole the hidden fields close.
  for (const missing of ["plan_digest", "agent_type"]) {
    const form = scopeForm({ review_rounds: "5" });
    delete form[missing];
    const refused = await send(base, "/scope", "POST", person, form);
    expect(refused.status, missing).toBe(400);
    expect(refused.body, missing).toContain("one of the numbers is not a number rondo can use");
    // **The way back to what was typed**, as a refused send and a refused claim
    // both already say, and back to the *rounds the person chose*: the address
    // carries that choice and the form posts no address, so a refusal that
    // dropped it redrew every budget at rondo's default.
    expect(refused.body, missing).toContain("Back button returns to what you wrote");
    // And back to the plan it was drawn over, when the press still said which
    // (rondo#238): the list would otherwise redraw on its first plan.
    expect(refused.body, missing).toContain(
      missing === "plan_digest"
        ? "/?scope=req-1&amp;rounds=5&amp;lang=en"
        : "/?scope=req-1&amp;rounds=5&amp;plan=sha256%3A",
    );
  }
  expect(scoped).toEqual([]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(scope) a send minted for the record-scope route cannot be spent there: only a press can", async () => {
  const scoped: Scoped = [];
  const ports = spyPorts([], [], scoped);
  const app = createApp(ports, TOKEN);
  const outcomes: string[] = [];
  const draft = {
    scopeId: newScopeId(),
    requestMessageId: "req-1",
    planDigest: `sha256:${"0".repeat(64)}`,
    agentTypeDigest: `sha256:${"1".repeat(64)}`,
    budgets: { laps: 1, review_rounds: 1, cost_usd: 1, cost_reserve_usd: 1, expires_at_ms: 1 },
    severityThreshold: "major" as const,
    outwardActs: [],
  };
  app.post("/planted/send-as-scope-press", async (c) => {
    const minting = mintSend(c, TOKEN);
    if ("send" in minting) {
      const result = await scopeOf(ports).recordAndApprove(minting.send as unknown as Press, draft);
      outcomes.push(String(result.ok));
    }
    return c.text("done");
  });
  const { base, stop, closed } = await served(app);

  await send(base, "/planted/send-as-scope-press", "POST", htmxHeaders(base), { token: TOKEN });
  expect(outcomes).toEqual(["false"]);
  expect(scoped).toEqual([]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(scope) a record-scope press is one write: the port spends it, and a request mints at most one", async () => {
  const scoped: Scoped = [];
  const ports = spyPorts([], [], scoped);
  const app = createApp(ports, TOKEN);
  const outcomes: string[] = [];
  const draft = {
    scopeId: newScopeId(),
    requestMessageId: "req-1",
    planDigest: `sha256:${"0".repeat(64)}`,
    agentTypeDigest: `sha256:${"1".repeat(64)}`,
    budgets: { laps: 1, review_rounds: 1, cost_usd: 1, cost_reserve_usd: 1, expires_at_ms: 1 },
    severityThreshold: "major" as const,
    outwardActs: [],
  };
  app.post("/twice-scope", async (c) => {
    const form = await c.req.parseBody();
    const first = mintPress(c, form["token"]);
    if (!("press" in first)) {
      return c.text(first.line, first.status);
    }
    outcomes.push(String((await scopeOf(ports).recordAndApprove(first.press, draft)).ok));
    outcomes.push(String((await scopeOf(ports).recordAndApprove(first.press, draft)).ok));
    outcomes.push("press" in mintPress(c, form["token"]) ? "minted" : "refused");
    return c.text("done");
  });
  const { base, stop, closed } = await served(app);

  expect((await send(base, "/twice-scope", "POST", pressHeaders(base), FORM)).status).toBe(200);
  expect(outcomes).toEqual(["true", "false", "refused"]);
  expect(scoped).toEqual([draft]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(start) a person's native press starts one lap under the scope, once", async () => {
  const started: Started = [];
  const { base, stop, closed } = await served(createApp(spyPorts([], [], [], started), TOKEN));

  const form = startForm();
  const pressed = await send(base, "/start", "POST", pressHeaders(base), form);
  expect(pressed.status).toBe(303);
  // Into the request's thread, where the lap it started draws its lines: the
  // summary carried no anchor for the lap, so this used to land on nothing.
  expect(pressed.location).toBe("/?thread=req-1&lang=en");
  expect(started).toEqual([
    {
      iterationId: form["iteration"],
      requestMessageId: "req-1",
      scopeDecisionId: "decision-1",
      planDigest: PLAN_DIGEST,
    },
  ]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(start) every other shape of request to the scoped-start route is refused and writes nothing", async () => {
  const started: Started = [];
  const { base, stop, closed } = await served(createApp(spyPorts([], [], [], started), TOKEN));
  const person = pressHeaders(base);

  const refusals: [string, Record<string, string | undefined>, Record<string, string>][] = [
    ["missing Sec-Fetch-User", { ...person, "sec-fetch-user": undefined }, startForm()],
    [
      "an htmx hx-post",
      {
        ...person,
        "hx-request": "true",
        "sec-fetch-mode": "cors",
        "sec-fetch-dest": "empty",
        "sec-fetch-user": undefined,
      },
      startForm(),
    ],
    [
      "a same-origin fetch",
      { ...person, "sec-fetch-mode": "cors", "sec-fetch-user": undefined },
      startForm(),
    ],
    ["a wrong token", person, startForm({ token: "not-the-token" })],
    ["no token", person, withoutToken(startForm())],
    ["a foreign Origin", { ...person, origin: "https://evil.example" }, startForm()],
    ["a cross-site Sec-Fetch-Site", { ...person, "sec-fetch-site": "cross-site" }, startForm()],
    ["a same-site Sec-Fetch-Site", { ...person, "sec-fetch-site": "same-site" }, startForm()],
    ["no Origin at all", { ...person, origin: undefined }, startForm()],
    ["an opaque Origin", { ...person, origin: "null" }, startForm()],
  ];
  for (const [shape, headers, form] of refusals) {
    const answered = await send(base, "/start", "POST", headers, form);
    expect(answered.status, shape).toBe(403);
    expect(answered.body, shape).not.toBe("");
  }
  expect((await send(base, "/start", "GET", person)).status).toBe(404);
  // A press that names no held plan is not this page's form (rondo#238): the
  // plan the lap runs on is always the one the screen drew.
  const noPlan = startForm();
  delete noPlan["plan"];
  expect((await send(base, "/start", "POST", person, noPlan)).status).toBe(400);
  expect(started).toEqual([]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(start) a send minted for the scoped-start route cannot be spent there: only a press can", async () => {
  const started: Started = [];
  const ports = spyPorts([], [], [], started);
  const app = createApp(ports, TOKEN);
  const outcomes: string[] = [];
  const input = {
    iterationId: newIterationId(),
    requestMessageId: "req-1",
    scopeDecisionId: "decision-1",
    planDigest: PLAN_DIGEST,
  };
  app.post("/planted/send-as-start-press", async (c) => {
    const minting = mintSend(c, TOKEN);
    if ("send" in minting) {
      const result = await scopeOf(ports).start(minting.send as unknown as Press, input);
      outcomes.push(String(result.ok));
    }
    return c.text("done");
  });
  const { base, stop, closed } = await served(app);

  await send(base, "/planted/send-as-start-press", "POST", htmxHeaders(base), { token: TOKEN });
  expect(outcomes).toEqual(["false"]);
  expect(started).toEqual([]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(start) a scoped-start press is one write: the port spends it, and a request mints at most one", async () => {
  const started: Started = [];
  const ports = spyPorts([], [], [], started);
  const app = createApp(ports, TOKEN);
  const outcomes: string[] = [];
  const input = {
    iterationId: newIterationId(),
    requestMessageId: "req-1",
    scopeDecisionId: "decision-1",
    planDigest: PLAN_DIGEST,
  };
  app.post("/twice-start", async (c) => {
    const form = await c.req.parseBody();
    const first = mintPress(c, form["token"]);
    if (!("press" in first)) {
      return c.text(first.line, first.status);
    }
    outcomes.push(String((await scopeOf(ports).start(first.press, input)).ok));
    outcomes.push(String((await scopeOf(ports).start(first.press, input)).ok));
    outcomes.push("press" in mintPress(c, form["token"]) ? "minted" : "refused");
    return c.text("done");
  });
  const { base, stop, closed } = await served(app);

  expect((await send(base, "/twice-start", "POST", pressHeaders(base), FORM)).status).toBe(200);
  expect(outcomes).toEqual(["true", "false", "refused"]);
  expect(started).toEqual([input]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(scope, start) the planted writers, reached by a GET, record and start nothing", async () => {
  const scoped: Scoped = [];
  const started: Started = [];
  const ports = spyPorts([], [], scoped, started);
  const port = scopeOf(ports);
  const ran: string[] = [];
  const app = createApp(ports, TOKEN);
  const draft = {
    scopeId: newScopeId(),
    requestMessageId: "req-1",
    planDigest: `sha256:${"0".repeat(64)}`,
    agentTypeDigest: `sha256:${"1".repeat(64)}`,
    budgets: { laps: 1, review_rounds: 1, cost_usd: 1, cost_reserve_usd: 1, expires_at_ms: 1 },
    severityThreshold: "major" as const,
    outwardActs: [],
  };
  const input = {
    iterationId: newIterationId(),
    requestMessageId: "req-1",
    scopeDecisionId: "decision-1",
    planDigest: PLAN_DIGEST,
  };
  const plantedScope = async (c: Context<PageEnv>, name: string): Promise<void> => {
    ran.push(name);
    const minting = mintPress(c, TOKEN);
    await port.recordAndApprove("press" in minting ? minting.press : ({} as Press), draft);
    await port.recordAndApprove(Object.freeze({}) as Press, draft);
    await port.start("press" in minting ? minting.press : ({} as Press), input);
    await port.start(Object.freeze({}) as Press, input);
  };

  // 1. A `GET` handler calling the port directly.
  app.get("/planted/scope-handler", async (c) => {
    await plantedScope(c, "handler");
    return c.text("drawn");
  });
  // 2. A middleware calling it on the way through.
  app.use("/planted/scope-middleware", async (c, next) => {
    await plantedScope(c, "middleware");
    await next();
  });
  // 3. A mounted sub-app calling it.
  const sub = new Hono<PageEnv>();
  sub.get("/", async (c) => {
    await plantedScope(c, "sub-app");
    return c.text("drawn");
  });
  app.route("/planted/scope-sub", sub);
  // 4. A loader: it reads the token the page renders, returns it to the
  // client as data, and then calls the port with a press minted from its own
  // request.
  app.get("/planted/scope-loader", async (c) => {
    ran.push("loader");
    const minting = mintPress(c, TOKEN);
    if ("press" in minting) {
      await port.recordAndApprove(minting.press, draft);
      await port.start(minting.press, input);
    }
    return c.json({ token: TOKEN, refused: "status" in minting });
  });

  const { base, stop, closed } = await served(app);
  for (const path of [
    "/planted/scope-handler",
    "/planted/scope-middleware",
    "/planted/scope-sub",
    `/planted/scope-loader?token=${TOKEN}`,
  ]) {
    await send(base, path, "GET", pressHeaders(base));
  }

  expect(new Set(ran)).toEqual(new Set(["handler", "middleware", "sub-app", "loader"]));
  expect(scoped).toEqual([]);
  expect(started).toEqual([]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(revise) a person's native press answers the gate with a change, once", async () => {
  const revised: Revised = [];
  const { base, stop, closed } = await served(createApp(spyPorts([], [], [], [], revised), TOKEN));

  const form = reviseForm();
  const pressed = await send(base, "/revise", "POST", pressHeaders(base), form);
  expect(pressed.status).toBe(303);
  expect(pressed.location).toBe("/?thread=req-1&lang=en");
  expect(revised).toEqual([
    {
      iterationId: "i-0001",
      successorId: form["successor"],
      scopeDecisionId: "decision-1",
      body: (form["body"] ?? "").trim(),
    },
  ]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(revise) every other shape of request to the revise route is refused and writes nothing", async () => {
  const revised: Revised = [];
  const { base, stop, closed } = await served(createApp(spyPorts([], [], [], [], revised), TOKEN));
  const person = pressHeaders(base);

  const refusals: [string, Record<string, string | undefined>, Record<string, string>][] = [
    ["missing Sec-Fetch-User", { ...person, "sec-fetch-user": undefined }, reviseForm()],
    [
      "an htmx hx-post",
      {
        ...person,
        "hx-request": "true",
        "sec-fetch-mode": "cors",
        "sec-fetch-dest": "empty",
        "sec-fetch-user": undefined,
      },
      reviseForm(),
    ],
    [
      "a same-origin fetch",
      { ...person, "sec-fetch-mode": "cors", "sec-fetch-user": undefined },
      reviseForm(),
    ],
    ["a wrong token", person, reviseForm({ token: "not-the-token" })],
    ["no token", person, withoutToken(reviseForm())],
    ["a foreign Origin", { ...person, origin: "https://evil.example" }, reviseForm()],
    ["a cross-site Sec-Fetch-Site", { ...person, "sec-fetch-site": "cross-site" }, reviseForm()],
    ["a same-site Sec-Fetch-Site", { ...person, "sec-fetch-site": "same-site" }, reviseForm()],
    ["no Origin at all", { ...person, origin: undefined }, reviseForm()],
    ["an opaque Origin", { ...person, origin: "null" }, reviseForm()],
  ];
  for (const [shape, headers, form] of refusals) {
    const answered = await send(base, "/revise", "POST", headers, form);
    expect(answered.status, shape).toBe(403);
    expect(answered.body, shape).not.toBe("");
  }
  expect((await send(base, "/revise", "GET", person)).status).toBe(404);
  expect(revised).toEqual([]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(revise) a send minted for the revise route cannot be spent there: only a press can", async () => {
  const revised: Revised = [];
  const ports = spyPorts([], [], [], [], revised);
  const app = createApp(ports, TOKEN);
  const outcomes: string[] = [];
  const input: ReviseInput = {
    iterationId: "i-0001",
    successorId: newIterationId(),
    scopeDecisionId: "decision-1",
    body: "fix the parser",
  };
  app.post("/planted/send-as-revise-press", async (c) => {
    const minting = mintSend(c, TOKEN);
    if ("send" in minting) {
      const result = await reviseOf(ports).revise(minting.send as unknown as Press, input);
      outcomes.push(String(result.ok));
    }
    return c.text("done");
  });
  const { base, stop, closed } = await served(app);

  await send(base, "/planted/send-as-revise-press", "POST", htmxHeaders(base), { token: TOKEN });
  expect(outcomes).toEqual(["false"]);
  expect(revised).toEqual([]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(revise) a revise press is one write: the port spends it, and a request mints at most one", async () => {
  const revised: Revised = [];
  const ports = spyPorts([], [], [], [], revised);
  const app = createApp(ports, TOKEN);
  const outcomes: string[] = [];
  const input: ReviseInput = {
    iterationId: "i-0001",
    successorId: newIterationId(),
    scopeDecisionId: "decision-1",
    body: "fix the parser",
  };
  app.post("/twice-revise", async (c) => {
    const form = await c.req.parseBody();
    const first = mintPress(c, form["token"]);
    if (!("press" in first)) {
      return c.text(first.line, first.status);
    }
    outcomes.push(String((await reviseOf(ports).revise(first.press, input)).ok));
    outcomes.push(String((await reviseOf(ports).revise(first.press, input)).ok));
    outcomes.push("press" in mintPress(c, form["token"]) ? "minted" : "refused");
    return c.text("done");
  });
  const { base, stop, closed } = await served(app);

  expect((await send(base, "/twice-revise", "POST", pressHeaders(base), FORM)).status).toBe(200);
  expect(outcomes).toEqual(["true", "false", "refused"]);
  expect(revised).toEqual([input]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(revise) the planted writers, reached by a GET, revise nothing", async () => {
  const revised: Revised = [];
  const ports = spyPorts([], [], [], [], revised);
  const port = reviseOf(ports);
  const ran: string[] = [];
  const app = createApp(ports, TOKEN);
  const input: ReviseInput = {
    iterationId: "i-0001",
    successorId: newIterationId(),
    scopeDecisionId: "decision-1",
    body: "fix the parser",
  };
  const plantedRevise = async (c: Context<PageEnv>, name: string): Promise<void> => {
    ran.push(name);
    const minting = mintPress(c, TOKEN);
    await port.revise("press" in minting ? minting.press : ({} as Press), input);
    await port.revise(Object.freeze({}) as Press, input);
  };

  // 1. A `GET` handler calling the port directly.
  app.get("/planted/revise-handler", async (c) => {
    await plantedRevise(c, "handler");
    return c.text("drawn");
  });
  // 2. A middleware calling it on the way through.
  app.use("/planted/revise-middleware", async (c, next) => {
    await plantedRevise(c, "middleware");
    await next();
  });
  // 3. A mounted sub-app calling it.
  const sub = new Hono<PageEnv>();
  sub.get("/", async (c) => {
    await plantedRevise(c, "sub-app");
    return c.text("drawn");
  });
  app.route("/planted/revise-sub", sub);
  // 4. A loader: it reads the token the page renders, returns it to the
  // client as data, and then calls the port with a press minted from its own
  // request.
  app.get("/planted/revise-loader", async (c) => {
    ran.push("loader");
    const minting = mintPress(c, TOKEN);
    if ("press" in minting) {
      await port.revise(minting.press, input);
    }
    return c.json({ token: TOKEN, refused: "status" in minting });
  });

  const { base, stop, closed } = await served(app);
  for (const path of [
    "/planted/revise-handler",
    "/planted/revise-middleware",
    "/planted/revise-sub",
    `/planted/revise-loader?token=${TOKEN}`,
  ]) {
    await send(base, path, "GET", pressHeaders(base));
  }

  expect(new Set(ran)).toEqual(new Set(["handler", "middleware", "sub-app", "loader"]));
  expect(revised).toEqual([]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(revise) an empty or whitespace-only body is refused by the port, not the route's shape check", async () => {
  // The route's own shape check reads only the three ids; a blank box passes
  // it and is refused inside the capability instead (`RevisePort.revise`),
  // the same way an approve press's blank claim is refused inside `AnswerPort`.
  const revised: Revised = [];
  const { base, stop, closed } = await served(createApp(spyPorts([], [], [], [], revised), TOKEN));
  const person = pressHeaders(base);

  for (const body of ["", "   \n\t  "]) {
    const answered = await send(base, "/revise", "POST", person, reviseForm({ body }));
    expect(answered.status, JSON.stringify(body)).toBe(400);
    expect(answered.body, JSON.stringify(body)).toContain("the box was empty");
  }
  expect(revised).toEqual([]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(publish) a person's native press publishes the lap it was shown, once", async () => {
  const published: Published = [];
  const { base, stop, closed } = await served(
    createApp(spyPorts([], [], [], [], [], published), TOKEN),
  );

  const form = publishForm();
  const pressed = await send(base, "/publish", "POST", pressHeaders(base), form);
  expect(pressed.status).toBe(303);
  // Into the request's thread, where what the publish did is said; the summary
  // this used to land on had no anchor for the lap and showed nothing of it.
  expect(pressed.location).toBe("/?thread=req-1&lang=en");
  expect(published).toEqual([{ iterationId: "i-0001", shown: SHOWN, despiteReview: false }]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(publish) the second press carries the override, and only when the form says exactly that", async () => {
  const published: Published = [];
  const { base, stop, closed } = await served(
    createApp(spyPorts([], [], [], [], [], published), TOKEN),
  );
  const person = pressHeaders(base);

  expect(
    (await send(base, "/publish", "POST", person, publishForm({ despite_review: "yes" }))).status,
  ).toBe(303);
  // Anything else in that field is a form this page did not draw, and it is
  // read as the ordinary press rather than as the override.
  for (const said of ["true", "1", "on", "Yes", ""]) {
    expect(
      (await send(base, "/publish", "POST", person, publishForm({ despite_review: said }))).status,
      said,
    ).toBe(303);
  }
  expect(published.map((input) => input.despiteReview)).toEqual([
    true,
    false,
    false,
    false,
    false,
    false,
  ]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(publish) every other shape of request to the publish route is refused and publishes nothing", async () => {
  const published: Published = [];
  const { base, stop, closed } = await served(
    createApp(spyPorts([], [], [], [], [], published), TOKEN),
  );
  const person = pressHeaders(base);

  const refusals: [string, Record<string, string | undefined>, Record<string, string>][] = [
    ["missing Sec-Fetch-User", { ...person, "sec-fetch-user": undefined }, publishForm()],
    [
      "an htmx hx-post",
      {
        ...person,
        "hx-request": "true",
        "sec-fetch-mode": "cors",
        "sec-fetch-dest": "empty",
        "sec-fetch-user": undefined,
      },
      publishForm(),
    ],
    [
      "a same-origin fetch",
      { ...person, "sec-fetch-mode": "cors", "sec-fetch-user": undefined },
      publishForm(),
    ],
    ["a wrong token", person, publishForm({ token: "not-the-token" })],
    ["no token", person, withoutToken(publishForm())],
    ["a foreign Origin", { ...person, origin: "https://evil.example" }, publishForm()],
    ["a cross-site Sec-Fetch-Site", { ...person, "sec-fetch-site": "cross-site" }, publishForm()],
    ["a same-site Sec-Fetch-Site", { ...person, "sec-fetch-site": "same-site" }, publishForm()],
    ["no Origin at all", { ...person, origin: undefined }, publishForm()],
    ["an opaque Origin", { ...person, origin: "null" }, publishForm()],
  ];
  for (const [shape, headers, form] of refusals) {
    const pressed = await send(base, "/publish", "POST", headers, form);
    expect(pressed.status, shape).toBe(403);
    expect(pressed.body, shape).not.toBe("");
  }
  expect((await send(base, "/publish", "GET", person)).status).toBe(404);
  expect(published).toEqual([]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(publish) a press naming no dry-run is refused by the route's shape check", async () => {
  // **What was shown is what may be published** (D-0059 section 5a's Q1): a
  // press with no digest is a press from no screen, and the route refuses it
  // before the port is reached.
  const published: Published = [];
  const { base, stop, closed } = await served(
    createApp(spyPorts([], [], [], [], [], published), TOKEN),
  );
  const person = pressHeaders(base);

  for (const form of [
    withoutShown(publishForm()),
    publishForm({ shown: "" }),
    publishForm({ iteration: "" }),
  ]) {
    const pressed = await send(base, "/publish", "POST", person, form);
    expect(pressed.status).toBe(400);
    expect(pressed.body).not.toBe("");
  }
  expect(published).toEqual([]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(publish) a send minted for the publish route cannot be spent there: only a press can", async () => {
  const published: Published = [];
  const ports = spyPorts([], [], [], [], [], published);
  const app = createApp(ports, TOKEN);
  const outcomes: string[] = [];
  const input: PublishInput = { iterationId: "i-0001", shown: SHOWN, despiteReview: false };
  app.post("/planted/send-as-publish-press", async (c) => {
    const minting = mintSend(c, TOKEN);
    if ("send" in minting) {
      const result = await publishOf(ports).publish(minting.send as unknown as Press, input);
      outcomes.push(String(result.ok));
    }
    return c.text("done");
  });
  const { base, stop, closed } = await served(app);

  await send(base, "/planted/send-as-publish-press", "POST", htmxHeaders(base), { token: TOKEN });
  expect(outcomes).toEqual(["false"]);
  expect(published).toEqual([]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(publish) a publish press is one write: the port spends it, and a request mints at most one", async () => {
  const published: Published = [];
  const ports = spyPorts([], [], [], [], [], published);
  const app = createApp(ports, TOKEN);
  const outcomes: string[] = [];
  const input: PublishInput = { iterationId: "i-0001", shown: SHOWN, despiteReview: false };
  app.post("/twice-publish", async (c) => {
    const form = await c.req.parseBody();
    const first = mintPress(c, form["token"]);
    if (!("press" in first)) {
      return c.text(first.line, first.status);
    }
    outcomes.push(String((await publishOf(ports).publish(first.press, input)).ok));
    outcomes.push(String((await publishOf(ports).publish(first.press, input)).ok));
    outcomes.push("press" in mintPress(c, form["token"]) ? "minted" : "refused");
    return c.text("done");
  });
  const { base, stop, closed } = await served(app);

  expect((await send(base, "/twice-publish", "POST", pressHeaders(base), FORM)).status).toBe(200);
  expect(outcomes).toEqual(["true", "false", "refused"]);
  expect(published).toEqual([input]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(publish) the planted writers, reached by a GET, publish nothing", async () => {
  const published: Published = [];
  const ports = spyPorts([], [], [], [], [], published);
  const port = publishOf(ports);
  const ran: string[] = [];
  const app = createApp(ports, TOKEN);
  const input: PublishInput = { iterationId: "i-0001", shown: SHOWN, despiteReview: false };
  const plantedPublish = async (c: Context<PageEnv>, name: string): Promise<void> => {
    ran.push(name);
    const minting = mintPress(c, TOKEN);
    await port.publish("press" in minting ? minting.press : ({} as Press), input);
    await port.publish(Object.freeze({}) as Press, input);
  };

  // 1. A `GET` handler calling the port directly.
  app.get("/planted/publish-handler", async (c) => {
    await plantedPublish(c, "handler");
    return c.text("drawn");
  });
  // 2. A middleware calling it on the way through.
  app.use("/planted/publish-middleware", async (c, next) => {
    await plantedPublish(c, "middleware");
    await next();
  });
  // 3. A mounted sub-app calling it.
  const sub = new Hono<PageEnv>();
  sub.get("/", async (c) => {
    await plantedPublish(c, "sub-app");
    return c.text("drawn");
  });
  app.route("/planted/publish-sub", sub);
  // 4. A loader: it reads the token the page renders, returns it to the client
  // as data, and then calls the port with a press minted from its own request.
  app.get("/planted/publish-loader", async (c) => {
    ran.push("loader");
    const minting = mintPress(c, TOKEN);
    if ("press" in minting) {
      await port.publish(minting.press, input);
    }
    return c.json({ token: TOKEN, refused: "status" in minting });
  });

  const { base, stop, closed } = await served(app);
  for (const path of [
    "/planted/publish-handler",
    "/planted/publish-middleware",
    "/planted/publish-sub",
    `/planted/publish-loader?token=${TOKEN}`,
  ]) {
    await send(base, path, "GET", pressHeaders(base));
  }

  expect(new Set(ran)).toEqual(new Set(["handler", "middleware", "sub-app", "loader"]));
  expect(published).toEqual([]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(publish) a port's refusal is said in the press's language, with the way back to that screen", async () => {
  const refusing = spyPorts([], [], [], [], [], []);
  const app = createApp(
    {
      ...refusing,
      publish: new PublishPort(async () => ({
        ok: false,
        why: "publishRefusedChanged",
        note: "the dry-run moved",
      })),
    },
    TOKEN,
  );
  const { base, stop, closed } = await served(app);

  const pressed = await send(base, "/publish?lang=ja", "POST", pressHeaders(base), publishForm());
  expect(pressed.status).toBe(409);
  expect(pressed.body).toContain('<html lang="ja">');
  expect(pressed.body).toContain("公開の画面に戻る");
  expect(pressed.body).toContain('href="/?publish=i-0001&amp;lang=ja"');

  stop.abort();
  expect(await closed).toBe(0);
});

test("a refused revise or publish sends nobody to a terminal, and folds rondo's reason for its maintainer (D-0076 rule 4.2)", async () => {
  // **The host is a user service** (D-0080): its output is the journal, and
  // the person pressing is looking at this page and at no terminal. Every
  // refusal either press used to end on the terminal, in both shipped languages.
  const note = "RONDO_APPROVER 'ada' is not on the allowlist";
  const refusals = [
    ...(
      [
        "reviseRefusedNotSetUp",
        "reviseRefusedWalkFailed",
        "reviseRefusedNotSettled",
        "reviseRefusedNotStarted",
      ] as const
    ).map((why) => ({
      path: "/revise",
      form: reviseForm(),
      ports: {
        revise: new RevisePort(async () => await Promise.resolve({ ok: false, why, note })),
      },
    })),
    ...(
      [
        "publishRefusedPullRequestFailed",
        "publishRefusedRunNotClosed",
        "publishRefusedNotStarted",
      ] as const
    ).map((why) => ({
      path: "/publish",
      form: publishForm(),
      ports: {
        publish: new PublishPort(
          async () => await Promise.resolve({ ok: false, why, note, detail: "the forge said no" }),
        ),
      },
    })),
  ];
  for (const { path, form, ports } of refusals) {
    const app = createApp({ ...spyPorts([]), ...ports }, TOKEN);
    const { base, stop, closed } = await served(app);
    for (const [lang, wording] of [
      ["en", EN],
      ["ja", chromeFor("ja")],
    ] as const) {
      const refused = await send(base, `${path}?lang=${lang}`, "POST", pressHeaders(base), form);
      const body = refused.body.replaceAll("&#39;", "'");
      expect(refused.status).toBe(409);
      // The person's sentence: the fold below may name the terminal to the
      // maintainer, the sentence a person reads may not.
      const line = /<p id="scope-refused">([^<]*)<\/p>/.exec(body)?.[1] ?? "";
      expect(line, path).not.toBe("");
      expect(line, path).not.toMatch(/terminal|ターミナル/);
      // The sentence says who can look; the closed fold is what they look at:
      // the port's own reason, and where the rest of the host's output is.
      const fold = body.slice(body.indexOf('<details id="refused-reason">'));
      expect(fold).toContain(`<summary>${wording.forMaintainer}</summary>`);
      expect(fold).toContain(`<p lang="en">${note}</p>`);
      expect(fold).toContain("journalctl --user -u rondo.service");
    }
    stop.abort();
    expect(await closed).toBe(0);
  }
});

test("(claim) a press carries what the person verified, trimmed; blank is none, and too long answers nothing", async () => {
  const written: Written = [];
  const { base, stop, closed } = await served(createApp(spyPorts(written), TOKEN));
  const person = pressHeaders(base);

  const said = "  npm run verify in the lap's workspace, green  ";
  expect((await send(base, "/", "POST", person, { ...FORM, verified: said })).status).toBe(303);
  expect((await send(base, "/", "POST", person, { ...FORM, verified: " \n " })).status).toBe(303);
  expect((await send(base, "/", "POST", person, FORM)).status).toBe(303);
  const tooLong = await send(base, "/?lang=ja", "POST", person, {
    ...FORM,
    verified: "\u691c".repeat(MAX_CLAIM_CHARS + 1),
  });
  // Refused in words by the port, not by the body limit: the form still fits.
  // Said in the press's language, with the way back to the gate (S2 review).
  expect(tooLong.status).toBe(409);
  expect(tooLong.body).toContain(String(MAX_CLAIM_CHARS));
  expect(tooLong.body).toContain('<html lang="ja">');
  expect(tooLong.body).toContain("ゲートに戻る");
  expect(tooLong.body).toContain('href="/?thread=req-1&amp;lang=ja"');
  expect(written).toEqual([
    { iterationId: "i-0001", body: "approve", claim: said.trim() },
    { iterationId: "i-0001", body: "approve" },
    { iterationId: "i-0001", body: "approve" },
  ]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(claim) a claim refused past the port is said in the press's language, never pointing at a terminal", async () => {
  const ports = {
    hostLanguage: null,
    answer: new AnswerPort(
      async () =>
        await Promise.resolve({
          ok: false,
          note: "Gate g1 is already closed",
          why: "claimGateClosed" as const,
        }),
    ),
    say: null,
  } as unknown as ServedPorts;
  const { base, stop, closed } = await served(createApp(ports, TOKEN));
  for (const [lang, words] of [
    ["en", "This gate was already answered"],
    ["ja", "ゲートがすでに回答済み"],
  ] as const) {
    const refused = await send(base, `/?lang=${lang}`, "POST", pressHeaders(base), {
      ...FORM,
      verified: "ran it",
    });
    expect(refused.status).toBe(409);
    expect(refused.body).toContain(words);
    expect(refused.body).toContain(`href="/?thread=req-1&amp;lang=${lang}"`);
    expect(refused.body).not.toContain("terminal");
  }
  stop.abort();
  expect(await closed).toBe(0);
});

test("(claim) a claim cannot be carried by an htmx post, a fetch or a send", async () => {
  const written: Written = [];
  const sent: Sent = [];
  const { base, stop, closed } = await served(createApp(spyPorts(written, sent), TOKEN));
  const claimed = { ...FORM, verified: "I ran everything" };

  expect((await send(base, "/", "POST", htmxHeaders(base), claimed)).status).toBe(403);
  expect(
    (
      await send(
        base,
        "/",
        "POST",
        { ...pressHeaders(base), "sec-fetch-mode": "cors", "sec-fetch-user": undefined },
        claimed,
      )
    ).status,
  ).toBe(403);
  // A send takes the field along as nothing: the message is the words, and no
  // claim reaches the answer port.
  const messageId = newMessageId("request");
  expect(
    (
      await send(base, "/request", "POST", htmxHeaders(base), {
        token: TOKEN,
        message_id: messageId,
        body: "words",
        verified: "I ran everything",
      })
    ).status,
  ).toBe(303);
  expect(written).toEqual([]);
  expect(sent).toEqual([{ messageId, body: "words", inReplyTo: null }]);

  stop.abort();
  expect(await closed).toBe(0);
});

/**
 * The app's non-`GET` routes, as the router holds them.
 *
 * Middleware registers as `ALL`, so the middleware the page is built with is
 * part of the table below: a planted `app.use` is a new row as surely as a
 * planted `app.post` is.
 */
function nonReads(app: Hono<PageEnv>): string[] {
  return app.routes
    .filter((route) => route.method !== "GET" && route.method !== "HEAD")
    .map((route) => `${route.method} ${route.path}`);
}

/**
 * **The closed table** (D-0059 section 5a and R4): middleware -- method and
 * `Host`, security headers, `csrf` on each of the six write addresses, body
 * limit -- and eight write routes: the lap-end `approve` press, the two
 * sends into a request thread, the answer to a waiting question (which is a
 * press, D-0059 section 5a's falsifier, D-0069 rule 5), the two rondo#233 S3
 * rows -- the record-scope press and the scoped-start press -- the rondo#233 S4
 * row: the revise press, which answers the same gate as the approve press with
 * what to change and starts the second lap under the approval the first ran
 * under (D-0070) -- and the rondo#233 S5 row: the publish press, the one write
 * here that leaves this machine, pressed only from the screen that shows its
 * dry-run (D-0060). A new write kind is a new row here, argued in the decision
 * first.
 */
const WRITE_TABLE = [
  "ALL /*",
  "ALL /*",
  "ALL /",
  "ALL /request",
  "ALL /reply",
  "ALL /answer-ask",
  "ALL /revise",
  // The goal a repository's triage is ranked against (D-0097 point 2.1 (a)).
  "ALL /goal",
  "ALL /scope",
  "ALL /start",
  // The drafted scope's two presses (rondo#238 C2b, D-0071 rule 5.3).
  "ALL /scope-draft",
  // The raise press (D-0074 section 4): a budgets-only successor, approved.
  "ALL /raise",
  "ALL /start-plan",
  "ALL /publish",
  // The release press (D-0073 rule 4.3, rondo#288).
  "ALL /release",
  // Adding a repository a request named (rondo#383, D-0090).
  "ALL /add-repository",
  // The merge press (rondo#380, D-0091).
  "ALL /merge",
  // *Not now* on a candidate rondo proposed (D-0097 point 4.5 (a)).
  "ALL /not-now",
  "ALL /*",
  "POST /",
  "POST /request",
  "POST /reply",
  "POST /answer-ask",
  "POST /scope",
  "POST /scope-draft",
  "POST /raise",
  "POST /start-plan",
  "POST /start",
  "POST /revise",
  "POST /publish",
  "POST /release",
  "POST /add-repository",
  "POST /goal",
  "POST /not-now",
  "POST /merge",
];

/**
 * Which write kinds need a press, and which are sends (D-0059 section 5a's
 * table, as D-0064 P1-P4 fills it).
 *
 * **A press is minted only from a person's navigation** -- `POST`, same
 * origin, `Sec-Fetch-Mode: navigate`, `Sec-Fetch-User: ?1`, this process's
 * token -- and the measurement behind that is in D-0059 section 5: a script's
 * `requestSubmit()`, a synthetic `click()` and a `fetch` all arrive without
 * `?1`, whether or not a person clicked something else first.
 *
 * **This table exists so that the check cannot be skipped for a new route.**
 * The case below asserts that these two lists are exactly the app's own `POST`
 * routes, so a route added without being classified fails here, and then
 * drives the no-gesture request at every press route. Approving is the write
 * this protects: a handler quietly changed to answer a `fetch` would still
 * draw, still respond, and mint no press -- and nothing else would notice.
 */
const PRESS_ROUTES = [
  // The lap-end `approve` press (D-0064 O6).
  "/",
  // Answering a waiting question by option (D-0064 P2, P3; gate Q5c).
  "/answer-ask",
  // Approving a scope, and widening one (D-0064 P1; gate Q5b).
  "/scope",
  "/scope-draft",
  "/raise",
  // The scoped starts (rondo#233 S3).
  "/start",
  "/start-plan",
  // The gate's other answer (rondo#233 S4, D-0070).
  "/revise",
  // The two acts that leave this machine (D-0060, D-0073 rule 4.3).
  "/publish",
  "/release",
  // Cloning and recording a repository a request named (rondo#383, D-0090).
  "/add-repository",
  // The one irreversible act on the page, per act (D-0064 rule 3.4, D-0091).
  "/merge",
  // The person's say over what rondo ranks (D-0097 points 2.1 (a) and 4.5 (a)).
  "/goal",
  "/not-now",
];

/**
 * The writes that need a *send* and not a press: a message into a request
 * thread (D-0061 rule 4). D-0059 section 5a states what this gives up -- a
 * same-origin script can post a message no person typed -- and why the
 * residual is bounded: a message is append-only and answers no gate.
 */
const SEND_ROUTES = ["/request", "/reply"];

test("every POST route is either a press or a send, and none is unclassified", () => {
  const app = createApp(spyPorts([]), TOKEN);
  const posted = app.routes.filter((route) => route.method === "POST").map((route) => route.path);
  expect([...posted].sort()).toEqual([...PRESS_ROUTES, ...SEND_ROUTES].sort());
});

test("a press route writes nothing for a POST carrying no gesture (D-0059 section 5)", async () => {
  const written: Written = [];
  const { base, stop, closed } = await served(createApp(spyPorts(written), TOKEN));
  const person = pressHeaders(base);
  // The three shapes D-0059 measured as arriving without `?1`, and the one a
  // React page would reach for if a handler were rewritten to `fetch`.
  const noGesture: [string, Record<string, string | undefined>][] = [
    ["a script's submit, no gesture", { ...person, "sec-fetch-user": undefined }],
    ["a same-origin fetch", { ...person, "sec-fetch-mode": "cors", "sec-fetch-user": undefined }],
  ];
  for (const route of PRESS_ROUTES) {
    for (const [shape, headers] of noGesture) {
      const answered = await send(base, route, "POST", headers, { ...FORM, request: "m-1" });
      expect(answered.status, `${route} <- ${shape}`).not.toBe(200);
      expect(answered.status, `${route} <- ${shape}`).not.toBe(303);
    }
  }
  // Nothing reached the one port the spy watches.
  expect(written).toEqual([]);
  stop.abort();
  expect(await closed).toBe(0);
});

test("(b) the page's writing vocabulary is enumerated off the running app", () => {
  const app = createApp(spyPorts([]), TOKEN);
  expect(nonReads(app)).toEqual(WRITE_TABLE);

  // Not vacuously: each way of adding a writer changes the enumeration.
  // `/withdraw` is nobody's route: the page has no such write kind, and adding
  // one would be a decision before it was a row here.
  const posted = createApp(spyPorts([]), TOKEN);
  posted.post("/withdraw", (c) => c.text(""));
  expect(nonReads(posted)).not.toEqual(WRITE_TABLE);
  const used = createApp(spyPorts([]), TOKEN);
  used.use(async (_c, next) => {
    await next();
  });
  expect(nonReads(used)).not.toEqual(WRITE_TABLE);
  const mounted = createApp(spyPorts([]), TOKEN);
  mounted.route(
    "/sub",
    new Hono<PageEnv>().put("/", (c) => c.text("")),
  );
  expect(nonReads(mounted)).not.toEqual(WRITE_TABLE);
});

/**
 * What every planted writer does once it holds the port: try to mint a press
 * from the request it is handling, and failing that, hand the port a forged
 * one. Whether either wrote is read off the spy, not off this function.
 */
async function plantedWrite(
  c: Context<PageEnv>,
  port: AnswerPort,
  ran: string[],
  name: string,
): Promise<void> {
  ran.push(name);
  const minting = mintPress(c, TOKEN);
  await port.answer("press" in minting ? minting.press : ({} as Press), "i-0001");
  await port.answer(Object.freeze({}) as Press, "i-0001");
}

test("(c) the audit's planted writers, reached by a GET, write nothing", async () => {
  const written: Written = [];
  const ports = spyPorts(written);
  const port = portOf(ports);
  const ran: string[] = [];
  const app = createApp(ports, TOKEN);

  // 1. A `GET` handler calling the port directly.
  app.get("/planted/handler", async (c) => {
    await plantedWrite(c, port, ran, "handler");
    return c.text("drawn");
  });
  // 2. A middleware calling it on the way through.
  app.use("/planted/middleware", async (c, next) => {
    await plantedWrite(c, port, ran, "middleware");
    await next();
  });
  // 3. A mounted sub-app calling it.
  const sub = new Hono<PageEnv>();
  sub.get("/", async (c) => {
    await plantedWrite(c, port, ran, "sub-app");
    return c.text("drawn");
  });
  app.route("/planted/sub", sub);
  // 4. A loader: it reads the token the page renders, returns it to the client
  // as data, and then calls the port with a press minted from its own request.
  app.get("/planted/loader", async (c) => {
    ran.push("loader");
    const minting = mintPress(c, TOKEN);
    if ("press" in minting) {
      await port.answer(minting.press, "i-0001");
    }
    return c.json({ token: TOKEN, refused: "status" in minting });
  });

  const { base, stop, closed } = await served(app);
  // Every press header a person's click carries, and the token in the query,
  // so the only thing each of these lacks is being a person's `POST`.
  for (const path of [
    "/planted/handler",
    "/planted/middleware",
    "/planted/sub",
    `/planted/loader?token=${TOKEN}`,
  ]) {
    await send(base, path, "GET", pressHeaders(base));
  }
  const loader = await send(base, "/planted/loader", "GET", pressHeaders(base));
  expect(JSON.parse(loader.body)).toEqual({ token: TOKEN, refused: true });

  // Every planted writer ran -- the assertion below is about writers that were
  // reached, not about routes that never matched.
  expect(new Set(ran)).toEqual(new Set(["handler", "middleware", "sub-app", "loader"]));
  expect(written).toEqual([]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(c) a GET writer that rewrites the live request it holds into a press still writes nothing", async () => {
  // The node request's `method` is writable and its `headers` a plain object,
  // so a planted handler can make the live object say "a person's POST". A press
  // reads the copy the listener froze on arrival, so the rewrite changes nothing.
  const written: Written = [];
  const ports = spyPorts(written);
  const app = createApp(ports, TOKEN);
  let refused: boolean | null = null;
  app.get("/planted/rewrite", async (c) => {
    const incoming = c.env.incoming as { method?: string; headers: Record<string, string> };
    const host = incoming.headers["host"] ?? "";
    incoming.method = "POST";
    Object.assign(incoming.headers, pressHeaders(`http://${host}`));
    const minting = mintPress(c, TOKEN);
    refused = "status" in minting;
    if ("press" in minting) {
      await portOf(ports).answer(minting.press, "i-0001");
    }
    return c.text("drawn");
  });
  const { base, stop, closed } = await served(app);

  await send(base, "/planted/rewrite", "GET", {});
  expect(refused).toBe(true);
  expect(written).toEqual([]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(c) a fetch-shaped POST with the token, from this page's origin, writes nothing", async () => {
  const written: Written = [];
  const { base, stop, closed } = await served(createApp(spyPorts(written), TOKEN));

  // What T's loader-over-RPC, a key handler's `fetch` and an htmx `hx-post`
  // all put on the wire: same-origin, `cors`, no `?1`, the real token.
  const fetched = await send(
    base,
    "/",
    "POST",
    {
      origin: base,
      "sec-fetch-site": "same-origin",
      "sec-fetch-mode": "cors",
      "sec-fetch-dest": "empty",
    },
    FORM,
  );
  expect(fetched.status).toBe(403);
  expect(written).toEqual([]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("it serves the manifest's files as the bytes the manifest names, and no other path", async () => {
  // R1's substitute seen from the socket: every served file is one CI checks
  // against `page.manifest.json`, served at a fixed address. Run after
  // `npm run build`, which is what `npm run verify` and CI do.
  const manifest = JSON.parse(
    readFileSync(new URL("../../page.manifest.json", import.meta.url), "utf8"),
  ) as Record<string, string>;
  const { base, stop, closed } = await served(createApp(spyPorts([]), TOKEN));

  expect(Object.keys(manifest).length).toBeGreaterThan(0);
  for (const [name, sha256] of Object.entries(manifest)) {
    const response = await fetch(`${base}/${name}`);
    expect(response.status, name).toBe(200);
    expect(
      createHash("sha256")
        .update(Buffer.from(await response.arrayBuffer()))
        .digest("hex"),
      name,
    ).toBe(sha256);
  }
  expect((await fetch(`${base}/app.css`)).headers.get("content-type")).toBe(
    "text/css; charset=utf-8",
  );
  // A file that exists, at an address the map does not hold, is a 404.
  for (const path of [
    "/dist/page/app.css",
    "/page.manifest.json",
    "/page/app.css",
    "/%2e%2e/package.json",
    // The bundle lives under `assets/`, so the map holds a name with a
    // separator. These say the widening bought exactly one level and nothing
    // else: no escaping it while still spelled as a path, no second level, no
    // bare directory.
    //
    // Spellings that *resolve* to a mapped address -- `/assets/../app.css`,
    // and `/assets/%2e%2e/app.css` once the router decodes it -- are
    // deliberately not cases. Both become `/app.css`, which is a mapped
    // address, and answering it is correct. The property that matters is the
    // one below: an address the map does not hold is a 404, and the file URL
    // is built from the manifest key rather than from the request, so no
    // spelling reaches a file outside `dist/page/`.
    "/assets/",
    "/assets/sub/main.js",
  ]) {
    expect((await fetch(`${base}${path}`)).status, path).toBe(404);
  }

  stop.abort();
  expect(await closed).toBe(0);
});

/**
 * The headers Chromium sends for htmx's `hx-post` from this page (D-0059
 * section 5a, measured on the prototype): same-origin, `cors`, no `?1`.
 */
function htmxHeaders(base: string): Record<string, string> {
  return {
    origin: base,
    "hx-request": "true",
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
  };
}

/** A native form submit with script off: a navigation, with or without `?1`. */
function submitHeaders(base: string): Record<string, string> {
  return {
    origin: base,
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "navigate",
    "sec-fetch-dest": "document",
  };
}

test("(send) a native submit and an htmx hx-post each send one message", async () => {
  const sent: Sent = [];
  const written: Written = [];
  const { base, stop, closed } = await served(createApp(spyPorts(written, sent), TOKEN));

  const request = newMessageId("request");
  const native = await send(base, "/request?lang=ja", "POST", submitHeaders(base), {
    token: TOKEN,
    message_id: request,
    body: "please look at the flaky test",
    // A new request's form carries no reply target; one posted is not read.
    in_reply_to: "request-ignored",
  });
  expect(native.status).toBe(303);
  // Onto the thread, at the message just sent (#220 S1).
  expect(native.location).toBe(`/?thread=${request}&lang=ja#${request}`);

  const reply = newMessageId("reply");
  const htmx = await send(base, "/reply", "POST", htmxHeaders(base), {
    token: TOKEN,
    message_id: reply,
    in_reply_to: request,
    body: "and the lint one too",
  });
  expect(htmx.status).toBe(303);

  expect(sent).toEqual([
    { messageId: request, body: "please look at the flaky test", inReplyTo: null },
    { messageId: reply, body: "and the lint one too", inReplyTo: request },
  ]);
  // A send is not a press: the answer port was not reached.
  expect(written).toEqual([]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(send) every other shape of request to a send route is refused and sends nothing", async () => {
  const sent: Sent = [];
  const { base, stop, closed } = await served(createApp(spyPorts([], sent), TOKEN));
  const htmx = htmxHeaders(base);
  const form = { token: TOKEN, message_id: newMessageId("request"), body: "words" };

  const refusals: [
    string,
    string,
    Record<string, string | undefined>,
    Record<string, string>,
    number,
  ][] = [
    ["a wrong token", "/request", htmx, { ...form, token: "not-the-token" }, 403],
    ["no token", "/request", htmx, { message_id: form.message_id, body: "words" }, 403],
    ["a foreign Origin", "/request", { ...htmx, origin: "https://evil.example" }, form, 403],
    [
      "a cross-site Sec-Fetch-Site",
      "/request",
      { ...htmx, "sec-fetch-site": "cross-site" },
      form,
      403,
    ],
    [
      "a same-site Sec-Fetch-Site",
      "/request",
      { ...htmx, "sec-fetch-site": "same-site" },
      form,
      403,
    ],
    ["no Origin at all", "/request", { ...htmx, origin: undefined }, form, 403],
    ["an opaque Origin", "/request", { ...htmx, origin: "null" }, form, 403],
    ["no Sec-Fetch-Mode", "/request", { ...htmx, "sec-fetch-mode": undefined }, form, 403],
    ["a no-cors mode", "/request", { ...htmx, "sec-fetch-mode": "no-cors" }, form, 403],
    ["an empty body", "/request", htmx, { ...form, body: "" }, 400],
    ["a blank body", "/request", htmx, { ...form, body: " \n\t" }, 400],
    ["no body field", "/request", htmx, { token: TOKEN, message_id: form.message_id }, 400],
    ["a typed message id", "/request", htmx, { ...form, message_id: "my-id" }, 400],
    ["no message id", "/request", htmx, { token: TOKEN, body: "words" }, 400],
    ["a reply naming nothing", "/reply", htmx, { ...form, message_id: newMessageId("reply") }, 400],
    ["an oversize body", "/request", htmx, { ...form, body: "x".repeat(70 * 1024) }, 413],
  ];
  for (const [shape, path, headers, posted, status] of refusals) {
    const answered = await send(base, path, "POST", headers, posted);
    expect(answered.status, shape).toBe(status);
    expect(answered.body, shape).not.toBe("");
  }
  // A `GET` to a send route is no route at all.
  expect((await send(base, "/request", "GET", htmx)).status).toBe(404);
  // The press route keeps its own, smaller, limit.
  expect(
    (await send(base, "/", "POST", pressHeaders(base), { ...FORM, pad: "x".repeat(13 * 1024) }))
      .status,
  ).toBe(413);

  expect(sent).toEqual([]);
  stop.abort();
  expect(await closed).toBe(0);
});

test("(send) a send is not a press and a press is not a send", async () => {
  const written: Written = [];
  const sent: Sent = [];
  const ports = spyPorts(written, sent);
  const app = createApp(ports, TOKEN);
  const outcomes: string[] = [];
  const message = { messageId: newMessageId("request"), body: "words", inReplyTo: null };
  // Planted beside the real routes: each mints one kind and spends it at the
  // other kind's port, then tries to mint the other kind off the same request.
  app.post("/as-press", async (c) => {
    const minting = mintSend(c, TOKEN);
    if ("send" in minting) {
      outcomes.push(
        String((await portOf(ports).answer(minting.send as unknown as Press, "i-0001")).ok),
      );
    }
    outcomes.push("press" in mintPress(c, TOKEN) ? "minted" : "refused");
    return c.text("done");
  });
  app.post("/as-send", async (c) => {
    const minting = mintPress(c, TOKEN);
    if ("press" in minting) {
      outcomes.push(String((await sayOf(ports).say(minting.press as unknown as Send, message)).ok));
    }
    outcomes.push("send" in mintSend(c, TOKEN) ? "minted" : "refused");
    return c.text("done");
  });
  const { base, stop, closed } = await served(app);

  await send(base, "/as-press", "POST", htmxHeaders(base), {});
  await send(base, "/as-send", "POST", pressHeaders(base), {});
  // Each mint succeeded, was refused at the wrong port, and the request minted
  // nothing more.
  expect(outcomes).toEqual(["false", "refused", "false", "refused"]);
  expect(written).toEqual([]);
  expect(sent).toEqual([]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(send) the audit's planted writers, reached by a GET or a forged request, send nothing", async () => {
  const sent: Sent = [];
  const ports = spyPorts([], sent);
  const port = sayOf(ports);
  const ran: string[] = [];
  const app = createApp(ports, TOKEN);
  const message = {
    messageId: newMessageId("request"),
    body: "nobody typed this",
    inReplyTo: null,
  };
  const planted = async (c: Context<PageEnv>, name: string): Promise<void> => {
    ran.push(name);
    const minting = mintSend(c, TOKEN);
    await port.say("send" in minting ? minting.send : ({} as Send), message);
    await port.say(Object.freeze({}) as Send, message);
  };

  app.get("/planted/handler", async (c) => {
    await planted(c, "handler");
    return c.text("drawn");
  });
  app.use("/planted/middleware", async (c, next) => {
    await planted(c, "middleware");
    await next();
  });
  const sub = new Hono<PageEnv>();
  sub.get("/", async (c) => {
    await planted(c, "sub-app");
    return c.text("drawn");
  });
  app.route("/planted/sub", sub);
  // A GET handler that rewrites the live request into an htmx POST first.
  app.get("/planted/rewrite", async (c) => {
    const incoming = c.env.incoming as { method?: string; headers: Record<string, string> };
    incoming.method = "POST";
    Object.assign(incoming.headers, htmxHeaders(`http://${incoming.headers["host"] ?? ""}`));
    await planted(c, "rewrite");
    return c.text("drawn");
  });

  const { base, stop, closed } = await served(app);
  for (const path of [
    "/planted/handler",
    "/planted/middleware",
    "/planted/sub",
    "/planted/rewrite",
  ]) {
    await send(base, path, "GET", htmxHeaders(base));
  }
  expect(new Set(ran)).toEqual(new Set(["handler", "middleware", "sub-app", "rewrite"]));

  // A request that never crossed the socket, carrying every header and the
  // adapter's own binding forged.
  const headers = {
    host: "127.0.0.1",
    ...htmxHeaders("http://127.0.0.1"),
    "content-type": "application/x-www-form-urlencoded",
  };
  const forged = await app.request(
    "http://127.0.0.1/request",
    {
      method: "POST",
      headers,
      body: new URLSearchParams({
        token: TOKEN,
        message_id: message.messageId,
        body: "x",
      }).toString(),
    },
    { incoming: { method: "POST", headers } },
  );
  expect(forged.status).toBe(403);
  expect(sent).toEqual([]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(send) the same form sent twice records its message once", async () => {
  // Over a real advisory record, because what refuses the second is the
  // store's uniqueness on the id the form was rendered with.
  const connection = new DatabaseSync(":memory:");
  const record = advisoryRecord(connection);
  const ports = {
    ...spyPorts([]),
    record,
    say: new SayPort(
      async (message) => {
        const outcome = await record.recordThreadMessage({
          ...message,
          authorKind: "operator",
          authorId: "ada",
          atMs: 1,
          bases: [],
          asks: false,
        });
        return outcome.kind === "recorded"
          ? { ok: true, note: "" }
          : { ok: false, note: outcome.reason };
      },
      async () => await record.threadMessages(),
    ),
  } as ServedPorts;
  const { base, stop, closed } = await served(createApp(ports, TOKEN));
  const form = { token: TOKEN, message_id: newMessageId("request"), body: "one request" };

  expect((await send(base, "/request", "POST", htmxHeaders(base), form)).status).toBe(303);
  // The repeat is the send it repeats (#220 S1 review): the words are in the
  // thread, so it is answered as sent, at that message, and not "not sent".
  for (const headers of [htmxHeaders(base), submitHeaders(base)]) {
    const again = await send(base, "/request", "POST", headers, form);
    expect(again.status).toBe(303);
    expect(again.location).toContain(`#${form.message_id}`);
  }
  expect(connection.prepare("SELECT COUNT(*) AS n FROM conversation_message").get()).toEqual({
    n: 1,
  });
  // The same id under other words is a refusal, said without the id, in the
  // page's language; with script off it is a page with the way back.
  const other = { ...form, body: "other words" };
  const htmx = await send(base, "/request?lang=ja", "POST", htmxHeaders(base), other);
  expect(htmx.status).toBe(409);
  expect(htmx.body).toMatch(/^<p id="send-refused">送信されませんでした。/);
  expect(htmx.body).not.toContain(form.message_id);
  const native = await send(base, "/request?lang=ja", "POST", submitHeaders(base), other);
  expect(native.status).toBe(409);
  expect(native.body).toContain('<html lang="ja">');
  expect(native.body).toContain('<a href="/?requests=open&amp;lang=ja">スレッドに戻る</a>');
  expect(native.body).not.toContain(form.message_id);
  expect(native.body).not.toMatch(/D-00/);
  expect(connection.prepare("SELECT COUNT(*) AS n FROM conversation_message").get()).toEqual({
    n: 1,
  });

  stop.abort();
  expect(await closed).toBe(0);
});

test("(send) a reply cannot answer an ask that waits, so a send releases no hold on work", async () => {
  // #220 S1 review, D-0059 section 5a's residual: the first reply to an ask
  // ends the hold `reserve()` reads through `openAsksIn` (D-0066 rule 4.4). An
  // htmx-shaped send -- any same-origin script -- must leave the ask open.
  const connection = new DatabaseSync(":memory:");
  const record = advisoryRecord(connection);
  const sent: Sent = [];
  const write = async (draft: Parameters<typeof record.recordThreadMessage>[0]) => {
    const outcome = await record.recordThreadMessage(draft);
    expect(outcome.kind, JSON.stringify(outcome)).toBe("recorded");
  };
  const at = { authorId: "rondo-drafter", atMs: 1, bases: [] } as const;
  await write({
    ...at,
    messageId: "req",
    body: "r",
    authorKind: "operator",
    inReplyTo: null,
    asks: false,
  });
  await write({
    ...at,
    messageId: "ask",
    body: "a?",
    authorKind: "drafter",
    inReplyTo: "req",
    bases: [{ form: "message", messageId: "req" }],
    asks: true,
  });
  // The refusal is the port's, not the route's: any holder of a send is refused.
  const ports = {
    ...spyPorts([], sent),
    record,
    say: new SayPort(
      async (message) => {
        sent.push(message);
        return await Promise.resolve({ ok: true, note: "" });
      },
      async () => await record.threadMessages(),
    ),
  } as ServedPorts;
  const app = createApp(ports, TOKEN);
  const bypass: boolean[] = [];
  app.post("/planted/answer", async (c) => {
    const minting = mintSend(c, TOKEN);
    expect("send" in minting).toBe(true);
    if ("send" in minting) {
      const said = await sayOf(ports).say(minting.send, {
        messageId: newMessageId("reply"),
        body: "b",
        inReplyTo: "ask",
      });
      bypass.push(said.ok, said.waitingAsk === true);
    }
    return c.text("drawn");
  });
  const { base, stop, closed } = await served(app);
  const reply = { token: TOKEN, message_id: newMessageId("reply"), in_reply_to: "ask", body: "b" };

  const htmx = await send(base, "/reply?lang=ja", "POST", htmxHeaders(base), reply);
  expect(htmx.status).toBe(409);
  expect(htmx.body).toMatch(/^<p id="send-refused">送信されませんでした。/);
  const native = await send(base, "/reply", "POST", submitHeaders(base), reply);
  expect(native.status).toBe(409);
  expect(native.body).toContain('href="/?thread=ask&amp;lang=en"');
  expect(sent).toEqual([]);
  const open = await record.openAsksIn("req");
  expect(open.kind === "read" && open.asks.map((ask) => ask.messageId)).toEqual(["ask"]);
  // A reply to anything else in the thread is still a send.
  await send(base, "/planted/answer", "POST", htmxHeaders(base), { token: TOKEN });
  expect(bypass).toEqual([false, true]);
  const other = { ...reply, message_id: newMessageId("reply"), in_reply_to: "req" };
  expect((await send(base, "/reply", "POST", htmxHeaders(base), other)).status).toBe(303);
  expect(sent).toHaveLength(1);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(send) an oversize send is refused like any other send: in the page's language, under the draft", async () => {
  const sent: Sent = [];
  const { base, stop, closed } = await served(createApp(spyPorts([], sent), TOKEN));
  const form = {
    token: TOKEN,
    message_id: newMessageId("reply"),
    in_reply_to: "r",
    body: "x".repeat(70 * 1024),
  };
  const htmx = await send(base, "/reply?lang=ja", "POST", htmxHeaders(base), form);
  expect(htmx.status).toBe(413);
  expect(htmx.body).toMatch(/^<p id="send-refused">送信されませんでした。/);
  const native = await send(base, "/reply?lang=ja", "POST", submitHeaders(base), form);
  expect(native.status).toBe(413);
  expect(native.body).toContain('<html lang="ja">');
  expect(sent).toEqual([]);
  stop.abort();
  expect(await closed).toBe(0);
});

test("(send) with no approver there is no say port, and a send says why", async () => {
  const sent: Sent = [];
  const { base, stop, closed } = await served(
    createApp({ ...spyPorts([], sent), say: null } as ServedPorts, TOKEN),
  );
  const refused = await send(base, "/request", "POST", htmxHeaders(base), {
    token: TOKEN,
    message_id: newMessageId("request"),
    body: "words",
  });
  expect(refused.status).toBe(403);
  expect(refused.body).toContain("RONDO_APPROVER");
  expect(sent).toEqual([]);

  stop.abort();
  expect(await closed).toBe(0);
});

/** An advisory record holding a request and a drafter's ask that waits on it. */
async function askWaiting() {
  const connection = new DatabaseSync(":memory:");
  const record = advisoryRecord(connection);
  const at = { authorId: "rondo-drafter", atMs: 1, bases: [] } as const;
  for (const draft of [
    { ...at, messageId: "req", body: "r", authorKind: "operator", inReplyTo: null, asks: false },
    {
      ...at,
      messageId: "ask",
      body: "a?",
      authorKind: "drafter",
      inReplyTo: "req",
      bases: [{ form: "message", messageId: "req" }],
      asks: true,
    },
  ] as const) {
    const outcome = await record.recordThreadMessage(draft);
    expect(outcome.kind, JSON.stringify(outcome)).toBe("recorded");
  }
  const ports = {
    ...spyPorts([]),
    record,
    say: new SayPort(
      async (message, answerOutcome) => {
        const outcome = await record.recordThreadMessage({
          ...message,
          authorKind: "operator",
          authorId: "ada",
          atMs: 2,
          bases: [],
          asks: false,
          ...(answerOutcome === null ? {} : { answerOutcome }),
        });
        return outcome.kind === "recorded"
          ? { ok: true, note: "" }
          : { ok: false, note: outcome.reason };
      },
      async () => await record.threadMessages(),
    ),
  } as ServedPorts;
  const waitingAsks = async () => {
    const open = await record.openAsksIn("req");
    return open.kind === "read" ? open.asks.map((ask) => ask.messageId) : null;
  };
  const operatorRows = () =>
    connection
      .prepare("SELECT COUNT(*) AS n FROM conversation_message WHERE author_kind = 'operator'")
      .get();
  return { record, ports, waitingAsks, operatorRows };
}

test("(answer) a person's press answers a waiting question once, and the question stops waiting", async () => {
  // D-0059 section 5a's falsifier and D-0069 rule 5: the reply to an ask
  // releases work, so it is a press, on the page (#220 S1).
  const { ports, waitingAsks, operatorRows } = await askWaiting();
  const { base, stop, closed } = await served(createApp(ports, TOKEN));
  const answer = {
    token: TOKEN,
    message_id: newMessageId("reply"),
    in_reply_to: "ask",
    body: "yes, go",
    outcome: "carry_on",
  };
  expect(await waitingAsks()).toEqual(["ask"]);

  const pressed = await send(base, "/answer-ask?lang=ja", "POST", pressHeaders(base), answer);
  expect(pressed.status).toBe(303);
  expect(pressed.location).toBe(`/?thread=${answer.message_id}&lang=ja#${answer.message_id}`);
  expect(await waitingAsks()).toEqual([]);
  // A second press of the same form is the answer it repeats.
  expect((await send(base, "/answer-ask", "POST", pressHeaders(base), answer)).status).toBe(303);
  expect(operatorRows()).toEqual({ n: 2 });

  stop.abort();
  expect(await closed).toBe(0);
});

test("(answer) the press says which answer it is, and a stop leaves the question standing", async () => {
  // D-0072 rule 4. The screen draws one button per answer; a press naming
  // neither is refused rather than defaulted, because rondo guessing here would
  // put a word in the person's mouth on the one press whose content is that word.
  const { ports, waitingAsks, record } = await askWaiting();
  const { base, stop, closed } = await served(createApp(ports, TOKEN));
  const form = (extra: Record<string, string>) => ({
    token: TOKEN,
    message_id: newMessageId("reply"),
    in_reply_to: "ask",
    body: "this line: stop it",
    ...extra,
  });

  // No answer named, and an answer that is not one of the two.
  expect((await send(base, "/answer-ask", "POST", pressHeaders(base), form({}))).status).toBe(400);
  expect(
    (await send(base, "/answer-ask", "POST", pressHeaders(base), form({ outcome: "maybe" })))
      .status,
  ).toBe(400);
  expect(await waitingAsks()).toEqual(["ask"]);

  // A stop is recorded, and the question it answers is still standing.
  const stopped = form({ outcome: "stop" });
  expect((await send(base, "/answer-ask", "POST", pressHeaders(base), stopped)).status).toBe(303);
  expect(await waitingAsks()).toEqual(["ask"]);
  const open = await record.openAsksIn("req");
  expect(open.kind === "read" && open.asks[0]?.answeredStop).toBe(true);
  // The words are in the thread under the answer they were pressed with.
  const read = await record.threadMessages();
  expect(
    read.kind === "read" &&
      read.messages.find((one) => one.messageId === stopped.message_id)?.answerOutcome,
  ).toBe("stop");

  // **A plain reply is still not the way out of it** (`SayPort.say`): the hold
  // is still there, so a send must not be what lifts it.
  const replied = await send(base, "/reply", "POST", htmxHeaders(base), form({}));
  expect(replied.status).toBe(409);
  expect(await waitingAsks()).toEqual(["ask"]);

  // **The same form pressed again with the other answer is not that answer.**
  // The store refuses the repeated id; reporting it as a carry-on would tell
  // the person their line was released while the stop still holds it.
  const flipped = { ...stopped, outcome: "carry_on" };
  expect((await send(base, "/answer-ask", "POST", pressHeaders(base), flipped)).status).toBe(409);
  expect(await waitingAsks()).toEqual(["ask"]);
  // A true replay -- the same press, the same answer -- is still the answer it repeats.
  expect((await send(base, "/answer-ask", "POST", pressHeaders(base), stopped)).status).toBe(303);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(answer) every shape that is not a person's press is refused, and the question keeps waiting", async () => {
  const { ports, waitingAsks, operatorRows } = await askWaiting();
  const app = createApp(ports, TOKEN);
  const outcomes: string[] = [];
  // Planted: a send minted by an htmx-shaped request, spent at the answer.
  app.post("/planted/send-as-press", async (c) => {
    const minting = mintSend(c, TOKEN);
    if ("send" in minting) {
      const said = await sayOf(ports).answerAsk(
        minting.send as unknown as Press,
        {
          messageId: newMessageId("reply"),
          body: "nobody pressed",
          inReplyTo: "ask",
        },
        "carry_on",
      );
      outcomes.push(String(said.ok));
    }
    return c.text("done");
  });
  // Planted: a GET writer that holds the port and a forged press.
  app.get("/planted/get", async (c) => {
    const minting = mintPress(c, TOKEN);
    const message = { messageId: newMessageId("reply"), body: "planted", inReplyTo: "ask" };
    outcomes.push(
      String(
        (
          await sayOf(ports).answerAsk(
            "press" in minting ? minting.press : (Object.freeze({}) as Press),
            message,
            "carry_on",
          )
        ).ok,
      ),
    );
    return c.text("drawn");
  });
  const { base, stop, closed } = await served(app);
  const person = pressHeaders(base);
  const answer = {
    token: TOKEN,
    message_id: newMessageId("reply"),
    in_reply_to: "ask",
    body: "words",
  };

  const refusals: [
    string,
    string,
    Record<string, string | undefined>,
    Record<string, string>,
    number,
  ][] = [
    ["an htmx hx-post", "POST", htmxHeaders(base), answer, 403],
    ["missing Sec-Fetch-User", "POST", { ...person, "sec-fetch-user": undefined }, answer, 403],
    ["a same-origin fetch", "POST", { ...person, "sec-fetch-mode": "cors" }, answer, 403],
    ["a wrong token", "POST", person, { ...answer, token: "not-the-token" }, 403],
    ["a foreign Origin", "POST", { ...person, origin: "https://evil.example" }, answer, 403],
    ["no question named", "POST", person, { ...answer, in_reply_to: "" }, 400],
    ["no words", "POST", person, { ...answer, body: " " }, 400],
  ];
  for (const [shape, method, headers, form, status] of refusals) {
    const answered = await send(base, "/answer-ask", method, headers, form);
    expect(answered.status, shape).toBe(status);
    expect(answered.body, shape).not.toBe("");
  }
  // A native refusal is a page with the way back to the question's thread.
  const refused = await send(
    base,
    "/answer-ask",
    "POST",
    { ...person, "sec-fetch-user": undefined },
    answer,
  );
  expect(refused.body).toContain('href="/?thread=ask&amp;lang=en"');
  expect(refused.body).toContain("Answer button");
  expect((await send(base, "/answer-ask", "GET", person)).status).toBe(404);
  await send(base, "/planted/send-as-press", "POST", htmxHeaders(base), { token: TOKEN });
  await send(base, "/planted/get", "GET", person);
  expect(outcomes).toEqual(["false", "false"]);

  expect(await waitingAsks()).toEqual(["ask"]);
  expect(operatorRows()).toEqual({ n: 1 });
  stop.abort();
  expect(await closed).toBe(0);
});

/**
 * Ports whose scope port also takes the drafted scope's two presses
 * (rondo#238 C2b), each a spy: the approval of a draft and one drafted plan's
 * start, as the routes hand them over.
 */
function draftedPorts(
  approved: DraftedScopeFormDraft[],
  planStarts: PlanStartInput[],
  answer: { readonly ok: boolean } = { ok: true },
): ServedPorts {
  return {
    ...spyPorts([]),
    scope: new ScopePort(
      async () => await Promise.resolve({ ok: false, note: "not this route" }),
      async () => await Promise.resolve({ ok: false, note: "not this route" }),
      async (form) => {
        approved.push(form);
        return await Promise.resolve(
          answer.ok
            ? { ok: true, note: "", scopeDecisionId: "decision-2" }
            : { ok: false, note: "refused", why: "scopeRefusedNotTaken" as const },
        );
      },
      async (input) => {
        planStarts.push(input);
        return await Promise.resolve({ ok: true, note: "" });
      },
    ),
  } as unknown as ServedPorts;
}

/** The drafted scope's form, as the page draws it (rondo#238 C2b). */
function draftedScopeForm(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    token: TOKEN,
    request: "req-1",
    draft_scope: "drafted-scope-7",
    draft_digest: `sha256:${"d".repeat(64)}`,
    scope_id: newScopeId(),
    laps: "6",
    review_rounds: "3",
    cost_usd: "4.5",
    cost_reserve_usd: "2.5",
    expires_at_ms: "2026-01-01T00:00",
    severity_threshold: "minor",
    ...overrides,
  };
}

/** One drafted plan's start form, as the page draws it: hidden ids only. */
function planStartForm(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    token: TOKEN,
    request: "req-1",
    scope_decision: "decision-2",
    proposal: "draft-3",
    plan_index: "1",
    iteration: newIterationId(),
    ...overrides,
  };
}

test("(scope-draft) a person's press approves the draft it was drawn over, with the values read as /scope reads them (rondo#238 C2b)", async () => {
  const approved: DraftedScopeFormDraft[] = [];
  const { base, stop, closed } = await served(createApp(draftedPorts(approved, []), TOKEN));

  const form = draftedScopeForm();
  const pressed = await send(base, "/scope-draft", "POST", pressHeaders(base), form);
  expect(pressed.status).toBe(303);
  expect(pressed.location).toBe("/?scope=req-1&decision=decision-2&lang=en#scope");
  expect(approved).toEqual([
    {
      draftScopeId: "drafted-scope-7",
      draftDigest: `sha256:${"d".repeat(64)}`,
      scopeId: form["scope_id"],
      budgets: {
        laps: 6,
        review_rounds: 3,
        cost_usd: 4.5,
        cost_reserve_usd: 2.5,
        expires_at_ms: Date.parse("2026-01-01T00:00Z"),
      },
      severityThreshold: "minor",
      outwardActs: [],
    },
  ]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(scope-draft) every other shape is refused and approves nothing (rondo#238 C2b)", async () => {
  const approved: DraftedScopeFormDraft[] = [];
  const { base, stop, closed } = await served(createApp(draftedPorts(approved, []), TOKEN));
  const person = pressHeaders(base);

  for (const [shape, form, status] of [
    ["no draft scope", draftedScopeForm({ draft_scope: "" }), 400],
    ["no draft digest", draftedScopeForm({ draft_digest: "" }), 400],
    ["a scope id this page did not mint", draftedScopeForm({ scope_id: "scope-1" }), 400],
    ["no request", draftedScopeForm({ request: "" }), 400],
    ["a budget that is not a number", draftedScopeForm({ laps: "many" }), 400],
    ["a severity outside the four", draftedScopeForm({ severity_threshold: "grave" }), 400],
    ["a wrong token", draftedScopeForm({ token: "not-the-token" }), 403],
  ] as const) {
    const answered = await send(base, "/scope-draft", "POST", person, form);
    expect(answered.status, shape).toBe(status);
    expect(answered.body, shape).not.toBe("");
  }
  const noPress = await send(
    base,
    "/scope-draft",
    "POST",
    { ...person, "sec-fetch-user": undefined },
    draftedScopeForm(),
  );
  expect(noPress.status).toBe(403);
  expect((await send(base, "/scope-draft", "GET", person)).status).toBe(404);
  expect(approved).toEqual([]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(scope-draft) a draft the port refuses is said, and leads back to the scope (rondo#238 C2b)", async () => {
  const approved: DraftedScopeFormDraft[] = [];
  const { base, stop, closed } = await served(
    createApp(draftedPorts(approved, [], { ok: false }), TOKEN),
  );
  const refused = await send(base, "/scope-draft", "POST", pressHeaders(base), draftedScopeForm());
  expect(refused.status).toBe(409);
  expect(refused.body).toContain("/?scope=req-1&amp;lang=en");
  expect(approved).toHaveLength(1);

  stop.abort();
  expect(await closed).toBe(0);
});

/** A page whose scope port offers only the raise press (D-0074 section 4), recording what it was handed. */
function raisePorts(raised: RaiseInput[], answer: ScopeRecorded): ServedPorts {
  const notThis = async () => await Promise.resolve({ ok: false, note: "not this route" });
  return {
    ...spyPorts([]),
    scope: new ScopePort(notThis, notThis, null, null, async (input) => {
      raised.push(input);
      return await Promise.resolve(answer);
    }),
  } as unknown as ServedPorts;
}

/** The raise form, as the page draws it: hidden ids and the five budgets, nothing else. */
function raiseForm(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    token: TOKEN,
    request: "req-1",
    raise: "decision-1",
    iteration: "lap-at-gate",
    scope_id: newScopeId(),
    laps: "3",
    review_rounds: "3",
    cost_usd: "15",
    cost_reserve_usd: "2.5",
    expires_at_ms: "2026-01-01T00:00",
    ...overrides,
  };
}

test("(raise) a person's press records the budgets it was drawn with and returns to the gate (D-0074 rule 4.3)", async () => {
  const raised: RaiseInput[] = [];
  const { base, stop, closed } = await served(
    createApp(raisePorts(raised, { ok: true, note: "", scopeDecisionId: "decision-2" }), TOKEN),
  );
  const form = raiseForm();
  const pressed = await send(base, "/raise", "POST", pressHeaders(base), form);
  expect(pressed.status).toBe(303);
  expect(pressed.location).toBe("/?thread=req-1&lang=en");
  expect(raised).toEqual([
    {
      scopeId: form["scope_id"],
      requestMessageId: "req-1",
      scopeDecisionId: "decision-1",
      iterationId: "lap-at-gate",
      budgets: {
        laps: 3,
        review_rounds: 3,
        cost_usd: 15,
        cost_reserve_usd: 2.5,
        expires_at_ms: Date.parse("2026-01-01T00:00Z"),
      },
    },
  ]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(raise) every other shape is refused, and a refusal leads back to the gate (D-0074 rule 4.4)", async () => {
  const raised: RaiseInput[] = [];
  const { base, stop, closed } = await served(
    createApp(
      raisePorts(raised, { ok: false, note: "raised already", why: "raiseRefusedNotTip" }),
      TOKEN,
    ),
  );
  const person = pressHeaders(base);
  for (const [shape, form, status] of [
    ["no approval", raiseForm({ raise: "" }), 400],
    ["no lap", raiseForm({ iteration: "" }), 400],
    ["no request", raiseForm({ request: "" }), 400],
    ["a scope id this page did not mint", raiseForm({ scope_id: "scope-1" }), 400],
    ["a budget that is not a number", raiseForm({ cost_usd: "lots" }), 400],
    ["a wrong token", raiseForm({ token: "not-the-token" }), 403],
  ] as const) {
    const answered = await send(base, "/raise", "POST", person, form);
    expect(answered.status, shape).toBe(status);
    expect(answered.body, shape).not.toBe("");
  }
  expect(raised).toEqual([]);
  const refused = await send(base, "/raise", "POST", person, raiseForm());
  expect(refused.status).toBe(409);
  expect(refused.body).toContain("already been raised");
  expect(refused.body).toContain("/?thread=req-1&amp;lang=en");
  expect(raised).toHaveLength(1);
  expect((await send(base, "/raise", "GET", person)).status).toBe(404);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(start-plan) a person's press starts the drafted plan it names, under the approval it names (rondo#238 C2b)", async () => {
  const planStarts: PlanStartInput[] = [];
  const { base, stop, closed } = await served(createApp(draftedPorts([], planStarts), TOKEN));

  const form = planStartForm();
  const pressed = await send(base, "/start-plan", "POST", pressHeaders(base), form);
  expect(pressed.status).toBe(303);
  // Into the request's thread, where the lap it started draws its lines: the
  // summary carried no anchor for the lap, so this used to land on nothing.
  expect(pressed.location).toBe("/?thread=req-1&lang=en");
  expect(planStarts).toEqual([
    {
      iterationId: form["iteration"],
      requestMessageId: "req-1",
      scopeDecisionId: "decision-2",
      proposalId: "draft-3",
      planIndex: 1,
    },
  ]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(start-plan) every other shape is refused and starts nothing (rondo#238 C2b)", async () => {
  const planStarts: PlanStartInput[] = [];
  const { base, stop, closed } = await served(createApp(draftedPorts([], planStarts), TOKEN));
  const person = pressHeaders(base);

  for (const [shape, form, status] of [
    ["no proposal", planStartForm({ proposal: "" }), 400],
    ["a plan index that is not a whole number", planStartForm({ plan_index: "one" }), 400],
    ["a negative plan index", planStartForm({ plan_index: "-1" }), 400],
    ["an iteration id this page did not mint", planStartForm({ iteration: "i-1" }), 400],
    ["no approval", planStartForm({ scope_decision: "" }), 400],
    ["no request", planStartForm({ request: "" }), 400],
    ["a wrong token", planStartForm({ token: "not-the-token" }), 403],
  ] as const) {
    const answered = await send(base, "/start-plan", "POST", person, form);
    expect(answered.status, shape).toBe(status);
    expect(answered.body, shape).not.toBe("");
  }
  const noPress = await send(
    base,
    "/start-plan",
    "POST",
    { ...person, "sec-fetch-user": undefined },
    planStartForm(),
  );
  expect(noPress.status).toBe(403);
  expect((await send(base, "/start-plan", "GET", person)).status).toBe(404);
  expect(planStarts).toEqual([]);

  stop.abort();
  expect(await closed).toBe(0);
});

/** Ports whose merge press is a spy, answering `answer` to every press it lets through. */
function mergePorts(merged: MergeInput[], answer: Merged = { ok: true, note: "" }): ServedPorts {
  return {
    ...spyPorts([]),
    merge: new MergePort(async (input) => {
      merged.push(input);
      return await Promise.resolve(answer);
    }),
  };
}

function mergeForm(overrides: Record<string, string> = {}): Record<string, string> {
  return { token: TOKEN, iteration: "i-0002", request: "req-1", head: "abc1234", ...overrides };
}

test("(merge) a person's press merges the lap it was drawn for, once, and lands on its thread", async () => {
  const merged: MergeInput[] = [];
  const { base, stop, closed } = await served(createApp(mergePorts(merged), TOKEN));
  const pressed = await send(base, "/merge", "POST", pressHeaders(base), mergeForm());
  expect(pressed.status).toBe(303);
  expect(pressed.location).toBe("/?thread=req-1&lang=en");
  expect(merged).toEqual([{ iterationId: "i-0002", head: "abc1234" }]);
  stop.abort();
  expect(await closed).toBe(0);
});

test("(merge) no press, no head or no approver merges nothing; the forge's refusal is said in words", async () => {
  const merged: MergeInput[] = [];
  const { base, stop, closed } = await served(createApp(mergePorts(merged), TOKEN));
  const person = pressHeaders(base);
  for (const [headers, form] of [
    [{ ...person, "sec-fetch-user": undefined }, mergeForm()],
    [person, mergeForm({ token: "not-the-token" })],
    [{ ...person, origin: "https://evil.example" }, mergeForm()],
  ] as const) {
    expect((await send(base, "/merge", "POST", headers, form)).status).toBe(403);
  }
  for (const form of [mergeForm({ head: "" }), mergeForm({ iteration: "" })]) {
    expect((await send(base, "/merge", "POST", person, form)).status).toBe(400);
  }
  expect((await send(base, "/merge", "GET", person)).status).toBe(404);
  expect(merged).toEqual([]);
  stop.abort();
  expect(await closed).toBe(0);

  const none = await served(createApp({ ...spyPorts([]), merge: null }, TOKEN));
  const refused = await send(none.base, "/merge", "POST", pressHeaders(none.base), mergeForm());
  expect(refused.status).toBe(403);
  expect(refused.body).toContain(EN.mergeRefusedNoApprover);
  none.stop.abort();
  expect(await none.closed).toBe(0);

  // The forge refused: 409, the person's sentence with the forge's own line,
  // and the way back to the thread, where the button still is.
  const forge = await served(
    createApp(
      mergePorts([], {
        ok: false,
        note: "nothing was merged: gh pr merge",
        why: "mergeRefusedFailed",
        detail: "review required",
      }),
      TOKEN,
    ),
  );
  const answered = await send(forge.base, "/merge", "POST", pressHeaders(forge.base), mergeForm());
  expect(answered.status).toBe(409);
  expect(answered.body).toContain(EN.mergeRefusedFailed("review required"));
  expect(answered.body).toContain("/?thread=req-1&amp;lang=en");
  forge.stop.abort();
  expect(await forge.closed).toBe(0);
});

/** Ports whose release press is a spy, answering `answer` to every press it lets through. */
function releasePorts(
  released: ReleaseInput[],
  answer: { ok: boolean; note: string; why?: "releaseRefusedChanged" } = { ok: true, note: "" },
): ServedPorts {
  return {
    ...spyPorts([]),
    release: new ReleasePort(async (input) => {
      released.push(input);
      return await Promise.resolve(answer);
    }),
  };
}

function releaseForm(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    token: TOKEN,
    iteration: "i-0002",
    claim: "i-0001:1",
    laps: "i-0001 i-0002",
    ...overrides,
  };
}

test("(release) a person's native press releases the line it was drawn over, once, with what the screen read", async () => {
  const released: ReleaseInput[] = [];
  const { base, stop, closed } = await served(createApp(releasePorts(released), TOKEN));

  const pressed = await send(base, "/release", "POST", pressHeaders(base), releaseForm());
  expect(pressed.status).toBe(303);
  expect(pressed.location).toBe("/?release=i-0002&lang=en");
  expect(released).toEqual([
    { iterationId: "i-0002", claimId: "i-0001:1", lapIds: ["i-0001", "i-0002"] },
  ]);

  stop.abort();
  expect(await closed).toBe(0);
});

test("(release) no press, no form, or no approver releases nothing; a line that moved is said in words", async () => {
  const released: ReleaseInput[] = [];
  const { base, stop, closed } = await served(createApp(releasePorts(released), TOKEN));
  const person = pressHeaders(base);

  for (const [shape, headers, form] of [
    ["missing Sec-Fetch-User", { ...person, "sec-fetch-user": undefined }, releaseForm()],
    [
      "a same-origin fetch",
      { ...person, "sec-fetch-mode": "cors", "sec-fetch-user": undefined },
      releaseForm(),
    ],
    ["a wrong token", person, releaseForm({ token: "not-the-token" })],
    ["no token", person, withoutToken(releaseForm())],
    ["a foreign Origin", { ...person, origin: "https://evil.example" }, releaseForm()],
  ] as const) {
    const pressed = await send(base, "/release", "POST", headers, form);
    expect(pressed.status, shape).toBe(403);
    expect(pressed.body, shape).not.toBe("");
  }
  for (const form of [
    releaseForm({ claim: "" }),
    releaseForm({ laps: "" }),
    releaseForm({ iteration: "" }),
  ]) {
    expect((await send(base, "/release", "POST", person, form)).status).toBe(400);
  }
  expect((await send(base, "/release", "GET", person)).status).toBe(404);
  expect(released).toEqual([]);
  stop.abort();
  expect(await closed).toBe(0);

  // No approver: no port, and the refusal says so without naming a variable.
  const none = await served(createApp({ ...spyPorts([]), release: null }, TOKEN));
  const refused = await send(none.base, "/release", "POST", pressHeaders(none.base), releaseForm());
  expect(refused.status).toBe(403);
  expect(refused.body).toContain(EN.releaseRefusedNoApprover);
  expect(refused.body).not.toContain("RONDO_APPROVER");
  none.stop.abort();
  expect(await none.closed).toBe(0);

  // The store refused (the line moved under the screen): 409, in words, with
  // the way back to the screen.
  const moved: ReleaseInput[] = [];
  const stale = await served(
    createApp(
      releasePorts(moved, { ok: false, note: "stale", why: "releaseRefusedChanged" }),
      TOKEN,
    ),
  );
  const answered = await send(
    stale.base,
    "/release",
    "POST",
    pressHeaders(stale.base),
    releaseForm(),
  );
  expect(answered.status).toBe(409);
  expect(answered.body).toContain(EN.releaseRefusedChanged.slice(0, 40));
  expect(answered.body).toContain("/?release=i-0002&amp;lang=en");
  expect(answered.body).not.toContain("stale");
  expect(moved).toHaveLength(1);
  stale.stop.abort();
  expect(await stale.closed).toBe(0);
});

function addPorts(
  added: AddRepositoryInput[],
  answer: AddedRepository = { ok: true },
): ServedPorts {
  return {
    ...spyPorts([]),
    addRepository: new AddRepositoryPort(async (input) => {
      added.push(input);
      return await Promise.resolve(answer);
    }),
  };
}

const ADD_FORM = { token: TOKEN, request: "m-1", repository: "owner/other" };

test("(add-repository) a person's press adds the repository the request named, and lands on its thread", async () => {
  const added: AddRepositoryInput[] = [];
  const { base, stop, closed } = await served(createApp(addPorts(added), TOKEN));
  const pressed = await send(base, "/add-repository", "POST", pressHeaders(base), ADD_FORM);
  expect(pressed.status).toBe(303);
  expect(pressed.location).toBe("/?thread=m-1&lang=en");
  expect(added).toEqual([{ requestMessageId: "m-1", repo: "owner/other" }]);
  stop.abort();
  expect(await closed).toBe(0);
});

test("(add-repository) no press, no form or no approver adds nothing; a failed clone is said in words with the way back", async () => {
  const added: AddRepositoryInput[] = [];
  const { base, stop, closed } = await served(createApp(addPorts(added), TOKEN));
  const person = pressHeaders(base);
  for (const headers of [
    { ...person, "sec-fetch-user": undefined },
    { ...person, "sec-fetch-mode": "cors", "sec-fetch-user": undefined },
  ]) {
    expect((await send(base, "/add-repository", "POST", headers, ADD_FORM)).status).toBe(403);
  }
  expect(
    (await send(base, "/add-repository", "POST", person, { ...ADD_FORM, repository: "" })).status,
  ).toBe(400);
  expect(added).toEqual([]);
  stop.abort();
  expect(await closed).toBe(0);

  const none = await served(createApp({ ...spyPorts([]), addRepository: null }, TOKEN));
  const refused = await send(
    none.base,
    "/add-repository",
    "POST",
    pressHeaders(none.base),
    ADD_FORM,
  );
  expect(refused.status).toBe(403);
  expect(refused.body).toContain(EN.addRepositoryRefusedNoApprover);
  none.stop.abort();
  expect(await none.closed).toBe(0);

  // Each refusal a person answers differently reaches them as its own sentence,
  // rondo's reason kept in the fold, and the way back is the request's thread
  // where the button still is.
  for (const why of [
    "addRepositoryRefusedInstall",
    "addRepositoryRefusedUnseen",
    "addRepositoryRefusedFailed",
  ] as const) {
    const failing = await served(
      createApp(addPorts([], { ok: false, why, note: "gh: exited 1" }), TOKEN),
    );
    const answered = await send(
      failing.base,
      "/add-repository",
      "POST",
      pressHeaders(failing.base),
      ADD_FORM,
    );
    expect(answered.status, why).toBe(409);
    expect(answered.body, why).toContain(EN[why].slice(0, 60).replaceAll("'", "&#39;"));
    expect(answered.body, why).toContain("gh: exited 1");
    expect(answered.body, why).toContain("/?thread=m-1&amp;lang=en");
    failing.stop.abort();
    expect(await failing.closed).toBe(0);
  }
});

test("(release) the port refuses anything but a minted, unspent press", async () => {
  const released: ReleaseInput[] = [];
  const port = new ReleasePort(async (input) => {
    released.push(input);
    return await Promise.resolve({ ok: true, note: "" });
  });
  const forged = Object.freeze({}) as unknown as Parameters<ReleasePort["release"]>[0];
  expect(
    (await port.release(forged, { iterationId: "i-0001", claimId: "i-0001:1", lapIds: ["i-0001"] }))
      .ok,
  ).toBe(false);
  expect(released).toEqual([]);
});

/** Ports whose goal and *not now* presses are spies (D-0097). */
function triagePorts(
  goals: GoalInput[],
  asides: NotNowInput[],
  answer: TriageWritten = { ok: true },
): ServedPorts {
  return {
    ...spyPorts([]),
    triage: new TriagePort(
      async (input) => {
        goals.push(input);
        return await Promise.resolve(answer);
      },
      async (input) => {
        asides.push(input);
        return await Promise.resolve(answer);
      },
    ),
  };
}

test("(triage) a person's press keeps a goal of whole rows and puts a candidate aside, each once", async () => {
  const goals: GoalInput[] = [];
  const asides: NotNowInput[] = [];
  const { base, stop, closed } = await served(createApp(triagePorts(goals, asides), TOKEN));
  const person = pressHeaders(base);
  const kept = await send(base, "/goal", "POST", person, {
    token: TOKEN,
    repository: "o/r",
    "clause-1": "they never open a terminal",
    "unmet-1": "a terminal is ever required",
    "clause-2": "",
    "unmet-2": "",
  });
  expect(kept.status).toBe(303);
  expect(kept.location).toBe("/?requests=open&lang=en");
  expect(goals).toEqual([
    {
      repository: "o/r",
      clauses: [{ said: "they never open a terminal", unmetIf: "a terminal is ever required" }],
    },
  ]);
  const put = await send(base, "/not-now", "POST", person, {
    token: TOKEN,
    proposal: "triage-1",
    candidate: "issue:o/r#7",
  });
  expect(put.status).toBe(303);
  expect(put.location).toBe("/?requests=open&lang=en#triage-heading");
  expect(asides).toEqual([{ proposalId: "triage-1", candidate: "issue:o/r#7" }]);
  stop.abort();
  expect(await closed).toBe(0);
});

test("(triage) no press, a half row or no approver writes nothing, and says why", async () => {
  const goals: GoalInput[] = [];
  const asides: NotNowInput[] = [];
  const { base, stop, closed } = await served(createApp(triagePorts(goals, asides), TOKEN));
  const person = pressHeaders(base);
  const goalForm = { token: TOKEN, repository: "o/r", "clause-1": "a", "unmet-1": "b" };
  const asideForm = { token: TOKEN, proposal: "triage-1", candidate: "issue:o/r#7" };
  for (const [route, form] of [
    ["/goal", goalForm],
    ["/not-now", asideForm],
  ] as const) {
    for (const [headers, body] of [
      [{ ...person, "sec-fetch-user": undefined }, form],
      [person, { ...form, token: "not-the-token" }],
      [{ ...person, origin: "https://evil.example" }, form],
    ] as const) {
      expect((await send(base, route, "POST", headers, body)).status).toBe(403);
    }
  }
  // A clause without its *unmet if* cannot be ranked against (point 2.2 (a)).
  const half = await send(base, "/goal", "POST", person, { ...goalForm, "unmet-1": "" });
  expect(half.status).toBe(400);
  expect(half.body).toContain(EN.goalRowIncomplete);
  expect(half.body).toContain("/?goal=o%2Fr&amp;lang=en");
  expect(
    (await send(base, "/goal", "POST", person, { ...goalForm, "clause-1": "", "unmet-1": "" }))
      .status,
  ).toBe(400);
  expect(
    (await send(base, "/not-now", "POST", person, { ...asideForm, candidate: "" })).status,
  ).toBe(400);
  expect(goals).toEqual([]);
  expect(asides).toEqual([]);
  stop.abort();
  expect(await closed).toBe(0);

  const none = await served(createApp({ ...spyPorts([]), triage: null }, TOKEN));
  const refused = await send(none.base, "/goal", "POST", pressHeaders(none.base), goalForm);
  expect(refused.status).toBe(403);
  expect(refused.body).toContain(EN.goalRefusedNoApprover);
  none.stop.abort();
  expect(await none.closed).toBe(0);

  // The store refused: 409, rondo's own reason beside the person's sentence.
  const store = await served(
    createApp(
      triagePorts([], [], { ok: false, note: "not a candidate that proposal named" }),
      TOKEN,
    ),
  );
  const answered = await send(store.base, "/not-now", "POST", pressHeaders(store.base), asideForm);
  expect(answered.status).toBe(409);
  expect(answered.body).toContain("not a candidate that proposal named");
  store.stop.abort();
  expect(await store.closed).toBe(0);
});
