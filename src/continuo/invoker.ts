/**
 * The one module in rondo that owns a process.
 *
 * D-0001 item 2 puts continuo behind a CLI process boundary and D-0015 rule 1
 * re-affirms it; D-0017 makes the spawn a *capability*, granted to this module
 * by name in `test/architecture/import-boundaries.test.ts` and to no other. The
 * split is the point: `src/continuo/protocol.ts` is a pure reader of bytes with
 * no way to produce any, and this file is the only place bytes can come from.
 * A second module in this layer that reached for `node:child_process` fails the
 * boundary sweep, and there is a planted case that proves it.
 *
 * **How the child is started, and why each part of that matters.**
 * `spawn(process.execPath, [cli, ...argv], { shell: false })`: the executable
 * is the Node running rondo, so the child cannot pick up a different runtime
 * from `PATH`; the CLI path and every argument are separate array elements, so
 * nothing is ever quoted, joined or re-split, and a workspace path with a
 * space, a backslash or a drive letter in it survives unchanged; and
 * `shell: false` -- the default, written out because it is load-bearing --
 * means no shell ever sees any of it.
 *
 * **The close event, not the exit event.** `exit` fires when the child dies;
 * `close` fires when its stdio has also been drained. Reading the streams after
 * `exit` can lose the tail of a refusal, and on Windows a directory cannot be
 * removed while a handle into it is still open, so a smoke that cleaned up on
 * `exit` would fail there and nowhere else.
 *
 * **The pin is not negotiable and the location is.** `RONDO_CONTINUO_CLI`
 * names an already-built `dist/cli.js`; it cannot say which revision that build
 * is, because {@link startContinuo} asks the build itself and compares the
 * answer with `src/continuo/pin.ts` before rondo drives a single verb (D-0015
 * rule 6, D-0017 rule 5).
 */
import { spawn } from "node:child_process";

import { CONTINUO_REVISION, type PinVerdict, verifyVersionLine } from "./pin.js";
import {
  type ContinuoResult,
  decode,
  GATE_SHOW,
  type GateDetail,
  type InvocationOutput,
  LAP_PERFORM,
  type LapPerformed,
  RUN_ADMIT,
  type RunAdmitted,
  type VerbContract,
} from "./protocol.js";
import { mapModelTier, mapNeutralRole } from "./roles.js";

/**
 * The flag that turns a continuo verb into a document rondo can decode.
 *
 * Spelled once, here, because eleven call sites spelling it is eleven chances
 * to forget it -- which is continuo's own reason for declaring it in one module
 * on its side of the seam.
 */
const JSON_FLAG = "--json";

/** The environment variable that locates a built continuo. Never the pin. */
export const CLI_PATH_ENV = "RONDO_CONTINUO_CLI";

/**
 * A continuo rondo has verified and may drive.
 *
 * `revision` is what `--version` *observed*, not what the pin expected: the two
 * are equal by the time this record exists, and recording the observation is
 * what makes the record evidence rather than a restatement (D-0015 rule 6).
 *
 * **This record is local and per-process.** Rule 6 also requires the observed
 * revision to be persisted per run, and rondo has no store schema yet
 * (`src/store/sqlite.ts` names the seam and throws), so D-0017 rule 5 leaves
 * that half to the issue that gives rondo a store. What exists today is the
 * verification and the value; what does not exist is a row.
 */
export interface VerifiedContinuo {
  readonly cliPath: string;
  readonly revision: string;
}

/**
 * The handles this module actually issued.
 *
 * `VerifiedContinuo` is a structural type, so `{ cliPath, revision }` written
 * by hand satisfies it — and a caller who wrote one would be driving an
 * arbitrary executable while holding a value whose name says rondo checked it.
 * The type cannot prevent that (a JavaScript caller has no types at all), so
 * the check is a runtime one: {@link startContinuo} registers what it verified,
 * and {@link run} drives nothing that is not in here. A `WeakSet` because the
 * registry must not be the reason a handle outlives its use.
 *
 * This is the same shape of argument as the layer's `spawn` grant: the boundary
 * is worth nothing if the thing it protects can be reached another way.
 */
const verifiedHandles = new WeakSet<VerifiedContinuo>();

/** Whether rondo may start at all. */
export type StartupResult =
  | { readonly kind: "ready"; readonly continuo: VerifiedContinuo }
  | { readonly kind: "refused"; readonly reason: string };

/**
 * How long `--version` may take.
 *
 * The one invocation with no {@link VerbContract} behind it, so it is the one
 * number still spelled in this module: every driven verb carries its own bound
 * on its contract now (D-0019 rule 12 part 1), and the justification for a
 * minute moved there with it. `--version` prints a line and exits, so a minute
 * here is a hang detector and nothing else.
 */
const VERSION_TIMEOUT_MS = 60_000;

