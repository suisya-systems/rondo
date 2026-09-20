#!/usr/bin/env bash
#
# The language rondo writes its own prose to its one operator in: asked once,
# recorded where the operator can see and change it, and printed so setup can
# spell it into the files it writes (rondo#352, D-0080 rules 2.1 and 2.4).
#
# Split out of scripts/dogfood-env.sh the way scripts/start-command.sh was, and
# for the same reason: so it can be run -- and tested -- over a directory that
# is not the person's own. It reads and writes one file and prints one line. It
# starts nothing, installs nothing and reads no environment of its own.
#
# **The record is setup's memory, and not a file the host reads.** D-0056 rule
# 3 says RONDO_OPERATOR_LANGUAGE is "not removed, not given a file, and not
# given a precedence order of its own", and nothing here gives it one: the host
# still reads that one variable and only that, and the page's five steps are
# untouched. What this file holds is the answer setup got, kept so setup does
# not ask twice and so the next run writes the same host the operator already
# has -- exactly the standing of the store's path and the approver's name,
# which are also facts setup resolves and spells into the unit rather than
# facts the host discovers.
#
# **Asked, never guessed.** The host's locale is not consulted. rondo#352's
# "not this" names guessing from it as the wrong answer, and a person who is
# handed a question they can answer in one keystroke has not been asked to
# carry anything (D-0080).

set -euo pipefail

die() {
  printf 'operator-language.sh: %s\n' "$1" >&2
  exit 1
}

usage() {
  cat <<'USAGE'
usage: scripts/operator-language.sh --root DIR [--language TAG|ask]
                                    [--from-environment TAG]

Print the language tag rondo's host is to be given, having asked for it once
and remembered the answer under --root. Prints an empty line when nobody has
said and nobody could be asked.

options:
  --root DIR             where the environment lives; the record is written to
                         DIR/operator-language
  --language TAG         use TAG and record it, replacing whatever was
                         remembered. The word 'ask' puts the question again,
                         which is how somebody who has already run setup
                         changes their answer
  --from-environment TAG what RONDO_OPERATOR_LANGUAGE said, used only when
                         nothing is remembered yet

The question is written to stderr and the answer read from stdin, so the tag
on stdout is the whole of what a caller reads. It is asked on its own only
when stdin is a terminal; with --language ask it is asked whatever stdin is.
USAGE
}

root=
given=
from_environment=

while [ $# -gt 0 ]; do
  case "$1" in
    --root) [ $# -ge 2 ] || die "--root needs a value"; root=$2; shift 2 ;;
    --language) [ $# -ge 2 ] || die "--language needs a value"; given=$2; shift 2 ;;
    --from-environment)
      [ $# -ge 2 ] || die "--from-environment needs a value"; from_environment=$2; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; die "unknown argument '$1'" ;;
  esac
done

[ -n "$root" ] || die "--root is required"
[ -d "$root" ] || die "root '$root' is not a directory"

record="$root/operator-language"

# The grammar is `isLanguageTag` in src/refrain/plan.ts, spelled again here
# because this program runs before any of rondo is built and cannot ask it.
# **Checked on the way in rather than on the way out**: an ill-formed tag in
# the unit is a host that refuses to start (`operatorLanguage` in
# src/access/cli.ts), which is a setup that reported success and left a page
# nobody can open.
#
# **The whole value, and not a line of it.** `grep` matches a line, so a value
# holding a newline -- `ja` and then something else -- would pass on its first
# line and be written into the unit whole, where the host refuses it. bash's
# own `=~` anchors on the string, which is the thing being checked.
valid() {
  [[ $1 =~ ^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$ ]]
}

# The remembered tag, or empty. Comments and blank lines are skipped because
# the file is written with a header explaining itself: the operator is meant to
# be able to open it and know what they are looking at.
#
# **A record that is there and says nothing is an answer**, and the answer is
# English -- which is what the file's own header tells the operator emptying it
# will happen. So its existence is tracked apart from its content: falling back
# from an emptied record to the environment would let a variable left in a
# sourced `env.sh` put back the language they just removed, and writing it
# there would undo the edit as well.
remembered=
answered=0
if [ -f "$record" ]; then
  answered=1
  remembered=$(sed -e 's/#.*//' -e 's/[[:space:]]//g' -- "$record" | grep -v '^$' | head -n 1 || true)
  if [ -n "$remembered" ] && ! valid "$remembered"; then
    die "'$record' holds '$remembered', which is not an IETF language tag. A tag is a primary subtag and optional hyphenated subtags -- 'ja', 'zh-Hant'. Fix it, or empty the file for English."
  fi
fi

# **The languages rondo ships prose for, each named in itself** (D-0079 section
# 1: every set is whole, and none is English wearing another language's words).
# A person who reads neither can still count, and a person who reads one of
# them recognises their own. A tag outside this list is `--language TAG`, which
# is whoever installs rondo talking, not the person being asked.
ask() {
  local answer
  while :; do
    {
      printf '\n   Which language do you read? rondo writes its own prose to you in it.\n'
      printf '   rondo の画面はあなたが読む言葉で書かれます。どちらを読みますか。\n\n'
      printf '     1) English\n'
      printf '     2) 日本語\n\n'
      printf '   [1/2] '
    } >&2
    # EOF -- a closed stdin rather than a person -- is nobody answering, and
    # nobody answering is English, which is where the resolution already ends.
    if ! IFS= read -r answer; then
      printf '\n' >&2
      return 0
    fi
    case "${answer// /}" in
      1 | en) printf 'en'; return 0 ;;
      2 | ja) printf 'ja'; return 0 ;;
      '') : ;;
      *) printf '   1 or 2 / 1 か 2 を入力してください\n' >&2 ;;
    esac
  done
}

tag=
case "$given" in
  ask)
    tag=$(ask)
    ;;
  '')
    tag=$remembered
    if [ -z "$tag" ] && [ "$answered" -eq 0 ]; then
      tag=$from_environment
      # Asked only where there is somebody to ask, and only where nobody has
      # answered yet. A setup run from a script, a CI job or a sandbox is
      # nobody saying anything, which is what English is the floor for.
      if [ -z "$tag" ] && [ -t 0 ]; then
        tag=$(ask)
      fi
    fi
    ;;
  *)
    tag=$given
    ;;
esac

if [ -n "$tag" ]; then
  valid "$tag" ||
    die "--language '$tag' is not an IETF language tag. A tag is a primary subtag and optional hyphenated subtags -- 'ja', 'zh-Hant' -- and 'ask' puts the question."
fi

# Written only when it says something new, so a re-run of setup leaves the
# file's own mtime -- and any comment the operator added around the tag --
# alone. Written beside the destination and moved into place, like the two
# files start-command.sh writes.
if [ -n "$tag" ] && [ "$tag" != "$remembered" ]; then
  tmp="$record.tmp.$$"
  {
    printf '%s\n' '# The language rondo writes its own prose to you in (rondo#352).'
    printf '%s\n' '# One IETF language tag -- ja, en, zh-Hant. Setup asked once and wrote'
    printf '%s\n' '# this; change it here and run setup again, or run setup with'
    printf '%s\n' '# --language ask to be asked once more. Empty means English.'
    printf '%s\n' "$tag"
  } > "$tmp"
  mv -f "$tmp" "$record"
fi

printf '%s\n' "$tag"
