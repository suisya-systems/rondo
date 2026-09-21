# lap 11 dogfood -- a one-line Japanese request reached a green pull request, and the page still did not say what had happened

The eleventh walk of the arc, and the one [`lap-11-runbook.md`](lap-11-runbook.md) set up to decide
whether **rondo is done for now**, judged against the completion definition (`D-0075`, K3 as
`D-0080` redraws it). The answer is **no**, and the reason is narrow.

**rondo did the work. The page did not tell the person about it.** A one-line request in Japanese
was read, quoted from the issue, drafted into a scope, run, caught at the gate when the first try
delivered nothing, revised, approved, published as a pull request and reported green. Nothing was
typed after setup. But **K4 fails**: the person had to ask what the page meant at the moments that
mattered most, including whether the pull request existed, where it was, and whether it was green.
One sentence on the screen said the opposite of what had happened. And the five-second refresh kept
taking back what the person was reading, which the owner asked to have fixed at the root.

- Walked on 2026-09-21, about 21:40 to 22:27 JST, by the owner (`happy_ryo`) on the Japanese page.
  The claude-org secretary stood beside the walk, answered questions and took the notes this record
  starts from. They pressed nothing.
- The request was [rondo#291](https://github.com/suisya-systems/rondo/issues/291), *split the
  wording catalogue into one file per language*. The owner did **not** use the runbook's English
  request body. They typed one line (N-45).
- **Two paid laps, $1.645 in total.** The first,
  `lap-ef230e6f-2063-40e4-b98a-29d3c3c46d2d`, cost $0.792 over 17 turns in 86 s and **delivered an
  empty branch**. The second, `lap-590e0e66-d20b-4f44-9201-67bafed79387`, a revise of the first,
  cost $0.853 over 22 turns in 135 s and committed `cd10f7d`.
- The drafted scope said **$7.50**, the same figure as lap 10, for a structural reason (N-50). The
  owner raised it to **$25** and approved.
- Published as **suisya-systems/rondo#372**. rondo reported it green on 7 checks. The owner merged it
  on GitHub as `27b778a` at 22:29:50 JST. **#291 did not close by itself.** The pull request body
  names no issue, so the secretary closed it by hand (N-52).
- **Terminal trips during the walk: 0.** Setup ran once and is not counted. **Trips outside the
  screen: 1**, to GitHub, to find out whether and where the pull request existed.

Sources: the secretary's notes taken beside the walk (times as observed, the owner's words as said),
**checked against the store and the host's log before anything was written here**. The store is
`$HOME/rondo-lap-11/rondo-iterations.sqlite3`, opened read-only (`node:sqlite`, `readOnly: true`).
The log is `journalctl --user -u rondo.service`. Pull request #372's own record was read from
GitHub (read only). Code is cited at `27b778a`, the commit this lap produced. Section 8 lists every
place where the notes and the rows disagreed. **Every time and cost below comes from a row or a
log line, not from the notes.**

---

## 1. The completion definition, judged

| | criterion | verdict | the row that decides it |
|---|---|---|---|
| K1 | the request goes as far as the pull request | **met** | request `21:54:40`, PR #372 opened by the page's **Publish** at `22:24:51` (section 2) |
| K2 | only approvals and disputes in between | **met** | five decisions: the scope (a raise, then approve), gate 1 (**Ask for a change**, a dispute), gate 2 (approve), publish. Every other stop was about *reading the screen*, and that is K4's failure, not a sixth kind of decision (measure 3) |
| K3 | no terminal (since `D-0080`: nothing to remember at a start) | **met, with one blemish** | 0 counted trips. The blemish: setup's last screen lists `start` / `answer` / `publish` terminal commands, and they read like next steps (N-52) |
| K4 | no word you have to ask about | **not met** | measure 2 and measure 5: an internal id in the thread, a sentence that said the change had been taken in when nothing had been pushed, publish / merge / approve that could not be told apart, and the green report that did not read as green |

`D-0081` rule 1.1 judges K1 to K3 across a person's day and across repositories. This lap walked one
request in one repository, so **it does not test that part**, and this record makes no claim about
it.

**Verdict: not done for now.** K4 fails, and so does the owner's reading of the page as a place to
stay (N-46). Both come from what the page draws and how it redraws it, not from what rondo can do.
Every step of the arc worked, including the first real walk of **Ask for a change**.

