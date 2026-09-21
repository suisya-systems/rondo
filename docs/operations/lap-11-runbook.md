# lap 11 runbook -- is it done for now? One lap walked against the completion definition

lap 10 walked the whole arc on the page and found that the page could reach every step and would
not tell you what was happening ([`lap-10-runbook.md`](lap-10-runbook.md),
[`lap-10-dogfood.md`](lap-10-dogfood.md)). The screen never said the work was running or that the
publish had worked, so twice a hand went outside the screen. Since then the page has been rebuilt
around a request's thread (D-0083, D-0084), rondo starts with one word (D-0080), and it tells a
person who is not looking (#311).

**lap 11 is the lap that decides whether rondo is done for now.** It is walked the same way as lap
10, with the same kind of request, so the two records can be compared. This time the question is
not "is the page smaller than the command line?". It is the completion definition itself.

## What this lap measures

The completion definition is the operator's, quoted in `D-0075` (DECISIONS.md, "The completion
definition it is judged by"), with K3 redrawn by `D-0080`'s annotation on it:

> the person writes the request and rondo goes as far as opening the pull request; in between they
> only approve and answer disputes; they never open a terminal. It is unmet if a terminal is ever
> required, or if a word on screen has to be asked about.

- **K1:** request to pull request.
- **K2:** only approvals and disputes in between.
- **K3:** no terminal. Since `D-0080` this reads as *nothing the person has to remember at a
  start*: typing the one word `rondo` is inside the line.
- **K4:** no word you have to ask about.

`D-0081` rule 1.1 judges K1 to K3 across a person's day, not inside one repository. This lap walks
one repository, so it cannot test that part, and the record should say so rather than claim it.

Record these five things as you go. They are what the record sheet (section 8) asks for.

1. **Times you went to a terminal**, apart from starting and stopping the page, and why each time.
   Typing `rondo` is starting. `systemctl --user stop rondo.service` at the end is stopping.
   Everything else counts: setup run again, `journalctl`, `gh`, reading a file, `abandon`. (K3)
2. **Words you had to ask the meaning of**: any wording on the screen where you could not tell what
   it referred to. Write the word exactly as the screen printed it. (K4)
3. **Places you stopped to think**: your hand came off the mouse to decide something or to go and
   look something up. (K2: was it an approval or a dispute, or something else?)
4. **Whether a notification actually reached you**, from the host's notification program and from
   the browser tab, each recorded separately. Step 3 below sets up a moment when it is your turn and
   you are not looking at the page, so that this gets tested at least once.
5. **Times you asked the secretary standing beside the walk, and what you asked.** Someone stands
   beside the walk, as in lap 10, and may answer. But **every question you ask them counts as a
   place where the screen alone was not enough**, whatever the answer turned out to be. Write down
   each one. If the answer came from the screen afterwards, write that down too.

**The one thing the terminal still does is start the page and stop it.** If a step here asks you to
open a terminal for anything else, that is the runbook being wrong, not you. Count it, and it goes
in the record as the runbook's failure.

## 0. This lap's request: rondo#291

**Chosen: [rondo#291](https://github.com/suisya-systems/rondo/issues/291)
"Split the wording catalogue into one file per language, so no one writes Japanese while reading
English"** (the owner confirmed it through the secretary)

Why this one, by lap 10's criteria:

- **Nothing in it waits on a judgement.** The issue fixes the shape itself: `wording/en.ts` and
  `wording/ja.ts`, each a complete `Chrome`, with the type and the selection left in `wording.ts`.
  It also says **"a move only: no string changes in the same commit"**. There is nothing for the lap
  to argue about, so the lap spends its money on the walk and not on a design argument.
- **It is as close to a rendering change as a change can be.** Nothing the page says should change
  by a single byte. That gives you a check you can do on the screen: after it is merged, the page
  reads exactly as it did.
- **It stands on today's work.** `src/access/wording.ts` is the file #369 rewrote this morning
  ("the Japanese page says rondo's own sentences in Japanese"), and at 3,000 lines it is the file
  the issue says has outgrown reading. The gate will show a large but mechanical diff. That tests
  two things that landed today: *What it read, and what it did not*, now drawn open (#362), and the
  card for files beyond the claim (#365). Two new files appear next to the one file the request
  names.
- **Passed over:**
  - [#305](https://github.com/suisya-systems/rondo/issues/305) (name a repository only where two
    things would otherwise look the same). It is rendering, but this lap's environment holds one
    repository, so the correct result is invisible on the page you walk. "In their own words" is
    also a wording judgement the lap would have to make.
  - [#228](https://github.com/suisya-systems/rondo/issues/228) (`revise` defaulting its scope). Its
    own body says it needs a decision first.
  - #179, #286, #310, #313, #320 and #322 are open questions about what to decide, not changes to
    build.
  - #341 (finding the seams in the three largest files) is a refactor whose shape is still to be
    found.
  - #298 and #329 are decision entries.
  - #239 is the known-limit tracker you walk past (section 2).
- **The cost risk, said plainly.** A 3,000-line move is cheap to describe and may not be cheap to
  do. The lap has to carry about 1,800 lines into two new files and prove none of them changed, and
  the model review reads a large diff. lap 10's single lap cost $8.46 against a $7.50 draft. Read
  the scope's cost before you approve it (step 2).

## 1. The environment

Nothing is standing yet. These commands build it. None of them costs money or touches GitHub, and
any of them is safe to run again. As in lap 10, the environment root lives in your home directory,
so the lap can be walked across two days.

**Run them in a normal terminal, outside any Claude Code sandbox.** Inside one, `systemctl --user`
is refused and a lap's worker fails to start its own sandbox with `EPERM` (lap 6 and 7, N-21).

The first line turns off zsh's interactive spelling correction ([runbook conventions
1](runbook-conventions.md)). The reason is written here and not as a comment in the block, because
a `#` followed by `(...)` breaks the line under zsh's default options.

```sh
unsetopt correct correct_all
R=$HOME/rondo-lap-11; mkdir -p "$R"
git clone https://github.com/suisya-systems/rondo.git "$R/rondo-host"
git clone https://github.com/suisya-systems/rondo.git "$R/rondo-gh"
cd "$R/rondo-host"
node vendor/pin.mjs check && npm ci --ignore-scripts && npm run build
./scripts/dogfood-env.sh --root "$R" --target-repo "$R/rondo-gh" --forge-repo suisya-systems/rondo
```

What is new since lap 10, all of it in that last line:

- **`--forge-repo suisya-systems/rondo`** replaces lap 10's `rondo web --repo`. The forge repository
  is now recorded onto the plan, not given to the host (`D-0081` rule 3.2). Without it, the publish
  screen says the lap *"does not say where its pull request would be opened"*, and the only fix is
  to run this line again.
- **Setup asks one question: which language you read** (#352, `== Language` in its output):
  `1) English` / `2) 日本語`. It remembers the answer in `$R/operator-language`, and the page, the
  word and the notifications all use it. Answer the way you actually read. The step labels below
  give the Japanese wording beside the English.
- **Setup finds a notification program** (#311). Look for one of these two lines in its output:
  - a path ending in `notify-send` or `wsl-notify-send.exe`. On this machine (WSL) it should be
    `wsl-notify-send.exe`.
  - *"nothing here shows a notification: rondo will wait to be looked at"*. If you see this, the
    host's half of measure 4 cannot happen. Write that in the record sheet before you start.
- **Setup writes the word `rondo` into `~/.local/bin` and installs the user service `rondo.service`**
  (`D-0080`). Look for *"the service is installed; the word starts it"* and *"the host keeps running
  after the terminal is closed"*. If it printed `systemctl --user ...` or `loginctl ...` lines
  instead, run them as printed. That is setup, not the walk.
- **There is one word and one service per machine.** If a rondo from another environment is running
  (a lap 10 host, a working setup), this setup rewrites the word and restarts the service onto
  `$R`. Running setup from that other environment again puts it back.

`--iteration-id` is not on the line, for the same reason as in lap 10: the page names each lap
itself.

| Path | What it is |
|---|---|
| `$R/rondo-host` | rondo itself, built. The service serves the page from here |
| `$R/rondo-gh` | the repository the lap changes. Its `origin` is `suisya-systems/rondo`, which is why publishing reaches a real forge |
| `$R/env.sh` | `RONDO_CONTINUO_CLI`, `RONDO_STORE`, `RONDO_APPROVER`. **The walk does not use it.** Only section 5's last resort does |
| `$R/operator-language` | the language you answered, as a plain file |
| `$R/plan-rondo-gh.json` | the plan, recorded into the store the page reads as setup's last step (`D-0075`). It is never pasted |
| `$R/workspaces/` | where the lap's work appears, in `iter-<lap id>`, once the lap has started |

## 2. Before you start

- **Money and the outside world.** Three presses spend money: **Start the work** / **Start this
  plan** (作業を始める / この作業を始める) and **Ask for a change** (変更を依頼する). One press leaves
  this machine: **Publish** (公開する), which pushes a branch to `suisya-systems/rondo` and opens a
  real pull request under your name. **There is also one cost with no press: the drafter.** After
  you send a request or a reply, the host has a model read the thread in the background, and the
  model drafts a scope or asks a question (step 1). That sends the thread to a model and costs a
  little, much less than a lap. It publishes nothing. Reading, approving a scope and answering a
  question cost nothing themselves.
- **After Publish, rondo reads the pull request's checks through your `gh` (#310, PR #367).** This
  is a read only. It writes one message into the request's thread when the checks come back green
  or red. It does not merge, comment or retry.
- **What changed on the page since lap 10**, so that you do not go looking for lap 10's screens:

  | lap 10 | lap 11 |
  |---|---|
  | `rondo web --repo ...` in a terminal left open, ctrl-c to stop | the word `rondo`. The terminal may then be closed. Stop with `systemctl --user stop rondo.service` |
  | a summary screen, a separate gate screen | one screen with three faces: the list on the left, a request's thread in the middle, its material on the right (`D-0083`) |
  | the gate's readings in a row | the right face has two tiers: **What this rests on** (この確認の材料) and **What was agreed for this** (この依頼の取り決め) (#350) |
  | the answer box beside the readings | the answer box in the thread, above the reply box (#358) |
  | a plain **approve** plus a fold for **Ask for a change** | two presses of the same size. The filled one is what rondo recommends. The other one is the exception (#351) |
  | nothing about files outside the claim | **Beyond the files this work keeps** (押さえているファイルの外に出たもの) (#365) |
  | *What it read, and what it did not* folded, in English | drawn open, and in Japanese on the Japanese page (#362, #369) |
  | the pull request body folded, raw `</details>` showing | **Preview** / **Raw**, always open (#360) |
  | Publish re-offered itself after succeeding | the link is gone, and a message from rondo in the thread says what was published |
  | nothing told you when it was your turn | the host runs the notification program once per episode, and the tab rings if you allowed it (#311) |

- **One known limit still stands:** [#239](https://github.com/suisya-systems/rondo/issues/239).
  Since PR #366, CI drives **Start the work**, **approve** and **Ask for a change** for real, over a
  real continuo with only the worker replaced by a stand-in. **Publish** is still covered only as
  far as the push. The pull-request leg and the run close have no end-to-end test, and this lap is
  their second walk ever. A publish that goes wrong here is more likely to be news than a bug you
  caused.
- **Known before you start, and left as they are for this lap.** If one of
  these stops you, it still counts in the record sheet. Knowing about it in advance does not make
  the screen say it.
  - **The tab you press Start in keeps loading until the lap reaches its gate**, which may take
    tens of minutes. The press waits for the whole lap. The note beside the button now says a second
    press joins the first (lap 10's N-39), and other tabs show the work running.
  - **rondo's own report messages in the thread are in English**, for example *"Lap '...' was
    published: ..."* and the green / red check messages. This is by design: they are recorded text,
    and `D-0055` rule 4 keeps recorded text English whatever the page's language, so the ledger
    never holds one claim in two versions. The lap measures it rather than fixing it first: **if
    you had to ask what one of them meant, write it under measure 2.**
  - **The page never shows a lap's id**, and the one thing that needs it -- `abandon`, for a lap
    that never comes back -- is a terminal command. Section 5 says how to find the id if it comes
    to that.
  - **[`rondo-cli.md`](rondo-cli.md) contradicts itself about repositories.** Lines 88-93 say a
    second repository is setup run again under the same `--root` (`D-0081`), and lines 101-104 still
    say one root is one repository. `D-0081` is the current one. This lap uses one repository, so it
    does not hit this, but do not take the older sentence as a reason for a second environment.
- **`(node:NN) ExperimentalWarning: SQLite is an experimental feature`** in any terminal output is
  normal.
- Write the times into the record sheet (section 8) as you go.

## 3. Start the page

In any terminal, from any directory:

```sh
rondo
```

It starts the service, waits for the page to answer, and opens it in your browser. It prints *"rondo
is open. If it did not come up in your browser, it is here: http://127.0.0.1:7333/"* and returns.
You may close the terminal now. The page keeps running.

If it prints three sentences instead, beginning *"rondo's page cannot be opened on this computer."*,
setup did not finish. Go back to section 1 and read what it printed. That is installation, not the
walk, but write it down.

**Do not type anything after the word.** `rondo start` is not "start rondo". Whatever follows the
word goes to the command line, and `start` there is the verb that runs a paid lap.

Before you press anything, check two things on a wide window:

- The header shows your name on the right. Hovering over it says *"You send and answer as
  `<name>`"*. On a narrow window the name is not drawn.
- The header has a button **Tell me here when it is my turn** (自分の番になったら、このタブで知らせる).
  **Press it now and allow notifications when the browser asks.** Measure 4 depends on it. The
  button appears only while the browser has not yet been asked. If it is not there, the browser has
  already answered for `127.0.0.1:7333`, one way or the other. Check the site's notification
  permission in the browser's own settings, and write down what it was.

## 4. The walk

Each step names the button by the words printed on it, with the Japanese in brackets, and says
where the page shows you what was recorded. Nothing below needs a terminal.

### Step 1. Write the request

With nothing waiting, the middle of the page is the empty state: *What would you like to ask for?*
(and **Write a new request** / 新しい依頼を書く on the left takes you back to it). It holds the
**New request** box. Paste the body below and press **Send** (送信).

rondo names the message. You do not type an id. The note under the box says *"Sent as written. To
correct it, reply again."*

The body is complete by itself on purpose: in lap 10 the lap could not open the issue (N-43). Since
#312 a bare `#291` is read in the plan's repository and quoted to the worker, but a lap should not
depend on that.

```
Split src/access/wording.ts into one file per language (rondo#291). A move only: no string
changes, no key added or removed, no rename, in the same commit or anywhere in this work.

1. Create src/access/wording/en.ts holding the English set (EN, and EN_MEASURE with it), and
   src/access/wording/ja.ts holding the Japanese set (JA, and JA_MEASURE with it). Each is a
   complete Chrome, exactly as it is today. Move each entry's doc comment with it.
2. Leave in src/access/wording.ts what is not a language's set: the Chrome type and the other
   types, SHIPPED_SETS, setFor, chromeFor and the helpers. Everything that imports from
   ./wording.js today must keep importing the same names from it: re-export EN from there, so no
   importer changes.
3. Do not move or change src/access/page/words.ts (PAGE_EN, PAGE_JA). It is not part of this.
4. Avoid a runtime import cycle between wording.ts and the two new files. A type-only import of
   Chrome is fine. If a helper both sets call has to move so there is no cycle, move it to a
   third module and say in your report which one and why.

Show that nothing changed: before the move, serialise the EN and JA sets (every key, and for
function entries their output on fixed arguments, or their source text) and compare the same
serialisation after it. Say in your report how you compared and what the comparison printed.
git diff --stat should read as a move: wording.ts loses roughly what the two new files gain.

Work in this repository, in the order AGENTS.md sets out: `node vendor/pin.mjs check`, then
`npm ci --ignore-scripts`, then the change, then `npm run verify`, then commit. Do not push and do
not open a pull request.

No Tailwind class string changes in a move, so page.manifest.json should not change. If
`npm run verify` says otherwise, stop and say so rather than re-recording it.
```

**Where it is recorded:** the page goes to the thread, anchored at your message, with your words
under your name. The list on the left holds the request, with its state beside it.

**If rondo asks you something first.** A drafter reads every new request, within about a minute.
If it cannot tell which piece of work you mean, it asks in the thread instead of guessing (`D-0081`).
The box then turns into **Stop this line** (この線を止める) / **Carry on** (続ける). Answer in your
own words and press **Carry on**. That is a dispute, which K2 allows. Record it as one. A question is
also your turn, so it is a notification episode (step 3).

### Step 2. The scope: read it, and approve it -- one press

In the thread, under the messages, **Set the scope** (範囲を決める) opens *The scope for this
request* (この依頼の範囲). It comes in one of two forms. Which one you get depends on whether the
drafter wrote one.

- **rondo drafted it:** *"rondo drafted this scope for your request: ... Approve it as it is, or
  change a value first"*. A card *What rondo proposes to run* holds the plan (or plans) and the
  prompt the drafter wrote for it. The press is **Approve** (承認する).
- **You write it:** *"You write this scope. The plan is one rondo holds ..."*. This is lap 10's form:
  the plan, the digests (folded), the **Review rounds** chooser (choose it first, because changing it
  redraws every budget), and each budget with its `how:` line and *where this came from*. The press
  is **Set the scope** (範囲を決める).

In both forms:

- **Read the Cost (USD) before you press.** lap 10 approved $7.50 for three laps and its first lap
  cost $8.46, which left **Ask for a change** out of budget (N-42). If the draft looks like it was
  priced from small laps, raise it now. That is one decision, not a dispute, so record it as one.
- **Leave the outward acts as rondo drew them.** Publishing is your press, not the lap's.
- **Expires (UTC)** is read as UTC. The label says so.

**Where it is recorded:** the screen comes back headed **Approved N ago** (N前に承認済み), with
`digest sha256:...` under it, read back from the stored row. Approving spends nothing.

### Step 3. Start the work -- this one spends money -- and look away

On the approved scope:

- **drafted form:** each plan has **Start this plan** (この作業を始める).
- **your own form:** the bar at the bottom has **Start the work** (作業を始める), with the note that
  the words of your request are what the work is asked to do. Under it: *"Pressing this button twice
  is one lap and not two"*.

**Read the request once more before you press.** A reply sent afterwards is not part of the work. To
change what the lap is asked, send a new request and set a scope on that one.

Press once. **That tab will keep loading until the lap stops at its gate** (section 2). Leave it.

**Now set up measure 4, the notification test:**

1. **Open a second tab** at `http://127.0.0.1:7333/`. With nothing waiting, it opens on the empty
   state, because the page picks a request by itself only when that request is waiting on you.
   **Click the request in the list on the left.** It should show the work running:
   - the list row says *Working on it*;
   - the thread has *Work started.*;
   - with nothing waiting, the right face shows *Work under way* with its five steps.

   Record whether you could tell from this tab that the work was running (lap 10's reach 1).
2. In that tab, if the header still shows **Tell me here when it is my turn**, press it. The tab
   rings only for a turn that arrives **after** it was opened, and only while it is on a live view
   (the list, the summary, a thread). The scope and publish screens do not ring.
3. **Stop looking at the page.** Minimise the browser, or put another window over it, and do
   something else. Do not watch the lap. The lap may run for tens of minutes.
4. When it is your turn, two things are meant to reach you. The text is the same, *"rondo is
   waiting for your answer."* (rondo があなたの答えを待っています。), so tell them apart by who the
   notification says it is from:
   - **the host**, through the program setup found. It is checked once a minute, so it arrives up
     to a minute after the gate opens. It is sent once per episode and never again, even if the
     host restarts.
   - **the tab**, as a browser notification from `127.0.0.1:7333`. It is checked every five
     seconds.

   For each one, write down whether it arrived and when. If neither arrived, write down how you
   found out it was your turn.

The host has a second line, *"Something in rondo has been going longer than it was meant to."* It is
sent when a lap runs past its plan's ceiling. If you get it, write it down: it is also a
notification.

**If the press is refused:** *"Nothing was started and nothing was spent: this work is outside the
scope you approved, at the <name> test. A message in the request's thread says what the choices
are."*. See section 5. *"Nothing was started, and nothing was spent. The approval stands; pressing
again is safe."* means what it says.

### Step 4. Read the gate

The gate is not a separate screen now. It is the request's thread. Opening the page with a turn
waiting selects the oldest request waiting on you. The header's amber **N waiting** (N 件待ち) and
the list's *Your turn* take you there, and the thread's header says *your turn N / M*.

The right face, while the gate is asking you, reads in this order:

| Where | What it is |
|---|---|
| **What this rests on** (この確認の材料) | the material: **Why it stopped**, **What changed** (commits and files against the base), **Beyond the files this work keeps** when anything was, **The fence:**, **Checks**, **Model review**, each reading with *What it read, and what it did not* drawn open. Under them: *"Both readings are material for you to weigh. Neither approves anything; the answer is yours."* |
| **What was agreed for this** (この依頼の取り決め) | the terms: **Spent** / **Left of what was approved** / **Tries**, **Where it may touch**, **What remains before this ends** (the five steps), and **rondo decided without asking**, with a count |

In the middle, above the reply box, is the answer box. If a reading raised anything, **What was
raised** (挙がっている点) quotes each finding in one line. Under it is the fold *What approve records
(N fields), and the full text*.

**Expected files, worked out from the change and not from the issue** ([runbook conventions
2](runbook-conventions.md)). Treat the list as **files to explain, not a pass/fail filter**:

| File | Why the change lands here |
|---|---|
| `src/access/wording.ts` | loses the two sets. Keeps the types, `SHIPPED_SETS`, `setFor`, `chromeFor`, and a re-export of `EN` |
| `src/access/wording/en.ts` | new. The English set, moved |
| `src/access/wording/ja.ts` | new. The Japanese set, moved |
| a third small module under `src/access/` | **only if** a helper had to move to break an import cycle. The report should say which one |
| `test/...` | **only if** a test imported a set by path. A move that needs new tests is suspicious. A test that shows nothing changed is welcome |

What should **not** appear: `src/access/page/words.ts`, any `.tsx`, `page.manifest.json`, anything
under `src/store/`, and **any changed string**. Nothing the page says should be different.

Two things this lap is likely to show you on purpose:

- **The two new files may be drawn under Beyond the files this work keeps**, if what the work keeps
  names only `wording.ts`. That is #365 working. The question for the record is whether its
  sentence told you what to do.
- **What changed will be large.** Read the model review's *What it read, and what it did not*
  (#362). If it says it did not read part of the diff, that is the reading being honest about a
  3,000-line move, and approving over it is a decision to record.

### Step 5. Answer the gate

There are two presses of the same size (#351). The filled one is what the readings point to:

- **Nothing raised:** **approve** (承認する) is filled. **Ask for a change** (変更を依頼する) is
  outlined.
- **Something raised:** **Ask for a change** is filled. The other press reads **approve despite what
  was raised** (指摘を残したまま承認する) and is outlined in amber.

**To accept:** type what you actually checked into **What you checked (recorded with your approval)**
(確認したこと (承認と一緒に記録されます)). It is optional, it is recorded byte for byte, and it ends
up in the pull request body. Then press **approve** or **approve despite what was raised**.

**To ask for a change (this spends money):** the text box *What to change* is pre-filled with
rondo's draft from the review's findings. The draft may still be being written: if the box says so,
reload in a minute or two. Edit it or replace it; your words go to the gate exactly as you leave
them. Then press **Ask for a change**. The second lap runs under the same approval, and it is also
your turn when it stops, so it is a second chance at measure 4.

If the budget cannot cover another try, the change box is replaced by a sentence that says why and
says nothing was spent, followed by **Raise this approval's budget** (この承認の予算を引き上げる).
That opens the scope screen with **Raise the budget**, and returns you to the thread, where **Ask for
a change** is offered again. The new budget counts from here on, not in total.

**Where it is recorded:** both answers bring you back to the thread. An approval shows there with
what you said you checked. After a change, the thread shows the new try running.

### Step 6. Publish -- this one leaves the machine

In the thread, once a lap is approved, **Publish** (公開する) appears under the messages. It reads
*Try N: Publish* when there is more than one lap. It opens *Publish this work*, which is a dry run
read just now:

> Nothing has left this machine yet. This is what publishing would do, read just now; the button
> below is the only thing that does it.

*What would happen* lists the branch to push, `Open a pull request on suisya-systems/rondo, against
main.`, the run to close, and where the work is. *What rondo noticed* lists anything that stops the
publish. **The pull request it would open** is drawn open: **Title**, then **Body** with **Preview**
(the default) and **Raw** (*"Exactly the text that will be sent, byte for byte."*). lap 10's raw
`</details>` should now be a rendered fold in Preview. Check that it is.

Press **Publish**. rondo pushes, opens the pull request and closes the run, as you. It merges
nothing.

If the reading does not cover the work, there is no **Publish** button. Instead there is a fold
**Publish without that reading**, with **Publish anyway** (それでも公開する) inside it. That is a
second decision, on a screen showing what it overrules.

**Where it is recorded.** You land back on the request's thread. It should hold a message from
rondo, *"Lap '...' was published: its branch was pushed, pull request <URL> was opened, and run
'...' was closed completed."*, and the **Publish** link should be gone. **Record whether you could tell the publish
had worked without leaving the page.** That was lap 10's reach 2.

If it half-finishes, the screen says which leg is done. If the pull-request leg failed, **look at
the forge before pressing again**, and count that look as a trip outside the screen.

### Step 7. Wait for the checks, on the page

rondo checks the pushed commit's checks once a minute. Nothing is written while they are pending.
When they finish, one message from rondo appears in the thread:

- green: *"Lap '...' is green: the forge reported N check(s) on commit '...', and every one of them
  passed. ..."*
- red: *"Lap '...' is not green: on commit '...' the forge reports '...' as failed. ..."*
- no checks at all: *"The forge reported no check of any kind on commit '...' ..."*. rondo keeps
  looking after this one.

**This message does not notify you.** It is not your turn (#311 notifies turns, and a lap that runs
late). So come back to the thread yourself. Record how long the checks took, and **whether you felt
you had to open GitHub to find out**. If you did, that is a trip outside the screen.

Merging is not rondo's. The pull request is on GitHub under your name. Merging it there is the one
act outside the page this lap expects, and it is outside the arc K1 describes, which ends at the
pull request being opened. Record it separately, not as a terminal trip.

## 5. When it stops

- **A question in the thread** (a scope stop after a refused start or change, or a drafter asking
  which work you mean) shows **Waiting on you** on the list, and its link is **Answer**. The box
  becomes **Stop this line** (この線を止める) / **Carry on** (続ける). Write your words either way.
  The button you press is what rondo acts on. A plain reply is refused with *"This reply does not
  answer the question waiting in this thread."*
  - **Carry on** releases the hold. The next try is tested again from the top.
  - **Stop this line** records that you stopped it. It stays held until you press **Carry on**
    later.
- **If the budget ran out**, see step 5: **Raise this approval's budget**, not a second **Set the
  scope**.
- **A lap that never comes back** is still the one thing the page has no press for. The page does
  not show lap ids (section 2), and the word does not carry the store, so it takes this:

  ```sh
  unsetopt correct correct_all
  cd "$HOME/rondo-lap-11/rondo-host"
  . "$HOME/rondo-lap-11/env.sh"
  node bin/rondo.mjs inbox --actor-id "$RONDO_APPROVER"
  ```

  Its *in flight* section lists the lap as `lap-<uuid>  performing  <age>`. Then:

  ```sh
  node bin/rondo.mjs abandon --iteration-id lap-THE-UUID --reason "did not come back"
  ```

  That releases rondo's hold on the lap and nothing else. It does not drive continuo, and it says
  so. Write it down. It is K3's known hole, and the record should say whether you needed it.

## 6. Clearing up

- **Stop the page:** `systemctl --user stop rondo.service`. The word `rondo` starts it again.
  Stopping writes nothing. This is the "stopping" that measure 1 does not count.
- **Publish is the only thing on the page that closes a continuo run.** A lap you approved and did
  not publish leaves its run open. `abandon` does not close it. Closing it is done on continuo's own
  surface. The open run costs nothing and blocks nothing here.
- The approved scope expires on its own clock.
- **The word and the service now point at `$R`.** To go back to another environment, run that
  environment's setup again.
- `$R` is yours to delete when you are done. **A lap you did not publish exists only as a branch in
  `$R/workspaces/`**, and deleting the directory deletes the work. Stop the service first, because
  it serves from `$R/rondo-host`.

## 7. What the record is compared against

| | lap 9 | lap 10 | **lap 11** |
|---|---|---|---|
| surface | the terminal | the page, started with `rondo web --repo ...` | the page, started with `rondo` |
| trips outside the screen | not a meaningful question | 2, both for *state* ("is it running?", "did it publish?") | measure 1 |
| words asked about | -- | `完了: answered_and_forwarded`, raw `</details>`, `ログあり <path>` (N-41) | measure 2 |
| being told it was your turn | -- | nothing reached anyone who was not looking | measure 4 |
| questions to the secretary | -- | not counted | measure 5 |

## 8. The record sheet

One row per step. "Thought" means your hand came off the mouse to decide something or to go and
look something up. "Asked" means you asked the secretary; each question goes in the questions
table below as well.

| Step | Start | End | Thought | Terminal | Asked | Where it snagged |
|---|---|---|---|---|---|---|
| 0 environment + `rondo` | | | | (setup: not counted) | | |
| 1 write the request (+ a drafter question, if one came) | | | | | | |
| 2 scope: read it, and approve | | | | | | |
| 3 start the work, and look away | | | | | | |
| 4 read the gate | | | | | | |
| 5 answer (approve / ask for a change / raise) | | | | | | |
| 6 publish | | | | | | |
| 7 the checks come back | | | | | | |
| a stop, if one came | | | | | | |
| clearing up (`systemctl --user stop`: not counted) | | | | | | |

**Measure 1: terminal trips** (not counting `rondo` and `systemctl --user stop rondo.service`)

| # | when | what you typed | what you wanted to know or do | could the screen have said it? |
|---|---|---|---|---|
| | | | | |

**Measure 2: words you had to ask about** (exactly as printed, and in which language the page was)

| # | where on the page | the words | what you thought it meant | what it meant |
|---|---|---|---|---|
| | | | | |

**Measure 3: places you stopped to think**

| # | where | what you were deciding | an approval, a dispute, or something else? |
|---|---|---|---|
| | | | |

**Measure 4: notifications**

| turn | when the gate opened (the thread's time) | host program: arrived? when? | tab: arrived? when? | how you actually noticed |
|---|---|---|---|---|
| first gate | | | | |
| a drafter question / stop / second gate, if any | | | | |

- Notification program setup found (or *"nothing here shows a notification"*):
- The tab's permission before the walk (asked / already allowed / already blocked):

**Measure 5: questions to the secretary**

| # | when | the question | answered from the screen afterwards? |
|---|---|---|---|
| | | | |

Overall:

- Issue walked: rondo#291
- Time from **Send** to the gate answered:
- Decisions you were asked for (scope, gate, a stop, publish), and whether each was an approval or a
  dispute (K2):
- What the lap cost (**Spent** on the right face), against the scope you approved:
- The pull request's number, and what the checks said, **read on the page**:
- **K1 to K4, each met or not, with the row of this sheet that decides it.** This is the line lap 11
  exists to write.
- Anything you took for a bug that section 2 had already listed. If that happened, it still counts
  in the measures, and the runbook's warning did not do its job.
