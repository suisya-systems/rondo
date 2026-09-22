/**
 * The operator's command line: the three doors, and the escape hatch.
 *
 * Before this module the machine worked and nobody could reach it. Starting a
 * lap meant writing a throwaway `tsconfig`, compiling the tree by hand and
 * driving the composition root from a thirty-line `drive.mjs`; answering the
 * gate meant six continuo verbs typed in order with ids copied between them;
 * publishing meant remembering that continuo runs no git at all. This file is
 * those three things as `start`, `answer` and `publish` (D-0025).
 *
 * **It is deliberately thin, and the thinness is the design.** Every rule about
 * what a plan is lives in `readPlan`; every rule about what a verb's arguments
 * may be lives in `src/continuo/invoker.ts`; every rule about which transition
 * follows which lives in `src/refrain/`. What is here is argv, the order the
 * gate's verbs go in, and prose. Nothing in this file knows what a `RunPlan`
 * field means -- which is why it can be minimal without being a second place
 * that has to be kept true.
 *
 * **The layer's rule still holds.** `src/access/` may reach the loop and the
 * loop may never reach back, so nothing under `src/refrain/` imports this. The
 * one external capability the operator's surface needs beyond argv and a file
 * read -- spawning `git` and `gh` -- is not here either: it is in
 * `./forge.ts`, so the boundary test can say that *this* module cannot spell a
 * push (D-0025 rule 6).
 */
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute } from "node:path";

import { type Basis, readSplitPayload } from "../advisory/proposal.js";
import { allowedCommandsFor } from "../cadenza/facade.js";
import {
  ackGate,
  answerGate,
  closeRun,
  deliverGate,
  presentGate,
  showGate,
  showRun,
  startContinuo,
  type VerifiedContinuo,
} from "../continuo/invoker.js";
import {
  type ContinuoResult,
  type GateDetail,
  isNestedSandboxRefusal,
  type ObservedSession,
} from "../continuo/protocol.js";
import { lapTranscriptDirectory, readLapLog } from "../continuo/transcript.js";
import { allocate } from "../refrain/allocator.js";
import {
  isLanguageTag,
  type RunPlan,
  readPlan,
  readRunPlan,
  type TakeIn,
} from "../refrain/plan.js";
import {
  CONSERVATIVE_HOST_POLICY,
  type HostPolicy,
  hostPolicy,
  type LoopPolicy,
} from "../refrain/policy.js";
import { revisionPlan } from "../refrain/revision.js";
import { pathsOverlap, repositoryKey } from "../store/lanes.js";
import { canonicalJson, contentDigest } from "../store/plan.js";
import {
  type AgentTypeRecordDraft,
  APPROVED_OUTCOME,
  approvedForPublication,
  findingBasisText,
  type GateAnswer,
  type IterationRecord,
  isDeterministicReadingDrafter,
  isModelReadingDrafter,
  isTerminal,
  type JsonRecord,
  type JsonValue,
  type LaneClaimAsk,
  type LapReading,
  latestReading,
  modelReadingDue,
  planField,
  readingCoverage,
  reviewedReading,
  type ScopeBudgets,
  type ScopeOutwardAct,
  type StoredScope,
  scopePayloadWithDefaults,
} from "../store/records.js";
import {
  type AdvisoryRecord,
  type IterationStore,
  openAdvisoryRecord,
  openIterationStore,
  type ReadOutcome,
} from "../store/sqlite.js";
import {
  approvedRetry,
  COMMAND_LINE_SURFACE,
  composeBetweenLaps,
  DETERMINISTIC_DRAFTER,
  type ExplainOutcome,
  type ExplainPorts,
  elevateObservation,
  explainIteration,
  OPERATOR_PAGE_SURFACE,
  PROPOSABLE_KINDS,
  type ProposeOutcome,
  proposeRetry,
  recordAnswer,
  showProposal,
  type UnpromptedPorts,
} from "./advisory.js";
import { checksHost, continuoChecksReader, pullRequestIn } from "./checks-host.js";
import { type ParsedCommand, parseCommand } from "./cli-parse.js";
import {
  abandon,
  admit,
  type ClaimComparison,
  type ClosingNotReread,
  type ConductorReport,
  compareClaim,
  conductorPorts,
  endFaulted,
  notRereadSentence,
  type ReportingPorts,
  type RequestThread,
  readHolder,
  reportToRequest,
  resume,
  takenInCommit,
} from "./conductor.js";
import { asciiEscape, consoleSeams, legibleAsciiEscape, relayUpstream } from "./console.js";
import { allowedBashIn } from "./delegation.js";
import { type ClosingFinding, closingLapSection, definitionOfDone } from "./done.js";
import {
  type DraftedStartReadiness,
  draftedStartReadiness,
  onLanding,
  planOrder,
} from "./drafted-start.js";
import { drafterHost } from "./drafter-host.js";
import {
  cloneRepository,
  fetchLapBase,
  fileCounts,
  inspectBranchTip,
  inspectLapWork,
  inspectPushTarget,
  inspectTopicBranch,
  isAncestor,
  type LapWorkInspection,
  type LapWorkRequest,
  listOpenIssues,
  openPullRequest,
  pushTopicBranch,
  readChangedPaths,
  readCommitsBetween,
  readIssueFromForge,
  readLanding,
  readPullRequest,
  readRecordAdditions,
  readRecordFloor,
  runDrafter,
} from "./forge.js";
import { forgeHost, publishPreflight, redactRemoteUrl } from "./forge-preflight.js";
import { hostFailure } from "./host-failure.js";
import { type InboxOutcome, showInbox, type TranscriptLocation } from "./inbox.js";
import {
  bareIssueRepository,
  commandFailure as forgeCommandFailure,
  issueReader,
  issuesQuote,
  PROMPT_TRANSPORT_BOUND_BYTES,
  requestOf,
  unreadIssues,
} from "./issue-read.js";
import { mergePress } from "./merge.js";
import {
  type DrafterPorts,
  draftedPlanRun,
  type HeldPlan,
  heldPlanByDigest,
  heldPlans,
  requestRepository,
} from "./model-draft/host.js";
import { isModelDrafterName } from "./model-draft/judgement.js";
import { modelReviewPorts, takeModelReading } from "./model-review/host.js";
import { modelReadingLines } from "./model-review/judgement.js";
import { orderHost } from "./order-host.js";
import type {
  ClaimReach,
  LapMaterialRead,
  PublishBlock,
  PublishShown,
  ReviewBlock,
} from "./page/contract.js";
import { asksOverLine, conflictFixBlock, resultOf } from "./page-logic/result.js";
import { threadsOf } from "./page-logic/threads.js";
import { type PullRequestText, pullRequestText } from "./pull-request.js";
import { notifierAt, reachThePerson, recordTabNotice } from "./reach.js";
import { nextNumbers, numbersSection } from "./record-numbers.js";
import {
  cloneDirectory,
  planForRepository,
  repositoryParts,
  setupRootOf,
} from "./repository-add.js";
import { denialLine, evidenceOf, LIST_LIMIT, READING_REMOTE, uncommittedPaths } from "./review.js";
import { reviseDrafterHost } from "./revise-draft/host.js";
import {
  admitUnderScope,
  agentTypeRecordOf,
  approvalTip,
  heldAgentTypeLines,
  type ScopedAdmission,
} from "./scope.js";
import { triageHost } from "./triage-host.js";
import {
  type AddedRepository,
  type AddRepositoryInput,
  AddRepositoryPort,
  AnswerPort,
  type ClaimRefusal,
  type ConflictFixed,
  type ConflictFixInput,
  MergePort,
  newDraftId,
  newIterationId,
  type Published,
  type PublishInput,
  PublishPort,
  type PublishRefusal,
  type RaiseInput,
  type Released,
  type ReleaseInput,
  ReleasePort,
  type Revised,
  type ReviseInput,
  RevisePort,
  type ReviseRefusal,
  SayPort,
  type ScopedStartInput,
  type ScopeFormDraft,
  ScopePort,
  type ScopeRecorded,
  type Started,
  serveOperatorPage,
  TriagePort,
} from "./web-app.js";
import { type Chrome, chromeFor, EN } from "./wording.js";

/**
 * The whole surface on one screen.
 *
 * ASCII only, and asserted so by `test/access/cli.test.ts`. That is D-0004 and
 * it is not decoration: the Windows cell's console may be cp932, where a
 * character it cannot encode crashes the writer rather than printing badly, and
 * vitest captures stdout through a UTF-8 path -- so a test that reads this
 * string is the only thing that catches an em-dash before an operator does.
 */
/**
 * Where the read-only page listens when nobody says.
 *
 * Above 1024 so it needs no privilege, and outside the ranges a browser
 * refuses outright. Nothing depends on the number: it is printed on the line
 * that starts the server.
 */
const DEFAULT_WEB_PORT = 7333;

export const USAGE = `rondo - the operator surface for delegated work

  rondo start --plan FILE --iteration-id ID [--prompt TEXT]
              [--prompt-file FILE] [--message-id ID]
              [--scope-decision-id ID]
                          take one request and run a lap, and stop at the gate.
                          --prompt-file reads the request from a file, byte for
                          byte, for a request too long or too many paragraphs
                          to type as a shell argument. It and --prompt say the
                          same thing two ways, so only one of them may be given.
                          The run id, the topic branch and the workspace are
                          derived from --iteration-id; rondo mints them, so
                          there is no flag to type them. --message-id names
                          the message that opened the request this lap came
                          from, and is refused when it opens none.
                          --scope-decision-id admits the lap under an approved
                          scope instead of asking: it needs --message-id, and
                          is refused with the test that refused it, spending
                          nothing, unless every test of the scope passes. An
                          unanswered question in the request's thread holds it
  rondo request --actor-id ID --message-id ID --body=TEXT
                          open a request: your words, stored as written, as a
                          message in the conversation that replies to nothing.
                          Write --body with an equals sign
  rondo reply --actor-id ID --message-id ID --in-reply-to ID --body=TEXT
                          reply to a message in a request thread. A message is
                          never edited or deleted: a correction is a reply
  rondo answer [--iteration-id ID]
                          show the gate that is waiting for a person. Name one
                          when more than one iteration is open
  rondo answer --actor-id ID --body=TEXT [--iteration-id ID]
               [--verified=TEXT]
                          answer it, and settle the iteration. Write --body
                          with an equals sign: an answer may begin with a dash.
                          --verified says what you ran to check the work before
                          answering -- recorded on the iteration, and carried
                          into the pull request, as your claim: rondo did not
                          watch it run and does not say it did
  rondo revise --actor-id ID --body=TEXT [--iteration-id ID]
               [--scope-decision-id ID [--closing-fix]]
                          answer the gate with a change to make, and run a
                          second lap that continues from the first one's
                          branch. The second lap's run id, topic branch and
                          workspace are derived from --iteration-id, the same
                          way rondo start mints the first lap's.
                          --scope-decision-id spends an approved scope on the
                          second lap: the gate is still your answer, and it is
                          not touched unless every test of the scope passes.
                          --closing-fix makes it the one closing lap a scope
                          with below_threshold fix_unread allows after the
                          review exit: it fixes the findings left below the
                          threshold, with a test for each, and is not read
                          again
  rondo publish --actor-id ID --iteration-id ID [--repo OWNER/NAME]
                [--remote NAME] [--dry-run] [--allow-remote-mismatch]
                [--despite-review]
                          push the branch, open the pull request, close the run.
                          The repository it opens the pull request in is the
                          lap's own plan's, recorded there when its repository
                          was set up; --repo names one for a plan that carries
                          none, which is every plan written before one store
                          served several repositories. Refuses before it prints
                          when the lap names no repository either way, when the
                          workspace cannot push where the plan says, when the
                          push remote and the repository are different ones, or
                          when the independent reading of the work raised
                          something, was never taken, or was taken over other
                          commits. --despite-review overrules that last one
  rondo abandon --iteration-id ID --reason TEXT
                          end an iteration rondo cannot finish
  rondo release --iteration-id ID --actor-id ID
                          give up the paths a finished line holds, so other
                          work in its repository may start. For a line whose
                          work you know landed in a form rondo cannot see (a
                          conflict resolved, an edit made on the forge), or
                          one you are retiring. Every lap of the line must
                          have ended; the release is recorded as yours
  rondo elevate --iteration-id ID --actor-id ID --message-id ID
                --observation=TEXT --basis LOCATOR
                          hand one observation of yours to the advisory. The
                          observation becomes a message in the conversation and
                          the proposal records which message it came from and
                          who elevated it. --basis is required and names where
                          the observation rests: snapshot:/pointer,
                          iteration:ID, gate:ID#SEQ, run:ID,
                          repo:PATH@COMMIT#FIRST-LAST, message:ID,
                          scope:ID, proposal:ID or setup:ID. Write
                          --observation with
                          an equals sign: an observation may begin with a dash
  rondo propose --iteration-id ID --successor-id ID
                --kind run_plan|agent_type|contract_keys
                          propose what a retry of one iteration could run under,
                          as an option set with exactly one recommended and the
                          contract each option would run under. --kind picks the
                          question: which plan it runs (run_plan), which agent
                          type it runs under (agent_type), or which keys that
                          agent type carries as granted rather than askable
                          (contract_keys). Records the proposal and every
                          contract before it shows them. Approving one records
                          the contract; rondo retry is what spends it
  rondo decide --proposal-id ID --actor-id ID --outcome approved|declined
               [--contract-digest DIGEST]
                          answer a proposal. --contract-digest is the contract
                          line of the option you are approving, copied from the
                          screen, and it is required on approved and refused on
                          declined. An explanation cannot be answered at all
  rondo scope --payload-file FILE --actor-id ID [--supersedes-scope-id ID]
              [--plan FILE]...
                          write one scope: the requests, workspaces and agent
                          types a run of decisions may be taken inside without
                          asking, and its budgets. Each --plan (an absolute
                          path) records the agent type of that plan so the scope
                          may list it before any lap has run, and the screen
                          prints its digest. Every listed agent type is shown
                          with the tier and granted keys of the record held.
                          FILE is an absolute path to
                          the JSON payload; review_rounds, severity_threshold,
                          outward_acts and irreversible_additions take their
                          defaults when absent, and an absent below_threshold
                          is leave. Records the row before it shows
                          it, digest included. A change to a scope is a
                          successor naming the row it replaces, and the screen
                          says what the predecessor's approval has spent
  rondo decide-scope --scope-id ID --scope-digest DIGEST --actor-id ID
                     --outcome approved|declined
                          answer a scope. --scope-digest is the digest line
                          copied from the screen; one scope takes one answer
  rondo setup-plan --plan FILE --actor-id ID
                          record the plan setup composed into this store, so
                          the page offers it with nothing pasted. Run by
                          scripts/dogfood-env.sh as its last step; FILE is
                          read once and never again. Each run is a row of its
                          own, and a store holds the setup of one repository
  rondo retry --iteration-id ID --successor-id ID --scope-decision-id ID
                          an in-scope retry: admit the stored plan of
                          --iteration-id again as --successor-id, spending the
                          approved scope instead of asking. Refused, with the
                          test that refused it, unless every test of the scope
                          passes; a refusal takes no act and spends nothing
  rondo retry --proposal-id ID
                          spend the approval against one proposal: admit the
                          retry it authorises, under the identity the proposal
                          was composed for. The contract that plan composes is
                          recomposed from the material as it stands now and
                          compared against the one you approved; if they differ
                          -- the catalog moved, the agent type changed, the
                          identity was taken -- nothing runs and the approval
                          is not spent. An approval is spendable once
  rondo inbox --actor-id ID
                          what is waiting on you, what is running, what changed
                          since you last looked, and what was put to you versus
                          withheld. Reads rondo's own rows and drives no
                          continuo. Looking is recorded: it counts what it
                          showed you (once per thing, however often it is
                          drawn) and moves your last-look mark
  rondo show --proposal-id ID
                          read one proposal back: its options in the order the
                          record holds them, which one is recommended, what each
                          rests on with the material under it, whether anybody
                          has answered, and what answering forecloses. Composed
                          from the row, so a proposal stays answerable long
                          after the screen that drafted it has scrolled away
  rondo between            say what spans every live lap: which are open against
                          the same base branch (with their run, branch and
                          workspace), which findings were read on more than one,
                          and what the two concurrency bounds have refused.
                          Reads rondo's own rows and drives no continuo. It
                          records what it said and proposes nothing: an
                          adjacency is where to look, not a collision rondo
                          observed
  rondo web [--port N] [--repo OWNER/NAME] [--remote NAME]
                [--allow-remote-mismatch]
                          serve one page on 127.0.0.1 (default port ${String(DEFAULT_WEB_PORT)})
                          showing what inbox, between and explain show, redrawn
                          every few seconds. Looking at it moves no last-look
                          mark and counts no presentation: a redraw writes
                          nothing. The one thing that does is an approve button
                          beside each open gate: it answers that gate 'approve'
                          as RONDO_APPROVER, by the same path rondo answer
                          takes, and is drawn only when that is set. --repo
                          names the forge repository to publish a lap whose own
                          plan carries none to, with the same meaning it has on
                          rondo publish; one host serves several repositories,
                          each named by the plan a lap ran on, so without it the
                          page still publishes every lap whose plan names one.
                          There is no authentication
                          because there is no route in from anywhere but this
                          machine
  rondo explain --iteration-id ID
                          say what the store holds about one iteration, with
                          what each claim rests on. Reads rondo's own rows and
                          drives no continuo, so it reaches a row that is stuck
                          or already ended. It records what it said and
                          proposes nothing: an explanation binds nothing and
                          cannot be approved

environment:
  RONDO_CONTINUO_CLI  absolute path to continuo's built dist/cli.js
  RONDO_STORE         absolute path to rondo's own iteration database
  RONDO_APPROVER      the one identity allowed to answer a gate or publish
  RONDO_MAX_LIVE      how many iterations may be open at once. Default 3. An
                      iteration suspended at a gate holds no worker, so this
                      bounds how many questions may wait on a person at once
  RONDO_MAX_OCCUPYING how many may be executing at once. Default 1, and raising
                      it needs continuo to allow a second concurrent lap first
  GH_HOST             the forge host the repository is on. Default: github.com

The command line never merges a pull request, and nothing here runs unless you
typed it. The page merges one only when a person presses its merge button.
`;

/**
 * The policy `start` runs under, and why it is not `CONSERVATIVE_POLICY`.
 *
 * `CONSERVATIVE_POLICY` is `ask_every_iteration`, which `nextStep` refuses
 * *before a row exists* -- correctly, and by design (D-0019 rule 9). It is the
 * right default for a library whose caller has not said otherwise, and it
 * cannot be the value a command called `start` runs under, because under it
 * `start` never starts. So the surface states its own: one iteration, and a
 * human before anything lands, which is what a gate already guarantees.
 *
 * The reason this is three lines of policy rather than a flag is D-0012:
 * `maxIterations` above one would authorise a second iteration, and nothing in
 * lap 1 can allocate the second `(run id, topic branch, workspace)` triple it
 * would need.
 */
const START_POLICY: LoopPolicy = Object.freeze({
  autonomy: "ask_before_landing",
  maxIterations: 1,
});

const STORE_ENV = "RONDO_STORE";

/**
 * The two bounds, as environment variables (D-0023 rule 12).
 *
 * Read here, once, on the way to opening the store, because this is where
 * rondo's other deployment facts are read: the database's path is already an
 * environment variable for the same reason, and one process with one bound is
 * the shape that makes the number mean anything. They are emphatically **not**
 * on `LoopPolicy`, which `admit()` takes per call -- a bound each request may
 * restate is not a bound.
 *
 * The durable, operator-editable form is D-0020's operating surface and is
 * deliberately not taken here (D-0023 rule 13).
 */
const MAX_LIVE_ENV = "RONDO_MAX_LIVE";
const MAX_OCCUPYING_ENV = "RONDO_MAX_OCCUPYING";
const APPROVER_ENV = "RONDO_APPROVER";

/**
 * The language rondo writes its own prose to the operator in (D-0055 rule 5).
 *
 * **A host fact, read where the host's other facts are read, and recorded
 * nowhere.** The host has one operator (D-0020), so their language is a
 * property of the host in the same way the store's path and the approver's name
 * are -- one variable in the set that already holds `RONDO_STORE`,
 * `RONDO_APPROVER`, `RONDO_CONTINUO_CLI` and the two bounds. There is no file,
 * no precedence order, no per-lap override and no plan field, which is what
 * keeps D-0019 rule 3's refusal of a configuration *layer* intact.
 *
 * **Above `Accept-Language` rather than instead of it** (D-0056 rules 2 and 3).
 * D-0055 refused the header; that refusal is withdrawn and the half of its
 * argument that survived is what places this variable *above* the browser's
 * list: a variable is a person stating a fact about this deployment's one
 * operator and is what the terminal reads, while a header is a browser-wide
 * preference set for the web at large. So a host that has spoken is not
 * overridden by a browser default, and the browser decides the first visit
 * exactly when the host has said nothing. Still no file, no precedence order of
 * its own, and not derived from the rows on screen.
 *
 * **Absent means nobody asked, and so does a well-formed tag this tree ships no
 * wording for** -- which under D-0056 rule 2 is a step *saying nothing* rather
 * than a step answering English, so the next one answers. That is why what is
 * carried to the page is the tag and not a resolved set.
 */
const OPERATOR_LANGUAGE_ENV = "RONDO_OPERATOR_LANGUAGE";

/**
 * The program setup found for putting one line in front of the person when
 * they are not looking at the page (rondo#311), written into the service by
 * `scripts/start-command.sh`.
 *
 * **Absent is an ordinary state and never a refusal.** A machine with nothing
 * that shows a notification is a machine where rondo waits to be looked at,
 * which is what rondo did before this existed -- so an unset variable starts
 * a host that reaches nobody, and does not stop one from starting. The path
 * is not checked here either: setup resolved it, and whether it still runs is
 * answered by running it (`notifierAt`), which is the only honest way to ask.
 */
const NOTIFIER_ENV = "RONDO_NOTIFIER";

/**
 * The tag one host stated about its operator, or a refusal naming this
 * variable.
 *
 * **A tag and not a set** (D-0056 rule 3): the lookup happens per request in
 * `src/access/web.tsx`, beside the other four steps of rule 2, because a step
 * that resolved to `EN` here could not be told from a step that said nothing.
 * `null` is *nobody asked*.
 *
 * **Refused before a page is served rather than ignored**, which is the
 * treatment the two capacity bounds already get: a mistyped tag is an operator
 * who asked for something and would otherwise get an English page with no
 * account of why. The grammar is `src/refrain/plan.ts`'s, shared because both
 * fields need the same answer; the message is this caller's, because one naming
 * `materialLanguage` would send an operator to the plan file to fix an
 * environment variable (D-0055 rule 5).
 *
 * An empty string is `unset` and not a refusal, on `hostPolicyOf`'s reading of
 * the same shape: `export RONDO_OPERATOR_LANGUAGE=` is how a shell says *never
 * mind*.
 */
export function operatorLanguage(
  environment: Readonly<Record<string, string | undefined>>,
): { readonly tag: string | null } | { readonly refusal: string } {
  const asked = environment[OPERATOR_LANGUAGE_ENV];
  if (asked === undefined || asked.trim() === "") {
    return { tag: null };
  }
  if (!isLanguageTag(asked)) {
    return {
      refusal:
        `${OPERATOR_LANGUAGE_ENV} is '${asked}', which is not an IETF language tag. A tag is a ` +
        "primary subtag and optional hyphenated subtags -- 'ja', 'zh-Hant' -- and unset means " +
        "rondo writes its own prose in English.",
    };
  }
  return { tag: asked };
}

/**
 * One plan rondo holds for a request, by digest (rondo#238), or null when it is
 * not one; a refusal only when the plans will not read.
 */
async function heldPlanOf(
  ports: { readonly store: IterationStore; readonly record: AdvisoryRecord },
  requestMessageId: string,
  planDigest: string,
): Promise<{ readonly plan: HeldPlan | null } | { readonly refusal: string }> {
  try {
    return {
      plan: await heldPlanByDigest({ ...ports, now: Date.now }, requestMessageId, planDigest),
    };
  } catch (error) {
    return {
      refusal: `the plans rondo holds could not be read: ${hostFailure(error).text}`,
    };
  }
}

/** The remote a push goes to when the operator does not name one. */
const DEFAULT_REMOTE = "origin";

// The parser moved to `./cli-parse.js` (rondo#341 step 2), and the command
// list is re-exported by name because `test/architecture/docs-claims.test.ts`
// reads it from here -- it checks the reference against the verbs *this*
// module dispatches. Named rather than `export *`, which the boundary scan
// reduces to a whole-module sentinel and refuses.
export { COMMANDS } from "./cli-parse.js";

/** Write one line of rondo's own words, escaped like every other line. */
function say(line: string): void {
  consoleSeams.write(`${asciiEscape(line)}\n`);
}

/**
 * Write one value of continuo's own words, keeping its paragraphs legible.
 *
 * Only for a value that is the whole of what a line shows -- today that is
 * the gate's `rationale` -- and never for a value folded alongside others on a
 * line rondo composes, where an embedded newline must stay `\uXXXX` (see
 * `pickWaiting`'s comment on the ambiguous-iteration list, further down this
 * file). rondo#68.
 */
function sayLegible(line: string): void {
  consoleSeams.write(`${legibleAsciiEscape(line)}\n`);
}

/** Write one refusal of rondo's own. Exit status 2 goes with these. */
function refuse(line: string): number {
  consoleSeams.writeError(`${asciiEscape(line)}\n`);
  return 2;
}

/**
 * Turn one continuo outcome into an exit status, having said what it was.
 *
 * The three families are kept apart because they are three different things for
 * an operator to do: a refusal is continuo declining, which is usually the
 * operator's next move; a defect or a protocol break is rondo's problem; a
 * timeout is neither and may have left work in flight.
 */
function relayFailure(verb: string, result: ContinuoResult<unknown>): number {
  switch (result.kind) {
    case "refused":
      // continuo's own diagnosis, under its own error class. The operator's
      // next move is usually in this sentence.
      relayUpstream(`continuo ${verb} refused (${result.errorClass})`, result.message);
      return 2;
    case "refusedInProse":
      // An argparse-level refusal, which is prose rather than a document.
      // Relayed verbatim: rondo does not parse it (D-0015 rule 7).
      relayUpstream(`continuo ${verb} refused`, result.text);
      return 2;
    case "timedOut":
      // rondo's ceiling killed the CLI and not whatever it had started, so this
      // is one of the two failures that may have left work running.
      relayUpstream(`continuo ${verb} timed out`, result.reason);
      return 1;
    case "endedAbnormally":
      // The other one (`D-0035`): the CLI never reached its own reporting path,
      // so whatever it had started is unaccounted for. Said in its own words
      // rather than folded into the line below, because "could not be read"
      // describes a document and there was none.
      relayUpstream(`continuo ${verb} ended without reporting`, result.reason);
      return 1;
    case "protocolRefusal":
    case "invokerDefect":
      relayUpstream(`continuo ${verb} could not be read`, result.reason);
      return 1;
    default:
      // `answered` -- the caller checked and this is unreachable, but a fallthrough
      // that returned 0 would be a failure path reporting success.
      relayUpstream(
        `continuo ${verb}`,
        "rondo asked for a failure to be relayed and got an answer.",
      );
      return 1;
  }
}

/** What one pass over the gate did, or why it stopped. */
export type WalkOutcome =
  | {
      readonly kind: "walked";
      readonly closed: boolean;
      /**
       * Whether **this** walk carried the body to the gate.
       *
       * False exactly when the gate already had an outcome, which is a
       * successful walk that sent nothing -- the right thing to do, and a
       * result a caller must not read as "the answer landed". `answer` may
       * ignore it, because it has nothing left to do either way. `revise` may
       * not: it would otherwise start a lap whose instruction was never
       * recorded, under an outcome that may be `withdrawn` or `expired` rather
       * than anyone saying anything.
       */
      readonly answerSent: boolean;
    }
  | { readonly kind: "failed"; readonly status: number };

/** The ports `walkGate` drives, injected so a test can watch the order. */
export interface GateVerbs {
  readonly present: typeof presentGate;
  readonly deliver: typeof deliverGate;
  readonly ack: typeof ackGate;
  readonly answer: typeof answerGate;
  readonly show: typeof showGate;
}

/** The real ones. */
export const GATE_VERBS: GateVerbs = {
  present: presentGate,
  deliver: deliverGate,
  ack: ackGate,
  answer: answerGate,
  show: showGate,
};

/** Everything one pass over the gate needs. */
export interface WalkRequest {
  readonly db: string;
  readonly gateId: string;
  readonly destinationDir: string;
  readonly holder: string;
  readonly actorId: string;
  readonly body: string;
  /**
   * Record which answer this is (D-0092), called once continuo has accepted
   * the body and before anything else is walked.
   *
   * A function rather than the store because the walk knows *when* and only
   * its caller knows *which* -- the verb the person used, never the text: the
   * approve press and `rondo answer` record `approve`, the revise press and
   * `rondo revise` record `revise`.
   */
  readonly recordAnswer: () => Promise<void>;
}

/**
 * What {@link WalkRequest.recordAnswer} is for one iteration's gate: the store's
 * write with every value but the answer already the row's.
 */
function answerRecorder(
  store: Pick<IterationStore, "recordGateAnswer">,
  iterationId: string,
  gateId: string,
  answer: GateAnswer,
  actorId: string,
): () => Promise<void> {
  return async () => {
    await store.recordGateAnswer(iterationId, gateId, answer, actorId, Date.now());
  };
}

/**
 * Carry one answer from a person to a closed gate, in continuo's own verbs.
 *
 * Six verbs on the longest path -- present, deliver, ack, answer, deliver, ack
 * -- and the shape of that sequence is not arbitrary. `present` enqueues the
 * relay and **does not move the stage**; the ack of that relay is what moves it
 * to `presented`, which is the only stage `answer` may be called from. `answer`
 * is then one verb doing two writes: it records the advance and enqueues the
 * *forwarded* relay, whose ack closes the gate `answered_and_forwarded`. That
 * outcome is continuo's own, written as `actor_kind: "system"`, and is not in
 * `gate close`'s vocabulary at all -- nobody decides it -- which is why the walk
 * ends at an ack and never at a close.
 *
 * **It resumes from the stage continuo reports, and never replays from the
 * start.** A walk that always began at `present` would be refused
 * `InadmissibleTransitionRefused` the moment it was retried, which is exactly
 * when a person most needs it to work. And **every message id it uses is read
 * out of the payload that produced it**, never composed from the gate id: the
 * ids are continuo's to spell, and a computed one is a guess that happens to be
 * right until it is not.
 */
export async function walkGate(
  continuo: VerifiedContinuo,
  request: WalkRequest,
  verbs: GateVerbs = GATE_VERBS,
): Promise<WalkOutcome> {
  const observed = await verbs.show(continuo, { db: request.db, gateId: request.gateId });
  if (observed.kind !== "answered") {
    return { kind: "failed", status: relayFailure("gate show", observed) };
  }
  const gate = observed.payload;
  if (gate.outcome !== null) {
    say(
      `Gate ${gate.gateId} is already closed as '${gate.outcome}'. Your answer was not sent, ` +
        "and nothing was written.",
    );
    return { kind: "walked", closed: true, answerSent: false };
  }

  let stage = gate.stage;

  // From 'received': enqueue the relay, deliver it, and ack it. The ack is what
  // moves the gate to 'presented'; the present alone does not.
  if (stage === "received") {
    const presented = await verbs.present(continuo, { db: request.db, gateId: request.gateId });
    if (presented.kind !== "answered") {
      return { kind: "failed", status: relayFailure("gate present", presented) };
    }
    say(
      `  gate present   message ${presented.payload.messageId} (enqueued: ${String(presented.payload.enqueued)})`,
    );

    const delivered = await deliverOnce(continuo, request, gate.runId, verbs);
    if (delivered !== null) {
      return { kind: "failed", status: delivered };
    }

    const acked = await verbs.ack(continuo, {
      db: request.db,
      messageId: presented.payload.messageId,
      actorId: request.actorId,
    });
    if (acked.kind !== "answered") {
      return { kind: "failed", status: relayFailure("gate ack", acked) };
    }
    stage = acked.payload.toStage;
    say(`  gate ack       stage is now '${stage}'`);
  }

  if (stage !== "presented" && stage !== "answered") {
    return {
      kind: "failed",
      status: refuse(
        `Gate ${gate.gateId} is at stage '${stage}', and an answer is carried from 'presented' ` +
          "or 'answered'. Nothing was written.",
      ),
    };
  }

  // `answer` from 'presented', or re-issued from 'answered'. Re-issuing the
  // identical body is idempotent and hands back the forwarded relay's id, which
  // is how a walk interrupted after the answer finds the id it has to ack
  // without composing one.
  const answered = await verbs.answer(continuo, {
    db: request.db,
    gateId: request.gateId,
    body: request.body,
    actorId: request.actorId,
  });
  if (answered.kind !== "answered") {
    return { kind: "failed", status: relayFailure("gate answer", answered) };
  }
  say(
    `  gate answer    forwarded relay ${answered.payload.messageId} ` +
      `(advanced: ${String(answered.payload.advanced)})`,
  );
  // **Recorded here, when continuo holds the body, and not before the walk**
  // (D-0092). Before it, a gate somebody else closed or a walk refused on the
  // way would leave a record of an answer that never reached the gate; here,
  // continuo has accepted this body and refuses any other for this gate, so
  // the record and continuo cannot disagree. A write that fails does not stop
  // the walk: the answer is already spent, and a lap with no record is one the
  // page says it cannot tell -- never one it calls approved.
  try {
    await request.recordAnswer();
  } catch (error) {
    say(
      `  rondo could not record which answer this was, so the page will say it has no record ` +
        `of it: ${hostFailure(error).text}`,
    );
  }

  const deliveredAgain = await deliverOnce(continuo, request, gate.runId, verbs);
  if (deliveredAgain !== null) {
    return { kind: "failed", status: deliveredAgain };
  }

  const finalAck = await verbs.ack(continuo, {
    db: request.db,
    messageId: answered.payload.messageId,
    actorId: request.actorId,
  });
  if (finalAck.kind !== "answered") {
    return { kind: "failed", status: relayFailure("gate ack", finalAck) };
  }
  say(
    `  gate ack       stage is now '${finalAck.payload.toStage}'` +
      (finalAck.payload.closed ? ", and the gate is closed" : ""),
  );
  return { kind: "walked", closed: finalAck.payload.closed, answerSent: true };
}

/**
 * One delivery pass. Null when it worked; an exit status when it did not.
 *
 * `runId` is **the gate's own**, taken from the `gate show` payload rather than
 * from rondo's iteration row, for the reason {@link walkGate} gives about
 * message ids: the resource a relay is queued on is continuo's to decide, and a
 * run id sourced from anywhere else is a guess that happens to agree until it
 * does not. Null is continuo's answer for a gate scoped to no run, and then the
 * flag is left off -- which names the global resource, which is exactly where a
 * runless gate's relays live.
 */
async function deliverOnce(
  continuo: VerifiedContinuo,
  request: WalkRequest,
  runId: string | null,
  verbs: GateVerbs,
): Promise<number | null> {
  const delivered = await verbs.deliver(continuo, {
    db: request.db,
    destinationDir: request.destinationDir,
    holder: request.holder,
    runId,
  });
  if (delivered.kind !== "answered") {
    return relayFailure("gate deliver", delivered);
  }
  say(
    `  gate deliver   ${String(delivered.payload.deliveredMessageIds.length)} message(s) to ` +
      `'${delivered.payload.recipient}' (epoch ${String(delivered.payload.epoch)})`,
  );
  return null;
}

/** Print a conductor's report, whichever verb produced it. */
function sayReport(report: {
  readonly iterationId: string | null;
  readonly status: string | null;
  readonly lines: readonly string[];
}): void {
  if (report.iterationId !== null) {
    say(`iteration '${report.iterationId}' is ${report.status ?? "in an unnamed state"}`);
  }
  for (const line of report.lines) {
    say(`  ${line}`);
  }
  // continuo refused the lap because this process sits inside another sandbox
  // (continuo D-1112 rule 4); its sentence names its own verb, so the move is
  // said once more in rondo's words (D-0055 rule 10: the terminal takes `EN`).
  if (report.lines.some(isNestedSandboxRefusal)) {
    say(`  ${EN.lapNestedSandbox}`);
  }
}

/**
 * Read the plan file, apply the per-run overrides, and hand it to `readPlan`.
 *
 * **rondo gains no configuration layer here** (D-0019 rule 3 still holds). The
 * file is `planPayload`'s own JSON, `readPlan` is its only reader, and this
 * function neither defaults a field nor infers one: what it does is overwrite
 * at most four values a person changes per run, and rewrite `parties.grantee`
 * to the effective run id -- which is the only value `runPlan` permits it to
 * have, and the field the dogfood record shows costs a whole iteration when it
 * is wrong.
 *
 * Because the format is `planPayload`'s inverse, the `plan` column of any past
 * iteration row is a valid plan file. That is the whole of rondo's answer to
 * "where do thirty-two fields come from": from the last run, or from the
 * runbook's worked example.
 */
function loadPlan(parsed: ParsedCommand): { plan: RunPlan } | { refusal: string } {
  if (parsed.planFile === null) {
    return { refusal: "start needs --plan FILE, naming the JSON plan to run." };
  }
  const read = readPlanDocument(parsed.planFile);
  if ("refusal" in read) {
    return read;
  }

  const payload = { ...read.document };
  if (parsed.prompt !== null) {
    payload["prompt"] = parsed.prompt;
  }
  // **Read byte for byte, and not trimmed.** The request is a prompt written to
  // an agent: its paragraph breaks are the instruction's structure, and a
  // trailing newline a text editor wrote is not rondo's to remove either. This
  // is the same rule `--body` runs under (D-0025 rule 3) applied to the one
  // other field an operator supplies as prose. Before this flag existed, a
  // multi-paragraph request could not be typed as a shell argument at all, and
  // the operator wrote a throwaway script to inject it into the plan JSON --
  // which is the class of workaround the command line replaced.
  if (parsed.promptFile !== null) {
    try {
      payload["prompt"] = readFileSync(parsed.promptFile, "utf8");
    } catch (error) {
      return {
        refusal: `The prompt file could not be read: ${hostFailure(error).text}`,
      };
    }
  }

  // **`--run-id`, `--topic-branch` and `--workspace` are gone, and so is the
  // `parties.grantee` rewrite that went with them** (D-0023 rule 9). All four
  // values are rondo's now: the allocator derives the triple from the iteration
  // id and fills the grantee from the run id it minted. An operator who could
  // still override one of them would be a second authority for a name the
  // capacity ledger's claim indexes rest on, which is the one thing the
  // allocator exists to prevent.
  const outcome = readRunPlan(payload);
  if (outcome.kind !== "planned") {
    return { refusal: `The plan was refused: ${outcome.reason}` };
  }
  return { plan: outcome.plan };
}

