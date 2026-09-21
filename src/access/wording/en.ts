/**
 * The English set of rondo's own prose, a whole {@link Chrome} (D-0079). The
 * type and the selection among sets are in `src/access/wording.ts`.
 */

import { APPROVED_OUTCOME, READING_COVERAGE } from "../../store/records.js";
import { PAGE_EN } from "../page/words.js";
import type { AgentTypeSource, Chrome } from "../wording.js";

/** The three sources as English, for the {@link EN} set's three lines about them. */
function agentTypeSourceEn(from: AgentTypeSource): string {
  switch (from) {
    case "iteration":
      return "a lap's plan";
    case "scope":
      return "a plan recorded for a scope";
    default:
      return "the plan this scope records";
  }
}

function scopeTestEn(test: string): string {
  switch (test) {
    case "decision":
      return "the scope has not been approved";
    case "superseded":
      return "a newer scope replaced this one";
    case "request":
      return "the scope does not cover this request";
    case "workspace":
      return "the scope does not cover the place this plan runs";
    case "agent_type":
      return "the scope does not allow this plan's agent type";
    case "contract":
      return "the plan needs more than its agent type is allowed";
    case "irreversible":
      return "the plan would do something the scope keeps back as irreversible";
    case "expiry":
      return "the scope has expired";
    case "laps":
      return "the scope's laps are used up";
    case "cost":
      return "the scope's cost budget has no room left for another lap, counting what laps not yet read are held at";
    case "asks":
      return "a question in the request's thread holds this work back; the thread shows which";
    case "grants":
      return "the plan would be allowed more than the lap it follows";
    case "readings":
      return "the scope's review rounds are used up";
    default:
      return `the scope's ${test} test says no`;
  }
}

/**
 * What a model review raised, counted, as the {@link EN} set says it.
 *
 * Spelled once because two sentences carry it since rondo#237 -- the line by
 * the gate's button, and the ended row of a lap approved over it -- and two
 * spellings of one count is the page disagreeing with itself about what was
 * open. The counts are never both zero at a call site: neither sentence is
 * composed when nothing was raised.
 */
/**
 * The files one piece of work holds, as the person knows them: their own
 * repository's paths, shown as themselves (D-0076 rule 2.3), or the whole
 * repository where that is what is held.
 */
function filesEn(paths: readonly string[]): string {
  return paths.includes("/") ? "the whole repository" : paths.join(", ");
}

function raisedEn(blockers: number, majors: number): string {
  return [
    blockers === 0 ? "" : `${String(blockers)} blocker${blockers === 1 ? "" : "s"}`,
    majors === 0 ? "" : `${String(majors)} major`,
  ]
    .filter((part) => part !== "")
    .join(" and ");
}

/** The three measurements a basis names, in {@link EN}'s words. */
const EN_MEASURE: Record<string, string> = {
  first_lap_cost: "first-lap cost",
  redo_cost: "cost of doing a lap again",
  lap_duration: "lap duration",
};

/**
 * The strings as they were before D-0055, moved and not rewritten.
 *
 * This is also the fallback every other set is merged over, and the set the
 * terminal is handed unconditionally (rule 10).
 */