/**
 * The endpoint recipients continuo's outbox has a handler for, at the pinned
 * revision.
 *
 * `--endpoint-recipient` is the one `lap perform` flag with a `choices` list,
 * and continuo builds that list at runtime from a real registry -- deliberately,
 * so a recipient added or renamed cannot leave the flag behind. rondo therefore
 * cannot read it and transcribes it, exactly as `src/refrain/plan.ts` does for
 * the plan's own validation.
 *
 * **The duplication is deliberate and it is the layering.** This layer names
 * only itself: importing the plan's copy would put an arrow from `src/continuo`
 * into `src/refrain`, which is the arrow D-0019 rule 1 spends the whole ports
 * design avoiding in the other direction. The two copies are pinned to the same
 * revision and the test asserts this one against the argv it produces.
 */
export const SERVED_ENDPOINT_RECIPIENTS = Object.freeze([
  "external-notify",
  "human-gated-effect",
] as const);

/**
 * Locate the built CLI, or say why rondo cannot.
 *
 * Absolute only. A relative path would be resolved against whatever directory
 * the host happened to be started in, which is a different file on two runs of
 * the same configuration -- and the one thing this seam must not be is
 * ambiguous about which build it drove.
 */
export function resolveCliPath(environment: Readonly<Record<string, string | undefined>>): {
  readonly path: string | null;
  readonly reason: string;
} {
  const raw = environment[CLI_PATH_ENV];
  if (raw === undefined || raw.trim() === "") {
    return {
      path: null,
      reason:
        `${CLI_PATH_ENV} is not set. It must be the absolute path of a built continuo ` +
        `dist/cli.js at revision ${CONTINUO_REVISION}; it locates a build and never ` +
        "replaces the pin.",
    };
  }
  const path = raw.trim();
  if (!isAbsolutePath(path)) {
    return {
      path: null,
      reason: `${CLI_PATH_ENV} is '${path}', which is not an absolute path.`,
    };
  }
  if (!endsWithCliEntry(path)) {
    return {
      path: null,
      reason:
        `${CLI_PATH_ENV} is '${path}', and rondo drives continuo's built entry point, ` +
        "which is dist/cli.js.",
    };
  }
  return { path, reason: "" };
}

/**
 * Absolute on either platform, decided by shape rather than by `node:path`.
 *
 * `path.isAbsolute` answers for the platform it is running on, which is the
 * right answer at runtime and the wrong one for a rule rondo states about its
 * own configuration -- and reaching for it would put a second external module
 * into the layer for a three-line regular expression. POSIX roots, a drive
 * letter with either separator, and a UNC share are all of it.
 */
function isAbsolutePath(path: string): boolean {
  return /^(?:\/|\\\\|[A-Za-z]:[\\/])/.test(path);
}

/** `.../dist/cli.js`, with either separator. */
function endsWithCliEntry(path: string): boolean {
  return /[\\/]dist[\\/]cli\.js$/.test(path);
}

/**
 * Read `--version` from the located build and check it against the pin.
 *
 * The first thing rondo does with continuo, and the gate on everything after
 * it: a build whose revision is unknown, dirty or simply not the pinned one is
 * refused here rather than driven and recorded afterwards.
 */
