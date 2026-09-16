# lap 10 dogfood -- the page carried the whole walk, and told the person nothing while it worked or when it was done

A tenth walk of the arc, and the first one in which the person pressed buttons instead of typing
verbs. [`lap-10-runbook.md`](lap-10-runbook.md) put the question plainly: **is the page a smaller
walk than the command line was?** The answer this lap gives is in two halves.

**The page connects. It does not report.** Every step of the arc -- request, scope, approval, start,
gate, publish -- was reachable from `http://127.0.0.1:7333/` with no id copied and no command typed,
and the lap landed a merged pull request. But **the screen never said the work was running, and
never said the publish had succeeded**, so the two facts the person most wanted were the two the
page withheld. Both times a hand went outside the screen to get them.

- Walked on 2026-09-17 by the owner (`happy_ryo`), on the operator page only, with the terminal used
  for `rondo web` and nothing else. The claude-org secretary stood beside the walk, answered
  questions and took the notes this record is written from; they pressed nothing.
- The request was [rondo#237](https://github.com/suisya-systems/rondo/issues/237), *the gate
  screen's three residues from S2* -- chosen because the screens it fixes are the screens the walk
  stands on (runbook section 0).
- **One paid lap, `lap-12f11d82-61d5-4972-a7ec-a7091f4b6399`: $8.46 over 98 turns in about 13
  minutes, with 2 commands stopped by the fence.** There was no second lap: **Ask for a change** was
  out of budget before it could be pressed (N-42).
- The readings split: **Checks raised nothing** (1 commit, 3 files read); the **model review raised
  one major finding**, which the owner read, approved over, and recorded as a follow-up to file
  (N-38).
- The result was published as **suisya-systems/rondo#242** (branch
  `rondo/lap-12f11d82-...`), CI 8/8 green, merged as `c72e388`.
- **Times a hand went outside the screen: 2.** Once to learn whether the work was running, once to
  learn whether the publish had worked. Neither could be answered from the page; both were answered
  by the secretary, looking at the process and at GitHub.

Sources: the secretary's contemporaneous note of the walk (`notes/lap-10-walk-observations-2026-09-17.md`
in claude-org, screenshots and the owner's words taken as they happened), the merged pull request
#242, and the page's own code where this record names a line. **Unlike lap 9, this record is not
written from a store dump or a `timeline.txt`**: the walk was a person looking at screens, and what
was on the screens is what is recorded here. Durations are the page's own figures as the owner read
them.

---

## 1. The questions, answered

| # | question | answer | evidence |
|---|---|---|---|
| 1 | could the whole arc be walked from the page? | **yes** | request, scope, approval, start, gate answer and publish were all presses; the lap merged as `c72e388` |
| 2 | were there zero reaches for a terminal? | **no: 2** | "is it running?" (section 2) and "did the publish work?" (section 3, N-40). Neither was a missing verb -- both were missing *readouts* |
| 3 | did the page ever say the work was running? | **no** | the pressing tab did not repaint until the lap ended; the **Requests** list still offered **Set the scope**; the summary's row buried *running / 10 min* under the request body (N-39) |
| 4 | did the page say the publish had succeeded? | **no** | the summary came back with the row **unchanged, still offering Publish** after a publish that had already pushed and opened #242 (N-40) |
| 5 | did the double-press protection hold? | **yes, and silently** | `startScopedFromPage` (`src/access/cli.ts:4429`) holds the in-flight promise per lap id so a second press joins the first. The screen says none of this; the button stays live and unexplained (N-39) |
| 6 | did the expected-file list hold this time? | **yes, exactly** | the runbook derived it from the change's call sites (#219, lap 9's N-36). Changed: `src/access/web.tsx (+131 -50)`, `src/access/wording.ts (+73 -14)`, `test/access/web.test.ts (+227 -5)`; `page.manifest.json` unchanged because no new Tailwind class was added, confirmed by the lap running `page:record` to a zero diff |
| 7 | did the budget draft survive contact? | **no, on the first lap** | $7.50 approved for 3 laps; lap 1 cost **$8.46** (N-42) |

## 2. The measurement: two reaches outside the screen

