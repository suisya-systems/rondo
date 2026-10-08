/**
 * The approve box, drawn on a gated lap's request: the claims under their
 * basis, the lap's story, the one button and the revise form beside it
 * (rondo#341 moved it out of `src/access/web.tsx`).
 */
import { type Claim, UNDETERMINED } from "../../advisory/proposal.js";
import {
  type IterationRecord,
  isModelReadingDrafter,
  type LapReading,
  latestReading,
  reviewedReading,
} from "../../store/records.js";
import { basisLine } from "../advisory.js";
import type { LapWorkInspection } from "../forge.js";
import { endedWhy, materialLanguage } from "../page-logic/laps.js";
import { viewHref } from "../page-logic/routes.js";
import { raisedIn, type StoryLap } from "../page-logic/story.js";
import type { Chrome } from "../wording.js";
import type { MintIterationId } from "./contract.js";
import {
  checksPill,
  maintainerFold,
  modelPendingOnPage,
  modelPill,
  standingFindings,
} from "./gate-material.js";
import { answerable, raiseBlock, type Shown } from "./gate-shown.js";
import type { PartStep } from "./thread-side.js";
import { CARD, CARD_HEADING, chevron, DESPITE, glyph, PRIMARY, SECONDARY } from "./vocabulary.js";

/**
 * The one word the button carries (D-0041 rule 7).
 *
 * Read from this constant on the way *in* rather than from the posted form: the
 * form's own `body` field is not trusted, so the page's writing vocabulary is
 * one word whatever a hand-written request says.
 */
