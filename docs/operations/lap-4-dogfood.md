# lap 4 dogfood -- a person answered from a page, and the fence refused the page's own handbook

A fourth walk of the whole arc, taken the same way as
[`lap-3-dogfood.md`](lap-3-dogfood.md): the commands that were actually run and the output that
actually came back. **Lap 3 is the baseline this is a difference against**, so every section below
is written as *fixed / not fixed / new* rather than as a fresh survey.

- Run on 2026-09-12, on `feat/rondo-dogfood-lap-4` at `c10cb09`, against continuo
  `fcf86eb2b7eb34d65bf73188b2b34544fab6820c` and the vendored cadenza
  (`sha256 1d255ecc…`, checked by `node vendor/pin.mjs check`).
- Machine: WSL2 (`Linux 6.18.33.2-microsoft-standard-WSL2`), Node `v22.17.0`, npm `10.9.2`.
- Target: a clone of rondo itself at `c10cb09`, provisioned by
  `scripts/dogfood-env.sh --target-repo`. Request: repair the stale preflight block in
  `scripts/dogfood-lap.md`. It was 38 lines and was passed with `--prompt-file`.
- **One lap, one iteration `dogfood-100`, $2.055, 43 turns, 253.6 s.**
- **The gate was answered by a person pressing a button on `rondo web`, and nobody typed a
  terminal command to approve it.** That is the thing this lap existed to measure, and it worked
  (section 2).
- **The lap did not commit.** It did the work and ran the verification, then stopped at the gate
  asking for permission to run a command the fence would not let it run -- and the command is one
  `scripts/dogfood-lap.md` itself tells a reader to run (section 4, N-10).

---

## 1. The arc, in wall clock

| Step | Wall clock | Hand edits | Terminal |
|---|---|---|---|
| `scripts/dogfood-env.sh --target-repo …` | **15.3 s** | none | operator's |
| `rondo start --prompt-file` | **255.6 s** (09:38:31 → 09:42:47) | none | operator's |
| answer the gate | **not timed; one click** | none | **none -- a browser** |
| `resume` | -- | none | **none -- the click did it** |

Lap 3's table has two `rondo answer` rows where this one has a click. Lap 3's provisioning was
19.2 s against a cold `--root`; this one was 15.3 s against an npm cache that was already warm, and
the difference is the cache rather than the code.

## 2. What lap 3 found, and what is true now

| lap 3 | status | evidence in this run |
|---|---|---|
| **N-2 / #87** a lap may run its verification but may not read its exit status | **not exercised** | this lap's worker never needed to: it ran `npm run verify` twice and read the terminal output directly. Neither confirmed nor refuted here |
| **N-3 / #88** nothing rondo records says which commands the lap ran, or that any were refused | **not fixed** | **18** `permission_denials` sit in this lap's `result` event. `rondo explain --iteration-id dogfood-100` prints none of them; the `review` stage again says, correctly, that it ran nothing |
| **N-4 / #89** `standard` is the only tier, and it is the most expensive model | **not fixed** | `model tier: standard` / `model: claude-opus-5` on the `explain` screen |
| **N-7 / #97** a lap cannot run one test file | **repaired in the plan, not exercised in the lap** | the generated plan now declares `npm test:*` beside `npm run:*` (verified in `plan.json`). **No call in this lap used it**, so #97's repair is confirmed present and unconfirmed effective. See N-11 |
| **N-8 / #96** nothing rondo records says what a lap cost | **not fixed** | `explain` prints 15 claims about `dogfood-100` and none of them is a number of dollars, turns or milliseconds. The figures in this document were parsed out of `events-000.jsonl` by hand, for the fourth lap running |
| **D-0041** a gate can be answered from the page | **new and working** | section 3 |

## 3. The headline: the approval took no terminal at all

The gate opened at `09:42:47`. Nobody sourced `env.sh`, nobody set `RONDO_STORE`, nobody had the
repository checked out. A person looked at `http://127.0.0.1:7333`, saw `dogfood-100` waiting, and
pressed the button. The ledger, read afterwards out of the control plane:

```
seq 1  open     ->received    system     lap_composition_root
seq 2  advance  received  ->presented    secretary  happy_ryo
seq 3  advance  presented ->answered     human      happy_ryo   body='approve'
seq 4  advance  answered  ->forwarded    secretary  happy_ryo
seq 5  close    forwarded ->forwarded    system     happy_ryo
```

