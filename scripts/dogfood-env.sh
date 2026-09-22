#!/usr/bin/env bash
#
# Stand up everything `rondo start` needs, in one command.
#
# The operator runbook (docs/operations/rondo-cli.md) describes this setup as
# prose because prose is what explains *why* each piece exists. This script is
# the same setup as a command, for the case where somebody wants the environment
# rather than the explanation. It provisions and prints; it never runs a lap,
# because a lap spawns a real worker session and costs real money.
#
# Almost everything it writes lives under one directory (--root), and outside
# it only four things are touched: the repository's own `node_modules` and
# `dist`, which are its ordinary build outputs, and -- since D-0080 -- the two
# things a start needs, the word itself in `~/.local/bin` and the user service
# it hands the host to. Removing rondo means removing those two as well, which
# is the cost D-0080 took knowingly.
#
# Re-running is safe. Every step checks for its own result first, so a second
# run repairs whatever is missing and leaves the rest -- including the control
# plane, the iteration store and the target repository, which hold state a
# rebuild must not discard.
#
# Re-running with another --target-repo is how a second repository is added
# (D-0081 rule 6.2). One store and one host serve all of them: the two files
# this script writes per repository -- the plan and the catalog layer -- are
# named for it, and the store keeps every plan it has been handed.

set -euo pipefail

