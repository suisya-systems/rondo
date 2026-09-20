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
import { type AdvisorySnapshot, type Claim, propose, UNDETERMINED } from "../advisory/proposal.js";
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
import { basisLine, gather } from "./advisory.js";
import type { LapWorkInspection } from "./forge.js";
import { ago, gatherInbox, type LiveRow } from "./inbox.js";
import { type IssueComment, parseForgeRead } from "./issue-read.js";
import { isModelDrafterName } from "./model-draft.js";
import type {
  LapMaterialRead,
  MintIterationId,
  MintMessageId,
  MintScopeId,
  WebPorts,
} from "./page/contract.js";
import { EmptyCentre } from "./page/empty.js";
import { EmptySide, type SideWork } from "./page/empty-side.js";
import { GovernanceLine } from "./page/governance.js";
import { RequestsFace } from "./page/list.js";
import { facesMarkup } from "./page/render.js";
import { Raw } from "./page/shell.js";
import { ThreadFace, type ThreadItem } from "./page/thread.js";
import { ThreadSide } from "./page/thread-side.js";
import {
  basisWord,
  CARD,
  CARD_HEADING,
  chevron,
  DESPITE,
  glyph,
  issueNameLink,
  localTime,
  money,
  note,
  PILL,
  PRIMARY,
  pill,
  publishedReport,
  SECONDARY,
  TONE,
  type Tone,
  whoWrote,
} from "./page/vocabulary.js";
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
import { finishedAt, stepsOf, WEEK_MS, weekFigures } from "./page-logic/week.js";
import { denialLine, LIST_LIMIT } from "./review.js";
import { reviseText } from "./revise-draft.js";
import { approvalTip, budgetRefusal } from "./scope.js";
import { publishView } from "./screens/publish.js";
import { releaseView } from "./screens/release.js";
import { scopeView } from "./screens/scope.js";
import { type Chrome, EN, SHIPPED_SETS } from "./wording.js";

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

/** A row focusable by `j`/`k` that is not a list item: the answer view's claim groups. */
const FOCUS_ROW =
  "outline-none focus-visible:bg-accent focus-visible:shadow-[inset_3px_0_0_var(--color-ring)]";

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

/** The inbox section: the same lines `rondo inbox` prints, and no mark moved. */

/** The between-laps section: `rondo between`'s composition, unrecorded. */

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
    // **A card holding something that was raised is edged in red** (D-0082
    // rule 2's *red means broken*, spent here and nowhere else on the card):
    // *why it stopped*, *what changed*, the checks and this one were four
    // cards of one weight, and the person had to read all four to find which
    // of them was the reason they had been called.
    <section
      id="model-review"
      class={`${CARD} scroll-mt-16 ${raisedIn(reading) === null ? "" : "border-l-2 border-l-fail"}`}
    >
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
 * Every finding either reading left, one line each, in the order a person
 * meets them: the automatic checks first, then the model's.
 *
 * **Why all of them and not only what withheld the plain approve.** Rule 9.4
 * asks for *the finding itself quoted in the box, unfolded*, and 9.3's *while
 * a finding stands* is a rule about which press is drawn, not about which
 * findings a person is answering over. A box that quoted only the blockers and
 * majors would hide a minor finding behind a fold at 1280, where the card it
 * came from is below the thread.
 *
 * A reading that could not be taken carries no findings, so it contributes
 * nothing here rather than needing a case of its own.
 */
function standingFindings(checks: LapReading | null, model: LapReading | null): readonly string[] {
  return [...(checks?.findings ?? []), ...(model?.findings ?? [])];
}

/**
 * **The material for this confirmation** (D-0083 rule 5): why it stopped, what
 * changed, the fence, and the two readings.
 *
 * **It is the right face's, and that is the whole of this function.** These
 * cards were inside the answering box until rondo#350; rule 5 puts them on the
 * right, and while they were in the centre the box under them was pushed off
 * the bottom of the screen at the reference resolution. Nothing about how a
 * card is drawn changed with the move -- they are the same four views,
 * composed in a different place.
 *
 * **What a press needs did not come with them** (`D-0082` rule 7): the findings
 * are quoted in the box as well ({@link standingFindings}), because this face
 * drops below the thread at 1280 and a press must not be answered over
 * something that did.
 */
