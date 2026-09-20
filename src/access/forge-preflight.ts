/**
 * Where a publish would go, and whether it can go there.
 *
 * The pure half of publishing, split from `./cli.ts` so that the rules about a
 * forge repository sit apart from the command line that prints them. Every
 * function here is total over what it is handed: reading a git config is a
 * capability and lives in `./forge.ts`, which is the only module allowed to
 * start a process, and this module takes that module's *reading* as a value.
 *
 * `redactRemoteUrl` is exported for the same reason the checks are here: a push
 * URL can carry a token, and every surface that prints one -- the preflight's
 * refusals and the plan `cli.ts` shows -- has to print it the same way.
 */
import type { PushTargetInspection } from "./forge.js";

/** A forge repository as `gh` names one: `owner/name`. */
export interface ForgeSlug {
  readonly owner: string;
  readonly name: string;
}

/** The same, plus the host it is on -- which a remote URL always carries. */
export interface RemoteRepository extends ForgeSlug {
  readonly host: string;
}

/** The characters GitHub allows in an owner or a repository name. */
const SLUG_SEGMENT = /^[A-Za-z0-9._-]+$/;

/** `owner/name`, or null for anything that is not exactly that. */
export function parseForgeSlug(text: string): ForgeSlug | null {
  const parts = text.split("/");
  if (parts.length !== 2) {
    return null;
  }
  const [owner, name] = parts;
  if (owner === undefined || name === undefined) {
    return null;
  }
  if (!SLUG_SEGMENT.test(owner) || !SLUG_SEGMENT.test(name)) {
    return null;
  }
  return { owner, name };
}

/**
 * The `owner/name` a git remote URL points at, when it points at a forge.
 *
 * **Null is an answer, and a common one.** A remote may be a local path, a bare
 * repository on the same disk, a `file://` URL or a host whose paths are not
 * `owner/name` at all; none of those is a repository `gh pr create --repo` can
 * be about, and none of them is malformed. The caller distinguishes "this names
 * a different repository" from "rondo cannot tell what this names", because the
 * two deserve different sentences even though both stop a publish.
 *
 * Both spellings git accepts are read: the scp-like `git@host:owner/name.git`
 * and the URL forms `ssh://`, `git://`, `http://` and `https://`.
 */
export function repositoryFromRemoteUrl(url: string): RemoteRepository | null {
  const trimmed = url.trim();
  let host: string | null = null;
  let path: string | null = null;
  const scpLike = /^[A-Za-z0-9._-]+@([A-Za-z0-9._-]+):(?!\/)(.+)$/.exec(trimmed);
  if (scpLike !== null) {
    host = scpLike[1] ?? null;
    path = scpLike[2] ?? null;
  } else if (/^(?:ssh|git|https?):\/\//.test(trimmed)) {
    const afterScheme = trimmed.replace(/^[A-Za-z][A-Za-z0-9+.-]*:\/\//, "");
    const slash = afterScheme.indexOf("/");
    if (slash !== -1) {
      // Userinfo off the front, port off the back: what is left is the host,
      // which is half of the identity of a repository and was the half a
      // slug-only reading threw away.
      const authority = afterScheme.slice(0, slash);
      const at = authority.lastIndexOf("@");
      host = (at === -1 ? authority : authority.slice(at + 1)).split(":")[0] ?? null;
      path = afterScheme.slice(slash + 1);
    }
  }
  if (host === null || host === "" || path === null) {
    return null;
  }
  const cleaned = path
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\.git$/, "");
  const slug = parseForgeSlug(cleaned);
  return slug === null ? null : { host, owner: slug.owner, name: slug.name };
}

/** Whether two host names are the same forge. `www.` is not a different one. */
function sameHost(left: string, right: string): boolean {
  const bare = (host: string): string => host.toLowerCase().replace(/^www\./, "");
  return bare(left) === bare(right);
}

/**
 * The host a pull request would be opened on, as the forge CLI would resolve it.
 *
 * **`--repo OWNER/NAME` carries no host, so the host has to come from somewhere,
 * and the only safe somewhere is where `gh` gets it.** `gh` reads it from the
 * environment and falls back to github.com, and rondo is handed the same
 * environment it will spawn `gh` under -- so this reads it rather than assuming
 * github.com. Assuming would produce exactly the failure these checks exist to
 * stop: a push approved against one forge while the pull request is opened on
 * another.
 */
export function forgeHost(environment: Readonly<Record<string, string | undefined>>): string {
  const named = environment[FORGE_HOST_ENV];
  return named === undefined || named.trim() === "" ? DEFAULT_FORGE_HOST : named.trim();
}