usage() {
  cat <<'USAGE'
usage: scripts/dogfood-env.sh [--root DIR] [--iteration-id ID]
                              [--target-repo DIR] [--target-base-branch NAME]
                              [--forge-repo OWNER/NAME] [--decision-record PATH]
                              [--review-criterion FILE] [--port N]
                              [--remote NAME] [--language TAG|ask]
                              [--force-continuo-rebuild]

Provision a working environment for the rondo operator CLI and print the
commands that drive it.

options:
  --target-repo DIR
      point the lap at a repository that already exists, instead of creating a
      scratch one. This is the only place the target is named: the four plan
      fields that have to agree about it -- `repository`, `base_branch`, and
      `source.path` and `base_branch` inside the catalog layer, plus
      `project_name` to select it -- are all written from this one value, so
      they cannot disagree. Two of them saying different things is a mistake a
      hand-edited plan does not report until the lap has already run.
      DIR is used as it stands and is never modified: no seed commit, no
      `git config`, and its remotes are left exactly as they are.
      Running this script again under the same --root with another DIR adds a
      second repository rather than replacing the first (D-0081): the plan and
      the catalog layer are named for the repository, and the store holds the
      plans of all of them.
  --target-base-branch NAME
      the branch a lap is cut from. Default: `main` for the scratch target, and
      for --target-repo the branch that repository's own HEAD is on.
  --root DIR
      where the environment lives. Created if absent. Default: $RONDO_DOGFOOD_ROOT,
      or $XDG_STATE_HOME/rondo/dogfood-env (~/.local/state/rondo/dogfood-env)
      when that is unset. It must be outside any installed checkout: a root
      inside this repository, or one whose ancestors hold a `node_modules`, is
      refused, because npm would lend that checkout's toolchain to a lap that
      never installed (rondo#111).
  --iteration-id ID
      the iteration id the printed commands use. Default: dogfood-001.
      It is no longer written into the plan file: rondo derives the run id, the
      topic branch and the workspace from it (D-0023). A second lap does not
      need a second plan file -- `rondo start` takes --iteration-id and
      --prompt as flags. It must be a lowercase letter followed by up to 63
      more of [a-z0-9_-].
  --forge-repo OWNER/NAME
      the repository on the forge that this target's pull requests are opened
      in, written into the plan as `forge_repository` (D-0081 rule 3.2). It is
      a fact about the repository and not about the host: one host serves
      several repositories, and `publish` reads this from the plan of the lap
      it is publishing. Omit it for a target with no forge -- the scratch
      target is one, since its push remote is a bare repository on this disk --
      and the pull-request leg is then refused unless the host itself was given
      a --repo to fall back on.
      rondo never works this out from the target's remotes: a workspace is a
      worktree cut from a local path, and an inferred slug would be whatever
      that clone happened to point at (D-0075 rule 3.1).
  --decision-record PATH
      the target's decision record: one file of numbered entries with an index
      table (D-NNNN headings, one index row each), relative to the repository
      root, written into the plan as `decision_record` (D-0098 rule 3.1). rondo
      reserves its entry numbers when a lap is admitted and names them in the
      lap's request, and two lines may both append to it. Omit it for a target
      with no such file: its files are then ordinary paths.
  --review-criterion FILE
      a JSON file written into the plan as `review_criterion`:
      {"severities": {"blocker", "major", "minor", "nit"}, "rule_files": [...]}.
      Default: $RONDO_DOGFOOD_REVIEW_CRITERION, or
      scripts/dogfood-review-criterion.json when that is unset. A plan with no
      criterion gets an `unavailable` model reading on every lap, and an
      in-scope `rondo retry` is never admitted without one (rondo#205).
      An empty "rule_files" is written as ["AGENTS.md"] when the target's
      base branch has one: every lap is told to follow it (rondo#377).
  --port N
      the port the page listens on, written into the start command and the
      service setup installs. Default: 7333. The forge repository is not
      written there beside it: one host serves several repositories, each named
      by the plan a request was drafted from (D-0081).
  --remote NAME
      the git remote publish pushes to, when it is not the default.
  --language TAG|ask
      the language rondo writes its own prose to the operator in, as an IETF
      language tag. Setup asks for this once when nobody has said and there is
      somebody to ask, and remembers the answer in <root>/operator-language --
      a file the operator can open and change. Every later run reads it, and
      writes it into the service the word starts, so the language survives a
      fresh shell and whichever way the host is started. `ask` puts the
      question again, which is how somebody who has already run setup changes
      their answer. It is never guessed from this machine's locale.
  --force-continuo-rebuild
      rebuild the pinned continuo even when the built one already reports the
      pinned version line.
  -h, --help
      show this message.

environment (all optional; each is a path this machine has and this script
cannot discover):
  RONDO_DOGFOOD_ROOT            default for --root
  RONDO_DOGFOOD_REVIEW_CRITERION default for --review-criterion
  RONDO_APPROVER                the identity allowed to answer and publish.
                                Default: the current user name.
  RONDO_DOGFOOD_INTERLOCK_ROOT  the interlock checkout continuo fences against.
                                Default: $HOME/work/org/workers/interlock
  RONDO_DOGFOOD_CLAUDE_ORG_PATH the claude-org checkout continuo fences against.
                                Default: $HOME/work/org/claude-org-ja
  RONDO_DOGFOOD_CLAUDE_BIN      the worker CLI a lap spawns.
                                Default: the `claude` on PATH, resolved.
USAGE
}

die() { printf 'dogfood-env: %s\n' "$1" >&2; exit 1; }
step() { printf '\n== %s\n' "$1"; }
note() { printf '   %s\n' "$1"; }

repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)

# The default lives outside the repository. It used to be
# `<repo>/.worker-scratch/dogfood-env`, which kept the environment out of git and
# out of `biome check .` but cut every lap workspace inside an installed
# checkout -- and npm prepends every ancestor's `node_modules/.bin` to PATH, so
# the lap's build, lint, typecheck and tests ran on the operator's toolchain
# whether or not the lap installed one (rondo#111). Outside the repository both
# properties hold: nothing to stage, and nothing to borrow.
env_root=${RONDO_DOGFOOD_ROOT:-"${XDG_STATE_HOME:-$HOME/.local/state}/rondo/dogfood-env"}
run_id=dogfood-001
force_continuo_rebuild=0
port=7333
remote=
language=
target_repo=
target_base_branch=
forge_repo=
decision_record=
review_criterion=${RONDO_DOGFOOD_REVIEW_CRITERION:-"$repo_root/scripts/dogfood-review-criterion.json"}

while [ $# -gt 0 ]; do
  case "$1" in
    --root) [ $# -ge 2 ] || die "--root needs a value"; env_root=$2; shift 2 ;;
    --iteration-id) [ $# -ge 2 ] || die "--iteration-id needs a value"; run_id=$2; shift 2 ;;
    --target-repo) [ $# -ge 2 ] || die "--target-repo needs a value"; target_repo=$2; shift 2 ;;
    --target-base-branch)
      [ $# -ge 2 ] || die "--target-base-branch needs a value"; target_base_branch=$2; shift 2 ;;
    --forge-repo) [ $# -ge 2 ] || die "--forge-repo needs a value"; forge_repo=$2; shift 2 ;;
    --decision-record)
      [ $# -ge 2 ] || die "--decision-record needs a value"; decision_record=$2; shift 2 ;;
    --review-criterion)
      [ $# -ge 2 ] || die "--review-criterion needs a value"; review_criterion=$2; shift 2 ;;
    --port) [ $# -ge 2 ] || die "--port needs a value"; port=$2; shift 2 ;;
    --remote) [ $# -ge 2 ] || die "--remote needs a value"; remote=$2; shift 2 ;;
    --language) [ $# -ge 2 ] || die "--language needs a value"; language=$2; shift 2 ;;
    --force-continuo-rebuild) force_continuo_rebuild=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; die "unknown argument '$1'" ;;
  esac
done

# Absolute from here on. rondo refuses a relative path in the plan by field
# name, and it is right to: a relative path means something different to the
# fenced child than it does to the shell that typed it.
mkdir -p -- "$env_root"
env_root=$(cd -- "$env_root" && pwd -P)
[ -f "$review_criterion" ] ||
  die "review criterion '$review_criterion' is not a file; pass --review-criterion FILE"

# **Checked here rather than at publish**, which is the last place a person
# wants a surprise about where their work is going: publishing is outward and
# irreversible, and setup is the one moment a person is already being asked for
# facts about this repository. The shape is the forge CLI's own -- two segments,
# and rondo passes them on unchanged -- so anything with another number of
# slashes is not a repository the pull-request leg can be about.
if [ -n "$forge_repo" ]; then
  case "$forge_repo" in
    */*/* | /* | */) die "--forge-repo '$forge_repo' must be OWNER/NAME, the repository as the forge names one" ;;
    */*) : ;;
    *) die "--forge-repo '$forge_repo' must be OWNER/NAME, the repository as the forge names one" ;;
  esac
fi

# The check the default alone cannot make: --root and $RONDO_DOGFOOD_ROOT can
# still name a directory inside an installed checkout. A workspace there
# resolves `tsc`, `biome`, `knip` and `vitest` through an ancestor's
# `node_modules/.bin`, so a lap that skipped `npm ci` reports a green suite that
# is not its own (rondo#111). Refusing the root is the only place this can be
# caught: by the time the lap is running, the borrowed toolchain looks exactly
# like an installed one.
#
# Two ancestors have to be refused rather than merely inspected. The repository
# itself is one: this script runs `npm ci` in it a few steps below, so a root
# under it is inside an installed checkout by the time a lap runs even when the
# scan here finds nothing. Both paths are physical (`pwd -P`), because npm
# resolves ancestors through symlinks and a logical path would be scanned as
# somewhere it is not.
case "$env_root" in
  "$repo_root" | "$repo_root"/*)
    die "root '$env_root' is inside the rondo checkout '$repo_root', which this script installs; a lap cut there runs its toolchain whether or not it installed one. Use a --root outside it." ;;
esac
ancestor=$env_root
while :; do
  if [ -d "$ancestor/node_modules" ]; then
    die "root '$env_root' is inside an installed checkout ('$ancestor/node_modules'); npm would lend its toolchain to a lap that never installed. Use a --root outside it."
  fi
  parent=$(dirname -- "$ancestor")
  if [ "$parent" = "$ancestor" ]; then break; fi
  ancestor=$parent
done

approver=${RONDO_APPROVER:-$(id -un)}
interlock_root=${RONDO_DOGFOOD_INTERLOCK_ROOT:-"$HOME/work/org/workers/interlock"}
claude_org_path=${RONDO_DOGFOOD_CLAUDE_ORG_PATH:-"$HOME/work/org/claude-org-ja"}
claude_bin=${RONDO_DOGFOOD_CLAUDE_BIN:-}

# Absolute, not merely present. `readPlan` refuses a relative `interlock_root`
# or `claude_org_path` by field name, so a relative override that passes the
# directory check here would provision an environment whose very first `start`
# is refused -- a setup that reports success and hands over a plan that cannot
# run is worse than one that stops.
[ -d "$interlock_root" ] ||
  die "interlock root '$interlock_root' is not a directory; set RONDO_DOGFOOD_INTERLOCK_ROOT"
interlock_root=$(cd -- "$interlock_root" && pwd)
[ -d "$claude_org_path" ] ||
  die "claude-org path '$claude_org_path' is not a directory; set RONDO_DOGFOOD_CLAUDE_ORG_PATH"
claude_org_path=$(cd -- "$claude_org_path" && pwd)

if [ -z "$claude_bin" ]; then
  claude_bin=$(command -v claude 2>/dev/null || true)
  [ -n "$claude_bin" ] ||
    die "no 'claude' on PATH; set RONDO_DOGFOOD_CLAUDE_BIN to the worker CLI"
fi
[ -d "$(dirname -- "$claude_bin")" ] ||
  die "worker CLI '$claude_bin' is not in an existing directory; set RONDO_DOGFOOD_CLAUDE_BIN"
# Every token of claude_command must be absolute -- continuo's rule, not
# rondo's, and rondo passes it through rather than restating it.
claude_bin=$(cd -- "$(dirname -- "$claude_bin")" && pwd)/$(basename -- "$claude_bin")
# Checked here rather than left to the lap: a worker CLI that is not there is a
# refusal from inside a spawned fence, minutes and dollars after the mistake.
[ -x "$claude_bin" ] && [ -f "$claude_bin" ] ||
  die "worker CLI '$claude_bin' is not an executable file; set RONDO_DOGFOOD_CLAUDE_BIN"

# The interpreter the fenced endpoint runs under. `command -v node` on a machine
# with a version manager is a per-shell shim directory that will not exist in
# another shell, so resolve to the installation the shim points at.
node_bin=$(node -e 'process.stdout.write(require("node:fs").realpathSync(process.execPath))')

step "Language (the one question setup asks, rondo#352)"
# **Asked here, before anything is built**, so the one question a person is
# asked is not waiting behind a clone and a compile -- and so the answer is
# already in hand when the start command and the unit are written, which is the
# only place it is used.
#
# The record under --root is setup's memory and not a file the host reads
# (D-0056 rule 3): the host still reads RONDO_OPERATOR_LANGUAGE and only that,
# and this is the fact setup resolves and spells into the unit, beside the
# store's path and the approver's name. Every fact on that line is one setup
# resolved (D-0080 rule 2.1), and this one is now resolved by asking rather
# than by hoping the person exported a variable before typing this.
language_args=(--root "$env_root")
if [ -n "$language" ]; then language_args+=(--language "$language"); fi
# Only ever a seed for the first run: a variable left in a shell profile does
# not silently rewrite an answer the operator has already given.
if [ -n "${RONDO_OPERATOR_LANGUAGE:-}" ]; then
  language_args+=(--from-environment "$RONDO_OPERATOR_LANGUAGE")
fi
operator_language=$("$repo_root/scripts/operator-language.sh" "${language_args[@]}")
if [ -n "$operator_language" ]; then
  note "the page and the word speak '$operator_language'"
  note "$env_root/operator-language"
else
  note "nobody has said which language the page is read in, so it is English"
  note "to choose one: scripts/dogfood-env.sh --language ask"
fi

step "Pin"
# One read of continuo.pin.json, newline-delimited: the version line contains
# spaces, so it cannot share a line with the other two fields.
pin_read() {
  node -e '
    const pin = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
    process.stdout.write(pin[process.argv[2]]);
  ' "$repo_root/continuo.pin.json" "$1"
}
continuo_repo=$(pin_read repository)
continuo_rev=$(pin_read revision)
continuo_version_line=$(pin_read versionLine)
note "continuo $continuo_rev"
note "from $continuo_repo"

continuo_dir="$env_root/continuo-$continuo_rev"
continuo_cli="$continuo_dir/dist/cli.js"

step "rondo"
( cd -- "$repo_root" && node vendor/pin.mjs check )
( cd -- "$repo_root" && npm ci --ignore-scripts >/dev/null )
( cd -- "$repo_root" && npm run build >/dev/null )
note "built $repo_root/dist"

step "continuo (the pinned build rondo drives as a subprocess)"
built_version=""
if [ -f "$continuo_cli" ]; then
  built_version=$(node "$continuo_cli" --version 2>/dev/null || true)
fi
if [ "$force_continuo_rebuild" -eq 1 ] || [ "$built_version" != "$continuo_version_line" ]; then
  if [ ! -d "$continuo_dir/.git" ]; then
    git clone --quiet --no-checkout "$continuo_repo" "$continuo_dir"
  fi
  git -C "$continuo_dir" fetch --quiet origin "$continuo_rev" 2>/dev/null ||
    git -C "$continuo_dir" fetch --quiet origin
  git -C "$continuo_dir" checkout --quiet --detach "$continuo_rev"
  npm --prefix "$continuo_dir" ci --ignore-scripts >/dev/null
  # CONTINUO_REQUIRE_REVISION=1 turns "the revision could not be read" into a
  # failed build instead of a placeholder stamped into dist/build_revision.js.
  # In a git clone it changes nothing -- measured -- because the revision is
  # readable; it is here so that a source tree without git history fails loudly
  # rather than producing a build every rondo command would refuse.
  CONTINUO_REQUIRE_REVISION=1 npm --prefix "$continuo_dir" run build >/dev/null
  built_version=$(node "$continuo_cli" --version)
fi
[ "$built_version" = "$continuo_version_line" ] ||
  die "built continuo reports '$built_version', pin says '$continuo_version_line'"
note "verified $built_version"

step "Directories"
# continuo requires each of these to be absolute and to already exist; no verb
# below `db create` creates a directory.
for d in artifacts session-state dropbox catalog; do
  mkdir -p -- "$env_root/$d"
done
note "$env_root/{artifacts,session-state,dropbox,catalog}"

step "Control plane"
control_plane="$env_root/control-plane.sqlite3"
if [ -f "$control_plane" ]; then
  note "already at $control_plane (db create refuses an existing path, on purpose)"
else
  node "$continuo_cli" db create --db "$control_plane" >/dev/null
  note "created $control_plane"
fi

step "Target repository (the repository a lap is allowed to touch)"
# **One name for the target, and everything else derived from it.** A plan has
# to say which repository this is in four places -- `repository`, `base_branch`,
# and `source.path` and `base_branch` again inside the catalog layer, plus
# `project_name` to select the project -- and two of those pairs are the same
# fact written twice. Hand-editing them is how a plan comes to disagree with
# itself, and a disagreement is not visible until the lap has been admitted and
# a worker has run (rondo #72). So they are all written below out of
# `$target`, `$target_base_branch` and `$project_name`, and this step is the
# only place those three are decided.
if [ -n "$target_repo" ]; then
  # An existing repository. It is read and never written: no seed commit, no
  # `git config`, no remote added or moved. Somebody else's repository is not a
  # scratch directory, and the checks below are reads.
  [ -d "$target_repo" ] || die "target repo '$target_repo' is not a directory"
  target=$(cd -- "$target_repo" && pwd)
  # **The repository root, not the directory that was named.** `rev-parse`
  # succeeds from anywhere inside a repository, so `--target-repo /repo/pkg/app`
  # would pass this check and write `/repo/pkg/app` into all four plan fields --
  # consistently, so the consistency check would be satisfied -- while continuo
  # materialises a worktree of the whole repository. The contract would then be
  # about a subdirectory and the lap about the repository, which is the same
  # class of disagreement this flag exists to remove, just moved one level out
  # where nothing compares it.
  target=$(git -C "$target" rev-parse --show-toplevel 2>/dev/null || true)
  [ -n "$target" ] ||
    die "target repo '$target_repo' is not inside a git repository"
  if [ "$target" != "$(cd -- "$target_repo" && pwd)" ]; then
    note "'$target_repo' is inside a repository; using its root"
  fi
  if [ -z "$target_base_branch" ]; then
    # The branch its HEAD is on. A detached HEAD names none, and guessing
    # `main` there would write a plan whose lap cannot cut a topic branch.
    target_base_branch=$(git -C "$target" symbolic-ref --quiet --short HEAD || true)
    [ -n "$target_base_branch" ] ||
      die "target repo '$target' has a detached HEAD; name the branch with --target-base-branch"
  fi
  git -C "$target" rev-parse --verify --quiet "refs/heads/$target_base_branch" >/dev/null 2>&1 ||
    die "target repo '$target' has no branch '$target_base_branch'"
  note "using $target at branch $target_base_branch (left unmodified)"
else
  target="$env_root/target"
  target_base_branch=${target_base_branch:-main}
  # Written into the repository rather than passed as `-c` on the seed commit,
  # because the seed commit is not the only one made here: the lap commits in a
  # *worktree* of this repository, and git config is per-repository, so a worktree
  # inherits what is set here and inherits nothing from a `-c` that has ended. A
  # machine with no global identity, or with signing on, would otherwise pass
  # setup and fail inside the paid lap -- on exactly the configuration setup
  # thought it had handled. A scratch target is also not a place to inherit a
  # machine's commit policy.
  set_target_commit_config() {
    git -C "$target" config user.name rondo-dogfood
    git -C "$target" config user.email rondo-dogfood@invalid
    git -C "$target" config commit.gpgsign false
  }

  # The test is "the base branch resolves to a commit", not "a .git exists". An
  # interrupted first run -- a seed commit that failed on configured signing is
  # the easy way to get one -- leaves a repository a `.git` check calls finished
  # and a lap cannot materialise a workspace from, because there is no branch to
  # cut the topic branch off. Repairing it is a rerun; that is what this branch
  # is for.
  if [ -d "$target/.git" ] &&
     git -C "$target" rev-parse --verify --quiet "refs/heads/$target_base_branch" >/dev/null 2>&1; then
    set_target_commit_config
    note "already at $target"
  else
    # An existing scratch target that has commits but not the branch asked for:
    # the seed below would commit onto whatever branch it does have, reporting
    # success for a base branch it never created. A scratch target is
    # disposable, so the repair is a fresh --root rather than a rename here.
    git -C "$target" rev-parse --verify --quiet HEAD >/dev/null 2>&1 &&
      die "scratch target '$target' has commits but no branch '$target_base_branch'; use a fresh --root"
    mkdir -p -- "$target/docs"
    [ -d "$target/.git" ] ||
      git -C "$target" init --quiet --initial-branch="$target_base_branch"
    set_target_commit_config
    # A repository left with an unborn HEAD may be pointing at whatever
    # `init.defaultBranch` says rather than at the branch the plan names; the
    # seed commit has to land on that branch.
    git -C "$target" rev-parse --verify --quiet HEAD >/dev/null 2>&1 ||
      git -C "$target" symbolic-ref HEAD "refs/heads/$target_base_branch"
    [ -f "$target/docs/NOTES.md" ] ||
      printf '# Notes\n\nA scratch target for walking the rondo operator CLI.\n' > "$target/docs/NOTES.md"
    git -C "$target" add docs/NOTES.md
    git -C "$target" commit --quiet -m 'docs: seed the dogfood target'
    note "created $target on branch $target_base_branch"
  fi
fi

# The project the catalog declares and `project_name` selects. Derived from the
# directory rather than typed, for the reason the paths are: a name typed twice
# is a name that can be typed differently twice. The scratch target keeps the
# name it has always had so that the runbook's worked commands still read.
if [ -n "$target_repo" ]; then
  # cadenza's identifier rule, which a directory name does not have to satisfy:
  # a lowercase letter followed by up to 63 more of [a-z0-9_-]. A repository
  # called `123-app` or `.config` produces a name that is legal as a directory
  # and refused as a project id -- and refused at `classify`, minutes later,
  # rather than here. So the derivation ends inside the rule: case folded,
  # anything else turned into `-`, a `repo-` prefix when it does not begin with
  # a letter, and cut to 64.
  project_name=$(printf %s "$(basename -- "$target")" | tr 'A-Z' 'a-z' | tr -c 'a-z0-9_-' '-')
  case "$project_name" in
    [a-z]*) ;;
    *) project_name="repo-$project_name" ;;
  esac
  project_name=$(printf %s "$project_name" | cut -c1-64)
  # Checked rather than assumed: the rule above is cadenza's and this script
  # restates it, so the one thing worth doing is failing here if the restatement
  # ever stops matching -- a setup that reports success and hands over a plan
  # `classify` refuses is worse than one that stops.
  printf %s "$project_name" | grep -qE '^[a-z][a-z0-9_-]{0,63}$' ||
    die "could not derive a usable project name from '$target' (got '$project_name')"
else
  project_name=dogfood-target
fi
note "project '$project_name'"

if [ -n "$target_repo" ]; then
  step "Push target"
  # Skipped on purpose. The scratch target gets a bare repository on this disk
  # wired up as its origin so the push leg of `publish` is real; a repository
  # somebody else owns keeps the remotes it has. Rewiring those would be this
  # script reaching outside its own --root, which is the one thing its header
  # promises it does not do.
  push_origin=$(git -C "$target" remote get-url --push --all origin 2>/dev/null | head -n 1 || true)
  if [ -n "$push_origin" ]; then
    note "origin already points at $push_origin; left as it is"
  else
    note "this repository has no 'origin'; 'publish' will refuse until it has one"
  fi
else
  step "Push target (a bare repository on this disk, so the push leg is real)"
  # **Why this exists.** `rondo publish` asks the workspace whether its plan can
  # run before it prints or runs anything, and a workspace with no remote is
  # refused -- rightly, because `git push origin` cannot resolve `origin`. Before
  # this step the target had no remotes at all, so the walk stopped at that
  # refusal and the push leg was never seen. A bare repository on the same disk is
  # a real push target: a push to it does everything a push does, and the lap's
  # workspace is a worktree of this repository, so it inherits this remote.
  #
  # **What it is still not is a forge.** `gh pr create` cannot be demonstrated
  # against a directory, so the pull-request leg cannot be walked in this
  # environment at all. That is stated here, in the READY block below and in
  # section 8 of docs/operations/rondo-cli.md rather than left to be discovered by
  # an operator reading a plan that cannot run.
  push_origin="$env_root/target-origin.git"
  if [ -d "$push_origin" ]; then
    note "already at $push_origin"
  else
    git init --quiet --bare -- "$push_origin"
    note "created $push_origin"
  fi
  # `get-url --push --all` rather than a grep of `remote -v`: these are the URLs
  # the push would actually reach -- `pushurl` overrides `url` and may be set more
  # than once -- and they are what rondo's preflight compares against.
  current_origin=$(git -C "$target" remote get-url --push --all origin 2>/dev/null || true)
  if [ "$current_origin" = "$push_origin" ]; then
    note "target's origin already points at it"
  elif [ -z "$current_origin" ]; then
    git -C "$target" remote add origin "$push_origin"
    note "target's origin -> $push_origin"
  else
    # A --root reused from an environment that lived somewhere else. Moving the
    # URL is the repair; refusing would strand a rerun on the one thing a rerun is
    # for. `set-url` writes `remote.origin.url`, which an explicit `pushurl` would
    # still override, so any of those are dropped first -- otherwise the repair
    # would report a move while pushes kept reaching the old place.
    git -C "$target" config --unset-all remote.origin.pushurl 2>/dev/null || true
    git -C "$target" remote set-url origin "$push_origin"
    note "target's origin moved from '$(printf '%s' "$current_origin" | tr '\n' ' ')' to $push_origin"
  fi
  # Confirmed, not assumed. This is the one place the script makes a claim about
  # where a push goes, and the claim is what the runbook and the output below rest
  # on.
  verified_origin=$(git -C "$target" remote get-url --push --all origin)
  [ "$verified_origin" = "$push_origin" ] ||
    die "target's origin still pushes to '$(printf '%s' "$verified_origin" | tr '\n' ' ')'"
fi

# **Several repositories per root** (D-0081 rule 6.2, withdrawing D-0075 rule
# 1.1). Adding a repository is this script run again under the same root with
# another --target-repo, so the two files it writes -- the plan and the catalog
# layer -- are named for the repository rather than for the root. A second run
# then leaves the first run's pair where it is, and the store keeps both plans
# because its refusal went with the rule.
#
# The name is `$project_name`, which is derived from the target above and
# already checked against cadenza's identifier rule -- so it is also a safe
# filename. Two repositories whose basenames agree derive the same name, which
# would silently overwrite the first one's pair and give cadenza two projects
# under one id; that is the one case worth stopping, and it is stopped here
# rather than at the overwrite.
plan="$env_root/plan-$project_name.json"
catalog_origin="$env_root/catalog/$project_name.toml"
if [ -f "$plan" ]; then
  held_repository=$(node -e '
    const plan = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
    process.stdout.write(String(plan.repository));
  ' "$plan")
  [ "$held_repository" = "$target" ] ||
    die "this root already holds '$plan' for '$held_repository', which derives the same project name as '$target'; rename one of the two directories or give this one a --root of its own"
fi

step "Catalog"
# cadenza resolves the project through this layer. `data` is what it reads;
# `origin` and `base_dir` name where the layer came from, so the file is written
# out to keep the two honest even though nothing reads it back.
#
# The target is listed in `allowed_local_roots` as a root of its own, beside
# --root. cadenza requires a `local_path` source to lie under a root the layer
# that declares it declares, and a path is under itself -- so naming the target
# exactly admits the target and nothing beside it, which a parent directory
# would not.
#
# **What the worker may run is the project's `allowed_bash`** (rondo D-0094,
# cadenza D-0041): the one list that reaches `run admit --allow-bash`, the
# delegation envelope and the contract's `config_digest`. A project without it
# grants nothing, so every project written here carries it. The list is
# cadenza's `allowedCommandsFor` over the target's top-level file names at the
# base branch (cadenza D-0040), the same function the page uses for a
# repository it adds -- read through rondo's built facade, so setup states no
# command of its own.
allowed_bash_json=$(git -C "$target" ls-tree --name-only "$target_base_branch" |
  node --input-type=module -e '
    import { readFileSync } from "node:fs";
    import { pathToFileURL } from "node:url";
    const { allowedCommandsFor } = await import(pathToFileURL(process.argv[1]).href);
    const files = readFileSync(0, "utf8").split("\n").filter((name) => name !== "");
    process.stdout.write(JSON.stringify(allowedCommandsFor(files)));
  ' "$repo_root/dist/cadenza/facade.js")
note "the worker may run: $allowed_bash_json"
cat > "$catalog_origin" <<TOML
# Written by scripts/dogfood-env.sh. The plan file carries this same content
# inline as catalog_layers[0].data, which is what cadenza actually reads.
schema_version = 1

[catalog]
allowed_local_roots = ["$env_root", "$target"]

[project.$project_name]
base_branch = "$target_base_branch"
aliases = []
allowed_bash = $allowed_bash_json

[project.$project_name.source]
kind = "local_path"
path = "$target"
TOML
note "$catalog_origin"

step "Plan"
# The request itself is deliberately trivial. What is being walked is the
# mechanism, not the change: a lap that appends one line proves the same six
# verbs as a lap that rewrites a module, and costs the same one dollar-ish.
# It is passed in as an argument because it is the one value here that contains
# quotes, and `node -e` is already inside a quoted shell string.
#
# For a --target-repo it is a placeholder instead, because this script does not
# know what somebody wants done in a repository it did not create -- and a
# default that reads like an instruction is worse than one that reads like a
# placeholder. The request for a real target is supplied at `start` time with
# --prompt-file, which is what a multi-paragraph request needs: it cannot be
# typed as a shell argument, and before that flag existed the way through was a
# throwaway script that edited this plan's JSON.
if [ -n "$target_repo" ]; then
  prompt="Replace this with the request. 'rondo start --prompt-file FILE' overwrites it, and is the way to pass a request of more than one paragraph."
else
  prompt="Append one line to docs/NOTES.md reading exactly: 'Touched by the rondo operator CLI.' Then commit it with the message 'docs: touched by the rondo operator CLI'. Do nothing else."
fi
node -e '
  const [out, envRoot, runId, controlPlane, target, catalogOrigin, interlockRoot,
         claudeOrgPath, claudeBin, nodeBin, prompt, baseBranch,
         projectName, reviewCriterionFile, forgeRepository, allowedBashJson,
         decisionRecord] =
    process.argv.slice(1);

  // The three budgets are stated rather than inherited. `invocation_ceiling_ms`
  // must be strictly greater than their sum; rondo refuses a ceiling that
  // merely equals it, and a ceiling that fires is a rondo defect (it kills the
  // CLI and not the fenced child), so the margin here is deliberate.
  const turnTimeoutMs = 900_000;
  const gitTimeoutMs = 60_000;
  const identityReadbackTimeoutMs = 120_000;

  // D-0023: the run id, the topic branch and the workspace are no longer in a
  // plan file. rondo derives all three from the iteration id, so what the plan
  // carries is the *root* the workspaces are cut under.
  const plan = {
    db: controlPlane,
    workspace_root: `${envRoot}/workspaces`,
    // The four places below that have to agree about the target -- this,
    // `repository`, and `base_branch` and `source.path` inside the catalog
    // layer -- are written from the same two variables, plus `project_name`
    // from a third. That is the point of writing the plan rather than editing
    // one: there is no second spelling to get wrong.
    base_branch: baseBranch,
    prompt,

    // **What each finding severity means to the model reviewer** (D-0065
    // section 1.2.6, rondo#205). Without it every model reading of a lap is
    // `unavailable`, and an in-scope `rondo retry --scope-decision-id` is never
    // admitted. The meanings live in a JSON file so that a test can hold the
    // default to `runPlan` without paying for a lap; `rondo start` validates
    // an override the same way.
    //
    // **Its rule files are the repository own rules** (rondo#377): every lap
    // is told to read them first and follow their order of work, and the model
    // reviewer is handed them. A criterion that names none gets the target
    // AGENTS.md when its base branch has one, so a one-line request still
    // reaches a worker pointed at how this repository installs and verifies.
    review_criterion: (() => {
      const criterion = JSON.parse(require("node:fs").readFileSync(reviewCriterionFile, "utf8"));
      const hasAgents =
        require("node:child_process").spawnSync("git", [
          "-C", target, "cat-file", "-e", `${baseBranch}:AGENTS.md`,
        ]).status === 0;
      return Array.isArray(criterion.rule_files) && criterion.rule_files.length === 0 && hasAgents
        ? { ...criterion, rule_files: ["AGENTS.md"] }
        : criterion;
    })(),

    repository: target,
    artifact_root: `${envRoot}/artifacts`,
    state_root: `${envRoot}/session-state`,
    interlock_root: interlockRoot,
    claude_org_path: claudeOrgPath,
    endpoint_recipient: "external-notify",
    endpoint_destination_dir: `${envRoot}/dropbox`,
    claude_command: [claudeBin],

    endpoint_db: null,
    endpoint_module: null,
    node: nodeBin,
    hook_script: null,
    python: null,
    poll_interval_ms: null,

    turn_timeout_ms: turnTimeoutMs,
    git_timeout_ms: gitTimeoutMs,
    identity_readback_timeout_ms: identityReadbackTimeoutMs,
    invocation_ceiling_ms: turnTimeoutMs + gitTimeoutMs + identityReadbackTimeoutMs + 300_000,

    gate_options: ["approve", "revise"],
    gate_deadline_at_ms: null,

    // Null in a plan a person writes, always: it is the branch a pull request
    // is opened against when that is not the branch the workspace was cut
    // from, and only `rondo revise` ever sets it. Written out rather than left
    // absent so that the generated file shows the whole shape -- an absent key
    // reads as null, which is what keeps plans written before the field valid.
    pull_request_base_branch: null,

    // **Where this target publishes to** (D-0081 rule 3.2). The forge
    // repository is a fact about the repository and not about the host, so it
    // is recorded here beside every other repository fact, and publish reads it
    // from the plan of the lap it is publishing rather than from the command
    // that started the page. Empty is null -- a target with no forge, which the
    // scratch target is -- and a lap whose plan carries null publishes against
    // the host own --repo where one was given, which is what a store set up
    // before D-0081 has (rule 6.3).
    //
    // No apostrophes in this comment: the whole program is a single-quoted
    // shell argument, so one would end the string.
    forge_repository: forgeRepository === "" ? null : forgeRepository,
    decision_record: decisionRecord === "" ? null : decisionRecord,

    catalog_layers: [
      {
        layer: "tracked",
        origin: catalogOrigin,
        base_dir: `${envRoot}/catalog`,
        data: {
          schema_version: 1,
          catalog: { allowed_local_roots: [envRoot, target] },
          project: {
            [projectName]: {
              source: { kind: "local_path", path: target },
              base_branch: baseBranch,
              aliases: [],
              // What the worker may run (D-0094): the list the Catalog step
              // computed and wrote into the layer file above. It has to agree
              // with the agent type granting command.run below -- a plan that
              // grants it over a project declaring nothing is refused at
              // classify, which is what rondo#67 measured.
              allowed_bash: JSON.parse(allowedBashJson),
            },
          },
        },
      },
    ],
    project_name: projectName,

    agent_type_input: {
      agentTypeId: "worker-basic",
      vocabularyVersion: 1,
      granted: ["command.run"],
      askable: ["branch.push"],
      loopPolicy: { maxReviewRounds: 2, noProgressWindow: 3, noProgressRepeat: 2 },
      executorPolicy: { roleName: "worker", modelTier: "standard", reportingDuties: [] },
    },
    // parties.grantee is the run id spelled a second time, and D-0023 rule 9
    // makes the run id rondo own mint -- so this value is a placeholder that
    // the allocator overwrites with the run id it derived. It is written at
    // all only because the cadenza type requires the field.
    parties: { issuer: "rondo-cli", grantee: "rondo-allocates-this" },
    intended_action: { capabilities: ["command.run"] },
  };

  require("node:fs").writeFileSync(out, `${JSON.stringify(plan, null, 2)}\n`);
' "$plan" "$env_root" "$run_id" "$control_plane" "$target" "$catalog_origin" \
  "$interlock_root" "$claude_org_path" "$claude_bin" "$node_bin" "$prompt" \
  "$target_base_branch" "$project_name" "$review_criterion" "$forge_repo" \
  "$allowed_bash_json" "$decision_record"
note "$plan"
if [ -n "$forge_repo" ]; then
  note "pull requests for this target are opened in $forge_repo"
else
  note "this target names no repository to open pull requests in (--forge-repo OWNER/NAME)"
fi

step "Environment"
env_file="$env_root/env.sh"
# Every value below goes through `printf %q`. This file is *sourced*, so a path
# holding a literal `$`, a quote or a space -- all of which are legal in a
# directory name, and `/tmp/dogfood-$USER` is the easy one to type -- would be
# re-expanded by the shell reading it back and point rondo somewhere else. %q is
# the only writer here that round-trips.
{
  printf '# Written by scripts/dogfood-env.sh. Source this before typing a rondo command.\n'
  printf 'export RONDO_CONTINUO_CLI=%q\n' "$continuo_cli"
  printf '# RONDO_STORE is a *second* database, and is not the control plane:\n'
  printf "# rondo's iteration rows are rondo's, and continuo's run, gate and relay\n"
  printf "# rows are continuo's. It must be absolute and must not be ':memory:' --\n"
  printf '# each command is its own process, so a row that does not outlive one is a\n'
  printf '# lap that ran, cost money, and then vanished.\n'
  printf 'export RONDO_STORE=%q\n' "$env_root/rondo-iterations.sqlite3"
  printf '# The one identity allowed to answer or publish.\n'
  printf 'export RONDO_APPROVER=%q\n' "$approver"
  # The answer setup was given, so a `rondo web` typed by hand in a sourced
  # shell says what the service says. The variable is still the only thing the
  # host reads (D-0056 rule 3); this line is the same recorded fact reaching
  # the other way a host is started.
  #
  # **An unset when nobody answered, rather than a line left out.** This file
  # is *sourced*, on top of whatever the shell already holds -- and what it
  # already holds is very often this file's own last version. Omitting the
  # line would leave an operator who emptied their record and re-ran setup
  # with the language they just removed still exported, and a `rondo web`
  # typed in that shell still in it. The unit has the opposite shape and keeps
  # it: it is read into a fresh process, where an absent line is absent.
  printf '# The language rondo writes its own prose to you in.\n'
  if [ -n "$operator_language" ]; then
    printf 'export RONDO_OPERATOR_LANGUAGE=%q\n' "$operator_language"
  else
    printf '# Nobody has answered, so it is English.\n'
    printf 'unset RONDO_OPERATOR_LANGUAGE\n'
  fi
} > "$env_file"
note "$env_file"

step "Start command (the one word the person types, D-0080)"
# **The word carries the environment, because a start no longer has a shell to
# borrow one from.** The host runs four programs by bare name, and the service
# manager's own PATH holds only the system directories, where of those four
# only `git` is found (D-0080's measurement). Two of them resolve, in a shell,
# to a per-shell directory under a version manager's run directory that does
# not outlive that shell -- so every directory below is the real one, resolved
# the way node_bin above is.
#
# **Both directories, resolved first.** Where a program is a link into a
# package's own files -- an npm-installed CLI is `bin/something.js` behind a
# link named for the command -- the resolved directory holds the file and not
# the name the host will call, so resolving alone can take the program away.
# The directory the link itself is in is added after it, which costs one entry
# and keeps the name findable. A per-shell directory that does not outlive the
# shell it was made for is then a dead entry rather than the only one.
dirs_of() {
  local found resolved
  # A name to look up, or a path already in hand -- `claude` arrives here as
  # the second, resolved far above for continuo's sake, and it needs the same
  # two directories as the rest: the one holding the name, which may be a
  # version manager's per-shell directory, and the one it really lives in.
  case "$1" in
    */*) found=$1 ;;
    *) found=$(command -v "$1" 2>/dev/null || true) ;;
  esac
  [ -n "$found" ] || return 0
  resolved=$(readlink -f -- "$found" 2>/dev/null || printf '%s' "$found")
  (cd -- "$(dirname -- "$resolved")" && pwd -P)
  (cd -- "$(dirname -- "$found")" && pwd -P)
}

