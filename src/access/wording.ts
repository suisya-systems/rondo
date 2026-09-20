/**
 * rondo's own prose, one set per language tag (D-0055).
 *
 * **This is a message catalogue and not a translator** (rule 12). Nothing here
 * converts anything: two strings rondo authored exist and one is selected. The
 * `en` set is the literals that were spelled at the composition sites before
 * this entry, moved verbatim; the `ja` set is a second set of strings rondo
 * wrote. Material -- what a lap composed -- never reaches this file, and is
 * still quoted byte for byte wherever it is shown.
 *
 * **The line is drawn at the span and never at the string literal** (rule 3).
 * A token inside a sentence stays the token, in its own bytes, in the middle of
 * a translated sentence: `rondo inbox`, `RONDO_APPROVER`, `approve`, a status,
 * a gate id and an iteration id are ASCII in both sets. That is why almost
 * every entry below is a function over the tokens it frames rather than a
 * finished line -- a sentence with a hole in it can be rewritten in another
 * language, and a sentence spelled around an interpolation cannot.
 *
 * **Every set is a whole {@link Chrome}, and none is the other's diff**
 * (D-0079, withdrawing D-0055 rule 9). A set was once a `Partial` merged over
 * `en`, which made English the original and every other language a list of
 * overrides written while reading it -- the shape rondo#257 measured as English
 * wearing Japanese words. Now a key added to {@link Chrome} is a type error in
 * every set until each is written in its own language, from what the key is for
 * rather than from its English line. The cost is taken knowingly: a screen does
 * not ship until every shipped language says it, and each further language is a
 * whole set to write.
 *
 * **What is recorded is not here** (rule 4). The claim labels and values a
 * press writes to the ledger are composed in `src/advisory/proposal.ts` and
 * stay English whatever they read like, because a recorded string rondo could
 * have written two ways is a ledger holding two versions of one claim. So the
 * page's own sentences are in this file and the payload's are not, and the
 * bytes a press stores do not depend on the host's language.
 *
 * **The terminal is not a caller of the selection** (rule 10). `inboxLines` and
 * the fence block serve both the page and the console, and the console's
 * strings go through D-0004's ASCII escape, which has no CJK substitutes. So
 * the set is an *argument* to composition rather than a lookup inside it, and
 * the command line passes {@link EN} until D-0004's scope is a decision
 * somebody takes.
 */

import { isLanguageTag } from "../refrain/plan.js";
import { APPROVED_OUTCOME } from "../store/records.js";
import type { IssueReadFailure } from "./issue-read.js";
import { PAGE_EN, PAGE_JA, type PageWords } from "./page/words.js";

/**
 * Where a listed agent type's record was read from (D-0069 section 1).
 *
 * `iteration` and `scope` are rows rondo holds; `plan` is the plan the scope
 * being drafted would record, which nothing holds yet -- shown before the press
 * so the first scope in a store is not a hash a person approves blind
 * (rondo#233 S3).
 */
export type AgentTypeSource = "iteration" | "scope" | "plan";

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

