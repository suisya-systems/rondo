# lap 1 dogfood -- what one real request cost, and where it stopped

A record of driving [`../../scripts/dogfood-lap.md`](../../scripts/dogfood-lap.md) end to end against
the pinned continuo and the vendored cadenza, with a real worker. What is written here is **the
commands that were actually run and the output that actually came back**, not what the design
expects.

- Run on 2026-09-06, on `docs/lap1-dogfood` at `9c76756`, against continuo
  `44f62336108b86cab5da791111ffa0e5b73cd01a` (`continuo.pin.json`) and cadenza
  `e56d7e71981232d19120d20ba6b920a5c4d762dc` (`cadenza.pin.json`, tarball digest checked by
  `node vendor/pin.mjs check`).
- Machine: WSL2 (`Linux 6.18.33.2-microsoft-standard-WSL2`), Node v22.17.0, worker CLI
  `claude` 2.1.261.
- **The lap did not complete, and that is the finding.** It stops in the same place twice, with the
  same message, 3.8 seconds in: continuo's post-spawn identity read-back gives a real `claude -p`
  **2.5 seconds** to name itself, and on this machine the CLI takes **3.6 to 11.3 seconds** to emit
  its first event. Nothing downstream of the spawn was reached: there is no gate, so there was no
  suspend at `awaiting_human` to observe, no human answer to give, and no `resume` to `closed`.
  F-1 has the measurements.
- Everything upstream of the spawn **did** work, and was measured: plan validation, cadenza's
  classification, the pin check, `run admit`, worktree materialisation, fence render, and the store's
  write order. The row that survives the failure is complete enough to reconstruct the run (F-9).
- No `src/` change was made, and the defects this found are proposed as issues in section 9 rather
  than fixed. The one exception is `scripts/dogfood-lap.md` itself, which fixing was in scope: F-3,
  F-4 and F-5 are corrected in the same change as this record.

---

## 1. What to have ready, in absolute paths

Everything below lives under `.worker-scratch/`, which is excluded from git. The target repository is
a throwaway created for this run; nothing here points at a real project.

| What | Value |
|---|---|
| Worktree this was run from | `/home/happy_ryo/work/org/workers/rondo/.worktrees/rondo-lap1-dogfood` |
| Scratch root (`$S` below) | `<worktree>/.worker-scratch` |
| Pinned continuo checkout | `$S/continuo-44f62336108b86cab5da791111ffa0e5b73cd01a` |
| `RONDO_CONTINUO_CLI` | `$S/continuo-44f6233.../dist/cli.js` |
| continuo control plane | `$S/control-plane.sqlite3` |
| **rondo's own iteration store** | `$S/rondo-iterations.sqlite3` (a *second* database -- F-4) |
| Artifact root | `$S/artifacts` |
| State root | `$S/session-state` |
| Dropbox (endpoint destination) | `$S/dropbox` |
| Target repository | `$S/target` |
| Workspace (the worktree the lap cuts) | `$S/workspace-<run id>` |
| Worker CLI | `/home/happy_ryo/.local/bin/claude` |
| Interpreter for the endpoint | `/home/happy_ryo/.local/share/fnm/node-versions/v22.17.0/installation/bin/node` |
| `--interlock-root` | `/home/happy_ryo/work/org/workers/interlock` |
| `--claude-org-path` | `/home/happy_ryo/work/org/claude-org-ja` |

## 2. Provisioning, with what each step cost

The pinned continuo was provisioned the way `.github/workflows/ci.yml`'s *Provision the pinned
continuo* step does it, except that the clone source is the read-only sibling checkout rather than
GitHub -- the sibling holds the pinned revision, so the pin is still a pin.

```sh
export npm_config_cache=$S/npm-cache
node vendor/pin.mjs check          # silent, exit 0 (F-10)
npm ci --ignore-scripts            # 3.3 s

REV=44f62336108b86cab5da791111ffa0e5b73cd01a
git clone --quiet --no-checkout /home/happy_ryo/work/org/workers/continuo "$S/continuo-$REV"
git -C "$S/continuo-$REV" checkout --quiet --detach "$REV"
test "$(git -C "$S/continuo-$REV" rev-parse HEAD)" = "$REV"     # 2 s for all three
npm --prefix "$S/continuo-$REV" ci --ignore-scripts             # 5 s
CONTINUO_REQUIRE_REVISION=1 npm --prefix "$S/continuo-$REV" run build   # 1 s
node "$S/continuo-$REV/dist/cli.js" --version
# @suisya-systems/continuo 0.0.0 (rev 44f62336108b86cab5da791111ffa0e5b73cd01a)
```

That version line is `continuo.pin.json`'s `versionLine` byte for byte.

The control plane is created by continuo's own verb:

```sh
node "$CLI" db create --db "$S/control-plane.sqlite3"
# created .../control-plane.sqlite3: schema version 4 of 4                (0.24 s)
```

**And then a step the script does not mention: rondo has to be compiled.** `tsconfig.json` is
`noEmit` and `package.json` has no `build` script (D-0002), so there is no way to `import` the
composition root from a plain `node` process. The dogfood used a throwaway config (F-3):