host_path=
add_path_dir() {
  [ -n "$1" ] || return 0
  case ":$host_path:" in
    *":$1:"*) return 0 ;;
  esac
  if [ -z "$host_path" ]; then host_path=$1; else host_path="$host_path:$1"; fi
}

add_path_dir "$(dirname -- "$node_bin")"
for program in "$claude_bin" git gh codex; do
  program_dirs=$(dirs_of "$program")
  if [ -n "$program_dirs" ]; then
    while IFS= read -r program_dir; do
      add_path_dir "$program_dir"
    done <<<"$program_dirs"
  else
    # Not fatal here. One of these missing is a page whose publish or whose
    # reviewer reports itself unavailable, which is a thing the person is told
    # on the page; a setup that refused would give them nothing at all.
    note "no '$program' on PATH: the host will not find it either"
  fi
done
# The system directories last, so the resolved ones win.
for system_dir in /usr/local/sbin /usr/local/bin /usr/sbin /usr/bin /sbin /bin; do
  add_path_dir "$system_dir"
done

# What opens the page when the host answers (D-0080 rule 4.4). On WSL the
# browser is on the Windows side, so `explorer.exe` is the last resort and a
# real one; its directory stays out of the host's PATH and the command holds
# its absolute path instead.
opener=
for candidate in xdg-open wslview explorer.exe open; do
  candidate_path=$(command -v "$candidate" 2>/dev/null || true)
  if [ -n "$candidate_path" ]; then
    opener=$(readlink -f -- "$candidate_path" 2>/dev/null || printf '%s' "$candidate_path")
    break
  fi
