/**
 * The bytes the store persists a plan as, and the digest taken over them.
 *
 * D-0019 rule 4: the store holds the plan **verbatim** beside its
 * `plan_digest`, because a digest detects change and does not hand back the
 * plan a past run used -- and continuo persists the admitted intent rather than
 * the executor paths or the agent type, so rondo's row is the only place "under
 * what plan did this run happen" is answerable. "Verbatim" only means something
 * once there is exactly one rendering of a plan, which is what
 * {@link canonicalJson} is: the digest is meaningful *because* the encoding is
 * total and stable. A key order that varied with insertion order would make two
 * writes of the same plan two different plans, and the digest would then be a
 * detector of nothing but `JSON.stringify`'s history.
 *
 * **This module is the third per-module capability grant in the tree**, beside
 * `node:sqlite` in `src/store/sqlite.ts` and the `spawn` in
 * `src/continuo/invoker.ts`: it takes `createHash` from `node:crypto`, by
 * module and by binding, in `test/architecture/import-boundaries.test.ts`.
 *
 * **Why the digest is the store's job and not the loop's.** `src/refrain/`'s
 * external allowance is *empty* and D-0019 keeps it so -- an empty allowance
 * refuses the hazards nobody has thought of yet as well as the ones with names,
 * and the loop is the layer whose whole property is that it can be tested by
 * handing it a record. A hash is a capability the loop would have had to be
 * granted for a value it never reads. So `src/refrain/plan.ts` renders the
 * payload and this module digests it, which is also the honest split: the store
 * is the thing that guarantees the bytes come back, and the digest is a claim
 * about bytes.
 */
import { createHash } from "node:crypto";

import type { JsonRecord, JsonValue } from "./records.js";

/**
 * A value the store was asked to persist and cannot round-trip.
 *
 * Thrown rather than returned, and callers in `src/store/sqlite.ts` turn it
 * into a `defect` outcome. It is not an operator's error: every plan reaching
 * here came through `runPlan`'s validation, so a value this encoder refuses is
 * rondo handing the store something rondo should not have built.
 */
class UnencodableValue extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnencodableValue";
  }
}

/**
 * One JSON value, encoded so that equal values encode equally.
 *
 * Object keys in ascending code-unit order, arrays in their own order, and no
 * insignificant whitespace anywhere. Nothing else about the encoding is
 * promised: this is the store's internal rendering, and the only property
 * anybody may rely on is that it is a function of the value alone.
 *
 * It refuses rather than degrading. `JSON.stringify` drops an `undefined`
 * property and writes `null` for `NaN` and the infinities, and both are how a
 * digest ends up being a digest of something other than what was handed over --
 * silently, and only detectably by comparing a plan against itself much later.
 * The rejected alternative was to normalise those values on the way in; it was
 * rejected because normalising is a decision about the caller's data taken in
 * the one place least able to explain it.
 */
export function canonicalJson(value: JsonValue): string {
  return encode(value, "$");
}

/**
 * `sha256:<64 lowercase hex>` over {@link canonicalJson} of the payload.
 *
 * Prefixed with the algorithm because a bare hex string is a claim whose
 * meaning depends on a convention held somewhere else, and the day rondo needs
 * a second algorithm the rows already say which one they were written under.
 */
export function planDigest(plan: JsonRecord): string {
  return `sha256:${createHash("sha256").update(canonicalJson(plan), "utf8").digest("hex")}`;
}

/**
 * The encoder proper, carrying the path it is at.
 *
 * The path is carried for the refusal message alone: "the plan cannot be
 * encoded" is a sentence nobody can act on, and `$.catalog_layers[0].data` is.
 */
function encode(value: JsonValue | undefined, path: string): string {
  if (value === undefined) {
    throw new UnencodableValue(
      `${path} is undefined, which JSON drops rather than represents -- so the digest would be ` +
        "a digest of a plan with one fewer field than the one that was handed over",
    );
  }
  if (value === null) {
    return "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new UnencodableValue(
        `${path} is ${String(value)}, which JSON has no spelling for and JSON.stringify writes ` +
          "as null. A number that comes back as null is not the number that went in",
      );
    }
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    // `JSON.stringify` of a string is the JSON string production and nothing
    // else: no key order to decide and no lossy case to guard.
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const elements = value.map((element, index) => encode(element, `${path}[${String(index)}]`));
    return `[${elements.join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as JsonRecord;
    // `sort()` with no comparator is ascending UTF-16 code-unit order, which is
    // exactly the order wanted: it is defined by the language rather than by a
    // locale, so two hosts in two locales render one plan identically. A
    // `localeCompare` here would have been the subtlest possible way to make a
    // digest machine-dependent.
    const keys = Object.keys(record).sort();
    const members = keys.map((key) => {
      const encodedKey = JSON.stringify(key);
      return `${encodedKey}:${encode(record[key], `${path}.${key}`)}`;
    });
    return `{${members.join(",")}}`;
  }
  // A function, a symbol or a bigint, arriving through a cast: the static type
  // says it cannot happen and the store is the last place that would find out.
  throw new UnencodableValue(`${path} is a ${typeof value}, which is not a JSON value at all`);
}
