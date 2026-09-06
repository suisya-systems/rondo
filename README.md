# rondo

The host application of the successor stack: the one long-running process a person talks to. It owns the record of runs, gates, decisions and the conversation with the operator; it turns a one-line request into admitted runs, drives them, and brings every gate back to the human for a single yes or no. It consumes [continuo](https://github.com/suisya-systems/continuo) (the substrate) and [cadenza](https://github.com/suisya-systems/cadenza) (the delegation contract and gate semantics) as libraries.

## Status

**A working conductor for one lap, with its boundaries enforced and a seam to
each sibling behind them.**

What exists: a TypeScript/ESM package in cadenza's conventions, a CI gate on
ubuntu and windows across Node 22 and 24, an architecture test that polices the
dependency direction of `src/`, `DECISIONS.md` with the measured decisions about
how rondo consumes its two siblings (D-0001, re-argued in D-0015 and D-0016 and
now superseded by D-0018),
**a working seam to continuo** (D-0017): `src/continuo/` decodes
continuo's `--json` envelope, verifies the pinned build's revision before it
drives anything, and is exercised end to end against a real continuo in every
CI cell — and, new, **cadenza consumed as a library** (D-0018): a tarball built
once from a pinned cadenza commit and committed under `vendor/`, rondo's first
runtime dependency, reached through the single facade in `src/cadenza/` and
exercised in every CI cell with in-memory fixtures.

**As of D-0019 there is a conductor.** `src/refrain/` holds a pure `nextStep`
planner beside an async interpreter that drives one lap through injected ports,
`src/store/` holds a real schema whose partial unique index makes single-flight
the database's invariant rather than a promise, and the arc runs: classify
against a cadenza contract, admit a run, walk one lap, and **suspend at the gate
a human has yet to answer**, resuming through `resume(iterationId)` when the
operating surface says they have. It never composes the answer (D-0009), never
publishes (D-0010), never closes a gate (D-0013), and runs one iteration at a
time (D-0012).

**As of D-0024 and D-0025 there is a way in.** rondo ships a binary — an
emitting build beside the type-check, and `bin/rondo.mjs` — and the operator's
surface is four subcommands: `rondo start` takes one request and walks a lap to
the open gate, `rondo answer` shows what a person is being asked and carries
their answer through continuo's six gate verbs, `rondo publish` pushes the
branch and opens the pull request the operator asked for, and `rondo abandon`
settles a row rondo cannot finish.
[`docs/operations/rondo-cli.md`](docs/operations/rondo-cli.md) is the runbook and
carries a measured walk: 22.8 s to the gate, 1.3 s to close it. Before this, the
same walk needed a hand-written driver script and six verbs typed in order.

What does **not** exist yet, and is not merely unfinished but undecided:

- the web UI and the localhost MCP surface — `src/access/` now holds the
  composition root, the ASCII escaper and the operator's command line. D-0020
  takes the five operating-surface rows cadenza sent to rondo's gate and
  **decides only**: the gate panes, the OIDC adapter and the conversation store
  are a later diff, and D-0025 rule 4 records what a command line can and cannot
  keep of D-0020's identity rule in the meantime;
- the agent-type *registry* — cadenza supplies the record and rondo can now
  build one (D-0018), and there is nowhere to keep them;
- an identifier allocator, and with it any second concurrent iteration. D-0019
  rule 10 records that single-flight is a lap-1 **reduction** rather than the
  shape rondo is aiming at, and names the route to N — a capacity ledger under
  D-0012's three conditions;
- the conductor's own verify, and a resumable `needs_approval`. Both are
  recorded as lap-1 reductions with their triggers named (D-0019 rules 15
  and 16) rather than left as holes.

None of those now waits on an open design row. cadenza's
`docs/design/conductor.md` section 11 sent eight of its seventeen rows to
rondo's gate, and all eight are entries here: `cadenza C-8` and `cadenza C-14`
in D-0001, and `cadenza C-4`, `cadenza C-5`, `cadenza C-6`, `cadenza C-7`,
`cadenza C-13` and `cadenza C-15` in D-0009 … D-0014, each taken as the row
recommends on 2026-09-05 (D-0001 is superseded by D-0018; the continuo half of
`C-8` and `C-14` is unchanged and lives in D-0015 and D-0017) — three of them correcting a reason continuo has since
overtaken. `cadenza C-11` was settled at continuo's gate (`continuo D-0076`), so
no row of section 11 is open anywhere. The decision to host this in a third
repository is that document's `cadenza C-17`, taken on 2026-09-05, and it is why
this repository exists.

Two of D-0001's own falsifiers fired on 2026-09-05 — cadenza acquired a package
entry point (cadenza `D-0033`), and continuo's CLI grew a `--version` that
carries the build's revision plus `--json` on the verbs a host drives (continuo
`D-0090`). Both were answered at rondo's gate on the same day, with the siblings
re-measured at their current commits: **D-0015** re-argues the continuo seam on
its merits and **D-0016** took the new decision about cadenza, and neither
outcome changed then. **On 2026-09-06 the cadenza half changed**: cadenza
exported the agent-type record (cadenza `D-0034`) — one of the falsifiers D-0016
named for itself — and accepted a delivery route for a consumer that installs
with `--ignore-scripts` (cadenza `D-0035`), which is not on that list and
instead removes the cost D-0016 weighed, since the route is now cadenza's own
documented procedure rather than one rondo would have invented. **D-0018**
answers both and supersedes D-0001 and D-0016. What D-0018 does *not* touch is D-0001's other
half: continuo across a CLI process boundary, and the duty to record which
continuo revision drove a run, are unchanged and live in D-0015 and D-0017.

