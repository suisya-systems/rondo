# The operator's ten commands

What a person types to get one request through rondo, from asking for it to publishing it -- and,
in section 7, `abandon`, which is how a request that cannot get there is settled instead, and
`explain`, which is how a person finds out what the store holds about a row that has stopped, and
`elevate`, which is how an observation of the operator's own becomes part of the record.
Section 5.1 is `revise`, which is what a person types when the answer to the gate is "not quite".
Everything here was run on 2026-09-06 against continuo `38c667b5126fdfdc0465e4a422e88b20a8b53044`
(`continuo.pin.json`), and the transcripts are what actually came back.

Before this existed, the same walk meant writing a throwaway `tsconfig`, compiling the tree by hand,
driving the composition root from a hand-written `drive.mjs`, and typing six continuo verbs in order
with ids copied between them (`lap-1-dogfood.md`). That is what these commands replace.

---

## 0. The one-command path

Sections 1 to 3 are the setup as an explanation. [`scripts/dogfood-env.sh`](../../scripts/dogfood-env.sh)
is the same setup as a command, for when you want the environment rather than the reasoning:

```sh
scripts/dogfood-env.sh --root /abs/where/the/environment/lives
```

`--root` is optional; it defaults to `.worker-scratch/dogfood-env`, which `.gitignore` already
excludes -- an environment is a continuo clone, two SQLite databases, a worktree and captured
session output, and none of that is a thing to stage by accident.

It builds rondo, clones and builds the pinned continuo, creates the control plane, creates a scratch
target repository with a `main` branch to run laps against and a bare repository beside it as that
target's `origin`, writes a complete `plan.json` and an `env.sh` holding section 2's three exports --
and then prints the commands below with the real paths filled in. It **never runs a lap**:
everything it does is free, and `start` is the line that is not.

**It cannot demonstrate `publish` to the end, and it says so.** The bare `origin` makes the push leg
real -- it is an ordinary push to an ordinary repository. The pull-request leg is not reachable from
here at all: a bare repository on disk is not a forge, no `OWNER/NAME` names it, and there is
nothing for a pull request to be created against. Section 6 is the preflight that turns this from a
plan that fails halfway into a refusal you get before anything runs.

Re-running it is safe; every step checks for its own result first and repairs only what is missing.
The three site paths it cannot discover -- the interlock checkout, the claude-org checkout and the
worker CLI -- have defaults and `RONDO_DOGFOOD_*` overrides, and it fails by name rather than
guessing when one is absent. `--help` lists them.

If you would rather do it by hand, or want to know what that script is doing, read on.

## 1. Once per machine

`$S` below is one directory you choose; everything the setup writes lives under it. It has to exist
before the first command, and so do the four directories in section 3's plan (`artifacts`,
`state_root`, the dropbox and the catalog dir): **no continuo verb creates a directory**, and a
missing one is an error from inside a lap rather than at setup.