## 2. The timeline, from the rows

All times are JST, 2026-09-21. The source of each row is in the last column.

| time | what happened | source |
|---|---|---|
| 21:46:53 | setup recorded the plan (`setup-1789994813035`) | `setup_plan` |
| 21:48:28 | the service started; the page answers on `127.0.0.1:7333` | journal |
| 21:54:40 | the owner sends *「https://github.com/suisya-systems/rondo/issues/291 をやってほしい」* | `conversation_message` `request-e7b4c149-...` |
| 21:54:40 | rondo reads #291 from the forge and records it in the thread (`D-0078`) | `forge-1c193b11-...`; journal 21:54:42 |
| 21:54:55 | the drafter writes a one-line plan in Japanese, a split with one plan, and a scope: **3 laps, $7.50, $2.50 reserve, 3 review rounds**, claim `src/access/` (drafter cost $0.0911) | `proposal` `draft-24c87431-...`, `scope` `drafted-scope-7e40e38a-...`, journal |
| 22:03:23 | the owner writes a successor scope with **cost $25** and approves it | `scope` `scope-3097953f-...`, `scope_decision` |
| 22:05:05 | **try 1 starts** (`lap-ef230e6f-...`) | `scope_consumption` (admission) |
| 22:06:27 | try 1 stops at its gate: **0 commits, 0 files**; the deterministic reading raises 3 points | `lap_reading`, journal |
| 22:06:43 | the model reading raises **2 blockers** | `lap_reading` (`gpt-6-astra`) |
| 22:07:11 | the host's notification for gate 1 | `operator_attention` (`reach`, `presented`) |
| 22:07:20 | the revise drafter drafts the change text ($0.0474) | `proposal` `draft-61098a95-...`, journal |
| 22:12:35 | the owner presses **Ask for a change** (変更を依頼する) | `proposal` `explanation-lap-ef230e6f-...`; journal `gate answer` 22:12:36 |
| 22:12:36 | **try 2 starts** (`lap-590e0e66-...`, supersedes try 1) | `scope_consumption`, `iteration.supersedes_iteration_id` |
| 22:14:46 | try 2 stops at its gate: **1 commit, 3 files, nothing raised** | `lap_reading`, journal |
| 22:14:57 | the model reading raises nothing | `lap_reading` |
| 22:15:34 | the host's notification for gate 2 | `operator_attention` |
| 22:20:48 | the owner presses **approve**; *What you checked* is left empty | `proposal` `explanation-lap-590e0e66-...`; journal 22:20:49; PR body |
| 22:24:51 | **Publish**: branch pushed, #372 opened, run closed; rondo's report lands in the thread | `conversation_message` `report-published-...` |
| 22:26:48 | rondo reports **green**: *"7 check(s) on commit 'cd10f7d...', and every one of them passed"* | `report-checks-...-green`, journal |
| 22:29:50 | #372 merged on GitHub as `27b778a` (the owner, outside the page) | GitHub `mergedAt` |

- **Send to the gate answered: 26 min 8 s** (21:54:40 to 22:20:48).
- **Send to pull request: 30 min 11 s.** **Send to green: 32 min 8 s.**
- The laps themselves took **3 min 41 s** of that (86 s and 135 s). **The rest was the person**:
  8 min 28 s from the drafted scope to its approval, 1 min 42 s from approval to **Start**, about 6
  min at each gate, and 4 min from approval to publish. Section 4 is about where that time went.

## 3. The five measures

### Measure 1: terminal trips -- 0

Setup was run once, before the walk, and the runbook does not count it. After setup, nothing was
typed. **Trips outside the screen, which the runbook does not count separately but lap 10 did: 1.**
After publish, the owner went to GitHub to find out whether a pull request had been opened, and
where:

> 「PR作成された後PR作成されたことがわかりにくい、どこにPRができたのかの通知もないから自分でGithub見に行く必要がある」
>
> (After the PR was made, it is hard to tell it was made. Nothing says where it was made either, so
> I have to go and look on GitHub myself.)

The thread held the answer at 22:24:51, and it was in English, inside rondo's report: *"Lap '...'
was published: its branch was pushed, pull request https://github.com/suisya-systems/rondo/pull/372
was opened, and run '...' was closed completed."* The report existed. **It did not read as the
answer** (N-49).

