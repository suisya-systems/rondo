# Rondo — DECISIONS

This file is the canonical, append-only record of rondo's design decisions.

**The numbering space is rondo's own.** It starts at `D-0001` and has nothing to do with
[`suisya-systems/continuo`](https://github.com/suisya-systems/continuo)'s `D-0001` or
[`suisya-systems/cadenza`](https://github.com/suisya-systems/cadenza)'s, each of which is a
different decision about a different repository. Every reference to a sibling's decision below is
written `continuo D-00NN` or `cadenza D-00NN`, and cadenza's design rows are cited as `cadenza
C-NN`, so the spaces can never be read as one.

## How to use this file

- **IDs are permanent.** `D-0001` ... are stable identifiers. Once assigned, an ID is never
  reused, renumbered, merged into another entry, or deleted.
- **Supersession keeps the ID.** A decision that stops being true keeps its ID and gains
  `Status: superseded by D-XXXX`; the replacement gets a new ID at the end of the list.
- **Cross-reference by ID only.** Never cite this file by line number, heading order, or table
  position.
- **Every entry states what would falsify it.** A decision taken on facts that can change records
  the fact, the version, and the date it was measured at, so a later reader can tell "still true"
  from "was true in 2026".
- **Belts hold disjoint number ranges**, so concurrent lanes conflict only in the index table above
  and never over an ID. `D-0001`..`D-0099` is the bootstrap band and the shared band for
  cross-belt decisions taken at the window. Later belts allocate their own `D-01xx`, `D-02xx`, ...
  by an entry in this band, as continuo and cadenza do. The ranges are an allocation, not a
  meaning: nothing about an entry follows from which range it is in.

## Index

| ID | Title | Status |
|---|---|---|
| D-0001 | How rondo consumes continuo and cadenza in lap 1: a CLI process boundary for continuo, and nothing at all for cadenza | accepted |
| D-0002 | The TypeScript configuration: ESM, NodeNext, strictness beyond `strict`, and no build output yet | accepted |
| D-0003 | The double-green rule, and where it is enforced | accepted |
| D-0004 | ASCII-only for anything rondo prints | accepted |
| D-0005 | One module owns SQLite, and the driver is `node:sqlite` | accepted |
| D-0006 | The import boundary is a test that parses the tree, not a lint rule | accepted |
| D-0007 | Install from the lockfile, with `--ignore-scripts` | accepted |
| D-0008 | Biome, knip, and what `npm run verify` means | accepted |
| D-0009 | The conductor carries a human's answer and never composes one (cadenza `C-4`) | accepted |
| D-0010 | No mechanical step 11 in lap 1: rondo holds no push credentials and stops at the closed gate (cadenza `C-5`) | accepted |
| D-0011 | The `run admit --cli-arg` allowlist starts empty, and four flags are permanently refused (cadenza `C-6`) | accepted |
| D-0012 | Single-flight in lap 1, and what parallel admission actually waits on (cadenza `C-7`) | accepted |
| D-0013 | An aborted iteration's open gate is closed `withdrawn` by the operating surface, not by the conductor (cadenza `C-13`) | accepted |
| D-0014 | The agent type's role name is mapped in the continuo-invocation adapter, which refuses an unmapped name before admission (cadenza `C-15`) | accepted |
| D-0015 | continuo's machine-readable seam, re-argued on its merits: the CLI boundary stands, `--json` is a wire protocol rather than types, and provenance becomes a verification duty | accepted |
| D-0016 | cadenza is still not consumed in lap 1, now for a different and narrower reason: the entry point exists, the artefact does not, and the record rondo needs is not exported | accepted |

---

## D-0001 — How rondo consumes continuo and cadenza in lap 1: a CLI process boundary for continuo, and nothing at all for cadenza

**Status:** accepted (2026-09-05, rondo#1)

**Re-argued, and still accepted (2026-09-05).** Two of the falsifiers below fired on the day this
entry was taken, and both have been answered without changing what this entry decides. **D-0015**
re-argues the continuo half on its merits — the CLI process boundary stands, and this entry's "no
types across the seam" cost and its item 4 provenance requirement both acquire corrected reasoning
there. **D-0016** takes the new decision about cadenza this entry said would be needed, and
re-affirms item 3 on different facts. The measurements below are those of
`9212f2b2e6b14fa53f9a8ed378ba6d2529393c1e` / `f8b6696881de94ec13ff0d4a2eb7f16ab65b6796` and are kept
as taken; the current-revision re-measurements are in D-0015 and D-0016. Nothing here is superseded.

### Decision

1. **rondo takes no npm dependency on either sibling.** `package.json` has no `dependencies`
   block, and adding one for `@suisya-systems/continuo` or `@suisya-systems/cadenza` — in any
   specifier form — supersedes this entry rather than merely extending it.
2. **continuo is consumed across a CLI process boundary.** A checkout pinned by commit sha, built
   once, and invoked as `node <checkout>/dist/cli.js`. This is `cadenza C-8`'s recommendation for
   the same seam, reached here independently and by measurement.
3. **cadenza is not consumed at all in lap 1.** Nothing in rondo imports it, spawns it, or links
   to it. What rondo needs from cadenza's vocabulary in lap 1 it reaches through continuo or
   restates at its own boundary.
4. **rondo records which continuo revision it drove**, per run, from the sha of the checkout it
   built — because the seam cannot answer that question (see the evidence below). This is
   `cadenza C-14` landing on rondo, and it is a cost of the choice rather than a separate one.

### What was measured, and how

Everything below was run on **2026-09-05** against the two sibling checkouts on `main`, which were
treated as strictly read-only and were verified untouched afterwards (`git status --porcelain` in
both reported only a pre-existing `?? .worktrees/`, and neither acquired a `node_modules/` or a
`dist/`).

```
node --version; npm --version
```
```
v22.17.0
10.9.2
```
```
git -C <workers>/continuo rev-parse HEAD    ->  9212f2b2e6b14fa53f9a8ed378ba6d2529393c1e
git -C <workers>/cadenza  rev-parse HEAD    ->  f8b6696881de94ec13ff0d4a2eb7f16ab65b6796
```

**The baseline that makes any of this necessary.** Neither package resolves on the registry:

```
npm view @suisya-systems/continuo version
```
```
npm error code E404
npm error 404 Not Found - GET https://registry.npmjs.org/@suisya-systems%2fcontinuo - Not found
npm error 404  '@suisya-systems/continuo@*' is not in this registry.
```

The same, verbatim, for `@suisya-systems/cadenza`. A scoped `E404` on an unauthenticated client is
also what a *private published* package looks like, so this proves "this client cannot resolve it",
not "it was never published" — operationally the same thing for rondo.

**Neither package has a lifecycle script that would build on install.** This one fact explains most
of what follows:

```
grep -nE '"(prepare|prepack|prepublishOnly|postinstall|install)"' <continuo>/package.json <cadenza>/package.json; echo "grep-exit=$?"
```
```
grep-exit=1
```

**The network is not the blocker.** Both remotes answer an unauthenticated `ls-remote` (exit 0,
with `GIT_CONFIG_GLOBAL=/dev/null` and `GIT_ASKPASS=/bin/true`, and no `insteadOf` rewrite
configured), so every failure below is a packaging failure rather than an access failure.

### Option (a) — an npm git dependency at a pinned commit: **fails for continuo, fails for cadenza**

```
npm install --ignore-scripts "git+https://github.com/suisya-systems/continuo.git#9212f2b2e6b14fa53f9a8ed378ba6d2529393c1e"
```
```
npm warn skipping integrity check for git dependency ssh://git@github.com/suisya-systems/continuo.git

added 6 packages, and audited 7 packages in 14s
```

Exit 0 — and useless. `"files": ["dist", "README.md", "LICENSE"]` was honoured exactly, and `dist`
did not exist at pack time:

```
ls -la node_modules/@suisya-systems/continuo   ->  LICENSE  package.json  README.md
ls -d  node_modules/@suisya-systems/continuo/dist
```
```
ls: cannot access '.../node_modules/@suisya-systems/continuo/dist': No such file or directory
```
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../node_modules/@suisya-systems/continuo/dist/index.js'
```

`node_modules/.bin` was not created at all, although the installed manifest still advertises
`bin.continuo` — so an install-then-spawn CI job goes **green on install and dies at spawn**.

The lockfile does record an integrity hash
(`sha512-BEDsSTaL5KzGuK1IUUalGkyW0rmepaZsgTF2TzajBPk284dj2h8Qh4ZpouZgpEZi8pMebJVjq8IPi5HTagAwkg==`,
byte-stable across independent installs of the same sha), but npm prints
`npm warn skipping integrity check for git dependency` on every install: the hash is recorded, not
enforced.

For cadenza the failure is one layer earlier. With no `files` field the install ships the entire
1.7 MB working tree — `src/`, `test/`, `tests/`, `docs/`, `parity/`, a 128 KB `DECISIONS.md`,
`pyproject.toml` — and with no `exports`, `main` or `types`, resolution falls through to legacy
main:

```
Error: Cannot find package '.../node_modules/@suisya-systems/cadenza/index.js'
    at legacyMainResolve (node:internal/modules/esm/resolve:204:26)
  code: 'ERR_MODULE_NOT_FOUND'
```

Reaching the barrel directly does not rescue it. Node **categorically refuses** to strip types for
any file under `node_modules`, on both legs of rondo's own matrix — `node v22.17.0
--experimental-strip-types` and `node v24.15.0`, where stripping is on by default:

```
ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING
```

This is worth stating precisely, because the obvious reading is wrong: **no future Node version
rescues cadenza here.** Only a third-party loader does. With `tsx` installed, the deep specifier
`@suisya-systems/cadenza/src/index.ts` both type-checks under TypeScript 7.0.2 with NodeNext and
runs (`ok via .js specifier: 70 exports`), so cadenza is not *impossible* to consume — it is
consumable only by compiling a dependency's source, through an unversioned internal path, behind a
runtime loader. That is a dependency rondo declines to take, not one it cannot take.

**The one-line diagnosis — and why it is not an escalation.** On a throwaway clone of continuo in
scratch — the real checkout untouched — adding `"prepare": "npm run build"` and installing that
copy as a git dep produced `dist/`, a resolvable bare import with 814 named exports,
`dist/index.d.ts`, and a linked `node_modules/.bin/continuo`. So the diagnosis is exact and the fix
is one line.

**continuo's gate has already refused that line, and for this reason.** `continuo D-0045` rejects
the git-dependency shape outright and chooses `prepack` over `prepare` in its own words:

> `prepack` is deliberately **not** `prepare`: `prepare` is what npm runs when a *consumer*
> installs a git dependency, and adding it would collide with `D-0009`'s `--ignore-scripts` install
> policy.

That is a decision taken before this measurement existed, and the measurement below independently
reproduces the fact it rests on. Asking continuo for `prepare` would be asking it to reverse a
decision on evidence it already has, so it is **not** on the escalation list; option (a) is closed
at continuo's end, not merely unimplemented at rondo's.

Here is that fact, measured for this entry on a minimal package built for the purpose:

```
npm install --ignore-scripts "git+file://<scratch>/lib#4bfbce7"   ->  added 1 package in 600ms
ls node_modules/prepare-probe-lib/                                ->  dist  package.json
node -e 'import("prepare-probe-lib")...'                          ->  import ok: 1
```

**`--ignore-scripts` does not suppress a git dependency's `prepare` on npm 10.9.2.** The upstream
build ran and produced `dist/` under the flag whose entire purpose is to stop upstream code
executing on install (D-0007). A git dependency on continuo would therefore run continuo's build in
rondo's CI *despite* rondo's install policy. The fix and the hazard are the same line — which is
what `continuo D-0045` says, reached from continuo's side and confirmed here from rondo's.

### Option (b) — a workspace or `file:` link to the sibling checkouts: **partial for continuo, fails for cadenza**

The default `file:` form is a symlink, not a copy. `"private": true` does not block it, and with no
`prepare` nothing is built:

```
node_modules/@suisya-systems/continuo -> /home/happy_ryo/work/org/workers/continuo
```
```
FAIL @suisya-systems/continuo: ERR_MODULE_NOT_FOUND ... /dist/index.js
FAIL @suisya-systems/cadenza:  ERR_MODULE_NOT_FOUND: Cannot find package ... /index.js
```

It also installs none of the target's own dependencies — `npm ls` reports `UNMET DEPENDENCY
better-sqlite3@13.0.3` and eight more — because the link expects the target to carry its own
`node_modules`.

Two refinements were tried, and neither saves the option:

- **`--install-links`** (or `install-links=true` in `.npmrc`, needing no change in either sibling)
  makes npm copy rather than symlink, installs the target's dependencies for real, and turns the
  dangling-target case into a loud `ENOENT` at exit 254 instead of a silent success. It does not
  make continuo importable: it *packs* the target, and `files: ["dist"]` with no `prepare` packs
  three files. The install prints `added 6 packages ... found 0 vulnerabilities` and the import
  still dies on `dist/index.js` — a nastier failure than the symlink form, because it looks
  correct.
- **npm workspaces** hit `Cannot read properties of null (reading 'edgesOut')` in arborist
  `#loadPeerSet` on npm 10.9.2, installed fine from a committed lockfile, and worked under npm
  12.0.2. That crash is **not a property of the workspace form**: it is the same arborist bug that
  any fresh `npm install` of rondo's own manifest hits on that npm (D-0007 records it from the
  other side), so it is a toolchain fact that happened to be met here rather than evidence about
  workspaces. The actual blocker is structural: workspaces require the sibling sources to live
  *inside* the rondo checkout.

The decisive property is the lockfile. A `file:` dependency records a path and nothing else —
`"resolved": "../../../../home/happy_ryo/work/org/workers/continuo", "link": true` — with no
registry URL, no integrity and no commit sha, so *which revision this was built against is recorded
nowhere in the repository*. And it fails silently in the direction that matters:

```
npm ci --ignore-scripts        # with the target directory renamed away
```
```
added 1 package, and audited 3 packages in 2s
found 0 vulnerabilities
```

Green install, dangling symlink, failure deferred to the first import. A CI runner holding only the
rondo repository cannot satisfy this option in any form, and the path is machine-specific and
Linux-shaped against a matrix that includes Windows.

### Option (c) — driving continuo across a CLI process boundary: **works for continuo, does not exist for cadenza**

Measured on an out-of-tree copy (`tar --exclude=.git`, 14 MB; the real checkout was never built
in), and reproduced independently from a fresh anonymous `git clone --depth 1`:

```
npm ci --ignore-scripts    ->  136 packages in ~4s
npm run build              ->  exit 0 in <1s  (tsc 7.0.2 + six scripts/copy-*.mjs, all succeeded)
node dist/cli.js --help    ->  eight subcommand families, exit 0
continuo db create         ->  opened a real SQLite control plane
```

`better-sqlite3@13.0.3` needs no native compile: it ships `prebuilds/` for all eight platform pairs
including `win32-x64` and declares no `install`/`postinstall`, so `--ignore-scripts` is safe and the
ubuntu+windows matrix needs no build toolchain.

For **cadenza there is nothing to spawn**, in either of its languages. The TypeScript half has no
`bin`, no build script, and `"noEmit": true` with no `tsconfig.build.json`; no file under `src/`
carries a shebang or a main-module guard. The Python half — `src/cadenza/`, 20 modules with a
setuptools `pyproject.toml` — has no `[project.scripts]`, no `__main__.py`, no `argparse` and no
`sys.argv`. Option (c) does not exist for cadenza, and no consumer-side flag creates it.

### Option (d) — the GitHub codeload tarball specifier: **works for continuo, and is the runner-up**

This one was not in the Issue's list. It was found by adversarially trying to refute option (a)'s
verdict, and it is the only route that consumes continuo *as a package* today with continuo
byte-for-byte unchanged:

```
npm install --ignore-scripts "https://github.com/suisya-systems/continuo/archive/9212f2b....tar.gz"
  ->  added 6 packages, exit 0
./node_modules/.bin/tsc -p node_modules/@suisya-systems/continuo/tsconfig.build.json
  ->  exit 0, dist/ created
node node_modules/@suisya-systems/continuo/scripts/copy-{migrations,spike-schema,roles-document,fence-hook,role-schema,canary-schema}.mjs
  ->  all six succeeded
node -e 'import("@suisya-systems/continuo")'   ->  ok 814
```

A remote-tarball dependency is **not** filtered by `"files"`, so the full working tree arrives —
`src/`, `scripts/`, `tsconfig.build.json` — and the lockfile carries a **real, enforced** integrity
hash with no `npm warn skipping integrity check`. On reproducibility it is strictly better than
every other option here.

It is not chosen for lap 1 for three reasons, in order of weight. It makes rondo **responsible for
building a dependency it does not own**, by name: the exact `tsc -p` invocation and the six copy
scripts are continuo's internal build, reproduced in rondo's repository, and they break silently
when continuo's build changes. It requires rondo to **carry `typescript@7.0.2` as a runtime concern**
of installation rather than a dev tool. And the build cannot be a `postinstall` — that *is*
suppressed by `--ignore-scripts` (measured) — so it becomes an explicit step every developer and
every CI job must remember, whose omission produces the same silent-green-then-crash shape option
(a) has.

### Why (c), stated against (d)

Both work. (d) answers provenance better and (c) answers ownership better, and ownership wins for
lap 1: rondo is a skeleton whose first job is to not acquire commitments it cannot honour. Under
(c) the coupling is a documented CLI and an exit-code convention; under (d) it is continuo's
internal build layout, reproduced in rondo, with no compatibility contract at all. (c) is also what
cadenza's design reached for the same seam from a different direction (`cadenza C-8`), which is
weak evidence but not zero.

### What (c) costs, stated plainly

- **No types across the seam.** rondo gets prose on stdout and an exit code, not `Run`, `Gate` or
  `Fence` types. At the pinned sha, `--json` is declared in exactly three places —
  `src/attention/cli.ts` (`attention scan`), and twice in `src/settings/cli.ts`, on
  `settings show --explain` and on `sandbox doctor`. Not on `settings generate`. So every verb a
  host would actually drive — `run`, `lap`, `gate`, `db`, `measure` — answers in English
  sentences, and only the exit-code convention (0 success, 2 refusal) is dependable.
- **Provenance is rondo's problem.** `continuo --version` prints the compile-time literal `0.0.0`
  (`src/about.ts`) for every revision on `main`, so the seam is silent about which continuo this
  is. rondo records the checkout's sha itself. This is `cadenza C-14`, owned in full rather than
  inherited from a version range.
- **~103 ms per invocation** (measured over 10 runs of `db verify`): Node startup, the native
  addon load, and opening the database. Fine for operator-cadence verbs; poor for anything rondo
  would poll or render live.
- **A second checkout and a second build** on every developer machine and in every CI job that
  needs continuo, keyed on the continuo sha.
- `dist/cli.js` lands mode 644 with a shebang and no exec bit, so it is spawned as
  `node <path>`, never relied on as a bin link.

### What publication changes

`continuo D-0045` is the event this entry is waiting for. When continuo is published, the
dependency becomes an ordinary pinned version: `npm view` resolves, the tarball is an immutable
published artifact with an *enforced* integrity hash, `prepare` never runs on the consumer because
the publisher builds, `--ignore-scripts` regains its meaning, `files` is applied at publish time,
and types cross the seam. At that point this entry is **superseded**, not amended.

Note that the packaging work publication needs — a build script, an `exports` map, a `files` list
for cadenza — is the same work options (a) and (b) needed. It is not wasted either way.

### Escalated, not made

Neither sibling was modified. The changes each would need, named precisely so cadenza's and
continuo's own gates can weigh them.

**Three of the four were carried out at the siblings' own gates on 2026-09-05**, which is recorded
here so a later reader does not re-escalate them: cadenza's packaging (`cadenza D-0033`, see
D-0016), and both continuo requests — the revision-carrying `--version` and `--json` on the driven
subcommands (`continuo D-0090`, see D-0015). `--json` landed on ten of fifteen verbs and **not on
`gate close`**, which D-0015 measures and decides how to drive. The `prepare` non-escalation below
stands unchanged.

