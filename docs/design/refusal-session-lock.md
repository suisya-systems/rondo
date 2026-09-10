# The lock a refusal releases — what `D-0019` rule 11 turns out to rest on

**Propose-only.** This document takes no decision. It measures the tree and the
pinned continuo, and ends in decision rows `S-1` … `S-6` for rondo's gate; the
entry those rows would create is not written here, because a second copy of an
accepted decision has no rule for which copy wins.

Raised as rondo#24, out of the review of the #13 change that taught the decoder
continuo `D-1102`'s `session_id`.

## 1. The question, as the issue puts it

`D-0019` rule 11 sends a `performing` iteration that **received a refusal** to
terminal `failed` and releases the single-flight lock, and sends one that
**received nothing** nowhere at all — the row stays `performing`, keeps the
lock, and waits for an operator's `abandon()`. The stated difference "is not how
bad the outcome was — it is whether anything might still be running"
([`DECISIONS.md:2536-2538`](../../DECISIONS.md)).

**What "the lock" is today, since rule 11's wording predates it.** `D-0023`
replaced `R-10`'s partial unique index with a counted bound: `maxOccupying`
counts the generated `occupying` column — every non-terminal status except the
two suspended ones — inside `reserve()`'s own `BEGIN IMMEDIATE`
(`src/store/sqlite.ts:429-495`, `D-0023` rule 8). It is **1** by default and
settable (`src/refrain/policy.ts:103-106`, `src/access/cli.ts:853-887`), and
`D-0023` rule 17 leaves it at one until continuo's `D-1104` lands the
holder-identity half, because continuo serialises `lap perform` on one global
delivery resource. So "the lock" below means **the execution slot a
`performing` row occupies**, and at the default it is exclusive; the rows here
are about *when the slot is given back*, which is the same question under either
bound.

`D-1102` then made some refusals name a session. If a refusal can name a session,
the reasoning goes, the child was alive at the moment the refusal was raised —
so is "an answer came back" still the same fact as "nothing of the lap's is
running", and should the lock wait for a confirmed stop or an `abandon()`?

The answer this document reaches is **yes, it is still the same fact, and for a
reason neither the issue nor rule 11 states**: not because a refusal implies a
stop, but because a refusal that *reaches rondo* implies the `lap perform`
process exited, and that process cannot exit while a child of its lap is alive.
The premise is sound and the wording under it was wrong. What the measurement
also turns up is that the hole rule 11 does have is somewhere else entirely — on
the `defect` path, which the interpreter treats as a second spelling of
`refused`.

Everything below is read off continuo at the pinned revision
`38c667b5126fdfdc0465e4a422e88b20a8b53044`
([`continuo.pin.json`](../../continuo.pin.json)) and rondo at this branch's base.
Nothing here was measured by running a lap; where a claim rests on reading rather
than on observation, it says so.

## 2. What a refusal names, and when

`lap perform` puts `session_id` on a refusal envelope for an enumerated list of
classes, and the list is enumerated rather than derived
(`src/lap/cli.ts:396-403` in continuo, documented at `:361-395`):

| refusal | carries `session_id` | what state it is |
|---|---|---|
| `LapRefused` raised **after** the walk returned | yes, when `root.ts` set it | the turn's report could not be read, was about another session, never came, or ran out of budget |
| `LoserTerminated` | yes | this claimant lost the lease inside the spawn-admission critical section |
| `IdentityUnconfirmed` | no | an identity was committed and never confirmed; naming it would report as spawned a session nothing read back |
| everything raised before the walk | no | the id in hand may belong to no binding at all |

The envelope carries **nothing else** about the session: `refusalLine` writes
`schema`, `ok`, `db`, the optional `session_id`, and `error: {class, message}`
(`src/cli/json_output.ts:277-290`), and `RefusalMetadata` has exactly one field
today (`:232-243`). There is no "the stop was confirmed" and no "this is an
unresolved hazard" key. rondo may not recover either from `error.message`
(`D-0015` rule 7). **So on the wire, "the child was stopped" and "the child may
be alive" are the same document.**

## 3. What continuo's teardown actually does

`performLap`'s `finally` (continuo `src/lap/root.ts:1497-1560`) runs on every
path out, refusals included, and it runs *before* the refusal is printed: the
refusal unwinds through this block and only then reaches `refuse()`, which writes
stderr (`src/lap/cli.ts:353-359`). The block stops the session when two
predicates hold, and abandons the delivery lease when the stop is not confirmed:

- `sessionMayBeStopped(failure)` (`root.ts:1589-1590`) is false in exactly one
  state — `LoserTerminated` with `stopAttempted === false`, which the
  orchestrator sets when a takeover writer has already **confirmed** the binding
  or is driving it at a newer epoch (`src/supervisor.ts:582-601`). The winner may
  have adopted this lap's child; a session-level stop cannot name a process
  generation, so no stop is fired and the exception carries the hazard.
- `stillThisLapsSession(...)` (`root.ts:1628-1641`) is false when the lap never
  reached a lease, when the run's active binding names another session, or when
  the **lease epoch moved** — i.e. after any takeover. Its own header notes the
  lease TTL defaults to 30 s against a 15-minute turn timeout, so a long turn
  routinely runs on an expired lease that anyone may claim.
- `stopSession(...)` (`root.ts:1654-1673`) returns false whenever the provider
  did not report success (`UNKNOWN_SESSION` excepted), and a false abandons the
  lease rather than releasing it.

**So the issue's reading of the code is right**: there are three states — not
one — in which a lap answers a refusal without having stopped the session it
named. Two of them (`stillThisLapsSession` false, stop unconfirmed) are not in
the issue's text.

## 4. The fact that decides it: a live child holds the CLI open

continuo's own teardown states the property, in the course of explaining why the
one deliberate non-stop is safe: *"the child is left running, and the provider
holds a referenced handle to it, so `lap perform` may not return until that child
exits"* (`root.ts:1581-1586`). Two readings corroborate it at the pin:

1. The CLI sets `process.exitCode` and never calls `process.exit`
   (`src/cli.ts:298`; `process.exit(` appears nowhere in continuo's `src/` except
   inside a fake worker's script text). The process leaves when the event loop
   drains, not when `main` returns.
2. The child handle is retained (`#sessions.set(sessionId, session)`,
   `src/session/claude_cli_provider.ts:1931`) and **never `unref`'d** — the only
   `unref` mentions in continuo's `src/` are comments about timers deliberately
   not being unref'd (`src/session/runtime.ts:956, 1220`). Its stdio are files,
   closed at spawn (`claude_cli_provider.ts:1834-1841`), so the `ChildProcess` is
   the handle that counts.

And on rondo's side, a CLI that does *not* leave is already not a refusal:
`invoker.ts` settles on `close`, and when its own timer fired it reports
`timedOut` regardless of what the child had printed
(`src/continuo/invoker.ts:402-475`), which maps to `noAnswer`
(`src/access/conductor.ts:79-126`) — the row keeps `performing` and keeps the
lock.

**Therefore, for the direct child of a lap: a decoded refusal in rondo's hands is
a `lap perform` process that ended through its own reporting path, and such a
process had no live child of its lap's.** (An *orderly* end — section 6 is where
the crash that ends a process without draining anything is dealt with, and it is
why this sentence says "through its own reporting path" rather than "exited".) The states of section 3 do not produce a refusal-with-a
live-worker; they produce a **hang**, which rondo's ceiling turns into the
`noAnswer` case rule 11 already keeps the lock for. Rule 11's conclusion survives;
its stated premise ("an answer arrived, so the CLI is over and nothing of its is
running") survives only as far as the *direct* child.

**What this does not establish, stated as unverified.** (a) The worker's own
descendants: the child leads its own process group (`runtime.ts:810-816`) and
continuo's provider stop signals the group, but nothing in the handle argument
covers a grandchild that outlives the child — rondo has no evidence either way.
(b) A session adopted by pid rather than by handle, which the `resume` path can
produce; the fresh-spawn path a rondo lap drives always holds a handle, and no
lap-1 path was found that does not, but this was read rather than exercised.
(c) None of this was reproduced by running a lap; it is a reading of the pinned
source.

## 5. rondo could not wait for a stop even if it decided to

Two measurements, both at the pin:

- **continuo's CLI has no session verb.** Its subparsers are `measure`,
  `attention`, `db`, `run`, `lap`, `gate` (`src/cli.ts:124-182`); `stop` exists
  only as a `SessionProvider` method (`src/session/provider.ts:1477`). The report
  line rondo prints on a session-naming refusal — *"what a transcript read or a
  'session stop' is keyed on"* (`src/refrain/interpreter.ts:1281-1283`,
  `:1310-1312`) — names a command an operator cannot run.