function materialView(
  wording: Chrome,
  record: IterationRecord,
  /**
   * What `rondo answer` read of the lap, or null -- which is both *no material
   * port* and *nothing is being asked*: the material is read where the press
   * is (`page/contract.ts`), so with no question standing the face carries the
   * readings alone, which is rule 5's *what is known so far*.
   */
  material: LapMaterialRead | null,
  readings: readonly LapReading[],
) {
  const model = latestReading(readings, isModelReadingDrafter);
  const modelDue = modelPendingOnPage(readings, model);
  const checks = reviewedReading(readings);
  const work = material?.work ?? null;
  const workGone = work !== null && work.kind !== "read";
  // The thread the material is in, which is what a reload of this screen is
  // now (D-0083 rule 3).
  const reload = viewHref(
    { kind: "thread", messageId: record.requestMessageId, to: null },
    wording.lang,
  );
  return (
    <div class="space-y-3">
      {material === null ? null : (
        <>
          <section id="why" class={CARD}>
            <h3 class={CARD_HEADING}>{wording.whyStopped}</h3>
            {material.why === null ? (
              <p class="text-[13px] leading-5 text-muted-foreground">{wording.whyNotRead}</p>
            ) : (
              <p
                class="mt-1 text-[13.5px] leading-6 wrap-anywhere whitespace-pre-wrap"
                lang={materialLanguage(record)}
              >
                {material.why}
              </p>
            )}
          </section>
          {changedView(wording, record, material.work)}
          {fenceView(wording, record)}
        </>
      )}
      {/*
       * **The two readings one under the other, and nothing between them**
       * (D-0065 as annotated from #220): one gate, no recommendation, each
       * reading in its own words. Two across became one the moment they moved
       * to a 720px face, which is rule 8's *cards go one across* met early
       * rather than a second layout.
       */}
      {checksView(wording, checks, workGone)}
      {modelView(wording, model, modelDue, reload)}
      <p class="note text-[12.5px] leading-5 text-faint">{wording.readingsNote}</p>
    </div>
  );
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
  const standing = standingFindings(checks, model);
  return (
    // **The poll replaces this box and `page/composer.js` puts the words
    // back.** The gate is inside the thread since D-0083 rule 9, so the
    // five-second swap reaches it; the draft is kept by the script that
    // already keeps the send box's, off the `data-draft` key on the field.
    // `hx-preserve` would have been the other answer and is the wrong one
    // here: the send's own out-of-band swap of `#composer` has to land.
    <div id="answering" class="mt-3 space-y-3">
      {/*
       * **The findings themselves, quoted here and unfolded** (D-0083 rule
       * 9.4, `D-0082` rule 7). The cards they come from are the right face's
       * since rule 5's material moved there, and the right face drops below
       * the thread at 1280 -- so what the press is answered over has to be
       * inside the box that holds the press, whatever the width. One line
       * each, and nothing else of the cards: the severities, the bases and
       * the evidence are material and stay where the material is.
       */}
      {standing.length === 0 ? null : (
        <section id="standing" class={CARD}>
          <h3 class={CARD_HEADING}>{wording.standingHeading}</h3>
          <ul class="mt-1.5 space-y-1.5">
            {standing.map((said) => (
              <li class="flex gap-2 text-[13px] leading-5">
                <span aria-hidden="true" class="text-fail">
                  &#8226;
                </span>
                <span class="min-w-0 wrap-anywhere" lang="">
                  {said}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
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
        // **Its rule is amber and two pixels, and every other card's is one
        // pixel of border** (D-0082 rule 1): this bar is the one thing on the
        // screen that nothing but the person can clear, and it was drawn with
        // the same edge as the evidence stacked above it. The colour is the
        // page's one claim that a person must act, spent on the one element
        // that makes it (rule 2).
        class="sticky bottom-0 z-[1] -mx-4 mt-5 flex max-h-[75svh] flex-col gap-2 overflow-y-auto border-t-2 border-wait bg-card px-4 py-3 shadow-[0_-4px_10px_-8px_rgb(0_0_0/0.3)]"
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
            // **The press changes shape with what it is answering over**
            // (D-0083 rule 10): ink where the readings raised nothing, and
            // amber-outlined where one of them did, which is the same
            // condition the label already turns on.
            class={`${raised === null ? PRIMARY : DESPITE} h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto`}
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
        {reviseForm(wording, record, token, framing, newIterationId, raised !== null)}
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
 * **Drawn open, and never in the way of approving** (rondo#351). It was a
 * `<details>`: the recommendation was folded and the press that overrides a
 * finding was the only button on the screen, which is D-0082 rule 7 backwards
 * -- a fold holds evidence, never the thing the press needs, and what this
 * press sends *is* the draft inside it. D-0083 rule 9.3 asks for two choices,
 * the recommendation and the despite press; both are presses now, in the same
 * bar, each above the field it carries. D-0065's gate answer still keeps
 * approve unrefused whatever the model raised.
 *
 * **Which one is recommended is said by the fill** (D-0083 rule 10): ink where
 * a finding stands, because then asking for a change is the recommendation and
 * approving is the press made against a reading. With nothing raised the
 * filled press is approve and this one is outlined. Never amber -- the bar's
 * rule and the despite press already spend the page's one claim that a person
 * must act (D-0082 rule 2, rondo#343).
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
  /** Whether a reading raised something, which is what makes this the recommended answer. */
  recommended: boolean,
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
    <div id="revise">
      <form
        id="revise-form"
        method="post"
        action={`/revise?lang=${encodeURIComponent(wording.lang)}`}
        class="flex flex-col gap-2"
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
          class={`${recommended ? PRIMARY : SECONDARY} h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto sm:self-end`}
        >
          {wording.reviseAction}
        </button>
        <span id="revise-plain" class="note sr-only">
          {wording.revisePlain}
        </span>
      </form>
    </div>
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
          class={`${SECONDARY} h-7 px-3 text-[13px]`}
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
        // **A way to another screen, and not a press** (D-0082 rule 1): what
        // these lead to is a screen with its own press on it, and drawn filled
        // they outweighed the box further down that a person is actually being
        // waited on by.
        class={`${SECONDARY} h-7 px-3 text-[13px]`}
      >
        {wording.scopeAction}
      </a>
      {publishable.map((lap) => (
        <a
          id={`publish-${lap.record.id}`}
          href={viewHref({ kind: "publish", iterationId: lap.record.id }, wording.lang)}
          data-open=""
          class={`${SECONDARY} h-7 px-3 text-[13px]`}
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
   * **The lap everything about this confirmation is read from** (rule 6, and
   * Codex round 3): the one at the gate where there is one, and the one the
   * list speaks with otherwise. The line under the title, the right face's
   * agreement, its steps and the box in the thread all describe it -- two of
   * them reading different laps would put one lap's allowance and reach beside
   * another lap's question, which is exactly the misreading rule 6 exists
   * against.
   */
  // The lap the box is for, which is the one at the gate rather than the one
  // the list speaks with.
  const gatedLap =
    answeringLap === null || selectedRoot === null
      ? null
      : (lapsUnder(selectedRoot).find((lap) => lap.record.id === answeringLap)?.record ?? null);
  const governedLap = gatedLap ?? selectedLap?.record ?? null;

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
    governedLap === null || selectedRoot === null
      ? null
      : governanceOf(
          governedLap,
          repositoryOf(governedLap),
          threads.byId.get(selectedRoot)?.atMs ?? nowMs,
          await approvalOf(governedLap),
          // A proposal is done when rondo recorded one: the published report
          // it writes into the request's thread (rondo#245).
          publishedReport(threads, governedLap.id) !== null,
          /*
           * **Rule 6's fifth item, read for this request and for no window**
           * (rondo#350). The week's face counts withholdings over seven days
           * and cannot be narrowed; this is the request's own rows, so the
           * line may carry the count and the right face may name the rules.
           */
          await ports.record.withheldFor(selectedRoot),
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
   * **The week's money is the approvals in force, and a raise starts at zero**
   * (D-0074 rule 2 and section 3.2). Budgets are per approved row, so the pair
   * is read off the tip of each chain -- one entry per approval and not per
   * lap, because a retried request spends the one approval it was admitted
   * under. What a predecessor spent before a raise stays written under the
   * predecessor and is the scope screen's to show (section 4.2); adding it in
   * here would make a raise read as a total across the chain, which is the
   * misreading rule 2 exists to prevent.
   */
  const weekApprovals = new Map<string, { spentUsd: number; approvedUsd: number }>();
  if (centreIsEmpty) {
    const touched = [...allLapsByRequest.values()]
      .flat()
      .filter((lap) => Math.max(lap.record.createdAtMs, lap.record.updatedAtMs) >= weekFromMs);
    for (const approval of await Promise.all(touched.map((lap) => approvalOf(lap.record)))) {
      if (approval !== null) {
        weekApprovals.set(approval.decisionId, allowanceOf(approval));
      }
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
  /*
   * **The right face of a request** (D-0083 rules 5 and 6, gate point 7's
   * second slice, rondo#350). Two tiers: the material for this confirmation,
   * and what was agreed for this request. `page/thread-side.tsx` decides which
   * is on top, because that is a fact about whether anything is being asked.
   *
   * **The material is the renderer's own markup**, crossing the seam as the
   * boxes do -- it is the same cards that used to stand inside the answering
   * box, moved and not redrawn.
   *
   * **With nothing being asked there is no material read** (`page/contract.ts`:
   * it is read where the press is), so what is known so far is the lap's
   * readings alone -- and nothing at all where no reading has been taken,
   * because two cards saying *not yet* are not a thing anybody came to read.
   */
  /*
   * **The lap this face is about is the one being answered** (Codex). A gate
   * is answered wherever it stands, so the lap at the gate need not be the one
   * the list speaks with: `saysMore` can put a newer running lap forward while
   * an older one waits. The material, the steps and the box all have to
   * describe the same lap, or the face would say *work, under way* beside a
   * confirmation that is waiting on the person. With nothing being asked there
   * is no gated lap and the selected one is the subject.
   */
  const sideLap = governedLap;
  const sideAsking = gatedLap !== null && gateFraming !== undefined;
  const sideReadings =
    gateFraming?.readings ??
    (selectedLap === null ? [] : (readingsByLap.get(selectedLap.record.id) ?? []));
  const sideMaterial =
    sideLap === null
      ? null
      : sideAsking && gateFraming !== undefined
        ? await materialView(wording, sideLap, gateFraming.material, sideReadings).toString()
        : sideReadings.length > 0
          ? await materialView(wording, sideLap, null, sideReadings).toString()
          : null;
  const threadSide =
    selectedGovernance === null || sideLap === null
      ? null
      : {
          react: ThreadSide({
            wording,
            governance: selectedGovernance,
            // **What remains before this ends** (rule 6), as the five steps
            // rule 4 draws under a running request: one reading of where the
            // work stands, drawn in two places by one component.
            steps: stepsOf(sideLap, sideReadings),
            material: sideMaterial === null ? null : Raw({ html: sideMaterial }),
            asking: sideAsking,
          }),
        };
  const emptySide = !centreIsEmpty
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
               * **A request and not a lap, and only one that has stopped**
               * (`page-logic/week.ts`): the laps are grouped by their request,
               * and a request with anything still running under it has not
               * finished however many of its laps have closed.
               */
              finishedAtMs: finishedAt(
                [...allLapsByRequest.values()].map((laps) =>
                  laps.map((lap) => ({
                    status: lap.record.status,
                    updatedAtMs: lap.record.updatedAtMs,
                  })),
                ),
                (status) => isTerminal(status as IterationRecord["status"]),
              ),
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
              allowances: [...weekApprovals.values()],
            },
            nowMs,
          ),
          running: sideRunning,
          hrefOf: (messageId) => viewHref({ kind: "thread", messageId, to: null }, wording.lang),
        }),
      };
  const sideContent = centreIsEmpty ? emptySide : threadSide;
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