### Measure 2: words the owner had to ask about (the page was Japanese)

| # | where | the words | what it meant |
|---|---|---|---|
| 1 | the drafter's message in the thread, its bases | `proposal draft-24c87431-...` | the proposal row the draft rests on. The basis link falls through to `basisLine`, which prints the store id (`src/access/page/vocabulary.tsx:382`) |
| 2 | the thread, straight after **approve** | *「2 回目: 終わりました。変更は取り込み済みです。」* ("Try 2: finished. The change has been taken in.") | **the gate was answered.** Nothing had been pushed or landed. The host's own log says so at 22:20:50: *"Nothing was pushed, nothing was landed, and publishing this work is the operator's"*. Read in Japanese, the sentence says the change was merged (N-49) |
| 3 | the whole arc | approve / publish / merge | the owner could not tell from the screen which of the three had happened. *「あぁ、なるほど、これわかりにくい」* ("Ah, I see. This is hard to follow.") |
| 4 | rondo's reports in the thread | English, by `D-0055` rule 4 | the green report was there at 22:26:48. The owner: *「変更がグリーンになったことが、全くわからない」* ("I could not tell at all that the change had gone green.") |

### Measure 3: places the owner stopped to think

| # | where | what they were deciding | kind |
|---|---|---|---|
| 1 | the thread, after the drafter's plan arrived | what to press next | **something else**: finding **Set the scope** (範囲を決める). *「範囲を決めるの存在感がなさ過ぎて、止まってるように見える」* ("Set the scope has so little presence that it looks as if everything has stopped.") |
| 2 | the scope screen | the budget | **an approval**: $7.50 raised to $25, as the runbook asked (step 2) |
| 3 | after **Start the work** (作業を始める) | whether the press registered | **something else**: *「この作業を始めるボタンは押されたら非活性になるかローディングを表すような動作をするべき」* ("Once pressed, Start this work should become disabled, or show that it is loading.") |
| 4 | gate 1 | approve or ask for a change | **a dispute**: **Ask for a change** |
| 5 | gate 2 | approve | **an approval** |
| 6 | after approval | what comes next, and that it is a pull request | **something else**: *「PRに進むなら、そのことが明示的にラベリングされたボタンがないと普通は気づけない」* ("If the next step is the PR, you would not normally notice without a button explicitly labelled as such.") |
| 7 | after **Publish** (公開する) | whether the press registered | **something else**: *「公開するをクリックした後、同様にボタンに変化がなくわかりにくい」* ("After clicking Publish, the button again does not change, so it is hard to tell.") |

Stops 2, 4 and 5 are the decisions K2 allows. **Stops 1, 3, 6 and 7 are the page not saying
something**: what the next step is, that it is a pull request, and that a press was received.

### Measure 4: notifications

| turn | the gate opened | host program | tab | how the owner actually noticed |
|---|---|---|---|---|
| gate 1 | 22:06:27 | **arrived**, 22:07:11 (44 s) | **arrived** | both |
| gate 2 | 22:14:46 | **arrived**, 22:15:34 (48 s) | **shown at 22:14**, missed: the owner was on another page | the secretary's notes do not say which one it was |

- The host's times are `operator_attention` rows (`subject_kind = reach`). The tab's times are the
  secretary's observation. Both are inside the runbook's stated limits: the host checks once a
  minute, the tab every five seconds.
- **Working, from another tab: yes.** The list on the left and *work under way* on the right both
  showed the lap running. That closes lap 10's reach 1.
- **The "+20 notifications" in Windows' notification centre, under Chrome.** The secretary suspected
  the tab was ringing again on every five-second redraw. **The code does not support that.**
  `page/chime.js` keeps its set of seen waits (`waiting`) across htmx's in-place swap, because the
  script is not reloaded. It rings only on a key it has not seen. A full document load starts again
  from what the document holds, and it does not ring for anything already on the screen. Each wait's
  key is stable while it stands (`gate:<lap>:awaiting_human`, `src/access/page-logic/waits.ts:92`).
  Every ring is also tagged `rondo-your-turn`, so Chrome replaces one notification rather than
  adding another. What the 20 were was not observed, and this record cannot attribute them to rondo.
  **Nothing is filed for this.** If it happens again, what to record is the text and the time of
  each notification (N-51).