- **cadenza** `package.json`: an `exports` map (continuo's shape:
  `{".": {"types": "./dist/index.d.ts", "default": "./dist/index.js"}}`), a `"build"` script, a
  `"files"` list, and a new `tsconfig.build.json` with `noEmit: false`. Today cadenza has no entry
  point of any kind, which is why every option fails for it.
- **continuo**: *nothing about `prepare`.* It is the one change that would make option (a) work and
  `continuo D-0045` has already refused it, on the ground this entry independently measured. The
  escalation would be a request to un-decide something, which is not what an escalation is for.
- **continuo** `src/about.ts` / `src/cli.ts`: make `--version` carry the build's git revision, or
  add a `build-info --json` subcommand, so `cadenza C-14` is answerable across the seam rather than
  out of band.
- **continuo**: `--json` on the subcommands a host actually drives (`run admit`, `run close`,
  `lap perform`, `gate list`/`show`/`answer`, `db`).

### What would falsify it

- **continuo is published** (`continuo D-0045`). This is the expected end, not a surprise.
- **continuo grows a machine-readable surface** — `--json` on the driven subcommands and a
  `--version` that moves — at which point (c)'s two worst costs are gone and the entry should be
  re-argued on its merits rather than superseded by default.
  **Fired 2026-09-05** (`continuo D-0090`); re-argued in **D-0015**, which finds one of the two
  costs materially improved rather than gone and this entry's outcome unchanged.
- **cadenza acquires an entry point.** Then rondo has a decision to take about cadenza that it
  does not have today, and it is a new entry rather than an edit to this one.
  **Fired 2026-09-05** (`cadenza D-0033`); the new entry is **D-0016**, which re-affirms item 3 on
  the artefact and the exported surface rather than on the absence of an entry point.
- Any measurement above failing to reproduce. Every command is here so that it can be re-run; the
  toolchain it was taken on is `node v22.17.0` / `npm 10.9.2`, and npm's behaviour around
  `prepare`, `--install-links` and workspace resolution is version-dependent in ways this entry
  documents rather than assumes.

---

## D-0002 — The TypeScript configuration: ESM, NodeNext, strictness beyond `strict`, and no build output yet

