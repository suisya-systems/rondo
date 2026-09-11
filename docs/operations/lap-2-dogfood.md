# lap 2 dogfood -- what the day's nine changes moved, and where the lap now stops

A second walk of the whole arc, taken the same way as
[`lap-1-dogfood.md`](lap-1-dogfood.md): the commands that were actually run and the output that
actually came back. Lap 1 is the baseline this is a difference against, so every section below is
written as **fixed / not fixed / new** rather than as a fresh survey.

- Run on 2026-09-12, on `feat/rondo-dogfood-lap-55` at `a2652ea`, against continuo
  `fcf86eb2b7eb34d65bf73188b2b34544fab6820c` and the vendored cadenza
  (`sha256 1d255ecc…`, checked by `node vendor/pin.mjs check`).
- Machine: WSL2 (`Linux 6.18.33.2-microsoft-standard-WSL2`), Node `v22.17.0`, npm `10.9.2`.
- Target: a clone of rondo itself at the same commit, provisioned by
  `scripts/dogfood-env.sh --target-repo`. Request: fix rondo#55, and run `npm run verify` green
  before committing.
- **One lap, one iteration `dogfood-055`, $1.03, 29 turns, 121.8 s.** It produced the commit it was
  asked for and reached `closed` -- but only after two hand-typed continuo commands that no runbook
  names. That is the headline: **`rondo answer` cannot settle a gate at this pin without operator
  intervention** (N-1).

---

## 1. The arc, in wall clock

| Step | Wall clock | Hand edits |
|---|---|---|
| `scripts/dogfood-env.sh --target-repo …` | **11.4 s** | **none** |
| `rondo start --prompt-file` | **124 s** (07:23:14 → 07:25:18) | none |
| `rondo answer` (show the gate) | < 1 s | none |
| `rondo answer --body=approve` | 1 s, **refused** | -- |
| `continuo gate deliver --run-id …` (by hand) | < 1 s | **workaround 1** |
| `rondo answer --body=approve` | 1 s, **refused one stage later** | -- |
| `continuo gate deliver --run-id …` (by hand) | < 1 s | **workaround 2** |
| `rondo answer --body=approve` | 1 s, `closed` | -- |

Lap 1 filled 31 plan fields by hand and rebuilt its plan for every change of target. **This run
hand-edited nothing before the lap**: `--target-repo` wrote all four fields that must agree about
the target, and `--prompt-file` carried a 41-line request the plan's placeholder would otherwise
have had to hold. Both are new today (#72) and both worked first time.

## 2. What lap 1 found, and what is true now

| lap 1 | status | evidence in this run |
|---|---|---|
| **F-1** post-spawn read-back window too short | **fixed** | `identity_readback_timeout_ms: 120000` is written by the script; the spawn was never close to it |
| **F-2** nothing selects the worker's model | **half fixed** | `rondo explain` says `model tier: standard` / `model: claude-opus-5`. rondo now *names* the model -- but `MODEL_TIER_TABLE` (`src/continuo/roles.ts:184`) has exactly one entry, so the only tier rondo prices is the most expensive model. See N-4 |
| **F-3** rondo cannot be driven without compiling it first | **unchanged, and correct** | the script builds it; `node bin/rondo.mjs` is the surface |
| **F-4/F-5/F-6/F-7** provisioning and plan-shape traps | **fixed** | the script writes the plan; `parties.grantee` and the cadenza catalog layer were both generated and neither was refused |
| **F-10** `pin.mjs check` says nothing when it passes | **fixed** | it prints the digest, twice in this run |
| **F-12** the report claims a status it did not read | **fixed** | the `start` report names the reserved row, the admitted run and the gate, each as a fact it wrote |
| **F-13** single-flight holds the lock across the human suspend | **fixed** | `rondo inbox` during the lap: `in flight (1)`, and `between` reports `bound 'maxOccupying': 1 / occupying now: 1`, `maxLive: 3 / live now: 1`. An iteration at a gate no longer occupies a slot |
| **F-14** the row does not say what stage the gate is at | **fixed** | `rondo explain` prints `gate stage: received`, with its basis |
| **F-15** "this is the step that takes minutes" was off by an order of magnitude | **now true** | the lap took 124 s. The line is accurate for a lap that does real work |
| **F-16** which outcomes `gate close` accepts is learned by being refused | **fixed on the answering side** | the gate screen prints `options ["approve", "revise"]` before you type, so the answer path no longer teaches by refusal. The stage-dependence of `gate close` itself was not exercised by this run |
| **F-17** a compound command is refused, and the refusal reaches the report | **not fixed, and worse than lap 1 measured** | see N-2 |
| **F-18** the child's own sandbox failed to initialise | **not fixed** | identical message, same cause (`EPERM … listen '/tmp/claude-1000/srt-mux-82-1.sock'`). What this run measures is again the allow list and not the sandbox |

Today's nine changes land as follows. **#68 (gate readability), #69 (the review stage says what it
did not look at), #71 (workspace path on the in-flight line), #72 (`--target-repo` / `--prompt-file`)
and #40 (`rondo between`) all did what they were built to do and are visible in the transcripts
below.** #67's acceptance (a lap can verify its own work) held in the sense that `npm run verify`
ran and exited 0 -- but it took the worker **five attempts** to get there (N-2), which the lap-1
measurement of #67 did not surface because that run never had to read an exit status.

