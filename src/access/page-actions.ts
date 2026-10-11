/**
 * The page's gate presses (rondo#570): answer, revise, conflict fix, restart,
 * retake, release, holds and repository add, with the material and reach the
 * page shows beside them.
 *
 * Moved out of `cli.ts` unchanged; the command-line helpers they share with the
 * commands (`say`, `approvedActor`, `walkGate`, ...) still live there.
 */
import { allowedCommandsFor } from "../cadenza/facade.js";
import {
  type GateDelegation,
  showGate,
  startContinuo,
  type VerifiedContinuo,
} from "../continuo/invoker.js";
import { readPlan, readRunPlan } from "../refrain/plan.js";
import { revisionPlan, stoppedRetryPlan } from "../refrain/revision.js";
import { claimMove, quiescent } from "../store/lanes.js";
import {
  approvedForPublication,
  type IterationRecord,
  isTerminal,
  planField,
  requestsGoal,
} from "../store/records.js";
import {
  type AdvisoryRecord,
  asRefusal,
  type IterationStore,
  openAdvisoryRecord,
} from "../store/sqlite.js";
import { DETERMINISTIC_DRAFTER, type ExplainPorts, explainIteration } from "./advisory.js";
import {
  advisoryPorts,
  answerRecorder,
  approvedActor,
  GATE_VERBS,
  type GateVerbs,
  hostLanguage,
  hostWords,
  lapMaterial,
  refuse,
  relayFailure,
  revisionPreflight,
  revisionTakeIn,
  START_POLICY,
  say,
  sayGateOpen,
  sayReport,
  successorChecks,
  unpromptedPorts,
  type WalkOutcome,
  type WalkRequest,
  walkGate,
  withReservedNumbers,
} from "./cli.js";
import {
  admit,
  type ClaimComparison,
  compareClaim,
  conductorPorts,
  endFaulted,
  lineChanged,
  resume,
} from "./conductor.js";
import { asciiEscape, consoleSeams } from "./console.js";
import { approvedSplits } from "./drafted-view.js";
import { cloneRepository, readChangedPaths, stoppedShort } from "./forge.js";
import {
  GATE_ACTOR,
  type ScopedAnswer,
  type ScopedRevise,
  type ScopedReviseInput,
} from "./gate-host.js";
import { hostFailure } from "./host-failure.js";
import { commandFailure as forgeCommandFailure } from "./issue-read.js";
import { againId, startsAgainOnCarryOn, stoppedLapOf } from "./lost-laps.js";
import { type DrafterPorts, requestRepository } from "./model-draft/host.js";
import { modelReviewPorts, takeModelReading } from "./model-review/host.js";
import { retakeOffered, reviewRoundsAlong } from "./model-review/judgement.js";
import { APPROVE_BODY } from "./page/approve.js";
import type { ClaimReach, LapMaterialRead } from "./page/contract.js";
import { asksOverLine, conflictFixBlock, fixCauseOf, resultOf } from "./page-logic/result.js";
import { requestWords, threadsOf } from "./page-logic/threads.js";
import {
  cloneDirectory,
  planForRepository,
  repositoryParts,
  setupRootOf,
} from "./repository-add.js";
import { admitUnderScope, agentTypeRecordOf, approvalTip } from "./scope.js";
import { setupPlanFiles } from "./setup-files.js";
import type {
  AddedRepository,
  AddRepositoryInput,
  ClaimRefusal,
  ConflictFixed,
  ConflictFixInput,
  HoldsInput,
  HoldsMoved,
  Released,
  ReleaseInput,
  Retaken,
  Revised,
  ReviseInput,
  ReviseRefusal,
  Started,
} from "./web-app.js";
import type { Chrome } from "./wording.js";

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
export async function pageMaterial(
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
    conductorPorts(
      continuo,
      store,
      openAdvisoryRecord(storePath),
      Date.now,
      hostWords(environment),
    ),
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
 * rondo's own send of a drafted change at one gate (D-0145, rondo#517): the
 * revise press's path, walked as {@link GATE_ACTOR} for the scope's approver,
 * answering once the next lap is reserved so the host's pass does not wait out
 * the lap, as a lost lap's start again does (`restartLostFromPage`). The gate
 * host has already decided and claimed it; this is the act.
 */
export async function reviseUnderScope(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  approver: string,
  words: Chrome,
  record: IterationRecord,
  input: ScopedReviseInput,
): Promise<ScopedRevise> {
  if (record.requestMessageId === null) {
    return { kind: "notSent", note: "the lap names no request", answered: false };
  }
  let why: ReviseRefusal | undefined;
  const running = reviseFromPage(
    environment,
    store,
    storePath,
    approver,
    {
      iterationId: record.id,
      successorId: input.successorId,
      scopeDecisionId: input.scopeDecisionId,
      body: input.body,
    },
    input,
  ).then((revised): Started => {
    why = revised.why;
    return { ok: revised.ok, note: revised.note };
  });
  const started = await answerOnceReserved(
    store,
    openAdvisoryRecord(storePath),
    words,
    { iterationId: input.successorId, requestMessageId: record.requestMessageId },
    running,
  );
  return started.ok
    ? { kind: "sent" }
    : {
        kind: "notSent",
        note: started.note,
        // Past the walk, or a walk that stopped part way: the gate may hold it.
        answered:
          why === "reviseRefusedAfterGate" ||
          why === "reviseRefusedNotSettled" ||
          why === "reviseRefusedWalkFailed",
      };
}

/**
 * The organisation's answer at one gate (D-0125 rule 6, rondo#467): the
 * approve press's walk, in {@link GATE_ACTOR}'s name and carrying the
 * delegation, then `resume` to settle rondo's row. The gate host has already
 * decided and claimed it; this is the act.
 *
 * **Recorded only where continuo holds rondo's delegated answer.** A person
 * who answered the same gate first keeps it: continuo hands back their answer
 * (`answered_by`), and rondo records nothing over it and reports no approval.
 */
export async function answerUnderScope(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  record: IterationRecord,
  delegation: GateDelegation,
): Promise<ScopedAnswer> {
  if (record.gateId === null) {
    return { kind: "notDelegated", note: "no gate is open on it" };
  }
  const startup = await startContinuo(environment);
  if (startup.kind === "refused") {
    return { kind: "notDelegated", note: `continuo is not usable: ${startup.reason}` };
  }
  const continuo = startup.continuo;
  const gateId = record.gateId;
  let delegated = false;
  const walked = await walkGate(continuo, {
    db: planField(record, "db"),
    gateId,
    destinationDir: planField(record, "endpoint_destination_dir"),
    holder: planField(record, "lease_claimant_id"),
    actorId: GATE_ACTOR,
    body: APPROVE_BODY,
    delegation,
    recordAnswer: async (answered) => {
      delegated =
        answered.answeredBy.actorKind === "delegate" && answered.answeredBy.actorId === GATE_ACTOR;
      if (delegated) {
        await store.recordGateAnswer(record.id, gateId, "approve", GATE_ACTOR, Date.now());
      }
    },
  });
  if (walked.kind === "failed") {
    return {
      kind: "notDelegated",
      note: delegated
        ? "continuo holds rondo's answer and the walk did not finish; the approve press " +
          "finishes it"
        : "not approved by rondo, left for the person: the gate walk did not finish, and the " +
          "lines above have continuo's own diagnosis",
    };
  }
  if (!delegated) {
    return {
      kind: "notDelegated",
      note: "not approved by rondo, left for the person: the gate was already answered or closed",
    };
  }
  const report = await resume(
    conductorPorts(
      continuo,
      store,
      openAdvisoryRecord(storePath),
      Date.now,
      hostWords(environment),
    ),
    record.id,
  );
  sayReport(report);
  // **The answer and the row are two facts** (`answerFromPage`'s reason). A
  // gate rondo answered whose row did not settle is not reported approved;
  // the approve press settles it, since its walk finds the gate closed and
  // `resume` runs again.
  if (report.status !== "closed") {
    return {
      kind: "notDelegated",
      note:
        `rondo answered the gate and the row is ${report.status ?? "in an unnamed state"} ` +
        "rather than closed; the approve press settles it",
    };
  }
  return { kind: "delegated" };
}

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
    const outcome = asRefusal(
      await record.recordThreadMessage({
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
      }),
    );
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
  delegated: ScopedReviseInput | null = null,
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
  const running = revisePage(environment, store, storePath, approver, input, delegated);
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

/**
 * Whether a lost lap starts again by itself (D-0139): its approval is a goal
 * scope, or approves a split its request runs as.
 */
export async function startsByItself(
  record: AdvisoryRecord,
  lap: IterationRecord,
): Promise<boolean> {
  const tip = await approvalTip(record, lap.id);
  if (tip.kind !== "tip") {
    return false;
  }
  const splits = await approvedSplits({ record });
  if (
    splits.some(
      (split) =>
        split.scopeDecisionId === tip.scopeDecisionId &&
        split.requestMessageId === lap.requestMessageId,
    )
  ) {
    return true;
  }
  const decided = await record.readScopeDecision(tip.scopeDecisionId);
  if (decided.kind !== "read") {
    return false;
  }
  const scope = await record.readScope(decided.decision.scopeId);
  return scope.kind === "read" && requestsGoal(scope.scope.payload.requests) !== null;
}

/**
 * The lap a *carry on* to this ask starts again (D-0139, D-0149): a lap lost,
 * or stopped at its budget or its time limit, that has an approval in force to
 * start it again under. The answer's own press starts one stopped short; this
 * host's lost-lap pass starts a lost one. Null for any other ask, which goes on
 * as before: a lap with no approval in force is the person's to start, and the
 * drafter reads their answer.
 */
export async function lapStartedAgainAt(
  store: Pick<IterationStore, "read">,
  record: Pick<AdvisoryRecord, "scopeDecisionAdmitting" | "scopeTip">,
  ask: Parameters<typeof stoppedLapOf>[0],
): Promise<IterationRecord | null> {
  const lapId = stoppedLapOf(ask);
  if (lapId === null) {
    return null;
  }
  const row = await store.read(lapId);
  if (row.kind !== "read" || !startsAgainOnCarryOn(row.record)) {
    return null;
  }
  return (await approvalTip(record, lapId)).kind === "tip" ? row.record : null;
}

/**
 * Start a stopped lap again (D-0139, D-0149): its stored plan, run once more as
 * {@link againId}, under the approval it ran under and in the approver's name,
 * as `retry` runs one. A lap stopped at its budget or its time limit runs it
 * from where it stopped (`stoppedRetryPlan`), with what the person wrote when
 * they carried on. Answers once the new row is reserved, so neither the host's
 * pass nor the answer's press waits out the lap. A second call finds the row
 * and is the first.
 */
export async function restartLostFromPage(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  approver: string,
  words: Chrome,
  lost: IterationRecord,
  note: string | null = null,
): Promise<Started> {
  const successorId = againId(lost.id);
  if ((await store.read(successorId)).kind === "read") {
    return { ok: true, note: `iteration '${successorId}' was already admitted` };
  }
  const actor = approvedActor(approver, environment);
  if ("refusal" in actor) {
    return { ok: false, why: "startRefusedNotAdmitted", note: actor.refusal };
  }
  if (!startsAgainOnCarryOn(lost)) {
    return {
      ok: false,
      why: "startRefusedNotAdmitted",
      note: `lap '${lost.id}' was not lost or stopped at its budget or its time limit`,
    };
  }
  const decoded = readPlan(lost.plan);
  if (decoded.kind !== "planned") {
    return { ok: false, why: "startRefusedNotAdmitted", note: decoded.reason };
  }
  const advisory = openAdvisoryRecord(storePath);
  const tip = await approvalTip(advisory, lost.id);
  if (tip.kind !== "tip") {
    return {
      ok: false,
      why: "startRefusedNotAdmitted",
      note: `lap '${lost.id}' has no one approval in force to start again under`,
    };
  }
  const startup = await startContinuo(environment);
  if (startup.kind === "refused") {
    return { ok: false, why: "startRefusedNotAdmitted", note: startup.reason };
  }
  const ports = conductorPorts(startup.continuo, store, advisory, Date.now, words);
  const running = admitUnderScope(
    {
      store,
      record: advisory,
      nowMs: Date.now,
      admit: (plan, id, supersedes, requestMessageId, scopeSpend) =>
        admit(
          ports,
          unpromptedPorts(store, storePath),
          plan,
          START_POLICY,
          id,
          supersedes,
          null,
          requestMessageId,
          scopeSpend,
        ),
    },
    tip.scopeDecisionId,
    {
      kind: "redo",
      iterationId: successorId,
      plan: stoppedShort(lost) ? stoppedRetryPlan(decoded.plan, lost, note) : decoded.plan,
      predecessorId: lost.id,
      requestMessageId: lost.requestMessageId,
      closing: false,
    },
  ).then(async (outcome): Promise<Started> => {
    if (outcome.kind === "refused") {
      return {
        ok: false,
        why: "startRefusedNotAdmitted",
        note: `the ${outcome.verdict} verdict at the ${outcome.test} test: ${outcome.reason}`,
      };
    }
    if (outcome.kind === "halted") {
      return {
        ok: false,
        why: "startRefusedNotAdmitted",
        note: `nothing was admitted; the admission stopped with status ${String(outcome.status)}`,
      };
    }
    const report = outcome.report;
    sayReport(report);
    // A reservation refused (a line holds the paths, the host is full) admits nothing.
    if (report.iterationId === null) {
      return { ok: false, why: "startRefusedNotAdmitted", note: report.lines.join("\n") };
    }
    // The gate-opening review, as every other admission takes it.
    if (report.status === "awaiting_human") {
      await sayGateOpen(() =>
        takeModelReading(
          modelReviewPorts(
            startup.continuo,
            store,
            ports.thread ?? null,
            hostLanguage(environment),
          ),
          report.iterationId ?? successorId,
        ),
      );
    }
    return { ok: true, note: `iteration '${successorId}' ran` };
  });
  return await answerOnceReserved(
    store,
    advisory,
    words,
    { iterationId: successorId, requestMessageId: lost.requestMessageId },
    running,
  );
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
  const lineIds = line.kind === "read" ? line.line.laps.map((lap) => lap.id) : [record.id];
  // A gate of this line only (D-0138 rule 2): another part's gate is its own.
  const gated = (await store.readLive()).some(
    (live) =>
      live.kind === "read" &&
      live.record.status === "awaiting_human" &&
      lineIds.includes(live.record.id),
  );
  const fresh = resultOf(threads.byId, record.id);
  const block = !approvedForPublication(record)
    ? "nothingToFix"
    : conflictFixBlock(fresh, {
        // A gate waiting, or a question about this line (D-0105); a question
        // about the request as a whole does not withhold the fix.
        asksWaiting: gated || asksOverLine(threads, record.requestMessageId, lineIds),
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
      note: `fixing the pull request is not offered on '${record.id}': ${block}`,
    };
  }
  // The fix the card offered, asked again: a card drawn for a conflict starts
  // nothing once the checks are red instead, and the other way round (rondo#551).
  const cause = fresh === null ? null : fixCauseOf(fresh.checks);
  if (cause?.kind !== input.cause) {
    return {
      ok: false,
      why: "conflictFixRefusedGone",
      note: `the pull request of '${record.id}' is no longer ${input.cause === "red" ? "red" : "conflicting"}`,
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
  // exception to D-0100 rule 4), taken in with cause `conflict`. A red check's
  // repair (rondo#551) takes nothing in: it names the failing checks instead.
  const decided =
    cause.kind === "conflict"
      ? await revisionTakeIn(record, input.successorId, store, "conflict")
      : { takeIn: null };
  const successor =
    "refusal" in decided
      ? { kind: "refused" as const, reason: decided.refusal }
      : revisionPlan({
          predecessor: record,
          iterationId: input.successorId,
          instruction: null,
          takeIn: decided.takeIn,
          failedChecks: cause.kind === "red" ? cause.failedChecks : null,
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
  const ports = conductorPorts(continuo, store, advisory, Date.now, hostWords(environment));
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
        modelReviewPorts(continuo, store, ports.thread ?? null, hostLanguage(environment)),
        report.iterationId ?? input.successorId,
      ),
    );
  }
  return { ok: true, note: `iteration '${input.successorId}' was admitted` };
}

/**
 * One press of the gate's *take the review again* (rondo#500, D-0138 rule 3):
 * the lap's one model reading could not be taken for a reason a second run
 * could change, so it is taken once more, as the gate opening took it.
 *
 * **What was drawn is asked again here** over fresh rows (`retakeOffered`),
 * and the round is counted before anything runs: under an approval, the
 * lineage's rounds with this one added must fit the scope's review rounds
 * (D-0065 section 5, rule 5.5: outside a scope nothing is counted). A double
 * press of one card finds the first in flight and is the first.
 */
export async function retakeReviewFromPage(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  approver: string,
  iterationId: string,
): Promise<Retaken> {
  const already = retaking.get(iterationId);
  if (already !== undefined) {
    return await already;
  }
  const running = retakeReviewPage(environment, store, storePath, approver, iterationId);
  retaking.set(iterationId, running);
  try {
    return await running;
  } finally {
    retaking.delete(iterationId);
  }
}

/** Every retake press this process has in flight, by the lap's id. */
const retaking = new Map<string, Promise<Retaken>>();

async function retakeReviewPage(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  approver: string,
  iterationId: string,
): Promise<Retaken> {
  const actor = approvedActor(approver, environment);
  if ("refusal" in actor) {
    return { ok: false, why: "retakeRefusedGone", note: actor.refusal };
  }
  const found = await store.read(iterationId);
  if (found.kind !== "read" || found.record.status !== "awaiting_human") {
    return {
      ok: false,
      why: "retakeRefusedGone",
      note: `iteration '${iterationId}' is not waiting at its gate`,
    };
  }
  const record = found.record;
  if (!retakeOffered(await store.readingsFor(record.id))) {
    return {
      ok: false,
      why: "retakeRefusedGone",
      note: `taking the review again is not offered on '${record.id}'`,
    };
  }
  const advisory = openAdvisoryRecord(storePath);
  const tip = await approvalTip(advisory, record.id);
  // Two approved tips leave the budget undecidable, not absent (Codex).
  if (tip.kind === "forked") {
    return {
      ok: false,
      why: "retakeRefusedForked",
      note: `iteration '${record.id}' was admitted under a line with two approved tips (D-0074 rule 2.1)`,
    };
  }
  if (tip.kind === "tip") {
    const decided = await advisory.readScopeDecision(tip.scopeDecisionId);
    const scope =
      decided.kind === "read" ? await advisory.readScope(decided.decision.scopeId) : null;
    const lineage = await advisory.lineageOf(record.id);
    if (scope?.kind !== "read" || lineage === null) {
      return {
        ok: false,
        why: "retakeRefusedGone",
        note: `the approval '${tip.scopeDecisionId}' or the lap's lineage did not read`,
      };
    }
    const links = [];
    for (const id of lineage) {
      links.push({ readings: await store.readingsFor(id) });
    }
    const taken = reviewRoundsAlong(links);
    const budget = scope.scope.payload.budgets.review_rounds;
    if (taken + 1 > budget) {
      return {
        ok: false,
        why: "retakeRefusedBudget",
        rounds: { taken, budget },
        note: `${String(taken)} of ${String(budget)} review round(s) are taken`,
      };
    }
  }
  const startup = await startContinuo(environment);
  if (startup.kind === "refused") {
    return {
      ok: false,
      why: "retakeRefusedNoContinuo",
      note: `continuo is not usable: ${startup.reason}`,
    };
  }
  const ports = conductorPorts(startup.continuo, store, advisory, Date.now, hostWords(environment));
  const lines = await takeModelReading(
    modelReviewPorts(startup.continuo, store, ports.thread ?? null, hostLanguage(environment)),
    record.id,
  );
  for (const line of lines) {
    say(line);
  }
  return { ok: true, note: `the model reading of '${record.id}' was taken again` };
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
  /** rondo's own send under a goal scope (D-0145): walked as its delegate, never as a press. */
  delegated: ScopedReviseInput | null,
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
  // framing whichever of the gate's two answers they chose. rondo's own send
  // is no press, and records none, as its approve records none.
  if (delegated === null) {
    const shown = await recordPagePress(
      advisoryPorts(store, storePath, () => {}),
      input.iterationId,
    );
    if (!shown.ok) {
      return { ok: false, why: "reviseRefusedNotSetUp", note: shown.note };
    }
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
  const ports = conductorPorts(continuo, store, advisory, Date.now, hostWords(environment));
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
  let haltNote: string | null = null;
  const answerGate = async (): Promise<number | null> => {
    // **Asked again right before the walk** (D-0145 rule 6): a reading or a
    // draft that moved since the pass, or a host that filled, sends nothing.
    if (delegated !== null && !(await delegated.recheck())) {
      halted = "reviseRefusedNotSetUp";
      haltNote =
        "nothing was answered: the gate no longer meets every condition for rondo to send " +
        "the drafted change, or the host has no room for the next lap";
      return 1;
    }
    // **Whose answer continuo holds decides who goes on** (D-0145 rule 6): an
    // answer with the same words already given by the other side -- a press
    // before rondo's send, or rondo's send before a press -- is theirs, and
    // this walk starts no second lap over it.
    let theirs = false;
    const walkActor = delegated === null ? actor.actorId : GATE_ACTOR;
    const walked = await walkGate(continuo, {
      db: planField(record, "db"),
      gateId,
      destinationDir: planField(record, "endpoint_destination_dir"),
      holder: planField(record, "lease_claimant_id"),
      actorId: walkActor,
      body: input.body,
      ...(delegated === null ? {} : { delegation: delegated.delegation }),
      recordAnswer: async (answered) => {
        const byRondo =
          answered.answeredBy.actorKind === "delegate" &&
          answered.answeredBy.actorId === GATE_ACTOR;
        theirs = delegated === null ? byRondo : !byRondo;
        if (!theirs) {
          await store.recordGateAnswer(record.id, gateId, "revise", walkActor, Date.now());
        }
      },
    });
    if (theirs) {
      sayReport(await resume(ports, record.id));
      halted = "reviseRefusedGateClosed";
      return 1;
    }
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
      note:
        haltNote ??
        `nothing was admitted; the gate walk stopped with status ${String(outcome.status)}`,
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
        modelReviewPorts(continuo, store, ports.thread ?? null, hostLanguage(environment)),
        report.iterationId ?? input.successorId,
      ),
    );
  }
  return { ok: true, note: `iteration '${input.successorId}' was admitted` };
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
 * Change which files an open line keeps, on a press from the page (D-0073
 * rules 4.1 and 4.2, D-0163), as `releaseFromPage` releases them.
 *
 * **A narrowing reads what the line changed first** (rule 4.2), over the
 * laps the screen was drawn over: the store refuses when those moved, and
 * refuses a narrowing while a lap may still commit, so what was read is what
 * the line has.
 */
export async function holdsFromPage(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  record: Pick<AdvisoryRecord, "threadMessages">,
  approver: string,
  input: HoldsInput,
): Promise<HoldsMoved> {
  const actor = approvedActor(approver, environment);
  if ("refusal" in actor) {
    return { ok: false, why: "holdsRefusedNotRecorded", note: actor.refusal };
  }
  const line = await store.laneLine(input.iterationId);
  if (line.kind !== "read") {
    return {
      ok: false,
      why: "holdsRefusedNotRecorded",
      note: line.kind === "defect" ? line.reason : "the lap is not in this store",
    };
  }
  const drawn = [...input.lapIds].sort().join(" ");
  if (
    line.line.claim?.claimId !== input.claimId ||
    line.line.laps
      .map((lap) => lap.id)
      .sort()
      .join(" ") !== drawn
  ) {
    return { ok: false, why: "holdsRefusedChanged", note: "" };
  }
  // Read only when it can matter: a move refused as written, or one that
  // gives nothing up, needs no git, and one over a line still running is
  // refused as busy by the store.
  const asked = claimMove(line.line.claim.paths, input.paths);
  if (asked.kind === "refused") {
    return { ok: false, why: "holdsRefusedPaths", note: asked.reason };
  }
  const changed =
    asked.dropped.length > 0 && quiescent(line.line.laps)
      ? await lineChanged({ store, readChangedPaths }, line.line.laps)
      : null;
  if (changed?.kind === "undetermined") {
    return { ok: false, why: "holdsRefusedUnread", note: changed.reason };
  }
  const outcome = await store.moveClaim({
    iterationId: input.iterationId,
    takenOver: { claimId: input.claimId, lapIds: input.lapIds },
    paths: input.paths,
    changed: changed === null ? null : changed.paths,
    authorId: actor.actorId,
    nowMs: Date.now(),
  });
  switch (outcome.kind) {
    case "moved":
      say(
        `Line ${outcome.lineageId} keeps other files now, on a press from the page: ` +
          `took ${outcome.added.join(", ") || "none"}, gave up ${outcome.dropped.join(", ") || "none"}.`,
      );
      return { ok: true, note: "" };
    case "stale":
      return { ok: false, why: "holdsRefusedChanged", note: "" };
    case "busy":
      return { ok: false, why: "holdsRefusedBusy", note: "" };
    case "kept":
      return { ok: false, why: "holdsRefusedKept", note: "", paths: outcome.paths };
    case "held": {
      const read = await record.threadMessages();
      const messages = read.kind === "read" ? read.messages : [];
      const ledger = await store.laneLedger().catch(() => []);
      const holders = await Promise.all(
        outcome.holders.map(async ({ lineageId }) => {
          const root = await store.read(lineageId);
          return {
            lineageId,
            request: root.kind === "read" ? requestWords(messages, root.record) : null,
            inFlight: ledger.find((each) => each.lineageId === lineageId)?.inFlight ?? true,
          };
        }),
      );
      return {
        ok: false,
        why: "holdsRefusedHeld",
        note: "",
        paths: [...new Set(outcome.holders.flatMap(({ sharedPaths }) => sharedPaths))],
        holders,
      };
    }
    case "refused":
      return { ok: false, why: "holdsRefusedPaths", note: outcome.reason };
    default:
      return { ok: false, why: "holdsRefusedNotRecorded", note: outcome.reason };
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

/**
 * Record setup's plan files, on a press from the page (D-0191 rule 2.2): what
 * `rondo setup-plan` would have recorded had setup's last step happened. Only
 * while rondo holds no plan at all, so a stale page records nothing twice.
 */
export async function recordSetupPlansFromPage(
  environment: Readonly<Record<string, string | undefined>>,
  ports: Pick<DrafterPorts, "store"> & {
    readonly record: DrafterPorts["record"] & Pick<AdvisoryRecord, "recordSetupPlan">;
  },
  approver: string,
  storePath: string,
  requestMessageId: string,
): Promise<AddedRepository> {
  const failed = (note: string): AddedRepository => ({
    ok: false,
    why: "addRepositoryRefusedFailed",
    note,
  });
  const actor = approvedActor(approver, environment);
  if ("refusal" in actor) {
    return failed(actor.refusal);
  }
  if (!(await requestRepository({ ...ports, now: Date.now }, requestMessageId)).planless) {
    return {
      ok: false,
      why: "addRepositoryRefusedChanged",
      note: "rondo holds a plan now, so there is nothing of setup's to record",
    };
  }
  const files = setupPlanFiles(storePath);
  if (files.length === 0) {
    return {
      ok: false,
      why: "addRepositoryRefusedNoSetup",
      note: `no plan setup wrote is beside ${storePath}`,
    };
  }
  for (const [index, { file, plan }] of files.entries()) {
    const atMs = Date.now();
    const written = await ports.record.recordSetupPlan({
      setupId: `setup-${String(atMs)}-${String(index)}`,
      plan,
      recordedBy: actor.actorId,
      recordedAtMs: atMs,
    });
    if (written.kind !== "recorded") {
      return failed(`${file}: ${written.reason}`);
    }
    say(`Recorded setup's plan ${file} on a press from the page.`);
  }
  return { ok: true };
}
