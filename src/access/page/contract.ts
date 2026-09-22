/**
 * What the page is handed and what it hands back: the types the renderer, its
 * screens and `src/access/cli.ts` all name (rondo#341 step 1).
 *
 * **Here so that a screen does not have to import the renderer to be typed.**
 * `screens/publish.tsx`, `screens/release.tsx` and `screens/scope.tsx` are
 * drawn by `src/access/web.tsx` and used to read their own contract back out of
 * it, which made the import graph a cycle. Nothing about a `PublishShown` or a
 * `WebPorts` belongs to the module that renders them -- they are the words the
 * caller, the renderer and the screens agree on -- so they live below the
 * renderer and everything names them from here.
 *
 * **Types only, and no value.** A module of declarations emits nothing, so
 * nothing here can be the thing that runs first or last.
 */

import type { LapLogReading } from "../../continuo/transcript.js";
import type { HostPolicy } from "../../refrain/policy.js";
import type { GateAnswer, IterationRecord, ThreadMessageDraft } from "../../store/records.js";
import type { AdvisoryRecord, IterationStore } from "../../store/sqlite.js";
import type { LapWorkInspection } from "../forge.js";
import type { InboxReadPorts } from "../inbox.js";
import type { NamedIssue, WorkRepository } from "../issue-read.js";
import type { Chrome } from "../wording.js";

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
    | "read"
    | "readLive"
    | "readingsFor"
    | "occupancy"
    | "terminalIterations"
    | "verificationClaimsFor"
    // D-0073 rule 12: what each line holds, and whether its work landed.
    | "laneLedger"
    // D-0098 rule 1: whether a drafted plan's `first` has landed.
    | "landingOf"
  >;
  readonly record: InboxReadPorts["record"] &
    Pick<
      AdvisoryRecord,
      | "admissionRefusals"
      | "threadMessages"
      // rondo#233 S3: the budgets read a digest's tier back from the held
      // record (D-0069 section 1), and the scope screen's second state reads
      // the approval the press wrote and what a predecessor of it spent
      // (D-0066 rules 1.4 and 3.4).
      | "heldAgentType"
      // rondo#238: the plans a person picks from are the ones rondo holds,
      // setup's among them (D-0075 rule 2.3).
      | "heldAgentTypeDigests"
      | "setupPlans"
      // rondo#238 C2b: the drafted scope, its split, and whether a drafted
      // plan can start -- the scope's own verdict, read and never acted on.
      | "scopesFor"
      | "readProposal"
      | "openAsksIn"
      | "lineageOf"
      // D-0083 rule 6's fifth item: what rondo decided without asking about
      // *this request*, which the week's figure cannot answer (rondo#350).
      | "withheldFor"
      | "readScope"
      | "readScopeDecision"
      | "scopeDecisionOf"
      | "scopeSpent"
      | "scopeSupersededByApproved"
      // rondo#233 S4: the gate's revise offers the approval this lap was
      // admitted under, so nobody copies a decision id (D-0070 section 1.2).
      | "scopeDecisionAdmitting"
      // D-0074 section 2: and that approval's approved tip, once raised.
      | "scopeTip"
      // D-0077 rule 2.2: the revise draft that holds the lap's latest model
      // reading, which is what the box is filled from.
      | "reviseDraftFor"
      // D-0097: the goals and the latest proposal of what to ask next, which
      // the empty centre draws under the request box.
      | "goals"
      | "latestTriage"
    >;
  readonly policy: HostPolicy;
  readonly actorId: string | null;
  /**
   * The tag this host stated about its one operator, or null when it stated
   * nothing (D-0055 rule 5, D-0056 rules 2 and 3).
   *
   * **A tag and no longer a set, which is the whole of what D-0056 rule 3 costs
   * this interface.** D-0055 resolved the variable at boot and handed the page
   * the wording; under rule 2 the variable is one *step* of five, and a step
   * that names a tag no set resolves to has to be a step that said nothing so
   * that the browser's list answers instead. A `Chrome` cannot say that -- it
   * is `EN` both for a host that asked for English and for a host that asked
   * for German -- so what arrives is the tag, and {@link resolveLanguage} does
   * the lookup once per request beside the other four steps.
   *
   * Still read from `RONDO_OPERATOR_LANGUAGE` beside `RONDO_APPROVER`, in the
   * one place rondo's other deployment facts are read, and still refused there
   * if it is not a tag (D-0056 rule 9).
   */
  readonly hostLanguage: string | null;
  /**
   * What the lap actually did, as `rondo answer` lists it (D-0029 rule 2).
   *
   * A function for the answer port's reason turned the other way round: the
   * material is read out of a workspace with `git`, and a page that could spawn
   * one would have a capability nothing on this surface should hold. So the
   * caller reads it and this module renders it.
   *
   * It is shown **where the button is** and nowhere else, because the button is
   * where it is needed: a screen that is easier to reach than the terminal must
   * not also be the screen that asks for less before it writes.
   */
  readonly material: LapMaterial | null;
  /**
   * What publishing one lap would do, or null when the host named no forge
   * repository: no repository, no publish screen, and the page says which
   * (D-0020 rule 2's shape, rondo#233 S5).
   */
  readonly publishing: PublishReading | null;
  /**
   * Whether the host holds a release press (D-0073 rule 4.3): true exactly
   * where the release port is not null, so no way to it is drawn where every
   * press would be refused. Absent is false.
   */
  readonly releasable?: boolean;
  /**
   * Whether the host holds a merge press (rondo#380, `D-0091`): true exactly
   * where the merge port is not null, so no merge button is drawn where every
   * press would be refused. Absent is false.
   */
  readonly mergeable?: boolean;
  /**
   * The repositories rondo triages (D-0097, `D-0081`): the empty centre draws
   * one block for each. Absent is none, and then no triage section is drawn.
   */
  readonly triageRepositories?: () => Promise<readonly string[]>;
  /**
   * Whether the host holds the goal and *not now* presses: true exactly where
   * their port is not null. Absent is false.
   */
  readonly triageWritable?: boolean;
  /**
   * A running lap's log, read at the directory `locateTranscript` named
   * (rondo#248 item 3). A function for {@link LapMaterial}'s reason: the
   * renderer opens no file, and what it is handed reads two named files under
   * a directory rondo composed from the row, never a path from a request.
   */
  readonly readLog: (directory: string) => LapLogReading;
  /**
   * The operator messages whose named issues the host has not read yet
   * (D-0078 section 4.3), or absent where no reader runs, and then no message
   * is said to be waiting on one.
   */
  readonly issuesUnread?: (
    messages: readonly ThreadMessageDraft[],
  ) => Promise<ReadonlyMap<string, readonly NamedIssue[]>>;
  /**
   * Which repository a request's work runs in (rondo#383, D-0090), with the
   * held ones whose worker can run no build or test (`requestRepository`), or
   * absent where nothing reckons it, and then the thread says nothing of it.
   */
  readonly repositoryFor?: (
    requestMessageId: string,
  ) => Promise<{ readonly work: WorkRepository; readonly unbuilt: readonly string[] }>;
  /**
   * Whether the host holds the add-repository press: true exactly where its
   * port is not null, as {@link releasable} is. Absent is false.
   */
  readonly addable?: boolean;
}

