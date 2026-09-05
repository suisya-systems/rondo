/**
 * The complete plan a caller hands the conductor, and the only place it is
 * validated.
 *
 * D-0019 rule 3: **rondo gains no allocator and no configuration layer in
 * lap 1.** A one-line request does not determine a run, and the gap is large --
 * `run admit` takes eight required fields of which the request text is one, and
 * `lap perform` takes ten more plus ten optional ones. The two things rondo
 * would otherwise have had to build are exactly the two D-0012 says are
 * blocked: an allocator for the (run id, topic branch, workspace) triple, and
 * defaults for a fence's geometry that continuo requires be absolute and
 * outside the worktree. Both are decisions, and `AGENTS.md` section 7 forbids
 * taking one inside an implementation diff. So the caller passes a complete
 * plan, the conductor receives one, and it never invents a field.
 *
 * **Why the plan lives in `src/refrain/` and not in `src/store/`.** Five of its
 * fields are cadenza's types, and the store layer names only itself -- it may
 * not import cadenza, and restating `AgentTypeInput` there by hand would be the
 * drift D-0016 warned about, now on the inside of a dependency. So the plan is
 * the conductor's type; the store persists {@link planPayload}'s rendering of
 * it verbatim beside a digest of those bytes (D-0019 rule 4), hands the bytes
 * back unaltered, and {@link readPlan} is what turns them into a plan again. A
 * payload that will not read is a row the interpreter cannot classify, which
 * halts and asks rather than proceeding.
 *
 * **Validation is here, once, and it is rondo's refusal rather than continuo's
 * stack.** D-0015's exception 2 measured what an operator's typo costs today:
 * an empty `--run-id`, `--workspace`, `--base-branch`, `--topic-branch` or
 * `--lease-claimant-id` reaches rondo as exit 1 and a raw stack, not a refusal
 * document. The per-field rules below are that answered before a process
 * starts.
 *
 * **Every rule below is read off continuo at the pinned revision** and is a
 * fact that can change: continuo's own `lap perform --help` says which paths
 * must be absolute and why, and `--endpoint-recipient`'s accepted set is built
 * at runtime from the outbox registry rather than written down as a literal.
 * D-0019 names "continuo's `run admit` or `lap perform` flag set changing" as
 * its own falsifier, and this file is where that would be felt first.
 */
import type {
  AgentTypeInput,
  CatalogLayer,
  IntendedAction,
  IssuanceParties,
} from "../cadenza/facade.js";
import type { JsonRecord, JsonValue } from "../store/records.js";

/**
 * The recipients continuo's outbox has a handler for, at the pinned revision.
 *
 * continuo derives this set at runtime from a real registry -- deliberately, so
 * that a recipient added or renamed cannot leave `--endpoint-recipient`'s
 * `choices` behind -- which means rondo cannot read it from a constant and is
 * transcribing an observation instead. So it is pinned here with the revision
 * it was observed at, and a recipient continuo grows is a rondo diff.
 *
 * Observed at continuo `44f62336108b86cab5da791111ffa0e5b73cd01a`:
 * `NOTIFY_RECIPIENT = "external-notify"` and
 * `HUMAN_GATED_RECIPIENT = "human-gated-effect"`.
 */
export const SERVED_RECIPIENTS = Object.freeze(["external-notify", "human-gated-effect"] as const);

/**
 * A complete lap-1 run plan: everything both verbs need, everything cadenza
 * needs, and the one bound that is rondo's own.
 *
 * Frozen on construction and never edited afterwards. The conductor reads it;
 * nothing in `src/refrain/` writes one.
 */
export interface RunPlan {
  // --- continuo: the control plane and the run -----------------------------
  /** The control-plane database every verb names. Absolute. */
  readonly db: string;
  /** The run id, which is the caller's to allocate (D-0012). */
  readonly runId: string;
  readonly leaseClaimantId: string;
  /** The worktree the run is materialised into. Absolute. */
  readonly workspace: string;
  readonly baseBranch: string;
  readonly topicBranch: string;
  /** The request text. The one field of eight that the one-liner supplies. */
  readonly prompt: string;

