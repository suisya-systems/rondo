/**
 * The resident host's composition root (rondo#570): `rondo web`, which serves
 * the operator page and wires every host that runs beside it in this one
 * process -- the drafter, reviser, gate, checks, triage, publish, merge, lost
 * lap and order-tick hosts.
 *
 * Moved out of `main` in `cli.ts` unchanged; `main` still decides when it is
 * dispatched.
 */
import { readLapLog } from "../continuo/transcript.js";
import { readRunPlan } from "../refrain/plan.js";
import { isQuestion } from "../store/records.js";
import { asRefusal, type IterationStore, openAdvisoryRecord } from "../store/sqlite.js";
import { checksHost, continuoChecksReader } from "./checks-host.js";
import {
  APPROVER_ENV,
  approvedActor,
  DEFAULT_REMOTE,
  DEFAULT_WEB_PORT,
  hostPolicyOf,
  hostWorkers,
  NOTIFIER_ENV,
  operatorLanguage,
  type PublishAsked,
  refuse,
  say,
  setAfterGateReading,
  transcriptPort,
} from "./cli.js";
import type { ParsedCommand } from "./cli-parse.js";
import { endLost, issuesClosedOver, readHolder } from "./conductor.js";
import { draftedStartReadiness } from "./drafted-start.js";
import { approvedSplits } from "./drafted-view.js";
import { drafterHost } from "./drafter-host.js";
import { explainerHost } from "./explainer/host.js";
import { flowHost } from "./flow-host.js";
import {
  listOpenIssues,
  readChangedPaths,
  readCommitsBetween,
  readIssueFromForge,
  readLanding,
  readRepositoryPaths,
  rerunFailedJobs,
  runDrafter,
  stoppedShort,
} from "./forge.js";
import { forgeHost } from "./forge-preflight.js";
import { gateHost } from "./gate-host.js";
import { bareIssueRepository, issueReader } from "./issue-read.js";
import { lostLapHost, pidAlive, thisDriver } from "./lost-laps.js";
import { continuoWorkspaceRemover, mergeOnGreen, mergePress, scopedAuthority } from "./merge.js";
import { heldPlans, requestRepository } from "./model-draft/host.js";
import { orderHost } from "./order-host.js";
import { unanswerable } from "./page/triage.js";
import {
  addRepositoryFromPage,
  answerFromPage,
  answerOnceReserved,
  answerUnderScope,
  conflictFixFromPage,
  holdsFromPage,
  lapStartedAgainAt,
  pageMaterial,
  recordSetupPlansFromPage,
  releaseFromPage,
  restartLostFromPage,
  retakeReviewFromPage,
  reviseFromPage,
  reviseUnderScope,
  startsByItself,
} from "./page-actions.js";
import { publishFromPage, publishingForPage, publishUnderScope } from "./page-publish-actions.js";
import {
  heldStartPort,
  pauseGoalScopeFromPage,
  raiseScopeFromPage,
  recordDraftedScopeFromPage,
  recordGoalScopeFromPage,
  recordScopeFromPage,
  scopedStartPress,
  startSplitFromPage,
} from "./page-scope-actions.js";
import { publishHost } from "./publish-host.js";
import { notifierAt, reachThePerson, recordTabNotice } from "./reach.js";
import { readIn } from "./read-in.js";
import { READING_REMOTE } from "./review.js";
import { reviseDrafterHost } from "./revise-draft/host.js";
import { setupPlanFiles } from "./setup-files.js";
import { triageHost } from "./triage-host.js";
import {
  AddRepositoryPort,
  AnswerPort,
  HoldsPort,
  MergePort,
  newDraftId,
  newIterationId,
  PolicyPort,
  PublishPort,
  ReadInPort,
  ReleasePort,
  RevisePort,
  SayPort,
  ScopePort,
  serveOperatorPage,
  TriagePort,
} from "./web-app.js";
import { chromeFor } from "./wording.js";

/**
 * `rondo web`: the resident host -- the operator page and every host that runs
 * beside it in this one process. Its dispatch position, and why, is in `main`.
 */
