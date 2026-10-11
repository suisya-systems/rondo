# model drafter, planted requests -- what `D-0071` rule 7.4 asks for, and what is recorded

`D-0071` rule 7.4 says "a model drafter exists" needs two things: the drafter is built, and **two
planted requests recorded in `docs/operations/` were drafted as expected**. CI cannot prove the
second half (`D-0065` rule 5.6's reason; `test/access/model-draft/host.test.ts` says the same in its
header). This file is that record. Rondo#635 asked for it.

**Result: no run of either planted request is recorded anywhere in this repository.** This file
does not invent one. Every "not recorded" below is a gap, not a pass.

## 1. What each request must show

| | request shape (rule 7.4) | expected draft |
|---|---|---|
| **R1** | words that admit two readings with different visible results | a P2 (an ask-back), not a guessed plan |
| **R2** | two separable parts | two plans whose bases lead back to each part |

## 2. What was searched

`DECISIONS.md`, `docs/operations/`, `docs/design/`, `test/access/model-draft/`, and the git log of
every ref (`planted`, `drafter`, `live`). The drafter's building changes (`5798cca` part A, `661f90c`
part B, `87099ad` and `4a6ebba` for the scope screen) contain no planted-request run. The only
mention of rule 7.4 outside `DECISIONS.md` is the `host.test.ts` header, which defers to this record.
`DECISIONS.md` itself lists the gap as open (the C1 criterion table, "`D-0071` rule 7.4's two planted
drafter requests are not recorded"). `D-0071`'s own cost line says the building change would record
what a draft costs on these requests; that is not recorded either.

## 3. What is recorded

| | R1 | R2 |
|---|---|---|
| Request text as sent | not recorded | not recorded |
| Date, commit, machine, model | not recorded | not recorded |
| What the drafter did (message, proposal row, plans) | not recorded | not recorded |
| Whether the expected shape (section 1) came back | not recorded | not recorded |
| What the draft cost | not recorded | not recorded |

What CI does cover, with a fake `claude` in place of the model (`test/access/model-draft/`): the
material the drafter is handed, the structural check of rule 7.1, and the one-transaction write of
rule 7.3. None of it shows what a real model drafts, so none of it stands in for R1 or R2.

## 4. To close the gap

Run R1 and R2 once each against a real model on a store with a held template plan, with the
operator's own login (a paid run, so not done by the change that adds this file). For each, replace
the "not recorded" cells with the exact request text, the date and commit, the commands run, and the
output that came back, in the form of
[`model-reviewer-planted-lap.md`](model-reviewer-planted-lap.md). A run whose draft is not the
expected shape is recorded as such, and rule 7.4 stays open.
