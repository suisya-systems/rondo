# Dogfooding one real lap

The whole of the lap-1 arc, end to end, against a real continuo and a real
worker session. **It is a manual procedure and it is deliberately not a test.**

D-0017 rule 6 says why in its own words: *"`lap perform` is **not** driven: it
spawns a worker, and a test suite is not where an agent session belongs"*, and
`test/continuo/smoke.test.ts` repeats it. A full lap in ordinary CI would start
an agent session on a runner, in a job that is mandatory in every matrix cell.

D-0019 rule 17 asks where the full lap lives, and answers: here, as a documented
script rather than a `vitest` suite excluded from `npm test`. **A test file that
is not run by the test command is a file whose greenness nobody can state** —
somebody reads "the suite is green" and believes the lap was walked. A Markdown
procedure makes no such claim: it is green when a person says they ran it, and
it says which revision they ran it at.

---

## What this proves that the suite cannot

The suite proves the conductor's states, its refusals and its persistence
against injected fakes (`test/refrain/`), the store's invariant against a real
`node:sqlite` (`test/store/`), the decoders against fixture bytes
(`test/continuo/protocol.test.ts`), and the two seams against the real
sibling builds (`test/cadenza/smoke.test.ts`, `test/continuo/smoke.test.ts`).

None of them walks a lap. So what is unproven until somebody runs this is
everything that only exists when a worker actually runs: that the `RunPlan`'s
transcription of two argument lists still admits, that `lap perform` answers in
the shape `LAP_PERFORM` decodes, that the gate it names is really open at
`received` when it returns, that `invocationCeilingMs` is above what a real lap
costs on this machine, and that `resume` sees the outcome after a human answers.

## Before you start

1. A built continuo at the pinned revision. `continuo.pin.json` names it, and
   `startContinuo` refuses anything else — so if this step is wrong you find out
   in the first second rather than in the middle of a lap.

   ```sh
   export RONDO_CONTINUO_CLI=/absolute/path/to/continuo/dist/cli.js
   node "$RONDO_CONTINUO_CLI" --version   # must match continuo.pin.json's version line
   ```

2. A control-plane database, created by continuo's own verb — rondo drives
   `db create` and does not write DDL into somebody else's schema.

3. **A repository you are willing to have a worker touch**, and a base branch
   and a topic branch that does not exist yet. Nothing here is a dry run: a lap
   materialises a worktree, renders a fence, and starts an agent session.

4. The paths continuo requires to be absolute and outside the worktree —
   `--artifact-root`, `--state-root`, `--interlock-root`, `--claude-org-path`,
   `--endpoint-destination-dir`, and every token of `--claude-command`. rondo
   supplies no default for any of them, and D-0019 rule 3 is why: a rondo-side
   default would be rondo guessing at a fence's geometry.

## The procedure

1. **Write a `RunPlan`.** Every field, by hand. `runPlan()` validates it and
   names the first field it refuses; that refusal is rondo's, before a process
   starts, which is the property D-0015's exception 2 asked for.

   Set `invocationCeilingMs` above `turnTimeoutMs + gitTimeoutMs` with real
   margin. **rondo's ceiling firing is a rondo defect, not a lap that failed**:
   rondo's timer kills the CLI and not the fenced child, so a ceiling that fires
   leaves an orphaned worker with nobody polling it. If it fires, record what the
   lap actually cost and raise the ceiling — do not treat it as a flake.

2. **Admit.** Call the composition root's `admit(request, plan, policy)` with an
   explicitly-constructed policy. `CONSERVATIVE_POLICY` refuses before a row
   exists, on purpose (D-0019 rule 9), so a run started under the default is a
   run that did not start.

   Expect the arc to stop at `awaiting_human` and the process to be free to
   exit. It is not a failure that nothing further happens: the gate is open, and
   only another surface can close it.

3. **Read the row.** `SELECT * FROM iteration` — check by eye that the plan came
   back verbatim, that `plan_digest` is there beside it, that
   `continuo_revision` holds what `--version` reported, and that `gate_id`,
   `session_id` and `session_path` are set. `session_path` is the walk's own name
   (`started` / `respawned` / `resumed`) and **not a filesystem path**; if it
   looks like a path, something upstream changed and `LAP_PERFORM` is wrong.

4. **Answer the gate as a human**, through continuo's own verbs — `gate present`,
   `gate deliver`, `gate ack`, the answer, `gate deliver`, `gate ack`. rondo
   drives none of these and must not: `closeOpenGate` hard-codes
   `actorKind: "human"` (D-0013).

5. **Resume.** Call `resume(iterationId)`. Call it *twice*. The first call after
   the answer transitions the iteration to `closed`; the second must change
   nothing and say so. Calling it before the answer must also change nothing —
   that is the idempotence `resume` promises to a surface that cannot be sure,
   and it is cheap to check here and expensive to discover in production.

6. **Read the report.** It must say the gate's outcome, the run id, the continuo
   revision that drove it, and — plainly — that the run row is still `created`,
   that nothing was pushed, and that **publishing is the operator's** (D-0010).
   If it does not say the last part, the report is wrong, whatever else it got
   right.

7. **Clean up what rondo did not.** rondo abandons; it does not close runs or
   gates it did not open (D-0010, D-0013). A worktree, a fence and a run row are
   yours to settle.

## The paths worth walking on purpose, once each

- **`abandon()` on a `performing` row.** Kill rondo mid-lap. Restart it: the row
  is still `performing`, the conductor refuses to reserve anything else, and
  `abandon(id, reason)` is the only way out. That block is the fail-closed
  behaviour, not an accident — a lap whose outcome is unknown must not be raced
  by a second one.
- **`requestWithdrawal()` on an open gate.** rondo records the ask and never
  writes the outcome. Check that a person, reading only the row, can tell what
  they are being asked to do.
- **A `needs_approval` classification.** In lap 1 this ends the iteration at
  terminal `abandoned` and asking again is a new iteration (D-0019 rule 15).
  When somebody wants to approve one instead, that reduction is wrong and
  D-0009's successor path becomes lap-1 work.

## What to write down

The revisions you ran against (`continuo.pin.json`, `cadenza.pin.json`), the
machine, what one lap actually cost in wall clock against the ceiling you set,
and anything that answered in a shape the decoders did not expect. That last one
is the falsifier D-0019 names for itself: `continuo.lap.perform/2`, or one of
the eleven fields changing meaning without the schema moving — which rondo
cannot detect on its own.