```sh
# .worker-scratch/tsconfig.dogfood.json extends ../tsconfig.json with
#   noEmit:false, outDir:"dist", rootDir:"../src", include:["../src"]
./node_modules/.bin/tsc -p .worker-scratch/tsconfig.dogfood.json    # 1 s, exit 0
# (run here as `npx tsc`; the script now says the local binary, so the compiler
#  is the pinned one rather than whatever npx would fetch)
```

Total provisioning: **about 13 seconds**, plus the compile.

## 3. The `RunPlan`, filled by hand

`runPlan()` accepted it and reported **31 fields**. This is the plan verbatim, as the driver holds
it; `S` is the scratch root above.

```js
// The RunPlan for the lap-1 dogfood, filled by hand (R-3: the caller packages it).
export const PLAN_INPUT = {
  // --- continuo: the control plane and the run ---
  db: `${S}/control-plane.sqlite3`,
  runId: RUN_ID,                                   // "lap1-dogfood-001"
  leaseClaimantId: "rondo-dogfood",
  workspace: `${S}/workspace-${RUN_ID}`,
  baseBranch: "main",
  topicBranch: `dogfood/${RUN_ID}`,
  prompt:
    "Add a single line to README.md at the end of the file reading exactly: " +
    "'Touched by the rondo lap-1 dogfood.' Then commit it with the message " +
    "'docs: touched by the rondo lap-1 dogfood'. Do nothing else.",

  // --- continuo: the lap ---
  repository: `${S}/target`,
  artifactRoot: `${S}/artifacts`,
  stateRoot: `${S}/session-state`,
  interlockRoot: "/home/happy_ryo/work/org/workers/interlock",
  claudeOrgPath: "/home/happy_ryo/work/org/claude-org-ja",
  endpointRecipient: "external-notify",
  endpointDestinationDir: `${S}/dropbox`,
  claudeCommand: ["/home/happy_ryo/.local/bin/claude"],
  endpointDb: null,
  endpointModule: null,
  node: "/home/happy_ryo/.local/share/fnm/node-versions/v22.17.0/installation/bin/node",
  hookScript: null,
  python: null,
  pollIntervalMs: null,
  turnTimeoutMs: 900_000,
  gitTimeoutMs: 60_000,
  gateOptions: ["approve", "revise"],
  gateDeadlineAtMs: null,

  // --- rondo's own ---
  invocationCeilingMs: 1_800_000,

  // --- cadenza ---
  catalogLayers: [
    {
      layer: "tracked",
      origin: `${S}/catalog/projects.toml`,
      baseDir: `${S}/catalog`,
      data: {
        schema_version: 1,
        catalog: { allowed_local_roots: [S] },
        project: {
          "dogfood-target": {
            source: { kind: "local_path", path: `${S}/target` },
            base_branch: "main",
            aliases: [],
          },
        },
      },
    },
  ],
  projectName: "dogfood-target",
  agentTypeInput: {
    agentTypeId: "worker-basic",
    vocabularyVersion: 1,
    granted: ["command.run"],
    askable: ["branch.push"],
    loopPolicy: { maxReviewRounds: 2, noProgressWindow: 3, noProgressRepeat: 2 },
    executorPolicy: { roleName: "worker", modelTier: "standard", reportingDuties: [] },
  },
  parties: { issuer: "rondo-dogfood", grantee: RUN_ID },
  intendedAction: { capabilities: ["command.run"] },
};
```

### 3.1 Where the 31 fields came from

The operator asked for this count and these sources, so they are counted rather than described.

| Source | Count | Fields |
|---|---|---|
| **The request itself** -- a person asking for this knows them | 6 | `prompt`, `repository`, `baseBranch`, `topicBranch`, `projectName`, `runId` |
| **Site configuration** -- set once per machine, then reused | 10 | `db`, `workspace`, `leaseClaimantId`, `artifactRoot`, `stateRoot`, `interlockRoot`, `claudeOrgPath`, `endpointDestinationDir`, `claudeCommand`, `node` |
| **Read out of rondo's or continuo's source to fill at all** | 11 | `endpointRecipient`, `gateOptions`, `gateDeadlineAtMs`, `turnTimeoutMs`, `gitTimeoutMs`, `invocationCeilingMs`, `pollIntervalMs`, `endpointDb`, `endpointModule`, `hookScript`, `python` |
| **cadenza's own vocabulary** -- shape learned from cadenza's refusals | 4 | `catalogLayers`, `agentTypeInput`, `parties`, `intendedAction` |

**Six of thirty-one are the request.** Ten more are a machine's configuration and would be a config
file if rondo had one; R-3 deliberately does not build one, and that is the ten fields' cost stated
plainly rather than a complaint about it. The remaining fifteen are the ones a person cannot supply
without reading code, and F-5 through F-7 are the three that cost the most.

## 4. The lap, twice

