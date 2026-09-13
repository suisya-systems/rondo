# lap 9 dogfood -- the person ran rondo, a scope approved before the first lap, and the redo that carried the review had to leave the scope

A ninth walk of the arc, written the way [`lap-8-dogfood.md`](lap-8-dogfood.md) is: the commands
that were actually run and the output that actually came back, as a difference against lap 8.
**It is the first walk in which the person typed every rondo verb in their own terminal**, and the
first walk of D-0069 (#213): a scope recorded from a plan and approved before the first lap, which
`start --scope-decision-id` then spent.

- Run on 2026-09-14 01:04-01:20 JST (2026-09-13 16:04-16:20 UTC), with rondo-host and the target
  `rondo-gh` both at `ad019db` (the #213 merge), continuo `fcf86eb2b7eb34d65bf73188b2b34544fab6820c`,
  and the environment [`lap-9-runbook.md`](lap-9-runbook.md) section 1 describes
  (`/tmp/claude-1000/rondo-dogfood-lap-9-env`).
- **The operator was the person.** They pasted the blocks of the claude-org note
  `notes/lap9-concrete-steps.md` (a no-thinking version of the runbook: paste, look, what to do if it
  differs) into a normal terminal. The claude-org secretary only answered their questions and typed
  no rondo verb. Every row that names an actor says `happy_ryo`, and this time that is literally true
  (compare lap 8 N-28).
- The request was rondo#197, *a basis form for a scope row, so the durable stop's bases name the
  scope (D-0066 4.4)*.
- **Two paid laps: `lap9-001` $1.884267 / 46 turns / 233.946 s under the scope, and `lap9-002`
  $0.455749 / 12 turns / 69.787 s, a `revise` outside the scope.** Total lap cost **$2.340016**.
- **Wall clock from step 1 to the last gate answer: 16 min 11 s** (`timeline.txt`). The two laps
  took 5 min 30 s of it; the rest, 10 min 26 s, was the person's own (section 2).
- The result was published as **suisya-systems/rondo#215** (branch `rondo/lap9-002`, both commits).
  The secretary added `Closes #197` to its body afterwards. It was merged at 2026-09-13 16:30:39 UTC.

Sources: `logs/timeline.txt`, `logs/vars.sh`, `logs/step2.log` to `logs/step8b.log`,
`logs/step7-verify.log` and `logs/step7b-verify.log` under the environment root, and the store
`rondo-iterations.sqlite3`, read with `node:sqlite` opened `readOnly`. Times below are JST, as
`timeline.txt` writes them. The store's `*_ms` values are UTC epoch and agree with it to the second.

---

## 1. The questions, answered

| # | question | answer | evidence |
|---|---|---|---|
| 1 | could the scope be drafted and approved before the first lap? | **yes** | `scope` row `scope-1789315536719` (created 01:05:36.719), `scope_decision` `approved` at 01:06:18.380, and `lap9-001` created at 01:06:36.878. N-25 is closed by D-0069 |
| 2 | did the first lap spend the scope? | **yes** | one `scope_consumption` row: `act_kind admission`, `subject_id lap9-001`, `proposal_id null`, `consumed_at_ms 1789315596878`, equal to `lap9-001.created_at_ms` |
| 3 | did the model reviewer run? | **yes, on both laps** | two `lap_reading` rows by `rondo/model/1/gpt-6-astra`: `lap9-001` `concerns` with one `major` finding (`basisResolved true`), `lap9-002` `clear`. N-29 is closed by #205 / #209 |
| 4 | was every decision the person's own, typed by them? | **yes** | the scope, its decision, the `agent_type_record` and the verification claim all name `happy_ryo`, and no claude-org worker ran a verb |
| 5 | could the review's finding be fixed inside the scope? | **no** | the in-scope `retry` re-runs the stored plan and cannot carry the finding, so the person used `revise`, which takes no scope. `scope_consumption` holds no row for `lap9-002` (N-33) |
| 6 | did the redo inherit the request link? | **yes** | `lap9-002.request_message_id = 'lap9-req-197'` with no `--message-id` given to `revise`, and `supersedes_iteration_id = 'lap9-001'`. #195 works |
| 7 | how many times did the person have to think? | **"考えたところはない"** ("there was no point where I had to think") | the person's own answer to the record sheet's "times you stopped to think". Their view of the whole is in section 8 |

## 2. Where a person was touched, and where the time went

Three decisions: **the scope approval (P1), `revise` on `lap9-001`, and `approve` on `lap9-002`**.
Nothing else asked for a judgment. No stop was written, and no refusal happened
(`admission_refusal` has 0 rows, and no `conversation_message` has `asks 1`).

| from `timeline.txt` | step | duration | whose time |
|---|---|---|---|
| 01:04:28 | step 1 load the environment | 0 s | person |
| 01:04:49-01:04:50 | step 2 `request` | 1 s | command |
| 01:05:16 | step 3a probe `scope` (refused on purpose, reads the digest) | 0 s | command |
| 01:05:36 | step 3b `scope` recorded | 0 s | command |
| 01:06:18 | step 4 `decide-scope approved` (**decision 1, P1**) | 0 s | command |
| 01:06:36-01:10:45 | step 5 `start` under the scope (`lap9-001`, and its model reading) | **4 min 09 s** | AI |
| 01:14:24 | step 6 read the gate | 0 s | command |
| 01:14:53-01:14:59 | step 7 check from outside (`npm run verify`) | 6 s | command |
| 01:17:27-01:18:48 | step 8 `revise` (**decision 2**) and `lap9-002` | **1 min 21 s** | AI |
| 01:20:10-01:20:16 | step 7b check `lap9-002` from outside | 6 s | command |
| 01:20:37-01:20:39 | step 8b `answer approve` on `lap9-002` (**decision 3**) | 2 s | command |

- **Total 971 s (16 min 11 s).** The laps took 330 s (5 min 30 s), the other commands 15 s, and the
  gaps between steps 626 s (10 min 26 s). The gaps are the person's: reading the output, deciding,
  and reading the secretary's answers to their questions.
- **The longest stretch was 402 s (6 min 42 s), from the end of `lap9-001` (01:10:45) to the start
  of `revise` (01:17:27).** Steps 6 and 7 ran inside it. In it the person read a gate with a `major`
  finding, found that the redo that carries it cannot be in-scope (N-33), and decided to revise.
- Gaps of 21 s to 42 s before each of steps 2 to 5: the P1 gap (reading the scope screen) was 42 s.
- `publish` is not in `timeline.txt` and has no log. Its thread row `report-published-lap9-002` is at
  01:26:14.329.

## 3. What was run

All from `/tmp/claude-1000/rondo-dogfood-lap-9-env/rondo-host`, each block pasted from the
concrete-steps note. Outputs are from the step logs, with the `ExperimentalWarning` lines removed.

```
$ node bin/rondo.mjs request --actor-id happy_ryo --message-id lap9-req-197 --body="$(cat $R/request.txt)"
opened request 'lap9-req-197'

# step 3a: a dummy digest, refused, to read the plan's agent type (nothing recorded)
$ node bin/rondo.mjs scope --payload-file $L/scope-probe.json --actor-id happy_ryo --plan $R/plan.json
plan .../plan.json: agent type sha256:0fc3ca257bac9293524ce48d4739c5ad4c2c01eca670106442008b8035e4942e
the scope 'scope-1789315516214' records the agent type 'sha256:0fc3ca25…' from a plan and does not
list it: a record is written only for a scope a person will be asked to approve over it (D-0069 section 1)

# step 3b
$ node bin/rondo.mjs scope --payload-file $L/scope.json --actor-id happy_ryo --plan $R/plan.json
recorded as scope 'scope-1789315536719'
digest: sha256:68c34fcc7e76d48ba1cd30d78b2743032cbdaa666e949be2ff0a6f74462f684e
requests: lap9-req-197
workspace: .../rondo-gh at .../workspaces
agent types: sha256:0fc3ca25…
plan .../plan.json: agent type sha256:0fc3ca25…
agent type sha256:0fc3ca25…: tier standard, granted command.run (held from a plan recorded for a scope)
budgets: 2 laps, 2 review rounds, 5 USD with 2.5 USD reserved per unread lap, expires at 1789337136642 ms
severity threshold: major
outward acts: none
irreversible additions: none
The cost budget counts the laps' own cost only: ...
Next: rondo decide-scope --scope-id scope-1789315536719 --scope-digest sha256:68c34fcc… --actor-id ID --outcome approved

# step 4 (P1)
$ node bin/rondo.mjs decide-scope --scope-id "$SCOPE_ID" --scope-digest "$SCOPE_DIGEST" --actor-id happy_ryo --outcome approved
recorded as scope decision 'scope-decision-scope-1789315536719-1789315578380'
Nothing has been spent. ...

# step 5
$ node bin/rondo.mjs start --plan $R/plan.json --iteration-id lap9-001 \
    --prompt-file $R/request.txt --message-id lap9-req-197 --scope-decision-id "$DECISION_ID"
  Reserved iteration lap9-001 at 'planned', holding run id rondo-lap9-001, branch rondo/lap9-001 ...
  It came from the request opened by message lap9-req-197.
  An independent reading of the work found nothing to raise (rondo/deterministic/2). It read 1 commit(s) and 11 file(s) ...
  The lap answered. Gate gate/worker_escalation/d263d4ea-.../0 is already open; ...
  The lap cost 1.884267 USD over 46 turn(s) in 233946 ms, read from its terminal 'result' event.
  Reported to the request 'lap9-req-197' as message 'report-gate-lap9-001-gate/worker_escalation/d263d4ea-.../0'.
A person has to answer this before anything lands. Next: rondo answer
model review  taking a model reading of this work; the gate is already open and does not wait for it
model review  1 point(s) raised (rondo/model/1/gpt-6-astra):
        - [major] The new scope-basis rendering and undetermined freshness behavior have no test coverage
          in the delivered changes; the added tests cover parsing, storage validation, and stop bases only.
          bases: src/access/advisory.ts:296, src/access/advisory.ts:2109, transcript event 145
```

The scope values were the runbook's proposal, unchanged (`logs/scope.json`). The probe's refusal
recorded nothing: the store holds one `scope` row and one `agent_type_record` row, both from step 3b.

## 4. The gate of `lap9-001`, and the decision to revise

`rondo answer --iteration-id lap9-001` (step 6) showed:

- **why**: a seventh basis form `{ form: "scope", scopeId }` in `src/advisory/proposal.ts`, read back by
  the payload reader, shown as `scope ID`, always *undetermined* for freshness, accepted as
  `--basis scope:ID`; the store's locator fields and a thread writer that refuses a `scope` basis
  naming no scope row; the stop's bases now the request root, the scope row, then (for a redo) the
  latest lap; and a dated D-0066 note under section 4 with #196's lineage-tree reading. The worker
  raised one decision: rule 4.4's "the refused test" was **not** made a basis, because the test is a
  fixed name and not a row, and the D-0066 note says so.
- **work**: `90bbe52` on `rondo/lap9-001`, 11 files: `DECISIONS.md (+13 -0)`,
  `src/access/advisory.ts (+7 -2)`, `src/access/cli.ts (+8 -4)`, `src/access/scope.ts (+7 -8)`,
  `src/advisory/proposal.ts (+13 -4)`, `src/store/records.ts (+2 -1)`, `src/store/sqlite.ts (+15 -2)`,
  and four test files.
- **fence**: the nine declared subjects, envelope `c01b76b8…` re-checked, and *"the fence refused 1
  call(s)"*: a `grep ... DECISIONS.md | awk ...` outline command (also the one entry in
  `iteration.permission_denials`).
- **review**: deterministic `clear`; model reading `concerns`, the one `major` finding above.

Step 7 (`logs/step7.log`, `logs/step7-verify.log`), from outside the fence:

```
== outside expected files
src/access/scope.ts
== uncommitted
(end)
== model review major+
        - [major] The new scope-basis rendering and undetermined freshness behavior have no test coverage ...
EXIT=0          Test Files 46 passed | 1 skipped (47)   Tests 1172 passed | 5 skipped (1177)
```

Against the note's step 8 table, item 1 flagged `src/access/scope.ts`, which is where the stop's
bases are written, so it is explained by #197 (N-36). Item 3 (a `major` finding) said **revise**.

**Why `revise` and not the in-scope `retry`.** The scope was approved with `laps 2` and
`review_rounds 2` exactly so that one redo could be inside it. But `rondo retry --iteration-id
--successor-id --scope-decision-id` admits **the predecessor's stored plan again**
(`commandScopedRetry` in `src/access/cli.ts` reads `predecessor.record.plan` and passes it unchanged),
and takes no body. A retry would have re-run the same request without the finding. `revise` carries
a body into the next lap's prompt, but its flags are `actor-id`, `body` and `iteration-id` only: it
cannot name a scope. So the redo that carries the finding had to run outside the scope (N-33):

```
$ node bin/rondo.mjs revise --actor-id happy_ryo --iteration-id lap9-002 --body="..."
gate gate/worker_escalation/d263d4ea-.../0 is at stage 'received'
  ...
  gate ack       stage is now 'forwarded', and the gate is closed
iteration 'lap9-001' is closed
  Gate outcome: answered_and_forwarded.
revising as iteration 'lap9-002', cut from 'rondo/lap9-001'
  Reserved iteration lap9-002 at 'planned', ...
  It is a revision of iteration lap9-001, and the row records that ...
  It came from the request opened by message lap9-req-197.
  An independent reading of the work found nothing to raise (rondo/deterministic/2). It read 1 commit(s) and 2 file(s) ...
  The lap cost 0.455749 USD over 12 turn(s) in 69787 ms, read from its terminal 'result' event.
model review  taking a model reading of this work; the gate is already open and does not wait for it
model review  raised nothing (rondo/model/1/gpt-6-astra).
```

The revision text, as stored at the end of `lap9-002.request`:

```
--- Revision requested at the gate ---

A previous lap (run 'rondo-lap9-001', iteration 'lap9-001') did this work and stopped at a gate. A person read it and asked for a change:

Add tests for the new scope-basis rendering in src/access/advisory.ts and for the undetermined freshness of a scope basis; the model review raised this as major (no test coverage).

That lap's commits are already on 'rondo/lap9-001', which is the branch this workspace was cut from. Continue from them rather than starting the request over.
```

`lap9-002` committed `29f5f57` (`test/access/advisory-freshness.test.ts (+53 -0)`,
`test/access/advisory.test.ts (+6 -0)`), with no fence refusal. Step 7b: `== uncommitted` then
`(end)`, verify `EXIT=0`, **1174 passed, 5 skipped** (two more than `lap9-001`'s 1172). Step 8b
approved it with `--verified="read the diff; npm run verify in the workspace EXIT=0; model review
raised nothing"`, which is the one `operator_verification_claim` row.

## 5. The rows, read against D-0061, D-0065, D-0066 and D-0069

```
> SELECT id,status,request_message_id,supersedes_iteration_id,lap_cost_usd,lap_turns,lap_duration_ms,gate_outcome,created_at_ms FROM iteration
{"id":"lap9-001","status":"closed","request_message_id":"lap9-req-197","supersedes_iteration_id":null,"lap_cost_usd":1.884267,"lap_turns":46,"lap_duration_ms":233946,"gate_outcome":"answered_and_forwarded","created_at_ms":1789315596878}
{"id":"lap9-002","status":"closed","request_message_id":"lap9-req-197","supersedes_iteration_id":"lap9-001","lap_cost_usd":0.455749,"lap_turns":12,"lap_duration_ms":69787,"gate_outcome":"answered_and_forwarded","created_at_ms":1789316249273}
> SELECT * FROM agent_type_record
{"agent_type_digest":"sha256:0fc3ca25…4942e","agent_type_input":"{\"agentTypeId\":\"worker-basic\",...,\"granted\":[\"command.run\"],\"loopPolicy\":{\"maxReviewRounds\":2,...},...}","plan_digest":"sha256:df054a68…","recorded_by":"happy_ryo","recorded_at_ms":1789315536719}
> SELECT scope_id,scope_digest,supersedes_scope_id,author_kind,author_id,bases,created_at_ms FROM scope
{"scope_id":"scope-1789315536719","scope_digest":"sha256:68c34fcc…","supersedes_scope_id":null,"author_kind":"operator","author_id":"happy_ryo","bases":"[]","created_at_ms":1789315536719}
> SELECT * FROM scope_decision
{"scope_decision_id":"scope-decision-scope-1789315536719-1789315578380","scope_id":"scope-1789315536719","scope_digest":"sha256:68c34fcc…","outcome":"approved","actor_id":"happy_ryo","recorded_by":"rondo/cli","decided_at_ms":1789315578380}
> SELECT * FROM scope_consumption
{"scope_decision_id":"scope-decision-scope-1789315536719-1789315578380","act_kind":"admission","subject_id":"lap9-001","proposal_id":null,"consumed_at_ms":1789315596878}
> SELECT iteration_id,read_at_ms,drafter,verdict,findings,graded FROM lap_reading
{"iteration_id":"lap9-001","read_at_ms":1789315827088,"drafter":"rondo/deterministic/2","verdict":"clear","findings":"[]","graded":null}
{"iteration_id":"lap9-001","read_at_ms":1789315845180,"drafter":"rondo/model/1/gpt-6-astra","verdict":"concerns","findings":"[\"The new scope-basis rendering ...\"]","graded":"[{\"bases\":[{\"kind\":\"file\",\"line\":296,\"path\":\"src/access/advisory.ts\"},{\"kind\":\"file\",\"line\":2109,\"path\":\"src/access/advisory.ts\"},{\"index\":145,\"kind\":\"event\"}],\"basisResolved\":true,\"severity\":\"major\"}]"}
{"iteration_id":"lap9-002","read_at_ms":1789316319940,"drafter":"rondo/deterministic/2","verdict":"clear","findings":"[]","graded":null}
{"iteration_id":"lap9-002","read_at_ms":1789316328358,"drafter":"rondo/model/1/gpt-6-astra","verdict":"clear","findings":"[]","graded":"[]"}
> SELECT message_id,author_kind,author_id,in_reply_to,asks,at_ms,body FROM conversation_message   (request body elided)
{"message_id":"lap9-req-197","author_kind":"operator","author_id":"happy_ryo","in_reply_to":null,"asks":0,"at_ms":1789315490125}
{"message_id":"report-gate-lap9-001-gate/worker_escalation/d263d4ea-.../0","author_kind":"drafter","in_reply_to":"lap9-req-197","asks":0,"at_ms":1789315827093,"body":"Lap 'lap9-001' reached gate '...' at stage 'received'. Its independent reading says 'clear' with 0 finding(s)."}
{"message_id":"report-gate-lap9-002-gate/worker_escalation/523f830d-.../0","author_kind":"drafter","in_reply_to":"lap9-req-197","asks":0,"at_ms":1789316319945,"body":"Lap 'lap9-002' reached gate '...' at stage 'received'. Its independent reading says 'clear' with 0 finding(s)."}
{"message_id":"report-published-lap9-002","author_kind":"drafter","in_reply_to":"lap9-req-197","asks":0,"at_ms":1789316774329,"body":"Lap 'lap9-002' was published: its branch was pushed, pull request https://github.com/suisya-systems/rondo/pull/215 was opened, and run 'rondo-lap9-002' was closed completed."}
> SELECT count(*) FROM admission_refusal / proposal / human_decision / decision_consumption
0 / 0 / 0 / 0
```

**D-0069** (a scope before the first lap):

- **Section 1 (a), an agent type recorded from an operator's plan**: held. `agent_type_record` has
  one row, `recorded_by happy_ryo`, `recorded_at_ms` equal to `scope.created_at_ms`
  (1789315536719), so it was written in the scope row's transaction. The probe scope, which did not
  list the plan's digest, was refused and left no row, as #213's fix says.
- **The screen prints tier and grants from the held record**: held (`tier standard, granted
  command.run (held from a plan recorded for a scope)`), and `scope` printed the plan's digest. That
  digest could only be read by writing a payload with a dummy digest and letting it be refused
  (step 3a), which the note automates with `grep`.
- **Section 2 (i), `start --scope-decision-id` through `lineage_start`**: held. One `admission`
  consumption for `lap9-001`, `proposal_id null` (section 3 rule 3).
- **Section 3 rule 5, every open ask holds back an operator-written first admission**: not exercised.
  The thread held no `asks 1` message when `start` ran.

**D-0066** (the scope record):

- **One immutable row with a digest, approved by a row of its own**: held. `scope_decision` names
  the same `scope_digest`, and `human_decision` is empty.
- **Spent once per act inside the act's own transaction** (section 3): held.
  `scope_consumption.consumed_at_ms` equals `lap9-001.created_at_ms` to the millisecond.
- **Budgets**: 1 of 2 laps and 1.884267 of 5.00 USD were spent under the scope. The reserve, 2.50,
  was 0.615733 above `lap9-001`'s real cost. `lap9-002`'s lap and its 0.455749 USD are on no budget
  (N-33).
- **Section 4 (the refusal and the stop)**: not exercised. No scoped act was refused, so this lap did
  not show the new `scope` basis on a stop written by the running rondo. That basis is what
  `lap9-001` built, and it was tested in the lap's own suite.

**D-0065** (the model reviewer):

- **Graded findings with bases on the reading record**: held. The finding is `major` with three
  bases, and `basisResolved true`.
- **Rule 2.6, it runs after `drive()` returns and the gate does not wait**: held as decided. The
  deterministic reading and the gate report were written at 1789315827088 / 1789315827093; the
  model reading arrived **18.1 s later** (1789315845180). For `lap9-002` it was 8.4 s later. `start`
  and `revise` return only after the model reading, so the person saw it before they could answer,
  but they had to wait for it, and the thread's gate report, written first, says "clear with 0
  finding(s)" and is never followed by the model's finding (N-34).
- **Rules 4.1 to 4.3, a round budget and exit under a scope**: not walked. The round that fixed the
  finding was a `revise`, and rule 4.5 says outside a scope nothing is counted. Rule 5.3's "the
  organisation drafts a `revise` instruction that quotes the findings (O4)" was done by the person,
  in their own words.

**D-0061** (the request thread):

- **The request enters as an operator message**: held (`lap9-req-197`, `in_reply_to null`, `asks 0`).
- **Rule 4, an iteration names its request, and a redo inherits it**: held for `revise`.
  `lap9-002.request_message_id` is `lap9-req-197` though `revise` took no `--message-id`. That is
  #195 (lap 8's change, PR #208) working in the running rondo.
- **Reports to the request (rule 5.3)**: two gate reports and one publish report, all `in_reply_to
  lap9-req-197`. **The publish report now names the pull request URL**, so lap 8's N-32 does not
  recur.

## 6. Cost

| | value |
|---|---|
| `lap_cost_usd` `lap9-001` (in scope) | **1.884267** |
| `lap_cost_usd` `lap9-002` (`revise`, outside the scope) | **0.455749** |
| total lap cost | **2.340016** |
| scope cost spent (joined through `scope_consumption`) | **1.884267 of 5.00**, 1 of 2 laps |
| `cost_reserve_usd` vs the in-scope lap | reserve 2.50, **0.615733 above** |
| model reviewer cost | not read (D-0065 rule 3.4: a subscription login, not a priced tier) |

| | lap 2 | lap 3 | lap 4 | lap 5 | lap 6 | lap 7 | lap 8 | **lap 9 (001 / 002)** |
|---|---|---|---|---|---|---|---|---|
| `total_cost_usd` | 1.032 | 7.062 | 2.055 | 1.542 | 0.223 | 0.891 | 1.040 | **1.884 / 0.456** |
| turns | 29 | 95 | 43 | 38 | 8 | 18 | 23 | **46 / 12** |
| duration | 121.8 s | 724.4 s | 253.6 s | 203.3 s | 32.1 s | 94.8 s | 131.7 s | **233.9 s / 69.8 s** |
| fence refusals | 4 | 10 | 18 | 5 | 1 | 1 | 1 | **1 / 0** |
| lap committed its work | yes | yes | no | yes | yes | yes | yes | **yes / yes** |
| model reading taken | -- | -- | -- | -- | -- | -- | no (unavailable) | **yes / yes** |
| who typed the verbs | worker | worker | worker | worker | worker | worker | worker | **the person** |

## 7. New findings

### N-33. No redo inside a scope can carry review feedback, so a finding at or above the threshold always leaves the scope

The in-scope redo is `retry --iteration-id --successor-id --scope-decision-id`, and it admits the
predecessor's stored plan unchanged: no body, no finding. The redo that carries a person's (or a
reviewer's) words is `revise`, and `revise` takes no `--scope-decision-id`. So when the model review
raises a finding at or above the scope's threshold, which is exactly what `review_rounds` exists
for (D-0065 rules 4.1 to 4.3, 5.3), the only redo that can fix it is outside the scope. In lap 9 that
made the second lap's cost (0.455749 USD) and its round invisible to the scope the person approved
for them: `scope_consumption` shows 1 of 2 laps spent while two laps ran. D-0065 rule 5.3 has the
organisation draft "a `revise` instruction that quotes the findings", and no verb admits such a
revise under a scope. **This is the most important finding of the lap**, and it cost the person the
longest pause of the walk (section 2).

### N-34. The gate opens, and the thread says "clear", before the model review arrives

As D-0065 rule 2.6 decided, the model reading is taken after the gate is open. `start` prints *"the
gate is already open and does not wait for it"* and then blocks for the reading (18.1 s on
`lap9-001`), so a person at the terminal waits with an open gate they should not answer yet. The
thread's gate report is written before the reading, and for `lap9-001` it says *"Its independent
reading says 'clear' with 0 finding(s)"* while the model reading on the same tip raised a `major`
finding. No later message in the thread carries that finding. A person reading the request's
thread, rather than the terminal, sees a clear lap.

### N-35. A person cannot realistically run rondo from the terminal, and says a Web UI is required

The person finished the walk without a moment of thought ("考えたところはない") because every step
was a paste block from a note written for that purpose: ids carried in shell variables, extracted
from output with `grep` and `sed`, a deliberately refused probe to read a digest, and a table per
decision of what to look at. Their own judgment of the surface:

> TUIから人間が使うのは現実的じゃない、エージェントなら使いこなせそう・人間にはWebUIが必須
>
> (Using it from a TUI/CLI is not realistic for a human; an agent could probably handle it; a human
> needs a Web UI.)

The CLI worked as specified. What made it usable was the note, and the secretary answering
questions. D-0059 decided the page and its stack. This lap is evidence that for the person, the page
is the prerequisite for using rondo at all, not a later polish.

### N-36. The runbook's expected-file list for #197 missed `src/access/scope.ts`

The note's step 7 filters changed files against `src/advisory/proposal.ts`, `src/store/(sqlite|records).ts`,
`src/access/(advisory|cli|conductor).ts`, `test/` and `DECISIONS.md`. #197's point is the stop's
bases, and the stop is written by `stopTheLine` in `src/access/scope.ts`, so the list flagged the one
file the request most needed to change. The person had to judge it by the table's "explained by #197"
clause. The list came from runbook section 0, which names the basis-form files and not the stop's
writer.

### N-37. zsh's `correct` prompt interrupted every step

The person reported that zsh asked a spelling-correction question (`zsh: correct ... ?`) on every
step, about the log file names the blocks write. The prompts go to the terminal and not to the
`tee`d logs, so no log holds them. The note's own check ran its blocks extracted with `awk` through
zsh (its "作成時の確認結果"), and recorded no such prompt. A block the person pastes should not
depend on the shell's interactive options.

## 8. Compared with the current organisation

The person's own comparison is N-35's quote. Read with the rest of the walk:

| | rondo, lap 9 (the person at the terminal) | current organisation (secretary + worker) |
|---|---|---|
| person's decisions | 3: P1, `revise`, `approve` | not measured here |
| wall clock, step 1 to last answer | 16 min 11 s, of which the AI's laps 5 min 30 s and the person's own gaps 10 min 26 s | not measured here |
| money visible per change | yes: 1.884267 + 0.455749 USD on the rows | no per-task USD figure is recorded |
| independent review | deterministic + model reading on every lap, and the model finding was acted on | codex self-review on every `full` task |
| what the person had to think about | "考えたところはない": nothing, with a paste-block note and the secretary answering questions | not measured here |
| who drove it | **the person**, for the first time | the organisation |
| the person's verdict on the surface | "TUIから人間が使うのは現実的じゃない ... 人間にはWebUIが必須" | -- |

**This walk shows that the P1-first order works and that a person can drive rondo end to end
without the organisation typing for them. It does not show that this is less work for a human.**
The person needed a note written so that nothing required thought, and a secretary to answer
questions, and in their words the terminal is not a surface a human should use. The CLI suits an
agent. For the person, the next comparison needs the page (D-0059) and an in-scope way to act on a
review finding (N-33).

### Candidate issues

Drafted in English as candidate issue bodies. Filing is the secretary's.

1. **An in-scope revise: a redo under a scope that carries the gate's feedback** (N-33). *The only
   scope-spending redo, `rondo retry --iteration-id --successor-id --scope-decision-id`, re-admits the
   predecessor's stored plan with no body, so it cannot carry a review finding or a person's words.
   `rondo revise` carries them but takes no scope. In lap 9 (docs/operations/lap-9-dogfood.md) a
   `major` model finding on `lap9-001` could only be fixed by an unscoped `revise`; `lap9-002`'s lap
   and 0.455749 USD are on no budget and its round was not counted, although the scope had
   `laps 2` and `review_rounds 2` for exactly this. D-0065 rule 5.3 expects the organisation to draft
   a revise that quotes the findings. Proposal: `revise --scope-decision-id` (the `redo` arm, with the
   revise text as part of the act), or a retry that takes a body; decide what the verdict tests about
   the added text.*
2. **Human use needs the page: record lap 9's evidence against D-0059** (N-35). *In lap 9 the person
   ran every rondo verb themselves and completed the walk, but only with a paste-block note (ids in
   shell variables, extracted with grep/sed, a deliberately refused probe to read a digest) and a
   secretary answering questions. Their verdict: "TUIから人間が使うのは現実的じゃない、エージェントなら
   使いこなせそう・人間にはWebUIが必須" (a TUI/CLI is not realistic for a human; an agent could
   handle it; a human needs a Web UI). Proposal: treat the D-0059 page as the prerequisite for a
   person operating rondo (request, scope and P1, gate reading with both readings, revise, publish),
   and walk lap 10 on it.*
3. **The gate opens, and the thread reports "clear", before the model review arrives** (N-34). *In
   lap 9, `start` printed "the gate is already open and does not wait for it" and then blocked 18.1 s
   for the model reading, which raised a `major` finding. The thread's gate report, written first,
   says "Its independent reading says 'clear' with 0 finding(s)", and nothing in the thread carries
   the model finding. Proposal: report the model reading to the request's thread when it lands (or
   hold the gate report until it does), and say on the terminal that the answer should wait for it.
   D-0065 rule 2.6 keeps the gate from waiting; this is about what the person is shown.*
