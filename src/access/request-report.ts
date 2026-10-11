/**
 * One report per request (DECISIONS.md D-0064 P5, rondo#630): once every part
 * of a request's approved split has ended, rondo writes one message into the
 * request's thread saying what came of each part, what was left undone and
 * what it decided without asking. Not once per lap: the per-lap reports stay
 * shut under their event lines (`D-0112`), and this is the one that rolls them up.
 *
 * **Deterministic, and once.** It is composed from rows by code, never by a
 * model, and its id is the split's (`request-report-<proposal>`), so a second
 * pass, a second process or a restart finds it spoken for. A split drafted
 * again is a new proposal and gets its own report when its parts end.
 *
 * **Its bases are the request, the split, and each part's line** (its first
 * lap), so the page leads from the report to every part it speaks of.
 *
 * **It asks nothing** (`asks` unset): P5 does not wait on the person.
 *
 * **Both sides say it.** The host writes it in its operator's language, and
 * the page says it again from the parts as they read now, in the language of
 * whoever is looking (`requestReportView`), as a flow's stop is (rondo#549).
 */

import type { Basis } from "../advisory/proposal.js";
import type { IterationRecord, ThreadMessageDraft } from "../store/records.js";
import type { AdvisoryRecord, IterationStore } from "../store/sqlite.js";
import { DETERMINISTIC_DRAFTER } from "./advisory.js";
import { partsOf } from "./drafted-start.js";
import { GATE_ACTOR } from "./gate-host.js";
import type { PartOutcome } from "./page/report-words.js";
import { type PartView, partReadsOver, partViews } from "./page-logic/parts.js";
import { threadsOf } from "./page-logic/threads.js";
import type { Chrome } from "./wording.js";

const REPORT_PREFIX = "request-report-";

/** The report's id: one per approved split. */
export const requestReportId = (proposalId: string): string => `${REPORT_PREFIX}${proposalId}`;

/** Whether a message is a request's report (by its voice and its id). */
export function isRequestReport(message: {
  readonly messageId: string;
  readonly authorId: string;
}): boolean {
  return message.authorId === DETERMINISTIC_DRAFTER && message.messageId.startsWith(REPORT_PREFIX);
}

/**
 * Whether every part has ended: merged, or stopped (a stop, a pull request
 * closed unmerged, or a part the person dropped). A part approved and not yet
 * merged has not: its publish or its merge on green may still come, and a
 * report written before it would say less than what came of it.
 */
export function everyPartEnded(views: readonly PartView[]): boolean {
  return (
    views.length > 0 &&
    views.every((view) => view.standing === "merged" || view.standing === "stopped")
  );
}

/**
 * The scope exits among a request's thread messages (`D-0064` rule 3.3): each
 * stop rondo wrote at the edge of the approved scope (`stopTheLine`'s
 * `scope-stop-` ask), whatever the person then answered.
 */
export function scopeExits(thread: readonly ThreadMessageDraft[]): number {
  return thread.filter(
    (m) => m.authorId === DETERMINISTIC_DRAFTER && m.asks && m.messageId.startsWith("scope-stop-"),
  ).length;
}

/** The report's words from the parts and the thread's scope exits, in `words`' language. */
export function requestReportText(
  words: Chrome,
  views: readonly PartView[],
  exits: number,
): string {
  const outcomes = views.map((view): PartOutcome & { readonly byRondo: number } => ({
    part: words.partName(view.index + 1),
    standing: view.standing === "merged" ? "merged" : "stopped",
    pullRequest: view.pullRequest === null ? null : words.pullRequest(view.pullRequest.number),
    tries: view.laps.length,
    spent: view.laps.every((lap) => lap.lapCostUsd === null)
      ? null
      : view.laps.reduce((sum, lap) => sum + (lap.lapCostUsd ?? 0), 0).toFixed(2),
    unread: view.laps.filter((lap) => lap.lapCostUsd === null).length,
    byRondo: view.laps.filter(answeredByRondo).length,
  }));
  const count = (standing: PartOutcome["standing"]) =>
    outcomes.filter((o) => o.standing === standing).length;
  const byRondo = outcomes.reduce((sum, o) => sum + o.byRondo, 0);
  const undone = outcomes.filter((o) => o.standing === "stopped").map((o) => o.part);
  return [
    words.reportLead(count("merged"), count("stopped")),
    ...outcomes.map((o) => `- ${words.reportPart(o)}`),
    ...(undone.length === 0 ? [] : [words.reportUndone(undone)]),
    ...(byRondo === 0 ? [] : [words.reportByRondo(byRondo)]),
    ...(exits === 0 ? [] : [words.reportScopeExits(exits)]),
    words.reportAsksNothing,
  ].join("\n");
}

