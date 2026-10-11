/**
 * The notes a request's thread draws in place of a message's own words: the
 * forge's read of an issue, a drafter run that drafted nothing, a lap report
 * kept shut, a scope's stop and a flow's stop, and the predicates that pick
 * each one out (rondo#341 moved them out of `src/access/web.tsx`).
 */
import {
  FLOW_AUTHOR,
  FLOW_AUTHOR_PREFIX,
  type ThreadMessageDraft,
  WORKER_QUESTION_AUTHOR,
} from "../../store/records.js";
import { DETERMINISTIC_DRAFTER } from "../advisory.js";
import { type FlowStopFacts, flowStopBody } from "../flow-stop.js";
import { type IssueComment, parseForgeRead } from "../issue-read.js";
import { isModelDrafterName, REDRAFT_AUTHOR } from "../model-draft/judgement.js";
import type { PartView } from "../page-logic/parts.js";
import type { Threads } from "../page-logic/threads.js";
import {
  everyPartEnded,
  requestReportId,
  requestReportText,
  scopeExits,
} from "../request-report.js";
import { stopRaises } from "../scope.js";
import type { Chrome } from "../wording.js";
import { held } from "./gate-material.js";
import type { HeldReads } from "./held.js";
import { chevron, issueNameLink } from "./vocabulary.js";
import { LAP_REPORT_KINDS, type LapReportKind } from "./words.js";

/**
 * What rondo read of one issue (D-0078 sections 4.1 and 4.2): the name as a
 * link, one line, and the words in a fold -- the forge's text as it came, or
 * rondo's own reason, closed (D-0076 rule 4.5). Nothing to press.
 */
