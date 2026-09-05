# AGENTS.md

For anyone picking up an open issue here who is not already inside this
repository's habits — human or AI agent. It records only what is specific to
rondo and easy to get wrong; it is not a guide to writing software. Every rule
names its evidence (a `D-00NN` entry in `DECISIONS.md`, a file path, or a CI job
name), and where this file and that evidence disagree, the evidence wins.

`README.md` says what rondo is. This file says how work on it is done.

## 1. rondo is a host, and it now conducts exactly one lap

`src/` holds five layers and four of them do work. `src/continuo/` drives the
pinned continuo across a process boundary and decodes its answers (D-0017);
`src/cadenza/` holds the one module allowed to import the vendored cadenza
(D-0018); `src/store/` holds the iteration schema, whose partial unique index
makes "at most one non-terminal iteration" the database's invariant; and
`src/refrain/` holds the conductor — a total, pure `nextStep` planner beside an
async interpreter that reaches continuo through **injected ports** and cadenza
through the one arrow the boundary table grants it (D-0019). `src/access/` holds
the composition root that wires them.

**What that does and does not mean.** The arc runs end to end and stops where it
is supposed to: it classifies against a contract, admits a run, walks one lap,
and suspends at a gate a human has yet to answer. It never composes the answer
(D-0009), never publishes (D-0010), never closes a gate (D-0013) and runs one
iteration at a time (D-0012). There is still no web UI, no MCP surface, no
agent-type registry and no allocator — and the last of those is why single-flight
is a **reduction** rather than the target shape (D-0019 rule 10, rondo#8).

**Two rules of this layer are worth knowing before you touch it.**
`src/refrain/`'s external allowance is *empty* and must stay empty: that is why
continuo arrives as a port and why the plan's digest is taken in the store.
And `nextStep` is total and pure — effects live in `interpreter.ts` and arrive
as parameters. A change that puts an effect in the planner is a change that
needs a decision, not a review comment.

So the thing to check before starting is not "does this fit the architecture" —
it is **"has the decision this depends on been taken?"** Most of rondo's design
was proposed in cadenza's `docs/design/conductor.md` section 11 as decision rows
(`cadenza C-1` … `cadenza C-17`), and **the eight rows that came to rondo's gate
have all been taken**: `cadenza C-8` and `cadenza C-14` in D-0001, and
`cadenza C-4`, `cadenza C-5`, `cadenza C-6`, `cadenza C-7`, `cadenza C-13` and
`cadenza C-15` in D-0009 … D-0014. `cadenza C-17` — why this repository exists —
was decided at cadenza's human gate on 2026-09-05 (cadenza `D-0029`), and
`cadenza C-11` was settled at continuo's (`continuo D-0076`), so no row of that
section is open anywhere.

So the answer to "has it been decided?" is now usually yes, and the entry is
where the answer is. Read the D- entry before implementing against a row: three
of the six take the row's outcome while **correcting the reason the row gives**,
because continuo moved under it. And a decision a row does not cover is still
not a licence to choose — name it on the issue.

That pattern has now happened to D-0001 itself, twice, which is the thing to
understand before reading section 2. Two falsifiers D-0001 names for itself
fired on 2026-09-05 — cadenza acquired a package entry point (cadenza `D-0033`),
and continuo's CLI grew a `--version` carrying the build's revision plus `--json`
on the verbs a host drives (continuo `D-0090`). Both were answered the same day,
against re-measurements at the siblings' current commits: **D-0015** re-argues
the continuo seam and **D-0016** took the new cadenza decision, and neither
outcome changed then. On 2026-09-06 the cadenza half moved for real: cadenza
exported the agent-type record (`cadenza D-0034`), which is one of D-0016's own
falsifiers, and accepted a delivery bridge (`cadenza D-0035`), which is not on
that list but removes the cost D-0016 weighed against consuming cadenza at all.
**D-0018 supersedes both D-0001 and D-0016**.

Two habits follow. **Read the superseding entry, not the superseded one**, where
they describe the same fact: D-0001's and D-0016's measurements are of older
commits and are kept as taken. And **supersession here is whole-entry**, so read
what the replacement says survives — D-0018 supersedes D-0001 while explicitly
leaving its items 2 and 4 standing (continuo as a subprocess, and recording
which continuo revision drove a run), carried by D-0015 and D-0017.

## 2. rondo consumes continuo as a subprocess and cadenza as a package (D-0015, D-0017, D-0018)

This is the most surprising pair of facts about the repository, so it is second.
It is also the part that moved most recently: D-0001 and D-0016 said rondo
consumed **neither**, and **D-0018 supersedes both** as far as cadenza is
concerned.

`package.json` now has a `dependencies` block with exactly one entry:

```
"@suisya-systems/cadenza": "file:vendor/suisya-systems-cadenza-0.0.0.tgz"
```

Both siblings are still `private: true` and unpublished (`E404`), and **neither
has a lifecycle script that would build on install** — a decision at each
sibling's own gate (`continuo D-0045`, `cadenza D-0033`), not an omission. So a
git or `file:`-to-a-checkout install of either still succeeds and delivers a
tree with no `dist/`: green install, `ERR_MODULE_NOT_FOUND` at the first import.
What changed is that cadenza wrote down the route that does work
(`cadenza D-0035`, `docs/artifact-delivery-bridge.md`): a person builds cadenza
once from a pinned commit in a scratch clone, `npm pack`s it, and the consumer
**commits the tarball**. continuo is still reachable only across a **CLI process
boundary**.

Consequences for anyone adding code here:

- **Do not move the cadenza pin by hand.** Moving it is phase 1 of the bridge —
  clone at the new sha, verify `rev-parse`, `npm ci --ignore-scripts`,
  `npm run build`, `npm pack` into `vendor/`, `node vendor/pin.mjs record`,
  `npm install --ignore-scripts ./vendor/<tarball>` — and the diff is the
  tarball, `vendor/cadenza.tgz.sha256`, `cadenza.pin.json`, `package.json` and
  `package-lock.json` **together**. `test/cadenza/pin.test.ts` fails when they
  stop describing one file. The scratch clone is never committed.
- **Run `node vendor/pin.mjs check` before `npm ci`, always.** npm enforces its
  integrity hash against its cache, so a drifted tarball is `EINTEGRITY` on a
  cold cache and a silent install of the *previously pinned* bytes on a warm one
  (D-0018 rule 4). CI does this in all three installing jobs, and the pin test
  fails if an install ever loses its check.
- **`src/cadenza/facade.ts` is the only module that may import the package, and
  its bindings are granted one by one** (D-0018 rule 5). Needing another value
  from cadenza is an edit to the facade *and* to
  `ALLOWED_EXTERNALS_BY_MODULE` — which is the point: cadenza exports 80 values,
  and `delegate` and `adopt` compose a widening successor rondo must never
  compose (D-0009). A second module in `src/cadenza/` is not granted the
  package, and neither is a deep path into it.
- **`src/refrain -> src/cadenza` does not exist yet.** Add that arrow in the
  diff where conductor code actually consumes the facade, not in advance.
- **Do not add a dependency on continuo without superseding D-0015 / D-0017.**
  D-0001's measurements of that seam were kept when it was superseded; each cost
  is written down, and reaching for a git specifier because it "should work"
  repeats an experiment whose result is already in the file.
- **Do not fix a sibling to make rondo's life easier.** Where a sibling change
  genuinely is needed, it goes through that sibling's own gate — escalate, do
  not patch. D-0001's escalation list is largely spent: three of its four
  requests were carried out at the siblings' gates on 2026-09-05, and the fourth
  was a request to un-decide something.
- **The seam is `src/continuo/`, and it is the one place under `src/` that starts
  a process** (D-0017). The decoder is pure; the invoker alone is granted `spawn`;
  the pin lives in `continuo.pin.json` and is mirrored in `src/continuo/pin.ts`;
  and `RONDO_CONTINUO_CLI` only *locates* a build someone else made — it can
  never stand in for the pin. The end-to-end smoke is mandatory in every CI cell
  and capability-gated locally.
- When continuo is driven, it is driven as a **subprocess whose revision rondo
  verifies and records** (cadenza `C-14`, D-0015 rule 6). Verification exists;
  the per-run persistence does not, because there is no store schema yet, and
  D-0017 rule 5 says so rather than letting the rule read as done. `--version` now
  reports the build's git revision, so provenance is no longer rondo inventing
  an answer the seam cannot give — it is rondo *checking* the seam's answer
  against the pinned sha and persisting what was observed. A mismatch, the
  literal `unknown`, or a `-dirty` suffix is a startup refusal. Build the pinned
  checkout with `CONTINUO_REQUIRE_REVISION=1` so an unidentifiable build fails
  at build time.
- **`--json` is a wire protocol, not types.** rondo drives eleven continuo verbs
  and, since `continuo D-0092`, **all eleven** carry it — D-0015 recorded ten,
  and `gate close` was the eleventh. (At the revision pinned today, `gate
  present`, `deliver` and `ack` carry it too — `continuo D-0097` — and `run show`
  is a read verb that arrived with it, `continuo D-0096`. rondo drives none of
  those four. `gate reconcile` is the one verb in the surveyed set still without
  the flag; it is human-only, so that is not rondo's gap either.)
  rondo owns the runtime decoders and converts validated documents into rondo's
  own records. Three things the flag does not reach, all of which rondo's
  callers must handle: parser-level refusals are exit 2 with *prose* rather than
  a document; a malformed operator value escapes as **exit 1 with a raw stack**,
  so validate **every** operator-supplied value before spawning — `--run-id`,
  `--workspace`, `--base-branch`, `--topic-branch`, `--lease-claimant-id` and
  `--actor-id` are the known ones; and `measure report` answers unwrapped, identified
  by `report_kind`. **`gate close` used to reject `--json` at the top
  level**, and D-0015 rule 5 was the workaround; `continuo D-0092` closed that
  gap and **D-0017 replaces rule 5** — the verb answers in
  `continuo.gate.close/1` and is decoded like every other, with no confirming
  `gate show` call. Its prose is still never parsed.
- **Relaying continuo's prose is not relaying continuo's bytes** (D-0015 rule
  7). Pass its words through unedited, but escape them to ASCII before printing:
  continuo echoes `--db` verbatim and unconstrained, so a non-ASCII path or gate
  id arrives as non-ASCII on stderr, and section 6 below is what that would
  break. Escaping is transport; parsing is meaning. Do the first, never the
  second.

## 3. Decisions go in `DECISIONS.md`

Any change that settles a design question — not just code — adds an entry. The
rules, from that file's own "How to use this file":

- **IDs are permanent.** Never reuse, renumber, merge or delete one.
- **Supersession keeps the ID**: the old entry gains
  `Status: superseded by D-XXXX` and the replacement is appended with a new ID.
- **Append-only forbids removing and rewriting, not annotating.** A later entry
  may add a marked, dated note to an earlier one — which falsifier fired, which
  entry answered it — leaving every original claim readable underneath. Changing
  what an entry *asserted* is a supersession and takes a new ID. D-0001 carries
  three such annotations from D-0015 and D-0016.
- **Cross-reference by ID only** — never by line number or heading order.
- **Every entry states what would falsify it.** An entry taken on facts that can
  change records the fact and the date it was measured at, so a later reader can
  tell "still true" from "was true in 2026".
- Cite other repositories' decisions as `continuo D-00NN` / `cadenza D-00NN` and
  cadenza's design rows as `cadenza C-NN`; the numbering spaces are unrelated.

Add the ID to the index table at the top of the file as well as to the body.

## 4. Verification

`npm run verify` is the whole of it: `lint`, `knip`, `typecheck`, `test`. Run it
before reporting anything as done. It takes a few seconds.

Four things about it are not obvious:

- **`node vendor/pin.mjs check` comes first, and `npm ci` second** (D-0018 rule
  4). The full local sequence is
  `node vendor/pin.mjs check && npm ci --ignore-scripts && npm run verify`. The
  check is not decoration next to npm's own integrity hash: npm enforces that
  against its cache, so a tarball that drifted from the one this repository
  pinned fails loudly on a cold cache and installs the previously pinned bytes,
  silently and with exit 0, on a warm one.
- **`npm ci`, never `npm install`** (D-0007). On npm 10.9.2 a fresh
  `npm install` in this repository fails outright with
  `Cannot read properties of null (reading 'edgesOut')` — an arborist crash
  while resolving vitest's peer set, not a fault in the manifest. `npm ci`
  reifies from the lockfile and does not take that path. If you must regenerate
  the lockfile, `npm install --legacy-peer-deps` produces one that `npm ci` then
  installs cleanly; check the diff.
- **The test seed is required under CI and optional locally** (D-0003). Locally
  the seed is time-derived and *printed*, so a failure under a shuffled order is
  replayable from your scrollback: `RONDO_TEST_SEED=<the printed number>`.
- **`npm run lint` is `biome check`, which includes formatting.** A formatting
  difference is a red gate, not a warning. `npm run lint:fix` writes it.
- **A green type-check does not mean the API exists on Node 22.** `@types/node`
  is pinned at `26.3.0` to match continuo and cadenza (D-0002), which is ahead
  of both supported runtimes. If you reach for a recent Node API, check its
  availability yourself; the Node 22 cell is what catches it, and it catches it
  at runtime rather than at the type-check.

## 5. The boundary test is the point of the build (D-0006)

`test/architecture/import-boundaries.test.ts` is what CI exists to run while
rondo has no behaviour. Two habits keep it worth its runtime:

- **When you add a module under `src/`, the test tells you what to decide.** A
  new top-level module is unclassified and fails; a new external dependency is
  ungranted and fails. Both failures are the question "which layer is this, and
  what is it allowed to reach?" arriving at the right moment. Answer it in
  `ALLOWED_INTERNAL_BY_LAYER` / `ALLOWED_EXTERNALS_BY_MODULE`, and say why in
  the diff. `src/cadenza/` is the worked example: a layer that names only
  itself, one module granted one package, and every binding of that package
  listed by name.
- **Widening the allowlist is a decision.** Granting `node:http` to an access
  point is fine and expected. Granting anything at all to `src/refrain/` is the
  boundary Issue #1 drew, and needs a `D-` entry.

The sweep generates its cases from a directory walk, so its failure mode is
finding nothing and reporting a clean tree. `PLANTED` inside the file guards
that from the inside, and the `boundary-is-not-vacuous` CI job guards it from
the outside by writing a real violating module and requiring the suite to go red
*with both of that module's violations named in the output* — a red run for some
other reason fails the job too, because it would certify nothing.
`boundary-is-not-vacuous` is the YAML job id; the check name GitHub shows, and
the string a required-checks ruleset would name, is
`a planted violation makes the boundary test fail`. **If you change how modules
are discovered, run its steps by hand before pushing** — a green suite over an
empty walk looks exactly like a green suite.

## 6. Anything rondo prints is ASCII (D-0004)

CI includes a Windows cell, where the console may be cp932. A character that
cannot be encoded there crashes the writer rather than printing badly, and
vitest captures stdout through a UTF-8 path, so a test will not catch it. This
applies to `--help` text, `print`/`console.log` output and error messages — not
to comments, Markdown, or test names.

## 7. Scope

Do what the issue says and stop. rondo's issues are deliberately narrow because
most of what would widen them is a decision, and a decision is taken **as its own
`DECISIONS.md` entry at rondo's gate** — not implicitly, in the middle of an
implementation diff that was scoped to something else. If you find one that has
to be taken to finish an issue, name it on the issue rather than settling it in
passing.

## 8. Review and merge are ours, not yours

Open a PR; do not merge it, and do not push to `main`. `gate` is the required
check; a PR is not ready while any of its upstream jobs is red, skipped or
cancelled — `gate` fails on all three.

## 9. Language

Issues, pull requests, commit messages, code comments and every file in the
repository are in English. Conversation about the work can be in whatever
language the participants share.
