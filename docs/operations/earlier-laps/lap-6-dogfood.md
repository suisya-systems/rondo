# lap 6 dogfood -- the chain walked to its end, and `rondo retry` ran for the first time

A sixth walk of the arc, written the way [`lap-5-dogfood.md`](lap-5-dogfood.md) is: the commands
that were actually run and the output that actually came back, as a difference against lap 5 rather
than as a fresh survey.

- Run on 2026-09-12, on `feat/rondo-dogfood-lap-6` at `a86846d`, against continuo
  `fcf86eb2b7eb34d65bf73188b2b34544fab6820c` and the vendored cadenza
  (`5d5d9f4`, checked by `node vendor/pin.mjs check`).
- Machine: WSL2 (`Linux 6.18.33.2-microsoft-standard-WSL2`), Node `v22.17.0`, npm `10.9.2`.
- Target: the **scratch** target `scripts/dogfood-env.sh` creates, not rondo itself. Lap 5 pointed
  at a clone of rondo to get a real code change; this lap's subject is the *chain*, and a trivial
  target keeps the one paid lap cheap.
- `--root` was `$TMPDIR/rondo-dogfood-lap-6-env`, named explicitly: the new default
  (`$XDG_STATE_HOME/rondo/dogfood-env`) is outside this worker's writable set. It is outside the
  repository and has no `node_modules` ancestor, which is what the #111 guard is for.
- **Five iterations started, two retries admitted, one paid lap: $0.22283 / 8 turns / 32.064 s.**
  Lap 5 was $1.542 / 38 turns / 203.3 s for a two-file code change.
- **The chain walked end to end**: a lap stopped, left a proposal, a person approved it, `rondo
  retry` spent the approval inside the admission, and a second retry was refused.
- **The cost was read off rondo's own output.** For the first time in six laps the figures in this
  document were not parsed out of `events-000.jsonl` by hand.

---

## 1. What was run

Every iteration below is real: real continuo at the pin, real control plane, real delegation
records, real session logs. What differs between them is the worker CLI.

| iteration | plan | worker | ending | cost |
|---|---|---|---|---|
| `lap6-001` | `branch.push` in `intended_action` | none spawned | `abandoned` (needs_approval), proposal left | **$0** |
| `lap6-002` | same, `claude_command` -> continuo's `fake-claude` | none spawned | `abandoned`, proposal left | **$0** |
| `lap6-002-r2` | the retry of `lap6-002` | **fake** | `awaiting_human` -> `closed` | **$0** |
| `lap6-003` | same as `lap6-002` | none spawned | `abandoned`, proposal left | **$0** |
| `lap6-004` | same as `lap6-001`, with the real request | none spawned | `abandoned`, proposal left | **$0** |
| `lap6-004-r2` | the retry of `lap6-004` | **real `claude`** | `awaiting_human` -> `closed` | **$0.22283** |
| `lap6-005` | `askable: []` | none spawned | `abandoned` (refused), **no proposal** | **$0** |

### How a lap was made to stop

The brief asked for a lap that stops the way `D-0043` rule 1 means. The cheapest shape that is also
the *useful* one is `needs_approval`: add to the generated plan's `intended_action.capabilities`
the one key the agent type already lists as `askable`.

```json
"intended_action": { "capabilities": ["command.run", "branch.push"] }
```

`command.run` is granted and `branch.push` is askable, and cadenza's worst-outcome rule makes the
pair `needs_approval`. It is refused at `classify`, **before `admit`**, so no run exists at
continuo, no fence is rendered and no worker is spawned. `rondo start` returned in **0.27 s** and
cost nothing:

```
iteration 'lap6-001' is abandoned
  cadenza answered needs_approval (askable). In lap 1 that is a dead end ...
  Iteration lap6-001 ended at 'abandoned'.
  Proposed 2 contracts a retry could run under, as 'contract_keys-lap6-001' for a successor
  'lap6-001-r2'. Nobody has been shown it: 'rondo show' reads it, 'rondo decide' answers it and
  'rondo retry' spends the answer.
```

That shape is worth recording on its own, because it is what makes the whole of `D-0043` and
`D-0047` walkable **for free**: the ending the trigger fires on is an ending that spawns nothing,
so every part of this chain except the retry's own lap costs zero.

