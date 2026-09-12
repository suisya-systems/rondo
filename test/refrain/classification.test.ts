/**
 * The one check `classifyPlan` makes *about* cadenza's answer: that the catalog
 * layer and the lap name the same repository.
 *
 * **Why this file exists at all.** A plan says which repository a lap is for in
 * four places -- `repository`, `base_branch`, and `source.path` and
 * `base_branch` again inside the catalog layer that declares the project
 * `project_name` selects -- and two of those pairs are the same fact written
 * twice. Nothing compared them, so a plan that disagreed with itself was
 * admitted, spawned a worker, and was found out by reading the commits it left
 * somewhere unintended (rondo #72). The assertions below are that it is found
 * out at `classify` instead, which is before `admit`: before any run exists at
 * continuo, any fence is rendered or any money is spent.
 *
 * **The fixtures are in memory and nothing here is provisioned.** This is the
 * property `test/cadenza/smoke.test.ts` names: the facade reads no file, no
 * clock and no network, so a real cadenza composes a real catalog in the
 * ordinary suite. `CATALOG_DIR` and the repository paths are `resolve`d rather
 * than written as POSIX literals, because on Windows a path with no drive
 * letter is drive-*relative* and cadenza refuses it -- no directory of any of
 * these names is read or created.
 */
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

import type { CatalogLayer } from "../../src/cadenza/facade.js";
import { allocate } from "../../src/refrain/allocator.js";
import { classifyPlan } from "../../src/refrain/classification.js";
import { type AdmittedPlan, admittedPlan, type RunPlan, runPlan } from "../../src/refrain/plan.js";

const CATALOG_DIR = resolve("/srv/catalog");
const REPOSITORY = resolve("/srv/rondo/repo");
const ELSEWHERE = resolve("/srv/rondo/somewhere-else");
const WORKSPACE_ROOT = resolve("/srv/rondo/work");

/**
 * A layer declaring one project whose source is the local repository.
 *
 * `allowed_local_roots` names the repository itself, which cadenza accepts: a
 * path is under itself, so this admits exactly the target and nothing beside
 * it. `scripts/dogfood-env.sh` writes the same shape for the same reason.
 */
function layerFor(path: string, baseBranch: string): CatalogLayer {
  return {
    layer: "tracked",
    origin: `${CATALOG_DIR}/projects.toml`,
    baseDir: CATALOG_DIR,
    data: {
      schema_version: 1,
      catalog: { allowed_local_roots: [path] },
      project: {
        rondo: {
          source: { kind: "local_path", path },
          base_branch: baseBranch,
          aliases: [],
        },
      },
    },
  };
}

/**
 * One plan, admitted the way `admit()` really does it.
 *
 * Built through `runPlan` and `admittedPlan` rather than as a literal so that a
 * fixture cannot carry a field combination the validator would have refused --
 * which would make a passing assertion here say nothing about a plan rondo can
 * actually run.
 */