export async function startContinuo(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Promise<StartupResult> {
  const located = resolveCliPath(environment);
  if (located.path === null) {
    return { kind: "refused", reason: located.reason };
  }
  const output = await runProcess(located.path, ["--version"], VERSION_TIMEOUT_MS);
  if (output.kind === "failed" || output.kind === "timedOut") {
    // The two are one answer here, and only here: `--version` starts no child
    // of its own, so a timed-out `--version` orphans nothing and there is no
    // running lap for the distinction to protect. rondo simply did not learn
    // which build it was pointed at, and refuses to start.
    return { kind: "refused", reason: output.reason };
  }
  if (output.value.status !== 0) {
    return {
      kind: "refused",
      reason:
        `continuo --version exited ${String(output.value.status)}. rondo cannot identify ` +
        `the build at '${located.path}'. stderr: ${output.value.stderr.trim()}`,
    };
  }
  const verdict: PinVerdict = verifyVersionLine(output.value.stdout);
  if (verdict.kind === "refused") {
    return { kind: "refused", reason: verdict.reason };
  }
  const continuo: VerifiedContinuo = { cliPath: located.path, revision: verdict.revision };
  verifiedHandles.add(continuo);
  return { kind: "ready", continuo };
}

/**
 * Drive one verb and decode its answer.
 *
 * The only way out of this layer: a caller gets one of the six outcomes
 * `protocol.ts` defines, never a document, never a stream and never an exit
 * code.
 *
 * **The bound comes from the contract, and a caller may raise it.** Each verb
 * carries its own `timeoutMs` (D-0019 rule 12 part 1); `options.timeoutMs`
 * overrides it for one call, which is how `lap perform` is bounded by the
 * operator's declared patience rather than by a number written in this
 * repository. The override is a per-call argument rather than a second field on
 * the contract because the contract is a constant shared by every call and the
 * ceiling belongs to one run's plan.
 */
export async function run<T>(
  continuo: VerifiedContinuo,
  contract: VerbContract<T>,
  argv: readonly string[],
  options: { readonly timeoutMs?: number } = {},
): Promise<ContinuoResult<T>> {
  if (!verifiedHandles.has(continuo)) {
    // Checked before the arguments and before the spawn, because it is the
    // invariant the other two exist inside: rondo drives a build whose revision
    // it read from the build itself and compared with the committed pin. A
    // handle this module did not issue has had none of that done to it,
    // whatever its fields say.
    return {
      kind: "invokerDefect",
      reason:
        `rondo was asked to drive continuo ${contract.command.join(" ")} through a handle it ` +
        "did not issue. A VerifiedContinuo comes from startContinuo, which reads --version and " +
        "checks it against the pin; one written by hand has been verified by nobody.",
    };
  }
  const unusable = unusableArgument(argv);
  if (unusable !== null) {
    // Before the spawn on purpose, and for two different hazards. An
    // operator-supplied value that is EMPTY reaches continuo as an exit 1 and a
    // raw stack (D-0015's exception 2). One containing a NUL never reaches
    // continuo at all: `spawn` throws *synchronously* on it rather than
    // emitting the `error` event, which would reject a promise this module
    // promises never to reject. Both are answered here, as the defect they are.
    return {
      kind: "invokerDefect",
      reason:
        `rondo built ${unusable} for continuo ${contract.command.join(" ")}. Every ` +
        "operator-supplied value is validated before it reaches a continuo command line.",
    };
  }
  // `--json` is put on by the invoker, not by the caller. Every verb this layer
  // decodes answers in the envelope only when the flag is present, and a caller
  // that forgot it would run continuo in human-output mode: a MUTATING verb
  // would succeed, its prose would fail to decode, and rondo would report its
  // own defect for a command that had already taken effect -- an invitation to
  // retry a write that did not need retrying. So the flag is a property of
  // driving continuo rather than a convention every call site must remember. A
  // caller that passes it anyway is not punished; it is spelled once.
  const output = await runProcess(
    continuo.cliPath,
    [...contract.command, ...argv.filter((argument) => argument !== JSON_FLAG), JSON_FLAG],
    options.timeoutMs ?? contract.timeoutMs,
  );
  if (output.kind === "failed") {
    return { kind: "invokerDefect", reason: output.reason };
  }
  if (output.kind === "timedOut") {
    // Not folded into the defect above, and D-0019 rule 12 is why: rondo's
    // timer killed the CLI and not whatever the CLI had started, so this is the
    // one outcome after which something of continuo's may still be running.
    // The conductor keeps the single-flight lock on it and asks a human.
    return { kind: "timedOut", reason: output.reason };
  }
  return decode(contract, output.value);
}

/**
 * The first argument rondo must not hand to `spawn`, described, or null.
 *
 * Two shapes, and neither is continuo's problem: an empty string, which
 * continuo answers with a stack rather than a refusal, and an embedded NUL,
 * which `spawn` rejects by throwing before any child exists. Described rather
 * than returned, because the message is the whole point -- an index alone sends
 * a reader back to count arguments.
 */
export function unusableArgument(argv: readonly string[]): string | null {
  for (const [index, argument] of argv.entries()) {
    if (argument === "") {
      return `an empty argument at position ${String(index)}`;
    }
    if (argument.includes("\u0000")) {
      return `an argument containing a NUL byte at position ${String(index)}`;
    }
  }
  return null;
}

/**
 * What {@link runProcess} answers: bytes, or the reason there are none.
 *
 * **`timedOut` is separate from `failed` because the two say different things
 * about the world.** A `failed` invocation never ran, or died in a way the
 * operating system reported; a `timedOut` one was killed by rondo's own timer,
 * which reaches the CLI and not the fenced child the CLI started. Before this
 * variant existed the timer called `kill()` and the child's death then arrived
 * as an ordinary signal kill, which `decode` -- correctly, given what it was
 * told -- reported as a rondo defect. That is exactly the conflation D-0019
 * rule 12 forbids, and it was invisible: the two paths produced the same value.
 */
type ProcessOutcome =
  | { readonly kind: "ran"; readonly value: InvocationOutput }
  | { readonly kind: "failed"; readonly reason: string }
  | { readonly kind: "timedOut"; readonly reason: string };

/**
 * Spawn continuo, collect both streams, and resolve when the child has closed.
 *
 * Never rejects. A spawn that fails, a runtime that is not there, a child that
 * hangs -- each is a sentence rondo can act on, and a rejected promise here
 * would put process management into every caller's error handling.
 */
async function runProcess(
  cliPath: string,
  argv: readonly string[],
  timeoutMs: number,
): Promise<ProcessOutcome> {
  return await new Promise<ProcessOutcome>((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(process.execPath, [cliPath, ...argv], {
        shell: false,
        // stdin is closed: continuo's driven verbs read none, and an inherited
        // stdin would let a child block on a terminal rondo owns.
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      // `spawn` reports most failures through the `error` event, and a few --
      // an argument or a path containing a NUL, an invalid option -- by
      // throwing right here. `unusableArgument` refuses the reachable ones
      // before this point; this catch is what keeps the remainder a value
      // rather than a rejected promise, which is what every caller is written
      // against.
      resolve({
        kind: "failed",
        reason:
          `rondo could not start continuo at '${cliPath}': ` +
          `${error instanceof Error ? error.message : String(error)}. ` +
          "This is rondo's own defect, not continuo's answer.",
      });
      return;
    }
    let stdout = "";
    let stderr = "";
    let settled = false;
    // The flag, and it is the whole mechanism. `kill()` is indistinguishable
    // from any other signal death by the time `close` fires -- the child reports
    // `SIGTERM` either way -- so the only thing that knows rondo was the cause
    // is rondo, at the moment it decided. Recording it here is what lets the
    // `close` handler below tell "we gave up" from "something killed it".
    let firedOwnTimer = false;
    const timer = setTimeout(() => {
      firedOwnTimer = true;
      child.kill();
    }, timeoutMs);
    // `unref` so a pending timer cannot hold the process open once the child
    // has closed and the timer has been cleared on every other path.
    timer.unref();

    const finish = (outcome: ProcessOutcome): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(outcome);
    };

    // Both are pipes by the `stdio` above, so neither can be null in practice.
    // The check is here because the declared type says they can be, and a
    // non-null assertion would be rondo asserting something about a value it
    // did not check -- in the one module that owns a process.
    const fromChild = child.stdout;
    const fromChildErrors = child.stderr;
    if (fromChild === null || fromChildErrors === null) {
      child.kill();
      finish({
        kind: "failed",
        reason:
          `rondo started continuo at '${cliPath}' without the pipes it asked for. ` +
          "This is rondo's own defect, not continuo's answer.",
      });
      return;
    }
    fromChild.setEncoding("utf8");
    fromChildErrors.setEncoding("utf8");
    fromChild.on("data", (chunk: string) => {
      stdout += chunk;
    });
    fromChildErrors.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error: Error) => {
      finish({
        kind: "failed",
        reason:
          `rondo could not run continuo at '${cliPath}': ${error.message}. ` +
          "This is rondo's own defect or a broken provisioning step, not continuo's answer.",
      });
    });
    // `close`, not `exit`: the streams are drained by the time this fires, and
    // on Windows a scratch directory cannot be removed while a handle into it
    // is still open.
    child.on("close", (status: number | null, signal: NodeJS.Signals | null) => {
      if (firedOwnTimer) {
        // Checked before the streams are handed on, because whatever the child
        // managed to print before rondo killed it is a fragment of an answer
        // and not an answer. Reporting it as one is how a partial document
        // becomes a decode failure blamed on continuo.
        finish({
          kind: "timedOut",
          reason:
            // The verb, not the argv: an argument vector carries a prompt an
            // operator wrote, which is arbitrary text and reaches a cp932
            // console (D-0004). The first two tokens are the verb's name.
            `rondo gave up on continuo ${argv.slice(0, 2).join(" ")} after ` +
            `${String(timeoutMs)}ms and ` +
            "killed the CLI. rondo's timer does not reach a fenced child the CLI started, so " +
            "a worker may still be running with nobody polling it. This needs a human: rondo " +
            "cannot tell from here whether the lap is over.",
        });
        return;
      }
      finish({ kind: "ran", value: { status, signal, stdout, stderr } });
    });
  });
}

