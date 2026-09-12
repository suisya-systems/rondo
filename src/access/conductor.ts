/**
 * The composition root: the one module that wires the conductor to the world.
 *
 * D-0019 rule 2. `src/access` is already the only layer permitted to see the
 * loop, the store and the continuo seam, and D-0009 and D-0013 already put the
 * human-facing verbs here -- so the module that wires the conductor and the
 * module that carries the human's answer are the same surface, which is the
 * property those two entries exist to protect. A new layer for one file would
 * have been a layer named after a metaphor.
 *
 * **Three things happen here and nowhere else.**
 *
 *  1. **`ContinuoResult` becomes `EffectOutcome`.** The conductor speaks its own
 *     four-outcome vocabulary (`src/refrain/ports.ts`) and the seam speaks
 *     continuo's six (`src/continuo/protocol.ts`); {@link asEffect} is the whole
 *     of the translation, and D-0015 rule 2 and D-0017 rule 8 are why one has to
 *     exist at all -- nothing typed crosses the process boundary and no continuo
 *     type leaves its layer. The mapping is small and one line of it is
 *     load-bearing: see {@link asEffect}.
 *  2. **The `RunPlan` becomes two argv-shaped requests.** The conductor holds a
 *     plan; `admitRun` and `performLap` hold each verb's own fields. Neither
 *     side names the other's vocabulary, and no caller anywhere spells a flag or
 *     a continuo role (D-0014 rule 1).
 *  3. **The store's own interface is checked against the port.** `IterationStore`
 *     is declared in `src/store/sqlite.ts` and `StorePort` in
 *     `src/refrain/ports.ts`, because the store layer names only itself and may
 *     not import the loop. They are two statements of one contract, and the
 *     assignment in {@link conductorPorts} is what makes a drift between them a
 *     compile error rather than a discovery.
 *
 * **What is deliberately *not* here.** No OIDC, no HTTP binding, no gate pane
 * and no conversation store: D-0020 takes the five operating-surface rows
 * cadenza sent to rondo's gate and **decides only**. The one thing that surface
 * needs from lap 1 is the `resume(iterationId)` entry point (D-0019 rule 5), and
 * it is re-exported below.
 */
import {
  admitRun,
  type PerformLapRequest,
  performLap,
  run as runContinuo,
  showGate,
  startContinuo,
  type VerifiedContinuo,
} from "../continuo/invoker.js";
import type { ContinuoResult } from "../continuo/protocol.js";
import { readLapSpend } from "../continuo/transcript.js";
import { classifyPlan } from "../refrain/classification.js";
import {
  abandon as abandonIteration,
  admit as admitIteration,
  type ConductorReport,
  requestWithdrawal as requestIterationWithdrawal,
  resume as resumeIteration,
} from "../refrain/interpreter.js";
import type { AdmittedPlan, RunPlan } from "../refrain/plan.js";
import type { LoopPolicy } from "../refrain/policy.js";
import type {
  ConductorPorts,
  DecisionSpend,
  EffectOutcome,
  GateObservation,
  LapPerformance,
  RunAdmission,
  StorePort,
} from "../refrain/ports.js";
import type { LapReadingDraft } from "../store/records.js";
import type { IterationStore } from "../store/sqlite.js";

import { proposeAfterAbandon, type UnpromptedPorts } from "./advisory.js";
import { discard, writeDelegationRecord } from "./delegation.js";
import { inspectLapWork } from "./forge.js";
import { READING_REMOTE, readingOf } from "./review.js";

export type { ConductorReport };