/** A plan file's JSON object, or why it is not one. */
function readPlanDocument(file: string): { document: JsonRecord } | { refusal: string } {
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch (error) {
    return {
      refusal: `The plan file could not be read: ${hostFailure(error).text}`,
    };
  }
  let document: unknown;
  try {
    document = JSON.parse(raw);
  } catch (error) {
    return {
      refusal: `The plan file is not JSON: ${hostFailure(error).text}`,
    };
  }
  if (document === null || typeof document !== "object" || Array.isArray(document)) {
    return { refusal: "The plan file must hold a JSON object." };
  }
  return { document: document as JsonRecord };
}

/**
 * The identity check both answering and publishing pass through.
 *
 * **An allowlist of size one, read from the environment, checked before any
 * verb runs.** It keeps the half of D-0020 rule 2 that a command line can keep
 * -- rondo acts for a named person and refuses to act for an unnamed one -- and
 * it cannot keep the other half: there is no OIDC subject here, so the identity
 * is asserted by whoever is typing. That is a stated reduction scoped to lap 1,
 * and the thing that ends it is the adapter D-0020 already specifies.
 *
 * Exported so it can be tested. The end-to-end walk cannot reach its refusals:
 * by the time an operator gets an actor wrong, the interesting states are gone.
 */
export function approvedActor(
  // **The identity and not the whole parse.** The web surface has no
  // `ParsedCommand` and takes its actor from `RONDO_APPROVER` directly
  // (D-0041 rule 5); passing the one field this function ever read is what
  // lets both surfaces reach the same allowlist rather than two copies of it.
  actorId: string | null,
  environment: Readonly<Record<string, string | undefined>>,
): { actorId: string } | { refusal: string } {
  if (actorId === null) {
    return { refusal: "This command needs --actor-id ID, naming who is acting." };
  }
  const approver = environment[APPROVER_ENV];
  if (approver === undefined || approver === "") {
    return {
      refusal:
        `${APPROVER_ENV} is not set. It names the one identity allowed to answer a gate or ` +
        "publish, and rondo will not act for an unnamed person.",
    };
  }
  if (actorId !== approver) {
    return {
      refusal:
        `--actor-id is '${actorId}' and ${APPROVER_ENV} is '${approver}'. They must be ` +
        "the same identity.",
    };
  }
  // The shape continuo requires of an identifier, checked **here** rather than
  // left to the verb that first carries it. An identity with whitespace in it
  // passes the allowlist and is then refused at the argument boundary -- after
  // `publish` has already pushed and opened a pull request, or after `answer`
  // has already presented and delivered. Rondo refuses before a process starts
  // when it can, and this is one of the places it can.
  if (/\s/.test(actorId) || actorId.startsWith("-")) {
    return {
      refusal:
        `--actor-id is '${actorId}', and continuo's identifiers carry no whitespace and ` +
        "do not begin with a dash. It would be refused partway through, after the effects before " +
        "it had already happened.",
    };
  }
  return { actorId: actorId };
}

/** Open rondo's own store, or say why it cannot be opened. */
function openStore(
  environment: Readonly<Record<string, string | undefined>>,
): { store: IterationStore; path: string } | { refusal: string } {
  const path = environment[STORE_ENV];
  if (path === undefined || path === "") {
    return {
      refusal: `${STORE_ENV} is not set. It is the absolute path to rondo's iteration database, which is created on first use.`,
    };
  }
  // **Durable and absolute, checked before the file is opened.** `:memory:` is
  // SQLite's in-memory sentinel: `start` would run a real lap, spend real money
  // and then lose the row when the process exits, so the next `answer` would
  // report that nothing is waiting while a gate stood open. A relative path is
  // the quieter version of the same failure -- it names a different database
  // from each directory a command is run in, so the single-flight invariant
  // would hold per directory rather than per machine.
  if (path === ":memory:" || path.startsWith("file::memory:")) {
    return {
      refusal:
        `${STORE_ENV} is '${path}', which is SQLite's in-memory database. rondo's commands are ` +
        "separate processes and the row has to outlive each of them, so an in-memory store would " +
        "lose a lap that had already run.",
    };
  }
  if (!isAbsolute(path)) {
    return {
      refusal:
        `${STORE_ENV} is '${path}', and it must be an absolute path. A relative one names a ` +
        "different database from each directory a command is run in, and single-flight is an " +
        "invariant of one database.",
    };
  }
  const bounds = hostPolicyOf(environment);
  if ("refusal" in bounds) {
    return bounds;
  }
  try {
    // The path travels with the store because the advisory record is a second
    // port over the same file (see `openAdvisoryRecord`), and re-reading the
    // environment to find it would be a second place this value is validated.
    return { store: openIterationStore(path, bounds.policy), path };
  } catch (error) {
    return {
      refusal: `The iteration store at ${path} could not be opened: ${hostFailure(error).text}`,
    };
  }
}

/**
 * Which iteration a verb that used to mean "the live one" should act on.
 *
 * **The function D-0023 makes necessary.** While the bound was one, "the live
 * iteration" named a row, and `readLive()` could answer with it. Above one it
 * names nothing, and the honest answers are three rather than two: this is the
 * one, there is none, or there are several and the operator has to say which.
 * Picking the oldest would have kept every call site compiling and would have
 * silently answered somebody else's gate.
 *
 * An explicit `--iteration-id` always wins and is read by id, so a person may
 * name a terminal iteration that no longer appears in the live set at all --
 * which is what `publish` needs, since it acts on `closed` rows.
 */
async function pickWaiting(
  store: IterationStore,
  iterationId: string | null,
): Promise<
  { readonly record: IterationRecord | null; readonly note: string } | { readonly refusal: string }
> {
  if (iterationId !== null) {
    const found = await store.read(iterationId);
    if (found.kind === "absent") {
      return { refusal: `There is no iteration '${iterationId}'.` };
    }
    if (found.kind === "unreadable") {
      return { refusal: `That iteration row would not read: ${found.reason}` };
    }
    return { record: found.record, note: "" };
  }
  const live = await store.readLive();
  const unreadable = live.filter((outcome) => outcome.kind === "unreadable");
  const readable = live
    .filter((outcome) => outcome.kind === "read")
    .map((outcome) => outcome.record);
  if (readable.length === 0) {
    // An unreadable row is reported rather than counted as "nothing waiting":
    // a person told nothing is open, while a row sits there holding capacity,
    // has been told the one thing that stops them looking.
    if (unreadable.length > 0) {
      return {
        refusal:
          `No live iteration would read. ${String(unreadable.length)} row(s) are there and ` +
          "cannot be decoded; name one with --iteration-id ID to see why, or end it with abandon.",
      };
    }
    return { record: null, note: "Nothing is waiting. No iteration is live." };
  }
  // **Ambiguity is counted over every live row, readable or not.** A row that
  // will not decode is still an iteration a person may have meant, and one that
  // still holds capacity; dropping it from the count would let "the live one"
  // silently name the only row that happened to parse, and `answer --body`
  // would then carry a human's answer to the other iteration's gate.
  if (readable.length + unreadable.length > 1) {
    const named = [
      ...readable.map((record) => `${record.id} (${record.status})`),
      ...unreadable.map((outcome) => `${outcome.id} (unreadable)`),
    ].join(", ");
    return {
      refusal:
        `${String(readable.length + unreadable.length)} iterations are live, so "the live one" ` +
        `does not name anything. Say which with --iteration-id ID: ${named}`,
    };
  }
  if (readable.length > 1) {
    // **One line, and that is a constraint rather than a preference.** `say`
    // and `refuse` put every message through `asciiEscape` (D-0004), which
    // escapes control characters -- so a newline embedded here reaches the
    // operator as a literal `\u000a` and the list becomes unreadable. That is
    // exactly how it first shipped, and the real run is what caught it.
    const named = readable.map((record) => `${record.id} (${record.status})`).join(", ");
    return {
      refusal:
        `${String(readable.length)} iterations are live, so "the live one" does not name ` +
        `anything. Say which with --iteration-id ID: ${named}`,
    };
  }
  const only = readable[0];
  if (only === undefined) {
    return { record: null, note: "Nothing is waiting. No iteration is live." };
  }
  return { record: only, note: "" };
}

/**
 * The host's two bounds, from the environment, validated.
 *
 * Absent means the default rather than zero: a host nobody has configured
 * should behave the way lap 1 measured, which is one lap at a time with room
 * for a few unanswered questions beside it.
 *
 * **`maxOccupying` is settable, and setting it above one is currently a way to
 * make continuo refuse laps rather than a way to run them.** continuo
 * serialises `lap perform` on one global delivery resource until its `D-1104`
 * lands the holder-identity half; until then a second concurrent lap is refused
 * there. The knob exists here so that the day it lands is a policy edit and not
 * a code change, and this paragraph is what stops the number being raised on
 * the assumption that rondo is the thing in the way.
 */
function hostPolicyOf(
  environment: Readonly<Record<string, string | undefined>>,
): { readonly policy: HostPolicy } | { readonly refusal: string } {
  const read = (name: string, fallback: number): number | string => {
    const raw = environment[name];
    if (raw === undefined || raw.trim() === "") {
      return fallback;
    }
    const value = Number(raw);
    return Number.isInteger(value) ? value : `${name} is '${raw}', which is not a whole number.`;
  };
  const maxOccupying = read(MAX_OCCUPYING_ENV, CONSERVATIVE_HOST_POLICY.maxOccupying);
  if (typeof maxOccupying === "string") {
    return { refusal: maxOccupying };
  }
  const maxLive = read(MAX_LIVE_ENV, CONSERVATIVE_HOST_POLICY.maxLive);
  if (typeof maxLive === "string") {
    return { refusal: maxLive };
  }
  const outcome = hostPolicy({ maxOccupying, maxLive });
  return outcome.kind === "accepted"
    ? { policy: outcome.policy }
    : {
        refusal: `${MAX_OCCUPYING_ENV}/${MAX_LIVE_ENV} do not describe a host that can run: ${outcome.reason}`,
      };
}

/**
 * The entry point.
 *
 * Returns an exit status and **never calls `process.exit`**, so that the whole
 * of the surface is reachable from a test: a function that exits cannot be
 * asserted against, and the launcher in `bin/rondo.mjs` is what turns this
 * number into one.
 *
 * The statuses are the three continuo itself uses, for the reason it uses them:
 * 0 succeeded, 2 something declined, 1 something broke.
 */
export async function main(
  argv: readonly string[],
  environment: Readonly<Record<string, string | undefined>>,
): Promise<number> {
  const parsedOutcome = parseCommand(argv);
  if (parsedOutcome.kind === "refused") {
    consoleSeams.writeError(`${asciiEscape(parsedOutcome.reason)}\n`);
    consoleSeams.writeError(USAGE);
    return 2;
  }
  const parsed = parsedOutcome.parsed;
  if (parsed.command === "help") {
    consoleSeams.write(USAGE);
    return 0;
  }

  const opened = openStore(environment);
  if ("refusal" in opened) {
    return refuse(opened.refusal);
  }
  const store = opened.store;

  // **`abandon` is dispatched before continuo is started, and that ordering is
  // the whole of its usefulness.** It is the way out of a row that is holding
  // the single-flight lock with nothing able to release it, and one of the
  // states that produces such a row is a continuo that will not start or no
  // longer matches the pin. Requiring a working continuo to recover from a
  // broken one would make the escape hatch unreachable exactly when it is
  // needed. It drives no continuo verb -- that is D-0019 rule 11's design, not
  // an accident here -- so there is nothing for it to need.
  if (parsed.command === "abandon") {
    return await commandAbandon(parsed, conductorPorts(unverifiedContinuo(), store, null));
  }

  // **`release` is dispatched here for `abandon`'s reason**: it writes one row
  // of rondo's own and drives no continuo verb (D-0073 rule 4.3).
  if (parsed.command === "release") {
    return await commandRelease(parsed, store, environment);
  }

  // **`explain` is dispatched before continuo is started, for `abandon`'s
  // reason and one of its own.** It reads rondo's rows and drives no verb, so a
  // continuo that will not start is not a reason to withhold an account of the
  // row that is stuck behind it -- and the iteration this command most exists to
  // explain has already ended, which is exactly when nothing is worth spawning.
  if (parsed.command === "explain") {
    return await commandExplain(parsed, store, opened.path);
  }

  // **`between` is dispatched here for `explain`'s reason.** It reads rondo's
  // own rows across every live lap and drives no continuo verb, and the moment
  // an operator most wants to know what spans the laps is the moment one of
  // them is stuck behind something that will not start.
  if (parsed.command === "between") {
    const bounds = hostPolicyOf(environment);
    if ("refusal" in bounds) {
      return refuse(bounds.refusal);
    }
    return sayAdvisoryOutcome(
      await composeBetweenLaps({
        ...advisoryPorts(store, opened.path),
        policy: bounds.policy,
      }),
      "composition",
    );
  }

  // **`elevate` is dispatched here for `explain`'s reason exactly.** It reads
  // rondo's own rows and writes rondo's own rows; nothing about handing an
  // observation to the advisory needs a worker, and the observation most worth
  // elevating is often about a lap that has already ended.
  if (parsed.command === "elevate") {
    return await commandElevate(parsed, environment, store, opened.path);
  }
  // `request` and `reply` write rondo's own rows and drive no continuo.
  if (parsed.command === "request" || parsed.command === "reply") {
    return await commandThreadMessage(parsed, environment, opened.path);
  }

  // **`inbox` is dispatched here for `explain`'s reason, and most of all.** The
  // screen that says what is stuck has to be reachable when something is stuck,
  // and a continuo that will not start is one of the things it exists to show.
  if (parsed.command === "inbox") {
    return await commandInbox(parsed, environment, store, opened.path);
  }

  // **`web` is dispatched here for `inbox`'s reason, and it writes even less.**
  // The page is a second view of `inbox`, `between` and `explain`, all three of
  // which read rondo's own rows and drive no continuo verb -- so requiring a
  // working continuo to *look* at what is stuck would withhold the screen in
  // exactly the state it exists for.
  if (parsed.command === "web") {
    const bounds = hostPolicyOf(environment);
    if ("refusal" in bounds) {
      return refuse(bounds.refusal);
    }
    // **The language is read once, here, beside the other host facts, and a tag
    // that is not one refuses before a socket is opened** (D-0055 rule 5).
    const selected = operatorLanguage(environment);
    if ("refusal" in selected) {
      return refuse(selected.refusal);
    }
    // **The approver is read once, here, and decides whether there is a write
    // port at all** (D-0041 rules 4 and 5). Building the function and letting
    // the page decide not to draw a button would leave a door with nobody's
    // name on it reachable by a hand-written POST.
    const approver = environment[APPROVER_ENV];
    const record = openAdvisoryRecord(opened.path);
    // **The sender is the approver, through the same allowlist `request` and
    // `reply` use** (D-0061 rule 4, D-0059 section 5a): no approver, or one the
    // allowlist refuses, is no say port, and so no forms.
    const sender =
      approver === undefined || approver === "" ? null : approvedActor(approver, environment);
    // **What a publish would need that the lap's row does not carry**
    // (rondo#233 S5): the remote to push to, and the repository for a plan that
    // names none. `--repo` is the same flag `publish` takes, read once here.
    //
    // **It no longer decides whether this host may publish at all** (D-0081
    // rule 3.2). The repository is the plan's, so whether a lap can be
    // published is a fact about that lap and not about the host: a host told no
    // `--repo` publishes every lap whose plan carries a slug, and says per lap
    // where neither does. Gating the port on the flag would draw nothing over
    // laps that are perfectly publishable.
    const asked: PublishAsked = {
      repo: parsed.repo,
      remote: parsed.remote ?? DEFAULT_REMOTE,
      allowRemoteMismatch: parsed.allowRemoteMismatch,
    };
    // **The model drafter runs in this process** (D-0071 rule 3.2, with the
    // `rondo web` process as the resident host until D-0068's patrol exists):
    // a scan now, after every message this page writes, and on a timer so a
    // message the command line wrote while the page runs is found too.
    // **And the issue reader before it** (D-0078 section 2.4): an issue a
    // message names is read here, outside any lap, through the operator's own
    // `gh`, and the drafter waits for it (section 3.3).
    //
    // **A bare `#N` is read in the repository of the plan its request is
    // drafted from** (D-0081 rule 3.4), which `bareIssueRepository` reads off
    // the rows this store holds; `--repo` is what answers for a store whose
    // plans name none, as it is what such a store publishes by (rule 6.3).
    // Where more than one repository is still in play the read waits for the
    // person, so the drafter is handed `unreadUnderway` and not `unread`: its
    // ask is what that read is waiting for.
    const issues = issueReader({
      record,
      read: readIssueFromForge,
      // **A request naming a repository rondo does not hold waits** (rondo#383,
      // D-0090): its bare `#N` belongs to that repository, and reading it in
      // one of the held ones would record the wrong issue for good.
      bareRepository: async (requestMessageId, namedAtMs) =>
        (await requestRepository({ store, record, now: Date.now }, requestMessageId)).work.kind ===
        "unheld"
          ? { disputed: true }
          : await bareIssueRepository(
              {
                record,
                held: async (id) => await heldPlans({ store, record, now: Date.now }, id),
                hostRepo: parsed.repo,
              },
              requestMessageId,
              namedAtMs,
            ),
      now: Date.now,
      mintId: () => newDraftId("forge"),
      log: say,
      // Called only after a scan, by which time `drafter` below exists.
      onRead: () => drafter.kick(),
    });
    const drafter = drafterHost({
      store,
      record,
      runDrafter,
      now: Date.now,
      mintId: newDraftId,
      language: selected.tag,
      log: say,
      issuesUnread: issues.unreadUnderway,
      // **Nothing is drafted in a repository the work is not in** (rondo#383,
      // D-0090 rule 1): a request naming one rondo holds no plan for waits for
      // the person to add it from the page.
      awaitsRepository: async (id) =>
        (await requestRepository({ store, record, now: Date.now }, id)).work.kind === "unheld",
    });

    // **And the revise drafter beside it** (D-0077 rule 2.2): a model reading
    // lands from whichever process ran the lap, so the same rescan finds it.
    const reviser = reviseDrafterHost({
      store,
      record,
      runDrafter,
      now: Date.now,
      mintId: newDraftId,
      language: selected.tag,
      log: say,
    });
    // **And what the forge says about a pull request this host published**
    // (rondo#310), on the same rescan: the window it reads is the publish
    // report in a thread until the ledger releases the line, so it asks
    // nothing about a lap that was never published and nothing twice about one
    // that has an answer. It writes one line into the request's thread and
    // wakes nobody: whether a person who is not on the page is told is
    // rondo#311's, and lives in rondo#311's mechanism.
    // The laps a merge press is working on, which the checks host leaves
    // alone until the press has written what it did (rondo#413).
    const pressing = new Set<string>();
    const checks = checksHost({
      store,
      record,
      readChecks: continuoChecksReader(environment),
      readCommits: readCommitsBetween,
      pressing,
      host: forgeHost(environment),
      now: Date.now,
      log: say,
    });
    // **What rondo would ask for next** (D-0097), read on the same rescan and
    // after a goal or a *not now* is kept. The repositories are the ones rondo
    // works in (`D-0081`): `--repo`, and every repository a setup plan names.
    const triageRepositories = async (): Promise<readonly string[]> => [
      ...new Set([
        ...(parsed.repo === null ? [] : [parsed.repo]),
        ...(await record.setupPlans()).flatMap((setup) => {
          const planned = readRunPlan(setup.plan);
          return planned.kind === "planned" && planned.plan.forgeRepository !== null
            ? [planned.plan.forgeRepository]
            : [];
        }),
      ]),
    ];
    const triage = triageHost({
      store,
      record,
      repositories: triageRepositories,
      listIssues: listOpenIssues,
      runDrafter,
      forgeHost: forgeHost(environment),
      now: Date.now,
      mintId: () => newDraftId("triage"),
      language: selected.tag,
      log: say,
    });
    // **And the order tick** (D-0098 rule 1.4): a drafted plan that waits on
    // an earlier plan of its split starts on that plan's landing, through the
    // press's own path and in the approver's name -- so only where there is an
    // approver the allowlist accepts, the start press's own condition.
    const order =
      sender === null || "refusal" in sender
        ? null
        : orderHost({
            record,
            readiness: async (split, planIndex) =>
              await draftedStartReadiness(
                { store, record, policy: bounds.policy, nowMs: Date.now() },
                split.requestMessageId,
                split.scopeDecisionId,
                split.proposalId,
                planIndex,
              ),
            readHolder: async (lineageId) =>
              await readHolder(
                { store, readLanding, readChangedPaths, remote: READING_REMOTE },
                lineageId,
                Date.now(),
              ),
            start: async (split, planIndex) =>
              await startSplitFromPage(
                environment,
                store,
                opened.path,
                sender.actorId,
                bounds.policy,
                {
                  iterationId: newIterationId(),
                  requestMessageId: split.requestMessageId,
                  scopeDecisionId: split.scopeDecisionId,
                  proposalId: split.proposalId,
                  planIndex,
                },
              ),
            now: Date.now,
            log: say,
          });
    /**
     * **Reaching a person who is not looking at the page** (rondo#311), on the
     * same minute the rescan already runs on.
     *
     * The tick is the one D-0068 rule 2.2 describes and this process already
     * has; what is added is a reader of the waiting set, not a second timer
     * and not a second process. `chromeFor` because what it writes is read by
     * the person: the terminal's own lines stay English through D-0004's
     * escape, and this one is not a terminal line.
     */
    const reaching = {
      store,
      record,
      now: Date.now,
      words: chromeFor(selected.tag),
      notify: notifierAt(environment[NOTIFIER_ENV] ?? null),
      say,
    };
    // ponytail: a fixed one-minute rescan for messages and readings written
    // outside this process; a changedSince watch when that minute is felt.
    let rescan: ReturnType<typeof setInterval> | null = null;
    // **Only once the page is listening**: a second `rondo web` that cannot
    // bind its port reports failure, and must not have spent a draft first.
    const listening = (line: string): void => {
      say(line);
      if (rescan === null) {
        issues.kick();
        drafter.kick();
        reviser.kick();
        checks.kick();
        triage.kick();
        order?.kick();
        // **Reaching starts a minute in, and not in the burst above.** The
        // person who has just started rondo is looking at it this second, and
        // what was already waiting when the host was last stopped is on the
        // screen in front of them. One minute is not a policy about staleness;
        // it is the tick this process already has.
        rescan = setInterval(() => {
          issues.kick();
          drafter.kick();
          reviser.kick();
          checks.kick();
          triage.kick();
          order?.kick();
          // **Order on the tick buys nothing, and nothing here depends on
          // it**: every kick above returns before its own pass finishes, so
          // this reads what is committed when it runs and not what the same
          // minute is still writing. A wait that lands a moment later is sent
          // on the next minute rather than lost, because what has been sent is
          // a row and not a thing this pass remembers. Not awaited -- nothing
          // here waits on a notification -- and its own failures are said on
          // this console rather than thrown.
          void reachThePerson(reaching).catch((error: unknown) => {
            say(
              "rondo could not look for anything to tell you about: " +
                (error instanceof Error ? error.message : String(error)),
            );
          });
        }, 60_000);
        rescan.unref();
      }
    };
    const served = await serveOperatorPage(
      {
        store,
        record,
        policy: bounds.policy,
        // **The host's statement, as a tag, and one step of five** (D-0056
        // rules 2 and 3). The page resolves it against the request's `?lang=`,
        // the remembered cookie and `Accept-Language`; what it resolves to is
        // handed back to `pageMaterial` below, so the fence block's two
        // standing sentences follow the *page* and not the host. The terminal's
        // language is still not this: `sayLapMaterial` is handed `EN`, because
        // the console's strings go through D-0004's escape and it has no CJK
        // substitutes (D-0055 rule 10).
        hostLanguage: selected.tag,
        // What the page says under a message whose issue is still to be read
        // (D-0078 section 4.3), off the reader that reads it.
        issuesUnread: issues.unread,
        // Which repository a request's work runs in, and the press that adds
        // one it names and rondo does not hold (rondo#383, D-0090) -- on the
        // release press's condition, since the plan it records is the
        // approver's as setup's is. Added, the reader and the drafter look again.
        repositoryFor: async (id) => await requestRepository({ store, record, now: Date.now }, id),
        addable: sender !== null && !("refusal" in sender),
        addRepository:
          sender === null || "refusal" in sender
            ? null
            : new AddRepositoryPort(async (input) => {
                const added = await addRepositoryFromPage(
                  environment,
                  { store, record },
                  sender.actorId,
                  input,
                );
                if (added.ok) {
                  issues.kick();
                  drafter.kick();
                }
                return added;
              }),
        answer:
          approver === undefined || approver === ""
            ? null
            : // **The press is checked inside this port** (D-0059 R4): whatever
              // holds it writes nothing without a press minted from a person's
              // navigation, so the page's server is not the only thing standing
              // between a `GET` and this walk.
              new AnswerPort(
                async (iterationId, body, claim) =>
                  await answerFromPage(
                    environment,
                    store,
                    opened.path,
                    approver,
                    iterationId,
                    body,
                    claim,
                  ),
              ),
        // What an open tab's notice did (rondo#414), on `say`'s condition: the
        // page carries the token only where it has a writer.
        notice:
          sender === null || "refusal" in sender
            ? null
            : async (waits, outcome) => {
                await recordTabNotice(record, Date.now(), waits, outcome);
              },
        say:
          sender === null || "refusal" in sender
            ? null
            : // **The send is checked inside this port**, as the press is in
              // `AnswerPort`: whatever holds it records nothing without a send
              // minted from a same-origin `POST` carrying the token.
              new SayPort(
                async (message, answerOutcome) => {
                  const outcome = await record.recordThreadMessage({
                    messageId: message.messageId,
                    body: message.body,
                    authorKind: "operator",
                    authorId: sender.actorId,
                    inReplyTo: message.inReplyTo,
                    atMs: Date.now(),
                    bases: [],
                    asks: false,
                    // Absent and not null, for `exactOptionalPropertyTypes`:
                    // a send answers nothing (D-0072 rule 2).
                    ...(answerOutcome === null ? {} : { answerOutcome }),
                  });
                  if (outcome.kind === "recorded") {
                    issues.kick();
                    drafter.kick();
                  }
                  return outcome.kind === "recorded"
                    ? { ok: true, note: "" }
                    : {
                        ok: false,
                        note:
                          outcome.kind === "refused"
                            ? outcome.reason
                            : `the message was not recorded: ${outcome.reason}`,
                      };
                },
                async () => await record.threadMessages(),
              ),
        // **Both presses are checked inside this port**, as the press is in
        // `AnswerPort` and the send in `SayPort`. Null on `say`'s own
        // condition: a scope row and a decision row both need an actor the
        // allowlist accepts.
        scope:
          sender === null || "refusal" in sender
            ? null
            : new ScopePort(
                async (draft) =>
                  await recordScopeFromPage(environment, store, opened.path, sender.actorId, draft),
                // **Answered once the lap is there, not at its gate** (D-0109).
                async (input) =>
                  await answerOnceReserved(
                    store,
                    record,
                    chromeFor(selected.tag),
                    input,
                    startScopedFromPage(environment, store, opened.path, sender.actorId, input),
                  ),
                // The drafted scope's two presses (rondo#238 C2b, D-0071 rule 5.3).
                async (form) =>
                  await recordDraftedScopeFromPage(environment, opened.path, sender.actorId, form),
                async (input) =>
                  await answerOnceReserved(
                    store,
                    record,
                    chromeFor(selected.tag),
                    input,
                    startSplitFromPage(
                      environment,
                      store,
                      opened.path,
                      sender.actorId,
                      bounds.policy,
                      input,
                    ),
                  ),
                // The raise press (D-0074 section 4).
                async (input) =>
                  await raiseScopeFromPage(environment, store, opened.path, sender.actorId, input),
              ),
        // **The press is checked inside this port too** (rondo#233 S4): a gate
        // answered with a change and the lap it starts are one act, and nothing
        // reaches it without a press. Null on `scope`'s condition, and for its
        // reason: answering a gate and admitting a lap both need an actor the
        // allowlist accepts. **No plan file is read**: the second lap's plan is
        // composed from the predecessor's own (`revisionPlan`).
        revise:
          sender === null || "refusal" in sender
            ? null
            : new RevisePort(
                async (input) =>
                  await reviseFromPage(environment, store, opened.path, sender.actorId, input),
                async (input) =>
                  await conflictFixFromPage(environment, store, opened.path, sender.actorId, input),
              ),
        // **The press is checked inside this port too** (rondo#233 S5), and it
        // is now null on exactly `revise`'s own condition: an approver the
        // allowlist accepts. The forge repository used to be a second condition
        // -- it was the one fact no plan carried -- and under `D-0081` rule 3.2
        // it is the plan's, so it is a fact about the lap the screen is about
        // and not about the host. A lap that names no repository anywhere is
        // refused on its own screen, by the dry-run below, which is where every
        // other per-lap refusal is already said.
        publish:
          sender === null || "refusal" in sender
            ? null
            : new PublishPort(
                async (input) =>
                  await publishFromPage(
                    environment,
                    store,
                    opened.path,
                    sender.actorId,
                    asked,
                    input,
                  ),
              ),
        // **The dry-run this screen is read from, on exactly the press's own
        // condition.** The same function the press runs, so what is shown is
        // what would happen -- and null wherever the port is null, because a
        // screen that drew the dry-run without the port behind it would draw a
        // button that is refused on every press, with a sentence about an
        // approver that is set. That is the shape the other presses get for
        // free from their minted ids (`newScopeId`, `newIterationId`), which
        // are null exactly when their ports are; publish mints nothing, so the
        // condition is written out here instead.
        // **The press is checked inside this port too** (D-0073 rule 4.3,
        // rondo#288), null on `revise`'s condition: a release is recorded as
        // the person's judgement, so it needs an actor the allowlist accepts.
        releasable: sender !== null && !("refusal" in sender),
        // **The merge press** (rondo#380, `D-0091`): a person's press per act,
        // on `release`'s condition -- an approver the allowlist accepts -- and
        // through the operator's own forge CLI, as publish is (`D-0010`).
        // **The goal and *not now* presses** (D-0097 points 2.1 (a) and 4.5
        // (a)), on `merge`'s condition: both are the person's say over what
        // rondo ranks, written as rows in rondo's store and nowhere else.
        triageRepositories,
        triageWritable: sender !== null && !("refusal" in sender),
        triage:
          sender === null || "refusal" in sender
            ? null
            : new TriagePort(
                async (input) => {
                  // A hand-written post must not keep a goal for a repository
                  // rondo does not work in: the host would never read it.
                  if (!(await triageRepositories()).includes(input.repository)) {
                    return {
                      ok: false,
                      note: `rondo does not work in '${input.repository}'`,
                    };
                  }
                  const kept = await record.recordGoal({
                    goalId: newDraftId("goal"),
                    repository: input.repository,
                    clauses: input.clauses,
                    writtenBy: sender.actorId,
                    writtenAtMs: Date.now(),
                  });
                  if (kept.kind === "recorded") {
                    triage.kick();
                  }
                  return kept.kind === "recorded" ? { ok: true } : { ok: false, note: kept.reason };
                },
                async (input) => {
                  const put = await record.recordTriageDecline({
                    declineId: newDraftId("not-now"),
                    proposalId: input.proposalId,
                    candidate: input.candidate,
                    declinedBy: sender.actorId,
                    declinedAtMs: Date.now(),
                  });
                  if (put.kind === "recorded") {
                    triage.kick();
                  }
                  return put.kind === "recorded" ? { ok: true } : { ok: false, note: put.reason };
                },
              ),
        mergeable: sender !== null && !("refusal" in sender),
        fixesConflicts: sender !== null && !("refusal" in sender),
        merge:
          sender === null || "refusal" in sender
            ? null
            : new MergePort(
                mergePress({
                  store,
                  record,
                  now: Date.now,
                  pressing,
                  readAgain: async () => {
                    checks.kick();
                    await checks.idle();
                  },
                }),
              ),
        release:
          sender === null || "refusal" in sender
            ? null
            : new ReleasePort(
                async (input) => await releaseFromPage(environment, store, sender.actorId, input),
              ),
        publishing:
          sender === null || "refusal" in sender
            ? null
            : async (row) =>
                await publishingForPage(
                  environment,
                  store,
                  asked,
                  row,
                  openAdvisoryRecord(opened.path),
                ),
        // Read for the same reason and on the same condition: the material is
        // what a person is shown before they press, so it is drawn exactly
        // where the button is (D-0029 rule 2 and D-0041 rule 6).
        material:
          approver === undefined || approver === ""
            ? null
            : async (wording, record) => await pageMaterial(wording, environment, store, record),
        // **The approver and not an `--actor-id`.** An inbox is one person's,
        // and the identity rondo already trusts to answer a gate is the one
        // whose inbox this host draws. Unset is not a refusal: the other two
        // sections are about the host rather than about a person, so the page
        // still has most of itself to show.
        actorId: environment[APPROVER_ENV] ?? null,
        now: Date.now,
        // The page draws `inbox`'s own lines, so it asks the same question of
        // continuo -- and it is the surface that redraws itself, which is the
        // one D-0048 rule 4's "read at render time" has to keep honest.
        locateTranscript: transcriptPort(environment),
        readLog: readLapLog,
      },
      parsed.port ?? DEFAULT_WEB_PORT,
      listening,
      (line) => refuse(line),
    );
    if (rescan !== null) {
      clearInterval(rescan);
    }
    return served;
  }

  // **`propose` and `decide` are dispatched here for `explain`'s reason.** Both
  // read and write rondo's own rows and drive no continuo verb: the iteration a
  // retry is proposed for has already ended, and an answer to a proposal is a
  // row in rondo's ledger. Requiring a working continuo to record either would
  // make them unreachable exactly where they are for.
  if (parsed.command === "propose") {
    return await commandPropose(parsed, store, opened.path);
  }
  if (parsed.command === "decide") {
    return await commandDecide(parsed, environment, opened.path);
  }
  // The scope verbs write rondo's own rows and drive no continuo (D-0066).
  if (parsed.command === "scope") {
    return await commandScope(parsed, environment, opened.path);
  }
  if (parsed.command === "decide-scope") {
    return await commandDecideScope(parsed, environment, opened.path);
  }
  if (parsed.command === "setup-plan") {
    return await commandSetupPlan(parsed, environment, opened.path);
  }

  // **`show` is dispatched here for `explain`'s reason.** It reads one of
  // rondo's own rows and drives no continuo verb, and the proposal most worth
  // reading back is often about a lap that has already ended.
  if (parsed.command === "show") {
    return await commandShow(parsed, store, opened.path);
  }

  const startup = await startContinuo(environment);
  if (startup.kind === "refused") {
    return refuse(`continuo is not usable: ${startup.reason}`);
  }
  const continuo = startup.continuo;
  const ports = conductorPorts(continuo, store, openAdvisoryRecord(opened.path));

  switch (parsed.command) {
    case "start":
      return await commandStart(
        parsed,
        store,
        opened.path,
        ports,
        unpromptedPorts(store, opened.path),
        continuo,
      );
    case "answer":
      return await commandAnswer(parsed, environment, store, ports, continuo);
    case "retry":
      if (parsed.proposalId === null) {
        return await commandScopedRetry(
          parsed,
          store,
          opened.path,
          ports,
          unpromptedPorts(store, opened.path),
          continuo,
        );
      }
      return await commandRetry(
        parsed,
        store,
        opened.path,
        ports,
        unpromptedPorts(store, opened.path),
        continuo,
      );
    case "revise":
      return await commandRevise(
        parsed,
        environment,
        store,
        opened.path,
        ports,
        unpromptedPorts(store, opened.path),
        continuo,
      );
    default:
      return await commandPublish(parsed, environment, store, opened.path, continuo, ports);
  }
}

