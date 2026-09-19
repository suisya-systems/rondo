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
import { parseAccept } from "hono/utils/accept";
import {
  type BudgetBasis,
  type BudgetFormula,
  type BudgetValue,
  DEFAULT_REVIEW_ROUNDS,
} from "../advisory/budget.js";
import {
  type AdvisorySnapshot,
  BASIS_FORMS,
  type Basis,
  type Claim,
  type HostSnapshot,
  propose,
  proposeHost,
  UNDETERMINED,
} from "../advisory/proposal.js";
import type { LapLogReading } from "../continuo/transcript.js";
import type { HostPolicy } from "../refrain/policy.js";
import {
  type AnswerOutcome,
  approvedForPublication,
  FINDING_SEVERITIES,
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
  type OpenProposal,
  readingCoverage,
  reviewedReading,
  SCOPE_OUTWARD_ACTS,
  type StoredScope,
  type ThreadMessageDraft,
  WAIT_SIDE,
} from "../store/records.js";
import type { AdvisoryRecord, IterationStore } from "../store/sqlite.js";
import { basisLine, gather, gatherHost } from "./advisory.js";
import { draftedStartReadiness } from "./drafted-start.js";
import {
  type DraftedPlanShown,
  type DraftedScopeShown,
  draftedPlansUnder,
  draftedStanding,
} from "./drafted-view.js";
import type { LapWorkInspection } from "./forge.js";
import {
  ago,
  gatherInbox,
  type InboxReadPorts,
  type InboxSnapshot,
  inboxLines,
  type LiveRow,
  locateRunning,
  type TranscriptLocation,
  unblockedBy,
  whereItRuns,
} from "./inbox.js";
import { markdownHtml } from "./markdown.js";
import { isModelDrafterName } from "./model-draft.js";
import { type HeldPlan, heldPlanByDigest, heldPlans } from "./model-drafter.js";
import { denialLine, LIST_LIMIT } from "./review.js";
import { heldAgentTypeLines, scopeBudgetsFromStore } from "./scope.js";
import { type Chrome, EN, SHIPPED_SETS, setFor } from "./wording.js";

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
      // rondo#238: the plans a person picks from are the ones rondo holds.
      | "heldAgentTypeDigests"
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
   * A running lap's log, read at the directory `locateTranscript` named
   * (rondo#248 item 3). A function for {@link LapMaterial}'s reason: the
   * renderer opens no file, and what it is handed reads two named files under
   * a directory rondo composed from the row, never a path from a request.
   */
  readonly readLog: (directory: string) => LapLogReading;
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
 * Which of the one page's three views is being read.
 *
 * **The whole of this surface's state is in the address**, which is what makes
 * it survivable: the view is a query the server reads, so every redraw --
 * the `<noscript>` refresh, or htmx's own `GET` -- asks for the view
 * being read and is answered with it. A view outlives every redraw because the
 * server is the one holding it, and not because a client remembered anything;
 * D-0054 added a script and D-0059 a library, and neither adds client state or
 * a router.
 *
 * `summary` answers the three questions and nothing else. `reading` adds
 * rondo's own compositions -- the inbox, what spans the live laps, every row's
 * claims under their own pointers. `answer` is one row's whole framing beside
 * its button, and it exists because **the press is the presentation** (D-0042):
 * what a press records is `explainIteration`'s entire claim set, counted as
 * shown, so the page that carries the button has to be the page that carried
 * every one of those claims. A summary with a button would record a
 * presentation that did not happen.
 *
 * Queries on `/` rather than three paths, because the router refuses every path
 * but `/` and a second URL is a second one to get wrong. All three are `GET`s
 * and all three write nothing (D-0041).
 */
export type PageView =
  | { readonly kind: "summary" }
  | { readonly kind: "reading" }
  | { readonly kind: "answer"; readonly iterationId: string }
  /**
   * The request threads (D-0061 rule 4, #220 S1): `requests` lists them and
   * carries the composer for a new one; `thread` is one of them, named by any
   * message in it -- so the address a send redirects to is the message it
   * sent -- with `to` the message the reply box answers, or null for the
   * default ({@link replyTarget}). Both are live: a drafter can write into a
   * thread while a person reads it.
   */
  | { readonly kind: "requests" }
  | {
      readonly kind: "thread";
      readonly messageId: string;
      readonly to: string | null;
    }
  /**
   * One request's scope (rondo#233 S3, D-0066 rule 1): the form rondo drafts
   * from the plan and this store's laps, and -- once a press has recorded and
   * approved one -- that approval with the scoped start beside it.
   *
   * **The rounds and the decision are in the address for the same reason the
   * view is** (D-0056 rule 11): the language switch calls {@link viewHref} with
   * the view it is on, so a member kept anywhere else is a switch that silently
   * re-drafts the budgets or loses the approval just recorded.
   */
  | {
      readonly kind: "scope";
      readonly messageId: string;
      /** Review rounds the person asked for, or null for D-0064 rule 3.1.4's default. */
      readonly rounds: number | null;
      /** The approval this screen is showing, or null while there is none. */
      readonly decisionId: string | null;
      /** The held plan the person chose, by digest, or null for the screen's own pick. */
      readonly plan: string | null;
    }
  /**
   * One ended lap's publish (rondo#233 S5, D-0060): the dry-run, and the press
   * that runs it.
   *
   * **It is a view of its own and not a section of `answer`**, because D-0059
   * section 5a's Q1 makes the screen a precondition of the press: `publish` is
   * pressed only from a screen that already shows its dry-run result, and a
   * press whose screen is a fold inside another screen is a press whose
   * precondition nobody can point at. The gate's screen is about answering a
   * gate; this one is about what would leave this machine.
   */
  | { readonly kind: "publish"; readonly iterationId: string }
  /**
   * One running lap's log (rondo#248 item 3): the commands it has run and what
   * they returned, read through the same port the row's *log found* came from.
   * Named by the row and never by a path, so the address carries nothing the
   * server would open.
   */
  | { readonly kind: "log"; readonly iterationId: string };

/**
 * The most review rounds this screen will draft for.
 *
 * Not a policy: a bound, so a typed `?rounds=1000000` cannot ask
 * `computeScopeBudgets` for a lap count and a cost nobody would approve and a
 * screen could not draw. Past it the view falls to the default, which is what
 * every other unreadable query on this page does.
 */
export const MAX_REVIEW_ROUNDS = 20;

/** The round counts the screen offers as links. */
const REVIEW_ROUND_CHOICES: readonly number[] = [0, 1, 2, 3, 4, 5, 6];

/**
 * Whether this view keeps itself current, which is a property of the view and
 * never of the page (D-0054 rule 1).
 *
 * `summary` and `reading` are *what is running* and want to be current, so
 * they carry htmx's poll -- and, with scripting off, the meta refresh inside
 * `<noscript>`. **`answer` updates by nothing at all: no poll, no refresh.** (It
 * does load the key script, which moves focus and follows links and changes
 * nothing on the screen by itself.)
 * It is one row's framing beside its button, read by a person in order to
 * press, and rondo#160's complaint was exactly this screen being re-laid-out
 * under the reader while they read it. It costs no staleness risk, which is why
 * it is deletion rather than machinery: D-0042 re-composes the framing at press
 * time and refuses a press naming a row that is not there, so a page a minute
 * old cannot answer a gate that moved.
 *
 * **`scope` updates by nothing at all either**, for `answer`'s reason and one
 * more. It is a form a person is filling in: with script on a poll would swap
 * `#ledger` out from under half-typed budgets, and with script off the meta
 * refresh would throw the whole draft away every five seconds -- which is the
 * argument the composer views already make for themselves (`onThreads &&
 * forms`). It costs no staleness risk: nothing on it is a live row, and what
 * the press writes is re-tested at press time.
 *
 * **`publish` updates by nothing at all either** (rondo#233 S5), for `answer`'s
 * reason and a stricter one: it *is* the dry-run a person is reading in order
 * to press, so a redraw under them would be the screen quietly becoming about a
 * different act. It costs no staleness risk either, and for the same reason
 * turned into a mechanism: the press carries the digest of what was drawn and
 * the port re-reads the whole dry-run, so a screen that has gone stale publishes
 * nothing and says so.
 *
 * **`log` holds still too** (rondo#248 item 3). It is read to find something
 * in -- the one output a person opened -- and a poll swapping `#ledger` would
 * close every fold they opened and move the list under them. A reload reads it
 * again, and the page's foot already says the view holds still.
 */
function isLive(view: PageView): boolean {
  return (
    view.kind !== "answer" &&
    view.kind !== "scope" &&
    view.kind !== "publish" &&
    view.kind !== "log"
  );
}

/**
 * The address of one view, for the redraw and for the links between them.
 *
 * **Every address this page composes for itself carries the tag** (D-0056 rule
 * 11). The tag is not optional and there is no overload without it: rule 4
 * makes the URL the only home of the language in force, so an address that
 * dropped it is a page that silently re-resolves -- and with scripting on it
 * would *appear* to stick, because the poll asks for the address it was
 * rendered with. A switch the fold drops is D-0055's failure reproduced by the entry
 * that fixed it, so the parameter is required and the compiler is what asserts
 * rule 11 rather than a comment.
 *
 * `lang` is written last on the two views that already carry a query, so the
 * address reads as *the view, in this language* rather than the other way
 * round.
 */
export function viewHref(view: PageView, tag: string): string {
  const lang = `lang=${encodeURIComponent(tag)}`;
  switch (view.kind) {
    case "reading":
      return `/?reading=open&${lang}`;
    case "answer":
      return `/?answer=${encodeURIComponent(view.iterationId)}&${lang}`;
    case "publish":
      return `/?publish=${encodeURIComponent(view.iterationId)}&${lang}`;
    case "log":
      return `/?log=${encodeURIComponent(view.iterationId)}&${lang}`;
    case "requests":
      return `/?requests=open&${lang}`;
    case "thread":
      return `/?thread=${encodeURIComponent(view.messageId)}${
        view.to === null ? "" : `&to=${encodeURIComponent(view.to)}`
      }&${lang}`;
    case "scope":
      return (
        `/?scope=${encodeURIComponent(view.messageId)}` +
        (view.decisionId === null ? "" : `&decision=${encodeURIComponent(view.decisionId)}`) +
        (view.rounds === null ? "" : `&rounds=${String(view.rounds)}`) +
        (view.plan === null ? "" : `&plan=${encodeURIComponent(view.plan)}`) +
        `&${lang}`
      );
    default:
      return `/?${lang}`;
  }
}

/**
 * The name of the one cookie this surface holds (D-0056 rule 5).
 *
 * **One value, and the entry's three clauses about what it is not.** It never
 * reaches the store, the ledger, a record kind, a plan field or a last-look
 * mark; it authorises nothing, because D-0041 rule 3(b)'s per-process token
 * stays in the form and is still the only thing that lets a `POST` write; and
 * it is a seed rather than a second home of the state, because rule 4 means the
 * tag in force is always the URL's.
 */
export const LANG_COOKIE = "lang";

/**
 * How long the memory outlives the tab, in seconds.
 *
 * **Months rather than a session** (D-0056 rule 5): an operator who switched
 * the page once is answering *what language do you read* and not *what language
 * is this tab*, and a memory that died with the browser would ask them again
 * every morning, which is the papercut the entry exists to close.
 */
export const LANG_COOKIE_SECONDS = 180 * 24 * 60 * 60;

/**
 * The remembered tag off a request's `Cookie` header, or null when there is
 * none.
 *
 * **Read raw, and not percent-decoded.** The value rondo writes is a set's own
 * tag -- `en` or `ja`, inside `[a-z]` -- so there is nothing to decode, and
 * `decodeURIComponent` is a function that *throws* on input it does not like
 * (`lang=%` is a `URIError`). This runs on every request to the page, so a
 * throw here would turn a stray cookie into a page that does not render rather
 * than a preference ignored -- and the cookie jar for
 * `localhost` is shared with whatever else on this machine has served a page,
 * so the header is not rondo's to trust the shape of. A value that is not a
 * tag resolves to nothing through {@link setFor}, which is the same answer
 * decoding it would have reached.
 */
function cookieTag(header: string | undefined): string | null {
  if (header === undefined) {
    return null;
  }
  for (const pair of header.split(";")) {
    const at = pair.indexOf("=");
    if (at !== -1 && pair.slice(0, at).trim() === LANG_COOKIE) {
      return pair.slice(at + 1).trim();
    }
  }
  return null;
}

/**
 * The tags one `Accept-Language` header offers, best first.
 *
 * **`q` order, and that is the whole of the reading** (D-0056 rule 6). The
 * header's grammar says it is a list with weights and not a ranking, so the
 * tags are sorted by weight -- absent meaning `1`, ties keeping the order they
 * were written in -- and then tried through lookup one at a time.
 *
 * **A `q` of zero is a refusal and not a low preference**, so those tags are
 * dropped here rather than tried last: `de;q=1, ja;q=0` must not reach the `ja`
 * set on its way past unsupported German. `*` is *no preference* and is
 * skipped. No basic filtering, no alternatives list, no best-fit.
 */
function tagsByWeight(header: string | undefined): readonly string[] {
  // **The list is split by `hono/utils/accept` and weighed here** (D-0059 rule
  // 4). The library's tokenizer handles the grammar -- quoted strings, stray
  // separators, whitespace -- and is what rondo no longer carries. Its *weight*
  // is not used: it reads a `Q=0` as `q=1`, because it looks the parameter up
  // by its lowercase name, which turns a refusal into the strongest preference
  // in the list. So the weight is re-read off the parameters below with the
  // grammar D-0056 rule 6 already tested, and the library's sort is undone by
  // sorting again on that weight.
  const offered: { tag: string; q: number; at: number }[] = [];
  // **`at` is the position the tag was written at, not the library's**: the
  // library has already sorted on its own weight, so `ja;q=0.5, en;Q=0.5`
  // comes back English first, and a tie broken on that order is broken by the
  // misread weight. So each entry is matched back to its first unclaimed
  // occurrence in the header as written.
  const written = (header ?? "").split(",").map((part) => part.split(";")[0]?.trim() ?? "");
  const claimed = new Set<number>();
  for (const { type, params } of parseAccept(header ?? "")) {
    const tag = type.trim();
    const found = written.findIndex((one, index) => one === tag && !claimed.has(index));
    claimed.add(found);
    // Not found only for a spelling the split above cannot see (a comma inside
    // a quoted parameter); such a tag goes after every tag it could place.
    const at = found === -1 ? written.length : found;
    // `*` is the only member of the grammar that is not a tag, and it says
    // nothing rather than something this page could look up.
    if (tag === "" || tag === "*") {
      continue;
    }
    const weight = Object.entries(params)
      // Case-insensitive, because RFC 9110 parameter names are.
      .filter(([name]) => name.trim().toLowerCase() === "q")
      // The fraction's digits are optional because RFC 9110's `qvalue` says so
      // -- `0*3DIGIT` after the point -- so `q=0.` is a spelling of zero and
      // must read as the refusal it is. A pattern demanding a digit there would
      // leave it unparseable, fall back to the default weight of 1, and turn an
      // explicit *do not send me this* into the strongest preference in the
      // list, which is rule 6's q=0 case failing in the one direction that
      // matters.
      .map(([, value]) => /^\s*(\d+(?:\.\d*)?)\s*$/.exec(value)?.[1])
      .find((found) => found !== undefined);
    const q = weight === undefined ? 1 : Number(weight);
    if (!Number.isFinite(q) || q <= 0) {
      continue;
    }
    offered.push({ tag, q, at });
  }
  // `at` is compared explicitly rather than leaning on a stable sort: "stable
  // within a weight" is the entry's wording and is a property of the result
  // rather than of the engine running it.
  return offered
    .sort((left, right) => right.q - left.q || left.at - right.at)
    .map((one) => one.tag);
}

/** Everything rule 2 reads, in one object so the order below is the only order. */
export interface LanguageAsked {
  /** `?lang=` on this request. */
  readonly query: string | null;
  /** The raw `Cookie` header, from which rule 5's one cookie is read. */
  readonly cookie: string | undefined;
  /** `RONDO_OPERATOR_LANGUAGE`, as the host stated it. */
  readonly host: string | null;
  /** The raw `Accept-Language` header. */
  readonly header: string | undefined;
}

/**
 * The wording set one request resolves to: rule 2's five steps, in order, first
 * answer winning.
 *
 * **Five, not four and not a merge.** Each step is one party saying something,
 * ordered by how specifically it was said about *this page and this reader* --
 * the parameter on this request, then the operator's own remembered switch,
 * then the host's statement about its one operator, then the browser's
 * preference for the web at large -- and the last is a floor rather than a
 * party. **A step that names a tag no set resolves to is a step that said
 * nothing**, which is why every step goes through {@link setFor} and not
 * `chromeFor`: English is reached once, at the bottom, and never four times on
 * the way down.
 *
 * **The host's variable sits above the browser's list** (rule 3). A variable is
 * a person stating a fact about this deployment's one operator and is what the
 * terminal reads; a header is a browser-wide preference set for the web at
 * large. So a host that has spoken is not overridden by a browser default, and
 * the browser decides the first visit exactly when the host has said nothing --
 * which is the common case and the one the operator was answering about.
 *
 * One readable function rather than a condition spread over the renderer, so
 * that the order is a thing a reader can check against the entry.
 */
export function resolveLanguage(asked: LanguageAsked): Chrome {
  const named = setFor(asked.query) ?? setFor(cookieTag(asked.cookie)) ?? setFor(asked.host);
  if (named !== null) {
    return named;
  }
  for (const tag of tagsByWeight(asked.header)) {
    const set = setFor(tag);
    if (set !== null) {
      return set;
    }
  }
  return EN;
}

/**
 * Whether this request's URL asked for a language the rest of rule 2 would not
 * have answered -- which is what a switch is, and what the canonicalising
 * redirect of rule 4 is not.
 *
 * **The one condition the memory is written on** (D-0056 rule 5), and it is
 * stated by comparing two resolutions rather than by trying to tell a click
 * from anything else. `?lang=ja` on a host with no memory and no Japanese
 * browser is a switch and is remembered. `?lang=ja` arrived at by a redirect
 * from a `ja` cookie is the answer the other steps already gave, and writes
 * nothing. `?lang=de` over a remembered `ja` resolves to nothing at step 1, so
 * the other steps answer `ja` either way and **the memory is not touched**
 * (rule 9) -- and `?lang=!!` does the same.
 */
export function isSwitch(asked: LanguageAsked, resolved: Chrome): boolean {
  return resolveLanguage({ ...asked, query: null }).lang !== resolved.lang;
}

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
const PILL =
  "inline-flex shrink-0 items-center rounded-full border px-2 py-px font-mono text-xs font-medium leading-4 whitespace-nowrap";

/** One tone per state, which is the whole of what a pill says (section 1, Vercel's row). */
const TONE = {
  wait: "border-wait/40 bg-wait-wash text-wait-ink",
  run: "border-run/35 bg-run-wash text-run-ink",
  ok: "border-border text-ok",
  fail: "border-fail/40 text-fail",
  muted: "border-border text-muted-foreground",
  revise: "border-wait/40 text-wait-ink",
} as const;

type Tone = keyof typeof TONE;

/** The one filled button shape, at two sizes: the way to a press, and the press. */
const PRIMARY =
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
const SECONDARY =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background font-semibold text-foreground shadow-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

/**
 * A row a person can move to with `j`/`k` (D-0059 rule 5): focusable by script
 * and not by Tab, so the tab order is still the links and the one button.
 *
 * **Focus is a tint and a left bar, and never a box** (the third design pass on
 * #220): a ring drawn inside the waiting card's amber rule gave the row two left
 * edges, so the focused row's bar covers the rule instead of sitting beside it.
 */
const ROW =
  "grid grid-cols-[1rem_minmax(0,1fr)] gap-x-3 px-4 py-2.5 outline-none first:rounded-t-lg last:rounded-b-lg focus-visible:bg-accent focus-visible:shadow-[inset_3px_0_0_var(--color-ring)] sm:grid-cols-[1rem_minmax(0,1fr)_auto]";

/** The muted, right-aligned column of identifiers (section 1, GitHub's run list): a locator, so a step below the metadata. */
const META =
  "col-start-2 flex gap-x-2 font-mono text-[11px] leading-6 whitespace-nowrap text-faint tabular-nums max-sm:hidden sm:col-start-auto sm:justify-end";

/**
 * The metadata line under a row's title: its sentences run on one line, parted
 * by a middle dot the stylesheet draws, so the separator is not a character in
 * the document and a reader without CSS still gets the sentences as they were.
 *
 * **Every sentence carries its dot, and the dot that would lead a line is cut
 * off** (the S1 design pass on #220): the line sits a dot's width to the left
 * inside a box that clips ({@link metaLine}), so a sentence that wraps to a new
 * line starts clean instead of with a stray `·`. Direct children must be plain
 * spans: a pill goes inside one.
 */
const META_LINE =
  "-ml-3 flex flex-wrap items-center gap-y-0.5 text-[12.5px] leading-5 text-muted-foreground [&>span]:relative [&>span]:pl-3 [&>span]:before:absolute [&>span]:before:left-[0.3rem] [&>span]:before:text-faint [&>span]:before:content-['·']";

/** {@link META_LINE} inside the box that clips its leading dots. */
function metaLine(children: unknown, extra = "") {
  return (
    <div class="mt-0.5 overflow-hidden">
      <p class={`${META_LINE} ${extra}`}>{children}</p>
    </div>
  );
}

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

/**
 * The tone of an ended lap: a failure is red, a gate sent back is an amber loop,
 * and everything else that finished is quiet -- so the outcome shows without
 * reading the head sentence that says it (the third design pass on #220).
 */
function endedTone(record: IterationRecord): Tone {
  if (record.status === "failed") {
    return "fail";
  }
  if (record.gateOutcome === "revise") {
    return "revise";
  }
  return record.status === "closed" ? "ok" : "muted";
}

/** The tone of any lap by its status: the reading's folds use it for their glyph. */
function statusTone(record: IterationRecord): Tone {
  if (isTerminal(record.status)) {
    return endedTone(record);
  }
  return WAIT_SIDE[record.status as NonTerminalStatus] === "waitingOnYou" ? "wait" : "run";
}

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
 * How many ended laps the lead names before it stops counting back (rondo#145).
 *
 * ponytail: a fixed cap, and it caps the *rendering* rather than the read --
 * `terminalIterations` answers the whole ledger and this page sorts it every
 * five seconds. That is fine while a ledger is a session's worth of rows and is
 * the first thing to change if one is not; the store is where a bounded reader
 * would go, not here. *What just finished* is a question about the last few
 * minutes, and every ended row is still readable with `rondo explain`.
 */
const RECENT_ENDED = 5;

/**
 * The `lang` the plan asked for, on the elements that quote material (D-0053
 * rule 12).
 *
 * **The field's one use at render time, and it is markup rather than a claim.**
 * The request paragraph and the material block carry the tag, which is what a
 * browser uses to pick a font and break a line. That is the legibility
 * complaint rondo#155 opened with, met with an attribute.
 *
 * **Where no ask was made the attribute is `lang=""`** (D-0055 rule 8), which
 * is HTML's own way of saying *the language here is unknown*. It used to be
 * absent, and an absent attribute inherits the document: harmless while the
 * document was always `en` and a guess once the chrome can be the operator's
 * language, because *rondo does not know* would arrive on the screen as *this
 * is Japanese*. The chrome and a row's material may disagree and nothing
 * reconciles them -- each is true about a different thing -- so the one thing
 * this attribute must not do is inherit an answer to a question nobody asked.
 *
 * **Derived from the ask and from nothing else.** rondo never reads material to
 * find out what language it is in (rule 8), so where a worker ignored the ask
 * the attribute is wrong exactly as far as the ask was wrong and no further.
 * Nothing is translated here or anywhere (rule 11): the tag decorates the same
 * bytes the page already quoted.
 *
 * Read off the row's own plan payload rather than through `readRunPlan`,
 * because a page that redraws every five seconds may not refuse a row over a
 * field it is only decorating: absent, null and anything that is not a string
 * all mean *no ask*, which is the same empty attribute. `runPlan` already
 * refused every tag that could reach a written payload, and the JSX renderer
 * escapes the attribute anyway.
 */
function materialLanguage(record: IterationRecord): string {
  const asked = record.plan["material_language"];
  return typeof asked === "string" ? asked : "";
}

/**
 * What the lap spent, or nothing at all when rondo read none of it (`D-0046`).
 *
 * **Absent from the lead is not absent from the page.** All three columns are
 * null until the lap suspends, and a running lap carrying three `undetermined`s
 * is three lines that say nothing -- which is the failure rondo#145 measured.
 * The reading below still prints each of the three under its own pointer, so
 * the distinction between *rondo did not read this* and *this cost nothing*
 * survives where it is checkable. Where any one of them **was** read the line
 * is drawn and the other two say so by name.
 */
function spentLine(wording: Chrome, record: IterationRecord): string | null {
  if (record.lapCostUsd === null && record.lapTurns === null && record.lapDurationMs === null) {
    return null;
  }
  const cost =
    record.lapCostUsd === null
      ? wording.costNotRead
      : wording.costRead(record.lapCostUsd.toFixed(2));
  const turns =
    record.lapTurns === null ? wording.turnsNotRead : wording.turnsRead(record.lapTurns);
  // `ago` over a duration rather than over a clock: the same reading of the
  // same number of milliseconds, which is what keeps `7m` on this page the
  // same `7m` the inbox prints.
  const took =
    record.lapDurationMs === null ? wording.durationNotRead : ago(0, record.lapDurationMs);
  return wording.spent(cost, turns, took);
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

/** The fence column decoded, or `null` where it is not a list (`"null"`, or bytes that will not parse). */
function decodedDenials(refused: string): readonly unknown[] | null {
  try {
    const parsed: unknown = JSON.parse(refused);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
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

/** How an ended lap ended: the status, and the answer or reason beside it. */
function endedHow(wording: Chrome, record: IterationRecord, nowMs: number): string {
  return wording.endedHead(
    record.status,
    wording.age(ago(record.updatedAtMs, nowMs)),
    endedWhy(wording, record),
  );
}

function endedWhy(wording: Chrome, record: IterationRecord): string {
  return record.gateOutcome !== null
    ? wording.gateAnswered(record.gateOutcome)
    : (record.reason ?? wording.noReasonRecorded);
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

/** Which of the three questions a row answers, which is what its weight is decided by. */
type Question = "waiting" | "attention" | "running" | "ended";

/** The lap a request has under it, as the requests list says it (rondo#244). */
interface LapUnderRequest {
  readonly record: IterationRecord;
  readonly question: Question;
}

/**
 * Which of two laps a request is better said by: a live one, else the newest.
 *
 * **Live outranks terminal whatever their ages** (Codex round 2). A request can
 * hold more than one lap -- a retry beside the lap it supersedes -- and going
 * by age alone would let a failure that ended a minute ago speak for a request
 * whose other lap is still at its gate, and bring back *Set the scope* over
 * work that is still running. What the row answers is *what is this request
 * doing*, and an ended lap only answers that when nothing is left.
 */
function saysMore(candidate: LapUnderRequest, held: LapUnderRequest | undefined): boolean {
  if (held === undefined) {
    return true;
  }
  const live = (lap: LapUnderRequest) => lap.question !== "ended";
  return live(candidate) === live(held)
    ? held.record.updatedAtMs < candidate.record.updatedAtMs
    : live(candidate);
}

/**
 * One lap as one row, with the row it rests on cited once beside it (D-0032,
 * rondo#91).
 *
 * **The shape is section 1's bar**: a status glyph in the leading column; the
 * request as the row's title; the state as a pill; the basis and the age in a
 * muted right-aligned column of tabular figures; and every line the lead used
 * to stack -- the head sentence, what releases it, what it spent, what its
 * fence refused, where it runs -- as one muted metadata line under the title.
 * Nothing that was on the page left it: the same strings, in fewer lines.
 *
 * **Waiting reads from across the room and finished recedes** (section 2's
 * shared gap): a waiting row's request is set larger, whole and with its
 * paragraphs (rondo#90), because it is what a person came to answer; a running
 * row's request is one line; an ended one is one line in secondary ink.
 *
 * {@link basisLine} is called rather than the string being spelled here,
 * because a second spelling of a basis is a second thing an operator has to
 * learn to trust. The `iteration` form reads no snapshot, so it is handed none.
 *
 * **The `id` is what keeps a person's place across the in-place refresh**
 * (D-0054 rule 2, D-0059 R2). htmx swaps the ledger and puts focus back on the
 * element whose `id` held it, and `j`/`k` focus is on these rows -- so a row
 * with no id, or one whose id moved to another lap, would drop the reader's
 * place every five seconds. The row id is already unique per document and
 * already the thing every line here is read off.
 */
function lapRow(
  question: Question,
  record: IterationRecord,
  head: unknown,
  lines: readonly unknown[],
  tail: unknown = null,
  below: unknown = null,
) {
  const tone: Tone =
    question === "waiting" ? "wait" : question === "running" ? "run" : endedTone(record);
  return (
    <li id={`lap-${record.id}`} data-row="" tabindex={-1} class={ROW}>
      {glyph(tone)}
      <div class="min-w-0">
        {/*
         * **A running lap says it is running above its request, not under it**
         * (rondo#244). A running row's request is drawn whole with its
         * paragraphs, so *running / 10 min* -- the one fact a person watching
         * a lap came for -- sat last and smallest under a wall of the words
         * they themselves wrote. It is the same head, in the same line; only
         * its place moved, and every other question keeps its own order.
         */}
        {question === "running" ? metaLine(head) : null}
        <p
          class={
            question === "waiting"
              ? "request text-[15px] leading-6 font-semibold wrap-anywhere whitespace-pre-wrap"
              : question === "running"
                ? "request text-sm leading-6 font-medium wrap-anywhere whitespace-pre-wrap"
                : "request truncate text-sm leading-6 font-medium text-muted-foreground"
          }
          // **Only an ended row is cut to one line** (rondo#90): a waiting or
          // running request is shown whole with its paragraphs, and an ended
          // one keeps its whole text in `title` for the pointer that asks.
          {...(question === "ended" ? { title: record.request } : {})}
          lang={materialLanguage(record)}
        >
          {record.request}
        </p>
        {/*
         * **The state is said once, by the head** (the design pass on #220):
         * the head sentence already names the status and the age, and the
         * glyph carries it for the eye, so a pill and an age column repeating
         * both were the same fact three times over.
         */}
        {/*
         * Under `sm` a running or ended row's metadata stops at two lines: a
         * transcript path wrapped to four there, and the whole of it is in the
         * reading. A waiting row's is never cut -- it says what releases it.
         */}
        {metaLine(
          <>
            {question === "running" ? null : head}
            {lines
              .filter((line) => line !== null)
              .map((line) =>
                typeof line === "string" ? (
                  <span class="line min-w-0 wrap-anywhere whitespace-pre-wrap">{line}</span>
                ) : (
                  line
                ),
              )}
          </>,
          question === "waiting" ? "" : "max-sm:max-h-15 max-sm:overflow-hidden",
        )}
        {tail}
      </div>
      {/* The id alone; the basis it abbreviates is the column's `title`. */}
      <div class={META} title={basisLine({ form: "iteration", iterationId: record.id }, {})}>
        <p class="basis">{record.id}</p>
      </div>
      {below === null ? null : <div class="col-span-full">{below}</div>}
    </li>
  );
}

/**
 * One of the three questions: a group label that carries its count, and its
 * rows (section 1, Vercel's hierarchy of group, row and metadata).
 *
 * `data-question` is the whole of what the visual weight rests on, as the
 * section's class was before (rondo#153): *waiting*, *running* and *ended* are
 * the same shape and the same words, and what differs is how much each is
 * allowed to shout. No group is drawn on the strength of it and none is hidden
 * by it, so a browser that loads no CSS still gets every claim in the same
 * order. An empty group is its label alone, which is how *running now (0)* is
 * said once.
 */
function questionGroup(question: Question, heading: string, rows: readonly unknown[]) {
  return (
    <section data-question={question} class="space-y-2">
      {/*
       * One heading style for the three (the design pass on #220): they are
       * the same level, so the rows below and not the heading carry which of
       * them shouts.
       */}
      {/*
       * Above the rows in weight as well as in order (the third design pass):
       * foreground ink, and the first letter raised by the stylesheet so the
       * catalogue's sentence reads as a heading without changing its bytes.
       */}
      <h2 class="text-sm leading-6 font-semibold text-foreground first-letter:uppercase">
        {heading}
      </h2>
      {rows.length === 0 ? null : (
        <ul
          class={
            question === "waiting"
              ? "divide-y divide-wait/20 rounded-lg border border-wait/35 bg-card shadow-[inset_3px_0_0_var(--color-wait)]"
              : question === "attention"
                ? "divide-y divide-fail/20 rounded-lg border border-fail/35 bg-card"
                : question === "running"
                  ? "divide-y divide-border rounded-lg border border-border bg-card"
                  : "divide-y divide-border/70 rounded-lg border border-border/70"
          }
        >
          {rows}
        </ul>
      )}
    </section>
  );
}

/**
 * *What needs me* -- the laps stopped at a question, and the proposals open.
 *
 * First because it is the only part of the page an operator can act on, which
 * is `inbox`'s own argument for the same order. The button and the material it
 * would be pressed over are **here** rather than in the reading below, because
 * D-0042 makes the press this surface's presentation: what a person is shown
 * before they write has to be beside the thing they press.
 *
 * **The row being answered is hoisted to the top of its group** (D-0059 section
 * 2, second round): it opens in place into the framing, the material and the
 * press, so the one thing the view is about is the first thing on it.
 */
function waitingView(
  wording: Chrome,
  waiting: readonly IterationRecord[],
  open: readonly OpenProposal[],
  nowMs: number,
  token: string | null,
  shown: ReadonlyMap<string, Shown>,
  threads: Threads,
  actorId: string | null,
  count: number,
  /** The lap a revise would run as, minted per draw (rondo#233 S4). */
  newIterationId: MintIterationId | null,
) {
  const asks = threads.messages.filter((message) => threads.waiting.has(message.messageId));
  const hoisted = [
    ...waiting.filter((record) => shown.has(record.id)),
    ...waiting.filter((record) => !shown.has(record.id)),
  ];
  return questionGroup("waiting", wording.waitingHeading(count), [
    ...hoisted.map((record) => {
      const framing = shown.get(record.id);
      return lapRow(
        "waiting",
        record,
        stateHead(
          wording,
          record,
          "wait",
          wording.age(ago(record.updatedAtMs, nowMs)),
          `${wording.waitingHead(record.status, wording.age(ago(record.updatedAtMs, nowMs)))}\n${unblockedBy(wording, record)}`,
        ),
        [
          // **"answer gate gate-..." is not drawn where the button says it**
          // (#220 S2): an open gate with an id is released by the answer this
          // row leads to, and the id is the head's `title`. A stalled row, or a
          // gate with no id, keeps the sentence: there it says something else.
          record.status === "awaiting_human" && record.gateId !== null
            ? null
            : unblockedBy(wording, record),
          spentLine(wording, record),
          fenceLine(wording, record),
        ],
        framing === undefined ? answerLink(wording, record, token) : null,
        framing === undefined ? null : approveView(wording, record, token, framing, newIterationId),
      );
    }),
    // **An ask in a request thread waits on the person too** (D-0061 rule 2.7,
    // #220 S1): its words, the request it was asked in, and the way to reply --
    // which lands on the thread with the reply box already pointed at it.
    ...asks.map((ask) => {
      const root = threads.rootOf(ask.messageId);
      const request = root === null ? undefined : threads.byId.get(root);
      return (
        <li id={`ask-${ask.messageId}`} data-row="" tabindex={-1} class={ROW}>
          {glyph("wait")}
          <div class="min-w-0">
            <p
              class="request line-clamp-2 text-[15px] leading-6 font-semibold wrap-anywhere"
              title={ask.body}
              lang=""
            >
              {firstLine(ask.body)}
            </p>
            {metaLine(
              <>
                <span class="head inline-flex items-center gap-2 whitespace-nowrap">
                  <span
                    class={`inline-flex shrink-0 items-center rounded-full border px-2 py-px text-[11.5px] font-medium leading-4 whitespace-nowrap ${TONE.wait}`}
                  >
                    {threads.stopped.has(ask.messageId)
                      ? wording.askStoppedPill
                      : wording.askWaitingPill}
                  </span>
                  <span class="tabular-nums">{wording.age(ago(ask.atMs, nowMs))}</span>
                </span>
                <span>{whoWrote(wording, ask, actorId)}</span>
                {request === undefined ? null : (
                  <span class="line min-w-0 truncate" lang="">
                    {wording.askedIn(firstLine(request.body))}
                  </span>
                )}
              </>,
            )}
            <p class="mt-2">
              <a
                id={`reply-to-${ask.messageId}`}
                href={`${viewHref(
                  { kind: "thread", messageId: root ?? ask.messageId, to: ask.messageId },
                  wording.lang,
                )}#${encodeURIComponent(ask.messageId)}`}
                data-open=""
                class={`${PRIMARY} h-7 px-3 text-[13px]`}
              >
                {wording.openThread}
              </a>
            </p>
          </div>
        </li>
      );
    }),
    ...open.map((proposal) => (
      <li id={`proposal-${proposal.proposalId}`} data-row="" tabindex={-1} class={ROW}>
        {glyph("wait")}
        <div class="min-w-0">
          <p class="head text-[15px] leading-6 font-semibold wrap-anywhere">
            {wording.proposalHead(proposal.kind, wording.age(ago(proposal.createdAtMs, nowMs)))}
          </p>
          {metaLine(
            <>
              <span class="line wrap-anywhere">{wording.aboutIteration(proposal.iterationId)}</span>
              <span class="basis font-mono text-[11.5px] wrap-anywhere text-faint">
                {wording.proposalBasis(proposal.proposalId)}
              </span>
            </>,
          )}
        </div>
        <div class={META}>
          <p>{proposal.proposalId}</p>
        </div>
      </li>
    )),
  ]);
}

/**
 * *What needs attention* -- a live row rondo cannot read (the S1 design pass on
 * #220).
 *
 * **Its own group, with a sentence a person can act on.** Under *running* it was
 * the loudest thing on the page -- a raw decode error in red mono under an id
 * for a title -- and said nothing a reader could do. It still holds a slot, so it
 * is still on the screen: a human title, one line saying what broke and what to
 * do, and the reason itself byte for byte inside a fold (and in the reading's own
 * section for the row).
 */
function attentionView(wording: Chrome, unreadable: readonly LiveRow[]) {
  const rows = unreadable.flatMap((row) => (row.kind === "unreadable" ? [row] : []));
  if (rows.length === 0) {
    return null;
  }
  return questionGroup(
    "attention",
    wording.attentionHeading(rows.length),
    rows.map((row) => (
      <li id={`unreadable-${row.id}`} data-row="" tabindex={-1} class={ROW}>
        {glyph("alert")}
        <div class="min-w-0">
          <p class="head text-sm leading-6 font-semibold">{wording.unreadableTitle}</p>
          <p class="line text-[12.5px] leading-5 text-muted-foreground">
            {wording.unreadableAction(row.id)}
          </p>
          {/*
           * **An action on the page, not a command for a terminal** (#220 S2):
           * the reading already holds this row's section with the reason in
           * it, so the way to it is a link. The target is inside the section's
           * fold, which the browser opens on arrival.
           */}
          <p class="mt-1.5">
            <a
              href={`${viewHref({ kind: "reading" }, wording.lang)}#${encodeURIComponent(`read-${row.id}-reason`)}`}
              data-open=""
              class="text-[13px] font-medium text-link underline-offset-2 hover:underline"
            >
              {wording.unreadableRead}
            </a>
          </p>
          <details id={`unreadable-reason-${row.id}`} class="group mt-1">
            <summary class="cursor-pointer text-[12px] leading-5 text-faint select-none hover:text-foreground">
              {wording.unreadableDetail}
            </summary>
            <p class="basis mt-1 font-mono text-[11px] leading-4 wrap-anywhere text-faint">
              {wording.willNotDecode(row.reason)}
            </p>
          </details>
        </div>
        <div class={META}>
          <p>{row.id}</p>
        </div>
      </li>
    )),
  );
}

/**
 * *What is running* -- every live lap that is not waiting on anybody.
 *
 * The line under each is {@link whereItRuns}: the transcript directory continuo
 * is writing into and the workspace to `ls`. That is what rondo holds about a
 * lap in flight -- it names a place and claims no liveness (D-0048 rule 3) --
 * and it is what an operator asking *is this progressing* can actually open.
 *
 * A live row that will not decode is not here but in {@link attentionView},
 * above: it is on the page rather than missing, and it is the one row nobody can
 * read, so it is not counted among the laps that are running.
 */
function runningView(
  wording: Chrome,
  running: readonly IterationRecord[],
  transcripts: ReadonlyMap<string, TranscriptLocation>,
  nowMs: number,
) {
  return questionGroup("running", wording.runningHeading(running.length), [
    ...running.map((record) =>
      lapRow(
        "running",
        record,
        stateHead(
          wording,
          record,
          "run",
          wording.age(ago(record.updatedAtMs, nowMs)),
          wording.runningHead(record.status, wording.age(ago(record.updatedAtMs, nowMs))),
        ),
        [
          runsWhere(wording, record, transcripts.get(record.id)),
          spentLine(wording, record),
          fenceLine(wording, record),
        ],
        logLink(wording, record, transcripts.get(record.id)),
      ),
    ),
  ]);
}

/**
 * {@link whereItRuns} in plain words (#220 S2), in the four states the
 * console's sentence has, and never merging them: a log found, none yet in a
 * named directory, rondo not able to ask (with continuo's reason, visible --
 * a continuo that will not answer is not a run with nothing to answer about,
 * D-0048 rule 8), and not looked for. The workspace stays visible beside it;
 * the console's whole sentence is the `title`.
 */
function runsWhere(
  wording: Chrome,
  record: IterationRecord,
  located: TranscriptLocation | undefined,
) {
  const said =
    located === undefined
      ? wording.logNotLookedFor
      : located.kind === "unknown"
        ? wording.logUnchecked(located.reason)
        : located.sessions === 0
          ? wording.logNotYet
          : wording.logFound;
  return (
    <span class="line min-w-0 wrap-anywhere" title={whereItRuns(wording, record, located)}>
      {said}
      {record.workspace === null ? null : (
        <span class="font-mono text-faint"> {record.workspace}</span>
      )}
    </span>
  );
}

/**
 * The way into a running row's log (rondo#248 item 3), drawn only where
 * {@link runsWhere} says *log found* -- the one state with something to read.
 * *No log yet*, *could not check* and *not looked for* get no control, so the
 * three stay told apart by their words as they were, and nothing is offered
 * into a screen that would only say there is nothing.
 *
 * **Outlined, and a control rather than a link in the metadata**: the row's
 * filled button is kept for a press, and reading the log is not one, but a way
 * in drawn as faint text is a way in a reader has to hunt for.
 */
function logLink(
  wording: Chrome,
  record: IterationRecord,
  located: TranscriptLocation | undefined,
) {
  if (located?.kind !== "named" || located.sessions === 0) {
    return null;
  }
  return (
    <p class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
      <a
        id={`log-${record.id}`}
        href={viewHref({ kind: "log", iterationId: record.id }, wording.lang)}
        data-open=""
        class={`${SECONDARY} h-7 px-3 text-[13px]`}
        title={wording.logOpenHere}
      >
        {wording.logOpen}
      </a>
    </p>
  );
}

/**
 * How many of a log's commands the screen draws: the newest, newest first.
 *
 * **A running lap is read to learn what it is doing now and whether it is still
 * moving**, and both are answered at the top of the log, not in its first
 * hour. So the screen is the tail, and what is past the bound is not silent:
 * the lead says how many are left out and the file holding all of them is
 * named under the list.
 */
const LOG_COMMANDS = 50;
/** A command past this is cut at its end: its start says what it was. */
const LOG_COMMAND_CHARS = 2_000;
/** An output past this is cut at its start: its end is where it stopped. */
const LOG_OUTPUT_CHARS = 8_000;

/** A block of text, cut to `max` characters at one end, and a line saying so. */
function clipped(text: string, max: number, keep: "start" | "end", said: (n: number) => string) {
  if (text.length <= max) {
    return <pre class={PRE}>{text}</pre>;
  }
  const cut = text.length - max;
  return (
    <>
      {keep === "end" ? <p class="text-[12px] leading-5 text-faint">{said(cut)}</p> : null}
      <pre class={PRE}>{keep === "end" ? text.slice(cut) : text.slice(0, max)}</pre>
      {keep === "start" ? <p class="text-[12px] leading-5 text-faint">{said(cut)}</p> : null}
    </>
  );
}

/**
 * One running lap's log (rondo#248 item 3): the commands it ran and what they
 * returned, read by `readLapLog`'s port at the directory the row's own
 * *log found* came from -- the same `locateTranscript`, asked again here, so
 * the screen and the row cannot disagree about where the log is.
 *
 * **Commands, not the whole transcript**, because that is what the reviewer
 * is handed of the same file and the heading says so: the lap's prose between
 * commands is not drawn and nothing here claims it is.
 */
async function logView(
  ports: WebPorts,
  wording: Chrome,
  view: Extract<PageView, { kind: "log" }>,
): Promise<unknown> {
  const framed = (body: unknown) => (
    <div id="log" class="space-y-4">
      {backHead(wording, wording.logHeading)}
      {body}
    </div>
  );
  const found = await ports.store.read(view.iterationId);
  if (found.kind !== "read") {
    return framed(
      note(found.kind === "absent" ? wording.logGone : wording.willNotDecode(found.reason)),
    );
  }
  const record = found.record;
  const located = await ports.locateTranscript(record);
  const about = (
    <div class="min-w-0 space-y-0.5">
      <p
        class="request truncate text-sm leading-6 font-medium"
        title={record.request}
        lang={materialLanguage(record)}
      >
        {record.request}
      </p>
      <p class="basis font-mono text-[11px] leading-4 wrap-anywhere text-faint">{record.id}</p>
    </div>
  );
  if (located.kind === "unknown") {
    return framed(
      <>
        {about}
        {note(wording.logUnchecked(located.reason))}
      </>,
    );
  }
  if (located.sessions === 0) {
    return framed(
      <>
        {about}
        {note(wording.logNotYet)}
      </>,
    );
  }
  const log = ports.readLog(located.directory);
  if (log.kind === "unread") {
    return framed(
      <>
        {about}
        {note(wording.logUnread(log.reason))}
      </>,
    );
  }
  const newest = log.commands.slice(-LOG_COMMANDS).reverse();
  // The newest output is open: it is the one a person came for. The newest
  // command may have none yet -- it is still running -- so it is the newest
  // that has one.
  const opened = newest.findIndex((command) => command.output !== "");
  return framed(
    <>
      {about}
      {log.finalMessage === null ? null : (
        <section class={CARD}>
          <h3 class={CARD_HEADING}>{wording.logFinal}</h3>
          <p class="mt-1 text-[13px] leading-5 wrap-anywhere whitespace-pre-wrap">
            {log.finalMessage}
          </p>
        </section>
      )}
      {log.unfinished ? note(wording.logUnfinished) : null}
      {newest.length === 0 ? (
        note(wording.logEmpty)
      ) : (
        <>
          <p class="text-[13px] leading-5 text-muted-foreground">
            {wording.logLead(newest.length, log.commands.length)}
          </p>
          <ol class="divide-y divide-border rounded-lg border border-border bg-card">
            {newest.map((command, at) => (
              <li class="min-w-0 space-y-2 px-4 py-3">
                <p class="flex items-center gap-2 font-mono text-[11px] leading-4 text-faint">
                  <span title={log.file}>L{String(command.index)}</span>
                  {command.isError ? pill("fail", wording.logFailed) : null}
                </p>
                {clipped(command.command, LOG_COMMAND_CHARS, "start", wording.logCutAfter)}
                {command.output === "" ? (
                  <p class="text-[12px] leading-5 text-faint">{wording.logNoOutput}</p>
                ) : (
                  <details class="group" {...(at === opened ? { open: true } : {})}>
                    <summary class="flex cursor-pointer list-none items-center gap-x-1.5 text-[12px] leading-5 text-muted-foreground select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
                      {chevron()}
                      {command.isError ? wording.logOutputFailed : wording.logOutput}
                    </summary>
                    <div class="mt-1.5 space-y-1">
                      {clipped(command.output, LOG_OUTPUT_CHARS, "end", wording.logCutBefore)}
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
      <div class="space-y-1">
        <p class="text-[12px] leading-5 text-faint">{wording.logWhole}</p>
        <p class="basis font-mono text-[11px] leading-4 wrap-anywhere text-faint">{log.file}</p>
      </div>
    </>,
  );
}

/** A view's head: the way back to the summary, and what the view is. */
function backHead(wording: Chrome, heading: string) {
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

/** A plain note in the views' muted box. */
function note(line: string) {
  return (
    <p class="note rounded-md border border-border bg-muted/60 px-3 py-2 text-[13px] leading-5">
      {line}
    </p>
  );
}

/**
 * What an ended row says beyond its own record, read per row in
 * {@link operatorPage} because both halves live in other tables.
 */
interface EndedFacts {
  /** The latest verification claim its press carried (D-0045), or null where it carried none. */
  readonly claim: { readonly claim: string; readonly by: string | null } | null;
  /**
   * What the model review had open when the gate was approved (rondo#237), or
   * null where it had nothing that heavy -- and null on every row nobody
   * approved, which is where the question does not arise.
   */
  readonly raised: RaisedCounts | null;
}

/** *What just finished* -- the last few endings, newest first (rondo#145). */
/**
 * **The claim is echoed on the row** (the S2 design pass on #220): an approve
 * press lands on this list, and the row it moved says back what the person
 * said they checked.
 *
 * **And so is what the approval was given over** (rondo#237). A lap approved
 * with a blocker or a major open is finished like any other and its pill says
 * so; which of the two approvals ended it was only findable by opening the lap
 * again. Both facts were already recorded -- the claim, and the reading -- so
 * this is the summary drawing what the store holds, not the store holding more.
 */
function endedView(
  wording: Chrome,
  ended: readonly IterationRecord[],
  nowMs: number,
  facts: ReadonlyMap<string, EndedFacts>,
  /** The way onto the publish screen, drawn only on rows that could publish. */
  publishTo: (record: IterationRecord) => unknown,
  /** Where a publish that happened is read back from ({@link publishedReport}). */
  threads: Threads,
) {
  return questionGroup(
    "ended",
    wording.endedHeading(ended.length),
    ended.map((record) => {
      const said = facts.get(record.id)?.claim ?? null;
      const raised = facts.get(record.id)?.raised ?? null;
      const published = publishedReport(threads, record.id);
      return lapRow(
        "ended",
        record,
        stateHead(
          wording,
          record,
          endedTone(record),
          wording.endedAgo(wording.age(ago(record.updatedAtMs, nowMs))),
          endedHow(wording, record, nowMs),
        ),
        [
          // The pill already says a closed lap's answer; anything else it ended on is a line.
          record.status === "closed" && record.gateOutcome !== null
            ? null
            : endedWhy(wording, record),
          spentLine(wording, record),
          fenceLine(wording, record),
          // In the gate's own ink, on a row whose glyph is otherwise quiet: an
          // override is not the quiet ending the rest of the row reads as.
          raised === null ? null : (
            <span class="line over-raised min-w-0 wrap-anywhere text-fail">
              {wording.approvedOverRaised(raised.blockers, raised.majors)}
            </span>
          ),
          said === null ? null : (
            <span class="line min-w-0 wrap-anywhere whitespace-pre-wrap" lang="">
              {wording.checkedEcho(said.claim, said.by)}
            </span>
          ),
          // **What the publish came to, on the row it was pressed from**
          // (rondo#245). The three legs all succeeded or this report was never
          // written, so the row says so and the way in is gone: unlike *Start
          // the work*, a second press cannot join the first -- `gh` refuses a
          // pull request that already exists -- so re-offering it is not a
          // harmless repetition but a press that fails.
          published === null ? null : publishedLine(wording, record, published),
        ],
        // The one thing left to do to an approved lap, where the lap is
        // (rondo#233 S5): the row's action, in its own place under the
        // metadata rather than inside it (rondo#246).
        published === null ? publishTo(record) : null,
      );
    }),
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
function publishedReport(threads: Threads, iterationId: string): { url: string | null } | null {
  const report = threads.byId.get(`report-published-${iterationId}`);
  if (report === undefined) {
    return null;
  }
  return { url: /https?:\/\/[^\s]+/.exec(report.body)?.[0] ?? null };
}

/** The publish's three legs in the past tense, the pull request as a link. */
function publishedLine(
  wording: Chrome,
  record: IterationRecord,
  published: { readonly url: string | null },
) {
  return (
    <span class="line published min-w-0 wrap-anywhere">
      {wording.published(record.topicBranch, record.runId)}
      {published.url === null ? null : (
        <>
          {" "}
          <a
            id={`published-${record.id}`}
            href={published.url}
            class="font-medium text-link hover:underline"
            title={published.url}
          >
            {wording.publishedPullRequest}
          </a>
        </>
      )}
    </span>
  );
}

/**
 * The one line an idle store gets, in place of nine ways of saying zero
 * (rondo#145).
 *
 * **Its basis is the reading below, and the reading is on this page.** The
 * three questions are answered off two reads -- every live row and every ended
 * row -- and the locators for what those reads found (`snapshot /laps`,
 * `snapshot /refusals`, and the rest) are in the fold, cited there exactly as
 * they were before. So nothing is asserted here without a basis; what changed
 * is that the basis is cited once for the three claims instead of once per
 * phrasing of zero.
 */
function nothingView(wording: Chrome) {
  return (
    <section
      data-question="idle"
      class="flex gap-3 rounded-lg border border-dashed border-border px-5 py-6"
    >
      {glyph("ok")}
      <div class="space-y-1">
        <p class="nothing text-base leading-6 font-medium">{wording.nothingAtAll}</p>
        <p class="basis font-mono text-[11.5px] leading-5 text-faint">{wording.nothingBasis}</p>
      </div>
    </section>
  );
}

/**
 * One section of the reading: a heading, the note that says what reading it
 * does not do, and its body.
 *
 * **One fold per section, one line when shut** (the third design pass on #220):
 * eleven claim tables drawn open made an 11,000-pixel page nobody could scan.
 * The server always renders the fold shut (D-0059 section 5a) and the whole
 * body is still in the document; the key script re-opens what a person opened
 * after each in-place swap, and with script off `page/app.css` draws every fold
 * open, because the `<noscript>` refresh would shut one within five seconds.
 * The `<summary>` is the `j`/`k` stop, and `Enter` on it is the browser's own
 * toggle. `lead` is what the shut line shows beside the heading.
 */
function readingSection(
  heading: string,
  note: string,
  body: unknown,
  id: string,
  lead: unknown = null,
) {
  return (
    <details id={id} class="group rounded-lg border border-border bg-card">
      <summary
        id={`${id}-summary`}
        data-row=""
        class="flex cursor-pointer list-none items-center gap-3 rounded-lg px-4 py-2.5 outline-none select-none hover:bg-accent focus-visible:bg-accent focus-visible:shadow-[inset_3px_0_0_var(--color-ring)] sm:px-5 [&::-webkit-details-marker]:hidden"
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
        <h2 class="shrink-0 text-sm leading-6 font-semibold">{heading}</h2>
        {lead}
      </summary>
      <div class="space-y-3 border-t border-border px-4 py-4 sm:px-5">
        {note === "" ? null : (
          <p class="note text-[13px] leading-5 text-muted-foreground">{note}</p>
        )}
        {body}
      </div>
    </details>
  );
}

/** A block of lines read as columns, which may scroll sideways rather than rewrap. */
const PRE =
  "overflow-x-auto rounded-md border border-border bg-muted/50 p-3 font-mono text-[12px] leading-5 whitespace-pre";

/** The inbox section: the same lines `rondo inbox` prints, and no mark moved. */
function inboxView(ports: WebPorts, wording: Chrome, snapshot: InboxSnapshot | null) {
  if (snapshot === null || ports.actorId === null) {
    return readingSection(wording.inboxHeading, wording.inboxNoApprover, null, "reading-inbox");
  }
  return readingSection(
    wording.inboxHeading,
    wording.inboxNote,
    <pre class={PRE}>{inboxLines(wording, ports.actorId, snapshot).join("\n")}</pre>,
    "reading-inbox",
  );
}

/** The between-laps section: `rondo between`'s composition, unrecorded. */
function betweenView(wording: Chrome, snapshot: HostSnapshot) {
  return readingSection(
    wording.betweenHeading,
    wording.betweenNote,
    claimsView(proposeHost(snapshot).payload.claims, snapshot),
    "reading-between",
  );
}

/** A card on the answer view: one section of what a press is made over. */
const CARD = "min-w-0 rounded-lg border border-border bg-card px-4 py-3";

const CARD_HEADING = "text-[13px] leading-6 font-semibold";

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
function chevron(open = "group-open:rotate-90") {
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
 * rondo's draft of what to change, quoting the model review's findings (D-0065
 * rule 5.3, rondo#233 S4).
 *
 * **Drafted by deterministic code and not by a model.** D-0071's drafter is out
 * of scope here (rondo#233's Q2), so what stands in for the organisation is
 * this: a lead line rondo wrote, and then **the reviewer's findings quoted byte
 * for byte** with their severity and their bases. Nothing here summarises,
 * ranks or drops a finding -- dismissing what a reviewer raised is the one
 * thing D-0065 rule 5.3 forbids -- and the person is free to replace every word
 * of it before pressing, which is the point of putting it in a text box.
 *
 * Empty when there is nothing to quote: a gate with no model findings gets an
 * empty box and its placeholder, rather than a lead line about findings that do
 * not exist.
 */
function reviseDraft(wording: Chrome, reading: LapReading | null): string {
  if (reading === null || reading.verdict === "unavailable" || reading.findings.length === 0) {
    return "";
  }
  const lines = reading.findings.flatMap((text, index) => {
    const graded = reading.graded?.[index];
    // A reading whose severities did not decode still has its findings, and a
    // quote of one is worth more than a severity it cannot name.
    const said =
      graded === undefined ? `- ${text}` : wording.reviseDraftFinding(graded.severity, text);
    const bases = (graded?.bases ?? []).map((basis) => findingBasisText(basis));
    return bases.length === 0 ? [said] : [said, wording.reviseDraftBases(bases.join(", "))];
  });
  return [wording.reviseDraftLead, ...lines].join("\n");
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
  const reload = viewHref({ kind: "answer", iterationId: record.id }, wording.lang);
  return (
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
  if (framing.scopeDecisionId === null) {
    return (
      <p id="revise-none" class="note text-[12.5px] leading-5 text-faint">
        {wording.reviseNoScope}
      </p>
    );
  }
  const model = latestReading(framing.readings, isModelReadingDrafter);
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
              keyed per gate; an edit survives a refusal, and an untouched box
              still carries rondo's draft. The findings inside it are the
              reviewer's own words, so the box states no language. */}
          <textarea
            name="body"
            rows={4}
            lang=""
            data-draft={`revise:${record.id}:${record.gateId ?? ""}`}
            placeholder={wording.revisePlaceholder}
            class="max-h-64 min-h-20 w-full resize-y rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-[12.5px] leading-5 outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-ring"
          >
            {reviseDraft(wording, model)}
          </textarea>
        </label>
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

/**
 * The way to the button, drawn on exactly the rows that would have one.
 *
 * The conditions are {@link approveView}'s, so a link is never offered into a
 * view that would refuse to draw a button. **A short filled call to action with
 * the longer sentence beside it** (section 2's shared gap): the button says what
 * to do and the sentence says what the second address adds, because *answer* on
 * its own would read as though the press were here. `data-open` is what `Enter`
 * follows from a focused row.
 */
function answerLink(wording: Chrome, record: IterationRecord, token: string | null) {
  if (!answerable(record, token)) {
    return null;
  }
  return (
    <p class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
      {/* An `id` because a keyboard reader tabbed here keeps focus across the
          refresh only through one: htmx restores focus by the old element's id. */}
      <a
        id={`answer-${record.id}`}
        href={viewHref({ kind: "answer", iterationId: record.id }, wording.lang)}
        data-open=""
        class={`${PRIMARY} h-7 px-3 text-[13px]`}
        // **One verb per card, no helper prose beside it** (the S1 design
        // pass): every waiting row is title, one meta line, one action, and
        // what the second address adds is the pointer's `title`.
        title={wording.answerHere}
      >
        {wording.answerAction}
      </a>
    </p>
  );
}

/** One iteration, explained the way `rondo explain` explains it. */
function explainView(wording: Chrome, record: IterationRecord, snapshot: AdvisorySnapshot) {
  return readingSection(
    wording.iterationHeading(record.id),
    wording.explainNote,
    claimsView(propose(snapshot).payload.claims, snapshot),
    `read-${record.id}`,
    <>
      {glyph(statusTone(record))}
      <span
        class="min-w-0 truncate text-[13px] leading-6 text-muted-foreground"
        lang={materialLanguage(record)}
      >
        {record.request}
      </span>
    </>,
  );
}

/** What a press on one row would be recorded as having shown, composed for that row. */
interface Shown {
  readonly claims: readonly Claim[];
  readonly snapshot: AdvisorySnapshot;
  readonly material: LapMaterialRead | null;
  /** The row's readings, which the two reading cards are drawn from. */
  readonly readings: readonly LapReading[];
  /**
   * The approval this lap was admitted under, or null when it was admitted
   * under none (rondo#233 S4).
   *
   * **Read here so that the revise form can carry it and nobody types it.** A
   * lap with none gets no revise press: D-0070 counts the second lap against
   * the first's approval, and there is nothing here to count it against.
   */
  readonly scopeDecisionId: string | null;
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
  view: PageView,
): Promise<ReadonlyMap<string, Shown>> {
  const shown = new Map<string, Shown>();
  if (view.kind !== "answer") {
    return shown;
  }
  for (const record of waiting) {
    if (record.id !== view.iterationId || !answerable(record, token)) {
      continue;
    }
    const readings = await ports.store.readingsFor(record.id);
    const snapshot = gather(record, readings);
    // The set this request resolved to and not the host's (D-0056 rule 12):
    // the fence block's standing sentences are inside these lines.
    const material = ports.material === null ? null : await ports.material(wording, record);
    shown.set(record.id, {
      claims: propose(snapshot).payload.claims,
      snapshot,
      material,
      readings,
      scopeDecisionId: await ports.record.scopeDecisionAdmitting(record.id),
    });
  }
  return shown;
}

/**
 * The laps that have ended, newest first and only the last few (rondo#145).
 *
 * **An ended row that will not decode is dropped on the terminal side and
 * nowhere else.** The live side shows one, because it holds a slot and
 * understating what is running misleads the one reader deciding whether to
 * start something else; an ended row holds nothing and asks nothing, and it has
 * no `updated_at_ms` to place in a "just finished" list at all. It stays in the
 * ledger and `rondo explain` still refuses it by name. The decoding is the
 * caller's since rondo#244, because the requests list reads the same rows
 * without this slice.
 */
function endedRecently(records: readonly IterationRecord[]): readonly IterationRecord[] {
  return records
    .toSorted((left, right) => right.updatedAtMs - left.updatedAtMs)
    .slice(0, RECENT_ENDED);
}

/**
 * The request threads as the page reads them (D-0061 rule 2), with the two
 * facts every thread view needs derived once per render: which request a
 * message belongs to, and which asks still wait on the person.
 *
 * **An ask waits while no answer of the person's has carried it on** (D-0072
 * rule 3), which is the reading `openAsksIn` queries -- read here off the same
 * rows rather than asked once per request, because the page draws every thread.
 * An ordinary reply, a drafter's report and an answer that says to stop all
 * leave it waiting, and **the page must agree with the store about this or it
 * has no working answering path**: a question the page thought closed would be
 * drawn with a Reply box, and the reply would be refused by the write port
 * while the line stayed held (#206, Codex).
 */
interface Threads {
  readonly messages: readonly ThreadMessageDraft[];
  readonly byId: ReadonlyMap<string, ThreadMessageDraft>;
  readonly rootOf: (messageId: string) => string | null;
  readonly waiting: ReadonlySet<string>;
  /**
   * Of {@link waiting}, the questions the person answered by stopping the line
   * (D-0072 rule 3): `OpenAsk.answeredStop` read off the same rows.
   *
   * **Both are held, and the difference is the record.** An unanswered question
   * says nobody has been back to it; a stopped one says the person has, and
   * said to stop. Telling someone who wrote "stop this line" that nobody has
   * answered is the thing this set exists to stop the page doing.
   */
  readonly stopped: ReadonlySet<string>;
  /**
   * The laps the reading view draws a section for, so an `iteration` basis is
   * a link only when its anchor exists (#220 S1, Codex): a cited lap older than
   * the reading's window is named and not linked to nowhere.
   */
  readonly inReading: ReadonlySet<string>;
}

function threadsOf(
  messages: readonly ThreadMessageDraft[],
  inReading: ReadonlySet<string>,
): Threads {
  const byId = new Map(messages.map((message) => [message.messageId, message]));
  // Only an operator's `carry_on` closes a question (D-0072 rule 3). The
  // `author_kind` is rule 4.4's "the person's reply" read literally: a drafter
  // message threaded under a stop does not release it.
  const answered = (outcome: AnswerOutcome): ReadonlySet<string> =>
    new Set(
      messages.flatMap((message) =>
        message.authorKind === "operator" &&
        message.answerOutcome === outcome &&
        message.inReplyTo !== null
          ? [message.inReplyTo]
          : [],
      ),
    );
  const carriedOn = answered("carry_on");
  const stoppedBy = answered("stop");
  // ponytail: a walk per message per render, which is O(messages x depth); a
  // thread is a conversation's worth of rows. A `root` column is the upgrade.
  const rootOf = (messageId: string): string | null => {
    let at = byId.get(messageId);
    const seen = new Set<string>();
    while (at !== undefined && at.inReplyTo !== null && !seen.has(at.messageId)) {
      seen.add(at.messageId);
      at = byId.get(at.inReplyTo);
    }
    return at?.inReplyTo === null ? at.messageId : null;
  };
  return {
    messages,
    byId,
    rootOf,
    waiting: new Set(
      messages
        .filter((message) => message.asks && !carriedOn.has(message.messageId))
        .map((message) => message.messageId),
    ),
    stopped: new Set(
      messages
        .filter(
          (message) =>
            message.asks && !carriedOn.has(message.messageId) && stoppedBy.has(message.messageId),
        )
        .map((message) => message.messageId),
    ),
    inReading,
  };
}

/** The first line of a message that says anything, for a chip or a list row. */
function firstLine(body: string): string {
  return body.split("\n").find((line) => line.trim() !== "") ?? body;
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
  return message.authorKind === "drafter" && isModelDrafterName(message.authorId)
    ? "rondo"
    : message.authorId;
}

/** A locator drawn as a chip: quiet, one line, the whole of it in `title`. */
const CHIP =
  "inline-flex max-w-full min-w-0 items-center gap-1 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[11px] leading-4 text-muted-foreground";

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
function basisChip(
  wording: Chrome,
  basis: Readonly<Record<string, unknown>>,
  threads: Threads,
  root: string | null,
  actorId: string | null,
) {
  const form = basis["form"];
  let label: string;
  let href: string | null = null;
  if (form === "message" && typeof basis["messageId"] === "string") {
    const cited = threads.byId.get(basis["messageId"]);
    label =
      cited === undefined
        ? basisLine({ form: "message", messageId: basis["messageId"] }, {})
        : `${whoWrote(wording, cited, actorId)}: ${firstLine(cited.body)}`;
    if (cited !== undefined) {
      href =
        threads.rootOf(cited.messageId) === root
          ? `#${encodeURIComponent(cited.messageId)}`
          : `${viewHref({ kind: "thread", messageId: cited.messageId, to: null }, wording.lang)}#${encodeURIComponent(cited.messageId)}`;
    }
  } else if (form === "iteration" && typeof basis["iterationId"] === "string") {
    label = basisLine({ form: "iteration", iterationId: basis["iterationId"] }, {});
    if (threads.inReading.has(basis["iterationId"])) {
      href = `${viewHref({ kind: "reading" }, wording.lang)}#read-${encodeURIComponent(basis["iterationId"])}`;
    }
  } else if (form === "snapshot") {
    label = `snapshot ${String(basis["pointer"])}`;
  } else if ((BASIS_FORMS as readonly unknown[]).includes(form)) {
    label = basisLine(basis as unknown as Basis, {});
  } else {
    label = JSON.stringify(basis);
  }
  const text = (
    <span class={form === "message" ? "max-w-[26rem] truncate" : "truncate font-mono"}>
      {label}
    </span>
  );
  return href === null ? (
    <span class={`basis ${CHIP}`} title={label}>
      {text}
    </span>
  ) : (
    <a href={href} class={`basis ${CHIP} hover:border-ring/60 hover:text-foreground`} title={label}>
      {text}
    </a>
  );
}

/**
 * One message in a thread (D-0061 rule 2): who wrote it and in which voice, how
 * long ago, the words byte for byte with their paragraphs (rondo#90), what it
 * rests on, and -- where it asks and no answer has carried it on (D-0072 rule
 * 3) -- the one mark that it waits on the person.
 *
 * **The voices are told apart three ways, none of them alone**: an initial in a
 * round mark (blue for the drafter), a badge that names the drafter's voice, and
 * a blue wash on its card. **Every card starts at the same left edge** (the S1
 * design pass on #220): leaning the voices to opposite sides made the column
 * zig-zag by 40px with nothing saying why. The id is never printed: the age is
 * the message's link to itself, and `Reply` is how a person points at it --
 * drawn on hover or focus where a pointer can hover (`page/app.css`), and always
 * with script off or on touch.
 */
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

function messageView(
  wording: Chrome,
  threads: Threads,
  message: ThreadMessageDraft,
  previous: ThreadMessageDraft | undefined,
  root: string,
  nowMs: number,
  actorId: string | null,
  forms: boolean,
) {
  const waiting = threads.waiting.has(message.messageId);
  const parent = message.inReplyTo === null ? undefined : threads.byId.get(message.inReplyTo);
  const drafter = message.authorKind === "drafter";
  // **The way to point the reply box here**, a navigation `GET` that writes
  // nothing, quiet in the header. On an ask still waiting it is labelled as
  // answering, because the box it points then answers on a press.
  const replyLink = (
    <a
      id={`reply-${message.messageId}`}
      href={viewHref({ kind: "thread", messageId: root, to: message.messageId }, wording.lang)}
      data-open=""
      class="reply-link rounded px-1 font-medium text-link hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {waiting ? wording.answerAskAction : wording.replyAction}
    </a>
  );
  return (
    <li
      id={message.messageId}
      data-row=""
      tabindex={-1}
      data-voice={message.authorKind}
      {...(waiting ? { "data-waiting": "" } : {})}
      class="message grid scroll-mt-28 scroll-mb-40 grid-cols-1 gap-x-3 sm:grid-cols-[1.75rem_minmax(0,1fr)] rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
    >
      <span
        aria-hidden="true"
        class={
          drafter
            ? "mt-2 hidden size-7 sm:inline-flex items-center justify-center rounded-full bg-run-wash text-[12px] font-semibold text-run-ink ring-1 ring-run/30"
            : "mt-2 hidden size-7 sm:inline-flex items-center justify-center rounded-full bg-muted text-[12px] font-semibold text-foreground ring-1 ring-border"
        }
      >
        {whoWrote(wording, message, actorId).slice(0, 1).toUpperCase()}
      </span>
      <article
        class={
          waiting
            ? "rounded-lg border border-wait/45 bg-card shadow-[inset_3px_0_0_var(--color-wait)]"
            : drafter
              ? "rounded-lg border border-run/25 bg-run-wash/40"
              : "rounded-lg border border-border bg-card"
        }
      >
        <header class="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 pt-2.5 text-[12.5px] leading-5">
          <span class="author font-semibold text-foreground">
            {whoWrote(wording, message, actorId)}
          </span>
          {drafter ? (
            <span class={`voice ${PILL} font-sans ${TONE.run}`}>{wording.drafterVoice}</span>
          ) : message.authorId === actorId ? null : (
            <span class={`voice ${PILL} font-sans ${TONE.muted}`}>{wording.operatorVoice}</span>
          )}
          {waiting ? (
            // **Which of the two reasons it is still waiting** (D-0072 rule 3):
            // nobody has been back to it, or the person has and said to stop.
            // The hold is the same; saying "waiting on you" for the second would
            // tell a person who wrote "stop this line" that they had not answered.
            <span class={`${PILL} font-sans ${TONE.wait}`}>
              {threads.stopped.has(message.messageId)
                ? wording.askStoppedPill
                : wording.askWaitingPill}
            </span>
          ) : null}
          {
            // **What this message answered, where it was said** (D-0072 rule 1):
            // the words are kept byte for byte either way, so with no mark here
            // two answers that read alike and did opposite things would be one
            // entry in the thread.
            message.answerOutcome === undefined ? null : (
              <span
                class={`${PILL} font-sans ${
                  message.answerOutcome === "stop" ? TONE.wait : TONE.muted
                }`}
              >
                {message.answerOutcome === "stop"
                  ? wording.answerStoppedPill
                  : wording.answerCarriedOnPill}
              </span>
            )
          }
          <a
            href={`#${encodeURIComponent(message.messageId)}`}
            class="text-faint tabular-nums hover:text-foreground"
            title={new Date(message.atMs).toISOString()}
          >
            {wording.age(ago(message.atMs, nowMs))}
          </a>
          <span class="flex-1" />
          {forms ? replyLink : null}
        </header>
        {/*
         * Said only where the reply is to neither the message above it nor the
         * request itself, which is what every reply is read as by default.
         */}
        {parent !== undefined &&
        parent.messageId !== previous?.messageId &&
        parent.messageId !== root ? (
          <a
            href={`#${encodeURIComponent(parent.messageId)}`}
            class="mx-4 mt-1 flex min-w-0 items-center gap-1.5 text-[12px] leading-5 text-muted-foreground hover:text-foreground"
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
              {wording.inReplyTo(whoWrote(wording, parent, actorId), firstLine(parent.body))}
            </span>
          </a>
        ) : null}
        {noDraft(message) ? (
          // **A drafter run that drafted nothing, said as what happened**
          // (rondo#238): the row's words are rondo's own about its tools, so
          // they are kept, folded, and what is shown first is what the person
          // can do -- set the scope themselves, one press away.
          <div class="space-y-2 px-4 pt-1 pb-3">
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
        ) : (
          // The words as written: no trim, no reflow (D-0061 rule 2.2). Their language is unknown (D-0055 rule 8).
          <p
            class="body px-4 pt-1 pb-3 text-[14px] leading-6 wrap-anywhere whitespace-pre-wrap"
            lang=""
          >
            {message.body}
          </p>
        )}
        {message.bases.length === 0 ? null : (
          <div class="bases flex flex-wrap items-center gap-1.5 border-t border-border/60 px-4 py-2">
            <span class="text-[11px] font-medium text-faint">{wording.basesLabel}</span>
            {message.bases.map((basis) => basisChip(wording, basis, threads, root, actorId))}
          </div>
        )}
      </article>
    </li>
  );
}

/** Every message of the thread `messageId` belongs to, oldest first, or a line saying there is none. */
function threadView(
  wording: Chrome,
  threads: Threads,
  view: { readonly messageId: string },
  nowMs: number,
  actorId: string | null,
  forms: boolean,
  /** The way to this request's scope screen, or null where there is none (rondo#233 S3). */
  scopeTo: (messageId: string) => unknown,
) {
  const root = threads.rootOf(view.messageId);
  if (root === null) {
    return (
      <p class="note rounded-lg border border-dashed border-border px-5 py-6 text-[13px]">
        {wording.noSuchThread}
      </p>
    );
  }
  const members = threads.messages.filter((message) => threads.rootOf(message.messageId) === root);
  // **An open ask is pinned above the reports** (rondo#199, pin-only): a stop
  // still waiting on a person is what the thread is for right now, so it
  // comes straight after the request; the sort is stable, so each part keeps
  // the store's order.
  const rank = (message: ThreadMessageDraft): number =>
    message.messageId === root ? 0 : threads.waiting.has(message.messageId) ? 1 : 2;
  const shown = [...members].sort((a, b) => rank(a) - rank(b));
  const request = threads.byId.get(root);
  const waitingHere = members.filter((message) => threads.waiting.has(message.messageId)).length;
  return (
    <div class="space-y-4">
      {/*
       * **The thread names itself** (the S1 design pass on #220): the request's
       * first words as its title, one state line, and a way back drawn at every
       * width -- `Esc` is a key hint, and there is none at a phone's width or
       * with script off. Sticky under the page's bar, so the title stays in
       * view down a long thread. With script off the thread does not reload
       * itself (a draft would be lost), so the header says how to see new
       * messages, where a reader looks for it.
       */}
      <header class="thread-head sticky top-12 z-[4] border-b border-border bg-background/95 py-2.5 backdrop-blur-sm">
        <div class="flex min-w-0 items-center gap-2">
          <a
            href={viewHref({ kind: "requests" }, wording.lang)}
            class="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            title={wording.backToRequests}
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
            <span class="sr-only">{wording.backToRequests}</span>
          </a>
          <h2
            class="request min-w-0 flex-1 truncate text-[15px] leading-6 font-semibold"
            title={request?.body}
            lang=""
          >
            {request === undefined ? null : firstLine(request.body)}
          </h2>
          {scopeTo(root)}
          {forms ? (
            <noscript>
              <a
                href={viewHref({ kind: "thread", messageId: root, to: null }, wording.lang)}
                class="shrink-0 text-[12.5px] font-medium text-link hover:underline"
                title={wording.threadNoReload}
              >
                {wording.reloadThread}
              </a>
            </noscript>
          ) : null}
        </div>
        <div class="ml-9 overflow-hidden">
          <p class={META_LINE}>
            {waitingHere === 0 ? null : (
              <span>
                <span class={`${PILL} font-sans ${TONE.wait}`}>{wording.askWaitingPill}</span>
              </span>
            )}
            <span>
              {wording.threadSize(
                members.length,
                wording.age(ago(Math.max(...members.map((message) => message.atMs)), nowMs)),
              )}
            </span>
            {request === undefined ? null : (
              <span>{wording.threadStarted(wording.age(ago(request.atMs, nowMs)))}</span>
            )}
          </p>
        </div>
      </header>
      <ol data-thread={root} class="space-y-4">
        {shown.map((message, at) =>
          messageView(wording, threads, message, shown[at - 1], root, nowMs, actorId, forms),
        )}
      </ol>
    </div>
  );
}

/**
 * Every request, the ones with an ask waiting first and then by when they last
 * moved (#220 S1). One row each: the request's first words, whose it is, how
 * big and how recent its thread is, and a pill counting what waits on the
 * person. The row's words are the link into the thread, so opening one is a
 * click or `Enter`, never an id.
 */
function requestsView(
  wording: Chrome,
  threads: Threads,
  nowMs: number,
  actorId: string | null,
  scopeTo: (messageId: string) => unknown,
  /** The lap that is under a request, newest first, or null where none is. */
  lapUnder: (messageId: string) => LapUnderRequest | null,
) {
  const rows = threads.messages
    .filter((message) => message.inReplyTo === null)
    .map((root) => {
      const members = threads.messages.filter(
        (message) => threads.rootOf(message.messageId) === root.messageId,
      );
      return {
        root,
        size: members.length,
        lastMs: Math.max(...members.map((message) => message.atMs)),
        waiting: members.filter((message) => threads.waiting.has(message.messageId)).length,
      };
    })
    .sort(
      (left, right) =>
        Number(right.waiting > 0) - Number(left.waiting > 0) || right.lastMs - left.lastMs,
    );
  return (
    <section data-question="requests" class="space-y-2">
      <h2 class="text-sm leading-6 font-semibold text-foreground first-letter:uppercase">
        {wording.requestsHeading(rows.length)}
      </h2>
      {rows.length === 0 ? (
        <p class="note rounded-lg border border-dashed border-border px-5 py-6 text-[13px] text-muted-foreground">
          {wording.noRequests}
        </p>
      ) : (
        <ul class="divide-y divide-border rounded-lg border border-border bg-card">
          {rows.map((row) => {
            const lap = lapUnder(row.root.messageId);
            return (
              <li id={`request-${row.root.messageId}`} data-row="" tabindex={-1} class={ROW}>
                {glyph(row.waiting > 0 ? "wait" : "message")}
                <div class="min-w-0">
                  <a
                    id={`open-${row.root.messageId}`}
                    href={viewHref(
                      { kind: "thread", messageId: row.root.messageId, to: null },
                      wording.lang,
                    )}
                    data-open=""
                    class="request line-clamp-2 text-sm leading-6 font-medium wrap-anywhere hover:underline"
                    title={row.root.body}
                    lang=""
                  >
                    {firstLine(row.root.body)}
                  </a>
                  {metaLine(
                    <>
                      {row.waiting > 0 ? (
                        <span>
                          <span class={`${PILL} font-sans ${TONE.wait}`}>
                            {wording.asksWaiting(row.waiting)}
                          </span>
                        </span>
                      ) : null}
                      <span>{whoWrote(wording, row.root, actorId)}</span>
                      <span>
                        {wording.threadSize(row.size, wording.age(ago(row.lastMs, nowMs)))}
                      </span>
                      {/*
                       * **A request with a lap under it says the lap's state**
                       * (rondo#244). This list went on offering *Set the scope*
                       * through a whole lap, which is the one screen a person
                       * watching a run is most likely to be looking at and the
                       * one place it said nothing.
                       *
                       * **The entrance goes only while the lap is live.** Asking
                       * for more work on a request whose lap has ended is a real
                       * act and keeps its way in; starting a second scope beside
                       * a lap that is still running is the confusion.
                       */}
                      {lap === null ? null : (
                        <span>
                          {pill(
                            lap.question === "waiting"
                              ? "wait"
                              : lap.question === "running"
                                ? "run"
                                : endedTone(lap.record),
                            wording.statePill(lap.record.status, lap.record.gateOutcome),
                          )}
                        </span>
                      )}
                      {lap === null ? null : (
                        <span class="tabular-nums">
                          {wording.age(ago(lap.record.updatedAtMs, nowMs))}
                        </span>
                      )}
                    </>,
                  )}
                  {/* The row's one action, under the metadata and not inside
                      it (rondo#246). It goes while the lap under this request
                      is live, for rondo#244's reason. */}
                  {lap !== null && lap.question !== "ended" ? null : scopeTo(row.root.messageId)}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * The message a reply box answers: the one the person pointed at with `Reply`,
 * else the latest question still waiting in the thread, else the latest
 * message **the other party** wrote, else the thread's latest message.
 * `answers` is whether the target is a waiting question, which the box then
 * answers on a press (`/answer-ask`) rather than a send.
 *
 * **Not the person's own latest by default** (the S1 design pass on #220): a box
 * that read "Replying to you" under a drafter's question pointed a person at
 * their own words. A conversation answers the other side.
 */
function replyTarget(
  threads: Threads,
  view: { readonly messageId: string; readonly to: string | null },
  actorId: string | null,
): {
  readonly root: string;
  readonly target: ThreadMessageDraft;
  readonly answers: boolean;
  readonly asksWaiting: boolean;
} | null {
  const root = threads.rootOf(view.messageId);
  if (root === null) {
    return null;
  }
  const members = threads.messages.filter((message) => threads.rootOf(message.messageId) === root);
  const asks = members.filter((message) => threads.waiting.has(message.messageId));
  const pointed = view.to === null ? undefined : threads.byId.get(view.to);
  const theirs = members.filter(
    (message) => !(message.authorKind === "operator" && message.authorId === actorId),
  );
  const target =
    (pointed !== undefined && members.includes(pointed) ? pointed : undefined) ??
    asks.at(-1) ??
    theirs.at(-1) ??
    members.at(-1);
  return target === undefined
    ? null
    : {
        root,
        target,
        answers: threads.waiting.has(target.messageId),
        asksWaiting: asks.length > 0,
      };
}

/** A scope id minted for one form (`newScopeId` in `src/access/web-app.ts`). */
export type MintScopeId = () => string;

/** A lap id minted for one scoped start (`newIterationId` in `src/access/web-app.ts`). */
export type MintIterationId = () => string;

/** A budget number in a box: whole for a count, two decimals for money. */
const whole = (value: number) => String(Math.trunc(value));
const money = (value: number) => value.toFixed(2);

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
function localTime(atMs: number): string {
  return new Date(atMs).toISOString().slice(0, 16);
}

/**
 * Where one number came from, said in the page's language.
 *
 * The basis is facts (`src/advisory/budget.ts`) and the words are the
 * catalogue's, so a Japanese page says them in Japanese -- which is the whole
 * point of showing the evidence at all (D-0071 rule 4.2) and was not true while
 * `computeScopeBudgets` composed the sentence itself.
 */
function basisSaid(wording: Chrome, basis: BudgetBasis): string {
  switch (basis.kind) {
    case "rows":
      return wording.scopeBasisRows(
        basis.measurement,
        basis.iterationIds.length,
        basis.level === "model_tier" ? basis.modelTier : null,
      );
    case "cold_start":
      return wording.scopeBasisColdStart(basis.measurement);
    case "given":
      return basis.given === "plans"
        ? wording.scopeBasisPlans(basis.value)
        : basis.given === "review_rounds"
          ? wording.scopeBasisRounds(basis.value, basis.byDefault)
          : wording.scopeBasisReplyAllowance;
  }
}

/** How one value follows from its bases, in the page's language. */
function formulaSaid(wording: Chrome, formula: BudgetFormula): string {
  switch (formula.kind) {
    case "review_rounds":
      return wording.scopeFormulaRounds;
    case "laps":
      return wording.scopeFormulaLaps(formula.plans, formula.reviewRounds);
    case "cost_reserve_usd":
      return wording.scopeFormulaReserve;
    case "cost_usd":
      return wording.scopeFormulaCost(
        formula.plans,
        money(formula.reserveUsd),
        formula.laterRounds,
        money(formula.redoUsd),
      );
    case "expires_at_ms":
      return wording.scopeFormulaExpires(formula.laps, Math.round(formula.longestMs / 1000));
  }
}

/**
 * One basis of one budget: the sentence it comes to, and a `rows` basis's laps
 * as links into their answer view.
 *
 * **Never an id to copy** ({@link basisChip}'s rule, D-0071 rule 4.2's *"for a
 * screen to link rather than for anyone to copy"*). A `cold_start` or `given`
 * basis names no row, so it is prose and not a link that led nowhere.
 */
function basisRow(wording: Chrome, basis: BudgetBasis) {
  return (
    <p class="basis flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] leading-5 text-muted-foreground">
      <span>{basisSaid(wording, basis)}</span>
      {basis.kind === "rows"
        ? basis.iterationIds.map((iterationId) => (
            <a
              href={viewHref({ kind: "answer", iterationId }, wording.lang)}
              class="font-mono text-[11.5px] text-link underline-offset-2 hover:underline"
            >
              {wording.scopeBasisLap(iterationId)}
            </a>
          ))
        : null}
    </p>
  );
}

/**
 * One budget: the control in a box, the formula quietly under it, and the bases
 * one press away.
 *
 * **Evidence visible but quiet** (D-0071 rule 4.2): every number on this screen
 * was derived from rows, and the derivation is on the screen rather than in a
 * terminal -- folded, because a person reading five budgets is reading five
 * numbers and not forty citations. The control is passed in rather than built
 * here: four of the five are numbers and the fifth is a date, and a field that
 * branched on its own name would be the same code with a switch in it.
 */
function budgetField(
  wording: Chrome,
  name: string,
  label: string,
  control: unknown,
  value: BudgetValue,
) {
  return (
    <div class="min-w-0 space-y-1">
      <label for={name} class="flex flex-col gap-1">
        <span class="text-[12.5px] leading-5 font-medium text-muted-foreground">{label}</span>
        {control}
      </label>
      <p class="note text-[12px] leading-5 text-faint">
        {wording.scopeFormula(formulaSaid(wording, value.formula))}
      </p>
      {value.bases.length === 0 ? null : (
        <details class="group rounded-md border border-border">
          <summary class="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-1.5 text-[12px] leading-5 text-muted-foreground outline-none select-none hover:bg-accent focus-visible:bg-accent [&::-webkit-details-marker]:hidden">
            {chevron()}
            {wording.scopeBasesFold(value.bases.length)}
          </summary>
          <div class="space-y-1 border-t border-border px-3 py-2">
            {value.bases.map((basis) => basisRow(wording, basis))}
          </div>
        </details>
      )}
    </div>
  );
}

/**
 * What the cost draft assumed, said above the numbers it produced (rondo#247).
 *
 * **Said, not scored.** The draft takes the highest first-lap cost of the laps
 * it measured, and those laps resemble this request only if the work is the
 * same size -- which is what made lap 10 cost $8.46 against laps 6-9's ~$1.
 * The rows record what a lap cost and never how much it did, and the request
 * is one sentence, so no rule here could rank the likeness without inventing a
 * precision nobody measured. The caveat names what the sample shares with this
 * work (the agent type, or only its tier), how far apart it is (lowest to
 * highest), and what it cannot know (size), and says the one thing a person can
 * do about it, because a running lap's budget cannot be raised.
 */
function sampleCaveat(wording: Chrome, bases: readonly BudgetBasis[]) {
  return (
    <section class={`rounded-md border px-3 py-2 ${TONE.wait} space-y-1`}>
      <h3 class="text-[13px] leading-5 font-semibold">{wording.scopeSampleHeading}</h3>
      {bases.map((basis) =>
        basis.kind === "rows" ? (
          <p class="text-[12.5px] leading-5 text-foreground">
            {wording.scopeSampleRows(
              basis.iterationIds.length,
              basis.level === "model_tier" ? basis.modelTier : null,
              money(basis.lowest),
              money(basis.value),
            )}
          </p>
        ) : basis.kind === "cold_start" ? (
          <p class="text-[12.5px] leading-5 text-foreground">
            {wording.scopeSampleColdStart(money(basis.value))}
          </p>
        ) : null,
      )}
    </section>
  );
}

/** The class every budget box carries: one box, one number, no decoration. */
const BOX =
  "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * The scope screen (rondo#233 S3, D-0066 rule 1): the form rondo drafted, or
 * the approval it recorded with the scoped start beside it.
 *
 * **Two states on one address**, and the address is what carries which: the
 * store holds no listing of a request's scopes and no index by request
 * (`AdvisoryRecord`), so the record press's `303` names the decision it wrote
 * and this renderer reads it back. That read is also the check -- a decision
 * that is not approved, or whose scope does not list this request, shows
 * nothing of itself (`scopeNotThisRequest`), because an address is a thing a
 * person can retype.
 *
 * **It writes nothing on a `GET`**, and it keeps itself current by nothing at
 * all ({@link isLive}).
 */
async function scopeView(
  ports: WebPorts,
  wording: Chrome,
  view: Extract<PageView, { kind: "scope" }>,
  threads: Threads,
  token: string | null,
  newScopeId: MintScopeId | null,
  newIterationId: MintIterationId | null,
  nowMs: number,
): Promise<unknown> {
  const request = threads.byId.get(view.messageId);
  if (request === undefined) {
    return (
      <p class="note rounded-lg border border-dashed border-border px-5 py-6 text-[13px]">
        {wording.noSuchThread}
      </p>
    );
  }
  const head = (
    <header class="space-y-2">
      <div class="flex min-w-0 items-center gap-2">
        <a
          href={viewHref({ kind: "thread", messageId: view.messageId, to: null }, wording.lang)}
          data-back=""
          class="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          title={wording.backToThread}
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
          <span class="sr-only">{wording.backToThread}</span>
        </a>
        <h2 class="min-w-0 flex-1 truncate text-[15px] leading-6 font-semibold">
          {wording.scopeHeading}
        </h2>
      </div>
      {/* The words the scope is about, as they were written (D-0061 rule 2.2):
          a person drafting a budget is reading what they asked for. */}
      <p
        class="request ml-9 text-[13.5px] leading-6 wrap-anywhere whitespace-pre-wrap"
        title={request.body}
        lang=""
      >
        {request.body}
      </p>
    </header>
  );
  // **A drafted scope comes first** (rondo#238 C2b): the drafter's, still
  // waiting on the person, or the approval that already decided it. Only a
  // request nothing was drafted for -- or whose draft the person declined --
  // gets the person's own form over a held plan.
  const standing =
    view.decisionId === null
      ? await draftedStanding(ports, view.messageId)
      : ({ kind: "none" } as const);
  const decisionId =
    view.decisionId ?? (standing.kind === "decided" ? standing.scopeDecisionId : null);
  const body =
    decisionId !== null
      ? await scopeApproved(ports, wording, view, decisionId, token, newIterationId, nowMs)
      : standing.kind === "drafted"
        ? await draftedForm(ports, wording, view, standing.drafted, threads, token, newScopeId)
        : await scopeForm(ports, wording, view, token, newScopeId, nowMs);
  return (
    <div id="scope" class="space-y-4">
      {head}
      {body}
    </div>
  );
}

/**
 * The plans rondo holds for this request (rondo#238), or the words for why
 * there are none to offer. The same plans the drafter is handed.
 */
async function plansFor(
  ports: WebPorts,
  wording: Chrome,
  messageId: string,
  nowMs: number,
): Promise<{ readonly plans: readonly HeldPlan[] } | { readonly note: string }> {
  try {
    const plans = await heldPlans(
      { store: ports.store, record: ports.record, now: () => nowMs },
      messageId,
    );
    return plans.length === 0 ? { note: wording.scopeNoPlanHeld } : { plans };
  } catch (error) {
    return {
      note: wording.scopePlansUnread(error instanceof Error ? error.message : String(error)),
    };
  }
}

/** The plan the address names, wherever rondo holds it, or null (none named, or not held). */
async function chosenPlan(
  ports: WebPorts,
  view: Extract<PageView, { kind: "scope" }>,
  nowMs: number,
): Promise<HeldPlan | null> {
  if (view.plan === null) {
    return null;
  }
  try {
    return await heldPlanByDigest(
      { store: ports.store, record: ports.record, now: () => nowMs },
      view.messageId,
      view.plan,
    );
  } catch {
    return null;
  }
}

/** One held plan as a person reads it: where it runs, with which agent type, and where it came from. */
function planLine(wording: Chrome, plan: HeldPlan): string {
  return wording.scopePlanLine(
    wording.scopeWorkspace(plan.repository, plan.workspaceRoot),
    plan.agentTypeDigest.slice("sha256:".length, "sha256:".length + 12),
    wording.scopePlanFrom(plan.from.kind),
  );
}

/**
 * The choice of plan, as links in the rounds' shape and for their reason (no
 * form to fight, and the address holds the state): one line per plan saying
 * where it runs and where it came from, the chosen one marked. Drawn only when
 * there is more than one to choose from.
 */
function planChoice(
  wording: Chrome,
  view: Extract<PageView, { kind: "scope" }>,
  plans: readonly HeldPlan[],
  /** The chosen plan's digest, or null when nothing is chosen: every plan is then a link. */
  chosen: string | null,
) {
  // One plan is no choice -- unless nothing is chosen, when it is the way on.
  if (plans.length < 2 && chosen !== null) {
    return null;
  }
  return (
    <section id="plans" class="space-y-1">
      <p class="text-[13px] leading-6 font-medium">{wording.scopePlanAsk}</p>
      <ul class="space-y-1">
        {plans.map((plan) => {
          const said = planLine(wording, plan);
          return (
            <li class="text-[12.5px] leading-5 wrap-anywhere">
              {plan.planDigest === chosen ? (
                <span aria-current="true" class={`${PILL} font-sans ${TONE.ok}`}>
                  {said}
                </span>
              ) : (
                <a
                  href={viewHref({ ...view, plan: plan.planDigest }, wording.lang)}
                  class="rounded-md px-1.5 text-link underline-offset-2 hover:underline"
                >
                  {said}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** State A: the scope the person writes, and the one press that records it and approves it. */
async function scopeForm(
  ports: WebPorts,
  wording: Chrome,
  view: Extract<PageView, { kind: "scope" }>,
  token: string | null,
  newScopeId: MintScopeId | null,
  nowMs: number,
): Promise<unknown> {
  const lead = <p class="text-[13px] leading-6">{wording.scopeLead}</p>;
  // The plan named in the address, wherever rondo holds it -- resolved first,
  // so one chosen earlier stays usable when the list of recent plans no
  // longer shows it -- else the first offered: pasted into this thread, else
  // the one the latest lap ran on (`heldPlans`' order). One named and no
  // longer held is said, with the list to choose from again, and no form:
  // never a different plan under the same address.
  const named = await chosenPlan(ports, view, nowMs);
  const held = await plansFor(ports, wording, view.messageId, nowMs);
  const offered = "plans" in held ? held.plans : [];
  if (named === null && (view.plan !== null || "note" in held)) {
    return (
      <>
        {lead}
        {view.plan !== null ? note(wording.scopePlanGone) : null}
        {"note" in held ? note(held.note) : planChoice(wording, view, offered, null)}
      </>
    );
  }
  const chosen = named ?? (offered[0] as HeldPlan);
  // **The plan answers for a digest the store does not hold yet**, as it did
  // when the plan was a file (rondo#233 S3): a pasted plan's agent type is
  // recorded by the press, and its own input says what it bounds before then.
  const drafted = {
    agentTypeDigest: chosen.agentTypeDigest,
    planDigest: chosen.planDigest,
    workspaces: [{ repository: chosen.repository, workspace_root: chosen.workspaceRoot }],
    heldLines: await heldAgentTypeLines(
      wording,
      ports.record,
      [chosen.agentTypeDigest],
      new Map([[chosen.agentTypeDigest, chosen.agentTypeInput]]),
    ),
  };
  if (token === null || newScopeId === null) {
    return (
      <>
        {lead}
        {note(wording.scopeNoApprover)}
      </>
    );
  }
  const rounds = view.rounds;
  const budgets = await scopeBudgetsFromStore(
    { store: ports.store, record: ports.record },
    {
      agentTypes: [drafted.agentTypeDigest],
      // One plan: the person picks one, and a scope over several is a drafted
      // split's (D-0071 section 4), which this form is not.
      plans: 1,
      ...(rounds === null ? {} : { reviewRounds: rounds }),
      draftedAtMs: nowMs,
    },
  );
  return (
    <>
      {lead}
      {/* What this screen cannot check, said rather than left to be discovered
          (rondo#233 S3 screen review): there is no listing of a request's
          scopes to look in, so a blank draft is not evidence there is none. */}
      <p class="note rounded-md border border-border bg-muted/60 px-3 py-2 text-[13px] leading-5">
        {wording.scopeMaybeApproved}
      </p>
      {planChoice(wording, view, offered, chosen.planDigest)}
      <section class={`${CARD} space-y-1`}>
        {/* **The card says what it holds**: the plan, where it runs, and what
            its agent type is allowed. Its heading named only the last of those
            until rondo#233 S3's screen review, so the plan rondo would run was
            the one thing the card never said out loud. */}
        <h3 class={CARD_HEADING}>{wording.scopePlanHeading}</h3>
        {drafted.workspaces.map((workspace) => (
          <p class="text-[12.5px] leading-5 text-muted-foreground">
            {wording.scopeWorkspace(workspace.repository, workspace.workspace_root)}
          </p>
        ))}
        <p class="text-[12.5px] leading-5 font-medium text-muted-foreground">
          {wording.scopeAgentTypeBounds}
        </p>
        {drafted.heldLines.map((line) => (
          <p class="text-[12px] leading-5 wrap-anywhere text-muted-foreground">{line}</p>
        ))}
        {/* **Folded, because there is nothing to do with a hash.** Three
            71-character digests as plain text were a third of the first
            screenful at 420px and not one of them was actionable; they are
            still on the screen, because what rondo records is what rondo
            shows. */}
        <details class="group rounded-md border border-border">
          <summary class="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-1.5 text-[12px] leading-5 text-muted-foreground outline-none select-none hover:bg-accent focus-visible:bg-accent [&::-webkit-details-marker]:hidden">
            {chevron()}
            {wording.scopeDigestsFold}
          </summary>
          <div class="space-y-1 border-t border-border px-3 py-2">
            <p class="font-mono text-[11.5px] leading-5 wrap-anywhere text-faint">
              {wording.scopePlanDigest(drafted.planDigest)}
            </p>
            <p class="font-mono text-[11.5px] leading-5 wrap-anywhere text-faint">
              {wording.scopeAgentType(drafted.agentTypeDigest)}
            </p>
          </div>
        </details>
      </section>
      {/*
       * **Explicit links, and not a `method="get"` form** (rondo#233 S3). This
       * view carries no htmx to fight; a `get` form would need every other
       * query as a hidden input to survive a submit, which is a second home for
       * state the address already holds (D-0054); and a link works identically
       * with script off, with no second submit button beside the one that
       * writes. The residual -- choosing a number redraws the boxes from the
       * plan -- is said on the screen rather than discovered.
       */}
      <p id="rounds" class="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px] leading-6">
        <span class="font-medium">{wording.scopeRoundsAsk}</span>
        {REVIEW_ROUND_CHOICES.map((n) =>
          n === (rounds ?? DEFAULT_REVIEW_ROUNDS) ? (
            <span aria-current="page" class={`${PILL} font-sans ${TONE.ok}`}>
              {String(n)}
            </span>
          ) : (
            <a
              href={viewHref({ ...view, rounds: n }, wording.lang)}
              class="rounded-md px-1.5 text-link underline-offset-2 hover:underline"
            >
              {String(n)}
            </a>
          ),
        )}
        <span class="note w-full text-[12px] leading-5 text-faint">
          {wording.scopeRoundsRedraw}
        </span>
      </p>
      <form
        id="scope-form"
        method="post"
        action={`/scope?lang=${encodeURIComponent(wording.lang)}`}
        class="space-y-4"
      >
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="request" value={view.messageId} />
        {/*
         * **Minted when this form is drawn** (D-0061 rule 2.1's reason applied
         * to a scope): one form pressed twice -- a double click, a resend after
         * a slow write -- carries one id, and the store's uniqueness refuses
         * the second rather than recording two scopes the person drafted once.
         */}
        <input type="hidden" name="scope_id" value={newScopeId()} />
        {/*
         * **The two digests this form was drawn from** (rondo#233 S3 press
         * review). The plan is a file, and a file can move between the draw and
         * the press: the write re-reads it, as it must, and would otherwise
         * record a workspace and an agent type nobody saw while satisfying
         * D-0066 rule 2.2's letter. These are not a second authority for what
         * is recorded -- nothing is written from them -- they are what the
         * re-read is compared against, and a difference is a refusal.
         */}
        <input type="hidden" name="plan_digest" value={drafted.planDigest} />
        <input type="hidden" name="agent_type" value={drafted.agentTypeDigest} />
        {sampleCaveat(wording, budgets.cost_reserve_usd.bases)}
        <div class={`${CARD} grid gap-4 sm:grid-cols-2`}>
          {budgetField(
            wording,
            "laps",
            wording.scopeLapsLabel,
            <input
              type="number"
              name="laps"
              id="laps"
              min="0"
              step="1"
              value={whole(budgets.laps.value)}
              class={BOX}
            />,
            budgets.laps,
          )}
          {budgetField(
            wording,
            "review_rounds",
            wording.scopeRoundsLabel,
            // Read-only in the box because the links above are what changes it:
            // two controls over one number would disagree the moment one moved.
            <input
              type="number"
              name="review_rounds"
              id="review_rounds"
              min="0"
              step="1"
              readonly={true}
              value={whole(budgets.review_rounds.value)}
              class={`${BOX} bg-muted/60`}
            />,
            budgets.review_rounds,
          )}
          {budgetField(
            wording,
            "cost_usd",
            wording.scopeCostLabel,
            <input
              type="number"
              name="cost_usd"
              id="cost_usd"
              min="0"
              step="0.01"
              value={money(budgets.cost_usd.value)}
              class={BOX}
            />,
            budgets.cost_usd,
          )}
          {budgetField(
            wording,
            "cost_reserve_usd",
            wording.scopeReserveLabel,
            <input
              type="number"
              name="cost_reserve_usd"
              id="cost_reserve_usd"
              min="0"
              step="0.01"
              value={money(budgets.cost_reserve_usd.value)}
              class={BOX}
            />,
            budgets.cost_reserve_usd,
          )}
          {budgetField(
            wording,
            "expires_at_ms",
            wording.scopeExpiresLabel,
            <input
              type="datetime-local"
              name="expires_at_ms"
              id="expires_at_ms"
              value={localTime(budgets.expires_at_ms.value)}
              class={BOX}
            />,
            budgets.expires_at_ms,
          )}
        </div>
        <section class={`${CARD} space-y-3`}>
          <h3 class={CARD_HEADING}>{wording.scopeDefaultsHeading}</h3>
          <label class="flex flex-col gap-1">
            <span class="text-[12.5px] leading-5 font-medium text-muted-foreground">
              {wording.scopeSeverityLabel}
            </span>
            {/* The word, with the enum value it records beside it: the value is
                what `rondo scope` prints and a scope holds (D-0055 rule 3), and
                `blocker` alone was the whole option in both languages. */}
            <select name="severity_threshold" class={BOX}>
              {FINDING_SEVERITIES.map((severity) => (
                <option value={severity} {...(severity === "major" ? { selected: true } : {})}>
                  {`${wording.severityWord(severity)} (${severity})`}
                </option>
              ))}
            </select>
          </label>
          <fieldset class="space-y-1">
            <legend class="text-[12.5px] leading-5 font-medium text-muted-foreground">
              {wording.scopeOutwardLabel}
            </legend>
            {SCOPE_OUTWARD_ACTS.map((act) => (
              <label class="flex items-center gap-2 text-[13px] leading-6">
                <input type="checkbox" name="outward_acts" value={act} class="size-3.5" />
                <span>{wording.scopeOutwardAct(act)}</span>
                <span class="font-mono text-[12px] text-faint">{act}</span>
              </label>
            ))}
          </fieldset>
          {/*
           * **Not a box** (rondo#233 S3): `irreversible_additions` adds
           * free-text names to a closed list, and a text field that widens what
           * counts as irreversible by typo is exactly what the screen's own
           * axis forbids. Always empty, and said so rather than hidden.
           */}
          <p class="text-[13px] leading-6">{wording.scopeIrreversibleNone}</p>
          <p class="note text-[12px] leading-5 text-faint">{wording.scopeDefaultNote}</p>
        </section>
        {/* D-0066's first gate answer, on the screen and not only in a terminal. */}
        <p class="note text-[12.5px] leading-5 text-muted-foreground">{wording.scopeCostCaveat}</p>
        <div class="sticky bottom-0 z-[1] -mx-4 flex flex-col gap-2 border-t border-border bg-card px-4 py-3 shadow-[0_-4px_10px_-8px_rgb(0_0_0/0.3)]">
          <p class="note text-[12.5px] leading-5 text-muted-foreground">{wording.scopePressNote}</p>
          <button
            type="submit"
            data-row=""
            aria-describedby="scope-plain"
            class={`${PRIMARY} h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto sm:self-end`}
          >
            {wording.scopeAction}
          </button>
          <span id="scope-plain" class="note sr-only">
            {wording.scopePlain}
          </span>
        </div>
      </form>
    </>
  );
}

/** Whether a scope allows a plan: its agent type is listed and its place is one of the scope's. */
function allowedBy(payload: StoredScope["payload"], plan: HeldPlan): boolean {
  return (
    payload.agent_types.includes(plan.agentTypeDigest) &&
    payload.workspaces.some(
      (w) => w.repository === plan.repository && w.workspace_root === plan.workspaceRoot,
    )
  );
}

/**
 * A drafted scope, waiting on the person (rondo#238 C2b, D-0071 rule 5.3): the
 * work rondo proposes, the budgets it computed with where each came from, and
 * one press that approves -- the draft as it stands, or, when a value was
 * changed, the person's version in its place. Which of the two the press is,
 * is decided by the rows (`recordDraftedScopeFromPage`), never by a button.
 */
async function draftedForm(
  ports: WebPorts,
  wording: Chrome,
  view: Extract<PageView, { kind: "scope" }>,
  drafted: DraftedScopeShown,
  threads: Threads,
  token: string | null,
  newScopeId: MintScopeId | null,
): Promise<unknown> {
  const lead = <p class="text-[13px] leading-6">{wording.scopeDraftedLead}</p>;
  const plans = await draftedPlansList(ports, wording, drafted);
  if (token === null || newScopeId === null) {
    return (
      <>
        {lead}
        {plans}
        {note(wording.scopeNoApprover)}
      </>
    );
  }
  const payload = drafted.scope.payload;
  const computed = drafted.computed;
  // **A value below what rule 4.2 computed says so, and on whose words**: the
  // drafter may only narrow (rule 4.1), and a narrowing rests on the person's
  // own message, which is linked rather than paraphrased.
  const narrowed = (
    field: "laps" | "review_rounds" | "cost_usd" | "expires_at_ms",
    shown: string,
  ) =>
    payload.budgets[field] < computed[field].value && drafted.narrowedBy.length > 0 ? (
      <p class="note flex flex-wrap items-center gap-1.5 text-[12px] leading-5 text-muted-foreground">
        <span>{wording.scopeNarrowed(shown)}</span>
        {drafted.narrowedBy.map((messageId) =>
          basisChip(
            wording,
            { form: "message", messageId },
            threads,
            view.messageId,
            ports.actorId,
          ),
        )}
      </p>
    ) : null;
  return (
    <>
      {lead}
      {plans}
      <form
        id="scope-draft-form"
        method="post"
        action={`/scope-draft?lang=${encodeURIComponent(wording.lang)}`}
        class="space-y-4"
      >
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="request" value={view.messageId} />
        {/* The draft by id and by digest: what the press approves is what
            this screen showed, and the store re-reads both (D-0066 rule 2.2). */}
        <input type="hidden" name="draft_scope" value={drafted.scope.scopeId} />
        <input type="hidden" name="draft_digest" value={drafted.scope.scopeDigest} />
        {/* Minted at draw for the person's version, should they change a value. */}
        <input type="hidden" name="scope_id" value={newScopeId()} />
        {sampleCaveat(wording, computed.cost_reserve_usd.bases)}
        <div class={`${CARD} grid gap-4 sm:grid-cols-2`}>
          <div class="min-w-0 space-y-1">
            {budgetField(
              wording,
              "laps",
              wording.scopeLapsLabel,
              <input
                type="number"
                name="laps"
                id="laps"
                min="0"
                step="1"
                value={whole(payload.budgets.laps)}
                class={BOX}
              />,
              computed.laps,
            )}
            {narrowed("laps", whole(computed.laps.value))}
          </div>
          <div class="min-w-0 space-y-1">
            {budgetField(
              wording,
              "review_rounds",
              wording.scopeRoundsLabel,
              <input
                type="number"
                name="review_rounds"
                id="review_rounds"
                min="0"
                step="1"
                value={whole(payload.budgets.review_rounds)}
                class={BOX}
              />,
              computed.review_rounds,
            )}
            {narrowed("review_rounds", whole(computed.review_rounds.value))}
          </div>
          <div class="min-w-0 space-y-1">
            {budgetField(
              wording,
              "cost_usd",
              wording.scopeCostLabel,
              <input
                type="number"
                name="cost_usd"
                id="cost_usd"
                min="0"
                step="0.01"
                value={money(payload.budgets.cost_usd)}
                class={BOX}
              />,
              computed.cost_usd,
            )}
            {narrowed("cost_usd", money(computed.cost_usd.value))}
          </div>
          {budgetField(
            wording,
            "cost_reserve_usd",
            wording.scopeReserveLabel,
            <input
              type="number"
              name="cost_reserve_usd"
              id="cost_reserve_usd"
              min="0"
              step="0.01"
              value={money(payload.budgets.cost_reserve_usd)}
              class={BOX}
            />,
            computed.cost_reserve_usd,
          )}
          <div class="min-w-0 space-y-1">
            {budgetField(
              wording,
              "expires_at_ms",
              wording.scopeExpiresLabel,
              <input
                type="datetime-local"
                name="expires_at_ms"
                id="expires_at_ms"
                value={localTime(payload.budgets.expires_at_ms)}
                class={BOX}
              />,
              computed.expires_at_ms,
            )}
            {narrowed("expires_at_ms", localTime(computed.expires_at_ms.value))}
          </div>
        </div>
        <section class={`${CARD} space-y-3`}>
          <h3 class={CARD_HEADING}>{wording.scopeDefaultsHeading}</h3>
          <label class="flex flex-col gap-1">
            <span class="text-[12.5px] leading-5 font-medium text-muted-foreground">
              {wording.scopeSeverityLabel}
            </span>
            <select name="severity_threshold" class={BOX}>
              {FINDING_SEVERITIES.map((severity) => (
                <option
                  value={severity}
                  {...(severity === payload.severity_threshold ? { selected: true } : {})}
                >
                  {`${wording.severityWord(severity)} (${severity})`}
                </option>
              ))}
            </select>
          </label>
          <fieldset class="space-y-1">
            <legend class="text-[12.5px] leading-5 font-medium text-muted-foreground">
              {wording.scopeOutwardLabel}
            </legend>
            {SCOPE_OUTWARD_ACTS.map((act) => (
              <label class="flex items-center gap-2 text-[13px] leading-6">
                <input
                  type="checkbox"
                  name="outward_acts"
                  value={act}
                  class="size-3.5"
                  {...(payload.outward_acts.includes(act) ? { checked: true } : {})}
                />
                <span>{wording.scopeOutwardAct(act)}</span>
                <span class="font-mono text-[12px] text-faint">{act}</span>
              </label>
            ))}
          </fieldset>
          <p class="text-[13px] leading-6">
            {payload.irreversible_additions.length === 0
              ? wording.scopeIrreversibleNone
              : payload.irreversible_additions.join(", ")}
          </p>
        </section>
        <p class="note text-[12.5px] leading-5 text-muted-foreground">{wording.scopeCostCaveat}</p>
        <div class="sticky bottom-0 z-[1] -mx-4 flex flex-col gap-2 border-t border-border bg-card px-4 py-3 shadow-[0_-4px_10px_-8px_rgb(0_0_0/0.3)]">
          <p class="note text-[12.5px] leading-5 text-muted-foreground">
            {wording.scopeDraftedPressNote}
          </p>
          <button
            type="submit"
            data-row=""
            aria-describedby="scope-draft-plain"
            class={`${PRIMARY} h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto sm:self-end`}
          >
            {wording.scopeDraftedAction}
          </button>
          <span id="scope-draft-plain" class="note sr-only">
            {wording.scopeDraftedPlain}
          </span>
        </div>
      </form>
    </>
  );
}

/** The drafted plans as a person reads them: the words, where each runs, and what it may do. */
async function draftedPlansList(
  ports: WebPorts,
  wording: Chrome,
  drafted: DraftedScopeShown,
  /** The start line under each plan, on an approved scope; absent on the draft. */
  startOf?: (plan: DraftedPlanShown) => Promise<unknown>,
): Promise<unknown> {
  const cards = [];
  for (const plan of drafted.plans) {
    cards.push(
      <li class="space-y-1.5 border-t border-border pt-3 first:border-t-0 first:pt-0">
        <p class="text-[13px] leading-5 font-semibold">
          {wording.scopeDraftedPlan(plan.index + 1)}
        </p>
        <p class="text-[12.5px] leading-5 text-muted-foreground wrap-anywhere">
          {plan.repository === null || plan.workspaceRoot === null
            ? wording.scopeDraftedTemplateGone
            : wording.scopeWorkspace(plan.repository, plan.workspaceRoot)}
        </p>
        {(await heldAgentTypeLines(wording, ports.record, [plan.split.agent_type_digest])).map(
          (line) => (
            <p class="text-[12px] leading-5 wrap-anywhere text-muted-foreground">{line}</p>
          ),
        )}
        {/* The drafter's words for the worker, as it wrote them: their
            language is the template's, not the page's (D-0055 rule 8). */}
        <p
          class="rounded-md border border-border bg-muted/40 px-3 py-2 text-[13px] leading-6 wrap-anywhere whitespace-pre-wrap"
          lang=""
        >
          {plan.split.prompt}
        </p>
        {startOf === undefined ? null : await startOf(plan)}
      </li>,
    );
  }
  return (
    <section id="drafted-plans" class={`${CARD} space-y-3`}>
      <h3 class={CARD_HEADING}>{wording.scopeDraftedPlansHeading}</h3>
      <ul class="space-y-3">{cards}</ul>
    </section>
  );
}

/**
 * Under an approved scope, one drafted plan's way to start, or why it cannot
 * yet (rondo#238 C2b): a button only where C2a's readiness says the start
 * would go through, and the reason everywhere else -- a refused scoped start
 * writes a stop into the thread, so a button that is sure to fail is not drawn.
 */
async function planStart(
  ports: WebPorts,
  wording: Chrome,
  view: Extract<PageView, { kind: "scope" }>,
  decisionId: string,
  proposalId: string,
  plan: DraftedPlanShown,
  token: string | null,
  newIterationId: MintIterationId | null,
  nowMs: number,
): Promise<unknown> {
  const ready = await draftedStartReadiness(
    { store: ports.store, record: ports.record, policy: ports.policy, nowMs },
    view.messageId,
    decisionId,
    proposalId,
    plan.index,
  );
  const line = (text: string) => (
    <p class="note rounded-md border border-border bg-muted/60 px-3 py-2 text-[12.5px] leading-5">
      {text}
    </p>
  );
  switch (ready.kind) {
    case "ready":
      return token === null || newIterationId === null ? null : (
        <form
          method="post"
          action={`/start-plan?lang=${encodeURIComponent(wording.lang)}`}
          class="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-end"
        >
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="request" value={view.messageId} />
          <input type="hidden" name="scope_decision" value={decisionId} />
          <input type="hidden" name="proposal" value={proposalId} />
          <input type="hidden" name="plan_index" value={String(plan.index)} />
          {/* Minted at render, as every start's is: rondo names the lap. */}
          <input type="hidden" name="iteration" value={newIterationId()} />
          <button
            type="submit"
            data-row=""
            title={wording.planStartPlain}
            class={`${PRIMARY} h-9 w-full justify-center px-5 text-sm sm:w-auto`}
          >
            {wording.planStartAction}
          </button>
        </form>
      );
    case "started":
      return (
        <p class="note flex flex-wrap items-center gap-x-2 text-[12.5px] leading-5">
          <span>{wording.planStarted}</span>
          <a
            href={`${viewHref({ kind: "summary" }, wording.lang)}#${encodeURIComponent(`lap-${ready.iterationId}`)}`}
            class="text-link underline-offset-2 hover:underline"
          >
            {wording.planStartedLink}
          </a>
        </p>
      );
    case "busy":
      return line(wording.planBusy(ready.limit));
    case "full":
      return line(wording.planFull(ready.live, ready.limit));
    case "outside":
      return line(wording.planOutside(ready.test));
    case "unrunnable":
      return (
        <div class="space-y-1">
          {line(wording.planUnrunnable)}
          <details class="group">
            <summary class="flex cursor-pointer list-none items-center gap-2 text-[12px] leading-5 text-muted-foreground select-none [&::-webkit-details-marker]:hidden">
              {chevron()}
              {wording.planUnrunnableWhy}
            </summary>
            <p class="mt-1 text-[12px] leading-5 wrap-anywhere text-muted-foreground" lang="en">
              {ready.reason}
            </p>
          </details>
        </div>
      );
  }
}

/** State B: the approval the press recorded, read back, and the start it allows. */
async function scopeApproved(
  ports: WebPorts,
  wording: Chrome,
  view: Extract<PageView, { kind: "scope" }>,
  /** The decision this address named, already known not to be null. */
  decisionId: string,
  token: string | null,
  newIterationId: MintIterationId | null,
  nowMs: number,
): Promise<unknown> {
  const notThis = (
    <p class="note rounded-md border border-border bg-muted/60 px-3 py-2 text-[13px] leading-5">
      {wording.scopeNotThisRequest}
    </p>
  );
  const decided = await ports.record.readScopeDecision(decisionId);
  if (decided.kind !== "read" || decided.decision.outcome !== "approved") {
    return notThis;
  }
  const stored = await ports.record.readScope(decided.decision.scopeId);
  // **The address is a thing a person can retype**, so the request this screen
  // is about has to be one the approved scope actually names (D-0066 rule
  // 1.2.1). Anything else shows nothing of the scope at all.
  //
  // **The digest is checked and not merely printed.** Scope rows are immutable,
  // so today this cannot diverge; the screen prints the row's digest under the
  // word *approved*, and a heading that vouches for a value it never compared
  // is the kind of thing that stays true until the day it does not.
  if (
    stored.kind !== "read" ||
    !stored.scope.payload.requests.includes(view.messageId) ||
    decided.decision.scopeDigest !== stored.scope.scopeDigest
  ) {
    return notThis;
  }
  const scope = stored.scope;
  const payload = scope.payload;
  // Rule 1.4: an approval a successor retired is not one to start under, and
  // `scopeVerdict` refuses that press at the `superseded` test. Drawing the
  // button anyway would be this screen offering a press it knows cannot work.
  const retired = await ports.record.scopeSupersededByApproved(scope.scopeId);
  const held = await heldAgentTypeLines(wording, ports.record, payload.agent_types);
  // **A drafted scope starts its drafted plans** (rondo#238 C2b): each with
  // its own button, or the reason it cannot start yet, and never the person's
  // held-plan start, which runs the request's own words as the prompt.
  const drafted = await draftedPlansUnder(ports, scope);
  const draftedStarts =
    drafted === null
      ? null
      : await draftedPlansList(ports, wording, drafted, async (plan) =>
          retired
            ? null
            : await planStart(
                ports,
                wording,
                view,
                decisionId,
                drafted.proposalId,
                plan,
                token,
                newIterationId,
                nowMs,
              ),
        );
  // **The plan the start runs on** (rondo#238): one rondo holds whose place and
  // agent type this scope allows -- the one the form was drawn over, carried in
  // the address, or the only one there is. A choice where there are several,
  // and a sentence where there are none, rather than a button that would be
  // refused at the scope's own tests.
  const plans = await plansFor(ports, wording, view.messageId, nowMs);
  const allowed = "plans" in plans ? plans.plans.filter((plan) => allowedBy(payload, plan)) : [];
  // The plan the scope was drawn over is looked up among every plan rondo
  // holds, not only the one of each kind the list offers: a newer lap of the
  // same kind since must not swap it for another without a word.
  const drawn = await chosenPlan(ports, view, nowMs);
  // A plan named in the address and no longer one this scope may run on is
  // said, and the choice put again -- never swapped for another plan silently.
  const gone = view.plan !== null && (drawn === null || !allowedBy(payload, drawn));
  const runsOn = gone ? null : (drawn ?? (allowed.length === 1 ? (allowed[0] as HeldPlan) : null));
  return (
    <>
      <section class={`${CARD} space-y-1`}>
        <h3 class={CARD_HEADING}>
          {wording.scopeApproved(wording.age(ago(decided.decision.decidedAtMs, nowMs)))}
        </h3>
        <p class="font-mono text-[11.5px] leading-5 wrap-anywhere text-faint">
          {wording.scopeDigest(scope.scopeDigest)}
        </p>
      </section>
      <section class={`${CARD} space-y-2`}>
        {payload.workspaces.map((workspace) => (
          <p class="text-[12.5px] leading-5 text-muted-foreground">
            {wording.scopeWorkspace(workspace.repository, workspace.workspace_root)}
          </p>
        ))}
        {held.map((line) => (
          <p class="text-[12px] leading-5 wrap-anywhere text-muted-foreground">{line}</p>
        ))}
        <dl class="grid gap-x-4 gap-y-1 text-[13px] leading-6 sm:grid-cols-2">
          {(
            [
              [wording.scopeLapsLabel, whole(payload.budgets.laps)],
              [wording.scopeRoundsLabel, whole(payload.budgets.review_rounds)],
              [wording.scopeCostLabel, money(payload.budgets.cost_usd)],
              [wording.scopeReserveLabel, money(payload.budgets.cost_reserve_usd)],
              [wording.scopeExpiresLabel, localTime(payload.budgets.expires_at_ms)],
              [wording.scopeSeverityLabel, wording.severityWord(payload.severity_threshold)],
              [
                wording.scopeOutwardLabel,
                payload.outward_acts.length === 0
                  ? wording.scopeOutwardNone
                  : payload.outward_acts.map((act) => wording.scopeOutwardAct(act)).join(", "),
              ],
            ] as const
          ).map(([label, value]) => (
            <div class="flex min-w-0 items-baseline justify-between gap-3 border-b border-border/60 py-0.5">
              <dt class="text-[12.5px] text-muted-foreground">{label}</dt>
              <dd class="font-mono text-[12.5px]">{value}</dd>
            </div>
          ))}
        </dl>
        <p class="text-[13px] leading-6">
          {payload.irreversible_additions.length === 0
            ? wording.scopeIrreversibleNone
            : payload.irreversible_additions.join(", ")}
        </p>
      </section>
      {/* Rule 1.4: approving a successor retires the predecessor's approval, so
          what that approval already spent is part of what was decided. */}
      {scope.supersedesScopeId === null ? null : (
        <p class="note text-[12.5px] leading-5 text-muted-foreground">
          {await predecessorLine(ports, wording, scope)}
        </p>
      )}
      <p class="note text-[12.5px] leading-5 text-muted-foreground">{wording.scopeCostCaveat}</p>
      {retired ? (
        <p class="note rounded-md border border-border bg-muted/60 px-3 py-2 text-[13px] leading-5">
          {wording.scopeRetired}
        </p>
      ) : null}
      {draftedStarts !== null ? (
        draftedStarts
      ) : retired || token === null || newIterationId === null ? null : runsOn === null &&
        allowed.length === 0 ? (
        <>
          {gone ? note(wording.scopePlanGone) : null}
          {note("plans" in plans ? wording.scopeNoPlanForScope : plans.note)}
        </>
      ) : runsOn === null ? (
        <>
          {gone ? note(wording.scopePlanGone) : null}
          {planChoice(wording, view, allowed, null)}
        </>
      ) : (
        <form
          id="start-form"
          method="post"
          action={`/start?lang=${encodeURIComponent(wording.lang)}`}
          class="sticky bottom-0 z-[1] -mx-4 flex flex-col gap-2 border-t border-border bg-card px-4 py-3 shadow-[0_-4px_10px_-8px_rgb(0_0_0/0.3)]"
        >
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="request" value={view.messageId} />
          <input type="hidden" name="scope_decision" value={decisionId} />
          <input type="hidden" name="plan" value={runsOn.planDigest} />
          <p class="text-[12.5px] leading-5 wrap-anywhere text-muted-foreground">
            {`${wording.scopePlanAsk}: ${planLine(wording, runsOn)}`}
          </p>
          {/* Minted at render, as the scope id is, and for its reason: rondo
              names the lap (D-0023) and a double press is one lap. */}
          <input type="hidden" name="iteration" value={newIterationId()} />
          <p class="note text-[12.5px] leading-5 text-muted-foreground">{wording.startNote}</p>
          {/* **The one press that spends money, saying what the refusals
              already say** (rondo#244): the join is real, and a guarantee
              nobody is told about is paid for in suspicion. */}
          <p class="note text-[12.5px] leading-5 text-muted-foreground">{wording.startAgainSafe}</p>
          <button
            type="submit"
            data-row=""
            aria-describedby="start-plain"
            class={`${PRIMARY} h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto sm:self-end`}
          >
            {wording.startAction}
          </button>
          <span id="start-plain" class="note sr-only">
            {wording.startPlain}
          </span>
        </form>
      )}
    </>
  );
}

/** What the scope this one replaces has spent, or why that could not be read. */
async function predecessorLine(
  ports: WebPorts,
  wording: Chrome,
  scope: StoredScope,
): Promise<string> {
  const supersedes = scope.supersedesScopeId;
  if (supersedes === null) {
    return wording.scopePredecessorNoApproval;
  }
  const prior = await ports.record.scopeDecisionOf(supersedes);
  if (prior.kind === "unreadable") {
    return wording.scopePredecessorUnreadable(prior.reason);
  }
  if (prior.kind !== "read" || prior.decision.outcome !== "approved") {
    return wording.scopePredecessorNoApproval;
  }
  const spent = await ports.record.scopeSpent(prior.decision.scopeDecisionId);
  return wording.scopePredecessorSpent(
    spent.admissions,
    money(spent.readCostUsd),
    spent.unreadLaps,
  );
}

/**
 * The way to the scope screen, drawn on a request and nowhere else.
 *
 * Drawn wherever there is an approver to approve a scope as. **Not hidden for
 * want of a plan** (rondo#238): the screen itself says how a plan comes to be
 * held, which a link that was never drawn could not.
 *
 * **As plain as the act behind it** (rondo#246), in {@link answerLink}'s shape:
 * the row's one action, under the metadata rather than a faint link inside it.
 * The entrances were the quiet things on this page while the execute buttons on
 * the screens they lead to were large and coloured, which is the wrong way
 * round -- what protects a person from a mis-press is reading what the press
 * will do, and that reading is the screen this leads to.
 */
function scopeLink(wording: Chrome, token: string | null, messageId: string) {
  if (token === null) {
    return null;
  }
  return (
    <p class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
      <a
        id={`scope-${messageId}`}
        href={viewHref(
          { kind: "scope", messageId, rounds: null, decisionId: null, plan: null },
          wording.lang,
        )}
        data-open=""
        class={`${PRIMARY} h-7 px-3 text-[13px]`}
        title={wording.scopeHere}
      >
        {wording.scopeAction}
      </a>
    </p>
  );
}

/**
 * The way onto the publish screen, drawn on exactly the rows that screen would
 * draw a button for ({@link answerLink}'s rule, rondo#233 S5).
 *
 * **As plain as the act behind it** (rondo#246), in {@link answerLink}'s shape:
 * the entrance is the row's one action, and the weight of the press belongs on
 * the screen it opens. That screen's refusal design is untouched -- a reading
 * that does not cover the work still draws no publish button at all, with the
 * override inside a fold, because unread and read-and-nothing-raised must not
 * look alike.
 */
function publishLink(
  wording: Chrome,
  ports: WebPorts,
  token: string | null,
  record: IterationRecord,
) {
  if (ports.publishing === null || token === null || !approvedForPublication(record)) {
    return null;
  }
  return (
    <p class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
      <a
        id={`publish-${record.id}`}
        href={viewHref({ kind: "publish", iterationId: record.id }, wording.lang)}
        data-open=""
        class={`${PRIMARY} h-7 px-3 text-[13px]`}
        title={wording.publishHere}
      >
        {wording.publishAction}
      </a>
    </p>
  );
}

/** A pull request body split around the request fold it carries. */
interface RequestFold {
  readonly before: string;
  readonly summary: string;
  /** The quotation with its fences, as markdown: a code block. */
  readonly fenced: string;
  readonly after: string;
}

/**
 * The request fold `requestBlock` (cli.ts) writes into a pull request body, or
 * null where the body carries none (rondo#248).
 *
 * **The fence is what makes the edge unambiguous.** `requestBlock` sizes it one
 * longer than the longest run of backticks in what it quotes, so no line of the
 * quotation can equal it, and the first line that does is the closing one. The
 * first opening that does not close exactly as `requestBlock` closes one is
 * taken for no fold at all: the body is then drawn without one, its markup
 * escaped as text, rather than as a guess.
 */
function requestFold(body: string): RequestFold | null {
  const lines = body.split("\n");
  const at = lines.indexOf("<details>");
  if (at === -1) {
    return null;
  }
  const summary = /^<summary>(.*)<\/summary>$/.exec(lines[at + 1] ?? "");
  const fence = lines[at + 3] ?? "";
  if (summary === null || lines[at + 2] !== "" || !/^`{3,}$/.test(fence)) {
    return null;
  }
  const close = lines.indexOf(fence, at + 4);
  if (close === -1 || lines[close + 1] !== "" || lines[close + 2] !== "</details>") {
    return null;
  }
  return {
    before: lines.slice(0, at).join("\n"),
    summary: summary[1] ?? "",
    fenced: lines.slice(at + 3, close + 1).join("\n"),
    after: lines.slice(close + 3).join("\n"),
  };
}

/**
 * Markdown drawn as a forge draws it: `markdownHtml` escapes every tag and
 * refuses every link that could run, so what it returns is the page's to show.
 * `page/app.css` styles `.markdown` the way a forge styles a comment.
 */
function markdown(text: string) {
  return text.trim() === "" ? null : (
    <div class="markdown" dangerouslySetInnerHTML={{ __html: markdownHtml(text) }} />
  );
}

/**
 * The pull request body on the publish screen (rondo#248): drawn, and exact.
 *
 * **The bytes are what is sent and the page does not change one of them.**
 * `Preview` draws them as markdown, the way the forge will; the one piece of
 * HTML in them is the request fold rondo writes itself, which `requestFold`
 * finds by its shape and the page draws as its own fold -- no other HTML is
 * passed through (`markdown.ts`). `Raw` shows the body byte for byte, the way
 * a forge offers the source of what it renders. Underlined tabs over a pair of
 * radios and `:has()`, so the choice is plain in both schemes and works with
 * script off.
 */
function publishBody(wording: Chrome, body: string) {
  const fold = requestFold(body);
  const tab =
    "-mb-px cursor-pointer border-b-2 border-transparent px-3 py-2 text-[14px] leading-5 font-medium text-muted-foreground select-none hover:border-border hover:text-foreground has-checked:border-link has-checked:font-semibold has-checked:text-foreground has-focus-visible:rounded-t-md has-focus-visible:ring-2 has-focus-visible:ring-ring";
  return (
    <div class="group/body mt-2 space-y-3">
      <div class="flex flex-wrap items-end gap-x-4 border-b border-border">
        <fieldset class="flex">
          <legend class="sr-only">{wording.publishBodyViewLegend}</legend>
          <label class={tab}>
            <input
              type="radio"
              name="publish-body-view"
              id="publish-body-preview"
              class="sr-only"
              checked
            />
            {wording.publishBodyPreview}
          </label>
          <label class={tab}>
            <input type="radio" name="publish-body-view" id="publish-body-raw" class="sr-only" />
            {wording.publishBodyRaw}
          </label>
        </fieldset>
        <p class="hidden py-2 text-[13px] leading-5 text-muted-foreground group-has-[#publish-body-raw:checked]/body:block">
          {wording.publishBodyRawNote}
        </p>
      </div>
      <div
        id="publish-body-drawn"
        class="rounded-md border border-border px-5 py-4 group-has-[#publish-body-raw:checked]/body:hidden"
        lang=""
      >
        {fold === null ? (
          markdown(body)
        ) : (
          <>
            {markdown(fold.before)}
            <details id="publish-body-request" class="group/request my-4">
              <summary class="flex cursor-pointer list-none items-center gap-2 rounded-md py-1 text-[14px] leading-6 outline-none select-none hover:text-link focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                {chevron("group-open/request:rotate-90")}
                {fold.summary}
              </summary>
              <div class="mt-2">{markdown(fold.fenced)}</div>
            </details>
            {markdown(fold.after)}
          </>
        )}
      </div>
      <pre
        id="publish-body-exact"
        class={`${PRE.replace(/whitespace-pre$/, "whitespace-pre-wrap").replace("text-[12px]", "text-[13px]")} hidden wrap-anywhere group-has-[#publish-body-raw:checked]/body:block`}
        lang=""
      >
        {body}
      </pre>
    </div>
  );
}

/**
 * The publish screen: the dry-run, and the press that runs it (rondo#233 S5,
 * D-0059 section 5a's `publish` row, D-0060).
 *
 * **The screen is the precondition of the press**, which is section 5a's Q1
 * answer: `publish` is pressed only from a screen that already shows its
 * dry-run result. So everything here comes from one read of
 * `publishingForPage`, the press carries that read's digest, and the port
 * re-reads and refuses when the two disagree. A screen that could not be read
 * draws no button rather than a button over a guess.
 *
 * **What the page draws and what the command line prints are the same facts in
 * two languages.** The terminal prints three command lines because a person
 * there can run them; here they are three sentences, because a person here
 * cannot and must not be sent to a terminal to try.
 */
async function publishView(
  ports: WebPorts,
  wording: Chrome,
  view: Extract<PageView, { kind: "publish" }>,
  token: string | null,
  threads: Threads,
): Promise<unknown> {
  const framed = (body: unknown) => (
    <div id="publish" class="space-y-4">
      {backHead(wording, wording.publishHeading)}
      {body}
    </div>
  );
  if (ports.publishing === null) {
    return framed(note(wording.publishNotOffered));
  }
  const found = await ports.store.read(view.iterationId);
  if (found.kind !== "read") {
    return framed(
      note(
        found.kind === "absent" ? wording.publishRefusedGone : wording.willNotDecode(found.reason),
      ),
    );
  }
  const record = found.record;
  // **An address a person can retype is the row's link's second door**
  // (rondo#245). The summary stops drawing the way in once a publish is
  // reported, and the screen it led to says the same thing rather than drawing
  // a dry-run and a button for a press that `gh` would refuse. Ahead of the
  // dry-run, which shells out to git for an answer nobody would act on.
  const published = publishedReport(threads, record.id);
  if (published !== null) {
    return framed(note(wording.published(record.topicBranch, record.runId)));
  }
  const shown = await ports.publishing(record);
  if (shown.kind === "refused") {
    return framed(
      <>
        {/* Not `publishLead`: that sentence ends in the button below it, and
            there is no button here (rondo#233 S5 screen pass). */}
        <p class="text-[13px] leading-6">{wording.publishNotYetLead}</p>
        <section id="publish-not-yet" class={`${CARD} space-y-1`}>
          <h3 class={CARD_HEADING}>{wording.publishNotYetHeading}</h3>
          {publishBlockLines(wording, shown.block).map((line) => (
            <p class="text-[13px] leading-5 wrap-anywhere">{line}</p>
          ))}
        </section>
      </>,
    );
  }
  const review = shown.review;
  return framed(
    <>
      {/* The lead says which screen this is, because the two differ in what a
          person may do here and not only in what they are told. */}
      <p class="text-[13px] leading-6">
        {review === null ? wording.publishLead : wording.publishReviewLead}
      </p>
      <section id="publish-target" class={`${CARD} space-y-1`}>
        <h3 class={CARD_HEADING}>{wording.publishTargetHeading}</h3>
        <p class="text-[13px] leading-5">
          {wording.publishPushes(shown.target.headRef, shown.target.remote)}
        </p>
        <p class="text-[13px] leading-5">
          {wording.publishOpens(shown.target.repo, shown.target.baseBranch)}
        </p>
        <p class="text-[13px] leading-5">{wording.publishCloses(shown.target.runId)}</p>
        {/* Where the push actually goes, quietly, beside the name it goes by:
            the press refuses when this moves, so this is what moved. */}
        {shown.target.pushUrls.map((url) => (
          <p class="text-[12.5px] leading-5 wrap-anywhere text-muted-foreground" lang="">
            {wording.publishPushUrl(url)}
          </p>
        ))}
        <p class="text-[12.5px] leading-5 text-muted-foreground" lang="">
          {wording.publishWorkspace(shown.target.workspace)}
        </p>
      </section>
      {shown.warnings.length === 0 ? null : (
        <section id="publish-noticed" class={`${CARD} space-y-1`}>
          <h3 class={CARD_HEADING}>{wording.publishNoticedHeading}</h3>
          {shown.warnings.map((warning) => (
            <p class="text-[13px] leading-5 wrap-anywhere">{warning}</p>
          ))}
        </section>
      )}
      {/* **The text a reviewer will read, on the screen that publishes it.**
          The title is one line and the body is long, so the body is a fold the
          page always renders shut and `page/app.css` draws open with script
          off -- the same treatment every other long quotation here gets. The
          words are the pull request's own, so the block states no language. */}
      <section id="publish-request" class={`${CARD} space-y-2`}>
        <h3 class={CARD_HEADING}>{wording.publishRequestHeading}</h3>
        <p class="text-[12.5px] leading-5 font-medium text-muted-foreground">
          {wording.publishTitleLabel}
        </p>
        <p id="publish-title" class="text-[13.5px] leading-6 wrap-anywhere" lang="">
          {shown.title}
        </p>
        <details id="publish-body" class="group">
          <summary
            data-row=""
            class="flex cursor-pointer list-none items-center gap-2 rounded-md py-1 text-[12.5px] leading-5 font-medium text-link outline-none select-none hover:underline focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
          >
            {chevron()}
            {wording.publishBodyLabel}
          </summary>
          {publishBody(wording, shown.body)}
        </details>
      </section>
      {shown.modelReading.length === 0 ? null : (
        <section id="publish-model" class={`${CARD} space-y-1`}>
          <h3 class={CARD_HEADING}>{wording.publishModelHeading}</h3>
          <pre
            class={`${PRE.replace(/whitespace-pre$/, "whitespace-pre-wrap")} wrap-anywhere`}
            lang=""
          >
            {shown.modelReading.join("\n")}
          </pre>
          <p class="note text-[12.5px] leading-5 text-muted-foreground">
            {wording.publishModelNote}
          </p>
        </section>
      )}
      {review === null ? null : (
        <section
          id="publish-review"
          class="min-w-0 space-y-1 rounded-lg border border-warn/40 bg-card px-4 py-3"
        >
          <h3 class={CARD_HEADING}>{wording.publishReviewHeading}</h3>
          <p class="text-[13px] leading-5 wrap-anywhere">{reviewBlockLine(wording, review)}</p>
        </section>
      )}
      {/* **No approver, no press, and no sentence here either**: nothing was
          pressed on this screen, so a refusal's wording would be a report of
          something that did not happen. The page already says at the top of
          every view that an unset approver is why there are no buttons
          (D-0020 rule 2, `noApproverNote`). */}
      {token === null
        ? null
        : review === null
          ? publishForm(wording, record, token, shown.shown)
          : despiteForm(wording, record, token, shown.shown)}
      <p class="note text-[12.5px] leading-5 text-muted-foreground">{wording.publishNote}</p>
    </>,
  );
}

/** Why this lap cannot be published, in the page's words and never a flag's. */
function publishBlockLines(wording: Chrome, block: PublishBlock): readonly string[] {
  switch (block.why) {
    case "notClosed":
      return [wording.publishNotClosed(block.status)];
    case "notApproved":
      return [wording.publishNotApproved(block.outcome ?? "")];
    case "noRun":
      return [wording.publishNoRun];
    case "planField":
      return [wording.publishPlanField(block.field)];
    case "target":
      return [wording.publishTargetRefused(block.reason)];
    default:
      return [
        wording.publishUncommitted(block.paths.join(", ")),
        ...(block.elsewhere === null ? [] : [wording.publishUncommittedElsewhere(block.elsewhere)]),
        wording.publishUncommittedRemedies,
      ];
  }
}

/** Why the reading does not cover what would be pushed, in the page's words. */
function reviewBlockLine(wording: Chrome, block: ReviewBlock): string {
  switch (block.why) {
    case "noReading":
      return wording.publishReviewNoReading;
    case "notClear":
      return wording.publishReviewNotClear(
        block.verdict,
        [
          ...block.findings,
          ...(block.unavailableReason === null ? [] : [block.unavailableReason]),
        ].join("; "),
      );
    case "noEvidence":
      return wording.publishReviewNoEvidence;
    case "unreadable":
      return wording.publishReviewUnreadable(block.reason);
    default:
      return wording.publishReviewMoved(block.readTip, block.nowTip);
  }
}

/**
 * The press (D-0059 section 5a's `publish` row): a native form, no script, and
 * three hidden fields none of which a person types.
 *
 * `shown` is the digest of the dry-run above it. It is the whole of what makes
 * this press safe to offer from a page that does not redraw itself: the port
 * re-reads everything and refuses when what it reads is not this.
 */
function publishForm(wording: Chrome, record: IterationRecord, token: string, shown: string) {
  return (
    <form
      id="publish-form"
      method="post"
      action={`/publish?lang=${encodeURIComponent(wording.lang)}`}
      class="flex flex-col gap-2"
    >
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="iteration" value={record.id} />
      <input type="hidden" name="shown" value={shown} />
      <button
        type="submit"
        data-row=""
        aria-describedby="publish-plain"
        class={`${PRIMARY} h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto sm:self-start`}
      >
        {wording.publishAction}
      </button>
      <span id="publish-plain" class="note sr-only">
        {wording.publishPlain}
      </span>
    </form>
  );
}

/**
 * The second press, and the only thing that overrules the reading's refusal
 * (D-0060 rule 5, rondo#233 S5).
 *
 * **Its own press, folded, under the refusal it overrules.** The ordinary
 * publish button is not drawn at all where this one is: a screen offering both
 * would be a screen where the reading's refusal is a choice of button rather
 * than something a person decided to publish past. The fold is in the document
 * either way, and with script off `page/app.css` draws it open.
 */
function despiteForm(wording: Chrome, record: IterationRecord, token: string, shown: string) {
  return (
    <details id="publish-despite" class="group">
      <summary
        data-row=""
        class="flex cursor-pointer list-none items-center gap-2 rounded-md py-1 text-[12.5px] leading-5 font-medium text-link outline-none select-none hover:underline focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
      >
        {chevron()}
        {wording.publishDespiteFold}
      </summary>
      <form
        id="publish-despite-form"
        method="post"
        action={`/publish?lang=${encodeURIComponent(wording.lang)}`}
        class="mt-2 flex flex-col gap-2"
      >
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="iteration" value={record.id} />
        <input type="hidden" name="shown" value={shown} />
        {/* The one field that says which of the two presses this is, and the
            port refuses it when the refusal it names is not there. */}
        <input type="hidden" name="despite_review" value="yes" />
        <p class="note text-[12.5px] leading-5 text-muted-foreground">
          {wording.publishDespiteNote}
        </p>
        <button
          type="submit"
          data-row=""
          aria-describedby="publish-despite-plain"
          class={`${SECONDARY} h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto sm:self-start`}
        >
          {wording.publishDespiteAction}
        </button>
        <span id="publish-despite-plain" class="note sr-only">
          {wording.publishDespitePlain}
        </span>
      </form>
    </details>
  );
}

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
            // **The whole form and not only its fields** (#220 S1, Codex): the
            // thread's default target after a send can be a waiting ask, and
            // answering one is a press with its own `action` and no `hx-post`.
            // Swapping the fields alone left the send's mode on a box aimed at
            // an ask; `page/composer.js` puts back any words typed meanwhile.
            "hx-select-oob": "#composer,#waiting-count",
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
  const onThreads = view.kind === "requests" || view.kind === "thread";
  const host = await gatherHost(ports);
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
  const ended = endedRecently(terminal);
  // **Whose word it is stays with the words** (#220 S2, Codex): a claim another
  // operator recorded, on the page or with `rondo answer --verified`, is theirs
  // and never "you said"; `by` is null only when it is this page's own actor.
  //
  // **And what the approval was given over** (rondo#237), off the same pass:
  // the readings are read only where an approval could have overridden one, so
  // a list of failures and withdrawals costs the redraw nothing.
  const endedFacts = new Map(
    await Promise.all(
      ended.map(async (record) => {
        const [claims, readings] = await Promise.all([
          ports.store.verificationClaimsFor(record.id),
          approvedForPublication(record)
            ? ports.store.readingsFor(record.id)
            : ([] as readonly LapReading[]),
        ]);
        const last = claims.at(-1);
        return [
          record.id,
          {
            claim:
              last === undefined
                ? null
                : { claim: last.claim, by: last.actorId === ports.actorId ? null : last.actorId },
            raised: raisedIn(latestReading(readings, isModelReadingDrafter)),
          },
        ] as const;
      }),
    ),
  );
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
  const threads = threadsOf(
    threadRead.kind === "read" ? threadRead.messages : [],
    new Set([...waiting, ...running, ...ended, ...unreadable].map((row) => row.id)),
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
  // Reused rather than asked again when the inbox already asked: it is a
  // continuo subprocess per running lap, and this page redraws itself.
  const transcripts = inbox?.transcripts ?? (await locateRunning(ports, live));
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
  const shown = await shownBeforePress(ports, wording, waiting, token, view);
  // **Awaited here** and not inside the tree: the scope screen reads the plan
  // and, in its second state, the approval and what a predecessor spent.
  const scoping =
    view.kind === "scope"
      ? await scopeView(ports, wording, view, threads, token, newScopeId, newIterationId, nowMs)
      : null;
  /** The link onto the scope screen, drawn on a request wherever one is listed. */
  const scopeTo = (messageId: string) => scopeLink(wording, token, messageId);
  // **Which request each lap is under** (rondo#244), off the rows already
  // read: a lap names the request it was started from, so the requests list
  // can say what became of one instead of going on offering the entrance.
  // Newest wins, which is the same order every other list here is in.
  const lapsByRequest = new Map<string, LapUnderRequest>();
  for (const [question, group] of [
    ["waiting", waiting],
    ["running", running],
    ["ended", terminal],
  ] as const) {
    for (const record of group) {
      const request = record.requestMessageId;
      if (request !== null && saysMore({ record, question }, lapsByRequest.get(request))) {
        lapsByRequest.set(request, { record, question });
      }
    }
  }
  const lapUnder = (messageId: string) => lapsByRequest.get(messageId) ?? null;
  // **Awaited here** for `scoping`'s reason: the dry-run reads a workspace and
  // the forge's own configuration, and the tree is composed from what it read.
  const publishing =
    view.kind === "publish" ? await publishView(ports, wording, view, token, threads) : null;
  const logging = view.kind === "log" ? await logView(ports, wording, view) : null;
  /** The way onto the publish screen, drawn on an ended lap wherever one is listed. */
  const publishTo = (record: IterationRecord) => publishLink(wording, ports, token, record);

  // ponytail: the thread views still gather the laps above, as the summary
  // does, on every redraw; skip those reads for them if a redraw costs.
  const readingSections =
    view.kind !== "reading"
      ? []
      : [
          inboxView(ports, wording, inbox),
          betweenView(wording, host),
          ...(await Promise.all(
            [...waiting, ...running, ...ended].map(async (record) =>
              explainView(
                wording,
                record,
                gather(record, await ports.store.readingsFor(record.id)),
              ),
            ),
          )),
          ...unreadable.map((row) =>
            row.kind === "unreadable"
              ? readingSection(
                  wording.iterationHeading(row.id),
                  "",
                  <>
                    <p class="text-[13px] leading-5">{wording.unreadableLead}</p>
                    {/*
                     * Wrapped, and no focus ring on arrival (the S2 design pass
                     * on #220): the summary's link lands here, and a clipped
                     * line in a heavy outline read as an error in the page.
                     */}
                    <pre
                      id={`read-${row.id}-reason`}
                      tabindex={-1}
                      class={`${PRE.replace(/whitespace-pre$/, "whitespace-pre-wrap")} wrap-anywhere outline-none`}
                    >
                      {wording.willNotDecode(row.reason)}
                    </pre>
                  </>,
                  `read-${row.id}`,
                  glyph("alert"),
                )
              : null,
          ),
        ];

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
                onThreads && forms ? null : (
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
                // Each view names only the keys that do something on it: the
                // answer view's rows (its claim groups and the press) have no
                // link to open, and the summary has nowhere to go back to.
                <>
                  {kbd("j")}
                  {kbd("k")}
                  <span class="mr-2">{wording.keyMove}</span>
                  {view.kind === "answer" ? null : (
                    <>
                      {kbd("↵")}
                      <span class="mr-2">{wording.keyOpen}</span>
                    </>
                  )}
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
        <main class="mx-auto max-w-5xl space-y-6 px-4 pt-6 pb-12 sm:px-6">
          {
            // **Said on the visible page and not only in the reading.** With no
            // approver there is no write port and so no button anywhere, and a
            // page that explained that only inside the fold would leave an
            // operator looking for a button that is missing for a reason rondo
            // knows and did not say (D-0020 rule 2).
            ports.actorId === null ? (
              <p class="note rounded-md border border-border bg-muted/60 px-3 py-2 text-[13px] leading-5">
                {wording.noApproverNote}
              </p>
            ) : null
          }
          {view.kind === "requests"
            ? composerView(wording, view, threads, token, newId, ports.actorId, nowMs)
            : null}
          {
            // **The ledger is what the refresh swaps**, and only on a live
            // view: htmx `GET`s this view's own address every five seconds and
            // takes `#ledger` out of the document that comes back. There is no
            // fragment endpoint -- the response is the whole page a navigating
            // browser gets (D-0054 rule 2) -- so there is no second rendering
            // of anything to keep true.
            <div
              id="ledger"
              class="space-y-8"
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
              {
                // Inside the swap (#220 S1, Codex): a thread read that fails
                // while the page is open must be said by the redraw that shows
                // the empty list, and must go away with the redraw that recovers.
                threadRead.kind === "unreadable" ? (
                  <p class="note rounded-md border border-fail/40 px-3 py-2 text-[13px] leading-5 text-fail">
                    {wording.threadsUnreadable(threadRead.reason)}
                  </p>
                ) : null
              }
              {view.kind === "requests" ? (
                requestsView(wording, threads, nowMs, ports.actorId, scopeTo, lapUnder)
              ) : view.kind === "thread" ? (
                threadView(wording, threads, view, nowMs, ports.actorId, forms, scopeTo)
              ) : view.kind === "scope" ? (
                scoping
              ) : view.kind === "publish" ? (
                publishing
              ) : view.kind === "log" ? (
                logging
              ) : waiting.length +
                  running.length +
                  ended.length +
                  open.length +
                  unreadable.length +
                  threads.waiting.size ===
                0 ? (
                nothingView(wording)
              ) : (
                <>
                  {waitingView(
                    wording,
                    waiting,
                    open,
                    nowMs,
                    token,
                    shown,
                    threads,
                    ports.actorId,
                    waitingCount,
                    newIterationId,
                  )}
                  {attentionView(wording, unreadable)}
                  {runningView(wording, running, transcripts, nowMs)}
                  {endedView(wording, ended, nowMs, endedFacts, publishTo, threads)}
                </>
              )}
              {onThreads ||
              view.kind === "scope" ||
              view.kind === "publish" ||
              view.kind === "log" ? null : (
                <p id="fold" class="border-t border-border pt-4 text-[13px]">
                  <a
                    id="fold-link"
                    href={viewHref(
                      view.kind === "reading" ? { kind: "summary" } : { kind: "reading" },
                      wording.lang,
                    )}
                    class="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    {...(view.kind === "reading" ? { "data-back": "" } : {})}
                  >
                    {view.kind === "reading" ? wording.hideReading : wording.openReading}
                  </a>
                </p>
              )}
              {
                // **The fold and the reading are inside the swap too**: on
                // `?reading=open` they are drawn from the same ledger, and a
                // reading left outside `#ledger` would stay at first load
                // under a note that says the view redraws.
                readingSections.length === 0 ? null : (
                  <div id="reading" class="space-y-2">
                    {readingSections}
                  </div>
                )
              }
            </div>
          }
          {view.kind === "thread"
            ? composerView(wording, view, threads, token, newId, ports.actorId, nowMs)
            : null}
          {
            // **Each view says which of the two it is**, because "redraws every
            // 5s" on a view that does not would be the page's own copy lying
            // about the one property D-0054 rule 1 spends itself on. Both say
            // the same thing about writing, which is the fact that did not
            // change: a read writes nothing, whoever or whatever issued it.
            // At the foot rather than the head (the design pass on #220): it is
            // the page's account of itself, and what needs the reader leads.
            // **One short line, and the account in its `title`** (the S1 design
            // pass): the sentences are the page's account of itself for the
            // reader who asks, not prose every reader has to read past.
            <p class="note max-w-3xl text-[11.5px] leading-5 text-faint">
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
                  // script off nothing redraws in place, and a thread with a box
                  // does not reload at all, so "live" would be false there.
                  keepsCurrent ? (
                    <span class="js-only">{wording.liveShort(REFRESH_SECONDS)}</span>
                  ) : (
                    wording.stillShort
                  )
                }
              </span>
            </p>
          }
          {onThreads && forms && view.kind === "requests" ? (
            <noscript>
              <p class="note max-w-3xl text-[11.5px] leading-5 text-faint">
                {wording.threadNoReload}
              </p>
            </noscript>
          ) : null}
        </main>
      </body>
    </html>
  );
  return `<!doctype html>\n${await page.toString()}\n`;
}