done
[ -n "$opener" ] || note "nothing here opens a browser: the word will print the address instead"

# What puts one line in front of the person when they are not looking at the
# page (rondo#311). The same shelf as the opener and found the same way, and
# the same last resort: on WSL the desktop is on the Windows side, so a
# Windows-side notifier is a real answer and its directory stays out of the
# host's PATH.
#
# **The order is what each one reaches, nearest first.** `notify-send` is the
# desktop's own, and where there is a Linux desktop here it is the one whose
# notification lands in it. `wsl-notify-send.exe` is the WSL case: the desktop
# is Windows', and this is what reaches it. Measured on this machine
# (2026-09-21): no `notify-send`, `wsl-notify-send.exe` present, and calling it
# works.
#
# **What each one is called with is one argument**, which is why this list is
# short and not a list of everything that can make a sound. Both programs take
# the whole line as a single positional argument. `wsl-notify-send.exe` handed
# a second one prints its usage, delivers nothing **and exits 0** (measured the
# same day) -- so a program that needs a different call shape is not "one more
# candidate here", it is a silent failure, and it stays out until somebody
# writes the shape it needs.
notifier=
for candidate in notify-send wsl-notify-send.exe; do
  candidate_path=$(command -v "$candidate" 2>/dev/null || true)
  if [ -n "$candidate_path" ]; then
    notifier=$(readlink -f -- "$candidate_path" 2>/dev/null || printf '%s' "$candidate_path")
    break
  fi
