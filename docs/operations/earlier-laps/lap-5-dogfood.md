# lap 5 dogfood -- the lap ran one test file, said its verification failed, and was wrong about why

A fifth walk of the whole arc, taken the same way as
[`lap-4-dogfood.md`](lap-4-dogfood.md): the commands that were actually run and the output that
actually came back. **Lap 4 is the baseline this is a difference against**, so every section below
is written as *fixed / not fixed / new* rather than as a fresh survey.

- Run on 2026-09-12, on `feat/rondo-dogfood-lap-5` at `91e6fc3`, against continuo
  `fcf86eb2b7eb34d65bf73188b2b34544fab6820c` and the vendored cadenza
  (`sha256 1d255ecc…`, checked by `node vendor/pin.mjs check`).
- Machine: WSL2 (`Linux 6.18.33.2-microsoft-standard-WSL2`), Node `v22.17.0`, npm `10.9.2`.
- Target: a clone of rondo itself at `91e6fc3`, provisioned by
  `scripts/dogfood-env.sh --target-repo`. Request: fix rondo#22 -- the report line that predicts a
  duration nothing measures. It was 40 lines and was passed with `--prompt-file`.
- **One lap, one iteration `dogfood-200`, $1.542, 38 turns, 203.3 s.**
- **The work was code, and it was chosen so that running one test file would be the obvious thing
  to do.** That is the thing this lap existed to measure, and it worked: `npm test:*` was used
  three times, twice in the single-file form that `npm run:*` alone does not admit (section 2).
- **The lap committed.** Lap 4 did not, because its request asked for output the fence would not
  produce; this request named only commands the plan declares.
- **The lap's account of its own failing verification was wrong, and it said so itself.** It
  reported `EXIT=1`, attributed it to a pre-existing package.json defect, and noted that every way
  of checking that attribution was refused by the fence. The real cause was that the lap never
  installed (section 4, N-13 and N-14).

---

## 1. The arc, in wall clock

| Step | Wall clock | Hand edits | Terminal |
|---|---|---|---|
| `scripts/dogfood-env.sh --target-repo …` | **12.0 s** | none | operator's |
| `rondo start --prompt-file` | **205.5 s** (11:04:05 → 11:07:31) | none | operator's |
| read the gate (`rondo answer` with no `--body`) | not timed | none | operator's |
| answer the gate (`rondo answer --body=approve`) | **~1 s** (11:11:01 → 11:11:02) | none | operator's |

Lap 4's answer was a click on `rondo web`; this one was two `rondo answer` commands, because the
person who would have pressed the button was asleep and the operator settled it instead. That is a
difference in who answered, not in what the page can do: D-0041 and D-0042 are unchanged and
unretested here. The ledger below is the same shape lap 4 recorded.

```
seq 1  open     ->received    system     lap_composition_root
seq 2  advance  received  ->presented    secretary  happy_ryo
seq 3  advance  presented ->answered     human      happy_ryo   body='approve'
seq 4  advance  answered  ->forwarded    secretary  happy_ryo
seq 5  close    forwarded ->forwarded    system     happy_ryo
```

Provisioning was 12.0 s against 15.3 s, and the difference is that continuo was already built at
the pinned revision from lap 4's environment rather than anything that changed in the script.

## 2. What lap 4 found, and what is true now

| lap 4 | status | evidence in this run |
|---|---|---|
| **N-11 / #104** #97's repair is in the plan and has never been reached by a lap | **fixed, and confirmed effective** | the lap ran `npm test -- test/refrain/interpreter.test.ts` twice and `npm test` once. The single-file form is exactly what `npm run:*` does not admit and `npm test:*` does. **#97 is now confirmed present *and* effective** |
| **N-2 / #87** a lap may run its verification but may not read its exit status | **fixed, and load-bearing** | `npm run verify; echo "EXIT=$?"` ran and returned **`EXIT=1`**, and the lap carried that number to the gate. Section 3 is why this mattered more than it looks |
| **N-10 / #103** a lap cannot evaluate an expression | **not exercised** | the request named no `node -e`, and the lap never reached for one. Zero of this lap's five refusals are `node`. Neither confirmed nor refuted here |
| **N-3 / #88** nothing rondo records says which commands the lap ran, or that any were refused | **not fixed** | **5** `permission_denials` sit in this lap's `result` event. `rondo explain --iteration-id dogfood-200` prints none of them; the `review` stage again says, correctly, that it ran nothing |
| **N-4 / #89** `standard` is the only tier, and it is the most expensive model | **not fixed** | `model tier: standard` / `model: claude-opus-5` on the `explain` screen |
| **N-8 / #96** nothing rondo records says what a lap cost | **not fixed** | `explain` prints 20 claims about `dogfood-200` and none of them is a number of dollars, turns or milliseconds. The figures in this document were parsed out of `events-000.jsonl` by hand, for the fifth lap running |
| **N-12** most of lap 4's refusals were the workspace boundary | **changed shape** | one of five here is a path outside the workspace (`> "$TMPDIR/verify.log"`). The other four are one question: section 4, N-13 |

