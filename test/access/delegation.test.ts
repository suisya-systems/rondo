/**
 * The envelope rondo hands `run admit`, and the two things it must not carry.
 *
 * `continuo D-1107` stores the record verbatim, digests exactly those bytes,
 * reads no key of it and never recognises its format name -- so continuo cannot
 * check any of what follows, and D-0040 puts every one of these properties on
 * the producer. This file is where they are checked:
 *
 *  - **the facts that exist today, as values** (D-0040 rule 5), taken from
 *    cadenza's own rendering rather than re-encoded, so a digest recomputed
 *    over the stored bytes is a digest over what cadenza digested;
 *  - **nothing that can carry a credential** (D-0040 rule 6). The rule named a
 *    catalog layer's `git_url` source as the one value in reach, which is why
 *    the layer documents are reduced to the project's identity before they
 *    reach a row that is immutable and never backfilled. The planted case below
 *    measures that the shape the rule named cannot even occur: **cadenza
 *    refuses embedded credentials in a catalog source at issue time**, so such a
 *    plan is answered before an envelope exists. The reduction stands on the
 *    narrower ground that the envelope keeps no byte of a document it does not
 *    need.
 *
 * The fixtures are in memory and nothing is provisioned: the cadenza facade
 * owns no capability, which is what lets a real contract be issued in the
 * ordinary suite. The one real effect is the file itself, in a temporary
 * directory the producer makes and {@link discard} removes.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import {
  DELEGATION_RECORD_SCHEMA,
  discard,
  writeDelegationRecord,
} from "../../src/access/delegation.js";
import type { CatalogLayer } from "../../src/cadenza/facade.js";
import { allocate } from "../../src/refrain/allocator.js";
import { type AdmittedPlan, admittedPlan, type RunPlan, runPlan } from "../../src/refrain/plan.js";

const CATALOG_DIR = resolve("/srv/catalog");
const REPOSITORY = resolve("/srv/rondo/repo");
const WORKSPACE_ROOT = resolve("/srv/rondo/work");

/** A token in a URL's userinfo, which is the shape rule 6 is about. */
const SECRET = "ghp_0123456789abcdef";

/** A layer declaring one project, with the source the case is about. */
function layerFor(source: CatalogLayer["data"]["project"]): CatalogLayer {
  return {
    layer: "tracked",
    origin: `${CATALOG_DIR}/projects.toml`,
    baseDir: CATALOG_DIR,
    data: {
      schema_version: 1,
      catalog: { allowed_local_roots: [REPOSITORY] },
      project: source,
    },
  } as CatalogLayer;
}

const LOCAL_LAYER = layerFor({
  rondo: {
    source: { kind: "local_path", path: REPOSITORY },
    base_branch: "main",
    aliases: [],
  },
});

/** The same project, cloned from a URL whose userinfo carries a token. */
const CREDENTIALLED_LAYER = layerFor({
  rondo: {
    source: { kind: "git_url", url: `https://x-access-token:${SECRET}@github.com/o/r.git` },
    base_branch: "main",
    aliases: [],
  },
});