export async function serveWeb(
  parsed: ParsedCommand,
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
): Promise<number> {
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
  const record = openAdvisoryRecord(storePath);
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
    // one of the held ones would record the wrong issue for good. No naming
    // travels with it: nothing here disagrees with anything, the repository
    // the request names is simply not one this store holds a plan for.
    bareRepository: async (requestMessageId, namedAtMs) =>
      (await requestRepository({ store, record, now: Date.now }, requestMessageId)).work.kind ===
      "unheld"
        ? { disputed: true, namings: [] }
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
  // **A request whose next step is the person's press before anything is
  // drafted** (D-0090 rule 1, D-0191 rules 2 and 3): a repository to add, or a
  // store holding no plan at all.
  const awaitsPerson = async (id: string): Promise<boolean> => {
    const where = await requestRepository({ store, record, now: Date.now }, id);
    return where.work.kind === "unheld" || where.planless;
  };
  const drafter = drafterHost({
    store,
    record,
    runDrafter,
    listPaths: readRepositoryPaths,
    now: Date.now,
    mintId: newDraftId,
    language: selected.tag,
    log: say,
    issuesUnread: issues.unreadUnderway,
    // **Nothing is drafted in a repository the work is not in** (rondo#383,
    // D-0090 rule 1): a request naming one rondo holds no plan for waits for
    // the person to add it from the page.
    // **Nor anything while rondo holds no plan at all** (D-0191 rule 2): the
    // request waits for the press that records setup's plan.
    awaitsRepository: async (id) => await awaitsPerson(id),
    // **An answer to a stop whose lap is started again is not drafted**
    // (D-0149, D-0139): the start is its work.
    startsAgain: async (ask) => (await lapStartedAgainAt(store, record, ask)) !== null,
  });

  // **And the thread explainer** (D-0177): a person's question answered once,
  // kicked when one is recorded and on the same rescan.
  const explainer = explainerHost({
    store,
    record,
    // What the list's *your turn* reads, for a question across every request (D-0189).
    draftsOwed: () => drafter.owed(),
    unheld: async (id: string) => await awaitsPerson(id),
    triageRepositories: async () => await triageRepositories(),
    runDrafter,
    now: Date.now,
    mintId: newDraftId,
    language: selected.tag,
    log: say,
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
  // One continuo for both close-outs, the press's and the forge's merge.
  const removeWorkspace = continuoWorkspaceRemover(environment);
  const checks = checksHost({
    store,
    record,
    readChecks: continuoChecksReader(environment),
    readCommits: readCommitsBetween,
    removeWorkspace,
    pressing,
    // D-0126: a lap whose scope includes the merge is merged on green, through
    // the press's own path and holding the same `pressing` set.
    mergeOnGreen: async (iterationId, head) => {
      const merged = await mergeOnGreen(
        { store, record, now: Date.now, pressing, removeWorkspace },
        iterationId,
        head,
      );
      // A merge closed out may be what the goal's next request waits on
      // (rondo#469), and its release what a held start waits on (rondo#284).
      flow?.kick();
      order?.kick();
      return merged;
    },
    // rondo#551: the first red on a head re-runs its failed Actions jobs once,
    // under the approval a merge on green is made under, whose claim it
    // does not spend: a re-run changes no code.
    rerun: {
      authorised: async (iterationId) =>
        (await scopedAuthority({ store, record, now: Date.now }, iterationId, [
          "merge_default_branch",
        ])) !== null,
      rerunFailedJobs,
    },
    closedOut: () => flow?.kick(),
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
  // **And the order tick** (D-0098 rule 1.4, D-0127): each part of an
  // approved split starts once it can -- a part with `after` on its
  // predecessor's landing -- through the press's own path and in the
  // approver's name, so only where there is an approver the allowlist
  // accepts, the start press's own condition.
  const order =
    sender === null || "refusal" in sender
      ? null
      : orderHost({
          record,
          splits: async () => await approvedSplits({ record }),
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
              // **`READING_REMOTE` here as everywhere** (rondo#286, D-0153
              // rule 4): one remote this host reads landings from, whichever
              // path reads one, so the order tick and an admission refusal
              // cannot answer about one line two ways. A host started with
              // `--remote NAME` therefore settles no landing by itself and
              // says so; that is the stop rule 4 asks for.
              {
                store,
                readLanding,
                readChangedPaths,
                remote: READING_REMOTE,
                issuesClosed: issuesClosedOver(record),
              },
              lineageId,
              Date.now(),
            ),
          // Answered once the row is reserved (D-0109), as the press is, so
          // one pass starts two parts rather than waiting out the first lap.
          start: async (split, planIndex) => {
            const input = {
              iterationId: newIterationId(),
              requestMessageId: split.requestMessageId,
              scopeDecisionId: split.scopeDecisionId,
              proposalId: split.proposalId,
              planIndex,
            };
            const running = startSplitFromPage(
              environment,
              store,
              storePath,
              sender.actorId,
              bounds.policy,
              input,
            );
            // The lap has ended when its start settles: the flow may ask
            // for the goal's next request (rondo#469).
            const ended = (): void => flow?.kick();
            void running.then(ended, ended);
            return await answerOnceReserved(store, record, chromeFor(selected.tag), input, running);
          },
          // **And the person's own start that held files kept waiting**
          // (rondo#284).
          held: heldStartPort(
            environment,
            store,
            storePath,
            sender.actorId,
            record,
            chromeFor(selected.tag),
            bounds.policy,
          ),
          now: Date.now,
          log: say,
        });
  // **And lost laps** (D-0139, rondo#506): a lap whose rondo process and
  // `lap perform` child are both gone is ended, and started again by itself
  // or asked about -- read now, as this host starts, and on every minute.
  const lost = lostLapHost({
    store,
    record,
    end: async (iterationId, reason) =>
      await endLost({ store, now: Date.now }, iterationId, reason),
    byItself: async (lap) => await startsByItself(record, lap),
    restart:
      sender === null || "refusal" in sender
        ? null
        : async (lap) =>
            await restartLostFromPage(
              environment,
              store,
              storePath,
              sender.actorId,
              chromeFor(selected.tag),
              lap,
            ),
    words: chromeFor(selected.tag),
    host: thisDriver().driverHost,
    alive: pidAlive,
    now: Date.now,
    log: say,
  });
  // **And the flow** (D-0128 rule 5, rondo#469): under a goal scope a person
  // approved, the goal's next request is asked for here; the drafter drafts
  // it and the order tick above starts it. Only where the tick runs, since
  // nothing else would start what it asks for.
  const flow =
    order === null
      ? null
      : flowHost({
          store,
          record,
          policy: bounds.policy,
          // What it leaves in a request's thread -- a refused draft's note,
          // its stop -- is read by the person, so it is written in their
          // language (D-0055, D-0079, rondo#549).
          words: chromeFor(selected.tag),
          now: Date.now,
          log: say,
          // Its issue is read first; the drafter waits on the read.
          injected: () => {
            issues.kick();
            drafter.kick();
          },
        });
  // **And the organisation's answer at a gate** (D-0125 rule 6, rondo#467):
  // a lap whose gate would be approved automatically is approved under its
  // scope, on the tick and right after a model reading lands here.
  // **And publish inside a scope** (rondo#470, D-0126 part 2): an approved
  // lap whose scope includes the push and the pull request is published
  // through the press's own path, in the approver's name -- so only where
  // there is one the allowlist accepts, the press's own condition.
  const publisher =
    sender === null || "refusal" in sender
      ? null
      : publishHost({
          store,
          record,
          publish: async (iterationId, scoped) =>
            await publishUnderScope(
              environment,
              store,
              storePath,
              sender.actorId,
              asked,
              iterationId,
              scoped,
            ),
          // Its pull request open, the line's files are free (D-0114): a
          // start they held is attempted now, not on the minute (rondo#284).
          published: () => {
            checks.kick();
            order?.kick();
          },
          now: Date.now,
          log: say,
        });
  const gates = gateHost({
    store,
    record,
    answer: async (lap, delegation) => {
      const answered = await answerUnderScope(environment, store, storePath, lap, delegation);
      if (answered.kind === "delegated") {
        publisher?.kick();
      }
      return answered;
    },
    // **And the drafted change under a goal scope** (D-0145, rondo#517), on
    // the revise press's own condition: an approver the allowlist accepts.
    revise:
      sender === null || "refusal" in sender
        ? null
        : {
            send: async (lap, input) =>
              await reviseUnderScope(
                environment,
                store,
                storePath,
                sender.actorId,
                chromeFor(selected.tag),
                lap,
                input,
              ),
            hasRoom: async () => (await store.occupancy()).occupying < bounds.policy.maxOccupying,
            mintId: newIterationId,
          },
    words: chromeFor(selected.tag),
    now: Date.now,
    log: say,
  });
  setAfterGateReading(gates.kick);
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
    // A drafted scope is a turn once the page would offer it (rondo#534).
    draftsOwed: () => drafter.owed(),
    unheld: async (id: string) => await awaitsPerson(id),
  };
  // ponytail: a fixed one-minute rescan for messages and readings written
  // outside this process; a changedSince watch when that minute is felt.
  let rescan: ReturnType<typeof setInterval> | null = null;
  // **Only once the page is listening**: a second `rondo web` that cannot
  // bind its port reports failure, and must not have spent a draft first.
  const listening = (line: string): void => {
    say(line);
    if (rescan === null) {
      lost.kick();
      issues.kick();
      drafter.kick();
      explainer.kick();
      reviser.kick();
      checks.kick();
      triage.kick();
      order?.kick();
      gates.kick();
      publisher?.kick();
      flow?.kick();
      // **Reaching starts a minute in, and not in the burst above.** The
      // person who has just started rondo is looking at it this second, and
      // what was already waiting when the host was last stopped is on the
      // screen in front of them. One minute is not a policy about staleness;
      // it is the tick this process already has.
      rescan = setInterval(() => {
        lost.kick();
        issues.kick();
        drafter.kick();
        explainer.kick();
        reviser.kick();
        checks.kick();
        triage.kick();
        order?.kick();
        gates.kick();
        publisher?.kick();
        flow?.kick();
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
  const merging = mergePress({
    store,
    record,
    now: Date.now,
    pressing,
    removeWorkspace,
    readAgain: async () => {
      checks.kick();
      await checks.idle();
    },
  });
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
      // The drafts still to come, so the page waits for rondo's plan
      // before it offers a scope (rondo#495).
      draftsOwed: () => drafter.owed(),
      // Which repository a request's work runs in, and the press that adds
      // one it names and rondo does not hold (rondo#383, D-0090) -- on the
      // release press's condition, since the plan it records is the
      // approver's as setup's is. Added, the reader and the drafter look again.
      repositoryFor: async (id) => await requestRepository({ store, record, now: Date.now }, id),
      setupPlanFiles: () => setupPlanFiles(storePath).map((one) => one.file),
      addable: sender !== null && !("refusal" in sender),
      addRepository:
        sender === null || "refusal" in sender
          ? null
          : new AddRepositoryPort(async (input) => {
              // **No repository named is setup's plan** (D-0191 rule 2.2): the
              // same press, for a store that holds no plan at all.
              const added =
                input.repo === ""
                  ? await recordSetupPlansFromPage(
                      environment,
                      { store, record },
                      sender.actorId,
                      storePath,
                      input.requestMessageId,
                    )
                  : await addRepositoryFromPage(
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
            new AnswerPort(async (iterationId, body, claim) => {
              const answered = await answerFromPage(
                environment,
                store,
                storePath,
                approver,
                iterationId,
                body,
                claim,
              );
              // A person's approval publishes under its scope now, not on
              // the minute (D-0187), as rondo's own does above.
              if (answered.ok) {
                publisher?.kick();
              }
              return answered;
            }),
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
              async (message, answerOutcome, answerOption) => {
                // `asRefusal`: the person composed this id, so an id already
                // spoken for is the refusal it has always been.
                const outcome = asRefusal(
                  await record.recordThreadMessage({
                    messageId: message.messageId,
                    body: message.body,
                    authorKind: "operator",
                    authorId: sender.actorId,
                    inReplyTo: message.inReplyTo,
                    atMs: Date.now(),
                    // A question's one basis: what its "?" was pressed beside (rondo#401).
                    bases: message.about == null ? [] : [{ ...message.about }],
                    asks: false,
                    // Absent and not null, for `exactOptionalPropertyTypes`:
                    // a send answers nothing (D-0072 rule 2).
                    ...(answerOutcome === null ? {} : { answerOutcome }),
                    // The option an answer's press chose (D-0190 rule 5.1).
                    ...(answerOption == null ? {} : { answerOption }),
                  }),
                );
                if (outcome.kind === "recorded") {
                  issues.kick();
                  drafter.kick();
                  if (isQuestion({ authorKind: "operator", messageId: message.messageId })) {
                    explainer.kick();
                  }
                  // An answer may carry on at a lost lap's stop (D-0139).
                  if (answerOutcome !== null) {
                    lost.kick();
                  }
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
                await recordScopeFromPage(environment, store, storePath, sender.actorId, draft),
              // **Answered once the lap is there, not at its gate** (D-0109).
              async (input) =>
                await scopedStartPress(
                  environment,
                  store,
                  storePath,
                  sender.actorId,
                  record,
                  chromeFor(selected.tag),
                  input,
                ),
              // The drafted scope's two presses (rondo#238 C2b, D-0071 rule 5.3).
              async (form) =>
                await recordDraftedScopeFromPage(environment, storePath, sender.actorId, form),
              async (input) =>
                await answerOnceReserved(
                  store,
                  record,
                  chromeFor(selected.tag),
                  input,
                  startSplitFromPage(
                    environment,
                    store,
                    storePath,
                    sender.actorId,
                    bounds.policy,
                    input,
                  ),
                ),
              // The raise press (D-0074 section 4).
              async (input) =>
                await raiseScopeFromPage(environment, store, storePath, sender.actorId, input),
              // The goal scope's approve and pause (D-0128, rondo#471).
              {
                record: async (input) =>
                  await recordGoalScopeFromPage(
                    environment,
                    store,
                    storePath,
                    sender.actorId,
                    input,
                  ),
                pause: async (input) =>
                  await pauseGoalScopeFromPage(environment, storePath, sender.actorId, input),
              },
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
                await reviseFromPage(environment, store, storePath, sender.actorId, input),
              async (input) =>
                await conflictFixFromPage(environment, store, storePath, sender.actorId, input),
              async (iterationId) =>
                await retakeReviewFromPage(
                  environment,
                  store,
                  storePath,
                  sender.actorId,
                  iterationId,
                ),
              // D-0149: a lap stopped short starts again on the *carry on* that
              // answered its stop. A lost one is the lost-lap pass's, kicked by
              // the answer (`SayPort` above).
              async (ask, note) => {
                const lap = await lapStartedAgainAt(store, record, ask);
                return lap === null || !stoppedShort(lap)
                  ? null
                  : await restartLostFromPage(
                      environment,
                      store,
                      storePath,
                      sender.actorId,
                      chromeFor(selected.tag),
                      lap,
                      note,
                    );
              },
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
          : new PublishPort(async (input) => {
              const published = await publishFromPage(
                environment,
                store,
                storePath,
                sender.actorId,
                asked,
                input,
              );
              // What the pull request released may be what a held start
              // waits on (rondo#284): it is attempted now, not on the minute.
              order?.kick();
              return published;
            }),
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
      // **The workers this host is equipped for** (rondo#462): read here,
      // where the host's other settings are read, and handed to the page as
      // names so the start form can offer the choice and say which worker
      // runs the work when nobody makes one. A host whose own settings refuse
      // hands nothing rather than a guess: `rondo web` has not started
      // continuo, so the refusal belongs to the start that does, and a screen
      // that drew `claude` over it would be inventing the fact.
      // Spread and not assigned: `exactOptionalPropertyTypes` tells "the host
      // said nothing" from "this field is undefined", and the page reads the
      // first as *offer no choice* rather than as a provider.
      ...hostWorkers(environment),
      // **The merge press** (rondo#380, `D-0091`): a person's press per act,
      // on `release`'s condition -- an approver the allowlist accepts -- and
      // through the operator's own forge CLI, as publish is (`D-0010`).
      // **The goal and *not now* presses** (D-0097 points 2.1 (a) and 4.5
      // (a)), on `merge`'s condition: both are the person's say over what
      // rondo ranks, written as rows in rondo's store and nowhere else.
      triageRepositories,
      triageWritable: sender !== null && !("refusal" in sender),
      // **Read in my language** (rondo#490, D-0144), on `triage`'s condition:
      // a reading spends as the person, so it needs an approver the
      // allowlist accepts, and is a row in rondo's store and nowhere else.
      translating: sender !== null && !("refusal" in sender),
      readIn:
        sender === null || "refusal" in sender
          ? null
          : new ReadInPort(
              async (input) => await readIn({ record, runDrafter, now: () => Date.now() }, input),
            ),
      // D-0067 rule 6.3: taking a policy back is the person's successor, empty.
      policies:
        sender === null || "refusal" in sender
          ? null
          : new PolicyPort(async (policyId) => {
              const put = await record.recordStandingPolicy({
                policyId: newDraftId("policy"),
                body: "",
                authorKind: "operator",
                authorId: sender.actorId,
                bases: [],
                supersedesPolicyId: policyId,
                createdAtMs: Date.now(),
              });
              return put.kind === "recorded" ? { ok: true } : { ok: false, note: put.reason };
            }),
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
              async (input) => {
                // **Only what the flow waits on** (rondo#494 item 2, D-0166):
                // a round over a candidate it no longer asks about is refused,
                // not kept where nothing reads it.
                const stale = unanswerable(
                  await record.flowAsks(),
                  await record.latestTriage(),
                  await record.triageDeclines(),
                  input.askId,
                );
                if (stale !== null) {
                  return { ok: false, note: stale };
                }
                const answered = await record.recordFlowAnswer({
                  askId: input.askId,
                  answers: input.answers,
                  request: input.request,
                  why: input.why,
                  answeredBy: sender.actorId,
                  answeredAtMs: Date.now(),
                });
                if (answered.kind === "recorded") {
                  flow?.kick();
                }
                return answered.kind === "recorded"
                  ? { ok: true }
                  : { ok: false, note: answered.reason };
              },
            ),
      mergeable: sender !== null && !("refusal" in sender),
      ...(publisher === null ? {} : { publishUntried: publisher.untried }),
      fixesConflicts: sender !== null && !("refusal" in sender),
      retakesReviews: sender !== null && !("refusal" in sender),
      merge:
        sender === null || "refusal" in sender
          ? null
          : new MergePort(async (input) => {
              const merged = await merging(input);
              // Its release may be what a held start waits on (rondo#284).
              order?.kick();
              return merged;
            }),
      release:
        sender === null || "refusal" in sender
          ? null
          : new ReleasePort(async (input) => {
              const released = await releaseFromPage(environment, store, sender.actorId, input);
              // A start these files held is attempted now (rondo#284).
              order?.kick();
              return released;
            }),
      holds:
        sender === null || "refusal" in sender
          ? null
          : new HoldsPort(async (input) => {
              const moved = await holdsFromPage(environment, store, record, sender.actorId, input);
              // Files a narrowing gave up may be what a held start waits on.
              order?.kick();
              return moved;
            }),
      publishing:
        sender === null || "refusal" in sender
          ? null
          : async (row) => {
              // One connection for both legs: the thread the screen quotes,
              // and the row the body's English is composed into once for the
              // press to read (rondo#290, `D-0079` section 4). A second
              // `openAdvisoryRecord` here would open a second file handle on
              // every draw of this screen for no answer the first cannot give.
              const advisory = openAdvisoryRecord(storePath);
              return await publishingForPage(environment, store, asked, row, advisory, advisory);
            },
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
