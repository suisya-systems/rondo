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
  CLI_PATH_ENV,
  run,
  startContinuo,
  type VerifiedContinuo,
} from "../../src/continuo/invoker.js";
import { CONTINUO_REVISION } from "../../src/continuo/pin.js";
import { DB_CREATE, GATE_LIST, GATE_SHOW, RUN_ADMIT } from "../../src/continuo/protocol.js";

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
  // Six subprocesses on a cold Windows runner. The per-invocation cost measured
  // in D-0015 is about a tenth of a second; this cap is a floor under runner
  // variance, not a budget.
  120_000,
);

/**
 * The two argument shapes rondo refuses to hand to `spawn`, checked without one.
 *
 * An empty argument reaches continuo as an exit 1 and a raw stack; an argument
 * with a NUL in it never reaches continuo at all, because `spawn` throws
 * *synchronously* rather than emitting the `error` event this module handles --
 * which would reject a promise the invoker promises never to reject. Both are
 * refused before the spawn, so these cases need no continuo and run everywhere.
 */
test("the invoker refuses an unusable argument before it starts a process", async () => {
  const pretend: VerifiedContinuo = {
    cliPath: "/nowhere/dist/cli.js",
    revision: CONTINUO_REVISION,
  };
  const empty = await run(pretend, GATE_LIST, ["--db", ""]);
  expect(empty).toEqual({
    kind: "invokerDefect",
    reason: expect.stringContaining("an empty argument at position 1"),
  });
  const withNul = await run(pretend, GATE_LIST, ["--db", "/tmp/a\u0000b"]);
  expect(withNul).toEqual({
    kind: "invokerDefect",
    reason: expect.stringContaining("NUL byte at position 1"),
  });
});

test("a CLI path that does not exist is a defect, not a rejected promise", async () => {
  // The `error` event path. It must resolve, because every caller in rondo is
  // written against a value rather than against a catch.
  const missing: VerifiedContinuo = {
    cliPath: "/nowhere/at/all/dist/cli.js",
    revision: CONTINUO_REVISION,
  };
  const result = await run(missing, GATE_LIST, ["--db", "/tmp/x"]);
  expect(result.kind).toBe("invokerDefect");
});

test.skipIf(!available)(
  `the invoker adds --json itself, and a caller that passes it too is not punished${skipNote}`,
  async () => {
    // The proof that the flag is the invoker's job: the same call, once without
    // the flag and once with it twice over, decodes to the same document. A
    // caller that omitted it would otherwise get human prose at exit 0 and be
    // told rondo had a defect -- after the verb had already run.
    const started = await startContinuo(process.env);
    if (started.kind !== "ready") {
      expect.unreachable(`continuo did not verify: ${started.reason}`);
    }
    const database = join(scratch(), "control-plane.sqlite3");
    const created = await run(started.continuo, DB_CREATE, ["--db", database]);
    expect(created.kind).toBe("answered");
    const listed = await run(started.continuo, GATE_LIST, ["--db", database, "--json"]);
    expect(listed).toEqual({ kind: "answered", db: database, payload: [] });
  },
  120_000,
);
