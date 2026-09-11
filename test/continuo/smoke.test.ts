/**
 * rondo driving a real continuo, across the process boundary, for real.
 *
 * Everything else about this seam is a unit case over bytes somebody typed into
 * a fixture. This file is the one that fails when the seam is broken rather
 * than when rondo's model of it is: it spawns the pinned build, verifies its
 * revision, creates a control plane, admits a run, reads an empty gate list,
 * and asks for a gate that does not exist -- one success path per decoded verb
 * and one refusal envelope off stderr (D-0017 rule 6).
 *
 * **What it deliberately does not do.** `lap perform` spawns a worker, which
 * would put an agent session inside rondo's test suite; the sequence proves
 * process invocation, mutation, read-back, per-verb decoding and stderr
 * handling without it.
 *
 * **Mandatory in CI, capability-gated locally.** The build the smoke needs is
 * provisioned by the workflow in every double-green cell, so under CI a missing
 * `RONDO_CONTINUO_CLI` is a failure: a smoke that skipped itself there would
 * make a green gate mean nothing about the seam, and rondo's `gate` job already
 * treats a skipped job as red. Locally the variable is usually unset, and the
 * skip says exactly how to set it -- the alternative, building continuo from a
 * test, would put a network fetch and a compile inside `npm test`.
 *
 * **One scratch directory per invocation, removed after the child has closed.**
 * `run()` resolves on the child's `close` event, so no handle into the
 * directory is open when it is removed -- which is not a nicety on Windows,
 * where an open handle makes the removal fail outright.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, test } from "vitest";

import {
  admitRun,
  CLI_PATH_ENV,
  run,
  startContinuo,
  unusableArgument,
  type VerifiedContinuo,
} from "../../src/continuo/invoker.js";
import { CONTINUO_REVISION } from "../../src/continuo/pin.js";
import {
  DB_CREATE,
  GATE_LIST,
  GATE_SHOW,
  RUN_ADMIT,
  RUN_SHOW,
} from "../../src/continuo/protocol.js";

/** Whether this is a CI run, spelled as `vitest.config.ts` spells it (D-0003). */
function inContinuousIntegration(): boolean {
  const raw = process.env.CI;
  return raw !== undefined && raw !== "" && raw !== "false" && raw !== "0";
}

const located = process.env[CLI_PATH_ENV];
const available = located !== undefined && located.trim() !== "";

if (!available && inContinuousIntegration()) {
  // Not a skip and not a soft warning: under CI this variable is set by the
  // provisioning step, so its absence means the step did not run or did not
  // export it, and the seam went unexercised in a cell that reported green.
  throw new Error(
    `${CLI_PATH_ENV} is not set under CI. Every double-green cell provisions the pinned ` +
      `continuo (${CONTINUO_REVISION}) and points this variable at its dist/cli.js; the ` +
      "end-to-end smoke is not optional there (DECISIONS.md D-0017 rule 6).",
  );
}

const scratchDirectories: string[] = [];

/** A directory of this invocation's own, cleaned up when the file is done. */
function scratch(): string {
  const directory = mkdtempSync(join(tmpdir(), "rondo-smoke-"));
  scratchDirectories.push(directory);
  return directory;
}

afterAll(() => {
  for (const directory of scratchDirectories) {
    // Every child has closed by now -- `run()` resolves on `close`, not `exit`
    // -- so no handle into these directories is open, which is what makes the
    // removal reliable on Windows rather than merely usually fine.
    rmSync(directory, { recursive: true, force: true });
  }
});

/** Why the smoke is not running, in the test's own name, so a skip is legible. */
const skipNote = available
  ? ""
  : ` [skipped: ${CLI_PATH_ENV} is unset; point it at a built continuo dist/cli.js at ` +
    `${CONTINUO_REVISION}]`;