  // --- continuo: the lap ----------------------------------------------------
  /** The repository the workspace is cut from. Absolute. */
  readonly repository: string;
  readonly artifactRoot: string;
  readonly stateRoot: string;
  readonly interlockRoot: string;
  readonly claudeOrgPath: string;
  /** One of {@link SERVED_RECIPIENTS}. */
  readonly endpointRecipient: string;
  readonly endpointDestinationDir: string;
  /**
   * The worker CLI, as a command prefix in order.
   *
   * **Every token must be absolute**, which is continuo's rule and its reason:
   * a bare name would be resolved through `PATH`, and the fence cannot rest on
   * which directory the worker happens to be started from.
   */
  readonly claudeCommand: readonly string[];
  /** continuo's optional executor paths. Absolute when given. */
  readonly endpointDb: string | null;
  readonly endpointModule: string | null;
  readonly node: string | null;
  readonly hookScript: string | null;
  readonly python: string | null;
  readonly pollIntervalMs: number | null;
  /**
   * The two budgets rondo passes **explicitly** rather than inheriting
   * (D-0019 rule 12), so the numbers rondo reasons about are the numbers in
   * force. continuo's own default turn timeout is fifteen minutes; inheriting
   * it would mean rondo's ceiling was set against a number rondo never saw.
   */
  readonly turnTimeoutMs: number;
  readonly gitTimeoutMs: number;
  readonly gateOptions: readonly string[];
  readonly gateDeadlineAtMs: number | null;

  // --- rondo's own ----------------------------------------------------------
  /**
   * How long rondo will wait for the whole `lap perform` invocation.
   *
   * **The caller's, because rondo cannot compute it.** The turn timer is not
   * the whole invocation: before it starts, `lap perform` takes the global
   * `outbox-delivery` lease, materialises a worktree through an unknown number
   * of git commands each bounded separately by `--git-timeout-ms`, and renders
   * and publishes a fence; afterwards it ingests the terminal report and opens
   * the gate. None of those budgets is exposed to a caller, and the count of
   * git operations is not a number rondo can know from outside. A ceiling of
   * "turn timeout plus a margin" would kill a healthy lap on a slow checkout --
   * causing exactly the orphan D-0019 rule 12 exists to prevent, because
   * rondo's timer kills the CLI and not the fenced child.
   *
   * Validated as strictly greater than `turnTimeoutMs + gitTimeoutMs`: a floor,
   * not an estimate. It is the operator's declared patience.
   */
  readonly invocationCeilingMs: number;

  // --- cadenza --------------------------------------------------------------
  /** The catalog layers, lowest precedence first. `baseDir` absolute. */
  readonly catalogLayers: readonly CatalogLayer[];
  readonly projectName: string;
  readonly agentTypeInput: AgentTypeInput;
  readonly parties: IssuanceParties;
  readonly intendedAction: IntendedAction;
}

/**
 * The largest delay `setTimeout` can hold: 2^31 - 1 milliseconds, about 24.8
 * days.
 *
 * Not a policy of rondo's but a property of the runtime, and it is a *bound*
 * here rather than a clamp because of how Node fails it -- see
 * {@link requireCeiling}.
 */
const MAX_TIMER_MS = 2_147_483_647;

/** A plan rondo accepted, or the first reason it did not. */
export type PlanOutcome =
  | { readonly kind: "planned"; readonly plan: RunPlan }
  | { readonly kind: "refused"; readonly reason: string };

/**
 * Absolute on either platform, decided by shape rather than by `node:path`.
 *
 * The same three-line rule `src/continuo/invoker.ts` gives for the CLI path and
 * for the same reason: `path.isAbsolute` answers for the platform it is running
 * on, which is the right answer at runtime and the wrong one for a rule rondo
 * states about a plan an operator wrote -- and reaching for it would put an
 * external module into a layer whose whole property is that it has none.
 */
