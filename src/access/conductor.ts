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
import { classifyPlan } from "../refrain/classification.js";
import {
  abandon as abandonIteration,
  admit as admitIteration,
  type ConductorReport,
  requestWithdrawal as requestIterationWithdrawal,
  resume as resumeIteration,
} from "../refrain/interpreter.js";
import type { RunPlan } from "../refrain/plan.js";
import type { LoopPolicy } from "../refrain/policy.js";
import type {
  ConductorPorts,
  EffectOutcome,
  GateObservation,
  LapPerformance,
  RunAdmission,
  StorePort,
} from "../refrain/ports.js";
import type { IterationStore } from "../store/sqlite.js";

export type { ConductorReport };

/**
 * Turn one continuo outcome into one conductor outcome.
 *
 * Five of the six mappings are ordinary. The sixth is the reason this function
 * is written out rather than inlined at four call sites:
 *
 * **`timedOut` maps to `noAnswer`, and it must never map to `refused` or
 * `defect`.** rondo's own ceiling firing means the *CLI* was killed and the
 * fenced child was not, so a worker may still be alive with nobody polling it.
 * The conductor reads `noAnswer` as "keep the single-flight lock and ask a
 * person", and reads `refused` and `defect` as "the child is over, release it".
 * Mapping a timeout onto either of those would let the next lap be admitted
 * while an orphan was still writing to the same worktree, which is the one race
 * D-0019 rules 11 and 12 exist to prevent. The whole cost of getting it wrong is
 * one line here, which is exactly why the line has a paragraph.
 *
 * `protocolRefusal` maps to `defect` rather than to `refused` because it is not
 * an answer addressed to an operator: it says the seam is not the seam rondo was
 * built against, and what a person does about it is re-pin continuo or teach
 * rondo the new shape. `refusedInProse` maps to `refused` because it *is*
 * continuo's answer, said in words rondo may relay but never parse.
 */
function asEffect<T, U>(result: ContinuoResult<T>, read: (payload: T) => U): EffectOutcome<U> {
  switch (result.kind) {
    case "answered":
      return { kind: "answered", value: read(result.payload) };
    case "refused":
      return { kind: "refused", message: result.message };
    case "refusedInProse":
      return { kind: "refused", message: result.text };
    case "protocolRefusal":
      return { kind: "defect", reason: result.reason };
    case "invokerDefect":
      return { kind: "defect", reason: result.reason };
    case "timedOut":
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
 */
function lapRequestOf(plan: RunPlan): PerformLapRequest {
  return {
    db: plan.db,
    runId: plan.runId,
    repository: plan.repository,
    artifactRoot: plan.artifactRoot,
    stateRoot: plan.stateRoot,
    endpointRecipient: plan.endpointRecipient,
    endpointDestinationDir: plan.endpointDestinationDir,
    claudeCommand: plan.claudeCommand,
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
    gateOptions: plan.gateOptions,
    gateDeadlineAtMs: plan.gateDeadlineAtMs,
    invocationCeilingMs: plan.invocationCeilingMs,
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
      const outcome = await admitRun(continuo, {
        db: plan.db,
        runId: plan.runId,
        leaseClaimantId: plan.leaseClaimantId,
        workspace: plan.workspace,
        neutralRoleName,
        baseBranch: plan.baseBranch,
        topicBranch: plan.topicBranch,
        prompt: plan.prompt,
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
    },
    performLap: async (plan): Promise<EffectOutcome<LapPerformance>> =>
      asEffect(await performLap(continuo, lapRequestOf(plan)), (payload) => ({
        // Kept rather than dropped: it is the only identity a lap's answer
        // carries that the conductor can check, and the check is the
        // interpreter's (see `LapPerformance.runId`).
        runId: payload.runId,
        gateId: payload.gateId,
        sessionId: payload.sessionId,
        sessionPath: payload.sessionPath,
        endpointLeaseFailure: payload.endpointLeaseFailure,
        elapsedDeadlineAtMs: payload.elapsedDeadlineAtMs,
      })),
    showGate: async (plan, gateId): Promise<EffectOutcome<GateObservation>> =>
      asEffect(await showGate(continuo, { db: plan.db, gateId }), (payload) => ({
        gateId: payload.gateId,
        stage: payload.stage,
        outcome: payload.outcome,
      })),
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
export async function admit(
  ports: ConductorPorts,
  plan: RunPlan,
  policy: LoopPolicy,
  id: string,
): Promise<ConductorReport> {
  return await admitIteration(ports, plan, policy, id);
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
