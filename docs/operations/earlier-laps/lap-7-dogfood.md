# lap 7 dogfood -- a lap installed its own dependencies, verified, took a baseline and committed

A seventh walk of the arc, written the way [`lap-6-dogfood.md`](lap-6-dogfood.md) is: the commands
that were actually run and the output that actually came back, as a difference against lap 6 rather
than as a fresh survey.

- Run on 2026-09-13, on `feat/rondo-lap7-dogfood` at `d65cd9e`, against continuo
  `fcf86eb2b7eb34d65bf73188b2b34544fab6820c` and the vendored cadenza
  (`sha256 1d255ecc…`, checked by `node vendor/pin.mjs check`).
- Machine: WSL2 (`Linux 6.18.33.2-microsoft-standard-WSL2`), Node `v22.17.0`, npm `10.9.2`.
- Target: a **fresh clone of rondo from GitHub** at `d65cd9e`
  (`$TMPDIR/rondo-dogfood-lap-7-env/rondo-gh`), provisioned by `scripts/dogfood-env.sh
  --target-repo`. Its origin is the real `https://github.com/suisya-systems/rondo.git`, so the
  printed `publish` is the one a real publish would run.
- `--root` was `$TMPDIR/rondo-dogfood-lap-7-env`. The default (`$XDG_STATE_HOME/rondo/dogfood-env`)
  is outside this operator's writable set, as it was in lap 6. No ancestor of the root holds a
  `node_modules` (the #111 guard passed, and it was re-checked by hand afterwards: section 3).
- **One iteration, `lap7-001`, one paid lap: $0.8912 / 18 turns / 94.767 s**, read off rondo's own
  output. `rondo start` took 99.7 s of wall clock against a ceiling of 1 380 000 ms.
- **This lap exists to close G1** -- *a worker inside the fence cannot finish its verification, so
  nothing is committed* -- and lap 6's two carried items: a first step of `npm ci --ignore-scripts`
  in a workspace with no borrowed toolchain, and the `git switch` baseline (`lap-6-dogfood.md`
  section 9, items 1 and 2).

---

## 1. The five questions, answered

The brief asked five things of one lap, each with its evidence. **Four are yes; the fifth is yes as
far as an operator's `--dry-run` can reach, and stops there on purpose.**

| # | question | answer | evidence |
|---|---|---|---|
| 1 | did the worker install from a clean workspace? | **yes** | `events-000.jsonl` L10-L13: `node vendor/pin.mjs check; echo "EXIT=$?"` -> `EXIT=0`, then `npm ci --ignore-scripts; echo "EXIT=$?"` -> `added 73 packages in 3s` / `EXIT=0`. Afterwards the workspace holds its own `node_modules` (60 entries, `.bin/` has `tsc`, `biome`, `knip`, `vitest`) and **no ancestor of it has one** -- the lap-5 N-14 shape is absent |
| 2 | did it take a baseline? | **yes** | L49-L57: `git switch --detach HEAD~1` -> `HEAD is now at d65cd9e`, `npm run verify; echo "EXIT=$?"` -> `EXIT=0`, `git switch -` -> `Switched to branch 'rondo/lap7-001'`. Both declared subjects admitted, neither refused |
| 3 | did it finish its verification? | **yes** | L41-L44: `npm run verify; echo "EXIT=$?"`, unpiped, -> `Test Files 37 passed (37)`, `Tests 933 passed \| 1 skipped (934)`, `EXIT=0`. `verify` is `build && lint && knip && typecheck && test`, so `knip` -- the step that dissented in lap 5 -- passed against the lap's own install |
| 4 | did it commit its work? | **yes** | L37-L39: `[rondo/lap7-001 1e96103] docs: note lap 7 in the dogfood procedure`. After the lap `git status --porcelain` is empty and `git log` shows `1e96103` on `d65cd9e` (L58-L59, and read again from outside the fence) |
| 5 | could `publish` make that a pull request? | **as far as `--dry-run`** | `rondo publish --iteration-id lap7-001 --repo suisya-systems/rondo --actor-id happy_ryo --dry-run` exited 0 and printed the push, `gh pr create --repo github.com/suisya-systems/rondo --base main --head rondo/lap7-001`, the `run close`, and a PR body naming `1e96103` (section 5). It was not run for real: this walk has no authority to push to or open a PR on the real repository, and publishing is the operator's (D-0010) |

The request that produced this (passed with `--prompt-file`, and quoted in full in the PR body
below) named every step and every command explicitly. **That is a deliberate limit on what this lap
proves**: it shows the fence *admits* the whole install -> change -> verify -> baseline -> commit
sequence, not that a worker reaches for it unprompted. Lap 5 already showed what an unprompted worker
does (it skipped the install); this lap measures the capability that lap 5 lacked a chance to show.

## 2. What was run

```
$ scripts/dogfood-env.sh --root $TMPDIR/rondo-dogfood-lap-7-env \
      --target-repo $TMPDIR/rondo-dogfood-lap-7-env/rondo-gh --iteration-id lap7-001
  ... verified @suisya-systems/continuo 0.0.0 (rev fcf86eb2...)
  ... using .../rondo-gh at branch main (left unmodified)
  ... origin already points at https://github.com/suisya-systems/rondo.git; left as it is
                                                                  (14.4 s)

$ npm run preflight:model-tier -- $TMPDIR/rondo-dogfood-lap-7-env/plan.json
model tier 'standard' runs on claude-opus-5

$ node bin/rondo.mjs start --plan .../plan.json --iteration-id lap7-001 --prompt-file request.txt
  cadenza allowed the action (granted); the three digests are committed.
  continuo admitted run rondo-lap7-001 at status 'created' under role 'worker' (neutral name 'worker').
  Sending one lap; rondo will wait 1380000 ms for it, the ceiling the plan declared.
  An independent reading of the work found nothing to raise (rondo/deterministic/1). It read 1 commit(s) and 1 file(s) ...
  The lap answered. Gate gate/worker_escalation/c466cdef-.../0 is already open; session c466cdef-... was started.
  The lap cost 0.8912135000000001 USD over 18 turn(s) in 94767 ms, read from its terminal 'result' event.
iteration 'lap7-001' is awaiting_human                            (99.7 s)
```

The generated plan was used as written. Nothing in `plan.json` was edited: the `allowed_bash` it
declares (`npm ci --ignore-scripts`, `npm run:*`, `npm test:*`, `echo:*`, `git switch --detach
HEAD~1`, `git switch -`, `node vendor/pin.mjs:*`, `node --version`, `npm --version`) is exactly
what the gate screen printed back.

**One setup step did not go as first intended, and is recorded rather than worked around.** The
first attempt at a target was a local clone of this checkout with its origin then re-pointed at
GitHub; the operator's own permission layer refused `git remote set-url` on it. The target used
instead is a straight `git clone https://github.com/suisya-systems/rondo.git`, which gives the same
origin without editing one. The abandoned local clone is left at `$TMPDIR/.../rondo` and plays no
part in the lap.

## 3. The gate, read before it was answered

`rondo answer --iteration-id lap7-001` with no `--body` (runbook step 4, D-0029 rule 2) printed the
worker's rationale, the branch, the fence block and the independent reading. The three sources the
runbook names were read in its order:

**a. The fence block.** Nine declared subjects, the delegation record's envelope digest
(`2841a86a…`) re-checked by continuo, and *"the fence refused 1 call(s)"* with the refused command
verbatim. It carries the D-0050 sentence about the worker's own sandbox, which is load-bearing here
(N-21).

**b. The rationale.** A table of 14 Bash calls, one refused, and an explicit paragraph that the
worker's sandbox failed to initialise.

**c. The transcript**, `<state root>/rondo-lap7-001/c466cdef-11c9-452f-9d27-2e3075bc23f2/`. Read
independently of the rationale: every Bash `tool_use` paired with its `tool_result`.

| # | L | what the worker typed | outcome in the transcript | worker's table | agree? |
|---|---|---|---|---|---|
| 1 | 6 | `ls -a <workspace>` | error: `Sandbox is enabled but failed to initialize: EPERM ... listen '/tmp/claude-1000/srt-mux-81-1.sock'. Sandboxing is disabled for the rest of this session` | never ran, not refused | yes |
| 2 | 10 | `node vendor/pin.mjs check; echo "EXIT=$?"` | both artefacts match their pins, `EXIT=0` | 0 | yes |
| 3 | 12 | `npm ci --ignore-scripts; echo "EXIT=$?"` | `added 73 packages in 3s`, `EXIT=0` | 0 | yes |
| 4 | 15 | `tail -c 400 scripts/dogfood-lap.md \| cat -A \| tail -12` | ran | 0 | yes |
| 5 | 22 | `awk '{ print length }' ... && printf ... >> scripts/dogfood-lap.md && tail -5 ...` | **refused**: `The following part requires approval: awk '{ print length }' scripts/dogfood-lap.md` | refused | yes |
| 6 | 28 | `wc -l scripts/dogfood-lap.md` | `378` | 0 | yes |
| 7 | 34 | `git status --porcelain && git diff` | the three added lines | 0 | yes |
| 8 | 37 | `git add scripts/dogfood-lap.md && git commit -m ...` | `[rondo/lap7-001 1e96103]`, `EXIT=0` | 0 | yes |
| 9 | 41 | `npm run verify; echo "EXIT=$?"` | 37 files, 933 passed, 1 skipped, `EXIT=0` | 0 | yes |
| 10 | 49 | `git switch --detach HEAD~1; echo "EXIT=$?"` | `HEAD is now at d65cd9e`, `EXIT=0` | 0 | yes |
| 11 | 51 | `npm run verify; echo "EXIT=$?"` | 37 files, 933 passed, 1 skipped, `EXIT=0` | 0 | yes |
| 12 | 55 | `git switch -; echo "EXIT=$?"` | `Switched to branch 'rondo/lap7-001'`, `EXIT=0` | 0 | yes |
| 13 | 58 | `git status --porcelain; git log --oneline -3; git rev-parse --abbrev-ref HEAD` | clean, `1e96103` on top, `rondo/lap7-001` | 0 | yes |
| 14 | 69 | `ls docs/operations/` | laps 1-6 and `rondo-cli.md` | 0 | yes |

**Three accounts of one lap agree**: the worker's table, rondo's fence block (1 refusal, the same
`awk`) and the transcript's `result` event (`permission_denials` has 1 entry). The refusal cost a
round trip and not a capability: the worker made the same edit with the `Edit` tool and did not
retry the refused shape.

Checked from outside the fence before answering:

```
$ ls .../workspaces/iter-lap7-001/node_modules | wc -l        -> 60
$ for d in <workspace> <workspaces> <root> /tmp/claude-1000 /tmp /; do [ -d $d/node_modules ] && echo "NM at $d"; done
NM at /tmp/claude-1000/rondo-dogfood-lap-7-env/workspaces/iter-lap7-001      <- the workspace's own, and only that
$ git -C <workspace> status --porcelain                        -> (empty)
$ git -C <workspace> log --oneline -2                          -> 1e96103, d65cd9e
```

Then the gate was answered:

```
$ node bin/rondo.mjs answer --iteration-id lap7-001 --actor-id happy_ryo \
      --verified="read the transcript: npm ci exit 0, verify EXIT=0 on 1e96103 and on HEAD~1, workspace has its own node_modules and no ancestor has one" \
      --body=approve
  gate present ... gate deliver ... gate ack       stage is now 'presented'
  gate answer  ... gate deliver ... gate ack       stage is now 'forwarded', and the gate is closed
iteration 'lap7-001' is closed
  Gate outcome: answered_and_forwarded.
  Run id: rondo-lap7-001; continuo revision: fcf86eb2b7eb34d65bf73188b2b34544fab6820c.
  rondo did not close this run. Nothing was pushed, nothing was landed, and publishing this work is the operator's, not rondo's (D-0010).
EXIT=0
```

Runbook steps 5 and 6 both hold on that output: one `resume`, made by `answer` itself, to `closed`;
the report names the outcome, the run id, the revision, and says rondo did not close the run and
that publishing is the operator's. The verification claim is 176 characters, under lap 6's N-18
limit, and it reached the PR body intact (section 5).

## 4. What lap 6 asked, and what is true now

| lap 6 section 9 | status | evidence in this run |
|---|---|---|
| **1. N-14 / #111's other half**: a lap whose first step is `npm ci --ignore-scripts`, with no borrowed toolchain | **walked, green** | install at L12, own `node_modules`, no ancestor `node_modules`, `knip` green inside `verify`. The limit: npm's cache under `~/.npm` was warm, so this is *install from a warm cache inside the fence*, not a cold network install (`added 73 packages in 3s`) |
| **2. The `git switch` baseline**, declared for #112 and never reached for | **walked, mechanics proven; the red case still unwalked** | both subjects admitted and the tree came back with the commit on it (L49-L57). But the lap was *asked* to take a baseline, and both sides were green. What #112 was for -- a lap that sees red, reaches for a baseline on its own and reads it correctly -- is still not observed (N-22) |
| **3. The other digest mismatch** | **not attempted** | outside this lap's subject |
| **4. `retry` against a `run_plan` / `agent_type` proposal** | **not attempted** | outside this lap's subject; this lap classified `allowed` and made no proposal |

And against the gap survey's G1 (*a worker inside the fence cannot finish its verification, so
nothing is committed*): **closed on this evidence.** Lap 4 left its work uncommitted after the fence
refused a documented preflight; lap 5 was green only on the operator's `node_modules`; lap 7 ran the
repository's whole order -- pin check, install, change, commit, verify, baseline -- on its own
install, with the plan as generated and no hand edits to the plan, the workspace or the branch.