// --- the typed entry points -------------------------------------------------

/**
 * The three verbs the conductor drives, as functions that own their own argv.
 *
 * **No caller ever names a continuo role or spells a flag** (D-0014 rule 1,
 * D-0019 rules 12 and 13). {@link run} stays exported because the smoke drives
 * verbs the loop does not, but nothing on the lap-1 path builds an argument
 * vector: it hands one of these a record and gets one of `protocol.ts`'s
 * outcomes back.
 *
 * **The request types are declared here, in this layer's own vocabulary, and
 * they take only strings, numbers and arrays.** They are deliberately *not*
 * `RunPlan`: `src/refrain` may not be imported from here any more than the
 * reverse, and a request type that named a plan would drag the conductor's
 * vocabulary -- and cadenza's, which the plan carries -- across a boundary the
 * whole ports design exists to keep. The composition root in `src/access` is
 * what turns one plan into these three records.
 *
 * **Validation happens before the spawn.** D-0015's exception 2 measured the
 * alternative: an empty `--run-id`, `--workspace`, `--base-branch`,
 * `--topic-branch` or `--lease-claimant-id` reaches rondo as exit 1 and a raw
 * stack rather than a refusal document. So every field is checked against the
 * rule continuo states for it -- absolute where continuo requires absolute, an
 * identifier with no whitespace, a recipient continuo serves, a branch that is
 * not option-shaped -- and a failure is rondo's own refusal, named by field,
 * with no process started. {@link unusableArgument} stays the floor beneath
 * that: it catches what any argv must not contain, and these catch what these
 * particular flags must not carry.
 */

