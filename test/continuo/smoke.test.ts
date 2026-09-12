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
 * handling without it. So the gate *walk* is not end-to-end here: without a lap
 * there is no gate, and `present`, `ack` and `answer` are still checked against
 * fakes only. What is checked here is the one argument of that walk whose fake
 * and whose original disagree -- `gate deliver`'s delivery resource -- because
 * that disagreement is what let rondo ship a walk that could not close a gate
 * (`docs/operations/lap-2-dogfood.md` N-1). The rule this file is written under
 * is not "drive everything for real"; it is **drive the seams whose two sides
 * are known to answer differently**.
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
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, test } from "vitest";

import {
  admitRun,
  CLI_PATH_ENV,
  deliverGate,
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

    // One record file for both admissions below. What is under test in this
    // file is rondo's argv against a real continuo, and the envelope's
    // *contents* are `test/access/delegation.test.ts`'s subject -- continuo
    // reads no key of it (`continuo D-1107` rule 2), so the smallest JSON
    // object that is one is the honest fixture here.
    const recordPath = join(scratch(), "delegation-record.json");
    writeFileSync(recordPath, '{"record_schema":"rondo.delegation-record/1"}\n', "utf8");

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
      // Required and undefaulted since `continuo D-1107`: a run whose
      // authorisation nothing recorded is the case those two flags removed.
      "--delegation-record",
      recordPath,
      "--delegation-record-schema",
      "rondo.delegation-record/1",
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
      materialLanguage: null,
      // Required and undefaulted since `continuo D-1107`: a run whose
      // authorisation nothing recorded is the case those flags removed.
      delegationRecordPath: recordPath,
      delegationRecordSchema: "rondo.delegation-record/1",
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
      payload: {
        runId: "rondo-smoke-1",
        status: "created",
        // **The envelope this run was admitted under, back from continuo**
        // (#88), and the one place the round trip is checked end to end: rondo
        // wrote these bytes a few lines up, continuo digested them on the way
        // in, and the gate screen prints what is read back here. `envelope` is
        // matched loosely because the fixture above is a minimal record rather
        // than a composed one; the digest is continuo's over whatever arrived,
        // and `digestVerified` is continuo re-checking it rather than rondo
        // claiming it.
        delegationRecord: {
          recordSchema: "rondo.delegation-record/1",
          envelope: expect.stringContaining("rondo.delegation-record/1"),
          envelopeDigest: expect.any(String),
          digestAlgorithm: "sha256",
          digestVerified: true,
        },
        // **Empty, off a real continuo, for a run that has never performed a
        // lap** (#79). The unit cases can only say what rondo does with a
        // `sessions` array somebody typed; this says that continuo sends the
        // key at all, and sends it as an array rather than omitting it -- which
        // is what `D-0048` rule 1's decoder requires and what the absent-is-not
        // -null rule would otherwise turn into a defect on every `run show`.
        sessions: [],
      },
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

    // **The delivery resource rondo's gate walk names, checked against the
    // build that decides what a resource is.** This is the one verb on the
    // answer path whose fake and whose original give *different* answers: the
    // fake in `test/access/cli.test.ts` hands back a delivered message id
    // whatever it is asked, so a rondo that drained the wrong queue passed it,
    // and passed it for a whole lap of dogfooding
    // (`docs/operations/lap-2-dogfood.md` N-1). What distinguishes the two
    // queues without a lap to fill them is the epoch: continuo advances one per
    // *resource*, so two passes on the run's resource number themselves 1 and 2
    // while the global resource -- the one a `--run-id`-less rondo would have
    // drained -- stays at 1.
    const dropbox = scratch();
    const firstPass = await deliverGate(continuo, {
      db: database,
      destinationDir: dropbox,
      holder: "rondo-smoke",
      runId: "rondo-smoke-1",
    });
    expect(firstPass).toEqual({
      kind: "answered",
      db: database,
      // Nothing is queued: an admitted run that never performed opened no gate,
      // and the empty drain is the answer. The epoch is the assertion.
      payload: { recipient: expect.any(String), epoch: 1, deliveredMessageIds: [] },
    });
    const secondPass = await deliverGate(continuo, {
      db: database,
      destinationDir: dropbox,
      holder: "rondo-smoke",
      runId: "rondo-smoke-1",
    });
    expect(secondPass).toEqual({
      kind: "answered",
      db: database,
      payload: { recipient: expect.any(String), epoch: 2, deliveredMessageIds: [] },
    });

    // The global resource, untouched by the two passes above -- which is what
    // says they went to the run's. Driven through `deliverGate` with a null
    // run id rather than a hand-written argv, because the null branch is
    // rondo's own and the runless gate is the case it exists for.
    const globalPass = await deliverGate(continuo, {
      db: database,
      destinationDir: dropbox,
      holder: "rondo-smoke",
      runId: null,
    });
    expect(globalPass).toEqual({
      kind: "answered",
      db: database,
      payload: { recipient: expect.any(String), epoch: 1, deliveredMessageIds: [] },
    });

    // **And the run id is carried far enough to be checked.** A run this plane
    // does not know is refused rather than answered with an empty queue, and
    // continuo's message says why in the terms of the defect this file exists
    // to catch. A pinned build that ignored `--run-id` -- or one that dropped
    // the flag, which would reach here as a parser refusal in prose instead --
    // could not produce this.
    const unknownRun = await deliverGate(continuo, {
      db: database,
      destinationDir: dropbox,
      holder: "rondo-smoke",
      runId: "rondo-smoke-free",
    });
    expect(unknownRun).toEqual({
      kind: "refused",
      db: database,
      errorClass: expect.any(String),
      message: expect.stringContaining("rondo-smoke-free"),
    });

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