/** Door one: take one request and run a lap. */
export async function commandStart(
  parsed: ParsedCommand,
  store: IterationStore,
  storePath: string,
  ports: ReturnType<typeof conductorPorts>,
  advisory: UnpromptedPorts,
  continuo: VerifiedContinuo,
): Promise<number> {
  const loaded = loadPlan(parsed);
  if ("refusal" in loaded) {
    return refuse(loaded.refusal);
  }
  const plan = loaded.plan;

  say(`plan ok: ${String(Object.keys(plan).length)} fields`);
  say(`continuo verified at revision ${continuo.revision}`);
  // **The iteration id is the one identifier an operator still supplies, and it
  // no longer has a default** (D-0023). It used to fall back to the plan's run
  // id -- a copy of a name the operator had already chosen -- but the run id is
  // derived *from* the iteration id now, so the old default is circular. It is
  // also the value three command lines are built out of, which is why it is
  // checked against a closed alphabet before any row is written.
  if (parsed.iterationId === null) {
    return refuse(
      "start needs --iteration-id ID. rondo derives the run id, the topic branch and the " +
        "workspace from it, so it is the one name a person chooses and the only one that is " +
        "not the host's to mint. It must be a lowercase letter followed by up to 63 more of " +
        "[a-z0-9_-].",
    );
  }
  const iterationId = parsed.iterationId;
  say(`starting iteration '${iterationId}'; the lap is the step that is slow`);

  // **The issues the request named, after the prompt given here** (D-0078
  // section 3.4), on both roads below: a start that names its request is
  // given what rondo read of it, scoped or not.
  const record = openAdvisoryRecord(storePath);
  // `parseCommand` has refused a `start` with no `--message-id`, so the
  // narrowing here is the compiler reading that refusal rather than a second
  // check.
  const messageId = parsed.messageId ?? "";
  const quoted = await withNamedIssues(record, messageId, plan);
  if ("refusal" in quoted) {
    return refuse(quoted.refusal);
  }

  // D-0069 section 2: a first admission that spends a scope, through the one
  // call site that computes a verdict. It names no proposal, so every open ask
  // in its request's thread holds it back (rule 5). `parseCommand` has already
  // refused it without `--message-id`.
  if (parsed.scopeDecisionId !== null) {
    const outcome = await admitUnderScope(
      {
        store,
        record,
        nowMs: Date.now,
        admit: (scoped, id, supersedes, requestMessageId, scopeSpend) =>
          admit(
            ports,
            advisory,
            scoped,
            START_POLICY,
            id,
            supersedes,
            null,
            requestMessageId,
            scopeSpend,
          ),
      },
      parsed.scopeDecisionId,
      {
        kind: "lineage_start",
        iterationId,
        plan: quoted,
        proposalId: null,
        requestMessageId: messageId,
      },
    );
    return await finishScopedAdmission(
      outcome,
      "first admission",
      continuo,
      store,
      iterationId,
      ports.thread ?? null,
    );
  }

  const report = await admit(
    ports,
    advisory,
    quoted,
    START_POLICY,
    iterationId,
    null,
    null,
    messageId,
  );
  sayReport(report);
  if (report.status === "awaiting_human") {
    await sayGateOpen(() =>
      takeModelReading(
        modelReviewPorts(continuo, store, ports.thread ?? null),
        report.iterationId ?? iterationId,
      ),
    );
    return 0;
  }
  if (report.iterationId === null) {
    return 2;
  }
  return report.status === "closed" ? 0 : 1;
}

/**
 * Door six: say what the store holds about one iteration, and record that it
 * said it.
 *
 * **The advisory is reached here and nowhere else** (D-0022 rules 1 and 2): this
 * function gathers, `src/advisory/` returns a value, and
 * `src/access/advisory.ts` writes the row and composes the lines. Nothing on
 * this path composes a contract or opens a gate, because `explanation` is the
 * kind that binds nothing (D-0032 rule 5).
 */
async function commandExplain(
  parsed: ParsedCommand,
  store: IterationStore,
  storePath: string,
): Promise<number> {
  if (parsed.iterationId === null) {
    return refuse(
      "explain needs --iteration-id ID. The row worth explaining is often one that has already " +
        "ended, and 'the live iteration' does not name it -- so there is no default, because a " +
        "default would explain a different row just as confidently.",
    );
  }
  return sayAdvisoryOutcome(
    await explainIteration(advisoryPorts(store, storePath), parsed.iterationId),
    "explanation",
  );
}

/**
 * The four things both advisory doors are handed, assembled once.
 *
 * `present` is overridable for the one caller whose surface is not this
 * process's stdout: the page has already rendered the claims, and a second copy
 * printed into the terminal `rondo web` runs in would be noise.
 */
function advisoryPorts(
  store: IterationStore,
  storePath: string,
  present?: (lines: readonly string[]) => void,
): ExplainPorts {
  return {
    store,
    record: openAdvisoryRecord(storePath),
    now: Date.now,
    present:
      present ??
      ((lines) => {
        for (const line of lines) {
          say(line);
        }
      }),
  };
}

/**
 * The ports the trigger a stopped lap pulls is handed (D-0043 rule 3).
 *
 * **Nothing here may stop a lap that would otherwise have run** (rule 11), and
 * there are two ways it could. The pin is a file, and a `cadenza.pin.json` that
 * will not read leaves nothing able to say which cadenza composed a contract;
 * the advisory's record is a **second connection to the store**, opened here
 * rather than shared, and opening it runs a schema. Neither is anything the lap
 * itself needs, so both absences travel as a value with their own sentence in
 * it instead of as a refusal or a throw -- the catch in the conductor cannot
 * help with either, because both happen before the admission it wraps.
 *
 * `present` is a no-op and is never called: this door shows nobody anything,
 * which is rule 9. It is passed because {@link ExplainPorts} is one bundle for
 * every door, and a second bundle differing by one field would be two things to
 * keep in step.
 */
export function unpromptedPorts(store: IterationStore, storePath: string): UnpromptedPorts {
  const pin = cadenzaRevision();
  if ("refusal" in pin) {
    return { unavailable: pin.refusal };
  }
  try {
    return { ...advisoryPorts(store, storePath, () => {}), cadenzaRevision: pin.revision };
  } catch (error) {
    return {
      unavailable: `the advisory's own connection to the store could not be opened: ${hostFailure(error).text}`,
    };
  }
}

/**
 * What every advisory door does with the answer it gets back.
 *
 * One function for `explain`, `elevate` and `propose` because the one thing
 * worth getting right is the same for all three: a subject that reached the
 * screen and was not counted exits **1**, with the record kept and the lines
 * still standing. Two copies of that rule are two places it can drift, and the
 * quiet outcome of a drift is an under-counted ledger (D-0032 rule 10).
 *
 * `noun` is what the door calls what it showed, and `next` is the command that
 * follows where there is one.
 */
function sayAdvisoryOutcome(
  outcome: ExplainOutcome | ProposeOutcome,
  noun: string,
  next?: string,
): number {
  if (outcome.kind === "refused") {
    return refuse(outcome.reason);
  }
  say(`recorded as proposal '${outcome.proposalId}'`);
  if (next !== undefined) {
    say(next);
  }
  if (outcome.kind === "presentedUncounted") {
    // **Status 1 rather than 0, and what was shown still stands on the
    // screen.** The operator has read it and the proposal is in the ledger; what
    // failed is the count of what was put to them, which is the one number
    // D-0032 rule 10 says nothing else can supply. Reporting success here would
    // make an under-counted ledger the quiet outcome.
    consoleSeams.writeError(
      asciiEscape(
        `This ${noun} was shown and was not counted as presented: ${outcome.reason}. ` +
          "The breakdown of what was put to you and what was not will be short by one.\n",
      ),
    );
    return 1;
  }
  return 0;
}

/**
 * One `--basis LOCATOR` as the closed union the advisory already has, or null.
 *
 * **A compact spelling of {@link Basis} and not a form of its own.** #41 section 3
 * requires that what is elevated carries its basis with it, and D-0032 rule 2
 * already fixes what a basis is: a locator, in one of its forms, never a copy
 * of the material. So the only thing missing was a way to type one on a command
 * line, which is this function and nothing more -- there is deliberately no
 * form meaning "the operator said so", because that is the claim with no basis
 * #39 measured an operator approving on.
 *
 * Total; never throws. An unrecognised prefix, a malformed tail and a pointer
 * that is not a pointer all read as null, and the caller says what the five
 * forms are.
 */