This is the number lap 10 exists to produce, and the number that makes it comparable with lap 9.
lap 9 was **entirely** terminal: the question could not be asked there, because the terminal was the
surface. lap 10 asks it of a page that covers every verb -- and the answer is that the page's gaps
are not verbs at all.

| # | when | what the person wanted to know | why the page could not say it | who answered |
|---|---|---|---|---|
| 1 | during the lap (~13 min) | *is it actually running?* | the pressing tab never repainted; the **Requests** row still read **Set the scope**; the summary's *running / 10 min* was the smallest text on a row mostly filled with the request body; the row's `ログあり <path>` names a log the page cannot open | the secretary, by looking at the process |
| 2 | after **Publish** | *did it work?* | the screen said nothing and returned a row identical to the one before the press, **Publish** still offered | the secretary, by opening GitHub |

Both reaches are for **state of work already done or in flight**, not for an action. Nothing the
person wanted to *do* was missing from the page. What was missing was the page saying what had
happened.

A third gap is adjacent and belongs with them: the row says **`ログあり`** and prints the workspace
path, and there is no way to read that log from the page. The runbook's own promise -- *"the one
thing the terminal still does is start the page"* -- is broken by a row that names a file and then
requires a terminal to open it.

## 3. The walk, as it was seen

### Sending the request, and then not knowing where to go

The send worked and landed in the thread. But **the largest, darkest thing on the screen after the
send is the reply box and its black Send button**, and the actual next step -- **Set the scope** --
is a thin link in the far corner, as distant from the eye's landing point as the layout allows. The
owner stopped here: *"I don't know what to do next."*

The runbook describes this link approvingly, twice, as *"a quiet link"* (steps 2 and 6). The
document and the screen agree with each other and are both wrong about the person.

### The scope screen, and the budget that was already too small

The scope screen read well: the plan, the workspace, the digests printed rather than extracted by
deliberately failing a command (lap 9 had to do that), every budget carrying its `how:` line. One
press recorded and approved it: **3 laps, $7.50, $2.50 reserved per unread lap, 3 review rounds.**

Those numbers were drafted from what past laps in this store had cost. The first lap cost $8.46.

### Start the work: the press that gives nothing back

Pressed once. Then:

- **The button stayed live.** The owner: *"I can see something is loading, but the button is active
  and I could press it any number of times."* The protection is real -- `startScopedFromPage`
  (`src/access/cli.ts:4429`) keeps the in-flight promise in a `starting` map by lap id, so a second
  press joins the first rather than starting a second lap, both during the run and after it. **The
  page does not say so anywhere.** The person pressed a button that spends money and then waited,
  suspecting they had been charged twice.
  The asymmetry is sharp: the scope screen, on a *refusal*, says *"the approval stands; pressing
  again is safe"* -- and the press that actually spends money says nothing at all.
- **The pressing tab did not move for 13 minutes.** The press is a native navigation, so the tab
  holds the previous screen until the response comes back. The runbook says pressing takes you to
  the summary and lands on the running row; it does, *afterwards*. The owner: *"I can't tell whether
  it's moving or not -- the screen doesn't change at all."*
- **The lists showed no sign of a lap.** The **Requests** row -- the natural place to land -- still
  offered **Set the scope**, as if nothing had begun. And the foot of the page says **live, updating
  every 5 seconds**, which turns the silence into a guarantee: it *is* refreshing, and nothing is
  changing, so nothing is wrong. A lap holding a $7.50 budget was running.
- **The summary's running row buried the answer.** The row has everything -- *running now*, the
  state pill, *10 min*, the lap id, `ログあり <path>` -- but most of its area is a verbatim copy of
  the request body, and *running / 10 min* is the smallest thing at the bottom of it. The owner:
  *"nobody could look at this and tell what is running or what it is doing."*

### The gate

The gate screen did its job. **Checks: nothing raised**, over 1 commit and 3 files. **Model review
(gpt-6-astra): one major finding** --

> The Checks bar now mutes its verdict when work is unreadable, but the tests assert only wording,
> never the pill's tone; a regression that leaves the unreadable verdict green would pass these
> assertions.
> bases: `src/access/web.tsx:2023`, `src/access/web.tsx:2479`, `test/access/web.test.ts:2859`,
> `test/access/web.test.ts:2893`

