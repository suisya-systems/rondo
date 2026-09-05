/**
 * The executor-policy adapter's two tables: the role table asserted in both
 * directions, and the model table asserted as the policy it is.
 *
 * D-0019 rule 13's table is the one piece of rondo whose error is silent on
 * both sides of the seam: continuo's check is `roster.includes(role)`, so a
 * mapping onto the *wrong but valid* role admits a run under the wrong fence
 * and nothing anywhere goes red. A test that asserted only "the mapped role is
 * some roster name" would pass over exactly that. So this file asserts the
 * whole table -- every key to its own name, every roster name reachable -- and
 * the refusal of everything outside it.
 *
 * The refusal is proved to happen **without a spawn**, which is the other half
 * of the rule: an unmapped name is rondo's vocabulary error and continuo is
 * never asked.
 */
import { describe, expect, test } from "vitest";

import { admitRun, type VerifiedContinuo } from "../../src/continuo/invoker.js";
import {
  CONTINUO_ROSTER,
  mapModelTier,
  mapNeutralRole,
  mappedModelTiers,
  mappedNeutralRoleNames,
} from "../../src/continuo/roles.js";

/** The mapping, or a failure naming the name that did not map. */
function mappedRole(neutralRoleName: string): string {
  const mapping = mapNeutralRole(neutralRoleName);
  if (mapping.kind !== "mapped") {
    throw new Error(`'${neutralRoleName}' did not map: ${mapping.reason}`);
  }
  return mapping.role;
}

describe("the table, in both directions", () => {
  test("every key maps to a name continuo's recorded roster contains", () => {
    // The direction that catches a key pointing at a role continuo would refuse
    // outright -- a typo, or a role removed from the roster and left here.
    for (const neutralRoleName of mappedNeutralRoleNames()) {
      expect(CONTINUO_ROSTER).toContain(mappedRole(neutralRoleName));
    }
  });

  test("every roster name is reachable through some key", () => {
    // The direction that catches a role becoming unusable: continuo has four,
    // and a rondo that could only ever ask for three would have lost one
    // silently, because nothing continuo does complains about a role nobody
    // requests.
    const reachable = mappedNeutralRoleNames().map(mappedRole);
    for (const role of CONTINUO_ROSTER) {
      expect(reachable).toContain(role);
    }
  });

  test("the mapping is the identity, name by name, and not merely onto", () => {
    // The assertion the two above cannot make between them, and the one that
    // catches the error no test on either side of the seam catches: `curator`
    // mapping to `worker` satisfies "maps into the roster" and "every roster
    // name is reachable", and would render a real fence that is the wrong one.
    expect(mappedNeutralRoleNames().map((name) => [name, mappedRole(name)])).toEqual([
      ["worker", "worker"],
      ["curator", "curator"],
      ["dispatcher", "dispatcher"],
      ["secretary", "secretary"],
    ]);
  });

  test("the roster is the four names read off continuo's bundled document", () => {
    // A transcription of `src/fencing/roles.json` at the pinned revision. The
    // case exists so that a change to the recorded roster is a deliberate edit
    // to a red test rather than a quiet widening of what rondo believes.
    expect([...CONTINUO_ROSTER]).toEqual(["worker", "curator", "dispatcher", "secretary"]);
  });
});