```
$ RONDO_CONTINUO_CLI=... node --experimental-sqlite .worker-scratch/drive.mjs admit
plan ok: 31 fields
continuo verified: 44f62336108b86cab5da791111ffa0e5b73cd01a
--- report (admit, 3810 ms) ---
iterationId: iter-001
status: failed
  Reserved iteration iter-001 at 'planned'.
  cadenza allowed the action (granted); the three digests are committed.
  continuo build verified at revision 44f62336108b86cab5da791111ffa0e5b73cd01a; run id lap1-dogfood-001 and that revision are committed before anything is spawned.
  continuo admitted run lap1-dogfood-001 at status 'created' under role 'worker' (neutral name 'worker').
  Sending one lap; this is the step that takes minutes.
  The lap did not complete: the identity committed for session "b440a405-af33-4f14-9705-c49319a755e3" did not read back within 50 attempts; the binding is left at 'spawned' rather than confirmed on trust
  An answer arrived, so the 'lap perform' process is over and no worker of its is still running. The single-flight lock is released.
  Iteration iter-001 ended at 'failed'.
```

Run again with fresh identifiers (`lap1-dogfood-002` / `iter-002`), same result, 3837 ms, session
`46491986-b37a-49ec-9545-3970daf11dd3`. **It is deterministic, not a flake.**

The report reads well: eight lines, in order, each naming what was committed before the next step.
"Sending one lap; this is the step that takes minutes" is the only line that turned out to be
optimistic.

### 4.1 The stages, in wall clock

| Stage | Cost |
|---|---|
| `runPlan()` validation | under 1 ms |
| cadenza classification (four calls) | under 1 ms |
| `startContinuo` -- spawn `--version`, compare with the pin | ~200 ms |
| `run admit` | included below |
| `lap perform` up to the failed read-back | the balance |
| **`admit()` end to end** | **3810 ms / 3837 ms** |
| `resume()` on a terminal row | 1 ms |
| `abandon()` on a terminal row | 1 ms |

`invocationCeilingMs` was 1 800 000 ms and the lap answered in 3.8 s, so **rondo's ceiling was never
in play** -- which is the one thing about the ceiling this run could establish. What a *completing*
lap costs on this machine is still unmeasured.

## 5. The paths that could be walked instead

The gate never opened, so steps 4 through 6 of the script were unreachable. What was reachable was
the idempotence the script's step 5 asks for, and the refusals around it. All four were exercised
against the real, clean CLI.

```
===== resume, on the terminal row =====
--- report (resume, 1 ms) ---
iterationId: iter-001
status: failed
  Iteration iter-001 is terminal at 'failed' and there is nothing further to do.
  Recorded reason: the identity committed for session "b440a405-af33-4f14-9705-c49319a755e3" did not read back within 50 attempts; the binding is left at 'spawned' rather than confirmed on trust

===== abandon, on the terminal row =====
--- report (abandon, 1 ms) ---
iterationId: iter-001
status: failed
  Iteration iter-001 is already terminal at 'failed'; nothing was written.

===== admit again under the same iteration id =====
--- report (admit, 1 ms) ---
iterationId: null
status: null
  The store could not reserve an iteration: UNIQUE constraint failed: iteration.id

===== openConductor against a deliberately modified continuo =====
REFUSED by openConductor: continuo --version reported '44f62336108b86cab5da791111ffa0e5b73cd01a-dirty': the build was made from a modified tree, so it names a commit it is not. Build a clean checkout at 44f62336108b86cab5da791111ffa0e5b73cd01a.
```

The last one is worth stating positively, because it closed off the obvious workaround. To reach the
gate anyway, a second checkout was patched to widen the read-back window (F-1), and continuo's own
build stamped it `44f6233...-dirty`; rondo then refused to start against it. **The pin held.** No
lap was driven on a modified continuo, and none should be: the alternative was a record claiming a
lap that a pinned rondo cannot walk.

## 6. What got in the way

Symptom, cause, and what a fix would have to be. Raw output is byte for byte.

### F-1. The post-spawn identity read-back gives a real worker 2.5 seconds, and it needs 4 to 11

**Blocking.** This is where the lap stops.

> **Resolved upstream and taken here (2026-09-06, rondo `D-0021`).** `continuo D-0098` replaced the
> two constants with a caller-supplied budget, `lap perform --identity-readback-timeout-ms`,
> defaulting to 30 s. rondo pinned that build and made the number the third **explicit** field of
> `RunPlan` — `identityReadbackTimeoutMs` — rather than inheriting the default, on the same
> reasoning `D-0019` rule 12 gives for the other two budgets; it is counted into
> `invocationCeilingMs`'s floor. The measurements below are the evidence for the size of the window
> and stand as written; what changed is that the size is now a number an operator sets.

```
The lap did not complete: the identity committed for session
"b440a405-af33-4f14-9705-c49319a755e3" did not read back within 50 attempts; the
binding is left at 'spawned' rather than confirmed on trust
```

`continuo/src/supervisor.ts` polls `readState` after the spawn until the committed session id names
itself in an event. Two constants bound it, and both are hard-coded with no CLI flag reaching
either:

```ts
this.#readbackAttempts = options.readbackAttempts ?? 50;          // supervisor.ts:331
...
  this.#wait = () => new Promise<void>((resolve) => setTimeout(resolve, 50));   // supervisor.ts:341
```

50 attempts, 50 ms apart: **a 2.5 second window**. The comment beside the pacing is right about the
problem and wrong about the size --