## 3. New findings

### N-1. `rondo answer` cannot settle a gate: `gate deliver` is called without `--run-id`

**The blocking one.** Every `rondo answer` printed `gate deliver 0 message(s) to 'external-notify'`
and then died on continuo's ack:

```
  gate present   message relay/…/presented (enqueued: true)
  gate deliver   0 message(s) to 'external-notify' (epoch 1)
continuo gate ack refused (OutboxUsageError): 'relay/…/presented' has not been delivered;
  an ack for an undelivered message is evidence of a lost delivery record, not of a delivery
```

The outbox row is real and on the run's own resource:
`delivery_resource = "outbox-delivery:run:rondo-dogfood-055"`. continuo's `gate deliver` takes
`--run-id` and says why in its own help: *"A gate's relays carry the gate's run, so draining them
after the lap has exited needs this argument (D-1104)."* **rondo never passes it.**
`deliverGate` (`src/continuo/invoker.ts:1045-1085`) builds `--db`, `--destination-dir`, `--holder`
and nothing else, and its doc comment still says *"It takes the global `outbox-delivery` lease"* --
true of the continuo the comment was written against, false at the pin. So rondo drains the global
resource, which is empty, while the gate's relay waits on the run's.

The same wall is hit twice per gate, once per relay (`presented`, then `forwarded`), so settling one
gate needed two hand-typed deliveries and three `rondo answer` invocations:

```sh
node "$RONDO_CONTINUO_CLI" gate deliver --db …/control-plane.sqlite3 \
  --destination-dir …/dropbox --holder operator-manual --run-id rondo-dogfood-055 --json
# {"ok":true,…,"delivered":[{"message_id":"relay/…/presented",…}]}
```

This is not environment-specific and not a race: it is an argument rondo does not send. **No lap can
be closed through rondo's own surface at this pin.** It was not caught because `answer` has no test
against a real control plane, and lap 1 ran before `D-1104` moved gate relays onto the run's
resource.

**Repaired in #86, and re-measured on this environment.** The run id now comes off the `gate show`
payload and goes onto the `gate deliver` argv, and one `rondo answer` closes the gate
`answered_and_forwarded` with no hand-typed continuo command: `gate deliver 1 message(s)` on both
passes where this record has `0 message(s)`. The test hole is closed at the seam rather than at the
`answer` path as a whole -- `test/continuo/smoke.test.ts` drives `deliverGate` against the pinned
build and reads the per-resource delivery epoch, which is what tells the run's queue apart from the
global one without a lap to fill either.

### N-2. A lap may run its verification but may not read its exit status

`npm run verify` was refused **four times** before it ran, in three distinct shapes, all recorded in
the session's `permission_denials`:

| what the worker typed | what came back |
|---|---|
| `npm run verify 2>&1 \| tail -60; echo "EXIT=${pipestatus[1]}"` | `Contains expansion` |
| `npm run verify > "$TMPDIR/verify.log" 2>&1; echo "EXIT=$?"; tail -60 …` | `Redirect target contains $(cmd) output — path is runtime-determined` |
| `npm run verify 2>&1; echo "EXIT=$?"` | `This Bash command contains multiple operations. The following part requires approval: echo "EXIT=$?"` |
| `npm run verify > /dev/null 2>&1; echo "verify exit status: $?"` | same |