export const EN: Chrome = Object.freeze({
  // The rebuilt page's half of the catalogue (D-0083), kept beside the faces
  // that say it. Spread rather than re-declared, so `satisfies Chrome` below
  // still fails on a word this set is missing.
  ...PAGE_EN,
  lang: "en",

  liveNote: (seconds) =>
    `Redraws every ${String(seconds)}s, and a redraw writes nothing: no last-look
mark moves and no presentation is counted. The one thing that writes is the approve button, which
records the explanation you pressed on and then answers the gate.`,
  stillNote: `This view does not update itself: what a press records is the framing you are
reading, so it holds still while you read it. Reading it writes nothing -- no last-look mark moves
and no presentation is counted. The one thing that writes is the approve button, which records the
explanation you pressed on and then answers the gate.`,
  noApproverNote:
    "RONDO_APPROVER is not set, so there is nobody this page could answer as, and no inbox of " +
    "theirs to draw.",

  endedHead: (status, since, why) => `${status} ${since} ago -- ${why}`,
  gateAnswered: (outcome) =>
    outcome === APPROVED_OUTCOME ? "approved at the gate" : `gate answered '${outcome}'`,
  statePill: (status, gateOutcome) =>
    (
      ({
        awaiting_human: "Waiting on you",
        withdrawal_requested: "Withdrawal asked",
        stalled: "Stalled",
        planned: "Starting",
        classified: "Starting",
        admitting: "Starting",
        admitted: "Starting",
        performing: "Running",
        closed:
          gateOutcome === "approve" || gateOutcome === APPROVED_OUTCOME
            ? "Approved"
            : gateOutcome === "revise"
              ? "Revised"
              : gateOutcome === null
                ? "Closed"
                : `Closed: ${gateOutcome}`,
        abandoned: "Abandoned",
        failed: "Failed",
      }) as Record<string, string | undefined>
    )[status] ?? status,
  noReasonRecorded: "no reason recorded",
  aboutIteration: (iterationId) =>
    iterationId === null ? "about no iteration" : `about '${iterationId}'`,
  willNotDecode: (reason) => `will not decode: ${reason}`,

  spent: (cost, turns, took) => `${cost}, ${turns}, ${took}`,
  fenceUnknown: "the fence: continuo could not tell what it refused",
  fenceRefusedNothing: "the fence refused nothing",
  fenceRefused: (denials) => `the fence refused ${denials}`,

  pressNote: "What pressing approve records as shown, and what it would be over:",
  approveNote: (gateId, word) =>
    `answers gate ${gateId} as '${word}', which is what rondo answer does`,
  approvePlain: "Accept this work as it is.",
  approveFace: "approve",
  approveDespite: "approve despite what was raised",
  approveDespitePlain:
    "Accept this work as it is, with what the model review raised left unanswered.",
  undeterminedFold: (count) =>
    `${String(count)} ${count === 1 ? "field" : "fields"} rondo could not determine`,

  requestsNav: "Requests",
  asksWaiting: (count) =>
    `${String(count)} ${count === 1 ? "question" : "questions"} waiting on you`,
  askWaitingPill: "Waiting on you",
  askStoppedPill: "You stopped this line",
  answerStoppedPill: "Stopped this line",
  answerCarriedOnPill: "Carried on",
  you: "you",
  drafterNoDraft:
    "rondo could not draft this request, so nothing has been proposed. You can set the scope " +
    "yourself.",
  drafterNoDraftWhy: "What stopped it",
  issueRead: (pullRequest, comments) =>
    `rondo read this ${pullRequest ? "pull request's conversation" : "issue"}` +
    `${comments === 0 ? "" : ` and its ${String(comments)} ${comments === 1 ? "comment" : "comments"}`}` +
    ". The worker will be given all of it, as written.",
  issueReadFold: "What was read",
  issueNotRead: (why) =>
    ({
      no_gh: "rondo on this machine cannot read issues yet",
      signed_out: "rondo on this machine cannot read issues yet",
      no_repo: "rondo on this machine does not know which repository this number is in",
      missing: "This issue could not be found, or your account cannot see it",
      refused: "The forge refused your account access to this issue",
      too_long: "This issue is too long to hand over whole, and none of it was handed over",
      too_many: "rondo reads at most five issues from one message, and this one was past them",
      failed: "rondo could not read this issue",
    })[why] + ", so the worker will have only what you wrote here.",
  issueNotReadTail:
    "Nothing was spent. If the issue says something your request does not, say it in another " +
    "message.",
  issuePending: "rondo has not read this yet. It reads it while rondo is running here.",
  scopeIssuesHeading: "Issues named in this request",
  scopeIssueGiven: "given to the worker",
  scopeIssueNotGiven: "not given: it could not be read",
  scopeIssuePending: "not read yet",
  scopeDoneHeading: "Definition of done (rondo adds it to every lap)",
  scopeDoneAsks: [
    "Commit the work on this lap's branch.",
    "Before reporting, run the repository's own install and verification.",
    "If the verification cannot run or does not pass, say so, and never say it passed.",
  ],
  scopeDoneRules: (files) => `The worker is told to follow the repository's ${files.join(", ")}.`,
  scopeDoneNoRules:
    "This plan names no rule file of the repository, so the worker looks for its steps in the repository's own documents.",
  scopeDoneExact: "The words the worker is sent",
  inReplyTo: (who, words) => `in reply to ${who}: ${words}`,
  basesLabel: "rests on",
  replyAction: "Reply",
  replyingTo: (who, since) => `Replying to ${who}, ${since} ago`,
  answeringTo: (who, since) => `Answering ${who}'s question, ${since} ago`,
  answerAskAction: "Answer",
  answerCarryOnAction: "Carry on",
  answerStopAction: "Stop this line",
  answerOutcomeNote:
    "Sent as written. Carry on lets the work be tried again; Stop this line keeps it stopped, " +
    "and you can carry on later.",
  newRequestHeading: "New request",
  requestPlaceholder: "What do you want done? Write it as you would say it.",
  replyPlaceholder: "Write a reply.",
  sendAction: "Send",
  sendNote: "Sent as written. To correct it, reply again.",
  keySend: "send",
  composerNoApprover:
    "RONDO_APPROVER is not set, so there is nobody this page could send as: the threads can be read, not written to.",
  evOfTry: (at, said) => `Try ${String(at)}: ${said}`,
  walkAt: (at, of) => `your turn ${String(at)} / ${String(of)}`,
  walkNext: "next",
  govSpent: (spent, approved) => `$${spent} of $${approved}`,
  govTries: (at, of) => `try ${String(at)} of ${String(of)}`,
  chainAnswer: "your answer",
  chainProposal: "pull request",
  chainMerge: "merge",
  noSuchThread: "No request thread holds that message.",
  threadsUnreadable: (reason) => `The request threads could not be read: ${reason}`,
  notSent: (line) => `Not sent, and your words are kept: ${line}`,
  sendRefusedNoApprover: "RONDO_APPROVER is not set, so there is nobody this page could send as.",
  sendRefusedForm:
    "This did not come from this page's own form, or the page is older than this rondo. Reload the page and send again.",
  sendRefusedNoWords: "There are no words to send.",
  sendRefusedNotTaken:
    "The conversation did not record this message; the message it replies to may not be in the thread. Reload the thread and try again.",
  sendRefusedAsk:
    "That message is a question still waiting on your answer. Open its thread and press Answer.",
  sendRefusedTooLong:
    "That message is longer than this page accepts. Shorten it, or split it into two replies.",
  sendRefusedUnknown: "rondo did not take this message. Reload the page and send again.",
  answerRefusedPress:
    "An answer is taken only from a press of the Answer button. Reload the thread and press Answer again.",
  replyNotAnswer: "This reply does not answer the question waiting in this thread.",
  sendBack: "Back to the thread",
  sendBackNote: "Your browser's Back button returns to what you wrote.",
  threadsLiveNote: (seconds) =>
    `Redraws every ${String(seconds)}s, and a redraw writes nothing. What writes here is Send: ` +
    "your words, recorded exactly as written into the thread, under RONDO_APPROVER's name. A message approves nothing.",
  liveShort: (seconds) => `Live, updates every ${String(seconds)}s`,
  stillShort: "Holds still while you read",
  age: (ago) => ago,
  waitingCount: (count) => `${String(count)} waiting`,
  signedInAs: (actorId) => `You send and answer as ${actorId}`,
  replyDefault: "Reply to the latest message instead",
  blockedCount: (count) => `blocked ${String(count)} command${count === 1 ? "" : "s"}`,
  blockedNothing: "blocked nothing",
  blockedUnknown: "not known what was blocked",
  fenceHeading: "The fence:",
  whyStopped: "Why it stopped",
  whyNotRead: "The worker's own account could not be read; it is in the text below if it was.",
  workHeading: "What changed",
  changedAgainst: (baseRef) => `against ${baseRef}`,
  changedUnreadable:
    "The workspace could not be read, so what this work changed cannot be shown here. Whoever " +
    "maintains rondo on this machine can check whether the workspace is still there.",
  changedNoRange: "This run names no branch to compare, so there is nothing to list.",
  noCommits: "No commits on the branch.",
  noFiles: "No files changed.",
  binaryFile: "binary",
  moreRows: (count) => `and ${String(count)} more`,
  reachHeading: "Beyond the files this work keeps",
  reachCollided: (paths) =>
    `This work changed ${filesEn(paths)}, which other work is keeping to itself. Both are ` +
    "changing the same files, so the two changes will clash when they are merged. Look at the " +
    "other work before you approve this one.",
  reachUnheld: (paths) =>
    `This work changed ${filesEn(paths)}, which is outside the files it said it would keep. ` +
    "Nothing else is keeping them, so nothing is blocked; the files it keeps were left as they " +
    "were, because widening that is yours to decide.",
  reachUnread:
    "rondo could not compare what this work changed with the files it keeps, so it cannot say " +
    "whether anything here also belongs to other work.",
  checksHeading: "Checks",
  modelHeading: "Model review",
  verdictPill: (verdict, count) =>
    verdict === "clear"
      ? "nothing raised"
      : verdict === "concerns"
        ? `${String(count)} raised`
        : verdict === "unavailable"
          ? "not taken"
          : verdict,
  checksNone: "No check of this work was recorded. Publishing will ask you to confirm that.",
  checksCounted: (commits, files) =>
    `Read ${String(commits)} commit${commits === 1 ? "" : "s"} and ${String(files)} file${files === 1 ? "" : "s"}.`,
  whatItRead: "What it read, and what it did not",
  // A reach this build does not know says its reach is not recorded, as an
  // unknown drafter does, rather than guessing at it.
  readingCovered: (reach) => (READING_COVERAGE[reach] ?? READING_COVERAGE.unrecorded).join(" "),
  basisNone: "no basis given",
  basisUnresolved: "none of these matched the delivered work",
  modelPending: "Not here yet; it may still arrive.",
  modelOlder: "This one is about earlier commits. A reading of the current ones may still arrive.",
  reloadPage: "Reload",
  readingsNote:
    "Both readings are material for you to weigh. Neither approves anything; the answer is yours.",
  allAsText: "The full record as text, including what is not shown above",
  claimLabel: "What you checked (recorded with your approval)",
  claimPlaceholder: "e.g. ran the tests locally; read the diff; opened the page on a phone",
  claimTooLong: (max) =>
    `What you said you checked is longer than the ${String(max)} characters this page takes. Shorten it and press approve again.`,
  claimGateUnread:
    "rondo could not read this gate, so what you said you checked was not recorded. Go back to the gate and try again.",
  claimGateClosed:
    "This gate was already answered, so what you said you checked was not recorded. Go back to the gate to see how it ended.",
  claimNotRecorded:
    "rondo could not record what you said you checked, so nothing was answered. Go back to the gate and try again.",
  claimHostSetup:
    "rondo on this machine cannot record what you said you checked, so nothing was answered and " +
    "nothing was spent. Setup here has not finished, or has stopped working, so pressing approve " +
    "again will answer nothing either; whoever set rondo up on this machine can see why.",
  answerNotDone: "Nothing was answered",
  gateBack: "Back to the gate",
  modelRaised: (blockers, majors) => `The model review raised ${raisedEn(blockers, majors)}.`,
  modelRaisedLink: "Read it",
  severityWord: (severity) => severity,
  severityCount: (severity, count) => `${String(count)} ${severity}`,
  readingNotTaken: "No reading could be taken, so there is nothing from it to weigh.",
  whyNotTaken: "Why",
  checksWorkUnreadable:
    "What changed cannot be read now, so this reading cannot be matched against the work.",
  checksNotMatched: "not matched",
  modelNotTaken: "Only the checks read this; the model review was not taken.",
  neitherReadingTaken: "Neither the checks nor the model review could read this work.",
  recordsFold: (count) => `What approve records (${String(count)} fields), and the full text`,
  denialUnreadable: "rondo could not record which command this was.",
  modelMayArrive: "The model review may still arrive.",
  reachYourTurn: "rondo is waiting for your answer.",
  reachLate: "Something in rondo has been going longer than it was meant to.",
  chimeAsk: "Tell me here when it is my turn",
  liveLabel: "live",
  keyMove: "move",
  keyOpen: "open",
  keyBack: "back",
  keyWrite: "write",
  textSizeLabel: "Text size",
  textSizes: ["Standard text", "Large text", "Larger text"],

  inboxNote: "Reading this does not move your last-look mark: that is what rondo inbox does.",

  inboxFor: (actorId) => `inbox for '${actorId}'`,
  waitingOnYou: "waiting on you",
  bindingProposals: (count) =>
    `  proposals that become contracts when you approve them (${String(count)})`,
  nonBindingProposals: (count) => `  proposals that bind nothing (${String(count)})`,
  readOneBack:
    "    read one back, with its options and what each rests on: rondo show --proposal-id ID",
  iterationsWaiting: (count) => `  iterations waiting on you (${String(count)})`,
  newMark: "  NEW",
  proposalLine: (proposalId, kind, about, waited) =>
    `    ${proposalId}  ${kind}  ${about}  waiting ${waited}`,
  waitingLine: (iterationId, status, waited, unblockedBy) =>
    `    ${iterationId}  ${status}  ${waited}  ${unblockedBy}`,
  inFlightHeading: (count) => `in flight (${String(count)})`,
  inFlightLine: (iterationId, status, since, where) =>
    `  ${iterationId}  ${status}  ${since}  ${where}`,
  unreadableLine: (id, reason) => `  ${id}  will not decode: ${reason}`,
  changedHeading: (since, records) =>
    `since your last look ${since} ago (${String(records)} records)`,
  changedHeadingNever: "since your last look",
  neverLooked: "  you have never looked: nothing below is marked new",
  nothingChanged: "  nothing",
  censusEntry: (kind, count) => `${kind} ${String(count)}`,
  changeLine: (kind, id, since) => `    ${kind}  ${id ?? "(no id)"}  ${since} ago`,
  silenceHeading: "what was put to you and what was not",
  countedLine: (what, presented, withheld) =>
    `${what}: presented ${String(presented)}, withheld ${String(withheld)}`,
  overAllTime: "over all of time",
  sinceLastLook: (since) => `since your last look ${since} ago`,
  neverLookedSince: "  since your last look: you have never looked",
  withheldBy: (ruleName, count) => `withheld by '${ruleName}' ${String(count)}`,
  unnamedRule: "(unnamed)",
  unspentHeading: (count) => `approved and never spent (${String(count)})`,
  unspentLine: (decisionId, proposalId, approved, actorId, since) =>
    `  ${decisionId}  proposal ${proposalId}  ${approved}  by '${actorId}' ${since} ago`,

  noGateDecide: "no gate: a person has to decide",
  noGateReleases: (gateId) =>
    `no gate answer releases this (stopped at ${gateId}): a person has to decide`,
  suspendedNoGate: "suspended with no gate id recorded: rondo cannot name the gate",
  answerGate: (gateId) => `answer gate ${gateId}`,
  runsIn: (transcript, workspace) => `${transcript}  in ${workspace}`,
  noWorkspace: "(no workspace on the row)",
  transcriptNotLookedFor: "transcript (not looked for on a row that has not started one)",
  transcriptNotNamed: (reason) => `transcript (not named: ${reason})`,
  transcriptAt: (directory, sessions) =>
    `transcript ${directory}${sessions > 1 ? `  (newest of ${String(sessions)} sessions)` : ""}`,

  declarationCaveat: Object.freeze([
    "This is the run's own declaration, not the whole fence: continuo renders the",
    "role's template into the same allow list, and rondo does not read that here.",
  ]),
  secondFence: Object.freeze([
    "The worker's own sandbox is a second containment, and rondo does not observe",
    "it: it can fail to start without refusing anything, so a lap that ran with it",
    "disabled prints here exactly like one that did not. The worker's own account",
    "at the gate is the only place that has ever reported it (D-0050).",
  ]),

  scopeAction: "Set the scope",
  scopeHeading: "The scope for this request",
  backToThread: "Back to the request",
  scopeLead:
    "You write this scope. The plan is one rondo holds, and the numbers were worked out from " +
    "the laps this store has recorded. Read it, change what you want to change, and one press " +
    "records it and approves it.",
  scopeNoPlanHeld:
    "rondo has no plan to run this on: its setup on this machine has not given it one yet.",
  scopePlansUnread: (reason) =>
    `The plans rondo holds could not be read, so there is nothing to choose from: ${reason}`,
  scopePlanAsk: "Which plan the work runs on",
  scopePlanGone:
    "The plan chosen on this screen is no longer one rondo offers for this request. Choose one " +
    "of these instead.",
  scopePlanFrom: (from) =>
    from === "message"
      ? "pasted into this thread"
      : from === "setup"
        ? "from setting up this machine"
        : "the plan earlier laps ran on",
  scopePlanLine: (where, agentType, from) => `${where}, agent type ${agentType} (${from})`,
  scopePlanHeldAt: (line, at) => `${line}, held since ${at} UTC`,
  scopeDraftedLead:
    "rondo drafted this scope for your request: the work below, and budgets worked out from the " +
    "laps this store has recorded. Approve it as it is, or change a value first -- your version " +
    "is then recorded in place of rondo's draft.",
  scopeDraftedPlansHeading: "What rondo proposes to run",
  scopeDraftedPlan: (n) => `Plan ${String(n)}`,
  scopeDraftedTemplateGone: "The plan this was drafted from is no longer one rondo holds.",
  scopeNarrowed: (computed) =>
    `rondo lowered this from ${computed} because of what you wrote here:`,
  scopeNarrowedStricter: "rondo made this stricter than major because of what you wrote here:",
  scopeNarrowedAdded: "rondo added this because of what you wrote here:",
  scopeRedrafted:
    "rondo drafted again after the scope above was approved. The new draft is below; approving " +
    "it adds a second scope for this request, and the one above stays as it is.",
  scopeDraftedAction: "Approve",
  scopeDraftedPlain: "Approves this scope, or your changed version of it",
  scopeDraftedPressNote:
    "One press approves. If you changed a value, rondo records your version in place of its " +
    "draft and approves that. Approving spends nothing: every lap is tested against it when it " +
    "starts.",
  planStartAction: "Start this plan",
  planStartPlain: "Starts one lap on this plan, counted against the scope you approved",
  planStarted: "Started.",
  planStartedLink: "Open the lap",
  planBusy: (limit) =>
    limit === 1
      ? "No room yet: this host runs one lap at a time, and one is running. The start button " +
        "appears here once that lap reaches its gate."
      : `No room yet: this host runs ${String(limit)} laps at a time, and all of them are ` +
        "running. The start button appears here once one of them reaches its gate.",
  planFull: (live, limit) =>
    `No room yet: ${String(live)} laps are open, as many as this host allows ` +
    `(${String(limit)}). The start button appears here once one of them ends.`,
  planOutside: (test) => `Cannot start: ${scopeTestEn(test)}.`,
  planUnrunnable:
    "This plan can no longer run. Reply in the request's thread to have it drafted again.",
  planUnrunnableWhy: "What stops it",
  planUndecidable: "rondo could not check this plan against the scope just now.",
  scopeNoPlanForScope:
    "rondo holds no plan for the place and the agent type this scope allows, so there is " +
    "nothing to start under it yet. Reply in the request's thread with a plan for them.",
  scopeNoApprover:
    "RONDO_APPROVER is not set, so there is nobody this page could approve a scope as.",
  scopeWorkspace: (repository, root) => `${repository} at ${root}`,
  scopePlanDigest: (digest) => `plan ${digest}`,
  scopeAgentType: (digest) => `agent type ${digest}`,
  scopeAgentTypeBounds: "What that agent type is allowed, and where that was read from",
  scopePlanHeading: "The plan rondo will run, and where it will run it",
  scopeDigestsFold: "The digests rondo will record",
  scopeMaybeApproved:
    "rondo cannot tell from here whether you have already approved a scope for this request, so " +
    "this is a fresh draft either way. Pressing records a second one.",
  scopeHeldBounds: (digest, tier, granted, from) =>
    `agent type ${digest}: tier ${tier}, granted ` +
    `${granted.length === 0 ? "nothing" : granted.join(", ")}, read from ` +
    `${agentTypeSourceEn(from)}`,
  scopeHeldNone: (digest) => `agent type ${digest}: rondo holds no record of what it is allowed`,
  scopeHeldUnreadable: (digest, reason) =>
    `agent type ${digest}: the record will not read, so what it is allowed cannot be shown: ${reason}`,
  scopeHeldRebuilds: (digest, rebuilt, from) =>
    `agent type ${digest}: the record read from ${agentTypeSourceEn(from)} rebuilds to ` +
    `${rebuilt}, so what it is allowed cannot be shown`,
  scopeHeldNoBuild: (digest, from, reason) =>
    `agent type ${digest}: the record read from ${agentTypeSourceEn(from)} does not build, so ` +
    `what it is allowed cannot be shown: ${reason}`,
  scopeRoundsAsk: "Review rounds",
  scopeRoundsRedraw:
    "Choosing a number redraws every budget from the plan, so anything you typed goes back to " +
    "rondo's draft.",
  scopeLapsLabel: "Laps",
  scopeRoundsLabel: "Review rounds",
  scopeCostLabel: "Cost (USD)",
  scopeReserveLabel: "Reserve per unread lap (USD)",
  scopeExpiresLabel: "Expires (UTC)",
  scopeFormula: (how) => `how: ${how}`,
  scopeFormulaRounds: "the rounds you chose",
  scopeFormulaLaps: (plans, rounds) =>
    `plans x review rounds = ${String(plans)} x ${String(rounds)}`,
  scopeFormulaReserve: "the highest first-lap cost, rounded up to the next 0.10 USD",
  scopeFormulaCost: (plans, reserve, laterRounds, redo) =>
    `plans x (reserve + later rounds x redo) = ` +
    `${String(plans)} x (${reserve} + ${String(laterRounds)} x ${redo})`,
  scopeFormulaExpires: (laps, seconds) =>
    `draft time + laps x the longest lap + a day for your replies = draft time + ` +
    `${String(laps)} x ${String(seconds)}s + 24h`,
  scopeBasesFold: (count) => `where this came from (${String(count)})`,
  scopeBasisRows: (measurement, laps, tier) =>
    `the highest ${EN_MEASURE[measurement] ?? measurement} of the ${String(laps)} most recent ` +
    `recorded lap${laps === 1 ? "" : "s"} of ` +
    `${tier === null ? "this agent type" : `tier ${tier}`}`,
  scopeBasisColdStart: (measurement) =>
    `${EN_MEASURE[measurement] ?? measurement}: nothing in this store has measured it, so rondo ` +
    `used its own starting figure`,
  scopeColdStartNote: (whole) =>
    whole
      ? "No lap has been recorded here yet, so this is rondo's default, not a measurement."
      : "Part of this is rondo's default: one of the listed agent types has no lap recorded here yet.",
  scopeBasisPlans: (plans) => `plans: ${String(plans)}`,
  scopeBasisRounds: (rounds, byDefault) =>
    byDefault
      ? `review rounds: ${String(rounds)}, which is what rondo uses when nobody chooses`
      : `review rounds: ${String(rounds)}, as you chose`,
  scopeBasisReplyAllowance:
    "a day for your own replies, which is an allowance and not a measurement",
  scopeBasisLap: (iterationId) => `lap ${iterationId}`,
  scopeSampleHeading: "This draft assumes your request is the size of past laps",
  scopeSampleRows: (laps, tier, lowest, highest) =>
    `Drafted from ${String(laps)} recorded first lap${laps === 1 ? "" : "s"} of ` +
    `${tier === null ? "this agent type" : `other agent types on tier ${tier}, as none of this one's is recorded`}` +
    `, which cost ${lowest === highest ? highest : `${lowest} to ${highest}`} USD; the reserve ` +
    `is the highest. rondo records what a lap cost, not how much work it did, so it cannot tell ` +
    `whether your request is as large as theirs. If it is larger, raise the cost here; if the ` +
    `first attempt uses it all, you can still raise it when the work comes back to you.`,
  scopeSampleColdStart: (reserve) =>
    `No lap of this agent type or its tier is recorded, so the reserve is rondo's starting ` +
    `figure, ${reserve} USD, which nobody measured, and nothing here knows how large your ` +
    `request is. If it is more than a small change, raise the cost here, or raise it later when ` +
    `the work comes back to you.`,
  scopeDefaultsHeading: "What rondo filled in for you",
  scopeDefaultNote: "A default, not derived from your request.",
  scopeSeverityLabel: "Findings this severe or worse end a round",
  scopeOutwardLabel: "Outward acts this scope allows",
  scopeOutwardAct: (act) =>
    ({
      push_branch: "push a branch",
      open_pull_request: "open a pull request",
    })[act] ?? act,
  scopeOutwardNone: "none",
  scopeIrreversibleNone: "No act is added to the irreversible list.",
  scopeCostCaveat:
    "The cost budget counts the laps' own cost only: the reviewer's cost is not counted, and a " +
    "lap whose cost is not read yet holds the reserve, which is a guess.",
  scopePressNote:
    "One press records this scope and approves it, under your name. Nothing is spent by " +
    "approving it: every act is tested against it at the moment it is taken.",
  scopePlain: "Records this scope and approves it",
  scopeApproved: (since) => `Approved ${since} ago`,
  scopeDigest: (digest) => `digest ${digest}`,
  scopeNotThisRequest: "That approval is not this request's, so nothing of it is shown here.",
  scopePredecessorSpent: (laps, usd, unread) =>
    `The scope this one replaces has spent ${String(laps)} laps and $${usd} read, with ` +
    `${String(unread)} laps whose cost is not read yet holding their reserve.`,
  scopePredecessorNoApproval:
    "The scope this one replaces was never approved, so it has spent nothing.",
  scopePredecessorUnreadable: (reason) =>
    `What the replaced scope spent could not be read: ${reason}`,
  scopeRetired:
    "A later scope has replaced this one, so nothing starts under this approval any more. The " +
    "scope that replaced it is the one to start under.",
  startAction: "Start the work",
  startPlain: "Starts one lap under this approval",
  startNote:
    "The words of your request are what the work is asked to do, exactly as you wrote them. " +
    "rondo names the lap; you do not.",
  startAgainSafe:
    "Pressing this button twice is one lap and not two: the second press joins the first and " +
    "starts nothing more.",
  scopeRefusedNoApprover:
    "Nothing was recorded: RONDO_APPROVER is not set, so there is nobody this page could " +
    "approve a scope as.",
  scopeRefusedPress:
    "Nothing was recorded: a scope is approved by a person pressing this page's button, and a " +
    "script cannot.",
  scopeRefusedForm:
    "Nothing was recorded: that form did not come from this page. Reload it and press again.",
  scopeRefusedFields:
    "Nothing was recorded: one of the numbers is not a number rondo can use. Check the budgets " +
    "and press again.",
  scopeRefusedNotTaken: "Nothing was recorded: the store would not take this scope.",
  scopeRefusedPlanChanged:
    "Nothing was recorded: the plan on that screen is no longer one rondo offers for this " +
    "request. Reload and choose again.",
  scopeRefusedEdited:
    "Nothing was recorded this time: that form had already been recorded and approved, and what " +
    "you just changed is not what is stored. Reload to draft a new scope.",
  scopeRefusedNotRead: "The scope was recorded and will not read back, so nothing was approved.",
  scopeRefusedNotShown:
    "The scope was recorded and rondo could not write down that it showed it to you, so nothing " +
    "was approved.",
  scopeRefusedNotApproved: "The scope was recorded and not approved. Nothing has been spent.",
  startRefusedNoApprover:
    "Nothing was started: RONDO_APPROVER is not set, so there is nobody this page could start " +
    "work as.",
  startRefusedPress:
    "Nothing was started: work is started by a person pressing this page's button, and a script " +
    "cannot.",
  startRefusedForm:
    "Nothing was started: that form did not come from this page. Reload it and press again.",
  startRefusedNoPlan:
    "Nothing was started: the plan chosen for this start is not one rondo holds for this request.",
  startRefusedNoRequest:
    "Nothing was started: your request could not be read back, so there is nothing to ask the " +
    "work to do.",
  startRefusedNoContinuo:
    "Nothing was started: the part of rondo that runs the work will not start.",
  startRefusedOutside: (test) =>
    `Nothing was started and nothing was spent: this work is outside the scope you approved, at ` +
    `the ${test} test. A message in the request's thread says what the choices are.`,
  startRefusedNotAdmitted:
    "Nothing was started, and nothing was spent. The approval stands; pressing again is safe.",
  scopeBack: "Back to the scope",

  reviseAction: "Ask for a change",
  revisePlain:
    "Sends what you wrote to this gate, and runs a second lap with it under the same approval.",
  reviseLabel: "What to change",
  revisePlaceholder: "e.g. keep the change to the parser, and leave the command line alone",
  reviseNote:
    "Your words go to the gate exactly as you leave them, and the second lap is asked to do the " +
    "work again with them. The lap and its cost are counted against the approval this one ran " +
    "under. rondo names the lap; you do not.",
  reviseNoScope:
    "This lap was not started under an approved scope, so a second lap has no budget to be " +
    "counted against, and asking for a change is not offered here.",
  reviseDraftFinding: (severity, text) => `- [${severity}] ${text}`,
  reviseDraftBases: (bases) => `  where: ${bases}`,
  reviseDraftChange: (words) => `  to change: ${words}`,
  reviseDrafted:
    "rondo drafted this from what the review found. Edit it as you like: what you send is yours.",
  reviseDrafting:
    "A draft of what to change is being written from what the review found; reload the page " +
    "in a minute or two to see it. You do not have to wait for it: you can write your own now.",
  reviseUndrafted:
    "rondo could not draft what to change this time, and will not try again for this review. " +
    "Write what you want changed yourself; what the review found is above.",
  reviseDraftArrived:
    "A draft arrived after you started writing, and your own words were kept. To see the " +
    "draft instead, empty the box and reload the page.",
  forMaintainer: "For whoever maintains rondo on this machine",
  hostLog:
    "The rest of what rondo printed is in the host's log: journalctl --user -u rondo.service " +
    "(or the terminal, when the host was started by hand with rondo web).",
  reviseRefusedNoApprover:
    "Nothing was answered: RONDO_APPROVER is not set, so there is nobody this page could " +
    "answer as.",
  reviseRefusedPress:
    "Nothing was answered: a gate is answered by a person pressing this page's button, and a " +
    "script cannot.",
  reviseRefusedForm:
    "Nothing was answered: that form did not come from this page. Reload it and press again.",
  reviseRefusedNoWords:
    "Nothing was answered: a change has to say what to change, and the box was empty.",
  reviseRefusedGateClosed:
    "Nothing was answered: this lap has no gate open any more. Go back to see how it ended.",
  reviseRefusedNotItsScope:
    "Nothing was answered: the approval this asks to spend is not the one this lap ran under. " +
    "Reload the gate and press again.",
  reviseRefusedStillRunning:
    "Nothing was answered: this gate is already being answered with other words, and that is " +
    "still running. Wait for it, then reload the gate to see how it stands.",
  reviseRefusedNotSetUp:
    "Nothing was answered and the gate was not touched: the second lap could not be set up. " +
    "Whoever maintains rondo on this machine can see what it said.",
  reviseRefusedNoContinuo:
    "Nothing was answered: the part of rondo that runs the work will not start.",
  reviseRefusedOutside: (test) =>
    `Nothing was answered and nothing was spent: a second lap is outside the scope this one ran ` +
    `under, at the ${test} test. The gate is untouched, and a message in the request's thread ` +
    `says what the choices are.`,
  reviseRefusedWalkFailed:
    "Answering this gate did not finish, and no second lap started. Your words may already have " +
    "reached it: go back and read how the gate stands before pressing again. Whoever maintains " +
    "rondo on this machine can see what it said.",
  reviseRefusedNotSettled:
    "The gate was answered with your words, and no second lap started: the lap you answered did " +
    "not finish settling. Nothing was spent. Whoever maintains rondo on this machine can see what it said.",
  reviseRefusedAfterGate:
    "The gate was answered with your words, and no second lap started: the approval would not " +
    "take another lap. What you wrote is recorded; a message in the request's thread says what " +
    "the choices are.",
  reviseRefusedNotStarted:
    "No second lap started, and nothing here is lost. " +
    "Whoever maintains rondo on this machine can see what it said.",
  reviseForked:
    "Asking for a change is not offered here: what you approved for this request was raised " +
    "twice, separately, and rondo will not choose which of the two to spend. Nothing has been " +
    "spent. Approving the work as it is still works.",
  reviseRefusedForked:
    "Nothing was answered and nothing was spent: what you approved for this request was raised " +
    "twice, separately, and rondo will not choose which of the two to spend.",

  raiseNeeded: (why) =>
    `Asking for a change would start another attempt, and ${why}, so it is not offered. ` +
    "Nothing has been asked or spent. Raise the budget and asking for a change opens again " +
    "here; approving the work as it is still works.",
  raiseWhyLaps: (laps) =>
    `${laps === 1 ? "the one attempt" : `all ${String(laps)} attempts`} you approved ` +
    `${laps === 1 ? "is" : "are"} used`,
  raiseWhyCost: (spent, reserve, cost) =>
    `another attempt holds $${reserve} until its cost is known, which with the $${spent} ` +
    `already spent or held would pass the $${cost} you approved`,
  raiseWhyExpiry: (at) => `what you approved ended at ${at} UTC`,
  raiseLink: "Raise this approval's budget",
  raiseLead:
    "Raise the budget you approved for this request. Only the budget changes: the work, where " +
    "it runs and what the worker may do stay exactly as you approved them.",
  raiseWasHeading: "What you approved, and what it has used",
  raiseWas: (laps, cost, until) =>
    `Up to ${String(laps)} attempt${laps === 1 ? "" : "s"} and $${cost}, until ${until} UTC.`,
  raiseUsed: (attempts, usd, unread) =>
    `Used so far: ${String(attempts)} attempt${attempts === 1 ? "" : "s"} and $${usd}` +
    (unread === 0 ? "." : `, with ${String(unread)} whose cost is not known yet.`),
  raiseFromHere:
    "The new budget counts from now on. What was already spent stays counted against what you " +
    "approved before and is not taken out of the new one: raising the cost to $15 lets another " +
    "$15 be spent, not $15 in total.",
  raiseRetires:
    "Once you press, the earlier approval starts nothing new, for every request it covered; " +
    "this one takes its place.",
  raiseAskStands:
    "rondo stopped this work earlier and asked you how to go on. Raising the budget does not " +
    "answer that: the work stays stopped until you tell it to carry on in the request's thread.",
  raiseAskLink: "Read what it asked",
  raiseNotTip:
    "This budget has already been raised, so there is nothing to raise here. Go back to see the " +
    "budget that stands now.",
  raisePressNote:
    "One press records the new budget and approves it, under your name, and takes you back to " +
    "the work waiting for you. Nothing is spent by approving it.",
  raiseAction: "Raise the budget",
  raisePlain: "Records the new budget and approves it",
  raiseRefusedNotTip:
    "Nothing was recorded: this budget has already been raised, from another tab or by someone " +
    "else. Go back to see the one that stands now.",
  raiseRefusedForked:
    "Nothing was recorded: what you approved for this request was raised twice, separately, and " +
    "rondo will not choose which of the two to raise again.",
  raiseRefusedNotAtGate:
    "Nothing was recorded: the work is no longer waiting for you, so there is no budget to " +
    "raise for it. Go back to see how it ended.",

  publishAction: "Open a pull request",
  published: (branch, runId) =>
    `Published: ${branch === null ? "the branch" : `the branch ${branch}`} is pushed, and ` +
    `${runId === null ? "the run" : `the run ${runId}`} is closed.`,
  publishedPullRequest: "The pull request",
  holds: (paths) => `Files it keeps to itself: ${filesEn(paths)}`,
  notLanded:
    "rondo has not found this change on the default branch yet, so these files stay with it " +
    "and other work that needs them waits.",
  landed: "Its change is on the default branch, and its files are free for other work.",
  releasedByPerson: "A person released its files, so other work may use them.",
  releaseLink: "Release its files",
  releaseHeading: "Release the files this work keeps",
  releaseLead:
    "This work has finished, and it still keeps its files to itself. Nothing else that needs " +
    "them can start until you release them or its change is found on the default branch.",
  releaseWorkHeading: "The work",
  releaseHoldsHeading: "The files it keeps",
  releaseWhyHeading: "Why rondo has not released them itself",
  releaseWhy: [
    "rondo lets go of these files once it finds this change on the default branch: every file " +
      "the work changed has to be there exactly as the work left it. It looks when other work " +
      "asks for the same files.",
    "It has not found it. That happens when the change is not merged yet, when it was edited or " +
      "had a conflict resolved on its way in, when it went to another remote, or when the default " +
      "branch could not be read.",
    "Whether the work is done is your call. If it is merged in a form rondo cannot recognise, or " +
      "you will not merge it, release the files.",
  ],
  releaseEffectHeading: "What releasing does",
  releaseEffect: [
    "Other work may use these files straight away.",
    "The branch, the pull request and the work itself stay as they are; nothing is deleted or " +
      "closed.",
    "It is recorded as your decision. If this work is tried again, it takes the files back.",
  ],
  releaseAction: "Release the files",
  releasePlain: "Lets other work use these files; records that you decided this work is done",
  releaseBack: "Back to the files this work keeps",
  releaseNothingHeld: "This work keeps no files now, so there is nothing to release.",
  releaseStillOpen:
    "Part of this work is still running or waiting for your review, so it keeps its files until " +
    "that ends.",
  releaseRefusedNoApprover:
    "Nothing was released: rondo on this machine does not yet know who you are, so nothing " +
    "here can be decided as you.",
  releaseRefusedPress:
    "Nothing was released: this is done by a person pressing this page's button, and a script " +
    "cannot.",
  releaseRefusedForm:
    "Nothing was released: that form did not come from this page. Reload it and press again.",
  releaseRefusedChanged:
    "Nothing was released: this work changed after the screen was drawn (its files were " +
    "released, or it was tried again). Go back to see where it stands now.",
  releaseRefusedNotRecorded:
    "Nothing was released: rondo could not record your decision. The files stay with this work; " +
    "pressing again is safe.",
  planHeld: (paths) =>
    `Not yet: other work is changing ${filesEn(paths)}. This can start once that work's change ` +
    "is on the default branch, or once its files are released.",
  planHeldFinished: (paths) =>
    `Not yet: work that has finished still keeps ${filesEn(paths)}, because its change has not ` +
    "been found on the default branch. This can start once it is, or once its files are released.",
  planHeldBy: "Held by",
  planHeldTry:
    "That work has finished. Starting checks first whether its change is on the default branch.",
  startRefusedHeld:
    "Nothing was started and nothing was spent: other work still keeps files this needs. The " +
    "approval stands; start again once that work's change is on the default branch or its files " +
    "are released.",
  publishHeading: "Open a pull request for this work",
  publishLead:
    "Nothing has left this machine yet. This is what publishing would do, read just now; the " +
    "button below is the only thing that does it.",
  publishNotYetLead:
    "Nothing has left this machine, and this work cannot be published as it stands.",
  publishReviewLead:
    "Nothing has left this machine yet. This is what publishing would do, read just now -- and " +
    "the reading of this work does not cover it, so the only press here is the one that says so.",
  publishNotYetHeading: "What stops it",
  publishTargetHeading: "What would happen",
  publishPushes: (branch, remote) => `Push the branch ${branch} to ${remote}.`,
  publishOpens: (repo, base) => `Open a pull request on ${repo}, against ${base}.`,
  publishCloses: (runId) => `Close the run ${runId} as completed.`,
  publishPushUrl: (url) => `That push reaches ${url}.`,
  publishWorkspace: (workspace) => `The work is in ${workspace}.`,
  publishRequestHeading: "The pull request it would open",
  publishTitleLabel: "Title",
  publishBodyLabel: "Body",
  publishBodyViewLegend: "Show the body as",
  publishBodyPreview: "Preview",
  publishBodyRaw: "Raw",
  publishBodyRawNote: "Exactly the text that will be sent, byte for byte.",
  publishNoticedHeading: "What rondo noticed",
  publishModelHeading: "What the model read",
  publishModelNote:
    "Material for you to weigh. It is not an approval, and nothing above was decided by it.",
  publishNote:
    "rondo pushes, opens the pull request and closes the run, as you. It merges nothing; that " +
    "is still yours. If any of this has changed since the page was drawn, the press stops and " +
    "says so.",
  publishPlain: "Pushes this branch, opens its pull request and closes the run.",
  publishBack: "Back to publishing",
  publishNotOffered:
    "Nothing can be published from this page. Publishing needs a person this host accepts to " +
    "publish as, and it was started without one. That is given to rondo when the page is " +
    "started.",
  publishNotClosed: (status) =>
    `This lap is ${status}. Publishing is for work a person has already approved at the gate.`,
  publishNotApproved: (outcome) =>
    `This lap's gate ended as ${outcome}, which is not a person having answered it, so there is ` +
    "no approval to publish under.",
  publishNoRun: "This lap records no run, so there is no run to close.",
  publishPlanField: (field) =>
    `This lap's plan records no ${field}, and publishing is built from it. It cannot be ` +
    "published as it stands.",
  publishNoRepo:
    "This lap does not say where its pull request would be opened, and neither does this host. " +
    "Nothing here can set that: where work is published to is recorded when the place the work " +
    "happens is set up, by whoever installed rondo.",
  publishTargetRefused: (reason) =>
    `The push has nowhere to go that rondo can vouch for: ${reason}`,
  publishUncommitted: (paths) =>
    `The workspace still holds work that is not on the branch: ${paths}. The push would leave ` +
    "it behind, and no button here changes that.",
  publishUncommittedElsewhere: (branch) =>
    `The workspace has ${branch} checked out, which is not the branch this would push.`,
  publishUncommittedRemedies:
    "Answer it about those paths rather than about the publish: run the lap again so it commits " +
    "its own work and is read again, commit them yourself in the workspace, or discard them if " +
    "they are not work.",
  publishReviewHeading: "The reading does not cover this",
  publishReviewNoReading:
    "Nothing read this work independently. Unread and read-and-nothing-raised must not look " +
    "alike, so publishing stops here by default.",
  publishReviewNotClear: (verdict, findings) =>
    `The reading of this work is '${verdict}'${findings === "" ? "" : `: ${findings}`}. It ` +
    "settles nothing and it is not a veto; it is a point you have not answered.",
  publishReviewNoEvidence:
    "The reading says it found nothing, but records no measurement of what it read, so there is " +
    "nothing to check it against.",
  publishReviewUnreadable: (reason) =>
    `The workspace cannot be read now (${reason}), so the reading cannot be checked against ` +
    "what would be pushed.",
  publishReviewMoved: (readTip, nowTip) =>
    `The reading was taken over ${readTip} and this would push ${nowTip}, so it does not ` +
    "describe the work any more.",
  publishDespiteFold: "Open the pull request without that reading",
  publishDespiteAction: "Open the pull request anyway",
  publishDespiteNote:
    "That is yours to decide, and it is a second press of its own. rondo records that you " +
    "decided it; the reading stays where it is.",
  publishDespitePlain: "Publishes this work although the reading above does not cover it.",
  scopeBusy: "Recording the scope...",
  nextStepHeading: "Your next step",
  nextStepScope:
    "Nothing has been set for this request yet. Set its scope -- what it may spend and touch -- " +
    "and the work can start.",
  nextStepDrafted:
    "rondo has drafted a scope for this request. Check it and approve it, and the work can start.",
  nextStepStart: "The scope is approved. Start the work from its screen.",
  nextStepStartAction: "Go to start the work",
  nextStepPublish:
    "The work is approved. Opening a pull request pushes its branch and puts it up for review; " +
    "nothing is merged.",
  nextStepAddRepository: (named, repo) =>
    `This request names ${named}, but rondo does not work in ${repo} yet, so nothing has been ` +
    `drafted. Adding it copies ${repo} onto this computer beside rondo's other repositories, and ` +
    `its pull requests go to ${repo}.`,
  addRepositoryAction: "Add this repository",
  addRepositoryBack: "Back to the request",
  repositoryUnbuilt: (repo) =>
    `rondo could not tell how ${repo} is built, so the worker can change and commit its files ` +
    "but cannot run its build or tests.",
  addRepositoryRefusedNoApprover:
    "Nothing was added: rondo on this machine does not yet know who you are, so nothing here " +
    "can be decided as you.",
  addRepositoryRefusedPress:
    "Nothing was added: this is done by a person pressing this page's button, and a script " +
    "cannot.",
  addRepositoryRefusedForm:
    "Nothing was added: that form did not come from this page. Reload it and press again.",
  addRepositoryRefusedInstall:
    "Nothing was added: rondo on this computer cannot reach GitHub as you. Whoever installed " +
    "rondo here is the one who can look; once they have, the button is still there to press again.",
  addRepositoryRefusedUnseen:
    "Nothing was added: GitHub has no such repository, or your account cannot see it. If the " +
    "name in your request is wrong, say the right one in a reply.",
  addRepositoryRefusedFailed:
    "Nothing was added: rondo could not copy the repository this time. Pressing again is safe; " +
    "it carries on from where this stopped.",
  addRepositoryRefusedNoSetup:
    "Nothing was added: rondo's setup on this computer has not given it anywhere to put a " +
    "repository. Whoever installed rondo here is the one who can look.",
  approveBusy: "Recording your approval...",
  startBusy: "Starting the work...",
  reviseBusy: "Asking for the change...",
  publishBusy: "Opening the pull request...",
  lapBusyNote:
    "Received. The work is running now, and this screen moves on when it stops for you to " +
    "check it -- a few minutes, and sometimes tens of minutes. There is no need to press again, " +
    "and the list in another tab shows the work under way.",
  publishBusyNote:
    "Received. rondo is pushing the branch and opening the pull request; this usually takes " +
    "under a minute. There is no need to press again.",
  publishRefusedNoApprover:
    "Nothing was published: RONDO_APPROVER is not set, so there is nobody this page could " +
    "publish as.",
  publishRefusedPress:
    "Nothing was published: this is done by a person pressing this page's button, and a script " +
    "cannot.",
  publishRefusedForm:
    "Nothing was published: that form did not come from this page. Reload it and press again.",
  publishRefusedGone:
    "Nothing was published: this lap would not read any more. Go back to the summary.",
  publishRefusedNotClosed: "Nothing was published: this lap has not ended at an approved gate.",
  publishRefusedNotApproved:
    "Nothing was published: this lap's gate ended without a person answering it, so there is no " +
    "approval to publish under.",
  publishRefusedNoRun: "Nothing was published: this lap records no run to close.",
  publishRefusedPlanField:
    "Nothing was published: this lap's plan is missing something publishing is built from.",
  publishRefusedNoRepo:
    "Nothing was published: this lap does not say where its pull request would be opened, and " +
    "neither does this host.",
  publishRefusedTarget: (detail) =>
    `Nothing was published: the push has nowhere to go that rondo can vouch for. ${detail}`,
  publishRefusedUncommitted: (detail) =>
    `Nothing was published: the workspace still holds work that is not on the branch (${detail}).`,
  publishRefusedNotRead:
    "Nothing was published: the reading of this work does not cover what would be pushed. " +
    "Reload this screen; publishing past that is a press of its own.",
  publishRefusedNothingOverruled:
    "Nothing was published: the reading of this work covers it, so there was nothing to " +
    "overrule. Reload this screen and press publish.",
  publishRefusedChanged:
    "Nothing was published: what this screen showed is not what publishing would do now. " +
    "Reload it, read it again, and press again.",
  publishRefusedStillRunning:
    "Nothing was published twice: this lap is already being published, from a screen that read " +
    "something else. Wait for it, then reload.",
  publishRefusedNoContinuo:
    "Nothing was published: the part of rondo that closes the run will not start, and rondo " +
    "will not push work it could not then finish.",
  publishRefusedPushFailed: (detail) => `Nothing was published: the branch did not push. ${detail}`,
  publishRefusedPullRequestFailed: (detail) =>
    `The branch is pushed; rondo could not open the pull request. ${detail} Whether one was ` +
    "created before that is not something rondo holds: go and look at the forge before pressing " +
    "again, because a second press cannot open a pull request that is already there. If it " +
    "exists, the only leg left is closing the run, and whoever maintains rondo on this machine " +
    "can see the line that does it.",
  publishRefusedRunNotClosed:
    "The branch is pushed and the pull request is open; the run did not close. That is the one " +
    "leg left, and whoever maintains rondo on this machine can see what it said.",
  publishRefusedNotStarted:
    "Nothing was published, and nothing here is lost. " +
    "Whoever maintains rondo on this machine can see what it said.",
} satisfies Chrome);
