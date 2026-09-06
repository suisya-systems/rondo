/**
 * The allocator's two properties, asserted as properties rather than examples.
 *
 * D-0023 rule 3 claims the derivation is pure, total and **invertible**, and
 * rule 26 is the alphabet that makes the claim true. The order matters: before
 * the alphabet the derivation was neither contained nor injective, and both
 * failures were ordinary rather than adversarial -- `../other` escapes a
 * workspace root while still passing `runPlan()`'s absoluteness check, and
 * `a/../b` and `b` name one directory.
 *
 * So the two central cases here assert **containment** and **injectivity** over
 * the admitted alphabet rather than over a handful of examples, because the
 * failure they replace was a mapping that looked injective and was not. An
 * example-based test would have passed against the broken version.
 *
 * The Windows cases (rule 28) are the ones a Linux-only run cannot fail, and
 * they are written as assertions about the *derivation* rather than by creating
 * a directory: `con`, `nul`, `aux` and `com1` are admissible iteration ids
 * whose bare component would be an unusable path on `windows-latest`, which is
 * a required cell of the double-green matrix. Asserting the prefix is what a
 * Linux runner can honestly check; the platform half is what the matrix runs.
 */
import { expect, test } from "vitest";

import {
  ALLOCATION_COLLISION_REMEDY,
  allocate,
  ITERATION_ID_PATTERN,
} from "../../src/refrain/allocator.js";

const ROOT = "/srv/rondo/workspaces";

/** The allocation, or a failure naming the id that would not produce one. */
const allocated = (id: string, root: string = ROOT) => {
  const outcome = allocate(id, root);
  if (outcome.kind !== "allocated") {
    throw new Error(`allocating '${id}' was refused: ${outcome.reason}`);
  }
  return outcome.allocation;
};

/**
 * Ids that span the alphabet's shape: shortest, longest, every admitted
 * character class, and the Windows device names rule 28 exists for.
 */
const ADMITTED_IDS = [
  "a",
  "i-0001",
  "iter-005",
  "lap1-dogfood-003",
  "z9",
  "a_b",
  "a-b_c-9",
  "con",
  "nul",
  "aux",
  "prn",
  "com1",
  "com9",
  "lpt1",
  "lpt9",
  `a${"b".repeat(63)}`,
];

test("every id in the tree and the dogfood record is still admissible", () => {
  // D-0023 rule 26 is recorded as a **reduction**: ids that were legal before
  // it are illegal after it. This is the evidence for the claim that went with
  // the reduction -- that nothing rondo has actually minted is among them.
  for (const id of ["i-0001", "iter-005", "lap1-dogfood-003"]) {
    expect(ITERATION_ID_PATTERN.test(id)).toBe(true);
  }
});

test("the three identifiers are derived from the iteration id and each other's shape", () => {
  const allocation = allocated("iter-005");
  expect(allocation.runId).toBe("rondo-iter-005");
  expect(allocation.topicBranch).toBe("rondo/iter-005");
  expect(allocation.workspace).toBe("/srv/rondo/workspaces/iter-iter-005");
  // Rule 6: not required to be fresh, but derived anyway, so continuo's lease
  // audit trail can say which lap wrote.
  expect(allocation.leaseClaimantId).toBe("rondo-iter-005");
});

test("the derivation is injective over the admitted alphabet", () => {
  // The property, not an example. Two distinct ids may never produce a shared
  // run id, branch or workspace -- the claim indexes in the store rest on
  // exactly this, and before the alphabet it was false for `a/../b` and `b`.
  const seen = new Map<string, string>();
  for (const id of ADMITTED_IDS) {
    const allocation = allocated(id);
    for (const value of [allocation.runId, allocation.topicBranch, allocation.workspace]) {
      const previous = seen.get(value);
      expect(
        previous === undefined,
        `'${id}' and '${String(previous)}' both derive '${value}'`,
      ).toBe(true);
      seen.set(value, id);
    }
  }
});

test("every derived workspace is contained in the root it was derived under", () => {
  for (const id of ADMITTED_IDS) {
    const workspace = allocated(id).workspace;
    expect(workspace.startsWith(`${ROOT}/`)).toBe(true);
    // Containment is not merely a prefix: a path that begins with the root and
    // then walks out of it would pass a prefix check and still escape.
    expect(workspace.includes("..")).toBe(false);
    expect(workspace.slice(ROOT.length + 1).includes("/")).toBe(false);
  }
});

test("a Windows device name is admissible as an id and never becomes a bare component", () => {
  // Rule 28. `con`, `nul`, `aux`, `prn`, `com1`..`com9` and `lpt1`..`lpt9` are
  // reserved on any path component on Windows, and every one of them matches
  // the alphabet. The prefix is what stops an admissible id producing a
  // directory `git worktree add` cannot create on a required matrix cell.
  for (const id of ["con", "nul", "aux", "prn", "com1", "com9", "lpt1", "lpt9"]) {
    expect(ITERATION_ID_PATTERN.test(id)).toBe(true);
    const component = allocated(id).workspace.slice(ROOT.length + 1);
    expect(component).toBe(`iter-${id}`);
    expect(component).not.toBe(id);
  }
});

test("a backslash root keeps its own separator", () => {
  // The join takes the separator from the root rather than assuming one,
  // because `src/refrain/` may not import `node:path` and a hard-coded `/`
  // would produce a mixed path on the Windows cell.
  const allocation = allocated("iter-005", "C:\\srv\\rondo");
  expect(allocation.workspace).toBe("C:\\srv\\rondo\\iter-iter-005");
});

test("a trailing separator on the root does not double", () => {
  expect(allocated("a", "/srv/rondo/").workspace).toBe("/srv/rondo/iter-a");
  expect(allocated("a", "C:\\srv\\").workspace).toBe("C:\\srv\\iter-a");
});

test.each([
  ["../other", "a path that escapes the root"],
  ["a/../b", "a path that is not injective"],
  ["a/b", "a separator at all"],
  ["a\\b", "a Windows separator"],
  ["", "an empty id"],
  ["A", "an uppercase letter"],
  ["1a", "a leading digit"],
  ["-a", "a leading dash"],
  ["_a", "a leading underscore"],
  ["a.b", "a dot"],
  ["a b", "a space"],
  ["a\u0000b", "a NUL byte"],
  [`a${"b".repeat(64)}`, "an id one character too long"],
])("the id %j is refused, because it carries %s", (id) => {
  const outcome = allocate(id, ROOT);
  expect(outcome.kind).toBe("refused");
  if (outcome.kind === "refused") {
    // The refusal names what an id must be rather than what this one was, so a
    // person can fix it without reading the regex.
    expect(outcome.reason).toContain("lowercase letter");
  }
});

test("the observed-red control: a conforming id allocates where the refused ones do not", () => {
  // Without this the whole table above passes against an `allocate` that
  // refuses everything, which is the shape of a test that asserts nothing.
  expect(allocate("iter-005", ROOT).kind).toBe("allocated");
  expect(allocate("a/../b", ROOT).kind).toBe("refused");
});

test("the remedy names rondo's own lever rather than continuo's sentence", () => {
  // Rule 10: a collision rondo did not cause is still discovered inside
  // `lap perform`, and the operator's lever is the iteration id -- which
  // nothing in continuo's message about branches says.
  expect(ALLOCATION_COLLISION_REMEDY).toContain("iteration id");
  expect(ALLOCATION_COLLISION_REMEDY).toContain("abandoning");
});
