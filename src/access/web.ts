/**
 * One page, on localhost, that reads.
 *
 * **It is a second view of three commands and not a second system.** `inbox`,
 * `between` and `explain` already compose everything here out of rondo's own
 * rows; this module gathers what they gather and renders it as HTML, so a
 * person can read on a screen what they would otherwise read in a terminal.
 * Nothing new is stored, nothing new is named, and no state exists that a
 * command cannot also show.
 *
 * **Reading is a type; the one write is a runtime fact** (D-0041). The two
 * ports are still `Pick`ed down to the methods that read ({@link WebPorts}), so
 * everything the renderer holds is unable to write and the compiler says so.
 * That is not a preference about web surfaces: the two rows a terminal `inbox`
 * writes -- the count of what was presented (D-0032 rule 10) and the last-look
 * mark (rule 9) -- are claims about a person having been shown something, and a
 * page redrawing every few seconds while nobody is at the desk would make both
 * of them lies. A redraw did not read the inbox, so it still writes neither.
 *
 * **A click, though, is a person answering a gate.** So the page carries one
 * button, and the whole of what it may write arrives as a *second* port holding
 * a single function ({@link AnswerFromWeb}) rather than a store: the page's
 * writing vocabulary is one sentence long, and widening it is a visible change
 * to a type. No type can tell an unattended redraw from a human's click -- they
 * differ in whether somebody was at the keyboard, which is not in the data -- so
 * two runtime facts do it instead, and either alone would be enough. The redraw
 * is `<meta http-equiv="refresh">` and the page carries no script, so nothing
 * here can emit a `POST` without a person pressing something; and a token minted
 * when this process began listening is rendered into the form and checked on the
 * way in, so a `POST` that carries it came from a page this process served.
 *
 * **So the press, and not the render, is this surface's presentation**
 * (D-0042). The framing beside the button is written to the ledger before the
 * gate is answered, by the same `explain` writer the terminal uses -- and if it
 * cannot be written, nothing is answered and the person is told, which is
 * D-0022 rule 18's order applied to a page that had already drawn what it was
 * about to act on. It happens inside {@link AnswerFromWeb} rather than here for
 * D-0041 rule 4's reason: one function is still the whole of what this surface
 * may write.
 *
 * **Two things the terminal got wrong are not repeated here** (rondo#90,
 * rondo#91). A request is shown with its paragraphs intact, because the page
 * has no cp932 console to protect and `white-space: pre-wrap` costs nothing;
 * and a basis is printed once above the claims that rest on it rather than
 * under each of them, because the terminal's repetition is what made a long
 * citation unreadable.
 *
 * **localhost, and no authentication instead of weak authentication.** The
 * server binds `127.0.0.1` and nothing else, so what protects the page is that
 * it is not reachable rather than a password rondo would have to store,
 * rotate and get right.
 */
import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  type AdvisorySnapshot,
  type Claim,
  type HostSnapshot,
  propose,
  proposeHost,
} from "../advisory/proposal.js";
import type { HostPolicy } from "../refrain/policy.js";
import type { IterationRecord } from "../store/records.js";
import type { AdvisoryRecord, IterationStore } from "../store/sqlite.js";
import { basisLine, gather, gatherHost } from "./advisory.js";
import { gatherInbox, type InboxReadPorts, inboxLines } from "./inbox.js";

/**
 * Everything the page is handed: the reading half of the two ports, the host's
 * bounds, whose inbox to draw, and a clock.
 *
 * `actorId` is nullable because an inbox is one person's: with `RONDO_APPROVER`
 * unset there is nobody whose last-look mark the "since you last looked"
 * section could be about, and the page says so rather than drawing somebody's.
 */