The owner read it, judged the fix itself correct and the gap to be in the test's grip on it,
approved with the finding open, and wrote five lines into **What you checked** -- including that the
finding would be raised as a follow-up. That follow-up is N-38, and filing it is what this record
exists partly to cause.

One machine string reached the person here: the approved row reads **`完了: answered_and_forwarded`**
(N-41).

### Publish, and the screen that offered to do it again

The dry run read correctly and the press succeeded: branch pushed, #242 opened, CI 8/8 green. What
the person saw was: *"I pressed it, and again nothing on the screen changed."* Then the summary
came back with **the row in exactly its pre-publish state, the Publish link still there.**

So the screen, having just completed the one act on this page that leaves the machine, invited the
person to perform it again. **This differs from the Start button in the way that matters: a second
press here fails.** A pull request that is open cannot be opened again -- the runbook warns of it
directly, and tells you to go and look at the forge before pressing again, which is exactly the
reach outside the screen this lap counted.

The preview above it showed raw `</details>` from the PR body's fold markup. The owner: *"`</details>`
-- what is this?"* The byte-for-byte policy is right; showing the bytes unrendered is a separate
choice (N-41).

## 4. What #239's four irreversible presses now have behind them

[#239](https://github.com/suisya-systems/rondo/issues/239) names four presses that cannot be taken
back and have no end-to-end test: **Start the work**, **approve**, **Ask for a change** and
**Publish**. This lap is the first evidence any of them work against a real continuo and a real
forge.

| press | walked this lap? | what it proves |
|---|---|---|
| **Start the work** | **yes** | a real continuo lap started and finished from one press: 98 turns, $8.46, 2 fence refusals, work committed |
| **approve** | **yes** | approval with a major model finding open, `What you checked` recorded, and the text reached the pull request body |
| **Publish** | **yes** | all three legs in one press against the real forge: branch pushed, #242 opened, run closed. No leg half-finished |
| **Ask for a change** | **no** | the budget was gone after lap 1 (N-42). Untouched, as #239 says |

Not walked, and still untouched after this lap: **every refusal path**. Nothing was refused this
lap -- no scope stop, no out-of-budget press attempted, no publish blocked for an uncovered reading.
The refusals are the well-tested half in unit terms and the unwalked half in dogfood terms, and the
one that #239 leaves most exposed -- a **Publish** that half-finishes -- is exactly the case this
lap could not produce on purpose.

## 5. Cost

| | value |
|---|---|
| `lap_cost_usd`, the one lap | **8.46** |
| turns / duration | **98 / ~13 min** |
| scope approved | 3 laps, **7.50 USD**, 2.50 reserved per unread lap, 3 review rounds |
| **budget against reality** | **the first lap exceeded the whole three-lap budget by 0.96 USD** |
| model reviewer cost | not read (D-0065 rule 3.4) |

| | lap 6 | lap 7 | lap 8 | lap 9 (001 / 002) | **lap 10** |
|---|---|---|---|---|---|
| `total_cost_usd` | 0.223 | 0.891 | 1.040 | 1.884 / 0.456 | **8.46** |
| turns | 8 | 18 | 23 | 46 / 12 | **98** |
| duration | 32.1 s | 94.8 s | 131.7 s | 233.9 s / 69.8 s | **~13 min** |
| fence refusals | 1 | 1 | 1 | 1 / 0 | **2** |
| lap committed its work | yes | yes | yes | yes / yes | **yes** |
| model reading taken | -- | -- | no | yes / yes | **yes (1 major)** |
| who drove it | worker | worker | worker | the person, at the terminal | **the person, on the page** |

The jump is the request, not the surface: #237 was three rendering residues across two source files
and a test file, and the lap wrote +431 / -69 lines to close them. But the draft that priced three
such laps at $7.50 was drawn from laps that cost around $1, and nothing on the scope screen said the
sample might not resemble the work.

## 6. New findings

### N-38. The model review's major finding on this lap is not filed, and the fix it names is unsealed against regression

The gate's model reading raised one `major`: the Checks bar's muting of its verdict over unreadable
work -- residue 3, the thing this lap was sent to fix -- is asserted by the tests **only through its
wording, never through the pill's tone**, so a regression restoring a green verdict over unreadable
work would pass the suite unchanged. Bases: `src/access/web.tsx:2023`, `src/access/web.tsx:2479`,
`test/access/web.test.ts:2859`, `test/access/web.test.ts:2893`. The owner approved over it knowingly
and recorded in **What you checked** that it would be raised as a follow-up. **It is the one
deliverable of this lap that the lap itself did not produce.**

### N-39. The page never says work is running, and the protection that makes a second press safe is invisible

Four separate surfaces are silent at once while a lap runs: the pressing tab (native navigation, no
repaint until the response), the **Start the work** button (live, unexplained), the **Requests** row
(still offering **Set the scope**), and the summary's running row (the state is there but smallest
and last, under a wall of request body). The footer's *live, updating every 5 seconds* converts that
silence into a positive signal that nothing is happening.