function planWith(overrides: {
  readonly repository?: string;
  readonly baseBranch?: string;
  readonly catalogPath?: string;
  readonly catalogBaseBranch?: string;
  readonly pullRequestBaseBranch?: string | null;
  readonly projectName?: string;
  /** The plan's declaration (`continuo D-1110`); one subject by default. */
  readonly allowedBash?: readonly string[];
  /** The agent type's capability keys; `command.run` by default. */
  readonly granted?: readonly string[];
  /** The agent type's model tier; `standard` by default. */
  readonly modelTier?: string;
}): AdmittedPlan {
  const input: RunPlan = {
    db: resolve("/srv/rondo/control.db"),
    workspaceRoot: WORKSPACE_ROOT,
    baseBranch: overrides.baseBranch ?? "main",
    prompt: "teach rondo to count",
    allowedBash: overrides.allowedBash ?? ["npm run:*"],
    materialLanguage: null,
    repository: overrides.repository ?? REPOSITORY,
    artifactRoot: resolve("/srv/rondo/artifacts"),
    stateRoot: resolve("/srv/rondo/state"),
    interlockRoot: resolve("/srv/rondo/interlock"),
    claudeOrgPath: resolve("/srv/rondo/claude-org"),
    endpointRecipient: "external-notify",
    endpointDestinationDir: resolve("/srv/rondo/outbox"),
    claudeCommand: [resolve("/usr/bin/claude")],
    endpointDb: null,
    endpointModule: null,
    node: null,
    hookScript: null,
    python: null,
    pollIntervalMs: null,
    turnTimeoutMs: 900_000,
    gitTimeoutMs: 60_000,
    identityReadbackTimeoutMs: 30_000,
    gateOptions: ["approve", "revise"],
    gateDeadlineAtMs: null,
    pullRequestBaseBranch: overrides.pullRequestBaseBranch ?? null,
    invocationCeilingMs: 1_800_000,
    catalogLayers: [
      layerFor(overrides.catalogPath ?? REPOSITORY, overrides.catalogBaseBranch ?? "main"),
    ],
    projectName: overrides.projectName ?? "rondo",
    agentTypeInput: {
      agentTypeId: "worker-basic",
      vocabularyVersion: 1,
      granted: [...(overrides.granted ?? ["command.run"])],
      askable: ["branch.push"],
      loopPolicy: { maxReviewRounds: 2, noProgressWindow: 3, noProgressRepeat: 2 },
      executorPolicy: {
        roleName: "worker",
        modelTier: overrides.modelTier ?? "standard",
        reportingDuties: [],
      },
    },
    parties: { issuer: "rondo-host", grantee: "unset" },
    intendedAction: { capabilities: ["command.run"] },
  };
  const planned = runPlan(input);
  if (planned.kind !== "planned") {
    throw new Error(`the fixture plan is not a plan: ${planned.reason}`);
  }
  const allocation = allocate("iter-1", WORKSPACE_ROOT);
  if (allocation.kind !== "allocated") {
    throw new Error(`the fixture iteration id was refused: ${allocation.reason}`);
  }
  const admitted = admittedPlan(planned.plan, allocation.allocation);
  if (admitted.kind !== "planned") {
    throw new Error(`the fixture admission was refused: ${admitted.reason}`);
  }
  return admitted.plan;
}

describe("classifyPlan, when the catalog and the lap name one repository", () => {
  test("answers, and the answer is cadenza's", () => {
    const outcome = classifyPlan(planWith({}));
    expect(outcome.kind).toBe("answered");
  });

  test("a trailing separator is the same directory, not a disagreement", () => {
    const outcome = classifyPlan(planWith({ repository: `${REPOSITORY}/` }));
    expect(outcome.kind).toBe("answered");
  });

  /**
   * The two sides are spelled by two different rules: cadenza runs its
   * `local_path` through a `normpath`, while `readPlan` checks `repository` is
   * absolute and otherwise keeps what the operator typed. A comparison that
   * only trimmed the end would refuse these plans for disagreeing with
   * themselves, which is the opposite of what this check is for.
   */
  test("a '.' segment and a doubled separator are the same directory too", () => {
    for (const spelling of [`${REPOSITORY}/.`, REPOSITORY.replace(/\/([^/]+)$/, "//$1")]) {
      const outcome = classifyPlan(planWith({ repository: spelling }));
      expect(outcome.kind, spelling).toBe("answered");
    }
  });

  /**
   * On POSIX a backslash is an ordinary character in a file name, so folding it
   * to a separator would let a contract issued about one repository pass while
   * the lap runs in another. Windows is where a backslash *is* a separator, and
   * the shape of the path is what decides -- not the platform this test happens
   * to run on.
   */
  /**
   * **A POSIX-cell test, and its Windows half is the UNC one below.** Whether a
   * backslash separates two directories or is a character inside one name is
   * the platform's answer, not rondo's, and `normalisePath` gets it from
   * cadenza's `nativePath` -- which is the flavour of the machine it runs on.
   * So this asserts what is true where it runs rather than asserting one
   * platform's answer everywhere: on POSIX `/srv/a\b` and `/srv/a/b` are two
   * directories, and folding them together would let a contract issued about
   * the first pass while the lap ran in the second -- the exact fault this
   * check exists to catch, let through by the check itself. On Windows they are
   * one directory and `answered` is the right answer there.
   */
  test.skipIf(process.platform === "win32")(
    "a backslash is not a separator in a POSIX path",
    () => {
      const outcome = classifyPlan(planWith({ repository: "/srv/a\\b", catalogPath: "/srv/a/b" }));
      expect(outcome.kind).toBe("refused");
    },
  );
});

