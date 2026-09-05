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

---

## D-0001 — How rondo consumes continuo and cadenza in lap 1: a CLI process boundary for continuo, and nothing at all for cadenza

**Status:** superseded by D-0018 (2026-09-06). Accepted 2026-09-05 (rondo#1).

> **Supersession note.** Item 1 wrote its own rule — a dependency on either sibling "in any
> specifier form" supersedes this entry — and D-0018 takes one on cadenza, which also retires item
> 3. Supersession here is whole-entry, per "How to use this file", so **items 2 and 4 are not
> retired with it**: continuo across a CLI process boundary and the duty to record which continuo
> revision drove a run are re-argued in **D-0015** and implemented in **D-0017**, which are where
> those two claims now live. Nothing below is edited; the annotation above this line is the earlier
> one, from D-0015 and D-0016.

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
  re-affirmed that on two facts, and **both have changed**: `cadenza D-0035` accepted a delivery
  route for a consumer that installs with `--ignore-scripts`, and `cadenza D-0034` put the
  agent-type record on the exported surface. D-0016 named each of those as one of its own
  falsifiers.

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
own entries lean on was not among them. At this revision the barrel exports **80**, and the eight
that matter here are the agent-type record and its renderer:
`agentType`, `AgentType`, `AgentTypeInput`, `agentTypeDigest`, `agentTypePayload`, `isAgentType`,
`requireAgentType` and `contractInputForAgentType`. That is D-0016's second falsifier, fired by name.

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