done
[ -n "$notifier" ] || note "nothing here shows a notification: rondo will wait to be looked at"

start_command_args=(
  --node "$node_bin"
  --checkout "$repo_root"
  --port "$port"
  --store "$env_root/rondo-iterations.sqlite3"
  --approver "$approver"
  --continuo-cli "$continuo_cli"
  --path "$host_path"
)
if [ -n "$remote" ]; then start_command_args+=(--remote "$remote"); fi
if [ -n "$opener" ]; then start_command_args+=(--opener "$opener"); fi
if [ -n "$notifier" ]; then start_command_args+=(--notifier "$notifier"); fi
if [ -n "$operator_language" ]; then
  start_command_args+=(--language "$operator_language")
fi
if [ -n "${RONDO_MAX_LIVE:-}" ]; then start_command_args+=(--max-live "$RONDO_MAX_LIVE"); fi
if [ -n "${RONDO_MAX_OCCUPYING:-}" ]; then
  start_command_args+=(--max-occupying "$RONDO_MAX_OCCUPYING")
fi

written=$("$repo_root/scripts/start-command.sh" "${start_command_args[@]}")
start_command_path=$(printf '%s\n' "$written" | sed -n 1p)
unit_path=$(printf '%s\n' "$written" | sed -n 2p)
note "$start_command_path"
note "$unit_path"