export interface WebPorts extends InboxReadPorts {
  readonly store: Pick<IterationStore, "read" | "readLive" | "readingsFor" | "occupancy">;
  readonly record: InboxReadPorts["record"] & Pick<AdvisoryRecord, "admissionRefusals">;
  readonly policy: HostPolicy;
  readonly actorId: string | null;
  /**
   * The whole of what this surface may write (D-0041 rules 4 and 7), or null
   * when there is nobody to write as.
   *
   * One function and not a store handle, deliberately: with an `IterationStore`
   * here every later edit to this module could write anything a store can write
   * and the compiler would agree, and the boundary would be back to being a
   * promise. Null when `RONDO_APPROVER` is unset, which is also when no button
   * is drawn -- rondo does not act for an unnamed person on a screen either
   * (D-0020 rule 2).
   */
  readonly answer: AnswerFromWeb | null;
  /**
   * What the lap actually did, as `rondo answer` lists it (D-0029 rule 2).
   *
   * A function for {@link answer}'s reason turned the other way round: the
   * material is read out of a workspace with `git`, and a page that could spawn
   * one would have a capability nothing on this surface should hold. So the
   * caller reads it and this module renders it.
   *
   * It is shown **where the button is** and nowhere else, because the button is
   * where it is needed: a screen that is easier to reach than the terminal must
   * not also be the screen that asks for less before it writes.
   */
  readonly material: LapMaterial | null;
}

/** The lines `rondo answer` prints about the work itself, for one iteration. */
export type LapMaterial = (record: IterationRecord) => Promise<readonly string[]>;

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
 * The one word the button carries (D-0041 rule 7).
 *
 * Read from this constant on the way *in* rather than from the posted form: the
 * form's own `body` field is not trusted, so the page's writing vocabulary is
 * one word whatever a hand-written request says.
 */
const APPROVE_BODY = "approve";

/** How often the page redraws itself, in seconds. */
const REFRESH_SECONDS = 5;

/** Text as HTML text: the four characters that would otherwise be markup. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Claims under the basis they rest on, each basis written once (rondo#91).
 *
 * Consecutive claims are grouped, never reordered: the order of the claims is
 * the payload's own and rondo does not rank them, so a grouping that sorted by
 * basis would be this surface inventing an emphasis the drafter did not have.
 */
function claimsHtml(claims: readonly Claim[], snapshot: object): string {
  const groups: { basis: string; claims: Claim[] }[] = [];
  for (const claim of claims) {
    const basis = basisLine(claim.basis, snapshot);
    const last = groups.at(-1);
    if (last !== undefined && last.basis === basis) {
      last.claims.push(claim);
    } else {
      groups.push({ basis, claims: [claim] });
    }
  }
  return groups
    .map(
      (group) =>
        `<div class="group"><p class="basis">${escapeHtml(withoutRepeat(group))}</p>${group.claims
          .map(
            (claim) =>
              `<p class="claim"><span class="label">${escapeHtml(claim.label)}</span>` +
              `<span class="value">${escapeHtml(claim.value)}</span></p>`,
          )
          .join("")}</div>`,
    )
    .join("");
}

/**
 * One basis line, with the inline copy dropped when it says what the claim
 * above it already says.
 *
 * The terminal prints the cited material beside the pointer because a person
 * reading one line cannot open the snapshot (D-0032 rule 2). On a page where
 * the claim's value is *right there*, the same material twice -- once as prose
 * and once JSON-escaped -- is the repetition rondo#91 is about, and the
 * escaped copy is the one that is harder to read. The pointer stays: what is
 * dropped is a duplicate of the value, never the locator.
 */
function withoutRepeat(group: { basis: string; claims: readonly Claim[] }): string {
  const only = group.claims.length === 1 ? group.claims[0] : undefined;
  const tail = only === undefined ? "" : ` = ${JSON.stringify(only.value)}`;
  return tail !== "" && group.basis.endsWith(tail)
    ? group.basis.slice(0, -tail.length)
    : group.basis;
}

function section(heading: string, note: string, body: string): string {
  return (
    `<section><h2>${escapeHtml(heading)}</h2>` +
    (note === "" ? "" : `<p class="note">${escapeHtml(note)}</p>`) +
    `${body}</section>`
  );
}

/** The inbox section: the same lines `rondo inbox` prints, and no mark moved. */
async function inboxHtml(ports: WebPorts): Promise<string> {
  if (ports.actorId === null) {
    return section(
      "waiting on you",
      "RONDO_APPROVER is not set, so there is no identity whose inbox this would be.",
      "",
    );
  }
  const snapshot = await gatherInbox(ports, ports.actorId);
  return section(
    "waiting on you",
    "Reading this does not move your last-look mark: that is what rondo inbox does.",
    `<pre>${escapeHtml(inboxLines(ports.actorId, snapshot).join("\n"))}</pre>`,
  );
}

