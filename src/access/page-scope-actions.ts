/**
 * The page's scope and start presses (rondo#570): recording, raising and pausing
 * a scope, starting a scoped or split plan, and the held-start port the order
 * tick drives.
 *
 * Moved out of `cli.ts` unchanged; the command-line helpers they share with the
 * commands (`say`, `approvedActor`, `walkGate`, ...) still live there.
 */
import { startContinuo } from "../continuo/invoker.js";
import { type RunPlan, readRunPlan } from "../refrain/plan.js";
import type { HostPolicy } from "../refrain/policy.js";
import { repositoryKey } from "../store/lanes.js";
import { canonicalJson } from "../store/plan.js";
import {
  approvedForPublication,
  isTerminal,
  type JsonRecord,
  type JsonValue,
  type LaneClaimAsk,
  requestsGoal,
  type ScopeBudgets,
  type ScopeDraft,
  type ScopeOutwardAct,
  type StoredScope,
  scopePayloadWithDefaults,
} from "../store/records.js";
import { type AdvisoryRecord, type IterationStore, openAdvisoryRecord } from "../store/sqlite.js";
import { OPERATOR_PAGE_SURFACE } from "./advisory.js";
import {
  approvedActor,
  hostFallbackWorker,
  hostLanguage,
  hostWords,
  numberingFor,
  START_POLICY,
  sayGateOpen,
  sayReport,
  unpromptedPorts,
  withNamedIssues,
  withReservedNumbers,
} from "./cli.js";
import { admit, conductorPorts } from "./conductor.js";
import { asciiEscape, consoleSeams } from "./console.js";
import {
  asPart,
  type DraftedStartReadiness,
  draftedStartReadiness,
  onLanding,
  partOf,
  planOrder,
} from "./drafted-start.js";
import { readChangedPaths } from "./forge.js";
import { goalScopeMaterial, goalScopeStanding } from "./goal-scope.js";
import { hostFailure } from "./host-failure.js";
import { draftedPlanRun, type HeldPlan, heldPlanByDigest } from "./model-draft/host.js";
import { isModelDrafterName } from "./model-draft/judgement.js";
import { modelReviewPorts, takeModelReading } from "./model-review/host.js";
import type { OrderHostPorts } from "./order-host.js";
import { answerOnceReserved } from "./page-actions.js";
import { requestWords } from "./page-logic/threads.js";
import { admitUnderScope, approvalTip, scopeCovers } from "./scope.js";
import type {
  GoalPauseInput,
  GoalScopeInput,
  RaiseInput,
  ScopedStartInput,
  ScopeFormDraft,
  ScopeRecorded,
  Started,
} from "./web-app.js";
import type { Chrome } from "./wording.js";

/**
 * One plan rondo holds for a request, by digest (rondo#238), or null when it is
 * not one; a refusal only when the plans will not read.
 */
async function heldPlanOf(
  ports: { readonly store: IterationStore; readonly record: AdvisoryRecord },
  requestMessageId: string,
  planDigest: string,
): Promise<{ readonly plan: HeldPlan | null } | { readonly refusal: string }> {
  try {
    return {
      plan: await heldPlanByDigest({ ...ports, now: Date.now }, requestMessageId, planDigest),
    };
  } catch (error) {
    return {
      refusal: `the plans rondo holds could not be read: ${hostFailure(error).text}`,
    };
  }
}

/**
 * One press of the page's record-scope button, in `commandScope`'s own order.
 *
 * `commandScope`'s *write, present, count* (D-0036 rule 1, D-0042 rule 3):
 * `recordScope` -> `readScope` back -> the `recordAttention` presented row ->
 * `recordScopeDecision` with **the digest read back**, never a posted one, so
 * the digest shown and the digest approved are one value by construction
 * (D-0066 rule 2.2). Exported so a test can drive it, as {@link recordPagePress}
 * is.
 *
 * **The plan is read again here and not taken from the form.** It may have
 * changed since the form was drawn, and what is recorded has to be what is on
 * disk at the moment of the write -- so the form carries the two digests it was
 * drawn from and this **compares** the re-read against them (rondo#233 S3 press
 * review). Not a second authority: nothing is written from the posted digests,
 * and a difference writes nothing at all. Without the comparison rule 2.2 held
 * to the letter -- the approval names the row's own digest -- while the person
 * approved a workspace and an agent type they never saw, because the only
 * fields the form does not post are exactly the ones that say where the work
 * may act.
 *
 * **`supersedesScopeId` is null in S3**: superseding a scope is a screen this
 * slice does not draw.
 */
