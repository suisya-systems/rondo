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
import type { Allocation } from "./allocator.js";

/**
 * The recipients continuo's outbox has a handler for, at the pinned revision.
 *
 * continuo derives this set at runtime from a real registry -- deliberately, so
 * that a recipient added or renamed cannot leave `--endpoint-recipient`'s
 * `choices` behind -- which means rondo cannot read it from a constant and is
 * transcribing an observation instead. So it is pinned here with the revision
 * it was observed at, and a recipient continuo grows is a rondo diff.
 *
 * Observed at continuo `603843b7c0e91136bc7f7e5c9f91640f7bb970c9`, the current
 * pinned revision, and unchanged from the revision D-0019 read it at:
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
 *
 * **Two things a caller meets beside the plan, which {@link runPlan} cannot
 * refuse for them.** Both were found by filling a first plan
 * (`docs/operations/lap-1-dogfood.md`, F-5 and F-7).
 *
 * - **The policy handed to `admit()` next to the plan must not be
 *   `CONSERVATIVE_POLICY`.** Its `ask_every_iteration` is refused by `nextStep`
 *   before a row exists, on purpose (D-0019 rule 9: a policy stop costs no row
 *   and takes no lock), so a run started under the default is a run that did
 *   not start. The value that starts one is
 *   `{ autonomy: "ask_before_landing", maxIterations: 1 }` -- the other
 *   `Autonomy` value, and the smallest ceiling `admissionStep` in `./loop.ts`
 *   accepts.
 * - **`catalogLayers[].data` is typed as a free-form table and is not one.**
 *   See that field.
 */
export interface RunPlan {
  // --- continuo: the control plane and the run -----------------------------
  /** The control-plane database every verb names. Absolute. */
  readonly db: string;
  /**
   * The directory rondo materialises workspaces under. Absolute.
   *
   * **This one field replaces three (D-0023 rule 9).** `runId`, `workspace` and
   * `topicBranch` used to be here, typed by the operator, because rondo had no
   * allocator and minting them inside an implementation diff would have taken
   * D-0012's open decision by accident. The allocator exists now, so the caller
   * must stop supplying them: two authorities for one fact is exactly how a
   * second run is handed a branch that a first one already owns.
   *
   * What the caller still chooses is *where* -- the root. What rondo derives is
   * the component under it, from the iteration id.
   *
   * **This fires the first half of D-0019 rule 3 and leaves the second half
   * alone.** Rule 3 said rondo gains no allocator *and* no configuration layer
   * in lap 1, and `plan.ts` named both as what it was avoiding. D-0023 fires the
   * condition rule 3 named for the allocator only: rondo still supplies no
   * defaults for a fence's geometry, and the twenty-odd fields below are still
   * the caller's to write.
   */
  readonly workspaceRoot: string;
  readonly baseBranch: string;
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
   * The three budgets rondo passes **explicitly** rather than inheriting
   * (D-0019 rule 12, widened to three by D-0021), so the numbers rondo reasons
   * about are the numbers in force. continuo's own default turn timeout is
   * fifteen minutes; inheriting it would mean rondo's ceiling was set against a
   * number rondo never saw.
   */
  readonly turnTimeoutMs: number;
  readonly gitTimeoutMs: number;
  /**
   * How long the spawned worker is given to name the session id committed for
   * it (`continuo D-0098`'s `--identity-readback-timeout-ms`).
   *
   * **The caller's, and the reason it is a field rather than a default is a
   * measurement.** Before `continuo D-0098` the window was two hard-coded
   * constants worth 2.5 seconds in total, and the lap-1 dogfood is where the
   * loop stopped: a real worker took 3.5 to 11.3 seconds to emit the event that
   * names its session, so every measured start exceeded the window and the
   * fastest exceeded it by 40% (`docs/operations/lap-1-dogfood.md`, F-1).
   * continuo now takes the number and defaults it to thirty seconds. rondo
   * states it anyway, for the reason the other two budgets are stated: a
   * default rondo never saw is a number rondo cannot reason about, and this one
   * is counted into {@link invocationCeilingMs}'s floor.
   */
  readonly identityReadbackTimeoutMs: number;
  readonly gateOptions: readonly string[];
  readonly gateDeadlineAtMs: number | null;