```ts
// A real provider answers start() the instant spawn returns, long
// before the child has emitted its identity; back-to-back polls would
// exhaust every attempt against a healthy child. The default is
// therefore paced -- IO pacing against a live subprocess, never a
// timestamp and never a measured admission figure (U34).
```

Measured on this machine, with the fence's own settings and MCP config, timing from process start to
the first `stream-json` line (a `system`/`init` event, which is the one that names the session id):

```
$ START=$(date +%s.%N); /home/happy_ryo/.local/bin/claude -p "reply with the single word ok" \
    --output-format stream-json --verbose --settings $A/settings.local.json \
    --permission-mode acceptEdits --setting-sources "" --mcp-config $A/mcp.json --strict-mcp-config \
  | while IFS= read -r line; do printf '%s %s\n' "$(date +%s.%N)" "${line:0:200}" >> $OUT; done
START=1788639588.805627528
1788639592.357733508 {"type":"system","subtype":"init","cwd":".../workspace-lap1-dogfood-001","session_id":"7115dbb5-...
```

That is **3.552 s** to the first event. Three further runs, killed at the first line so no request
was made:

```
run 1: to-first-event 9.674965387 s
run 2: to-first-event 11.269949013 s
run 3: to-first-event 7.902120041 s
```

**Every measurement exceeds the window, and the fastest exceeds it by 40%.** The session's own
`record.json` and `stderr-000.log` confirm the child was healthy and merely young: the argv is
correct, the pid is recorded, stderr is empty, and `events-000.jsonl` is zero bytes.

`defaultIdentityConfirmation` is deliberately conservative and should stay so; the defect is the
size of the window, not the strictness of the check. A fix is a `--readback-*` pair on
`lap perform`, or a window derived from a budget the caller already declares -- rondo passes
`turnTimeoutMs` and `gitTimeoutMs` explicitly (D-0019 rule 12) and would pass a third.

### F-2. Nothing anywhere selects the worker's model, so a lap runs on the most expensive one

The brief asked for "the cheapest model continuo permits". There is no such setting.

> **Resolved upstream and taken here (2026-09-06, rondo `D-0021`).** `continuo D-0099` added
> `lap perform --model`, appended to every spawn of the lap's session, and a `model` field on the
> verb's `--json` answer saying which model the lap ran on. rondo pinned that build and added
> `mapModelTier` beside `mapNeutralRole` in `src/continuo/roles.ts`: cadenza's
> `executorPolicy.modelTier` — the field this finding measured as "read by nobody" — is now read at
> the `classify` state, priced into a model id in the invocation adapter, and passed as `--model`.
> A tier the table does not price is refused before the spawn, so a lap never falls back to the
> worker CLI's own default. The iteration row records the tier and the model together. The pairs
> themselves are a cost policy and are **provisional pending an operator's ratification**; the
> inventory below of where a model could have come from stands as written.

- `continuo lap perform --help` at the pinned revision has **no `--model` flag**; the full option
  list is `--db --run-id --repository --artifact-root --state-root --endpoint-recipient
  --endpoint-destination-dir --endpoint-db --endpoint-module --node --claude-command
  --interlock-root --claude-org-path --hook-script --python --poll-interval-ms --turn-timeout-ms
  --git-timeout-ms --gate-option --gate-deadline-at-ms --json`.
- `dist/fencing/roles.json` carries no model key for any of the four roles.
- cadenza's `agentTypeInput.executorPolicy.modelTier` (`"standard"` here) is carried into the plan,
  digested into `agent_type_digest`, persisted -- and read by nobody. rondo's own facade says as
  much: `executorPolicy` is "carried and never interpreted".
- The obvious workaround is closed by design. `claudeCommand` is a command prefix in which **every
  token must be absolute**, so `--model` cannot be appended: `runPlan()` refuses it by field name
  before continuo would.

What the child actually ran on, from the probe's terminal event:

```
{"type":"assistant","message":{"model":"claude-opus-5",...
{"duration_api_ms":9978,"stop_reason":"end_turn",...,"total_cost_usd":0.09890950000000001,"usage":{"input_tokens":2,"cache_creation_input_tokens":9279,...
```

**Nine cents, and 9 279 cache-creation tokens, for a one-word reply.** The 9 279 is the fence's own
system prompt and settings, so it is the floor for *any* lap, not an artefact of this prompt. At one
lap per request that is the unit cost of the loop, and it is currently set by whatever the `claude`
CLI defaults to on the operator's machine.

`ANTHROPIC_MODEL` was exported in the driver's environment for the two real laps; whether it reaches
the fenced child was not established, because no child of those laps survived to make a request.

### F-3. rondo cannot be driven without the caller compiling it first

