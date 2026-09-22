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
import type { ContinuoResult, LapSpend } from "../continuo/protocol.js";
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
  ScopeSpend,
  StorePort,
} from "../refrain/ports.js";
import { claimCover, lineShape, WHOLE_REPOSITORY } from "../store/lanes.js";
import {
  isDeterministicReadingDrafter,
  isModelReadingDrafter,
  type LaneClaimAsk,
  type LaneHolder,
  type LapReadingDraft,
  latestReading,
} from "../store/records.js";
import { type AdvisoryRecord, type IterationStore, LANE_LEDGER_AUTHOR } from "../store/sqlite.js";

import { DETERMINISTIC_DRAFTER, proposeAfterAbandon, type UnpromptedPorts } from "./advisory.js";
import type { ChecksReading } from "./checks-host.js";
import { discard, writeDelegationRecord } from "./delegation.js";
import {
  type ChangedPathsReading,
  type ChangedPathsRequest,
  type CommitLine,
  fetchLapBase,
  inspectLapWork,
  type LandingReading,
  type LandingRequest,
  type MergeMethod,
  readChangedPaths,
  readLanding,
} from "./forge.js";
import { hostFailure } from "./host-failure.js";
import { modelReadingLines } from "./model-review/judgement.js";
import { LIST_LIMIT, READING_REMOTE, readingOf } from "./review.js";

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
 * What the lap spent, in the three names {@link LapPerformance} carries, from
 * `lap perform`'s own `spend` (`continuo D-1112`).
 *
 * Named rather than spread because continuo's keys (`total_cost_usd`,
 * `num_turns`) and the port's are different vocabularies: naming the mapping is
 * what lets a reader see no fourth number appeared on the way across. A `null`
 * spend is continuo unable to say, and stays three nulls, never a zero.
 */