```sh
S=/abs/where/the/environment/lives
mkdir -p "$S" "$S/artifacts" "$S/session-state" "$S/dropbox" "$S/catalog"

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

**`db create` refuses a path that already exists**, on purpose -- it will not adopt somebody else's
schema -- so the last line is the one that fails on a second run. That is not a problem to solve; it
is the reason the script guards it rather than re-running it.

**You also need a repository a lap may touch**, with the plan's `base_branch` already present and at
least one commit on it. A lap materialises a worktree from it and cuts the topic branch; an empty
repository has no `main` to cut from. The script creates a scratch one for exactly this reason.

## 2. Three environment variables

```sh
export RONDO_CONTINUO_CLI="$S/continuo-$REV/dist/cli.js"   # the built CLI above
export RONDO_STORE="$S/rondo-iterations.sqlite3"           # rondo's own database; created on first use
export RONDO_APPROVER=happy_ryo                            # the one identity allowed to answer or publish
```

`RONDO_STORE` is a **second** database, separate from continuo's control plane. rondo's iteration
rows are rondo's; the run, gate and relay rows are continuo's. It must be an **absolute** path and
must not be `:memory:` -- each command is a separate process, so a row that does not outlive one is
a lap that ran, cost money, and then vanished. rondo refuses both by name.

## 3. The plan file

The one file an operator writes, and they write it once per project rather than once per run. It is
`planPayload`'s own JSON -- the same shape rondo stores in the `plan` column -- so **the `plan`
column of any past iteration row is a valid plan file**. A row names three fields a plan file has no
reason to carry (`run_id`, `topic_branch`, `workspace`; see below), and carrying them costs nothing:
rondo reads the keys it names and ignores the rest, so a copied row is used exactly as it came.
`readRunPlan`
validates every field of a plan file and refuses by field name; `readPlan` validates a stored
payload.

**The payload carries its own version** (`D-0028`). `payload_version` says which shape the bytes
are, and reading climbs an ordered ladder of steps from that version to the one this rondo
understands -- in memory, on the way *out* of the store. The row itself is never rewritten, because
the `plan` column is persisted verbatim beside a digest of its own bytes (`D-0019` rule 4). Three
things follow, and they are the whole of what an operator needs to know:

- **A document with no `payload_version` is version 0**, which is every row rondo wrote before
  `D-0028` and every plan file anybody has typed. Two keys may be absent from a version 0 document
  and are supplied by the ladder: `pull_request_base_branch`, which reads as null and which only
  `revise` ever sets (see 5.1), and `workspace_root`, which is derived from the stored workspace's
  parent -- and only for a document that carries a `workspace`, which a plan file may not (see
  below), so **an operator who omits `workspace_root` is still refused by name** rather than handed
  a directory they did not name.
- **A document that declares a version is held to it.** At version 1 every field is required,
  including `pull_request_base_branch`. So a hand-written plan file is easiest left without the key
  -- it is then a version 0 document and needs nothing -- and a file copied out of a `plan` column
  is used exactly as it came.
- **A payload from a newer rondo is refused by name**, saying which version the bytes declare and
  which this rondo reads. That is the case a per-field tolerance could not express: without a
  version, bytes written by a newer rondo would be read as though they were current.

**Three fields the plan file used to carry are gone** (`D-0023`): `run_id`, `topic_branch` and
`workspace`. rondo derives all three from the iteration id now, so a plan file cannot name them and
there is no flag to override them. What replaces them is one `workspace_root` -- the directory the
workspaces are cut under. Two values change per run and have flags:
`--iteration-id` and `--prompt`.

A complete working example follows, and [`scripts/dogfood-env.sh`](../../scripts/dogfood-env.sh)
generates one filled in for the machine it runs on. Every path must be absolute, and
`invocation_ceiling_ms` must be **strictly greater** than
`turn_timeout_ms + git_timeout_ms + identity_readback_timeout_ms`.

**`node` is the trap in this file.** It is the interpreter the fenced endpoint runs under, so it must
be the interpreter's own installed path -- not what `command -v node` prints on a machine with a
version manager, which is a per-shell shim directory that will not exist for the child. Resolve it
(`node -e 'console.log(require("node:fs").realpathSync(process.execPath))'`) rather than copying the
shim.

```json
{
  "db": "/abs/control-plane.sqlite3",
  "workspace_root": "/abs/workspaces",
  "base_branch": "main",
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
  "pull_request_base_branch": null,

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
  "parties": { "issuer": "rondo-cli", "grantee": "rondo-allocates-this" },
  "intended_action": { "capabilities": ["command.run"] }
}
```

`parties.grantee` must equal the run id, and **the run id is no longer yours to write**
(`D-0023` rule 9). Whatever you put in `grantee` is overwritten with the run id rondo derived, so
the field is a placeholder that exists only because cadenza's type requires it. It cannot drift,
which is the point: cadenza answers a grantee mismatch as an *answered* classification rather than
a refusal, so a disagreement used to cost a whole iteration.

**What rondo derives, from `--iteration-id ID`:**

| Value | Derived as |
|---|---|
| run id | `rondo-ID` |
| topic branch | `rondo/ID` |
| workspace | `<workspace_root>/iter-ID` |
| `lease_claimant_id` | `rondo-ID` |

`ID` must be a lowercase letter followed by up to 63 more of `[a-z0-9_-]`, and it is refused before
any row is written. The `iter-` prefix on the workspace is not decoration: `con`, `nul`, `aux` and
`com1` are legal iteration ids and are reserved device names on Windows, where a bare directory of
that name cannot be created.

**More than one iteration can be open at once.** An iteration waiting at its gate holds no worker,
so it does not occupy an execution slot and a second `start` is accepted beside it.
`RONDO_MAX_LIVE` bounds how many may be open at once (default 3) and `RONDO_MAX_OCCUPYING` how many
may be *executing* (default 1; raising it needs continuo to allow a second concurrent lap first).
When more than one is open, `answer` needs `--iteration-id ID` to say which one you mean -- it
refuses and lists them rather than picking.

---

## 4. Start -- take one request and run a lap

```console
$ node bin/rondo.mjs start --plan "$S/plan.json" --iteration-id cli-lap-001
plan ok: 30 fields
continuo verified at revision 38c667b5126fdfdc0465e4a422e88b20a8b53044
starting iteration 'cli-lap-001'; the lap is the step that is slow
iteration 'cli-lap-001' is awaiting_human
  Reserved iteration cli-lap-001 at 'planned', holding run id rondo-cli-lap-001, branch rondo/cli-lap-001 and workspace /abs/workspaces/iter-cli-lap-001.
  cadenza allowed the action (granted); the three digests are committed.
  continuo build verified at revision 38c667b...; run id rondo-cli-lap-001 and that revision are committed before anything is spawned.
  continuo admitted run rondo-cli-lap-001 at status 'created' under role 'worker' (neutral name 'worker').
  Sending one lap; this is the step that takes minutes.
  The lap answered. Gate gate/worker_escalation/2d6d4fd5-.../0 is already open; session 2d6d4fd5-... was started.
  The conductor is suspending here. There is no timer and no poll loop, and the process may exit; call resume() once a person has answered the gate.

A person has to answer this before anything lands. Next: rondo answer
```

**22.8 seconds**, measured. The process exits and the gate stays open; there is no daemon to leave
running. The iteration id has no default and is the only identifier you type: rondo mints the run
id, the topic branch and the workspace from it (`D-0023`).

**A second `start` while this one waits is accepted**, which is what `D-0023` delivers. Measured on
the same machine, two laps run one after the other: with `dogfood-001` suspended at its gate,
`dogfood-002` was admitted and performed, and the store read `live=2, occupying=1` while it did --
two iterations open, one worker running. Setting `RONDO_MAX_LIVE=1` refuses the same command in
about a millisecond, writes no iteration row, and records one demand row.

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

### 5.1 Revise -- answer with a change, and run a second lap

`options` has said `["approve", "revise"]` since the first walk, and until `D-0027` the second word
did nothing: `answer` carried it, the gate closed the same way, and the only thing left to do was
write a new plan file by hand. `revise` is the other way to answer a gate.

```console
$ node bin/rondo.mjs revise --actor-id happy_ryo \
    --body="Not quite. The line you added should read exactly: 'Touched twice by the rondo operator CLI.' Change that one line and commit it. Do nothing else." \
    --iteration-id revise-004
gate gate/worker_escalation/7ddacc1b-.../0 is at stage 'received'
  gate present   message relay/gate/.../presented (enqueued: true)
  ... the same six verbs `answer` drives ...
iteration 'revise-003' is closed
  Gate ... reached outcome 'answered_and_forwarded' at stage 'forwarded'.

revising as iteration 'revise-004', cut from 'dogfood/revise-003'
the lap is the step that is slow
iteration 'revise-004' is awaiting_human
  Reserved iteration revise-004 at 'planned'.
  It is a revision of iteration revise-003, and the row records that rather than leaving it to be inferred from the branch names.
  ...
