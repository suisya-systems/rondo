/**
 * The vendored cadenza, driven end to end through rondo's facade.
 *
 * This is D-0018 rule 6. It is a *smoke*, and what it proves is bounded: the
 * tarball rondo committed installs, imports and runs on this platform and this
 * Node; the four values rondo asked cadenza for are on the exported surface and
 * behave as their contracts say; and rondo's facade wires them together in the
 * one order that matters -- a resolved project's `config_digest` and an agent
 * type's vocabulary version reach a contract cadenza issued, and an action
 * classified against that contract comes back with the digest of the contract
 * it was classified under.
 *
 * **It goes through `src/cadenza/facade.ts` and never imports the package.** A
 * test that imported `@suisya-systems/cadenza` directly would prove the tarball
 * works and nothing about rondo: the production boundary, the one module the
 * import is granted to, and the mapping the facade performs would all be
 * outside the assertion. That is a discipline this file keeps, not a rule
 * enforced on it -- the boundary sweep walks `src/` only, so nothing would stop
 * a later test from reaching past the facade. It would stop proving what this
 * header claims, which is the reason to keep it.
 *
 * **The fixtures are in memory.** No catalog on disk, no clock, no process and
 * no network, so this runs in the ordinary suite -- in both seeded runs of
 * every matrix cell -- rather than behind a capability flag the way the
 * continuo smoke must. That is the point of putting it here: the vendored
 * artifact is exercised on Windows and on Node 22 and 24 without anything being
 * provisioned.
 *
 * **One thing is deliberately not asserted, and one is deliberately not done.**
 * The provenance file path is platform-spelled, so only its layer is checked.
 * `config_digest` and `contract_digest`, by contrast, *are* asserted exactly,
 * and that is safe for the same reason: the fixture's source is a git URL and
 * carries no path, where a `local_path` project would be anchored to `baseDir`
 * and would digest differently on the ubuntu and windows cells. And when
 * `classify()` answers `needs_approval`, this file reads the answer and stops:
 * composing a widening successor, or standing in for a human's yes, is the one
 * thing rondo may never do (D-0009, D-0018 rule 7).
 */
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";

import {
  type AgentType,
  agentTypeRecord,
  type CatalogLayer,
  classifyAction,
  issueInitialContract,
  type ResolvedProject,
  resolveProject,
} from "../../src/cadenza/facade.js";

/**
 * An absolute directory in this platform's own spelling.
 *
 * cadenza refuses a relative `baseDir`, and on Windows a path with no drive
 * letter is drive-*relative* -- so the POSIX-shaped literal that reads as
 * absolute here is refused there. `resolve` answers in the platform's spelling
 * on both, which is why this is not the string it looks like it could be. No
 * directory of this name is read, created or required to exist.
 */
const CATALOG_DIR = resolve("/srv/catalog");

/** The one layer this fixture composes, as rondo hands it over. */
const TRACKED: CatalogLayer = {
  layer: "tracked",
  origin: join(CATALOG_DIR, "projects.toml"),
  baseDir: CATALOG_DIR,
  data: {
    schema_version: 1,
    project: {
      rondo: {
        // A git URL rather than a local path on purpose: a `local_path` is
        // anchored to `baseDir`, so its digest would be a different value on
        // the windows cell and this file's exact-digest assertions would have
        // to become approximate ones.
        source: { kind: "git_url", url: "https://example.invalid/org/rondo.git" },
        base_branch: "main",
        aliases: ["host"],
      },
    },
  },
};

/**
 * The agent type this smoke issues a contract from.
 *
 * `vocabularyVersion` is written here, once, and every later assertion reads it
 * off the record rather than off a constant: cadenza classifies a key against
 * the vocabulary the *contract* pinned, not the newest the build knows
 * (cadenza D-0027), so a smoke that compared against `VOCABULARY_VERSION_1`
 * would be testing today's fixture instead of the mapping from record to
 * contract.
 *
 * `executorPolicy` is carried and never interpreted, by cadenza or by this
 * test: `roleName` is the neutral name rondo's invocation adapter will map onto
 * an executor's roster (D-0014), and nothing here asks what it means.
 */
const AGENT_TYPE_INPUT = {
  agentTypeId: "reviewer",
  vocabularyVersion: 1,
  granted: ["command.run", "worktree.write"],
  askable: ["branch.push"],
  loopPolicy: { maxReviewRounds: 2, noProgressWindow: 3, noProgressRepeat: 2 },
  executorPolicy: {
    roleName: "implementer",
    modelTier: "standard",
    reportingDuties: ["gate-report"],
  },
} as const;

/** The run presenting the contract. It is the grantee, or classification says so. */
const RUN_ID = "run-0001";

