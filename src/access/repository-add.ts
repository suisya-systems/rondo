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
 * may run (cadenza's `allowedCommandsFor`, D-0040, written into the catalog
 * project's `allowed_bash`, D-0094) -- is new. So the host still resolves no fence root of its own.
 */

import type { JsonRecord } from "../store/records.js";

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
  // A setup plan recorded before D-0094 still has its own top-level
  // `allowed_bash`; nothing reads it, and copied forward it would be a second,
  // stale list beside the catalog project's.
  const { allowed_bash: _stale, ...rest } = template;
  return {
    ...rest,
    repository: added.into,
    base_branch: added.baseBranch,
    prompt: PLACEHOLDER_PROMPT,
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
              // The one list the worker may run (D-0094): cadenza's
              // `allowedCommandsFor` over the clone's top-level files, in the
              // project so it is inside the contract's `config_digest`.
              allowed_bash: [...added.allowedBash],
            },
          },
        },
      },
    ],
    project_name: project,
  };
}
