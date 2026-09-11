/**
 * The operator's inbox: what is waiting on you, what is running, what changed
 * since you last looked, and what you were not shown (#41, D-0036).
 *
 * **A surface and not a fourth record design.** Every number here is read off
 * rows that already exist -- `D-0032` rule 9's mark, rule 10's attention table,
 * rule 11's `changedSince`, rule 6's decisions -- and nothing composed here is
 * stored, because a framing that outlives the material it was drawn from can
 * drift from it silently (rule 3). What *is* written is the two things the act
 * of looking creates: the presentations (rule 10) and the mark (rule 9).
 *
 * **The order of the screen is an argument.** What is waiting on the operator
 * comes first because it is the only part they can act on; what is running
 * comes second because it tells them whether waiting is the right thing to do;
 * what changed comes third because #41 section 4 says the property that matters
 * after a gap is recovering context rather than responsiveness; and the
 * accounting comes last because it is about rondo rather than about the work.
 *
 * **`D-0036` rule 2 is why no duration is stored.** *"This has been waiting on
 * you since 09:14"* is a subtraction over rows that already exist, and a column
 * would be a second home for a computed fact.
 */
import {
  type AttentionCount,
  type IterationRecord,
  isApprovableKind,
  isTerminal,
  type NonTerminalStatus,
  type OpenProposal,
  type RecordChange,
  type UnconsumedDecision,
  WAIT_SIDE,
} from "../store/records.js";
import type { AdvisoryRecord, IterationStore } from "../store/sqlite.js";
import { PROPOSAL_SUBJECT } from "./advisory.js";

/** Everything the inbox is handed: two ports over the store, a clock, a screen. */
export interface InboxPorts {
  readonly store: IterationStore;
  readonly record: AdvisoryRecord;
  readonly present: (lines: readonly string[]) => void;
  readonly now: () => number;
}

/**
 * What one look did, or the ways its own bookkeeping fell short.
 *
 * **There is no refusal.** Every read here is total -- a row that will not
 * decode is a line saying so rather than an empty screen -- so the only thing
 * that can go wrong is a write, and a write that failed after the operator has
 * already read the screen is not a refusal of anything. It is the surface
 * saying that its own accounting is short, which is `explain`'s
 * `presentedUncounted` arm generalised to the two rows a look writes.
 */
export type InboxOutcome =
  | { readonly kind: "shown"; readonly atMs: number }
  | {
      readonly kind: "shownIncomplete";
      readonly atMs: number;
      readonly reasons: readonly string[];
    };

/** How long ago, as a person reads it. */
function ago(atMs: number, nowMs: number): string {
  const seconds = Math.max(0, Math.round((nowMs - atMs) / 1000));
  if (seconds < 60) {
    return `${String(seconds)}s`;
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${String(minutes)}m`;
  }
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${String(hours)}h` : `${String(Math.round(hours / 24))}d`;
}

/** One live iteration, or the fact that one of them will not decode. */
export type LiveRow =
  | { readonly kind: "read"; readonly record: IterationRecord }
  | { readonly kind: "unreadable"; readonly id: string; readonly reason: string };

/**
 * Everything one look read, gathered before anything is rendered.
 *
 * A value rather than a sequence of calls inside the renderer, for
 * `src/advisory/`'s reason applied one layer out: the screen is then a pure
 * function of what was read, and a test can hand it a world instead of a
 * database.
 */
export interface InboxSnapshot {
  /** The bound this look used, sampled **before** the first read (rule 9). */
  readonly atMs: number;
  /** Where this actor's reading stopped, or null if they have never looked. */
  readonly sinceMs: number | null;
  readonly live: readonly LiveRow[];
  readonly open: readonly OpenProposal[];
  readonly changed: readonly RecordChange[];
  readonly attention: readonly AttentionCount[];
  readonly unspent: readonly UnconsumedDecision[];
}

/**
 * Which side of the wait a live row is on, or null if it is not a wait.
 *
 * The lookup is {@link WAIT_SIDE}, exhaustive over the non-terminal statuses by
 * type (D-0036 rule 5). A terminal row reaching here would be a `readLive` that
 * stopped filtering, so it is dropped rather than guessed at.
 */
function waitSide(record: IterationRecord): "waitingOnYou" | "inFlight" | null {
  return isTerminal(record.status) ? null : WAIT_SIDE[record.status as NonTerminalStatus];
}

/** Every live row on one side of the partition, readable ones only. */
function onSide(snapshot: InboxSnapshot, side: "waitingOnYou" | "inFlight"): IterationRecord[] {
  return snapshot.live.flatMap((row) =>
    row.kind === "read" && waitSide(row.record) === side ? [row.record] : [],
  );
}

/** The ids of every record of one kind that landed at or after the mark. */
function changedIds(changed: readonly RecordChange[], kind: string): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const change of changed) {
    if (change.kind === kind && change.id !== null) {
      ids.add(change.id);
    }
  }
  return ids;
}