A person has to answer this before anything lands. Next: rondo answer
```

**The one identifier is yours, and it must be new.** continuo holds a run under the first lap's id,
git holds its branch, and a worktree stands at its workspace; its materialiser requires a topic
branch that does not already exist and a workspace path that does not exist. You name only the
successor's `--iteration-id`: rondo derives the run id, the topic branch and the workspace from it
(`D-0023` rule 9), so there is no flag to type them. An id whose derived triple collides with
something that already exists is refused, with the reason, before the gate is touched.

**What carries the work across is the branch, and rondo sets that for you.** The second lap's
`base_branch` is the first lap's `topic_branch`, so git cuts the second worktree from the first
lap's commits and the second worker edits that work rather than repeating it. In the walk above the
second worker said so itself:

> Continued from the previous lap's commit rather than restarting: `docs/NOTES.md:4` now reads
> `Touched twice by the rondo operator CLI.`, committed as `def1894` on `dogfood/revise-002`.

**The succession is on the row, not only in the branch names** (`D-0030`). The second lap's row
carries `supersedes_iteration_id`, written when it is reserved and never afterwards, so "this lap
revised that one" is a record rather than something you infer from a base branch that happens to
look like somebody's topic branch. You see it in three places, and only on a lap that has one:

- `rondo revise` says `It is a revision of iteration <id>.` under the reservation line.
- `rondo answer` prints a `revises <id>` line above the gate.
- the pull request body's `## How this got here` says
  `- It revises iteration \`<id>\`, whose commits are on this branch too: ...`.

A database written before `D-0030` gains the column on the next open and reads null on every row,
which is the truth about those rows: `revise` had nowhere to write a predecessor, so none of them
records one. Nothing back-fills it from the branch names -- that would be recording the guess this
column exists to replace.

**The pull request still goes against the original base.** The predecessor's branch is local and
nothing pushes it, so `publish` on a revised iteration prints `--base main`, not
`--base dogfood/revise-003` -- the plan carries both branches for exactly this reason. The pushed
branch has every lap's commits on it, so one pull request shows the whole request.

**Everything else is the first lap's plan, verbatim**, with the instruction appended to the prompt
after the original request. rondo composes no part of what a person wrote: continuo gets the
instruction byte for byte as the gate's answer, and the prompt gets it byte for byte too.

**Nothing here happens on its own.** A revision is a person typing the command; there is no retry
loop, no bound to reach, and no path into `revise` that does not start with a keyboard. Revise as
many times as the work needs -- each one costs a lap.

Everything `revise` can refuse, it refuses before it touches the gate, because a walked gate cannot
be taken back: a plan whose identifiers will not validate, a successor id the store already holds, a
topic branch git says exists, a workspace path that is already there, a gate continuo has closed
already -- and a run id continuo's control plane already holds, which rondo asks `run show` about
(`D-0031`). That last one matters when rondo's store and the control plane have drifted apart: a
store that was rebuilt or replaced, or a `--db` naming a different database, can leave a run
standing under a name rondo believes is free. If the check cannot get an answer -- continuo refuses,
the database will not open -- `revise` proceeds anyway and the collision is discovered by
`run admit` as it was before, which is the loud failure it has always been rather than a new refusal
invented from an unread reply.

One more thing is refused there and is worth its own sentence: a plan carrying a
`gate_deadline_at_ms`. It is an instant rather than a duration, so the first lap's is already behind the second one; rondo
will not carry it forward and will not pick a new one, because how long a person has to answer is
yours to declare. Set it and use `start`.

## 6. Publish -- push the branch, open the pull request, close the run

```console
$ node bin/rondo.mjs publish --iteration-id cli-lap-001 --repo OWNER/NAME --actor-id happy_ryo --dry-run
iteration 'cli-lap-001' is closed; gate outcome 'answered_and_forwarded'

publish runs these three, in order, as you:
  1. git -C /abs/workspace-cli-lap-001 push origin dogfood/cli-lap-001
  2. gh pr create --repo github.com/OWNER/NAME --base main --head dogfood/cli-lap-001
  3. continuo run close --run-id cli-lap-001 --outcome completed

the pull request it opens reads:
  title: docs: record the first real lap in the operator runbook
  body:
    ## What changed

    - `8ee604b` docs: record the first real lap in the operator runbook

    1 file changed against `refs/heads/main`:

    - `docs/operations/rondo-cli.md` (+1 -0)

    ## How this got here

    - rondo walked run `cli-lap-001` (iteration `cli-lap-001`) on `dogfood/cli-lap-001`, for `main`.
    - Gate `g-9f2c1a` closed `answered_and_forwarded`: a person answered it, and the answer was carried through.
    - Against continuo `603843b`, on `claude-opus-5` (tier `standard`).
    - Session `sonorous-lap-7`.

    <details>
    <summary>The request this lap was given (written for the agent, not a description of the change)</summary>

    ```
    Append exactly one line to the end of docs/operations/rondo-cli.md, recording that the
    first real lap ran.

    Do not build. Do not lint. Do not push. Do nothing else.
    ```

    </details>

    This pull request was opened by `rondo publish`, which an operator ran. Merging it is not.

--dry-run: nothing was run.
```

Drop `--dry-run` to run them. They go in order and stop at the first failure, because each is the
next one's precondition: there is no pull request to open for a branch that did not push, and
closing the run is a claim that the work landed.

**The pull request is written for a person, and the title and body are printed before either is
used.** The title is the lap's own first commit subject -- one more commit adds `(+N more commits)`
rather than a summary of them -- and the body is what changed (the commits, the paths, the line
counts, and the ref they were compared against), how it got here (run, iteration, gate outcome,
continuo revision, model, session) and the
sentence that says merging is still yours. The request the lap was given is *quoted input*, folded
into a `<details>` and fenced, because it is a set of instructions written to an agent: on
2026-09-06 the first real publish put it in both fields, so the title was the prompt cut off with an
ellipsis and the body opened with "do not build, do not lint, do not push" where an account of the
change belongs. When git cannot be read in the workspace at all, the body says so in place of the
summary and keeps every provenance line; the title falls back to `<branch> (rondo run <id>)`, which
is a label rather than a sentence that stops in the middle of itself.