The promoted option is also the one that makes the retry *run*: moving `branch.push` from `askable`
to `granted` makes the same intended action classify `allowed`. The chain therefore ends in a lap
rather than in a second stop, which is the property that makes it a chain at all.

## 2. The chain, link by link

```
$ node bin/rondo.mjs show --proposal-id contract_keys-lap6-002
  [recommended] leave the keys as they are: granting command.run and asking for branch.push
      contract: sha256:33b5b0ee...
  [alternative] grant 'branch.push' to 'lap6-002-r2' instead of leaving it askable ...
      contract: sha256:35765b96...

$ node bin/rondo.mjs decide --proposal-id contract_keys-lap6-002 --actor-id happy_ryo \
      --outcome approved --contract-digest sha256:35765b96...
  recorded as decision 'decision-contract_keys-lap6-002-1789206053355'
  Nothing has been spent: the admission that reads this decision is 'rondo retry' ...

$ node bin/rondo.mjs retry --proposal-id contract_keys-lap6-002
  decision '...' approved sha256:35765b96..., and that is the contract the plan below composes
  retrying 'lap6-002' as iteration 'lap6-002-r2'
  ...
  iteration 'lap6-002-r2' is awaiting_human
```

**`decision_consumption` went from 0 rows to exactly 1**, and the `iteration` row for
`lap6-002-r2` carries `supersedes_iteration_id = 'lap6-002'`. `D-0047` rule 1's atomicity is not
directly observable from the outside -- one row and one row is what both a correct run and a lucky
one look like -- but the two refusals below are, and they are what the rule buys.

### The second spend is refused

```
$ node bin/rondo.mjs retry --proposal-id contract_keys-lap6-002 ; echo "EXIT=$?"
No unspent approval names proposal 'contract_keys-lap6-002'. Either nobody has approved it, it was
declined, or the approval has already been spent on an admission -- 'rondo inbox' lists the
approvals that are still spendable.
EXIT=2
```

`decision_consumption` stayed at 1 row and `iteration` stayed at 3. Nothing was admitted.

### A digest that no option composes is refused