- **`run show` cannot answer liveness.** Its `sessions` rows carry
  `binding_phase`, `observation`, `provider_state` and `released_at_ms`
  (`src/control_plane/run_cli.ts:614-623`), but `provider_state` is a snapshot
  written when the identity was confirmed (`src/control_plane/session_binding.ts:239-263`)
  and **`released_at_ms` is never written by anything**: `releaseBinding` is
  exported (`src/index.ts:489`) and has no caller in continuo's `src/` or `test/`.
  A stopped session and a running one read identically. rondo's own `RUN_SHOW`
  decoder reads neither, taking only `run_id` and `status`
  (`src/continuo/protocol.ts:672-687`).

So "hold the lock until the stop is confirmed" has no fact to key on. The only
exit from such a hold would be an operator's `abandon()`, on every turn timeout —
which is precisely the inversion the issue warns about, bought for nothing.

## 6. Where rule 11 *is* thin: `defect`

The interpreter's `performing` branch handles `refused` and `defect` in one arm:
both go terminal `failed` and give the slot back
(`src/refrain/interpreter.ts:1269-1320`). For `refused` section 4 justifies that.
For `defect` it does not, because `defect` folds together two things that are
not alike — and the line between them is **not** the one section 4's argument
draws by itself.

**A numeric exit status is not evidence that the loop drained.** continuo's
`mainAsync` returns an `ArgparseExit`'s code and **rethrows everything else**
(`src/cli.ts:222-231`), and the entry point awaits it at top level (`:298`), so
an escaping exception ends the process at once — with exit 1, and without
draining anything. Section 4's handle argument covers an *orderly* exit and
nothing more. A throw from inside the teardown itself reaches this: `stopSession`
swallows the provider's failures (`root.ts:1654-1673`), but
`stillThisLapsSession` reads SQLite (`root.ts:1628-1641`) and a database error
there escapes the `finally` with the stop unfired and the child unstopped.

What *is* evidence is the exit status continuo's host contract defines. Only two
exist: `ArgparseExit` is constructed with 0 or 2 and with nothing else anywhere
in continuo's `src/`, and reaching either means the CLI came back through its own
reporting path, after the `finally` of section 3 had run. rondo's decoder already
sorts on exactly this and then loses the distinction one layer up:

| what the invocation did | `ContinuoResult` | maps to | slot given back? | did the CLI reach its own reporting path? |
|---|---|---|---|---|
| exit 0, document read | `answered` | `answered` | on suspend | yes |
| exit 2, refusal envelope or argparse prose | `refused` / `refusedInProse` | `refused` | yes | yes |
| exit 0, document unreadable or absent | `protocolRefusal` / `invokerDefect` | `defect` | yes | yes |
| **exit 1, or any other status** (`protocol.ts:903-911`) | `invokerDefect` | `defect` | **yes** | **no** |
| **death by signal** (`protocol.ts:891-895`) | `invokerDefect` | `defect` | **yes** | **no** |
| rondo's own ceiling fired | `timedOut` | `noAnswer` | no | no — and the slot is kept |

The two bold rows are the hole. A `lap perform` that crashed, or that something
other than rondo's timer killed — an OOM kill, a host shutdown, an operator's
Ctrl-C — may never have run its teardown to the end, may have left a worker
running, and carries no `session_id` for anyone to chase. rondo files it as a lap
that failed and gives the slot back. That is the state the invariant exists to
prevent, and it is reachable today without any refusal being involved.

It is *not* the ceiling case: rondo's own kill sets `firedOwnTimer` and becomes
`timedOut` (`invoker.ts:396-405, 452-470`), which is already correct. And it is
not a defect-versus-refusal distinction: an unreadable document from an orderly
exit 0 stays a `defect` and stays safe to release.

## 7. Decision rows