function isAbsolutePath(value: string): boolean {
  return /^(?:\/|\\\\|[A-Za-z]:[\\/])/.test(value);
}

/** Every check the plan's construction runs, as one accumulating refusal. */
class PlanRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanRefusal";
  }
}

function requireNonEmpty(field: string, value: string): string {
  if (value.trim() === "") {
    throw new PlanRefusal(`'${field}' is empty, and continuo answers an empty value with a stack`);
  }
  if (value.includes("\u0000")) {
    throw new PlanRefusal(`'${field}' contains a NUL byte, which no command line can carry`);
  }
  return value;
}

function requireAbsolute(field: string, value: string): string {
  requireNonEmpty(field, value);
  if (!isAbsolutePath(value)) {
    throw new PlanRefusal(
      `'${field}' is '${value}', and continuo requires an absolute path here: a relative one ` +
        "would be resolved against whichever directory the host happened to be started in",
    );
  }
  return value;
}

function optionalAbsolute(field: string, value: string | null): string | null {
  return value === null ? null : requireAbsolute(field, value);
}

/**
 * A branch or identifier that is not option-shaped.
 *
 * A value beginning with `-` is read by an argument parser as a flag, so a
 * topic branch called `--help` would not be a branch at all. continuo's parser
 * would refuse it in prose; rondo refuses it as its own, before the spawn.
 */
function requireNotOptionShaped(field: string, value: string): string {
  requireNonEmpty(field, value);
  if (value.startsWith("-")) {
    throw new PlanRefusal(
      `'${field}' is '${value}', which an argument parser reads as a flag rather than a value`,
    );
  }
  return value;
}

/** An identifier continuo carries into a lease and a row: no whitespace. */
function requireIdentifier(field: string, value: string): string {
  requireNotOptionShaped(field, value);
  if (/\s/.test(value)) {
    throw new PlanRefusal(`'${field}' is '${value}', and an identifier carries no whitespace`);
  }
  return value;
}

function requirePositiveInteger(field: string, value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new PlanRefusal(
      `'${field}' is ${String(value)}, and a positive whole number of milliseconds was required`,
    );
  }
  return value;
}

function optionalPositiveInteger(field: string, value: number | null): number | null {
  return value === null ? null : requirePositiveInteger(field, value);
}

/**
 * Validate one plan, or say why it is not one.
 *
 * Total: it returns a refusal rather than throwing, because a plan arriving
 * from an operating surface is an input and not a defect. The first failing
 * field is named, because "the plan is invalid" is a message nobody can act on.
 */
export function runPlan(input: RunPlan): PlanOutcome {
  try {
    const plan: RunPlan = {
      db: requireAbsolute("db", input.db),
      runId: requireIdentifier("runId", input.runId),
      leaseClaimantId: requireIdentifier("leaseClaimantId", input.leaseClaimantId),
      workspace: requireAbsolute("workspace", input.workspace),
      baseBranch: requireNotOptionShaped("baseBranch", input.baseBranch),
      topicBranch: requireNotOptionShaped("topicBranch", input.topicBranch),
      prompt: requireNonEmpty("prompt", input.prompt),
      repository: requireAbsolute("repository", input.repository),
      artifactRoot: requireAbsolute("artifactRoot", input.artifactRoot),
      stateRoot: requireAbsolute("stateRoot", input.stateRoot),
      interlockRoot: requireAbsolute("interlockRoot", input.interlockRoot),
      claudeOrgPath: requireAbsolute("claudeOrgPath", input.claudeOrgPath),
      endpointRecipient: requireRecipient(input.endpointRecipient),
      endpointDestinationDir: requireAbsolute(
        "endpointDestinationDir",
        input.endpointDestinationDir,
      ),
      claudeCommand: requireClaudeCommand(input.claudeCommand),
      endpointDb: optionalAbsolute("endpointDb", input.endpointDb),
      endpointModule: optionalAbsolute("endpointModule", input.endpointModule),
      node: optionalAbsolute("node", input.node),
      hookScript: optionalAbsolute("hookScript", input.hookScript),
      python: optionalAbsolute("python", input.python),
      pollIntervalMs: optionalPositiveInteger("pollIntervalMs", input.pollIntervalMs),
      turnTimeoutMs: requirePositiveInteger("turnTimeoutMs", input.turnTimeoutMs),
      gitTimeoutMs: requirePositiveInteger("gitTimeoutMs", input.gitTimeoutMs),
      gateOptions: requireGateOptions(input.gateOptions),
      gateDeadlineAtMs: optionalPositiveInteger("gateDeadlineAtMs", input.gateDeadlineAtMs),
      invocationCeilingMs: requireCeiling(input),
      catalogLayers: requireCatalogLayers(input.catalogLayers),
      projectName: requireNonEmpty("projectName", input.projectName),
      agentTypeInput: input.agentTypeInput,
      parties: input.parties,
      intendedAction: input.intendedAction,
    };
    return { kind: "planned", plan: Object.freeze(plan) };
  } catch (error) {
    if (error instanceof PlanRefusal) {
      return { kind: "refused", reason: error.message };
    }
    throw error;
  }
}

