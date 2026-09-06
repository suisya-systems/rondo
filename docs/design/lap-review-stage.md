# A review stage for the lap: an independent reading before the work is admitted as done

**Status: propose-only.** This document takes no decision and changes nothing
under `src/`. It measures what is in the tree today, proposes a design for an
independent reading of what a lap produced, and ends in a table of decision rows
(`V-1` … `V-14`) for rondo's human gate. Per [`../../AGENTS.md`](../../AGENTS.md)
section 7 the rows are named rather than settled here, and the entry the gate
would create is referred to throughout as **`D-0029`** — a name for a thing that
does not exist, not a citation.

It is written in the shape of [`refrain-lap1.md`](refrain-lap1.md) and
[`advisory.md`](advisory.md), which are the two documents it leans on hardest:
measured claims carrying `file:line`, an end-to-end walk, an explicit check that
the design has not let a machine decide what a human decides, a falsification
section, and a decision table. Line references are to the revision named in
[section 1.6](#16-what-was-measured-and-at-which-revision); they drift, and the
claim rather than the number is what a later reader should re-measure.

**The question this document exists to answer is not "should rondo have more
quality machinery".** It is narrower and it is already half-decided against:
`D-0019` rule 16 refused the conductor's own verify in lap 1, and named the two
observations that would show the refusal wrong. Section 3 is the finding that
**one of them has fired**, and it fired not because anybody argued but because
the operating surface grew a verb that did not exist when the rule was written.

---

## 0. What the stage has to become, in one paragraph

A lap ends with a person answering a gate, and what that person is shown is the
worker's own account of its own work. Nothing else reads what the lap produced
before the iteration reaches a terminal status, and nothing reads it afterwards
either unless a human types `rondo publish` and a second human reviews the pull
request. What lap 1 needs is not a judge and not a second gate: it is **one
independent reading of the artefact, recorded so that it cannot evaporate, shown
to the person at the moment they act, and standing in the way of exactly one
thing — the act that puts the work in front of the world.** It must never write a
gate answer (`D-0009`), never close a gate (`D-0013`), never publish
(`D-0010`), and never turn a machine's opinion into permission (`D-0022`
rule 11). And it must be impossible for it to certify work it never read, because
that failure mode — measured, in this organisation, this month — is the one that
looks exactly like success.

---

## 1. What is true today, measured

### 1.1 The arc, and where a reading could stand in it

`IterationStatus` is **eleven** values, not the four the brief for this task
quoted from `refrain-lap1.md:65`: `planned`, `classified`, `admitting`,
`admitted`, `performing`, `awaiting_human`, `withdrawal_requested`, `stalled`,
`closed`, `abandoned`, `failed`
([`src/store/records.ts:72-94`](../../src/store/records.ts)). `refrain-lap1.md`'s
four-state sentence was measured before its own section 7.1 replaced them, and
`D-0019`'s "What this entry changes in the tree" records the replacement. Three
are terminal (`records.ts:103`); two — `awaiting_human` and
`withdrawal_requested` — are non-terminal but hold no execution capacity
(`SUSPENDED_STATUSES`, `records.ts:129-132`); `stalled` deliberately occupies,
fail-closed (`records.ts:116-127`).

Every non-terminal status owes a **named releasing event**
(`RELEASED_BY`, `records.ts:172-181`), and that table is `D-0019` rule 11's real
safety property: a non-terminal state nobody can leave is a conductor that never
runs again.

The step this design is about is `performStep`
([`src/refrain/interpreter.ts:1063-1253`](../../src/refrain/interpreter.ts)). Its
order is measured:

1. `commit(..., "performing", {})` — before anything is sent (`interpreter.ts:1086`);
2. `ports.performLap(...)` — the one step that takes minutes (`:1092`);
3. on `answered`, the report lines are pushed **first**, including the literal
   `The lap answered. Gate ${lap.gateId} is already open` (`:1144-1153`), with
   the comment at `:1140-1143` explaining why they precede the write;
4. `commit(..., "awaiting_human", { gateId, sessionId, sessionPath, model, ... })`
   (`:1154`).

