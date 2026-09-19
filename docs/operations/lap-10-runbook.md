# lap 10 runbook -- walking a whole lap on the operator page, with your hands on the buttons only

lap 9 was the first lap the owner walked in person, and every step of it was a command typed into
a terminal ([`lap-9-runbook.md`](lap-9-runbook.md), [`lap-9-dogfood.md`](lap-9-dogfood.md)). Since
then S0-S5 (#230, #231, #232, #234, #235, #236) have put the whole walk on one page: the request,
the scope and its approval, the start, the gate, the change, the publish. lap 10 walks that page.

**The one thing the terminal still does is start the page.** After `rondo web` is up, everything
below happens in a browser at `http://127.0.0.1:7333/`. If a step here asks you to open a terminal
for anything but starting and stopping the page, that is the runbook being wrong, not you.

What we want to measure: **is the page a smaller walk than the command line was?** Same lap, same
kind of request, so the two records compare. Count the times you stopped to think, and count the
times you wanted a terminal and did not have one.

## 0. This lap's request: rondo#237

**Chosen: [rondo#237](https://github.com/suisya-systems/rondo/issues/237)
"The gate screen's three residues from S2"**

Why this one:

- **It is the page looking at itself.** All three residues are on the gate screen you will be
  standing on in step 5, so you read the bug and the fix on the same screen you approve from.
- **The decision is already made.** #237 was cut out of #233's slices precisely so the three
  residues would stop travelling in PR bodies; the issue says what each one is and what "fixed"
  looks like. Nothing in it waits on a judgement call.
- **It is rendering only.** No new press, no new route, no store change -- so the lap cannot spend
  its way into a design argument, which is what you want from the lap you are also using to test
  the page.
- Passed over: #238 and #239 (both are "known limit" trackers -- see section 2, they are what you
  will be walking *past*), #219 and #221 (runbook fixes, and this runbook is the fix), #206
  (a reply-semantics decision comes first).

## 1. The environment

Nothing is standing yet. These commands build it, and none of them costs money or touches GitHub.
Re-running any of them is safe.

`$R` below is the environment root. lap 9 put it under `/tmp` and lost it to a reboot; this one
lives in your home directory so a lap can be walked across two days.

The first line turns off zsh's interactive spelling correction, which otherwise asks about
unfamiliar words on every step (#221). Its own comment stays out of the pasted line: a trailing
`#` with a `(...)` after it reads as a glob qualifier rather than a comment under zsh's default
`INTERACTIVE_COMMENTS off`, and breaks the very line it is explaining.

```sh
unsetopt correct correct_all
R=$HOME/rondo-lap-10; mkdir -p "$R"
git clone https://github.com/suisya-systems/rondo.git "$R/rondo-host"
git clone https://github.com/suisya-systems/rondo.git "$R/rondo-gh"
cd "$R/rondo-host"
node vendor/pin.mjs check && npm ci --ignore-scripts && npm run build
./scripts/dogfood-env.sh --root "$R" --target-repo "$R/rondo-gh"
```

`dogfood-env.sh --iteration-id` is deliberately not on that line: it only names the laps in the
*command lines* the script prints, and the page does not use them. **A lap started from the page is
named by the page**, as `lap-` and a UUID, minted when the button is drawn -- which is what makes a
double press one lap rather than two.

| Path | What it is |
|---|---|
| `$R/rondo-host` | rondo itself, built. **The page is served from here** |
| `$R/rondo-gh` | the repository the lap changes. Its `origin` is `suisya-systems/rondo`, which is what makes publishing reach a real forge |
| `$R/env.sh` | `RONDO_CONTINUO_CLI`, `RONDO_STORE`, `RONDO_APPROVER` |
| `$R/plan.json` | the plan the page drafts a scope from, written by `dogfood-env.sh` with a `review_criterion` in it (without one the model review is `unavailable` on every lap, #205), and recorded by its last step into the store the page reads (D-0075), so it is never pasted |
| `$R/workspaces/` | where the lap's work will appear, in `iter-<lap id>`, once it has started. The lap id is the page's, not one you chose -- see step 3 |

## 2. Before you start

- **Not inside a Claude Code sandbox** -- a normal terminal (lap 6 / 7, N-21). A worker started from
  inside a sandbox fails to start its own with `EPERM`.
- **Money and the outside world.** Only two presses spend: **Start the work** and **Ask for a
  change**. Only one press leaves this machine: **Publish**. Everything else -- reading, sending a
  request, recording and approving a scope -- costs nothing and reaches nobody.
- **`(node:NN) ExperimentalWarning: SQLite is an experimental feature` is normal** and appears in
  the terminal on every command.
- **Two things on the page are deliberately unfinished. Neither is a bug you found.**
  - **The scope form's numbers and the "Ask for a change" text are written by plain code, not by a
    drafter** ([#238](https://github.com/suisya-systems/rondo/issues/238)). #233's owner decision Q2
    chose that as the interim for this lap: the scope is pre-filled from `plan.json` and from what
    past laps in this store cost, and the change text is the model review's findings quoted back at
    you. They are drafts with your name on them because you press the button, not proposals from a
    model. When D-0071 stage 2 lands, a drafter writes both.
  - **The four presses that cannot be taken back have no end-to-end test**
    ([#239](https://github.com/suisya-systems/rondo/issues/239)): **Start the work**, **approve**,
    **Ask for a change** and **Publish**. Every refusal *in front of* each of them is tested over a
    real store or a real git workspace, and the ports are tested in both directions -- what is
    untested is the leg itself, because it needs a real continuo and a real forge. So a press that
    goes wrong here is more likely to be news than a press that is refused.
- Write the time into the record sheet (section 6) as you go.

## 3. Start the page

One terminal, once, and then leave it running.

```sh
cd "$R/rondo-host"
. "$R/env.sh"
node bin/rondo.mjs web --port 7333 --repo suisya-systems/rondo
```

It prints `rondo is reading and answering at http://127.0.0.1:7333/ -- ctrl-c to stop`. Open that.

Two things decide whether the page has the screens you need, so read the refusals if they come:

- **The page reads no plan file** (rondo#238). The scope screen offers the plans rondo holds:
  those `dogfood-env.sh` recorded as its last step, those pasted into the request's thread, and
  those recent laps ran on, newest first (D-0075). Nothing is pasted on a store setup finished. If
  it says *"rondo has no plan to run this on: its setup on this machine has not given it one
  yet."*, setup did not reach its last step for this store: run `dogfood-env.sh` again with the
  same `--root`. (Before rondo#266 the page read a plan file named by `RONDO_PLAN`; nothing reads
  that variable now, so exporting it does nothing.)
- **`--repo` is what makes publishing exist at all.** Without it the publish screen says *"Nothing
  can be published from this page ... Both are given to rondo when the page is started."* There is
  no way to add it later from the browser; stop the page and start it again.
- If `RONDO_APPROVER` were unset the page would read and write nothing: no Send, no approve, no
  scope, no publish. `env.sh` sets it to your login name.

On a wide window the header carries your name on the right; hovering it says *"You send and answer
as `<name>`"*. That is the whole of the page's authentication: there is no login, because there is
no route in from anywhere but this machine. On a narrow window the name is not drawn at all, so
check it once on a wide one before you press anything.

## 4. The walk

Each step names the button by the words printed on it, and says where the page shows you what was
recorded. Nothing below needs a terminal.

### Step 1. Write the request

**Requests** in the header, then the **New request** box at the bottom. Paste the body below, and
press **Send**.

rondo names the message; you do not type an id. Your words are recorded exactly as written -- the
note under the box says so, and the way to correct a request is another message, not an edit.

The body to paste:

```
Fix the three residues the gate screen carried out of S2 (rondo#237). Rendering only: no new
press, no new route, no change to what is stored.

1. Approve's button looks the same when a blocker or major model finding is open. D-0065 says
   approve is never refused over model findings, and the red line with "Read it" is already
   there -- but the press itself does not change its face, so a person scanning the bar cannot
   tell an approval that overrides a blocker from one that does not. Make the press say what it
   is about to do.
2. An ended lap's row does not say it was approved with findings open. The summary shows the lap
   as finished; that its gate was passed over a blocker or major reading is only discoverable by
   opening it. Both facts are already recorded -- the verification claim and the reading -- so
   this is a rendering gap, not a store gap.
3. Checks shows its recorded verdict ("nothing raised", green) even when the workspace could not
   be read. The Checks read count and the What-changed count can therefore disagree. S5 fixed the
   analogous case for publish, where an unreadable base history is a refusal rather than a null;
   the gate screen still has the older behaviour.

Work in this repository, in the order AGENTS.md sets out: `node vendor/pin.mjs check`, then
`npm ci --ignore-scripts`, then the change with its tests, then `npm run verify`, then commit.
Do not push and do not open a pull request.

Both language sets have to say it: a string added to EN in src/access/wording.ts needs its JA
counterpart, or the Japanese page falls back to English mid-sentence.

If you add or change a Tailwind class string, the served stylesheet changes with it. Re-record
the manifest (`npm run page:record`) and commit `page.manifest.json` in the same commit --
`npm run verify` runs `page:check` and will fail otherwise.
```

**Where it is recorded:** the page jumps to the thread, anchored at the message you just sent, with
your words under your name and `started N ago`. The **Requests** list now holds one row.

### Step 2. Record the scope and approve it -- one press

On the request's row (in **Requests**, or at the top of the thread) there is a quiet link,
**Set the scope**. It takes you to *The scope for this request*.

Read the screen top to bottom. It is drafted from `plan.json` and from what laps in this store have
already cost, and every number on it says where it came from:

| What to look at | What it tells you |
|---|---|
| *The plan rondo will run, and where it will run it* | the repository and workspace root, and the agent type's tier and what it is granted |
| *The digests rondo will record* (folded) | the plan digest and the agent type digest. lap 9 had to make a command fail once to learn this value; here it is printed |
| **Review rounds** | a chooser, not a box. Changing it **redraws every budget from the plan**, so anything you typed by hand goes back to rondo's draft. Choose this first |
| **Laps**, **Cost (USD)**, **Reserve per unread lap (USD)**, **Expires (UTC)** | each has a `how:` line with its formula, and *where this came from* names the laps it measured |
| *What rondo filled in for you* | the severity threshold and the outward acts. **Leave outward acts unticked**: publishing is your press, not the lap's |
| The cost caveat | the budget counts the laps' own cost; the reviewer's cost is not counted, and a lap whose cost is not read yet holds the reserve, which is a guess |

The expiry is a wall clock **read as UTC** -- the label says so, and the page has no way to know
your browser's zone.

Then press **Set the scope**. That one press records the scope and approves it under your name. It
does not spend anything: every act is tested against the scope at the moment it is taken.

**Where it is recorded:** the same screen comes back in its second state, headed **Approved N ago**
with `digest sha256:...` under it -- and that digest is read back off the stored row, not echoed
from the form. There is no id to copy anywhere. (lap 9's note that an unapproved scope never shows
up in the inbox still holds; on the page it does not need to, because the approval and the start
are the same screen.)

If the press is refused it says what it refused and nothing is recorded -- the commonest is *"the
plan changed while you were reading it"*, which means reload and read the numbers again.

### Step 3. Start the work -- this one spends money

Still on the approved scope screen, at the bottom, in a bar that stays visible while you scroll:
**Start the work**.

The note beside it is the thing to check before pressing: *"The words of your request are what the
work is asked to do, exactly as you wrote them."* There is no prompt field on this screen, and the
press posts none.

**Read the request once more before you press, because a reply will not fix it.** What the lap is
asked to do is the body of the one message the scope names -- the request itself, not the thread.
A reply you send afterwards is in the conversation and is not in the work. To change what the lap
is asked to do, go back to **Requests**, send the corrected words as a **new request**, and set a
scope on *that* one (step 2 again). The scope you already approved names the old message and will
keep starting the old words.

rondo names the lap too. Press once.

**Where it is recorded:** the page goes to the summary and lands on the new lap's row, under
**running now**, with its state pill and how long it has been going. The page redraws itself every
few seconds and a redraw writes nothing.

**The lap's name is now a fact you may need**, and only one press away: it is `lap-` and a UUID, and
the foot of the summary (**Show the full reading**) prints it as `iteration '<id>'`. Its workspace is
`$R/workspaces/iter-<lap id>`. Write it into the record sheet -- section 5's one terminal command
needs it.

**If it is refused:** *"Nothing was started and nothing was spent: this work is outside the scope
you approved, at the <name> test."* The named test is the reason, and a message appears **in the
request's thread** saying what the choices are -- see section 5. *"Nothing was started, and nothing
was spent. The approval stands; pressing again is safe."* means what it says.

### Step 4. Read the gate

When the lap stops it moves to **waiting for your answer** at the top of the summary, and the
header count beside **Requests** goes up. The row's one button is **Review and answer**.

The gate screen, in the order it reads:

| Section, in the order it reads | What to do with it |
|---|---|
| **Why it stopped** | the worker's own account of what it did |
| **What changed** | the commits and the files, read out of the workspace, against the base ref |
| **The fence:** | what continuo refused. Note the standing caveat: the worker's own sandbox is a *second* containment rondo does not observe -- a lap that ran with it disabled prints exactly like one that did not |
| **Checks** and **Model review**, side by side | the two readings, each with its verdict pill; the model's also has *What it read, and what it did not*. Nothing sits between them and neither recommends anything |
| *What approve records (N fields), and the full text* (folded) | everything the press will record, and the raw record under it |

Both readings are material for you to weigh; neither approves anything.

**Expected files, derived from the change and not from the issue.** #237 names three screens; what
the change has to touch is what those screens are drawn by. #219 is the note that says to work it
out this way -- lap 9 derived its list from the issue and called a genuinely-changed file
out-of-scope. For this lap:

| File | Why the change lands here |
|---|---|
| `src/access/web.tsx` | all three: the approve form and `modelRaised` (residue 1), `lapRow` / `endedView` (residue 2), `checksPill` / `checksView`, which already take a `workGone` flag (residue 3) |
| `src/access/wording.ts` | every sentence the three residues need, in `EN` **and** `JA` |
| `test/access/web.test.ts` | the page's own tests |
| `page.manifest.json` | **only if a Tailwind class string changed** -- `page/app.css` scans `src/access/**/*.tsx`, so a new class changes served bytes, and `npm run verify` runs `page:check` |

What should *not* appear: anything under `src/store/`, `src/advisory/` or `src/access/web-app.ts`.
#237 is rendering, and a new route or a new row means the lap did something else. Treat the list as
**files to explain**, not a pass/fail filter: a file outside it is a question for the gate, not a
verdict.

If **What changed** says the workspace could not be read, look at the **Checks** pill next to it --
a green *nothing raised* over an unreadable workspace is residue 3, the thing this lap is here to
fix, showing itself on the screen you are standing on.

### Step 5. Answer the gate

Two answers, side by side, and the second is not a step in front of the first.

**To accept it:** type what you actually checked into **What you checked (recorded with your
approval)** -- it is optional, it is recorded byte for byte with your approval, and it ends up in
the pull request body. Then press **approve**.

**To ask for a change** (this spends money): open **Ask for a change instead**. rondo has drafted
the text from the model review's findings, quoted with their severity and where they are -- that
draft is the #238 interim, written by code. Edit it or replace it; your words go to the gate exactly
as you leave them. Press **Ask for a change**. The second lap runs under the same approval, and its
cost counts against it. rondo names that lap too.

If the lap was not started under an approved scope the fold is a sentence instead of a button, and
says so: a second lap has no budget to be counted against.

**Where it is recorded:** the page returns to the summary, on the lap's row, now under **just
finished** with an **Approved** pill -- and the row says back *"you said you checked: ..."*. For a
change, the row is the new lap, running.

### Step 6. Publish

On the ended row there is a quiet **Publish** link -- drawn only on laps that a person approved at
the gate. It opens *Publish this work*, which is the dry run, read just now.

> Nothing has left this machine yet. This is what publishing would do, read just now; the button
> below is the only thing that does it.

It says, as sentences: the branch it would push and where; the pull request it would open, against
which base, with its **Title** and **Body**; the run it would close; and where the work is. Under
*What rondo noticed* is anything that stops it -- uncommitted work in the workspace, a push target
rondo cannot vouch for, a reading that does not cover what would be pushed.

Press **Publish**. rondo pushes, opens the pull request and closes the run, as you. It merges
nothing. If any of what the screen showed has changed since it was drawn, the press stops and says
so -- reload and read it again.

**If the reading does not cover this work**, there is no **Publish** button: the screen says what is
missing and offers **Publish without that reading** as a fold, with **Publish anyway** inside it.
That is a second press of its own, on a screen showing the refusal it overrules, and rondo records
that you decided it. Unread and read-and-nothing-raised must not look alike -- that is the whole
reason the first button is absent rather than merely risky.

This is the press with the most exposure in #239: three legs (push, pull request, run close), none
of them tested end to end. If it half-finishes, the screen says which leg is done -- and if the
pull request leg failed, **go and look at the forge before pressing again**, because a second press
cannot open a pull request that is already there.

**Where it is recorded:** the summary, on the published lap's row. The pull request is on GitHub
under your name.

### Step 7. Read back what the walk recorded

At the foot of the summary: **Show the full reading: every claim with its basis**. That view holds
the inbox, what spans the live laps, and one explanation per lap -- every claim with what it rests
on. Reading it moves no last-look mark and counts no presentation.

## 5. When it stops

- A refused **Start the work** or **Ask for a change** writes a message into **the request's
  thread** (a `scope-stop-...`), and it carries a question. Until you answer it, the next admission
  on that line stays stopped. You will see it as **N questions waiting on you** on the request's
  row, and as the header count.
- Open the thread and answer it. **The answer is a press, not a send** -- it releases a hold on
  work, which is why the button is not **Send**. The page will refuse a plain **Reply** to a waiting
  question and tell you to answer it instead.
- **There are two answers, and which you press is what decides** (#206, D-0072). Write your words in
  the box either way; the press is what rondo acts on.
  - **Carry on** releases the hold. The next admission on that line is tested again from the top --
    so it can still be refused, for the same reason or a new one, and write a new question.
  - **Stop this line** records that you stopped it and **leaves the question standing**. The line
    stays held, the row says you stopped it rather than that nobody answered, and you do not need a
    second approval to say so. Changing your mind is just pressing **Carry on** afterwards.
- Leaving the question unanswered holds the line too, and does no harm. The difference is the record:
  an unanswered question says nobody has been back to it, and a **Stop this line** says you have.
- **If the cause was the budget, raise it from the gate** (`D-0074`). When the lap waiting for you
  has used up the laps, the cost or the time its approval allowed, the gate says which, says nothing
  was spent, and draws **Raise this approval's budget** where **Ask for a change** would be. It opens
  the scope screen with the old approval's budgets and what they spent, and boxes redrawn from the
  laps recorded so far (the one that used the budget up among them). **Raise the budget** records a
  new approval that differs from the old one only in its budgets and returns you to the gate, where
  **Ask for a change** now spends the new one.
  - The new budgets count **from here on**: what the old approval spent stays counted under it, so
    raising the cost to $15 lets another $15 be spent, not $15 in total.
  - The old approval starts nothing new afterwards, for every request it covered.
  - Raising does not answer a stop question. If the refusal already wrote one, the line stays held
    until you press **Carry on** in the request's thread; the raise screen says so and links to it.
  - **Set the scope** again on the same request is still not the way: it records a second approval
    beside the first, which can start fresh work but is not what the lap you have spends.
- A lap that never comes back is the one thing with no press. Take its id off the summary's
  **Show the full reading** (`iteration '<id>'`), stop the page with ctrl-c, and run
  `node bin/rondo.mjs abandon --iteration-id lap-<the UUID> --reason "..."` in the same terminal,
  with `env.sh` still sourced. That releases rondo's lock on the lap and nothing else: it drives no
  continuo verb, and if a gate is still open its own output tells you so and says that closing it is
  a person's act on continuo's surface. Write it down if it happens -- it is the hole in "the page is
  the whole walk", and the only step here needing both a terminal and an id read off a screen.

## 6. Clearing up

- **Publish is the only thing on this page that closes a continuo run.** A lap you approved and did
  not publish leaves its run open, and rondo will not close it for you: `abandon` writes nothing at
  all on a lap that already ended (*"already terminal at 'closed'; nothing was written"*), and even
  on a live one it drives no continuo verb -- it says so in its own output. Closing such a run is an
  act on continuo's own surface, not rondo's.
- That open run costs nothing and blocks nothing **here**: `closed` is terminal, so the lap holds
  none of rondo's capacity and the next lap starts regardless. It is tidiness, not a blocker -- but
  do not write "cleaned up" in the record sheet on the strength of an `abandon` that wrote nothing.
- The approved scope expires on its own clock. Nothing to do.
- The page stops with ctrl-c in its terminal. Stopping it writes nothing.
- `$R` is yours to delete when you are done. Before you do: a lap you did not publish exists only
  as a branch in `$R/workspaces/`, and deleting the directory deletes the work.

## 7. The record sheet

One row per step. "Thought" means the hand came off the mouse to decide or to go and look something
up.

| Step | Start | End | Thought | Where it snagged |
|---|---|---|---|---|
| 0 environment + start the page | | | | |
| 1 write the request | | | | |
| 2 scope: read it, and approve | | | | |
| 3 Start the work | | | | |
| 4 read the gate | | | | |
| 5 answer (approve / ask for a change) | | | | |
| 6 publish | | | | |
| 7 read back | | | | |
| a stop, if one came | | | | |

Overall:

- The lap's id (`lap-` and a UUID), off **Show the full reading**:
- Time from **Send** to the gate answered:
- Times you were asked to decide (scope, gate, a stop, publish):
- What the lap cost (the cost on the lap's row in the summary):
- **Times you wanted a terminal and did not have one.** The whole question of lap 10 is whether that
  number is zero.
- Against lap 9's command line, and against the current organisation (a task to the desk, a worker
  opens a pull request): was this less work, and why?
- Anything you took for a bug that section 2 had already called an interim (#238, #239). If that
  happened, the runbook is what needs fixing.
