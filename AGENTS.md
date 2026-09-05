# AGENTS.md

For anyone picking up an open issue here who is not already inside this
repository's habits — human or AI agent. It records only what is specific to
rondo and easy to get wrong; it is not a guide to writing software. Every rule
names its evidence (a `D-00NN` entry in `DECISIONS.md`, a file path, or a CI job
name), and where this file and that evidence disagree, the evidence wins.

`README.md` says what rondo is. This file says how work on it is done.

## 1. rondo is a host, and it currently hosts nothing

The repository is a skeleton. `src/` holds three layers and six modules, none of
which does any work: there is no loop, no web UI, no MCP surface, no store
schema and no code that talks to an agent. That is the state Issue #1 left it
in, deliberately.

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

That pattern has now happened to D-0001 itself, which is the thing to understand
before reading section 2. Two falsifiers D-0001 names for itself fired on
2026-09-05 — cadenza acquired a package entry point (cadenza `D-0033`), and
continuo's CLI grew a `--version` carrying the build's revision plus `--json` on
the verbs a host drives (continuo `D-0090`). Both were answered the same day,
against re-measurements at the siblings' current commits: **D-0015** re-argues
the continuo seam and **D-0016** takes the new cadenza decision. **Neither
outcome changed and D-0001 stays accepted** — but D-0001's own measurements are
of the older commits and are kept as taken, so where D-0001 and D-0015/D-0016
describe the same fact, **the later entry is the current one**.

## 2. rondo consumes continuo and cadenza — and today it consumes neither (D-0001, D-0015, D-0016)

This is the single most surprising fact about the repository, so it is second.

`package.json` has **no `dependencies` block at all**. That is not an oversight
and not a "yet to be wired up": it is D-0001, taken on measurement and
re-measured at the siblings' current commits in D-0015 and D-0016. Both siblings
are `private: true` and unpublished (`E404`), and **neither has a lifecycle
script that would build on install** — which is a decision at each sibling's own
gate (`continuo D-0045`, `cadenza D-0033`), not an omission. So a git or `file:`
install of either succeeds and delivers a tree with no `dist/`: green install,
`ERR_MODULE_NOT_FOUND` at the first import. continuo is reachable only across a
**CLI process boundary**; cadenza is reachable only as a **built artefact
someone else builds**, which for lap 1 means not at all.

Consequences for anyone adding code here:

- **Do not add a git, `file:`, workspace or tarball dependency on either sibling
  without superseding D-0001.** Each was measured twice; each cost is written
  down. Reaching for one because it "should work" repeats an experiment whose
  result is already in the file — including the two that now look plausible and
  are not: cadenza's `exports` map means a deep path into `src/` is refused
  outright (`ERR_PACKAGE_PATH_NOT_EXPORTED`), and `npm pack` succeeding on a
  built tree says nothing about what a git specifier delivers.
- **If a lap needs something from cadenza, the decision to revisit is D-0016,
  not D-0001, and it is rondo's gate rather than cadenza's.** cadenza is already
  importable from a built tarball — that was measured, and 70 values are on the
  exported surface — so needing one of them requires **no sibling change at
  all**; what it requires is a decision about delivery, which is D-0016's
  subject. Take it there. Only a value that is *not* exported (the agent-type
  record is the known one) is cadenza's question, and D-0016 names it.
- **Do not fix a sibling to make rondo's life easier.** Where a sibling change
  genuinely is needed, it goes through that sibling's own gate — escalate, do
  not patch. D-0001's escalation list is largely spent: three of its four
  requests were carried out at the siblings' gates on 2026-09-05, and the fourth
  was a request to un-decide something.
- When continuo is driven, it is driven as a **subprocess whose revision rondo
  verifies and records** (cadenza `C-14`, D-0015 rule 6). `--version` now
  reports the build's git revision, so provenance is no longer rondo inventing
  an answer the seam cannot give — it is rondo *checking* the seam's answer
  against the pinned sha and persisting what was observed. A mismatch, the
  literal `unknown`, or a `-dirty` suffix is a startup refusal. Build the pinned
  checkout with `CONTINUO_REQUIRE_REVISION=1` so an unidentifiable build fails
  at build time.
- **`--json` is a wire protocol, not types.** rondo drives eleven continuo verbs
  and ten of them carry it. (continuo has fifteen in the surveyed set; the other
  four — `gate present`, `deliver`, `ack`, `reconcile` — are human-only and
  rondo drives none of them, so their lack of `--json` is not rondo's gap.)
  rondo owns the runtime decoders and converts validated documents into rondo's
  own records. Three things the flag does not reach, all of which rondo's
  callers must handle: parser-level refusals are exit 2 with *prose* rather than
  a document; a malformed operator value escapes as **exit 1 with a raw stack**,
  so validate **every** operator-supplied value before spawning — `--run-id`,
  `--workspace`, `--base-branch`, `--topic-branch`, `--lease-claimant-id` and
  `--actor-id` are the known ones; and `measure report` answers unwrapped, identified
  by `report_kind`. **`gate close` has no `--json` at all** and rejects the flag
  at the top level — drive it as an opaque exit code and confirm with
  `gate show --json`; never parse its prose (D-0015 rule 5).
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
  the diff.
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
