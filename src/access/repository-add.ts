/**
 * A repository added from the page (rondo#383, D-0090): what rondo infers so
 * the person is asked nothing but "add it".
 *
 * **Everything here is pure.** The clone and the listing of the clone's files
 * run in `./forge.ts`, the one module that may start a process; the record is
 * the store's `setup_plan` row, written by `src/access/cli.ts` exactly as
 * `rondo setup-plan` writes one. This module only says, from what those
 * returned, which plan setup would have recorded.
 *
 * **The plan is setup's newest one with the repository's own facts swapped
 * in** (D-0090 rule 2): the store, the control plane, the fence roots, the
 * worker CLI, the agent type and the review criterion are the ones setup
 * resolved for this host, and only what is the repository's -- where it is,
 * its branch, its forge repository, its project, and the commands its worker
 * may run -- is new. So the host still resolves no fence root of its own.
 */

import type { JsonRecord } from "../store/records.js";

/**
 * The commands every worker may run whatever the repository builds with: what
 * setup grants beside the npm ones, and for the same reasons
 * (`scripts/dogfood-env.sh`, the `allowed_bash` comment) -- `echo` to report
 * an exit status, and the two exact moves that check a red suite against the
 * commit before the lap's.
 */
export const COMMON_BASH: readonly string[] = [
  "echo:*",
  "git switch --detach HEAD~1",
  "git switch -",
];

/** A toolchain rondo recognises in a repository's top-level files. */
export type Toolchain =
  | "npm"
  /** npm with no lockfile, where `npm ci` refuses to run. */
  | "npm-unlocked"
  | "pnpm"
  | "yarn"
  | "bun"
  | "go"
  | "uv"
  | "poetry"
  | "pip"
  | "cargo";

/**
 * Each toolchain's commands, in `allowed_bash`'s subject form (a subject, not
 * a `Bash(...)` rule; `:*` is a prefix). The install lines are exact and skip
 * install scripts where the tool can, for setup's reason: the fence sees the
 * worker's tool calls and not the processes a package's script starts.
 */
const BASH: Readonly<Record<Toolchain, readonly string[]>> = {
  npm: ["npm ci --ignore-scripts", "npm run:*", "npm test:*", "node --version", "npm --version"],
  "npm-unlocked": [
    "npm install --ignore-scripts",
    "npm run:*",
    "npm test:*",
    "node --version",
    "npm --version",
  ],
  pnpm: [
    "pnpm install --frozen-lockfile --ignore-scripts",
    "pnpm run:*",
    "pnpm test:*",
    "node --version",
    "pnpm --version",
  ],
  yarn: [
    "yarn install --frozen-lockfile --ignore-scripts",
    "yarn install --immutable --mode=skip-build",
    "yarn run:*",
    "yarn test:*",
    "node --version",
    "yarn --version",
  ],
  bun: [
    "bun install --frozen-lockfile --ignore-scripts",
    "bun run:*",
    "bun test:*",
    "bun --version",
  ],
  go: ["go mod download", "go build:*", "go test:*", "go vet:*", "gofmt:*", "go version"],
  uv: ["uv sync:*", "uv run:*", "uv --version"],
  poetry: ["poetry install:*", "poetry run:*", "poetry --version"],
  pip: [
    "python3 -m venv .venv",
    ".venv/bin/pip install:*",
    ".venv/bin/python:*",
    ".venv/bin/pytest:*",
    "python3 --version",
  ],
  cargo: [
    "cargo build:*",
    "cargo test:*",
    "cargo check:*",
    "cargo clippy:*",
    "cargo fmt:*",
    "cargo --version",
  ],
};

/**
 * The toolchains a repository's top-level file names say it builds with:
 * TypeScript and JavaScript by their lockfile, Go, Python by its lockfile,
 * and Rust. A repository may have several, and gets each one's commands.
 *
 * ponytail: the top level only, so a monorepo whose manifests sit in
 * subdirectories reads as none. Walking the tree is the upgrade.
 */