function requireRecipient(value: string): string {
  if (!(SERVED_RECIPIENTS as readonly string[]).includes(value)) {
    return refuse(
      `'endpointRecipient' is '${value}', and continuo serves ` +
        `${SERVED_RECIPIENTS.join(", ")} at the pinned revision. A recipient with no handler is ` +
        "refused before any worktree or fence is created, so refusing it here costs nothing and " +
        "says which values exist.",
    );
  }
  return value;
}

function requireClaudeCommand(tokens: readonly string[]): readonly string[] {
  if (tokens.length === 0) {
    return refuse("'claudeCommand' is empty, and continuo needs a worker CLI to run");
  }
  return Object.freeze(
    tokens.map((token, index) => requireAbsolute(`claudeCommand[${String(index)}]`, token)),
  );
}

function requireGateOptions(options: readonly string[]): readonly string[] {
  return Object.freeze(
    options.map((option, index) => requireNonEmpty(`gateOptions[${String(index)}]`, option)),
  );
}

/**
 * The ceiling, checked against the two budgets it has to clear.
 *
 * A floor rather than an estimate, and the comparison is strict: a ceiling
 * *equal* to the sum would leave the lease, the git commands, the fence render
 * and the gate ingest exactly no time at all.
 */
function requireCeiling(input: RunPlan): number {
  const ceiling = requirePositiveInteger("invocationCeilingMs", input.invocationCeilingMs);
  if (ceiling > MAX_TIMER_MS) {
    // **A ceiling above Node's timer range is worse than no ceiling.**
    // `setTimeout` stores its delay in a signed 32-bit integer, and a larger
    // value does not saturate -- it is clamped to **1 ms**, with a warning
    // rondo's caller never sees. So a plan declaring more than about 24.8 days
    // of patience would kill the CLI almost immediately, leave the row at
    // `performing` holding the single-flight lock, and report a rondo defect
    // for a lap that had barely started. The one input whose whole meaning is
    // "wait this long" must not silently mean its opposite, so it is refused
    // here rather than clamped: rondo cannot honour the number, and pretending
    // to would be inventing a patience the operator did not declare.
    return refuse(
      `'invocationCeilingMs' is ${String(ceiling)}, and Node's timers hold a delay in a signed ` +
        `32-bit integer: anything above ${String(MAX_TIMER_MS)} ms is clamped to 1 ms rather ` +
        "than saturating, so a ceiling this large would fire at once. Declare a patience rondo " +
        "can actually wait out.",
    );
  }
  const floor = input.turnTimeoutMs + input.gitTimeoutMs;
  if (ceiling <= floor) {
    return refuse(
      `'invocationCeilingMs' is ${String(ceiling)}, which is not above ` +
        `turnTimeoutMs + gitTimeoutMs (${String(floor)}). rondo's ceiling firing means the CLI ` +
        "was killed and the fenced worker was not, so it must be the operator's declared " +
        "patience above continuo's own budgets rather than a number derived from them.",
    );
  }
  return ceiling;
}