# Writing the unit is not installing it. These acts are acts on the machine,
# and the ones that can fail from here fail for one reason: inside a Claude
# Code sandbox every systemctl call is refused the bus, which is the runbook's
# "not inside a Claude Code sandbox" again (D-0080's measurement).
#
# **`try-restart` is the third act, and it is what makes rule 2.4 true.** When
# a host fact moves, the repair is running setup again -- and a rewritten unit
# is read by nothing until the process is replaced: `daemon-reload` and
# `enable` leave a running host alone, and so does the `systemctl start` the
# word does, because a service that is already active is already started. A
# host would then keep running on the facts it was started with, and a changed
# port would leave the word waiting on a page nothing serves. `try-restart`
# replaces a running host and does not start a stopped one, which is the
# word's to do.
if systemctl --user daemon-reload >/dev/null 2>&1 &&
  systemctl --user enable rondo.service >/dev/null 2>&1 &&
  systemctl --user try-restart rondo.service >/dev/null 2>&1; then
  note "the service is installed; the word starts it"
else
  note "could not reach the systemd user manager from here. In a normal terminal:"
  note "  systemctl --user daemon-reload && systemctl --user enable rondo.service"
  note "  systemctl --user try-restart rondo.service   # if a host is already running"
fi
# Without linger the user manager -- and the host with it -- is stopped when
# the last session on this machine ends, so the page would die with the
# terminal the word was typed in. Enabling it needs no root (measured
# 2026-09-20 on this machine).
if loginctl enable-linger "$(id -un)" >/dev/null 2>&1; then
  note "the host keeps running after the terminal is closed"
