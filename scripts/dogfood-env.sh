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
# Everything it writes lives under one directory (--root), and nothing outside
# that directory is modified except the repository's own `node_modules` and
# `dist`, which are the repository's ordinary build outputs.
#
# Re-running is safe. Every step checks for its own result first, so a second
# run repairs whatever is missing and leaves the rest -- including the control
# plane, the iteration store and the target repository, which hold state a
# rebuild must not discard.

set -euo pipefail

usage() {
  cat <<'USAGE'
usage: scripts/dogfood-env.sh [--root DIR] [--run-id ID] [--force-continuo-rebuild]

Provision a working environment for the rondo operator CLI and print the
commands that drive it.

options:
  --root DIR
      where the environment lives. Created if absent. Default: $RONDO_DOGFOOD_ROOT,
      or <repo>/.worker-scratch/dogfood-env when that is unset -- which is the
      root .gitignore already excludes, so a default run cannot put a control
      plane one `git add -A` away from a commit.
  --run-id ID
      the run id written into the generated plan file. Default: dogfood-001.
      A second lap does not need a second plan file -- `rondo start` takes
      --run-id, --topic-branch, --workspace and --prompt as flags.
  --force-continuo-rebuild
      rebuild the pinned continuo even when the built one already reports the
      pinned version line.
  -h, --help
      show this message.

environment (all optional; each is a path this machine has and this script
cannot discover):
  RONDO_DOGFOOD_ROOT            default for --root
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

repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)

# The default lives under `.worker-scratch/`, which .gitignore excludes for the
# reason written beside it there: a real environment is a continuo clone, two
# SQLite databases, a worktree and captured session output, and none of that is
# a thing to stage by accident. It also keeps the generated JSON out of
# `biome check .`, which is a red gate rather than a warning (AGENTS.md).
env_root=${RONDO_DOGFOOD_ROOT:-"$repo_root/.worker-scratch/dogfood-env"}
run_id=dogfood-001
force_continuo_rebuild=0

while [ $# -gt 0 ]; do
  case "$1" in
    --root) [ $# -ge 2 ] || die "--root needs a value"; env_root=$2; shift 2 ;;
    --run-id) [ $# -ge 2 ] || die "--run-id needs a value"; run_id=$2; shift 2 ;;
    --force-continuo-rebuild) force_continuo_rebuild=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; die "unknown argument '$1'" ;;
  esac
done

# Absolute from here on. rondo refuses a relative path in the plan by field
# name, and it is right to: a relative path means something different to the
# fenced child than it does to the shell that typed it.
mkdir -p -- "$env_root"
env_root=$(cd -- "$env_root" && pwd)

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
target="$env_root/target"
# The test is "main resolves to a commit", not "a .git exists". An interrupted
# first run -- a seed commit that failed on configured signing is the easy way
# to get one -- leaves a repository a `.git` check calls finished and a lap
# cannot materialise a workspace from, because there is no `main` to cut the
# topic branch off. Repairing it is a rerun; that is what this branch is for.
if [ -d "$target/.git" ] && git -C "$target" rev-parse --verify --quiet refs/heads/main >/dev/null 2>&1; then
  note "already at $target"
else
  mkdir -p -- "$target/docs"
  [ -d "$target/.git" ] || git -C "$target" init --quiet --initial-branch=main
  # A repository left with an unborn HEAD may be pointing at whatever
  # `init.defaultBranch` says rather than at main; the seed commit has to land
  # on the branch the plan names.
  git -C "$target" rev-parse --verify --quiet HEAD >/dev/null 2>&1 ||
    git -C "$target" symbolic-ref HEAD refs/heads/main
  [ -f "$target/docs/NOTES.md" ] ||
    printf '# Notes\n\nA scratch target for walking the rondo operator CLI.\n' > "$target/docs/NOTES.md"
  git -C "$target" add docs/NOTES.md
  # Identity and signing are pinned to this one command: a scratch target is not
  # a place to inherit a machine's commit policy, and signing is the failure
  # that produces the half-initialised repository above.
  git -C "$target" -c user.name=rondo-dogfood -c user.email=rondo-dogfood@invalid \
    -c commit.gpgsign=false \
    commit --quiet -m 'docs: seed the dogfood target'
  note "created $target on branch main"
fi

step "Catalog"
# cadenza resolves the project through this layer. `data` is what it reads;
# `origin` and `base_dir` name where the layer came from, so the file is written
# out to keep the two honest even though nothing reads it back.
catalog_origin="$env_root/catalog/projects.toml"
cat > "$catalog_origin" <<TOML
# Written by scripts/dogfood-env.sh. The plan file carries this same content
# inline as catalog_layers[0].data, which is what cadenza actually reads.
schema_version = 1

