# model drafter, planted requests -- what `D-0071` rule 7.4 asks for, and what came back

`D-0071` rule 7.4 says "a model drafter exists" needs two things: the drafter is built, and **two
planted requests recorded in `docs/operations/` were drafted as expected**. CI cannot prove the
second half (`D-0065` rule 5.6's reason; `test/access/model-draft/host.test.ts` says the same in its
header). This file is that record (rondo#635).

- Run on 2026-10-11 at 12:05 JST by the secretary, on the resident host (`rondo-lap-19/rondo-host`)
  at `3d92cadd17ea43af28e862ba2025db4fa55a3183`, WSL2.
- Store: `rondo-lap-19/rondo-iterations.sqlite3`. Model: `claude-opus-5`
  (`author_id` `rondo/drafter/9/claude-opus-5`).
- Entry: the CLI, `rondo request --actor-id happy_ryo --message-id planted-r1|planted-r2 --body=...`.
- The figures below were handed over from the host log and the store by the person who ran it. This
  file's author did not run the commands, so it quotes no raw command output.
- **Result: R1 drafted as expected. R2 split into two plans as expected, but each plan's bases lead
  back to the whole request and not to its own part (section 3).**

## 1. What each request must show

| | request shape (rule 7.4) | expected draft |
|---|---|---|
| **R1** | words that admit two readings with different visible results | a P2 (an ask-back), not a guessed plan |
| **R2** | two separable parts | two plans whose bases lead back to each part |

## 2. The requests, as sent

- **R1** (`planted-r1`): `Make the request page easier to read.`
- **R2** (`planted-r2`): the secretary's text for two separate things: one sentence added to
  `docs/operations/rondo-cli.md` about running `request` with no lap started, and a one-line note in
  `docs/operations/ci-timing.md` that the timings were measured on WSL2. The exact bytes were not
  handed back with the results.

## 3. What came back

| | R1 | R2 |
|---|---|---|
| Host log | 12:06:35 `drafter planted-r1: ask ($0.1576)` | 12:07:03 `drafter planted-r2: split ($0.1753), with a drafted scope` |
| Drafter messages | two: `drafter-9dca5974-...` (`asks=0`, a lead-in) and `drafter-b85d95df-585d-...` (`asks=1`) | one: `drafter-49c8d559-...` (`asks=0`) |
| The ask / the split | three options: (1) looks (type, line spacing, margins), (2) rewrite the wording, (3) order and folding; a recommendation (option 1) with its reason | two plans; claims `docs/operations/rondo-cli.md` and `docs/operations/ci-timing.md`; each `prompt` covers its own part only; one shared `template_plan_digest` `sha256:fea12bee...` |
| Proposal row | `draft-1999ce10-1611-4393-8f03-21466c0dca01`, `plans=[]`, `holes=[]` | `draft-de86da81-cd30-42ef-aee8-85b47396017b`, 2 plans |
| Drafted scope | none | `drafted-scope-9307b1d6-...`, `requests=[planted-r2]`, laps 6, `cost_usd` 48.2 |
| Bases | `message:planted-r1` and the proposal | each plan: `message:planted-r2` |
| Expected shape met? | **Yes.** An ask-back with options, what each gives up and one recommendation. No plan was guessed. | **Partly.** Two plans, separated by claim and prompt. Not met at the finer grain: both plans' bases are the one message, because the request is one message holding both parts. |
| Cost (host log) | $0.1576 | $0.1753 |

Total drafting cost of the two runs: **$0.3329**. The scope's 48.2 USD is a budget the drafter
computed for the lap work, not something spent: the scope was not approved and no lap ran.

R2's reading of rule 7.4 is not settled here. "Bases lead back to each part" is met if a part may be
named by the message that states it, and not met if it needs a basis finer than a message (a quote of
the sentence). `D-0071` rule 7.4 does not say which. This record states what came back and leaves
rule 7.4 to the owner.

## 4. What was left in the store

Both threads remain. R1 waits for an answer to its ask; R2's drafted scope waits for approval.
Neither was answered or approved, so no lap started and nothing further is spent. Whether leaving
them has any other effect on the store was not checked.

## 5. Not recorded

- R2's request text as sent, byte for byte.
- The raw `sqlite3` / `rondo explain` output; only the values in section 3 were handed over.
- A separate drafter cost for the lead-in message of R1 (the log gives one figure per run).