4. **Dogfood runbooks: paste blocks must not trip zsh's `correct` prompt** (N-37). *In lap 9 zsh asked
   a spelling-correction question on every step, about the log file names. The note's pre-run check
   extracted the blocks and ran them through zsh, and saw no prompt. Proposal: start the note with `unsetopt correct
   correct_all` (or write the blocks so they do not rely on interactive options), and check the
   blocks in an interactive zsh.*
5. **A runbook's expected-file list should come from the change's call sites, not from the issue's
   list** (N-36, low priority). *Lap 9's step 7 filter for #197 omitted `src/access/scope.ts`, where
   the stop's bases are written, and flagged it as outside. Proposal: derive the list by grepping the
   code paths the issue names (here `stopTheLine`), or present the check as "files to explain" rather
   than a pass/fail filter.*

## 9. Verification discipline

- This document changes no source file. Its numbers come from the logs and rows named at the top;
  the store was opened `readOnly` and not written.
- `npm run verify` on this branch (at `6879d2f` plus this document) with `RONDO_CONTINUO_CLI` set
  to the pinned build: `EXIT=0`, **1171 passed, 5 skipped, 46 files passed and 1 skipped**. That is
  the preparation run's count (runbook section 7). The lap's own branches report 1172 and 1174: the
  lap's commits are in PR #215, not on this branch.

## 10. What is left where it is

- continuo run `rondo-lap9-002` is closed `completed` by `publish` (`report-published-lap9-002`).
  `lap9-001` was not published on its own; its commit `90bbe52` is in #215 through `lap9-002`'s
  branch. The state of its continuo run was not read for this record.
- PR #215 is merged, and #197 is closed.
- The scope `scope-1789315536719` stays approved with 1 lap and 1.884267 USD spent until it expires
  at 1789337136642.
- The environment root `/tmp/claude-1000/rondo-dogfood-lap-9-env` is left in place. Removing it is
  the person's.
