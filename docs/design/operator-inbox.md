# D-0036 (draft) — The operator's inbox, decided as three open questions and not as a fourth record design: a presentation counted once per subject, the conversation only as far as elevation reaches, and a two-way wait that admits it is not three

**Status: draft, for rondo's human gate.** This document takes no decision. It is
the text of the entry the gate would create, written out so the gate can approve
text rather than a promise of text — the precedent is `D-0032`'s own draft, which
`docs/design/` carried as `advisory-record-decision-draft.md` and which was
removed once appended. This one is to be removed on the same terms and for the
same reason: two copies of an accepted decision have no rule for which wins.
Nothing in `DECISIONS.md` changes with this document, and nothing in `src/`
changes until the entry exists.

**The scope was proposed and approved before it was drafted**, which is why this
document is short where `D-0032` is long. rondo#41 states five requirements on
the operator's surface. Four of them already have decided *and shipped* answers
(`D-0032`, `D-0034`, in #51 and #53), and re-deciding them here would produce a
second home for a rule rather than a rule. **This entry takes the three questions
#41 raises that nothing in the tree answers, and nothing else.**

---

## What #41 asks that is already answered

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

---

## Decision

### 1. A presentation is counted **once per subject**, not once per render, and the two rejected options are recorded with what each of them protected.

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

### 2. **"How long it sat unanswered" gets no column**, because it is a subtraction over rows that already exist.

The inbox's most-wanted line — *this has been waiting on you since 09:14* — is the
proposal row's `created_at_ms`, or its `presented` row's `at_ms`, against the
absence of a `human_decision` for that `proposal_id`. `D-0032` rule 6 already makes
*declined* and *never answered* different rows rather than the same absence, which
is the only thing that made the subtraction ambiguous. A column would be a second
home for a computed fact, which is `D-0022` rule 8 and `D-0032` rule 4's own
argument applied to the field that would have been added first.

### 3. **The conversation schema is fixed only as far as elevation reaches: three properties, and the rest stays explicitly undecided.**

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

### 4. **An elevation that names no message is refused by the writer, in the shape `D-0032` rule 5 already uses.**

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

### 5. **The wait is a two-way partition and not the three-way one #41 §4 describes; the third distinction is refused because taking it means widening what rondo may read.**

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

---

## What this does not do

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

---

## The implementation this leaves, in order

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

---

## Residuals, with who decides

| Residual | Why not here | Who decides |
|---|---|---|
| The rest of the conversation schema (body type, authorship, ordering, retention) | Nothing composes a message yet; rule 3 fixes what elevation reaches and no more | the task that first writes a message |
| How often a subject was presented | Rule 1's stated ceiling; no question in #41 needs it | the entry that has such a question |
| A withholding rule for the inbox | `D-0032` and `D-0033` both refuse a policy with no owner; the default is that nothing is withheld | the operator, by writing one |
| Whether a look is per-surface rather than per-actor | `D-0032`'s residual, unchanged: one operator, one allowlist of size one | a second concurrent surface |
| CI state as a distinct wait | Rule 5: it costs a widening of `D-0022` rule 3 for a distinction the operator cannot act on | an operator who can act on it |

---

## What was measured, and how

At rondo `5bfb18f` on **2026-09-11**, by reading rather than by running. This entry
measures documents, schema and the writers already in `src/`; it measures no
behaviour, and #41's own measurements are of a different organisation on
2026-09-07 and are cited here as requirements rather than re-verified.

- **The record as shipped**: `src/store/sqlite.ts` — the `proposal` table and its
  three `CHECK`s (629-655), the elevation pair (649-650) and the `CHECK` keeping them null together (654), `operator_view`
  (760-763) and `operator_attention` with both of its `CHECK`s (779-787).
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

---

## What would falsify it

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
