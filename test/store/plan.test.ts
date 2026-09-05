/**
 * The plan encoding is a function of the value alone, and refuses what it
 * cannot round-trip.
 *
 * `plan_digest` (D-0019 rule 4) is only worth writing down if two writes of the
 * same plan produce the same bytes, so the property this file defends is that
 * `canonicalJson` does not depend on key insertion order, and that a value JSON
 * would quietly damage -- an `undefined` property, a non-finite number -- is a
 * refusal rather than a `null` in the row.
 */
import { expect, test } from "vitest";

import { canonicalJson, planDigest } from "../../src/store/plan.js";
import type { JsonRecord } from "../../src/store/records.js";

test("object keys are encoded in code-unit order, whatever order they were written in", () => {
  expect(canonicalJson({ zeta: 1, alpha: 2, Beta: 3 })).toBe('{"Beta":3,"alpha":2,"zeta":1}');
});

test("two spellings of the same plan encode identically", () => {
  const first: JsonRecord = { run_id: "r-1", workspace: "/w", gate_options: ["a", "b"] };
  const second: JsonRecord = { gate_options: ["a", "b"], workspace: "/w", run_id: "r-1" };
  expect(canonicalJson(first)).toBe(canonicalJson(second));
  expect(planDigest(first)).toBe(planDigest(second));
});

test("array order is content and is not sorted", () => {
  // The claude command is a command prefix in order, so a canonicaliser that
  // sorted arrays would rewrite the plan rather than encode it.
  expect(canonicalJson(["b", "a"])).toBe('["b","a"]');
  expect(canonicalJson(["b", "a"])).not.toBe(canonicalJson(["a", "b"]));
});

test("nesting is canonicalised at every depth", () => {
  const deep: JsonRecord = { outer: { z: [{ b: 1, a: 2 }], a: null } };
  expect(canonicalJson(deep)).toBe('{"outer":{"a":null,"z":[{"a":2,"b":1}]}}');
});

test("the digest names its algorithm and is 64 lowercase hex digits", () => {
  expect(planDigest({ run_id: "r-1" })).toMatch(/^sha256:[0-9a-f]{64}$/);
});

test("a different plan digests differently", () => {
  expect(planDigest({ run_id: "r-1" })).not.toBe(planDigest({ run_id: "r-2" }));
});

test("an undefined property is refused rather than dropped", () => {
  // JSON.stringify would emit {"a":1}, and the digest would then describe a
  // plan with one fewer field than the one the caller handed over.
  const lossy = { a: 1, b: undefined } as unknown as JsonRecord;
  expect(() => canonicalJson(lossy)).toThrow(/undefined/);
});

test("a non-finite number is refused rather than written as null", () => {
  expect(() => canonicalJson({ ceiling: Number.POSITIVE_INFINITY })).toThrow(/Infinity/);
  expect(() => canonicalJson({ ceiling: Number.NaN })).toThrow(/NaN/);
});

test("the refusal names the path of the value it refused", () => {
  const lossy = { catalog_layers: [{ data: Number.NaN }] } as unknown as JsonRecord;
  expect(() => canonicalJson(lossy)).toThrow(/\$\.catalog_layers\[0\]\.data/);
});

test("a value that is not JSON at all is refused rather than coerced", () => {
  const impossible = { fn: () => 1 } as unknown as JsonRecord;
  expect(() => canonicalJson(impossible)).toThrow(/function/);
});
