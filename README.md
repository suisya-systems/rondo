# rondo

The host application of the successor stack: the one long-running process a person talks to. It owns the record of runs, gates, decisions and the conversation with the operator; it turns a one-line request into admitted runs, drives them, and brings every gate back to the human for a single yes or no. It consumes [continuo](https://github.com/suisya-systems/continuo) (the substrate) and [cadenza](https://github.com/suisya-systems/cadenza) (the delegation contract and gate semantics) as libraries.

## Status

**A skeleton with its boundaries enforced, and nothing behind them yet.**

What exists: a TypeScript/ESM package in cadenza's conventions, a CI gate on
ubuntu and windows across Node 22 and 24, an architecture test that polices the
dependency direction of `src/`, and `DECISIONS.md` with the measured decision
about how rondo consumes its two siblings (D-0001).

What does **not** exist yet, and is not merely unfinished but undecided:

- the loop — `src/refrain/` holds a pure `nextStep` function and no runner;
- the web UI and the localhost MCP surface — `src/access/` holds one in-process
  access point that forwards a question and nothing else;
- the durable store's schema — `src/store/sqlite.ts` names the seam and throws;
- the agent-type registry, and any code at all that talks to an agent.

None of those now waits on an open design row. cadenza's
`docs/design/conductor.md` section 11 sent eight of its seventeen rows to
rondo's gate, and all eight are entries here: `cadenza C-8` and `cadenza C-14`
in D-0001, and `cadenza C-4`, `cadenza C-5`, `cadenza C-6`, `cadenza C-7`,
`cadenza C-13` and `cadenza C-15` in D-0009 … D-0014, each taken as the row
recommends on 2026-09-05 — three of them correcting a reason continuo has since
overtaken. `cadenza C-11` was settled at continuo's gate (`continuo D-0076`), so
no row of section 11 is open anywhere. The decision to host this in a third
repository is that document's `cadenza C-17`, taken on 2026-09-05, and it is why
this repository exists.

Two decisions are open and neither is one of those rows. Both of these fired a
falsifier D-0001 names for itself, on 2026-09-05:

- cadenza acquired a package entry point (cadenza `D-0033`);
- continuo's CLI grew a `--version` that carries the build's revision and
  `--json` on the verbs a host drives (continuo `D-0090`).

So the section below, and D-0001 itself, describe measurements that have been
overtaken — in particular the claims that cadenza has no entry point and that
`--version` reports `0.0.0` for every revision. The entries that answer the two
have not been written yet.

`npm ci --ignore-scripts && npm run verify` is the whole of verification. CI
runs it on ubuntu and windows, on Node 22 and Node 24 — macOS is deliberately
not in the matrix, because nothing here is platform-specific in a way the
Windows cell does not already exercise harder.

## How it relates to continuo and cadenza

rondo is the consumer. Neither sibling depends on it, and neither is changed to
suit it.

**Today rondo depends on neither of them as a package.** `package.json` has no
`dependencies` block. That is D-0001, and it is a measurement rather than a
plan: both siblings are `private: true` and unpublished (`npm view` answers
`E404` for each), neither ships build output, and cadenza has no package entry
point of any kind. Four ways of consuming them were tried against the real
checkouts, and the commands and their output are recorded verbatim in D-0001.

For **lap 1**:

- **continuo is driven across a CLI process boundary** — a checkout pinned by
  commit sha, built once, and invoked as a subprocess. This is the only route
  that works today without changing continuo, and it is what cadenza's own
  design recommends for the same seam (`cadenza C-8`). Its cost is real and is
  written down: no types across the seam, prose rather than JSON from most
  subcommands, and `--version` that reports `0.0.0` for every revision — so
  recording *which* continuo drove a run is rondo's job, not the seam's
  (`cadenza C-14`).
- **cadenza is not consumed at all.** No option reaches it without either a
  change inside cadenza — a build script, an `exports` map, a `files` list — or
  rondo compiling cadenza's source through a deep, unversioned internal path
  with a TypeScript loader at runtime. The first belongs to cadenza's gate and
  is escalated rather than patched here — D-0001 names the exact fields; the
  second is not a dependency rondo will take on. Until then, the parts of cadenza rondo needs are reached
  through continuo or restated at rondo's own boundary.

What changes this: **publication**. When continuo is published to a registry
(`continuo D-0045`), the dependency becomes an ordinary pinned version with an
enforced integrity hash, types across the seam, and no build step in the
consumer — and D-0001 is superseded rather than amended.

## Layout

| Path | What it is |
|---|---|
| `src/refrain/` | The loop. Imports nothing external, ever — that is the boundary. |
| `src/access/` | Access points: the web UI and the localhost MCP surface, when they exist. May reach the loop; the loop may not reach back. |
| `src/store/` | Durable state. `sqlite.ts` is the one module under `src/` allowed to name a SQLite driver, which is the scope the test enforces. |
| `test/architecture/` | The test that enforces the three sentences above. |
| `DECISIONS.md` | The append-only design record. Cite by ID. |
| `AGENTS.md` | How work here is done. |
| `docs/` | Index of the records, and of where the enforced rules live. |

## The name

A rondo is the piece that keeps coming home: a refrain the listener already knows, set between episodes that are free to wander, and the refrain is where the piece is decided - it opens, it returns after every excursion, and it has the last word. That is what this application is, not what it performs: the one place the human ever speaks to, and the one record everything else is played from. Each delegated run is an episode that leaves it and is cued back to it, and every return is a gate - the refrain does not resume until the human has said yes or no, and it accepts that answer exactly once. Continuo underpins the whole piece and cadenza defines the solo; rondo is where the piece always returns.
