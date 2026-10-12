# Where the records of laps 1 to 9 went

`docs/operations/` holds two kinds of page: the ones that belong to **one** walk of the arc -- a
`lap-N-dogfood.md` record and the `lap-N-runbook.md` it was walked from -- and the ones that belong
to **no** single walk, like [`rondo-cli.md`](rondo-cli.md) and
[`runbook-conventions.md`](runbook-conventions.md). With twelve laps written down, the first kind
had buried the second, and a reader looking for the reference had to pick it out of a list of
dogfood records.

So the directory now keeps **the three most recent laps and the pages that belong to no single
lap**, and the ten pages of laps 1 to 9 sit one directory down, in `earlier-laps/`. This file is
the way back: every record that moved has a row here, under the name it had before.

**The records themselves were not touched.** They moved as a rename, with their text as it was
written on the day of the walk, so a finding cited as "N-14 of lap 5" is still exactly that finding,
in exactly those words. Only the two links a moved record makes *out* of `earlier-laps/` were
repointed, because the directory they point from changed.

## The ten records, and where each one is now

| Was | Is now | The record |
|---|---|---|
| `lap-1-dogfood.md` | [`earlier-laps/lap-1-dogfood.md`](earlier-laps/lap-1-dogfood.md) | lap 1 dogfood -- what one real request cost, and where it stopped |
| `lap-2-dogfood.md` | [`earlier-laps/lap-2-dogfood.md`](earlier-laps/lap-2-dogfood.md) | lap 2 dogfood -- what the day's nine changes moved, and where the lap now stops |
| `lap-3-dogfood.md` | [`earlier-laps/lap-3-dogfood.md`](earlier-laps/lap-3-dogfood.md) | lap 3 dogfood -- the answer path closed on its own, and the bill went up seven times |
| `lap-4-dogfood.md` | [`earlier-laps/lap-4-dogfood.md`](earlier-laps/lap-4-dogfood.md) | lap 4 dogfood -- a person answered from a page, and the fence refused the page's own handbook |
| `lap-5-dogfood.md` | [`earlier-laps/lap-5-dogfood.md`](earlier-laps/lap-5-dogfood.md) | lap 5 dogfood -- the lap ran one test file, said its verification failed, and was wrong about why |
| `lap-6-dogfood.md` | [`earlier-laps/lap-6-dogfood.md`](earlier-laps/lap-6-dogfood.md) | lap 6 dogfood -- the chain walked to its end, and `rondo retry` ran for the first time |
| `lap-7-dogfood.md` | [`earlier-laps/lap-7-dogfood.md`](earlier-laps/lap-7-dogfood.md) | lap 7 dogfood -- a lap installed its own dependencies, verified, took a baseline and committed |
| `lap-8-dogfood.md` | [`earlier-laps/lap-8-dogfood.md`](earlier-laps/lap-8-dogfood.md) | lap 8 dogfood -- a request, a lap, a scope approved, and the in-scope redo stopped at the readings test |
| `lap-9-dogfood.md` | [`earlier-laps/lap-9-dogfood.md`](earlier-laps/lap-9-dogfood.md) | lap 9 dogfood -- the person ran rondo, a scope approved before the first lap, and the redo that carried the review had to leave the scope |
| `lap-9-runbook.md` | [`earlier-laps/lap-9-runbook.md`](earlier-laps/lap-9-runbook.md) | lap 9 runbook -- the walk lap 9's record is a record of; the last runbook written for a terminal rather than for the page |

Each row's third column is the record's own heading, except lap 9's runbook, whose heading is in
Japanese and is given here in English. So this table says where a page is and nothing about what it
found. What it found is in the page.

## What stayed in `docs/operations/`

- **The three most recent laps**: `lap-10-dogfood.md` and `lap-10-runbook.md`,
  `lap-11-dogfood.md` and `lap-11-runbook.md`, `lap-12-dogfood.md` and `lap-12-runbook.md`.
- **The pages that belong to no single lap**: [`rondo-cli.md`](rondo-cli.md),
  [`runbook-conventions.md`](runbook-conventions.md), [`ci-timing.md`](ci-timing.md),
  [`resident-host-update.md`](resident-host-update.md),
  [`parallel-two-smoke.md`](parallel-two-smoke.md),
  [`model-drafter-planted-requests.md`](model-drafter-planted-requests.md) and
  [`model-reviewer-planted-lap.md`](model-reviewer-planted-lap.md).

## Citations of a moved record

Every page, comment and `.gitignore` line that pointed into a moved record was repointed with the
move, and so were the citations in `DECISIONS.md` and in the design documents under `docs/design/`:
`DECISIONS.md` cited these records at 33 places and
[`../design/lap-review-stage.md`](../design/lap-review-stage.md) and
[`../design/parallel-admission.md`](../design/parallel-admission.md) at 7, and all 40 now name
`earlier-laps/`. **Only the path string moved.** No claim, measurement, date or word of a sentence
around one changed, which is why this is not a rewrite of an append-only file and carries no
annotation and no `D-` entry; the rule that says so is the path-following bullet in `DECISIONS.md`'s
own "How to use this file". A citation that names a record by file name alone -- `lap-5-dogfood.md`,
with no directory in front of it -- was left as it stands, because that name is still the record's
name and this table is where the name is resolved.

The records themselves are the one place an old path is still written down: a dogfood record that
cites its own findings as `docs/operations/lap-N-dogfood.md` says where it sat on the day of the
walk, and the records are kept exactly as they were written. None of those is a link, so none of
them is broken; this table is how they are followed.