function requireCatalogLayers(layers: readonly CatalogLayer[]): readonly CatalogLayer[] {
  if (layers.length === 0) {
    return refuse("'catalogLayers' is empty, and cadenza reads no catalog of its own");
  }
  for (const [index, layer] of layers.entries()) {
    requireNonEmpty(`catalogLayers[${String(index)}].layer`, layer.layer);
    requireNonEmpty(`catalogLayers[${String(index)}].origin`, layer.origin);
    requireAbsolute(`catalogLayers[${String(index)}].baseDir`, layer.baseDir);
  }
  return layers;
}

/** Throw a {@link PlanRefusal}, in an expression position. */
function refuse(reason: string): never {
  throw new PlanRefusal(reason);
}

/**
 * The plan as the store persists it (D-0019 rule 4).
 *
 * A plain JSON record rather than the plan itself, because the store may not
 * name a cadenza type and because "verbatim" has to mean something a digest can
 * be taken over. The cadenza-side values are carried through as they were
 * handed in: they are already plain data -- a table, six fields, two
 * identities, a set of capability keys -- and re-deriving them would be rondo
 * modelling cadenza rather than persisting what it was given.
 */
export function planPayload(plan: RunPlan): JsonRecord {
  return {
    db: plan.db,
    run_id: plan.runId,
    lease_claimant_id: plan.leaseClaimantId,
    workspace: plan.workspace,
    base_branch: plan.baseBranch,
    topic_branch: plan.topicBranch,
    prompt: plan.prompt,
    repository: plan.repository,
    artifact_root: plan.artifactRoot,
    state_root: plan.stateRoot,
    interlock_root: plan.interlockRoot,
    claude_org_path: plan.claudeOrgPath,
    endpoint_recipient: plan.endpointRecipient,
    endpoint_destination_dir: plan.endpointDestinationDir,
    claude_command: [...plan.claudeCommand],
    endpoint_db: plan.endpointDb,
    endpoint_module: plan.endpointModule,
    node: plan.node,
    hook_script: plan.hookScript,
    python: plan.python,
    poll_interval_ms: plan.pollIntervalMs,
    turn_timeout_ms: plan.turnTimeoutMs,
    git_timeout_ms: plan.gitTimeoutMs,
    gate_options: [...plan.gateOptions],
    gate_deadline_at_ms: plan.gateDeadlineAtMs,
    invocation_ceiling_ms: plan.invocationCeilingMs,
    catalog_layers: plan.catalogLayers.map((layer) => ({
      layer: layer.layer,
      origin: layer.origin,
      base_dir: layer.baseDir,
      data: layer.data as unknown as JsonValue,
    })),
    project_name: plan.projectName,
    agent_type_input: plan.agentTypeInput as unknown as JsonValue,
    parties: plan.parties as unknown as JsonValue,
    intended_action: plan.intendedAction as unknown as JsonValue,
  };
}

/**
 * The payload, read back into a plan, or the reason it will not read.
 *
 * The other half of "persist it verbatim": a row that cannot be turned back
 * into a plan is a row the interpreter cannot classify, and D-0019 rule 8 says
 * what happens to those -- the iteration goes to `stalled` with the reason and
 * nothing proceeds. So this refuses rather than coercing, and it re-runs the
 * full validation rather than trusting that whatever wrote the row validated
 * it: the bytes may have been written by an older rondo, or edited by a person.
 */
