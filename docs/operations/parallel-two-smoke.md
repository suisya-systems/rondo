# Two laps at once -- the smoke run before the default moved to 2

rondo#463 item 6 and `D-0124`: before the default `maxOccupying` moved from 1 to 2, two laps ran at
the same time against the pinned continuo and one store. The question was only whether continuo
still refuses a second concurrent lap, which `D-0023` rule 17 said it did until `continuo D-1104`'s
holder-identity half landed.

**Status: not yet run.** Running it needs the secretary, because the setup script replaces the
host's word and service (`D-0080`). The result is recorded here when it has been run.

## How it is run

The command runs from a rondo checkout at this change, after `npm run build`.

- Two scratch target repositories. A plain `start` claims the whole repository (`D-0073` rule
  2.5), so a second lap in the same repository would be refused by the lane ledger. That is a
  different check from the one under test.
- One store and one environment, set up by `scripts/dogfood-env.sh`, which is run once for each
  target.
- `RONDO_MAX_OCCUPYING=2`, and two `rondo start` commands started at the same time, each with its
  own request.
- `rondo inbox` is read while both laps run and again after they stop.

## What to record

1. The continuo pin the environment built.
2. Whether both laps reached their gate (`awaiting_human`). If either was refused, record what
   refused it, and whether continuo answered `LeaseHeld`.
3. The inbox while both ran, which should say that two were executing.