const FORGE_HOST_ENV = "GH_HOST";
const DEFAULT_FORGE_HOST = "github.com";

/**
 * A remote URL as it may be printed: any credentials in it replaced.
 *
 * A push URL can carry a token in its userinfo (`https://user:TOKEN@host/...`),
 * and every place rondo mentions a remote URL is a line an operator reads, a
 * terminal scrolls back and a captured log keeps. Refusing to print the URL at
 * all would remove the one fact that makes the refusal actionable, so what is
 * printed is the URL without the part that is a secret.
 */
export function redactRemoteUrl(url: string): string {
  return url.replace(/^([A-Za-z][A-Za-z0-9+.-]*:\/\/)[^/@]*@/, "$1<redacted>@");
}

/** Whether two slugs name the same repository. GitHub is case-insensitive. */
function sameRepository(left: ForgeSlug, right: ForgeSlug): boolean {
  return (
    left.owner.toLowerCase() === right.owner.toLowerCase() &&
    left.name.toLowerCase() === right.name.toLowerCase()
  );
}

/** What publish may do, once the workspace has been asked about it. */
export type PreflightOutcome =
  | {
      readonly kind: "ready";
      /** What `gh pr create --head` is given, and what the plan prints. */
      readonly headRef: string;
      /** Things the operator has to know before running this, and none of them fatal. */
      readonly warnings: readonly string[];
    }
  | { readonly kind: "refused"; readonly reason: string };

/** What preflight decides over. Every field is already known before git is asked. */
export interface PreflightInput {
  /**
   * The repository to publish to, as `OWNER/NAME`.
   *
   * **Where it was named is not this function's business** (D-0081 rule 3.2).
   * It is the lap's own plan when the plan carries one and the host's `--repo`
   * when it does not, and the rules below are the same rules either way -- so
   * the sentences here name the repository rather than the flag, which is only
   * one of the two places it can now come from.
   */
  readonly repo: string;
  readonly remote: string;
  readonly workspace: string;
  readonly topicBranch: string;
  /** The host the repository is on: what `forgeHost` read, not an assumption. */
  readonly forgeHost: string;
  readonly allowRemoteMismatch: boolean;
  readonly inspection: PushTargetInspection;
}

/**
 * Whether the three legs `publish` is about to print can actually run.
 *
 * **This is the defect this function exists for**, measured on 2026-09-06: a
 * `--dry-run` printed `git push origin dogfood-001` for a workspace with no
 * remotes configured at all, and a `gh pr create --repo suisya-systems/rondo`
 * for a branch holding a scratch repository's commits. A preview whose whole
 * purpose is to catch a mistake before the real run printed both as though they
 * would work. So the checks run **before anything is printed and whether or not
 * `--dry-run` was given**: a preview that passes where the real thing would
 * fail is the same defect in a quieter form.
 *
 * **Why a mismatch between the push remote and `--repo` is a refusal with a
 * named override, rather than either a hard equality or a warning.** Pushing to
 * a fork and opening the pull request against the upstream is a legitimate way
 * to work, so requiring equality would refuse correct usage. But the failure
 * being closed here is precisely that the two can be unrelated without anyone
 * noticing, and a warning printed above a plan that then runs is exactly the
 * "printed something that cannot work" this replaces. So: refuse by default,
 * name the flag that says "yes, they differ and I mean it", and -- because the
 * fork case is the one being kept open -- spell `--head` as `owner:branch` when
 * the override is used, since a bare branch name is read by `gh` as a branch of
 * `--repo` and would find the wrong branch or none.
 *
 * **Agreement is over the host and every destination, not two path segments
 * and the first URL.** A remote on another host whose path happens to read as
 * `owner/name` is a different repository wearing the same name, and the host to
 * compare against is the one the forge CLI will resolve rather than an assumed
 * github.com (see `forgeHost`). A remote can also push to several URLs at once,
 * and all of them have to agree, because all of them receive the branch.
 *
 * Pure, over what `inspectPushTarget` read. The rules are here because they are
 * rules about publishing; the process that reads a git config is in `./forge.ts`
 * because that is the only module allowed to start one.
 */