### Measure 5: questions to the secretary

Each of these counts as a place where the screen alone was not enough. They are listed from the
secretary's notes, and none of them was answered from the screen afterwards.

1. What to press next, after the drafter's plan: **Set the scope**.
2. Whether it had stopped, while the scope was waiting to be opened.
3. Whether **Start** had registered.
4. The notifications: whether the second one had come.
5. What *「2 回目: 終わりました。変更は取り込み済みです。」* meant straight after approve.
6. What to press next after approving: **Publish**, which opens the pull request.
7. Whether the publish had worked, and where the pull request was.
8. Whether the pull request was green.

## 4. The walk, as it was seen

### The request: one line, in the owner's own language

The runbook's step 1 gave a 26-line English request body to paste. The owner did not use it:

> 「なんで英語なん？しかもこんなに長文で指示する？」
>
> (Why is it in English? And why instruct it at such length?)

**That is the runbook's failure, not the owner's.** The completion definition says *the person
writes the request*, and a runbook that writes it for them is testing a different product. So the
owner typed one line, *「https://github.com/suisya-systems/rondo/issues/291 をやってほしい」*, and
rondo did the rest of what that line needed. The issue reader recorded #291 byte for byte in the
thread within the second (`D-0078`, closing lap 10's N-43). Fifteen seconds later the drafter wrote
a Japanese plan in the thread and a Japanese prompt for the worker (`D-0079`), and the prompt quoted
the issue.

The prompt is good as a description of the change. **As a definition of done it is incomplete**,
and N-47 is what that cost.

### The scope: the step that looked like a stop

The drafter's plan arrived at 21:54:55. The scope was approved at 22:03:23. Part of those 8.5
minutes was the owner reading the budget and raising it, which the runbook asked for. The rest was
the owner looking for the next step. **Set the scope** is a small outlined link at `h-7` and
`text-meta` (`src/access/web.tsx:1815`), drawn that way on purpose: the comment above it cites
`D-0082` rule 1, *"a way to another screen, and not a press"*. On a thread where nothing else is
waiting, it is the only thing to do, and it is the quietest thing on the screen. Lap 10's N-44 said
the same about the same link, one page design earlier.

### Try 1: the empty branch, caught

Try 1 ran for 86 s and stopped with **the three files edited and not committed**. The branch tip was
the base commit. Every reading saw this:

- the deterministic reading: *"the topic branch is at the same commit as refs/remotes/origin/main,
  so this lap left nothing"*, and *"the workspace holds 3 uncommitted path(s) ...:
  src/access/wording.ts, src/access/wording/en.ts, src/access/wording/ja.ts"* (`D-0060` working);
- the model reading, **2 blockers**: the branch holds no change, and *"the TypeScript invocation
  failed while fetching a missing tool, and no successful build or test run is shown"*.

The revise drafter's text (22:07:20) asked for exactly the missing things, in Japanese: commit the
three files and confirm them with `git log`; run the build and the tests *with the repository's own
scripts rather than fetching a missing tool*, installing first if needed; and if they cannot run,
say so rather than claim they passed. The owner sent it as drafted.

**This is the first real walk of Ask for a change** (#239's fourth press). It worked end to end: one
press, a second lap under the same approval (`scope_consumption` holds both admissions), cut from
the first lap's branch, and its own gate 2 min 10 s later.

### Try 2, the approval, and the sentence that said the opposite

Try 2 committed `cd10f7d`: `src/access/wording.ts (+6 -1922)`, `src/access/wording/en.ts (+960)`,
`src/access/wording/ja.ts (+976)`. That is the move the runbook's expected-file table predicted,
with no third module and no test change. Both readings raised nothing, and the owner approved.

The thread then said **「2 回目: 終わりました。変更は取り込み済みです。」**. That line is `evFinished`
(`src/access/page/words.ts:287`), drawn for every lap whose status is `closed`
(`src/access/page-logic/thread-events.ts:62`). **`closed` means the gate was answered.** It is also
what try 1 became when the owner asked for a change, so the code draws the same line for try 1,
whose change was never taken in. At that moment the host's log said the reverse: *"rondo did not close this run. Nothing
was pushed, nothing was landed"*. The English (*"Finished, and the work was taken in."*) is
ambiguous. The Japanese is not: 取り込み済み reads as *merged*.

### Publish, green, and the owner going to GitHub

The next step after approval was **Publish** (公開する), another small outlined link in the same
row. On this page *publish* means *push the branch and open a pull request*, and nothing on the
link says so. The press itself gave no sign that it was working. Then rondo's report arrived in
the thread in English (by design, `D-0055` rule 4), with the pull request's URL inside it. The owner
went to GitHub.

The green report came 1 min 57 s after the publish. It was accurate apart from one word (N-49), it
was in English, and it did not register as *green*. The owner merged #372 on GitHub and said they
would like to do that from rondo (N-54).

### The five-second redraw

Across the whole walk, the owner's strongest reaction was to the refresh, not to any single screen:

> 「折り畳み部分を開いていると5秒リロードで勝手に閉じてしまう」
> 「読んでる途中でリロードされて画面がリセットされてしまう。リロードじゃなくてDOM操作とかで対応するもんじゃないのか」
> 「スクリプト最小にした結果、ユーザー体験が最悪になったら意味がない」
> 「やっぱりリロード連発は悪、抜本対策してくれ」
>
> (A fold I have opened closes by itself on the five-second reload. / It reloads while I am reading
> and the screen resets. Isn't this something you handle with DOM operations, not a reload? / If
> keeping the script minimal makes the experience the worst it can be, there is no point. / Repeated
> reloading is bad after all. Fix it at the root.)

N-46 records what the code does and why the owner is right about the effect, even though the
mechanism is already a DOM swap and not a reload.

## 5. Cost

| | value | source |
|---|---|---|
| try 1 `lap_cost_usd` / turns / duration | **0.7916** / 17 / 86.3 s | `iteration` |
| try 2 `lap_cost_usd` / turns / duration | **0.8532** / 22 / 135.3 s | `iteration` |
| **laps, together** | **1.6448** | |
| drafter (scope) / revise drafter | 0.0911 / 0.0474 | journal |
| model reviewer | not read (`D-0065` rule 3.4) | |
| drafted scope | 3 laps, **7.50 USD**, 2.50 reserve, 3 rounds | `scope` `drafted-scope-...` |
| approved scope | the same, with **25 USD** | `scope` `scope-3097953f-...` |
| fence refusals | 3 on try 1, 3 on try 2, all `Bash` (`grep` / `sed` / `ls` / heredoc compositions, and one `npx biome` + `rm` + `npm run verify` chain) | `iteration.permission_denials` |

| | lap 8 | lap 9 (001 / 002) | lap 10 | **lap 11 (try 1 / try 2)** |
|---|---|---|---|---|
| `lap_cost_usd` | 1.040 | 1.884 / 0.456 | 8.46 | **0.792 / 0.853** |
| turns | 23 | 46 / 12 | 98 | **17 / 22** |
| duration | 131.7 s | 233.9 s / 69.8 s | ~13 min | **86.3 s / 135.3 s** |
| committed its work | yes | yes / yes | yes | **no / yes** |
| model reading | no | yes / yes | yes (1 major) | **2 blockers / nothing** |
| who drove it | worker | the person, terminal | the person, page | **the person, page, one line** |

The draft was off by a factor of about 4.5 in the other direction from lap 10, and the reason it
was $7.50 both times is the same: **each lap's environment is a fresh store**, and a drafted budget
is computed from the laps recorded in *that* store (`D-0071` rule 4.2). With none recorded, every
field falls to its cold start (`src/advisory/budget.ts:23`, `COLD_START_RESERVE_USD = 2.5`): one
plan times (2.50 + 2 later rounds x 2.50) = 7.50. Lap 10's $8.46 is in `$HOME/rondo-lap-10`'s store
and was never read here (N-50).

## 6. New findings

### N-45. The runbook wrote the request for the person, and the person refused it

The runbook's step 1 asked the owner to paste a 26-line English request that fixed every detail,
including AGENTS.md's order of work. The owner wrote one line in Japanese instead. The runbook was
testing *can rondo run a well-specified request*. The completion definition asks *can a person
write their own*. From lap 12 on, a runbook should give the request as the person would say it, and
keep any assertions about the work in the expected-file table, where the gate can check them.

### N-46. The five-second redraw takes back what the person is reading

With scripting on, the page does not reload. htmx `GET`s the view's own address every five seconds
and swaps `#ledger` in with `outerHTML` (`src/access/web.tsx:3281-3285`). But `#ledger` is **the
whole of the three faces**: the list, the thread and the material. So every five seconds everything
the person can see is replaced with fresh server markup, whether or not anything changed. The owner
experiences that as a reload, and in effect it is one:

- **Folds close.** `page/composer.js` reopens a fold after a swap only if the fold has an `id`
  (`reopen()`, around line 237). The thread's event folds, `ev-fold` and `ev-aside`
  (`src/access/page/events.tsx:110`, `:150`), have none, so they close on every swap.
- **The hydrated island is replaced.** `page/client/main.tsx` hydrates `[data-island]` once, on
  load, and nothing hydrates again after a swap. After the first swap, the faces are server markup
  with no React behaviour. **This was not observed on the screen.** It is what the code implies, and
  the issue should confirm it first.
- **The reading position moves** when the content above it changes height.

The decisions that put this in place are **`D-0054`** (*"the page may run one script, and it is a
poller and a morph rather than a framework"*; rule 1 decides liveness per view, rule 2 makes the
view's own address the request), **`D-0059`** R2 / R3 (htmx replaces idiomorph and `page/poll.js`,
`hx-select` of a whole-page response, *"no fragment endpoint"*), and **`D-0084`** rule 1 (*"htmx
keeps the five-second poll until the faces carry their own updating"*). On URL state: `D-0084` rule
2 and `page/client/main.tsx`'s header say *"the whole of the surface's state is still in the
address"*.

The replacement of a morph (`D-0054` rule 5, idiomorph, which *keeps an open element*; see the
table row *"a morph preserves an open element"* in `D-0054`) by a plain swap (`D-0059` R2) is the
step where a fold stopped surviving a redraw.

The owner's direction, recorded as they gave it: **minimal script is a means, not a goal.** If it
breaks the experience, the policy is what gets revisited.

### N-47. A request with no definition of done let the first try end with nothing on the branch

The drafter's prompt asked the worker to *confirm that the build and the tests pass as before*. It
did not ask it to **commit**, and it did not name the repository's order of work (`node vendor/pin.mjs
check`, `npm ci --ignore-scripts`, change, `npm run verify`, commit), which AGENTS.md sets out and the
runbook's body repeated. The plan's own `prompt` is a placeholder that says to replace it with the
request, so nothing else in the lap supplies a definition of done. Try 1 edited three files, did not
commit them, and failed its verification by fetching a tool that was not installed.

The readings and the revise drafter handled this well. It still cost a lap ($0.79), about 8 minutes
and a dispute the person should not have had to settle. **A lap is not done until its work is
committed and the repository's own verification has run**, and that should not depend on the person
or the drafter remembering to say so.

### N-48. The next step has no name, no weight, and no response when pressed

Three separate gaps, each measured:

- **No weight.** **Set the scope** and **Publish** are secondary links (`h-7`, `text-meta`,
  `src/access/web.tsx:1815`, `:1824`), because `D-0082` rule 1 treats *a way to another screen* as
  lighter than a press. On a thread where the next step is the person's, that rule makes the only
  way forward the faintest thing on the screen.
- **No name for what it does.** **Publish** (公開する) opens a pull request, and the link does not say
  so. The owner assumed there would be a button labelled *pull request*.
- **No response to a press.** Neither **Start this plan** nor **Publish** shows anything between the
  press and the next page. No script on the page sets `disabled` or `aria-busy`, or changes the
  label. The start press waits for the whole lap (runbook section 2). Lap 10's N-39 asked for this.
  The note that a second press joins the first was added, but the button itself still does nothing.

### N-49. The page does not say the result, and one line says the opposite

- **「終わりました。変更は取り込み済みです。」** is drawn for `closed`, which means *the gate was
  answered*. It appeared after approve, before anything was published, and on try 1 after **Ask for
  a change**. Of everything in this lap, this sentence is the one that says something false.
- **The publish and the green results are in the thread, in English, inside a paragraph of ids.** The
  pull request's URL is in the middle of *"Lap '...' was published: its branch was pushed, pull
  request <URL> was opened, and run '...' was closed completed."* `D-0055` rule 4 keeps recorded
  text in English. It does not stop the page from *drawing* a result in the person's language, with
  the pull request as a link and green or red as a state.
- **Approve, publish and merge are three different facts, and nothing on the screen tells them
  apart.** The owner could not say which of them had happened.
- A small inaccuracy in the green message: *"every one of them passed"* over 7 checks. The forge
  shows 6 `SUCCESS` and 1 `SKIPPED` (*a red nightly is an issue*). `src/access/forge.ts:787` counts
  `skipped` and `neutral` as passing on purpose, but the sentence should not say *passed*.

### N-50. The cost shown is one try's, and the budget draft cannot learn across environments

- The owner read the cost of the latest try, not the request's total. The request spent $1.645 over
  two tries, plus the drafters. The governance tier does sum a scope's spending
  (`src/access/page-logic/governance.ts`), so first establish which figure the owner read, then make
  the request's total the figure that is shown.
- The draft was $7.50 in lap 10 and in lap 11 because both were cold starts over an empty store (the
  arithmetic is in section 5). Lap 10 spent $8.46 on one try, and lap 11 spent $1.65 on two, so the
  same figure was wrong in both directions. The draft's `how:` line says where each number came from,
  but nothing says *this is a default, not a measurement*. Nothing carries measured laps into a new
  environment either.

### N-51. Notifications: both reached the owner once, and the pile in Windows is unexplained

Gate 1 reached the owner twice over, from the host and from the tab. For gate 2 both notifications
were sent, and the owner missed the tab's because they were on another page. The 20-plus
notifications stacked under Chrome are not explained by the code (measure 4), and they were not
reproduced. They are recorded, not filed.

### N-52. Three small leaks from rondo's side of the line

- **`proposal draft-24c87431-...`** in the thread. A proposal basis is printed as its store id
  (`src/access/page/vocabulary.tsx:382`). `D-0076` says rondo's identifiers never reach the person
  as themselves.
- **Setup ends with a terminal recipe** (`scripts/dogfood-env.sh:1118-1124`: `start`, `answer`,
  `answer --body=approve`, `publish`). Above it, setup says *"Everything below this line is the
  other way in: the terminal, for whoever installs and repairs rondo"*. On a first read, the commands
  still looked like next steps.
- **The pull request body names no issue.** `src/access/pull-request.ts` composes *What changed*,
  *How this got here* and the request fold, and nothing else. #291 therefore stayed open after #372
  merged. The request thread already holds the issue rondo read (`D-0078`'s `forge-...` message), so
  the body could say `Closes #291`. That changes what a merge does on the forge, so it is a decision
  and not a detail.

### N-53. The text cannot be made larger

The owner found the text small and wanted to be able to change its size. `D-0082` fixed one type
scale (*"a step larger than it was proposed"*). What the owner asks for is a control, not a larger
default.

### N-54. The owner wants to merge from rondo

After #372 went green, the owner went to GitHub to merge it and said rondo should be able to. That
touches `D-0064` rule 3.4 directly (the issue draft sets out both sides).

## 7. Compared with lap 10

| | lap 10 | **lap 11** |
|---|---|---|
| how the request was written | a long English body, pasted | **one Japanese line with a URL**. rondo read the issue and drafted the rest |
| ids the person handled | none | none, but one reached the screen (`proposal draft-...`) |
| tries | 1 ($8.46). **Ask for a change** out of budget | **2 ($0.79 + $0.85)**. **Ask for a change** walked for the first time, and it worked |
| draft against actual | $7.50 drafted, $8.46 on the first try | $7.50 drafted (raised to $25), $1.65 over both tries. The same cold start both times |
| terminal trips | 0 (the page ran in a terminal left open) | **0** (the word `rondo` and a service) |
| trips outside the screen | 2: "is it running?", "did it publish?" | **1: "was a PR made, and where?"** |
| "is it running?" from another tab | not answerable | **answerable** (the list and *work under way*) |
| the person's turn, when not looking | nothing reached them | **host and tab both reached them at gate 1**. Gate 2: sent, missed |
| words asked about | `完了: answered_and_forwarded`, raw `</details>`, `ログあり <path>` | `proposal draft-...`, **「変更は取り込み済みです」**, English reports, approve / publish / merge |
| where the person stopped | "what next", "is it running", "did that work" | **"what next" (twice), "did the press register" (twice), "was it made", "is it green"** |
| the person's verdict | *「控えめってのはなんの美徳でもないただの不便だよ」* | *「やっぱりリロード連発は悪、抜本対策してくれ」* |

**What lap 10 asked for and lap 11 shows fixed:** another tab can tell that work is running (N-39,
half of it). The issue is read for the lap (N-43). Nobody pastes the request. A person who is not
looking is told when it is their turn (#311). Publish no longer offers itself again; the lap-11
runbook states this and the code draws the link only for laps with no publish report
(`src/access/web.tsx:1788-1794`).

**What lap 10 asked for and lap 11 found still open:** the entrances are still quiet (N-44 is now
N-48). A press still gives no sign it was received (N-39's other half is now N-48). The page still
does not say the result of a publish in words the person reads (N-40's other half is now N-49).

**What is new:** the five-second redraw as the owner's first complaint (N-46), a lap that finished
without committing (N-47), and a sentence that says something false (N-49).

Lap 10's summary was *reachability is not legibility*. Lap 11 narrows it: **everything is
reachable, and rondo's judgement held at every step. What remains is the page telling a person, in
their own words, what just happened and what comes next, without taking away what they are
reading.**

## 8. Where the secretary's notes and the rows differ

The notes and the rows agree on everything that decides this record: the two lap ids, both gate
times, both host notification times, `cd10f7d`, the three files, the $7.50 draft raised to $25, #372,
and 7 checks. There are four differences:

1. **"The checks and the model review (2 blockers) saw it correctly."** The deterministic reading
   raised **3 points** (`concerns`), and the model reading raised the **2 blockers**. The notes
   merged the two readings.
2. **"CI green (7 checks)."** The forge's rollup is **6 `SUCCESS` and 1 `SKIPPED`**. rondo's
   message counted the skipped one as passing (N-49).
3. **The walk's start, 21:40.** The earliest row is 21:46:53, when the plan was recorded, and the
   service started at 21:48:28. Setup's first minutes leave no row, so 21:40 is neither confirmed
   nor contradicted.
4. **The merge.** The notes list it inside the walk, which they place as ending at 22:27. GitHub
   records it at **22:29:50**, after the green report at 22:26:48.

## 9. Candidate issues

Filing is the secretary's. The seven drafts map to the findings as follows. The three small leaks
in N-52 are placed where the fix would be made, not filed separately.

| # | issue | findings |
|---|---|---|
| 1 | Stop the five-second whole-ledger swap: keep what the person is reading, and revisit the minimal-script policy if that is what it takes | N-46 |
| 2 | Name the next step, give it weight, and respond to the press (set the scope / publish = open a pull request / start) | N-48, and setup's terminal recipe from N-52 |
| 3 | Say the result on the page: the PR was opened, where, and whether it is green, and stop saying 取り込み済み at the gate | N-49, the id leak and the closing keyword from N-52 |
| 4 | A lap's definition of done reaches the worker even from a one-line request: committed, and the repository's own verification run | N-47, N-45 |
| 5 | Show the cost of the whole request, and draft budgets that learn from recorded laps | N-50 |
| 6 | Let the person change the text size | N-53 |
| 7 | Merge from rondo: where `D-0064` rule 3.4's transition stands now that rondo reads CI (#310, PR #367) | N-54 |

## 10. Verification discipline, and what is left

- This document changes no source file and writes to no store. The store was opened with
  `node:sqlite`'s `DatabaseSync` in `readOnly` mode. The journal and pull request #372 were read,
  not written.
- Where this record cites a line of code, it was read at `27b778a` in this repository.
- **Not observed, only inferred from code:** that the hydrated island stops being hydrated after
  the first swap (N-46), and that `chime.js` does not ring again on a redraw (N-51). Both are said
  as inferences where they appear.
- Nothing here was taken from the workers' transcripts. The account of try 1's failed verification
  is the model reading's, with its bases (transcript events 51, 55, 63 and 87).
- **Left where it is:** #372 is merged and #291 was closed by hand. The approved scope ($25,
  of which the two laps spent $1.645) expires on its own clock (`expires_at_ms` 1790087040000,
  2026-09-22 14:24 UTC). Try 1's
  run was not published, so it is still open on continuo's side. The environment root
  `$HOME/rondo-lap-11` is the owner's to remove.