D-0002 leaves rondo with no build (`tsconfig.json` is `noEmit`, `package.json` has no `build`
script), which is correct for a host nothing consumes as a library. But the dogfood *is* a caller,
and so is any operating surface. `node --experimental-strip-types` does not help, because relative
imports are spelled `.js` and Node does not remap them to `.ts`:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../src/refrain/plan.js'
imported from .../.worker-scratch/probe.ts
```

So the script's step 1, "Call the composition root's `admit(...)`", is preceded by an unwritten step:
write a `tsconfig` that emits, run `tsc`, and import out of the emitted tree. That step is not in
`scripts/dogfood-lap.md` and cost the first twenty minutes of this run.

### F-4. The script's step 2 does not match the code, and omits the second database

Two mismatches, both found by reading `src/access/conductor.ts` rather than the script.

- The script says *"Call the composition root's `admit(request, plan, policy)`"*. The real signature
  is `admit(ports: ConductorPorts, plan: RunPlan, policy: LoopPolicy, id: string)` -- there is no
  `request` argument, `ports` comes from `openConductor(store, env)`, and the iteration id is the
  caller's fourth argument. A reader following the script writes a call that does not compile.
- The script's *Before you start* lists a control-plane database created by `db create`. **rondo has
  a second, entirely separate database**: `iterationStore(connection)` takes a `node:sqlite`
  `DatabaseSync` the caller opens, and where that file lives is the caller's decision. Nothing in
  the script says the caller opens it, that its path is theirs to pick, or that `node:sqlite` needs
  `--experimental-sqlite` on Node 22.

The script also says the process may exit once the arc reaches `awaiting_human` -- true, and
untested here.

### F-5. `CONSERVATIVE_POLICY` refuses, and nothing says what to pass instead

The script is right that a run started under the default is a run that did not start (D-0019 rule 9),
and it stops there. The value that does start one is
`{ autonomy: "ask_before_landing", maxIterations: 1 }`, and finding it meant reading
`src/refrain/policy.ts` and then `src/refrain/loop.ts:155` to check which of the two `Autonomy`
values `nextStep` refuses on. That is a two-file read to fill one argument in the first step a
caller takes.

### F-6. `parties.grantee` must equal `runId`, and the way you find out ends the iteration

The first classification came back:

```json
{
  "kind": "answered",
  "value": {
    "outcome": "refused",
    "reason": "grantee_mismatch",
    ...
  }
}
```

`classifyPlan` passes `{ runId: plan.runId, configDigest: project.configDigest }` as the context, and
cadenza checks the contract's grantee against that run id. So `parties.grantee` is not free: it *is*
`runId`, spelled a second time in a different field. The plan test fixture in
`test/refrain/plan.test.ts` happens to satisfy this (`grantee: RUN_ID`) but does not say it must, and
`runPlan()` -- which refuses on every other cross-field rule it has, including the ceiling against
the two budgets -- does not check this one.

**What makes it worth an issue is the consequence.** `grantee_mismatch` is an `answered`
classification, not a refusal, so in a real `admit()` it would not be a validation error: it ends the
iteration at terminal `abandoned` (D-0019 rule 15), having already reserved a row and taken the
single-flight lock. Asking again is a new iteration. A typo in a field whose correct value is
another field of the same plan costs a whole iteration.

### F-7. cadenza's catalog shape is discoverable only by being refused by it

`catalogLayers[].data` is a `RawTable` -- typed as free-form, validated as anything but. Two refusals
were needed to fill one layer:

```
a clone source of kind 'local_path' requires the layer that declares it to declare its own
catalog.allowed_local_roots (at .../catalog/projects.toml: project.dogfood-target.source)
```

The first attempt (`data: {}`, copied from `test/refrain/plan.test.ts`'s fixture, which is valid for
`runPlan()` and meaningless to cadenza) failed to resolve the project at all. The working shape --
`schema_version`, `catalog.allowed_local_roots`, `project.<name>.source` -- was recovered from
`test/cadenza/smoke.test.ts`, and the `allowed_local_roots` requirement only from the refusal above.
The refusals are good ones: they name the file, the key path and the rule. The gap is that a caller
has no document to write against, and `test/cadenza/smoke.test.ts` is currently serving as one.

### F-8. A duplicate iteration id surfaces as a raw SQLite string

```
The store could not reserve an iteration: UNIQUE constraint failed: iteration.id
```

Every other refusal in this run names a field, a rule and what to do. This one names a table column
and a database driver's phrasing. "Iteration `iter-001` already exists" is the same fact in the
vocabulary the rest of the surface uses.

### F-9. The row is enough to reconstruct the run, and this is the good news

`SELECT * FROM iteration` after the failed lap, abbreviated only where noted:

```json
{
  "id": "iter-001",
  "status": "failed",
  "request": "Add a single line to README.md at the end of the file reading exactly: ...",
  "plan": "{\"agent_type_input\":{...},\"artifact_root\":\"...\",...}",   // the full plan, canonical JSON
  "plan_digest": "sha256:aa01d95bb3a215602b42043eb968c30d65889a822c8acb0991462c6bc690eab0",
  "attempts": 1,
  "run_id": "lap1-dogfood-001",
  "continuo_revision": "44f62336108b86cab5da791111ffa0e5b73cd01a",
  "agent_type_digest": "sha256:0fc3ca257bac9293524ce48d4739c5ad4c2c01eca670106442008b8035e4942e",
  "config_digest": "sha256:d36b5acf6e5b93d2bc66c2a29c7657397166700e3f8e3bd79c91c46535fc3d3d",
  "contract_digest": "sha256:53a61a341952ea99c840a4790a154d37451400b59bdd237a61a2f6ab75fdcbe8",
  "classification": "allowed",
  "classification_reason": "granted",
  "neutral_role_name": "worker",
  "continuo_role": "worker",
  "gate_id": null,
  "gate_stage": null,
  "gate_outcome": null,
  "session_id": null,
  "session_path": null,
  "reason": "the identity committed for session \"b440a405-af33-4f14-9705-c49319a755e3\" did not read back within 50 attempts; the binding is left at 'spawned' rather than confirmed on trust",
  "created_at_ms": 1788639465708,
  "updated_at_ms": 1788639469513,
  "live": null
}
```

Checked by eye against the script's step 3: **the plan came back verbatim** (every one of the 31
fields, `snake_case`, canonically ordered), `plan_digest` is beside it, `continuo_revision` holds
exactly what `--version` reported, the three cadenza digests are there with the verdict they were
taken under, and `live` is `null` -- the single-flight lock was released, which is why the second lap
could be admitted at all. D-0019 rule 10's write order is visible in the failure: the revision and
run id are committed *before* the spawn, so the row of a lap that died mid-spawn still says which
build drove it.

What the row cannot say is what the script's step 3 wanted checked -- `gate_id`, `session_id` and
`session_path` are all `null`, because the lap never answered. The `session_path` check (that it is a
walk name and not a filesystem path) is therefore still unperformed.

One gap: the session id is in `reason` as prose only. `session-state/b440a405-.../record.json`
exists, holds the full argv and the pid, and is the first thing a person debugging F-1 wants -- and
the only way from the row to that directory is to parse it out of an English sentence.

### F-10. `node vendor/pin.mjs check` says nothing when it passes

```
$ node vendor/pin.mjs check; echo "pin.mjs exit=$?"
pin.mjs exit=0
```

Correct, and CI reads the exit code. For a person running the script by hand it is indistinguishable
from a no-op, and the digest it checked is the one fact worth printing.

### F-11. The lap leaves a worktree, a branch and an open run behind, and the script offers no commands

After two failed laps:

```
$ ls -d $S/workspace-*
.../workspace-lap1-dogfood-001
.../workspace-lap1-dogfood-002
$ git -C $S/target branch -a
+ dogfood/lap1-dogfood-001
+ dogfood/lap1-dogfood-002
* main
$ node "$CLI" gate list --db "$S/control-plane.sqlite3"
no open gates in .../control-plane.sqlite3
```

Both runs are still `created` in the control plane. This is D-0010 and D-0013 working as designed --
rondo abandons and does not close runs or gates it did not open -- and the script's step 7 says so.
What step 7 does not give is the commands, and one of them is not obvious: `continuo run` accepts
only `admit` and `close`, so there is no `run show` to check the state you are cleaning up.

```
$ node "$CLI" run show --run-id lap1-dogfood-001 --db "$DB"
usage: continuo run [-h] {admit,close} ...
continuo run: error: argument cmd: invalid choice: 'show' (choose from 'admit', 'close')
```

No orphaned worker processes were left by either lap: `pgrep -af claude` found none, which matches
the report's claim that an answer arriving means the `lap perform` process is over.

## 7. Assessment

**The conductor loop is not the thing that is broken.** Everything rondo owns worked, first time, and
several parts worked better than the design promised: `runPlan()` accepted a 31-field plan and would
have named the first bad field; the pin check refused a modified build and closed off the workaround
that would have made this document dishonest; the store's write order left a row that reconstructs
the run; `resume` and `abandon` on a terminal row each changed nothing and said so in one
millisecond; and the single-flight lock released on failure so a second lap could be admitted. The
eight report lines from `admit()` are the clearest artefact this run produced.

**The lap stops one layer down, on a constant.** F-1 is a 2.5 second budget for an event that takes
4 to 11 seconds on this machine, hard-coded in continuo with no flag reaching it. It is not
rondo's to fix, it is deterministic, and until it moves **no lap can complete on this machine**, so
the whole downstream half of lap 1 -- the suspend at `awaiting_human`, the human's answer through
`gate answer`/`gate close`, and `resume` to `closed` -- is still entirely unwalked. The design's own
falsifier list (section 12, D-0019) does not name this; it worried about `LAP_PERFORM`'s shape
changing, and what actually bit was a timing constant on the other side of a decoder that never got
to decode anything.

**The second cost is the plan's surface, and it is larger than R-3 assumed.** Six of thirty-one
fields are the request. Fifteen cannot be filled without reading source, and three of those (F-5,
F-6, F-7) are not merely undocumented but actively misleading: a policy constant that refuses, a
field whose only correct value is another field, and a free-form table with three mandatory keys. R-3
answered "a complete `RunPlan`, no allocator and no configuration layer in lap 1", and this run does
not contradict it -- ten of the fifteen are site configuration that a config file would hold. But
"the caller packages it" is currently a caller who reads `src/refrain/policy.ts`,
`src/refrain/loop.ts`, `test/cadenza/smoke.test.ts` and `src/access/conductor.ts` to fill four
arguments, and that is the number worth carrying into the parallelism discussion in rondo#8 /
continuo#167: **single-flight is not what is limiting throughput today. Nothing has completed once.**

**On cost.** The one measurement available is the probe: `total_cost_usd: 0.0989` and 9 279
cache-creation tokens for a one-word reply under the fence. The cache-creation figure is the fence's
own preamble and is therefore a floor under every lap. With no model selection anywhere in the stack
(F-2), that floor is set by the operator's CLI default rather than by anything rondo, continuo or
cadenza decides -- and `modelTier` is already in the plan, already digested, and already ignored.

**What this run did not establish**, and should be read as unknown rather than fine: what a
completing lap costs in wall clock against `invocationCeilingMs`; whether `LAP_PERFORM` decodes a
real success (only its refusal path was exercised); whether `session_path` is a walk name in
practice; whether the gate continuo opens is really at `received` when `lap perform` returns;
whether `resume` sees an answered gate; and whether `ANTHROPIC_MODEL` reaches the fenced child.

## 8. How to run this again

**Nothing in this section is committed.** `.worker-scratch/` is excluded from git, so the two files
below are yours to create before the command works; they are reproduced in full here, and together
with section 2's provisioning and section 3's plan they are the whole of what this run was. Write
them into `.worker-scratch/`, then:

```sh
S=<worktree>/.worker-scratch
export npm_config_cache=$S/npm-cache
export RONDO_CONTINUO_CLI=$S/continuo-44f62336108b86cab5da791111ffa0e5b73cd01a/dist/cli.js
node --experimental-sqlite .worker-scratch/drive.mjs <validate|classify|admit|resume|abandon|row>
```

`.worker-scratch/plan.mjs` is section 3's `PLAN_INPUT` under this header, which is what supplies
`S`, `RUN_ID` and `ITERATION_ID` to both files:

```js
// The RunPlan for the lap-1 dogfood, filled by hand (R-3: the caller packages it).
const S = "<worktree>/.worker-scratch";
export const RUN_ID = process.env.DOGFOOD_RUN_ID ?? "lap1-dogfood-001";
export const ITERATION_ID = process.env.DOGFOOD_ITERATION_ID ?? "iter-001";

