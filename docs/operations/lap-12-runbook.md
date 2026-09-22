# lap 12 runbook -- is it done for now? The same question, after the page learned to say what happened

lap 11 walked a one-line Japanese request to a green pull request and judged rondo **not done
for now**. K1 to K3 were met. K4 was not: the person had to ask what the page meant at the moments
that mattered, and one sentence on the screen said the opposite of what had happened
([`lap-11-runbook.md`](lap-11-runbook.md), [`lap-11-dogfood.md`](lap-11-dogfood.md)). Since then,
every one of lap 11's candidate issues has been built (section 2).

**lap 12 asks the same question again.** The owner walks from request to pull request to merge on
the page alone. The secretary stands beside the walk and takes notes.

## What this lap measures

The completion definition is the operator's, quoted in `D-0075`, with K3 redrawn by `D-0080`:

> the person writes the request and rondo goes as far as opening the pull request; in between they
> only approve and answer disputes; they never open a terminal. It is unmet if a terminal is ever
> required, or if a word on screen has to be asked about.

- **K1:** request to pull request.
- **K2:** only approvals and disputes in between.
- **K3:** no terminal. Typing the one word `rondo` to start is inside the line (`D-0080`).
- **K4:** no word you have to ask about.

As in lap 11, this lap walks one repository. It cannot test `D-0081` rule 1.1, which judges K1 to
K3 across a person's day, and the record should not claim it.

Record these six things. The first five are recorded during the walk, the sixth after it:

1. **Times you opened a terminal**, apart from starting and stopping the page, and why. (K3)
2. **Times you left the screen**: going to GitHub, or reading a file or a log. lap 11 had one, to
   find out whether and where the pull request existed. (K4)
3. **Whether each notification reached you**: the host's program and the browser tab, recorded
   separately.
4. **Every question you asked the secretary, and what it was.** Each one counts as a place where
   the screen was not enough, whatever the answer was.
5. **Words you had to ask the meaning of**, exactly as the screen printed them. (K4)
6. **What the one pull request cost**, in rondo and in the organisation (claude-org-ja), side by
   side. This is not one of K1 to K4. The owner decided on 2026-09-22 to test the claim that the
   stack costs less than the organisation, and this lap is the first place to measure it. The
   secretary collects it after the walk, from the store and the host's log. It is not a terminal
   trip. How to read it is below.

For measure 4, check lap 11's eight questions against the screen. The question is whether the
screen now answers each one before you think to ask:

| lap 11 asked | where lap 12 should answer it (section 4) |
|---|---|
| what to press next, after the drafted plan | **次にやること** band (step 2) |
| whether it had stopped | the band, and the list row (step 2) |
| whether **Start** registered | the busy label and 受け付けました note (step 3) |
| whether the second notification had come | measure 3 (step 3) |
| what 「変更は取り込み済みです」 meant | that sentence is gone. See step 5 |
| what to press after approving | **プルリクエストを作る** (step 6) |
| whether the publish worked, and where | the result band (step 6) |
| whether it was green | **チェック** in the result band (step 7) |

### Measure 6: what one pull request cost, beside the organisation's

**The rondo side** has three parts. Read the store read-only (`node:sqlite`, `readOnly: true`), as
lap 11 did. Read the log with `journalctl --user -u rondo.service`. `$R/rondo-iterations.sqlite3`
is fresh, so every row in it belongs to this lap. The optional second request adds drafter rows,
but no laps.

