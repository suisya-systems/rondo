# Parallel admission: the identifier allocator and the capacity ledger

**Status: propose-only.** This document takes no decision. It measures what is in
the tree today, proposes the two things `D-0012` says parallel admission waits on
that are rondo's — an **allocator** for the identifiers a second lap needs, and a
**capacity ledger** that replaces `R-10`'s partial unique index — and ends in a
table of decision rows (`N-1` … `N-24`) for rondo's human gate. Per
[`../../AGENTS.md`](../../AGENTS.md) section 7 the rows are named rather than
settled here, and the entry the gate would create is referred to throughout as
**`D-0023`** — a name for a thing that does not exist, not a citation. Nothing in
`DECISIONS.md` changes with this document, nothing in `src/` changes until that
entry exists, and no test is added: Issue #8's third checkbox asks for
`test/refrain` cases, and [section 8](#8-the-testrefrain-plan-named-not-written)
**names** them as a plan because a case written before the gate votes is a case
that assumes the vote.

It is written in the shape of [`refrain-lap1.md`](refrain-lap1.md) and
[`advisory.md`](advisory.md): measured claims carrying `file:line`, an end-to-end
walk, a falsification section, and a decision table. Line references are to the
revisions named in [section 1.9](#19-what-was-measured-and-at-which-revisions);
they drift, and the claim rather than the number is what a later reader should
re-measure.

**This document is one half of a pair, and the other half is already merged.**
continuo #167's [`docs/design/parallel-laps-delivery-lease.md`](https://github.com/suisya-systems/continuo/blob/main/docs/design/parallel-laps-delivery-lease.md)
(merged as PR #187) proposes `continuo D-1104`, and its `P-13` fixes the boundary
in one line: *"continuo #167 owns partitioning, fencing and the two-run proof;
rondo #8 owns allocation, the capacity bound and suspend accounting."* Its `P-14`
supplies the measurement this document is designed against — of a **125.4 s**
iteration lifetime under rondo's lock, continuo's delivery lease is held for
**20.9 s (17%)** and the remaining **104.5 s (83%)** is rondo's lock across an
unbounded human wait. **This document is about the 83%.** Where it depends on
`D-1104`'s contract it says so as a decision row rather than assuming it
([section 6](#6-what-this-owes-continuo-as-dependencies-rather-than-assumptions)),
because #167 does not say that its own design stays inside one repository, and an
unstated cross-repository dependency is the thing `D-0012`'s falsifier list was
written to catch.

**It borrows #167's self-restraint as well as its shape.** `P-14` says
`D-1104` *"is not 'parallel laps now work'"*. The equivalent sentence here is
[section 7](#7-what-this-does-not-do): `D-0023` does not make two laps run at
once, does not shorten any human wait, and — on this document's own
recommendation — leaves the bound on concurrently *performing* laps at **one**
until `D-1104` lands both of its halves.

---

## 0. What this has to become, in one paragraph

`D-0012` decided single-flight for lap 1 and named what a second admission waits
on. Two of the three conditions it names are rondo's: **an allocator** for the
`(run id, topic branch, workspace)` triple, because continuo's verbs refuse on
existence and nothing mints a fresh one; and **a bound somebody sets and
something enforces**, because *"a lease answers 'who is writing', not 'how many
may run'"* (`DECISIONS.md:1052-1053`). `D-0019` rule 10 then wrote the constant
one into the schema and said the route from one to N is *"a capacity ledger, not
a wider index"* (`:2462-2477`). What this document adds to those two sentences is
the finding that **the two are not independent**: the ledger's central question —
whether an iteration waiting on a human still consumes capacity — can only be
answered *yes it may be released* if the allocator exists, because a released
slot is only safe when the next iteration cannot be handed the suspended one's
identifiers. The allocator is not a prerequisite the ledger waits on. It is the
thing that makes the ledger's interesting answer legal.

---

## 1. What is true today, measured

### 1.1 `D-0019` rule 10 names two places the constant one lives. In the schema it is right; in the tree there are six

Rule 10 says *"the index name `iteration_one_live` and `reserve()`'s refusal are
the two places the constant is burned into the schema"* (`DECISIONS.md:2472-2477`),
and adds that both carry a `rondo#8` comment *"so the replacement sites are
findable by `grep` rather than by reading this entry"*. **About the schema the
claim is exact.** About the tree it is an undercount, and the difference matters
because four of the six are types and API shapes rather than DDL, and a `grep`
for `rondo#8` does not reach them.

| # | Site | What burns the one in | Carries the `rondo#8` comment? |
|---|---|---|---|
| 1 | `src/store/sqlite.ts:322-323` | `CREATE UNIQUE INDEX iteration_one_live ON iteration(live) WHERE live IS NOT NULL` | yes (`:311-321`) |
| 2 | `src/store/sqlite.ts:434-452` | `reserve()`'s `isLiveIndexViolation` branch, which turns the index's refusal into `occupied` | yes (`:435-441`) |
| 3 | `src/store/sqlite.ts:370-375` | `readLiveRow()` runs `SELECT ... WHERE live IS NOT NULL` and calls `.get()` — **one row, singular**, and under N > 1 an arbitrary one | no |
| 4 | `src/store/sqlite.ts:147`, `:540-545`; `src/refrain/ports.ts:260` | `readLive(): Promise<ReadOutcome>` — a *total* answer about *the* live iteration. `ReadOutcome` has no plural arm | no |
| 5 | `src/store/sqlite.ts:79`; `src/refrain/ports.ts:169`; `src/refrain/interpreter.ts:180-184` | `ReserveOutcome`'s `occupied` arm carries a single `liveIterationId`, and the interpreter's refusal prose says *"at most one iteration may be non-terminal at a time"* | no |
| 6 | `src/store/sqlite.ts:645-658` | `isLiveIndexViolation` matches the driver's message against the literal strings `"iteration.live"` and `"iteration_one_live"` (`:657`) — it dies with the index it names | no |

**Site 4 is the cheapest of the six and it is worth saying why.** `readLive()` is
declared on both the store interface and the port and is called from **no module
under `src/`** — measured by grepping the whole tree: every occurrence outside the
two declarations and the one implementation is in `test/`
(`test/store/sqlite.test.ts:147`, `:154`, `:160`, `:352`, `:369`, `:402`, `:423`;
`test/refrain/interpreter.test.ts:201`). It is an API shaped for a surface that
has not been built. Changing its signature therefore costs the tests and nothing
else, which is the reverse of what a reader would guess from its position on the
port.

**A seventh site is documentation rather than code, and it must move with the
rest.** `nextStep`'s docstring says *"**`null` is 'no iteration exists yet'**, and
it is where the policy is read"* (`src/refrain/loop.ts:66`), and `admit()` calls
`nextStep(null, policy)` unconditionally (`src/refrain/interpreter.ts:131`). The
**code** is already correct under N > 1 — the argument is a literal `null`, not a
lookup — but the **sentence** is not, and a later reader who "fixed" the call by
passing the live record would move the policy read after the lock, which is the
one thing `D-0019` rule 9 exists to prevent.

### 1.2 The lock is `status IN (terminal)`, and that one predicate answers two different questions

`live` is a virtual generated column: `CASE WHEN status IN (${TERMINAL_SQL_LITERALS})
THEN NULL ELSE 1 END` (`src/store/sqlite.ts:307-310`), and the literals come from
`TERMINAL_STATUSES = ["closed", "abandoned", "failed"]` (`src/store/records.ts:103`).
So *"holds the conductor"* and *"has not reached a terminal status"* are the same
predicate, spelled once.

They are not the same question, and `records.ts` already says so in the place it
matters. `RELEASED_BY`'s docstring gives the rule that decides whether a status
keeps the lock:

> The two `*_no_answer` rows are the ones worth reading twice. A `performing`
> iteration that **received a refusal** releases the lock; one that **received
> nothing** does not. The difference is not how bad the outcome was — it is
> **whether anything might still be running** (`src/store/records.ts:125-129`).

That criterion is stated about `performing`, and `D-0019` rule 11 states it again
(`DECISIONS.md:2508-2512`). **Applied to `awaiting_human` it gives the opposite
answer from the one the schema gives**, and [section 2](#2-the-question-this-design-turns-on-does-awaiting_human-occupy-capacity)
is that argument.

### 1.3 rondo mints nothing, and one of the three identifiers is refused *after* the record exists

The plan carries all three and says so: `runId` is *"the run id, which is the
caller's to allocate (`D-0012`)"* (`src/refrain/plan.ts:91`), beside `workspace`
(`:94`) and `topicBranch` (`:96`); `runPlan()` validates their **shape** and
nothing else — `requireIdentifier`, `requireAbsolute`, `requireNotOptionShaped`
(`:337-341`). `admit()`'s own docstring closes it: *"`id` is the caller's, like
every other identifier in lap 1 (`D-0019` rule 3): rondo has no allocator, and
minting one here would be `D-0012`'s open decision taken inside an implementation
diff"* (`src/refrain/interpreter.ts:117-119`).

Where each one is actually refused, measured on the pinned continuo:

| Identifier | Refused by | When | Cost of the refusal |
|---|---|---|---|
| **run id** | `admitRun`'s `SELECT status FROM run WHERE run_id = :run_id` inside `BEGIN IMMEDIATE`, throwing `RunAlreadyAdmitted` (`src/control_plane/run_admission.ts:390-402`) | at `run admit` | nothing written; the whole block rolls back |
| **topic branch** | `branchExists(topicBranch)` → `WorkspaceMaterializationRefused`, *"materialisation creates the branch it checks out, so an existing one means two runs believe they own it"* (`src/workspace/materializer.ts:1276-1282`) | **inside `lap perform`**, after `run admit` succeeded | the run row exists at `created`, for ever |
| **workspace** | `git worktree add`'s own refusal of an existing path, reached through `addWorktree` (`:1286`) | same | same |

**This is `D-0012`'s "worse" case, measured.** The entry says the constraint *"is
not 'a second admission is impossible' — it is that a second admission with the
tuple reused cannot be run, which is worse, because it is discovered after the
record exists"* (`DECISIONS.md:1021-1024`). Confirmed: `run` carries **only**
`run_id`, `status`, `created_at_ms`, `updated_at_ms`
(`src/control_plane/migrations/0001_initial.sql:73-85`) — the branch and the
workspace are not columns of the control plane at all, so no admission-time check
of them is possible even in principle.

### 1.4 Three of the plan's paths look like identifiers and are not — measured, and recorded as denials

`cadenza C-7`'s original list counted four things a concurrent lap must allocate
and `D-0012` already removed one of them (the endpoint dropbox, on
`continuo D-0085`, `DECISIONS.md:1032-1038`). Three more are suspected by anyone
reading `RunPlan`'s absolute paths, and measurement removes all three. They are
recorded because a design that silently dropped them would look like an oversight.

- **`artifactRoot` is shared, correctly.** continuo derives a per-run
  subdirectory from it: `lapArtifactDir(artifactRoot, runId)` returns
  `join(artifactRoot, encoded)` (`src/lap/root.ts:359-401`) and the materialiser
  is handed that, not the root (`:1307`). The ownership rule that refuses an
  existing artifact — *"a path that is already there belongs to another
  materialisation"* — is over `publishedArtifactPaths`
  (`src/workspace/materializer.ts:1132-1140`), and those four paths
  (`:1087-1095`) are all under the per-run `artifactDir`.
- **`stateRoot` is shared, correctly.** The provider's per-session directory is
  `join(stateRoot, sessionId)` (`src/session/claude_cli_provider.ts:2662-2663`).
  One caveat, recorded rather than repaired: `probe-evidence.txt` is written
  directly into the root by every provider instance's probe (`:1337-1339`), so
  two concurrent laps overwrite one another's copy. The provider already treats
  that write as best-effort — *"failing to write it degrades the record, not the
  probe"* — so the cost is one degraded record, and it is named here so nobody
  discovers it as a race.
- **`interlockRoot` is shared, correctly.** Measured as a **rendered template
  value only**: the renderer substitutes it as `interlock_root`
  (`src/fencing/renderer.ts:249`) and materialisation creates no path under it.

### 1.5 The delivery lease is released when `lap perform` exits — and one path leaves it standing for a whole TTL

This is the measurement that decides how much of [section 2](#2-the-question-this-design-turns-on-does-awaiting_human-occupy-capacity)
needs continuo at all.

- **The normal path releases.** `performLap` holds the lease in a `try`/`finally`
  and `hold.stop()` runs on every path out (`src/lap/root.ts:1274`); `stop()`
  calls `release` rather than letting the lease expire, *"because `outbox-delivery`
  is one global resource"* (`src/lap/endpoint_lease.ts:343-354`).
- **The suspend happens after the process is gone.** rondo's own record:
  *"The conductor is suspending here. There is no timer and no poll loop, and the
  process may exit"*, followed by *"The process did exit, and the gate stayed
  open"* (`../operations/lap-1-dogfood.md:901`, `:905-906`).
- **So an iteration at `awaiting_human` holds no continuo lease, no process and no
  fenced child.** continuo's own document states the same fact from its side
  (`parallel-laps-delivery-lease.md` §1.9) and draws the throughput consequence in
  §10.3.
- **The exception, and it is a real one.** `HeldDeliveryLease.abandon()` stops
  renewing and **leaves the lease standing** to expire on its own
  (`src/lap/endpoint_lease.ts:375-381`), used on the teardown path where stopping
  the worker would be an act against a child a takeover writer may have adopted.
  `DELIVERY_LEASE_TTL_MS` is `60_000` (`:107`). So after a lap that took that
  path, the global resource can be withheld for up to a minute with no process
  holding it.

**The exception is not new with this design and it is not made worse by it in
kind, only in frequency.** Today the next `admit()` can only happen after the
previous iteration is terminal, which is also after its lap exited — the same
window. What changes under a raised bound is how often two admissions land inside
one 60-second window. [Section 6.3](#63-a-leaseheld-refusal-is-indistinguishable-from-a-permanent-one-at-rondos-boundary)
is what rondo can and cannot do about it.

### 1.6 Every store transaction body is synchronous, and nothing enforces it

`inTransaction` takes a **synchronous** callback and runs `BEGIN IMMEDIATE` /
`COMMIT` around it (`src/store/sqlite.ts:387-406`). Every one of the three call
sites passes a body with no `await` in it: `reserve()`'s insert (`:407-412`),
`transition()`'s read-assert-write-read-back (`:478-521`), `settle()`'s single
`UPDATE` (`:559-568`). `node:sqlite` is synchronous, so on JavaScript's single
thread **two concurrent `admit()` calls in one process cannot interleave inside a
transaction**.

That is the property the whole in-process side of N > 1 rests on, and today it is
**accidental**: the type is `<T>(body: () => T) => T`, so a body returning a
promise type-checks, `COMMIT` would run before the awaited work, and the failure
would be a torn transaction under concurrency and invisible under N = 1. Naming
it is `N-16`.

### 1.7 Nothing under `src/` opens the database, so the pragmas the store delegates have no owner

`iterationStore` takes an open connection and its docstring says *"journal mode,
busy timeout and file location are the composition root's, because they are
deployment facts and this module is a schema"* (`src/store/sqlite.ts:353-360`).
Measured: **no module under `src/` constructs a `DatabaseSync`.** The import in
`sqlite.ts:37` is `import type`; `openConductor` receives a store already built
(`src/access/conductor.ts:275-280`); every construction in the tree is a test's
`new DatabaseSync(":memory:")` (`test/store/sqlite.test.ts:56`, `:292`, `:313`,
`:336`, `:360`, `:373`), and the dogfood procedure hands the choice to the
operator — *"its path is yours to pick"* (`../../scripts/dogfood-lap.md:76-79`).

So the responsibility is delegated to a composition root that does not exist yet,
and **no test has ever run the store against a file**, which is why no test could
have observed `SQLITE_BUSY`. That matters here specifically: `BEGIN IMMEDIATE`
against a busy database raises, `transition()`'s `catch` reports it as
`{ kind: "defect" }` (`src/store/sqlite.ts:528-530`), and a busy database is a
**retry**, not a defect. Under one process this is unreachable. It becomes
reachable the moment a second host process exists, which is a topology this
document does not propose but does not forbid either.

### 1.8 A refusal at capacity leaves no trace, so the bound cannot be set on evidence

`admit()`'s `occupied` branch pushes two lines and returns
`{ iterationId: null, status: null }` — **no row is written**
(`src/refrain/interpreter.ts:176-186`). That is right under N = 1 and for
`D-0019` rule 9's reason: a refusal that costs no row and takes no lock is the
cheap kind. F-13 measured the cost at **1 ms**
(`../operations/lap-1-dogfood.md:1201-1207`).

The same property makes the thing `D-0012` asks for unmeasurable. Its falsifier
list ends with *"**Measured throughput making single-flight the binding
constraint** on real work — the evidence the future ledger would be designed
on, arriving"* (`DECISIONS.md:1064-1066`). F-13 supplies the **shape** — the lock
is held for `lap + human`, the second term is unbounded, *"the lap is not the
contended resource; the human is"* (`:1225-1228`) — and it does **not** supply the
**demand**, because nobody has yet been refused work they actually wanted done.
Demand is exactly what a refusal record would count, and nothing counts it.
`N-14` is that.

### 1.9 What was measured, and at which revisions

| Tree | Revision | What was read |
|---|---|---|
| rondo (this worktree) | `3d2a39b` | `src/store/sqlite.ts`, `src/store/records.ts`, `src/refrain/{loop,plan,policy,interpreter}.ts`, `src/access/conductor.ts`, `src/continuo/protocol.ts`, `DECISIONS.md`, `docs/design/advisory.md`, `docs/operations/lap-1-dogfood.md`, `scripts/dogfood-lap.md`, `test/` |
| continuo | `38c667b` — the pinned revision (`continuo.pin.json`) | `src/control_plane/{run_admission,migrations/0001_initial.sql}`, `src/workspace/materializer.ts`, `src/lap/{root,endpoint_lease}.ts`, `src/session/claude_cli_provider.ts`, `src/fencing/renderer.ts` |
| continuo | `8a0ebab` — `origin/main`, PR #187 | `docs/design/parallel-laps-delivery-lease.md` (`P-13`, `P-14`, §1.9, §10.1-10.3, §13) |
| cadenza | `5d5d9f4` (`cadenza.pin.json`) | not read directly; reached through `advisory.md`'s measurement of `A-17` |

**The pin is not moved by this document and does not need to be.** `D-1104` does
not exist yet; when it does, moving the pin is `D-0017` rule 4's edit and a green
matrix, not a decision (`continuo.pin.json`'s own `$comment`).

---

## 2. The question this design turns on: does `awaiting_human` occupy capacity?

Issue #8's fourth comment puts it as a question rather than a requirement:
*"should `awaiting_human` hold the lock at all, given the `lap perform` process
has exited, no worker of the iteration is running, and the row is durable?"*
This document answers it, because every other choice below follows from the
answer.

### 2.1 The design's own criterion already answers it, and the schema disagrees with the criterion

The criterion is `records.ts:125-129` and `D-0019` rule 11: a status keeps the
lock according to **whether anything might still be running**. Apply it to each
non-terminal status, using §1.5's measurement:

| Status | Is anything of this iteration running? | Criterion says |
|---|---|---|
| `planned`, `classified` | no process, but the interpreter is mid-`drive()` and the next edge spawns | hold |
| `admitting` | `run admit` is in flight | hold |
| `admitted` | nothing running, but `perform` is the immediate next edge | hold |
| `performing` | a fenced child may be alive; rondo's timer kills the CLI and not the child (`D-0019` rule 12) | hold |
| **`awaiting_human`** | **nothing. The process exited (`dogfood:905-906`), the lease was released (`endpoint_lease.ts:343-354`), the child is gone** | **release** |
| **`withdrawal_requested`** | **the same state plus an ask sent to another surface (`D-0013`)** | **release** |
| `stalled` | *unknown by definition* — a corrupt row, an outcome the union does not cover | hold, fail-closed |

So the schema and the criterion disagree on exactly two statuses, and they are
the two that hold **83% of the measured lifetime**. The disagreement is not a bug:
`live` was written to answer one question and is being asked a second one.
**One predicate, two questions** is the shape continuo's `P-8` found in
`UNOWNED_OUTBOX_QUERY` and split for the same reason.

### 2.2 What releasing the slot costs — and why the allocator is its precondition, not its prerequisite

A suspended iteration owns things that outlive its process: a worktree, a topic
branch, an open continuo run at `created`, and an open gate. F-11 records that
the lap *"leaves a worktree, a branch and an open run behind"*
(`../operations/lap-1-dogfood.md:546-575`). Releasing its capacity slot therefore
does **not** release those, and a second iteration admitted into the freed slot
must not be handed any of them.

Under lap 1 that is unenforceable, because the triple is the caller's
(§1.3) and rondo has no way to know what it already handed out. **This is the
coupling that makes the two halves of `D-0023` one entry rather than two**: the
interesting answer to §2.1 is legal only if the allocator both mints and
*remembers*. It is not that the ledger waits on the allocator; it is that without
the allocator the ledger has only the boring answer available to it.

### 2.3 Two bounds, not one — and only one of them waits on continuo

If capacity is released at `awaiting_human`, a single number can no longer express
the bound, because the two things worth bounding have different owners and
different reasons:

- **`maxOccupying`** — iterations whose `occupying` is non-null, which is
  **every non-terminal status except `awaiting_human` and `withdrawal_requested`**:
  `planned`, `classified`, `admitting`, `admitted`, `performing` and `stalled`.
  This bounds concurrent `lap perform` processes, and it is the bound `D-0012`'s
  third reason is entirely about: continuo refuses a second concurrent lap
  `LeaseHeld` (`DECISIONS.md:1040-1052`). **Recommended value: 1, until
  `continuo D-1104` takes both of its halves.**
- **`maxLive`** — non-terminal iterations of any status. This bounds the leak
  §2.2 names: worktrees, branches, open runs, and open questions in front of a
  person. **Recommended: an operator-set value that may exceed 1 today**, because
  §1.5 measures that a suspended iteration holds no continuo resource.

**The name is `maxOccupying` and not `maxPerforming`, and the rename is a
finding rather than a preference.** The first draft of this section called it
`maxPerforming` and defined it over `admitting`/`admitted`/`performing` alone —
a set narrower than §2.1's table, which is the set the column is generated from.
A Codex review of the committed draft showed what the narrower set costs: with
`maxLive > 1`, two `admit()` calls can both commit a `planned` row, neither is
counted, both pass a bound of one, and both go on to perform. `stalled` was
excluded by the same slip, which would have contradicted §2.1's fail-closed rule
in the one state that exists because rondo does not know what is running.
**The bound and the column are one definition, given once in §2.1**, and the name
now says so; a bound named after the last status in its set is a bound somebody
will narrow again.

**`maxLive >= maxOccupying` is a validated constraint, not a convention**
(`N-8`). A host policy that set them the other way round would have `maxLive`
refuse admissions the execution bound was willing to run, which is a
configuration that cannot be satisfied rather than one that is merely tight.

**The two-bound shape is what makes the 17% / 83% split actionable rather than
merely quoted.** `maxOccupying` is the 17% and it is continuo's to unlock;
`maxLive` is the 83% and it is rondo's, and it is unlocked by a rondo-only change.
That is `P-13`'s boundary, arrived at from rondo's side and agreeing with it.

**The single-bound alternative, stated fairly, because the gate may prefer it**
(`N-8`). One number over `live`, exactly as today with the constant raised.
Simpler: one counter, one column, no new generated column, and the `RELEASED_BY`
table needs no second reading. Its cost is that sizing one thing sizes the other:
a bound of 5 chosen so that a person may have five open questions also authorises
five concurrent laps, and there is no way to say "five open questions, one lap" at
all. Under the recommendation the gate can also *choose* the single-bound
behaviour by setting `maxLive == maxOccupying`; under the alternative it cannot
choose the other way round. That asymmetry is the argument, and it is the whole of
it — the two-bound form is strictly more expressive at the cost of one more number
an operator has to understand.

---

## 3. The allocator

### 3.1 What it allocates

**Three values, and §1.4 is why it is three and not six.**

| Value | Uniqueness domain | Lifetime of the claim |
|---|---|---|
| `runId` | one control plane | for ever — `run` rows are never deleted and the status trigger is forward-only (`0001_initial.sql:88-110`) |
| `topicBranch` | one repository | for ever — a merged or deleted branch still occupied the name, and `branchExists` is the only authority |
| `workspace` | one filesystem | until the worktree is removed, which is an operator's act (F-11) |

`leaseClaimantId` is deliberately **not** on the list as a *requirement*: nothing
measured requires it to be fresh per run, and two runs may legitimately name one
claimant on two different lease resources. It is on the list as a
**recommendation** (`N-6`): derive it from the run id anyway, because it is the
holder recorded in continuo's audit trail, and a constant holder across N
concurrent laps makes that trail unable to say which lap wrote.

**"For ever" is the load-bearing word.** A claim is not a lock and is never
released — not at a terminal status, not when the operator removes a worktree. The
allocator's memory answers *"has rondo ever minted this?"*, and answering *"is it
in use now?"* instead is how a design reissues a branch name that a merged pull
request still owns.

### 3.2 From what evidence — and why neither candidate is sufficient alone

**Candidate A: derive the triple from the iteration id.** `runId =
"rondo-" + iterationId`, `topicBranch = "rondo/" + iterationId`, `workspace =
join(workspaceRoot, iterationId)`. Pure, no I/O, testable by handing it a string,
and invertible, so an operator reading a branch name knows the iteration. Cost:
uniqueness rests entirely on iteration-id uniqueness, and **the branch namespace
is not rondo's alone** — a person may have created `rondo/iter-005` by hand, and
that collision is still discovered at materialisation (§1.3), after the run
exists.

**Candidate B: allocate against observed state.** Query the `run` table, run
`git branch --list`, `existsSync` the workspace, mint, retry on collision. Cost:
three time-of-check/time-of-use windows that the retry does not close; three
external reads on the admission path, two of them across the process boundary
`D-0015` guards; and it is *still* not authoritative, because continuo's and
git's own checks remain the authority. **It buys an earlier refusal and no
guarantee.**

**Recommended: A, plus a durable claim, and B rejected as a pre-flight**
(`N-3`, `N-4`). Derivation gives the mapping; the durable claim gives the memory
§2.2 requires; and the pre-flight query is not taken because paying three I/O
reads for a check that is still not authoritative is the wrong trade. The
collisions rondo *causes* become impossible; the collisions rondo *did not cause*
keep being refused where they are refused today, and §3.5 says what the refusal
must then look like.

### 3.3 The claim is stored, not derived — because `advisory.md`'s `A-17` says a retry inherits

Pure derivation would be enough if every iteration minted a fresh triple. It does
not, and the exception is already in the tree:

> **Proposal (`A-17`): on route S the retry reuses the predecessor's `(run id,
> topic branch, workspace)` rather than allocating a fresh one, and that is sound
> precisely because nothing was ever admitted** — `D-0019` rule 15 stops a
> `needs_approval` **before** admission, so continuo holds no run under that id,
> no branch was created and no workspace was materialised. The triple is unused,
> not spent (`advisory.md:714-721`).

`A-17` reaches that from a measurement this document does not re-derive and does
depend on: a successor may not change its grantee, and a contract's grantee *is*
the run id — which rondo spells at its own boundary in
`runPlan()` (`src/refrain/plan.ts:475-480`, cited by `advisory.md:706-711`). A
retry under a *fresh* run id would classify `grantee_mismatch` against the very
successor a human had just approved.

So an inherited triple is **not** a function of the inheriting iteration's id, and
Candidate A alone cannot express it. The triple must be **durable on the row**.

**Where it goes (`N-5`): three columns on `iteration`, not a fourth table.**
`run_id` is already there and nullable (`src/store/sqlite.ts:290`); add
`topic_branch` and `workspace` beside it, written by `reserve()` in the same
`BEGIN IMMEDIATE` that writes the row. A separate `allocation` table would hold
exactly one row per iteration with a foreign key to it, which is a table shaped
like a column.

**How the uniqueness is enforced, and how inheritance stays legal (`N-7`).** Three
partial unique indexes over a second generated column:

```sql
holds_identifiers INTEGER GENERATED ALWAYS AS (
  CASE WHEN status IN (<terminal>) AND identifiers_spent = 0 THEN NULL ELSE 1 END
) VIRTUAL
```

with `identifiers_spent INTEGER NOT NULL DEFAULT 0`, set to `1` by the one
transition that enters `admitting` and by nothing else. Then:

- a **live** row holds its triple, so no concurrent iteration can be handed it;
- a **terminal, spent** row keeps holding it for ever — the branch exists, the run
  exists, and §3.1's "for ever" is enforced rather than promised;
- a **terminal, unspent** row releases it — which is exactly `A-17`'s *"unused,
  not spent"*, expressed as a column instead of as prose.

This is `R-10`'s **shape B** applied a second time, deliberately: a named
generated column a reader can `SELECT`, with the terminal set written once
(`DECISIONS.md:2458-2461`). `iteration_one_live` is the precedent that the idiom
works on this driver.

### 3.4 What this does to `RunPlan`, and therefore to `D-0019` rule 3

If rondo mints the triple, the caller must stop supplying it, or there are two
authorities for one fact. **Recommended (`N-9`): `runId`, `topicBranch` and
`workspace` leave `RunPlan` and are replaced by one `workspaceRoot`**, from which
`workspace` is derived; the run id and topic branch are derived from the iteration
id. `runPlan()`'s three shape checks (`plan.ts:337-341`) move onto the allocator's
**output**, where they are checks on rondo's own construction rather than on an
operator's typing — which is a smaller job, not a larger one.

**This is a change to `D-0019` rule 3 and must be recorded as one.** Rule 3 is
*"rondo gains no allocator and no configuration layer in lap 1"*, and
`plan.ts:5-14` names the allocator as one of exactly two things it was avoiding.
`D-0023` does not supersede rule 3; it fires the condition rule 3 named. **The
second thing rule 3 avoided — defaults for a fence's geometry — stays avoided**,
and `N-9` says so explicitly, because the natural next sentence after "rondo now
mints three fields" is "so let it default the other twenty-eight", and that is a
different decision with no measurement under it.

The cost, stated: `parties.grantee` must equal `runId`
(`src/refrain/plan.ts:215-222`, `:475-480`), so a caller who no longer writes
`runId` cannot write `grantee` either. Either the plan drops `grantee` too and the
allocator fills it, or the caller writes a value it cannot know. **Recommended:
the allocator fills it, and `runPlan()`'s equality check stays** — it becomes an
assertion about rondo's own two writes, which is where it can never fail silently.

### 3.5 The refusal a collision rondo did not cause must produce

Derivation plus a claim makes rondo's own reuse impossible; it does not make a
hand-created `rondo/iter-005` impossible. That collision is still discovered at
materialisation, after `run admit` succeeded (§1.3), and it is a **`failed`**
iteration with a spent run id.

**Recommended (`N-10`): the allocator retries on a *derived* collision it can see
and refuses on one it cannot.** Deriving from the iteration id means the operator
can settle it by abandoning and admitting again under a new iteration id, and the
refusal must say that in words rather than reporting continuo's sentence about
branches. What it must **not** do is loop: a retry that keeps minting is a retry
against a namespace rondo does not own.

---

## 4. The capacity ledger

### 4.1 Why the index cannot generalise, and what replaces it

A unique index expresses "at most one" and nothing else — `UNIQUE(live)` over a
column whose only non-null value is `1` is a bound of one by construction. There
is no "at most N" index. `D-0019` rule 10 already says the route is *"a capacity
ledger, not a wider index"* (`DECISIONS.md:2462-2465`); this section says what
that costs, because rule 10 does not.

**What is given up is that the invariant stops being the database's.** Today a row
inserted from outside the code — `sqlite3` on the file, a hand-edited migration —
cannot violate single-flight, because the index refuses it. Under a counted bound
the invariant lives in `reserve()`'s transaction, and an out-of-band insert
violates it silently. That is a real loss and rule 10's own words
(*"making 'at most one non-terminal iteration' the **database's** invariant"*,
`:2451-2453`) are what is being spent.

### 4.2 Two shapes, and the issue's own second checkbox picks one

**Shape 1 — a counting predicate inside `reserve()`'s `BEGIN IMMEDIATE`
(recommended, `N-11`).**

```sql
SELECT COUNT(*) FROM iteration WHERE occupying IS NOT NULL
```

read inside the transaction the insert happens in, refusing when the count is at
the bound — **both counts, `occupying` and `live`, in the same transaction as the
insert**, because a bound checked in one transaction and enforced in another is
the deferred-transaction window `sqlite.ts:378-392` already rejects, one level
up. `BEGIN IMMEDIATE` is what makes it atomic, and `sqlite.ts:378-392`
already argues exactly this point for `reserve()` — *"under a deferred transaction
the write lock is taken at the first write, which leaves a window in which two
readers have both decided they may proceed"*. The bound is a **value the ledger
reads**, which is Issue #8's second checkbox verbatim.

**Shape 2 — a slot table.** `CREATE TABLE slot (slot_no INTEGER PRIMARY KEY,
iteration_id TEXT UNIQUE REFERENCES iteration(id))`, seeded with N rows; reserving
is claiming a free slot. This **keeps** §4.1's property — N + 1 occupants is
impossible because there are only N rows — and it is the honest answer to what
Shape 1 gives up. Its cost is that the bound becomes a row count: changing it is a
data migration under a lock, an operator lowering it below the current occupancy
has to decide what happens to the excess, and the issue's *"not a structural
property of the schema"* is at best narrowly satisfied.

**Recommended: Shape 1, with the loss recorded rather than argued away.** The
issue asked for a policy value; a slot table is a policy value spelled as rows.
The gate may prefer Shape 2 and should be told what it buys back.

### 4.3 Who sets the bound — and it is emphatically not `LoopPolicy.maxIterations`

**`LoopPolicy` is the wrong home, measured.** `admit()` takes a policy **per call**
(`src/refrain/interpreter.ts:124-128`), so a bound placed there is a bound each
request states about the whole host, and "the bound" becomes whichever caller
arrived. A host-wide limit that any request may restate is not a limit.

**`maxIterations` is not this number and the confusion is one rename away.**
`LoopPolicy.maxIterations` is *"a hard ceiling on iterations before the loop stops
and asks"* (`src/refrain/policy.ts:23-24`) and it is compared against **a fresh
iteration's zero attempts** at admission (`src/refrain/loop.ts:154-169`,
`D-0019` rule 9). It bounds **retries of one request**; the capacity bound limits
**concurrent requests**. They are different axes with different owners, and
`CONSERVATIVE_POLICY`'s `maxIterations: 1` (`policy.ts:34-37`) must not quietly
become a concurrency bound of one.

**Recommended (`N-12`): a `HostPolicy`, read once at the composition root and
handed to the store.** `openConductor` (`src/access/conductor.ts:275-296`) is
where the operator's deployment facts already belong — it is the same module
§1.7 says owes the connection's pragmas — and one process, one bound is the shape
that makes the number mean something.

**The successor is named and not taken (`N-13`).** A resident host that must be
restarted to change its own concurrency is a poor resident host, so the durable
form — an operator row rondo's web UI edits — is where this ends. It is
**`D-0020`'s** surface, not this entry's, and taking it here would be settling an
operating-surface decision inside a scheduling one.

### 4.4 The refusal has to be recorded, or the bound can never be set on evidence

§1.8 measured that a capacity refusal writes nothing. **Recommended (`N-14`): a
refusal row — timestamp, the request text, the bound in force, and the occupancy
observed — written outside the iteration table and outside any lock.**

Three things make this more than telemetry:

1. It is the **demand** measurement `D-0012`'s last falsifier asks for
   (`DECISIONS.md:1064-1066`), and no other artefact in the tree can produce it.
   F-13 gives the shape; only this gives the count.
2. It must **not** reserve an iteration, or the refusal costs a row and a lock,
   which is the property `D-0019` rule 9 and F-13's 1 ms both rest on.
3. It is the only way to tell a bound that is **binding** from one that is merely
   **set**, which is the difference between raising it on evidence and raising it
   on the fact that somebody complained.

### 4.5 The closed list of what changes together

Naming it closed is the point: a partial change leaves a tree that says "at most
one" in some places and "at most N" in others.

| Site | Change |
|---|---|
| `sqlite.ts:307-310` | `live` stays; **`occupying` is added** as a second generated column, `NULL` for a terminal status **and** for `awaiting_human` / `withdrawal_requested`, and `1` otherwise — §2.1's table is its only definition, and `maxOccupying` counts exactly it (§2.3) |
| `sqlite.ts:322-323` | `iteration_one_live` is **dropped**; the count in `reserve()` replaces it |
| `sqlite.ts:434-452` | the `isLiveIndexViolation` branch becomes the counted refusal |
| `sqlite.ts:645-658` | `isLiveIndexViolation` is **deleted** — it matches an index name that no longer exists |
| `sqlite.ts:79`; `ports.ts:169` | `occupied { liveIterationId }` becomes `atCapacity { occupancy, bound }`; naming one blocking row is no longer meaningful |
| `interpreter.ts:180-184` | the refusal prose stops saying *"at most one"* and states the bound and the occupancy |
| `sqlite.ts:147`, `:540-545`; `ports.ts:260` | `readLive()` becomes plural; §1.1 measured it has **no** production caller |
| `sqlite.ts:370-375` | `readLiveRow()`'s `.get()` becomes `.all()` |
| `sqlite.ts:568` | `settle()`'s `live IS NOT NULL` guard — **stays `live`, not `occupying`**; it exists to refuse overwriting a finished outcome, which is a question about the row's own lifecycle |
| `loop.ts:66`, `:87-89`; `interpreter.ts:131` | the docstrings of §1.1's seventh site |
| `loop.ts:20-27` | *"`iterate` is gone … It returns with the allocator"* — see `N-19` |
| `records.ts:117-139` | `RELEASED_BY` gains no rows and loses none; the second reading §2.1 gives it is added to its docstring |

**`settle()`'s guard is the one line in the table that must not be changed, and
that is why it is in the table.** It reads `live`, and under a two-bound design a
reader "completing" the migration would move it to `occupying` — after which
`abandon()` on a suspended iteration would overwrite a `closed` row's outcome. The
line is listed so that leaving it alone is a decision somebody took.

---

## 5. One admission, end to end, with `maxLive = 3` and `maxOccupying = 1`

The walk that makes the two bounds concrete. `iter-A` is at `awaiting_human` with
a gate open; a person is reading it.

1. **`admit()` for `iter-B`.** The policy is read against a fresh iteration
   (`nextStep(null, policy)`, unchanged). The allocator derives
   `run-B` / `rondo/iter-B` / `<root>/iter-B` from the iteration id.
2. **`reserve()` opens `BEGIN IMMEDIATE`.** Occupancy over `occupying` is **0** —
   `iter-A` is `awaiting_human`, which does not occupy (§2.1). Occupancy over
   `live` is **1**, below `maxLive = 3`. Both bounds pass. The row is inserted
   with its three identifiers; the three partial unique indexes accept them
   because no other held row names them. Commit.
3. **`iter-B` classifies and admits.** Entering `admitting` sets
   `identifiers_spent = 1`, so `run-B` and `rondo/iter-B` are held for ever from
   this instant — including after `iter-B` ends, which is what stops a later
   iteration from being handed a branch that exists.
4. **`iter-B` performs.** `maxOccupying = 1` and `iter-A` occupies nothing, so
   this is the only lap. `lap perform` acquires the **global** `outbox-delivery`
   resource — unchanged, because `D-1104` has not landed — and `iter-A`'s lap
   released it when it exited (§1.5). No `LeaseHeld`.
5. **`iter-B` suspends at `awaiting_human`.** Its process exits. Occupancy over
   `occupying` returns to 0; over `live` it is 2. A third iteration is admissible.
6. **A person answers `iter-A`'s gate; `resume(iter-A)` observes it.**
   `transition()` asserts `awaiting_human` and writes `closed` inside its own
   `BEGIN IMMEDIATE`. §1.6 is what makes this safe while `iter-B`'s `admit()` may
   be interleaved in the same process: neither transaction body awaits.
   `iter-A`'s row is terminal and **spent**, so `holds_identifiers` stays `1` and
   `run-A` is never reissued.
7. **A fourth admission at `maxLive = 3`** is refused with the occupancy and the
   bound, writes no iteration row, takes no lock — and writes a **refusal row**
   (§4.4), which is the first durable evidence rondo has ever had that somebody
   wanted a fourth.

**What the walk shows, and it is the whole claim:** two iterations were live, one
lap ran at a time, no continuo change was needed, and the thing that was
parallelised is the **human wait**. That is `P-14`'s 83%.

---

## 6. What this owes continuo, as dependencies rather than assumptions

`P-13` draws the boundary from continuo's side. These are the places rondo's
design **depends on continuo's contract**, stated as decision rows so that a
change on continuo's side fires a falsifier here rather than a surprise.

### 6.1 `maxOccupying > 1` requires `D-1104` to take **both** halves

`rondo D-0012`'s falsifier says the enabling change is not the lifting:

> either of the two changes `continuo D-0074` names lets more than one delivery
> resource exist and thereby makes the holder identity and the serialisation a
> live question again — the lap may still take a single global lease until a
> further entry changes it (`DECISIONS.md:1057-1064`).

continuo's `P-13` answers it in one line, and its §10.2 says so explicitly. So
`N-17`: **`maxOccupying` may exceed 1 only after a `D-1104` that contains the
holder-identity half (`P-3`), not merely the column (`P-2`).** A `D-1104` that
took only the schema half leaves this number at 1, and rondo's entry should be
able to say which `D-1104` it is reading.

### 6.2 A shared `endpointDestinationDir` under N concurrent laps depends on `P-2`/`P-18`

`continuo D-0085` made the dropbox reusable, which is why `D-0012` dropped it from
the allocation list (`DECISIONS.md:1032-1038`). Under **concurrent** laps that is
not sufficient on its own: the dropbox's fence file is keyed by the **lease
resource**, and the materialiser's pre-flight reads the honoured token under the
global constant (continuo `parallel-laps-delivery-lease.md` §1.1's fifth-site
paragraph, citing `materializer.ts:1184-1204`). Under one global resource two laps
sharing a destination would fence each other out; `D-1104`'s per-run resources
make the keys per-run and the sharing safe (§8 step 4, `P-18`).

`N-18`: **rondo records that a shared destination directory across concurrent laps
rests on `D-1104`'s per-run fence keys, and that until then the safety comes from
the serialisation rather than from `D-0085`.** This is unreachable while
`maxOccupying = 1`, which is why it is a recorded dependency and not a blocker.

### 6.3 A `LeaseHeld` refusal is indistinguishable from a permanent one at rondo's boundary

§1.5 measured the 60-second window `abandon()` leaves. Retrying through it would
need rondo to recognise the refusal, and measurement says it cannot:

- continuo **does** put a class on the wire and rondo **does** decode it:
  `ContinuoResult.refused` carries `errorClass`
  (`src/continuo/protocol.ts:98`, `:804`).
- The conductor **discards it at the boundary**: `asEffect` maps a refusal to
  `{ kind: "refused", message, sessionId? }` with no class
  (`src/access/conductor.ts:102-111`), and `EffectOutcome`'s refused arm has no
  field for one (`src/refrain/ports.ts:47-67`).
- And rondo's own protocol module says the class is not a taxonomy to build on:
  *"**`error.class` is a hint, not a taxonomy.** continuo says so itself: one
  class covers several unrelated conditions, and the message is the authority"*
  (`src/continuo/protocol.ts:42-44`).

**Recommended (`N-20`): rondo does not retry, and the cost is recorded rather than
engineered around.** Building a retry on a hint continuo declines to promise is
`D-0015` rule 7's failure mode with an extra step. What rondo can do is ask
continuo for a promised refusal class for `LeaseHeld` — **named here as a question
for continuo's gate, not settled here**, since a stable refusal taxonomy is
continuo's to offer.

---

## 7. What this does NOT do

Borrowed from `P-14`'s discipline, and each line is checkable against the sections
above.

- **It does not make two laps run at once.** On this document's recommendation
  `maxOccupying` stays at 1 until `D-1104` (§6.1). What it parallelises is
  iterations *waiting on a person*.
- **It does not shorten any human wait.** F-13's 104.5 s was one operator reading
  `--help` between commands and is *"not a floor"*
  (`../operations/lap-1-dogfood.md:1215-1221`). Nothing here makes an answer
  arrive sooner; it stops one unanswered question from blocking unrelated work.
- **It does not widen `R-10` into a wider index.** It removes the index and puts
  the invariant in a transaction, and §4.1 records what that costs.
- **It does not give rondo defaults for a fence's geometry.** `D-0019` rule 3
  avoided two things and this fires only one of them (§3.4).
- **It does not add the loop's back edge.** `iterate` was removed and its
  docstring says it *"returns with the allocator, as that change's decision"*
  (`src/refrain/loop.ts:20-27`). `N-19` **declines to bring it back in this
  entry**: a retry edge is a question about `maxIterations`' dormant
  post-admission meaning (`D-0019` rule 9), and answering it here would settle a
  policy question inside a scheduling one.
- **It does not decide the multi-plane topology**, which Issue #8's second comment
  withdrew: a control plane per run *"makes the database disposable"* and scatters
  the audit record, so *"the shared plane with a per-run lease scope
  (continuo #167) is the intended end state"*. This design assumes one plane
  throughout.
- **It does not credit itself with a measurement it has not taken.** §1.8 says the
  demand number does not exist yet; `N-14` builds the thing that would produce it.

---

## 8. The `test/refrain` plan, named, not written

Issue #8's third checkbox: *"`test/refrain` cases for N > 1: ordering, refusal at
capacity, and resumption of any one iteration while others are performing."* Named
as a plan, with the property each one is actually asserting, because two of the
three are not the tests their names suggest.

**1. Ordering — and the honest finding is that rondo promises none.** Nothing in
the tree queues: `admit()` refuses immediately and returns
(`src/refrain/interpreter.ts:176-186`), measured at 1 ms (F-13). A FIFO promise
would need a durable queue, a restart story for it, and an owner — `D-0020`'s
surface — none of which exists. **So the case asserts the property that is
promised and pins the one that is not**: two `reserve()` calls racing at
`bound - 1` produce exactly one reservation and exactly one refusal (never two of
either), and a separate case records that **no ordering is promised** and
starvation is possible, so a later reader finds a decision rather than a gap.
`N-21`.

**2. Refusal at capacity.** At the bound, `reserve()` answers `atCapacity` with the
occupancy and the bound, writes no iteration row, spawns nothing, and writes one
refusal row (§4.4). **With an observed-red control**: the same call with the bound
raised by one reserves. Without the control the case passes against a `reserve()`
that refuses everything.

**And one sub-case per status, because the bound's status set is where this
design was already wrong once** (§2.3). At `maxOccupying = 1`, a row sitting at
each of `planned`, `classified`, `admitting`, `admitted`, `performing` and
`stalled` refuses the next reservation; a row at `awaiting_human` or
`withdrawal_requested` does not. Six of those eight cases are the ones a
narrower predicate would silently drop, and `planned` is the one that let two
laps through. `N-22`.

**3. Resumption of one iteration while others perform — the case that must be
`test/store` and not only `test/refrain`.** The interpreter-level assertion is
easy and weak: `resume(iterA)` neither reads nor writes `iterB`'s row. The
assertion that matters is §1.6's, and it lives at the store: **overlapping
`admit()` and `resume()` on one connection do not interleave inside a
transaction.** Two sub-cases:

- *the property*: a `transition()` and a `reserve()` driven from two interleaved
  async continuations both commit, and the second sees the first's write;
- *the guard* (`N-16`): `inTransaction`'s body may not be `async`. Today the type
  `<T>(body: () => T) => T` admits a promise-returning body, `COMMIT` would run
  before the awaited work, and **the failure is invisible under N = 1**. Enforce
  it — a runtime refusal of a thenable return, or the boundary test's own AST pass
  (`test/architecture/import-boundaries.test.ts` already parses the tree) — and
  assert the refusal.

`N-23`. And a fourth the issue does not name and the walk in §5 requires:

**4. `identifiers_spent` is set exactly once, at `admitting`, and a terminal spent
row keeps holding its triple.** With its own observed-red control: a terminal
**unspent** row releases it, which is `A-17`'s inheritance made testable. Without
this case §3.3's whole mechanism is prose. `N-24`.

---

## 9. Residuals left open on purpose, with who decides

Each says why it is out of scope **and** who decides, per this repository's rule
that an open question names its owner.

| Residual | Why not here | Who decides |
|---|---|---|
| A durable queue with an ordering promise | needs a restart story and a surface; §8 case 1 pins its absence instead | `D-0020`'s operating surface, on evidence from §4.4's refusal rows |
| The bound as a durable operator-editable row | it is a surface decision, not a scheduling one (`N-13`) | rondo's gate, with `D-0020` |
| The loop's back edge (`iterate`) | it is `maxIterations`' dormant post-admission meaning, not capacity (`N-19`) | rondo's gate, as its own entry |
| The connection's pragmas and who opens it (§1.7) | it is a composition-root gap this entry **exposes** rather than creates; it becomes urgent only with a second host process | rondo's gate, in whichever entry builds the resident host |
| A promised refusal class for `LeaseHeld` (§6.3) | a refusal taxonomy is continuo's to offer, and rondo may not build on a hint | continuo's gate |
| `probe-evidence.txt` overwritten by concurrent probes (§1.4) | continuo already treats the write as best-effort; the cost is one degraded record | continuo, if it ever stops being best-effort |
| Two host processes against one store | not proposed and not forbidden; §1.7 says what would have to be settled first | rondo's gate |

---

## 10. What would falsify this document

- **`awaiting_human` turns out to hold something after all** — a continuo resource,
  a rondo timer, an endpoint still writing — which would make §2.1's release
  unsafe and collapse the design back to one bound. This is the claim most exposed
  to being wrong, because it rests on §1.5's reading of one `finally`.
- **A fourth thing the allocator must mint** that §1.4's three denials missed, or a
  fifth path in `RunPlan` that is per-run inside continuo in a way this document
  did not open.
- **`git worktree add` turns out not to be atomic against a concurrent creation of
  the same branch**, which would mean §3.5's "collisions rondo did not cause" have
  a race in them and not only a refusal.
- **SQLite refuses a partial unique index over a second virtual generated column**
  on the driver `D-0005` pins, which would make §3.3's mechanism unbuildable as
  written — `iteration_one_live` is the precedent, and one index is not proof of
  two.
- **`identifiers_spent` cannot be set exactly at `admitting`** because the write
  order puts the run id somewhere else, which would move §3.3's boundary and make
  `A-17`'s "unused, not spent" unrepresentable as a column.
- **A `D-1104` that takes only the schema half** is accepted at continuo's gate,
  which would leave `maxOccupying` at 1 indefinitely and make §2.3's two-bound
  argument the whole of what this entry delivers.
- **`advisory.md`'s `A-17` is amended or rejected** at rondo's gate, which would
  remove the inheritance case and make Candidate A sufficient on its own — §3.3's
  three columns would then be a table nobody needed.
- **Refusal rows show no demand.** If §4.4's counter runs for months at one
  refusal, `maxLive > 1` is a bound nobody was waiting on, and this entry's
  premise — that the human wait blocks unrelated work — was true in shape and
  false in practice.
- **The 60-second `abandon()` window turns out to be the common path** rather than
  the teardown exception, which would make §6.3's "do not retry" a decision that
  loses laps rather than one that avoids a hint.
- **rondo's ledger arrives first and measures the lap term as binding**, which is
  the mirror image of continuo §10.3's own last falsifier and would mean the 17% /
  83% split was an artefact of one operator's pace.

---

## 11. The decision rows put to rondo's human gate

`D-0023` is referred to by name. This table is a proposal; the gate accepts,
amends or rejects each line. **Origin** says where a line comes from: *Issue #8*
(the issue text or its four comments), *continuo #167* (a line this document owes
to the paired design), or *measured here* (this document's own measurement).

| Line | Proposal | Origin |
|---|---|---|
| **N-1** | `D-0023` takes the allocator and the ledger as **one entry**, because §2.2 measures that they are not independent: releasing capacity at `awaiting_human` is safe only if something both mints and remembers identifiers. Two entries would let the gate accept the half that does not work alone. | measured here |
| **N-2** | **`awaiting_human` and `withdrawal_requested` do not occupy capacity.** The criterion is the design's own — *"whether anything might still be running"* (`records.ts:125-129`, `D-0019` rule 11) — and §1.5 measures that nothing is: the process exited (`dogfood:905-906`), the delivery lease was released (`endpoint_lease.ts:343-354`), the child is gone. `stalled` **does** occupy, fail-closed, because it means *unknown*. | Issue #8 comment 4, answered by measurement |
| **N-3** | The allocator derives the triple from the **iteration id** by a pure, total, invertible function. It does **not** pre-flight continuo, git or the filesystem: three I/O reads on the admission path buy an earlier refusal and no guarantee, because continuo's and git's own checks remain the authority (§3.2). | measured here |
| **N-4** | rondo's own reuse is made impossible **atomically**; collisions rondo did not cause keep being refused where they are refused today. The entry states which class is which, so a later reader does not read `N-3` as a claim to own the branch namespace. | measured here |
| **N-5** | The triple is **stored on the `iteration` row** — `run_id` exists (`sqlite.ts:290`), `topic_branch` and `workspace` are added — and written by `reserve()` in the same `BEGIN IMMEDIATE` as the row. Not a fourth table: it would hold one row per iteration keyed by the iteration. | measured here |
| **N-6** | `leaseClaimantId` is **not** required to be fresh — nothing measured requires it — but is **recommended** to be derived from the run id, because it is the holder in continuo's audit trail and a constant holder across N laps makes that trail unable to say which lap wrote. | measured here |
| **N-7** | Uniqueness is three partial unique indexes over a generated `holds_identifiers`, which is `NULL` exactly when the row is **terminal and unspent**, with `identifiers_spent` set by the one transition into `admitting`. This is `R-10`'s shape B applied a second time, and it is what makes `advisory.md`'s `A-17` inheritance legal without a special case (§3.3). | measured here, on `A-17` |
| **N-8** | **Two bounds**: `maxOccupying` over the `occupying` set of §2.1 — every non-terminal status **except** `awaiting_human` and `withdrawal_requested`, so `planned`, `classified` and `stalled` are all counted — and `maxLive` over every non-terminal status, with **`maxLive >= maxOccupying` validated** rather than assumed. The bound and the generated column are **one definition**: a `maxOccupying` defined over `admitting`/`admitted`/`performing` alone lets two `planned` rows both pass a bound of one and then both perform, and drops `stalled` out of §2.1's fail-closed rule (§2.3). The gate may instead take **one** bound over `live` — simpler, one counter — at the cost that sizing the human's queue depth also sizes concurrent laps, and that `maxLive == maxOccupying` is expressible under the recommendation while the converse is not. | measured here, against continuo `P-14`; the status-set error found by Codex round 1 |
| **N-9** | `runId`, `topicBranch` and `workspace` **leave `RunPlan`**, replaced by one `workspaceRoot`; `parties.grantee` is filled by the allocator and `runPlan()`'s equality check stays as an assertion about rondo's own two writes. **This fires `D-0019` rule 3's first half and leaves its second half — fence geometry defaults — untouched**, which the entry says in as many words (§3.4). | measured here |
| **N-10** | A derived collision the allocator can see is retried under a fresh iteration id; one it cannot see is **refused in rondo's own words**, naming abandon-and-readmit rather than relaying continuo's sentence about branches. The retry does not loop (§3.5). | measured here |
| **N-11** | The ledger is a **counting predicate inside `reserve()`'s `BEGIN IMMEDIATE`**, not a wider index and not a slot table. **The cost is stated, not argued away**: the invariant stops being the database's and an out-of-band insert violates it silently, which is what `D-0019` rule 10's *"the database's invariant"* was buying (§4.1, §4.2). The gate may take the slot table to keep it. | Issue #8 checkbox 2, measured here |
| **N-12** | The bound is a **`HostPolicy` read once at the composition root** (`conductor.ts:275-296`), never on `LoopPolicy`: `admit()` takes a policy per call (`interpreter.ts:124-128`), so a bound there is one each request states about the whole host. **`maxIterations` is not this number** — it is compared against a fresh iteration's zero attempts (`loop.ts:154-169`) and bounds retries of one request, not concurrent requests (§4.3). | measured here |
| **N-13** | The durable, operator-editable bound is **named and not taken**: it is `D-0020`'s operating surface, and taking it here would settle a surface decision inside a scheduling one. | measured here |
| **N-14** | **A capacity refusal writes a refusal row** — timestamp, request, bound in force, occupancy observed — outside the iteration table and outside any lock. It reserves nothing, so `D-0019` rule 9's "no row, no lock" holds. This is the **demand** measurement `D-0012`'s last falsifier asks for and that F-13 does not supply: F-13 gives the shape, only this gives the count (§1.8, §4.4). | Issue #8, `D-0012`'s falsifier |
| **N-15** | The sites that change together are a **closed list** (§4.5), and it includes the four `D-0019` rule 10 did not name because they are types and API shapes rather than DDL — `readLiveRow`'s `.get()`, `readLive()`'s singular `ReadOutcome`, `occupied`'s single `liveIterationId`, and `isLiveIndexViolation`'s match on the index name. **Rule 10's own claim is about the schema and is exact about the schema**; what is added is that a `grep` for `rondo#8` does not reach the other four. `settle()`'s `live IS NOT NULL` guard is on the list **to be left alone** (§4.5). | measured here |
| **N-16** | `inTransaction`'s body **may not be `async`**, enforced rather than assumed. Today the type admits a promise-returning body, `COMMIT` would run before the awaited work, and the failure is invisible under N = 1 and a torn transaction under N > 1 (§1.6). | measured here |
| **N-17** | **`maxOccupying` may exceed 1 only after a `continuo D-1104` that contains the holder-identity half (`P-3`), not merely the column (`P-2`)** — `D-0012`'s falsifier says the enabling change is not the lifting, and continuo's `P-13` agrees. rondo's entry records **which** `D-1104` it is reading. | `D-0012`, continuo `P-13` |
| **N-18** | A **shared `endpointDestinationDir` across concurrent laps** rests on `D-1104`'s per-run fence keys and not on `D-0085` alone: the dropbox's fence file is keyed by the lease resource and the materialiser's pre-flight reads it under the global constant (continuo §1.1, `P-18`). Recorded as a dependency; unreachable while `maxOccupying = 1` (§6.2). | continuo #167 |
| **N-19** | The loop's back edge (`iterate`) is **not** brought back by this entry, though `loop.ts:20-27` names the allocator as what returns it. A retry edge is a question about `maxIterations`' dormant post-admission meaning (`D-0019` rule 9), and it goes to rondo's gate as its own entry. | measured here |
| **N-20** | **rondo does not retry a `LeaseHeld` refusal.** `errorClass` is decoded (`protocol.ts:98`, `:804`) and discarded at the conductor boundary (`conductor.ts:102-111`), and rondo's own module says the class *"is a hint, not a taxonomy"* (`protocol.ts:42-44`). The `abandon()` path's 60 s TTL window (`endpoint_lease.ts:107`, `:375-381`) is recorded as a cost, and a promised refusal class is **asked of continuo's gate**, not built here (§6.3). | measured here |
| **N-21** | The **ordering** case asserts what is promised — two racing reserves at `bound - 1` produce exactly one reservation and one refusal — and a second case **pins that no ordering is promised** and starvation is possible, so a later reader finds a decision rather than a gap. A durable queue is `D-0020`'s (§8, §9). | Issue #8 checkbox 3 |
| **N-22** | The **refusal at capacity** case asserts `atCapacity` with occupancy and bound, no iteration row, nothing spawned, one refusal row — **with an observed-red control** (the same call with the bound raised by one reserves), without which it passes against a `reserve()` that refuses everything. It carries **one sub-case per non-terminal status**, because the bound's status set is where this design was wrong once (§2.3, `N-8`): `planned` at `maxOccupying = 1` must refuse, and `awaiting_human` must not. | Issue #8 checkbox 3; sharpened by Codex round 1 |
| **N-23** | The **resumption while others perform** case lives at `test/store` as well as `test/refrain`, because the assertion that matters is §1.6's: overlapping `admit()` and `resume()` on one connection do not interleave inside a transaction, and `inTransaction`'s synchronous-body guard (`N-16`) is asserted with it. | Issue #8 checkbox 3, measured here |
| **N-24** | A **fourth** case the issue does not name and §5 requires: `identifiers_spent` is set exactly once at `admitting`, a terminal **spent** row keeps holding its triple for ever, and — the observed-red control — a terminal **unspent** row releases it. Without it `N-7`'s whole mechanism is prose. | measured here |
| **N-25** | **Implementation starts only after the gate accepts or amends these lines and creates `D-0023`.** This document allocates no entry, edits no `DECISIONS.md`, and is not accepted authority. | `AGENTS.md` section 7 |

---

## 12. The human gate's checklist

Return or reject `D-0023` unless every answer is yes.

1. Is the release of capacity at `awaiting_human` argued from the design's **own**
   criterion — *whether anything might still be running* — rather than from
   convenience, and is `stalled` still held fail-closed (`N-2`)?
2. Does the entry state that the allocator and the ledger are **one** decision,
   with the reason (`N-1`)?
3. Does the allocator **mint and remember**, with the memory durable on the row and
   never released for a spent triple (`N-5`, `N-7`)?
4. Does `advisory.md`'s `A-17` inheritance stay legal without a special case, and
   is it testable rather than asserted (`N-7`, `N-24`)?
5. Is the bound a **value the ledger reads**, on a host policy rather than on
   `LoopPolicy`, and does the entry say plainly that `maxIterations` is a
   different axis (`N-11`, `N-12`)?
6. Does the entry record **what the counted bound gives up** — that the invariant
   stops being the database's — rather than presenting the index's removal as free
   (`N-11`)?
7. Is `maxOccupying` held at **1** until a `D-1104` containing `P-3`, does its status
   set match §2.1's `occupying` column exactly, and is `maxLive >= maxOccupying`
   validated (`N-8`, `N-17`), and does the
   entry say which `D-1104` it read (`N-17`)?
8. Is the closed list of changing sites complete, including the four that carry no
   `rondo#8` comment, and is `settle()`'s guard explicitly **left alone**
   (`N-15`)?
9. Is a capacity refusal **recorded**, so that raising the bound later rests on
   demand rather than on complaint (`N-14`)?
10. Is `inTransaction`'s synchronous body **enforced** rather than relied on
    (`N-16`)?
11. Do the `test/refrain` cases carry observed-red controls, and does the ordering
    case pin the **absence** of a promise rather than inventing one (`N-21`,
    `N-22`, `N-23`, `N-24`)?
12. Does the entry say plainly that this **does not make two laps run at once and
    does not shorten any human wait** (section 7)?
13. Are the cross-repository dependencies recorded as decision rows — the
    holder-identity half, and the shared destination directory's per-run fence
    keys — rather than assumed (`N-17`, `N-18`)?
14. Are the residuals named with **who decides** each, including the composition
    root's unowned pragmas that this entry exposes rather than creates (section 9)?
15. Does implementation wait for the gate-created `D-0023` (`N-25`)?

---

## Appendix A. The in-loop Codex review of this document

A `codex exec review` pass over the committed document raised its findings
against the tree rather than against the prose, and they are answered above
rather than noted as limitations.

**Round 1** raised one finding, confirmed.

| # | Finding | Verdict | Where answered |
|---|---|---|---|
| P2-1 | §2.3's `maxPerforming` was defined over `admitting`/`admitted`/`performing` alone, a set narrower than §2.1's table. With `maxLive > 1`, two `admit()` calls both commit a `planned` row, neither is counted, both pass a bound of one and both then perform. `stalled` was excluded by the same slip, contradicting §2.1's fail-closed rule | **Confirmed.** The two sections disagreed and the narrower one was the enforcing one, so §2.1's table was decorative wherever the bound was actually read | §2.3 rewritten: the bound is renamed **`maxOccupying`** and defined as **exactly** §2.1's `occupying` column, one definition in one place; `maxLive >= maxOccupying` becomes a validated constraint; **`N-8` amended**; §4.2 states that both counts are read in the insert's own transaction; §4.5's `occupying` row spells the status set; **`N-22` amended** to carry one sub-case per status |

The finding is recorded rather than smoothed away because what it found is the
shape of the problem and not the shape of the drafting: a bound named after the
last status in its set is a bound somebody narrows again, and the rename is the
part of the fix most likely to survive a later edit.