export function parseBasis(text: string): Basis | null {
  const at = text.indexOf(":");
  const form = at === -1 ? "" : text.slice(0, at);
  const rest = text.slice(at + 1);
  if (rest === "") {
    return null;
  }
  switch (form) {
    case "snapshot":
      // RFC 6901: the empty pointer is the whole document, and every other one
      // begins with a slash. A pointer that does not resolve is not refused
      // here -- the renderer says "does not resolve", which is the answer that
      // shows an operator what they actually cited.
      return rest.startsWith("/") ? { form: "snapshot", pointer: rest } : null;
    case "iteration":
      return { form: "iteration", iterationId: rest };
    case "run":
      return { form: "continuoRun", runId: rest };
    case "message":
      return { form: "message", messageId: rest };
    case "scope":
      return { form: "scope", scopeId: rest };
    case "proposal":
      return { form: "proposal", proposalId: rest };
    case "setup":
      return { form: "setup", setupId: rest };
    case "gate": {
      const hash = rest.lastIndexOf("#");
      const tail = rest.slice(hash + 1);
      // The tail is matched rather than coerced: `Number("")` is 0 and
      // `Number(" ")` is 0, so a gate cited with no sequence at all would
      // record as a citation of transition zero -- a reference to different
      // material, arrived at silently, which is worse than a refusal.
      const seq = /^\d+$/.test(tail) ? Number(tail) : Number.NaN;
      return hash <= 0 || !Number.isSafeInteger(seq)
        ? null
        : { form: "gateTransition", gateId: rest.slice(0, hash), transitionSeq: seq };
    }
    case "repo": {
      const match = /^(.+)@([^@#]+)#(\d+)-(\d+)$/.exec(rest);
      if (match === null) {
        return null;
      }
      const [, path, commit, first, last] = match as unknown as readonly string[];
      const firstLine = Number(first);
      const lastLine = Number(last);
      return firstLine < 1 || lastLine < firstLine
        ? null
        : {
            form: "repository",
            path: String(path),
            commit: String(commit),
            firstLine,
            lastLine,
          };
    }
    default:
      return null;
  }
}

/** The one sentence that lists what a `--basis` may be, written once. */
const BASIS_FORMS_LINE =
  "snapshot:/pointer, iteration:ID, gate:ID#SEQ, run:ID, repo:PATH@COMMIT#FIRST-LAST, message:ID, " +
  "scope:ID, proposal:ID or setup:ID";

/**
 * Door nine: hand one observation to the advisory, and record that a person
 * did it.
 *
 * **This is where authority enters** (#41 section 3): an observation constrains
 * nothing until a human takes it up, so the act is recorded as two columns on
 * the proposal -- which message it came from and who elevated it -- and the
 * identity is checked against `RONDO_APPROVER` before anything is written, the
 * same allowlist `answer` and `publish` pass through.
 *
 * **It composes no contract and the proposal it produces cannot be approved.**
 * The kind is `explanation`, so #41 section 3's chain reaches
 * `observation -> proposal` here and stops: what turns a proposal into a
 * contract is an approvable kind's option set, which is not this cut. The
 * elevation columns are written the same way whichever kind arrives later.
 */
async function commandElevate(
  parsed: ParsedCommand,
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
): Promise<number> {
  if (parsed.iterationId === null || parsed.messageId === null) {
    return refuse(
      "elevate needs --iteration-id ID, naming the row the observation is about, and " +
        "--message-id ID, naming the observation itself in the conversation. Neither has a " +
        "default: an elevation is an act by a person, and rondo does not supply half of one.",
    );
  }
  if (parsed.observation === null || parsed.observation === "") {
    return refuse(
      "elevate needs --observation=TEXT, which is what you are handing over. Write it with an " +
        "equals sign: an observation may begin with a dash.",
    );
  }
  if (parsed.basis === null) {
    return refuse(
      `elevate needs --basis LOCATOR, naming where the observation rests: ${BASIS_FORMS_LINE}. ` +
        "It has no default and there is no form meaning 'because I say so': an observation that " +
        "carries no basis acquires the look of a proposal without acquiring the grounds for " +
        "one, which is the hazard elevating in one gesture creates.",
    );
  }
  const basis = parseBasis(parsed.basis);
  if (basis === null) {
    return refuse(
      `--basis is '${parsed.basis}', which is none of the forms a basis may take: ` +
        `${BASIS_FORMS_LINE}.`,
    );
  }
  const actor = approvedActor(parsed.actorId, environment);
  if ("refusal" in actor) {
    return refuse(actor.refusal);
  }
  return sayAdvisoryOutcome(
    await elevateObservation(advisoryPorts(store, storePath), parsed.iterationId, {
      messageId: parsed.messageId,
      actorId: actor.actorId,
      observation: { label: "observation", value: parsed.observation, basis },
    }),
    "elevation",
  );
}

/**
 * `request` and `reply`: an operator's message into a request thread
 * (D-0061 step 5.1).
 *
 * The actor passes the approver allowlist before anything is written, and the
 * store's writer holds the rest of rule 2's refusals. `asks` is always unset:
 * a question put *to* the person is a drafter's, and no verb writes one.
 */
async function commandThreadMessage(
  parsed: ParsedCommand,
  environment: Readonly<Record<string, string | undefined>>,
  storePath: string,
): Promise<number> {
  const replying = parsed.command === "reply";
  if (
    parsed.messageId === null ||
    parsed.body === null ||
    (replying && parsed.inReplyTo === null)
  ) {
    return refuse(
      `${parsed.command} needs --message-id ID${replying ? ", --in-reply-to ID" : ""} and ` +
        "--body=TEXT. None has a default: a message is a person's words under a name they chose.",
    );
  }
  const actor = approvedActor(parsed.actorId, environment);
  if ("refusal" in actor) {
    return refuse(actor.refusal);
  }
  const outcome = await openAdvisoryRecord(storePath).recordThreadMessage({
    messageId: parsed.messageId,
    body: parsed.body,
    authorKind: "operator",
    authorId: actor.actorId,
    inReplyTo: replying ? parsed.inReplyTo : null,
    atMs: Date.now(),
    bases: [],
    asks: false,
  });
  if (outcome.kind === "refused") {
    return refuse(outcome.reason);
  }
  if (outcome.kind === "defect") {
    consoleSeams.writeError(asciiEscape(`The message was not recorded: ${outcome.reason}\n`));
    return 1;
  }
  say(
    replying
      ? `recorded message '${parsed.messageId}' in reply to '${String(parsed.inReplyTo)}'`
      : `opened request '${parsed.messageId}'`,
  );
  return 0;
}

/**
 * Door ten: what is waiting on you, and the record that you looked.
 *
 * **`--actor-id` is checked against the approver allowlist, and that is a
 * reuse rather than a claim.** Looking is not answering and not publishing, so
 * the allowlist is stricter than this verb strictly needs: the reason it is
 * used anyway is that rondo has exactly one identity path today
 * ({@link approvedActor}), and a second one -- "anybody may look" -- would be
 * a second answer to who rondo acts for, introduced by a read-only screen. If
 * a reader who cannot approve ever has to see the inbox, this is the line that
 * moves, and the mark it writes is already per actor
 * (`operator_view.actor_id`), so nothing below it has to.
 */
/**
 * Door eleven: read one proposal back, so a gate is answerable later.
 *
 * **The whole of #39 is that this exists.** `propose` renders an option set
 * once, to the terminal that drafted it; everything a person needs in order to
 * answer -- the alternatives, the recommendation, what each rests on, what
 * answering forecloses -- is in the row, and until this verb nothing read it
 * back. The falsifier #39 names is whether an operator can answer correctly
 * while reading only the composed decision, and a decision that can only be
 * read while it is being composed does not meet it.
 */
async function commandShow(
  parsed: ParsedCommand,
  store: IterationStore,
  storePath: string,
): Promise<number> {
  if (parsed.proposalId === null) {
    return refuse(
      "show needs --proposal-id ID, naming the proposal to read back. The ids are on the " +
        "inbox, under what is waiting on you.",
    );
  }
  const pin = cadenzaRevision();
  if ("refusal" in pin) {
    return refuse(pin.refusal);
  }
  const outcome = await showProposal(
    {
      store,
      cadenzaRevision: pin.revision,
      record: openAdvisoryRecord(storePath),
      now: Date.now,
      present: (lines) => {
        for (const line of lines) {
          say(line);
        }
      },
    },
    parsed.proposalId,
  );
  if (outcome.kind === "refused") {
    return refuse(outcome.reason);
  }
  if (outcome.kind === "shownUncounted") {
    // Status 1 for `sayAdvisoryOutcome`'s reason exactly: the operator has read
    // it and what failed is the count of what was put to them, which is the one
    // number D-0032 rule 10 says nothing else can supply.
    consoleSeams.writeError(
      asciiEscape(
        `This proposal was shown and was not counted as presented: ${outcome.reason}. ` +
          "The breakdown of what was put to you and what was not will be short by one.\n",
      ),
    );
    return 1;
  }
  return 0;
}

async function commandInbox(
  parsed: ParsedCommand,
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
): Promise<number> {
  const actor = approvedActor(parsed.actorId, environment);
  if ("refusal" in actor) {
    return refuse(actor.refusal);
  }
  const outcome = await showInbox(
    {
      store,
      record: openAdvisoryRecord(storePath),
      now: Date.now,
      locateTranscript: transcriptPort(environment),
      present: (lines) => {
        for (const line of lines) {
          say(line);
        }
      },
    },
    actor.actorId,
  );
  return sayInboxOutcome(outcome);
}

/** What `inbox` does with the answer it gets back. */
function sayInboxOutcome(outcome: InboxOutcome): number {
  if (outcome.kind === "shown") {
    return 0;
  }
  // **Status 1, and the screen still stands.** The operator has read it; what
  // failed is rondo's record of the reading -- the count of what was put to
  // them (D-0032 rule 10) or the mark that makes the next look a diff (rule 9).
  // Reporting success would make an under-counted ledger, or a cursor that
  // silently stopped moving, the quiet outcome.
  for (const reason of outcome.reasons) {
    consoleSeams.writeError(asciiEscape(`This look was not fully recorded: ${reason}\n`));
  }
  return 1;
}

/**
 * The cadenza that composed a contract, read from the pin the repository keeps.
 *
 * **A file rather than a constant, because a constant would be a fifth place
 * the pin is written down** -- `cadenza.pin.json`, `vendor/cadenza.tgz.sha256`,
 * `package-lock.json` and the tarball are the four `test/cadenza/pin.test.ts`
 * already holds to one story, and a copy in `src/` would be one no test
 * compares. `composition.cadenza_revision` records *which* cadenza composed the
 * contract a person approved (D-0022 rule 18), so a stale copy here would
 * misattribute it silently.
 *
 * Read relative to this module rather than to the working directory: `src/` and
 * the built `dist/` sit at the same depth below the repository root, so one
 * relative URL answers for both.
 */
function cadenzaRevision(): { revision: string } | { refusal: string } {
  try {
    const raw = readFileSync(new URL("../../cadenza.pin.json", import.meta.url), "utf8");
    const parsed: unknown = JSON.parse(raw);
    const revision =
      parsed !== null && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)["revision"]
        : undefined;
    if (typeof revision !== "string" || revision === "") {
      return {
        refusal:
          "cadenza.pin.json holds no 'revision', so which cadenza composed a contract could not be recorded.",
      };
    }
    return { revision };
  } catch (error) {
    return {
      refusal: `cadenza.pin.json could not be read: ${hostFailure(error).text}`,
    };
  }
}

/**
 * Door seven: propose what a retry could run under, and record what was shown.
 *
 * **The approvable kinds reach an operator here** (D-0022 rule 4's union,
 * D-0032 rule 1's option set). Unlike `explain`, this path composes: it issues
 * the exact contract each option would run under, for the successor identity
 * the operator names, and records it before showing the digest -- which is
 * D-0022 rules 17 and 18 taken together, and the reason `src/access` takes the
 * cadenza arrow rule 5 granted it.
 *
 * **`--kind` is required and has no default.** The three kinds ask three
 * different questions -- which plan, which agent type, which keys -- and a
 * default would put one of them to a person who meant another, with the same
 * confident option set either way. It is `explain --iteration-id`'s rule
 * applied to a second flag.
 */
async function commandPropose(
  parsed: ParsedCommand,
  store: IterationStore,
  storePath: string,
): Promise<number> {
  if (parsed.iterationId === null || parsed.successorId === null) {
    return refuse(
      "propose needs --iteration-id ID and --successor-id ID: the first names the iteration " +
        "whose work was not taken, and the second is the identity the retry would run as. rondo " +
        "derives the run id and the topic branch from the second, so it is a person's to choose.",
    );
  }
  const kind = PROPOSABLE_KINDS.find((one) => one === parsed.kind);
  if (kind === undefined) {
    return refuse(
      `propose needs --kind, one of ${PROPOSABLE_KINDS.join(", ")}. They ask three different ` +
        "questions -- which plan the retry runs, which agent type it runs under, and which keys " +
        "that agent type carries as granted -- so there is no default: one of them would be put " +
        "to you as confidently as the one you meant.",
    );
  }
  const pin = cadenzaRevision();
  if ("refusal" in pin) {
    return refuse(pin.refusal);
  }
  const outcome = await proposeRetry(
    // The four ports every advisory door takes, plus the one this door needs:
    // which cadenza composed the contracts it is about to show (D-0022 rule 18).
    { ...advisoryPorts(store, storePath), cadenzaRevision: pin.revision },
    kind,
    parsed.iterationId,
    parsed.successorId,
  );
  return sayAdvisoryOutcome(
    outcome,
    "proposal",
    outcome.kind === "refused"
      ? undefined
      : `Next: rondo decide --proposal-id ${outcome.proposalId} --actor-id ID ` +
          "--outcome approved --contract-digest DIGEST",
  );
}

/**
 * Door eight: answer a proposal, and write down who answered it.
 *
 * **Every rule that decides whether this may be recorded is the store's**
 * (D-0032 rules 5 and 6): a kind that binds nothing is refused inside the
 * writer's own transaction, and so is an approval naming a contract that was
 * never composed for the proposal. What this function checks is what a command
 * line owes an operator before a write is attempted -- that the identity is the
 * approver's, and that an approval carries the digest it is approving.
 *
 * **Nothing is consumed here.** An approval recorded by this verb authorises an
 * issuance that {@link commandRetry} performs, in the store's own transaction;
 * until it does, D-0022 rule 19's *"approved and never spent"* query is what
 * reports it.
 */
async function commandDecide(
  parsed: ParsedCommand,
  environment: Readonly<Record<string, string | undefined>>,
  storePath: string,
): Promise<number> {
  if (parsed.proposalId === null) {
    return refuse("decide needs --proposal-id ID, naming the proposal being answered.");
  }
  if (parsed.outcome !== "approved" && parsed.outcome !== "declined") {
    return refuse(
      "decide needs --outcome approved or --outcome declined. Declining is written down rather " +
        "than left as silence: 'the operator settled this' and 'nobody has answered' are " +
        "different facts about the same proposal.",
    );
  }
  const approving = parsed.outcome === "approved";
  if (approving && parsed.contractDigest === null) {
    return refuse(
      "approving needs --contract-digest DIGEST: the contract line of the option you are " +
        "approving, copied from the screen. What is recorded is the contract you were shown, " +
        "not the option's position in a list that may have been rendered again since.",
    );
  }
  if (!approving && parsed.contractDigest !== null) {
    return refuse(
      "--contract-digest is refused with --outcome declined: a refusal approves no contract, " +
        "and a digest on one would read as an approval that had been recorded as its opposite.",
    );
  }
  const actor = approvedActor(parsed.actorId, environment);
  if ("refusal" in actor) {
    return refuse(actor.refusal);
  }
  const outcome = await recordAnswer(
    { record: openAdvisoryRecord(storePath), now: Date.now },
    {
      proposalId: parsed.proposalId,
      outcome: parsed.outcome,
      contractDigest: parsed.contractDigest,
      actorId: actor.actorId,
    },
  );
  if (outcome.kind === "refused") {
    return refuse(outcome.reason);
  }
  say(`recorded as decision '${outcome.decisionId}'`);
  if (approving) {
    say(
      "This records that you approved that contract. Nothing has been spent: the admission " +
        "that reads this decision is 'rondo retry', and it compares the contract your plan " +
        "composes against the one above before anything runs.",
    );
    say(`Next: rondo retry --proposal-id ${parsed.proposalId}`);
  }
  return 0;
}

/**
 * Door eleven: spend one approval, and run the retry it authorises.
 *
 * **The last link of #41 section 3's chain** -- observation, elevation,
 * proposal, approval, contract -- and the one #107 measured as missing. Nothing
 * new is decided here: `approvedRetry` re-derives, from the material as it
 * stands now, which plan composes the contract a person approved, and `admit()`
 * hands the approval to `reserve()` so the consumption row and the iteration
 * row are written in one transaction (D-0022 rule 9).
 *
 * **Every refusal is fail-closed and none of them spends anything.** A digest
 * that no longer matches, an approval already spent, a successor identity
 * somebody took: each ends with no row, no run and the approval still standing
 * (D-0043 rule 8).
 */
async function commandRetry(
  parsed: ParsedCommand,
  store: IterationStore,
  storePath: string,
  ports: ReturnType<typeof conductorPorts>,
  advisory: UnpromptedPorts,
  continuo: VerifiedContinuo,
): Promise<number> {
  if (parsed.proposalId === null) {
    return refuse(
      "retry needs --proposal-id ID, naming the proposal whose approval it spends. There is no " +
        "default: an approval is spendable once, and 'the obvious one' is not a thing rondo " +
        "may decide on a person's behalf.",
    );
  }
  // The presenter is silenced: this verb shows nothing a person answers, and a
  // proposal re-rendered here would be a presentation nobody asked for
  // (D-0042).
  const resolved = await approvedRetry(
    advisoryPorts(store, storePath, () => {}),
    parsed.proposalId,
  );
  if (resolved.kind === "refused") {
    return refuse(resolved.reason);
  }
  const retry = resolved.retry;
  say(
    `decision '${retry.decisionId}' approved ${retry.contractDigest}, and that is the contract ` +
      `the plan below composes under '${retry.successorId}'`,
  );
  say(`retrying '${retry.subjectId}' as iteration '${retry.successorId}'`);
  say("the lap is the step that is slow");
  // **The request is read from the row being retried, and the store reads it
  // again** (rondo#195): `reserve()` derives a successor's link from the row it
  // supersedes whatever is passed, so this is the argument the type asks for
  // and not a second opinion. A subject that will not read is `approvedRetry`'s
  // to have refused.
  const subject = await store.read(retry.subjectId);
  if (subject.kind !== "read") {
    return refuse(`The iteration '${retry.subjectId}' being retried did not read.`);
  }
  const report = await admit(
    ports,
    advisory,
    retry.plan,
    START_POLICY,
    retry.successorId,
    // The retry supersedes the row it was proposed about (D-0030 rule 1), and
    // the lineage is written by `reserve()` in the same transaction as the
    // consumption -- so a spent approval and the row it authorised are one
    // record or neither.
    retry.subjectId,
    { decisionId: retry.decisionId, contractDigest: retry.contractDigest },
    subject.record.requestMessageId,
  );
  sayReport(report);
  if (report.status === "awaiting_human") {
    await sayGateOpen(() =>
      takeModelReading(
        modelReviewPorts(continuo, store, ports.thread ?? null),
        report.iterationId ?? retry.successorId,
      ),
    );
    return 0;
  }
  if (report.iterationId === null) {
    return 2;
  }
  return report.status === "closed" ? 0 : 1;
}

/**
 * Record the plan setup composed into the store it provisioned (D-0075 rule
 * 2.1): the last thing setup does, so a fresh store holds its first plan and
 * nobody carries the file to the page. The plan must be one a person could
 * pick -- it reads, it is no revise lap's, and its agent type builds a record
 * -- or the page would say nothing is held after setup said it was done.
 */
async function commandSetupPlan(
  parsed: ParsedCommand,
  environment: Readonly<Record<string, string | undefined>>,
  storePath: string,
): Promise<number> {
  const file = parsed.planFile;
  if (file === null || !isAbsolute(file)) {
    return refuse(
      "setup-plan needs --plan FILE, an absolute path to the plan setup wrote. A relative path " +
        "would name a different file from a different directory.",
    );
  }
  const actor = approvedActor(parsed.actorId, environment);
  if ("refusal" in actor) {
    return refuse(actor.refusal);
  }
  const read = readPlanDocument(file);
  if ("refusal" in read) {
    return refuse(`${file}: ${read.refusal}`);
  }
  const planned = readRunPlan(read.document);
  if (planned.kind !== "planned") {
    return refuse(`${file}: The plan was refused: ${planned.reason}`);
  }
  if (planned.plan.pullRequestBaseBranch !== null) {
    return refuse(
      `${file}: its pull_request_base_branch is set, which only a revise lap's plan has, and no ` +
        "new work starts from one.",
    );
  }
  const recorded = agentTypeRecordOf(planned.plan, read.document);
  if ("refusal" in recorded) {
    return refuse(`${file}: its agent type builds no record: ${recorded.refusal}`);
  }
  const atMs = Date.now();
  const setupId = `setup-${String(atMs)}`;
  const written = await openAdvisoryRecord(storePath).recordSetupPlan({
    setupId,
    plan: read.document,
    recordedBy: actor.actorId,
    recordedAtMs: atMs,
  });
  if (written.kind !== "recorded") {
    return refuse(written.reason);
  }
  say(`recorded as setup '${setupId}'`);
  say(`plan: ${recorded.record.planDigest}`);
  say(`repository: ${planned.plan.repository} at ${planned.plan.workspaceRoot}`);
  say(`agent type: ${recorded.record.agentTypeDigest}`);
  return 0;
}

/**
 * Write one scope, show it, and count that it was shown (D-0066 section 1).
 *
 * **Write, present, count**, `propose`'s order (D-0036 rule 1): the screen a
 * person approves from is composed from the stored row, digest included, so
 * what `decide-scope` names is what the store holds. The operator authors the
 * row, so its `author_kind` is `operator` and its author the allowlisted actor
 * (rule 1.5); a drafter row needs bases, and no verb writes one.
 *
 * **Defaults are filled before the digest** (`scopePayloadWithDefaults`), so
 * the approved bytes and the tested bytes are one document.
 */
async function commandScope(
  parsed: ParsedCommand,
  environment: Readonly<Record<string, string | undefined>>,
  storePath: string,
): Promise<number> {
  if (parsed.payloadFile === null || !isAbsolute(parsed.payloadFile)) {
    return refuse(
      "scope needs --payload-file FILE, an absolute path to the scope's JSON payload. A relative " +
        "path would name a different file from a different directory.",
    );
  }
  const actor = approvedActor(parsed.actorId, environment);
  if ("refusal" in actor) {
    return refuse(actor.refusal);
  }
  let document: unknown;
  try {
    document = JSON.parse(readFileSync(parsed.payloadFile, "utf8"));
  } catch (error) {
    return refuse(`The scope payload could not be read as JSON: ${hostFailure(error).text}`);
  }
  if (document === null || typeof document !== "object" || Array.isArray(document)) {
    return refuse("The scope payload file must hold a JSON object.");
  }
  // D-0069 section 1: each plan records its agent type in the scope's own
  // transaction, so the scope may list one no lap has run yet.
  const agentTypeRecords: { file: string; record: AgentTypeRecordDraft }[] = [];
  for (const file of parsed.planFiles) {
    if (!isAbsolute(file)) {
      return refuse(
        `scope --plan '${file}' is not an absolute path, and a relative path would name a ` +
          "different file from a different directory.",
      );
    }
    const read = readPlanDocument(file);
    if ("refusal" in read) {
      return refuse(`${file}: ${read.refusal}`);
    }
    const planned = readRunPlan(read.document);
    if (planned.kind !== "planned") {
      return refuse(`${file}: The plan was refused: ${planned.reason}`);
    }
    const recorded = agentTypeRecordOf(planned.plan, read.document);
    if ("refusal" in recorded) {
      return refuse(`${file}: its agent type builds no record: ${recorded.refusal}`);
    }
    agentTypeRecords.push({ file, record: recorded.record });
  }
  const record = openAdvisoryRecord(storePath);
  const atMs = Date.now();
  const scopeId = `scope-${String(atMs)}`;
  const written = await record.recordScope({
    scopeId,
    payload: scopePayloadWithDefaults(document as JsonRecord),
    supersedesScopeId: parsed.supersedesScopeId,
    authorKind: "operator",
    authorId: actor.actorId,
    bases: [],
    createdAtMs: atMs,
    agentTypeRecords: agentTypeRecords.map((recorded) => recorded.record),
  });
  if (written.kind !== "recorded") {
    for (const recorded of agentTypeRecords) {
      say(`plan ${recorded.file}: agent type ${recorded.record.agentTypeDigest}`);
    }
    return refuse(written.reason);
  }
  const stored = await record.readScope(scopeId);
  if (stored.kind !== "read") {
    return refuse(
      `scope '${scopeId}' was recorded and will not read back: ` +
        (stored.kind === "absent" ? "it is not there" : stored.reason),
    );
  }
  const scope = stored.scope;
  const payload = scope.payload;
  const budgets = payload.budgets;
  say(`recorded as scope '${scope.scopeId}'`);
  say(`digest: ${scope.scopeDigest}`);
  say(`requests: ${payload.requests.join(", ")}`);
  for (const workspace of payload.workspaces) {
    say(`workspace: ${workspace.repository} at ${workspace.workspace_root}`);
  }
  say(`agent types: ${payload.agent_types.join(", ")}`);
  for (const recorded of agentTypeRecords) {
    say(`plan ${recorded.file}: agent type ${recorded.record.agentTypeDigest}`);
  }
  // `EN`, for D-0055 rule 10's reason: the console's strings go through
  // D-0004's escape, which has no CJK substitutes.
  for (const line of await heldAgentTypeLines(EN, record, payload.agent_types)) {
    say(line);
  }
  say(
    `budgets: ${String(budgets.laps)} laps, ${String(budgets.review_rounds)} review rounds, ` +
      `${String(budgets.cost_usd)} USD with ${String(budgets.cost_reserve_usd)} USD reserved per ` +
      `unread lap, expires at ${String(budgets.expires_at_ms)} ms`,
  );
  say(`severity threshold: ${payload.severity_threshold}`);
  say(`below the threshold: ${payload.below_threshold ?? "leave"}`);
  say(
    `outward acts: ${payload.outward_acts.length === 0 ? "none" : payload.outward_acts.join(", ")}`,
  );
  say(
    "irreversible additions: " +
      (payload.irreversible_additions.length === 0
        ? "none"
        : payload.irreversible_additions.join(", ")),
  );
  if (scope.supersedesScopeId !== null) {
    say(`supersedes scope '${scope.supersedesScopeId}'`);
    // Rule 1.4: approving this successor retires the predecessor's approval, so
    // what that approval has already spent is part of what is being decided.
    const prior = await record.scopeDecisionOf(scope.supersedesScopeId);
    if (prior.kind === "read" && prior.decision.outcome === "approved") {
      const spent = await record.scopeSpent(prior.decision.scopeDecisionId);
      say(
        `the predecessor's approval '${prior.decision.scopeDecisionId}' has spent ` +
          `${String(spent.admissions)} laps and ${String(spent.readCostUsd)} USD read, with ` +
          `${String(spent.unreadLaps)} unread laps holding their reserve`,
      );
    } else {
      say(
        prior.kind === "unreadable"
          ? `the predecessor's decision will not read: ${prior.reason}`
          : "the predecessor has no approval, so it has spent nothing",
      );
    }
  }
  // D-0066 gate answer 1: what the cost budget does not see is said on the screen.
  say(
    "The cost budget counts the laps' own cost only: the reviewer's cost is not counted, and a " +
      "lap whose cost is not read yet holds the reserve, which is a guess.",
  );
  const counted = await record.recordAttention({
    atMs,
    subjectKind: "scope",
    subjectId: scope.scopeId,
    disposition: "presented",
    ruleName: null,
  });
  if (counted.kind !== "recorded") {
    say(`the scope above was shown and its presentation was not counted: ${counted.reason}`);
    return 1;
  }
  say(
    `Next: rondo decide-scope --scope-id ${scope.scopeId} --scope-digest ${scope.scopeDigest} ` +
      "--actor-id ID --outcome approved",
  );
  return 0;
}

/**
 * Answer one scope (D-0066 section 2), `decide`'s shape: the approver on the
 * allowlist, the surface as `recorded_by`, and the digest copied off the
 * screen on both outcomes -- the writer refuses one that is not the row's
 * (rule 2.2), and a decline names the row it declined as exactly as an
 * approval does.
 */
async function commandDecideScope(
  parsed: ParsedCommand,
  environment: Readonly<Record<string, string | undefined>>,
  storePath: string,
): Promise<number> {
  if (parsed.scopeId === null || parsed.scopeDigest === null) {
    return refuse(
      "decide-scope needs --scope-id ID and --scope-digest DIGEST, the digest line copied from " +
        "the screen: what is recorded is the scope you were shown.",
    );
  }
  if (parsed.outcome !== "approved" && parsed.outcome !== "declined") {
    return refuse(
      "decide-scope needs --outcome approved or --outcome declined. Declining is written down " +
        "rather than left as silence.",
    );
  }
  const actor = approvedActor(parsed.actorId, environment);
  if ("refusal" in actor) {
    return refuse(actor.refusal);
  }
  const decidedAtMs = Date.now();
  const scopeDecisionId = `scope-decision-${parsed.scopeId}-${String(decidedAtMs)}`;
  const outcome = await openAdvisoryRecord(storePath).recordScopeDecision({
    scopeDecisionId,
    scopeId: parsed.scopeId,
    scopeDigest: parsed.scopeDigest,
    outcome: parsed.outcome,
    actorId: actor.actorId,
    recordedBy: COMMAND_LINE_SURFACE,
    decidedAtMs,
  });
  if (outcome.kind !== "recorded") {
    return refuse(outcome.reason);
  }
  say(`recorded as scope decision '${scopeDecisionId}'`);
  if (parsed.outcome === "approved") {
    say(
      "Nothing has been spent. An act taken under this scope is tested against it at the moment " +
        "it is taken, and one that is not inside it is refused and spends nothing.",
    );
  }
  return 0;
}

/**
 * An in-scope retry (D-0066 rule 3.2, D-0064 O4): the predecessor's stored plan
 * admitted again under the successor's identity, **through the one call site
 * that computes a verdict** (`admitUnderScope`, rule 4.1). Anything but
 * `inside` is printed with the test that refused it and takes no act.
 *
 * **The retry inherits the predecessor row's `requestMessageId`** (D-0061 rule
 * 4): it redoes that request's work, so it is tested against the scope's
 * `requests` and the thread's open asks as that request, never as one named on
 * the command line.
 *
 * **A refusal says what keeps the line stopped** (rule 4.4): the asking message
 * written into the request's thread, or the one already holding it. A retry
 * whose predecessor names no request has no thread, and that refusal is the one
 * left with no durable stop; a stop that could not be written exits 1.
 */
export async function commandScopedRetry(
  parsed: ParsedCommand,
  store: IterationStore,
  storePath: string,
  ports: ReturnType<typeof conductorPorts>,
  advisory: UnpromptedPorts,
  continuo: VerifiedContinuo,
): Promise<number> {
  const { iterationId: predecessorId, successorId, scopeDecisionId } = parsed;
  if (predecessorId === null || successorId === null || scopeDecisionId === null) {
    return refuse(
      "retry needs --proposal-id ID, or all three of --iteration-id ID (the iteration to redo), " +
        "--successor-id ID (the identity it runs as) and --scope-decision-id ID (the approved " +
        "scope it spends).",
    );
  }
  const predecessor = await store.read(predecessorId);
  if (predecessor.kind !== "read") {
    return refuse(
      predecessor.kind === "absent"
        ? `There is no iteration '${predecessorId}' in this store, so there is no plan to redo.`
        : `Iteration '${predecessorId}' will not decode: ${predecessor.reason}`,
    );
  }
  const decoded = readPlan(predecessor.record.plan);
  if (decoded.kind !== "planned") {
    return refuse(`The plan iteration '${predecessorId}' ran will not decode: ${decoded.reason}`);
  }
  const outcome = await admitUnderScope(
    {
      store,
      record: openAdvisoryRecord(storePath),
      nowMs: Date.now,
      admit: (plan, id, supersedes, requestMessageId, scopeSpend) =>
        admit(
          ports,
          advisory,
          plan,
          START_POLICY,
          id,
          supersedes,
          null,
          requestMessageId,
          scopeSpend,
        ),
    },
    scopeDecisionId,
    {
      kind: "redo",
      iterationId: successorId,
      plan: decoded.plan,
      predecessorId,
      requestMessageId: predecessor.record.requestMessageId,
      // A retry reruns the stored plan; the closing lap is a revise press.
      closing: false,
    },
  );
  return await finishScopedAdmission(
    outcome,
    "retry",
    continuo,
    store,
    successorId,
    ports.thread ?? null,
  );
}

/**
 * Say what an admission under a scope came to, for `retry` and `start` alike:
 * a refusal with the test that refused it and what keeps the line stopped
 * (D-0066 rule 4.4), or the lap's report and its gate.
 */
async function finishScopedAdmission(
  outcome: ScopedAdmission,
  act: "retry" | "first admission" | "revise",
  continuo: VerifiedContinuo,
  store: IterationStore,
  iterationId: string,
  thread: RequestThread | null,
): Promise<number> {
  if (outcome.kind === "halted") {
    return outcome.status;
  }
  if (outcome.kind === "refused") {
    consoleSeams.writeError(
      `${asciiEscape(
        `Refused: the ${act} is ${outcome.verdict} the scope at the ${outcome.test} test, so ` +
          `nothing was admitted and nothing was spent: ${outcome.reason}`,
      )}\n`,
    );
    const stop = outcome.stop;
    switch (stop.kind) {
      case "written":
        return refuse(
          `The line is stopped by message '${stop.messageId}', which asks in the request's ` +
            "thread; a reply to it is what lets the line carry on.",
        );
      case "held":
        return refuse(
          `No new message was written: message '${stop.messageId}' ` +
            "already holds this line, and a reply to it is what lets the line carry on.",
        );
      case "failed":
        refuse(
          `The message '${stop.messageId}' that keeps this line stopped was NOT recorded: ${stop.reason}`,
        );
        return 1;
    }
  }
  const report = outcome.report;
  sayReport(report);
  if (report.status === "awaiting_human") {
    await sayGateOpen(() =>
      takeModelReading(
        modelReviewPorts(continuo, store, thread),
        report.iterationId ?? iterationId,
      ),
    );
    return 0;
  }
  if (report.iterationId === null) {
    return 2;
  }
  return report.status === "closed" ? 0 : 1;
}

/**
 * Say that the gate is open, then take the model reading of the lap and print it
 * (D-0065 2.6). Exported so the order is testable without a continuo.
 *
 * **After `drive()` returned**, so the deterministic reading is already on the
 * row and the gate is already open: a person may answer from another terminal
 * while this runs, and answers without it. That is D-0029 rule 3's information
 * where the clock runs, not a wait in front of the gate.
 *
 * **The next step is said first, and that order is the point.** The reviewer
 * may run up to its timeout; an operator told "Next: rondo answer" only after
 * it would sit in front of an open gate being told nothing, which is the wait
 * D-0029 rule 3 refuses put back by the printing order. `take` is null when no
 * reading is due, and then only the next step is said.
 */
export async function sayGateOpen(take: (() => Promise<readonly string[]>) | null): Promise<void> {
  say("");
  say("A person has to answer this before anything lands. Next: rondo answer");
  if (take === null) {
    return;
  }
  say("");
  say(
    "model review  taking a model reading of this work; the gate is already open and does " +
      "not wait for it, but you should: answer after it prints below",
  );
  for (const line of await take()) {
    say(line);
  }
}

/** Door two: see what is waiting, and answer it. */
/**
 * What the operator is shown about the work itself, on every path that answers.
 *
 * **This is the half of D-0029 the entry says is worth more than the rest**, and
 * the measurement it answers is in `docs/operations/lap-1-dogfood.md`: the gate
 * carries `rationale`, which is the worker's own account of its own work, and
 * this command used to print that and no workspace path, no branch and nothing
 * a person could go and look at. An operator was recorded approving on it.
 *
 * **The two callers are not equal, and the difference is stated rather than
 * blurred.** On the reading path this arrives before an answer is typed and
 * informs it. On the one-shot `--body` path the answer is already given and
 * `walkGate` follows with no further chance to take input, so there it is a
 * **receipt**: a record of what was approved over. Closing the rest of that gap
 * is the procedure's job -- a step that reads before it answers -- and not a
 * refusal here, because a machine standing between a person and their own gate
 * answer is what D-0029 rule 3 refuses on the clock argument.
 */
async function sayLapMaterial(
  store: IterationStore,
  record: IterationRecord,
  continuo: VerifiedContinuo | null,
): Promise<void> {
  // **`EN` and not the host's set** (D-0055 rule 10). This is the console, and
  // D-0004's escape has no CJK substitutes: a Japanese fence block would print
  // here as `\uXXXX`. The page's copy of the same lines is handed the
  // operator's set in `pageMaterial`.
  for (const line of await lapMaterialLines(EN, store, record, continuo)) {
    say(line);
  }
}

/**
 * The same material as lines, for a surface that is not a terminal.
 *
 * **Lifted out rather than copied**, which is D-0041 rule 6 itself:
 * the page offers an approve button, and a person pressing it must be shown what
 * `rondo answer` shows them -- the branch, the workspace, the commit subjects,
 * the paths and the independent reading -- or the screen that is easier to reach
 * is also the screen that asks for less before it writes. Two renderings of this
 * would be two things to keep true; one list of lines, printed by the terminal
 * and put in a `<pre>` by the page, is one.
 */
export async function lapMaterialLines(
  wording: Chrome,
  store: IterationStore,
  record: IterationRecord,
  continuo: VerifiedContinuo | null,
): Promise<readonly string[]> {
  return (await lapMaterial(wording, store, record, continuo)).lines;
}

/**
 * {@link lapMaterialLines}, with the workspace inspection its lines were
 * composed from (#220 S2).
 *
 * **One `git` read, handed out twice**: the page draws the commits and files as
 * rows from `work` and keeps `lines` whole in a fold, so the rows and the text
 * are the same read and cannot disagree. Null `work` is a row naming no range.
 */
async function lapMaterial(
  wording: Chrome,
  store: IterationStore,
  record: IterationRecord,
  continuo: VerifiedContinuo | null,
): Promise<{ readonly lines: readonly string[]; readonly work: LapWorkInspection | null }> {
  const workspace = planField(record, "workspace");
  const topicBranch = planField(record, "topic_branch");
  const lines: string[] = [
    `work    ${topicBranch === "" ? "(no topic branch on the row)" : topicBranch}`,
    `        in ${workspace === "" ? "(no workspace on the row)" : workspace}`,
  ];
  // **The commits and the files, not a count of them.** A summary that said
  // "3 commits, 2 files" would leave the person exactly where the gate's own
  // `rationale` leaves them: told that work happened, and told it by a summary.
  // D-0029 rule 2 asks for the base ref, the subjects and the paths, and the
  // point of asking is that a subject is the one place a lap says what it did
  // in words nobody generated for this screen.
  const range = readingRangeOf(record);
  const work = range === null ? null : await inspectLapWork(range);
  if (work === null) {
    lines.push("        the row does not name a range, so there is nothing to list");
  } else {
    lines.push(...workLines(work));
  }
  lines.push(...(await fenceLines(wording, continuo, record)));
  const readings = await store.readingsFor(record.id);
  // **The deterministic reading, and the model reading beside it as material**
  // (D-0065 5.5). They are picked by drafter rather than by position: a model
  // reading appended after the gate opened is the newest row, and taking the
  // newest row as "the review" would print the model's words where `publish`'s
  // refusal reads the deterministic one. "Not a model's" rather than "the
  // deterministic drafter's", so the interpreter's own `unavailable` row
  // (`rondo/none`, carrying why the work could not be read) still shows.
  const latest = reviewedReading(readings);
  if (latest === null) {
    lines.push(
      "review  no independent reading of this work was recorded.",
      "        'rondo publish' will refuse once on that, and --despite-review is the way past.",
    );
  } else {
    lines.push(...reviewLines(latest));
  }
  const model = latestReading(readings, isModelReadingDrafter);
  if (model !== null) {
    lines.push(...modelReadingLines(model));
  }
  return { lines, work };
}

/**
 * The latest model reading as `publish` prints it, or nothing (D-0065 5.5).
 *
 * Material beside the deterministic reading `reviewGate` refuses on, never an
 * input to it: publish's refusal stays the deterministic reader's alone.
 */
export function publishModelReadingLines(
  readings: readonly LapReading[],
  /** The lap is a closing lap (D-0098 rule 5.3), or null. */
  closing: ClosingNotReread | null = null,
): readonly string[] {
  // A closing lap has no model reading of its own, and saying nothing would
  // read as "no reviewer was asked" rather than "not re-read on purpose".
  if (closing !== null) {
    return [`model review  not re-read. ${notRereadSentence(closing)}`];
  }
  const model = latestReading(readings, isModelReadingDrafter);
  return model === null ? [] : modelReadingLines(model);
}

/**
 * What the lap was allowed to run, and what its fence refused (rondo#88).
 *
 * **Two facts the operator already owned and could not see**, printed next to
 * each other because neither answers "was this actually verified?" alone: a
 * refusal only means something against the allowance it was measured by, and an
 * allowance only means something beside what the run then hit. They go here --
 * in the block `rondo answer` and the page both render -- rather than into
 * `explain` or a verb of their own, because this is the one screen a person
 * reads immediately before pressing approve, and it is already the screen whose
 * purpose is to be the half of the gate the graded party did not write.
 *
 * **Every line says what rondo read and where from** (D-0032). The allowance is
 * not the plan on rondo's own row -- that is what rondo asked for -- but the
 * envelope continuo stored at admission, read back through `run show` beside the
 * digest continuo recomputed over it (D-0040). The refusals are continuo's own
 * `permission_denials`, carried to the row at the suspend and printed from it.
 *
 * **"None" and "not known" are never the same sentence**, on both halves. That
 * is `continuo D-1110`'s whole argument for the key being nullable, and the
 * three states of the column are spelled out on `IterationRecord`.
 *
 * **A third thing is said here and it is neither fact**: what this block does
 * not cover. It is `Chrome.secondFence`, which is where that sentence's own
 * argument for being unconditional is written down -- and, after D-0055
 * rule 11, the place it is also written in the operator's language.
 *
 * ponytail: one more `run show` per redraw, on top of the `gate show` that
 * `pageMaterial` already pays. Same ceiling and same upgrade as that one -- a
 * rondo-side column written at admission -- not taken now because the whole
 * value of this half is that the bytes come back from continuo.
 */
async function fenceLines(
  wording: Chrome,
  continuo: VerifiedContinuo | null,
  record: IterationRecord,
): Promise<readonly string[]> {
  const lines = [
    ...(await allowanceLines(wording, continuo, record)),
    ...denialLines(record),
    // Appended here rather than inside either half, which is what makes it
    // unconditional: neither the allowance's six answers nor the denials' five
    // can leave it out, and a later branch added to either cannot either.
    ...wording.secondFence,
  ];
  return lines.map((line, index) => (index === 0 ? `fence   ${line}` : `        ${line}`));
}

/** What the run was admitted as permitted to run, read back from continuo. */
async function allowanceLines(
  wording: Chrome,
  continuo: VerifiedContinuo | null,
  record: IterationRecord,
): Promise<readonly string[]> {
  if (record.runId === null) {
    return ["the row names no run, so there is no delegation record to read an allowance from."];
  }
  if (continuo === null) {
    return [
      `continuo is not usable here, so what run ${record.runId} was allowed to run was not`,
      "read. That is unknown rather than nothing.",
    ];
  }
  const observed = await showRun(continuo, { db: planField(record, "db"), runId: record.runId });
  if (observed.kind !== "answered") {
    return [
      `the delegation record for run ${record.runId} could not be read (${observed.kind}), so`,
      "what the lap was allowed to run is unknown rather than nothing.",
    ];
  }
  const stored = observed.payload.delegationRecord;
  if (stored === null) {
    return [
      `continuo holds no delegation record for run ${record.runId}, so what it was allowed to`,
      "run was never recorded.",
    ];
  }
  const subjects = allowedBashIn(stored.envelope);
  if (subjects === null) {
    return [
      `the delegation record for run ${record.runId} is '${stored.recordSchema}', which rondo`,
      "cannot read, so what the lap was allowed to run is unknown rather than nothing.",
    ];
  }
  const provenance = [
    `read from run ${record.runId}'s delegation record at continuo (${stored.recordSchema}).`,
    `envelope ${stored.digestAlgorithm} ${stored.envelopeDigest}`,
    "continuo re-checked that digest against the stored bytes: " +
      `${stored.digestVerified ? "it matches" : "IT DOES NOT MATCH"}.`,
    // **The declaration is not the fence, and saying so is the whole point of
    // the screen.** The sentence and its argument are `Chrome.declarationCaveat`
    // -- composed only on the paths where the delegation record was actually
    // read, which is why it is not beside `Chrome.secondFence` above.
    ...wording.declarationCaveat,
  ];
  if (subjects.length === 0) {
    return ["this run declared no Bash subject of its own.", ...provenance];
  }
  return ["declared for this run:", ...subjects.map((subject) => `  ${subject}`), ...provenance];
}

/**
 * What the fence refused, printed from the row rather than counted.
 *
 * Listed and not summarised for `workLines`'s reason: a count tells a person
 * that something was refused and leaves them where the worker's own prose left
 * them. The cap is `LIST_LIMIT` and says how many it hid. A call's input is the
 * worker's own text and may carry newlines, so it is rendered as a JSON string
 * -- on a line rondo composed, an embedded newline must not be ambiguous with
 * the line around it (rondo#68).
 */
function denialLines(record: IterationRecord): readonly string[] {
  const text = record.permissionDenials;
  if (text === null) {
    return ["what the fence refused was not recorded for this iteration, so it is unknown."];
  }
  if (text === "null") {
    return ["continuo could not say what the fence refused, so it is unknown rather than none."];
  }
  let denials: unknown;
  try {
    denials = JSON.parse(text);
  } catch {
    denials = null;
  }
  if (!Array.isArray(denials)) {
    return ["the recorded refusals will not decode, so what the fence refused is unknown."];
  }
  if (denials.length === 0) {
    return ["continuo reported that the fence refused nothing."];
  }
  const hidden = denials.length - LIST_LIMIT;
  return [
    `the fence refused ${String(denials.length)} call(s), as continuo reported them:`,
    ...denials.slice(0, LIST_LIMIT).map((denial) => `  ${denialLine(denial)}`),
    ...(hidden > 0 ? [`  ...and ${String(hidden)} more`] : []),
  ];
}

/**
 * What the lap committed, listed rather than counted.
 *
 * **An unreadable workspace prints and does not refuse.** This runs on the path
 * to a person's gate answer, where D-0029 rule 3 refuses to let anything of
 * rondo's stand between them and it: a workspace that has been moved or removed
 * since the lap ran is worth saying out loud and is not worth withholding the
 * gate over.
 *
 * Capped at `LIST_LIMIT` for the reason the pull-request body is, and saying
 * how many were hidden rather than trailing off -- a list that stops without
 * saying it stopped is a list a person reads as complete.
 */
export function workLines(work: LapWorkInspection): readonly string[] {
  if (work.kind !== "read") {
    return [`        the workspace could not be read: ${work.reason}`];
  }
  const lines = [`        against ${work.baseRef}`];
  if (work.commits.length === 0) {
    lines.push("        no non-merge commits on the branch");
  } else {
    for (const commit of work.commits.slice(0, LIST_LIMIT)) {
      lines.push(`        ${commit.abbreviatedSha} ${commit.subject}`);
    }
    const hiddenCommits = work.commits.length - LIST_LIMIT;
    if (hiddenCommits > 0) {
      lines.push(`        ...and ${String(hiddenCommits)} more commit(s)`);
    }
  }
  if (work.files.length === 0) {
    lines.push("        no files changed");
    return lines;
  }
  for (const file of work.files.slice(0, LIST_LIMIT)) {
    lines.push(`        ${file.path} ${fileCounts(file)}`);
  }
  const hiddenFiles = work.files.length - LIST_LIMIT;
  if (hiddenFiles > 0) {
    lines.push(`        ...and ${String(hiddenFiles)} more file(s)`);
  }
  return lines;
}

/**
 * The range a reading of this row was taken across, or null when the row does
 * not name one.
 *
 * **One definition, read by both ends of D-0029 rule 10's comparison**, and it
 * exists because getting it wrong is invisible in the ordinary case and routine
 * in the revision case. `publish` compares against `pull_request_base_branch`
 * when a revision set one -- the first lap's base, carried along the chain --
 * while the reading was taken against `base_branch`, the predecessor's topic
 * branch. Two different ranges compared against each other report every
 * unchanged revision as stale, which sends the operator to `--despite-review`
 * as a habit and costs the stage the only force it has.
 */
export function readingRangeOf(record: IterationRecord): LapWorkRequest | null {
  const workspace = planField(record, "workspace");
  const topicBranch = planField(record, "topic_branch");
  const baseBranch = planField(record, "base_branch");
  if (workspace === "" || topicBranch === "" || baseBranch === "") {
    return null;
  }
  return { workspace, remote: READING_REMOTE, baseBranch, topicBranch };
}

/**
 * One stored reading, as an operator reads it. ASCII, one line at a time
 * (D-0004).
 *
 * **What it did not look at is printed beside what it found** (rondo#69). The
 * headline used to be `read and nothing raised`, which is a claim about
 * coverage that this reader has no standing to make: it read commit subjects
 * and per-file counts, and on 2026-09-12 it said that under a gate whose own
 * `rationale` reported that the verification could not be run at all. The two
 * blocks are printed by the same command, and only the person spotted that they
 * disagreed. `readingCoverage` is the store's, so this screen and the
 * conductor's report say the same thing about the same drafter.
 *
 * **`unavailable` gets no coverage lines**, because nothing was read and the
 * branch already says so. Stating what an absent reading did not look at would
 * dress an absence up as a bounded check.
 */
export function reviewLines(reading: LapReading): readonly string[] {
  const evidence = reading.evidence;
  const coverage = readingCoverage(reading.drafter).map((line) => `        ${line}`);
  switch (reading.verdict) {
    case "clear":
      return [
        `review  read the commits and the files, and raised nothing (${reading.drafter}).`,
        `        ${String(evidence?.commitCount ?? 0)} commit(s), ` +
          `${String(evidence?.fileCount ?? 0)} file(s), tip ${evidence?.tipCommit ?? "(none)"}.`,
        ...coverage,
        "        This is material for you. It is not an approval and it permits nothing.",
      ];
    case "concerns":
      return [
        `review  ${String(reading.findings.length)} point(s) raised (${reading.drafter}):`,
        ...reading.findings.map((finding) => `        - ${finding}`),
        ...coverage,
        "        Material for you to weigh. The answer is still yours.",
      ];
    default:
      return [
        "review  no reading could be taken: " +
          `${reading.unavailableReason ?? "no reason recorded"}`,
        "        'rondo publish' refuses on this exactly as it does on a point raised, so that " +
          "unread",
        "        and read-and-fine cannot look alike.",
      ];
  }
}

/**
 * Why `publish` will not push a workspace that still holds uncommitted paths,
 * or null when it holds none (D-0060 rules 4 to 6).
 *
 * **Pure, and it takes no `despiteReview`.** That flag overrules a judgement;
 * this is git reporting that the push would leave named files behind, the
 * class of `publishPreflight`'s "has no branch", which no flag reaches either.
 *
 * **A `git status` that fails is refused here too** (D-0099), on rule 5's
 * own ground: what the push would leave behind is a fact, and not knowing it
 * is not a judgement an override can answer. A workspace whose *history* could
 * not be read is not refused here: it is `reviewGate`'s refusal, and
 * `--despite-review` passes it, as it did before D-0060 -- `inspectLapWork`
 * holds that such a publish stays publishable. The inspection's `part` is what
 * tells the two apart.
 *
 * rondo commits nothing on the lap's behalf, so the refusal names the remedies
 * that already exist, in the decision's order, and says up front what the
 * hand-commit remedy will cost on the next attempt.
 */
export function uncommittedRefusal(
  work: LapWorkInspection,
  workspace: string,
  topicBranch: string,
): string | null {
  if (work.kind === "unreadable") {
    return work.part === "status"
      ? `git status could not be read in the workspace ${workspace} (${work.reason}), so ` +
          "whether the push would leave uncommitted work behind is unknown, and " +
          "--despite-review does not change that. Repair the workspace so 'git status' " +
          "answers, then publish again."
      : null;
  }
  if (work.uncommitted.length === 0) {
    return null;
  }
  const branchNote =
    work.checkedOut === topicBranch
      ? ""
      : ` (the workspace has '${work.checkedOut}' checked out, not '${topicBranch}')`;
  return (
    `the workspace ${workspace} holds ` +
    `${uncommittedPaths(work.uncommitted, `that are not on the branch '${topicBranch}'`)}` +
    `${branchNote}. The push would leave them behind, and --despite-review does not change ` +
    "that. Answer it about the paths, not the publish: " +
    "(1) retry the lap ('rondo propose', then 'rondo retry'), so the lap commits its own work and " +
    "a new reading reads it; " +
    "(2) commit them by hand in the workspace -- that moves the branch, so the recorded reading " +
    "no longer describes it and publishing then takes --despite-review; " +
    "(3) discard them, or add them to the workspace's .git/info/exclude, if they are not work."
  );
}

/**
 * Whether the recorded reading lets `publish` run without being overruled.
 *
 * **Pure, and over both halves of the comparison**, for the reason
 * `publishPreflight` is pure over a `PushTargetInspection`: which readings may
 * publish is a rule about publishing rather than a fact about git, and a rule
 * that can be exercised without a repository on disk is a rule a test can hold.
 *
 * Three refusals and one pass, and the third refusal is the one that is easy to
 * miss. A reading is about the commits it read; `publish` pushes the branch as
 * it is *now*. Between the two, somebody can commit into the worktree, amend or
 * reset it -- and a reset onto the base is exactly the case the reader's own
 * "left nothing" finding exists to raise, arriving under a stale `clear` that
 * would carry it through (D-0029 rule 10).
 */
export function reviewGate(
  reading: LapReading | null,
  work: LapWorkInspection,
  despiteReview: boolean,
): { readonly kind: "ready" } | { readonly kind: "refused"; readonly reason: string } {
  const block = reviewBlock(reading, work);
  return block === null || despiteReview
    ? { kind: "ready" }
    : { kind: "refused", reason: reviewBlockSentence(block) };
}

/**
 * Why the recorded reading does not let `publish` run, or null when it does.
 *
 * **Split out of {@link reviewGate} so a screen can say it in its own words**
 * (rondo#233 S5). The command line's sentences end in "pass `--despite-review`",
 * which is a flag and therefore a terminal, and D-0059's page must never send a
 * person to one. Two surfaces wording one judgement two ways is only safe while
 * the judgement itself has one definition, so this function is it and
 * `reviewGate` is a sentence composed over it. The type is declared beside the
 * screen that words it ({@link ReviewBlock} in `./web.tsx`), as
 * `LapMaterialRead` is.
 */
export function reviewBlock(
  reading: LapReading | null,
  work: LapWorkInspection,
): ReviewBlock | null {
  if (reading === null) {
    return { why: "noReading" };
  }
  if (reading.verdict !== "clear") {
    return {
      why: "notClear",
      verdict: reading.verdict,
      findings: reading.findings,
      unavailableReason: reading.unavailableReason,
    };
  }
  const evidence = reading.evidence;
  if (evidence === null) {
    // Unreachable through the store, which records a clear with no evidence as
    // `unavailable` instead (D-0029 rule 11). Refused rather than trusted all
    // the same: a clear whose evidence is missing is a clear nothing can be
    // compared against, and the branch below is the only one that would be
    // silently skipped if it ever became reachable.
    return { why: "noEvidence" };
  }
  if (work.kind !== "read") {
    return { why: "unreadable", reason: work.reason };
  }
  const now = evidenceOf(work);
  if (now.tipCommit !== evidence.tipCommit || now.materialDigest !== evidence.materialDigest) {
    return { why: "moved", readTip: evidence.tipCommit, nowTip: now.tipCommit };
  }
  return null;
}

/** One {@link ReviewBlock} as the command line says it, unchanged since D-0060. */
export function reviewBlockSentence(block: ReviewBlock): string {
  switch (block.why) {
    case "noReading":
      return (
        "no independent reading of this work was recorded, so publishing it would put " +
        "work in front of the world that nothing read. That is the same refusal a reading " +
        "which raised something gets, on purpose: unread and read-and-fine must not look " +
        "alike. Pass --despite-review to publish anyway."
      );
    case "notClear":
      return (
        `the independent reading of this work is '${block.verdict}'` +
        `${block.findings.length === 0 ? "" : `: ${block.findings.join("; ")}`}` +
        `${block.unavailableReason === null ? "" : `: ${block.unavailableReason}`}. ` +
        "It settles nothing and it is not a veto; it is a point you have not answered. " +
        "Pass --despite-review to publish anyway."
      );
    case "noEvidence":
      return (
        "the recorded reading is 'clear' but carries no measurement of what was read, so " +
        "there is nothing to check it against. Pass --despite-review to publish anyway."
      );
    case "unreadable":
      return (
        `the workspace cannot be read now (${block.reason}), so the recorded reading cannot ` +
        "be checked against what would be pushed. Pass --despite-review to publish anyway."
      );
    default:
      return (
        `the reading was taken over ${block.readTip} and this would push ` +
        `${block.nowTip}, so it does not describe the work any more. Read it again, or ` +
        "pass --despite-review to publish anyway."
      );
  }
}

async function commandAnswer(
  parsed: ParsedCommand,
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  ports: ReturnType<typeof conductorPorts>,
  continuo: VerifiedContinuo,
): Promise<number> {
  const chosen = await pickWaiting(store, parsed.iterationId);
  if ("refusal" in chosen) {
    return refuse(chosen.refusal);
  }
  if (chosen.record === null) {
    say(chosen.note);
    return 0;
  }
  const record = chosen.record;
  // **A terminal row is refused before its gate is read** (`D-0023` rule 15).
  // `pickWaiting` applies no status filter on purpose, because `publish` acts
  // on `closed` rows and has to be able to name one -- but `answer` must not
  // inherit that latitude. `abandon` writes a terminal row and deliberately
  // drives no continuo verb, so an abandoned iteration usually still has an
  // open gate on it; answering that gate would close a run whose iteration a
  // person has already ended, and would record a human answer against work
  // rondo had given up on. Before D-0023 this was unreachable because there was
  // no `--iteration-id` on `answer` at all.
  if (isTerminal(record.status)) {
    return refuse(
      `iteration '${record.id}' is ${record.status}, which is terminal, so there is nothing ` +
        "left to answer. Its gate may still be open -- closing that is a person's, through " +
        "'gate close' on the operating surface (D-0013).",
    );
  }
  if (record.gateId === null) {
    say(`iteration '${record.id}' is ${record.status}, and no gate is open on it.`);
    say("There is nothing for a person to answer yet.");
    return 0;
  }

  const observed = await showGate(continuo, { db: planField(record, "db"), gateId: record.gateId });
  if (observed.kind !== "answered") {
    return relayFailure("gate show", observed);
  }
  const gate = observed.payload;

  // **`--verified` without `--body` is refused rather than read past.** The
  // reading mode answers nothing, so there is no act for a claim to go before
  // and nothing would be written -- and a flag that reads as though it did
  // something is worse than one that is rejected, which is the rule
  // `parseCommand` already states about every flag rondo takes. Silently
  // dropping it would leave an operator believing the record holds what they
  // checked, and `publish` saying nobody recorded anything.
  if (parsed.verified !== null && parsed.body === null) {
    return refuse(
      "--verified says what you checked before answering, and without --body nothing is being " +
        "answered, so there is nothing to record it against. Give both, or neither.",
    );
  }
  if (parsed.body === null) {
    // The reading mode: what is being asked, and the command that answers it.
    say(`iteration '${record.id}' is ${record.status}`);
    say(`run     ${record.runId ?? "(none recorded)"}`);
    // **Where a person meets the lineage** (D-0030 rule 4). A revision's work
    // is the predecessor's plus a delta, so "what am I looking at" has a
    // different answer for a second lap than for a first -- and before the
    // column the only way to learn it here was to notice that the base branch
    // looked like somebody's topic branch. Printed only when there is one, so
    // an ordinary lap's screen is unchanged.
    if (record.supersedesIterationId !== null) {
      say(`revises ${record.supersedesIterationId}`);
    }
    // Where provenance is shown (D-0061 rule 4), on the same terms.
    if (record.requestMessageId !== null) {
      say(`request ${record.requestMessageId}`);
    }
    say(`gate    ${gate.gateId}  (${gate.gateType})  stage '${gate.stage}'`);
    sayLegible(`why     ${gate.rationale}`);
    say(`options ${gate.options}`);
    // **`why` is the worker's account of its own work; what follows is not.**
    // The two are printed adjacently on purpose, so that a person can see which
    // of them is the graded party speaking (D-0029 rule 2).
    await sayLapMaterial(store, record, continuo);
    say("");
    say("to answer:");
    // **The id is always printed, not only when several are open.** A command
    // that is correct today and refused tomorrow -- because somebody started a
    // second iteration in between -- is worse than one that is always explicit,
    // and since D-0023 "the live one" stops naming anything the moment a second
    // iteration is admitted.
    say(`  rondo answer --iteration-id ${record.id} --actor-id YOU --body="your answer"`);
    return 0;
  }

  const actor = approvedActor(parsed.actorId, environment);
  if ("refusal" in actor) {
    return refuse(actor.refusal);
  }
  if (parsed.body === "") {
    return refuse(
      "--body is empty. An answer is carried byte for byte, and there is nothing to carry.",
    );
  }
  if (parsed.verified === "") {
    return refuse(
      "--verified is empty. It records what you checked, and an empty claim would put a row " +
        "in the ledger saying a verification was declared and not saying what it was. Leave " +
        "the flag off if you did not run anything.",
    );
  }

  say(`gate ${gate.gateId} is at stage '${gate.stage}'`);
  // **A receipt, and the code says so because the difference matters.** The
  // answer is already typed and `walkGate` below takes no further input, so
  // this cannot inform the decision the way the reading path's copy does. What
  // it does is leave the person holding a record of what they approved over.
  await sayLapMaterial(store, record, continuo);
  // **The claim is written before the gate is walked, and a write that fails
  // stops the answer** -- `D-0042` rule 3's order, for its reason: a record
  // written after the act it describes is one an operator can act past. It is
  // recorded as the operator's own account and never as rondo's: rondo did not
  // run this and has no way to check it, so the row holds who said it and what
  // they said, and every reader of it says whose word it is (#70).
  //
  // **Not on a gate that is already closed.** `walkGate` sends nothing for one
  // of those and says so, so a claim written here would sit on the row saying a
  // person checked the work before answering a gate they did not answer -- the
  // exact false attribution this record exists to make impossible. The gate
  // rondo already read is what decides it, and the answer is said out loud
  // rather than dropped.
  if (parsed.verified !== null && gate.outcome !== null) {
    say(
      `Gate ${gate.gateId} is already closed as '${gate.outcome}', so what you said you ` +
        "verified was not recorded: nothing here is being answered.",
    );
  } else if (parsed.verified !== null) {
    try {
      await store.recordVerificationClaim(record.id, actor.actorId, parsed.verified, Date.now());
    } catch (error) {
      return refuse(
        `what you said you verified was not recorded, so nothing was answered: ${
          hostFailure(error).text
        }`,
      );
    }
  }
  const walked = await walkGate(continuo, {
    db: planField(record, "db"),
    gateId: gate.gateId,
    destinationDir: planField(record, "endpoint_destination_dir"),
    holder: planField(record, "lease_claimant_id"),
    actorId: actor.actorId,
    body: parsed.body,
    recordAnswer: answerRecorder(store, record.id, gate.gateId, "approve", actor.actorId),
  });
  if (walked.kind === "failed") {
    return walked.status;
  }

  // `resume` is what moves rondo's own row. It is idempotent by construction,
  // so a walk that half-failed and was retried settles here exactly once.
  const report = await resume(ports, record.id);
  sayReport(report);
  if (report.status === "awaiting_human") {
    // **One model round per tip** (D-0065 4.1). Answering a gate that resumes
    // into another gate over the same commits would otherwise hand the same
    // bytes to the reviewer again and append a second round nobody asked for.
    await sayGateOpen(
      modelReadingDue(await store.readingsFor(record.id))
        ? () => takeModelReading(modelReviewPorts(continuo, store, ports.thread ?? null), record.id)
        : null,
    );
  }
  if (report.status === "closed") {
    say("");
    // The id is spelled out because closing the iteration is what stops it
    // being the live one, so `publish` can no longer find it on its own. A
    // hint the operator cannot paste is not a hint.
    // **And `--repo` only where this lap needs one** (D-0081 rule 3.2): a plan
    // that records the repository is published without it, and printing it
    // anyway would teach a flag that is now the exception rather than the way.
    const named = planField(record, "forge_repository") === "" ? " --repo OWNER/NAME" : "";
    say(`Next: rondo publish --iteration-id ${record.id} --actor-id ${actor.actorId}${named}`);
  }
  return 0;
}

/**
 * Everything a person is shown before they may press: the question, then the work.
 *
 * **The gate's own words come first, and they are not in rondo's store.** The
 * rationale is the worker's account of why it stopped, and the options are what
 * it was asked -- `commandAnswer`'s reading mode prints both above the material,
 * and a page offering approval without them would be offering approval of a
 * question nobody read. Only continuo has them, so this reads one `gate show`.
 *
 * **A continuo that will not start is a line and never a refusal**, which is
 * `inspectLapWork`'s treatment of an unreadable workspace and the same argument:
 * `web` is dispatched ahead of `startContinuo` so that the screen saying what is
 * stuck stays reachable when continuo is one of the stuck things, and a render
 * that threw on it would undo that. What the person loses is the question, and
 * they are told that is what they lost -- so a press on a page that says the
 * question could not be read is a press made knowingly.
 *
 * ponytail: one `gate show` per open gate per redraw, which at five seconds is a
 * subprocess every five seconds for each row with a button. Acceptable while the
 * host has one operator and a handful of live laps; the upgrade is a rondo-side
 * column holding the question, written when the row reaches `awaiting_human`.
 */
async function pageMaterial(
  wording: Chrome,
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  record: IterationRecord,
): Promise<LapMaterialRead> {
  const lines: string[] = [];
  let why: string | null = null;
  const startup = await startContinuo(environment);
  if (startup.kind === "refused") {
    lines.push("why     the gate question could not be read: continuo is not usable");
    lines.push(`        ${startup.reason}`);
  } else if (record.gateId !== null) {
    const observed = await showGate(startup.continuo, {
      db: planField(record, "db"),
      gateId: record.gateId,
    });
    if (observed.kind === "answered") {
      const gate = observed.payload;
      lines.push(`gate    ${gate.gateId}  (${gate.gateType})  stage '${gate.stage}'`);
      // Not `legibleAsciiEscape`d: that exists because a cp932 console may not
      // encode what a worker wrote, and a browser has no such problem. The
      // paragraphs survive, which is rondo#90 on the path that matters most.
      lines.push(`why     ${gate.rationale}`);
      why = gate.rationale;
      lines.push(`options ${String(gate.options)}`);
    } else {
      lines.push(`why     the gate question could not be read (${observed.kind})`);
    }
  }
  const material = await lapMaterial(
    wording,
    store,
    record,
    startup.kind === "refused" ? null : startup.continuo,
  );
  return {
    lines: [...lines, ...material.lines],
    why,
    work: material.work,
    // **The gate's comparison, on the screen the press is on** (rondo#294).
    // It is the same read the conductor takes when the lap reaches its gate,
    // taken again here rather than carried from there: the report's lines are
    // printed and gone, and a person who never opened a terminal has to be
    // able to see what the comparison found before they approve. It writes
    // nothing, here as there.
    reach: pageReach(await compareClaim({ store, readChangedPaths }, record.id)),
  };
}

/**
 * The comparison as the screen may draw it: the paths, and no line named
 * ({@link ClaimReach}).
 *
 * The holders are flattened into one list of paths. Which other work keeps
 * them is a thing to say and is said by its request rather than by its
 * identifier, which this screen has no reader for; rondo#285 is where the page
 * learns to name it.
 */
export function pageReach(comparison: ClaimComparison): ClaimReach {
  if (comparison.kind !== "outside") {
    return comparison.kind === "inside"
      ? { kind: "inside" }
      : { kind: "unread", reason: comparison.reason };
  }
  return {
    kind: "outside",
    // Deduplicated: one path may be kept by two other works, and a person
    // reading the list would be told twice about one file.
    collided: [...new Set(comparison.held.flatMap((holder) => holder.sharedPaths))],
    unheld: comparison.unheld,
  };
}

/**
 * Where a running lap is writing, for the in-flight row of the inbox (D-0048).
 *
 * **The continuo handle is started at most once per look and only if a lap is
 * actually running.** `inbox` and `web` are both dispatched ahead of
 * `startContinuo` so that the screen saying what is stuck stays reachable when
 * continuo is what is stuck, and a port that started one eagerly would undo
 * that; a host with nothing `performing` spawns nothing at all.
 */
export function transcriptPort(
  environment: Readonly<Record<string, string | undefined>>,
): (record: IterationRecord) => Promise<TranscriptLocation> {
  let verified: VerifiedContinuo | null = null;
  return async (record) => {
    const stateRoot = planField(record, "state_root");
    if (stateRoot === "") {
      return { kind: "unknown", reason: "the row's plan names no state root" };
    }
    if (record.runId === null) {
      return { kind: "unknown", reason: "the row names no run" };
    }
    // **The row first, and continuo only for the window where the row is
    // empty** (D-0048 rule 6). A row that already carries a session needs no
    // subprocess to name its directory, and asking anyway would spend one to
    // learn what rondo wrote down itself.
    if (record.sessionId !== null) {
      return {
        kind: "named",
        directory: lapTranscriptDirectory({
          stateRoot,
          runId: record.runId,
          sessionId: record.sessionId,
        }),
        sessions: 1,
      };
    }
    // **A working handle is remembered and a refusal is not.** The page is the
    // caller that lives: it is built once and redraws itself every few seconds,
    // so a startup cached after it failed would keep saying "continuo is not
    // usable" long after continuo came back -- a stale answer on the one
    // surface D-0048 rule 4's "read at render time" has to keep honest. The
    // retry costs a `--version` per running lap while continuo is down, which
    // is the same bound rule 6 already accepts and is paid only when the answer
    // is unknown anyway.
    if (verified === null) {
      const startup = await startContinuo(environment);
      if (startup.kind === "refused") {
        return { kind: "unknown", reason: `continuo is not usable here: ${startup.reason}` };
      }
      verified = startup.continuo;
    }
    const observed = await showRun(verified, {
      db: planField(record, "db"),
      runId: record.runId,
    });
    if (observed.kind !== "answered") {
      return {
        kind: "unknown",
        reason: `run ${record.runId} could not be read (${observed.kind})`,
      };
    }
    const sessions = observed.payload.sessions;
    // **Newest by `bound_at_ms`, and nothing filtered on `released_at_ms`**
    // (D-0048 rule 8): that column is one continuo writes nowhere, so a filter
    // over it would quietly be no filter at all.
    const newest = sessions.reduce<ObservedSession | null>(
      (best, session) => (best === null || session.boundAtMs > best.boundAtMs ? session : best),
      null,
    );
    if (newest === null) {
      return { kind: "unknown", reason: `continuo holds no session for run ${record.runId} yet` };
    }
    return {
      kind: "named",
      directory: lapTranscriptDirectory({
        stateRoot,
        runId: record.runId,
        sessionId: newest.sessionId,
      }),
      sessions: sessions.length,
    };
  };
}

/**
 * The framing a press rests on, recorded before the press is acted on (D-0042).
 *
 * **It is `explain`'s own writer and not a second one.** The page composed its
 * claims with `propose`, which is what {@link explainIteration} composes; a
 * second path to the same rows would be two things to keep agreeing. What
 * differs is only where the lines go: the page rendered them up to five seconds
 * ago, so `present` drops them here rather than printing a copy to the terminal
 * `rondo web` happens to be running in.
 *
 * **The press is what makes it a presentation** (D-0042 rule 1). An unattended
 * redraw reaches none of this -- it is a `GET`, and only the `POST` path a
 * person's click produces gets here -- so `operator_attention` counts a row for
 * a human who pressed and never for a page redrawing at an empty desk.
 *
 * **A framing recorded and not counted does not withhold the gate.** That is
 * `sayAdvisoryOutcome`'s treatment of the same outcome -- the record is kept and
 * what was shown still stands -- differing only in where the complaint goes: a
 * command exits **1**, and a person at a browser cannot read an exit status, so
 * the line is said in the terminal `rondo web` runs in, beside the other two
 * things this surface already says there (`walkGate`'s diagnostics and
 * `sayReport`). Refusing the press instead would stop an operator answering a
 * gate over rondo's own accounting, which is a worse failure than an
 * under-counted table (D-0032 rule 10).
 */
export async function recordPagePress(
  ports: ExplainPorts,
  iterationId: string,
  complain: (line: string) => void = say,
): Promise<{ ok: boolean; note: string }> {
  const shown = await explainIteration(ports, iterationId);
  if (shown.kind === "refused") {
    return {
      ok: false,
      // `explainIteration`'s own reason ends with why this matters, so this
      // adds the half it cannot know: on a page the framing was shown before
      // the press, and what the failure costs is the *act*, not the showing.
      note: `The framing you pressed on was not recorded, so nothing was answered. ${shown.reason}`,
    };
  }
  if (shown.kind === "presentedUncounted") {
    complain(
      `proposal '${shown.proposalId}' was recorded and not counted as presented: ` +
        `${shown.reason}. The press went through; operator_attention is short by one row.`,
    );
  }
  return { ok: true, note: "" };
}

/**
 * Record what the person pressing says they verified, then walk the gate.
 *
 * **`commandAnswer --verified`'s order, as one function a test can drive**
 * (`D-0045` rules 4 and 5, carried to the page by its rondo#220 annotation).
 * The claim is written before the walk, and a write that fails walks nothing:
 * `D-0042` rule 3's order, because a record written after the act it describes
 * is one a person can act past. It is the operator's own account and never
 * rondo's, so the row holds who said it and what they said.
 *
 * **Not on a gate that is already closed.** `walkGate` sends nothing for one of
 * those, so a claim written here would say a person checked the work before
 * answering a gate they did not answer. The terminal says so and walks on (the
 * walk then reports the closed gate); a page has no terminal the presser is
 * reading, so here it is a refusal whose note says both halves. The gate is
 * read only when there is a claim, so a press without one walks exactly as it
 * did before this function existed.
 */
export async function claimThenWalk(
  store: Pick<IterationStore, "recordVerificationClaim">,
  continuo: VerifiedContinuo,
  request: WalkRequest,
  iterationId: string,
  claim: string | null,
  verbs: GateVerbs = GATE_VERBS,
  nowMs: () => number = Date.now,
): Promise<
  WalkOutcome | { readonly kind: "refused"; readonly note: string; readonly why: ClaimRefusal }
> {
  if (claim !== null) {
    const observed = await verbs.show(continuo, { db: request.db, gateId: request.gateId });
    if (observed.kind !== "answered") {
      return {
        kind: "refused",
        why: "claimGateUnread",
        note:
          `The gate for '${iterationId}' would not read, so what you said you verified was not ` +
          "recorded and nothing was answered.",
      };
    }
    if (observed.payload.outcome !== null) {
      return {
        kind: "refused",
        why: "claimGateClosed",
        note:
          `Gate ${observed.payload.gateId} is already closed as '${observed.payload.outcome}', ` +
          "so what you said you verified was not recorded: nothing here is being answered.",
      };
    }
    try {
      await store.recordVerificationClaim(iterationId, request.actorId, claim, nowMs());
    } catch (error) {
      // The page's half of this forks and the terminal's does not (rondo#349).
      // A write that failed on an errno is a break only installation repairs,
      // and `claimNotRecorded` tells the presser to go back and try again --
      // advice that is wrong for a store this process may not write. `D-0076`
      // rule 4.3's sentence is the other arm; the reason itself still travels
      // in `note`, which the page keeps out of the person's sentence.
      const failure = hostFailure(error);
      return {
        kind: "refused",
        why: failure.kind === "hostSetup" ? "claimHostSetup" : "claimNotRecorded",
        note: `What you said you verified was not recorded, so nothing was answered: ${failure.text}`,
      };
    }
  }
  return await walkGate(continuo, request, verbs);
}

/**
 * One press of the page's approve button, in the terminal's own verbs.
 *
 * **It is `commandAnswer`'s writing half over a row it did not parse for.**
 * `walkGate` and `resume` are reached here by the same two calls the command
 * line makes, so "the button does what `rondo answer` does" is a property of
 * there being one implementation rather than two that have to keep agreeing
 * (D-0041 rule 7). What differs is only what a screen can do with the answer: a
 * refusal is a sentence handed back to be rendered rather than a line printed
 * and an exit status returned, because the person who pressed the button is
 * looking at a browser and not at this process's stdout.
 *
 * **continuo is started here rather than before the page is served**, and that
 * is `dispatch`'s existing reasoning rather than a new one: `web` is dispatched
 * ahead of `startContinuo` so that a screen which says what is stuck stays
 * reachable when continuo is one of the stuck things. A press is the first
 * moment this surface actually needs a continuo, and a start that fails is a
 * refusal on the page instead of a page that never appeared.
 *
 * Exported so a test can drive it, as the other three presses
 * ({@link startScopedFromPage}, {@link reviseFromPage},
 * {@link publishFromPage}) already are: the success path of this one is only
 * reachable over a real continuo holding a real open gate, and a test that
 * composed `claimThenWalk` and `resume` itself would be the second
 * implementation this function exists to not have (rondo#239).
 */
export async function answerFromPage(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  approver: string,
  iterationId: string,
  body: string,
  claim: string | null,
): Promise<{ ok: boolean; note: string; why?: ClaimRefusal }> {
  const actor = approvedActor(approver, environment);
  if ("refusal" in actor) {
    return { ok: false, note: actor.refusal };
  }
  const found = await store.read(iterationId);
  if (found.kind === "absent") {
    return { ok: false, note: `There is no iteration '${iterationId}'.` };
  }
  if (found.kind === "unreadable") {
    return { ok: false, note: `That iteration row would not read: ${found.reason}` };
  }
  const record = found.record;
  // The same two refusals `commandAnswer` makes, for the same reasons: a
  // terminal row's gate is not this surface's to close (`D-0023` rule 15), and
  // a row with no gate id has nothing for a person to answer. The button is not
  // drawn in either case -- these catch a stale page, which is exactly what a
  // page that redraws itself every five seconds will sometimes be.
  if (isTerminal(record.status)) {
    return {
      ok: false,
      note:
        `iteration '${record.id}' is ${record.status}, which is terminal, so there is nothing ` +
        "left to answer.",
    };
  }
  if (record.gateId === null) {
    return {
      ok: false,
      note: `iteration '${record.id}' is ${record.status}, and no gate is open on it.`,
    };
  }
  // **Written before the press acts on it** (D-0042 rules 2 and 3). Here rather
  // than at the top of this function so that the three refusals above -- which
  // are a stale page rather than a person answering -- do not each put a
  // framing in the ledger that nobody acted on.
  const shown = await recordPagePress(
    advisoryPorts(store, storePath, () => {}),
    iterationId,
  );
  if (!shown.ok) {
    return shown;
  }
  const startup = await startContinuo(environment);
  if (startup.kind === "refused") {
    return { ok: false, note: `continuo is not usable: ${startup.reason}` };
  }
  const continuo = startup.continuo;
  const walked = await claimThenWalk(
    store,
    continuo,
    {
      db: planField(record, "db"),
      gateId: record.gateId,
      destinationDir: planField(record, "endpoint_destination_dir"),
      holder: planField(record, "lease_claimant_id"),
      actorId: actor.actorId,
      body,
      recordAnswer: answerRecorder(store, record.id, record.gateId, "approve", actor.actorId),
    },
    record.id,
    claim,
  );
  if (walked.kind === "refused") {
    return { ok: false, note: walked.note, why: walked.why };
  }
  if (walked.kind === "failed") {
    // The relay's own words went to the terminal `rondo web` is running in --
    // `walkGate` says what it did as it does it, and this surface does not
    // intercept that. Said here rather than silently redirecting, because the
    // page would otherwise redraw showing the same open gate and no reason.
    return {
      ok: false,
      note:
        `The gate walk for '${record.id}' did not finish. The terminal running 'rondo web' has ` +
        "continuo's own diagnosis.",
    };
  }
  const report = await resume(
    conductorPorts(continuo, store, openAdvisoryRecord(storePath)),
    record.id,
  );
  sayReport(report);
  // **A walk that closed the gate and a row that settled are two facts**, and
  // `resume` is total: a gate it cannot observe comes back as a report with
  // diagnostic lines rather than as a throw. Redirecting on that would put the
  // operator back on a page still offering the button, with the answer already
  // spent and nothing saying why -- so the report's own lines are the response.
  if (report.status !== "closed") {
    return {
      ok: false,
      note: [
        `The gate was answered, but iteration '${record.id}' is ` +
          `${report.status ?? "in an unnamed state"} rather than closed.`,
        ...report.lines,
      ].join("\n"),
    };
  }
  return { ok: true, note: `iteration '${record.id}' is closed` };
}

/**
 * One press of the page's record-scope button, in `commandScope`'s own order.
 *
 * `commandScope`'s *write, present, count* (D-0036 rule 1, D-0042 rule 3):
 * `recordScope` -> `readScope` back -> the `recordAttention` presented row ->
 * `recordScopeDecision` with **the digest read back**, never a posted one, so
 * the digest shown and the digest approved are one value by construction
 * (D-0066 rule 2.2). Exported so a test can drive it, as {@link recordPagePress}
 * is.
 *
 * **The plan is read again here and not taken from the form.** It may have
 * changed since the form was drawn, and what is recorded has to be what is on
 * disk at the moment of the write -- so the form carries the two digests it was
 * drawn from and this **compares** the re-read against them (rondo#233 S3 press
 * review). Not a second authority: nothing is written from the posted digests,
 * and a difference writes nothing at all. Without the comparison rule 2.2 held
 * to the letter -- the approval names the row's own digest -- while the person
 * approved a workspace and an agent type they never saw, because the only
 * fields the form does not post are exactly the ones that say where the work
 * may act.
 *
 * **`supersedesScopeId` is null in S3**: superseding a scope is a screen this
 * slice does not draw.
 */
export async function recordScopeFromPage(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  approver: string,
  draft: ScopeFormDraft,
): Promise<ScopeRecorded> {
  const notTaken = (note: string): ScopeRecorded => ({
    ok: false,
    why: "scopeRefusedNotTaken",
    note,
  });
  const actor = approvedActor(approver, environment);
  if ("refusal" in actor) {
    return notTaken(actor.refusal);
  }
  const record = openAdvisoryRecord(storePath);
  // **The plan is read again, from what rondo holds, and compared** (rondo#238,
  // the press review rondo#233 S3 gave the file this replaced): the form carries
  // only the two digests it was drawn with, never a plan, and a plan that is no
  // longer held -- or holds another agent type -- is a refusal.
  const chosen = await heldPlanOf({ store, record }, draft.requestMessageId, draft.planDigest);
  if ("refusal" in chosen) {
    return notTaken(chosen.refusal);
  }
  if (chosen.plan === null || chosen.plan.agentTypeDigest !== draft.agentTypeDigest) {
    return { ok: false, why: "scopeRefusedPlanChanged", note: "the plan is not the one drawn" };
  }
  const plan = chosen.plan;
  const createdAtMs = Date.now();
  const payload = scopePayloadWithDefaults({
    requests: [draft.requestMessageId],
    workspaces: [{ repository: plan.repository, workspace_root: plan.workspaceRoot }],
    agent_types: [plan.agentTypeDigest],
    budgets: { ...draft.budgets },
    severity_threshold: draft.severityThreshold,
    outward_acts: [...draft.outwardActs],
    // **Not editable on this screen** (rondo#233 S3): free-text names into a
    // closed list is what the screen's own axis forbids, so it is always
    // empty and the screen says so.
    irreversible_additions: [],
  } as unknown as JsonRecord);
  const written = await record.recordScope({
    scopeId: draft.scopeId,
    payload,
    supersedesScopeId: null,
    authorKind: "operator",
    authorId: actor.actorId,
    bases: [],
    createdAtMs,
    // D-0069 section 1's operator path: a plan's agent type recorded with the
    // person's scope, a no-op for a digest rondo already holds.
    agentTypeRecords: [
      {
        agentTypeDigest: plan.agentTypeDigest,
        agentTypeInput: plan.agentTypeInput,
        planDigest: plan.planDigest,
      },
    ],
  });
  const stored = await record.readScope(draft.scopeId);
  // **A second press of one form is the write it repeats**, as a repeated
  // `message_id` already is on the send routes: the id was minted when the form
  // was drawn precisely so the store refuses the second row, and the scope the
  // person drafted is there under that id. Any other holder of the id is a
  // refusal like the rest.
  //
  // **And the same id has to be the same scope.** A form returned from the
  // browser's back button carries the id it was drawn with and whatever the
  // person has typed since; the store refuses the row on the id, the approval
  // that is already there is read back, and the screen would say *approved*
  // about numbers that were just replaced (rondo#233 S3 press review). The
  // payload is what is compared, because the id proves only which form this is.
  const ours =
    stored.kind === "read" &&
    stored.scope.authorKind === "operator" &&
    stored.scope.authorId === actor.actorId;
  if (written.kind !== "recorded" && !ours) {
    return notTaken(written.reason);
  }
  if (
    written.kind !== "recorded" &&
    stored.kind === "read" &&
    canonicalJson(stored.scope.payload as unknown as JsonValue) !==
      canonicalJson(payload as unknown as JsonValue)
  ) {
    return { ok: false, why: "scopeRefusedEdited", note: "this form was recorded as it was drawn" };
  }
  if (stored.kind !== "read") {
    return {
      ok: false,
      why: "scopeRefusedNotRead",
      note: `scope '${draft.scopeId}' was recorded and will not read back: ${
        stored.kind === "absent" ? "it is not there" : stored.reason
      }`,
    };
  }
  return await approveStoredScope(record, actor.actorId, stored.scope, createdAtMs);
}

/**
 * What the drafted scope's form posts (D-0071 rule 5.3): the draft it was drawn
 * over, by id and digest, and the values the person may change. The lists --
 * requests, workspaces, agent types -- are never posted: they are the draft's.
 */
export interface DraftedScopeForm {
  readonly draftScopeId: string;
  /** The digest the form was drawn with, compared with the row's (D-0066 rule 2.2). */
  readonly draftDigest: string;
  /** Minted at draw, for the person's own scope when they changed a value. */
  readonly scopeId: string;
  readonly budgets: ScopeBudgets;
  readonly severityThreshold: string;
  readonly outwardActs: readonly ScopeOutwardAct[];
}

/**
 * One press of the drafted scope's form (D-0071 rule 5.3), and the one place
 * that decides which of its two acts the press is:
 *
 * - **the values as drafted**: a `scope_decision` on the drafter's own row;
 * - **any value changed**: a new `operator` scope that supersedes the draft,
 *   with a `scope:` basis to it, and the approval on that row. The values are
 *   the person's because the person submitted them; the draft is kept, and
 *   linked, so nothing composed is stored under the person's voice.
 *
 * Decided by comparing the payload the press would record with the draft's,
 * byte for byte, so which act it was is a fact of the rows and not of a button.
 */
export async function recordDraftedScopeFromPage(
  environment: Readonly<Record<string, string | undefined>>,
  storePath: string,
  approver: string,
  form: DraftedScopeForm,
): Promise<ScopeRecorded> {
  const notTaken = (note: string): ScopeRecorded => ({
    ok: false,
    why: "scopeRefusedNotTaken",
    note,
  });
  const actor = approvedActor(approver, environment);
  if ("refusal" in actor) {
    return notTaken(actor.refusal);
  }
  const record = openAdvisoryRecord(storePath);
  const read = await record.readScope(form.draftScopeId);
  if (read.kind !== "read") {
    return notTaken(
      read.kind === "absent"
        ? `there is no scope '${form.draftScopeId}'`
        : `the scope '${form.draftScopeId}' will not read: ${read.reason}`,
    );
  }
  const drafted = read.scope;
  if (drafted.authorKind !== "drafter" || !isModelDrafterName(drafted.authorId)) {
    return notTaken(`the scope '${form.draftScopeId}' is not a drafted one`);
  }
  if (drafted.scopeDigest !== form.draftDigest) {
    return { ok: false, why: "scopeRefusedPlanChanged", note: "the draft is not the one drawn" };
  }
  const createdAtMs = Date.now();
  const payload = scopePayloadWithDefaults({
    ...(drafted.payload as unknown as JsonRecord),
    budgets: { ...form.budgets },
    severity_threshold: form.severityThreshold,
    outward_acts: [...form.outwardActs],
  } as unknown as JsonRecord);
  if (
    canonicalJson(payload as unknown as JsonValue) ===
    canonicalJson(drafted.payload as unknown as JsonValue)
  ) {
    // **A draft an approved successor retired is not approved again** (D-0066
    // rule 1.4): the store would take the decision, and it could admit nothing
    // -- a start under it would stop at the superseded test and write a stop
    // over the request the person's own scope now covers.
    if (await record.scopeSupersededByApproved(drafted.scopeId)) {
      return {
        ok: false,
        why: "scopeRefusedPlanChanged",
        note: "the draft was replaced by an approved scope",
      };
    }
    return await approveStoredScope(record, actor.actorId, drafted, createdAtMs);
  }
  // An edited press against a draft another approved scope already replaced
  // is refused too -- else two tabs would leave two approved successors with
  // budgets of their own -- unless it is this form's own write, replayed.
  if (
    (await record.readScope(form.scopeId)).kind === "absent" &&
    (await record.scopeSupersededByApproved(drafted.scopeId))
  ) {
    return {
      ok: false,
      why: "scopeRefusedPlanChanged",
      note: "the draft was replaced by an approved scope",
    };
  }
  const written = await record.recordScope({
    scopeId: form.scopeId,
    payload,
    supersedesScopeId: drafted.scopeId,
    authorKind: "operator",
    authorId: actor.actorId,
    bases: [{ form: "scope", scopeId: drafted.scopeId }],
    createdAtMs,
    // The agent types are the draft's, which its own write already recorded.
    agentTypeRecords: [],
  });
  const stored = await record.readScope(form.scopeId);
  // A second press of one form is the write it repeats, as `recordScopeFromPage`
  // reads it: the id is the form's, and the payload has to be the same too.
  const ours =
    stored.kind === "read" &&
    stored.scope.authorKind === "operator" &&
    stored.scope.authorId === actor.actorId &&
    stored.scope.supersedesScopeId === drafted.scopeId;
  if (written.kind !== "recorded" && !ours) {
    return notTaken(written.reason);
  }
  if (stored.kind !== "read") {
    return {
      ok: false,
      why: "scopeRefusedNotRead",
      note: `scope '${form.scopeId}' was recorded and will not read back`,
    };
  }
  if (
    written.kind !== "recorded" &&
    canonicalJson(stored.scope.payload as unknown as JsonValue) !==
      canonicalJson(payload as unknown as JsonValue)
  ) {
    return { ok: false, why: "scopeRefusedEdited", note: "this form was recorded as it was drawn" };
  }
  return await approveStoredScope(record, actor.actorId, stored.scope, createdAtMs);
}

/**
 * One press of the raise form (D-0074 section 4): a successor of the approval
 * the lap at this gate spends, **differing from it only in its budgets**,
 * recorded and approved by the writes a first scope takes -- one scope row with
 * `supersedes_scope_id` set, then its approval -- so a raise is recorded
 * exactly as `recordScopeFromPage` records a first scope.
 *
 * **Everything but the budgets is copied from the stored row, never from the
 * form** (rule 1.1): widening where the work may act is another question, and
 * it keeps going through the full scope screen.
 *
 * **Refused, writing nothing** (rule 4.4): the lap is no longer at a gate; the
 * posted approval is not its line's tip (somebody raised it already); the line
 * has two tips. The store refuses the second approved successor itself (rule
 * 1.3), so two raises drawn over one approval and pressed together leave one.
 * A second press of one form is the write it repeats, as the scope forms' are.
 *
 * **One raise of an approval at a time** (Codex round 1), for
 * `startSplitFromPage`'s reason: two presses over one approval would both pass
 * the tip test before either approved, and the store's refusal of the second
 * approval would come after its scope row was written -- a refusal that wrote
 * something. Run after the first, the second finds the tip moved and writes
 * nothing.
 */
export async function raiseScopeFromPage(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  approver: string,
  input: RaiseInput,
): Promise<ScopeRecorded> {
  const ahead = raising.get(input.scopeDecisionId) ?? Promise.resolve();
  const running = ahead
    .catch(() => undefined)
    .then(() => raiseScope(environment, store, storePath, approver, input));
  raising.set(input.scopeDecisionId, running);
  try {
    return await running;
  } finally {
    if (raising.get(input.scopeDecisionId) === running) {
      raising.delete(input.scopeDecisionId);
    }
  }
}

/** Every raise this process is recording, by the approval it raises. */
const raising = new Map<string, Promise<ScopeRecorded>>();

async function raiseScope(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  approver: string,
  input: RaiseInput,
): Promise<ScopeRecorded> {
  const notTaken = (note: string): ScopeRecorded => ({
    ok: false,
    why: "scopeRefusedNotTaken",
    note,
  });
  const actor = approvedActor(approver, environment);
  if ("refusal" in actor) {
    return notTaken(actor.refusal);
  }
  const found = await store.read(input.iterationId);
  // At its gate, or approved and closed: the conflict fix of rondo#417 starts
  // one more attempt of an approved lap, and its card offers this raise where
  // the budget would refuse that attempt (D-0105, Codex round 1).
  if (
    found.kind !== "read" ||
    (!approvedForPublication(found.record) &&
      (isTerminal(found.record.status) || found.record.gateId === null))
  ) {
    return {
      ok: false,
      why: "raiseRefusedNotAtGate",
      note: `iteration '${input.iterationId}' has no gate open and was not approved`,
    };
  }
  const record = openAdvisoryRecord(storePath);
  const decided = await record.readScopeDecision(input.scopeDecisionId);
  if (decided.kind !== "read" || decided.decision.outcome !== "approved") {
    return notTaken(`'${input.scopeDecisionId}' is not an approval in this store`);
  }
  const read = await record.readScope(decided.decision.scopeId);
  if (read.kind !== "read") {
    return notTaken(`the scope '${decided.decision.scopeId}' will not read`);
  }
  const predecessor = read.scope;
  if (!predecessor.payload.requests.includes(input.requestMessageId)) {
    return notTaken(`the scope '${predecessor.scopeId}' does not list this request`);
  }
  const already = await record.readScope(input.scopeId);
  const ours = (scope: StoredScope): boolean =>
    scope.authorKind === "operator" &&
    scope.authorId === actor.actorId &&
    scope.supersedesScopeId === predecessor.scopeId;
  // Checked against the lap's line, not the form: the approval raised is the
  // one its next act would spend. A replay of this form's own write has moved
  // the tip to that write, and is let through to find it.
  const tip = await approvalTip(record, input.iterationId);
  if (tip.kind === "forked") {
    return {
      ok: false,
      why: "raiseRefusedForked",
      note: `the line has two approved tips, ${tip.scopeDecisionIds.join(" and ")}`,
    };
  }
  if (
    !(already.kind === "read" && ours(already.scope)) &&
    (tip.kind !== "tip" || tip.scopeDecisionId !== input.scopeDecisionId)
  ) {
    return {
      ok: false,
      why: "raiseRefusedNotTip",
      note:
        tip.kind === "tip"
          ? `iteration '${input.iterationId}' now spends '${tip.scopeDecisionId}'`
          : `iteration '${input.iterationId}' was admitted under no approval`,
    };
  }
  const createdAtMs = Date.now();
  const payload = scopePayloadWithDefaults({
    ...(predecessor.payload as unknown as JsonRecord),
    budgets: { ...input.budgets },
  } as unknown as JsonRecord);
  const written = await record.recordScope({
    scopeId: input.scopeId,
    payload,
    supersedesScopeId: predecessor.scopeId,
    authorKind: "operator",
    authorId: actor.actorId,
    bases: [{ form: "scope", scopeId: predecessor.scopeId }],
    createdAtMs,
    // The agent types are the predecessor's, which its own write recorded.
    agentTypeRecords: [],
  });
  const stored = await record.readScope(input.scopeId);
  if (written.kind !== "recorded" && !(stored.kind === "read" && ours(stored.scope))) {
    return notTaken(written.reason);
  }
  if (stored.kind !== "read") {
    return {
      ok: false,
      why: "scopeRefusedNotRead",
      note: `scope '${input.scopeId}' was recorded and will not read back`,
    };
  }
  if (
    written.kind !== "recorded" &&
    canonicalJson(stored.scope.payload as unknown as JsonValue) !==
      canonicalJson(payload as unknown as JsonValue)
  ) {
    return { ok: false, why: "scopeRefusedEdited", note: "this form was recorded as it was drawn" };
  }
  return await approveStoredScope(record, actor.actorId, stored.scope, createdAtMs);
}

/** One press of a drafted plan's start button: which approval, which split, which plan. */
export interface SplitStartInput {
  readonly iterationId: string;
  readonly requestMessageId: string;
  readonly scopeDecisionId: string;
  readonly proposalId: string;
  readonly planIndex: number;
}

/**
 * One press of a drafted plan's start button (rondo#238 C2, D-0063 rule 4):
 * the plan read back from the split proposal row, and admitted under the scope
 * as a lineage start **naming that proposal** (D-0066 rule 3.3).
 *
 * **What the page already said is asked again, and a no is not an act**: a
 * plan that will not run, one a lap already started from, and a host with no
 * room are refused here, before anything is admitted, with the reason the
 * screen gave. The scope's own tests stay `admitUnderScope`'s, which writes
 * D-0066 rule 4.4's stop when they refuse -- a page that drew this button
 * found them passing, so that is a page gone stale, and the stop is the
 * durable record of the line it stops.
 */
export async function startSplitFromPage(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  approver: string,
  policy: HostPolicy,
  input: SplitStartInput,
): Promise<Started> {
  const started = starting.get(input.iterationId);
  if (started !== undefined) {
    return await started;
  }
  // **One plan, one press at a time, whatever form it came from** -- two tabs
  // mint two iteration ids -- so a second press runs after the first reserved
  // its lap and finds it: "already started", not a second lap on one plan.
  const planKey = `${input.requestMessageId}\u0000${input.proposalId}\u0000${String(input.planIndex)}`;
  const ahead = startingPlan.get(planKey) ?? Promise.resolve();
  const running = ahead
    .catch(() => undefined)
    .then(() => startSplit(environment, store, storePath, approver, policy, input));
  starting.set(input.iterationId, running);
  startingPlan.set(planKey, running);
  try {
    return await running;
  } finally {
    starting.delete(input.iterationId);
    if (startingPlan.get(planKey) === running) {
      startingPlan.delete(planKey);
    }
  }
}

/** Why a plan waiting on an earlier plan of its split is not started (D-0098 rule 1). */
function orderedNote(ready: Extract<DraftedStartReadiness, { kind: "ordered" }>): string {
  const plan = `plan ${String(ready.after)} of this split`;
  if (ready.first === null) {
    return `this plan waits until ${plan} has started and landed`;
  }
  return ready.first.state === "endedUnlanded"
    ? `this plan waits on ${plan} (line ${ready.first.lineageId}), which ended without landing; ` +
        "it does not start until that work lands"
    : `this plan waits until ${plan} (line ${ready.first.lineageId}) has landed; it then starts by itself`;
}

/** Every drafted plan this process is starting, by request, proposal and plan. */
const startingPlan = new Map<string, Promise<Started>>();

async function startSplit(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  approver: string,
  policy: HostPolicy,
  input: SplitStartInput,
): Promise<Started> {
  const actor = approvedActor(approver, environment);
  if ("refusal" in actor) {
    return { ok: false, why: "startRefusedNotAdmitted", note: actor.refusal };
  }
  // A second submit of one form is the lap it already started (`startScoped`).
  const already = await store.read(input.iterationId);
  if (already.kind === "read") {
    return { ok: true, note: `iteration '${input.iterationId}' was already admitted` };
  }
  if (already.kind === "unreadable") {
    return {
      ok: false,
      why: "startRefusedNotAdmitted",
      note: `a row for iteration '${input.iterationId}' is already there and will not read: ${already.reason}`,
    };
  }
  const record = openAdvisoryRecord(storePath);
  const ready = await draftedStartReadiness(
    { store, record, policy, nowMs: Date.now() },
    input.requestMessageId,
    input.scopeDecisionId,
    input.proposalId,
    input.planIndex,
  );
  switch (ready.kind) {
    case "unrunnable":
      return { ok: false, why: "startRefusedNoPlan", note: ready.reason };
    case "started":
      return {
        ok: false,
        why: "startRefusedNotAdmitted",
        note: `iteration '${ready.iterationId}' already started from this plan`,
      };
    // D-0098 rule 1: nothing admits `then` before `first` has landed, whether
    // pressed or ticked. No press lifts an order (rule 1.5 is the person's P3).
    case "ordered":
      return { ok: false, why: "startRefusedNotAdmitted", note: orderedNote(ready) };
    case "busy":
    case "full":
      return {
        ok: false,
        why: "startRefusedNotAdmitted",
        note: `this host has no room for another lap (${ready.kind})`,
      };
    case "outside":
    case "undecidable":
    // Held files are attempted too: the attempt is where a holding line's
    // landing is read (D-0073 rule 7), and `reserve()` refuses what still holds.
    case "held":
    case "ready": {
      const run = await draftedPlanRun(
        { record },
        input.requestMessageId,
        input.proposalId,
        input.planIndex,
      );
      if (run.kind !== "runnable") {
        return { ok: false, why: "startRefusedNoPlan", note: run.reason };
      }
      // Read again beside the plan it admits (the readiness above may be a
      // `outside` that says nothing of the order): `first`'s landing is a basis
      // of the admission and named in its prompt (D-0098 rule 1.6).
      const order = await planOrder(
        { store, record },
        input.requestMessageId,
        input.proposalId,
        run,
      );
      if (order.kind === "waiting") {
        return {
          ok: false,
          why: "startRefusedNotAdmitted",
          note: orderedNote({ kind: "ordered", after: order.after, first: order.first }),
        };
      }
      const admitted = order.kind === "landed" ? onLanding(run, order.landing) : run;
      return await admitScopedPlan(
        environment,
        store,
        storePath,
        record,
        input,
        admitted.plan,
        input.proposalId,
        admitted.claim,
        run.split.entries ?? 0,
      );
    }
  }
}

/**
 * Count one scope row as presented and approve it, with the digest read back
 * off the row and never posted (D-0066 rule 2.2, D-0042 rule 3): the tail a
 * person's own scope and a drafted one share.
 */
async function approveStoredScope(
  record: AdvisoryRecord,
  actorId: string,
  scope: StoredScope,
  createdAtMs: number,
): Promise<ScopeRecorded> {
  const counted = await record.recordAttention({
    atMs: createdAtMs,
    subjectKind: "scope",
    subjectId: scope.scopeId,
    disposition: "presented",
    ruleName: null,
  });
  if (counted.kind !== "recorded") {
    return { ok: false, why: "scopeRefusedNotShown", note: counted.reason };
  }
  const decidedAtMs = Date.now();
  const scopeDecisionId = `scope-decision-${scope.scopeId}-${String(decidedAtMs)}`;
  const decided = await record.recordScopeDecision({
    scopeDecisionId,
    scopeId: scope.scopeId,
    // **Read back off the row, never posted.** D-0066 rule 2.2 asks that what
    // is approved is what was shown; here that is true by construction rather
    // than by a person copying a line.
    scopeDigest: scope.scopeDigest,
    outcome: "approved",
    actorId: actorId,
    // `recorded_by` and `actor_id` are two facts, and this surface is not the
    // approver (D-0032's own reason for the two columns).
    recordedBy: OPERATOR_PAGE_SURFACE,
    decidedAtMs,
  });
  if (decided.kind !== "recorded") {
    // The writer refuses a second decision on one row (rule 2.3). When the
    // approval this press repeats is already there, the screen goes to it
    // exactly as a first press would.
    const already = await record.scopeDecisionOf(scope.scopeId);
    return already.kind === "read" && already.decision.outcome === "approved"
      ? { ok: true, note: "", scopeDecisionId: already.decision.scopeDecisionId }
      : { ok: false, why: "scopeRefusedNotApproved", note: decided.reason };
  }
  return { ok: true, note: "", scopeDecisionId };
}

/**
 * One press of the page's scoped-start button: `commandStart`'s
 * `--scope-decision-id` branch, over a plan whose prompt is the request's body.
 *
 * **The prompt is the request message's words, byte for byte**, read out of the
 * store here -- the rule `--prompt-file` runs under, not trimmed. A posted
 * prompt would be a second authority for what the person asked for.
 *
 * continuo is started here rather than before the page is served, which is
 * {@link answerFromPage}'s reasoning and not a new one.
 */
export async function startScopedFromPage(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  approver: string,
  input: ScopedStartInput,
): Promise<Started> {
  // **Two presses of one form are one start, even when they overlap** (rondo#233
  // S3, Codex round 3). The row check below closes the replay that arrives after
  // the first start finished; it cannot close the one that arrives while it is
  // still running, because both reads say the row is absent and both then go on
  // to `startContinuo`. The second would reach `admitUnderScope` after the first
  // reserved its lap -- against a budget that lap has just spent -- and a
  // refused test writes the asking message that stops the request (D-0066 rule
  // 4.4). So the id is held here for as long as a start under it is in flight,
  // and a second press joins the first rather than starting anything.
  //
  // **One process's map, which is all this page is.** The store's write lock is
  // what orders two *processes*; this orders the one process that serves the
  // button, which is where a double click arrives.
  const started = starting.get(input.iterationId);
  if (started !== undefined) {
    return await started;
  }
  const running = startScoped(environment, store, storePath, approver, input);
  starting.set(input.iterationId, running);
  try {
    return await running;
  } finally {
    starting.delete(input.iterationId);
  }
}

/** Every scoped start this process has in flight, by iteration id. */
const starting = new Map<string, Promise<Started>>();

/**
 * **A start press answers once its lap's row is there, not once the lap is at
 * its gate** (rondo#409, D-0109). `running` is the whole start -- the lap runs
 * inside it for as long as it takes to reach its gate -- and the page's press
 * used to wait for all of it, which in lap 12 was a tab loading for tens of
 * minutes. The row is what the list and the thread draw a running lap from, so
 * from the moment it exists the page shows the work by its own means.
 *
 * **Everything that refuses before the row still answers the press**: no row
 * is written until `reserve()`, so a refusal is the start ending before the
 * row appears, and the press waits for it and says it as it always has.
 *
 * **What ends badly after the press has answered is written where a person
 * looks** (rule 3): an asking message in the request's thread, which the tab's
 * *your turn* and the host's notification both count as a wait. Its id is the
 * lap's, so a second press joined to the first writes it once.
 */
export async function answerOnceReserved(
  store: Pick<IterationStore, "read" | "transition">,
  record: Pick<AdvisoryRecord, "recordThreadMessage">,
  /** The person's own words, as this host resolved them (D-0079). */
  words: Chrome,
  input: { readonly iterationId: string; readonly requestMessageId: string },
  running: Promise<Started>,
  pollMs = 250,
): Promise<Started> {
  let over = false;
  const ended = running
    .catch((error: unknown): Started => {
      const note = `lap '${input.iterationId}': rondo stopped with an error: ${error instanceof Error ? error.message : String(error)}`;
      // The refusal screen says only that nothing started; the words go where
      // the terminal `rondo web` runs in has always had them.
      consoleSeams.writeError(`${asciiEscape(note)}\n`);
      return { ok: false, why: "startRefusedNotAdmitted", note };
    })
    .finally(() => {
      over = true;
    });
  // ponytail: polls the row every `pollMs`; a hook in `reserve()` if a quarter second matters.
  while (!over) {
    const row = await store.read(input.iterationId).catch(() => null);
    if (row?.kind === "read" && !over) {
      void ended.then(async (late) => {
        if (!late.ok) {
          await stopTheLeftLap(store, record, words, input, late.note, true);
        }
      });
      return { ok: true, note: `iteration '${input.iterationId}' was admitted and is running` };
    }
    await Promise.race([ended, new Promise((resolve) => setTimeout(resolve, pollMs).unref())]);
  }
  // **The start may have reserved its row and then thrown between two polls**
  // (Codex): the press has not answered, so the refusal below says so and no
  // ask is written -- but the row is there, and nothing is driving it, so it is
  // ended here exactly as one the press had already answered for.
  const late = await ended;
  if (!late.ok) {
    await stopTheLeftLap(store, record, words, input, late.note, false);
  }
  return late;
}

/** The statuses a lap passes through before its gate opens (`IterationStatus`). */
const BEFORE_THE_GATE: ReadonlySet<string> = new Set([
  "planned",
  "classified",
  "admitting",
  "admitted",
  "performing",
]);

/**
 * D-0109 rule 3: a lap left behind by a start that threw -- ended at `failed`,
 * and, when the press has already answered, one ask in the request's thread in
 * the person's own words.
 *
 * **The row is ended before the person is told**, so that what the ask says is
 * true when they read it: nothing of the lap is running, and its place on the
 * host, its held money and its line's paths are back. **And it is told only
 * when it is true**: `endFaulted` answers a report rather than throwing when
 * the row will not decode, when this process is still driving it, or when the
 * store refused the write, and inviting somebody to start again over a lap that
 * is still holding everything would be the page lying about its own state. That
 * case says so instead, in the person's words, and asks them to look.
 *
 * rondo's own sentence for what went wrong goes on that row and on this
 * console, and never in front of the person (D-0076 rule 4.2).
 */
async function stopTheLeftLap(
  store: Pick<IterationStore, "read" | "transition">,
  record: Pick<AdvisoryRecord, "recordThreadMessage">,
  words: Chrome,
  input: { readonly iterationId: string; readonly requestMessageId: string },
  note: string,
  /** Whether the press has already answered, so the person needs the thread to tell them. */
  answered: boolean,
): Promise<void> {
  const onConsole = (line: string) => consoleSeams.writeError(`${asciiEscape(line)}\n`);
  try {
    // A lap past its pre-gate statuses failed only in the model reading taken
    // once its gate opened -- a gate it may already have been answered at: the
    // gate is the wait, and a stop would say otherwise.
    const row = await store.read(input.iterationId).catch(() => null);
    if (row === null || (row.kind === "read" && !BEFORE_THE_GATE.has(row.record.status))) {
      onConsole(`lap '${input.iterationId}': after it reached its gate: ${note}`);
      return;
    }
    if (row.kind === "absent") {
      onConsole(`lap '${input.iterationId}' was never reserved: ${note}`);
      return;
    }
    const ended = await endFaulted({ store, now: Date.now }, input.iterationId, note);
    onConsole(`lap '${input.iterationId}' was left by its start: ${note}`);
    for (const line of ended.lines) {
      onConsole(line);
    }
    if (!answered) {
      // The press is still holding the refusal screen, which says it all.
      return;
    }
    const outcome = await record.recordThreadMessage({
      messageId: `start-stopped-${input.iterationId}`,
      body: ended.status === "failed" ? words.startStoppedSaid : words.startStoppedHeldSaid,
      authorKind: "drafter",
      authorId: DETERMINISTIC_DRAFTER,
      inReplyTo: input.requestMessageId,
      atMs: Date.now(),
      bases: [
        { form: "message", messageId: input.requestMessageId },
        { form: "iteration", iterationId: input.iterationId },
      ],
      asks: true,
    });
    if (outcome.kind !== "recorded") {
      onConsole(
        `rondo could not tell the person that lap '${input.iterationId}' stopped: ${outcome.reason}`,
      );
    }
  } catch (error: unknown) {
    onConsole(
      `rondo could not tell the person that lap '${input.iterationId}' stopped: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * One press of the page's *ask for a change* button: the gate answered with the
 * person's words, and the second lap run under the approval the first ran under
 * (rondo#233 S4, D-0070).
 *
 * **It is `commandRevise`'s scoped arm over a row it did not parse for**, the
 * way `answerFromPage` is `commandAnswer`'s writing half: the preflight is
 * literally the same function ({@link revisionPreflight}), and the walk, the
 * settlement and the admission are the same calls in the same order, with
 * `admitUnderScope` running the walk between the verdict and the admission
 * (D-0070 section 2). What differs is only what a screen can do with a refusal.
 *
 * **Two presses of one form are one revise, even when they overlap**, for
 * `startScopedFromPage`'s reason and more sharply: the second would walk a gate
 * the first is walking. The successor's id is minted per draw, so it is the key
 * a double click arrives under.
 *
 * **But only when the second press carries the same words** (Codex round 3).
 * A person can reach the same form again -- the browser's Back button -- edit
 * what to change and press, and the id it carries is still the one minted for
 * that draw. Joining the press already running would answer *sent* over words
 * that were never sent, which is the failure this whole screen exists not to
 * have. So a second press with different words is refused instead, and the
 * refusal says the first one is still running.
 */
export async function reviseFromPage(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  approver: string,
  input: ReviseInput,
): Promise<Revised> {
  const already = revising.get(input.successorId);
  if (already !== undefined) {
    return already.body === input.body
      ? await already.running
      : {
          ok: false,
          why: "reviseRefusedStillRunning",
          note:
            `a revise of '${input.iterationId}' as '${input.successorId}' is already running, ` +
            "and it carries other words",
        };
  }
  const running = revisePage(environment, store, storePath, approver, input);
  revising.set(input.successorId, { running, body: input.body });
  try {
    return await running;
  } finally {
    revising.delete(input.successorId);
  }
}

/**
 * One press of the page's *resolve the conflict* button (rondo#417, D-0105):
 * the lap whose approved and published pull request now conflicts with its
 * base is followed by one more attempt that brings the base in and settles
 * the conflict, and that attempt stops at its gate like any other.
 *
 * **A revise with no gate and no words.** The lap it follows is `closed` and
 * approved, so there is no gate to walk and nothing is answered; the person's
 * press is the whole of what asks, and the prompt says so in rondo's words
 * (`revisionPlan` with a null instruction). Everything else is the revise
 * press's: the approval tip the lap ran under is the one spent, the verdict is
 * the scope's `redo` arm (D-0070), and the successor's refusals that cost
 * nothing are `successorChecks`.
 *
 * **What is offered is asked again here** (`conflictFixBlock` over fresh
 * rows), as the merge press asks `mergeBlock`: a card left on a screen that
 * has since moved starts nothing. A double press of one card names one
 * successor, so the second finds its row and is the first.
 */
export async function conflictFixFromPage(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  approver: string,
  input: ConflictFixInput,
): Promise<ConflictFixed> {
  const already = fixing.get(input.successorId);
  if (already !== undefined) {
    return await already;
  }
  const running = conflictFixPage(environment, store, storePath, approver, input);
  fixing.set(input.successorId, running);
  try {
    return await running;
  } finally {
    fixing.delete(input.successorId);
  }
}

/** Every conflict-fix press this process has in flight, by the successor's id. */
const fixing = new Map<string, Promise<ConflictFixed>>();

async function conflictFixPage(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  approver: string,
  input: ConflictFixInput,
): Promise<ConflictFixed> {
  const actor = approvedActor(approver, environment);
  if ("refusal" in actor) {
    return { ok: false, why: "conflictFixRefusedNotStarted", note: actor.refusal };
  }
  const successorRow = await store.read(input.successorId);
  if (successorRow.kind === "read") {
    return { ok: true, note: `iteration '${input.successorId}' was already admitted` };
  }
  const found = await store.read(input.iterationId);
  if (found.kind !== "read") {
    return {
      ok: false,
      why: "conflictFixRefusedGone",
      note:
        found.kind === "absent"
          ? `There is no iteration '${input.iterationId}'.`
          : `That iteration row would not read: ${found.reason}`,
    };
  }
  const record = found.record;
  const advisory = openAdvisoryRecord(storePath);
  const read = await advisory.threadMessages();
  if (read.kind !== "read") {
    return {
      ok: false,
      why: "conflictFixRefusedGone",
      note: `the request thread did not read: ${read.reason}`,
    };
  }
  const threads = threadsOf(read.messages, new Set(), new Map());
  const line = await store.laneLine(record.id);
  const gated = (await store.readLive()).some(
    (live) =>
      live.kind === "read" &&
      live.record.status === "awaiting_human" &&
      live.record.requestMessageId === record.requestMessageId,
  );
  const block = !approvedForPublication(record)
    ? "notConflicting"
    : conflictFixBlock(resultOf(threads.byId, record.id), {
        // A gate waiting, or a question about this line (D-0105); a question
        // about the request as a whole does not withhold the fix.
        asksWaiting:
          gated ||
          asksOverLine(
            threads,
            record.requestMessageId,
            line.kind === "read" ? line.line.laps.map((lap) => lap.id) : [record.id],
          ),
        holding: (await store.laneLedger()).some(
          (one) => one.releasedBy === null && one.lapIds.includes(record.id),
        ),
        succeeded:
          line.kind !== "read" ||
          line.line.laps.some((lap) => lap.supersedesIterationId === record.id),
      });
  if (block !== null) {
    return {
      ok: false,
      why: "conflictFixRefusedGone",
      note: `resolving the conflict is not offered on '${record.id}': ${block}`,
    };
  }
  // The approval the lap ran under, re-read and only compared with the form's,
  // for `revisePage`'s reason (D-0070 section 1.2, D-0074 section 2).
  const tip = await approvalTip(advisory, record.id);
  if (tip.kind === "forked") {
    return {
      ok: false,
      why: "conflictFixRefusedForked",
      note: `iteration '${record.id}' was admitted under a line with two approved tips (D-0074 rule 2.1)`,
    };
  }
  if (tip.kind === "none" || tip.scopeDecisionId !== input.scopeDecisionId) {
    return {
      ok: false,
      why: "conflictFixRefusedNotItsScope",
      note:
        tip.kind === "none"
          ? `iteration '${record.id}' was not admitted under any approval`
          : `iteration '${record.id}' now spends '${tip.scopeDecisionId}', and the press named ` +
            `'${input.scopeDecisionId}'`,
    };
  }
  const startup = await startContinuo(environment);
  if (startup.kind === "refused") {
    return {
      ok: false,
      why: "conflictFixRefusedNoContinuo",
      note: `continuo is not usable: ${startup.reason}`,
    };
  }
  const continuo = startup.continuo;
  // The forge's default branch as it is at this press (D-0105; the one
  // exception to D-0100 rule 4), taken in with cause `conflict`.
  const decided = await revisionTakeIn(record, input.successorId, store, "conflict");
  const successor =
    "refusal" in decided
      ? { kind: "refused" as const, reason: decided.refusal }
      : revisionPlan({
          predecessor: record,
          iterationId: input.successorId,
          instruction: null,
          takeIn: decided.takeIn,
        });
  if (successor.kind === "refused") {
    refuse(successor.reason);
    return { ok: false, why: "conflictFixRefusedNotSetUp", note: successor.reason };
  }
  const checked = await successorChecks(
    record,
    input.successorId,
    successor.plan,
    null,
    store,
    continuo,
  );
  if ("refusal" in checked) {
    refuse(checked.refusal);
    return { ok: false, why: "conflictFixRefusedNotSetUp", note: checked.refusal };
  }
  const ports = conductorPorts(continuo, store, advisory);
  const outcome = await admitUnderScope(
    {
      store,
      record: advisory,
      nowMs: Date.now,
      // No gate to walk: the lap it follows was approved and is closed.
      beforeAdmit: async () => null,
      admit: (plan, id, supersedes, requestMessageId, scopeSpend) =>
        withReservedNumbers(store, checked.numbering, plan, (numbered, numbers) =>
          admit(
            ports,
            unpromptedPorts(store, storePath),
            numbered,
            START_POLICY,
            id,
            supersedes,
            null,
            requestMessageId,
            scopeSpend,
            null,
            numbers,
          ),
        ),
    },
    input.scopeDecisionId,
    {
      kind: "redo",
      iterationId: input.successorId,
      plan: successor.plan,
      predecessorId: record.id,
      requestMessageId: record.requestMessageId,
      closing: false,
    },
  );
  if (outcome.kind === "refused") {
    return {
      ok: false,
      why: "conflictFixRefusedOutside",
      test: outcome.test,
      note: `the ${outcome.verdict} verdict at the ${outcome.test} test: ${outcome.reason}`,
    };
  }
  if (outcome.kind === "halted") {
    return {
      ok: false,
      why: "conflictFixRefusedNotStarted",
      note: `nothing was admitted; the admission stopped with status ${String(outcome.status)}`,
    };
  }
  const report = outcome.report;
  sayReport(report);
  if (report.iterationId === null) {
    return { ok: false, why: "conflictFixRefusedNotStarted", note: report.lines.join("\n") };
  }
  if (report.status === "awaiting_human") {
    await sayGateOpen(() =>
      takeModelReading(
        modelReviewPorts(continuo, store, ports.thread ?? null),
        report.iterationId ?? input.successorId,
      ),
    );
  }
  return { ok: true, note: `iteration '${input.successorId}' was admitted` };
}

/**
 * Every revise press this process has in flight, by the successor's id, with
 * the words it is carrying: a second press of the same form joins the first
 * only when the two say the same thing.
 */
const revising = new Map<string, { running: Promise<Revised>; body: string }>();

async function revisePage(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  approver: string,
  input: ReviseInput,
): Promise<Revised> {
  const actor = approvedActor(approver, environment);
  if ("refusal" in actor) {
    return { ok: false, why: "reviseRefusedNotStarted", note: actor.refusal };
  }
  const found = await store.read(input.iterationId);
  if (found.kind !== "read") {
    return {
      ok: false,
      why: "reviseRefusedGateClosed",
      note:
        found.kind === "absent"
          ? `There is no iteration '${input.iterationId}'.`
          : `That iteration row would not read: ${found.reason}`,
    };
  }
  const record = found.record;
  // `answerFromPage`'s two refusals, for its reasons: a terminal row's gate is
  // not this surface's to close, and a row naming no gate has nothing to
  // answer. Neither draws a button; both catch a page that went stale.
  if (isTerminal(record.status) || record.gateId === null) {
    return {
      ok: false,
      why: "reviseRefusedGateClosed",
      note: `iteration '${record.id}' is ${record.status}, and no gate is open on it.`,
    };
  }
  // **The approval is re-read here, and the form's is only ever compared
  // against it** (rondo#233 S4, Codex round 2). The page draws the decision the
  // lap being revised was admitted under so that nobody types one; a hidden
  // field is still a thing a person can edit, and a different approval that
  // happens to cover the same request, workspace and agent type would be tested
  // and charged instead -- past the exhausted budget of the one this lineage
  // actually ran on. So what D-0070 section 1.2 says is true by construction
  // rather than by the form's good behaviour: no admission row, or a decision
  // that is not the one on it, answers nothing and walks no gate.
  //
  // **What it is compared with is the approved tip of that approval's chain**
  // (D-0074 section 2, amending D-0070 section 1.2): a raise approved over the
  // admission row is what the second lap spends, and only the chain's own tip
  // is accepted, so the reason above survives. A chain with two approved tips
  // has none, and rondo does not pick one (D-0074 rule 2.1).
  const tip = await approvalTip(openAdvisoryRecord(storePath), record.id);
  if (tip.kind === "forked") {
    return {
      ok: false,
      why: "reviseRefusedForked",
      note:
        `the undecidable verdict: iteration '${record.id}' was admitted under a line with two ` +
        `approved tips, ${tip.scopeDecisionIds.map((id) => `'${id}'`).join(" and ")}, and ` +
        "rondo does not pick one (D-0074 rule 2.1)",
    };
  }
  if (tip.kind === "none" || tip.scopeDecisionId !== input.scopeDecisionId) {
    return {
      ok: false,
      why: "reviseRefusedNotItsScope",
      note:
        tip.kind === "none"
          ? `iteration '${record.id}' was not admitted under any approval, so there is nothing ` +
            "to count a second lap against"
          : `iteration '${record.id}' now spends '${tip.scopeDecisionId}', and the press named ` +
            `'${input.scopeDecisionId}'`,
    };
  }
  // **Written before the press acts on it** (D-0042 rules 2 and 3), as the
  // approve press writes it: the framing a person pressed on is the same
  // framing whichever of the gate's two answers they chose.
  const shown = await recordPagePress(
    advisoryPorts(store, storePath, () => {}),
    input.iterationId,
  );
  if (!shown.ok) {
    return { ok: false, why: "reviseRefusedNotSetUp", note: shown.note };
  }
  const startup = await startContinuo(environment);
  if (startup.kind === "refused") {
    return {
      ok: false,
      why: "reviseRefusedNoContinuo",
      note: `continuo is not usable: ${startup.reason}`,
    };
  }
  const continuo = startup.continuo;
  const ready = await revisionPreflight(record, input.successorId, input.body, store, continuo);
  if (ready.kind !== "ready") {
    // **Said to the terminal `rondo web` runs in, and not only returned**
    // (rondo#233 S4, Codex round 1): the screen's sentence sends a person to
    // that terminal for the detail, so the detail has to be there. A seam
    // failure is relayed through `relayFailure`, which is where continuo's own
    // diagnosis is printed for every other verb; its exit status is nobody's
    // here, because this surface answers with a refusal and not a status.
    const note =
      ready.kind === "refused"
        ? ready.reason
        : `the gate for '${record.id}' would not read, so nothing was answered`;
    if (ready.kind === "relayed") {
      relayFailure("gate show", ready.result);
    }
    refuse(note);
    return { ok: false, why: "reviseRefusedNotSetUp", note };
  }
  const gateId = record.gateId;
  const advisory = openAdvisoryRecord(storePath);
  const ports = conductorPorts(continuo, store, advisory);
  // **The gate walk and the first row's settlement**, `commandRevise`'s own
  // step, handed to `admitUnderScope` so a refused verdict walks nothing
  // (D-0070 section 2.1). A number halts the admission; null lets it go ahead.
  let gateAnswered = false;
  // **Why the walk stopped, in the page's words, and never a guess**
  // (rondo#233 S4, Codex round 1). A halted admission alone cannot say what a
  // person needs to know -- whether their words reached the gate -- so each way
  // of stopping names its own sentence here, and the one case rondo cannot
  // settle says so rather than claiming the gate was untouched.
  let halted: ReviseRefusal | null = null;
  const answerGate = async (): Promise<number | null> => {
    const walked = await walkGate(continuo, {
      db: planField(record, "db"),
      gateId,
      destinationDir: planField(record, "endpoint_destination_dir"),
      holder: planField(record, "lease_claimant_id"),
      actorId: actor.actorId,
      body: input.body,
      recordAnswer: answerRecorder(store, record.id, gateId, "revise", actor.actorId),
    });
    // **A walk that failed part way is not a gate that was not touched.** The
    // walk is present, deliver, ack (`walkGate`); an answer that reached
    // continuo and then a delivery that did not still comes back `failed`, and
    // whether the person's words are recorded is not a fact this process holds.
    // Saying "nothing was answered" there would send them back to edit and
    // press again over an answer already spent, so the sentence says what is
    // true: go and look before pressing again.
    if (walked.kind === "failed") {
      halted = "reviseRefusedWalkFailed";
      return 1;
    }
    // **A walk that sent nothing is not permission to start a lap** (the
    // predecessor's own check): somebody else closed the gate in between, so
    // the instruction reached nothing. The row is still settled, because that
    // is true and useful.
    if (!walked.answerSent) {
      sayReport(await resume(ports, record.id));
      halted = "reviseRefusedGateClosed";
      return 1;
    }
    gateAnswered = true;
    const report = await resume(ports, record.id);
    sayReport(report);
    // The second lap does not start until the first row is terminal, for
    // `commandRevise`'s reason: `reserve` would answer `occupied` and say so
    // about a lap the person had just answered.
    if (report.status === "closed") {
      return null;
    }
    // **Not the scope's refusal** (Codex round 2): the store's re-test has not
    // run, no stop was written into the request's thread, and the after-the-gate
    // sentence sends a person to a message that is not there.
    halted = "reviseRefusedNotSettled";
    return 1;
  };
  const outcome = await admitUnderScope(
    {
      store,
      record: advisory,
      nowMs: Date.now,
      beforeAdmit: answerGate,
      admit: (plan, id, supersedes, requestMessageId, scopeSpend) =>
        withReservedNumbers(store, ready.numbering, plan, (numbered, numbers) =>
          admit(
            ports,
            unpromptedPorts(store, storePath),
            numbered,
            START_POLICY,
            id,
            supersedes,
            null,
            requestMessageId,
            scopeSpend,
            null,
            numbers,
          ),
        ),
    },
    input.scopeDecisionId,
    {
      kind: "redo",
      iterationId: input.successorId,
      plan: ready.plan,
      predecessorId: record.id,
      requestMessageId: record.requestMessageId,
      // The page's closing press is not built (D-0098 rule 8.6 is page work).
      closing: false,
    },
  );
  if (outcome.kind === "refused") {
    // **Which side of the gate the refusal landed on is the whole of what the
    // person needs** (D-0070 section 2.4): a verdict refused before the walk
    // leaves the gate open and nothing said, and the store's re-test after it
    // leaves their words recorded at continuo with no lap running.
    return gateAnswered
      ? { ok: false, why: "reviseRefusedAfterGate", note: outcome.reason }
      : {
          ok: false,
          why: "reviseRefusedOutside",
          test: outcome.test,
          note: `the ${outcome.verdict} verdict at the ${outcome.test} test: ${outcome.reason}`,
        };
  }
  if (outcome.kind === "halted") {
    return {
      ok: false,
      why: halted ?? (gateAnswered ? "reviseRefusedAfterGate" : "reviseRefusedNotSetUp"),
      note: `nothing was admitted; the gate walk stopped with status ${String(outcome.status)}`,
    };
  }
  const report = outcome.report;
  sayReport(report);
  if (report.iterationId === null) {
    // The admission itself did not name a lap, which is not the approval
    // refusing one either (Codex round 2): the terminal has the report's lines.
    return {
      ok: false,
      why: "reviseRefusedNotSettled",
      note: report.lines.join("\n"),
    };
  }
  // A lap this button started gets the reading a lap started from a terminal
  // gets (`startScoped`'s reason, D-0065): otherwise its gate would open with
  // the *Model review* half empty for ever.
  if (report.status === "awaiting_human") {
    await sayGateOpen(() =>
      takeModelReading(
        modelReviewPorts(continuo, store, ports.thread ?? null),
        report.iterationId ?? input.successorId,
      ),
    );
  }
  return { ok: true, note: `iteration '${input.successorId}' was admitted` };
}

async function startScoped(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  approver: string,
  input: ScopedStartInput,
): Promise<Started> {
  const actor = approvedActor(approver, environment);
  if ("refusal" in actor) {
    return { ok: false, why: "startRefusedNotAdmitted", note: actor.refusal };
  }
  const record = openAdvisoryRecord(storePath);
  const threads = await record.threadMessages();
  const asked =
    threads.kind === "read"
      ? threads.messages.find((message) => message.messageId === input.requestMessageId)
      : undefined;
  if (asked === undefined) {
    return {
      ok: false,
      why: "startRefusedNoRequest",
      note:
        threads.kind === "read"
          ? `there is no message '${input.requestMessageId}' in this store's threads`
          : `the request threads will not read: ${threads.reason}`,
    };
  }
  // **A second submit of one form is the lap it already started**, which is the
  // argument the send routes make about a repeated message (`alreadyThere` in
  // `src/access/web-app.ts`): the iteration id was minted when the form was
  // drawn, precisely so the store holds one row however many times the button
  // is pressed. Telling the person "nothing started" would be false, and it is
  // worse than false here -- `admitUnderScope` would test a scope whose budget
  // that very lap has just spent, and a refused test writes an **asking message
  // into the request's thread** (D-0066 rule 4.4) which then holds the line
  // (D-0069 rule 5). A question nobody asked, stopping the work, because
  // somebody pressed back and submit. So the press that names a row already
  // there is the press that made it, and it admits nothing and writes nothing.
  const already = await store.read(input.iterationId);
  if (already.kind === "read") {
    return { ok: true, note: `iteration '${input.iterationId}' was already admitted` };
  }
  if (already.kind === "unreadable") {
    return {
      ok: false,
      why: "startRefusedNotAdmitted",
      note:
        `a row for iteration '${input.iterationId}' is already there and will not read: ` +
        `${already.reason}. Nothing was admitted a second time.`,
    };
  }
  const chosen = await heldPlanOf({ store, record }, input.requestMessageId, input.planDigest);
  if ("refusal" in chosen || chosen.plan === null) {
    return {
      ok: false,
      why: "startRefusedNoPlan",
      note:
        "refusal" in chosen
          ? chosen.refusal
          : `'${input.planDigest}' is not a plan rondo holds for this request`,
    };
  }
  const planned = readRunPlan({ ...chosen.plan.document, prompt: asked.body });
  if (planned.kind !== "planned") {
    return {
      ok: false,
      why: "startRefusedNoPlan",
      note: `The plan was refused: ${planned.reason}`,
    };
  }
  return await admitScopedPlan(
    environment,
    store,
    storePath,
    record,
    input,
    planned.plan,
    null,
    null,
  );
}

/**
 * Admit one plan under an approved scope, from the page: the tail a person-
 * written plan (`startScoped`) and a drafted split's plan (`startSplit`)
 * share -- continuo started, `admitUnderScope` with the plan's proposal, the
 * report said, and the model reading taken at the gate.
 */
/**
 * `plan` with what rondo puts after its prompt: the definition of done
 * (rondo#377, `./done.ts`), then D-0078 section 3.4's quoted section -- every
 * issue the request's thread read, rendered by rondo from the `forge` rows.
 * The drafted or written prompt stays as it is and comes first.
 *
 * **A thread that will not read admits nothing**: a lap started without the
 * issues its request named would be the thinner request N-43 warns about,
 * said nowhere.
 */
export async function withNamedIssues(
  record: Pick<AdvisoryRecord, "threadMessages" | "messagesBeforeIssueReader">,
  requestMessageId: string,
  plan: RunPlan,
): Promise<RunPlan | { readonly refusal: string }> {
  const threads = await record.threadMessages();
  if (threads.kind !== "read") {
    return {
      refusal: `the request's thread will not read, so the issues it names cannot be quoted: ${threads.reason}`,
    };
  }
  // **Not while a read is still to come** (section 3.3's rule, at the lap's
  // door): an admitted prompt is never re-quoted, so a lap started before an
  // issue's read lands would run without it for good. The scope screen says
  // which are not read yet.
  const waiting = [
    ...unreadIssues(threads.messages, await record.messagesBeforeIssueReader(Date.now())),
  ].filter(([messageId]) => requestOf(threads.messages, messageId) === requestMessageId);
  if (waiting.length > 0) {
    return {
      refusal:
        `rondo has not yet read ${waiting.flatMap(([, refs]) => refs.map((r) => r.named)).join(", ")}, ` +
        "which this request names; nothing was admitted, and it can start once they are read",
    };
  }
  const prompt =
    plan.prompt +
    definitionOfDone(plan.reviewCriterion?.ruleFiles ?? []) +
    issuesQuote(threads.messages, requestMessageId);
  // **Refused whole rather than cut** (section 2.3's rule, at the lap's door):
  // the reader already bounds what one request's reads hold together, so only
  // a prompt that is itself most of the bound reaches this.
  const bytes = new TextEncoder().encode(prompt).length;
  if (bytes > PROMPT_TRANSPORT_BOUND_BYTES) {
    return {
      refusal:
        `the prompt with the issues its request named holds ${String(bytes)} bytes, over the ` +
        `${String(PROMPT_TRANSPORT_BOUND_BYTES)} one argument to continuo can carry; nothing was ` +
        "admitted, and nothing was cut",
    };
  }
  return { ...plan, prompt };
}

/**
 * What an admission reserves in its repository's decision record (D-0098
 * rule 3.3): how many new numbers, above which floor, and the numbers its
 * line already holds (named beside the new ones in the prompt).
 */
interface Numbering {
  readonly record: string;
  readonly floor: number;
  readonly count: number;
  readonly held: readonly number[];
}

/**
 * The numbering `count` new entries of `plan` need, null when none (no
 * count, or a plan that names no record), or why not. **The floor is read
 * before anything is admitted, and a floor nobody could read admits nothing**
 * (D-0098 rule 3.3, as D-0100 refuses a lap whose base will not fetch): a
 * number handed out below the default branch's record would collide at merge.
 */
async function numberingFor(
  plan: RunPlan,
  count: number,
  held: readonly number[],
): Promise<Numbering | { readonly refusal: string } | null> {
  const record = plan.decisionRecord;
  if (count <= 0 || record === null) {
    return null;
  }
  const read = await readRecordFloor({
    repository: plan.repository,
    remote: READING_REMOTE,
    record,
  });
  return read.kind === "undetermined"
    ? {
        refusal:
          `rondo reserves this work's decision-record numbers above what ${record} on the ` +
          `forge's default branch holds, and could not read it: ${read.reason}. Nothing was ` +
          "admitted.",
      }
    : { record, floor: read.floor, count, held };
}

/**
 * Admit `plan` with its new decision-record numbers named in its prompt and
 * handed to `reserve()` (D-0098 rule 3.3). The numbers are named before
 * `reserve()` tests them under its lock, so one taken since is composed again
 * above the highest now reserved and tried again, **until `reserve()` takes
 * them**: a gate may already be answered by then (`beforeAdmit`), and giving
 * up would leave it answered with no redo. Bounded, because the highest
 * reserved number only grows.
 */
export async function withReservedNumbers(
  store: Pick<IterationStore, "highestReserved">,
  numbering: Numbering | null,
  plan: RunPlan,
  attempt: (plan: RunPlan, numbers: readonly number[] | null) => Promise<ConductorReport>,
): Promise<ConductorReport> {
  if (numbering === null) {
    return await attempt(plan, null);
  }
  const once = (highest: number) => {
    const numbers = nextNumbers(numbering.floor, highest, numbering.count);
    return attempt(
      {
        ...plan,
        prompt: plan.prompt + numbersSection(numbering.record, [...numbering.held, ...numbers]),
      },
      numbers,
    );
  };
  let report = await once(
    await store.highestReserved(
      repositoryKey(plan.repository) ?? plan.repository,
      numbering.record,
    ),
  );
  while (report.numbersMoved !== undefined) {
    report = await once(report.numbersMoved);
  }
  return report;
}

async function admitScopedPlan(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  record: AdvisoryRecord,
  input: {
    readonly iterationId: string;
    readonly requestMessageId: string;
    readonly scopeDecisionId: string;
  },
  unquoted: RunPlan,
  proposalId: string | null,
  /** The drafted split's claim (D-0073 rule 2.3), or null for the whole repository (rule 2.5). */
  claim: LaneClaimAsk | null,
  /** How many new decision entries the drafted split says the plan writes (D-0098 rule 3.3). */
  entries = 0,
): Promise<Started> {
  const plan = await withNamedIssues(record, input.requestMessageId, unquoted);
  if ("refusal" in plan) {
    return { ok: false, why: "startRefusedNotAdmitted", note: plan.refusal };
  }
  const numbering = await numberingFor(plan, entries, []);
  if (numbering !== null && "refusal" in numbering) {
    return { ok: false, why: "startRefusedNotAdmitted", note: numbering.refusal };
  }
  const startup = await startContinuo(environment);
  if (startup.kind === "refused") {
    return {
      ok: false,
      why: "startRefusedNoContinuo",
      note: `continuo is not usable: ${startup.reason}`,
    };
  }
  const continuo = startup.continuo;
  const ports = conductorPorts(continuo, store, record);
  const outcome = await admitUnderScope(
    {
      store,
      record,
      nowMs: Date.now,
      admit: (scoped, id, supersedes, requestMessageId, scopeSpend) =>
        withReservedNumbers(store, numbering, scoped, (numbered, numbers) =>
          admit(
            ports,
            unpromptedPorts(store, storePath),
            numbered,
            START_POLICY,
            id,
            supersedes,
            null,
            requestMessageId,
            scopeSpend,
            claim,
            numbers,
          ),
        ),
    },
    input.scopeDecisionId,
    {
      kind: "lineage_start",
      iterationId: input.iterationId,
      plan,
      proposalId,
      requestMessageId: input.requestMessageId,
    },
  );
  if (outcome.kind === "refused") {
    // **The stop is written where a refusal always writes it** -- rule 4.4's
    // asking message in the request's thread -- and the screen says which test
    // refused and where the choices are, never a D-number or an id to copy.
    // Whatever the terminal would have printed still goes to the terminal
    // `rondo web` runs in, as `answerFromPage` leaves `walkGate`'s there.
    return {
      ok: false,
      why: "startRefusedOutside",
      test: outcome.test,
      note: `the ${outcome.verdict} verdict at the ${outcome.test} test: ${outcome.reason}`,
    };
  }
  if (outcome.kind === "halted") {
    return {
      ok: false,
      why: "startRefusedNotAdmitted",
      note: `nothing was admitted; the run stopped with status ${String(outcome.status)}`,
    };
  }
  sayReport(outcome.report);
  if (outcome.report.iterationId === null) {
    return {
      ok: false,
      // Refused by files another line holds (D-0073 rule 3.1), said as that.
      why:
        outcome.report.laneRefusal === undefined ? "startRefusedNotAdmitted" : "startRefusedHeld",
      note: outcome.report.lines.join("\n"),
    };
  }
  // **A lap this button started gets the reading the same lap started from a
  // terminal gets** (D-0065): `finishScopedAdmission` takes it the moment a
  // scoped admission stops at `awaiting_human`, and a page that skipped it
  // would open a gate whose *Model review* half is empty for ever -- while the
  // gate screen goes on saying the reading may still arrive (`modelMayArrive`,
  // #220 S2), which is the page telling a person to wait for something nobody
  // is taking. It is awaited rather than left running, for the reason the whole
  // press is awaited: the lap itself already ran inside it, and a reading is
  // the short part of that. Its own words go to the terminal `rondo web` runs
  // in, as `answerFromPage` leaves `walkGate`'s there.
  if (outcome.report.status === "awaiting_human") {
    await sayGateOpen(() =>
      takeModelReading(
        modelReviewPorts(continuo, store, ports.thread ?? null),
        outcome.report.iterationId ?? input.iterationId,
      ),
    );
  }
  return { ok: true, note: `iteration '${input.iterationId}' was admitted` };
}

/**
 * Everything that has to be true before a revision may walk the gate.
 *
 * **A separate function because the walk is irreversible and these are not
 * about the plan.** `revisionPlan` already refuses a plan it cannot build, but
 * two things it cannot see would each be discovered *after* the gate had been
 * presented, answered and closed -- at which point the person has spent their
 * gate on an answer that started nothing, and the only way on is the
 * hand-written plan `revise` exists to remove.
 *
 *  1. **The successor's iteration id is not part of its plan**, so a plan can
 *     validate perfectly under an id the store already holds. `reserve` refuses
 *     the duplicate correctly -- but it runs after the walk, and by then the
 *     predecessor is `closed`, so a corrected retry is told that nothing is
 *     live. An `unreadable` row blocks the id too: it is a row, whatever it
 *     says.
 *  2. **The successor's run id is asked of continuo's control plane**, which is
 *     the one field `run admit` checks that rondo's own store cannot see. Under
 *     `D-0023` the run id is a pure function of the iteration id, so a
 *     collision rondo caused is impossible and check (1) covers the rest of
 *     rondo's own history -- but a control plane holding a run rondo's store
 *     does not (a store rebuilt or replaced, a `--db` pointing somewhere else,
 *     a run made by hand) still refuses at `run admit`, which for a revision is
 *     after the gate is gone. **Only an answered `run show` counts as taken**;
 *     a refusal, an unreadable database or a seam that did not answer leaves
 *     this command behaving exactly as it did before the check existed, which
 *     is what keeps a verb rondo drives to learn about an absence from turning
 *     continuo's refusal vocabulary into a taxonomy (`D-0015` rule 2).
 *  3. **The topic branch and the workspace are asked of the machine, not only
 *     of the predecessor's plan.** `revisionPlan` compares the three
 *     identifiers against the predecessor's, which catches the obvious reuse
 *     and is all a layer that may not start a process can do. It does not catch
 *     a branch from two laps ago, a branch something else created, or another
 *     spelling of a path that resolves to the same directory -- and continuo's
 *     materialiser requires that neither exists, discovering it after
 *     `run admit`, which for a revision is after the gate is gone.
 *  4. **A gate continuo has already closed is not an answer this command may
 *     stand on.** `walkGate` handles it correctly and gently -- it says so and
 *     sends nothing -- and that is exactly the trap: the walk *succeeds*, and a
 *     conductor's `resume` then reports `closed` for `withdrawn` and `expired`
 *     as readily as for `answered_and_forwarded`. Read as permission, a
 *     successful no-op walk would start a lap whose instruction was never
 *     recorded anywhere, under a gate outcome that is not a person saying
 *     anything at all.
 *
 * All four were found by review rather than by a walk, which is the half of the
 * ordering argument the first walk could not reach: the happy path never meets
 * any of them.
 */
export function revisionBlocker(input: {
  readonly predecessorId: string;
  readonly gateOutcome: string | null;
  readonly successorId: string;
  readonly successorRow: ReadOutcome["kind"];
  readonly successorRunId: string;
  readonly successorRunStatus: string | null;
  readonly topicBranch: string;
  readonly topicBranchExists: boolean;
  readonly workspace: string;
  readonly workspaceExists: boolean;
}): string | null {
  if (input.gateOutcome !== null) {
    return (
      `the gate on iteration '${input.predecessorId}' is already closed as ` +
      `'${input.gateOutcome}', so your instruction cannot be carried to it and nothing would ` +
      "record what you asked for. No lap was started. If the work should continue anyway, " +
      "'rondo start' takes a plan whose base branch is this iteration's topic branch."
    );
  }
  if (input.successorRow !== "absent") {
    return (
      `iteration '${input.successorId}' already exists in the store, so the second lap could ` +
      "not be reserved under it -- and the gate would have been answered first. Nothing was " +
      "touched. Choose another --iteration-id."
    );
  }
  if (input.successorRunStatus !== null) {
    return (
      `continuo's control plane already holds run '${input.successorRunId}' at status ` +
      `'${input.successorRunStatus}', and admission refuses a second run under one id -- the ` +
      "second lap could not have been admitted, and the gate would have been answered first. " +
      "Nothing was touched. rondo derives the run id from the iteration id, so choose another " +
      "--iteration-id."
    );
  }
  if (input.topicBranchExists) {
    return (
      `branch '${input.topicBranch}' already exists in the repository, and continuo creates the ` +
      "topic branch rather than checking it out -- it requires one that is not there. Nothing " +
      "was touched. rondo derives the topic branch from the iteration id, so choose another " +
      "--iteration-id."
    );
  }
  if (input.workspaceExists) {
    return (
      `'${input.workspace}' already exists, and continuo creates the worktree there -- it ` +
      "requires the path not to exist. Nothing was touched. rondo derives the workspace from " +
      "the iteration id, so choose another --iteration-id."
    );
  }
  return null;
}

/**
 * What has to be true before a `revise` may walk a gate, and what the walk and
 * the admission then need.
 *
 * `relayed` is continuo's own failure to show the gate, which the command line
 * relays verbatim (`D-0015` rule 7) and a page says in its own words.
 */
export type RevisionReady =
  | { readonly kind: "refused"; readonly reason: string }
  | { readonly kind: "relayed"; readonly result: ContinuoResult<unknown> }
  | {
      readonly kind: "ready";
      readonly plan: RunPlan;
      readonly gate: GateDetail;
      /** The one more number its gate found the line needs, or null (D-0098 rule 3.3). */
      readonly numbering: Numbering | null;
    };

/**
 * Everything that happens before a `revise` answers a gate, as one function.
 *
 * **Extracted so the terminal and the page cannot drift** (rondo#233 S4, the
 * argument `answerFromPage` makes for reaching `walkGate` and `resume` through
 * the same calls the command line makes). Every step here is a read or a pure
 * composition: the successor's plan, the gate document, the allocation, the
 * store's row, git's answer about the branch and continuo's about the run id.
 * **Nothing in it can be taken back**, which is the property that lets both
 * surfaces run it before the walk and refuse for free.
 *
 * The order is `commandRevise`'s own, unchanged: the plan is composed and
 * validated first (`D-0027` rule 6), and `revisionBlocker` has the last word.
 */
export async function revisionPreflight(
  record: IterationRecord,
  successorId: string,
  body: string,
  store: Pick<
    IterationStore,
    "read" | "readingsFor" | "numberReservations" | "laneLine" | "compareLane"
  >,
  continuo: VerifiedContinuo,
): Promise<RevisionReady> {
  const decided = await revisionTakeIn(record, successorId, store, null);
  if ("refusal" in decided) {
    return { kind: "refused", reason: `${decided.refusal} The gate was not touched.` };
  }
  const successor = revisionPlan({
    predecessor: record,
    iterationId: successorId,
    instruction: body,
    takeIn: decided.takeIn,
  });
  if (successor.kind === "refused") {
    return {
      kind: "refused",
      reason: `The second lap's plan was refused, and the gate was not touched: ${successor.reason}`,
    };
  }
  if (record.gateId === null) {
    return {
      kind: "refused",
      reason: `iteration '${record.id}' is ${record.status}, and no gate is open on it.`,
    };
  }
  const observed = await showGate(continuo, { db: planField(record, "db"), gateId: record.gateId });
  if (observed.kind !== "answered") {
    return { kind: "relayed", result: observed };
  }
  const gate = observed.payload;

  const checked = await successorChecks(
    record,
    successorId,
    successor.plan,
    gate.outcome,
    store,
    continuo,
  );
  return "refusal" in checked
    ? { kind: "refused", reason: checked.refusal }
    : { kind: "ready", plan: successor.plan, gate, numbering: checked.numbering };
}

/**
 * The refusals that cost nothing and follow the successor's plan, and the one
 * more number it is reserved: everything `revisionPreflight` asks after the
 * gate, shared with rondo#417's conflict fix, which has no gate
 * (`gateOutcome` null) and asks the same of the successor.
 */
async function successorChecks(
  record: IterationRecord,
  successorId: string,
  plan: RunPlan,
  gateOutcome: string | null,
  store: Pick<IterationStore, "read" | "readingsFor" | "numberReservations">,
  continuo: VerifiedContinuo,
): Promise<{ readonly refusal: string } | { readonly numbering: Numbering | null }> {
  // The last two refusals, and the last things that cost nothing. See
  // `revisionBlocker`: the id the successor will be reserved under is not part
  // of the plan that was just validated, and a gate continuo has already closed
  // is walked successfully and silently.
  //
  // **The successor's branch and workspace are derived here rather than read
  // off the plan** (`D-0023` rule 9): the plan no longer carries them, and what
  // the preflight has to ask git about is the name `admit()` will actually
  // mint. Deriving it twice -- once here, once at admission -- is safe because
  // the derivation is a pure function of the id, which is the property that
  // makes the check meaningful at all.
  const allocation = allocate(successorId, plan.workspaceRoot);
  if (allocation.kind === "refused") {
    return {
      refusal: `The second lap's iteration id was refused: ${allocation.reason}`,
    };
  }
  const successorTopicBranch = allocation.allocation.topicBranch;
  const successorWorkspace = allocation.allocation.workspace;
  const existing = await store.read(successorId);
  // **Asked of git, and a refusal when git will not say.** The branch is the
  // one preflight that needs a process, so it is `forge.ts`'s (this module has
  // no spawn binding, and D-0025 rule 7 is that property rather than a
  // promise). An unreadable answer is refused rather than read as room to
  // proceed: the next thing this command does cannot be undone.
  const branch = await inspectTopicBranch({
    repository: plan.repository,
    topicBranch: successorTopicBranch,
  });
  if (branch.kind === "malformed") {
    return {
      refusal:
        `'${successorTopicBranch}' is not a name git will accept for a branch, so nothing ` +
        "could create it -- and a name that cannot exist reads as a name that is free. Nothing " +
        "was touched. Choose another --iteration-id.",
    };
  }
  if (branch.kind !== "read") {
    return {
      refusal:
        `git could not say whether '${successorTopicBranch}' already exists in ` +
        `${plan.repository}: ${branch.reason}. continuo requires a topic branch that ` +
        "is not there, and rondo will not answer the gate without knowing. Nothing was touched.",
    };
  }
  // **Asked of continuo, and only an answer is a fact.** This is the field
  // `D-0027` rule 9 left open: `run admit` refuses a run id the control plane
  // already holds, and for a revision that refusal arrives after the gate is
  // spent. An answered document means the id is taken; every other outcome --
  // continuo refusing, a database rondo cannot read, a seam that did not answer
  // -- leaves this command as it was, because a verb driven to learn about an
  // absence must not turn continuo's refusals into a taxonomy (`D-0015`
  // rule 2). The database is the predecessor's own, which `gate show` has just
  // read successfully.
  const successorRun = await showRun(continuo, {
    db: planField(record, "db"),
    runId: allocation.allocation.runId,
  });
  const blocker = revisionBlocker({
    predecessorId: record.id,
    gateOutcome,
    successorId,
    successorRow: existing.kind,
    successorRunId: allocation.allocation.runId,
    successorRunStatus: successorRun.kind === "answered" ? successorRun.payload.status : null,
    topicBranch: successorTopicBranch,
    topicBranchExists: branch.exists,
    workspace: successorWorkspace,
    workspaceExists: existsSync(successorWorkspace),
  });
  if (blocker !== null) {
    return { refusal: blocker };
  }
  const numbering = await redoNumbering(record, plan, store);
  return numbering !== null && "refusal" in numbering
    ? { refusal: `${numbering.refusal} The gate was not touched.` }
    : { numbering };
}

/**
 * What a revision of `predecessor` must take in first (D-0098 rule 2, built by
 * D-0105), or null, or why that could not be decided -- before any gate.
 *
 * In this order:
 *  1. **A take-in the predecessor did not pass is carried**, commit and all:
 *     it is not work that lap already did (`revisionPlan` never inherits one
 *     it did), and dropping it would let the next lap read clear without it.
 *  2. **`conflict`** (rondo#417): the caller says so; the default branch is
 *     fetched as the forge has it now.
 *  3. **`landed`**: the predecessor changed paths outside its line's claim
 *     (D-0073 rule 5, {@link compareClaim}) that the default branch has
 *     changed since the predecessor's tip left it. Only then is anything
 *     fetched, so an ordinary revise still reaches no forge. The decision
 *     record is not a landed path: it is shared-append (D-0098 rule 3.5) and a
 *     collision on it is the conflict case.
 *
 * **The one exception to D-0100 rule 4** ("a revision fetches nothing"): a
 * take-in fetches the base into `rondo/base/<the successor's run id>`, the
 * ref a first lap of that run id would own, derived as `admit()` will derive
 * it (D-0103 rule 2.6's open naming). A fetch that fails refuses the revision.
 */
export async function revisionTakeIn(
  predecessor: IterationRecord,
  successorId: string,
  store: Pick<IterationStore, "readingsFor" | "laneLine" | "compareLane">,
  cause: "conflict" | null,
): Promise<{ readonly takeIn: TakeIn | null } | { readonly refusal: string }> {
  const planned = readPlan(predecessor.plan);
  if (planned.kind !== "planned") {
    // `revisionPlan` refuses it in its own words.
    return { takeIn: null };
  }
  const plan = planned.plan;
  const tip =
    latestReading(await store.readingsFor(predecessor.id), isDeterministicReadingDrafter)?.evidence
      ?.tipCommit ?? null;
  if (plan.takeIn !== null) {
    const passed =
      tip !== null &&
      (await isAncestor({
        repository: plan.repository,
        ancestor: plan.takeIn.commit,
        descendant: tip,
      })) === "yes";
    if (!passed) {
      return { takeIn: plan.takeIn };
    }
  }
  let paths: readonly string[] = [];
  if (cause === null) {
    const compared = await compareClaim({ store, readChangedPaths }, predecessor.id);
    if (compared.kind !== "outside" || tip === null) {
      return { takeIn: null };
    }
    paths = [...compared.held.flatMap((holder) => holder.sharedPaths), ...compared.unheld].filter(
      (path) => path !== plan.decisionRecord,
    );
    if (paths.length === 0) {
      return { takeIn: null };
    }
  }
  const allocation = allocate(successorId, plan.workspaceRoot);
  if (allocation.kind === "refused") {
    // `revisionPreflight` refuses the id in its own words.
    return { takeIn: null };
  }
  const remoteBranch = plan.pullRequestBaseBranch ?? plan.baseBranch;
  const base = await fetchLapBase({
    repository: plan.repository,
    remote: READING_REMOTE,
    baseBranch: remoteBranch,
    runId: allocation.allocation.runId,
  });
  if (base.kind === "refused") {
    return { refusal: base.reason };
  }
  if (cause === null && tip !== null) {
    const landed = await readChangedPaths({
      repository: plan.repository,
      baseCommit: tip,
      tipCommit: base.commit,
    });
    if (landed.kind === "undetermined") {
      return {
        refusal:
          `rondo could not read what ${READING_REMOTE}/${remoteBranch} changed since lap ` +
          `'${predecessor.id}': ${landed.reason}.`,
      };
    }
    paths = paths.filter((path) => landed.paths.some((changed) => pathsOverlap(path, changed)));
    if (paths.length === 0) {
      return { takeIn: null };
    }
  }
  return {
    takeIn: {
      commit: base.commit,
      branch: base.branch,
      remoteBranch,
      paths: cause === null ? paths : [],
      cause: cause ?? "landed",
    },
  };
}

/**
 * The one more number a redo is reserved (D-0098 rules 3.3 and 3.6): one for
 * each heading or index-row number the predecessor's `base...tip` added to
 * the record that is not its line's, so the drafted revise renumbers them from
 * a new reservation rather than being found at the gate again. Null for a
 * plan naming no record, a predecessor with no reading, or nothing to
 * renumber; a record git could not read is a refusal, before the gate.
 */
async function redoNumbering(
  predecessor: IterationRecord,
  plan: RunPlan,
  store: Pick<IterationStore, "readingsFor" | "numberReservations">,
): Promise<Numbering | { readonly refusal: string } | null> {
  const record = plan.decisionRecord;
  const evidence = latestReading(
    await store.readingsFor(predecessor.id),
    isDeterministicReadingDrafter,
  )?.evidence;
  if (record === null || evidence === undefined || evidence === null) {
    return null;
  }
  const added = await readRecordAdditions({
    repository: plan.repository,
    baseCommit: evidence.baseCommit,
    tipCommit: evidence.tipCommit,
    record,
    takenIn: takenInCommit(predecessor.plan),
  });
  if (added.kind === "undetermined") {
    return {
      refusal: `rondo could not read what lap '${predecessor.id}' added to ${record}: ${added.reason}.`,
    };
  }
  // Every number the line was handed, a released one included: nobody else can
  // ever be handed it, so a retried lap that wrote it as its prompt said keeps
  // it rather than burning a new one (D-0098 rule 3.4).
  const held = (await store.numberReservations(predecessor.id)).map((one) => one.number);
  return await numberingFor(
    plan,
    added.numbers.filter((number) => !held.includes(number)).length,
    held,
  );
}

/** A reading's findings as a closing lap quotes them (D-0098 rule 5.2), numbered from 1. */
function closingFindings(reading: LapReading | null): readonly ClosingFinding[] {
  return (reading?.findings ?? []).map((text, i) => ({
    number: i + 1,
    text,
    bases: (reading?.graded?.[i]?.bases ?? []).map(findingBasisText),
  }));
}

/**
 * Door two and a half: answer the gate with a change, and run a second lap.
 *
 * **The defect this closes, stated plainly.** `gate_options` has offered
 * `["approve", "revise"]` since the first dogfood run and the second word bought
 * nothing: `answer` carried whatever a person typed, the gate closed
 * `answered_and_forwarded` either way, and the only thing rondo then said was
 * "Next: rondo publish". Wanting a change meant writing a thirty-two-field plan
 * by hand and knowing, untold, that the next lap's `base_branch` has to be the
 * last lap's `topic_branch`. This command is that, typed once.
 *
 * **The order of the two effects is the whole of its safety.** The successor's
 * plan is composed and fully validated **before** the gate is walked, because
 * the walk cannot be taken back: it presents, delivers and answers through
 * continuo, and the ack closes the gate. A revision refused after that would
 * leave a person having spent their gate on an answer that started nothing, and
 * the way back would be the hand-written plan this command exists to remove. So
 * a bad identifier costs a refusal and nothing else -- the same "validate before
 * the effect" rule `D-0019` rule 14 applies to a spawn, applied to a gate.
 *
 * **The instruction goes to two places and is composed in neither.** continuo
 * gets it byte for byte as the gate's answer, which is where the record of what
 * a person said belongs and the only place it is authoritative; the second lap's
 * prompt gets it appended to the first lap's request by
 * {@link import("../refrain/revision.js").revisionPlan}. rondo writes no part of
 * either (`D-0009`).
 */
async function commandRevise(
  parsed: ParsedCommand,
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  ports: ReturnType<typeof conductorPorts>,
  advisory: UnpromptedPorts,
  continuo: VerifiedContinuo,
): Promise<number> {
  const actor = approvedActor(parsed.actorId, environment);
  if ("refusal" in actor) {
    return refuse(actor.refusal);
  }
  if (parsed.body === null || parsed.body === "") {
    return refuse(
      "revise needs --body=TEXT, saying what to change. It is carried to the gate byte for " +
        "byte and appended to the second lap's prompt, so there is nothing to carry without " +
        "it. Write it with an equals sign: an instruction may begin with a dash.",
    );
  }
  const body = parsed.body;
  // **One identifier now, and it used to be three.** The second lap is a second
  // run -- continuo holds a run under the first lap's id, git holds its branch
  // and a worktree stands at its workspace -- so it needs identifiers of its
  // own. Under `D-0023` rondo derives all three from the iteration id, so this
  // is the only one a person types.
  const successorId = parsed.iterationId;
  if (successorId === null) {
    return refuse(
      "revise needs --iteration-id ID, which is the id the second lap is reserved under. " +
        "rondo derives its run id, topic branch and workspace from it, so it must be new and " +
        "must be a lowercase letter followed by up to 63 more of [a-z0-9_-]. What carries the " +
        "work across is the branch, and rondo sets that for you: the second lap's base branch " +
        "is the first lap's topic branch.",
    );
  }

  // **The iteration being revised is resolved the way `answer` resolves it**,
  // which since `D-0023` means "the one live iteration, and a refusal when
  // that does not name one". `--iteration-id` is already spoken for here: on
  // this verb alone it names the successor rather than the row being acted on,
  // which `D-0027` chose when there could only ever be one live row to revise.
  // With more than one open there is no second flag to say which, so revise is
  // unavailable until the others are settled -- a real limitation, recorded
  // rather than papered over with a guess at which row was meant.
  const chosen = await pickWaiting(store, null);
  if ("refusal" in chosen) {
    return refuse(chosen.refusal);
  }
  if (chosen.record === null) {
    say("Nothing is waiting. No iteration is live, so there is nothing to revise.");
    return 0;
  }
  const record = chosen.record;
  if (record.gateId === null) {
    say(`iteration '${record.id}' is ${record.status}, and no gate is open on it.`);
    say("There is nothing for a person to answer yet.");
    return 0;
  }

  // **Composed, read and preflighted first. Nothing below the walk is undoable.**
  // One function, shared with the page's revise press, so the two surfaces
  // cannot drift on what has to be true before a gate is spent.
  const ready = await revisionPreflight(record, successorId, body, store, continuo);
  if (ready.kind === "relayed") {
    return relayFailure("gate show", ready.result);
  }
  if (ready.kind === "refused") {
    return refuse(ready.reason);
  }
  // D-0098 rule 5.2: a closing lap's prompt ends with rondo's own section,
  // after the person's instruction and never inside it (D-0009), quoting the
  // findings of the reading the scope's verdict tests: after an exit, every
  // finding of it is below the threshold, which is the set its record names.
  const successor = {
    plan: parsed.closingFix
      ? {
          ...ready.plan,
          prompt:
            ready.plan.prompt +
            closingLapSection(
              closingFindings(
                latestReading(await store.readingsFor(record.id), isModelReadingDrafter),
              ),
            ),
        }
      : ready.plan,
  };
  const gate = ready.gate;

  // **The gate walk and the first row's settlement, as one step** that returns
  // null when the second lap may start and an exit status when it may not. An
  // in-scope revise runs it between the scope's verdict and the admission
  // (D-0070 section 2), so a refused verdict leaves the gate untouched.
  let gateAnswered = false;
  const answerGate = async (): Promise<number | null> => {
    say(`gate ${gate.gateId} is at stage '${gate.stage}'`);
    const walked = await walkGate(continuo, {
      db: planField(record, "db"),
      gateId: gate.gateId,
      destinationDir: planField(record, "endpoint_destination_dir"),
      holder: planField(record, "lease_claimant_id"),
      actorId: actor.actorId,
      body,
      recordAnswer: answerRecorder(store, record.id, gate.gateId, "revise", actor.actorId),
    });
    if (walked.kind === "failed") {
      return walked.status;
    }
    // **A walk that sent nothing is not permission to start a lap.** The gate
    // was closed by somebody else between the read above and the walk's own,
    // so the instruction reached nothing -- and the outcome it closed at may be
    // `withdrawn` or `expired`, which are not a person saying anything.
    // `resume` below would settle the row at `closed` for any of them, so this
    // is the check that keeps a successor from running on an answer that was
    // never recorded. The row is still settled, because that is true and
    // useful.
    if (!walked.answerSent) {
      const report = await resume(ports, record.id);
      sayReport(report);
      say("");
      say(
        "Your instruction was not carried to the gate, so no second lap was started. The " +
          "iteration above is settled; 'rondo start' is how the work continues from here.",
      );
      return 1;
    }
    gateAnswered = true;

    const report = await resume(ports, record.id);
    sayReport(report);
    // **The second lap does not start until the first row is terminal**, and
    // this is a refusal rather than an attempt because the attempt has a worse
    // failure mode: `reserve` would answer `occupied` -- correctly -- and the
    // operator would read a single-flight message about an iteration they had
    // just answered, with no idea that the answer is what had not landed.
    if (report.status !== "closed") {
      say("");
      say(
        "The first iteration did not reach 'closed', so no second lap was started. Run " +
          "'rondo answer' to see where its gate stands.",
      );
      return 1;
    }

    say("");
    say(`revising as iteration '${successorId}', cut from '${successor.plan.baseBranch}'`);
    say("the lap is the step that is slow");
    return null;
  };

  if (parsed.scopeDecisionId !== null) {
    // D-0070: the second lap is the `redo` arm's admission, tested as an
    // in-scope retry is and as the predecessor's request (D-0061 rule 4). The
    // text is carried and not tested (section 3).
    const outcome = await admitUnderScope(
      {
        store,
        record: openAdvisoryRecord(storePath),
        nowMs: Date.now,
        beforeAdmit: answerGate,
        admit: (plan, id, supersedes, requestMessageId, scopeSpend) =>
          withReservedNumbers(store, ready.numbering, plan, (numbered, numbers) =>
            admit(
              ports,
              advisory,
              numbered,
              START_POLICY,
              id,
              supersedes,
              null,
              requestMessageId,
              scopeSpend,
              null,
              numbers,
            ),
          ),
      },
      parsed.scopeDecisionId,
      {
        kind: "redo",
        iterationId: successorId,
        plan: successor.plan,
        predecessorId: record.id,
        requestMessageId: record.requestMessageId,
        closing: parsed.closingFix,
      },
    );
    if (outcome.kind === "refused") {
      consoleSeams.writeError(
        gateAnswered
          ? "The gate was answered with your instruction, and the store then refused the " +
              "second lap, so no second lap was started (D-0070 section 2.4).\n"
          : "The gate was not touched: your instruction was not sent.\n",
      );
    }
    return await finishScopedAdmission(
      outcome,
      "revise",
      continuo,
      store,
      successorId,
      ports.thread ?? null,
    );
  }

  const halted = await answerGate();
  if (halted !== null) {
    return halted;
  }
  // **The predecessor's id travels beside the plan, not inside it** (D-0030
  // rule 1). It is the one place in rondo that knows this lap is a revision of
  // that one at the moment the row is written, and until this argument existed
  // the succession survived only as `base_branch` equalling the predecessor's
  // `topic_branch` -- a value a reader could guess a relationship from, which
  // is what `D-0027` rule 9 deferred and rondo#33 asked for.
  const second = await withReservedNumbers(
    store,
    ready.numbering,
    successor.plan,
    (plan, numbers) =>
      admit(
        ports,
        advisory,
        plan,
        START_POLICY,
        successorId,
        record.id,
        null,
        // Inherited by `reserve()` from the row above whatever is passed; this is
        // the same value, read here so the type can say a lap always has one.
        record.requestMessageId,
        null,
        null,
        numbers,
      ),
  );
  sayReport(second);
  if (second.status === "awaiting_human") {
    await sayGateOpen(() =>
      takeModelReading(
        modelReviewPorts(continuo, store, ports.thread ?? null),
        second.iterationId ?? successorId,
      ),
    );
    return 0;
  }
  if (second.iterationId === null) {
    return 2;
  }
  return second.status === "closed" ? 0 : 1;
}

/**
 * The repository this lap's pull request is opened in, or null for a lap that
 * names none anywhere (D-0081 rule 3.2).
 *
 * **The plan first, and the host's flag only where the plan is silent.** The
 * repository is a fact about the repository the work happened in, so the lap's
 * own plan is where it is now recorded -- one host serves several of them, and
 * one slug per host is right for at most one. `--repo` is what is left: the
 * installer's flag, and what a store set up before `D-0081` publishes by, whose
 * rows carry no slug at all (rule 6.3). Reading them the other way round would
 * let a host's flag overrule the plan of a lap in another repository, which is
 * the failure the whole entry is about.
 *
 * **An empty string is not a slug.** `planField` answers `""` both for a plan
 * that carries no such key and for one whose value is not a string; either way
 * the plan named nothing, and the fallback is what a plan that named nothing
 * gets.
 */
export function publishRepository(record: IterationRecord, asked: PublishAsked): string | null {
  const named = planField(record, "forge_repository");
  return named === "" ? asked.repo : named;
}

/** What a publish needs to know that the lap's own row does not carry. */
export interface PublishAsked {
  /**
   * `OWNER/NAME` on the forge as the *host* was told it (`--repo`), or null
   * for a host that was told none.
   *
   * **The fallback and not the answer** (D-0081 rule 3.2, rule 6.3). The
   * repository is the lap's plan's, so this is read only where that plan
   * carries no slug -- which is every plan written before `D-0081` and every
   * plan an operator hand-wrote without one. A host with neither publishes
   * nothing, and says so per lap rather than per host.
   */
  readonly repo: string | null;
  readonly remote: string;
  readonly allowRemoteMismatch: boolean;
}

/** Everything a publish would do, read and composed before anything runs. */
export interface PublishPlan {
  readonly workspace: string;
  readonly remote: string;
  /**
   * Every URL a push to that remote would reach, as git resolved them.
   *
   * **The name is not the destination** (Codex round 1). `--allow-remote-mismatch`
   * is permission for the remote and `--repo` to differ, and under it a remote
   * re-pointed at another repository of the same owner leaves the head, the
   * warning and every other field of this plan unchanged -- so a digest over the
   * remote's *name* would let an open screen authorise a push to somewhere it
   * never showed. What a person is being asked to approve is where the work
   * goes, so where it goes is what is carried and digested.
   */
  readonly pushUrls: readonly string[];
  /**
   * What the branch was when this plan was composed: the tip it points at, and
   * the digest of the material under it when the history could be read.
   *
   * **The pull request's text is not a fingerprint of the work** (Codex round
   * 2). `pullRequestText` truncates the commit list past twenty and the file
   * statistics survive an amend, and the two refusals that carry no tip -- a
   * missing reading and a reading that raised something -- are exactly the
   * screens the override press is offered on. So an amended commit beyond the
   * displayed list could leave every other field of this plan identical and let
   * an old override form publish work nobody confirmed. What identifies the work
   * is what git measured over it, so that is carried and digested.
   *
   * **The tip is read on its own and never off the history** (Codex round 3).
   * `inspectLapWork` needs a base ref to compare against and answers
   * `unreadable` for a worktree that holds none -- while the branch it would
   * push resolves perfectly well. Taking the fingerprint from that read would
   * leave exactly those publishes with no fingerprint at all, which is the one
   * case where the fallback pull request text and the review refusal are both
   * constant. So the tip comes from {@link inspectBranchTip}, and a tip git
   * will not answer for is a refusal rather than a null.
   */
  readonly workFingerprint: {
    readonly tipCommit: string;
    /** Null when the history could not be read; the tip is never null. */
    readonly materialDigest: string | null;
  };
  readonly topicBranch: string;
  readonly baseBranch: string;
  /** What `gh pr create --head` is given: the branch, or `owner:branch`. */
  readonly headRef: string;
  /** `HOST/OWNER/NAME`, the host that was checked and not one resolved twice. */
  readonly forgeRepo: string;
  readonly runId: string;
  readonly db: string;
  readonly warnings: readonly string[];
  readonly pullRequest: PullRequestText;
  /** The model's reading beside the deterministic one, as material (D-0065 5.5). */
  readonly modelReading: readonly string[];
  /**
   * Why the recorded reading does not cover what would be pushed, or null.
   *
   * **Carried rather than acted on**, because who may overrule it differs by
   * surface: the command line's `--despite-review` and the page's second press
   * are the same person's act reached two ways, and both need the refusal in
   * their hands to show it before they overrule it (D-0060 rules 4 and 5).
   */
  readonly reviewRefusal: ReviewBlock | null;
  /**
   * The open pull request this lap's commits are pushed onto, or null where
   * publishing opens one (rondo#417, D-0105): a conflict fix brings the pull
   * request it fixes forward, so the push names that pull request's branch
   * and nothing is opened. Its address and branch are read off the thread's
   * published line of the nearest lap above that has one.
   */
  readonly updates: { readonly url: string; readonly onto: string } | null;
}

export type PublishPlanned =
  | {
      readonly kind: "refused";
      /** The facts, for a screen to word ({@link PublishBlock}, in `./web.tsx`). */
      readonly block: PublishBlock;
      /** The same refusal as the command line says it, flags and all. */
      readonly reason: string;
    }
  | { readonly kind: "ready"; readonly plan: PublishPlan };

/**
 * Everything that happens before a publish pushes anything, as one function.
 *
 * **Extracted so the terminal and the page cannot drift** (rondo#233 S5), which
 * is `revisionPreflight`'s argument in S4 and, here, a sharper one: D-0059
 * section 5a's `publish` press is pressed only from a screen that already shows
 * this result, so the screen and the act have to be computed by the same code
 * or the screen is a description of something else.
 *
 * **Every step is a read**, in `commandPublish`'s own order: the plan's fields,
 * git's answer about the push target, git's answer about the work, the pull
 * request's text, and the stored readings. Nothing in it can be taken back,
 * which is what lets both surfaces run it and refuse for free -- and what lets
 * the page run it twice, once to show and once inside the press.
 *
 * **The uncommitted-work refusal is here and the review refusal is not.**
 * D-0060 rule 4's refusal is not overridable by anybody, so it is a refusal;
 * the reading's is a judgement a person may overrule, so it is carried.
 */
export async function publishPlanFor(
  record: IterationRecord,
  asked: PublishAsked,
  environment: Readonly<Record<string, string | undefined>>,
  store: Pick<IterationStore, "read" | "readingsFor" | "verificationClaimsFor" | "closingLapOf">,
  /**
   * Where the request's own words are read from, for the issue its pull
   * request closes (rondo#376). Null leaves the body naming no issue, which is
   * what it said before. **Every caller that previews and every caller that
   * presses passes the same one**, or the preview's digest would differ from
   * the press's.
   */
  thread: Pick<AdvisoryRecord, "threadMessages" | "scopesFor" | "readProposal"> | null = null,
): Promise<PublishPlanned> {
  if (record.status !== "closed") {
    return {
      kind: "refused",
      block: { why: "notClosed", status: record.status },
      reason:
        `iteration '${record.id}' is ${record.status}, not closed. Publishing is for work a ` +
        "person has already approved at the gate.",
    };
  }
  // **A closed iteration is not an approved one.** `withdrawn`, `expired` and
  // `unanswerable` all close a gate and therefore close the iteration, and
  // none of them is a person saying yes. Publishing on any of those would push
  // the work and open a pull request whose body claims a human approved it --
  // a false statement about somebody else, written by rondo. Only the outcome
  // that continuo reaches by carrying an answer through to its forward may
  // publish.
  // **An answered gate is not an approved one either** (rondo#385, D-0092):
  // *ask for a change* closes it with the same outcome, so what the person
  // pressed is read from the record rondo made of it -- and a lap with no such
  // record is one rondo cannot call approved.
  if (record.gateOutcome === APPROVED_OUTCOME && !approvedForPublication(record)) {
    return {
      kind: "refused",
      block: { why: "answerNotApproval", answer: record.gateAnswer },
      reason:
        record.gateAnswer === "revise"
          ? `iteration '${record.id}' was answered with a change to make, not an approval, so ` +
            "there is no approval to publish under."
          : `iteration '${record.id}' was answered before rondo recorded which answer a gate ` +
            "was given, so rondo cannot tell an approval from a change request and will not " +
            "publish on a guess.",
    };
  }
  if (!approvedForPublication(record)) {
    return {
      kind: "refused",
      block: { why: "notApproved", outcome: record.gateOutcome },
      reason:
        `iteration '${record.id}' closed at gate outcome ` +
        `'${record.gateOutcome ?? "(none recorded)"}', not '${APPROVED_OUTCOME}'. That is a gate ` +
        "that ended without a person answering it, so there is no approval to publish under.",
    };
  }
  const workspace = planField(record, "workspace");
  const topicBranch = planField(record, "topic_branch");
  const cutFromBranch = planField(record, "base_branch");
  // **A revision's pull request is opened against the branch the *first* lap
  // was cut from, and not the branch *this* lap was cut from.** They are the
  // same value until a `revise` happens, at which point the plan carries both:
  // the second lap's worktree is cut from the first lap's topic branch, which
  // is a branch on this machine that nothing has pushed (`D-0010`), so a pull
  // request against it would name a branch the forge does not have. An absent
  // key is a plan no revision has touched, which is every plan an operator
  // writes.
  const revisionBase = planField(record, "pull_request_base_branch");
  const baseBranch = revisionBase === "" ? cutFromBranch : revisionBase;
  const db = planField(record, "db");
  const runId = record.runId;
  if (runId === null) {
    return {
      kind: "refused",
      block: { why: "noRun" },
      reason: `iteration '${record.id}' records no run id, so there is no run to close.`,
    };
  }
  // The plan validated before the row existed, so a blank here is a row edited
  // out of band rather than an operator's mistake -- and every leg below is
  // built from these three, so guessing past one would print a command line
  // with a hole in it.
  for (const [field, value] of [
    ["workspace", workspace],
    ["topic_branch", topicBranch],
    ["base_branch", baseBranch],
  ] as const) {
    if (value === "") {
      return {
        kind: "refused",
        block: { why: "planField", field },
        reason:
          `iteration '${record.id}' records no '${field}' in its plan, and publish is built from ` +
          "it. The row cannot be published as it stands.",
      };
    }
  }

  // **Before anything is shown, and whether or not this will run.** A preview
  // exists to catch a mistake before the real run, so a preview that passes
  // where the real thing would fail is the failure it was meant to prevent
  // (see `publishPreflight`).
  const host = forgeHost(environment);
  // **The repository is the lap's own plan's, and the host's flag is what a
  // plan without one falls back to** (D-0081 rule 3.2, rule 6.3). The plan is
  // read first because that is where the fact now lives; `--repo` answers for a
  // store set up before `D-0081`, whose rows carry no slug and which must keep
  // publishing exactly as it did. A lap with neither is refused here, per lap,
  // rather than by a host that drew no button at all.
  const repo = publishRepository(record, asked);
  if (repo === null) {
    return {
      kind: "refused",
      block: { why: "noRepo" },
      reason:
        `iteration '${record.id}' names no repository to publish to: its plan carries none, and ` +
        "this rondo was given no --repo OWNER/NAME either. Setup records the repository onto the " +
        "plans it composes; --repo publishes a plan written before it did.",
    };
  }
  // **Kept rather than discarded**: the preflight answers whether this may run,
  // and the destinations it answered over are what the plan is about. They are
  // carried into {@link PublishPlan.pushUrls} so that where the work goes is
  // part of what a person confirmed (Codex round 1).
  const inspection = await inspectPushTarget({ workspace, remote: asked.remote, topicBranch });
  const preflight = publishPreflight({
    repo,
    remote: asked.remote,
    workspace,
    topicBranch,
    forgeHost: host,
    allowRemoteMismatch: asked.allowRemoteMismatch,
    inspection,
  });
  if (preflight.kind === "refused") {
    return {
      kind: "refused",
      block: { why: "target", reason: preflight.reason },
      reason: preflight.reason,
    };
  }
  // **What would be pushed, identified before anything describes it** (Codex
  // round 3). Asked of git on its own, so that a workspace whose base ref is
  // missing -- which `inspectLapWork` answers `unreadable` for -- still gets a
  // fingerprint. A tip git will not answer for is refused here rather than
  // carried as an absence: there would be nothing left to tell one version of
  // this branch from another.
  const tip = await inspectBranchTip({ workspace, topicBranch });
  if (tip.kind !== "read") {
    return {
      kind: "refused",
      block: { why: "target", reason: tip.reason },
      reason: tip.reason,
    };
  }
  // **The host that was checked is the host that is named**, rather than left
  // to the forge CLI to resolve a second time from its own configuration. It
  // resolves a bare `OWNER/NAME` against whatever host it is set up for, so a
  // preflight that agreed about one host and a command that then reached
  // another would be two answers to one question. `HOST/OWNER/NAME` is a
  // spelling the CLI already accepts, and it makes the two the same answer.
  const forgeRepo = `${host}/${repo}`;

  // **Read before the text is composed, for the same reason the preflight is.**
  // The title and the body are what the operator is being asked to approve, so
  // a preview that showed the three legs and left the text to be composed later
  // would preview everything except the part a person can only check by reading.
  const work = await inspectLapWork({
    workspace,
    remote: asked.remote,
    baseBranch,
    topicBranch,
  });
  // **Before the reading is weighed, and not reachable by an override**
  // (D-0060 rules 4 and 5). Checked on this fresh read rather than trusted from
  // the reading, because work added to the worktree after a clean reading is a
  // staleness the material digest cannot see. First among the review refusals
  // so an operator is not sent to an override that cannot answer it.
  const left = uncommittedRefusal(work, workspace, topicBranch);
  if (left !== null && work.kind === "unreadable") {
    return {
      kind: "refused",
      block: { why: "statusUnreadable", reason: work.reason },
      reason: left,
    };
  }
  if (left !== null) {
    return {
      kind: "refused",
      block: {
        why: "uncommitted",
        paths: work.kind === "read" ? work.uncommitted : [],
        elsewhere: work.kind === "read" && work.checkedOut !== topicBranch ? work.checkedOut : null,
      },
      reason: left,
    };
  }
  // **The predecessor is read, not assumed** (#132). Whether that lap's commits
  // are on this branch is a fact about its row, and since D-0047 a predecessor
  // is as likely to be a retry's abandoned subject as a revision's answered
  // one. A row that will not read is left as null and said out loud, because a
  // missing predecessor is not evidence for either lineage.
  const updates = await pullRequestUpdated(record, store, thread);
  if (updates !== null && "refusal" in updates) {
    return {
      kind: "refused",
      block: { why: "target", reason: updates.refusal },
      reason: updates.refusal,
    };
  }
  const predecessorRead =
    record.supersedesIterationId === null ? null : await store.read(record.supersedesIterationId);
  const pullRequest = pullRequestText({
    record,
    runId,
    topicBranch,
    baseBranch,
    headIsQualified: preflight.headRef !== topicBranch,
    work,
    predecessor:
      predecessorRead !== null && predecessorRead.kind === "read" ? predecessorRead.record : null,
    verificationClaims: await store.verificationClaimsFor(record.id),
    requestWords: await requestWordsOf(thread, record.requestMessageId),
    plansDrafted: await plansDraftedFor(thread, record.requestMessageId),
    forge: { host, repo },
  });

  const readings = await store.readingsFor(record.id);
  // **A second inspection, over the range the *reading* was taken across.**
  // `work` above is built for the pull request, which after `rondo revise` is a
  // different range: `publish` compares against `pull_request_base_branch` --
  // the first lap's base, carried along the chain -- while the reader saw
  // `base_branch`, the predecessor's topic branch. The material digest covers
  // the base ref, the base commit, the commits and the files, so comparing the
  // two would report every unchanged revision as stale and send the operator to
  // an override as a matter of routine. That is this design's own falsifier
  // fired on the first day, and the fix is one query rather than a looser
  // comparison.
  const range = readingRangeOf(record);
  const asRead: LapWorkInspection =
    range === null
      ? {
          kind: "unreadable",
          part: "history",
          reason: "the row does not name the range a reading was taken across",
        }
      : await inspectLapWork(range);
  return {
    kind: "ready",
    plan: {
      workspace,
      remote: asked.remote,
      // `read` is the only shape that carries them, and the preflight has
      // already refused every other one.
      pushUrls: inspection.kind === "read" ? inspection.pushUrls : [],
      workFingerprint: {
        tipCommit: tip.tipCommit,
        // Only the history carries this, and a workspace with no base ref has
        // none to carry -- which is why the tip above is read separately.
        materialDigest: work.kind === "read" ? evidenceOf(work).materialDigest : null,
      },
      topicBranch,
      baseBranch,
      headRef: preflight.headRef,
      forgeRepo,
      runId,
      db,
      warnings: preflight.warnings,
      pullRequest,
      // The model reading beside the deterministic one, as material only
      // (D-0065 5.5): shown, and read by nothing that decides.
      modelReading: publishModelReadingLines(readings, await store.closingLapOf(record.id)),
      // Every reading but a model's (D-0065 5.5): a model reading is material
      // beside it and is not part of this refusal, and the interpreter's
      // `rondo/none` unavailable row still refuses with its own reason.
      reviewRefusal: reviewBlock(reviewedReading(readings), asRead),
      updates,
    },
  };
}

/**
 * The open pull request this lap's commits are pushed onto (rondo#417,
 * D-0105), or null where publishing opens one, or why it cannot be named.
 *
 * **Any lap below a published one continues that pull request.** A lap is
 * published only once approved and closed, so a lap after it in its line is a
 * conflict fix or a revise of one, whatever that lap itself takes in: a fix
 * that took the base in and was then revised hands its pull request on to the
 * revision (Codex round 1). The nearest published lap above is read from the
 * thread, rondo keeping no pull-request column: its address, and the branch
 * its line says it pushed onto or its own topic branch where it opened the
 * pull request. A pull request merged or closed since is not pushed onto, and
 * a thread that will not read is refused rather than opening a second one.
 */
export async function pullRequestUpdated(
  record: IterationRecord,
  store: Pick<IterationStore, "read">,
  thread: Pick<AdvisoryRecord, "threadMessages"> | null,
): Promise<{ readonly url: string; readonly onto: string } | { readonly refusal: string } | null> {
  if (record.supersedesIterationId === null) {
    return null;
  }
  const refusal = (why: string) => ({
    refusal: `lap '${record.id}' continues a line whose pull request ${why}, so nothing is published.`,
  });
  const read = thread === null ? null : await thread.threadMessages();
  if (read === null || read.kind !== "read") {
    return refusal("is named in the request's thread, which will not read");
  }
  const said = (id: string) => read.messages.find((one) => one.messageId === id);
  let up: string | null = record.supersedesIterationId;
  for (let hops = 0; up !== null && hops < LINEAGE_HOPS; hops += 1) {
    const above = await store.read(up);
    if (above.kind !== "read") {
      return refusal(`cannot be found: lap '${up}' above it will not read`);
    }
    const published = said(`report-published-${up}`);
    if (published !== undefined) {
      if (said(`report-merged-${up}`) !== undefined || said(`report-closed-${up}`) !== undefined) {
        return refusal("is merged or closed");
      }
      const url = pullRequestIn(published.body)?.url;
      const onto =
        /were pushed onto '([^']+)'/.exec(published.body)?.[1] ??
        planField(above.record, "topic_branch");
      return url === undefined || onto === ""
        ? refusal(`is not named with its branch by lap '${up}''s published line`)
        : { url, onto };
    }
    up = above.record.supersedesIterationId;
  }
  return null;
}