export const PLAN_INPUT = { /* section 3, verbatim */ };
```

`.worker-scratch/drive.mjs` is thirty lines:

```js
import { DatabaseSync } from "node:sqlite";
import { admit, abandon, openConductor, resume } from "./dist/access/conductor.js";
import { runPlan } from "./dist/refrain/plan.js";
import { iterationStore } from "./dist/store/sqlite.js";
import { classifyPlan } from "./dist/refrain/classification.js";
import { PLAN_INPUT, ITERATION_ID } from "./plan.mjs";

// Spelled again here: `plan.mjs`'s `S` is that module's own and is not exported,
// and the shell variable above is the shell's.
const S = "<worktree>/.worker-scratch";
const POLICY = Object.freeze({ autonomy: "ask_before_landing", maxIterations: 1 });
const mode = process.argv[2];

const outcome = runPlan(PLAN_INPUT);
if (outcome.kind !== "planned") { console.log(`REFUSED by runPlan: ${outcome.reason}`); process.exit(1); }
const plan = outcome.plan;
console.log(`plan ok: ${Object.keys(plan).length} fields`);
if (mode === "validate") process.exit(0);
if (mode === "classify") { console.log(JSON.stringify(classifyPlan(plan), null, 2)); process.exit(0); }

const connection = new DatabaseSync(`${S}/rondo-iterations.sqlite3`);
const store = iterationStore(connection);
if (mode === "row") { console.log(JSON.stringify(connection.prepare("SELECT * FROM iteration").all(), null, 2)); process.exit(0); }