/**
 * The exact values cadenza computes for the fixtures above, measured against
 * the pinned build on 2026-09-06.
 *
 * Written as literals rather than recomputed through cadenza, which would be
 * the test asserting that a function equals itself. They are what makes this a
 * check on cadenza's canonical-JSON encoding and digest framing -- the bytes a
 * later audit compares against -- rather than a check that some string came
 * back. A cadenza bump that moves either digest fails here, loudly, which is
 * the intended reading of the failure: the vendored artifact changed what it
 * computes.
 */
const CONFIG_DIGEST = "sha256:1f8cf5916c3a68f63700bc9fb5a99f8f1ce94b336468843459019095590a1427";
const CONTRACT_DIGEST = "sha256:15475d4c7a5fe2436f9f35ad70155f7e06ef5d20cb59b9dc1a6c079d8145b39c";

const resolved = (): ResolvedProject => resolveProject([TRACKED], "host");
const record = (): AgentType => agentTypeRecord(AGENT_TYPE_INPUT);

describe("G1: a name an operator typed resolves to a project snapshot", () => {
  test("an alias resolves to the immutable identity, with the digest a run persists", () => {
    const project = resolved();
    expect(project.projectId).toBe("rondo");
    expect(project.aliases).toEqual(["host"]);
    expect(project.baseBranch).toBe("main");
    expect(project.configDigest).toBe(CONFIG_DIGEST);
  });

  test("the snapshot says which layer decided each field", () => {
    // The layer only: the file beside it is an absolute path in the platform's
    // spelling, so asserting it would be asserting which cell ran the test.
    expect(resolved().provenance["source"]?.layer).toBe("tracked");
    expect(resolved().provenance["base_branch"]?.layer).toBe("tracked");
  });
});

describe("the agent-type record cadenza exports (cadenza D-0034)", () => {
  test("the record is built, sorted, and carries its own digest", () => {
    const type = record();
    expect(type.agentTypeId).toBe("reviewer");
    // Sorted by code point and frozen by construction: order and repetition are
    // not semantics, so the record's sets are compared as the values they are.
    expect(type.granted).toEqual(["command.run", "worktree.write"]);
    expect(type.askable).toEqual(["branch.push"]);
    expect(type.agentTypeDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    // The neutral role name rondo's invocation adapter maps (D-0014), carried
    // and not interpreted here.
    expect(type.executorPolicy.roleName).toBe("implementer");
    expect(type.loopPolicy.maxReviewRounds).toBe(2);
  });
});

describe("G2: the initial contract an agent type and a project issue", () => {
  test("the record's sets and vocabulary, and the project's digest, reach the contract", () => {
    const type = record();
    const project = resolved();
    const contract = issueInitialContract(type, project, { issuer: "rondo", grantee: RUN_ID });

    expect(contract.projectId).toBe(project.projectId);
    expect(contract.configDigest).toBe(project.configDigest);
    // Read off the record, never off a "latest version" constant. Today the
    // vendored build knows one vocabulary version, so this assertion cannot yet
    // tell the two apart; it is written this way so that it *starts*
    // discriminating the moment cadenza knows a second one, which is when the
    // difference (cadenza D-0027) begins to matter.
    expect(contract.vocabularyVersion).toBe(type.vocabularyVersion);
    expect(contract.granted).toEqual(type.granted);
    expect(contract.askable).toEqual(type.askable);
    expect(contract.issuer).toBe("rondo");
    expect(contract.grantee).toBe(RUN_ID);
    // Initial issuance opens a lineage. A successor names the digest of a
    // contract that already exists, and rondo composes none (D-0009).
    expect(contract.supersedes).toBeNull();
  });
});

describe("classification is an answer rondo reads, not a second enforcement", () => {
  test("a granted action is allowed, and the answer names the contract it was made under", () => {
    const contract = issueInitialContract(record(), resolved(), {
      issuer: "rondo",
      grantee: RUN_ID,
    });

    expect(
      classifyAction(
        contract,
        { capabilities: ["command.run"] },
        { runId: RUN_ID, configDigest: CONFIG_DIGEST },
      ),
    ).toEqual({
      outcome: "allowed",
      reason: "granted",
      contractDigest: CONTRACT_DIGEST,
    });
  });

  test("an askable action needs approval, and this test does nothing about it", () => {
    // The whole of rondo's response to `needs_approval`, in a smoke: read it.
    // The gate is continuo's verb and the answer is a human's; a test that
    // reacted here by composing a widening successor would be rondo answering
    // its own gate, which is exactly what D-0009 forbids.
    const contract = issueInitialContract(record(), resolved(), {
      issuer: "rondo",
      grantee: RUN_ID,
    });

    expect(
      classifyAction(
        contract,
        { capabilities: ["branch.push"] },
        { runId: RUN_ID, configDigest: CONFIG_DIGEST },
      ),
    ).toEqual({
      outcome: "needs_approval",
      reason: "askable",
      contractDigest: CONTRACT_DIGEST,
    });
  });
});
