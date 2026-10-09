# Putting the resident host on the latest `main` -- and the check that comes before it

The host is resident: one user service per machine, started by one word, serving the page from one
built checkout (`D-0080`). Moving it to a newer `main` is a fetch, a build and a restart. This file
is that procedure, written down, because it was being remembered instead.

**The restart is the step that can cost money, which is why it is third and not first.** Stopping
the service stops its control group -- the unit sets no `KillMode=`, so a `lap perform` child and
the worker it started go down with the host. The restarted host then finds that lap's driver and
child both gone, ends the row `failed` with the kind `lost`, and what the lap spent before it died
was never read and is not counted (`D-0139`, [`../../src/access/lost-laps.ts`](../../src/access/lost-laps.ts)).
So the first step is not an update step at all: it is the check that says the swap may begin.

**Run this in a normal terminal, outside any Claude Code sandbox.** Inside one, `systemctl --user`
is refused the bus ([`lap-12-runbook.md`](lap-12-runbook.md) section 1), so steps 1, 3 and 4 cannot
be done from there.

Paste the blocks below into **one** terminal, in order: each uses the variables section 0 set, and
the `unsetopt` line at the top of it covers the whole session
([runbook conventions 1](runbook-conventions.md)).

## 0. The host's facts, read off its own unit

Every fact the host runs with was spelled into `~/.config/systemd/user/rondo.service` by setup
(`scripts/start-command.sh`, `D-0080` rule 2), and a hand-edited unit or word is outside what rondo
supports (rule 2.4). So the unit is where these come from, and nothing below has a path written into
it.

```sh
unsetopt correct correct_all
UNIT=$HOME/.config/systemd/user/rondo.service
CHECKOUT=$(sed -n 's/^WorkingDirectory=//p' "$UNIT")
PORT=$(sed -n 's/^ExecStart=.*web --port \([0-9]*\).*/\1/p' "$UNIT")
CONTINUO_CLI=$(sed -n 's/^Environment="RONDO_CONTINUO_CLI=\(.*\)"$/\1/p' "$UNIT")
export RONDO_STORE="$(sed -n 's/^Environment="RONDO_STORE=\(.*\)"$/\1/p' "$UNIT")"
export RONDO_APPROVER="$(sed -n 's/^Environment="RONDO_APPROVER=\(.*\)"$/\1/p' "$UNIT")"
printf '%s\n' "$CHECKOUT" "$PORT" "$CONTINUO_CLI" "$RONDO_STORE" "$RONDO_APPROVER"
```

Five non-empty lines, in that order -- the checkout the page is served from, the port, the pinned
continuo build, rondo's own database, and the approver. On the machine this was written on:

```console
/home/happy_ryo/rondo-lap-19/rondo-host
7333
/home/happy_ryo/rondo-lap-19/continuo-1894e08ba9f72e1c0c0cd6113e583a4561bf3150/dist/cli.js
/home/happy_ryo/rondo-lap-19/rondo-iterations.sqlite3
happy_ryo
```

An empty line means that setting is not in the unit, and you are reading a host setup did not write.
Stop and find out what wrote it.

**Two of the five are exported and three are not, on purpose.** `RONDO_STORE` and `RONDO_APPROVER`
are read from the environment by the CLI, and **the word does not pass them on**: `rondo <anything>`
hands its arguments to the checkout's CLI with the host's `PATH` and nothing else (`D-0080` rules
1.1 and 1.2), so a bare `rondo inbox` in a fresh terminal refuses for a missing `RONDO_STORE`. The
other three are only typed into commands below. If your shell cannot find the word at all, write
`node "$CHECKOUT/bin/rondo.mjs"` wherever a step below writes `rondo`.

## 1. Check that no lap is running, before anything else

```sh
rondo inbox --actor-id "$RONDO_APPROVER"
```

Read the **in flight** section, which on a `ja` host is headed `実行中` and in English `in flight`.
The heading always carries its count, so a host with nothing running still prints it -- that is how
you tell "nothing is running" from a screen that failed to look
([`rondo-cli.md`](rondo-cli.md) section 8).