The asymmetry is the finding. The press is *already* safe to repeat: `startScopedFromPage`
(`src/access/cli.ts:4429`) holds the in-flight promise per lap id and joins a second press to the
first, covering both the overlapping press and the one that arrives after. The refusal screens say
*"pressing again is safe"* out loud. **The one press that spends money is the one that says
nothing.** This is not a missing guarantee; it is a guarantee the person is not told about, and they
pay for that in suspicion for the length of the lap.

### N-40. Publish reports nothing, and re-offers itself after succeeding

After a publish that pushed a branch, opened #242 and closed the run, the summary returned the lap's
row **in its pre-publish form, Publish link included**. Three things make this the heaviest finding
of the walk:

1. **The act is irreversible and outward.** It is the only press on this page that leaves the
   machine.
2. **The repeat fails.** Unlike **Start the work**, there is no join: a pull request that exists
   cannot be opened again, and the runbook says so.
3. **It is a press #239 already names as having no end-to-end test.** The first real walk of it
   produced a screen that gives no evidence of the outcome either way.

The only way to learn whether the press had worked was to open GitHub. That is reach 2 of section 2,
and it is caused entirely by a rendering gap over facts rondo already holds.

### N-41. Machine language, unrendered markup, and a named log the page cannot open

Three separate leaks on the surfaces a person actually reads:

- the approved row prints **`完了: answered_and_forwarded`**, a store constant
  (`APPROVED_OUTCOME`). The lap's own worker noted in its report that `gateOutcome` carries two
  spellings and that the inconsistency predates #237, and left it alone as out of scope -- correctly.
- the publish preview shows raw **`</details>`**. Showing the body byte for byte is the right policy;
  showing it unrendered is a separate decision, and it can be met (render the fold, offer a raw
  view) without changing a byte of what is sent.
- the running row prints **`ログあり <workspace path>`** and offers no way to read it. Naming a file
  the surface cannot open is worse than not mentioning it -- it tells the person exactly where to go
  and then makes them leave the page to get there.

### N-42. The budget draft broke on the first lap, closing the change path

The approved scope was **3 laps for $7.50**. The first lap cost **$8.46**. The draft's numbers came
from past laps in this store, which were roughly $1 each; nothing on the scope screen carried a
caveat that the sample might not resemble the work being priced.

The consequence is not bookkeeping. **Ask for a change** spends the approval its lap was admitted
under, so with the budget gone, the lap's only remaining answer was **approve** -- which is what the
owner chose, with a major finding open. A draft that is wrong by this much does not merely
mis-report; it removes the person's options at the gate. And the runbook's own escape (record a
second scope) does not help, because a second approval cannot continue the lap already running --
that is the page's known second hole.

### N-43. A lap cannot read the issue it is sent to fix

The lap's worker reported that `gh issue view 237` was refused at the sandbox boundary
(`api.github.com` denied). It worked entirely from the request body. That body was written carefully
enough that the lap succeeded, so this cost nothing here -- but the arrangement is *a request body
that has to be complete because the issue is unreachable*, and it should be recorded as an
environment constraint rather than discovered again under a thinner request.

### N-44. The entrances are quiet, the confirmations are loud, and the order is backwards

The owner's own reading of the walk, stated as a design position:

> 「控えめってのはなんの美徳でもないただの不便だよ」
>
> (Understatement is not a virtue of any kind. It is just inconvenience.)

