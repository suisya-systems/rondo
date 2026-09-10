# Draft decision entry: the advisory record, designed against the surface it has to feed

**Status: draft, propose-only.** This file is not `DECISIONS.md` and settles nothing.
It holds the text of the entry that rondo#39, rondo#40 and rondo#41 ask for, so
that the gate approves *text* rather than a promise of text - the shape
`lap-review-stage-decision-draft.md` used for `D-0029`. On ratification the body
below is appended to `DECISIONS.md` as **`D-0032`**, its index row is added, and
**this file is removed in the same commit**, because a second copy of an accepted
decision has no rule for which copy wins (`docs/README.md`'s own index rule).
Until then `D-0032` is a name for a thing that does not exist, not a citation.

Index row to add:

```
| D-0032 | The record the operator's surface has to be able to show: alternatives inside one immutable proposal, a basis that is a locator, a durable last-look mark, and a row for every silence | accepted |
```

---

## D-0032 - The record the operator's surface has to be able to show: alternatives inside one immutable proposal, a basis that is a locator, a durable last-look mark, and a row for every silence

**Status:** draft (proposed 2026-09-11). Refs rondo#39, rondo#40, rondo#41.

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
   cannot tell what is waiting on the operator from what the operator has already settled, and #40's
   count of what reached the operator is uncountable in the direction that matters.

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

9. **`operator_view(actor_id, viewed_at_ms)`, append-only, is the durable last-look mark.** #39's
   *"what changed since the operator last looked"* and #41's *"recovering context after a gap"* are
   the same question, and today only the replaced role's in-memory context answers it. Every record
   kind in the store already carries a caller-clock timestamp, so the only missing fact is when the
   operator last looked - two columns, written by the surface when it renders.

   **Per-item read/unread flags are refused**: one row per look answers the same question as N rows
   per item, and a per-item flag is a mutable column on an immutable record, which is `D-0022` rule
   4's whole objection.

   **What this does not claim.** A look is a claim by the surface that it rendered, not proof that a
   person read anything - the same grade as `D-0029` rule 11's third clause, and it is recorded here
   rather than left to be discovered.

10. **Silence leaves a row: `withholding(withheld_at_ms, subject_kind, subject_id, rule_name)`,
    append-only, and the breakdown is a `GROUP BY` over it.** #40's hazard is that a layer deciding
    what the operator sees also decides what they do not see, and that *"nothing happened"* leaves
    nothing to audit. The shape is not new: `admission_refusal` exists for exactly this reason - a
    refusal that reserves nothing, takes no lock and would otherwise leave no trace, counted so that
    a bound can be raised because somebody was counted rather than because somebody complained.

    **`rule_name` is required, and it is the point of the table.** *"Suppressed 40"* is a number;
    *"suppressed 40, of which 31 by the duplicate-delivery rule"* is a record. A withholding whose
    rule cannot be named is a judgement with no policy behind it, and the writer refuses it.

    **A separate table rather than a flag on the withheld thing**, because the most common
    withholding has no row anywhere to carry a flag: it was never composed into a proposal at all.

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
      timestamps, which is what makes rule 9's two columns worth storing.

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
| *"3 waiting for you, 12 changed since 09:14"* | `operator_view.viewed_at_ms` (rule 9), counted over rows whose timestamp is later |
| One item's one-line title | the recommended option's label inside `payload` (rule 1) |
| Its options, with the recommendation marked | the ordered option set inside `payload` (rule 1) |
| The basis under each option | `basis` locators (rule 2): snapshot pointers render inline from the row's own verbatim snapshot, external locators render as something to open |
| *"Answering this issues one contract and cannot be undone"* | computed from `kind` and its target (rule 4) |
| The voice badge, and whether the item can be approved at all | `kind` (rule 5); an `explanation` also shows `derivation` and its `undetermined` claims (rule 8) |
| *"Changed since you last looked"* per item | the item's own timestamp against `operator_view` (rule 9) |
| Waiting on you / on CI / still running | `iteration.status` - already stored, no new field |
| *"6 were put to you, 40 were not"* with a breakdown | `withholding` grouped by `rule_name` (rule 10), against the answered and refused `human_decision` rows (rule 6) |
| Where this came from | `elevated_from_message_id` / `elevated_by_actor_id` (rule 7), and `proposal_id` / `composition.contract_digest` for the rest of the chain |
| A closed item, and what was decided | `human_decision` outcome (rule 6), reachable because of rule 11's terminal enumeration |

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
- **A second surface, or a second approver**, which makes rule 9's mark per-actor-per-surface and
  makes `D-0020` rule 2's allowlist of size one a real set.
- **The between-laps component arriving** (#40), which is what turns rule 10 from a table with one
  writer into the audit surface #40 asks for, and may want fields this entry did not place.
- **The conversation schema arriving with message ids that are not durable and immutable**, which
  breaks rule 7's reference and would make the elevation link a dangling one.
- **`D-0022` rule 4 being superseded so the snapshot stops being stored verbatim**, which removes the
  inline half of rule 2 and turns every basis into something to open.
- Any measurement above failing to reproduce at `2e9db2b`.