  // --- rondo's own ----------------------------------------------------------
  /**
   * The branch a pull request is opened against, when that is **not** the
   * branch the workspace was cut from. Null in every plan an operator writes.
   *
   * The two are the same thing right up until a revision, and continuo's
   * materialiser calls `baseBranch` both ("the branch the topic branch is cut
   * from, and the branch the lap's pull request is opened against"). A second
   * lap breaks the tie: it is cut from the **first lap's topic branch**, which
   * is what makes it a continuation rather than a restart, and that branch has
   * never been pushed -- `D-0010` leaves publishing to the operator and the
   * operator publishes the last lap, not each one. A pull request opened
   * against it would name a branch no forge has. So the field the revision
   * carries forward is the branch the *first* lap was cut from, and a chain of
   * revisions carries the same one all the way along.
   *
   * rondo's own, in the section that says so: continuo is never told about it,
   * and `src/access/cli.ts`'s `publish` is its only reader.
   */
  readonly pullRequestBaseBranch: string | null;
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
   * Validated as strictly greater than
   * `turnTimeoutMs + gitTimeoutMs + identityReadbackTimeoutMs`: a floor, not an
   * estimate. It is the operator's declared patience. The read-back budget
   * joined the sum under D-0021, because it is a window rondo now declares and
   * a lap can spend in full before the turn has started at all -- leaving it
   * out would let a plan pass with a ceiling the lap's own budgets can exceed.
   */
  readonly invocationCeilingMs: number;

  // --- cadenza --------------------------------------------------------------
  /**
   * The catalog layers, lowest precedence first. `baseDir` absolute.
   *
   * **`data` is a closed table, and cadenza refuses what {@link runPlan} does
   * not check.** Observed against the vendored build (`cadenza.pin.json`), in
   * its `application/compose.ts` and `domain/clone-source.ts`:
   *
   * - The top level admits exactly `schema_version`, `catalog` and `project`;
   *   `schema_version` is required (`'schema_version' is required`) and must
   *   be an integer this build supports -- `1` at the pinned revision.
   * - A project is `project.<name>` and admits exactly `aliases`, `source`,
   *   `base_branch` and `tombstone`. Once the layers are composed, every
   *   project must have both a `source` and a `base_branch` from some layer
   *   (`project '<name>' has no source` / `... has no base_branch`). `source`
   *   is a table whose `kind` is one of `git_url` (with a `url`), `local_path`
   *   (with a `path`) or `new` (nothing else), and a key its kind does not
   *   define is refused.
   * - For a `local_path` source, `catalog.allowed_local_roots` -- a list of
   *   strings, and the only key `catalog` admits -- must be declared **on the
   *   layer that declares the source**; it is never merged across layers
   *   (`a clone source of kind 'local_path' requires the layer that declares it
   *   to declare its own catalog.allowed_local_roots`).
   * - Any other key at any of those levels is refused as unknown.
   *
   * `test/cadenza/smoke.test.ts` carries a working `git_url` layer. The rules
   * are cadenza's and are restated here only so a caller has something to write
   * against; rondo does not check them (D-0018 rule 7). A layer that breaks
   * one is thrown by `resolveProject` at the conductor's `classify` step,
   * `classifyPlan` carries the message as a refusal, and the iteration ends at
   * terminal `abandoned` -- after the row is reserved.
   */
  readonly catalogLayers: readonly CatalogLayer[];
  readonly projectName: string;
  readonly agentTypeInput: AgentTypeInput;
  /**
   * The two identities the contract is issued between.
   *
   * **`grantee` is `runId`, spelled a second time.** `classifyPlan` hands
   * cadenza the run id as its classification context, and cadenza answers a
   * contract whose grantee differs with `grantee_mismatch` -- an *answered*
   * classification, not a refusal, which ends the iteration at terminal
   * `abandoned` (D-0019 rule 15) after the row is reserved and the single-flight
   * lock taken. {@link runPlan} refuses the mismatch instead, before either.
   */
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

/**
 * A validated plan with the allocator's three identifiers on it.
 *
 * The shape everything downstream of `admit()` actually needs: continuo's two
 * verbs are handed a run id, a workspace and a topic branch, and none of them
 * is the caller's any more (D-0023 rule 9). Keeping it a separate type from
 * {@link RunPlan} rather than making the three fields optional is what makes
 * "the caller cannot write these" and "the invoker can rely on these" the same
 * statement, checked by the compiler at every site in between.
 */
export interface AdmittedPlan extends RunPlan, Allocation {}

/** A plan rondo accepted, or the first reason it did not. */
export type PlanOutcome =
  | { readonly kind: "planned"; readonly plan: RunPlan }
  | { readonly kind: "refused"; readonly reason: string };

/** An admitted plan, or the first reason its identifiers were not usable. */
export type AdmittedPlanOutcome =
  | { readonly kind: "planned"; readonly plan: AdmittedPlan }
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
      workspaceRoot: requireAbsolute("workspaceRoot", input.workspaceRoot),
      baseBranch: requireNotOptionShaped("baseBranch", input.baseBranch),
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
      identityReadbackTimeoutMs: requirePositiveInteger(
        "identityReadbackTimeoutMs",
        input.identityReadbackTimeoutMs,
      ),
      gateOptions: requireGateOptions(input.gateOptions),
      gateDeadlineAtMs: optionalPositiveInteger("gateDeadlineAtMs", input.gateDeadlineAtMs),
      pullRequestBaseBranch:
        input.pullRequestBaseBranch === null
          ? null
          : requireNotOptionShaped("pullRequestBaseBranch", input.pullRequestBaseBranch),
      invocationCeilingMs: requireCeiling(input),
      catalogLayers: requireCatalogLayers(input.catalogLayers),
      projectName: requireNonEmpty("projectName", input.projectName),
      agentTypeInput: input.agentTypeInput,
      parties: requireParties(input),
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
  const floor = input.turnTimeoutMs + input.gitTimeoutMs + input.identityReadbackTimeoutMs;
  if (ceiling <= floor) {
    return refuse(
      `'invocationCeilingMs' is ${String(ceiling)}, which is not above ` +
        "turnTimeoutMs + gitTimeoutMs + identityReadbackTimeoutMs " +
        `(${String(floor)}). rondo's ceiling firing means the CLI ` +
        "was killed and the fenced worker was not, so it must be the operator's declared " +
        "patience above continuo's own budgets rather than a number derived from them.",
    );
  }
  return ceiling;
}