/**
 * The lines `rondo answer` prints about the work itself, for one iteration, in
 * the language this request resolved to (D-0056 rule 12).
 *
 * **The set is an argument and not something the port was built with.** It was
 * a closure over the host's set at `src/access/cli.ts`, which was correct while
 * the page had one language for the life of the process and wrong the moment a
 * request can switch it: the fence block's two standing sentences are prose
 * (D-0055 rule 11), and a page that had switched would have shown them in the
 * host's language inside a document declaring another.
 */
export type LapMaterial = (wording: Chrome, record: IterationRecord) => Promise<LapMaterialRead>;

/**
 * What {@link LapMaterial} reads, in the two shapes the answer view draws it in
 * (#220 S2).
 *
 * **Structured where the page lays it out, and the lines whole beside it.**
 * `why` and `work` are what the rows are built from -- never text parsed back
 * out of `lines` -- and `lines` is `rondo answer`'s own material, kept in a fold
 * so nothing D-0029 rule 2 asks for leaves the page when the layout does not
 * draw it.
 */
export interface LapMaterialRead {
  readonly lines: readonly string[];
  /** The gate's rationale, the worker's own words; null when it was not read. */
  readonly why: string | null;
  /** What `git` reported about the lap's work; null when the row names no range. */
  readonly work: LapWorkInspection | null;
  /**
   * Whether the work reached past the files it keeps to itself (D-0073 rule
   * 5), or absent where the caller has nothing that compares them -- and then
   * the screen says nothing about it rather than saying it found nothing.
   */
  readonly reach?: ClaimReach;
}

/**
 * The gate's comparison of what the work changed against the files it keeps,
 * in the terms this screen may draw (rondo#294).
 *
 * **Flat, and with no line named.** The comparison's own result carries the
 * lines it found by their identifiers, and an identifier is the one thing this
 * page never puts in front of a person (`D-0076` sections 2 and 3). What the
 * person can act on is the paths -- theirs, and shown as themselves -- and
 * whether something else is changing them too, so that is what crosses.
 *
 * `reason` on `unread` is rondo's own and in English: the screen says the
 * comparison did not happen in the person's words and keeps the reason in the
 * fold for whoever maintains rondo (`D-0076` rule 4.5).
 */
export type ClaimReach =
  | { readonly kind: "inside" }
  | { readonly kind: "unread"; readonly reason: string }
  | {
      readonly kind: "outside";
      /** Changed here and kept by other work: the two will clash at merge. */
      readonly collided: readonly string[];
      /** Changed here, outside what this work keeps, and kept by nobody. */
      readonly unheld: readonly string[];
    };

/**
 * What a publish would do, read at render and again inside the press
 * (rondo#233 S5, D-0059 section 5a's Q1: `publish` is pressed only from a
 * screen that already shows its dry-run result).
 *
 * A function for {@link LapMaterial}'s reason: publishing is read out of a
 * workspace with `git` and out of the forge's own configuration, and a renderer
 * that could spawn either would hold a capability nothing on this surface
 * should hold. The caller reads it and this module renders it.
 */