| # | Question | Recommendation |
|---|---|---|
| `S-1` | Does a refusal that names a session keep the slot? | **No — rule 11 stands.** A decoded refusal is a CLI that came back through its own reporting path, and section 4 is why that is evidence about the child rather than an assumption about it. |
| `S-2` | Then what changes? | **The reason under rule 11 is restated** to be the one that is true: the slot is given back because the invocation ended *through continuo's own reporting path*, not because continuo promised a stop. Rule 11's table is untouched. |
| `S-3` | Does `defect` stay rule 11's second spelling? | **Not for every `defect`.** The releasing fact is the **exit status**, not the outcome's class: continuo's contract defines 0 and 2 and constructs no other (`ArgparseExit` is built with those two alone), and either means the teardown ran and the CLI reported. An invocation that ended any other way — a death by signal, exit 1, no status at all — is a "nothing came back": the row stays `performing`, keeps the slot, and is reported as a rondo defect requiring a human, exactly as `noAnswer` already is. `decode` holds the fact today and discards it one layer up (section 6); giving it a variant of its own is the implementation's business, not this row's. |
| `S-4` | Is a "waiting for a stop" state introduced? | **No.** Nothing waits, `abandon()` gains no ordinary path, and no new non-terminal status is added to rule 11's table. |
| `S-5` | What does rondo do with the session id it now has? | **Name it, and nothing else** — as today, minus one repair: the report line stops citing `session stop`, which is not a command at the pin (section 5). A transcript read is what the id is actually good for. |
| `S-6` | Is anything asked of continuo? | **Yes, as an upstream ask rather than a rondo behaviour**: a refusal that declined to stop, or could not confirm one, is a fact only continuo holds, and the envelope has room for it beside `session_id`. Filed against continuo; rondo does not block on it. |

### What each rejected alternative costs

- **Hold the lock on any refusal that names a session, until a stop is confirmed
  or an operator abandons.** Rejected on section 5: there is no fact to confirm
  against at the pin, so the hold has exactly one exit — `abandon()` — and it
  would be taken on every ordinary turn timeout. It also aims at the wrong
  target: it would keep the lock in the three states of section 3 that section 4
  shows produce a hang rather than an answer, and leave section 6's real hole
  untouched. Lost: a genuinely conservative posture if section 4's handle
  argument is ever falsified — which `S-6`'s trigger list is what watches for.
- **Poll `run show` before releasing.** Rejected on section 5: `released_at_ms`
  is never written and `provider_state` is a stale snapshot, so the poll would
  answer the same for a stopped session and a running one. Lost: nothing today;
  the option reopens the moment continuo writes either field.
- **Have rondo stop the session itself.** Rejected: there is no CLI verb to
  drive (section 5), and in the one state continuo deliberately declines to stop,
  a stop is the dangerous move rather than the safe one
  (`root.ts:1563-1587`). Lost: nothing rondo can act on.
- **Change nothing at all.** Rejected only on `S-3` and `S-5`; on `S-1` this is
  the recommendation.

### Falsifiers and triggers

- **continuo `unref`s a child handle, calls `process.exit`, or otherwise lets
  `lap perform` return with a live child of its lap's.** Section 4's whole
  argument goes with it, and `S-1` is reopened. This is the trigger to watch when
  the pin moves.
- **continuo grows a `session` verb group, or puts a stop-confirmation field on
  the refusal envelope.** `S-5` and `S-6` are then answerable, and the middle
  option this document rejected becomes buildable.
- **`released_at_ms` acquires a writer.** The `run show` option reopens.
- **continuo constructs an `ArgparseExit` with a third code.** `S-3` keys on
  "the two statuses the host contract defines"; a third one would have to be
  sorted into "reported" or "ended abnormally" before it is released on.
- **`maxOccupying` is raised above one.** The ledger has *already* replaced the
  unique index (section 1), and at the default of one a retained `performing` row
  still excludes every other lap. Above one it does not, and what then stands
  between a second lap and an orphan is the allocator's per-iteration triple —
  the partial unique indexes on run id, topic branch and workspace
  (`src/store/sqlite.ts:791-819`) — plus continuo's single delivery resource,
  which is what `D-0023` rule 17 says refuses a second concurrent lap today.
  These rows change nothing about that and claim nothing about it: they decide
  *when the slot is given back*, and a host that raises the bound should re-read
  `D-0023` rules 17 and 18 rather than these.

## 8. What this document does not decide

The capacity ledger's shape (rondo#8), the worker's own descendants (section 4's
unverified (a)), and anything about `resume()`'s side of the loop. Nor does it
touch code: the rows above are propose-only and the implementation follows
ratification.