export async function recordScopeFromPage(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  approver: string,
  draft: ScopeFormDraft,
): Promise<ScopeRecorded> {
  const notTaken = (note: string): ScopeRecorded => ({
    ok: false,
    why: "scopeRefusedNotTaken",
    note,
  });
  const actor = approvedActor(approver, environment);
  if ("refusal" in actor) {
    return notTaken(actor.refusal);
  }
  const record = openAdvisoryRecord(storePath);
  // **The plan is read again, from what rondo holds, and compared** (rondo#238,
  // the press review rondo#233 S3 gave the file this replaced): the form carries
  // only the two digests it was drawn with, never a plan, and a plan that is no
  // longer held -- or holds another agent type -- is a refusal.
  const chosen = await heldPlanOf({ store, record }, draft.requestMessageId, draft.planDigest);
  if ("refusal" in chosen) {
    return notTaken(chosen.refusal);
  }
  if (chosen.plan === null || chosen.plan.agentTypeDigest !== draft.agentTypeDigest) {
    return { ok: false, why: "scopeRefusedPlanChanged", note: "the plan is not the one drawn" };
  }
  const plan = chosen.plan;
  const createdAtMs = Date.now();
  const payload = scopePayloadWithDefaults({
    requests: [draft.requestMessageId],
    workspaces: [{ repository: plan.repository, workspace_root: plan.workspaceRoot }],
    agent_types: [plan.agentTypeDigest],
    budgets: { ...draft.budgets },
    severity_threshold: draft.severityThreshold,
    outward_acts: [...draft.outwardActs],
    // **Not editable on this screen** (rondo#233 S3): free-text names into a
    // closed list is what the screen's own axis forbids, so it is always
    // empty and the screen says so.
    irreversible_additions: [],
  } as unknown as JsonRecord);
  const written = await record.recordScope({
    scopeId: draft.scopeId,
    payload,
    supersedesScopeId: null,
    authorKind: "operator",
    authorId: actor.actorId,
    bases: [],
    createdAtMs,
    // D-0069 section 1's operator path: a plan's agent type recorded with the
    // person's scope, a no-op for a digest rondo already holds.
    agentTypeRecords: [
      {
        agentTypeDigest: plan.agentTypeDigest,
        agentTypeInput: plan.agentTypeInput,
        planDigest: plan.planDigest,
      },
    ],
  });
  const stored = await record.readScope(draft.scopeId);
  // **A second press of one form is the write it repeats**, as a repeated
  // `message_id` already is on the send routes: the id was minted when the form
  // was drawn precisely so the store refuses the second row, and the scope the
  // person drafted is there under that id. Any other holder of the id is a
  // refusal like the rest.
  //
  // **And the same id has to be the same scope.** A form returned from the
  // browser's back button carries the id it was drawn with and whatever the
  // person has typed since; the store refuses the row on the id, the approval
  // that is already there is read back, and the screen would say *approved*
  // about numbers that were just replaced (rondo#233 S3 press review). The
  // payload is what is compared, because the id proves only which form this is.
  const ours =
    stored.kind === "read" &&
    stored.scope.authorKind === "operator" &&
    stored.scope.authorId === actor.actorId;
  if (written.kind !== "recorded" && !ours) {
    return notTaken(written.reason);
  }
  if (
    written.kind !== "recorded" &&
    stored.kind === "read" &&
    canonicalJson(stored.scope.payload as unknown as JsonValue) !==
      canonicalJson(payload as unknown as JsonValue)
  ) {
    return { ok: false, why: "scopeRefusedEdited", note: "this form was recorded as it was drawn" };
  }
  if (stored.kind !== "read") {
    return {
      ok: false,
      why: "scopeRefusedNotRead",
      note: `scope '${draft.scopeId}' was recorded and will not read back: ${
        stored.kind === "absent" ? "it is not there" : stored.reason
      }`,
    };
  }
  return await approveStoredScope(record, actor.actorId, stored.scope, createdAtMs);
}

/**
 * What the drafted scope's form posts (D-0071 rule 5.3): the draft it was drawn
 * over, by id and digest, and the values the person may change. The lists --
 * requests, workspaces, agent types -- are never posted: they are the draft's.
 */
export interface DraftedScopeForm {
  readonly draftScopeId: string;
  /** The digest the form was drawn with, compared with the row's (D-0066 rule 2.2). */
  readonly draftDigest: string;
  /** Minted at draw, for the person's own scope when they changed a value. */
  readonly scopeId: string;
  readonly budgets: ScopeBudgets;
  readonly severityThreshold: string;
  readonly outwardActs: readonly ScopeOutwardAct[];
}

/**
 * One press of the drafted scope's form (D-0071 rule 5.3), and the one place
 * that decides which of its two acts the press is:
 *
 * - **the values as drafted**: a `scope_decision` on the drafter's own row;
 * - **any value changed**: a new `operator` scope that supersedes the draft,
 *   with a `scope:` basis to it, and the approval on that row. The values are
 *   the person's because the person submitted them; the draft is kept, and
 *   linked, so nothing composed is stored under the person's voice.
 *
 * Decided by comparing the payload the press would record with the draft's,
 * byte for byte, so which act it was is a fact of the rows and not of a button.
 */
export async function recordDraftedScopeFromPage(
  environment: Readonly<Record<string, string | undefined>>,
  storePath: string,
  approver: string,
  form: DraftedScopeForm,
): Promise<ScopeRecorded> {
  const notTaken = (note: string): ScopeRecorded => ({
    ok: false,
    why: "scopeRefusedNotTaken",
    note,
  });
  const actor = approvedActor(approver, environment);
  if ("refusal" in actor) {
    return notTaken(actor.refusal);
  }
  const record = openAdvisoryRecord(storePath);
  const read = await record.readScope(form.draftScopeId);
  if (read.kind !== "read") {
    return notTaken(
      read.kind === "absent"
        ? `there is no scope '${form.draftScopeId}'`
        : `the scope '${form.draftScopeId}' will not read: ${read.reason}`,
    );
  }
  const drafted = read.scope;
  if (drafted.authorKind !== "drafter" || !isModelDrafterName(drafted.authorId)) {
    return notTaken(`the scope '${form.draftScopeId}' is not a drafted one`);
  }
  if (drafted.scopeDigest !== form.draftDigest) {
    return { ok: false, why: "scopeRefusedPlanChanged", note: "the draft is not the one drawn" };
  }
  const createdAtMs = Date.now();
  const payload = scopePayloadWithDefaults({
    ...(drafted.payload as unknown as JsonRecord),
    budgets: { ...form.budgets },
    severity_threshold: form.severityThreshold,
    outward_acts: [...form.outwardActs],
  } as unknown as JsonRecord);
  if (
    canonicalJson(payload as unknown as JsonValue) ===
    canonicalJson(drafted.payload as unknown as JsonValue)
  ) {
    // **A draft an approved successor retired is not approved again** (D-0066
    // rule 1.4): the store would take the decision, and it could admit nothing
    // -- a start under it would stop at the superseded test and write a stop
    // over the request the person's own scope now covers.
    if (await record.scopeSupersededByApproved(drafted.scopeId)) {
      return {
        ok: false,
        why: "scopeRefusedPlanChanged",
        note: "the draft was replaced by an approved scope",
      };
    }
    return await approveStoredScope(record, actor.actorId, drafted, createdAtMs);
  }
  // An edited press against a draft another approved scope already replaced
  // is refused too -- else two tabs would leave two approved successors with
  // budgets of their own -- unless it is this form's own write, replayed.
  if (
    (await record.readScope(form.scopeId)).kind === "absent" &&
    (await record.scopeSupersededByApproved(drafted.scopeId))
  ) {
    return {
      ok: false,
      why: "scopeRefusedPlanChanged",
      note: "the draft was replaced by an approved scope",
    };
  }
  const written = await record.recordScope({
    scopeId: form.scopeId,
    payload,
    supersedesScopeId: drafted.scopeId,
    authorKind: "operator",
    authorId: actor.actorId,
    bases: [{ form: "scope", scopeId: drafted.scopeId }],
    createdAtMs,
    // The agent types are the draft's, which its own write already recorded.
    agentTypeRecords: [],
  });
  const stored = await record.readScope(form.scopeId);
  // A second press of one form is the write it repeats, as `recordScopeFromPage`
  // reads it: the id is the form's, and the payload has to be the same too.
  const ours =
    stored.kind === "read" &&
    stored.scope.authorKind === "operator" &&
    stored.scope.authorId === actor.actorId &&
    stored.scope.supersedesScopeId === drafted.scopeId;
  if (written.kind !== "recorded" && !ours) {
    return notTaken(written.reason);
  }
  if (stored.kind !== "read") {
    return {
      ok: false,
      why: "scopeRefusedNotRead",
      note: `scope '${form.scopeId}' was recorded and will not read back`,
    };
  }
  if (
    written.kind !== "recorded" &&
    canonicalJson(stored.scope.payload as unknown as JsonValue) !==
      canonicalJson(payload as unknown as JsonValue)
  ) {
    return { ok: false, why: "scopeRefusedEdited", note: "this form was recorded as it was drawn" };
  }
  return await approveStoredScope(record, actor.actorId, stored.scope, createdAtMs);
}

