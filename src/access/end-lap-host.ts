/**
 * The page's end press (rondo#655): a lap only a person can end -- stalled,
 * held by a start that threw, or a row that will not decode -- ended with their
 * reason, as `rondo abandon` ends one from a terminal.
 *
 * **A row that decodes ends `failed` with the kind `ended`**, not `abandoned`:
 * that is what gives back its held money and lets the lost-lap pass start it
 * again on the person's *carry on* (D-0139). A row that will not decode can
 * only be settled by id (`abandon`), and its *carry on* has rondo plan the
 * request again. Either way the line's slot and files are released by the
 * same write, and the thread then asks whether to carry on, change or stop --
 * unless the stop a start that threw asked is already standing, which is then
 * this lap's stop.
 */
import type { AdvisoryRecord, IterationStore } from "../store/sqlite.js";
import { DETERMINISTIC_DRAFTER } from "./advisory.js";
import { approvedActor, say } from "./cli.js";
import { abandon, endLost } from "./conductor.js";
import type { Ended, EndInput } from "./line-ports.js";
import { endedOnThePage, lostAskId } from "./lost-laps.js";
import { endableRow } from "./page-logic/end-lap.js";
import type { Chrome } from "./wording.js";

export async function endLapFromPage(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  record: Pick<AdvisoryRecord, "threadMessages" | "recordThreadMessage">,
  words: Chrome,
  approver: string,
  input: EndInput,
): Promise<Ended> {
  const actor = approvedActor(approver, environment);
  if ("refusal" in actor) {
    return { ok: false, why: "endRefusedNotRecorded", note: actor.refusal };
  }
  const thread = await record.threadMessages();
  if (thread.kind !== "read") {
    return { ok: false, why: "endRefusedNotRecorded", note: thread.reason };
  }
  const messageIds = new Set(thread.messages.map((message) => message.messageId));
  // Asked again here, over fresh rows: a screen drawn before the lap moved on
  // or was ended ends nothing.
  const row = await endableRow(store, input.iterationId, messageIds);
  if (row === null) {
    return {
      ok: false,
      why: "endRefusedChanged",
      note: `lap '${input.iterationId}' is not one only a person can end now`,
    };
  }
  const reason = endedOnThePage(input.reason, actor.actorId);
  const ports = { store, now: Date.now };
  const status =
    row.kind === "read"
      ? await endLost(ports, input.iterationId, reason, "ended")
      : (await abandon(ports, input.iterationId, reason)).status;
  if (status !== (row.kind === "read" ? "failed" : "abandoned")) {
    return {
      ok: false,
      why: "endRefusedNotRecorded",
      note: `lap '${input.iterationId}' is still '${status ?? "unread"}': rondo is driving it, or the store refused the write`,
    };
  }
  // A terminal row answers its status unwritten: a press that lost the race to
  // the lost-lap pass, or to another press, must not say this reason ended it.
  if (row.kind === "read" && !(await endedWith(store, input.iterationId, reason))) {
    return {
      ok: false,
      why: "endRefusedChanged",
      note: `lap '${input.iterationId}' was ended by something else first`,
    };
  }
  say(`Ended lap '${input.iterationId}' on a press from the page: ${reason}`);
  // What `rondo abandon` tells of what may still be open upstream: a stalled
  // lap can hold a gate, and closing it is a person's (D-0013, D-0010).
  if (row.kind === "read" && row.record.gateId !== null) {
    say(
      `A gate may still be open: ${row.record.gateId}. Closing it is a person's, through 'gate close'.`,
    );
  }
  if (row.kind === "read" && row.record.identifiersSpent !== 0) {
    say(
      `A run may still be open under id ${row.record.runId ?? "(unrecorded)"}; 'gate list' shows whether a gate exists for it.`,
    );
  }
  const requestMessageId = row.kind === "read" ? row.record.requestMessageId : row.requestMessageId;
  // The stop a start that threw asked is this lap's stop -- unless it was
  // answered while the lap was held, and so cannot be answered for the ending.
  const startStopped = `start-stopped-${input.iterationId}`;
  const standing =
    messageIds.has(startStopped) &&
    !thread.messages.some((m) => m.inReplyTo === startStopped && m.authorKind === "operator");
  if (requestMessageId !== null && !standing) {
    const told = await record.recordThreadMessage({
      messageId: lostAskId(input.iterationId),
      body:
        row.kind === "read"
          ? words.lapEndedAsk(input.reason)
          : words.lapEndedUnreadableAsk(input.reason),
      authorKind: "drafter",
      authorId: DETERMINISTIC_DRAFTER,
      inReplyTo: requestMessageId,
      atMs: Date.now(),
      bases: [
        { form: "message", messageId: requestMessageId },
        { form: "iteration", iterationId: input.iterationId },
      ],
      asks: true,
    });
    // The lap is ended either way; the lost-lap pass writes a missing ask over
    // a lap that decodes, and the console says the rest.
    if (told.kind !== "recorded" && told.kind !== "duplicate") {
      say(`The thread was not told that lap '${input.iterationId}' was ended: ${told.reason}`);
    }
  }
  return { ok: true, requestMessageId };
}

async function endedWith(store: IterationStore, iterationId: string, reason: string) {
  const after = await store.read(iterationId);
  return (
    after.kind === "read" &&
    after.record.failureKind === "ended" &&
    (after.record.reason ?? "").includes(reason)
  );
}