/**
 * Why the pull request a publish would push onto is not open on the forge now,
 * or null where it is (Codex round 2): the thread says a merge or a close only
 * once the checks host has read it, and git pushes onto a closed pull
 * request's branch -- or makes the branch again -- without a word.
 */
async function notOpenNow(url: string): Promise<string | null> {
  const read = await readPullRequest({ url });
  return read.kind !== "read"
    ? `the forge did not say whether ${url} is still open: ${read.reason}`
    : read.state !== "OPEN"
      ? `${url} is ${read.state.toLowerCase()} on the forge, so nothing was pushed onto it`
      : null;
}

/** How far up a line {@link pullRequestUpdated} walks: a lineage is never this long. */
const LINEAGE_HOPS = 64;

/**
 * The digest of one dry-run, over everything the screen draws from it.
 *
 * **It is the whole of what was shown and not a summary of it** (D-0042 rules 2
 * and 3): the press carries this back, the port re-plans and re-digests, and a
 * publish whose target, text, warnings, material or refusal has moved since the
 * screen was drawn is a different act wearing the same button.
 */
function publishShownDigest(plan: PublishPlan): string {
  return contentDigest({
    workspace: plan.workspace,
    remote: plan.remote,
    // Where the push actually goes, and not only what the remote is called: see
    // {@link PublishPlan.pushUrls}. Under `--allow-remote-mismatch` this is the
    // one field that moves when a remote is re-pointed at another repository.
    push_urls: [...plan.pushUrls],
    // What the work *is*, rather than what the pull request's text says about
    // it: see {@link PublishPlan.workFingerprint}.
    tip_commit: plan.workFingerprint.tipCommit,
    material_digest: plan.workFingerprint.materialDigest,
    topic_branch: plan.topicBranch,
    base_branch: plan.baseBranch,
    head_ref: plan.headRef,
    repo: plan.forgeRepo,
    run_id: plan.runId,
    // Acted on rather than shown, and covered all the same: the close goes to
    // this database, and a digest that left it out would let the one leg the
    // screen does not draw move under a press that matched everything else.
    db: plan.db,
    title: plan.pullRequest.title,
    body: plan.pullRequest.body,
    warnings: [...plan.warnings],
    model_reading: [...plan.modelReading],
    // The sentence rather than the shape, because the sentence carries every
    // fact the shape holds and nothing reads it back.
    review_refusal: plan.reviewRefusal === null ? null : reviewBlockSentence(plan.reviewRefusal),
    updates: plan.updates,
  });
}