`node vendor/pin.mjs check && npm ci --ignore-scripts && npm run verify` is the
whole of verification, and the first command is part of it rather than a
formality: it says whether the vendored cadenza tarball is still the one this
repository pinned, before npm can install previously pinned bytes out of a warm
cache (D-0018 rule 4). CI runs the same sequence on ubuntu and windows, on Node
22 and Node 24 — macOS is deliberately not in the matrix, because nothing here
is platform-specific in a way the Windows cell does not already exercise
harder.

## How it relates to continuo and cadenza

rondo is the consumer. Neither sibling depends on it, and neither is changed to
suit it.

**rondo depends on exactly one of them as a package: cadenza.** Both siblings
are still `private: true` and unpublished (`npm view` answers `E404` for each),
and neither builds on install — that measurement, in D-0001 and re-measured in
D-0015 and D-0016, has not changed and is why neither can simply be named as a
git or `file:` dependency. What changed is that cadenza wrote down a route that
works anyway (`cadenza D-0035`): build it once, by hand, from a pinned commit,
and commit the resulting tarball. rondo takes that route in D-0018, and it takes
it for cadenza only — continuo stays a subprocess.

For **lap 1**:

- **continuo is driven across a CLI process boundary** — a checkout pinned by
  commit sha, built once, and invoked as a subprocess. This is the only route
  that works today without changing continuo, and it is what cadenza's own
  design recommends for the same seam (`cadenza C-8`). Its cost is real and is
  written down (D-0015 keeps the ledger). `--version` now carries the build's
  git revision, and **all eleven** of the continuo verbs rondo drives answer
  `--json` — ten of them did when D-0015 was taken, and `gate close` joined them
  in `continuo D-0092`, which is what D-0017 rule 1 acts on — so two of the costs
  D-0001 recorded have improved. But that JSON is a versioned
  *wire protocol*, not types across the seam: rondo owns the runtime decoders.
  Recording *which* continuo drove a run is still rondo's job (`cadenza C-14`),
  now by verifying the revision `--version` reports against the pinned sha and
  persisting what was observed. `gate close` — the one verb rondo's own D-0013
  assigns to its operating surface — had no `--json` when D-0015 was taken, so
  that entry drove it as an opaque exit code confirmed by a second
  `gate show --json`. **That gap is closed.** `continuo D-0092` gives the verb
  the shared envelope, which fired D-0015's own falsifier, and **D-0017 replaces
  rule 5**: `gate close` is decoded like every other verb, and the second
  subprocess is gone.
