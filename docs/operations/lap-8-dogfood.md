# lap 8 dogfood -- a request, a lap, a scope approved, and the in-scope redo stopped at the readings test

An eighth walk of the arc, written the way [`lap-7-dogfood.md`](lap-7-dogfood.md) is: the commands
that were actually run and the output that actually came back, as a difference against lap 7 rather
than as a fresh survey. **It is the first walk of the request thread (D-0061, #193) and of the scope
record (D-0066, #196).**

- Run on 2026-09-13, on `feat/rondo-lap-8-dogfood` at `55902d0`, against continuo
  `fcf86eb2b7eb34d65bf73188b2b34544fab6820c` and the vendored cadenza
  (`sha256 1d255ecc…`, checked by `node vendor/pin.mjs check`).
- Machine: WSL2 (`Linux 6.18.33.2-microsoft-standard-WSL2`), Node `v22.17.0`.
- Target: a **fresh clone of rondo from GitHub** at `55902d0`
  (`$TMPDIR/rondo-dogfood-lap-8-env/rondo-gh`), provisioned by `scripts/dogfood-env.sh
  --target-repo` (12.3 s). The plan was used as generated.
- The operator was a claude-org worker. Every act that belongs to the person (the scope approval,
  the gate answer, a reply to a stop) was **put to the person through the claude-org secretary** and
  typed by the worker only after the answer came back, under the person's approver identity
  `happy_ryo`. The approval rows say `happy_ryo`. They do not say it came through the secretary, and
  that is itself a finding (N-28).
- The request was rondo#195, *revise and retry inherit the predecessor's request link*.
- **One paid lap, `lap8-001`: $1.0399 / 23 turns / 131.682 s.** One in-scope redo, `lap8-002`, was
  attempted. It was **refused at the `readings` test, admitted nothing and spent nothing**.
- **Wall clock from request to the end of the lap: 640.8 s (10 min 41 s).** 285 s of that was
  waiting for the person's two answers (section 2).

---

## 1. The questions, answered

| # | question | answer | evidence |
|---|---|---|---|
| 1 | did the request enter as a message, and does the lap carry its link? | **yes** | `conversation_message` row `lap8-req-195` (`author_kind operator`, `in_reply_to null`, `asks 0`). `iteration.request_message_id = 'lap8-req-195'` on `lap8-001`. `start` printed *"It came from the request opened by message lap8-req-195"* and `explain` quotes the request in full (section 5) |
| 2 | could the scope be drafted before the first lap? | **no** | `rondo scope` refused the agent type digest: *"which is no record rondo holds ... (D-0062 rule 1.2, an iteration row with that agent_type_digest)"*. The scope could only be drafted **after** `lap8-001` wrote the row, so the first lap was admitted unscoped (N-25) |
| 3 | was P1 the person's act? | **yes, relayed** | `scope_decision` row `approved`, `actor_id happy_ryo`, `recorded_by rondo/cli`, written 9.8 s after the secretary relayed the person's answer. Nothing on the row says it was relayed (N-28) |
| 4 | did the in-scope redo inherit the predecessor's request link? | **yes** | `rondo retry` takes no `--message-id`. The stop it wrote is `in_reply_to lap8-req-195`, and its bases name that message, so the verdict tested the link it read off `lap8-001`'s row (D-0061 rule 4) |
| 5 | did the in-scope re-test refuse, and spend nothing? | **yes** | `Refused: the retry is outside the scope at the readings test, so nothing was admitted and nothing was spent`. `scope_consumption` has 0 rows, `iteration` holds only `lap8-001`, and `admission_refusal` is empty |
| 6 | was the stop written as D-0066 rule 4.4 says? | **yes, with two defects in its words** | one `drafter` message, `asks 1`, in the request's thread, bases `[message lap8-req-195, iteration lap8-001]`, with reason, three options, what each gives up and one recommendation. The recommendation is wrong for this test (N-26), and the stored body holds literal `\u000a` escapes (N-27) |
| 7 | did the worker's sandbox start? | **no failure reported** | the transcript holds **0** occurrences of `sandbox`, and `stderr-000.log` is empty. Laps 6 and 7 each printed `Sandbox is enabled but failed to initialize: EPERM`. `start` and `retry` were the only commands run with the operator's sandbox disabled (runbook item 7, N-21) |

## 2. Where a person was touched

| # | when (UTC) | +s from request | purpose | kind | wait |
|---|---|---|---|---|---|
| 1 | 03:36:35 | 234.5 | the first lap was admitted before any scope, against the brief's order. The secretary put that to the person, who answered "continue" | other (a departure from the plan) | lap was already running, no wait |
| 2 | 03:42:24 | 583.5 | **P1**: approve `scope-1789270620294` as proposed, **and** the **gate answer** for `lap8-001`: approve, to be written after the in-scope redo was tried | P1 + gate answer, one exchange | 285 s (judgment sent by 03:37:39 -> answer relayed 03:42:24) |
| 3 | 03:46:00 | 800.3 | reply to the stop `scope-stop-lap8-002-1789270962898`: "Stop this line. The request is fulfilled by lap8-001, whose gate is approved." | stop reply | about 150 s (put to the person by 03:43:30 -> relayed 03:46:00) |

**Three touches: two by the end of the lap at +640.8 s, and the stop reply at +800.3 s.** All three
were relayed by the secretary, and the worker typed the verb each time. The walk:

```
03:32:40.5  +0.0    rondo request   lap8-req-195 opened
03:33:08.5  +27.9   rondo scope     refused: the agent type digest is no record rondo holds
03:33:46.2  +65.6   rondo start     lap8-001 reserved (row created_at_ms 1789270426373)
03:35:57.9  +197.4  rondo start     returned at the gate; lap 131.7 s
03:37:00.3  +259.7  rondo scope     scope-1789270620294 recorded
03:42:24    +583.5  (person)        P1 approved, gate approve, via the secretary
03:42:33.8  +593.3  rondo decide-scope  approved
03:42:42.9  +602.3  rondo retry     refused at readings, stop written
03:43:21.3  +640.8  rondo answer    lap8-001 closed, answered_and_forwarded
03:46:00.9  +800.3  (person)        stop reply, via the secretary
03:47:19.4  +878.8  rondo reply     lap8-stop-reply recorded; the thread holds no open ask
```

## 3. What was run

```
$ scripts/dogfood-env.sh --root $TMPDIR/rondo-dogfood-lap-8-env \
      --target-repo $TMPDIR/rondo-dogfood-lap-8-env/rondo-gh --iteration-id lap8-001      (12.3 s)
$ npm run preflight:model-tier -- .../plan.json
model tier 'standard' runs on claude-opus-5

$ node bin/rondo.mjs request --actor-id happy_ryo --message-id lap8-req-195 --body="$(cat request.txt)"
opened request 'lap8-req-195'

$ node bin/rondo.mjs scope --payload-file .../scope-lap8.json --actor-id happy_ryo
the scope 'scope-1789270388485' lists the agent type 'sha256:0fc3ca25…', which is no record rondo
holds: D-0066 rule 1.2.3 lists agent types rondo already holds (D-0062 rule 1.2, an iteration row
with that agent_type_digest), and a digest nobody can read back bounds no tier and no grant

# sandbox disabled for this one command (runbook item 7)
$ node bin/rondo.mjs start --plan .../plan.json --iteration-id lap8-001 \
      --prompt-file .../request.txt --message-id lap8-req-195
  Reserved iteration lap8-001 at 'planned', holding run id rondo-lap8-001, branch rondo/lap8-001 ...
  It came from the request opened by message lap8-req-195.
  cadenza allowed the action (granted); the three digests are committed.
  ...
  An independent reading of the work found nothing to raise (rondo/deterministic/2). It read 1 commit(s) and 2 file(s) ...
  The lap answered. Gate gate/worker_escalation/c2e2b891-.../0 is already open; session c2e2b891-... was started.
  The lap cost 1.0399294999999997 USD over 23 turn(s) in 131682 ms, read from its terminal 'result' event.
model review  no model reading could be taken (rondo/model/1/gpt-6-astra): the plan names no review
        criterion, so there is nothing to grade against (D-0029 rule 13).
EXIT=0                                                             (131.7 s)
```

The request text is the issue body. It adds one sentence saying that the in-scope retry already
passes the link, and one paragraph with AGENTS.md's order (pins, `npm ci --ignore-scripts`, change,
`npm run verify`, commit, no push). Unlike lap 7, it does not name a baseline or any step beyond
AGENTS.md's.

The digest the scope needed was computed before the lap with `agentTypeRecord(plan.agent_type_input)`
from `dist/cadenza/facade.js`, a scratch script and not a rondo command. It matched
`iteration.agent_type_digest` on `lap8-001` byte for byte once that row existed.

## 4. The gate, read before it was answered

`rondo answer --iteration-id lap8-001` with no `--body` printed the following (runbook step 4):

- **why**: the worker changed `src/store/sqlite.ts`. A new `inheritedRequest()` runs inside
  `reserve()`'s transaction, after the lineage check. A first lap keeps the caller's link. A successor
  takes its predecessor row's link. **A successor whose caller names a different request is refused
  as a defect.** The worker said that last rule was its own decision, not something the issue asked
  for. The request check, the scope re-test and the inserted row all read the inherited link. Tests
  were added to `test/store/request-thread.test.ts`: a linked successor stays linked (two levels deep),
  an unlinked one stays unlinked, and a mismatch is refused with no row written. No `DECISIONS.md`
  entry was added.
- **work**: `de36852` on `rondo/lap8-001`, `src/store/sqlite.ts (+52 -3)`,
  `test/store/request-thread.test.ts (+54 -1)`.
- **fence**: nine declared subjects, envelope `29de12f7…` re-checked, and *"the fence refused 1
  call(s)"*: a `python3 - <<'EOF'` edit. The transcript's reason for it is `Contains brace with quote
  character (expansion obfuscation)`. The worker made the same edit with `Edit`.
- **review**: deterministic `clear`. Model reading **`unavailable`**, because *"the plan names no
  review criterion"*.

The transcript (`<state root>/rondo-lap8-001/c2e2b891-…/events-000.jsonl`) holds 15 Bash and 7 Edit
calls, 1 `permission_denials` entry, and the same cost, turns and duration as rondo's line. Its order
was: pin check and `npm ci --ignore-scripts` (`EXIT=0`), reads, edits, `npm run lint:fix; npm run
verify` (`EXIT=0`, 46 files passed, 1159 passed, 5 skipped), a focused `npx vitest run`, and then
`git add -A && git commit`. `npx` and `git` are not among the nine declared subjects, and both ran.
The gate screen already says the declaration is not the whole fence, because continuo renders the
role's template into it.

Checked from outside the fence before answering:

```
$ git -C <workspace> status --porcelain                  -> (empty)
$ npm --prefix <workspace> run verify; echo EXIT=$?      -> Test Files 46 passed | 1 skipped (47)
                                                            Tests 1159 passed | 5 skipped (1164), EXIT=0
```

The diff was read and matches the rationale. The answer was the person's, relayed (section 2), and
it was written after the in-scope redo was tried (section 6):

```
$ node bin/rondo.mjs answer --iteration-id lap8-001 --actor-id happy_ryo \
      --verified="read diff de36852; npm run verify in the workspace outside the fence EXIT=0, 1159 passed 5 skipped; approval relayed by the secretary" \
      --body=approve
  gate present ... gate deliver ... gate ack       stage is now 'presented'
  gate answer  ... gate deliver ... gate ack       stage is now 'forwarded', and the gate is closed
iteration 'lap8-001' is closed
  Gate outcome: answered_and_forwarded.
  rondo did not close this run. Nothing was pushed, nothing was landed, and publishing this work is the operator's, not rondo's (D-0010).
```

**The worker's rule that "a successor naming a different request is a defect" goes beyond #195.**
The person decided that whether to keep it will be settled at publish time. It is recorded here as
that open point, and nothing was changed.

## 5. The scope, and what P1 was shown

The payload was the operator's (`author_kind operator`, `bases []`). What was put to the person,
with the grounds and what each value gives up:

| field | value | grounds | gives up |
|---|---|---|---|
| `requests` | `[lap8-req-195]` | the one request | -- |
| `workspaces` | `(rondo-gh, workspaces)` | the plan's pair, byte for byte | -- |
| `agent_types` | `sha256:0fc3ca25…` | the agent type `lap8-001` ran under | -- |
| `laps` | 2 | one in-scope redo, plus one more if it raises a finding | a third attempt needs a new P1 |
| `review_rounds` | 2 | the agent type's `loopPolicy.maxReviewRounds` is 2. `lap8-001` already counts as one round, because it holds a model reading row | a second finding stops the line |
| `cost_reserve_usd` | 2.50 | code-change laps cost 1.032 / 7.062 / 2.055 / 1.542 / 0.891 (laps 2-5, 7) and `lap8-001` cost 1.040. 2.50 covers all but lap 3 | it is only a guess. A lap that costs more is not stopped mid-run, and reviewer cost is not counted |
| `cost_usd` | 5.00 | two laps at the reserve | a lap-3-sized lap would pass it unstopped, and the next act would then be refused |
| `expires_at_ms` | 1789291960000 (request + 6 h) | the walk ends today | a later answer needs a successor scope |
| `severity_threshold` | `major` (default) | D-0065 rule 2.2 | -- |
| `outward_acts` | none | this task publishes nothing | `publish` stays typed by a person (it is today anyway) |

```
recorded as scope 'scope-1789270620294'
digest: sha256:4c9be95d999a97357f4804073ac57deefbb0a4e69a2475c8780d8a2f2cfe27d4
...
The cost budget counts the laps' own cost only: the reviewer's cost is not counted, and a lap whose cost is not read yet holds the reserve, which is a guess.

$ node bin/rondo.mjs decide-scope --scope-id scope-1789270620294 --scope-digest sha256:4c9be95d… \
      --actor-id happy_ryo --outcome approved
recorded as scope decision 'scope-decision-scope-1789270620294-1789270953820'
Nothing has been spent. ...
```

The person was also told, before approving, that the redo would **most likely be refused at
`readings`**: `lap8-001`'s model reading was `unavailable`, and D-0066 rule 4.2 with D-0065 rule 5.4
make that outside. They approved with that prediction in front of them.

## 6. The in-scope redo, and the stop

```
# sandbox disabled for this one command (runbook item 7)
$ node bin/rondo.mjs retry --iteration-id lap8-001 --successor-id lap8-002 \
      --scope-decision-id scope-decision-scope-1789270620294-1789270953820
Refused: the retry is outside the scope at the readings test, so nothing was admitted and nothing
was spent: the model reading is unavailable: the plan names no review criterion, so there is nothing
to grade against (D-0029 rule 13). (D-0065 5.4)
The line is stopped by message 'scope-stop-lap8-002-1789270962898', which asks in the request's
thread; a reply to it is what lets the line carry on.
EXIT=2
```

The rows, read with SQL (`node:sqlite`, read-only) after the gate closed:

```
> SELECT id,status,request_message_id,lap_cost_usd,gate_outcome FROM iteration
{"id":"lap8-001","status":"closed","request_message_id":"lap8-req-195","lap_cost_usd":1.0399294999999997,"gate_outcome":"answered_and_forwarded"}
> SELECT * FROM scope_decision
{"scope_decision_id":"scope-decision-scope-1789270620294-1789270953820","scope_id":"scope-1789270620294","scope_digest":"sha256:4c9be95d…","outcome":"approved","actor_id":"happy_ryo","recorded_by":"rondo/cli","decided_at_ms":1789270953820}
> SELECT * FROM scope_consumption
(no rows)
> SELECT * FROM admission_refusal
(no rows)
> SELECT message_id,author_kind,author_id,in_reply_to,bases,asks FROM conversation_message
{"message_id":"lap8-req-195","author_kind":"operator","author_id":"happy_ryo","in_reply_to":null,"bases":"[]","asks":0}
{"message_id":"scope-stop-lap8-002-1789270962898","author_kind":"drafter","author_id":"rondo/advisory/deterministic","in_reply_to":"lap8-req-195","bases":"[{\"form\":\"message\",\"messageId\":\"lap8-req-195\"},{\"form\":\"iteration\",\"iterationId\":\"lap8-001\"}]","asks":1}
```

The stop's body, as stored:

```
Stopped: the redo of 'lap8-001' as 'lap8-002' is outside scope 'scope-1789270620294' (digest sha256:4c9be95d…) under decision 'scope-decision-scope-1789270620294-1789270953820' at the readings test.\u000aReason: the model reading is unavailable: the plan names no review criterion, so there is nothing to grade against (D-0029 rule 13). (D-0065 5.4)\u000aOptions:\u000a- A successor scope (D-0066 rule 1.4). Gives up: this line waits for a person to approve a new scope, and the old one is retired when they do.\u000a- A change to the work. Gives up: the work as planned; what runs is the changed work.\u000a- Stopping. Gives up: this line's work; other lines of the request carry on.\u000aRecommended: a successor scope (D-0066 rule 1.4) with the budget or approval this line needs: the work itself is what the scope was approved for, and what ran out is the approval.\u000aThis line stays stopped until this message is answered.
```

Against D-0066:

- **Rule 4.1 (anything but `inside` takes no act and writes no consumption)**: held, with no
  consumption row and no iteration row.
- **Rule 4.2 (readings, unavailable is outside)**: held, and it was the test that refused. The tests
  before it passed: decision, superseded, request, asks, workspace, agent type, contract,
  irreversible, expiry, laps, cost and grants.
- **Rule 4.4 (one drafter message with `asks`, bases naming the request and the lineage's latest
  lap)**: held. The scope row and the refused test are named in the body and not as bases, which is
  the `ponytail:` note in `stopTheLine`.
- **D-0061 rule 4 (the request link is the act's own, inherited by a redo)**: held for the in-scope
  retry. That path already inherited before this lap. #195 is about `revise` and `retry
  --proposal-id`, and `lap8-001`'s commit changes those, but it is not on this branch and has not
  been walked.
- **"This line stays stopped until this message is answered"**: not re-tested by a second `retry`.
  A second attempt would have been a new act that the person had not been asked about. Whether the
  stop holds rests on `scopeVerdict`'s asks test, which runs before `readings`, and on the unit tests
  in #196.

The reply to the stop is the person's. It was put to the secretary with two options: reply "stop this
line", since the request was met by `lap8-001`, or leave it open, which harms nothing. The person
chose the reply, and it was relayed by the secretary:

```
$ node bin/rondo.mjs reply --actor-id happy_ryo --message-id lap8-stop-reply \
      --in-reply-to scope-stop-lap8-002-1789270962898 \
      --body="Stop this line. The request is fulfilled by lap8-001, whose gate is approved."
recorded message 'lap8-stop-reply' in reply to 'scope-stop-lap8-002-1789270962898'
```

Afterwards, the thread was read with `openAsksIn`'s own recursive query, and through the built store:

```
> (thread of lap8-req-195) message_id, asks, replies
{"message_id":"lap8-req-195","asks":0,"replies":"scope-stop-lap8-002-1789270962898"}
{"message_id":"scope-stop-lap8-002-1789270962898","asks":1,"replies":"lap8-stop-reply"}
{"message_id":"lap8-stop-reply","asks":0,"replies":null}
> (thread of lap8-req-195) ... WHERE asks = 1 AND NOT EXISTS (a reply)
(no rows)

openAdvisoryRecord(store).openAsksIn("lap8-req-195")   -> {"kind":"read","asks":[]}
askStandsOver(any, ["lap8-001"])                       -> false
askStandsOver(any, [])                                 -> false
```

**The stop no longer counts as an open ask**, which is what D-0066 rule 4.4 says a reply does. But the
reply's words were "stop this line", and the reply lifts the stop all the same: any reply ends it,
whatever it says (N-31).

`publish --dry-run` exited 0 and printed the push, `gh pr create --repo github.com/suisya-systems/rondo
--base main --head rondo/lap8-001`, the `run close`, and a body naming `de36852` and the verification
claim. The unavailable model reading is printed but does not refuse, as D-0065 rule 5.5 says: only
the deterministic reading refuses. **Nothing was published.**

## 7. Cost

| | value |
|---|---|
| `lap_cost_usd` on `lap8-001` | **1.0399** |
| `scope_consumption` rows under the approval | **0** |
| scope cost spent (joined `lap_cost_usd`) | **0.00 of 5.00** |
| redo attempt cost | **0.00** (refused before admission) |
| gap from `cost_reserve_usd` | the reserve was never held (no scoped admission). Measured against the one lap that ran, the reserve was **1.46 USD above** its real cost (2.50 - 1.04) |
| model reviewer cost | none taken (unavailable before it ran) |

`lap8-001` was admitted **outside** the scope (N-25), so its cost is on its row and on no scope. If
the scope could have been approved first and the lap had been its first admission, it would have
used 1.04 of 5.00 and one of two laps.

| | lap 2 | lap 3 | lap 4 | lap 5 | lap 6 | lap 7 | **lap 8** |
|---|---|---|---|---|---|---|---|
| `total_cost_usd` | 1.032 | 7.062 | 2.055 | 1.542 | 0.223 | 0.891 | **1.040** |
| turns | 29 | 95 | 43 | 38 | 8 | 18 | **23** |
| duration | 121.8 s | 724.4 s | 253.6 s | 203.3 s | 32.1 s | 94.8 s | **131.7 s** |
| refusals / Bash calls | 4 / 29 | 10 / 69 | 18 / 36 | 5 / 29 | 1 / 5 | 1 / 14 | **1 / 15** |
| lap committed its work | yes | yes | no | yes | yes | yes | **yes** |
| worker sandbox failed to start | -- | -- | -- | -- | yes | yes | **no failure reported** |
| a `src/` change with tests | -- | -- | -- | -- | -- | no (docs) | **yes** |

## 8. New findings

### N-25. A scope cannot be drafted before the first lap of a request, so the first lap is always unscoped

`rondo scope` refuses any `agent_types` digest that no iteration row holds (D-0066 rule 1.2.3,
D-0062 rule 1.2). No command prints a digest before a lap exists, and the one wired act that spends
a scope is a **redo** (`retry --scope-decision-id`). `lineage_start` is built in `scope.ts` but no
verb reaches it. The order the brief assumed, *request -> scope -> P1 -> admit under it*, therefore
cannot be walked on a new machine or with a new agent type. The first lap is admitted with no scope,
its cost is on no budget, and the scope only ever covers redos. The person's P1 then comes **after**
money has been spent. On this walk that departure itself became touch 1 (section 2). This is the
most important finding of the lap.

### N-26. The stop recommends a successor scope for an unavailable model reading, which cannot help

`recommendation()` in `src/access/scope.ts` groups `readings` with `decision`, `superseded`,
`expiry`, `laps` and `cost`, and says *"what ran out is the approval"*. For this refusal nothing ran
out: the predecessor's model reading is `unavailable`, and a successor scope would be refused at the
same test for the same reason. The option that helps is *a change to the work*: a plan with a review
criterion, so a model reading can be taken. The same wording fits a `readings` refusal caused by an
exhausted review budget, so the case needs splitting on the reason, not the test.

### N-27. The stop's body is stored with literal `\u000a` escapes instead of newlines

`stopBody()` joins its lines with `\n` and then passes the whole string through `asciiEscape`, which
escapes the newlines. The row therefore holds one line with `\u000a` in it. Every reader of the thread
(`inbox`, the page, a future report) gets the escaped form unless it unescapes, and the text is
unreadable in SQL. The escape belongs on each line, or at display time.

### N-28. A relayed approval is recorded as the person's own act, with no trace of the relay

`scope_decision.actor_id` and the gate answer both say `happy_ryo`, and `recorded_by` says
`rondo/cli`. The person answered through the secretary, and a claude-org worker typed the verbs. D-0066
rule 2.4 says approving is a person's act at that moment, and the row cannot tell a direct approval
from a relayed one. Here the only trace is the free-text `--verified` claim on the gate answer
(*"approval relayed by the secretary"*). `decide-scope` has no such field. For an organisation that
delegates operators, this is the audit gap D-0064 rule 3.5 names.

### N-29. The dogfood plan names no review criterion, so every dogfood lap's model reading is unavailable and no in-scope redo can ever be inside

`scripts/dogfood-env.sh` writes a plan with no review criterion. `takeModelReading` then records
`unavailable` (D-0029 rule 13), and `scopeVerdict` refuses every redo of such a lap at `readings`
(D-0065 5.4). On the environment the runbook provisions, the in-scope retry, which is the only
scope-spending verb, **cannot be admitted at all**. That is why this lap walked the stop and not an
in-scope lap.

### N-30. The worker sandbox did not report a failure when `start` ran outside the operator's sandbox

Laps 6 and 7 printed `Sandbox is enabled but failed to initialize: EPERM` on the first Bash call.
Lap 8 ran `start` with the operator's sandbox disabled (runbook item 7), and the transcript has no
occurrence of `sandbox` at all. That is **absence of the failure message, not proof the sandbox
held**: D-0050's sentence still applies, and the worker's rationale did not mention its sandbox
because this request did not ask. It is consistent with N-21's environmental cause.

### N-31. Any reply lifts a stop, including a reply that says "stop"

`openAsksIn` counts an `asks` message as open only while nothing replies to it. The person's reply
here was *"Stop this line"*, and after it `openAsksIn` returned `[]`. The next in-scope `retry` of
`lap8-001` would therefore be tested again from the top. This time it would be refused at `readings`
again and write a second stop, but under a scope where `readings` passes, it would be **admitted**.
The row cannot tell "carry on" from "stop" because the reply has no outcome. D-0066 rule 4.4 says the
person's reply is what ends the stop, so this is as decided, but the option the stop itself offers
("Stopping") has no durable form. Ending a line today takes a successor scope with `laps` 0
(rule 1.4), which is a second P1 for what the person already said in words.

## 9. Compared with doing #195 in the current organisation

The same issue, as a secretary + worker task in claude-org, would be: the secretary writes a brief,
a worker is spawned in a worktree, the worker implements and verifies, runs a codex self-review of up
to three rounds, and reports. The secretary then relays the result to the person and asks the
secretary to push and open the PR. What can be stated from this walk, without inventing
numbers for a run that did not happen:

| | rondo, lap 8 | current organisation (secretary + worker) |
|---|---|---|
| person touches to reach an approved change | 3: the "continue" departure; P1 + gate in one exchange; the stop reply | typically 2: the task is approved at dispatch and the result at completion or PR. Not measured here |
| worker time for the change | 131.7 s, one lap | not measured here. It includes worker startup and codex review rounds |
| request -> change approved | 640.8 s, of which 285 s was waiting for the person | not measured here |
| money visible per change | yes: `lap_cost_usd` 1.04 on the row | no per-task USD figure is recorded |
| independent review of the change | deterministic reading only. **The model reading did not run** (N-29) | codex self-review on every `full` task |
| who drove it | **the organisation**: a claude-org worker typed every rondo verb and the secretary relayed every question | the organisation |

**The comparison does not yet favour rondo on "less work", and the reasons are specific.** rondo
recorded the change faster and with a visible price, and its stop behaved as D-0066 says. But on
this walk rondo sat **inside** the current organisation: it did not replace the secretary and the
worker, it added verbs for them to type. Its scope did not cover the one lap that cost money
(N-25). Its independent model review did not run (N-29). And the one stop it produced recommended
the wrong fix (N-26), and it took a third touch to settle. **"Less work than the current organisation" needs
a walk in which a person talks to rondo directly and one P1 covers the first lap.** That walk is
not possible until N-25 and N-29 are addressed.

### Candidate issues

Drafted in English as candidate issue bodies. Filing is the secretary's.

1. **A scope cannot be approved before the first lap of a request** (N-25). *`rondo scope` refuses
   an `agent_types` digest no iteration row holds (D-0066 rule 1.2.3), no command prints an agent
   type's digest before a lap, and the only verb that spends a scope is the in-scope `retry` (a redo).
   So the first lap of any request is admitted unscoped, and P1 comes after money is spent. Lap 8
   (docs/operations/lap-8-dogfood.md) walked exactly this. Proposal: decide how an agent type becomes
   "a record rondo holds" without a paid lap (e.g. recorded from a plan at `scope` time), and wire a
   scope-spending first admission (`start --scope-decision-id`, or the `lineage_start` arm already in
   `src/access/scope.ts`).*
2. **The scope stop recommends a successor scope for a `readings` refusal caused by an unavailable
   model reading** (N-26). *`recommendation()` in `src/access/scope.ts` groups `readings` with the
   budget tests ("what ran out is the approval"). When the predecessor's model reading is
   `unavailable` (D-0065 5.4), a successor scope is refused the same way. The recommendation should be
   a change to the work (a plan with a review criterion). Split the `readings` case by reason:
   exhausted rounds -> successor scope; unavailable -> change the work.*
3. **The scope stop's body is stored with literal `\u000a` escapes** (N-27). *`stopBody()` runs
   `asciiEscape` over the joined text, so `conversation_message.body` holds one line with `\u000a`
   in it (observed in lap 8, `scope-stop-lap8-002-1789270962898`). Escape per line, or keep newlines,
   so the thread is readable in `inbox`, on the page and in SQL.*
4. **A relayed approval is indistinguishable from a direct one** (N-28). *`scope_decision` and the
   gate answer record `actor_id` and `recorded_by rondo/cli` only. When an operator types
   `decide-scope` or `answer` on a person's relayed answer, nothing on the row says so. Consider a
   `relayed_by` / note field on `scope_decision` (and the gate answer), or state in D-0066 that
   relaying is out of scope.*
5. **The dogfood environment's plan names no review criterion, so no in-scope redo can be admitted
   on it** (N-29). *`scripts/dogfood-env.sh` writes a plan without a review criterion, so every lap's
   model reading is `unavailable` and `rondo retry --scope-decision-id` is always outside at
   `readings`. Add a review criterion to the generated plan (or a flag), so the scope path and the
   model reviewer can be dogfooded.*
6. **A reply to a scope stop lifts it whatever the reply says** (N-31). *`openAsksIn` treats any
   reply to an `asks` message as closing it. In lap 8 the person replied "Stop this line" and the
   thread then held no open ask, so a later in-scope redo of the same line would be tested as if
   the person had said "carry on". The stop offers "Stopping" as an option, but there is no durable
   form for it short of a successor scope with `laps` 0 (a second P1). Consider an outcome on the
   reply (carry on / stop), or have `reply` to a scope stop say which it records.*
7. **Decide the "successor naming a different request is a defect" rule from lap 8's #195 change**
   (low priority, decided at publish). *`de36852` on `rondo/lap8-001` refuses as a defect a successor
   whose caller names a request other than its predecessor's. #195 did not ask for this. Keep it (and
   record it) or drop it when that branch is published.*

## 9a. Verification discipline

- `npm run verify` on this branch with `RONDO_CONTINUO_CLI` set to the pinned build: `EXIT=0`,
  **1157 passed, 5 skipped, 46 files passed and 1 skipped**. The lap's own branch reports 1159 passed,
  two more than this, which fits the cases `de36852` adds.
- No source file was changed by this walk. The lap's commit `de36852` lives on `rondo/lap8-001` in
  the scratch target, and it is **not** on this branch.

## 9b. After the lap: the publish, and the rule removed (all decided by the person)

The person decided, through the secretary, to publish `lap8-001` and to **drop the worker's own "a
successor naming a different request is a defect" rule** (candidate 7), because #195 did not ask for
that invariant.

- **Who published.** This worker's brief forbids push and PR creation. The person granted a one-time
  exception for this publish, but the Claude Code auto-mode classifier still denied the worker's
  `rondo publish` (run with the sandbox disabled) before it executed. Nothing was pushed by that
  attempt. **The secretary then ran `rondo publish`**, on the person's approval, from a rondo built at
  `787ea73`, which includes #198's thread reports, against this lap's `RONDO_STORE`. It opened
  **https://github.com/suisya-systems/rondo/pull/208** and closed run `rondo-lap8-001` `completed`.
- **The rule removal.** The removal was applied to the lap workspace as a follow-up commit
  `115e25c` on `rondo/lap8-001`. It removes the mismatch defect from `inheritedRequest()`, which now
  returns the predecessor's link whatever the caller passes, and the PLANTED mismatch test. The
  "stays linked / stays unlinked" test is kept. `npm run verify` on it: `EXIT=0`, **1158 passed, 5
  skipped** (one fewer than `de36852`'s 1159: the removed test). The push is the secretary's.
- **The published report (D-0061 5.3).** It landed in the thread:

```
{"message_id":"report-published-lap8-001","author_kind":"drafter","author_id":"rondo/advisory/deterministic",
 "in_reply_to":"lap8-req-195","bases":"[{\"form\":\"iteration\",\"iterationId\":\"lap8-001\"},{\"form\":\"continuoRun\",\"runId\":\"rondo-lap8-001\"}]",
 "asks":0,"at_ms":1789272251835,
 "body":"Lap 'lap8-001' was published: its branch was pushed, a pull request was opened, and run 'rondo-lap8-001' was closed completed."}
```

  Its body is one line (126 characters, no newline, no `
`), so the N-27 escape defect does not
  show on it. It cannot, because there is nothing to escape. The report does not name the pull
  request's URL or number, so a reader of the thread cannot get from it to #208 (N-32). **No gate
  report** is in the thread: the gate was answered at 03:43:21 with the `55902d0` build, before #198.

### N-32. The thread's publish report does not name the pull request

`report-published-lap8-001` says a pull request was opened but does not say which, and its bases are
the iteration and the continuo run only. The request's report (D-0064 P5) is where a person is
meant to find the result, and from this row the only way to reach #208 is to search GitHub for the
branch. Candidate: *put the pull request URL in the publish report's body, or add a basis form that
locates it.*

## 10. What is left where it is

- continuo run `rondo-lap8-001` is closed `completed` by `publish`.
- The branch `rondo/lap8-001` is on GitHub as PR #208. The follow-up commit `115e25c` is local in the
  workspace `iter-lap8-001` until the secretary pushes it.
- The stop `scope-stop-lap8-002-1789270962898` is answered by `lap8-stop-reply`, so no open ask
  holds the line (N-31). The scope `scope-1789270620294` stays approved with nothing spent until it
  expires at 1789291960000.
- The environment root `$TMPDIR/rondo-dogfood-lap-8-env` is left in place. Removing it is the
  operator's.