/**
 * The message a lap was asked for in, as the person wrote it (rondo#376), or
 * null where there is no thread to read or it would not read.
 */
async function requestWordsOf(
  thread: Pick<AdvisoryRecord, "threadMessages"> | null,
  messageId: string,
): Promise<string | null> {
  if (thread === null) {
    return null;
  }
  const read = await thread.threadMessages();
  return read.kind === "read"
    ? (read.messages.find((message) => message.messageId === messageId)?.body ?? null)
    : null;
}

/**
 * How many plans the request was split into, as its approved scopes' drafted
 * proposals say (rondo#376, Codex round 2): more than one, and no single lap's
 * pull request is the whole of what the request asked for. One where nothing
 * says otherwise -- a lap started by hand, or a proposal that will not read.
 */
async function plansDraftedFor(
  thread: Pick<AdvisoryRecord, "scopesFor" | "readProposal"> | null,
  requestMessageId: string,
): Promise<number> {
  if (thread === null) {
    return 1;
  }
  let most = 1;
  for (const scope of await thread.scopesFor(requestMessageId)) {
    for (const basis of scope.bases) {
      const cited =
        typeof basis === "object" && basis !== null && !Array.isArray(basis)
          ? (basis as JsonRecord)
          : null;
      const proposalId = cited?.["form"] === "proposal" ? cited["proposalId"] : undefined;
      if (typeof proposalId !== "string") {
        continue;
      }
      const read = await thread.readProposal(proposalId);
      const split = read.kind === "read" ? readSplitPayload(read.proposal.payload) : null;
      if (split?.kind === "split") {
        most = Math.max(most, split.payload.plans.length);
      }
    }
  }
  return most;
}

