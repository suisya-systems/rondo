# Writing a dogfood runbook

Conventions every `lap-N-runbook.md` (and any other docs/operations page a
person pastes commands from) is expected to follow. Each was paid for by a
real lap going wrong in a way the runbook itself could have prevented.

## 1. A paste block must not depend on the shell's interactive options

lap 9 hit `zsh: correct ... [nyae]?` on every step ([`lap-9-dogfood.md`](lap-9-dogfood.md)
N-37): the person's interactive zsh has spelling correction on, and a paste
block that trips it stalls mid-paste waiting on a prompt the block never
shows you is coming.

**Fix: open every runbook's first terminal block with**

```sh
unsetopt correct correct_all
```

**Why this is the line, not something narrower:** `unsetopt correct
correct_all` turns off zsh's interactive correction for the rest of that
shell session, so it only has to appear once, at the top of the first block a
person pastes into a fresh terminal — every later block pasted into the
*same* terminal inherits it. The alternative, `nocorrect`, is a precommand
modifier: prefixed to one line it disables correction for that line only
(not just its first word, the whole line), which is the tool to reach for
when you cannot rely on an earlier block having already run in that shell,
not a substitute for the `unsetopt` line at the top.

Each new terminal a runbook opens ([`lap-10-runbook.md`](lap-10-runbook.md)
step 3 opens one to run the page) starts with zsh's default options again, so
it needs its own `unsetopt` line if its own commands are exotic enough to
trigger correction — check by actually running the block in an interactive
zsh, not by reading it.

## 2. Expected files come from the change's call sites, not from the issue

lap 9 built its "files this lap should touch" table by reading the issue and
listing what it named, then used that table as a pass/fail filter at the
gate — and called `src/access/scope.ts`, a file the lap had genuinely and
correctly changed, out of scope, because the issue never mentioned it.

lap 10 ([`lap-10-runbook.md`](lap-10-runbook.md) step 4) derived its table
the other way: read the change the issue describes, find what actually
*draws* the screens or holds the behavior it touches, and list those call
sites. That is how `page.manifest.json` ended up on the list even though no
issue text ever names it — `page/app.css` scans `src/access/**/*.tsx` for
Tailwind classes, so a class string changing in a `.tsx` file changes the
served stylesheet's bytes, and `npm run verify` runs `page:check` against
the recorded manifest.

**When writing this table for a new runbook:** trace each point the issue
raises to the code that would have to change to satisfy it, not to the words
the issue used to describe the point. Include generated or derived artifacts
(manifests, snapshots, lockfiles) that the traced files feed into.

**The table is a set of questions, not a verdict.** A file the change
touches that is not on the table is not a violation to reject at the gate —
it is something to ask the worker to explain. lap 9's mistake was scoring a
real, correct file change as "out of scope" because it failed a filter the
issue text had never been able to fully name in the first place.
