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
  // Aliased: this module already exports an `AnswerOutcome` of its own, for
  // what one *gate* answer came to (D-0041). The store's is what a person's
  // answer does to a waiting question (D-0072), a different thing with the
  // same natural name, so the narrower name is taken here rather than either
  // one renamed out from under its callers.
  type AnswerOutcome as AskAnswer,
  FINDING_SEVERITIES,
  type FindingSeverity,
  SCOPE_OUTWARD_ACTS,
  type ScopeBudgets,
  type ScopeOutwardAct,
} from "../store/records.js";
import type { ThreadMessagesReadOutcome } from "../store/sqlite.js";
import type { WebPorts } from "./page/contract.js";
import {
  isSwitch,
  LANG_COOKIE,
  LANG_COOKIE_SECONDS,
  type LanguageAsked,
  resolveLanguage,
} from "./page-logic/language.js";
import { MAX_REVIEW_ROUNDS, type PageView, viewHref } from "./page-logic/routes.js";
import { APPROVE_BODY, operatorPage } from "./web.js";
import type { Chrome } from "./wording.js";

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
  claim: string | null,
) => Promise<AnswerOutcome>;

/**
 * Why a press carrying a claim answered nothing, as the wording key the page
 * says it in (rondo#220 S2 review). A person causes these by typing or by
 * answering a gate someone else already did, so they are said in the
 * request's language with the way back to the gate, never as the English
 * plain-text line the older refusals are.
 */
export type ClaimRefusal =
  | "claimTooLong"
  | "claimGateUnread"
  | "claimGateClosed"
  | "claimNotRecorded"
  /**
   * The one of these the person did not cause: the write failed on an errno,
   * so pressing again changes nothing until this machine is repaired
   * (rondo#349, `D-0076` rule 4.3).
   */
  | "claimHostSetup";

/** What one answer came to; `why` is set only on a claim's own refusals. */
export interface AnswerOutcome {
  readonly ok: boolean;
  readonly note: string;
  readonly why?: ClaimRefusal;
}

/**
 * The longest verification claim an approve press carries, in characters.
 *
 * Not a performance measure: a claim is a sentence or two saying what the
 * person ran (`D-0045` rule 3), and a longer one is refused in words rather
 * than cut, because a claim recorded shorter than it was said is a claim the
 * person did not make. Sized so that the whole form, percent-encoded at 9 bytes
 * a CJK character, still fits {@link MAX_FORM_BYTES}.
 */
export const MAX_CLAIM_CHARS = 1000;

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
   *
   * **The press may carry what the person says they verified** (`D-0045`, as
   * annotated from rondo#220: a claim is part of the approve press, not a write
   * of its own, so nothing but a press reaches it). Trimmed here, inside the
   * capability, so every holder gets the same rule: nothing but whitespace is no
   * claim, and one longer than {@link MAX_CLAIM_CHARS} answers nothing and says
   * so. What happens to it after that is the implementation's, which records it
   * exactly as `rondo answer --verified` does.
   */
  async answer(
    press: Press,
    iterationId: string,
    claim: string | null = null,
  ): Promise<AnswerOutcome> {
    if (!minted.has(press)) {
      return {
        ok: false,
        note: "nothing was answered: this was not a person's press",
      };
    }
    minted.delete(press);
    const said = claim?.trim() ?? "";
    if (said.length > MAX_CLAIM_CHARS) {
      return {
        ok: false,
        why: "claimTooLong",
        note:
          `nothing was answered: what you said you verified is ${String(said.length)} ` +
          `characters, and this page takes at most ${String(MAX_CLAIM_CHARS)}. Shorten it ` +
          "and press again.",
      };
    }
    return await this.#answer(iterationId, APPROVE_BODY, said === "" ? null : said);
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
  /**
   * Which of D-0072's two answers this message carries, null for a message
   * that answers nothing.
   *
   * **An argument of its own rather than a field of {@link SentMessage}**, so
   * that a holder of {@link SayPort.say} cannot express an answer at all:
   * `say` always passes null and only {@link SayPort.answerAsk} passes a
   * value. The capability boundary D-0059 section 5a draws between a send and
   * a press is then the type's, not a reviewer's.
   */
  answerOutcome: AskAnswer | null,
) => Promise<{ readonly ok: boolean; readonly note: string }>;

/** What {@link SayPort.say} answers: `waitingAsk` marks the one refusal the port makes itself. */
export interface Said {
  readonly ok: boolean;
  readonly note: string;
  readonly waitingAsk?: true;
}

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
  readonly #threads: () => Promise<ThreadMessagesReadOutcome>;

  constructor(say: SayFromWeb, threads: () => Promise<ThreadMessagesReadOutcome>) {
    this.#say = say;
    this.#threads = threads;
  }

  /** Record one message, on one send. */
  async say(send: Send, message: SentMessage): Promise<Said> {
    if (!mintedSends.has(send)) {
      return {
        ok: false,
        note: "nothing was sent: this did not come from this page's form",
      };
    }
    mintedSends.delete(send);
    // **A reply to a question still waiting is not a send** (#220 S1 review,
    // D-0059 section 5a's last revisit condition): while nothing replies to an
    // ask it holds its line (D-0066 rules 4.2 and 4.4), and the first reply
    // releases that hold -- a message that moves work, which section 5a says
    // then needs a press too. Refused here, inside the capability, so whatever
    // holds a send is refused and not only the page's route; fail closed when
    // the thread cannot be read. The page answers a waiting ask through
    // {@link answerAsk}, on a press (D-0059 section 5a's falsifier, D-0069 rule
    // 5). Not a race: `asks` never changes on a row, and an ask answered in
    // between has no hold left.
    if (message.inReplyTo !== null && (await this.#waiting(message.inReplyTo))) {
      return {
        ok: false,
        note: "a question still waiting is answered by a press",
        waitingAsk: true,
      };
    }
    return await this.#say(message, null);
  }

  /**
   * Record one reply that answers a question, on one **press** (#220 S1).
   *
   * **Why a press and not a send.** D-0059 section 5a's falsifier: "A message
   * posted with no person typing it being acted on as if the person had said
   * it ... If a later entry lets a message move work, the send needs a press
   * too." D-0069 rule 5 makes an unanswered ask hold back an operator-written
   * first admission, so the reply that answers it releases work: it is that
   * later entry. Same writer as {@link say} (the operator's message under the
   * approver's name), reached only with a press {@link mintPress} minted and
   * nobody has spent -- so a script's `hx-post` or `fetch`, which can mint a
   * send, cannot answer a question. A press may reply to any message; it is
   * the route for a question because only a question needs one.
   */
  async answerAsk(
    press: Press,
    message: SentMessage & { readonly inReplyTo: string },
    /**
     * What the person pressed (D-0072 rule 4): `carry_on` releases the hold,
     * `stop` records that they stopped the line and leaves it held. **The page
     * never defaults it** -- the route refuses a press that names neither,
     * because a default would be rondo answering for the person on the one
     * press whose whole content is which answer it is.
     */
    answerOutcome: AskAnswer,
  ): Promise<Said> {
    if (!minted.has(press)) {
      return { ok: false, note: "nothing was answered: this was not a person's press" };
    }
    minted.delete(press);
    return await this.#say(message, answerOutcome);
  }

  /**
   * Whether `messageId` asks and is still open, or the thread cannot be read.
   *
   * **The same reading `openAsksIn` takes** (D-0072 rule 3), off the same rows:
   * open while no operator reply carries `carry_on`. So a plain reply to a
   * question the person answered `stop` is still refused and still routed to
   * the press -- the hold is still there, and a send must not be the thing that
   * lifts it.
   */
  async #waiting(messageId: string): Promise<boolean> {
    const read = await this.#threads();
    return (
      read.kind !== "read" ||
      (read.messages.some((held) => held.messageId === messageId && held.asks) &&
        !read.messages.some(
          (held) =>
            held.inReplyTo === messageId &&
            held.authorKind === "operator" &&
            held.answerOutcome === "carry_on",
        ))
    );
  }
}

/**
 * The id one scope form carries, minted **when the form is rendered** and held
 * in it as a hidden field (D-0061 rule 2.1's reason, applied to a scope).
 *
 * **Rondo names the scope, and the person never types an id.** Minted at render
 * rather than at arrival so that one form pressed twice -- a double click, a
 * resend after a slow write -- carries one id, and the store's uniqueness
 * refuses the second rather than recording two scopes the person drafted once.
 * `commandScope` mints `scope-<ms>` for the same row; a page cannot, because
 * two presses in one millisecond are one form and two clocks are not a
 * uniqueness argument.
 */
export function newScopeId(): string {
  return `scope-${randomUUID()}`;
}

/**
 * The iteration id a scoped start reserves, minted at render for
 * {@link newScopeId}'s reason (D-0023: rondo derives the run id, the topic
 * branch and the workspace from it, and on a page nobody types one).
 *
 * `lap-` and a UUID is 40 characters of `[a-z0-9-]` after a lowercase letter,
 * so it passes the closed alphabet `commandStart` names
 * (`ITERATION_ID_PATTERN`, `src/refrain/allocator.ts`).
 */
export function newIterationId(): string {
  return `lap-${randomUUID()}`;
}

/**
 * A row id for what the model drafter writes (D-0071 rule 7.3): its proposal,
 * its scope and its thread messages, each with a prefix a reader can tell
 * apart. Here for {@link newMessageId}'s reason: this module is the one
 * granted `randomUUID`.
 */
export function newDraftId(
  kind: "draft" | "drafted-scope" | "drafter" | "drafter-host" | "forge",
): string {
  return `${kind}-${randomUUID()}`;
}

