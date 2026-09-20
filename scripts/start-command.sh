#!/usr/bin/env bash
#
# Write the one word a person types to start rondo, and the service it hands
# the host to (D-0080 rules 2.1, 2.5 and 2.6).
#
# This is setup's last writing step, split out of scripts/dogfood-env.sh so it
# can be run -- and tested -- over a directory that is not the person's own.
# It writes two files and nothing else: it starts nothing, enables nothing and
# reads no environment. Installing what it wrote (`systemctl --user enable`,
# linger) is the caller's, because that is an act on the machine and this is a
# writer.
#
# **Every fact the command needs is written into it.** The program reads no
# file, sources nothing and looks at no variable: the store, the approver, the
# language, the bounds, continuo's CLI, the port, the remote, node's real path,
# the checkout and the PATH the host is to run with all arrive here as
# arguments and are spelled into the two files. **The forge repository is not
# among them** (D-0081's annotation on rule 2.1): one host serves several
# repositories, each named by the plan a request was drafted from, so a slug on
# the start line would be one host fact too many. That is D-0080 rule 2: setup
# composes, the host is told what it is told today, and nothing discovers
# anything at a start. When one of those facts moves, setup runs again and
# writes these files again (rule 2.4); a hand-edited start command is outside
# the entry.
#
# **The program's few sentences are the person's** (D-0080 rule 4.3). They are
# the one terminal surface rondo writes for the person rather than for whoever
# installs rondo, so they are composed in the person's language and are not
# held to ASCII or to D-0004's escape. They are composed per language and never
# translated from the English set (D-0079 section 1), and they name no unit, no
# path, no log and no variable (D-0076 rule 4.2). Every other string in this
# file -- everything whose reader is the second reader -- stays English ASCII.

set -euo pipefail

die() {
  printf 'start-command.sh: %s\n' "$1" >&2
  exit 1
}

