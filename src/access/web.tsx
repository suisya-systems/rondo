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
 * a single capability (`AnswerPort`, in `src/access/web-app.ts`) rather than a store: the page's
 * writing vocabulary is one sentence long, and widening it is a visible change
 * to a type. No type can tell an unattended redraw from a human's click -- they
 * differ in whether somebody was at the keyboard, which is not in the data -- so
 * two runtime facts do it instead. **D-0054 amended one of them, and narrowed
 * what the pair guarantees.** Two of the three views now carry a library that
 * `GET`s its own address every five seconds and swaps the ledger in place
 * ({@link isLive}; htmx since D-0059 R2), so *"nothing here can emit a `POST`"*
 * has stopped being true of this page -- and D-0059 section 5 moved the rest of
 * it into the write port, which mints a press only from a person's navigation. What still holds -- and what D-0042's invariant now rests
 * on alone -- is the server half of the same fact: a `GET` reaches this
 * renderer, this renderer holds only the read ports, and the compiler says so,
 * so an unattended redraw writes nothing because the code path it reaches
 * cannot write. The forged cross-site `POST` is left to the other two facts,
 * which are untouched: a token minted when this process began listening,
 * rendered into the form and checked on the way in, so a `POST` that carries
 * it came from a page this process served; and `frame-ancestors 'none'` on the
 * way out. That is two facts where there were three, and D-0054 rule 4 accepts
 * it knowingly rather than discovering it.
 *
 * **So the press, and not the render, is this surface's presentation**
 * (D-0042). The framing beside the button is written to the ledger before the
 * gate is answered, by the same `explain` writer the terminal uses -- and if it
 * cannot be written, nothing is answered and the person is told, which is
 * D-0022 rule 18's order applied to a page that had already drawn what it was
 * about to act on. It happens inside the answer port rather than here for
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
 *
 * **This module renders and negotiates; it does not serve** (D-0059 rule 2).
 * The server -- routing, the `Host` check, the security headers, the press and
 * the one write route -- is `src/access/web-app.ts`, on Hono. What stays here
 * is rondo's content and D-0056's five steps (D-0059 rule 4), both of which are
 * functions of values and not of a socket, which is also why none of this
 * module's tests needs one.
 *
 * **The markup is server JSX and the look is Tailwind** (D-0059 rules 1 and 2).
 * The strings are the ones this module always drew -- every claim, basis, lap
 * line, fence line and catalogue sentence -- in the elements section 1's bar
 * names: one row per lap with a leading glyph, a state pill and a muted
 * right-aligned column; groups labelled with their counts; a short filled call
 * to action; the press in a bar that stays in reach. `page/app.css` holds both
 * palettes, and the build compiles the classes named in this file.
 */

import { raw } from "hono/html";
import {
  type AdvisorySnapshot,
  BASIS_FORMS,
  type Basis,
  type Claim,
  propose,
  UNDETERMINED,
} from "../advisory/proposal.js";
import type { LapLogReading } from "../continuo/transcript.js";
import type { HostPolicy } from "../refrain/policy.js";
import {
  approvedForPublication,
  type FindingSeverity,
  findingBasisText,
  type IterationRecord,
  isApprovableKind,
  isModelReadingDrafter,
  isTerminal,
  type LapReading,
  latestReading,
  MODEL_READING_DRAFTER_PREFIX,
  type NonTerminalStatus,
  readingCoverage,
  reviewedReading,
  type ScopePayload,
  type ScopeSpent,
  type ThreadMessageDraft,
  WAIT_SIDE,
} from "../store/records.js";
import type { AdvisoryRecord, IterationStore } from "../store/sqlite.js";
import { basisLine, gather } from "./advisory.js";
import type { LapWorkInspection } from "./forge.js";
import { ago, gatherInbox, type InboxReadPorts, type LiveRow } from "./inbox.js";
import {
  type ForgeRead,
  type IssueComment,
  issueName,
  type NamedIssue,
  parseForgeRead,
} from "./issue-read.js";
import { isModelDrafterName } from "./model-draft.js";
import { EmptyCentre } from "./page/empty.js";
import { EmptySide, type SideWork } from "./page/empty-side.js";
import { GovernanceLine } from "./page/governance.js";
import { RequestsFace } from "./page/list.js";
import { facesMarkup } from "./page/render.js";
import { Raw } from "./page/shell.js";
import { ThreadFace, type ThreadItem, type ThreadLink } from "./page/thread.js";
import { folds } from "./page-logic/event-fold.js";
import { allowanceOf, governanceOf } from "./page-logic/governance.js";
import {
  decodedDenials,
  endedRecently,
  type LapUnderRequest,
  materialLanguage,
  saysMore,
} from "./page-logic/laps.js";
import { repositoryOf, requestList, rowStateOf } from "./page-logic/list.js";
import { isLive, type PageView, viewHref } from "./page-logic/routes.js";
import { selectRequest, walkPosition } from "./page-logic/selection.js";
import { lapEvents } from "./page-logic/thread-events.js";
import { firstLine, lineOf, replyTarget, type Threads, threadsOf } from "./page-logic/threads.js";
import { stepsOf, WEEK_MS, weekFigures } from "./page-logic/week.js";
import { denialLine, LIST_LIMIT } from "./review.js";
import { reviseText } from "./revise-draft.js";
import { approvalTip, budgetRefusal } from "./scope.js";
import { publishView } from "./screens/publish.js";
import { releaseView } from "./screens/release.js";
import { scopeView } from "./screens/scope.js";
import { type Chrome, EN, SHIPPED_SETS } from "./wording.js";

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
}

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

/**
 * The one word the button carries (D-0041 rule 7).
 *
 * Read from this constant on the way *in* rather than from the posted form: the
 * form's own `body` field is not trusted, so the page's writing vocabulary is
 * one word whatever a hand-written request says.
 */
export const APPROVE_BODY = "approve";

/** How often a live view redraws itself, in seconds: the `<noscript>` refresh and htmx's `every 5s`. */
const REFRESH_SECONDS = 5;

/**
 * The design vocabulary, as class strings the Tailwind build can read (D-0059
 * sections 1 and 2).
 *
 * **Written out in full and never assembled**, because `page/app.css` compiles
 * only the class names that appear literally under `src/access/**\/*.tsx`: a
 * class built from a template would be served as markup and never as CSS. The
 * tokens they name (`wait`, `run`, `ok`, `fail`, `faint`, ...) are declared in
 * `page/app.css` in both palettes, so nothing here decides a colour for one
 * mode only.
 *
 * **A marker class leads each string where a test or a reader finds an element
 * by it** (`request`, `basis`, `line`, `label`, `value`, `material`). None is a
 * Tailwind utility, so it names the element and styles nothing.
 */
export const PILL =
  "inline-flex shrink-0 items-center rounded-full border px-2 py-px font-mono text-meta font-medium leading-4 whitespace-nowrap";

/** One tone per state, which is the whole of what a pill says (section 1, Vercel's row). */
export const TONE = {
  wait: "border-wait/40 bg-wait-wash text-wait-ink",
  run: "border-run/35 bg-run-wash text-run-ink",
  ok: "border-border text-ok",
  fail: "border-fail/40 text-fail",
  muted: "border-border text-muted-foreground",
  revise: "border-wait/40 text-wait-ink",
} as const;

export type Tone = keyof typeof TONE;

/** The one filled button shape, at two sizes: the way to a press, and the press. */
export const PRIMARY =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-wait font-semibold text-wait-foreground shadow-xs outline-none hover:bg-wait/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

/**
 * The same shape, outlined: the gate's second answer beside its first
 * (rondo#233 S4).
 *
 * **Outlined and not filled, and not because it matters less.** Two filled
 * buttons in one bar read as a choice with a default, and D-0065's gate has no
 * recommendation; one filled and one outlined reads as the common answer and
 * the other one, which is what the two are.
 */
export const SECONDARY =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background font-semibold text-foreground shadow-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

/** A row focusable by `j`/`k` that is not a list item: the answer view's claim groups. */
const FOCUS_ROW =
  "outline-none focus-visible:bg-accent focus-visible:shadow-[inset_3px_0_0_var(--color-ring)]";

/**
 * A status glyph, drawn by the page rather than fetched (section 1: "a status
 * glyph in a leading column").
 *
 * Inline SVG rather than an icon package, because five shapes are fewer lines
 * than the dependency (D-0059 rule 5's ladder), and `aria-hidden` because the
 * state is also the pill's text beside it: the glyph is for the eye across the
 * room and never the only carrier.
 */
function glyph(tone: Tone | "alert" | "message") {
  const color = {
    wait: "text-wait",
    run: "text-run",
    ok: "text-ok",
    fail: "text-fail",
    muted: "text-faint",
    revise: "text-wait",
    alert: "text-fail",
    message: "text-faint",
  }[tone];
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={`mt-0.5 size-4 shrink-0 ${color}`}
    >
      {tone === "wait" ? (
        <>
          <circle cx="8" cy="8" r="6.2" />
          <circle cx="8" cy="8" r="2.4" fill="currentColor" stroke="none" />
        </>
      ) : tone === "run" ? (
        <>
          <circle cx="8" cy="8" r="6.2" opacity="0.3" />
          <path d="M8 1.8a6.2 6.2 0 0 1 6.2 6.2" class="origin-center motion-safe:animate-spin" />
        </>
      ) : tone === "ok" ? (
        <>
          <circle cx="8" cy="8" r="6.2" />
          <path d="m5.4 8.2 1.8 1.8 3.4-3.6" />
        </>
      ) : tone === "fail" ? (
        <>
          <circle cx="8" cy="8" r="6.2" />
          <path d="m5.8 5.8 4.4 4.4m0-4.4-4.4 4.4" />
        </>
      ) : tone === "revise" ? (
        <path d="M13.2 6.4A5.4 5.4 0 1 0 13.4 9M13.6 2.8v3.8H9.8" />
      ) : tone === "alert" ? (
        <path d="M8 2.2 14.2 13H1.8L8 2.2Zm0 4.3v2.8m0 2v.1" />
      ) : tone === "message" ? (
        <path d="M2.5 4.3c0-1 .8-1.8 1.8-1.8h7.4c1 0 1.8.8 1.8 1.8v5c0 1-.8 1.8-1.8 1.8H7.2L4.4 13.5v-2.4h-.1c-1 0-1.8-.8-1.8-1.8Z" />
      ) : (
        <>
          <circle cx="8" cy="8" r="6.2" />
          <path d="m3.8 12.2 8.4-8.4" />
        </>
      )}
    </svg>
  );
}

/** The tone of any lap by its status: the reading's folds use it for their glyph. */

/**
 * Claims under the basis they rest on, each basis written once (rondo#91).
 *
 * Consecutive claims are grouped, never reordered: the order of the claims is
 * the payload's own and rondo does not rank them, so a grouping that sorted by
 * basis would be this surface inventing an emphasis the drafter did not have.
 *
 * **A definition list, two columns wide and one column narrow**: the label is
 * the muted term and the value is what a person reads, so the eye runs down the
 * values and not across a sentence. The basis heads its group in mono, because
 * it is a locator and not prose.
 */