describe("a name outside the table", () => {
  test("is refused, and the reason names the name and the roster", () => {
    const mapping = mapNeutralRole("reviewer");
    expect(mapping.kind).toBe("unknown");
    if (mapping.kind !== "unknown") {
      return;
    }
    expect(mapping.reason).toContain("reviewer");
    for (const role of CONTINUO_ROSTER) {
      expect(mapping.reason).toContain(role);
    }
  });

  test("is refused even when it is a name JavaScript objects happen to have", () => {
    // `constructor` and `toString` are on every object's prototype, so a table
    // read with a bare index would answer a function here. The lookup guards
    // with `Object.hasOwn` for exactly this.
    expect(mapNeutralRole("constructor").kind).toBe("unknown");
    expect(mapNeutralRole("toString").kind).toBe("unknown");
    expect(mapNeutralRole("").kind).toBe("unknown");
  });

  test("admitRun refuses it before anything about the handle is even checked", async () => {
    // **This is the without-a-spawn half, and the ordering is the proof.** The
    // handle below was written by hand, so `run()` would refuse it as a handle
    // rondo did not issue -- and that refusal happens inside `run()`, after the
    // argv is built and at the one place a spawn could follow. Getting the
    // ROLE's reason back instead means `admitRun` returned before it reached
    // `run()` at all. A test that only asserted "an invokerDefect came back"
    // could not tell the two refusals apart.
    const unissued: VerifiedContinuo = {
      cliPath: "/nowhere/dist/cli.js",
      revision: "0".repeat(40),
    };
    const outcome = await admitRun(unissued, {
      db: "/tmp/cp.sqlite3",
      runId: "r1",
      leaseClaimantId: "rondo",
      workspace: "/tmp/ws",
      neutralRoleName: "reviewer",
      baseBranch: "main",
      topicBranch: "topic/one",
      prompt: "do the thing",
    });
    expect(outcome.result.kind).toBe("invokerDefect");
    if (outcome.result.kind !== "invokerDefect") {
      return;
    }
    expect(outcome.result.reason).toContain("reviewer");
    expect(outcome.result.reason).not.toContain("did not issue");
    // No role was used, so none is reported: a reader cannot mistake this for
    // an admission that happened under some role.
    expect(outcome.continuoRole).toBeNull();
  });

  test("a mapped name gets the role back beside the outcome", async () => {
    // The other side of the same field. The handle is still unissued, so this
    // one DOES reach `run()`'s refusal -- which is what makes it evidence that
    // the mapping ran and no process was started either way.
    const unissued: VerifiedContinuo = {
      cliPath: "/nowhere/dist/cli.js",
      revision: "0".repeat(40),
    };
    const outcome = await admitRun(unissued, {
      db: "/tmp/cp.sqlite3",
      runId: "r1",
      leaseClaimantId: "rondo",
      workspace: "/tmp/ws",
      neutralRoleName: "worker",
      baseBranch: "main",
      topicBranch: "topic/one",
      prompt: "do the thing",
    });
    expect(outcome.continuoRole).toBe("worker");
    expect(outcome.result.kind).toBe("invokerDefect");
    if (outcome.result.kind !== "invokerDefect") {
      return;
    }
    expect(outcome.result.reason).toContain("did not issue");
  });
});

describe("the model table, which is a policy rather than a transcription", () => {
  /** The selection, or a failure naming the tier that had no model. */
  function selectedModel(modelTier: string): string {
    const selection = mapModelTier(modelTier);
    if (selection.kind !== "selected") {
      throw new Error(`'${modelTier}' is not priced: ${selection.reason}`);
    }
    return selection.model;
  }

  test("the table is the pair D-0021 records, spelled out", () => {
    // The case exists so that changing a pair is a deliberate edit to a red
    // test -- which is what "changing a pair is a new decision entry" means in
    // practice. The values are provisional pending an operator's ratification,
    // and provisional is not the same as free to move quietly.
    expect(mappedModelTiers().map((tier) => [tier, selectedModel(tier)])).toEqual([
      ["standard", "claude-opus-5"],
    ]);
  });

  test("every model is a plain model id, which is continuo's own rule for the flag", () => {
    // The value becomes a token in the fenced child's command line, so a
    // leading '-', a path separator, whitespace or an '=' would be continuo
    // appending something other than a model to that line. continuo refuses
    // such a value; rondo does not put one there in the first place.
    for (const tier of mappedModelTiers()) {
      expect(selectedModel(tier)).toMatch(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
      expect(selectedModel(tier).length).toBeLessThanOrEqual(128);
    }
  });

  test("a tier the table does not price is refused, and the reason names it", () => {
    // Unlike an unmapped role, nothing downstream would refuse this: continuo
    // never sees a tier, so omitting the flag would be a lap on the worker
    // CLI's default rather than a refusal anywhere.
    const selection = mapModelTier("frugal");
    expect(selection.kind).toBe("unknown");
    if (selection.kind !== "unknown") {
      return;
    }
    expect(selection.reason).toContain("frugal");
    for (const tier of mappedModelTiers()) {
      expect(selection.reason).toContain(tier);
    }
  });

  test("a prototype name is an unknown tier, not a function found on the object", () => {
    for (const name of ["constructor", "toString", "hasOwnProperty", "__proto__"]) {
      expect(mapModelTier(name).kind).toBe("unknown");
    }
  });

  test("the two tables are independent: a role name is not a tier", () => {
    // D-0099's distinction, asserted rather than only written down: a role says
    // what the executor is for and a model says who executes, so the vocabulary
    // of one is not the vocabulary of the other.
    for (const roleName of mappedNeutralRoleNames()) {
      expect(mapModelTier(roleName).kind).toBe("unknown");
    }
    for (const tier of mappedModelTiers()) {
      expect(mapNeutralRole(tier).kind).toBe("unknown");
    }
  });
});