Between (2) and (4) the row is durably `performing`, the work exists on disk, and
nothing has yet been written that a person can act on. **That interval is the
only place in the arc where a reading can happen before a person is asked.**
`closed` is written at exactly one site, after a non-null gate outcome has been
observed (`interpreter.ts:1348`, with the doc comment at `:1256` calling it "the
one gate observation, and the only place `closed` is written").

### 1.2 What the person at the gate is actually shown

This is the measurement the whole design turns on, and it is not an inference.

`rondo answer` without `--body` is the reading mode
([`src/access/cli.ts:1025-1040`](../../src/access/cli.ts)). It prints the
iteration id and status, the run id, the gate id / type / stage, `why`, and
`options`. `why` is `gate.rationale`, which continuo's own decoder documents as
**"why the worker stopped, in the worker's own words"**
([`src/continuo/protocol.ts:392-403`](../../src/continuo/protocol.ts)), relayed
verbatim and never interpreted (`D-0015` rule 7). It prints **no workspace path
and no topic branch**.

What that looks like in practice was recorded when a lap was walked end to end
([`../operations/lap-1-dogfood.md:964-1000`](../operations/lap-1-dogfood.md)).
The gate's rationale was:

> `Done. Appended the line to README.md:5 and committed as e075b60 on dogfood/lap1-dogfood-003.`

and the operator answered `approve` (`lap-1-dogfood.md:991`). The procedure that
walked them there — [`../../scripts/dogfood-lap.md`](../../scripts/dogfood-lap.md) —
contains **zero** occurrences of `git log`, `git show` or `diff`; no step of it
reads what the lap produced.

So: **the human at the gate is shown the graded party's own report, and the
design's own operations record shows them approving on it.** That is not a
criticism of the operator. It is a statement about what the surface makes
available.

And it gets one degree worse. The reading mode above is inside
`if (parsed.body === null)` (`cli.ts:1025`). An operator who answers in one
command — `rondo answer --iteration-id ... --body="approve"` — takes the branch
at `cli.ts:1042-1061` and is shown **none of it**: `approvedActor`, then
`walkGate`, then the outcome. The shape the dogfood procedure teaches is the
shape that prints least.

### 1.3 What rondo can read, and what it cannot

`lap perform`'s decoded answer carries **twelve handles and no content**:
`runId`, `workspace`, `topicBranch`, `baseCommit`, `sessionId`, `sessionPath`,
`gateId`, `eventId`, `eventSeq`, `endpointLeaseFailure`, `elapsedDeadlineAtMs`,
`model` (`protocol.ts:559-601`). rondo's own port type adds a thirteenth,
`requestedModel`, which is rondo's record of what it asked for
([`src/refrain/ports.ts:95-126`](../../src/refrain/ports.ts), compared at
`interpreter.ts:1114`). None of the thirteen is the work. What `lap perform`
tells rondo is **where to look**, never what happened.

Two modules under `src/` may start a process, and the grant is per module:
`src/continuo/invoker.ts` and `src/access/forge.ts`
([`test/architecture/import-boundaries.test.ts:226`, `:284`](../../test/architecture/import-boundaries.test.ts)).
One module may read a file: `src/access/cli.ts`, granted `existsSync` and
`readFileSync` only (`:264-278`). `src/refrain/` is **absent from the external
table entirely**, and the table's own comment says what that means: *"A module
absent from this table may import no external at all"* (`:194-196`). The loop
cannot spawn, cannot read a file, and cannot run a test.

**And one reader of the produced work already exists.**
`inspectLapWork` ([`src/access/forge.ts:450-528`](../../src/access/forge.ts))
runs `git rev-parse`, `git log --no-merges --reverse --format=%h%x09%s` and
`git diff --numstat` against the workspace, and returns
`LapWorkInspection` — `baseRef`, `{abbreviatedSha, subject}[]`,
`{path, added, deleted}[]`, or `unreadable` with a reason (`forge.ts:397-431`).
Its module header states the discipline this design inherits: *"Facts again, and
for the same reason `PushTargetInspection` is: what a pull request's title and
body are made of is a rule about pull requests, and it lives in `./cli.ts` as a
pure function over this value."*

It is called from exactly one place: `commandPublish`, at `cli.ts:1827`, after
the gate has been answered and closed, to compose the body of a pull request
(`D-0026`). **So rondo already reads what a lap produced. It reads it once, too
late for the person who approved it, and only to write prose about it.**

Nothing anywhere runs a test suite. There is no grant for it in
`ALLOWED_EXTERNALS_BY_MODULE` and no module that could hold one.

### 1.4 What can stop something, today

- **The gate cannot be stopped by rondo.** It is open before `lap perform`
  answers (`interpreter.ts:1145`), and `D-0013` puts every gate verb on the
  operating surface because `closeOpenGate` hard-codes `actorKind: "human"`
  (`D-0013`, mechanism at `DECISIONS.md:1118-1123`).
- **`closed` cannot be stopped**, or rather stopping it would be the worst
  possible place to stand: `interpreter.ts:1348` writes it *after* a person has
  answered, so a verdict there is a machine withholding a terminal status from
  work a human already approved.
- **`withdrawal_requested` is not reachable from the command line.**
  `COMMANDS` is `["start", "answer", "revise", "publish", "abandon"]`
  (`cli.ts:217`); `requestWithdrawal` is exported (`src/index.ts:28`) and wrapped
  (`src/access/conductor.ts:332`) and no command reaches it. A person can end an
  iteration (`abandon`), but cannot ask for a withdrawal.
- **`publish` can be stopped, and already is, twice.** It refuses an iteration
  that is not `closed` and an iteration whose gate outcome is not
  `answered_and_forwarded` (`approvedForPublication`, `cli.ts:180-182`, applied
  at `cli.ts:1739-1758`), and `publishPreflight` refuses a push whose target
  disagrees with `--repo` unless the operator passes `--allow-remote-mismatch`,
  which converts the refusal into a printed warning (`cli.ts:1559-1679`,
  `:1801-1809`).

That last shape — **refuse once, name the flag, let the same person overrule it
knowingly, and print why** — is a mechanism this repository already has, already
tests, and already trusts with a decision that reaches the outside world.

### 1.5 One identity, and what that costs

`RONDO_APPROVER` is *"the one identity allowed to answer a gate or publish"*
(`cli.ts:91`, `:154`), enforced by `approvedActor` (`cli.ts:661-698`). So the
person who answers the gate, the person who publishes, and the person who would
overrule a verdict are the same person by construction. Any design that answers
"who reads?" with "a second human" is proposing a change to that predicate, not a
detail of a review stage. This document does not propose that change; it names it
(`V-13`).

### 1.6 What was measured, and at which revision

**2026-09-07**, at rondo `0497ca8` (this branch's base), toolchain
`node v22.17.0`, against continuo at the revision `continuo.pin.json` pins and
cadenza at the revision `cadenza.pin.json` names. Every `file:line` above was
read at that revision. Two claims are quoted from documents rather than code and
are marked as such: `lap-1-dogfood.md`'s gate walk, and the reference
implementation in `claude-org-ja` (section 4.2).

---

## 2. Should the stage exist at all?

The honest answer has two halves, and the first half is a refusal of the obvious
design.

### 2.1 The case against, at full strength

Three conditions have to hold for a review stage inside the lap to buy anything,
and on the tree as it stands **two of the three fail**:

1. **A refusal must be able to stop something.** Inside the arc it cannot: the
   gate is open (1.4), `closed` is the wrong place to stand (1.4), and
   `withdrawal_requested` is not on the surface (1.4). This is `D-0019` rule 16's
   argument and it is still true of everything *inside* the state machine.
2. **The reviewer must be able to read the work.** From `src/refrain/` it cannot
   (1.3). The cheapest reviewer anybody would reach for — read the gate's
   `rationale` and judge it — is **grading the grader** (1.2).
3. **The verdict must be findable afterwards.** It is not.
   `readLiveRows` is `SELECT ... WHERE live IS NOT NULL`
   ([`src/store/sqlite.ts:741-746`](../../src/store/sqlite.ts)) and `live` is NULL
   for every terminal status; `read(id)` needs an id you already have (`:736-739`).
   **rondo has no query that returns a closed iteration.** `D-0022` carries this
   as an open residual owned by somebody else: *"the abandoned iteration this
   component most exists to explain cannot currently be found at all."*

And the strongest single objection, which is not about mechanism at all: **an
unattended model reviewer's characteristic failure is a clean pass, not an
error.** The reference implementation measured it — `codex exec review` can
return text readable as "no findings" and exit 0 having never run `git diff`, and
*"the exit code cannot be used to decide"*
(`claude-org-ja/knowledge/curated/codex.md:56`, `:77`). Its countermeasure is
**positive evidence that commands actually ran**, counted in the reviewer's own
log, and that countermeasure terminates in a person reading a report. Under an
unattended lap that person is absent. So a reviewer built carelessly converts *"nobody
read it"* — a state the current design admits, and a person can see — into
*"something read it and passed it"*, which is indistinguishable from a real pass.
**That is strictly worse than no stage.**

### 2.2 Why the stage exists anyway, and what it is

Condition (1) fails *inside the state machine* and succeeds *at `publish`*, which
did not exist when `D-0019` rule 16 was written (section 3). Condition (2) fails
for `src/refrain/` and succeeds for `src/access/forge.ts`, which already reads the
work (1.3). Condition (3) is a real hole and the design closes it rather than
inheriting it (`V-8`).

So **the stage exists** (`V-1`), in a form that is smaller than the word
"stage" suggests and is defined by what it is not:

- it is **not a state** — `IterationStatus` stays at eleven, `RELEASED_BY` gains
  no row, the capacity ledger is untouched (`V-4`);
- it is **not a judge** — its output is material, never permission (`V-3`, `V-9`);
- it is **not a model, in the first cut** — the first drafter is deterministic,
  and `drafter` is a column (`V-5`);
- it is **not a second gate** — rondo never mints a gate of its own (`D-0022`
  rule 15).

It is three things: **a reading, a record, and one refusal.**

And it starts with something that is not a review stage at all and should land
whether or not the rest is ratified: **`answer` must print what the lap produced,
on both of its paths.** Today the reading mode prints the worker's self-report and
no workspace path (1.2), and the `--body` path prints nothing at all. Printing the
base ref, the commit subjects and the touched files above the answer command is a
display change in one function; it needs no status, no table, no new grant, and it
produces no verdict. It is *material for a person*, which is precisely the grade
`D-0022` rule 13 permits. **Every other row of this design is worth less than this
one** (`V-2`).

---

## 3. Has `D-0019` rule 16's trigger fired?

This section exists because a design that quietly re-opened a decision would be
the thing `AGENTS.md` section 7 forbids. The rule, verbatim
(`DECISIONS.md:2567-2572`):

> 16. **`R-15` — the conductor's own verify is not in lap 1, recorded as a
>     reduction with its trigger.** The gate is *already open* by the time rondo
>     could verify, so a failing verify's only available action is to ask the
>     operating surface to withdraw the gate — the same action a human reading the
>     gate would take. Half-building it would put an untested branch on the path to
>     the one human contact. **Its trigger:** a lap whose gate is opened after
>     rondo's own check rather than before it, or a verify verdict a human would act
>     on differently from the gate's own contents.

The trigger is a disjunction. **Limb (a) has not fired** — the gate is still
opened inside `lap perform` and the answer rondo decodes already carries
`gate_id` (`protocol.ts:579-580`). Nothing in rondo can fire (a); only continuo
separating "produce the result" from "present a gate over it" could, and this
design does not ask for that.

**Limb (b) has fired**, and the finding is that the rule's *premise* expired
rather than that its conclusion was wrong when taken:

- Rule 16 rests on *"a failing verify's only available action is to ask the
  operating surface to withdraw the gate."* When it was taken on 2026-09-06,
  that was exhaustive: rondo had no operating surface at all. `D-0025` gave it
  one on the same day and `D-0026` gave `publish` its pull-request text, so
  **there is now a second available action, and it is the one that matters**:
  refusing the act that puts the work in front of the world, at a point where the
  gate is already settled and no human's window is being spent.
- Rule 16 also rests on *"the same action a human reading the gate would take."*
  Section 1.2 measures what a human reading the gate is given: the worker's own
  words, no workspace, no branch, and a documented walk with no step that looks at
  the work. **A reading of the produced artefact is different material from the
  gate's own contents, and the action it supports — decline to publish, pending a
  person's look — is an action the gate's contents cannot support**, because the
  gate's contents do not mention the artefact.

That is limb (b) in its own terms: a verdict a human would act on differently from
the gate's own contents.

**Consequence for the record.** Firing (b) is an **append**, not a supersession:
`D-0019`'s own worked example (`DECISIONS.md:2360-2379`) records a fired trigger
as a dated annotation, and rule 16's conclusion for lap 1 — *no verify inside the
arc, no branch on the path to the human contact* — is **kept**, because this design
puts nothing on that path (section 10). `D-0029` would annotate rule 16 rather
than replace it.

**Rule 7 is the other entry this design must not walk over**, and it has no
trigger clause, so a model judge on the path to a gate would be a supersession
rather than an append. Its three reasons (`DECISIONS.md:2433-2437`) are:
non-determinism on the path to the one rationed human contact; not expressible as
a unit case; and *"its most valuable output is the retry the lap-1 arc cannot
perform"*. **The third has expired** — `D-0023` supplied the allocator and
`D-0027` made a revision a second lap a person types. The first two stand, and
they are exactly why the first cut of this stage is deterministic (`V-5`): a
deterministic reading is a unit case and carries no non-deterministic verdict
anywhere. A model drafter arrives later as a `drafter` column value under
`D-0022` rule 13's grade — *"a candidate like any other ... never reaches a gate
as anything but material"* — which is an append to rule 7 rather than a
contradiction of it, and `V-6` says so explicitly rather than leaving a later
reader to work it out.

---

## 4. Who reads?

### 4.1 The first cut: rondo's own measurement, deterministic

The reader is a **pure function over `LapWorkInspection`**, in `src/access/`, with
the gathering done by the existing `inspectLapWork` (1.3). Independence from the
child that ran the lap is structural rather than promised: the input is `git`'s
answer about the repository, not the worker's report about itself.

This is the shape `forge.ts` already states for itself — facts in the module that
may spawn, judgement as a pure function in `cli.ts` — and the shape `D-0026`
already shipped for pull-request text. It is a unit case with no repository on
disk, which is rule 7's second leg satisfied rather than argued.

What it can say is bounded and section 9 states the bound.

### 4.2 The second cut: a different model, and why the axis is the model

The reference implementation's independence requirement is **model**, not session
and not process: the same worker session invokes the reviewer in its own working
tree (`claude-org-ja/.claude/skills/org-delegate/references/worker-claude-template.md:194`),
and same-family multi-agent self-review is *explicitly refused* as a substitute
for it (`org-delegate/SKILL.md:102`). That is a measured practice rather than a
principle, and this design adopts the axis and rejects the deployment: **a model
drafter is admitted only under section 6's evidence rule, and never inside
`drive()`** (`V-6`, `V-7`).

Never inside `drive()` matters and is not fastidiousness. During `drive()` the row
is in `beingDriven` (`interpreter.ts:597`) and `abandon` refuses (`:450-464`); the
gate's deadline is running and rondo may not move it — *"how long a person has to
answer is the operator's declared patience"*
([`src/refrain/revision.ts:113-131`](../../src/refrain/revision.ts)); and the gate
id is inside a lines array that only reaches the operator when `drive()` returns
(`interpreter.ts:1144-1153`, printed at `cli.ts:967-972`). A minutes-long reader
there would wedge the only execution slot on an iteration nobody can abandon,
whose open gate nobody can find, while spending the human's answering window. A
sub-second `git` read does none of that, and the split between the two cuts falls
exactly along that line.

### 4.3 What is not proposed

Not a human reader inside the lap: rondo names one identity (1.5), and requiring a
second is a change to `approvedActor`, not to this stage. Not cadenza's
`classify()` doing double duty: it evaluates an intended action against a
contract before admission and knows nothing about an artefact.

---

## 5. What does a refusal stop?

**`publish`, once, with a named override. Nothing else.** (`V-3`.)

- **Not `closed`.** `interpreter.ts:1348` is downstream of a person's answer;
  standing there is a machine withholding a terminal status from approved work.
- **Not the gate.** Every gate verb is the surface's (`D-0013`), and friction at
  the gate would let a machine's opinion consume a window that expires
  (`elapsedDeadlineAtMs`, `protocol.ts:595-597`, is continuo already reporting that
  this happens). **Information where the clock runs; friction where it does not.**
- **Not admission.** The work already exists by the time anything can be read.

Concretely: `commandPublish` refuses once, before it prints anything, naming the
verdict and the flag; the same operator retypes with `--despite-review` and the
refusal becomes a printed warning beside the other preflight warnings. That is
`--allow-remote-mismatch`'s shape (1.4), applied to a second question.

**Two rules keep this from becoming permission.** The verdict never enters
`approvedForPublication` (`cli.ts:180-182`) — that predicate is the sentence *"a
person said yes"*, and a machine's opinion inside it would make rondo state
something about a person. And a **clean verdict unlocks nothing anywhere**: the
asymmetry is deliberate and is `D-0022` rule 11's grade — a candidate is never a
permission (`V-9`).

**Fail-closed on absence.** A verdict of `concerns` and *no verdict at all* refuse
`publish` in the same way, under the same flag. This is the one place the design
spends a keystroke to make "reviewed clean" and "nothing read it"
distinguishable, and without it the stage is decorative: a fail-open unread lap is
a lap that publishes exactly as it does today while the record says a stage
exists (`V-10`).

---

## 6. Where does the verdict live?

**An immutable, append-only row of its own, written in the same
`BEGIN IMMEDIATE` transaction as the `awaiting_human` transition it accompanies**
(`V-8`). Three properties, each with its reason:

1. **Same transaction.** The idiom is the store's — `inTransaction` at
   `sqlite.ts:805-844`, `reserve` counting bounds and inserting inside one
   (`:847-909`), `transition` asserting `from` and writing inside one (`:955-990`)
   — and it is `D-0022` rule 9's requirement applied to a second fact. The
   alternative, a verdict written after the transition succeeded, has a window in
   which the row says `awaiting_human` and no reading exists; the person who
   answers in that window is the person the design exists to inform.
2. **Immutable, no `status` column, snapshot beside its digest.** `D-0022` rule 4's
   shape verbatim, for its reason: *"A row that can be rewritten to `approved` is a
   record of what somebody wishes had been proposed."* The row carries `drafter`,
   so a model reading and a deterministic reading are the same record kind
   (`D-0022` rule 13).
3. **Enumerable.** `D-0022` rule 19 made "unconsumed decisions must be
   enumerable" an acceptance criterion because otherwise a state exists that the
   ledger cannot report. The same criterion applies here twice over, and this
   design does **not** inherit the residual: the query that answers *"which
   iterations reached a terminal status with no reading"* ships **with** the table,
   not after it. Without it, the fail-open rate is unobservable, because a
   fail-open row is `closed` within minutes and nothing in the store returns a
   closed row (2.1).

### 6.1 The evidence rule, which is the whole anti-vacuity design

The measured failure mode of a reviewer is a clean pass over nothing (2.1). The
reference implementation's answer is to count evidence **outside the reviewer's own
message** — execution markers with elapsed times, anchored, in the reviewer's log
(`knowledge/curated/codex.md:83-84`), with the exit code usable only as a
disqualifier and never as proof (`:77`, `:121-125`).

Transplanted into rondo's idiom, and this is the row the design would least like
to lose (`V-11`):

> **A `clear` verdict may only be written beside rondo's own measurement of what
> was read** — the base ref, the commit shas, the touched paths, and the digest
> over them, as `inspectLapWork` returned them. Not the reviewer's account of what
> it read. A reading that cannot produce that evidence is recorded `unavailable`,
> and the store's writer refuses the `clear`.

The distinction is the point: `inspectLapWork` is rondo running `git`
(`forge.ts:450-528`), so the evidence is a measurement rondo took, not an
assertion a reviewer made. For a model drafter this is the difference between a
gate and a rubber stamp, and it is enforced by the writer rather than by prose.
It is provable for the deterministic drafter and **not provable for the model
drafter** — the evidence rule can show that the material was read, never that it
was understood — and section 9 says so rather than implying coverage.

A planted case in CI, in the shape `boundary-is-not-vacuous` already uses
(a real violation, and the assertion is the *named messages* rather than the exit
status), is what keeps the deterministic half from silently reading nothing
(`V-12`).

---

## 7. What happens when it refuses?

**Nothing automatic** (`V-7`).

The verdict is printed where the person is: on **both** of `answer`'s paths
(1.2's hollow spot closed), and again at `publish` as the refusal of section 5.
What the person does next is theirs: answer the gate anyway, `revise`, `abandon`,
or publish with `--despite-review`.

rondo does not type `revise` for them. `D-0027` rule 2 fixed that already —
*"Nothing here makes rondo revise on its own; a person types the command, once,
per lap"* — and an automatic re-lap driven by a machine verdict is the bypass this
whole design is checking itself against. **rondo#36 is therefore not on this
path**: `revise --iteration-id` naming the successor is a limitation of a command
a person types, and this design adds no caller of it.

`D-0022` rule 17's route is available to a later entry and is not taken here: a
verdict could become a `proposal` row whose approval a person grants before a
retry is admitted. This design leaves the proposal side to the advisory component
that already exists on paper and names it as a residual, because building the
proposal machinery is `D-0022`'s work and not this row's.

---

## 8. Rounds, and where the exit criterion lives

### 8.1 rondo holds no round counter in lap 1

The organisation's practice is *at most 3 rounds, exit on Blocker/Major cleared,
Minor and Nit left in place*
(`worker-claude-template.md:277-281`). Two properties of it do not survive the
transplant, and both are in the source document rather than in an opinion:

- **Its terminating condition is a person.** At the cap without convergence the
  worker *"must not self-enter round N+1"* and must stop and report to a human
  channel and wait. Unattended, the thing the cap hands control to does not exist.
- **Its round-count heuristic is a human reading a series.** *Same spot recurring
  across rounds = redesign signal; a different spot each round = healthy
  convergence* is documented as a judgement call for a person
  (`knowledge/curated/codex.md:171`, `:185`), with no algorithmic replacement.

And rondo's own bound is already a person: a revision chain advances only when
someone types `revise`, once, per lap (`D-0027` rule 2). Adding a machine-held
round budget on top of that would be a counter over an event a machine cannot
cause. **Recorded as a reduction with its trigger** (`V-14`): the first time
somebody wants an unattended re-review, the budget becomes real work and this row
is wrong.

### 8.2 Where the criterion lives, who may change it, and what happens when it is absent

The question this answers is the one rondo has no layer for: the store holds *what
happened*, a person holds *goals and risk*, and in between sits a **criterion** —
a judgement bound to observable signals. rondo has no home for it today, and
`D-0022`'s advisory component is explicitly not it: it is a pure function of a
snapshot, proposing.

The design's answer is deliberately split (`V-13`):

- **For the deterministic drafter, the criterion is code**, in `src/access/`, as a
  pure function over `LapWorkInspection` beside the other publishing rules
  (`forge.ts:399-401` states that division). Who may change it: whoever changes
  rondo, through a pull request, under `AGENTS.md` section 8's required check.
  Auditable because it is a diff, and reviewable because it is a unit case.
- **For a model drafter, the criterion is not rondo's to hold.** It is an input,
  carried **with the plan** — which makes it versioned by `D-0028`'s payload
  ladder, persisted verbatim, and digested by `plan_digest` (`D-0019` rule 4). So
  "which criterion was in force when this verdict was written" is answerable from
  the row, and changing it is exactly as auditable as changing any other plan
  field, by exactly the same authority: whoever writes the plan.
- **When it is absent or unreadable, the reading is `unavailable`** and section
  5's refusal applies. It never defaults to a `clear`, and it never stops the lap:
  a missing criterion costs a keystroke at `publish`, not a person's gate.

**What this design does not decide, named rather than left implicit:** where an
organisation-wide criterion lives when several plans should share one, and how a
criterion is revised in a way a later reader can date. That is a decision of its
own and it is a residual, not an answer this row is entitled to give.

---

## 9. The scope: what this stage catches, and what it cannot

A record that overstates a stage's reach is more harmful than one that
understates it, so this section is written as two lists and a ceiling (`V-9`
records that it is part of the decision rather than commentary).

### 9.1 What it catches — defects decidable by reading

The class is *"visible in the artefact and settleable from the text"*. Measured
examples, from the reviews this organisation actually ran: `fs.realpathSync`
folding `..` lexically; `errno` differing between Windows and POSIX; a mode-000
directory passing a check it should have failed. All three were found by reading,
and all three were found by a **different model** rather than by tests.

Against the class the motivation names — records, immutability, authorisation —
this stage catches the members that are legible in a diff **given the diff bodies
and the rule the diff is being read against**, and catches none of them from
commit subjects and line counts alone. That is a real bound on the first cut and
`V-5` states it: `inspectLapWork` returns `{path, added, deleted}`, so *"an
authorisation check deleted inside a function"* reads as `1 file, +3 -2`. **The
deterministic drafter's honest ceiling is shape** — no commits, no files, a branch
that adds nothing to its base, an unreadable workspace — and shape is not quality.
Everything above shape needs the model drafter of 4.2 and the evidence rule of
6.1.

### 9.2 What it cannot catch, by construction

- **Defects that only appear when the thing runs.** A refusal message whose
  newlines are collapsed by the output path while the function's return value is
  correct: found by running two panes, invisible to any reader of the code.
- **Defects that need the system interrogated rather than read.** A second
  write path through an implicit rowid collision beside the primary-key one:
  found by issuing SQL, not by reading the schema.
- **Defects in ordering and liveness that surface as flakiness.** A completed
  child reported as having vanished, resolved only by following three red CI runs
  to their cause.
- **"Green but not upholding it", as a comparison.** No module in rondo is
  granted the ability to run a test suite (1.3), so rondo cannot observe that the
  tests pass and the invariant is broken. It can only read.
- **Uncommitted work.** Every reader in the tree reads *committed history*:
  `inspectLapWork` reads `git log` and `git diff --numstat`; there is no
  `git status` anywhere in `src/`. A lap that leaves work uncommitted reads as
  empty to this stage — and `publish` then pushes a branch that does not contain
  it. **That is a defect of the current tree that this design surfaces and does
  not fix**, and it is named as a residual rather than absorbed.
- **"Did it do what was asked."** The request is on the row; the invariants are
  prose in the target repository's own files. Neither is in the reviewer's input
  unless somebody puts it there, and this design does not decide what else the
  reviewer is handed beyond the artefact (residual).

### 9.3 The ceiling, stated once

**Of the three discovery methods the motivating measurement names — adversarial
verification, review by a different model, measuring a real run — this stage
reproduces one.** It is the second. The first and third both require execution,
and execution is the capability rondo does not have and this design does not
request. Anyone reading `D-0029` and concluding that a lap's output is now
checked has read it wrong, and the entry should say so in those words.

**What the lap should have for the executable class**, since the brief asks and
the honest answer is not "nothing": the two mechanisms that exist are CI and the
dogfood procedure, and **neither runs over a lap's target repository**. rondo's
own CI (`.github/workflows/ci.yml`) tests rondo; the dogfood record's sixteen
findings are about rondo's arc, not about any lap's product. So the executable
class currently has **no home at all** for work a lap produces, and pretending
otherwise by listing CI in a table would be exactly the overstatement this section
exists to prevent. Naming that gap is this document's contribution to it; filling
it is a different decision, and it is the one this design would rank next.

---

## 10. The bypass check: has a machine decided what a human decides?

`D-0009` part 3 is the rule to check against: *"No approximation counts as
carrying. Summarising, normalising or reformatting a human's answer into the gate
body is composing it. Presenting options and carrying the option a person selected
is not."*

One refusal, walked end to end:

1. A lap answers. The row is `performing`. rondo runs `git` against the workspace
   and reads commit subjects and touched files. **rondo decided nothing; it
   measured.**
2. A verdict row is written in the same transaction as `awaiting_human`, carrying
   the reading, the evidence, and `drafter`. **The row is a record, not a status:
   it has no `approved` column to be rewritten into.**
3. The operator types `rondo answer`. Both paths print the verdict and the
   material above the answer command. **The person's input set grew; their
   authority did not move.** The body they type reaches continuo byte for byte
   (`cli.ts:1053-1061`); no gate verb changed hands.
4. The gate closes on the person's answer. `resume` observes it and writes
   `closed` exactly as before. **The verdict is not consulted anywhere on this
   path** — a machine cannot withhold a terminal status from work a person
   approved.
5. The operator types `rondo publish`. rondo refuses once, naming the verdict, and
   names the flag. **This is the only place a machine's reading has an effect,
   and its effect is one keystroke.**
6. The operator retypes with `--despite-review`. rondo publishes and prints the
   verdict as a warning beside the others. **The decision was the person's, at
   both steps, and the record says what they were shown when they made it.**

Nowhere does rondo compose an answer, close a gate, mint a gate, acquire a
credential, or convert a clean verdict into permission. The one asymmetry — a
`concerns` costs a keystroke and a `clear` unlocks nothing — is deliberate and is
`D-0022` rule 11's grade.

**The subtler failure, checked explicitly.** A design can keep the letter of "the
human decides" while making the decision meaningless. Three instances were
looked for:

- *A verdict shown when the person can no longer act.* Closed by printing on the
  `--body` path, which is the path the documented procedure teaches (1.2).
- *An auto-pass, so the person is only consulted on failures.* Refused: a clean
  verdict changes nothing about what the person is asked, and the material is
  printed either way.
- *A refusal routed away from a person.* Refused: there is no automatic retry
  (section 7), so a refusal has exactly one destination, which is the operator's
  terminal.

**And the opposite failure**, which the motivation makes real: a stage so careful
about authority that its output binds nothing. Section 5's single refusal and
section 6's fail-closed absence are the answer, and section 9.3's ceiling is the
honest statement of how much that answer is worth.

---

## 11. One iteration, end to end

Each numbered step is a state of `records.ts:72-94`; every arrow is a committed
transition. Only steps 5, 6, 8 and 10 differ from the arc `D-0019` already took.

1. `planned` → `classified` → `admitting` → `admitted` → `performing`, unchanged.
2. `lap perform` is invoked (`interpreter.ts:1092`). The row is durably
   `performing` and nothing else may occupy the slot.
3. The lap answers with its thirteen handles (1.3). The work exists on disk.
4. The report lines are pushed, gate id first (`interpreter.ts:1144-1153`),
   unchanged.
5. **New.** The interpreter calls a `readLapWork` port — declared in
   `src/refrain/ports.ts` in rondo's own vocabulary, wired in `src/access` to
   `inspectLapWork`, exactly as `startContinuo` and `performLap` already are
   (`ports.ts:326-353`). `src/refrain/` gains no import and no external grant;
   `D-0019` rule 1's shape is unchanged.
6. **New.** A pure function over the inspection yields a verdict:
   `clear`, `concerns` with its findings, or `unavailable` with a reason.
7. `awaiting_human` is committed (`interpreter.ts:1154`) — **and the verdict row
   is written in the same transaction**. If the transition is `blocked`, neither
   is written, which is the property the same transaction buys.
8. **New.** `rondo answer`, on both paths, prints the base ref, the commits, the
   touched files and the verdict above the answer command.
9. The person answers. `resume` observes the outcome and writes `closed`
   (`interpreter.ts:1348`), unchanged, and the verdict is not consulted.
10. **New.** `rondo publish` refuses once on `concerns` or on the absence of a
    verdict, naming `--despite-review`; otherwise it proceeds exactly as `D-0026`
    describes.

The failure paths are unchanged: `abandon` still reaches every non-terminal
status and drives no continuo verb; `stalled` still means *a person must decide
and there is no gate*; a reading that throws or times out is `unavailable` and
never `stalled`, because an unreadable workspace is a fact about the workspace
rather than a row nobody understands.

---

## 12. What this costs

- **A port and a wiring**: one member on `ConductorPorts`, one adapter in
  `src/access`. No new external grant anywhere — `inspectLapWork` already holds
  the `spawn` (`import-boundaries.test.ts:284`).
- **A table, a writer, and one query.** The query is not optional (section 6, item 3).
- **Two commands change**: `answer` prints more, on both paths; `publish` gains a
  refusal and a flag.
- **A window widens.** The reading sits between the lap answering and the
  `awaiting_human` write, so a crash in that window leaves a `performing` row whose
  gate id was never committed. That window exists today (it spans the report-line
  push); this design lengthens it by a `git` read. The mitigation is the reading's
  own timeout, and the honest statement is that lengthening it at all is a cost
  (`V-4`).
- **Nothing else.** `IterationStatus`, `RELEASED_BY`, `SUSPENDED_STATUSES`, the
  generated columns, the capacity bounds, `nextStep`, the `Step` union and the
  boundary table are all untouched.

**What it does not build**: the advisory component (`D-0022` rules 1-2), the
proposal/decision/approval ledger (`D-0022` rules 4, 9, 18, 19), a model drafter,
a round budget, a criterion store, a second approver, and any ability to run
anything.

---

## 13. What would falsify this design

- **The first defect that reaches a merge having passed a `clear` verdict.** If it
  is a defect of the readable class, the reading is too shallow — the first cut's
  shape-only ceiling (9.1) is the suspect, and the answer is the model drafter.
  If it is of the executable class, the answer is not a better reader; it is
  execution, and that is a different entry.
- **`--despite-review` becoming routine.** The stage's entire binding force is one
  keystroke. If the keystroke is reflexive, the stage costs a table, a query, a
  port and two command changes and prevents nothing. **This is measurable and the
  design should be judged on it**: count publishes carrying the flag against
  publishes that did not need it.
- **A `clear` verdict written with no evidence.** That is section 6.1 failing, and
  it is the failure that looks like success. The planted CI case is what should
  fire first.
- **An iteration reaching a terminal status with no verdict row, at any rate above
  noise.** Section 6's fail-closed refusal is supposed to make that visible at
  `publish`; a population of unreviewed closed iterations that nobody noticed
  means the enumeration query is not being read, and an unread query is not a
  record.
- **The gate stopping being the place a person decides.** If cadenza#22 or a web
  surface makes the answer arrive somewhere else, section 1.2's measurement — the
  person is shown the worker's self-report — has to be re-taken there before any
  of this is still true.
- **`inspectLapWork` changing what it returns**, or `publish` ceasing to be the
  only path to the world. The first re-opens 9.1's ceiling; the second re-opens
  section 5 entirely.
- **A second approver arriving** (`approvedActor` admitting more than
  `RONDO_APPROVER`). Then "who reads" has a human answer that is not available
  today, and section 4's argument for a model drafter weakens rather than
  strengthens.
- **continuo separating "produce the result" from "present a gate over it."** That
  is `D-0019` rule 16's limb (a), and it would make a check *before* the gate
  possible — at which point this design's whole "information where the clock runs,
  friction where it does not" split is re-openable on better terms.
- Any measurement in section 1 failing to reproduce at rondo `0497ca8`.

---

## 14. Decision rows

| Row | Question | Recommendation | Why |
|---|---|---|---|
| **V-1** | Does the lap gain an independent review stage at all? | **Yes — as a reading, a record and one refusal; not as a state and not as a judge** | Two of the three conditions an in-arc stage needs fail on the tree (2.1); both succeed outside it. The stage that survives measurement is small, and the parts that do not survive are refused by name rather than deferred |
| **V-2** | Does `answer` print what the lap produced? | **Yes, on both paths, and it is worth more than every other row here** | Today the reading mode prints the worker's own account and no workspace path, and the `--body` path prints nothing (1.2). It is material for a person, needs no status, no grant and no verdict, and it is the precondition for anything else being useful |
| **V-3** | What does a refusal stop? | **`publish`, once, with `--despite-review`; never the gate, never `closed`, never admission** | `publish` is the only act reaching the world and the only refusal point where no human clock is running (1.4, section 5). It already has the refuse-once-name-the-flag shape |
| **V-4** | Does `IterationStatus` gain a state? | **No** | The reading fits between `lap perform` answering and the `awaiting_human` commit, where the row is already `performing` and already carries its releasing events (1.1). A new state would owe `RELEASED_BY` a row, `SUSPENDED_STATUSES` a classification and the ledger a column, and would buy restartability of a reading that is cheaper to redo |
| **V-5** | Who reads, in the first cut? | **A pure function over rondo's own `git` measurement, in `src/access/`** | Independence is structural rather than promised, it is a unit case, and it carries no non-deterministic verdict — which is `D-0019` rule 7's first two legs intact. Its ceiling is shape, and `V-9` records that (9.1) |
| **V-6** | Is a model reader admitted? | **Yes, later, as a `drafter` column value under `D-0022` rule 13's grade, never inside `drive()`** | The independence axis the reference implementation actually requires is the model (4.2). A model verdict that is material for a person is an append to rule 7; one that decides anything is a supersession, and this design does not take it |
| **V-7** | What happens on a refusal? | **Nothing automatic. The person answers, revises, abandons or overrules** | `D-0027` rule 2 already fixed that a person types `revise`, once, per lap. An automatic re-lap driven by a machine verdict is the bypass this design checks itself against, and it keeps rondo#36 off this path entirely |
| **V-8** | Where does the verdict live? | **An immutable append-only row with no `status` column, written in the same `BEGIN IMMEDIATE` as the `awaiting_human` transition, with its enumeration query shipping alongside** | `D-0022` rules 4 and 9's shape, for their reasons. The transaction closes the window in which a person could answer a gate that a reading exists for but is not yet recorded; the query is what stops this design inheriting `D-0022`'s "a closed row cannot be found at all" residual |
| **V-9** | Is a clean verdict permission? | **No. It unlocks nothing, anywhere. And the stage's scope is part of the decision, not commentary** | `D-0022` rule 11's grade. The asymmetry — `concerns` costs a keystroke, `clear` costs nothing — is what keeps a candidate from becoming a permission, and section 9's two lists are what keep the record from overstating reach |
| **V-10** | What happens when no reading exists? | **`publish` refuses exactly as it does for `concerns`** | A fail-open absence makes "reviewed clean" and "nothing read it" indistinguishable at the only point either matters. It costs a keystroke and never a person's gate |
| **V-11** | How is an empty pass prevented? | **A `clear` may only be written beside rondo's own measurement of what was read; the store's writer refuses one without it** | The reference implementation's own countermeasure, transplanted to rondo's idiom: evidence outside the reviewer's message. It proves the material was read and never that it was understood, which is stated rather than implied (6.1) |
| **V-12** | How is the stage proved non-vacuous? | **A planted case in CI, asserting named messages rather than an exit status** | `boundary-is-not-vacuous`'s shape, for its reason: a green suite over an empty walk looks exactly like a green suite. It proves the deterministic half only |
| **V-13** | Where does the exit criterion live, who may change it, and what if it is absent? | **Code for the deterministic drafter; a plan field for a model drafter; `unavailable` when absent. An organisation-wide criterion store is a residual** | Code is auditable as a diff and reviewable as a unit case; a plan field is versioned by `D-0028`, persisted verbatim and digested, so "which criterion was in force" is answerable from the row. Neither ever defaults to a `clear` |
| **V-14** | Does rondo hold a round budget and an exit criterion for re-review? | **No, in lap 1 — recorded as a reduction with its trigger** | The organisation's cap terminates in a per-turn human interlocutor an unattended lap does not have, and its round heuristic is documented as a person's judgement (8.1). rondo's bound is already a person typing `revise`. Trigger: the first time somebody wants an unattended re-review |

### Residuals this document does not decide

| Residual | Why not here | Who decides |
|---|---|---|
| The executable class has no home for a lap's product — rondo's CI tests rondo, and the dogfood procedure reads no diff | It needs a capability rondo does not have and this design does not request (9.3) | rondo's gate, as its own entry; it is the change this document would rank next |
| Uncommitted work reads as empty to every reader in the tree, and `publish` pushes a branch without it | It is a defect of the current publishing path that this design surfaces rather than creates (9.2) | rondo's gate, or the issue it becomes |
| What the reviewer is handed beyond the artefact — the request, and the invariants the target repository states in prose | "Did it do what was asked" is unanswerable from a diff, and deciding the input set is a second design (9.2) | the model-drafter entry (`V-6`) |
| An organisation-wide criterion store, and how a criterion is revised so a later reader can date the change | Named in 8.2; a plan field answers one plan and not a fleet | a later entry |
| A second approver — `approvedActor` admitting more than `RONDO_APPROVER` | It is a change to who may act, not to this stage (1.5) | `D-0020` rule 2's surface work |
| The verdict becoming a `proposal` a person approves before a retry is admitted | That is `D-0022` rule 17's route and its machinery is unbuilt (section 7) | the advisory record-design task |