describe("classifyPlan, on a Windows-shaped path", () => {
  /**
   * A UNC root is `\\\\server\\share`, not `\\\\`: the share is not a directory a
   * `..` can climb out of, so cadenza's normalisation keeps both components.
   * Treating them as ordinary segments would answer one thing for the plan's
   * spelling and another for cadenza's, and refuse a plan that says the same
   * path twice.
   *
   * **This one runs in the windows cell only**, and that is a property of the
   * subject rather than a convenience. On a POSIX host cadenza reads a UNC
   * string as a *relative* path and anchors it to the layer's `baseDir`, so the
   * two sides are not two spellings of one path there and the case cannot be
   * reached through `classifyPlan` at all. The matrix runs a windows cell
   * (`D-0003`), which is where this is exercised.
   */
  test.skipIf(process.platform !== "win32")(
    "a UNC root keeps its server and share through a '..'",
    () => {
      const outcome = classifyPlan(
        planWith({
          repository: "\\\\\\\\server\\\\share\\\\sub\\\\..\\\\repo",
          catalogPath: "\\\\\\\\server\\\\share\\\\repo",
        }),
      );
      expect(outcome.kind).toBe("answered");
    },
  );
});

describe("classifyPlan, when the grant and the fence disagree", () => {
  /**
   * **rondo#67, as a case that costs nothing.** The lap that found this granted
   * `command.run` and ran under a fence whose allow list is six git specs, so
   * `npm ci --ignore-scripts`, `npm run verify`, `npm --version` and
   * `node vendor/pin.mjs check` each answered `This command requires approval`
   * to a `claude -p` child with nobody to ask. Both halves were real and they
   * disagreed silently (D-0039 rule 2). This is the planted case that the
   * disagreement is now answered at `classify` -- before the run exists at
   * continuo, before a worktree, before a worker.
   */
  test("refuses a plan that grants command.run and declares no command", () => {
    const outcome = classifyPlan(planWith({ allowedBash: [] }));
    expect(outcome.kind).toBe("refused");
    if (outcome.kind !== "refused") {
      return;
    }
    // The message names the grant, the field and the fault, because the person
    // reading it has to choose which of the two halves to change.
    expect(outcome.message).toContain("command.run");
    expect(outcome.message).toContain("allowed_bash");
    expect(outcome.message).toContain("rondo#67");
  });

  /**
   * The mirror image, and the quieter of the two: a fence widened for a lap
   * cadenza was never asked to authorise for execution is a widening that
   * appears in no contract.
   */
  test("refuses a declaration the agent type does not grant command.run for", () => {
    const outcome = classifyPlan(planWith({ granted: ["worktree.write"] }));
    expect(outcome.kind).toBe("refused");
    if (outcome.kind !== "refused") {
      return;
    }
    expect(outcome.message).toContain("command.run");
    expect(outcome.message).toContain("allowed_bash");
  });

  test("a lap that neither grants nor declares is not a disagreement", () => {
    // The pair is what is checked, not the presence of either: an agent type
    // that does not run commands and declares none is a plan cadenza answers
    // for, and the answer is cadenza's rather than this check's.
    const outcome = classifyPlan(planWith({ granted: ["worktree.write"], allowedBash: [] }));
    expect(outcome.kind).toBe("answered");
  });

  test("the check runs before the contract, so it is not cadenza's refusal", () => {
    // Both halves of the plan are otherwise valid here, and cadenza is never
    // asked: the refusal is rondo's own words about rondo's own inputs, which
    // is what makes it actionable before a spawn (D-0039 rule 3).
    const outcome = classifyPlan(planWith({ allowedBash: [] }));
    expect(outcome.kind === "refused" && outcome.message).toContain("disagrees with itself");
  });
});

