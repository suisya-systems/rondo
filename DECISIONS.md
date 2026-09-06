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
- **Append-only means nothing is removed or rewritten — not that an entry is frozen.** The
  supersession rule above already edits an accepted entry's `Status`, and the same licence extends
  to a **dated annotation**: a later entry may add a marked, dated note to an earlier one saying
  which falsifier fired, which entry answered it, or that a request has since been carried out. An
  annotation is additive and says so; it never edits a claim, a measurement or a date already
  recorded, and the original text stays readable underneath it. Anything that would change what an
  entry *asserted* is a supersession and takes a new ID instead. D-0001's annotations from D-0015
  and D-0016 are the worked example.
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
| D-0001 | How rondo consumes continuo and cadenza in lap 1: a CLI process boundary for continuo, and nothing at all for cadenza | superseded by D-0018 |
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
| D-0016 | cadenza is still not consumed in lap 1, now for a different and narrower reason: the entry point exists, the artefact does not, and the record rondo needs is not exported | superseded by D-0018 |
| D-0017 | The first working seam to continuo: a `src/continuo/` layer, a build rondo verifies before it drives, and `gate close` rejoining the envelope | accepted |
| D-0018 | cadenza becomes a library rondo consumes: a vendored tarball under cadenza's delivery bridge, one facade, and a smoke that runs in every cell | accepted |
| D-0019 | The first working conductor loop: a pure planner, an interpreter over injected ports, a durable single-flight store, and a suspend at the open gate | accepted |
| D-0020 | The operating surface's rondo-owned rows: gate panes first, the OIDC subject as `--actor-id`, LAN-first, and rondo's store as the home of the delegation record and the operator conversation | accepted |
| D-0021 | The pin moves to continuo `603843b`: a third explicit budget for the identity read-back, and the model tier priced into `lap perform --model` | accepted |
| D-0024 | rondo ships a binary: an emitting build beside the type-check, a launcher, and the CI cell that runs it | accepted |
| D-0025 | The lap-1 operating surface is a command line: `start`, `answer`, `publish`, `abandon`, with the plan file as the whole of configuration | accepted |
| D-0026 | The pull request `publish` opens is written for a person: the lap's own commit subjects are the summary, and the request is quoted input | accepted |
| D-0023 | The identifier allocator and the capacity ledger: rondo mints the triple, `awaiting_human` stops occupying capacity, and the single-flight index becomes a counted bound | accepted |
| D-0027 | "Revise" at the gate becomes a second lap: fresh identifiers, the predecessor's branch as the base, and the instruction carried into the prompt | accepted |
| D-0028 | The plan payload carries its own version: an ordered read-side upgrade ladder, strict again at the version that introduced each field, and separate from the schema's migration on purpose | accepted |

---

## D-0001 — How rondo consumes continuo and cadenza in lap 1: a CLI process boundary for continuo, and nothing at all for cadenza