1. **The worker, per try and in total.** Each finished lap's spend comes from continuo's
   `lap perform` document (`continuo D-1112`: `spend.total_cost_usd`, `num_turns`, `duration_ms`).
   rondo stores it on the `iteration` row as `lap_cost_usd`, `lap_turns` and `lap_duration_ms`
   (`src/access/conductor.ts`, `lapSpendFields`). A null there means continuo could not say. It is
   not a zero. The page's **全回の合計** is the sum of `lap_cost_usd` over the tries, so it should
   match the rows.

   ```sh
   STORE="$HOME/rondo-lap-12/rondo-iterations.sqlite3" node - <<'EOF'
   const { DatabaseSync } = require("node:sqlite");
   const db = new DatabaseSync(process.env.STORE, { readOnly: true });
   console.table(db.prepare(`SELECT id, status, model, lap_cost_usd, lap_turns, lap_duration_ms
     FROM iteration ORDER BY created_at_ms`).all());
   console.table(db.prepare(`SELECT kind, drafter, json_extract(snapshot, '$.cost_usd') AS cost_usd, created_at_ms
     FROM proposal WHERE kind IN ('split', 'revise_draft') ORDER BY created_at_ms`).all());
   console.table(db.prepare(`SELECT iteration_id, drafter, verdict FROM lap_reading WHERE graded IS NOT NULL`).all());
   EOF
   ```

   **Tokens: rondo does not record them for this lap's worker.** `src/continuo/protocol.ts`
   (`spendOf`) reads only the three keys above. A token count that continuo reports for a Codex
   worker (`continuo D-1114`) therefore never reaches the store. Record the dollars. If the
   worker was not Claude and `lap_cost_usd` is null, write "not reported". Do not write 0.
2. **The drafter and the revise drafter.** These are rondo's own model runs. They are not laps,
   and **全回の合計 leaves them out**. lap 11 took them from the log alone
   ([`lap-11-dogfood.md`](lap-11-dogfood.md) section 5: 0.0911 / 0.0474, "journal"). Each run's
   `total_cost_usd` is also kept in its `proposal` row's snapshot, as `cost_usd`
   (`src/access/drafter-host.ts`, `src/access/revise-draft/host.ts`). That is the second table
   the command above prints. Read both sources, and write down any row where they disagree:

   ```sh
   journalctl --user -u rondo.service | grep -E 'drafter  '
   ```

   Each line ends with `($0.NNNN)`, or with `(cost not reported)`. Only the dollars are kept. The
   drafter's token counts are not stored or logged anywhere.
3. **The model reviewer.** This is `codex exec` (`src/access/forge.ts`, `runReviewer`). rondo
   keeps neither its cost nor its tokens: `lap_reading` has no spend column, and the run is not
   logged. Write down how many model readings there were (the third table: `lap_reading` rows
   with a non-null `graded`), and write "not recorded" for the cost. lap 10 and lap 11 did the
   same (`D-0065` rule 3.4).

**The organisation side.** After the walk, give claude-org-ja one issue about the same size.
Delegate it the usual way, and let it run through to an open pull request. What makes it
comparable is that it is small in the same way #179 is (section 0): a change of a few lines in wording or a refusal message, with its tests, and one pull request. It
needs no decision first, and no design discussion. A documentation-only task is too small, and a
task that runs to several pull requests is too large. Write down which issue it was and why it
matched.

The owner's `~/.claude/settings.json` already sends Claude Code's OpenTelemetry. Read the token
metric `claude_code.token.usage` from wherever that setting sends it. The metric is split by
`type` (input, output, cache read, cache creation). Record those four counts separately, because
cache reads dominate the total and are billed differently. Count:

- **the worker's session or sessions** for that task. This is the main number.
- **the secretary's and the dispatcher's sessions** while the task ran, recorded on their own row.
  They are the organisation's equivalent of rondo's drafter. Other work runs in the same sessions,
  so this number is an upper bound.
- a Codex self-review, if the task's depth ran one. Its usage is not in Claude Code's OpenTelemetry.
  Record it from Codex's own output if there is any, and otherwise write "not recorded".

**The two sides use different units, and the record keeps both.** The organisation runs on a
subscription, so it spends no metered dollars per pull request. Compare it in tokens, and in how
much of the plan's usage limit the task used. Read the limit before and after the task. It is an
upper bound for the same reason as above. Claude Code's cost metric is an estimate at API prices.
Record it at most as a reference, not as the organisation's cost. rondo's worker bills in dollars,
and the dollars are what the store holds. **Compare the two in tokens per pull request where both
sides have them. Compare rondo in dollars as well.** If the only rondo number is dollars, the
tokens column stays empty on that side. The record then says the two cannot be put on one scale
yet, and that gap is itself a finding. Do not convert between the units.

## 0. This lap's request