/**
 * One press of the raise form (D-0074 section 4): a successor of the approval
 * the lap at this gate spends, **differing from it only in its budgets**,
 * recorded and approved by the writes a first scope takes -- one scope row with
 * `supersedes_scope_id` set, then its approval -- so a raise is recorded
 * exactly as `recordScopeFromPage` records a first scope.
 *
 * **Everything but the budgets is copied from the stored row, never from the
 * form** (rule 1.1): widening where the work may act is another question, and
 * it keeps going through the full scope screen.
 *
 * **Refused, writing nothing** (rule 4.4): the lap is no longer at a gate; the
 * posted approval is not its line's tip (somebody raised it already); the line
 * has two tips. The store refuses the second approved successor itself (rule
 * 1.3), so two raises drawn over one approval and pressed together leave one.
 * A second press of one form is the write it repeats, as the scope forms' are.
 *
 * **One raise of an approval at a time** (Codex round 1), for
 * `startSplitFromPage`'s reason: two presses over one approval would both pass
 * the tip test before either approved, and the store's refusal of the second
 * approval would come after its scope row was written -- a refusal that wrote
 * something. Run after the first, the second finds the tip moved and writes
 * nothing.
 */
export async function raiseScopeFromPage(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  approver: string,
  input: RaiseInput,
): Promise<ScopeRecorded> {
  const ahead = raising.get(input.scopeDecisionId) ?? Promise.resolve();
  const running = ahead
    .catch(() => undefined)
    .then(() => raiseScope(environment, store, storePath, approver, input));
  raising.set(input.scopeDecisionId, running);
  try {
    return await running;
  } finally {
    if (raising.get(input.scopeDecisionId) === running) {
      raising.delete(input.scopeDecisionId);
    }
  }
}

/** Every raise this process is recording, by the approval it raises. */
const raising = new Map<string, Promise<ScopeRecorded>>();

async function raiseScope(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  approver: string,
  input: RaiseInput,
): Promise<ScopeRecorded> {
  const notTaken = (note: string): ScopeRecorded => ({
    ok: false,
    why: "scopeRefusedNotTaken",
    note,
  });
  const actor = approvedActor(approver, environment);
  if ("refusal" in actor) {
    return notTaken(actor.refusal);
  }
  const found = await store.read(input.iterationId);
  // At its gate, or approved and closed: the conflict fix of rondo#417 starts
  // one more attempt of an approved lap, and its card offers this raise where
  // the budget would refuse that attempt (D-0105, Codex round 1). Or stopped
  // by the budget, whose question offers this raise with carrying on (D-0140
  // rule 3).
  if (
    found.kind !== "read" ||
    (!approvedForPublication(found.record) &&
      !(found.record.status === "failed" && found.record.failureKind === "budget") &&
      (isTerminal(found.record.status) || found.record.gateId === null))
  ) {
    return {
      ok: false,
      why: "raiseRefusedNotAtGate",
      note: `iteration '${input.iterationId}' has no gate open and was not approved`,
    };
  }
  const record = openAdvisoryRecord(storePath);
  const decided = await record.readScopeDecision(input.scopeDecisionId);
  if (decided.kind !== "read" || decided.decision.outcome !== "approved") {
    return notTaken(`'${input.scopeDecisionId}' is not an approval in this store`);
  }
  const read = await record.readScope(decided.decision.scopeId);
  if (read.kind !== "read") {
    return notTaken(`the scope '${decided.decision.scopeId}' will not read`);
  }
  const predecessor = read.scope;
  if (!(await scopeCovers(record, predecessor.payload, input.requestMessageId))) {
    return notTaken(`the scope '${predecessor.scopeId}' does not list this request`);
  }
  const already = await record.readScope(input.scopeId);
  const ours = (scope: StoredScope): boolean =>
    scope.authorKind === "operator" &&
    scope.authorId === actor.actorId &&
    scope.supersedesScopeId === predecessor.scopeId;
  // Checked against the lap's line, not the form: the approval raised is the
  // one its next act would spend. A replay of this form's own write has moved
  // the tip to that write, and is let through to find it.
  const tip = await approvalTip(record, input.iterationId);
  if (tip.kind === "forked") {
    return {
      ok: false,
      why: "raiseRefusedForked",
      note: `the line has two approved tips, ${tip.scopeDecisionIds.join(" and ")}`,
    };
  }
  if (
    !(already.kind === "read" && ours(already.scope)) &&
    (tip.kind !== "tip" || tip.scopeDecisionId !== input.scopeDecisionId)
  ) {
    return {
      ok: false,
      why: "raiseRefusedNotTip",
      note:
        tip.kind === "tip"
          ? `iteration '${input.iterationId}' now spends '${tip.scopeDecisionId}'`
          : `iteration '${input.iterationId}' was admitted under no approval`,
    };
  }
  const createdAtMs = Date.now();
  const payload = scopePayloadWithDefaults({
    ...(predecessor.payload as unknown as JsonRecord),
    budgets: { ...input.budgets },
  } as unknown as JsonRecord);
  const written = await record.recordScope({
    scopeId: input.scopeId,
    payload,
    supersedesScopeId: predecessor.scopeId,
    authorKind: "operator",
    authorId: actor.actorId,
    bases: [{ form: "scope", scopeId: predecessor.scopeId }],
    createdAtMs,
    // The agent types are the predecessor's, which its own write recorded.
    agentTypeRecords: [],
  });
  const stored = await record.readScope(input.scopeId);
  if (written.kind !== "recorded" && !(stored.kind === "read" && ours(stored.scope))) {
    return notTaken(written.reason);
  }
  if (stored.kind !== "read") {
    return {
      ok: false,
      why: "scopeRefusedNotRead",
      note: `scope '${input.scopeId}' was recorded and will not read back`,
    };
  }
  if (
    written.kind !== "recorded" &&
    canonicalJson(stored.scope.payload as unknown as JsonValue) !==
      canonicalJson(payload as unknown as JsonValue)
  ) {
    return { ok: false, why: "scopeRefusedEdited", note: "this form was recorded as it was drawn" };
  }
  return await approveStoredScope(record, actor.actorId, stored.scope, createdAtMs);
}