/** `  NEW` on a row the operator has not seen, and nothing on one they have. */
function newMark(seen: ReadonlySet<string>, id: string, sinceMs: number | null): string {
  return sinceMs !== null && seen.has(id) ? "  NEW" : "";
}

function proposalLines(
  proposals: readonly OpenProposal[],
  snapshot: InboxSnapshot,
  seen: ReadonlySet<string>,
): readonly string[] {
  return proposals.map((proposal) => {
    const about =
      proposal.iterationId === null ? "about no iteration" : `about '${proposal.iterationId}'`;
    return (
      `    ${proposal.proposalId}  ${proposal.kind}  ${about}  ` +
      `waiting ${ago(proposal.createdAtMs, snapshot.atMs)}` +
      newMark(seen, proposal.proposalId, snapshot.sinceMs)
    );
  });
}

/**
 * The two voices, separated by **authority and by nothing else** (#41
 * section 2, D-0032 rule 5).
 *
 * The test is {@link isApprovableKind}, which reads the closed set the compiler
 * checks against `PROPOSAL_KINDS` -- never the drafter (D-0022 rule 13 makes
 * the record identical whichever produced it) and never anybody's prose.
 * Rendering both as the same kind of line would erase the difference exactly
 * where it decides what an approval means, which is why they are two sections
 * with two headings and not one list with a badge.
 */
/**
 * What actually releases one waiting row, and why it is not read off `gate_id`
 * alone.
 *
 * **The status decides, and the gate id is context.** Two of the three waiting
 * statuses suspend at a named continuo gate, and `rondo answer` releases them.
 * `stalled` does not -- the interpreter's own words are *"a person must decide
 * and there is no gate to observe"* -- and `stall()` changes the status without
 * clearing `gate_id`, so a stalled row can still be carrying the gate it
 * suspended at. Offering that gate as the recovery would send an operator to
 * answer something `resume()` no longer observes, which is a line that reads
 * like help and costs a round trip in exactly the state that already needs a
 * person. The id is still printed, because it is where the row stopped.
 */
function unblockedBy(record: IterationRecord): string {
  if (record.status === "stalled") {
    return record.gateId === null
      ? "no gate: a person has to decide"
      : `no gate answer releases this (stopped at ${record.gateId}): a person has to decide`;
  }
  return record.gateId === null
    ? "suspended with no gate id recorded: rondo cannot name the gate"
    : `answer gate ${record.gateId}`;
}

function waitingOnYouLines(snapshot: InboxSnapshot): readonly string[] {
  const seenProposals = changedIds(snapshot.changed, "proposal");
  const seenIterations = changedIds(snapshot.changed, "iteration");
  const binding = snapshot.open.filter((proposal) => isApprovableKind(proposal.kind));
  const nonBinding = snapshot.open.filter((proposal) => !isApprovableKind(proposal.kind));
  const waiting = onSide(snapshot, "waitingOnYou");
  return [
    "waiting on you",
    `  proposals that become contracts when you approve them (${String(binding.length)})`,
    ...proposalLines(binding, snapshot, seenProposals),
    `  proposals that bind nothing (${String(nonBinding.length)})`,
    ...proposalLines(nonBinding, snapshot, seenProposals),
    // **The verb that makes one of those lines answerable** (#39). The list
    // above is ids and kinds; what a person answers is the option set, its
    // bases and what approving forecloses, and that screen is one command away
    // rather than in the scrollback of whoever drafted it.
    ...(snapshot.open.length === 0
      ? []
      : [
          "    read one back, with its options and what each rests on: rondo show --proposal-id ID",
        ]),
    `  iterations waiting on you (${String(waiting.length)})`,
    ...waiting.map(
      (record) =>
        `    ${record.id}  ${record.status}  ${ago(record.updatedAtMs, snapshot.atMs)}  ` +
        unblockedBy(record) +
        newMark(seenIterations, record.id, snapshot.sinceMs),
    ),
  ];
}