/** The between-laps section: `rondo between`'s composition, unrecorded. */
async function betweenHtml(ports: WebPorts): Promise<string> {
  const snapshot: HostSnapshot = await gatherHost(ports);
  return section(
    "what spans the live laps",
    "An adjacency is not a collision: two laps open against one base branch is where to " +
      "look, not what was found.",
    claimsHtml(proposeHost(snapshot).payload.claims, snapshot),
  );
}

/**
 * The one button, drawn only where there is something for it to answer.
 *
 * Three conditions, and each is a different way of not having a question in
 * front of a person: no write port (nobody to act as), a status that is not
 * `awaiting_human` (nothing is asking), or no gate id on the row (the status
 * says a gate is open and the row does not name one, which `answer` refuses
 * too). A button drawn anyway would be one that fails when pressed.
 *
 * `method="post"` is not decoration: the redraw above is a document `GET`, and
 * this form is the only thing on the page that can produce anything else.
 */
function approveHtml(record: IterationRecord, token: string | null, material: string): string {
  if (token === null || record.status !== "awaiting_human" || record.gateId === null) {
    return "";
  }
  return (
    material +
    `<form class="approve" method="post" action="/">` +
    `<input type="hidden" name="token" value="${escapeHtml(token)}">` +
    `<input type="hidden" name="iteration" value="${escapeHtml(record.id)}">` +
    `<button type="submit">${escapeHtml(APPROVE_BODY)}</button>` +
    `<span class="note">answers gate ${escapeHtml(record.gateId)} as ` +
    `'${escapeHtml(APPROVE_BODY)}', which is what rondo answer does</span>` +
    `</form>`
  );
}

/** One live iteration, explained the way `rondo explain` explains it. */
function explainHtml(
  record: IterationRecord,
  snapshot: AdvisorySnapshot,
  token: string | null,
  material: string,
): string {
  return section(
    `iteration '${record.id}'`,
    "This explanation binds nothing: it is not a proposal and cannot be approved.",
    claimsHtml(propose(snapshot).payload.claims, snapshot) + approveHtml(record, token, material),
  );
}

/**
 * The work a press would approve over, or nothing when there is no press.
 *
 * Read only for the row that carries the button: it shells out to `git` in the
 * caller, and a page that redraws every five seconds must not inspect every
 * workspace it can see each time it does.
 */
async function materialHtml(ports: WebPorts, record: IterationRecord): Promise<string> {
  if (ports.material === null || record.status !== "awaiting_human" || record.gateId === null) {
    return "";
  }
  const lines = await ports.material(record);
  return `<pre class="material">${escapeHtml(lines.join("\n"))}</pre>`;
}

/**
 * The whole page.
 *
 * Every live row is explained rather than linked to, because one page with
 * everything on it is what an operator scrolls; a second page would be a second
 * thing to navigate and a second URL to get wrong.
 */