/** The shape {@link newScopeId} mints, and the only shape `POST /scope` accepts. */
const PAGE_SCOPE_ID = /^scope-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** The shape {@link newIterationId} mints, and the only shape `POST /start` accepts. */
const PAGE_ITERATION_ID = /^lap-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * The five budget numbers a scope form posts, after this module has read them
 * as numbers, with the two digests the form was **drawn** from.
 *
 * The digests are not written: the writer re-reads the plan and records what is
 * on disk (D-0066 rule 2.2's purpose, `recordScopeFromPage`). They are what that
 * re-read is compared against, so a plan that moved between the draw and the
 * press refuses the press instead of approving a workspace and an agent type
 * nobody saw.
 */
export interface ScopeFormDraft {
  readonly scopeId: string;
  readonly requestMessageId: string;
  readonly planDigest: string;
  readonly agentTypeDigest: string;
  readonly budgets: ScopeBudgets;
  readonly severityThreshold: FindingSeverity;
  readonly outwardActs: readonly ScopeOutwardAct[];
}

/** Why a record-scope press recorded nothing, as the wording key the page says it in. */
export type ScopeRefusal =
  | "scopeRefusedNotTaken"
  | "scopeRefusedPlanChanged"
  | "scopeRefusedEdited"
  | "scopeRefusedNotRead"
  | "scopeRefusedNotShown"
  | "scopeRefusedNotApproved"
  | RaiseRefusal;

/**
 * Why a raise press recorded nothing, beside the refusals it shares with the
 * scope screen's two (D-0074 rule 4.4): the approval posted is no longer the
 * line's tip (somebody raised it already), the line has two tips, or the lap
 * it was pressed for is no longer waiting for the person.
 */
export type RaiseRefusal = "raiseRefusedNotTip" | "raiseRefusedForked" | "raiseRefusedNotAtGate";

/** What one record-scope press came to; `why` is set only on a refusal. */
export interface ScopeRecorded {
  readonly ok: boolean;
  readonly note: string;
  readonly why?: ScopeRefusal;
  /** The decision the press approved, for the `303` to address the screen's second state with. */
  readonly scopeDecisionId?: string;
}

/** Record the framing, the scope and its approval, and say what happened. */
export type RecordScopeFromWeb = (draft: ScopeFormDraft) => Promise<ScopeRecorded>;

/** What a scoped start names; every field was minted or read by rondo, never typed. */
export interface ScopedStartInput {
  readonly iterationId: string;
  readonly requestMessageId: string;
  readonly scopeDecisionId: string;
  /** The held plan the lap runs on, by digest (rondo#238): read again in the port, never posted whole. */
  readonly planDigest: string;
}

/** Why a scoped start admitted nothing, as the wording key the page says it in. */
export type StartRefusal =
  | "startRefusedNoRequest"
  | "startRefusedNoPlan"
  | "startRefusedNoContinuo"
  | "startRefusedOutside"
  | "startRefusedHeld"
  | "startRefusedNotAdmitted";

/** What one scoped start came to; `test` is the `ScopeTest` that refused, on `startRefusedOutside`. */
export interface Started {
  readonly ok: boolean;
  readonly note: string;
  readonly why?: StartRefusal;
  readonly test?: string;
}

export type ScopedStartFromWeb = (input: ScopedStartInput) => Promise<Started>;

/** What the drafted scope's form posts: the draft it was drawn over and the values (D-0071 rule 5.3). */
export interface DraftedScopeFormDraft {
  readonly draftScopeId: string;
  readonly draftDigest: string;
  readonly scopeId: string;
  readonly budgets: ScopeFormDraft["budgets"];
  readonly severityThreshold: FindingSeverity;
  readonly outwardActs: readonly ScopeOutwardAct[];
}

/** One drafted plan's start: which approval, which split, which plan. */
export interface PlanStartInput {
  readonly iterationId: string;
  readonly requestMessageId: string;
  readonly scopeDecisionId: string;
  readonly proposalId: string;
  readonly planIndex: number;
}

export type RecordDraftedScopeFromWeb = (form: DraftedScopeFormDraft) => Promise<ScopeRecorded>;

/**
 * What one raise press posts (D-0074 rule 4.3): the approval it replaces, the
 * lap whose gate it was pressed from, and the budgets. **Only budgets**: every
 * other field of the successor is copied from the stored predecessor, never
 * from the form (D-0074 rule 1.1).
 */
export interface RaiseInput {
  /** Minted at draw, for the successor scope. */
  readonly scopeId: string;
  readonly requestMessageId: string;
  /** The approval being raised: the tip the gate view drew. */
  readonly scopeDecisionId: string;
  /** The lap waiting at the gate this press came from, and returns to. */
  readonly iterationId: string;
  readonly budgets: ScopeFormDraft["budgets"];
}

export type RaiseFromWeb = (input: RaiseInput) => Promise<ScopeRecorded>;
export type PlanStartFromWeb = (input: PlanStartInput) => Promise<Started>;

/**
 * The third thing this surface may write (D-0059 section 5a, the two rondo#233
 * S3 rows): a scope with its approval, and a lap started under that approval.
 *
 * **Both checks are inside this capability**, as the press check is in
 * {@link AnswerPort} and the send check in {@link SayPort}: whoever holds this
 * object reaches neither implementation without a press {@link mintPress}
 * minted and nobody has spent. Two methods on one class rather than two classes
 * because they are one screen's two presses over one approval, and a caller
 * that could hold the start without the record could start a lap under a scope
 * this surface never showed anybody.
 */
export class ScopePort {
  readonly #record: RecordScopeFromWeb;
  readonly #start: ScopedStartFromWeb;
  readonly #recordDrafted: RecordDraftedScopeFromWeb | null;
  readonly #startPlan: PlanStartFromWeb | null;
  readonly #raise: RaiseFromWeb | null;

  constructor(
    record: RecordScopeFromWeb,
    start: ScopedStartFromWeb,
    /** The drafted scope's two presses (rondo#238 C2b); null where the host offers none. */
    recordDrafted: RecordDraftedScopeFromWeb | null = null,
    startPlan: PlanStartFromWeb | null = null,
    /** The raise press (D-0074 section 4); null where the host offers none. */
    raise: RaiseFromWeb | null = null,
  ) {
    this.#record = record;
    this.#start = start;
    this.#recordDrafted = recordDrafted;
    this.#startPlan = startPlan;
    this.#raise = raise;
  }

  /** Record a budgets-only successor of one approval and approve it, on one press. */
  async raise(press: Press, input: RaiseInput): Promise<ScopeRecorded> {
    if (!minted.has(press) || this.#raise === null) {
      return { ok: false, note: "nothing was recorded: this was not a person's press" };
    }
    minted.delete(press);
    return await this.#raise(input);
  }

  /** Approve one drafted scope, as drafted or as the person changed it, on one press. */
  async recordDrafted(press: Press, form: DraftedScopeFormDraft): Promise<ScopeRecorded> {
    if (!minted.has(press) || this.#recordDrafted === null) {
      return { ok: false, note: "nothing was recorded: this was not a person's press" };
    }
    minted.delete(press);
    return await this.#recordDrafted(form);
  }

  /** Start one drafted plan under one approved scope, on one press. */
  async startPlan(press: Press, input: PlanStartInput): Promise<Started> {
    if (!minted.has(press) || this.#startPlan === null) {
      return { ok: false, note: "nothing was started: this was not a person's press" };
    }
    minted.delete(press);
    return await this.#startPlan(input);
  }

  /** Record one drafted scope and approve it, on one press. */
  async recordAndApprove(press: Press, draft: ScopeFormDraft): Promise<ScopeRecorded> {
    if (!minted.has(press)) {
      return {
        ok: false,
        note: "nothing was recorded: this was not a person's press",
      };
    }
    minted.delete(press);
    return await this.#record(draft);
  }

  /** Start one lap under one approved scope, on one press. */
  async start(press: Press, input: ScopedStartInput): Promise<Started> {
    if (!minted.has(press)) {
      return {
        ok: false,
        note: "nothing was started: this was not a person's press",
      };
    }
    minted.delete(press);
    return await this.#start(input);
  }
}

/** What one revise press names; the person typed none of the three ids. */
export interface ReviseInput {
  /** The lap whose gate this press answers. */
  readonly iterationId: string;
  /** The lap the revision runs as, minted at render (`newIterationId`). */
  readonly successorId: string;
  /** The approval the lap being revised was admitted under (D-0070 section 1.2). */
  readonly scopeDecisionId: string;
  /** What to change, as the person left it: rondo's draft, edited or not. */
  readonly body: string;
}

/** Why a revise press revised nothing, as the wording key the page says it in. */
export type ReviseRefusal =
  | "reviseRefusedNoWords"
  | "reviseRefusedGateClosed"
  | "reviseRefusedNotItsScope"
  | "reviseRefusedStillRunning"
  | "reviseRefusedNotSetUp"
  | "reviseRefusedNoContinuo"
  | "reviseRefusedOutside"
  | "reviseRefusedWalkFailed"
  | "reviseRefusedNotSettled"
  | "reviseRefusedAfterGate"
  | "reviseRefusedNotStarted"
  | "reviseRefusedForked";

/** What one revise press came to; `test` is the `ScopeTest` that refused, on `reviseRefusedOutside`. */
export interface Revised {
  readonly ok: boolean;
  readonly note: string;
  readonly why?: ReviseRefusal;
  readonly test?: string;
}

/** Answer one gate with what to change, and run the second lap under the scope. */
export type ReviseFromWeb = (input: ReviseInput) => Promise<Revised>;

/**
 * The fourth thing this surface may write (D-0059 section 5a, the rondo#233 S4
 * row): a gate answered with what to change, and the second lap it starts under
 * the approval the first was admitted under (D-0070).
 *
 * **The check is inside this capability**, as it is in {@link AnswerPort},
 * {@link SayPort} and {@link ScopePort}: whoever holds this object reaches the
 * implementation only through {@link revise}, which walks no gate without a
 * press {@link mintPress} minted and nobody has spent. Its own class and not a
 * method on {@link AnswerPort}, because that port's one word is `approve`
 * (D-0041 rule 7) and a holder of it must not be able to answer with anything
 * else.
 */
export class RevisePort {
  readonly #revise: ReviseFromWeb;

  constructor(revise: ReviseFromWeb) {
    this.#revise = revise;
  }

  /** Answer one gate with a change and start the second lap, on one press. */
  async revise(press: Press, input: ReviseInput): Promise<Revised> {
    if (!minted.has(press)) {
      return {
        ok: false,
        note: "nothing was answered: this was not a person's press",
      };
    }
    minted.delete(press);
    // **Trimmed and refused here, inside the capability**, so every holder gets
    // one rule: nothing but whitespace is not an instruction, and a gate
    // answered with it would carry the person nothing to act on. What is left
    // is carried byte for byte (D-0009, D-0027 rule 7).
    const said = input.body.trim();
    if (said === "") {
      return {
        ok: false,
        why: "reviseRefusedNoWords",
        note: "nothing was answered: a revise carries what to change, and this carried nothing",
      };
    }
    return await this.#revise({ ...input, body: said });
  }
}

/** What one publish press names; the person typed none of it. */
export interface PublishInput {
  /** The lap whose approved work this press would push. */
  readonly iterationId: string;
  /**
   * The digest of the dry-run this press was made on ({@link PublishShown}).
   *
   * **Carried so the press can refuse what the screen did not show** (D-0042
   * rules 2 and 3, and rondo#233 S5's own reason): the publish is re-planned
   * inside the port, and a re-plan that does not match the one a person read is
   * a different act with the same button on it.
   */
  readonly shown: string;
  /** Whether this is the second press: the reading's refusal overruled. */
  readonly despiteReview: boolean;
}

/** Why a publish press published nothing, as the wording key the page says it in. */
export type PublishRefusal =
  | "publishRefusedGone"
  | "publishRefusedNotClosed"
  | "publishRefusedNotApproved"
  | "publishRefusedNoRun"
  | "publishRefusedPlanField"
  | "publishRefusedNoRepo"
  | "publishRefusedTarget"
  | "publishRefusedUncommitted"
  | "publishRefusedNoContinuo"
  | "publishRefusedNotRead"
  | "publishRefusedNothingOverruled"
  | "publishRefusedChanged"
  | "publishRefusedStillRunning"
  | "publishRefusedPushFailed"
  | "publishRefusedPullRequestFailed"
  | "publishRefusedRunNotClosed"
  | "publishRefusedNotStarted";

/** What one publish press came to; `detail` is git's or the forge's own line. */
export interface Published {
  readonly ok: boolean;
  readonly note: string;
  readonly why?: PublishRefusal;
  readonly detail?: string;
}

/** Push the branch, open the pull request and close the run, on one press. */
export type PublishFromWeb = (input: PublishInput) => Promise<Published>;

/**
 * The fifth thing this surface may write (D-0059 section 5a, the rondo#233 S5
 * row): a branch pushed, a pull request opened and the run closed -- the one
 * write on this page that leaves this machine.
 *
 * **The check is inside this capability**, as it is in {@link AnswerPort},
 * {@link SayPort}, {@link ScopePort} and {@link RevisePort}: whoever holds this
 * object pushes nothing without a press {@link mintPress} minted and nobody has
 * spent. Its own class for {@link RevisePort}'s reason, sharpened: publishing is
 * the one act here that is outward, and a holder of any other port must not
 * become able to reach it.
 */
export class PublishPort {
  readonly #publish: PublishFromWeb;

  constructor(publish: PublishFromWeb) {
    this.#publish = publish;
  }

  /** Publish one approved lap, on one press. */
  async publish(press: Press, input: PublishInput): Promise<Published> {
    if (!minted.has(press)) {
      return {
        ok: false,
        note: "nothing was published: this was not a person's press",
      };
    }
    minted.delete(press);
    return await this.#publish(input);
  }
}

/**
 * What one release press names (D-0073 rule 4.3): a lap of the line, and the
 * claim and laps the screen was drawn over, so a press over a line that moved
 * since -- released, retried, or taken back -- releases nothing. The person
 * typed none of it.
 */
export interface ReleaseInput {
  readonly iterationId: string;
  readonly claimId: string;
  readonly lapIds: readonly string[];
}

/** Why a release press released nothing, as the wording key the page says it in. */
export type ReleaseRefusal = "releaseRefusedChanged" | "releaseRefusedNotRecorded";

export interface Released {
  readonly ok: boolean;
  readonly note: string;
  readonly why?: ReleaseRefusal;
}

/** Release one line's files, as the person's judgement that its work is done. */
export type ReleaseFromWeb = (input: ReleaseInput) => Promise<Released>;

/**
 * The sixth thing this surface may write (D-0073 rule 4.3, rondo#288): a
 * line's files released by a person, which the ledger records as theirs.
 *
 * **The check is inside this capability**, as it is in every port above: whoever
 * holds this object releases nothing without a press {@link mintPress} minted
 * and nobody has spent. Its own class, because ending a claim is not answering
 * a gate or publishing, and a holder of those must not be able to do it.
 */
export class ReleasePort {
  readonly #release: ReleaseFromWeb;

  constructor(release: ReleaseFromWeb) {
    this.#release = release;
  }

  /** Release one line's files, on one press. */
  async release(press: Press, input: ReleaseInput): Promise<Released> {
    if (!minted.has(press)) {
      return { ok: false, note: "nothing was released: this was not a person's press" };
    }
    minted.delete(press);
    return await this.#release(input);
  }
}

/** What one add-repository press names (rondo#383): the request, and the repository it named. */
export interface AddRepositoryInput {
  readonly requestMessageId: string;
  /** `OWNER/NAME`, as the page read it off the request. */
  readonly repo: string;
}

/**
 * Why an add-repository press added nothing, as the wording key the page says
 * it in (D-0090 rule 4): the three a person answers differently -- this
 * computer's setup, what the account can see, and anything else, which a press
 * again may clear -- and a store setup never finished, which no press repairs.
 */
export type AddRepositoryRefusal =
  | "addRepositoryRefusedInstall"
  | "addRepositoryRefusedUnseen"
  | "addRepositoryRefusedFailed"
  | "addRepositoryRefusedNoSetup"
  | "addRepositoryRefusedChanged";

/** What adding a repository did: added, or why not with rondo's own reason. */
export type AddedRepository =
  | { readonly ok: true }
  | { readonly ok: false; readonly why: AddRepositoryRefusal; readonly note: string };

/**
 * The seventh thing this surface may write (rondo#383, D-0090): a repository
 * cloned and recorded as setup records one, on the person's press. Its own
 * class for {@link ReleasePort}'s reason: adding a repository is not answering
 * a gate, and a holder of the other ports must not be able to do it.
 */
export class AddRepositoryPort {
  readonly #add: (input: AddRepositoryInput) => Promise<AddedRepository>;

  constructor(add: (input: AddRepositoryInput) => Promise<AddedRepository>) {
    this.#add = add;
  }

  /** Add one repository, on one press. */
  async add(press: Press, input: AddRepositoryInput): Promise<AddedRepository> {
    if (!minted.has(press)) {
      return {
        ok: false,
        why: "addRepositoryRefusedFailed",
        note: "nothing was added: this was not a person's press",
      };
    }
    minted.delete(press);
    return await this.#add(input);
  }
}

/**
 * What one merge press names (rondo#380, `D-0091`): the lap, and the head the
 * button was drawn for, so a press over a pull request that has moved since
 * merges nothing. The person typed none of it.
 */
export interface MergeInput {
  readonly iterationId: string;
  readonly head: string;
}

/** Why a merge press merged nothing, as the wording key the page says it in. */
export type MergeRefusal =
  | "mergeRefusedGone"
  | "mergeRefusedNotPublished"
  | "mergeRefusedNotGreen"
  | "mergeRefusedAsked"
  | "mergeRefusedMerged"
  | "mergeRefusedLanded"
  | "mergeRefusedMoved"
  | "mergeRefusedClosed"
  | "mergeRefusedMethod"
  | "mergeRefusedForge"
  | "mergeRefusedFailed"
  | "mergeRefusedQueued";

/** What one merge press came to; `detail` is the forge's own line. */
export interface Merged {
  readonly ok: boolean;
  readonly note: string;
  readonly why?: MergeRefusal;
  readonly detail?: string;
}

/** Merge one lap's pull request, on one press. */
export type MergeFromWeb = (input: MergeInput) => Promise<Merged>;

/**
 * The eighth thing this surface may write (rondo#380, `D-0091`): a lap's pull
 * request merged into the branch it was opened against, on a person's press --
 * the per-act approval `D-0064` rule 3.4 asks for, given at the time.
 *
 * **The check is inside this capability**, as it is in every port above: whoever
 * holds this object merges nothing without a press {@link mintPress} minted and
 * nobody has spent. Its own class, because merging is the one irreversible act
 * on this page, and a holder of any other port must not become able to reach it.
 */
export class MergePort {
  readonly #merge: MergeFromWeb;

  constructor(merge: MergeFromWeb) {
    this.#merge = merge;
  }

  /** Merge one lap's pull request, on one press. */
  async merge(press: Press, input: MergeInput): Promise<Merged> {
    if (!minted.has(press)) {
      return { ok: false, note: "nothing was merged: this was not a person's press" };
    }
    minted.delete(press);
    return await this.#merge(input);
  }
}

/** The ports the server is handed: the reading half, and the eight writers. */
export interface ServedPorts extends WebPorts {
  /**
   * Null when `RONDO_APPROVER` is unset, which is also when no button is drawn
   * -- rondo does not act for an unnamed person on a screen either (D-0020
   * rule 2).
   */
  readonly answer: AnswerPort | null;
  /** Null on the same condition as {@link answer}: no approver, no forms. */
  readonly say: SayPort | null;
  /**
   * Null on the same condition as {@link say}: a scope row and a decision row
   * both need an actor the allowlist accepts, so no approver is no forms
   * (rondo#233 S3).
   */
  readonly scope: ScopePort | null;
  /**
   * Null on {@link scope}'s condition: a revise answers a gate as somebody and
   * admits a lap under an approval, and both need an actor the allowlist
   * accepts (rondo#233 S4).
   */
  readonly revise: RevisePort | null;
  /**
   * Null on {@link revise}'s condition and on one of its own: publishing
   * closes a run as somebody, and the forge repository is the one fact no plan
   * carries, so a host that named none draws no publish screen (rondo#233 S5).
   */
  readonly publish: PublishPort | null;
  /**
   * Null on {@link revise}'s condition: a release is recorded as the person's
   * judgement, so it needs an actor the allowlist accepts (D-0073 rule 4.3).
   */
  readonly release: ReleasePort | null;
  /** Null on {@link release}'s condition: the recorded plan is the approver's, as setup's is. */
  readonly addRepository?: AddRepositoryPort | null;
  /**
   * Null on {@link publish}'s condition: the merge is pressed by a person the
   * allowlist accepts (rondo#380). Absent is null.
   */
  readonly merge?: MergePort | null;
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
 * fields and, on the approve press, a claim of at most {@link MAX_CLAIM_CHARS}
 * characters (9 bytes each percent-encoded, at worst), and a request bigger
 * than that is not the page's form.
 */
const MAX_FORM_BYTES = 12 * 1024;

/**
 * The send routes (D-0059 section 5a, last row), by the kind of message each
 * sends. A path and not a query on `/`, so the write table names each kind.
 */
const SEND_ROUTES: ReadonlyMap<string, SentKind> = new Map([
  ["/request", "request"],
  ["/reply", "reply"],
]);

/**
 * The route that answers a question waiting in a thread: a reply on a press,
 * not a send ({@link SayPort.answerAsk} says why -- D-0059 section 5a's
 * falsifier and D-0069 rule 5). A native form `POST` only, never `hx-post`.
 */
const ANSWER_ASK_ROUTE = "/answer-ask";

/**
 * The route that answers a lap's gate with what to change and starts the second
 * lap under the first's approval (D-0059 section 5a as annotated from rondo#233
 * S4, D-0070). A press, as every approval is, and a native form `POST` only.
 */
const REVISE_ROUTE = "/revise";

/**
 * The routes whose body is a person's words, and so takes the larger limit.
 *
 * Two of them are presses and not sends -- the answer to a waiting ask, and the
 * revise -- because what a body is made of and what minting it needs are two
 * questions (D-0059 section 5a).
 */
const MESSAGE_ROUTES: ReadonlySet<string> = new Set([
  ...SEND_ROUTES.keys(),
  ANSWER_ASK_ROUTE,
  REVISE_ROUTE,
]);

/**
 * The scope screen's two write routes (D-0059 section 5a, the two rondo#233 S3
 * rows): recording a scope with its approval, and starting a lap under that
 * approval. Paths and not queries on `/`, so the write table names each.
 */
const SCOPE_ROUTE = "/scope";
const START_ROUTE = "/start";

/**
 * The drafted scope's two write routes (rondo#238 C2b, D-0071 rule 5.3):
 * approving a drafted scope -- as drafted, or as the person changed it -- and
 * starting one drafted plan under that approval.
 */
const SCOPE_DRAFT_ROUTE = "/scope-draft";
/** The raise press (D-0074 rule 4.3): a budgets-only successor, recorded and approved. */
const RAISE_ROUTE = "/raise";
const START_PLAN_ROUTE = "/start-plan";

/**
 * The route that pushes an approved lap's work and opens its pull request
 * (D-0059 section 5a as annotated from rondo#233 S5, D-0060). A press, as every
 * approval is, and pressed only from the screen that shows its dry-run.
 */
const PUBLISH_ROUTE = "/publish";

/**
 * The route that releases the files a finished line holds (D-0073 rule 4.3,
 * rondo#288). A press, as every approval is, and pressed only from the screen
 * that says which work holds them and why rondo has not let go of them.
 */
const RELEASE_ROUTE = "/release";

/**
 * The route that adds a repository a request named and rondo does not work in
 * (rondo#383, D-0090): a press, pressed from the request's own thread.
 */
const ADD_REPOSITORY_ROUTE = "/add-repository";

/**
 * The route that merges a lap's pull request (rondo#380, `D-0091`): a press,
 * per act, drawn in the thread only where rondo's own reading is green on the
 * head and nothing in the thread waits on the person.
 */
const MERGE_ROUTE = "/merge";

/**
 * The routes whose body is numbers and minted ids and never prose, and so take
 * {@link MAX_FORM_BYTES} rather than the send limit.
 */
const PRESS_ROUTES: ReadonlySet<string> = new Set([
  SCOPE_ROUTE,
  START_ROUTE,
  SCOPE_DRAFT_ROUTE,
  RAISE_ROUTE,
  START_PLAN_ROUTE,
  PUBLISH_ROUTE,
  RELEASE_ROUTE,
  ADD_REPOSITORY_ROUTE,
  MERGE_ROUTE,
]);

/** A whole count of at least 0, as a form posts one, or null when it is not one. */
function wholeNumber(value: unknown): number | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  const read = Number(value);
  return Number.isSafeInteger(read) && read >= 0 ? read : null;
}

/** An amount of at least 0, as a form posts one, or null when it is not one. */
function amount(value: unknown): number | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  const read = Number(value);
  return Number.isFinite(read) && read >= 0 ? read : null;
}

