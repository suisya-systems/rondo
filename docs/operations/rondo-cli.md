# The operator's three commands

What a person types to get one request through rondo, from asking for it to publishing it.
Everything here was run on 2026-09-06 against continuo `38c667b5126fdfdc0465e4a422e88b20a8b53044`
(`continuo.pin.json`), and the transcripts are what actually came back.

Before this existed, the same walk meant writing a throwaway `tsconfig`, compiling the tree by hand,
driving the composition root from a hand-written `drive.mjs`, and typing six continuo verbs in order
with ids copied between them (`lap-1-dogfood.md`). That is what these commands replace.

---

## 1. Once per machine

```sh
# rondo itself
npm ci --ignore-scripts
npm run build

# the pinned continuo, which rondo drives as a subprocess because continuo is not published
REV=38c667b5126fdfdc0465e4a422e88b20a8b53044
git clone --quiet --no-checkout https://github.com/suisya-systems/continuo.git "$S/continuo-$REV"
git -C "$S/continuo-$REV" checkout --quiet --detach "$REV"
npm --prefix "$S/continuo-$REV" ci --ignore-scripts
CONTINUO_REQUIRE_REVISION=1 npm --prefix "$S/continuo-$REV" run build

# and the control plane, once
node "$S/continuo-$REV/dist/cli.js" db create --db "$S/control-plane.sqlite3"
```

`rondo` verifies that build's `--version` against the pin on every command and refuses a mismatch or
a `-dirty` tree, so a stale continuo is a refusal rather than a wrong answer.

## 2. Three environment variables

```sh
export RONDO_CONTINUO_CLI="$S/continuo-$REV/dist/cli.js"   # the built CLI above
export RONDO_STORE="$S/rondo-iterations.sqlite3"           # rondo's own database; created on first use
export RONDO_APPROVER=happy_ryo                            # the one identity allowed to answer or publish
```

`RONDO_STORE` is a **second** database, separate from continuo's control plane. rondo's iteration
rows are rondo's; the run, gate and relay rows are continuo's.

## 3. The plan file

The one file an operator writes, and they write it once per project rather than once per run. It is
`planPayload`'s own JSON -- the same shape rondo stores in the `plan` column -- so **the `plan`
column of any past iteration row is a valid plan file**. `readPlan` validates all thirty-two fields
and refuses by field name.

Four values change per run and have flags, so the file itself does not have to be edited to start a
second lap: `--run-id`, `--topic-branch`, `--workspace`, `--prompt`.

A complete working example is in [`../../.worker-scratch`-shaped form below]; every path must be
absolute, and `invocation_ceiling_ms` must be **strictly greater** than
`turn_timeout_ms + git_timeout_ms + identity_readback_timeout_ms`.

```json
{
  "db": "/abs/control-plane.sqlite3",
  "run_id": "cli-lap-001",
  "lease_claimant_id": "rondo-operator",
  "workspace": "/abs/workspace-cli-lap-001",
  "base_branch": "main",
  "topic_branch": "dogfood/cli-lap-001",
  "prompt": "Append one line to docs/NOTES.md reading exactly: 'Touched by the rondo operator CLI.' Then commit it with the message 'docs: touched by the rondo operator CLI'. Do nothing else.",

  "repository": "/abs/target",
  "artifact_root": "/abs/artifacts",
  "state_root": "/abs/session-state",
  "interlock_root": "/home/happy_ryo/work/org/workers/interlock",
  "claude_org_path": "/home/happy_ryo/work/org/claude-org-ja",
  "endpoint_recipient": "external-notify",
  "endpoint_destination_dir": "/abs/dropbox",
  "claude_command": ["/home/happy_ryo/.local/bin/claude"],

  "endpoint_db": null,
  "endpoint_module": null,
  "node": "/abs/path/to/node",
  "hook_script": null,
  "python": null,
  "poll_interval_ms": null,

  "turn_timeout_ms": 900000,
  "git_timeout_ms": 60000,
  "identity_readback_timeout_ms": 120000,
  "invocation_ceiling_ms": 1800000,

  "gate_options": ["approve", "revise"],
  "gate_deadline_at_ms": null,

  "catalog_layers": [
    {
      "layer": "tracked",
      "origin": "/abs/catalog/projects.toml",
      "base_dir": "/abs/catalog",
      "data": {
        "schema_version": 1,
        "catalog": { "allowed_local_roots": ["/abs"] },
        "project": {
          "dogfood-target": {
            "source": { "kind": "local_path", "path": "/abs/target" },
            "base_branch": "main",
            "aliases": []
          }
        }
      }
    }
  ],
  "project_name": "dogfood-target",

  "agent_type_input": {
    "agentTypeId": "worker-basic",
    "vocabularyVersion": 1,
    "granted": ["command.run"],
    "askable": ["branch.push"],
    "loopPolicy": { "maxReviewRounds": 2, "noProgressWindow": 3, "noProgressRepeat": 2 },
    "executorPolicy": { "roleName": "worker", "modelTier": "standard", "reportingDuties": [] }
  },
  "parties": { "issuer": "rondo-cli", "grantee": "cli-lap-001" },
  "intended_action": { "capabilities": ["command.run"] }
}
```