/**
 * The parties, checked against the one other field of the plan the grantee
 * has to equal.
 *
 * The rule is rondo's consequence and not cadenza's restated: `classifyPlan`
 * passes `plan.runId` as the classification context's `runId`, and cadenza
 * compares that against the contract's grantee. So the only correct value of
 * `parties.grantee` is `runId`, and a plan whose two spellings differ would
 * come back `grantee_mismatch` as an *answered* classification -- terminal
 * `abandoned` (D-0019 rule 15) after a row was reserved and the single-flight
 * lock taken, for a field knowable before either. The identities themselves
 * are not checked here: `delegationContract()` validates them on the way in,
 * and a second copy of those rules would be the drift D-0016 warned about.
 */
function requireParties(input: RunPlan): IssuanceParties {
  // `RunPlan` is structural and a caller can hand over what never passed this
  // function, so the container is checked before a field of it is read: a
  // `TypeError` here would be a throw out of a function whose contract is to
  // refuse.
  const parties: unknown = input.parties;
  if (typeof parties !== "object" || parties === null || Array.isArray(parties)) {
    return refuse("'parties' is not a table, and cadenza issues a contract between two identities");
  }
  // The grantee is **not** checked here any more. It is not the caller's to
  // write under D-0023 rule 9: the allocator mints the run id, so the only
  // correct grantee is a value the caller cannot know at this point.
  // {@link admittedPlan} fills it and then asserts it.
  return input.parties;
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
 * Put the allocator's three identifiers onto a validated plan.
 *
 * **The shape checks that used to run on the caller's typing now run on
 * rondo's own construction, and that is a smaller job rather than a larger
 * one** (D-0023 rule 9). `requireIdentifier`, `requireAbsolute` and
 * `requireNotOptionShaped` are the same three functions D-0019 pointed at an
 * operator's command line; here they assert that the derivation produced
 * something continuo will accept. They are **not** the whole of the validation
 * and must not be read as it: neither absoluteness nor option-shape catches a
 * workspace that escapes its root or a derivation that is not injective, which
 * is why the alphabet is checked on the iteration id on the way *in*, before
 * anything is derived from it.
 *
 * **`parties.grantee` is written here and then asserted.** cadenza answers a
 * contract whose grantee differs from the classification context with
 * `grantee_mismatch` -- an *answered* classification, so terminal `abandoned`
 * after the row exists. The caller can no longer write the run id, so it can no
 * longer write the grantee either; the allocator fills it, and the equality
 * check survives as an assertion about rondo's own two writes. It is placed
 * where it can never fail silently rather than removed as unreachable: a later
 * edit that filled one of the two from somewhere else would fail here instead
 * of at cadenza, after a lap.
 */
export function admittedPlan(plan: RunPlan, allocation: Allocation): AdmittedPlanOutcome {
  try {
    const runId = requireIdentifier("runId", allocation.runId);
    const parties: IssuanceParties = { ...plan.parties, grantee: runId };
    const admitted: AdmittedPlan = {
      ...plan,
      runId,
      leaseClaimantId: requireIdentifier("leaseClaimantId", allocation.leaseClaimantId),
      workspace: requireAbsolute("workspace", allocation.workspace),
      topicBranch: requireNotOptionShaped("topicBranch", allocation.topicBranch),
      parties,
    };
    if (admitted.parties.grantee !== admitted.runId) {
      return refuse(
        `'parties.grantee' is '${String(admitted.parties.grantee)}' and 'runId' is ` +
          `'${admitted.runId}'. rondo writes both, from one allocation, so this cannot be a ` +
          "caller's mistake -- it is rondo having acquired a second authority for the run id.",
      );
    }
    return { kind: "planned", plan: Object.freeze(admitted) };
  } catch (error) {
    if (error instanceof PlanRefusal) {
      return { kind: "refused", reason: error.message };
    }
    throw error;
  }
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
export function planPayload(plan: AdmittedPlan): JsonRecord {
  return {
    db: plan.db,
    workspace_root: plan.workspaceRoot,
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
    identity_readback_timeout_ms: plan.identityReadbackTimeoutMs,
    gate_options: [...plan.gateOptions],
    gate_deadline_at_ms: plan.gateDeadlineAtMs,
    pull_request_base_branch: plan.pullRequestBaseBranch,
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
export function readPlan(payload: JsonRecord): AdmittedPlanOutcome {
  const validated = readRunPlan(payload);
  if (validated.kind === "refused") {
    return validated;
  }
  try {
    // Read back rather than re-derived, and that is the point of storing them.
    // Re-deriving from the iteration id would give the right answer for every
    // row rondo has ever written and the wrong one for any row whose triple was
    // not a function of its own id -- so the row, and not the derivation, is
    // what the machine reads.
    const allocation: Allocation = {
      runId: readString(payload, "run_id"),
      leaseClaimantId: readString(payload, "lease_claimant_id"),
      workspace: readString(payload, "workspace"),
      topicBranch: readString(payload, "topic_branch"),
    };
    return admittedPlan(validated.plan, allocation);
  } catch (error) {
    if (error instanceof PlanRefusal) {
      return { kind: "refused", reason: error.message };
    }
    throw error;
  }
}

/**
 * The caller's half of a plan, read from a document (D-0023 rule 9).
 *
 * What an operator's plan file holds: everything except the three identifiers
 * the allocator mints. Separate from {@link readPlan} because the two documents
 * are genuinely different -- a plan file is written by a person before an
 * iteration exists, and a stored payload is written by rondo after one does --
 * and reading the first with the second's rules would demand that an operator
 * type the values D-0023 exists to stop them typing.
 */
export function readRunPlan(payload: JsonRecord): PlanOutcome {
  try {
    const draft: RunPlan = {
      db: readString(payload, "db"),
      workspaceRoot: readString(payload, "workspace_root"),
      baseBranch: readString(payload, "base_branch"),
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
      identityReadbackTimeoutMs: readNumber(payload, "identity_readback_timeout_ms"),
      gateOptions: readStringArray(payload, "gate_options"),
      gateDeadlineAtMs: readNullableNumber(payload, "gate_deadline_at_ms"),
      pullRequestBaseBranch: readAbsentAsNullString(payload, "pull_request_base_branch"),
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

/**
 * A nullable string whose **key may be absent**, which is true of exactly one
 * field and is a decision rather than a convenience.
 *
 * Every other reader below refuses an absent key, correctly: the payload is
 * `planPayload`'s own rendering, so a missing field means the bytes are not a
 * plan rondo wrote. `pull_request_base_branch` is the exception because it was
 * added after rows existed, and **the plan column has no migration**: the store
 * persists the bytes verbatim (D-0019 rule 4) and hands them back unaltered, so
 * a strict read here would make every iteration written before this field
 * unreadable -- which the interpreter files at `stalled`, and which `publish`
 * would hit on a row whose lap has already been paid for. An absent key means
 * "no revision has happened to this plan", which is what a plan written by an
 * operator means too. A key that is present and not a string is still refused.
 */
function readAbsentAsNullString(payload: JsonRecord, key: string): string | null {
  return payload[key] === undefined ? null : readNullableString(payload, key);
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