function lapSpendFields(
  spend: LapSpend | null,
): Pick<LapPerformance, "costUsd" | "turns" | "durationMs" | "spendSource"> {
  return spend === null
    ? { costUsd: null, turns: null, durationMs: null, spendSource: "notReported" }
    : {
        costUsd: spend.totalCostUsd,
        turns: spend.numTurns,
        durationMs: spend.durationMs,
        spendSource: "resultEvent",
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
  record: Pick<AdvisoryRecord, "recordThreadMessage"> | null,
  now: () => number = Date.now,
): ReportingPorts {
  const port: StorePort = store;
  return {
    store: port,
    thread: record === null ? null : { record, store },
    lanes: { store, readLanding, readChangedPaths, remote: READING_REMOTE },
    now,
    classify: async (plan) => classifyPlan(plan),
    startContinuo: async () => ({ kind: "answered", value: { revision: continuo.revision } }),
    admitRun: async (plan, neutralRoleName): Promise<EffectOutcome<RunAdmission>> => {
      // **A first lap starts from the forge's branch as it is now** (rondo#407,
      // D-0100): fetched before anything is written, and a fetch that fails is
      // a lap that does not start. A revision (`pullRequestBaseBranch` set) is
      // cut from its predecessor's topic branch, which is local and never
      // pushed, so there is nothing to fetch for it.
      let baseBranch = plan.baseBranch;
      if (plan.pullRequestBaseBranch === null) {
        const base = await fetchLapBase({
          repository: plan.repository,
          remote: READING_REMOTE,
          baseBranch: plan.baseBranch,
          runId: plan.runId,
        });
        if (base.kind === "refused") {
          return { kind: "refused", message: base.reason };
        }
        baseBranch = base.branch;
      }
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
          baseBranch,
          topicBranch: plan.topicBranch,
          prompt: plan.prompt,
          // The catalog project's `allowed_bash`, exactly the list the envelope
          // above records (D-0094): one resolution, so the two cannot differ.
          allowedBash: written.allowedBash,
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
        // What the lap ran and spent, off the same document (continuo
        // D-1112): continuo reads both from the verified transcript generation,
        // so rondo no longer computes its state-root layout to find them.
        commands: payload.commands,
        ...lapSpendFields(payload.spend),
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
  record: Pick<AdvisoryRecord, "recordThreadMessage"> | null = null,
): Promise<
  | { readonly kind: "ready"; readonly ports: ReportingPorts; readonly revision: string }
  | { readonly kind: "refused"; readonly reason: string }
> {
  const startup = await startContinuo(environment);
  if (startup.kind === "refused") {
    return { kind: "refused", reason: startup.reason };
  }
  return {
    kind: "ready",
    ports: conductorPorts(startup.continuo, store, record, now),
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
  ports: ReportingPorts,
  advisory: UnpromptedPorts,
  plan: RunPlan,
  policy: LoopPolicy,
  id: string,
  supersedesIterationId: string | null = null,
  spend: DecisionSpend | null = null,
  requestMessageId: string,
  scopeSpend: ScopeSpend | null = null,
  claim: LaneClaimAsk | null = null,
): Promise<ConductorReport> {
  const attempt = () =>
    admitIteration(
      ports,
      plan,
      policy,
      id,
      supersedesIterationId,
      spend,
      requestMessageId,
      scopeSpend,
      claim,
    );
  let report = await attempt();
  // **A refusal by a line whose work may have landed reads that landing now**
  // (D-0073 rule 7): with no resident host's tick to have read it, the next
  // admission attempt is where it is read. A release is attempted once more;
  // the refusal wrote nothing, so the second attempt is the first's.
  if (report.laneRefusal !== undefined && ports.lanes !== undefined && ports.lanes !== null) {
    const read = await readHolders(ports.lanes, report.laneRefusal.holders, ports.now());
    report = read.released
      ? await attempt().then((again) => ({ ...again, lines: [...read.lines, ...again.lines] }))
      : { ...report, lines: [...report.lines, ...read.lines] };
  }
  if (report.status === "awaiting_human") {
    return await withGateReport(ports, await withClaimComparison(ports, report));
  }
  if (report.status !== "abandoned" || report.iterationId === null) {
    return report;
  }
  return { ...report, lines: [...report.lines, await proposeLine(advisory, report.iterationId)] };
}

/**
 * Read each holding line's landing (D-0073 rules 6 and 7) and release the ones
 * that landed. A line is read only when every lap of it has ended and at least
 * one is `closed`: a lap at its gate or running holds its paths whatever its
 * diff says (rule 10). Every other outcome is a line of the report and writes
 * nothing; `undetermined` is said as itself.
 */
async function readHolders(
  lanes: LandingPorts,
  holders: readonly LaneHolder[],
  nowMs: number,
): Promise<{ readonly released: boolean; readonly lines: readonly string[] }> {
  const lines: string[] = [];
  let released = false;
  for (const holder of holders) {
    const said = await readHolder(lanes, holder.lineageId, nowMs);
    released ||= said.released;
    lines.push(said.line);
  }
  return { released, lines };
}

async function readHolder(
  lanes: LandingPorts,
  lineageId: string,
  nowMs: number,
): Promise<{ readonly released: boolean; readonly line: string }> {
  const undetermined = (reason: string) => ({
    released: false,
    line: `Whether line ${lineageId}'s work has landed is undetermined: ${reason}.`,
  });
  const read = await lanes.store.laneLine(lineageId);
  if (read.kind !== "read") {
    return undetermined(read.kind === "defect" ? read.reason : "the line is not in this store");
  }
  const { line } = read;
  const shape = lineShape(
    line.laps.map((lap) => ({
      id: lap.id,
      status: lap.status,
      supersedesIterationId: lap.supersedesIterationId,
    })),
  );
  if (shape.inFlight) {
    return {
      released: false,
      line: `Line ${lineageId} has a lap that has not ended, so it holds its paths until it does.`,
    };
  }
  const release = async (bases: readonly string[], said: string) => {
    const outcome = await lanes.store.releaseLane({
      iterationId: lineageId,
      takenOver: { claimId: line.claim?.claimId ?? null, lapIds: line.laps.map((lap) => lap.id) },
      authorKind: "drafter",
      authorId: LANE_LEDGER_AUTHOR,
      bases: bases.map((iterationId) => ({ form: "iteration", iterationId })),
      nowMs,
    });
    return outcome.kind === "released"
      ? { released: true, line: `${said}, so its paths were released.` }
      : { released: false, line: `${said}, and its paths were not released: ${outcome.reason}.` };
  };
  // Every lap ended and none closed: nothing is owed to the default branch, and
  // a claim still held here is a release rule 4.3 missed (a settle that could
  // not write it). It is released now rather than held for a press.
  if (shape.closedTips.length === 0) {
    return await release(
      line.laps.map((lap) => lap.id),
      `Line ${lineageId} has ended with nothing to land`,
    );
  }
  const root = line.laps[0];
  const repository = root?.plan["repository"];
  if (root === undefined || typeof repository !== "string") {
    return undetermined("its first lap's plan names no repository");
  }
  // The lineage's first base is the root lap's, and only the root's: a later
  // lap's reading is taken over its predecessor's branch, and the root's own
  // changes would fall out of the set. Each closed tip's tip is its own.
  const evidenceOf = async (iterationId: string) =>
    latestReading(await lanes.store.readingsFor(iterationId), isDeterministicReadingDrafter)
      ?.evidence ?? null;
  const baseCommit = (await evidenceOf(root.id))?.baseCommit ?? null;
  if (baseCommit === null) {
    return undetermined(`its first lap ${root.id} carries no reading of the base it was cut from`);
  }
  const tipCommits: string[] = [];
  for (const tip of shape.closedTips) {
    const evidence = await evidenceOf(tip);
    if (evidence === null) {
      return undetermined(`its closed lap ${tip} carries no reading of its commits`);
    }
    tipCommits.push(evidence.tipCommit);
  }
  const landing = await lanes.readLanding({
    repository,
    remote: lanes.remote,
    baseCommit,
    tipCommits,
  });
  if (landing.kind === "undetermined") {
    return undetermined(landing.reason);
  }
  if (landing.kind === "notLanded") {
    return {
      released: false,
      line:
        `Line ${lineageId}'s work is not on ${lanes.remote}/${landing.branch} yet: ` +
        `${landing.differing.map((path) => `'${path}'`).join(", ")} differ.`,
    };
  }
  return await release(
    shape.closedTips,
    `Line ${lineageId}'s work is on ${lanes.remote}/${landing.branch}`,
  );
}

/**
 * **The gate compares what the lap changed with what its line claims**
 * (D-0073 rule 5): its reading's `base...tip`, the range the landing reading
 * takes, against the in-force claim. A path outside the claim that another open
 * line holds is `D-0067` rule 2's collision; one nobody holds is said as
 * outside the claim. **Both are lines of the report and write nothing.** The
 * report is printed by the command line and by nothing else, so the page reads
 * the comparison for itself where the press is ({@link compareClaim}, and
 * `pageMaterial` in `src/access/cli.ts`): rondo#294, because a person who only
 * reads the page met a collision at merge time instead. Rule
 * 5's widening onto an unheld path is not written: the person answered at
 * rondo#283's gate that the ledger does not widen a claim by itself, and
 * whether to widen it is theirs. The collision's finding and its `sequence`
 * are `D-0067`'s, not built. It cannot fail the step: the gate is already
 * committed.
 */
async function withClaimComparison(
  ports: ReportingPorts,
  report: ConductorReport,
): Promise<ConductorReport> {
  if (ports.lanes === undefined || ports.lanes === null || report.iterationId === null) {
    return report;
  }
  const lines = claimComparisonLines(
    report.iterationId,
    await compareClaim(ports.lanes, report.iterationId),
  );
  return lines.length === 0 ? report : { ...report, lines: [...report.lines, ...lines] };
}

/**
 * What the gate's comparison found, as facts rather than as sentences.
 *
 * **Structured because the terminal is not the only place it is said**
 * (rondo#294). The report's lines are composed from this by
 * {@link claimComparisonLines} and are unchanged; the page composes the same
 * facts in the person's own words, out of their own repository's paths, and
 * writes nothing either.
 */
export type ClaimComparison =
  /** Nothing to compare, or nothing outside the claim: there is no finding here. */
  | { readonly kind: "inside" }
  /** The comparison could not be taken; `reason` is rondo's own and in English. */
  | { readonly kind: "uncompared"; readonly reason: string }
  | {
      readonly kind: "outside";
      readonly lineageId: string;
      /** Outside the claim and held by another open line: the collision. */
      readonly held: readonly LaneHolder[];
      /** Outside the claim and held by nobody. */
      readonly unheld: readonly string[];
    };

/** What {@link compareClaim} reads: {@link LandingPorts} minus the landing's half. */
export interface ClaimPorts {
  readonly store: Pick<IterationStore, "laneLine" | "readingsFor" | "compareLane">;
  readonly readChangedPaths: (request: ChangedPathsRequest) => Promise<ChangedPathsReading>;
}

export async function compareClaim(
  lanes: ClaimPorts,
  iterationId: string,
): Promise<ClaimComparison> {
  const uncompared = (reason: string): ClaimComparison => ({ kind: "uncompared", reason });
  const inside: ClaimComparison = { kind: "inside" };
  const lap = await lanes.store.laneLine(iterationId);
  if (lap.kind !== "read") {
    return uncompared(lap.kind === "defect" ? lap.reason : "the lap is not in this store");
  }
  const claim = lap.line.claim;
  // A claim on the whole repository, or a line from before the ledger (which
  // holds `/` while a lap is in flight), has nothing outside it.
  if (claim === null || claim.paths.includes(WHOLE_REPOSITORY)) {
    return inside;
  }
  const repository = lap.line.laps.find((each) => each.id === iterationId)?.plan["repository"];
  const evidence = latestReading(
    await lanes.store.readingsFor(iterationId),
    isDeterministicReadingDrafter,
  )?.evidence;
  if (typeof repository !== "string" || evidence === undefined || evidence === null) {
    return uncompared("its reading carries no base and tip to take the changed paths from");
  }
  const changed = await lanes.readChangedPaths({
    repository,
    baseCommit: evidence.baseCommit,
    tipCommit: evidence.tipCommit,
  });
  if (changed.kind === "undetermined") {
    return uncompared(changed.reason);
  }
  if (changed.paths.length === 0) {
    return inside;
  }
  const compared = await lanes.store.compareLane({
    iterationId,
    paths: changed.paths.map(claimCover),
  });
  if (compared.kind !== "compared") {
    return uncompared(
      compared.kind === "defect" ? compared.reason : "the lap is not in this store",
    );
  }
  return compared.held.length === 0 && compared.unheld.length === 0
    ? inside
    : {
        kind: "outside",
        lineageId: compared.lineageId,
        held: compared.held,
        unheld: compared.unheld,
      };
}

/** The report's lines, unchanged: what the terminal has printed since rondo#293. */
function claimComparisonLines(iterationId: string, comparison: ClaimComparison): readonly string[] {
  if (comparison.kind === "inside") {
    return [];
  }
  if (comparison.kind === "uncompared") {
    return [
      `What lap ${iterationId} changed was not compared with its line's claim: ${comparison.reason}.`,
    ];
  }
  const quoted = (paths: readonly string[]) => paths.map((path) => `'${path}'`).join(", ");
  return [
    ...comparison.held.map(
      (holder) =>
        `Lap ${iterationId} changed ${quoted(holder.sharedPaths)} outside line ` +
        `${comparison.lineageId}'s claim, and line ${holder.lineageId} holds it: the two lines ` +
        "collide there.",
    ),
    ...(comparison.unheld.length === 0
      ? []
      : [
          `Lap ${iterationId} changed ${quoted(comparison.unheld)} outside line ` +
            `${comparison.lineageId}'s claim, and no other open line holds it; the claim is ` +
            "left as it is.",
        ]),
  ];
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
      `${hostFailure(error).text}. The iteration's own outcome ` +
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
export async function resume(ports: ReportingPorts, iterationId: string): Promise<ConductorReport> {
  const before = await ports.store.read(iterationId);
  const report = await resumeIteration(ports, iterationId);
  // An open gate left as it was is no gate reached: a `revise` that walked a
  // second lap names a new gate, and only that one is reported.
  if (
    report.status !== "awaiting_human" ||
    (before.kind === "read" &&
      before.record.status === "awaiting_human" &&
      before.record.gateId === (await gateIdOf(ports, iterationId)))
  ) {
    return report;
  }
  return await withGateReport(ports, await withClaimComparison(ports, report));
}

/**
 * The surface's ports: the conductor's, and the request thread D-0061 step 5.3
 * reports into. `thread` is absent or null where nothing is reported -- a
 * test's hand-built ports, or `abandon`, which reaches no gate.
 */
export interface ReportingPorts extends ConductorPorts {
  readonly thread?: RequestThread | null;
  /**
   * What reads a holding line's landing when the lane ledger refuses an
   * admission (D-0073 rule 7, where no resident host's tick has read it
   * first). Absent in a fake that does not exercise it.
   */
  readonly lanes?: LandingPorts | null;
}

/** What {@link admit} reads and writes to release a line whose work has landed. */
export interface LandingPorts {
  readonly store: Pick<IterationStore, "laneLine" | "readingsFor" | "releaseLane" | "compareLane">;
  readonly readLanding: (request: LandingRequest) => Promise<LandingReading>;
  /** What reads the paths a lap at its gate changed (D-0073 rule 5). */
  readonly readChangedPaths: (request: ChangedPathsRequest) => Promise<ChangedPathsReading>;
  /** The remote `publish` pushes to, whose default branch is read. */
  readonly remote: string;
}

/** What a report into a request thread reads and writes. */
export interface RequestThread {
  readonly record: Pick<AdvisoryRecord, "recordThreadMessage">;
  readonly store: Pick<IterationStore, "read" | "readingsFor">;
}

/** What a report says happened to the lap (D-0061 step 5.3). */
export type LapEvent =
  | { readonly kind: "gate" }
  /** The model reading landed, after the gate opened (D-0065 2.6, rondo#218). */
  | { readonly kind: "modelReading" }
  /** `pullRequestUrl`: what the forge printed for the opened pull request, or null. */
  | { readonly kind: "published"; readonly pullRequestUrl: string | null }
  /**
   * A person pressed merge on the page and the forge merged it (rondo#380,
   * `D-0091`): where it went, how, and the commit the merge made.
   */
  | {
      readonly kind: "merged";
      readonly pullRequestUrl: string;
      readonly into: string;
      readonly method: MergeMethod;
      readonly mergeCommit: string | null;
    }
  /**
   * What the forge said about the published commit's checks (rondo#310).
   *
   * **Only the three answers a thread keeps.** A `pending` or an
   * `undetermined` is read again on the next tick and writes nothing, so a
   * thread never carries a line rondo is about to contradict.
   *
   * `moved` is a reading of a head the lap did not push (rondo#412): its
   * answer is named by that head too, so the answers about the lap's own head
   * do not stand for it.
   */
  | {
      readonly kind: "checks";
      readonly commit: string;
      readonly reading: Extract<ChecksReading, { kind: "green" | "red" | "none" }>;
      readonly moved?: boolean;
      /** Said again at this time: a rerun flipped the head back to an answer already said. */
      readonly retold?: number;
    }
  /**
   * The pull request was merged on the forge, and not by a press on the page
   * (rondo#413): where it went, and who the forge says merged it.
   */
  | {
      readonly kind: "mergedOutside";
      readonly pullRequestUrl: string;
      readonly into: string;
      readonly by: string | null;
      readonly mergeCommit: string | null;
    }
  /** The pull request was closed on the forge without a merge (rondo#413). */
  | { readonly kind: "closed"; readonly pullRequestUrl: string }
  /**
   * The forge will not merge the pull request as it stands at `head`, so it
   * runs no checks on it (rondo#411).
   */
  | {
      readonly kind: "conflict";
      readonly pullRequestUrl: string;
      readonly head: string;
      readonly base: string;
      /** The base commit it conflicts with, where the forge named one. */
      readonly baseCommit: string | null;
    }
  /**
   * The pull request's head is `to`, and not the `from` the lap pushed and
   * rondo read (rondo#412): somebody pushed to its branch outside rondo.
   * `commits` are what `to` carries that `from` does not.
   */
  | {
      readonly kind: "moved";
      readonly pullRequestUrl: string;
      readonly from: string;
      readonly to: string;
      readonly commits: readonly CommitLine[];
    };

/**
 * The message a checks answer is written under: one per answer, and per head
 * where the head is not the one the lap pushed (rondo#412).
 */
export function checksAnswerId(
  iterationId: string,
  kind: "green" | "red" | "none",
  commit: string,
  moved: boolean,
  retold?: number,
): string {
  return (
    `report-checks-${iterationId}-${kind}${moved ? `-${commit}` : ""}` +
    (retold === undefined ? "" : `-t${String(retold)}`)
  );
}

async function gateIdOf(ports: ConductorPorts, iterationId: string): Promise<string | null> {
  const after = await ports.store.read(iterationId);
  return after.kind === "read" ? after.record.gateId : null;
}

async function withGateReport(
  ports: ReportingPorts,
  report: ConductorReport,
): Promise<ConductorReport> {
  if (ports.thread === undefined || ports.thread === null || report.iterationId === null) {
    return report;
  }
  const line = await reportToRequest(
    ports.thread,
    report.iterationId,
    { kind: "gate" },
    ports.now(),
  );
  return line === null ? report : { ...report, lines: [...report.lines, line] };
}

/**
 * **D-0061 step 5.3: a `drafter` message into the request thread a lap names**,
 * when it reaches its gate -- which is also when it is read, since the D-0029
 * reading lands in the gate's own transaction -- and when it is published.
 *
 * **It reads rows and no request body.** `asks` is unset, so a report never
 * holds a line (D-0066 rule 4.4), and it replies to the request's root and never
 * to an asking message, which a reply would answer. The bases are the iteration
 * (the row that carries the gate id and the readings) and its continuo run.
 *
 * ponytail: the gate has no locator of its own until it has a transition
 * (`gateTransition` needs a seq the row does not hold) and a reading none at
 * all, so both are reached through the iteration basis rather than a new form.
 *
 * Returns a line for the report, or null when the lap names no request. A
 * report that could not be written never fails the step: the lap's own outcome
 * is committed before this runs.
 */
export async function reportToRequest(
  thread: RequestThread,
  iterationId: string,
  event: LapEvent,
  nowMs: number,
): Promise<string | null> {
  const found = await thread.store.read(iterationId);
  if (found.kind !== "read") {
    return `No report was written to the request thread: iteration '${iterationId}' did not read.`;
  }
  const row = found.record;
  const request = row.requestMessageId;
  let body: string;
  let messageId: string;
  if (event.kind === "gate") {
    const reading = latestReading(
      await thread.store.readingsFor(iterationId),
      (drafter) => !isModelReadingDrafter(drafter),
    );
    messageId = `report-gate-${iterationId}-${row.gateId ?? "none"}`;
    body =
      `Lap '${iterationId}' reached gate '${row.gateId ?? "(none recorded)"}' at stage ` +
      `'${row.gateStage ?? "(none recorded)"}'. ` +
      (reading === null
        ? "No independent reading is recorded for it."
        : `Its independent reading says '${reading.verdict}' with ` +
          `${String(reading.findings.length)} finding(s).`) +
      // rondo#218: the gate does not wait for the model reading (D-0065 2.6),
      // so a reader of the thread is told one may follow rather than shown a
      // lone "clear" the model reading later contradicts.
      " A model reading of this work may still be on its way; the gate does not wait for it, " +
      "and when it lands it is reported in this thread. Read it before answering.";
  } else if (event.kind === "modelReading") {
    const reading = latestReading(
      await thread.store.readingsFor(iterationId),
      isModelReadingDrafter,
    );
    if (reading === null) {
      return `No model reading was reported to the request '${request}': none is recorded.`;
    }
    messageId = `report-model-${iterationId}-${String(reading.readAtMs)}`;
    // The screen's own lines, so the thread carries the same severities,
    // bases and unresolved-basis marks a person at the terminal is shown.
    body =
      `Lap '${iterationId}' has a model reading at gate '${row.gateId ?? "(none recorded)"}':\n` +
      modelReadingLines(reading).join("\n");
  } else if (event.kind === "published") {
    messageId = `report-published-${iterationId}`;
    body =
      `Lap '${iterationId}' was published: its branch was pushed, pull request ` +
      `${event.pullRequestUrl ?? "(no URL printed)"} was opened, ` +
      `and run '${row.runId ?? "(none recorded)"}' was closed completed.`;
  } else if (event.kind === "merged") {
    // One per lap: a pull request is merged once, and the store's
    // `alreadyRecorded` makes a second write of the same line nothing.
    messageId = `report-merged-${iterationId}`;
    body =
      `Lap '${iterationId}' was merged on a person's press on the page: pull request ` +
      `${event.pullRequestUrl} went into '${event.into}' by ${event.method}` +
      (event.mergeCommit === null ? "." : ` as commit '${event.mergeCommit}'.`);
  } else if (event.kind === "mergedOutside") {
    // The same message as a press's merge, so a lap is said merged once
    // whichever way it went (rondo#413).
    messageId = `report-merged-${iterationId}`;
    body =
      `Lap '${iterationId}' was merged outside rondo: pull request ${event.pullRequestUrl} is ` +
      `merged into '${event.into}'` +
      (event.by === null ? "" : ` by '${event.by}'`) +
      (event.mergeCommit === null ? "" : ` as commit '${event.mergeCommit}'`) +
      ". It was not merged by a press on the page, and rondo did not merge it.";
  } else if (event.kind === "closed") {
    messageId = `report-closed-${iterationId}`;
    body =
      `Lap '${iterationId}' ended unmerged: pull request ${event.pullRequestUrl} was closed on ` +
      "the forge without being merged. rondo did not close it, and it does not reopen one.";
  } else if (event.kind === "conflict") {
    messageId = `report-conflict-${iterationId}-${event.head}`;
    body =
      `Lap '${iterationId}' conflicts: pull request ${event.pullRequestUrl} conflicts with its ` +
      `base '${event.base}'` +
      (event.baseCommit === null ? "" : ` at commit '${event.baseCommit}'`) +
      ` on commit '${event.head}', so the forge will not merge it as it ` +
      "stands and runs no checks on it until the conflict is resolved. rondo does not resolve " +
      "a conflict.";
  } else if (event.kind === "moved") {
    messageId = `report-moved-${iterationId}-${event.to}`;
    body = movedBody(iterationId, event);
  } else {
    // **One message per answer, and the answer is in the id**, so a reading
    // taken again over the same commit writes nothing (the store's
    // `alreadyRecorded`) and a pull request that goes from red to green leaves
    // both lines in the thread rather than one overwriting the other.
    messageId = checksAnswerId(
      iterationId,
      event.reading.kind,
      event.commit,
      event.moved === true,
      event.retold,
    );
    body = checksBody(iterationId, event.commit, event.reading);
  }
  const outcome = await thread.record.recordThreadMessage({
    messageId,
    body,
    authorKind: "drafter",
    authorId: DETERMINISTIC_DRAFTER,
    inReplyTo: request,
    atMs: nowMs,
    bases: [
      { form: "iteration", iterationId },
      ...(row.runId === null ? [] : [{ form: "continuoRun", runId: row.runId }]),
    ],
    asks: false,
  });
  return outcome.kind === "recorded"
    ? `Reported to the request '${request}' as message '${messageId}'.`
    : `No report was written to the request '${request}': ${outcome.reason}`;
}

/**
 * What the thread says a published lap's checks came to (rondo#310).
 *
 * **Every line says what rondo did *not* do.** Reading the checks is a `GET`
 * and the only act rondo takes on its own over a pull request it opened;
 * merging is on `D-0064` rule 3.4's irreversible list, a person's press per act
 * (`D-0091`), and a comment on the forge is no act a scope can include
 * (`SCOPE_OUTWARD_ACTS`). A red line that did not say so
 * would leave a reader waiting for a fix nothing is going to make.
 *
 * **The names are bounded and counted**, by `LIST_LIMIT` as every other list
 * rondo writes for a person is: a repository with two hundred checks must not
 * write a message nobody can read, and a hidden entry is said to be hidden.
 */
function checksBody(
  iterationId: string,
  commit: string,
  reading: Extract<ChecksReading, { kind: "green" | "red" | "none" }>,
): string {
  const on = `on commit '${commit}'`;
  const nothingElse =
    "rondo read this and did nothing else with the pull request: it does not comment on or retry " +
    "one, and it does not merge one unless a person presses merge.";
  if (reading.kind === "green") {
    // **A skipped check is not said to have passed** (rondo#376): the forge's
    // `skipped` and `neutral` do not fail the reading, and the sentence says
    // how many there were rather than folding them into "every one passed".
    // The page reads the two figures back off this sentence
    // (`page-logic/result.ts`), so its shape is pinned by a test.
    // Both figures every time, zero included: a report written before this
    // said "every one of them passed" over skipped checks too, so that phrase
    // is left meaning *none failed* and nothing more.
    const tally =
      `${String(reading.counted - reading.skipped)} passed and ` +
      `${String(reading.skipped)} ${reading.skipped === 1 ? "was" : "were"} skipped, ` +
      "and none failed";
    return (
      `Lap '${iterationId}' is green: the forge reported ${String(reading.counted)} check(s) ` +
      `${on}, and ${tally}. ${nothingElse}`
    );
  }
  if (reading.kind === "red") {
    // **A cancelled or timed-out check is said as what it came to**
    // (`continuo D-1113`), each list in its own clause; the page reads the
    // clauses back (`page-logic/result.ts`). A red written before this named
    // every one of them as failed, in the first clause's shape.
    const clauses = [
      [reading.failed, "failed"],
      [reading.cancelled, "cancelled"],
      [reading.timedOut, "timed out"],
    ] as const;
    const listed = clauses
      .filter(([names]) => names.length > 0)
      .map(([names, as]) => `${named(names)} as ${as}`)
      .join("; ");
    return `Lap '${iterationId}' is not green: ${on} the forge reports ${listed}. ${nothingElse}`;
  }
  // **Said rather than left as a silence**, and said as what it is: the forge
  // offers nothing that tells a repository with no checks apart from one whose
  // first check has not started, so neither is claimed -- and because neither
  // is claimed, this line is not the end of the reading.
  return (
    `The forge reported no check of any kind ${on}, the head of the pull request lap '${iterationId}' published. ` +
    "rondo cannot say whether this work is green. If a check reports later, it says so here."
  );
}

/**
 * What moved on a published pull request (rondo#412): both heads, and the
 * commits the new one carries, one line each and bounded by `LIST_LIMIT`. The
 * page reads the lines back (`page-logic/result.ts`), so their shape is pinned
 * by a test.
 */
function movedBody(iterationId: string, event: Extract<LapEvent, { kind: "moved" }>): string {
  const hidden = event.commits.length - LIST_LIMIT;
  return [
    `Lap '${iterationId}' moved: pull request ${event.pullRequestUrl} is at commit ` +
      `'${event.to}', and the head the lap pushed and rondo read is '${event.from}'. ` +
      `${String(event.commits.length)} commit(s) on it are not the lap's:`,
    ...event.commits.slice(0, LIST_LIMIT).map((one) => `- '${one.sha}' ${one.subject}`),
    ...(hidden > 0 ? [`- and ${String(hidden)} more`] : []),
    "rondo merges the new head only on a person's press that names it.",
  ].join("\n");
}

/** A bounded list of names, saying how many it did not name. */
function named(names: readonly string[]): string {
  const hidden = names.length - LIST_LIMIT;
  return (
    names
      .slice(0, LIST_LIMIT)
      .map((name) => `'${name}'`)
      .join(", ") + (hidden > 0 ? ` (and ${String(hidden)} more)` : "")
  );
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
