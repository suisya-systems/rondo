# lap 12 dogfood -- the page said what happened, and one line on it still read as the opposite

The twelfth walk of the arc, and the second one that asks whether **rondo is done for now**, judged
against the completion definition (`D-0075`, K3 as `D-0080` redraws it). This lap was set up by
[`lap-12-runbook.md`](lap-12-runbook.md). The answer is **no** again, and the reason is narrower
than lap 11's.

**K1, K2 and K3 are met. K4 is not.** The owner asked what one line on the gate meant: the
reading's *「ビルドもテストも、何かの実行もしていません。」* ("It built nothing, tested nothing and ran
nothing."). The owner took it to mean that the tests had not been run. The worker had in fact run
the repository's verification, and it had passed. The screen shows what rondo's reading says about
itself, and it does not show the worker's result. Every question lap 11 asked was answered by the
screen this time, and 「取り込み」 did not appear before the merge.

- Walked on 2026-09-22, about 11:51 to 12:52 JST, by the owner (`happy_ryo`) on the Japanese page.
  The claude-org secretary stood beside the walk and took the notes this record starts from. The
  secretary also **stepped in once**, after the pull request was open (section 4, *The conflict*).
- The request was [rondo#179](https://github.com/suisya-systems/rondo/issues/179), *an unreadable git
  status still lets publish through under --despite-review*. The owner wrote one line:
  *「https://github.com/suisya-systems/rondo/issues/179 をやってほしい」*.
- **The drafter asked which of the issue's two options to take, and the owner chose the first**
  (refuse outright). The runbook expected the second, a wording change of a few lines. So the pull
  request is larger than the runbook's size estimate: `+298 -27` over 15 files, including a
  decision entry.
- **One paid lap, $4.09.** `lap-907933dd-a772-4192-ad14-2ed48a7feb83` cost $4.0938705 over 61 turns
  in 405.5 s and committed `2b64cfb`. The drafted scope was $7.50 (rondo's cold-start default, and
  the scope screen said so). The owner approved it unchanged.
- Published as **suisya-systems/rondo#405**. It conflicted with `main`, got no CI, and was fixed
  outside the page (`d915c4a`). It then went green on 7 checks (6 passed, 1 skipped). **The owner
  did not merge it from the page:** the merge press was refused, as designed, because the head had
  moved. The secretary merged it with `gh` as `4c06c6c` at 12:52:27 JST. **Step 8 (merge from the
  page) was therefore not measured**, and this record does not claim it.
- **Terminal trips by the owner: 0. Questions to the secretary: 2.**

Sources: the secretary's notes, taken beside the walk. Each time and cost below was **checked
against the store, the host's log and the lap's transcript** before it was written here. The store
is `$HOME/rondo-lap-12/rondo-iterations.sqlite3`, opened read-only (`node:sqlite`,
`readOnly: true`). The log is `journalctl --user -u rondo.service`. The transcript is the lap's
`events-000.jsonl` under `$HOME/rondo-lap-12/session-state/rondo-lap-907933dd-.../`. Pull requests
#405 and #388 were read from GitHub (read only). Section 7 lists where the notes and the rows
disagree. **Each time and cost comes from a row or a log line. Where only the notes have it, the text
says so.**

---

## 1. The completion definition, judged

The owner approved this judgement on 2026-09-22.

| | criterion | verdict | the row that decides it |
|---|---|---|---|
| K1 | the request goes as far as the pull request | **met** | request `11:59:44`. PR #405 opened by the page's **プルリクエストを作る** at `12:29:47` (section 2) |
| K2 | only approvals and disputes in between | **met** | four decisions: the drafter's question (a dispute, answered *「1かな」*), the scope (approved as drafted), the gate (approved) and the publish. Nothing else was asked of the owner |
| K3 | no terminal (since `D-0080`: nothing to remember at a start) | **met** | 0 trips by the owner. The secretary's `gh` and `git push` during the conflict were the secretary's intervention, not a step the page asked the owner for (section 4) |
| K4 | no word you have to ask about | **not met** | measure 5, row 1: the gate's reading says *「ビルドもテストも、何かの実行もしていません。」*, and the owner asked whether that meant the tests had not run ([#410](https://github.com/suisya-systems/rondo/issues/410)). The other half of lap 11's K4 failure passes: nothing on the screen said *取り込み* before the merge |

As in lap 11, this lap walked one request in one repository. **It does not test `D-0081` rule 1.1**,
and this record makes no claim about it.

**Verdict: not done for now.** K4 fails on one sentence. That sentence is true of rondo's reading,
and it reads as a claim about the work. Two further findings sit outside K1 to K4 but on the same
walk. rondo could not see that its own pull request conflicted ([#411](https://github.com/suisya-systems/rondo/issues/411)).
And once the pull request moved outside the page, the page could neither merge it
([#412](https://github.com/suisya-systems/rondo/issues/412)) nor see that it had been merged
([#413](https://github.com/suisya-systems/rondo/issues/413)).

## 2. The timeline, from the rows

All times are JST, 2026-09-22. The source of each row is in the last column.

| time | what happened | source |
|---|---|---|
| 11:51:03 | setup's `try-restart` replaced lap 11's host; the page answers on `127.0.0.1:7333` | journal |
| 11:51:34 | setup's plan recorded (`setup-1790045494177`), after a second run of `setup-plan` alone. The first run hit `database is locked` against the restarted host ([#406](https://github.com/suisya-systems/rondo/issues/406)) | `setup_plan`; the notes |
| 11:59:44 | the owner sends *「https://github.com/suisya-systems/rondo/issues/179 をやってほしい」*, and rondo reads #179 into the thread | `conversation_message` `request-8ac9bbd5-...`, `forge-e1e27921-...` |
| 12:00:01 | the drafter **asks** which of #179's two options to take, and recommends the first ($0.0831) | `drafter-5d31deec-...` (`asks = 1`), journal |
| 12:00:09 | the host's notification for the question | `operator_attention` (`reach`) |
| 12:02:30 | the owner answers *「1かな」* ("1, I think") and presses **続ける** | `reply-9fd2c5a8-...` (`answer_outcome = carry_on`) |
| 12:02:48 | the drafter writes one plan and a scope: **3 laps, $7.50, $2.50 reserve, 3 review rounds** ($0.0894) | `proposal` `draft-ae069341-...`, `scope` `drafted-scope-403da903-...`, journal |
| 12:09:11 | the owner approves the scope as drafted | `scope_decision` |
| 12:10:13 | **the lap is admitted** (`lap-907933dd-...`) | `scope_consumption` |
| 12:16:23 | the lap stops at its gate: **1 commit, 15 files**. The deterministic reading is `clear` | `lap_reading`, journal |
| 12:16:32 | the host's notification for the gate | `operator_attention` (`reach`) |
| 12:16:44 | the model reading (`gpt-6-astra`) raises nothing | `lap_reading`, journal |
| about 12:19 | the owner sees the Windows notification | the notes |
| 12:24:59 | the owner presses **承認する** | `gate_answer` (`approve`), journal |
| 12:29:47 | **プルリクエストを作る**: branch pushed, **#405** opened | `report-published-...`; GitHub `createdAt` 03:29:46Z |
| 12:30:15 | rondo reports that the forge has **no check of any kind** on `2b64cfb` | `report-checks-...-none` |
| 12:37:37 to 12:43:52 | an organisation worker merges `origin/main` into the lap branch and renumbers the decision (`d915c4a`, committed 12:41:02). The secretary pushes it | that worker's transcript; #405's commits |
| 12:44:47 | rondo reports **green**: 7 checks on `d915c4a`, *"6 passed and 1 was skipped, and none failed"* | `report-checks-...-green`, journal |
| (not in a row) | **プルリクエストをマージする** is refused with `mergeRefusedMoved` | the notes |
| 12:52:27 | the secretary merges #405 with `gh` (squash, `4c06c6c`) | GitHub `mergedAt` 03:52:27Z |

- **Send to the gate answered: 25 min 15 s** (11:59:44 to 12:24:59).
- **Send to pull request: 30 min 3 s.** **Send to green: 45 min 3 s**, of which about 15 min was
  the conflict. **Send to merged: 52 min 43 s**, merged outside the page.
- The lap took 405.5 s of that. From the drafter's question to the drafted scope took 2 min 47 s. The scope
  stood open for 6 min 23 s and the gate for 8 min 36 s.

## 3. The six measures

### Measure 1: terminal trips -- 0

Setup ran once, before the walk, and the runbook does not count it. Neither does starting the page.
Nothing else was typed by the owner. **The secretary did use a terminal**: `git push` of the
conflict fix and `gh pr merge`. That was an intervention, and it is recorded under *The conflict*
(section 4). It is not a trip the page sent the owner on.

### Measure 2: trips outside the screen -- 0 by the owner, during steps 1 to 7

The notes record no trip by the owner to GitHub, a file or a log while the lap ran and the pull
request opened. The result band carried the pull request as a link and the checks as 緑. **Two
things were found outside the page**, and the page could not show either:

- **That #405 conflicted with `main`.** GitHub marked it `DIRTY` and started no CI, and rondo's
  thread said only *"The forge reported no check of any kind"*. The owner: *「CI監視がコンフリクトを検知出来てない」*
  ("The CI watch can't detect the conflict.") ([#411](https://github.com/suisya-systems/rondo/issues/411)).
  The notes do not say who first saw the `DIRTY` state, or where.
- **The merge refusal** sends the person to GitHub: the refusal is a bare page that says to check
  there ([#412](https://github.com/suisya-systems/rondo/issues/412)).

### Measure 3: notifications

| turn | the wait opened | host program | tab | how the owner noticed |
|---|---|---|---|---|
| the drafter's question | 12:00:01 | presented 12:00:09 | not recorded | the notes do not say. The owner answered at 12:02:30 |
| the gate | 12:16:23 | presented 12:16:32 (9 s); **the Windows notification reached the owner**, about 12:19 by the notes | **not noticed**: the notes cannot say whether it arrived or was too faint | the host's notification, and the screen switching |

- The host's times are `operator_attention` rows (`subject_kind = reach`). The tab's and the owner's
  are from the notes.
- The notes do not record the browser's notification permission for `127.0.0.1:7333` before the
  walk, which the runbook asked for.
- **The tab's signal did not reach the owner** at the gate
  ([#414](https://github.com/suisya-systems/rondo/issues/414)).

### Measure 4: questions to the secretary -- 2

1. **At the drafter's question.** #179 is itself a choice between two options, and the drafter
   brought that choice to the owner. The notes record that the owner asked the secretary once
   there, and then chose 1. They do not record the question's words. Answering the drafter is a
   dispute, which K2 allows. The question to the secretary still counts under this measure.
2. **At the gate: whether the tests had been run.** Measure 5, row 1.

**Lap 11's eight questions, against this lap's screen.** None was asked again:

| lap 11 asked | lap 12 |
|---|---|
| what to press next, after the drafted plan | the band named the scope, and after approval it turned into **この作業を始める**. Decided without asking |
| whether it had stopped | not asked |
| whether **Start** registered | not asked. But the tab kept loading until the gate, and the owner disliked it: *「リロードインジケーターが動き続けてるのが気持ち悪い」* ("The reload indicator spinning on and on is unpleasant.") ([#409](https://github.com/suisya-systems/rondo/issues/409)) |
| whether the second notification had come | not asked (measure 3) |
| what 「変更は取り込み済みです」 meant | **gone.** After approval the result band read **承認済み** / *まだ公開していません（プルリクエストはありません）。* |
| what to press after approving | the band read *作業は承認済みです。プルリクエストを作ると…マージはしません。* with **プルリクエストを作る**, as the runbook said |
| whether the publish worked, and where | the result band: *プルリクエストを開きました:* **#405**, as a link |
| whether it was green | **チェック** 緑（6 通過 1 スキップ） |

### Measure 5: words asked about -- 1

| # | where | the words (as printed) | what the owner thought | what it meant |
|---|---|---|---|---|
| 1 | the gate's **チェック** column, rondo's reading | *「ビルドもテストも、何かの実行もしていません。rondo は周回の作業を動かせないためです。」* (`readingCovered`, `src/access/wording/ja.ts:307`) | the tests were not run | **rondo's reading** ran nothing, because it cannot run a lap's work. The worker had run `npm run verify`, and it passed: 98 test files passed and 2 skipped, 1844 tests passed and 8 skipped (the lap's transcript). The screen shows the reading's account of itself. It does not show the worker's verification ([#410](https://github.com/suisya-systems/rondo/issues/410)) |

This one row decides K4.

### Measure 6: what one pull request cost, beside the organisation's

**The organisation's pull request: [#388](https://github.com/suisya-systems/rondo/pull/388)**,
closing [#377](https://github.com/suisya-systems/rondo/issues/377) (*a lap's definition of done
reaches the worker even from a one-line request*). It was done by one claude-org worker
(`rondo-377`, `claude-opus-5`) on 2026-09-21, and it is already merged. **Why this one:**

- **It has the same shape as #405.** One issue, one pull request, and 15 files. Each adds a
  decision entry in `DECISIONS.md` (#405: +70, #388: +140). Each has a source change under
  `src/access/`, the same wording in `wording.ts`, `en.ts` and `ja.ts`, and tests. Neither needed a
  design discussion before the work. The one choice each issue left open was made inside the task:
  in #405 the owner answered the drafter, and in #388 the worker chose (option b2).
- **Its size is close.** #388 is `+500 -13`. #405 is `+298 -27`. The runbook's comparable was
  "a change of a few lines in wording". #405 did not stay that size, because the owner chose the
  first option, so the comparison was matched to what #405 became.
- **It is not a perfect match.** #388 has about 1.7 times the added lines. It also ran beside
  other workers (#386, #387), which matters for the secretary's and the dispatcher's rows.
  The runbook asked for a fresh task delegated after the walk. This is a finished one, chosen
  afterwards, so the plan's usage limit was never read around it.

**How the tokens were counted.** The runbook named Claude Code's OpenTelemetry metric
`claude_code.token.usage`. **It was not read.** The counts below come from transcripts:

- **rondo:** the lap's `result` event (`usage`, and `modelUsage.claude-opus-5`). The per-message
  records in the same stream undercount output (833 against 25,937), so the `result` event is
  used.
- **the organisation:** the Claude Code session transcript
  (`~/.claude/projects/...-rondo-377/3aa435eb-....jsonl`). For each assistant message id, the
  last `usage` record is taken, and those are summed. An interactive session has no `result` event.
  **This count has not been checked against OpenTelemetry.** If this transcript undercounts output
  the way the lap's stream does, the org output figure is low.
- **the secretary and the dispatcher:** the same method, but only records inside the worker's
  session window (2026-09-21 18:29:16Z to 18:55:12Z). The sessions are `d7981a56-...` (secretary)
  and `c41c7a0f-...` (dispatcher). A third session under claude-org-ja in that window
  (`2d15f041-...`) is not the secretary and is left out.

Empty cells are "not recorded", never 0.

| | rondo (this lap) | organisation (claude-org-ja) |
|---|---|---|
| the work | #179, PR #405 (`+298 -27`, 15 files) | #377, PR #388 (`+500 -13`, 15 files). Why it matched is above |
| worker, per try | one try: **$4.0938705** / 61 turns / 405,547 ms (`iteration`) | one session: 137 assistant messages, 18:29:16Z to 18:55:12Z. PR opened 18:55:31Z |
| worker tokens: input / output / cache read / cache creation | **108 / 25,937 / 4,387,331 / 125,124** (the lap's transcript `result` event; output includes 4,304 thinking). **rondo's store does not keep these** (`spendOf`) | **280 / 76,608 / 23,520,133 / 232,234** (session transcript) |
| worker, total | $4.0938705. The page's **全回の合計** read $4.09, which matches. Tokens: 4,538,500 | tokens: 23,829,255 |
| drafting | drafter ask **$0.0831** + drafter split **$0.0894** = $0.1725. The `proposal` snapshots (`0.0831455`, `0.089429`) and the journal agree. No revise drafter ran. Tokens: not recorded | secretary 154 / 28,760 / 10,599,731 / 431,091. Dispatcher 196 / 23,282 / 29,496,685 / 114,938. **An upper bound**: other tasks ran in the same window |
| model review | **1** model reading (`gpt-6-astra`). Cost: not recorded | the worker ran `codex exec review`. Usage: not recorded |
| outside help this pull request needed | **an organisation worker fixed the conflict** (`rondo-405-conflict`, `claude-sonnet-5`, 12:37:37 to 12:43:52 JST): 108 / 15,233 / 4,775,214 / 116,415. The secretary's time is not counted | none |
| usage limit | not applicable (metered) | not recorded |
| **per pull request** | **$4.27 metered** (worker + drafters, reviewer not included). **Tokens: 4.54 M for the worker**, and 4.9 M more for the organisation's conflict fix | **no metered dollars. Tokens: 23.8 M for the worker**, and up to 40.7 M in the secretary's and dispatcher's sessions over the same window |

**The claim tested: does the stack cost less than the organisation for one pull request of this
size?** The only unit both sides share is **tokens, on the worker row**. On that row, rondo's lap
used **about a fifth of the organisation worker's tokens** (4.54 M against 23.8 M). Output was
about a third (25.9 k against 76.6 k). Cache reads dominate both totals, as the runbook expected.
Three things narrow the answer:

- **It is one pair, and the pair is not equal.** #388 is the larger change.
- **rondo's pull request did not get to green on rondo alone.** The conflict fix was organisation
  work, and it cost more tokens (4.9 M) than the lap itself. That fix exists because the lap's
  target repository was stale ([#407](https://github.com/suisya-systems/rondo/issues/407)). It is
  not a cost of #179 as such, but it was a cost of this pull request.
- **Neither side is complete.** On rondo's side, the drafter's and the model reviewer's tokens are
  kept nowhere. The drafter's dollars are kept, and the reviewer's are not. On the organisation's
  side, there are no dollars, and the usage limit was not read. The coordination rows are upper
  bounds.

**What could not be compared:** dollars against the subscription's limit, which the runbook forbids
converting; the drafting row, because rondo has only dollars and the organisation only tokens; and
the review row, which neither side recorded. **rondo keeps its worker's tokens in the transcript,
not in the store.** That is why a token comparison needs a file outside the store, and the gap is a
finding in its own right.

### Overall

- **Issue walked:** [rondo#179](https://github.com/suisya-systems/rondo/issues/179), option 1
  (refuse a publish whose `git status` cannot be read, whatever overrides it).
- **Send to pull request / to green / to merged:** 30 min 3 s / 45 min 3 s (including the conflict)
  / 52 min 43 s (merged outside the page, by the secretary).
- **Decisions:** the drafter's question (a **dispute**: option 1), the scope (an **approval**, as
  drafted), the gate (an **approval**), the publish (an **approval**). The merge was pressed and
  refused. It was not decided on the page.
- **全回の合計 against the approved scope:** $4.09 of $7.50, one try of three. The band also read
  1 回目 / 3 回まで and 聞かずに決めたこと 0 件.
- **K1 met, K2 met, K3 met, K4 not met** (section 1).

## 4. The walk, as it was seen

### The question the drafter asked

#179 does not say which way to fix it. It offers two options. The drafter did not choose. It laid
out both in Japanese, said what each one costs, recommended the first, and asked. That is the
dispute K2 allows, and it is what the runbook hoped the candidate would test. The owner took the
recommendation. The pull request that followed is a rule change with a decision entry, not the
few-line wording change the runbook's table estimated.

### Start, and the tab that would not stop loading

**この作業を始める** did what the runbook said: the busy label, then *受け付けました*. The tab then kept
loading for the whole lap, as the runbook said it would. The owner still found it unpleasant, and
asked for the press to answer at once and for progress to show on the page
([#409](https://github.com/suisya-systems/rondo/issues/409)).

### The gate, and the line that decided K4

Both readings were clean. The **チェック** column says what rondo's reading did and did not do, and
its first sentence is that it built, tested and ran nothing. That is true of the reading. The
worker's `npm run verify` is in the transcript, and it passed. Nothing on the gate shows it. The
worker's verification is the thing a person wants to know at a gate. The only statement about
verification on the screen is a negative one, and it is about something else
([#410](https://github.com/suisya-systems/rondo/issues/410)).

### The action at the bottom

The owner proposed putting the newest thread entry on top, so that the box and the waiting decision
stay at the top of the screen however long the thread grows. On **この作業のプルリクエストを作る**, the
press was again at the bottom. The owner widened the point: *a person's actions belong at the top*,
on every screen, not only in the thread's order
([#408](https://github.com/suisya-systems/rondo/issues/408)).

### The conflict

#405 conflicted with `main` as soon as it opened. The lap's repository copy, `$R/rondo-gh`, was
cloned before the walk and not brought up to date at the switch. It stood at `f2e8b8e` (#395).
Since then `main` had taken **D-0097** for triage (#399), so the lap numbered its own decision
D-0097 again. The runbook's 1b has no step that updates the target repository, and the secretary
updated only `rondo-host` ([#407](https://github.com/suisya-systems/rondo/issues/407)).

GitHub starts no CI on a conflicted pull request. rondo reported *no check of any kind* and did not
say why ([#411](https://github.com/suisya-systems/rondo/issues/411)).

**The secretary stepped in once.** An organisation worker merged `origin/main` into the lap branch,
kept main's D-0097 and D-0098, and renumbered the lap's entry to **D-0099** (`d915c4a`). The
secretary pushed it. #405 then went green.

A side effect on `main`: the squash commit's subject, `4c06c6c`, came from the pull request's title
and still says **D-0097**. The decision it landed is **D-0099** in `DECISIONS.md` and in the
commit's body.

### The merge press, refused, and the merge the page never saw

With the checks green, the page offered **プルリクエストをマージする**. The press was refused with
`mergeRefusedMoved`. **The refusal was correct.** The press requires one head in three places: the
head the button was drawn for, the head rondo read green, and the tip the lap pushed
(`src/access/merge.ts:112-119`). The lap pushed `2b64cfb`, and the green was read on `d915c4a`.
The refusal screen is a bare page that sends the person to GitHub. There is no way on the page to
read the moved pull request again and approve it again
([#412](https://github.com/suisya-systems/rondo/issues/412)).

The secretary merged #405 with `gh`. After a reload, the page still did not treat #405 as merged. It
kept offering **プルリクエストをマージする**, and its elapsed time kept counting (55 min by the notes)
([#413](https://github.com/suisya-systems/rondo/issues/413)).

**Step 8 was not measured.** Merging from the page never ran on this lap, because the secretary's
push moved the head. Whether *main にマージしました* reads well is still open.

## 5. Findings and the issues filed

Filing was the secretary's. Each finding is listed with its issue.

| # | finding | issue |
|---|---|---|
| 1 | setup's last step, recording the plan, raced the host it had just restarted and failed with `database is locked`. Running `setup-plan` alone recovered it. The restart should come after the store write | [#406](https://github.com/suisya-systems/rondo/issues/406) |
| 2 | the lap's target repository was stale, so the lap reused a decision number `main` already had, and its pull request conflicted | [#407](https://github.com/suisya-systems/rondo/issues/407) |
| 3 | a person's actions belong at the top: the newest thread entry first, and each screen's main press at the top | [#408](https://github.com/suisya-systems/rondo/issues/408) |
| 4 | after **この作業を始める**, the tab keeps loading until the gate. The press should answer at once | [#409](https://github.com/suisya-systems/rondo/issues/409) |
| 5 | the gate's **チェック** shows only rondo's reading, and it reads as "the tests were not run". The worker's verification is not on the screen. **Decides K4** | [#410](https://github.com/suisya-systems/rondo/issues/410) |
| 6 | a conflicted pull request gets no CI, and rondo reports "no checks" without calling it a conflict | [#411](https://github.com/suisya-systems/rondo/issues/411) |
| 7 | after `mergeRefusedMoved`, the page offers no way back: read the moved pull request again and approve it again | [#412](https://github.com/suisya-systems/rondo/issues/412) |
| 8 | a merge made outside the page is not picked up. The page keeps offering the merge and keeps counting | [#413](https://github.com/suisya-systems/rondo/issues/413) |
| 9 | the tab's notification at the gate was not noticed | [#414](https://github.com/suisya-systems/rondo/issues/414) |

Not filed: the squash subject that says D-0097 (section 4), and measure 6's finding that rondo keeps
its worker's tokens only in the transcript.

## 6. Compared with lap 11

| | lap 11 | **lap 12** |
|---|---|---|
| the request | one Japanese line (#291) | **one Japanese line (#179)**. The drafter asked a question first |
| tries | 2 ($0.79 + $0.85). The first delivered nothing | **1 ($4.09)**. Committed and verified on the first try |
| terminal trips (owner) | 0 | **0** |
| trips outside the screen (owner) | 1 (GitHub: was a PR made, and where?) | **0** during steps 1 to 7. The conflict and the merge were handled outside the page by the secretary |
| notifications | host and tab both, at gate 1 | **host reached the owner**. The tab was not noticed |
| questions to the secretary | 8 | **2** |
| words asked about | 4, including 「変更は取り込み済みです」 | **1**: 「ビルドもテストも、何かの実行もしていません。」 |
| merge | on GitHub, by the owner | **refused on the page** (`mergeRefusedMoved`), then `gh`, by the secretary. Step 8 not measured |
| cost of the pull request | laps $1.645, drafters $0.1385 | **lap $4.09, drafters $0.1725**, reviewer not recorded. Beside the organisation: section 3, measure 6 |

**What lap 11 asked for and lap 12 shows fixed:** the next step is named and weighted. A press shows
that it was received. The page says approved, the pull request and its checks in Japanese.
「取り込み済み」 is gone. The cost of the whole request is shown, with a note that the budget is a
default. None of lap 11's eight questions came back.

**What is new:** a question about the one sentence that describes verification (K4), and a set of
findings about **the pull request after it leaves rondo**: a conflict rondo cannot see, a moved head
rondo cannot re-approve, and a merge rondo cannot see. Lap 11 narrowed the arc to *the page telling a
person what just happened*. Lap 12 narrows it again: **the page now says what rondo did. It does not
yet say what the worker did, or what happened to the pull request once someone else touched it.**

## 7. Where the secretary's notes and the rows differ

The notes and the rows agree on the lap id, $4.09 against $7.50, one try of three, #405 and its
times, 7 checks (6 passed, 1 skipped), and the merge at 03:52Z. The differences:

1. **"98 files / 1844 passed."** The worker's run was 98 test files passed and 2 skipped, and 1844
   tests passed and 8 skipped.
2. **The notification at 12:19.** The host presented it at **12:16:32**, 9 s after the gate. 12:19
   is when the owner reported it, by the notes.
3. **The code cited for the refusal.** The notes say `merge.ts:112-117`. At `4c06c6c` the check and its
   refusal run from line 112 to line 119.
4. **The lap's duration against the wall clock.** continuo reports 405,547 ms. The admission row
   (12:10:13) and the gate (12:16:23) are 370 s apart. The rows do not say where the other 35 s
   fall, and this record uses continuo's figure.
5. **The refused merge press** leaves no row or log line. Its time and wording come from the notes
   only.

## 8. Verification discipline, and what is left

- This document changes no source file and writes to no store. The store was opened with
  `node:sqlite`'s `DatabaseSync` in `readOnly` mode. The journal, the transcripts and pull requests
  #405 and #388 were read, not written. `$HOME/rondo-lap-12` is a live host, and nothing was written
  there.
- Code is cited at `4c06c6c`, the commit this lap produced.
- **Only in the notes:** the owner's words, what the owner noticed and when, the two questions to
  the secretary, the refused merge press, and the page still offering the merge after it happened.
- **Left where it is:** #405 is merged as `4c06c6c`. The approved scope ($7.50, of which $4.09 is
  spent) expires on its own clock (`expires_at_ms` 1790137920000, 2026-09-23 13:32 JST). The host
  still serves lap 12 from `$HOME/rondo-lap-12`. Section 6 of the runbook puts lap 11's host back.