What finally worked was `npm run verify 2>&1` (output, no status) and then
`npm run verify > /dev/null 2>&1 && echo "verify exit status: 0 (green)"`. **The `&&` form can only
report success**: had verify failed, the echo would not have run and the worker would have had to
infer the result from prose. A declaration bounds a command, and F-17 already noted that a declared
subject inside a compound is still two operations -- but lap 1 read that as a one-turn nuisance.
Measured against a request that asks for an exit status it is structural: **the one thing #67 exists
to let a lap do, it cannot do cleanly.** Four of twenty-nine turns, and a reporting path that is
green-only.

The cheapest repair is on the declaring side: `dogfood-env.sh` could declare `echo:*` alongside the
verification commands, or the request could ask for output rather than status. Neither is obviously
right, which is why this is a finding and not a patch.

### N-3. Nothing rondo records says which commands the lap ran, or that any were refused

The gate screen's `why` is the worker's own prose -- *"`npm run verify` exit status: 0 … 798 tests
passed"* -- and the review stage says, correctly and in three lines, that it checked none of it:

```
review  read the commits and the files, and raised nothing (rondo/deterministic/1).
        It built nothing, ran nothing and tested nothing: rondo cannot run a lap's work.
        Whether the verification this lap was asked for ran is neither checked nor claimed here.
        It read committed history only, and it cannot tell whether the lap did what was asked.
```

That is #69 working: the screen no longer implies a check it did not make. What it leaves is a
hole the operator cannot fill from anything rondo holds. **The four denials of N-2 are structured
data in the `result` event's `permission_denials`** -- exactly what `D-0039` rule 4 asked continuo
for, and `continuo D-1110`'s sixth point delivering -- **and rondo reads none of it.** Neither
`rondo answer`, `rondo explain` nor the store's rows mention that the lap fought its fence four
times over the command the request was about. `D-0039` rule 5 left the consuming side to rondo#69;
after today's work #69's *disclosure* half has shipped and its *reading* half has not, and the gap
between them is now the sharpest thing on the screen.

The delegation record (`D-0040`) has the same shape from the other side: `delegation_record` in the
control plane carries the full `allowed_bash` under an envelope digest, and **no rondo verb prints
it**. Reading what a run was allowed to do takes a SQL client.

### N-4. `standard` is the only tier, and it is the most expensive model

`MODEL_TIER_TABLE` (`src/continuo/roles.ts:184-186`) is one entry: `standard: "claude-opus-5"`.
F-2's repair made the choice explicit and recorded; it did not make a cheaper choice reachable.
This lap cost **$1.03** for a three-file wording repair. Lap 1's trivial laps were $0.17 and its
`verify` lap $0.58.

### N-5. `rondo explain` prints a multi-paragraph request as one line of `
`

The `request:` line renders the 2154-character prompt with literal `
` in place of every
newline, on one unwrapped line, and then repeats a 200-character prefix of the same text as its
basis. A request passed with `--prompt-file` is by construction the long kind, so the flag that
made long requests possible (#72) made this line unreadable. Same family as #68, one screen over.

### N-6. `rondo between` repeats its whole basis snapshot under every row

Three consecutive rows (`live laps`, `two live laps open against one base branch`, `one finding read
on more than one live lap`) each print the same truncated `snapshot /laps = [{…}]` blob, which for
this run was 3104 characters of the request text. The three facts differ; their basis does not.
With one live lap the screen is already mostly one repeated string.

## 4. Where the lap did *not* have to be helped

Worth recording because lap 1's list of manual interventions was long: **nothing before the gate
needed a hand.** Provisioning, the plan, the spawn, the fence, the worker's own install, its edit,
its verification and its commit all ran from the printed commands. Both interventions were on the
`answer` path, and both were the same defect (N-1).

## 5. Cost

From the terminal `result` event:

| | lap 1 (trivial) | lap 1 §11 (`verify`) | **lap 2** |
|---|---|---|---|
| `total_cost_usd` | 0.167 -- 0.184 | 0.58 | **1.032** |
| turns | -- | 13 | **29** |
| duration | 18 -- 21 s | -- | **121.8 s** |

The step from $0.58 to $1.03 is real work plus the four refused turns of N-2.

## 6. The work the lap produced

`c1edfd2` on `rondo/dogfood-055`, three files, `+16 -4`: rondo#55's repair, the decoder test's
comment, and two regression assertions. `npm run verify` exit 0, 32 test files, 798 passed,
1 skipped. It is the commit this branch carries.

`rondo publish --dry-run` refused, correctly and legibly, because the target clone's `origin` is a
path on this disk and not an `OWNER/NAME` on a forge -- the same refusal lap 1 recorded, now with
the sentence that says what `--allow-remote-mismatch` is for.
