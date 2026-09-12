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
| D-0022 | The advisory component: a pure function in its own layer, three authorities, one ledger per fact — and the widening a lap-1 retry actually takes, which is a fresh plan and not a successor contract | accepted |
| D-0029 | An independent reading of what a lap produced: material for the person at the gate, one refusal at `publish`, and a verdict that cannot certify what it never read | accepted |
| D-0030 | The lineage `D-0027` deferred: one nullable column on the iteration row, written once at reservation, refused when it names nothing, and read where provenance is shown | accepted |
| D-0031 | The last field `revise` could not see before it spends the gate: rondo reads one run, and only an answer counts | accepted |
| D-0032 | The record the operator's surface has to be able to show: alternatives inside one immutable proposal, a basis that is a locator, a durable last-look mark, and one table counting what was put to the operator and what was not | accepted |
| D-0033 | Nothing new owns the work between laps: three existing owners, a snapshot that widens instead of a component that decides, and one gap named rather than filled | accepted |
| D-0034 | An explanation carries claims and no recommendation: how `D-0032` rule 1 and rule 5 are read together | accepted |
| D-0035 | What actually releases the conductor's slot: the exit status continuo's contract defines, and an abnormal end that keeps it | accepted |
| D-0036 | The operator's inbox, decided as three open questions and not as a fourth record design: a presentation counted once per subject, the conversation only as far as elevation reaches, and a two-way wait that admits it is not three | accepted |
| D-0037 | The between-laps composition: a fourth snapshot rather than a fourth component, three claim families rondo can ground, one verb an operator runs, and a breakdown that answers over an interval | accepted |
| D-0038 | Whether the premise under a proposal has moved, decided per basis and at render time: the record and not the field as the unit, re-gathered rather than remembered, and `undetermined` as a value the screen may never round to unchanged | accepted |
| D-0039 | A lap cannot verify what it wrote, and `--allowedTools` is not the way out: `D-0011`'s first falsifier fires, the fence input rondo asks continuo for, and what `granted` maps to once it exists | accepted |
| D-0040 | Where a run's authorisation is written down now that continuo owns a table for it: `D-0020` rule 4's falsifier fires in substance, the durable home does not move, and the envelope carries only facts that exist today | accepted |
| D-0041 | The one write the operator's page may do: an unattended redraw and a person's click are told apart at runtime and never by type, the approver is the only actor, and the write is a single function rather than a store | accepted |
| D-0042 | What counts as a presentation on a page that redraws itself: the press and not the render, recorded before the gate is answered, and the reader who does not press left uncounted | accepted |
| D-0043 | The trigger a stopped lap pulls: one proposal at the abandon the conductor's own arc reaches, `contract_keys` because it is the only option set that is a choice, and a successor identity rondo mints and nobody has yet adopted | accepted |
| D-0044 | The second model tier is `mechanical`, it is reached by naming an agent type and never by rondo reading a request, and its model id waits on rondo recording what a lap costs | accepted |

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

> **Annotation (2026-09-11, from D-0035).** Added after this entry was accepted, and additive: no
> claim, measurement or date below is edited. **Rule 11's table stands exactly as written; the
> sentence under it that says why does not.** The rule releases the lock on a refusal because "an
> answer arrived, so the CLI is over and no worker of its is still running", and `continuo D-1102`
> made that sentence checkable: some refusals now name a session, and continuo's teardown declines
> to stop one in three states. **D-0035** re-measures it and keeps the rule's conclusion on a
> different fact -- a live child holds `lap perform`'s process open, so an invocation that came back
> is one whose child is gone -- and narrows what counts as "an answer arrived": the two exit statuses
> continuo's contract defines, rather than any outcome that is not a timeout. A death by signal or an
> exit 1 now reaches this rule's `performing`-with-no-answer row instead of its refusal row.

> **Annotation (2026-09-07, from D-0029).** Added after this entry was accepted, and additive: no
> claim, measurement or date below is edited. Two of this entry's own statements have been overtaken
> by later entries, and **D-0029** is where each is answered.
>
> - **Rule 16 (`R-15`)'s trigger has fired, in its second limb.** The rule refused the conductor's
>   own verify and named its trigger as "a lap whose gate is opened after rondo's own check rather
>   than before it, **or a verify verdict a human would act on differently from the gate's own
>   contents**". The first limb has **not** fired: the gate is still opened inside `lap perform`, and
>   nothing in rondo can change that. The second has, and the reason is that **this rule's premise
>   expired rather than that its conclusion was wrong when taken**. It rests on "a failing verify's
>   only available action is to ask the operating surface to withdraw the gate", which was exhaustive
>   on 2026-09-06 because rondo had no operating surface at all; `D-0025` and `D-0026` gave it one on
>   the same day, and refusing `publish` is a second available action that spends no human's window.
>   It rests further on "the same action a human reading the gate would take", and what a human
>   reading the gate is given was since measured: the gate's `rationale`, which is the worker's own
>   account of its own work, with no workspace path and no topic branch beside it
>   (`docs/operations/lap-1-dogfood.md:964-1000`). **The rule's conclusion for the arc is kept** — no
>   verify inside the state machine, and no untested branch on the path to the one human contact —
>   and `D-0029` puts nothing on that path.
> - **Rule 7 (`R-7`)'s third reason has expired.** It gave three grounds for refusing a model-judged
>   evaluator, of which the third was "its most valuable output is the retry the lap-1 arc cannot
>   perform". `D-0023` supplied the allocator this entry's own falsifier list names as the trigger
>   under almost everything, and `D-0027` made a revision a second lap a person types. **The first
>   two grounds stand** — a non-deterministic verdict on the path to the one rationed human contact,
>   and not being expressible as a unit case — and they are why `D-0029` ships a deterministic
>   drafter first and admits a model one only as material for a person.

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

> **Annotation (2026-09-12, from D-0044).** Added after this entry was accepted, and additive: no
> claim, measurement or date below is changed. **Rule 3's provision is taken up.** The concrete ids
> were recorded as provisional "pending an operator's ratification", and `D-0043` is the policy a
> second pair needs before one can be ratified: the second tier is named `mechanical`, it is chosen
> by naming an agent type rather than by rondo or by a request, and **no pair is written into
> `MODEL_TIER_TABLE` until rondo records what a lap costs (rondo#96)**. The falsifier below reading
> "a second tier arriving in an agent type before the table has a pair for it" is answered in
> advance rather than fired: the refusal still stands, and the tier that would trip it now has a
> decision saying what it means.

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
   > **Note (D-0031, 2026-09-11).** **Six verbs now**, and the sixth is a read: `RUN_SHOW`
   > (`continuo.run.show/1`), driven only by `revise`, only to learn whether the successor's run id
   > is already taken, and read so that only an *answered* document is a fact -- the class of a
   > refusal is still never consulted. This rule's count is what `D-0027` rule 9 said would have to
   > move before that check could exist.

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

   > **Note (D-0030, 2026-09-10).** The deferral has been carried out, and this rule's first
   > sentence no longer describes the tree. `D-0023` supplied the migration mechanism it was
   > waiting for; `D-0030` adds `supersedes_iteration_id` to the iteration row, writes it at the
   > successor's reservation and reads it where provenance is shown. Nothing else in the rule
   > moves: there is still no bound on how many revisions a request may have, and still no
   > `revise` from anywhere but the live iteration's open gate.

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

   > **Note (D-0031, 2026-09-11).** The run id half has been closed: `revise` drives `run show`
   > before the walk and refuses when the control plane answers with the successor's run. `D-0023`
   > had already narrowed the hole first -- the run id became a function of the iteration id, which
   > this rule's preflight already checked -- so what the check catches is a control plane holding a
   > run rondo's store does not know about. The paragraph's general claim stands, and `D-0031`
   > rule 5 sharpens it: `run admit`'s two other caller-caused refusals (an unknown role, an
   > unauthorised `--cli-arg`) remain reachable when continuo's roster or allowlist moves between
   > laps, and the verb this rule imagines would not cover the topic branch or the workspace at all,
   > because continuo checks those in the materialiser rather than at admission. The preflight is
   > still a set of named checks rather than a guarantee.

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

  > **Note (D-0030, 2026-09-10).** The deferral no longer stands, and this bullet's first two
  > sentences are unchanged by that: `D-0030` adds the column on the schema half, through
  > `D-0023`'s `ADDED_COLUMNS` diff, and touches no payload version and no step of this entry's
  > ladder. Which half a change belongs to is exactly the separation rule 3 bought.

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
---

## D-0022 — The advisory component: a pure function in its own layer, three authorities, one ledger per fact — and the widening a lap-1 retry actually takes, which is a fresh plan and not a successor contract

**Status:** accepted (2026-09-07, rondo's human gate)

The design is [`docs/design/advisory.md`](docs/design/advisory.md), whose rows `A-1` … `A-18` this
entry takes. It answers rondo#9: whether the component that proposes contracts and explains state
exists in rondo at all, in which layer, what it may read, what it may propose, and where the line
sits between proposing and deciding.

**The document is left as it was written**, as `parallel-admission.md` and `refrain-lap1.md` were,
so a later reader can see what was measured and when. Revising it before ratification was
considered and refused: a design document that is edited to match the tree it is being taken
against stops being evidence of anything. **This entry is therefore the authority wherever the two
differ**, and the differences are named rule by rule below rather than left for a reader to
discover.

**They are not incidental.** The design measured the tree at `878eea4`; **thirteen commits landed
between that measurement and this gate**, including the operating surface (`D-0024`, `D-0025`),
`revise` (`D-0027`) and parallel admission (`D-0023`). Every row was re-measured at `b9e284a` on
2026-09-07 before it was taken. Nine rows survived untouched, one had already been carried out, six
needed a measurement restated, and **one was falsified outright**.

**The falsified row is the interesting one, and the shape of its replacement is why this entry is
worth reading.** `A-17` decided that a retry after a `needs_approval` reuses the predecessor's
`(run id, topic branch, workspace)`, because a successor contract may not change its grantee and a
grantee is a run id. `D-0023` then made identifiers **derived** rather than typed, which removes
the reuse this row depends on — and the same derivation is what makes the replacement clean, because
an iteration id now fixes the whole triple *before* admission, so the contract a retry will be
issued under can be composed and shown to a person before they approve it. **The entry that
falsified `A-17` is the entry that made the row it replaces unnecessary.** Rule 17 is that
argument.

### Decision

1. **The advisory component exists, and it lives in a layer of its own, `src/advisory/`** (`A-1`).
   Its internal allowance is `["src/advisory", "src/store"]` and its **external allowance is
   empty**; `src/access` gains `src/advisory`. rondo#9's own title proposes `src/access` and this
   entry overrules it, on a measurement re-taken at `b9e284a`: the boundary test grants internals
   **per layer** (`test/architecture/import-boundaries.test.ts:124-161`, argued in its own comment
   at `:111-122`) and externals **per module** (`:208-285`, argued at `:185-192`), so "this one
   module may not import cadenza while its neighbours may" is a rule that table cannot express. In
   `src/access` under rule 5 below, the component that must never compose a contract would sit in
   the layer that may. A layer makes it a planted case instead of a review comment. **A module
   absent from the external table may import no external at all**, so the empty external allowance
   needs no entry — absence *is* the empty allowance.

2. **It is a total, pure function of an injected snapshot**, `propose(snapshot) -> Proposal`
   (`A-2`). Gathering is the composition root's. A function that returns a value cannot issue one,
   which is how "expresses no authority" becomes a type rather than a discipline, and it is what
   lets `test/advisory/` run with no database, no continuo build and no cadenza package. **One
   caveat is recorded rather than implied**: what the boundary test mechanically enforces is the
   absence of imports and of the five names in `FORBIDDEN_GLOBALS`
   (`import-boundaries.test.ts:552-558`), which does not include `Date`. Determinism beyond the
   import graph is a property of the tests, not of the boundary.

3. **What it may read at runtime is rondo's store, the pinned cadenza through the facade only, and
   admitted continuo `--json` verbs decoded by `src/continuo/protocol.ts` and handed over in the
   snapshot** (`A-3`). Never a sibling checkout, never continuo's SQLite file. Design-time
   measurement and runtime input are different things, and the document's own section 1 is the
   first. Two of the design's supporting sentences are stale and both widen the permitted surface
   rather than narrowing it: continuo now decodes **eleven** verbs, not six
   (`src/continuo/protocol.ts`, contracts at `:633,643,654,668,683,696,709,724,736,749,775`), and a
   `GATE_ANSWER` contract does exist (`:724-733`).

4. **Proposals are persisted as their own immutable, append-only record kind, with no `status`
   column** (`A-7`), carrying the columns the design's section 8 names — the snapshot **verbatim**
   beside its digest, so a proposal is re-derivable and not only re-readable. A row that can be
   rewritten to `approved` is a record of what somebody wishes had been proposed.
   `candidate_contract_digest` is **null on a proposal**, always: a digest there would be the
   advisory claiming to have composed something. **"Immutable" is a property of the schema and of
   the absence of any writer that updates, not of a trigger** — there are no triggers in
   `src/store/sqlite.ts`, and `D-0023` has just traded one schema-level invariant for an
   application-level one (rule 13 below). The entry claims it at that grade.

5. **`src/access` gains the `src/cadenza` arrow, and the facade gains a successor composer**
   (`A-4`). Not `src/refrain`, not a new layer, and the advisory calls neither. `D-0009` part 2
   and `D-0020` rule 2 both put the *issuer* of a widening at the
   operating surface. **Note what this grant actually reaches**, because internal allowances are
   per layer: `src/access` is now five modules and roughly 3400 lines, including the
   process-spawning `forge.ts`. That is the price of the mechanism rule 1 relies on, and it is paid
   knowingly. Under rule 17 the composer this row anticipated is **not called in lap 1**; the arrow
   is taken because the facade is where such a call would have to live, and withheld from use until
   something consumes it.

6. **`A-5` is taken as a past-tense record: the pin has already moved, and its evidence sentence is
   false at HEAD.** The design says `supersedeOnDecision`, `humanDecisionRecord`,
   `HumanDecisionRecord` and `DecisionOutcome` "appear nowhere in the installed `dist/index.d.ts`"
   and that the pin is `e56d7e7`. Measured from the vendored bytes rather than from `node_modules`,
   which is the artefact this repository pins: `cadenza.pin.json` reads
   `5d5d9f408c29f6500c422c8e10e6b6a3a6882aaf`, and `package/dist/index.d.ts` inside
   `vendor/suisya-systems-cadenza-0.0.0.tgz` exports `supersedeOnDecision` at line 49 and
   `DecisionOutcome`, `HumanDecisionRecord` and `humanDecisionRecord` at line 67. The move landed in
   `0f20e4c` (#16), in exactly the isolated form `A-5` asks for. **The reason it reads as unmet is
   worth recording**: `0f20e4c` is dated 2026-09-06 07:46:43 and the design commit `07bba50`
   07:51:45, and `git merge-base --is-ancestor 0f20e4c 878eea4` is false — the design branch
   measured, five minutes later, a tree that never contained the pin move. A design document's
   measured revision and the tree it merges into are different things, and this is the worked
   example.

7. **`A-6` is taken with its hole list re-grounded, because four of the five fields it names are no
   longer `RunPlan` fields at all.** The recommendation stands: a proposal about a plan may be a
   **selection** among persisted plans, a **diff** against a named predecessor, and an **explicit
   list of the fields it will not fill** — and it may never fill them, because that would be the
   allocator `D-0019` rule 3 refuses. What has changed is the list. `D-0023` rule 9 removed
   `runId`, `workspace` and `topicBranch` from `RunPlan`, replacing all three with `workspaceRoot`
   (`src/refrain/plan.ts:91-111`), and `leaseClaimantId` is derived with them
   (`src/refrain/allocator.ts:139-158`). **So the hole a person still fills is `workspaceRoot` and
   the fence roots** — `repository`, `artifactRoot`, `stateRoot`, `interlockRoot`, `claudeOrgPath`,
   `endpointRecipient`, `endpointDestinationDir` (`plan.ts:117-125`) and `claudeCommand` (`:133`) —
   because continuo requires each absolute and outside the worktree and a rondo-side default would
   be rondo guessing at a fence's geometry. `RunPlan` now declares **thirty** fields
   (`plan.ts:87-259`), not thirty-one. **And one rule is added that the design could not have
   written**: naming an iteration id now names the whole triple by derivation, so a proposal that
   names a successor iteration id has, in that one field, said everything about identifiers there
   is to say.

8. **`A-8`'s ledger is taken with one exception named and bounded.** One home per fact, every other
   mention a reference, and the gate answer's home is continuo's `gate_transition.body`, copied
   nowhere. The design says the iteration row's `gateStage`/`gateOutcome` (`records.ts:300-301`) are
   the one unavoidable observation. **`D-0027` has since added a second, and it is a copy of the
   answer itself**: `rondo revise` passes the operator's gate-answer body verbatim into
   `revisionPlan` (`src/access/cli.ts:1246-1250`), which splices it into the successor's prompt
   (`src/refrain/revision.ts:172-186`, the splice at `:181`), and that prompt is persisted in
   `iteration.plan` under `plan_digest`. So the prose a person typed at a gate has a second home in
   rondo's store today. **This entry does not undo it** — it is `D-0027`'s decision and it is how a
   revision carries an instruction — but it bounds it: that copy is an **input to a plan**, it is
   never read back as the answer to anything, and no reader may treat it as the record of what a
   human approved. `A-8`'s rule is otherwise unchanged, and `D-0020` rule 5's refusal of prose in
   the gate-answer slot stands.

9. **One human decision authorises at most one issuance, and rondo's store is what guarantees it**
   (`A-9`): `supersedeOnDecision` or its rule-17 replacement, the delegation row and a
   `decision_consumption` row whose **primary key is `decision_id`**, in one `BEGIN IMMEDIATE`
   transaction; the decision row itself is never updated. cadenza cannot do this — it persists
   nothing and assigns the duty to its `S-7`, which `D-0020` rule 4 fact 6 accepts. `BEGIN
   IMMEDIATE` is still the store's idiom (`src/store/sqlite.ts:806`, re-affirmed by `D-0023` rule
   10). **Under rule 17 this row carries more weight than the design gave it**, because the four
   value checks of `supersedeOnDecision` — including the one that makes a decision unusable twice
   inside a lineage — are not run at all. Single use is rondo's, alone.

10. **The `needs_approval` iteration is never revived, rewritten or resumed; a new one is linked to
    it by lineage** (`A-10`). The store already enforces it: `transition` refuses any write whose
    `from` status does not match (`src/store/sqlite.ts:958-963`), and the row is terminal. The
    design's reason is unchanged and is quoted verbatim by `D-0027` rule 2. **One clause under the
    row is corrected here**: the design's section 7 item 3 says "the run id is the predecessor's",
    which rule 17 replaces — a new iteration necessarily carries a new run id.

11. **The candidate key sets are called "candidate" and never "permission"** (`A-11`), in type
    names, column names and rendered prose; authority is `classify()` over an actual contract.
    cadenza `D-0031` section 1: `granted` and `askable` are inputs to contract construction,
    consumed before the contract exists, and never a second answer standing beside one. **The check
    belongs in `test/advisory/` only** — `D-0023` has since put the word "permitted" into an
    unrelated capacity message in `src/refrain/interpreter.ts`, and a tree-wide grep would fail on
    it for no reason.

12. **`cadenza S-4`'s B lands before A, as an acceptance criterion** (`A-12`), with the record
    design of the design's sections 6 and 8 as the named exception that may go first. **The row's
    own enumeration is split here, because part of it has shipped and part of it is deliberately out
    of scope.** The blocking half of B — gate detail and the `answer` write verb — landed in
    `D-0025`'s command line (`GATE_ANSWER` at `src/continuo/protocol.ts:724`, driven from
    `src/access/cli.ts:520-524`), in reduced CLI rather than web-pane form. `gate list` and
    `close --outcome withdrawn` are **not** preconditions for A: `D-0025` rule 1 left `status` and a
    `withdrawn` close deliberately absent. The web and OIDC panes of `D-0020` rule 1 remain unbuilt,
    and the CLI is a reduction of B rather than B itself.

13. **The record is identical whichever drafter produced it, `drafter` is a column, and the first
    cut ships the deterministic drafter** (`A-13`). A model draft is a candidate like any other, is
    never presented unread, and never reaches a gate as anything but material. `D-0019` rule 7
    keeps a non-deterministic verdict off the path to the one human
    contact this design rations, and `D-0026`'s deterministic pull-request text is the precedent for
    shipping the deterministic one first.

14. **The test layering is the design's `A-14`**, with one correction: the `test/cadenza/` row is
    gated on **rule 5** (the facade gaining the composer and a seventeenth entry in its per-module
    allowlist at `import-boundaries.test.ts:238-250`), **not** on the pin move, which has already
    landed. The planted case in `test/architecture/` is the row that matters and is why rule 1 chose
    a layer over a module: it is the only one that can fail when somebody later adds one import in
    good faith. `EXPECTED_MODULES` (`:318-338`) is a floor asserted with `arrayContaining` and a
    length bound (`:998-999`), so listing new modules there is inventory hygiene rather than a
    requirement.