/**
 * Every goal scope press this process is recording, one at a time: the check
 * that no other approval stands over the goal and the write are then one step,
 * as `raising` makes a raise's (Codex round 1 there).
 *
 * ponytail: one chain for every goal; per goal if presses ever queue.
 */
let goalPressing: Promise<unknown> = Promise.resolve();

function inGoalLine<T>(run: () => Promise<T>): Promise<T> {
  const running = goalPressing.catch(() => undefined).then(run);
  goalPressing = running;
  return running;
}

/**
 * One press of the goal scope's approve button (D-0128, rondo#471): a scope
 * whose `requests` is `{"from_goal": ...}`, recorded and approved on one press,
 * which is the person's P1 over every request the flow injects from the goal.
 *
 * **The lists are read again, never posted**: the goal must still be the
 * repository's newest (rule 3: an edited goal is another id, and approving it
 * is approving again), and the workspaces and agent types re-read from the
 * held plans must be the ones the screen drew (`drawn`).
 *
 * **One approval in force per goal.** A first press is refused while one
 * stands; a resume names the paused one and is its successor, so the pause is
 * retired by the approval that ends it (D-0066 rule 1.4).
 */
export async function recordGoalScopeFromPage(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  approver: string,
  input: GoalScopeInput,
): Promise<ScopeRecorded> {
  return await inGoalLine(async () => {
    const actor = approvedActor(approver, environment);
    if ("refusal" in actor) {
      return { ok: false, why: "scopeRefusedNotTaken", note: actor.refusal };
    }
    const record = openAdvisoryRecord(storePath);
    const read = await goalScopeMaterial({ store, record, now: Date.now }, input.repository);
    if (read.kind !== "read" || read.material.goal.goalId !== input.goalId) {
      return {
        ok: false,
        why: "goalScopeRefusedGoalChanged",
        note: `goal '${input.goalId}' is not the newest goal of ${input.repository}`,
      };
    }
    const material = read.material;
    if (material.drawn !== input.drawn) {
      return {
        ok: false,
        why: "scopeRefusedPlanChanged",
        note: "the plans held for this repository are not the ones drawn",
      };
    }
    const standing = await goalScopeStanding(record, material.goal.goalId);
    const replay = await record.readScope(input.scopeId);
    // **Only an approved replay passes** (Codex round 2): a row this form
    // wrote whose approval never landed is tested like a first press, else a
    // retry after another approval would approve a second root over the goal.
    const replayed =
      replay.kind === "read" &&
      replay.scope.authorId === actor.actorId &&
      (await approvedScope(record, input.scopeId));
    const resumes = standing.kind === "paused" ? standing.scopeDecisionId : null;
    if (!replayed && (standing.kind === "running" || resumes !== input.resumes)) {
      return {
        ok: false,
        why: "goalScopeRefusedMoved",
        note: `the goal's approval is ${standing.kind} and the screen was drawn over another state`,
      };
    }
    // The paused approval's row, read by the id the form carried, so a replay
    // after the resume went through supersedes what the first press did.
    const paused = input.resumes === null ? null : await record.readScopeDecision(input.resumes);
    if (paused !== null && paused.kind !== "read") {
      return { ok: false, why: "goalScopeRefusedMoved", note: `'${input.resumes}' will not read` };
    }
    const payload = scopePayloadWithDefaults({
      requests: { from_goal: material.goal.goalId },
      workspaces: material.workspaces,
      agent_types: material.agentTypes.map((one) => one.agentTypeDigest),
      budgets: { ...input.budgets },
      severity_threshold: input.severityThreshold,
      outward_acts: [...input.outwardActs],
      irreversible_additions: [],
    } as unknown as JsonRecord);
    return await recordOperatorScope(record, actor.actorId, {
      scopeId: input.scopeId,
      payload,
      supersedes: paused === null ? null : paused.decision.scopeId,
      agentTypeRecords: material.agentTypes,
    });
  });
}

/**
 * One press of the goal scope's pause button (D-0128 rule 4): a successor of
 * the approval in force, **differing only in `laps`, which is 0**, recorded
 * and approved as a raise is. A lap already running is not stopped; the flow
 * starts nothing more, because no lap is left to admit.
 */
export async function pauseGoalScopeFromPage(
  environment: Readonly<Record<string, string | undefined>>,
  storePath: string,
  approver: string,
  input: GoalPauseInput,
): Promise<ScopeRecorded> {
  return await inGoalLine(async () => {
    const notTaken = (note: string): ScopeRecorded => ({
      ok: false,
      why: "scopeRefusedNotTaken",
      note,
    });
    const actor = approvedActor(approver, environment);
    if ("refusal" in actor) {
      return notTaken(actor.refusal);
    }
    const record = openAdvisoryRecord(storePath);
    const decided = await record.readScopeDecision(input.scopeDecisionId);
    if (decided.kind !== "read" || decided.decision.outcome !== "approved") {
      return notTaken(`'${input.scopeDecisionId}' is not an approval in this store`);
    }
    const read = await record.readScope(decided.decision.scopeId);
    if (read.kind !== "read" || requestsGoal(read.scope.payload.requests) === null) {
      return notTaken(`'${input.scopeDecisionId}' is not a goal scope's approval`);
    }
    const predecessor = read.scope;
    const replay = await record.readScope(input.scopeId);
    const replayed =
      replay.kind === "read" &&
      replay.scope.authorId === actor.actorId &&
      replay.scope.supersedesScopeId === predecessor.scopeId &&
      (await approvedScope(record, input.scopeId));
    if (
      !replayed &&
      (predecessor.payload.budgets.laps === 0 ||
        (await record.scopeSupersededByApproved(predecessor.scopeId)))
    ) {
      return {
        ok: false,
        why: "goalScopeRefusedMoved",
        note: `'${input.scopeDecisionId}' is paused or no longer in force`,
      };
    }
    const payload = scopePayloadWithDefaults({
      ...(predecessor.payload as unknown as JsonRecord),
      budgets: { ...predecessor.payload.budgets, laps: 0 },
    } as unknown as JsonRecord);
    return await recordOperatorScope(record, actor.actorId, {
      scopeId: input.scopeId,
      payload,
      supersedes: predecessor.scopeId,
      agentTypeRecords: [],
    });
  });
}