**You may go on to step 2 when that count is `(0)`:**

```console
実行中 (0)
```

**Anything under that heading means do not start the swap.** Wait, and ask again with the same
command; laps take tens of minutes. In particular:

| What the in-flight section shows | What it means | What to do |
|---|---|---|
| a row whose status word is `performing` | `lap perform` is in flight: a worker is running, and it is spending money | Wait. A restart now kills it, and the paragraph at the top of this page is what that costs |
| a row whose status is `planned`, `classified`, `admitting` or `admitted` | a short step on the way to `performing` | Wait. These are not covered by the lost-lap sweep, which reads `performing` rows only: a restart in `admitting` leaves a row that holds the single-flight lock with nothing able to release it but `rondo abandon` (`RELEASED_BY` in [`../../src/store/records.ts`](../../src/store/records.ts)) |
| a row reading `will not decode` / `読み取れません` | a live row rondo cannot read. It still holds a slot, and it is counted in the heading | Not a wait: it will not clear by itself. `rondo abandon --iteration-id ID --reason ...` ([`rondo-cli.md`](rondo-cli.md) section 7) |

**Rows under *waiting on you* do not block the swap.** `awaiting_human` and `withdrawal_requested`
are durable state in front of a person: the `lap perform` process has exited, continuo's delivery
lease went with it, and no fenced child survives it (`SUSPENDED_STATUSES` in
[`../../src/store/records.ts`](../../src/store/records.ts)). The restarted host finds them exactly
where they were. `stalled` is on that side of the wait too (`WAIT_SIDE`, same file), and a restart
neither helps nor harms it -- nothing drives a stalled row and only `rondo abandon` releases it --
but it is deliberately **not** suspended: "a person must decide" includes rondo being unable to say
that nothing is running, so it holds its execution slot fail-closed. It is a row to settle, not
evidence that the host is idle.

**This check is a look, not a lock.** Nothing stops a lap from starting while you build, so step 3
asks it again immediately before the restart. Looking also moves your last-look mark and counts what
was put to you (`D-0032` rules 9 and 10) -- that is the same screen your day starts on, and it is
the only cursor there is.

## 2. The latest `main`, and the build

The host's checkout is served, not worked in, so it should be clean and on `main`.

```sh
cd "$CHECKOUT"
git rev-parse --abbrev-ref HEAD
git status --porcelain
git fetch origin
git merge --ff-only origin/main
```

- `main` from the first line, and **nothing at all** from `git status --porcelain`. Output there is
  somebody having edited the live host by hand: stop and find out what it is before you build over
  it.
- `Fast-forward` (or `Already up to date.`) from the merge. A refusal means the checkout carries
  commits of its own, which this procedure has no step for.

Then install and build, in this order and with these flags:

```sh
node vendor/pin.mjs check
npm ci --ignore-scripts
npm run build; echo "EXIT=$?"
npm run page:check
```

- `node vendor/pin.mjs check` prints one `... is the pinned artifact: sha256 ...` line per vendored
  artifact and exits 0. **It comes before `npm ci`, always**: npm enforces its integrity hash
  against its cache, so a drifted tarball is `EINTEGRITY` on a cold cache and a silent install of
  the previously pinned bytes on a warm one (`D-0018` rule 4, `AGENTS.md` section 4).
- `npm ci --ignore-scripts`, never `npm install`: a fresh `npm install` in this repository fails
  outright (`D-0007`).
- `npm run build` prints nothing of its own on success, which is why the status is echoed rather
  than read off the output. Read it from an **unpiped** run -- a piped `EXIT=0` is the pipe's
  (`AGENTS.md` section 4).
- `npm run page:check` prints one `... is the recorded file: sha256 ...` line per served file. That
  is the cheap proof the build really produced this commit's page, since those are the bytes the
  host will serve.

The rest of `npm run verify` is not part of a swap: that commit's verification ran on its pull
request, where `gate` is the required check (`AGENTS.md` section 8).

**Then check the continuo pin, before you touch the running host.** `main` may have moved it, and
the build above does not build continuo -- rondo drives it as a separate pinned subprocess
(`D-0017`).

