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
# language, the bounds, continuo's CLI, the port, the repository, node's real
# path, the checkout and the PATH the host is to run with all arrive here as
# arguments and are spelled into the two files. That is D-0080 rule 2: setup
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
                                --path VALUE [--repo OWNER/NAME] [--remote NAME]
                                [--language TAG] [--max-live N]
                                [--max-occupying N] [--opener PATH]
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
  --repo OWNER/NAME    the repository publishing reaches; without it the page
                       serves without a publish press
  --remote NAME        the git remote publish pushes to
  --language TAG       RONDO_OPERATOR_LANGUAGE, and the language the start
                       command's own sentences are composed in
  --max-live N         RONDO_MAX_LIVE
  --max-occupying N    RONDO_MAX_OCCUPYING
  --opener PATH        the program that opens a URL in the person's browser
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
repo=
remote=
language=
max_live=
max_occupying=
opener=
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
    --repo) [ $# -ge 2 ] || die "--repo needs a value"; repo=$2; shift 2 ;;
    --remote) [ $# -ge 2 ] || die "--remote needs a value"; remote=$2; shift 2 ;;
    --language) [ $# -ge 2 ] || die "--language needs a value"; language=$2; shift 2 ;;
    --max-live) [ $# -ge 2 ] || die "--max-live needs a value"; max_live=$2; shift 2 ;;
    --max-occupying) [ $# -ge 2 ] || die "--max-occupying needs a value"; max_occupying=$2; shift 2 ;;
    --opener) [ $# -ge 2 ] || die "--opener needs a value"; opener=$2; shift 2 ;;
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

# `value` as a systemd-quoted word. systemd splits an `ExecStart=` or
# `Environment=` line on whitespace and reads `\` as an escape, so the same
# directory name needs the same care one line lower.
sd_quote() {
  local text=$1
  text=${text//\\/\\\\}
  text=${text//\"/\\\"}
  printf '"%s"' "$text"
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
  printf 'URL=%s\n' "$(sh_quote "$url")"
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
seconds=0
while [ "$seconds" -lt "$WAIT_SECONDS" ]; do
  if "$NODE" -e 'fetch(process.argv[1],{signal:AbortSignal.timeout(2000)}).then(()=>{},()=>process.exit(1))' "$URL" >/dev/null 2>&1; then
    opened
    if [ -n "$OPENER" ]; then
      "$OPENER" "$URL" >/dev/null 2>&1 || true
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
  printf 'WorkingDirectory=%s\n' "$checkout"
  printf 'ExecStart=%s %s web --port %s' \
    "$(sd_quote "$node_bin")" "$(sd_quote "$checkout/bin/rondo.mjs")" "$port"
  if [ -n "$repo" ]; then printf ' --repo %s' "$(sd_quote "$repo")"; fi
  if [ -n "$remote" ]; then printf ' --remote %s' "$(sd_quote "$remote")"; fi
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
  printf '%s\n' 'Restart=always'
  printf '%s\n' 'RestartSec=2'
  printf '%s\n' ''
  printf '%s\n' '[Install]'
  printf '%s\n' 'WantedBy=default.target'
} > "$unit_tmp"
mv -f "$unit_tmp" "$unit_path"

printf '%s\n%s\n' "$command_path" "$unit_path"