else
  note "could not turn on lingering from here. In a normal terminal:"
  note "  loginctl enable-linger $(printf %q "$(id -un)")"
fi
# D-0080 rule 2.5: a word in a directory the shell does not search does
# nothing, and nothing says why.
start_command_dir=$(dirname -- "$start_command_path")
case ":${PATH:-}:" in
  *":$start_command_dir:"*) ;;
  *) note "$start_command_dir is not on your PATH, so the word is not found until it is" ;;
esac

step "Store (the plan above, recorded where the page reads it)"
# **The last step, and the one that ends installation** (D-0075 rule 2): the
# plan goes to the store the host will serve, not to a person to paste. Each
# run records one row, so the newest setup is the one the page offers first.
#
# **A failure here is said, not just stopped on** (rondo#406). Under `set -e`
# a failed record ended setup with rondo's own refusal as the last line and no
# word from setup that its last step had not happened -- so a person read the
# screen above it as a finished install. The store now waits for the host it
# was racing (D-0107), and anything else that stops the record lands here.
if ! RONDO_STORE="$env_root/rondo-iterations.sqlite3" RONDO_APPROVER="$approver" \
  node "$repo_root/bin/rondo.mjs" setup-plan --plan "$plan" --actor-id "$approver" |
  sed 's/^/   /'; then
  printf '\n' >&2
  die "the last step did not happen: the plan was not recorded, so the page will not offer it.