/**
 * Turn one continuo outcome into one conductor outcome.
 *
 * Five of the seven mappings are ordinary. The other two are the reason this
 * function is written out rather than inlined at four call sites, and they are
 * the same reason twice:
 *
 * **`timedOut` and `endedAbnormally` map to `noAnswer`, and neither may ever
 * map to `refused` or `defect`.** rondo's own ceiling firing means the *CLI* was killed and the
 * fenced child was not, so a worker may still be alive with nobody polling it.
 * The conductor reads `noAnswer` as "keep the single-flight lock and ask a
 * person", and reads `refused` and `defect` as "the child is over, release it".
 * Mapping a timeout onto either of those would let the next lap be admitted
 * while an orphan was still writing to the same worktree, which is the one race
 * D-0019 rules 11 and 12 exist to prevent. The whole cost of getting it wrong is
 * one line here, which is exactly why the line has a paragraph.
 *
 * **The refusal's session id passes through and is never manufactured.** A
 * `lap perform` refusal that names its session (`continuo D-1102`) hands the
 * conductor an identity it can act on; every other refusal, prose included,
 * hands it none, and the absence is carried as an absence. Nothing here reads
 * the message for one -- that is D-0015 rule 7, and it is the reason continuo
 * made the id a field.
 *
 * **`endedAbnormally` is the same hazard reached from the other side**
 * (`D-0035`). continuo's CLI sets `process.exitCode` rather than exiting, and
 * its provider keeps a referenced handle on the child it spawned, so a
 * `lap perform` that comes back through one of the two exit statuses its
 * contract defines is a process whose teardown ran and whose child is over --
 * which is what makes `D-0019` rule 11's release sound. An invocation that
 * ended any other way bought none of that: an escaping exception exits 1 at
 * once, and a signal death runs nothing at all. rondo cannot tell such a lap
 * from one that left a worker running, and it has no session id for it either,
 * so the row keeps `performing` and the slot with it.
 *
 * `protocolRefusal` maps to `defect` rather than to `refused` because it is not
 * an answer addressed to an operator: it says the seam is not the seam rondo was
 * built against, and what a person does about it is re-pin continuo or teach
 * rondo the new shape. `refusedInProse` maps to `refused` because it *is*
 * continuo's answer, said in words rondo may relay but never parse.
 */
export function asEffect<T, U>(
  result: ContinuoResult<T>,
  read: (payload: T) => U,
): EffectOutcome<U> {
  switch (result.kind) {
    case "answered":
      return { kind: "answered", value: read(result.payload) };
    case "refused":
      // The identity travels with the refusal it belongs to and is added only
      // when the envelope carried one: a `sessionId` key holding `undefined`
      // would be rondo claiming to have looked and found nothing, where the
      // truth is that continuo did not say (`exactOptionalPropertyTypes`).
      return {
        kind: "refused",
        message: result.message,
        ...(result.sessionId === undefined ? {} : { sessionId: result.sessionId }),
      };
    case "refusedInProse":
      // No identity here and none inferable: prose is an argparse-level refusal
      // raised before any session exists, and D-0015 rule 7 forbids reading one
      // out of the words either way.
      return { kind: "refused", message: result.text };
    case "protocolRefusal":
      return { kind: "defect", reason: result.reason };
    case "invokerDefect":
      return { kind: "defect", reason: result.reason };
    case "timedOut":
      return { kind: "noAnswer", reason: result.reason };
    case "endedAbnormally":
      return { kind: "noAnswer", reason: result.reason };
  }
}

/**
 * `lap perform`'s fields, read off the plan.
 *
 * A function rather than a spread, because the two records are deliberately not
 * the same type: the plan is the conductor's and carries cadenza's inputs beside
 * continuo's, and the request is the seam's and carries only what goes on a
 * command line. Writing the transcription out is what makes a field added to
 * one and not the other a compile error here rather than a missing flag at
 * runtime.
 *
 * **The model tier is the one field that is not read off the plan**, and it is a
 * parameter for the same reason `admitRun`'s neutral role name is: it comes off
 * the agent-type record cadenza built at the `classify` state, is committed to
 * the row there, and reaches this layer through the loop rather than through the
 * plan the caller wrote (D-0021).
 */
function lapRequestOf(plan: AdmittedPlan, modelTier: string): PerformLapRequest {
  return {
    db: plan.db,
    runId: plan.runId,
    repository: plan.repository,
    artifactRoot: plan.artifactRoot,
    stateRoot: plan.stateRoot,
    endpointRecipient: plan.endpointRecipient,
    endpointDestinationDir: plan.endpointDestinationDir,
    claudeCommand: plan.claudeCommand,
    modelTier,
    interlockRoot: plan.interlockRoot,
    claudeOrgPath: plan.claudeOrgPath,
    endpointDb: plan.endpointDb,
    endpointModule: plan.endpointModule,
    node: plan.node,
    hookScript: plan.hookScript,
    python: plan.python,
    pollIntervalMs: plan.pollIntervalMs,
    turnTimeoutMs: plan.turnTimeoutMs,
    gitTimeoutMs: plan.gitTimeoutMs,
    identityReadbackTimeoutMs: plan.identityReadbackTimeoutMs,
    gateOptions: plan.gateOptions,
    gateDeadlineAtMs: plan.gateDeadlineAtMs,
    invocationCeilingMs: plan.invocationCeilingMs,
  };
}

/**
 * What the lap spent, in the three names {@link LapPerformance} carries.
 *
 * A function rather than a spread of {@link readLapSpend}'s own record, because
 * the transcript's keys are the worker CLI's (`total_cost_usd`, `num_turns`) and
 * the port's are rondo's: naming the mapping is what lets a reader of either
 * side see that no fourth number appeared on the way across.
 */