test.skipIf(!available)(
  `rondo drives the pinned continuo end to end${skipNote}`,
  async () => {
    const started = await startContinuo(process.env);
    if (started.kind !== "ready") {
      // Surfaced rather than asserted into a boolean: the reason is the whole
      // diagnosis when a provisioning step built the wrong revision.
      expect.unreachable(`continuo did not verify: ${started.reason}`);
    }
    const continuo: VerifiedContinuo = started.continuo;
    // The OBSERVED revision, which is what rule 6 says rondo records. That it
    // equals the pin is what `startContinuo` already refused to proceed without.
    expect(continuo.revision).toBe(CONTINUO_REVISION);

    const workspace = scratch();
    const database = join(scratch(), "control-plane.sqlite3");

    // No `--json` on any of these: the invoker puts it on, because a caller
    // that forgot it would run a mutating verb in human-output mode and then be
    // told its own decode was a defect.
    const created = await run(continuo, DB_CREATE, ["--db", database]);
    if (created.kind !== "answered") {
      expect.unreachable(`db create did not answer: ${JSON.stringify(created)}`);
    }
    expect(created.payload.schemaVersion).toBeGreaterThan(0);
    // continuo creates at head, so a fresh database is by definition current.
    expect(created.payload.schemaVersion).toBe(created.payload.headVersion);

    const admitted = await run(continuo, RUN_ADMIT, [
      "--db",
      database,
      "--run-id",
      "rondo-smoke-1",
      "--lease-claimant-id",
      "rondo-smoke",
      // Absolute, and its own argument: a relative workspace escapes continuo
      // as an exit 1 and a raw stack (D-0015's exception 2), and a path with a
      // space or a drive letter in it must survive unquoted.
      "--workspace",
      workspace,
      "--role",
      "worker",
      "--base-branch",
      "main",
      "--topic-branch",
      "feat/rondo-smoke",
      "--prompt",
      "a one-line request, from rondo's smoke",
    ]);
    expect(admitted).toEqual({
      kind: "answered",
      db: database,
      payload: {
        runId: "rondo-smoke-1",
        status: "created",
        createdAtMs: expect.any(Number),
      },
    });

    // **The declaration, admitted by rondo's own adapter against the real
    // build** (`continuo D-1110`, D-0039 rule 3). This is the one place the
    // `--allow-bash` argv is checked against a continuo rather than against
    // rondo's model of one: a pinned build without the flag answers this with a
    // parser refusal, and a subject the role document forbids would be refused
    // too -- so a green here is "the input D-0039 said did not exist is the
    // input this build takes". `admitRun` is used rather than a hand-written
    // argv precisely because the argv is what is under test.
    const declared = await admitRun(continuo, {
      db: database,
      runId: "rondo-smoke-2",
      leaseClaimantId: "rondo-smoke",
      workspace: scratch(),
      neutralRoleName: "worker",
      baseBranch: "main",
      topicBranch: "feat/rondo-smoke-declared",
      prompt: "a declared request, from rondo's smoke",
      // The two subjects continuo measured its own acceptance against, and
      // `npm ci --ignore-scripts` exactly rather than `npm ci:*`: the flagless
      // form runs package lifecycle scripts, which the fence's hook cannot see
      // because it observes tool calls and not the subprocesses a tool starts.
      allowedBash: ["npm ci --ignore-scripts", "npm run:*"],
    });
    expect(declared.continuoRole).toBe("worker");
    expect(declared.result).toEqual({
      kind: "answered",
      db: database,
      payload: {
        runId: "rondo-smoke-2",
        status: "created",
        createdAtMs: expect.any(Number),
      },
    });

    // **Both answers of the verb `revise` reads an ABSENCE from** (D-0031), and
    // this is the only place either is checked against a real continuo: the
    // schema id, the nested `run` object and the shape of an unknown run's
    // refusal are all facts about continuo's build rather than about rondo's
    // model of it. A drift in any of them would leave the preflight reading
    // "not taken" for a run that is, which is the failure it exists to prevent.
    const shown = await run(continuo, RUN_SHOW, ["--db", database, "--run-id", "rondo-smoke-1"]);
    expect(shown).toEqual({
      kind: "answered",
      db: database,
      payload: { runId: "rondo-smoke-1", status: "created" },
    });

    const free = await run(continuo, RUN_SHOW, ["--db", database, "--run-id", "rondo-smoke-free"]);
    // A refusal, decoded as one -- not a defect, and not an empty answer. This
    // is the outcome a revision proceeds on.
    expect(free).toEqual({
      kind: "refused",
      db: database,
      errorClass: expect.any(String),
      message: expect.stringContaining("rondo-smoke-free"),
    });

    const gates = await run(continuo, GATE_LIST, ["--db", database]);
    // An admitted run has opened no gate, so the empty list is the answer -- and
    // it is a decoded success rather than an absence, which is the distinction
    // a host that read exit codes alone could not make.
    expect(gates).toEqual({ kind: "answered", db: database, payload: [] });

    const missing = await run(continuo, GATE_SHOW, ["--db", database, "--gate-id", "no-such-gate"]);
    expect(missing).toEqual({
      kind: "refused",
      db: database,
      // Carried as an opaque hint: continuo says the message is the authority
      // and the class is not a stable taxonomy, so rondo shows both and
      // branches on neither.
      errorClass: expect.any(String),
      message: expect.stringContaining("no-such-gate"),
    });
  },
  // Eight subprocesses on a cold Windows runner. The per-invocation cost measured
  // in D-0015 is about a tenth of a second; this cap is a floor under runner
  // variance, not a budget.
  120_000,
);

