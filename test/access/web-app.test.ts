/**
 * Only a person's press can write (D-0059 sections 5 and 5a, R4, rule 9).
 *
 * `test/access/web.test.ts` is the page over a real store. This file is the
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
  AnswerPort,
  createApp,
  mintPress,
  mintSend,
  newMessageId,
  type PageEnv,
  type Press,
  SayPort,
  type Send,
  type SentMessage,
  type ServedPorts,
  serveApp,
} from "../../src/access/web-app.js";
import { advisoryRecord } from "../../src/store/sqlite.js";

const TOKEN = "the-process-token";

/** Every write the port let through to its implementation. */
type Written = { iterationId: string; body: string }[];

/** Every message the say port let through to its implementation. */
type Sent = SentMessage[];

/**
 * Ports that hold a spy writer and nothing a `POST` reads.
 *
 * The write route reads only the host's language off the reading half, so the
 * rest is absent and a route that tried to render would fail loudly.
 */
function spyPorts(written: Written, sent: Sent = []): ServedPorts {
  return {
    hostLanguage: null,
    answer: new AnswerPort(async (iterationId, body) => {
      written.push({ iterationId, body });
      return await Promise.resolve({ ok: true, note: "" });
    }),
    say: new SayPort(async (message) => {
      sent.push(message);
      return await Promise.resolve({ ok: true, note: "" });
    }),
  } as unknown as ServedPorts;
}

/** The say port out of the ports, typed as present. */
function sayOf(ports: ServedPorts): SayPort {
  if (ports.say === null) {
    throw new Error("the fixture has no say port");
  }
  return ports.say;
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

const FORM = { token: TOKEN, iteration: "i-0001" };

test("(a) a person's native press is minted, and it writes the one word once", async () => {
  const written: Written = [];
  const { base, stop, closed } = await served(createApp(spyPorts(written), TOKEN));

  const pressed = await send(base, "/?lang=en", "POST", pressHeaders(base), {
    ...FORM,
    body: "revise",
  });
  expect(pressed.status).toBe(303);
  expect(pressed.location).toBe("/?lang=en");
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
 * `Host`, security headers, `csrf` on each of the three write addresses, body
 * limit -- and three write routes: the lap-end `approve` press, and the two
 * sends into a request thread. A new write kind is a new row here, argued in
 * the decision first.
 */
const WRITE_TABLE = [
  "ALL /*",
  "ALL /*",
  "ALL /",
  "ALL /request",
  "ALL /reply",
  "ALL /*",
  "POST /",
  "POST /request",
  "POST /reply",
];

test("(b) the page's writing vocabulary is enumerated off the running app", () => {
  const app = createApp(spyPorts([]), TOKEN);
  expect(nonReads(app)).toEqual(WRITE_TABLE);

  // Not vacuously: each way of adding a writer changes the enumeration.
  const posted = createApp(spyPorts([]), TOKEN);
  posted.post("/scope", (c) => c.text(""));
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
  expect(native.location).toBe(`/?lang=ja#${request}`);

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
    (await send(base, "/", "POST", pressHeaders(base), { ...FORM, pad: "x".repeat(5000) })).status,
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
    say: new SayPort(async (message) => {
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
    }),
  } as ServedPorts;
  const { base, stop, closed } = await served(createApp(ports, TOKEN));
  const form = { token: TOKEN, message_id: newMessageId("request"), body: "one request" };

  expect((await send(base, "/request", "POST", htmxHeaders(base), form)).status).toBe(303);
  const again = await send(base, "/request", "POST", htmxHeaders(base), form);
  expect(again.status).toBe(409);
  expect(again.body).toContain(form.message_id);
  expect(connection.prepare("SELECT COUNT(*) AS n FROM conversation_message").get()).toEqual({
    n: 1,
  });

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
