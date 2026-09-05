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
  type InvocationOutput,
  type VerbContract,
} from "./protocol.js";

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
 * How long a single continuo invocation may take before rondo gives up.
 *
 * A ceiling on a hang rather than a performance budget: the measured cost of a
 * driven verb is about a tenth of a second (D-0015), so a minute is three
 * orders of magnitude of headroom and still bounded, which is what a test suite
 * and an interactive host both need from a subprocess.
 */
const INVOCATION_TIMEOUT_MS = 60_000;

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
  const output = await runProcess(located.path, ["--version"]);
  if (output.kind === "failed") {
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
 * The only way out of this layer: a caller gets one of the five outcomes
 * `protocol.ts` defines, never a document, never a stream and never an exit
 * code.
 */
export async function run<T>(
  continuo: VerifiedContinuo,
  contract: VerbContract<T>,
  argv: readonly string[],
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
  const output = await runProcess(continuo.cliPath, [
    ...contract.command,
    ...argv.filter((argument) => argument !== JSON_FLAG),
    JSON_FLAG,
  ]);
  if (output.kind === "failed") {
    return { kind: "invokerDefect", reason: output.reason };
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

/** What {@link runProcess} answers: bytes, or the reason there are none. */
type ProcessOutcome =
  | { readonly kind: "ran"; readonly value: InvocationOutput }
  | { readonly kind: "failed"; readonly reason: string };

/**
 * Spawn continuo, collect both streams, and resolve when the child has closed.
 *
 * Never rejects. A spawn that fails, a runtime that is not there, a child that
 * hangs -- each is a sentence rondo can act on, and a rejected promise here
 * would put process management into every caller's error handling.
 */
async function runProcess(cliPath: string, argv: readonly string[]): Promise<ProcessOutcome> {
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
    const timer = setTimeout(() => {
      child.kill();
    }, INVOCATION_TIMEOUT_MS);
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
      finish({ kind: "ran", value: { status, signal, stdout, stderr } });
    });
  });
}