/** A field that must not reach a continuo command line, and why. */
class ArgumentRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArgumentRefusal";
  }
}

function requireText(field: string, value: string): string {
  if (value.trim() === "") {
    throw new ArgumentRefusal(
      `'${field}' is empty, and continuo answers an empty value with a stack`,
    );
  }
  if (value.includes("\u0000")) {
    throw new ArgumentRefusal(`'${field}' contains a NUL byte, which no command line can carry`);
  }
  return value;
}

/**
 * Absolute by shape, for the reason {@link resolveCliPath} gives above:
 * `path.isAbsolute` answers for the platform it runs on, and this is a rule
 * rondo states about continuo's requirement rather than about its own host.
 */
function requireAbsolute(field: string, value: string): string {
  requireText(field, value);
  if (!isAbsolutePath(value)) {
    throw new ArgumentRefusal(
      `'${field}' is '${value}', and continuo requires an absolute path here: a relative one ` +
        "would be resolved against whichever directory the host happened to be started in",
    );
  }
  return value;
}

/**
 * Not option-shaped.
 *
 * A value beginning with `-` is read by an argument parser as a flag, so a
 * topic branch called `--help` is not a branch at all. continuo's parser would
 * refuse it in prose; rondo refuses it as its own, before the spawn.
 */
function requireNotOptionShaped(field: string, value: string): string {
  requireText(field, value);
  if (value.startsWith("-")) {
    throw new ArgumentRefusal(
      `'${field}' is '${value}', which an argument parser reads as a flag rather than a value`,
    );
  }
  return value;
}

/** An identifier continuo carries into a lease and a row: no whitespace. */
function requireIdentifier(field: string, value: string): string {
  requireNotOptionShaped(field, value);
  if (/\s/.test(value)) {
    throw new ArgumentRefusal(`'${field}' is '${value}', and an identifier carries no whitespace`);
  }
  return value;
}

function requirePositiveInteger(field: string, value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ArgumentRefusal(
      `'${field}' is ${String(value)}, and a positive whole number of milliseconds was required`,
    );
  }
  return value;
}

/** An optional path flag that is null is not put on the command line at all. */
function optionalFlag(name: string, field: string, value: string | null): readonly string[] {
  return value === null ? [] : [name, requireAbsolute(field, value)];
}

function optionalIntegerFlag(name: string, field: string, value: number | null): readonly string[] {
  return value === null ? [] : [name, String(requirePositiveInteger(field, value))];
}

/**
 * A field rondo refused, reported as rondo's defect rather than continuo's.
 *
 * The same shape as {@link unusableArgument}'s answer and for the same reason:
 * an operator's typo that rondo catches is still rondo's to explain, because
 * continuo never saw it and has no opinion to relay.
 */
function refusedArgument<T>(contract: VerbContract<T>, error: ArgumentRefusal): ContinuoResult<T> {
  return {
    kind: "invokerDefect",
    reason:
      `rondo will not build a continuo ${contract.command.join(" ")} command line: ` +
      `${error.message}. Nothing was spawned, so continuo has neither seen this request nor ` +
      "acted on it.",
  };
}

/** Everything `run admit` needs, in rondo's words rather than continuo's. */
export interface AdmitRunRequest {
  /** The control-plane database. Absolute. */
  readonly db: string;
  readonly runId: string;
  readonly leaseClaimantId: string;
  /** The worktree the run will be materialised into. Absolute. */
  readonly workspace: string;
  /**
   * cadenza's `executorPolicy.roleName`, **neutral and unmapped**.
   *
   * The caller passes the name it has; {@link admitRun} is what turns it into a
   * continuo role or refuses it. A caller that could pass a continuo role would
   * be a caller that knows continuo's roster, which is the leak D-0014 rule 1
   * forbids.
   */
  readonly neutralRoleName: string;
  readonly baseBranch: string;
  readonly topicBranch: string;
  /** The request text. Arbitrary, and the only field here that is prose. */
  readonly prompt: string;
}

/**
 * What {@link admitRun} answers: continuo's outcome, and the role rondo used.
 *
 * **A wrapper rather than a field smuggled into the payload**, and the choice
 * is worth a sentence. The mapped role is not in continuo's answer document --
 * `run admit` echoes the run id, the status and a timestamp, and says nothing
 * about the role -- so putting it inside `RunAdmitted` would mean the decoder's
 * record carried a field the decoder cannot read, which is the one property
 * `protocol.ts` is built to keep. The caller needs it anyway, because the
 * iteration row records the role that was actually used. So it travels beside
 * the result: a fact about the *call*, next to the answer to the call.
 *
 * `continuoRole` is null exactly when rondo refused before driving the verb --
 * an unmapped neutral name, or a field that failed validation -- so a reader
 * cannot mistake a refusal for an admission under some role.
 */
