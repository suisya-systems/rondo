/**
 * The operator page's server, on Hono (D-0059 rule 2).
 *
 * **What moved here and what did not.** `src/access/web.tsx` still renders the
 * three views and still runs D-0056's five steps; this module is the part of
 * the old hand-written `node:http` server that D-0059 section 3 classes as
 * generic -- routing, 404/405, the fixed map of served files, the security
 * headers, the body limit, the server's lifecycle -- now carried by Hono and
 * its own middleware, plus the one part of it that is rondo's: **who may
 * press** (sections 5 and 5a).
 *
 * **The composition root stays rondo's** (rule 3a). {@link createApp} is a
 * function of rondo's ports: the renderer is handed {@link WebPorts}, which
 * holds no writer, and the one `POST` route is the only code here that names
 * the {@link AnswerPort}. That is the type split `D-0041` rule 4 describes, and
 * it is kept at runtime too -- the writer is taken off the ports object before
 * the reading half is handed down.
 *
 * **But a Hono app is a router any module holding it can register on**, and
 * D-0059's audit planted four writers that never issued a `POST` at all: a
 * `GET` handler, a middleware and a mounted sub-app calling the port directly,
 * and a loader-shaped `GET` that read the token first. No check on the route
 * sees those. So the check is **inside the write capability** (R4): the port
 * refuses any call that does not carry a {@link Press}, and the one function
 * that mints a press ({@link mintPress}) reads the live request off the socket
 * and mints only for a same-origin `POST` navigation carrying
 * `Sec-Fetch-User: ?1` and this process's token. A handler holding a `GET`
 * holds a request that can never be a press, whichever module it sits in and
 * however it reached the port. `test/access/web-app.test.ts` carries the
 * audit's planted writers as tests that must fail to write.
 *
 * **A second write kind, with its own value and its own port** (section 5a,
 * last row). A message into a request thread is a *send*, not a press: the
 * `SayPort` refuses any call without a {@link Send}, and {@link mintSend} mints
 * one from the same frozen arrival under the same method, origin and token
 * checks, but lets `Sec-Fetch-Mode` be `cors` and asks for no `?1`, so an htmx
 * `hx-post` can send and the draft beside the option buttons survives. A send
 * is not a press and a press is not a send: two brands, two sets of the
 * minted, two ports, so neither can be spent at the other's port.
 */