Three instances observed: **Set the scope** after sending a request; **Publish** on an ended row;
and, in the same family, the page's inability to say a lap is running. Understatement protects
nothing here -- what protects a person from a mis-press is *seeing what the press will do before it
happens*, and this page already has confirmation screens for exactly that. Given the confirmation,
the entrance can be plain.

Two distinctions belong with the finding:

- **This is not a criticism of the publish screen's refusal design.** When a reading does not cover
  the work, the page draws **no Publish button at all** and puts **Publish without that reading**
  inside a fold. That is not understatement, it is a deliberate refusal with an explicit override --
  unread and read-and-nothing-raised must not look alike. That design is right and this finding does
  not touch it.
- **The current arrangement is internally inconsistent.** The *entrances* are faint links while the
  *execute* buttons on the confirmation screens are large and coloured. That is the wrong way round:
  the entrance leads to a screen that explains itself, and the execute button is the one press whose
  weight the person has just read about.

## 7. Compared with lap 9

| | lap 9 (the person at the terminal) | **lap 10 (the person on the page)** |
|---|---|---|
| what the person operated | pasted blocks from a purpose-written note | buttons, in a browser |
| ids handled by the person | several, carried in shell variables, extracted with `grep` / `sed` | **none** |
| a deliberately failed command to read a digest | required | **not required** -- the digests are printed |
| person's decisions | 3 (scope, `revise`, `approve`) | 3 (scope, `approve`, `publish`) |
| reaches outside the surface | not a meaningful question: the surface was the terminal | **2**, both for *state*, neither for an action |
| laps | 2 ($1.884 + $0.456) | 1 ($8.46) -- the second was out of budget |
| where the person stopped | at a finding they had to work out how to act on (N-33) | **at "what do I do next", "is it running", and "did that work"** |
| the person's verdict on the surface | *"人間にはWebUIが必須"* (a human needs a Web UI) | understatement is not a virtue; the page must say what it is doing |

**lap 9's verdict has been acted on and holds: the page is the surface a person can use.** Nothing
this lap found was a missing verb, a missing screen or an unreachable step -- the arc is whole, the
ids are gone, and a person who had never typed a rondo command merged a pull request from a browser.

**What lap 10 adds is that reachability is not the same as legibility.** lap 9's friction was
*knowing how to act*; lap 10's is *knowing what has happened*. Both of this lap's reaches outside the
screen, and the loudest of its findings, are the page holding a fact it already has and not drawing
it. That is a smaller class of problem than lap 9's, and a cheaper one to close -- which is itself
the result.

### Candidate issues

Drafted as candidate issue bodies. Filing is the secretary's. Item 1 is the one the owner committed
to at the gate.

1. **Seal residue 3 against regression: assert the Checks pill's tone, not only its wording** (N-38).
2. **The page must say a lap is running, and say that a second press is safe** (N-39).
3. **Publish must report its outcome, and must not re-offer itself after succeeding** (N-40).
4. **Make the entrances as plain as the acts behind them** (N-44).
5. **Draft budgets from a sample that resembles the work, and say when it does not** (N-42).
6. **The reading surfaces leak machine language, raw markup, and a log nobody can open** (N-41, N-43).

## 8. Verification discipline

- This document changes no source file and records no store reading. Its numbers are the page's own
  figures as the owner read them off the screen, the pull request's own record (#242, merged
  `c72e388`), and the lap's reported diffstat.
- Where this record names a code path (`src/access/cli.ts:4429`), it was read on `c72e388` in this
  repository to confirm the behaviour described.
- The one claim here that is not directly observed is the reason the pressing tab does not repaint;
  it is stated as the native-navigation behaviour the runbook itself describes, and the observation
  recorded is only that the tab did not change.

## 9. What is left where it is

- **#238 and #239 both stand.** The scope numbers and the change text are still written by code, not
  drafted (#238); of #239's four presses, three are now walked once against real infrastructure and
  **Ask for a change** is not (section 4).
- **The follow-up in N-38 is unfiled.** Until it is, the lap's own fix is not sealed against the
  regression its reviewer named.
- PR #242 is merged and #237 is closed.
- The approved scope stands, exhausted, and expires on its own clock. The environment root
  `$HOME/rondo-lap-10` is left in place; removing it is the person's, and the runbook's warning
  applies -- unpublished work lives only in `$R/workspaces/`.
