# lap 3 dogfood -- the answer path closed on its own, and the bill went up seven times

A third walk of the whole arc, taken the same way as
[`lap-2-dogfood.md`](lap-2-dogfood.md): the commands that were actually run and the output that
actually came back. **Lap 2 is the baseline this is a difference against**, so every section below
is written as *fixed / not fixed / new* rather than as a fresh survey.

- Run on 2026-09-12, on `feat/rondo-dogfood-lap-3` at `687e6d1`, against continuo
  `fcf86eb2b7eb34d65bf73188b2b34544fab6820c` and the vendored cadenza
  (`sha256 1d255ecc…`, checked by `node vendor/pin.mjs check`).
- Machine: WSL2 (`Linux 6.18.33.2-microsoft-standard-WSL2`), Node `v22.17.0`, npm `10.9.2`.
- Target: a clone of rondo itself at the same commit, provisioned by
  `scripts/dogfood-env.sh --target-repo`. Request: repair rondo#90 and rondo#91, and run
  `npm run verify` green before committing. It was 58 lines and was passed with `--prompt-file`,
  which is the shape rondo#90 is about.
- **One lap, one iteration `dogfood-090`, $7.06, 95 turns, 724.4 s.** It produced the commit it was
  asked for and reached `closed` **with no hand-typed continuo command at all** -- which is lap 2's
  headline finding (N-1) closed. The headline this time is the other number: the same environment,
  one lap, **6.8x lap 2's cost** (N-8).

---

## 1. The arc, in wall clock

| Step | Wall clock | Hand edits |
|---|---|---|
| `scripts/dogfood-env.sh --target-repo …` | **19.2 s** | **none** |
| `rondo start --prompt-file` | **727 s** (08:11:26 → 08:23:33) | none |
| `rondo answer` (show the gate) | < 1 s | none |
| `rondo answer --body=approve` | **1 s, `closed`** | **none** |

Lap 2's table has three extra rows in the middle of it -- two hand-typed `continuo gate deliver`
commands and the two `rondo answer` invocations they sat between. **They are gone.** One `answer`
walked `present → deliver → ack → answer → deliver → ack` and closed the gate
`answered_and_forwarded`, printing `gate deliver 1 message(s)` on both passes where lap 2's record
has `0 message(s)`.

The provisioning step is slower than lap 2's 11.4 s and that is not a regression: this run used a
cold `--root`, so the 19.2 s includes cloning the pinned continuo, installing it and building it,
on a cold npm cache (126 MB downloaded). Lap 2's 11.4 s was against a warm one.

The lap itself is 6x lap 2's 124 s, for the reason section 5 gives.

## 2. What lap 2 found, and what is true now