import { randomUUID, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { getRequestListener } from "@hono/node-server";
import { type Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { setCookie } from "hono/cookie";
import { csrf } from "hono/csrf";
import { secureHeaders } from "hono/secure-headers";
import {
  APPROVE_BODY,
  isSwitch,
  LANG_COOKIE,
  LANG_COOKIE_SECONDS,
  type LanguageAsked,
  operatorPage,
  type PageView,
  resolveLanguage,
  viewHref,
  type WebPorts,
} from "./web.js";

/**
 * What the socket said about one request, as `@hono/node-server` hands it to
 * the app (`c.env.incoming`).
 *
 * Typed structurally rather than as `IncomingMessage` because this is all a
 * press reads of it: the method and the headers **as the socket parsed them**,
 * which a middleware that rewrites `c.req.raw` (as `hono/body-limit` does for a
 * chunked body) does not touch.
 */
interface Incoming {
  readonly method?: string | undefined;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
}

/** The app's environment: the one binding the node adapter provides. */
export type PageEnv = { Bindings: { incoming: Incoming } };

/**
 * One person's press, minted from one live request (D-0059 sections 5 and 5a).
 *
 * **Opaque, and unforgeable by construction rather than by type.** The brand
 * is a symbol this module does not export, so the compiler refuses an object
 * literal; and a cast gets nothing, because the port checks membership of
 * {@link minted}, which only {@link mintPress} adds to. A press is spent by the
 * port that accepts it, so one press is at most one write.
 */
declare const pressBrand: unique symbol;
export type Press = { readonly [pressBrand]: true };

/** Every press {@link mintPress} has minted and no port has spent yet. */
const minted = new WeakSet<object>();

/**
 * Every request object that arrived on a socket this module is listening on,
 * and has not yet been pressed with.
 *
 * **Why the socket, and not only the headers.** Inside this process a writer
 * can build a `Request` -- or a whole Hono `Context` -- with any headers it
 * likes; `Sec-Fetch-*` are forbidden names to a browser page, not to Node. So a
 * press is minted only from a request the listener in {@link serveOperatorPage}
 * registered on its way in. What stays forgeable is what D-0059 section 5
 * already states: a non-browser client on loopback that sends the headers and
 * the token, which the token and the loopback bind already bound.
 */
const live = new WeakMap<object, Arrival>();

/**
 * One request as it arrived, frozen by the listener before the app ran.
 *
 * **A copy, and not the live `IncomingMessage`**: its `method` is a writable
 * property and its `headers` a plain object, so a planted `GET` handler holding
 * `c.env.incoming` could rewrite both into a person's `POST` and then mint.
 * The copy is taken before any handler runs, so nothing the app does can change
 * what a press reads. **The token is in it too**, taken from the app
 * {@link createApp} built, so no caller supplies the value its own guess is
 * compared against.
 */
interface Arrival {
  readonly method: string | undefined;
  readonly headers: Incoming["headers"];
  readonly token: string | undefined;
}

/** Each app's token, recorded by {@link createApp} for the listener to copy. */
const tokens = new WeakMap<object, string>();

/**
 * The same comparison the token has always had, without its duration depending
 * on how much of a guess was right.
 */
function sameToken(posted: unknown, token: string): boolean {
  if (typeof posted !== "string") {
    return false;
  }
  const left = Buffer.from(posted);
  const right = Buffer.from(token);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** One header as the socket parsed it; a repeated header is not a value. */
function header(incoming: Arrival, name: string): string | undefined {
  const value = incoming.headers[name];
  return typeof value === "string" ? value : undefined;
}

/**
 * The two kinds of message a person sends into a request thread from the page
 * (D-0061 rule 4, D-0059 section 5a's second write kind): a new request, or a
 * reply to a message already in a thread.
 */
type SentKind = "request" | "reply";

/**
 * A message id for one form, minted **when the form is rendered** and carried
 * in it as a hidden field (D-0061 rule 2.1).
 *
 * **Rondo names the message, and the person never types an id.** Minted at
 * render rather than on arrival so that the same form sent twice -- a double
 * click, a resend after a slow answer -- carries the same id, and the store's
 * uniqueness refuses the second rather than recording the person's words
 * twice. The readable prefix says which kind of send made the row. Here and
 * not in the renderer because the renderer is not granted `node:crypto`; the
 * server hands the renderer ids.
 */
export function newMessageId(kind: SentKind): string {
  return `${kind}-${randomUUID()}`;
}

/**
 * The shape {@link newMessageId} mints, and the only shape a send route
 * accepts: a posted id that is not one is not this page's form.
 */
const SENT_MESSAGE_ID =
  /^(request|reply)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A refusal a mint gives, as a status and a line a person can read. */
type Refused = { readonly status: 403; readonly line: string };

/**
 * The checks a press and a send share, read off the frozen arrival, and the
 * arrival spent if they pass (D-0059 section 5a).
 *
 * 1. it arrived on this process's socket and has not been minted from before;
 * 2. its method, as the socket read it, is `POST` -- so every `GET`-side
 *    writer the audit planted holds a request that fails here;
 * 3. it is same-origin: `Sec-Fetch-Site: same-origin` **and** an `Origin`
 *    naming this machine at the address the request was sent to;
 * 4. `modeRefusal`, the one check the two kinds do not share;
 * 5. it carries this process's token (D-0041 rule 3b).
 *
 * **One mint per request, whichever kind**: the arrival is taken out of
 * {@link live} when it passes, so a request that minted a send cannot also mint
 * a press, nor the other way round.
 */
function spendArrival(
  c: Context<PageEnv>,
  postedToken: unknown,
  modeRefusal: (incoming: Arrival) => string | null,
): Refused | null {
  const key = (c.env as Partial<PageEnv["Bindings"]> | undefined)?.incoming;
  const incoming = key === undefined ? undefined : live.get(key);
  if (key === undefined || incoming === undefined) {
    return {
      status: 403,
      line: "that request did not arrive on this page's socket",
    };
  }
  if (incoming.method !== "POST") {
    return { status: 403, line: "only a POST can write from this page" };
  }
  const origin = header(incoming, "origin");
  let originHost: string | null = null;
  try {
    originHost = origin === undefined ? null : new URL(origin).host;
  } catch {
    originHost = null;
  }
  if (
    header(incoming, "sec-fetch-site") !== "same-origin" ||
    originHost === null ||
    originHost !== header(incoming, "host") ||
    !fromThisMachine(originHost)
  ) {
    return { status: 403, line: "that request came from another page" };
  }
  const mode = modeRefusal(incoming);
  if (mode !== null) {
    return { status: 403, line: mode };
  }
  if (incoming.token === undefined || !sameToken(postedToken, incoming.token)) {
    return {
      status: 403,
      line: "that form did not come from this page; reload it and try again",
    };
  }
  live.delete(key);
  return null;
}

/**
 * Mint a {@link Press} from the request being handled, or say why not.
 *
 * **The only function that makes one, and every condition is a fact about the
 * live request** (D-0059 section 5a, first row): {@link spendArrival}'s shared
 * checks, and in the mode's place **a navigation a person made** --
 * `Sec-Fetch-Mode: navigate` and `Sec-Fetch-User: ?1`, which refuses `fetch`,
 * an htmx `hx-post` (`cors`, no `?1`) and a script's `form.submit()` with no
 * gesture (no `?1`).
 *
 * Every one of those is read off the {@link Arrival} the listener froze, and
 * the expected token with them, so a writer inside the process can neither
 * rewrite the request it holds nor name the value its guess is compared to.
 */
export function mintPress(
  c: Context<PageEnv>,
  postedToken: unknown,
): { readonly press: Press } | Refused {
  const refused = spendArrival(c, postedToken, (incoming) =>
    header(incoming, "sec-fetch-mode") === "navigate" && header(incoming, "sec-fetch-user") === "?1"
      ? null
      : "only a person pressing this page's button can answer a gate, and a script cannot",
  );
  if (refused !== null) {
    return refused;
  }
  const press = Object.freeze({}) as Press;
  minted.add(press);
  return { press };
}

/**
 * One message sent from the page into a request thread, minted from one live
 * request (D-0059 section 5a, last row).
 *
 * Opaque for {@link Press}'s reasons and with its own brand and its own set, so
 * a press cannot be spent as a send nor a send as a press.
 */
declare const sendBrand: unique symbol;
export type Send = { readonly [sendBrand]: true };

/** Every send {@link mintSend} has minted and no port has spent yet. */
const mintedSends = new WeakSet<object>();

/**
 * Mint a {@link Send} from the request being handled, or say why not.
 *
 * {@link spendArrival}'s shared checks, and in the mode's place only this:
 * `Sec-Fetch-Mode` is `navigate` (a native form submit, script off) or `cors`
 * (htmx's `hx-post`), and no `Sec-Fetch-User` is asked for. **What that gives
 * up is section 5a's stated residual**: a same-origin script can send a message
 * nobody typed. A message is append-only and is not an act -- it answers no
 * gate and approves nothing, because every approval has its own port and needs
 * a press.
 */
export function mintSend(
  c: Context<PageEnv>,
  postedToken: unknown,
): { readonly send: Send } | Refused {
  const refused = spendArrival(c, postedToken, (incoming) => {
    const mode = header(incoming, "sec-fetch-mode");
    return mode === "navigate" || mode === "cors"
      ? null
      : "only this page's own form can send a message";
  });
  if (refused !== null) {
    return refused;
  }
  const send = Object.freeze({}) as Send;
  mintedSends.add(send);
  return { send };
}

/**
 * Record the framing this press rests on, carry one body to one iteration's
 * open gate, and say what happened.
 *
 * The caller supplies this; nothing about continuo, a gate walk, an actor or
 * the ledger is known here. `ok` false is a refusal a person can act on -- a
 * row that ended, a gate already closed, a continuo that will not start, or a
 * framing that could not be recorded (D-0042 rule 3) -- and the page shows
 * `note` rather than redrawing, because a redraw would show a gate that is
 * still open and no reason why.
 */
export type AnswerFromWeb = (
  iterationId: string,
  body: string,
) => Promise<{ readonly ok: boolean; readonly note: string }>;

/**
 * The whole of what this surface may write (D-0041 rules 4 and 7, D-0059 R4).
 *
 * **The press check is here, inside the capability**, and not at the route:
 * whoever holds this object -- the one `POST` route, or a `GET` handler, a
 * middleware or a sub-app that should not -- reaches the implementation only
 * through {@link answer}, and {@link answer} writes nothing without a press
 * {@link mintPress} minted and nobody has spent. The implementation is a
 * private field, so there is no second way in.
 *
 * One function inside and not a store, for the reason it always was: with an
 * `IterationStore` here every later edit could write anything a store can
 * write and the compiler would agree.
 */
export class AnswerPort {
  readonly #answer: AnswerFromWeb;

  constructor(answer: AnswerFromWeb) {
    this.#answer = answer;
  }

  /**
   * Answer one iteration's gate with the page's one word, on one press.
   *
   * The body is {@link APPROVE_BODY} and not an argument: the page's writing
   * vocabulary is one word whatever a caller says (D-0041 rule 7).
   */
  async answer(
    press: Press,
    iterationId: string,
  ): Promise<{ readonly ok: boolean; readonly note: string }> {
    if (!minted.has(press)) {
      return {
        ok: false,
        note: "nothing was answered: this was not a person's press",
      };
    }
    minted.delete(press);
    return await this.#answer(iterationId, APPROVE_BODY);
  }
}

/** One message a person sends from the page, as the say port carries it. */
export interface SentMessage {
  /** Minted by rondo when the form was rendered (`newMessageId`), never typed. */
  readonly messageId: string;
  /** The words as the person wrote them. */
  readonly body: string;
  /** Null for a new request; the message replied to otherwise. */
  readonly inReplyTo: string | null;
}

/**
 * Record one operator message into a request thread, and say what happened.
 *
 * The caller supplies this (`recordThreadMessage` under the approver's name);
 * `ok` false carries the store's refusal -- a reply to nothing, an id already
 * in the conversation -- for the page to show.
 */
export type SayFromWeb = (
  message: SentMessage,
) => Promise<{ readonly ok: boolean; readonly note: string }>;

/**
 * The second thing this surface may write (D-0059 section 5a, last row): a
 * message into a request thread, and nothing else.
 *
 * **The send check is inside the capability**, as the press check is in
 * {@link AnswerPort}: whoever holds this object reaches the implementation only
 * through {@link say}, which writes nothing without a send {@link mintSend}
 * minted and nobody has spent.
 */
export class SayPort {
  readonly #say: SayFromWeb;

  constructor(say: SayFromWeb) {
    this.#say = say;
  }

  /** Record one message, on one send. */
  async say(
    send: Send,
    message: SentMessage,
  ): Promise<{ readonly ok: boolean; readonly note: string }> {
    if (!mintedSends.has(send)) {
      return {
        ok: false,
        note: "nothing was sent: this did not come from this page's form",
      };
    }
    mintedSends.delete(send);
    return await this.#say(message);
  }
}

/** The ports the server is handed: the reading half, and the two writers. */
export interface ServedPorts extends WebPorts {
  /**
   * Null when `RONDO_APPROVER` is unset, which is also when no button is drawn
   * -- rondo does not act for an unnamed person on a screen either (D-0020
   * rule 2).
   */
  readonly answer: AnswerPort | null;
  /** Null on the same condition as {@link answer}: no approver, no forms. */
  readonly say: SayPort | null;
}

/**
 * Whether a `Host` (or an `Origin`'s host) names this machine.
 *
 * **Binding to loopback is not by itself enough, and this is the gap it
 * leaves.** A browser will happily send a page from `evil.example` a request to
 * a name the attacker has re-pointed at `127.0.0.1` -- DNS rebinding -- and the
 * socket cannot tell that request from the operator's own. What differs is the
 * `Host` header, so the page is served to the three spellings of this machine
 * and to nothing else. A request with no `Host` at all is refused: HTTP/1.1
 * requires one, and the only clients that omit it are not browsers.
 */
function fromThisMachine(host: string | undefined): boolean {
  if (host === undefined) {
    return false;
  }
  // The port is whatever this server was asked to listen on, so only the name
  // is checked. `[::1]:7333` keeps its brackets; `127.0.0.1:7333` does not.
  const name = host.startsWith("[")
    ? host.slice(0, host.indexOf("]") + 1)
    : (host.split(":")[0] ?? "");
  return name === "127.0.0.1" || name === "localhost" || name === "[::1]";
}

/**
 * The cap on a request body. Not a performance measure: the form is two short
 * fields, and a request bigger than that is not the page's form.
 */
const MAX_FORM_BYTES = 4096;

/**
 * The send routes (D-0059 section 5a, last row), by the kind of message each
 * sends. A path and not a query on `/`, so the write table names each kind.
 */
const SEND_ROUTES: ReadonlyMap<string, SentKind> = new Map([
  ["/request", "request"],
  ["/reply", "reply"],
]);

/**
 * The cap on a send's body: a person's words, not two short fields. 64 KiB is
 * a few pages of prose even percent-encoded (a CJK character is 9 bytes), and
 * a request bigger than that is still not the page's form.
 */
const MAX_MESSAGE_BYTES = 64 * 1024;

/**
 * The files this process serves, as a fixed map from path to file (D-0059 R1).
 *
 * **The manifest's files, and nothing else static** (D-0059 R2 retired D-0054's
 * two hand-served scripts). The built files are named by `page.manifest.json`,
 * the digest list CI checks `dist/page` against, so the set this server will
 * serve and the set CI vouches for are one list -- the stylesheet, htmx, the
 * key script and the two faces; a name that is not a plain file name is dropped
 * rather than joined into a path. No request contributes to a path: an address
 * not in this map is a 404 even when a file of that name exists.
 *
 * Resolved against this module rather than the working directory: from
 * `src/access/` and from `dist/access/`, `../../` is the repository root. A
 * missing file is a 404 and not a 500 (D-0054 rule 7), which is also what a
 * test run before `npm run build` sees for the built half.
 */
const SERVED: ReadonlyMap<string, { readonly file: URL; readonly type: string }> = new Map(
  Object.keys(
    JSON.parse(
      readFileSync(new URL("../../page.manifest.json", import.meta.url), "utf8"),
    ) as Record<string, string>,
  )
    .filter((name) => /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name))
    .map(
      (name) =>
        [
          `/${name}`,
          {
            file: new URL(`../../dist/page/${name}`, import.meta.url),
            type: typeOf(name),
          },
        ] as const,
    ),
);

/** A served file's content type, by its extension. */
function typeOf(name: string): string {
  if (name.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }
  if (name.endsWith(".js")) {
    return "text/javascript; charset=utf-8";
  }
  return name.endsWith(".woff2") ? "font/woff2" : "application/octet-stream";
}

/**
 * Which of the one page's three views is being read, off the query and nothing
 * else. Total: anything that is not one of the two queries is the summary,
 * because a typo in a query is an operator who wanted the page.
 */
function viewOf(query: URLSearchParams): PageView {
  const thread = query.get("thread");
  if (thread !== null && thread !== "") {
    const to = query.get("to");
    return {
      kind: "thread",
      messageId: thread,
      to: to === null || to === "" ? null : to,
    };
  }
  if (query.get("requests") === "open") {
    return { kind: "requests" };
  }
  const answering = query.get("answer");
  if (answering !== null && answering !== "") {
    return { kind: "answer", iterationId: answering };
  }
  return query.get("reading") === "open" ? { kind: "reading" } : { kind: "summary" };
}

/** Text made safe to place in HTML, as element content or a quoted attribute. */
function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** A plain-text response a person can read, for every refusal. */
function said(c: Context<PageEnv>, status: 400 | 403 | 404 | 409 | 413 | 421 | 500, line: string) {
  return c.body(`${line}\n`, status, {
    "content-type": "text/plain; charset=utf-8",
  });
}

/**
 * The page as a Hono app, a function of rondo's ports and this process's token.
 *
 * **The routes are the vocabulary** (D-0059 R4): `GET` of the fixed files,
 * `GET /` for the three views, and section 5a's closed table of write routes:
 * `POST /`, the lap-end `approve` press, and the two sends, `POST /request`
 * and `POST /reply`. `test/access/web-app.test.ts` enumerates `app.routes` and
 * fails on any other non-`GET` entry.
 */
export function createApp(ports: ServedPorts, token: string): Hono<PageEnv> {
  // The writer is taken off before anything reading is handed the rest, so
  // the renderer does not hold it at runtime either (D-0041 rule 4).
  const { answer, say, ...reading } = ports;
  const app = new Hono<PageEnv>();
  tokens.set(app, token);

  // **The method, then the `Host`**, above every path, as the hand-written
  // server ordered them: a method that is neither a read nor the one write is
  // a 405 wherever it is sent, and a rebound page learns nothing else -- not
  // even which paths exist.
  app.use(async (c, next) => {
    if (!["GET", "HEAD", "POST"].includes(c.req.method)) {
      return c.body(null, 405, { allow: "GET, HEAD, POST" });
    }
    return fromThisMachine(c.req.header("host"))
      ? await next()
      : said(c, 421, "rondo serves this page to 127.0.0.1 and localhost only");
  });
  app.use(
    secureHeaders({
      // `frame-ancestors 'none'` is the door the token cannot hold (D-0041
      // rule 3): a page elsewhere cannot read this one, but it can frame it
      // under a button of its own, and the click would carry the real token.
      // `default-src` and `script-src` `'self'` are R2's substitute: nothing
      // runs that this process did not serve. Since the views moved onto the
      // built `app.css` there is no inline style at all, so `style-src` is
      // `'self'` with no exception.
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'self'"],
      },
      xFrameOptions: "DENY",
      // **`same-origin`, and not the middleware's `no-referrer`**, because the
      // press depends on it. Under `no-referrer` Chromium sends a form `POST`
      // with `Origin: null` (measured on this page, 2026-09-14, headless
      // Chromium 151), and {@link mintPress} refuses a null `Origin` -- so the
      // default refused every real click on `approve` while every test that
      // wrote the headers by hand passed. `same-origin` sends the origin to
      // this page and still sends nothing to anywhere else.
      referrerPolicy: "same-origin",
      // HSTS on an http loopback page would at best be ignored and at worst
      // pin every localhost server on this machine to https.
      strictTransportSecurity: false,
    }),
  );
  // Hono's own cross-site refusal, on the one address that takes a `POST`: a
  // form-shaped `POST` with neither a same-origin `Sec-Fetch-Site` nor this
  // origin is refused before the route. Mounted on `/` only, so a `POST` to a
  // served file stays the 404 any unknown write is.
  app.use("/", csrf());
  for (const path of SEND_ROUTES.keys()) {
    app.use(path, csrf());
  }
  // One limit middleware, sized by the address: a send carries a person's
  // words, every other request at most the press's two short fields.
  const pressLimit = bodyLimit({
    maxSize: MAX_FORM_BYTES,
    onError: (c) => said(c, 413, "that is larger than this page's form"),
  });
  const sendLimit = bodyLimit({
    maxSize: MAX_MESSAGE_BYTES,
    onError: (c) => said(c, 413, "that message is longer than this page accepts"),
  });
  app.use(async (c, next) =>
    SEND_ROUTES.has(c.req.path) ? await sendLimit(c, next) : await pressLimit(c, next),
  );

  for (const [path, served] of SERVED) {
    app.get(path, async (c) => {
      try {
        const bytes = await readFile(served.file);
        return c.body(bytes, 200, { "content-type": served.type });
      } catch {
        return said(c, 404, "not found");
      }
    });
  }

  app.get("/", async (c) => {
    const query = new URL(c.req.url).searchParams;
    // **Rule 2's five steps, once per request** (D-0056).
    const asked: LanguageAsked = {
      query: query.get("lang"),
      cookie: c.req.header("cookie"),
      host: reading.hostLanguage,
      header: c.req.header("accept-language"),
    };
    const wording = resolveLanguage(asked);
    const view = viewOf(query);
    // **The bytes and the redirect depend on two request headers**, and a
    // shared cache is entitled to know.
    c.header("vary", "accept-language, cookie");
    // **Rule 5's one cookie, on the one condition rule 5 names**: this URL
    // asked for a language the remaining steps would not have answered. The
    // four attributes are rule 5's. **Only on a navigation**: htmx's redraw is a
    // same-origin XHR that sends and stores cookies, so two tabs on two
    // languages would otherwise overwrite each other's memory every five
    // seconds with nobody switching anything.
    const mode = c.req.header("sec-fetch-mode");
    const navigated =
      c.req.header("hx-request") !== "true" && (mode === undefined || mode === "navigate");
    if (navigated && isSwitch(asked, wording)) {
      setCookie(c, LANG_COOKIE, wording.lang, {
        path: "/",
        sameSite: "Strict",
        httpOnly: true,
        maxAge: LANG_COOKIE_SECONDS,
      });
    }
    // **The resolution is never silent** (rule 4): served only when `lang` is
    // the tag of the set rule 2 resolved, otherwise one `303` to the same view
    // carrying it. It cannot loop, because a set's own tag resolves to itself.
    if (asked.query !== wording.lang) {
      return c.redirect(viewHref(view, wording.lang), 303);
    }
    const html = await operatorPage(
      reading,
      answer === null ? null : token,
      view,
      wording,
      say === null ? null : newMessageId,
    );
    return c.body(html, 200, { "content-type": "text/html; charset=utf-8" });
  });

  // **The one write route**: the lap-end `approve` press (D-0059 section 5a,
  // first row). Everything that decides whether this request may write happens
  // in `mintPress`, and the port checks the press again on its own side.
  app.post("/", async (c) => {
    if (answer === null) {
      return said(
        c,
        403,
        "RONDO_APPROVER is not set, so there is nobody this page could answer as",
      );
    }
    const form = await c.req.parseBody();
    const minting = mintPress(c, form["token"]);
    if (!("press" in minting)) {
      return said(c, minting.status, minting.line);
    }
    const iterationId = form["iteration"];
    if (typeof iterationId !== "string" || iterationId === "") {
      return said(c, 400, "that form named no iteration");
    }
    const answered = await answer.answer(minting.press, iterationId);
    if (!answered.ok) {
      return said(c, 409, answered.note);
    }
    // **The tag the press was made under, for the `303`** (D-0056 rule 11),
    // read back off the form's own `action`; the press writes no cookie.
    return c.redirect(viewHref({ kind: "summary" }, tagOf(c)), 303);
  });

  // **The two send routes** (D-0059 section 5a, last row): a new request and a
  // reply. Everything that decides whether this request may write happens in
  // `mintSend`, and the port checks the send again on its own side. The same
  // handler answers a native submit and an htmx `hx-post`: both get the `303`,
  // which htmx follows as a `GET` and swaps in.
  for (const [path, kind] of SEND_ROUTES) {
    app.post(path, async (c) => {
      if (say === null) {
        return refused(c, 403, "sendRefusedNoApprover", null);
      }
      const form = await c.req.parseBody();
      const back = typeof form["in_reply_to"] === "string" ? form["in_reply_to"] : null;
      const minting = mintSend(c, form["token"]);
      if (!("send" in minting)) {
        return refused(c, minting.status, "sendRefusedForm", back);
      }
      const messageId = form["message_id"];
      if (typeof messageId !== "string" || !SENT_MESSAGE_ID.test(messageId)) {
        return refused(c, 400, "sendRefusedForm", back);
      }
      const body = form["body"];
      if (typeof body !== "string" || body.trim() === "") {
        return refused(c, 400, "sendRefusedNoWords", back);
      }
      const inReplyTo = kind === "reply" ? back : null;
      if (kind === "reply" && (inReplyTo === null || inReplyTo === "")) {
        return refused(c, 400, "sendRefusedForm", null);
      }
      const message = { messageId, body, inReplyTo };
      const sent = await say.say(minting.send, message);
      // **A second submit of one form is the send it repeats** (#220 S1
      // review): the id was minted when the form was drawn precisely so that
      // the store refuses the second row, and the words the person sent are in
      // the thread under that id. Telling them "not sent" would be false, and
      // would keep the draft for a third send under a fresh id. Only the same
      // words, to the same message, in the operator's voice count; any other
      // holder of the id is a refusal like the rest.
      if (!sent.ok && !(await alreadyThere(message))) {
        return refused(c, 409, "sendRefusedNotTaken", inReplyTo);
      }
      // **The thread, at the message just sent**: the thread view resolves any
      // message to its request, so the new id is the whole address.
      return c.redirect(
        `${viewHref({ kind: "thread", messageId, to: null }, tagOf(c))}#${messageId}`,
        303,
      );
    });
  }

  /** Whether the thread already holds exactly this operator message. */
  async function alreadyThere(message: SentMessage): Promise<boolean> {
    const read = await reading.record.threadMessages();
    return (
      read.kind === "read" &&
      read.messages.some(
        (held) =>
          held.messageId === message.messageId &&
          held.authorKind === "operator" &&
          held.body === message.body &&
          held.inReplyTo === message.inReplyTo,
      )
    );
  }

  /**
   * A send's refusal, as one catalogue sentence in the page's language and
   * never the store's or the mint's internal line (#220 S1 review: no ids, no
   * D-numbers in front of a person). htmx gets it as `#send-refused`, which the
   * page's `responseHandling` puts under the draft; a native submit, with
   * script off, gets a small page of its own with the way back to the thread
   * (`back`, the message replied to, or the requests) and where the words are.
   * Same status either way.
   */
  function refused(
    c: Context<PageEnv>,
    status: 400 | 403 | 409,
    why: "sendRefusedNoApprover" | "sendRefusedForm" | "sendRefusedNoWords" | "sendRefusedNotTaken",
    back: string | null,
  ) {
    const wording = wordingOf(c);
    const line = escapeHtml(wording.notSent(wording[why]));
    if (c.req.header("hx-request") === "true") {
      return c.html(`<p id="send-refused">${line}</p>`, status);
    }
    const href = escapeHtml(
      viewHref(
        back === null || back === ""
          ? { kind: "requests" }
          : { kind: "thread", messageId: back, to: null },
        wording.lang,
      ),
    );
    return c.html(
      `<!doctype html><html lang="${escapeHtml(wording.lang)}"><head><meta charset="utf-8">` +
        `<meta name="viewport" content="width=device-width, initial-scale=1">` +
        `<title>${escapeHtml(wording.sendAction)}</title></head><body>` +
        `<p id="send-refused">${line}</p><p>${escapeHtml(wording.sendBackNote)}</p>` +
        `<p><a href="${href}">${escapeHtml(wording.sendBack)}</a></p></body></html>`,
      status,
    );
  }

  /**
   * The wording a write was made under, for its `303` and its refusal (D-0056
   * rule 11), read back off the form's own `action`; a write sets no cookie.
   */
  function wordingOf(c: Context<PageEnv>) {
    return resolveLanguage({
      query: new URL(c.req.url).searchParams.get("lang"),
      cookie: c.req.header("cookie"),
      host: reading.hostLanguage,
      header: c.req.header("accept-language"),
    });
  }

  function tagOf(c: Context<PageEnv>): string {
    return wordingOf(c).lang;
  }

  // One page and no router: a typo'd path says so rather than quietly showing
  // the only page there is.
  app.notFound((c) => said(c, 404, "not found"));
  // Every reader the page uses is total, so a throw is a defect: shown rather
  // than swallowed. Hono's own refusals (`csrf`) keep their response.
  app.onError((error, c) =>
    "getResponse" in error && typeof error.getResponse === "function"
      ? (error.getResponse() as Response)
      : said(c, 500, error.message),
  );
  return app;
}

/**
 * Serve an app on `127.0.0.1` until the server is closed.
 *
 * **The listener freezes each request it hands the app** into {@link live}, and
 * that is what {@link mintPress} checks first -- so this function, and not the
 * app, is where a request becomes one a person could have pressed with.
 *
 * `127.0.0.1` is written here rather than taken as an argument: a page with no
 * authentication bound to anything else is a page anybody on the network can
 * read. Resolves 0 when the server closes and 1 when it cannot listen.
 */
export function serveApp(
  app: Hono<PageEnv>,
  port: number,
  listening: (boundPort: number) => void,
  announceError: (line: string) => void,
  signal?: AbortSignal,
): Promise<number> {
  // **`getRequestListener` and `app.request`, and not the adapter's `fetch`
  // option and `app.fetch`**: the import-boundary sweep refuses the name
  // `fetch` anywhere under `src/` (D-0006), and that sweep is about the
  // ambient network global, which Hono's handler is not. `app.request` handed a
  // `Request` and no init dispatches that same object, so what the app
  // receives is exactly what this listener registered.
  const server = createServer(
    getRequestListener(
      (request, env) => {
        const { incoming } = env as PageEnv["Bindings"];
        live.set(
          incoming,
          Object.freeze({
            method: incoming.method,
            headers: Object.freeze({ ...incoming.headers }),
            token: tokens.get(app),
          }),
        );
        return app.request(request, undefined, env);
      },
      { hostname: "127.0.0.1" },
    ),
  );
  return new Promise<number>((resolve) => {
    server.on("error", (error: Error) => {
      announceError(`the operator page could not be served: ${error.message}`);
      resolve(1);
    });
    server.on("close", () => {
      resolve(0);
    });
    server.listen({ port, host: "127.0.0.1", ...(signal === undefined ? {} : { signal }) }, () => {
      // The port that was **bound**, not the one asked for: they differ when
      // the caller asked for 0.
      const bound = server.address();
      listening(bound !== null && typeof bound === "object" ? bound.port : port);
    });
  });
}

/**
 * Serve the page on localhost until the server is closed.
 *
 * The signature and the announcement are the ones `src/access/cli.ts` has
 * always called. `signal` is `listen`'s own: the command line passes none, a
 * test passes one.
 */
export function serveOperatorPage(
  ports: ServedPorts,
  port: number,
  announce: (line: string) => void,
  announceError: (line: string) => void,
  signal?: AbortSignal,
): Promise<number> {
  // **Minted once, when this process starts serving** (D-0041 rule 3b): per
  // process, because a token that changed under the five-second redraw would
  // expire every form before anybody could press it.
  const token = randomUUID();
  return serveApp(
    createApp(ports, token),
    port,
    (at) => {
      announce(
        `rondo is ${ports.answer === null ? "reading" : "reading and answering"} at ` +
          `http://127.0.0.1:${String(at)}/ -- ctrl-c to stop`,
      );
    },
    announceError,
    signal,
  );
}