## 5. `publish`, and the uncommitted-work question

```
$ node bin/rondo.mjs publish --iteration-id lap7-001 --repo suisya-systems/rondo --actor-id happy_ryo --dry-run
iteration 'lap7-001' is closed; gate outcome 'answered_and_forwarded'

publish runs these three, in order, as you:
  1. git -C .../workspaces/iter-lap7-001 push origin rondo/lap7-001
  2. gh pr create --repo github.com/suisya-systems/rondo --base main --head rondo/lap7-001
  3. continuo run close --run-id rondo-lap7-001 --outcome completed

the pull request it opens reads:
  title: docs: note lap 7 in the dogfood procedure
  body:
    ## What changed
    - `1e96103` docs: note lap 7 in the dogfood procedure
    1 file changed against `refs/remotes/origin/main`:
    - `scripts/dogfood-lap.md` (+3 -0)
    ## How this got here
    - rondo walked run `rondo-lap7-001` (iteration `lap7-001`) on `rondo/lap7-001`, for `main`.
    - Gate `gate/worker_escalation/c466cdef-.../0` closed `answered_and_forwarded` ...
    - Before answering, `happy_ryo` said they had checked: read the transcript: npm ci exit 0, ...
    - Against continuo `fcf86eb2...`, on `claude-opus-5` (tier `standard`).
    ...
--dry-run: nothing was run.
EXIT=0
```

