# Two laps at once -- the smoke run before the default moved to 2

rondo#463 item 6 and `D-0124`: before the default `maxOccupying` moved from 1 to 2, two laps ran at
the same time against the pinned continuo and one store. The question was only whether continuo
still refuses a second concurrent lap, which `D-0023` rule 17 said it did until `continuo D-1104`'s
holder-identity half landed.

**Result: it does not refuse one.** On **2026-09-27**, at this change's branch and continuo
`f2fb450`, two laps performed at the same time. Both reached their gate, and nothing refused
either of them: no `LeaseHeld` and no capacity refusal.

## How it was run

The secretary ran it from a rondo checkout at this change, after `npm run build`.

- **Two scratch target repositories**, each with a bare `origin` and `main` pushed to it. A plain
  `start` claims the whole repository (`D-0073` rule 2.5), so a second lap in the same repository
  would be refused by the lane ledger. That is a different check from the one under test.
- **One store and one environment**, set up by `scripts/dogfood-env.sh`, run once for each target
  with the same `--root`.
- **`RONDO_MAX_OCCUPYING=2`.** Two `rondo start` commands, each with its own request (`m-a`,
  `m-b`), were started five seconds apart. `rondo inbox --actor-id` was read 20 seconds after the
  second start, and again after both stopped.

## What was recorded

| | `smoke-a` | `smoke-b` |
|---|---|---|
| while both ran (`inbox`, `in flight (2)`) | `performing`, 24s | `performing`, 18s |
| after (`inbox`, `iterations waiting on you (2)`) | `awaiting_human` at `gate/worker_escalation/...` | `awaiting_human` at `gate/worker_escalation/...` |
| lap | 7 turns, 38.7 s, 0.315 USD | 7 turns, 31.4 s, 0.216 USD |
| model reading | raised nothing (`rondo/model/1/gpt-6-astra`) | raised nothing |

An earlier attempt the same day used target repositories that had no `origin`. Both laps were
reserved at `planned` with no capacity refusal, and both then stopped at rondo's own base-branch
fetch (`D-0100`: `'origin' does not appear to be a git repository`). That says nothing about
continuo, and is why the run above gives each target a bare `origin`.

## What it does not show

- **Two laps in one repository.** The lane ledger decides that, and this run avoided it on
  purpose.
- **The order tick starting two parts of a split** (`D-0127`). The tests cover that with fakes and
  over a real store (`test/access/order-host.test.ts`). This run used `rondo start`.
