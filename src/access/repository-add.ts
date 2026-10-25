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
import { PLACEHOLDER_PROMPT } from "./setup-plan.js";
import { type Press, spendPress } from "./web-app.js";

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
    // A record is a fact of the repository named at setup (D-0098 rule 3.1),
    // and the template's is another repository's: the page asks nothing but
    // "add it", so an added repository names none and its files are ordinary.
    decision_record: null,
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

// The press's port and its words, moved out of `web-app.ts` at its size cap (rondo#676).

/** What one add-repository press names (rondo#383): the request, and the repository it named. */
export interface AddRepositoryInput {
  readonly requestMessageId: string;
  /** `OWNER/NAME`, as the page read it off the request. */
  readonly repo: string;
}

/**
 * Why an add-repository press added nothing, as the wording key the page says
 * it in (D-0090 rule 4): the ones a person answers differently -- `gh` not
 * installed or not signed in (both the sign-in screen, rondo#676 and D-0204),
 * what the account can see, and anything else, which a press
 * again may clear -- and a store setup never finished, which no press repairs.
 */
export type AddRepositoryRefusal =
  | "addRepositoryRefusedInstall"
  | "addRepositoryRefusedSignedOut"
  | "addRepositoryRefusedUnseen"
  | "addRepositoryRefusedFailed"
  | "addRepositoryRefusedNoSetup"
  | "recordSetupPlanRefusedGone"
  | "addRepositoryRefusedChanged";

/** The refusals the sign-in screen repairs, which their page links to. */
export const SIGN_IN_REPAIRS: ReadonlySet<string> = new Set<AddRepositoryRefusal>([
  "addRepositoryRefusedInstall",
  "addRepositoryRefusedSignedOut",
]);

/** What adding a repository did: added, or why not with rondo's own reason. */
export type AddedRepository =
  | { readonly ok: true }
  | { readonly ok: false; readonly why: AddRepositoryRefusal; readonly note: string };

/**
 * The seventh thing this surface may write (rondo#383, D-0090): a repository
 * cloned and recorded as setup records one, on the person's press. Its own
 * class for `ReleasePort`'s reason: adding a repository is not answering
 * a gate, and a holder of the other ports must not be able to do it.
 */
export class AddRepositoryPort {
  readonly #add: (input: AddRepositoryInput) => Promise<AddedRepository>;

  constructor(add: (input: AddRepositoryInput) => Promise<AddedRepository>) {
    this.#add = add;
  }

  /** Add one repository, on one press. */
  async add(press: Press, input: AddRepositoryInput): Promise<AddedRepository> {
    if (!spendPress(press)) {
      return {
        ok: false,
        why: "addRepositoryRefusedFailed",
        note: "nothing was added: this was not a person's press",
      };
    }
    return await this.#add(input);
  }
}
