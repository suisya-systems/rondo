# Draft decision entry — who owns the work between laps

**This file is a draft of a `DECISIONS.md` entry, not a design document and not a
decision.** It is here so that rondo's human gate can approve *text* rather than a
promise of text, which is the operation `D-0029` used and `D-0032` repeated. The
entry it would create is referred to below as **`D-0033`** — a name for a thing
that does not exist, not a citation — and it takes the next free id at the gate.

**On ratification this file is removed**, for `D-0029`'s reason and by `D-0032`'s
precedent: once appended, a copy standing beside the accepted entry is a second
copy with no rule for which copy wins. Its history is in the pull request that
added it. **It leaves no design document behind**, for `D-0032`'s reason as well:
everything it measures is in `DECISIONS.md`, in the schema and in `src/` already,
so there is nothing a frozen document would preserve that the entry does not
carry.

Nothing under `src/` changes with this file, and nothing in `DECISIONS.md`
changes until the gate takes it.

---

## D-00NN — Nothing new owns the work between laps: three existing owners, a snapshot that widens instead of a component that decides, and one gap named rather than filled

**Status:** draft (not yet taken). Refs rondo#40, rondo#39, rondo#41.

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
| **D. Place no owner at all and leave #40 open** | **Refused for two of the three parts, taken for the third** (rule 9). Sections 1 and 2 have owners available today at no cost; the repository-namespace half genuinely has none, and saying so with the bound that keeps it from firing is more useful than a component with nothing to run on |
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
  issue filing, a rename — which reverses rules 2 and 3 at their premise.
- **An operator asking for a withholding whose rule cannot be written as data**
  (rule 7), or naming a `rule_name` that resolves to nothing.
- **A host-wide snapshot that cannot be gathered affordably**, which moves rule 4
  from "the same function with a wider argument" to a component with a read strategy.
- **Silence that leaves no row**, observed after the first #40 work ships — rule 10
  failing in practice, which `D-0032` rule 10 already records as the bound it cannot
  prove.
- **continuo `D-1104` landing** (`D-0023` rule 17), and **the conversation schema
  arriving** (`D-0020` rule 5), each of which unblocks a residual above.
- Any measurement above failing to reproduce at `e1a64ff`.
