# The advisory component: what it proposes, and what it may never issue

**Status: propose-only.** This document takes no decision. It measures what is in
the tree today, proposes a design for the component rondo#9 describes — the thing
that reads rondo's own records and **proposes** an agent type, a `RunPlan`, a
contract's candidate key sets, a widening successor — and ends in a table of
decision rows (`A-1` … `A-14`) for rondo's human gate. Per
[`../../AGENTS.md`](../../AGENTS.md) section 7 the rows are named rather than
settled here, and the entry the gate would create is referred to throughout as
**`D-0021`** — a name for a thing that does not exist, not a citation. Nothing in
`DECISIONS.md` changes with this document, and nothing in `src/` changes until
that entry exists.

It is written in the shape of
[`refrain-lap1.md`](refrain-lap1.md): measured claims carrying `file:line`, an
end-to-end walk, a falsification section, and a decision table. Line references
are to the revisions named in
[section 1.7](#17-what-was-measured-and-at-which-revisions); they drift, and the
claim rather than the number is what a later reader should re-measure.

A **pre-design review by Codex** on 2026-09-06 found three Blockers, four Majors,
two Minors and one Nit against an earlier sketch. Every one of them is answered
below, either as a decision row or as a measured refutation, and each is named
where it is answered. Where the answer is a refutation it says so and shows the
measurement, because a review finding dismissed without one is a finding
deferred.

**The component is not scheduled before lap 1 lands**, and rondo#9 says so. What
this document adds is that the schedule is not the only constraint: three of its
parts are blocked on things that do not exist yet, and
[section 9](#9-what-this-depends-on-and-what-it-can-do-without-major-7) separates
what can be built now from what cannot.

---

## 0. What the advisory has to become, in one paragraph

Today the role rondo#9 describes is played by a person's secretary: it explains
what a design says, proposes options, triages, drafts the brief that becomes a
delegation, and remembers across sessions. Everything in that list is **producing
decision material**, and none of it is deciding. The component this document
proposes is that role with its authority removed by construction rather than by
promise: a **total, pure function from a durable snapshot to a proposal**, living
in a layer that cannot reach cadenza, cannot reach continuo, cannot start a
process and cannot write a row. It proposes; a human approves at a gate; and a
separate surface — never this component — composes the approved contract and
issues it exactly once. The whole of the design is that separation, made
structural, plus the ledger that records which proposal a human actually
approved.

---

## 1. What is true today, measured

### 1.1 There is nothing advisory in the tree, and `src/access` is a composition root

`src/access/` holds three modules and nine exported names.
[`src/access/conductor.ts`](../../src/access/conductor.ts) is the composition
root D-0019 rule 2 put there: `conductorPorts` (`conductor.ts:162`),
`openConductor` (`:241`), and the four entry points the operating surface calls —
`admit` (`:269`), `resume` (`:286`), `requestWithdrawal` (`:298`) and `abandon`
(`:317`). [`src/access/console.ts`](../../src/access/console.ts) holds
`asciiEscape` (`:55`) and `relayUpstream` (`:90`), which are D-0004's rule and
D-0015 rule 7's relay. [`src/access/local.ts`](../../src/access/local.ts) holds
`describeNextStep` (`:27`), which calls the planner and adds nothing.

So there is no module that reads the store to explain it, no record kind for a
proposal, and no caller that would consume one. The component is entirely new,
which is why this document is a design rather than a refactor.

### 1.2 The store answers two questions about one iteration, and no question about history

[`src/store/sqlite.ts:122`](../../src/store/sqlite.ts) declares `IterationStore`
with exactly five operations: `reserve` (`:124`), `transition` (`:126`), `read`
by id (`:145`), `readLive` (`:147`) and `settle` (`:165`). **There is no listing,
no query and no ordering.** A component whose first sentence is "reads the store
(iterations, plans, digests, gate outcomes)" cannot be written against this
interface at all: it can be handed one row it already knows the id of, or the one
row that is currently live, and nothing else.

That is not an oversight in D-0019 — the conductor is single-flight and never
needed a second row — but it is a measured prerequisite, and it is the smallest
one this component has.

The row itself is rich enough for most of what a proposal wants to cite.
[`src/store/records.ts:154`](../../src/store/records.ts) declares
`IterationRecord` carrying, among its twenty-three fields, the `RunPlan` **verbatim**
(`records.ts:168`) beside its `planDigest` (`:170`), the observed
`continuoRevision` (`:193`), and cadenza's three digests — `agentTypeDigest`,
`configDigest`, `contractDigest` (`:195-197`). D-0019 rule 4's reason for
persisting the plan verbatim is exactly the property an advisory component needs:
*a digest detects change and does not hand back the plan a past run used.*

### 1.3 The contract is composed, classified against, and then thrown away

[`src/refrain/classification.ts:67`](../../src/refrain/classification.ts)
(`classifyPlan`) resolves the project, builds the agent-type record, issues the
initial contract and classifies the intended action, and returns a
`ClassificationRecord` of six strings
([`src/refrain/ports.ts:103-110`](../../src/refrain/ports.ts)): the outcome, the
reason, three digests and the neutral role name. **The `DelegationContract`
itself is a local value inside that function and is never returned, never
persisted and never seen again.**

So "propose the contract's `granted` / `askable` lists" has no predecessor to
diff against today: rondo can say *which* contract a past run was classified
under (its digest) and cannot say *what that contract said*. D-0020 rule 4 is the
decision that fixes this — the delegation record, with the contract's fields *as
issued* rather than a rendering of them, so that `contract_digest` can be
recomputed rather than trusted — and that entry decides and does not build. Its
DDL is unwritten.

### 1.4 The pinned cadenza cannot compose a successor, and the cadenza that can is not the pin

Measured on the installed package, which is the artefact rondo actually consumes
(`vendor/suisya-systems-cadenza-0.0.0.tgz`, verified by
`node vendor/pin.mjs check` before `npm ci --ignore-scripts`):
`node_modules/@suisya-systems/cadenza/dist/index.d.ts` exports twenty-one lines
of names, and `supersedeOnDecision`, `humanDecisionRecord`, `HumanDecisionRecord`
and `DecisionOutcome` appear in **none** of them. `adopt` and `delegate` are
exported (`index.d.ts:57`) and are deliberately not imported by rondo:
[`src/cadenza/facade.ts:26-31`](../../src/cadenza/facade.ts) says why in its own
words, and the boundary test grants that module **sixteen named bindings**
(`test/architecture/import-boundaries.test.ts:238-256`), of which neither is one.

The four names D-0036 adds exist at cadenza `5d5d9f408c29f6500c422c8e10e6b6a3a6882aaf`
and not at the pinned `e56d7e71981232d19120d20ba6b920a5c4d762dc`. **This is a
measurement, not a complaint**: it means every part of this design that touches a
widening successor is blocked behind phase 1 of cadenza's delivery bridge
(`D-0018`: clone at the new sha, build, `npm pack`, `node vendor/pin.mjs record`,
and the tarball, digest, pin file and lockfile move together as one diff), and
that the pin move is a change with its own diff and its own review rather than a
line in this one.

### 1.5 continuo already publishes the human's answer, and rondo's decoder reads past it

continuo's `gate show --json` payload is built key by key at
`src/gate/cli.ts:416-447` (read via `git show 44f6233:src/gate/cli.ts` in a
sibling checkout — see [1.7](#17-what-was-measured-and-at-which-revisions)), and
it carries `subject_kind`, `subject_id`, `deadline_at_ms`, `outcome`,
`rationale`, `options`, a `relays` array, and a `transitions` array whose
elements carry `actor_kind`, `actor_id`, `recorded_at_ms` and **`body`** — the
verbatim text the human typed.

rondo's decoder reads five of those.
[`src/continuo/protocol.ts:319-326`](../../src/continuo/protocol.ts) declares
`GateDetail` as `gateId`, `gateType`, `runId`, `stage`, `outcome`, and its own
header says the relays and transitions "are read past" (`:317-318`). Six verb
contracts exist — `DB_CREATE` (`:425`), `RUN_ADMIT` (`:435`), `GATE_LIST`
(`:446`), `GATE_SHOW` (`:460`), `GATE_CLOSE` (`:473`), `LAP_PERFORM` (`:499`) —
and **there is no `GATE_ANSWER` contract**, which is one of the two write verbs
`cadenza S-4` (rondo D-0020 rule 1) puts in the first cut.

Two consequences, and they point in opposite directions, which is why both are
worth stating. The human's answer **is** reachable through an admitted `--json`
verb, so an advisory component can explain what a human decided without anybody
opening a database file. And it is **not** reachable today, so the read path is a
widening of one decoder that the gate-pane work needs anyway.

### 1.6 The arrows, as the boundary test states them

[`test/architecture/import-boundaries.test.ts:124-161`](../../test/architecture/import-boundaries.test.ts):

| layer | may import |
|---|---|
| `src/store` (`:127`) | `src/store` |
| `src/refrain` (`:140`) | `src/refrain`, `src/store`, `src/cadenza` |
| `src/continuo` (`:145`) | `src/continuo` |
| `src/cadenza` (`:154`) | `src/cadenza` |
| `src/access` (`:160`) | `src/access`, `src/continuo`, `src/refrain`, `src/store` |

**`src/access -> src/cadenza` is refused**, and the table says why in a comment
directly above the row: *"an access point that needed a delegation contract would
be an access point taking a domain decision, and D-0018 rule 5 says the arrow to
add first is the loop's."* Section 2.3 answers that sentence rather than working
around it.

Externals are granted **per module**: `node:sqlite` to `src/store/sqlite.ts`
(`:211`), `node:crypto`'s `createHash` to `src/store/plan.ts` (`:219`), `spawn`
to `src/continuo/invoker.ts` (`:226`), and the sixteen cadenza bindings to
`src/cadenza/facade.ts` (`:238-256`). Internals are granted **per layer**. That
asymmetry is load-bearing in [2.2](#22-the-advisory-is-a-pure-function-and-its-layer-is-what-makes-that-true-a-1-a-2)
and is the reason this design does not put the component in `src/access`.

### 1.7 What was measured, and at which revisions

**2026-09-06**, toolchain `node v22.17.0`, against:

- rondo at this branch's HEAD, `878eea436600e79acc743b6bf5ed0fa0ccd85e27`;
- **continuo at `44f62336108b86cab5da791111ffa0e5b73cd01a`** — the revision
  `continuo.pin.json` pins. The sibling checkout's HEAD is *ahead* of the pin, so
  every continuo line cited above was read with
  `git show 44f6233:<path>` rather than out of the working tree. A citation of a
  file a checkout happens to be sitting on would be a claim about somebody's
  checkout rather than about the build rondo drives;
- **cadenza at two revisions, deliberately.**
  `e56d7e71981232d19120d20ba6b920a5c4d762dc` is what `cadenza.pin.json` names and
  what the vendored tarball was packed from; it is the surface rondo can call
  today. `5d5d9f408c29f6500c422c8e10e6b6a3a6882aaf` is where `D-0036` was
  accepted, and it is cited **only** for what that entry decides — never as an
  API rondo has. [1.4](#14-the-pinned-cadenza-cannot-compose-a-successor-and-the-cadenza-that-can-is-not-the-pin)
  is the measurement of the difference.

**Every reading above is design-time.** None of it is a read path this design
gives the component at runtime; [section 3](#3-what-the-advisory-may-read-major-5)
is that rule, and it is the answer to Codex's Major 5.

---

## 2. Three authorities, and the advisory is only the first (Blocker 3)

**The Blocker.** The sketch had one component reading the store, composing a
successor contract and handing it to a gate. Codex found two faults with that and
both are measured: `src/access -> src/cadenza` is refused
([1.6](#16-the-arrows-as-the-boundary-test-states-them)), and the facade exposes
no successor API at all ([1.4](#14-the-pinned-cadenza-cannot-compose-a-successor-and-the-cadenza-that-can-is-not-the-pin)).
The fix it asked for is a separation of three authorities, and this section takes
it.

### 2.1 The three

| authority | what it does | where it lives | what it may not do |
|---|---|---|---|
| **(a) advise** | produce *candidate data*: which agent type, which plan or plan diff, which capability keys, and the prose that explains a stored state | `src/advisory/` (new layer, `A-1`) | reach cadenza or continuo; write anything; name a contract digest it computed itself |
| **(b) compose** | turn a candidate into an actual `DelegationContract` and its `contract_digest`, so that a human can be shown the exact thing they are approving | `src/cadenza/facade.ts`, called from `src/access` (`A-4`) | present, approve, or issue |
| **(c) issue and consume** | after an approval, call `supersedeOnDecision` **once**, in the same transaction that marks the decision spent | the operating surface, in `src/access` (`A-4`, `A-9`) | compose a successor of its own; edit what was approved |

The separation is not three files for tidiness. It is the shape cadenza `D-0036`
forces: the human approves a **specific successor identified by its digest**, so
the successor must be *composed before it is presented*, and the thing that
composes it must therefore be reachable from the presenting surface and not from
the advisory. cadenza states the consequence in its own words — *"the widening
must be composed before it is presented, because the digest is what is
presented."*

### 2.2 The advisory is a pure function, and its layer is what makes that true (`A-1`, `A-2`)

rondo#9 names `src/access` as the candidate layer. **This document refuses that,
and the refutation is a measurement rather than a preference.** Internals are
granted per *layer* and externals per *module*
([1.6](#16-the-arrows-as-the-boundary-test-states-them)), so "the advisory module
may not import cadenza, though its neighbours may" is a rule the boundary test
cannot express. If the advisory sits in `src/access` and `A-4` grants that layer
the cadenza arrow, then the component that must never compose a contract sits in
the one layer that may — enforced by nothing but a review comment. That is the
grade of guarantee `D-0009` already refused for exactly this obligation.

**Proposal (`A-1`): a new layer, `src/advisory/`, whose internal allowance is
`["src/advisory", "src/store"]` and whose external allowance is empty.** It gets
`src/store` for the record types it cites and nothing else; `src/access` gains
`src/advisory` so the composition root can call it. Under that table the
component *cannot* import cadenza, *cannot* import continuo, *cannot* import the
loop, and — with an empty external allowance, the same one `src/refrain/` has —
cannot open a file, a socket or a process. "Expresses no authority" stops being a
sentence in a design document and becomes a case in the test that already runs on
every commit.

This is the argument `R-2` rejected for the composition root ("a layer named
after a metaphor"), applied to a case where it comes out the other way. The
composition root needed to see three layers and a new layer would have *added*
reach. This layer exists to **remove** reach, and there is no existing layer with
the allowance it needs: `src/store` names only itself, `src/refrain` holds the
cadenza arrow, and `src/access` holds the process seam.

**Proposal (`A-2`): the advisory is a total, pure function of an injected
snapshot.** `propose(snapshot: AdvisorySnapshot): Proposal`. The snapshot is a
frozen value the composition root gathered — iteration rows out of the store,
gate detail out of an admitted `--json` verb, the delegation record when it
exists — and the advisory reads no clock, does no I/O and returns a value. Three
things follow, and the third is the point:

- `test/advisory/` needs no database, no continuo build and no cadenza package —
  the same property `D-0019` rule 1 bought for `test/refrain/`;
- every proposal is reproducible from its snapshot, which is what makes the
  reproducibility fields of [section 8](#8-the-proposal-record-minor-8-and-the-words-it-uses-minor-9) worth persisting;
- **a function that returns a value cannot issue one.** The advisory's inability
  to act is a type, not a discipline.

The cost, named rather than hidden: gathering the snapshot is real work that the
composition root has to do, and a snapshot missing a field the advisory needed is
a defect that shows up as a worse proposal rather than as a refusal. The design
answers that the way `D-0019` rule 8 answers an unclassifiable row — a proposal
the advisory cannot ground in its snapshot is not emitted; it says what it would
have needed.

### 2.3 Where the composer is called from, and the arrow that needs (`A-4`)

Composition can only *live* in `src/cadenza/facade.ts`: that is the one module
granted the package, by decision (`D-0018` rule 5), and a second module in that
layer is not granted it. So the question is not where the code goes but **which
layer may call it**, and there are three answers.

- **(a) `src/access` gains `src/cadenza`** — the recommendation. The boundary
  table's stated objection is *"an access point that needed a delegation contract
  would be an access point taking a domain decision"*, and under cadenza `D-0036`
  that sentence has been overtaken: `D-0009` part 2 and `D-0020` rule 2 both put
  the **issuer** of a widening successor at the operating surface, and the issuer
  is in `src/access`. An access point composing the contract it is about to
  present, and then issuing the one a human approved by digest, is not taking a
  domain decision — it is carrying one, which is the thing `D-0009` says this
  layer exists to do. The row is `A-4` because it edits a table whose comment
  argues the other way, and a table's comment is not a thing to quietly
  contradict in an implementation diff.
- **(b) `src/refrain` composes it**, since that layer already holds the cadenza
  arrow. **Rejected, and measurably**: `D-0018` rule 7 keeps `delegate` and
  `adopt` out of the facade specifically so the machinery is not *"one import away
  from a loop that must not have it"*, and this branch puts it exactly there. It
  also puts contract composition in the layer whose defining property is that
  `nextStep` is total and pure over a record.
- **(c) a new `src/successor/` layer between the two.** Rejected as the layer
  `R-2` warned about: it does not remove the import from the facade (nothing can
  — the grant is per module), and it adds a layer whose only job is to be called
  by one caller.

Under (a) the advisory still never calls the composer, and cannot: it is in a
layer that names neither `src/cadenza` nor `src/access`.

### 2.4 The pin has to move before any of this is buildable (`A-5`)

`supersedeOnDecision` and `humanDecisionRecord` are not in the artefact rondo
installs ([1.4](#14-the-pinned-cadenza-cannot-compose-a-successor-and-the-cadenza-that-can-is-not-the-pin)).
**Proposal (`A-5`): the pin move is its own change, before the successor path is
implemented and after this document's entry exists**, following `D-0018`'s bridge
verbatim — the tarball, `vendor/cadenza.tgz.sha256`, `cadenza.pin.json`,
`package.json` and `package-lock.json` move together, and
`test/cadenza/pin.test.ts` is what fails if they stop describing one file. The
facade then gains `composeSuccessor` and the boundary test gains the two bindings
by name, which is `D-0018` rule 5's own mechanism and not an exception to it.

Until that lands, everything in
[sections 3](#3-what-the-advisory-may-read-major-5), 4, 6, 7 and 8 is still
buildable and the successor half of [section 5](#5-the-widening-successor-under-cadenza-d-0036-blocker-1)
is not. That split is [section 9](#9-what-this-depends-on-and-what-it-can-do-without-major-7).

---

## 3. What the advisory may read (Major 5)

**The Major, and it is accepted in full.** The sketch let the component read
sibling checkouts — cadenza's and continuo's source — the way this document's own
section 1 does. That is a legitimate way to write a design and an illegitimate
way to run a program, and conflating the two is how a runtime acquires a
dependency nobody decided.

**Proposal (`A-3`): two read paths, named, and everything else refused.**

| | design time (this document) | runtime (the component) |
|---|---|---|
| rondo's store | cited by `file:line` | **yes** — the iteration rows, and the delegation and conversation records when `D-0020` rules 4 and 5 are built |
| the pinned cadenza | the installed `dist/`, and the sibling checkout for `D-0036`'s text | **through the facade only**, and never from the advisory layer itself ([2.2](#22-the-advisory-is-a-pure-function-and-its-layer-is-what-makes-that-true-a-1-a-2)) |
| continuo | `git show <pinned sha>:<path>` in a sibling checkout | **admitted `--json` verbs only**, decoded by `src/continuo/protocol.ts`, invoked by the composition root and handed to the advisory in its snapshot |
| a sibling checkout at runtime | — | **never** |
| continuo's SQLite file | — | **never.** `D-0015` rule 1 keeps continuo behind a process boundary, and `cadenza S-10` names "the pane with no read path" as exactly where somebody opens the database file instead |
| a model, an index, a memory store | — | not in the first cut (`A-13`) |

Two notes on the middle row. The verbs admitted today are the six of
[1.5](#15-continuo-already-publishes-the-humans-answer-and-rondos-decoder-reads-past-it),
so "what a human answered" needs `GATE_SHOW`'s reader widened to carry the
`transitions` array — a change the gate-detail pane of `D-0020` rule 1 needs
independently. And a widened reader is still a **read**: the advisory receives the
answer as snapshot data and never persists a copy of it, for the reason
[section 6](#6-one-ledger-per-fact-major-4) gives.

---

## 4. What a proposal may say about a `RunPlan` (Blocker 2)

**The Blocker.** "Propose a `RunPlan`" reads as an allocator with a friendly
name, and `D-0019` rule 3 is explicit that the caller hands rondo a complete plan
and rondo invents no run id, no workspace, no branch and no fence geometry —
because the two things it would have to build are the allocator `D-0012` records
as an open decision and defaults for a fence's geometry continuo requires be
absolute and outside the worktree.

**Accepted, and the proposal is narrowed to three shapes** (`A-6`). A proposal
about a plan may be:

1. **a selection** — "of the plans this store already holds, `plan_digest`
   `sha256:…` is the closest fit, and here is why";
2. **a diff** — a list of `(field, value in the predecessor, proposed value)`
   triples against a **named** predecessor plan that exists in a row, where every
   field is one of the plan's own;
3. **a hole list** — the fields the proposal deliberately does not fill, which
   the caller must supply before anything can be admitted.

The third shape is not a courtesy, it is the load-bearing one. `D-0012` records
that a second attempt needs a fresh `(run id, topic branch, workspace)` triple
and that **nothing allocates one**, so a proposal that filled those fields would
either be reusing an admitted run id — which `run admit` refuses — or minting one,
which is the allocator. `leaseClaimantId` joins them for the same reason, and the
fence roots (`artifactRoot`, `stateRoot`, `interlockRoot`, `claudeOrgPath`,
`endpointDestinationDir`, `claudeCommand`) join them because continuo requires
each to be absolute and outside the worktree and a rondo-side default would be
rondo guessing at a fence's geometry. The plan's shape is measured: `RunPlan` is
declared at [`src/refrain/plan.ts:85-202`](../../src/refrain/plan.ts) with
thirty-one fields, of which the ten named above plus `db` and `repository` are
the caller's identifiers and the operator's environment, and the request text is
one.

**What a proposal therefore is, at its most useful**: a `plan_digest` to start
from, a small diff of prompt, agent type, gate options and timeouts, and an
explicit list of the fields a person still has to fill. That is materially less
than "here is your run", and it is what `D-0019` rule 3 leaves room for.

**The alternative is a row and not a refutation.** If the gate wants proposals
that can be admitted without a human filling a field, that is an allocator, it
changes `D-0019` rule 3, and it is `rondo#8` — not a paragraph in this document.
`A-6` records both branches so the gate can take the second one knowingly.

---

## 5. The widening successor, under cadenza `D-0036` (Blocker 1)

**The Blocker.** cadenza `D-0036` is settled and this design must consume it
rather than re-decide it. Three of its properties bind here directly:

- **the human approves a specific successor, identified by the digest of the
  exact contract they were shown** — not a granted/askable *list*, and not "a
  widening over this predecessor". cadenza states the reason: a record naming
  only the predecessor *"would let any successor over that predecessor be issued
  under it — a decision about a two-key widening would authorise a ten-key one"*;
- **the successor must therefore be composed before it is presented**, which is
  why composition is authority (b) in [2.1](#21-the-three) and sits with the
  presenting surface;
- **`HumanDecisionRecord` is forgeable and cadenza says so**, asserting it as a
  *passing* test. The four checks in `supersedeOnDecision` are value checks
  against a class of silent error and are claimed at that grade and no higher.

**What this design adds, and it is the only thing it may add** (`A-9`): cadenza
cannot enforce that one decision authorises **at most one** issuance, because it
persists nothing and says so — *"that duty is the store's, and it is row `S-7`,
rondo's."* `D-0020` rule 4's sixth fact is that duty accepted. So single use is
rondo's to build, and it is built where rondo already enforces an invariant it
cannot promise: in the database, inside one `BEGIN IMMEDIATE` transaction
([6.3](#63-single-use-is-a-transaction-not-a-check-a-9)).

**What the advisory does with all of this is smaller than it sounds.** It
proposes **candidate capability key sets** — "these keys, because the lap stopped
at `needs_approval` for this reason, and this predecessor granted these" — as
data. It never composes a contract, never computes a digest it would then present
as authoritative, and never names itself as `issuer` or `recordedBy`. The words
matter and [section 8](#8-the-proposal-record-minor-8-and-the-words-it-uses-minor-9)
fixes them.

---

## 6. One ledger per fact (Major 4)

**The Major.** "A single auditable ledger" is the operator's stated priority and
it is easy to implement as its opposite: a proposal row that gets overwritten to
`approved`, or a chat record that quotes the gate answer and becomes a second
place the answer lives. `D-0020` rule 5 already refuses the second in as many
words — *"a gate answer never lives in the conversation"*, because prose in that
slot records as human approval.

### 6.1 The table

**Proposal (`A-8`): one home per fact, and every other mention is a reference.**

| fact | source of truth | how everything else names it |
|---|---|---|
| the human's gate answer | **continuo**, `gate_transition.body`, read through `gate show --json` | `(gate_id, transition seq)` |
| that a gate was answered, and its outcome | **continuo**, the gate's own stage and outcome | `gate_id`; rondo's iteration row caches `gateStage`/`gateOutcome` as *last observed*, which `records.ts:211-213` already spells |
| what rondo proposed | **rondo store**, `proposal` rows, immutable | `proposal_id` + `proposal_digest` |
| the human decision that approved a successor | **rondo store**, `human_decision` rows, immutable and single-use | `decision_id` |
| the contract as issued, and its lineage | **rondo store**, the delegation record (`D-0020` rule 4 facts 1, 2 and 5) | `contract_digest` |
| the agent type a run was issued under | **rondo store**, `D-0020` rule 4 facts 3 and 4 | `agent_type_digest` |
| one iteration's state and provenance | **rondo store**, the `iteration` table (`D-0019` rule 10) | `iteration_id` |
| the operator conversation | **rondo store** (`D-0020` rule 5), and never the gate-answer slot | message id |
| the run's execution | **continuo** | `run_id` |

The rule that makes it a ledger rather than a list: **a fact is written once, in
its own home, and referenced everywhere else by an identifier that cannot drift.**
Where a copy is unavoidable — the iteration row's `gateStage` and `gateOutcome` —
it is labelled as an observation with the revision and time it was observed at,
and no reader treats it as authority.

### 6.2 Immutable proposal, immutable decision, referenced issuance (`A-7`)

**A proposal row is never updated.** It has no `status` column, and that absence
is the design: a proposal that can be rewritten to `approved` is a record of what
somebody wishes had been proposed. The chain is three immutable rows and two
references:

```
proposal (immutable)  <-- decision.proposal_id --  human_decision (immutable)
                                                        |
                                          delegation.decision_id
                                                        v
                                            delegation record (append-only lineage)
```

"What was proposed, and what was approved" is then a join rather than a memory,
and a proposal that was never approved stays readable forever as the thing that
was not taken. A second proposal supersedes a first by referencing it, exactly as
`DECISIONS.md` supersedes an entry — the repository already runs on this rule and
this is it applied to a table.

### 6.3 Single use is a transaction, not a check (`A-9`)

`human_decision` carries `decision_id` as its primary key and a `consumed_by`
column that is `NULL` until an issuance names it. The issuance and the
consumption happen in **one `BEGIN IMMEDIATE` transaction**: assert `consumed_by
IS NULL`, insert the delegation row, set `consumed_by`, commit. A second attempt
finds a non-null column and is refused.

`BEGIN IMMEDIATE` for the reason `D-0019` rule 10 already gives, quoting
continuo's own admission path: under a deferred transaction the write lock is
taken at the first write, which leaves a window where two readers both believe
they may proceed. The store is where this is enforceable and the only place: an
in-process check is the guarantee `D-0036` already said it could not make.

---

## 7. After a `needs_approval` (Major 6)

**Measured.** `D-0019` rule 15 ends a `needs_approval` iteration at terminal
`abandoned`, and the interpreter does it with cadenza's own reason
([`src/refrain/interpreter.ts:756-765`](../../src/refrain/interpreter.ts)); the
entry records the reduction and its trigger — *"the first time a human wants to
approve one"* — and rondo#9 is that trigger arriving.

**Proposal (`A-10`): the abandoned iteration is never revived, rewritten or
resumed; a new one is linked to it by lineage.**

1. The abandoned row stays exactly as it is. `transition` asserts the status it
   is leaving (`sqlite.ts:126`), and the row is terminal, so this is a property
   the store already has rather than a rule the advisory must keep.
2. A proposal about it carries `supersedes_iteration_id`, which is a reference
   and not a claim on the row.
3. If a human approves, the approval produces a **new** contract (a successor
   whose `supersedes` is the predecessor's digest), a **new** `RunPlan` — with a
   fresh `(run id, topic branch, workspace)` triple the caller supplied
   ([section 4](#4-what-a-proposal-may-say-about-a-runplan-blocker-2)) — and a
   **new** iteration.
4. The chain that answers "why does this run exist" is then
   `iteration -> proposal -> decision -> contract -> iteration`, every link a
   reference, and no row edited after the fact.

**Why not resumption**, stated once: resuming would mean re-entering a terminal
state, which `D-0019` rule 10's edge relation refuses, and it would mean a second
lap under a run id that continuo has already admitted. Lineage costs a join;
revival costs the invariant.

---

## 8. The proposal record (Minor 8), and the words it uses (Minor 9)

**Proposal (`A-7`), the row.** At least:

| column | why it is there |
|---|---|
| `proposal_id` | the reference every other row uses |
| `kind` | one of `agent_type`, `run_plan`, `contract_keys`, `widening_successor`, `explanation` — a closed union, so an unknown kind is a row the reader refuses rather than guesses at |
| `drafter` | who or what drafted it (`A-13`), as an identifier and never as an authority |
| `payload` + `proposal_digest` | the candidate verbatim beside a digest of those bytes, digested the way `plan_digest` is (`src/store/plan.ts:76`, `node:crypto` granted by module at `import-boundaries.test.ts:219`) |
| `snapshot_digest` | over the snapshot the advisory was handed, so a proposal can be **re-derived** rather than only re-read ([2.2](#22-the-advisory-is-a-pure-function-and-its-layer-is-what-makes-that-true-a-1-a-2)) |
| `iteration_id`, `supersedes_iteration_id`, `supersedes_proposal_id` | the lineage of [section 7](#7-after-a-needs_approval-major-6) and [6.2](#62-immutable-proposal-immutable-decision-referenced-issuance-a-7) |
| `predecessor_plan_digest`, `predecessor_contract_digest` | what the diff or the widening is *against*, so a proposal read later is not a diff against an unknown |
| `candidate_contract_digest` | **null on a proposal**, and filled only on the delegation row the surface writes after composing. A digest here would be the advisory claiming to have composed something |
| `agent_type_digest`, `config_digest`, `contract_digest` | the three cadenza digests the referenced iteration was classified under |
| `continuo_revision`, `cadenza_revision` | the observed continuo build (`records.ts:193`) and the pin the facade was compiled against — a proposal made under a different pair is a proposal a reader should re-derive |
| `created_at_ms` | the caller's clock, never the store's (`records.ts:150-152` already states that rule) |

**The words** (`A-11`). cadenza `D-0031` section 1 is explicit that the agent-type
record *"does not express 'what a run may touch' anywhere other than G2"*: its
`granted` and `askable` sets are **inputs to contract construction**, consumed
before the contract exists, and *"they are never a second answer standing beside
one"*. Two authorities with no precedence is not stricter, it is unanswerable.

So the type name is `Candidate…` and the field names say `candidate`; the word
**permission** does not appear in this component's types, columns or rendered
prose. A proposal says *"a contract built from these keys would classify this
action `allowed`"* and never *"this run is permitted"*, because the second is a
claim only `classify()` over an actual contract can make. The rendered text obeys
`D-0004` and is ASCII.

---

## 9. What this depends on, and what it can do without (Major 7)

**The build order is an acceptance criterion, not an aspiration** (`A-12`).
`D-0020` rule 1 takes `cadenza S-4` as written: the first cut of the surface is
the gate list, the gate detail, and the two write verbs (`answer`, and
`close --outcome withdrawn`). This component is the "A" half — chat with decision
cards — that `S-4` deliberately put second. **B lands before A**, and the reason
is `D-0009`'s: this surface is on the critical path of every gate, so the first
thing built is the thing that is blocking, and answering a gate is what is
blocking.

**One part of this design may go first, and it is named explicitly so that "B
before A" does not become an excuse to defer the ledger.** The record design of
[sections 6](#6-one-ledger-per-fact-major-4) and 8 — the `proposal`,
`human_decision` and delegation tables, their immutability and the single-use
transaction — is backend work with no UI, it is what `D-0020` rule 4 says is
"the work this row unblocks", and the gate panes of B will want to write into it
the moment they can record an answer. It may land before A and even beside B.

**The dependency table**, so that a reader can tell a schedule from a blocker:

| this design needs | state today | without it |
|---|---|---|
| the lap-1 loop (`D-0019`) | **landed** | — |
| a store that can list rows | **absent** ([1.2](#12-the-store-answers-two-questions-about-one-iteration-and-no-question-about-history)) | the advisory can explain the live iteration and nothing historical |
| the delegation record (`D-0020` rule 4) | decided, unbuilt | proposals can cite `contract_digest` and cannot diff key sets ([1.3](#13-the-contract-is-composed-classified-against-and-then-thrown-away)) |
| the conversation store (`D-0020` rule 5) | decided, unbuilt | the advisory has no history of what was discussed; every proposal is grounded in records only |
| `S-4` B: gate panes and `GATE_ANSWER` | decided, unbuilt | nothing can present a proposal to a human, so proposals accumulate unread |
| a widened `GATE_SHOW` reader | unbuilt ([1.5](#15-continuo-already-publishes-the-humans-answer-and-rondos-decoder-reads-past-it)) | the advisory cannot cite what a human actually answered |
| cadenza `D-0036`'s API in the pin | **not in the artefact** ([1.4](#14-the-pinned-cadenza-cannot-compose-a-successor-and-the-cadenza-that-can-is-not-the-pin)) | the `widening_successor` proposal kind is data nobody can act on |
| an allocator | absent (`D-0012`, rondo#8) | a proposed plan always has a hole a person fills ([section 4](#4-what-a-proposal-may-say-about-a-runplan-blocker-2)) |

**What it can do with none of the unbuilt ones**: read the one live iteration and
the rows it is handed, and render a grounded explanation of where a request
stands, what plan it ran under, which digests it was classified against and which
continuo build drove it. That is `kind = "explanation"`, it is useful on its own,
and it is the honest first cut.

---

## 10. One proposal, end to end

The arc, with each authority of [2.1](#21-the-three) named where it acts. This is
the `widening_successor` case, because it is the one that touches all three.

0. **A lap stopped.** cadenza answered `needs_approval`, the iteration ended at
   terminal `abandoned` with cadenza's reason (`D-0019` rule 15,
   `interpreter.ts:756-765`). Nothing is running and the single-flight lock is
   released.
1. **Gather (composition root, `src/access`).** The root reads the abandoned row,
   its plan and its three digests from the store; reads the delegation record for
   the contract as issued; drives `gate show --json` if a gate exists; and freezes
   the result as an `AdvisorySnapshot`.
2. **Advise (`src/advisory`, authority (a)).** `propose(snapshot)` returns a
   `Proposal`: `kind = "widening_successor"`, the **candidate** key sets, the
   predecessor's `contract_digest`, the reason cadenza gave, and the fields of a
   new plan it will not fill. It touches nothing and returns a value.
3. **Record (store).** The composition root writes the proposal row — immutable,
   with its digest and its snapshot digest (`A-7`). Nothing is presented yet, and
   a proposal that is never presented is still a row.
4. **Compose (`src/cadenza/facade.ts`, called from `src/access`, authority (b)).**
   `composeSuccessor` builds the successor `DelegationContract` from the candidate
   keys over the predecessor and computes its `contract_digest`. **This is the
   thing the human will approve**, and it exists before they see it, because
   cadenza `D-0036` makes the digest what is approved.
5. **Present (the surface, `S-4` B's panes).** The human sees the composed
   contract, the digest, the proposal that produced it and the lap that stopped.
   The advisory's prose is *material* on that screen and is not the record of
   anything.
6. **Answer (the human, through continuo).** `gate answer --actor-id <OIDC
   subject> --body <what they typed>` (`D-0020` rule 2). The body is continuo's,
   verbatim, and rondo copies it nowhere ([6.1](#61-the-table)).
7. **Decide (the surface).** A `HumanDecisionRecord` is built —
   `decisionId`, `recordedBy` (the surface's own identity), `outcome`,
   `predecessor` (the predecessor's digest, or `null`), `approved` (the digest
   from step 4) — validated by `humanDecisionRecord()`, and written as an
   immutable row.
8. **Issue once (the surface, authority (c)).** In **one** `BEGIN IMMEDIATE`
   transaction: assert the decision is unconsumed, call `supersedeOnDecision`,
   write the delegation row with its lineage, mark the decision consumed, commit
   ([6.3](#63-single-use-is-a-transaction-not-a-check-a-9)). A second attempt is
   refused by the store.
9. **A new iteration.** The caller supplies the fresh `(run id, topic branch,
   workspace)` triple and the rest of the plan's holes; `admit` reserves a new
   row (`conductor.ts:269`), and the lineage of
   [section 7](#7-after-a-needs_approval-major-6) is what connects it to the lap
   that stopped.

**One human contact**, at steps 5-6, and it is the same contact `D-0009` rations.
Everything before it is data with no authority, and everything after it is a
consequence of a digest a person approved.

---

## 11. The test layering

**Proposal (`A-14`)**, in the shape `D-0019` rule 17 settled for the loop:

| layer | what it may touch | what it proves |
|---|---|---|
| `test/advisory/` | **nothing** — hand-built snapshots, no store, no continuo, no cadenza | that `propose` is total over every snapshot shape, including a snapshot missing a field; that a proposal is a function of its snapshot (the same snapshot gives the same `proposal_digest`); that no candidate carries a contract digest; that the word `permission` appears in no rendered string |
| `test/store/` | a real `node:sqlite` in-memory database | that a proposal row cannot be updated; that a decision can be consumed **once** across two connections under `BEGIN IMMEDIATE`; that the lineage columns refuse a dangling reference |
| `test/architecture/` | the tree | that `src/advisory` names only itself and `src/store`, that its external allowance is empty, and — as a **planted** case, per `D-0006` — that a module under it importing `src/cadenza` or `src/continuo` makes the suite red |
| `test/cadenza/` | the real vendored cadenza, in memory | `composeSuccessor` against fixtures, once `A-5`'s pin move lands |
| a manual dogfood | a person's machine | one real proposal presented and approved, deliberately |

The planted case in row three is the one that matters, and it is why
[2.2](#22-the-advisory-is-a-pure-function-and-its-layer-is-what-makes-that-true-a-1-a-2)
chose a layer over a module: it is the only row in this table that can fail when
somebody, later and in good faith, adds one import.

---

## 12. What would falsify this document

- **The store growing a listing API for a different reason**, which is the
  cheapest dependency here ([1.2](#12-the-store-answers-two-questions-about-one-iteration-and-no-question-about-history)).
  Nothing else changes; the "explanation" first cut just gets much better.
- **`D-0020` rule 4's delegation record landing with a different shape.** Sections
  6 and 8 are written against its six facts, and its DDL is unwritten — a schema
  that names these facts differently is a re-pointing of this document rather than
  a new decision.
- **cadenza `D-0036` being superseded**, or `HumanDecisionRecord` gaining a field
  (that entry names a timestamp, a second approver and a narrower scope as
  candidates). [Section 5](#5-the-widening-successor-under-cadenza-d-0036-blocker-1)
  is a consumer of that value and would move with it.
- **continuo recording an *authenticated* answerer.** That is `D-0009`'s own
  falsifier, and it would make the surface's identity a proven fact rather than a
  claimed one — which changes what a decision row is worth, not where it lives.
- **`D-0012`'s allocator arriving.** [Section 4](#4-what-a-proposal-may-say-about-a-runplan-blocker-2)'s
  hole list shrinks to nothing, and `A-6`'s alternative branch becomes the
  recommendation.
- **A proposal a human wants to approve without a gate.** The whole of
  [section 10](#10-one-proposal-end-to-end) routes approval through a continuo
  gate; a proposal about something that has no gate — an agent type, say, with no
  run under it — has no place in this arc, and that is a shape this document does
  not cover.
- **The advisory needing to write.** `A-1` and `A-2` are the design; the first
  requirement that cannot be met by returning a value is the row that falsifies
  them.
- **A model-drafted proposal being wanted on the critical path** rather than as
  one drafter among others (`A-13`).
- **`gate show --json`'s payload changing**, or a `continuo.gate.show/2`.
  [1.5](#15-continuo-already-publishes-the-humans-answer-and-rondos-decoder-reads-past-it)
  is a transcription of one function at one revision, and `D-0017`'s
  accept-extra-keys falsifier applies here unchanged.
- Any measurement above failing to reproduce. Toolchain `node v22.17.0`; rondo at
  `878eea436600e79acc743b6bf5ed0fa0ccd85e27`; continuo at
  `44f62336108b86cab5da791111ffa0e5b73cd01a`; cadenza pinned at
  `e56d7e71981232d19120d20ba6b920a5c4d762dc`, with `D-0036` read at
  `5d5d9f408c29f6500c422c8e10e6b6a3a6882aaf`.

---

## 13. The decision rows

Propose-only. Each row carries a recommendation and the reason; the gate takes
them, and `D-0021` is what would record the outcome. Where a row answers a Codex
finding, the finding is named.

| id | Decision | Recommendation | Reason |
|---|---|---|---|
| **A-1** | Does the advisory component exist, and in which layer — `src/access` as rondo#9 suggests, or its own? | **Yes, and in a new `src/advisory/` layer** whose internal allowance is `["src/advisory", "src/store"]` and whose external allowance is **empty**; `src/access` gains `src/advisory` | Internals are granted per layer and externals per module (`import-boundaries.test.ts:124-161`, `:208-257`), so "this module may not import cadenza while its neighbours may" is a rule the boundary test cannot express. In `src/access` under `A-4`, the component that must never compose a contract would sit in the layer that may. A layer makes it a planted case instead of a review comment. Answers Codex Blocker 3 |
| **A-2** | Is the advisory a component that reads, or a pure function of an injected snapshot? | **A total, pure function**: `propose(snapshot) -> Proposal`. Gathering is the composition root's | The same property `D-0019` rule 1 bought for the loop: `test/advisory/` needs no database, no continuo build and no cadenza package. A function that returns a value cannot issue one, which is "expresses no authority" as a type rather than a discipline. It also makes every proposal re-derivable from its `snapshot_digest` |
| **A-3** | What may it read at runtime, and what is never a read path? | **rondo's store; the pinned cadenza through the facade (never from the advisory layer); admitted continuo `--json` verbs, decoded by `src/continuo/protocol.ts` and handed over in the snapshot.** Never a sibling checkout, never continuo's SQLite file | Design-time measurement and runtime input are different things and this document is the first. `D-0015` rule 1 keeps continuo behind a process boundary; `cadenza S-10` names the pane with no read path as exactly where somebody opens the database file instead. Answers Codex Major 5 |
| **A-4** | Who may call the successor composer? | **`src/access` gains the `src/cadenza` arrow**, and the facade gains `composeSuccessor`. Not `src/refrain`, not a new layer. The advisory calls neither | The boundary table's objection — an access point needing a contract would be taking a domain decision — is answered by `D-0009` part 2 and `D-0020` rule 2, which both put the **issuer** of a widening at the operating surface. Composing in `src/refrain` is what `D-0018` rule 7 exists to prevent ("one import away from a loop that must not have it"); a new layer removes no import, because the grant is per module. Answers Codex Blocker 3 |
| **A-5** | The pinned cadenza has no successor API. When does the pin move? | **As its own change**, following `D-0018`'s bridge — tarball, `vendor/cadenza.tgz.sha256`, `cadenza.pin.json`, `package.json`, `package-lock.json` together — after `D-0021` and before the successor path is implemented | Measured: `supersedeOnDecision`, `humanDecisionRecord`, `HumanDecisionRecord` and `DecisionOutcome` appear nowhere in the installed `dist/index.d.ts`; they exist at cadenza `5d5d9f4` and the pin is `e56d7e7`. Folding a pin move into a feature diff is how a warm npm cache installs the previously pinned bytes with exit 0 (`D-0018` rule 4) |
| **A-6** | What may a proposal say about a `RunPlan`? | **A selection among persisted plans, a diff against a named predecessor, and an explicit list of the fields it will not fill** — `runId`, `topicBranch`, `workspace`, `leaseClaimantId` and the fence roots among them. rondo mints none of them, and `D-0019` rule 3 is unchanged | `D-0012` records that a second attempt needs a fresh `(run id, topic branch, workspace)` triple and that nothing allocates one; continuo requires the fence roots absolute and outside the worktree, so a rondo default would be rondo guessing at a fence's geometry. **The alternative branch is named rather than argued away**: proposals that admit without a human filling a field are an allocator, they change `D-0019` rule 3, and they are rondo#8. Answers Codex Blocker 2 |
| **A-7** | Are proposals persisted as their own record kind, and with what? | **Yes, immutable and append-only, with no `status` column**, carrying `proposal_id`, `proposal_digest`, `snapshot_digest`, `kind`, `drafter`, the lineage references, the predecessor plan and contract digests, the three cadenza digests, the observed continuo revision, the cadenza pin, and the caller's timestamp | "What was proposed vs what was approved" is the operator's stated priority, and a row that can be rewritten to `approved` is a record of what somebody wishes had been proposed. `candidate_contract_digest` is **null on a proposal**: a digest there would be the advisory claiming to have composed something. Answers Codex Minor 8 |
| **A-8** | What is the single ledger, per fact? | **The table of [6.1](#61-the-table)**: the gate answer is continuo's `gate_transition.body`; the proposal, the decision, the contract lineage, the agent type and the conversation are rondo's store; everything else references them by identifier. A copy is labelled an observation and is never authority | `D-0020` rule 5 already refuses prose in the gate-answer slot, because prose there records as human approval. Copying the answer into a proposal or a chat record would create a second source of truth for the one fact nobody may paraphrase (`D-0009` part 3). Answers Codex Major 4 |
| **A-9** | Who guarantees that one human decision authorises at most one issuance? | **rondo's store, in one `BEGIN IMMEDIATE` transaction**: assert `consumed_by IS NULL`, issue via `supersedeOnDecision`, write the delegation row, mark consumed, commit | cadenza cannot: it persists nothing and says so, assigning the duty to `S-7` — rondo's row, taken as `D-0020` rule 4 fact 6. `BEGIN IMMEDIATE` for `D-0019` rule 10's reason, quoting continuo's own admission path. An in-process check is the grade of guarantee `D-0036` already said it could not give |
| **A-10** | What happens to the `needs_approval` iteration a proposal is about? | **Nothing. It stays terminal `abandoned` and is never revived or rewritten**; a new proposal, decision, contract and iteration are linked to it by lineage | `D-0019` rule 15 ends it there and `transition` asserts the status it leaves, so this is a property the store has rather than a rule the advisory keeps. Revival would re-enter a terminal state and would mean a second lap under an admitted run id. Answers Codex Major 6 |
| **A-11** | How are the candidate key sets described? | **"Candidate", never "permission"**, in type names, column names and rendered prose; authority is `classify()` over an actual contract | cadenza `D-0031` section 1: `granted` and `askable` are **inputs to contract construction**, consumed before the contract exists, and never a second answer standing beside one — two authorities with no precedence is unanswerable at the moment authority is needed. Answers Codex Minor 9 |
| **A-12** | Where does this sit in `cadenza S-4`'s build order? | **`S-4` B (gate list, detail, `answer`, `close --outcome withdrawn`) lands before A (chat and advisory cards), as an acceptance criterion.** The record design of sections 6 and 8 may land first, and is named as the exception | `D-0020` rule 1 takes `S-4` as written, and `D-0009` puts that surface on the critical path of every gate: the first thing built is the thing that is blocking. The record design is backend-only, has no UI, and is what `D-0020` rule 4 says its row unblocks. Answers Codex Major 7 |
| **A-13** | Is a model-drafted proposal admitted, and does it change the record? | **The record is identical whichever drafter produced it, and `drafter` is a column. The first cut ships the deterministic drafter**; a model draft is a candidate like any other, is never presented unread, and never reaches a gate as anything but material | It keeps `D-0019` rule 7's property — no non-deterministic verdict on the path to the one human contact this design rations — without pretending the operator's actual want (a component that explains and proposes in prose) is out of scope. Making `drafter` a column now is what stops the second drafter from being a schema change |
| **A-14** | Where is the boundary between the test layers? | **`test/advisory/` on hand-built snapshots and nothing else; store rules in `test/store/` against a real `node:sqlite`; the layer's allowance as a planted case in `test/architecture/`; `composeSuccessor` in `test/cadenza/` once `A-5` lands** | `D-0006`: the boundary test is what CI exists to run, and its failure mode is finding nothing. The planted case is the only row in the table that can fail when somebody later adds one import in good faith, which is the whole reason `A-1` chose a layer over a module |