**Nothing above is printed until the workspace has been asked whether it can run.** Before the plan
appears -- and whether or not `--dry-run` was given -- `publish` asks the workspace three questions,
and refuses with exit 2 on any of them:

1. **Is the push remote there?** A workspace with no `origin` cannot run `git push origin <branch>`.
   This is the defect the checks exist for: on 2026-09-06 a `--dry-run` printed a push for a
   workspace that had no remotes at all, and a preview whose purpose is to catch a mistake before
   the real run printed one as though it would work.
2. **Is the topic branch there?** The plan says the lap committed on it; a workspace that no longer
   has it has nothing to push.
3. **Do the push remote and `--repo` name the same repository?** The push goes to the workspace's
   remote and the pull request is opened against `--repo`, so when the two are unrelated the branch
   lands somewhere the pull request does not look. The host counts, and so does every destination:
   `https://gitlab.com/OWNER/NAME` is a different repository wearing the same name as
   `OWNER/NAME` on github.com, and `remote.<name>.pushurl` may name several places at once, all of
   which receive the branch and all of which are therefore checked. A credential embedded in a
   push URL is redacted before any of these messages print it.

The host the check compares against is the one `GH_HOST` names, and github.com when it is unset --
the same rule the forge CLI uses. **rondo then passes that host on the command line**
(`--repo HOST/OWNER/NAME`), so the repository the pull request is opened in is the one the check
agreed about rather than one resolved a second time from the CLI's own configuration. Set `GH_HOST`
for an enterprise host and both halves move together.

The checks run identically with and without `--dry-run`, on purpose: a preview that passes where the
real run would fail is the same defect in a quieter form.

**`--allow-remote-mismatch` is the named way past the third one.** Pushing to a fork and opening the
pull request upstream is a legitimate way to work, so a mismatch is a refusal with an override
rather than a hard equality. With the flag, the head is spelled `owner:branch` using the owner the
push actually reaches -- a bare branch name is read as a branch of `--repo`, which is not where the
push went. When the remote is not a forge repository at all (a local bare repository, as in the
dogfood environment) there is no owner to qualify with, so the head stays bare and rondo says in one
line that the pull-request leg should be expected to fail.

**What publish is, and is not.** Every value above comes from the plan the iteration already
carries; `--repo` is the one flag, because the forge slug is the single fact about publishing that
no `RunPlan` field holds. `--remote` defaults to `origin`.

rondo **never merges**, and nothing here runs unless a person typed `publish`: no other command in
the tree reaches the module that can start a process, and that module is the only one granted a
spawn -- which `test/architecture/import-boundaries.test.ts` checks with a planted violation rather
than asserting in prose. The credential used is the operator's own `git` and `gh` configuration,
which rondo neither stores nor reads.

**Only work a person actually approved can be published.** `withdrawn`, `expired` and
`unanswerable` all close a gate, and `publish` refuses every one of them by name: a closed gate is
not an approval, and the pull request's body says a human approved this.

**If the pull request leg fails, the push has already happened.** rondo does not persist how far a
publish got, so it prints the one remaining leg -- the `run close` -- for you to run. Re-running
`publish` is safe for the push (git answers "Everything up-to-date") but will be refused for a pull
request that already exists.

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
| `Refused: 1 of a permitted 1 iterations are already executing on this host` | A lap is running. The bound is `RONDO_MAX_OCCUPYING`, which is 1 until continuo allows a second concurrent lap. | Wait for it, or `abandon` it. An iteration merely *waiting at a gate* does not count here. |
| `Refused: 3 of a permitted 3 iterations are already open on this host` | Three iterations are unfinished, most likely waiting on you. The bound is `RONDO_MAX_LIVE`. | `answer` them, `abandon` them, or raise `RONDO_MAX_LIVE`. |
| `Refused: 2 of a permitted 1 ... more than the bound rather than equal to it` | Expected, not corruption: an iteration already counted re-entered the executing set without a new admission. | Nothing. It drains as those iterations end; no further admission is accepted meanwhile. |
| `the iteration id '<id>' is not a rondo identifier` | rondo derives the run id, branch and workspace from it, so it must be `[a-z][a-z0-9_-]{0,63}`. | Pick a conforming id. Nothing was written. |
| `N iterations are live, so "the live one" does not name anything` | More than one is open, which is now normal. | Re-run with `--iteration-id ID`; the message lists them. |
| `continuo gate deliver refused (LeaseHeld)` | A lap holds the global delivery lease. | Wait; the lease is 60 s. |
| `continuo is not usable: ...` | The build is not the pinned revision, or is dirty. | Rebuild the pinned continuo (section 1). |
| `RONDO_APPROVER is not set` | rondo will not act for an unnamed person. | Export it. |
| `No iteration is live` on `publish` | Answering closed the iteration, so it is no longer live. | Pass `--iteration-id`, which the `answer` output prints for you. |
| `closed at gate outcome 'withdrawn'` on `publish` | The gate ended without a person answering it. | Nothing to publish; the work was not approved. |
| `has no remote 'origin'` on `publish` | The workspace cannot push where the plan says. The refusal lists the remotes it does have. | Name one that is there with `--remote NAME`, or add the remote to the workspace. |
| `has no branch '<topic>'` on `publish` | The branch the lap committed on is gone from the workspace. | There is nothing to publish from that workspace. |
| `would not be about the same repository` on `publish` | The push remote and `--repo` are different repositories. | If that is deliberate (a fork), pass `--allow-remote-mismatch`; otherwise fix `--repo` or `--remote`. |
| `--repo is '<x>', and it must be OWNER/NAME` | `--repo` is passed to the forge unchanged. | Spell it `owner/name`. |
| `was not abandoned` (exit 2) | The row was absent, or the store refused the write. | The lock, if it was held, is still held. Read the row before trying again. |

### 7.1 Explain -- what the store holds about one iteration, and what each claim rests on

`abandon` ends a row; `explain` is how you find out what it was. It reads rondo's own rows, drives
**no continuo verb** and starts no process, so it reaches the row that is stuck behind a continuo
that will not start -- and the row it is most useful on has already ended, which is why
`--iteration-id` is required and has no "the live one" default.