/**
 * The expiry as the form posts it: a native `datetime-local`'s wall clock,
 * **read as UTC**.
 *
 * A person does not read or type a Unix millisecond, and with no script on the
 * screen the browser's zone is not a fact this process has. So the field has
 * one meaning, the label says which (`scopeExpiresLabel` names UTC), and a
 * browser with no `datetime-local` degrades to a text box of the same shape
 * that this reads identically.
 */
function expiryMs(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    return null;
  }
  const at = Date.parse(`${value}Z`);
  return Number.isFinite(at) ? at : null;
}

/**
 * What one scope form posted, read as values -- or null when one of them is not
 * a value rondo can use.
 *
 * Refused rather than repaired: a budget silently corrected is a person
 * approving a scope they did not draft.
 */
function scopeDraftOf(
  form: Record<string, unknown>,
  scopeId: string,
  requestMessageId: string,
): ScopeFormDraft | null {
  const planDigest = form["plan_digest"];
  const agentTypeDigest = form["agent_type"];
  if (typeof planDigest !== "string" || typeof agentTypeDigest !== "string") {
    return null;
  }
  const values = scopeValuesOf(form);
  return values === null
    ? null
    : { scopeId, requestMessageId, planDigest, agentTypeDigest, ...values };
}

/**
 * The values a scope form posts -- the five budgets, the threshold, the outward
 * acts -- read as values, or null when one is not a value rondo can use. Shared
 * by the person's own form and the drafted one (rondo#238 C2b), so a budget is
 * read one way whichever screen posted it.
 */