function inFlightLines(snapshot: InboxSnapshot): readonly string[] {
  const running = onSide(snapshot, "inFlight");
  const unreadable = snapshot.live.filter((row) => row.kind === "unreadable");
  return [
    // **The count is of the rows printed below it, undecodable ones
    // included.** A live row rondo cannot read still holds a slot, so leaving
    // it out of the number would report capacity that is not there -- to the
    // one reader who has to decide whether to start something else.
    `in flight (${String(running.length + unreadable.length)})`,
    ...running.map(
      (record) => `  ${record.id}  ${record.status}  ${ago(record.updatedAtMs, snapshot.atMs)}`,
    ),
    // **A row that will not decode is on the screen rather than missing from
    // it.** It is live -- it holds a slot -- and an inbox that dropped it
    // silently would be wrong about what is running in exactly the case where a
    // person has to intervene.
    ...unreadable.flatMap((row) =>
      row.kind === "unreadable" ? [`  ${row.id}  will not decode: ${row.reason}`] : [],
    ),
  ];
}

/**
 * What changed since the mark, as a census and then as the rows themselves.
 *
 * **Inclusive of the bound, and the duplication is deliberate** (D-0032
 * rule 11): a row bearing exactly the mark may or may not have been displayed
 * last time, and showing something twice is the failure this accepts in order
 * not to lose something for ever.
 */
function changedLines(snapshot: InboxSnapshot): readonly string[] {
  if (snapshot.sinceMs === null) {
    // **A first look reports no diff rather than the whole ledger.**
    // "Everything is new" is true and useless; what a first look owes the
    // operator is the two sections above, and the mark it writes is what makes
    // the next one a diff.
    return ["since your last look", "  you have never looked: nothing below is marked new"];
  }
  const census = new Map<string, number>();
  for (const change of snapshot.changed) {
    census.set(change.kind, (census.get(change.kind) ?? 0) + 1);
  }
  return [
    `since your last look ${ago(snapshot.sinceMs, snapshot.atMs)} ago ` +
      `(${String(snapshot.changed.length)} records)`,
    census.size === 0
      ? "  nothing"
      : `  ${[...census].map(([kind, count]) => `${kind} ${String(count)}`).join(", ")}`,
    ...snapshot.changed.map(
      (change) =>
        `    ${change.kind}  ${change.id ?? "(no id)"}  ${ago(change.atMs, snapshot.atMs)} ago`,
    ),
  ];
}

/**
 * The silence, as #40 asked for it: what was put to you and what was not.
 *
 * **Both sides out of one table** (D-0032 rule 10), and the withheld side is
 * broken down by the rule that withheld it, because *"suppressed 40"* is a
 * number where *"suppressed 40, of which 31 by the duplicate-delivery rule"* is
 * a record. Nothing in this tree withholds anything yet, so that side reads
 * zero -- which is the honest answer rather than a missing section.
 */
function silenceLines(snapshot: InboxSnapshot): readonly string[] {
  const total = (disposition: string): number =>
    snapshot.attention
      .filter((row) => row.disposition === disposition)
      .reduce((sum, row) => sum + row.count, 0);
  return [
    "what was put to you and what was not",
    `  presented ${String(total("presented"))}, withheld ${String(total("withheld"))}`,
    ...snapshot.attention.flatMap((row) =>
      row.disposition === "withheld"
        ? [`    withheld by '${row.ruleName ?? "(unnamed)"}' ${String(row.count)}`]
        : [],
    ),
  ];
}

/** Approvals nobody has spent (D-0022 rule 19). */
function unspentLines(snapshot: InboxSnapshot): readonly string[] {
  return [
    `approved and never spent (${String(snapshot.unspent.length)})`,
    ...snapshot.unspent.map(
      (decision) =>
        `  ${decision.decisionId}  proposal ${decision.proposalId}  ${decision.approved}  ` +
        `by '${decision.actorId}' ${ago(decision.decidedAtMs, snapshot.atMs)} ago`,
    ),
  ];
}

/**
 * One look, composed at render time out of what was read (D-0032 rule 3).
 *
 * Pure and total: the same snapshot gives the same lines, and every section is
 * emitted even when its count is zero -- a section that disappeared when empty
 * would make "nothing is waiting on you" and "rondo did not look" the same
 * screen, which is the distinction `UNDETERMINED` exists for one layer down.
 */
