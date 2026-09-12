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
 * **What it is not is those three commands in the order they were written**
 * (rondo#145). An operator arrives with three questions -- *what needs me, what
 * is running, what just finished* -- and the page answers them in that order,
 * out of the rows `inbox`, `between` and `explain` already read. rondo's own
 * vocabulary -- bounds, adjacency, the last-look mark, a field-by-field reading
 * of every row -- is one `<details>` below, complete and unchanged. Folded is
 * not hidden: every claim that was on this page is still on it under the same
 * basis, and the lead cites the row each of its lines is read off so that a
 * number is checkable twice over rather than asserted once. The three terminal
 * commands are untouched; this is the web face and only the web face.
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
import {
  type IterationRecord,
  isTerminal,
  type NonTerminalStatus,
  type OpenProposal,
  WAIT_SIDE,
} from "../store/records.js";
import type { AdvisoryRecord, IterationStore, ReadOutcome } from "../store/sqlite.js";
import { basisLine, gather, gatherHost } from "./advisory.js";
import {
  ago,
  gatherInbox,
  type InboxReadPorts,
  type InboxSnapshot,
  inboxLines,
  type LiveRow,
  locateRunning,
  type TranscriptLocation,
  unblockedBy,
  whereItRuns,
} from "./inbox.js";

/**
 * Everything the page is handed: the reading half of the two ports, the host's
 * bounds, whose inbox to draw, and a clock.
 *
 * `actorId` is nullable because an inbox is one person's: with `RONDO_APPROVER`
 * unset there is nobody whose last-look mark the "since you last looked"
 * section could be about, and the page says so rather than drawing somebody's.
 */
export interface WebPorts extends InboxReadPorts {
  readonly store: Pick<
    IterationStore,
    "read" | "readLive" | "readingsFor" | "occupancy" | "terminalIterations"
  >;
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

/**
 * How many ended laps the lead names before it stops counting back (rondo#145).
 *
 * ponytail: a fixed cap, and it caps the *rendering* rather than the read --
 * `terminalIterations` answers the whole ledger and this page sorts it every
 * five seconds. That is fine while a ledger is a session's worth of rows and is
 * the first thing to change if one is not; the store is where a bounded reader
 * would go, not here. *What just finished* is a question about the last few
 * minutes, and every ended row is still readable with `rondo explain`.
 */
const RECENT_ENDED = 5;

/**
 * One lap in the lead, with the row it rests on cited once above it (D-0032,
 * rondo#91).
 *
 * Every line in the block is read off **one iteration row**, so the basis is
 * that row and it is written once -- the shape {@link claimsHtml} already uses
 * for a shared snapshot pointer. The field-level pointers are not dropped: the
 * reading below carries every one of these fields as its own claim under its own
 * `snapshot /iteration/...` locator. That is what makes this a fold and not a
 * hiding.
 *
 * {@link basisLine} is called rather than the string being spelled here,
 * because a second spelling of a basis is a second thing an operator has to
 * learn to trust. The `iteration` form reads no snapshot, so it is handed none.
 */
function lapHtml(
  record: IterationRecord,
  head: string,
  lines: readonly (string | null)[],
  tail = "",
): string {
  const basis = basisLine({ form: "iteration", iterationId: record.id }, {});
  return (
    `<div class="lap"><p class="basis">${escapeHtml(basis)}</p>` +
    `<p class="head">${escapeHtml(head)}</p>` +
    `<p class="request">${escapeHtml(record.request)}</p>` +
    lines
      .filter((line): line is string => line !== null)
      .map((line) => `<p class="line">${escapeHtml(line)}</p>`)
      .join("") +
    tail +
    `</div>`
  );
}

/**
 * What the lap spent, or nothing at all when rondo read none of it (`D-0046`).
 *
 * **Absent from the lead is not absent from the page.** All three columns are
 * null until the lap suspends, and a running lap carrying three `undetermined`s
 * is three lines that say nothing -- which is the failure rondo#145 measured.
 * The reading below still prints each of the three under its own pointer, so
 * the distinction between *rondo did not read this* and *this cost nothing*
 * survives where it is checkable. Where any one of them **was** read the line
 * is drawn and the other two say so by name.
 */
function spentLine(record: IterationRecord): string | null {
  if (record.lapCostUsd === null && record.lapTurns === null && record.lapDurationMs === null) {
    return null;
  }
  const cost =
    record.lapCostUsd === null ? "cost not read" : `cost $${record.lapCostUsd.toFixed(2)}`;
  const turns = record.lapTurns === null ? "turns not read" : `${String(record.lapTurns)} turns`;
  // `ago` over a duration rather than over a clock: the same reading of the
  // same number of milliseconds, which is what keeps `7m` on this page the
  // same `7m` the inbox prints.
  const took = record.lapDurationMs === null ? "duration not read" : ago(0, record.lapDurationMs);
  return `${cost}, ${turns}, ${took}`;
}

/**
 * What the worker's fence refused, in the three states the column has (#122).
 *
 * SQL null is rondo holding no reading, and is a line the lead does not draw:
 * every row before its first suspend is in that state and a screen that said so
 * on each of them would be back to counting zeros. The text `"null"` is continuo
 * saying it could not tell, which is **not** the same as nothing having been
 * refused and is the distinction the column was added to carry -- so it gets a
 * line of its own. The bytes are printed as continuo wrote them.
 */
function fenceLine(record: IterationRecord): string | null {
  const refused = record.permissionDenials;
  if (refused === null) {
    return null;
  }
  if (refused === "null") {
    return "the fence: continuo could not tell what it refused";
  }
  return refused === "[]" ? "the fence refused nothing" : `the fence refused ${refused}`;
}

/** How an ended lap ended: the status, and the answer or reason beside it. */
function endedHow(record: IterationRecord, nowMs: number): string {
  const why =
    record.gateOutcome !== null
      ? `gate answered '${record.gateOutcome}'`
      : (record.reason ?? "no reason recorded");
  return `${record.status} ${ago(record.updatedAtMs, nowMs)} ago -- ${why}`;
}

/**
 * *What needs me* -- the laps stopped at a question, and the proposals open.
 *
 * First because it is the only part of the page an operator can act on, which
 * is `inbox`'s own argument for the same order. The button and the material it
 * would be pressed over are **here** rather than in the reading below, because
 * D-0042 makes the press this surface's presentation: what a person is shown
 * before they write has to be beside the thing they press.
 */
function waitingHtml(
  waiting: readonly IterationRecord[],
  open: readonly OpenProposal[],
  nowMs: number,
  token: string | null,
  material: ReadonlyMap<string, string>,
): string {
  return section(
    `waiting for your answer (${String(waiting.length + open.length)})`,
    "",
    waiting
      .map((record) =>
        lapHtml(
          record,
          `${record.status} -- waiting ${ago(record.updatedAtMs, nowMs)}`,
          [unblockedBy(record), spentLine(record), fenceLine(record)],
          approveHtml(record, token, material.get(record.id) ?? ""),
        ),
      )
      .join("") +
      open
        .map(
          (proposal) =>
            `<div class="lap"><p class="basis">read it back with its options and ` +
            `what each rests on: rondo show --proposal-id ${escapeHtml(proposal.proposalId)}</p>` +
            `<p class="head">${escapeHtml(
              `${proposal.kind} -- waiting ${ago(proposal.createdAtMs, nowMs)}`,
            )}</p>` +
            `<p class="line">${escapeHtml(
              proposal.iterationId === null
                ? "about no iteration"
                : `about '${proposal.iterationId}'`,
            )}</p></div>`,
        )
        .join(""),
  );
}

/**
 * *What is running* -- every live lap that is not waiting on anybody.
 *
 * The line under each is {@link whereItRuns}: the transcript directory continuo
 * is writing into and the workspace to `ls`. That is what rondo holds about a
 * lap in flight -- it names a place and claims no liveness (D-0048 rule 3) --
 * and it is what an operator asking *is this progressing* can actually open.
 *
 * A live row that will not decode is here rather than missing, for the inbox's
 * reason: it holds a slot, so leaving it out would understate what is running.
 */
function runningHtml(
  running: readonly IterationRecord[],
  unreadable: readonly LiveRow[],
  transcripts: ReadonlyMap<string, TranscriptLocation>,
  nowMs: number,
): string {
  return section(
    `running now (${String(running.length + unreadable.length)})`,
    "",
    running
      .map((record) =>
        lapHtml(record, `${record.status} -- running ${ago(record.updatedAtMs, nowMs)}`, [
          whereItRuns(record, transcripts.get(record.id)),
          spentLine(record),
          fenceLine(record),
        ]),
      )
      .join("") +
      unreadable
        .map((row) =>
          row.kind === "unreadable"
            ? `<div class="lap"><p class="head">${escapeHtml(row.id)}</p>` +
              `<p class="line">${escapeHtml(`will not decode: ${row.reason}`)}</p></div>`
            : "",
        )
        .join(""),
  );
}

/** *What just finished* -- the last few endings, newest first (rondo#145). */
function endedHtml(ended: readonly IterationRecord[], nowMs: number): string {
  return section(
    `just finished (${String(ended.length)})`,
    "",
    ended
      .map((record) =>
        lapHtml(record, endedHow(record, nowMs), [spentLine(record), fenceLine(record)]),
      )
      .join(""),
  );
}

/**
 * The one line an idle store gets, in place of nine ways of saying zero
 * (rondo#145).
 *
 * **Its basis is the reading below, and the reading is on this page.** The
 * three questions are answered off two reads -- every live row and every ended
 * row -- and the locators for what those reads found (`snapshot /laps`,
 * `snapshot /refusals`, and the rest) are in the fold, cited there exactly as
 * they were before. So nothing is asserted here without a basis; what changed
 * is that the basis is cited once for the three claims instead of once per
 * phrasing of zero.
 */
function nothingHtml(): string {
  return (
    `<section><p class="nothing">Nothing is waiting on you, nothing is running, and ` +
    `nothing has finished.</p>` +
    `<p class="basis">every live row and every ended row in this ledger; the reading below ` +
    `cites what each read found</p></section>`
  );
}

/** The inbox section: the same lines `rondo inbox` prints, and no mark moved. */
function inboxHtml(ports: WebPorts, snapshot: InboxSnapshot | null): string {
  if (snapshot === null || ports.actorId === null) {
    return section(
      "the inbox",
      "RONDO_APPROVER is not set, so there is no identity whose inbox this would be.",
      "",
    );
  }
  return section(
    "the inbox",
    "Reading this does not move your last-look mark: that is what rondo inbox does.",
    `<pre>${escapeHtml(inboxLines(ports.actorId, snapshot).join("\n"))}</pre>`,
  );
}

/** The between-laps section: `rondo between`'s composition, unrecorded. */
function betweenHtml(snapshot: HostSnapshot): string {
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

/** One iteration, explained the way `rondo explain` explains it. */
function explainHtml(record: IterationRecord, snapshot: AdvisorySnapshot): string {
  return section(
    `iteration '${record.id}'`,
    "This explanation binds nothing: it is not a proposal and cannot be approved.",
    claimsHtml(propose(snapshot).payload.claims, snapshot),
  );
}

/**
 * The work a press would approve over, or nothing when there is no press.
 *
 * Read only for the rows that carry a button: it shells out to `git` in the
 * caller, and a page that redraws every five seconds must not inspect every
 * workspace it can see each time it does.
 */
async function materialFor(
  ports: WebPorts,
  waiting: readonly IterationRecord[],
): Promise<ReadonlyMap<string, string>> {
  const material = new Map<string, string>();
  if (ports.material === null) {
    return material;
  }
  for (const record of waiting) {
    if (record.status === "awaiting_human" && record.gateId !== null) {
      const lines = await ports.material(record);
      material.set(record.id, `<pre class="material">${escapeHtml(lines.join("\n"))}</pre>`);
    }
  }
  return material;
}

/**
 * The laps that have ended, newest first and only the last few (rondo#145).
 *
 * **An ended row that will not decode is dropped here and nowhere else.** The
 * live side shows one, because it holds a slot and understating what is running
 * misleads the one reader deciding whether to start something else; an ended row
 * holds nothing and asks nothing, and it has no `updated_at_ms` to place in a
 * "just finished" list at all. It stays in the ledger and `rondo explain` still
 * refuses it by name.
 */
function endedRecently(outcomes: readonly ReadOutcome[]): readonly IterationRecord[] {
  return outcomes
    .flatMap((outcome) => (outcome.kind === "read" ? [outcome.record] : []))
    .sort((left, right) => right.updatedAtMs - left.updatedAtMs)
    .slice(0, RECENT_ENDED);
}

/**
 * The whole page: the three questions an operator arrives with, and then the
 * reading the answers rest on (rondo#145).
 *
 * **The order is the argument, and it is the operator's rather than rondo's.**
 * What is on the screen first is what needs them, then what is running, then
 * what just ended -- which is `inbox`'s own order carried to the surface a
 * person actually looks at, and not the order `inbox`, `between` and `explain`
 * happen to be laid out in. rondo's own vocabulary -- bounds, adjacency,
 * last-look marks, a field-by-field reading of every row -- is one `<details>`
 * below, unchanged and complete.
 *
 * **Folded is not hidden** (D-0032). Every claim that was on this page before
 * is still on it, under the same basis, in the same words; what moved is which
 * of them an operator has to read past to answer *does anything need me*. The
 * lead cites the row each of its lines is read off, once, and the reading below
 * cites the field -- so a number in the lead is checkable twice over rather
 * than asserted once.
 *
 * **Nothing here writes** (D-0041). Every read above is a read, the `<details>`
 * is a browser's own element and carries no script, and the only thing on the
 * page that can produce anything but a `GET` is still the one form.
 */
export async function operatorPage(ports: WebPorts, token: string | null = null): Promise<string> {
  const nowMs = ports.now();
  const host = await gatherHost(ports);
  const inbox = ports.actorId === null ? null : await gatherInbox(ports, ports.actorId);
  const live: LiveRow[] = (await ports.store.readLive()).flatMap((outcome): LiveRow[] => {
    switch (outcome.kind) {
      case "read":
        return [{ kind: "read", record: outcome.record }];
      case "unreadable":
        return [{ kind: "unreadable", id: outcome.id, reason: outcome.reason }];
      default:
        return [];
    }
  });
  const ended = endedRecently(await ports.store.terminalIterations());
  const waiting: IterationRecord[] = [];
  const running: IterationRecord[] = [];
  for (const row of live) {
    if (row.kind !== "read") {
      continue;
    }
    const side = isTerminal(row.record.status)
      ? null
      : WAIT_SIDE[row.record.status as NonTerminalStatus];
    (side === "waitingOnYou" ? waiting : running).push(row.record);
  }
  const unreadable = live.filter((row) => row.kind === "unreadable");
  const open = inbox?.open ?? [];
  // Reused rather than asked again when the inbox already asked: it is a
  // continuo subprocess per running lap, and this page redraws itself.
  const transcripts = inbox?.transcripts ?? (await locateRunning(ports, live));

  const lead =
    waiting.length + running.length + ended.length + open.length + unreadable.length === 0
      ? nothingHtml()
      : [
          waitingHtml(
            waiting,
            open,
            nowMs,
            ports.answer === null ? null : token,
            await materialFor(ports, waiting),
          ),
          runningHtml(running, unreadable, transcripts, nowMs),
          endedHtml(ended, nowMs),
        ].join("\n");

  const reading = [
    inboxHtml(ports, inbox),
    betweenHtml(host),
    ...(await Promise.all(
      [...waiting, ...running, ...ended].map(async (record) =>
        explainHtml(record, gather(record, await ports.store.readingsFor(record.id))),
      ),
    )),
    ...unreadable.map((row) =>
      row.kind === "unreadable"
        ? section(
            `iteration '${row.id}'`,
            "",
            `<pre>will not decode: ${escapeHtml(row.reason)}</pre>`,
          )
        : "",
    ),
  ].join("\n");

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
.group, .lap { border-left: 2px solid currentColor; margin: .75rem 0; padding-left: .75rem; }
.basis { font-size: .85rem; }
.head { font-weight: 600; margin: .25rem 0; }
.request, .line { margin: .25rem 0; white-space: pre-wrap; word-break: break-word; }
.nothing { margin: .25rem 0; }
.claim { display: grid; grid-template-columns: minmax(9rem, 14rem) 1fr; gap: .75rem; margin: .25rem 0; }
.label { opacity: .7; }
.approve { align-items: center; display: flex; flex-wrap: wrap; gap: .75rem; margin: .75rem 0 0; }
.approve button { font: inherit; padding: .4rem 1.2rem; }
.approve .note { margin: 0; }
.material { margin: .75rem 0 0; opacity: .85; }
.value { white-space: pre-wrap; word-break: break-word; }
.reading { border-top: 1px solid currentColor; margin-top: 2rem; padding-top: .75rem; }
.reading summary { cursor: pointer; opacity: .7; }
@media (max-width: 40rem) { .claim { grid-template-columns: 1fr; gap: 0; } }
</style>
</head>
<body>
<h1>rondo</h1>
<p class="note">Redraws every ${String(REFRESH_SECONDS)}s, and a redraw writes nothing: no last-look
mark moves and no presentation is counted. The one thing that writes is the approve button, which
records the explanation you pressed on and then answers the gate.</p>
${lead}
<details class="reading">
<summary>the reading these rest on: every claim with its basis, and rondo's own accounting</summary>
${reading}
</details>
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