## 3. The headline: #97 and #87 were both walked, and #87 caught a false green

The request was chosen so that running a single test file would be the natural thing to do: a
one-line change to a report in `src/refrain/interpreter.ts`, and a test for it in
`test/refrain/interpreter.test.ts`, a 1,904-line file whose full suite is 33 files and 816 tests.
A worker that has `npm test:*` reaches for the file; a worker that has only `npm run:*` runs all of
it or nothing.

It reached for the file. Three `npm test` calls in the whole lap:

| what the worker typed | why |
|---|---|
| `npm test -- test/refrain/interpreter.test.ts` | after writing the new test |
| `npm test -- test/refrain/interpreter.test.ts` | after putting the **old** line back, to check the test actually fails |
| `npm test` | once, before committing |

The middle one is worth its own sentence. The worker mutated its own change back to the old line to
confirm the new test was load-bearing, ran the one file, saw it fail, and restored. That is a
mutation check, and **it is only affordable because one file costs 1.8 s and the suite costs more**.
The Bash spelling of that mutation (`cp … && python3 - <<EOF`) was refused; the worker did the same
edit with the `Edit` tool instead, which the fence does not gate. The refusal cost a round trip and
not the capability.

**#87 then caught a lie.** The first verification the worker ran was

```
npm run verify 2>&1 | tail -40; echo "EXIT=$?"
```

which printed **`EXIT=0`** -- because `$?` after a pipeline is `tail`'s status, not `verify`'s. The
knip failure was right there in the output it had just printed, and the exit status said green. The
worker then tried to redirect to a file (`> "$TMPDIR/verify.log"`, refused: outside the workspace)
and finally typed the shape #87 was repaired for:

```
npm run verify; echo "EXIT=$?"      ->  EXIT=1
npm run lint …; echo "lint=$?" …    ->  lint=0  knip=1  typecheck=0
```

So the value of `echo:*` here was not that the lap could report a red. It was that the lap could
**correct a false green it had produced itself**, without leaving the declared vocabulary. Lap 3's
question ("can a lap say its verification failed?") is answered yes; the sharper question this lap
adds is that the *first* spelling a worker reaches for reports the wrong number, and only the second
one is true.

## 4. New findings

### N-13. A lap cannot make a second copy of its own tree, so it cannot check whether a failure predates it

Four of this lap's five refusals are one question asked four ways: *give me the tree at `HEAD` so I
can see whether `knip` was already failing before I touched anything.*

| what the worker typed | what came back |
|---|---|
| `git stash push -u -m "dogfood-200-knip-baseline" …` | refused |
| `mkdir -p .worker-baseline-tmp && cp … && git checkout HEAD -- …` | refused |
| `git worktree add --detach "$TMPDIR/knip-baseline" HEAD` | refused |
| `cp src/refrain/interpreter.ts /tmp/interp.bak && python3 - <<EOF` | refused |

The plan declares `npm`, three fixed `node` invocations and `echo`. It declares no `cp`, no `mkdir`,
no `python3`, and continuo's read-only git vocabulary does not extend to `stash`, `worktree` or a
pathspec `checkout`. There is no shape left that produces a second copy of the tree.

The lap said so at the gate, in its own words: *"I could not empirically confirm the knip failure at
HEAD -- `git worktree` is blocked by a permission rule here… If you want it confirmed directly,
`git checkout HEAD~1 && npm run knip` on a scratch checkout would settle it."* It then made the
judgement anyway, from the shape of the findings rather than from a measurement, and committed.

**The judgement was wrong** (N-14), and the interesting part is that the honesty did not save it:
the caveat was accurate, prominent, and still ended in a commit whose message states a wrong cause.

This is the fourth instance of the family #87, #97 and #103 belong to -- a declared Bash vocabulary
is a list of whole commands, while a lap's real work is argument-shaped -- but it is the first where
the casualty is not a capability the lap wanted. It is the lap's ability to check its *own account
of what it did*. One near-miss makes the cost concrete: after the `mkdir`/`cp` backup was refused,
the worker's next command was
`ls .worker-baseline-tmp && git show HEAD:src/… > src/… && …`, which would have overwritten its
uncommitted work with `HEAD`. It survived because `ls` failed on the directory the refusal had
prevented, and `&&` short-circuited. **The refusal of the backup is what saved the work from the
restore that followed it.**

### N-14. The dogfood environment is not hermetic: a lap that never installs still passes