15. **There are two approval routes and neither invents a gate** (`A-15`). Route G: a lap ran and
    suspended, the human answers a question the *worker* raised, and continuo's
    `gate_transition.body` is the source of truth. Route S: no gate exists, the approval is recorded
    as rondo's own row, and **nothing is sent to continuo**. The measurement the row turns on holds
    at `b9e284a`: a `needs_approval` ends the request before admission, at terminal `abandoned`
    (`src/refrain/interpreter.ts:847-857` — the design's `:756-765`, moved), no run was admitted,
    `lap perform` never ran and no gate was opened; the only write of `awaiting_human` is
    `interpreter.ts:1154`, and it happens only after a lap has run. **rondo never mints a gate of
    its own to manufacture a question no run asked.** What route S loses is stated plainly: rondo's
    approver allowlist is the only bound on who may approve, and it exists today as an environment
    variable compared against a typed `--actor-id` (`src/access/cli.ts:661-676`), with no OIDC
    behind it until `D-0020` rule 2's precondition is met. **What is approved on route S is settled
    by rule 17**, and it is a plan and its contract digest rather than a key set.

16. **A route-G approval is made recoverable by `D-0019` rule 10's write order across the seam**
    (`A-16`), and three statements inside the design's row are corrected here. The row's summary
    says to drive one `gate show --json` afterwards and match the transition on
    `(gate_id, seq, actor_id)`; **the design's own section 6.4 repudiates that** in favour of the
    answer's own reply being the confirmation, and this entry takes section 6.4's form, not the
    row's summary. The row cites "a partial unique index in `iteration_one_live`'s shape"; **that
    index no longer exists** — `D-0023` dropped it (`src/store/sqlite.ts:586`) in favour of a
    counted in-transaction bound, and the idiom's live exemplar is `CLAIM_INDEXES` (`:493-499`),
    which is exactly a partial unique index over a nullable marker column. And the row's supporting
    measurement that a gate is answerable only from stage `presented` is false at HEAD. **Recovery
    still fails closed**: an intent whose reply was lost is reported for a person to settle, never
    completed by matching, because naming a transition is not proving this intent caused it, and
    reconstructing a decision from the gate's prose is composing a human's answer (`D-0009`
    part 3).

17. **`A-17` is replaced. The widening a lap-1 retry takes is a fresh `RunPlan` under a fresh
    iteration id — not a successor contract over the predecessor — and `supersedeOnDecision` is not
    consumed in lap 1.**

    **Why the original row cannot stand.** It reuses the predecessor's triple because a successor
    may not change its grantee. `D-0023` rule 3 makes the triple **derived** from the iteration id
    by a pure, total, invertible function (`src/refrain/allocator.ts:139-158`), and the iteration id
    is the `iteration` table's primary key (`src/store/sqlite.ts:422`), so a second iteration
    cannot carry the first one's run id. The reuse has no implementation path left.

    **And a second, independent obstruction, which the design did not measure.** rondo constructs a
    contract in exactly one place: `issueInitialContract` at `src/refrain/classification.ts:71`,
    inside `classifyPlan` (`:67`), from the agent-type record, the resolved project and
    `plan.parties`. The value is local and is never returned, persisted or handed on — the record
    the function returns reads only from cadenza's answer, the agent-type record and the project.
    **rondo has no path that accepts a supplied contract**, so an approved successor would have had
    no consumer even if its grantee had matched.

    **What replaces it.** A retry is an ordinary admission of an ordinary plan: a new iteration id,
    the triple derived from it, the abandoned row's plan with the proposal's diff applied, and —
    where the widening is the point — a **different agent type**, whose grants are what widens.
    `admittedPlan()` fills the identifiers from the allocation and refuses any plan whose
    `parties.grantee` is not its `runId` (`src/refrain/plan.ts:575-604`, the refusal at
    `:587-590`), so the contract issued at admission is issued to the retry's own run.

    **Why this still satisfies cadenza `D-0036`, which is the row's real obligation.** `D-0036`
    requires that a human approve **a specific contract identified by its digest**, because a record
    naming only the predecessor would let a two-key approval authorise a ten-key widening. That
    obligation is met without a successor, and **it is `D-0023` that makes it meetable**: because
    identifiers are derived, choosing the successor's iteration id fixes its `runId`, and therefore
    fixes `parties`, before anything is admitted. The surface can compose the exact contract the
    retry will run under — `agentTypeRecord`, `resolveProject` and `issueInitialContract`
    (`src/cadenza/facade.ts:136`, `:116`, `:155-161`) are all pure and all already exported — record
    it as rule 19's `composition` row, and show the human its digest **before** they approve. **The
    entry that falsified this row is the entry that makes its replacement exact.**

    **The binding that makes the approval enforceable at admission.** `classifyPlan` returns
    cadenza's own `contractDigest`, taken off the `Classification` rather than recomputed
    (`src/refrain/classification.ts:87`; cadenza `D-0026` puts it there so a reader can tell which
    contract produced which verdict). The surface compares it against the approved digest and
    refuses the admission if they differ. **`src/refrain` is unchanged by this rule** — the
    comparison is the composition root's and the store's, which is where rule 5 already puts
    issuance authority.

    **What this gives up, stated rather than discovered.** Three things, and the third is the real
    price:

    - **cadenza's lineage.** The retry's contract does not `supersede` the predecessor's; cadenza
      links them not at all. The lineage is rondo's columns alone (rule 4).
    - **the four checks in `supersedeOnDecision`**, including the one that makes a decision
      unusable a second time inside a lineage. Single use falls entirely to rule 9's
      `decision_consumption` primary key, which is why that row is not optional.
    - **the amplification bound.** A successor is bounded by what the delegator holds; an *initial*
      contract is bounded only by its agent type and project. So under this rule the predecessor's
      grants bound the retry not at all, and "widening" means whatever agent type a person
      approved. What stands in place of cadenza's bound is the approved digest and `D-0020` rule
      2's allowlist, and nothing else. **This is the cost of taking route C and it is taken
      knowingly**; the falsifier below names the condition under which it stops being acceptable.

    **A widening over an *admitted* run remains out of scope in lap 1**, unchanged: `lap perform`
    cannot be re-entered and the loop has no back edge (`D-0019` rule 6).

    **Two claims elsewhere are overtaken by this rule, and are recorded here rather than edited
    where they sit.** `D-0019` rule 15 makes a `needs_approval` a lap-1 dead end and gives as its
    reason that resuming "requires a widening successor contract, which rondo may not compose"; on
    this rule a retry needs no successor at all, so the reduction still holds but its reason does
    not — what actually blocks a retry today is that nothing yet builds the proposal, the decision
    and the approval, which rules 4, 9, 18 and 19 describe and do not build. That entry's stated
    trigger, "the first time a human wants to approve one", is this one, and correcting its reason
    is a dated annotation for a later gate rather than a change made in passing here. And the
    design's section 4 calls the retry "the one place the hole list is empty" because the triple is
    reused; the conclusion survives the loss of its premise, for a different reason — a retry starts
    from the abandoned row's plan, which already carries `workspaceRoot` and the fence roots, so
    rule 7's holes are filled by the predecessor rather than by the identifiers being reused.

18. **The contract the human was shown is recorded in its own immutable `composition` row, written
    before presentation** (`A-18`), carrying the contract's fields **as issued**, its digest, the
    predecessor it supersedes where there is one, and the cadenza pin that composed it — so
    `contract_digest` can be recomputed rather than trusted (`D-0020` rule 4 fact 1's reason). A
    refusal writes no delegation row, so without this the ledger would keep the candidate *inputs*
    and not the contract that was on the screen. The design calls the pin's mobility a forecast;
    it is now a fact, having fired once already (rule 6).

19. **The record design of the design's sections 6 and 8 may land before the surface work, and it
    carries one acceptance criterion the design does not state: unconsumed decisions must be
    enumerable.** "Which approvals were never spent" must be answerable by a query over the store,
    because under rule 17 an approved plan that is never admitted leaves no other trace anywhere —
    cadenza holds nothing, continuo was never told, and the iteration that would have carried it
    does not exist. Without this, "the human approved something that never ran" is a state the
    ledger cannot report. It is the detection point that route C's concessions make load-bearing.

20. **Nothing in `src/` changes on this entry.** It ratifies rows and takes no implementation. The
    record design (rules 4, 9, 18, 19) and the `src/advisory` layer (rules 1, 2) are separate work,
    in that order, behind rule 12's build order.

### What this does not do

- **It does not build the component.** No file under `src/` is touched by this entry, which is the
  discipline `advisory.md` states for itself and the one `D-0019` and `D-0023` were both taken
  under.
- **It does not revise `advisory.md`.** The document keeps its `878eea4` measurements, including the
  ones this entry records as stale. Where they differ, this entry governs.
- **It does not take rondo#8's allocator question.** `D-0019` rule 3 is untouched: the caller hands
  rondo a complete plan, and rule 7's hole list is what a person still fills.
- **It does not decide the operator conversation** (`D-0020` rule 5), which stays decided and
  unbuilt, or widen `GATE_SHOW`'s reader, which rules 4 and 16 both want and neither builds.
- **It does not annotate `D-0025`.** That entry's rule 5 still says "No allocator is added", which
  `D-0023` overtook; correcting it is a dated annotation on somebody else's entry and belongs to a
  gate, not to this one. It is carried as a residual.
- **It does not make `supersedeOnDecision` dead code.** Rule 5 takes the arrow and rule 17 declines
  to use it in lap 1; the machinery is cadenza's and is waiting on a consumer, not removed.

### Residuals, with who decides

| Residual | Why not here | Who decides |
|---|---|---|
| `D-0025` rule 5's "No allocator is added", overtaken by `D-0023` | A dated annotation on an accepted entry is additive but is still a change to the record; `AGENTS.md` section 7 keeps it out of a diff scoped to something else | rondo's gate, as its own annotation |
| A `GATE_SHOW` reader carrying the transitions array | Rule 4's snapshot tuple and rule 16's match key both need `transition_seq`, which no decoder supplies; the gate-detail pane needs it independently | `D-0020` rule 1's surface work |
| Enumerating **terminal** rows | `read(id)` needs an id already known and `readLive` filters terminal rows out (`src/store/sqlite.ts:225`, `:236`, `:742-746`), so the abandoned iteration this component most exists to explain cannot currently be found at all | the record-design task (rule 19) |
| The amplification bound rule 17 gives up | It costs nothing until an agent type exists whose grants are wider than one approval should carry | a later entry, if the falsifier below fires |
| `knip` and the first cut | `npm run verify` runs `knip`, which fails an exported `propose()` with no consumer, so rules 1 and 2 cannot land green without a caller | the `src/advisory` task |

### What was measured, and how

At rondo `b9e284a`, on 2026-09-07, with the cadenza pin read from
`vendor/suisya-systems-cadenza-0.0.0.tgz` rather than from `node_modules`, because the vendored
tarball is what this repository pins and a warm npm cache can install other bytes with exit 0
(`D-0018` rule 4). Every `file:line` in this entry was re-read at that revision; the design's own
citations were taken at `878eea4` and have drifted, which is why this entry re-cites rather than
referring to the document's numbers.

`D-0028` landed while this entry was being written and rewrote much of
`src/refrain/plan.ts`, which several rules cite. Those citations were therefore re-measured a second
time against `7c13245` before this entry was rebased onto it: the `RunPlan` interface and its thirty
fields, `workspaceRoot`, the fence roots and `admittedPlan()`'s grantee refusal are all at the lines
given above. That check is the entry's own subject applied to itself, and it is recorded because the
next reader has no way to tell a citation that was verified from one that merely survived.

### What would falsify it

- **A consumer for cadenza's successor machinery arriving in rondo** — a `classifyPlan` that can
  classify against a *supplied* contract, or a resumable lap. Rule 17's replacement exists because
  neither is true; either would restore `A-17`'s original question and re-open which of the two
  forms a widening takes.
- **An agent type whose grants are wide enough that approving it in one step is the wrong grade of
  decision.** Rule 17 gave up cadenza's amplification bound on the argument that the approved digest
  and the allowlist are enough; a catalog that makes "widen by choosing a wider agent type" a
  dangerous sentence is what makes that trade wrong.
- **`D-0023` being superseded so identifiers stop being derived.** Rule 17's exactness — the
  contract being computable before admission — is entirely a consequence of derivation, and rule 7's
  hole list would move back.
- **cadenza `D-0036` being superseded, or `HumanDecisionRecord` gaining a field.** Rules 15, 17 and
  18 are consumers of that entry's shape.
- **continuo recording an *authenticated* answerer**, which is `D-0009`'s own falsifier and would
  make route S's identity a proven fact rather than a claimed one.
- **The advisory needing to write.** Rules 1 and 2 are the whole design; the first requirement that
  cannot be met by returning a value is what falsifies them.
- **A proposal whose approval fits neither route G nor route S** — an approval binding to a second
  approver, or to a scope smaller than one plan.
- **The store growing a listing API for another reason**, which would cost this design nothing and
  improve it immediately: the residual above stops being a residual.
- **`gate show --json`'s payload changing**, to which `D-0017`'s accept-extra-keys rule
  (`src/continuo/protocol.ts:34-38`) applies unchanged.
- Any measurement above failing to reproduce at `b9e284a`.

---

## D-0029 — An independent reading of what a lap produced: material for the person at the gate, one refusal at `publish`, and a verdict that cannot certify what it never read

**Status:** accepted (2026-09-07, rondo's human gate)

This entry records the outcome of the fourteen decision rows `V-1` … `V-14` that
[`docs/design/lap-review-stage.md`](docs/design/lap-review-stage.md) put to the
gate. **Every row was taken as its recommendation column reads**, so the reasons below are that
document's and are restated rather than re-argued. The document was written propose-only and named
this entry by number in advance; it is now the thing it referred to.

**The reason given at the gate is recorded here, because it is a human's judgement and not a
restatement of the design's own case.** The gate's words: *without the stage no defect is caught at
all; with it the readable class is caught and **the remainder stays visible as a recorded hole**;
that a hole is not filled is not a reason to decline the stage.* That is an answer to the strongest
argument the design put against itself — that a reviewer which cannot reach two of the three
discovery methods might be worse than none — and it settles it on the ground that a **named** gap
and an **unnamed** one are not the same object.

**The design document is frozen and this entry is the authority wherever the two differ.** It keeps
its `0497ca8` measurements, as `refrain-lap1.md`, `parallel-admission.md` and `advisory.md` all do,
because a design document edited to match the tree it is being taken against stops being evidence of
anything. Where this entry re-measures, it says so and gives the new number; the differences are
named rule by rule rather than left for a reader to find. **There is one**, under rule 5's
"what changes in the tree", and it sharpens a citation rather than moving a decision.

**The draft of this entry has been removed rather than kept.** `docs/design/` carried it as
`lap-review-stage-decision-draft.md` so that the gate could approve text instead of a promise of
text; once appended here it would be a second copy of an accepted decision with no rule for which
copy wins, which is the drift `docs/README.md`'s own index rule exists to prevent. Its history is in
the pull request that added it.

**It supersedes nothing.** It **annotates** `D-0019` twice — rule 16's trigger
has fired, and rule 7's third reason has expired — and both are additive under
"How to use this file". Nothing in `D-0009`, `D-0010`, `D-0013`, `D-0022` or
`D-0023` is touched, and the design document's section 10 is the walk that shows
why: no gate verb changes hands, no credential is acquired, no terminal status is
withheld from work a person approved, and a clean verdict unlocks nothing.

### Decision

1. **`V-1` — the lap gains an independent reading of what it produced, and it is
   not a state, not a judge, not a model in its first cut, and not a second
   gate.** It is three things: a reading, a record, and one refusal. The three
   conditions an in-arc review stage would need — a refusal that can stop
   something, a reader that can reach the work, a verdict that can be found later
   — fail two-to-one inside the state machine and hold outside it, and the design
   is what that measurement leaves standing rather than what the name suggests.

2. **`V-2` — `rondo answer` prints what the lap produced, on both of its paths,
   and the documented procedure gains a step that reads before it answers. This
   rule is worth more than every other rule in this entry.** Today the reading mode
   prints the gate's `rationale` — the worker's own account of its own work — and
   no workspace path and no topic branch, and the `--body` path prints none of even
   that. The base ref, the commit subjects and the touched files go above the
   answer command on both paths. It produces no verdict and takes no authority: it
   is material for a person, which is the grade `D-0022` rule 13 permits, and it
   needs no status, no table and no new capability grant.

   **The two paths are not equal and the entry says which is which.** On the
   reading-mode path the material arrives before an answer is typed and informs
   it. On the one-shot `--body` path the answer is already given and the command
   goes on to walk the gate with no second chance to take input, so **there the
   print is a receipt** — a record of what the person approved over, which is worth
   having and is not information they could act on. What closes the remainder is
   the procedure, which today walks the operator straight to `--body approve` with
   no step before it, and **not** a machine refusing to carry a person's gate
   answer; rule 3's clock argument refuses that, and whether it should be
   reconsidered is a residual with a named trigger.

3. **`V-3` — a refusal stops `publish`, once, with a named override; it never
   stops the gate, `closed`, or admission.** `publish` is the only act that
   reaches the world and the only refusal point at which no human's clock is
   running. The gate is refused as a site on purpose: friction there would let a
   machine's reading consume a window that expires, and continuo already reports
   gates whose deadline lapsed. **Information where the clock runs; friction
   where it does not.** The refusal takes `publishPreflight`'s existing shape —
   refuse before printing, name the flag, and print the refusal as a warning when
   the operator retypes with it.

4. **`V-4` — `IterationStatus` does not grow.** The reading sits between
   `lap perform` answering and the `awaiting_human` commit, where the row is
   already `performing`, already occupies capacity, and already carries its two
   releasing events. `RELEASED_BY`, `SUSPENDED_STATUSES`, the generated columns,
   the capacity bounds, `nextStep` and the `Step` union are all untouched. **One
   cost is recorded rather than discovered:** the window in which a crash leaves a
   `performing` row whose gate id was never committed is lengthened by the
   reading's duration, which is why the reading carries its own timeout and why
   rule 6 keeps a minutes-long reader out of it.

5. **`V-5` — the first cut's reader is a pure function over rondo's own `git`
   measurement, in `src/access/`, and its ceiling is shape rather than quality.**
   Gathering is `inspectLapWork`'s, which already holds the only `spawn` grant
   this needs; judgement is a pure function over its answer, which is the division
   `src/access/forge.ts` states for itself and `D-0026` already shipped.
   Independence from the child that ran the lap is structural: the input is git's
   answer about the repository, not the worker's report about itself. **What it can
   say is bounded by what it is given** — commit subjects and per-file line counts
   — so it settles no commits, no files, a branch that adds nothing to its base,
   and an unreadable workspace, and it settles nothing above that. `D-0019` rule
   7's first two reasons are intact by construction: the verdict is deterministic
   and it is a unit case.

6. **`V-6` — a model reader is admitted later, as a `drafter` column value under
   `D-0022` rule 13's grade, and never inside `drive()`.** The independence axis
   the reference implementation actually requires is the **model**: the same
   session invokes the reviewer in its own tree, and same-family multi-agent
   self-review is explicitly refused as a substitute. Admitting it as *material for
   a person* is an append to `D-0019` rule 7 rather than a contradiction of it;
   admitting it as anything that decides would be a supersession, and this entry
   does not take one. **Not inside `drive()` is load-bearing**: while the row is
   being driven `abandon` refuses, the gate id has not reached the operator, and
   the gate's deadline — which rondo may not move, because it is the operator's
   declared patience — is running. A sub-second git read is safe there; a
   minutes-long reader would wedge the only slot on an iteration nobody can
   abandon, whose open gate nobody can find.

7. **`V-7` — a refusal starts nothing. The person answers, revises, abandons or
   overrules.** `D-0027` rule 2 already settled that a person types `revise`, once,
   per lap, and an automatic re-lap driven by a machine verdict is precisely the
   bypass this design checks itself against. **rondo#36 is therefore not on this
   path**: its limitation is in a command a person types, and this entry adds no
   caller of it. Turning a verdict into a proposal a person approves before a retry
   is admitted is `D-0022` rule 17's route, and it is left to the entry that builds
   that machinery.

8. **`V-8` — the verdict is an immutable, append-only row with no `status`
   column, written in the same `BEGIN IMMEDIATE` transaction as the
   `awaiting_human` transition, and its enumeration query ships with it.**
   `D-0022` rules 4 and 9's shape, for their reasons, applied to a second fact.
   The transaction is not tidiness: a verdict written after the transition
   succeeded leaves a window in which the row says `awaiting_human` and no reading
   exists, and the person who answers in that window is the person this entry
   exists to inform. **The query is not optional and is not deferred**: rondo has
   no read that returns a terminal row, so without it a verdict on a closed
   iteration is unreachable and the fail-open rate is unobservable. This entry does
   not inherit `D-0022`'s "a closed iteration cannot be found at all" residual; it
   discharges the part of it this design depends on.

9. **`V-9` — a clean verdict is not permission, and the stage's scope is part of
   this decision rather than commentary.** Nothing is unlocked by a `clear`
   anywhere; the asymmetry with `concerns` costing a keystroke is deliberate and is
   `D-0022` rule 11's grade. The verdict never enters `approvedForPublication`,
   because that predicate is the sentence *"a person said yes"* and a machine's
   opinion inside it would make rondo state something about a person. **And the
   entry states its own reach in two lists**, because a record that overstates a
   stage is more harmful than one that understates it:
   - **What it catches:** defects that are visible in the artefact and settleable
     from the text — the class a different-model reader demonstrably catches.
   - **What it cannot catch, by construction:** defects that appear only when the
     thing runs; defects found by interrogating a system rather than reading it;
     ordering and liveness defects that surface as flakiness; *"green but not
     upholding it"* as a comparison, because **no module in rondo is granted the
     ability to run a test suite**; work left uncommitted, because every reader in
     the tree reads committed history and there is no `git status` anywhere in
     `src/`; and *"did it do what was asked"*, which is not answerable from a diff.
   - **The ceiling, stated once:** of the three discovery methods that motivated
     this work — adversarial verification, review by a different model, measuring a
     real run — **this stage reproduces one**, the second. The other two require
     execution, which rondo does not have and this entry does not request. A reader
     who concludes from this entry that a lap's output is now checked has read it
     wrong.

10. **`V-10` — the absence of a reading refuses `publish` exactly as `concerns`
    does, and so does a reading that no longer describes the work being pushed.** A
    fail-open absence makes "reviewed clean" and "nothing read it" indistinguishable
    at the only point where either matters, and a stage whose absence costs nothing
    is a stage that exists only in the record. **Staleness is that same failure with
    a delay in it**, and it is the easier one to miss: the verdict is written when
    the lap suspends, `publish` happens later, and `publish` inspects and pushes the
    branch *as it is then*. A branch that moved in between — a commit into the
    worktree, an amend, a reset to its base — would publish under a `clear` that
    describes something else, and a reset to base would carry through the very
    "adds no commits" refusal the deterministic reader exists to make. So the
    refusal is not "is there a `clear`" but **"is there a `clear` whose recorded tip
    commit and material digest still match what `publish` just measured"**, and a
    mismatch is `unavailable`. One comparison; it costs a keystroke and never a
    person's gate.

11. **`V-11` — a `clear` may only be written beside rondo's own measurement of
    what was read; a model drafter's verdict must additionally carry rondo's digest
    of the bytes it handed the reviewer; and the store's writer refuses a `clear`
    without either.** The base ref, the tip commit, the commit shas, the touched
    paths and the digest over them, as rondo's own `git` read returned them —
    **never the reviewer's account of what it read**. The reference
    implementation's countermeasure for the empty pass counts evidence outside the
    reviewer's own message, because a reviewer that read nothing returns a clean
    pass and a zero exit and is otherwise indistinguishable from a real one.

    **The second clause exists because the first is not enough for a model
    drafter, and the gap is exactly the failure the rule is for.** rondo running
    `git` successfully proves that *rondo* gathered the material; it says nothing
    about what reached the reviewer. Without the second clause the empty pass
    survives intact as: the gather succeeds, the model is handed nothing or attends
    to nothing, and `clear` comes back. So a model drafter's row carries the digest
    of the bytes rondo delivered, computed by rondo, and it must equal the digest of
    the material the same row records as read; absent or mismatched, the verdict is
    `unavailable`.

    **Three grades, stated rather than inferred.** For the deterministic drafter
    the evidence proves the material was **read**, because the reader is the
    measurement. For a model drafter the second clause proves it was
    **delivered**, which is strictly weaker. **Neither proves it was understood**,
    and no rule here can: a reviewer handed a diff that answers `clear` without
    attending to it is, from rondo's side, indistinguishable from one that read it
    carefully. That residue is why rule 6 admits a model drafter as material for a
    person rather than as a check, and why rule 9's ceiling is in this entry rather
    than left to a reader to discover.

12. **`V-12` — the stage is proved non-vacuous by a planted case in CI that
    asserts named messages rather than an exit status**, in the shape
    `boundary-is-not-vacuous` already uses and for its reason: a green suite over an
    empty walk looks exactly like a green suite. It proves the deterministic half,
    and it cannot prove the model half; the entry says so rather than implying
    coverage.

13. **`V-13` — the exit criterion is code for the deterministic drafter, a plan
    field for a model drafter, and `unavailable` when it is absent.** rondo has a
    layer for what happened and a person for goals and risk, and no layer in between
    for a judgement bound to observable signals; `D-0022`'s advisory is a pure
    function proposing over a snapshot and is not it. So the criterion is split
    rather than invented: for the deterministic reader it is **code**, changed
    through a pull request under `AGENTS.md` section 8's required check, audited as
    a diff and reviewable as a unit case; for a model reader it is an **input
    carried with the plan**, which makes it versioned by `D-0028`'s payload ladder,
    persisted verbatim, and digested by `plan_digest`, so *"which criterion was in
    force when this verdict was written"* is answerable from the row and changing it
    carries exactly the authority and the audit trail that changing any other plan
    field does. **Neither ever defaults to a `clear`**, and neither ever stops the
    lap: an absent or unreadable criterion is `unavailable`, which is rule 10.
    **An organisation-wide criterion store is not decided here** and is a residual.

14. **`V-14` — rondo holds no round budget and no re-review exit criterion in lap
    1, recorded as a reduction with its trigger.** The organisation's practice —
    at most three rounds, exit on Blocker/Major cleared — has two properties that do
    not survive the transplant, and both are in its own documents rather than in an
    opinion: its terminating condition is a human interlocutor the worker hands
    control to at the cap, which an unattended lap does not have; and its
    round-count heuristic (*the same spot recurring is a redesign signal; a
    different spot each round is healthy convergence*) is documented as a person's
    judgement with no algorithmic replacement. rondo's own bound is already a
    person: a revision chain advances only when someone types `revise`. **Its
    trigger:** the first time somebody wants an unattended re-review.

### What this entry changes in the tree

- **`src/refrain/ports.ts` gains one port**, declared in refrain's own
  vocabulary and wired in `src/access` exactly as `startContinuo` and
  `performLap` already are. `src/refrain/` gains **no import and no external
  grant**, and its external allowance stays empty; `D-0019` rule 1's shape is
  unchanged and `src/refrain -> src/access` does not exist.
- **`src/access/` gains a pure verdict function and one adapter.** No new entry in
  `ALLOWED_EXTERNALS_BY_MODULE`: `inspectLapWork` already holds the `spawn`, and
  this entry adds call sites rather than capability.
- **`inspectLapWork` gains one query and two fields: the resolved base and the
  resolved tip.** It returns a base *ref name*, **abbreviated** shas of the
  **non-merge** commits and per-file counts (`src/access/forge.ts:423-431`), none of
  which is an identity for the commit `publish` will push — an abbreviation is not a
  commit id, and the newest non-merge entry is not the tip when the tip is a merge.
  **The design document says the query "the module already spells for a different
  question"; re-measured at ratification, the sharper statement is that this
  function already spells it for its own question and throws the answer away**: it
  runs `rev-parse --verify --quiet` over two base candidates and keeps the *candidate
  ref name* rather than `resolved.stdout` (`forge.ts:456-475`). So the change is to
  retain what is already computed for the base, and to run the same query once more
  against the topic branch. Rule 10's staleness check is unimplementable without
  both. This is the one place this entry corrects the document rather than restating
  it, and it makes the change smaller than the document made it look.
- **The store gains one record kind, one writer and one query.** The writer refuses
  a `clear` without evidence (rule 11); the query answers "which iterations reached
  a terminal status with no reading".
- **Two commands change.** `answer` prints the material on both paths; `publish`
  gains one refusal and one override flag.
- **CI gains one planted case** (rule 12).
- **`IterationStatus` does not change**, and neither does anything derived from it.

### Annotations this entry adds to earlier entries

**Both are written as a dated annotation block on `D-0019` itself**, in the form `D-0021` used on
that entry and `D-0015` and `D-0016` used on `D-0001`, rather than only as a reference from here.
The mechanism matters and is recorded rather than left to inference: a reader who arrives at
`D-0019` looking for whether its reductions still hold has to learn it there, and an annotation that
lives only in the entry that fired the trigger is findable only by somebody who already knows this
entry exists. Nothing in `D-0019` is edited; the block is additive and says so, and every original
claim, measurement and date stays readable underneath it.

- **`D-0019` rule 16** recorded the conductor's own verify as a lap-1 reduction and
  named its trigger: *"a lap whose gate is opened after rondo's own check rather
  than before it, or a verify verdict a human would act on differently from the
  gate's own contents."* **The second limb has fired (2026-09-07, D-0029):** the
  rule's premise was that a failing verify's only available action is the
  withdrawal ask, which was exhaustive when rondo had no operating surface;
  `D-0025` and `D-0026` gave it one, and refusing `publish` is a second available
  action that spends no human window. The rule's conclusion for the arc is **kept**
  — no verify inside the state machine, no untested branch on the path to the one
  human contact — and this entry puts nothing on that path. The first limb has
  **not** fired: the gate is still opened inside `lap perform`.
- **`D-0019` rule 7** gave three reasons for refusing a model-judged evaluator.
  **The third has expired (2026-09-07, D-0029):** *"its most valuable output is the
  retry the lap-1 arc cannot perform"* was true when written, and `D-0023` supplied
  the allocator while `D-0027` made a revision a second lap a person types. The
  first two — a non-deterministic verdict on the path to the one rationed human
  contact, and not being expressible as a unit case — **stand**, and they are why
  rule 5 above ships a deterministic drafter first and rule 6 admits a model one
  only as material.
- **`D-0022` rule 19**'s enumeration criterion is extended to a second record kind
  by rule 8, and the residual it names — that a terminal iteration cannot currently
  be found at all — is discharged **only** for the query this design depends on.
  The rest of that residual stands with its named owner.

### What this entry does not do

- **It does not give rondo the ability to run anything.** The executable class of
  defect has no home for a lap's product: rondo's CI tests rondo, and the dogfood
  procedure reads no diff. Naming that gap is rule 9's; filling it is a different
  entry, and it is the one this design would rank next.
- **It does not fix that uncommitted work reads as empty**, to this stage and to
  `publish` alike. That is a defect of the current publishing path which this entry
  surfaces and does not repair.
- **It does not decide what the reviewer is handed beyond the artefact** — the
  request, and the invariants a target repository states in prose.
- **It does not add a second approver.** `RONDO_APPROVER` is still the one identity
  allowed to answer a gate or publish, so the person who approves, the person who
  publishes and the person who overrules a verdict are the same person by
  construction. Changing that is `D-0020` rule 2's surface work.
- **It does not build the advisory component or its ledger** (`D-0022` rules 1, 2,
  4, 9, 18, 19), and it does not consume cadenza's successor machinery.

### Residuals, with who decides

| Residual | Why not here | Who decides |
|---|---|---|
| The executable class of defect has no home for a lap's product | It needs a capability rondo does not have and this entry does not request (rule 9's ceiling) | rondo's gate, as its own entry |
| Uncommitted work reads as empty to every reader in the tree, and `publish` pushes a branch without it | A defect of the publishing path that this design surfaces rather than creates | rondo's gate, or the issue it becomes |
| What the reviewer is handed beyond the artefact | Deciding the input set is a second design, and it is the one that decides whether "did it do what was asked" is answerable at all | the model-drafter entry (rule 6) |
| An organisation-wide criterion store, and how a criterion revision is dated | A plan field answers one plan and not a fleet | a later entry |
| A second approver | It is a change to who may act, not to this stage | `D-0020` rule 2's surface work |
| The verdict becoming a proposal a person approves before a retry is admitted | `D-0022` rule 17's route, whose machinery is unbuilt | the advisory record-design task |
| Whether `answer --body` should refuse once on an unacknowledged `concerns` | It is friction at the gate, which rule 3 refuses on the clock argument, and the answer turns on evidence nobody has yet. Trigger: the first `concerns` an operator would have acted on and did not see | rondo's gate, if the trigger fires |

### What was measured, and at which revision

At rondo `0497ca8`, on 2026-09-07, toolchain `node v22.17.0`, with continuo and cadenza at the
revisions `continuo.pin.json` and `cadenza.pin.json` name. The measurements are
`docs/design/lap-review-stage.md` sections 1 to 9.

**Every citation this entry leans on was then re-taken at `7c63f05` before the entry was appended**,
which is the revision `origin/main` carries at ratification. That check is cheap to describe and was
not skipped for being cheap: `7c63f05` is the merge of the design document itself and touches
`docs/` only — `docs/README.md`, `lap-review-stage.md`, `lap-review-stage-decision-draft.md`, 1280
insertions and no deletions — so nothing under `src/` or `test/` moved between the two revisions.
**Being able to argue that is not the same as having checked it**, and the re-read found one
citation worth sharpening (rule 5's tip query, above), which is precisely why the next reader has no
way to tell a citation that was verified from one that merely survived.

Three measurements carry this entry's weight and are named again here, because a reader who checks
nothing else should check these:

- **What a person at the gate is shown** is the gate's `rationale`, which
  continuo's own decoder calls *"why the worker stopped, in the worker's own
  words"*; the reading mode prints no workspace path and no topic branch, and the
  `--body` path prints nothing of it at all. The operations record shows an
  operator answering `approve` on exactly that, and the documented procedure that
  walked them there contains no step that reads the work.
- **`inspectLapWork` already reads what a lap produced** — `git log` and
  `git diff --numstat` against the workspace — and is called from exactly one
  place, inside `publish`, after the gate is answered and closed, to compose prose.
  So the capability this entry needs exists; what did not exist is a reader before
  the person, a record, and a refusal.
- **No module under `src/` is granted the ability to run a test suite**, which is
  the whole of rule 9's ceiling and is a property of the boundary table rather than
  an opinion about scope.

### What would falsify it

- **The first defect that reaches a merge having passed a `clear` verdict.** If it
  is of the readable class, the reading is too shallow and rule 5's shape-only
  ceiling is the suspect. If it is of the executable class, the answer is not a
  better reader but execution, and that is a different entry.
- **`--despite-review` becoming routine.** The entire binding force of this design
  is one keystroke; if the keystroke is reflexive, the stage costs a table, a
  query, a port and two command changes and prevents nothing. It is measurable, and
  this entry should be judged on it.
- **A `clear` written with no evidence**, or a `clear` accepted at `publish` whose
  tip commit is not the one being pushed. Rules 11 and 10 failing is the failure
  that looks like success, and rule 12's planted case is what should fire first.
- **A model drafter's delivered digest turning out to be trivially satisfiable** —
  bytes counted as delivered that the reviewer never had to attend to. Rule 11's
  second clause buys delivery and nothing more, and the first evidence that
  delivery is not the property worth buying falsifies it.
- **Terminal iterations accumulating with no verdict row.** Rule 10 is supposed to
  make that visible at `publish`; a population nobody noticed means the enumeration
  query is not read, and an unread query is not a record.
- **The gate ceasing to be where a person decides**, through cadenza#22 or a web
  surface. The measurement under rule 2 has to be re-taken wherever the answer
  arrives before any of this is still true.
- **`inspectLapWork` changing what it returns**, which re-opens rule 5's ceiling,
  or **`publish` ceasing to be the only path to the world**, which re-opens rule 3
  entirely.
- **`approvedActor` admitting a second identity.** "Who reads" then has a human
  answer that is not available today, and rule 6's argument weakens rather than
  strengthens.
- **continuo separating producing a lap's result from presenting a gate over it.**
  That is `D-0019` rule 16's first limb, and it would make a check *before* the gate
  possible — at which point rule 3's "information where the clock runs, friction
  where it does not" is re-openable on better terms.
- Any measurement above failing to reproduce at `0497ca8`, or its re-take at `7c63f05`.

---

## D-0030 — The lineage `D-0027` deferred: one nullable column on the iteration row, written once at reservation, refused when it names nothing, and read where provenance is shown

**Status:** accepted (2026-09-10, rondo's human gate)

`D-0027` rule 9 named what it was not building: *"No lineage column: the successor records no
reference to the predecessor, and the chain is reconstructible only through the branch names and
the prompt."* It deferred that column "to the entry that adds a migration to the store", because on
2026-09-06 rondo had no migration mechanism at all. `D-0023` then added one — a declarative column
list, a diff against `pragma_table_xinfo`, and an `ALTER TABLE ADD COLUMN` for each one missing —
and `D-0028` recorded that the deferral was still standing because it was the payload half rather
than the schema half that had moved. rondo#33 is the deferral coming due, and this entry is it.

**What the implicit link actually is, restated because it is the whole case.** A revision's
`base_branch` is its predecessor's `topic_branch` (`D-0027` rule 4). That equality lets a reader
*infer* a succession from two names, and an inference is not a record: two laps whose branches
happen to line up are indistinguishable from a real one, and nothing says which of "this revised
that" and "these are adjacent" is true. `advisory.md`'s `A-10` already priced the alternative —
*"Lineage costs a join; revival costs the invariant"* — and this entry pays the join's price on the
iteration row.

**It supersedes nothing and annotates two entries**: `D-0027` rule 9, whose deferral is now
carried out, and `D-0028`'s "does not add the lineage column" bullet, whose "the deferral stands"
has expired. Both notes are additive under "How to use this file"; neither entry's claims change.

### Decision

1. **`supersedes_iteration_id TEXT`, nullable, on the `iteration` table, and the value travels as
   an argument rather than as a plan field.** `admit()` gains a fifth parameter defaulting to null,
   `src/access/conductor.ts` passes it through, and `commandRevise` is the one caller with
   something to say: the row whose gate it has just answered. The plan is what continuo is handed
   and what a person may write by hand, and which rondo row preceded this one is neither — a plan
   field would have made the lineage a thirty-third value an operator could type, and a payload
   key would have owed `D-0028`'s ladder a step for a fact that is not in the payload's business.

   **The name is `A-10`'s and the row is not.** `advisory.md` spells this column
   `supersedes_iteration_id` on a *proposal*, in a component rondo has not built; the same name on
   the iteration row is the same relation recorded one table earlier, so that the advisory's
   lineage, when it arrives, finds the vocabulary already in use rather than a second spelling.

2. **Written once, by `reserve()`, inside the transaction that writes the row — and by nothing
   afterwards.** `IterationFields` omits it, exactly as it omits the three allocated identifiers
   (`D-0023` rule 5), so the omission is a compile error rather than a comment. The reason is not
   only symmetry with the triple: a lineage a later transition could write is a lineage that can be
   *composed after the fact*, and a record of where a lap came from that can be edited later is a
   record of where somebody would have preferred it came from. Null means "revises nothing", never
   "not established yet" — which is the one nullable column on this table that is not a
   write-order consequence.

3. **A lineage that names no row, and a row that names itself, are refused inside `reserve()`'s own
   `BEGIN IMMEDIATE`, with nothing written.** This database declares no foreign keys and this entry
   does not add one: a single referential constraint on one column would make the schema claim an
   integrity it does not enforce anywhere else (the `admission_refusal` and `lap_reading` comments
   both already say so). What replaces it is a read under the write lock, which is where the answer
   is stable — the same question asked before the transaction would be a check with a window in it.
   Both refusals are `defect`, not a person's mistake: the only caller passes a row it has already
   read, so reaching either is a rondo bug and is filed as one. **A dangling reference would be
   worse than the inference it replaces**, because it looks like a record.

4. **Read in three places, and they are the three places provenance is shown.** The conductor's
   reservation report says the row is a revision of its predecessor, off the row rather than off
   the argument, at the moment the fact is written. `rondo answer`'s reading mode prints a `revises`
   line above the gate, because "what am I looking at" has a different answer for a second lap than
   for a first and the person answering the gate is the one who most needs it. And the pull request
   body's "How this got here" states it (`D-0026`): the pushed branch carries every lap's commits,
   so a reviewer reading a revision is reading work that was already answered for once, and nothing
   else in that body would say so. Each is printed only when the column is set, so an ordinary
   lap's output is byte-identical to what it was.

5. **What this does not build, stated so it is not read in.** No back-fill: a database written
   before this column holds no revision it could recover, because `revise` had nowhere to write
   one, so every existing row reads null and that is the truth about it rather than a gap. No
   index, because nothing queries by predecessor yet and an index over a column with one reader is
   a bound nobody asked for. No chain walk: a reader following a chain of any length follows it one
   row at a time, and the shape a transitive query would want is a decision the first consumer
   should take. No lineage for anything but a revision — `start` records none, and a `needs_approval`
   retry has no successor to record until `advisory.md`'s component exists. And nothing reads the
   column to *decide* anything: it is a record, and a machine that branched on it would be taking
   `D-0027` rule 2's refusal of a back edge by another route.

### What was measured, and how

Measured at `46e30aa` on 2026-09-10, which is `origin/main` at the time this was implemented.

- **The migration mechanism `D-0027` rule 9 was waiting for exists and takes one line.**
  `ADDED_COLUMNS` in `src/store/sqlite.ts` is a declarative record diffed against
  `pragma_table_xinfo('iteration')`; adding `supersedes_iteration_id: "TEXT"` to it is the whole of
  the upgrade, and `migrate()` needed no other change. `D-0023`'s own note that the shape becomes
  wrong "the moment a second table needs a coordinated change" is untouched: this is the same
  table.
- **No back-fill is possible and none is needed.** The pre-`D-0030` schema has no column a
  predecessor's id could be recovered from: the successor's plan carries `base_branch` (the
  predecessor's topic branch) and `pull_request_base_branch`, and neither names an iteration.
  Deriving a predecessor from a branch name would be recording the inference this entry exists to
  replace, as a fact.
- **`revise` is the only path that has a predecessor to name.** `commandRevise` is the one place in
  `src/access/` that holds two iterations at once, and `admit()`'s other caller (`commandStart`)
  has one. The default of null is therefore what every existing call site already meant.
- **The person at the gate is shown nothing about lineage today.** `rondo answer`'s reading mode
  prints the run, the gate, the rationale, the options and the lap's material (`D-0029` rule 2);
  none of that distinguishes a first lap from a fourth, and the operations runbook's own worked
  revision shows an operator having to read the branch names to tell.

### What would falsify it

- **A revision recorded with a null lineage.** The column is written at reservation or never, so a
  path that reaches `admit()` with a predecessor in hand and does not pass it produces a row that
  claims a first lap for ever. That is the failure this entry is most likely to have, and it is
  invisible except by looking.
- **The column being read to decide something** — a bound on revisions, a resumed row, a query that
  refuses a lap because of its ancestry. Rule 5 forbids it, and the first such reader means the
  lineage has stopped being a record and become a state.
- **A second writer of the column.** Rule 2's whole property is that reservation is the only
  authority; a transition, a repair script or a back-fill that sets it makes "the row records where
  this lap came from" a sentence with an exception in it.
- **The advisory component landing with its own `supersedes_iteration_id`** on a proposal row
  (`A-10`). Two columns of one name in one database is readable only while one of them is on a
  table nobody has built; when that table exists, whether the iteration's column is a duplicate of
  the proposal's or the thing the proposal's points at is a question this entry does not answer.
- **A chain long enough that one row at a time stops being a way to read it.** Rule 5 declines the
  transitive query on the grounds that nothing needs it; the first person who does need it
  falsifies that rather than the column.
- **`reserve()` ceasing to be the only insert into `iteration`.** Rule 3's refusals live there, so
  a second insert path is a second place a dangling lineage could enter the database — and out-of-band
  inserts are already what `D-0023` rule 11 recorded as the cost of the counted bound.

---

## D-0031 — The last field `revise` could not see before it spends the gate: rondo reads one run, and only an answer counts

**Status:** accepted (2026-09-11, rondo's human gate)

`D-0027` rule 6 orders `revise` so that everything refusable is refused *before* the gate is walked,
because walking a gate cannot be undone. Rule 9 then names the one check missing from that list —
whether the successor's run id is free in continuo's control plane — and says why it was left open:
closing it means rondo consuming a run-reading verb, and `D-0025` rule 8 enumerates the verbs rondo
consumes. This entry widens that set by one, for that one purpose. It is `#32`.

**What `D-0023` already did to the gap, stated first because it changes the size of it.** The issue
was written when `revise` took `--run-id`, and it does not any more: the allocator derives the
triple from the iteration id, so the successor's run id is a pure function of a value `revise`
already checks against rondo's own store (`revisionBlocker`'s first identifier check). A collision
rondo *caused* is therefore impossible by construction, which is what `src/refrain/allocator.ts`
says it is for. What remains is a control plane holding a run rondo's store does not know about — a
store rebuilt or replaced, a `--db` naming a different database, a run created by hand — and
`D-0019` rule 10's write order means a crash cannot produce it, because the row is committed before
`run admit` is spawned. So this is a narrower hole than the issue describes, and the loss when it is
hit is the same: a spent gate, a settled predecessor, and no lap.

### Decision

1. **rondo consumes `run show`, and `D-0025` rule 8's set becomes six verbs.** `RUN_SHOW`, schema
   `continuo.run.show/1`, read off continuo's own source at the pinned revision
   `38c667b5126fdfdc0465e4a422e88b20a8b53044`. It is the read half of `continuo D-0096`, it writes
   nothing, and it takes no write lock — the one property that makes it safe to drive while another
   lap holds the run lease.

2. **Only an *answered* document is a fact this command acts on, and every other outcome leaves
   `revise` behaving exactly as it did before the verb existed.** A run continuo describes is a run
   that exists, so the id is taken and the revision is refused with the gate untouched. A refusal, a
   database rondo cannot read, a protocol answer rondo does not recognise, a timeout — all of them
   mean *this check learned nothing*, and the command proceeds to the walk on the strength of the
   other four preflights.

   **This asymmetry is what keeps `D-0015` rule 2 intact, and it is the whole design.** The obvious
   shape is the other one: drive the verb, and read `UnknownRunRefused` as "free". That would make
   rondo branch on `error.class` — which continuo says is a hint rather than a taxonomy, and which
   `D-0015` answered by carrying the class through as an opaque string for a person to read.
   Reading the *arrival of a document* instead needs no class and no message, and it fails in the
   right direction: the failure mode of a mis-read refusal is a legitimate revision refused for a
   reason that is not true, and the failure mode of this reading is the gap staying exactly as wide
   as it was. One of those costs a person their gate and the other costs nothing.

3. **It is a fifth entry in `revisionBlocker`, not a new mechanism.** The function already exists to
   hold the refusals that must precede the walk; the run id joins the iteration row, the branch and
   the workspace there, and is ordered after the store's own row because a person whose *iteration*
   id is taken should hear that before they hear about a name rondo derived from it. The refusal
   names the derived run id, the status continuo reported, and the one lever the operator has, which
   is `--iteration-id`.

4. **The decoder reads two fields of a large document, and the narrowing is deliberate.**
   `run show` carries the run's lease, sessions, open gates, events and outbox rows, because
   `continuo D-0096` withholds nothing on purpose. rondo reads `run.run_id` and `run.status` and
   nothing else: the question is "does this run exist", whose answer is the document arriving, and
   `status` is read only so the refusal can tell a person what the run it collided with is doing. A
   decoder that read the other five keys would be rondo claiming to model rows it does nothing with,
   and every one of them would become a field a future continuo release could break rondo on.

5. **The shape of the gap is closed by one third, and the other two thirds are named rather than
   implied.** `run admit` at the pinned revision refuses for exactly three reasons a caller can
   cause: `RunAlreadyAdmitted`, `UnknownRoleRefused` and `CliArgsNotAuthorised`
   (`src/control_plane/run_admission.ts`). This entry closes the first. The other two are reachable
   for a revision only when continuo's role roster or its `--cli-arg` allowlist changed *between*
   the predecessor's admission and the successor's, because `D-0027` rule 4 inherits every other
   plan field verbatim from a plan that was already admitted once — a real hole, and one whose
   trigger is a continuo upgrade rather than anything an operator typed.

   **And the "complete answer" `D-0027` rule 9 imagines is bigger than the verb it names.** A
   continuo verb that validated an admission without performing one would cover all three of the
   above and still not cover the topic branch or the workspace, because continuo checks *those* in
   the materialiser inside `lap perform`, not at admission. The complete answer is a preflight over
   a lap, not over an admission. rondo already asks git and the filesystem those two questions
   itself (`D-0027` rule 6), so the structural verb would replace one of this entry's five checks
   and leave the other four standing. That is why it is not worth waiting for a cross-repository
   decision to take the one-verb version, and why taking the one-verb version does not foreclose it:
   the widening of rule 8 is the same widening either way.

6. **The check-then-use window stays open, and this entry does not pretend otherwise.** `D-0023`
   rejected allocating against observed state on exactly this ground — *"it buys an earlier refusal
   and no guarantee"* — and that reasoning is untouched *for admission*, where the thing lost to a
   late refusal is a row. It is the price that differs here: a revision's late refusal costs a
   human's gate, which cannot be re-opened. So the same purchase is worth making at this one call
   site and is still not worth making at the other, which is why this is a line in `commandRevise`
   rather than a check inside `allocate()`.

### What was measured, and how

On **2026-09-11**, against the pinned continuo built from a clean clone at
`38c667b5126fdfdc0465e4a422e88b20a8b53044` (`CONTINUO_REQUIRE_REVISION=1 npm run build`, whose
`--version` reports that revision):

- **Both answers the reading turns on were observed across the real process boundary**, in
  `test/continuo/smoke.test.ts`. An admitted run answers `continuo.run.show/1` with its columns
  nested under `run` — `{"run":{"run_id":"rondo-smoke-1","status":"created",...},"lease":null,...}`
  — and decodes to rondo's two-field record. An id naming no run exits 2 with the ordinary refusal
  envelope, whose message contains the id asked for. Five tests, green.
- **The nesting is the fact a unit fixture would have guessed wrong**, and it was read off
  `showPayload` rather than assumed: the run's columns are under `run`, beside the five table keys,
  where `gate show` puts its fields at the top level. A decoder written to `gate show`'s shape would
  have failed every call.
- **The cost is one subprocess, on the `revise` path only.** No other command drives the verb.
- **What was *not* walked:** a real revision against a control plane actually holding the colliding
  run. The refusal is unit-tested and the verb is smoke-tested; the two have not been walked
  together, because manufacturing the collision means a store and a control plane deliberately out
  of step, which is the condition this entry exists for and not one the dogfood environment
  produces.

### What would falsify it

- **`run show`'s schema id, or the nesting of the run's columns under `run`, moving.** The smoke is
  where that shows, and it shows as a defect rather than as a quiet "not taken".
- **continuo growing a verb that validates an admission without performing one**, which replaces
  rule 5's first third — and, if it ever covers materialisation too, replaces three of
  `revisionBlocker`'s five checks.
- **`run admit` growing a fourth caller-caused refusal**, which widens rule 5's remainder without
  anything in rondo turning red.
- **A second call site for `showRun`.** The reading in rule 2 is justified by the irreversibility of
  what follows it; a caller with nothing irreversible after it would be paying a subprocess for an
  earlier refusal it does not need, and a caller that read a *refusal* as a fact would be the
  taxonomy rule 2 exists to avoid.
- **The allocator ceasing to derive the run id from the iteration id**, which is what makes the
  store's own row check and this one two questions about two different authorities rather than one
  question asked twice.

---

## D-0032 — The record the operator's surface has to be able to show: alternatives inside one immutable proposal, a basis that is a locator, a durable last-look mark, and one table counting what was put to the operator and what was not

**Status:** accepted (2026-09-11, rondo's human gate). Refs rondo#39, rondo#40, rondo#41.

**One rule was put to the gate as a decision point rather than as text, and the gate's own reason is
recorded here because it is a human's judgement and not a restatement of this entry's case.** Rule 9
accepts a known hole - a timestamp cursor cannot be lossless - and the alternative offered was the
per-table commit-ordered cursor that rule names as its upgrade path. The gate took the reduction, in
its own words: *do not bind the mark's shape to every future record kind for the sake of a
concurrency that does not exist yet.* That is this entry's own argument, taken as the gate's.

**The draft of this entry has been removed rather than kept**, for `D-0029`'s reason and by its
precedent. `docs/design/` carried it as `advisory-record-decision-draft.md` so the gate could
approve text instead of a promise of text; once appended here it would be a second copy of an
accepted decision with no rule for which copy wins. Its history, including the two review rounds
that changed rules 9 and 10, is in the pull request that added it. **It leaves no design document
behind**: unlike `D-0022`, `D-0029` and `D-0023`, this entry has no frozen document standing beside
it, because everything it measured is in `DECISIONS.md` and in the schema already.

`D-0022` rule 19 permits the record design of `advisory.md` sections 6 and 8 to land before the
surface work, and rule 20 leaves it unwritten. Three issues have since said what that record has to
carry, from three directions: **#39** what a gate must show for a person to answer it without
reading the lap, **#40** what nobody owns between laps and the one property that layer must have
whatever it becomes, **#41** what the surface must display and why the record has to be designed
knowing it.

**This entry takes the record requirements those three issues generate, and nothing else.** It does
not build the schema, does not write DDL, does not touch `src/`, and does not decide the
between-laps component of #40 or the conversation schema of `D-0020` rule 5. It extends the record
`D-0022` rule 4 named and deferred; it supersedes nothing and corrects nothing.

**The order is the argument, and it is #41's.** A surface can only show what was composed and
stored. Every requirement below is written as *a field, a refusal or a query*, because a
requirement written as anything else is a requirement the screen cannot meet. Where an issue asks
for something that is **derivable** from rows that already exist, this entry says so and places no
field - a column for a computable value is a second home for a fact (`D-0022` rule 8).

### Decision

1. **Alternatives and the recommendation live inside the one immutable `payload`, not in sibling
   rows.** A proposal's payload is an **ordered set of options**, each carrying a label, its
   candidate value and its basis (rule 2), with **exactly one** marked as the recommendation. #39's
   answerable shape - proposal, alternatives, recommendation - is therefore one row, one digest, one
   fact.

   **The alternative considered and refused** is one proposal row per option joined by a group id.
   It is refused for two reasons that are the same reason: a group can be half-written, so a reader
   could see a recommendation without the options it was chosen against; and the framing #39
   identifies as the hazard *is* the set of alternatives offered, so splitting it across rows makes
   the framing the one part of the proposal that is not covered by `proposal_digest`.

2. **A basis is a locator, never a copy, and its forms are a closed union.** Every claim and every
   option in the payload carries a `basis`, and the permitted forms are: a pointer into this row's
   own verbatim `snapshot`; an `iteration_id`; a `(gate_id, transition_seq)`; a continuo `run_id`;
   or a repository `(path, commit, line range)`. An unrecognised form is a row the reader **refuses
   rather than guesses at**, which is the rule `D-0022` rule 4's `kind` union already runs on.

   **This is what makes #39's requirement affordable rather than contradictory.** #39 wants the
   citation close enough to read without opening anything; `A-8` forbids a second home for a fact.
   Both hold because `D-0022` rule 4 already stores the **snapshot verbatim** beside its digest: the
   material the advisory actually read is *in the row*, so a pointer into it renders inline with no
   copy and no second source of truth. Only material the advisory did not read as a store row - a
   file and line in a repository - is a locator the operator opens. The distinction is visible in
   the form itself, which is why the union is closed and why "the basis is prose" is not one of its
   members.

   **Prose is permitted in a payload only where it travels with its basis.** A claim with no basis
   is the summary #39 says an operator would have approved three times on the day it measures.

3. **There is no rendered `summary` column, and its absence is the decision.** What the gate shows
   is **composed at render time** from the option set and its bases. A stored summary is a framing
   that outlives the material it was drawn from and can drift from it silently, which is the exact
   failure #39 records: a candidate proposed that had already merged, a corruption that existed only
   in the summary's own prose, an instruction contradicting a repository's convention. Each was
   caught by a recipient who could reach the material, and each would have been stored, digested and
   authoritative-looking under a summary column.

4. **"What answering makes irreversible" is a function of `kind` and is not stored.** Approving a
   `widening_successor` authorises exactly one issuance (`D-0022` rule 9); answering at a gate spends
   a gate that cannot be reopened (`D-0031` rule 6); `publish` is the only act that reaches the world
   (`D-0029` rule 3). All three are properties of the act, computable from the row's `kind` and its
   target. A free-text "this forecloses ..." column would be the drafter narrating the consequence of
   its own recommendation, which is rule 3's hazard applied to the most load-bearing sentence on the
   screen. **The falsifier is named below**: the first consequence that is not a function of `kind`
   moves this rule.

5. **Authority is a function of `kind` alone - never of `drafter`, never of prose - and the store's
   writer is what enforces it.** `D-0022` rule 4's `kind` union already mixes two voices:
   `agent_type`, `run_plan`, `contract_keys` and `widening_successor` are approvable, and
   `explanation` binds nothing, ever. This entry adds no column to say which; it adds a **refusal**:
   the writer refuses a `human_decision` whose `proposal_id` names a non-approvable kind, and the
   refusal is proved by a planted case, in the shape `D-0029` rule 12 already uses.

   **An `approvable` boolean is refused for `A-11`'s reason.** Two authorities with no precedence is
   not stricter, it is unanswerable: a row whose `kind` says `explanation` and whose flag says
   approvable has no rule for which wins. And a flag can be flipped by a writer that meant well,
   where a closed union plus a writer refusal cannot.

   **`drafter` is excluded on purpose.** `D-0022` rule 13 makes the record identical whichever
   drafter produced it; if authority followed `drafter`, that rule would be reversed by implication
   the first time a model drafted an approvable kind.

6. **A refusal is a `human_decision` row, and it consumes nothing.** `human_decision` carries the
   outcome, so "declined" and "never answered" are different rows rather than the same absence. A
   refusal writes no `decision_consumption` row and no delegation row, which is what `D-0022` rule 18
   already assumes when it says the composition must outlive a refusal. Without this, #41's inbox
   cannot tell what is waiting on the operator from what the operator has already settled. It does
   **not** carry #40's count of what reached the operator: an answer is a fact about a person and a
   presentation is a fact about the surface, and rule 10 holds the second.

7. **An elevation is recorded on the proposal, as two nullable columns that are null together:
   `elevated_from_message_id` and `elevated_by_actor_id`.** #41's chain -
   `observation -> (operator elevates) -> proposal -> (operator approves) -> contract` - has one link
   nothing records today, and it is the link where authority enters: an observation constrains
   nothing until a human takes it up.

   **No new table, because the observation already has a home.** `cadenza S-8` / `D-0020` rule 5 put
   the operator conversation in rondo's store, so an observation is a message in it and an elevation
   is a reference to that message. **This entry places one constraint on that unwritten schema
   rather than writing it**: the message id must be durable and immutable, which `D-0020` rule 5
   already requires for a different reason, and which is now load-bearing for provenance as well.

   **The hazard #41 names is answered by rule 2 and not by this rule.** Elevating is one gesture, so
   a thinly-founded observation can acquire the appearance of a proposal; what stops it is that the
   resulting proposal's claims carry bases that are locators, so a proposal elevated from a message
   that rests on nothing has a payload whose bases are empty and is visibly so.

8. **An `explanation` row carries `derivation`, a closed union, non-null exactly when `kind` is
   `explanation`; and `undetermined` is a value a claim may take, never an empty field.** A diagram
   drawn from identifier names and one derived from call structure or from tests that actually ran
   render identically, and without the attribute the reader cannot spot-check - fluency reads as
   understanding. `undetermined` as a first-class value has a precedent in the tree: `D-0029` rule 10
   makes `unavailable` a verdict rather than a missing row, for the same reason - an absence and a
   negative answer must not be the same thing at the only point where either matters.

   **Explaining is not reviewing, and the record keeps them apart** by rule 5: an explanation cannot
   be approved, and it is not a `lap_reading` verdict. `D-0029` rule 9 already refuses a clean
   reading as permission; this is the same refusal for the third voice, so that *"it was explained
   well"* can never come to function as *"it passed"*.

9. **`operator_view(actor_id, viewed_at_ms)`, append-only, is the durable last-look mark, and
   `viewed_at_ms` is the bound the render's own query used rather than the time the render
   finished.** #39's *"what changed since the operator last looked"* and #41's *"recovering context
   after a gap"* are the same question, and today only the replaced role's in-memory context answers
   it. Every record kind in the store already carries a caller-clock timestamp, so the only missing
   fact is where the operator's reading stopped.

   **Which value is written is the whole of the rule, and the obvious one is wrong.** Writing the
   clock at the *end* of a render loses every row committed while the render was running: it was
   never displayed, and its timestamp precedes the mark, so rule 11's query omits it for ever. So
   the surface samples the bound **before** it reads, uses that same bound as the upper limit of
   every query in the render, and writes it after; rule 11's comparison is inclusive of the bound.
   **The failure this shape accepts is showing something twice, and it narrows - rather than
   closes - the failure of losing something.**

   **Per-item read/unread flags are refused**: one row per look answers the same question as N rows
   per item, and a per-item flag is a mutable column on an immutable record, which is `D-0022` rule
   4's whole objection.

   **The ceiling, stated exactly, because a smaller claim was made here first and was wrong.** A
   timestamp cursor is **not** lossless, and the reason is not clock skew: these timestamps are the
   *caller's* clock, taken **before** the writer enters `BEGIN IMMEDIATE` (`D-0019`'s rule, restated
   at `records.ts:150-152`, and the idiom every store method already follows). So a writer that
   samples its clock before the render's bound and commits after the render's query has produced a
   row the operator never saw and whose timestamp is already behind the mark. Clock skew between
   writers widens the same window; it does not create it. **The window is sample-to-commit latency,
   and one lost row is silently lost** - which is the property #39 cares about most, since a stale
   premise is what a summary hides best.

   **The upgrade path, so this is a reduction and not an oversight.** A commit-ordered cursor closes
   it: writes to these tables are serialised by `BEGIN IMMEDIATE` and nothing here is ever deleted,
   so each append-only table's `rowid` is already in commit order, and the mark becomes a last-seen
   `rowid` per table instead of one timestamp. It is not taken now because it makes `operator_view`'s
   shape a function of the set of record kinds, and because the window it closes has never been
   observed - rondo has one operator, one surface and one writer at a time today. **The falsifier
   below is what takes it.**

   **What this does not claim.** A look is a claim by the surface that it rendered, not proof that a
   person read anything - the same grade as `D-0029` rule 11's third clause, and it is recorded here
   rather than left to be discovered.

   **Annotated 2026-09-12 by `D-0038`.** This rule's *"uses that same bound as the upper limit of
   every query in the render"* is scoped to the queries that answer *what changed since the mark*.
   `D-0038`'s per-proposal freshness re-gather is a query in a render that is deliberately
   **unbounded** - it reads past the mark by design, because its question is whether a proposal's
   own premise still holds and not what is new to the operator - so a `moved` verdict there is not
   evidence that the row falls inside this rule's changed-since set. **Nothing in this rule is
   corrected**: its shape, its stated ceiling and its upgrade path stand exactly as written.

10. **Both sides of the silence are one append-only table:
    `operator_attention(at_ms, subject_kind, subject_id, disposition, rule_name)`, where
    `disposition` is `presented` or `withheld` and `rule_name` is required on a `withheld` row.**
    #40's hazard is that a layer deciding what the operator sees also decides what they do not see,
    and that *"nothing happened"* leaves nothing to audit. The screen it asks for - *"six things
    were put to you, forty were not, here is the breakdown"* - is then one `GROUP BY` over one
    table.

    **One table rather than two, because the numerator and the denominator have to come from the
    same place.** A withheld-only table makes the count of what *was* put to the operator somebody
    else's problem, and the only candidate is `human_decision`, which counts **answers** and not
    presentations: with six proposals on the screen and none answered yet it reports zero. A
    presentation is a fact about the surface and an answer is a fact about a person, and #40's
    accountability claim is over the first.

    **A row rather than a column on the thing presented**, for two reasons. The most common
    withholding has nothing to carry a column: it was never composed into a proposal at all. And a
    `presented_at_ms` written onto a proposal row would be an update to a record `D-0022` rule 4
    makes immutable, trading the invariant for a value an append-only row holds just as well. The
    shape is not new either: `admission_refusal` exists for exactly this reason - a refusal that
    reserves nothing, takes no lock and would otherwise leave no trace, counted so that a bound can
    be raised because somebody was counted rather than because somebody complained.

    **`rule_name` is required on the withheld side, and it is the point of the table.** *"Suppressed
    40"* is a number; *"suppressed 40, of which 31 by the duplicate-delivery rule"* is a record. A
    withholding whose rule cannot be named is a judgement with no policy behind it, and the writer
    refuses it.

    **This is not `operator_view` and does not replace it.** One row per look answers *where the
    operator's reading stopped*; these rows answer *what was offered and what was not*. Collapsing
    them would make a presentation depend on somebody having looked.

    **What this cannot prove, stated rather than implied.** A suppression that writes no row is
    invisible to this table, so it bounds the *accountable* silence and not the total. That is the
    same residue `D-0029` rule 11 records for a model reader, at the same grade, and it is why #40's
    falsifier - can an operator reconstruct what was withheld in an interval - is answerable *for
    every rule that writes here* and not absolutely.

11. **Three enumeration queries ship with the record, and none of them is deferred.**
    - **Unconsumed decisions** - `D-0022` rule 19's acceptance criterion, inherited unchanged: under
      rule 17 an approved plan that is never admitted leaves no trace anywhere else.
    - **Terminal iterations** - `D-0022`'s residual, discharged here rather than carried. `read(id)`
      needs an id already known and `readLive` filters terminal rows out, so the abandoned iteration
      this whole component exists to explain cannot be found at all. `D-0029` rule 8 discharged the
      part its verdicts needed; #39's *"what changed"*, #41's inbox and #40's breakdown all need the
      rest.
    - **What changed since `t`** - one ordered read across the record kinds by their caller-clock
      timestamps, **inclusive of `t`** for rule 9's reason, which is what makes that rule's two
      columns worth storing.

    A query that does not exist is a field that cannot be shown, which is this entry's own subject
    applied to itself.

12. **Nothing in `src/` changes on this entry.** The DDL, the writer refusals of rules 5 and 10, the
    planted case of rule 5 and the queries of rule 11 are the next task, in that order, behind
    `D-0022` rule 12's build order. This entry is the record design that rule 19 permits to go first.

### The paper screen, drawn from the fields and nothing else

rondo#41's comment asks for exactly this before implementation: sketch the screen using only the
stored fields, and treat any region that cannot be drawn as a missing field discovered now. The
sketch, region by region, with its source:

| Region | Drawn from |
|---|---|
| *"3 waiting for you, 12 changed since 09:14"* | `operator_view.viewed_at_ms` (rule 9), counted over rows at or after the mark |
| One item's one-line title | the recommended option's label inside `payload` (rule 1) |
| Its options, with the recommendation marked | the ordered option set inside `payload` (rule 1) |
| The basis under each option | `basis` locators (rule 2): snapshot pointers render inline from the row's own verbatim snapshot, external locators render as something to open |
| *"Answering this issues one contract and cannot be undone"* | computed from `kind` and its target (rule 4) |
| The voice badge, and whether the item can be approved at all | `kind` (rule 5); an `explanation` also shows `derivation` and its `undetermined` claims (rule 8) |
| *"Changed since you last looked"* per item | the item's own timestamp against `operator_view` (rule 9) |
| Waiting on you / on CI / still running | `iteration.status` - already stored, no new field |
| *"6 were put to you, 40 were not"* with a breakdown | `operator_attention` grouped by `disposition` and `rule_name` (rule 10) - both counts from one table, neither of them inferred from `human_decision` |
| Where this came from | `elevated_from_message_id` / `elevated_by_actor_id` (rule 7), and `proposal_id` / `composition.contract_digest` for the rest of the chain |
| Answered / declined / still open, per item | `human_decision` outcome (rule 6) against the `presented` rows of `operator_attention` (rule 10) |
| A closed item, and what was decided | `human_decision` outcome (rule 6), reachable because of rule 11's terminal enumeration |

**Annotated 2026-09-11 by `D-0036`.** The row *"Waiting on you / on CI / still running"* above
names `iteration.status` as its source and over-describes what that source distinguishes: no member
of `IterationStatus` means *waiting on CI*, because CI runs inside `lap perform` and from rondo's
side the whole of it is `performing`. `D-0036` rule 5 takes the two-way partition - waiting on you /
in flight, over the eight non-terminal statuses - and refuses the third distinction, whose only
route is a widening of `D-0022` rule 3. **Nothing else in this entry is corrected**: the row's real
content is rules 9 and 11, which stand as written, and no measurement above is edited.

**Two fields were discovered by drawing it**, and both are in the rules above rather than in a later
diff: the per-option **label** (rule 1) - without it an inbox row has no line to print - and the
**outcome on `human_decision`** (rule 6), without which a declined item and an unanswered one are
the same absence. That is the acceptance test doing what it was proposed to do.

### What this does not do

- **It does not design #40's between-laps component.** Cross-lap coordination - a decision id claimed
  twice, one cause behind two blocked pull requests, work deliberately not started - is real and is
  owned by nobody, and no table here is for it. What survives without the component is rule 10: any
  layer that decides what the operator does not see writes a row when it decides it. Designing the
  rest before anything owns it would be the speculative record this entry's own build order refuses.
- **It does not decide when to interrupt, or what may be batched.** That is a policy, and a policy
  with no owner is not a column.
- **It does not write the conversation schema** (`D-0020` rule 5). It places one constraint on it
  (rule 7) and leaves it undecided.
- **It does not add a `status` column to anything**, and does not make any record here mutable.
  `D-0022` rule 4's grade is inherited exactly: immutability is a property of the schema and of the
  absence of a writer that updates, not of a trigger.
- **It does not give the gate answer a second home.** `A-8` and `D-0020` rule 5 stand; a basis may
  name `(gate_id, transition_seq)` and may never copy the body.
- **It does not widen what the advisory may read** (`D-0022` rule 3), and it grants no arrow and no
  external dependency.

### Residuals, with who decides

| Residual | Why not here | Who decides |
|---|---|---|
| The between-laps component and its own records (#40 sections 1 and 2) | Nothing owns the work yet, and a record for an unbuilt owner is the thing `D-0022` rule 20's build order exists to prevent | a later entry, once #40 has an owner |
| The conversation schema (`D-0020` rule 5) | Rule 7 needs one property of it - a durable, immutable message id - and needs none of the rest | the surface work |
| `derivation`'s members (rule 8) | The union is required now because retrofitting it touches the record; its exact members are a property of a reader that does not exist | the entry that admits a model explainer |
| Whether a look should be per-surface rather than per-actor (rule 9) | One operator, one allowlist of size one (`D-0020` rule 2), so the distinction is unobservable today | a second concurrent surface |
| Snapshot size (`D-0022` rule 4's verbatim snapshot) | Rule 2 makes inline rendering depend on it, which raises the cost of a large snapshot; nothing here measures one | the implementation, which is the first thing that can measure it |

### What was measured, and how

At rondo `2e9db2b` on **2026-09-11**, by reading rather than by running - **this entry measures
documents and schema, not behaviour**, and says so because the issues it answers are full of
measurements of a *different* organisation on 2026-09-07, which are that organisation's and are
cited here as requirements rather than re-verified.

- The record as it stands: `D-0022` rules 4, 9, 18 and 19, and `advisory.md` sections 6.1, 6.2, 6.3
  and 8 for the column list those rules take.
- The tables that exist: `iteration`, `admission_refusal`, `lap_reading` and the three claim indexes
  in `src/store/sqlite.ts`. `admission_refusal`'s comment is where rule 10 takes its shape and its
  argument from; `lap_reading`'s is where rule 8 takes `unavailable` as a value rather than a gap.
- The two enumeration duties of rule 11 that were already open: `D-0022` rule 19's own criterion and
  its "enumerating terminal rows" residual, and `D-0029` rule 8's discharge of the part its verdicts
  needed.
- **What was not measured:** no surface exists, so the paper screen above is a sketch and not a
  rendering; no snapshot has been sized; the completeness of rule 10's table is unprovable by
  construction; and whether an operator can in fact answer one of these in one sentence is
  unmeasured in rondo, because rondo has never put one in front of a person.

### What would falsify it

- **An operator answering a gate correctly from the composed decision and still failing to catch a
  wrong recommendation.** That is #39's own falsifier, and it falsifies rule 2 specifically: the
  basis would be reaching material that does not settle the claim.
- **A claim whose basis is neither a pointer into the snapshot nor one of rule 2's four external
  forms.** The union is closed; the first legitimate claim it cannot express reopens it.
- **A consequence of answering that is not a function of `kind`** - rule 4's stated trigger.
- **An explanation that somebody needs to approve**, which would mean the third voice is not a third
  voice, and would reopen rule 5 rather than adjust it.
- **A withholding whose rule cannot be named**, which is rule 10's writer refusal firing against a
  legitimate case and means the policy is not written down anywhere.
- **A row observed to land before a mark that was written after it**, or a second concurrent writer
  arriving at all - rule 9's named ceiling firing. Its answer is the per-table commit-ordered cursor
  that rule names, and not a change to what the mark is for.
- **A second surface, or a second approver**, which makes rule 9's mark per-actor-per-surface and
  makes `D-0020` rule 2's allowlist of size one a real set.
- **The between-laps component arriving** (#40), which is what turns rule 10 from a table with one
  writer into the audit surface #40 asks for, and may want fields this entry did not place.
- **The conversation schema arriving with message ids that are not durable and immutable**, which
  breaks rule 7's reference and would make the elevation link a dangling one.
- **`D-0022` rule 4 being superseded so the snapshot stops being stored verbatim**, which removes the
  inline half of rule 2 and turns every basis into something to open.
- Any measurement above failing to reproduce at `2e9db2b`.

---

## D-0033 — Nothing new owns the work between laps: three existing owners, a snapshot that widens instead of a component that decides, and one gap named rather than filled

**Status:** accepted (2026-09-11, rondo's human gate). Refs rondo#40, rondo#39, rondo#41.

**The draft of this entry has been removed rather than kept**, for `D-0029`'s reason and by
`D-0032`'s precedent. `docs/design/` carried it as `between-laps-ownership-decision-draft.md` so
the gate could approve text instead of a promise of text; once appended here it would be a second
copy of an accepted decision with no rule for which copy wins. Its history, including the two
review rounds that corrected rule 9's premise, is in the pull request that added it. **It leaves
no design document behind**, for `D-0032`'s reason: everything it measures is in `DECISIONS.md`,
in the schema and in `src/` already.

**One fact this entry rests on was answered by the human at the gate, and is recorded here because
it is an intention rather than a measurement.** Rules 2 and 3 hold because rondo has no act it can
take between laps by itself; whether it ever will is nobody's to measure. Asked directly, the gate
answered that **rondo is not to be given autonomy**: neither the advisory nor the part that talks
to a person acts on its own initiative, and the one candidate named for ever doing so was **the
search for the next piece of work**, which is a search that does not affect a lap. So the premise
is affirmed rather than assumed, and it is narrow enough to falsify: the trigger below is not
"rondo becomes autonomous" in general but **a self-started act that reaches a lap**, which is the
only kind that would move rule 2.

rondo#40 measures one day of the organisation rondo is meant to replace and finds
three functions with no owner in rondo's design: **coordination across laps**, **the
policy for when to interrupt the operator**, and **the operator's own thread**. It
is explicit that it is not asking for the thing to be built, and equally explicit
about the hazard if it accretes instead: *a layer that decides what the operator
sees can also decide what they do not see*, and silence leaves nothing to audit.

`D-0032` has since taken the record half of that hazard — `operator_attention`
counts both dispositions and refuses a withholding whose rule cannot be named —
and said in its own "what this does not do" that it does **not** design #40's
component, because a record for an unbuilt owner is what the build order exists to
prevent. This entry is the other half: it says who owns each of #40's three parts.

**Its finding is that the work needs no new authority, and therefore no new
component.** Every act #40 describes is either material for a person to read, or an
act rondo already has an owner and a refusal for. What is missing is not a
decider; it is a **snapshot that spans laps**, which is an argument to a function
that already exists.

### Decision

1. **No new role, no new layer, and no new authority.** #40's three parts are placed
   on three owners that exist today: composing cross-lap material is the advisory's
   (`D-0022` rules 1 and 2); the policy for what reaches the operator is the
   **operator's own**, as data (rules 6 and 7 below); the operator's thread is the
   operating surface's (`D-0020` rule 5, `D-0032` rules 9 and 11). Placing duties is
   what closes #40, not inventing a component to hold them.

2. **Everything #40 section 1 asks for is `explanation` under `D-0022` rule 4's
   `kind` union: it binds nothing, and by `D-0032` rule 5 it cannot be approved.**
   The three measured cases — two branches claiming one decision id and one
   migration number, one defect behind two blocked pull requests, work deliberately
   not started — are each **material a person acts on**, and none is an act rondo
   can take. rondo holds no push credentials and stops at the closed gate
   (`D-0010`), files no issue, renames nothing in a repository, and reaches the
   world only at `publish` (`D-0029` rule 3).

   **This is the hazard's answer at the type level rather than in prose.** The layer
   that reads across laps can produce a sentence and can never produce a stop. No
   new approvable kind is added, and the writer refusal `D-0032` rule 5 already
   specifies is what proves it.

3. **The one between-laps act rondo *can* take is admission, and it already has an
   owner and a refusal.** "Not starting work" is `D-0023`'s ledger — the bound
   refuses and writes an `admission_refusal` demand row (`src/store/sqlite.ts:542`,
   written at `:1116`) — or a person who does not run `start`. An advisory that
   could withhold an admission by itself would be the advisory deciding, which
   `D-0022` rule 2 removes by construction. So #40's deliberate non-starts become:
   an `explanation` naming the collision or the cost, a human who does not admit,
   and — where the bound was what refused — a row that was already being counted.

4. **What changes is the snapshot, not the function.** `propose(snapshot) ->
   Proposal` stays total and pure (`D-0022` rule 2); a between-laps proposal is one
   composed from a snapshot that spans **every** iteration rather than one. The
   gathering is the composition root's, which is where rule 2 already put it, and
   the reads it needs are `D-0032` rule 11's three enumeration queries — unconsumed
   decisions, terminal iterations, what changed since `t` — none of them new and
   none of them added here.

   **This is the whole of the mechanism.** There is no scheduler, no daemon, no
   second loop and no new table in this entry. `D-0022` rule 3's read allowance is
   not widened by a word: a host-wide snapshot is more rows of rondo's own store,
   not a new source.

5. **Batching is presentation and needs no policy; withholding is what needs one.**
   #40 counts three gates batched into one and routine noise never surfaced at all,
   and they are different acts. A batched item is still a `presented` row under
   `D-0032` rule 10, so batching costs no accountability and requires no rule name.
   Only *not shown at all* is a withholding, and rule 10's writer already refuses
   one whose rule cannot be named.

6. **Until an operator has written a suppression rule, nothing is withheld, and
   that default is this entry's decision rather than its silence.** Measured: the
   surface shows every live row and, where "the live one" is ambiguous, **refuses
   and names them** rather than choosing (`src/access/cli.ts:799-832`).

   **The alternative refused is a default suppression list**, drawn from the
   replaced organisation's written rules — duplicate terminal deliveries, ledger
   synchronisation, watcher pane cleanup. Those rules were measured on a different
   machine, against a different day's traffic, and rondo emits none of those events.
   A default the operator never wrote is precisely the unauditable silence #40 names,
   arriving as a shipped default instead of as a judgement.

7. **When an attention policy exists it is data the operator owns and the host
   reads, in the shape `HostPolicy` already has, and this entry does not write it.**
   `HostPolicy` is two numbers, validated, read once where the store is opened
   (`src/refrain/policy.ts:69-106`, read at `src/access/cli.ts:868-893`), and
   `D-0023` rule 13 named the durable operator-editable form and deliberately did
   not take it. An attention policy has the same shape and the same argument. What
   this entry places is one constraint on that unwritten artefact: **a `rule_name`
   written into `operator_attention` must name a rule in it**, so that
   `D-0032` rule 10's breakdown resolves to something a person can read and edit.
   A suppression policy expressed as code is refused for the same reason: a rule the
   operator cannot read back is silence with a compile step.

8. **The operator's thread gets no new owner, and the worker half of #40 section 3
   is already carried by a column.** #40's lost sessions were a worker's, and the
   material was carried across by the surrounding role rather than by any record; in
   rondo a lap's session identity is on the iteration row (`session_id`,
   `session_path`, `src/store/sqlite.ts:527-528`) beside its status and reason, and
   the row outlives the session by construction. The operator's own half — what was
   decided earlier, what changed since, what a decision has foreclosed — is
   `D-0020` rule 5's conversation with `D-0032` rule 9's mark and rule 11's "what
   changed since `t`". This entry writes neither schema and adds no field to either.

9. **Collisions inside a repository's own namespace are owned by nobody, this entry
   says so rather than placing an owner, and records that the gap is live today
   rather than waiting on a raised bound.** rondo de-conflicts only the identifiers
   it mints — the `(run id, topic branch, workspace)` triple derived from the
   iteration id (`D-0023` rules 3 to 7). A decision id or a migration number lives
   **inside the work**, and rondo's only reader of that work is `D-0029`'s lap
   reading, which reads one lap's material for one gate and compares nothing to a
   second lap.

   **It is already reachable, and the first draft of this rule said otherwise.** The
   bound that matters is not `maxOccupying` but `maxLive`, which is **three** by
   default (`src/refrain/policy.ts:103-106`): an iteration suspended at a gate stops
   occupying an execution slot and keeps its branch (`D-0023` rule 2, `D-0023` rule
   8's two bounds). So one lap may take migration `0005`, suspend at its gate, and a
   second lap started against the same unmerged base may take `0005` again — with
   `maxOccupying` still one and continuo still serialising execution. **Serial
   execution bounds what runs, never what accumulates on open branches**, and #40's
   measured case is exactly two branches, not two running workers.

   **Who bears it: the operator, knowingly.** The gap is left unowned because the
   thing that would close it does not exist and is not cheap: comparing what two laps
   wrote requires a reader across branches, where `D-0029`'s reading is per-lap and
   per-gate by construction. What this entry refuses is closing it by assertion — a
   rule saying the collision cannot happen would have been wrong, which is how this
   paragraph got its shape. Rule 4's host-wide snapshot is the **detection point when
   somebody builds one**: two live iterations are two rows in it, and rondo's own
   `D-0023` triple is what tells them apart.

10. **Whatever is built first for #40 writes to `operator_attention` or does not
    ship.** `D-0032` rule 10 designed the table with one writer in mind and this
    entry supplies it: a between-laps composer that puts something to the operator
    writes a `presented` row, and one that withholds writes a `withheld` row naming
    its rule. Under rule 6 the second is empty until an operator writes a policy,
    which is the point — the denominator is recorded from the first day rather than
    reconstructed after somebody complains.

11. **Nothing in `src/` changes on this entry**, and it takes no implementation. It
    supersedes nothing and corrects nothing. `src/advisory/` does not exist in the
    tree at the revision measured; the layer `D-0022` rules 1 and 2 authorise is
    separate work, and rule 4's snapshot argument above is a property of what that
    layer is *handed*, not a change to what `D-0022` decided it is.

### The options, and why the others were refused

| Option | Outcome |
|---|---|
| **A. A new between-laps component with its own authority** — the replaced role, reproduced: it watches every lap, decides what to interrupt for, and starts or stops work | **Refused.** It would be the only thing in rondo that decides what a human sees, which is #40's own stated hazard; and it would be the first authority in rondo that ends somewhere other than a human gate. Every existing one ends at one (`D-0009`, `D-0010`, `D-0022` rule 9, `D-0031` rule 6) |
| **B. Widen the advisory's snapshot to the host and keep its authority at zero** | **Taken** (rules 2 and 4). It adds no authority, no layer, no table and no read allowance — only more rows in an argument |
| **C. Put the between-laps work in the operating surface** | **Refused.** The surface composes and issues contracts; a surface that also drafted across laps would put the drafter in the layer that may issue, which is exactly why `D-0022` rule 1 overruled rondo#9's own proposal of `src/access` |
| **D. Place no owner at all and leave #40 open** | **Refused for two of the three parts, taken for the third** (rule 9). Sections 1 and 2 have owners available today at no cost; the repository-namespace half genuinely has none, and rule 9 takes that reading with the risk stated — the collision is reachable at today's bounds and the operator knowingly bears it, which is more useful than a component that would need a reader across branches nothing in rondo has |
| **E. An attention policy written as code** | **Refused** (rule 7). A rule the operator cannot read back or edit is an unauditable silence with a compile step, and `D-0032` rule 10's `rule_name` would resolve to an identifier only a reader of `src/` could check |

### What this does not do

- **It does not build anything.** No file under `src/` is touched, and the snapshot
  widening of rule 4 is a property of the composition root the advisory layer does
  not have yet.
- **It does not decide when a between-laps proposal is composed.** Nothing in rondo
  runs periodically, and one operator asking is enough; a schedule is a decision for
  whichever surface first has a reason to want one.
- **It does not write the attention policy** (rule 7), the conversation schema
  (`D-0020` rule 5), or any DDL. It places one constraint on the first and none on
  the second beyond `D-0032` rule 7's.
- **It does not widen what the advisory may read** (`D-0022` rule 3), grant an arrow,
  or add an external dependency.
- **It does not re-decide the audit surface.** `D-0032` rule 10 stands as taken;
  rule 10 above only names its writer.
- **It does not claim #40's function is cheap.** It claims the function is
  *material plus a policy the operator owns*, and that the part which looked like a
  new role was the part rondo cannot do at all.

### Residuals, with who decides

| Residual | Why not here | Who decides |
|---|---|---|
| The attention policy artefact — its format, where it lives, how it is edited | Rule 6's default is "withhold nothing", so nothing is blocked on it; its shape is a property of the surface that edits it | the surface work, or the first operator who asks for a suppression |
| What triggers a between-laps composition | No surface exists to ask, and nothing in rondo runs on a schedule | the surface work |
| Cross-lap collisions in a repository's namespace (rule 9) | Live today at `maxLive` three, and closing it needs a reader across branches that nothing in rondo has; the operator bears it in the meantime | a later entry, once something can read two laps' material together |
| Whether a host-wide snapshot stays affordable | Nothing has measured a snapshot of any size; `D-0032`'s own snapshot-size residual is the same question one row at a time | the implementation, which is the first thing that can measure it |
| The conversation schema (`D-0020` rule 5) | Rule 8 needs it to exist and needs no property of it that `D-0032` rule 7 has not already required | the surface work |

### What was measured, and how

At rondo `e1a64ff` on **2026-09-11**, by reading rather than by running. #40's own
measurements are of a **different organisation** on 2026-09-07; they are cited here
as requirements and are not re-verified, which is `D-0032`'s treatment of the same
material.

- **The tree has no between-laps anything, and no advisory layer yet**: `src/`
  holds `access`, `cadenza`, `continuo`, `refrain`, `store` and the barrel, and the
  boundary table classifies exactly those
  (`test/architecture/import-boundaries.test.ts:124-161`).
- **The acts rondo can take between laps**: admission and its refusal
  (`src/store/sqlite.ts:542`, `:1116`), the bounds `maxOccupying` / `maxLive`
  (`src/refrain/policy.ts:69-106`) and their environment read
  (`src/access/cli.ts:868-893`). The comment at `src/access/cli.ts:860-866` is what
  rule 9 cites for continuo still serialising execution — and what rule 9 is careful
  **not** to read as a bound on how many branches are open.
- **What the surface shows today**: `pickWaiting` lists every live row and refuses
  on ambiguity rather than choosing (`src/access/cli.ts:799-832`), which is rule 6's
  default already being the behaviour.
- **What carries a lost session**: `session_id` and `session_path` on the iteration
  row (`src/store/sqlite.ts:527-528`).
- **The record duties already taken**: `D-0032` rules 5, 9, 10 and 11, and its own
  statement that #40's component is not designed there.
- **What was not measured**: no snapshot has been gathered or sized; no surface
  exists, so rule 6's default is the CLI's behaviour and not a screen's; no
  collision of rule 9's kind has been observed in rondo's own laps, which is why
  that rule is argued from the bounds and from #40's measurement of another
  organisation rather than from a rondo incident; and no operator has ever been
  offered a between-laps proposal, so whether one is useful is unmeasured in rondo.

### What would falsify it

- **A collision observed between two of rondo's own laps** — rule 9's gap firing,
  which it can do at today's defaults. Raising `maxLive` widens it and raising
  `maxOccupying` (`D-0023` rule 17, continuo `D-1104`) widens it again; neither is a
  precondition, and treating one as a precondition is the error this rule was
  corrected for.
- **A between-laps output that somebody has to approve.** Rule 2 would be wrong: the
  layer would need authority and therefore a gate of its own, which is option A
  arriving on evidence rather than on anticipation.
- **rondo gaining an act it can take between laps by itself** — push credentials,
  issue filing, a rename — which reverses rules 2 and 3 at their premise. The gate's
  recorded answer above is what makes this a falsifier rather than an open question, and it
  draws the line where the answer drew it: a self-started **search for the next piece of
  work** does not fire it, because it reaches no lap; a self-started act that reaches one
  does.
- **An operator asking for a withholding whose rule cannot be written as data**
  (rule 7), or naming a `rule_name` that resolves to nothing.
- **A host-wide snapshot that cannot be gathered affordably**, which moves rule 4
  from "the same function with a wider argument" to a component with a read strategy.
- **Silence that leaves no row**, observed after the first #40 work ships — rule 10
  failing in practice, which `D-0032` rule 10 already records as the bound it cannot
  prove.
- **continuo `D-1104` landing** (`D-0023` rule 17), and **the conversation schema
  arriving** (`D-0020` rule 5), each of which unblocks a residual above.
- Any measurement above failing to reproduce at `e1a64ff`. The commits between that revision
  and this entry are the draft it was taken from, and they change no code.

---

## D-0034 — An explanation carries claims and no recommendation: how `D-0032` rule 1 and rule 5 are read together

**Status:** accepted (2026-09-11, rondo's human gate). Refs rondo#39, rondo#40, rondo#41.

`D-0032` rule 1 says a proposal's payload is an **ordered set of options**, each carrying a label, its
candidate value and its basis, with **exactly one** marked as the recommendation. Rule 5 says an
`explanation` **binds nothing, ever**: it is absent from `APPROVABLE_PROPOSAL_KINDS`, and the store's
writer refuses a `human_decision` whose proposal names it (`src/store/records.ts`, the refusal in
`advisoryRecord.recordDecision`). Read literally and together, the two require an explanation to carry
a recommendation nobody may act on.

**The question could not be deferred.** `D-0022` rule 20 and `D-0032` rule 12 both leave `src/` alone,
and the `src/advisory` task is the first thing that has to emit a payload -- so the shape is decided
by whatever that code does, with or without an entry. This entry is that decision recorded, taken at
the gate rather than inside an implementation diff, and the reading it takes is the one the layer
shipped under.

### Decision

1. **An `explanation`'s payload is an ordered list of claims, and it carries no recommendation.**
   Rule 1's option set is the shape of the thing being **approved** -- #39's "answerable in one
   sentence", which is a proposal, its alternatives and a recommendation -- and rule 2 names the two
   as different members of a payload in its own words: *"every claim and every option in the payload
   carries a `basis`"*. An explanation has nothing to approve, so a recommendation on one would be the
   third voice acquiring the grammar of the first. That is the confusion rule 5 and rule 8 exist to
   prevent, stated there as *"it was explained well"* never coming to function as *"it passed"*.

2. **Options and the recommendation arrive with the four approvable kinds**, exactly as rule 1 states
   them. Nothing here narrows that rule; it bounds its subject, which rule 1 did not need to do
   because no kind had been built when it was written.

3. **A claim carries a basis on the same terms an option does** (rule 2, unchanged): the closed union
   of five locator forms, prose only where it travels with its basis, and a pointer into the row's own
   verbatim snapshot as the one form that renders inline. A claim with no basis is the summary #39
   measured an operator approving three times in one day, and the kind that binds nothing is not
   exempt from that -- an explanation is read to decide something, even when it authorises nothing.

4. **Nothing in `D-0032` is superseded or corrected.** Rules 1, 2, 5 and 8 all stand as written. This
   is a reading of two of them where they meet, and it is a new entry rather than an annotation
   because it settles a question `D-0032` left open rather than recording that one of its own claims
   has moved.

### What this does not do

- **It does not decide what an `explanation` must claim.** Which facts an explanation is worth
  composing from is the drafter's, and `D-0032` rule 3 keeps the rendering out of the record entirely.
- **It does not make `undetermined` optional.** Rule 8 stands: a claim the snapshot does not settle
  says so and is not dropped.
- **It does not admit a model explainer**, or fix `derivation`'s members, which stays `D-0032`'s
  residual for the entry that does.
- **It does not touch the four approvable kinds**, whose option sets are unbuilt.

### What was measured, and how

At rondo `5ca6318` on 2026-09-11, against the schema and the writers `D-0032` produced in #51: the
`proposal` table's `CHECK ((derivation IS NOT NULL) = (kind = 'explanation'))`, `PROPOSAL_KINDS` and
`APPROVABLE_PROPOSAL_KINDS` in `src/store/records.ts`, and `recordDecision`'s refusal of a
non-approvable kind inside its own `BEGIN IMMEDIATE`. The store holds `payload` verbatim and reads
nothing into it, so nothing in the schema constrains the shape this entry takes -- which is why the
shape had to be decided somewhere, and is why it is decided here.

### What would falsify it

- **An explanation somebody needs to approve**, which is `D-0032`'s own stated falsifier for rule 5
  and would mean the third voice is not a third voice.
- **A payload consumer that cannot render claims and options as different shapes**, which would make
  one shape for both cheaper than the distinction is worth.
- **A claim that is only meaningful as one of a set of alternatives** -- an explanation whose honest
  form is "either of these two readings of the row fits" -- which would reopen whether an option set
  without a recommendation is a third shape rather than a narrowing of rule 1.

---

## D-0035 — What actually releases the conductor's slot: the exit status continuo's contract defines, and an abnormal end that keeps it

**Status:** accepted (2026-09-11, rondo's human gate). Refs rondo#24.

This entry takes rows `S-1` … `S-4` of
[`docs/design/refusal-session-lock.md`](docs/design/refusal-session-lock.md), which was written
propose-only and named this entry's question in advance. **The document is kept rather than
removed**, unlike the drafts `D-0029` and `D-0032` withdrew: it is not a copy of this entry but the
measurement record underneath it -- what the pinned continuo's teardown does, in which states it
declines to stop, and which of those a host can see -- and `D-0022`, `D-0023` and `D-0029` all
leave such a document standing. **This entry governs wherever the two differ.** Its rows `S-5` and
`S-6` are *not* taken here: `S-5` is rondo#55 and `S-6` is an ask filed against continuo.

**It supersedes nothing, and `D-0019` rule 11's table is untouched.** What changes is the reason
under the rule and one mapping in the composition root. `D-0019` gains a dated annotation.

### What the question was

`D-0019` rule 11 releases the conductor's capacity when a `performing` iteration receives a refusal
and keeps it when the iteration receives nothing, "and the difference is not how bad the outcome was
-- it is whether anything might still be running". `continuo D-1102` then made some `lap perform`
refusals carry a `session_id`, which are exactly the refusals raised after the walk: a turn that
outlived its budget, a terminal report that could not be read or was about another session. If a
refusal can name a live session, rondo#24 asked, is "an answer came back" still the same fact as
"nothing of the lap's is running", and should the release wait for a confirmed stop or an
`abandon()`?

### Decision

1. **A refusal that names a session releases the slot. `D-0019` rule 11 stands, and the reason
   under it is replaced.** The rule's own premise -- "an answer arrived, so the CLI is over and no
   worker of its is still running" -- is not what makes the release safe, and was never checked
   against the case where continuo declines to stop. What makes it safe is measured at the pinned
   revision `38c667b`: continuo's CLI sets `process.exitCode` and never calls `process.exit`
   (`src/cli.ts:298`), its provider keeps the spawned child in `#sessions` and never `unref`s it
   (`src/session/claude_cli_provider.ts:1931`), and continuo's own teardown states the consequence
   -- "the provider holds a referenced handle to it, so `lap perform` may not return until that
   child exits" (`src/lap/root.ts:1581-1586`). **A live child therefore holds the CLI open, and an
   invocation that came back is one whose child is gone.**

   **This is a stronger fact than the issue expected, and it covers more states than the issue
   listed.** The teardown declines to stop a session in *three* states, not one: `LoserTerminated`
   with `stopAttempted === false` (`src/supervisor.ts:582-601`), a lease epoch that moved under a
   long turn so the session is no longer this lap's (`root.ts:1628-1641`), and a stop the provider
   did not confirm (`root.ts:1654-1673`). In each of them the child is left running -- and so is the
   CLI, which then does not answer at all. That path is rondo's ceiling firing, which `D-0019`
   rule 12 already routes to `noAnswer` and which already keeps the slot.

2. **The releasing fact is the exit status continuo's contract defines, and not the outcome's
   class.** `ArgparseExit` is constructed with `0` and `2` at the pinned revision and with no other
   value, and `mainAsync` returns an `ArgparseExit`'s code while **rethrowing everything else**
   (`src/cli.ts:222-231`) into a top-level `await`. So an escaping exception ends the process at
   exit 1 *immediately*, holding no handle open and running no more of the teardown -- and a throw
   inside the teardown itself is reachable, because `stillThisLapsSession` reads SQLite where
   `stopSession` swallows its failures. **Exit 0 and exit 2 are evidence that the CLI came back
   through its own reporting path; every other ending is evidence of nothing.**

3. **`decode` gains a seventh outcome, `endedAbnormally`, and the composition root maps it to
   `noAnswer`.** A death by signal and a status the contract does not define stop being
   `invokerDefect` and become their own variant (`src/continuo/protocol.ts`), and `asEffect` reads it
   the way it reads a ceiling that fired (`src/access/conductor.ts`): the row keeps `performing`, the
   execution slot stays taken, and the report says a human is needed. Every other `defect` -- an
   unreadable document from an orderly exit 0, a protocol break, a call rondo made wrong -- keeps
   releasing, because the process it was diagnosing had already come back through its own reporting
   path.

   **A variant rather than a boolean on `invokerDefect`**, for `timedOut`'s reason and by its
   precedent: the difference is what the conductor does next, and a closed union is where rondo
   writes down "the answer to *what does rondo do now?* differs for each". `decodeMeasureReport`
   draws the same two branches even though that verb drives no lap, because one decoder disagreeing
   with the other about what a signal death is would read as a difference that meant something.

4. **No waiting state, and `abandon()` gains no ordinary path.** Nothing waits for a stop to be
   confirmed, no non-terminal status is added to rule 11's table, and no refusal is held back. The
   alternative -- hold the slot on any refusal that names a session until a stop is confirmed -- was
   available and is refused, because at this pin **there is no fact to confirm against**: continuo's
   CLI mounts six verb groups and none of them is `session` (`src/cli.ts:124-182`), and `run show`'s
   session rows cannot answer liveness, since `released_at_ms` has no writer anywhere in continuo's
   `src/` (`releaseBinding` is exported and never called) and `provider_state` is a snapshot taken
   when the identity was confirmed. The only exit from such a hold would be an operator's
   `abandon()`, taken on every ordinary turn timeout -- which inverts rule 11 in exchange for
   nothing.

### What this costs, stated rather than argued away

An exit 1 that is genuinely rondo's own fault now **stalls the row instead of failing it**.
`D-0015`'s exception 2 is the known example: a relative `--workspace` escapes continuo as exit 1 and
a raw stack, and rondo's pre-spawn validation exists so that never happens. Under this entry such a
lap is held at `performing` for a person to settle rather than filed as a lap that failed. That is
deliberate -- rondo cannot tell that exit 1 from the one an exception escaping the teardown produces,
and only one of the two is safe to release on -- and the cost is bounded by the validation that
makes the state unreachable in the first place.

### What is not decided

- **The worker's own descendants.** The child leads its own process group and continuo's stop
  signals the group, but nothing in the handle argument covers a grandchild that outlives the child.
  rondo has no evidence either way and this entry claims none.
- **A session adopted by pid rather than by handle**, which continuo's `resume` path can produce.
  The fresh-spawn path a rondo lap drives always holds a handle; no lap-1 path was found that does
  not, but that was read rather than exercised.
- **None of this was reproduced by running a lap.** Every claim above is a reading of the pinned
  source, and the design document says so in the same words.
- **Capacity.** These rules decide *when the slot is given back*, not how many laps may hold one.
  `D-0023` rule 17 leaves `maxOccupying` at one until `continuo D-1104`; a host that raises it should
  re-read that rule and rule 18 rather than this entry.

### What would falsify it

- **continuo `unref`s a child handle, calls `process.exit`, or otherwise lets `lap perform` return
  with a live child of its lap's.** Rule 1's whole argument goes with it and the question reopens.
  This is the thing to check when the pin moves.
- **continuo constructs an `ArgparseExit` with a third code**, which would have to be sorted into
  "reported" or "ended abnormally" before rule 2 could stand as written.
- **continuo grows a `session` verb group, or puts a stop-confirmation field on the refusal
  envelope** (the `S-6` ask). Rule 4's refusal was taken on there being no fact to wait for, and that
  is the change that would supply one.
- **`released_at_ms` acquires a writer**, which would make `run show` an answer to liveness and
  reopen the middle option rule 4 rejected.
- Any measurement above failing to reproduce at continuo `38c667b` and rondo `f74c37c`, which is
  this entry's base. The continuo readings were taken against the pin and the rondo ones against
  `e1a64ff`; `npm run verify` is green on the base above with the rules implemented.

---

## D-0036 — The operator's inbox, decided as three open questions and not as a fourth record design: a presentation counted once per subject, the conversation only as far as elevation reaches, and a two-way wait that admits it is not three

**Status:** accepted (2026-09-11, rondo's human gate). Refs rondo#39, rondo#40, rondo#41.

**The scope was proposed and approved before the entry was drafted**, which is why this entry is
short where `D-0032` is long. rondo#41 states five requirements on the operator's surface. Four of
them already have decided *and shipped* answers (`D-0032`, `D-0034`, in #51 and #53), and
re-deciding them here would produce a second home for a rule rather than a rule. **This entry takes
the three questions #41 raises that nothing in the tree answers, and nothing else.**

**The draft of this entry has been removed rather than kept**, for `D-0029`'s reason and by
`D-0032`'s precedent: `docs/design/` carried it as `operator-inbox.md` so the gate could approve
text instead of a promise of text, and once appended here it would be a second copy of an accepted
decision with no rule for which copy wins. Its history, including the Codex round that made rule 5's
partition exhaustive, is in the pull request that added it. **It leaves no design document behind.**

### What #41 asks that is already answered

Listed rather than re-decided, because a requirement met by an existing rule
needs a citation and not a new one. Nothing in this section adds a rule.

| #41's requirement | Where it is answered | State in the tree |
|---|---|---|
| §1 The unit is a decision — proposal, alternatives, recommendation, and what answering forecloses | `D-0032` rules 1-4; `D-0034` bounds rule 1 to the approvable kinds | `proposal.payload` holds the ordered option set verbatim; `sqlite.ts:629-655` |
| §2 Two voices, distinguishable without reading their prose | `D-0032` rule 5: authority is a function of `kind` alone, never of `drafter` and never of prose, enforced by a writer refusal rather than by a badge | `PROPOSAL_KINDS` / `APPROVABLE_PROPOSAL_KINDS` and the refusal inside `advisoryRecord.recordDecision` |
| §3 The elevation chain is recorded | `D-0032` rule 7: two nullable columns that are null together | The columns exist (`sqlite.ts:649-654`); **nothing writes them yet** — rule 3 below is why |
| §4 Recovering context after a gap | `D-0032` rule 9 (`operator_view`, the bound sampled *before* the read) and rule 11 (`changedSince(t)`, inclusive of `t`) | Both shipped; `changedSince` is one statement built from a table of record kinds |
| §5 Silence is part of the display | `D-0032` rule 10: one table for both dispositions, `rule_name` required on the withheld side | `operator_attention` exists with both `CHECK`s; `explain` is its first `presented` writer (`access/advisory.ts:314`) |

**The third voice #41's second comment reserves a place for** — a non-binding
explanation produced by a reader that is not the change's author — is `D-0032`
rules 5 and 8 and `D-0034` in full. It is not reopened here.

### Decision

1. **A presentation is counted once per subject, not once per render**, and the two rejected
   options are recorded with what each of them protected.

   `D-0032` rule 10 makes `operator_attention` answer #40's question — *"six things
   were put to you, forty were not, here is the breakdown"* — as one `GROUP BY` over
   one table. The writer it was written against is a **one-shot verb**: `explain`
   composes, records, presents, and counts what it presented, once
   (`access/advisory.ts:308-323`). #41 §4 describes the opposite motion. The inbox is
   looked at **repeatedly, across gaps**, because most of the elapsed time is waiting
   and the property that matters is recovering context after an interval. Counting at
   each render makes one unanswered proposal, looked at twenty times over a morning,
   report twenty presentations.

   **This is not a bug in `D-0032` and it is not visible from inside it.** It appears
   only where #41 §4 (a surface looked at repeatedly) meets #41 §5 (a count of what
   was and was not shown). Rule 10 is correct for every writer that existed when it
   was written.

   **The choice is not about implementation cost. All three options cost about the
   same, and they differ in what they treat as the thing being accounted for.** That
   sentence is in this entry rather than in a review comment because without it a
   later change can fall to the second option innocently, on the entirely reasonable
   ground that it records more.

   - **Counted once per subject (taken).** The ratio keeps the meaning #40 asked for:
     the numerator is *things put in front of the operator* and the denominator is
     *things withheld from them*, both counts of subjects. What it does not record is
     that a subject was shown twenty times and answered none of them.
   - **Counted once per render (refused).** It records that repetition, and in
     exchange rule 10's `GROUP BY` stops reading as *"six were put to you, forty were
     not"*: the numerator becomes a count of renders and the denominator a count of
     subjects, and a ratio between two different quantities is a number with no
     sentence attached. #40's accountability claim is over *what the operator was
     offered*, which is a set of subjects.
   - **Counted once per last-look mark (refused).** The honest middle, and it is
     refused for a structural reason rather than a preference: it makes rule 10's
     table depend on rule 9's, and `D-0032` rule 10 separates them in its own words —
     *"This is not `operator_view` and does not replace it"*, because collapsing them
     *"would make a presentation depend on somebody having looked"*. This option is
     that collapse arriving through the writer instead of through the schema.

   **A repeat presentation is a no-op and not a refusal, and the distinction is
   load-bearing.** `explain`'s `presentedUncounted` arm exists to say that the
   surface's own accounting is short (`access/advisory.ts:55-66`); a second render of
   an already-counted subject is not that case — the invariant *every presented
   subject has a row* holds. So the second write reports success and stores nothing.
   The shape is the partial unique index this repository already uses for the
   allocator's claims (`D-0023`), on `(subject_kind, subject_id)` where `disposition`
   is `presented`, with the insert taking the conflict as a no-op. SQLite treats
   NULLs as distinct in a unique index, which is the behaviour wanted rather than one
   tolerated: a `withheld` row carries no `subject_id` in the most common case
   (`D-0032` rule 10), and those must never collide with each other.

   **The ceiling, stated.** *When* a subject was first shown is preserved; *how often*
   is not, and is not recoverable afterwards. If the question *"how many times did we
   put this in front of them before they answered"* ever has to be answered, this rule
   is what has to move, and the second option is what it moves to.

2. **"How long it sat unanswered" gets no column**, because it is a subtraction over rows
   that already exist.

   The inbox's most-wanted line — *this has been waiting on you since 09:14* — is the
   proposal row's `created_at_ms`, or its `presented` row's `at_ms`, against the
   absence of a `human_decision` for that `proposal_id`. `D-0032` rule 6 already makes
   *declined* and *never answered* different rows rather than the same absence, which
   is the only thing that made the subtraction ambiguous. A column would be a second
   home for a computed fact, which is `D-0022` rule 8 and `D-0032` rule 4's own
   argument applied to the field that would have been added first.

3. **The conversation schema is fixed only as far as elevation reaches: three properties,
   and the rest stays explicitly undecided.**

   `D-0032` rule 7 places `elevated_from_message_id` and `elevated_by_actor_id`, and
   points them at a conversation that `D-0020` rule 5 put in rondo's store and that
   nothing has ever written. The tree is consistent about this and says so out loud:
   `src/access/advisory.ts:293-296` writes the pair as `null` with a comment naming
   `D-0020` rule 5 as the reason, and no `CREATE TABLE` in `src/store/sqlite.ts` is a
   conversation.

   **This entry is the right place to settle it, and the reason is recorded so a later
   reader does not have to reconstruct it.** `D-0032`'s residuals table names the
   decider of the conversation schema as *"the surface work"* — this task. It is not
   blocked on another entry and never was; asking who owns it produces this entry.

   Three properties are fixed, and they are the three that elevation reaches:

   1. **A message id is durable and immutable.** `D-0020` rule 5 already requires this
      for a different reason — so that a `HumanDecisionRecord.decisionId` is never a
      chat message id unless it is both — and `D-0032` rule 7 now makes it
      load-bearing for provenance as well. Two rules needing the same property is the
      argument for fixing it and not for fixing more.
   2. **An observation is a message in that conversation**, and nothing else. #41 §3's
      chain — `observation -> (operator elevates) -> proposal -> (operator approves)
      -> contract` — has one link with no home, and this is what gives it one without
      a table of its own.
   3. **A gate answer never lives there.** `D-0020` rule 5's own constraint, restated
      because elevation is the first thing that could violate it by accident:
      `gate_transition.body` is the verbatim human answer, and a paraphrase in that
      slot records as human approval.

   **Everything else about the conversation stays undecided**: the message body's
   type, its authorship, ordering, threading, retention, and whether the surface
   writes to it at all before an operator does. Nothing composes a message today, so
   deciding the rest would be the speculative record `D-0022` rule 20's build order
   exists to prevent — and `D-0032` was careful to place *one* constraint rather than
   a schema for exactly this reason. This entry does not widen that; it fixes the two
   further properties elevation cannot proceed without.

4. **An elevation that names no message is refused by the writer, in the shape `D-0032`
   rule 5 already uses.**

   Rule 3's first property is worth nothing if a proposal may carry an
   `elevated_from_message_id` that resolves to nothing: a dangling reference makes the
   chain #41 §3 asks to record indistinguishable from one that was never recorded, and
   it does so *after* the fact, when the message that would have justified the
   proposal is what a reader went looking for. The writer refuses a proposal whose
   `elevated_from_message_id` names no message in the conversation, and — following
   `D-0032` rule 5's precedent exactly — **the refusal is proved by a planted case**
   rather than asserted.

   **The hazard #41 §3 names is still answered by `D-0032` rule 2 and not by this
   rule.** Elevating is one gesture, so a thinly-founded observation can acquire the
   appearance of a proposal; what stops that is that the resulting proposal's claims
   carry bases that are locators, so a proposal elevated from a message resting on
   nothing has a payload whose bases are empty and is visibly so. This rule only
   stops the *reference* from lying.

5. **The wait is a two-way partition and not the three-way one #41 §4 describes; the third
   distinction is refused because taking it means widening what rondo may read.**

   `D-0032`'s paper screen draws *"waiting on you / on CI / still running"* from
   `iteration.status` and marks it *"already stored, no new field"*. Reading the union
   rather than the sentence: `IterationStatus` has eleven members
   (`src/store/records.ts:72-94`). Three of them are terminal (`TERMINAL_STATUSES`,
   103) and are not a wait at all — a closed item belongs to `D-0032` rule 11's
   terminal enumeration, which is a different region of the screen. **The partition
   is over the remaining eight, and it is written out in full rather than
   illustrated:**

   - **Waiting on you** — `awaiting_human`, `withdrawal_requested`, `stalled`: the
     two suspended statuses (`SUSPENDED_STATUSES`, 129) plus the one that means *a
     person must decide and there is no gate*.
   - **In flight** — `planned`, `classified`, `admitting`, `admitted`, `performing`.

   **Both lists are exhaustive on purpose, and `planned` and `classified` are the
   reason it is said that way.** They are durable rows, not moments in a function:
   an iteration is `planned` once reserved with nothing sent, and `classified` once
   cadenza has answered, and a crash leaves either of them standing. An inbox built
   from two illustrative lists would silently drop exactly those rows — live
   iterations, omitted at the moment the operator came back to find out what is
   live. The implementation takes its totality the way this repository already takes
   it elsewhere: `RELEASED_BY` (`records.ts:172`) is a `Record<NonTerminalStatus,
   ...>`, so a status added to the union and forgotten here is a type error rather
   than a missing inbox row.

   **No member means "waiting on CI"**, and the reason is structural rather than an
   omission: CI runs inside `lap perform`, which is continuo's, and from rondo's side
   the whole of it is the single word `performing` — which `records.ts:81` describes
   as *"the one step that takes minutes"*.

   So the wait is **two-way, over the eight non-terminal statuses**, and it is drawn
   from a column that exists.

   **The third distinction is refused rather than deferred.** Obtaining it means
   rondo reading continuo's view of a run's CI state, which is a widening of what the
   advisory and its surface may read (`D-0022` rule 3) and a new external dependency
   for a distinction the operator can already act on: what the inbox is for is knowing
   what is *waiting on them*, and everything else is one bucket they cannot act on
   either way. A distinction that changes nothing the operator does is not worth an
   arrow to another system.

   **This corrects `D-0032`'s paper-screen row, and corrects nothing else in it.**
   Under `AGENTS.md` section 3 that is an annotation to `D-0032` rather than a
   supersession: the row named a source and over-described what the source
   distinguishes; every rule of `D-0032` stands as written, including rule 9 and rule
   11, which is where the row's real content was.

### What this does not do

- **It does not write the conversation schema.** Rule 3 fixes three properties and
  says which; the rest is named as undecided rather than left to be discovered.
- **It does not build the inbox.** No render, no query composition, no verb. The
  four tasks below are what it leaves.
- **It does not choose a display technology.** #41 asks for none in any of its five
  requirements, and the question is already answered elsewhere for lap 1: `D-0025`
  makes the operating surface a command line, and `D-0020` rule 1 makes the gate
  panes the first thing built with layout B as the endpoint, LAN-first and behind
  an OIDC subject. #41 does not reopen either, so this entry has no opinion to add
  and adding one would settle a decision inside a diff scoped to something else.
- **It does not add a record kind, a voice, or an authority.** `D-0032` rule 5 and
  `D-0034` stand exactly.
- **It does not decide when to interrupt the operator or what may be batched.**
  `D-0032` refuses this as a policy with no owner and `D-0033` agrees — batching is
  presentation, and until the operator writes a withholding rule the default is
  that nothing is withheld. Rule 1 above changes what a presentation *counts as*
  and not what may be withheld.
- **It does not touch `src/` or `DECISIONS.md`.**

### The implementation this leaves, in order

Named rather than done, and listed so the gate can see the size of what it is
approving. Each is its own task.

1. **The conversation table and its writer**, carrying rule 3's three properties
   and nothing beyond them.
2. **The `elevate` act**: the verb, the two columns written together (`D-0032` rule
   7's `CHECK` already refuses one without the other), and rule 4's writer refusal
   with its planted case.
3. **The inbox itself**: the two-way wait of rule 5, the render composing what
   `D-0032` rule 3 refuses to store, and rule 9's ordering — sample the bound,
   query with it as the upper limit, write it after.
4. **The `presented` writer under rule 1**: the partial unique index, the conflict
   taken as a no-op, and `explain`'s existing `presentedUncounted` arm left meaning
   what it means today.

### Residuals, with who decides

| Residual | Why not here | Who decides |
|---|---|---|
| The rest of the conversation schema (body type, authorship, ordering, retention) | Nothing composes a message yet; rule 3 fixes what elevation reaches and no more | the task that first writes a message |
| How often a subject was presented | Rule 1's stated ceiling; no question in #41 needs it | the entry that has such a question |
| A withholding rule for the inbox | `D-0032` and `D-0033` both refuse a policy with no owner; the default is that nothing is withheld | the operator, by writing one |
| Whether a look is per-surface rather than per-actor | `D-0032`'s residual, unchanged: one operator, one allowlist of size one | a second concurrent surface |
| CI state as a distinct wait | Rule 5: it costs a widening of `D-0022` rule 3 for a distinction the operator cannot act on | an operator who can act on it |

### What was measured, and how

At rondo `5bfb18f` on **2026-09-11**, by reading rather than by running. This entry
measures documents, schema and the writers already in `src/`; it measures no
behaviour, and #41's own measurements are of a different organisation on
2026-09-07 and are cited here as requirements rather than re-verified.

**The entry lands on a tree that moved after it was measured**, and the three files every
citation below names — `src/store/sqlite.ts`, `src/store/records.ts` and
`src/access/advisory.ts` — were checked byte-identical between `5bfb18f` and the merge that
brought `D-0033` and `D-0035` in. So the line numbers hold as written rather than as
approximately. They still drift, and a later reader should re-measure the claim rather than
the number.

- **The record as shipped**: `src/store/sqlite.ts` — the `proposal` table and its
  three `CHECK`s (629-655), the elevation pair (649-650) and the `CHECK` keeping them
  null together (654), `operator_view` (760-763) and `operator_attention` with both of
  its `CHECK`s (779-787).
- **The only `presented` writer that exists**: `src/access/advisory.ts:314`,
  counting after it shows, under `PROPOSAL_SUBJECT`; and its comment at 309-313
  recording that the withheld side has no writer yet.
- **The elevation pair is written `null` on purpose**, with `D-0020` rule 5 named
  as the reason: `src/access/advisory.ts:293-296`.
- **No conversation exists anywhere in the store**: the nine `CREATE TABLE`
  statements in `src/store/sqlite.ts` are `iteration`, `admission_refusal`,
  `lap_reading`, `proposal`, `composition`, `human_decision`,
  `decision_consumption`, `operator_view` and `operator_attention`, and none of
  them is one.
- **The status union**: `src/store/records.ts:72-94`, with `TERMINAL_STATUSES` at
  103 and `SUSPENDED_STATUSES` at 129; `performing`'s own comment at 81.
- **Who was named as the decider of the conversation schema**: `D-0032`'s residuals
  table, *"the surface work"*.
- **What was not measured**: no surface exists, so nothing here has been rendered;
  no operator has been shown an inbox; and rule 1's ceiling is stated rather than
  observed, since no subject has been presented twice.

### What would falsify it

- **A question that needs to know how many times a subject was presented.** Rule
  1's stated trigger; its answer is the per-render option, which the rule records
  in full so the trade is visible when it is made.
- **A second `presented` writer that is not idempotent per subject** — a surface
  that must count something rule 1's index treats as the same subject — which means
  `(subject_kind, subject_id)` is not the identity of a presentation.
- **A legitimate elevation whose source is not a message in the conversation** —
  an observation arriving from somewhere the conversation does not cover — which
  reopens rule 3's second property rather than rule 4's refusal.
- **A conversation whose message ids cannot be made durable and immutable**, which
  is `D-0032`'s own stated falsifier for rule 7 and makes the elevation link a
  dangling one by construction rather than by a writer's mistake.
- **The gate answer needing to be readable in the conversation**, which is
  `D-0020` rule 5's constraint failing and not this entry's restatement of it.
- **An operator acting differently on "waiting on CI" than on "still running"** —
  rule 5's own trigger, and the only thing that makes the widening it refuses worth
  its arrow.
- **A twelfth `IterationStatus` member** that is neither terminal nor obviously one
  of rule 5's two buckets, which is the case its exhaustive lists exist to make
  visible rather than to absorb.
- **`explain` or any later verb needing to record a presentation it did not
  perform**, which would make rule 1's invariant — every presented subject has a
  row — false in the writer rather than in the schema.
- **The between-laps component arriving** (#40), which is what turns
  `operator_attention` from a table with one writer into an audit surface, and is
  the first thing that would exercise the withheld side rule 1 does not touch.
- Any measurement above failing to reproduce at `5bfb18f`.

---

## D-0037 — The between-laps composition: a fourth snapshot rather than a fourth component, three claim families rondo can ground, one verb an operator runs, and a breakdown that answers over an interval

**Status:** accepted (2026-09-12, rondo's human gate). Refs rondo#40, rondo#39, rondo#41.

**The draft of this entry has been removed rather than kept**, for `D-0029`'s reason and by
`D-0032`'s precedent. `docs/design/` carried it as
`between-laps-composition-decision-draft.md` so the gate could approve text instead of a promise
of text; once appended here it would be a second copy of an accepted decision with no rule for
which copy wins. Its history, including any review round that corrected it, is in the pull
request that added it. **It leaves no design document behind**, for `D-0032`'s reason:
everything it measures is in `DECISIONS.md`, in the schema and in `src/` already.

`D-0033` placed every duty rondo#40 names on an owner that already exists and said, in its own
words, that it *takes no implementation*: the between-laps work is `D-0022`'s `propose` handed a
snapshot that spans every lap instead of one, and whatever is built first for #40 writes to
`operator_attention`. What it did not do is say what that snapshot **is**, what the resulting
explanation **claims**, or what makes one get composed — three of its own residuals, each named as
*"the surface work"*.

This entry is that surface work's design half, and **it takes only the questions nothing in the
tree answers**, which is `D-0036`'s treatment of the same situation. It adds no authority, no
layer, no table, no record kind and no read allowance.

### What #40 asks that is already answered

Listed rather than re-decided. Nothing in this section adds a rule.

| #40's requirement | Where it is answered | State in the tree |
|---|---|---|
| §1 Coordination across laps — a collision inside one repository, one defect behind two laps, work deliberately not started | `D-0033` rules 1-4 (the material is an `explanation`, composed from a wider snapshot by a function that already exists), rule 3 (the one act rondo can take between laps is admission, and `D-0023`'s bound already owns and counts its refusal), rule 9 (the repository-namespace half is owned by nobody, knowingly) | The owner exists and the composition does not: `gather` is over one row (`src/access/advisory.ts:176`) and `AdvisorySnapshot` holds one iteration (`src/advisory/proposal.ts:198`). **This entry's subject** |
| §2 When to interrupt, and when not to | `D-0033` rule 5 (batching is presentation and needs no rule; only withholding needs one), rule 6 (until an operator writes a suppression rule nothing is withheld, as a decision rather than a silence), rule 7 (an attention policy is data the operator owns, in `HostPolicy`'s shape) | The default is the behaviour: every live row is shown, ambiguity is refused rather than resolved (`src/access/cli.ts:935-983`), and the inbox pages nothing (`src/access/inbox.ts:355-408`) |
| §3 Continuity of the operator's context | `D-0033` rule 8 (the worker half is `session_id` / `session_path` on the row; the operator half is `D-0020` rule 5's conversation with `D-0032` rules 9 and 11), `D-0036` rules 3 and 4 (the conversation fixed as far as elevation reaches, and the writer refusal that keeps the link honest) | Shipped: the mark, `changedSince`, the elevation pair and its refusal, and the inbox that reads all four |
| The hazard — a layer that decides what the operator sees also decides what they do not see, and silence leaves nothing to audit | `D-0032` rule 10 (one append-only table for both dispositions, `rule_name` required on the withheld side), `D-0036` rule 1 (counted once per subject), `D-0033` rule 10 (the first #40 build writes it or does not ship) | The table exists with both `CHECK`s (`src/store/sqlite.ts:815-823`); two `presented` writers exist (`src/access/advisory.ts:472`, `src/access/inbox.ts:390`); **no `withheld` writer exists**, and the breakdown counts over all of time (`src/store/sqlite.ts:2212-2227`). Rule 6 below is the half of this that is not yet answered |
| The scope note — that it be designed rather than assumed, before the roles it replaces stop existing | `D-0033` in full, taken at rondo's gate on 2026-09-11 | Done. This entry implements that design rather than reopening it |

### Decision

1. **A fourth snapshot type, and no fourth component.** The between-laps material is composed by a
   pure function in `src/advisory/`, handed a `HostSnapshot` that carries **every live lap** in the
   element shape `SnapshotIteration` already has, plus the two things a cross-lap claim reads and a
   per-lap snapshot does not carry: the `D-0023` triple on the row (`runId`, `topicBranch`,
   `workspace`) and the plan's `base_branch`.

   **This is `D-0033` rule 4 taken literally rather than re-argued.** `src/advisory/` already holds
   three snapshot types beside `AdvisorySnapshot` — `ContractSnapshot` and `RetrySnapshot` — so a
   fourth is the established shape of "a different question over the same rows", not a new
   mechanism. The gathering stays the composition root's (`D-0022` rule 2), the function stays total
   and pure over what it is handed, and `D-0022` rule 3's read allowance is not widened by a word:
   these are more rows of rondo's own store.

   **The element shape is reused rather than re-declared**, for the reason `gather` already gives
   at `src/access/advisory.ts:176`: two copies of eighteen field names are two places a field can go
   missing from, and a `snapshot` basis is a pointer into the persisted bytes (`D-0032` rule 2), so
   a pointer must resolve the same way on both kinds. A between-laps claim cites
   `/laps/3/iteration/status`, and the thing at the end of that pointer is the same document
   `explain` would have shown for that lap alone.

   **`base_branch` is carried as a field and the plan is still not copied.** `AdvisorySnapshot`
   cites the plan by digest on purpose, and that rule is unchanged; what rule 3a below claims rests
   on the base branch alone, so the base branch is what the snapshot carries. Copying the whole plan
   to ground one claim would be paying for re-derivability nothing reads.

2. **The kind is `explanation`, which means the type system is what forbids the component #40 fears.**
   `D-0033` rule 2 already decided this and this entry only names where it lands: the composed value
   is an `Explanation`, `D-0032` rule 5's writer refusal declines any answer naming it, and the row
   this verb records is a `proposal` row like every other. **No new kind, no new subject kind, no new
   table.** Its presentation is counted under `PROPOSAL_SUBJECT` against the proposal's own id, once
   per subject (`D-0036` rule 1), which is the existing index and the existing no-op-on-conflict
   insert.

3. **Three claim families, each grounded in rows rondo already holds, each mapping to one of #40's
   three measured cases — and each emitted for every snapshot, including when it is empty.**

   The totality is `propose`'s existing discipline and not a new rule: a family that fell silent
   when it found nothing would make *"rondo looked and there is no adjacency"* and *"rondo did not
   look"* the same screen, which is what `UNDETERMINED` exists to prevent one layer down.

   a. **Adjacency** — #40's two branches claiming one decision id and one migration number. The
      claim names live laps that are **open against the same base branch**, with their `D-0023`
      triples, and says nothing whatever about whether they collided.

      **This is `D-0033` rule 9's detection point and it does not close rule 9's gap.** rondo
      de-conflicts only the identifiers it mints; a decision id or a migration number lives *inside
      the work*, and reading that needs a reader across branches nothing in rondo has. What the
      claim gives an operator is the adjacency itself — *these two are open against `main` right
      now* — which is what a person needs to go and look. A claim that said more would be rondo
      asserting an absence it cannot observe, which is the error rule 9 was corrected for once
      already.

   b. **Shared material** — #40's one defect blocking two laps. The claim names findings that appear
      on more than one live lap's independent reading (`D-0029`), each side cited by an `iteration`
      basis.

      **The ceiling, stated rather than discovered.** The match is equality over the finding's text.
      It finds the same sentence written twice and nothing else; two readings that describe one
      defect in different words are invisible to it, and the claim does not pretend otherwise.
      **The alternative refused is similarity scoring**, which would give the drafter a confidence
      to narrate — `Claim` has three fields and no fourth for exactly that reason (`D-0032` rule 1,
      `D-0034`).

   c. **Capacity** — #40's work deliberately not started. The claim names the two bounds
      (`maxOccupying`, `maxLive`), what is occupying and what is live against them, and the
      `admission_refusal` rows the bound wrote.

      **rondo takes no act here, which is `D-0033` rule 3 and not a reduction taken now.** The
      refusal side is already owned and already counted; a person who reads this claim and does not
      run `start` is the other half, and an advisory that could withhold an admission by itself
      would be the advisory deciding.

4. **One verb, run when an operator asks. There is no schedule, no daemon and no second loop.**
   This closes `D-0033`'s *"what triggers a between-laps composition"* residual in the shape that
   entry pointed at: *nothing in rondo runs periodically, and one operator asking is enough*. The
   verb joins the command line `D-0025` makes the lap-1 surface, beside `explain`, `elevate` and
   `inbox`.

   **Its order is `explain`'s, for `explain`'s reason**: gather, compose, record the proposal with
   its snapshot verbatim, render, then count the presentation — so that *presented* is a claim about
   something that has already reached the screen. A composition whose recording failed is a refusal;
   one whose counting failed is `presentedUncounted`, which is the surface saying its own accounting
   is short rather than that nothing was shown.

5. **This verb withholds nothing, and any cap it ever grows is a withholding that names a rule.**
   Every live lap enters the snapshot: no cap, no paging, no *"top ten"*. `D-0033` rule 6 makes
   "withhold nothing" the default until an operator writes a policy, and this rule places the
   consequence where it would otherwise be lost: **if a host-wide snapshot ever has to be bounded
   for size, the bound is a withholding** — it writes `withheld` rows under the operator's named
   rule (`D-0032` rule 10, `D-0033` rule 7) and is not an implementation detail chosen inside a
   diff. `D-0033`'s affordability residual says the implementation is the first thing that can
   measure a snapshot; this says what the measurement is allowed to do about it.

6. **The breakdown answers over an interval, because #40's falsifier is over an interval, and it is
   a `WHERE` clause rather than a column.** #40 asks that an operator be able to reconstruct what
   was withheld from them **in a given interval**; `operator_attention` already carries `at_ms` on
   every row and is append-only, so the material is there and only the query is missing — today's
   reader groups over all of time (`src/store/sqlite.ts:2212`). The enumeration takes an interval,
   and the inbox asks it with the operator's own mark (`D-0032` rule 9) so that its accounting
   section answers *since you last looked* beside the total.

   **Refused: a second table, and a stored count.** Both are a second home for a fact the rows
   already hold, which is `D-0022` rule 8 and `D-0032` rule 4's own argument. **What this cannot
   prove is unchanged and is `D-0032` rule 10's own residue**: a suppression that writes no row is
   invisible here, so the interval bounds the *accountable* silence and not the total.

7. **Nothing is widened.** No layer, no arrow, no external dependency, no new `ALLOWED_*` entry, no
   authority that ends anywhere other than a human. `src/advisory/`'s allowance stays
   `["src/advisory", "src/store"]` and its external table stays absent.

### The options, and why the others were refused

| Option | Outcome |
|---|---|
| **A. A between-laps composition on a schedule — a daemon that watches every lap and composes when it decides something is worth saying** | **Refused.** Deciding *when* a person is interrupted is the authority `D-0033` option A refused, arriving through a timer instead of through a component. Nothing in rondo runs periodically, and an operator asking costs nothing |
| **B. A host-wide snapshot as a fourth snapshot type over the existing element shape** | **Taken** (rule 1). More rows in an argument to a function that exists, with every pointer resolving the same way on both kinds |
| **C. Loop `explain` over every live lap in the surface and let the operator read across** | **Refused.** Every claim #40 asks for is a *relation between* rows — same base, same finding, against one bound — and a snapshot holding one side of a pair cannot ground a basis for it. The result would be a screen the operator has to do the comparison on, which is the function #40 measured as unowned |
| **D. Read inside the work — branches, migration directories, decision files — and report real collisions** | **Refused.** It needs a reader across branches nothing in rondo has and a reach `D-0022` rule 3 does not grant, and `D-0033` rule 9 already assigns that to a later entry. Rule 3a takes the part that is answerable from rows rondo owns and says out loud that it is the smaller claim |
| **E. A `between_laps` record kind, or a table of composed cross-lap findings** | **Refused.** The proposal row already holds the payload and the verbatim snapshot beside it, so a second record would be the speculative table `D-0022` rule 20's build order exists to prevent — and a stored framing can drift from the material it was drawn from (`D-0032` rule 3) |
| **F. Interval accounting as a new table or a periodic rollup** | **Refused** (rule 6). The rows carry `at_ms` and are never deleted; what was missing was a bound on a query |

### What this does not do

- **It does not build anything.** No file under `src/` changes on this entry; the implementation
  list below is what it leaves.
- **It does not close `D-0033` rule 9's gap.** Rule 3a is the detection point that entry named, at
  the strength the rows support and no more. Two laps open against one base is an adjacency; a
  collision inside the work is still unobserved and still borne by the operator.
- **It does not write the attention policy** (`D-0033` rule 7). Rule 5 says what a future bound
  would owe that policy; it writes no rule, and the withheld side stays empty.
- **It does not decide what may be batched.** Batching is presentation (`D-0033` rule 5), and a
  batched item is still a `presented` row.
- **It does not add a display technology or reopen the surface's shape.** `D-0025` makes lap 1's
  surface a command line and #40 asks for no screen.
- **It does not widen `D-0022` rule 3, add an arrow, or add an external dependency.**

### The implementation this leaves, in order

Named rather than done, so the gate can see the size of what it is approving.

1. **The host snapshot and its pure composer** — `HostSnapshot` beside the three snapshot types that
   exist, and the function over it, with rule 3's three families and their totality.
2. **The gathering in the composition root** — every live lap, its readings, the bounds and the
   admission refusals, copied field by field into the snapshot shape.
3. **The verb** — rule 4's order, the proposal recorded with its snapshot verbatim, the presentation
   counted once per subject.
4. **The interval on the breakdown, with #40's falsifier as its test** — the enumeration takes an
   interval, the inbox asks it with the mark, and the case that has to pass is #40's own: given
   rows written inside and outside an interval, an operator can reconstruct **what was withheld from
   them in that interval**, by rule and by count. Until a `withheld` writer exists the planted case
   writes those rows directly, which is `D-0032` rule 5's precedent — a refusal proved by a planted
   case rather than asserted.

### Residuals, with who decides

| Residual | Why not here | Who decides |
|---|---|---|
| Cross-lap collisions inside a repository's namespace | `D-0033` rule 9, unchanged: closing it needs a reader across branches nothing in rondo has. Rule 3a detects adjacency and not collision | a later entry, once something can read two laps' material together |
| The attention policy artefact | `D-0033` rule 7's residual, unchanged; rule 5 only says what a bound would owe it | the surface work, or the first operator who asks for a suppression |
| Whether a host-wide snapshot stays affordable | Rule 5 makes the consequence of "it does not" a withholding rather than a quiet trim; the size itself is still unmeasured | the implementation, which is the first thing that can measure it |
| Similarity rather than equality in rule 3b | Its ceiling is stated; nothing has yet missed a defect because of it | an operator who reports a shared cause the claim did not name |
| Whether a between-laps composition is useful at all | No operator has ever been offered one | the first operator who runs the verb |

### What was measured, and how

At rondo `6a6f706` on **2026-09-12**, by reading rather than by running. #40's own measurements are
of a **different organisation** on 2026-09-07 and are cited as requirements rather than re-verified,
which is `D-0032`'s and `D-0033`'s treatment of the same material.

- **The composition is over one row today**: `gather(record, readings)` and `snapshotIteration`
  (`src/access/advisory.ts:145-186`), `AdvisorySnapshot` (`src/advisory/proposal.ts:198-201`), and
  `propose` reading `snapshot.iteration` throughout (`:416-498`).
- **Three snapshot types already sit beside it**: `ContractSnapshot` (`src/advisory/proposal.ts:539`)
  and `RetrySnapshot` (`:321`), each with its own composer.
- **What a cross-lap claim would need and the per-lap snapshot does not carry**: the `D-0023` triple
  (`runId`, `topicBranch`, `workspace`) on the record (`src/store/records.ts:275-277`) and the base
  branch, which lives inside the plan (`src/refrain/plan.ts:112`, persisted verbatim at
  `src/store/records.ts:245`).
- **The rows the three families read**: live iterations (`IterationStore.readLive`), readings per
  iteration (`readingsFor`), the two bounds (`src/refrain/policy.ts:79-105`) and the
  `admission_refusal` table (`src/store/sqlite.ts:544`, written at `:1186`).
- **The attention table and its readers**: both `CHECK`s (`src/store/sqlite.ts:815-823`), the two
  `presented` writers (`src/access/advisory.ts:472`, `src/access/inbox.ts:390`), and
  `attentionBreakdown`, which is a `GROUP BY` with **no `WHERE`** (`src/store/sqlite.ts:2212-2227`)
  rendered by `silenceLines` (`src/access/inbox.ts:274-288`).
- **What was not measured**: no snapshot has been gathered or sized; no between-laps proposal has
  ever been composed or shown; no `withheld` row has ever been written by anything, so rule 6's
  interval is argued from #40's falsifier and from the column rather than from a breakdown anyone
  has read.

### What would falsify it

- **A between-laps output somebody has to approve**, which is `D-0033` rule 2's own falsifier
  arriving through this entry: the kind would need authority and therefore a gate.
- **An adjacency claim an operator acts on as though it were a collision** — rule 3a's language
  failing at the screen rather than at the type, which is the risk of reporting a weaker fact in the
  place a stronger one is wanted.
- **A shared cause the operator found that rule 3b's equality did not name**, which moves its
  ceiling and is the only thing that makes similarity worth its confidence field.
- **A host-wide snapshot that cannot be gathered affordably**, which turns rule 1 from "a wider
  argument" into a component with a read strategy, and sends rule 5 to the operator for a policy.
- **An operator who wants the composition without asking for it** — a standing request, a schedule,
  a notification — which is rule 4's trigger and option A's argument arriving on evidence.
- **A withholding that writes no row**, which is `D-0032` rule 10's stated residue and bounds what
  rule 6 can prove.
- **An interval breakdown that cannot answer #40's question at the granularity an operator asks it**
  — per-rule counts turning out to be the wrong unit — which moves rule 6 rather than the table.
- Any measurement above failing to reproduce at `6a6f706`.

---

## D-0038 — Whether the premise under a proposal has moved, decided per basis and at render time: the record and not the field as the unit, re-gathered rather than remembered, and `undetermined` as a value the screen may never round to unchanged

**Status:** accepted (2026-09-12, rondo's human gate). Refs rondo#39.

**The draft of this entry has been removed rather than kept**, for `D-0029`'s reason and by
`D-0032`'s, `D-0036`'s and `D-0037`'s precedent: `docs/design/` carried it as
`premise-freshness-decision-draft.md` so the gate could approve text instead of a promise of text,
and once appended here it would be a second copy of an accepted decision with no rule for which
copy wins. Its history, including the adversarial review round that moved the comparison's unit
from the field to the record, is in the pull request that added it. **It leaves no design document
behind**: everything it measures is in `DECISIONS.md` and in `src/` already.

rondo#39 states four requirements on what a gate must show. Requirements 1, 2 and 4 — the
answerable shape, the basis that travels with every claim, and what answering forecloses — are
decided by `D-0032` rules 1, 2 and 4 with `D-0034`, and read back and rendered by #66. **The third
is *"it shows what changed since the operator last looked"*, and it is shipped at the wrong unit.**
`D-0032` rules 9 and 11 answer it for the *inbox*: a durable mark and one ordered read across the
record kinds, so an operator returning after an interval sees what the store did meanwhile (#64).
#66's own Known limitations say what that leaves:

> **#39's third requirement is answered at the inbox and not per proposal.** *"What changed since
> the operator last looked"* ships as `operator_view` and `changedSince` (`D-0032` rules 9 and 11,
> #64). A per-proposal form of it — whether the material a proposal rests on has moved since it was
> composed, which is the stale-premise case #39 measures — is **deliberately not in this diff**: it
> is a screen element no decided rule names, so it is left for the gate rather than settled inside
> an implementation diff scoped to something else (`AGENTS.md` section 7).

This entry decides that screen element, and nothing else.

**The unit is the whole argument.** One of #39's three measured framings from 2026-09-07 is premise
movement: a candidate proposed as the next work that had **already been finished and merged**. (The
other two — a corruption that existed only in the summary's own prose, an instruction contradicting
a repository's convention — are the summariser hazards `D-0032` rules 2 and 3 already answer, and
nothing here would catch them.) An inbox reporting *twelve things changed since you last looked*
does not tell an operator that **this** recommendation rests on something that is no longer there,
and the person answering the gate is looking at the proposal, not at the count.

**What it closes and what it leaves.** It closes requirement 3 for citations into material rondo
itself read at composition — which is every basis rondo's own drafters emit. Citations into
material rondo never read reach a proposal only when an operator types one at `elevate`, and for
those this entry delivers a word and a locator rather than a check; that half stays in the residuals
below.

It adds no table, no column, no record kind, no authority, no layer and no read allowance.

### What #39's requirement 3 asks that is already answered

Listed rather than re-decided. Nothing in this section adds a rule.

| What it asks | Where it is answered | State in the tree |
|---|---|---|
| What the store did since the operator last looked | `D-0032` rule 9 (`operator_view`, the bound sampled *before* the read) and rule 11 (`changedSince(t)`, inclusive of `t`) | Shipped, and read by the inbox (#64) |
| That the material under a claim be close enough to read without opening anything | `D-0032` rule 2, on `D-0022` rule 4's verbatim snapshot | Shipped: `basisLine` renders a `snapshot` basis inline with the value beside the pointer (`src/access/advisory.ts:254-273`) |
| That the row being answered is the row that was composed | `D-0022` rule 4, re-derived rather than re-read at every read (#66) | Shipped: `verbatim()` refuses a payload or a snapshot whose bytes no longer digest to the value stored beside them (`src/store/sqlite.ts:2756-2777`) |
| That a citation which leads nowhere says so | `D-0032` rule 2's closure, taken on the reading side | Shipped: `cited()` is total and answers `does not resolve` (`src/access/advisory.ts:230-251`) |

**What none of them answers** is the one question this entry takes: *the material this proposal
cites was true when it was composed — is it still true now?* Every mechanism above is about the
row's own integrity or about the store's activity. A proposal whose snapshot is byte-perfect, whose
digests both re-derive, and whose every pointer resolves cleanly can still be recommending work
that was finished an hour ago.

### Decision

1. **The unit is the basis, and a basis rests on a record rather than on a field.** Every option and
   every claim already carries a basis (`D-0032` rule 2), so freshness is decided **per basis** and
   rendered on the basis line that is already under each one. What is compared is **the record the
   pointer sits in, not the pointer's own field**: for a pointer into an array of records it is that
   element, for a pointer into a top-level record it is that record.

   **The field alone is not the premise, and taking it as the unit would have produced a screen that
   is wrong in exactly #39's case.** Every option of every approvable proposal rondo composes cites
   `/candidates/N/contractDigest` (`src/advisory/proposal.ts:575`, `:706`), and that digest is a
   function of the plan, the agent-type input, the project and the parties (`issueFor`,
   `src/access/advisory.ts:594-611`). A candidate that has since been **finished and merged** leaves
   that digest byte-identical: the movement is carried by the sibling field `status`, which the
   snapshot stores (`src/access/advisory.ts:744-750`) and which no basis points at. Comparing the
   field would have told the operator the premise held, in the one case the entry exists for.
   Comparing the candidate — `iterationId`, `status`, `planDigest`, `contractDigest` together — says
   what actually happened, and the line prints **which field differs**, so *"status: `performing` ->
   `succeeded`"* is what the operator reads rather than the word `moved`.

   **The proposal's header line is the three-way count of rule 4's values and never a single word** —
   `4 unmoved, 1 moved, 0 undetermined` — including when nothing moved. A per-proposal verdict is
   refused for `D-0032` rule 3's reason: collapsing five bases into *"this proposal is stale"* is a
   composed framing that outlives the material it was drawn from, and an operator reading it cannot
   tell whether the recommendation moved or one alternative's citation did, which are opposite
   instructions. The finer unit costs nothing — the line is already being printed — and it is the
   only unit on which the operator's next act differs.

   **The subject's own iteration record is compared as well, and it is not a basis.** Every snapshot
   shape carries `/iteration` — the eighteen fields `snapshotIteration` copied of the row the
   proposal is *about* — and on two of the three kinds no option points at it: a
   `ContractSnapshot` candidate carries `from`, `agentTypeId`, `agentTypeDigest`, `granted`,
   `askable` and `contractDigest` and **no status**, so a subject that finished while its plan and
   the pin stood still would leave every cited candidate equal and every basis `unmoved`. The
   premise of *"run this again under a different agent type"* is that there is something to run
   again, and that fact lives in the subject's row rather than in any candidate. So the subject is
   compared once per proposal and reported on the header line beside the three-way count — as the
   subject and not as a basis, because no basis rests on it and inventing one would put a citation
   in the payload that the drafter never wrote.

2. **Freshness is decided by re-gathering and comparing values, never by comparing timestamps.** The
   left-hand side is the snapshot the row stores verbatim (`D-0022` rule 4) — the record of what the
   advisory read at composition. The right-hand side is what **the same gatherer produces now**,
   compared record by record as rule 1 says, by **deep equality over the untruncated values**.
   `cited()` stays what it is, a renderer: its 200-character ceiling and its `does not resolve`
   sentinel (`src/access/advisory.ts:230-251`) are right for a line and wrong for a comparator, and
   two long values agreeing on their first 200 characters are not the same value.

   **Records in an array are matched by their own identity and never by index.** The pointers are
   positional (`/candidates/${index}/...`), but the candidate set is enumerated and de-duplicated by
   the gatherer (`lineage`, `promotionsOf`, and the dedup in `draftContracts`), so candidate N today
   need not be candidate N at composition. Identity is `iterationId` on a `RetrySnapshot` candidate
   and `from` on a `ContractSnapshot` candidate — which is why `CandidateSource` being a closed union
   is load-bearing here as well as where it was written.

   **The re-gather reuses what the row records, and does not re-run composition's preconditions.**
   It takes the successor identity out of the stored snapshot (`/successor/iterationId`), because
   every candidate digest is a function of it, and it runs **below** `propose`'s freeness check
   (`src/access/advisory.ts:985-994`): that check refuses a successor id already present in the
   store, which is correct when composing a retry and would refuse every proposal whose retry was
   actually admitted — which is to say, exactly the proposals whose premise has most obviously moved.

   **The timestamp alternative is refused on two grounds, and the second is the load-bearing one.**
   Comparing `proposal.created_at_ms` against `changedSince` inherits `D-0032` rule 9's named ceiling
   exactly — these are caller clocks sampled before `BEGIN IMMEDIATE`, so a row can land behind a
   mark taken before it — and it would inherit it at the screen where #39 says the loss matters most.
   But worse, it answers a **different question**: *a row touching this iteration was written* is not
   *the material this option cites now reads differently*. Most writes to a live iteration change
   nothing any basis rests on, so the timestamp form reports movement constantly and
   correctly-by-its-own-definition, and an operator learns within a day to skip the line. **A mark
   that cries wolf is worse than no mark**, because it consumes the same attention #39 exists to
   protect and returns nothing for it.

3. **Re-gather, and never re-draft — and nothing of the re-gathered composition reaches the screen
   except a difference at material the row already holds.** What is re-run is the *gathering*
   (`D-0022` rule 2's duty); what is never re-run is the pure drafter over it (`propose`,
   `proposeRetryPlan`, `proposeAgentType`, `proposeContractKeys`).

   **The line is drawn over what is compared, because it cannot be drawn over what is called.** The
   gatherers decide how many candidates there are, in what order, and which are de-duplicated away
   (`agentTypesOf`, `promotionsOf`, `draftContracts`), so a re-gather does reconstruct a set that
   exists in no record. The rule is therefore that only identities the **stored** document holds are
   looked up in the re-gathered one: an extra candidate, a different order, a different
   recommendation and every label are read by nothing and reach no screen.

   **This is what keeps the check out of the hands of the thing under suspicion.** #39's hazard is
   the summariser framing the decision; a screen that re-drafted and diffed the option sets would be
   asking the drafter whether the drafter is still right, and would put an option set carrying no
   digest beside one that does.

4. **Three values — `unmoved`, `moved`, `undetermined` — and which basis forms can take the first
   two is fixed here rather than left to the implementation.** The precedent for the third is in the
   tree twice: `D-0029` rule 10's `unavailable` is a verdict rather than a missing row, and
   `D-0032` rule 8's `undetermined` is a value a claim may take rather than an empty field. An
   absence and a negative answer must not be the same thing at the only point where either matters.

   - **`snapshot` — decided.** The row holds the left-hand side by construction.
   - **`iteration` — decided when it names the snapshot's own iteration**, which is what rondo's
     drafter emits (`src/advisory/proposal.ts:444`, the `gate` claim on any iteration that reached
     one): the eighteen fields `snapshotIteration` copied are the left-hand side and the row is
     re-readable. An `iteration` basis naming **another** iteration is `undetermined` — nothing
     recorded that row's state at composition, so there is nothing to compare a re-read against.
   - **`gateTransition` — `undetermined`**, because the gate-transition reader is `D-0022`'s own
     named residual; this is a reader rondo does not have, not a widening it declines.
   - **`continuoRun` — `undetermined`**, because nothing recorded what the run said at composition:
     there is no stored left-hand side, and the arrow that exists would answer a question the row
     cannot be compared against.
   - **`repository` — `undetermined`**, and this one is under-specified rather than merely
     unreachable: the basis pins a `commit`, so re-reading it *at its own commit* is `unmoved` by
     construction, and deciding it means reading at some **other** ref, which is a policy nothing in
     rondo owns (`D-0033` rule 9, `D-0037`'s residual).

   The mapping is a `Record` over `Basis["form"]`, for `RELEASED_BY`'s reason
   (`src/store/records.ts:172`): a sixth form added to the union and forgotten here is a type error,
   not a screen that quietly says a premise held.

   **The screen may never round `undetermined` to unchanged.** The header is always the three-way
   count and the subject's own verdict, so a proposal every one of whose bases is `undetermined` says
   so in the same words it would use to say nothing moved — which are different words. This is the rule the entry exists for: an
   `undetermined` that is on the screen, per basis, next to the locator, tells the operator which
   citation they personally have to go and open. Saying nothing, or saying `unmoved` because nothing
   contradicted it, converts *rondo did not look* into *rondo looked and it is fine*, at the moment a
   person is about to spend an irreversible answer.

   **What the three forms above cost, said plainly.** In rondo today they reach a proposal only as a
   basis an operator typed at `elevate` (`parseBasis`, `src/access/cli.ts:1311-1358`, feeding
   `proposeElevated`). Every basis rondo's own drafters compose is `snapshot` or the decidable
   `iteration` form, so the decisive half covers the proposals rondo composes, and the
   `undetermined` half is exactly the material an operator brought in from outside and is best placed
   to check.

5. **Four edges are decided here, because each has a plausible wrong answer and each is the
   stale-premise case in its most concrete form.**

   - **An identity in the stored document that is absent from the re-gathered one is `moved`** — a
     candidate that left the set, a reading that is no longer produced. This is what "the material
     this option names is gone" actually looks like, and it is the strongest signal rondo can
     observe; filing it under `undetermined` would put the clearest answer available under the value
     that means *rondo could not look*.
   - **A pointer that does not resolve in the stored document is `undetermined`, never `unmoved`.**
     A citation that was already broken at composition is `D-0032` rule 2's failure and not evidence
     about movement; there is no left-hand side to compare.
   - **A gathering that refuses is `undetermined` for every basis on that proposal, with the
     gatherer's own reason printed.** The refusals are real and named: a lineage row that will not
     read, a plan that will not decode, cadenza refusing to issue. They happen before any candidate
     exists, so the refusal is whole-snapshot rather than per basis — and a screen that printed only
     *undetermined* there would be hiding the most informative sentence rondo had.
   - **A re-gather taken under a different cadenza pin than the row records is movement, and it is
     said once as the pin.** Two of the three snapshots are built by issuing contracts through the
     pinned cadenza (`draftRunPlan`, `draftContracts` via `issueFor`), and the proposal row already
     records `cadenza_revision` for `D-0022` rule 18's reason. After a pin move every candidate
     digest differs, and that **is** a moved premise — the contract an approval would bind is not
     the one that was composed — so the screen states the pin difference as one line above the
     options rather than reporting each option as though it had moved on its own.

6. **Computed at render and stored nowhere.** No column, no table, no writer, no periodic
   re-checker.

   **`D-0032` rule 3 and rule 4 are the precedent, and they do not conflict with rule 9.** Rules 3
   and 4 refuse to store a rendered summary and a stored consequence because both are framings that
   outlive the material they were drawn from; rule 9 stores `operator_view` because *where a person's
   reading stopped* is derivable from nothing. Freshness is on rule 3's side of that line twice over:
   it is derivable from rows that exist, and **a stored freshness mark is stale by construction the
   moment after it is written** — rule 3's drifting summary, compressed into one word, about the one
   property whose whole point is that it changes underneath. `D-0036` rule 2 is the same argument
   already applied once: *how long it sat unanswered* gets no column because it is a subtraction over
   rows that already exist.

   **The right-hand value is material and not a framing**, which is what separates rule 1's
   difference line from option G below: it is re-read through the same gatherer, is never persisted,
   digests to nothing, and is labelled on the screen as today's reading rather than as part of the
   proposal. Printing both values is free — both documents are in hand — and it is the anti-summary
   move: the operator judges the movement from the material rather than from rondo's word for it.

   **The consequence is accepted rather than hidden**: the answer is a function of the record *and*
   of now, so two renders of one proposal may differ, and rondo says *that* the material moved rather
   than *when*.

   **`D-0022` rule 20's build order is why there is no record here**: the rows this reads all exist,
   and a table for a judgement that is worthless the instant after it is stored is the speculative
   record that order exists to prevent.

   **This annotates `D-0032` rule 9 and corrects nothing in it.** Rule 9's words are *"uses that same
   bound as the upper limit of every query in the render"*. That scope is the queries answering
   *what changed since the mark*. A freshness re-gather is deliberately **unbounded**, reads past the
   mark by design, and may therefore show material the mark's own queries omit — so a `moved` verdict
   is not evidence that the row is inside the operator's changed-since set, and the two are not to be
   reconciled. Under `AGENTS.md` section 3 this is an annotation rather than a supersession: rule 9's
   shape, its ceiling and its upgrade path all stand exactly as written.

**Three questions are kept apart, and none of them replaces another.** They are adjacent enough that
a later change could collapse two of them innocently, so they are written out: *was this row
tampered with or corrupted* is `D-0022` rule 4's digests re-derived at every read (#66), answered by
refusing to render at all; *has the premise under this proposal moved* is this entry, answered by
rendering with a verdict per basis; *what has the store done since the operator last looked* is
`D-0032` rules 9 and 11 at the inbox (#64), answered over subjects rather than over premises. The
second is the only one that can be true while the other two are clean, which is why #66 could ship
the first and third and leave a gate answerable on a dead premise.

### The options, and why the others were refused

| Option | Outcome |
|---|---|
| **A. Per-basis re-gather and compare at render, record-wise, three-valued** | **Taken** (rules 1-6). One mechanism, no storage, no clock, and the comparison is over the material rather than over the drafter's word for it |
| **B. Compare `proposal.created_at_ms` against `changedSince(t)`** | **Refused** (rule 2). Inherits `D-0032` rule 9's sample-to-commit ceiling at the screen where losing a row matters most, and answers *a row was written* rather than *the cited material differs* — so it reports movement constantly and teaches the operator to skip the line |
| **C. A `premise_digest` column written at composition and re-checked later** | **Refused.** `D-0022` rule 4's verbatim snapshot already **is** the stored left-hand side, so a second digest is a second home for a fact (`D-0022` rule 8) that adds nothing to compare against — and it answers *something moved* without answering *what*, which rule 1 needs. **This is not `D-0029` rule 10 being contradicted**: that rule stores a digest for staleness because its material lives outside rondo's store — a git branch, with no verbatim copy — so a recorded digest is the only left-hand side it can have |
| **D. A background re-checker that marks proposals stale** | **Refused.** Nothing in rondo runs periodically and one operator asking is enough (`D-0037` rule 4), and the mark it writes is rule 6's mark that is stale the moment after it is written |
| **E. Withhold or hide a proposal whose premise moved** | **Refused.** A withholding needs a named rule and an owner (`D-0032` rule 10, `D-0036` residual, `D-0033` rule 6), and hiding the stale item removes from the screen the exact thing #39 says the operator must see. A moved premise is information for the decision, not a reason to take the decision away |
| **F. Read the repository and continuo, and decide the three remaining forms** | **Refused today** (rule 4), and under-specified rather than merely expensive: a `repository` basis pins its own commit, so deciding it requires an entry to name **which ref** it is compared against, and `D-0033` rule 9 with `D-0037`'s residual already own the reader that would do it. `gateTransition` needs `D-0022`'s own named residual; `continuoRun` has no stored left-hand side to compare to at all |
| **G. Re-draft the proposal and diff the option sets** | **Refused** (rule 3). It asks the drafter whether the drafter is still right, and puts an option set carrying no digest on the screen beside one that does |
| **H. Do nothing per proposal; the inbox's `changedSince` is enough** | **Refused** (rule 1) for proposals rondo composes over its own rows, which is where #39's measured case lands: the inbox answers over subjects in an interval, and the operator answering a gate is reading one proposal. For an operator-elevated observation citing material rondo never read, H is what remains, and rule 4 says so in the only way that helps — by naming which citation the operator has to open |

### What this does not do

- **It does not build anything.** No file under `src/` changes on this entry; the implementation
  list below is what it leaves.
- **It does not widen `D-0022` rule 3**, grant an arrow, add an external dependency or touch
  `src/advisory/`'s allowance. Re-gathering an explanation re-reads rondo's own rows; re-gathering a
  retry or contract snapshot additionally issues contracts through the **pinned cadenza**, which is
  the allowance the composition root already has and the same call it already makes.
- **It does not add a table, a column, a record kind, a voice or an authority.** `D-0032` rules 4 and
  5 and `D-0034` stand exactly.
- **It does not change what a proposal is or what it cites.** The `Basis` union is unchanged and
  stays closed at five forms; this entry decides only what can be *said about* each form.
- **It does not decide what may be withheld or batched.** `D-0032`, `D-0033` and `D-0036` all refuse
  a policy with no owner, and option E's refusal above is that refusal applied to the tempting case.
- **It does not reopen or soften the digest refusal of #66**: a row whose digests do not re-derive is
  still refused rather than rendered with a mark.
- **It does not claim the operator read anything.** A rendered verdict is a claim by the surface, the
  same grade as `D-0032` rule 9's *"What this does not claim"*, which is `D-0029` rule 11's third
  clause.

### The implementation this leaves, in order

Named rather than done, so the gate can see the size of what it is approving.

1. **The verdict function in the composition root** — total, over (the stored snapshot document, the
   re-gathered document, one basis), exhaustive over `Basis["form"]` as a `Record`, comparing records
   by identity as rule 1 and rule 2 say. Rule 5's four edges are four of its arms.
2. **The re-gather seam** — the gatherers callable without their drafters. This is a real
   separation and not a tidy-up: `gather` is already one function, but the two proposal snapshots are
   built inside `draftRunPlan` and `draftContracts`, entangled with `admitFor` and `issueFor`, and
   take a successor id that must come from the stored snapshot rather than from a caller.
3. **The render, and the ports it needs.** `showProposal` today takes
   `Pick<ExplainPorts, "record" | "present" | "now">` (`src/access/advisory.ts:1381-1384`) and its
   own comment says the screen is composed *"from the row and nothing else"* (`:1229-1241`) — this
   entry deliberately retires that sentence, and the verb gains the store and the cadenza pin.
   Nothing is reordered: `D-0032` rule 1's order and #66's *"the recommendation is marked where it
   sits"* are untouched.
4. **The planted cases** — `D-0032` rule 5's precedent, a refusal proved rather than asserted: a
   candidate finished and merged underneath a composed proposal, whose `contractDigest` is unchanged
   and which must read `moved`; a candidate removed from the set, and a set re-ordered, so that
   identity matching is proved rather than index matching; a broken pointer in the stored snapshot
   (`undetermined`, not `unmoved`); a gatherer made to refuse (`undetermined`, with the reason on the
   screen); a differing cadenza pin; a proposal all of whose bases are external, whose header must
   say `undetermined` and must not say that nothing moved; and — for an `agent_type` or
   `contract_keys` proposal, whose candidates carry no status — a subject finished underneath it,
   whose every basis reads `unmoved` and whose header must still say the subject moved.

### Residuals, with who decides

| Residual | Why not here | Who decides |
|---|---|---|
| The three undecidable basis forms (`gateTransition`, `continuoRun`, `repository`) | Rule 4: one needs `D-0022`'s own named gate-transition residual, one has no stored left-hand side, and one needs an entry to name the ref it is compared against | the entry that gives rondo that reader and that ref |
| *When* a premise moved, and what moved it | Rule 6: the verdict is a function of now, and the two values on the line are what a person judges from. A history of movements is a record of a derivation | an operator who needs the sequence rather than the fact |
| Whether re-gathering stays affordable at render | `D-0032`'s and `D-0037`'s snapshot-size residual, sharpened: this is a lineage read plus one cadenza contract issuance **per option, per render**, and nothing has measured either | the implementation, which is the first thing that can measure it |
| Whether a per-basis mark is too much on the screen | Rule 1 takes the finer unit because it is the one the operator acts on; no operator has read either | the first operator who reads one |
| A gatherer refusal turning out to be how *"already settled elsewhere"* usually presents | Rule 5 files it under `undetermined` with the reason printed; if it is the common case it is its own value | the entry that has counted them |

### What was measured, and how

At rondo `0e9d4f4` on **2026-09-12**, by reading rather than by running — **this entry measures
documents, schema and the writers already in `src/`, and no behaviour**. #39's measurements are of a
**different organisation** on 2026-09-07 and are cited as requirements rather than re-verified, which
is `D-0032`'s, `D-0036`'s and `D-0037`'s treatment of the same material.

- **The basis union is closed at five forms**, one of which renders inline:
  `src/advisory/proposal.ts:47-66`, with `BASIS_FORMS` at `:69-75`.
- **Which forms reach a proposal, and from where.** Every option of `proposeAgentType` (`:596`),
  `proposeContractKeys` (`:627`) and `proposeRetryPlan` (`:695`) carries a `snapshot` basis
  (`:575`, `:706`); every claim `propose` composes (`:416-480`) carries a `snapshot` basis **except**
  the `gate` claim on a gated iteration, which carries an `iteration` basis (`:444`). Nothing under
  `src/` composes a `gateTransition`, `continuoRun` or `repository` basis: their only producer is
  `parseBasis` on an operator-typed `--basis` at `elevate` (`src/access/cli.ts:1311-1358`), feeding
  `proposeElevated` (`src/advisory/proposal.ts:665`).
- **Why the record and not the field is the unit.** `SnapshotCandidate` carries `iterationId`,
  `status`, `planDigest` and `contractDigest` (`src/access/advisory.ts:744-750`); the option basis
  cites only the last of them, and `issueFor` (`:594-611`) makes that digest a function of the plan,
  the agent-type input, the project and the parties — none of which a merge moves.
- **Why the subject is compared and is not a basis.** `SnapshotContractCandidate` carries `from`,
  `agentTypeId`, `agentTypeDigest`, `granted`, `askable` and `contractDigest` and **no status**
  (`src/advisory/proposal.ts:518-528`), so on the two contract kinds no option basis reaches the
  subject's own state at all; `/iteration` is on all three snapshot shapes (`:198`, `:321`, `:539`)
  and is what carries it.
- **The snapshot is the stored record of the premise**, kept verbatim beside its digest and
  re-derived at every read: `verbatim()` at `src/store/sqlite.ts:2756-2777`, reached by
  `readProposal` at `:2244`.
- **`cited()` is a renderer and not a comparator**: the 200-character ceiling and the `does not
  resolve` sentinel, `src/access/advisory.ts:230-251`.
- **The gatherers, their inputs and their cadenza reach**: `snapshotIteration` (`:150`), `gather`
  (`:181`), `draftRunPlan` (`:722-763`) and `draftContracts` (`:865-933`), both of which reach the
  snapshot through `admitFor` and `issueFor` and take a `successorId`; `propose`'s freeness check at
  `:985-994`; and the proposal row's `cadenza_revision` column (`src/store/sqlite.ts:699`).
- **The screen this entry changes**: `showProposal` and its ports (`src/access/advisory.ts:1381`),
  and the doc comment it retires (`:1229-1241`).
- **What ships for the inbox and answers a different question**: `operator_view` and `changedSince`
  (`D-0032` rules 9 and 11), read by `src/access/inbox.ts`.
- **What was not measured**: no proposal has ever been shown after its premise moved; no gathering
  has been timed or sized, and no re-gather has ever been run; no operator has read a freshness mark,
  so rule 4's central claim — that an `undetermined` next to a locator changes what a person does —
  is argued from #39's measurement of another organisation and not from rondo.

### What would falsify it

- **An operator answering a gate where every basis read `unmoved` while the premise had in fact
  moved.** #39's own falsifier at this entry's unit; it falsifies rule 1's choice of record, meaning
  the premise is not carried by the record the pointer sits in either.
- **Two bases on one proposal whose marks differ and whose correct next act is the same** — or an
  operator who reads only the header count and never the per-basis marks — which is rule 1's finer
  unit failing to earn itself.
- **An operator treating `undetermined` as `unmoved`** — reading *rondo could not check this* as
  *this is fine* — which falsifies rule 4's central claim and means the three values need a stronger
  act than a word on a line.
- **A proposal whose premise moved somewhere that is neither a cited record nor the subject's own
  row**, which is rule 1's second comparison being the wrong second comparison rather than one too
  few.
- **A premise movement visible only as a changed option set and not as a changed record** — a
  candidate that should now exist and does not appear — which is what re-drafting would catch and
  rule 3 forbids, and is the price rule 3 is paying.
- **A gatherer that is not a pure function of rows and the pin** — one that takes a clock, an
  unstable ordering, or anything else differing between two gatherings of unchanged material. Every
  basis would read `moved` and the mark becomes noise, and it would fail *quietly*, which is why it
  is named here rather than left to be found.
- **A cadenza pin moving often enough that rule 5's pin line is the usual screen**, which makes the
  entry report movement nobody can act on and sends rule 5's last arm back to the gate.
- **A `does not resolve` in the re-gathered document caused by the gatherer's own shape changing
  rather than by material leaving**, which would make rule 5's strongest signal its wrongest one.
- **A non-`snapshot`, non-`iteration` basis form rondo can decide** — a named ref for `repository`, a
  gate-transition reader, a recorded left-hand side for a run — which reopens rule 4's mapping, and
  neither the union nor the three values.
- **Re-gathering proving unaffordable at render**, which moves rule 6 toward a stored mark and
  obliges whatever stores it to answer rule 3's drift argument rather than to skip it.
- **`D-0022` rule 4 being superseded so the snapshot stops being stored verbatim**, which removes the
  left-hand side of every comparison here and takes the whole entry with it.
- **An operator who wants the check without asking for it** — a standing re-check, a notification —
  which is option D's argument arriving on evidence, and `D-0037` rule 4's trigger as much as this
  entry's.
- Any measurement above failing to reproduce at `0e9d4f4`.

---

## D-0039 — A lap cannot verify what it wrote, and `--allowedTools` is not the way out: `D-0011`'s first falsifier fires, the fence input rondo asks continuo for, and what `granted` maps to once it exists

**Status:** accepted (2026-09-12, rondo's human gate). Refs rondo#67, rondo#69.

rondo#67 observed a lap that edited a repository, committed to it, and could not run
`npm ci --ignore-scripts`, `npm run verify`, `npm --version` or `node vendor/pin.mjs check` — every
one of them answered `This command requires approval` to a `claude -p` child that has nobody to ask.
For a repository whose `AGENTS.md` requires a green verify before a commit, no lap can comply, and
the lap that found this said so at its gate only because its worker chose to.

The issue reads as a rondo defect with a rondo fix: map the agent type's `granted: ["command.run"]`
onto the fence's Bash allow list. **This entry is the finding that there is nothing on the other end
of that map.** At the pinned continuo the worker fence's allow list is a bundled document selected
by role name, and no input of `run admit` or `lap perform` reaches it. So the question the issue
asks — how should `granted` become an allow rule — cannot be answered inside this repository, and
the entry that says what to do instead is this one.

**It is also a decision rondo has already written down the answer to**, which is why this entry is
short on options and long on citation. `D-0011` refused four executor flags permanently, named the
one case that would make the refusal untenable, and said what to do when it arrived.

### What fired

`D-0011`'s first falsifier, verbatim:

> **A run rondo must admit that cannot be expressed without one of the four refused flags.** That is
> the case this entry claims does not exist; if it appears, the right response is an escalation to
> continuo about the fence rather than an entry here, and this entry is what forces that route.

rondo#67 is that case. The only input continuo accepts today that reaches the child's tool
permissions is `run admit --cli-arg` carrying `--allowedTools` — `FENCE_OWNED_FLAGS` does not cover
it, which is the gap `D-0011`'s "Why an empty start" section is about — and `D-0011` rule 3 refuses
that option in every spelling, permanently, with reversal spelled out as a supersession rather than
an entry.

**The refusal is not being reconsidered here.** `D-0011` rule 3 exists so that the human gate stays
binding rather than advisory, and rondo#67 is a bad reason to spend it: the lap does not need
arbitrary executor authority handed past the gate, it needs a fence that can run a build. Those are
different asks, and only the first is what `--allowedTools` grants. The falsifier's own instruction —
escalate to continuo about the fence — is both the narrower route and the one already ratified.

### Decision

1. **rondo does not close rondo#67 from inside rondo, and `D-0011` rule 3 stands unweakened.** No
   entry authorises any spelling of `--allowedTools`, `--disallowedTools`, `--add-dir` or
   `--dangerously-skip-permissions`, and rondo's `--cli-arg` allowlist stays empty (`D-0011`
   rules 1 and 2). The escalation to continuo is the route, and this entry is rondo's half of it.

2. **`granted` is a precondition on the fence, not a source of allow rules.** `command.run` is a
   capability key, and a capability key says *that* commands may be run; an allow rule says *which*.
   Deriving the second from the first would be rondo inventing a command vocabulary that neither
   cadenza nor continuo has — the shape `D-0014` rule 1 forbids for roles and models, applied to a
   third vocabulary. So `granted` keeps the job it has: it is what cadenza classifies
   `intendedAction` against, and it decides whether the lap is admitted at all.

   **What rondo#67 exposes is that the two halves were never checked against each other.** Today a
   plan granting `command.run` is admitted *because* it holds `command.run`, and then renders a
   fence that cannot run a command. The grant and the fence are both real and they disagree,
   silently, and nothing in either repository notices.

3. **The concrete command set is a property of the fence the role names, and rondo's mapping is over
   the pair.** `executorPolicy.roleName` already maps to a continuo role in
   `src/continuo/roles.ts` (`D-0019` rule 13), and a continuo role already *is* a fence document
   entry — `roles.json` is keyed by role and carries `permissions.allow` per role. So the mapping
   rondo#67 asks for is not a new arrow: it is the existing role arrow, pointed at a role whose
   fence can run commands.

   rondo's own half of the check is then statable and total: **a plan that grants `command.run` and
   names a role rondo's table records as having no command allow list is refused before the spawn**,
   in `mapNeutralRole`'s manner and for `mapModelTier`'s reason — an agent type an operator wrote,
   answered with a value rather than a throw, before a worktree exists and before money is spent.
   The table is a transcription of continuo's document at a revision, exactly as `CONTINUO_ROSTER`
   is, with the same falsifiers.

   **Annotated 2026-09-12 by the implementation of rondo#67 (`continuo D-1110` at continuo
   `fcf86eb`).** This rule's **first falsifier fired**: *"a role turning out to be the wrong
   carrier ... which is rule 3's named cost arriving, and moves the fence profile off the role name
   and onto a field of its own"*. continuo answered the escalation by **declining the second-role
   shape this entry recommends**, on three grounds of its own (`continuo D-1110`, first
   alternative), of which the load-bearing one is that **a role is what a worker *is*, not what runs
   it** — the same distinction `continuo D-0099` used to refuse a model key in `roles.json`, so a
   role meaning *"worker, with a build"* would make the `role` column answer two questions. That is
   the cost this rule named and accepted; continuo declined to pay it. What arrived instead is
   `run admit --allow-bash SUBJECT`, repeatable, per run.

   **Consequence, and it is a change of subject rather than a correction.** The pair rondo refuses
   over is now **(the grant, the declaration)** and no longer (the grant, the role): a plan that
   grants `command.run` and declares no subject is refused before the spawn, and so is the mirror
   image — a plan that declares subjects under an agent type that does not grant `command.run`. The
   refusal lives in `classifyPlan` beside `D-0025`'s catalog check, which is the step before
   `admit`, and `executorPolicy.roleName`'s arrow in `src/continuo/roles.ts` is **unchanged and
   still the identity**: there is no command-capable role for it to point at, because continuo chose
   not to grow one. **Nothing in this rule is corrected**: its reasoning, its two properties and the
   place it puts the refusal all stand exactly as written, and rule 4's two requirements are both
   met by the shape that arrived — (a) by `allowed_bash` on the `run_delegation_recorded` payload,
   readable through `run show --json`, and (b) by `permission_denials` on what `lap perform`
   answers with. Rule 5 is untouched: rondo still records `continuo_role` and no column is added.

4. **Two properties are required of whatever shape continuo grows, and they are not the
   implementation's to negotiate.**

   a. **Recorded.** What a lap was allowed to run must be readable from the admitted run's own
      record, not reconstructed from a build's bundled bytes by somebody who knows which revision
      ran. A fence widened by a name that appears on the row satisfies this; a fence widened by an
      environment variable or a build-time default does not.

   b. **Loud.** A command the fence does not allow must reach the lap's report — and therefore the
      gate — rather than existing only inside the worker's prose. rondo#67 was found because a
      worker volunteered it; a worker that did not would have handed the operator an unverified
      commit that reads as finished work. That is the failure mode this property exists to remove,
      and it is required of continuo whichever widening shape it picks.

5. **What rondo records is `continuo_role`, and no column is added.** The iteration row already
   carries it (`src/store/sqlite.ts:538`, written from `AdmitRunOutcome.continuoRole`), and under
   rule 3 that one value names the fence the lap ran under. This is deliberately the whole of
   rondo's "leave it behind" duty: **the consuming side — what a review stage or a gate screen does
   with the fact that a verification did or did not run — is rondo#69's, and this entry does not
   design it.**

6. **Build order: nothing under `src/` moves until continuo grows the input and the pin moves.**
   This is a decision-only entry in `D-0037`'s and `D-0033`'s sense. Rule 3's table row and rule 3's
   refusal are implementable only against a continuo that has a command-capable worker fence to
   name; writing them against a roster that has none would be a refusal that fires on every plan,
   which is the tree in a worse state than it is now.

### What rondo asks continuo for

Stated so that continuo's issue can quote it. rondo is the consumer here and does not decide
continuo's shape; what follows is the requirement, one candidate rondo prefers, and why.

**The requirement.** A lap's worker must be able to run the build and test commands of the
repository it is changing, under a fence that (i) was chosen by the admitted run rather than by the
build's defaults, (ii) names what it allowed in a value that appears on the run's record, (iii)
allows a bounded, curated set rather than commands in general, and (iv) reports a refused command
into the lap's outcome instead of leaving it in the child's transcript.

**The candidate rondo prefers: a second worker-kind role in `src/fencing/roles.json`.** The document
is already keyed by role, already carries `permissions.allow` and `permissions.deny` per role, and
already distinguishes what a role *is* from what it *may do* via `role_kind`. `run admit --role` is
validated against that document's own roster (`roleNames`), so a role added to it is admissible with
no other code change, and the role name is already on continuo's run record and on rondo's iteration
row. Measured against the four requirements: (i) the run names the role; (ii) the role name is the
value on the record; (iii) the allow list is curated in continuo's tree, reviewed as an edit there,
and pinned with the document; (iv) is the one requirement it does not supply on its own.

**Its cost, named rather than buried.** A role would then carry two things at once — what the
executor is for, and which fence it gets — where today it carries one. `D-0014` rule 3 keeps
continuo's roster out of rondo's callers precisely so that a second executor is a change to one
table, and this widens what that table's codomain means. rondo accepts that cost because the
alternative costs more: a per-run declared command vector needs a new document, a new allowlist
check, a new refusal, a new record field and a new place for a widening to be introduced without
review — five new mechanisms to reach a place two existing ones already reach.

**The requirement continuo must meet in either shape is (iv).** A `Bash` call the fence refuses
currently ends as text inside a `claude -p` transcript. rondo asks that it become part of what
`lap perform` answers with, so that a surface reading the lap's outcome can tell an operator "this
lap attempted a command its fence does not allow" without reading the session.

### What this entry does not do

- **It does not re-open `D-0011` rule 3**, in any direction. The four flags stay refused, and this
  entry is an instance of the route rule 3's falsifier prescribes rather than an exception to it.
- **It does not widen `D-0022` rule 3's read allowance**, grant an arrow, add a layer, add a record
  kind or add a column. Rule 5 uses a column that exists.
- **It does not name the commands.** Which specs a verify-capable fence allows is continuo's to
  author and continuo's gate to take; rondo#67's four observed refusals are evidence of the need,
  not a proposed allow list.
- **It does not design the consuming side** of rule 5's record. That is rondo#69.
- **It does not close rondo#67.** The issue is closed by a lap that greens a verify, which needs
  continuo's input and a pin move first.

### Residuals

| Residual | Why not here | Who decides |
|---|---|---|
| The command specs a verify-capable fence allows | continuo authors its own fence document, and a list written here would be rondo authoring it by proposal | continuo's gate |
| How a refused command reaches the lap's outcome (requirement iv) | It is a change to what `lap perform` answers with, which is continuo's protocol and rondo's decoder second | continuo, then a rondo entry if the answer shape moves |
| Rule 3's refusal and its table row | Unimplementable against a roster with no command-capable role; rule 6 is why | the implementation, once the pin has moved |
| Whether a fence profile should be separable from an executor role at all | The cost is named above and paid knowingly; nothing has yet needed two profiles for one purpose or two purposes on one profile | the first agent type that needs the pair to come apart |
| What a surface does with the fact that a lap did or did not verify | rondo#69's scope by the brief that opened both | rondo#69 |

### What was measured, and how

At continuo `38c667b5126fdfdc0465e4a422e88b20a8b53044` — the revision `continuo.pin.json` pins — and
at rondo `ba98cfe`, on **2026-09-12**, by reading rather than by running, and **each rondo-side
citation below was re-read unchanged at `df67e72`** when this entry was rebased onto `D-0038`.
rondo#67's own four refusals were observed by running, on 2026-09-12, at rondo `0e9d4f4` and the
same continuo; they are cited as the observation and were not re-run here.

- **The allow list is six git specs.** `src/fencing/roles.json:28-35`: `Bash(git add:*)`,
  `Bash(git commit:*)`, `Bash(git status:*)`, `Bash(git diff:*)`, `Bash(git log:*)`,
  `Bash(git show:*)`. The issue's description of it is exact.
- **`acceptEdits` cannot cover a Bash call, by the promotion's own design.** The worker role is
  authored `"permission_mode": "default"` (`:26`) and promoted for a non-interactive spawn
  (`src/fencing/renderer.ts:716`, the constant at `:387`). The comment at `:710-714` states the
  scope: *"the allow list is not widened and the deny list is untouched, so the mode is the only
  byte that moves."*
- **The document is bundled and selected by role name only.** `bundledDocumentPath`
  (`src/fencing/renderer.ts:295`) resolves `roles.json` beside the compiled module.
- **No input of the lap path reaches it.** `FenceContext` (`src/fencing/renderer.ts:172-211`)
  carries six path substitutions and nothing else — `interlockRoot`, `workerDir`, `claudeOrgPath`,
  `hookScript`, `fencePath`, `python` — plus a string-to-string `extra`. `FencedSpawner` does take an
  injectable `document` (`src/fencing/spawn.ts:769-786`, `document === undefined` meaning "the
  bundled one"), and the **only** construction site in the tree is
  `src/workspace/materializer.ts:1309`, which passes no document.
- **`--allowedTools` is not a fence-owned flag.** `FENCE_OWNED_FLAGS`
  (`src/control_plane/lap_run_intent.ts:188-194`) holds `--settings`, `--permission-mode`,
  `--mcp-config`, `--setting-sources`, `--strict-mcp-config`.
- **The `cli_args` allowlist authorises nothing.** `src/fencing/cli_args_allow.json` is
  `{"entries": []}`, unchanged from the measurement `D-0011` recorded at `13c7b1a1`.
- **A role added to the document is admissible with no other change.** `run admit` checks `--role`
  against `roleNames()`, the fence renderer's own reader of the same document
  (`src/control_plane/run_admission.ts:359-370`), refusing before its transaction opens.
- **`Bash(npm:*)`-shaped specs are not on the global forbidden-allow lists.** `roles.json:6-19`
  forbids `Bash(git *)`, `Bash(git push *)`, `Bash(git push:*)`, `Bash(gh *)`, `Bash(gh:*)`,
  `Bash(rm -rf *)` and `Bash`, plus three regexes over `Bash(*)`, `Read(*)` and
  `mcp__claude-peers__`.
- **`granted` never leaves rondo toward continuo.** `classifyPlan`
  (`src/refrain/classification.ts:68-75`) hands `plan.agentTypeInput` to `agentTypeRecord`, the
  record to `issueInitialContract`, and the contract to `classifyAction` against
  `plan.intendedAction`. What the classification record keeps is `agentTypeDigest`, not the key list
  (`:78-95`), and `admitRun` (`src/continuo/invoker.ts:672-714`) builds its argv from the role, the
  branches and the prompt — there is no capability argument on it and, as its doc comment records,
  no `--cli-arg` anywhere in the lap-1 API.
- **The role is already on the row.** `continuo_role` (`src/store/sqlite.ts:538`, read at `:2585`,
  typed at `src/store/records.ts:344`).
- **What was not measured**: no fence has been rendered for a role that does not exist yet; no
  refused-command report has been observed, because continuo emits none; and nothing here re-derives
  why the CLI answered `This command requires approval` for a read-only `npm --version` under a
  sandbox `repairSandbox` switches on (`src/fencing/renderer.ts:519`). The observation stands; its
  mechanism is continuo's to explain and is part of what the escalation asks.

### What would falsify it

- **A command-capable worker fence arriving by a shape rule 4's two properties do not fit** — an
  environment variable, a build-time default, a per-machine file — which would mean the properties
  were stated against a route continuo had no intention of taking, and rule 3's mapping has nothing
  to name.
- **continuo declining the escalation**, which sends rondo#67 back to a choice between an unverified
  lap and superseding `D-0011` rule 3, and makes this entry the record of the first option having
  been tried.
- **A role turning out to be the wrong carrier** — the first agent type that needs one purpose under
  two fences, or one fence under two purposes — which is rule 3's named cost arriving, and moves the
  fence profile off the role name and onto a field of its own.
- **`FENCE_OWNED_FLAGS` growing to cover the four**, which is already `D-0011`'s second falsifier
  and would make rule 1's restatement redundant rather than load-bearing.
- **A lap that greens a verify without any of this**, which would mean the measurement above missed
  an input; the entry is written so that a single counter-example to "no input reaches the allow
  list" falsifies it outright.
- Any measurement above failing to reproduce at continuo `38c667b5` and rondo `ba98cfe`.


---

## D-0040 — Where a run's authorisation is written down now that continuo owns a table for it: `D-0020` rule 4's falsifier fires in substance, the durable home does not move, and the envelope carries only facts that exist today

**Status:** accepted (2026-09-12, rondo's human gate). Refs rondo#67, rondo#69, `continuo D-1107`.

Moving the pin to take `continuo D-1110` — the fence declaration `D-0039` rule 6 says rondo waits
for — moves it across `continuo D-1107` as well, and that entry made two flags on `run admit`
**required**: `--delegation-record PATH` and `--delegation-record-schema NAME`. So rondo cannot admit
a single run at the new pin without producing a document it has never produced, and the shape of that
document lands on a decision rondo has already taken about where a delegation record lives.

**This is a decision-only entry** in `D-0037`'s and `D-0039` rule 6's sense: nothing under `src/`
moves in the diff that carries it.

### What fired

`D-0020` rule 4 put the delegation record **in rondo's store and not in continuo**, and its argument
was continuo's own restraint: continuo stated that neither `task` nor `assessment` had DDL and that
they were *"not designed by implication"*. `D-0020`'s falsifier list names the end of that argument:

> **continuo writing DDL for `task`.** Rule 4 rests on continuo declining to design it by
> implication; if continuo's own first Issue writes it, where the delegation record belongs is a live
> question again.

**The falsifier fired in substance and not in its letter, and the difference is recorded rather than
smoothed over.** continuo did *not* write `task`'s DDL — `continuo D-1107` rule 7 keeps `task` a
hole on purpose and says why a mutable task row could not hold what an individual run was authorised
to do. What it wrote instead is a **new table of its own**, `delegation_record`, keyed by `run_id`,
immutable by three triggers and `WITHOUT ROWID`, written inside the transaction that admits the run.
And the part rule 4's falsifier was really about — whether continuo would take this record — was
settled deliberately: `continuo D-1107`'s context records that ownership was *"genuinely unsettled"*,
that three documents named three different owners (including `cadenza S-7`, which is rule 4's own
source), and that **the operator settled it** in continuo's favour for that record. A falsifier
written against the weaker signal fired on the stronger one.

### Decision

1. **Rule 4 is not superseded, because the two records are not the same record.** What
   `continuo D-1107` owns is the **per-run authorisation envelope**: the values *one run* was
   permitted to act under, written atomically with the row that admits it. What `D-0020` rule 4
   describes is the **durable, queryable home** of the delegation facts across runs — its facts 4
   and 5 are *superseded agent-type records* and *the lineage of contracts*, which are histories
   rather than a per-run snapshot, and its fact 6 is the single-use consumption of a human decision,
   which is a thing only a store that can refuse a replay can enforce. A per-run row in continuo
   answers none of those three, and rondo's store answers none of continuo's atomicity. So both
   stand, and rule 4's implementation remains rondo's work rather than work continuo has now done.

2. **Atomicity is why the envelope goes to continuo, and it is a structural fact rather than a
   preference.** There must be no moment in which a run exists and what it was permitted to do does
   not. continuo holds the only `INSERT INTO run` in the system, and rondo is on the far side of a
   subprocess boundary and cannot join that transaction at all (`continuo D-1107` rule 1). A rondo
   that wrote its own copy *first* would be writing an authorisation for a run that may never be
   admitted; one that wrote it *after* would leave the window. Neither is available to rondo, and
   the one place the two writes can be one write is the place that now takes them.

3. **The two do not conflict, and the reason is that continuo does not read the envelope.**
   `continuo D-1107` rule 2 is a structural commitment: the envelope is opaque text, the schema
   constrains its form only (a non-empty JSON object within a size bound), no column is extracted
   from inside it, no `CHECK` reads a key, no code path branches on one, and **the format name is
   stored and printed back and never recognised**. So handing continuo the envelope does not move
   cadenza's semantics into the control plane, which is the collapse `D-0018`'s layering exists to
   prevent from either side. rondo remains the layer that owns the meaning, which is also why
   canonicalisation is rondo's: continuo digests the bytes as they arrive (`verbatim-utf8`) and is
   explicitly not the layer that may declare two spellings equal.

4. **The envelope's format name is `rondo.delegation-record/1`, and the name is rondo's because the
   format is.** continuo keeps no list of names and refuses none, so the name is a claim rondo makes
   about its own document and the version is rondo's to move. It is **not** cadenza's schema: cadenza
   has no wire schema for a contract, and its own scoping note makes serialisation a decision that
   waits until the contract cannot be exercised as an in-memory value. That condition has now been
   met by events, and `continuo D-1107`'s context says so — but it has been met for *continuo's*
   record, and cadenza has not yet answered it. So `rondo.delegation-record/1` is deliberately a
   **host format**, and a cadenza serialisation arriving later replaces it under a new version rather
   than being retrofitted into this one.

5. **The envelope carries the facts that exist today, as values, and nothing that would have to be
   invented to fill a field.** Which is `D-0020` rule 4's facts 1 to 3, plus the identity of the
   catalog the grant was issued against:

   a. **the contract's fields as issued**, taken from cadenza's own rendering
      (`contractPayload`) rather than re-encoded, so the digest can be recomputed over the same
      bytes rather than trusted — rule 4 fact 1's stated reason, and the same rendering
      `D-0022` rule 18 already persists in the `composition` row;

   b. **`contract_digest`** beside them (fact 2);

   c. **`agentTypeId`, `vocabularyVersion` and `agent_type_digest`**, plus the two policy bags the
      record carries (`loopPolicy` and `executorPolicy`) — the policy that was *applied*, which is
      what makes "under what policy did it do that" answerable (fact 3);

   d. **the project's identity**: the project name, the `configDigest` the contract was issued
      against, and the base branch — the catalog snapshot reduced to what identifies it.

   **Facts 4, 5 and 6 of rule 4 are absent because they do not exist**, and their absence is the
   honest record rather than a gap: no agent-type record has been superseded, no contract has a
   `supersedes` chain with anything in it, and no widening has been issued, which rondo may not
   compose anyway (`D-0009` part 2). A field carrying an empty list of things that have never
   happened is a field a later reader would mistake for a measurement.

6. **The catalog's layer documents are recorded by identity and not verbatim, and the reason is the
   secret rule.** `continuo D-1107` rule 6 puts an obligation on the producer — secrets by
   identifier and version, never by value — and states plainly that continuo cannot enforce it,
   because enforcing it would mean reading the envelope. **Checked by name against rule 5's four
   facts: none of them is, or can carry, a credential.** A contract's fields are capability keys,
   identities rondo mints and digests; an agent-type record is an id, a vocabulary version, two
   policy bags of numbers and neutral names, and a digest; a project name, a config digest and a
   branch name are names. The **one** value in reach that could carry a credential is a catalog
   layer's `source` when its kind is `git_url` — a URL whose userinfo can hold a token — which is
   why the layer documents are reduced to (d) above rather than carried whole. An envelope is
   unforgettable once continuo has it: the row is immutable by design and is not backfilled or
   deleted, so a credential recorded there could not be removed afterwards, and the narrow
   inclusion is chosen against exactly that.

   **Annotated 2026-09-12 by this entry's own implementation (rondo#67's second PR).** The shape
   this rule names as *"the one value in reach that could carry a credential"* **cannot occur**:
   cadenza refuses embedded credentials in a catalog source at issue time, in its own words — *"url
   must not embed a password; a password in a catalog file is a leaked password"*, and separately
   *"url must not embed credentials; the only accepted userinfo is the bare `git@` of an ssh url"*
   (`domain/clone-source.ts` at the vendored revision). So a plan naming such a layer is answered
   before an envelope exists at all, which is a stronger guarantee than rondo omitting the value —
   the credential never reaches rondo's memory, let alone continuo's row.
   `test/access/delegation.test.ts` carries that as a planted case, and it asserts that the producer
   relays cadenza's message without quoting the token back into it.
   **The rule's conclusion is unchanged and its cause is narrower than stated**: the layer documents
   are still reduced to the project's identity, now on the ground that the envelope keeps no byte of
   a document it does not need rather than on a leak that is reachable. The obligation
   `continuo D-1107` rule 6 puts on the producer is also unchanged — it is an obligation about every
   future fact the envelope grows, not only about today's four.

7. **The envelope is transport, and rondo persists nothing new for it.** The file rondo writes
   exists to be read by the `run admit` it is passed to and is removed after that call answers; the
   durable copy is continuo's row, readable through `run show --json`. **No column, table or record
   kind is added to rondo's store** — `continuo D-1107`'s `admit` answer carries an
   `envelope_digest`, and recording it would be a column, which this entry does not take
   (`D-0039` rule 5's posture, for the same reason: the consuming side is not designed here).

8. **The producer is the composition root, and `src/continuo/` gains no filesystem.** `D-0017`
   makes that layer the one place under `src/` that starts a process, and its modules are otherwise
   pure; a record written from inside it would add a second capability to the layer whose narrowness
   is the point. So `src/access/` composes the envelope, writes it, and hands `admitRun` a path,
   which is also where the two statements that it is one document — cadenza's rendering and the
   bytes continuo digests — are made in one place (`D-0018` rule 5's shape).

9. **Nothing is backfilled.** Runs admitted before continuo's `0006_delegation_record.sql` carry no
   record and never will (`continuo D-1107` rule 11). rondo neither invents one for them nor reads
   the table for a run it did not admit at this pin or later.

### What this entry does not do

- **It does not supersede `D-0020` rule 4**, move the six facts, or build the schema that holds
  them. Rule 4's implementation is still unwritten work in rondo's store, and this entry narrows
  what that work is *for* rather than cancelling it.
- **It does not make rondo a reader of continuo's record.** `run show` is a verb rondo does not
  drive, and what a surface does with a recorded authorisation is rondo#69's question.
- **It does not decide cadenza's serialisation.** Rule 4's version exists so that cadenza's answer,
  when it comes, replaces a format rather than editing one.
- **It does not widen `--cli-arg` or touch `D-0011` rule 3.** The two new flags are required inputs
  of a verb rondo already drives, and neither reaches the child's tool permissions.

### Residuals

| Residual | Why not here | Who decides |
|---|---|---|
| The store-side schema of `D-0020` rule 4's six facts | It is that rule's own unwritten implementation, and this entry deliberately does not design a second home | a later rondo entry, with rondo#69 |
| Whether `envelope_digest` becomes a column on the iteration row | It is a record rondo would keep about continuo's record, and nothing reads it yet | the first surface that has to show it |
| A canonicalisation for `rondo.delegation-record/1` | continuo digests bytes verbatim and states that canonicalisation belongs to whoever owns the meaning; rondo has one producer today, so two spellings of one grant cannot yet arise | the second producer, or cadenza's serialisation |
| What the envelope carries once a widening can be issued | Rule 4's fact 6 does not exist and rondo may not compose one | `cadenza S-1`, then a rondo entry |

### What was measured, and how

At continuo `fcf86eb2b7eb34d65bf73188b2b34544fab6820c` — the revision the pin moves to — and at
rondo `09830d6`, on **2026-09-12**, by running as well as by reading.

- **The two flags are required, and the failure is a parser refusal rather than a decode.** rondo's
  own end-to-end smoke against the built pin answered
  `continuo run admit: error: the following arguments are required: --delegation-record,
  --delegation-record-schema` — exit 2 with prose, which is the one shape `--json` does not reach
  (`D-0015`).
- **A JSON object in a file and any format name is enough to admit, and the declaration rides with
  it.** `run admit --delegation-record <file> --delegation-record-schema 'rondo.delegation-record/1'
  --allow-bash 'npm ci --ignore-scripts' --allow-bash 'npm run:*' --json` answered
  `continuo.run.admit/1` with `ok: true` and a `delegation_record` object carrying
  `record_schema`, `envelope_digest`, `digest_algorithm: sha256` and
  `canonicalization: verbatim-utf8`. The format name was echoed back unrecognised, which is rule 3's
  opacity observed rather than assumed.
- **No other verb rondo drives grew a required flag.** `lap perform --help` at this revision carries
  the same required set rondo already passes; `--state-root` is now a *parent* whose per-run child
  continuo derives and creates itself (`continuo D-1105`), so the absolute directory a plan names is
  unchanged.
- **`continuo.run.admit/1` did not move**, so rondo's decoder is unaffected: it reads the keys it
  names and a grown key is one every JSON reader already handles (`continuo D-1107` rule 12).
- **cadenza's rendering is already what rondo persists elsewhere.** `src/access/advisory.ts`'s
  `issueFor` writes `contractPayload(contract)` into the `composition` row beside
  `contractDigest(contract)` (`D-0022` rule 18, citing `D-0020` rule 4 fact 1), so rule 5's (a) and
  (b) are an existing assembly reused rather than a second encoding of the same contract.
- **What was not measured**: no envelope composed by rondo has been admitted yet — the probe above
  used a hand-written file — and no lap has run under one. That is the implementation's measurement
  and rondo#67's acceptance, which is a lap whose worker greens the target repository's own verify.

### What would falsify it

- **continuo acquiring an opinion about the envelope's contents** — a recognised format name, a key
  read, an index over something inside it — which is `continuo D-1107` rule 2's own commitment
  breaking and would make rule 3's argument for handing the document over false.
- **cadenza publishing a serialisation and a digest canonicalisation for a contract**, which is
  cadenza's own waiting decision arriving; `rondo.delegation-record/1` then becomes a transcription
  of cadenza's format under a new version, and rule 4's "the format is rondo's" stops being true.
- **A fact rule 5 omits turning out to be required by an audit that actually happens.** The entry
  chooses today's facts over placeholder fields; an incident review that needed the catalog's layer
  documents verbatim would move rule 6's reduction to a redaction step rather than an omission.
- **`D-0020` rule 4's store-side schema being built as a projection of continuo's row** rather than
  beside it, which would mean the two records were one after all and rule 1 drew the line in the
  wrong place.
- **A run admitted with an envelope whose digest cannot be reproduced from the stored bytes**, which
  would make the whole record decoration — continuo refuses that case as `DelegationRecordTampered`,
  and rondo's reliance on that refusal is what rule 7 rests on.
- Any measurement above failing to reproduce at continuo `fcf86eb2` and rondo `09830d6`.

## D-0041 — The one write the operator's page may do: an unattended redraw and a person's click are told apart at runtime and never by type, the approver is the only actor, and the write is a single function rather than a store

**Status:** accepted (2026-09-12, rondo's human gate). Refs rondo#95, `D-0032`, `D-0036`, `D-0020`.

`D-0032` rule 1 says the operator's surface has to be able to show the record. rondo#95 built the
first surface that is not a terminal — one page on `127.0.0.1` that redraws itself every five
seconds — and drew its boundary at *reading*: the two ports it is handed are `Pick`ed down to the
read methods, so a write from that module does not compile. The argument for that boundary was not
"web surfaces should be read-only". It was narrower and it was about two specific rows:

> A page redrawing every few seconds while nobody is at the desk would make both of them lies

— the presentation counted once per subject (`D-0032` rule 10) and the durable last-look mark
(rule 9), each of which is a **claim that a person was shown something**. An unattended redraw
writing either one puts a lie in the ledger.

The operator now wants to answer a gate from that page without opening a terminal. That is a write.
This entry re-draws the boundary rondo#95 drew, and the re-drawing is the work: the old argument is
not repealed, it is **scoped to what it was actually about**, and a second argument is written for
the one write that is being let through.

### Decision

1. **The argument rondo#95 made was never about writes. It was about writes that assert a human
   was present.** The two rows it named are exactly those; a gate answer is a third. So the rule
   the boundary now carries is: *this surface may write only what a person actually did, and only
   at the moment they did it.* A redraw did not read the inbox, so it may not count a
   presentation or move the mark — that half of rondo#95 stands unchanged and unweakened. A click
   *is* a person answering a gate, so it may write one.

2. **The type cannot make this distinction, and pretending otherwise would be the mistake.** An
   unattended redraw and a click arrive at the same process, over the same socket, into the same
   module; there is no type that is inhabited by one and not the other, because the difference is
   not in the data — it is in whether a human was at the keyboard. **So the distinction is made at
   runtime and the type is used for what a type can do**: keep every path that *is not* the write
   path structurally unable to write (rule 4).

3. **Two runtime facts stand between a redraw and the ledger, and each one alone would be enough.**

   a. **The method.** The redraw is `<meta http-equiv="refresh">`, which is a GET, and there is no
      script on the page — no `fetch`, no `XMLHttpRequest`, no client-side build (rondo#95's
      constraint, kept). **rondo's page has no mechanism that can issue a POST without a person
      pressing something.** `GET` and `HEAD` reach only the renderer, which holds only the read
      ports.

   b. **A token minted per process.** The server mints one unguessable value when it starts
      listening and renders it into the form; a `POST` whose token does not match it is refused
      before anything is read. The token never leaves the page, and no other site can read the
      page (no CORS header is sent, and a cross-origin form post cannot read the response), so a
      request carrying it came from a page this process served.

   c. **The browser, told not to frame this page.** `Content-Security-Policy: frame-ancestors
      'none'` is served with the page, and it is not a third copy of the same defence: a page on
      `evil.example` cannot *read* this one and so cannot steal the token, but it can put this one
      in a transparent frame over a button of its own — and the click that follows carries the
      genuine token from the loopback origin and is indistinguishable, at this process, from the
      operator pressing approve. The only party that can tell those apart is the browser, and only
      if it is told to. rondo needs no frame, so refusing every one costs nothing.

   Fact (b) is the one that also answers the *other* attacker, and that is why both are kept rather
   than just (a). rondo#95 established that a loopback bind decides which sockets arrive and not
   which *pages* sent them, and defended against DNS rebinding with the `Host` check. A
   cross-site **form** post is the same shape of attack one door further along: it survives the
   `Host` check, because a browser posting to `http://127.0.0.1:7333/` sends exactly the `Host` the
   operator's own browser would. The `Origin` header is checked too where the browser sends one,
   but the token is what the refusal rests on, because `Origin` is absent from enough legitimate
   and illegitimate requests to be a corroboration rather than a gate.

4. **The read path and the write path are separate ports, and the write port is one function rather
   than a handle.** `WebPorts` keeps its `Pick`ed read methods verbatim. The write arrives as a
   *second, optional* field holding a single function — "carry this body to this iteration's open
   gate" — and not as a widened `IterationStore` or a `VerifiedContinuo`. The difference is
   load-bearing: with a store on the ports, every future edit to this module can write anything the
   store can write and the compiler will agree; with one function, the page's whole writing
   vocabulary is one sentence long and widening it is a visible change to a type. This is rondo#95's
   "read-only is a type rather than a promise" kept in force for everything except the one verb, by
   the same mechanism.

5. **The actor is `RONDO_APPROVER`, and the page mints no identity of its own.** It is the same
   value the terminal's `--actor-id` is checked against (`approvedActor`), so a gate answered from
   the page and a gate answered from the terminal are the same person in the ledger, spelled the
   same way. When it is unset there is **no button on the page at all** and a `POST` is refused:
   `D-0020` rule 2's "rondo acts for a named person and refuses to act for an unnamed one" is not
   relaxed for being on a screen. The page also does not *deepen* that rule's stated reduction —
   the identity is still asserted by whoever controls the host rather than authenticated, which is
   the same reduction the terminal carries and ends by the same adapter.

6. **A person is shown what a person at the terminal is shown, before they press.** That is the
   gate's own question -- its type, its stage, the worker's rationale and the options it was asked
   -- and then `D-0029` rule 2's material: the topic branch, the workspace, the commit subjects,
   the paths and the independent reading. Both are rendered beside the button, from the same lines
   `rondo answer`'s reading mode prints. The question is not in rondo's store and is read with one
   `gate show`; a continuo that will not start is a **line saying the question could not be read**
   and never a refusal, because `web` is dispatched ahead of `startContinuo` so that the screen
   saying what is stuck stays reachable when continuo is one of the stuck things -- and a person
   who presses on a page that says so is pressing knowingly. The screen that is easier to reach than a terminal must not also be the
   screen that asks for less before it writes, and two renderings of that material would be two
   things to keep true. It is read only for the row that carries a button, because it shells out to
   `git` and a page redrawing every five seconds must not inspect every workspace it can see.

7. **What may be written is one sentence, and the button carries one word.** The page may answer an
   open gate on a **live, non-terminal** iteration with the body `approve`, which is the option
   rondo's own plans put first. It may not revise, publish, abandon, withdraw, start a lap, close a
   run, or write a proposal decision; it does not move the last-look mark or count a presentation
   (rule 1); and it renders a button only for a row that is `awaiting_human` with a gate id on it.
   Everything past the click is the terminal's own path — `walkGate` and then `resume` — reached by
   the same functions and not by a copy, so "the button does what `rondo answer` does" is a
   property of there being one implementation rather than a claim two code paths have to keep
   agreeing on.

8. **A write is answered with a redirect and never with a page.** The `POST` replies `303` to `/`,
   so the browser's own redraw and the operator's reload are GETs; a page whose refresh could
   re-submit an answer would turn `D-0032`'s ledger into a count of how many times somebody pressed
   F5. continuo's `answer` is idempotent for an identical body and `resume` settles once, so a
   double click is absorbed rather than doubled — but that is continuo's property and this rule
   does not rely on it.

### What this entry does not do

- **It does not make the page a second operating surface.** One page, one button, no router, no
  dependency, no client-side build, loopback bind and `Host` check — every constraint rondo#95 took
  is unchanged, and rule 4 is what stops the next verb arriving by habit.
- **It does not touch `D-0032` rules 9 and 10.** The page still writes neither row, and `rondo
  inbox` remains the only thing that does.
- **It does not settle how a second operator would be told apart from the first.** The allowlist is
  still size one and still asserted; a page reachable by two people would need `D-0020` rule 2's
  other half, which is unbuilt.
- **It does not widen the bind or add authentication.** What protects the page is still that it is
  not reachable, and the token protects the *operator's own browser* from other pages rather than
  the page from the network.

### Residuals

| Residual | Why not here | Who decides |
|---|---|---|
| A second button (revise, publish, withdraw) | Each is a different irreversible act with different inputs; `revise` needs an instruction typed, and `publish` pushes | the entry that wants one, against rule 4 |
| Free-text answers from the page | The gate's options are a plan's field and a text box is a second input surface to validate; one word is what a person at a gate presses | the first gate whose options are not rondo's own |
| Authenticated identity on this surface | `D-0020` rule 2's OIDC half is unbuilt everywhere, not just here | the adapter `D-0020` already specifies |
| Showing the walk's six verbs as they happen | The page has no script and a redirect-then-redraw is what a scriptless page can do | whoever first needs progress rather than an outcome |

### What was measured, and how

On **2026-09-12**, on this machine, against the real dogfood environment
(`scripts/dogfood-env.sh`) — continuo built at the pinned
`fcf86eb2b7eb34d65bf73188b2b34544fab6820c`, a control plane and a rondo store on disk, `rondo web`
serving on `127.0.0.1`, and every request made with `curl` so that the headers under test are the
ones sent.

**A gate was opened without spending a lap.** A lap spawns a real worker session and costs real
money, and none of the properties here is about what a worker wrote: one runless gate was inserted
into the control plane at stage `received`, and the iteration row was reserved and transitioned to
`awaiting_human` through rondo's own store with a plan payload built by `readRunPlan` /
`allocate` / `admittedPlan` / `planPayload` — the same four calls `rondo start` makes. Everything
from the press onward is the real path: continuo's own CLI, six verbs, and rondo's own `resume`.

- **The button is on the page, and it is the page's own form.** The served HTML carried
  `<form class="approve" method="post" action="/">` with the process's token, the iteration id and
  a single submit button reading `approve`, beside the gate id it answers.
- **Five unattended redraws wrote nothing.** `operator_view` and `operator_attention` both held
  **0** rows afterwards, which is rondo#95's property and the one this entry may not cost.
- **The page refuses to be framed.** `Content-Security-Policy: frame-ancestors 'none'` is on the
  200 response (found by the Codex review of this change, not by the author, and recorded here as
  the third fact rule 3 now names).
- **A form without the token is refused, and so is one from another origin.** `POST` with the
  iteration and no token: **403**. `POST` with the correct token and `Origin: https://evil.example`:
  **403**. Neither reached the write port.
- **The press closed the gate.** `POST` with the token and a loopback `Origin`: **303** to `/`. The
  terminal `rondo web` was running in showed the same six lines `rondo answer` prints — present,
  deliver, ack, answer, deliver, ack — and then `iteration 'web-approve-003' is closed`.
- **The ledger says who, when and what.** continuo's `gate_transition` rows for
  `g-web-approve-003`:

  | seq | kind | from → to | actor_kind | actor_id | body | at (UTC) |
  |---|---|---|---|---|---|---|
  | 8 | advance | received → presented | secretary | happy_ryo | — | 2026-09-12 00:17:35 |
  | 9 | advance | presented → answered | **human** | **happy_ryo** | **approve** | 2026-09-12 00:17:35 |
  | 10 | advance | answered → forwarded | secretary | happy_ryo | — | 2026-09-12 00:17:36 |
  | 11 | close | forwarded → forwarded | system | happy_ryo | — | 2026-09-12 00:17:36 |

  The gate row reads `outcome: answered_and_forwarded`, closed at `00:17:36`; rondo's own row reads
  `status: closed`, `gate_outcome: answered_and_forwarded`. **Row 9 is rule 5 observed**: the actor
  the press wrote is `happy_ryo` under `actor_kind: human`, which is `RONDO_APPROVER` and is spelled
  exactly as the terminal spells it.
- **The question and the work are shown beside the button** (both added after Codex rounds two and
  three, which found each missing in turn). The page's `<pre class="material">` for the seeded row
  carried, in order: `gate g-web-approve-005 (merge_approval) stage 'received'`, the worker's
  rationale, `options ["approve","revise"]`, then the topic branch, the workspace path, the
  unreadable-workspace line for a workspace that does not exist, and `review  no independent
  reading of this work was recorded.` -- `rondo answer`'s own reading mode, from one list of lines
  rather than a second rendering. The press that followed was **303**, and the ledger reproduced
  exactly: seq 19 `presented -> answered`, `actor_kind: human`, `actor_id: happy_ryo`,
  `body: approve` at `2026-09-12 00:27:24`; the gate `answered_and_forwarded`; rondo's row
  `closed`.
- **What was not measured**: no lap has been answered from the page — the gate above was seeded
  rather than raised by a worker — and no browser was driven. The token, the `Origin` check and the
  redirect were exercised with `curl`, which sends the headers a browser sends but is not one.

### What would falsify it

- **The page acquiring a script, a `fetch`, or any redraw that is not a document GET.** Rule 3(a)
  is a structural claim about what this page *can* emit; a client-side refresh that could be made to
  POST deletes half of rule 3 and leaves the token carrying it alone.
- **A second write arriving and being handed the same door.** Rule 4's one-function port is the
  whole boundary; the second verb is the point at which "one sentence" stops describing it and this
  entry has to be re-argued rather than extended.
- **`RONDO_APPROVER` ceasing to be an allowlist of one**, or the page becoming reachable by anyone
  but the person at the host — either makes rule 5's "the same person, spelled the same way" false,
  and the token starts being asked to do authentication's job.
- **continuo's gate `answer` ceasing to be idempotent for an identical body**, which would make
  rule 8's redirect the only thing between a double click and two answers, and a redirect is not a
  lock.
- **An unattended redraw turning out to have written anything**, which is rondo#95's original
  property and the one thing this entry may not cost.
- **A third way for a browser to be made to send a request the operator did not mean.** Rule 3
  names three and refuses each where it can be refused (the method, the token, the frame); the
  fourth one is this entry being incomplete rather than wrong, and the place to look is whatever a
  browser will do for a page the operator is not looking at.
- **A browser that sends `Origin` on a same-origin form post but not the token**, or any evidence
  that the token can reach a cross-site page, which would mean rule 3(b) does not separate the two
  requests it claims to separate.

---

## D-0042 — What counts as a presentation on a page that redraws itself: the press and not the render, recorded before the gate is answered, and the reader who does not press left uncounted

**Status:** accepted (2026-09-12, rondo's human gate). Refs rondo#106, `D-0041`, `D-0032`, `D-0022`.

`D-0022` rule 18 puts the write before the showing, and `src/access/advisory.ts` states it for the
terminal: *"the proposal row is written before it is presented ... if the insert fails, nothing is
rendered"*. The page built by rondo#95 does the second half and not the first. `explainHtml` calls
`propose(snapshot)` and renders its claims, and `src/access/web.ts` holds no `AdvisoryRecord`
writer at all. So a framing reaches a person on the surface they actually read, and
`operator_attention` cannot count it.

The obvious repair breaks `D-0041`. That entry's rule 1 is that this surface *"may write only what
a person actually did, and only at the moment they did it"*, and rule 7 spells out one consequence:
the page *"does not move the last-look mark or count a presentation"*. A page that recorded before
rendering would record every five seconds at an empty desk, and `D-0032` rules 9 and 10 say what
that costs -- both rows are **claims that a person was shown something**, so an unattended redraw
writing either puts a lie in the ledger.

### The collision, stated

Three accepted entries pull in different directions here, and the disagreement is real rather than
apparent:

- `D-0022` rule 18 wants the write **before** the showing.
- `D-0032` rules 9 and 10 want the written row to be **true**: somebody was shown this.
- `D-0041` rules 1 and 7 want this surface to write **only on a human act**, and say in as many
  words that it counts no presentation.

They collide because the page shows things without being asked to. Rule 18 was written for a
command, where showing is something a person requested; on a surface that redraws itself, "before
it is presented" names a moment that arrives with nobody there.

**What gives way is rule 18's *placement*, and never rule 18's failure.** The failure it exists to
prevent is a framing an operator acted on that the ledger does not hold. That failure is about the
acting, not about the pixels: an explanation drawn on a screen at an empty desk and never read is
not the hazard, and recording it would not be a record of anything. So the order is kept and the
thing it is *before* moves.

### Decision

1. **On this surface the press is the presentation, and the render is not.** `D-0041` rule 1's own
   criterion decides it: a press is a person doing something, at the moment they did it, and it is
   the one available proof that the framing beside the button reached somebody. A redraw is not.
   So `D-0041` rule 7's "does not ... count a presentation" is **amended to name the redraw
   rather than the surface**: this page counts a presentation when a person presses, and never
   otherwise.

2. **Rule 9's last-look mark is untouched, and that half of `D-0041` is not amended.** A press is
   proof that one row was read; it is not proof that an inbox was. `rondo inbox` remains the only
   thing that moves the mark, exactly as rondo#95 and `D-0041` left it.

3. **The write goes before the act, and a write that fails stops the act.** The framing is recorded
   before the gate is walked, and if the insert fails nothing is answered and the person is shown
   why. That is rule 18's order and rule 18's refusal, over the gesture rather than over the
   rendering -- on a page, the rendering has already happened by the time anybody can press.

4. **It is `explain`'s writer, reached through the one function this page already holds.** The
   claims the page drew are `propose(snapshot)`'s, which is what `explainIteration` composes and
   records; a second path to the same rows would be two implementations to keep agreeing, which is
   `D-0041` rule 7's argument for the button reaching `walkGate`. And it happens inside
   `AnswerFromWeb` rather than in `src/access/web.ts`, so `D-0041` rule 4 stands unweakened: the
   page's whole writing vocabulary is still **one function**, and widening it is still a visible
   change to a type.

5. **A person who reads the page and does not press is not counted, and rondo says so rather than
   guessing.** There is no runtime fact on a `GET` that separates a reader from a redraw -- the two
   arrive identically, which is `D-0041` rule 2 -- so counting one would be the invention that
   entry refuses. What the ledger now holds is *presentations that were acted on*, which is less
   than every presentation and is the most this surface can claim truthfully.

### What this entry does not do

- **It does not make the page write more.** One function, one verb, one word; rules 4, 5, 7 and 8
  of `D-0041` are otherwise unchanged, and no port was widened to carry this.
- **It does not touch the terminal.** `rondo explain` records exactly as before, in exactly the
  order `D-0022` rule 18 gives it.
- **It does not count the rows the page explains beside the one that was pressed.** Every live row
  is on the page; one of them was acted on, and only that one is recorded.

### Residuals

| Residual | Why not here | Who decides |
|---|---|---|
| Counting a page read that ends in no press | No runtime fact tells a reader from a redraw on a `GET`; a script or a second request would be the mechanism, and rondo#95's no-script constraint is load-bearing | the entry that wants a scripted page |
| The recorded framing is re-composed at press time | `D-0032` rule 3 refuses a stored summary, so it is re-gathered rather than remembered; it can therefore differ from bytes drawn up to five seconds earlier. The terminal has the same property between composing and printing | whoever first needs byte-exact provenance of what was on a screen |
| A press that is refused after the framing is recorded | Rows the page refused (terminal, no gate) never reach the write; a continuo that will not start does, so the ledger can hold a framing whose gate walk then failed. That is a framing a person *was* shown, so it is not a false row | -- |
| A framing recorded and not counted is said in the host terminal and not on the page | `sayAdvisoryOutcome` keeps the record and exits **1** on the same outcome, and a browser cannot read an exit status; refusing the press instead would stop an operator answering a gate over rondo's own accounting | whoever first needs the page to carry a warning it did not refuse on |

### What was measured, and how

On **2026-09-12**, on this machine, against a real `node:sqlite` store on disk and a real `rondo
web` process serving on `127.0.0.1`, with every request made by `curl` so that what is under test
is what a browser would send. No continuo was built: none of the properties here is about the gate
walk, and the press's own refusal when continuo is absent is what shows the ordering.

- **Five unattended redraws wrote nothing.** Five plain `GET`s -- which is exactly what
  `<meta http-equiv="refresh">` sends -- left `proposal`, `operator_attention`, `operator_view` and
  `human_decision` at **0 rows each**. That is the half of `D-0041` this entry does not amend,
  measured after the change rather than argued.
- **One press wrote two rows, and wrote them before the gate was walked.** The `POST` returned
  `409 continuo is not usable: RONDO_CONTINUO_CLI is not set` -- so nothing was answered -- and the
  ledger nevertheless held `proposal` **1** and `operator_attention` **1**:
  `explanation-i-live-1-1789176991585`, kind `explanation`, drafter
  `rondo/advisory/deterministic`, and an attention row `presented` against that subject. Its
  payload's first claims are `request = do the thing`, `status = awaiting_human`, `attempts = 1`,
  which are the claims the page had drawn. `operator_view` and `human_decision` stayed **0**
  (rule 2).
- **A press the ledger could not take answered nothing.** With the database made read-only under
  the running server, the press came back *"The framing you pressed on was not recorded, so nothing
  was answered. The explanation of 'i-live-1' was composed and not recorded ...: attempt to write a
  readonly database"*, and no gate walk was attempted. That is rule 3, and it is the page's
  version of what `src/access/advisory.ts` does in a terminal.
- **A press naming a row that is not there is refused before the ledger is touched.** `POST` with
  `iteration=i-nope` returned `409 There is no iteration 'i-nope'.` and left both counts unmoved --
  a stale page is not a framing somebody was shown.

## D-0043 — The trigger a stopped lap pulls: one proposal at the abandon the conductor's own arc reaches, `contract_keys` because it is the only option set that is a choice, and a successor identity rondo mints and nobody has yet adopted

**Status:** accepted (2026-09-12, rondo's human gate). Refs rondo#105, `D-0022`, `D-0023`, `D-0019`,
`D-0032`, `D-0042`.

rondo#105 measures a hole and names its blocker. The advisory works and every one of its writers is
a verb a person types: `advisoryPorts()` is constructed at `src/access/cli.ts:1263`, `:1436`,
`:1635` and `:1838`, and nowhere else. The lap's own path reaches none of them -- `src/refrain/` and
`src/access/conductor.ts` hold no reference to `src/advisory` at all -- so after a real lap the
`proposal` table is empty. The blocker is that the one door that binds anything, `proposeRetry`,
takes a `--successor-id` from an operator and refuses one already in the store
(`src/access/advisory.ts:1245-1256`), and an automatic caller has nobody to take it from.

This entry decides **where the trigger goes, which endings pull it, what it emits, and who mints the
successor's identity.** It takes no implementation.

### What was measured, and where

At `91e6fc3` on 2026-09-12, by reading the tree.

- **`abandoned` is written inside the conductor's own arc in three places**, all reached from
  `admit()`: a classification refusal (`src/refrain/interpreter.ts:803`), cadenza's `refused`
  (`:873`) and cadenza's `needs_approval` (`:883`). `resume()` writes `closed` (`:1449`), `failed`
  or `stalled`, and never `abandoned`. The fourth `abandoned` is the human verb `abandon()`
  (`:497`), which is not part of the arc.
- **`failed` is rondo's own fault or an unverifiable build** (`:817`, `:953`, `:1035`, `:1302`).
- **A `closed` iteration is not therefore an approved one.** `approvedForPublication`
  (`src/access/cli.ts:272-296`) already separates the one outcome that means a person answered,
  `answered_and_forwarded`, from `withdrawn`, `expired` and `unanswerable`.
- **Every call into the conductor is in `src/access/cli.ts`.** `src/access/web.ts` calls none of the
  four verbs; the page's answer goes through `answerFromPage` (`cli.ts:2432`), which calls `resume`.
- **The boundary needs no change.** `src/access` may import `src/advisory`
  (`test/architecture/import-boundaries.test.ts:188`), the reverse is refused by planted cases, and
  the arrow this entry uses has a control case at `:1858`. `src/access/advisory.ts` already imports
  `allocate` from `src/refrain/allocator.js` and imports nothing else from its own layer but
  `console.js`, so `conductor.ts -> advisory.ts` is acyclic.
- **The three proposable kinds do not have equally useful option sets.** `agentTypesOf`
  (`advisory.ts:1012`) draws agent types from the lineage rows and `proposeRetryPlan`
  (`src/advisory/proposal.ts:695`) draws plans from the same place, so on a store whose subject has
  no predecessor both yield exactly one option, which is the thing that just stopped.
  `promotionsOf` (`advisory.ts:1046-1074`) does not read the lineage: it offers the subject's own
  contract unchanged plus one option per key the agent type's author declared `askable`, one key at
  a time, and `unchangedIndex` (`proposal.ts:562`) recommends the unchanged one.

### Decision

1. **The trigger fires on exactly one ending: `abandoned` reached inside the conductor's own arc.**
   That set is cadenza's `refused`, cadenza's `needs_approval`, and a classification refusal -- all
   three are grant-shaped endings, which is what makes an options-and-a-recommendation the right
   answer to them rather than a sentence of prose.

2. **The four endings that do not fire, each for its own reason.**
   - **`closed` with `answered_and_forwarded`.** A person said yes; what follows is `publish`.
   - **`closed` without it** (`withdrawn`, `expired`, `unanswerable`). This is the first widening
     and it is deliberately not taken here: a withdrawal is a person's own act and an expiry is a
     clock, and neither of them says the plan was wrong. Whoever takes it needs no new predicate --
     `approvedForPublication` is it.
   - **`failed`.** A rondo defect or a build that would not verify. A retry under a different
     contract answers none of it, and a proposal there would file a bug report as an option set.
   - **`awaiting_human`.** A gate is open and the *worker's* question is already on the table. A
     second question standing beside it spends the one human contact `D-0036` rations, on rondo's
     initiative, next to a question somebody else asked. `D-0022` rule 15's refusal to mint a gate
     of rondo's own is not literally this, but it is the same instinct and this entry follows it.
   - **The human verb `abandon()`.** A person with their hands on the keyboard can type
     `rondo propose`. Placing the trigger on the arc rather than on the status is what tells these
     two apart, and it costs no field and no parsing of a recorded reason.

3. **The call site is `src/access/conductor.ts`'s `admit()`, and the advisory ports become a
   required argument of it.** One site, because rule 1's ending occurs on one path; inside the
   conductor rather than at its caller, so that a second caller -- a start button on the page --
   inherits the trigger by construction; and *required* rather than optional, because a type is the
   only thing that makes "a new caller cannot forget" true. `resume()`, `requestWithdrawal()` and
   `abandon()` are unchanged, `src/refrain` is unchanged, and no port on `ConductorPorts` learns the
   word advisory: an advisory reachable from the loop's port surface is what the planted cases
   exist to keep out.

4. **What it emits is at most one proposal, of kind `contract_keys`.** One, because two proposals
   about one stop are two things to answer about one event. `contract_keys`, because on the measured
   tree it is the only kind whose option set is a *choice* on the store where this ending actually
   happens: the other two select from the lineage, and the subject of a first stop has none. Its
   options are also the ones with a bound on them -- one key at a time, and only a key the agent
   type's author already declared askable -- which is the nearest thing rondo has to the
   amplification bound `D-0022` rule 17 gave up.

5. **Nothing is recorded when the only candidate is the unchanged one.** An agent type with an empty
   `askable` yields an option set of one, and an option set of one is not a choice. The report says
   so in a line; the ledger gets no row. This is the answer to "when does it not propose", and it is
   a property of the candidates rather than a threshold somebody tunes.

6. **rondo mints the successor's identity, by derivation from the subject's.** The base is the
   subject's iteration id with a trailing `-r<digits>` removed, so a chain of retries does not grow
   its own name; the candidate is `<base>-r<n>` for the smallest `n >= 2` that the store does not
   hold. If the result fails `ITERATION_ID_PATTERN` (`src/refrain/allocator.ts:59`) or `n` passes
   `99`, **nothing is minted and nothing is recorded**, and the report names
   `rondo propose --successor-id` as what a person types instead. rondo never truncates a name to
   make one fit.

7. **`D-0019` rule 3 is not overridden, because it does not reach this.** Its words are about the
   conductor's interface -- *"the caller passes a complete `RunPlan`; rondo gains no allocator"* --
   and its stated reason was that the missing allocator was an undecided decision. `D-0023` took
   that decision: rondo has an allocator, and the run id, the topic branch and the workspace are
   derived from the iteration id rather than typed beside it. What survives of rule 3 is that
   `admit()` takes its identifier from its caller, and that is untouched here: an automatic proposal
   composes a **candidate** id, `admit()` is not called, and the id becomes an identifier only when
   a person approves the digest that contains it. **Under this entry rondo proposes an id and a
   person adopts one.**

   **The narrowing is real and is written down rather than argued away.** Before this entry every
   iteration id in rondo's store was typed by a person. After it, one class of id is rondo's
   suggestion. If a later reader holds that rule 3 and rule 6 collide anyway, **this entry takes
   precedence for ids minted for an `abandoned`-triggered proposal and nowhere else**; rule 3 stands
   over every other identifier rondo handles.

8. **A successor id taken between the proposal and the admission fails closed, with no new
   mechanism.** The iteration id is the `iteration` table's primary key, `proposeRetry` already
   refuses a successor the store holds (`advisory.ts:1245-1256`), and `D-0022` rule 17's comparison
   of the approved digest against the classification refuses an admission whose grantee moved. Three
   refusals, all of them already decided.

9. **The write is unaccompanied, and writes no attention row.** `D-0042` settled that a presentation
   is a person's act and not a rendering; here there is not even a rendering, so the trigger records
   a `proposal` and writes no `operator_attention`, moves no last-look mark, and counts nothing.
   `D-0022` rule 18's order -- record before showing -- is kept in the only way it can be kept when
   nothing is shown.

10. **The automatic proposal's id is derived and carries no clock**, unlike the operator door's
    `${kind}-${successorId}-${now}` (`advisory.ts:1271`). A second attempt to record the same
    proposal about the same subject collides on the primary key and writes nothing, which is the
    whole of the idempotence this needs.

11. **A trigger that cannot do its work never changes the lap's outcome.** The terminal transition
    is committed before `admit()` returns; whatever the trigger could not do is appended to the
    report's lines and never thrown. **The lines go into the report and not to stdout**, because the
    surface that called `admit()` may not be a terminal.

12. **Nothing in `src/` changes on this entry.** The implementation is a separate pull request, in
    the order rule 3, rule 6, rule 4.

### What this does not do

- **It does not close rondo#105's chain.** Nothing consumes an approved decision -- `D-0022`
  rule 17's digest comparison at admission is still unbuilt -- so an approved automatic proposal
  starts no retry. What this entry closes is the *proposal* half: after it, a stop leaves something
  in the ledger a person can answer, which is what the issue measured as absent.
- **It does not push anything at anybody.** The row is reachable where every other proposal is
  reachable; no notification, no mail, no pane.
- **It does not widen the advisory.** `propose`, `proposeContractKeys` and the gatherers are used as
  they are; the new code is a minting rule and a call.

### The argument this leaves open

**Whether rondo should draft with nobody asking.** `D-0022` rule 19 made "approved and never spent"
answerable because route C's concessions made it load-bearing. This entry creates the other half --
*drafted and never looked at* -- and does it on rondo's own initiative. The only bound taken against
it here is rule 5's: no row when there is nothing to choose between. Whether a cap per subject, per
day or per store is needed is left open on purpose, for whoever first opens an inbox they did not
want. It is not closed here because nothing has yet run long enough to say what the rate is.

### Residuals, with who decides

| Residual | Why not here | Who decides |
|---|---|---|
| `closed` without an answer as a second trigger | A withdrawal is a person's act and an expiry is a clock; neither says the plan was wrong, and the predicate already exists | whoever first wants a proposal after an expiry |
| Which kind to emit once a store has a lineage | `agent_type`'s option set stops being degenerate as soon as a second iteration exists; this entry fixes one kind because the measured store has one row | the entry that first reads a store with lineage |
| A cap on unspent drafted proposals | No rate has been observed; a threshold chosen before the measurement is a number nobody can defend | whoever first measures one |
| The report line a page cannot read | Rule 11 puts the trigger's own outcome in the report's lines, and `D-0042`'s residual about `sayAdvisoryOutcome`'s exit status is the same shape one layer down | whoever first shows the trigger's outcome on the page |

### What would falsify it

- **A person answers the automatic proposal and the retry it authorises is not the one they meant.**
  That falsifies rule 4's claim that `contract_keys` is the useful kind at this ending, and the
  answer is the kind rule 4 set aside rather than a second proposal beside it.
- **The `proposal` table fills with rows nobody ever decides.** Rule 5's bound is then not a bound,
  and the open argument above stops being open: a cap is needed, and the rate is the measurement
  that says which one.
- **A minted `-r<n>` id collides with one a person meant to use.** The collision itself is refused
  (rule 8), so what this falsifies is the *naming*: it would mean rondo's suffix is in a namespace
  operators write by hand, and the derivation has to move to one they do not.
- **An ending that is not `abandoned` turns out to be where people actually want this.** Rule 1 is
  then too narrow, and the measurement is which endings operators run `rondo propose` after -- which
  the `proposal` rows' subjects answer directly, since each names its iteration.
- **`admit()` acquires a second caller and the required argument is a nuisance rather than a
  guard.** Rule 3's type-level enforcement would then be paid for by every caller and used by one,
  and the trigger moves to a wrapper the surfaces share.

---

## D-0044 — The second model tier is `mechanical`, it is reached by naming an agent type and never by rondo reading a request, and its model id waits on rondo recording what a lap costs

**Status:** accepted (2026-09-12, rondo's human gate). Refs rondo#89, rondo#96, `D-0021`.

`MODEL_TIER_TABLE` (`src/continuo/roles.ts`) has one row, `standard -> claude-opus-5`, so every lap
runs on the most expensive model whatever it is doing. `D-0021` rule 3 built the table and said the
pairs are provisional; rondo#89 is the observation that one row means the provision is unusable, and
it says in its own words that the blocker is not the edit but the policy: *a tier table with a second
entry needs someone to decide which work goes to which tier*. This entry is that decision.

**It supersedes nothing.** `D-0021` rule 3's shape -- one module, two independent tables, an unpriced
tier refused before the spawn -- is what makes a second row a three-line edit, and rules 4 and 5
(the model continuo reports is checked and persisted beside the tier requested) are what make a
second row auditable. This entry adds the policy those rules were built to carry, and one gate on
when the row may be written.

### What the four measured laps actually say

The spread the issue points at is real and is **not** a spread in difficulty:

| | lap 2 | lap 3 | lap 4 | lap 5 |
|---|---|---|---|---|
| `total_cost_usd` | 1.032 | **7.062** | 2.055 | 1.542 |
| turns | 29 | **95** | 43 | 38 |
| duration | 121.8 s | **724.4 s** | 253.6 s | 203.3 s |
| refused Bash calls | 4 / 29 | 10 / 69 | **18 / 36** | 5 / 29 |

[`lap-3-dogfood.md`](docs/operations/lap-3-dogfood.md) section 5 separates the 6.8x itself, and
neither half is judgment: the work was bigger (`+355 -7` against lap 2's `+16 -4`), and **the fence
charged for itself** -- seven refused calls spent trying to see one screen, bought in the end at the
price of five full suite runs. Lap 4's cost is half lap 3's on half the refusal count and a seventh
of the diff. What the four laps vary in is **volume and friction**, and cost tracks turns, not the
density of the decisions inside them.

That matters for this entry in one direction and it is the uncomfortable one: **turns are the
dominant term, and a cheaper model buys turns back only if it does not spend more of them.** A lap
that re-reads a file because it lost the thread, or retries a fence refusal it did not understand,
pays the friction again at a lower unit price. Nothing rondo has measured says which way that lands,
because rondo measures none of it (rondo#96, and rule 5 below).

### Why this organisation's split does not transfer

claude-org-ja runs a lead on a high tier with assistants on a middle one, and reserves the top tier
for the most judgment-dense writing. That split works because the *unit* it splits is a step inside
one piece of work. **rondo's unit is the whole lap.** One lap reads the request, plans an edit,
writes it, runs the verification, reads the exit status, commits, and composes what the person at the
gate will read -- on one model, chosen once, before the spawn. There is no seam inside a lap at which
a cheaper executor could take the mechanical half and hand the judgment back.

So the question "is this work mechanical?" has to be answered about the **entire arc**, and the arc's
last step is the one a person's approval rests on. Lap 5 is the standing warning: that lap reported
`EXIT=1`, attributed it confidently to a pre-existing defect, and **was wrong about its own failure**
-- at the top tier. The account a lap gives of itself is judgment, it is in every lap, and it is the
part the gate cannot cross-check cheaply.

### Decision

1. **Two tiers, and the axis is verifiability of the whole arc -- not speed, not price.**
   `standard` keeps its meaning and its model. The second tier is `mechanical`, and it means: *every
   step of this lap's arc, including the account the lap gives of its own work at the gate, can be
   checked by something other than a person's reading.* Price is a consequence of that property and
   never the reason for the name, because a tier named for its price invites the question "can we
   afford the cheap one here", which is the question this entry exists to stop being asked per lap.
   Concretely, `mechanical` is for work where the request names the files, the change is bounded, and
   `npm run verify` passing is the whole of the acceptance -- lap 2's three-file wording repair is the
   measured example. Anything whose acceptance includes *reading what the lap decided* is `standard`.
2. **A tier is chosen by choosing an agent type. rondo never chooses, and neither does the person
   writing the request -- per request.** The tier already lives on cadenza's
   `executorPolicy.modelTier` (`src/refrain/classification.ts`), which is a field of an agent type,
   and the plan names an agent type. That is the whole mechanism and it needs no new plumbing.
   - **rondo does not decide, and cannot.** Deciding would mean reading the request body to judge
     what the work is, and `D-0025` rule 5 says rondo does not infer a plan's contents; the plan file
     is the whole of the configuration. rondo's job here is `D-0021` rule 3's: price the tier it is
     handed, or refuse before the spawn.
   - **There is no per-request tier override, and no `--model-tier` flag.** A tier attached to a
     request is a judgment made once, under time pressure, by whoever happened to be typing; a tier
     attached to an agent type is a judgment made once about a *kind* of work and reviewed with the
     agent type. The second is the only one of the two that can be wrong in a way anybody notices.
   - **Today both hats sit on one head, and that is stated rather than hidden.** The agent type is
     inline in the plan (`agentTypeInput`, `scripts/dogfood-env.sh` writes `worker-basic` with
     `modelTier: "standard"`), so the person writing the plan is also the person declaring the agent
     type. What keeps rule 2 honest under that shape is that the tier travels with the *identity*:
     `worker-basic` means one tier, and a plan that gives `worker-basic` a different tier is a
     different agent type wearing a known name -- visible as a different `agentTypeDigest` on the
     row, and a thing to notice. When agent types move into a catalog, the author declares and the
     requester only names, and this rule is already written for that day.
3. **`standard` is the default and the fallback direction is up.** An agent type that says nothing
   gets `standard`; an unpriced tier is still refused before the spawn (`D-0021` rule 3, unchanged).
   Nothing may route a lap to `mechanical` by inference, by absence, or by a global setting.
4. **A wrong tier is recoverable, the recovery is a whole lap, and the asymmetry is why rule 3 points
   up.** Too expensive wastes the difference between two tiers on one lap. Too cheap wastes the lap:
   `D-0027` makes "revise" a second lap with fresh identifiers, so the recovery costs a full lap at
   the tier that should have run in the first place, plus the human's read of the bad one. At the
   measured $1.03--$7.06 per lap, a mis-routed lap costs more than a correctly-routed expensive one.
   The failure that is *not* recoverable by a second lap is the one lap 5 showed: a lap that is wrong
   about its own work and says so plausibly. That is the failure `mechanical`'s definition is drawn
   to exclude, and it is why the definition is about the arc and not about the diff.
5. **No pair is added to `MODEL_TIER_TABLE` until rondo records what a lap costs (rondo#96).** The
   whole case for a second row is a saving, and rondo persists neither `total_cost_usd` nor
   `num_turns` nor `duration_ms` -- five dogfood records have parsed them out of `events-000.jsonl`
   by hand. Adding the row first would mean choosing a model id against numbers nobody can read back,
   and then being unable to tell whether it helped: the section above says the dominant term is turns,
   and a cheaper model that spends more of them is the outcome this gate exists to catch. `D-0021`
   rule 3 already says the concrete ids are the operator's to ratify; this rule says what the
   operator ratifies *against*. It is a gate on the pair, not on the policy -- rules 1--4 are in force
   now, and the day #96 lands the second row is an edit and a test.
6. **A `mechanical` lap is accepted at the same gate, on the same terms, and the tier is visible
   there.** The bar does not move with the tier: if the work needed a lower bar, it was not
   `mechanical`. `D-0029`'s independent reading and `D-0042`'s recorded press are unchanged and are
   already indifferent to who produced the work. What the tier is for, at the gate, is *attribution*
   -- `model_tier` and `model` are on the iteration row (`D-0021` rule 5) and `explain` prints them,
   so a run of revisions concentrated on one tier is a fact somebody can see. **A second, lower
   acceptance standard for cheap laps is refused explicitly**: it would make rule 1's definition
   unfalsifiable, because any `mechanical` lap that came out badly could be re-read as having met the
   lower bar.

### The dispute this entry does not close

**Whether `mechanical` is worth having at all.** The measurements say cost tracks turns and friction,
not the density of judgment, and the strongest reading of them is that rondo's money goes to the
fence and the size of the work rather than to the model's price -- in which case the right repair is
rondo#87 / rondo#97's family (a lap that can cheaply see its own output) and a second tier is a
distraction with a downside. This entry takes the weaker position deliberately: it settles *who
decides and on what axis*, which is the part that cannot be measured into existence, and puts the
part that can behind rule 5's gate. If #96's numbers show the model price is not the dominant term,
rule 5's gate never opens and rules 1--4 cost nothing. **A human is asked to notice that this is the
shape of the answer, not to ratify a model id.**

### What this entry does not decide

- **Which model `mechanical` is.** Rule 5 says not yet, and `D-0021` rule 3 says it is the operator's
  in any case.
- **Whether a third tier is ever wanted.** Two is what one distinction needs.
- **Where agent types live.** Rule 2 is written for both the inline shape in force today and a
  catalog, and moving them is its own decision.
- **How cost is recorded.** rondo#96 is the gate, not this entry's design.

### What would falsify it

- **rondo#96's numbers showing model price is not the dominant term in a lap's cost.** Rule 5's gate
  stays shut and the second tier is unjustified -- the dispute above resolving against this entry.
- **A `mechanical` lap being revised measurably more often than a `standard` one**, once both are
  running and cost is recorded. Rule 1's boundary is drawn in the wrong place, and rule 4's asymmetry
  is being paid for real.
- **A lap gaining sub-roles** -- an arc that splits into separately-executed steps with their own
  models. The premise under "this organisation's split does not transfer" dies, and the unit of the
  decision stops being the lap.
- **An operator wanting to down-tier one particular request rather than a kind of work**, often
  enough that refusing a per-request override reads as an obstruction. Rule 2's second bullet is the
  claim to re-argue.
- **cadenza growing a model-tier vocabulary of its own, or continuo taking a tier rather than a model
  id.** `D-0021`'s falsifiers, inherited: the table moves and rule 2's "the tier is a field of the
  agent type" is the part that survives either move.
- **A second agent type never arriving.** Rule 2 answers "who chooses" with "whoever names the agent
  type", and with exactly one agent type in existence that is nobody choosing anything; the entry
  would be a policy for a plan shape that never happened.
- The four cost figures failing to reproduce. They are `total_cost_usd` / `num_turns` /
  `duration_ms` from each lap's terminal `result` event, dated 2026-09-06 through 2026-09-12, and
  recorded in [`lap-2`](docs/operations/lap-2-dogfood.md) through
  [`lap-5`](docs/operations/lap-5-dogfood.md) section 5.

### Annotations this entry adds to earlier entries

- **`D-0021`** gains a dated annotation on that entry: rule 3's "the concrete ids are provisional,
  pending an operator's ratification" is taken up here, and its falsifier "a second tier arriving in
  an agent type before the table has a pair for it" is answered in advance -- the policy for a second
  tier exists from this date, and the pair itself waits on rondo#96.