/** Whether a scope row carries an `approved` decision. */
async function approvedScope(record: AdvisoryRecord, scopeId: string): Promise<boolean> {
  const decided = await record.scopeDecisionOf(scopeId);
  return decided.kind === "read" && decided.decision.outcome === "approved";
}

/**
 * Write a person's scope row, read it back, and approve it -- the tail the
 * goal scope's two presses share. A second press of one form is the write it
 * repeats, and has to be the same scope (`recordScopeFromPage`'s reading).
 */
async function recordOperatorScope(
  record: AdvisoryRecord,
  actorId: string,
  draft: {
    readonly scopeId: string;
    readonly payload: ReturnType<typeof scopePayloadWithDefaults>;
    readonly supersedes: string | null;
    readonly agentTypeRecords: ScopeDraft["agentTypeRecords"];
  },
): Promise<ScopeRecorded> {
  const createdAtMs = Date.now();
  const written = await record.recordScope({
    scopeId: draft.scopeId,
    payload: draft.payload,
    supersedesScopeId: draft.supersedes,
    authorKind: "operator",
    authorId: actorId,
    bases: draft.supersedes === null ? [] : [{ form: "scope", scopeId: draft.supersedes }],
    createdAtMs,
    agentTypeRecords: draft.agentTypeRecords,
  });
  const stored = await record.readScope(draft.scopeId);
  const ours =
    stored.kind === "read" &&
    stored.scope.authorKind === "operator" &&
    stored.scope.authorId === actorId &&
    stored.scope.supersedesScopeId === draft.supersedes;
  if (written.kind !== "recorded" && !ours) {
    return { ok: false, why: "scopeRefusedNotTaken", note: written.reason };
  }
  if (stored.kind !== "read") {
    return {
      ok: false,
      why: "scopeRefusedNotRead",
      note: `scope '${draft.scopeId}' was recorded and will not read back`,
    };
  }
  if (
    written.kind !== "recorded" &&
    canonicalJson(stored.scope.payload as unknown as JsonValue) !==
      canonicalJson(draft.payload as unknown as JsonValue)
  ) {
    return { ok: false, why: "scopeRefusedEdited", note: "this form was recorded as it was drawn" };
  }
  return await approveStoredScope(record, actorId, stored.scope, createdAtMs);
}

/** One press of a drafted plan's start button: which approval, which split, which plan. */
export interface SplitStartInput {
  readonly iterationId: string;
  readonly requestMessageId: string;
  readonly scopeDecisionId: string;
  readonly proposalId: string;
  readonly planIndex: number;
}

/**
 * One press of a drafted plan's start button (rondo#238 C2, D-0063 rule 4):
 * the plan read back from the split proposal row, and admitted under the scope
 * as a lineage start **naming that proposal** (D-0066 rule 3.3).
 *
 * **What the page already said is asked again, and a no is not an act**: a
 * plan that will not run, one a lap already started from, and a host with no
 * room are refused here, before anything is admitted, with the reason the
 * screen gave. The scope's own tests stay `admitUnderScope`'s, which writes
 * D-0066 rule 4.4's stop when they refuse -- a page that drew this button
 * found them passing, so that is a page gone stale, and the stop is the
 * durable record of the line it stops.
 */
export async function startSplitFromPage(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  approver: string,
  policy: HostPolicy,
  input: SplitStartInput,
): Promise<Started> {
  const started = starting.get(input.iterationId);
  if (started !== undefined) {
    return await started;
  }
  // **One plan, one press at a time, whatever form it came from** -- two tabs
  // mint two iteration ids -- so a second press runs after the first reserved
  // its lap and finds it: "already started", not a second lap on one plan.
  const planKey = `${input.requestMessageId}\u0000${input.proposalId}\u0000${String(input.planIndex)}`;
  const ahead = startingPlan.get(planKey) ?? Promise.resolve();
  const running = ahead
    .catch(() => undefined)
    .then(() => startSplit(environment, store, storePath, approver, policy, input));
  starting.set(input.iterationId, running);
  startingPlan.set(planKey, running);
  try {
    return await running;
  } finally {
    starting.delete(input.iterationId);
    if (startingPlan.get(planKey) === running) {
      startingPlan.delete(planKey);
    }
  }
}

/** Why a plan waiting on an earlier plan of its split is not started (D-0098 rule 1). */
function orderedNote(ready: Extract<DraftedStartReadiness, { kind: "ordered" }>): string {
  const plan = `plan ${String(ready.after)} of this split`;
  if (ready.first === null) {
    return `this plan waits until ${plan} has started and landed`;
  }
  return ready.first.state === "endedUnlanded"
    ? `this plan waits on ${plan} (line ${ready.first.lineageId}), which ended without landing; ` +
        "it does not start until that work lands"
    : `this plan waits until ${plan} (line ${ready.first.lineageId}) has landed; it then starts by itself`;
}

/** Every drafted plan this process is starting, by request, proposal and plan. */
const startingPlan = new Map<string, Promise<Started>>();