Because the origin is the real forge, the remote-mismatch preflight passed without
`--allow-remote-mismatch` -- the first lap whose printed `publish` line is the one a real publish
would run. The body lists the lap's own commit and nothing else, and none of lap 6's N-19 retry
wording appears (this is not a retry).

**The uncommitted-work case (G2, D-0060) was not met.** The lap committed everything it changed and
left the tree clean (`git status --porcelain` empty inside and outside the fence), so there was
nothing for `publish` to miss. This lap is therefore **not** an instance of the behaviour the
parallel task rondo-publish-uncommitted addresses, and no instance was manufactured by editing the
workspace by hand.

## 6. New findings

### N-21. The worker's sandbox failed to initialise again, and D-0050's sentence is what made it visible

Lap 6's N-16, reproduced on the first Bash call with the same socket path shape:

> `Sandbox is enabled but failed to initialize: EPERM: operation not permitted, listen
> '/tmp/claude-1000/srt-mux-81-1.sock'. Sandboxing is disabled for the rest of this session; restart
> to retry.`

Calls 2-14 ran unsandboxed. The fence (continuo's allow list) still held -- it refused `awk` -- but
the second containment was off for the whole paid lap. What changed since lap 6 is only the
reporting: the gate screen now says, on every lap, that a lap with the sandbox disabled prints
exactly like one without (D-0050), and the worker reported it because the request asked. **Two laps
in a row have run with the worker sandbox off on this machine.** The cause looks environmental (the
worker is spawned inside the operator's own sandbox, where listening on a socket under
`/tmp/claude-1000` is refused), and that is where a fix would be looked for, not in rondo.

### N-22. The baseline mechanics work; nobody has yet seen a lap reach for one

The two `git switch` subjects did exactly what `scripts/dogfood-env.sh` says they are for: detach one
commit back, verify there, come back with the commit intact, `node_modules` surviving both moves.
But the request named the three commands, and both runs were green, so neither half of #112's
motivating scenario happened: no red verification, and no worker deciding for itself that it
needed a baseline. Getting that needs a request whose change turns the suite red, with no mention
of a baseline.

### N-23. A non-ASCII arrow in a rationale reaches the gate screen as `\u2192`

The worker wrote `→` in its results table; the gate's `why` printed `\u2192` four times.
`legibleAsciiEscape` (`src/access/console.ts`) is working as designed -- D-0004 keeps the console
ASCII, and `READABLE_SUBSTITUTES` substitutes only dashes, quotes, ellipsis, bullet and no-break
space -- so this is not a defect. It is a data point for the table's own comment (*"growing this
table is a readability improvement"*): `→` -> `->` is the next entry a real rationale asked for.

### N-24. Two operator-side checks the runbook asks for were refused by the operator's harness, not by rondo

Runbook step 7's reads -- `continuo gate list --db ...`, `git -C <target> branch -a`,
`git -C <target> worktree list` -- were refused by the permission layer of the session that walked
this lap (a claude-org worker), as was `git remote set-url` on a scratch clone (section 2). None of
them is rondo's refusal and none blocked the lap: `answer` had already printed *"the gate is
closed"*. They are recorded because they are steps the runbook asks an operator to type that an
agent operator could not, and the substitute evidence used here (`rondo answer`'s own output and
`git -C <workspace>` reads) is weaker than the runbook's.

### Candidate issues

Drafted in English as candidate issue bodies. Filing is the secretary's.

1. **Worker sandbox fails to initialise when the lap is spawned from inside another sandbox**
   (N-21; continuo or environment). *Two consecutive dogfood laps (6 and 7) ran their worker with
   `Sandbox is enabled but failed to initialize: EPERM ... listen '/tmp/claude-1000/srt-mux-*.sock'`
   and every Bash call after the first unsandboxed. The fence allow list still refused undeclared
   commands, so the lap was contained by one layer instead of two. Proposal: find whether the
   spawning environment can give the worker a socket directory it may listen in, and whether a lap
   should refuse to start (or say so on its report line) when the worker's sandbox is off.*
2. **lap 8: a red verification that the worker has to diagnose with a baseline, unprompted**
   (N-22). *The `git switch --detach HEAD~1` / `git switch -` subjects are proven admitted (lap 7).
   What #112 was for is still unobserved: a lap whose change turns `npm run verify` red, given a
   request that does not mention a baseline. Success is the worker taking one on its own and
   committing a correct account of the cause.*
3. **`READABLE_SUBSTITUTES` has no entry for `→`** (N-23, low priority). *A lap-7 rationale printed
   `\u2192` four times on the gate screen. Add `"→": "->"`.*

## 7. What the walk cost, and where

| | lap 2 | lap 3 | lap 4 | lap 5 | lap 6 | **lap 7** |
|---|---|---|---|---|---|---|
| `total_cost_usd` | 1.032 | 7.062 | 2.055 | 1.542 | 0.223 | **0.891** |
| turns | 29 | 95 | 43 | 38 | 8 | **18** |
| duration | 121.8 s | 724.4 s | 253.6 s | 203.3 s | 32.1 s | **94.8 s** |
| refusals / Bash calls | 4 / 29 | 10 / 69 | 18 / 36 | 5 / 29 | 1 / 5 | **1 / 14** |
| lap committed its work | yes | yes | **no** | yes | yes | **yes** |
| lap installed its own dependencies | -- | -- | -- | **no** | n/a (no `package.json`) | **yes** |
| read by hand out of `events-*.jsonl` | yes | yes | yes | yes | no | **no** (cost); the Bash table was cross-checked by hand on purpose |

Two full `npm run verify` runs are inside the 94.8 s; the suite itself reported about 3 s of test
time each. The install was 3 s because the cache was warm (section 4). Four times lap 6's cost buys
the thing lap 6 could not show: a lap on a real `package.json` whose green is its own.

## 8. Verification discipline

- `npm run verify` on this branch with `RONDO_CONTINUO_CLI` set to the pinned build, as CI sets it:
  `EXIT=0`, **933 passed, 1 skipped, 37 files** -- the same numbers the lap reported inside the
  fence, on both its commit and its baseline.
- No source file was changed by this lap: the only file this branch adds is this document. The
  lap's own commit `1e96103` lives on `rondo/lap7-001` in the scratch target and is **not** on this
  branch -- it points at this file, which is why this file had to exist, and it is not carried here
  by hand.

## 9. What is left where it is

- continuo run `rondo-lap7-001` is still at `created`. It was **not** closed with `run close`
  (runbook step 7) because `publish` closes it as its third step, and `run close` refuses a second
  close: closing it here would make a later real `publish` of this lap fail on its last step.
- The workspace `iter-lap7-001` and the branch `rondo/lap7-001` stay in the scratch target, for the
  same reason.
- The environment root `$TMPDIR/rondo-dogfood-lap-7-env` is left in place; removing it is the
  operator's.