function claimsView(claims: readonly Claim[], snapshot: object, focusable = false) {
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
  return (
    // **One line per claim, with its basis as the trailing muted cell** (the
    // design pass on #220): the basis still comes first in the document, so a
    // reader without CSS meets the locator above the claims it covers, and only
    // `order-last` moves it to the right. A value that is `undetermined` is
    // drawn in faint ink and never folded away: the press records every claim
    // as shown (D-0042), so every claim stays on the screen.
    //
    // **The basis is a locator and is drawn as one** (the third design pass):
    // smaller than the value and trailing it at every width -- under `sm` it
    // follows the claims rather than heading them, where above them it doubled
    // each row's height. An `undetermined` row is a step tighter and fainter,
    // so the rows that carry a value are the ones the eye lands on. Where the
    // claims are the answer view's, each group is a `j`/`k` stop.
    <div class="divide-y divide-border rounded-md border border-border">
      {groups.map((group) => (
        <div
          class={`flex flex-col sm:flex-row sm:items-start ${focusable ? FOCUS_ROW : ""}`}
          {...(focusable ? { "data-row": "", tabindex: -1 } : {})}
        >
          {/* One quiet line, cut with an ellipsis; the whole locator is its `title`. */}
          <p
            class="basis order-last truncate px-3 pb-1.5 font-mono text-[10px] leading-4 text-faint/75 sm:w-[32%] sm:shrink-0 sm:py-2 sm:text-right"
            title={withoutRepeat(group)}
          >
            {withoutRepeat(group)}
          </p>
          <dl class="min-w-0 flex-1 divide-y divide-border/60">
            {group.claims.map((claim) => (
              <div
                class={
                  claim.value === UNDETERMINED
                    ? "claim grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 px-3 py-1 sm:grid-cols-[minmax(8rem,11rem)_minmax(0,1fr)] sm:gap-x-4"
                    : "claim grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 px-3 py-1.5 sm:grid-cols-[minmax(8rem,11rem)_minmax(0,1fr)] sm:gap-x-4"
                }
              >
                <dt
                  class={
                    claim.value === UNDETERMINED
                      ? "label text-[12px] leading-5 text-faint"
                      : "label text-[12.5px] leading-5 text-muted-foreground"
                  }
                >
                  {claim.label}
                </dt>
                <dd
                  class={
                    claim.value === UNDETERMINED
                      ? "value text-[12px] leading-5 wrap-anywhere whitespace-pre-wrap text-faint italic"
                      : "value text-[13px] leading-5 font-medium wrap-anywhere whitespace-pre-wrap"
                  }
                >
                  {claim.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
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
function fenceLine(wording: Chrome, record: IterationRecord) {
  const refused = record.permissionDenials;
  if (refused === null) {
    return null;
  }
  // **Plain words on the row, the console's sentence as its `title`** (#220
  // S2): "the fence refused [...]" is a JSON array in a sentence about a
  // mechanism, and what a person reads from it is a count. The bytes continuo
  // wrote are still here, and listed one by one in the answer view's fence card.
  const denials = decodedDenials(refused);
  const raw =
    refused === "null"
      ? wording.fenceUnknown
      : refused === "[]"
        ? wording.fenceRefusedNothing
        : wording.fenceRefused(refused);
  return (
    <span class="line min-w-0 wrap-anywhere" title={raw}>
      {!Array.isArray(denials)
        ? wording.blockedUnknown
        : denials.length === 0
          ? wording.blockedNothing
          : wording.blockedCount(denials.length)}
    </span>
  );
}

/**
 * **What the fence blocked, on the gate itself** (#220 S2): the count in plain
 * words and each refused call as `rondo answer` spells it ({@link denialLine}),
 * so a person approving sees that a command was stopped without opening the
 * text fold. No row reading (SQL null) draws nothing, as {@link fenceLine}.
 */
function fenceView(wording: Chrome, record: IterationRecord) {
  const refused = record.permissionDenials;
  if (refused === null) {
    return null;
  }
  const denials = decodedDenials(refused);
  const count =
    denials === null
      ? wording.blockedUnknown
      : denials.length === 0
        ? wording.blockedNothing
        : wording.blockedCount(denials.length);
  // **One line, the calls in a fold** (the S2 design pass on #220): the count is
  // what a person weighs; each call is there to open. A call whose shape rondo
  // cannot read is said in plain words rather than the console's placeholder.
  return (
    <section id="fence" class={`${CARD} py-2`}>
      {denials === null || denials.length === 0 ? (
        <p class="text-[13px] leading-6">
          <span class="font-semibold">{wording.fenceHeading}</span>{" "}
          <span class="text-muted-foreground">{count}</span>
        </p>
      ) : (
        <details id="fence-calls" class="group">
          <summary class="flex cursor-pointer list-none flex-wrap items-center gap-x-2 text-[13px] leading-6 select-none [&::-webkit-details-marker]:hidden">
            {chevron()}
            <span class="font-semibold">{wording.fenceHeading}</span>
            <span class="text-muted-foreground">{count}</span>
          </summary>
          <ul class="mt-2 divide-y divide-border/70 rounded-md border border-border/70">
            {denials.slice(0, LIST_LIMIT).map((denial) =>
              typeof denial === "object" && denial !== null && !Array.isArray(denial) ? (
                <li class="px-3 py-1.5 font-mono text-[12px] leading-5 wrap-anywhere" lang="">
                  {denialLine(denial)}
                </li>
              ) : (
                <li class="px-3 py-1.5 text-[12.5px] leading-5 text-muted-foreground">
                  {wording.denialUnreadable}
                  <span class="block font-mono text-[11.5px] text-faint wrap-anywhere" lang="">
                    {JSON.stringify(denial)}
                  </span>
                </li>
              ),
            )}
            {denials.length > LIST_LIMIT ? (
              <li class="px-3 py-1.5 text-[12px] text-faint">
                {wording.moreRows(denials.length - LIST_LIMIT)}
              </li>
            ) : null}
          </ul>
        </details>
      )}
    </section>
  );
}

/**
 * A row's state as a pill and its age (the page's third design pass on #220):
 * a word a person reads rather than the status enum. The head sentence the
 * terminal prints -- status, age, answer -- stays whole in `title`.
 */
function stateHead(wording: Chrome, record: IterationRecord, tone: Tone, age: string, raw: string) {
  return (
    <span class="head inline-flex items-center gap-2 whitespace-nowrap" title={raw}>
      <span
        class={`inline-flex shrink-0 items-center rounded-full border px-2 py-px text-[11.5px] font-medium leading-4 whitespace-nowrap ${TONE[tone]}`}
      >
        {wording.statePill(record.status, record.gateOutcome)}
      </span>
      <span class="tabular-nums">{age}</span>
    </span>
  );
}

/** A plain note in the views' muted box. */
export function note(line: string) {
  return (
    <p class="note rounded-md border border-border bg-muted/60 px-3 py-2 text-[13px] leading-5">
      {line}
    </p>
  );
}

/** A view's head: the way back to the summary, and what the view is. */
export function backHead(wording: Chrome, heading: string) {
  return (
    <header class="space-y-2">
      <div class="flex min-w-0 items-center gap-2">
        <a
          href={viewHref({ kind: "summary" }, wording.lang)}
          data-back=""
          class="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          title={wording.keyBack}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="size-4"
          >
            <path d="M13 8H3m4-4-4 4 4 4" />
          </svg>
          <span class="sr-only">{wording.keyBack}</span>
        </a>
        <h2 class="min-w-0 flex-1 truncate text-[15px] leading-6 font-semibold">{heading}</h2>
      </div>
    </header>
  );
}

/**
 * Where a publish's outcome is read back from: the report `reportToRequest`
 * writes into the request thread once all three legs are done (rondo#245).
 *
 * **The thread message is the fact, and rondo holds no other.** It is written
 * after the push, the pull request and the run close have all succeeded and
 * never before, so its presence is the whole of "this was published" --
 * `publishFromPage` deliberately persists nothing about how far a publish that
 * failed had got (`src/access/cli.ts`, the `publishRefusedPullRequestFailed`
 * arm), because that would be a durable record of somebody else's state.
 *
 * **A lap whose row names no request has no report**, because there is no
 * thread to write one into. That row keeps its publish link after a publish,
 * which is the state this page was in for every row before this: nothing is
 * made worse, and nothing here can invent the fact.
 *
 * The id is the one `reportToRequest` mints (`src/access/conductor.ts`), and
 * the URL is read off the sentence it composed rather than stored twice.
 */
export function publishedReport(
  threads: Threads,
  iterationId: string,
): { url: string | null } | null {
  const report = threads.byId.get(`report-published-${iterationId}`);
  if (report === undefined) {
    return null;
  }
  return { url: /https?:\/\/[^\s]+/.exec(report.body)?.[0] ?? null };
}

/** The inbox section: the same lines `rondo inbox` prints, and no mark moved. */

/** The between-laps section: `rondo between`'s composition, unrecorded. */

/** A card on the answer view: one section of what a press is made over. */
export const CARD = "min-w-0 rounded-lg border border-border bg-card px-4 py-3";

export const CARD_HEADING = "text-body leading-6 font-semibold";

/** A pill in the row's sans face, as {@link stateHead} draws one. */
function pill(tone: Tone, text: string, extra = "") {
  return (
    <span
      class={`inline-flex shrink-0 items-center rounded-full border px-2 py-px text-[11.5px] font-medium leading-4 whitespace-nowrap ${TONE[tone]} ${extra}`}
    >
      {text}
    </span>
  );
}

/** `open` names the fold that turns it, where one fold sits inside another. */
export function chevron(open = "group-open:rotate-90") {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={`size-3.5 shrink-0 text-faint transition-transform ${open}`}
    >
      <path d="m6 3.5 4.5 4.5L6 12.5" />
    </svg>
  );
}

/** A verdict as a tone: raised is amber and never red, because it refuses nothing here. */
function verdictTone(verdict: string): Tone {
  return verdict === "clear" ? "ok" : verdict === "concerns" ? "revise" : "muted";
}

const SEVERITY_TONE: Readonly<Record<FindingSeverity, Tone>> = {
  blocker: "fail",
  major: "revise",
  minor: "muted",
  nit: "muted",
};

/**
 * What a reader looked at and what it did not, in a quiet fold (rondo#69): the
 * store's own sentences, which are English in every set, so the fold says so.
 */
function coverageFold(id: string, wording: Chrome, drafter: string) {
  return (
    <details id={id} class="group mt-2">
      <summary class="flex cursor-pointer list-none items-center gap-1.5 text-[12px] leading-5 text-faint select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
        {chevron()}
        {wording.whatItRead}
      </summary>
      <p class="mt-1 pl-5 text-[12px] leading-5 text-muted-foreground" lang="en">
        {readingCoverage(drafter).join(" ")}
      </p>
    </details>
  );
}

/**
 * rondo's own reason for something the person was told in their own terms
 * (D-0076 rule 4.5): one closed fold beside that sentence, labelled for
 * whoever maintains rondo on this machine, holding the reason as rondo
 * received it. The person is never asked to open it.
 */
function maintainerFold(id: string, wording: Chrome, reason: string) {
  return (
    <details id={id} class="group">
      <summary class="flex cursor-pointer list-none items-center gap-1.5 text-[12px] leading-5 text-faint select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
        {chevron()}
        {wording.forMaintainer}
      </summary>
      <p class="mt-1 pl-5 text-[12px] leading-5 text-muted-foreground wrap-anywhere" lang="en">
        {reason}
      </p>
    </details>
  );
}

/**
 * *What changed* -- the commits and the files as rows (D-0029 rule 2), from the
 * inspection `workLines` prints, capped where it caps and saying how many it
 * hid. The branch and the base are quiet, and the workspace path is the
 * branch's `title`: a locator, not something to read.
 */
function changedView(wording: Chrome, record: IterationRecord, work: LapWorkInspection | null) {
  const hidden = (count: number) =>
    count > LIST_LIMIT ? (
      <li class="px-3 py-1.5 text-[12px] text-faint">{wording.moreRows(count - LIST_LIMIT)}</li>
    ) : null;
  const ROWS = "divide-y divide-border/70 rounded-md border border-border/70";
  return (
    <section id="changed" class={CARD}>
      <div class="flex flex-wrap items-baseline gap-x-2">
        <h3 class={CARD_HEADING}>{wording.workHeading}</h3>
        <span class="font-mono text-[11.5px] text-faint" title={record.workspace ?? ""}>
          {record.topicBranch ?? ""}
        </span>
        {work?.kind === "read" ? (
          <span class="font-mono text-[11.5px] text-faint">
            {wording.changedAgainst(work.baseRef)}
          </span>
        ) : null}
      </div>
      {work === null ? (
        <p class="mt-1 text-[13px] leading-5 text-muted-foreground">{wording.changedNoRange}</p>
      ) : work.kind !== "read" ? (
        // **`wrap-anywhere`, because the reason is git's own line** and carries
        // an absolute path with no space in it: at 420 it pushed the whole
        // document sideways, which is the one thing a phone width must not do
        // (rondo#233 S4's screenshot pass).
        <p class="mt-1 text-[13px] leading-5 wrap-anywhere text-muted-foreground">
          {wording.changedUnreadable(work.reason)}
        </p>
      ) : (
        <div class="mt-2 space-y-2">
          {work.commits.length === 0 ? (
            <p class="text-[13px] leading-5 text-muted-foreground">{wording.noCommits}</p>
          ) : (
            <ul class={`commits ${ROWS}`}>
              {work.commits.slice(0, LIST_LIMIT).map((commit) => (
                <li class="flex gap-3 px-3 py-1.5 text-[13px] leading-5">
                  <span class="shrink-0 font-mono text-[11.5px] leading-5 text-faint">
                    {commit.abbreviatedSha}
                  </span>
                  <span class="min-w-0 wrap-anywhere" lang="">
                    {commit.subject}
                  </span>
                </li>
              ))}
              {hidden(work.commits.length)}
            </ul>
          )}
          {work.files.length === 0 ? (
            <p class="text-[13px] leading-5 text-muted-foreground">{wording.noFiles}</p>
          ) : (
            <ul class={`files ${ROWS}`}>
              {work.files.slice(0, LIST_LIMIT).map((file) => (
                <li class="flex items-baseline gap-3 px-3 py-1.5">
                  <span class="min-w-0 flex-1 font-mono text-[12px] leading-5 wrap-anywhere">
                    {file.path}
                  </span>
                  {file.added === null || file.deleted === null ? (
                    <span class="shrink-0 text-[11.5px] text-faint">{wording.binaryFile}</span>
                  ) : (
                    <span class="shrink-0 font-mono text-[11.5px] tabular-nums">
                      <span class="text-ok">+{String(file.added)}</span>{" "}
                      <span class="text-fail">-{String(file.deleted)}</span>
                    </span>
                  )}
                </li>
              ))}
              {hidden(work.files.length)}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * *Checks* -- the deterministic reading, the one `publish` refuses on (D-0065
 * 5.5): its verdict, its findings as rows, what it counted and what it covered.
 */
/**
 * The checks' verdict as a pill; muted rather than green where the work it
 * would be matched against cannot be read now (the S2 design pass on #220), so
 * an unreadable workspace never reads as a clean pass.
 *
 * **And a `clear` does not keep its word there either** (rondo#237). Muting the
 * colour left the pill still saying *nothing raised* beside a *what changed*
 * card that could count nothing, so the reading's count and the work's could
 * disagree with nothing on the screen saying which was which. S5 answered the
 * same fact on the publish screen by refusing (`reviewBlock`'s `unreadable`
 * arm, `src/access/cli.ts`); the gate refuses nothing, so what it does instead
 * is stop asserting the verdict. `concerns` and `unavailable` already say
 * something that is not a pass and keep their own word.
 */
function checksPill(wording: Chrome, reading: LapReading | null, workGone = false) {
  if (reading === null) {
    return null;
  }
  const said =
    workGone && reading.verdict === "clear"
      ? wording.checksNotMatched
      : wording.verdictPill(reading.verdict, reading.findings.length);
  return pill(workGone ? "muted" : verdictTone(reading.verdict), said);
}

/**
 * The model's verdict as a pill, its worst finding said in the pill (the S2
 * design pass on #220): graded findings counted by severity, blocker first, in
 * red where there is a blocker. A reading whose severities did not decode keeps
 * the plain count.
 */
function modelPill(wording: Chrome, reading: LapReading) {
  const graded = reading.graded ?? [];
  if (reading.verdict !== "concerns" || graded.length === 0) {
    return pill(
      verdictTone(reading.verdict),
      wording.verdictPill(reading.verdict, reading.findings.length),
    );
  }
  const counted = (["blocker", "major", "minor", "nit"] as const)
    .map((severity) => ({
      severity,
      count: graded.filter((finding) => finding.severity === severity).length,
    }))
    .filter((part) => part.count > 0);
  return pill(
    SEVERITY_TONE[counted[0]?.severity ?? "minor"],
    counted.map((part) => wording.severityCount(part.severity, part.count)).join(" · "),
  );
}

/**
 * A reading that could not be taken: one plain sentence, and the recorded
 * reason -- the store's own words, English in every set -- in a fold beside it
 * (the S2 design pass on #220). Folded is not dropped.
 */
function notTakenView(wording: Chrome, id: string, reason: string | null) {
  return (
    <>
      <p class="mt-1 text-[13px] leading-5 text-muted-foreground">{wording.readingNotTaken}</p>
      <details id={id} class="group mt-1">
        <summary class="flex cursor-pointer list-none items-center gap-1.5 text-[12px] leading-5 text-faint select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
          {chevron()}
          {wording.whyNotTaken}
        </summary>
        <p class="mt-1 pl-5 text-[12px] leading-5 wrap-anywhere text-muted-foreground">
          {reason ?? wording.noReasonRecorded}
        </p>
      </details>
    </>
  );
}

/**
 * `workGone` is decided by the caller rather than here (rondo#237): the bar
 * pins this same verdict above the button, and one judgement drawn in two
 * places must be made once or the two will disagree.
 */
function checksView(wording: Chrome, reading: LapReading | null, workGone: boolean) {
  return (
    <section id="checks" class={`${CARD} scroll-mt-16`}>
      <div class="flex items-center gap-2">
        <h3 class={CARD_HEADING}>{wording.checksHeading}</h3>
        {checksPill(wording, reading, workGone)}
      </div>
      {reading === null ? (
        <p class="mt-1 text-[13px] leading-5 text-muted-foreground">{wording.checksNone}</p>
      ) : reading.verdict === "unavailable" ? (
        notTakenView(wording, "checks-not-taken", reading.unavailableReason)
      ) : (
        <>
          {workGone ? (
            <p class="mt-1 text-[13px] leading-5 text-wait-ink">{wording.checksWorkUnreadable}</p>
          ) : null}
          {reading.findings.length === 0 ? null : (
            <ul class="finding-rows mt-2 space-y-1.5" lang="en">
              {reading.findings.map((finding) => (
                <li class="finding flex gap-2 text-[13px] leading-5">
                  <span aria-hidden="true" class="text-wait">
                    •
                  </span>
                  <span class="min-w-0 wrap-anywhere">{finding}</span>
                </li>
              ))}
            </ul>
          )}
          <p class="mt-2 text-[12.5px] leading-5 text-muted-foreground">
            {wording.checksCounted(
              reading.evidence?.commitCount ?? 0,
              reading.evidence?.fileCount ?? 0,
            )}
          </p>
          {coverageFold("checks-coverage", wording, reading.drafter)}
        </>
      )}
    </section>
  );
}

/**
 * *Model review* -- the model's reading beside the checks, as material only
 * (D-0065's gate answer (a)): each finding with its severity and its bases,
 * in the reviewer's order, which rondo does not rank. Four states: a reading,
 * one that could not be taken, none yet while one is still due, and a reading
 * of earlier commits while one of the current ones is.
 *
 * **The page does not wait for it** (D-0054 rule 1): the answer view holds
 * still, so a reading that may still arrive is a sentence and a reload link.
 */
/**
 * Whether the page may say a model reading *may still arrive* (#220 S2), which
 * is not `modelReadingDue`: that one decides whether the terminal takes a
 * round, and an unavailable row carries no evidence, so it stays "due" after a
 * round on these very commits ended unavailable -- and nothing at this gate
 * retries. The page says so only while there is no model row at all, or the
 * latest one names a tip other than the checks' tip. An unavailable row is
 * that round's outcome and is shown as such.
 */
function modelPendingOnPage(readings: readonly LapReading[], model: LapReading | null): boolean {
  if (model === null) {
    return true;
  }
  const modelTip = model.evidence?.tipCommit;
  const checksTip = reviewedReading(readings)?.evidence?.tipCommit;
  return modelTip !== undefined && checksTip !== undefined && modelTip !== checksTip;
}

function modelView(wording: Chrome, reading: LapReading | null, due: boolean, reload: string) {
  const later = (note: string) => (
    <p class="mt-1 text-[13px] leading-5 text-muted-foreground">
      {note}{" "}
      <a href={reload} class="font-medium text-link underline-offset-2 hover:underline">
        {wording.reloadPage}
      </a>
    </p>
  );
  return (
    <section id="model-review" class={`${CARD} scroll-mt-16`}>
      <div class="flex flex-wrap items-center gap-2">
        <h3 class={CARD_HEADING}>{wording.modelHeading}</h3>
        {reading === null ? null : modelPill(wording, reading)}
        {reading === null ? null : (
          <span class="ml-auto font-mono text-[11px] text-faint" title={reading.drafter}>
            {reading.drafter.slice(MODEL_READING_DRAFTER_PREFIX.length)}
          </span>
        )}
      </div>
      {reading === null ? (
        later(wording.modelPending)
      ) : (
        <>
          {due ? later(wording.modelOlder) : null}
          {reading.verdict === "unavailable" ? (
            notTakenView(wording, "model-not-taken-why", reading.unavailableReason)
          ) : (
            <>
              {reading.findings.length === 0 ? null : (
                <ul class="mt-2 divide-y divide-border/70">
                  {reading.findings.map((text, index) => {
                    const graded = reading.graded?.[index];
                    return (
                      <li class="model-finding py-2 first:pt-1 last:pb-0">
                        <p class="flex items-start gap-2 text-[13px] leading-5">
                          {graded === undefined
                            ? null
                            : pill(
                                SEVERITY_TONE[graded.severity],
                                wording.severityWord(graded.severity),
                                "severity mt-px",
                              )}
                          <span class="min-w-0 wrap-anywhere" lang="">
                            {text}
                          </span>
                        </p>
                        {graded === undefined ? null : (
                          <p class="mt-1 flex flex-wrap items-center gap-1 text-[11.5px] leading-4">
                            {graded.bases.map((basis) => (
                              <code class="basis-chip rounded border border-border bg-muted/60 px-1.5 py-px font-mono text-faint wrap-anywhere">
                                {findingBasisText(basis)}
                              </code>
                            ))}
                            {graded.bases.length === 0 ? (
                              <span class="text-faint">{wording.basisNone}</span>
                            ) : graded.basisResolved ? null : (
                              <span class="text-faint">{wording.basisUnresolved}</span>
                            )}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {coverageFold("model-coverage", wording, reading.drafter)}
            </>
          )}
        </>
      )}
    </section>
  );
}

/** How many blockers and majors one model reading left open. */
interface RaisedCounts {
  readonly blockers: number;
  readonly majors: number;
}

/**
 * What a model reading raised at or above `major`, or null where it raised
 * none (D-0065 as annotated from #220). Counted from the graded findings, so a
 * reading whose severities did not decode counts nothing here -- its findings
 * are still every one of them on the card.
 *
 * **The count and not the sentence** (rondo#237), because two screens say it:
 * the line by the gate's button, and the row of a lap somebody approved over
 * it. The gate's warning and the summary's line disagreeing about what was
 * open would be worse than either of them being absent.
 */
function raisedIn(reading: LapReading | null): RaisedCounts | null {
  const graded = reading?.graded ?? [];
  const blockers = graded.filter((finding) => finding.severity === "blocker").length;
  const majors = graded.filter((finding) => finding.severity === "major").length;
  return blockers + majors === 0 ? null : { blockers, majors };
}

/** The line by the button, or null where the model review raised nothing that heavy. */
function modelRaised(wording: Chrome, reading: LapReading | null): string | null {
  const open = raisedIn(reading);
  return open === null ? null : wording.modelRaised(open.blockers, open.majors);
}

/**
 * What the revise box holds, and what the view says beside it (D-0077 section
 * 4). **There is no deterministic fallback** (rule 4.2): a lap with no draft
 * gets an empty box and a sentence, and the person is the author of what they
 * write there.
 *
 * - `none`: the latest model reading has no finding (or there is none), so
 *   there is nothing to draft and nothing is said, as before any drafter.
 * - `pending`: a reading with findings that no draft holds yet (rule 4.3).
 * - `unavailable`: the run over it wrote no draft; `reason` is rondo's, for
 *   D-0076 rule 4.5's closed fold and never inline.
 * - `drafted`: the box's text, assembled by {@link reviseText} from the stored
 *   reading and the drafter's words (rule 3.4).
 */
type ReviseBox =
  | { readonly kind: "none" }
  | { readonly kind: "pending" }
  | { readonly kind: "unavailable"; readonly reason: string }
  | { readonly kind: "drafted"; readonly text: string };

/** Read the revise box for one lap's readings (D-0077 rule 2.2's "drafted"). */
async function reviseBox(
  ports: WebPorts,
  wording: Chrome,
  iterationId: string,
  readings: readonly LapReading[],
): Promise<ReviseBox> {
  const model = latestReading(readings, isModelReadingDrafter);
  if (model === null || model.verdict !== "concerns" || model.findings.length === 0) {
    return { kind: "none" };
  }
  const row = await ports.record.reviseDraftFor(iterationId, model);
  if (row === null) {
    return { kind: "pending" };
  }
  if (row.payload["kind"] === "unavailable") {
    const reason = row.payload["reason"];
    return { kind: "unavailable", reason: typeof reason === "string" ? reason : "" };
  }
  const text = reviseText(model, row.payload, {
    finding: wording.reviseDraftFinding,
    bases: wording.reviseDraftBases,
    change: wording.reviseDraftChange,
  });
  // A row that does not decode as a whole draft of this reading is shown as
  // none, never in part (D-0077 rule 4.1: not shown and not repaired).
  return text === null
    ? { kind: "unavailable", reason: "the stored draft does not read as a draft of this reading" }
    : { kind: "drafted", text };
}

/** Whether a row carries a question this page can put a button under. */
function answerable(record: IterationRecord, token: string | null): token is string {
  return token !== null && record.status === "awaiting_human" && record.gateId !== null;
}

/**
 * The press, drawn only where there is something for it to answer.
 *
 * Three conditions, and each is a different way of not having a question in
 * front of a person: no write port (nobody to act as), a status that is not
 * `awaiting_human` (nothing is asking), or no gate id on the row (the status
 * says a gate is open and the row does not name one, which `answer` refuses
 * too). A button drawn anyway would be one that fails when pressed.
 *
 * **The framing first and the button in a bar that stays in reach** (D-0059
 * section 2): the form sticks to the bottom of the window for as long as the
 * framing it answers is on screen, so a 21-claim table never puts `approve`
 * below the fold -- and it is still after every claim in the document, so a
 * reader without CSS meets the press where it always was.
 *
 * **A native form, and nothing else can press it** (D-0059 section 5): no
 * `hx-post`, no script, a real `<button type="submit">`. `method="post"` is not
 * decoration: the refresh is a `GET`, and this form is the only thing on the
 * page that can produce anything else -- and only a person's click produces the
 * `Sec-Fetch-User: ?1` the press is minted from.
 */
function approveView(
  wording: Chrome,
  record: IterationRecord,
  token: string | null,
  framing: Shown,
  /**
   * The lap a revise would run as, minted at render for the scoped start's
   * reason (D-0023, and a double press is one lap). Null where there is no
   * write port, which is also where no button is drawn at all.
   */
  newIterationId: MintIterationId | null = null,
) {
  if (!answerable(record, token) || record.gateId === null) {
    return null;
  }
  const known = framing.claims.filter((claim) => claim.value !== UNDETERMINED);
  const unknown = framing.claims.filter((claim) => claim.value === UNDETERMINED);
  const model = latestReading(framing.readings, isModelReadingDrafter);
  const modelDue = modelPendingOnPage(framing.readings, model);
  const raised = modelRaised(wording, model);
  const checks = reviewedReading(framing.readings);
  // **Read once and drawn twice** (rondo#237): the checks' card and the bar's
  // pinned line are the same verdict about the same work.
  const work = framing.material?.work ?? null;
  const workGone = work !== null && work.kind !== "read";
  // The thread the box is in, which is what a reload of this screen is now
  // (D-0083 rule 3).
  const reload = viewHref(
    { kind: "thread", messageId: record.requestMessageId, to: null },
    wording.lang,
  );
  return (
    // **The poll replaces this box and `page/composer.js` puts the words
    // back.** The gate is inside the thread since D-0083 rule 9, so the
    // five-second swap reaches it; the draft is kept by the script that
    // already keeps the send box's, off the `data-draft` key on the field.
    // `hx-preserve` would have been the other answer and is the wrong one
    // here: the send's own out-of-band swap of `#composer` has to land.
    <div id="answering" class="mt-3 space-y-3">
      {framing.material === null ? null : (
        <>
          <section id="why" class={CARD}>
            <h3 class={CARD_HEADING}>{wording.whyStopped}</h3>
            {framing.material.why === null ? (
              <p class="text-[13px] leading-5 text-muted-foreground">{wording.whyNotRead}</p>
            ) : (
              <p
                class="mt-1 text-[13.5px] leading-6 wrap-anywhere whitespace-pre-wrap"
                lang={materialLanguage(record)}
              >
                {framing.material.why}
              </p>
            )}
          </section>
          {changedView(wording, record, framing.material.work)}
          {fenceView(wording, record)}
        </>
      )}
      {/*
       * **The two readings side by side, and nothing between them** (D-0065 as
       * annotated from #220): one gate, no recommendation, each reading in its
       * own words. Stacked under `lg`.
       */}
      <div class="grid items-start gap-3 lg:grid-cols-2">
        {checksView(wording, checks, workGone)}
        {modelView(wording, model, modelDue, reload)}
      </div>
      <p class="note text-[12.5px] leading-5 text-faint">{wording.readingsNote}</p>
      {/*
       * **What the press records, folded by default** (the S2 design pass on
       * #220): every claim is still in the document and still recorded as
       * shown (D-0042) -- folded is not dropped, and with script off
       * `page/app.css` draws the fold open -- but the readings above already
       * say what these rows say, and the rows pushed the claim box a screen
       * below them. The summary counts what is inside.
       */}
      <details id="records" class="group rounded-md border border-border">
        <summary
          data-row=""
          class="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-[12.5px] leading-5 text-muted-foreground outline-none select-none hover:bg-accent focus-visible:bg-accent focus-visible:shadow-[inset_3px_0_0_var(--color-ring)] [&::-webkit-details-marker]:hidden"
        >
          {chevron()}
          {wording.recordsFold(framing.claims.length)}
        </summary>
        <div class="space-y-3 border-t border-border p-3">
          <p class="note text-[13px] leading-5 text-muted-foreground">{wording.pressNote}</p>
          {/*
           * **The claims that carry a value first, the undetermined ones in one
           * fold** (the third design pass on #220). Folded is not dropped: the fold
           * and every claim in it are in the document (D-0042), and with script
           * off `page/app.css` draws it open.
           */}
          {known.length === 0 ? null : claimsView(known, framing.snapshot, true)}
          {unknown.length === 0 ? null : (
            <details id="undetermined" class="group rounded-md border border-border">
              <summary
                data-row=""
                class="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-[12.5px] leading-5 text-muted-foreground outline-none select-none hover:bg-accent focus-visible:bg-accent focus-visible:shadow-[inset_3px_0_0_var(--color-ring)] [&::-webkit-details-marker]:hidden"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="size-3.5 shrink-0 text-faint transition-transform group-open:rotate-90"
                >
                  <path d="m6 3.5 4.5 4.5L6 12.5" />
                </svg>
                {wording.undeterminedFold(unknown.length)}
              </summary>
              <div class="border-t border-border [&>div]:rounded-none [&>div]:border-0">
                {claimsView(unknown, framing.snapshot, true)}
              </div>
            </details>
          )}
          {framing.material === null ? null : (
            // **Folded is not dropped** (D-0029 rule 2): `rondo answer`'s material
            // whole, for what the layout above does not draw -- the fence's
            // allowance and its standing sentences, the gate's options, the
            // readings' evidence -- and its label says so rather than promising a
            // repeat.
            <details id="material-text" class="group rounded-md border border-border">
              <summary class="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-[12.5px] leading-5 text-muted-foreground outline-none select-none hover:bg-accent focus-visible:bg-accent [&::-webkit-details-marker]:hidden">
                {chevron()}
                {wording.allAsText}
              </summary>
              <pre
                class="material overflow-x-auto border-t border-border bg-muted/50 p-3 font-mono text-[12px] leading-5 wrap-anywhere whitespace-pre-wrap"
                lang={materialLanguage(record)}
              >
                {framing.material.lines.join("\n")}
              </pre>
            </details>
          )}
        </div>
      </details>
      {/*
       * **The bar holds both of the gate's answers** (rondo#233 S4, the critic
       * gap S2 left open): approving, and asking for a change. Two forms and
       * not one, because a form cannot nest and each posts to its own address
       * with its own press -- and the bar around them is a `div`, so nothing
       * about where a control sits decides which press it makes.
       */}
      <div
        id="answer-bar"
        // A solid bar with a rule and a lift on top, so where it overlaps the
        // claims it reads as the window's footer and not as a row of the
        // table; full width under `sm`, where it is the bottom sheet. The lift
        // is shallow and the material ends a gap above it, so where the bar
        // rests at the end of the framing it covers nothing.
        // **And it never takes more than three-quarters of the window**
        // (rondo#233 S4): with the change opened, a bar that grew without a
        // ceiling covered the readings it sits under at a phone width. Past
        // that it scrolls inside itself, so the gate is still readable behind
        // it and nothing in the bar is out of reach.
        class="sticky bottom-0 z-[1] -mx-4 mt-5 flex max-h-[75svh] flex-col gap-2 overflow-y-auto border-t border-border bg-card px-4 py-3 shadow-[0_-4px_10px_-8px_rgb(0_0_0/0.3)]"
      >
        {/*
         * **Both readings' verdicts pinned in the bar** (the S2 design pass on
         * #220): the bar stays on screen at every scroll, so the decision's
         * material shows before any reading is scrolled to, at a phone width
         * too. Side by side and in the same weight, no recommendation between
         * them (D-0065 as annotated from #220). The model's blocker or major
         * line is part of it -- seen before pressing and never in the way of
         * it; the press below it is the same press whatever this says, and
         * since rondo#237 it wears the difference on its face.
         */}
        <p
          id="bar-readings"
          class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] leading-5 text-muted-foreground"
        >
          <a
            href="#checks"
            class="inline-flex items-center gap-1.5 whitespace-nowrap hover:underline"
          >
            {wording.checksHeading}
            {checksPill(wording, checks, workGone)}
          </a>
          <a
            href="#model-review"
            class="inline-flex items-center gap-1.5 whitespace-nowrap hover:underline"
          >
            {wording.modelHeading}
            {model === null ? null : modelPill(wording, model)}
          </a>
          {raised === null ? null : (
            <span
              id="model-raised"
              class="inline-flex flex-wrap items-center gap-x-1.5 text-[13px] text-fail"
            >
              {glyph("alert")}
              <span>{raised}</span>
              <a
                href="#model-review"
                class="font-medium whitespace-nowrap underline underline-offset-2"
              >
                {wording.modelRaisedLink}
              </a>
            </span>
          )}
          {modelDue ? (
            <span>{wording.modelMayArrive}</span>
          ) : model?.verdict === "unavailable" ? (
            // Said as "only the checks read this" only when the checks did
            // read it (#220 S2, Codex): both readers can be unavailable.
            <span id="model-not-taken">
              {checks !== null && checks.verdict !== "unavailable"
                ? wording.modelNotTaken
                : wording.neitherReadingTaken}
            </span>
          ) : null}
        </p>
        <form
          id="approve-form"
          method="post"
          action={viewHref({ kind: "summary" }, wording.lang)}
          class="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3"
        >
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="iteration" value={record.id} />
          {/* The request this lap is for, so a refusal and the `303` both
              land back in the thread the press was made in (D-0083 rule 3).
              Carried by the form rather than read again, for the reason the
              lap id is: it is what the page drew. */}
          <input type="hidden" name="request" value={record.requestMessageId} />
          {/*
           * **What the person says they checked, carried by this press** (D-0045
           * as annotated from #220): optional, their words byte for byte, and no
           * `maxlength` -- a browser cuts a pasted claim silently, and a claim
           * recorded shorter than it was said is one the person did not make, so
           * the port refuses an over-long one in words instead. `data-draft` is
           * the composer script's duty, keyed per gate so a later gate on the
           * same lap does not start with an earlier gate's words. Its label says
           * where the words go, right beside the button they go with.
           */}
          <label class="flex min-w-0 flex-1 flex-col gap-1">
            <span class="text-[12.5px] leading-5 font-medium text-muted-foreground">
              {wording.claimLabel}
            </span>
            <textarea
              name="verified"
              rows={1}
              data-draft={`claim:${record.id}:${record.gateId}`}
              placeholder={wording.claimPlaceholder}
              class="max-h-32 min-h-9 w-full resize-y rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] leading-5 outline-none [field-sizing:content] placeholder:text-faint focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          {/*
           * The last `j`/`k` stop, by focus alone: moving to the button
           * presses nothing, and `Enter` on it is the browser's own activation
           * of a native submit -- a person's key, which is what mints a press.
           * What approving means is its description, not a second label.
           *
           * **And the face says which approval this is** (rondo#237): with a
           * blocker or a major open, approving overrides a reading, and a bar
           * scanned rather than read gave the two the same word. What moves is
           * the label and the sentence under it -- not the press, not the
           * route and not the answer, which is {@link APPROVE_BODY} in the
           * `title` here and read from that constant on the way in (D-0065
           * refuses no approval over a model finding).
           */}
          <button
            type="submit"
            data-row=""
            aria-describedby={`approve-plain-${record.id}`}
            class={`${PRIMARY} h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto`}
          >
            {raised === null ? APPROVE_BODY : wording.approveDespite}
          </button>
          <span
            id={`approve-plain-${record.id}`}
            class="note sr-only"
            title={wording.approveNote(record.gateId, APPROVE_BODY)}
          >
            {raised === null ? wording.approvePlain : wording.approveDespitePlain}
          </span>
        </form>
        {reviseForm(wording, record, token, framing, newIterationId)}
      </div>
    </div>
  );
}

/**
 * The gate's other answer, beside approve in the same bar (rondo#233 S4,
 * D-0070): rondo's draft of what to change, which the person edits or does not,
 * and one press that carries it to the gate and runs the second lap under the
 * approval this lap ran under.
 *
 * **Folded, and never in the way of approving.** D-0065's gate answer keeps
 * approve unrefused whatever the model raised, so the change is an equal second
 * answer a person opens rather than a step in front of the first. The fold is
 * in the document either way (D-0042's rule about folds), and with script off
 * `page/app.css` draws it open.
 *
 * **No press without an approval to count the lap against.** D-0070 counts the
 * second lap as an `admission` through the `redo` arm, and a lap admitted under
 * no scope has nothing to count it against -- so what is drawn there is the
 * sentence saying so, not a button that would be refused.
 */
function reviseForm(
  wording: Chrome,
  record: IterationRecord,
  token: string,
  framing: Shown,
  newIterationId: MintIterationId | null,
) {
  if (newIterationId === null) {
    return null;
  }
  if (framing.forked || framing.scopeDecisionId === null) {
    return (
      <p id="revise-none" class="note text-[12.5px] leading-5 text-faint">
        {framing.forked ? wording.reviseForked : wording.reviseNoScope}
      </p>
    );
  }
  // **A budget that would refuse the change is said before the press, with
  // the way to raise it beside it** (D-0074 rule 4.1): a press drawn here would
  // be refused and write a stop into the request's thread, which raising the
  // budget afterwards would not lift (rule 3.4).
  const closed = framing.closedBy;
  if (closed !== null && record.requestMessageId !== null) {
    const { budgets, spent } = closed;
    const why =
      closed.test === "laps"
        ? wording.raiseWhyLaps(budgets.laps)
        : closed.test === "cost"
          ? wording.raiseWhyCost(
              money(spent.readCostUsd + spent.unreadLaps * budgets.cost_reserve_usd),
              money(budgets.cost_reserve_usd),
              money(budgets.cost_usd),
            )
          : wording.raiseWhyExpiry(localTime(budgets.expires_at_ms).replace("T", " "));
    return (
      <div id="raise" class="space-y-2">
        <p class="note text-[12.5px] leading-5 text-muted-foreground">{wording.raiseNeeded(why)}</p>
        <a
          href={viewHref(
            {
              kind: "scope",
              messageId: record.requestMessageId,
              rounds: null,
              decisionId: null,
              plan: null,
              raise: { decisionId: framing.scopeDecisionId, iterationId: record.id },
            },
            wording.lang,
          )}
          class={`${SECONDARY} h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto`}
        >
          {wording.raiseLink}
        </a>
      </div>
    );
  }
  const box = framing.revise;
  const draftKey = `revise:${record.id}:${record.gateId ?? ""}`;
  return (
    <details id="revise" class="group">
      <summary
        data-row=""
        class="flex cursor-pointer list-none items-center gap-2 rounded-md py-1 text-[12.5px] leading-5 font-medium text-link outline-none select-none hover:underline focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
      >
        {chevron()}
        {wording.reviseFold}
      </summary>
      <form
        id="revise-form"
        method="post"
        action={`/revise?lang=${encodeURIComponent(wording.lang)}`}
        class="mt-2 flex flex-col gap-2"
      >
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="iteration" value={record.id} />
        <input type="hidden" name="request" value={record.requestMessageId} />
        <input type="hidden" name="scope_decision" value={framing.scopeDecisionId} />
        {/* Minted at render, as the scoped start's is, and for its reason:
            rondo names the lap (D-0023) and a double press is one lap. */}
        <input type="hidden" name="successor" value={newIterationId()} />
        <label class="flex min-w-0 flex-col gap-1">
          <span class="text-[12.5px] leading-5 font-medium text-muted-foreground">
            {wording.reviseLabel}
          </span>
          {/* **The draft is the field's content and not a `placeholder`**: a
              placeholder is not sent, and what the person presses with has to
              be what they read. `data-draft` is the composer script's duty,
              keyed per gate; an edit survives a refusal and a draft that lands
              later (D-0077 rule 4.4), and an untouched box carries the draft.
              The findings inside it are the reviewer's own words, so the box
              states no language. */}
          <textarea
            name="body"
            rows={4}
            lang=""
            data-draft={draftKey}
            placeholder={wording.revisePlaceholder}
            class="max-h-64 min-h-20 w-full resize-y rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-[12.5px] leading-5 outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-ring"
          >
            {box.kind === "drafted" ? box.text : ""}
          </textarea>
        </label>
        {box.kind === "none" ? null : (
          <p
            id="revise-draft-state"
            data-draft-state={draftKey}
            class="note text-[12.5px] leading-5 text-muted-foreground"
          >
            {box.kind === "drafted"
              ? wording.reviseDrafted
              : box.kind === "pending"
                ? wording.reviseDrafting
                : wording.reviseUndrafted}
          </p>
        )}
        {/* Drawn hidden; the composer script shows it, in place of the line
            above, when it put back the person's own words over a draft that
            landed after they began (D-0077 rule 4.4). With script off nothing
            was kept to say so of. */}
        {box.kind === "drafted" ? (
          <p
            id="revise-draft-arrived"
            data-draft-arrived={draftKey}
            hidden
            class="note text-[12.5px] leading-5 text-muted-foreground"
          >
            {wording.reviseDraftArrived}
          </p>
        ) : null}
        {box.kind === "unavailable" ? maintainerFold("revise-why", wording, box.reason) : null}
        <p class="note text-[12.5px] leading-5 text-muted-foreground">{wording.reviseNote}</p>
        <button
          type="submit"
          data-row=""
          aria-describedby="revise-plain"
          class={`${SECONDARY} h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto sm:self-end`}
        >
          {wording.reviseAction}
        </button>
        <span id="revise-plain" class="note sr-only">
          {wording.revisePlain}
        </span>
      </form>
    </details>
  );
}

/** One iteration, explained the way `rondo explain` explains it. */

/** What a press on one row would be recorded as having shown, composed for that row. */
interface Shown {
  readonly claims: readonly Claim[];
  readonly snapshot: AdvisorySnapshot;
  readonly material: LapMaterialRead | null;
  /** The row's readings, which the two reading cards are drawn from. */
  readonly readings: readonly LapReading[];
  /**
   * The approval a revise here spends: the approved tip of the chain that
   * starts at the one this lap was admitted under (D-0074 section 2), or null
   * when it was admitted under none (rondo#233 S4).
   *
   * **Read here so that the revise form can carry it and nobody types it.** A
   * lap with none gets no revise press: D-0070 counts the second lap against
   * the first's approval, and there is nothing here to count it against.
   */
  readonly scopeDecisionId: string | null;
  /** Its line has two approved tips, so no approval is spent (D-0074 rule 2.1). */
  readonly forked: boolean;
  /**
   * The budget that would refuse the revise's lap, computed before any press
   * with the verdict's own arithmetic (D-0074 rule 4.1), or null when none does.
   */
  readonly closedBy: BudgetClosed | null;
  /** The revise box's content and what is said beside it (D-0077 section 4). */
  readonly revise: ReviseBox;
}

/** Which budget closes the change path, and the numbers the sentence says it with. */
interface BudgetClosed {
  readonly test: string;
  readonly budgets: ScopePayload["budgets"];
  readonly spent: ScopeSpent;
}

/** Whether one approval's budgets would refuse one more attempt now, and which. */
async function budgetClosing(
  ports: WebPorts,
  scopeDecisionId: string,
  nowMs: number,
): Promise<BudgetClosed | null> {
  const decided = await ports.record.readScopeDecision(scopeDecisionId);
  if (decided.kind !== "read") {
    return null;
  }
  const stored = await ports.record.readScope(decided.decision.scopeId);
  if (stored.kind !== "read") {
    return null;
  }
  const budgets = stored.scope.payload.budgets;
  const spent = await ports.record.scopeSpent(scopeDecisionId);
  const refused = budgetRefusal(budgets, spent, nowMs);
  return refused === null ? null : { test: refused.test, budgets, spent };
}

/**
 * What a press would be recorded as having shown, for the rows that carry a
 * button (D-0042 rules 1 and 4).
 *
 * **The ledger row a press writes is `explainIteration`'s whole proposal**, and
 * it is counted as presented. So the whole of it has to be on the page beside
 * the button, or rondo would be recording a framing the operator was never
 * shown -- the one thing the fold must not cost. The three questions above are
 * a summary and this is not: it is every claim under its own basis, the same
 * bytes the press stores, drawn where the press is.
 *
 * **It is composed for one row, and only on the view that is about that row.**
 * The summary links here rather than carrying this: the material shells out to
 * `git` in the caller and the framing reads the row's readings, so a page that
 * redraws every five seconds must do neither for a row nobody is answering --
 * and a summary carrying two dozen claims per waiting row is the screen
 * rondo#145 is about. A row that has left its gate since the link was drawn
 * composes nothing here and so draws no button, which is the same refusal
 * `rondo answer` makes.
 */
async function shownBeforePress(
  ports: WebPorts,
  wording: Chrome,
  waiting: readonly IterationRecord[],
  token: string | null,
  /**
   * The lap the centre face is about to draw an answering box for, where the
   * selected request has one at its gate (D-0083 rules 3 and 9).
   *
   * **The gate's material is composed for one row and only where it is being
   * answered.** That was `view.kind === "answer"` while the gate was a screen
   * of its own; since the box lives in the thread, it is *the request the
   * centre is showing*. The cost is the same -- one row's readings, its
   * material and its approval tip -- and the reason is unchanged: a page that
   * redraws every five seconds must not shell out to `git` for a row nobody
   * is answering.
   */
  answeringLapId: string | null = null,
): Promise<ReadonlyMap<string, Shown>> {
  const shown = new Map<string, Shown>();
  const wanted = answeringLapId;
  if (wanted === null) {
    return shown;
  }
  for (const record of waiting) {
    if (record.id !== wanted || !answerable(record, token)) {
      continue;
    }
    const readings = await ports.store.readingsFor(record.id);
    const snapshot = gather(record, readings);
    // The set this request resolved to and not the host's (D-0056 rule 12):
    // the fence block's standing sentences are inside these lines.
    const material = ports.material === null ? null : await ports.material(wording, record);
    const tip = await approvalTip(ports.record, record.id);
    shown.set(record.id, {
      claims: propose(snapshot).payload.claims,
      snapshot,
      material,
      readings,
      scopeDecisionId: tip.kind === "tip" ? tip.scopeDecisionId : null,
      forked: tip.kind === "forked",
      closedBy:
        tip.kind === "tip" ? await budgetClosing(ports, tip.scopeDecisionId, ports.now()) : null,
      revise: await reviseBox(ports, wording, record.id, readings),
    });
  }
  return shown;
}

/** Where an issue's name links to (D-0076 rule 3.4): its address, when rondo knows it. */
export function issueHref(read: ForgeRead): string | null {
  return "read" in read ? read.read.url : /^https?:\/\//.test(read.named) ? read.named : null;
}

/** An issue's own name, as a link where there is an address for it. */
export function issueNameLink(read: ForgeRead) {
  const href = issueHref(read);
  return href === null ? (
    <span class="font-medium">{issueName(read)}</span>
  ) : (
    <a href={href} class="font-medium text-link hover:underline" title={href}>
      {issueName(read)}
    </a>
  );
}

/**
 * What rondo read of one issue (D-0078 sections 4.1 and 4.2): the name as a
 * link, one line, and the words in a fold -- the forge's text as it came, or
 * rondo's own reason, closed (D-0076 rule 4.5). Nothing to press.
 */
function forgeView(wording: Chrome, message: ThreadMessageDraft) {
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
        <p class="text-[14px] leading-6">
          {issueNameLink(read)} {wording.issueNotRead(read.failed.why)} {wording.issueNotReadTail}
        </p>
        <details class="group">
          <summary class="flex cursor-pointer list-none items-center gap-2 text-[12.5px] leading-5 text-muted-foreground select-none [&::-webkit-details-marker]:hidden">
            {chevron()}
            {wording.drafterNoDraftWhy}
          </summary>
          <p
            class="mt-1 text-[12.5px] leading-5 wrap-anywhere whitespace-pre-wrap text-muted-foreground"
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
      <p class="text-[14px] leading-6">
        {issueNameLink(read)}{" "}
        <span class="font-medium" lang="">
          {issue.title}
        </span>
      </p>
      <p class="text-[13px] leading-5 text-muted-foreground">
        {wording.issueRead(issue.pullRequest, issue.comments.length)}
      </p>
      <details class="group">
        <summary class="flex cursor-pointer list-none items-center gap-2 text-[12.5px] leading-5 text-muted-foreground select-none [&::-webkit-details-marker]:hidden">
          {chevron()}
          {wording.issueReadFold}
        </summary>
        {/* The forge's words as it returned them: no trim, no reflow (D-0022 rule 4). */}
        <div class="mt-1 space-y-2 text-[13px] leading-5" lang="">
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
function noDraft(message: ThreadMessageDraft): boolean {
  return (
    message.authorKind === "drafter" &&
    isModelDrafterName(message.authorId) &&
    !message.bases.some((basis) => basis["form"] === "proposal")
  );
}

/**
 * **A drafter run that drafted nothing, said as what happened** (rondo#238):
 * the row's words are rondo's own about its tools, so they are kept, folded,
 * and what is shown first is what the person can do -- set the scope
 * themselves, one press away.
 */
function noDraftView(wording: Chrome, message: ThreadMessageDraft, root: string, forms: boolean) {
  return (
    <div class="space-y-2">
      <p class="text-[14px] leading-6">{wording.drafterNoDraft}</p>
      {forms ? (
        <a
          href={viewHref(
            { kind: "scope", messageId: root, rounds: null, decisionId: null, plan: null },
            wording.lang,
          )}
          class={`${PRIMARY} h-7 px-3 text-[13px]`}
        >
          {wording.scopeAction}
        </a>
      ) : null}
      <details class="group">
        <summary class="flex cursor-pointer list-none items-center gap-2 text-[12.5px] leading-5 text-muted-foreground select-none [&::-webkit-details-marker]:hidden">
          {chevron()}
          {wording.drafterNoDraftWhy}
        </summary>
        <p
          class="body mt-1 text-[12.5px] leading-5 wrap-anywhere whitespace-pre-wrap text-muted-foreground"
          lang="en"
        >
          {message.body}
        </p>
      </details>
    </div>
  );
}

/** Who wrote a message, as a person reads it: their own messages are "you". */
function whoWrote(wording: Chrome, message: ThreadMessageDraft, actorId: string | null): string {
  if (message.authorKind === "operator" && message.authorId === actorId) {
    return wording.you;
  }
  // **A model drafter signs as rondo** (rondo#238, #259): its row name --
  // `rondo/drafter/1/<model-id>` -- is a version and a model a person would
  // have to ask about. The row keeps it; the voice badge beside this says it
  // is the drafter.
  // **A read of an issue signs as rondo too** (D-0078 section 3.1): rondo read
  // it; the badge beside this says it is an issue.
  return (message.authorKind === "drafter" && isModelDrafterName(message.authorId)) ||
    message.authorKind === "forge"
    ? "rondo"
    : message.authorId;
}

/**
 * One basis of a message, as a chip that goes where it points (#220 S1).
 *
 * **Never an id to copy.** A `message` basis is the words it cites and a link
 * to them; an `iteration` basis links to that lap's section of the reading. The
 * other forms have no view on this page yet, so they are the terminal's own
 * {@link basisLine} and not a link -- a chip that led nowhere would be worse
 * than one that says so by not being blue. A basis that is not a locator is
 * shown as its JSON rather than dropped, so nothing the drafter cited is lost.
 */
/**
 * One basis as a word that leads where it points: the cited message by its
 * words and an anchor, everything else named and not linked.
 */
export function basisWord(
  wording: Chrome,
  basis: Readonly<Record<string, unknown>>,
  threads: Threads,
  root: string | null,
  actorId: string | null,
): ThreadLink {
  const form = basis["form"];
  let said: string;
  let href: string | null = null;
  if (form === "message" && typeof basis["messageId"] === "string") {
    const cited = threads.byId.get(basis["messageId"]);
    said =
      cited === undefined
        ? basisLine({ form: "message", messageId: basis["messageId"] }, {})
        : `${whoWrote(wording, cited, actorId)}: ${lineOf(cited)}`;
    if (cited !== undefined) {
      href =
        threads.rootOf(cited.messageId) === root
          ? `#${encodeURIComponent(cited.messageId)}`
          : `${viewHref({ kind: "thread", messageId: cited.messageId, to: null }, wording.lang)}#${encodeURIComponent(cited.messageId)}`;
    }
  } else if (form === "iteration" && typeof basis["iterationId"] === "string") {
    // A lap used to point at its section in the reading fold; with the fold
    // gone (D-0083) there is no page-wide place a lap id leads to, so the
    // basis is named and not linked.
    said = basisLine({ form: "iteration", iterationId: basis["iterationId"] }, {});
  } else if (form === "snapshot") {
    said = `snapshot ${String(basis["pointer"])}`;
  } else if ((BASIS_FORMS as readonly unknown[]).includes(form)) {
    said = basisLine(basis as unknown as Basis, {});
  } else {
    said = JSON.stringify(basis);
  }
  return { said, href, title: said };
}

/** A scope id minted for one form (`newScopeId` in `src/access/web-app.ts`). */
export type MintScopeId = () => string;

/** A lap id minted for one scoped start (`newIterationId` in `src/access/web-app.ts`). */
export type MintIterationId = () => string;

/** A budget number in a box: whole for a count, two decimals for money. */
export const money = (value: number) => value.toFixed(2);

/**
 * An expiry as a native `datetime-local` reads and writes it, **in UTC**.
 *
 * A person does not read or type a Unix millisecond, and a page with no script
 * cannot know the browser's zone -- so the one value has one meaning, the label
 * says which (`scopeExpiresLabel` names UTC), and the route parses the same
 * `YYYY-MM-DDTHH:MM` back as UTC. Where `datetime-local` is unsupported the
 * browser degrades to a text box of that shape, which the route reads
 * identically.
 */
export function localTime(atMs: number): string {
  return new Date(atMs).toISOString().slice(0, 16);
}

/**
 * **Where this request can be taken next** (D-0083 rule 6's chain, as
 * addresses): setting its scope, and publishing a lap that is ready.
 *
 * **They are in the thread because the rows that carried them are gone.** The
 * old page drew each on a lap's row; a row is now the person's own words and
 * one sentence of state, with nothing to press (rule 5). The screens they lead
 * to are unchanged, and so are the conditions each is drawn under -- the scope
 * entrance needs a write port, and the publish entrance the same three things
 * the publish screen needs before it draws a button at all.
 */
function threadActs(
  wording: Chrome,
  ports: WebPorts,
  token: string | null,
  requestMessageId: string,
  /** Oldest first, so the index is the try (`lapEvents`'s `tryAt`). */
  laps: readonly LapUnderRequest[],
  threads: Threads,
) {
  if (token === null) {
    return null;
  }
  // **Every lap that could still be published, and not the first of them**
  // (Codex): `approvedForPublication` reads a closed row with an approved
  // outcome and says nothing about whether it has been published, so one
  // entrance would go on naming a lap already published while the laps beside
  // it had none. What says it was published is the report rondo wrote into
  // this request's thread.
  const publishable =
    ports.publishing === null
      ? []
      : laps.filter(
          (lap) =>
            approvedForPublication(lap.record) && publishedReport(threads, lap.record.id) === null,
        );
  return (
    <p class="thread-acts">
      <a
        id={`scope-${requestMessageId}`}
        href={viewHref(
          {
            kind: "scope",
            messageId: requestMessageId,
            rounds: null,
            decisionId: null,
            plan: null,
          },
          wording.lang,
        )}
        data-open=""
        class={`${PRIMARY} h-7 px-3 text-[13px]`}
      >
        {wording.scopeAction}
      </a>
      {publishable.map((lap) => (
        <a
          id={`publish-${lap.record.id}`}
          href={viewHref({ kind: "publish", iterationId: lap.record.id }, wording.lang)}
          data-open=""
          class={`${PRIMARY} h-7 px-3 text-[13px]`}
        >
          {/* Which try, where there is more than one to tell apart: three
              buttons reading *publish* are three a person cannot choose
              between (D-0076 rule 3.3, as the event lines do it). */}
          {laps.length > 1
            ? wording.evOfTry(laps.indexOf(lap) + 1, wording.publishAction)
            : wording.publishAction}
        </a>
      ))}
    </p>
  );
}

/** A pull request body split around the request fold it carries. */

/** A message id minted for one form (`newMessageId` in `src/access/web-app.ts`). */
export type MintMessageId = (kind: "request" | "reply") => string;

/**
 * The box a person writes into: a new request on `requests`, a reply on
 * `thread` (D-0061 rule 4, D-0059 section 5a's send).
 *
 * **Outside the ledger, so no redraw touches a draft.** The poll swaps
 * `#ledger`; this form is after it, and what a send must renew -- the minted
 * id, the reply's target, a refusal note -- is `#composer-fields`, which only
 * this form's own response replaces (`hx-select-oob`).
 *
 * **Two ways to send, one route.** With script off it is a native `POST` and
 * the `303` lands on the thread at the message sent. With script on a reply is
 * htmx's `hx-post`: the thread is swapped in, the box stays where it is, and
 * `page/composer.js` clears the draft. A new request stays a native submit,
 * because where it lands is a different view -- its own thread -- and a swap
 * would draw that thread under the requests' address.
 *
 * **Aimed at a waiting question, the box is a press** (#220 S1): action
 * `/answer-ask`, a native `POST` with no `hx-post` in either mode, and a filled
 * button labelled as answering. Answering an ask releases the hold D-0069
 * rule 5 puts on work, and D-0059 section 5a's falsifier says a message that
 * moves work needs a press, which only a person's navigation mints.
 *
 * **The id is minted here, at render, and carried hidden** (D-0061 rule 2.1):
 * the same form sent twice is one id, and the store refuses the second. It is
 * never printed. With no approver there is no form, and the box's place says
 * why (D-0020 rule 2).
 */
function composerView(
  wording: Chrome,
  view: PageView,
  threads: Threads,
  token: string | null,
  newId: MintMessageId | null,
  actorId: string | null,
  nowMs: number,
) {
  if (view.kind !== "requests" && view.kind !== "thread") {
    return null;
  }
  if (token === null || newId === null) {
    return (
      <p class="note rounded-md border border-border bg-muted/60 px-3 py-2 text-[13px] leading-5">
        {wording.composerNoApprover}
      </p>
    );
  }
  const replying = view.kind === "thread" ? replyTarget(threads, view, actorId) : null;
  if (view.kind === "thread" && replying === null) {
    return null;
  }
  const kind = replying === null ? "request" : "reply";
  const answers = replying?.answers === true;
  const action = `/${answers ? "answer-ask" : kind}?lang=${encodeURIComponent(wording.lang)}`;
  return (
    <form
      id="composer"
      method="post"
      action={action}
      {...(replying === null || answers
        ? {}
        : {
            "hx-post": action,
            "hx-target": "#ledger",
            "hx-select": "#ledger",
            "hx-swap": "outerHTML show:window:bottom",
            // **The form is inside what the swap replaces now** (D-0083 rule
            // 5, Codex). It used to sit outside `#ledger` and be swapped out
            // of band, so that a send could change its mode -- the thread's
            // default target after a send can be a waiting ask, and answering
            // one is a press with its own `action` and no `hx-post`. The
            // ordinary swap carries the new form now, and naming it here as
            // well took it out of the response before the ledger landed, so
            // the box disappeared until the next poll.
            "hx-select-oob": "#waiting-count",
            // **One send per press, visibly** (the S1 design pass): the button
            // is disabled while its request is in flight. The store's refusal
            // of a repeated id is still what makes a double send one message.
            "hx-disabled-elt": "find button[type='submit']",
          })}
      class={
        replying === null
          ? "rounded-xl border border-border bg-card shadow-xs focus-within:border-ring/60"
          : "sticky bottom-3 z-[5] rounded-xl sm:ml-10 border border-border bg-card shadow-[0_6px_24px_-12px_rgb(0_0_0/0.35)] focus-within:border-ring/60"
      }
    >
      {replying === null ? (
        <h2 class="px-4 pt-3 text-sm leading-6 font-semibold">{wording.newRequestHeading}</h2>
      ) : null}
      <div id="composer-fields">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="message_id" value={newId(kind)} />
        {replying === null ? null : (
          <>
            <input type="hidden" name="in_reply_to" value={replying.target.messageId} />
            <div class="mx-4 mt-2.5 flex min-w-0 items-center gap-1">
              <a
                href={`#${encodeURIComponent(replying.target.messageId)}`}
                class="replying flex min-w-0 items-center gap-1.5 text-[12px] leading-5 text-muted-foreground hover:text-foreground"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="size-3.5 shrink-0 text-faint"
                >
                  <path d="M3.5 2.5v5a3 3 0 0 0 3 3h6m-3-3 3 3-3 3" />
                </svg>
                <span class="truncate">
                  {(answers ? wording.answeringTo : wording.replyingTo)(
                    whoWrote(wording, replying.target, actorId),
                    wording.age(ago(replying.target.atMs, nowMs)),
                  )}
                </span>
              </a>
              {
                // **A target chosen by hand can be let go** (the S1 design
                // pass): a navigation back to the thread's default target, which
                // keeps the draft (`page/composer.js`).
                view.kind === "thread" && view.to !== null ? (
                  <a
                    href={viewHref(
                      { kind: "thread", messageId: replying.root, to: null },
                      wording.lang,
                    )}
                    class="inline-flex size-5 shrink-0 items-center justify-center rounded text-faint hover:bg-accent hover:text-foreground"
                    title={wording.replyDefault}
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      class="size-3"
                    >
                      <path d="m4 4 8 8m0-8-8 8" />
                    </svg>
                    <span class="sr-only">{wording.replyDefault}</span>
                  </a>
                ) : null
              }
            </div>
            {/*
             * **Said where the words are typed** (#220 S1 review): a person who
             * came for a question waiting in this thread would otherwise send
             * their answer to the message above and see nothing say it did not
             * reach the question (see `replyTarget`).
             */}
            {replying.asksWaiting && !answers ? (
              <p class="not-answer mx-4 mt-0.5 text-[12px] leading-5 text-faint">
                {wording.replyNotAnswer}
              </p>
            ) : null}
          </>
        )}
        {/* Where htmx puts a refusal (the page's `responseHandling`); the draft stays. */}
        <p
          id="composer-note"
          role="status"
          data-refused={wording.notSent(wording.sendRefusedUnknown)}
          class="px-4 pt-2 text-[12.5px] leading-5 text-fail empty:hidden"
        />
      </div>
      <label for="composer-body" class="sr-only">
        {replying === null
          ? wording.newRequestHeading
          : answers
            ? wording.answerAskAction
            : wording.replyAction}
      </label>
      <textarea
        id="composer-body"
        name="body"
        required
        rows={replying === null ? 4 : 3}
        placeholder={replying === null ? wording.requestPlaceholder : wording.replyPlaceholder}
        data-draft={replying === null ? "request" : `reply:${replying.root}`}
        {...(view.kind === "thread" && view.to !== null ? { autofocus: true } : {})}
        // **The box grows with the words** (the S1 design pass): at a fixed
        // two rows a three-line draft scrolled its first line out of sight
        // under the line above it. Capped, then it scrolls.
        class="block max-h-[40vh] min-h-[4.5rem] w-full resize-y bg-transparent px-4 pt-2 text-[14px] leading-6 outline-none [field-sizing:content] placeholder:text-faint"
      />
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pt-1 pb-2.5">
        <span class="note px-1 text-[11.5px] leading-5 text-faint">
          {answers ? wording.answerOutcomeNote : wording.sendNote}
        </span>
        <span class="ml-auto flex items-center gap-3">
          {
            // **Not advertised where it does not work** (#206, Codex): the
            // chord submits without naming a button, and an answer *is* which
            // button was pressed, so `page/composer.js` leaves this one form
            // alone rather than sending an answer nobody chose.
            answers ? null : (
              <span class="js-only hidden items-center gap-1 text-[11.5px] text-faint sm:flex">
                {kbd("Ctrl/⌘")}
                {kbd("↵")}
                <span>{wording.keySend}</span>
              </span>
            )
          }
          {
            // **One button per answer, and the press is what rondo acts on**
            // (D-0072 rule 4). Two submits of one form, each carrying its own
            // `outcome`: a native submit sends the clicked button's name and
            // value, so this needs no script and works with script off -- and
            // the route refuses a press naming neither, so there is no default
            // for a browser that sends none.
            answers ? (
              <>
                <button
                  type="submit"
                  name="outcome"
                  value="stop"
                  class={`${SECONDARY} h-9 px-4 text-sm`}
                >
                  {wording.answerStopAction}
                </button>
                <button
                  type="submit"
                  name="outcome"
                  value="carry_on"
                  class={`${PRIMARY} h-9 px-4 text-sm`}
                >
                  {wording.answerCarryOnAction}
                </button>
              </>
            ) : (
              <button
                type="submit"
                class="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-foreground px-4 text-sm font-semibold text-background shadow-xs outline-none hover:bg-foreground/85 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-wait disabled:opacity-60"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="size-3.5"
                >
                  <path d="M8 13V3m-4 4 4-4 4 4" />
                </svg>
                {wording.sendAction}
              </button>
            )
          }
        </span>
      </div>
    </form>
  );
}

/** A key as the keyboard shows it. */
function kbd(key: string) {
  return (
    <kbd class="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-card px-1 font-mono text-xs text-muted-foreground shadow-[inset_0_-1px_0_var(--color-border)]">
      {key}
    </kbd>
  );
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
 * last-look marks, a field-by-field reading of every row -- is at a second
 * address below, unchanged and complete.
 *
 * **Folded is not hidden** (D-0032). Every claim that was on this page before
 * is still on it, under the same basis, in the same words; what moved is which
 * of them an operator has to read past to answer *does anything need me*. The
 * lead cites the row each of its lines is read off, once, and the reading below
 * cites the field -- so a number in the lead is checkable twice over rather
 * than asserted once.
 *
 * **Nothing here writes** (D-0041). Every read above is a read, the refresh and
 * the key script issue nothing but `GET`s, and the only thing on the page that
 * can produce anything but a `GET` is still the one form.
 *
 * **Server JSX, rendered to one string** (D-0059 rule 2): `hono/jsx` escapes
 * every text child and attribute, which is what the hand-written `escapeHtml`
 * did, so a request's `<b>` is still text.
 */
export async function operatorPage(
  ports: WebPorts,
  token: string | null = null,
  view: PageView = { kind: "summary" },
  // **The set this request resolved to, and not a property of the process**
  // (D-0056 rule 2). It was `ports.wording` while a host had one language for
  // the life of the server; it is an argument now because five steps decide it
  // per request and the renderer is downstream of that decision, not part of
  // it. `EN` by default for the same reason `token` and `view` have defaults:
  // a caller that has said nothing gets the page this was before.
  wording: Chrome = EN,
  /**
   * Mints the id a composer form carries (D-0061 rule 2.1), or null where
   * there is no say port: no minter, no form. Handed down by
   * `src/access/web-app.ts` for the token's reason -- the renderer holds
   * nothing that writes, and is not granted `node:crypto` either.
   */
  newId: MintMessageId | null = null,
  /**
   * rondo#233 S3: the scope screen's two minted ids, minted where `newId` is
   * minted and null on the same condition -- no scope port, no forms. Here and
   * not in this module for `newId`'s reason: the renderer is not granted
   * `node:crypto`, and the server hands it ids.
   */
  newScopeId: MintScopeId | null = null,
  newIterationId: MintIterationId | null = null,
): Promise<string> {
  const nowMs = ports.now();
  // **Read on every view**: the summary counts the asks waiting and the header
  // counts them for every view. A thread that will not read is said, never
  // drawn half (see `threadMessages`).
  const threadRead = await ports.record.threadMessages();
  const forms = token !== null && newId !== null;
  /**
   * **A view a person writes in.** Since D-0083 rule 3 the summary is a
   * request's thread with the boxes in it, so it is one of these: a reload
   * would throw a half-written draft away, which is what this decides
   * (#220 S1).
   */
  const onThreads = view.kind === "requests" || view.kind === "thread" || view.kind === "summary";
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
  // **The whole terminal history, and the last few of it** (rondo#244, Codex):
  // the summary's *what just finished* is the last five, while the requests
  // list is not bounded at all -- so a request whose lap fell out of those five
  // would have gone back to saying nothing about it. The slice is the summary's
  // and not the store's.
  const terminal = (await ports.store.terminalIterations()).flatMap((outcome): IterationRecord[] =>
    outcome.kind === "read" ? [outcome.record] : [],
  );
  // **A way to the release press only where there is a port behind it**, which
  // is narrower than the token: an approver the allowlist refuses still gets a
  // token for the gate's press, and would get a release that refuses every time.
  const releaseToken = ports.releasable === true ? token : null;
  // **The ledger, read once per draw** (D-0073 rule 12): what each line keeps,
  // and whether its work landed. A finished line still keeping its files is
  // listed however long ago it ended: it is the one ended thing that still
  // costs other work something, so it cannot fall off *just finished*.
  const ledger = await ports.store.laneLedger();
  // Named apart from `lineOf`, which is a message's first line: this is the
  // ledger line a lap belongs to.
  const lineFor = new Map(ledger.flatMap((line) => line.lapIds.map((id) => [id, line] as const)));
  /** A finished line keeping its files, said on its closed tips' rows. */
  const keeping = (record: IterationRecord) => {
    const line = lineFor.get(record.id);
    return line !== undefined &&
      !line.inFlight &&
      line.paths.length > 0 &&
      line.claimId !== null &&
      line.closedTips.includes(record.id)
      ? line
      : null;
  };
  const ended = endedRecently(terminal);
  // Older than *just finished* and still keeping files: its own group, so an
  // ending from weeks ago is not said to have just happened.
  const keptOlder = terminal
    .filter((record) => keeping(record) !== null && !ended.includes(record))
    .toSorted((left, right) => right.updatedAtMs - left.updatedAtMs);
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
  const threadRows = threadRead.kind === "read" ? threadRead.messages : [];
  const threads = threadsOf(
    threadRows,
    new Set([...waiting, ...running, ...keptOlder, ...ended, ...unreadable].map((row) => row.id)),
    // A reader that will not answer says nothing is waiting, rather than
    // taking the page down with it.
    ports.issuesUnread === undefined
      ? new Map()
      : await ports.issuesUnread(threadRows).catch(() => new Map()),
  );
  // **Only the ones an answer can settle** (D-0032 rule 5). `openProposals`
  // returns every proposal nobody has decided, and an explanation is
  // undecidable by construction -- `recordDecision` refuses the non-binding
  // kinds -- so every press this page makes would leave a row here for ever and
  // the count would climb with each approval. The test is
  // {@link isApprovableKind}, the closed set the compiler checks, which is what
  // `inbox` splits on too; the rest are in the reading, in the inbox's own two
  // sections, where they are material rather than a queue.
  const open = (inbox?.open ?? []).filter((proposal) => isApprovableKind(proposal.kind));
  // **One count of what waits on the person** (#220 S1): the header pill and the
  // summary's *waiting for your answer* heading both say this number -- gates,
  // questions in threads, and proposals an answer can settle -- so they cannot
  // disagree.
  const waitingCount = waiting.length + threads.waiting.size + open.length;

  const keepsCurrent = isLive(view);
  // **The token arrives null exactly when there is no writer** (D-0041 rule 4,
  // D-0059 rule 3a): the renderer is handed the reading ports and nothing that
  // could write, so whether a button is drawn is decided by the one caller that
  // does hold the writer (`src/access/web-app.ts`) and handed down as a token.
  // **Awaited here** and not inside the tree: the scope screen reads the plan
  // and, in its second state, the approval and what a predecessor spent.
  const scoping =
    view.kind === "scope"
      ? await scopeView(ports, wording, view, threads, token, newScopeId, newIterationId, nowMs)
      : null;
  /** The link onto the scope screen, drawn on a request wherever one is listed. */
  // **Which request each lap is under** (rondo#244), off the rows already
  // read: a lap names the request it was started from, so the requests list
  // can say what became of one instead of going on offering the entrance.
  // Newest wins, which is the same order every other list here is in.
  const lapsByRequest = new Map<string, LapUnderRequest>();
  /**
   * **Every lap of a request and not only the one that says most** (Codex).
   * `saysMore` picks one row to speak for a request in a list, which is what a
   * row is; the thread is the request itself, so it draws every lap's events,
   * and the box is offered for whichever lap is at a gate -- a request with a
   * running retry beside a lap still waiting would otherwise have no way to
   * answer the one that waits, now that there is no per-lap address.
   */
  const allLapsByRequest = new Map<string, LapUnderRequest[]>();
  for (const [question, group] of [
    ["waiting", waiting],
    ["running", running],
    ["ended", terminal],
  ] as const) {
    for (const record of group) {
      const request = record.requestMessageId;
      if (saysMore({ record, question }, lapsByRequest.get(request))) {
        lapsByRequest.set(request, { record, question });
      }
      allLapsByRequest.set(request, [
        ...(allLapsByRequest.get(request) ?? []),
        { record, question },
      ]);
    }
  }
  const lapUnder = (messageId: string) => lapsByRequest.get(messageId) ?? null;
  const lapsUnder = (messageId: string) => allLapsByRequest.get(messageId) ?? [];

  /*
   * **The left face's rows** (D-0083 rules 2, 5 and 7). Every request the
   * store holds, named by the person's own words, with the repository its
   * work is in and one sentence of state. What waits on the person is lifted
   * out of the time order by `requestList`; everything else is cut by day.
   */
  const listRows = threads.messages
    .filter((message) => message.inReplyTo === null)
    .map((root) => {
      const members = threads.messages.filter(
        (message) => threads.rootOf(message.messageId) === root.messageId,
      );
      const lap = lapUnder(root.messageId);
      // **Any lap of the request, not the one that speaks for it** (Codex):
      // `saysMore` would let a newer running lap hide an older one still at
      // its gate, and the request would drop out of *your turn* -- and out of
      // rule 3's selection -- with an unanswered question on it.
      const waitsHere =
        members.some((message) => threads.waiting.has(message.messageId)) ||
        lapsUnder(root.messageId).some((under) => under.question === "waiting");
      return {
        messageId: root.messageId,
        title: firstLine(root.body),
        repository: repositoryOf(lap?.record ?? null),
        state: rowStateOf(lap?.record ?? null, waitsHere, (record) => isTerminal(record.status)),
        atMs: Math.max(...members.map((message) => message.atMs)),
      };
    });
  const requestsList = requestList(listRows, inbox?.sinceMs ?? null, nowMs);

  /*
   * **Which request the centre is showing** (D-0083 rule 3). There is no
   * separate decision screen: the address names a request or it does not, and
   * where it does not the oldest thing waiting is selected, because the
   * person came to answer.
   */
  /**
   * **An address naming a message nobody wrote is said, not answered with
   * another request.** Rule 3's fallback is for an address that names none;
   * one that names a message this store does not hold is a person who
   * followed a stale link, and showing them somebody else's thread would be
   * rondo answering a question it was not asked.
   */
  const namedThread = view.kind === "thread" ? threads.rootOf(view.messageId) : null;
  const noSuchThread = view.kind === "thread" && namedThread === null;
  const selection = selectRequest(namedThread, requestsList);
  /**
   * **`requests` is the way into a new one**, so its centre is rule 4's --
   * the question and the box -- whatever is waiting. Selecting a thread there
   * would answer a person who came to write with somebody else's question.
   */
  const selectedRoot =
    noSuchThread || view.kind === "requests" || selection.kind !== "request"
      ? null
      : selection.messageId;
  const selectedLap = selectedRoot === null ? null : lapUnder(selectedRoot);
  /*
   * The lap whose gate the centre draws a box for, which is what the framing
   * below is composed for -- one row, and only the one being answered.
   */
  // **Whichever lap of this request is at a gate**, which need not be the one
  // the list speaks with: `saysMore` orders by what a row should say, and a
  // gate is answered wherever it stands (Codex).
  const answeringLap =
    selectedRoot === null
      ? null
      : (lapsUnder(selectedRoot).find((lap) => lap.question === "waiting")?.record.id ?? null);
  const shown = await shownBeforePress(ports, wording, waiting, token, answeringLap);

  /*
   * **The centre face** (D-0083 rule 5): the selected request's thread, or
   * rule 4's empty centre when nothing waits and nothing was named.
   *
   * The messages and the event lines are one stream in the order they
   * happened; the box to answer in and the box to add to the request are
   * composed by the parts that own them and placed here.
   */
  /** The screens the page's rebuild does not touch, which keep their own centre. */
  const onOwnScreen = view.kind === "scope" || view.kind === "publish" || view.kind === "release";
  const selectedMessages =
    selectedRoot === null
      ? []
      : threads.messages
          .filter((message) => threads.rootOf(message.messageId) === selectedRoot)
          .toSorted((left, right) => left.atMs - right.atMs);
  /*
   * **Every lap of the request, each with its own readings** (Codex): the
   * thread is the request, so a retry arriving must not take the lap it
   * superseded out of the record. Read here, once, for the one request the
   * centre is drawing.
   */
  // Oldest first, so *try 1* is the first attempt and the walk down the
  // thread and the count agree.
  const selectedLaps =
    selectedRoot === null
      ? []
      : lapsUnder(selectedRoot).toSorted(
          (left, right) => left.record.createdAtMs - right.record.createdAtMs,
        );
  const readingsByLap = new Map(
    await Promise.all(
      selectedLaps.map(
        async (lap) => [lap.record.id, await ports.store.readingsFor(lap.record.id)] as const,
      ),
    ),
  );
  /*
   * **What was agreed for this request** (D-0083 rule 6), read for the one lap
   * the centre is drawing and for no other: the approval the lap spends, and
   * what has been spent against it. Both or neither -- rule 6 refuses a spent
   * figure without the figure it was approved against, and `governanceOf`
   * takes them as one argument for that reason.
   */
  const approvalOf = async (
    record: IterationRecord,
  ): Promise<{ decisionId: string; payload: ScopePayload; spent: ScopeSpent } | null> => {
    const tip = await approvalTip(ports.record, record.id);
    if (tip.kind !== "tip") {
      return null;
    }
    const decided = await ports.record.readScopeDecision(tip.scopeDecisionId);
    if (decided.kind !== "read") {
      return null;
    }
    const stored = await ports.record.readScope(decided.decision.scopeId);
    if (stored.kind !== "read") {
      return null;
    }
    return {
      // **The approval's own id, for the week's sum** (rule 4): several laps
      // of one request spend one approval, so a week that added them up per
      // lap would count the same allowance as many times as it was retried.
      decisionId: tip.scopeDecisionId,
      payload: stored.scope.payload,
      spent: await ports.record.scopeSpent(tip.scopeDecisionId),
    };
  };
  const selectedGovernance =
    selectedLap === null || selectedRoot === null
      ? null
      : governanceOf(
          selectedLap.record,
          repositoryOf(selectedLap.record),
          threads.byId.get(selectedRoot)?.atMs ?? nowMs,
          await approvalOf(selectedLap.record),
          // A proposal is done when rondo recorded one: the published report
          // it writes into the request's thread (rondo#245).
          publishedReport(threads, selectedLap.record.id) !== null,
        );
  /*
   * **The two messages whose body is not prose**, rendered here because this
   * renderer still owns them: what rondo read of a named issue (D-0078 section
   * 4) and a drafter run that drafted nothing (rondo#238). They cross the seam
   * as markup, like the boxes, and are awaited once rather than inside the
   * synchronous map below.
   */
  const drawnBodies = new Map(
    await Promise.all(
      selectedMessages
        .filter((message) => message.authorKind === "forge" || noDraft(message))
        .map(
          async (message) =>
            [
              message.messageId,
              await (message.authorKind === "forge"
                ? forgeView(wording, message)
                : noDraftView(wording, message, selectedRoot ?? "", forms)
              ).toString(),
            ] as const,
        ),
    ),
  );
  /** Each message's moment, for rule 7's line: the items themselves do not carry it. */
  const messageTimes = new Map(selectedMessages.map((m) => [m.messageId, m.atMs]));
  const threadItems: ThreadItem[] = [
    ...selectedMessages.map((message, at): ThreadItem => {
      const waits = threads.waiting.has(message.messageId);
      const parent = message.inReplyTo === null ? undefined : threads.byId.get(message.inReplyTo);
      const previous = selectedMessages[at - 1];
      return {
        kind: "message",
        message: {
          id: message.messageId,
          who: message.authorKind === "operator" ? "person" : "rondo",
          voice: message.authorKind,
          said: whoWrote(wording, message, ports.actorId),
          body: message.body,
          drawn: (() => {
            const markup = drawnBodies.get(message.messageId);
            return markup === undefined ? null : Raw({ html: markup });
          })(),
          at: wording.age(ago(message.atMs, nowMs)),
          atTitle: new Date(message.atMs).toISOString(),
          // **Which of the two reasons it still waits** (D-0072 rule 3):
          // nobody has been back to it, or the person has and said to stop.
          waiting: !waits
            ? null
            : threads.stopped.has(message.messageId)
              ? wording.askStoppedPill
              : wording.askWaitingPill,
          // **What this message answered, where it was said** (D-0072 rule 1):
          // the words are kept byte for byte either way, so with no mark here
          // two answers that read alike and did opposite things would be one
          // entry in the thread.
          answered:
            message.answerOutcome === undefined
              ? null
              : message.answerOutcome === "stop"
                ? wording.answerStoppedPill
                : wording.answerCarriedOnPill,
          pending: (threads.unread.get(message.messageId) ?? []).map((ref) => ref.named),
          pendingSaid: wording.issuePending,
          bases: message.bases.map((basis) =>
            basisWord(wording, basis, threads, selectedRoot, ports.actorId),
          ),
          basesLabel: wording.basesLabel,
          // Said only where the reply is to neither the message above it nor
          // the request itself, which is what every reply is read as.
          inReplyTo:
            parent === undefined ||
            parent.messageId === previous?.messageId ||
            parent.messageId === selectedRoot
              ? null
              : {
                  said: wording.inReplyTo(whoWrote(wording, parent, ports.actorId), lineOf(parent)),
                  href: `#${encodeURIComponent(parent.messageId)}`,
                },
          reply:
            !forms || selectedRoot === null
              ? null
              : {
                  href: viewHref(
                    { kind: "thread", messageId: selectedRoot, to: message.messageId },
                    wording.lang,
                  ),
                  said: waits ? wording.answerAskAction : wording.replyAction,
                },
        },
      };
    }),
    ...selectedLaps.flatMap((lap, tryAt) =>
      lapEvents(
        wording,
        lap.record,
        (readingsByLap.get(lap.record.id) ?? []).map((reading) => ({
          drafter: reading.drafter,
          verdict: reading.verdict,
          findings: reading.findings,
          atMs: reading.readAtMs,
        })),
        (status) => isTerminal(status as IterationRecord["status"]),
        (atMs) => wording.age(ago(atMs, nowMs)),
        // Said only where there is more than one to tell apart.
        selectedLaps.length > 1 ? tryAt + 1 : null,
      ).map((event): ThreadItem => ({ kind: "event", event })),
    ),
  ]
    /*
     * **One stream, in the order it happened** (D-0083 rule 2, and
     * `page/thread.tsx`'s own claim about itself). The two sources are
     * gathered apart and have to be put back in time order here, or a lap's
     * report is drawn before the line saying the lap started -- and rule 7's
     * line, which is placed by walking this array, lands in the wrong place.
     */
    .map((item, at) => ({
      item,
      at,
      atMs: item.kind === "message" ? (messageTimes.get(item.message.id) ?? 0) : item.event.atMs,
    }))
    // `at` breaks the tie, so two things at the same millisecond keep the
    // order their source gave them rather than one the sort invented.
    .toSorted((left, right) => left.atMs - right.atMs || left.at - right.at)
    .map((sorted) => sorted.item);
  /*
   * **One line, once in the thread** (D-0083 rule 7, D-0061 rule 2.5). The
   * items are already in the order they happened, so the line sits above the
   * first one that arrived after the person last looked. There is no line
   * where they have never looked, and none where everything is older than
   * the mark: both mean nothing is below it, and a line with nothing under
   * it says something false.
   *
   * **No row carries a *new* mark of its own** (rule 7): the list face draws
   * the other one, and between them that is two lines on the page.
   */
  const lastLookedMs = inbox?.sinceMs ?? null;
  const marks = threadItems.map((item) =>
    item.kind === "message"
      ? { id: item.message.id, atMs: messageTimes.get(item.message.id) ?? 0 }
      : { id: item.event.id, atMs: item.event.atMs },
  );
  const firstUnseen =
    lastLookedMs === null ? -1 : marks.findIndex((mark) => mark.atMs > lastLookedMs);
  const lastLookedAbove = firstUnseen <= 0 ? null : (marks[firstUnseen]?.id ?? null);
  /*
   * The week's allowance is the right face's second slice; until it is read
   * from an approval, no figure is drawn -- rule 6 refuses a spent figure
   * without the one it was approved against, and that refusal is the honest
   * state rather than a zero.
   */
  /*
   * **The centre, as one of two things** (D-0083 rules 4 and 5): the selected
   * request's thread, or -- with nothing waiting and nothing named -- the
   * empty centre, which asks what the person wants rather than showing an
   * empty thread.
   */
  /*
   * The two boxes a person writes in are still this renderer's
   * (`composerView`), so they cross the seam as markup: the request box on the
   * empty centre, and the box to add to a request under every thread. They
   * are composed by the part that owns them and only placed here.
   */
  // **Composed whether or not there is a write port**: with none, the box's
  // own part says the threads can be read and not written to, and D-0020 rule
  // 2 wants that where a person is looking rather than on one screen.
  const askBox = await composerView(
    wording,
    { kind: "requests" },
    threads,
    token,
    newId,
    ports.actorId,
    nowMs,
  )?.toString();
  const addBox =
    selectedRoot === null
      ? null
      : await composerView(
          wording,
          // **The message the box answers is the one the address names**
          // (`replyTarget`): a person who followed a message's own *reply*
          // link asked for that message, and the box has to be aimed at it.
          { kind: "thread", messageId: selectedRoot, to: view.kind === "thread" ? view.to : null },
          threads,
          token,
          newId,
          ports.actorId,
          nowMs,
        )?.toString();
  /*
   * **The box to answer in** (D-0083 rule 9): the gate, whole, inside the
   * thread rather than on a screen of its own. `shown` holds the framing for
   * exactly this lap, and `approveView` composes every element the gate had
   * -- the free-text field, both despite sentences, the withheld plain
   * approve, the finding quoted -- which
   * `test/access/gate-elements.test.ts` is the net under.
   */
  const gateFraming = answeringLap === null ? undefined : shown.get(answeringLap);
  // The lap the box is for, which is the one at the gate rather than the one
  // the list speaks with.
  const gatedLap =
    answeringLap === null || selectedRoot === null
      ? null
      : (lapsUnder(selectedRoot).find((lap) => lap.record.id === answeringLap)?.record ?? null);
  const answeringBox =
    gatedLap === null || gateFraming === undefined
      ? null
      : ((await approveView(wording, gatedLap, token, gateFraming, newIterationId)?.toString()) ??
        null);
  const actsMarkup =
    selectedRoot === null
      ? null
      : ((await threadActs(
          wording,
          ports,
          token,
          selectedRoot,
          selectedLaps,
          threads,
        )?.toString()) ?? null);
  const centreContent = noSuchThread
    ? { rendered: await note(wording.noSuchThread).toString() }
    : selectedRoot === null
      ? {
          react: EmptyCentre({
            wording,
            composer: askBox === null || askBox === undefined ? null : Raw({ html: askBox }),
          }),
        }
      : {
          react: ThreadFace({
            title: firstLine(threads.byId.get(selectedRoot)?.body ?? ""),
            walk: (() => {
              // **The walk is over what waits on the person** (D-0083 rule 3),
              // in the list's own order, so *next* is the next-oldest thing
              // waiting rather than the next row of anything.
              const at = walkPosition(selectedRoot, requestsList);
              if (at === null) {
                return null;
              }
              const next = requestsList.yourTurn[at.at];
              return {
                said: wording.walkAt(at.at, at.of),
                nextHref:
                  next === undefined
                    ? null
                    : viewHref(
                        { kind: "thread", messageId: next.messageId, to: null },
                        wording.lang,
                      ),
                nextSaid: wording.walkNext,
              };
            })(),
            governance:
              selectedGovernance === null
                ? null
                : GovernanceLine({
                    wording,
                    governance: selectedGovernance,
                    askedSaid: wording.age(ago(selectedGovernance.askedAtMs, nowMs)),
                  }),
            items: folds(wording, threadItems, lastLookedAbove),
            foldOpen: wording.foldOpen,
            lastLookedAbove,
            lastLookedSaid:
              lastLookedMs === null
                ? wording.lastLookedNever
                : wording.lastLookedHere(wording.age(ago(lastLookedMs, nowMs))),
            acts: actsMarkup === null ? null : Raw({ html: actsMarkup }),
            answering: answeringBox === null ? null : Raw({ html: answeringBox }),
            adding: addBox === null || addBox === undefined ? null : Raw({ html: addBox }),
          }),
        };
  /*
   * **The right face, with nothing waiting** (D-0083 rule 4, and gate point
   * 7's last slice): the last seven days, and each running request with its
   * allowance and the five steps to its end.
   *
   * **Only where it is drawn.** These are reads nothing else on the page
   * needs -- a window of changes, the attention rows' own count, and one
   * approval per lap that moved this week -- so a thread view pays for none
   * of them. The right face of a *thread* is still null: rule 5's material
   * and rule 6 in full are the slice this one does not do (gate point 7).
   *
   * **No figure here is stored** (`D-0032` rule 3): the week is counted from
   * rows that already exist each time it is drawn.
   */
  const centreIsEmpty = !onOwnScreen && !noSuchThread && selectedRoot === null;
  const weekFromMs = nowMs - WEEK_MS;
  /*
   * **The person's own answers, from the two tables that hold them**: an
   * answer to a proposal (`human_decision`) and an approval of a scope
   * (`scope_decision`), which are different acts and never the same press --
   * plus the answers written into a thread, which this render already holds.
   */
  const weekChanges = centreIsEmpty ? await ports.record.changedSince(weekFromMs) : [];
  const weekAttention = centreIsEmpty
    ? await ports.record.attentionBreakdown({ fromMs: weekFromMs, toMs: nowMs })
    : [];
  /*
   * **The week's money, counted over two different keys** (`page-logic/week.ts`,
   * D-0074). What is *spent* is counted once per approval that **admitted** a
   * lap, because `scopeSpent` counts the admissions written under that one
   * decision and a raise writes a new one -- keyed by the tip, everything spent
   * before a raise would vanish from the week. What is *approved* is counted
   * once per approval **in force**, the tip of its chain, because a raise
   * replaces a ceiling rather than adding to it.
   */
  const weekSpent = new Map<string, number>();
  const weekApproved = new Map<string, number>();
  if (centreIsEmpty) {
    const touched = [...allLapsByRequest.values()]
      .flat()
      .filter((lap) => Math.max(lap.record.createdAtMs, lap.record.updatedAtMs) >= weekFromMs);
    const read = await Promise.all(
      touched.map(async (lap) => ({
        approval: await approvalOf(lap.record),
        admitted: await ports.record.scopeDecisionAdmitting(lap.record.id),
      })),
    );
    for (const { approval, admitted } of read) {
      if (approval === null) {
        continue;
      }
      weekApproved.set(approval.decisionId, approval.payload.budgets.cost_usd);
      if (admitted === null || weekSpent.has(admitted)) {
        continue;
      }
      weekSpent.set(
        admitted,
        allowanceOf({
          payload: approval.payload,
          // The tip's own spend where the lap was admitted under it, and the
          // admitting decision's where a raise has moved the tip on.
          spent:
            admitted === approval.decisionId
              ? approval.spent
              : await ports.record.scopeSpent(admitted),
        }).spentUsd,
      );
    }
  }
  const sideRunning: SideWork[] = !centreIsEmpty
    ? []
    : await Promise.all(
        // Newest first, which is the order every other list on this page is in.
        running
          .toSorted((left, right) => right.createdAtMs - left.createdAtMs)
          .map(async (record): Promise<SideWork> => {
            const approval = await approvalOf(record);
            return {
              messageId: record.requestMessageId,
              // The person's own words, as the list names a row (rule 2). The
              // lap's own `request` stands in only where the message it was
              // started from has gone.
              title: firstLine(threads.byId.get(record.requestMessageId)?.body ?? record.request),
              repository: repositoryOf(record),
              goingSaid: wording.age(ago(record.createdAtMs, nowMs)),
              allowance: approval === null ? null : allowanceOf(approval),
              tries:
                approval === null
                  ? null
                  : { at: approval.spent.admissions, of: approval.payload.budgets.laps },
              steps: stepsOf(record, await ports.store.readingsFor(record.id)),
            };
          }),
      );
  const sideContent = !centreIsEmpty
    ? null
    : {
        react: EmptySide({
          wording,
          figures: weekFigures(
            {
              askedAtMs: threads.messages
                .filter((message) => message.inReplyTo === null)
                .map((message) => message.atMs),
              /*
               * **A request and not a lap** (rule 2's unit): a request tried
               * three times and taken in once has finished once, and counting
               * its closed laps would say three beside an *asked* that counted
               * the request as one.
               */
              finishedAtMs: [
                ...terminal
                  .filter((record) => record.status === "closed")
                  .reduce(
                    (byRequest, record) =>
                      byRequest.set(
                        record.requestMessageId,
                        Math.max(byRequest.get(record.requestMessageId) ?? 0, record.updatedAtMs),
                      ),
                    new Map<string, number>(),
                  )
                  .values(),
              ],
              answeredAtMs: [
                ...weekChanges
                  .filter(
                    (change) =>
                      change.kind === "human_decision" || change.kind === "scope_decision",
                  )
                  .map((change) => change.atMs),
                ...threads.messages
                  .filter(
                    (message) =>
                      message.authorKind === "operator" && message.answerOutcome !== undefined,
                  )
                  .map((message) => message.atMs),
              ],
              decidedWithoutAsking: weekAttention
                .filter((count) => count.disposition === "withheld")
                .reduce((sum, count) => sum + count.count, 0),
              spentUsd: [...weekSpent.values()],
              approvedUsd: [...weekApproved.values()],
            },
            nowMs,
          ),
          running: sideRunning,
          hrefOf: (messageId) => viewHref({ kind: "thread", messageId, to: null }, wording.lang),
        }),
      };
  const listContent = {
    react: RequestsFace({
      wording,
      list: requestsList,
      hrefOf: (messageId) => viewHref({ kind: "thread", messageId, to: null }, wording.lang),
      agoOf: (atMs) => wording.age(ago(atMs, nowMs)),
      allowance: null,
      newRequestHref: forms ? viewHref({ kind: "requests" }, wording.lang) : null,
      lastLookedSaid:
        inbox?.sinceMs === null || inbox?.sinceMs === undefined
          ? wording.lastLookedNever
          : wording.lastLookedHere(wording.age(ago(inbox.sinceMs, nowMs))),
    }),
  };
  // **Awaited here** for `scoping`'s reason: the dry-run reads a workspace and
  // the forge's own configuration, and the tree is composed from what it read.
  const publishing =
    view.kind === "publish" ? await publishView(ports, wording, view, token, threads) : null;
  const releasing =
    view.kind === "release"
      ? await releaseView(ports, wording, view, releaseToken, ledger, threads, nowMs)
      : null;
  /**
   * **Whether a person may be writing on this view.** With script off a reload
   * throws a half-written draft away, so a view with a box does not reload
   * itself and says so (#220 S1). The box to answer a gate counts as one:
   * since D-0083 rule 9 it holds the free-text field a press carries, and it
   * is drawn wherever a question is standing rather than on a screen of its
   * own that never reloaded.
   */
  const writingHere = onThreads && (forms || answeringBox !== null);
  const here = viewHref(view, wording.lang);
  const page = (
    // **The document declares the language rondo actually wrote it in, and
    // never the one that was asked for** (D-0055 rule 7). `wording.lang` is the
    // tag of the set that was selected, so a well-formed tag this tree ships no
    // set for renders an English page that says `en` -- which is what the
    // document *is*. rondo does not declare an intention as a fact.
    <html lang={wording.lang}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {
          // **What keeps a live view current, in both modes** (D-0054 rules 1
          // and 7, D-0059 R2). With scripting off, the meta refresh inside
          // `<noscript>` throws the document away every five seconds, which is
          // still better than a screen that goes stale without saying so. With
          // scripting on, htmx polls this same address (below, on `#ledger`)
          // and swaps the ledger in place, so the reader's scroll and focus
          // survive. The `answer` view reaches none of this: it has no refresh
          // in either mode, so there is nothing for it to degrade to.
          keepsCurrent ? (
            <>
              {
                // **Not where a person may be writing** (#220 S1): with script
                // off a reload would throw a half-written draft away, so a
                // view with a composer does not reload itself and says so.
                writingHere ? null : (
                  <noscript>
                    <meta http-equiv="refresh" content={`${String(REFRESH_SECONDS)};url=${here}`} />
                  </noscript>
                )
              }
              {/*
               * R2's substitute, as the library's own configuration: requests
               * to this origin only, no `eval`, no script out of a response, no
               * history cache, and no inline indicator style the CSP would
               * refuse anyway.
               */}
              <meta
                name="htmx-config"
                content={JSON.stringify({
                  selfRequestsOnly: true,
                  allowEval: false,
                  allowScriptTags: false,
                  historyEnabled: false,
                  includeIndicatorStyles: false,
                  // **A refused send is shown where the draft is** (#220 S1):
                  // htmx swaps no error by default, so a `409` would change
                  // nothing on the screen. The send routes answer htmx with a
                  // `#send-refused` line, and it goes into the composer's note;
                  // the draft is not touched.
                  responseHandling: [
                    { code: "204", swap: false },
                    { code: "[23]..", swap: true },
                    {
                      code: "[45]..",
                      swap: true,
                      error: true,
                      target: "#composer-note",
                      select: "#send-refused",
                      swapOverride: "innerHTML",
                    },
                  ],
                })}
              />
            </>
          ) : null
        }
        <title>rondo</title>
        <link rel="stylesheet" href="/app.css" />
        {
          // `defer` on both, in this order: htmx is defined before the key
          // script runs, and neither runs before the document exists. Neither
          // draws anything a person must read -- the whole document is already
          // here, rendered by the server (D-0054 rule 7).
          keepsCurrent ? <script src="/htmx.min.js" defer /> : null
        }
        <script src="/keys.js" defer />
        <script src="/composer.js" defer />
      </head>
      <body class="min-h-screen bg-background font-sans text-foreground antialiased">
        <header class="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-sm">
          <div class="mx-auto flex h-12 max-w-5xl items-center gap-3 px-4 sm:px-6">
            <h1 class="text-[15px] font-semibold tracking-tight">
              {
                // `data-back` is what `Esc` follows; on the summary there is
                // nowhere further back to go, so it is absent there, and on a
                // thread the way back is the requests link beside this.
                view.kind === "summary" || view.kind === "thread" || view.kind === "scope" ? (
                  <a href={here}>rondo</a>
                ) : (
                  <a href={viewHref({ kind: "summary" }, wording.lang)} data-back="">
                    rondo
                  </a>
                )
              }
            </h1>
            {/*
             * **The way into the requests, on every view** (#220 S1), and beside
             * it the count of everything waiting on the person -- the same number
             * as the summary's heading, and a link to that summary. The count is
             * its own element so a redraw can renew it out of band: the header
             * is not swapped.
             */}
            <span aria-hidden="true" class="text-faint">
              /
            </span>
            <a
              href={viewHref({ kind: "requests" }, wording.lang)}
              class={`inline-flex items-center gap-1.5 text-[13px] hover:text-foreground ${onThreads ? "font-medium text-foreground" : "text-muted-foreground"}`}
              {...(view.kind === "thread" ? { "data-back": "" } : {})}
              {...(view.kind === "requests" ? { "aria-current": "page" } : {})}
            >
              {wording.requestsNav}
            </a>
            <span id="waiting-count" class="empty:hidden">
              {waitingCount === 0 ? null : (
                // **Said as what it counts** (the S1 design pass): a bare `1`
                // beside "Requests" read as a count of requests.
                <a
                  href={viewHref({ kind: "summary" }, wording.lang)}
                  class={`${PILL} px-1.5 font-sans ${TONE.wait} hover:underline`}
                >
                  {wording.waitingCount(waitingCount)}
                </a>
              )}
            </span>
            {
              // The thread's own crumb, where there is room for it; the thread
              // header names it at every width.
              view.kind === "thread" && threads.rootOf(view.messageId) !== null ? (
                <>
                  <span aria-hidden="true" class="hidden text-faint xl:inline">
                    /
                  </span>
                  <span
                    class="hidden max-w-[16rem] truncate text-[13px] text-foreground xl:inline"
                    lang=""
                  >
                    {firstLine(threads.byId.get(threads.rootOf(view.messageId) ?? "")?.body ?? "")}
                  </span>
                </>
              ) : null
            }
            {keepsCurrent ? (
              <>
                {/*
                 * **Script only** (the third design pass): with script off the
                 * meta refresh reloads the document, which the foot note says,
                 * and a *live* pill there claimed an in-place redraw that is not
                 * happening.
                 */}
                <span class={`js-only ${PILL} gap-1.5 font-sans ${TONE.ok}`}>
                  <span class="size-1.5 rounded-full bg-ok motion-safe:animate-pulse" />
                  {wording.liveLabel}
                </span>
              </>
            ) : null}
            <span class="flex-1" />
            {
              // **Whose name a send and a press are recorded under** (the S1
              // design pass), in place of a sentence naming the variable.
              ports.actorId === null ? null : (
                <span
                  class="hidden items-center gap-1.5 text-[12.5px] text-muted-foreground lg:inline-flex"
                  title={wording.signedInAs(ports.actorId)}
                >
                  <span class="inline-flex size-5 items-center justify-center rounded-full bg-muted text-[10.5px] font-semibold text-foreground ring-1 ring-border">
                    {ports.actorId.slice(0, 1).toUpperCase()}
                  </span>
                  {ports.actorId}
                </span>
              )
            }
            <span class="js-only hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              {
                // Each view names only the keys that do something on it,
                // and the summary has nowhere to go back to.
                <>
                  {kbd("j")}
                  {kbd("k")}
                  <span class="mr-2">{wording.keyMove}</span>
                  {kbd("↵")}
                  <span class="mr-2">{wording.keyOpen}</span>
                </>
              }
              {view.kind === "summary" ? null : (
                <>
                  {kbd("esc")}
                  <span class="mr-2">{wording.keyBack}</span>
                  {onThreads && forms ? (
                    <>
                      {kbd("r")}
                      <span class="ml-0.5">{wording.keyWrite}</span>
                    </>
                  ) : null}
                </>
              )}
            </span>
            {
              // **The switch, and it is the first element of this chrome that
              // exists in order to be operated rather than read** (D-0056 rule
              // 10). One link per shipped set other than the one on screen,
              // labelled with that language's own name in its own language --
              // so the label is the same bytes in every set and needs no special
              // case for going back. **It keeps the view it was pressed on**,
              // and it is a `GET` that writes nothing to the ledger. It is also
              // the only thing on this page that writes rule 5's memory. The
              // links carry no class of their own; the nav styles them, so a
              // link is still exactly its address, its tag and its name.
              // Muted, so the one thing in the header in colour is the live state.
              <nav class="switch flex shrink-0 gap-3 whitespace-nowrap text-[13px] text-muted-foreground [&>a]:hover:text-foreground [&>a]:hover:underline">
                {[...SHIPPED_SETS]
                  .filter(([tag]) => tag !== wording.lang)
                  .map(([tag, endonym]) => (
                    <a href={viewHref(view, tag)} lang={tag}>
                      {endonym}
                    </a>
                  ))}
              </nav>
            }
          </div>
        </header>
        {/*
         * **The three faces** (D-0083 rules 1 and 5). The faces are React and
         * the things inside them are still this renderer's server JSX, so the
         * centre is handed over as markup (`src/access/page/shell.tsx`, which
         * exists to be deleted as each face is rebuilt). The left and right
         * faces are frames with nothing in them yet: the list is this slice's
         * next change, the right face's governance is the second slice's, and
         * the empty state's right face is the third's (gate point 7).
         */}
        <main>
          {
            // **Said on the visible page, whichever face a person is on**
            // (D-0020 rule 2). With no approver there is no write port and so
            // no button anywhere; a page that left this to one screen would
            // have an operator looking for a button that is missing for a
            // reason rondo knows and did not say. It sits above the faces
            // because it is true of the whole page and not of one of them.
            ports.actorId === null ? (
              <p class="note mx-auto max-w-5xl rounded-md border border-border bg-muted/60 px-3 py-2 text-[13px] leading-5">
                {wording.noApproverNote}
              </p>
            ) : null
          }
          {
            // A thread read that fails while the page is open must be said by
            // the redraw that shows the empty list, and must go away with the
            // redraw that recovers (#220 S1, Codex). Above the faces, because
            // with the threads unreadable there is no centre to put it in.
            threadRead.kind === "unreadable" ? (
              <p class="note mx-auto max-w-5xl rounded-md border border-fail/40 px-3 py-2 text-[13px] leading-5 text-fail">
                {wording.threadsUnreadable(threadRead.reason)}
              </p>
            ) : null
          }
          {/*
           * **What the refresh swaps is the faces** (D-0054 rules 1 and 2,
           * D-0059 R3). htmx `GET`s this view's own address every five seconds
           * and takes `#ledger` out of the document that comes back. There is
           * no fragment endpoint -- the response is the whole page a
           * navigating browser gets -- so there is no second rendering of
           * anything to keep true.
           *
           * It wrapped the status groups while the page was a ledger of laps;
           * since D-0083 what goes stale is the thread and the list beside it,
           * so the wrapper moved out here. The name stayed: `hx-get` and
           * `hx-select` have to agree with each other, and renaming it would
           * only churn the selector.
           */}
          <div
            id="ledger"
            {...(keepsCurrent
              ? {
                  "hx-get": here,
                  "hx-trigger": "every 5s",
                  "hx-select": "#ledger",
                  "hx-swap": "outerHTML",
                  "hx-select-oob": "#waiting-count",
                }
              : {})}
          >
            {raw(
              facesMarkup({
                list: listContent,
                side: sideContent,
                /*
                 * **The screens this rebuild does not touch keep their own
                 * centre**: the scope screen, publish, the log and release are
                 * still this renderer's server JSX, and they are drawn in the
                 * centre face as they were. Everything else -- the page a
                 * person actually arrives on -- is the thread or the empty
                 * centre.
                 */
                thread: onOwnScreen
                  ? {
                      rendered: await (
                        <div class="mx-auto max-w-5xl space-y-6 px-4 pt-6 pb-12 sm:px-6">
                          {view.kind === "scope"
                            ? scoping
                            : view.kind === "publish"
                              ? publishing
                              : releasing}
                        </div>
                      ).toString(),
                    }
                  : centreContent,
              }),
            )}
          </div>
          {
            // **Each view says which of the two it is**, because "redraws
            // every 5s" on a view that does not would be the page's own copy
            // lying about the one property D-0054 rule 1 spends itself on.
            // Both say the same thing about writing, which is the fact that
            // did not change: a read writes nothing, whoever or whatever
            // issued it. At the foot rather than the head (the design pass on
            // #220): it is the page's account of itself, and what needs the
            // reader leads. **One short line, and the account in its
            // `title`** (the S1 design pass).
            //
            // **Outside the swap**, because it is true of the document and not
            // of the faces; the header's live pill is its pair and is outside
            // too.
            <p class="note mx-auto max-w-5xl px-4 text-[11.5px] leading-5 text-faint sm:px-6">
              <span
                title={
                  onThreads
                    ? wording.threadsLiveNote(REFRESH_SECONDS)
                    : keepsCurrent
                      ? wording.liveNote(REFRESH_SECONDS)
                      : wording.stillNote
                }
              >
                {
                  // **Script only, as the header's live pill** (#220 S1): with
                  // script off nothing redraws in place, and a thread with a
                  // box does not reload at all, so "live" would be false there.
                  keepsCurrent ? (
                    <span class="js-only">{wording.liveShort(REFRESH_SECONDS)}</span>
                  ) : (
                    wording.stillShort
                  )
                }
              </span>
            </p>
          }
        </main>
      </body>
    </html>
  );

  return `<!doctype html>\n${await page.toString()}\n`;
}