`lap6-003` exists to make this one. Its proposal was approved with a digest that is real but
belongs to a *different* subject (`lap6-001`'s promoted option):

```
$ node bin/rondo.mjs retry --proposal-id contract_keys-lap6-003 ; echo "EXIT=$?"
No option of this proposal composes 'sha256:1f8fccc2...' any more, so the contract that was
approved is not one rondo can issue today -- the material behind it moved, or the identity
'lap6-003-r2' it was issued to is no longer free. Nothing was admitted and the approval was not
spent. Propose again against what the store holds now.
EXIT=2
```

`decision_consumption` stayed at 1 and no `lap6-003-r2` row was written. `D-0047` rule 4 and rule 7,
measured. The approval is still standing, and `rondo inbox` still lists it under *approved and never
spent* -- which is `D-0022` rule 19's query doing what it was built for, on real data, for the
first time.

**What could not be made to happen here**: the *other* digest mismatch, where recomposition at
spend time differs because the material really moved. On this environment the catalog layer is
carried inside the plan and the plan is on the iteration row, so recomposition is deterministic and
there is nothing outside it to move. Producing that one needs a catalog cadenza reads from disk, or
a pin that moves under the operator. It is stated as not walked rather than claimed.

### Nothing is proposed when there is nothing to choose

`lap6-005` ran under an agent type with `askable: []`, so `branch.push` is in neither set and
cadenza answers `refused` rather than `needs_approval` -- a different one of `D-0043` rule 1's
three endings:

```
  cadenza refused the action (not_in_contract). The request ends here without a run ...
  No retry was proposed for 'lap6-005': the agent type it ran under declares no askable key, so
  the only candidate is the contract it already ran under.
```

`D-0043` rule 5, and the line the rule says the report must carry, both present.

## 3. The paid lap

`rondo retry --proposal-id contract_keys-lap6-004`, with the real `claude` on PATH as the plan's
`claude_command`. **34.0 s wall clock**, of which the lap itself was 32.064 s.

The request was written *after* reading the generated plan's `allowed_bash` -- lap 5's discipline --
and named only `node --version` and `npm --version` out of it. It also asked the worker to list
every Bash command it ran and say which were refused, so that the lap's own account could be
checked against rondo's record of it. That cross-check is section 4.

```
  The lap cost 0.22283149999999996 USD over 8 turn(s) in 32064 ms, read from its terminal
  'result' event.
```

The work is one commit, `051ca25`, `docs/NOTES.md (+2 -0)`, which is what was asked for. The `+2`
is the requested line plus a blank separator, and the worker said so at the gate unprompted.

## 4. What lap 5 asked, and what is true now

| lap 5 | status | evidence in this run |
|---|---|---|
| **N-8 / #96** nothing rondo records says what a lap cost | **fixed, and load-bearing** | `0.22283149999999996 USD / 8 turns / 32064 ms` on the retry's own output, on `rondo explain`, and on the web page. **The figures in this document were not parsed by hand**, for the first time in six laps |
| **N-3 / #88** nothing rondo records says which commands the lap ran, or that any were refused | **fixed** | the gate screen's `fence` block prints the nine declared subjects, the delegation record's envelope digest re-checked against the stored bytes, and *"the fence refused 1 call(s), as continuo reported them"* with the command verbatim |
| **N-14 / #111** the dogfood environment is not hermetic | **fixed as a guard; not exercised as a lap** | `--root` now defaults outside the repository and `scripts/dogfood-env.sh` refuses a root inside the rondo checkout *or* inside any directory with a `node_modules` ancestor. What lap 5 asked to see next -- what a lap does when `npm ci` is genuinely its first step -- is **still unwalked**, because this lap's target has no `package.json`. It needs a `--target-repo` lap under the new default |
| **N-13 / #112** a lap cannot make a second copy of its own tree | **repaired in the plan; not exercised** | the generated plan now declares `git switch --detach HEAD~1` and `git switch -` as two exact subjects. This lap's verification was never red, so it never went looking for a baseline. Present, unproven |
| **N-4 / #89** `standard` is the only tier, and it is the most expensive model | **not fixed** | `model tier: standard` / `model: claude-opus-5` again |
| **N-15** `... \| tail -N; echo "EXIT=$?"` reports the pipe's status | **still true, and it caught the operator this time** | checking the refused second `retry`, this walk typed exactly that shape and read `EXIT=0` for a command that exits 2. Re-typed without the pipe: `EXIT=2`. The shape is the one a person reaches for, operator included |

### The six changes that landed the same day

| change | in the record | effective here? |
|---|---|---|
| **D-0043 / #119** a stopped lap leaves one proposal | `contract_keys-lap6-001/-002/-003/-004`, four for four | **yes** |
| **D-0047 / #126** an approval is spent inside the admission | one `decision_consumption` row per retry, second retry refused | **yes** |
| **D-0043 rule 8 / D-0047 rule 4** a digest that does not compose stops the retry | `lap6-003`, exit 2, nothing written | **yes** |
| **D-0046 / #124** the lap's cost is on the row | three values on `explain`, on the report line and on the page | **yes** |
| **#122** what was declared and what was refused is on the gate screen | the `fence` block, and it matched the worker's own account | **yes** |
| **D-0045 / #120** a person's verification claim is recorded | one `operator_verification_claim` row, byte for byte | **recorded, and then not printed** -- N-18 |

## 5. The fence, and what it refused

**1 refusal in 5 Bash calls (20%)** on the paid lap. Lap 5 was 5 in 29 (17%), lap 4 was 18 in 36
(50%).

| what the worker typed | what happened |
|---|---|
| `cat -A docs/NOTES.md \| tail -5; echo ...; wc -c docs/NOTES.md` | **failed, and was not a refusal** -- see N-16 |
| `node --version; npm --version` | ran |
| `tail -5 docs/NOTES.md; echo ...; wc -c ...; tail -c 1 docs/NOTES.md \| xxd` | **refused**: `xxd` is in no declared subject |
| `git add docs/NOTES.md && git commit -m "..."` | ran |
| `git status --short && git log --oneline -2` | ran |

The one refusal is `xxd`, reached for while inspecting the file's last byte; the worker did the same
inspection with the `Read` tool instead and lost a round trip, not a capability. This is the same
family as lap 5's N-13 -- a declared vocabulary is a list of whole commands and the work is
argument-shaped -- and the cheapest instance of it yet.

**The cross-check is the point.** The worker's own table said one command was refused; rondo's fence
block said *"the fence refused 1 call(s)"* and printed the same command. Two independent accounts of
the same fact, agreeing. That is #122 being verified rather than merely observed, and it is the
thing lap 5's N-3 asked for.

## 6. New findings

### N-16. A worker whose own sandbox fails to initialise is invisible to rondo, and it is not a refusal

The paid lap's **first** Bash call produced no output and was not refused. The worker reported why:

> It failed with `Sandbox is enabled but failed to initialize: EPERM ... listen
> '/tmp/claude-1000/srt-mux-81-1.sock'`. That is an environment-level failure in setting up the
> sandbox itself, before the command ran. **As a result of that error, sandboxing was disabled for
> the remainder of the session, so commands #2-#5 ran unsandboxed.** I'm flagging that explicitly
> since it's a change in execution environment mid-task that rondo's record of this lap may not
> otherwise reflect.

It does not. `permission_denials` carries one entry and it is the `xxd` one; the fence block
therefore reports one refusal and says nothing about the four commands that ran under a weaker
containment than the first one was meant to. rondo's record of *what the fence refused* is exactly
right and its record of *what the fence was* is a declaration, which it already says
(*"This is the run's own declaration, not the whole fence"*). What is missing is a third thing: the
worker's own sandbox is a second fence, it can fail open, and nothing but the worker's prose
reports it.

This is worth an issue because of where the knowledge lives. A worker that had not volunteered the
paragraph would have left a record indistinguishable from a clean run. The candidate remedy is not
for rondo to police the worker's sandbox -- it cannot -- but to notice that the lap's own report is
currently the only channel for it.

### N-17. "rondo read no cost" says the transcript was unreadable when the numbers were simply absent

`spendLine` (`src/refrain/interpreter.ts:1757`) prints, whenever all three values are null:

> rondo read no cost for this lap: its terminal 'result' event was not readable under the state
> root. The row keeps three nulls rather than a zero.

On `lap6-002-r2` that sentence was false in its explanation and true in its conclusion. The
transcript was there and readable; `readLapSpend` found `record.json`, found `events-000.jsonl`,
parsed the `result` event and read it correctly. What it did not find was `total_cost_usd`,
`num_turns` and `duration_ms`, because the fake worker's `result` event does not carry them.

Two different facts -- *rondo could not read the transcript* and *the transcript carried no cost* --
reach one sentence, and the sentence asserts the first. The distinction is exactly the one the
three-nulls-not-a-zero rule exists to preserve, one level up. `readLapSpend` already returns
`NOTHING_READ` for both cases, so telling them apart is a change to what it returns, not a new read.

### N-18. A verification claim longer than 200 characters is recorded and then not printed

`rondo answer --verified=...` wrote the claim to `operator_verification_claim` byte for byte, 318
characters, as `D-0045` rule 1 says. The pull-request body then said:

> Before answering, `happy_ryo` said they had checked: **(claim of 318 characters, not printed
> here)**. That is their own account, recorded before rondo walked the gate; rondo did not run it
> and did not see it run.

`LISTED_LIMIT` is 200 (`src/access/cli.ts:3863`) and `listed()` replaces rather than cuts, for a
good reason it states: a cut summary cannot be told from a wrong one. But the reason does not carry
over to this field. For a commit subject or a path, *"the commit itself is right there to read"*;
for a claim, the body **is** the place it was going, and the row is in a database no reviewer of
that pull request can open.

The direction of the error is what makes it worth raising. `D-0045` rule 6 made an absent claim
print a sentence so that silence would mean only what it says; this prints a sentence that means
*something was said and you may not see it*, to a reader who cannot get at it, for a claim whose
whole purpose is to be read. And nothing at `answer` time warns that the sentence just typed is over
the limit. `D-0045`'s own measured evidence used a short claim, so the cap was never met.

### N-19. The pull-request body describes a retry as a revision answered at a gate

`publish --dry-run` on `lap6-004-r2` printed:

> It revises iteration `lap6-004`, whose commits are on this branch too: it was cut from that lap's
> branch after a person asked for a change at its gate.

Every clause after the first is false for a `D-0047` retry. `lap6-004` has **no** commits -- it was
abandoned at `classify`, before a workspace existed. There was no branch to cut from: `rondo/lap6-004`
was never materialised. And nobody asked for a change at its gate, because it never opened one; what
a person answered was a *proposal*.

The cause is that the sentence is selected on `supersedesIterationId !== null`
(`src/access/cli.ts:4082`), which until #126 meant `rondo revise` and now also means `rondo retry`.
`D-0030` rule 4's requirement -- state the lineage rather than leave it to the branch names -- is
right and should stay; what needs a second spelling is the provenance, because the two lineages are
not the same claim. A reviewer who reads this body will go looking for a predecessor's commits that
are not there.

### N-20. `rondo decide` accepts a digest no option of its proposal carries

`decide --contract-digest sha256:1f8fccc2...` against `contract_keys-lap6-003` was recorded without
complaint, though that digest belongs to `lap6-001`'s option set and no option of this proposal has
ever composed it. It is `retry` that refuses, correctly and fail-closed (section 2).

This is defensible as it stands -- `D-0032` rule 6 makes a decision a ledger entry rather than a
command, and a ledger that edits what it is told is not a ledger -- and it is recorded here as an
observation rather than as a defect. What it costs is that a mistyped or stale digest is discovered
one command later, and the row it leaves behind then shows up under *approved and never spent*
forever, which is where a real unspent approval also lives. Whoever first finds that list noisy has
the decision to make.

## 7. What the walk cost, and where

| | lap 2 | lap 3 | lap 4 | lap 5 | **lap 6** |
|---|---|---|---|---|---|
| `total_cost_usd` | 1.032 | 7.062 | 2.055 | 1.542 | **0.223** |
| turns | 29 | 95 | 43 | 38 | **8** |
| duration | 121.8 s | 724.4 s | 253.6 s | 203.3 s | **32.1 s** |
| refusals / Bash calls | 4 / 29 | 10 / 69 | 18 / 36 | 5 / 29 | **1 / 5** |
| read by hand out of `events-*.jsonl` | yes | yes | yes | yes | **no** |

The cost is not comparable as *work*: lap 5 bought a two-file code change with a test and this one
bought one appended line. It is comparable as *chain*, and the shape of the number is the finding.
**Six of this lap's seven iterations cost nothing**, because the ending `D-0043` fires on is an
ending that spawns no worker, and because continuo's own `fake-claude` stands in for the rest. The
whole of `propose` / `decide` / `retry` / consumption / double-spend / digest-mismatch was walked on
real infrastructure for **$0**; the $0.22 bought the one thing the fake cannot produce, which is a
`result` event with real numbers in it.

The last row is the one lap 5 asked for. `rondo explain`, the report line and the web page all
carry the three values, and nothing in this document was obtained by reading a transcript by hand.

## 8. Verification discipline

- `npm test` with `RONDO_CONTINUO_CLI` set, as CI sets it: **864 passed, 1 skipped, 37 files**.
- The same command with it unset: **863 passed, 2 skipped**. The extra skip is
  `test/continuo/smoke.test.ts:103`'s `skipIf(!available)` -- the real-continuo smoke, which CI
  runs in every matrix cell. Running it with the variable set is what makes the local number the
  same number CI reports.
- The one remaining skip is `test/refrain/classification.test.ts:207`,
  `test.skipIf(process.platform !== "win32")` -- a UNC-path case. Its POSIX twin at `:183` skips on
  the Windows cell instead, so **every cell of the matrix skips exactly one of the pair and runs the
  other**. Nothing hid.
- No source file was changed by this lap, so `lint` / `knip` / `typecheck` were not the subject; the
  suite above is the check that the environment the walk ran in is the environment the tests
  describe.

## 9. What lap 7 should settle

1. **N-14 / #111's other half.** The guard is in and refuses the bad root. What is still unwalked is
   a lap whose *first* step is `npm ci --ignore-scripts` in a workspace with no borrowed toolchain.
   A `--target-repo` lap under the new default answers it in one run, and it is the only way to know
   whether a lap's green suite is now its own.
2. **The `git switch` baseline**, declared for #112 and never yet reached for. It needs a lap whose
   verification comes back red -- which lap 5 got by accident and this one did not.
3. **The other digest mismatch**: recomposition differing because the material really moved, which
   this environment cannot produce (section 2).
4. **`retry` against a `run_plan` or `agent_type` proposal.** `D-0047` rule 8 makes all three kinds
   spendable; only `contract_keys` -- the kind the automatic door emits -- was walked here.
