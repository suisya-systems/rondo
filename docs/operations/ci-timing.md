# How long the suite takes, per cell — so the next red can be judged without measuring it again

**This file exists so that somebody looking at a timed-out test in CI can decide
what it means without re-measuring anything.** The question that comes up every
time is the same one: *was the timeout always too low, or did something starve?*
Answering it needs a healthy number to compare against, and until now the
healthy numbers lived in two code comments citing a CI log that has since
expired. So the measuring got redone. It does not need to be.

**Read this first, then the numbers.** The judgement is in
[What these numbers decided](#what-these-numbers-decided); the tables are the
evidence for it. Then read
[The drive the temporary directory is on](#the-drive-the-temporary-directory-is-on-rondo337-2026-09-21),
which is the section that made the cell faster rather than only describing it --
every figure above it was taken before that change and is a fact about the old
arrangement.

## The three columns

Same files, three places. All figures are the **whole file**, as vitest's
reporter prints it, and the two values are `Green 1 / Green 2` — the two seeds
of one `double-green` cell (`D-0003`).

| File | Local Linux | CI Ubuntu, node 24 | CI Windows, node 24 (healthy) | Windows ÷ Ubuntu |
|---|---|---|---|---|
| `test/access/scope-stop.test.ts` | 2034 / 1968 ms | 913 / 878 ms | 31385 / 17002 ms | **19–34×** |
| `test/store/request-thread.test.ts` | 270 / 292 ms | 139 / 112 ms | 2977 / 3218 ms | **21–29×** |
| `test/access/web.test.ts` | 6063 / 5409 ms | 5211 / 3188 ms | 61411 / 48593 ms | **12–15×** |
| `test/access/forge.test.ts` | 2993 / 2858 ms | 2869 / 2635 ms | 25416 / 30284 ms | **9–11×** |
| `test/continuo/smoke.test.ts` | 31 / 27 ms † | 2426 / 2630 ms | 5161 / 6164 ms | **2.1–2.3×** |

† **Not comparable.** `rondo drives the pinned continuo end to end` is
`skipIf(!RONDO_CONTINUO_CLI)` and does not run locally. CI injects the variable,
so the CI columns include it and the local column does not. Everything else in
that file is in-process.

**The Windows runner is genuinely much slower**, and it is slower in one
specific way: files that spawn child processes (the rondo CLI, git, continuo)
cost 9–34× what they cost on Ubuntu, while in-process files are close to par.
That is the same conclusion rondo#222 reached and it has not changed.

### Whole-cell wall time

| Cell | Wall (per green) | Sum of test durations | Effective parallelism |
|---|---|---|---|
| CI Ubuntu, node 24 | 14.98 / 15.86 s | 19.07 / 16.86 s | 1.3× / 1.1× |
| CI Windows, node 24 (healthy) | 77.83 / 75.82 s | 184.68 / 150.56 s | 2.4× / 2.0× |
| CI Windows, node 24 (the bad run) | 176.53 s | 495.99 s | 2.8× |

**The Windows cell is tail-bound, not worker-bound.** `test/access/web.test.ts`
alone is 48–61 s of a 76–78 s wall — 63 % to 79 % of it, in one file of 5,522
lines. Raising `maxWorkers` cannot make the suite finish before that file does.

## Healthy and pathological, side by side

**This is the section that answers the recurring question, and it is why both
halves have to be recorded.** A healthy number alone cannot tell you whether a
60 s timeout was marginal; a failing number alone cannot either.

| File | Healthy (run 35509782288) | The bad run (run 35519135051) | Ratio |
|---|---|---|---|
| `test/store/request-thread.test.ts` | 2977 / 3218 ms | 2251 / **81355** ms | **25.3×** |
| `test/continuo/smoke.test.ts` | 5161 / 6164 ms | 8364 / **73685** ms | **12.0×** |
| `test/access/web.test.ts` | 61411 / 48593 ms | 97481 / **171313** ms | 2.8× |
| `test/access/forge.test.ts` | 25416 / 30284 ms | **72887** / 33707 ms | 2.4× |

Note the swing *within* one job: `request-thread` is 2251 ms on the first seed
and 81355 ms on the second; `forge` is 72887 ms then 33707 ms. Whatever this is,
it is episodic rather than a property of the machine that day.

### The distribution, which is the part that decides it

Every file present in both runs at ≥ 50 ms in the healthy one, ratio
bad ÷ healthy, taking the slower seed of each:

```
n = 39
min 0.23   q1 0.55   median 0.71   q3 1.11   p90 2.79   max 25.28
above 1.5x:  9 files
above 2x:    7 files
  request-thread 25.3   continuo/smoke 12.0   sqlite 3.7   web 2.8
  transcript 2.5        forge 2.4             raise 2.4
```

**The median is 0.71: most files were _faster_ in the run that failed.** The
machine was not uniformly slow. Seven files out of thirty-nine blew up, and they
are the ones that spawn child processes.

## What these numbers decided

On 2026-09-21, on rondo#332 / PR #334, with `double-green (windows-latest, node
24)` red:

- **The timeouts were not raised.** `WINDOWS_HEAVY_TIMEOUT_MS` is 60 s;
  `request-thread.test.ts` runs its whole 18-test file in **3.0–3.2 s** when
  healthy, and one test inside it exceeded 60 s. That is a ≥ 20× overrun of a
  limit that already had 20× headroom, not a limit that was set too low.
  Absorbing it would need 150–300 s, which is a budget and not
  "a floor under runner variance" (`vitest.config.ts`).
- **Isolating the heavy end-to-end test was rejected**, after being proposed and
  withdrawn. `test/continuo/smoke.test.ts` is **5–6 s** on a healthy Windows
  cell; the 73.7 s reading is from the bad run. Running it alone would have
  added its 5–6 s to the wall as a serial tail and fixed nothing. **The
  proposal rested on reading a symptom as the cause**, which is exactly the
  mistake this file exists to prevent.
- **Splitting `test/access/web.test.ts` was raised as its own task.** It is the
  only large lever on the wall time, and it thins the number of heavy tests
  landing in one worker, so it bears on both the speed and the episodes.
- **The cell was moved off the pull-request path**, on 2026-09-21, by `D-0087`
  and rondo#336 — after these numbers, and not by them alone. What they
  contribute is the negative half: the ceiling is not the problem and no
  arrangement of the suite's files fixes it, so what remained was *when* the
  cell runs rather than *how long it takes*. The operator's own reasoning is
  recorded on the issue and goes further than anything measured here: even at
  continuo's post-fix Windows speed of 7–9 minutes, seven minutes in front of a
  merge is still seven minutes every pull request waits on.
- **What causes the episodes is not settled here.** Contention between
  process-spawning files is consistent with every number above, but so is a
  noisy neighbour or an antivirus scan on the runner. Telling those apart needs
  CPU-wait measured *on the runner*, which nothing here does. **Do not record a
  cause in this file that the numbers do not carry.**

## The drive the temporary directory is on (rondo#337, 2026-09-21)

**This section is the one that changed a number rather than only recording it.**
Everything above was measured with the suite's temporary files on the runner's
`C:`; everything after `D-0088` has them on `D:`.

### The question, and how it was decided

continuo found that its Windows cost was the drive its test databases landed on
and fixed it (`continuo D-1109`, 21-33 minutes to 7-9). cadenza measured the
same proposal and **did not** port it: its Windows excess was checkout,
`setup-node` and `npm ci`, and its suite ran at macOS speed (`cadenza D-0039`
§4). Two repositories, one fix, opposite answers -- so the first thing to
establish was which shape rondo has. It is a step-level question and the logs
already held it.

Medians over **21 pull-request runs** (2026-09-19 to 2026-09-20): 42 ubuntu
cells and 39 Windows cells, every step of `double-green`, before `D-0088`.

| | ubuntu | windows | excess |
|---|---|---|---|
| **cell, end to end** | **44 s** | **173 s** | **+129 s** |
| the two seeded suite runs | 28 s | 130 s | **+102 s (79 %)** |
| `checkout` + `setup-node` + `npm ci` | 8 s | 23 s | +15 s |
| provisioning the pinned continuo | 6 s | 11 s | +5 s |

**rondo is continuo-shaped.** Four fifths of what Windows costs is test work, and
the fixed job cost cadenza's answer turned on is 15 s of a 129 s gap. That is the
opposite reading to cadenza's table, taken the same way, and it is what made the
port worth doing rather than worth assuming.

### The mechanism, printed on rondo's own runner

Not inferred from continuo's. The step added by `D-0088` prints the three paths
before it changes anything (run `35525794846`, job `106117596940`):

```
workspace           D:\a\rondo\rondo
RUNNER_TEMP (new)   D:\a\_temp
os.tmpdir() (old)   C:\Users\RUNNER~1\AppData\Local\Temp
```

The checkout is on the local SSD and every temporary directory the suite makes
was on the network-attached OS disk. Every one of them: the suite's temporary
directories are all `mkdtempSync(join(tmpdir(), ...))` -- the SQLite stores, and
the workspaces the CLI and git children are pointed at -- which is why the files
that blow up are the ones that spawn processes and write there.

### Before and after, same cell, matched pair

`windows-latest, node 24`, run `35509782288` (before) against run `35525794846`
(after). Per green, both seeds:

| | before | after | ratio |
|---|---|---|---|
| **cell, end to end** | **203 s** | **94 s** | **2.2x** |
| vitest wall | 77.8 / 75.8 s | 29.8 / 24.7 s | 2.6-3.1x |
| vitest test work | 184.7 / 150.6 s | 50.9 / 44.1 s | 3.4-3.6x |
| `test/access/scope-stop.test.ts` | 31385 / 17002 ms | 883 / 884 ms | **19-36x** |
| `test/store/request-thread.test.ts` | 2977 / 3218 ms | 119 / 108 ms | **25-30x** |
| `test/access/web.test.ts` | 61411 / 48593 ms | 17350 / 16260 ms | 2.8-3.5x |
| `test/access/forge.test.ts` | 25416 / 30284 ms | 20027 / 15970 ms | 1.3-1.9x |
| `test/continuo/smoke.test.ts` | 5161 / 6164 ms | 3850 / 3423 ms | 1.3-1.8x |

**The two files that moved by 20-36x are the two the first table said were
pathological**, and `request-thread.test.ts` is the file that took 81 s inside a
single job in the bad run. `web.test.ts` is still the tail -- 17 s of a 30 s
wall -- so splitting it remains the only large lever left, and is still its own
task.

### And across four cells, because one pair is one pair

Two `workflow_dispatch` runs of the branch (`35525794846`, `35525989807`), four
Windows cells, against the 39-cell medians above.

| | before (n=39) | after (n=4) |
|---|---|---|
| cell, end to end | 173 s (146-306) | **114 s (94-161)** |
| the two seeded suite runs | 130 s (105-223) | **70 s (57-81)** |

The spread is the reason both tables are here. The slowest after cell (161 s) is
a runner whose *fixed* steps were also heavy -- 9 s of checkout, 20 s of
`setup-node` -- and it is still inside the before range, so no single cell
settles this. The matched pair is the clean measurement; this table is what says
the pair was not a lucky draw.

**ubuntu did not move**, which is the check that the scoping is real rather than
stated: 44 s before, 50 s after, inside the before range of 28-78 s. The step
does not run there. It matters because on POSIX `os.tmpdir()` falls back to TMP
and TEMP after TMPDIR, so a version of this change without the condition would
have moved the Linux cells too and nothing here has measured that.

### What is not claimed

- **Nothing about the episodes.** `D-0088` was adopted on the speed number
  alone. continuo's section 5a reports the same `C:` disagreeing with itself by
  5.3x between two runs and suggests the drive may be what makes Windows cells
  *red* as well as slow -- plausible here for the same reason, and unmeasured
  here as there. The way to answer it is to count red Windows nightlies from
  `D-0088` onward, not to re-run anything.
- **Nothing about a developer's own Windows machine.** This is a fact about the
  `windows-latest` image's two drives. A laptop with one disk gets nothing from
  it, and rondo#322 is where whose machine rondo runs on is decided.

## Where each figure comes from

CI logs expire, so the run ids are recorded with the figures rather than only in
a commit message.

| Column | Source |
|---|---|
| Local Linux | AMD Ryzen 9 7900X3D, WSL2, node 22.17.0, `npx vitest run --reporter=verbose`, two runs, at `b85be4a`. Per-file figures are the sum of that file's test durations |
| CI Ubuntu, node 24 | run **35519135051**, job **106100055432** (PR #334) |
| CI Windows node 24, healthy | run **35509782288**, job **106075557801** (PR #333, `feat/rondo-screens-own-files`) |
| CI Windows node 24, bad | run **35519135051**, job **106100055324** (PR #334) — `Green 2 of 2`, seed 2010399653 |
| main red, same cell, different tests | run **35509994229**, job **106076115474**, commit `d876aa1` |
| The 4–12× figure rondo#222 closed on | run **35089584019**, quoted in the code comments this file replaces |
| Step-level medians, before `D-0088` | 21 pull-request runs, 2026-09-19 to 2026-09-20, `GET /actions/runs/{id}/jobs` -- 42 ubuntu cells and 39 Windows cells, each step's own `started_at`/`completed_at` |
| Windows node 24, after `D-0088` | run **35525794846**, job **106117596940** (`workflow_dispatch` on `feat/rondo-windows-fast-drive-measure`) |
| Windows node 22, after `D-0088` | run **35525794846**, job **106117596979**; second run **35525989807**, jobs **106118106839** (node 24) and **106118106856** (node 22) |

## The runner and the settings, as configured

- `vitest.config.ts`: `isolate: true`, `sequence.concurrent: false`,
  `sequence.shuffle: { files: true, tests: true }`, seed injected by CI.
  **`pool`, `maxWorkers` and `fileParallelism` are not set**, so vitest's
  defaults apply (vitest 4.1.11: `forks`, workers ≈ cores − 1).
- Runner cores: **not printed in any log**. `rondo` is a public repository, and
  GitHub's published specification for public-repository standard runners is 4
  vCPU for both `ubuntu-latest` and `windows-latest`. **This is a quotation, not
  a measurement** — if it ever matters, print `os.availableParallelism()` in the
  cell and record it here rather than quoting it again.

## Adding to this file

Add a row rather than replacing one, and keep the run id. A figure whose run has
expired is still worth more than no figure, provided the reader can see how old
it is. **Both the healthy and the pathological reading, or neither**: half of
this file cannot answer the question it exists for.
