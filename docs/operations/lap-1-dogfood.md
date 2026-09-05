# lap 1 dogfood -- what one real request cost, and where it stopped

A record of driving [`../../scripts/dogfood-lap.md`](../../scripts/dogfood-lap.md) end to end against
the pinned continuo and the vendored cadenza, with a real worker. What is written here is **the
commands that were actually run and the output that actually came back**, not what the design
expects.

> **This document holds two runs, and sections 1-9 are the first one.** The first run stopped at the
> spawn and its conclusions are true of the pin it ran against, not of the current one. **[Section
> 10](#10-the-re-run-at-continuo-603843b----the-lap-completes) is the re-run after `D-0021`, in which
> the lap completes end to end** -- it carries the wall-clock and dollar cost of a real lap, the gate
> answered through continuo's verbs, `resume` to `closed`, and five new findings. Read section 10
> first if you want the current state; read sections 1-9 for how the loop was got there.

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

> **All six were measured in the re-run; the table in [10.7](#107-the-row-and-section-7s-unknowns)
> answers them one by one.** The paragraph above is left as it was written, because what a run did
> not establish is part of its record.

> **One conclusion above has since been overtaken.** This section says "single-flight is not what is
> limiting throughput today. Nothing has completed once." Laps now complete, and the re-run measured
> what single-flight costs: the lock is held across the human suspend, which was **83% of an
> iteration's life** even with a program answering the gate. See [10.9, F-13](#f-13-single-flight-holds-the-lock-for-the-whole-human-suspend).

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

---

## 10. The re-run at continuo `603843b` -- the lap completes

**Everything above this line is the first run and stands as written.** This section is a second walk
of the same procedure, on the same machine, after the pin moved to the continuo build that takes the
read-back window as a budget (rondo `D-0021`). It is a separate run and not an edit of the first:
where a number here contradicts one above, the one above was true of the older pin.

- Run on 2026-09-06, on `fix/rondo-lap1-dogfood-rerun-after-d0021` at `3786ef2`, against continuo
  `603843b7c0e91136bc7f7e5c9f91640f7bb970c9` (`continuo.pin.json`) and cadenza
  `5d5d9f408c29f6500c422c8e10e6b6a3a6882aaf` (`cadenza.pin.json`; tarball digest
  `1d255ecc5a58cd15df98dfcc0a2dd79dd83d4dac0da98d509402de8bc94902ff`, checked by
  `node vendor/pin.mjs check`).
- Machine: WSL2 (`Linux 6.18.33.2-microsoft-standard-WSL2`), Node v22.17.0, worker CLI
  `claude` 2.1.261. The same machine as the first run.
- **The lap completed, three times.** All seven steps of the script were walked: the arc suspended at
  `awaiting_human` with a real gate open at `received`, a human answered it through continuo's own
  verbs, and `resume` took the iteration to `closed`. The worker was a real `claude -p` in every
  case, and it did the work it was asked to do -- commit `e075b60` on `dogfood/lap1-dogfood-003`
  really appends the line to `README.md`.
- **Every unknown section 7 left open is now a number**, in 10.7. The one that mattered most is the
  ceiling: a lap answered in **17.9 to 20.9 seconds**, against an `invocationCeilingMs` of 1 800 000,
  so the ceiling was used to about **1.2%**.
- Five new findings, F-12 to F-16, and the honest headline among them is F-13: **single-flight holds
  the lock for the whole human suspend**, so 83% of the first iteration's life was spent blocking on
  a person rather than on a lap. That is the number rondo#8 asked for.
- No `src/` change was made. `scripts/dogfood-lap.md` is corrected in the same change as this record,
  as it was the first time.

### 10.1. What moved since the first run

| First-run finding | State at this pin | Evidence in this run |
|---|---|---|
| **F-1** read-back window 2.5 s, hard-coded | **Resolved.** `continuo D-0098` takes `--identity-readback-timeout-ms`; rondo makes it the third explicit budget (`D-0021`) | three laps spawned and confirmed identity; 120 000 ms declared |
| **F-2** nothing selects the model | **Resolved.** `continuo D-0099` adds `lap perform --model`; rondo prices `modelTier` in `mapModelTier` | `--model claude-opus-5` in the child's argv; `model` column set |
| **F-3 / F-4 / F-5** script wrong about the compile, `admit`'s signature, the second database, the policy | **Resolved** in the first run's own change | the script was followed as written and worked |
| **F-6** `parties.grantee` unchecked | **Resolved.** `runPlan()` refuses it by name | 10.8, first refusal |
| **F-8** duplicate id spoke SQLite | **Resolved.** rondo's own vocabulary | 10.8, second refusal |
| **F-10** `pin.mjs check` printed nothing | **Resolved.** it names the digest | 10.2 |
| **F-11** step 7 gave no commands | **Resolved** in this change (the script now carries them) | 10.9 |
| **F-7** cadenza's catalog shape is discoverable only by refusal | **Still open.** The `RunPlan` doc comment now states the closed table, which is where a caller meets it, but cadenza still has no document of its own | the layer from section 3 was reused unchanged and accepted |
| **F-9**'s tail: a *failed* lap's session id reaches the row only inside `reason` prose | **Still open**, and unexercised here -- no lap failed | -- |

### 10.2. Provisioning, with what each step cost

Same shape as section 2, at the new revision. `$S` is
`<worktree>/.worker-scratch`, and everything below it is excluded from git.

```sh
export npm_config_cache=$S/npm-cache
node vendor/pin.mjs check
# vendor/suisya-systems-cadenza-0.0.0.tgz is the pinned artifact:
#   sha256 1d255ecc5a58cd15df98dfcc0a2dd79dd83d4dac0da98d509402de8bc94902ff     (F-10, fixed)
npm ci --ignore-scripts                                                          # 5.4 s

REV=603843b7c0e91136bc7f7e5c9f91640f7bb970c9
git clone --quiet --no-checkout /home/happy_ryo/work/org/workers/continuo "$S/continuo-$REV"
git -C "$S/continuo-$REV" checkout --quiet --detach "$REV"
test "$(git -C "$S/continuo-$REV" rev-parse HEAD)" = "$REV"                      # 2.0 s for all three
npm --prefix "$S/continuo-$REV" ci --ignore-scripts                              # 4.9 s
CONTINUO_REQUIRE_REVISION=1 npm --prefix "$S/continuo-$REV" run build            # 0.9 s
node "$S/continuo-$REV/dist/cli.js" --version
# @suisya-systems/continuo 0.0.0 (rev 603843b7c0e91136bc7f7e5c9f91640f7bb970c9)
```

That version line is `continuo.pin.json`'s `versionLine` byte for byte, again.

```sh
node "$CLI" db create --db "$S/control-plane.sqlite3"
# created .../control-plane.sqlite3: schema version 4 of 4                       (0.25 s)
./node_modules/.bin/tsc -p $S/tsconfig.dogfood.json                              # 0.2 s, exit 0
```

Total provisioning: **about 13.5 seconds**, compile included. The throwaway `tsconfig.dogfood.json`
and the two driver files are section 8's, unchanged except for the new `identityReadbackTimeoutMs`
field and the new scratch path.

**The two new flags are on `lap perform --help` at this revision**, which is the cheapest possible
check that the right build is in play:

```
--claude-command CLAUDE_COMMAND [--model MODEL]
...
[--identity-readback-timeout-ms IDENTITY_READBACK_TIMEOUT_MS]
```

### 10.3. The plan: thirty-two fields

Section 3's plan, with one field added and nothing else changed:

```js
  turnTimeoutMs: 900_000,
  gitTimeoutMs: 60_000,
  identityReadbackTimeoutMs: 120_000,          // new under D-0021
  ...
  invocationCeilingMs: 1_800_000,              // must exceed 900_000 + 60_000 + 120_000
```

`runPlan()` accepted it and reported **32 fields**, and the stored plan carries
`identity_readback_timeout_ms: 120000` in its canonical JSON. **120 000 ms is four times continuo's
own 30 s default and ten times the slowest start the first run measured**, chosen deliberately: the
budget is what rondo is willing to wait for a young process, and the cost of it being generous is
paid only when a spawn is genuinely broken.

Section 3.1's arithmetic moves by one. Of **thirty-two** fields, six are still the request and ten
are still site configuration; the count that must be read out of source to fill at all goes from
eleven to **twelve**, because `identityReadbackTimeoutMs` is a budget with no answer in the request
and no answer on the machine. That is `D-0021` making a hidden constant into a stated one, and the
cost of stating it is one more field a first caller cannot guess.

### 10.4. The lap, three times

```
$ RONDO_CONTINUO_CLI=... node --experimental-sqlite $S/drive.mjs admit
plan ok: 32 fields
continuo verified: 603843b7c0e91136bc7f7e5c9f91640f7bb970c9
--- report (admit, 20883 ms) ---
iterationId: iter-003
status: awaiting_human
  Reserved iteration iter-003 at 'planned'.
  cadenza allowed the action (granted); the three digests are committed.
  continuo build verified at revision 603843b7c0e91136bc7f7e5c9f91640f7bb970c9; run id lap1-dogfood-003 and that revision are committed before anything is spawned.
  continuo admitted run lap1-dogfood-003 at status 'created' under role 'worker' (neutral name 'worker').
  Sending one lap; this is the step that takes minutes.
  The lap answered. Gate gate/worker_escalation/a3ebe804-d4f6-4a0b-92c6-fc9bebb5a188/0 is already open; session a3ebe804-d4f6-4a0b-92c6-fc9bebb5a188 was started.
  The conductor is suspending here. There is no timer and no poll loop, and the process may exit; call resume() once a person has answered the gate.
```

**Two lines are new against the first run and both are the ones that were missing.** "The lap
answered" is `LAP_PERFORM` decoding a success rather than a refusal, and "The conductor is suspending
here" is the arc reaching `awaiting_human`. The process did exit, and the gate stayed open.

| Lap | `admit` wall clock | Session | What it was for |
|---|---|---|---|
| `lap1-dogfood-003` | **20 883 ms** | `a3ebe804` | the full walk: answered through the verbs |
| `lap1-dogfood-004` | **17 991 ms** | `10ccdc28` | a second timing; closed `withdrawn` |
| `lap1-dogfood-005` | (not timed) | `a26638ce` | the single-flight probe (F-13); closed `unanswerable` |

**It is as deterministic as the failure was.** Three laps, three spawns, three gates, no flake and no
retry. `stderr-000.log` is zero bytes for all three.

#### 10.4.1 The stages, in wall clock

| Stage | Cost |
|---|---|
| `runPlan()` validation | under 1 ms |
| cadenza classification (four calls) | under 1 ms |
| `startContinuo` -- spawn `--version`, compare with the pin | ~200 ms |
| `lap perform`: worktree, fence, spawn, turn, gate | the balance |
| **`admit()` end to end** | **20 883 ms / 17 991 ms** |
| `resume()` before the answer | 108-109 ms |
| `resume()` that closes the iteration | 108-125 ms |
| `resume()` on a closed row | 1 ms |
| `admit()` refused on a duplicate id | 1 ms |
| `admit()` refused by single-flight | 1 ms |

**`invocationCeilingMs` was 1 800 000 ms and the lap answered in 20.9 s, so the ceiling was used to
1.2%.** The first run could only say the ceiling was never in play; this one says by how much. A
ceiling of two minutes would have been ample for these laps, and the reason not to set one is F-13
and the `turnTimeoutMs` that a real request would actually need -- 900 000 ms of turn budget is the
number the ceiling has to clear, not the 20 seconds a one-line edit takes.

#### 10.4.2 What the read-back window actually needed

The lap no longer measures this for us, because it succeeds. Repeating the first run's probe --
`claude -p` under the fence's own settings and MCP config, timed from process start to the first
`stream-json` line, killed at that line so no request is made:

```
run 1: to-first-event 3.178809966 s
run 2: to-first-event 1.259881761 s
run 3: to-first-event 1.152589796 s
```

**1.15 to 3.18 s on an idle machine, against 3.55 to 11.27 s in the first run.** The conditions
differ -- the first run's probes were taken on a busier machine -- and neither set is wrong. What the
pair establishes is the shape of the number: **it is not a constant, it varies by roughly a factor of
ten with load, and the first run's slowest measurement exceeds this run's fastest by a factor of
nine.** A fixed window is the wrong instrument for it, which is what `D-0098` concluded; a 30 s
default clears every measurement in both runs by at least a factor of two, and rondo's declared
120 000 ms clears the worst by a factor of ten.

Note that run 1's 3.18 s **would still have exhausted the old 2.5 s window** on an idle machine with
nothing else running. F-1 was not a heavy-load artefact.

### 10.5. The gate, walked as the operator

The script's step 4, run for `lap1-dogfood-003`. rondo drove none of it.

```
$ node "$CLI" gate list --db "$DB"
gate/worker_escalation/a3ebe804-.../0 worker_escalation run=lap1-dogfood-003 stage=received since=1788650204703 deadline=-
```

**`stage=received` when `lap perform` returned** -- section 7's fourth unknown, answered. The gate
carries the worker's own report as its rationale, which is the first time this document has been able
to show one:

```
rationale: Done. Appended the line to `README.md:5` and committed as `e075b60` on `dogfood/lap1-dogfood-003`.

Note: the sandbox failed to initialize on the first commit attempt (a socket permission error,
unrelated to the command), so it disabled itself for the session and the retry succeeded.
```

`present` -> `deliver` -> `ack` -> `answer` -> `deliver` -> `ack`, each with `--json` so the
`message_id` each enqueueing verb returns can be handed to the ack that follows it. The whole
transition history afterwards:

```
transition 1 open     -->received   by=system/lap_composition_root      at=1788650204703
transition 2 advance  received->presented  by=secretary/human/dogfood-operator  at=1788650287318
transition 3 advance  presented->answered  by=human/human/dogfood-operator      at=1788650300734 body=approve
transition 4 advance  answered->forwarded  by=secretary/human/dogfood-operator  at=1788650301002
transition 5 close    forwarded->forwarded by=system/human/dogfood-operator     at=1788650301002
outcome=answered_and_forwarded
```

**The stage moves on the ack and not on the send, and the second ack is what closes the gate** --
`gate ack` reports `"closed":true` on the forwarded relay and `gate list` is empty afterwards. Both
relays reached the dropbox as `<sha256>.effect.json` files beside `attempts.log` and `fence.json`.

`gate close` is the other ending, and **which outcomes it accepts depends on the stage the gate is
at** (F-16):

```
$ node "$CLI" gate close ... --outcome answered_and_forwarded
error: argument --outcome: invalid choice: 'answered_and_forwarded' (choose from 'withdrawn', 'expired', 'unanswerable')

$ node "$CLI" gate close ... --outcome unanswerable        # gate at 'received'
error: outcome 'unanswerable' is reached from ['presented'], not from 'received'
```

Both refusals are good ones and both are correct: `answered_and_forwarded` is the forward ack's to
write, and `unanswerable` means a person looked at the question, which is what `presented` records.

### 10.6. Resume, and the three outcomes

The script's step 5, in the order it asks for. **Before** the answer:

```
--- report (resume, 109 ms) ---
status: awaiting_human
  Gate gate/worker_escalation/a3ebe804-.../0 is still open at stage 'received'. Nothing was written and iteration iter-003 stays at 'awaiting_human'.
```

**After** the answer, and then again:

```
--- report (resume, 125 ms) ---
iterationId: iter-003
status: closed
  Gate gate/worker_escalation/a3ebe804-.../0 reached outcome 'answered_and_forwarded' at stage 'forwarded'.
  Iteration iter-003 is closed.
  Gate outcome: answered_and_forwarded.
  Run id: lap1-dogfood-003; continuo revision: 603843b7c0e91136bc7f7e5c9f91640f7bb970c9.
  The run row is still 'created'. Nothing was pushed, nothing was landed, and publishing this work is the operator's, not rondo's (D-0010).

--- report (resume, 1 ms) ---            # the second call
  Iteration iter-003 is closed.
  ...same four lines...
```

**Step 6's requirement is met**: the report names the gate's outcome, the run id, the continuo
revision, and says plainly that publishing is the operator's. The idempotence step 5 asks for holds
in all three directions -- before the answer nothing is written, after it the iteration closes once,
and a second call changes nothing and says so in a millisecond.

`resume` was exercised against all three terminal outcomes a gate can reach here, and read each one
correctly:

| Iteration | Gate outcome | Reached by | `resume` said |
|---|---|---|---|
| `iter-003` | `answered_and_forwarded` | the forward relay's ack | `closed`, outcome named |
| `iter-004` | `withdrawn` | `gate close` from `received` | `closed`, outcome named |
| `iter-005` | `unanswerable` | `gate close` from `presented` | `closed`, outcome named |

### 10.7. The row, and section 7's unknowns

`SELECT * FROM iteration` for `iter-003` after the close, abbreviated where noted:

```json
{
  "id": "iter-003",
  "status": "closed",
  "plan": "{...}",                                       // 2843 chars, 32 keys, canonical JSON
  "plan_digest": "sha256:6bb1974fab5b3d33183a6434991070d2cd617067ef843913b085449a4dbedfbe",
  "run_id": "lap1-dogfood-003",
  "continuo_revision": "603843b7c0e91136bc7f7e5c9f91640f7bb970c9",
  "classification": "allowed",
  "classification_reason": "granted",
  "neutral_role_name": "worker",
  "continuo_role": "worker",
  "model_tier": "standard",
  "model": "claude-opus-5",
  "gate_id": "gate/worker_escalation/a3ebe804-af33-.../0",
  "gate_stage": "forwarded",
  "gate_outcome": "answered_and_forwarded",
  "session_id": "a3ebe804-d4f6-4a0b-92c6-fc9bebb5a188",
  "session_path": "started",
  "reason": null,
  "live": null,
  "created_at_ms": 1788650183843,
  "updated_at_ms": 1788650309243
}
```

**`model_tier` and `model` are the two new columns and they hold the tier and the id it was priced
at.** `session_path` is `"started"` on all three iterations.

Section 7 closed with a list of six things this run "did not establish, and should be read as unknown
rather than fine". Each one, with the measurement:

| Section 7's unknown | Measured |
|---|---|
| what a completing lap costs in wall clock against `invocationCeilingMs` | **20 883 ms and 17 991 ms against 1 800 000 ms -- 1.2% and 1.0% of the ceiling** |
| whether `LAP_PERFORM` decodes a real success | **Yes.** "The lap answered ... session `a3ebe804` was started", three times, on the success path |
| whether `session_path` is a walk name in practice | **Yes.** `"started"` on all three; never anything path-shaped |
| whether the gate continuo opens is really at `received` when `lap perform` returns | **Yes.** `gate list` says `stage=received`, and `resume` before the answer agrees |
| whether `resume` sees an answered gate | **Yes**, in 125 ms, and it closes the iteration exactly once |
| whether `ANTHROPIC_MODEL` reaches the fenced child | **Superseded, and no longer worth knowing.** `ANTHROPIC_MODEL` was *not* exported this run. `--model claude-opus-5` is in the child's recorded `argv`, and every `assistant` event reports `"model":"claude-opus-5"`, so the model is chosen explicitly rather than inherited from an environment variable (`D-0021`) |

### 10.8. The refusals, re-measured

Every refusal the first run recorded, plus the two that are new, run against the real CLI:

```
===== parties.grantee != runId (F-6, now checked by runPlan) =====
refused: 'parties.grantee' is 'somebody-else', and it must equal 'runId' ('lap1-dogfood-003'): the
conductor classifies under the run id, so cadenza would answer a different grantee with
grantee_mismatch -- an answered classification that ends the iteration at 'abandoned' after the row
is reserved and the single-flight lock taken.

===== duplicate iteration id (F-8, now in rondo's vocabulary) =====
The store could not reserve an iteration: an iteration with id 'iter-003' already exists, and an
iteration id is minted once: the store will not reserve a second row under it

===== invocationCeilingMs equal to the three-budget floor (D-0021) =====
refused: 'invocationCeilingMs' is 1080000, which is not above turnTimeoutMs + gitTimeoutMs +
identityReadbackTimeoutMs (1080000). rondo's ceiling firing means the CLI was killed and the fenced
worker was not, so it must be the operator's declared patience above continuo's own budgets rather
than a number derived from them.

===== identityReadbackTimeoutMs omitted =====
refused: 'identityReadbackTimeoutMs' is undefined, and a positive whole number of milliseconds was required

===== a model tier rondo does not price (D-0021) =====
{"kind":"unknown","reason":"rondo has no model for the model tier 'frugal'. The tiers rondo prices
are standard, and a lap runs on a model rondo chose rather than on the worker CLI's own default.
Give the agent type one of those tiers, or add the pair to src/continuo/roles.ts under a new
decision entry."}
```

**F-6's refusal is the one worth reading twice.** It does not merely say the field is wrong; it says
what would have happened without the check, which is the whole reason the check earns its place.
A ceiling exactly equal to the floor is refused, and one millisecond above it is accepted -- the
boundary is where the doc comment says it is.

### 10.9. What this run found

### F-12. The report claims the run row is `created`, and does not read it

**A report line that can be false.** `resume` ends every report with:

```
The run row is still 'created'. Nothing was pushed, nothing was landed, and publishing this work is
the operator's, not rondo's (D-0010).
```

That sentence is a fixed string (`src/refrain/interpreter.ts:1516`), not a read. After the operator
does exactly what the script's step 7 tells them to do:

```
$ node "$CLI" run close --db "$DB" --run-id lap1-dogfood-003 --outcome completed --actor-id human/dogfood-operator
closed lap1-dogfood-003 ...: status created -> completed by human/dogfood-operator under writer epoch 1

$ SELECT run_id, status FROM run
  lap1-dogfood-003 -> completed
```

`resume` still says *"The run row is still `created`"*. The claim is now untrue, and it is untrue in
the direction that matters: a person reading it would conclude there is still a run to settle.

The **intent** of the line is right and is D-0010 -- rondo did not close the run and must not imply
it did. The defect is the tense. "rondo did not close the run" is the fact rondo can state without
reading anything; "the run row is still `created`" is a claim about somebody else's table.

### F-13. Single-flight holds the lock for the whole human suspend

**This is the measurement rondo#8 / continuo#167 asked for, and it is not the one the first run
predicted.** The first run concluded "single-flight is not what is limiting throughput today. Nothing
has completed once." Now that laps complete, the limit is visible and it is not the lap.

With `iter-005` sitting at `awaiting_human`, a second iteration under fresh identifiers:

```
--- report (admit, 1 ms) ---
iterationId: null
status: null
  Refused: iteration iter-005 is still live, and at most one iteration may be non-terminal at a time.
  Try again once that iteration reaches a terminal status, or settle it with abandon().
```

The refusal is correct, instant, costs no row and spawns nothing -- it is the design working. What it
means in wall clock is the finding. For `iter-003`:

| Span | Duration | Share |
|---|---|---|
| `admit()` -- the lap itself, `live=1` | 20 883 ms | 17% |
| `awaiting_human` -- gate open, **still `live=1`** | 104 520 ms | 83% |
| **Iteration lifetime under the lock** | **125 400 ms** | 100% |

And the 104.5 s was a fast human: the operator was a program that answered as soon as it looked. A
real person answering a real escalation in ten minutes holds the lock for ten minutes, during which
**no unrelated lap can be admitted at all**. The row confirms the lock is held rather than released
across the suspend -- `live` is `1` in the row read at `awaiting_human`, and `null` only after
`resume`.

**The lap is not the contended resource; the human is.** Whatever rondo#8 decides, it should be
decided against this ratio rather than against the lap's 20 seconds.

### F-14. The row does not say what stage the gate is at while it is suspended

Read at `awaiting_human`, with continuo's `gate list` simultaneously reporting `stage=received`:

```
  gate_id:      'gate/worker_escalation/a3ebe804-.../0'
  gate_stage:   None
  gate_outcome: None
```

`gate_stage` is filled only when `resume` reads the gate, so during the entire window in which
somebody might want to know -- the suspend, which F-13 measures at 83% of the iteration -- the row
names the gate but not where it has got to. A surface built on the row alone cannot tell `received`
from `presented` without calling continuo, and the whole point of `gate_id` being in the row is to
save that call. Small, and it costs one write at the point the gate id is already being written.

### F-15. "this is the step that takes minutes" is off by an order of magnitude

```
  Sending one lap; this is the step that takes minutes.
```

The first run called this "the only line that turned out to be optimistic", when the lap died in
3.8 s. Now that laps succeed it is wrong the other way: they take **18 to 21 seconds**. The line sets
an expectation that makes a healthy lap look hung and a hung one look healthy. It is prose in a
report, not a budget, and "this is the slow step" says the true part without naming a unit.

Both readings share a cause worth naming: the sentence predicts a duration that nothing measures.

### F-16. Which outcomes `gate close` accepts depends on the stage, and the caller learns it by being refused

Recorded under 10.5. `--outcome` advertises `withdrawn`, `expired` and `unanswerable` in its
`--help`, and then refuses `unanswerable` from `received` because it is reachable only from
`presented`. Both messages are clear and neither is wrong; the gap is that the stage-dependence is
invisible until it fires, and `gate show` already prints the stage that would answer it. This is
continuo's surface and is recorded here because a person walking step 4 will hit it.

### 10.10. Cost

Three real laps, from the terminal `result` event of each session:

| Lap | `total_cost_usd` | api ms | cache creation | cache read | output |
|---|---|---|---|---|---|
| `003` | **0.173145** | 20 649 | 10 614 | 90 226 | 833 |
| `004` | **0.184422** | 16 166 | 10 734 | 110 460 | 831 |
| `005` | **0.167619** | -- | -- | -- | -- |

**About 17 to 18 cents per lap, for a one-line edit and a commit.** The three agree within 10%, so
this is a unit cost rather than a sample.

Set against the first run's probe -- `0.0989` for a one-word reply with no tool use -- the arithmetic
is that **the fence's preamble is most of the bill**. Cache creation is 10 600 tokens in both laps and
barely moves with the work done; what moved between `003` and `004` is cache *read*, 90 k to 110 k,
which is the conversation growing over four extra events. A lap that does real work will cost more
than 18 cents, but it starts from a floor of roughly a dime that is paid before the worker reads
anything.

This is now a number the stack chooses rather than inherits: `modelTier: "standard"` priced to
`claude-opus-5` by `mapModelTier`, and a different pair in that table is a different bill. The pairs
remain **provisional pending an operator's ratification** (`D-0021`), and this section is the cost
evidence that ratification would be deciding on.

### 10.11. Clean-up, and what is left behind

The script's step 7, now with the commands it was missing (F-11):

```
$ node "$CLI" gate list --db "$DB"
no open gates in .../control-plane.sqlite3

$ node "$CLI" run close --db "$DB" --run-id lap1-dogfood-003 --outcome completed --actor-id human/dogfood-operator
closed lap1-dogfood-003 ...: status created -> completed by human/dogfood-operator under writer epoch 1

$ node "$CLI" run close --db "$DB" --run-id lap1-dogfood-004 --outcome cancelled --actor-id human/dogfood-operator     # a second time:
error: run 'lap1-dogfood-004' is already closed as 'cancelled' and does not become 'cancelled'; which
terminal status a run reached is a fact, and a wrong fact is corrected by opening a new run rather
than by re-closing this one
```

All three runs are settled: `003` `completed`, `004` and `005` `cancelled` (their gates were closed
without an answer, so `completed` would have been a wrong fact). **The re-close refusal is worth
keeping in mind while cleaning up** -- it is not idempotent, on purpose.

Left behind on purpose, exactly as D-0010 says: three workspaces under `$S/workspace-*`, and three
topic branches, each shown by `git branch -a` with a `+` because its workspace still has it checked
out:

```
+ dogfood/lap1-dogfood-003
+ dogfood/lap1-dogfood-004
+ dogfood/lap1-dogfood-005
* main
```

No orphaned worker processes: `pgrep -af claude` found none after all three laps, which matches the
report's claim that an answer arriving means the `lap perform` process is over.

### 10.12. Proposed issues

rondo's worker cannot create issues. These are proposed for the secretary to file; each names the
repository it belongs to. **Section 9's issues 1 and 2 are resolved** by `continuo D-0098` / `D-0099`
and rondo `D-0021` and should be closed if they were filed; **issue 3's parts (a) and (b) are
resolved** and **(c) remains**; **issue 4's duplicate-refusal wording and the `pin.mjs` digest are
resolved**, and its session-id-in-prose half survives on the failure path only; **issue 5 is answered
by this section** and should be replaced by issue 6 below.

**6. (rondo) Single-flight holds the lock across the human suspend, and that -- not the lap -- is the
throughput limit.** With one iteration at `awaiting_human`, `admit()` refuses any other in 1 ms:
*"iteration iter-005 is still live, and at most one iteration may be non-terminal at a time."* The
refusal is correct and cheap. The cost is the window: for `iter-003`, 20 883 ms of lap and 104 520 ms
of waiting for a person, so **83% of the iteration's life under the lock was spent blocking on a
human who was answering as fast as a program can** -- a real escalation answered in ten minutes holds
it for ten minutes. rondo#8 / continuo#167 weigh single-flight against throughput; this is the
measurement they were waiting on, and it says the contended resource is the operator's attention
rather than the lap. Proposed: decide whether `awaiting_human` should hold the lock at all, given
that the `lap perform` process has exited, no worker of the iteration is running, and the row is
durable. If it must (the fail-closed argument in the script's own words is that a lap whose outcome
is unknown must not be raced by a second one), then say so against this number rather than against
the lap's 20 seconds.

**7. (rondo) `resume`'s report states the run row is `created` without reading it.**
`src/refrain/interpreter.ts:1516` ends every report with *"The run row is still 'created'"*. It is a
fixed string. After the operator closes the run -- which the dogfood script's step 7 instructs them
to do -- the run is `completed` in the control plane and the report still says `created`, so a reader
concludes there is a run to settle when there is not. The intent, D-0010's *publishing is the
operator's*, is right and should stay. Proposed: state the fact rondo owns ("rondo did not close this
run; nothing was pushed and nothing was landed") instead of a claim about continuo's table, or read
the status and report what it says. Verified against a real close in section 10.9, F-12.

**8. (rondo) The row names the gate but not the stage it is at, for the whole time it is suspended.**
At `awaiting_human` the row has `gate_id` set and `gate_stage`/`gate_outcome` `NULL`, while continuo's
`gate list` reports `stage=received`; `gate_stage` is written only when `resume` reads the gate. So
during the suspend -- 83% of an iteration's life by issue 6's measurement -- a surface reading the row
cannot tell `received` from `presented` without a call to continuo, which is the call `gate_id` in the
row exists to save. Proposed: persist the stage `LAP_PERFORM` already reports, at the same write that
persists `gate_id`. Small; one column already exists.

**9. (rondo) A report line predicts a duration nothing measures.** *"Sending one lap; this is the step
that takes minutes."* The first dogfood found it optimistic when the lap died in 3.8 s; this one finds
it wrong in the other direction, because a lap takes 18 to 21 s. A sentence that names a unit of time
makes a healthy lap look hung and a hung lap look healthy, and rondo has no basis for either figure --
the lap's cost depends on the request, the machine and the model. Proposed: drop the unit ("this is
the slow step"), or say what the ceiling is, which rondo does know because the operator declared it.

**10. (continuo) `gate close`'s accepted outcomes depend on the gate's stage, and `--help` does not
say so.** `--outcome` advertises `withdrawn`, `expired` and `unanswerable`; from `received` the third
is refused with *"outcome 'unanswerable' is reached from ['presented'], not from 'received'"*. Both
the refusal and the exclusion of `answered_and_forwarded` are right. The gap is discoverability: the
stage-dependence is invisible until it fires, and `gate show` already prints the stage that predicts
it. Proposed: name the reachable-from stage beside each outcome in the flag's help. Minor.

**Not proposed: `scripts/dogfood-lap.md` was still wrong in four places and is fixed in the same
change as this record**, on the first run's precedent. The script now says that `invocationCeilingMs`
clears three budgets rather than two and why the third exists, that a model tier rondo cannot price is
refused before the spawn, that `resume` takes `ports` first exactly as `admit` does, how `gate ack`
gets the `message_id` it needs and that the second ack is what closes the gate, that `gate close` is
the other ending and which outcomes it takes, and what the step 7 clean-up commands actually are. Its
"what one run of this actually did" section now points at two runs and leads with the fact that the
lap completes.