Everything above it is in place. Record it alone, after the reason above is fixed:
  RONDO_STORE=$(printf %q "$env_root/rondo-iterations.sqlite3") RONDO_APPROVER=$(printf %q "$approver") \\
    node $(printf %q "$repo_root/bin/rondo.mjs") setup-plan --plan $(printf %q "$plan") --actor-id $(printf %q "$approver")"
fi

# The same quoting for the commands printed below, which are meant to be copied
# into a shell verbatim.
q_repo_root=$(printf %q "$repo_root")
q_env_file=$(printf %q "$env_file")
q_plan=$(printf %q "$plan")
q_approver=$(printf %q "$approver")
q_run_id=$(printf %q "$run_id")

# The `publish` line and the paragraph under it differ by target, so both are
# composed here rather than written twice inside the heredoc.
#
# **--allow-remote-mismatch is printed only for the scratch target.** It turns
# off the preflight that refuses to push to one repository while opening a pull
# request about another, and it belongs on that line only because the scratch
# target's origin is a bare repository on this disk that no OWNER/NAME can name.
# For a repository that has a real origin the check is exactly the one you want
# on, so printing the flag would hand an operator a command that disables a
# safeguard this script's own output promises.
if [ -n "$target_repo" ]; then
  # **The printed `start` carries --prompt-file, and that is not decoration.**
  # For a --target-repo the plan's prompt is a placeholder, so the line without
  # an override would start a paid worker in a real repository with a request
  # that asks for nothing. The commands below this line are meant to be copied
  # verbatim, so the one that spends money has to be right as written.
  start_command="  node bin/rondo.mjs start --plan $q_plan --iteration-id $q_run_id \\
    --prompt-file ./request.txt      # write your request here first"
  publish_command="  node bin/rondo.mjs publish --iteration-id $q_run_id --repo OWNER/NAME --actor-id $q_approver \\
    --dry-run"
  publish_note="** Where 'publish' would push, and where it would open the pull request. **
The target is a repository this script did not create, so its remotes are its
own and were left alone. 'publish' pushes the lap's branch to that repository's
origin and opens the pull request against the --repo you name, and it refuses
before printing anything if those two are different repositories. Nothing here
makes that call for you."
else
  start_command="  node bin/rondo.mjs start --plan $q_plan --iteration-id $q_run_id"
  publish_command="  node bin/rondo.mjs publish --iteration-id $q_run_id --repo OWNER/NAME --actor-id $q_approver \\
    --dry-run --allow-remote-mismatch"
  publish_note="** publish cannot be walked to the end in this environment, and here is why. **
'publish' checks the workspace before it prints anything. The push leg is real:
origin is the bare repository at
  $push_origin
and a push to it works. The pull-request leg is not: a bare repository on this
disk is not a forge, so no OWNER/NAME names it and 'gh pr create' has nothing to
create against. That is why --allow-remote-mismatch is on the line above --
without it rondo refuses, correctly, because the push and the pull request would
be about different repositories. Run it without the flag once to see the
refusal; it is the check working.

Walking publish to the end needs a workspace whose origin is a real repository
on a forge you can open a pull request in. This environment is not one, and no
flag makes it one."
fi


# **The terminal's way in is a file, not the last screen** (rondo#375, lap
# 11's N-52): printed here, the start / answer / publish lines were the last
# thing setup said, and a person about to walk the page read them as the next
# steps. They are for whoever installs and repairs rondo, so they are kept
# whole beside the environment and named once; the screen ends on the word
# that opens the page.
terminal_notes=$env_root/terminal.txt
cat >"$terminal_notes" <<TERMINAL
The terminal: the other way in, for whoever installs and repairs rondo.
Nothing here is needed to use the page; the page is opened by typing 'rondo'.

  cd $q_repo_root
  . $q_env_file

$start_command
  node bin/rondo.mjs answer
  node bin/rondo.mjs answer --actor-id $q_approver --body=approve
$publish_command

'start' spawns a real worker session and costs real money; nothing above this
line did. 'publish' without --dry-run pushes the branch and opens a pull request
as you, so it is left with --dry-run here.

$publish_note

A second lap needs no second plan file, and no second set of identifiers:

  node bin/rondo.mjs start --plan $q_plan --iteration-id dogfood-002 --prompt "..."
  node bin/rondo.mjs start --plan $q_plan --iteration-id dogfood-003 --prompt-file ./request.txt

--prompt-file is the one to reach for when the request runs to more than one
paragraph: it is read byte for byte, so a request that cannot be typed as a
shell argument no longer needs a script written to inject it into the plan.

rondo derives run id 'rondo-dogfood-002', branch 'rondo/dogfood-002' and
workspace '$env_root/workspaces/iter-dogfood-002' from that one name (D-0023).

** Two iterations can now be open at once. ** While the first is waiting at its
gate it holds no worker, so it does not occupy an execution slot: the second
'start' above is accepted rather than refused. RONDO_MAX_LIVE bounds how many
may be open (default 3) and RONDO_MAX_OCCUPYING how many may be executing
(default 1, and raising it needs continuo to allow a second concurrent lap
first). With more than one open, 'answer' needs --iteration-id ID to say which.

If something is stuck, 'node bin/rondo.mjs abandon --iteration-id ID --reason "..."'
is the way out; see section 7 of docs/operations/rondo-cli.md.
TERMINAL

cat <<READY

Ready. The environment is at $env_root
The lap is pointed at $target, branch $target_base_branch, as project '$project_name'.
That is written into all four places the plan has to say it, from the one value
you named, so there is nothing in the plan file to hand-edit.

** On the page, nothing is pasted. ** The plan above is recorded in the store
the page reads, so the scope screen offers it as the plan to run on and the
drafter drafts from it. The file stays on disk as a record of this run; rondo
does not read it again. Running this script again records the plan again, and
the newest one is offered first.

** A second repository is this script again, same --root, another
--target-repo. ** Its plan is recorded beside this one and offered as another
choice on the same page; this run's plan and catalog file are named for
'$project_name' and are left alone (D-0081).

The terminal commands, for whoever installs and repairs rondo, are in
$terminal_notes. Nothing in it is needed to use the page.

** Next: open the page. ** It takes one word: no directory to be in, no file
to source, no port and no repository (D-0080). It hands the host to the service
this script installed, waits until the page answers and opens it, and comes
back -- so the window may be closed. Type:

  rondo
READY