`parties.grantee` must equal `run_id`. **The CLI rewrites it for you** whenever `--run-id` is
given, so overriding the run id on the command line cannot leave the two disagreeing -- which
previously cost a whole iteration, because cadenza answers a mismatch as an *answered*
classification rather than a refusal.

---

## 4. Start -- take one request and run a lap

```console
$ node bin/rondo.mjs start --plan "$S/plan.json"
plan ok: 32 fields
continuo verified at revision 38c667b5126fdfdc0465e4a422e88b20a8b53044
starting iteration 'cli-lap-001'; the lap is the step that is slow
iteration 'cli-lap-001' is awaiting_human
  Reserved iteration cli-lap-001 at 'planned'.
  cadenza allowed the action (granted); the three digests are committed.
  continuo build verified at revision 38c667b...; run id cli-lap-001 and that revision are committed before anything is spawned.
  continuo admitted run cli-lap-001 at status 'created' under role 'worker' (neutral name 'worker').
  Sending one lap; this is the step that takes minutes.
  The lap answered. Gate gate/worker_escalation/2d6d4fd5-.../0 is already open; session 2d6d4fd5-... was started.
  The conductor is suspending here. There is no timer and no poll loop, and the process may exit; call resume() once a person has answered the gate.

A person has to answer this before anything lands. Next: rondo answer
```

**22.8 seconds**, measured. The process exits and the gate stays open; there is no daemon to leave
running. The iteration id defaults to the run id -- rondo allocates nothing.

## 5. Answer -- see what is waiting, and answer it

With no `--body`, it reads:

```console
$ node bin/rondo.mjs answer
iteration 'cli-lap-001' is awaiting_human
run     cli-lap-001
gate    gate/worker_escalation/2d6d4fd5-.../0  (worker_escalation)  stage 'received'
why     Done. Appended the line to `docs/NOTES.md` and committed as `68f7067` on `dogfood/cli-lap-001`.
options ["approve", "revise"]

to answer:
  rondo answer --actor-id YOU --body="your answer"
```

`why` is the worker's own words, relayed rather than summarised. `options` is printed as the text
continuo carries; rondo does not parse it.

With a `--body`, it drives all six continuo verbs and settles the iteration:

```console
$ node bin/rondo.mjs answer --actor-id happy_ryo --body=approve
gate gate/worker_escalation/2d6d4fd5-.../0 is at stage 'received'
  gate present   message relay/gate/.../presented (enqueued: true)
  gate deliver   1 message(s) to 'external-notify' (epoch 2)
  gate ack       stage is now 'presented'
  gate answer    forwarded relay relay/gate/.../forwarded (advanced: true)
  gate deliver   1 message(s) to 'external-notify' (epoch 3)
  gate ack       stage is now 'forwarded', and the gate is closed
iteration 'cli-lap-001' is closed
  Gate ... reached outcome 'answered_and_forwarded' at stage 'forwarded'.
  Iteration cli-lap-001 is closed.
  Gate outcome: answered_and_forwarded.
  Run id: cli-lap-001; continuo revision: 38c667b...
  The run row is still 'created'. Nothing was pushed, nothing was landed, and publishing this work is the operator's, not rondo's (D-0010).

Next: rondo publish --iteration-id cli-lap-001 --repo OWNER/NAME --actor-id happy_ryo
```

