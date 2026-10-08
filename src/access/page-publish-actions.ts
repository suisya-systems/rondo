/**
 * The page's publish press and the scoped publish the resident host runs
 * (rondo#570): the plan a page shows before the press, the press itself, and the
 * single-flight map both share.
 *
 * Moved out of `cli.ts` unchanged; the plan (`publishPlanFor`) and everything
 * `rondo publish` shares with the page still live there.
 */
import { closeRun, showGate, startContinuo } from "../continuo/invoker.js";
import { drafterRow } from "../continuo/roles.js";
import { contentDigest } from "../store/plan.js";
import type { IterationRecord } from "../store/records.js";
import {
  type AdvisoryRecord,
  type IterationStore,
  openAdvisoryRecord,
  type RecordOutcome,
} from "../store/sqlite.js";
import {
  approvedActor,
  lapReport,
  notOpenNow,
  type PublishAsked,
  type PublishBodyComposing,
  type PublishBodyLegs,
  type PublishPlan,
  publishPlanFor,
  recordingPublishBody,
  relayFailure,
  reviewBlockSentence,
  say,
} from "./cli.js";
import { reportToRequest } from "./conductor.js";
import { openPullRequest, pushTopicBranch, runDrafter } from "./forge.js";
import { redactRemoteUrl } from "./forge-preflight.js";
import { releasePublished } from "./merge.js";
import type { PublishBlock, PublishShown } from "./page/contract.js";
import { recordedPublishBody } from "./publish-body.js";
import type { Published, PublishInput, PublishRefusal } from "./web-app.js";

/**
 * The page's preview: this lap's body, composed once and recorded (rondo#290).
 *
 * **The composing is here and not in the press**, and the row is what joins
 * them: D-0059 section 5a's Q1 makes this screen a precondition of the press, so
 * the run that draws the screen is the run there is, and the press publishes what
 * it recorded. continuo is started only where a body has to be composed -- a lap
 * whose row is already written is drawn without spawning anything.
 *
 * **A publish under a scope composes through here too**, for the same reason read
 * the other way: no screen was drawn, so the publish itself is the one run there
 * is, and it records what it composed for the page to draw afterwards.
 *
 * **The two legs arrive as one value**, the way the terminal's do
 * ({@link commandPublishBody}): a caller that has a report and a drafter already
 * to hand hands them over, and everything from the recorded row to the row this
 * writes is then the same code on both routes rather than a second copy of it.
 * The default is the page's own -- a continuo started where a body has to be
 * composed, and `./forge.ts`'s drafter.
 */
function pagePublishBody(
  environment: Readonly<Record<string, string | undefined>>,
  record: Pick<AdvisoryRecord, "recordPublishBody" | "publishBodyFor">,
  lap: IterationRecord,
  legs: PublishBodyLegs | null,
): PublishBodyComposing | null {
  return recordingPublishBody(
    record,
    lap,
    legs ?? {
      report: async () => {
        const startup = await startContinuo(environment);
        return startup.kind === "refused"
          ? null
          : await lapReport(async (request) => await showGate(startup.continuo, request), lap);
      },
      runDrafter: async (document) => await runDrafter(drafterRow(), document),
    },
  );
}

/**
 * The page's press: the body the preview recorded, and nothing composed
 * (rondo#290). Null for a lap that records no gate, which has no row to find.
 *
 * **No row is no body, and not a body saying there is no row.** A press reaches
 * this where nothing ever recorded one -- a preview whose row would not write --
 * and what {@link publishBodyOnce} answers in that same case is null too. The two
 * surfaces therefore render one and the same body, which the digest the press
 * compares against the screen requires of them.
 *
 * **A publish under a scope does not come through here**, because it has no
 * screen to agree with: it composes through {@link pagePublishBody} like a
 * preview does, and records what it composed.
 */