async function startSplit(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  approver: string,
  policy: HostPolicy,
  input: SplitStartInput,
): Promise<Started> {
  const actor = approvedActor(approver, environment);
  if ("refusal" in actor) {
    return { ok: false, why: "startRefusedNotAdmitted", note: actor.refusal };
  }
  // A second submit of one form is the lap it already started (`startScoped`).
  const already = await store.read(input.iterationId);
  if (already.kind === "read") {
    return { ok: true, note: `iteration '${input.iterationId}' was already admitted` };
  }
  if (already.kind === "unreadable") {
    return {
      ok: false,
      why: "startRefusedNotAdmitted",
      note: `a row for iteration '${input.iterationId}' is already there and will not read: ${already.reason}`,
    };
  }
  const record = openAdvisoryRecord(storePath);
  const ready = await draftedStartReadiness(
    { store, record, policy, nowMs: Date.now() },
    input.requestMessageId,
    input.scopeDecisionId,
    input.proposalId,
    input.planIndex,
  );
  switch (ready.kind) {
    case "unrunnable":
      return { ok: false, why: "startRefusedNoPlan", note: ready.reason };
    case "started":
      return {
        ok: false,
        why: "startRefusedNotAdmitted",
        note: `iteration '${ready.iterationId}' already started from this plan`,
      };
    // D-0098 rule 1: nothing admits `then` before `first` has landed, whether
    // pressed or ticked. No press lifts an order (rule 1.5 is the person's P3).
    case "ordered":
      return { ok: false, why: "startRefusedNotAdmitted", note: orderedNote(ready) };
    case "busy":
    case "full":
      return {
        ok: false,
        why: "startRefusedNotAdmitted",
        note: `this host has no room for another lap (${ready.kind})`,
      };
    case "outside":
    case "undecidable":
    // Held files are attempted too: the attempt is where a holding line's
    // landing is read (D-0073 rule 7), and `reserve()` refuses what still holds.
    case "held":
    case "ready": {
      const run = await draftedPlanRun(
        { record },
        input.requestMessageId,
        input.proposalId,
        input.planIndex,
      );
      if (run.kind !== "runnable") {
        return { ok: false, why: "startRefusedNoPlan", note: run.reason };
      }
      // Read again beside the plan it admits (the readiness above may be a
      // `outside` that says nothing of the order): `first`'s landing is a basis
      // of the admission and named in its prompt (D-0098 rule 1.6).
      const order = await planOrder(
        { store, record },
        input.requestMessageId,
        input.proposalId,
        run,
      );
      if (order.kind === "waiting") {
        return {
          ok: false,
          why: "startRefusedNotAdmitted",
          note: orderedNote({ kind: "ordered", after: order.after, first: order.first }),
        };
      }
      // rondo#520: the part it is and the request's earlier line it starts from.
      const part = await partOf(
        { store, record },
        input.requestMessageId,
        input.proposalId,
        input.planIndex,
        run,
        order,
      );
      const changed =
        part.earlier.kind === "line"
          ? await readChangedPaths({
              repository: run.repository,
              baseCommit: part.earlier.baseCommit,
              tipCommit: part.earlier.commit,
            })
          : null;
      const admitted = asPart(
        order.kind === "landed" ? onLanding(run, order.landing) : run,
        part.section,
        part.earlier,
        changed?.kind === "read" ? changed.paths : null,
      );
      return await admitScopedPlan(
        environment,
        store,
        storePath,
        record,
        input,
        admitted.plan,
        input.proposalId,
        admitted.claim,
        run.split.entries ?? 0,
      );
    }
  }
}

/**
 * Count one scope row as presented and approve it, with the digest read back
 * off the row and never posted (D-0066 rule 2.2, D-0042 rule 3): the tail a
 * person's own scope and a drafted one share.
 */
async function approveStoredScope(
  record: AdvisoryRecord,
  actorId: string,
  scope: StoredScope,
  createdAtMs: number,
): Promise<ScopeRecorded> {
  const counted = await record.recordAttention({
    atMs: createdAtMs,
    subjectKind: "scope",
    subjectId: scope.scopeId,
    disposition: "presented",
    ruleName: null,
  });
  if (counted.kind !== "recorded") {
    return { ok: false, why: "scopeRefusedNotShown", note: counted.reason };
  }
  const decidedAtMs = Date.now();
  const scopeDecisionId = `scope-decision-${scope.scopeId}-${String(decidedAtMs)}`;
  const decided = await record.recordScopeDecision({
    scopeDecisionId,
    scopeId: scope.scopeId,
    // **Read back off the row, never posted.** D-0066 rule 2.2 asks that what
    // is approved is what was shown; here that is true by construction rather
    // than by a person copying a line.
    scopeDigest: scope.scopeDigest,
    outcome: "approved",
    actorId: actorId,
    // `recorded_by` and `actor_id` are two facts, and this surface is not the
    // approver (D-0032's own reason for the two columns).
    recordedBy: OPERATOR_PAGE_SURFACE,
    decidedAtMs,
  });
  if (decided.kind !== "recorded") {
    // The writer refuses a second decision on one row (rule 2.3). When the
    // approval this press repeats is already there, the screen goes to it
    // exactly as a first press would.
    const already = await record.scopeDecisionOf(scope.scopeId);
    return already.kind === "read" && already.decision.outcome === "approved"
      ? { ok: true, note: "", scopeDecisionId: already.decision.scopeDecisionId }
      : { ok: false, why: "scopeRefusedNotApproved", note: decided.reason };
  }
  return { ok: true, note: "", scopeDecisionId };
}

/**
 * One press of the page's scoped-start button: `commandStart`'s
 * `--scope-decision-id` branch, over a plan whose prompt is the request's body.
 *
 * **The prompt is the request message's words, byte for byte**, read out of the
 * store here -- the rule `--prompt-file` runs under, not trimmed. A posted
 * prompt would be a second authority for what the person asked for.
 *
 * continuo is started here rather than before the page is served, which is
 * {@link answerFromPage}'s reasoning and not a new one.
 */
export async function startScopedFromPage(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  approver: string,
  input: ScopedStartInput,
): Promise<Started> {
  // **Two presses of one form are one start, even when they overlap** (rondo#233
  // S3, Codex round 3). The row check below closes the replay that arrives after
  // the first start finished; it cannot close the one that arrives while it is
  // still running, because both reads say the row is absent and both then go on
  // to `startContinuo`. The second would reach `admitUnderScope` after the first
  // reserved its lap -- against a budget that lap has just spent -- and a
  // refused test writes the asking message that stops the request (D-0066 rule
  // 4.4). So the id is held here for as long as a start under it is in flight,
  // and a second press joins the first rather than starting anything.
  //
  // **One process's map, which is all this page is.** The store's write lock is
  // what orders two *processes*; this orders the one process that serves the
  // button, which is where a double click arrives.
  const started = starting.get(input.iterationId);
  if (started !== undefined) {
    return await started;
  }
  const running = startScoped(environment, store, storePath, approver, input);
  starting.set(input.iterationId, running);
  try {
    return await running;
  } finally {
    starting.delete(input.iterationId);
  }
}

/** Every scoped start this process has in flight, by iteration id. */
const starting = new Map<string, Promise<Started>>();

/**
 * **The order tick's port for a person's start that held files kept waiting**
 * (rondo#284, D-0158): the press's own path, id and input, in the approver's
 * name, answered once reserved for the split start's reason.
 *
 * **An approval no longer in force ends the wait without asking** admission:
 * its scope test would refuse, and a refused test writes the asking message
 * that stops the request (D-0066 rule 4.4) -- a stop the person never caused,
 * for a press they made under an approval since replaced or retired.
 */