`actor_kind` on seq 3 is `human`, which is what D-0013 requires and D-0041 is the page honouring.
`rondo explain` afterwards: `status: closed`, `gate stage: forwarded`,
`gate outcome: answered_and_forwarded`.

**How many terminal operations the page removed: two commands, and everything they needed.** Lap 3
required the approver to type `rondo answer` to read the gate and
`rondo answer --actor-id happy_ryo --body=approve` to settle it. Counting only the typing
undercounts it, because both commands require a shell that has `RONDO_STORE`, `RONDO_CONTINUO_CLI`
and `RONDO_APPROVER` exported and a working directory inside the repository. The page needs a URL.

`resume` is not a rondo verb and never was -- `answer` resumes as part of settling, and the
button takes the same path -- so there was no second step after the click, and there is nothing in
this lap that corresponds to `dogfood-lap.md` step 5's "call it *twice*".

## 4. New findings

### N-10. A lap cannot run `node -e`, so it cannot run the preflight `dogfood-lap.md` documents

The plan `scripts/dogfood-env.sh` generates declares

```
["npm ci --ignore-scripts", "npm run:*", "npm test:*", "node vendor/pin.mjs:*",
 "node --version", "npm --version"]
```

Three of those six are `node`, and all three are a *fixed* `node` invocation. There is no
`node -e`, and no `node <script>` other than `vendor/pin.mjs`.

`scripts/dogfood-lap.md` step 1 ends with a preflight block whose whole content is a `node -e`
one-liner, and this lap's request -- repair that block -- asked the worker to run it once and quote
the output. It could not. **Ten of the lap's eighteen refusals are this one question**: six `node -e`,
three `node <script>` and one `bash <script>`. In the order they were typed, with repetitions of the
same shape elided:

| what the worker typed | what came back |
|---|---|
| `node -e "…readFileSync('../../plan.json')…"` | refused |
| `ls dist/continuo/ && node -e "…import('file://…/roles.js')…"` | refused |
| `DIST=… PLAN=… node -e "…"` (absolute paths) | refused |
| `node -e "console.log('hello')"` | refused |
| `bash .worker-scratch/preflight.sh` (the same code, as a file) | refused |
| `node .worker-scratch/preflight.mjs` | refused |
| `node bin/rondo.mjs --help` | refused |

The `console.log('hello')` row is the measurement: **the refusal is not about what the code does,
it is about the shape `node -e`.** The two rows after it are the worker trying the obvious way round
-- write the snippet to a file and run the file -- which the same list forbids for the same reason,
and the last is it discovering that even rondo's own entry point is not a `node` it may run.

So the repair landed without its evidence. The worker rewrote the block correctly (verified outside
the fence afterwards: the rewritten one-liner prints `{ kind: 'selected', model: 'claude-opus-5' }`),
ran `npm run verify` green, and then **held the commit back** and escalated, because the request had
asked for output it could not produce.

This is adjacent to #87 and #97 and is not either of them. #87 is a lap that cannot read an exit
status; #97 was a lap that cannot run one test; this is a lap that **cannot evaluate an expression**
-- and the specific casualty is that a lap cannot walk the handbook for the very environment it is
running inside.

### N-11. #97's repair is in the plan and was not reached

`npm test:*` is in the generated plan, as #99 intended. Nothing in this lap used it: the work was a
documentation repair, and `npm run verify` -- which `npm run:*` already allowed in lap 3 -- was the
only verification it needed.

**This is worth recording as an absence rather than as a success.** Lap 3's seven-refusal sequence
came from a worker that wanted to see one screen; a worker repairing prose does not want that. #97
will be confirmed or refuted by the first lap whose work is code, and lap 5 should be given one on
purpose if the question matters.

### N-12. Most of this lap's refusals are the workspace boundary, not the Bash allowlist

Eighteen refusals, and reading them as one number is misleading. By cause:

| cause | count | examples |
|---|---|---|
| `node -e` / `node <script>` / `bash <script>` not declared | **10** | N-10's table |
| a path **outside the workspace** (Read, `ls`, `grep`, `test -f`) | **5** | `Read …/dogfood-env/plan.json`; `grep -n modelTier …/plan.json` |
| a tool not on the read-only list (`sed -n`, `env`, `rm -rf`) | **3** | `sed -n '…p' scripts/dogfood-env.sh` |