const started = await openConductor(store, process.env);
if (started.kind !== "ready") { console.log(`REFUSED by openConductor: ${started.reason}`); process.exit(1); }
console.log(`continuo verified: ${started.revision}`);

const t0 = Date.now();
// Every mode is named. There is deliberately no fallback branch: `abandon` is a
// terminal write, and a mistyped `resum` falling through to it would settle a
// live iteration for good.
let report;
if (mode === "admit") report = await admit(started.ports, plan, POLICY, ITERATION_ID);
else if (mode === "resume") report = await resume(started.ports, ITERATION_ID);
else if (mode === "abandon") report = await abandon(started.ports, ITERATION_ID, process.argv[3] ?? "dogfood cleanup");
else { console.log(`unknown mode ${mode}`); process.exit(2); }
console.log(`--- report (${mode}, ${Date.now() - t0} ms) ---`);
console.log(`iterationId: ${report.iterationId}`);
console.log(`status: ${report.status}`);
for (const line of report.lines) console.log(`  ${line}`);
```

## 9. Proposed issues

rondo's worker cannot create issues. These are proposed for the secretary to file; each names the
repository it belongs to.

**1. (continuo) The post-spawn identity read-back window is 2.5 s and a real `claude -p` needs 4-11 s.**
`SessionOrchestrator` polls `readState` 50 times at 50 ms (`src/supervisor.ts:331,341`), giving a
freshly spawned worker 2.5 seconds to emit an event naming its committed session id. Measured on
WSL2 with the fence's own settings and MCP config, `claude` 2.1.261 takes 3.55 s to its first
`system`/`init` event on a cold start and 7.9-11.3 s on three warm ones -- so the window is never
met, `#awaitIdentity` exhausts, and the lap ends with the binding left at `spawned`. It is
deterministic: two rondo laps at fresh identifiers failed identically at 3810 ms and 3837 ms, with
empty `stderr` and a zero-byte events file confirming a healthy but young child. Neither constant is
reachable from `lap perform`'s command line. Proposed: expose the attempts and the interval as flags
(or derive the window from a caller-supplied budget, as `--turn-timeout-ms` and `--git-timeout-ms`
already are), and raise the default well above a realistic CLI cold start. The strictness of
`defaultIdentityConfirmation` should not change -- the size of the window is the defect.