function pressedPublishBody(
  record: Pick<AdvisoryRecord, "publishBodyFor">,
  lap: IterationRecord,
): PublishBodyComposing | null {
  if (lap.gateId === null) {
    return null;
  }
  const subject = { iterationId: lap.id, gateId: lap.gateId };
  return async () => await recordedPublishBody(record, subject);
}

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
  /**
   * Where the body's English is composed and recorded (rondo#290): the one run
   * of it, because this is the screen the press is pressed from. Null composes
   * nothing, which is what a caller that only wants the plan's other fields
   * passes.
   */
  body: Pick<AdvisoryRecord, "recordPublishBody" | "publishBodyFor"> | null = null,
  /**
   * How that composing reaches the lap's report and the drafter
   * ({@link PublishBodyLegs}). Null is the page's own pair: a continuo started
   * where a body has to be composed, and `./forge.ts`'s drafter.
   */
  legs: PublishBodyLegs | null = null,
): Promise<PublishShown> {
  const planned = await publishPlanFor(
    record,
    asked,
    environment,
    store,
    thread,
    body === null ? null : pagePublishBody(environment, body, record, legs),
  );
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

/** A publish rondo makes under a scope, and no person's press (rondo#470). */
export interface ScopedPublish {
  readonly scopeId: string;
  /**
   * The consumption row of one leg, written right before it runs -- claim,
   * then act (D-0042) -- and asking the scope again first: one that expired
   * or was replaced while git and the forge were read authorises nothing.
   */
  readonly claim: (actKind: "push_branch" | "open_pull_request") => Promise<RecordOutcome>;
}

/**
 * **Publish inside a scope** (rondo#470, D-0126 part 2): the press's own
 * {@link publishPage}, in the approver's name, with nothing shown and nothing
 * overruled. Every refusal of the press holds -- uncommitted work (D-0060),
 * an unreadable `git status` (D-0099) and the review's verdict, which only a
 * person's `--despite-review` or second press passes.
 */
export async function publishUnderScope(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  approver: string,
  asked: PublishAsked,
  iterationId: string,
  scoped: ScopedPublish,
): Promise<Published> {
  if (publishing.has(iterationId)) {
    return {
      ok: false,
      why: "publishRefusedStillRunning",
      note: `a publish of '${iterationId}' is already running`,
    };
  }
  // No digest is this sentinel, so a press never joins it and is refused as running.
  const input = { iterationId, shown: "(under scope)", despiteReview: false };
  const running = publishPage(environment, store, storePath, approver, asked, input, scoped);
  publishing.set(iterationId, { running, shown: input.shown, despiteReview: false });
  try {
    return await running;
  } finally {
    publishing.delete(iterationId);
  }
}

async function publishPage(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  approver: string,
  asked: PublishAsked,
  input: PublishInput,
  scoped: ScopedPublish | null = null,
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
  const advisory = openAdvisoryRecord(storePath);
  const planned = await publishPlanFor(
    record,
    asked,
    environment,
    store,
    advisory,
    // **A press reads; a publish under a scope composes** (rondo#290). The
    // press's body is inside the digest it carries back from the screen, so a
    // second model answer here would refuse every press -- it reads the row the
    // preview recorded and nothing else. A publish under a scope
    // (`publishUnderScope`) has no screen behind it: its `shown` is a sentinel
    // and the comparison below is skipped, so there is nothing for a composing
    // to disagree with. Composing there is what keeps rondo's own publishes from
    // being the one route that reaches a forge with no English account of the
    // lap's report in the body.
    scoped === null
      ? pressedPublishBody(advisory, record)
      : pagePublishBody(environment, advisory, record, null),
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
  // Under a scope no screen was shown: what is published is what is read now.
  if (scoped === null && publishShownDigest(plan) !== input.shown) {
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
  const unclaimed = await claimLeg(scoped, "push_branch");
  if (unclaimed !== null) {
    return unclaimed;
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
  // **Where the push went, recorded before the next leg** (rondo#286, D-0153
  // rule 1): the landing reading reads the forge rondo pushed to, and a
  // publish whose pull request fails pushed all the same.
  await store.markPublishedRemote(record.id, plan.remote, Date.now());
  // A conflict fix opens nothing: the pull request it fixes is already open
  // (rondo#417, D-0105), and the push above moved its head.
  const openUnclaimed = plan.updates === null ? await claimLeg(scoped, "open_pull_request") : null;
  if (openUnclaimed !== null) {
    return openUnclaimed;
  }
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
  // gh prints the new pull request's URL as the last line of its stdout.
  const pullRequestUrl = opened.stdout.trim().split("\n").at(-1) || null;
  // D-0114: the pull request is open, so the line's files are free for other
  // work, whatever the run close below answers.
  say(await releasePublished(store, record.id, pullRequestUrl, Date.now()));
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
    {
      kind: "published",
      pullRequestUrl,
      ...(plan.updates === null ? {} : { onto: plan.updates.onto }),
      ...(scoped === null ? {} : { underScope: scoped.scopeId }),
    },
    Date.now(),
  );
  return { ok: true, note: "" };
}

/** A scoped publish's claim of one leg: null where it is claimed, or where no scope is involved. */
async function claimLeg(
  scoped: ScopedPublish | null,
  actKind: "push_branch" | "open_pull_request",
): Promise<Published | null> {
  if (scoped === null) {
    return null;
  }
  const claimed = await scoped.claim(actKind);
  return claimed.kind === "recorded"
    ? null
    : {
        ok: false,
        why: "publishRefusedChanged",
        note: `rondo did not ${actKind === "push_branch" ? "push" : "open the pull request"}: ${claimed.reason}`,
      };
}