export interface AdmitRunOutcome {
  readonly result: ContinuoResult<RunAdmitted>;
  readonly continuoRole: string | null;
}

/**
 * Admit one run: map the role, build the argv, drive the verb.
 *
 * **The unmapped role is refused here, without a spawn.** It is rondo's own
 * vocabulary error: cadenza accepts any structurally valid role name and says
 * it does not know which roles exist, so a name outside the roster recorded in
 * `roles.ts` is a gap in rondo's table rather than anything continuo did. It
 * is that module's `mapNeutralRole` that decides, and this is the only reader
 * of it in the repository. continuo would
 * refuse it too -- `UnknownRoleRefused`, before its transaction opens -- and
 * letting it get that far would report rondo's missing mapping as continuo's
 * answer.
 *
 * **There is no `--cli-arg` on this request, and there is none anywhere else in
 * the lap-1 API.** D-0011 rule 1 admits with none; continuo's own
 * `src/fencing/cli_args_allow.json` is `{"entries": []}` at the pinned
 * revision, so a non-empty vector would be refused upstream anyway. The absence
 * costs nothing today and closes the route permanently -- whereas a field that
 * *could* carry one would be a place for a later change to put one without an
 * entry, which is the failure the allowlist exists to prevent.
 */
export async function admitRun(
  continuo: VerifiedContinuo,
  request: AdmitRunRequest,
): Promise<AdmitRunOutcome> {
  const mapping = mapNeutralRole(request.neutralRoleName);
  if (mapping.kind === "unknown") {
    // Before the argv and before the spawn: the reason names the neutral name
    // and the roster, because the person who can fix it is looking for both.
    return { result: { kind: "invokerDefect", reason: mapping.reason }, continuoRole: null };
  }
  let argv: readonly string[];
  try {
    argv = [
      "--db",
      requireAbsolute("db", request.db),
      "--run-id",
      requireIdentifier("runId", request.runId),
      "--lease-claimant-id",
      requireIdentifier("leaseClaimantId", request.leaseClaimantId),
      "--workspace",
      requireAbsolute("workspace", request.workspace),
      "--role",
      mapping.role,
      "--base-branch",
      requireNotOptionShaped("baseBranch", request.baseBranch),
      "--topic-branch",
      requireNotOptionShaped("topicBranch", request.topicBranch),
      // **`--prompt=<value>`, joined, and every other flag stays separate.**
      // The prompt is the one argument here that is arbitrary prose a person
      // typed, so it is the one that can legitimately look like an option. As a
      // separate token, a prompt of `--help` would be read by continuo's
      // argparse-compatible parser as a flag rather than as this flag's value,
      // and a prompt of exactly `--json` would be deleted outright by {@link run}'s
      // own de-duplication of that flag -- in both cases admitting something
      // other than what the person asked for, silently. argparse's explicit-value
      // form takes everything after the first `=` as the value, whatever it looks
      // like, which is why it is used here and only here: the other values are
      // identifiers and paths that are already refused when they are
      // option-shaped, and joining them would hide that check behind a spelling.
      `--prompt=${requireText("prompt", request.prompt)}`,
    ];
  } catch (error) {
    if (error instanceof ArgumentRefusal) {
      return { result: refusedArgument(RUN_ADMIT, error), continuoRole: null };
    }
    throw error;
  }
  return { result: await run(continuo, RUN_ADMIT, argv), continuoRole: mapping.role };
}