/**
 * The dry-run as the page shows it, for one closed lap (rondo#233 S5).
 *
 * The reading half of the publish screen: the same {@link publishPlanFor} the
 * command line runs and the press runs, projected into what the renderer draws.
 */
export async function publishingForPage(
  environment: Readonly<Record<string, string | undefined>>,
  store: Pick<IterationStore, "read" | "readingsFor" | "verificationClaimsFor" | "closingLapOf">,
  asked: PublishAsked,
  record: IterationRecord,
  thread: Pick<AdvisoryRecord, "threadMessages" | "scopesFor" | "readProposal"> | null = null,
): Promise<PublishShown> {
  const planned = await publishPlanFor(record, asked, environment, store, thread);
  if (planned.kind === "refused") {
    return { kind: "refused", block: planned.block };
  }
  const plan = planned.plan;
  return {
    kind: "ready",
    shown: publishShownDigest(plan),
    target: {
      workspace: plan.workspace,
      remote: plan.remote,
      // **Redacted on the way to the screen, and not in the plan** (Codex round
      // 2). A push URL can carry a token in its userinfo, and a page is a thing
      // that is screenshotted, saved and pasted; the terminal already prints
      // these through the same redaction. What the digest compares stays the
      // URL git actually answered with, so a remote re-pointed at another
      // repository behind the same credentials still moves the digest.
      pushUrls: plan.pushUrls.map(redactRemoteUrl),
      topicBranch: plan.topicBranch,
      baseBranch: plan.baseBranch,
      headRef: plan.headRef,
      repo: plan.forgeRepo,
      runId: plan.runId,
    },
    title: plan.pullRequest.title,
    body: plan.pullRequest.body,
    warnings: plan.warnings,
    modelReading: plan.modelReading,
    review: plan.reviewRefusal,
    updates: plan.updates,
  };
}