| lap 2 | status | evidence in this run |
|---|---|---|
| **N-1** `rondo answer` cannot settle a gate: `gate deliver` is called without `--run-id` | **fixed** (#86, #93) | one `rondo answer --body=approve`, exit 0, gate `answered_and_forwarded`, zero hand-typed continuo verbs. `gate deliver 1 message(s) to 'external-notify' (epoch 2)` and `(epoch 3)` -- the run's own resource, not the empty global one |
| **N-2** a lap may run its verification but may not read its exit status (#87) | **not fixed** | `npm run verify > verify-out.txt 2>&1; echo "exit=$?"; tail -6 verify-out.txt` was refused verbatim, exactly as in lap 2. The worker split it into two commands and read the tail. **And there is more of it than lap 2 saw** -- see N-7 |
| **N-3** nothing rondo records says which commands the lap ran, or that any were refused (#88) | **not fixed** | 10 `permission_denials` sit in this lap's `result` event. No rondo verb prints one. The `review` stage again says, correctly, that it ran nothing and checked nothing |
| **N-4** `standard` is the only tier, and it is the most expensive model (#89) | **not fixed, and now priced** | `model tier: standard` / `model: claude-opus-5` on the `explain` screen, and $7.06 on the bill. See N-8 |
| **N-5** `rondo explain` prints a multi-paragraph request as one line of `\n` (#90) | **fixed by this lap** | section 6 |
| **N-6** `rondo between` repeats its whole basis snapshot under every row (#91) | **fixed by this lap** | section 6 |

Nothing before the gate needed a hand, as in lap 2 -- and this time nothing after it did either.
**The whole arc ran from the commands `dogfood-env.sh` printed.**

## 3. New findings

### N-7. A lap cannot run one test file, so it cannot look at the screen it is repairing (#97)

Lap 2 measured N-2 as *"a lap may run its verification but may not read its exit status"* (#87) and
counted four refusals in 29 turns. This lap took **10 refusals over 69 Bash calls**, and the
expensive ones are a different shape.

The work was a repair to two *screens*. The worker wrote a throwaway
`test/access/scratch-render.test.ts` whose only job was to print the rendered explanation so it
could see it, and then spent seven turns failing to run it:

| what the worker typed | what came back |
|---|---|
| `npx vitest run test/access/scratch-render.test.ts 2>&1 \| head -70` | refused |
| `cd <workspace>; npx vitest run …` | refused |
| `npx vitest run … > /tmp/scratch-out.txt 2>&1; head -60 /tmp/scratch-out.txt` | refused |
| `npm test -- test/access/scratch-render.test.ts 2>&1 \| head -70` | refused |
| `npm test -- test/access/scratch-render.test.ts` | refused |
| `npm run verify > /tmp/verify-out.txt 2>&1` | refused |
| `npm run verify > /tmp/verify-out.txt 2>&1; grep …` | refused |

The plan `scripts/dogfood-env.sh` generates declares
`["npm ci --ignore-scripts", "npm run:*", "node vendor/pin.mjs:*", "node --version", "npm --version"]`,
and three gaps fall out of that list:

- **`npm test` is not `npm run test`.** The declaration is `npm run:*`; `npm test -- <file>`, which
  is the documented way to pass a file to the runner, does not match it.
- **`npx <tool>` is not declared at all**, so no single test file can be run directly.
- **A redirect outside the workspace is refused**, so `$TMPDIR` is not a scratch destination; only a
  file inside the workspace is, which then has to be removed before the commit.

What the worker settled for was running the **whole** suite
(`npm run verify > verify-out.txt 2>&1`, 800 tests) and grepping its captured stdout for the one
screen it wanted -- **five times** over the lap. The repair landed and is correct. It was made by a
worker that could not cheaply look at its own output, and that is turns, and turns are section 5.

This is adjacent to #87 and is not it: #87 is a lap that cannot read an exit status, this is a lap
that cannot run one test. The shared cause is that a declared Bash vocabulary is a list of whole
commands while a lap's real work is argument-shaped.

### N-8. Nothing rondo records says what a lap cost (#96)

The `result` event carries `total_cost_usd`, `num_turns` and `duration_ms`. **rondo persists none of
them.** Not the `iteration` row, not `explain`, not `inbox`, not `between`. The only way to learn
what a lap cost is to find `events-000.jsonl` under `state_root` and parse it by hand -- which is
what all three of these dogfood records have had to do to write their cost sections.

`invocationCeilingMs` bounds a lap in *time*, which is a different quantity: this lap ran well
inside its ceiling and cost nearly seven times lap 2. A lap is the one thing rondo does that spends
money, and its cost is the one fact about a lap rondo does not keep.

Adjacent to #89 and not it: #89 is *which model runs*; this is that whatever ran, **#89's effect
cannot be measured from anything rondo holds.**

### N-9. The suite is one test shorter unless the pinned continuo is on the environment

Not a defect and worth writing down once, because it is the kind of difference that reads as a
regression. `npm run verify` in this worktree reported `801 passed | 2 skipped`, where the lap
reported `802 passed | 1 skipped`. The difference is `test/continuo/smoke.test.ts`, which
`skipIf`s itself when `RONDO_CONTINUO_CLI` is unset, and the fenced worker inherited it while a
bare shell does not. Sourcing `env.sh` first reproduces the lap's numbers exactly
(`802 passed | 1 skipped`, exit 0). **The skip names itself in the test's own title**, which is why
this is a footnote rather than a finding.

## 4. Where the lap did *not* have to be helped

Everything. Provisioning, the plan, the spawn, the fence, the worker's own install, its reading of
the two issues, its edits, its verification, its commit, and -- new this lap -- **the gate**. Lap 1
recorded a long list of manual interventions, lap 2 recorded two, and this lap records none.

## 5. Cost

From the terminal `result` event:

| | lap 1 (trivial) | lap 1 §11 (`verify`) | lap 2 | **lap 3** |
|---|---|---|---|---|
| `total_cost_usd` | 0.167 -- 0.184 | 0.58 | 1.032 | **7.062** |
| turns | -- | 13 | 29 | **95** |
| duration | 18 -- 21 s | -- | 121.8 s | **724.4 s** |

Two things are in that step from $1.03 to $7.06 and they are worth separating.

**The work was genuinely bigger.** Lap 2 repaired the wording of three files (`+16 -4`). This lap
read two issue bodies, traced two renderers through `src/access/advisory.ts`, `src/access/cli.ts`
and `src/advisory/proposal.ts`, wrote 221 lines of renderer and 122 lines of test, and updated the
runbook (`+355 -7`). Sixty-nine Bash calls, 18 edits, one file written, six reads.

**And the fence charged for itself.** Ten of those calls were refused, and the seven of N-7 were
refused in pursuit of one thing -- *seeing the screen* -- which was then bought at the price of five
full suite runs instead. That is not a rounding error at 95 turns.

It is worth saying plainly what is not in the step: **the ceiling never fired**, nothing was
retried by rondo, and no lap was run twice. $7.06 is what one successful lap of ordinary size costs
at the only tier `MODEL_TIER_TABLE` prices (#89).

## 6. The work the lap produced

`f6a0edd` on `rondo/dogfood-090`, four files, `+355 -7`: rondo#90 and rondo#91 repaired in
`src/access/advisory.ts`, two regression tests, and a paragraph each in sections 7.1 and 7.5 of
[`rondo-cli.md`](rondo-cli.md). `npm run verify` exit 0, 32 test files, 802 passed, 1 skipped. It is
the commit this branch carries.

**#90, before and after**, on the same row (`rondo explain --iteration-id dogfood-090`):

```
  request: Repair two rendering defects in this repository (rondo): issue #90 and issue #91.
Both were measured in `docs/operations/lap-2-dogfo…
```

```
  request: 58 lines, 3014 characters, quoted in full:
    | Repair two rendering defects in this repository (rondo): issue #90 and issue #91.
    | Both were measured in `docs/operations/lap-2-dogfood.md` (findings N-5 and N-6),
    | which is committed here and is worth reading for the observed output. The issue
    …
      basis: snapshot /iteration/request = the value quoted above, in full
```

**#91, before and after** (`rondo between`). Before, with one live lap, the same 200-character
prefix of a 4008-character document under each of three claims:

```
  live laps: 1
      basis: snapshot /laps = [{"iteration":{"id":"dogfood-090","status":"performing","request":"Repair two rendering… (4008 chars)
  two live laps open against one base branch: none
      basis: snapshot /laps = [{"iteration":{"id":"dogfood-090","status":"performing","request":"Repair two rendering… (4008 chars)
  one finding read on more than one live lap: none
      basis: snapshot /laps = [{"iteration":{"id":"dogfood-090","status":"performing","request":"Repair two rendering… (4008 chars)
```

After, the three facts two lines apart and the document once, at the foot, with what rests on it
named:

```
  live laps: 0
      basis: snapshot /laps (cited once below)
  two live laps open against one base branch: none
      basis: snapshot /laps (cited once below)
  one finding read on more than one live lap: none
      basis: snapshot /laps (cited once below)
  …
  cited once, because more than one claim above rests on it:
    snapshot /laps = []
        3 claims rest on it: 'live laps', 'two live laps open against one base branch', 'one finding read on more than one live lap'
```

Both repairs were checked by planting the defect back and watching the suite go red, rather than by
reading a green run:

| mutation | result |
|---|---|
| `labelled()` always takes its single-line branch | `advisory.test.ts` red at the `quoted in full` assertion |
| `legibleAsciiEscape(value)` → `value` in `labelled()` | `advisory.test.ts` red at the em-dash assertion |
| `hostLines()` passes no shared pointers and cites none | `between.test.ts` red: `snapshot /laps = ` appears 3 times, expected 1 |

## 7. What to write down

The falsifier `dogfood-lap.md` names -- a shape the decoders did not expect -- did not fire: every
`LAP_PERFORM` field decoded, `session_path` was a walk name and not a path, and the gate was at
`received` when `start` returned. What did change between laps 2 and 3 is **the price of a lap**,
which nothing in rondo measures (N-8), and that is the number the next lap should be read against.
