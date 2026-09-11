# Draft decision entry — the between-laps composition

Draft of a `DECISIONS.md` entry, in the shape `D-0029`, `D-0032`, `D-0033` and `D-0036` used: text
the gate can approve, appended and removed once it is taken. It takes the id `D-0037` when appended.

---

## D-0037 — The between-laps composition: a fourth snapshot rather than a fourth component, three claim families rondo can ground, one verb an operator runs, and a breakdown that answers over an interval

**Status:** proposed (draft). Refs rondo#40, rondo#39, rondo#41.

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