/** Which refusal one {@link PublishBlock} is, in the page's vocabulary. */
function publishBlockRefusal(block: PublishBlock): PublishRefusal {
  switch (block.why) {
    case "notClosed":
      return "publishRefusedNotClosed";
    case "notApproved":
    case "answerNotApproval":
      return "publishRefusedNotApproved";
    case "noRun":
      return "publishRefusedNoRun";
    case "planField":
      return "publishRefusedPlanField";
    case "noRepo":
      return "publishRefusedNoRepo";
    case "target":
      return "publishRefusedTarget";
    case "statusUnreadable":
      return "publishRefusedStatusUnreadable";
    default:
      return "publishRefusedUncommitted";
  }
}

/** What a forge command's failure was, or null when it succeeded. */
function commandFailure(outcome: {
  readonly status: number | null;
  readonly stderr: string;
  readonly spawnError: string | null;
}): string | null {
  if (outcome.spawnError !== null) {
    return outcome.spawnError;
  }
  return outcome.status === 0 ? null : outcome.stderr.trim();
}

/**
 * One press of the page's *publish* button: the branch pushed, the pull request
 * opened and the run closed (rondo#233 S5, D-0060).
 *
 * **It is `commandPublish`'s three legs over a row it did not parse for**, the
 * way `reviseFromPage` is `commandRevise`'s: the preflight is literally the
 * same function ({@link publishPlanFor}), the legs are the same calls in the
 * same order, and what differs is only what a screen can do with a refusal.
 *
 * **The dry-run is read again here and compared with the one that was shown.**
 * D-0059 section 5a's Q1 makes the screen a precondition of the press, which is
 * only true while the screen and the press are about the same act -- so nothing
 * posted is believed except which lap this is and which digest was read, and a
 * plan that no longer matches publishes nothing and says so.
 *
 * **continuo is checked before anything is pushed.** The close is the third
 * leg, and a push that cannot be taken back followed by "there is no continuo
 * here" would leave a person with the one state this screen exists to avoid.
 */
export async function publishFromPage(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  approver: string,
  asked: PublishAsked,
  input: PublishInput,
): Promise<Published> {
  const already = publishing.get(input.iterationId);
  if (already !== undefined) {
    // `reviseFromPage`'s rule, for its reason: a double press of one screen is
    // one act, and a press carrying anything else is a second act that must not
    // join the first.
    return already.shown === input.shown && already.despiteReview === input.despiteReview
      ? await already.running
      : {
          ok: false,
          why: "publishRefusedStillRunning",
          note: `a publish of '${input.iterationId}' is already running, and it read something else`,
        };
  }
  const running = publishPage(environment, store, storePath, approver, asked, input);
  publishing.set(input.iterationId, {
    running,
    shown: input.shown,
    despiteReview: input.despiteReview,
  });
  try {
    return await running;
  } finally {
    publishing.delete(input.iterationId);
  }
}

/** Every publish press this process has in flight, by the lap it publishes. */
const publishing = new Map<
  string,
  { running: Promise<Published>; shown: string; despiteReview: boolean }
>();

async function publishPage(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  approver: string,
  asked: PublishAsked,
  input: PublishInput,
): Promise<Published> {
  const actor = approvedActor(approver, environment);
  if ("refusal" in actor) {
    return { ok: false, why: "publishRefusedNotStarted", note: actor.refusal };
  }
  const found = await store.read(input.iterationId);
  if (found.kind !== "read") {
    return {
      ok: false,
      why: "publishRefusedGone",
      note:
        found.kind === "absent"
          ? `There is no iteration '${input.iterationId}'.`
          : `That iteration row would not read: ${found.reason}`,
    };
  }
  const record = found.record;
  const planned = await publishPlanFor(
    record,
    asked,
    environment,
    store,
    openAdvisoryRecord(storePath),
  );
  if (planned.kind === "refused") {
    const block = planned.block;
    return {
      ok: false,
      why: publishBlockRefusal(block),
      note: planned.reason,
      ...(block.why === "target" || block.why === "statusUnreadable"
        ? { detail: block.reason }
        : block.why === "uncommitted"
          ? { detail: block.paths.join(", ") }
          : {}),
    };
  }
  const plan = planned.plan;
  if (publishShownDigest(plan) !== input.shown) {
    return {
      ok: false,
      why: "publishRefusedChanged",
      note: `what the screen showed for '${record.id}' is not what this publish would do now`,
    };
  }
  // **Both ways round, and both refusals.** A press that overrules nothing is a
  // person answering a question this screen did not ask, and a press that does
  // not overrule a refusal that is there would publish past it.
  if (plan.reviewRefusal === null && input.despiteReview) {
    return {
      ok: false,
      why: "publishRefusedNothingOverruled",
      note: `the reading of '${record.id}' covers this work, so there is nothing to overrule`,
    };
  }
  if (plan.reviewRefusal !== null && !input.despiteReview) {
    return {
      ok: false,
      why: "publishRefusedNotRead",
      note: reviewBlockSentence(plan.reviewRefusal),
    };
  }
  const startup = await startContinuo(environment);
  if (startup.kind === "refused") {
    return {
      ok: false,
      why: "publishRefusedNoContinuo",
      note: `continuo is not usable: ${startup.reason}`,
      detail: startup.reason,
    };
  }
  const continuo = startup.continuo;
  const closedSince = plan.updates === null ? null : await notOpenNow(plan.updates.url);
  if (closedSince !== null) {
    return { ok: false, why: "publishRefusedTarget", note: closedSince, detail: closedSince };
  }
  const pushed = await pushTopicBranch({
    workspace: plan.workspace,
    remote: plan.remote,
    topicBranch: plan.topicBranch,
    ...(plan.updates === null ? {} : { onto: plan.updates.onto }),
  });
  const pushFailed = commandFailure(pushed);
  if (pushFailed !== null) {
    return {
      ok: false,
      why: "publishRefusedPushFailed",
      note: `the branch '${plan.topicBranch}' did not push: ${pushFailed}`,
      detail: pushFailed,
    };
  }
  // A conflict fix opens nothing: the pull request it fixes is already open
  // (rondo#417, D-0105), and the push above moved its head.
  const opened =
    plan.updates === null
      ? await openPullRequest({
          repo: plan.forgeRepo,
          baseBranch: plan.baseBranch,
          headRef: plan.headRef,
          title: plan.pullRequest.title,
          body: plan.pullRequest.body,
        })
      : { status: 0, stdout: plan.updates.url, stderr: "", spawnError: null };
  const openFailed = commandFailure(opened);
  if (openFailed !== null) {
    // **The push already happened, and it is the one leg that cannot be undone
    // from here.** rondo does not persist how far a publish got -- that would
    // be a durable record of somebody else's state -- so what this cannot know
    // is whether the pull request was in fact created and only the reporting
    // failed. Pressing again is *not* free there: `gh` refuses a duplicate for
    // ever, and the run row stays open. So the screen says go and look, and the
    // one leg that would be left is said in the terminal `rondo web` runs in,
    // which is where `commandPublish` says it too (D-0015 rule 7's shape).
    say("");
    say(`The branch '${plan.topicBranch}' was pushed to '${plan.remote}'; that part is done.`);
    say("If the pull request already exists, the only leg left is the run close:");
    say(
      `  ${continuo.cliPath} run close --db ${plan.db} --run-id ${plan.runId} ` +
        `--outcome completed --actor-id ${actor.actorId}`,
    );
    return {
      ok: false,
      why: "publishRefusedPullRequestFailed",
      note: `the branch is pushed; the pull request was not opened: ${openFailed}`,
      detail: openFailed,
    };
  }
  // The close records the operator's observation that the work landed. It is
  // last because it is a claim about the other two having happened, and it is
  // not idempotent: continuo refuses a second close, on purpose.
  const closed = await closeRun(continuo, {
    db: plan.db,
    runId: plan.runId,
    outcome: "completed",
    actorId: actor.actorId,
  });
  if (closed.kind !== "answered") {
    // **Relayed, and not only returned** (Codex round 1, the rule S4's revise
    // press already follows): the screen's sentence sends a person to the
    // terminal `rondo web` runs in for the detail, so the detail has to be
    // there. `relayFailure` is where continuo's own diagnosis is printed for
    // every other verb, ASCII-escaped on the way out (`AGENTS.md`); its exit
    // status is nobody's here, because this surface answers with a refusal and
    // not a status.
    relayFailure("run close", closed);
    return {
      ok: false,
      why: "publishRefusedRunNotClosed",
      note: `the branch is pushed and the pull request is open; the run did not close`,
    };
  }
  await reportToRequest(
    { record: openAdvisoryRecord(storePath), store },
    record.id,
    // gh prints the new pull request's URL as the last line of its stdout.
    {
      kind: "published",
      pullRequestUrl: opened.stdout.trim().split("\n").at(-1) || null,
      ...(plan.updates === null ? {} : { onto: plan.updates.onto }),
    },
    Date.now(),
  );
  return { ok: true, note: "" };
}

/**
 * Door three: push the branch, open the pull request, close the run.
 *
 * **Every leg is the operator's, and the operator is who typed this.** Nothing
 * else in rondo reaches `./forge.ts`, no other command calls this function, and
 * there is no flag, environment variable or code path that makes any of it
 * happen without the word `publish` on a command line. Merging is not here.
 *
 * The three legs run in order and stop at the first failure, because each one
 * is the precondition of the next: there is no pull request to open for a
 * branch that did not push, and closing the run says the work landed.
 *
 * **Nothing is printed before the workspace has been asked whether the plan can
 * run.** `publishPreflight` holds the rules and says why they are there; what
 * matters here is the ordering -- the checks are ahead of the printing and
 * ahead of the `--dry-run` branch, so a preview cannot pass where the real run
 * would fail.
 */
async function commandPublish(
  parsed: ParsedCommand,
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  continuo: VerifiedContinuo,
  ports: ReportingPorts,
): Promise<number> {
  // **No `--repo` check here any more** (D-0081 rule 3.2). The repository is
  // the lap's plan's, and whether one was named at all is answered against that
  // plan in `publishPlanFor` -- so a flag missing where the plan carries a slug
  // is no longer a refusal, and a flag missing where it does not is refused
  // there, naming the iteration it is about.
  const actor = approvedActor(parsed.actorId, environment);
  if ("refusal" in actor) {
    return refuse(actor.refusal);
  }

  // **`publish` names its iteration and never infers it.** It acts on a
  // `closed` row, and a closed row is terminal and therefore never in the live
  // set -- so there has never been anything for the no-id path to find. Before
  // D-0023 that path answered "no iteration is live", which was confusing but
  // harmless. With more than one iteration open it would instead have selected
  // an unrelated *live* one and refused with a sentence about it, naming an
  // iteration that has nothing to do with what the operator meant to publish.
  // `answer` prints the id, so it is always to hand.
  if (parsed.iterationId === null) {
    return refuse(
      "publish needs --iteration-id ID. It publishes an iteration a person has already " +
        "approved at the gate, and an approved iteration is closed -- so it is never the one " +
        "that is 'live' and cannot be guessed from what is. 'rondo answer' prints the id.",
    );
  }
  const chosen = await pickWaiting(store, parsed.iterationId);
  if ("refusal" in chosen) {
    return refuse(chosen.refusal);
  }
  if (chosen.record === null) {
    return refuse(`${chosen.note} Name one with --iteration-id ID to publish a closed iteration.`);
  }
  const record = chosen.record;
  // **Every read and every refusal ahead of the push, as one function the page
  // runs too** (rondo#233 S5). The ordering doctrine this file states for the
  // preflight -- a preview must not pass where the real run would fail -- is
  // now a property of `publishPlanFor`: everything below is printing and the
  // three legs.
  const planned = await publishPlanFor(
    record,
    {
      repo: parsed.repo,
      remote: parsed.remote ?? DEFAULT_REMOTE,
      allowRemoteMismatch: parsed.allowRemoteMismatch,
    },
    environment,
    store,
    openAdvisoryRecord(storePath),
  );
  if (planned.kind === "refused") {
    return refuse(planned.reason);
  }
  const plan = planned.plan;
  const { workspace, remote, topicBranch, baseBranch, headRef, forgeRepo, runId, db } = plan;
  const pullRequest = plan.pullRequest;
  // **Before the first line is printed, and therefore before `--dry-run`
  // returns**: a review refusal a dry run hid would be the preflight's defect
  // with a different cause. `--despite-review` is the one thing that passes it.
  if (plan.reviewRefusal !== null && !parsed.despiteReview) {
    return refuse(reviewBlockSentence(plan.reviewRefusal));
  }

  say(`iteration '${record.id}' is closed; gate outcome '${record.gateOutcome ?? "(none)"}'`);
  if (parsed.despiteReview) {
    // Printed rather than silent: an override that leaves no trace on the run
    // that used it is an override nobody can audit afterwards, and the reading
    // it overrode is in the store either way.
    say("");
    say(
      "--despite-review: publishing without a clean reading of this work. That is yours to " +
        "decide; rondo is recording that you decided it.",
    );
  }
  for (const warning of plan.warnings) {
    say("");
    say(warning);
  }
  if (plan.modelReading.length > 0) {
    say("");
    for (const line of plan.modelReading) {
      say(line);
    }
  }
  say("");
  if (plan.updates === null) {
    say("publish runs these three, in order, as you:");
    say(`  1. git -C ${workspace} push ${remote} ${topicBranch}`);
    say(`  2. gh pr create --repo ${forgeRepo} --base ${baseBranch} --head ${headRef}`);
    say(`  3. continuo run close --run-id ${runId} --outcome completed`);
    say("");
    say("the pull request it opens reads:");
    say(`  title: ${pullRequest.title}`);
    say("  body:");
    for (const line of pullRequest.body.split("\n")) {
      say(line === "" ? "" : `    ${line}`);
    }
  } else {
    // rondo#417 (D-0105): a conflict fix moves the open pull request's head.
    say("publish runs these two, in order, as you, and opens no pull request:");
    say(`  1. git -C ${workspace} push ${remote} ${topicBranch}:refs/heads/${plan.updates.onto}`);
    say(`  2. continuo run close --run-id ${runId} --outcome completed`);
    say("");
    say(`the push moves the head of ${plan.updates.url}, which stays open.`);
  }
  say("");
  if (parsed.dryRun) {
    say("--dry-run: nothing was run.");
    return 0;
  }

  const closedSince = plan.updates === null ? null : await notOpenNow(plan.updates.url);
  if (closedSince !== null) {
    return refuse(closedSince);
  }
  const pushed = await pushTopicBranch({
    workspace,
    remote,
    topicBranch,
    ...(plan.updates === null ? {} : { onto: plan.updates.onto }),
  });
  if (!reportCommand("push the branch", pushed)) {
    return 1;
  }

  const opened =
    plan.updates === null
      ? await openPullRequest({
          repo: forgeRepo,
          baseBranch,
          headRef,
          title: pullRequest.title,
          body: pullRequest.body,
        })
      : {
          commandLine: "no pull request opened: the push moved the head of this one",
          status: 0,
          stdout: plan.updates.url,
          stderr: "",
          spawnError: null,
        };
  if (!reportCommand("open the pull request", opened)) {
    // **The push already happened, and it is the one leg that cannot be
    // undone from here.** Re-running `publish` re-runs the push harmlessly
    // (git answers "Everything up-to-date"), but a pull request that was in
    // fact created and then failed to be reported would be refused as a
    // duplicate on the second attempt, leaving the run row open with no way
    // forward through this command. rondo does not persist how far a publish
    // got -- that would be a durable record of somebody else's state -- so it
    // says instead exactly what is left and how to do it.
    say("");
    say(`The branch '${topicBranch}' was pushed to '${remote}'; that part is done.`);
    say("If the pull request already exists, the only leg left is the run close:");
    say(
      `  ${continuo.cliPath} run close --db ${db} --run-id ${runId} ` +
        `--outcome completed --actor-id ${actor.actorId}`,
    );
    return 1;
  }

  // The close records the operator's observation that the work landed. It is
  // last because it is a claim about the other two having happened, and it is
  // not idempotent: continuo refuses a second close, on purpose.
  const closed = await closeRun(continuo, {
    db,
    runId,
    outcome: "completed",
    actorId: actor.actorId,
  });
  if (closed.kind !== "answered") {
    return relayFailure("run close", closed);
  }
  say(`run ${closed.payload.runId}: ${closed.payload.from} -> ${closed.payload.to}`);
  if (ports.thread !== undefined && ports.thread !== null) {
    const reported = await reportToRequest(
      ports.thread,
      record.id,
      // gh prints the new pull request's URL as the last line of its stdout.
      {
        kind: "published",
        pullRequestUrl: opened.stdout.trim().split("\n").at(-1) || null,
        ...(plan.updates === null ? {} : { onto: plan.updates.onto }),
      },
      Date.now(),
    );
    if (reported !== null) {
      say(reported);
    }
  }
  say("");
  say("Published. rondo did not merge anything; that is still yours.");
  return 0;
}

/** Say what a forge command did. True when it succeeded. */
function reportCommand(
  what: string,
  outcome: {
    readonly commandLine: string;
    readonly status: number | null;
    readonly stdout: string;
    readonly stderr: string;
    readonly spawnError: string | null;
  },
): boolean {
  if (outcome.spawnError !== null) {
    relayUpstream(`rondo could not ${what}`, outcome.spawnError);
    return false;
  }
  if (outcome.status !== 0) {
    relayUpstream(
      `rondo could not ${what} (exit ${String(outcome.status)})`,
      outcome.stderr.trim(),
    );
    return false;
  }
  const said = outcome.stdout.trim();
  say(`  ok: ${outcome.commandLine}`);
  if (said !== "") {
    say(`  ${said}`);
  }
  return true;
}

/**
 * A handle that names no continuo, for the one command that drives none.
 *
 * `conductorPorts` wants a verified handle because every other port it wires
 * reaches a subprocess. `abandon` reaches none: it writes one terminal row and
 * returns (D-0019 rule 11). Handing it a handle whose paths are empty is
 * therefore not a shortcut around verification -- any verb reached through it
 * would be refused at the argument boundary before a process could start, which
 * is the property `test/continuo/invoker.test.ts` already holds open. What it
 * buys is that a stranded row can be settled on a machine whose continuo is
 * missing, broken, or no longer the pinned one.
 */
function unverifiedContinuo(): VerifiedContinuo {
  return { cliPath: "", revision: "" };
}

/** Door four, which is not a door: end an iteration rondo cannot finish. */
/**
 * The person's release press (D-0073 rule 4.3): a claim row of no paths,
 * authored by the operator. It ends the claim, not the iteration, so it is not
 * `abandon()`; whether the work landed is the person's judgement, recorded as
 * theirs by the row's operator author.
 */
async function commandRelease(
  parsed: ParsedCommand,
  store: IterationStore,
  environment: Readonly<Record<string, string | undefined>>,
): Promise<number> {
  if (parsed.iterationId === null) {
    return refuse("release needs --iteration-id ID.");
  }
  // The release is recorded as the person's judgement, so the person is the
  // one allowed to answer a gate, checked as every such press is.
  const actor = approvedActor(parsed.actorId, environment);
  if ("refusal" in actor) {
    return refuse(actor.refusal);
  }
  const outcome = await store.releaseLane({
    iterationId: parsed.iterationId,
    takenOver: null,
    // The person's press is never a landing: the line's numbers go with its
    // paths (D-0098 rule 3.4).
    landed: false,
    authorKind: "operator",
    authorId: actor.actorId,
    bases: [{ form: "iteration", iterationId: parsed.iterationId }],
    nowMs: Date.now(),
  });
  if (outcome.kind !== "released") {
    return refuse(
      `The line of iteration '${parsed.iterationId}' was not released: ${outcome.reason}.`,
    );
  }
  say(
    `Released the paths line ${outcome.lineageId} held. Other work in its repository may now ` +
      "take them; this line takes them back only if it is retried.",
  );
  return 0;
}

/**
 * One press of the page's *release* button: {@link commandRelease} over the
 * claim and laps the screen was drawn over (D-0073 rule 4.3, rondo#288).
 *
 * **What was shown is what is released.** The store refuses when the line's
 * in-force claim or its laps moved since the screen read them -- released
 * already, retried and holding again -- so a stale screen releases nothing
 * rather than a claim the person never saw. The actor is checked against the
 * approver as every press is, and the row is theirs (`operator`).
 */
export async function releaseFromPage(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  approver: string,
  input: ReleaseInput,
): Promise<Released> {
  const actor = approvedActor(approver, environment);
  if ("refusal" in actor) {
    return { ok: false, why: "releaseRefusedNotRecorded", note: actor.refusal };
  }
  const outcome = await store.releaseLane({
    iterationId: input.iterationId,
    takenOver: { claimId: input.claimId, lapIds: input.lapIds },
    landed: false,
    authorKind: "operator",
    authorId: actor.actorId,
    bases: [{ form: "iteration", iterationId: input.iterationId }],
    nowMs: Date.now(),
  });
  switch (outcome.kind) {
    case "released":
      say(`Released the paths line ${outcome.lineageId} held, on a press from the page.`);
      return { ok: true, note: "" };
    case "refused":
      return { ok: false, why: "releaseRefusedChanged", note: outcome.reason };
    default:
      return { ok: false, why: "releaseRefusedNotRecorded", note: outcome.reason };
  }
}

/**
 * Add the repository a request named, on a press from the page (rondo#383,
 * D-0090): clone it beside setup's other output, and record the plan setup
 * would have recorded for it, as `rondo setup-plan` records one.
 *
 * **Nothing is recorded unless everything before it worked** (D-0090 rule 4):
 * a clone that fails, a plan the reader refuses or a store that refuses the row
 * leave the store as it was, and say why in one of the refusals a person
 * answers differently. A clone that worked and a record that did not is picked
 * up by the next press, which uses the clone already there.
 */
export async function addRepositoryFromPage(
  environment: Readonly<Record<string, string | undefined>>,
  ports: Pick<DrafterPorts, "store"> & {
    readonly record: DrafterPorts["record"] & Pick<AdvisoryRecord, "recordSetupPlan">;
  },
  approver: string,
  input: AddRepositoryInput,
  clone: typeof cloneRepository = cloneRepository,
): Promise<AddedRepository> {
  const { record } = ports;
  const failed = (note: string): AddedRepository => ({
    ok: false,
    why: "addRepositoryRefusedFailed",
    note,
  });
  const actor = approvedActor(approver, environment);
  if ("refusal" in actor) {
    return failed(actor.refusal);
  }
  // **Only the repository the request names now, and only while rondo holds
  // none for it** (D-0090 rule 1.4): the form carries a name, and a stale page
  // or a hand-written post must not add one the request does not ask for.
  const where = (await requestRepository({ ...ports, now: Date.now }, input.requestMessageId)).work;
  if (where.kind !== "unheld" || where.repo !== input.repo) {
    return {
      ok: false,
      why: "addRepositoryRefusedChanged",
      note: `request '${input.requestMessageId}' does not name '${input.repo}' as a repository rondo holds no plan for`,
    };
  }
  const parts = repositoryParts(input.repo);
  if (parts === null) {
    return failed(`'${input.repo}' is not OWNER/NAME`);
  }
  // **Setup's newest plan is the one this host's facts are read from**: the
  // plan it recorded last is the one a person repaired last (D-0075 rule 2.3).
  const template = (await record.setupPlans()).toReversed().find((setup) => {
    const planned = readRunPlan(setup.plan);
    return planned.kind === "planned" && planned.plan.pullRequestBaseBranch === null;
  })?.plan;
  const root = template === undefined ? null : setupRootOf(template);
  if (template === undefined || root === null) {
    return {
      ok: false,
      why: "addRepositoryRefusedNoSetup",
      note: "the store holds no setup plan to add a repository beside",
    };
  }
  const into = cloneDirectory(root, parts.owner, parts.name);
  const cloned = await clone(input.repo, into);
  for (const step of [cloned.clone, cloned.branch, cloned.files]) {
    if (step === null) {
      continue;
    }
    const failure = forgeCommandFailure(step);
    if (failure !== null) {
      return {
        ok: false,
        why:
          failure.why === "no_gh" || failure.why === "signed_out"
            ? "addRepositoryRefusedInstall"
            : failure.why === "missing" || failure.why === "refused"
              ? "addRepositoryRefusedUnseen"
              : "addRepositoryRefusedFailed",
        note: failure.detail,
      };
    }
  }
  const baseBranch = cloned.branch?.stdout.trim() ?? "";
  if (baseBranch === "") {
    return failed(`${into}: the clone's HEAD is on no branch`);
  }
  const files = (cloned.files?.stdout ?? "").split("\n").filter((name) => name !== "");
  const plan = planForRepository(template, {
    root,
    repo: input.repo,
    ...parts,
    into,
    baseBranch,
    allowedBash: allowedCommandsFor(files),
  });
  const planned = readRunPlan(plan);
  if (planned.kind !== "planned") {
    return failed(`the plan for ${input.repo} was refused: ${planned.reason}`);
  }
  const recorded = agentTypeRecordOf(planned.plan, plan);
  if ("refusal" in recorded) {
    return failed(`the plan for ${input.repo} builds no agent type: ${recorded.refusal}`);
  }
  const atMs = Date.now();
  const written = await record.recordSetupPlan({
    setupId: `setup-${String(atMs)}`,
    plan,
    recordedBy: actor.actorId,
    recordedAtMs: atMs,
  });
  if (written.kind !== "recorded") {
    return failed(written.reason);
  }
  say(`Added ${input.repo} at ${into} on a press from the page.`);
  return { ok: true };
}

async function commandAbandon(
  parsed: ParsedCommand,
  ports: ReturnType<typeof conductorPorts>,
): Promise<number> {
  if (parsed.iterationId === null) {
    return refuse("abandon needs --iteration-id ID.");
  }
  if (parsed.reason === null || parsed.reason === "") {
    return refuse(
      "abandon needs --reason TEXT. The reason is the only record of why a row was settled by " +
        "hand, and a blank one makes the row unexplainable later.",
    );
  }
  const report = await abandon(ports, parsed.iterationId, parsed.reason);
  sayReport(report);
  // **`abandoned` or nothing.** A report with any other status is a settlement
  // that did not happen -- the row was absent, or the store refused the
  // terminal write and the single-flight lock is still held. Exiting 0 there
  // would tell an operator, and any script wrapping this, that a recovery
  // succeeded while the thing it was recovering from is still in place.
  if (report.status !== "abandoned") {
    return refuse(
      `iteration '${parsed.iterationId}' was not abandoned. Nothing was settled, and if it was ` +
        "holding the single-flight lock it still is.",
    );
  }
  say("");
  say(
    "rondo closed nothing upstream. If a gate is still open, closing it is yours; if the " +
      "continuo run is still open, closing it is yours.",
  );
  return 0;
}