```console
$ node bin/rondo.mjs explain --iteration-id cli-lap-001
explanation of iteration 'cli-lap-001'
  drafter: rondo/advisory/deterministic; derivation: store_rows
  this explanation binds nothing: it is not a proposal and cannot be approved
  request: teach revise to name the flags it takes
      basis: snapshot /iteration/request = "teach revise to name the flags it takes"
  status: abandoned
      basis: snapshot /iteration/status = "abandoned"
  revision of: none
      basis: snapshot /iteration/supersedesIterationId = null
  ...
  continuo revision: undetermined
      basis: snapshot /iteration/continuoRevision = null
recorded as proposal 'explanation-cli-lap-001-1757500000000'
```

Three properties of that output are the point rather than the formatting:

- **every claim carries what it rests on**, on the line under it, **and the material with it**. The
  pointer is into the snapshot the proposal row keeps verbatim and the value beside it is what that
  pointer resolves to, so a claim is checked against the row rather than against itself;
- **a field the row does not settle reads `undetermined` rather than going missing**, and one the row
  settles negatively reads `none`. "rondo looked and the column is null", "there is no predecessor"
  and "rondo did not look" must not be the same thing on the screen;
- **it binds nothing.** An explanation is not a proposal, cannot be approved, and the store refuses
  an answer that names one (`D-0032` rule 5).

It records what it said before it prints it: a framing a person read and the ledger does not hold is
the failure the record exists to prevent, so if the row cannot be written, nothing is shown. After it
prints, it counts the explanation as **presented** -- that table is the only place the number of
things put to you comes from, and answers are counted elsewhere (`D-0032` rule 10).

| What you see | What it means | What to do |
|---|---|---|
| `explain needs --iteration-id ID` | There is no default, deliberately: the row worth explaining is usually not the live one. | Name the iteration. `answer` and `start` both print the id. |
| `There is no iteration '<id>' in this store` | No such row, or `RONDO_STORE` names a different database. | Check the id and `RONDO_STORE`. Nothing was written. |
| `is in the store and will not decode` | The row is corrupt, so nothing about it can be cited. | The refusal carries the store's own reason; the row needs a person, not a second explanation. |
| `was composed and not recorded, so it is not being shown` | The proposal row could not be written. | Fix the store fault the message names; nothing was presented and nothing was kept. |
| `was shown and was not counted as presented` (exit 1) | You read it and the proposal was kept, but the presentation count could not be written. | Nothing to re-read. The breakdown of what was put to you is short by one until the store fault the message names is fixed. |

### 7.2 Propose and decide -- what a retry could run under, and answering it

`explain` says what the store holds and binds nothing. `propose` is the other voice: it puts an
**option set** in front of you -- with exactly one recommended -- and each option names the
**contract that retry would run under**, composed for the successor identity you name. `decide`
records your answer.

`--kind` picks the question, and there is no default because the three ask different things:

| `--kind` | The question | The options |
|---|---|---|
| `run_plan` | Which plan does the retry run? | The iteration's own plan and the one it superseded |
| `agent_type` | Which agent type does it run under? | The agent types those same iterations ran under |
| `contract_keys` | Which keys does that agent type carry as **granted** rather than askable? | Leave them as they are, plus one option per askable key promoted |

Two rules run through all three:

- **The recommendation never widens.** It is always the row's own plan, agent type and key set. A
  widening is something you reach for, never something you get by taking the default.
- **The alternatives stop one generation back**: a row five revisions deep would otherwise offer five
  options, four of them already superseded for reasons you acted on, and the set of alternatives is
  the framing rather than a menu. An older ancestor is still readable with `explain`, and can be
  proposed by naming that iteration instead.

`contract_keys` promotes **one key at a time, and only a key the agent type's own author already
listed as askable** -- promoting two at once would ask you to approve two widenings with one answer,
and a key from outside that list would be rondo inventing a grant nobody offered. Options that reach
the same contract are one option: an approval names a contract digest, so two options with one digest
would be two ways to record an answer the ledger cannot tell apart.

Both read rondo's own rows and drive **no continuo verb**, so they reach the same ended rows
`explain` does.

```console
$ node bin/rondo.mjs propose --iteration-id cli-lap-001 --successor-id cli-lap-002 \
    --kind contract_keys
a retry of iteration 'cli-lap-001', as iteration 'cli-lap-002' (contract_keys)
  drafter: rondo/advisory/deterministic
  the retry would run as rondo-cli-lap-002 on rondo/cli-lap-002
  approving one of these records that you approved its contract. It starts nothing yet:
  no admission reads this decision (D-0022 rule 17's consumer is not built).
  [recommended] leave the keys as they are: granting command.run and asking for branch.push
      contract: sha256:15475d4c...
      basis: snapshot /candidates/0/contractDigest = "sha256:15475d4c..."
  [alternative] grant 'branch.push' to 'cli-lap-002' instead of leaving it askable, so it is
      granted without asking: branch.push, command.run
      contract: sha256:9ab31f02...
      basis: snapshot /candidates/1/contractDigest = "sha256:9ab31f02..."
recorded as proposal 'contract_keys-cli-lap-002-1757500000000'
Next: rondo decide --proposal-id contract_keys-cli-lap-002-1757500000000 --actor-id ID --outcome approved --contract-digest DIGEST

$ node bin/rondo.mjs decide --proposal-id run_plan-cli-lap-002-1757500000000 \
    --actor-id "$RONDO_APPROVER" --outcome approved --contract-digest sha256:15475d4c...
recorded as decision 'decision-contract_keys-cli-lap-002-1757500000000-1757500060000'
This records that you approved that contract. Nothing runs on it yet: no admission compares it
against a plan, so the approval stands unspent.
```

