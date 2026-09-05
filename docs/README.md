# rondo — docs index

What lives in this directory, and what lives elsewhere.

rondo is early enough that most of what a reader wants is not a document but a
decision, so the index starts by saying where the decisions are.

## The records

| File | What it is |
|---|---|
| [`../DECISIONS.md`](../DECISIONS.md) | The canonical, append-only record of rondo's design decisions. Cite entries by ID (`D-00NN`), never by position. |
| [`../AGENTS.md`](../AGENTS.md) | How work on rondo is done: verification, conventions, what a change is expected to touch. |
| [`../README.md`](../README.md) | What rondo is, what it is not yet, and how it relates to continuo and cadenza. |

## Design documents

None yet, and that is deliberate rather than an omission. rondo's design is
currently held in two places that already exist and are maintained:

- **cadenza's `docs/design/conductor.md`** is the design of the loop rondo will
  host. Its section 11 is the open-decision table; `C-17` is the row that
  created this repository (decided at cadenza's human gate on 2026-09-05,
  cadenza `D-0029`), and `C-8` and `C-14` are the rows
  [`D-0001`](../DECISIONS.md) answers for rondo's side of the seam — re-argued
  at the current sibling commits in `D-0015` (continuo) and `D-0016` (cadenza),
  with both outcomes unchanged. `C-9` is deliberately not in that list: it asks
  what it would cost *cadenza* to take the npm dependency, and `C-17` removed
  its antecedent.
- **continuo's `DECISIONS.md`** owns the control plane rondo drives, including
  `continuo D-0045` (publication), `continuo D-0090` (the `--version` and
  `--json` seam `D-0015` consumes) and `continuo D-0092` (`gate close` joining
  that envelope, which fired `D-0015`'s falsifier and is answered by `D-0017`). Publication is the event that reopens the
  consumption question; `D-0015` records that it makes the library-versus-
  subprocess choice a real choice rather than superseding D-0001 by itself.

A design document appears here when rondo has a design of its own to state —
the store schema, the web UI, the MCP surface — and not before. A document that
restated cadenza's would be a second copy of a contract with no rule for which
copy wins, which is exactly the drift cadenza's own `D-0001` exists to prevent.

## Where the enforced rules are

Some of what a design document would normally assert is instead a test, so that
it fails rather than being read:

| Rule | Where it is enforced |
|---|---|
| The loop imports no HTTP, browser, session provider or continuo internals; access points may import the loop and the continuo seam and never the reverse; exactly one module under `src/` owns SQLite, and exactly one starts a process (`D-0017`) | [`../test/architecture/import-boundaries.test.ts`](../test/architecture/import-boundaries.test.ts), and the `boundary-is-not-vacuous` job — check name "a planted violation makes the boundary test fail" — in [`../.github/workflows/ci.yml`](../.github/workflows/ci.yml) |
| The suite is green twice per cell under two distinct random orders | `double-green` in the CI workflow, configured in [`../vitest.config.ts`](../vitest.config.ts) |
| Nothing is installed except from the lockfile, with `--ignore-scripts` | `npm ci --ignore-scripts` in every CI job |
| rondo drives the pinned continuo end to end, in every matrix cell | the "Provision the pinned continuo" step of `double-green` and [`../test/continuo/smoke.test.ts`](../test/continuo/smoke.test.ts), which fails rather than skips under `CI` |
| The pin in [`../continuo.pin.json`](../continuo.pin.json), the literals in `src/continuo/pin.ts` and the sha CI provisions cannot drift apart | [`../test/continuo/pin.test.ts`](../test/continuo/pin.test.ts) |