The lap never ran `npm ci --ignore-scripts`, which is in the plan's `allowed_bash` and which
`AGENTS.md` puts first in the repository's own order (`node vendor/pin.mjs check && npm ci
--ignore-scripts && npm run verify`). Its workspace has no installed dependencies at all:

```
$ ls -a …/workspaces/iter-dogfood-200/node_modules
.  ..  .cache  .vite  .vite-temp
```

And yet `npm run build`, `npm run lint`, `npm run typecheck` and `npm test` (33 files, 815 passed)
all ran and exited 0. They ran because **npm prepends every ancestor directory's `node_modules/.bin`
to `PATH`**, and the workspace has an ancestor that is installed:

```
…/rondo-dogfood-lap-5/node_modules/.bin        <- the operator's own checkout, installed by hand
…/rondo-dogfood-lap-5/.worker-scratch/dogfood-env/workspaces/iter-dogfood-200
```

That nesting is the default: `scripts/dogfood-env.sh`'s `--root` defaults to
`<repo>/.worker-scratch/dogfood-env`, for the good reason written beside it (the root `.gitignore`
already excludes it, so a control plane cannot end up one `git add -A` from a commit). The
consequence was not foreseen there: **the lap's workspace is cut inside a checkout that is
installed, so the lap's toolchain resolves to the operator's.**

`knip` is the only step of `verify` that notices, because it is the only one that reads
`package.json` against what is actually installed locally. Its findings say exactly that and nothing
else -- `@biomejs/biome` unused, `tsc` / `biome` / `knip` / `vitest` unlisted -- and they are what
the lap read as a pre-existing package.json defect.

Measured outside the fence afterwards, both directions:

```
$ cd …/workspaces/iter-dogfood-200 && npm run knip          -> the four findings, non-zero
$ npm ci --ignore-scripts && npm run knip                    -> exit 0
$ cd …/rondo-dogfood-lap-5 && npm run verify; echo "EXIT=$?" -> EXIT=0   (with this lap's commit applied)
```

So the lap's `EXIT=1` was caused by the lap not installing, and the commit message's account of it
is wrong. The diff itself is correct, and the suite is green in a checkout that has its own
dependencies.

**The reason this is worth an issue rather than a note is the direction of the error.** A lap that
does not install gets a *green* build, lint, typecheck and test suite out of somebody else's
`node_modules`. Everything this arc records about a lap's verification -- including #87's whole
point, that a lap can now state its exit status -- rests on that suite meaning what it says. Here it
did not, and the only step that dissented was read as noise.

### N-15. `npm run verify 2>&1 | tail -N; echo "EXIT=$?"` reports the pipe's status, not the run's

Section 3 has the measurement. This is a property of the shell rather than of rondo, and the fence
neither causes it nor could catch it, but it is worth writing down because the piped form is the one
a worker reaches for first (it keeps the output short) and because the failure is silent and
green-coloured. A lap that types only that form reports success for a failing verification. `echo:*`
is what makes the correct form available; nothing makes it the form that gets typed.

## 5. Cost

From the terminal `result` event:

| | lap 1 §11 | lap 2 | lap 3 | lap 4 | **lap 5** |
|---|---|---|---|---|---|
| `total_cost_usd` | 0.58 | 1.032 | 7.062 | 2.055 | **1.542** |
| turns | 13 | 29 | 95 | 43 | **38** |
| duration | -- | 121.8 s | 724.4 s | 253.6 s | **203.3 s** |
| refusals / Bash calls | -- | 4 / 29 | 10 / 69 | 18 / 36 | **5 / 29** |

The refusal rate is the number that moved: 50% of Bash calls in lap 4, 17% here, and the cause is
the request rather than the fence, which is unchanged between the two laps. Lap 4's request asked
for the output of a command the plan does not declare, and seven of its eighteen refusals were that
one question. This request named only `npm test -- <file>` and `npm run verify; echo "EXIT=$?"`,
both declared, and the plan was read before the request was written rather than after.

Four of the five refusals that remain are N-13's single question, which the request did not ask for
and could not have avoided: the worker went looking for a baseline because its verification came
back red.

$1.54 for a two-file code change with a test, at the only tier `MODEL_TIER_TABLE` prices (#89), is
the number to carry forward. The ceiling never fired, nothing was retried, and no lap ran twice.

What the table cannot show, for the fifth lap running, is that **rondo holds none of it** (#96).

## 6. The work the lap produced, and where it went

`src/refrain/interpreter.ts` `+10 -1` and `test/refrain/interpreter.test.ts` `+15 -0`, committed by
the lap as `dc6e86b` on `rondo/dogfood-200`.

`performStep` used to announce the lap as `"Sending one lap; this is the step that takes minutes."`
It now states the plan's `invocationCeilingMs` -- the operator's declared patience, which the step
already holds -- instead of predicting a duration rondo has no basis for. The new test drives a full
admission through `performLap` and asserts the report names the ceiling and does not say
`takes minutes`.

The transcripts in `docs/operations/rondo-cli.md` and the `lap-*-dogfood.md` records still quote the
old line, and the request said to leave them: they are transcripts of runs that happened.

**That work is on this branch as the lap's own commit**, carried over with `git format-patch` /
`git am` so the author, the date and the message are the lap's and not the operator's. This document
is a separate commit. Lap 4's repair was carried by hand because the lap never committed; this one
was not, and keeping the two spellings distinct is the point of the distinction.

## 7. Findings to raise

Drafted here, in English, as candidate issue bodies. Filing is the secretary's.

**The dogfood environment is not hermetic, so a lap that never installs still passes.**
`scripts/dogfood-env.sh` defaults `--root` to `<repo>/.worker-scratch/dogfood-env`, which puts every
lap workspace inside the rondo checkout the operator runs the script from. npm prepends every
ancestor's `node_modules/.bin` to `PATH`, so a lap that never runs `npm ci --ignore-scripts` still
gets a working `tsc`, `biome`, `knip` and `vitest` -- the operator's. Lap `dogfood-200` did exactly
that: its workspace `node_modules` holds only vitest's caches, and `npm run build`, `npm run lint`,
`npm run typecheck` and `npm test` (815 passed) all exited 0 against the operator's toolchain. Only
`knip` dissented, with the four findings that mean "nothing is installed here"
(`@biomejs/biome` unused; `tsc`, `biome`, `knip`, `vitest` unlisted), and the lap read them as a
pre-existing package.json defect and committed. A lap's green suite is the evidence #87's whole
repair exists to let it report; this is that evidence being borrowed. Candidate remedies: default
`--root` outside the repository, or have the generated request/plan require the install, or both.
Measured in `docs/operations/lap-5-dogfood.md` (N-14), lap `dogfood-200`, 2026-09-12.

**A lap cannot make a second copy of its own tree, so it cannot check whether a failure predates
its change.** `git stash push`, `git worktree add`, a pathspec `git checkout HEAD -- …` and a `cp`
backup are all refused for a lap, and the plan declares no `cp`, `mkdir` or `python3`. Lap
`dogfood-200` tried all four in sequence, trying to establish whether the `knip` failure it had just
observed existed before its own two-file change; it said at the gate that it could not confirm the
attribution, then made the judgement from the shape of the findings and committed a message that
states a wrong cause. This is the same family as #87, #97 and #103 -- a declared Bash vocabulary is
a list of whole commands, while a lap's real work is argument-shaped -- and it is the first instance
where what the lap loses is the ability to verify its own account of what it did. One near-miss
makes the cost concrete: with the backup refused, the lap's next command chained the restore
(`ls .worker-baseline-tmp && git show HEAD:… > src/…`) and was saved only by `&&` short-circuiting
on the directory that the refusal had prevented. Measured in
`docs/operations/lap-5-dogfood.md` (N-13).

**`npm run verify 2>&1 | tail -N; echo "EXIT=$?"` reports the pipe's exit status, not the run's.**
Lap `dogfood-200` typed that form first, got `EXIT=0` for a verification whose `knip` step had just
failed in the output above it, and only reached the true `EXIT=1` after typing
`npm run verify; echo "EXIT=$?"`. This is the shell rather than rondo, and the fence neither causes
it nor could catch it, but the piped form is the one a worker reaches for (it keeps the output
short) and its failure mode is silent and green. Worth a line in whatever a lap is told about
reporting its verification. Measured in `docs/operations/lap-5-dogfood.md` (N-15).

**#104 can be closed.** `npm test:*` was reached for three times by lap `dogfood-200`, twice in the
single-file form `npm test -- test/refrain/interpreter.test.ts` that `npm run:*` does not admit, and
once for the whole suite. #97's repair is now present *and* exercised. Measured in
`docs/operations/lap-5-dogfood.md` (section 3).

## 8. What to write down next time

Lap 5's request was written **after** reading the generated plan's `allowed_bash`, and named only
commands it declares. That is what lap 4 said to do, and the refusal rate fell from 50% of Bash
calls to 17% -- with the remaining four being a question the request did not ask.

The thing lap 6 should settle is N-14: whether a lap's verification is its own. Until the workspace
stops inheriting an installed toolchain from the checkout it happens to be nested inside, a lap's
green suite is not evidence that the lap could have produced it alone. A lap 6 pointed at a
`--root` outside the repository would answer it in one run, and would also tell us what a lap does
when `npm ci` is genuinely its first step.
