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
lives in cadenza's `docs/design/conductor.md` section 11 as open rows (`C-1` …
`C-17`), and a row that is still open is not a licence to choose. Ask on the
issue rather than choosing.

## 2. rondo consumes continuo and cadenza — and today it consumes neither (D-0001)

This is the single most surprising fact about the repository, so it is second.

`package.json` has **no `dependencies` block at all**. That is not an oversight
and not a "yet to be wired up": it is D-0001, taken on measurement. Both
siblings are `private: true`, unpublished (`E404`), and ship no build output;
cadenza has no entry point of any kind. The three options Issue #1 asked to be
measured were measured, and the answer was that continuo is reachable only
across a **CLI process boundary** and cadenza is reachable by **no route that
does not require a change inside cadenza**.

Consequences for anyone adding code here:

- **Do not add a git, `file:`, workspace or tarball dependency on either sibling
  without superseding D-0001.** Each of the four was measured; each cost is
  written down. Reaching for one because it "should work" repeats an experiment
  whose result is already in the file.
- **Do not fix a sibling to make rondo's life easier.** If a lap needs
  `@suisya-systems/cadenza` to be importable, the change belongs in cadenza,
  through cadenza's own gate. D-0001 names the exact fields. Escalate; do not
  patch.
- When continuo is driven, it is driven as a **subprocess whose revision rondo
  records itself** — the CLI reports `0.0.0` for every commit, so provenance is
  rondo's problem (cadenza `C-14`).

## 3. Decisions go in `DECISIONS.md`

Any change that settles a design question — not just code — adds an entry. The
rules, from that file's own "How to use this file":

- **IDs are permanent.** Never reuse, renumber, merge or delete one.
- **Supersession keeps the ID**: the old entry gains
  `Status: superseded by D-XXXX` and the replacement is appended with a new ID.
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

Three things about it are not obvious:

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
the outside by writing a real violating module and requiring the suite to go
red. **If you change how modules are discovered, run that job's steps by hand
before pushing** — a green suite over an empty walk looks exactly like a green
suite.

## 6. Anything rondo prints is ASCII (D-0004)

CI includes a Windows cell, where the console may be cp932. A character that
cannot be encoded there crashes the writer rather than printing badly, and
vitest captures stdout through a UTF-8 path, so a test will not catch it. This
applies to `--help` text, `print`/`console.log` output and error messages — not
to comments, Markdown, or test names.

## 7. Scope

Do what the issue says and stop. rondo's issues are deliberately narrow because
most of what would widen them is an open row in cadenza's design. If you find a
decision that has to be taken to finish an issue, name it on the issue rather
than taking it in the diff.

## 8. Review and merge are ours, not yours

Open a PR; do not merge it, and do not push to `main`. `gate` is the required
check; a PR is not ready while any of its upstream jobs is red, skipped or
cancelled — `gate` fails on all three.

## 9. Language

Issues, pull requests, commit messages, code comments and every file in the
repository are in English. Conversation about the work can be in whatever
language the participants share.