export function readPlan(payload: JsonRecord): PlanOutcome {
  try {
    const draft: RunPlan = {
      db: readString(payload, "db"),
      runId: readString(payload, "run_id"),
      leaseClaimantId: readString(payload, "lease_claimant_id"),
      workspace: readString(payload, "workspace"),
      baseBranch: readString(payload, "base_branch"),
      topicBranch: readString(payload, "topic_branch"),
      prompt: readString(payload, "prompt"),
      repository: readString(payload, "repository"),
      artifactRoot: readString(payload, "artifact_root"),
      stateRoot: readString(payload, "state_root"),
      interlockRoot: readString(payload, "interlock_root"),
      claudeOrgPath: readString(payload, "claude_org_path"),
      endpointRecipient: readString(payload, "endpoint_recipient"),
      endpointDestinationDir: readString(payload, "endpoint_destination_dir"),
      claudeCommand: readStringArray(payload, "claude_command"),
      endpointDb: readNullableString(payload, "endpoint_db"),
      endpointModule: readNullableString(payload, "endpoint_module"),
      node: readNullableString(payload, "node"),
      hookScript: readNullableString(payload, "hook_script"),
      python: readNullableString(payload, "python"),
      pollIntervalMs: readNullableNumber(payload, "poll_interval_ms"),
      turnTimeoutMs: readNumber(payload, "turn_timeout_ms"),
      gitTimeoutMs: readNumber(payload, "git_timeout_ms"),
      gateOptions: readStringArray(payload, "gate_options"),
      gateDeadlineAtMs: readNullableNumber(payload, "gate_deadline_at_ms"),
      invocationCeilingMs: readNumber(payload, "invocation_ceiling_ms"),
      catalogLayers: readCatalogLayers(payload),
      projectName: readString(payload, "project_name"),
      agentTypeInput: readOpaque(payload, "agent_type_input") as unknown as AgentTypeInput,
      parties: readOpaque(payload, "parties") as unknown as IssuanceParties,
      intendedAction: readOpaque(payload, "intended_action") as unknown as IntendedAction,
    };
    return runPlan(draft);
  } catch (error) {
    if (error instanceof PlanRefusal) {
      return { kind: "refused", reason: error.message };
    }
    throw error;
  }
}

function readString(payload: JsonRecord, key: string): string {
  const value = payload[key];
  if (typeof value !== "string") {
    return refuse(`the persisted plan's '${key}' is not a string`);
  }
  return value;
}

function readNullableString(payload: JsonRecord, key: string): string | null {
  const value = payload[key];
  if (value === null) {
    return null;
  }
  return readString(payload, key);
}

function readNumber(payload: JsonRecord, key: string): number {
  const value = payload[key];
  if (typeof value !== "number") {
    return refuse(`the persisted plan's '${key}' is not a number`);
  }
  return value;
}

function readNullableNumber(payload: JsonRecord, key: string): number | null {
  const value = payload[key];
  if (value === null) {
    return null;
  }
  return readNumber(payload, key);
}

function readStringArray(payload: JsonRecord, key: string): readonly string[] {
  const value = payload[key];
  if (!Array.isArray(value)) {
    return refuse(`the persisted plan's '${key}' is not an array`);
  }
  return value.map((element, index) => {
    if (typeof element !== "string") {
      return refuse(`the persisted plan's '${key}[${String(index)}]' is not a string`);
    }
    return element;
  });
}

function readOpaque(payload: JsonRecord, key: string): JsonValue {
  const value = payload[key];
  if (value === undefined || value === null) {
    return refuse(`the persisted plan's '${key}' is absent`);
  }
  return value;
}

function readCatalogLayers(payload: JsonRecord): readonly CatalogLayer[] {
  const value = payload.catalog_layers;
  if (!Array.isArray(value)) {
    return refuse("the persisted plan's 'catalog_layers' is not an array");
  }
  return value.map((element, index) => {
    if (typeof element !== "object" || element === null || Array.isArray(element)) {
      return refuse(`the persisted plan's 'catalog_layers[${String(index)}]' is not an object`);
    }
    const layer = element as JsonRecord;
    return {
      layer: readString(layer, "layer"),
      origin: readString(layer, "origin"),
      baseDir: readString(layer, "base_dir"),
      data: readOpaque(layer, "data") as unknown as CatalogLayer["data"],
    };
  });
}