export function heldStartPort(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  approver: string,
  record: Pick<AdvisoryRecord, "recordThreadMessage" | "approvalsInForce">,
  words: Chrome,
  policy: HostPolicy,
): NonNullable<OrderHostPorts["held"]> {
  return {
    store,
    policy,
    retired: async (held) =>
      (await record.approvalsInForce()).some((one) => one.scopeDecisionId === held.scopeDecisionId)
        ? null
        : `the approval '${held.scopeDecisionId}' it waited under is no longer in force`,
    start: async (held) =>
      await scopedStartPress(environment, store, storePath, approver, record, words, {
        iterationId: held.iterationId,
        requestMessageId: held.requestMessageId,
        scopeDecisionId: held.scopeDecisionId,
        planDigest: held.planDigest,
        // rondo#462: the worker the press that waits chose. A wait that fell
        // back to the host's default would move the work onto another provider
        // because another line happened to hold its files.
        workerProvider: held.workerProvider ?? null,
      }),
  };
}

/**
 * The page's scoped start press, answered once reserved (D-0109) -- **under the
 * id of a wait already kept for the same plan** (rondo#284, Codex): a second
 * tab's form minted its own id, and starting under it would leave the first
 * form's wait for the tick to start the same plan again once this line's files
 * were free. So the press joins the wait: one lap, whichever of the two starts
 * it, and the tick's next attempt finds the row and settles the wait.
 */
export async function scopedStartPress(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  approver: string,
  record: Pick<AdvisoryRecord, "recordThreadMessage">,
  words: Chrome,
  input: ScopedStartInput,
): Promise<Started> {
  // A form that joined a wait before is that wait's press, sent again
  // (Codex round 4): it resolves to the wait's lap however the wait ended.
  const before = await store.heldStartJoin(input.iterationId);
  const waiting =
    before === null
      ? (await store.heldStarts()).find(
          (held) =>
            held.requestMessageId === input.requestMessageId &&
            held.scopeDecisionId === input.scopeDecisionId &&
            held.planDigest === input.planDigest,
        )
      : undefined;
  if (waiting !== undefined && waiting.iterationId !== input.iterationId) {
    await store.joinHeldStart(
      { ...waiting, iterationId: input.iterationId, heldAtMs: Date.now() },
      waiting.iterationId,
    );
  }
  const joined =
    before !== null
      ? { ...input, iterationId: before }
      : waiting === undefined
        ? input
        : { ...input, iterationId: waiting.iterationId };
  return await answerOnceReserved(
    store,
    record,
    words,
    joined,
    startScopedFromPage(environment, store, storePath, approver, joined),
  );
}

async function startScoped(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  approver: string,
  input: ScopedStartInput,
): Promise<Started> {
  const actor = approvedActor(approver, environment);
  if ("refusal" in actor) {
    return { ok: false, why: "startRefusedNotAdmitted", note: actor.refusal };
  }
  const record = openAdvisoryRecord(storePath);
  const threads = await record.threadMessages();
  const asked =
    threads.kind === "read"
      ? threads.messages.find((message) => message.messageId === input.requestMessageId)
      : undefined;
  if (asked === undefined) {
    return {
      ok: false,
      why: "startRefusedNoRequest",
      note:
        threads.kind === "read"
          ? `there is no message '${input.requestMessageId}' in this store's threads`
          : `the request threads will not read: ${threads.reason}`,
    };
  }
  // **A second submit of one form is the lap it already started**, which is the
  // argument the send routes make about a repeated message (`alreadyThere` in
  // `src/access/web-app.ts`): the iteration id was minted when the form was
  // drawn, precisely so the store holds one row however many times the button
  // is pressed. Telling the person "nothing started" would be false, and it is
  // worse than false here -- `admitUnderScope` would test a scope whose budget
  // that very lap has just spent, and a refused test writes an **asking message
  // into the request's thread** (D-0066 rule 4.4) which then holds the line
  // (D-0069 rule 5). A question nobody asked, stopping the work, because
  // somebody pressed back and submit. So the press that names a row already
  // there is the press that made it, and it admits nothing and writes nothing.
  const already = await store.read(input.iterationId);
  if (already.kind === "read") {
    return { ok: true, note: `iteration '${input.iterationId}' was already admitted` };
  }
  if (already.kind === "unreadable") {
    return {
      ok: false,
      why: "startRefusedNotAdmitted",
      note:
        `a row for iteration '${input.iterationId}' is already there and will not read: ` +
        `${already.reason}. Nothing was admitted a second time.`,
    };
  }
  const chosen = await heldPlanOf({ store, record }, input.requestMessageId, input.planDigest);
  if ("refusal" in chosen || chosen.plan === null) {
    return {
      ok: false,
      why: "startRefusedNoPlan",
      note:
        "refusal" in chosen
          ? chosen.refusal
          : `'${input.planDigest}' is not a plan rondo holds for this request`,
    };
  }
  const planned = readRunPlan({ ...chosen.plan.document, prompt: asked.body });
  if (planned.kind !== "planned") {
    return {
      ok: false,
      why: "startRefusedNoPlan",
      note: `The plan was refused: ${planned.reason}`,
    };
  }
  const started = await admitScopedPlan(
    environment,
    store,
    storePath,
    record,
    input,
    planned.plan,
    null,
    null,
  );
  if (started.why !== "startWaitsHeld") {
    return started;
  }
  // **Held by a line of this very request, it does not wait** (Codex round 3):
  // another tab's form of the same plan started it at once, and a wait would
  // run the same work again by itself once that line's files were free. So the
  // press is told to start again, as before rondo#284.
  for (const { lineageId } of started.holders ?? []) {
    const holder = await store.read(lineageId);
    if (holder.kind === "read" && holder.record.requestMessageId === input.requestMessageId) {
      return { ...started, why: "startRefusedHeld" };
    }
  }
  // **Refused by files another line holds, so it waits** (rondo#284, D-0158):
  // kept by the id its form minted, and attempted again by the resident host's
  // tick (`orderHost`) once they are free. A row rondo could not write would be
  // a wait nothing ends, so that press is told to start again, as it was --
  // and so is one no row waits for: another form of this plan already started
  // it (Codex round 2), and the tick would not start it again.
  try {
    const waits = await store.recordHeldStart({
      iterationId: input.iterationId,
      requestMessageId: input.requestMessageId,
      scopeDecisionId: input.scopeDecisionId,
      planDigest: input.planDigest,
      repository: repositoryKey(planned.plan.repository) ?? planned.plan.repository,
      heldAtMs: Date.now(),
      // rondo#462: kept with the wait, so the tick's attempt starts the lap on
      // the worker this press chose and not on the host's default.
      workerProvider: input.workerProvider ?? null,
    });
    return waits ? started : { ...started, why: "startRefusedHeld" };
  } catch (error) {
    consoleSeams.writeError(
      `${asciiEscape(`lap '${input.iterationId}': its wait was not kept: ${error instanceof Error ? error.message : String(error)}`)}\n`,
    );
    return { ...started, why: "startRefusedHeld" };
  }
}