export type PublishReading = (record: IterationRecord) => Promise<PublishShown>;

/**
 * Why a publish cannot be planned at all, structured so that each surface says
 * it in its own words.
 *
 * **Declared here, beside the screen that words them, and produced in
 * `src/access/cli.ts`** -- {@link LapMaterialRead}'s split, for a sharper
 * reason: the command line's sentences name flags, and a flag is a terminal,
 * which is the one place D-0059 must never send a person.
 */
export type PublishBlock =
  | { readonly why: "notClosed"; readonly status: string }
  | { readonly why: "notApproved"; readonly outcome: string | null }
  /**
   * The gate was answered, but not with an approval rondo recorded (D-0092):
   * `revise` where the person asked for a change, null where the lap predates
   * the record and rondo cannot tell which answer it was.
   */
  | { readonly why: "answerNotApproval"; readonly answer: GateAnswer | null }
  | { readonly why: "noRun" }
  | { readonly why: "planField"; readonly field: string }
  /**
   * No repository to publish to: the plan names none and the host was told
   * none either (D-0081 rule 3.2).
   *
   * **A fact about this lap, which is why it is a block and not a missing
   * screen.** Before `D-0081` the repository was the host's and a host without
   * one offered no publish screen at all ({@link Chrome.publishNotOffered}).
   * Now one host serves several repositories, so the question is answered per
   * lap -- and the lap that cannot be published is the one that says so.
   */
  | { readonly why: "noRepo" }
  | { readonly why: "target"; readonly reason: string }
  /**
   * `git status` failed, so what the push would leave behind is unknown
   * (D-0099). Its own arm because its answer is repairing the workspace,
   * not the paths; and, like `uncommitted`, no press here overrules it.
   */
  | { readonly why: "statusUnreadable"; readonly reason: string }
  | {
      readonly why: "uncommitted";
      /** The paths git reported, which is what D-0060 rule 4 refuses over. */
      readonly paths: readonly string[];
      /** What the workspace has checked out, when it is not the topic branch. */
      readonly elsewhere: string | null;
    };

/**
 * Why the recorded reading does not cover what would be pushed, or null when it
 * does (D-0060 rules 4 and 5).
 *
 * Carried and not acted on: it is the one refusal on this screen a person may
 * overrule, and overruling it is a press of its own.
 */
export type ReviewBlock =
  | { readonly why: "noReading" }
  | {
      readonly why: "notClear";
      readonly verdict: string;
      readonly findings: readonly string[];
      readonly unavailableReason: string | null;
    }
  | { readonly why: "noEvidence" }
  | { readonly why: "unreadable"; readonly reason: string }
  | { readonly why: "moved"; readonly readTip: string; readonly nowTip: string };

/** Where the work would go, in the four names the screen says it with. */
export interface PublishTarget {
  readonly workspace: string;
  readonly remote: string;
  /**
   * Where a push to that remote actually goes, as git resolved it, with any
   * credentials in it replaced.
   *
   * **Shown because it is digested** (Codex round 1): the press refuses when the
   * destination has moved since the screen was drawn, and a screen that named
   * only the remote would be refusing over something it never showed.
   *
   * **Redacted, because a page is kept** (Codex round 2): a push URL can carry
   * a token in its userinfo, and what the digest compares is the unredacted URL
   * the caller holds, never this.
   */
  readonly pushUrls: readonly string[];
  readonly topicBranch: string;
  readonly baseBranch: string;
  /** What the forge is given as the head: the branch, or `owner:branch`. */
  readonly headRef: string;
  /** `HOST/OWNER/NAME`, the host that was checked and not one resolved twice. */
  readonly repo: string;
  readonly runId: string;
}

/** What {@link PublishReading} read: the dry-run, or why there is not one. */
export type PublishShown =
  | { readonly kind: "refused"; readonly block: PublishBlock }
  | {
      readonly kind: "ready";
      /**
       * The digest of everything below, which the press carries back.
       *
       * **What was shown is what may be published** (D-0042 rules 2 and 3): the
       * press re-reads the whole dry-run and refuses when the two disagree, so
       * the screen cannot become a description of a different act while a
       * person is reading it.
       */
      readonly shown: string;
      readonly target: PublishTarget;
      readonly title: string;
      readonly body: string;
      /** Preflight's own warnings: true, and none of them fatal. */
      readonly warnings: readonly string[];
      /** The model's reading, as material beside the rest (D-0065 rule 5.5). */
      readonly modelReading: readonly string[];
      readonly review: ReviewBlock | null;
    };

/** A scope id minted for one form (`newScopeId` in `src/access/web-app.ts`). */
export type MintScopeId = () => string;

/** A lap id minted for one scoped start (`newIterationId` in `src/access/web-app.ts`). */
export type MintIterationId = () => string;

/** A message id minted for one form (`newMessageId` in `src/access/web-app.ts`). */
export type MintMessageId = (kind: "request" | "reply") => string;
