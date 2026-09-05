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

| File | What it is |
|---|---|
| [`design/refrain-lap1.md`](design/refrain-lap1.md) | The lap-1 conductor loop in `src/refrain`: how a request becomes a continuo run driven through the cadenza facade and the continuo seam, and stops at a gate a human has yet to answer. **Propose-only** — it takes no decision, and ends in decision rows `R-1` … `R-16` for rondo's gate. |

**This is rondo's first design document of its own, and until it existed this
section said there were none.** That was accurate rather than modest: every
design rondo had was a *restatement* of a sibling's, and a second copy of a
contract with no rule for which copy wins is the drift cadenza's own `D-0001`
exists to prevent. The loop is the first thing that is not a restatement. cadenza's
`conductor.md` says what a conductor iteration *is*; what it costs to build one
against the tree rondo actually has — which module may start a process, what the
store must guarantee across a restart, where the loop suspends when only another
surface can close the gate — is rondo's question, and nobody else's document
answers it.

The two sibling documents below are still where the rest of rondo's design is
held, and the new document leans on both rather than replacing either:

- **cadenza's `docs/design/conductor.md`** is the design of the loop rondo will
  host. Its section 11 is the open-decision table; `C-17` is the row that
  created this repository (decided at cadenza's human gate on 2026-09-05,
  cadenza `D-0029`), and `C-8` and `C-14` are the rows
  [`D-0001`](../DECISIONS.md) answered for rondo's side of the seam — re-argued
  at the current sibling commits in `D-0015` (continuo) and `D-0016` (cadenza),
  with both outcomes unchanged then, and **superseded for cadenza by `D-0018`**,
  which takes the dependency through cadenza's own delivery bridge
  (`cadenza D-0035`). `C-9` is deliberately not in that list: it asks
  what it would cost *cadenza* to take the npm dependency, and `C-17` removed
  its antecedent.
- **continuo's `DECISIONS.md`** owns the control plane rondo drives, including
  `continuo D-0045` (publication), `continuo D-0090` (the `--version` and
  `--json` seam `D-0015` consumes) and `continuo D-0092` (`gate close` joining
  that envelope, which fired `D-0015`'s falsifier and is answered by `D-0017`). Publication is the event that reopens the
  consumption question; `D-0015` records that it makes the library-versus-
  subprocess choice a real choice rather than superseding D-0001 by itself.

A design document appears here when rondo has a design of its own to state — the
loop, and after it the store schema, the web UI and the MCP surface — and not
before. The rule the paragraph above states is what keeps that from becoming an
excuse to restate a sibling: a document that copied cadenza's contract or
continuo's control plane would be a second copy with no rule for which copy wins.

## Operations

| File | What it is |
|---|---|
| [`operations/lap-1-dogfood.md`](operations/lap-1-dogfood.md) | What happened when one real request was driven through the lap-1 loop on 2026-09-06, at the pinned revisions: the 31-field `RunPlan` and where each field came from, the wall clock, eleven findings, and six proposed issues. **The lap did not complete**, and the record says exactly where and why. |
| [`../scripts/dogfood-lap.md`](../scripts/dogfood-lap.md) | The procedure that record was produced by. `R-16`'s answer to "where does a real lap run": a documented manual script, deliberately not a `vitest` suite. |

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
| The vendored cadenza is one artifact: the source pin in [`../cadenza.pin.json`](../cadenza.pin.json), the committed sha256, the dependency specifier and the lockfile's sha512 all describe the same tarball — and every CI install is preceded by the portable digest check (`D-0018`) | [`../test/cadenza/pin.test.ts`](../test/cadenza/pin.test.ts), and `node vendor/pin.mjs check` before each `npm ci --ignore-scripts` in [`../.github/workflows/ci.yml`](../.github/workflows/ci.yml) |
| Exactly one module under `src/` imports `@suisya-systems/cadenza`, binding by binding, and no other layer reaches it (`D-0018`) | [`../test/architecture/import-boundaries.test.ts`](../test/architecture/import-boundaries.test.ts) |
| rondo drives the vendored cadenza through its own facade — resolution, the agent-type record, an initial contract and one classification — in every matrix cell | [`../test/cadenza/smoke.test.ts`](../test/cadenza/smoke.test.ts) |
