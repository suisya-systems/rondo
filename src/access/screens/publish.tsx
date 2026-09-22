import type { IterationRecord } from "../../store/records.js";
import { markdownHtml } from "../markdown.js";
import type { PublishBlock, ReviewBlock, WebPorts } from "../page/contract.js";
import {
  backHead,
  CARD,
  CARD_HEADING,
  chevron,
  note,
  PRIMARY,
  publishedReport,
  SECONDARY,
} from "../page/vocabulary.js";
import type { PageView } from "../page-logic/routes.js";
import type { Threads } from "../page-logic/threads.js";
import type { Chrome } from "../wording.js";

/** The publish's three legs in the past tense, the pull request as a link. */

/** A block of lines read as columns, which may scroll sideways rather than rewrap. */
const PRE =
  "overflow-x-auto rounded-md border border-border bg-muted/50 p-3 font-mono text-id leading-5 whitespace-pre";

/** A pull request body split around the request fold it carries. */
interface RequestFold {
  readonly before: string;
  readonly summary: string;
  /** The quotation with its fences, as markdown: a code block. */
  readonly fenced: string;
  readonly after: string;
}

/**
 * The request fold `requestBlock` (pull-request.ts) writes into a pull request
 * body, or null where the body carries none (rondo#248).
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
    /*
     * The rule below arrived with React's rule set when the page's rebuild
     * installed it, and it is answered here rather than switched off for the
     * file, so the next use has to argue for itself too: `markdownHtml` is
     * the one module that transforms content (D-0059), and what passes is
     * decided there -- no raw HTML, no link that runs, no image fetched. The
     * renderer reaches micromark no other way.
     */
    // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitised by markdownHtml, the one transforming module (D-0059)
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
    "-mb-px cursor-pointer border-b-2 border-transparent px-3 py-2 text-body leading-5 font-medium text-muted-foreground select-none hover:border-border hover:text-foreground has-checked:border-link has-checked:font-semibold has-checked:text-foreground has-focus-visible:rounded-t-md has-focus-visible:ring-2 has-focus-visible:ring-ring";
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
        <p class="hidden py-2 text-meta leading-5 text-muted-foreground group-has-[#publish-body-raw:checked]/body:block">
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
              <summary class="flex cursor-pointer list-none items-center gap-2 rounded-md py-1 text-body leading-6 outline-none select-none hover:text-link focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                {chevron("group-open/request:rotate-90")}
                {fold.summary}
              </summary>
              <div class="mt-2">{markdown(fold.fenced)}</div>
            </details>
            {markdown(fold.after)}
          </>
        )}
      </div>
      {/* The same bytes as the preview beside it, so they are read at the same
          size: `--text-body` is what `.markdown` sets, and `PRE`'s `--text-id`
          is the floor a block of columns is drawn at (D-0082 rule 4). */}
      <pre
        id="publish-body-exact"
        class={`${PRE.replace(/whitespace-pre$/, "whitespace-pre-wrap").replace("text-id", "text-body")} hidden wrap-anywhere group-has-[#publish-body-raw:checked]/body:block`}
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
export async function publishView(
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
        <p class="text-body leading-6">{wording.publishNotYetLead}</p>
        <section id="publish-not-yet" class={`${CARD} space-y-1`}>
          <h3 class={CARD_HEADING}>{wording.publishNotYetHeading}</h3>
          {publishBlockLines(wording, shown.block).map((line) => (
            <p class="text-body leading-5 wrap-anywhere">{line}</p>
          ))}
        </section>
      </>,
    );
  }
  const review = shown.review;
  // rondo#417 (D-0105): a conflict fix moves an open pull request's head.
  const updates = shown.updates ?? null;
  const updating =
    updates === null ? null : wording.pullRequest(/\/pull\/(\d+)/.exec(updates.url)?.[1] ?? null);
  return framed(
    <>
      {/* The lead says which screen this is, because the two differ in what a
          person may do here and not only in what they are told. */}
      <p class="text-body leading-6">
        {review === null ? wording.publishLead : wording.publishReviewLead}
      </p>
      <section id="publish-target" class={`${CARD} space-y-1`}>
        <h3 class={CARD_HEADING}>{wording.publishTargetHeading}</h3>
        <p class="text-body leading-5">
          {wording.publishPushes(updates?.onto ?? shown.target.headRef, shown.target.remote)}
        </p>
        <p class="text-body leading-5">
          {updating === null
            ? wording.publishOpens(shown.target.repo, shown.target.baseBranch)
            : wording.publishUpdates(updating, shown.target.baseBranch)}
        </p>
        <p class="text-body leading-5">{wording.publishCloses(shown.target.runId)}</p>
        {/* Where the push actually goes, quietly, beside the name it goes by:
            the press refuses when this moves, so this is what moved. */}
        {shown.target.pushUrls.map((url) => (
          <p class="text-meta leading-5 wrap-anywhere text-muted-foreground" lang="">
            {wording.publishPushUrl(url)}
          </p>
        ))}
        <p class="text-meta leading-5 text-muted-foreground" lang="">
          {wording.publishWorkspace(shown.target.workspace)}
        </p>
      </section>
      {shown.warnings.length === 0 ? null : (
        <section id="publish-noticed" class={`${CARD} space-y-1`}>
          <h3 class={CARD_HEADING}>{wording.publishNoticedHeading}</h3>
          {shown.warnings.map((warning) => (
            <p class="text-body leading-5 wrap-anywhere">{warning}</p>
          ))}
        </section>
      )}
      {review === null ? null : (
        <section
          id="publish-review"
          class="min-w-0 space-y-1 rounded-lg border border-warn/40 bg-card px-4 py-3"
        >
          <h3 class={CARD_HEADING}>{wording.publishReviewHeading}</h3>
          <p class="text-body leading-5 wrap-anywhere">{reviewBlockLine(wording, review)}</p>
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
          ? publishForm(wording, record, token, shown.shown, updating)
          : despiteForm(wording, record, token, shown.shown)}
      <p class="note text-meta leading-5 text-muted-foreground">{wording.publishNote}</p>
      {/* **The press above what it sends** (D-0106, rondo#408): the target,
          anything noticed and a standing refusal are short and come first,
          then the press, then the pull request's own title and body -- still
          drawn open, never folded (D-0082 rule 7), and under the press
          rather than above it, because the body is long. */}
      {/* **The text a reviewer will read, on the screen that publishes it.**
          Drawn open, and not a fold (D-0082 rule 7, rondo#317): publish is an
          outward press nobody can take back, and the body is not evidence to
          look at afterwards -- it is what the press sends. It was a fold the
          page always rendered shut, which meant a person could publish without
          ever seeing what went out, and rule 7's line is that a fold never
          holds what the press needs. Length is not the test: a long quotation
          that only records what happened may fold, and this one does not,
          because it is the thing being decided. The words are the pull
          request's own, so the block states no language. */}
      {updating !== null ? null : (
        <section id="publish-request" class={`${CARD} space-y-2`}>
          <h3 class={CARD_HEADING}>{wording.publishRequestHeading}</h3>
          <p class="text-meta leading-5 font-medium text-muted-foreground">
            {wording.publishTitleLabel}
          </p>
          <p id="publish-title" class="text-title leading-6 wrap-anywhere" lang="">
            {shown.title}
          </p>
          {/* The label the fold's summary carried, now drawn as the title's is
            above it: the two the press sends are one pair on the screen. */}
          <div id="publish-body">
            <p class="text-meta leading-5 font-medium text-muted-foreground">
              {wording.publishBodyLabel}
            </p>
            {publishBody(wording, shown.body)}
          </div>
        </section>
      )}
      {shown.modelReading.length === 0 ? null : (
        <section id="publish-model" class={`${CARD} space-y-1`}>
          <h3 class={CARD_HEADING}>{wording.publishModelHeading}</h3>
          <pre
            class={`${PRE.replace(/whitespace-pre$/, "whitespace-pre-wrap")} wrap-anywhere`}
            lang=""
          >
            {shown.modelReading.join("\n")}
          </pre>
          <p class="note text-meta leading-5 text-muted-foreground">{wording.publishModelNote}</p>
        </section>
      )}
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
    case "answerNotApproval":
      return [wording.publishAnswerNotApproval(block.answer)];
    case "noRun":
      return [wording.publishNoRun];
    case "planField":
      return [wording.publishPlanField(block.field)];
    case "noRepo":
      return [wording.publishNoRepo];
    case "target":
      return [wording.publishTargetRefused(block.reason)];
    case "statusUnreadable":
      return [wording.publishStatusUnreadable(block.reason)];
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
function publishForm(
  wording: Chrome,
  record: IterationRecord,
  token: string,
  shown: string,
  /** The pull request this push updates, named, or null where it opens one (rondo#417). */
  updating: string | null = null,
) {
  return (
    <form
      id="publish-form"
      method="post"
      action={`/publish?lang=${encodeURIComponent(wording.lang)}`}
      class="flex flex-col gap-2"
    >
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="iteration" value={record.id} />
      <input type="hidden" name="request" value={record.requestMessageId} />
      <input type="hidden" name="shown" value={shown} />
      <button
        type="submit"
        data-row=""
        aria-describedby="publish-plain"
        data-busy={updating === null ? wording.publishBusy : wording.publishBusyUpdate}
        class={`${PRIMARY} h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto sm:self-start`}
      >
        {updating === null ? wording.publishAction : wording.publishUpdateAction(updating)}
      </button>
      <p
        data-busy-note=""
        hidden
        role="status"
        class="note text-meta leading-5 text-muted-foreground"
      >
        {wording.publishBusyNote}
      </p>
      <span id="publish-plain" class="note sr-only">
        {updating === null ? wording.publishPlain : wording.publishPlainUpdate}
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
        class="flex cursor-pointer list-none items-center gap-2 rounded-md py-1 text-meta leading-5 font-medium text-link outline-none select-none hover:underline focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
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
        <input type="hidden" name="request" value={record.requestMessageId} />
        <input type="hidden" name="shown" value={shown} />
        {/* The one field that says which of the two presses this is, and the
            port refuses it when the refusal it names is not there. */}
        <input type="hidden" name="despite_review" value="yes" />
        <p class="note text-meta leading-5 text-muted-foreground">{wording.publishDespiteNote}</p>
        <button
          type="submit"
          data-row=""
          aria-describedby="publish-despite-plain"
          data-busy={wording.publishBusy}
          class={`${SECONDARY} h-10 w-full justify-center px-6 text-sm sm:h-9 sm:w-auto sm:self-start`}
        >
          {wording.publishDespiteAction}
        </button>
        <p
          data-busy-note=""
          hidden
          role="status"
          class="note text-meta leading-5 text-muted-foreground"
        >
          {wording.publishBusyNote}
        </p>
        <span id="publish-despite-plain" class="note sr-only">
          {wording.publishDespitePlain}
        </span>
      </form>
    </details>
  );
}