**Status:** superseded by D-0018 (2026-09-06). Accepted 2026-09-05 (rondo#1).

> **Supersession note.** Item 1 wrote its own rule — a dependency on either sibling "in any
> specifier form" supersedes this entry — and D-0018 takes one on cadenza, which also retires item
> 3. Supersession here is whole-entry, per "How to use this file", so **items 2 and 4 are not
> retired with it**: continuo across a CLI process boundary and the duty to record which continuo
> revision drove a run are re-argued in **D-0015** and implemented in **D-0017**, which are where
> those two claims now live. Nothing below is edited, including the 2026-09-05 annotation from
> D-0015 and D-0016 that follows this note.

> **Annotation (2026-09-05, from D-0015 and D-0016).** Added after this entry was accepted, under
> the annotation rule in "How to use this file". Nothing below it was removed or rewritten: every
> measurement, claim and date is as originally taken, and the three marked notes further down —
> two on the falsifier list, one on the escalation list — are additions of the same kind.

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
continuo's own gates can weigh them:

> **Annotation (2026-09-05, from D-0015 and D-0016).** Three of the four requests below were
> carried out at the siblings' own gates the same day, recorded here so a later reader does not
> re-escalate them: cadenza's packaging (`cadenza D-0033`, see D-0016), and both continuo requests
> — the revision-carrying `--version` and `--json` on the driven subcommands (`continuo D-0090`,
> see D-0015). `--json` landed on ten of fifteen verbs and **not on `gate close`**, which D-0015
> measures and decides how to drive. The `prepare` non-escalation is unaffected and still stands.
> The list itself is unchanged.

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
  *(Annotation, 2026-09-05:* **fired** — `continuo D-0090`; re-argued in **D-0015**, which finds one
  of the two costs materially improved rather than gone, and this entry's outcome unchanged.*)*
- **cadenza acquires an entry point.** Then rondo has a decision to take about cadenza that it
  does not have today, and it is a new entry rather than an edit to this one.
  *(Annotation, 2026-09-05:* **fired** — `cadenza D-0033`; the new entry is **D-0016**, which
  re-affirms item 3 on the artefact and the exported surface rather than on the absence of an entry
  point.*)*
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

> **Annotation (2026-09-05, from D-0017).** Added after this entry was accepted, under the
> annotation rule in "How to use this file". Nothing below is removed or rewritten. **Rule 5's own
> falsifier — "`gate close` acquiring `--json`" — fired the same day**: `continuo D-0092` gives the
> verb the shared `continuo.gate.close/1` envelope and names this rule as the reader that justified
> the change. **D-0017 replaces rule 5** with the ordinary envelope handling of rules 2 and 3, which
> is what this rule said would replace it; the second `gate show --json` per close is no longer
> part of the protocol. Rules 1, 2, 3, 4, 6 and 7 are untouched and are what D-0017 builds on, and
> rule 6 is implemented only as far as verification: persisting the observed revision per run waits
> on a store schema, which D-0017 rule 5 records as outstanding. The measurements below are those of
> `c92ab1a1c6fd9bd99c0c3b81326a30ba05432a61` and are kept as taken.

> **Annotation (2026-09-06, from D-0019).** **Rule 6's outstanding half is discharged.** The store
> schema arrived with D-0019, and the iteration row carries the **observed** continuo revision;
> D-0019 rule 10's write order commits it *before* `run admit` is spawned, so a crash between the
> two leaves a row that names the run id and the build it was admitted against. Nothing else in this
> entry changes: rules 1, 2, 3, 4 and 7 stand as written, and rule 5 remains replaced by D-0017.

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
   decoder must tolerate a non-document and fall back to surfacing continuo's own words under rule
   7 rather than inventing a diagnosis of its own. Any other
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
7. **Upstream bytes are relayed unedited in content, but escaped before rondo prints them.**
   continuo's prose — an argparse refusal, `gate close`'s `error:` line, an exit-1 stack — is
   passed through without interpretation, summary or reword; rondo adds nothing and drops nothing.
   It is *not* passed through without encoding. Anything rondo writes to a terminal is ASCII
   (D-0004), and D-0004's reason bites hardest exactly here: the Windows cell's console may be
   cp932, where an unencodable character crashes the writer rather than printing badly, and
   vitest's UTF-8 capture means no test of rondo's own would catch it.

   This is not hypothetical. continuo echoes `--db` **verbatim and deliberately unconstrained** —
   `continuo D-0090` says so, and it is why continuo wrote an ASCII encoder for the JSON path. That
   encoder covers the envelope only. The prose paths rule 3 and rule 5 fall back to have no such
   guard, so a non-ASCII database path, workspace, gate id or operator-typed value reaches rondo as
   non-ASCII bytes on stderr. So rondo escapes non-ASCII to a printable form on the way out. The
   distinction the rule turns on is that **escaping is a property of the transport and parsing is a
   property of the meaning**: rondo may re-encode continuo's characters, and may not decide what
   they say.

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
| `gate close` | **no** — and rondo drives it (rule 5) |
| `gate present`, `gate deliver`, `gate ack`, `gate reconcile` | **no** — and rondo does not drive them |

Ten of the fifteen surveyed, which reproduces D-0090's stated scope exactly.

**Fifteen is the surveyed set, not rondo's set, and the difference is load-bearing.** *rondo drives
eleven*: the ten that carry the flag, plus `gate close` under rule 5. The last four rows are
human-only by `continuo D-0090` and rondo drives none of them — `gate present`, `deliver` and `ack`
are the relay path an operator works through a dropbox directory (`continuo D-0076`), and
`gate reconcile` runs continuo's own `subject_gone` sweep, which rondo D-0013 already records as
*not* the conductor's to invoke. So the absence of `--json` on those four is not a gap in rondo's
seam and is not part of the follow-up this entry names; only `gate close` is. Reading the table as
"fifteen verbs rondo drives, ten of them cleanly" would widen the subprocess adapter to four human
workflows that D-0009 and D-0013 deliberately keep out of it.

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
document.** A relative `--workspace` and an empty `--run-id` both produce it, measured above. So
rondo validates at its own boundary *before* spawning, and treats an exit 1 as a rondo defect to
report rather than an operator error to relay. Rule 3's third branch exists for this.

**The rule is every operator-supplied value on these verbs, not the two that were measured.** The
two probes are evidence that the class is reachable from the command line, not an enumeration of
it. `continuo D-0090` records the same uncaught path for `LapRunIntentUsageError`,
`RunAdmissionUsageError` and `RunCloseUsageError`, which between them cover `--run-id`,
`--workspace`, `--base-branch`, `--topic-branch` and `--lease-claimant-id` on `run admit`, and
`--actor-id` on `run close`. Any of those reaching continuo malformed produces exit 1 and a stack.
Naming only the two that were probed would leave the other four to be discovered by an operator, so
what this entry requires is the general form: **rondo validates every operator-supplied value it
puts on a continuo command line, and a new flag on a driven verb is validated when it is adopted.**

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
  to the operator standing there, and rondo's job is to relay those words unedited — escaped for
  the console under rule 7 — not to interpret them.

So: exit 0 means the close was accepted and rondo confirms with `gate show --json`; exit 2 means
refused and rondo shows the operator continuo's stderr unedited, escaped under rule 7; any other
status is rule 3's
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
- **continuo constraining what it echoes**, or growing an ASCII guarantee on its prose paths as it
  has on the envelope. Rule 7's escaping would then be belt over braces, and the rule should say so
  rather than continue to imply the hazard is live. The converse also falsifies it: rondo printing
  an escaped form so mangled that an operator cannot act on continuo's message means the rule
  bought D-0004 at too high a price and needs a better rendering, not a weaker rule.
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

**Status:** superseded by D-0018 (2026-09-06). Accepted 2026-09-05 (rondo's human gate).

> **Supersession note.** Two of the falsifiers below fired within the day: `cadenza D-0035`
> accepted a delivery route for an `--ignore-scripts` consumer, and `cadenza D-0034` put the
> agent-type record on the exported surface. **D-0018** is the entry that answers both. The
> measurements below are of `4b53ecaec7ce2d8bcd3e4ac74cdaec27a232ca83` and are kept as taken.

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

---

## D-0017 — The first working seam to continuo: a `src/continuo/` layer, a build rondo verifies before it drives, and `gate close` rejoining the envelope

**Status:** accepted (2026-09-05, rondo's human gate)

> **Annotation (2026-09-06, from D-0019).** Added under the annotation rule in "How to use this
> file"; nothing below is removed or rewritten. **Rule 5's own falsifier — "the store schema
> arriving and the observed revision still not being persisted" — did not fire; the deferral is
> discharged instead.** D-0019 gives rondo a store, and the iteration row persists the observed
> continuo revision, committed before `run admit` is spawned. **All eleven rules stand as written**,
> and this entry is *not* superseded: D-0019 takes `R-1` as ports rather than as an arrow, so
> `src/refrain` still does not import `src/continuo` and rule 2's purpose — the loop stays testable
> on a machine with no continuo on it — is unchanged. Rule 2's arrow table gains exactly one arrow,
> `src/refrain -> src/cadenza`, which is D-0018 rule 5's arrow and not a claim of this entry's.

D-0015 named this moment as one of its own falsifiers: *"`gate close` acquiring `--json`. Rule 5's
fallback then has no reason to exist, and the rule is replaced by the ordinary envelope handling of
rules 2 and 3. This is the expected end of the gap, not a surprise."* `continuo D-0092` fired it,
deliberately and by name — that entry cites rondo D-0015 rule 5 as the reader whose absence
`continuo D-0090` had used to justify leaving the verb human-only, and says in as many words that
the rule "is obsolete once this lands".

**D-0015 stays accepted and keeps its ID.** Six of its seven rules are untouched and are the rules
this entry builds on. Rule 5 is *replaced* rather than reinterpreted: what replaces it is not a new
mechanism but the ordinary one every other driven verb already uses, which is exactly the outcome
rule 5 said it was standing in for. D-0015 gains a dated annotation saying so, under the annotation
rule in "How to use this file"; nothing in its text is edited.

This entry is also the first one here that ships code against the seam rather than measuring it, so
it takes the three decisions that implementing it requires and that D-0006 says may not be taken in
passing: which layer the seam is, which module may start a process, and where the pin lives.

### Decision

1. **`gate close` is driven like every other verb, and D-0015 rule 5 is replaced.** At the pinned
   revision `gate close --json` answers in `continuo.gate.close/1` — success on stdout at exit 0,
   refusal on stderr at exit 2 — so rondo decodes it under D-0015 rules 2 and 3 and nothing else.
   The three things rule 5 required all stop: rondo no longer drives the verb as an opaque exit
   code, no longer treats its prose as the only available answer, and **no longer runs a second
   `gate show --json` to find out what happened**. Reading a gate back afterwards remains an
   ordinary thing rondo may do; what it is not is a protocol duty of the close.

   **Two things this does not change.** `gate close`'s *prose* path is not gone — a disallowed
   `--outcome` is refused by argparse before the verb runs, so exit 2 still does not guarantee a
   document, and D-0015 rule 3's fallback covers it exactly as before. And **who may close a gate is
   untouched**: `closeOpenGate` still hard-codes `actorKind: "human"` at the pinned revision, which
   is precisely why D-0013 put the verb on rondo's operating surface rather than in the conductor.
   D-0092 changed an encoding, not an authority, and reading this entry as licence for the
   conductor to close gates would unpick D-0013 and D-0009.

2. **The seam is a layer of its own, `src/continuo/`, split into a pure decoder and one invoker.**
   `src/continuo/protocol.ts` turns bytes into rondo's records and can produce no bytes;
   `src/continuo/invoker.ts` is the only module in rondo that starts a process;
   `src/continuo/pin.ts` is the pin and its comparison. The arrows, added to
   `ALLOWED_INTERNAL_BY_LAYER`: **`src/access` may reach `src/continuo`; `src/refrain` and
   `src/store` may not; `src/continuo` reaches only itself.** The loop stays testable on a machine
   with no continuo on it, which is what its empty allowance has always been for, and the seam
   cannot grow into a second loop.

   Not `src/access/`, which is where human-facing surfaces live; not `src/store/`, which owns
   rondo's durable state; not a generic `src/seam/`, which would be a directory named after a
   metaphor rather than after the thing behind it. Driving continuo against continuo's own control
   plane does **not** make this a second SQLite owner (D-0005): that boundary is about naming a
   driver, and this layer names none — the database is a path on a command line.

   One side effect is named here rather than discovered later: the boundary test derives an
   unlayered module's allowance from the layer table (`ALLOWED_FOR_UNLAYERED =
   Object.keys(ALLOWED_INTERNAL_BY_LAYER)`), so adding this layer also lets `src/index.ts` re-export
   from it. That is what a barrel is for and it is intended, but it means the allowlist widened in
   two places and this entry is the record of both.

3. **`spawn` from `node:child_process` is granted to `src/continuo/invoker.ts` and to no other
   module.** This is the allowlist widening D-0006 says is a decision, and it is granted per module
   and per binding, as `node:sqlite` is. The decoder sits in the same directory and is deliberately
   ungranted, so a decoder that acquired the ability to produce the bytes it reads fails the
   boundary sweep; `test/architecture/import-boundaries.test.ts` plants that case, the second-module
   case, the `process.getBuiltinModule` laundering case and a control proving the grant still works.

4. **The pin is a committed manifest, and an environment variable can never be it.**
   `continuo.pin.json` holds the repository URL, the full 40-hex sha, and the exact `--version` line
   that revision prints; `src/continuo/pin.ts` mirrors the three as literals so that no module under
   `src/` needs a filesystem capability to know the pin, and `test/continuo/pin.test.ts` fails if
   the two drift or if a second full sha appears in the CI workflow. `RONDO_CONTINUO_CLI` **locates**
   an already-built `dist/cli.js` and says nothing about which revision it is. The pinned revision is
   `44f62336108b86cab5da791111ffa0e5b73cd01a`, chosen because it is the first continuo whose
   `gate close` answers in the envelope.

5. **rondo verifies the build before it drives it, and records what it observed.** Before the first
   driven verb, rondo reads `--version` and compares the whole line with the manifest: a mismatched
   revision, the literal `unknown`, a `-dirty` suffix, a revision outside continuo's own alphabet,
   or a line of another shape is a **startup refusal**, and the refusal names which of those it was.
   The verified record carries the **observed** revision, never the expected one.

   **D-0015 rule 6 is unchanged by this entry, and is half implemented.** That is a statement of
   implementation status, not a narrowing: the rule still requires the observed revision to be
   persisted *per run*, and this entry does not relieve rondo of it. What exists today is the
   verification and a local, per-process record; rondo has no store schema
   (`src/store/sqlite.ts` names the seam and throws), so there is nowhere to write the row, and
   until there is, rondo can prove which continuo it verified only for as long as the process
   lives. The falsifier list below is what keeps that from becoming permanent by silence.

6. **CI provisions the pinned continuo in runner temp, per matrix cell, and the smoke is mandatory
   in every one of them.** The `double-green` job clones the repository from the manifest, checks out
   the exact sha detached, installs with `npm ci --ignore-scripts` and builds with
   `CONTINUO_REQUIRE_REVISION=1`, then runs both seeded suites against that build. The smoke sequence
   is: verified `--version`; `db create --json`; `run admit --json` with all seven intent fields and
   an absolute workspace; an empty `gate list --json`; and `gate show --json` for a gate that does
   not exist, expecting exit 2 and a decoded refusal envelope. `lap perform` is **not** driven: it
   spawns a worker, and a test suite is not where an agent session belongs.

   The smoke is **capability-gated locally and mandatory under CI**: with `RONDO_CONTINUO_CLI` unset
   it skips with a reason that says how to set it, and under `CI` an unset variable **fails the
   suite** rather than skipping. A skip there would make a green cell mean nothing about the seam,
   and `gate` already treats a skipped job as red.

   Provisioning reaches the network; the smoke itself does not. Nothing is built inside either
   repository: not in rondo's checkout, where a `node_modules/` and a `dist/` would contaminate the
   boundary sweep's directory walk, and not in a sibling checkout, which does not exist on a runner.

7. **`--json` is put on the command line by the invoker, not by its callers.** Every verb this
   layer decodes answers in the envelope only when the flag is present, and a caller that forgot it
   would run continuo in human-output mode: a *mutating* verb would succeed, its prose would fail to
   decode, and rondo would report its own defect for a command that had already taken effect — an
   invitation to retry a write that did not need retrying. continuo declares the flag in one module
   on its side for the same reason; rondo spells it once on this one.

8. **What the decoder promises, in rondo's own words.** Validate `schema` first, then `ok`, then the
   envelope's common fields, then the verb's payload. **Unknown keys are accepted everywhere** —
   continuo's `/1` is explicit that an added field does not move the version, so a decoder that
   refused them would break on continuo's next additive release for nothing. An unrecognised
   `schema` is a clean refusal to proceed. `error.class` is carried as an opaque hint and never
   branched on, because continuo says the message is the authority. Five outcomes, and no continuo
   type leaves the layer: **answered**, **refused** (continuo's own refusal, in the envelope),
   **refused in prose** (exit 2 whose stderr is not a document — an argparse-level refusal, relayed
   unedited and never parsed), **protocol refusal** (a document whose `schema` rondo does not decode —
   an unknown version, or another verb's), and **invoker defect** (an exit code that is neither 0
   nor 2, a signal, a spawn failure, an exit 0 with nothing to parse, an envelope that contradicts
   its own exit code, or a recognised document whose known fields will not read).

   **The line between the last two is drawn at the discriminator, and it is drawn there on purpose.**
   A schema rondo does not decode is the seam having moved: re-pin, or teach rondo the new shape. A
   `continuo.<verb>/1` document *from a build whose revision rondo verified against a committed sha*
   whose known fields are the wrong type is not an upstream surprise at all — it is rondo's model of
   a build it pinned being wrong, and filing it as a protocol refusal would blunt the one signal the
   pin exists to make loud.

   `measure report` keeps its special case, by name, with its own entry point — and the case is
   wider than D-0015 rule 4 states. That rule describes its *success* as unwrapped; read at the
   pinned revision, `src/measurement/cli.ts` mounts `--json` and never calls the envelope's
   `successLine` or `refusalLine` at all, because there the flag is only another spelling of
   `--format json`. So the verb has **no envelope on any path**, and its exit 2 is prose. rondo's
   decoder says so; an earlier draft of it invented a `continuo.measure.report/1` refusal document,
   which does not exist.

9. **A continuo rondo has not verified cannot be driven, and the check is at runtime.** The record
   `startContinuo` hands back is a structural type, so a caller could write one by hand — and a
   JavaScript caller needs no type at all — which would mean driving an arbitrary executable while
   holding a value whose name says rondo checked it. So the invoker issues the handles it verified
   and refuses any other, before it looks at the arguments and before it starts a process. A
   boundary that can be reached around is worth what the `spawn` grant would be worth if any module
   could import `node:child_process`.

10. **Two argument shapes are refused before the spawn, and a document's silence is not an answer.**
   An empty argument reaches continuo as an exit 1 and a raw stack (D-0015's exception 2); an
   argument containing a NUL never reaches continuo at all, because `spawn` throws *synchronously*
   rather than reporting through the event the invoker handles. Both are refused as rondo defects
   before a process starts, and the spawn is guarded so that no failure of it can arrive as a
   rejected promise — every caller in rondo is written against a value. Symmetrically, a field
   continuo answers with "a string or `null`" is decoded as *present and null*: at the pinned
   revision every such key is emitted on every document that carries it, so an **absent** one is a
   document that does not match the pinned shape, and folding absence into null would be the
   decoder declining to validate in the one place it looks like it validates.

11. **The escaping stays exactly where D-0015 rule 7 put it, and is now a module.**
   `src/access/console.ts` escapes to ASCII once, at the boundary where characters become output
   (D-0004). Decoded messages are unchanged inside rondo, so a value rondo holds is still the value
   continuo sent.

### What was measured, and how

Everything below was run on **2026-09-05**, `node v22.17.0` / `npm 10.9.2`, against a scratch clone
of continuo at the pinned sha. The sibling checkout at `<workers>/continuo` was treated as strictly
read-only and verified untouched before and after (`git status --porcelain` reported only the same
pre-existing `?? .worktrees/`, and `HEAD` was unmoved); every build happened in a temporary
directory.

```
git -C <workers>/continuo rev-parse HEAD  ->  44f62336108b86cab5da791111ffa0e5b73cd01a
                                              (tip: "gate close answers in the shared --json envelope (D-0092)")
npm ci --ignore-scripts                   ->  added 136 packages in 2s
CONTINUO_REQUIRE_REVISION=1 npm run build ->  exit 0
                                              revision: 44f6...d01a -> dist/build_revision.js
node dist/cli.js --version
```
```
@suisya-systems/continuo 0.0.0 (rev 44f62336108b86cab5da791111ffa0e5b73cd01a)
```

`npm ci --ignore-scripts` is enough to run the CLI on this matrix: `better-sqlite3` ships prebuilt
binaries for `linux-x64` and `win32-x64` in the package, so no lifecycle script has to run for the
control plane to open a database. That is what makes D-0007's install policy and a working smoke
compatible on the Windows cell rather than only on this one.

**The smoke sequence, run by hand before it was written as a test:**

```
db create --db <db> --json
  ->  exit 0  {"schema":"continuo.db.create/1","ok":true,"db":"<db>","schema_version":4,"head_version":4}

run admit --db <db> --run-id r1 --lease-claimant-id c1 --workspace <abs> --role worker
          --base-branch main --topic-branch feat/x --prompt "a one-line request" --json
  ->  exit 0  {"schema":"continuo.run.admit/1","ok":true,"db":"<db>","run_id":"r1",
               "status":"created","created_at_ms":1788618380687,"events":{...}}

gate list --db <db> --json
  ->  exit 0  {"schema":"continuo.gate.list/1","ok":true,"db":"<db>","gates":[]}

gate show --db <db> --gate-id nope --json
  ->  exit 2  {"schema":"continuo.gate.show/1","ok":false,"db":"<db>",
               "error":{"class":"UnknownGateRefused","message":"gate nope does not exist"}}
```

**The falsifier itself, reproduced.** This is the command D-0015 recorded as being rejected at the
top level with `continuo: error: unrecognized arguments: --json`:

```
gate close --db <db> --gate-id nope --outcome withdrawn --actor-id op1 --json
  ->  exit 2  {"schema":"continuo.gate.close/1","ok":false,"db":"<db>",
               "error":{"class":"UnknownGateRefused","message":"no gate 'nope'"}}
```

The flag is accepted, the document is the shared envelope, and the refusal is on stderr with stdout
empty — so the verb rondo's own D-0013 assigns to its operating surface is now inside the protocol
that covers the other ten.

**Three facts below this one were *read* rather than measured, and are marked as such** because no
command available to rondo produces them. (i) The **successful** `gate close` payload —
`gate_id`, `closed`, `outcome`, `from_stage`, `to_stage`, where `closed` is whether *this* call
performed the close and `false` is an idempotent repeat rather than a refusal — is read from
`continuo D-0092` and from `src/gate/cli.ts` at the pinned sha. No CLI path creates a gate: gates
are opened from within `lap perform`, which this seam deliberately does not drive, so the success
case cannot be reached from a smoke that stays out of the worker. (ii) The `unknown` and `-dirty`
revision forms rondo refuses are read from continuo's `src/about.ts`
(`REVISION_PATTERN = /^(?:[0-9a-f]{40}(?:-dirty)?|unknown)$/`); rondo did not produce them, and the
refusals are exercised against fixture lines in `test/continuo/pin.test.ts` instead. (iii) That
`measure report` carries no envelope on any path is read from `src/measurement/cli.ts`, which never
calls `successLine` or `refusalLine`.

**The revision is the identity, not the version.** `--version` reports `0.0.0` because continuo is
unpublished, so a rondo that compared versions would compare a constant (D-0015 says this); rondo
compares the whole line and records the revision out of it.

**The two exceptions D-0015 named are unchanged**, and both were re-run at this sha:

```
run close --db <db> --run-id r1 --outcome bogus --actor-id op1 --json
  ->  exit 2, stderr is PROSE:
      usage: continuo run close [-h] --db DB --run-id RUN_ID --outcome {completed,failed,cancelled} ...
      continuo run close: error: argument --outcome: invalid choice: 'bogus'

run admit ... --workspace relative/ws ... --json
  ->  exit 1, stderr is a raw stack (LapRunIntentUsageError)
```

So the decoder still needs the prose fallback at exit 2, and rondo still validates operator-supplied
values before spawning. Neither is affected by `gate close` joining the envelope.

**Non-ASCII, on the path rule 7 is about**: continuo's envelope encoder escapes it
(`"db":"/tmp/日本.sqlite3"`), and the prose paths do not. rondo escapes at its own boundary
either way, because which path a message came down is not a property rondo wants to have to know.

**The smoke, as a test, run for real against this build:**

```
RONDO_CONTINUO_CLI=<abs>/dist/cli.js npx vitest run
  ->  6 files, 134 tests, all green; the end-to-end case takes 581 ms for six subprocesses
CI=true npx vitest run test/continuo/smoke.test.ts   (variable unset)
  ->  FAILS: "RONDO_CONTINUO_CLI is not set under CI ... the end-to-end smoke is not optional there"
npx vitest run test/continuo/smoke.test.ts           (variable unset, not CI)
  ->  1 skipped: "[skipped: RONDO_CONTINUO_CLI is unset; point it at a built continuo dist/cli.js at 44f6...]"
```

### What this entry does not decide

- **Which continuo verbs rondo will drive from its own surfaces.** The layer decodes five; D-0015's
  table of eleven is unchanged, and adding a verb is adding a contract, not taking a decision.
- **Where the observed revision is persisted**, which needs a store schema (rule 5 above).
- **How rondo validates each operator-supplied value.** D-0015 already requires it in general; the
  invoker refuses an empty argument before spawning, and the per-field rules belong with the code
  that builds an intent from a person's request.
- **Whether the pin moves on a schedule.** Moving it is an edit to the manifest, the mirror and the
  recorded version line together, and a green matrix is what says the move is safe.

### What would falsify it

- **A `continuo.<verb>/2` envelope, or a driven verb arriving without `--json`.** The first makes
  the decoder's single-version assumption wrong and needs a decision about handling two; the second
  reopens exactly the gap rule 1 has just closed.
- **continuo publishing to a registry** (`continuo D-0045`), which reopens D-0015's option
  comparison and, with it, whether this layer is a subprocess adapter or a library adapter. The
  layer and its arrows survive that; the invoker is what would not.
- **The pinned build reporting `unknown` or `-dirty` on a runner in the matrix**, which would mean
  `CONTINUO_REQUIRE_REVISION=1` on a clean detached clone does not hold somewhere — the Windows
  cells being the ones this was not measured on locally.
- **`better-sqlite3` ceasing to ship a prebuild for a matrix platform**, which would make
  `npm ci --ignore-scripts` insufficient to provision continuo and force a decision between a
  lifecycle script, a prebuilt artefact and a narrower matrix.
- **The provisioning step's network access becoming unavailable in CI**, which would make artefact
  delivery a decision rather than an implementation detail. The smoke's own execution reaches no
  network, so only provisioning is exposed.
- **A protocol refusal reaching an operator in practice**, which would mean the pin and the running
  build had diverged without the startup check catching it, and would make the check the thing to
  re-argue rather than the decoder.
- **continuo changing the meaning of an existing field without moving to `/2`.** This is the
  accept-extra-keys rule's own falsifier and the one thing rondo's tolerance structurally cannot
  detect: an added key is what `/1` promises, and a *redefined* key looks identical to a decoder.
  Nothing on rondo's side catches it, and this entry says so rather than implying the decoder is
  total.
- **A second module in `src/continuo/` needing to start a process**, or the invoker needing
  `execFile`, `fork`, `spawnSync` or `node:worker_threads`. Rule 3's claim is about reaching a
  process, not about one module name, and the grant is per binding — so any of those is a decision,
  in D-0005's shape.
- **`src/refrain/` needing to drive a verb itself**, which falsifies rule 2's arrow and reopens
  whether the loop is a pure planner.
- **`closeOpenGate` admitting a non-human actor kind**, or `gate close` gaining an actor argument
  that is not a person. That falsifies D-0013 first and reaches rule 1 second.
- **The store schema arriving and the observed revision still not being persisted.** This is the
  falsifier for rule 5's deferral, and it is what stops "left to the store" from becoming permanent
  by silence.
- **A build whose `--version` is right and whose `dist/` is not** — the residual this entry accepts.
  Verification proves that *this build reports the pinned revision*, not that *this build was
  produced from the pinned tree*; a tampered or half-rebuilt `dist/` passes. Closing it would need
  a hash of the artefact, which is a decision this entry does not take.
- **The mandatory smoke going red for a reason that is continuo's or the network's rather than
  rondo's.** Rule 6 accepts that cost deliberately; a recurrence means it was bought too dear, and
  the answer is a provisioned or cached artefact, not a skip.
- Any measurement above failing to reproduce. Toolchain `node v22.17.0` / `npm 10.9.2`; continuo at
  `44f62336108b86cab5da791111ffa0e5b73cd01a`.

---

## D-0018 — cadenza becomes a library rondo consumes: a vendored tarball under cadenza's delivery bridge, one facade, and a smoke that runs in every cell

**Status:** accepted (2026-09-06, rondo's human gate)

> **Annotation (2026-09-06, from D-0019).** Added under the annotation rule in "How to use this
> file"; nothing below is removed or rewritten. **Rule 5's trigger fired and the arrow was taken.**
> Rule 5 left `src/refrain -> src/cadenza` unbuilt and said "the arrow arrives when conductor code
> consumes the facade"; D-0019 is that code — the conductor's `classify` state consumes
> `resolveProject`, `agentTypeRecord`, `issueInitialContract` and `classifyAction` — and the arrow is
> now in the boundary table. **Rule 7 is untouched**: `delegate` and `adopt` are still not imported,
> and D-0019 rule 15 records the `needs_approval` dead end that follows from it as a lap-1 reduction
> rather than working around it.

**This entry supersedes D-0001 and D-0016.** Both keep their IDs and their text; both gain
`Status: superseded by D-0018`. Two entries rather than one, because the change falsifies a claim in
each and the claims are not independent:

- **D-0001 item 1** — "rondo takes no npm dependency on either sibling ... adding one for
  `@suisya-systems/continuo` or `@suisya-systems/cadenza`, *in any specifier form*, supersedes this
  entry rather than merely extending it." A committed tarball referenced as
  `file:vendor/suisya-systems-cadenza-0.0.0.tgz` is an npm dependency, and the absence of a
  `dependencies` block was part of what that entry decided. D-0001 wrote its own supersession rule
  and this is it being obeyed, not stretched.
- **D-0001 item 3 and the whole of D-0016** — "cadenza is not consumed at all in lap 1". D-0016
  rested that on two facts, and **both have changed** — though not in the same way, and the
  difference is worth stating precisely:
  - `cadenza D-0034` put the agent-type record on the exported surface. That is **D-0016's second
    falsifier, fired by name**.
  - `cadenza D-0035` accepted a delivery route for a consumer that installs with
    `--ignore-scripts`. That is **not** one of D-0016's five falsifiers, and reading it as one would
    misread it: D-0035 leaves publication untaken and refuses `prepare` deliberately, and those are
    the two D-0016 listed. What D-0035 changes is the *cost* half of D-0016's argument — "any route
    would make rondo responsible for building or hosting a dependency it does not own" — because the
    route is now a documented procedure cadenza owns and answers for rather than one rondo would
    have invented. The falsifier that fired and D-0001 item 1's own rule are what carry the
    supersession; D-0035 is why the answer this time is yes rather than merely possible.

**What survives, unchanged and unmoved.** D-0001 items 2 and 4 are not touched by this entry:
continuo is still consumed across a **CLI process boundary**, and rondo still **records which
continuo revision it drove**. Both were re-argued at the current sibling revisions in **D-0015** and
implemented in **D-0017**, which are where those two claims now live; superseding D-0001 as a whole
does not retire them, and nothing in this entry is a licence to reopen them. The single change here
is about cadenza.

### Decision

1. **rondo consumes cadenza as a library in lap 1.** It is a runtime dependency, imported by package
   name, and the values rondo takes from it are G1 project resolution, the agent-type record, the
   delegation contract's initial issuance, and classification.
2. **Delivery is cadenza's accepted bridge (`cadenza D-0035`, `docs/artifact-delivery-bridge.md`),
   form 2a**: the tarball is built once by a person in a scratch clone and **committed**, and
   nothing is rebuilt afterwards. What is committed is the list that page calls its contract —
   `vendor/suisya-systems-cadenza-0.0.0.tgz`, `vendor/cadenza.tgz.sha256`, `vendor/pin.mjs`, the
   source pin, `package.json` and `package-lock.json`. `@suisya-systems/cadenza` is rondo's **first
   runtime dependency**; the `dependencies` block did not exist before this entry.
   Form 2b — rebuilding in CI to avoid a vendored binary — is refused: it requires `npm pack` to be
   byte-identical on the runner, which cadenza measured on one Linux machine and explicitly did not
   measure across platforms, and rondo's matrix has a Windows cell.
3. **Three different facts are pinned in three different places, and none of them stands in for
   another.**
   - `cadenza.pin.json` — repository plus the **full commit sha**: what was *meant* to be built.
   - `vendor/cadenza.tgz.sha256` — which **bytes rondo carries**.
   - `package-lock.json`'s sha512 `integrity` — which **bytes npm installs**.
   `test/cadenza/pin.test.ts` requires all three to describe one file. **No cadenza version is
   recorded**, and its absence is asserted: cadenza has no `--version` and every build of every
   revision is `0.0.0`, so a version line here would be a fact rondo invented. This is the one place
   this entry differs in shape from D-0017's continuo pin, whose seam *does* report a revision rondo
   can verify at startup.
4. **The digest check runs immediately before every install** — `node vendor/pin.mjs check` before
   each `npm ci --ignore-scripts`, in all three of CI's installing jobs and in the local sequence
   README and AGENTS document. Not as a test afterwards: npm enforces integrity against its cache,
   so a drifted tarball is `EINTEGRITY` on a cold cache and a **silent install of the previously
   pinned bytes** on a warm one. The check is cache-independent and names both digests. It is Node
   rather than `sha256sum`, which is GNU coreutils and absent on the Windows cell.
5. **One new layer, `src/cadenza/`, self-only, with exactly one module granted the package.**
   `src/cadenza/facade.ts` imports `@suisya-systems/cadenza` and is granted it **binding by
   binding** in `test/architecture/import-boundaries.test.ts`; a second module in the layer is not
   granted it, no other layer is granted it at all, and a deep path into the package is not granted
   even to the facade. `src/refrain -> src/cadenza` is **not** added: the arrow arrives when
   conductor code consumes the facade, as that change's decision. Planted cases prove each refusal.
   The grant is per binding for a reason larger than convention: cadenza exports 80 values,
   including `delegate` and `adopt`, and a grant of "the package" would have been a grant of those.
6. **The smoke goes through the facade, with in-memory fixtures, in the ordinary suite.**
   `test/cadenza/smoke.test.ts` resolves a G1 project fixture, builds the agent-type record, issues
   an initial contract through `contractInputForAgentType` + `delegationContract`, and classifies one
   deterministic action, asserting the exact outcome, reason and `contract_digest`. It imports the
   package nowhere: a test that did would exercise the tarball and not rondo's boundary. Because it
   needs no filesystem, clock or process, it runs in **both seeded runs of every matrix cell** —
   which is what makes it the check that the vendored artifact works on Windows and on Node 22 and
   24. The vocabulary is read off the record's `vocabularyVersion`, never off a "latest version"
   constant: cadenza classifies against the vocabulary the contract pinned (`cadenza D-0027`), and a
   smoke hard-coded to `VOCABULARY_VERSION_1` would test the fixture instead of the mapping.
7. **`classify()` is an answer rondo reads, and never a second enforcement mechanism.** It is pure
   and total; it stops nothing (`cadenza D-0026` section 2). **Initial issuance is in scope;
   approval-driven supersession is not**: `delegate` and `adopt` are deliberately not imported, and
   the smoke answers `needs_approval` by reading it and stopping. Composing a widening successor is
   how rondo would come to answer its own gate, which **D-0009** forbids and this entry does not
   relax.

### What was measured, and how

**2026-09-06**, toolchain `node v22.17.0` / `npm 10.9.2`, against cadenza
`e56d7e71981232d19120d20ba6b920a5c4d762dc` — the commit that implements and exports the agent-type
record (`cadenza D-0034`). The sibling checkouts at `<workers>/cadenza` and `<workers>/continuo`
were strictly read-only and verified untouched afterwards; the bootstrap happened in a **scratch
clone outside the repository**, which is not committed.

Phase 1 of the bridge, run once:

```
git clone https://github.com/suisya-systems/cadenza.git <scratch>
git -C <scratch> checkout e56d7e71981232d19120d20ba6b920a5c4d762dc
git -C <scratch> rev-parse HEAD     ->  e56d7e71981232d19120d20ba6b920a5c4d762dc
npm --prefix <scratch> ci --ignore-scripts   ->  added 133 packages
npm --prefix <scratch> run build             ->  exit 0  (clean, then tsc -p tsconfig.build.json)
git -C <scratch> status --porcelain          ->  (empty)
npm pack <scratch> --pack-destination vendor ->  suisya-systems-cadenza-0.0.0.tgz
                                                 128 files, 131683 bytes
node vendor/pin.mjs record
npm install --ignore-scripts ./vendor/suisya-systems-cadenza-0.0.0.tgz   ->  added 1 package
```

What that wrote and what rondo now carries:

```
package.json    "@suisya-systems/cadenza": "file:vendor/suisya-systems-cadenza-0.0.0.tgz"
lockfile        resolved  file:vendor/suisya-systems-cadenza-0.0.0.tgz
                integrity sha512-fopGJqOvjAfoTggFEghY8JSvg+cjup3HMKtPz9YBrc4Zd00Xqu0iAaq0tvHB+lZI7RBk8oJL3tFtccAJLz6MTg==
vendor/cadenza.tgz.sha256
                30233f2ff0ca9f2e406f1c5ce9a946ed2e67c5726dda32b8520591c87308a3c2
```

The sha512 in the lockfile is the sha512 of the committed tarball, and the sha256 file is its
sha256; both are recomputed from the bytes on every test run rather than compared to each other's
copy. `smol-toml@1.8.0` — cadenza's one dependency — moves from a development dependency to a
runtime one in the lockfile, which is the whole of the transitive cost.

**The surface, re-inventoried.** D-0016 measured **70 exports** and recorded that the record rondo's
own entries lean on was not among them. At this revision the same measurement — the runtime values
an `import()` of the package hands back — answers **80**. Six of them are the agent-type record and
its renderer: `agentType`, `agentTypeDigest`, `agentTypePayload`, `isAgentType`, `requireAgentType`
and `contractInputForAgentType`, beside the types `AgentType`, `AgentTypeInput` and
`IssuanceParties`, which are erased at runtime and are therefore in neither count. That is D-0016's
second falsifier, fired by name.

**What the smoke observed** against the installed tarball, and what it now asserts as literals:

```
resolveProject(...)        configDigest   sha256:1f8cf5916c3a68f63700bc9fb5a99f8f1ce94b336468843459019095590a1427
delegationContract(...)    contractDigest sha256:15475d4c7a5fe2436f9f35ad70155f7e06ef5d20cb59b9dc1a6c079d8145b39c
classify(command.run)      -> { outcome: "allowed",        reason: "granted" }
classify(branch.push)      -> { outcome: "needs_approval", reason: "askable" }
```

`npm ci --ignore-scripts && npm run verify` is green.

### What this buys, and what it does not

**It buys the thing D-0016 said was missing.** rondo's D-0009 … D-0014 restate cadenza's rows in
rondo's own words, and D-0016's third falsifier was rondo needing a value it cannot restate. The
agent-type record and `contract_digest` are exactly that: a digest is only worth persisting if it is
the digest cadenza computes, byte for byte, and a rondo-side reimplementation would be a second
canonical-JSON encoder with no rule for which one is right. Consuming the library is what makes
"under what contract did this run" answerable by comparing values rather than by trusting two
implementations to agree.

**It does not buy provenance, and the bridge says so.** npm proves the installed bytes are the bytes
rondo committed. Nothing here proves those bytes were built from
`e56d7e71981232d19120d20ba6b920a5c4d762dc`: the chain from that sha to this tarball is the procedure
above and the person who ran it. That gap closes with publication and not before, and recording it
is the honest version of rule 3 — the source pin is a **claim about intent**, the two digests are
**facts about bytes**, and conflating them would be inventing a guarantee.

**It is not a general licence to import cadenza.** Rule 5 is what keeps that literal: one module, a
named list of bindings, no arrow from the loop yet. A second consumer is a diff in the boundary
test, which is where the question "should this layer reach cadenza?" is asked.

### What would falsify it

- **cadenza publishing to a registry.** The bridge is written to be thrown away: publication
  replaces the vendored tarball, `vendor/pin.mjs`, the sha256 file and the source pin with an
  ordinary pinned version and a registry-enforced integrity hash, and this entry's rules 2, 3 and 4
  go with them. Rules 5 to 7 do not.
- **The vendored tarball failing on a matrix cell** — an install, an import, or a `tsc --noEmit`
  that resolves the declarations on ubuntu and not on windows, or on Node 22 and not on 24. Rule 6's
  smoke is what would report it, and the answer would be a delivery decision rather than a patch.
- **A value rondo needs that is not on the barrel.** `cadenza D-0033` makes the barrel the surface
  cadenza is answerable for, and `cadenza D-0029`'s own falsifier is a host having to reach past it.
  A deep path is refused here by the boundary test as well as by cadenza's `exports` map.
- **rondo needing to compose a successor contract.** Rule 7 scopes this entry to initial issuance.
  Supersession is a new decision at rondo's gate, and it has to answer D-0009 first, not this entry.
- **`src/refrain` needing the facade**, which is the arrow rule 5 leaves unbuilt. Expected, and a
  decision in its own diff rather than a widening of this one.
- **cadenza acquiring a `prepare` script, changing its `exports` map, or moving what `agentType()`
  digests.** The first two change what a route delivers; the third moves the literals the smoke
  asserts, and that failure is the correct one — it says the vendored artifact computes something
  different.
- **The digest check ever being moved after an install, or dropped from a job that installs.** Rule
  4 is a sequence, not a step, and `test/cadenza/pin.test.ts` fails when the sequence breaks.
- Any measurement above failing to reproduce. Toolchain `node v22.17.0` / `npm 10.9.2`; cadenza at
  `e56d7e71981232d19120d20ba6b920a5c4d762dc`.

---

## D-0019 — The first working conductor loop: a pure planner, an interpreter over injected ports, a durable single-flight store, and a suspend at the open gate

**Status:** accepted (2026-09-06, rondo's human gate)

> **Annotation (2026-09-06, from D-0021).** Added after this entry was accepted, and additive: no
> claim, measurement or date below is edited. This entry's falsifier **"continuo's `run admit` or
> `lap perform` flag set changing" fired**, in the ordinary way rather than the alarming one --
> `lap perform` grew two optional flags and one answer field, and `run admit` is untouched. Three
> statements below now read a revision behind, and **D-0021** is where each is answered:
>
> - **rule 12 (`R-11`) says rondo passes two budgets explicitly.** It passes **three**:
>   `--identity-readback-timeout-ms` joined them (`continuo D-0098`), and `invocationCeilingMs`'s
>   floor is `turnTimeoutMs + gitTimeoutMs + identityReadbackTimeoutMs`. The reasoning is this
>   rule's, unchanged; the count is one larger.
> - **rule 14 (`R-13`) says `LAP_PERFORM` reads eleven fields.** It reads **twelve**: `model`, added
>   under the same `/1` by `continuo D-0099`, always present and nullable. The `/1` policy this rule
>   states is what made that a decoder addition rather than a break.
> - **rule 13 (`R-12`)'s neighbour.** The role table is untouched and continuo's roster is still the
>   same four names; `src/continuo/roles.ts` gains a **second, independent** table -- the model tier
>   -- and the module is an executor-policy adapter rather than a role adapter.

This entry records the outcome of the sixteen decision rows `R-1` … `R-16` that
[`docs/design/refrain-lap1.md`](docs/design/refrain-lap1.md) put to the gate. **Every row was taken
exactly as its recommendation column reads**, so the reasons below are that document's and are
summarised rather than restated; the design document is the measurement record and this entry is the
decision. The document was written propose-only and named this entry by number in advance; it is
now the thing it referred to.

**It supersedes nothing.** Under `R-1` the loop reaches continuo through injected ports rather than
by an import, so `D-0017` rule 2's arrow table gains one arrow — `src/refrain -> src/cadenza`, which
is `D-0018` rule 5's arrow and not `D-0017`'s claim — and all eleven of `D-0017`'s rules stand as
written. `D-0015` and `D-0018` likewise stand. Three earlier entries gain **dated annotations**, and
they are recorded at the end of this entry.

### Decision

1. **`R-1` — the loop reaches continuo through injected ports; the only new arrow is
   `src/refrain -> src/cadenza`.** `src/refrain/ports.ts` declares `ConductorPorts` in refrain's own
   vocabulary — a store port, a clock, and four effect ports (`startContinuo`, `admitRun`,
   `performLap`, `showGate`) — and no module under `src/refrain/` imports `src/continuo`. The
   cadenza facade owns no capability; the continuo layer owns a process. `D-0017` rule 2's stated
   purpose — the loop stays testable on a machine with no continuo on it — survives the port and
   dies under the arrow, and `test/refrain/` is written on injected fakes with no continuo build, no
   `spawn` and no network.
2. **`R-2` — the composition root is a module in `src/access`.** `src/access/conductor.ts` is the
   only module that imports both the interpreter and the continuo adapter, and it is where the
   `resume(iterationId)` and `abandon(iterationId, reason)` entry points the operating surface calls
   live. No new layer: `src/access` is already the only layer permitted to see the loop, the store
   and the continuo seam, and `D-0009` and `D-0013` already put the human-facing verbs there.
3. **`R-3` — the caller passes a complete `RunPlan`; rondo gains no allocator and no configuration
   layer.** `RunPlan` is declared in `src/refrain/plan.ts` with a validating constructor, carrying
   every field `run admit` and `lap perform` require, the five inputs the cadenza facade needs, and
   `invocationCeilingMs`. The conductor receives one and never invents a field. The two things rondo
   would otherwise have had to build are the identifier allocator `D-0012` records as an open
   decision, and defaults for a fence's geometry continuo requires be absolute and outside the
   worktree; both are decisions, and `AGENTS.md` section 7 forbids taking one inside an
   implementation diff.
4. **`R-4` — the store persists the plan verbatim beside its `plan_digest`.** A digest detects change
   and does not hand back the plan a past run used, and continuo persists the admitted intent rather
   than the executor paths or the agent type, so rondo's row is the only place "under what plan did
   this run happen" is answerable. The plan is persisted as the canonical-JSON payload
   `src/refrain/plan.ts` renders and re-reads; `src/store/plan.ts` digests those bytes.
5. **`R-5` — the loop suspends at `awaiting_human` and returns; `resume(iterationId)` is a separate
   entry point.** After `lap perform` answers, the gate id and everything else learned is committed,
   the iteration transitions to `awaiting_human`, and the interpreter returns: no timer, no poll
   loop, no in-memory continuation, and the process may exit. `resume` drives **one**
   `gate show --json` and reads `outcome`: non-null transitions the iteration to `closed`, null
   changes nothing and says so, which makes `resume` idempotent and safe to call from a surface that
   cannot be sure. `resume` serves `withdrawal_requested` on the identical observation, so that state
   is not a state with no way out. rondo drives none of `gate present` / `deliver` / `ack` / the
   answer, and never closes a gate (`D-0013`; `closeOpenGate` hard-codes `actorKind: "human"`).
6. **`R-6` — the graph's discipline, and no graph runtime.** Named states, an explicit and closed
   edge relation, and a durable checkpoint at every node; no second runtime dependency. The graph's
   distinguishing feature is fan-out, which continuo refuses upstream through the single global
   `outbox-delivery` lease (`D-0012`), and its back-edge needs the allocator `D-0012` says does not
   exist — so in lap 1 the loop executes each edge at most once.
7. **`R-7` — evaluation stays in three deterministic positions and no model judge is admitted.**
   cadenza's `classify()` before admission, the conductor's own verify (out of scope — rule 15), and
   the human at a continuo gate. A model-judged evaluator would put a non-deterministic verdict on
   the path to the one human contact this design rations, could not be a unit case, and its most
   valuable output is the retry the lap-1 arc cannot perform.
8. **`R-8` — `nextStep` stays total and pure; a separate async interpreter executes effects.**
   `src/refrain/interpreter.ts` is the only asynchronous module in the layer, holds no state of its
   own, and imports no external module because its effects arrive as parameters. Every persisted
   state and every effect result is a discriminated union and the interpreter's `switch` over them is
   exhaustive, which under `D-0002`'s strictness is a compile error when a variant is added and not
   handled. **Anything the interpreter cannot classify halts and asks**: an unknown status string, a
   row whose fields do not read, an effect result the union does not cover, all transition to
   `stalled` with the reason and none proceeds. Not `awaiting_human`, which is reserved for an open
   gate.
9. **`R-9` — both policy axes are read exactly once, before `reserve()`, and have no second
   reader.** They are enforced as an **admission** policy: `ask_every_iteration` refuses the request
   before a row exists, and `maxIterations: 0` does the same, because the ceiling is compared against
   a fresh iteration's zero attempts. What is dormant is their **post-admission** meaning, and that is
   dormant for `D-0012`'s reason — with one lap per request `maxIterations` never bounds a second
   iteration because there is never one, and `ask_before_landing` never permits an unattended landing
   because rondo cannot land at all (`D-0010`). `CONSERVATIVE_POLICY` stays the default and stays
   correct, and the interpreter requires an explicitly-constructed policy to proceed. The policy is
   consulted **before** reservation, so a policy stop costs no row and takes no lock. cadenza's own
   `LoopPolicy` — `maxReviewRounds`, `noProgressWindow`, `noProgressRepeat` — is carried on the
   agent-type record, digested, and read by nothing in lap 1.
10. **`R-10` — `reserve()` and `transition()` with `BEGIN IMMEDIATE`, and a partial unique index
    making "at most one non-terminal iteration" the database's invariant.** `IterationStore`'s
    `read`/`write` pair is replaced. `reserve(...)` opens `BEGIN IMMEDIATE`, inserts the `planned`
    row with the plan and its digest, and commits, or reports that a non-terminal iteration already
    exists. `transition(id, from, to, fields)` opens `BEGIN IMMEDIATE`, asserts the current status is
    `from`, writes, and commits; a transition from an unexpected state is refused rather than
    applied. `BEGIN IMMEDIATE` rather than a deferred transaction for the reason continuo gives on
    its own admission path: under a deferred transaction the write lock is taken at the first write,
    which leaves a window where two readers both believe they may proceed. The index is **shape B** —
    a virtual generated column `live` that is `NULL` for a terminal status and `1` otherwise, with
    `CREATE UNIQUE INDEX ... ON iteration(live) WHERE live IS NOT NULL` — because the index is over a
    named column a reader can `SELECT` and the terminal set is written once rather than repeated in
    every partial index that later wants it.

    **The "one" is a lap-1 reduction, not the shape rondo is aiming at.** The target is parallel
    delegated work at least equal to what the present human organisation already runs concurrently;
    single-flight is what lap 1 can defend, not what the host is for. **The route from one to N is a
    capacity ledger, not a wider index**: the three conditions `D-0012` names — an allocator for the
    (run id, topic branch, workspace) triple, continuo's lap-level serialisation lifting, and a
    bound somebody sets and something enforces — have to be answered before a second admission is
    safe, and they are tracked as **rondo#8** and **continuo#167**. Until then the invariant is a
    constant of one; afterwards the unique index is replaced by a ledger that counts against that
    bound, and the index name `iteration_one_live` and `reserve()`'s refusal are the two places the
    constant is burned into the schema. Both carry a comment naming rondo#8, so the replacement sites
    are findable by `grep` rather than by reading this entry. **The falsifier is explicit: the first
    time a second concurrent admission is actually needed**, this rule's "one" is wrong and the
    ledger is the decision that replaces it.
11. **`R-10`, second half — every non-terminal status carries a named releasing event, and
    `abandon()` is the last row of the paths that cannot end themselves.** Under the unique index a
    non-terminal state nobody can leave is a conductor that never runs again, so this table is the
    design's real safety property and is asserted as a case per row in `test/refrain/`:

    | non-terminal status | what releases it | goes to |
    |---|---|---|
    | `planned` | the interpreter, immediately | `classified`, or `abandoned` on `refused` / `needs_approval` |
    | `classified` | the interpreter, immediately | `admitting`, or `failed` when the build cannot be verified |
    | `admitting` | `run admit` answering | `admitted`, or `failed` on a refusal |
    | `admitting`, with no answer | an operator's `abandon()` | `abandoned` |
    | `admitted` | the interpreter, immediately | `performing` |
    | `performing` | `lap perform` answering | `awaiting_human`, or `failed` when the answer is a refusal |
    | `performing`, with no answer | an operator's `abandon()` | `abandoned` |
    | `awaiting_human` | `resume()` observing a non-null gate outcome; or the abort edge | `closed`, or `withdrawal_requested` |
    | `withdrawal_requested` | `resume()` observing a non-null gate outcome | `closed` |
    | `stalled` | an operator's `abandon()` | `abandoned` |

    `abandon(iterationId, reason)` writes a terminal row and **drives no continuo verb**: if a gate
    is open, closing it is `D-0013`'s ask, and if a run is open, closing it is `D-0010`'s operator.
    A `performing` iteration that **received a refusal** releases the lock and a `performing`
    iteration that **received nothing** does not, and the difference is not how bad the outcome was —
    it is whether anything might still be running.
12. **`R-11` — per-verb timeouts, explicit continuo budgets, an operator-set ceiling, and no
    cancellation.** The timeout moves onto `VerbContract` beside the schema and the reader; the five
    existing verbs keep 60s. rondo passes `--turn-timeout-ms` and `--git-timeout-ms` explicitly, so
    the numbers rondo reasons about are the numbers in force. rondo's own ceiling on the whole
    `lap perform` invocation is **`invocationCeilingMs`, a `RunPlan` field the caller sets**,
    validated as strictly greater than `turnTimeoutMs + gitTimeoutMs` — a floor, not an estimate —
    because the turn timer is not the whole invocation and the count of git operations is not a
    number rondo can know from outside. rondo's timer kills the CLI and not the fenced child, so
    **rondo's ceiling firing is reported as a rondo defect requiring a human, never as a lap that
    failed**, and the row stays `performing`. Cancellation of a lap in flight is not offered in lap 1,
    and that is recorded as a reduction.
13. **`R-12` — a typed `admitRun` owns the mapping, the refusal and the argv; the role table is the
    identity over continuo's four roster names.** No caller ever names a continuo role or spells a
    flag (`D-0014` rule 1). cadenza's `executorPolicy.roleName` is validated *structurally* only — any
    identifier matching "a lowercase letter followed by up to 63 of `[a-z0-9_-]`" — and cadenza states
    it does not know which roles exist; continuo's roster is exactly four names read off the bundled
    `src/fencing/roles.json` at the pinned revision. So the domain is open and the codomain is four:

    | cadenza `executorPolicy.roleName` | continuo role |
    |---|---|
    | `worker` | `worker` |
    | `curator` | `curator` |
    | `dispatcher` | `dispatcher` |
    | `secretary` | `secretary` |
    | anything else | **refused**, before admission, as rondo's own vocabulary error |

    The identity mapping is the honest lap-1 table because rondo has no agent types yet and will mint
    the first ones itself; recording it as a table anyway is what makes the *second* executor a change
    to one file (`D-0014` rule 3). The table is asserted in both directions — every key maps to a name
    in the recorded roster, every roster name is reachable, and an unmapped name is refused **without
    a spawn**. What no test on either side catches, and `D-0014` says so already, is a *mis-mapping
    onto a valid role*: continuo's check is `roster.includes(role)` and nothing more.
14. **`R-13` — `lap perform` gets a decoder, and no `--cli-arg` field exists anywhere in the lap-1
    API.** `LAP_PERFORM` joins the five contracts in `src/continuo/protocol.ts` with
    `schema: "continuo.lap.perform/1"`, read off continuo's source rather than assumed, and reads
    eleven fields: `run_id`, `workspace`, `topic_branch`, `base_commit`, `session_id`, `session_path`,
    `gate_id`, `event_id`, `event_seq`, `endpoint_lease_failure` and `elapsed_deadline_at_ms`.
    `session_path` is the walk's own name (`started` / `respawned` / `resumed`) and **not a filesystem
    path**, and rondo's record names it so. `endpoint_lease_failure` is an object or null and is
    always present, so a `nullableObject` reader joins `nullableString` and `nullableNumber` under the
    absent-is-not-null rule. Semantic validation happens **before the spawn**: absolute paths where
    continuo requires absolute paths, a run id that is non-empty and carries no whitespace, an
    `--endpoint-recipient` that is one of continuo's `choices`, and branch names that are not
    option-shaped. `D-0011` rule 1 admits with no `--cli-arg`, continuo's own allowlist is
    `{"entries": []}` at the pinned revision, and a field that could carry one would be a place for a
    later change to put one without an entry.
15. **`R-14` — admission-time classification is in lap 1, and both stopping branches are terminal.**
    At the `classify` state the facade resolves the project, builds the agent-type record, issues the
    initial contract and classifies the intended action, and the three digests and the outcome are
    committed. `refused` ends the iteration at terminal **`abandoned`** with cadenza's own reason;
    `needs_approval` does the same, **before** admission, rather than admitting and then asking.
    Spelling `needs_approval` as `awaiting_human` would be wrong twice: there is no gate for `resume`
    to observe, and the status is non-terminal, so the first askable request would hold the
    single-flight lock with no event able to release it. **Recorded as a lap-1 reduction:** resuming a
    `needs_approval` requires a widening successor contract, which rondo may not compose (`D-0009`
    part 2, `D-0018` rule 7 — `delegate` and `adopt` are not imported at all), so in lap 1 that branch
    is a dead end, the human is told why, and asking again is a new iteration. **Its trigger:** the
    first time a human wants to approve one, `D-0009`'s successor path becomes lap-1 work and this
    reduction is wrong.
16. **`R-15` — the conductor's own verify is not in lap 1, recorded as a reduction with its
    trigger.** The gate is *already open* by the time rondo could verify, so a failing verify's only
    available action is to ask the operating surface to withdraw the gate — the same action a human
    reading the gate would take. Half-building it would put an untested branch on the path to the one
    human contact. **Its trigger:** a lap whose gate is opened after rondo's own check rather than
    before it, or a verify verdict a human would act on differently from the gate's own contents.
17. **`R-16` — the test layering, and the full lap as a documented manual dogfood script.**
    `test/refrain/` uses injected fakes only and proves the order of the states, every refusal branch,
    persistence, restart from each state, the single-flight invariant, `withdrawal_requested` on
    abort, resume idempotence, and rule 11's table as a case per row. `test/store/` uses a real
    `node:sqlite` in-memory database and proves `reserve`/`transition` under `BEGIN IMMEDIATE`, the
    unique index refusing a second live row, and the write order. Real cadenza and real continuo stay
    confined to the two existing smokes, and `test/continuo/smoke.test.ts` still **must not drive
    `lap perform`** (`D-0017` rule 6: a test suite is not where an agent session belongs, and that job
    is mandatory in every matrix cell). The full lap is a **documented manual procedure** —
    `scripts/dogfood-lap.md` — rather than a `vitest` suite excluded from `npm test`, because a test
    file that is not run by the test command is a file whose greenness nobody can state.

### What this entry changes in the tree, beyond the sixteen rows

- **`src/refrain -> src/cadenza` is added to the boundary table**, and it is the only arrow added.
  `src/refrain -> src/continuo` stays refused, with a planted case that proves it.
- **`IterationStatus` grows from four to eleven.** Non-terminal: `planned`, `classified`,
  `admitting`, `admitted`, `performing`, `awaiting_human`, `withdrawal_requested`, `stalled`.
  Terminal: `closed`, `abandoned`, `failed`. **`running` is removed**, replaced by the three states
  that say *which* effect is in flight, because "running" is the one word that cannot be acted on
  after a crash.
- **`Step` grows and loses `iterate`.** The union is `reserve`, `classify`, `admit`, `perform`,
  `observe_gate`, `report`, `ask_human`, `rest`, which names the transitions of the lap-1 arc.
  `iterate` is removed because the back-edge it named does not exist in lap 1: a second attempt needs
  a fresh (run id, topic branch, workspace) triple that `D-0012` records nothing allocates. It returns
  with the allocator, as that change's decision.
- **`nextStep` takes `IterationRecord | null`.** `null` is "no iteration exists yet", and it is where
  rule 9's admission policy is read: a permitting policy answers `reserve` and a policy that says ask
  answers `ask_human`, which is what keeps a policy stop from taking the single-flight lock. Every
  behavioural claim the previous cases made — both axes read, the ceiling compared with `>=`, an
  unusable ceiling or attempt count stopping rather than freeing the loop, the conservative default
  asking — is preserved and re-pointed at the states that exist now. The design document's line that
  the previous cases "keep passing" unchanged was written before `running` was removed by its own
  section 7.1; the claims survive, the spellings do not, and this bullet is the correction.
- **`src/store/plan.ts` is granted `node:crypto`'s `createHash`**, by module and by binding, to
  compute `plan_digest` over the canonical-JSON payload. It is the third per-module capability grant
  in the tree, beside `node:sqlite` and the `spawn`. `src/refrain/` is granted nothing, and its
  external allowance stays empty — which is why the digest is the store's job and not the loop's.
- **A sixth `ContinuoResult` variant, `timedOut`.** rondo's own ceiling firing is not the same fact as
  a defect diagnosed after the child closed, and the single-flight invariant turns on the difference:
  an answer releases the lock and a silence keeps it (rule 11). Folding the two together would have
  let a second lap race an orphan.

### Annotations this entry adds to earlier entries

- **`D-0015` rule 6** deferred persisting the observed continuo revision per run to a store schema.
  **Discharged (2026-09-06, D-0019):** the iteration row carries the observed revision, and rule 10's
  write order commits it *before* `run admit` is spawned.
- **`D-0017` rule 5** left the durable half of provenance to "the issue that gives rondo a store",
  and named its own falsifier as "the store schema arriving and the observed revision still not being
  persisted". **Discharged (2026-09-06, D-0019):** the schema arrived and the revision is persisted.
  All eleven of `D-0017`'s rules stand; rule 2's arrow table gains `src/refrain -> src/cadenza`.
- **`D-0018` rule 5** left `src/refrain -> src/cadenza` unbuilt and named its trigger: "the arrow
  arrives when conductor code consumes the facade." **Fired and taken (2026-09-06, D-0019):**
  `src/refrain/` consumes `resolveProject`, `agentTypeRecord`, `issueInitialContract` and
  `classifyAction` at the `classify` state. Rule 7 is untouched: `delegate` and `adopt` are still not
  imported, and rule 15 above is why.

### What was measured, and at which revisions

**2026-09-06**, toolchain `node v22.17.0`, against rondo at this branch, continuo at
`44f62336108b86cab5da791111ffa0e5b73cd01a` — the revision `continuo.pin.json` pins — and cadenza at
`e56d7e71981232d19120d20ba6b920a5c4d762dc` — the revision `cadenza.pin.json` names. That the siblings
sit at exactly the pinned revisions is what makes the citations evidence about rondo's seam rather
than about somebody's checkout. The measurements themselves are
[`docs/design/refrain-lap1.md`](docs/design/refrain-lap1.md) sections 1 and 4 to 9, and its section
1.5 records the same two revisions. Two of them carry this entry's weight and are named again here:
both partial-index shapes and `BEGIN IMMEDIATE`'s cross-connection refusal were measured working on
`node:sqlite`, and continuo's `src/fencing/cli_args_allow.json` is `{"entries": []}`.

### What would falsify it

- **`D-0012`'s allocator arriving**, from either side. It is the trigger under almost everything
  above: the back-edge returns and `iterate` with it, the no-progress halt and the review-round budget
  stop being dormant, and the single-non-terminal invariant becomes a capacity question rather than a
  constant.
- **continuo's lap-level serialisation going away.** The "there is no fan-out" argument under rule 6
  dies with it, and the graph runtime is reopened on its merits.
- **cadenza#22 landing in a shape that cannot call into rondo.** Rule 5's resume trigger then falls
  back to an operator-invoked verb on the access point, which is strictly worse for the human and
  identical for the state machine.
- **`closeOpenGate` admitting a non-human actor kind.** That falsifies `D-0013` first and rule 5's
  abort edge second: the conductor could then terminate its own aborted gate, and
  `withdrawal_requested` has no reason to exist.
- **continuo's `run admit` or `lap perform` flag set changing.** `RunPlan` is a transcription of two
  argument lists at one revision; a required flag added upstream is a plan that no longer admits, and
  the failure would be an exit 1 with a stack rather than a refusal document.
  *(Annotation, 2026-09-06:* **fired** -- `lap perform` gained the optional `--model` and
  `--identity-readback-timeout-ms`. Optional, so no plan stopped admitting; both are taken
  explicitly in **D-0021**.*)*
- **A `continuo.lap.perform/2`**, or any of rule 14's eleven fields changing meaning without the
  schema moving. *(Annotation, 2026-09-06:* a **twelfth** field, `model`, was added under the same
  `/1` and is decoded in **D-0021**; none of the eleven changed meaning.*)* `D-0017`'s accept-extra-keys falsifier applies here unchanged, and rondo cannot
  detect the second case.
- **continuo's roster changing, or becoming a runtime input rather than a bundled document**, or an
  agent type whose role name is not one of the four. That is rule 13's table falsified, and it is
  `D-0014`'s own first falsifier.
- **`node:sqlite` losing either measured behaviour** — the partial unique index or `BEGIN IMMEDIATE`'s
  cross-connection lock. `D-0005` names the driver swap as its falsifier and rule 10 leans on both;
  they were measured on `node v22.17.0` only, and the matrix also runs Node 24 and Windows.
- **The `RunPlan` needing a field rondo has to invent** rather than receive. That is rule 3 failing in
  practice, and the answer would be the allocator or a configuration layer, not a default.
- **A `needs_approval` that a human wants to approve** (rule 15's own trigger), or **a verify verdict
  a human would act on differently from the gate's contents** (rule 16's).
- **rondo's ceiling firing in ordinary operation.** Rule 12 exists so it cannot happen in the ordinary
  case; the first time it does, `invocationCeilingMs` being the operator's declared patience rather
  than a computed bound is the thing to re-argue.
- Any measurement above failing to reproduce. Toolchain `node v22.17.0`; continuo at
  `44f62336108b86cab5da791111ffa0e5b73cd01a`; cadenza at `e56d7e71981232d19120d20ba6b920a5c4d762dc`.

---

## D-0020 — The operating surface's rondo-owned rows: gate panes first, the OIDC subject as `--actor-id`, LAN-first, and rondo's store as the home of the delegation record and the operator conversation

**Status:** accepted (2026-09-06, rondo's human gate)

**This entry decides and does not build.** cadenza's `docs/design/operating-surface.md` (merged in
cadenza PR #56) re-argues the operating surface against current measurements and ends in eleven rows,
of which it assigns **five to rondo's gate** — `cadenza S-4` … `cadenza S-8`. This entry takes all
five exactly as their recommendation columns read, so that the surface is designed against settled
answers rather than against open ones. **Nothing in `src/` implements the surface as a result of this
entry**: no OIDC adapter, no HTTP binding, no gate pane and no conversation store. The one thing
lap 1 does build is the `resume(iterationId)` entry point the conductor needs, and that is `D-0019`
rule 5's, sitting in the composition root of `D-0019` rule 2 — not this entry's rule 1.

The rows cadenza kept for its own gate — `cadenza S-1`, `S-2`, `S-3`, `S-11` — are not rondo's and
are not taken here.

### Decision

1. **`cadenza S-4` — keep layout B as the endpoint and build the gate panes first.** The first cut is
   the gate list, the gate detail, and the two write verbs the human needs (`answer`, and
   `close --outcome withdrawn`); the conversation pane arrives when rule 5 is built. This inverts
   cadenza#22's build order without reversing its direction: B was always the endpoint, and #22's own
   reason for starting with A — "both read the same data model, so promoting A's cards into B's centre
   column later is a small change" — is unaffected, because what changed is *which half has a data
   model today*. B's centre column ships already: `gate list --json` returns `gate_id`, `gate_type`,
   `run_id`, `stage`, `stage_entered_at_ms` and `deadline_at_ms` per gate, which is a decision-inbox
   row field for field, including the age the inbox sorts by. A's chat has no store in any of the
   three repositories. And `D-0009` puts this surface on the critical path of every gate, so the first
   thing built should be the thing that is blocking.
2. **`cadenza S-5` — the OIDC subject is passed as continuo's `--actor-id` verbatim; the *surface's*
   own identity is the contract `issuer`; and the approver set is an allowlist of OIDC subjects, of
   size one for lap 1, checked in rondo's application layer before any gate verb is invoked.**
   Authentication is delegated and never hand-rolled. The two identity fields answer two different
   questions — "who answered" and "which surface recorded it" — and collapsing them would lose the
   second. continuo records `--actor-id` on the word of whoever invokes the verb, so an identity the
   surface did not choose is the only thing that makes the field worth reading. Nothing in any of the
   three repositories bounds a *human* today — cadenza's contract bounds a run, whose `grantee` is a
   run id — so the allowlist is the smallest thing that makes cadenza#22's "access points multiply the
   surfaces, never the set of approvers" checkable rather than aspirational.
   **A precondition rides with this row and is taken with it: the redirect URI must be verified against
   the chosen provider before the auth adapter is written.** A provider that permits loopback redirects
   (`http://127.0.0.1`) does not necessarily permit a plain-HTTP redirect to a LAN address such as
   `http://192.168.x.x:port`, and answering a gate from a phone on the LAN is exactly the case that
   needs the second. No provider's current policy is measured or asserted here; discovering it after
   the adapter is written is the expensive order, which is why it is carried as a precondition rather
   than as an assumption.
3. **`cadenza S-6` — LAN-first stands, and the binding is decided explicitly, together with rule 2.**
   The argument is mechanical rather than dispositional: every source the console renders is a local
   file or a child process on the host — continuo's control plane is a SQLite file named by `--db`,
   rondo's durable store is `node:sqlite` in one module on the same host (`D-0005`), the gate relays
   are written into a dropbox directory on disk, and continuo is driven as a child process
   (`D-0015` rule 1). There is nothing to reach remotely, and external exposure would mean exposing a
   process that spawns child processes and holds a delivery lease. Whether the host binds the LAN
   interface directly or binds loopback with the LAN reached some other way is decided **with** rule 2,
   because the redirect constraint hangs off it.
4. **`cadenza S-7` — the delegation record is persisted in rondo's store, carrying all six facts.**
   Not continuo's `task` table: continuo states that neither `task` nor `assessment` has DDL and that
   they are "not designed by implication", and the issue that needs them is rondo's, in rondo's ledger,
   over values rondo mints from a library continuo does not consume. rondo already owns one SQLite
   module by decision (`D-0005`) and, as of `D-0019`, a schema for these facts to join. The six:
   1. **the contract's fields as issued** — `vocabularyVersion`, `projectId`, `configDigest`, `issuer`,
      `grantee`, `granted`, `askable`, `supersedes` — as fields rather than as a rendering of them, so
      `contract_digest` can be recomputed and checked rather than trusted;
   2. **`contract_digest`** beside them, so a mismatch is detectable rather than theoretical;
   3. **`agentTypeId` and `agent_type_digest`**, which cadenza is explicit do *not* enter
      `DelegationContract` and are run provenance the host persists beside it — if the host does not,
      "under what policy did it do that" stops being answerable, which is the property the digest exists
      for;
   4. **the superseded records themselves**, because agent-type records are immutable by minting a new
      one on every edit and durability is assigned to the store owner: a digest detects change and does
      not hand back the policy a past run used;
   5. **the lineage of contracts** (`supersedes` chains), so a successor issuance and its issuer check
      can be replayed against history rather than against the current head only;
   6. **the human-decision records and their single-use consumption**, *if* `cadenza S-1` is taken at
      cadenza's gate — the one rule cadenza structurally cannot enforce, because it persists nothing, so
      a decision replayed after the store has marked it spent is refused by the store or by nothing at
      all. This sixth fact does not exist today, because no widening has been issued yet, and rondo may
      not compose one (`D-0009` part 2, `D-0018` rule 7, `D-0019` rule 15).
   **`D-0019`'s iteration row is not this schema**, and the two must not be conflated: it persists the
   `RunPlan`, the three digests and the run's continuo provenance for *one* iteration. The delegation
   record above is a second schema in the same store, and writing its DDL is the work this row unblocks
   rather than the work this entry does.
5. **`cadenza S-8` — the operator conversation lives in rondo's store, and never in the slot that holds
   a gate answer.** cadenza#22 recorded it as undecided and its own cross-link claims cadenza#40
   answered it; cadenza#40's document does not — none of `conductor.md`'s seventeen rows is the
   conversation, and nothing in any of the three trees persists one. Two constraints ride with the
   answer: **a gate answer never lives in the conversation** — `gate_transition.body` is the verbatim
   human answer and a paraphrase in that slot records as human approval — and **a message in the
   conversation is not a decision record**, so a `HumanDecisionRecord.decisionId` must not be a chat
   message id unless that id is durable and immutable.

### What this buys, and what it does not

**It buys a surface designed against settled answers.** All five rows were open at cadenza's document,
and four of them (rules 1, 2, 4 and 5) are preconditions for work that is already named: the gate panes
are what `D-0019` rule 5's `resume` is called *by*, and the store rows are what `D-0009`'s "carries a
human's answer" is answered *from*. Taking them now is what keeps the first surface diff from being a
diff that also settles five decisions.

**It does not build any of it, and the absence is deliberate.** `AGENTS.md` section 7 wants a decision
taken as its own entry rather than inside an implementation diff; this is the entry, and the
implementation is a later one. In particular there is no HTTP module, no `node:http` grant and no new
external allowance anywhere in the tree as a result of this entry — the boundary test is unchanged by
it, and an access point that wants `node:http` will say so in its own diff, which is where the question
"which layer is this, and what is it allowed to reach?" belongs.

**It does not decide cadenza's rows.** `cadenza S-1`'s human-decision port in particular is cadenza's
to take, and rule 4's sixth fact is written conditionally for exactly that reason.

### What would falsify it

- **`cadenza S-1` being refused at cadenza's gate.** Rule 4's sixth fact is conditional on it, and its
  refusal removes the fact rather than moving it.
- **The chosen OIDC provider refusing the redirect a LAN-reached console needs.** That is rule 2's own
  precondition failing, and it reopens rule 3's binding rather than rule 2's identity mapping — the
  answer would be how the LAN reaches loopback, not a hand-rolled login.
- **continuo recording an *authenticated* answerer.** That supplies the provenance the seam does not
  have today, which is `D-0009`'s own falsifier, and it changes what rule 2's `--actor-id` is worth.
- **continuo writing DDL for `task`.** Rule 4 rests on continuo declining to design it by implication;
  if continuo's own first Issue writes it, where the delegation record belongs is a live question again.
- **A conversation store arriving anywhere else first** — in continuo, or in a surface that keeps its
  own — which would make rule 5 a statement about a second copy rather than about the home.
- **The console needing a source that is not a local file or a child process.** Rule 3's argument is
  that there is nothing to reach remotely; a remote source falsifies it directly.
- Any measurement above failing to reproduce. The measurements are cadenza's
  `docs/design/operating-surface.md` sections 5 to 7 at cadenza PR #56, against continuo
  `44f62336108b86cab5da791111ffa0e5b73cd01a` and cadenza `e56d7e71981232d19120d20ba6b920a5c4d762dc`.

---

## D-0021 — The pin moves to continuo `603843b`: a third explicit budget for the identity read-back, and the model tier priced into `lap perform --model`

**Status:** accepted (2026-09-06, rondo's human gate)

The lap-1 dogfood ([`docs/operations/lap-1-dogfood.md`](docs/operations/lap-1-dogfood.md)) stopped
on two facts about continuo rather than about rondo, and recorded both. `F-1` was blocking: the
post-spawn identity read-back was two hard-coded constants worth **2.5 seconds**, and four measured
starts of a real worker took **3.5 s, 7.9 s, 9.7 s and 11.3 s** to emit the event that names the
session — every one over the window, the fastest by 40%. `F-2` was not blocking and is the more
expensive of the two: nothing anywhere selected the worker's model, so a lap ran on whatever the
worker CLI defaults to, and cadenza's `executorPolicy.modelTier` was carried, digested, persisted
and **read by nobody**.

continuo answered both — `continuo D-0098` makes the read-back window a caller-supplied budget
defaulting to 30 s, and `continuo D-0099` adds `lap perform --model` over the provider's
`base_cli_args` plus a `model` field on the verb's answer. This entry is rondo taking them: the pin
moves, and the two new inputs become things rondo **states** rather than inherits.

**It supersedes nothing.** `D-0017`'s eleven rules stand, and its pin is *moved* rather than
re-argued; `D-0019`'s sixteen stand, two of them one revision behind and annotated on that entry;
`D-0014`'s three stand, and rule 3's "a second executor is a change to one file" is what rule 3
below spends. `D-0015` and `D-0018` are untouched.

### Decision

1. **The pin moves to `603843b7c0e91136bc7f7e5c9f91640f7bb970c9`.** `continuo.pin.json`,
   `src/continuo/pin.ts` and the recorded version line move together, as `D-0017` rule 4 requires,
   and the line is a **measurement** rather than an assembly: the pinned checkout was built with
   `CONTINUO_REQUIRE_REVISION=1` and `node dist/cli.js --version` printed
   `@suisya-systems/continuo 0.0.0 (rev 603843b7c0e91136bc7f7e5c9f91640f7bb970c9)`. Nothing about
   the verification changes — the build is checked before rondo drives it, so there is no window in
   which rondo drives a binary it did not pin. What the new revision also carries and rondo does
   **not** consume: `gate present` / `deliver` / `ack` answering in the shared envelope
   (`continuo D-0097`) and the `run show` read verb (`continuo D-0096`). Consuming either is its own
   decision; `AGENTS.md`'s current-state prose is updated to say the flag now reaches them, and
   `gate reconcile` is the one verb in the surveyed set still without it.
2. **`identityReadbackTimeoutMs` is a required, explicit `RunPlan` field and rondo's third budget.**
   It is threaded through `runPlan()`, the persisted plan payload, `PerformLapRequest` and
   `src/access/conductor.ts` to `lap perform --identity-readback-timeout-ms`, and it is **counted
   into `invocationCeilingMs`'s floor**: the ceiling must be strictly above
   `turnTimeoutMs + gitTimeoutMs + identityReadbackTimeoutMs`. `D-0019` rule 12's reasoning is
   unchanged and is the reason this is not left to continuo's 30 s default — the numbers rondo
   reasons about must be the numbers in force, and a window a lap can spend in full *before the turn
   starts* has to be inside the patience the operator declared. rondo sets no value of its own: like
   the other two, the number is the caller's, and `D-0019` rule 3's "the conductor never invents a
   field" holds.
3. **The model tier is priced in the invocation adapter, `--model` is on every lap, and an unpriced
   tier is refused before the spawn.** `src/continuo/roles.ts` becomes an **executor-policy
   adapter** with two independent tables — `mapNeutralRole` for `executorPolicy.roleName`, and
   `mapModelTier` for `executorPolicy.modelTier`. Independent, and **not** a role → model table:
   `continuo D-0099` states the distinction (a role says what the executor is for, a model says who
   executes), continuo's `roles.json` carries no model key, and `D-0014` rule 1 confines executor
   vocabulary to this one module either way. The table, in force from this entry:

   | cadenza `executorPolicy.modelTier` | model id passed as `--model` |
   |---|---|
   | `standard` | `claude-opus-5` |
   | anything else | **refused**, before the spawn, as rondo's own policy gap |

   Three things about that table:

   - **The concrete ids are provisional, pending an operator's ratification.** Which model a tier
     costs is a quality-and-cost policy, not an implementation detail, and `AGENTS.md` section 7
     forbids taking one inside an implementation diff. `standard` is the only tier any agent type in
     this repository uses. What is *not* provisional is the shape: the mapping exists, it lives in
     one module, and the refusal is unconditional.
   - **Changing a pair is a new decision entry**, not an edit. A pair replaced silently would be a
     lap costing something different with nothing on record saying when it changed or who agreed;
     `test/continuo/roles.test.ts` asserts the table literally so that a change is a deliberate red
     test.
   - **The refusal is what makes the omission safe.** Omitting `--model` is a supported continuo
     call and continuo's own help says it is not a neutral choice — the child then runs on the
     worker CLI's default, which is the model nobody chose and, per `F-2`, the most expensive one.
     Unlike an unmapped role, **nothing downstream would catch this**: cadenza validates the tier
     structurally and continuo never sees a tier at all. So a tier rondo cannot price is a lap rondo
     does not start.
4. **`LAP_PERFORM` decodes the twelfth field, and rondo checks it against what it asked for before
   recording it.** `model` is `string | null`, always present, read with `nullableString` under this
   layer's absent-is-not-null rule: `null` is continuo saying the choice fell through to the worker
   CLI's default, which is a different fact from any model name. The invocation adapter answers a
   pair — continuo's outcome, and the model rondo selected — as `admitRun` already answers one with
   the role it used, and the interpreter compares the two exactly as it compares the run id it
   planned against the run id the lap names. **A mismatch is `stalled`, not `failed`**: the lap
   happened and a gate is open, so this is a person's question about that gate rather than a lap to
   retry, and the gate id is named in the report **before** the stall so that an open gate rondo
   learned about is never one nobody can find.
5. **The iteration row gains two columns, `model_tier` and `model`, and carries both.** The tier is
   what an agent type declared and the model id is what the lap actually cost, and the pair is the
   only place a person auditing spend can see what a tier was worth on the day the lap ran. The
   model column holds what **continuo reported**, never what rondo requested — recording the request
   in place of the observation would make rule 4's check unable to fail, which is `D-0015` rule 6's
   habit applied to a second measured field. **The reduction, stated:** lap 1 still has no schema
   migration, so the two columns arrive by `CREATE TABLE IF NOT EXISTS` and a database created by an
   earlier rondo does not have them. There is no durable production data in lap 1 and the remedy is
   to create a new database; a migration path is owed the first time there is data worth keeping,
   and that is a decision rather than a patch.

### What was measured, and how

**2026-09-06**, toolchain `node v22.17.0`, on Linux. The pinned checkout was cloned at
`603843b7c0e91136bc7f7e5c9f91640f7bb970c9`, built with `CONTINUO_REQUIRE_REVISION=1`, and asked:

- `node dist/cli.js --version` printed
  `@suisya-systems/continuo 0.0.0 (rev 603843b7c0e91136bc7f7e5c9f91640f7bb970c9)`, which is the line
  `src/continuo/pin.ts` records. `test/continuo/smoke.test.ts` was then run against that build with
  `RONDO_CONTINUO_CLI` and passed, so the new pin is verified against a real binary and not only
  against itself.
- `node dist/cli.js lap perform --help` shows `[--model MODEL]` immediately after
  `--claude-command`, and `[--identity-readback-timeout-ms IDENTITY_READBACK_TIMEOUT_MS]`
  immediately after `--git-timeout-ms`. `src/continuo/invoker.ts` renders the flags in that order,
  so `--help` and the function read the same way.
- `dist/fencing/roles.json` still has exactly `worker, curator, dispatcher, secretary`, and
  `--endpoint-recipient`'s `choices` are still `external-notify, human-gated-effect`. Both
  transcriptions in rondo are re-dated to this revision rather than assumed to have survived it.
- continuo's own rules for the two new inputs, read off its source at that revision:
  `--model` is refused unless it matches `/^[A-Za-z0-9][A-Za-z0-9._:-]*$/` and is at most 128
  characters, checked **before** the provider is constructed; `--identity-readback-timeout-ms` must
  be a whole number of milliseconds of at least 1 and defaults to `DEFAULT_READBACK_BUDGET_MS`,
  which is `30_000`. `claude-opus-5` satisfies the first, and `test/continuo/roles.test.ts` asserts
  every model in the table against that pattern so a future pair cannot become a token continuo
  would refuse.

The `F-1` timing figures quoted above are the dogfood's own measurements, dated 2026-09-05, and are
not re-measured here: what this entry needed from them is the *size* of the window, and continuo has
since made the size an argument.

### What this entry does not decide

- **Which model a tier should be.** Rule 3's table is provisional and says so; ratifying or changing
  it is an operator's decision and a new entry.
- **Whether the concrete model is worth billing against.** Rule 5 persists it, which is the cheap
  half. What a spend report is, and who reads it, is not decided here.
- **Consuming `run show` or the three newly-enveloped `gate` verbs.** They are named in rule 1 as
  what the pin also carries, and nothing in rondo drives them.
- **The cadenza artefact.** `cadenza.pin.json` and the vendored tarball are a separate lane and are
  untouched by this entry.

### Annotations this entry adds to earlier entries

- **`D-0019`** gains a dated annotation on that entry, recording that its "`lap perform` flag set
  changing" falsifier fired, that rule 12's two explicit budgets are three, and that rule 14's
  eleven decoded fields are twelve. Its falsifier list gains two inline annotations saying the same.
- **`D-0017`'s pin** is moved rather than re-argued: rule 1's "the seam is a checkout pinned by
  commit sha" and rule 6's "the revision is verified rather than assumed" are exactly what made
  moving it a three-file edit and a test rather than a design question.
- **`D-0014` rule 3** — "a second executor is a change to one file" — is spent for the first time,
  and in a shape the rule anticipated: the file is `src/continuo/roles.ts` and the change is a
  second table beside the first, not a second module.

### What would falsify it

- **cadenza growing a model-tier vocabulary of its own.** The pairs would become cadenza's to state
  and rondo's to consume, and rule 3's table would be the wrong home rather than the only one.
- **continuo taking a tier rather than a model id.** The table moves down a layer, and rondo's
  refusal becomes continuo's.
- **The operator ratifying different ids**, or declining `claude-opus-5` for `standard`. Rule 3 says
  the values are provisional; this is that provision being used, and it is a new entry rather than a
  falsification of the shape.
- **A second tier arriving in an agent type before the table has a pair for it.** That is not a
  falsifier — it is rule 3's refusal working — unless the refusal turns out to block work an
  operator considers routine, in which case "rondo refuses what it cannot price" is the claim to
  re-argue.
- **continuo's `lap perform` flag set changing again**, or a `continuo.lap.perform/2`. `D-0019`'s
  falsifiers on both, unchanged; this entry is what one firing looks like when the change is
  additive.
- **continuo's default read-back budget moving**, which would not affect rondo — rondo states its
  own — but would falsify the sentence in rule 2 that names 30 s as what rondo declines to inherit.
- **A model id that stops matching continuo's `--model` pattern.** The token would be refused at the
  seam rather than before it, and the pattern assertion in `test/continuo/roles.test.ts` is what
  turns that into a red test here instead.
- **A rondo database with data worth keeping.** Rule 5's reduction is stated on the premise that
  there is none; the first time there is, the missing migration path is the thing to decide.
- Any measurement above failing to reproduce. Toolchain `node v22.17.0`; continuo at
  `603843b7c0e91136bc7f7e5c9f91640f7bb970c9`; cadenza as `cadenza.pin.json` names it.

---

## D-0024 — rondo ships a binary: an emitting build beside the type-check, a launcher, and the CI cell that runs it

**Status:** accepted (2026-09-06, rondo's human gate — the operator's approval to build the minimal
operating loop)

`D-0002` decided that rondo emits nothing, and named the condition under which that would change:
"The day rondo ships a binary is the day that entry gains a build." This is that day. Nothing else
in `D-0002` moves — ESM, NodeNext, the explicit `.js` suffixes and the strictness beyond `strict`
are inherited unchanged, so the executable is compiled under exactly the settings the suite is
type-checked against.

### Decision

1. **`tsconfig.build.json` extends `tsconfig.json`** with `noEmit: false`, `rootDir: "src"`,
   `outDir: "dist"`, and `include: ["src"]`. A second file rather than a flag on the first, because
   `tsconfig.json`'s `include` covers `test`, `scripts` and `vitest.config.ts`: flipping `noEmit`
   there would emit `dist/test/**` beside the tree rondo ships.
2. **`dist/` is at the repository root and cannot move.** cadenza is a `file:vendor/*.tgz`
   dependency, so a tree emitted outside the repository resolves neither it nor `@types/node`. It
   stays gitignored and unpublished, and the package stays `private: true`.
3. **The bin is `bin/rondo.mjs`, outside `src/`, and it reaches `dist/access/cli.js` through a
   dynamic import.** Measured: knip reads `package.json`'s `bin` as an entry point regardless of its
   own globs, and a *static* import into a gitignored directory makes it report an unresolved import
   and exit 1 — and `npm run knip` is a gate. A computed specifier is one knip does not follow. The
   `try` around it is the same choice seen from the operator's side: an unbuilt tree becomes a
   sentence naming the command that fixes it rather than a module-resolution stack.
4. **`D-0002`'s objection was "a build that nothing checks", and this is the check.**
   `npm run build` is **first** in `npm run verify`, so a stale `dist/` cannot survive a green run,
   and it is a step in CI's `double-green` job, so it runs in all four matrix cells — which is where
   the Windows path handling and the Node 22/24 split are observed.
5. **`src/store/sqlite.ts`'s `node:sqlite` import becomes a value import**, and that module gains
   `openIterationStore(path)`. This is recorded because it *reverses a stated property of that
   file*: the import was type-position only, so importing the barrel never loaded the experimental
   driver. The operator's command line has to open a database by path, and
   `test/architecture/import-boundaries.test.ts` asserts **equality** on the set of modules naming a
   SQLite driver — so a second opener would not be a second module, it would be a failing test. The
   cost is one `ExperimentalWarning` per process that imports the barrel, and it is named here
   rather than left to be discovered in a terminal.

### What was measured

- `tsc -p tsconfig.build.json` emits the tree in well under a second, and the emitted
  `dist/access/cli.js` runs under `node` on `v22.17.0`.
- `node:sqlite` needs **no** `--experimental-sqlite` flag on the engines floor; it prints one
  warning to stderr. The `--experimental-sqlite` in the older dogfood notes is stale.
- Type stripping was considered and rejected. It needs `--experimental-strip-types` below Node
  22.18 against an engines floor of 22.14.0, has no portable shebang across the Windows cell, and
  would be a second module-resolution implementation beside the one `D-0002` chose.

### What would falsify it

- The build ceasing to run in any matrix cell, which would restore `D-0002`'s objection exactly.
- rondo becoming a published package, which makes `files`, `exports` and a declaration build
  decisions this entry did not take.
- `dist/` being committed.
- Type stripping becoming portable across the whole engines range, which would make the launcher and
  the second config removable rather than merely unnecessary.

---

## D-0025 — The lap-1 operating surface is a command line: `start`, `answer`, `publish`, `abandon`, with the plan file as the whole of configuration

**Status:** accepted (2026-09-06, rondo's human gate)

Everything rondo needed to walk one request existed and nothing could reach it. `D-0019` built the
conductor; `D-0021` moved the pin so a lap completes; the lap-1 dogfood
([`docs/operations/lap-1-dogfood.md`](docs/operations/lap-1-dogfood.md)) walked one end to end — by
writing a throwaway `tsconfig`, compiling by hand, driving the composition root from a thirty-line
`drive.mjs`, and typing six continuo verbs in order with ids copied between them. This entry is the
surface that replaces all of that, and it is deliberately the smallest one that closes the loop.

### Decision

1. **One executable, four subcommands** — `start`, `answer`, `publish`, `abandon` — in
   `src/access/cli.ts`. `abandon` is an escape hatch rather than a feature, and it is here because
   without it one killed lap holds the single-flight lock with nothing able to release it, which is
   the exact defect this work exists to remove. `status` and a `withdrawn` close are deliberately
   absent; `GATE_CLOSE` stays defined and undriven, as it was.
2. **`src/access/cli.ts` is the operating surface `D-0009` and `D-0013` name**, and it — never the
   conductor — drives `gate present`, `deliver`, `ack` and `answer`. `D-0019` rule 5 remains true
   *of the conductor*, which is what it was about.
3. **A gate body is carried byte for byte.** `--body` reaches continuo as the attached
   `--body=<bytes>` with no trim, reflow, template or summary (`D-0009` part 3). Attached because a
   separate token beginning with a dash reads as a flag and a body spelled exactly `--json` would be
   deleted by the invoker's de-duplication of that flag. The only value refused is the empty string.
   ASCII escaping governs what rondo **prints**, never what it **sends**.
4. **The approver is an allowlist of size one, checked before any verb runs.** `--actor-id` must
   equal `RONDO_APPROVER`. This keeps the half of `D-0020` rule 2 that a command line can keep and
   is honest that it cannot keep the other: there is no OIDC subject here, so the identity is
   asserted by whoever types it. A stated reduction scoped to lap 1, whose end is the adapter
   `D-0020` already specifies. `D-0020` is **not** superseded — no HTTP binding, gate pane or
   conversation store is built.
5. **rondo gains no configuration layer** (`D-0019` rule 3 holds). The plan file **is**
   `planPayload`'s JSON and `readPlan` is its only reader: no defaults, no templating, no merging,
   no inference. The CLI applies at most four per-run overrides (`--run-id`, `--topic-branch`,
   `--workspace`, `--prompt`) and rewrites `parties.grantee` to the effective run id, which is the
   only value the planner permits it to have. Because the format is `planPayload`'s inverse, **the
   `plan` column of any past iteration row is a valid plan file**. No allocator is added: the
   `(run id, topic branch, workspace)` triple is typed by the operator, so `D-0012`'s blocker is
   untouched. Two values are rondo's own and are named as such — `START_POLICY`, because
   `CONSERVATIVE_POLICY`'s `ask_every_iteration` is refused before a row exists and a command called
   `start` must be able to start; and the iteration id, defaulting to the run id, which is a copy of
   an identifier the operator already chose rather than a mint.
6. **`publish` runs the push and opens the pull request, and never merges.** This is the one place
   this entry touches `D-0010`, and it does not overturn it. `D-0010` settles **where the authority
   to publish sits** — with the operator, not with rondo — and that is unchanged: nothing here runs
   unless a person typed `publish`, no other command in the tree reaches the module that can start a
   process, there is no scheduler, retry or automatic path into it, and the credential used is the
   operator's own `git` and `gh` configuration, which rondo neither stores nor reads. What was
   settled when this entry was written is that **a button an operator presses is not the same act as
   rondo publishing on its own**: the authority stays with the person, and the command is the
   keyboard rather than the authority. Merging is absent in both senses. `run close` is driven only
   from here, and only after the other two legs succeeded, because it is a claim that they did.

   **A closed iteration is not an approved one, and `publish` checks which it has.** `withdrawn`,
   `expired` and `unanswerable` each close a gate and therefore close the iteration, and none of
   them is a person saying yes; only `answered_and_forwarded` records an answer carried through to
   its forward. Publishing on any of the other three would push the work and open a pull request
   whose body states that a human approved it — rondo making a false statement about somebody else,
   which is `D-0009`'s concern seen from the other end.

   **A publish that fails partway leaves the operator a command, not a puzzle.** rondo persists
   nothing about how far it got — that would be a durable record of somebody else's state — so a
   failed pull-request leg says that the push is done and prints the one remaining leg. Re-running
   `publish` is safe for the push and refused for a pull request that already exists; that
   asymmetry is stated in the runbook rather than worked around here.
7. **The spawn that publishes is granted to `src/access/forge.ts` alone**, not to the command line
   and not to the layer. That is what makes rule 6 a property rather than a promise:
   `src/access/cli.ts` — the module that reads argv, reads the plan and drives every continuo verb —
   has no `node:child_process` binding and cannot acquire one without an edit that
   `test/architecture/import-boundaries.test.ts` fails. Three planted violations hold that open.
8. **rondo consumes four more gate verbs and one run verb.** `GATE_PRESENT`, `GATE_DELIVER`,
   `GATE_ACK`, `GATE_ANSWER` and `RUN_CLOSE`, with schema ids read off continuo's own source at the
   pinned revision `38c667b5126fdfdc0465e4a422e88b20a8b53044`. `GATE_SHOW` additionally decodes
   `rationale` and `options` — **both plain strings**, `options` being the JSON array *text* the row
   carries, which rondo relays and never parses. That correction is load-bearing: the previous test
   fixture guessed `rationale: null, options: []` and was wrong on both counts, and passed only
   because no decoder read either field. `gate reconcile` is never driven; it is the one verb with
   no `--json`, and its prose must not be parsed.
9. **The walk resumes from the stage continuo reports and never replays from the start**, and every
   message id it uses is read out of the payload that produced it rather than composed from the gate
   id. A walk that always began at `present` would be refused `InadmissibleTransitionRefused`
   exactly when a person most needs a retry to work, and a computed id is a guess that happens to be
   right until it is not.

### What was measured, and how

Walked on 2026-09-06 against the pinned continuo with a real `claude -p` worker
([`docs/operations/rondo-cli.md`](docs/operations/rondo-cli.md) section 8):

- **`start`: 22.8 s**, one command, from a 32-field plan file to a gate open at `received`. The
  worker did the work asked of it — the commit really appends the line.
- **`answer`: 1.3 s**, one command, driving all six verbs and closing the gate
  `answered_and_forwarded`, with the iteration reaching `closed` and the lock released.
- **`publish`: `--dry-run` computes all three legs correctly from the stored plan.** The push and
  the pull request were not executed in that walk, because the environment it ran in blocks both by
  design — which is the same boundary rule 6 is built around. They are covered by unit tests, and
  the first operator to run the command without `--dry-run` is what closes the gap.
- Node's `parseArgs` refuses a dash-leading value passed with a space and its own message names the
  form that works, so `--body=` is what the help text spells.

### What would falsify it

- The web surface of `D-0020` arriving, which ends rule 4's reduction.
- rondo acquiring a push credential of its own, or a spawn grant reaching `src/access/cli.ts` — at
  which point rule 6 would become a supersession of `D-0010` rather than a reading of it, and would
  need `D-0010`'s own gate.
- A parallelism entry landing, which replaces rule 5's operator-typed triple with an allocator.
- continuo's gate verb set, its `/1` schemas, or the type of `gate show`'s `options` moving.
- The plan file needing a field `planPayload` does not carry, which is where rule 5's "no
  configuration layer" would stop being tenable.

## D-0026 — The pull request `publish` opens is written for a person: the lap's own commit subjects are the summary, and the request is quoted input

**Status:** accepted (2026-09-06, rondo's human gate)

The first pull request `rondo publish` opened for real (`#29`, 2026-09-06) put the lap's prompt in
both fields. The title was the topic branch, a colon, and the prompt's first line cut off with an
ellipsis; the body was the prompt entire, so a reviewer's first sight of the change was "Do not
build. Do not lint. Do not push." — instructions addressed to a worker, standing where an account
of the change belongs, and saying nothing about the diff. `D-0025` rule 6 settled *who* may
publish and left *what the pull request says* unspecified. This entry specifies it.

### Decision

1. **The request is never the description.** A `RunPlan`'s prompt is written to an agent. It may
   contain prohibitions, tooling instructions and process notes, none of which are true statements
   about the change and some of which read as instructions to the reviewer. It is therefore never
   the title and never the body's prose.
2. **The summary is the lap's own work.** `publish` reads two facts from the workspace before it
   prints anything — the commits the topic branch adds to its base (`--no-merges`, oldest first)
   and the paths the diff touches (`--numstat`, three-dot) — and builds both fields from them. A
   commit subject is the one line in the whole record written by somebody for somebody to read, and
   it is already about the change; **rondo selects, and does not compose prose.**
3. **No title ends in an ellipsis.** The title is the oldest commit's subject, with
   `(+N more commits)` when there are more. When there is no subject to use — git unreadable, no
   commit on the branch, or a subject past `TITLE_LIMIT` (120 characters), at which point it has
   stopped being a summary — the title is `<topic branch> (rondo run <id>)`. That is a plain label
   and is deliberately preferred to a cut-off sentence: a reader can tell a label from a summary,
   and cannot tell a truncated summary from a wrong one. **The label is itself bounded**: a branch
   name and a run id are the operator's own strings and neither is limited, and a title past the
   forge's own limit is refused by `gh` *after* the push has happened — the one leg this command
   cannot undo. So it steps down to `rondo run <id>` and, past that, is cut. Cutting an identifier
   is not the defect this rule is about: `TITLE_LIMIT` governs summaries that stop mid-sentence, and
   a label is not a sentence.
4. **The provenance stays, in a section of its own.** Run and iteration id, the branch and its base,
   the gate id and its outcome, the continuo revision **off the row** (`D-0025`'s reason: the pin
   moves, and the row records the build that actually drove the lap), the model and its tier, the
   session — and the sentence `This pull request was opened by rondo publish, which an operator ran.
   Merging it is not.`, unchanged, because it is the one thing the first real pull request got right
   and it is `D-0010` said in the place a reader will meet it.
5. **The request is kept, folded and fenced.** "Was this what was asked for?" is a real question a
   reviewer asks and rondo's row is the only place that can still answer it, so the request is
   carried verbatim inside a `<details>` whose summary says what it is, in a code fence longer than
   the longest run of backticks inside it — so a request containing a code block cannot end the
   quotation and start writing the body. Discarding it entirely was rejected for the same reason
   rule 4 exists: it is provenance. Beyond `REQUEST_LIMIT` (4000 characters) the quotation says how
   much it left and that the whole of it is on the iteration row, which is a truncation with a
   pointer rather than a loss, and the fence is sized to **what is quoted** rather than to the whole
   request — a run of backticks past the cut is not in the body, and guarding it would spend the
   body's remaining size on two fence lines, turning the bound back into a pull request too large to
   open. "Verbatim" is also literal: the block quotes what the row holds, whitespace included, and
   only the emptiness check trims.
6. **A history rondo could not read is said out loud.** `inspectLapWork` answers `unreadable` with
   git's own reason rather than an empty read, and the body prints that reason in place of the
   summary while keeping every line of rule 4. A publish must still be possible with an unreadable
   workspace — the operator is standing there and the diff is real — and what a reader must not do
   is take an empty section for an empty change.

   **The body is bounded by what it lists as well as by how much.** Twenty entries is no bound when
   one entry is unbounded, so a commit subject or a path past `LISTED_LIMIT` (200 characters) is
   described rather than printed, and so is every value the row carries into the body — the run and
   iteration ids, the branch names, the ref, the gate id and outcome, the revision, the model and
   tier, the session, and git's own reason for an unreadable history. The sum is checked as well as
   the parts: past `BODY_LIMIT` (60,000 characters) the quoted request is dropped for a line saying
   where it still is, because it is the one part of the body that is not about this change and is
   recoverable from the row. Every value rondo composes is bounded before the push, because a title
   or body the forge refuses is refused *after* the push, which is the one leg that cannot be taken
   back.

   **The summary names the ref it compared, not the branch it was cut from.** Under
   `--allow-remote-mismatch` the branch is pushed to one repository and the pull request opened in
   another, so the base rondo read is the workspace's and the base the forge diffs against is the
   target's; when they have drifted, a body that said "against `main`" would describe a comparison
   this pull request is not making. It names the ref, and in that case says in one line which
   comparison it made. rondo does not fetch the target's base to settle it: that is a network effect
   nothing asked for, against a repository the operator only named.
7. **The text is composed where it can be tested, and read where a process is allowed.**
   `inspectLapWork` lives in `src/access/forge.ts`, because asking git a question needs a spawn and
   that module holds the tree's only grant (`D-0025` rule 7, unchanged). `pullRequestText` is a pure
   function in `src/access/cli.ts` over what it read, for the reason `publishPreflight` is: the
   rules about what a pull request says are rules about pull requests, and are checkable without a
   repository on disk.
8. **`--dry-run` prints the title and the body.** They are the part of a publish a person can only
   check by reading, so a preview that printed three command lines and left the text to be composed
   afterwards would preview everything except the thing this entry is about. Same rule as the
   preflight: the preview and the run compute the same values.

### What was measured, and how

Composed on 2026-09-06 against a real repository (a workspace with a base branch, a topic branch and
one commit), through `inspectLapWork` and `pullRequestText` as `publish` calls them:

- **Title**: `docs: record the first real lap in the operator runbook` — the lap's commit subject,
  where `#29` had `docs/rondo-first-real-lap: Append exactly one line to the end of
  docs/operations/rondo-cli.md, r...`.
- **Body**: `## What changed` with `- \`8ee604b\` docs: record the first real lap in the operator
  runbook` and `- \`docs/operations/rondo-cli.md\` (+1 -0)`; `## How this got here` with the run,
  the gate outcome, the revision, the model and the session; the request folded into a `<details>`;
  the merging sentence last.
- The `refs/heads/<base>` fallback of rule 2 is what that measurement exercised; the
  `refs/remotes/<remote>/<base>` candidate is tried first and is what a continuo-cut worktree will
  actually resolve.

### What would falsify it

- A forge whose pull-request body does not render `<details>`, which ends rule 5's fold and would
  need the request somewhere else or nowhere.
- Laps that routinely produce many unrelated commits, at which point rule 3's oldest-subject choice
  stops naming the change and a real summary — which rondo cannot write — becomes the requirement.
- A summariser being introduced, which would overturn rule 2's "selects, does not compose": what a
  pull request says about a change would then be generated text, and whether rondo may state it as
  its own is a question this entry does not answer.
- `RunPlan` gaining a human-facing description field, which would make rule 1 a choice between two
  inputs rather than a rule about the only one.
---

## D-0027 — "Revise" at the gate becomes a second lap: fresh identifiers, the predecessor's branch as the base, and the instruction carried into the prompt

**Status:** accepted (2026-09-06, rondo's human gate)

`gate_options` has read `["approve", "revise"]` since the first dogfood run and the second word
bought nothing. `D-0025` gave the operator `answer`, and `answer` carries a body byte for byte to
continuo whatever it says: "looks good" and "not quite -- use the existing helper" both close the
gate `answered_and_forwarded`, both end the iteration at `closed`, and rondo then prints `Next:
rondo publish` for both. A person who wanted the work changed had to write a fresh thirty-two-field
plan by hand, pick three new identifiers, and know without being told that the next lap's
`base_branch` has to be the last lap's `topic_branch` or the second worker starts from nothing.
This entry is the smallest thing that makes the second option do what it says.

### Decision

1. **`revise` is a fifth command**, beside `D-0025`'s four:
   `rondo revise --actor-id ID --body=TEXT --run-id ID --topic-branch NAME --workspace PATH
   [--iteration-id ID]`. It answers the open gate with the instruction and then starts one more
   lap. It is not a mode of `answer`: `answer` settles a request and `revise` continues it, and a
   flag that turned one into the other would make the difference invisible on the command line.

2. **A revision is a new iteration, not a resumed one, and the loop gains no back edge.**
   `advisory.md`'s `A-10` settles this and gives the reason — *"resuming would mean re-entering a
   terminal state, which `D-0019` rule 10's edge relation refuses. Lineage costs a join; revival
   costs the invariant."* So the predecessor's row is never reopened, `nextStep` and the `Step`
   union are untouched, and the successor walks the ordinary arc from `planned`. **`iterate` stays
   absent**, which is what `parallel-admission.md`'s `N-19` asks: the back edge is a question about
   `maxIterations`' dormant post-admission meaning, and this entry does not answer it. Nothing here
   makes rondo revise on its own; a person types the command, once, per lap.

3. **The three identifiers are the operator's, and rondo mints none of them** (`D-0012`,
   `D-0019` rule 3). They are on the command line for the same reason `start`'s four overrides are,
   and a `revise` missing one is refused in a single message naming all three rather than one at a
   time. When the allocator lands, these flags are removed with `start`'s.

   **`A-17`'s inheritance is not available here, and the measurement is why.** `A-17` proposes that
   a retry reuse the predecessor's `(run id, topic branch, workspace)`, and scopes itself to route
   S — where `D-0019` rule 15 stopped a `needs_approval` **before** admission, so *"the triple is
   unused, not spent"*. A gate exists only after a lap ran, so a revision is always the admitted
   case, which `A-17` itself puts *"out of scope in lap 1 ... its first consumer arrives with the
   allocator or with a resumable lap, not here"*. continuo agrees at the pinned revision
   `38c667b5126fdfdc0465e4a422e88b20a8b53044`: `src/workspace/materializer.ts` documents
   `topicBranch` as *"Must not already exist"* and `workspace` as *"Absolute path the worktree is
   created at. Must not exist"*, and `continuo D-0057` refuses a second materialisation of the same
   run. Three fresh identifiers are not a preference; they are the only thing continuo accepts.

4. **What is inherited is the base branch: the successor is cut from the predecessor's topic
   branch.** This is the whole difference between "revise" and "start over", and it is one field.
   The second worktree is cut from the commits the first lap made, so the second worker edits that
   work rather than re-doing it. Nothing is pushed to reach it (`D-0010`): the branch is in the same
   repository the first workspace was cut from. Every other plan field is the predecessor's row,
   verbatim — which is `D-0019` rule 4's "persist it verbatim" being spent on something.

5. **`RunPlan` gains `pullRequestBaseBranch`, and it is rondo's own field.** continuo's materialiser
   calls `baseBranch` two things at once — *"the branch the topic branch is cut from, and the branch
   the lap's pull request is opened against"* — and rule 4 breaks the tie. The predecessor's topic
   branch is local to the machine that ran the lap and nothing pushes it, so a pull request opened
   against it names a branch no forge has. So `publish` reads this field instead when it is set, a
   revision sets it to `predecessor.pullRequestBaseBranch ?? predecessor.baseBranch` — carrying the
   **first** lap's base along a chain of any length — and continuo is never told about it. Null in
   every plan a person writes.

   **It is the one payload key that may be absent, and that is a decision.** The plan column has no
   migration: the store persists the bytes verbatim and hands them back unaltered, so a strict read
   would make every row written before this field unreadable — filed at `stalled`, and met by
   `publish` on a row whose lap has already been paid for. Absent reads as null, which is what an
   operator's own plan file means. A key that is *present* and not a string is still refused, and
   every other field is as strict as it was.

   > **Note (D-0028, 2026-09-07).** No longer the one key that may be absent, and no longer a
   > bespoke reader. `readAbsentAsNullString` is retired: absence is now scoped to payload version
   > 0 by a ladder step, and at version 1 this field is required like every other. What this rule
   > asserted about *meaning* — absent means no revision has touched this plan — is what the step
   > supplies.

6. **The successor's plan is composed and fully validated before the gate is walked.** The walk
   presents, delivers and answers through continuo and its ack closes the gate; it cannot be taken
   back. A revision refused after that would leave a person having spent their gate on an answer
   that started nothing, and the way back would be the hand-written plan this entry removes. This is
   `D-0019` rule 14's "validate before the effect" applied to a gate rather than to a spawn. In the
   same spirit the second lap is not started unless the first row reached `closed`: `reserve` would
   otherwise answer `occupied` correctly and tell the operator about single-flight when what
   actually failed was their answer.

   **The plan is not the whole of what has to be checked first**, and the rest of it is
   `revisionBlocker`. Three things a valid plan cannot see would each be discovered after the gate
   was gone: the successor's **iteration id** is not a plan field, so a plan can validate under an
   id the store already holds; the **topic branch** and the **workspace** are compared by
   `revisionPlan` against the predecessor's only, which is all a layer that may not start a process
   can do, and continuo's materialiser requires that neither exists — of a branch from two laps
   ago, or another spelling of a path, it would find out after `run admit`. So the branch is asked
   of git through `src/access/forge.ts` (the command line still has no spawn binding, `D-0025`
   rule 7), the workspace of `existsSync`, and an answer git will not give is a refusal rather than
   room to proceed. git is asked **twice**: `check-ref-format` before `rev-parse`, because
   `rev-parse --verify --quiet` answers a malformed name and an unused one identically, so a branch
   called `bad..branch` would read as available (measured: exit 1 for both). A gate continuo has **already closed** is refused here too, because `walkGate`
   walks it successfully and silently and `resume` then reports `closed` for `withdrawn` and
   `expired` as readily as for an answer.

   **And a walk that sent nothing is not permission to start a lap.** The gate can close between
   the check above and the walk's own read, so `walkGate` reports whether *this* walk carried the
   body (`answerSent`). Without it a revision could run on an outcome that is not a person saying
   anything, with the instruction recorded nowhere. This and the three checks above were found by
   review rather than by a walk: the happy path meets none of them.

7. **The instruction reaches two places and rondo composes neither of them.** continuo gets it byte
   for byte as the gate's answer (`D-0025` rule 3), which is where the record of what a person said
   belongs. The second lap's prompt gets the **first lap's request verbatim, then the instruction
   verbatim**, then one paragraph of fact: which run and iteration preceded this one, and that its
   commits are on the branch this workspace was cut from. Appended rather than replacing, because
   an instruction at a gate is a delta and a worker handed only the delta has lost the request it is
   a delta of. rondo writes no part of either (`D-0009`).

8. **An inherited absolute gate deadline is refused rather than carried or shifted.**
   `gateDeadlineAtMs` is an instant, so the predecessor's is behind the second lap before it starts;
   carrying it forward would open a gate already past its deadline and the person who asked for the
   revision would be the one to find out. Choosing a new one would be rondo deciding how long a
   human has to answer, which is the operator's declared patience for the same reason
   `invocationCeilingMs` is. So a plan carrying one is refused, by name, before anything is touched.

9. **What this does not build, stated so it is not read in.** No lineage column: the successor
   records no reference to the predecessor, and the chain is reconstructible only through the
   branch names and the prompt. That is a weaker record than `A-10`'s lineage and it is deferred to
   the entry that adds a migration to the store, because there is no migration mechanism at all
   today and adding one is that change's decision rather than this one's. No bound on how many
   revisions a request may have — each one is a person typing a command, which is the only bound
   lap 1 has ever had. No `revise` from anywhere but the live iteration's open gate.

   **And the preflight of rule 6 is not complete, which is stated rather than implied.** It checks
   what rondo can see: its own store, git, and the filesystem. It does **not** check that the
   successor's **run id** is free in continuo's control plane, so a `--run-id` naming an older run
   is still discovered by `run admit` after the gate is gone. Closing it needs rondo to consume a
   run-reading verb, and `D-0025` rule 8 enumerates the verb set rondo consumes — adding one is
   that entry's decision and not a line in this diff. The general shape of the gap is worth naming
   too: **every field continuo validates at admission is a candidate for this list**, and the
   complete answer is a continuo verb that validates an admission without performing one, which
   does not exist. Until then the preflight is a set of named checks rather than a guarantee, and
   the failure it leaves is loud — a spent gate and a settled predecessor — rather than silent.

### What was measured, and how

Two walks on 2026-09-06 against the pinned continuo with a real `claude -p` worker, provisioned by
`scripts/dogfood-env.sh`. **Four laps**, and the second walk is the first one re-run against the
final code after the first found a defect.

**Walk 1 (`revise-001` -> `revise-002`).** `start` opened a gate on a worker that had appended the
requested line and committed it as `600b3c1` on `dogfood/revise-001`. `revise` then carried *"Not
quite. The line you added should read exactly: 'Touched twice by the rondo operator CLI.'"* to the
gate, closed the iteration `answered_and_forwarded`, and started `revise-002` **cut from
`dogfood/revise-001`**. The second worker's own report is the finding:

> *"Continued from the previous lap's commit rather than restarting: `docs/NOTES.md:4` now reads
> `Touched twice by the rondo operator CLI.`, committed as `def1894` on `dogfood/revise-002`."*

`git log` on the second workspace shows `def1894` on top of `600b3c1` on top of the seed commit: one
linear history, the first lap's work edited rather than repeated. The gate was then answered
`approve` and the iteration reached `closed`. **51.4 s and 42.9 s** end to end, measured from the
store's own timestamps.

**The defect that walk found, and unit tests had not.** `publish --dry-run` on `revise-002` printed
a pull-request leg based on `dogfood/revise-001` — the predecessor's topic branch, which nothing
pushes. Rule 5 is that defect answered; it was found by running the command rather than by reading
the diff, and it would have failed on the first real publish of a revised iteration.

**Walk 2 (`revise-003` -> `revise-004`), on the final code.** The same sequence, and this time
`publish --dry-run` prints `--base main` while the plan's own `base_branch` is `dogfood/revise-003`
— the two fields doing their separate jobs. The pushed branch `dogfood/revise-004` carries both
commits linearly from `main`, so one pull request against `main` shows the whole request. **38.6 s
and 54.5 s.**

Four laps at roughly $0.17 each is the whole cost of the evidence in this entry.

### What would falsify it

- **The allocator arriving** (`D-0023`), which removes rule 3's three flags and moves
  `parties.grantee` off the caller.
- **A store migration arriving**, which is what rule 9's deferred lineage column is waiting on.
- **continuo's materialiser accepting an existing branch or workspace**, which would reopen rule 3
  and make `A-17`'s inheritance reachable from an admitted run.
- **`publish` learning to push more than one branch**, which would make rule 5's second base branch
  unnecessary — a stacked pull request would then be expressible.
- **A revision needing to change a plan field the instruction cannot express**, which is where
  rule 4's "everything else verbatim" stops being tenable.
---

## D-0023 — The identifier allocator and the capacity ledger: rondo mints the triple, `awaiting_human` stops occupying capacity, and the single-flight index becomes a counted bound

**Status:** accepted (2026-09-06, rondo's human gate)

`D-0012` decided single-flight for lap 1 and named what a second admission waits on. Two of its
three conditions are rondo's: **an allocator** for the `(run id, topic branch, workspace)` triple,
because continuo's verbs refuse on existence and nothing mints a fresh one; and **a bound somebody
sets and something enforces**, because a lease answers "who is writing", not "how many may run".
`D-0019` rule 10 then wrote the constant one into the schema and said the route from one to N is
"a capacity ledger, not a wider index".

What this entry adds to those two sentences is the finding that **they are not independent**. The
ledger's central question — whether an iteration waiting on a human still consumes capacity — can
only be answered *yes it may be released* if the allocator exists, because a released slot is safe
only when the next iteration cannot be handed the suspended one's identifiers. The allocator is not
a prerequisite the ledger waits on; it is the thing that makes the ledger's interesting answer legal.
So this is one entry, not two, and a gate that took half of it would have taken the half that does
not work alone.

The design is [`docs/design/parallel-admission.md`](docs/design/parallel-admission.md), whose rows
`N-1` … `N-28` this entry takes. It is paired with continuo's `D-1104`, whose own design fixes the
boundary in a line: continuo owns partitioning, fencing and the two-run proof; rondo owns
allocation, the capacity bound and suspend accounting.

**What this delivers today, stated plainly, because the headline is easy to overstate.** It does not
make two laps run at once, and it does not shorten any human wait. Of a measured 125.4 s iteration
lifetime, continuo's delivery lease was held for 20.9 s and rondo's lock for the remaining 104.5 s,
across an unbounded wait on a person. **This entry is about that 83%.** What is parallelised is the
waiting, not the working.

### Decision

1. **The allocator and the ledger are one decision**, for the reason above: releasing capacity at
   `awaiting_human` is safe only because something both mints and remembers identifiers.
2. **`awaiting_human` and `withdrawal_requested` do not occupy capacity.** The criterion is the
   design's own, already written in `src/store/records.ts` and restated by `D-0019` rule 11: a
   status keeps the lock according to **whether anything of the iteration might still be running**.
   At those two, nothing is — the `lap perform` process has exited, continuo's delivery lease was
   released when it did, and no fenced child survives it. **`stalled` does occupy, fail-closed**,
   because it means *unknown*, and the honest answer about a row nobody understands is that
   something may still be running. The set lives in one place, `SUSPENDED_STATUSES`, and the
   generated `occupying` column and the bound both read it.
3. **The allocator derives the triple from the iteration id** by a pure, total, invertible
   function — invertible over the closed alphabet rule 26 imposes, and not over the unconstrained
   string `admit()` used to take. It does **not** pre-flight continuo, git or the filesystem:
   three I/O reads on the admission path buy an earlier refusal and no guarantee, because
   continuo's and git's own checks remain the authority and the check-then-use window stays open
   behind them.
4. **Collisions rondo would cause become impossible; collisions rondo did not cause are refused
   where they are refused today.** The first class is made impossible atomically, by derivation
   plus a durable claim. The second — a person who created `rondo/iter-005` by hand — is still
   discovered inside `lap perform`, after continuo's run row exists, and rondo answers it in its
   own words naming abandon-and-readmit under a different iteration id, rather than relaying
   continuo's sentence about branches. It does not loop: a retry that kept minting would be a retry
   against a namespace rondo does not own.
5. **The triple is stored on the `iteration` row**, written by `reserve()` in the same
   `BEGIN IMMEDIATE` as the row itself, because a claim committed after the row is a claim with a
   window in it. Not a fourth table: one row per iteration keyed by the iteration is a table shaped
   like a column. `IterationFields` **excludes** the three, so a transition that wrote them again
   is a type error — two authorities for one fact is how a row moves its own claim off a name it
   was already admitted under.
6. **`leaseClaimantId` is not required to be fresh but is derived anyway.** Nothing measured
   requires a per-run claimant. It is the holder continuo records in its lease audit trail, and a
   constant holder across N concurrent laps makes that trail unable to say which lap wrote — a cost
   that falls due exactly when N stops being one.
7. **Uniqueness is three partial unique indexes over a generated `holds_identifiers` column**,
   which is null exactly when a row is **terminal and unspent**, with `identifiers_spent` set by the
   single transition into `admitting` and by nothing else. So a live row holds its triple, a
   terminal **spent** row holds it for ever — continuo's run exists, the branch exists, the worktree
   exists — and a terminal **unspent** row releases it. This is `D-0019` rule 10's shape B applied a
   second time.
8. **Two bounds, not one.** `maxOccupying` counts the `occupying` column of rule 2;
   `maxLive` counts every non-terminal row. **The bound and the column are one definition**: a
   `maxOccupying` defined over `admitting`/`admitted`/`performing` alone would let two `planned`
   rows both pass a bound of one and then both perform, and would drop `stalled` out of rule 2's
   fail-closed rule. `maxLive >= maxOccupying` is **validated** rather than assumed, because the
   other way round is not merely tight but unsatisfiable. The single-bound alternative was
   available and is expressible under this one by setting the two equal; the converse is not, and
   that asymmetry is the whole argument.
9. **`runId`, `topicBranch` and `workspace` leave `RunPlan`**, replaced by one `workspaceRoot`.
   `parties.grantee` is filled by the allocator, and the equality check against the run id **stays**
   as an assertion about rondo's own two writes — placed where it can never fail silently rather
   than deleted as unreachable. **This fires the first half of `D-0019` rule 3 and leaves the second
   half untouched**: rondo gains an allocator and still gains no defaults for a fence's geometry.
10. **The ledger is a counting predicate inside `reserve()`'s own `BEGIN IMMEDIATE`**, not a wider
    index and not a slot table. Both counts and the insert are in one transaction, because a bound
    checked in one transaction and enforced in another is the deferred-transaction window
    `src/store/sqlite.ts` already rejects one level up.
11. **What the counted bound gives up is stated rather than argued away.** The invariant stops being
    the database's. Under `iteration_one_live` a row inserted from outside rondo's code could not
    violate single-flight; under a counted bound it can, silently. `D-0019` rule 10 bought
    "making 'at most one non-terminal iteration' the **database's** invariant", and that is what is
    being spent. The slot table would have kept it, at the cost of making the bound a row count
    whose change is a data migration under a lock. This is recorded as a test, not only as prose:
    `test/store/ledger.test.ts` demonstrates the out-of-band insert going unrefused.
12. **The bound is a `HostPolicy`, read once where the store is opened, never on `LoopPolicy`.**
    `admit()` takes a policy per call, so a bound placed there is a bound each request states about
    the whole host, and "the bound" becomes whichever caller arrived. **`maxIterations` is not this
    number**: it bounds attempts of one request and is compared against a fresh iteration's zero
    attempts, where these bound concurrent requests. Different axes, different owners.
13. **The durable, operator-editable bound is named and not taken.** A resident host that must be
    restarted to change its own concurrency is a poor resident host, but that is `D-0020`'s
    operating surface, and taking it here would settle a surface decision inside a scheduling one.
14. **A capacity refusal writes a demand row** — timestamp, request, the bound in force and the
    occupancy observed — in a table of its own, outside the iteration table and outside any lock, so
    that `D-0019` rule 9's "no row, no lock" still holds and a refusal still costs about a
    millisecond. It is the **demand** measurement `D-0012`'s last falsifier asks for and that no
    other artefact in the tree can produce: it is the only way to tell a bound that is *binding*
    from one that is merely *set*, which is the difference between raising it on evidence and
    raising it because somebody complained.
15. **The sites that change together are a closed list**, and it includes four that carry no
    `rondo#8` comment because they are types and API shapes rather than DDL: `readLiveRow`'s
    single-row read, `readLive()`'s singular answer, `occupied`'s single `liveIterationId`, and
    `isLiveIndexViolation`'s match on the index name. `readLive()` becomes plural.
    **`settle()`'s `live IS NOT NULL` guard is on the list to be left alone**: it exists to refuse
    overwriting a finished outcome, which is a question about the row's own lifecycle, and moving it
    to `occupying` would let `abandon()` overwrite a `closed` row.
16. **`inTransaction`'s body may not be `async`, enforced rather than assumed**, twice: the store
    refuses a thenable return at runtime, and an AST sweep in
    `test/architecture/import-boundaries.test.ts` refuses an `async` body at the moment it is
    written. The type `<T>(body: () => T) => T` admits a promise-returning body, `COMMIT` would run
    before the awaited work, and the failure is invisible under one in-flight iteration and a torn
    transaction above one.
17. **`maxOccupying` may exceed one only after a `continuo D-1104` that contains the
    holder-identity half, not merely the schema half.** continuo serialises `lap perform` on one
    global delivery resource; until that changes, a second concurrent lap is refused there rather
    than here, and raising this number would make rondo admit work continuo will refuse. It is left
    at **1**, settable, so that the day it lands is a policy edit and not a code change.
18. **A shared endpoint destination directory across concurrent laps rests on `D-1104`'s per-run
    fence keys**, not on `continuo D-0085` alone: the dropbox's fence file is keyed by the lease
    resource. Recorded as a dependency; unreachable while `maxOccupying` is one, which is why it is
    recorded rather than solved.
19. **The loop's back edge (`iterate`) is not brought back by this entry**, though
    `src/refrain/loop.ts` says it "returns with the allocator". That sentence is older than this
    decision and is now wrong: a retry edge is a question about `maxIterations`' dormant
    post-admission meaning, and it goes to rondo's gate as its own entry.
20. **rondo does not retry a `LeaseHeld` refusal.** continuo puts an error class on the wire and
    rondo decodes it, but the conductor discards it at the boundary and rondo's own protocol module
    says the class "is a hint, not a taxonomy". Building a retry on a hint continuo declines to
    promise is `D-0015` rule 7's failure mode with an extra step. The cost is recorded: the teardown
    path leaves a delivery lease standing for up to its 60 s TTL, and under a raised bound two
    admissions land inside that window more often. A promised refusal class is **asked of continuo's
    gate**, not built here.
21. **The ordering case pins the absence of a promise.** Nothing in the tree queues: `admit()`
    refuses immediately and returns. What is asserted is what is promised — two admissions racing at
    the bound produce exactly one reservation and exactly one refusal, never two of either — and a
    second case records that **no ordering is promised and starvation is possible**, so a later
    reader finds a decision rather than a gap. A durable queue is `D-0020`'s.
22. **Every capacity case carries an observed-red control** — the same call with the bound one
    higher reserves — without which the group passes against a `reserve()` that refuses everything.
    It carries **one sub-case per non-terminal status**, because the bound's status set is where
    this design was wrong once.
23. **The bound is an admission control, not a conservation law.** It is read in `reserve()` and
    nowhere else. `stall()` writes `stalled` from any status and `resume()` reaches it from
    `awaiting_human`, so a suspended row may re-enter the occupying set without a reservation and
    occupancy may read higher than the bound. **This is permitted rather than refused**: refusing
    the transition would leave a row at `awaiting_human` promising a gate that is not there, which
    is the state `stalled` exists to avoid.
    **The excess is bounded by `maxLive`, not by one, and it does not drain on its own.** An
    earlier draft of this rule said it "cannot grow, because `reserve()` already refuses at the
    bound", and pinned it at "2 of 1". That is wrong, and an adversarial pass against the
    implementation is what showed it: the `awaiting_human` to `stalled` edge is **per row** and
    takes no reservation, so every iteration `maxLive` lets accumulate at a gate can cross it
    independently. The occupying set therefore reaches `maxLive`. Two consequences follow and both
    are stated rather than discovered. First, **raising `maxLive` raises the worst-case occupancy
    one for one** -- so the knob this entry advertises as safe today, because it changes nothing
    about execution, does change this. Second, **`RELEASED_BY` gives `stalled` exactly one
    releasing event, an operator's `abandon()`**, so the excess persists until a person clears it
    and the refusal must say so rather than telling anyone to wait.
    What survives from the original reasoning is the part that matters: the overshoot is
    **fail-closed**. Every row counted in it is `stalled`, nothing of a `stalled` iteration is
    running, and no additional lap executes. What is lost is admission, until a person acts.
    **This is rule 23 meeting its own falsifier below**, recorded here rather than left for a
    later reader to find as a surprise.
24. **The iteration id gains a closed alphabet, `^[a-z][a-z0-9_-]{0,63}$`, checked in `admit()`
    before `reserve()`** — the same shape `D-0019` rule 12 holds cadenza's role names to, so rondo
    has one identifier shape rather than two. Without it the derivation is neither contained nor
    injective: a workspace can escape its root while still passing the absoluteness check, and two
    ids can name one directory. **Recorded as a reduction**: ids legal before this entry are illegal
    after it, and every id in the tree and the dogfood record already conforms.
25. **The derived workspace component is prefixed `iter-`** rather than deny-listing Windows device
    names. `con`, `nul`, `aux`, `prn`, `com1`..`com9` and `lpt1`..`lpt9` all match the alphabet and
    are unusable as path components on `windows-latest`, which is a required double-green cell. A
    prefix removes the class where a denylist has edges — a reserved name with an extension, a
    trailing dot or space — and it makes the three derived values consistent, since the run id and
    branch already carried prefixes and the workspace was the only bare one.
26. **rondo gains a schema migration, because it had none and now needs one.**
    `CREATE TABLE IF NOT EXISTS` is a no-op against a table that already exists, whatever its
    columns, so no DDL change since `D-0019` would have reached an existing database — a gap nobody
    had stepped in because no column had ever been added. The shape taken is the small one: a
    declarative list of columns, a diff against the table, and an `ALTER TABLE ADD COLUMN` for each
    missing one — **inside one `BEGIN IMMEDIATE`, with the back-fill**. `ALTER TABLE` commits on
    its own, so a process that stopped between adding `identifiers_spent` and filling it would
    leave a database whose columns are present and whose claims are wrong, and whose next open
    would find nothing missing and skip the back-fill for ever.
    **The back-fill is part of the migration and not an afterthought.** A legacy row keeps the
    claim it actually had: `identifiers_spent` is set from `run_id IS NOT NULL` — which before this
    entry meant exactly "this iteration reached `admitting`" — and the triple itself is read out of
    the stored plan, where it lived, because a row whose branch and workspace stayed NULL would sit
    outside all three claim indexes and let a later iteration be handed a branch git already has.
    The order matters and is stated in the code: the spent bit is read before anything writes a run
    id from the plan, or the signal it rests on is destroyed.
    **A database that already holds two iterations claiming one name cannot take the indexes**, and
    that is legal in a database written before this entry, where the triple was the operator's to
    type. rondo refuses to open such a store, in its own words, rather than opening one whose
    claims it cannot enforce. **Versioned migration files were considered and rejected** — continuo carries that
    machinery and is right to, but rondo's store is one module over one table with no
    down-migration and no branch in its history, and a version counter would be a mechanism whose
    failure modes exceed the thing it guards. **It is a reversible choice**: the moment a second
    table needs a coordinated change, this becomes the wrong shape.
27. **Dropping `iteration_one_live` is this decision's consequence and is not a migration step.**
    It is named separately from rule 26 because rule 11's cost is *paid* here, on existing
    databases: the instant that index is dropped, "at most one non-terminal iteration" stops being
    something SQLite guarantees and becomes something `reserve()`'s transaction does. Leaving it in
    place was not an option — it refuses a second live row unconditionally, so an operator's
    existing database would have ignored `maxLive` and behaved as though this entry had not landed.
    **The reversibility is partial and the asymmetry is the point**: the index can be recreated, and
    will succeed exactly while at most one non-terminal row exists. Once a host has actually
    admitted a second live iteration, it cannot be recreated until an operator ends one of them —
    so a downgrade to a rondo that recreates the index on open will fail to open the database.
    **The migration is reversible; the history it enables is not.** That the code still holds the
    bound with the index gone is asserted directly rather than assumed.
28. **The plan payload needed a migration too, and it is a different one.** The `plan` column is
    persisted verbatim, so adding `workspaceRoot` to `RunPlan` makes payloads written before this
    entry fail their own re-validation — and that re-read happens on the way back *into* a live
    iteration, so the failure would have arrived as `stalled` on rows a person was already waiting
    on, including laps already paid for. A stored payload with no `workspace_root` therefore has one
    derived from the stored workspace's parent, which is what it actually was. **An operator's plan
    file is deliberately not given the same latitude**: there `workspaceRoot` is the one path a
    person must supply, and inventing one would turn a typo into a workspace somewhere they did not
    name. This is one field's repair and not a general mechanism; the plan column's want of a
    versioning story is a residual below.

    > **Note (D-0028, 2026-09-07).** The residual is answered. The payload now carries
    > `payload_version` and this repair is the first rung of its upgrade ladder rather than a
    > special case; the derivation and its guard are unchanged, and the guard is what keeps this
    > rule's "an operator's plan file is deliberately not given the same latitude" true now that
    > the ladder runs at both entry points.

### What this does not do

- It does not make two laps run at once. `maxOccupying` stays at one until `continuo D-1104`
  (rule 17). What it parallelises is iterations waiting on a person.
- It does not shorten any human wait. The measured 104.5 s was one operator reading `--help` between
  commands and is not a floor. Nothing here makes an answer arrive sooner; it stops one unanswered
  question blocking unrelated work.
- It does not widen `R-10` into a wider index. It removes the index and puts the invariant in a
  transaction, and rule 11 records the cost.
- It does not give rondo defaults for a fence's geometry (rule 9).
- It does not add the loop's back edge (rule 19).
- It does not decide the multi-plane topology, which issue #8 withdrew. One control plane throughout.

### Residuals, with who decides

| Residual | Why not here | Who decides |
|---|---|---|
| A durable queue with an ordering promise | needs a restart story and a surface; rule 21 pins its absence instead | `D-0020`'s operating surface, on evidence from rule 14's refusal rows |
| The bound as a durable operator-editable row | a surface decision, not a scheduling one (rule 13) | rondo's gate, with `D-0020` |
| The loop's back edge | it is `maxIterations`' dormant post-admission meaning, not capacity (rule 19) | rondo's gate, as its own entry |
| A versioning story for the `plan` column | rule 28 repairs one field; the column has no general mechanism, and a second added field will meet the same wall | rondo's gate, in whichever entry adds one |

> **Note (D-0028, 2026-09-07).** This row is answered. The column carries `payload_version` and
> reading climbs an ordered ladder; rule 28's repair is its first rung. The second added field met
> the wall as predicted -- it was `pull_request_base_branch` under D-0027 -- and that is what took
> the entry.
| A promised refusal class for `LeaseHeld` | a refusal taxonomy is continuo's to offer, and rondo may not build on a hint (rule 20) | continuo's gate |
| Two host processes against one store | not proposed and not forbidden; the counted bound is per-process where the index was per-database, which narrows what a second process would be safe to do | rondo's gate |
| `probe-evidence.txt` overwritten by concurrent probes | continuo already treats the write as best-effort | continuo, if it stops being best-effort |

### What would falsify it

- **`awaiting_human` turning out to hold something after all** — a continuo resource, a rondo timer,
  an endpoint still writing — which would make rule 2's release unsafe and collapse the design back
  to one bound. This is the claim most exposed to being wrong, because it rests on reading one
  `finally` in continuo and one line of the dogfood record.
- **A second edge into the occupying set** that rule 23's reasoning does not cover — one that is
  **not fail-closed**. The "can repeat" half of this falsifier **has already fired**, before the
  entry was merged: the `stalled` edge repeats once per suspended row, which is what rule 23 now
  records. It stayed inside the entry rather than reopening it because the excess is fail-closed
  and bounded by `maxLive`. An edge that is neither would force the bound to be read somewhere
  besides `reserve()`, and that is a different entry.
- **`stalled` acquiring a releasing event that is not an operator**, which would make rule 23's
  "does not drain" false in the good direction and is worth noticing rather than inheriting.
- **The closed alphabet turning out to be too narrow for a real id** — an operating surface that
  wants uppercase, or an id rondo did not mint — which would put rule 24 back to a reversible
  path-safe *encoding* rather than a restriction.
- **A fourth thing the allocator must mint**, or a fifth path in `RunPlan` that is per-run inside
  continuo in a way this entry did not open.
- **`git worktree add` turning out not to be atomic against a concurrent creation of the same
  branch**, which would mean rule 4's "collisions rondo did not cause" have a race in them and not
  only a refusal.
- **A `D-1104` that takes only the schema half** being accepted at continuo's gate, which would
  leave `maxOccupying` at one indefinitely and make rule 8's two-bound argument the whole of what
  this entry delivered.
- **Refusal rows showing no demand.** If rule 14's counter runs for months at one refusal, then
  `maxLive > 1` is a bound nobody was waiting on, and this entry's premise — that the human wait
  blocks unrelated work — was true in shape and false in practice.
- **The 60-second `abandon()` window turning out to be the common path** rather than the teardown
  exception, which would make rule 20's "do not retry" a decision that loses laps rather than one
  that avoids a hint.
- **A second host process being introduced**, at which point rule 10's count — which serialises
  through one connection's `BEGIN IMMEDIATE` — has to be re-argued against `SQLITE_BUSY`, which
  `transition()` currently reports as a defect and which is a retry.
- **rondo's ledger measuring the lap term as binding after all**, which would mean the 17% / 83%
  split was an artefact of one operator's pace rather than a property of the work.

---

## D-0028 — The plan payload carries its own version: an ordered read-side upgrade ladder, strict again at the version that introduced each field, and separate from the schema's migration on purpose

**Status:** accepted (2026-09-07, rondo's human gate). Closes rondo#34.

rondo has two places that store data. `D-0023` rule 26 gave the first one — the `iteration`
schema — a migration, and named the second as still owing one: the `plan` column, a JSON payload
persisted verbatim and read back by `readPlan`, which validates all thirty-four fields and refuses
by field name. **Adding a field to `RunPlan` makes every existing row unreadable**, and that
refusal arrives on the way back *into* a live iteration, so it is filed at `stalled` on a row a
person is already waiting on — including a lap already paid for.

Twice now that has been answered one field at a time. `D-0027` added a bespoke "absent reads as
null" reader for `pull_request_base_branch`; `D-0023` rule 28 added a bespoke repair deriving
`workspace_root` from the stored workspace's parent. Each is correct for its own field and neither
generalises: applied to every new field, the first turns a payload whose stated virtue is *refuses
by field name* into one that silently accepts anything absent, which is the opposite property. The
next field would have faced the same choice with no rule to appeal to.

### What was measured before deciding

- **One key, not a pattern.** `readAbsentAsNullString` was used at exactly one call site, for
  exactly one key, at the time this entry was taken. The relaxation had not yet spread; it was
  about to.
- **The payload format is also the plan-file format.** `readRunPlan` is the single entry both
  documents pass through — a stored payload via `readPlan`, and an operator's plan file via
  `src/access/cli.ts`'s `loadPlan` — and `docs/operations/rondo-cli.md` advertises that *the `plan`
  column of any past iteration row is a valid plan file*. A migration applied at one entry and not
  the other would make that promise false in one direction.
- **`plan_digest` is verified on every read.** `iterationStore`'s reader recomputes the digest over
  the stored bytes and refuses a row whose column and digest disagree.

### Decision

1. **The payload carries `payload_version`, an integer, and `planPayload` writes it.** A document
   with **no** version key is version **0**: every row rondo wrote before this entry, and every
   plan file anybody has typed. Absence is a shape, not an error.
2. **Reading climbs an ordered ladder of pure steps, in memory, on the way out.** Entry *n* of the
   ladder takes a version *n* record to version *n* + 1. A step may only supply what a newer
   `RunPlan` field needs; it may not consult the filesystem, the clock or the store, because it
   runs on the path back into a live iteration and a step that can fail for an external reason
   would file that iteration at `stalled`. **The current version is the ladder's height** rather
   than a constant typed beside it, so a version and a set of steps cannot disagree: appending a
   step *is* the version bump.
3. **The stored bytes are never rewritten, and that is the reason the two halves do not share one
   mechanism.** This is the load-bearing sentence of the entry, and it is a judgement rather than
   an omission — `D-0023` rule 26 left "the moment a second table needs a coordinated change, this
   becomes the wrong shape" as its own reversal condition, and a later reader is owed the
   difference between *not converged yet* and *deliberately not converging*. The schema's migration
   is applied **once, in place, destructively, under one transaction**. The payload cannot be
   migrated that way: `D-0019` rule 4 persists the plan **verbatim** beside a digest of its own
   bytes, precisely so that "under what plan did this run happen" has an answer, and a lazy
   write-back would change the bytes and recompute the digest — at which point the digest detects
   the migration and nothing else. So the two halves share the *shape* — a declarative, ordered
   list, appended to rather than edited — and share no code. **What would reverse this**: a payload
   change that cannot be expressed as a pure function of the older record (a field whose value must
   be looked up rather than derived), which would need a real, written, one-time data migration and
   the digest question answered head-on.
4. **`readAbsentAsNullString` is retired, not sanctioned.** Its one field becomes a rung: the v0 →
   v1 step supplies `pull_request_base_branch: null`, which is what absence meant. At version 1 the
   field is **required**, so a current row that has lost the key is refused by name again. The
   general rule the issue asked for: *an additive field is strict at the version that introduced it
   and supplied by the step below it*, so tolerance is scoped to the shape that needs it rather
   than granted to the field for ever.
5. **A payload declaring a version this rondo does not have is refused, by name, saying both
   numbers.** This is the half a per-field relaxation could never provide. A payload written by a
   newer rondo may carry a *changed meaning* for a field this code does read; ignoring its unknown
   keys reads such a row as though it were current and acts on it. The refusal is the honest
   answer, and the sentence names what to run instead.
6. **The ladder applies at both entry points, and the operator's protection is kept by the guard
   rather than by the call site.** `D-0023` rule 28 kept the `workspace_root` repair out of
   `readRunPlan` so that a person who omits the field is refused by name rather than handed a
   directory they did not name. That property survives the move because the derivation fires only
   when the document carries a `workspace` — one of the three identifiers `D-0023` rule 9 forbids a
   plan file to carry at all. A hand-written plan file has no `workspace`, so nothing is derived
   and the refusal is unchanged. **One document's behaviour does change**: a copy of a pre-`D-0023`
   row's `plan` column, used as a plan file, now reads with the root that row actually had instead
   of being refused for a field the copy could not have carried — which is the runbook's promise
   kept rather than a latitude granted.
7. **The ladder supplies what an older shape omitted and never repairs what a newer one got
   wrong.** A key that is *present* and the wrong type is refused at every version. A step that
   cannot recover a field's meaning leaves it absent, and the field's own reader refuses it by
   name: the ladder's job is to say what an older shape *meant*, and a shape whose meaning cannot
   be recovered is a refusal rather than a guess.

### What this does not do

- It does not version the `iteration` schema. That half keeps `D-0023` rule 26's column diff, for
  rule 3's reason.
- It does not reject unknown keys in a payload. A version 1 document with an extra key still reads,
  as it did before; what the version buys is detection of a *higher* version, not of a stray key.
- It does not migrate anything on disk. No row is rewritten by this entry, and no row needs to be.
- It does not add the lineage column `D-0027` rule 9 deferred "to the entry that adds a migration
  to the store". That entry was `D-0023`, on the schema half; this one adds no column, and the
  deferral stands.

### What would falsify it

- **A payload change that is not a pure function of the older record.** Rule 3 names it as the
  reversal condition, and rule 2's "no I/O in a step" is where it would first be felt.
- **The ladder growing long enough that reading an old row is a chain nobody can follow.** The
  measured height today is one. A rondo whose ladder is tall enough that the steps need their own
  tests to compose is a rondo that should have written a one-time migration and dropped support for
  the versions below it — which it may do, because the version in the bytes is what makes "we no
  longer read version 0" a sentence rondo can say precisely.
- **`plan_digest` ceasing to be verified on read**, which is the fact rule 3 rests on and which was
  measured in `src/store/sqlite.ts` on 2026-09-07.