**Read the last line literally.** This pair records a proposal and an approval; **nothing consumes
either**. No admission compares an approved digest against the plan it is about to run (`D-0022`
rule 17's enforcement), `decision_consumption` stays empty, and the retry does not start. What you
have afterwards is a ledger entry that says which contract a named person approved, and rule 19's
*"approved and never spent"* query is what reports it.

Three properties of `propose` are the point:

- **the contract is composed and recorded before its digest is on the screen** (`D-0022` rule 18), so
  a contract you were shown is one the ledger holds -- including when you decline it;
- **the digest is the retry's own.** The grantee is the run id derived from `--successor-id`, not the
  predecessor's, which is what makes it the contract the retry would actually run under;
- **an option is never dropped quietly.** If a plan in the lineage cannot be read, `propose` refuses
  and names it, because a proposal short one alternative is a framing rather than a shorter list.

| What you see | What it means | What to do |
|---|---|---|
| `propose needs --iteration-id ID and --successor-id ID` | Neither has a default: the second is the identity the retry runs as, and rondo derives the run id and branch from it. | Name both. The successor id must be unused. |
| `propose needs --kind, one of ...` | The three kinds ask different questions, so one would be put to you as confidently as the one you meant. | Say which question you are asking. |
| `the plan iteration '<id>' ran will not decode` | The row's plan is not a plan, so no contract can be composed from it. | Nothing was written. The row needs a person. |
| `that row cannot be read, so the alternatives rondo would offer are not all of them` | The iteration this one superseded is missing or corrupt, so the second option cannot be offered -- and a proposal short one alternative is a framing. | Nothing was written. `explain` the lineage first. |
| `cadenza refused to issue a contract` | cadenza's own refusal, verbatim -- usually an unknown project name in the plan's catalog. | Fix the plan the retry would run under; nothing was written. |
| `decide needs --outcome approved or --outcome declined` | Declining is written down rather than left as silence (`D-0032` rule 6). | Say which. Both are rows. |
| `approving needs --contract-digest DIGEST` | An approval names the contract you were shown, not a position in a list. | Copy the `contract:` line of the option you are approving. |
| `binds nothing and cannot be answered` | You named an `explanation`. Authority is a function of the proposal's kind alone (`D-0032` rule 5). | Nothing was written. Only the approvable kinds can be answered. |
### 7.3 Elevate -- hand one observation to the advisory, and leave a trace that you did

`explain` says what the store holds. `elevate` is the other direction: **you** noticed something,
and you hand it over to be worked into a proposal. The gesture is recorded as part of the proposal
rather than beside it -- which message the observation is, and who elevated it -- because an
observation constrains nothing until a person takes it up, and that taking-up is where authority
enters (#41 section 3).

```console
$ node bin/rondo.mjs elevate --iteration-id cli-lap-001 --actor-id "$RONDO_APPROVER" \
    --message-id m-0007 --observation="this plan was already merged last week" \
    --basis repo:docs/operations/rondo-cli.md@68f7067#1-4
explanation of iteration 'cli-lap-001'
  elevated from message 'm-0007' by 'operator-1'
  drafter: rondo/advisory/deterministic; derivation: operator_elevation
  this explanation binds nothing: it is not a proposal and cannot be approved
  observation: this plan was already merged last week
      basis: docs/operations/rondo-cli.md:1-4 at 68f7067
  request: teach revise to name the flags it takes
  ...
recorded as proposal 'elevation-m-0007'
```

- **`--basis` is required, and there is no form meaning "because I say so".** Elevating is one
  gesture, so a thinly-founded observation can acquire the appearance of a proposal; what stops that
  is that a basis is a *locator* into material an operator can open. The five forms are
  `snapshot:/pointer`, `iteration:ID`, `gate:ID#SEQ`, `run:ID` and `repo:PATH@COMMIT#FIRST-LAST`.
- **`--message-id` names the observation in the conversation, and it is spent once.** The
  conversation holds the id and no body, so a second elevation under one id is refused rather than
  taken as a repeat -- rondo cannot tell a repeat from a different observation reusing the name. A
  failed elevation spends nothing: the message and the proposal are one transaction, because they
  are one gesture.
- **The chain stops at the proposal in this cut.** `observation -> (you elevate) -> proposal` is
  recorded; `proposal -> (you approve) -> contract` is not reachable from here, because the kind
  produced is `explanation` and an explanation binds nothing. What the elevation columns record is
  the same whichever kind arrives later.
- **`elevate` drives no continuo**, for `explain`'s reason: the observation most worth elevating is
  often about a lap that has already ended.

| What you see | What it means | What to do |
|---|---|---|
| `elevate needs --iteration-id ID ... and --message-id ID` | Neither has a default: an elevation is an act by a person, and rondo will not supply half of one. | Name both. |
| `elevate needs --basis LOCATOR` | An observation with no basis is the thing this verb exists to prevent. | Cite where you saw it, in one of the five forms above. |
| `which is none of the forms a basis may take` | The locator did not parse; nothing was written. | Check the form. A malformed basis is refused rather than guessed at. |
| `--actor-id is '<x>' and RONDO_APPROVER is '<y>'` | Elevation passes the same identity check as `answer` and `publish`. | Elevate as the approver, or fix `RONDO_APPROVER`. |
| `already in the conversation, and a message id is durable and immutable` | That message id is spent. rondo holds no message body, so it cannot tell a repeat from a different observation reusing the name. | Choose an id that has not been used. Nothing was proposed. |
| `was composed and not recorded, so it is not being shown` | The store refused or failed the write. | Nothing was written -- **the message id too was rolled back**, because the two are one transaction. Fix the fault the message names and retype the same command. |


### 7.4 Show -- read one proposal back, so a gate is answerable later

`propose` renders an option set **once**, to the terminal that drafted it. `show` reads it back out
of the row, which is what makes a gate answerable an hour later without opening the lap (#39): the
options in the order the record holds them, which one is recommended, what each rests on **with the
material under it**, whether anybody has answered, and what answering forecloses.

Nothing on this screen is stored (`D-0032` rule 3). Every line is composed from the proposal row at
the moment it is shown: the options and the recommendation from its verbatim `payload`, the material
under each basis from its verbatim `snapshot`, and the consequence from its `kind` alone
(`D-0032` rule 4). There is no stored summary to drift from the material it was drawn from.

```console
$ node bin/rondo.mjs show --proposal-id contract_keys-cli-lap-002-1757500000000
proposal 'contract_keys-cli-lap-002-1757500000000'  contract_keys  about iteration 'cli-lap-001'
  drafter: rondo/advisory/deterministic
  nobody has answered this yet

the options, in the order the record holds them (2):
  [recommended] leave the keys as they are: granting command.run and asking for branch.push
      contract: sha256:15475d4c...
      basis: snapshot /candidates/0/contractDigest = "sha256:15475d4c..."
  [alternative] grant 'branch.push' to 'cli-lap-002' instead of leaving it askable: branch.push, command.run
      contract: sha256:9ab31f02...
      basis: snapshot /candidates/1/contractDigest = "sha256:9ab31f02..."

what answering forecloses:
  the retry would carry the keys you pick as granted rather than as askable;
  an approval is spendable once and can never be spent twice (D-0022 rule 9), and the
  answer is appended rather than edited -- changing your mind is a new proposal;
  declining is recorded too, so nobody later reads a refusal as an unanswered question.
  It starts nothing yet: no admission reads this decision (D-0022 rule 17's consumer
  is not built).

Next: rondo decide --proposal-id contract_keys-cli-lap-002-1757500000000 --actor-id ID --outcome approved --contract-digest DIGEST, where DIGEST is the contract line of the option you are approving
```

**Looking is counted, once per proposal however often you look** (`D-0036` rule 1). The second and
twentieth `show` of one proposal write nothing and report success, so the *"six were put to you,
forty were not"* breakdown in the inbox stays a count of subjects rather than a count of screens.
Reading a proposal back is **not** answering it: it takes no `--actor-id`, moves no last-look mark,
and prints the `Next:` line only while the proposal is still open.

| What you see | What it means | What to do |
|---|---|---|
| `there is no proposal '<id>'` | No row carries that id. | Copy the id from `rondo inbox`, under what is waiting on you. |
| `will not read: the proposal row's 'proposal_digest' is ... and its 'payload' digests to ...` | The row's bytes and the digest stored beside them no longer describe one document. rondo refuses rather than showing you half an option set. | Nothing is shown, and nothing was written. The row needs a person. |
| `this proposal's payload will not read: ... is of form '<x>', which is not one of ...` | A basis outside the closed union (`D-0032` rule 2). A citation rondo cannot place would read as one it had checked. | The rest of the screen still stands. Do not answer it on the strength of a citation nobody can resolve. |
| `it is settled: this screen is the record of what was answered` | Somebody already answered this proposal (`D-0032` rule 6). | Nothing to do. A change of mind is a new proposal, never an edit. |
| `this proposal binds nothing: it is read, not answered` | An `explanation`. Authority is a function of `kind` alone (`D-0032` rule 5). | Read it. It cannot be approved, and the store refuses a decision that names it. |

---

## 8. Inbox -- what is waiting on you, and what changed while you were away

This is the screen a day starts and ends on. Most of the elapsed time in this loop is waiting --
laps take tens of minutes -- so the property that matters is not responsiveness but **recovering
context after a gap**: what is waiting on you, what is running, what moved since you last looked,
and what rondo put in front of you versus kept back.

```console
$ node bin/rondo.mjs inbox --actor-id "$RONDO_APPROVER"
inbox for 'operator-1'
waiting on you
  proposals that become contracts when you approve them (1)
    p-retry-i-0007  run_plan  about 'i-0007'  waiting 41m  NEW
  proposals that bind nothing (1)
    explanation-i-0003-1757500000000  explanation  about 'i-0003'  waiting 3h
    read one back, with its options and what each rests on: rondo show --proposal-id ID
  iterations waiting on you (2)
    i-0007  awaiting_human  41m  answer gate g-0007
    i-0011  stalled  2h  no gate answer releases this (stopped at g-0011): a person has to decide

in flight (2)
  i-0012  performing  12m
  i-0013  planned  1m

since your last look 4h ago (7 records)
  proposal 2, composition 2, human_decision 1, iteration 2
    proposal  p-retry-i-0007  41m ago
    ...

what was put to you and what was not
  presented 6, withheld 0

approved and never spent (1)
  d-0004  proposal p-retry-i-0006  sha256:...  by 'operator-1' 2h ago
```

Five things about that screen are the point rather than the formatting:

- **The order is an argument.** What you can act on, then what is running, then what changed, then
  rondo's own accounting. The last section is about rondo; the first two are about the work.
- **The two voices are separate sections, not one list with a badge.** A proposal that becomes a
  contract when you approve it and one that binds nothing are different kinds of thing, and the
  split is computed from the proposal's `kind` alone (`D-0032` rule 5) -- never from who drafted it
  and never from its prose. A kind this rondo does not recognise is listed under *binds nothing*,
  which is the same answer the writer of `human_decision` gives.
- **A waiting row says what actually releases it.** `awaiting_human` and `withdrawal_requested`
  suspend at a named continuo gate, and `rondo answer` releases them. `stalled` does not: a person
  has to decide, and `resume()` observes no gate in that status. A stalled row may still be
  carrying the gate id it stopped at -- `stall()` does not clear it -- so the id is printed as
  where it stopped rather than offered as a thing to answer. A line that reads like help and is
  not costs a round trip in exactly the state that already needs a person.
- **The wait has two sides and not three.** *Waiting on you* is `awaiting_human`,
  `withdrawal_requested` and `stalled`; *in flight* is the other five live statuses. There is no
  "waiting on CI" side: CI runs inside `lap perform`, and no stored status distinguishes it
  (`D-0036` rule 5). Both lists are exhaustive over the type, so a status added later and forgotten
  here is a compile error rather than a row missing from your inbox.
- **Looking is recorded, and it is recorded once per thing.** Each open proposal is counted as
  *presented* the first time it is drawn; drawing it again on your next look stores nothing
  (`D-0036` rule 1). Otherwise one unanswered proposal, looked at twenty times over a morning,
  would report twenty presentations and the *"six were put to you, forty were not"* ratio would
  stop being a sentence.
- **The mark moves last.** The bound is sampled before anything is read and written after the
  screen is rendered, so a row that lands while the render is running is shown again next time
  rather than lost for ever (`D-0032` rules 9 and 11). There is deliberately no `--since`: the mark
  is the only cursor, and a second one typed on the command line would let the screen report a diff
  against a moment nobody marked.

| What you see | What it means | What to do |
|---|---|---|
| `This command needs --actor-id ID` | The last-look mark is per person, so a look has to say whose it is. | Name yourself. It is checked against `RONDO_APPROVER`, the same as `answer` and `publish`. |
| `you have never looked` | No mark for this actor yet. Nothing is marked `NEW`, because everything would be. | Nothing. The next look is a diff against this one. |
| `will not decode` in *in flight* | A live row whose columns rondo cannot read. It still holds a slot. | `rondo abandon --iteration-id ID --reason ...`; `explain` will refuse it for the same reason. |
| `This look was not fully recorded` (exit 1) | You read the screen; what failed was the count of what was shown, or the mark. | The screen stands. If the mark did not move, the next inbox repeats this diff. |

---

## 9. What has and has not been walked on real infrastructure

Recorded so that "it works" is not read more broadly than it was tested.

- **`start` and `answer`: walked end to end**, on the pinned continuo with a real `claude -p` worker.
  The worker did the work it was asked to do -- commit `68f7067` on `dogfood/cli-lap-001` really
  appends the line -- the gate opened at `received`, six verbs closed it `answered_and_forwarded`,
  and the iteration reached `closed` with the lock released.
- **`revise`: walked end to end, twice, over four laps.** `start` -> `revise` -> `answer approve`,
  on the pinned continuo with real workers. The second lap really continued the first: its history
  is `def1894` on top of `600b3c1` on top of the seed commit, one linear branch, and the second
  worker reported *"Continued from the previous lap's commit rather than restarting"*. Laps took
  51.4 s, 42.9 s, 38.6 s and 54.5 s. **The first walk found a defect the tests had not**: `publish
  --dry-run` on the revised iteration named the predecessor's topic branch as the pull-request base,
  which nothing pushes. `pull_request_base_branch` is that answered, and the second walk is the
  re-run that confirms it -- the same command now prints `--base main` while the plan's own
  `base_branch` is `dogfood/revise-003`.
- **`publish`: exercised as far as this worker may go.** `--dry-run` computes all three legs
  correctly from the stored plan, and the legs themselves are covered by unit tests. The push and
  the pull request were **not** executed here, because this repository's worker environment blocks
  pushing and pull-request creation by design -- those are the operator's, which is the same
  boundary the command itself is built around. The first operator to run it without `--dry-run` is
  what closes this gap.
- **`publish`'s preflight: walked against real workspaces, in every branch.** The refusals for a
  workspace with no remotes, for a named remote that is not configured, for a missing topic branch,
  for a malformed `--repo` and for a push remote that disagrees with `--repo` were each produced by
  running the command against a real repository on disk; so were the two `--allow-remote-mismatch`
  paths (a fork, which qualifies the head with an owner, and a local bare repository, which cannot
  be qualified and says so). The workspace with no remotes was the very one from the walk below,
  which is where the defect was found.
- **The pull-request leg with `--allow-remote-mismatch` has never met a real forge.** The
  `owner:branch` head is the documented spelling for a cross-repository head and is asserted by unit
  tests, but no fork has been published through this command yet.
- After the walk, continuo's run row was still `created` and rondo's row still recorded no publish,
  which is the correct state for work that was approved but not yet submitted.
- **`propose` (all three kinds) and `decide`: not walked at all.** Both are exercised end to end against a real
  SQLite store in `test/access/advisory.test.ts` -- the proposal row, every composition row, the
  digests on the screen and the decision that names one -- and neither has been run by an operator
  on real infrastructure. There is also nothing downstream of them to walk: no admission reads an
  approval yet, so what a walk would confirm is a ledger entry, which is what the tests already
  assert.

### The second walk: from nothing, through `scripts/dogfood-env.sh`

Run on 2026-09-06 on the same machine and the same pin, from an empty directory, to check that the
script above actually produces an environment the four commands run in. Two laps were spent.

| Command | Wall clock | What it reached |
|---|---|---|
| `scripts/dogfood-env.sh` (cold: clone + both builds) | 8.4 s | environment provisioned, no lap run |
| `start` | 15.4 s | `awaiting_human`, gate open at `received` |
| `answer` (read) | 0.28 s | printed the worker's own sentence and the options |
| `answer --body=approve` | 1.2 s | six verbs, `answered_and_forwarded`, iteration `closed` |
| `publish --dry-run` | 0.15 s | the three legs, computed from the stored plan |
| `abandon` | 0.06 s | `abandoned` from `performing`, lock released |

The worker did the work it was asked for: commit `dc8a01c` on `dogfood/dogfood-001` appends the
line. `publish` was again not run without `--dry-run`, for the same reason as above.

**`abandon` was walked on a `performing` row**, which is the case section 7 exists for and the first
walk did not cover. The lap was started and rondo was killed eight seconds in, simulating a host that
died mid-lap. What followed is the behaviour the single-flight lock promises: `answer` reported
`iteration 'dogfood-002' is performing, and no gate is open on it`, a third `start` was **refused
before anything was spawned** -- so a stuck row costs nothing to bump into -- and `abandon` released
the lock, after which `answer` reported nothing live. Two things it deliberately left behind, both
the operator's by D-0010: an admitted continuo run at `created`, and the materialised workspace with
its topic branch.

Two setup facts are worth stating because they are the ones the first walk did not have to discover:
the cold `continuo` build is **seconds, not the ~13 s recorded earlier** (TypeScript 7's native
compiler), and every rondo command prints one `ExperimentalWarning: SQLite ...` line on stderr, which
is `node:sqlite` on the supported Node versions and not a fault.

The first pull request this runbook describes was opened by `rondo publish` itself, from a lap driven end to end against a GitHub-backed clone on 2026-09-06.