/** Everything `lap perform` needs, including the one bound that is rondo's. */
export interface PerformLapRequest {
  readonly db: string;
  readonly runId: string;
  /** The repository the workspace is cut from. Absolute. */
  readonly repository: string;
  readonly artifactRoot: string;
  readonly stateRoot: string;
  /** One of {@link SERVED_ENDPOINT_RECIPIENTS}. */
  readonly endpointRecipient: string;
  readonly endpointDestinationDir: string;
  /**
   * The worker CLI as a command prefix, in order, one `--claude-command` per
   * token.
   *
   * One flag per token rather than one flag holding a joined string, because
   * continuo's parser appends and the tokens are argv elements on the far side
   * too: joining them would put a quoting rule between rondo and a fence.
   */
  readonly claudeCommand: readonly string[];
  /**
   * cadenza's `executorPolicy.modelTier`, **neutral and unmapped**.
   *
   * The caller passes the tier it has; {@link performLap} is what turns it into
   * a model id or refuses it, exactly as {@link admitRun} does with the neutral
   * role name. A caller that could pass a model id would be a caller that knows
   * the worker CLI's roster, which is the same leak D-0014 rule 1 forbids for
   * continuo's roles.
   */
  readonly modelTier: string;
  readonly interlockRoot: string;
  readonly claudeOrgPath: string;
  readonly endpointDb: string | null;
  readonly endpointModule: string | null;
  readonly node: string | null;
  readonly hookScript: string | null;
  readonly python: string | null;
  readonly pollIntervalMs: number | null;
  /**
   * continuo's three budgets, passed **explicitly and always** (D-0019 rule 12
   * part 2, widened to three by D-0021), so the numbers rondo reasons about are
   * the numbers in force. continuo's own default turn timeout is fifteen
   * minutes and its identity read-back budget is thirty seconds; inheriting
   * either would mean rondo's ceiling was set against a number rondo never saw.
   */
  readonly turnTimeoutMs: number;
  readonly gitTimeoutMs: number;
  /**
   * How long the spawned worker is given to name the session id committed for
   * it, `continuo D-0098`'s `--identity-readback-timeout-ms`.
   *
   * **The caller's budget, and the third one for the same reason as the first
   * two.** Until `continuo D-0098` this window was two hard-coded constants --
   * 50 attempts 50 ms apart -- and the lap-1 dogfood measured a real worker
   * taking 3.5 to 11.3 seconds to emit its first event against that 2.5 second
   * window (F-1). continuo now takes the number and defaults it to 30 s;
   * inheriting the default would put rondo back to reasoning about a budget it
   * never stated.
   */
  readonly identityReadbackTimeoutMs: number;
  readonly gateOptions: readonly string[];
  readonly gateDeadlineAtMs: number | null;
  /**
   * **Not a continuo flag.** rondo's own ceiling on the whole invocation,
   * passed to {@link run} as the per-call timeout override. It never reaches a
   * command line, and it is the operator's declared patience rather than
   * anything rondo computed: `RunPlan` validates it as strictly greater than
   * `turnTimeoutMs + gitTimeoutMs`, a floor rather than an estimate.
   */
  readonly invocationCeilingMs: number;
}

/**
 * What {@link performLap} answers: continuo's outcome, and the model rondo
 * chose.
 *
 * **A wrapper rather than a field read off the payload**, for
 * {@link AdmitRunOutcome}'s reason turned around. continuo's answer *does*
 * carry a `model` -- it is the twelfth field of `continuo.lap.perform/1` -- but
 * that value is what continuo **observed itself doing**, and this one is what
 * rondo **asked for**. Keeping them apart is what lets a caller compare them;
 * folding rondo's request into the decoder's record would leave nothing to
 * compare it against.
 *
 * `model` is null exactly when rondo refused before driving the verb -- an
 * unpriced model tier, or a field that failed validation -- so a reader cannot
 * mistake a refusal for a lap that ran on no particular model.
 */
export interface PerformLapOutcome {
  readonly result: ContinuoResult<LapPerformed>;
  readonly model: string | null;
}

/**
 * Perform one admitted lap, bounded by the caller's ceiling.
 *
 * The flags are in continuo's own declaration order, so `--help` and this
 * function read the same way and a flag continuo adds has an obvious place. An
 * optional field that is null is simply not put on the command line: an omitted
 * flag is continuo's own default, and an empty string in its place would be a
 * value rondo invented.
 *
 * **The unpriced model tier is refused here, without a spawn**, exactly as
 * {@link admitRun} refuses an unmapped role and for a sharper version of the
 * same reason: cadenza validates `executorPolicy.modelTier` structurally and
 * says nothing about which tiers exist, and continuo would not refuse a tier at
 * all -- it never sees one. So a tier outside `roles.ts`'s table is a gap in
 * rondo's own policy, and the alternative to refusing it is a lap that runs on
 * the worker CLI's default, which is the model nobody chose (the dogfood's
 * F-2).
 *
 * **`--model` is therefore on every lap rondo drives.** continuo's own help
 * says omitting the flag is not a neutral choice, and D-0021 takes the side it
 * points at: rondo either knows which model a lap runs on or does not start it.
 */