**Status:** accepted (2026-09-05, rondo#1)

**Decision.** ESM (`"type": "module"`), `module` and `moduleResolution` both `NodeNext`, explicit
`.js` suffixes on every relative import, `strict` plus `noUncheckedIndexedAccess` and
`exactOptionalPropertyTypes`, and `noEmit: true` with no build configuration.

**Why the module settings are a decision and not a default.** rondo will consume continuo and
cadenza, both of which resolve modules this way. A host that resolved differently from the
libraries it consumes is a class of bug that costs one line to avoid on an empty tree and a rewrite
of every import to fix later. The `.js` suffix is the visible half of that choice, and
`test/architecture/import-boundaries.test.ts` enforces it: a relative import without a runtime
extension is a violation, so the convention cannot decay one file at a time.

**Why the two extra strictness flags.** Neither is implied by `strict`, and both are the kind of
thing that is free now and expensive after a suite exists.
`noUncheckedIndexedAccess` is what makes an index into a record an `| undefined` the reader has to
answer for, which is most of what a store layer does. `exactOptionalPropertyTypes` is what keeps
"absent" and "present and undefined" from being the same value, which is most of what a wire
protocol does. rondo will do both.

**Why no build output.** rondo is the host application, not a library: nothing consumes a `dist/`
of it. Adding an emitting configuration now would mean maintaining a build that nothing checks and
nothing installs. The day rondo ships a binary is the day it earns an entry of its own.

**One known hole, kept deliberately.** `@types/node` is pinned at `26.3.0`, which is newer than
either runtime rondo supports, so a Node 26-only API — `crypto.randomUUIDv7()` is the example —
type-checks here and is `undefined` on Node 22. Typing against the *oldest* supported runtime would
close that. It is not done, because continuo and cadenza both pin `26.3.0` and three repositories
that disagree about their Node types is a worse problem than one shared hole: a type that resolves
differently in the host and the library it consumes is exactly the class of bug the module settings
above exist to avoid. The mitigation is that the Windows and Node 22 cells *run* the suite, so an
API that does not exist on 22 fails there. Revisit when the siblings do, and revisit sooner if any
`src/` module starts calling a Node API that is not obviously ancient.

**What would falsify it.** rondo becoming something another package imports — which would mean
`C-17` had been re-decided — or the sibling packages settling on a different resolution mode when
they are published. Or the `@types/node` hole above biting for real, in which case the answer is
the oldest-runtime pin and a note in the siblings' repositories.

---

## D-0003 — The double-green rule, and where it is enforced

**Status:** accepted (2026-09-05, rondo#1)

**Decision.** Test order is shuffled on both axes (file order and, within a file, test order), and
CI runs the suite **twice per matrix cell with two distinct seeds**, both derived from the run id,
the attempt and the cell coordinates, and both printed. An unset `RONDO_TEST_SEED` under `CI` is a
hard error.

**Where each half lives, and why the split is the point.** The shuffle is configured in
`vitest.config.ts` and is **not** passed on the command line; CI injects the seed and nothing else.
A CLI flag can be deleted by an edit to a workflow file without a single test turning red, which
would retire the rule silently — the worst way to lose a guarantee, because the gate stays green
while it happens. Putting the shuffle in the config file means removing it is a diff in the file
whose whole subject is how tests run.

The seed requirement is the other half. A run whose seed was implicit cannot be replayed, so an
order-dependent failure in it is unactionable — and so is an order-dependent *success*, which is
the case people forget: the seed of a green run is what a later bisect needs. Hence the seed is
printed on success as well as failure.

**Two seeds, not two runs.** Equality between the derived seeds is astronomically unlikely and is
still handled explicitly, because "two runs at the same seed" is exactly the degenerate case that
would void the guarantee while looking like it held.

**And no retries.** `retry: 0`. A test that passes on the second attempt under a shuffled order is
precisely the signal this rule exists to surface.

**What would falsify it.** A suite whose runtime makes two full runs per cell expensive — rondo's
is currently under a second — or a source of order dependence that the shuffle cannot reach, at
which point the rule is not wrong but is no longer sufficient.

---

## D-0004 — ASCII-only for anything rondo prints

**Status:** accepted (2026-09-05, rondo#1)

**Decision.** Every string rondo writes to a terminal — `--help` text, log lines, error messages,
the test-seed line in `vitest.config.ts` — is ASCII. This does not apply to comments, Markdown,
identifiers, or test names.

**Why.** CI includes a Windows cell, where the console may be cp932. A character that cannot be
encoded there does not print badly: it raises `UnicodeEncodeError` in the writer and takes the
process with it. The failure is invisible in a normal test run, because vitest captures stdout
through a UTF-8 path — so the suite is green and the real terminal crashes. An em dash in a help
string is enough.

The rule is cheap and total, which is why it is a rule rather than a review habit: "use ASCII in
program output" needs no judgement at the point of writing, and "check whether this character
survives cp932" needs one every time.

**What would falsify it.** The Windows cell leaving the matrix, or a measurement showing the
runner's console is UTF-8 in every configuration rondo is run in — which would still leave
operators' consoles, so the bar is higher than CI alone.

---

## D-0005 — One module owns SQLite, and the driver is `node:sqlite`

**Status:** accepted (2026-09-05, rondo#1)

**Decision.** `src/store/sqlite.ts` is the only module in the repository allowed to name a SQLite
driver. `test/architecture/import-boundaries.test.ts` asserts that the set of modules importing one
is *exactly* `{src/store/sqlite.ts}` — equality, not containment — and grants the driver's bindings
per module rather than per layer, so a second file in `src/store/` cannot open its own connection
either. The driver is `node:sqlite`.

**Why an owner at all.** The store is the one part of rondo whose replacement is foreseeable — the
schema is undecided, and `cadenza C-16` and continuo's control plane both have opinions about
durable state that rondo has not yet had to reconcile. A single owning module is what makes that
replacement a diff in one file rather than an archaeology exercise, and it is only true if
something enforces it from the first commit, before there is anything to migrate.

**Why `node:sqlite` rather than `better-sqlite3`.** It is in the standard library of both Node
versions rondo supports, so the boundary costs no dependency, no lockfile entry, and no prebuilt
binary on the Windows cell. The cost, which is real: Node still marks it experimental. That is
acceptable *because* of the boundary this entry draws — swapping the driver touches one file, and
the test that would catch a second owner is the same test that makes the swap safe.

The `SQLITE_DRIVERS` set in the boundary test names the native and WASM packages too, not only the
one in use, because the claim is about the database rather than about a library: changing drivers
must not be a way to acquire a second owner.

**What would falsify it.** `node:sqlite` proving inadequate — a missing feature, or an
experimental-API break across 22 and 24 — in which case the driver changes and the ownership does
not. Or a design in which rondo does not own durable state at all, which would be a much larger
decision than this one.

---

## D-0006 — The import boundary is a test that parses the tree, not a lint rule

**Status:** accepted (2026-09-05, rondo#1)

**Decision.** The dependency direction of `src/` is enforced by
`test/architecture/import-boundaries.test.ts`, which reads each module's text and asks a TypeScript
parser what it imports. It is stated as **allowlists** — what each layer may import, and what each
module may import from outside the package — and it is guarded against passing vacuously in three
independent ways.

**Why a test rather than a lint rule.** Three properties, none of which a lint rule gives:

1. **It runs in the gate the same way everything else does**, with the same failure output, and it
   cannot be disabled by a config key or an inline suppression comment. A boundary that a
   `// biome-ignore` can cross is not a boundary.
2. **It can assert about the tree as a whole**, not file by file. "Exactly one module imports a
   SQLite driver" and "every module under `src/` is classified" are claims about the set of
   modules; a per-file rule cannot state either.
3. **Its own detector is testable.** `PLANTED` is a corpus of hand-written violating modules
   attributed to paths that do not exist on disk, each of which the detector must catch, beside
   clean controls it must not flag. That is what makes the check itself falsifiable rather than
   trusted.

**Why parsed, never imported.** An import inside a function body, in type position, through a
re-export, via `require`, via `import x = require()`, in an `import("...")` type node, or in a
triple-slash directive is still an import for the purpose of a boundary. Importing the tree would
see none of them — and would also run it.

**Why an allowlist over imports is not sufficient on its own.**
`process.getBuiltinModule("node:http")` takes a module without importing anything, because
`process` is a global — so an allowlist consulted only on imports would never be consulted at all,
and the loop's "empty allowance" would have been empty in the wrong sense. The sweep therefore also
reads calls that return a module (`require`, `getBuiltinModule`, `createRequire`, matched on the
callee's *last name segment* so a member expression does not evade it) and calls that turn text
into code (`eval`, the `Function` constructor), and runs both through the same allowance -- and
refuses a bare *read* of those names, because `const load = process.getBuiltinModule` moves the
call out of reach of any check on callees. The read check runs in **value position only**, which is
what lets `Function` be refused as `const compile = Function` and allowed as `let handler:
Function`: a type annotation names something without reaching it, and the walk carries a
type-position flag so that the same identifier can have opposite answers. A member name that is computed rather than written
(`process["get" + "BuiltinModule"]`) is refused for the same reason: whether it named a capability
is exactly the question, so the answer is no.

**And `src/` is TypeScript, enforced.** The walk finds `.js`, `.mjs` and `.cjs` modules there in
order to refuse them. Two things are wrong with one: `allowJs` is off, so nothing type-checks it;
and a JSDoc `@type {import("node:http").Server}` in it is a real dependency hanging off a node the
tree walk does not traverse. Teaching the sweep to read JSDoc would close the second; refusing the
file closes both, and whatever the next JavaScript-only affordance turns out to be. Nothing is
lost, because the tree has no such module and no reason to grow one.

**Some capabilities are not modules.** `fetch("https://...")` is HTTP, needs no import, and is not
a module reference, so the allowlist has nothing to consult about it. Enforcing "the loop must not
import HTTP" against `import` alone would enforce the letter of the rule and miss the likeliest way
a loop would really make a request, so a small closed set of ambient names -- `fetch`, `WebSocket`,
`EventSource`, `XMLHttpRequest`, `navigator` -- is refused across all of `src/`. This one is an
enumeration rather than an allowlist, which is a weakness and is recorded as one: there is no
"everything ambient" to invert. An access point that needs `fetch` gets an explicit exception, and
adding it is a decision.

**What this check does not claim, stated because five review rounds went looking for it.** It is a
sweep over syntax, so its guarantee is over what a module *says*. One residual is known and left
open on purpose: a capability reached through an identifier-keyed index --
`const k = "getBuiltinModule"; const load = process[k]` -- cannot be seen here, because deciding
what `k` holds is scope analysis. Refusing every computed index instead would refuse every array
subscript in the tree, which is the worse trade. The line drawn is between a member name that is
*indexed* (`row[key]`, allowed) and one that is *assembled* (`process["get" + "X"]`, refused). The
result stops mistakes and records intent; it does not stop an author set on getting around it, and
no syntax sweep does. The second residual is the ambient one above: a capability that reaches the
world without naming a module and is not in the enumerated set is invisible here.

**Why allowlists.** A denylist answers "no" only for what it was told about. `src/refrain/`'s
external allowance is empty, which refuses `node:http`, a browser driver, an agent SDK, continuo's
internals, and the next thing nobody has thought of, in one line. The same shape closes the routes
that would otherwise need enumerating one at a time: a namespace import, a default import, a
side-effect import, a `require`, a dynamic `import()` and a computed specifier all reduce to a
sentinel that cannot appear in an allowlist, so all six fail closed rather than being named.

**The vacuity problem, and the three answers.** The per-module cases are generated from a directory
walk, and a walk that found nothing would generate nothing — and a suite of zero assertions is
green. So: the walk has its own case with a floor (`EXPECTED_MODULES`); every discovered module
must be classified or explicitly named unlayered; and `PLANTED` exercises the detector in both
directions. Beyond the file, CI's `boundary-is-not-vacuous` job writes a *real* violating module to
`src/refrain/` and requires the suite to go **red** — the one check that can catch a mistake in the
anti-vacuity machinery itself. Measured on this commit, that planted module produces:

```
src/refrain/planted-violation.ts imports the external module node:http, which it is not granted.
src/refrain/planted-violation.ts imports ../access/local.js (-> src/access/local.js), which is outside its allowance [src/refrain, src/store].
```

**What would falsify it.** A lint rule acquiring set-level assertions and un-suppressibility, or
the sweep's runtime becoming significant — it currently spawns one compiler child process for the
whole file and finishes in under 300 ms.

---

## D-0007 — Install from the lockfile, with `--ignore-scripts`

**Status:** accepted (2026-09-05, rondo#1)

**Decision.** Every CI job installs with `npm ci --ignore-scripts`. `package-lock.json` is
committed and is the pinned build input. `.npmrc` sets `save-exact=true`.

**Why `npm ci`.** It fails when `package.json` and `package-lock.json` disagree, so a dependency
cannot drift into a run without appearing in a diff. `npm install` resolves afresh and can quietly
choose differently on two machines. There is also a local reason, recorded because it costs an hour
to rediscover: on npm 10.9.2 a fresh `npm install` in this repository fails outright with
`Cannot read properties of null (reading 'edgesOut')` — an arborist crash resolving vitest's peer
set. `npm ci` reifies from the lockfile and never takes that path.

**Why `--ignore-scripts`, as a standing rule.** It is not a reaction to a particular package. It is
the property that upstream code does not execute merely because something was installed. rondo's
current dependency set needs no install scripts at all, which is the cheapest time to adopt the
rule.

**What the rule does not cover, and this is the interesting part.** Measured for D-0001:
`--ignore-scripts` does **not** suppress a *git dependency's* `prepare` on npm 10.9.2 — the
upstream build ran and produced `dist/` under the flag. So the flag's guarantee holds for registry
dependencies and is void for git ones. That is one of the reasons D-0001 declines a git dependency
on continuo, and it is recorded here because someone reading only this entry would otherwise
believe the guarantee is total.

**What would falsify it.** npm changing either behaviour, or a dependency that genuinely cannot
work without an install script — at which point the exception is named in this file rather than
taken by dropping the flag.

---

## D-0008 — Biome, knip, and what `npm run verify` means

**Status:** accepted (2026-09-05, rondo#1)

**Decision.** Biome is the linter *and* the formatter, run as one command (`biome check`), so a
formatting difference is a red gate rather than a warning. knip runs over the same tree and fails
on unused exports and unused dependencies. `npm run verify` is exactly
`lint && knip && typecheck && test`, and it is the whole of local verification.

**Why one tool for lint and format.** Two tools means a file can satisfy each of them and neither
of their intersections, and it means two configurations that can disagree about line width. Biome
does both from one config at one speed.

**Why knip on a repository this small.** Precisely because it is small. rondo's `src/` is six
modules whose only consumer is a barrel, so an export that stops being reachable is invisible by
inspection and obvious to knip. The check costs nothing now and becomes hard to adopt later, once
there is a backlog of dead exports to triage.

**Why `verify` is one script.** So that "did you check?" has one answer. Splitting it invites a
contributor to run the fast half.

**What would falsify it.** A suite slow enough that a single `verify` is no longer something a
contributor runs before every commit, at which point the split is a decision to take deliberately
rather than by drift.

---

## D-0009 — The conductor carries a human's answer and never composes one (cadenza `C-4`)

**Status:** accepted (2026-09-05, rondo's human gate)

### The gate this entry opens

`cadenza C-17` put the conductor in this repository (`cadenza D-0029`), and section 11 of cadenza's
`docs/design/conductor.md` assigns **eight** of its seventeen rows to rondo's gate: `cadenza C-4`,
`cadenza C-5`, `cadenza C-6`, `cadenza C-7`, `cadenza C-8`, `cadenza C-13`, `cadenza C-14` and
`cadenza C-15`. Two of them are already taken here — `cadenza C-8` (how rondo consumes continuo) and
`cadenza C-14` (how a run pins and records the continuo revision it drove) are **D-0001**, and are
not restated. The remaining six are taken at this gate on 2026-09-05, each as
its own entry so that each row stays separately citable:

| Row | rondo entry |
|---|---|
| `cadenza C-4` | D-0009 |
| `cadenza C-5` | D-0010 |
| `cadenza C-6` | D-0011 |
| `cadenza C-7` | D-0012 |
| `cadenza C-13` | D-0013 |
| `cadenza C-15` | D-0014 |

Every one of the six is **the recommendation cadenza's row states, taken as written**. cadenza's
document is propose-only and takes none of them; what is new here is the taking, and the reasons
below are rondo's reading of the evidence rather than a copy of the row's.

Two naming conventions for the six entries. **The operating surface** is what cadenza's document
calls the "#22 surface": the **human-facing** access point rondo's `src/access/` reserves and does
not yet contain — the web UI a person types into. It is deliberately *not* every access point.
`README.md` also reserves a localhost MCP surface, and that one is spoken to by agent sessions; an
obligation this file places on "the operating surface" is placed on the human-facing half only, and
routing it through the MCP surface would defeat the property each such obligation exists to hold.
**The continuo-invocation adapter** is the module that will hold D-0001's CLI process boundary; it
does not exist yet either. Both are named here as owners of obligations, which is what makes these
decisions checkable once the modules are written.

With the six below, **no row of section 11 is open anywhere**: seven were taken at cadenza's gate,
`cadenza C-11` was settled at continuo's as `continuo D-0076`, `cadenza C-9` is retired unreached,
and the eight that came here are D-0001 and the six below.

**A clear section-11 gate is not the same as a current ledger, and this entry does not claim it
is.** Two of D-0001's own stated falsifiers have since fired, both on 2026-09-05 and both at a
sibling's gate:

- **cadenza acquired an entry point** (`cadenza D-0033`: an `exports` map, an emitted `dist/`, a
  build). D-0001 says in its own words that this is a **new entry** rather than an edit to that one.
- **continuo grew the machine-readable surface D-0001 was waiting for** (`continuo D-0090`: a
  `--version` carrying the build's git revision, and `--json` on the verbs a host drives). D-0001
  names exactly this as the event at which its two worst costs are gone and the entry "should be
  re-argued on its merits".

Neither re-argument is in this change. Both are decisions for rondo's gate, named here rather than
taken here — and until they are taken, D-0001's prose, and the parts of `README.md` and `AGENTS.md`
that summarise it, describe measurements that have been overtaken.

**Where a row's stated reason has expired, this file says so.** cadenza's rows were written against
continuo as it stood when the document was drafted, and continuo took several entries at its own
gate on the same day. Three of the six entries below therefore record a correction to the row's
*reason* while taking the row's *outcome* as written — D-0010, D-0012 and D-0014. A row whose reason
has moved and whose outcome has not is worth more as a corrected entry than as a copy.

### Decision

**rondo may carry a human's answer verbatim; it may never compose one.** Three parts:

1. **`gate answer` is invoked by the operating surface, not by the conductor.** The body that
   reaches continuo is the one a person typed into that surface, and the surface is what invokes the
   verb.
2. **A widening successor contract is issued only on an answer that surface recorded**, with that
   surface as the contract's issuer. rondo does not adopt a widening because its own classification
   said `needs_approval` and the answer seemed obvious.
3. **No approximation counts as carrying.** Summarising, normalising or reformatting a human's
   answer into the gate body is composing it. Presenting options and carrying the option a person
   selected is not.

### Why the rule has to be structural rather than a promise

Neither side of the seam can *prove* who answered, so nothing downstream can tell a carried answer
from a composed one. Note that this is about authentication and not about the presence of a field:
`gate answer --actor-id` is required and the id is persisted on the transition — an actor is
recorded, and it is recorded on the word of whoever invoked the verb:

- **continuo derives the actor kind from the verb.** The `presented -> answered` edge admits actor
  kind `human` and no other, so an agent that invokes `gate answer --body ...` has its own prose
  recorded as the human's approval, and continuo has no way to detect it. This is continuo's own
  stated reason for the rule, not an inference drawn about it from outside.
- **cadenza's `adopt()` does not refuse widening.** It checks lineage, grantee and project;
  `issuer` is an opaque identity string with no actor kind. cadenza states in its own words that
  whether the issuer held what it granted is the control plane's to establish — and rondo *is* that
  control plane, so the check has no other home.

Both halves therefore land on the same place: provenance can only be a property of the surface that
took the keystroke. Putting the verb there makes it one; leaving the verb with the conductor leaves
it a promise in prose that no test can hold.

**What this costs rondo.** The conductor cannot close its own loop. It must present a question and
then wait for a surface it does not control to act, which means the operating surface is on the
critical path of every gate — it is not an optional front end that can be deferred behind a CLI.
That is the price of the property, and it is taken deliberately.

### What would falsify it

- **continuo records an *authenticated* answerer.** Note what does not count, because it already
  exists: `gate answer --actor-id` is required and the actor id is recorded on the transition
  (`src/gate/cli.ts`, `src/gate/operator.ts`, continuo commit
  `13c7b1a19cdb5b8343190573fba75e41fa61821a`). continuo describes it in its own help as an identity
  and not an authority, and an agent may pass any string it likes — so the identity field is not the
  missing property and its existence does not falsify this entry. What would is a seam that can tell
  a claimed answerer from a proven one; then the rule can be enforced where the write happens rather
  than by placement, which is a better mechanism than this entry's.
- **cadenza's `adopt()` gains an issuer-authority check *and* rondo consumes cadenza.** The check
  alone changes nothing here: D-0001 records that rondo imports no cadenza code at all, so an
  upstream guarantee is not on rondo's path until that entry is superseded. Both halves together
  move part 2 into the library; either half alone leaves it here.
- The operating surface turning out not to be a place a person types into — if it becomes an
  automated relay, "the surface recorded it" stops meaning "a person answered" and this entry is
  reasoning about the wrong boundary.

---

## D-0010 — No mechanical step 11 in lap 1: rondo holds no push credentials and stops at the closed gate (cadenza `C-5`)

**Status:** accepted (2026-09-05, rondo's human gate)

### Decision

**For lap 1 rondo does not perform step 11 — push, PR, merge, run close — after an approval, and
holds no credential that would let it publish a run's work.** All four legs are the operator's, and
that includes the close: `continuo run close` records the operator's own observation of a merge
(`continuo D-0084`), so it is a leg of the manual publish rather than a way around it. The approval
stays human, and the conductor's honest end state for an iteration is: the gate closed, the verify
verdict reported, the publish left to the operator, and a report to the human saying exactly that.
Acquiring a publishing credential is a supersession of this entry, not an implementation detail
under it.

`continuo D-0077` is the sibling entry: it records the privileged publisher as **lap 2's deferred
work rather than a missing piece of lap 1**, and gives lap 1's answer as "the operator is the
publisher, runs push / PR / merge with their own credentials". This entry is that same division of
labour seen from the consumer's side, and it does not ask continuo for anything.

### Why

The load-bearing fact is not a preference about automation. It is that **nothing in continuo
pushes, opens a PR, merges one, or makes a GitHub call of any kind** — measured at continuo commit
`13c7b1a19cdb5b8343190573fba75e41fa61821a` on 2026-09-05, because it is a fact about a moving tree
and not a property of the design. So there is no mechanism for rondo to drive even if it wanted one.
Stated precisely, because the loose version is wrong and easy to repeat: continuo **does** run
`git`. `src/workspace/git.ts` is a git process adapter, materialising a workspace is what uses it,
and `runGit` / `runGitChecked` are exported from the barrel. What is absent is a *remote*: nothing
there pushes, fetches from a forge, or speaks to GitHub.

And `continuo D-0077` explains why the missing piece is deferred rather than overlooked: the
publisher's substantive question is its permission posture — it may push, the worker may not — and
that is a threat-model question continuo declines to answer before a lap has actually run. Building
a publisher on rondo's side ahead of that answer would be rondo taking the decision continuo
deferred, in a repository with a fresh ledger and no lap behind it.

**One leg of cadenza's stated reason has since expired, and the row's outcome does not depend on
it.** `cadenza C-5`'s reason says continuo "has no verb that moves `run.status`". That was true
when the row was written and is no longer: `continuo D-0084` adds `run close`, taken at continuo's gate on the
same day as this entry. It changes nothing here, and if anything it points the same way — the verb
is explicitly *the operator's* close, records the operator's own observation of a merge, and reaches
no git and no GitHub. The recommendation stands on `continuo D-0077` and on the absent remote-publishing
surface, and both are untouched.

### What would falsify it

- **continuo grows a privileged publisher** (`continuo D-0077`'s own end state). Then whether rondo
  drives it is a live decision with a mechanism under it, and this entry is superseded rather than
  amended.
- **A lap runs and produces the threat-model evidence `continuo D-0077` is waiting for**, and the
  posture that comes out of it puts the credential on the host rather than on a continuo component.
- rondo acquiring a credential that lets a conductor iteration publish its own work, by whatever
  route it arrives, because the property this entry protects is "the conductor cannot publish", not
  "the conductor chooses not to". This is about the publish path; it says nothing about credentials
  rondo's own release or CI machinery might need, which are a different question and not this
  entry's.

---

## D-0011 — The `run admit --cli-arg` allowlist starts empty, and four flags are permanently refused (cadenza `C-6`)

**Status:** accepted (2026-09-05, rondo's human gate)

### Decision

1. **rondo's `--cli-arg` allowlist starts empty**, and the conductor admits runs with **no
   `--cli-arg` at all**.
2. **A first entry is its own decision at this gate**, recorded in this file, naming the argument
   vector and the reason it is needed. It is not a configuration value an operator may set and not
   a default the code may carry.
3. **Four options are permanently refused: `--dangerously-skip-permissions`, `--allowedTools`,
   `--disallowedTools` and `--add-dir`.** The refusal is over the **option**, not over a spelling.
   Every form the executor's parser accepts for one of the four is the same refusal — camelCase and
   kebab-case alike (`--allowedTools` and `--allowed-tools` are one option to that parser, as are
   `--disallowedTools` and `--disallowed-tools`; measured and recorded on continuo's side),
   attached-value forms (`--add-dir=...`), and any abbreviation the parser resolves to one of them.
   This matters because `continuo D-0088` matches whole vectors byte-for-byte, so a respelling is a
   different byte sequence and would otherwise read as a different flag. No entry may authorise any
   form of the four, and this part is not open to being unblocked by a later entry — reversing it
   supersedes this one.

### Why an empty start rather than a curated one

Because a `--cli-arg` is the one documented path by which an admitted run can be handed authority
the human gate never saw. `cadenza C-6`'s reason names the gap: continuo's `FENCE_OWNED_FLAGS` — the
flags the fence generates and refuses a duplicate of — does not cover these four, so passing them
through a documented verb can make the human gate advisory rather than binding.

This aligns with, and is a consumer-side restatement of, **`continuo D-0088`**, which makes the
`cli_args` check an **allowlist** rather than a denylist and requires an entry to be a *complete*
argument vector with a non-empty `reason`. Two of its properties matter to rondo and are the reason
part 2 is shaped the way it is:

- **A zero-length `cli_args` is authorised unconditionally**, by rule rather than by an entry. So
  rondo's "admit with none" needs nothing from continuo's document and cannot be broken by an edit
  to it.
- **No role ships with an authorising entry.** Measured on continuo at commit
  `13c7b1a19cdb5b8343190573fba75e41fa61821a` (2026-09-05): `src/fencing/cli_args_allow.json` is
  `{"entries": []}`, and the roster it is keyed against holds exactly `worker`, `curator`,
  `dispatcher`, `secretary` (`src/fencing/roles.json`). So an empty rondo-side allowlist is not
  merely rondo's caution — today it is the *only* thing continuo would accept, and this entry keeps
  the two ledgers agreeing rather than depending on that.

Part 3 is stricter than `continuo D-0088`, deliberately. `continuo D-0088` would permit any of the
four if somebody wrote down a reason; rondo refuses to be the somebody. `--allowedTools` in
particular is the one argument continuo's own dogfood ever needed, and it was needed as a workaround
for a defect continuo has since closed — which is the shape of the argument for authorising it and
also the reason not to: the need was a symptom, and the fix belonged elsewhere.

**A rondo entry is necessary and not sufficient, and part 2 should not be read as a licence.** The
authorising record `continuo D-0088` enforces lives in *continuo's* tree, pinned by byte count and
SHA-256, and an admitted vector must equal an entry there exactly. So a future rondo entry
authorising a vector is a statement of intent whose other half is continuo's gate; and for the flags
on `continuo D-0088`'s corpus, that half additionally requires the entry's `reason` to name the flag
it authorises. Part 3 means rondo will not be asking for that half for four of them.

### What would falsify it

- **A run rondo must admit that cannot be expressed without one of the four refused flags.** That is
  the case this entry claims does not exist; if it appears, the right response is an escalation to
  continuo about the fence rather than an entry here, and this entry is what forces that route.
- **`FENCE_OWNED_FLAGS` growing to cover the four**, at which point the gap that makes part 3
  permanent is closed at the seam and the refusal is redundant rather than load-bearing.
- **`continuo D-0088` being superseded** in a way that changes what an admitted vector means — for
  instance if fragments rather than whole vectors became matchable, since part 2's "name the vector"
  presumes exact whole-vector matching.

---

## D-0012 — Single-flight in lap 1, and what parallel admission actually waits on (cadenza `C-7`)

**Status:** accepted (2026-09-05, rondo's human gate)

### Decision

**rondo is single-flight for lap 1: one admitted run in progress at a time, one provider instance
per run.** Parallel admission is not attempted, and it waits — as `cadenza C-7` puts it — on
**either continuo's post-lap concurrency entry or a rondo-side capacity ledger designed on its own
evidence** and recorded in this file. That disjunction is the row's, taken as written; this entry
does not make either branch mandatory.

**What this entry adds is not a third prerequisite but a warning about both branches**, because two
facts sit under them:

- **The identifier allocator.** The row's own reason already names it: the verbs refuse on
  existence, so a retry needs an allocator nothing provides. It is a condition on either branch.
- **continuo's global lap lease**, which the row did not have in front of it. `lap perform` acquires
  the single global `outbox-delivery` resource, so concurrent laps are refused `LeaseHeld` whatever
  rondo builds. A rondo-side ledger therefore cannot deliver parallelism *by itself*: on that branch
  a continuo change is still needed. Whether that makes the ledger branch worth taking is a question
  for whoever takes it; this entry only records that the branch is not self-sufficient.

Neither point changes the row's answer for lap 1, which is single-flight either way. "Evidence" means measurements from laps that actually ran here — not a
transcription of an existing scheduler's accounting, which has no continuo counterpart.

### Why staying single-flight is the answer rather than a deferral of one

`cadenza C-7`'s reason is that continuo's documented concurrency residual is **unreachable at zero
cost** while there is one provider instance per run, and continuo bands the residual post-lap for
that reason. So single-flight is not a workaround for an unsolved race; it is the condition under
which the race does not exist, and the cheapest way to hold a property is to stay inside the
condition that gives it away for free.

The second reason is the one that decides how long the wait is. **continuo's verbs refuse on
existence** — a run id, a topic branch and a workspace are each taken once — so a second lap that
can actually be *performed* needs a fresh (run id, topic branch, workspace) triple, and **nothing
allocates one**. Stated at the right verb: `admitRun` refuses only a duplicate run id, and two runs
naming the same branch and workspace are both admitted; the collision is refused later, when the
workspace is materialised. So the constraint is not "a second admission is impossible" — it is that
a second admission with the tuple reused cannot be run, which is worse, because it is discovered
after the record exists.

*One member of cadenza's list has since dropped out, and the argument does not need it.* The row
counts the endpoint dropbox destination among the things that must move together;
`continuo D-0085` decided on 2026-09-05 that the dropbox directory is **created if absent and reused
if present**, which is the `KeyedDropbox`'s own rule. So the dropbox is not an identifier a
concurrent lap has to allocate. The other three are, and three is as blocking as four. A capacity
ledger without that allocator would schedule work that cannot be performed. The allocator is
therefore the prerequisite, and it is rondo's to design or continuo's to grow; either way it is a
decision with measurements under it rather than a switch to flip.

**A lease is not a capacity ledger**, and the distinction is why rondo cannot borrow continuo's
existing machinery for this: a lease answers "who is writing", not "how many may run".

**The third reason, which outranks both: continuo does not permit concurrent laps at all.**
`continuo D-0074` records that `lap perform` acquires the `outbox-delivery` lease — **one global
resource** (`continuo D-0053` rule 4) — before a worktree, a fence or a child exists, so **a second
concurrent lap against one control plane is refused `LeaseHeld`**. That refusal is upstream of
everything above: fresh identifiers do not lift it and a rondo-side capacity ledger cannot schedule
around it. So the honest statement of what parallel admission waits on is not one thing but a
choice between: a continuo entry that reconsiders the serialisation — `continuo D-0074` names the
two changes that would reopen it, a scope column on `outbox` **or** a strict recipient predicate on
both the due and the recovery passes, either of which would let more than one delivery resource
exist, "and then the holder identity, and with it the serialisation, would have to be
reconsidered" — or a topology with more than one control plane, which is a decision nobody has
taken. Note that neither change *is* the lifting: they are what makes it a live question again. Until one of those,
a rondo capacity ledger could only queue admissions in front of an execution that is serialised
anyway — which is a scheduler for a queue of one, and this entry declines to build it.

### What this makes dormant, recorded so it is not mistaken for working

With one lap per request, a **no-progress halt keyed on repeated failure signatures cannot fire** —
no signature can repeat — and a review-round budget has no second round to spend. Both are
specified in cadenza's design and neither is live here. They become live when the allocator does.
Anything rondo writes for them in lap 1 is untested by construction, and this entry is where a
reader finds out why.

### What would falsify it

- **continuo publishing a post-lap concurrency entry**, which is the expected end.
- **continuo's lap-level serialisation actually going away.** Note what is *not* enough: either of
  the two changes `continuo D-0074` names lets more than one delivery resource exist and thereby
  makes the holder identity and the serialisation a live question again — the lap may still take a
  single global lease until a further entry changes it. So the warning above stops applying only
  when that further change lands, and it is that, not the enabling change, that reopens this
  entry.
- **An identifier allocator existing** for the (run id, topic branch, workspace) triple, from
  either side.
- **Measured throughput making single-flight the binding constraint** on real work — the evidence
  the future ledger would be designed on, arriving.
- The one-provider-instance-per-run premise ceasing to hold inside continuo, which would make the
  residual reachable *without* rondo admitting anything in parallel, and would move the question to
  continuo's gate entirely.

---

## D-0013 — An aborted iteration's open gate is closed `withdrawn` by the operating surface, not by the conductor (cadenza `C-13`)

**Status:** accepted (2026-09-05, rondo's human gate)

### Decision

When an iteration aborts **after a gate has been opened** and before a human has answered — a
failed verify, a blocking review — **that gate is terminated as `gate close --outcome withdrawn`,
and the verb is invoked by the operating surface, not by the conductor.** The conductor's part is to
**ask for the close and report why**: it names the gate, states that the iteration ended without an
answer, and gives the reason. It does not write the outcome itself, and it does not drop the gate
without asking.

Both the conductor and the operating surface are rondo's own modules. The line this entry draws is
*inside* rondo, between the loop and the human-facing access point — it is not a line between rondo
and something else, and reading it as "rondo does not close gates" would misplace it.

**Two cases are outside this entry and are named so the scope is not guessed at.** An execution
failure on an `isError` turn opens **no gate at all** — continuo refuses the terminal report and the
lap call throws — so there is nothing to terminate and the conductor reports the failure on its own
path. And a gate whose *subject run* has been closed to a terminal status is terminated by
continuo's own reconciliation as `subject_gone` rather than by anyone's `gate close`
(`continuo D-0084` records that `sweepSubjectGone` closes every open gate whose subject run reached
a terminal status, and that `gate reconcile` is what runs it). Those two paths do not compete: the
`subject_gone` route requires `continuo run close`, which D-0010 leaves with the operator, so **both
routes end at a person and neither is the conductor's to take**. If the operator closes the run,
the ask this entry describes is satisfied by reconciliation and the conductor reports that instead.

### Why the outcome is `withdrawn`, and why the invoker is not the conductor

Two separate facts, and both are needed:

- **`withdrawn` is the only outcome a hand may write here.** An un-presented gate sits at the
  `received` stage, and of the three outcomes an operator's `gate close` may write, `withdrawn` is
  the only one admitted from that stage. The stage does admit outcomes continuo writes for itself —
  `subject_gone` and `superseded` — but those are not a caller's to choose, which is why they are
  not alternatives to this decision. It is also explicitly *not* an approval,
  which is exactly the property an abort wants: the request ends without anything having been
  approved.
- **The invoker is the operating surface for D-0009's reason, one verb along.** `closeOpenGate`
  hard-codes
  `actorKind: "human"` — verified by reading the function in continuo's `src/gate/operator.ts` at
  commit `13c7b1a19cdb5b8343190573fba75e41fa61821a`, rather than by the line number cadenza's row
  cites, which has already drifted. So a conductor-issued close records an agent's action as a
  person's, in precisely the way a conductor-composed answer body would. The rule that keeps
  D-0009 true keeps this true, and splitting them would leave the same hole open under a different
  verb.

**Why the gate must be terminated at all**, rather than left for a retry: it cannot be retried.
`lap perform` cannot be re-entered on an admitted run, and the next attempt is a *new* run needing
the identifier triple D-0012 records nothing allocates. Absent one of the two terminations above, a
gate stays open indefinitely, attached to a request that can never be resumed.

**What "asks for the close" means concretely, and what it does not achieve.** continuo has no relay
for this ask. Its gate relays are the two a gate already has — the `presented` question and the
`forwarded` answer, both addressed to `external-notify` and read by the operator out of a dropbox
directory (`continuo D-0076`) — and neither carries a request to withdraw. So the ask travels
rondo's own path: a report the conductor puts in front of the operator through the operating
surface. It is a report, not a verb, and it can go unanswered. **A gate whose close has been asked
for is not thereby closed**, and this entry does not pretend otherwise; what it fixes is who may
write the outcome, not that the outcome is guaranteed to be written.

### What would falsify it

- **continuo admitting a non-human actor kind on the close** — an explicit actor argument, or a
  distinct verb for an automated withdrawal. Then rondo may invoke it, and the entry is superseded.
- **A new outcome writable from `received`** that carries a meaning an abort wants more precisely
  than `withdrawn` does.
- **Reconciliation covering the aborted-iteration case without an operator's act** — that is, a
  path that reaches a terminal run status with no human verb in front of it. Today the
  `subject_gone` route runs through `continuo run close`, which is the operator's; if that stops
  being true, this entry's ask becomes redundant rather than merely unanswered.
- D-0009 being superseded — this entry inherits its reason, so it does not outlive it.

---

## D-0014 — The agent type's role name is mapped in the continuo-invocation adapter, which refuses an unmapped name before admission (cadenza `C-15`)

**Status:** accepted (2026-09-05, rondo's human gate)

### Decision

**The agent-type record carries an executor-neutral role name of cadenza's own, and rondo's
continuo-invocation adapter maps that name onto the executor's role roster and refuses an unmapped
one before admission.** Three consequences:

1. **The mapping lives in the adapter and nowhere else.** No layer above it — nothing that would sit
   in a `domain`-shaped position — holds a roster or a role string of continuo's.
2. **The refusal happens before `run admit` is invoked**, not after, and not by continuo.
3. **A second executor with a different roster changes the adapter and nothing above it.**

### The row's stated reason has expired, and the row's outcome survives it

`cadenza C-15`'s reason is that `run admit --role` is *required but unvalidated* — that a wrong role
is accepted, persisted, and paid for only when `lap perform` renders the fence, after the branch and
the worktree exist. **That is no longer true**, and this entry is taken with the correction rather
than on the stale fact. Measured on continuo at commit
`13c7b1a19cdb5b8343190573fba75e41fa61821a` (2026-09-05): `admitRun` reads the roster through
`roleNames()` and raises `UnknownRoleRefused` **before the transaction opens**
(`src/control_plane/run_admission.ts`), and the code says in its own comments that this is exactly
the late-failure defect being closed. `continuo D-0088` places its own `cli_args` check beside that
roster check, which is the same fact from the other side.

So the argument that "the adapter is the only place the mistake costs nothing" is gone: a bad role
now costs a refused admission and nothing else. What survives is the part the correction does not
touch, and it is enough to take the row as written:

- **The mapping has to exist somewhere.** The agent type carries cadenza's own executor-neutral role
  name; continuo's roster is a different vocabulary. Something must translate.
- **Only the adapter may hold the executor's vocabulary.** That is the placement half of the row,
  and it is a boundary question rather than a cost question — see below.
- **Refusing before admission keeps rondo's own failure local.** An *unmapped* name is rondo's own
  vocabulary error, and reporting it as "this agent type names a role rondo cannot map" is a better
  answer than relaying continuo's refusal of a string rondo composed.

**And one thing this entry does not buy, said plainly.** continuo's admission check is
`roster.includes(role)` — membership, and nothing else. So a mapping that produces the *wrong but
valid* role is admitted, and the run is fenced under a role nobody chose; the roles are not
interchangeable, and their fences differ materially. Neither continuo's check nor this entry's
refusal detects that case. What this entry closes is the unmapped name; **mis-mapping onto a real
role is undetected at both ends**, and whatever eventually catches it — a test over the mapping
table, a fence assertion — is not decided here.

The roster this maps onto is continuo's bundled role document, which holds exactly `worker`,
`curator`, `dispatcher`, `secretary` (`src/fencing/roles.json`, same commit). That list is recorded
here as a **measurement**, not adopted as a constant and not a licence: **how the adapter obtains
the roster is deliberately not fixed by this entry**, because every candidate route touches D-0001.
Reading continuo's tree directly would be a second consumption seam beside the CLI process boundary
D-0001 chose, and holding a copy is a duplicate that can drift. Choosing between them is a decision
with D-0001 in front of it, and it is not this one. What this entry fixes is that the *mapping* and
the refusal of an unmapped name live in the adapter, and that the refusal comes before admission.

**Why this does not belong above the adapter.** cadenza's design puts the role in `executorPolicy`,
which is interpreted in exactly one place — the invocation adapter — and never read by cadenza's
classification. Putting the roster higher would name an executor in a layer that is not allowed to,
which is the same boundary rondo's own `test/architecture/import-boundaries.test.ts` enforces for
imports (D-0006). This entry is that rule applied to a *value* rather than to a module reference,
and it is worth stating because no test catches it: a role string is data, and the boundary suite
sees modules.

### What would falsify it

- **The roster becoming a runtime input rather than a document bundled with the executor**, so that
  no artefact the adapter can consult answers "which roles are valid for this run" before
  admission. Then "refuse before admission" stops being available and the entry is superseded.
- **A mis-mapping onto a valid role actually happening**, since the paragraph above records that
  neither end detects it. One occurrence turns "the adapter refuses unmapped names" into too narrow
  a guarantee to be the whole of the decision, and the entry is then reopened to say what catches
  the other case.
- **A second executor arriving that cannot be absorbed inside the adapter** — the entry claims a
  different roster changes the adapter and nothing above it, so what falsifies it is an executor
  whose role model forces a change above or outside the adapter, not the arrival itself.
- **cadenza moving the role out of `executorPolicy`**, which would move the mapping's home with it.

---

## D-0015 — continuo's machine-readable seam, re-argued on its merits: the CLI boundary stands, `--json` is a wire protocol rather than types, and provenance becomes a verification duty

**Status:** accepted (2026-09-05, rondo's human gate)

D-0001 named this moment as one of its own falsifiers: *"continuo grows a machine-readable surface —
`--json` on the driven subcommands and a `--version` that moves — at which point (c)'s two worst
costs are gone and the entry should be re-argued on its merits rather than superseded by default."*
`continuo D-0090` fired it. This entry is that re-argument, run against fresh measurements rather
than against D-0001's.

**D-0001 stays accepted and keeps its ID.** Its outcome is unchanged and so is the reason for it;
what changed is the price, and the price moved in the direction D-0001 predicted rather than in a
direction that reverses it. Two of its clauses acquire corrected reasoning here — its "no types
across the seam" cost and its item 4 provenance requirement — and neither correction changes what
rondo does. cadenza's half of the same falsifier list is D-0016, a new decision rather than a
correction to an old one.

### Decision

1. **The CLI process boundary stands.** rondo still takes no npm dependency on continuo, and still
   drives a checkout pinned by commit sha, built once, invoked as `node <checkout>/dist/cli.js`.
   D-0001 items 1 and 2 are re-affirmed on merits.
2. **`--json` is consumed as a versioned wire protocol, and rondo owns the decoders.** Nothing
   typed crosses the process boundary. rondo validates each document at runtime — the `schema`
   discriminator first, then `ok`, then the payload — and converts a validated document into
   rondo's own record types. A document whose `schema` rondo does not recognise is a refusal to
   proceed, not a value to coerce.
3. **The host contract is three-valued, and rondo implements all three.** Exit 0: parse stdout.
   Exit 2: stderr holds the reason, which is *either* an envelope *or* argparse prose, so the
   decoder must tolerate a non-document and fall back to surfacing the bytes verbatim. Any other
   status: continuo was called wrong or the process failed, stderr is text, and rondo treats it as
   its own defect.
4. **`measure report` is special-cased by name.** Exit 0 plus stdout is an unwrapped report
   identified by `report_kind`, not an envelope. Its domain refusals still escape as exit 1 with a
   stack, which rule 3 already covers.
5. **`gate close` is driven as an opaque exit code, and its prose is never parsed.** rondo confirms
   the state change by reading `gate show --json` afterwards, which carries `stage` and `outcome`.
6. **rondo still records which continuo revision it drove, per run — now by verifying the seam's
   answer rather than by substituting for its silence.** rondo pins the expected full 40-hex source
   sha, builds that checkout with `CONTINUO_REQUIRE_REVISION=1`, reads `--version` before the first
   driven verb, and persists the *observed* revision per run. A mismatch against the pin, the
   literal `unknown`, or a `-dirty` suffix is a startup refusal — never silently replaced with the
   expected sha.

### What was measured, and how

Everything below was run on **2026-09-05** on `node v22.17.0` / `npm 10.9.2` — the same toolchain
D-0001 used, so its version-dependent npm findings are compared like for like. Both sibling
checkouts were treated as strictly read-only and verified untouched before and after: `git status
--porcelain` reported only the same pre-existing `?? .worktrees/` in each, `HEAD` was unmoved, and
neither acquired a `node_modules/` or a `dist/`. Every build below happened in a scratch clone.

```
git -C <workers>/continuo rev-parse HEAD  ->  c92ab1a1c6fd9bd99c0c3b81326a30ba05432a61
git -C <workers>/cadenza  rev-parse HEAD  ->  4b53ecaec7ce2d8bcd3e4ac74cdaec27a232ca83
```

**The baseline is unchanged.** `npm view @suisya-systems/continuo version` still answers
`E404`, verbatim as D-0001 records it, and so does cadenza's. And neither package has acquired a
lifecycle script that would build on install:

```
grep -nE '"(prepare|prepack|prepublishOnly|postinstall|install)"' <continuo>/package.json <cadenza>/package.json; echo "grep-exit=$?"
```
```
grep-exit=1
```

That matters twice over: it is why option (a) still fails below, and it is the fact `continuo
D-0045` and `cadenza D-0033` each decided *deliberately* rather than left undone.

### Option (a), re-measured at the current sha: still fails

```
npm install --ignore-scripts "git+https://github.com/suisya-systems/continuo.git#c92ab1a1c6fd9bd99c0c3b81326a30ba05432a61"
```
```
npm warn skipping integrity check for git dependency ssh://git@github.com/suisya-systems/continuo.git
added 6 packages, and audited 7 packages in 13s
```

Exit 0, and the same useless install D-0001 recorded — `"files": ["dist", "README.md", "LICENSE"]`
honoured exactly against a tree with no `dist/`:

```
ls node_modules/@suisya-systems/continuo   ->  LICENSE  package.json  README.md
node -e 'import("@suisya-systems/continuo")'
  ->  ERR_MODULE_NOT_FOUND: Cannot find module '.../@suisya-systems/continuo/dist/index.js'
ls node_modules/.bin  ->  No such file or directory
```

The lockfile again records an integrity hash
(`sha512-kL0JvSu51RmU2DlYrmZsnBTSjZNKrZmWbZv4kGlsyR/0S9Ir6dPFznjVUqBCWZdn3YC9nxm4lXLYFLi4+R3P9A==`)
under a `npm warn skipping integrity check` — recorded, not enforced. This is a re-measurement, not
a copy: the sha, the package contents and the hash all differ from D-0001's, and the *verdict* is
what reproduces. D-0001's generic finding that `--ignore-scripts` does not suppress a git
dependency's `prepare` on npm 10.9.2 is not re-run here; the npm version is unchanged, and no
`prepare` exists to be suppressed.

### Option (b), re-measured at the current shas: still fails

```
npm install --ignore-scripts --install-links "file:<workers>/continuo" "file:<workers>/cadenza"
  ->  added 8 packages, and audited 9 packages in 2s   (exit 0)
```
```
@suisya-systems/continuo -> FAIL ERR_MODULE_NOT_FOUND ... /dist/index.js
@suisya-systems/cadenza  -> FAIL ERR_MODULE_NOT_FOUND ... /dist/index.js
node_modules/.bin  ->  No such file or directory
```

`--install-links` packs the target, and packing a tree with no `dist/` packs no `dist/` for either
sibling. The decisive defect is also unchanged and is structural rather than incidental — the
lockfile records a machine-specific path and nothing else:

```
"node_modules/@suisya-systems/continuo": { "resolved": "file:../../../../home/happy_ryo/work/org/workers/continuo" }
```

No registry URL, no integrity, no commit sha. Which revision this was built against is recorded
nowhere in the repository, which is the property D-0001 called decisive and which nothing since has
altered.

### The seam itself, built and exercised

A scratch clone at the pinned sha, built with the install policy D-0007 fixes:

```
npm ci --ignore-scripts            ->  added 136 packages in 2s
CONTINUO_REQUIRE_REVISION=1 npm run build   ->  exit 0
  revision: c92ab1a1c6fd9bd99c0c3b81326a30ba05432a61 -> dist/build_revision.js
git status --porcelain             ->  (empty, after the build)
```

Two facts in that transcript are load-bearing for rule 6. The build under
`CONTINUO_REQUIRE_REVISION=1` **succeeds** rather than warning, so rondo can make "this build knows
what it is" a build-time guarantee instead of a runtime hope. And the tree is **still clean
afterwards**: `scripts/generate-revision.mjs` overwrites the emitted `dist/build_revision.js` and
never `src/`, so building does not dirty the checkout whose sha is the pin — which is what makes a
`-dirty` suffix meaningful evidence rather than an artefact of having built.

```
node dist/cli.js --version
```
```
@suisya-systems/continuo 0.0.0 (rev c92ab1a1c6fd9bd99c0c3b81326a30ba05432a61)
```

The revision is the pinned sha, so the verification rule 6 describes is not hypothetical: rondo
compares two strings it already holds. Note that `version` is still the literal `0.0.0` — the
package is unpublished and `private: true` — so **the revision, not the version, is the identity**,
and a rondo that compared versions would compare a constant.

**A representative success and a representative refusal, per the envelope:**

```
node dist/cli.js db create --db <db> --json
  ->  exit 0, stdout: {"schema":"continuo.db.create/1","ok":true,"db":"<db>","schema_version":4,"head_version":4}

node dist/cli.js db create --db <db> --json          # the same db, second time
  ->  exit 2, stdout EMPTY, stderr:
      {"schema":"continuo.db.create/1","ok":false,"db":"<db>",
       "error":{"class":"ControlPlaneRefusal","message":"<db> already exists; refusing to create over it ..."}}

node dist/cli.js gate show --db <db> --gate-id nope --json
  ->  exit 2, stderr: {"schema":"continuo.gate.show/1","ok":false,"db":"<db>",
                       "error":{"class":"UnknownGateRefused","message":"gate nope does not exist"}}

node dist/cli.js gate list --db <db> --json
  ->  exit 0, stdout: {"schema":"continuo.gate.list/1","ok":true,"db":"<db>","gates":[]}
```

Refusals really are on stderr with stdout empty, which is what makes rule 3's two-stream reading
implementable rather than a preference.

**Which verbs carry the flag**, read off `--help` at this sha rather than off the entry that
introduced it:

| verb | `--json` |
|---|---|
| `run admit`, `run close` | yes |
| `db create`, `db migrate`, `db verify` | yes |
| `gate list`, `gate show`, `gate answer` | yes |
| `lap perform` | yes |
| `measure report` | yes (unwrapped) |
| `gate close`, `gate present`, `gate deliver`, `gate ack`, `gate reconcile` | **no** |

Ten of the fifteen. That is D-0090's stated scope reproduced exactly, which is worth having as a
measurement because rule 5 turns on the one row that is not in it.

**The three exceptions, each reproduced rather than cited:**

```
# 1. parser-level refusal: exit 2 with prose, NOT a document
node dist/cli.js run close --db <db> --run-id r1 --outcome bogus --json
  ->  exit 2, stderr: usage: continuo run close [...]
      continuo run close: error: argument --outcome: invalid choice: 'bogus' (choose from 'completed', 'failed', ...)

# 2. caller defect from an operator-typed value: exit 1 with a raw stack
node dist/cli.js run admit --db <db> --run-id r2 --workspace relative/path <...> --json
  ->  exit 1, stdout empty, stderr:
      file:///.../dist/control_plane/lap_run_intent.js:376
        throw new LapRunIntentUsageError(`workspace must be a fully qualified absolute path, got ...`)
node dist/cli.js run admit --db <db> --run-id '' <...> --json
  ->  exit 1, stderr: LapRunIntentUsageError: ... must be a non-empty string

# 3. measure report is unwrapped
node dist/cli.js measure report --db <db> --period-start-ms 0 --period-end-ms 1 --json
  ->  exit 0, stdout: { "report_kind": "interlock-measurement-report", "verdict": "...", "header": { ... } }
     (no "schema", no "ok")

# and the one new refusal
node dist/cli.js measure report --db <db> --period-start-ms 0 --period-end-ms 1 --json --format markdown
  ->  exit 2, stderr: continuo measure report: error: argument --json: another spelling of --format json,
      so it contradicts --format markdown; give one of the two
```

Exception 2 is the one with a consequence rondo must build for, and it is worth stating in rondo's
own terms: **an operator's typo reaches rondo as an exit 1 and a stack trace, not as a refusal
document.** A relative `--workspace` and an empty `--run-id` both produce it. So rondo validates
those values at its own boundary *before* spawning, and treats an exit 1 as a rondo defect to
report rather than an operator error to relay. Rule 3's third branch exists for this.

**Latency, re-measured** over 10 runs of `db verify --json` on the built tree: **101 ms** mean.
D-0001 measured ~103 ms for the same verb without the flag. The flag costs nothing measurable, and
the per-invocation floor D-0001 recorded as a cost is unchanged.

### The `gate close` gap, which is this entry's sharpest fact

rondo D-0013 puts `gate close --outcome withdrawn` on rondo's operating surface. `continuo D-0090`
deliberately leaves `gate close` human-only, and the build confirms it:

```
node dist/cli.js gate close --db <db> --gate-id nope --outcome withdrawn --actor-id op1 --json
  ->  exit 2, stderr: usage: continuo [-h] [--version] {measure,settings,sandbox,attention,db,run,lap,gate} ...
      continuo: error: unrecognized arguments: --json

node dist/cli.js gate close --db <db> --gate-id nope --outcome withdrawn --actor-id op1
  ->  exit 2, stderr: error: no gate 'nope'
```

The flag does not merely go unhandled — it is *rejected at the top level*, so a rondo that passed
`--json` uniformly to every verb would break this one call outright. **The machine-readable seam is
therefore incomplete at exactly the verb rondo's own design assigns to itself**, and this entry says
so rather than reporting D-0001's "no typed surface" cost as gone.

**How rondo drives it until continuo closes the gap: as an opaque exit code, confirmed by a
separate read.** Not by parsing `error: no gate 'nope'`. Three reasons, in order of weight:

- **Parsing that string is the defect `--json` exists to remove**, applied to the one verb the flag
  does not cover. `continuo D-0090` names it in its own context — prose "parsed by regular
  expression, silently re-parsed wrong the day a word changes". Introducing that parser here, in
  the same change that adopts the envelope everywhere else, would be adopting the fix and the
  hazard together.
- **rondo does not need the prose.** What rondo needs from this call is whether the gate is closed,
  and `gate show --json` answers that from the machine-readable half of the seam: its payload
  carries `stage` and `outcome` explicitly. So the close is a write whose effect rondo *reads
  back*, which is a stronger check than trusting either an exit code or a parse — it survives a
  close that succeeds and a close that silently does nothing.
- **A person is already at this call site.** D-0013 puts the verb on the operating surface
  precisely because `closeOpenGate` hard-codes `actorKind: "human"`. The refusal prose is addressed
  to the operator standing there, and rondo's job is to surface those bytes verbatim, not to
  interpret them.

So: exit 0 means the close was accepted and rondo confirms with `gate show --json`; exit 2 means
refused and rondo shows the operator continuo's stderr unaltered; any other status is rule 3's
third branch. **The named follow-up for continuo is `--json` on `gate close`** — the verb a host's
own design drives, excluded from the envelope that every other driven verb carries. rondo does not
file it; that is the secretary's, and the request is identified here by what it asks for rather
than by an issue number.

### What D-0001's cost list looks like now

Restated as a ledger, because "the two worst costs are gone" was D-0001's own prediction and it is
only half right.

- **"No types across the seam" — corrected, not removed.** rondo gets a versioned wire protocol on
  ten verbs, which is much better than prose and is *not* types. There is no shared compile-time
  artefact: no `.d.ts` crosses the boundary, `error.class` is a hint whose message remains the
  authority, and `ControlPlaneRefusal` covers several unrelated conditions while `gate show` and
  `gate answer` refuse the same condition under two different classes. rondo branches on the exit
  code and the verb, and on `class` only where the class is a leaf. The cost that remains is the
  decoders rondo now owns and must keep in step with `continuo.<verb>/1`.
- **"Provenance is rondo's problem" — corrected, and the requirement survives.** D-0001 recorded
  the checkout sha *because the binary could not identify itself*. It can now. But an identity the
  seam reports is a claim to be checked, not a fact to be trusted: the same three-git-call
  derivation that produces the sha produces `unknown` when it cannot, and `-dirty` when the build
  tree was modified. So D-0001 item 4 is not deleted — it becomes rule 6, and it gets *stricter*:
  rondo persists what `--version` observed, not what it expected, and refuses to start on a
  mismatch. Recording the expected sha and calling it provenance would now be the weaker practice.
- **~101 ms per invocation — unchanged**, and re-measured.
- **A second checkout and a second build — unchanged.** The build gains a step
  (`generate-revision.mjs`) and gains a switch worth setting (`CONTINUO_REQUIRE_REVISION=1`).
- **`gate close` answers in prose — new to this ledger**, and covered by rule 5.

Two costs improved, one materially; two are unchanged; one is newly named. Nothing here argues for a
different option, which is why D-0001's outcome stands rather than being superseded. Option (d),
the codeload tarball, is not re-measured: D-0090 changed nothing about it, and D-0001 declined it on
ownership rather than on capability — rondo would still be reproducing continuo's internal build,
which is now one script longer.

### What continuo publication changes

`continuo D-0045` remains the event this seam is waiting for, and it is out of scope here. When it
happens: `npm view` resolves; the dependency becomes a pinned registry version whose tarball is an
immutable artefact with an **enforced** integrity hash rather than a recorded-and-warned-past one;
the publisher builds, so `--ignore-scripts` regains its full meaning on rondo's side (D-0007); and
`dist/index.d.ts` — which continuo's `exports` already names — makes real library types available
across a boundary that is today a process.

**That is a new decision, not a pre-decided switch.** It is not the case that rondo flips to an npm
dependency the day continuo publishes. Publication removes the *packaging* objection; it does not
by itself answer whether rondo's seam should be a library call or a subprocess, and this entry has
just re-argued that the process boundary earns its place on ownership grounds that publication does
not touch. What publication does settle is that the choice becomes a real choice for the first
time. Rule 6 also survives publication in a modified form: a published `dist/` still answers
`--version` with the revision baked into it, which is exactly the case `continuo D-0090` designed
the literal for, so rondo's verification duty follows the artefact rather than the checkout.

### What would falsify it

- **`gate close` acquiring `--json`.** Rule 5's fallback then has no reason to exist, and the rule
  is replaced by the ordinary envelope handling of rules 2 and 3. This is the expected end of the
  gap, not a surprise.
- **A `continuo.<verb>/2` envelope, or a new verb rondo drives arriving without `--json`.** The
  first would mean rondo's decoders must handle two schema versions and this entry should say how;
  the second would widen the exception rule 5 treats as a single named case.
- **An exit-1 caller defect reaching a human as a stack trace in practice**, which would mean
  rondo's own pre-spawn validation is not covering what rule 3 assumes it covers.
- **`--version` reporting `unknown` or `-dirty` from a build rondo made**, which would mean rule 6's
  build-time guarantee (`CONTINUO_REQUIRE_REVISION=1` on a clean pinned clone) does not hold on some
  machine or CI runner in the matrix — the Windows cell being the one this was not measured on.
- **continuo being published** (`continuo D-0045`), which reopens the option comparison as described
  above rather than superseding this entry by itself.
- Any measurement above failing to reproduce. Every command is here to be re-run; the toolchain is
  `node v22.17.0` / `npm 10.9.2` and the pinned sha is
  `c92ab1a1c6fd9bd99c0c3b81326a30ba05432a61`.

---

## D-0016 — cadenza is still not consumed in lap 1, now for a different and narrower reason: the entry point exists, the artefact does not, and the record rondo needs is not exported

**Status:** accepted (2026-09-05, rondo's human gate)

D-0001 named this too: *"cadenza acquires an entry point. Then rondo has a decision to take about
cadenza that it does not have today, and it is a new entry rather than an edit to this one."*
`cadenza D-0033` fired it. This is that new entry.

**D-0001 item 3 is re-affirmed, and its reason is replaced.** D-0001 said cadenza was unreachable
because it had no entry point of any kind. That is no longer true and this entry does not repeat
it. The outcome survives on two different facts measured below: no route delivers a *built* cadenza
to rondo without rondo owning cadenza's build, and the one lap-1 record rondo would most want from
cadenza is not on the exported surface.

### Decision

1. **rondo does not consume cadenza in lap 1.** Nothing in rondo imports it, spawns it, or links to
   it. D-0001 item 3 stands.
2. **The reason is the artefact and the surface, not the entry point.** Stating it correctly
   matters, because the old reason pointed at a change inside cadenza that has now been made.
3. **What rondo needs from cadenza's vocabulary in lap 1 it continues to restate at its own
   boundary**, as D-0009 … D-0014 already do — each of those entries takes a cadenza design row's
   outcome as a rondo decision, in rondo's own words, with no cadenza value crossing into rondo.

### What was measured, and how

Same day, same toolchain and same read-only discipline as D-0015; cadenza at
`4b53ecaec7ce2d8bcd3e4ac74cdaec27a232ca83`, verified untouched afterwards. The build and the pack
happened in a scratch clone.

**What `cadenza D-0033` actually delivered, confirmed rather than assumed.** `package.json` now
carries `exports` (`.` and `./package.json`, nothing else), `main`, `types`, `files`
(`dist`, `src`, `README.md`, `LICENSE`), and a `build` script. Built from the pinned clone:

```
npm ci --ignore-scripts   ->  added 133 packages in 579ms
npm run build             ->  exit 0   (clean, then tsc -p tsconfig.build.json)
git status --porcelain    ->  (empty)
ls dist  ->  adapters  application  domain  index.d.ts  index.d.ts.map  index.js  index.js.map  ports
```

**The packed tarball is genuinely consumable**, which is `cadenza D-0033`'s own claim, reproduced
here from rondo's side:

```
npm pack <scratch-clone> --ignore-scripts      ->  suisya-systems-cadenza-0.0.0.tgz  (118 files)
npm install --ignore-scripts <that tarball>    ->  exit 0
node -e 'import("@suisya-systems/cadenza")'    ->  import ok: 70 exports
```

### Why that does not make cadenza consumable *by rondo* today

**A git dependency at the current sha still fails, and it fails for a reason `npm pack` cannot
speak to.** This is the distinction the whole entry turns on:

```
npm install --ignore-scripts "git+https://github.com/suisya-systems/cadenza.git#4b53ecaec7ce2d8bcd3e4ac74cdaec27a232ca83"
  ->  npm warn skipping integrity check for git dependency ...
      added 2 packages, and audited 3 packages in 12s   (exit 0)
```
```
ls node_modules/@suisya-systems/cadenza  ->  LICENSE  package.json  README.md  src
du -sh                                    ->  228K
ls -d .../dist                            ->  No such file or directory
node -e 'import("@suisya-systems/cadenza")'
  ->  ERR_MODULE_NOT_FOUND: Cannot find module '.../@suisya-systems/cadenza/dist/index.js'
```

The install is *much better shaped* than the one D-0001 measured — 228 KB against 1.7 MB, `files`
now an allowlist, `src/` packed deliberately so the emitted maps resolve — and it is still
unimportable, because there is no `prepare` and a git install builds nothing. `npm pack` proves a
**freshly built tree** can be consumed; it says nothing about what a git specifier or a GitHub
source tarball delivers, and what they deliver is a tree with no `dist/`. `cadenza D-0033` rejected
`prepare` explicitly and for a reason rondo shares (`--ignore-scripts` on both sides), so this is a
settled position on cadenza's side rather than an omission to be escalated.

**And the deep-path escape hatch D-0001 found is now closed.** D-0001 recorded that
`@suisya-systems/cadenza/src/index.ts` could be reached behind `tsx` — consumption "through an
unversioned internal path, behind a runtime loader", which it declined as a dependency rather than
called impossible. The `exports` map ends that:

```
import("@suisya-systems/cadenza/src/index.ts")
  ->  ERR_PACKAGE_PATH_NOT_EXPORTED: Package subpath './src/index.ts' is not defined by "exports"
import("@suisya-systems/cadenza/src/index.js")
  ->  ERR_PACKAGE_PATH_NOT_EXPORTED
```

This is worth recording as an improvement rather than a regression, and it sharpens the decision in
a useful direction: cadenza has moved from "consumable only by a route rondo declines" to
"consumable only by the route cadenza intends" — a built artefact through the package name. The
option rondo would have refused on principle no longer needs refusing. What remains is the honest
question of who builds it.

**So the routes that remain, and their cost:** a git or codeload specifier plus rondo running
cadenza's build (`npm run build`, hence `tsc 7.0.2` and cadenza's `tsconfig.build.json`, in rondo's
CI); or a packed tarball, which someone must build and place. Both make **rondo responsible for
building or hosting a dependency it does not own** — the same objection D-0001 raised against
option (d) for continuo and settled the same way. For lap 1, in which rondo consumes cadenza
*nowhere*, paying that to import nothing would be a commitment bought for its own sake.

### The surface, inventoried against what lap 1 needs

`cadenza D-0033` makes the barrel the surface cadenza is answerable for, so it is worth saying
exactly what is on it. Measured from the installed tarball, **70 exports**, covering three groups:
G1 project resolution (`composeCatalog`, `resolveProject`, the TOML layer loader, `configDigest`
and its value types), the G2 delegation contract (`delegationContract`, `DelegationContract`,
`contractDigest`, `delegate`/`adopt`), the total classifier (`classify`, `Classification`,
`Outcome`), plus the canonical-JSON primitives and the error taxonomy.

**The record rondo's lap-1 entries lean on hardest is not there.** Filtering the export list for
anything agent-, role-, executor-, loop- or grant-shaped returns exactly two names, and both are
delegation errors (`AmplifiedGrantError`, `UngrantedDelegationError`). **There is no agent-type
export.** cadenza's `docs/design/conductor.md` assigns that record to cadenza, and cadenza `C-2` /
`cadenza D-0031` decided its shape — but no code implements or exports it, and `src/index.ts` says
in its own words that the list is "a statement about progress". Meanwhile rondo D-0014 already
depends on the agent type carrying an executor-neutral role name, and D-0011 and D-0012 sit beside
records of the same family.

This is the distinction the entry must not blur: **"consume today's G1/G2 API" and "cadenza supplies
every lap-1 domain record" are different claims, and only the first is available.** A rondo that
took a cadenza dependency now would import 70 values, need none of them for lap 1, and still have
to restate the one record it does need. There is also deliberately no gate API — `cadenza D-0033`
says so, on the ground that a gate *outcome* is an input to `classify()` and the gate verbs belong
to continuo, which is consistent with rondo reaching gates through continuo's CLI under D-0015.

### Why this is a decision and not a deferral

Because the answer could have gone the other way and the reasons are now different ones. `cadenza
D-0033` removed the packaging objection that made D-0001's answer easy, and what is left is a
judgement: taking a dependency rondo has no lap-1 use for, whose delivery rondo would own, to
obtain a vocabulary rondo is already restating at its own boundary under six entries that work. The
answer is no, and the falsifiers below say precisely what would change it — none of which is
"cadenza became consumable", because it has.

### What continuo publication changes

Nothing about this entry directly, and that is worth stating so the two halves are not confused.
`continuo D-0045` is continuo's, and cadenza's publication is a separate decision cadenza has not
taken — `cadenza D-0033` says in as many words that it "does not publish anything" and the package
stays `private: true`.

What continuo publication changes *indirectly* is the precedent and the cost model. Once rondo
holds one published sibling as an ordinary pinned dependency with an enforced integrity hash and
types, the marginal cost of a second one falls to almost nothing, and the argument above — that
rondo would be owning cadenza's delivery — evaporates for cadenza the day cadenza publishes too.
**Neither is a pre-decided switch.** cadenza publishing would fire the first falsifier below and
bring this entry back for a decision, on a question that would then be about need rather than about
delivery.

### What would falsify it

- **cadenza publishing to a registry.** The delivery objection — the larger half of this entry —
  disappears, and the remaining question is only whether rondo needs anything on the surface. That
  is a re-argument of this entry on its merits, in the shape D-0015 is for D-0001.
- **cadenza exporting the agent-type record**, or any other lap-1 domain record rondo's entries
  name. The inventory above is the reason half of this entry, and it is dated: it is true of
  `4b53ecaec7ce2d8bcd3e4ac74cdaec27a232ca83` on 2026-09-05 and of nothing else.
- **rondo needing a cadenza value it cannot restate.** Every entry from D-0009 to D-0014 restates a
  cadenza row's outcome in rondo's own words; a row whose outcome cannot be restated — one that
  needs cadenza's *code* to be correct, such as `configDigest` or `contractDigest` agreeing
  byte-for-byte with a value cadenza computes — makes the boundary the wrong shape and this entry
  is superseded. `cadenza D-0029`'s own falsifier is the other edge of this.
- **cadenza acquiring a `prepare` script or otherwise making a git install deliver `dist/`**, which
  would remove the delivery cost without publication. `cadenza D-0033` rejected this deliberately,
  so it would be a reversal there rather than a surprise here.
- **lap 1 growing a consumer.** This entry is scoped to lap 1 by its title; it decides nothing about
  lap 2, and reaching it as precedent for a later lap would be reading it wider than it was taken.
- Any measurement above failing to reproduce. Toolchain `node v22.17.0` / `npm 10.9.2`; cadenza at
  `4b53ecaec7ce2d8bcd3e4ac74cdaec27a232ca83`.