export const APPROVE_BODY = "approve";

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
          class={`flex flex-col sm:flex-row sm:items-start ${focusable ? "outline-none focus-visible:bg-accent focus-visible:shadow-[inset_3px_0_0_var(--color-ring)]" : ""}`}
          {...(focusable ? { "data-row": "", tabindex: -1 } : {})}
        >
          {/* One quiet line, cut with an ellipsis; the whole locator is its `title`. */}
          <p
            class="basis order-last truncate px-3 pb-1.5 font-mono text-id leading-4 text-faint/75 sm:w-[32%] sm:shrink-0 sm:py-2 sm:text-right"
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
                      ? "label text-meta leading-5 text-faint"
                      : "label text-meta leading-5 text-muted-foreground"
                  }
                >
                  {claim.label}
                </dt>
                <dd
                  class={
                    claim.value === UNDETERMINED
                      ? "value text-body leading-5 wrap-anywhere whitespace-pre-wrap text-faint italic"
                      : "value text-body leading-5 font-medium wrap-anywhere whitespace-pre-wrap"
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

/** The line by the button, or null where the model review raised nothing that heavy. */
function modelRaised(wording: Chrome, reading: LapReading | null): string | null {
  const open = raisedIn(reading);
  return open === null ? null : wording.modelRaised(open.blockers, open.majors);
}

/**
 * **What happened on the way to this gate** (rondo#497), the box's first card:
 * how many laps ran, what each was asked, what it committed and how it ended,
 * then where the request's other parts stand. Lap 18's person could not tell
 * this from the gate: the story was in the folded records as raw text, and a
 * split's second part was not named anywhere near the press.
 *
 * rondo's words over recorded facts only ({@link lapStory}); the words a
 * change was asked with and the drafter's summary are quoted, in their own
 * language (`lang=""`), and nothing is summarised.
 */
export interface GateStory {
  readonly laps: readonly StoryLap[];
  /** Which part of a split this gate is, from 0, and how many there are; null for one line. */
  readonly part: { readonly index: number; readonly count: number } | null;
  readonly others: readonly PartStep[];
  /** The drafter's summary of what the request changes, or null where none was written. */
  readonly intended: string | null;
}

function storyView(
  wording: Chrome,
  story: GateStory,
  current: IterationRecord,
  work: LapWorkInspection | null,
) {
  // **Bounded, so the presses stay in reach on arrival** (D-0106, the Fable
  // pass on rondo#497): quotes are clamped to three lines. **Never folded**
  // (rondo#547): a fold whose summary read "what was asked" was taken for the
  // words themselves, and the lap's row then said nothing of what was sent.
  const QUOTE =
    "mt-1 line-clamp-3 border-l-2 border-border pl-2 text-body leading-5 wrap-anywhere whitespace-pre-wrap";
  return (
    <section id="story" class={CARD}>
      <h3 class={CARD_HEADING}>{wording.storyHeading}</h3>
      <p class="mt-1 text-body leading-5">
        {story.part === null
          ? null
          : `${wording.storyPart(story.part.index + 1, story.part.count)} `}
        {wording.storyLaps(story.laps.length)}
      </p>
      {story.intended === null ? null : (
        <>
          <p class="mt-2 text-meta leading-5 text-muted-foreground">{wording.storyIntended}</p>
          <p class={QUOTE} lang="" title={story.intended}>
            {story.intended}
          </p>
        </>
      )}
      <ol class="mt-2 space-y-2">
        {story.laps.map((lap, index) => {
          const now = lap.record.id === current.id;
          const subjects = now && work?.kind === "read" ? work.commits.slice(0, 3) : [];
          const told =
            lap.told.kind === "request"
              ? wording.storyToldRequest
              : lap.told.kind === "asked"
                ? wording.storyToldAsked
                : lap.told.kind === "continued"
                  ? wording.storyToldContinued(lap.told.lap)
                  : wording.storyToldNotRecorded;
          const words = lap.told.kind === "asked" ? lap.told.words : null;
          const outcome = [
            lap.commits === null || lap.files === null
              ? wording.storyChangedUnread
              : wording.storyChanged(lap.commits, lap.files),
            // The lap at the gate's count is the bar's, a few lines below.
            now || lap.raised === null
              ? null
              : wording.modelRaised(lap.raised.blockers, lap.raised.majors),
            now
              ? wording.storyNow
              : wording.storyEnded(lap.record.gateAnswer, endedWhy(wording, lap.record)),
          ]
            .filter((part) => part !== null)
            .join(" ");
          return (
            <li class="text-body leading-5">
              <span class="font-semibold">{wording.storyLapName(index + 1, now)}</span> {told}
              {words === null ? null : (
                <p class={QUOTE} lang="" title={words}>
                  {words}
                </p>
              )}
              <p class="mt-0.5 text-muted-foreground">{outcome}</p>
              {subjects.length === 0 ? null : (
                <ul class="mt-1 space-y-0.5">
                  {subjects.map((commit) => (
                    <li class="flex gap-2 text-meta leading-5 text-muted-foreground">
                      <span aria-hidden="true" class="text-faint">
                        &#8226;
                      </span>
                      <span class="min-w-0 wrap-anywhere" lang="">
                        {commit.subject}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
      {story.others.length === 0 ? null : (
        <>
          <p class="mt-2 text-meta leading-5 text-muted-foreground">{wording.storyOthers}</p>
          <ul class="mt-1 space-y-1">
            {story.others.map((part) => (
              <li class="text-body leading-5">
                <span class="font-semibold">{part.name}</span> {part.said}
                {part.links.map((link) => (
                  <>
                    {" "}
                    <a href={link.href} class="underline underline-offset-2">
                      {link.said}
                    </a>
                  </>
                ))}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
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
 * **The findings, then the presses, then the records** (D-0106, rondo#408,
 * replacing D-0059 section 2's bar stuck to the window's foot): what the press
 * is answered over is quoted first, the presses come straight after it, and
 * the claims it records -- 21 rows of them, folded -- come last, so a person
 * arriving meets the question and its answers without scrolling, with or
 * without CSS.
 *
 * **A native form, and nothing else can press it** (D-0059 section 5): no
 * `hx-post`, no script, a real `<button type="submit">`. `method="post"` is not
 * decoration: the refresh is a `GET`, and this form is the only thing on the
 * page that can produce anything else -- and only a person's click produces the
 * `Sec-Fetch-User: ?1` the press is minted from.
 */
/**
 * **A gate's form is kept, not swapped, when the redraw brings another gate's
 * over the person's words** (rondo#494 item 3, D-0166; `page/rounds.js`). The
 * round is the gate; the old gate cannot be answered any more, so nothing says
 * it can be kept answering, and the words stay on the page to be copied.
 */
function stepRound(wording: Chrome, record: IterationRecord) {
  return {
    "data-round": `${record.id}:${record.gateId ?? ""}`,
    "data-round-said": wording.roundChangedStep,
    "data-round-use-label": wording.roundUseStep,
    "data-round-held-label": wording.roundHeld,
  };
}

export function approveView(
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
  /** What happened on the way here (rondo#497), or null where it was not composed. */
  story: GateStory | null = null,
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
  // **The collision is quoted in the box too, and for the findings' own
  // reason** (`D-0082` rule 7, Codex round 1 on rondo#294): the card it comes
  // from is the right face's, the right face drops below the thread at 1280,
  // and a sentence telling a person to look at other work before approving is
  // worth nothing under the button. The path nobody holds stays on the card:
  // it blocks nothing and is not a thing to answer over.
  const reach = framing.material?.reach;
  const collision =
    reach !== undefined && reach.kind === "outside" && reach.collided.length > 0
      ? wording.reachCollided(reach.collided)
      : null;
  return (
    // **The poll replaces this box and `page/composer.js` puts the words
    // back.** The gate is inside the thread since D-0083 rule 9, so the
    // five-second swap reaches it; the draft is kept by the script that
    // already keeps the send box's, off the `data-draft` key on the field.
    // `hx-preserve` would have been the other answer and is the wrong one
    // here: the send's own out-of-band swap of `#composer` has to land.
    // **And it is washed when a redraw changes it** (rondo#494 item 1): this
    // is the ask, and a new round of findings or a different question
    // arriving here is the change lap 18 found a person could not see.
    <div id="answering" class="mt-3 space-y-3" data-can-act="ask">
      {story === null ? null : storyView(wording, story, record, work)}
      {/*
       * **The findings themselves, quoted here and unfolded** (D-0083 rule
       * 9.4, `D-0082` rule 7). The cards they come from are the right face's
       * since rule 5's material moved there, and the right face drops below
       * the thread at 1280 -- so what the press is answered over has to be
       * inside the box that holds the press, whatever the width. One line
       * each, and nothing else of the cards: the severities, the bases and
       * the evidence are material and stay where the material is.
       */}
      {standing.length === 0 && collision === null ? null : (
        <section id="standing" class={CARD}>
          <h3 class={CARD_HEADING}>{wording.standingHeading}</h3>
          <ul class="mt-1.5 space-y-1.5">
            {/*
             * First, and in the set's own language rather than `lang=""`: the
             * findings below are a reading's own words and this sentence is
             * the page's.
             */}
            {collision === null ? null : (
              <li class="flex gap-2 text-body leading-5">
                <span aria-hidden="true" class="text-fail">
                  &#8226;
                </span>
                <span class="min-w-0 wrap-anywhere">{collision}</span>
              </li>
            )}
            {standing.map((said) => (
              <li class="flex gap-2 text-body leading-5">
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
       * **The bar holds both of the gate's answers** (rondo#233 S4, the critic
       * gap S2 left open): approving, and asking for a change. Two forms and
       * not one, because a form cannot nest and each posts to its own address
       * with its own press -- and the bar around them is a `div`, so nothing
       * about where a control sits decides which press it makes.
       */}
      <div
        id="answer-bar"
        // **At the top of the box, under the findings it answers over, and
        // not stuck to the window's foot** (D-0106, rondo#408): it used to
        // stick to the bottom of the window beneath the folded records, which
        // left the press below the fold on arrival. The records it answers
        // over are folded under it now, so nothing scrolls it away.
        // **Its rule is amber and two pixels, and every other card's is one
        // pixel of border** (D-0082 rule 1): this bar is the one thing on the
        // screen that nothing but the person can clear, and it was drawn with
        // the same edge as the evidence stacked above it. The colour is the
        // page's one claim that a person must act, spent on the one element
        // that makes it (rule 2).
        class="flex flex-col gap-2 rounded-lg border border-border border-t-2 border-t-wait bg-card px-4 py-3"
      >
        {/*
         * **Both readings' verdicts pinned in the bar** (the S2 design pass on
         * #220): the bar is the first thing in the box, so the decision's
         * material shows before any reading is scrolled to, at a phone width
         * too. Side by side and in the same weight, no recommendation between
         * them (D-0065 as annotated from #220). The model's blocker or major
         * line is part of it -- seen before pressing and never in the way of
         * it; the press below it is the same press whatever this says, and
         * since rondo#237 it wears the difference on its face.
         */}
        <p
          id="bar-readings"
          class="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta leading-5 text-muted-foreground"
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
              class="inline-flex flex-wrap items-center gap-x-1.5 text-body text-fail"
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
        {/*
         * **Whether rondo would approve this without the person, and why not**
         * (D-0125): one line in the person's words, under the readings it is
         * read from. It answers nothing; the press below is the person's.
         */}
        <p id="gate-auto" class="text-meta leading-5 text-muted-foreground">
          {wording.gateAuto(framing.auto)}
        </p>
        <form
          id="approve-form"
          method="post"
          action={viewHref({ kind: "summary" }, wording.lang)}
          class="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3"
          {...stepRound(wording, record)}
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
            <span class="text-meta leading-5 font-medium text-muted-foreground">
              {wording.claimLabel}
            </span>
            <textarea
              name="verified"
              rows={1}
              data-draft={`claim:${record.id}:${record.gateId}`}
              placeholder={wording.claimPlaceholder}
              class="max-h-32 min-h-9 w-full resize-y rounded-md border border-border bg-background px-2.5 py-1.5 text-body leading-5 outline-none [field-sizing:content] placeholder:text-faint focus-visible:ring-2 focus-visible:ring-ring"
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
            data-busy={wording.approveBusy}
            // **The press changes shape with what it is answering over**
            // (D-0083 rule 10): ink where the readings raised nothing, and
            // amber-outlined where one of them did, which is the same
            // condition the label already turns on.
            class={`${raised === null ? PRIMARY : DESPITE} h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto`}
          >
            {raised === null ? wording.approveFace : wording.approveDespite}
          </button>
          <span
            id={`approve-plain-${record.id}`}
            class="note sr-only"
            title={wording.approveNote(record.gateId, APPROVE_BODY)}
          >
            {raised === null ? wording.approvePlain : wording.approveDespitePlain}
          </span>
        </form>
        {reviseForm(
          wording,
          record,
          token,
          framing,
          newIterationId,
          raised !== null,
          story === null ? null : story.laps.length + 1,
        )}
      </div>
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
          class="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-meta leading-5 text-muted-foreground outline-none select-none hover:bg-accent focus-visible:bg-accent focus-visible:shadow-[inset_3px_0_0_var(--color-ring)] [&::-webkit-details-marker]:hidden"
        >
          {chevron()}
          {wording.recordsFold(framing.claims.length)}
        </summary>
        <div class="space-y-3 border-t border-border p-3">
          <p class="note text-meta leading-5 text-muted-foreground">{wording.pressNote}</p>
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
                class="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-meta leading-5 text-muted-foreground outline-none select-none hover:bg-accent focus-visible:bg-accent focus-visible:shadow-[inset_3px_0_0_var(--color-ring)] [&::-webkit-details-marker]:hidden"
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
              <summary class="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-meta leading-5 text-muted-foreground outline-none select-none hover:bg-accent focus-visible:bg-accent [&::-webkit-details-marker]:hidden">
                {chevron()}
                {wording.allAsText}
              </summary>
              <pre
                class="material overflow-x-auto border-t border-border bg-muted/50 p-3 font-mono text-id leading-5 wrap-anywhere whitespace-pre-wrap"
                lang={materialLanguage(record)}
              >
                {framing.material.lines.join("\n")}
              </pre>
            </details>
          )}
        </div>
      </details>
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
  /** The number the lap this starts will have in its line, as the story counts it; null unread. */
  next: number | null,
) {
  if (newIterationId === null) {
    return null;
  }
  if (framing.forked || framing.scopeDecisionId === null) {
    return (
      <p id="revise-none" class="note text-meta leading-5 text-faint">
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
    return raiseBlock(wording, closed, record.requestMessageId, framing.scopeDecisionId, record.id);
  }
  // **Spent review rounds are raised by the revise press itself** (D-0164,
  // rondo#547): one round more than were taken is a number the gate can
  // prefill, so the press raises and asks in one step.
  const rounds = framing.roundsClosing;
  const raising = rounds === null ? null : framing.budgets;
  const box = framing.revise;
  const draftKey = `revise:${record.id}:${record.gateId ?? ""}`;
  return (
    <div id="revise">
      <form
        id="revise-form"
        method="post"
        action={`/revise?lang=${encodeURIComponent(wording.lang)}`}
        class="flex flex-col gap-2"
        {...stepRound(wording, record)}
      >
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="iteration" value={record.id} />
        <input type="hidden" name="request" value={record.requestMessageId} />
        <input type="hidden" name="scope_decision" value={framing.scopeDecisionId} />
        {/* Minted at render, as the scoped start's is, and for its reason:
            rondo names the lap (D-0023) and a double press is one lap. */}
        <input type="hidden" name="successor" value={newIterationId()} />
        {raising === null || rounds === null ? null : (
          <div id="revise-raise" class="space-y-1">
            <p class="note text-meta leading-5 text-foreground">
              {wording.reviseRaises(rounds.budget)}
            </p>
            {/* The approval's other budgets carried as stored, not as a
                person reads them: rounded to cents or minutes, the raise
                would change budgets the person was told stay as they are. */}
            <input type="hidden" name="raise" value={framing.scopeDecisionId} />
            <input type="hidden" name="laps" value={String(raising.laps)} />
            <input type="hidden" name="cost_usd" value={String(raising.cost_usd)} />
            <input type="hidden" name="cost_reserve_usd" value={String(raising.cost_reserve_usd)} />
            {/* ponytail: the form's expiry reads to the second, so a stored
                millisecond part is dropped (under a second earlier). */}
            <input
              type="hidden"
              name="expires_at_ms"
              value={new Date(raising.expires_at_ms).toISOString().slice(0, 19)}
            />
            {/* Rounds are counted along the line, so one more than were taken
                is what lets the next lap through (D-0065 4.3). */}
            <label class="flex items-center gap-2 text-meta leading-5 text-muted-foreground">
              <span>{wording.answerRaiseRoundsLabel}</span>
              <input
                type="number"
                name="review_rounds"
                min={String(rounds.taken + 1)}
                step="1"
                value={String(rounds.taken + 1)}
                class="w-20 rounded-md border border-border bg-background px-2 py-1 text-body leading-5"
              />
            </label>
          </div>
        )}
        <label class="flex min-w-0 flex-col gap-1">
          <span class="text-meta leading-5 font-medium text-muted-foreground">
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
            class="max-h-64 min-h-20 w-full resize-y rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-body leading-5 outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-ring"
          >
            {box.kind === "drafted" ? box.text : ""}
          </textarea>
        </label>
        {box.kind === "none" ? null : (
          <p
            id="revise-draft-state"
            data-draft-state={draftKey}
            class="note text-meta leading-5 text-muted-foreground"
          >
            {box.kind === "drafted"
              ? box.answer === true
                ? wording.reviseAnswerDrafted
                : wording.reviseDrafted
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
            class="note text-meta leading-5 text-muted-foreground"
          >
            {wording.reviseDraftArrived}
          </p>
        ) : null}
        {box.kind === "unavailable" ? maintainerFold("revise-why", wording, box.reason) : null}
        <p class="note text-meta leading-5 text-muted-foreground">{wording.reviseNote(next)}</p>
        {/* **A change waits on the question, and says so before the press**
            (rondo#448): the scope's verdict refuses it while a question over
            this line stands, so the press is drawn but not pressable. The box
            stays, and what is written in it is kept, so the change can be
            written now and sent once the question is answered. */}
        {/* **What answering releases, and how long it has waited** (D-0098 rule
            8.4, the gate's point 2 answer: on the revise box). No deadline,
            because there is none: nothing here says what rondo will assume. */}
        {framing.workerQuestion === null ? null : (
          <p id="revise-answer" class="note text-meta leading-5 text-foreground">
            {[
              wording.reviseAnswerStarts(framing.workerQuestion.part),
              ...(framing.workerQuestion.releases.length === 0
                ? []
                : [wording.reviseAnswerReleases(framing.workerQuestion.releases)]),
              ...(framing.workerQuestion.waitedSaid === null
                ? []
                : [wording.questionWaited(framing.workerQuestion.waitedSaid)]),
              // Japanese sentences run on with no space between them.
            ].join(wording.lang === "ja" ? "" : " ")}
          </p>
        )}
        {/* **A take-in is said inside the press's box** (D-0098 rule 8.5,
            D-0082 rule 7): the attempt this starts first merges in what
            another part landed on these files. */}
        {framing.takeIn == null ? null : (
          <p id="revise-take-in" class="note text-meta leading-5 text-foreground">
            {wording.reviseTakeIn}
            {framing.takeIn.url === null ? null : (
              <>
                {" "}
                <a href={framing.takeIn.url} class="text-link hover:underline">
                  {wording.pullRequest(framing.takeIn.number)}
                </a>
              </>
            )}
          </p>
        )}
        {framing.questionOpen === null ? null : (
          <p id="revise-waits" class="note text-meta leading-5 text-foreground">
            {framing.questionOpen.stopped
              ? wording.reviseWaitsOnStopped
              : wording.reviseWaitsOnQuestion}{" "}
            <a
              href={`#${encodeURIComponent(framing.questionOpen.id)}`}
              class="text-link hover:underline"
            >
              {wording.reviseWaitsLink}
            </a>
          </p>
        )}
        <button
          type="submit"
          data-row=""
          disabled={framing.questionOpen !== null}
          aria-describedby="revise-plain"
          data-busy={wording.reviseBusy}
          class={`${recommended ? PRIMARY : SECONDARY} h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto sm:self-end`}
        >
          {wording.reviseAction}
        </button>
        <p
          data-busy-note=""
          hidden
          role="status"
          class="note text-meta leading-5 text-muted-foreground"
        >
          {wording.lapBusyNote}
        </p>
        <span id="revise-plain" class="note sr-only">
          {wording.revisePlain(next)}
        </span>
      </form>
    </div>
  );
}