[catalog]
allowed_local_roots = ["$env_root"]

[project.dogfood-target]
base_branch = "main"
aliases = []

[project.dogfood-target.source]
kind = "local_path"
path = "$target"
TOML
note "$catalog_origin"

step "Plan"
plan="$env_root/plan.json"
# The request itself is deliberately trivial. What is being walked is the
# mechanism, not the change: a lap that appends one line proves the same six
# verbs as a lap that rewrites a module, and costs the same one dollar-ish.
# It is passed in as an argument because it is the one value here that contains
# quotes, and `node -e` is already inside a quoted shell string.
prompt="Append one line to docs/NOTES.md reading exactly: 'Touched by the rondo operator CLI.' Then commit it with the message 'docs: touched by the rondo operator CLI'. Do nothing else."
node -e '
  const [out, envRoot, runId, controlPlane, target, catalogOrigin, interlockRoot,
         claudeOrgPath, claudeBin, nodeBin, prompt] = process.argv.slice(1);

  // The three budgets are stated rather than inherited. `invocation_ceiling_ms`
  // must be strictly greater than their sum; rondo refuses a ceiling that
  // merely equals it, and a ceiling that fires is a rondo defect (it kills the
  // CLI and not the fenced child), so the margin here is deliberate.
  const turnTimeoutMs = 900_000;
  const gitTimeoutMs = 60_000;
  const identityReadbackTimeoutMs = 120_000;

  const plan = {
    db: controlPlane,
    run_id: runId,
    lease_claimant_id: "rondo-operator",
    workspace: `${envRoot}/workspace-${runId}`,
    base_branch: "main",
    topic_branch: `dogfood/${runId}`,
    prompt,

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

    catalog_layers: [
      {
        layer: "tracked",
        origin: catalogOrigin,
        base_dir: `${envRoot}/catalog`,
        data: {
          schema_version: 1,
          catalog: { allowed_local_roots: [envRoot] },
          project: {
            "dogfood-target": {
              source: { kind: "local_path", path: target },
              base_branch: "main",
              aliases: [],
            },
          },
        },
      },
    ],
    project_name: "dogfood-target",

    agent_type_input: {
      agentTypeId: "worker-basic",
      vocabularyVersion: 1,
      granted: ["command.run"],
      askable: ["branch.push"],
      loopPolicy: { maxReviewRounds: 2, noProgressWindow: 3, noProgressRepeat: 2 },
      executorPolicy: { roleName: "worker", modelTier: "standard", reportingDuties: [] },
    },
    // parties.grantee is run_id spelled a second time, and rondo refuses any
    // other value. `rondo start --run-id` rewrites it, so the two cannot drift.
    parties: { issuer: "rondo-cli", grantee: runId },
    intended_action: { capabilities: ["command.run"] },
  };

  require("node:fs").writeFileSync(out, `${JSON.stringify(plan, null, 2)}\n`);
' "$plan" "$env_root" "$run_id" "$control_plane" "$target" "$catalog_origin" \
  "$interlock_root" "$claude_org_path" "$claude_bin" "$node_bin" "$prompt"
note "$plan"

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
} > "$env_file"
note "$env_file"

# The same quoting for the commands printed below, which are meant to be copied
# into a shell verbatim.
q_repo_root=$(printf %q "$repo_root")
q_env_file=$(printf %q "$env_file")
q_plan=$(printf %q "$plan")
q_approver=$(printf %q "$approver")
q_run_id=$(printf %q "$run_id")

cat <<READY

Ready. The environment is at $env_root

  cd $q_repo_root
  . $q_env_file

  node bin/rondo.mjs start --plan $q_plan
  node bin/rondo.mjs answer
  node bin/rondo.mjs answer --actor-id $q_approver --body=approve
  node bin/rondo.mjs publish --iteration-id $q_run_id --repo OWNER/NAME --actor-id $q_approver --dry-run

'start' spawns a real worker session and costs real money; nothing above this
line did. 'publish' without --dry-run pushes the branch and opens a pull request
as you, so it is left with --dry-run here.

A second lap needs no second plan file:

  node bin/rondo.mjs start --plan $q_plan \\
    --run-id dogfood-002 \\
    --topic-branch dogfood/dogfood-002 \\
    --workspace $(printf %q "$env_root/workspace-dogfood-002") \\
    --prompt "..."

If something is stuck, 'node bin/rondo.mjs abandon --iteration-id ID --reason "..."'
is the way out; see section 7 of docs/operations/rondo-cli.md.
READY