function planWith(layer: CatalogLayer, allowedBash: readonly string[]): AdmittedPlan {
  const input: RunPlan = {
    db: resolve("/srv/rondo/control.db"),
    workspaceRoot: WORKSPACE_ROOT,
    baseBranch: "main",
    prompt: "teach rondo to count",
    allowedBash,
    repository: REPOSITORY,
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
    pullRequestBaseBranch: null,
    invocationCeilingMs: 1_800_000,
    catalogLayers: [layer],
    projectName: "rondo",
    agentTypeInput: {
      agentTypeId: "worker-basic",
      vocabularyVersion: 1,
      granted: ["command.run"],
      askable: ["branch.push"],
      loopPolicy: { maxReviewRounds: 2, noProgressWindow: 3, noProgressRepeat: 2 },
      executorPolicy: { roleName: "worker", modelTier: "standard", reportingDuties: [] },
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

/** The envelope, read back as the text continuo would digest. */
function envelopeFor(
  layer: CatalogLayer,
  allowedBash: readonly string[] = ["npm run:*"],
): {
  readonly text: string;
  readonly document: Record<string, unknown>;
  readonly path: string;
  readonly recordSchema: string;
  readonly remove: () => void;
} {
  const written = writeDelegationRecord(planWith(layer, allowedBash));
  if (written.kind !== "written") {
    throw new Error(`the record was not written: ${written.reason}`);
  }
  const text = readFileSync(written.record.path, "utf8");
  return {
    text,
    document: JSON.parse(text) as Record<string, unknown>,
    path: written.record.path,
    recordSchema: written.record.recordSchema,
    remove: () => {
      discard(written.record);
    },
  };
}

test("the envelope is a JSON object naming rondo's own format, in a file continuo can read", () => {
  const envelope = envelopeFor(LOCAL_LAYER);
  try {
    // continuo's own form rules, which are the whole of what it checks: a
    // non-empty JSON *object*. An array or a bare string parses and is refused.
    expect(typeof envelope.document).toBe("object");
    expect(Array.isArray(envelope.document)).toBe(false);
    expect(envelope.recordSchema).toBe(DELEGATION_RECORD_SCHEMA);
    expect(envelope.document["record_schema"]).toBe(DELEGATION_RECORD_SCHEMA);
    // The name is rondo's claim about rondo's document, and continuo neither
    // recognises nor refuses it -- so a version moved here is a version moved
    // in one place.
    expect(DELEGATION_RECORD_SCHEMA).toBe("rondo.delegation-record/1");
  } finally {
    envelope.remove();
  }
});

test("it carries the facts that exist today, and cadenza's own rendering of the contract", () => {
  const envelope = envelopeFor(LOCAL_LAYER);
  try {
    const document = envelope.document;
    expect(document["run_id"]).toBe(planWith(LOCAL_LAYER, ["npm run:*"]).runId);

    // (a) and (b): the contract as issued, and its digest beside it. The digest
    // is cadenza's over cadenza's rendering, which is the property that makes a
    // recomputation from the stored bytes worth doing at all (D-0040 rule 5).
    const contract = document["contract"] as Record<string, unknown>;
    expect(typeof contract).toBe("object");
    expect(contract["granted"]).toEqual(["command.run"]);
    expect(contract["askable"]).toEqual(["branch.push"]);
    expect(String(document["contract_digest"])).toMatch(/^sha256:[0-9a-f]{64}$/);

    // (c): the agent-type record's identity and the policy that was applied.
    const agentType = document["agent_type"] as Record<string, unknown>;
    expect(agentType["agent_type_id"]).toBe("worker-basic");
    expect(agentType["vocabulary_version"]).toBe(1);
    expect(String(agentType["agent_type_digest"])).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(agentType["executor_policy"]).toEqual({
      roleName: "worker",
      modelTier: "standard",
      reportingDuties: [],
    });
    expect(agentType["loop_policy"]).toEqual({
      maxReviewRounds: 2,
      noProgressWindow: 3,
      noProgressRepeat: 2,
    });

    // (d): the catalog reduced to what identifies it.
    expect(document["project"]).toEqual({
      project_name: "rondo",
      config_digest: expect.any(String),
      base_branch: "main",
    });

    // And what the lap was declared able to run, which is the other half of
    // "what was this run permitted to do" (`continuo D-1110`).
    expect(document["allowed_bash"]).toEqual(["npm run:*"]);

    // **Rule 4's facts 4, 5 and 6 are absent because they do not exist.** A
    // field holding an empty list of things that have never happened is a field
    // a later reader would mistake for a measurement.
    expect(Object.keys(document).sort()).toEqual([
      "agent_type",
      "allowed_bash",
      "contract",
      "contract_digest",
      "project",
      "record_schema",
      "run_id",
    ]);
  } finally {
    envelope.remove();
  }
});

test("a credential in a catalog source never reaches an envelope at all", () => {
  // **The planted case for D-0040 rule 6, and it measures something better
  // than the rule expected.** The rule named a `git_url`'s userinfo as the one
  // value in reach that could carry a token, and reduced the layer documents to
  // the project's identity so that it could not be recorded in a row that is
  // immutable and never backfilled. That reduction stands -- but the shape it
  // was named against cannot occur: cadenza refuses embedded credentials in a
  // catalog source outright, at issue time, in its own words, and the only
  // userinfo it accepts is the bare `git@` of an ssh url. So the envelope is
  // never composed, no file is written, and the producer answers with a value
  // carrying cadenza's message untranslated.
  const outcome = writeDelegationRecord(planWith(CREDENTIALLED_LAYER, ["npm run:*"]));
  expect(outcome.kind).toBe("defect");
  if (outcome.kind === "defect") {
    expect(outcome.reason).toContain("must not embed");
    expect(outcome.reason).toContain("no run was admitted");
    // The reason is shown to an operator, and a message that quoted the token
    // back would put it somewhere else instead -- cadenza names the location
    // and the rule rather than the value.
    expect(outcome.reason).not.toContain(SECRET);
  }
});

test("the envelope carries the catalog's identity and none of its bytes", () => {
  // The other half of rule 6's reduction, on a catalog cadenza accepts: what a
  // layer document holds -- its origin, its allowed roots, its source paths --
  // is not in the envelope, so a fact rondo does not need is a fact continuo's
  // immutable row does not keep.
  const envelope = envelopeFor(LOCAL_LAYER);
  try {
    expect(envelope.text).not.toContain("allowed_local_roots");
    expect(envelope.text).not.toContain(CATALOG_DIR);
    expect(envelope.text).not.toContain(REPOSITORY);
    expect(envelope.document["project"]).toEqual({
      project_name: "rondo",
      config_digest: expect.any(String),
      base_branch: "main",
    });
  } finally {
    envelope.remove();
  }
});

test("the file is transport: it is removed, and removing it twice is not an error", () => {
  const envelope = envelopeFor(LOCAL_LAYER);
  expect(existsSync(envelope.path)).toBe(true);
  envelope.remove();
  expect(existsSync(envelope.path)).toBe(false);
  // `discard` runs in a `finally`, and a second call happens the moment
  // anything retries an admission. It must not turn an admitted run into a
  // reported failure.
  expect(() => {
    envelope.remove();
  }).not.toThrow();
});

test("a plan naming a project the catalog does not have is rondo's defect, not a throw", () => {
  // The plan classified before admission, so a project that will not resolve
  // here means rondo reached `admit` with a plan it had already accepted. That
  // is rondo's fault rather than the operator's, and the caller needs a value
  // to report rather than an exception to catch.
  const outcome = writeDelegationRecord({
    ...planWith(LOCAL_LAYER, ["npm run:*"]),
    projectName: "not-in-the-catalog",
  });
  expect(outcome.kind).toBe("defect");
  if (outcome.kind === "defect") {
    expect(outcome.reason).toContain("not-in-the-catalog");
    expect(outcome.reason).toContain("no run was admitted");
  }
});