function readLapSpendFields(
  stateRoot: string,
  runId: string,
  sessionId: string,
): Pick<LapPerformance, "costUsd" | "turns" | "durationMs" | "spendSource"> {
  const spend = readLapSpend({ stateRoot, runId, sessionId });
  return {
    costUsd: spend.totalCostUsd,
    turns: spend.numTurns,
    durationMs: spend.durationMs,
    // The fourth value, and it is not a number: which read produced the three
    // above, so the report can say why they are null instead of guessing
    // (rondo#130). The two sides spell the union identically and the type is
    // declared on both, so a value added on one side stops compiling here.
    spendSource: spend.source,
  };
}

/**
 * Everything the conductor is handed, built from a verified continuo and an
 * open store.
 *
 * `store` is typed as {@link StorePort} on the way in and the argument is an
 * {@link IterationStore}: that assignment is check 3 of this module's header,
 * and it is the only place the two declarations of the durable contract meet.
 *
 * `now` is `Date.now` and it is a *parameter of the ports* rather than a call
 * inside the loop, for the same reason the store reads no clock -- a conductor
 * whose time cannot be controlled from a test is a conductor whose timestamps
 * cannot be tested.
 *
 * `classify` is `src/refrain`'s own, not this module's. It reaches cadenza
 * through the facade, which is the one arrow D-0019 rule 1 added; an access
 * point that classified would be an access point taking a domain decision, which
 * is the shape D-0018 rule 5 argued against.
 */
export function conductorPorts(
  continuo: VerifiedContinuo,
  store: IterationStore,
  now: () => number = Date.now,
): ConductorPorts {
  const port: StorePort = store;
  return {
    store: port,
    now,
    classify: async (plan) => classifyPlan(plan),
    startContinuo: async () => ({ kind: "answered", value: { revision: continuo.revision } }),
    admitRun: async (plan, neutralRoleName): Promise<EffectOutcome<RunAdmission>> => {
      // **Written before the verb and removed after it, whatever the verb
      // answered** (D-0040 rule 7). continuo requires the record and does not
      // default it, so a record rondo cannot compose or write is an admission
      // that does not happen -- and the file is transport, so nothing
      // downstream may depend on it still being there afterwards.
      const written = writeDelegationRecord(plan);
      if (written.kind !== "written") {
        return { kind: "defect", reason: written.reason };
      }
      try {
        const outcome = await admitRun(continuo, {
          db: plan.db,
          runId: plan.runId,
          leaseClaimantId: plan.leaseClaimantId,
          workspace: plan.workspace,
          neutralRoleName,
          baseBranch: plan.baseBranch,
          topicBranch: plan.topicBranch,
          prompt: plan.prompt,
          // The plan's declaration, passed as the plan wrote it: the port's
          // signature does not grow a parameter for it, because the plan is
          // already what crosses and the declaration is a field of the plan
          // rather than something the conductor decides (D-0039 rule 3).
          allowedBash: plan.allowedBash,
          // The plan's ask, carried the same way: rondo does not decide it and
          // does not read it back (D-0053 rules 6 and 8).
          materialLanguage: plan.materialLanguage,
          // The envelope this admission was composed with, and its format
          // name. Not read, not re-encoded and not validated here: the bytes
          // are the record and continuo digests them as they arrive.
          delegationRecordPath: written.record.path,
          delegationRecordSchema: written.record.recordSchema,
        });
        const effect = asEffect(outcome.result, (payload) => payload);
        if (effect.kind !== "answered") {
          return effect;
        }
        // The mapped role is the adapter's answer and never this module's guess:
        // `admitRun` owns the table, and it returns null exactly when it refused
        // before mapping -- a branch that cannot also have answered. So the
        // combination is unreachable, and it is reported as rondo's defect rather
        // than papered over with an empty string, because a row carrying `''` as
        // the continuo role would be a row that quietly lied about which fence the
        // run was admitted under.
        if (outcome.continuoRole === null) {
          return {
            kind: "defect",
            reason:
              "continuo run admit answered successfully through an adapter that reports no mapped " +
              "role. rondo cannot say which role the run was admitted under, and recording one it " +
              "did not observe would be worse than refusing.",
          };
        }
        return {
          kind: "answered",
          value: {
            runId: effect.value.runId,
            status: effect.value.status,
            continuoRole: outcome.continuoRole,
          },
        };
      } finally {
        discard(written.record);
      }
    },
    performLap: async (plan, modelTier): Promise<EffectOutcome<LapPerformance>> => {
      const outcome = await performLap(continuo, lapRequestOf(plan, modelTier));
      return asEffect(outcome.result, (payload) => ({
        // Kept rather than dropped: it is the only identity a lap's answer
        // carries that the conductor can check, and the check is the
        // interpreter's (see `LapPerformance.runId`).
        runId: payload.runId,
        gateId: payload.gateId,
        sessionId: payload.sessionId,
        sessionPath: payload.sessionPath,
        endpointLeaseFailure: payload.endpointLeaseFailure,
        elapsedDeadlineAtMs: payload.elapsedDeadlineAtMs,
        // What continuo says the lap ran on, beside what rondo asked for. The
        // adapter answers the second one because only it knows the model tier's
        // price; comparing them is the interpreter's, exactly as comparing the
        // run ids is.
        model: payload.model,
        requestedModel: outcome.model,
        // continuo's own text, unread here: what it says is a person's to read
        // and the loop's only job is to get it onto the row (#88).
        permissionDenials: payload.permissionDenials,
        // **Read here, beside the answer that names the session, because this
        // is the one place every part of the path exists** (`D-0046` rule 2):
        // the state root and the run id are what this adapter just passed on the
        // command line, and `payload.sessionId` is what the lap answered with.
        // It is the same shape as `readLapWork` below -- a read of what the lap
        // left behind, taken by the composition root and never by the loop --
        // and it cannot fail the step: an unreadable transcript answers three
        // nulls.
        //
        // The run id is the plan's rather than the payload's on purpose: this
        // path has to be the one rondo passed, and whether continuo answered
        // about the same run is a check the interpreter makes afterwards, out
        // of the same two values.
        ...readLapSpendFields(plan.stateRoot, plan.runId, payload.sessionId),
      }));
    },
    showGate: async (plan, gateId): Promise<EffectOutcome<GateObservation>> =>
      asEffect(await showGate(continuo, { db: plan.db, gateId }), (payload) => ({
        gateId: payload.gateId,
        stage: payload.stage,
        outcome: payload.outcome,
      })),
    // **The first arrow from this module to `./forge.js`, and it is why the
    // reading needs no new capability** (D-0029 rule 5). `forge.ts` already
    // holds this layer's only `spawn` grant and already reads what a lap
    // produced; what this adds is a second caller and an earlier one, not a
    // third module that may start a process.
    //
    // It answers rather than refuses. `inspectLapWork` reports an unreadable
    // workspace as a value, `readingOf` turns that into an `unavailable`
    // verdict, and both are readings -- so this port's `EffectOutcome` is
    // `answered` on every path a person could reach. The refusal arms stay in
    // the type because the port is a promise this module keeps and not one it
    // is entitled to assume, and the interpreter maps them to the same
    // `unavailable` if a later wiring ever produces one.
    readLapWork: async (plan): Promise<EffectOutcome<LapReadingDraft>> => ({
      kind: "answered",
      value: readingOf(
        await inspectLapWork({
          workspace: plan.workspace,
          remote: READING_REMOTE,
          baseBranch: plan.baseBranch,
          topicBranch: plan.topicBranch,
        }),
      ),
    }),
  };
}