function scopeValuesOf(form: Record<string, unknown>): {
  readonly budgets: ScopeFormDraft["budgets"];
  readonly severityThreshold: FindingSeverity;
  readonly outwardActs: readonly ScopeOutwardAct[];
} | null {
  const budgets = budgetsOf(form);
  if (budgets === null) {
    return null;
  }
  const severity = form["severity_threshold"];
  if (
    typeof severity !== "string" ||
    !(FINDING_SEVERITIES as readonly string[]).includes(severity)
  ) {
    return null;
  }
  const posted = form["outward_acts"];
  const acts = posted === undefined ? [] : Array.isArray(posted) ? posted : [posted];
  if (
    !acts.every(
      (act): act is ScopeOutwardAct =>
        typeof act === "string" && (SCOPE_OUTWARD_ACTS as readonly string[]).includes(act),
    )
  ) {
    return null;
  }
  return {
    budgets,
    severityThreshold: severity as FindingSeverity,
    outwardActs: acts,
  };
}

/** The five budgets a scope form posts, or null when one is not a value rondo can use. */
function budgetsOf(form: Record<string, unknown>): ScopeFormDraft["budgets"] | null {
  const laps = wholeNumber(form["laps"]);
  const reviewRounds = wholeNumber(form["review_rounds"]);
  const costUsd = amount(form["cost_usd"]);
  const costReserveUsd = amount(form["cost_reserve_usd"]);
  const expiresAtMs = expiryMs(form["expires_at_ms"]);
  if (
    laps === null ||
    reviewRounds === null ||
    costUsd === null ||
    costReserveUsd === null ||
    expiresAtMs === null
  ) {
    return null;
  }
  return {
    laps,
    review_rounds: reviewRounds,
    cost_usd: costUsd,
    cost_reserve_usd: costReserveUsd,
    expires_at_ms: expiresAtMs,
  };
}

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
    /*
     * **A plain file name, or one under `assets/`, and nothing else.** The
     * bundler emits its output into a directory, so the manifest now holds a
     * name with a separator in it -- and the property this filter exists for
     * is unchanged: no request contributes to a path. The key comes from the
     * manifest, the value is built from the key, and the pattern still admits
     * no `..`, no leading `/` and no second level, so a manifest entry cannot
     * name a file outside `dist/page/`.
     */
    .filter((name) => /^(?:assets\/)?[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name))
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
  const scoping = query.get("scope");
  if (scoping !== null && scoping !== "") {
    const asked = query.get("rounds");
    const rounds = asked === null ? Number.NaN : Number.parseInt(asked, 10);
    const decision = query.get("decision");
    const plan = query.get("plan");
    const raise = query.get("raise");
    const gate = query.get("gate");
    return {
      ...(raise === null || raise === "" || gate === null || gate === ""
        ? {}
        : { raise: { decisionId: raise, iterationId: gate } }),
      kind: "scope",
      messageId: scoping,
      plan: plan === null || plan === "" ? null : plan,
      // Total, as the rest of this function is: a typo in a query is an
      // operator who wanted the page, so an unreadable or out-of-range count is
      // the default rather than a refusal.
      rounds:
        Number.isSafeInteger(rounds) && rounds >= 0 && rounds <= MAX_REVIEW_ROUNDS ? rounds : null,
      decisionId: decision === null || decision === "" ? null : decision,
    };
  }
  if (query.get("requests") === "open") {
    return { kind: "requests" };
  }
  const publishing = query.get("publish");
  if (publishing !== null && publishing !== "") {
    return { kind: "publish", iterationId: publishing };
  }
  const releasing = query.get("release");
  if (releasing !== null && releasing !== "") {
    return { kind: "release", iterationId: releasing };
  }
  // `?answer=` and `?reading=open` are not read and have no redirect: D-0083
  // rules 3 and 4 replaced both screens, and an address that once meant one
  // of them is the page a person arrives on.
  return { kind: "summary" };
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
 * `POST /`, the lap-end `approve` press, the two sends, `POST /request`
 * and `POST /reply`, the question's answer on a press, `POST /answer-ask`, the
 * scope screen's two presses, `POST /scope` and `POST /start`, the gate's
 * other answer, `POST /revise`, the one write that leaves this machine,
 * `POST /publish`, the release of a finished line's files, `POST /release`,
 * and the merge of a lap's pull request, `POST /merge` (`D-0091`).
 * `test/access/web-app.test.ts` enumerates `app.routes` and
 * fails on any other non-`GET` entry.
 */