/**
 * The two argument shapes rondo refuses to hand to `spawn`.
 *
 * An empty argument reaches continuo as an exit 1 and a raw stack; an argument
 * with a NUL in it never reaches continuo at all, because `spawn` throws
 * *synchronously* rather than emitting the `error` event the invoker handles --
 * which would reject a promise it promises never to reject. Both are decided
 * before a process exists, so they are checked against the pure rule rather
 * than through a subprocess.
 */
test("an unusable argument is named before anything is started", () => {
  expect(unusableArgument(["--db", "/tmp/x"])).toBeNull();
  expect(unusableArgument(["--db", ""])).toContain("an empty argument at position 1");
  expect(unusableArgument(["--db", "/tmp/a\u0000b"])).toContain("NUL byte at position 1");
});

test("a handle rondo did not issue drives nothing", async () => {
  // `VerifiedContinuo` is a structural type, so this literal type-checks -- and
  // a JavaScript caller would not even need that. The invariant is therefore
  // enforced at runtime: what has not been verified cannot be driven, whatever
  // its fields say.
  const forged: VerifiedContinuo = {
    cliPath: "/nowhere/dist/cli.js",
    revision: CONTINUO_REVISION,
  };
  const result = await run(forged, GATE_LIST, ["--db", "/tmp/x"]);
  expect(result).toEqual({
    kind: "invokerDefect",
    reason: expect.stringContaining("a handle it did not issue"),
  });
});

test("a CLI that is not there refuses at startup rather than rejecting", async () => {
  // The `error`-event path, reached without a built continuo: startup must
  // answer with a reason, because every caller in rondo is written against a
  // value rather than against a catch.
  const started = await startContinuo({ [CLI_PATH_ENV]: "/nowhere/at/all/dist/cli.js" });
  expect(started.kind).toBe("refused");
});

test("a relative or wrongly-named CLI path is refused before a process is started", async () => {
  expect((await startContinuo({ [CLI_PATH_ENV]: "dist/cli.js" })).kind).toBe("refused");
  expect((await startContinuo({ [CLI_PATH_ENV]: "/somewhere/continuo" })).kind).toBe("refused");
  expect((await startContinuo({})).kind).toBe("refused");
});