export function inboxLines(actorId: string, snapshot: InboxSnapshot): readonly string[] {
  return [
    `inbox for '${actorId}'`,
    ...waitingOnYouLines(snapshot),
    "",
    ...inFlightLines(snapshot),
    "",
    ...changedLines(snapshot),
    "",
    ...silenceLines(snapshot),
    "",
    ...unspentLines(snapshot),
  ];
}

/**
 * Show one operator what is waiting, and write down that they looked.
 *
 * **The order is the property D-0036 rule 9 fixes, and it is why this function
 * reads a clock before it reads a row:**
 *
 *  1. sample the bound (`now()`), before anything is read;
 *  2. read the mark, and everything the screen is made of;
 *  3. render;
 *  4. count what was presented (rule 10, once per subject);
 *  5. write the mark (rule 9), last.
 *
 * Sampling at the end instead would lose every row committed while the render
 * was running -- silently and for ever, because the next look asks for changes
 * *after* the mark. Sampling first accepts the opposite failure: a row that
 * landed during the render is shown again next time. D-0032 rule 11 names that
 * trade and takes this side of it.
 *
 * **The bound is applied to the read this look writes about, and deliberately
 * not to the rest.** `openProposals(atMs)` is bounded because each of its rows
 * becomes an `operator_attention` row stamped `atMs`, and a presentation
 * recorded before its subject existed is a row no clock explains. The display
 * reads are left unbounded on purpose: bounding `readLive` would *hide* an
 * iteration that started between the sample and the read, and a live row
 * missing from "in flight" understates what is running to the one reader
 * deciding whether to start something else -- which is the failure the
 * undecodable-row line exists to prevent, arriving by a different door. Those
 * rows are shown early and shown again next look, which is rule 11's accepted
 * duplicate.
 */
export async function showInbox(ports: InboxPorts, actorId: string): Promise<InboxOutcome> {
  const atMs = ports.now();
  const sinceMs = await ports.record.lastView(actorId);
  const live = (await ports.store.readLive()).flatMap((outcome): LiveRow[] => {
    switch (outcome.kind) {
      case "read":
        return [{ kind: "read", record: outcome.record }];
      case "unreadable":
        return [{ kind: "unreadable", id: outcome.id, reason: outcome.reason }];
      default:
        return [];
    }
  });
  const snapshot: InboxSnapshot = {
    atMs,
    sinceMs,
    live,
    // **Bounded here and nowhere else, on purpose** -- see this function's
    // note: this is the read the look writes about, and the display reads
    // stay unbounded so that nothing live is hidden from the screen. Making
    // the four agree would be tidier and wrong.
    open: await ports.record.openProposals(atMs),
    changed: sinceMs === null ? [] : await ports.record.changedSince(sinceMs),
    attention: await ports.record.attentionBreakdown(),
    unspent: await ports.record.unconsumedDecisions(),
  };
  ports.present(inboxLines(actorId, snapshot));

  const reasons: string[] = [];
  // **The inbox is the second writer of `operator_attention`, and D-0036
  // rule 1 is what makes that safe.** A presentation is counted once per
  // subject and not once per render, so a proposal looked at twenty times over
  // a morning is one row: the second write stores nothing and reports success,
  // and the ratio #40 asked for stays a count of subjects on both sides.
  for (const proposal of snapshot.open) {
    const counted = await ports.record.recordAttention({
      atMs,
      subjectKind: PROPOSAL_SUBJECT,
      subjectId: proposal.proposalId,
      disposition: "presented",
      // Null because this surface withholds nothing: it shows every open
      // proposal, with no cap and no paging, so there is no policy to name. The
      // withheld side belongs to whatever decides what an operator does *not*
      // see, which #40 says nothing owns yet.
      ruleName: null,
    });
    if (counted.kind !== "recorded") {
      reasons.push(`'${proposal.proposalId}' was not counted as presented: ${counted.reason}`);
    }
  }
  const marked = await ports.record.recordView(actorId, atMs);
  if (marked.kind !== "recorded") {
    reasons.push(
      `your last look was not moved to ${String(atMs)}: ${marked.reason}. The next inbox will ` +
        "report the same changes again",
    );
  }
  return reasons.length === 0
    ? { kind: "shown", atMs }
    : { kind: "shownIncomplete", atMs, reasons };
}