export function createApp(ports: ServedPorts, token: string): Hono<PageEnv> {
  // The writer is taken off before anything reading is handed the rest, so
  // the renderer does not hold it at runtime either (D-0041 rule 4).
  const {
    answer,
    say,
    scope,
    revise,
    publish,
    release,
    addRepository,
    merge = null,
    ...reading
  } = ports;
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
  for (const path of MESSAGE_ROUTES) {
    app.use(path, csrf());
  }
  for (const path of PRESS_ROUTES) {
    app.use(path, csrf());
  }
  // One limit middleware, sized by the address: a send carries a person's
  // words, every other request at most the press's short fields and its claim.
  const pressLimit = bodyLimit({
    maxSize: MAX_FORM_BYTES,
    onError: (c) => said(c, 413, "that is larger than this page's form"),
  });
  const sendLimit = bodyLimit({
    maxSize: MAX_MESSAGE_BYTES,
    // Through the send's own refusal, so htmx puts it under the draft and a
    // native submit gets the page's language and the way back (#220 S1 review).
    onError: (c) => refused(c, 413, "sendRefusedTooLong", null),
  });
  app.use(async (c, next) =>
    MESSAGE_ROUTES.has(c.req.path) ? await sendLimit(c, next) : await pressLimit(c, next),
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
      scope === null ? null : newScopeId,
      // The scoped start mints one, and so does the revise: both reserve a lap
      // rondo names (D-0023), and neither screen is drawn without a write port.
      scope === null && revise === null ? null : newIterationId,
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
    // **What the person says they verified rides on this press** (`D-0045` as
    // annotated from rondo#220): absent is no claim, and anything but text is a
    // form this page did not draw -- refused rather than dropped, since a claim
    // silently lost is a person believing the record holds what they checked.
    const verified = form["verified"];
    if (verified !== undefined && typeof verified !== "string") {
      return said(c, 400, "what that form said you verified was not text");
    }
    // The thread the press was made in, which the form carries (D-0083 rule
    // 3): the refusal goes back to it, and so does the `303`.
    const request = typeof form["request"] === "string" ? form["request"] : "";
    const answered = await answer.answer(minting.press, iterationId, verified ?? null);
    if (!answered.ok) {
      return answered.why === undefined
        ? said(c, 409, answered.note)
        : claimRefused(c, answered.why, request);
    }
    // **The tag the press was made under, for the `303`** (D-0056 rule 11),
    // read back off the form's own `action`; the press writes no cookie.
    // Back into the thread the press was made in, where the event line for
    // what it did is now the last thing on the time axis (D-0083 rules 3, 7).
    return c.redirect(
      viewHref(
        request === "" ? { kind: "summary" } : { kind: "thread", messageId: request, to: null },
        tagOf(c),
      ),
      303,
    );
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
      // The port's own refusal of an answer to a waiting ask (`SayPort.say`).
      if (sent.waitingAsk === true) {
        return refused(c, 409, "sendRefusedAsk", inReplyTo);
      }
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
        `${viewHref({ kind: "thread", messageId, to: null }, tagOf(c))}#${encodeURIComponent(messageId)}`,
        303,
      );
    });
  }

  // **The answer to a waiting question, on a press** (#220 S1): a reply whose
  // mint is `mintPress`, not `mintSend`, because answering an ask releases the
  // hold D-0069 rule 5 puts on work, and D-0059 section 5a's falsifier says a
  // message that moves work needs a press. The form is a native `POST` only, so
  // a click is a navigation carrying `Sec-Fetch-User: ?1`; the draft survives
  // a refusal in `sessionStorage` (`page/composer.js`).
  app.post(ANSWER_ASK_ROUTE, async (c) => {
    if (say === null) {
      return refused(c, 403, "sendRefusedNoApprover", null);
    }
    const form = await c.req.parseBody();
    const back = typeof form["in_reply_to"] === "string" ? form["in_reply_to"] : null;
    const minting = mintPress(c, form["token"]);
    if (!("press" in minting)) {
      return refused(c, minting.status, "answerRefusedPress", back);
    }
    const messageId = form["message_id"];
    if (
      typeof messageId !== "string" ||
      !SENT_MESSAGE_ID.test(messageId) ||
      back === null ||
      back === ""
    ) {
      return refused(c, 400, "sendRefusedForm", back);
    }
    const body = form["body"];
    if (typeof body !== "string" || body.trim() === "") {
      return refused(c, 400, "sendRefusedNoWords", back);
    }
    // **Which answer the press is, read off the form and never defaulted**
    // (D-0072 rule 4). The screen draws one button per answer, both carrying
    // this field; a press naming neither is the form refusal the rest of this
    // route uses, because rondo guessing here would put a word in the person's
    // mouth on the one press whose content is that word.
    const outcome = form["outcome"];
    if (outcome !== "carry_on" && outcome !== "stop") {
      return refused(c, 400, "sendRefusedForm", back);
    }
    const message = { messageId, body, inReplyTo: back };
    const answered = await say.answerAsk(minting.press, message, outcome);
    if (!answered.ok && !(await alreadyThere(message, outcome))) {
      return refused(c, 409, "sendRefusedNotTaken", back);
    }
    return c.redirect(
      `${viewHref({ kind: "thread", messageId, to: null }, tagOf(c))}#${encodeURIComponent(messageId)}`,
      303,
    );
  });

  // **The record-and-approve press** (D-0059 section 5a as annotated from
  // rondo#233 S3, the first of its two rows). One press, four writes in
  // `commandScope`'s own order, and the digest approved is the one read back
  // off the row -- so D-0066 rule 2.2 holds by construction and there is no
  // line for a person to copy. Everything that decides whether this request may
  // write happens in `mintPress`, and the port checks the press again itself.
  app.post(SCOPE_ROUTE, async (c) => {
    if (scope === null) {
      return scopeRefused(c, 403, "scopeRefusedNoApprover", null);
    }
    // `all` because the outward acts are checkboxes of one name: without it a
    // person who ticked both would have approved one.
    const form = await c.req.parseBody({ all: true });
    const request = typeof form["request"] === "string" ? form["request"] : "";
    // The rounds the form was drawn at, so every refusal below leads back to
    // the screen the person pressed on rather than to rondo's default draft.
    const rounds = wholeNumber(form["review_rounds"]);
    const drawnOver = typeof form["plan_digest"] === "string" ? form["plan_digest"] : null;
    const minting = mintPress(c, form["token"]);
    if (!("press" in minting)) {
      return scopeRefused(c, minting.status, "scopeRefusedPress", request, rounds, drawnOver);
    }
    const scopeId = form["scope_id"];
    if (typeof scopeId !== "string" || !PAGE_SCOPE_ID.test(scopeId) || request === "") {
      return scopeRefused(c, 400, "scopeRefusedForm", request, rounds, drawnOver);
    }
    const draft = scopeDraftOf(form, scopeId, request);
    if (draft === null) {
      return scopeRefused(c, 400, "scopeRefusedFields", request, rounds, drawnOver);
    }
    const recorded = await scope.recordAndApprove(minting.press, draft);
    if (!recorded.ok || recorded.scopeDecisionId === undefined) {
      return scopeRefused(
        c,
        409,
        recorded.why ?? "scopeRefusedNotTaken",
        request,
        rounds,
        drawnOver,
      );
    }
    // **The same view, in its second state**, so the digest the person reads
    // after the press is the digest the press approved.
    return c.redirect(
      `${viewHref(
        {
          kind: "scope",
          messageId: request,
          rounds: null,
          decisionId: recorded.scopeDecisionId,
          // The plan the scope was drawn over, so the start below it is that plan's.
          plan: draft.planDigest,
        },
        tagOf(c),
      )}#scope`,
      303,
    );
  });

  // **The drafted scope's press** (rondo#238 C2b, D-0071 rule 5.3): the draft
  // by id and digest, and the values; which act the press is -- the draft
  // approved, or the person's version recorded in its place -- is the port's to
  // decide from the rows.
  app.post(SCOPE_DRAFT_ROUTE, async (c) => {
    if (scope === null) {
      return scopeRefused(c, 403, "scopeRefusedNoApprover", null);
    }
    const form = await c.req.parseBody({ all: true });
    const request = typeof form["request"] === "string" ? form["request"] : "";
    const minting = mintPress(c, form["token"]);
    if (!("press" in minting)) {
      return scopeRefused(c, minting.status, "scopeRefusedPress", request);
    }
    const scopeId = form["scope_id"];
    const draftScopeId = form["draft_scope"];
    const draftDigest = form["draft_digest"];
    if (
      typeof scopeId !== "string" ||
      !PAGE_SCOPE_ID.test(scopeId) ||
      typeof draftScopeId !== "string" ||
      draftScopeId === "" ||
      typeof draftDigest !== "string" ||
      draftDigest === "" ||
      request === ""
    ) {
      return scopeRefused(c, 400, "scopeRefusedForm", request);
    }
    const values = scopeValuesOf(form);
    if (values === null) {
      return scopeRefused(c, 400, "scopeRefusedFields", request);
    }
    const recorded = await scope.recordDrafted(minting.press, {
      draftScopeId,
      draftDigest,
      scopeId,
      ...values,
    });
    if (!recorded.ok || recorded.scopeDecisionId === undefined) {
      return scopeRefused(c, 409, recorded.why ?? "scopeRefusedNotTaken", request);
    }
    return c.redirect(
      `${viewHref(
        {
          kind: "scope",
          messageId: request,
          rounds: null,
          decisionId: recorded.scopeDecisionId,
          plan: null,
        },
        tagOf(c),
      )}#scope`,
      303,
    );
  });

  // **The raise press** (D-0074 section 4): a successor of the approval the lap
  // at this gate spends, differing only in its budgets, recorded and approved
  // on one press as `/scope` records a first one. The approval and the lap are
  // what the gate view drew; the port re-reads both and copies every other
  // field from the stored row. It returns to the gate it was pressed from,
  // where asking for a change now spends the new approval.
  app.post(RAISE_ROUTE, async (c) => {
    const form = await c.req.parseBody();
    const iterationId = typeof form["iteration"] === "string" ? form["iteration"] : "";
    // The thread the gate is in, which is where every refusal below goes back
    // to (D-0083 rule 3); the form has carried it since the raise screen was
    // drawn, because the port needs it too.
    const request = typeof form["request"] === "string" ? form["request"] : "";
    if (scope === null) {
      return raiseRefused(c, 403, "scopeRefusedNoApprover", request);
    }
    const minting = mintPress(c, form["token"]);
    if (!("press" in minting)) {
      return raiseRefused(c, minting.status, "scopeRefusedPress", request);
    }
    const decision = typeof form["raise"] === "string" ? form["raise"] : "";
    const scopeId = form["scope_id"];
    if (
      typeof scopeId !== "string" ||
      !PAGE_SCOPE_ID.test(scopeId) ||
      request === "" ||
      decision === "" ||
      iterationId === ""
    ) {
      return raiseRefused(c, 400, "scopeRefusedForm", request);
    }
    const budgets = budgetsOf(form);
    if (budgets === null) {
      return raiseRefused(c, 400, "scopeRefusedFields", request);
    }
    const raised = await scope.raise(minting.press, {
      scopeId,
      requestMessageId: request,
      scopeDecisionId: decision,
      iterationId,
      budgets,
    });
    if (!raised.ok) {
      return raiseRefused(c, 409, raised.why ?? "scopeRefusedNotTaken", request);
    }
    // Back to where the question is standing, which since D-0083 rule 3 is
    // the request's own thread rather than a screen named by the lap.
    return c.redirect(viewHref({ kind: "thread", messageId: request, to: null }, tagOf(c)), 303);
  });

  // **One drafted plan's start** (rondo#238 C2b): the plan named by its split
  // and its place in it, read back in the port -- never posted whole.
  app.post(START_PLAN_ROUTE, async (c) => {
    if (scope === null) {
      return startRefused(c, 403, "startRefusedNoApprover", null, null);
    }
    const form = await c.req.parseBody();
    const request = typeof form["request"] === "string" ? form["request"] : "";
    const decision = typeof form["scope_decision"] === "string" ? form["scope_decision"] : "";
    const minting = mintPress(c, form["token"]);
    if (!("press" in minting)) {
      return startRefused(c, minting.status, "startRefusedPress", request, decision);
    }
    const iterationId = form["iteration"];
    const proposal = form["proposal"];
    const planIndex = wholeNumber(form["plan_index"]);
    if (
      typeof iterationId !== "string" ||
      !PAGE_ITERATION_ID.test(iterationId) ||
      typeof proposal !== "string" ||
      proposal === "" ||
      planIndex === null ||
      request === "" ||
      decision === ""
    ) {
      return startRefused(c, 400, "startRefusedForm", request, decision);
    }
    const started = await scope.startPlan(minting.press, {
      iterationId,
      requestMessageId: request,
      scopeDecisionId: decision,
      proposalId: proposal,
      planIndex,
    });
    if (!started.ok) {
      return startRefused(
        c,
        409,
        started.why ?? "startRefusedNotAdmitted",
        request,
        decision,
        started.test ?? null,
      );
    }
    // The request's thread, where the lap just started draws its event lines
    // and where the approve press already lands (D-0083 rules 3, 7).
    return c.redirect(viewHref({ kind: "thread", messageId: request, to: null }, tagOf(c)), 303);
  });

  // **The scoped start** (section 5a's second rondo#233 S3 row): a first
  // admission through `admitUnderScope`, so the one call site that computes a
  // verdict is still the only way an act reaches a scope (D-0066 rule 4.1).
  // **No prompt field**: the request message's body is what the work is asked
  // to do, read in the port out of the store, because a posted prompt would be
  // a second authority for what the person asked for.
  app.post(START_ROUTE, async (c) => {
    if (scope === null) {
      return startRefused(c, 403, "startRefusedNoApprover", null, null);
    }
    const form = await c.req.parseBody();
    const request = typeof form["request"] === "string" ? form["request"] : "";
    const decision = typeof form["scope_decision"] === "string" ? form["scope_decision"] : "";
    const plan = form["plan"];
    const runsOn = typeof plan === "string" && plan !== "" ? plan : null;
    const minting = mintPress(c, form["token"]);
    if (!("press" in minting)) {
      return startRefused(c, minting.status, "startRefusedPress", request, decision, null, runsOn);
    }
    const iterationId = form["iteration"];
    if (
      typeof iterationId !== "string" ||
      !PAGE_ITERATION_ID.test(iterationId) ||
      typeof plan !== "string" ||
      plan === "" ||
      request === "" ||
      decision === ""
    ) {
      return startRefused(c, 400, "startRefusedForm", request, decision, null, runsOn);
    }
    const started = await scope.start(minting.press, {
      iterationId,
      requestMessageId: request,
      scopeDecisionId: decision,
      planDigest: plan,
    });
    if (!started.ok) {
      return startRefused(
        c,
        409,
        started.why ?? "startRefusedNotAdmitted",
        request,
        decision,
        started.test ?? null,
        runsOn,
      );
    }
    // Into the request's thread, where the lap just started draws its event
    // lines and where the approve press already lands (D-0083 rules 3, 7).
    return c.redirect(viewHref({ kind: "thread", messageId: request, to: null }, tagOf(c)), 303);
  });

  // **The revise press** (section 5a's rondo#233 S4 row): the gate answered
  // with what to change, and the second lap admitted under the approval the
  // first was admitted under (D-0070). A press and not a send, for the reason
  // the approve press is one -- it answers a gate -- and the body is a person's
  // words, so this address takes the message limit while needing the press.
  //
  // **Three ids and none of them typed**: the lap being answered and the
  // approval it ran under are what the page read and drew, and the successor's
  // id was minted when the form was drawn, so a double press names one lap.
  app.post(REVISE_ROUTE, async (c) => {
    if (revise === null) {
      return reviseRefused(c, 403, "reviseRefusedNoApprover", null);
    }
    const form = await c.req.parseBody();
    const iterationId = typeof form["iteration"] === "string" ? form["iteration"] : "";
    // The thread the gate is in (D-0083 rule 3), carried by the form: every
    // refusal below goes back to where the words were typed.
    const request = typeof form["request"] === "string" ? form["request"] : "";
    const minting = mintPress(c, form["token"]);
    if (!("press" in minting)) {
      return reviseRefused(c, minting.status, "reviseRefusedPress", request);
    }
    const successorId = form["successor"];
    const decision = typeof form["scope_decision"] === "string" ? form["scope_decision"] : "";
    if (
      typeof successorId !== "string" ||
      !PAGE_ITERATION_ID.test(successorId) ||
      iterationId === "" ||
      decision === ""
    ) {
      return reviseRefused(c, 400, "reviseRefusedForm", request);
    }
    const body = form["body"];
    if (typeof body !== "string") {
      return reviseRefused(c, 400, "reviseRefusedForm", request);
    }
    const revised = await revise.revise(minting.press, {
      iterationId,
      successorId,
      scopeDecisionId: decision,
      body,
    });
    if (!revised.ok) {
      return reviseRefused(
        c,
        revised.why === "reviseRefusedNoWords" ? 400 : 409,
        revised.why ?? "reviseRefusedNotStarted",
        request,
        revised.test ?? null,
        revised.note,
      );
    }
    // The thread the press was made in, where the new lap's event lines now
    // run under the words that asked for the change (D-0083 rules 3 and 7).
    return c.redirect(
      viewHref(
        request === "" ? { kind: "summary" } : { kind: "thread", messageId: request, to: null },
        tagOf(c),
      ),
      303,
    );
  });

  // **The publish press** (section 5a's rondo#233 S5 row): the branch pushed,
  // the pull request opened and the run closed. The one write on this page that
  // leaves this machine, and the only one whose screen is a precondition --
  // D-0059 section 5a's Q1 answer is that `publish` is pressed only from a
  // screen already showing its dry-run, so the digest of that dry-run is
  // carried and the port refuses a press that does not match a fresh one.
  //
  // **`--despite-review` is a second press and not a checkbox rondo reads
  // lightly**: it arrives as its own form's own field, on a screen that shows
  // the refusal it overrules, and the port refuses it when there is nothing to
  // overrule (D-0060 rule 5 stays a person's act, not a default).
  app.post(PUBLISH_ROUTE, async (c) => {
    if (publish === null) {
      return publishRefused(c, 403, "publishRefusedNoApprover", null);
    }
    const form = await c.req.parseBody();
    const iterationId = typeof form["iteration"] === "string" ? form["iteration"] : "";
    // The lap's request, carried by the form as the gate's presses carry it:
    // where the press lands, and never what it publishes.
    const request = typeof form["request"] === "string" ? form["request"] : "";
    const minting = mintPress(c, form["token"]);
    if (!("press" in minting)) {
      return publishRefused(c, minting.status, "publishRefusedPress", iterationId);
    }
    // **The lap's id is the page's own and not a minted one**, so it is checked
    // for being there rather than against a shape (the revise route's rule for
    // the same field): what names the lap is what the screen read off the store.
    // The digest is what makes this press a press from a screen, so a form
    // carrying none is refused here, before the port.
    const shown = form["shown"];
    if (typeof shown !== "string" || shown === "" || iterationId === "") {
      return publishRefused(c, 400, "publishRefusedForm", iterationId);
    }
    const published = await publish.publish(minting.press, {
      iterationId,
      shown,
      // One spelling and not "truthy": a field that is there but says something
      // else is a form this page did not draw.
      despiteReview: form["despite_review"] === "yes",
    });
    if (!published.ok) {
      return publishRefused(
        c,
        409,
        published.why ?? "publishRefusedNotStarted",
        iterationId,
        published.detail ?? null,
        published.note,
      );
    }
    // The request's thread, where what the publish did is now the last thing
    // said (`reportToRequest`) and where the approve press, the scoped start
    // and the revise press all already land (D-0083 rules 3, 7).
    return c.redirect(
      viewHref(
        request === "" ? { kind: "summary" } : { kind: "thread", messageId: request, to: null },
        tagOf(c),
      ),
      303,
    );
  });

  // **The release press** (D-0073 rule 4.3, rondo#288): the files a finished
  // line holds, given up on the person's judgement that its work is done. The
  // claim and laps the screen was drawn over are carried, so a line that moved
  // under the screen releases nothing (the store's own staleness test).
  app.post(RELEASE_ROUTE, async (c) => {
    if (release === null) {
      return releaseRefused(c, 403, "releaseRefusedNoApprover", null);
    }
    const form = await c.req.parseBody();
    const iterationId = typeof form["iteration"] === "string" ? form["iteration"] : "";
    const minting = mintPress(c, form["token"]);
    if (!("press" in minting)) {
      return releaseRefused(c, minting.status, "releaseRefusedPress", iterationId);
    }
    const claimId = form["claim"];
    const laps = form["laps"];
    if (
      iterationId === "" ||
      typeof claimId !== "string" ||
      claimId === "" ||
      typeof laps !== "string" ||
      laps === ""
    ) {
      return releaseRefused(c, 400, "releaseRefusedForm", iterationId);
    }
    const released = await release.release(minting.press, {
      iterationId,
      claimId,
      lapIds: laps.split(" "),
    });
    if (!released.ok) {
      return releaseRefused(c, 409, released.why ?? "releaseRefusedNotRecorded", iterationId);
    }
    // Back to the release screen, which now says the files were released: the
    // row may no longer be on the summary once it keeps nothing.
    return c.redirect(viewHref({ kind: "release", iterationId }, tagOf(c)), 303);
  });

  // **The add-repository press** (rondo#383, D-0090): the one confirmation a
  // person gives for a repository their request named. Back to the request's
  // thread, whose draft now waits on nothing; refused, a page that says why in
  // their words, with the way back to the same button.
  app.post(ADD_REPOSITORY_ROUTE, async (c) => {
    const form = await c.req.parseBody();
    const request = typeof form["request"] === "string" ? form["request"] : "";
    const repo = typeof form["repository"] === "string" ? form["repository"] : "";
    if (addRepository === undefined || addRepository === null) {
      return addRepositoryRefused(c, 403, "addRepositoryRefusedNoApprover", request);
    }
    const minting = mintPress(c, form["token"]);
    if (!("press" in minting)) {
      return addRepositoryRefused(c, minting.status, "addRepositoryRefusedPress", request);
    }
    if (request === "" || repo === "") {
      return addRepositoryRefused(c, 400, "addRepositoryRefusedForm", request);
    }
    const added = await addRepository.add(minting.press, { requestMessageId: request, repo });
    if (!added.ok) {
      return addRepositoryRefused(c, 409, added.why, request, added.note);
    }
    return c.redirect(viewHref({ kind: "thread", messageId: request, to: null }, tagOf(c)), 303);
  });

  // **The merge press** (rondo#380, `D-0091`): a lap's pull request merged by
  // the operator's own forge CLI, on a person's press. Everything the button
  // was drawn on is read again in the port, and the head it carried must still
  // be the head rondo read green. Success and refusal both land where the
  // button is -- the thread, which then says it merged or still offers it.
  app.post(MERGE_ROUTE, async (c) => {
    const form = await c.req.parseBody();
    const iterationId = typeof form["iteration"] === "string" ? form["iteration"] : "";
    const request = typeof form["request"] === "string" ? form["request"] : "";
    if (merge === null) {
      return mergeRefused(c, 403, "mergeRefusedNoApprover", request);
    }
    const minting = mintPress(c, form["token"]);
    if (!("press" in minting)) {
      return mergeRefused(c, minting.status, "mergeRefusedPress", request);
    }
    const head = form["head"];
    if (typeof head !== "string" || head === "" || iterationId === "") {
      return mergeRefused(c, 400, "mergeRefusedForm", request);
    }
    const merged = await merge.merge(minting.press, { iterationId, head });
    if (!merged.ok) {
      return mergeRefused(
        c,
        409,
        merged.why ?? "mergeRefusedFailed",
        request,
        merged.detail ?? null,
        merged.note,
      );
    }
    return c.redirect(
      viewHref(
        request === "" ? { kind: "summary" } : { kind: "thread", messageId: request, to: null },
        tagOf(c),
      ),
      303,
    );
  });

  /**
   * Whether the thread already holds exactly this operator message.
   *
   * **The answer it carries is part of "exactly"** (D-0072 rule 1). Without it,
   * a form resubmitted with the *other* answer -- same id, same words, same
   * parent -- would be refused by the store's uniqueness and then reported to
   * the person as the answer they just pressed, while the line kept whatever the
   * first press did to it. Only an exact replay is the send it repeats.
   */
  async function alreadyThere(
    message: SentMessage,
    answerOutcome: AskAnswer | null = null,
  ): Promise<boolean> {
    const read = await reading.record.threadMessages();
    return (
      read.kind === "read" &&
      read.messages.some(
        (held) =>
          held.messageId === message.messageId &&
          held.authorKind === "operator" &&
          held.body === message.body &&
          held.inReplyTo === message.inReplyTo &&
          (held.answerOutcome ?? null) === answerOutcome,
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
    status: 400 | 403 | 409 | 413,
    why:
      | "sendRefusedNoApprover"
      | "sendRefusedForm"
      | "sendRefusedNoWords"
      | "sendRefusedNotTaken"
      | "sendRefusedAsk"
      | "sendRefusedTooLong"
      | "answerRefusedPress",
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
   * A record-scope press's refusal, as one catalogue sentence in the page's
   * language with the way back to the screen it was pressed on.
   *
   * No htmx fragment, because this form carries no htmx: the scope screen is a
   * form a person fills in, and it neither polls nor posts with a script.
   */
  function scopeRefused(
    c: Context<PageEnv>,
    status: 400 | 403 | 409,
    why:
      | "scopeRefusedNoApprover"
      | "scopeRefusedPress"
      | "scopeRefusedForm"
      | "scopeRefusedFields"
      | ScopeRefusal,
    request: string | null,
    /**
     * The review-rounds choice the refused press was made under, read back off
     * the form's own number.
     *
     * The address carries the choice (`viewHref`) and the form posts no
     * address, so a refusal that dropped it sent the person back to a form
     * redrawn at rondo's default -- with every other budget they had typed
     * (rondo#233 S3 screen review). Null before the body is read, which is the
     * one refusal that cannot know.
     */
    rounds: number | null = null,
    /** The plan the form was drawn over, for the rounds' reason (rondo#238). */
    plan: string | null = null,
  ) {
    const wording = wordingOf(c);
    return pressRefused(
      c,
      status,
      wording.scopeAction,
      wording[why],
      backToScope(wording, request, null, rounds, plan),
    );
  }

  /** A scoped start's refusal, said the same way and with the same way back. */
  function startRefused(
    c: Context<PageEnv>,
    status: 400 | 403 | 409,
    why: "startRefusedNoApprover" | "startRefusedPress" | "startRefusedForm" | StartRefusal,
    request: string | null,
    decision: string | null,
    test: string | null = null,
    plan: string | null = null,
  ) {
    const wording = wordingOf(c);
    const line =
      why === "startRefusedOutside" ? wording.startRefusedOutside(test ?? "") : wording[why];
    return pressRefused(
      c,
      status,
      wording.startAction,
      line,
      backToScope(wording, request, decision, null, plan),
    );
  }

  /**
   * A revise press's refusal, said the same way as the scope screen's two and
   * with the way back to the gate it was pressed at.
   *
   * **The gate is the way back and not the summary**, because the draft the
   * person may have edited only exists in the browser's own history: a refusal
   * that landed them on the summary would lose words they wrote.
   */
  function reviseRefused(
    c: Context<PageEnv>,
    status: 400 | 403 | 409,
    why: "reviseRefusedNoApprover" | "reviseRefusedPress" | "reviseRefusedForm" | ReviseRefusal,
    requestMessageId: string | null,
    test: string | null = null,
    /** The port's own reason, for the maintainer fold under the sentence. */
    note: string | null = null,
  ) {
    const wording = wordingOf(c);
    const line =
      why === "reviseRefusedOutside" ? wording.reviseRefusedOutside(test ?? "") : wording[why];
    return pressRefused(
      c,
      status,
      wording.reviseAction,
      line,
      viewHref(
        requestMessageId === null || requestMessageId === ""
          ? { kind: "summary" }
          : { kind: "thread", messageId: requestMessageId, to: null },
        wording.lang,
      ),
      wording.gateBack,
      note,
    );
  }

  /**
   * A raise press's refusal, with the way back to the gate it was pressed from
   * (D-0074 rule 4.4): that is where the refusal is about, and where the gate
   * view already draws whichever approval now stands.
   */
  function raiseRefused(
    c: Context<PageEnv>,
    status: 400 | 403 | 409,
    why:
      | "scopeRefusedNoApprover"
      | "scopeRefusedPress"
      | "scopeRefusedForm"
      | "scopeRefusedFields"
      | ScopeRefusal,
    requestMessageId: string,
  ) {
    const wording = wordingOf(c);
    return pressRefused(
      c,
      status,
      wording.raiseAction,
      wording[why],
      viewHref(
        requestMessageId === ""
          ? { kind: "summary" }
          : { kind: "thread", messageId: requestMessageId, to: null },
        wording.lang,
      ),
      wording.gateBack,
    );
  }

  /**
   * A publish press's refusal, in the page's language, with the way back to the
   * screen it was pressed on -- which is the screen that shows the dry-run, so
   * a person lands on the reason beside the thing it is about.
   *
   * `detail` is git's or the forge's own line, carried for the refusals whose
   * sentence needs it, and never a D-number.
   */
  function publishRefused(
    c: Context<PageEnv>,
    status: 400 | 403 | 409,
    why: "publishRefusedNoApprover" | "publishRefusedPress" | "publishRefusedForm" | PublishRefusal,
    iterationId: string | null,
    detail: string | null = null,
    /** The port's own reason, for the maintainer fold under the sentence. */
    note: string | null = null,
  ) {
    const wording = wordingOf(c);
    const said = wording[why];
    return pressRefused(
      c,
      status,
      wording.publishAction,
      typeof said === "function" ? said(detail ?? "") : said,
      viewHref(
        iterationId === null || iterationId === ""
          ? { kind: "summary" }
          : { kind: "publish", iterationId },
        wording.lang,
      ),
      wording.publishBack,
      note,
    );
  }

  /**
   * A merge press's refusal, in the page's language, with the way back to the
   * thread it was pressed in -- where the button still is, for another press
   * once whatever stopped this one has been seen to.
   */
  function mergeRefused(
    c: Context<PageEnv>,
    status: 400 | 403 | 409,
    why: "mergeRefusedNoApprover" | "mergeRefusedPress" | "mergeRefusedForm" | MergeRefusal,
    request: string,
    detail: string | null = null,
    note: string | null = null,
  ) {
    const wording = wordingOf(c);
    const said = wording[why];
    return pressRefused(
      c,
      status,
      wording.mergeAction,
      typeof said === "function" ? said(detail ?? "") : said,
      viewHref(
        request === "" ? { kind: "summary" } : { kind: "thread", messageId: request, to: null },
        wording.lang,
      ),
      wording.mergeBack,
      note,
    );
  }

  function releaseRefused(
    c: Context<PageEnv>,
    status: 400 | 403 | 409,
    why: "releaseRefusedNoApprover" | "releaseRefusedPress" | "releaseRefusedForm" | ReleaseRefusal,
    iterationId: string | null,
  ) {
    const wording = wordingOf(c);
    return pressRefused(
      c,
      status,
      wording.releaseAction,
      wording[why],
      viewHref(
        iterationId === null || iterationId === ""
          ? { kind: "summary" }
          : { kind: "release", iterationId },
        wording.lang,
      ),
      wording.releaseBack,
    );
  }

  function addRepositoryRefused(
    c: Context<PageEnv>,
    status: 400 | 403 | 409,
    why:
      | "addRepositoryRefusedNoApprover"
      | "addRepositoryRefusedPress"
      | "addRepositoryRefusedForm"
      | AddRepositoryRefusal,
    request: string,
    note: string | null = null,
  ) {
    const wording = wordingOf(c);
    return pressRefused(
      c,
      status,
      wording.addRepositoryAction,
      wording[why],
      viewHref(
        request === "" ? { kind: "summary" } : { kind: "thread", messageId: request, to: null },
        wording.lang,
      ),
      wording.addRepositoryBack,
      note,
    );
  }

  /** The address the two refusals send a person back to: the screen they pressed on. */
  function backToScope(
    wording: Chrome,
    request: string | null,
    decision: string | null = null,
    rounds: number | null = null,
    plan: string | null = null,
  ): string {
    return viewHref(
      request === null || request === ""
        ? { kind: "requests" }
        : {
            kind: "scope",
            messageId: request,
            rounds,
            decisionId: decision === null || decision === "" ? null : decision,
            plan,
          },
      wording.lang,
    );
  }

  /** One refusal page: what it is, why nothing happened, and the one link back. */
  function pressRefused(
    c: Context<PageEnv>,
    status: 400 | 403 | 409,
    title: string,
    line: string,
    href: string,
    /** What the one link says; the scope screen's two presses name that screen. */
    back: string = wordingOf(c).scopeBack,
    /**
     * rondo's own reason, when the press reached a port that gave one: the
     * sentence above says who can look, and this is what they look at
     * (D-0076 rule 4.2), closed, with where the rest of the host's output is.
     */
    note: string | null = null,
  ) {
    const wording = wordingOf(c);
    return c.html(
      `<!doctype html><html lang="${escapeHtml(wording.lang)}"><head><meta charset="utf-8">` +
        `<meta name="viewport" content="width=device-width, initial-scale=1">` +
        `<title>${escapeHtml(title)}</title></head><body>` +
        `<p id="scope-refused">${escapeHtml(line)}</p>` +
        (note === null || note === ""
          ? ""
          : `<details id="refused-reason"><summary>${escapeHtml(wording.forMaintainer)}</summary>` +
            `<p lang="en">${escapeHtml(note)}</p><p>${escapeHtml(wording.hostLog)}</p></details>`) +
        // The way back to what was typed, as a refused send and a refused
        // claim both already say: with script off this page *is* the response,
        // and the draft only exists in the browser's own history.
        `<p>${escapeHtml(wording.sendBackNote)}</p>` +
        `<p><a href="${escapeHtml(href)}">${escapeHtml(back)}</a></p></body></html>`,
      status,
    );
  }

  /**
   * A claim's refusal as a page in the press's language, with the way back to
   * the gate (rondo#220 S2 review). Only a native submit carries a claim, so
   * there is no htmx fragment; the draft is kept by the gate's own composer.
   */
  function claimRefused(c: Context<PageEnv>, why: ClaimRefusal, requestMessageId: string) {
    const wording = wordingOf(c);
    const line = why === "claimTooLong" ? wording.claimTooLong(MAX_CLAIM_CHARS) : wording[why];
    const href = escapeHtml(
      viewHref(
        requestMessageId === ""
          ? { kind: "summary" }
          : { kind: "thread", messageId: requestMessageId, to: null },
        wording.lang,
      ),
    );
    return c.html(
      `<!doctype html><html lang="${escapeHtml(wording.lang)}"><head><meta charset="utf-8">` +
        `<meta name="viewport" content="width=device-width, initial-scale=1">` +
        `<title>${escapeHtml(wording.answerNotDone)}</title></head><body>` +
        `<p id="answer-refused">${escapeHtml(line)}</p><p>${escapeHtml(wording.sendBackNote)}</p>` +
        `<p><a href="${href}">${escapeHtml(wording.gateBack)}</a></p></body></html>`,
      409,
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