export function forgeView(wording: Chrome, message: ThreadMessageDraft) {
  const read = parseForgeRead(message.body);
  if (read === null) {
    return (
      <p class="body wrap-anywhere whitespace-pre-wrap" lang="">
        {message.body}
      </p>
    );
  }
  if ("failed" in read) {
    return (
      <div class="issue-read space-y-2" data-issue="not-read">
        <p class="text-body leading-6">
          {issueNameLink(read)} {wording.issueNotRead(read.failed.why)} {wording.issueNotReadTail}
        </p>
        <details class="group">
          <summary class="flex cursor-pointer list-none items-center gap-2 text-meta leading-5 text-muted-foreground select-none [&::-webkit-details-marker]:hidden">
            {chevron()}
            {wording.drafterNoDraftWhy}
          </summary>
          <p
            class="mt-1 text-meta leading-5 wrap-anywhere whitespace-pre-wrap text-muted-foreground"
            lang="en"
          >
            {read.failed.detail}
          </p>
        </details>
      </div>
    );
  }
  const issue = read.read;
  return (
    <div class="issue-read space-y-2" data-issue="read">
      <p class="text-body leading-6">
        {issueNameLink(read)}{" "}
        <span class="font-medium" lang="">
          {issue.title}
        </span>
      </p>
      <p class="text-meta leading-5 text-muted-foreground">
        {wording.issueRead(issue.pullRequest, issue.comments.length)}
      </p>
      <details class="group">
        <summary class="flex cursor-pointer list-none items-center gap-2 text-meta leading-5 text-muted-foreground select-none [&::-webkit-details-marker]:hidden">
          {chevron()}
          {wording.issueReadFold}
        </summary>
        {/* The forge's words as it returned them: no trim, no reflow (D-0022 rule 4). */}
        <div class="mt-1 space-y-2 text-meta leading-5" lang="">
          <p class="text-faint">
            {issue.author} · {issue.openedAt} · {issue.state}
          </p>
          <p class="wrap-anywhere whitespace-pre-wrap">{issue.body}</p>
          {issue.comments.map((c: IssueComment) => (
            <div class="border-t border-border/60 pt-2">
              <p class="text-faint">
                {c.author} · {c.at}
              </p>
              <p class="wrap-anywhere whitespace-pre-wrap">{c.body}</p>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

/**
 * Whether a message is a model drafter run that drafted nothing (D-0071 rule
 * 1.5): the drafter's voice, a model drafter's name, and no `proposal:` basis --
 * every run that wrote a draft rests its messages on the proposal row it wrote
 * (rule 7.3), so the absence is structural and not read off the words.
 */
export function noDraft(message: ThreadMessageDraft): boolean {
  return (
    message.authorKind === "drafter" &&
    isModelDrafterName(message.authorId) &&
    !message.bases.some((basis) => basis["form"] === "proposal")
  );
}

/** rondo's note that a refused draft is drafted once more (rondo#554, D-0160). */
export function redraftNote(message: ThreadMessageDraft): boolean {
  return message.authorKind === "drafter" && message.authorId === REDRAFT_AUTHOR;
}

/**
 * **A drafter run that drafted nothing, said as what happened** (rondo#238):
 * the row's words are rondo's own about its tools, so they are kept, folded,
 * and what is shown first is what happened. What the person can do -- set the
 * scope themselves -- is the thread's next step, drawn once at its top
 * (rondo#375) rather than a second time here.
 */
export function noDraftView(wording: Chrome, message: ThreadMessageDraft, reads: HeldReads | null) {
  return (
    <div class="space-y-2">
      <p class="text-body leading-6">
        {redraftNote(message) ? wording.drafterRedrafted : wording.drafterNoDraft}
      </p>
      <details class="group">
        <summary class="flex cursor-pointer list-none items-center gap-2 text-meta leading-5 text-muted-foreground select-none [&::-webkit-details-marker]:hidden">
          {chevron()}
          {wording.drafterNoDraftWhy}
        </summary>
        {held(
          wording,
          reads,
          message.body,
          "body mt-1 text-meta leading-5 wrap-anywhere whitespace-pre-wrap text-muted-foreground",
          () => (
            <p
              class="body mt-1 text-meta leading-5 wrap-anywhere whitespace-pre-wrap text-muted-foreground"
              lang="en"
            >
              {message.body}
            </p>
          ),
        )}
      </details>
    </div>
  );
}

/**
 * Whether a message is one of rondo's own reports on a lap (`writeReport` in
 * `conductor.ts`): the deterministic drafter's voice and a `report-` id.
 */
export function lapReport(message: ThreadMessageDraft): boolean {
  return message.authorId === DETERMINISTIC_DRAFTER && message.messageId.startsWith("report-");
}

/**
 * **A lap report, shut** (rondo#437, D-0112): the report is rondo's record in
 * English with its ids, and each one already has its line in the person's
 * words beside it (the event lines and the result strip). So nothing of it is
 * drawn open, in any language -- no id reaches the screen (D-0076) -- and it is
 * kept, byte for byte, under the fold `evBrokeReason` labels.
 */
export function lapReportView(
  wording: Chrome,
  message: ThreadMessageDraft,
  reads: HeldReads | null,
) {
  // **Never an empty card** (rondo#506): one line in the person's language
  // says what the shut record is about, from the kind its id names.
  const named = message.messageId.slice("report-".length).split("-")[0] ?? "";
  const kind = (LAP_REPORT_KINDS as readonly string[]).includes(named)
    ? (named as LapReportKind)
    : "other";
  return (
    <div class="space-y-2">
      <p class="text-body leading-6">{wording.lapReportSaid(kind)}</p>
      <details class="group">
        <summary class="flex cursor-pointer list-none items-center gap-2 text-meta leading-5 text-muted-foreground select-none [&::-webkit-details-marker]:hidden">
          {chevron()}
          {wording.evBrokeReason}
        </summary>
        {held(
          wording,
          reads,
          message.body,
          "body mt-1 text-meta leading-5 wrap-anywhere whitespace-pre-wrap text-muted-foreground",
          () => (
            <p
              class="body mt-1 text-meta leading-5 wrap-anywhere whitespace-pre-wrap text-muted-foreground"
              lang="en"
            >
              {message.body}
            </p>
          ),
        )}
      </details>
    </div>
  );
}

/**
 * Whether a message is in English words a worker or the flow wrote for the
 * person (rondo#490): a worker's question, and the flow's asks. rondo does not
 * read the words to find their language (D-0055 rule 8); it knows these by who
 * wrote them.
 */
export function heldMessage(message: ThreadMessageDraft): boolean {
  return (
    message.authorKind === "drafter" &&
    (message.authorId === WORKER_QUESTION_AUTHOR ||
      (message.authorId ?? "").startsWith(FLOW_AUTHOR_PREFIX))
  );
}

/**
 * Whether a message is the stop a scope's verdict wrote into a request's
 * thread (`stopTheLine` in `scope.ts`): the deterministic drafter's voice, a
 * `scope-stop-` id and `asks` set.
 */
export function scopeStop(message: ThreadMessageDraft): boolean {
  return (
    message.authorId === DETERMINISTIC_DRAFTER &&
    message.messageId.startsWith("scope-stop-") &&
    message.asks
  );
}

/**
 * **A scope stop, as its three options** (D-0072, D-0128 rondo#471): the row
 * is rondo's record in English with ids and a digest, so what is drawn open
 * is what happened and what the person can do -- a successor scope, a change
 * to the work, or stopping -- each with the press it comes to and what it
 * gives up, in the person's language. The record is kept, byte for byte,
 * under the fold, recommendation included.
 */
export function scopeStopView(
  wording: Chrome,
  message: ThreadMessageDraft,
  reads: HeldReads | null,
) {
  // More room is approved by raising the budget at the lap's gate (D-0074),
  // which the stop does not lift; the other two options are the answering
  // presses below. No link: the request's scope screen holds while a question
  // waits (rondo#431), so it cannot approve a successor now.
  // A redo's stop names the lap it stopped (an `iteration` basis), which is
  // waiting with its gate; a first admission's names none, and has no budget
  // to raise yet (Codex round 2).
  const atLap = message.bases.some((basis) => basis["form"] === "iteration");
  const options = [
    [
      wording.scopeStopWider,
      !atLap
        ? wording.scopeStopWiderNoLap
        : // The answering box raises rounds and cost itself (rondo#512); the
          // expiry and the laps are raised on the gate's own screen.
          stopRaises(message.body) !== null
          ? wording.scopeStopWiderDoes
          : wording.scopeStopWiderAtGate,
    ],
    [wording.scopeStopChange, wording.scopeStopChangeDoes],
    [wording.scopeStopStop, wording.scopeStopStopDoes],
  ] as const;
  return (
    <div class="space-y-2">
      <p class="text-body leading-6">{wording.scopeStopLead}</p>
      <p class="text-meta leading-5 font-medium text-muted-foreground">
        {wording.scopeStopOptions}
      </p>
      <ol class="space-y-1.5">
        {options.map(([option, does], at) => (
          <li class="flex gap-2 text-body leading-6">
            <span class="w-4 shrink-0 text-right text-faint tabular-nums">{`${String(at + 1)}.`}</span>
            <span class="min-w-0">
              <b class="font-semibold">{option}</b>
              <span class="block text-meta leading-5 text-muted-foreground">{does}</span>
            </span>
          </li>
        ))}
      </ol>
      <details class="group">
        <summary class="flex cursor-pointer list-none items-center gap-2 text-meta leading-5 text-muted-foreground select-none [&::-webkit-details-marker]:hidden">
          {chevron()}
          {wording.evBrokeReason}
        </summary>
        {held(
          wording,
          reads,
          message.body,
          "body mt-1 text-meta leading-5 wrap-anywhere whitespace-pre-wrap text-muted-foreground",
          () => (
            <p
              class="body mt-1 text-meta leading-5 wrap-anywhere whitespace-pre-wrap text-muted-foreground"
              lang="en"
            >
              {message.body}
            </p>
          ),
        )}
      </details>
    </div>
  );
}

/**
 * Whether a message is the stop the flow asked in a request's thread
 * (`askStop` in `flow-host.ts`): the flow's own voice, a `flow-stop-` id and
 * `asks` set.
 */
export function flowStopAsked(message: ThreadMessageDraft): boolean {
  return (
    message.authorId === FLOW_AUTHOR && message.messageId.startsWith("flow-stop-") && message.asks
  );
}

/**
 * **A flow's stop, said again to whoever is reading it** (rondo#549).
 *
 * The flow stops on the minute, outside any request to the page, so the host
 * had to pick a language when it wrote the ask and picked its own operator's
 * (D-0079). That is the machine's setting, and the person in front of the page
 * chose theirs -- `?lang`, the language cookie, the browser (D-0055). So the
 * stop is composed again here from the facts the host kept beside the ask, by
 * the one composer both sides use (`flowStopBody`), and what is drawn is the
 * person's own words rather than the host's.
 *
 * The ask as it was written stays under the fold, byte for byte, as the scope
 * stop's record does -- and is left out where it is the same text, because a
 * host and a reader who share a language would otherwise read it twice.
 */
export function flowStopView(
  wording: Chrome,
  message: ThreadMessageDraft,
  stop: { readonly facts: FlowStopFacts; readonly repository: string },
) {
  const said = flowStopBody(wording, stop.repository, stop.facts);
  return (
    <div class="space-y-2">
      <p class="body text-body leading-6 wrap-anywhere whitespace-pre-wrap" lang={wording.lang}>
        {said}
      </p>
      {said === message.body ? null : (
        <details class="group">
          <summary class="flex cursor-pointer list-none items-center gap-2 text-meta leading-5 text-muted-foreground select-none [&::-webkit-details-marker]:hidden">
            {chevron()}
            {wording.evBrokeReason}
          </summary>
          <p
            class="body mt-1 text-meta leading-5 wrap-anywhere whitespace-pre-wrap text-muted-foreground"
            lang=""
          >
            {message.body}
          </p>
        </details>
      )}
    </div>
  );
}

/** Whether this request's latest model drafter run drafted nothing (rondo#495 item 2). */
export function draftedNothing(threads: Threads, requestMessageId: string): boolean {
  const runs = threads.messages.filter(
    (message) =>
      message.authorKind === "drafter" &&
      isModelDrafterName(message.authorId) &&
      threads.rootOf(message.messageId) === requestMessageId,
  );
  const latest = runs.at(-1);
  return latest !== undefined && noDraft(latest);
}

/**
 * **A request's report, said again to whoever is reading it** (D-0064 P5,
 * rondo#630): composed from the request's parts as they read now, by the one
 * composer the host wrote it with, in the reader's language. Where the parts
 * no longer read as all ended -- a part tried again after the report -- or
 * the request was split again since, the words as written are drawn instead. The report as written stays under the
 * fold where it says something else, as a flow's stop does.
 */
export function requestReportView(
  wording: Chrome,
  message: ThreadMessageDraft,
  views: readonly PartView[],
  thread: readonly ThreadMessageDraft[],
) {
  // Only from the split the report is about: a request split again has
  // other parts now, and an earlier report keeps the words it was written with.
  const own = views[0] !== undefined && message.messageId === requestReportId(views[0].proposalId);
  const said =
    own && everyPartEnded(views)
      ? requestReportText(wording, views, scopeExits(thread))
      : message.body;
  return (
    <div class="space-y-2" data-report="">
      <p class="body text-body leading-6 wrap-anywhere whitespace-pre-wrap" lang={wording.lang}>
        {said}
      </p>
      {said === message.body ? null : (
        <details class="group">
          <summary class="flex cursor-pointer list-none items-center gap-2 text-meta leading-5 text-muted-foreground select-none [&::-webkit-details-marker]:hidden">
            {chevron()}
            {wording.evBrokeReason}
          </summary>
          <p
            class="body mt-1 text-meta leading-5 wrap-anywhere whitespace-pre-wrap text-muted-foreground"
            lang=""
          >
            {message.body}
          </p>
        </details>
      )}
    </div>
  );
}
