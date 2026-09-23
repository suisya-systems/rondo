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
import type { ReadingReach } from "../store/records.js";
import type { IssueReadFailure } from "./issue-read.js";
import type { PageWords } from "./page/words.js";
import { EN } from "./wording/en.js";
import { JA } from "./wording/ja.js";

export { EN };

/**
 * Where a listed agent type's record was read from (D-0069 section 1).
 *
 * `iteration` and `scope` are rows rondo holds; `plan` is the plan the scope
 * being drafted would record, which nothing holds yet -- shown before the press
 * so the first scope in a store is not a hash a person approves blind
 * (rondo#233 S3).
 */
export type AgentTypeSource = "iteration" | "scope" | "plan";

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

  readonly endedHead: (status: string, since: string, why: string) => string;
  readonly gateAnswered: (outcome: string) => string;
  /**
   * The state pill a row leads with (the page's third design pass on #220): a
   * word a person reads instead of the status enum, which stays in the pill's
   * `title`. An outcome or status no entry names is shown as its own bytes.
   */
  readonly statePill: (status: string, gateOutcome: string | null) => string;
  /** The age beside an ended row's pill. */
  readonly noReasonRecorded: string;
  readonly aboutIteration: (iterationId: string | null) => string;
  readonly willNotDecode: (reason: string) => string;

  // -- What a lap spent, and what its fence refused --
  readonly spent: (cost: string, turns: string, took: string) => string;
  readonly fenceUnknown: string;
  readonly fenceRefusedNothing: string;
  readonly fenceRefused: (denials: string) => string;

  // -- The button, and the way to it --
  readonly pressNote: string;
  readonly approveNote: (gateId: string, word: string) => string;
  /** The plain sentence beside the button; `approveNote` stays as its `title`. */
  readonly approvePlain: string;
  /**
   * The button's face when nothing was raised. **Only the face**: what the press
   * answers is `APPROVE_BODY`, read on the way in and never off this string, so
   * the ledger's word does not move with the page's language (D-0041 rule 7).
   */
  readonly approveFace: string;
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

  // -- Request threads (D-0061 rule 4, D-0059 section 5a's send) --
  /** How many messages a request's thread holds, and when it last moved. */
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
  /**
   * A drafter run that drafted nothing, said as what happened and what the
   * person can do (rondo#238): the reason itself is folded under
   * {@link drafterNoDraftWhy}, because it is rondo's own words about its tools.
   */
  readonly drafterNoDraft: string;
  readonly drafterNoDraftWhy: string;
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
  /**
   * The definition of done every lap is given after its request (rondo#377),
   * beside the request on the scope screen: its three asks in the person's
   * words, the repository's own rule files it points the worker at, and a fold
   * holding the words the worker is sent, which are rondo's constant.
   */
  readonly scopeDoneHeading: string;
  readonly scopeDoneAsks: readonly string[];
  readonly scopeDoneRules: (files: readonly string[]) => string;
  readonly scopeDoneNoRules: string;
  readonly scopeDoneExact: string;
  /** The summary's row for an ask: the request it was asked in. */
  readonly inReplyTo: (who: string, words: string) => string;
  readonly basesLabel: string;
  readonly replyAction: string;
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
  /**
   * The governance line, under every thread's title (D-0083 rule 6).
   *
   * `govSpent` pairs the two figures rule 6 refuses to separate; where no
   * approval reads, `weekNoAllowance` stands for the pair instead. The sixth
   * item -- what rondo decided without asking -- is `govDecided`, beside the
   * rest of the page's own words.
   */
  /** Rule 3's walk: where this request stands among the ones waiting, and the way on. */
  /**
   * One event line, said of a particular try (D-0083 rule 7).
   *
   * Drawn only where the request has more than one lap: with one there is
   * nothing to tell apart. A try is a thing a person has -- rule 6's line
   * counts them -- and not an identifier of rondo's (D-0076).
   */
  readonly evOfTry: (at: number, said: string) => string;
  readonly walkAt: (at: number, of: number) => string;
  readonly walkNext: string;
  readonly govSpent: (spent: string, approved: string) => string;
  readonly govTries: (at: number, of: number) => string;
  readonly chainAnswer: string;
  readonly chainProposal: string;
  readonly chainMerge: string;
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
  /** Lets go of a reply target chosen by hand. */
  readonly replyDefault: string;
  /** A live row that will not decode, as a person reads it. */
  /** The link from an unreadable row to its section of the reading. */

  // -- The gate reading on the answer view, page only (#220 S2). The console's
  // entries above stay as they are; these say the same facts in plain words,
  // and the console sentence rides along as the element's `title` --
  /** A row's refused calls, counted; the raw list is the `title`. */
  readonly blockedCount: (count: number) => string;
  readonly blockedNothing: string;
  readonly blockedUnknown: string;
  /** A running row whose transcript rondo could not name; the reason is the `title`. */
  /** rondo#248 item 3: the way from a running row into its log, and the log's screen. */
  readonly fenceHeading: string;
  /**
   * The gate's card of the worker's own report (rondo#444): every gate is the
   * worker's turn ending, finished or stopped to ask, so the card is named for
   * what it holds and the report is shut under `reportFold`.
   */
  readonly reportHeading: string;
  readonly reportFold: string;
  readonly reportNotRead: string;
  readonly workHeading: string;
  readonly changedAgainst: (baseRef: string) => string;
  /** The work could not be read; git's own reason goes in the maintainer fold beside it (D-0076 rule 4.5). */
  readonly changedUnreadable: string;
  readonly changedNoRange: string;
  readonly noCommits: string;
  readonly noFiles: string;
  readonly binaryFile: string;
  readonly moreRows: (count: number) => string;
  /**
   * **What the work changed outside the files it keeps to itself** (D-0073
   * rule 5, rondo#294): the heading, and one sentence for each of the two
   * things the comparison can find.
   *
   * The collision is the one this screen exists for: another piece of work is
   * changing the same files, and a person who only reads the page used to
   * learn that when the two changes met. `paths` are the person's own and are
   * shown as themselves; no other work is named, because naming it here would
   * mean an identifier.
   */
  readonly reachHeading: string;
  readonly reachCollided: (paths: readonly string[]) => string;
  readonly reachUnheld: (paths: readonly string[]) => string;
  /** The comparison did not happen; rondo's own reason is in the fold beside it. */
  readonly reachUnread: string;
  readonly checksHeading: string;
  readonly modelHeading: string;
  /** A reading's verdict as a pill: `clear`, `concerns` or `unavailable`. */
  readonly verdictPill: (verdict: string, count: number) => string;
  readonly checksNone: string;
  readonly checksCounted: (commits: number, files: number) => string;
  readonly whatItRead: string;
  /**
   * Whose statement {@link whatItRead} is, put in front of it on the checks
   * card (D-0104, rondo#410). The sentences under that label are rondo's own
   * checks' account of themselves -- *it built nothing, ran nothing* -- and lap
   * 12's owner read them as *the tests were not run*, over a transcript in
   * which the worker had run `npm run verify` green. Naming rondo's checks is
   * what makes *it* refer to them once the worker's own run sits above it; not
   * "the reviewer", which the model review card beside it already is.
   */
  readonly checksReader: string;
  /**
   * What the worker itself ran, apart from any reader's statement about itself
   * (D-0104, rondo#410): the block's label, its three answers, and the source
   * line that says rondo *read* the figure and did not run anything (D-0029
   * rule 9 holds). `workerRanUnrecorded` and `workerRanNone` are two different
   * facts and neither is a zero: no readable record of the commands, and a
   * record in which rondo found no runner summary it can read (which is not
   * *no tests ran*; a runner rondo does not know is the same row).
   */
  readonly workerRan: string;
  readonly workerRanUnrecorded: string;
  readonly workerRanNone: (commands: number) => string;
  /** One of the runner's three counts, as `1844 passed`. */
  readonly workerCount: (kind: "passed" | "failed" | "skipped", count: number) => string;
  /** The command itself ended in error, whatever its tests said (a `verify` whose lint failed after them). */
  readonly workerRanErrored: string;
  readonly workerRanEarlier: (runs: number) => string;
  /** Where the figure came from: continuo's record of the lap's commands, at that transcript line. */
  readonly workerRanSource: (line: number) => string;
  /**
   * What a reader reached and what it did not (rondo#69), from the store's
   * {@link ReadingReach}. The `en` set is the terminal's own lines, joined, so
   * the page and the terminal still say one thing about one drafter.
   */
  readonly readingCovered: (reach: ReadingReach) => string;
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
  /**
   * {@link claimNotRecorded} when the write failed on an errno (rondo#349):
   * the same press, but trying again is not the way back, so `D-0076` rule 4.3
   * says setup here has not finished or has stopped working, and what it
   * stops, and nothing about how.
   */
  readonly claimHostSetup: string;
  readonly answerNotDone: string;
  readonly gateBack: string;
  /** The line by the button when the model review raised a blocker or a major. */
  readonly modelRaised: (blockers: number, majors: number) => string;
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
  /** An ended row's echo of the verification claim its press carried. */
  readonly modelRaisedLink: string;
  readonly modelMayArrive: string;

  // -- The page's chrome under stack H (D-0059 rule 5): the live indicator and
  // the key hints, both drawn only once the key script has run --
  // -- Reaching a person who is not looking at the screen (rondo#311) --
  /**
   * The line the host puts in front of the person when their turn has come,
   * and the line an open tab rings with.
   *
   * **It says only enough to decide whether to come and look** (`D-0076`):
   * what is waiting is on the page, in its own words, and a notification that
   * tried to carry it would be composing a second account of the same thing
   * somewhere it cannot be answered. It names nothing rondo minted -- no
   * request, no lap, no count -- and it is the same sentence however many
   * things turned over in the minute, because the act it asks for is one act.
   *
   * **One sentence, because one sentence is all a call carries** (measured
   * 2026-09-21): `wsl-notify-send.exe` takes the line as a single positional
   * argument and answers a second one with its usage and an exit code of 0.
   */
  readonly reachYourTurn: string;
  /**
   * The same, for `D-0068`'s F1: a lap that has been going longer than the
   * patience its own plan declared.
   *
   * **It does not say what is wrong, because rondo does not know** (`D-0068`'s
   * measurement, and `D-0036` rule 5's refusal of a liveness reading). What it
   * says is that the time the plan allowed has passed, which is a fact rondo
   * holds, and that the person may want to look -- which is the only thing
   * they can do about it.
   */
  readonly reachLate: string;
  /**
   * The button that asks the browser for leave to ring (rondo#311, plan 2).
   *
   * Drawn only while the browser has not been asked: once it has an answer it
   * keeps it, and a button offering a choice that has been made is a button
   * that does nothing (`D-0076`: what the person cannot use is not shown).
   */
  readonly chimeAsk: string;
  /**
   * The tab's title (rondo#414): what waits on the person, counted as the
   * header counts it, so a tab among twenty says so without being opened.
   */
  readonly tabTitle: (count: number) => string;
  /**
   * The tab's title from a new wait until the tab is looked at (rondo#414).
   * The words that catch the eye come first: a tab strip cuts a title after
   * a couple of dozen characters. No count: the arrival is the news, and the
   * count comes back with {@link tabTitle} once the tab is looked at.
   */
  readonly tabTitleTurn: string;
  readonly liveLabel: string;
  readonly keyMove: string;
  readonly keyOpen: string;
  readonly keyBack: string;
  readonly keyWrite: string;
  /** The header's text-size control (rondo#379): the group's name, and one name per step, smallest first. */
  readonly textSizeLabel: string;
  readonly textSizes: readonly [string, string, string];

  readonly inboxNote: string;

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
  /**
   * A lap continuo would not start because rondo itself runs inside another
   * sandbox (continuo D-1112 rule 4), where the worker's own sandbox cannot
   * come up. Said instead of continuo's sentence, on the page and at the
   * terminal, because the move is the person's and continuo's words name its
   * own verb and a kernel error code (D-0076).
   */
  readonly lapNestedSandbox: string;
  /**
   * A lap continuo cut because the worker's turn outlived the plan's turn
   * budget (rondo#432). Said instead of continuo's sentence, which names a
   * session id, milliseconds, a generation and the fence: what ran out, what
   * was left, and what the person can do next. `minutes` is the plan's turn
   * budget, or null where the plan does not carry one. The try's cost is said
   * to be unknown because continuo reports no spend with a refusal.
   */
  readonly lapTurnTimedOut: (minutes: number | null) => string;

  // -- The scope screen (rondo#233 S3, D-0066 rule 1) --
  /**
   * The way in, and the screen's own title. One short filled call to action
   * with the longer sentence as the pointer's `title`, the shape
   * {@link answerAction} and {@link answerHere} already have.
   */
  readonly scopeAction: string;
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
  /**
   * The scope screen while a question in the request's thread waits (rondo#431):
   * no scope is offered to approve, and the way is to the question.
   */
  readonly scopeAnswerFirst: string;
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
  /**
   * What the plan says, quiet, above the numbers it drafted them from.
   *
   * **`place` is null where the repository is not what tells two things
   * apart** (`D-0081` rule 4.2, rondo#305), and the sentence is then the
   * workspace root alone. Where it is said it arrives as the person's own
   * name for the place -- never a path and never an `OWNER/NAME` -- so a set
   * writes it as a name and not as a location.
   */
  readonly scopeWorkspace: (place: string | null, root: string) => string;
  readonly scopePlanDigest: (digest: string) => string;
  /**
   * The card's own heading, and the fold the two digests sit in.
   *
   * The card holds the plan, the workspace, the two digests and what the agent
   * type is allowed, and its only heading named the last of those -- so nothing
   * on the screen said plainly *this is the plan rondo will run and where*
   * (rondo#233 S3 screen review). The digests are folded for the same review's
   * other half: three 71-character hashes were a third of the first screenful
   * at 420px, and there is nothing a person does with one. The workspace root
   * and the agent type's tier and grants joined them there on rondo#431: the
   * person reads which repository, and nothing on those lines is theirs to act on.
   */
  readonly scopePlanHeading: string;
  readonly scopeRecordedFold: string;
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
  /**
   * Beside a drafted value that rests on a cold start (rondo#378): said next
   * to the number and not only in its formula, because a default drawn like a
   * measurement is read as one. `whole` is false where only some of the
   * listed agent types fell to it.
   */
  readonly scopeColdStartNote: (whole: boolean) => string;
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
   * D-0098 rule 2.3 as D-0105 builds it: the take-in test the lap failed,
   * quoted as rondo's reading wrote it, with the one change that passes it.
   */
  readonly reviseDraftTakeIn: (finding: string) => string;
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
  /**
   * Where the rest of what a refused press printed is, under that fold: the
   * host runs as a user service (D-0080), so its output is the journal and not
   * a terminal anybody is looking at.
   */
  readonly hostLog: string;
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
  /** The fold under the work's one line: the whole brief rondo gave it (rondo#439). */
  readonly releaseBrief: string;
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
  /**
   * What the body says, in the person's language, above the body itself
   * (rondo#437): the body is written for the pull request's reviewers and is
   * sent as it is, so the screen says what is in it rather than translating it.
   */
  readonly publishBodyLead: string;
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
  /** Answered, but not with a recorded approval: a change asked for, or no record (D-0092). */
  readonly publishAnswerNotApproval: (answer: "approve" | "revise" | null) => string;
  readonly publishNoRun: string;
  readonly publishPlanField: (field: string) => string;
  /** Nowhere to open a pull request: neither the lap nor the host names one. */
  readonly publishNoRepo: string;
  readonly publishTargetRefused: (reason: string) => string;
  readonly publishUncommitted: (paths: string) => string;
  readonly publishUncommittedElsewhere: (branch: string) => string;
  readonly publishUncommittedRemedies: string;
  /** `git status` failed, so what the push would leave behind is unknown (D-0099). */
  readonly publishStatusUnreadable: (reason: string) => string;
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
  /**
   * **What a pressed button says while its press is on the way** (rondo#375).
   * A press is a native form post, and the page it lands on can be seconds
   * (a scope, an approval) or a whole lap (a start, a change asked for) away;
   * with nothing changing in between, the owner could not tell a press from no
   * press. `page/composer.js` puts the label on the button it disables, and
   * unhides the note beside it where the wait is long enough to need saying.
   */
  readonly scopeBusy: string;
  /**
   * **The person's next step, at the top of the thread** (rondo#375): a
   * heading that says it is theirs, one line saying what is waiting and what
   * the press does, and the label of the one way forward.
   */
  readonly nextStepHeading: string;
  readonly nextStepScope: string;
  readonly nextStepDrafted: string;
  /** A question in the thread waits on the person: answering is the next step (rondo#431). */
  readonly nextStepAnswer: string;
  readonly nextStepStart: string;
  readonly nextStepStartAction: string;
  readonly nextStepPublish: string;
  /**
   * A request that names a repository rondo does not work in yet (rondo#383,
   * D-0090): what was named, that nothing was drafted, and what adding does.
   */
  readonly nextStepAddRepository: (named: string, repo: string) => string;
  /** The one confirmation adding a repository takes. */
  readonly addRepositoryAction: string;
  readonly addRepositoryBack: string;
  /** A repository whose worker can run no build or test, because rondo could not tell how. */
  readonly repositoryUnbuilt: (repo: string) => string;
  readonly addRepositoryRefusedNoApprover: string;
  readonly addRepositoryRefusedPress: string;
  readonly addRepositoryRefusedForm: string;
  /** No `gh`, or not signed in: this computer's setup, so whoever installed rondo. */
  readonly addRepositoryRefusedInstall: string;
  /** The forge has no such repository, or this account cannot see it. */
  readonly addRepositoryRefusedUnseen: string;
  /** Anything else: the network, a timeout, a copy rondo could not read. */
  readonly addRepositoryRefusedFailed: string;
  /** Setup never recorded a plan to add one beside. */
  readonly addRepositoryRefusedNoSetup: string;
  /** The request no longer names that repository, or rondo already works in it. */
  readonly addRepositoryRefusedChanged: string;
  readonly approveBusy: string;
  readonly startBusy: string;
  readonly reviseBusy: string;
  readonly publishBusy: string;
  /** What a change asked for is waiting on, and for how long. */
  readonly lapBusyNote: string;
  /** What a start press is waiting on: the lap's row, after which the thread shows it (D-0109). */
  readonly startBusyNote: string;
  /**
   * What rondo writes into the request's thread when a start it had already
   * answered stopped with a fault of rondo's own (D-0109 rule 3).
   *
   * **The person's language and the person's words**, for the reason
   * {@link reachYourTurn} is in them: this is read by the person and by nobody
   * else. What went wrong is on the lap's own row and on the host's console,
   * because rondo's internal sentence is not a thing to put in front of anybody
   * (D-0076 rule 4.2).
   */
  readonly startStoppedSaid: string;
  /**
   * What rondo writes into the request's thread when a lap it ran ended
   * `failed` (D-0110 rule 2): an ask, so the stop is the person's turn until
   * they answer it. `said` is rondo's own sentence for a stop it knows by name
   * (`refusalSaid`, such as the turn running out), or null, when the thread's
   * own line for the lap says what happened. The options are the answering
   * box's two presses.
   */
  readonly lapStoppedSaid: (said: string | null) => string;
  /**
   * The same stop, when rondo could not end the lap either (D-0109 rule 3):
   * said as itself, because inviting somebody to start again over work that is
   * still holding its place would be the page lying about its own state.
   */
  readonly startStoppedHeldSaid: string;
  readonly publishBusyNote: string;
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
  readonly publishRefusedStatusUnreadable: (detail: string) => string;
  readonly publishRefusedNotRead: string;
  readonly publishRefusedNothingOverruled: string;
  readonly publishRefusedChanged: string;
  readonly publishRefusedStillRunning: string;
  readonly publishRefusedNoContinuo: string;
  readonly publishRefusedPushFailed: (detail: string) => string;
  readonly publishRefusedPullRequestFailed: (detail: string) => string;
  readonly publishRefusedRunNotClosed: string;
  readonly publishRefusedNotStarted: string;
  /**
   * **The merge press** (rondo#380, `D-0091`): the person's next step once the
   * checks are green on the head and nothing waits on them, what the button
   * says and says while it is on its way, and why a press merged nothing.
   */
  readonly nextStepMerge: string;
  readonly mergeAction: string;
  /** The merge's confirm screen (rondo#437 item 6, D-0112 rule 7): its heading. */
  readonly mergeConfirmHeading: string;
  /** Which pull request goes where, in the way the repository allows. */
  readonly mergeConfirmInto: (pullRequest: string, base: string) => string;
  /** The commit the press merges, with the checks green on it. */
  readonly mergeConfirmCommit: (commit: string) => string;
  readonly mergeConfirmNoUndo: string;
  /** The commits not the lap's that the list does not name. */
  readonly mergeConfirmMore: (count: number) => string;
  /** Where nothing can be merged from this screen now. */
  readonly mergeConfirmNotNow: string;
  /**
   * The same press over a head the lap did not push (rondo#412): what the
   * head carries is said above it, and the card and the button say that
   * merging merges it too.
   */
  readonly nextStepMergeMoved: (count: number) => string;
  readonly mergeMovedAction: string;
  readonly mergeBusy: string;
  readonly mergeBusyNote: string;
  readonly mergeBack: string;
  readonly mergeRefusedNoApprover: string;
  readonly mergeRefusedPress: string;
  readonly mergeRefusedForm: string;
  readonly mergeRefusedGone: string;
  readonly mergeRefusedNotPublished: string;
  readonly mergeRefusedNotGreen: string;
  readonly mergeRefusedAsked: string;
  readonly mergeRefusedMerged: string;
  readonly mergeRefusedLanded: string;
  readonly mergeRefusedMoved: string;
  readonly mergeRefusedRetargeted: string;
  readonly mergeRefusedClosed: string;
  readonly mergeRefusedMethod: string;
  readonly mergeRefusedForge: string;
  readonly mergeRefusedFailed: (detail: string) => string;
  readonly mergeRefusedQueue: string;
  readonly mergeRefusedUnconfirmed: string;

  /**
   * rondo#417 (D-0105): the next-step card that offers to settle a published
   * pull request's conflict, its press, and why a press started nothing. The
   * attempt it starts stops at its gate like any other, so the card says the
   * person checks it before anything is pushed.
   */
  readonly nextStepConflictFix: (pullRequest: string, base: string) => string;
  readonly conflictFixAction: string;
  readonly conflictFixBusy: string;
  readonly conflictFixBack: string;
  readonly conflictFixRefusedNoApprover: string;
  readonly conflictFixRefusedPress: string;
  readonly conflictFixRefusedForm: string;
  readonly conflictFixRefusedGone: string;
  readonly conflictFixRefusedNotItsScope: string;
  readonly conflictFixRefusedForked: string;
  readonly conflictFixRefusedNoContinuo: string;
  readonly conflictFixRefusedNotSetUp: string;
  readonly conflictFixRefusedOutside: (test: string) => string;
  readonly conflictFixRefusedNotStarted: string;
  /**
   * The approved fix's publish (rondo#417, D-0105): it pushes onto the pull
   * request that is already open and opens none, so every sentence that says
   * *open* says *update* instead.
   */
  readonly nextStepPublishUpdate: (pullRequest: string) => string;
  readonly publishUpdates: (pullRequest: string, base: string) => string;
  readonly publishUpdateAction: (pullRequest: string) => string;
  readonly publishBusyUpdate: string;
  readonly publishPlainUpdate: string;
  readonly publishNoteUpdate: string;
}

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