/**
 * Start rondo's conductor, or say why it cannot start.
 *
 * The verification comes first and everything else is behind it: a build whose
 * revision is unknown, dirty or simply not the pinned one is refused here rather
 * than driven and recorded afterwards (D-0015 rule 6, D-0017 rule 5).
 */
export async function openConductor(
  store: IterationStore,
  environment: Readonly<Record<string, string | undefined>> = process.env,
  now: () => number = Date.now,
): Promise<
  | { readonly kind: "ready"; readonly ports: ConductorPorts; readonly revision: string }
  | { readonly kind: "refused"; readonly reason: string }
> {
  const startup = await startContinuo(environment);
  if (startup.kind === "refused") {
    return { kind: "refused", reason: startup.reason };
  }
  return {
    kind: "ready",
    ports: conductorPorts(startup.continuo, store, now),
    revision: startup.continuo.revision,
  };
}

/**
 * The four verbs the operating surface calls, re-exported from the one surface
 * that composes them.
 *
 * They are thin on purpose: the state machine is `src/refrain`'s and adding
 * policy here would be adding it somewhere the loop cannot be tested against.
 * What this module contributes is the wiring above, and what it contributes to
 * *these* is a single place a surface has to import from.
 */
/**
 * Admit one request, and propose a retry if the arc ends `abandoned`.
 *
 * **`advisory` is required and is second, which is `D-0043` rule 3.** The
 * trigger is here rather than at this function's caller so that a second
 * surface -- a start button on the page -- gets it by construction, and it is
 * required rather than optional because a type is the only thing that makes
 * "a new caller cannot forget" true. `src/refrain` is unchanged by it and
 * `ConductorPorts` never learns the word advisory: an advisory the loop could
 * reach through its own ports is what the planted cases exist to keep out.
 *
 * **The ending, and only that ending.** `abandoned` reached *here* is cadenza's
 * `refused`, cadenza's `needs_approval` or a classification refusal -- all
 * three grant-shaped, which is what makes an option set the right answer to
 * them. The same status written by the human verb {@link abandon} is not this
 * one, and telling them apart by which path wrote the row costs no column and
 * no reading of a recorded sentence (rule 2).
 *
 * **Nothing here changes what the arc decided** (rule 11). The terminal
 * transition is committed before this function sees the report; whatever the
 * trigger could not do becomes a line on it, and a throw from the advisory --
 * from anywhere, including a port that was supposed to answer rather than
 * raise -- becomes one too.
 */