```sh
grep versionLine continuo.pin.json
node "$CONTINUO_CLI" --version
```

Both must name the same revision:

```console
  "versionLine": "@suisya-systems/continuo 0.0.0 (rev 1894e08ba9f72e1c0c0cd6113e583a4561bf3150)"
@suisya-systems/continuo 0.0.0 (rev 1894e08ba9f72e1c0c0cd6113e583a4561bf3150)
```

If they differ, **stop before the restart**. This host has not got the continuo the new `main`
drives, and rondo checks that build's `--version` against the pin before it drives it
([`../../src/continuo/pin.ts`](../../src/continuo/pin.ts)): no lap can run, and the page comes up
saying, per lap, `the gate question could not be read: continuo is not usable`
([`../../src/access/page-actions.ts`](../../src/access/page-actions.ts)). Getting the new revision
built *and* pointed at by the unit is a setup run, not a step of this page: the pinned clone and
build are [`rondo-cli.md`](rondo-cli.md) section 1, and `RONDO_CONTINUO_CLI` in the unit is setup's
to write (`D-0080` rule 2.4).

**Keep the gap between this step and the next one short.** The old host is still serving, and the
files under it have just changed: its own code is the graph it loaded at startup, but the page's
static files are read from disk per request against the manifest it read at *its* start
([`../../src/access/web-app.ts`](../../src/access/web-app.ts)), so until the restart it can serve
new bytes from old code, and 404 an asset only the new manifest names.

## 3. The restart

Ask step 1's question once more -- the host has been live and admitting all through step 2 -- and
then restart:

```sh
rondo inbox --actor-id "$RONDO_APPROVER"
systemctl --user show -p MainPID --value rondo.service
systemctl --user restart rondo.service
systemctl --user show -p MainPID --value rondo.service
```

- `実行中 (0)` / `in flight (0)` again. If a lap started while you were building, you are back at
  step 1: the build is done and harmless, and it waits.
- The two `MainPID` lines are **different numbers**, the second non-zero. That is the one cheap
  proof the process was replaced.
- No `daemon-reload`: this changed the checkout, not the unit. (Setup is the thing that rewrites the
  unit, and it restarts the host itself when it does -- `systemctl --user try-restart rondo.service`
  in `scripts/dogfood-env.sh`.)

**`systemctl --user is-active` is not the proof you want here.** The unit is `Type=simple`, so the
service is called active the moment it is spawned, before it has bound the port; and with
`Restart=always` and `RestartSec=2` a host that refuses to start is respawned every two seconds, so
`active` is also what a crash loop looks like (measured in `scripts/start-command.sh`). Step 4 is
the check.

## 4. The page opens

```sh
rondo
```

The word with nothing after it is the start: it makes sure the service is running, waits up to 30
seconds for the page to answer, opens it, and comes back
([`rondo-cli.md`](rondo-cli.md) section 0). **It is the right check here because of what it
compares** -- the unit is active, the process holding the port is the service's own `MainPID`, and
the page answers. A stranger on that port answers exactly as well as rondo does, which is what
`scripts/start-command.sh` measured and why it looks at the owner too.

One line, in the host's own language -- `ja` here, and the same sentence on an English host:

```console
rondo の画面を開きました。出てこないときは、ここにあります: http://127.0.0.1:7333/
rondo is open. If it did not come up in your browser, it is here: http://127.0.0.1:7333/
```

Exit 0, and the page in the browser. That is the swap done.

**If instead it prints its three sentences** -- `rondo の画面を、このコンピューターでは開けません。`,
or `rondo's page cannot be opened on this computer.` -- the host did not come up. Those sentences are
the person's and deliberately name no unit, no path and no log (`D-0076` rule 4.2); what the service
said is in the journal, which is yours:

```sh
journalctl --user --no-pager -n 50 -u rondo.service
```

**"Which `main` is this?" is a question about the checkout, not about the page.** What the host runs
is the checkout's HEAD as it stood when the process started -- which is the whole reason the restart
comes after the build and nothing else moves the checkout in between -- so the answer is
`git -C "$CHECKOUT" rev-parse HEAD`.
