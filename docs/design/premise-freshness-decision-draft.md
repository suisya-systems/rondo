# D-0038 — Whether the premise under a proposal has moved, decided per basis and at render time: re-gathered rather than remembered, a citation that no longer resolves as movement, and `undetermined` as a value the screen may never round to unchanged

**Status:** proposed (draft for rondo's human gate). Refs rondo#39, rondo#40, rondo#41.

**This draft is removed in the same pull request that appends the entry**, for `D-0029`'s reason
and by `D-0032`'s, `D-0036`'s and `D-0037`'s precedent: `docs/design/` carries it so the gate can
approve text instead of a promise of text, and once appended to `DECISIONS.md` it would be a second
copy of an accepted decision with no rule for which copy wins. **It leaves no design document
behind.**

rondo#39 states four requirements on what a gate must show. Three of them are decided and shipped:
the answerable shape is `D-0032` rule 1 with `D-0034`, the basis that travels with every claim is
`D-0032` rule 2, and what answering forecloses is `D-0032` rule 4 — all three read back and
rendered by #66. **The fourth is *"it shows what changed since the operator last looked"*, and it
is shipped at the wrong unit.** `D-0032` rules 9 and 11 answer it for the *inbox*: a durable mark
and one ordered read across the record kinds, so an operator who comes back after an interval can
see what the store did meanwhile (#64). #66's own Known limitations say what that leaves:

> A per-proposal form of it — whether the material a proposal rests on has moved since it was
> composed, which is the stale-premise case #39 measures — is deliberately not in this diff: it is
> a screen element no decided rule names.

This entry decides that screen element, and nothing else. **It is the same requirement at the unit
#39 actually measures.** #39's three framings from 2026-09-07 are not *"something happened in the
organisation since 09:14"*; each is one proposal whose own premise had moved out from under it —
most sharply, a candidate proposed as the next work that had **already been finished and merged**.
An inbox that reports *twelve things changed since you last looked* does not tell an operator that
**this** recommendation rests on something that is no longer there, and the operator who answers
the gate is looking at the proposal, not at the count.

It adds no table, no column, no record kind, no authority, no layer and no read allowance.

## What #39's requirement 3 asks that is already answered

Listed rather than re-decided. Nothing in this section adds a rule.

| What it asks | Where it is answered | State in the tree |
|---|---|---|
| What the store did since the operator last looked | `D-0032` rule 9 (`operator_view`, the bound sampled *before* the read) and rule 11 (`changedSince(t)`, inclusive of `t`) | Shipped, and read by the inbox (#64) |
| That the material under a claim be close enough to read without opening anything | `D-0032` rule 2, on `D-0022` rule 4's verbatim snapshot | Shipped: `basisLine` renders a `snapshot` basis inline with the value beside the pointer (`src/access/advisory.ts:254-273`) |
| That the row being answered is the row that was composed | `D-0022` rule 4, re-derived rather than re-read at every read (#66) | Shipped: `verbatim()` refuses a payload or a snapshot whose bytes no longer digest to the value stored beside them (`src/store/sqlite.ts:2755-2778`) |
| That a citation which leads nowhere says so | `D-0032` rule 2's closure, taken on the reading side | Shipped: `cited()` is total and answers `does not resolve` (`src/access/advisory.ts:230-251`) |

**What none of them answers** is the one question this entry takes: *the material this proposal
cites was true when it was composed — is it still true now?* Every mechanism above is about the
row's own integrity or about the store's activity. A proposal whose snapshot is byte-perfect, whose
digests both re-derive, and whose every pointer resolves cleanly can still be recommending work
that was finished an hour ago.

## Decision

1. **The unit is the basis, not the inbox and not the proposal.** Every option and every claim
   already carries a basis (`D-0032` rule 2), and the basis is where a premise actually lives — so
   freshness is decided **per basis** and rendered on the basis line that is already under each
   option. The proposal-level line is a **count of the three values of rule 4** and never a single
   word.

   **A per-proposal verdict is refused, and the reason is `D-0032` rule 3's.** Collapsing five bases
   into *"this proposal is stale"* is a composed framing that outlives the material it was drawn
   from: an operator reading it cannot tell whether the recommendation moved or one alternative's
   citation did, and those are opposite instructions. The finer unit costs nothing — the line is
   already being printed — and it is the only unit on which the operator's next act differs.

   This is also why the answer is not *"show `changedSince` on the proposal screen"*. That query
   answers *what the store did*, and the store doing nothing is not evidence that this proposal's
   premise held: the material a `repository` basis names moves without rondo writing a row at all.

2. **Freshness is decided by re-gathering and comparing values, never by comparing timestamps.**
   The left-hand side is the snapshot the row stores verbatim (`D-0022` rule 4) — the record of what
   the advisory read at composition. The right-hand side is what **the same gatherer produces now**.
   A basis's freshness is the comparison of the two at the basis's own pointer: `cited(stored,
   pointer)` against `cited(regathered, pointer)`, with `cited()` already total and already in the
   tree.

   **The timestamp alternative is refused on two grounds, and the second is the load-bearing one.**
   Comparing `proposal.created_at_ms` against `changedSince` inherits `D-0032` rule 9's named
   ceiling exactly — these are caller clocks sampled before `BEGIN IMMEDIATE`, so a row can land
   behind a mark that was taken before it — and it would inherit it at the screen where #39 says the
   loss matters most. But worse, it answers a **different question**: *a row touching this iteration
   was written* is not *the material this option cites now reads differently*. Most writes to a live
   iteration change nothing any basis points at, so the timestamp form reports movement constantly
   and correctly-by-its-own-definition, and an operator learns within a day to skip the line. **A
   mark that cries wolf is worse than no mark**, because it consumes the same attention #39 exists
   to protect and returns nothing for it. Value comparison has no such noise: it moves when, and
   only when, the cited material differs.

3. **Re-gather, and never re-draft.** What is re-run is the *gathering* — the composition root's
   copy of today's rows into the snapshot shape (`D-0022` rule 2). What is **not** re-run is the
   pure drafter over it (`proposeRetryPlan`, `proposeAgentType`, `proposeContractKeys`,
   `propose`).

   **This is the rule that keeps the check out of the hands of the thing under suspicion.** #39's
   hazard is the summariser framing the decision; a screen that re-drafted and diffed the option
   sets would be asking the drafter whether the drafter is still right, and would put on the screen
   an option set that exists in no record and carries no digest. The comparison is over **material**
   for the same reason the basis is a locator and not prose.

4. **Three values, and `undetermined` is one of them — `unmoved`, `moved`, `undetermined`.** The
   precedent is in the tree twice for this exact reason: `D-0029` rule 10's `unavailable` is a
   verdict rather than a missing row, and `D-0032` rule 8's `undetermined` is a value a claim may
   take rather than an empty field. An absence and a negative answer must not be the same thing at
   the only point where either matters.

   **A basis rondo cannot re-gather is `undetermined`, and today that is every form except
   `snapshot`.** `iteration`, `gateTransition`, `continuoRun` and `repository` name material rondo
   did not read as a store row at composition, so there is nothing recorded to compare a re-read
   against — and for the last three, deciding them means reading continuo's view of a gate or a run,
   or a repository's working tree, which is a widening of `D-0022` rule 3 and an arrow this entry
   does not grant. The verdict is therefore a `Record` over `Basis["form"]`, for `RELEASED_BY`'s
   reason (`src/store/records.ts:172`): a sixth basis form added to the union and forgotten here is
   a type error, not a screen that quietly says a premise held.

   **The screen may never round `undetermined` to unchanged**, and the proposal's header line may
   never read *nothing has moved* while one exists. This is the rule the entry exists for. #39's own
   measured case — a candidate already finished and merged — would carry a `repository` basis, so
   the honest answer rondo can give today is *rondo cannot check this one; here is the locator, and
   it is on you*. That is the answer #39 asks for. Saying nothing, or saying `unmoved` because
   nothing contradicted it, is the failure #39 names: it converts *rondo did not look* into *rondo
   looked and it is fine*, at the moment a person is about to spend an irreversible answer.

   **What this concedes, said plainly rather than discovered.** Today the check is decisive for
   `snapshot` bases and silent-but-honest for the four external forms — which means the sharpest
   case #39 measured is exactly the one rondo answers `undetermined` on. The entry is still worth
   taking at this strength for two reasons: `snapshot` bases are what rondo's own drafters actually
   emit (every option `proposeAgentType`, `proposeContractKeys` and `proposeRetryPlan` produces
   cites `/candidates/N/contractDigest`, and every claim `propose` produces cites the snapshot), so
   the decisive half covers the proposals rondo composes today; and an `undetermined` that is *on
   the screen, per basis, next to the locator* is a different act from silence — it tells the
   operator which of five citations they personally have to go and check, which is the smallest
   possible version of #39's requirement and not a placeholder for it.

5. **A citation that no longer resolves is `moved`, not `undetermined`; a gatherer that refuses is
   `undetermined` with its own reason on the screen.**

   The two edges are decided here rather than left to the implementation, because both are the
   stale-premise case arriving in its most concrete form and both have a plausible wrong answer.
   A pointer that resolved at composition and resolves nowhere in today's gathering — a candidate
   that left the set, a reading that is no longer there — is movement of the strongest kind rondo
   can observe, and `cited()` already renders it as `does not resolve`. Calling it `undetermined`
   would file the clearest signal available under the value that means *rondo could not look*.

   Where the gathering itself refuses — the subject's lineage no longer composes, the successor is
   gone — every basis on that proposal is `undetermined` **and the gatherer's reason is printed**,
   not swallowed. A screen that said only *undetermined* there would be hiding the most informative
   sentence rondo had.

6. **Computed at render and stored nowhere.** No column, no table, no writer, no periodic
   re-checker.

   **`D-0032` rule 3 and rule 4 are the precedent and they do not conflict with rule 9.** Rules 3
   and 4 refuse to store a rendered summary and a stored consequence because both are framings that
   outlive the material they were drawn from; rule 9 stores `operator_view` because *where a
   person's reading stopped* is derivable from nothing. Freshness is on rule 3's side of that line
   twice over: it is derivable from rows that exist, and **a stored freshness mark is stale by
   construction the moment after it is written** — it is precisely rule 3's drifting summary,
   compressed into one word, about the property whose whole point is that it changes underneath.
   `D-0036` rule 2 is the same argument already applied once: *how long it sat unanswered* gets no
   column because it is a subtraction over rows that already exist.

   **The consequence is accepted rather than hidden**: the answer is a function of the record *and
   of now*, so two renders of one proposal may differ, and rondo says *that* the material moved
   rather than *when*. The render therefore prints **both values** on a `moved` basis — what the
   snapshot recorded and what the same pointer reads today — which is free (both documents are in
   hand) and is the anti-summary move: the operator judges the movement from the material rather
   than from rondo's word for it.

   **No new record**, which is `D-0022` rule 20's build order: the rows this reads all exist, and a
   table for a judgement that is worthless the instant after it is stored is the speculative record
   that order exists to prevent.

7. **Three questions are kept apart, and none of them replaces another.** They are adjacent enough
   that a later change could collapse two of them innocently, so they are written out:

   - **Was this row tampered with or corrupted?** — `D-0022` rule 4's digests, re-derived at every
     read (#66). Answer: refuse to render at all.
   - **Has the premise under this proposal moved since it was composed?** — this entry. Answer:
     render, with a verdict per basis.
   - **What has the store done since the operator last looked?** — `D-0032` rules 9 and 11, at the
     inbox (#64). Answer: a count and an ordered read, over subjects rather than over premises.

   The second is the only one of the three that can be true while the other two are clean, which is
   why #66 could ship the first and third and leave a gate answerable on a dead premise.

## The options, and why the others were refused

| Option | Outcome |
|---|---|
| **A. Per-basis re-gather and compare at render, three-valued** | **Taken** (rules 2, 4, 6). One mechanism, no storage, no clock, and the comparison is over the material rather than over the drafter's word for it |
| **B. Compare `proposal.created_at_ms` against `changedSince(t)`** | **Refused** (rule 2). Inherits `D-0032` rule 9's sample-to-commit ceiling at the screen where losing a row matters most, and answers *a row was written* rather than *the cited material differs* — so it reports movement constantly and teaches the operator to skip the line |
| **C. A `premise_digest` column written at composition, re-checked later** | **Refused.** The snapshot **is** already that record, stored verbatim and digested (`D-0022` rule 4), so the column is a second home for a fact (`D-0022` rule 8). It would also answer only *something moved* and not *what*, which is the summary hazard `D-0032` rule 3 refuses, one field narrower |
| **D. A background re-checker that marks proposals stale** | **Refused.** Nothing in rondo runs periodically and one operator asking is enough (`D-0037` rule 4), and the mark it writes is rule 6's mark that is stale the moment after it is written |
| **E. Withhold or hide a proposal whose premise moved** | **Refused.** A withholding needs a named rule and an owner (`D-0032` rule 10, `D-0036` residual, `D-0033` rule 6), and hiding the stale item removes from the screen the exact thing #39 says the operator must see. A moved premise is information for the decision, not a reason to take the decision away |
| **F. Read the repository and continuo, and decide the four external forms** | **Refused today** (rule 4). It widens `D-0022` rule 3 and adds an arrow for a check nothing has yet been unable to do by opening the locator. `D-0033` rule 9 and `D-0037`'s residual already own "a reader across branches", and this entry does not pre-empt it. The falsifier below is what brings it back |
| **G. Re-draft the proposal and diff the option sets** | **Refused** (rule 3). It asks the drafter whether the drafter is still right, and puts an unrecorded option set on the screen beside a recorded one |
| **H. Do nothing per proposal; the inbox's `changedSince` is enough** | **Refused** (rule 1). It is the position #66 shipped and named as a limitation: it answers over subjects in an interval, and #39's three measured failures are each one proposal resting on one thing that moved |

## What this does not do

- **It does not build anything.** No file under `src/` changes on this entry; the implementation
  list below is what it leaves.
- **It does not widen `D-0022` rule 3**, grant an arrow, add an external dependency or touch
  `src/advisory/`'s allowance. Re-gathering is the composition root re-reading rondo's own rows with
  the call it already makes.
- **It does not add a table, a column, a record kind, a voice or an authority.** `D-0032` rules 4
  and 5 and `D-0034` stand exactly.
- **It does not change what a proposal is or what it cites.** The `Basis` union is unchanged and
  stays closed at five forms; this entry only decides what can be *said about* each form.
- **It does not decide what may be withheld or batched.** `D-0032`, `D-0033` and `D-0036` all refuse
  a policy with no owner, and rule 5's refusal above is that refusal applied to the tempting case.
- **It does not reopen the digest refusal of #66**, and does not soften it: a row whose digests do
  not re-derive is still refused rather than rendered with a mark.
- **It does not claim the operator read anything.** A rendered verdict is a claim by the surface,
  the same grade as `D-0032` rule 9's third clause.

## The implementation this leaves, in order

Named rather than done, so the gate can see the size of what it is approving. Each is small on
purpose; the decision is the part that was load-bearing.

1. **The verdict function in the composition root** — total, over (the stored snapshot document, the
   re-gathered document, one basis), exhaustive over `Basis["form"]` as a `Record` so a sixth form
   is a type error. Rule 5's two edges are two of its arms.
2. **The re-gather seam** — the three gatherers callable without their drafters, which is a
   separation the code already nearly has (`gather` is one function; the two proposal snapshots are
   built inside `draftRunPlan` and `draftContracts` and come out with them).
3. **The render** — the verdict on the basis line that already exists, with both values printed on a
   `moved` basis, and the three-way count on the proposal's header. Nothing is reordered:
   `D-0032` rule 1's order and #66's *"the recommendation is marked where it sits"* are untouched.
4. **The planted cases** — `D-0032` rule 5's precedent, a refusal proved rather than asserted: a row
   moved underneath a composed proposal; a candidate removed so a pointer stops resolving (`moved`,
   not `undetermined`); a gatherer made to refuse (`undetermined`, with the reason on the screen);
   and a proposal whose bases are all external, whose header must say `undetermined` and must not
   say that nothing moved.

## Residuals, with who decides

| Residual | Why not here | Who decides |
|---|---|---|
| The four external basis forms' checkability | Rule 4: deciding them costs a widening of `D-0022` rule 3 and an arrow, and `D-0033` rule 9 / `D-0037`'s residual already own "a reader across branches" | the entry that gives rondo a reader over repositories or over continuo's run state |
| *When* a premise moved, and what moved it | Rule 6: the verdict is a function of now, and the two values on the line are what a person judges from. A history of movements is a record of a derivation | an operator who needs the sequence rather than the fact |
| Whether re-gathering stays affordable at render | `D-0032`'s and `D-0037`'s snapshot-size residual, unchanged: nothing has measured a gathering, and this doubles one per screen | the implementation, which is the first thing that can measure it |
| Whether a per-basis mark is too much on the screen | Rule 1 takes the finer unit because it is the one the operator acts on; no operator has read either | the first operator who reads one |
| A gatherer refusal turning out to be how *"already settled elsewhere"* usually presents | Rule 5 files it under `undetermined` with the reason printed; if it is the common case it is its own value | the entry that has counted them |

## What was measured, and how

At rondo `0e9d4f4` on **2026-09-12**, by reading rather than by running — **this entry measures
documents, schema and the writers already in `src/`, and no behaviour**. #39's measurements are of
a **different organisation** on 2026-09-07 and are cited as requirements rather than re-verified,
which is `D-0032`'s, `D-0036`'s and `D-0037`'s treatment of the same material.

- **The basis union is closed at five forms**, one of which renders inline:
  `src/advisory/proposal.ts:47-64`, with `BASIS_FORMS` at `:69-75`.
- **Which forms rondo's own drafters emit**: every option of `proposeAgentType` (`:596`),
  `proposeContractKeys` (`:627`) and `proposeRetryPlan` (`:695`) carries a `snapshot` basis, as does
  every claim `propose` composes (`:383-473`). That is what makes rule 4's decisive half cover the
  proposals rondo composes today.
- **The snapshot is the stored record of the premise**, kept verbatim beside its digest and
  re-derived at every read: `verbatim()` at `src/store/sqlite.ts:2755-2778`, reached by
  `readProposal` at `:2244`.
- **The comparison's two halves already exist as one function**: `cited()` is total and answers
  `does not resolve` (`src/access/advisory.ts:230-251`), and it takes the JSON document rather than
  the typed snapshot precisely so that *"the same pointer has to resolve against a snapshot just
  composed and against one read back out of a row"*.
- **The gatherers, and their separation from the drafters**: `snapshotIteration` (`:150`), `gather`
  (`:181`), and the two proposal snapshots built inside `draftRunPlan` (`:756`) and `draftContracts`
  (`:916`); the drafters over them are pure functions of the snapshot.
- **What ships for the inbox and answers a different question**: `operator_view` and `changedSince`
  (`D-0032` rules 9 and 11), read by `src/access/inbox.ts`.
- **What #66 left**: its Known limitations, naming the per-proposal form as deliberately out of that
  diff because no decided rule named it.
- **What was not measured**: no proposal has ever been shown after its premise moved; no gathering
  has been timed or sized; no operator has read a freshness mark, so rule 4's central claim — that
  `undetermined` next to a locator changes what a person does — is argued from #39's measurement of
  another organisation and not from rondo.

## What would falsify it

- **An operator answering a gate where every basis read `unmoved` while the premise had in fact
  moved.** That is #39's own falsifier at this entry's unit, and it falsifies rule 2's scope: it
  would mean the premise is not all in the snapshot, and the comparison is over the wrong document.
- **An operator treating `undetermined` as `unmoved`** — reading *rondo could not check this* as
  *this is fine* — which falsifies rule 4's central claim and means the three values need a
  stronger act than a word on a line.
- **A gatherer that is not a pure function of rows** — one that takes a clock, an unstable
  ordering, or anything else that differs between two gatherings of unchanged material. Every basis
  would read `moved` and the mark becomes noise, and it would fail *quietly*, which is why it is
  named here rather than left to be found.
- **A non-`snapshot` basis form rondo can decide without widening `D-0022` rule 3**, which reopens
  rule 4's mapping — not the union, and not the three values.
- **Re-gathering proving unaffordable at render**, which moves rule 6 toward a stored mark and
  obliges whatever stores it to answer rule 3's drift argument rather than to skip it.
- **A basis whose stored and re-gathered values differ for a reason that is not movement** — a
  serialisation detail, a field rondo copies differently today — which is a false `moved` and is
  rule 2's noise argument firing against rule 2.
- **`D-0022` rule 4 being superseded so the snapshot stops being stored verbatim**, which removes
  the left-hand side of every comparison here and takes the whole entry with it.
- **An operator who wants the check without asking for it** — a standing re-check, a notification —
  which is option D's argument arriving on evidence, and which is `D-0037` rule 4's trigger as much
  as this entry's.
- Any measurement above failing to reproduce at `0e9d4f4`.
