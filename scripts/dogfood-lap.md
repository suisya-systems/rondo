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

   ```sh
   node "$RONDO_CONTINUO_CLI" db create --db /absolute/path/to/control-plane.sqlite3
   ```

3. **A compiled rondo**, because there is not one. `tsconfig.json` is `noEmit`
   and there is no `build` script (D-0002): rondo is a host and nothing consumes
   a `dist/` of it, which is right for the tree and leaves the one caller who
   has to `import` the composition root — you — with a step of their own.
   `node --experimental-strip-types` does *not* substitute for it: relative
   imports are spelled `.js` and Node does not remap them to `.ts`.

   The install comes first and is the repository's own (`AGENTS.md`): the emit
   cannot resolve `@suisya-systems/cadenza` until the vendored tarball is
   installed, and the compiler is the pinned one in `node_modules/.bin` rather
   than whatever `npx` would fetch.

   ```sh
   node vendor/pin.mjs check          # the digest check, before every install
   npm ci --ignore-scripts            # never `npm install` (D-0007)

   # A throwaway config beside the run, not a build the repository keeps.
   # extends ../tsconfig.json with:
   #   "noEmit": false, "outDir": "dist", "rootDir": "../src", "include": ["../src"]
   ./node_modules/.bin/tsc -p /absolute/path/to/tsconfig.dogfood.json
   ```

4. **rondo's own iteration store, which is a second database and is not the one
   in step 2.** `iterationStore(connection)` takes a `node:sqlite` `DatabaseSync`
   the caller opens, so its path is yours to pick and its schema is applied on
   open. On Node 22 the module is behind a flag, so every command below is
   `node --experimental-sqlite`.

5. **A repository you are willing to have a worker touch**, and a base branch
   and a topic branch that does not exist yet. Nothing here is a dry run: a lap
   materialises a worktree, renders a fence, and starts an agent session.

6. The paths continuo requires to be absolute and outside the worktree —
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

   `parties.grantee` **is `runId`, spelled a second time**, and `runPlan()`
   refuses any other value: `classifyPlan` hands cadenza the run id as its
   classification context, and a grantee that differed would come back
   `grantee_mismatch` — an *answered* classification, which ends the iteration
   at terminal `abandoned` (D-0019 rule 15) only after the row is reserved and
   the single-flight lock taken. Refused at the plan it costs nothing.

   One rule is cadenza's and is not `runPlan()`'s to refuse: `catalogLayers[].data`
   is typed as a free-form table and is not one. Observed against the vendored
   build (`cadenza.pin.json`; `application/compose.ts` and
   `domain/clone-source.ts` in its `src/`), the table is closed at every level:

   - top level: exactly `schema_version`, `catalog`, `project`; `schema_version`
     is required (`'schema_version' is required`) and must be `1` at the pinned
     revision;
   - `project.<name>`: exactly `aliases`, `source`, `base_branch`, `tombstone`;
     once the layers are composed every project must have both a `source` and a
     `base_branch` from some layer (`project '<name>' has no source` /
     `... has no base_branch`), and `source` is a table whose `kind` is one of
     `git_url` (with a `url`), `local_path` (with a `path`) or `new` (nothing
     else);
   - `catalog`: exactly `allowed_local_roots`, a list of strings, and for a
     `local_path` source it must be declared **on the layer that declares the
     source** — it is never merged across layers (`a clone source of kind
     'local_path' requires the layer that declares it to declare its own
     catalog.allowed_local_roots`).

   `test/cadenza/smoke.test.ts` carries a working `git_url` layer, and the
   `RunPlan` doc comment in `src/refrain/plan.ts` repeats this list beside the
   field. rondo does not restate cadenza's rules as checks of its own (D-0018
   rule 7): a layer that breaks one is thrown by `resolveProject` at the
   conductor's `classify` step, `classifyPlan` carries the message as a
   refusal, and the iteration ends at terminal `abandoned` — after the row is
   reserved.

2. **Admit.** Call the composition root's
   `admit(ports, plan, policy, iterationId)`, where `ports` comes from
   `openConductor(store, process.env)` and `iterationId` is yours to allocate
   like every other identifier in lap 1 (D-0019 rule 3).

   The policy is explicitly constructed and **must not be
   `CONSERVATIVE_POLICY`**: its `ask_every_iteration` is refused by `nextStep`
   before a row exists, on purpose (D-0019 rule 9 — a policy stop costs no row
   and takes no lock), so a run started under the default is a run that did not
   start. The value that starts one is
   `{ autonomy: "ask_before_landing", maxIterations: 1 }`: the other `Autonomy`
   value, with the smallest ceiling `admissionStep` in `src/refrain/loop.ts`
   accepts (it refuses `maxIterations < 1`). The `RunPlan` doc comment in
   `src/refrain/plan.ts` says the same beside the type, so a caller filling a
   plan meets it there.

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
   yours to settle. Note that `continuo run` accepts only `admit` and `close`, so
   there is no `run show` to read the state you are settling; `gate list --db`
   is the verb that answers for gates.

## What one run of this actually did

[`../docs/operations/lap-1-dogfood.md`](../docs/operations/lap-1-dogfood.md) is
the record of walking this procedure on 2026-09-06, at the revisions pinned then.
**It did not get past step 2**, and the reason is a hard-coded 2.5 second window
in continuo's post-spawn identity read-back against a worker CLI that needs 4 to
11 seconds to say its own name. Read it before running this: it carries the
measurements, the eleven findings, and the parts of the procedure that are still
unwalked.

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