describe("classifyPlan, when the agent type names a tier rondo does not price", () => {
  /**
   * rondo#138's falsifier, answered before the row that used to falsify it:
   * before this rule the same fact reached `performLap` after `run admit`, with
   * a run already admitted at continuo and nobody to close it. `classifyPlan`
   * answers before `startContinuo`, so no run exists at continuo to leave
   * behind.
   */
  test("refuses a tier the loop does not price, and names the tier and the priced set", () => {
    const outcome = classifyPlan(planWith({ modelTier: "frugal" }));
    expect(outcome.kind).toBe("refused");
    if (outcome.kind !== "refused") {
      return;
    }
    expect(outcome.message).toContain("frugal");
    expect(outcome.message).toContain("standard");
  });

  test("a priced tier is not a disagreement", () => {
    const outcome = classifyPlan(planWith({ modelTier: "standard" }));
    expect(outcome.kind).toBe("answered");
  });

  test("the check runs before the contract, so it is not cadenza's refusal", () => {
    const outcome = classifyPlan(planWith({ modelTier: "frugal" }));
    expect(outcome.kind === "refused" && outcome.message).toContain("rondo does not price");
  });
});

describe("classifyPlan, when the plan disagrees with itself", () => {
  test("refuses a repository the catalog does not name, and names both values", () => {
    const outcome = classifyPlan(planWith({ catalogPath: ELSEWHERE }));
    expect(outcome.kind).toBe("refused");
    if (outcome.kind !== "refused") {
      return;
    }
    expect(outcome.message).toContain(REPOSITORY);
    expect(outcome.message).toContain(ELSEWHERE);
  });

  test("refuses a base branch the catalog does not name", () => {
    const outcome = classifyPlan(planWith({ catalogBaseBranch: "trunk" }));
    expect(outcome.kind).toBe("refused");
    if (outcome.kind !== "refused") {
      return;
    }
    expect(outcome.message).toContain("trunk");
    expect(outcome.message).toContain("main");
  });
});

describe("classifyPlan, on a second lap", () => {
  /**
   * A revision is cut from its predecessor's topic branch rather than from the
   * project's base branch -- that is what makes it a continuation and not a
   * restart (D-0027) -- and it carries the first lap's base branch in
   * `pullRequestBaseBranch`. Comparing `baseBranch` against the catalog there
   * would refuse every revision rondo runs, which is the one way this check
   * could do more harm than the fault it catches.
   */
  test("does not compare the base branch, because the lap is cut from the last one", () => {
    const outcome = classifyPlan(
      planWith({ baseBranch: "rondo/iter-0", pullRequestBaseBranch: "main" }),
    );
    expect(outcome.kind).toBe("answered");
  });

  test("still compares the repository, which a revision never changes", () => {
    const outcome = classifyPlan(
      planWith({
        baseBranch: "rondo/iter-0",
        pullRequestBaseBranch: "main",
        catalogPath: ELSEWHERE,
      }),
    );
    expect(outcome.kind).toBe("refused");
  });
});

describe("classifyPlan, when the source names no directory", () => {
  /**
   * A `git_url` source is not the same statement as `repository`: it names a
   * remote, not a directory on this machine, so there is nothing to compare and
   * the check says nothing. Asserted rather than assumed, because a check that
   * quietly widened to this case would refuse every plan whose project is
   * cloned from a forge.
   */
  test("says nothing about a git_url project", () => {
    const plan = planWith({});
    const outcome = classifyPlan({
      ...plan,
      repository: ELSEWHERE,
      catalogLayers: [
        {
          layer: "tracked",
          origin: `${CATALOG_DIR}/projects.toml`,
          baseDir: CATALOG_DIR,
          data: {
            schema_version: 1,
            project: {
              rondo: {
                source: { kind: "git_url", url: "https://example.invalid/org/rondo.git" },
                base_branch: "main",
                aliases: [],
              },
            },
          },
        },
      ],
    });
    expect(outcome.kind).toBe("answered");
  });
});
