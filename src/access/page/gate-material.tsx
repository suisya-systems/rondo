/**
 * The gate's material, drawn on the request's right face: the fence, what
 * changed, the reach, the checks and the model's findings, the closing fix,
 * and the `held` helper that draws a line in its held language
 * (rondo#341 moved them out of `src/access/web.tsx`).
 */
import { raw } from "hono/html";
import {
  type FindingSeverity,
  findingBasisText,
  type GradedFinding,
  type IterationRecord,
  isModelReadingDrafter,
  type LapReading,
  latestReading,
  MODEL_READING_DRAFTER_PREFIX,
  readingReach,
  reviewedReading,
} from "../../store/records.js";
import type { LapWorkInspection } from "../forge.js";
import { retakeOffered } from "../model-review/judgement.js";
import { decodedDenials, materialLanguage, workerRuns } from "../page-logic/laps.js";
import { viewHref } from "../page-logic/routes.js";
import { raisedIn } from "../page-logic/story.js";
import { denialLine, LIST_LIMIT } from "../review.js";
import type { Chrome } from "../wording.js";
import type { ClaimReach, LapMaterialRead, WebPorts } from "./contract.js";
import type { HeldReads } from "./held.js";
import { heldMarkup } from "./render.js";
import { CARD, CARD_HEADING, chevron, pill, SECONDARY, type Tone } from "./vocabulary.js";

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
        <p class="text-body leading-6">
          <span class="font-semibold">{wording.fenceHeading}</span>{" "}
          <span class="text-muted-foreground">{count}</span>
        </p>
      ) : (
        // **Open, with what it means for the result** (rondo#497): a count
        // alone told a person nothing about whether it mattered.
        <details id="fence-calls" class="group" open>
          <summary class="flex cursor-pointer list-none flex-wrap items-center gap-x-2 text-body leading-6 select-none [&::-webkit-details-marker]:hidden">
            {chevron()}
            <span class="font-semibold">{wording.fenceHeading}</span>
            <span class="text-muted-foreground">{count}</span>
          </summary>
          <p class="mt-1 text-body leading-5 text-muted-foreground">{wording.fenceMeaning}</p>
          <ul class="mt-2 divide-y divide-border/70 rounded-md border border-border/70">
            {denials.slice(0, LIST_LIMIT).map((denial) =>
              typeof denial === "object" && denial !== null && !Array.isArray(denial) ? (
                <li class="px-3 py-1.5 font-mono text-id leading-5 wrap-anywhere" lang="">
                  {denialLine(denial)}
                </li>
              ) : (
                <li class="px-3 py-1.5 text-body leading-5 text-muted-foreground">
                  {wording.denialUnreadable}
                  <span class="block font-mono text-id text-faint wrap-anywhere" lang="">
                    {JSON.stringify(denial)}
                  </span>
                </li>
              ),
            )}
            {denials.length > LIST_LIMIT ? (
              <li class="px-3 py-1.5 text-meta text-faint">
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
 * What a reader looked at and what it did not, beside what it found (rondo#69):
 * the store's {@link readingReach}, said in the page's language. The terminal
 * says the same fact in its own English lines (`readingCoverage`), so the two
 * surfaces still say one thing about one drafter.
 *
 * **Drawn open, and not a fold** (`D-0082` rule 7, rondo#317). It was a quiet
 * `<details>`, which put the one sentence that bounds a verdict behind an open.
 * rondo#69 exists because *read and nothing raised* was printed over a worker's
 * own account of not having been able to run the verification at all, and what
 * a person takes from a clean pill is that a check happened; `readingCoverage`
 * is what says which check did not. That is needed to press honestly rather
 * than to look at afterwards, which is the line rule 7 draws. `rondo answer`'s
 * report already prints these lines beside the verdict
 * (`src/refrain/interpreter.ts`) -- the same statement about the same drafter,
 * which is what the function was factored out for -- and the page was where it
 * was still shut.
 *
 * The label the summary carried stays, as the line above the sentences.
 *
 * **`who` names whose statement this is** (D-0104, rondo#410): on the checks
 * card the worker's own run now sits above these sentences, and *it built
 * nothing, ran nothing* said under a bare *it* was read as being about the lap
 * (lap 12: *tests were not run*, over a green `npm run verify` in the
 * transcript). The label's own words are unchanged; the name goes in front.
 */
function coverageLine(id: string, wording: Chrome, drafter: string, who: string | null = null) {
  return (
    <div id={id} class="mt-2">
      <p class="text-meta leading-5 text-faint">
        {who === null ? null : <span class="font-medium text-muted-foreground">{who} · </span>}
        {wording.whatItRead}
      </p>
      <p class="mt-1 text-meta leading-5 text-muted-foreground">
        {wording.readingCovered(readingReach(drafter))}
      </p>
    </div>
  );
}

/**
 * rondo's own reason for something the person was told in their own terms
 * (D-0076 rule 4.5): one closed fold beside that sentence, labelled for
 * whoever maintains rondo on this machine, holding the reason as rondo
 * received it. The person is never asked to open it.
 */
export function maintainerFold(id: string, wording: Chrome, reason: string) {
  return (
    <details id={id} class="group">
      <summary class="flex cursor-pointer list-none items-center gap-1.5 text-meta leading-5 text-faint select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
        {chevron()}
        {wording.forMaintainer}
      </summary>
      <p class="mt-1 pl-5 text-meta leading-5 text-muted-foreground wrap-anywhere" lang="en">
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
      <li class="px-3 py-1.5 text-meta text-faint">{wording.moreRows(count - LIST_LIMIT)}</li>
    ) : null;
  const ROWS = "divide-y divide-border/70 rounded-md border border-border/70";
  return (
    <section id="changed" class={CARD}>
      <div class="flex flex-wrap items-baseline gap-x-2">
        <h3 class={CARD_HEADING}>{wording.workHeading}</h3>
        <span class="font-mono text-id text-faint" title={record.workspace ?? ""}>
          {record.topicBranch ?? ""}
        </span>
        {work?.kind === "read" ? (
          <span class="font-mono text-id text-faint">{wording.changedAgainst(work.baseRef)}</span>
        ) : null}
      </div>
      {work === null ? (
        <p class="mt-1 text-body leading-5 text-muted-foreground">{wording.changedNoRange}</p>
      ) : work.kind !== "read" ? (
        // git's own line -- the command and what it wrote to stderr -- is
        // rondo's reason and not the person's, so it is folded (D-0076 rule 4.5).
        <>
          <p class="mt-1 text-body leading-5 text-muted-foreground">{wording.changedUnreadable}</p>
          {maintainerFold("changed-reason", wording, work.reason)}
        </>
      ) : (
        <div class="mt-2 space-y-2">
          {work.commits.length === 0 ? (
            <p class="text-body leading-5 text-muted-foreground">{wording.noCommits}</p>
          ) : (
            <ul class={`commits ${ROWS}`}>
              {work.commits.slice(0, LIST_LIMIT).map((commit) => (
                <li class="flex gap-3 px-3 py-1.5 text-body leading-5">
                  <span class="shrink-0 font-mono text-id leading-5 text-faint">
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
            <p class="text-body leading-5 text-muted-foreground">{wording.noFiles}</p>
          ) : (
            <ul class={`files ${ROWS}`}>
              {work.files.slice(0, LIST_LIMIT).map((file) => (
                <li class="flex items-baseline gap-3 px-3 py-1.5">
                  <span class="min-w-0 flex-1 font-mono text-id leading-5 wrap-anywhere">
                    {file.path}
                  </span>
                  {file.added === null || file.deleted === null ? (
                    <span class="shrink-0 text-id text-faint">{wording.binaryFile}</span>
                  ) : (
                    <span class="shrink-0 font-mono text-id tabular-nums">
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
 * *Beyond the files this work keeps* -- what the gate found when it compared
 * the paths this lap changed with the files its work keeps to itself (D-0073
 * rule 5, rondo#294).
 *
 * **It is here because it was only ever in the terminal.** The comparison has
 * been part of the conductor's report since rondo#293, and a report is printed
 * by the command line and by nothing else: a person who starts work from this
 * page and answers it from this page never saw a collision the comparison
 * found, and met it when the two changes were merged instead -- which is the
 * thing the comparison is for.
 *
 * **Nothing is drawn where there is nothing to say.** *Inside* is the ordinary
 * case and a card announcing it would be one more thing to read at the one
 * place on this page where reading matters. The two findings are drawn
 * together where both stand: they are different facts, and the collision is
 * not softened by the other.
 *
 * **The collision is marked and the other is not** (`D-0076` rule 4.1's
 * severities): one is work about to clash with work, the other is a note that
 * the files kept were left as they were.
 */
function reachView(wording: Chrome, reach: ClaimReach | undefined) {
  if (reach === undefined || reach.kind === "inside") {
    return null;
  }
  return (
    <section id="reach" class={CARD}>
      <h3 class={CARD_HEADING}>{wording.reachHeading}</h3>
      {reach.kind === "unread" ? (
        <>
          <p class="mt-1 text-body leading-5 text-muted-foreground">{wording.reachUnread}</p>
          {maintainerFold("reach-reason", wording, reach.reason)}
        </>
      ) : (
        <>
          {reach.collided.length === 0 ? null : (
            <p class="mt-1 text-body leading-5 wrap-anywhere text-fail">
              {wording.reachCollided(reach.collided)}
            </p>
          )}
          {reach.unheld.length === 0 ? null : (
            <p class="mt-1 text-body leading-5 wrap-anywhere text-muted-foreground">
              {wording.reachUnheld(reach.unheld)}
            </p>
          )}
        </>
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
export function checksPill(wording: Chrome, reading: LapReading | null, workGone = false) {
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
export function modelPill(wording: Chrome, reading: LapReading) {
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
      <p class="mt-1 text-body leading-5 text-muted-foreground">{wording.readingNotTaken}</p>
      <details id={id} class="group mt-1">
        <summary class="flex cursor-pointer list-none items-center gap-1.5 text-meta leading-5 text-faint select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
          {chevron()}
          {wording.whyNotTaken}
        </summary>
        <p class="mt-1 pl-5 text-meta leading-5 wrap-anywhere text-muted-foreground">
          {reason ?? wording.noReasonRecorded}
        </p>
      </details>
    </>
  );
}

/**
 * What the worker itself ran, as rondo read it off the lap's recorded commands
 * (D-0104, rondo#410): the last test run's command and the runner's own counts,
 * or the plain fact that there is no readable record, or that none of the
 * recorded commands printed a summary rondo reads. Drawn whatever the reviewer
 * said or did not say, because the worker's run does not depend on the
 * reviewer; drawn *above* the reviewer's account so that the reviewer's *ran
 * nothing* is read as being about the reviewer. The source line says both
 * where the figure came from and that rondo read it rather than ran it, which
 * is the fact D-0029 rule 9 keeps true.
 */
function workerRanView(wording: Chrome, record: IterationRecord) {
  const runs = workerRuns(record.lapCommands);
  return (
    <div id="checks-worker" class="mt-1">
      <p class="text-meta leading-5 text-faint">{wording.workerRan}</p>
      {runs.kind === "unrecorded" ? (
        <p class="mt-1 text-body leading-5 text-muted-foreground">{wording.workerRanUnrecorded}</p>
      ) : runs.kind === "none" ? (
        <p class="mt-1 text-body leading-5 text-muted-foreground">
          {wording.workerRanNone(runs.commandCount)}
        </p>
      ) : (
        <>
          <p class="mt-1 font-mono text-id leading-5 wrap-anywhere" lang="">
            {runs.last.command}
          </p>
          <p class="mt-1 text-body leading-5">
            {wording.workerCount("passed", runs.last.passed)}
            <span class="text-faint"> · </span>
            <span class={runs.last.failed > 0 && runs.supersededBy === null ? "text-fail" : ""}>
              {wording.workerCount("failed", runs.last.failed)}
            </span>
            <span class="text-faint"> · </span>
            {wording.workerCount("skipped", runs.last.skipped)}
            {runs.earlier > 0 ? (
              <span class="text-muted-foreground"> {wording.workerRanEarlier(runs.earlier)}</span>
            ) : null}
          </p>
          {runs.last.isError ? (
            <p
              class={`mt-1 text-body leading-5 ${runs.supersededBy === null ? "text-fail" : "text-muted-foreground"}`}
            >
              {wording.workerRanErrored}
            </p>
          ) : null}
          {runs.supersededBy === null ? null : (
            <>
              <p class="mt-1 text-body leading-5">
                {wording.workerRanSuperseded(runs.supersededBy.index)}
              </p>
              <p class="mt-1 font-mono text-id leading-5 wrap-anywhere" lang="">
                {runs.supersededBy.command}
              </p>
            </>
          )}
          <p class="mt-1 text-meta leading-5 text-muted-foreground">
            {wording.workerRanSource(runs.last.index)}
          </p>
        </>
      )}
    </div>
  );
}

/**
 * `workGone` is decided by the caller rather than here (rondo#237): the bar
 * pins this same verdict above the button, and one judgement drawn in two
 * places must be made once or the two will disagree.
 */
function checksView(
  wording: Chrome,
  record: IterationRecord,
  reading: LapReading | null,
  workGone: boolean,
) {
  return (
    <section id="checks" class={`${CARD} scroll-mt-16`}>
      <div class="flex items-center gap-2">
        <h3 class={CARD_HEADING}>{wording.checksHeading}</h3>
        {checksPill(wording, reading, workGone)}
      </div>
      {workerRanView(wording, record)}
      {reading === null ? (
        <p class="mt-1 text-body leading-5 text-muted-foreground">{wording.checksNone}</p>
      ) : reading.verdict === "unavailable" ? (
        notTakenView(wording, "checks-not-taken", reading.unavailableReason)
      ) : (
        <>
          {workGone ? (
            <p class="mt-1 text-body leading-5 text-wait-ink">{wording.checksWorkUnreadable}</p>
          ) : null}
          {reading.findings.length === 0 ? null : (
            <ul class="finding-rows mt-2 space-y-1.5" lang="en">
              {reading.findings.map((finding) => (
                <li class="finding flex gap-2 text-body leading-5">
                  <span aria-hidden="true" class="text-wait">
                    •
                  </span>
                  <span class="min-w-0 wrap-anywhere">{finding}</span>
                </li>
              ))}
            </ul>
          )}
          <p class="mt-2 text-meta leading-5 text-muted-foreground">
            {wording.checksCounted(
              reading.evidence?.commitCount ?? 0,
              reading.evidence?.fileCount ?? 0,
            )}
          </p>
          {coverageLine("checks-coverage", wording, reading.drafter, wording.checksReader)}
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
export function modelPendingOnPage(
  readings: readonly LapReading[],
  model: LapReading | null,
): boolean {
  if (model === null) {
    return true;
  }
  const modelTip = model.evidence?.tipCommit;
  const checksTip = reviewedReading(readings)?.evidence?.tipCommit;
  return modelTip !== undefined && checksTip !== undefined && modelTip !== checksTip;
}

/** What a *take the review again* press posts (rondo#500, D-0138 rule 3). */
interface RetakePress {
  readonly token: string;
  readonly iterationId: string;
  readonly requestMessageId: string;
}

/** A graded finding's severity pill, or nothing for an ungraded one. */
function severityOf(wording: Chrome, graded: GradedFinding | undefined) {
  return graded === undefined
    ? null
    : pill(SEVERITY_TONE[graded.severity], wording.severityWord(graded.severity), "severity mt-px");
}

/**
 * English-held text with its *read in my language* press or its reading
 * (rondo#490), as markup for this half of the page; `plain` where the page is
 * English and there is nothing to offer.
 */
export function held(
  wording: Chrome,
  reads: HeldReads | null,
  text: string,
  className: string,
  plain: () => unknown,
) {
  return reads === null ? plain() : raw(heldMarkup({ wording, reads, text, className }));
}

function modelView(
  wording: Chrome,
  reading: LapReading | null,
  due: boolean,
  reload: string,
  retake: RetakePress | null = null,
  reads: HeldReads | null = null,
) {
  const later = (note: string) => (
    <p class="mt-1 text-body leading-5 text-muted-foreground">
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
          <span class="ml-auto font-mono text-id text-faint" title={reading.drafter}>
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
            <>
              {notTakenView(wording, "model-not-taken-why", reading.unavailableReason)}
              {retake === null ? null : (
                <form
                  id={`retake-review-${retake.iterationId}`}
                  method="post"
                  action={`/retake-review?lang=${encodeURIComponent(wording.lang)}`}
                  class="mt-2"
                >
                  <input type="hidden" name="token" value={retake.token} />
                  <input type="hidden" name="iteration" value={retake.iterationId} />
                  <input type="hidden" name="request" value={retake.requestMessageId} />
                  <button
                    type="submit"
                    data-busy={wording.retakeReviewBusy}
                    class={`${SECONDARY} h-8 px-3 text-meta`}
                  >
                    {wording.retakeReviewAction}
                  </button>
                </form>
              )}
            </>
          ) : (
            <>
              {reading.findings.length === 0 ? null : (
                <ul class="mt-2 divide-y divide-border/70">
                  {reading.findings.map((text, index) => {
                    const graded = reading.graded?.[index];
                    return (
                      <li class="model-finding py-2 first:pt-1 last:pb-0">
                        {/* A `div` where the finding is held: its fold is not phrasing content. */}
                        {reads === null ? (
                          <p class="flex items-start gap-2 text-body leading-5">
                            {severityOf(wording, graded)}
                            <span class="min-w-0 wrap-anywhere" lang="">
                              {text}
                            </span>
                          </p>
                        ) : (
                          <div class="flex items-start gap-2 text-body leading-5">
                            {severityOf(wording, graded)}
                            {raw(heldMarkup({ wording, reads, text, className: "wrap-anywhere" }))}
                          </div>
                        )}
                        {graded === undefined ? null : (
                          <p class="mt-1 flex flex-wrap items-center gap-1 text-id leading-4">
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
              {coverageLine("model-coverage", wording, reading.drafter)}
            </>
          )}
        </>
      )}
    </section>
  );
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
export function standingFindings(
  checks: LapReading | null,
  model: LapReading | null,
): readonly string[] {
  return [...(checks?.findings ?? []), ...(model?.findings ?? [])];
}

/** A closing fix, as the right face's card says it (D-0098 rules 5.3 and 8.6). */
export interface ClosingShown {
  /** The commit the reviewer last read, which is not this lap's tip. */
  readonly readCommit: string;
  /** The findings the lap answers, in the reviewer's words. */
  readonly findings: readonly string[];
  /** The scope's round limit, or null where no approval reads. */
  readonly rounds: number | null;
  /** The pull request, where it was published: the commits are on it. */
  readonly pullRequestUrl: string | null;
}

/**
 * The closing fix `record` is, or null (D-0098 rule 5, D-0103 rule 5.4): the
 * reading its predecessor's reviewer last made, and the findings of it the
 * lap answers, read back by index from that reading.
 */
export async function closingShown(
  ports: WebPorts,
  record: IterationRecord,
  rounds: number | null,
  pullRequestUrl: string | null,
): Promise<ClosingShown | null> {
  const closing = await ports.store.closingLapOf(record.id);
  if (closing === null) {
    return null;
  }
  const read = (await ports.store.readingsFor(closing.predecessorId)).find(
    (reading) =>
      isModelReadingDrafter(reading.drafter) && reading.readAtMs === closing.readingReadAtMs,
  );
  return {
    readCommit: closing.readTipCommit,
    findings: closing.findings.flatMap((at) => read?.findings[at] ?? []),
    rounds,
    pullRequestUrl,
  };
}

/**
 * **One card, not a standing finding** (D-0098 rule 8.6): the fix merges
 * bytes no reviewer read, and says so beside the material, so the plain merge
 * press stays. Each finding it answers is quoted; the commit the reviewer last
 * read leads to the pull request's copy of it.
 */
function closingView(wording: Chrome, closing: ClosingShown, reads: HeldReads | null = null) {
  const short = closing.readCommit.slice(0, 7);
  return (
    <section id="closing" class={CARD}>
      <h3 class={CARD_HEADING}>{wording.closingHeading}</h3>
      <p class="text-body leading-6">
        {wording.closingSaid(closing.findings.length, short, closing.rounds)}
      </p>
      {closing.findings.length === 0 ? null : (
        <ul class="mt-1 list-disc pl-5 text-body leading-6" lang="">
          {closing.findings.map((finding) => (
            <li>{held(wording, reads, finding, "", () => finding)}</li>
          ))}
        </ul>
      )}
      {closing.pullRequestUrl === null ? null : (
        <p class="mt-1 text-meta leading-5">
          <a
            href={`${closing.pullRequestUrl}/commits/${closing.readCommit}`}
            class="text-link underline-offset-2 hover:underline"
          >
            {short}
          </a>
        </p>
      )}
    </section>
  );
}

/**
 * **The material for this confirmation** (D-0083 rule 5): the worker's report, what
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
export function materialView(
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
  /** The closing fix this lap is, or null (D-0098 rule 8.6). */
  closing: ClosingShown | null = null,
  /** The token for the *take the review again* press, or null where none may be drawn. */
  retakeToken: string | null = null,
  reads: HeldReads | null = null,
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
            <h3 class={CARD_HEADING}>{wording.reportHeading}</h3>
            {material.why === null ? (
              <p class="text-body leading-5 text-muted-foreground">{wording.reportNotRead}</p>
            ) : (
              // **Shut, as the thread's reports are** (rondo#444, D-0115): the
              // worker writes it for the gate, often not in the page's
              // language, with its branch and markdown, so it is kept byte for
              // byte under a fold labelled in the person's words and not
              // summarised: a summary would be a model's words, not the worker's.
              <details class="group mt-1">
                <summary class="flex cursor-pointer list-none items-center gap-2 text-meta leading-5 text-muted-foreground select-none [&::-webkit-details-marker]:hidden">
                  {chevron()}
                  {wording.reportFold}
                </summary>
                {held(
                  wording,
                  // Only where the worker was not asked to write in this page's language.
                  materialLanguage(record) === wording.lang ? null : reads,
                  material.why,
                  "mt-1 text-body leading-6 wrap-anywhere whitespace-pre-wrap",
                  () => (
                    <p
                      class="mt-1 text-body leading-6 wrap-anywhere whitespace-pre-wrap"
                      lang={materialLanguage(record)}
                    >
                      {material.why}
                    </p>
                  ),
                )}
              </details>
            )}
          </section>
          {changedView(wording, record, material.work)}
          {reachView(wording, material.reach)}
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
      {closing === null ? null : closingView(wording, closing, reads)}
      {checksView(wording, record, checks, workGone)}
      {modelView(
        wording,
        model,
        modelDue,
        reload,
        retakeToken === null || record.status !== "awaiting_human" || !retakeOffered(readings)
          ? null
          : {
              token: retakeToken,
              iterationId: record.id,
              requestMessageId: record.requestMessageId,
            },
        reads,
      )}
      <p class="note text-meta leading-5 text-faint">{wording.readingsNote}</p>
    </div>
  );
}