**The owner chooses.** Write it the way you would say it, in one line of Japanese. rondo reads the
issue and adds the definition of done itself (`D-0089`). The runbook does not supply a
specification. That was lap 11's N-45.

For example:

```
https://github.com/suisya-systems/rondo/issues/200 をやってほしい
```

Candidates. Each is small enough to finish in one lap, and none of them works against the
completion definition. **Each issue offers more than one way to do it.** If the drafter asks
which one you mean, that is a dispute, and K2 allows it. Answering it tests the drafter's question.

| issue | what it is | where the change should land | why it fits, and the risk |
|---|---|---|---|
| [#200](https://github.com/suisya-systems/rondo/issues/200) *A gate report is lost if the process dies between the gate commit and the report write* | the issue recommends option (b): `resume()` always tries to write the report, and a duplicate id counts as already reported | `src/access/conductor.ts` (`withGateReport`, `resume`), `src/store/sqlite.ts` (a duplicate from `insertMessage` returned as its own outcome), tests | the recommendation is already written, and the report id is already deterministic. The risk is the store's return type: a change there spreads to every caller |
| [#179](https://github.com/suisya-systems/rondo/issues/179) *An unreadable git status still lets publish through under --despite-review* | the issue's second option: keep the rule, and make the refusal text say the uncommitted state is unknown. The first option is to refuse it outright | `src/access/forge.ts` (`inspectLapWork`), the publish screen's wording (`src/access/wording/en.ts`, `ja.ts`), tests | the second option is a wording change of a few lines. The first changes a documented rule. If the drafter picks the first without asking, that belongs in the record |
| [#305](https://github.com/suisya-systems/rondo/issues/305) *The page names a repository only where two things would otherwise be indistinguishable* | render a repository name only where two rows would otherwise look identical, in the person's words | `src/access/web.tsx` or `src/access/page/*.tsx`, `src/access/page/words.ts`, `src/access/wording/en.ts` and `ja.ts` | a rendering change, and it touches today's #383 work. The risk is that this lap's store holds one repository, so the result cannot be seen on the page being walked. "In their own words" is also a wording judgement |

**Passed over:** #36, #228, #286, #313 and #322, because each needs a decision first. #282 and #284
depend on the resident tick. #89 and #190 are measurements. #239 is a tracker. #287, #298 and #329
are decision records.

**Whatever the choice, the lap does not follow the issue text.** The expected-file column above is
material for the gate. Treat it as a list of files to explain, not a pass/fail filter
([runbook conventions 2](runbook-conventions.md)).

## 1. The environment -- a fresh `~/rondo-lap-12`, and the switch from lap 11

`~/rondo-lap-11`, and the rondo serving it (`rondo.service`, open in the owner's pane), **stay as
they are until the walk**. lap 11's environment cannot be reused. Its catalog has no
`allowed_bash`, which `D-0094` now requires on every project. It also carries continuo
`fcf86eb`, while the pin is now `b7162ae`.

**Run everything in a normal terminal, outside any Claude Code sandbox.** Inside one, the
environment root in your home directory is read-only, `systemctl --user` is refused, and a lap's
worker cannot start its own sandbox. lap 12's preparation hit the first of these: this runbook
was written from inside a worker's sandbox, and the environment could not be created from there.

### 1a. Before the walk, at any time -- this does not touch lap 11

```sh
unsetopt correct correct_all
R=$HOME/rondo-lap-12; mkdir -p "$R"
git clone https://github.com/suisya-systems/rondo.git "$R/rondo-host"
git clone https://github.com/suisya-systems/rondo.git "$R/rondo-gh"
cd "$R/rondo-host"
node vendor/pin.mjs check && npm ci --ignore-scripts && npm run build
cp ~/.local/bin/rondo "$R/lap-11-word.bak"
cp ~/.config/systemd/user/rondo.service "$R/lap-11-rondo.service.bak"
```

The last two lines keep lap 11's word and unit, so that section 6 can put them back.

### 1b. The switch, right before the walk -- this replaces lap 11's host

```sh
unsetopt correct correct_all
R=$HOME/rondo-lap-12; cd "$R/rondo-host"
./scripts/dogfood-env.sh --root "$R" --target-repo "$R/rondo-gh" --forge-repo suisya-systems/rondo --language ja
```

**Running setup is the switch.** There is one word and one service per machine. Setup rewrites
`~/.local/bin/rondo` and `~/.config/systemd/user/rondo.service` onto `$R`, and its
`systemctl --user try-restart rondo.service` replaces the running lap 11 host there and then. It
does not start a stopped one. Setup has no option that builds an environment without switching.
That is why 1a stops before setup, and why this is a finding (section 9).

`--language ja` answers setup's one question in advance. lap 11 answered it the same way.

Check setup's output for these lines:

| where | what to see | what it proves |
|---|---|---|
| `== continuo` | `verified @suisya-systems/continuo 0.0.0 (rev b7162ae49f1ea381e33a070de364a08dda400794)` | the pinned build, not lap 11's `fcf86eb` |
| `== Control plane` | `created .../control-plane.sqlite3` | created fresh by that build |
| `== Catalog` | `the worker may run: [...]`, with a non-empty list | `D-0094`: the project carries `allowed_bash` |
| `== Language` | `the page and the word speak 'ja'` | |
| `== Start command` | the word's path and the unit's path. Then *"the service is installed; the word starts it"* and *"the host keeps running after the terminal is closed"* | if it printed `systemctl ...` / `loginctl ...` lines instead, run them as printed. That is setup, not the walk |
| `== Store` | one `setup-plan` row recorded | the page has a plan to offer |

Then check these three things. They are setup checks, not walk trips:

```sh
grep -n allowed_bash "$R"/catalog/*.toml
node "$R"/continuo-b7162ae49f1ea381e33a070de364a08dda400794/dist/cli.js db verify --db "$R/control-plane.sqlite3"
grep -n 'RONDO_NOTIFIER\|RONDO_OPERATOR_LANGUAGE\|WorkingDirectory' ~/.config/systemd/user/rondo.service
```

- The catalog has an `allowed_bash = [...]` line.
- `db verify` exits 0. It checks integrity and that the database is at head for this build.
- The unit has `RONDO_NOTIFIER=/home/happy_ryo/.local/bin/wsl-notify-send.exe` (lap 11 used the
  same program), `RONDO_OPERATOR_LANGUAGE=ja`, and `WorkingDirectory=$HOME/rondo-lap-12/rondo-host`.
  If `RONDO_NOTIFIER` is missing, setup did not find the program on `PATH`, and the host's half of
  measure 3 cannot happen. Write that down before you start.

| Path | What it is |
|---|---|
| `$R/rondo-host` | rondo itself, built. The service serves the page from here |
| `$R/rondo-gh` | the repository the lap changes. `origin` is `suisya-systems/rondo`, so publish and merge reach a real forge |
| `$R/catalog/rondo-gh.toml` | the catalog layer, with `allowed_bash` |
| `$R/env.sh` | only for section 5's last resort. The walk does not use it |
| `$R/workspaces/` | where the lap's work appears |

## 2. Before you start

- **Money and the outside world.** Three presses spend money: **この作業を始める** / **作業を始める**
  and **変更を依頼する**. The drafter also costs a little, with no press: after you send a request or
  a reply, a model reads the thread. **Two presses leave this machine:**
  - **プルリクエストを作る** pushes a branch to `suisya-systems/rondo` and opens a real pull request
    under your name. In lap 11 this press was labelled 公開する.
  - **プルリクエストをマージする** is new (`D-0091`). It merges that pull request into `main`,
    through your own `gh`, the way the repository allows. **It cannot be undone from the page.**
    Merging is outside K1, which ends when the pull request is opened. This lap walks it because
    the owner asked for it (lap 11's N-54).
- **What changed on the page since lap 11.** Each row is something to check during the walk:

  | change | where you see it (Japanese page) | lap 11's finding |
  |---|---|---|
  | the poll merges instead of redrawing everything (#381) | an open fold stays open, and the screen does not jump while you read | N-46 |
  | the next step is named, weighted, and shows that a press was received (#375) | the **次にやること** band in the thread, with a filled button. After a press, the button reads *作業を始めています…* / *プルリクエストを作っています…*, followed by a note that begins *受け付けました。* | N-48 |
  | the page says the result (#376) | a result band: **承認済み**, *まだ公開していません（プルリクエストはありません）。*, *プルリクエストを開きました:* **#N**, **チェック** 緑 / 赤 / 実行中 / 報告なし, and *マージはあなたが行います。チェックが通れば、このページからマージできます。* | N-49 |
  | a definition of done is added to every lap (#377, `D-0089`) | the scope screen: **完了の定義 (rondo がどの作業にも付けます)**, three lines (commit, run the repository's own install and verification, never say it passed when it did not), and *作業者に送る文面 (英語)* | N-47 |
  | cost for the whole request, what is held back, and a note on the default (#378) | the right face: **全回の合計**, one line per try, *... を確保*. The scope screen says *ここではまだ周回が記録されていないため、この値は rondo の既定値で、測った値ではありません。* | N-50 |
  | text size (#379) | **文字の大きさ**: 標準の文字 / 大きい文字 / もっと大きい文字 | N-53 |
  | merge from the page (#380, `D-0091`) | **プルリクエストをマージする**. It is drawn only when the checks are green on the latest commit and nothing is waiting on you | N-54 |
  | a repository rondo does not work in (#383, `D-0090`) | the band says the request names a repository rondo does not work in yet, with **このリポジトリを追加する** | new |
  | which answer the gate was given is recorded (#385, `D-0092`) | after approve: *承認しました。まだ公開していません（プルリクエストはまだありません）。* After a change: *変更を頼みました。次の回でやり直します。* 「取り込み済み」 no longer appears | N-49 |
  | CI is judged by continuo (`D-0095`) | the result band's **チェック**. When rondo cannot read the checks, it says so and never calls that 赤 | new |

- **The budget is a cold start again.** `$R` is a fresh store, so the drafted budget will be
  rondo's default, probably $7.50, and the screen now says so. lap 11 spent $1.65 on two tries. A
  small issue should fit. If you raise it anyway, record that as a decision.
- **The browser has already decided about notifications for `127.0.0.1:7333`,** from lap 11, so
  the **自分の番になったら、このタブで知らせる** button may not appear. Check the site's permission in
  the browser's settings, and write down what it was.
- **rondo's own reports in the thread are still recorded in English** (`D-0055` rule 4). The result
  band is what should say the result in Japanese. If you read the English report instead of the
  band, write that down.
- `(node:NN) ExperimentalWarning: SQLite is an experimental feature` in a terminal is normal.

## 3. Start the page

After 1b, in any terminal:

```sh
rondo
```

It starts the service if it is stopped, waits for the page, and opens it. If lap 11's page was
open, reload the tab: the same address now serves lap 12. **Type nothing after the word.** In
the header, check that your name is on the right, and try **文字の大きさ** once.

## 4. The walk

Nothing below needs a terminal. If a step seems to, the runbook is wrong. Count it.

### Step 1. Write the request

In the empty centre (*何を頼みますか* on the Japanese page), write your one line and press **送信**.
Within about a minute, the drafter either drafts a scope or asks you something. If it asks, the
box becomes **この線を止める** / **続ける**. Answer in your own words and press **続ける**. That is a
dispute, and it is also your turn, so it counts for measure 3.

### Step 2. The scope

The thread's **次にやること** band should say *rondo が作業の範囲を提案しました。確認して承認すると、作業を始められます。*
and offer the way in. **Record whether you knew what to press without asking.** lap 11's
**範囲を決める** was the quietest thing on the screen.

On the scope screen, read the **完了の定義** block and the cost, with its note on the default.
Then press **承認する**. The screen comes back headed **N前に承認済み**.

### Step 3. Start the work, and look away

Press **この作業を始める** once. **Record what the button did.** It should change to
*作業を始めています…*, followed by *受け付けました。いま作業が動いていて、…*. That tab keeps
loading until the lap stops at its gate. Leave it.

Measure 3: open a second tab at `http://127.0.0.1:7333/` and click the request in the list. It
should show that the work is running. Then stop looking at the page. When it is your turn, *rondo
があなたの答えを待っています。* should reach you twice: from the host (`wsl-notify-send`, within
about a minute) and from the tab. Record each one, with its time.

### Step 4. Read the gate

As in lap 11, the right face shows **この確認の材料** and **この依頼の取り決め**. Check the changed
files against the candidate's expected-file column (section 0). On **この依頼の取り決め**, read
**全回の合計**: after a second try, it should be the sum of both.

### Step 5. Answer the gate

**承認する**, or **変更を依頼する** (this spends money). You can write what you checked in
*確認したこと*.

**Record the line the thread draws straight after approve.** It should read *承認しました。まだ公開していません（プルリクエストはまだありません）。*,
and the result band should say **承認済み**. lap 11 read 「変更は取り込み済みです」 at this
moment. If anything says *取り込み* before a merge, that is a K4 failure.

### Step 6. Open the pull request -- this one leaves the machine

The band should now say *作業は承認済みです。プルリクエストを作ると、ブランチを push してレビューに出します。マージはしません。*
Press through to **この作業のプルリクエストを作る**, read the title and body (**Preview** / **Raw**),
and press **プルリクエストを作る**. The button should change to *プルリクエストを作っています…*.

**Record whether you could tell that the pull request exists, and where, without leaving the
page.** The result band should read *プルリクエストを開きました:* **#N**, as a link. lap 11 went
to GitHub at this point.

### Step 7. The checks

rondo reads the checks once a minute, through continuo (`D-0095`). The result band's **チェック**
moves from 実行中 to 緑 or 赤. A line in the thread reads *#N のチェック: 緑（N 件すべて通過）*, or
with skipped checks counted separately. **This does not notify you.** Come back to the page
yourself. **Record whether you felt you had to open GitHub.**

### Step 8. Merge from the page -- this one cannot be undone

Once the checks are green and nothing is waiting on you, the band says *プルリクエストの最新のコミットでチェックが緑になり、…*
and offers **プルリクエストをマージする**. Merge only if you would merge this pull request on GitHub.
The button changes to *マージしています…*. Afterwards, the result band should say
*main にマージしました*. **Record whether the page told you it was merged.** Merging is outside K1,
so record it on its own row.

### Optional: a repository rondo does not work in (#383)

If there is time left, send a second request that names an issue in another repository, for
example `https://github.com/suisya-systems/continuo/issues/<N> を見てほしい`. The band should
say that rondo does not work in that repository yet, and offer **このリポジトリを追加する**.
**Record whether the sentence told you what the button would do.** Pressing it copies the
repository onto this machine. That costs no money, but do not start any work there in this lap.

## 5. When it stops

The same as lap 11's section 5. For a lap that never comes back, it takes a terminal, and it counts
under measure 1:

```sh
unsetopt correct correct_all
cd "$HOME/rondo-lap-12/rondo-host"
. "$HOME/rondo-lap-12/env.sh"
node bin/rondo.mjs inbox --actor-id "$RONDO_APPROVER"
node bin/rondo.mjs abandon --iteration-id lap-THE-UUID --reason "did not come back"
```

## 6. Clearing up, and going back to lap 11

- **Stop the page:** `systemctl --user stop rondo.service`. That is stopping, which measure 1 does
  not count.
- **Back to lap 11's host**, with the files 1a kept:

  ```sh
  R=$HOME/rondo-lap-12
  command cp -f "$R/lap-11-word.bak" ~/.local/bin/rondo
  command cp -f "$R/lap-11-rondo.service.bak" ~/.config/systemd/user/rondo.service
  systemctl --user daemon-reload && systemctl --user restart rondo.service
  ```

  Re-running lap 11's own setup would also switch back, but it writes into `~/rondo-lap-11`: a new
  plan row and a rewritten catalog.
- A lap you did not publish exists only as a branch in `$R/workspaces/`. `$R` is yours to delete
  once the service has stopped serving from it.

## 7. What the record is compared against

| | lap 10 | lap 11 | **lap 12** |
|---|---|---|---|
| the request | a long English body | one Japanese line (the runbook's body was refused) | one Japanese line, written by the owner |
| terminal trips | 0 | 0 | measure 1 |
| trips outside the screen | 2 | 1 (GitHub: was a PR made, and where?) | measure 2 |
| notifications | none reached anyone | host and tab both, at gate 1 | measure 3 |
| questions to the secretary | not counted | 8 | measure 4 |
| words asked about | 3 | 4, including 「変更は取り込み済みです」 | measure 5 |
| merge | on GitHub | on GitHub | step 8 |
| cost of the pull request | not compared | laps $1.645 (two tries), drafters $0.1385, reviewer not read | measure 6, beside the organisation's |

## 8. The record sheet

| Step | Start | End | Thought | Terminal | Left the screen | Asked | Where it snagged |
|---|---|---|---|---|---|---|---|
| 1b setup + `rondo` | | | | (not counted) | | | |
| 1 request (+ drafter question) | | | | | | | |
| 2 scope | | | | | | | |
| 3 start, look away | | | | | | | |
| 4 read the gate | | | | | | | |
| 5 answer | | | | | | | |
| 6 open the pull request | | | | | | | |
| 7 checks | | | | | | | |
| 8 merge | | | | | | | |
| optional: another repository | | | | | | | |

**Measure 1: terminal trips**

| # | when | what you typed | why | could the screen have said it? |
|---|---|---|---|---|
| | | | | |

**Measure 2: trips outside the screen**

| # | when | where you went | what you wanted to know |
|---|---|---|---|
| | | | |

**Measure 3: notifications**

| turn | gate opened (thread time) | host: arrived? when? | tab: arrived? when? | how you noticed |
|---|---|---|---|---|
| first gate | | | | |
| a question / second gate | | | | |

- Notification permission for `127.0.0.1:7333` before the walk:

**Measure 4: questions to the secretary**

| # | when | the question | answered by the screen afterwards? | one of lap 11's eight? |
|---|---|---|---|---|
| | | | | |

**Measure 5: words asked about** (exactly as printed)

| # | where | the words | what you thought | what it meant |
|---|---|---|---|---|
| | | | | |

Overall:

- Issue walked:
- Send to pull request / to green / to merged:
- Decisions (scope, gate, a question, publish, merge), and whether each was an approval or a dispute:
- **全回の合計** against the approved scope:
- **K1 to K4, each met or not, with the row that decides it.**

**Measure 6: cost per pull request** (empty cells are "not recorded", never 0)

| | rondo (this lap) | organisation (claude-org-ja) |
|---|---|---|
| the work | this lap's issue and pull request | issue #___, pull request #___, and why it matched #179's size |
| worker, per try | `lap_cost_usd` / `lap_turns` / `lap_duration_ms` for each `iteration` row | tokens for each worker session: input / output / cache read / cache creation |
| worker, total | the sum of `lap_cost_usd` (and whether it matches **全回の合計**) | the sum of the four token counts |
| worker tokens | not recorded by rondo (`spendOf`), unless there is another source, named here | the four counts above |
| drafting | drafter and revise drafter `cost_usd`, from the `proposal` rows and the journal, and whether the two agree | the secretary's and dispatcher's tokens while the task ran (an upper bound) |
| model review | number of model readings; cost "not recorded" | Codex self-review usage, or "not recorded" |
| usage limit | not applicable (metered) | the plan's usage before and after the task (an upper bound) |
| **per pull request** | **dollars**, and tokens if any | **tokens**, and the share of the usage limit |

- The claim tested: does the stack cost less than the organisation for one pull request of this
  size? Say which unit the answer rests on, and what could not be compared.

## 9. Found while preparing this lap

- **Setup cannot build an environment without switching the machine to it.** `dogfood-env.sh`
  always writes the word and the unit (it does not pass `start-command.sh`'s `--bin-dir` /
  `--unit-dir`), then runs `systemctl --user try-restart rondo.service`. With lap 11's host
  running, the only way to prepare lap 12 in advance was to stop before setup (1a). The continuo
  build, the control plane, the catalog and the store are therefore all created at the switch.
- **Setup cannot run from inside a Claude Code sandbox, even to prepare.** The root in the home
  directory is read-only there. This is the same limit lap 6 and lap 7 met with `systemctl`. The
  worker that wrote this runbook could not create `~/rondo-lap-12`, so the checks in 1b have not
  been run yet. They are the first thing to read at the switch.
