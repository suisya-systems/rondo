# Draft `DECISIONS.md` entry for the lap's review stage

**This file is not a decision and is not part of the record.** It is the entry
[`lap-review-stage.md`](lap-review-stage.md)'s rows `V-1` … `V-14` would create if
rondo's gate takes them, written out in full so the gate is approving text rather
than approving a promise that text will be written. It is **not** appended to
[`../../DECISIONS.md`](../../DECISIONS.md) by this branch, and the ID below is a
proposal: `D-0028` is the highest taken today, so the next free ID is `D-0029`,
and a concurrent belt may claim it first. If it does, the number moves and
nothing else does.

The design document is the measurement record; this is the decision. Where the
two differ after the gate, **the entry governs** — the discipline `D-0022` states
for itself and `D-0019` and `D-0023` were both taken under. The design document
is to be left as written.

Everything between the rules below is what would be appended verbatim.

---

## D-0029 — An independent reading of what a lap produced: material for the person at the gate, one refusal at `publish`, and a verdict that cannot certify what it never read

**Status:** *(proposed; to be dated at rondo's human gate)*

This entry records the outcome of the fourteen decision rows `V-1` … `V-14` that
[`docs/design/lap-review-stage.md`](docs/design/lap-review-stage.md) put to the
gate. The document was written propose-only and named this entry by number in
advance; it is the measurement record and this entry is the decision.

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
   and this rule is worth more than every other rule in this entry.** Today the
   reading mode prints the gate's `rationale` — the worker's own account of its
   own work — and no workspace path and no topic branch, and the `--body` path
   prints none of even that. The base ref, the commit subjects and the touched
   files go above the answer command on both paths. It produces no verdict and
   takes no authority: it is material for a person, which is the grade `D-0022`
   rule 13 permits, and it needs no status, no table and no new capability grant.

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
- **The store gains one record kind, one writer and one query.** The writer refuses
  a `clear` without evidence (rule 11); the query answers "which iterations reached
  a terminal status with no reading".
- **Two commands change.** `answer` prints the material on both paths; `publish`
  gains one refusal and one override flag.
- **CI gains one planted case** (rule 12).
- **`IterationStatus` does not change**, and neither does anything derived from it.

### Annotations this entry adds to earlier entries

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

### What was measured, and at which revision

At rondo `0497ca8`, on 2026-09-07, toolchain `node v22.17.0`, with continuo and
cadenza at the revisions `continuo.pin.json` and `cadenza.pin.json` name. The
measurements are `docs/design/lap-review-stage.md` sections 1 to 9; three of them
carry this entry's weight and are named again here, because a reader who checks
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
- Any measurement above failing to reproduce at `0497ca8`.