- **cadenza is consumed as a library** (D-0018), through the bridge cadenza
  accepted for exactly this (`cadenza D-0035`): a tarball packed once from
  cadenza `5d5d9f408c29f6500c422c8e10e6b6a3a6882aaf`, committed under `vendor/`
  with its sha256, and named in `package.json` as
  `file:vendor/suisya-systems-cadenza-0.0.0.tgz`. Three separate facts are
  pinned and never conflated — the **commit** (`cadenza.pin.json`) is what was
  meant to be built, the **sha256** is which bytes rondo carries, and the
  lockfile's **sha512** is which bytes npm installs. What the bridge cannot give
  is provenance: nothing but the procedure and the person who ran it connects
  that commit to those bytes, and that gap closes when cadenza publishes.
  Everything rondo imports goes through one facade, `src/cadenza/facade.ts`; no
  other module is allowed to name the package.

What changes this: **publication**. When continuo is published to a registry
(`continuo D-0045`), the dependency becomes an ordinary pinned version with an
*enforced* integrity hash, real library types, and a publisher-built tarball
that keeps `--ignore-scripts` meaningful on rondo's side. D-0015 records that
this makes the library-versus-subprocess choice a real choice for the first time
rather than flipping a pre-decided switch. cadenza's publication is a separate
decision cadenza has not taken — and when it is taken, it deletes the bridge:
the vendored tarball, `vendor/pin.mjs`, the sha256 and the source pin are all
replaced by an ordinary pinned version whose integrity npm enforces without any
of this. That is what the bridge is for, and cadenza's own page says it is
written to be thrown away.

## Layout

| Path | What it is |
|---|---|
| `src/refrain/` | The loop (D-0019): a pure `nextStep` planner, an async interpreter over injected ports, the `RunPlan` and its validation, and the one module that consumes cadenza. Imports nothing external, ever — that is the boundary, and it is why continuo arrives as a port rather than as an import. |
| `src/access/` | Access points: the web UI and the localhost MCP surface, when they exist. May reach the loop, the store and the continuo seam; none may reach back. `conductor.ts` is the composition root that wires the ports and carries `resume` and `abandon`; `console.ts` is the one place output is escaped to ASCII. |
| `src/continuo/` | The seam to continuo (D-0017): a pure protocol decoder, the pin and its verification, and `invoker.ts` — the one module under `src/` allowed to start a process. Reaches only itself. |
| `src/cadenza/` | The seam to cadenza (D-0018): `facade.ts` is the one module under `src/` allowed to import `@suisya-systems/cadenza`, binding by binding. Reaches only itself; the loop reaches *it*, which is the arrow D-0018 rule 5 left unbuilt and D-0019 took. |
| `src/store/` | Durable state (D-0019 rule 10): the iteration schema, `reserve`/`transition` under `BEGIN IMMEDIATE`, and the partial unique index that makes single-flight the database's invariant. `sqlite.ts` is the one module allowed to name a SQLite driver and `plan.ts` the one allowed to take a hash. |
| `test/architecture/` | The test that enforces the arrows above, and the per-module capability grants (SQLite, the spawn, and the cadenza package). |
| `continuo.pin.json` | Which continuo rondo drives: repository, full sha, and the exact `--version` line that build prints. CI provisions from it; `src/continuo/pin.ts` mirrors it; a test fails if they drift. |
| `cadenza.pin.json` | Which cadenza rondo carries: repository and full sha — the *source* pin, and no version, because every cadenza build is `0.0.0`. |
| `vendor/` | The committed cadenza tarball, its sha256, and `pin.mjs` — the portable `record`/`check` helper cadenza's bridge prescribes. `node vendor/pin.mjs check` runs immediately before every install, locally and in all three installing CI jobs. |
| `DECISIONS.md` | The append-only design record. Cite by ID. |
| `AGENTS.md` | How work here is done. |
| `scripts/dogfood-lap.md` | The full lap, end to end, as a manual procedure. Not a test, and D-0019 rule 17 says why. |
| `docs/` | Index of the records, and of where the enforced rules live. `docs/design/refrain-lap1.md` is the lap-1 conductor design D-0019 decides. |

## The name

A rondo is the piece that keeps coming home: a refrain the listener already knows, set between episodes that are free to wander, and the refrain is where the piece is decided - it opens, it returns after every excursion, and it has the last word. That is what this application is, not what it performs: the one place the human ever speaks to, and the one record everything else is played from. Each delegated run is an episode that leaves it and is cued back to it, and every return is a gate - the refrain does not resume until the human has said yes or no, and it accepts that answer exactly once. Continuo underpins the whole piece and cadenza defines the solo; rondo is where the piece always returns.