Lap 3's ten were all of the first kind (`npx`, `npm test -- <file>`, a redirect outside the
workspace). The second kind is new here and is a consequence of the
request rather than a defect: the worker was asked about a plan file that lives in the environment
directory, and a fenced lap can see only its workspace. **That is the fence working**, and it is
worth writing down because it means N-10's remedy is not "widen the workspace" -- the one-liner
needs `node -e`, and it needs a plan path the operator passes in, not one the lap goes looking for.

For the rate rather than the count: **18 refusals over 36 Bash calls plus 2 Reads**, against lap 3's
10 over 69. The rate is much worse and the laps are not comparable on it: seven of this lap's
refusals were one question asked seven ways, and the question came from the request.

## 5. Cost

From the terminal `result` event:

| | lap 1 §11 | lap 2 | lap 3 | **lap 4** |
|---|---|---|---|---|
| `total_cost_usd` | 0.58 | 1.032 | 7.062 | **2.055** |
| turns | 13 | 29 | 95 | **43** |
| duration | -- | 121.8 s | 724.4 s | **253.6 s** |
| refusals / Bash calls | -- | 4 / 29 | 10 / 69 | **18 / 36** |

The drop from $7.06 is the work being smaller -- one file, `+11 -7`, against lap 3's four files and
`+355 -7` -- and not anything that changed in rondo. $2.06 for a scoped documentation repair at the
only tier `MODEL_TIER_TABLE` prices (#89) is the number to carry forward; the ceiling never fired,
nothing was retried, and no lap ran twice.

What the table cannot show, for the fourth lap running, is that **rondo holds none of it** (#96).

## 6. The work the lap produced, and where it went

`scripts/dogfood-lap.md`, `+11 -7`: step 1's preflight block no longer names
`tsconfig.dogfood.json`, `drive.mjs` or a `plan.mjs` module -- all three of which step 3 of the same
document says are gone -- and its one-liner reads the tier out of the JSON plan file
`scripts/dogfood-env.sh` writes.

The worker also corrected the request: the field path is
`agent_type_input.executorPolicy.modelTier` and not `…executor_policy.model_tier`, because
`agent_type_input` is carried to cadenza verbatim and keeps cadenza's spelling inside while the
plan's top level is snake_case. It added a sentence to the block saying so.

**That work is not on `rondo/dogfood-100`.** The lap left it uncommitted in its workspace and
escalated instead (N-10), so rondo's own independent reading said, correctly, *"the topic branch is
at the same commit as `refs/remotes/origin/main`, so this lap left nothing"*. The repair is carried
into this branch by hand, as an operator's commit and not as the lap's -- which is why `git log`
shows it beside this document rather than as a merge of the topic branch.

## 7. Findings to raise

Drafted here, in English, as candidate issue bodies. Filing is the secretary's.

**A lap cannot evaluate an expression, so it cannot run the preflight this repository documents.**
The plan `scripts/dogfood-env.sh` generates declares three `node` invocations and all three are
fixed: `node vendor/pin.mjs:*`, `node --version`, `npm --version`. `scripts/dogfood-lap.md` step 1
documents a `node -e` one-liner as the preflight that costs nothing, and a lap asked to run it was
refused ten times across three shapes, including for `node -e "console.log('hello')"` and for
`node bin/rondo.mjs --help`. Writing the snippet to a file
and running `bash <file>` or `node <file>` is refused by the same list. The narrow reading is that
`node -e:*` is missing from the declaration; the wider one is the same shape as #87 and #97 -- a
declared Bash vocabulary is a list of whole commands, while a lap's real work is argument-shaped --
and this is the third instance of it. Measured in `docs/operations/lap-4-dogfood.md` (N-10), lap
`dogfood-100`, 2026-09-12.

**#97's repair has not been exercised by a lap.** `npm test:*` is in the generated plan as of #99
and lap 4 never reached for it, because lap 4's work was prose. The finding it repairs (#97) was
measured on a lap repairing two rendering screens. Until a lap whose work is code runs against a
plan carrying `npm test:*`, the repair is present and unconfirmed. Measured in
`docs/operations/lap-4-dogfood.md` (N-11).

## 8. What to write down next time

Lap 5 should be given work that is **code and not prose**, so that #97 is actually exercised (N-11),
and its request should **not ask the lap for output only an undeclared command can produce** --
which is what cost this lap its commit. Both are properties of the request rather than of rondo,
and both are cheap to get right in advance.