/** A gate rondo answered itself (D-0125, D-0145): decided without asking. */
const answeredByRondo = (lap: IterationRecord): boolean => lap.gateAnswerActor === GATE_ACTOR;

export interface RequestReportPorts {
  readonly store: Parameters<typeof partsOf>[0]["store"] &
    Pick<IterationStore, "laneLedger" | "readLive" | "terminalIterations">;
  readonly record: Parameters<typeof partsOf>[0]["record"] &
    Pick<AdvisoryRecord, "threadMessages" | "recordThreadMessage">;
  /** The host's operator language: what is written is read by the person. */
  readonly words: Chrome;
  readonly now: () => number;
  readonly log: (line: string) => void;
}

/**
 * Write the report of every request whose parts have all ended and that has
 * none yet. Read on the resident host's minute; one request's failure costs
 * that request. Returns the ids written, for tests.
 */
export async function writeRequestReports(ports: RequestReportPorts): Promise<readonly string[]> {
  const read = await ports.record.threadMessages();
  if (read.kind !== "read") {
    throw new Error(`the thread will not read: ${read.reason}`);
  }
  const threads = threadsOf(read.messages, new Set(), new Map());
  const laps = [...(await ports.store.readLive()), ...(await ports.store.terminalIterations())]
    .flatMap((o) => (o.kind === "read" ? [o.record] : []))
    .map((lap) => [lap.id, lap] as const);
  const lapById = new Map(laps);
  const ledger = await ports.store.laneLedger();
  const written: string[] = [];
  for (const root of read.messages.filter((m) => m.inReplyTo === null)) {
    try {
      const parts = await partsOf(ports, root.messageId);
      const proposalId = parts[0]?.proposalId;
      if (proposalId === undefined || threads.byId.has(requestReportId(proposalId))) {
        continue;
      }
      // The laps were read before the parts: a part started in between, or a
      // lap its line gained since, is not in the snapshot, and would read as
      // stopped. Wait for the next pass rather than report work still running.
      const unread = parts.some(
        (part) =>
          part.lineageId !== null &&
          [
            part.lineageId,
            ...(ledger.find((line) => line.lineageId === part.lineageId)?.lapIds ?? []),
          ].some((id) => !lapById.has(id)),
      );
      if (unread) {
        continue;
      }
      const views = partViews(
        parts,
        partReadsOver(threads, ledger, lapById, root.messageId, parts, () => null),
      );
      if (!everyPartEnded(views)) {
        continue;
      }
      const bases: Basis[] = [
        { form: "message", messageId: root.messageId },
        { form: "proposal", proposalId },
        ...views.flatMap((view): Basis[] => {
          const first = view.laps[0];
          return first === undefined ? [] : [{ form: "iteration", iterationId: first.id }];
        }),
      ];
      const outcome = await ports.record.recordThreadMessage({
        messageId: requestReportId(proposalId),
        body: requestReportText(
          ports.words,
          views,
          scopeExits(read.messages.filter((m) => threads.rootOf(m.messageId) === root.messageId)),
        ),
        authorKind: "drafter",
        authorId: DETERMINISTIC_DRAFTER,
        inReplyTo: root.messageId,
        atMs: ports.now(),
        bases,
        asks: false,
      });
      if (outcome.kind === "recorded") {
        written.push(requestReportId(proposalId));
        ports.log(`report   the request's report is in its thread (${proposalId})`);
      } else if (outcome.kind !== "duplicate") {
        ports.log(`report   ${proposalId}: not written: ${outcome.reason}`);
      }
    } catch (error) {
      ports.log(
        `report   ${root.messageId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return written;
}