export async function admit(
  ports: ConductorPorts,
  advisory: UnpromptedPorts,
  plan: RunPlan,
  policy: LoopPolicy,
  id: string,
  supersedesIterationId: string | null = null,
  spend: DecisionSpend | null = null,
): Promise<ConductorReport> {
  const report = await admitIteration(ports, plan, policy, id, supersedesIterationId, spend);
  if (report.status !== "abandoned" || report.iterationId === null) {
    return report;
  }
  return { ...report, lines: [...report.lines, await proposeLine(advisory, report.iterationId)] };
}

/**
 * One line for the report, saying what the unprompted door did.
 *
 * The `catch` is rule 11's and is deliberately total: this runs after a
 * terminal transition is committed, so there is no failure here worth turning
 * an ended lap into an exception a surface has to decide what to do with.
 */
async function proposeLine(advisory: UnpromptedPorts, iterationId: string): Promise<string> {
  try {
    const outcome = await proposeAfterAbandon(advisory, iterationId);
    return outcome.kind === "proposed"
      ? `Proposed ${String(outcome.options)} contracts a retry could run under, as ` +
          `'${outcome.proposalId}' for a successor '${outcome.successorId}'. Nobody has been ` +
          "shown it: 'rondo show' reads it, 'rondo decide' answers it and 'rondo retry' " +
          "spends the answer."
      : outcome.reason;
  } catch (error) {
    return (
      `No retry was proposed for '${iterationId}': the advisory raised ` +
      `${error instanceof Error ? error.message : String(error)}. The iteration's own outcome ` +
      "stands."
    );
  }
}

/**
 * Look at the gate once, after a human has answered it.
 *
 * D-0019 rule 5, and the entry point D-0020 records as the one piece of the
 * operating surface lap 1 builds. Idempotent by construction: an open gate
 * leaves everything unchanged, so a surface that cannot be sure whether the
 * answer landed may simply call it again.
 */
export async function resume(ports: ConductorPorts, iterationId: string): Promise<ConductorReport> {
  return await resumeIteration(ports, iterationId);
}

/**
 * Ask the operating surface to close an open gate `withdrawn`.
 *
 * rondo records the ask and **never writes the outcome**: `closeOpenGate`
 * hard-codes `actorKind: "human"`, which is D-0013's whole reason for putting
 * the verb on the surface rather than in the conductor. A gate whose close has
 * been asked for is not thereby closed.
 */
export async function requestWithdrawal(
  ports: ConductorPorts,
  iterationId: string,
  reason: string,
): Promise<ConductorReport> {
  return await requestIterationWithdrawal(ports, iterationId, reason);
}

/**
 * Settle an iteration whose outcome rondo cannot establish.
 *
 * The last row of D-0019 rule 11's table, and the only way out of a row that is
 * holding the single-flight lock with nothing automatic able to release it -- a
 * `performing` row whose lap never answered, an `admitting` row that may or may
 * not have created a run, a `stalled` row, or a row that will not decode at all.
 * It writes a terminal record and **drives no continuo verb**, because there is
 * no verb here that is rondo's to drive: if a gate is open, closing it is
 * D-0013's ask, and if a run is open, closing it is D-0010's operator.
 */
export async function abandon(
  ports: ConductorPorts,
  iterationId: string,
  reason: string,
): Promise<ConductorReport> {
  return await abandonIteration(ports, iterationId, reason);
}

/**
 * The verb-driving escape hatch, re-exported unchanged.
 *
 * `gate list` is the verb a person needs when a lap answered nothing and rondo
 * cannot say whether a gate exists (D-0019 rule 11's `performing`-with-no-answer
 * row says so in as many words). It is re-exported here rather than reached for
 * through the barrel so that the surface has one import for everything it
 * drives.
 */
export { runContinuo };