**2. (continuo, or the three together) Nothing in the stack selects the worker's model.**
`lap perform` has no `--model` flag, `dist/fencing/roles.json` carries no model key for any role, and
`claudeCommand`'s every-token-absolute rule means a caller cannot append one. cadenza already carries
`executorPolicy.modelTier` through rondo's plan and into `agent_type_digest`, and nothing reads it.
The result is that every lap runs on whatever the operator's `claude` CLI defaults to: measured here
at `claude-opus-5`, `total_cost_usd: 0.0989` and 9 279 cache-creation tokens for a one-word reply,
where the cache-creation figure is the fence's own preamble and therefore a floor under every lap.
Proposed: decide where model selection lives -- most plausibly `modelTier` finally being read, mapped
in rondo's role adapter alongside `mapNeutralRole`, and passed to a new `lap perform` flag -- and
record the decision. Until then the cost of a lap is not a number this stack chooses.

**Not proposed: `scripts/dogfood-lap.md` was wrong and is fixed in the same change as this record.**
F-3, F-4 and F-5 are defects in the procedure itself, and fixing the dogfood script was in scope for
this run: the script now carries `admit`'s real signature, the second database rondo opens for its
own iteration store, the install-then-compile step D-0002 leaves to the caller, the policy value that
actually starts a run, and the two cross-field rules `runPlan()` does not check. They are recorded as
findings because they are what this run cost, not because anything is owed to the secretary.

**3. (rondo) The plan's three undocumented cross-field rules, and where each is discovered.**
Filling a first `RunPlan` costs three findings that `runPlan()` could have named and does not.
(a) `CONSERVATIVE_POLICY` refuses before a row exists, by design (D-0019 rule 9), and neither the
script nor `policy.ts` says the value that does start a run is
`{ autonomy: "ask_before_landing", maxIterations: 1 }` -- it takes reading `loop.ts:155`.
(b) `parties.grantee` must equal `runId`, because `classifyPlan` passes the run id as cadenza's
classification context; get it wrong and cadenza answers `grantee_mismatch` as an *answered*
classification, which ends the iteration at terminal `abandoned` after the row is reserved and the
single-flight lock taken -- a whole iteration lost to a field whose only correct value is another
field of the same plan. `runPlan()` validates every other cross-field rule it has, including the
ceiling against the two budgets, and could validate this one for free.
(c) `catalogLayers[].data` is typed as free-form and is not: cadenza requires `schema_version`,
`project.<name>.source`, and -- for a `local_path` source -- `catalog.allowed_local_roots` on the
declaring layer. The working shape is currently recoverable only from
`test/cadenza/smoke.test.ts` and from cadenza's refusals. Proposed: check (b) in `runPlan()`, and
document (a) and (c) where a caller filling a plan will meet them.

**4. (rondo) Two refusals speak the wrong vocabulary, and the row loses the session path.**
Small, and cheap. A duplicate iteration id surfaces as `The store could not reserve an iteration:
UNIQUE constraint failed: iteration.id` -- a driver's phrasing and a column name, where every other
refusal in the loop names a field and a rule. And a failed lap's session id reaches the row only
inside `reason`'s English prose, so the path from a row to
`session-state/<id>/record.json` -- which holds the argv, the pid and the captured stderr, and is the
first thing a person debugging issue 1 opens -- is to parse a sentence. Proposed: word the duplicate
refusal in rondo's own vocabulary, and persist the session id in a column of its own so a reader can
get from the row to the evidence without regex. `node vendor/pin.mjs check` printing the digest it
verified, rather than nothing, belongs in the same change.

**5. (rondo) The lap-1 loop has never completed, and the parallelism discussion should say so.**
rondo#8 / continuo#167 weigh single-flight against throughput. This run is the measurement that was
asked for first, and its result is that **no lap has completed end to end on this machine**: the arc
stops at the spawn (issue 1), so the suspend at `awaiting_human`, the human answer through
`gate answer` / `gate close`, and `resume` to `closed` are all still unwalked, and D-0019's
`LAP_PERFORM` decoder has only ever been exercised on its refusal path. What a completing lap costs
against `invocationCeilingMs` is unknown; the ceiling was never in play, because the lap answered in
3.8 seconds. Proposed: keep this record as the standing answer until issue 1 lands, then re-run it
and replace section 7's "what this run did not establish" list with measurements.