export async function performLap(
  continuo: VerifiedContinuo,
  request: PerformLapRequest,
): Promise<PerformLapOutcome> {
  const selection = mapModelTier(request.modelTier);
  if (selection.kind === "unknown") {
    // Before the argv and before the spawn: the reason names the tier and the
    // tiers rondo prices, because the person who can fix it is looking for both.
    return { result: { kind: "invokerDefect", reason: selection.reason }, model: null };
  }
  let argv: readonly string[];
  let ceiling: number;
  try {
    ceiling = requirePositiveInteger("invocationCeilingMs", request.invocationCeilingMs);
    argv = [
      "--db",
      requireAbsolute("db", request.db),
      "--run-id",
      requireIdentifier("runId", request.runId),
      "--repository",
      requireAbsolute("repository", request.repository),
      "--artifact-root",
      requireAbsolute("artifactRoot", request.artifactRoot),
      "--state-root",
      requireAbsolute("stateRoot", request.stateRoot),
      "--endpoint-recipient",
      requireServedRecipient(request.endpointRecipient),
      "--endpoint-destination-dir",
      requireAbsolute("endpointDestinationDir", request.endpointDestinationDir),
      ...optionalFlag("--endpoint-db", "endpointDb", request.endpointDb),
      ...optionalFlag("--endpoint-module", "endpointModule", request.endpointModule),
      ...optionalFlag("--node", "node", request.node),
      ...claudeCommandFlags(request.claudeCommand),
      // Two tokens and never `--model=<id>`, which is continuo's own rule for
      // this flag: the value is appended to the fenced child's command line as
      // its own argument, and it has been checked as an id on that assumption.
      "--model",
      selection.model,
      "--interlock-root",
      requireAbsolute("interlockRoot", request.interlockRoot),
      "--claude-org-path",
      requireAbsolute("claudeOrgPath", request.claudeOrgPath),
      ...optionalFlag("--hook-script", "hookScript", request.hookScript),
      ...optionalFlag("--python", "python", request.python),
      ...optionalIntegerFlag("--poll-interval-ms", "pollIntervalMs", request.pollIntervalMs),
      // Always, and never inherited (D-0019 rule 12 part 2, three budgets since
      // D-0021).
      "--turn-timeout-ms",
      String(requirePositiveInteger("turnTimeoutMs", request.turnTimeoutMs)),
      "--git-timeout-ms",
      String(requirePositiveInteger("gitTimeoutMs", request.gitTimeoutMs)),
      "--identity-readback-timeout-ms",
      String(
        requirePositiveInteger("identityReadbackTimeoutMs", request.identityReadbackTimeoutMs),
      ),
      ...gateOptionFlags(request.gateOptions),
      ...optionalIntegerFlag("--gate-deadline-at-ms", "gateDeadlineAtMs", request.gateDeadlineAtMs),
    ];
  } catch (error) {
    if (error instanceof ArgumentRefusal) {
      return { result: refusedArgument(LAP_PERFORM, error), model: null };
    }
    throw error;
  }
  return {
    result: await run(continuo, LAP_PERFORM, argv, { timeoutMs: ceiling }),
    model: selection.model,
  };
}

/** `--endpoint-recipient`, checked against continuo's `choices`. */
function requireServedRecipient(value: string): string {
  if (!(SERVED_ENDPOINT_RECIPIENTS as readonly string[]).includes(value)) {
    throw new ArgumentRefusal(
      `'endpointRecipient' is '${value}', and continuo serves ` +
        `${SERVED_ENDPOINT_RECIPIENTS.join(", ")} at the pinned revision. A recipient with no ` +
        "handler is refused before any worktree or fence is created, so refusing it here costs " +
        "nothing and says which values exist",
    );
  }
  return value;
}

/**
 * `--claude-command`, repeated once per token, every token absolute.
 *
 * Absolute is continuo's rule and the fence is its reason: a bare name would be
 * resolved through `PATH`, so which binary ran would depend on the environment
 * the host happened to inherit. An empty vector is refused rather than omitted,
 * because omitting the flag entirely means continuo's own default -- which is a
 * different request from "run no worker".
 */
function claudeCommandFlags(tokens: readonly string[]): readonly string[] {
  if (tokens.length === 0) {
    throw new ArgumentRefusal("'claudeCommand' is empty, and continuo needs a worker CLI to run");
  }
  return tokens.flatMap((token, index) => [
    "--claude-command",
    requireAbsolute(`claudeCommand[${String(index)}]`, token),
  ]);
}

/** `--gate-option`, repeated. Prose an operator wrote, so only non-empty. */
function gateOptionFlags(options: readonly string[]): readonly string[] {
  // Attached-value form, for the reason `--prompt` uses it: a gate option is a
  // label an operator wrote for a person to choose between, so it may
  // legitimately begin with a dash. As a separate token one would be read as a
  // flag, and an option spelled exactly `--json` would be removed by {@link run}'s
  // de-duplication of that flag -- leaving a dangling `--gate-option` that would
  // then swallow whichever flag came next, which is a worse failure than the one
  // it started as.
  return options.map(
    (option, index) => `--gate-option=${requireText(`gateOptions[${String(index)}]`, option)}`,
  );
}

/** What `gate show` needs. One observation, and it mutates nothing. */
export interface ShowGateRequest {
  readonly db: string;
  readonly gateId: string;
}

/**
 * Observe one gate.
 *
 * The read half of the suspend (D-0019 rule 5): `resume` drives this once and
 * reads `outcome`. It is here rather than left to a caller's `run(...)` for the
 * same reason as the other two -- a caller that spelled `--gate-id` would be a
 * caller that could spell `--outcome` next, and closing a gate is D-0013's
 * human.
 */
export async function showGate(
  continuo: VerifiedContinuo,
  request: ShowGateRequest,
): Promise<ContinuoResult<GateDetail>> {
  let argv: readonly string[];
  try {
    argv = [
      "--db",
      requireAbsolute("db", request.db),
      "--gate-id",
      requireIdentifier("gateId", request.gateId),
    ];
  } catch (error) {
    if (error instanceof ArgumentRefusal) {
      return refusedArgument(GATE_SHOW, error);
    }
    throw error;
  }
  return await run(continuo, GATE_SHOW, argv);
}
