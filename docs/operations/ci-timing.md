# How long the suite takes, per cell — so the next red can be judged without measuring it again

**This file exists so that somebody looking at a timed-out test in CI can decide
what it means without re-measuring anything.** The question that comes up every
time is the same one: *was the timeout always too low, or did something starve?*
Answering it needs a healthy number to compare against, and until now the
healthy numbers lived in two code comments citing a CI log that has since
expired. So the measuring got redone. It does not need to be.

**Read this first, then the numbers.** The judgement is in
[What these numbers decided](#what-these-numbers-decided); the tables are the
evidence for it.

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
- **What causes the episodes is not settled here.** Contention between
  process-spawning files is consistent with every number above, but so is a
  noisy neighbour or an antivirus scan on the runner. Telling those apart needs
  CPU-wait measured *on the runner*, which nothing here does. **Do not record a
  cause in this file that the numbers do not carry.**

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