**1.3 seconds**, measured. Write `--body=` with an equals sign: an answer may legitimately begin
with a dash, and Node's argument parser will not guess.

The answer is carried **byte for byte**. rondo does not trim, reflow, template or summarise it; the
ASCII escaping applies to what rondo *prints*, never to what it sends.

**Answering twice is safe.** The walk reads the stage continuo reports and resumes from it rather
than replaying from the start, so a half-finished walk can simply be run again. A gate that already
has an outcome is not walked at all, and says so.

## 6. Publish -- push the branch, open the pull request, close the run

```console
$ node bin/rondo.mjs publish --iteration-id cli-lap-001 --repo OWNER/NAME --actor-id happy_ryo --dry-run
iteration 'cli-lap-001' is closed; gate outcome 'answered_and_forwarded'

publish runs these three, in order, as you:
  1. git -C /abs/workspace-cli-lap-001 push origin dogfood/cli-lap-001
  2. gh pr create --repo OWNER/NAME --base main --head dogfood/cli-lap-001
  3. continuo run close --run-id cli-lap-001 --outcome completed

--dry-run: nothing was run.
```

Drop `--dry-run` to run them. They go in order and stop at the first failure, because each is the
next one's precondition: there is no pull request to open for a branch that did not push, and
closing the run is a claim that the work landed.

**What publish is, and is not.** Every value above comes from the plan the iteration already
carries; `--repo` is the one flag, because the forge slug is the single fact about publishing that
no `RunPlan` field holds. `--remote` defaults to `origin`.

rondo **never merges**, and nothing here runs unless a person typed `publish`: no other command in
the tree reaches the module that can start a process, and that module is the only one granted a
spawn -- which `test/architecture/import-boundaries.test.ts` checks with a planted violation rather
than asserting in prose. The credential used is the operator's own `git` and `gh` configuration,
which rondo neither stores nor reads.

**Closing the run is not idempotent, on purpose.** continuo refuses a second close: which terminal
status a run reached is a fact, and a wrong one is corrected by opening a new run.

## 7. When something is stuck

`abandon` is the only way out of a row holding the single-flight lock with nothing able to release
it -- a lap that never answered, or a row a restart found mid-effect.

```console
$ node bin/rondo.mjs abandon --iteration-id cli-lap-001 --reason "the host was killed mid-lap"
```

It writes a terminal record and **drives no continuo verb**, because there is none here that is
rondo's: if a gate is still open, closing it is yours, and if the run is still open, closing it is
yours.

| What you see | What it means | What to do |
|---|---|---|
| `iteration <id> is still live, and at most one iteration may be non-terminal at a time` | Single-flight. Something is unfinished. | `rondo answer` to see it, or `abandon` it. |
| `continuo gate deliver refused (LeaseHeld)` | A lap holds the global delivery lease. | Wait; the lease is 60 s. |
| `continuo is not usable: ...` | The build is not the pinned revision, or is dirty. | Rebuild the pinned continuo (section 1). |
| `RONDO_APPROVER is not set` | rondo will not act for an unnamed person. | Export it. |
| `No iteration is live` on `publish` | Answering closed the iteration, so it is no longer live. | Pass `--iteration-id`, which the `answer` output prints for you. |

---

## 8. What has and has not been walked on real infrastructure

Recorded so that "it works" is not read more broadly than it was tested.

- **`start` and `answer`: walked end to end**, on the pinned continuo with a real `claude -p` worker.
  The worker did the work it was asked to do -- commit `68f7067` on `dogfood/cli-lap-001` really
  appends the line -- the gate opened at `received`, six verbs closed it `answered_and_forwarded`,
  and the iteration reached `closed` with the lock released.
- **`publish`: exercised as far as this worker may go.** `--dry-run` computes all three legs
  correctly from the stored plan, and the legs themselves are covered by unit tests. The push and
  the pull request were **not** executed here, because this repository's worker environment blocks
  pushing and pull-request creation by design -- those are the operator's, which is the same
  boundary the command itself is built around. The first operator to run it without `--dry-run` is
  what closes this gap.
- After the walk, continuo's run row was still `created` and rondo's row still recorded no publish,
  which is the correct state for work that was approved but not yet submitted.
