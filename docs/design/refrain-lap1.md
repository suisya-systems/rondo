# The lap-1 conductor loop in `src/refrain`

**Status: propose-only.** This document takes no decision. It measures what is in
the tree today, proposes a design for the first working conductor loop, and ends
in a table of decision rows (`R-1` … `R-16`) for rondo's human gate. Per
[`../../AGENTS.md`](../../AGENTS.md) section 7 the rows are named rather than
settled here, and the entry the gate would create is referred to throughout as
**`D-0019`** — a name for a thing that does not exist, not a citation.

It is written in the shape of cadenza's `docs/design/conductor.md` sections 10-12,
which is the document this one is the consumer-side answer to: measured claims
carrying `file:line`, an end-to-end walk of one iteration, a falsification
section, and a decision table. Line references are to the revisions named in
[section 1.5](#15-what-was-measured-and-at-which-revisions); they drift, and the
claim rather than the number is what a later reader should re-measure.

A **pre-design review by Codex** on 2026-09-06 found three Blockers and seven
Majors against an earlier sketch. Every one of them is answered below, either as
a decision row or as a measured refutation. Where the answer is a refutation it
says so and shows the measurement, because a review finding dismissed without one
is a finding deferred.

---

## 0. What the loop has to become, in one paragraph

Today `src/refrain/` holds a total function from a record to an intention
(`nextStep`) and nothing that acts. What lap 1 needs is the thing that acts: a
resident conductor that takes a request, classifies it against a delegation
contract, admits a run to continuo, performs one lap, and **stops at a gate a
human has yet to answer** — persisting enough that the process can die at any
point between those steps without the human losing the thread, and resuming when
the operating surface says the human has answered. It never composes the answer
(`D-0009`), never publishes (`D-0010`), never closes a gate (`D-0013`), and runs
one iteration at a time (`D-0012`). The whole of lap 1 is that one arc, done
durably.

---

## 1. What is true today, measured

### 1.1 The loop is a pure planner, and nothing else

[`src/refrain/loop.ts:35`](../../src/refrain/loop.ts) declares
`nextStep(record, policy = CONSERVATIVE_POLICY): Step`. It reads two fields of
the record and two of the policy, branches, and returns one of three variants
(`rest`, `ask_human`, `iterate`, declared at `loop.ts:18-24`). It touches no
clock, no filesystem and no network; the whole module's import list is one type
import from `../store/records.js` and one value import from `./policy.js`
(`loop.ts:13-15`). **It is a total function**, and the property is not an
aspiration: `src/refrain/`'s external allowance in the boundary test is *empty*,
so there is nothing it could reach even by accident
([`test/architecture/import-boundaries.test.ts:196-243`](../../test/architecture/import-boundaries.test.ts)
grants externals per module, and no `src/refrain/*` module appears).

`test/refrain/loop.test.ts` exercises it with hand-built records and no fakes at
all, because there is nothing to fake.

The one access point, `src/access/local.ts:27`, calls `nextStep(record)` and
returns the answer. It adds nothing and it drives nothing.

### 1.2 The store is a name and a throw

[`src/store/records.ts:14`](../../src/store/records.ts) declares
`IterationStatus = "planned" | "running" | "awaiting_human" | "closed"`, and
`IterationRecord` carries four fields: `id`, `status`, `attempts`,
`observedAtMs`. [`src/store/sqlite.ts:34`](../../src/store/sqlite.ts) declares
`IterationStore` with a synchronous `read`/`write` pair, and
`iterationStore(connection)` at `sqlite.ts:48` **throws**: the schema is out of
scope for the skeleton and rondo opens no database. The `node:sqlite` import is
type-position only.

So there is no durable state at all today, and the record that exists cannot
express a run, a gate, a contract or a continuo revision.

### 1.3 The two seams work, and neither is reachable from the loop

**continuo.** `src/continuo/invoker.ts:169` (`startContinuo`) reads `--version`
off the located build and refuses unless it matches the committed pin;
`invoker.ts:204` (`run`) drives one verb through a `VerbContract`, refuses a
handle it did not issue (`invoker.ts:209`), refuses an empty or NUL-bearing
argument (`invoker.ts:223`, `unusableArgument` at `invoker.ts:266`), appends
`--json` itself (`invoker.ts:246-250`), and returns one of the five outcomes
`src/continuo/protocol.ts:75-96` defines. Five verb contracts exist:
`DB_CREATE` (`protocol.ts:300`), `RUN_ADMIT` (`:309`), `GATE_LIST` (`:319`),
`GATE_SHOW` (`:332`), `GATE_CLOSE` (`:344`). **There is no `lap perform`
contract.**

**cadenza.** `src/cadenza/facade.ts` exposes four functions: `resolveProject`
(`facade.ts:116`), `agentTypeRecord` (`:136`), `issueInitialContract` (`:155`)
and `classifyAction` (`:172`). Its module header states, and its import list
shows, that it reads no file, no clock and no network — which is why
`test/cadenza/smoke.test.ts` runs it in every matrix cell with in-memory
fixtures. `delegate` and `adopt` are deliberately not imported (`D-0018` rule 7).

Neither seam is reachable from `src/refrain/`: see 1.4.

### 1.4 The arrows, as the boundary test states them

[`test/architecture/import-boundaries.test.ts:124-149`](../../test/architecture/import-boundaries.test.ts):

| layer | may import |
|---|---|
| `src/store` | `src/store` |
| `src/refrain` | `src/refrain`, `src/store` |
| `src/continuo` | `src/continuo` |
| `src/cadenza` | `src/cadenza` |
| `src/access` | `src/access`, `src/continuo`, `src/refrain`, `src/store` |

`src/access` is the only layer that can compose more than itself and one
neighbour, and it is the only layer that can see both the loop and the continuo
seam. Externals are granted **per module**: `node:sqlite` to
`src/store/sqlite.ts` (`:199`), `spawn` to `src/continuo/invoker.ts` (`:206`),
and `@suisya-systems/cadenza` to `src/cadenza/facade.ts` binding by binding
(`:218-243`).

### 1.5 What was measured, and at which revisions

**2026-09-06**, toolchain `node v22.17.0` (and `v24.15.0` present for the second
matrix row), against:

- rondo at this branch's HEAD;
- continuo at `44f62336108b86cab5da791111ffa0e5b73cd01a` — the revision
  `continuo.pin.json` pins, verified by `git log -1` in the sibling checkout, so
  every continuo line cited below is the build rondo actually drives;
- cadenza at `e56d7e71981232d19120d20ba6b920a5c4d762dc` — the revision
  `cadenza.pin.json` names, likewise verified.

That the siblings sit at exactly the pinned revisions is what makes the citations
below evidence about rondo's seam rather than about somebody's checkout.

---

## 2. Is a loop the right control structure at all?

The name in the tree is `refrain` and the shape assumed everywhere upstream is a
loop. That assumption is worth testing before it is implemented, because the two
obvious alternatives — a **state graph** and an **eval-driven** controller — are
not exotic, and one of them turns out to describe what this design needs better
than "loop" does.

**(a) The loop, as currently assumed.** Iterate → open a gate → ask the human →
iterate. It is the shape of cadenza `conductor.md` section 10 and of the existing
`nextStep`.

**(b) A state graph.** Nodes are states, edges are the admitted transitions;
branching, parallelism and resumption are properties of the graph, and a
checkpoint per node is what makes an interrupted walk resumable. This is the
shape LangGraph-style runtimes provide.

**(c) Eval-driven.** Each stage's output is scored by an evaluator, and a
threshold decides whether the controller advances, retries, or escalates to a
human.

**The measured answer to "is the loop a special case of the graph": yes, and
rondo's loop is already written as one.** `nextStep` is a total function from
`(state, policy)` to a transition (`loop.ts:35-63`) — an edge relation, not a
control-flow loop. Nothing in `src/refrain/` iterates; `while` and `for` do not
appear in it. What re-enters the conductor is not a loop body but an external
event, and after [section 5](#5-the-suspend-at-awaiting_human-blocker-3) that is
literally true: the process suspends at the human gate and something outside
resumes it. So the "loop" is a refrain in the musical sense the README's last
paragraph gives it — a thing returned *to* — and not a `while (true)`.

**Does lap 1 gain from holding that graph explicitly?** The discipline, yes. The
runtime, no, and the reason is measurable rather than aesthetic:

- **There is no branching to speak of.** `D-0012` makes rondo single-flight, and
  continuo refuses a second concurrent lap outright: `lap perform` takes the
  single global `outbox-delivery` lease (`continuo D-0074`, cited in `D-0012`).
  A graph runtime's headline feature is fan-out, and fan-out is refused upstream.
- **There is no back-edge.** The one edge an iterative controller needs —
  "failed, go round again" — does not exist: `lap perform` cannot be re-entered
  on an admitted run, and a second attempt needs a fresh (run id, topic branch,
  workspace) triple that `D-0012` records **nothing allocates**. So the
  "loop" in lap 1 executes each edge at most once.
- **A graph runtime would be rondo's second runtime dependency**, and the first
  one took a whole entry (`D-0018`), a vendored tarball, three pins and a digest
  check, because neither sibling is published. A dependency bought to model a
  linear walk of eight states is not a trade rondo can defend at this size.

What the graph *does* buy, and what this design takes, is its discipline:
**named states, an explicit and closed edge relation, and a durable checkpoint at
every node** — which is exactly what
[section 7](#7-what-the-store-must-do-major-2) specifies, and exactly what makes
the suspend-and-resume of section 5 expressible. The proposal is therefore to
adopt the graph's shape without a graph library (`R-6`).

**Where evaluation goes.** rondo already has three evaluator positions, and two
of them are somebody else's:

| position | evaluator | determinism |
|---|---|---|
| before admission | cadenza `classify()` — `allowed` / `needs_approval` / `refused` (`classification.ts:26`, `:62-66`) | total and pure; "every input produces one of three outcomes and none produces a throw" (`classification.ts:9-14`) |
| the ground-truth check after a lap | the conductor's own verify (cadenza `conductor.md` section 6.2) | not built; see `R-15` |
| at the end | the human, through a continuo gate | a person |

So rondo is *already* eval-driven, with deterministic evaluators. Adding a
model-judged evaluator in lap 1 would be worse on all three of the axes that
matter here: it puts a non-deterministic verdict on the path to a human gate,
which spends the one human contact `D-0009`'s reasoning rations; it cannot be
made a unit test, which is the property every other refusal path in this tree
has; and its most valuable output — "go back and try again" — lands on the
back-edge that does not exist. **Recommendation: keep the evaluators
deterministic and in the three positions above; a model judge is a lap-2 row**
(`R-7`).

Stated plainly, because this is the part a reader should be able to disagree
with: the argument against (b) and (c) is not that they are wrong shapes. It is
that in lap 1 both of their distinguishing features — branching for the graph,
scored retry for the eval loop — are unreachable, and unreachable features cost
their machinery and pay nothing. Both become live the moment `D-0012`'s
allocator exists, which is the same trigger `D-0012` already names for the
dormant no-progress halt.

---

## 3. The arrows: what the loop may reach (Blocker 1)

**The Blocker.** Codex read the sketch as requiring `src/refrain -> src/continuo`
and noted correctly that `D-0017` rule 2 forbids exactly that
(`import-boundaries.test.ts:130-136`), so `D-0019` could not be an append — it
would have to supersede `D-0017` and restate which of its rules survive.

**The refutation, and it is a design change rather than a rebuttal.** The arrow
is not needed. What the interpreter needs from continuo is *effects*, and an
effect can arrive as an injected port whose type is declared in `src/refrain/`
in rondo's own vocabulary. No import crosses. Concretely:

- `src/refrain/ports.ts` declares `ConductorPorts` — `admitRun`, `performLap`,
  `showGate`, `now`, plus the store — in refrain's own result types.
- `src/continuo/` grows the typed adapter of
  [section 8](#8-the-continuo-adapter-majors-3-4-5) and knows nothing about the
  conductor.
- A **composition root** imports both and wires them. `src/access` is the only
  layer permitted to do so today (`import-boundaries.test.ts:148`), and it is
  where `D-0009` and `D-0013` already put the human-facing verbs — so the module
  that wires the conductor and the module that carries the human's answer are
  the same surface, which is the property those two entries exist to protect.

This keeps `D-0017` rule 2's stated purpose exactly: *"the loop stays testable on
a machine with no continuo on it, which is what its empty allowance has always
been for."* Under ports that is still true, and `test/refrain/` needs no
continuo build, no `spawn` and no network.

**The cost, named rather than hidden.** refrain's port results are a second
vocabulary beside `ContinuoResult`'s five outcomes (`protocol.ts:75-96`), and
somebody has to translate. That cost is already paid by an accepted decision:
`D-0015` rule 2 says nothing typed crosses the process boundary and `D-0017`
rule 8 says no continuo type leaves the layer, so a translation into rondo's own
records exists whichever way this row goes.

**cadenza is different in kind, and the arrow there should be taken.**
`src/refrain -> src/cadenza` is the arrow `D-0018` rule 5 deliberately left
unbuilt, naming its trigger: *"the arrow arrives when conductor code consumes the
facade."* This is that code. The asymmetry with continuo is not layering
taste — it is measured:

- the cadenza facade owns **no capability**: it reads no file, no clock and no
  network (module header, and the import list at `facade.ts:44-61` is the
  package and nothing else), and `classify()` is total and pure
  (`classification.ts:9-14`);
- the continuo layer owns **a process** (`invoker.ts:33`, the `spawn` grant at
  `import-boundaries.test.ts:206`).

A loop that imports the first is still a function of what it was handed. A loop
that imports the second is a loop that can start a subprocess. So the proposal is
**take the cadenza arrow, keep continuo behind a port** (`R-1`), with the
composition root in `src/access` (`R-2`).

**What `D-0019` then does to `D-0017`, under each branch:**

- **Under `R-1`(a), the recommendation:** `D-0017` needs **no supersession**. All
  eleven of its rules stand as written; rule 2's arrow table gains
  `src/refrain -> src/cadenza` only, which is `D-0018` rule 5's arrow and not
  `D-0017`'s claim. `D-0017` rule 5 does gain a **dated annotation**: it defers
  persisting the observed continuo revision to "the issue that gives rondo a
  store", and this is that issue — [section 7](#7-what-the-store-must-do-major-2)
  discharges it, which is the falsifier `D-0017` named for its own deferral
  ("the store schema arriving and the observed revision still not being
  persisted"). `D-0018` gains an annotation recording that rule 5's arrow was
  taken.
- **Under `R-1`(b), if the gate prefers the direct arrow:** `D-0017` is
  **superseded by `D-0019`**, which restates rules 1, 3, 4, 5, 6, 7, 8, 9, 10 and
  11 unchanged and in force, and replaces rule 2's arrow table with one in which
  `src/refrain` names `src/continuo`. Rule 3 (the `spawn` grant is one module's)
  is what stops that arrow from becoming a second spawner, and it is the rule
  that would carry the most weight in that branch. The falsifier `D-0017` names
  for itself — *"`src/refrain/` needing to drive a verb itself, which falsifies
  rule 2's arrow and reopens whether the loop is a pure planner"* — is precisely
  this branch, and the design would have to answer the second half as well as the
  first.

---

## 4. Where a run's inputs come from (Blocker 2)

**The Blocker, restated as a measurement.** A one-line request does not determine
what either verb needs, and the gap is large. `run admit` takes seven required
fields — `--db`, `--run-id`, `--lease-claimant-id`, `--workspace`, `--role`,
`--base-branch`, `--topic-branch`, `--prompt`
(continuo `src/control_plane/run_cli.ts:467-495`; the one-liner is `--prompt`,
one field of eight). `lap perform` then requires, at
continuo `src/lap/cli.ts:567-631`: `--db`, `--run-id`, `--repository`,
`--artifact-root`, `--state-root`, `--endpoint-recipient` (from a fixed
`choices` list), `--endpoint-destination-dir`, `--claude-command` (repeatable,
every token absolute), `--interlock-root` and `--claude-org-path`; and optionally
`--endpoint-db`, `--endpoint-module`, `--node`, `--hook-script`, `--python`,
`--poll-interval-ms`, `--turn-timeout-ms`, `--git-timeout-ms`, `--gate-option`
(repeatable) and `--gate-deadline-at-ms`. rondo's own README records that
neither an agent-type registry nor an allocator exists.

**Proposal: the caller passes a complete `RunPlan`, and rondo gains no allocator
and no configuration layer in lap 1** (`R-3`).

A `RunPlan` is a frozen record carrying every value above **and every input the
cadenza facade needs**, validated once at rondo's boundary
([section 8.3](#83-validation-happens-before-the-spawn-not-after-major-5)) and
never edited afterwards. The conductor receives one; it never invents a field.

The cadenza half has to be enumerated rather than gestured at, because none of
it is derivable from the request text and each function refuses without it:

| plan field | consumed by | why it cannot be derived |
|---|---|---|
| `catalogLayers: readonly CatalogLayer[]` | `resolveProject` (`facade.ts:116`) | cadenza reads no catalog of its own (`classification.ts:52-54`), and `CatalogLayer.baseDir` must be absolute in the platform's own spelling (`facade.ts:75-90`). rondo has no catalog on disk and where one would live is its own decision |
| `projectName: string` | `resolveProject` | the request text names a task, not a G1 project |
| `agentTypeInput: AgentTypeInput` | `agentTypeRecord` (`facade.ts:136`) | six fields, none defaulted by cadenza (`agent-type.ts:120-127`), and rondo has no agent-type registry to look one up in |
| `parties: IssuanceParties` | `issueInitialContract` (`facade.ts:155`) | `issuer` and `grantee` name a run and a delegate that are **rondo's** records; cadenza mints neither and says so (`facade.ts:145-153`) |
| `intendedAction: IntendedAction` | `classifyAction` (`facade.ts:172`) | it is a set of capability keys naming every act the run performs (`classification.ts:38-46`). Deriving one from prose is exactly the inference `D-0009`'s reasoning distrusts, and getting it wrong makes the classification answer the wrong question |

That is the honest size of "a one-line request does not determine a run": five
values on cadenza's side and eighteen on continuo's, before the prompt.
`classifyAction` also needs the subject's `configDigest` **now**, which is not a
plan field — it is read off the `ResolvedProject` at step 2 of section 10, which
is the whole point of resolving rather than caching (`facade.ts:167-171`).

Why that way round:

- **The two things rondo would have to build are exactly the two `D-0012` says
  are blocked.** An allocator for the (run id, topic branch, workspace) triple is
  named there as a prerequisite for parallelism that "is rondo's to design or
  continuo's to grow; either way it is a decision with measurements under it".
  Building one here would take that decision inside an implementation diff, which
  `AGENTS.md` section 7 forbids.
- **Most of the remaining fields are not decisions at all**, they are the
  operator's environment: `--claude-command`, `--node`, `--python`,
  `--hook-script`, `--interlock-root`, `--claude-org-path`, `--artifact-root`,
  `--state-root`. continuo requires each to be absolute and outside the worktree
  and says why in its own help text (`lap/cli.ts:106-172`). A rondo-side default
  for any of them would be rondo guessing at a fence's geometry.
- **It keeps the one-liner honest.** The request text is `--prompt` and nothing
  more, and this document does not pretend otherwise.

What this costs: lap 1's conductor cannot be driven from a chat box alone. Its
first caller is the operating surface or a local access point holding a plan the
operator wrote. That is the honest lap-1 shape, and it is the same shape
`D-0010` gives publishing — the operator is in the loop because nothing has
earned the right to take them out of it yet.

**What the store persists of the plan** is `R-4`. Recommendation: the plan
**verbatim** plus a `plan_digest`, not the digest alone. The reason is
`D-0031` section 5's, one repository along (recorded in rondo as the reasoning
behind `D-0018`'s "what this buys"): *a digest detects change but does not hand
back the policy a past run used.* "Under what plan did this run happen" has to be
answerable from rondo's own row, because the plan is rondo's — continuo persists
the intent it was admitted with, not the executor paths or the agent type. The
plan carries no secret: every field above is a path, a branch name, an
identifier or the request text.

---

## 5. The suspend at `awaiting_human` (Blocker 3)

**The Blocker.** Nothing in scope closes a gate. `lap perform` returns with the
gate **already open** — cadenza `conductor.md` section 10 step 3 states it and
continuo's code is the reason: the report ingress opens the gate at stage
`received` (`control_plane/gates.ts:431` `openGate`, writing `'received'` at
`gates.ts:485` and `:504`) before `performLap` returns. `gate show` only observes
(`protocol.ts:332`). And rondo must not close: `closeOpenGate` hard-codes
`actorKind: "human"` (continuo `src/gate/operator.ts:978`, `:1019`), which is
`D-0013`'s whole reason for putting the verb on the operating surface. So a
design that "stops at the closed gate" by looping on `gate show` would be
waiting, synchronously, for an event that only another surface can cause.

**Proposal (`R-5`): persist and return; resume on an explicit trigger.**

1. After `lap perform` answers, the conductor writes the gate id and everything
   else it learned, transitions the iteration to `awaiting_human`, and
   **returns**. The process may then exit. There is no timer, no poll loop and no
   in-memory continuation.
2. Resumption is a **separate entry point** — `resume(iterationId)` on the
   conductor — invoked by the operating surface after the human's answer has been
   carried through `gate present` → `gate deliver` → `gate ack` → the answer →
   `gate deliver` → `gate ack` (cadenza `conductor.md` section 10 step 7). rondo
   drives none of those four verbs; `D-0015`'s verb table records they carry no
   `--json` and that rondo does not drive them.
3. `resume` drives **one** `gate show --json` and reads `outcome`, which the
   decoder types as `string | null` and which is null exactly while the gate is
   open (`protocol.ts:159-171` states the rule and `GATE_SHOW` at `:332` applies
   it). Non-null → the gate is terminal, the iteration transitions to `closed`,
   and the conductor reports the outcome, the verify verdict (if any) and the
   fact that publishing is the operator's (`D-0010`). Null → the gate is still
   open; `resume` changes nothing and says so. `resume` is therefore idempotent
   and safe to call from a surface that cannot be sure.
4. The abort path stays `D-0013`'s: an iteration that ends before an answer
   transitions to `withdrawal_requested`, records the gate id and the reason, and
   **asks** the surface for `gate close --outcome withdrawn`. It never writes the
   outcome. `withdrawn` is the only outcome writable from `received`
   (`gates.ts:279`) and is one of the three a hand may write at all
   (`operator.ts:112-116`).
5. **`resume` serves `withdrawal_requested` too, and it has to**, or the ask
   would be a state with no way out. The observation is identical — one
   `gate show`, read `outcome` — and so is the transition: non-null → `closed`,
   null → nothing changes. The only difference is which outcome a reader should
   expect (`withdrawn`, or `subject_gone` if the operator closed the run and
   continuo's reconciliation swept the gate — `D-0013` names that second route).
   Nothing about `resume` needs to know which of the two states it was called
   on, which is why it is one entry point and not two.

**On cadenza#22.** The operating surface is being designed in parallel as
cadenza issue #22. This document cites the Issue and **does not assume its
outcome**: what it needs from #22 is one call — "this gate has an answer, look
again" — and nothing about how #22 is built. If #22 lands without a way to call
into rondo, the fallback is an operator-invoked `resume` on the local access
point, which is strictly worse for the human and identical for the state machine.
That fallback is why `R-5` is recommendable before #22 is settled.

**Why not polling, stated once.** A poll loop would make the conductor hold a
process for the length of a human's attention, would need a clock in a layer that
has none, and would turn "the human has not answered yet" into a timeout — which
is a deadline nobody set. The gate has its own deadline mechanism
(`--gate-deadline-at-ms`, and `expired` is one of the three closable outcomes),
and it belongs to continuo.

---

## 6. The planner and the interpreter (Major 1)

**The Major.** Replacing `nextStep` with an effectful runner would destroy the
one property `src/refrain/` currently has.

**Agreed in full; nothing here replaces it** (`R-8`).

- `nextStep(record, policy) -> Step` stays a total, pure function in
  `src/refrain/loop.ts`, and its five existing cases in `test/refrain/loop.test.ts`
  keep passing.
- A new module — `src/refrain/interpreter.ts` — is `async`, holds no state of its
  own, and does exactly this: read the record through the store port, call
  `nextStep`, execute the returned step through the ports, write the result back,
  and repeat until the step is one that returns. It is the only asynchronous thing
  in the layer, and it imports no external module, because its effects arrive as
  parameters (section 3).
- **Every persisted state and every effect result is a discriminated union**, and
  the interpreter's `switch` over them is exhaustive — which under this repo's
  TypeScript settings (`D-0002`, strictness beyond `strict`) is a compile error
  when a variant is added and not handled, rather than a runtime surprise.
- **Anything the interpreter cannot classify halts and asks.** An unknown status
  string read out of the database, a record whose fields do not read, an effect
  result in a shape the union does not cover: all of them transition to
  **`stalled`** with the reason, and none of them proceeds. This is the same rule
  `loop.ts:42-54` already applies to an unusable `maxIterations` or `attempts` —
  *"it is answered by stopping and asking, which is what the loop does whenever
  it does not know."* **Not `awaiting_human`**, which [7.1](#71-the-states)
  reserves for an open continuo gate: a corrupt row has no gate for `resume` to
  observe, so filing it there would be filing it somewhere nothing can reach it
  again. `stalled` is the state for "a person must decide and there is no gate",
  and [7.7](#77-the-lock-and-what-releases-each-state) names what leaves it.

**`Step` has to grow, and the growth is the state machine.** Three variants
cannot express eight states. The proposed union names the transitions of
[section 10](#10-one-iteration-end-to-end): `classify`, `reserve`, `admit`,
`perform`, `observe_gate`, `report`, `ask_human`, `rest`. `nextStep` stays pure
and total over the larger union; that is a bigger `switch`, not a different kind
of function.

**The policy, which today would prevent the runner from ever admitting anything**
(`R-9`). Measured: `CONSERVATIVE_POLICY` is
`{ autonomy: "ask_every_iteration", maxIterations: 1 }`
(`src/refrain/policy.ts:34-37`), and `loop.ts:39` returns `ask_human` whenever
autonomy is `ask_every_iteration` — including for a `planned` record with zero
attempts, which `test/refrain/loop.test.ts` asserts as the intended behaviour.
Wired to a runner as the default, the conductor would ask a human before every
iteration and admit nothing, ever. Codex is right that this must be settled
rather than discovered. The proposal:

- **Both of the policy's axes are dormant in lap 1, and the document says so
  rather than implying they work** — the same move `D-0012` makes for the
  no-progress halt and the review-round budget, and for the same reason: with one
  lap per request, `maxIterations` has no second iteration to bound, and
  `autonomy` has no unattended landing to permit because *every* lap-1 iteration
  ends at a human gate anyway (`D-0010`, cadenza `C-5`).
- **`CONSERVATIVE_POLICY` stays the default and stays correct**, and the runner
  requires an explicitly-constructed policy to proceed. A default that admitted
  runs unattended would be a decision about unattended action taken by a default
  value, which is what `policy.ts:28-33` already argues against.
- **The policy is consulted before `reserve()`, and a policy that says "ask"
  refuses the request rather than reserving a row.** This matters more than it
  looks: `nextStep` under `ask_every_iteration` returns `ask_human` for a
  `planned` record, and a conductor that reserved first and asked second would
  hold the single-flight lock ([7.3](#73-the-invariant-and-it-is-enforced-by-the-database))
  on an iteration whose only exit is a human — for a *policy stop*, which is an
  ordinary configured outcome and not an incident. Refused before reservation, it
  costs nothing: no row, no lock, and a caller that gets an immediate answer
  naming the policy that produced it.
- cadenza's own `LoopPolicy` — `maxReviewRounds`, `noProgressWindow`,
  `noProgressRepeat` (cadenza `src/domain/agent-type.ts:80-87`) — is carried on
  the agent-type record, digested, and **read by nothing in lap 1**, which is
  exactly what `D-0012` predicts. `D-0019` should record that rather than let a
  reader assume the budget is enforced.

---

## 7. What the store must do (Major 2)

**The Major.** A `read`/`write` pair cannot express durable single-flight; an
in-memory mutex breaks on restart; the schema needs far more than four fields;
and provenance must be written *before* the effect it describes.

**Agreed in full** (`R-10`). The proposal:

### 7.1 The states

`IterationStatus` grows from four to eleven.

**Non-terminal (8)** — `planned`, `classified`, `admitting`, `admitted`,
`performing`, `awaiting_human`, `withdrawal_requested`, `stalled`.

**Terminal (3)** — `closed`, `abandoned`, `failed`.

`running` is replaced by the three states that say *which* effect is in flight,
because "running" is the one word that cannot be acted on after a crash
([7.6](#76-restart-and-where-fail-closed-means-stop)).

Four of the eleven need their meaning pinned down, because the invariant in 7.3
makes every non-terminal status a lock on the whole conductor:

- **`awaiting_human` means a continuo gate is open on this iteration**, and
  nothing else. It always carries a gate id. It is not the general "a person has
  to look at this" state, and using it as one is how a design deadlocks itself:
  a status that is non-terminal and has no event that can end it holds the
  single-flight lock forever.
- **`abandoned` is terminal and is not a failure.** It is where a request ends
  correctly without a run: a `refused` classification, a `needs_approval` lap 1
  cannot resume ([section 9](#9-classification-and-what-lap-1-leaves-out-major-6)),
  or an operator abandoning an iteration whose outcome cannot be established.
  Calling these `failed` would file a working refusal as a defect.
- **`withdrawal_requested` is reachable only from `awaiting_human`**, because it
  is defined by the ask it carries — `gate close --outcome withdrawn` on a
  *named* gate (`D-0013`). A failure with no gate id has nothing to ask about;
  it goes to `failed` or stays `performing` (section 10's abort edges).
- **`stalled` is "a person must decide, and there is no gate"**: a corrupt row, an
  effect result the union does not cover, a status the interpreter does not
  recognise. It exists so that those cases have somewhere to go that is neither a
  lie (`awaiting_human`, which promises a gate) nor a loss (a terminal status,
  which would release the lock on an iteration nobody understood).

### 7.2 The row

At least: iteration id; request text; the `RunPlan` verbatim and its
`plan_digest`; status; run id; the **observed** continuo revision; the agent
type's `agent_type_digest`, the project's `config_digest` and the contract's
`contract_digest`; gate id, gate stage and gate outcome; the mapped continuo role
beside cadenza's neutral one; created/updated timestamps supplied by the caller
(the store reads no clock — `records.ts:31-36` already states that rule); and a
nullable failure or withdrawal-request reason.

Writing the observed continuo revision here is what discharges `D-0015` rule 6
and `D-0017` rule 5's deferral (section 3).

### 7.3 The invariant, and it is enforced by the database

**At most one non-terminal iteration exists.** That is `D-0012`'s single-flight,
made durable instead of remembered. Two shapes were measured on `node v22.17.0`
against `node:sqlite`, and **both work**:

```
shape A  CREATE UNIQUE INDEX one_live ON iteration(1)
           WHERE status NOT IN ('closed','abandoned','failed');
shape B  a VIRTUAL generated column `live` (NULL when terminal, 1 otherwise),
         CREATE UNIQUE INDEX one_live ON iteration(live) WHERE live IS NOT NULL;
```

Measured: shape A is created and enforces (a second `planned` insert fails
`constraint failed`); shape B is created and enforces (`UNIQUE constraint
failed: iteration.live`); and after the first row reaches `closed`, a new
reservation is accepted under both. **Shape B is the recommendation** — the index
is over a named column a reader can `SELECT`, and the terminal set is written
once in the generated column rather than repeated in every partial index that
later wants it.

### 7.4 `reserve()` and `transition()`, not `read`/`write`

`IterationStore` is replaced by two operations with transactions inside them:

- `reserve(plan, nowMs)` opens `BEGIN IMMEDIATE`, inserts the `planned` row, and
  commits — or reports that a non-terminal iteration already exists. Measured on
  `node:sqlite`: a second connection attempting `BEGIN IMMEDIATE` while the first
  holds one is refused with `ERR_SQLITE_ERROR` / `database is locked`, so the
  serialisation is the database's and survives two processes, not just two
  callers in one.
- `transition(id, from, to, fields)` opens `BEGIN IMMEDIATE`, asserts the current
  status is `from`, writes the new status and the fields, and commits. A
  transition from an unexpected state is refused rather than applied, which is
  the closed edge relation of section 2 enforced where it can actually be
  enforced.

`BEGIN IMMEDIATE` rather than the default deferred transaction for the reason
continuo gives on its own admission path (`run_admission.ts:309`): under a
deferred transaction the write lock is taken at the first write, which leaves a
window where two readers both believe they may proceed.

### 7.5 The write order that keeps provenance

The rule is: **nothing is sent to continuo until the row that will explain it is
committed.**

1. `reserve` → `planned`, with the plan and its digest.
2. `classified`, with the three cadenza digests and the classification outcome.
3. `admitting`, with the **run id** (it comes from the plan, so it is known
   before admission) and the **observed continuo revision** from
   `startContinuo`. Committed *before* `run admit` is spawned.
4. `run admit` → on success, `admitted`.

A crash between 3 and 4 therefore leaves a row that names the run id and the
build, which is what makes the recovery in 7.6 possible at all. The reverse order
would leave a run continuo knows about and rondo does not.

### 7.6 Restart, and where fail-closed means stop

| status found at startup | what happens |
|---|---|
| `planned`, `classified` | resume normally: no external effect has been made |
| `admitting` | **stop and report; the row stays `admitting`.** A run may or may not exist under that id. rondo does not re-admit: `run admit` refuses a duplicate run id, and relying on that refusal to discover what happened is guessing with a mutating verb. A person settles it with `abandon()` (section 10) |
| `admitted` | resume: `lap perform` has not been sent |
| `performing` | **stop and report; the row stays `performing`.** `lap perform` cannot be re-entered on an admitted run, and a fenced child may still be alive with nobody polling it. Re-running it is the one recovery that can do real damage. It holds the single-flight lock on purpose until a person settles it with `abandon()` |
| `awaiting_human` | normal; wait for `resume` (section 5) |
| `withdrawal_requested` | normal; wait for `resume` (section 5, step 5), and report the outstanding ask meanwhile (`D-0013`) |
| `stalled` | report the recorded reason; do not act |

### 7.7 The lock, and what releases each state

7.3's unique index means **every non-terminal status is a lock on the whole
conductor**, so a non-terminal state with no event that can end it is not an
inconvenience — it is a conductor that never runs again. This table is therefore
the design's real safety property, and it is a table rather than prose because a
missing row is the whole failure mode.

| non-terminal status | what releases it | goes to |
|---|---|---|
| `planned` | the interpreter, immediately | `classified`, or `abandoned` on `refused` / `needs_approval` |
| `classified` | the interpreter, immediately | `admitting` |
| `admitting` | `run admit` answering | `admitted`, or `failed` on a refusal |
| `admitted` | the interpreter, immediately | `performing` |
| `performing` | `lap perform` **answering** | `awaiting_human`, or `failed` when the answer is a refusal |
| `performing`, with no answer (timeout, or a crash) | **an operator's `abandon()`** — deliberately nothing automatic, because a fenced child may be alive (8.4) | `abandoned` |
| `awaiting_human` | `resume()` observing a non-null gate outcome; or the abort edge | `closed`, or `withdrawal_requested` |
| `withdrawal_requested` | `resume()` observing a non-null gate outcome — `withdrawn` once the surface closed it, or `subject_gone` by continuo's reconciliation | `closed` |
| `stalled` | **an operator's `abandon()`** | `abandoned` |

`abandon(iterationId, reason)` is the operating surface's escape hatch and the
last row of every path that cannot end itself. It writes a terminal row and
**drives no continuo verb**, because there is no verb here that is rondo's to
drive: if a gate is open, closing it is `D-0013`'s ask, and if a run is open,
closing it is `D-0010`'s operator. Abandoning is rondo forgetting, honestly and
on the record, that it ever knew what was happening — which is the only thing it
can truthfully do about a lap whose outcome it cannot establish.

Two rows are worth reading against each other, because they look inconsistent
and are not. A `performing` iteration that **received a refusal** releases the
lock; one that **received nothing** does not. The difference is not how bad the
outcome was, it is whether anything might still be running: continuo's refusal
families all fire either before a child exists or after the turn has ended
(`lap/cli.ts:276-292`), whereas rondo's own ceiling firing means the CLI was
killed and the fenced worker was not (8.4).


---

## 8. The continuo adapter (Majors 3, 4, 5)

### 8.1 A typed `admitRun`, and the role mapping (Major 4)

**The Major.** If the conductor builds `["--role", mappedRole]`, the executor's
vocabulary has leaked out of the adapter, which is exactly what `D-0014` rule 1
forbids.

**Agreed** (`R-12`). `src/continuo/invoker.ts` grows
`admitRun(continuo, plan): Promise<AdmitOutcome>` — a typed entry point that
takes the **neutral** role name and owns the mapping, the refusal of an unmapped
name, and the whole argv. No caller ever names a continuo role or spells a flag.

**The mapping table, and what makes it a measurement rather than a guess.**
cadenza's `ExecutorPolicy.roleName` is *structurally* validated and never
semantically: it is any identifier matching "a lowercase letter followed by up to
63 of `[a-z0-9_-]`" (cadenza `src/domain/identifiers.ts:33-38`, reached from
`agent-type.ts:378`), and cadenza states in its own words that it "does not know
which roles exist" (`agent-type.ts:89-95`). continuo's roster is exactly four
names, read off the bundled document at the pinned revision
(`src/fencing/roles.json`: `worker`, `curator`, `dispatcher`, `secretary`), and
`admitRun` refuses an unknown one with `UnknownRoleRefused` **before the
transaction opens** (`src/control_plane/run_admission.ts:203`, `:363`).

So the domain is open and the codomain is four. The proposed table, to be
recorded in `D-0019` rather than only in code:

| cadenza `executorPolicy.roleName` | continuo role |
|---|---|
| `worker` | `worker` |
| `curator` | `curator` |
| `dispatcher` | `dispatcher` |
| `secretary` | `secretary` |
| anything else | **refused**, before admission, as rondo's own vocabulary error |

The identity mapping is the honest lap-1 table because rondo has no agent types
yet and will mint the first ones itself; recording it as a table anyway is what
makes the *second* executor a change to one file (`D-0014` rule 3).

**Its falsifier and its test.** The table's grounding is continuo
`44f62336108b86cab5da791111ffa0e5b73cd01a`; it is falsified by continuo's roster
changing, by the roster becoming a runtime input rather than a bundled document
(which is `D-0014`'s own first falsifier), or by an agent type whose role name is
not one of the four. The table test asserts the whole table, both directions:
every key maps to a name in the recorded roster, every roster name is reachable,
and an unmapped name is refused **without a spawn**. What no test on either side
catches, and `D-0014` says so already, is a *mis-mapping onto a valid role*:
continuo's check is `roster.includes(role)` and nothing more.

### 8.2 `lap perform` needs a contract, and it does not exist yet (Major 5)

**Agreed** (`R-13`). `LAP_PERFORM: VerbContract<LapPerformed>` joins the five in
`protocol.ts`, with `schema: "continuo.lap.perform/1"` — read off
continuo `src/lap/cli.ts:198` rather than assumed — and a reader over the
document `report()` writes at `src/lap/cli.ts:377-402`:

| key | shape | note |
|---|---|---|
| `run_id`, `workspace`, `topic_branch`, `base_commit` | string | |
| `session_id`, `session_path` | string | `session_path` is the walk's own name (`started` / `respawned` / `resumed`), **not a filesystem path** — the header at `lap/cli.ts:383-386` says so, and a decoder that named it a path would mislead every reader downstream |
| `gate_id` | string | the gate the loop then suspends on (section 5) |
| `event_id`, `event_seq` | string, number | continuo's bookkeeping; read because they are the only handle on the ingested report |
| `endpoint_lease_failure` | object with `message`, **or null** | continuo states it is "always present, and `null` when there is nothing to say" (`lap/cli.ts:390-397`), which is exactly the absent-is-not-null rule `protocol.ts:147-171` already enforces. A `nullableObject` reader joins `nullableString` and `nullableNumber` |
| `elapsed_deadline_at_ms` | number or null | the gate deadline that passed while the worker ran and was dropped rather than losing the report (`lap/cli.ts:180-184`) |

**No `--cli-arg` field exists in the lap-1 API at all**, on `admitRun` or
anywhere else. `D-0011` rule 1 says the allowlist starts empty and the conductor
admits with none; a field that could carry one would be a place for a later
change to put one without an entry. Measured, and this is the strongest form of
the argument: continuo's own `src/fencing/cli_args_allow.json` is
`{"entries": []}` at the pinned revision, so a non-empty vector would be refused
upstream anyway — the absence of the field costs rondo nothing today and closes
the route permanently.

### 8.3 Validation happens before the spawn, not after (Major 5)

The invoker refuses exactly two argument shapes today — an empty string and an
embedded NUL (`invoker.ts:266-276`). That is the floor, and `D-0015` already
requires more: an operator's typo reaches rondo as **exit 1 and a raw stack**,
not a refusal document, and `D-0015` names `--run-id`, `--workspace`,
`--base-branch`, `--topic-branch` and `--lease-claimant-id` as reachable that
way. The typed builders of 8.1 and 8.2 are where the per-field rules go: absolute
paths where continuo requires absolute paths (and continuo's help says which and
why — `lap/cli.ts:106-172`), a run id that is non-empty and has no whitespace, an
`--endpoint-recipient` that is one of continuo's `choices`, branch names that are
not option-shaped. A value that fails is rondo's refusal, reported as rondo's,
before a process starts.

### 8.4 The timeout, which today is wrong by an order of magnitude (Major 3)

**Measured.** rondo's `INVOCATION_TIMEOUT_MS` is `60_000`
(`src/continuo/invoker.ts:102`), and its comment justifies the number against a
verb costing "about a tenth of a second". continuo's default turn timeout is
`900_000` — fifteen minutes (`src/lap/cli.ts:204`). So the current invoker would
kill `lap perform` at one fifteenth of the time continuo expects to spend, on
every real lap.

**Proposal** (`R-11`), in three parts:

1. **The timeout becomes per-verb**, carried on the `VerbContract` beside the
   schema and the reader, so the number lives with the verb it bounds. The five
   existing verbs keep 60s.
2. **rondo always passes `--turn-timeout-ms` explicitly** rather than inheriting
   continuo's default, and its own ceiling is *that value plus a teardown
   margin*. The two numbers then cannot drift, and the direction of the
   inequality is load-bearing — see 3.
3. **rondo must never be the one to fire.** continuo's own timeout does the
   teardown: its help text says the workspace and fence are left as they are and
   *"the worker's session is stopped, because a lap that gave up must not leave a
   fenced child running with nobody polling it"* (`lap/cli.ts:169-173`). rondo's
   timer calls `child.kill()` on the **CLI** (`invoker.ts:319-321`), which kills
   the poller and not the fenced child. So rondo's ceiling firing means an
   orphaned worker, and it is reported as a rondo defect requiring a human, never
   as a lap that failed. The margin exists so this cannot happen in the ordinary
   case; the report exists because "cannot happen" is not a mechanism.

Cancellation of a lap in flight is therefore **not** offered in lap 1: there is
no way for rondo to stop the child without orphaning it, and inventing one would
be reaching past the seam `D-0015` drew. An operator who must stop a lap stops
it the way they would have before rondo existed. This is a reduction, and `R-11`
records it as one.

---

## 9. Classification, and what lap 1 leaves out (Major 6)

**The Major.** Issuing a contract and never classifying against it leaves the
contract unused; cadenza `conductor.md` section 10 step 1 classifies **before**
admission and stops on `refused` and `needs_approval`.

**Proposal: classification is in lap 1** (`R-14`). It costs one call to a pure,
total function (`facade.ts:172`, over cadenza `classification.ts`), it is the
step that makes the contract load-bearing rather than decorative, and it is the
only place in the whole arc where rondo can refuse a request before anything
mutates. Concretely, at the `classify` state:

- `refused` → the iteration ends **`abandoned`** with cadenza's own `reason`
  (`classification.ts:29-36` names all seven), and nothing is admitted.
- `needs_approval` → the iteration ends **`abandoned`** with the reason, **before**
  admission. It does not admit and then ask.
- `allowed` → proceed to `reserve` and `admit`.

**Both stopping branches are terminal, and that is deliberate rather than
casual.** The tempting spelling for `needs_approval` is `awaiting_human`, and it
would be wrong twice over: there is no gate — `lap perform` has not run, so no
`worker_escalation` gate exists and `resume` (section 5) would have nothing to
observe — and `awaiting_human` is non-terminal, so under 7.3's invariant the
first askable request would hold the single-flight lock against every later
reservation, with no event in the design able to release it. A state that cannot
be left is worse than a request that ends. So the request ends, the human is
told why, and asking again is a new iteration.

**What lap 1 leaves out, recorded as a reduction rather than omitted.** The
`needs_approval` branch above is a dead end in lap 1: resuming it requires a
*widening successor contract*, and rondo may not compose one — `D-0009` part 2
and `D-0018` rule 7, which is why `delegate` and `adopt` are not imported by the
facade at all (`facade.ts:26-31`). A human's answer can only re-enter as a
successor contract the operating surface composed and handed over, and that
surface does not exist yet. So in lap 1 a `needs_approval` is reported to the
human and the request ends there. `D-0019` should say that in those words; it is
the difference between a design that defers a path and a design that has a hole.

**Verify is also out, and that is a second reduction** (`R-15`). cadenza
`conductor.md` section 10 step 4 gives the conductor its own ground-truth check
and says anything but `passed` ends the iteration. Nothing in rondo runs one, and
building one in lap 1 buys less than it looks like it would: the gate is *already
open* by the time rondo could verify (section 5), so a failing verify's only
available action is to ask the operating surface to withdraw the gate
(`D-0013`) — which is the same action a human reading the gate would take. The
recommendation is to record verify as lap-2 work with its trigger named, not to
half-build it.

---

## 10. One iteration, end to end

The lap-1 arc, in the shape of cadenza `conductor.md` section 10. Each numbered
step is a state of section 7.1; every arrow is a committed transition.

0. **Receive.** A caller hands the conductor a request text and a complete
   `RunPlan` (section 4). Nothing is persisted yet.
1. **`planned`.** `reserve()` commits the row, the plan and `plan_digest` under
   `BEGIN IMMEDIATE`. If a non-terminal iteration already exists, the reservation
   is refused here — that is `D-0012`'s single-flight, enforced by the unique
   index rather than by a promise (7.3).
2. **`classified`.** Resolve the project through the facade
   (`facade.ts:116`), build the agent-type record (`:136`), issue the initial
   contract (`:155`), classify the intended action (`:172`). The three digests
   and the outcome are committed. **`refused` and `needs_approval` both end the
   iteration at terminal `abandoned`**, with cadenza's own reason
   (section 9) — neither reaches `awaiting_human`, because no gate exists to
   observe and the status is reserved for one that does (7.1).
3. **`admitting`.** `startContinuo()` verifies the build against the pin
   (`invoker.ts:169`) and hands back the **observed** revision. That revision and
   the run id are committed *before* anything is spawned (7.5).
4. **`admitted`.** `admitRun()` maps the neutral role, validates every field,
   spawns `run admit --json`, and decodes `continuo.run.admit/1`
   (`protocol.ts:309`). A continuo refusal is the operator's answer and is
   relayed unedited; a rondo defect is reported as rondo's (`protocol.ts:75-96`).
5. **`performing`.** `performLap()` spawns `lap perform --json` with the plan's
   fields, an explicit `--turn-timeout-ms`, the `--gate-option` values the plan
   names, and rondo's own ceiling above continuo's (8.4). This is the one step
   that takes minutes.
6. **`awaiting_human`.** The lap answered, and the gate it names is **already
   open** at stage `received`. Gate id, session id and the two nullable fields
   are committed; the conductor **returns**. The process may exit (section 5).
7. **`resume`, later, from outside.** The operating surface has carried the human
   through present → deliver → ack → answer → deliver → ack, and calls
   `resume(iterationId)`. One `gate show --json` (`protocol.ts:332`). Outcome
   null → nothing changes. Outcome non-null → `closed`.
8. **Report.** The gate's outcome, the run id, the continuo revision that drove
   it, and — plainly — that the run row is still `created`, that nothing was
   pushed, and that publishing is the operator's (`D-0010`).

**Two human contacts**, which is the property cadenza `conductor.md` section 6.5
rations: the request at step 0, and the answer at step 7. Everything between is
the conductor's, and none of it can advance without a durable row saying it
happened.

**The abort edges, and there are two of them**, separated by one question: does
rondo hold a gate id?

- **After step 6, with a gate id** — the iteration was `awaiting_human` and ends
  without an answer. It transitions to `withdrawal_requested`, records the gate
  id and the reason, and **asks** the operating surface for
  `gate close --outcome withdrawn`. The conductor never writes the outcome
  (`D-0013`), and a gate whose close has been asked for is not thereby closed —
  that entry says so and this design does not improve on it.
- **During step 5, with no gate id**, and this edge splits again on one
  question: **did rondo receive an answer?**
  - **An answer arrived** — a decoded refusal, or a defect rondo diagnosed after
    the child closed. The `lap perform` process is over and no worker of its is
    still running: on an `isError` turn continuo's ingest refuses the terminal
    report and `performLap` rethrows *after* the turn ended, so there is no gate
    and no child, which is one of the two cases `D-0013` names as outside itself;
    a `LeaseHeld`, a materialisation refusal or a `SpawnRefused` never started
    one at all (continuo `lap/cli.ts:276-292` enumerates the families). The
    iteration goes to terminal **`failed`** with continuo's own words, and the
    lock is released — correctly, because nothing is running.
  - **No answer arrived** — rondo's own ceiling fired, or rondo died while
    performing. Then a fenced child may still be alive:
    [8.4](#84-the-timeout-which-today-is-wrong-by-an-order-of-magnitude-major-3)
    measures that rondo's timer kills the *CLI* and not the worker. The row
    **stays `performing`**, with the reason recorded, and keeps the single-flight
    lock. Releasing it here would let a second lap race an orphan, which is the
    one outcome this whole design exists to make impossible.

  In neither case is a `withdrawal_requested` row written: it would name a gate
  id rondo does not have. The report says plainly that a gate may or may not
  exist, and that `gate list` (`protocol.ts:319` — a verb rondo does drive) is
  how a person finds out.

The `performing` row a restart finds ([7.6](#76-restart-and-where-fail-closed-means-stop))
is the third shape of the same question and is deliberately *not* auto-resolved:
it stays `performing`, which under 7.3 blocks every later reservation until a
person settles it. That block is the fail-closed behaviour, not an accident —
a lap whose outcome is unknown is exactly the thing that must not be raced by a
second one — and the way out is an operator-invoked `abandon(iterationId,
reason)` on the access point, which writes the terminal `abandoned` row and
nothing else. It drives no continuo verb, because there is no verb here that is
rondo's to drive.

---

## 11. The test layering (Major 7)

**Agreed, and fixing it before the code is written is the point** (`R-16`).

| layer | what it may touch | what it proves |
|---|---|---|
| `test/refrain/` | **injected fakes only** — no continuo build, no cadenza call that reaches a process, no filesystem | order of the states; every refusal branch; persistence; restart from each state of 7.6; the single-flight invariant; `withdrawal_requested` on abort; the exhaustive `switch`; **and 7.7's table as a case per row** — for every non-terminal status, the named event leaves it, so a state added later without a releasing event fails a test rather than wedging a conductor |
| `test/store/` | a real `node:sqlite` in-memory or temp database | `reserve`/`transition` under `BEGIN IMMEDIATE`; the unique index actually refusing a second live row; the write order of 7.5 |
| `test/continuo/protocol.test.ts` | bytes in fixtures | the `LAP_PERFORM` decoder, including the nullable object and the absent-is-not-null rule |
| `test/cadenza/smoke.test.ts` | the real vendored cadenza, in memory | unchanged: it already runs in every cell (`D-0018` rule 6) |
| `test/continuo/smoke.test.ts` | the real pinned continuo, as a subprocess | unchanged, and it still **must not drive `lap perform`** |
| a manual dogfood layer | everything, on a person's machine | one real lap, end to end, run deliberately |

The line that matters is the last two. `D-0017` rule 6 states it in its own
words: *"`lap perform` is **not** driven: it spawns a worker, and a test suite is
not where an agent session belongs"*, and `test/continuo/smoke.test.ts:11-14`
repeats it. A full lap in ordinary CI would start an agent session on a runner,
in a job that is mandatory in every matrix cell. So the full lap is a
**documented manual procedure**, and `R-16` asks the gate where it lives: a
script under `scripts/` with a README section, or a `vitest` suite excluded from
`npm test` and run by name. The recommendation is the script, because a test file
that is not run by the test command is a file whose greenness nobody can state.

---

## 12. What would falsify this document

- **`D-0012`'s allocator arriving**, from either side. It is the trigger under
  almost everything above: the back-edge of section 2 appears, the no-progress
  halt and the review-round budget stop being dormant (section 6), and the
  single-non-terminal invariant of 7.3 becomes a capacity question rather than a
  constant.
- **continuo's lap-level serialisation going away** — `D-0012` records that the
  two changes `continuo D-0074` names are *not* the lifting, only what makes it a
  live question again. Section 2's "there is no fan-out" argument dies with it,
  and the graph option is reopened on its merits.
- **cadenza#22 landing in a shape that cannot call into rondo.** Section 5's
  resume trigger then falls back to an operator-invoked verb, and whether that is
  acceptable is a row this document does not get to close.
- **`closeOpenGate` admitting a non-human actor kind.** That falsifies `D-0013`
  first and section 5's step 4 second: the conductor could then terminate its own
  aborted gate, and the `withdrawal_requested` state has no reason to exist.
- **continuo's `run admit` or `lap perform` flag set changing.** Section 4's
  `RunPlan` is a transcription of two argument lists at one revision; a required
  flag added upstream is a plan that no longer admits, and the failure would be
  an exit 1 with a stack (`D-0015`'s exception 2) rather than a refusal document.
- **A `continuo.lap.perform/2`**, or any of the fields in 8.2 changing meaning
  without the schema moving. `D-0017`'s own accept-extra-keys falsifier applies
  here unchanged and rondo cannot detect the second case.
- **`node:sqlite` losing either measured behaviour** — the partial unique index
  or `BEGIN IMMEDIATE`'s cross-connection lock. `D-0005` names the driver swap as
  its falsifier and this design leans on both behaviours; they were measured on
  `node v22.17.0` only, and the matrix also runs Node 24 and Windows.
- **The `RunPlan` needing a field rondo has to invent** rather than receive.
  That is `R-3` failing in practice, and the answer would be the allocator or a
  configuration layer, not a default.
- **A `needs_approval` that a human wants to approve.** Section 9 records that
  lap 1 cannot resume one. The first time somebody wants to, `D-0009`'s successor
  path becomes lap-1 work and this document's reduction is wrong.
- Any measurement above failing to reproduce. Toolchain `node v22.17.0`; continuo
  at `44f62336108b86cab5da791111ffa0e5b73cd01a`; cadenza at
  `e56d7e71981232d19120d20ba6b920a5c4d762dc`.

---

## 13. The decision rows

Propose-only. Each row carries a recommendation and the reason; the gate takes
them, and `D-0019` is what records the outcome.

| id | Decision | Recommendation | Reason |
|---|---|---|---|
| **R-1** | Does `src/refrain` reach `src/continuo`, or does it reach continuo through injected ports? | **Ports**, and take `src/refrain -> src/cadenza` only | The cadenza facade owns no capability and `classify()` is total and pure; the continuo layer owns a process. `D-0017` rule 2's stated purpose — the loop is testable with no continuo on the machine — survives the port and dies under the arrow. Under this row `D-0017` needs no supersession; under the alternative it is superseded by `D-0019`, which restates rules 1 and 3-11 in force (section 3) |
| **R-2** | Where does the composition root live — a module in `src/access`, or a new layer? | **A module in `src/access`** | It is already the only layer that may see the loop, the store and the continuo seam (`import-boundaries.test.ts:148`), and `D-0009` and `D-0013` put the human-facing verbs there. A new layer for one file would be a layer named after a metaphor, which is the argument `D-0017` rule 2 used against `src/seam/` |
| **R-3** | Does the caller pass a complete `RunPlan`, or does rondo gain an allocator / configuration layer in lap 1? | **A complete `RunPlan`** | The two things rondo would have to build are the identifier allocator `D-0012` records as an open decision with measurements owed, and defaults for a fence's geometry that continuo requires be absolute and outside the worktree. Both are decisions, and `AGENTS.md` section 7 forbids taking them inside an implementation diff |
| **R-4** | Does the store persist the plan verbatim, or only a digest? | **Verbatim plus `plan_digest`** | A digest detects change and does not hand back the plan a past run used; continuo persists the admitted intent, not the executor paths or the agent type, so rondo's row is the only place the question is answerable |
| **R-5** | How does the loop reach a closed gate: synchronous polling, or suspend and resume? | **Suspend at `awaiting_human` and return; `resume(iterationId)` is called by the operating surface; `resume` drives one `gate show`, is idempotent, and serves `withdrawal_requested` on the same observation** | `lap perform` returns with the gate open at `received`; only another surface can close it (`closeOpenGate` hard-codes `actorKind: "human"`). Polling would hold a process for the length of a human's attention and turn "not answered yet" into a timeout nobody set. Cites cadenza#22 without assuming its outcome; the fallback is an operator-invoked `resume` |
| **R-6** | Loop, state graph, or eval-driven — and if a graph, a graph runtime? | **The graph's discipline, no graph runtime**: named states, a closed edge relation, a durable checkpoint per node | `nextStep` is already an edge relation rather than a loop body (`loop.ts:35`, no iteration in the layer). The graph's distinguishing feature is fan-out, which continuo refuses upstream (the global `outbox-delivery` lease), and its back-edge needs the allocator `D-0012` says does not exist. A second runtime dependency to model a linear walk is not defensible at this size |
| **R-7** | Where does evaluation sit, and is a model-judged evaluator admitted in lap 1? | **Three deterministic positions — cadenza `classify()`, verify, the human gate — and no model judge in lap 1** | rondo is already eval-driven with total, pure evaluators. A model judge puts a non-deterministic verdict on the path to the one human contact this design rations, cannot be a unit case, and its most valuable output is a retry the lap-1 arc cannot perform |
| **R-8** | Does `nextStep` stay pure, and where do the effects go? | **`nextStep` stays a total pure function; a separate async interpreter executes effects through injected ports; `Step` grows to the lap-1 state union** | It is the one property `src/refrain/` has, its external allowance is empty, and every existing case in `test/refrain/loop.test.ts` keeps passing. Unknown or corrupt state closes to "stop and ask", which is the rule `loop.ts:42-54` already applies |
| **R-9** | What do `LoopPolicy`'s two axes mean in lap 1, and when is the policy read? | **Both dormant, and recorded as dormant.** `CONSERVATIVE_POLICY` stays the default, the runner requires an explicit policy to proceed, and **the policy is read before `reserve()`** so a policy stop refuses the request instead of reserving a row | Measured: the default returns `ask_human` for a `planned` record (`policy.ts:34-37` with `loop.ts:39`), so a runner defaulted to it admits nothing, ever. With one lap per request `maxIterations` has no second iteration to bound and every iteration ends at a human gate anyway — the same dormancy `D-0012` already records for the no-progress halt and the review-round budget. Reading the policy before reservation is what keeps an ordinary configured stop from taking the single-flight lock (7.3, 7.7) |
| **R-10** | What replaces `read`/`write`, and what guarantees the conductor can always run again? | **`reserve()` and `transition()` with `BEGIN IMMEDIATE` inside them; a partial unique index making "at most one non-terminal iteration" the database's invariant** (shape B, the generated marker column); **and every non-terminal status carrying a named releasing event ([7.7](#77-the-lock-and-what-releases-each-state)), with an operator `abandon()` as the last row of the paths that cannot end themselves** | An in-memory mutex breaks on restart. Both index shapes were measured working on `node:sqlite` / `node v22.17.0`, as was `BEGIN IMMEDIATE` refusing a second writer across connections. `BEGIN IMMEDIATE` for the reason continuo gives on its own admission path. The releasing-event table is the half that makes the invariant safe rather than merely correct: under the index, a non-terminal state nobody can leave is a conductor that never runs again |
| **R-11** | What bounds a `lap perform` invocation, and what happens on restart while performing? | **Per-verb timeouts on the contract; rondo passes `--turn-timeout-ms` explicitly and sets its own ceiling above it with a teardown margin; no cancellation in lap 1; a `performing` row found at startup stops and reports** | rondo's 60s (`invoker.ts:102`) against continuo's 15-minute default (`lap/cli.ts:204`) would kill every real lap. rondo's timer kills the CLI, not the fenced child — continuo's own timeout is what stops the worker session — so rondo firing first means an orphan, and that is a defect to report rather than a lap that failed |
| **R-12** | Where does the role mapping live, and what is the table? | **A typed `admitRun()` on the invoker owning the mapping, the refusal and the argv; the identity table over continuo's four roster names, recorded in `D-0019` with its falsifier and a table test** | `D-0014` rule 1 forbids the executor's vocabulary above the adapter, and cadenza's `roleName` is validated structurally only — any identifier is a legal neutral name, and the codomain is four. A mis-mapping onto a *valid* role is undetected at both ends, and `D-0014` already says so |
| **R-13** | Does `lap perform` get a decoder, and does the lap-1 API carry a `--cli-arg` field? | **Yes to the decoder (`continuo.lap.perform/1`, the eleven fields of 8.2, semantic validation before the spawn); no `--cli-arg` field anywhere** | `D-0011` rule 1 admits with none, and continuo's own allowlist is `{"entries": []}` at the pinned revision — so the field costs nothing to omit and omitting it closes the route permanently. Validation before the spawn because an operator's typo reaches rondo as exit 1 and a stack, not a refusal document (`D-0015`) |
| **R-14** | Is admission-time classification in lap 1? | **Yes**, and **both stopping branches are terminal (`abandoned`)** — `refused` and `needs_approval` alike — with the successor-contract path recorded as a lap-1 reduction | It costs one call to a total pure function and it is what makes the contract load-bearing. Resuming a `needs_approval` needs a widening successor rondo may not compose (`D-0009` part 2, `D-0018` rule 7), so that branch is a dead end in lap 1. Spelling it `awaiting_human` would be the deadlock 7.1 names: non-terminal, no gate to observe, and holding the single-flight lock with no event able to release it |
| **R-15** | Is the conductor's own verify (cadenza `conductor.md` section 10 step 4) in lap 1? | **No — recorded as a reduction with its trigger named** | The gate is already open before rondo could verify, so a failing verify's only available action is the withdrawal ask a human reading the gate would make anyway. Half-building it would put an untested branch on the path to the human contact |
| **R-16** | Where is the boundary between the test layers, and where does a real lap run? | **`test/refrain/` on injected fakes only; real cadenza and real continuo confined to the two existing smokes; the full lap a documented manual dogfood, as a script rather than an excluded test file** | `D-0017` rule 6: a test suite is not where an agent session belongs, and the continuo smoke is mandatory in every matrix cell. A test file excluded from `npm test` is a file whose greenness nobody can state |

---

## 14. The entry the gate would create

`D-0019` — *the first working conductor loop: a pure planner, an interpreter over
injected ports, a durable single-flight store, and a suspend at the open gate.*
It would record the sixteen rows above with their outcomes; add
`src/refrain -> src/cadenza` to the boundary table (or, under `R-1`(b), supersede
`D-0017` and restate rules 1 and 3-11); annotate `D-0017` rule 5 and `D-0015`
rule 6 as discharged by the store schema; annotate `D-0018` rule 5 as the arrow
having been taken; carry the role mapping table with the continuo revision it was
read at; and state its own falsifiers, which are section 12's.

This document does not write it, and nothing in `src/` changes until it exists.

**One correction already applied.** `README.md` said ten of the eleven continuo
verbs rondo drives answer `--json`. That was true when `D-0015` was taken and
stopped being true when `continuo D-0092` gave `gate close` the envelope, which
is what `D-0017` rule 1 acts on; the line now says all eleven. It is a stale
measurement in a Status section, not a decision, so it is corrected here rather
than routed through a row.