export async function operatorPage(ports: WebPorts, token: string | null = null): Promise<string> {
  const sections: string[] = [await inboxHtml(ports), await betweenHtml(ports)];
  for (const outcome of await ports.store.readLive()) {
    if (outcome.kind === "read") {
      sections.push(
        explainHtml(
          outcome.record,
          gather(outcome.record, await ports.store.readingsFor(outcome.record.id)),
          ports.answer === null ? null : token,
          await materialHtml(ports, outcome.record),
        ),
      );
    } else if (outcome.kind === "unreadable") {
      // A live row that will not decode is on the page for the inbox's reason:
      // it holds a slot, so leaving it out would understate what is running.
      sections.push(
        section(
          `iteration '${outcome.id}'`,
          "",
          `<pre>will not decode: ${escapeHtml(outcome.reason)}</pre>`,
        ),
      );
    }
  }
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="${String(REFRESH_SECONDS)}">
<title>rondo</title>
<style>
:root { color-scheme: light dark; }
body { font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  margin: 0 auto; max-width: 60rem; padding: 1.5rem 1rem; }
h1 { font-size: 1.2rem; margin: 0; }
h2 { font-size: 1rem; margin: 0 0 .25rem; }
section { margin: 1.5rem 0; }
pre { white-space: pre-wrap; word-break: break-word; margin: 0; }
.note, .basis { opacity: .7; margin: .25rem 0; }
.group { border-left: 2px solid currentColor; margin: .75rem 0; padding-left: .75rem; }
.basis { font-size: .85rem; }
.claim { display: grid; grid-template-columns: minmax(9rem, 14rem) 1fr; gap: .75rem; margin: .25rem 0; }
.label { opacity: .7; }
.approve { align-items: center; display: flex; flex-wrap: wrap; gap: .75rem; margin: .75rem 0 0; }
.approve button { font: inherit; padding: .4rem 1.2rem; }
.approve .note { margin: 0; }
.material { margin: .75rem 0 0; opacity: .85; }
.value { white-space: pre-wrap; word-break: break-word; }
@media (max-width: 40rem) { .claim { grid-template-columns: 1fr; gap: 0; } }
</style>
</head>
<body>
<h1>rondo</h1>
<p class="note">Redraws every ${String(REFRESH_SECONDS)}s, and a redraw writes nothing: no last-look
mark moves and no presentation is counted. The one thing that writes is the approve button, which
records the explanation you pressed on and then answers the gate.</p>
${sections.join("\n")}
</body>
</html>
`;
}

/**
 * Whether a request's `Host` names this machine.
 *
 * **Binding to loopback is not by itself enough, and this is the gap it
 * leaves.** A browser will happily send a page from `evil.example` a request to
 * a name the attacker has re-pointed at `127.0.0.1` -- DNS rebinding -- and the
 * socket cannot tell that request from the operator's own, because it arrives
 * on loopback either way. What differs is the `Host` header: the operator's
 * browser sends the address they typed, and a rebound page sends the attacker's
 * name. So the page is served to the three spellings of this machine and to
 * nothing else, which is the whole of what an unauthenticated surface can
 * check.
 *
 * A request with no `Host` at all is refused rather than admitted: HTTP/1.1
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
 * Whether a request's `Origin`, if it sent one, names this machine.
 *
 * Corroboration rather than the gate (D-0041 rule 3): a cross-site form post
 * carries the attacker's origin and is refused here for free, but `Origin` is
 * absent often enough -- and from enough legitimate requests -- that a surface
 * resting on it would be resting on a header's presence. The token is what the
 * refusal actually rests on; this closes the door one step earlier when the
 * browser happens to say who sent the request.
 *
 * An `Origin` that will not parse is refused rather than admitted: `null` is
 * what a browser sends for a sandboxed or redirected form post, and that is not
 * the operator's own page.
 */
function originIsThisMachine(origin: string | undefined): boolean {
  if (origin === undefined) {
    return true;
  }
  try {
    return fromThisMachine(new URL(origin).host);
  } catch {
    return false;
  }
}

/**
 * The body of one form post, or null when it is longer than a form post is.
 *
 * The cap is not a performance measure. This surface accepts exactly two short
 * fields, and a request that is bigger than that is not the page's form -- so
 * reading it to the end would be this process buffering whatever anybody on
 * loopback felt like sending.
 */
const MAX_FORM_BYTES = 4096;

function readForm(request: IncomingMessage): Promise<URLSearchParams | null> {
  return new Promise((resolve) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      body += chunk;
      if (body.length > MAX_FORM_BYTES) {
        resolve(null);
        request.destroy();
      }
    });
    request.on("end", () => {
      resolve(new URLSearchParams(body));
    });
    request.on("error", () => {
      resolve(null);
    });
  });
}

/**
 * One press of the button, from the check that it was a person to the row it
 * settles.
 *
 * The order is the point. Everything that decides *whether this request may
 * write* happens before the write port is touched at all, and each refusal is
 * a status a person can read rather than a silent redraw. A success answers
 * `303` back to `/` (rule 8): the page refreshes itself, and a `POST` left on
 * the history stack is one an F5 would send again.
 */
async function handleApprove(
  ports: WebPorts,
  token: string,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const refuse = (status: number, line: string): void => {
    response.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
    response.end(`${line}\n`);
  };
  if (ports.answer === null) {
    refuse(403, "RONDO_APPROVER is not set, so there is nobody this page could answer as");
    return;
  }
  if (!originIsThisMachine(request.headers.origin)) {
    refuse(403, "that request came from another page");
    return;
  }
  const form = await readForm(request);
  if (form === null) {
    refuse(413, "that is larger than this page's form");
    return;
  }
  if (form.get("token") !== token) {
    refuse(403, "that form did not come from this page; reload it and press the button again");
    return;
  }
  const iterationId = form.get("iteration");
  if (iterationId === null || iterationId === "") {
    refuse(400, "that form named no iteration");
    return;
  }
  const answered = await ports.answer(iterationId, APPROVE_BODY);
  if (!answered.ok) {
    refuse(409, answered.note);
    return;
  }
  response.writeHead(303, { location: "/" }).end();
}

/**
 * Serve the page on localhost until the server is closed.
 *
 * `127.0.0.1` is written here rather than taken as an argument: an address is
 * the one thing about this surface that must not be configurable, because a
 * page with no authentication bound to anything else is a page anybody on the
 * network can read. {@link fromThisMachine} is the other half of that, and it
 * is not redundant: the bind decides which sockets arrive, and the `Host` check
 * decides which *pages* may have sent them.
 *
 * Resolves 0 when the server closes and 1 when it cannot listen, so the
 * command line has a status without this module knowing what a status is.
 */
export function serveOperatorPage(
  ports: WebPorts,
  port: number,
  announce: (line: string) => void,
  announceError: (line: string) => void,
  // `listen`'s own `signal`, which closes the server when it aborts. The
  // command line passes none -- ctrl-c ends the process and there is nothing
  // to unwind -- and a test passes one rather than reaching for a handle this
  // function would otherwise have to hand back.
  signal?: AbortSignal,
): Promise<number> {
  // **Minted once, when this process starts serving** (D-0041 rule 3b). Per
  // process rather than per render, because a token that changed under the
  // five-second redraw would expire every form before anybody could press it;
  // and `randomUUID` rather than anything derived, because the whole property
  // is that no other page can guess it.
  const token = randomUUID();
  const server = createServer((request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "POST") {
      response.writeHead(405, { allow: "GET, HEAD, POST" }).end();
      return;
    }
    if (!fromThisMachine(request.headers.host)) {
      response.writeHead(421, { "content-type": "text/plain; charset=utf-8" });
      response.end("rondo serves this page to 127.0.0.1 and localhost only\n");
      return;
    }
    // One page and no router: every other path is a 404 rather than a redirect,
    // so a typo'd URL says so instead of quietly showing the only page there is.
    if ((request.url ?? "/").split("?")[0] !== "/") {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("not found\n");
      return;
    }
    if (request.method === "POST") {
      handleApprove(ports, token, request, response).catch((error: unknown) => {
        // Same reasoning as the render's catch below: every check above is
        // total and the write port reports its own refusals, so a throw here is
        // a defect. Shown rather than swallowed -- a redirect back to a page
        // still showing an open gate is the one answer a person cannot act on.
        response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
        response.end(`${error instanceof Error ? error.message : String(error)}\n`);
      });
      return;
    }
    operatorPage(ports, token)
      .then((html) => {
        response.writeHead(200, {
          "content-type": "text/html; charset=utf-8",
          // **The third door, and the one the token cannot hold** (D-0041
          // rule 3). A page on evil.example cannot *read* this one and so
          // cannot steal the token -- but it can put this one in a transparent
          // frame over a button of its own, and then the click that arrives
          // carries the genuine token from the loopback origin and is
          // indistinguishable from the operator pressing approve. It is the
          // same shape as the other two: a browser doing what the operator
          // asked, for a page the operator did not mean. What refuses it is the
          // browser, told not to frame this page at all, which is why the
          // header is sent even though nothing about rondo needs a frame.
          "content-security-policy": "frame-ancestors 'none'",
        });
        response.end(request.method === "HEAD" ? undefined : html);
      })
      .catch((error: unknown) => {
        // The page is composed from rows that may not decode, and every reader
        // it uses is total -- so a throw here is a defect rather than a state.
        // It is shown rather than swallowed: a blank page would send the
        // operator to the terminal to find out what a terminal already knows.
        response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
        response.end(`${error instanceof Error ? error.message : String(error)}\n`);
      });
  });
  return new Promise<number>((resolve) => {
    server.on("error", (error) => {
      announceError(`the operator page could not be served: ${error.message}`);
      resolve(1);
    });
    server.on("close", () => {
      resolve(0);
    });
    server.listen({ port, host: "127.0.0.1", signal }, () => {
      // The port that was **bound**, not the one that was asked for: they differ
      // when the caller asked for 0, and a line naming a port nothing is
      // listening on is worse than no line at all.
      const bound = server.address();
      const at = bound !== null && typeof bound === "object" ? bound.port : port;
      announce(
        `rondo is ${ports.answer === null ? "reading" : "reading and answering"} at ` +
          `http://127.0.0.1:${String(at)}/ -- ctrl-c to stop`,
      );
    });
  });
}