usage() {
  cat <<'USAGE'
usage: scripts/start-command.sh --node PATH --checkout DIR --port N
                                --store PATH --approver ID --continuo-cli PATH
                                --path VALUE [--remote NAME]
                                [--language TAG] [--max-live N]
                                [--max-occupying N] [--opener PATH]
                                [--notifier PATH]
                                [--bin-dir DIR] [--unit-dir DIR]

Write the start command (the one word) and the user service it starts.

options:
  --node PATH          node's real path, not a version manager's per-shell shim
  --checkout DIR       the built rondo checkout the host is served from
  --port N             the port the page listens on
  --store PATH         RONDO_STORE, absolute
  --approver ID        RONDO_APPROVER
  --continuo-cli PATH  RONDO_CONTINUO_CLI
  --path VALUE         the PATH the host runs with, holding the real
                       directories of git, gh, claude, codex and node. The
                       service manager's own PATH holds none of them
  --remote NAME        the git remote publish pushes to
  --language TAG       RONDO_OPERATOR_LANGUAGE, and the language the start
                       command's own sentences are composed in
  --max-live N         RONDO_MAX_LIVE
  --max-occupying N    RONDO_MAX_OCCUPYING
  --opener PATH        the program that opens a URL in the person's browser
  --notifier PATH      the program that puts one line in front of the person
                       when they are not looking at the page. Unlike --opener,
                       the host runs this one, so it is given to the service
                       and not to the word
  --bin-dir DIR        where the word goes. Default: $HOME/.local/bin, a
                       directory the shell already searches
  --unit-dir DIR       where the unit goes.
                       Default: ${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user
USAGE
}

# The word, and the unit named after it. One constant rather than an option:
# the two names have to agree, and the person is given exactly one of them.
command_name=rondo
unit_name="$command_name.service"

# How long the word waits for the page to answer before it says rondo cannot
# be opened. A cold start builds nothing -- the checkout is already built -- so
# this is process start plus the store opening.
wait_seconds=30

node_bin=
checkout=
port=
store=
approver=
continuo_cli=
path_value=
remote=
language=
max_live=
max_occupying=
opener=
notifier=
bin_dir=$HOME/.local/bin
unit_dir=${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user

while [ $# -gt 0 ]; do
  case "$1" in
    --node) [ $# -ge 2 ] || die "--node needs a value"; node_bin=$2; shift 2 ;;
    --checkout) [ $# -ge 2 ] || die "--checkout needs a value"; checkout=$2; shift 2 ;;
    --port) [ $# -ge 2 ] || die "--port needs a value"; port=$2; shift 2 ;;
    --store) [ $# -ge 2 ] || die "--store needs a value"; store=$2; shift 2 ;;
    --approver) [ $# -ge 2 ] || die "--approver needs a value"; approver=$2; shift 2 ;;
    --continuo-cli) [ $# -ge 2 ] || die "--continuo-cli needs a value"; continuo_cli=$2; shift 2 ;;
    --path) [ $# -ge 2 ] || die "--path needs a value"; path_value=$2; shift 2 ;;
    --remote) [ $# -ge 2 ] || die "--remote needs a value"; remote=$2; shift 2 ;;
    --language) [ $# -ge 2 ] || die "--language needs a value"; language=$2; shift 2 ;;
    --max-live) [ $# -ge 2 ] || die "--max-live needs a value"; max_live=$2; shift 2 ;;
    --max-occupying) [ $# -ge 2 ] || die "--max-occupying needs a value"; max_occupying=$2; shift 2 ;;
    --opener) [ $# -ge 2 ] || die "--opener needs a value"; opener=$2; shift 2 ;;
    --notifier) [ $# -ge 2 ] || die "--notifier needs a value"; notifier=$2; shift 2 ;;
    --bin-dir) [ $# -ge 2 ] || die "--bin-dir needs a value"; bin_dir=$2; shift 2 ;;
    --unit-dir) [ $# -ge 2 ] || die "--unit-dir needs a value"; unit_dir=$2; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; die "unknown argument '$1'" ;;
  esac
done

# Flag name and the variable it landed in, which differ where the flag's own
# word is already taken in a shell (`--path`) or too bare to read (`--node`).
for required in node:node_bin checkout:checkout port:port store:store \
  approver:approver continuo-cli:continuo_cli path:path_value; do
  variable=${required#*:}
  [ -n "${!variable}" ] || die "--${required%%:*} is required"
done
case "$port" in
  '' | *[!0-9]*) die "--port must be a number, got '$port'" ;;
esac

url="http://127.0.0.1:$port/"

# `value` as a single-quoted POSIX shell word. The program below is written
# once and run in whatever shell the person has, so a store path holding a
# space, a `$` or a quote -- all legal in a directory name -- has to survive
# being read back as a literal rather than being expanded somewhere else.
sh_quote() {
  local text=$1
  text=${text//\'/\'\\\'\'}
  printf "'%s'" "$text"
}

# `value` as something systemd reads back as itself, three ways, because
# systemd rewrites a unit line three times over and each setting takes a
# different subset of that. A directory name may legally hold every character
# involved, and a fact that does not survive being written is a host started
# somewhere else.
#
#  1. **A specifier**, `%` followed by a letter, is expanded in every setting,
#     and an unknown one invalidates the line. `%%` is how a literal `%` is
#     written, so every value below goes through `sd_percent` first.
#  2. **Quoting and `\`** apply where the value is one word of several
#     (`ExecStart=`, `Environment=`), and not to a path setting, which takes
#     the rest of its line as it stands.
#  3. **`$name` and `${name}` are expanded in `ExecStart=`**, inside double
#     quotes as well, so a `$` in a path there is written `$$`. In an
#     `Environment=` value a `$` is already literal -- the expansion happens
#     where the variable is used -- so escaping it there would write the
#     backslash into the value.
sd_percent() {
  local text=$1
  printf '%s' "${text//%/%%}"
}

sd_quote() {
  local text
  text=$(sd_percent "$1")
  text=${text//\\/\\\\}
  text=${text//\"/\\\"}
  printf '"%s"' "$text"
}

# One word of an `ExecStart=`, where a `$` is a variable and not a character.
sd_exec_quote() {
  local text=$1
  text=${text//\$/\$\$}
  sd_quote "$text"
}

# A path setting: no quoting, no `\` escape, and the specifier rule alone.
sd_path() {
  sd_percent "$1"
}

# The sentences the person reads, one whole set per language and never one
# language's overrides on top of another's (D-0079). `broken` says, in
# D-0076 rule 4.1's order: what cannot happen now, whether anything was done or
# spent, and what happens next -- which here is that only whoever installed
# rondo can repair it (rule 4.3's form). `opened` is the address, so the person
# does not hold it either (D-0080 rule 4.4).
case "$language" in
  ja | ja-* | ja_*)
    broken_1='rondo の画面を、このコンピューターでは開けません。'
    broken_2='まだ何も始まっていません。お金もかかっていません。'
    broken_3='このコンピューターの rondo は、動かせる状態ではなくなっています。入れた人に見てもらってください。'
    opened_line='rondo の画面を開きました。出てこないときは、ここにあります: %s\n'
    ;;
  *)
    broken_1="rondo's page cannot be opened on this computer."
    broken_2='Nothing has started, and nothing has been spent.'
    broken_3='Setup of rondo on this computer has stopped working. The person who installed it is the one who can look.'
    opened_line='rondo is open. If it did not come up in your browser, it is here: %s\n'
    ;;
esac

mkdir -p -- "$bin_dir" "$unit_dir"

command_path="$bin_dir/$command_name"
unit_path="$unit_dir/$unit_name"

# Written beside the destination and moved into place, so a person whose shell
# runs the word while setup is writing it never reads half a program.
command_tmp="$command_path.tmp.$$"
unit_tmp="$unit_path.tmp.$$"

{
  printf '%s\n' '#!/bin/sh'
  printf '%s\n' '#'
  printf '%s\n' '# rondo, as the person who uses it types it: one word, nothing after it.'
  printf '%s\n' '# Written by scripts/start-command.sh (D-0080). Every host fact is spelled'
  printf '%s\n' '# into the block below, so this reads no file and no variable of its own.'
  printf '%s\n' '# When one of them moves, setup writes this file again; editing it by hand'
  printf '%s\n' '# is outside what rondo supports (D-0080 rule 2.4).'
  printf '%s\n' 'set -u'
  printf '%s\n' ''
  printf '%s\n' '# --- facts, from the setup run that wrote this file'
  printf 'PATH=%s\n' "$(sh_quote "$path_value")"
  printf '%s\n' 'export PATH'
  printf 'NODE=%s\n' "$(sh_quote "$node_bin")"
  printf 'CLI=%s\n' "$(sh_quote "$checkout/bin/rondo.mjs")"
  printf 'URL=%s\n' "$(sh_quote "$url")"
  printf 'PORT=%s\n' "$port"
  printf 'UNIT=%s\n' "$(sh_quote "$unit_name")"
  printf 'OPENER=%s\n' "$(sh_quote "$opener")"
  printf 'WAIT_SECONDS=%s\n' "$wait_seconds"
  printf '%s\n' '# --- end facts'
  printf '%s\n' ''
  printf '%s\n' '# --- sentences'
  printf 'broken() {\n  printf %s %s %s %s\n}\n' \
    "'%s\\n'" "$(sh_quote "$broken_1")" "$(sh_quote "$broken_2")" "$(sh_quote "$broken_3")"
  printf '%s\n' ''
  printf 'opened() {\n  printf %s "$URL"\n}\n' "$(sh_quote "$opened_line")"
  printf '%s\n' '# --- end sentences'
  cat <<'PROGRAM'

# **A word with something after it is the other reader's** (D-0080 rules 1.1
# and 1.2). The person types one word and nothing else; whoever installs and
# repairs rondo keeps the terminal and every flag on it, and once this file is
# what their shell finds, `rondo web --repo OWNER/NAME` has to be that command
# and not this one quietly starting a service instead.
if [ "$#" -gt 0 ]; then
  exec "$NODE" "$CLI" "$@"
fi

# What the word does: make sure the host is running, wait until the page
# answers, and open it (D-0080 rule 2.6). The host is a resident service, so
# this returns and the terminal window may be closed.
if ! systemctl --user start "$UNIT" >/dev/null 2>&1; then
  broken
  exit 1
fi

# Asked with node rather than with curl: node's real path is a fact this
# command already carries, and one fewer program to find is one fewer way for
# a start to fail. Any answer at all means the page is up -- it answers a
# redirect at the root, and a redirect is an answer.
#
# **An answer is not enough on its own.** Something else listening on this port
# answers exactly as well as rondo does, and a simple service is called started
# the moment it is spawned, before it has bound anything -- measured here
# (2026-09-20): with a stranger on the port, the service is `active` and the
# stranger's page answers within a tenth of a second, and the word said rondo
# was open. So the process holding the port is compared with the service's own,
# and a page belonging to somebody else is a rondo that did not come up.
# **A socket with no owner in it is somebody else's, not an answer to skip.**
# `ss` prints the owning process only for sockets this user may see, so a
# listener with no `pid=` belongs to another user -- which is precisely the
# case this is here for. Not being able to ask at all (no `ss` on this machine)
# is the different thing, and only that one leaves the answer to the page.
answered_by_rondo() {
  sockets=$(ss -ltnpH "sport = :$PORT" 2>/dev/null) || return 0
  if [ -z "$sockets" ]; then
    return 0
  fi
  listener=$(printf '%s\n' "$sockets" | sed -n 's/.*pid=\([0-9]\{1,\}\).*/\1/p' | head -n 1)
  if [ -z "$listener" ]; then
    return 1
  fi
  [ "$listener" = "$(systemctl --user show -p MainPID --value "$UNIT" 2>/dev/null)" ]
}

seconds=0
while [ "$seconds" -lt "$WAIT_SECONDS" ]; do
  if systemctl --user is-active --quiet "$UNIT" && answered_by_rondo &&
    "$NODE" -e 'fetch(process.argv[1],{signal:AbortSignal.timeout(2000)}).then(()=>{},()=>process.exit(1))' "$URL" >/dev/null 2>&1; then
    opened
    # Detached, because the word is done here: an opener that runs the browser
    # in the foreground would hold this terminal for as long as the browser is
    # open, which is the window rule 2.6 says may be closed.
    if [ -n "$OPENER" ]; then
      ("$OPENER" "$URL" </dev/null >/dev/null 2>&1 &) || true
    fi
    exit 0
  fi
  seconds=$((seconds + 1))
  sleep 1
done

# What the service said is in the journal, where whoever maintains rondo on
# this machine can read it. The person is not sent there (D-0076 rule 4.2).
broken
exit 1
PROGRAM
} > "$command_tmp"
chmod 755 "$command_tmp"
mv -f "$command_tmp" "$command_path"

{
  printf '%s\n' '# rondo, the resident host. Written by scripts/start-command.sh (D-0080'
  printf '%s\n' '# rule 2.6). Installing it is installation, once per host; the word in'
  printf '%s\n' "# $bin_dir is what starts it."
  printf '%s\n' '[Unit]'
  printf '%s\n' 'Description=rondo, the page a person talks to'
  printf '%s\n' ''
  printf '%s\n' '[Service]'
  printf '%s\n' 'Type=simple'
  # Unquoted, unlike the two lines below it: `WorkingDirectory=` is a path
  # setting and takes the rest of the line as it stands, so a quoted value is
  # read as a path that begins with a quote and the unit is refused outright
  # (`systemd-analyze verify`, 2026-09-20). A space in it needs no quoting
  # there for the same reason.
  printf 'WorkingDirectory=%s\n' "$(sd_path "$checkout")"
  printf 'ExecStart=%s %s web --port %s' \
    "$(sd_exec_quote "$node_bin")" "$(sd_exec_quote "$checkout/bin/rondo.mjs")" "$port"
  if [ -n "$remote" ]; then printf ' --remote %s' "$(sd_exec_quote "$remote")"; fi
  printf '\n'
  # The service manager's PATH holds only the system directories, where of the
  # four programs the host runs by name only `git` is found (D-0080's
  # measurement). So the PATH setup resolved is given to the service, and a
  # page whose drafter or reviewer cannot find its program is rule 2.1 not
  # having been written.
  printf 'Environment=%s\n' "$(sd_quote "PATH=$path_value")"
  printf 'Environment=%s\n' "$(sd_quote "RONDO_STORE=$store")"
  printf 'Environment=%s\n' "$(sd_quote "RONDO_APPROVER=$approver")"
  printf 'Environment=%s\n' "$(sd_quote "RONDO_CONTINUO_CLI=$continuo_cli")"
  if [ -n "$language" ]; then
    printf 'Environment=%s\n' "$(sd_quote "RONDO_OPERATOR_LANGUAGE=$language")"
  fi
  if [ -n "$max_live" ]; then
    printf 'Environment=%s\n' "$(sd_quote "RONDO_MAX_LIVE=$max_live")"
  fi
  if [ -n "$max_occupying" ]; then
    printf 'Environment=%s\n' "$(sd_quote "RONDO_MAX_OCCUPYING=$max_occupying")"
  fi
  # **The notifier goes to the service and the opener goes to the word**, and
  # the difference is who runs each. The opener is run once, by the word, when
  # the page answers; the notifier is run by the host, on its own minute, for
  # as long as it is resident -- so it is a fact the service is started with
  # (rondo#311). A host started without it reaches nobody and says nothing
  # about it, which is what setup finding no such program on this machine
  # means.
  if [ -n "$notifier" ]; then
    printf 'Environment=%s\n' "$(sd_quote "RONDO_NOTIFIER=$notifier")"
  fi
  printf '%s\n' 'Restart=always'
  printf '%s\n' 'RestartSec=2'
  printf '%s\n' ''
  printf '%s\n' '[Install]'
  printf '%s\n' 'WantedBy=default.target'
} > "$unit_tmp"
mv -f "$unit_tmp" "$unit_path"

printf '%s\n%s\n' "$command_path" "$unit_path"