export function publishPreflight(input: PreflightInput): PreflightOutcome {
  const wanted = parseForgeSlug(input.repo);
  if (wanted === null) {
    return {
      kind: "refused",
      reason:
        `the repository to publish to is '${input.repo}', and it must be OWNER/NAME -- the ` +
        "repository as gh names one. rondo passes it to `gh pr create --repo` unchanged.",
    };
  }
  if (input.inspection.kind === "unreadable") {
    return {
      kind: "refused",
      reason:
        `rondo could not read the workspace '${input.workspace}' that publish would push from: ` +
        `${input.inspection.reason}. It stops here rather than printing a plan it cannot check.`,
    };
  }
  const inspection = input.inspection;
  if (inspection.pushUrls.length === 0) {
    const configured =
      inspection.remotes.length === 0
        ? "It has no remotes configured at all"
        : `The remotes it has are: ${inspection.remotes.join(", ")}`;
    return {
      kind: "refused",
      reason:
        `The workspace '${input.workspace}' has no remote '${input.remote}', so ` +
        `'git push ${input.remote} ${input.topicBranch}' cannot run. ${configured}. Name one ` +
        "that is there with --remote NAME, or add the remote to the workspace.",
    };
  }
  if (!inspection.topicBranchExists) {
    return {
      kind: "refused",
      reason:
        `The workspace '${input.workspace}' has no branch '${input.topicBranch}', which is the ` +
        "branch the iteration's plan says the lap committed on. There is nothing to push, and a " +
        "workspace that lost it is not a workspace to publish from.",
    };
  }

  // **Every destination, not the first one.** `remote.<name>.pushurl` is
  // multi-valued and `git push` sends to all of them, so a check that read one
  // URL would approve a publish that also reached repositories it never looked
  // at.
  const destinations = inspection.pushUrls.map((url) => ({
    shown: redactRemoteUrl(url),
    repository: repositoryFromRemoteUrl(url),
  }));
  const agrees = (destination: (typeof destinations)[number]): boolean =>
    destination.repository !== null &&
    sameHost(destination.repository.host, input.forgeHost) &&
    sameRepository(destination.repository, wanted);
  const disagreeing = destinations.filter((destination) => !agrees(destination));
  if (disagreeing.length === 0) {
    return { kind: "ready", headRef: input.topicBranch, warnings: [] };
  }

  const differences = disagreeing.map((destination) => {
    const repository = destination.repository;
    return repository === null
      ? `'${destination.shown}' is not a repository rondo can read as OWNER/NAME on a forge`
      : `'${destination.shown}' is '${repository.owner}/${repository.name}' on ${repository.host}`;
  });
  const scope =
    destinations.length === 1
      ? `'${input.remote}' pushes to one place: ${differences[0] ?? ""}`
      : `'${input.remote}' pushes to ${String(destinations.length)} places, and ` +
        `${String(disagreeing.length)} of them do not match: ${differences.join("; ")}`;
  const wantedShown = `'${input.repo}' on ${input.forgeHost}`;
  if (!input.allowRemoteMismatch) {
    return {
      kind: "refused",
      reason:
        "The push and the pull request would not be about the same repository. The pull " +
        `request would be opened in ${wantedShown}, and ${scope}. The push goes to the ` +
        "workspace's remote, so publishing this way puts the branch somewhere the pull request " +
        "does not look. If that is deliberate -- pushing to a fork and opening the " +
        "pull request upstream is the usual reason -- pass --allow-remote-mismatch.",
    };
  }

  // The override was given, so the operator has said the two differ on purpose.
  // What is left is to make the forge agree: a bare `--head branch` names a
  // branch of `--repo`, which is not where the push went. Qualifying it needs
  // one owner on the forge's own host, which is the fork case; anything else --
  // a local path, another host, or several destinations that disagree with each
  // other -- has no single owner to name, and rondo says so rather than
  // choosing one.
  const owners = new Set(
    destinations.map((destination) =>
      destination.repository !== null && sameHost(destination.repository.host, input.forgeHost)
        ? destination.repository.owner
        : null,
    ),
  );
  const owner = owners.size === 1 ? [...owners][0] : null;
  if (owner === null || owner === undefined) {
    return {
      kind: "ready",
      headRef: input.topicBranch,
      warnings: [
        `--allow-remote-mismatch: ${scope}, while the pull request is opened against ` +
          `${wantedShown}. There is no single ${input.forgeHost} owner to qualify the head ` +
          `with, so it stays '${input.topicBranch}' and the forge will look for that branch in ` +
          `'${input.repo}'. Expect the pull-request leg to fail unless it is there.`,
      ],
    };
  }
  return {
    kind: "ready",
    headRef: `${owner}:${input.topicBranch}`,
    warnings: [
      `--allow-remote-mismatch: pushing to '${owner}' on ${input.forgeHost} and opening the ` +
        `pull request against ${wantedShown}. The head is spelled ` +
        `'${owner}:${input.topicBranch}' so that the forge looks for the branch where the push ` +
        "put it.",
    ],
  };
}