async function admitScopedPlan(
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  storePath: string,
  record: AdvisoryRecord,
  input: {
    readonly iterationId: string;
    readonly requestMessageId: string;
    readonly scopeDecisionId: string;
    /**
     * The worker provider this request chose, or null/absent for the host's
     * default (rondo#462). Absent is what a caller with no choice to pass says:
     * a drafted split's plan carries none of its own, so it runs on the host's
     * default exactly as it did before a request could choose.
     */
    readonly workerProvider?: string | null;
  },
  unquoted: RunPlan,
  proposalId: string | null,
  /** The drafted split's claim (D-0073 rule 2.3), or null for none until its gate (D-0160). */
  claim: LaneClaimAsk | null,
  /** How many new decision entries the drafted split says the plan writes (D-0098 rule 3.3). */
  entries = 0,
): Promise<Started> {
  const plan = await withNamedIssues(record, input.requestMessageId, unquoted);
  if ("refusal" in plan) {
    return { ok: false, why: "startRefusedNotAdmitted", note: plan.refusal };
  }
  const numbering = await numberingFor(plan, entries, []);
  if (numbering !== null && "refusal" in numbering) {
    return { ok: false, why: "startRefusedNotAdmitted", note: numbering.refusal };
  }
  const startup = await startContinuo(environment);
  if (startup.kind === "refused") {
    return {
      ok: false,
      why: "startRefusedNoContinuo",
      note: `continuo is not usable: ${startup.reason}`,
    };
  }
  const continuo = startup.continuo;
  const ports = conductorPorts(continuo, store, record, Date.now, hostWords(environment));
  const outcome = await admitUnderScope(
    {
      store,
      record,
      nowMs: Date.now,
      admit: (scoped, id, supersedes, requestMessageId, scopeSpend) =>
        withReservedNumbers(store, numbering, scoped, (numbered, numbers) =>
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
            claim,
            numbers,
            // rondo#462: the request's own choice, down to `reserve()` in the
            // same transaction as the row, so the lap the person reads back
            // names the worker their press chose -- and beside it the host's
            // default, so a press that chose nothing still records the name
            // its lap ran on instead of leaving the thread to infer one.
            input.workerProvider ?? null,
            hostFallbackWorker(continuo),
          ),
        ),
    },
    input.scopeDecisionId,
    {
      kind: "lineage_start",
      iterationId: input.iterationId,
      plan,
      proposalId,
      requestMessageId: input.requestMessageId,
    },
  );
  if (outcome.kind === "refused") {
    // **The stop is written where a refusal always writes it** -- rule 4.4's
    // asking message in the request's thread -- and the screen says which test
    // refused and where the choices are, never a D-number or an id to copy.
    // Whatever the terminal would have printed still goes to the terminal
    // `rondo web` runs in, as `answerFromPage` leaves `walkGate`'s there.
    return {
      ok: false,
      why: "startRefusedOutside",
      test: outcome.test,
      note: `the ${outcome.verdict} verdict at the ${outcome.test} test: ${outcome.reason}`,
    };
  }
  if (outcome.kind === "halted") {
    return {
      ok: false,
      why: "startRefusedNotAdmitted",
      note: `nothing was admitted; the run stopped with status ${String(outcome.status)}`,
    };
  }
  sayReport(outcome.report);
  if (outcome.report.iterationId === null) {
    const held = outcome.report.laneRefusal;
    if (held === undefined) {
      return { ok: false, why: "startRefusedNotAdmitted", note: outcome.report.lines.join("\n") };
    }
    // Refused by files another line holds (D-0073 rule 3.1), said as that, and
    // **by the words the person wrote for the holding request** (rondo#439), as
    // the list and the thread name it -- not the brief rondo composed from them
    // -- so the refusal can name it and offer its release where the press was.
    const read = await record.threadMessages();
    const messages = read.kind === "read" ? read.messages : [];
    // Whether each holder is still running (rondo#553): only a finished one's
    // release is offered, since the release screen refuses a line in flight.
    const ledger = await store.laneLedger().catch(() => []);
    const holders = await Promise.all(
      held.holders.map(async ({ lineageId }) => {
        const root = await store.read(lineageId);
        return {
          lineageId,
          request: root.kind === "read" ? requestWords(messages, root.record) : null,
          inFlight: ledger.find((line) => line.lineageId === lineageId)?.inFlight ?? true,
        };
      }),
    );
    // It waits (rondo#284): the resident host's tick attempts it again.
    return {
      ok: false,
      why: "startWaitsHeld",
      note: outcome.report.lines.join("\n"),
      holders,
    };
  }
  // **A lap this button started gets the reading the same lap started from a
  // terminal gets** (D-0065): `finishScopedAdmission` takes it the moment a
  // scoped admission stops at `awaiting_human`, and a page that skipped it
  // would open a gate whose *Model review* half is empty for ever -- while the
  // gate screen goes on saying the reading may still arrive (`modelMayArrive`,
  // #220 S2), which is the page telling a person to wait for something nobody
  // is taking. It is awaited rather than left running, for the reason the whole
  // press is awaited: the lap itself already ran inside it, and a reading is
  // the short part of that. Its own words go to the terminal `rondo web` runs
  // in, as `answerFromPage` leaves `walkGate`'s there.
  if (outcome.report.status === "awaiting_human") {
    await sayGateOpen(() =>
      takeModelReading(
        modelReviewPorts(continuo, store, ports.thread ?? null, hostLanguage(environment)),
        outcome.report.iterationId ?? input.iterationId,
      ),
    );
  }
  return { ok: true, note: `iteration '${input.iterationId}' was admitted` };
}