export function toolchainsOf(files: readonly string[]): readonly Toolchain[] {
  const has = (name: string) => files.includes(name);
  const found: Toolchain[] = [];
  if (has("package.json")) {
    found.push(
      has("pnpm-lock.yaml")
        ? "pnpm"
        : has("yarn.lock")
          ? "yarn"
          : has("bun.lock") || has("bun.lockb")
            ? "bun"
            : has("package-lock.json") || has("npm-shrinkwrap.json")
              ? "npm"
              : "npm-unlocked",
    );
  }
  if (has("go.mod")) {
    found.push("go");
  }
  if (has("uv.lock")) {
    found.push("uv");
  } else if (has("poetry.lock")) {
    found.push("poetry");
  } else if (
    ["pyproject.toml", "setup.py", "Pipfile"].some(has) ||
    files.some((file) => /^requirements.*\.txt$/.test(file))
  ) {
    found.push("pip");
  }
  if (has("Cargo.toml")) {
    found.push("cargo");
  }
  return found;
}

/** The worker's commands for those toolchains: {@link COMMON_BASH} first, each once. */
export function allowedBashFor(toolchains: readonly Toolchain[]): readonly string[] {
  return [...new Set([...COMMON_BASH, ...toolchains.flatMap((one) => BASH[one])])];
}

/** `OWNER/NAME` split, or null when it is not one a path may be made of. */
export function repositoryParts(
  repo: string,
): { readonly owner: string; readonly name: string } | null {
  const m = /^([\w.-]+)\/([\w.-]+)$/.exec(repo);
  if (m === null) {
    return null;
  }
  const [, owner = "", name = ""] = m;
  // `.` and `..` would name a directory beside the one meant.
  return [owner, name].some((part) => /^\.+$/.test(part)) ? null : { owner, name };
}

/**
 * The project name cadenza's catalog selects the repository by: setup's own
 * derivation (`scripts/dogfood-env.sh`, "project"), over `OWNER-NAME` rather
 * than the directory so two owners' `app` are two projects.
 */
export function projectNameOf(owner: string, name: string): string {
  const folded = `${owner}-${name}`.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  return (/^[a-z]/.test(folded) ? folded : `repo-${folded}`).slice(0, 64);
}

/** The directory `path` is in, for either separator. */
function parentOf(path: string): string {
  const cut = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return cut <= 0 ? path : path.slice(0, cut);
}

/**
 * Setup's root, read off the plan it recorded: the directory its workspaces
 * are cut under is `ROOT/workspaces` (`scripts/dogfood-env.sh`, "Plan").
 */
export function setupRootOf(template: JsonRecord): string | null {
  const root = template["workspace_root"];
  return typeof root === "string" && root !== "" ? parentOf(root) : null;
}

/** Where an added repository is cloned: beside setup's other output, under its root. */
export function cloneDirectory(root: string, owner: string, name: string): string {
  return `${root}/repositories/${owner}/${name}`;
}

/** What setup writes as the prompt of a repository it did not create. */
const PLACEHOLDER_PROMPT =
  "Replace this with the request. The page runs the request's own words, never this.";

/** Setup's plan for the added repository: `template` with the repository's own facts. */
export function planForRepository(
  template: JsonRecord,
  added: {
    readonly root: string;
    readonly repo: string;
    readonly owner: string;
    readonly name: string;
    readonly into: string;
    readonly baseBranch: string;
    readonly allowedBash: readonly string[];
  },
): JsonRecord {
  const project = projectNameOf(added.owner, added.name);
  return {
    ...template,
    repository: added.into,
    base_branch: added.baseBranch,
    prompt: PLACEHOLDER_PROMPT,
    allowed_bash: [...added.allowedBash],
    forge_repository: added.repo,
    pull_request_base_branch: null,
    // What cadenza reads. setup also writes it out to `origin`; nothing reads
    // that file back, so the page does not.
    catalog_layers: [
      {
        layer: "tracked",
        origin: `${added.root}/catalog/${project}.toml`,
        base_dir: `${added.root}/catalog`,
        data: {
          schema_version: 1,
          catalog: { allowed_local_roots: [added.root, added.into] },
          project: {
            [project]: {
              source: { kind: "local_path", path: added.into },
              base_branch: added.baseBranch,
              aliases: [],
            },
          },
        },
      },
    ],
    project_name: project,
  };
}