/** The same three, as the {@link JA} set says them. */
function agentTypeSourceJa(from: AgentTypeSource): string {
  switch (from) {
    case "iteration":
      return "周回のプラン";
    case "scope":
      return "範囲に記録されたプラン";
    default:
      return "この範囲が記録するプラン";
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

function scopeTestJa(test: string): string {
  switch (test) {
    case "decision":
      return "範囲がまだ承認されていません";
    case "superseded":
      return "この範囲は新しい範囲に置き換えられています";
    case "request":
      return "この範囲はこの依頼を含んでいません";
    case "workspace":
      return "この作業が動く場所を、この範囲は含んでいません";
    case "agent_type":
      return "この作業のエージェント種別を、この範囲は許していません";
    case "contract":
      return "この作業は、そのエージェント種別に許されている以上のことを必要としています";
    case "irreversible":
      return "この作業は、範囲が取り返しのつかない行為として止めているものを行います";
    case "expiry":
      return "範囲の期限が切れています";
    case "laps":
      return "範囲の周回数を使い切っています";
    case "cost":
      return "費用がまだ読めていない周回の引当も含めると、範囲の費用の予算にもう 1 周回分の余裕がありません";
    case "asks":
      return "依頼のスレッドにある問いが、この作業を止めています。どの問いかはスレッドにあります";
    case "grants":
      return "この作業は、続く元の周回より多くを許されることになります";
    case "readings":
      return "範囲のレビュー回数を使い切っています";
    default:
      return `範囲の ${test} の判定が通りません`;
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

function filesJa(paths: readonly string[]): string {
  return paths.includes("/") ? "リポジトリ全体" : paths.join("、");
}

function raisedEn(blockers: number, majors: number): string {
  return [
    blockers === 0 ? "" : `${String(blockers)} blocker${blockers === 1 ? "" : "s"}`,
    majors === 0 ? "" : `${String(majors)} major`,
  ]
    .filter((part) => part !== "")
    .join(" and ");
}

/** The same count, as the {@link JA} set says it. */
function raisedJa(blockers: number, majors: number): string {
  return [
    blockers === 0 ? "" : `阻害 ${String(blockers)} 件`,
    majors === 0 ? "" : `重大 ${String(majors)} 件`,
  ]
    .filter((part) => part !== "")
    .join("、");
}

/**
 * Every sentence rondo composes for the operator to read, keyed by string.
 *
 * `lang` is the one member that is not prose: it is the tag the rest of the set
 * is actually written in, which is what `<html lang>` declares (rule 7). rondo
 * declares what it wrote and never what was asked for, so a well-formed tag
 * this file ships no set for yields the `en` set and the tag `en`.
 */
export interface Chrome extends PageWords {
  /** The tag this set is written in, which is what the document declares. */
  readonly lang: string;

  // -- The page's two standing notes (src/access/web.tsx) --
  readonly liveNote: (seconds: number) => string;
  readonly stillNote: string;
  readonly noApproverNote: string;

  // -- The three questions the lead answers --
  readonly waitingHeading: (count: number) => string;
  readonly runningHeading: (count: number) => string;
  readonly endedHeading: (count: number) => string;
  readonly waitingHead: (status: string, waited: string) => string;
  readonly runningHead: (status: string, ran: string) => string;
  readonly endedHead: (status: string, since: string, why: string) => string;
  readonly gateAnswered: (outcome: string) => string;
  /**
   * The state pill a row leads with (the page's third design pass on #220): a
   * word a person reads instead of the status enum, which stays in the pill's
   * `title`. An outcome or status no entry names is shown as its own bytes.
   */
  readonly statePill: (status: string, gateOutcome: string | null) => string;
  /** The age beside an ended row's pill. */
  readonly endedAgo: (since: string) => string;
  readonly noReasonRecorded: string;
  readonly proposalBasis: (proposalId: string) => string;
  readonly proposalHead: (kind: string, waited: string) => string;
  readonly aboutIteration: (iterationId: string | null) => string;
  readonly willNotDecode: (reason: string) => string;

  // -- What a lap spent, and what its fence refused --
  readonly spent: (cost: string, turns: string, took: string) => string;
  readonly costRead: (usd: string) => string;
  readonly costNotRead: string;
  readonly turnsRead: (turns: number) => string;
  readonly turnsNotRead: string;
  readonly durationNotRead: string;
  readonly fenceUnknown: string;
  readonly fenceRefusedNothing: string;
  readonly fenceRefused: (denials: string) => string;

  // -- An idle ledger --
  readonly nothingAtAll: string;
  readonly nothingBasis: string;

  // -- The button, and the way to it --
  readonly pressNote: string;
  readonly approveNote: (gateId: string, word: string) => string;
  /** The plain sentence beside the button; `approveNote` stays as its `title`. */
  readonly approvePlain: string;
  /**
   * The button's face, and the sentence beside it, when the model review has a
   * blocker or a major open (rondo#237).
   *
   * **Not a second press and not a refusal.** D-0065 keeps approve unrefused
   * whatever a model raised, and `approveNote` still says the gate is answered
   * `'approve'` -- what these two change is that the press says which of the
   * two approvals it is, so a person scanning the bar can tell them apart
   * without reading the red line above it.
   */
  readonly approveDespite: string;
  readonly approveDespitePlain: string;
  /** The fold that holds the claims rondo could not determine. */
  readonly undeterminedFold: (count: number) => string;
  readonly answerHere: string;
  /**
   * The short label on the filled button that leads to the press (D-0059
   * section 2: a short primary call to action). `answerHere` stays beside it as
   * the sentence that says what the second address adds.
   */
  readonly answerAction: string;

  // -- Request threads (D-0061 rule 4, D-0059 section 5a's send) --
  /** The header's way into the requests, on every view. */
  readonly requestsNav: string;
  readonly requestsHeading: (count: number) => string;
  readonly noRequests: string;
  /** How many messages a request's thread holds, and when it last moved. */
  readonly threadSize: (count: number, since: string) => string;
  /** The pill on a request, or on a message, that waits for the person's reply. */
  readonly asksWaiting: (count: number) => string;
  readonly askWaitingPill: string;
  /**
   * The same question, still held, but answered by stopping the line (D-0072
   * rule 3), and what the answer itself was where it was said.
   */
  readonly askStoppedPill: string;
  readonly answerStoppedPill: string;
  readonly answerCarriedOnPill: string;
  /** The operator's own messages are "you"; the voice badge says which voice spoke (rule 2.3). */
  readonly you: string;
  readonly operatorVoice: string;
  readonly drafterVoice: string;
  /**
   * A drafter run that drafted nothing, said as what happened and what the
   * person can do (rondo#238): the reason itself is folded under
   * {@link drafterNoDraftWhy}, because it is rondo's own words about its tools.
   */
  readonly drafterNoDraft: string;
  readonly drafterNoDraftWhy: string;
  /**
   * D-0078 section 4: what rondo read of an issue the person named, under
   * their message. Each sentence follows the issue's own name, drawn as a link
   * before it. The badge on the card is {@link issueVoice}.
   */
  readonly issueVoice: string;
  /** A read that worked (section 4.1): nothing to press, what was read folded. */
  readonly issueRead: (pullRequest: boolean, comments: number) => string;
  readonly issueReadFold: string;
  /**
   * A read that failed (section 4.2), in D-0076 rule 4.1's order: what
   * happened and what it means for the worker, then {@link issueNotReadTail}.
   * rondo's reason is folded under {@link drafterNoDraftWhy}.
   */
  readonly issueNotRead: (why: IssueReadFailure) => string;
  readonly issueNotReadTail: string;
  /** Not read yet (section 4.3): it will be, while rondo runs here. */
  readonly issuePending: string;
  /** The scope screen's lines (section 4.4): which issues the worker is given. */
  readonly scopeIssuesHeading: string;
  readonly scopeIssueGiven: string;
  readonly scopeIssueNotGiven: string;
  readonly scopeIssuePending: string;
  /** The summary's row for an ask: the request it was asked in. */
  readonly askedIn: (request: string) => string;
  readonly inReplyTo: (who: string, words: string) => string;
  readonly basesLabel: string;
  readonly replyAction: string;
  readonly openThread: string;
  /** The reply box's target, on one short line: who wrote it and how long ago. */
  readonly replyingTo: (who: string, since: string) => string;
  /** The same line when the target is a question waiting on the person, answered by a press. */
  readonly answeringTo: (who: string, since: string) => string;
  /** The filled button that answers a waiting question (a press, not a send). */
  readonly answerAskAction: string;
  /**
   * The two answers a waiting question can be pressed with (D-0072 rule 4).
   * `answerAskAction` stays the box's own label -- what the person is doing --
   * and these two are the presses: which of them it is, is what rondo acts on.
   */
  readonly answerCarryOnAction: string;
  readonly answerStopAction: string;
  /** What each of the two presses does, said where the words are typed. */
  readonly answerOutcomeNote: string;
  readonly newRequestHeading: string;
  readonly requestPlaceholder: string;
  readonly replyPlaceholder: string;
  readonly sendAction: string;
  readonly sendNote: string;
  readonly keySend: string;
  readonly composerNoApprover: string;
  readonly noSuchThread: string;
  readonly threadsUnreadable: (reason: string) => string;
  /** The line a refused send shows under the draft, which is kept. */
  readonly notSent: (line: string) => string;
  /**
   * Why a send was refused, one sentence each, with no id and no D-number in
   * it (#220 S1 review): the lines a page can cause. The mint's several
   * reasons are one sentence, because what a person does about each is the
   * same -- reload and send again.
   */
  readonly sendRefusedNoApprover: string;
  readonly sendRefusedForm: string;
  readonly sendRefusedNoWords: string;
  readonly sendRefusedNotTaken: string;
  readonly sendRefusedAsk: string;
  readonly sendRefusedTooLong: string;
  readonly sendRefusedUnknown: string;
  /** An answer to a question that did not arrive as a person's press of its button. */
  readonly answerRefusedPress: string;
  /** Said in the reply box while its thread holds a question still waiting: the box does not answer it. */
  readonly replyNotAnswer: string;
  /** Script off, a refused send lands on its own page: the way back, and where the words are. */
  readonly sendBack: string;
  readonly sendBackNote: string;
  /** With script off a view with a composer does not reload itself, so a draft survives. */
  readonly threadNoReload: string;
  /** The threads' account of themselves: the redraw writes nothing, and Send is what writes here. */
  readonly threadsLiveNote: (seconds: number) => string;
  /**
   * The S1 design pass on #220: the short lines drawn where the long notes
   * were (the notes stay, as the `title`), and the thread header's words.
   */
  readonly liveShort: (seconds: number) => string;
  readonly stillShort: string;
  /** An age as `ago` spells it (`59m`), in this set's units. */
  readonly age: (ago: string) => string;
  /** The header pill: how many questions wait on the person. */
  readonly waitingCount: (count: number) => string;
  readonly signedInAs: (actorId: string) => string;
  readonly backToRequests: string;
  readonly reloadThread: string;
  readonly threadStarted: (since: string) => string;
  /** Lets go of a reply target chosen by hand. */
  readonly replyDefault: string;
  /** A live row that will not decode, as a person reads it. */
  readonly attentionHeading: (count: number) => string;
  readonly unreadableTitle: string;
  readonly unreadableAction: (iterationId: string) => string;
  readonly unreadableDetail: string;
  /** The link from an unreadable row to its section of the reading. */
  readonly unreadableRead: string;

  // -- The gate reading on the answer view, page only (#220 S2). The console's
  // entries above stay as they are; these say the same facts in plain words,
  // and the console sentence rides along as the element's `title` --
  /** A row's refused calls, counted; the raw list is the `title`. */
  readonly blockedCount: (count: number) => string;
  readonly blockedNothing: string;
  readonly blockedUnknown: string;
  /** A running row whose transcript rondo could not name; the reason is the `title`. */
  readonly logFound: string;
  readonly logNotYet: string;
  readonly logUnchecked: (reason: string) => string;
  readonly logNotLookedFor: string;
  /** rondo#248 item 3: the way from a running row into its log, and the log's screen. */
  readonly logOpen: string;
  readonly logOpenHere: string;
  readonly logHeading: string;
  readonly logLead: (shown: number, total: number) => string;
  readonly logEmpty: string;
  readonly logWhole: string;
  readonly logUnfinished: string;
  readonly logUnread: (reason: string) => string;
  readonly logGone: string;
  readonly logOutput: string;
  readonly logOutputFailed: string;
  readonly logFailed: string;
  readonly logNoOutput: string;
  readonly logCutBefore: (characters: number) => string;
  readonly logCutAfter: (characters: number) => string;
  readonly logFinal: string;
  readonly fenceHeading: string;
  readonly whyStopped: string;
  readonly whyNotRead: string;
  readonly workHeading: string;
  readonly changedAgainst: (baseRef: string) => string;
  readonly changedUnreadable: (reason: string) => string;
  readonly changedNoRange: string;
  readonly noCommits: string;
  readonly noFiles: string;
  readonly binaryFile: string;
  readonly moreRows: (count: number) => string;
  readonly checksHeading: string;
  readonly modelHeading: string;
  /** A reading's verdict as a pill: `clear`, `concerns` or `unavailable`. */
  readonly verdictPill: (verdict: string, count: number) => string;
  readonly checksNone: string;
  readonly checksCounted: (commits: number, files: number) => string;
  readonly readingUnavailable: (reason: string) => string;
  readonly readBy: (drafter: string) => string;
  readonly whatItRead: string;
  readonly basisNone: string;
  readonly basisUnresolved: string;
  readonly modelPending: string;
  readonly modelOlder: string;
  readonly reloadPage: string;
  readonly readingsNote: string;
  readonly allAsText: string;
  readonly claimLabel: string;
  readonly claimPlaceholder: string;
  /**
   * Why an approve press carrying a claim answered nothing (rondo#220 S2
   * review), one sentence each and none pointing at the terminal: a person hits
   * the first by typing and the second whenever two people answer one gate.
   * Shown on a page of its own with the way back to the gate, whose claim draft
   * the browser keeps.
   */
  readonly claimTooLong: (max: number) => string;
  readonly claimGateUnread: string;
  readonly claimGateClosed: string;
  readonly claimNotRecorded: string;
  readonly answerNotDone: string;
  readonly gateBack: string;
  /** The line by the button when the model review raised a blocker or a major. */
  readonly modelRaised: (blockers: number, majors: number) => string;
  /**
   * An ended row's line when its gate was approved with a blocker or a major
   * open in the model review (rondo#237).
   *
   * The same two counts the gate's own warning carried, said on the summary:
   * a finished lap reads as finished, and which of the two approvals ended it
   * was otherwise only findable by opening the lap.
   */
  readonly approvedOverRaised: (blockers: number, majors: number) => string;
  /** A model finding's severity (`blocker`, `major`, `minor`, `nit`) as a word, and counted. */
  readonly severityWord: (severity: string) => string;
  readonly severityCount: (severity: string, count: number) => string;
  /** A reading that could not be taken, in one plain sentence; the reason is in a fold. */
  readonly readingNotTaken: string;
  readonly whyNotTaken: string;
  /** Beside the checks when *what changed* cannot be read now. */
  readonly checksWorkUnreadable: string;
  /**
   * The checks' pill in place of a recorded `clear` when the work it would be
   * matched against cannot be read (rondo#237).
   *
   * **A recorded verdict is not a reading of work nobody can read.** S5 made
   * this a refusal on the publish screen (`reviewBlock`'s `unreadable` arm);
   * the gate screen said *nothing raised* over the same fact, beside a *what
   * changed* card that could count nothing. The other two verdicts already say
   * something that is not a pass, so they keep their own word.
   */
  readonly checksNotMatched: string;
  /** In the approve bar when the model's round ended with no reading. */
  readonly modelNotTaken: string;
  readonly neitherReadingTaken: string;
  /** The fold holding what the approve press records. */
  readonly recordsFold: (count: number) => string;
  /** A refused call whose shape rondo cannot read, on the fence card. */
  readonly denialUnreadable: string;
  /** The plain sentence above an unreadable row's reason in the reading. */
  readonly unreadableLead: string;
  /** An ended row's echo of the verification claim its press carried. */
  readonly checkedEcho: (claim: string, by: string | null) => string;
  readonly modelRaisedLink: string;
  readonly modelMayArrive: string;

  // -- The page's chrome under stack H (D-0059 rule 5): the live indicator and
  // the key hints, both drawn only once the key script has run --
  readonly liveLabel: string;
  readonly keyMove: string;
  readonly keyOpen: string;
  readonly keyBack: string;
  readonly keyWrite: string;

  // -- The fold, and the sections inside it --
  readonly openReading: string;
  readonly hideReading: string;
  readonly inboxHeading: string;
  readonly inboxNote: string;
  readonly inboxNoApprover: string;
  readonly betweenHeading: string;
  readonly betweenNote: string;
  readonly iterationHeading: (iterationId: string) => string;
  readonly explainNote: string;

  // -- The inbox's own lines (src/access/inbox.ts), page and terminal alike --
  readonly inboxFor: (actorId: string) => string;
  readonly waitingOnYou: string;
  readonly bindingProposals: (count: number) => string;
  readonly nonBindingProposals: (count: number) => string;
  readonly readOneBack: string;
  readonly iterationsWaiting: (count: number) => string;
  readonly newMark: string;
  readonly proposalLine: (
    proposalId: string,
    kind: string,
    about: string,
    waited: string,
  ) => string;
  readonly waitingLine: (
    iterationId: string,
    status: string,
    waited: string,
    unblockedBy: string,
  ) => string;
  readonly inFlightHeading: (count: number) => string;
  readonly inFlightLine: (
    iterationId: string,
    status: string,
    since: string,
    where: string,
  ) => string;
  readonly unreadableLine: (id: string, reason: string) => string;
  readonly changedHeading: (since: string, records: number) => string;
  readonly changedHeadingNever: string;
  readonly neverLooked: string;
  readonly nothingChanged: string;
  readonly censusEntry: (kind: string, count: number) => string;
  readonly changeLine: (kind: string, id: string | null, since: string) => string;
  readonly noId: string;
  readonly silenceHeading: string;
  readonly countedLine: (what: string, presented: number, withheld: number) => string;
  readonly overAllTime: string;
  readonly sinceLastLook: (since: string) => string;
  readonly neverLookedSince: string;
  readonly withheldBy: (ruleName: string, count: number) => string;
  readonly unnamedRule: string;
  readonly unspentHeading: (count: number) => string;
  readonly unspentLine: (
    decisionId: string,
    proposalId: string,
    approved: string,
    actorId: string,
    since: string,
  ) => string;

  // -- What releases a waiting row, and where a running one writes --
  readonly noGateDecide: string;
  readonly noGateReleases: (gateId: string) => string;
  readonly suspendedNoGate: string;
  readonly answerGate: (gateId: string) => string;
  readonly runsIn: (transcript: string, workspace: string) => string;
  readonly noWorkspace: string;
  readonly transcriptNotLookedFor: string;
  readonly transcriptNotNamed: (reason: string) => string;
  readonly transcriptAt: (directory: string, sessions: number) => string;

  // -- The fence block's two standing pieces (rule 11, src/access/cli.ts) --
  /**
   * *"This is the run's own declaration, not the whole fence"*.
   *
   * The declaration is not the fence, and saying so is the whole point of that
   * screen: continuo renders the role's own template into the same
   * `permissions.allow` -- on a worker that is six `git` specs rondo never
   * declared and cannot see from here. A list headed "allowed to run" would
   * have been rondo asserting a fence it did not read, which is the habit that
   * block exists to break.
   */
  readonly declarationCaveat: readonly string[];
  /**
   * The containment rondo does not observe, said on every lap and derived from
   * nothing (`D-0050` rules 3 and 4).
   *
   * **Why the worker's sandbox reaches neither half of that block.** It fails
   * *open*: the call runs, with weaker containment than it was meant to have,
   * and nothing is refused. So it cannot appear in `permission_denials`, which
   * records calls the fence turned *down* -- the field's own shape says so,
   * every entry carrying a `tool_name` and the `tool_input` of a call that did
   * not happen -- and it is not in the declaration either, because the
   * declaration is a list of subjects and this is not about a subject. N-16
   * (`docs/operations/lap-6-dogfood.md`) measured the consequence: a lap whose
   * first Bash call left the sandbox disabled for four more, printing there as
   * a clean run. Only the worker's own paragraph at the gate said otherwise.
   *
   * **Why a constant and not a line of `provenance`.** The caveat beside it --
   * {@link declarationCaveat} -- is composed on the paths where the delegation
   * record was actually read, so a lap whose continuo could not be reached
   * prints none of it. This sentence has to survive all of those, and it must
   * survive them for a reason rather than by luck: it is a claim about
   * **rondo's record**, which rondo is the authority on, and not about this
   * lap, which rondo has nothing to suspect with (`D-0050` rule 4). A sentence
   * printed only when rondo suspected something would be the second kind. Held
   * here so that "it is not derived from the lap" is a property of one entry
   * rather than of every branch above it.
   *
   * **D-0050 rule 4's argument is for its unconditionality and not for its
   * language** (D-0055 rule 11). It is printed on every lap and derived from
   * nothing, in whatever language rondo wrote it -- and `D-0053` rule 3's
   * inference, that a claim about the record is therefore a claim nobody has to
   * read, is what D-0055 reverses by name.
   *
   * **It does not report that a lap failed open.** It reports that the screen
   * cannot tell, and says where the only account of it has ever been
   * (`D-0050` rule 5b: the gate's own `rationale`, which the same commands
   * print).
   */
  readonly secondFence: readonly string[];

  // -- The scope screen (rondo#233 S3, D-0066 rule 1) --
  /**
   * The way in, and the screen's own title. One short filled call to action
   * with the longer sentence as the pointer's `title`, the shape
   * {@link answerAction} and {@link answerHere} already have.
   */
  readonly scopeAction: string;
  readonly scopeHere: string;
  readonly scopeHeading: string;
  readonly backToThread: string;
  readonly scopeLead: string;
  /**
   * No plan rondo holds, no form: the screen says how one comes to be held,
   * on the page (D-0071 rule 6.2's recommendation, rondo#238).
   */
  readonly scopeNoPlanHeld: string;
  readonly scopePlansUnread: (reason: string) => string;
  /** The plan choice, above the list of plans rondo holds. */
  readonly scopePlanAsk: string;
  /** Where a held plan came from: pasted into this thread, or run by earlier laps. */
  readonly scopePlanFrom: (from: "message" | "iterations" | "setup") => string;
  /** One held plan as a line: where, the agent type's short digest, and where it came from. */
  readonly scopePlanLine: (where: string, agentType: string, from: string) => string;
  /** A plan line another offered plan reads the same as, with when rondo came to hold it (UTC). */
  readonly scopePlanHeldAt: (line: string, at: string) => string;
  /** A plan the address named that rondo no longer offers: said, and the choice put again. */
  readonly scopePlanGone: string;
  /** The drafted scope's screen (rondo#238 C2b, D-0071 rule 5.3). */
  readonly scopeDraftedLead: string;
  readonly scopeDraftedPlansHeading: string;
  readonly scopeDraftedPlan: (n: number) => string;
  /** A drafted plan whose template the draft's snapshot no longer holds. */
  readonly scopeDraftedTemplateGone: string;
  /** A drafted value below what rule 4.2 computed: what it was computed as, before the words it rests on. */
  readonly scopeNarrowed: (computed: string) => string;
  /** A threshold the drafter made stricter, and an act it added to the irreversible list, on the person's words. */
  readonly scopeNarrowedStricter: string;
  readonly scopeNarrowedAdded: string;
  /** A draft written after an approval that stands: shown beside it, and what approving it means. */
  readonly scopeRedrafted: string;
  readonly scopeDraftedAction: string;
  readonly scopeDraftedPlain: string;
  readonly scopeDraftedPressNote: string;
  /** One drafted plan under an approved scope, and whether it can start now. */
  readonly planStartAction: string;
  readonly planStartPlain: string;
  readonly planStarted: string;
  readonly planStartedLink: string;
  readonly planBusy: (limit: number) => string;
  readonly planFull: (live: number, limit: number) => string;
  /** Why the scope's own test says no, in plain words: one per test (D-0066 rule 4.2). */
  readonly planOutside: (test: string) => string;
  readonly planUnrunnable: string;
  readonly planUnrunnableWhy: string;
  /** The scope's tests could not be read now: said as that, with rondo's reason folded. */
  readonly planUndecidable: string;
  /** An approved scope no plan rondo holds may run under. */
  readonly scopeNoPlanForScope: string;
  readonly scopeNoApprover: string;
  /** What the plan says, quiet, above the numbers it drafted them from. */
  readonly scopeWorkspace: (repository: string, root: string) => string;
  readonly scopePlanDigest: (digest: string) => string;
  readonly scopeAgentType: (digest: string) => string;
  readonly scopeAgentTypeBounds: string;
  /**
   * The card's own heading, and the fold the two digests sit in.
   *
   * The card holds the plan, the workspace, the two digests and what the agent
   * type is allowed, and its only heading named the last of those -- so nothing
   * on the screen said plainly *this is the plan rondo will run and where*
   * (rondo#233 S3 screen review). The digests are folded for the same review's
   * other half: three 71-character hashes were a third of the first screenful
   * at 420px, and there is nothing a person does with one.
   */
  readonly scopePlanHeading: string;
  readonly scopeDigestsFold: string;
  /**
   * What this screen cannot tell the person: whether they already approved a
   * scope for this request.
   *
   * The store holds no listing of a request's scopes (`AdvisoryRecord`), so a
   * second press here records and approves a second scope and the screen would
   * not know. Said rather than hidden -- a blank draft presented as if none
   * existed is the screen lying by omission.
   */
  readonly scopeMaybeApproved: string;
  /**
   * One line per listed agent type, read back from the held record (D-0069
   * section 1): what it is allowed, or why that cannot be shown.
   *
   * `from` says where the record was read, and the three are not the same
   * claim: two of them are rows rondo already holds, and `plan` is the plan
   * this very scope would record -- nothing is held yet, and the person is
   * being shown what the press is about to write rather than what it wrote.
   *
   * `granted` are cadenza's own capability keys and stay their own bytes in
   * both sets (rule 3); the prose around them is rewritten.
   */
  readonly scopeHeldBounds: (
    digest: string,
    tier: string,
    granted: readonly string[],
    from: AgentTypeSource,
  ) => string;
  readonly scopeHeldNone: (digest: string) => string;
  readonly scopeHeldUnreadable: (digest: string, reason: string) => string;
  readonly scopeHeldRebuilds: (digest: string, rebuilt: string, from: AgentTypeSource) => string;
  readonly scopeHeldNoBuild: (digest: string, from: AgentTypeSource, reason: string) => string;
  /** The review-rounds control, and the residual of drawing it as links rather than a form. */
  readonly scopeRoundsAsk: string;
  readonly scopeRoundsRedraw: string;
  readonly scopeLapsLabel: string;
  readonly scopeRoundsLabel: string;
  readonly scopeCostLabel: string;
  readonly scopeReserveLabel: string;
  /** The expiry is a native `datetime-local` read as UTC, so the label says UTC. */
  readonly scopeExpiresLabel: string;
  /**
   * How a number follows from its bases, one arm per budget, and the fold the
   * bases themselves sit in.
   *
   * `computeScopeBudgets` returns the arithmetic as facts and not as a sentence
   * (`src/advisory/budget.ts`), because a line it composed was a line no second
   * set could rewrite: rondo#233 S3's screen review found every formula and
   * every basis rendering English inside a Japanese page.
   */
  readonly scopeFormula: (how: string) => string;
  readonly scopeFormulaRounds: string;
  readonly scopeFormulaLaps: (plans: number, rounds: number) => string;
  readonly scopeFormulaReserve: string;
  readonly scopeFormulaCost: (
    plans: number,
    reserve: string,
    laterRounds: number,
    redo: string,
  ) => string;
  readonly scopeFormulaExpires: (laps: number, seconds: number) => string;
  readonly scopeBasesFold: (count: number) => string;
  /**
   * Where one number came from: the laps it was measured over, the fact that
   * nothing in this store measured it, or a number rondo was given.
   *
   * `tier` is the model tier when the measurement fell through to it, and null
   * when the rows are the agent type's own. **No D-number** (rule 5 of this
   * catalogue's own bounds): the default review rounds cited one until
   * rondo#233 S3's screen review found it in front of a person, folded but
   * present, in four of the five budgets.
   */
  readonly scopeBasisRows: (measurement: string, laps: number, tier: string | null) => string;
  readonly scopeBasisColdStart: (measurement: string) => string;
  readonly scopeBasisPlans: (plans: number) => string;
  readonly scopeBasisRounds: (rounds: number, byDefault: boolean) => string;
  readonly scopeBasisReplyAllowance: string;
  /** A `rows` basis's lap, drawn as a link into that lap's answer view and never as an id to copy. */
  readonly scopeBasisLap: (iterationId: string) => string;
  /**
   * The caveat above the budgets (rondo#247): the draft assumes the request is
   * the size of the laps it measured, and nothing recorded can say whether it is.
   */
  readonly scopeSampleHeading: string;
  /** `tier` is set when the laps are other agent types' on this one's tier. */
  readonly scopeSampleRows: (
    laps: number,
    tier: string | null,
    lowest: string,
    highest: string,
  ) => string;
  readonly scopeSampleColdStart: (reserve: string) => string;
  readonly scopeDefaultsHeading: string;
  readonly scopeDefaultNote: string;
  readonly scopeSeverityLabel: string;
  readonly scopeOutwardLabel: string;
  /**
   * One outward act as a person reads it. The enum value is the token a scope
   * records and `rondo scope` prints, so it stays beside the words rather than
   * being replaced by them (rule 3).
   */
  readonly scopeOutwardAct: (act: string) => string;
  readonly scopeOutwardNone: string;
  readonly scopeIrreversibleNone: string;
  /** D-0066's gate answer 1: what the cost budget does not see, on both states of the screen. */
  readonly scopeCostCaveat: string;
  readonly scopePressNote: string;
  readonly scopePlain: string;
  /** The approval this screen's second state is showing, and the digest it was made over. */
  readonly scopeApproved: (since: string) => string;
  readonly scopeDigest: (digest: string) => string;
  readonly scopeNotThisRequest: string;
  /** What a superseded scope's approval spent, which is part of what a successor decides (rule 1.4). */
  readonly scopePredecessorSpent: (laps: number, usd: string, unread: number) => string;
  readonly scopePredecessorNoApproval: string;
  readonly scopePredecessorUnreadable: (reason: string) => string;
  /**
   * Why this approval has no start button: a later scope replaced it (rule
   * 1.4), and `scopeVerdict` would refuse the press at the `superseded` test.
   * Said where the button was, rather than drawn and refused.
   */
  readonly scopeRetired: string;
  /** The scoped start, beside the approval it runs under. */
  readonly startAction: string;
  readonly startPlain: string;
  readonly startNote: string;
  /**
   * That a second press of this button is one lap and not two (rondo#244).
   *
   * **Said because it is true and was not said.** `startScopedFromPage` holds
   * the in-flight start per lap id and joins a second press to the first, so
   * the one press on this page that spends money is already safe to repeat --
   * and it was the only one saying nothing about it, while every refusal
   * screen says *pressing again is safe* out loud. The sentence is about this
   * button, which is the whole of what the id it carries covers.
   */
  readonly startAgainSafe: string;
  /**
   * Why a press recorded or started nothing, one sentence each, with no id and
   * no D-number in front of a person -- {@link sendRefusedForm}'s rule applied
   * to this screen's two presses.
   */
  readonly scopeRefusedNoApprover: string;
  readonly scopeRefusedPress: string;
  readonly scopeRefusedForm: string;
  readonly scopeRefusedFields: string;
  readonly scopeRefusedNotTaken: string;
  /**
   * The plan moved between the draw and the press, so the workspace and the
   * agent type on the screen are not the ones on disk.
   *
   * D-0066 rule 2.2 asks that the approval names what was shown, and a scope
   * recorded over a re-read plan satisfies its letter while approving a
   * workspace and an agent type nobody saw (rondo#233 S3 press review). The
   * form carries the two digests it was drawn from and the write compares them;
   * the redraw is the person's own reload.
   */
  readonly scopeRefusedPlanChanged: string;
  /**
   * The form was recorded once already and has been edited since.
   *
   * The id is minted per draw, so a second press of an edited form is refused
   * by the store on the id and the numbers on the screen are not the numbers
   * stored. Saying *approved* about numbers the person has just replaced is the
   * screen lying; this says which it is.
   */
  readonly scopeRefusedEdited: string;
  readonly scopeRefusedNotRead: string;
  readonly scopeRefusedNotShown: string;
  readonly scopeRefusedNotApproved: string;
  readonly startRefusedNoApprover: string;
  readonly startRefusedPress: string;
  readonly startRefusedForm: string;
  readonly startRefusedNoPlan: string;
  readonly startRefusedNoRequest: string;
  readonly startRefusedNoContinuo: string;
  /** The `test` token is the `ScopeTest` name, ASCII in both sets (rule 3). */
  readonly startRefusedOutside: (test: string) => string;
  readonly startRefusedNotAdmitted: string;
  /** Script off, a refused press lands on its own page: the way back to this screen. */
  readonly scopeBack: string;

  /**
   * The gate's other answer (rondo#233 S4, D-0070): ask for a change instead of
   * approving, with rondo's draft of what to change already in the box.
   */
  readonly reviseAction: string;
  readonly reviseFold: string;
  readonly revisePlain: string;
  readonly reviseLabel: string;
  readonly revisePlaceholder: string;
  readonly reviseNote: string;
  /**
   * Why there is no revise here: the lap was not admitted under an approval, so
   * a second lap has no budget to be counted against (D-0070 section 1.2). Said
   * where the form would be, rather than drawing a press that cannot work.
   */
  readonly reviseNoScope: string;
  /**
   * How rondo lays out the drafted instruction around the drafter's words
   * (D-0077 rule 3.4): per finding, its line with its severity, its bases
   * under it, then the drafter's words for it. **The findings themselves are
   * never translated** -- they are the reviewer's own words, quoted byte for
   * byte (rule 4 of this file) -- and the lead and the words are the drafter's.
   */
  readonly reviseDraftFinding: (severity: string, text: string) => string;
  readonly reviseDraftBases: (bases: string) => string;
  readonly reviseDraftChange: (words: string) => string;
  /**
   * What is said beside the box (D-0077 section 4, written under D-0076): a
   * draft is in it; one is being written (rule 4.3); none could be written
   * (rule 4.2), in rule 4.1's order; and a draft landed after the person began
   * writing, so their own words were kept (rule 4.4).
   */
  readonly reviseDrafted: string;
  readonly reviseDrafting: string;
  readonly reviseUndrafted: string;
  readonly reviseDraftArrived: string;
  /** D-0076 rule 4.5: the closed fold holding rondo's own reason, and whom it is for. */
  readonly forMaintainer: string;
  /** Why a revise press answered nothing, one sentence each, as the scope screen's are. */
  readonly reviseRefusedNoApprover: string;
  readonly reviseRefusedPress: string;
  readonly reviseRefusedForm: string;
  readonly reviseRefusedNoWords: string;
  readonly reviseRefusedGateClosed: string;
  /**
   * The press named an approval that is not the one this lap was admitted
   * under, or the lap was admitted under none (rondo#233 S4, Codex round 2).
   * The page draws the right one, so a person reading this has a screen that
   * went stale under them -- or a form that was edited.
   */
  readonly reviseRefusedNotItsScope: string;
  /**
   * The same form is already being pressed with other words (Codex round 3):
   * the second press is refused rather than folded into the first, because a
   * press answered *sent* over words nobody sent is the one thing this screen
   * exists not to do.
   */
  readonly reviseRefusedStillRunning: string;
  readonly reviseRefusedNotSetUp: string;
  readonly reviseRefusedNoContinuo: string;
  /** The `test` token is the `ScopeTest` name, ASCII in both sets (rule 3). */
  readonly reviseRefusedOutside: (test: string) => string;
  /**
   * The walk stopped part way, so whether the words reached the gate is not a
   * fact rondo holds (rondo#233 S4, Codex round 1). Said as the one thing that
   * is true -- look before pressing again -- and never as "nothing happened".
   */
  readonly reviseRefusedWalkFailed: string;
  /**
   * The gate took the words and the lap that was answered did not settle, so no
   * second lap started and no scope refused anything (Codex round 2): kept
   * apart from {@link reviseRefusedAfterGate}, whose sentence points at a
   * message in the request's thread that this case never wrote.
   */
  readonly reviseRefusedNotSettled: string;
  /**
   * The one refusal that lands after the gate was answered (D-0070 section
   * 2.4): the person's words are recorded at continuo and no second lap ran.
   */
  readonly reviseRefusedAfterGate: string;
  readonly reviseRefusedNotStarted: string;
  /**
   * The lap's approval was raised twice, separately, so its line has two tips
   * and neither is spent (D-0074 rule 2.1). Said where the form would be, and
   * as the press's refusal for a page drawn before the second raise.
   */
  readonly reviseForked: string;
  readonly reviseRefusedForked: string;

  /**
   * Raising a running lap's budget (D-0074 section 4). **Written for the
   * person who asked for the work** (D-0076): no id, and none of rondo's own
   * words -- an attempt, what you approved, the work waiting for you.
   *
   * {@link raiseNeeded} is the gate view's sentence when a budget closes the
   * change path, in D-0076 rule 4.1's order (what cannot happen, that nothing
   * was spent, what they can do), with `why` one of the three `raiseWhy*`.
   */
  readonly raiseNeeded: (why: string) => string;
  readonly raiseWhyLaps: (laps: number) => string;
  readonly raiseWhyCost: (spent: string, reserve: string, cost: string) => string;
  readonly raiseWhyExpiry: (at: string) => string;
  /** The way from the gate view to the raise screen. */
  readonly raiseLink: string;
  readonly raiseLead: string;
  readonly raiseWasHeading: string;
  readonly raiseWas: (laps: number, cost: string, until: string) => string;
  readonly raiseUsed: (attempts: number, usd: string, unread: number) => string;
  /** D-0074 rule 1.2: the new budgets are from here on, not totals. */
  readonly raiseFromHere: string;
  /** D-0074 rule 2.4: the earlier approval admits nothing new, for any request. */
  readonly raiseRetires: string;
  /** D-0074 rule 3.4: a stop the refusal wrote is not lifted by raising. */
  readonly raiseAskStands: string;
  readonly raiseAskLink: string;
  /** The raise screen, drawn for an approval that is no longer the line's tip. */
  readonly raiseNotTip: string;
  readonly raisePressNote: string;
  readonly raiseAction: string;
  readonly raisePlain: string;
  /** Why a raise press recorded nothing (D-0074 rule 4.4). */
  readonly raiseRefusedNotTip: string;
  readonly raiseRefusedForked: string;
  readonly raiseRefusedNotAtGate: string;

  /**
   * The publish screen (rondo#233 S5, D-0059 section 5a's row for it): the
   * dry-run in the page's words, and the one press that runs it.
   *
   * **No flag is named in any of these** -- the command line's own sentences
   * end in `--despite-review` and `--allow-remote-mismatch`, and a flag is a
   * terminal, which is the one place this page must never send a person. What
   * the page offers instead is a second button with the refusal it overrules
   * drawn above it.
   */
  readonly publishAction: string;
  readonly publishHere: string;
  /**
   * What a publish of this lap came to, on the row it was pressed from
   * (rondo#245).
   *
   * **Past tense, and the three legs by name.** The press is the one act on
   * this page that leaves the machine and the one that cannot be repeated, so
   * a row that says nothing after it sends a person to the forge to find out.
   * The pull request is a link rather than a URL to copy, for the reason every
   * other locator on this page is.
   */
  readonly published: (branch: string | null, runId: string | null) => string;
  readonly publishedPullRequest: string;
  /**
   * What one piece of work holds while it is open, so nothing else changes the
   * same files (D-0073 rule 12). `paths` are the person's own; `/` is the whole
   * repository.
   */
  readonly holds: (paths: readonly string[]) => string;
  /** The group of finished work whose change has not been found on the default branch. */
  readonly heldHeading: (count: number) => string;
  /** Why a finished row still holds its files, and what that costs other work. */
  readonly notLanded: string;
  /** A finished row whose change rondo found on the default branch. */
  readonly landed: string;
  /** A finished row whose files a person released. */
  readonly releasedByPerson: string;
  /** The way from a row to the screen that releases its files. */
  readonly releaseLink: string;
  readonly releaseHeading: string;
  readonly releaseLead: string;
  readonly releaseWorkHeading: string;
  readonly releaseHoldsHeading: string;
  readonly releaseWhyHeading: string;
  /** Why rondo has not let go of the files by itself (D-0073 rules 6 and 6.4). */
  readonly releaseWhy: readonly string[];
  readonly releaseEffectHeading: string;
  /** What the press does, and what it leaves alone. */
  readonly releaseEffect: readonly string[];
  readonly releaseAction: string;
  readonly releasePlain: string;
  readonly releaseBack: string;
  /** The screen, where the work holds nothing now. */
  readonly releaseNothingHeld: string;
  /** The screen, where a part of the work is still running or waiting at review. */
  readonly releaseStillOpen: string;
  readonly releaseRefusedNoApprover: string;
  readonly releaseRefusedPress: string;
  readonly releaseRefusedForm: string;
  readonly releaseRefusedChanged: string;
  readonly releaseRefusedNotRecorded: string;
  /** A drafted plan that other work's files hold back (D-0073 rule 3.1). */
  readonly planHeld: (paths: readonly string[]) => string;
  /** The label before the request of the work that holds them. */
  readonly planHeldBy: string;
  /** {@link planHeld} where every work holding them has finished. */
  readonly planHeldFinished: (paths: readonly string[]) => string;
  /** Where that work has finished: starting reads whether it landed first. */
  readonly planHeldTry: string;
  /** A start refused because other work holds the files (D-0073 rule 3.1). */
  readonly startRefusedHeld: string;
  readonly publishHeading: string;
  readonly publishLead: string;
  /** The lead where there is no press: the same fact, without the button's half. */
  readonly publishNotYetLead: string;
  /** The lead where the only press is the one that overrules the reading. */
  readonly publishReviewLead: string;
  readonly publishNotYetHeading: string;
  /** What would happen, one line per leg, with nothing to copy or type. */
  readonly publishPushes: (branch: string, remote: string) => string;
  readonly publishOpens: (repo: string, base: string) => string;
  readonly publishCloses: (runId: string) => string;
  /** Where that push actually goes, which is what a moved destination moves. */
  readonly publishPushUrl: (url: string) => string;
  readonly publishWorkspace: (workspace: string) => string;
  readonly publishTargetHeading: string;
  readonly publishRequestHeading: string;
  readonly publishTitleLabel: string;
  readonly publishBodyLabel: string;
  /** The body drawn or byte for byte (rondo#248): the pair's name, its two sides, the exact side's line. */
  readonly publishBodyViewLegend: string;
  readonly publishBodyPreview: string;
  readonly publishBodyRaw: string;
  readonly publishBodyRawNote: string;
  readonly publishNoticedHeading: string;
  /** The model's reading, material beside the rest and read by nothing (D-0065 5.5). */
  readonly publishModelHeading: string;
  readonly publishModelNote: string;
  readonly publishNote: string;
  readonly publishPlain: string;
  readonly publishBack: string;
  /** Why there is no publish screen at all: this host cannot publish from the page. */
  readonly publishNotOffered: string;
  /** Why this lap cannot be published, one sentence each ({@link PublishBlock}). */
  readonly publishNotClosed: (status: string) => string;
  readonly publishNotApproved: (outcome: string) => string;
  readonly publishNoRun: string;
  readonly publishPlanField: (field: string) => string;
  /** Nowhere to open a pull request: neither the lap nor the host names one. */
  readonly publishNoRepo: string;
  readonly publishTargetRefused: (reason: string) => string;
  readonly publishUncommitted: (paths: string) => string;
  readonly publishUncommittedElsewhere: (branch: string) => string;
  readonly publishUncommittedRemedies: string;
  /** Why the reading does not cover this work, one sentence each ({@link ReviewBlock}). */
  readonly publishReviewHeading: string;
  readonly publishReviewNoReading: string;
  readonly publishReviewNotClear: (verdict: string, findings: string) => string;
  readonly publishReviewNoEvidence: string;
  readonly publishReviewUnreadable: (reason: string) => string;
  readonly publishReviewMoved: (readTip: string, nowTip: string) => string;
  /** The second press, which overrules exactly the refusal drawn above it. */
  readonly publishDespiteFold: string;
  readonly publishDespiteAction: string;
  readonly publishDespiteNote: string;
  readonly publishDespitePlain: string;
  /** Why a publish press published nothing, one sentence each. */
  readonly publishRefusedNoApprover: string;
  readonly publishRefusedPress: string;
  readonly publishRefusedForm: string;
  readonly publishRefusedGone: string;
  readonly publishRefusedNotClosed: string;
  readonly publishRefusedNotApproved: string;
  readonly publishRefusedNoRun: string;
  readonly publishRefusedPlanField: string;
  readonly publishRefusedNoRepo: string;
  readonly publishRefusedTarget: (detail: string) => string;
  readonly publishRefusedUncommitted: (detail: string) => string;
  readonly publishRefusedNotRead: string;
  readonly publishRefusedNothingOverruled: string;
  readonly publishRefusedChanged: string;
  readonly publishRefusedStillRunning: string;
  readonly publishRefusedNoContinuo: string;
  readonly publishRefusedPushFailed: (detail: string) => string;
  readonly publishRefusedPullRequestFailed: (detail: string) => string;
  readonly publishRefusedRunNotClosed: string;
  readonly publishRefusedNotStarted: string;
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

  waitingHeading: (count) => `waiting for your answer (${String(count)})`,
  runningHeading: (count) => `running now (${String(count)})`,
  endedHeading: (count) => `just finished (${String(count)})`,
  waitingHead: (status, waited) => `${status} -- waiting ${waited}`,
  runningHead: (status, ran) => `${status} -- running ${ran}`,
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
  endedAgo: (since) => `${since} ago`,
  noReasonRecorded: "no reason recorded",
  proposalBasis: (proposalId) =>
    `read it back with its options and what each rests on: rondo show --proposal-id ${proposalId}`,
  proposalHead: (kind, waited) => `${kind} -- waiting ${waited}`,
  aboutIteration: (iterationId) =>
    iterationId === null ? "about no iteration" : `about '${iterationId}'`,
  willNotDecode: (reason) => `will not decode: ${reason}`,

  spent: (cost, turns, took) => `${cost}, ${turns}, ${took}`,
  costRead: (usd) => `cost $${usd}`,
  costNotRead: "cost not read",
  turnsRead: (turns) => `${String(turns)} turns`,
  turnsNotRead: "turns not read",
  durationNotRead: "duration not read",
  fenceUnknown: "the fence: continuo could not tell what it refused",
  fenceRefusedNothing: "the fence refused nothing",
  fenceRefused: (denials) => `the fence refused ${denials}`,

  nothingAtAll: "Nothing is waiting on you, nothing is running, and nothing has finished.",
  nothingBasis:
    "every live row and every ended row in this ledger; the reading below cites what each read " +
    "found",

  pressNote: "What pressing approve records as shown, and what it would be over:",
  approveNote: (gateId, word) =>
    `answers gate ${gateId} as '${word}', which is what rondo answer does`,
  approvePlain: "Accept this work as it is.",
  approveDespite: "approve despite what was raised",
  approveDespitePlain:
    "Accept this work as it is, with what the model review raised left unanswered.",
  undeterminedFold: (count) =>
    `${String(count)} ${count === 1 ? "field" : "fields"} rondo could not determine`,
  answerHere: "read what a press would record, and answer there",
  answerAction: "Review and answer",

  requestsNav: "Requests",
  requestsHeading: (count) => `requests (${String(count)})`,
  noRequests: "No request has been written yet. Write one below, in your own words.",
  threadSize: (count, since) =>
    `${String(count)} ${count === 1 ? "message" : "messages"}, last ${since} ago`,
  asksWaiting: (count) =>
    `${String(count)} ${count === 1 ? "question" : "questions"} waiting on you`,
  askWaitingPill: "Waiting on you",
  askStoppedPill: "You stopped this line",
  answerStoppedPill: "Stopped this line",
  answerCarriedOnPill: "Carried on",
  you: "you",
  operatorVoice: "operator",
  drafterVoice: "drafter",
  drafterNoDraft:
    "rondo could not draft this request, so nothing has been proposed. You can set the scope " +
    "yourself.",
  drafterNoDraftWhy: "What stopped it",
  issueVoice: "issue",
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
  askedIn: (request) => `asked in: ${request}`,
  inReplyTo: (who, words) => `in reply to ${who}: ${words}`,
  basesLabel: "rests on",
  replyAction: "Reply",
  openThread: "Open the thread",
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
  threadNoReload:
    "With scripting off this view does not reload itself, so nothing you are writing is thrown away: reload it to see new messages.",
  liveShort: (seconds) => `Live, updates every ${String(seconds)}s`,
  stillShort: "Holds still while you read",
  age: (ago) => ago,
  waitingCount: (count) => `${String(count)} waiting`,
  signedInAs: (actorId) => `You send and answer as ${actorId}`,
  backToRequests: "Back to requests",
  reloadThread: "Reload for new messages",
  threadStarted: (since) => `started ${since} ago`,
  replyDefault: "Reply to the latest message instead",
  attentionHeading: (count) => `needs attention (${String(count)})`,
  unreadableTitle: "A run's record cannot be read",
  unreadableAction: (iterationId) =>
    `The record of ${iterationId} will not read, so it cannot be shown or answered here, and it still takes a run slot. Read what went wrong; the slot frees once the record is repaired or the run is withdrawn.`,
  unreadableDetail: "What rondo could not read",
  unreadableRead: "Read what went wrong",
  blockedCount: (count) => `blocked ${String(count)} command${count === 1 ? "" : "s"}`,
  blockedNothing: "blocked nothing",
  blockedUnknown: "not known what was blocked",
  logFound: "log found",
  logNotYet: "no log yet",
  logUnchecked: (reason) => `could not check for a log: ${reason}`,
  logNotLookedFor: "log not looked for yet",
  logOpen: "Read the log",
  logOpenHere: "Read the commands this lap has run and what they returned, on this page",
  logHeading: "What this lap has run",
  logLead: (shown, total) =>
    shown === total
      ? `${String(total)} command${total === 1 ? "" : "s"}, newest first.`
      : `The newest ${String(shown)} of ${String(total)} commands, newest first. The ${String(total - shown)} before them are in the file below.`,
  logEmpty: "The log has no command in it yet.",
  logWhole: "The whole log is this file:",
  logUnfinished: "The lap is writing its next line; it shows here once it is finished.",
  logUnread: (reason) => `The log could not be read: ${reason}`,
  logGone: "There is no lap by that name.",
  logOutput: "Output",
  logOutputFailed: "Output -- failed",
  logFailed: "failed",
  logNoOutput: "No output recorded",
  logCutBefore: (characters) =>
    `The first ${characters.toLocaleString("en")} characters are not shown here.`,
  logCutAfter: (characters) =>
    `The last ${characters.toLocaleString("en")} characters are not shown here.`,
  logFinal: "The lap's final message",
  fenceHeading: "The fence:",
  whyStopped: "Why it stopped",
  whyNotRead: "The worker's own account could not be read; it is in the text below if it was.",
  workHeading: "What changed",
  changedAgainst: (baseRef) => `against ${baseRef}`,
  changedUnreadable: (reason) => `The workspace could not be read: ${reason}`,
  changedNoRange: "This run names no branch to compare, so there is nothing to list.",
  noCommits: "No commits on the branch.",
  noFiles: "No files changed.",
  binaryFile: "binary",
  moreRows: (count) => `and ${String(count)} more`,
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
  readingUnavailable: (reason) => `No reading could be taken: ${reason}`,
  readBy: (drafter) => `read by ${drafter}`,
  whatItRead: "What it read, and what it did not",
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
  answerNotDone: "Nothing was answered",
  gateBack: "Back to the gate",
  modelRaised: (blockers, majors) => `The model review raised ${raisedEn(blockers, majors)}.`,
  approvedOverRaised: (blockers, majors) =>
    `approved with ${raisedEn(blockers, majors)} open in the model review`,
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
  unreadableLead:
    "rondo could not read this run's record, so it cannot be shown or answered. What rondo found:",
  checkedEcho: (claim, by) =>
    by === null ? `you said you checked: ${claim}` : `${by} said they checked: ${claim}`,
  modelMayArrive: "The model review may still arrive.",
  liveLabel: "live",
  keyMove: "move",
  keyOpen: "open",
  keyBack: "back",
  keyWrite: "write",

  openReading: "Show the full reading: every claim with its basis",
  hideReading: "hide the reading",
  inboxHeading: "the inbox",
  inboxNote: "Reading this does not move your last-look mark: that is what rondo inbox does.",
  inboxNoApprover: "RONDO_APPROVER is not set, so there is no identity whose inbox this would be.",
  betweenHeading: "what spans the live laps",
  betweenNote:
    "An adjacency is not a collision: two laps open against one base branch is where to look, " +
    "not what was found.",
  iterationHeading: (iterationId) => `iteration '${iterationId}'`,
  explainNote: "This explanation binds nothing: it is not a proposal and cannot be approved.",

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
  noId: "(no id)",
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
  scopeHere: "Draft what this request is allowed to spend, and approve it",
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
  reviseFold: "Ask for a change instead",
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
    "Nothing was answered and the gate was not touched: the second lap could not be set up. The " +
    "terminal running rondo has what it said.",
  reviseRefusedNoContinuo:
    "Nothing was answered: the part of rondo that runs the work will not start.",
  reviseRefusedOutside: (test) =>
    `Nothing was answered and nothing was spent: a second lap is outside the scope this one ran ` +
    `under, at the ${test} test. The gate is untouched, and a message in the request's thread ` +
    `says what the choices are.`,
  reviseRefusedWalkFailed:
    "Answering this gate did not finish, and no second lap started. Your words may already have " +
    "reached it: go back and read how the gate stands before pressing again. The terminal " +
    "running rondo has what it said.",
  reviseRefusedNotSettled:
    "The gate was answered with your words, and no second lap started: the lap you answered did " +
    "not finish settling. Nothing was spent. The terminal running rondo has what it said.",
  reviseRefusedAfterGate:
    "The gate was answered with your words, and no second lap started: the approval would not " +
    "take another lap. What you wrote is recorded; a message in the request's thread says what " +
    "the choices are.",
  reviseRefusedNotStarted:
    "No second lap started. The terminal running rondo has what it said; nothing here is lost.",
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

  publishAction: "Publish",
  publishHere: "Read what publishing would do, and publish from there",
  published: (branch, runId) =>
    `Published: ${branch === null ? "the branch" : `the branch ${branch}`} is pushed, and ` +
    `${runId === null ? "the run" : `the run ${runId}`} is closed.`,
  publishedPullRequest: "The pull request",
  holds: (paths) => `Files it keeps to itself: ${filesEn(paths)}`,
  heldHeading: (count) => `finished, not yet on the default branch (${String(count)})`,
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
  publishHeading: "Publish this work",
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
  publishDespiteFold: "Publish without that reading",
  publishDespiteAction: "Publish anyway",
  publishDespiteNote:
    "That is yours to decide, and it is a second press of its own. rondo records that you " +
    "decided it; the reading stays where it is.",
  publishDespitePlain: "Publishes this work although the reading above does not cover it.",
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
    "exists, the only leg left is closing the run, and the terminal running rondo has the line.",
  publishRefusedRunNotClosed:
    "The branch is pushed and the pull request is open; the run did not close. That is the one " +
    "leg left, and the terminal running rondo has what it said.",
  publishRefusedNotStarted:
    "Nothing was published. The terminal running rondo has what it said; nothing here is lost.",
} satisfies Chrome);

/** The three measurements a basis names, in the Japanese set's words. */
const JA_MEASURE: Record<string, string> = {
  first_lap_cost: "初回周回の費用",
  redo_cost: "やり直した周回の費用",
  lap_duration: "周回の所要時間",
};

/**
 * Japanese, because it is the language of the operator who raised rondo#155 and
 * rondo#166.
 *
 * **Every token is the same bytes it is in {@link EN}.** `RONDO_APPROVER`,
 * `rondo inbox`, `rondo answer`, `rondo show --proposal-id ID`, `approve`, a
 * status, a record kind, a gate id, a proposal id and an iteration id are
 * things the operator types or matches against the store, `rondo show` and
 * continuo's own output (rule 2), so they sit in these sentences untranslated,
 * unglossed and without a parenthesis. What is rewritten is the prose around
 * them.
 *
 * The indentation of the inbox's lines is `en`'s, to the space: those lines are
 * read as a column in a `<pre>`, and a set that re-decided the leading spaces
 * would make the two languages two layouts.
 */
const JA: Chrome = Object.freeze({
  ...PAGE_JA,
  lang: "ja",

  liveNote: (seconds) =>
    `${String(seconds)}秒ごとに描き直しますが、描き直しは何も書き込みません。最後に見た印は動かず、
提示も数えられません。書き込むのは approve ボタンだけで、押した時点の説明を記録してからゲートに
答えます。`,
  stillNote: `押したときに記録されるのは、いま読んでいる内容そのものです。だから読んでいるあいだ、
画面がひとりでに書き換わることはありません。読むこと自体は何も書き込みません -- 最後に見た印は動かず、提示も
数えられません。書き込むのは approve ボタンだけで、押した時点の説明を記録してからゲートに答えます。`,
  noApproverNote:
    "RONDO_APPROVER が設定されていないので、このページが誰として答えることもできず、" +
    "その人の inbox も描けません。",

  waitingHeading: (count) => `あなたの答えを待っているもの (${String(count)})`,
  runningHeading: (count) => `いま動いているもの (${String(count)})`,
  endedHeading: (count) => `ちょうど終わったもの (${String(count)})`,
  waitingHead: (status, waited) => `${status} -- ${waited} 待機中`,
  runningHead: (status, ran) => `${status} -- ${ran} 実行中`,
  endedHead: (status, since, why) => `${status} ${since}前 -- ${why}`,
  gateAnswered: (outcome) =>
    outcome === APPROVED_OUTCOME ? "ゲートで承認された" : `ゲートに '${outcome}' と答えた`,
  statePill: (status, gateOutcome) =>
    (
      ({
        awaiting_human: "あなたの回答待ち",
        withdrawal_requested: "取り下げ依頼中",
        stalled: "停止中",
        planned: "開始中",
        classified: "開始中",
        admitting: "開始中",
        admitted: "開始中",
        performing: "実行中",
        closed:
          gateOutcome === "approve" || gateOutcome === APPROVED_OUTCOME
            ? "承認済み"
            : gateOutcome === "revise"
              ? "差し戻し"
              : gateOutcome === null
                ? "完了"
                : `完了: ${gateOutcome}`,
        abandoned: "放棄",
        failed: "失敗",
      }) as Record<string, string | undefined>
    )[status] ?? status,
  endedAgo: (since) => `${since}前`,
  noReasonRecorded: "理由は記録されていない",
  proposalBasis: (proposalId) =>
    `選択肢と各々の根拠つきで読み直す: rondo show --proposal-id ${proposalId}`,
  proposalHead: (kind, waited) => `${kind} -- ${waited} 待機中`,
  aboutIteration: (iterationId) =>
    iterationId === null ? "どの iteration についてでもない" : `'${iterationId}' について`,
  willNotDecode: (reason) => `読み取れません: ${reason}`,

  spent: (cost, turns, took) => `${cost}、${turns}、${took}`,
  costRead: (usd) => `費用 $${usd}`,
  costNotRead: "費用は読めていない",
  turnsRead: (turns) => `${String(turns)} ターン`,
  turnsNotRead: "ターン数は読めていない",
  durationNotRead: "所要時間は読めていない",
  fenceUnknown: "fence: continuo は何を拒否したか答えられませんでした",
  fenceRefusedNothing: "fence は何も拒否しませんでした",
  fenceRefused: (denials) => `fence が拒否したもの: ${denials}`,

  nothingAtAll: "あなたを待っているものも、動いているものも、終わったものもありません。",
  nothingBasis:
    "この台帳の live な行と終了した行のすべて。下の読み下しが、それぞれの読み取りで何が見つかったかを示します",

  pressNote: "approve を押すと「提示された」として記録される内容と、その対象:",
  approveNote: (gateId, word) =>
    `ゲート ${gateId} に '${word}' と答えます。rondo answer と同じ動作です`,
  answerHere: "押したときに何が記録されるかを読み、そこで答える",
  answerAction: "確認して答える",

  requestsNav: "依頼",
  requestsHeading: (count) => `依頼 (${String(count)})`,
  noRequests: "まだ依頼はありません。下の欄に、自分の言葉で書いてください。",
  threadSize: (count, since) => `メッセージ ${String(count)} 件、最後は ${since}前`,
  asksWaiting: (count) => `あなたへの質問 ${String(count)}`,
  askWaitingPill: "あなたの回答待ち",
  askStoppedPill: "あなたが止めた線",
  answerStoppedPill: "この線を止めた",
  answerCarriedOnPill: "続けた",
  you: "あなた",
  operatorVoice: "オペレーター",
  drafterVoice: "下書き役",
  drafterNoDraft:
    "rondo はこの依頼の下書きを作れなかったので、まだ何も提案されていません。範囲はご自身で" +
    "決められます。",
  drafterNoDraftWhy: "止まった理由",
  issueVoice: "イシュー",
  issueRead: (pullRequest, comments) =>
    `rondo がこの${pullRequest ? "プルリクエストの会話" : "イシュー"}` +
    `${comments === 0 ? "" : `とコメント ${String(comments)} 件`}を読みました。` +
    "作業者には書かれたとおりの全文が渡されます。",
  issueReadFold: "読んだ内容",
  issueNotRead: (why) =>
    ({
      no_gh: "この環境の rondo はまだイシューを読めません",
      signed_out: "この環境の rondo はまだイシューを読めません",
      no_repo: "この環境の rondo は、この番号がどのリポジトリのものかを知りません",
      missing: "このイシューが見つからないか、あなたのアカウントからは見えません",
      refused: "このイシューへのアクセスが、あなたのアカウントでは拒否されました",
      too_long: "イシューが長すぎて丸ごとは渡せず、一部だけを渡すこともしていません",
      too_many: "rondo が 1 つのメッセージから読むイシューは 5 件までで、これはその先でした",
      failed: "rondo はこのイシューを読めませんでした",
    })[why] + "。そのため作業者には、ここにあなたが書いたことだけが渡されます。",
  issueNotReadTail:
    "費用はかかっていません。イシューに依頼にないことが書かれていれば、別のメッセージで伝えて" +
    "ください。",
  issuePending: "rondo はまだこれを読んでいません。rondo がここで動いている間に読みます。",
  scopeIssuesHeading: "この依頼が名指ししたイシュー",
  scopeIssueGiven: "作業者に渡す",
  scopeIssueNotGiven: "渡さない: 読めなかった",
  scopeIssuePending: "まだ読んでいない",
  askedIn: (request) => `依頼: ${request}`,
  inReplyTo: (who, words) => `${who} への返信: ${words}`,
  basesLabel: "根拠",
  replyAction: "返信する",
  openThread: "スレッドを開く",
  replyingTo: (who, since) => `${who} に返信 · ${since}前`,
  answeringTo: (who, since) => `${who} の質問に回答 · ${since}前`,
  answerAskAction: "回答する",
  answerCarryOnAction: "続ける",
  answerStopAction: "この線を止める",
  answerOutcomeNote:
    "書いたとおりに送られます。「続ける」は仕事をもう一度試させ、「この線を止める」は止めたままにします。" +
    "あとから「続ける」こともできます。",
  newRequestHeading: "新しい依頼",
  requestPlaceholder: "何をしてほしいですか。話すときの言葉のまま書いてください。",
  replyPlaceholder: "返信を書く",
  sendAction: "送信",
  sendNote: "書いたとおりに送られます。直すときは、もう一度返信します。",
  keySend: "送信",
  composerNoApprover:
    "RONDO_APPROVER が設定されていないため、このページが誰として送るのかが決まりません。スレッドは読めますが、書き込めません。",
  noSuchThread: "そのメッセージを含む依頼スレッドはありません。",
  threadsUnreadable: (reason) => `依頼スレッドを読めませんでした: ${reason}`,
  notSent: (line) => `送信されませんでした。書いた文は残しています: ${line}`,
  sendRefusedNoApprover:
    "RONDO_APPROVER が設定されていないため、このページが誰として送るのかが決まりません。",
  sendRefusedForm:
    "このページ自身のフォームから届いていないか、ページが今の rondo より古いものです。ページを読み込み直してから、もう一度送信してください。",
  sendRefusedNoWords: "送る文がありません。",
  sendRefusedNotTaken:
    "会話がこのメッセージを記録しませんでした。返信先のメッセージがスレッドに無いのかもしれません。スレッドを読み込み直してから、もう一度試してください。",
  sendRefusedAsk:
    "返信先は、まだあなたの回答を待っている質問です。スレッドを開いて「回答する」を押してください。",
  sendRefusedTooLong:
    "このページが受け付けるより長いメッセージです。短くするか、2 つの返信に分けてください。",
  sendRefusedUnknown:
    "rondo はこのメッセージを受け取りませんでした。ページを読み込み直してから、もう一度送信してください。",
  answerRefusedPress:
    "回答は「回答する」ボタンを押したときだけ受け付けます。スレッドを読み込み直して、もう一度「回答する」を押してください。",
  replyNotAnswer: "返信しただけでは、このスレッドで待っている質問に答えたことになりません。",
  sendBack: "スレッドに戻る",
  sendBackNote: "ブラウザの「戻る」で、書いた文に戻れます。",
  threadsLiveNote: (seconds) =>
    `${String(seconds)}秒ごとに描き直しますが、描き直しは何も書き込みません。ここで書き込むのは送信だけで、` +
    "書いた文をそのまま RONDO_APPROVER の名前でスレッドに記録します。メッセージは何も承認しません。",
  threadNoReload:
    "スクリプトが無効なとき、この画面は自動で読み込み直しません。書きかけの文が消えないためです。新しいメッセージは読み込み直して確認してください。",
  approvePlain: "この作業をこのまま受け入れます。",
  approveDespite: "指摘を残したまま承認する",
  approveDespitePlain: "モデルレビューが挙げた点に答えないまま、この作業をこのまま受け入れます。",
  undeterminedFold: (count) => `rondo が決められなかった項目 ${String(count)} 件`,
  liveShort: (seconds) => `ライブ · ${String(seconds)}秒ごとに更新`,
  stillShort: "読んでいるあいだは更新しません",
  age: (ago) => {
    const unit = ago.slice(-1);
    const units: Record<string, string> = { s: "秒", m: "分", h: "時間", d: "日" };
    return units[unit] === undefined ? ago : `${ago.slice(0, -1)}${units[unit]}`;
  },
  waitingCount: (count) => `${String(count)} 件待ち`,
  signedInAs: (actorId) => `${actorId} として送信・回答します`,
  backToRequests: "依頼の一覧に戻る",
  reloadThread: "読み込み直して新着を見る",
  threadStarted: (since) => `${since}前に開始`,
  replyDefault: "最新のメッセージへの返信に戻す",
  attentionHeading: (count) => `確認が必要なもの (${String(count)})`,
  unreadableTitle: "実行の記録を読み取れません",
  unreadableAction: (iterationId) =>
    `${iterationId} の記録が読み取れないため、ここでは表示も回答もできません。実行枠はまだ使っています。何が起きたかを読んでください。記録が直るか実行が取り下げられると枠は空きます。`,
  unreadableDetail: "rondo が読み取れなかった内容",
  unreadableRead: "何が起きたかを読む",
  blockedCount: (count) => `${String(count)} 件のコマンドを止めた`,
  blockedNothing: "止めたコマンドなし",
  blockedUnknown: "止めたコマンドは不明",
  logFound: "ログあり",
  logNotYet: "ログはまだありません",
  logUnchecked: (reason) => `ログを確認できませんでした: ${reason}`,
  logNotLookedFor: "ログはまだ探していません",
  logOpen: "ログを読む",
  logOpenHere: "この周回が実行したコマンドとその結果を、この画面で読む",
  logHeading: "この周回が実行したコマンド",
  logLead: (shown, total) =>
    shown === total
      ? `全 ${String(total)} 件。新しいものが上です。`
      : `全 ${String(total)} 件のうち、新しい ${String(shown)} 件です。新しいものが上です。それより前の ${String(total - shown)} 件は下のファイルで読めます。`,
  logEmpty: "ログにはまだコマンドがありません。",
  logWhole: "ログの全体はこのファイルにあります:",
  logUnfinished: "いま次の行を書いているところです。書き終わるとここに出ます。",
  logUnread: (reason) => `ログを読み取れませんでした: ${reason}`,
  logGone: "その名前の周回はありません。",
  logOutput: "出力",
  logOutputFailed: "出力 (失敗)",
  logFailed: "失敗",
  logNoOutput: "出力の記録はありません",
  logCutBefore: (characters) =>
    `先頭の ${characters.toLocaleString("ja")} 文字はここには出していません。`,
  logCutAfter: (characters) =>
    `末尾の ${characters.toLocaleString("ja")} 文字はここには出していません。`,
  logFinal: "周回の最後のメッセージ",
  fenceHeading: "実行の制限:",
  whyStopped: "止まった理由",
  whyNotRead: "作業者自身の説明は読み取れませんでした。読めていれば下のテキストにあります。",
  workHeading: "変わったもの",
  changedAgainst: (baseRef) => `${baseRef} との比較`,
  changedUnreadable: (reason) => `作業場所を読み取れませんでした: ${reason}`,
  changedNoRange: "比べる相手のブランチが記録されていないので、変更を一覧にできません。",
  noCommits: "ブランチにコミットはありません。",
  noFiles: "変わったファイルはありません。",
  binaryFile: "バイナリ",
  moreRows: (count) => `ほか ${String(count)} 件`,
  checksHeading: "チェック",
  modelHeading: "モデルレビュー",
  verdictPill: (verdict, count) =>
    verdict === "clear"
      ? "指摘なし"
      : verdict === "concerns"
        ? `指摘 ${String(count)} 件`
        : verdict === "unavailable"
          ? "取れず"
          : verdict,
  checksNone:
    "作業をチェックした記録がありません。公開するときに、それで進めてよいかを確認します。",
  checksCounted: (commits, files) =>
    `コミット ${String(commits)} 件とファイル ${String(files)} 件を読みました。`,
  readingUnavailable: (reason) => `読み取りを取れませんでした: ${reason}`,
  readBy: (drafter) => `読んだもの: ${drafter}`,
  whatItRead: "読んだものと読んでいないもの",
  basisNone: "根拠の指定なし",
  basisUnresolved: "どれも渡した作業と一致しませんでした",
  modelPending: "まだ届いていません。これから届くかもしれません。",
  modelOlder:
    "以前のコミットを読んだ結果です。いまのコミットを読んだ結果は、これから届くかもしれません。",
  reloadPage: "読み込み直す",
  readingsNote: "どちらの読み取りも判断材料です。どちらも何も承認しません。答えるのはあなたです。",
  allAsText: "記録全文 (上に出していない項目も含む)",
  claimLabel: "確認したこと (承認と一緒に記録されます)",
  claimPlaceholder: "例: 手元でテストを実行した / 差分を読んだ / スマートフォンで画面を開いた",
  claimTooLong: (max) =>
    `確認した内容が、このページで受け付ける ${String(max)} 文字より長くなっています。短くしてから、もう一度 approve を押してください。`,
  claimGateUnread:
    "rondo がこのゲートを読めなかったため、確認した内容は記録していません。ゲートに戻って、もう一度試してください。",
  claimGateClosed:
    "ゲートがすでに回答済みだったため、確認した内容は記録していません。ゲートに戻ると、どう終わったかを確認できます。",
  claimNotRecorded:
    "rondo が確認した内容を記録できなかったため、何も回答していません。ゲートに戻って、もう一度試してください。",
  answerNotDone: "回答されませんでした",
  gateBack: "ゲートに戻る",
  modelRaised: (blockers, majors) => `モデルレビューの指摘: ${raisedJa(blockers, majors)}。`,
  approvedOverRaised: (blockers, majors) =>
    `モデルレビューの指摘 (${raisedJa(blockers, majors)}) を残したまま承認`,
  modelRaisedLink: "読む",
  severityWord: (severity) =>
    ({ blocker: "阻害", major: "重大", minor: "軽微", nit: "細部" })[severity] ?? severity,
  severityCount: (severity, count) =>
    `${({ blocker: "阻害", major: "重大", minor: "軽微", nit: "細部" })[severity] ?? severity} ${String(count)} 件`,
  readingNotTaken: "読み取りを取れなかったため、判断材料はありません。",
  whyNotTaken: "理由",
  checksWorkUnreadable:
    "いまは変わったものを読み取れないため、この読み取りを作業と照らし合わせられません。",
  checksNotMatched: "照合できず",
  modelNotTaken: "チェックだけが読みました。モデルレビューは取れていません。",
  neitherReadingTaken: "チェックもモデルレビューも、この作業を読めませんでした。",
  recordsFold: (count) => `approve で記録される内容 (${String(count)} 項目) と記録全文`,
  denialUnreadable: "どのコマンドだったかを rondo は記録できませんでした。",
  unreadableLead:
    "この実行の記録を rondo が読み取れないため、表示も回答もできません。rondo が見つけた内容:",
  checkedEcho: (claim, by) =>
    by === null ? `確認したこと: ${claim}` : `${by} が確認したこと: ${claim}`,
  modelMayArrive: "モデルレビューはこれから届くかもしれません。",
  liveLabel: "ライブ",
  keyMove: "移動",
  keyOpen: "開く",
  keyBack: "戻る",
  keyWrite: "書く",

  openReading: "読み下しをすべて表示: 根拠つきのすべての主張",
  hideReading: "読み下しを閉じる",
  inboxHeading: "inbox",
  inboxNote: "ここを読んでも最後に見た印は動きません。印を動かすのは rondo inbox です。",
  inboxNoApprover: "RONDO_APPROVER が設定されていないので、誰の inbox かを決められません。",
  betweenHeading: "live な lap にまたがっているもの",
  betweenNote:
    "隣接は衝突ではありません。ひとつの base branch に対して 2 つの lap が開いているというのは、" +
    "見るべき場所であって、見つかった事実ではありません。",
  iterationHeading: (iterationId) => `iteration '${iterationId}'`,
  explainNote:
    "ここにあるのは説明で、proposal ではありません。何も拘束せず、承認することもできません。",

  inboxFor: (actorId) => `'${actorId}' の inbox`,
  waitingOnYou: "あなたを待っているもの",
  bindingProposals: (count) => `  承認すると契約になる proposal (${String(count)})`,
  nonBindingProposals: (count) => `  何も拘束しない proposal (${String(count)})`,
  readOneBack: "    選択肢と各々の根拠つきで 1 件読み直す: rondo show --proposal-id ID",
  iterationsWaiting: (count) => `  あなたを待っている iteration (${String(count)})`,
  newMark: "  新着",
  proposalLine: (proposalId, kind, about, waited) =>
    `    ${proposalId}  ${kind}  ${about}  ${waited} 待機中`,
  waitingLine: (iterationId, status, waited, unblockedBy) =>
    `    ${iterationId}  ${status}  ${waited}  ${unblockedBy}`,
  inFlightHeading: (count) => `実行中 (${String(count)})`,
  inFlightLine: (iterationId, status, since, where) =>
    `  ${iterationId}  ${status}  ${since}  ${where}`,
  unreadableLine: (id, reason) => `  ${id}  読み取れません: ${reason}`,
  changedHeading: (since, records) =>
    `最後に見てから ${since}前 に変わったもの (${String(records)} 件)`,
  changedHeadingNever: "最後に見てから",
  neverLooked: "  まだ一度も見ていません: 以下に new の印は付きません",
  nothingChanged: "  なし",
  censusEntry: (kind, count) => `${kind} ${String(count)}`,
  changeLine: (kind, id, since) => `    ${kind}  ${id ?? "(id なし)"}  ${since}前`,
  noId: "(id なし)",
  silenceHeading: "あなたに示されたものと、示されなかったもの",
  countedLine: (what, presented, withheld) =>
    `${what}: 提示 ${String(presented)}、留保 ${String(withheld)}`,
  overAllTime: "全期間",
  sinceLastLook: (since) => `最後に見た ${since}前 から`,
  neverLookedSince: "  最後に見てから: まだ一度も見ていません",
  withheldBy: (ruleName, count) => `'${ruleName}' により留保 ${String(count)}`,
  unnamedRule: "(名前なし)",
  unspentHeading: (count) => `承認されたまま使われていないもの (${String(count)})`,
  unspentLine: (decisionId, proposalId, approved, actorId, since) =>
    `  ${decisionId}  proposal ${proposalId}  ${approved}  '${actorId}' が ${since}前 に`,

  noGateDecide: "ゲートはありません: 人が判断する必要があります",
  noGateReleases: (gateId) =>
    `ゲートに答えても解除されません (${gateId} で停止): 人が判断する必要があります`,
  suspendedNoGate: "gate id が記録されないまま中断されたので、rondo はゲートを名指しできません",
  answerGate: (gateId) => `ゲート ${gateId} に答える`,
  runsIn: (transcript, workspace) => `${transcript}  場所は ${workspace}`,
  noWorkspace: "(行に workspace がありません)",
  transcriptNotLookedFor: "transcript (まだ開始していない行なので探していません)",
  transcriptNotNamed: (reason) => `transcript (名指しできません: ${reason})`,
  transcriptAt: (directory, sessions) =>
    `transcript ${directory}${sessions > 1 ? `  (${String(sessions)} セッション中の最新)` : ""}`,

  declarationCaveat: Object.freeze([
    "ここにあるのは run 自身の declaration で、fence の全体ではありません。continuo は",
    "role のテンプレートを同じ allow リストへ展開しますが、rondo はここでそれを読みません。",
  ]),
  secondFence: Object.freeze([
    "worker 自身の sandbox は第二の封じ込めですが、rondo はそれを観測しません。何も拒否",
    "しないまま起動に失敗しうるので、sandbox が無効なまま走った lap もそうでない lap と",
    "まったく同じように表示されます。それを報告したことがあるのは、ゲートに置かれた",
    "worker 自身の記述だけです (D-0050)。",
  ]),

  scopeAction: "範囲を決める",
  scopeHere: "この依頼に使ってよい範囲を下書きして承認する",
  scopeHeading: "この依頼の範囲",
  backToThread: "依頼に戻る",
  scopeLead:
    "範囲を決めるのはあなたです。プランは rondo が持っているものから選び、数値はこのストアに" +
    "記録された周回から出しています。読んで、変えたいところを変えてください。1 回押せば記録と" +
    "承認の両方が行われます。",
  scopeNoPlanHeld:
    "この作業に使えるプランを rondo はまだ持っていません。このマシンでの rondo のセットアップから、" +
    "まだプランを受け取っていないためです。",
  scopePlansUnread: (reason) =>
    `rondo が持っているプランを読めなかったので、選べるものがありません: ${reason}`,
  scopePlanAsk: "作業に使うプラン",
  scopePlanGone:
    "選んだプランは、この依頼ではもう使えなくなりました。次の中から選び直してください。",
  scopePlanFrom: (from) =>
    from === "message"
      ? "このスレッドに貼られたもの"
      : from === "setup"
        ? "このマシンのセットアップで用意したもの"
        : "以前の周回が使ったもの",
  scopePlanLine: (where, agentType, from) => `${where}、エージェント種別 ${agentType}（${from}）`,
  scopePlanHeldAt: (line, at) => `${line}、${at} UTC から保持`,
  scopeDraftedLead:
    "この依頼の範囲を rondo が下書きしました。下の作業と、このストアに記録された周回から出した" +
    "予算です。そのまま承認するか、先に値を変えてください。変えた場合は、rondo の下書きの" +
    "代わりにあなたの版が記録されます。",
  scopeDraftedPlansHeading: "rondo が動かそうとしている作業",
  scopeDraftedPlan: (n) => `作業 ${String(n)}`,
  scopeDraftedTemplateGone: "この下書きの元になったプランを、rondo はもう持っていません。",
  scopeNarrowed: (computed) => `ここに書かれた内容に合わせて、rondo が ${computed} から下げました:`,
  scopeNarrowedStricter: "ここに書かれた内容に合わせて、rondo が「重大」より厳しくしました:",
  scopeNarrowedAdded: "ここに書かれた内容に合わせて、rondo が加えました:",
  scopeRedrafted:
    "上の範囲が承認されたあとで、rondo が下書きし直しました。新しい下書きは下にあります。" +
    "承認すると、この依頼の範囲がもう 1 つ加わり、上の範囲はそのまま残ります。",
  scopeDraftedAction: "承認する",
  scopeDraftedPlain: "この範囲、または値を変えたあなたの版を承認します",
  scopeDraftedPressNote:
    "1 回押せば承認されます。値を変えた場合は、rondo が下書きの代わりにあなたの版を記録して" +
    "承認します。承認しただけでは何も消費しません。周回は始まる時点で毎回この範囲に照らして" +
    "判定されます。",
  planStartAction: "この作業を始める",
  planStartPlain: "この作業で周回を 1 つ始め、承認した範囲に数えます",
  planStarted: "開始済みです。",
  planStartedLink: "周回を開く",
  planBusy: (limit) =>
    limit === 1
      ? "まだ空きがありません。同時に動かせる周回は 1 件までで、いまその 1 件が動いています。" +
        "その周回がゲートまで進むと、ここに開始ボタンが出ます。"
      : `まだ空きがありません。同時に動かせる周回は ${String(limit)} 件までで、いま` +
        "そのすべてが動いています。どれかがゲートまで進むと、ここに開始ボタンが出ます。",
  planFull: (live, limit) =>
    `まだ空きがありません。開いている周回が ${String(live)} 件あり、このホストが許す上限` +
    `（${String(limit)} 件）です。どれかが終わると、ここに開始ボタンが出ます。`,
  planOutside: (test) => `始められません。${scopeTestJa(test)}。`,
  planUnrunnable: "もう動かせなくなりました。依頼のスレッドに返信すると、下書きし直されます。",
  planUnrunnableWhy: "止めている理由",
  planUndecidable: "いま、この作業を範囲に照らして確かめられませんでした。",
  scopeNoPlanForScope:
    "この範囲が許す場所とエージェント種別のプランを rondo はまだ持っていないので、この範囲で" +
    "開始できるものがありません。それに合うプランを依頼のスレッドに返信として貼ってください。",
  scopeNoApprover:
    "RONDO_APPROVER が設定されていないので、このページが誰として範囲を承認することもできません。",
  scopeWorkspace: (repository, root) => `${repository}（${root}）`,
  scopePlanDigest: (digest) => `プラン ${digest}`,
  scopeAgentType: (digest) => `エージェント種別 ${digest}`,
  scopeAgentTypeBounds: "そのエージェント種別に許されていることと、それをどこから読んだか",
  scopePlanHeading: "rondo が動かすプランと、動かす場所",
  scopeDigestsFold: "rondo が記録するダイジェスト",
  scopeMaybeApproved:
    "この依頼の範囲をすでに承認済みかどうかは、ここからは分かりません。どちらであってもこれは" +
    "新しい下書きで、押せば 2 つめが記録されます。",
  scopeHeldBounds: (digest, tier, granted, from) =>
    `エージェント種別 ${digest}: tier ${tier}、許可は` +
    `${granted.length === 0 ? "なし" : granted.join(", ")}` +
    `（${agentTypeSourceJa(from)}から読み取り）`,
  scopeHeldNone: (digest) =>
    `エージェント種別 ${digest}: 何が許されているかの記録を rondo は持っていません`,
  scopeHeldUnreadable: (digest, reason) =>
    `エージェント種別 ${digest}: 記録を読めないので、何が許されているかを出せません: ${reason}`,
  scopeHeldRebuilds: (digest, rebuilt, from) =>
    `エージェント種別 ${digest}: ` +
    `${agentTypeSourceJa(from)}から読み取った記録は ` +
    `${rebuilt} に組み直されるので、何が許されているかを出せません`,
  scopeHeldNoBuild: (digest, from, reason) =>
    `エージェント種別 ${digest}: ` +
    `${agentTypeSourceJa(from)}から読み取った記録は` +
    `組み立てられないので、何が許されているかを出せません: ${reason}`,
  scopeRoundsAsk: "レビュー回数",
  scopeRoundsRedraw:
    "数を選ぶと予算はプランから引き直されるので、入力した値は rondo の下書きに戻ります。",
  scopeLapsLabel: "周回数",
  scopeRoundsLabel: "レビュー回数",
  scopeCostLabel: "費用（USD）",
  scopeReserveLabel: "費用未読の周回ごとの引当（USD）",
  scopeExpiresLabel: "有効期限（UTC）",
  scopeFormula: (how) => `計算: ${how}`,
  scopeFormulaRounds: "選んだレビュー回数そのもの",
  scopeFormulaLaps: (plans, rounds) =>
    `プラン数 x レビュー回数 = ${String(plans)} x ${String(rounds)}`,
  scopeFormulaReserve: "最も高かった初回周回の費用を、0.10 USD 単位で切り上げた値",
  scopeFormulaCost: (plans, reserve, laterRounds, redo) =>
    `プラン数 x（引当 + 2 回目以降のラウンド数 x やり直し費用）= ` +
    `${String(plans)} x（${reserve} + ${String(laterRounds)} x ${redo}）`,
  scopeFormulaExpires: (laps, seconds) =>
    `下書き時刻 + 周回数 x 最長の周回 + 返信のための 1 日 = 下書き時刻 + ` +
    `${String(laps)} x ${String(seconds)} 秒 + 24 時間`,
  scopeBasesFold: (count) => `この数の出どころ (${String(count)})`,
  scopeBasisRows: (measurement, laps, tier) =>
    `${tier === null ? "このエージェント種別" : `tier ${tier}`}の直近 ${String(laps)} 周回のうち、` +
    `${JA_MEASURE[measurement] ?? measurement}が最も高かったもの`,
  scopeBasisColdStart: (measurement) =>
    `${JA_MEASURE[measurement] ?? measurement}: このストアでは一度も測っていないので、rondo の` +
    `初期値を使いました`,
  scopeBasisPlans: (plans) => `プラン数: ${String(plans)}`,
  scopeBasisRounds: (rounds, byDefault) =>
    byDefault
      ? `レビュー回数: ${String(rounds)}（誰も選ばなかったときに rondo が使う数）`
      : `レビュー回数: ${String(rounds)}（あなたが選んだ数）`,
  scopeBasisReplyAllowance: "あなたの返信のための 1 日。測った値ではなく、見込みの余裕です",
  scopeBasisLap: (iterationId) => `周回 ${iterationId}`,
  scopeSampleHeading: "依頼の大きさが過去の周回と同じくらいだと見て、予算を出しています",
  scopeSampleRows: (laps, tier, lowest, highest) =>
    `${
      tier === null
        ? "このエージェント種別"
        : `まだ記録のないエージェント種別なので、同じ tier ${tier} の別のエージェント種別`
    }の初回周回 ${String(laps)} 件をもとに下書きしました。費用は ` +
    `${lowest === highest ? highest : `${lowest}〜${highest}`} USD で、引当にはその最高値を` +
    `使っています。rondo が記録しているのは周回にかかった費用だけで、どれだけの作業をしたかは` +
    `記録していません。そのため、この依頼がそれらと同じくらいの大きさかどうかは分かりません。` +
    `大きいと思うなら、ここで費用を上げてください。初回の作業で使い切っても、作業があなたの` +
    `確認に戻ってきたときに引き上げられます。`,
  scopeSampleColdStart: (reserve) =>
    `このエージェント種別にも、その tier にも、記録された周回がありません。そのため引当は ` +
    `rondo の初期値 ${reserve} USD で、誰かが測った値ではありません。依頼がどれだけの大きさ` +
    `かも分かりません。小さな変更では済まないと思うなら、ここで費用を上げてください。作業が` +
    `あなたの確認に戻ってきたときに引き上げることもできます。`,
  scopeDefaultsHeading: "rondo が埋めたもの",
  scopeDefaultNote: "既定値で、依頼から導いたものではありません。",
  scopeSeverityLabel: "この重大度以上の指摘が出たら 1 ラウンド終了",
  scopeOutwardLabel: "この範囲で許す外向きの行為",
  scopeOutwardAct: (act) =>
    ({
      push_branch: "ブランチを push する",
      open_pull_request: "プルリクエストを開く",
    })[act] ?? act,
  scopeOutwardNone: "なし",
  scopeIrreversibleNone: "取り返しのつかない行為の一覧には何も足しません。",
  scopeCostCaveat:
    "費用の予算は周回そのものの費用だけを数えます。レビュー側の費用は数えず、費用がまだ読めて" +
    "いない周回は引当を保持しますが、これは見積もりです。",
  scopePressNote:
    "1 回押すと、この範囲があなたの名前で記録され、承認されます。承認しただけでは何も消費" +
    "しません。行為はそれが取られた時点で毎回この範囲に照らして判定されます。",
  scopePlain: "この範囲を記録して承認します",
  scopeApproved: (since) => `${since}前に承認済み`,
  scopeDigest: (digest) => `ダイジェスト ${digest}`,
  scopeNotThisRequest: "その承認はこの依頼のものではないので、ここには何も表示しません。",
  scopePredecessorSpent: (laps, usd, unread) =>
    `これが置き換える範囲は、これまでに ${String(laps)} 周回と読み取り済み $${usd} を使い、` +
    `費用がまだ読めていない ${String(unread)} 周回が引当を保持しています。`,
  scopePredecessorNoApproval:
    "これが置き換える範囲は承認されたことがないので、何も使っていません。",
  scopePredecessorUnreadable: (reason) =>
    `置き換える範囲が何を使ったかは読めませんでした: ${reason}`,
  scopeRetired:
    "後から入った範囲に置き換えられたので、ここで承認した範囲では何も始まりません。" +
    "始めるなら、新しいほうの範囲で始めることになります。",
  startAction: "作業を始める",
  startPlain: "この承認のもとで 1 周回を始めます",
  startAgainSafe:
    "二度押しても、始まる周回は 1 つです。2 回目の押下は 1 回目にまとめられ、それ以上は" +
    "始まりません。",
  startNote:
    "依頼に書いた言葉が、そのまま作業への指示になります。周回の名前は rondo が付けるので、" +
    "あなたが決める必要はありません。",
  scopeRefusedNoApprover:
    "何も記録していません。RONDO_APPROVER が設定されていないので、このページが誰として範囲を" +
    "承認することもできません。",
  scopeRefusedPress:
    "何も記録していません。範囲の承認はこのページのボタンを人が押したときだけ行われ、" +
    "スクリプトからはできません。",
  scopeRefusedForm:
    "何も記録していません。そのフォームはこのページのものではありません。読み込み直してから" +
    "押してください。",
  scopeRefusedFields:
    "何も記録していません。数値のどれかが rondo の使える値になっていません。予算を確かめてから" +
    "押してください。",
  scopeRefusedNotTaken: "何も記録していません。ストアがこの範囲を受け付けませんでした。",
  scopeRefusedPlanChanged:
    "何も記録していません。あの画面のプランは、もうこの依頼で rondo が選べるものではありません。" +
    "読み込み直して、選び直してください。",
  scopeRefusedEdited:
    "今回は何も記録していません。そのフォームはすでに記録・承認済みで、いま変えた内容は" +
    "保存されている内容とは違います。読み込み直して、新しい範囲を下書きしてください。",
  scopeRefusedNotRead: "範囲は記録されましたが読み戻せないので、承認はしていません。",
  scopeRefusedNotShown:
    "範囲は記録されましたが、あなたに見せたことを rondo が書き残せなかったので、承認は" +
    "していません。",
  scopeRefusedNotApproved: "範囲は記録されましたが、承認されていません。何も消費されていません。",
  startRefusedNoApprover:
    "何も開始していません。RONDO_APPROVER が設定されていないので、このページが誰として作業を" +
    "始めることもできません。",
  startRefusedPress:
    "何も開始していません。作業の開始はこのページのボタンを人が押したときだけ行われ、" +
    "スクリプトからはできません。",
  startRefusedForm:
    "何も開始していません。そのフォームはこのページのものではありません。読み込み直してから" +
    "押してください。",
  startRefusedNoPlan:
    "何も開始していません。選んだプランが、この依頼で使えるプランのなかにありません。",
  startRefusedNoRequest:
    "何も開始していません。依頼を読み戻せなかったので、作業に頼むことがありません。",
  startRefusedNoContinuo: "何も開始していません。作業を動かす部分が起動しません。",
  startRefusedOutside: (test) =>
    `何も開始せず、何も消費していません。承認した範囲の外にある作業で、${test} の判定で` +
    `外れました。選択肢は依頼のスレッドに書かれたメッセージにあります。`,
  startRefusedNotAdmitted:
    "何も開始せず、何も消費していません。承認はそのまま有効なので、もう一度押しても安全です。",
  scopeBack: "範囲に戻る",

  reviseAction: "変更を依頼する",
  reviseFold: "承認せずに変更を依頼する",
  revisePlain: "書かれた内容をこのゲートに送り、同じ承認のもとで 2 周目をその内容で動かします。",
  reviseLabel: "変更してほしいこと",
  revisePlaceholder: "例: パーサーの変更はそのまま、コマンドラインには手を入れないでほしい",
  reviseNote:
    "書かれた言葉はそのままゲートに渡り、2 周目はその言葉で作業をやり直すよう頼まれます。" +
    "その周回と費用は、この周回が動いた承認の budget に数えられます。周回の名前は rondo が" +
    "付けるので、入力の必要はありません。",
  reviseNoScope:
    "承認済みの範囲のもとで始めた周回ではないため、2 周目を数える budget がありません。" +
    "ここから変更を依頼することはできません。",
  reviseDraftFinding: (severity, text) => `- [${severity}] ${text}`,
  reviseDraftBases: (bases) => `  場所: ${bases}`,
  reviseDraftChange: (words) => `  直すこと: ${words}`,
  reviseDrafted:
    "レビューで見つかった点から rondo が下書きしました。自由に編集できます。送る内容はあなたのものです。",
  reviseDrafting:
    "レビューで見つかった点から、変更内容の下書きを作成中です。1〜2 分後にページを再読み込みすると表示されます。" +
    "待つ必要はなく、今すぐ自分で書くこともできます。",
  reviseUndrafted:
    "今回は rondo が変更内容を下書きできませんでした。このレビューについて再度試みることはありません。" +
    "変更してほしいことをご自身で書いてください。レビューで見つかった点は上にあります。",
  reviseDraftArrived:
    "書き始めた後に下書きが届きましたが、あなたの書いた内容をそのまま残しています。下書きを見るには、" +
    "欄を空にしてからページを再読み込みしてください。",
  forMaintainer: "このマシンで rondo を管理する人向け",
  reviseRefusedNoApprover:
    "何も回答していません。RONDO_APPROVER が未設定なので、このページが誰として回答するか" +
    "決まりません。",
  reviseRefusedPress:
    "何も回答していません。ゲートへの回答は人がこのページのボタンを押して行うもので、" +
    "スクリプトにはできません。",
  reviseRefusedForm:
    "何も回答していません。そのフォームはこのページのものではありません。読み込み直してから" +
    "押してください。",
  reviseRefusedNoWords: "何も回答していません。変更の依頼には内容が要りますが、入力欄が空でした。",
  reviseRefusedGateClosed:
    "何も回答していません。開いているゲートがもう残っていません。戻って結果を" +
    "確認してください。",
  reviseRefusedNotItsScope:
    "何も回答していません。消費しようとしている承認は、この周回が動いた承認ではありません。" +
    "ゲートを読み込み直してから押してください。",
  reviseRefusedStillRunning:
    "何も回答していません。ゲートには別の言葉ですでに回答していて、その処理が続いています。" +
    "終わるのを待ってから、ゲートを読み込み直して状態を確認してください。",
  reviseRefusedNotSetUp:
    "何も回答せず、ゲートにも触れていません。2 周目を用意できませんでした。詳細は rondo を" +
    "動かしているターミナルに出ています。",
  reviseRefusedNoContinuo: "何も回答していません。作業を動かす部分が起動しません。",
  reviseRefusedOutside: (test) =>
    `何も回答せず、何も消費していません。2 周目はこの周回が動いた範囲の外で、${test} の判定で` +
    `外れました。ゲートはそのままです。選択肢は依頼のスレッドに書かれたメッセージにあります。`,
  reviseRefusedWalkFailed:
    "ゲートへの回答が途中で終わり、2 周目も開始していません。書かれた言葉はすでにゲートに" +
    "届いているかもしれません。もう一度押す前に、戻ってゲートの状態を確認してください。" +
    "詳細は rondo を動かしているターミナルに出ています。",
  reviseRefusedNotSettled:
    "ゲートには書かれた言葉で回答しましたが、2 周目は開始していません。回答した周回の後始末が" +
    "終わりませんでした。何も消費していません。詳細は rondo を動かしているターミナルに" +
    "出ています。",
  reviseRefusedAfterGate:
    "ゲートには書かれた言葉で回答しましたが、2 周目は開始していません。承認がもう 1 周回を" +
    "受け付けませんでした。書かれた内容は記録されています。選択肢は依頼のスレッドに書かれた" +
    "メッセージにあります。",
  reviseRefusedNotStarted:
    "2 周目は開始していません。詳細は rondo を動かしているターミナルに出ています。ここで" +
    "書いた内容は失われていません。",
  reviseForked:
    "ここでは変更を依頼できません。この依頼で承認した予算が別々に 2 回引き上げられていて、" +
    "rondo はどちらを使うかを選びません。何も消費していません。今の作業をそのまま承認する" +
    "ことはできます。",
  reviseRefusedForked:
    "何も回答せず、何も消費していません。この依頼で承認した予算が別々に 2 回引き上げられて" +
    "いて、rondo はどちらを使うかを選びません。",

  raiseNeeded: (why) =>
    `変更を依頼すると作業をもう 1 回やり直しますが、${why}ため、ここでは依頼できません。` +
    "何も依頼しておらず、何も消費していません。予算を引き上げると、ここからまた変更を依頼" +
    "できます。今の作業をそのまま承認することもできます。",
  raiseWhyLaps: (laps) => `承認した ${String(laps)} 回をすべて使っている`,
  raiseWhyCost: (spent, reserve, cost) =>
    `やり直しには費用が分かるまで $${reserve} を確保する必要があり、すでに使ったか確保している ` +
    `$${spent} と合わせると承認した $${cost} を超える`,
  raiseWhyExpiry: (at) => `承認した期限 ${at} (UTC) を過ぎている`,
  raiseLink: "この承認の予算を引き上げる",
  raiseLead:
    "この依頼で承認した予算を引き上げます。変わるのは予算だけで、作業の内容、作業する場所、" +
    "作業者に許すことは承認したときのままです。",
  raiseWasHeading: "承認した内容と、これまでに使った分",
  raiseWas: (laps, cost, until) => `${String(laps)} 回まで、$${cost} まで、${until} (UTC) まで。`,
  raiseUsed: (attempts, usd, unread) =>
    `これまでに ${String(attempts)} 回、$${usd} を使いました` +
    (unread === 0 ? "。" : `（うち ${String(unread)} 回はまだ費用が分かっていません）。`),
  raiseFromHere:
    "新しい予算はこれから先の分です。これまでに使った分は前の承認に数えられたままで、新しい" +
    "予算からは引かれません。費用を $15 に引き上げると、合計 $15 ではなく、ここからさらに " +
    "$15 まで使えます。",
  raiseRetires:
    "押すと、前の承認ではこれ以降何も新しく始まりません。前の承認が対象にしていたすべての" +
    "依頼についてです。この承認がその代わりになります。",
  raiseAskStands:
    "rondo はこの作業を以前止めて、どう進めるかをあなたに尋ねています。予算を引き上げても" +
    "その回答にはなりません。依頼のスレッドで続けるよう伝えるまで、作業は止まったままです。",
  raiseAskLink: "尋ねた内容を読む",
  raiseNotTip:
    "予算はすでに引き上げられていて、ここから引き上げるものはありません。戻って、今" +
    "有効な予算を確認してください。",
  raisePressNote:
    "1 回押すと、新しい予算があなたの名前で記録・承認され、あなたを待っている作業に戻ります。" +
    "承認しただけでは何も消費しません。",
  raiseAction: "予算を引き上げる",
  raisePlain: "新しい予算を記録して承認します",
  raiseRefusedNotTip:
    "何も記録していません。別のタブか別の人が、先に予算を引き上げています。" +
    "戻って、今有効な予算を確認してください。",
  raiseRefusedForked:
    "何も記録していません。この依頼で承認した予算が別々に 2 回引き上げられていて、rondo は" +
    "どちらをさらに引き上げるかを選びません。",
  raiseRefusedNotAtGate:
    "何も記録していません。作業はもうあなたを待っていないので、予算を引き上げる対象が" +
    "ありません。戻って結果を確認してください。",

  publishAction: "公開する",
  publishHere: "公開すると何が起きるかを読み、その画面から公開する",
  published: (branch, runId) =>
    `公開済み: ${branch === null ? "ブランチ" : `ブランチ ${branch}`} を push し、` +
    `${runId === null ? "run" : `run ${runId}`} を閉じました。`,
  publishedPullRequest: "プルリクエスト",
  holds: (paths) => `この作業が押さえているファイル: ${filesJa(paths)}`,
  heldHeading: (count) => `終わったが、まだ既定ブランチに入っていない作業 (${String(count)})`,
  notLanded:
    "この変更はまだ既定ブランチで見つかっていません。それまでファイルはこの作業が押さえたままで、" +
    "同じファイルを使う別の作業は待つことになります。",
  landed: "変更は既定ブランチに入りました。ファイルは別の作業に使えます。",
  releasedByPerson: "人の判断でファイルが手放されたので、別の作業に使えます。",
  releaseLink: "ファイルを手放す",
  releaseHeading: "この作業が押さえているファイルを手放す",
  releaseLead:
    "この作業は終わっていますが、ファイルを押さえたままです。あなたが手放すか、変更が既定" +
    "ブランチで見つかるまで、同じファイルを使う作業は始められません。",
  releaseWorkHeading: "作業",
  releaseHoldsHeading: "押さえているファイル",
  releaseWhyHeading: "rondo が自分で手放していない理由",
  releaseWhy: [
    "rondo は、この変更が既定ブランチに入ったと確かめられた時点でファイルを手放します。" +
      "作業が変えたファイルがすべて、作業が残したとおりの中身で既定ブランチにあることが条件です。" +
      "確かめるのは、別の作業が同じファイルを求めたときです。",
    "まだ確かめられていません。まだマージされていない、取り込むときに手が入った" +
      "（コンフリクトの解消を含む）、別のリモートに送られた、既定ブランチを読めなかった、" +
      "のどれかです。",
    "作業が済んだかどうかを決めるのはあなたです。rondo が見分けられない形でマージ済みのとき、" +
      "またはマージしないと決めたときは、ファイルを手放してください。",
  ],
  releaseEffectHeading: "手放すと起きること",
  releaseEffect: [
    "別の作業がすぐにこのファイルを使えるようになります。",
    "ブランチ、プルリクエスト、作業そのものはそのまま残ります。何も消さず、何も閉じません。",
    "あなたの判断として記録されます。この作業をやり直すと、ファイルはまたこの作業のものになります。",
  ],
  releaseAction: "ファイルを手放す",
  releasePlain:
    "別の作業がこのファイルを使えるようにし、この作業は済んだというあなたの判断を記録します",
  releaseBack: "押さえているファイルの画面に戻る",
  releaseNothingHeld: "この作業はいまファイルを押さえていないので、手放すものはありません。",
  releaseStillOpen:
    "この作業の一部がまだ動いているか、あなたのレビューを待っているので、それが終わるまで" +
    "ファイルは押さえたままです。",
  releaseRefusedNoApprover:
    "何も手放していません。この端末の rondo はまだあなたが誰かを知らないので、ここでは" +
    "あなたとして何も決められません。",
  releaseRefusedPress:
    "何も手放していません。これは人がこのページのボタンを押して行うもので、スクリプトからは" +
    "できません。",
  releaseRefusedForm:
    "何も手放していません。そのフォームはこのページのものではありません。読み込み直してから" +
    "押してください。",
  releaseRefusedChanged:
    "何も手放していません。画面を表示したあとで、この作業の状態が変わりました（ファイルが" +
    "手放された、またはやり直された）。戻っていまの状態を確かめてください。",
  releaseRefusedNotRecorded:
    "何も手放していません。rondo があなたの判断を記録できませんでした。ファイルはこの作業が" +
    "押さえたままです。もう一度押しても安全です。",
  planHeld: (paths) =>
    `まだ始められません。別の作業が ${filesJa(paths)} を変更しています。その作業の変更が既定` +
    "ブランチに入るか、その作業のファイルが手放されれば始められます。",
  planHeldFinished: (paths) =>
    `まだ始められません。終わった作業が ${filesJa(paths)} を押さえたままです。その変更がまだ既定` +
    "ブランチで見つかっていないためです。見つかるか、ファイルが手放されれば始められます。",
  planHeldBy: "押さえている作業",
  planHeldTry:
    "その作業は終わっています。開始するときに、まずその変更が既定ブランチに入っているかを確かめます。",
  startRefusedHeld:
    "何も開始せず、何も消費していません。必要なファイルを別の作業がまだ押さえています。承認は" +
    "そのまま有効です。その作業の変更が既定ブランチに入るか、ファイルが手放されたら、もう一度" +
    "開始してください。",
  publishHeading: "この作業を公開する",
  publishLead:
    "公開すると何が起きるかを、いまの状態から読み取って示します。下のボタンを押すまで、何も起きません。",
  publishNotYetLead: "まだ何も送信していません。いまのままでは公開できません。",
  publishReviewLead:
    "まだ何も送信していません。公開すると何が起きるかを、いまの状態から読み取って示します。" +
    "作業の読み取りはそこまで及んでいないので、押せるのは、それを承知で進めるボタンだけです。",
  publishNotYetHeading: "何が止めているか",
  publishTargetHeading: "何が起きるか",
  publishPushes: (branch, remote) => `ブランチ ${branch} を ${remote} へ push します。`,
  publishOpens: (repo, base) => `${repo} に、${base} 向けのプルリクエストを作ります。`,
  publishCloses: (runId) => `run ${runId} を completed として閉じます。`,
  publishPushUrl: (url) => `その push が届くのは ${url} です。`,
  publishWorkspace: (workspace) => `作業は ${workspace} にあります。`,
  publishRequestHeading: "作られるプルリクエスト",
  publishTitleLabel: "タイトル",
  publishBodyLabel: "本文",
  publishBodyViewLegend: "本文の表示",
  publishBodyPreview: "プレビュー",
  publishBodyRaw: "原文",
  publishBodyRawNote: "この本文が、一字一句このまま送信されます。",
  publishNoticedHeading: "rondo が気づいたこと",
  publishModelHeading: "モデルが読んだこと",
  publishModelNote: "判断の材料です。承認ではなく、上の内容がこれで決まったわけでもありません。",
  publishNote:
    "ボタンを押すと、rondo があなたの名前で push し、プルリクエストを作り、run を閉じます。" +
    "マージはしません。画面を開いたあとに何か変わっていれば、実行せず、理由を表示します。",
  publishPlain: "このブランチを push し、プルリクエストを作り、run を閉じます。",
  publishBack: "公開の画面に戻る",
  publishNotOffered:
    "ここからは公開できません。公開には、このホストが受け付ける公開者が要りますが、" +
    "それがないまま起動されています。公開者はページを起動するときに rondo へ渡します。",
  publishNotClosed: (status) =>
    `周回が ${status} の状態です。公開できるのは、人がゲートで承認した作業だけです。`,
  publishNotApproved: (outcome) =>
    `ゲートが ${outcome} で終わっていて、人が回答したわけではないため、` +
    "公開してよいという承認がありません。",
  publishNoRun: "run の記録がないため、閉じる run がありません。",
  publishPlanField: (field) =>
    `公開は周回の plan から組み立てますが、その plan に ${field} がありません。このままでは` +
    "公開できません。",
  publishNoRepo:
    "この周回には、プルリクエストを出す先が記録されていません。このホストにも指定が" +
    "ありません。ここからは決められません。出す先は、作業する場所を用意するときに、" +
    "rondo を入れた人が記録します。",
  publishTargetRefused: (reason) => `push の宛先を rondo が保証できません: ${reason}`,
  publishUncommitted: (paths) =>
    `ワークスペースにブランチへ載っていない作業が残っています: ${paths}。push はそれを` +
    "置き去りにしますし、ここのボタンでは変えられません。",
  publishUncommittedElsewhere: (branch) =>
    `ワークスペースは ${branch} をチェックアウトしており、push 対象のブランチではありません。`,
  publishUncommittedRemedies:
    "公開ではなくそのパスについて答えてください。周回をやり直して作業自体をコミットさせ" +
    "読み直させる、ワークスペースで自分でコミットする、作業でないなら捨てる、のいずれかです。",
  publishReviewHeading: "読み取りがこの作業を説明していません",
  publishReviewNoReading:
    "この作業を独立に読んだものがありません。「読まれていない」と「読んで何も出なかった」が" +
    "同じに見えてはいけないので、既定では公開はここで止まります。",
  publishReviewNotClear: (verdict, findings) =>
    `作業を読んだ結果は '${verdict}' です${findings === "" ? "" : `: ${findings}`}。` +
    "結論でも拒否権でもなく、まだ誰も答えていない指摘です。",
  publishReviewNoEvidence:
    "読み取りは何も出なかったと言っていますが、何を読んだかの測定が記録されていないため、" +
    "照合する相手がありません。",
  publishReviewUnreadable: (reason) =>
    `いまワークスペースを読めません (${reason})。そのため、読み取りと push される内容を` +
    "照合できません。",
  publishReviewMoved: (readTip, nowTip) =>
    `読み取りは ${readTip} に対して取られ、push されるのは ${nowTip} です。もうこの作業を` +
    "説明していません。",
  publishDespiteFold: "その読み取りなしで公開する",
  publishDespiteAction: "それでも公開する",
  publishDespiteNote:
    "これを決めるのはあなたで、そのための押下は別に 1 回必要です。rondo はあなたが決めたことを" +
    "記録します。読み取りはそのまま残ります。",
  publishDespitePlain: "上の読み取りがこの作業を説明していないまま公開します。",
  publishRefusedNoApprover:
    "何も公開していません。RONDO_APPROVER が未設定なので、このページが誰として公開するか" +
    "決まりません。",
  publishRefusedPress:
    "何も公開していません。公開は人がこのページのボタンを押して行うもので、スクリプトからは" +
    "できません。",
  publishRefusedForm:
    "何も公開していません。そのフォームはこのページのものではありません。読み込み直してから" +
    "押してください。",
  publishRefusedGone:
    "何も公開していません。周回がもう読めなくなっています。一覧に戻ってください。",
  publishRefusedNotClosed: "何も公開していません。周回が、承認されたゲートで終わっていません。",
  publishRefusedNotApproved:
    "何も公開していません。ゲートが人の回答なしに終わっていて、公開してよいという承認が" +
    "ありません。",
  publishRefusedNoRun: "何も公開していません。閉じる run がありません。",
  publishRefusedPlanField:
    "何も公開していません。この周回の plan に、公開の組み立てに要るものが欠けています。",
  publishRefusedNoRepo:
    "何も公開していません。この周回にも、このホストにも、プルリクエストを出す先の記録が" +
    "ありません。",
  publishRefusedTarget: (detail) =>
    `何も公開していません。push の宛先を rondo が保証できません。${detail}`,
  publishRefusedUncommitted: (detail) =>
    `何も公開していません。ワークスペースにブランチへ載っていない作業が残っています (${detail})。`,
  publishRefusedNotRead:
    "何も公開していません。この作業の読み取りが、push される内容を説明していません。" +
    "この画面を読み込み直してください。それを踏み越えて公開するには、別の押下が要ります。",
  publishRefusedNothingOverruled:
    "何も公開していません。読み取りはこの作業を説明しているので、踏み越えるものがありません。" +
    "この画面を読み込み直して、公開を押してください。",
  publishRefusedChanged:
    "何も公開していません。画面に出ていた内容と、いま公開したら起きることが食い違っています。" +
    "読み込み直し、もう一度読んでから押してください。",
  publishRefusedStillRunning:
    "二重には公開していません。別の内容を読んだ画面から、すでに公開の処理が進んでいます。" +
    "終わるのを待ってから読み込み直してください。",
  publishRefusedNoContinuo:
    "何も公開していません。run を閉じる部分が起動しないため、rondo は最後まで終えられない" +
    "push を行いません。",
  publishRefusedPushFailed: (detail) =>
    `何も公開していません。ブランチを push できませんでした。${detail}`,
  publishRefusedPullRequestFailed: (detail) =>
    `ブランチは push 済みで、プルリクエストは作れませんでした。${detail} その前に作られていたか` +
    "どうかは rondo が持っている情報ではありません。もう一度押す前にフォージ側を見てください。" +
    "すでにあるプルリクエストを 2 回目の押下で作ることはできません。ある場合、残っているのは " +
    "run を閉じることだけで、その 1 行は rondo を動かしているターミナルに出ています。",
  publishRefusedRunNotClosed:
    "ブランチは push 済みで、プルリクエストも作られています。run が閉じていません。残っているのは" +
    "その 1 つで、詳細は rondo を動かしているターミナルに出ています。",
  publishRefusedNotStarted:
    "何も公開していません。詳細は rondo を動かしているターミナルに出ています。ここで見た内容は" +
    "失われていません。",
} satisfies Chrome);

/**
 * The sets this tree ships, by the tag they are written in.
 *
 * **`en` is a member, and that is `D-0056` rule 8.** It is the floor of the
 * resolution ({@link chromeFor}), and it has to be reachable *by name* as well,
 * or a `ja` host, a `ja` memory or a `ja` browser
 * would be a one-way door and the switch of rule 10 would need a special case
 * for going back. So `en` names the English set and a tag nobody wrote a set
 * for names none, which are two different answers here even though they render
 * the same document: one is a step of rule 2 answering and the other is a step
 * saying nothing.
 *
 * There is still no registry and no negotiation. What replaced the exact match
 * is lookup and nothing else ({@link setFor}).
 */
const SETS: ReadonlyMap<string, Chrome> = new Map([
  ["en", EN],
  ["ja", JA],
]);

/**
 * Every set this tree ships, named in its own language.
 *
 * **The label is the language's own name, which is what makes it the same bytes
 * in every set** (`D-0056` rule 10): `English` reads as `English` on a Japanese
 * page and `日本語` reads as `日本語` on an English one, so the switch is a
 * list of names rather than an entry in {@link Chrome} that each set would
 * translate into a word its reader cannot use. Not prose, and so not a member
 * of the catalogue at all.
 */
export const SHIPPED_SETS: ReadonlyMap<string, string> = new Map([
  ["en", "English"],
  ["ja", "日本語"],
]);

/**
 * The set a tag reaches by BCP 47 lookup, or null when no set does.
 *
 * **RFC 4647 section 3.4, and the whole of `D-0056` rule 6's algorithm.**
 * Truncate the tag at its last hyphen and try again until a set matches, and
 * **truncate once more whenever that leaves a trailing single-character
 * subtag** -- so `ja-x-private` reaches `ja` and never stops at a bare `ja-x`,
 * which is the RFC's own worked example (`zh-Hant-CN-x-private1-private2`
 * reaching `zh`) and the one step of it that is easy to write backwards. No
 * basic filtering, no alternatives list, no best-fit.
 *
 * **Null is a step of rule 2 saying nothing, and is why this is not
 * {@link chromeFor}.** A well-formed tag this tree ships no set for has to let
 * the *next* step answer rather than resolve to English itself, or the host's
 * variable saying `de` would silence the browser's list. English is the floor
 * of the resolution and not the answer of every step in it.
 *
 * **Ill-formed asks resolve to nothing, and the grammar is checked before the
 * truncation rather than after it** (D-0056 rule 9). Truncation is what makes
 * this the wrong way round if it is skipped: `ja-!!` and `ja-` each reach `ja`
 * by cutting at a hyphen, so a syntax error would *resolve* -- and, being a
 * language the other steps would not have answered, would write rule 5's
 * memory. Rule 9 says an ill-formed `lang` resolves to nothing and does not
 * overwrite the memory, so the check is here, where every step of rule 2 passes
 * through it. The grammar is `src/refrain/plan.ts`'s, shared rather than
 * restated, which is the grammar D-0056 cites when it says rule 9's
 * unknown-tag case is about a well-formed tag rondo ships no set for and not
 * about a syntax error.
 */
export function setFor(tag: string | null): Chrome | null {
  if (tag === null || !isLanguageTag(tag)) {
    return null;
  }
  let candidate = tag.toLowerCase();
  for (;;) {
    const set = SETS.get(candidate);
    if (set !== undefined) {
      return set;
    }
    const cut = candidate.lastIndexOf("-");
    if (cut === -1) {
      return null;
    }
    candidate = candidate.slice(0, cut);
    // The step above leaves `ja-x` from `ja-x-private`; a single-character
    // subtag is a singleton and never a set anybody wrote, so the RFC drops it
    // together with the subtag that introduced it.
    if (/-.$/.test(candidate)) {
      candidate = candidate.slice(0, candidate.lastIndexOf("-"));
    }
  }
}

/**
 * The wording one tag reaches, with English as the last stop.
 *
 * {@link setFor} with `D-0056` rule 2's floor applied -- which is the whole
 * resolution for a caller that has one tag and no further steps to fall to.
 *
 * **`lang` comes back naming what was selected and never what was asked**
 * (`D-0055` rule 7). A well-formed tag this tree ships no set for yields `en`
 * and the document then declares `en`, because that is what the document is:
 * rondo does not declare an intention as a fact. No set is half written
 * (D-0079), so the tag a set carries is the language every string in it is in.
 */
export function chromeFor(tag: string | null): Chrome {
  return setFor(tag) ?? EN;
}
