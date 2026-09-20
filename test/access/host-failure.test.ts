/**
 * The one reading of a caught `unknown` (rondo#349).
 *
 * Two properties, and the second is the one that makes the replacement of
 * twenty-eight sites safe rather than merely small:
 *
 *  1. an errno this module vouches for lands in `hostSetup` with its code, and
 *     an errno it does not -- or no errno at all -- lands in `unknown`;
 *  2. **`text` is the old expression on both arms.** Every site that reads only
 *     `text` composes the byte-identical sentence it composed before, so the
 *     sweep cannot have moved a string on the page or in a record.
 */
import { expect, test } from "vitest";

import { hostFailure } from "../../src/access/host-failure.js";

/** A `node:fs` failure, as Node actually raises it: an `Error` carrying `code`. */
function errno(code: string, message: string): Error {
  return Object.assign(new Error(message), { code, errno: -2, syscall: "open" });
}

test("the four errnos installation repairs are read as a host-setup break", () => {
  for (const code of ["ENOENT", "EACCES", "EROFS", "EBUSY"] as const) {
    expect(hostFailure(errno(code, `${code}: no`))).toEqual({
      kind: "hostSetup",
      code,
      text: `${code}: no`,
    });
  }
});

test("an errno this module does not vouch for is left as unknown, with its message", () => {
  // EPIPE is a real errno and a real failure, and it is not a statement about
  // whether rondo is installed. Reading it as one would make D-0076 rule 4.3's
  // sentence a claim rondo cannot support.
  expect(hostFailure(errno("EPIPE", "EPIPE: broken pipe"))).toEqual({
    kind: "unknown",
    text: "EPIPE: broken pipe",
  });
});

test("an error with no errno reads exactly as it did before this function existed", () => {
  const raised = new TypeError("x is not a function");
  expect(hostFailure(raised)).toEqual({ kind: "unknown", text: "x is not a function" });
});

test("a thrown non-Error keeps String()'s answer, as the twenty-eight sites did", () => {
  expect(hostFailure("just a string")).toEqual({ kind: "unknown", text: "just a string" });
  expect(hostFailure(null)).toEqual({ kind: "unknown", text: "null" });
  expect(hostFailure(undefined)).toEqual({ kind: "unknown", text: "undefined" });
  expect(hostFailure({ nope: true })).toEqual({ kind: "unknown", text: "[object Object]" });
});

test("a plain object carrying an errno is read as one, and still says what String() said", () => {
  // Not every rejection that crosses a boundary arrives as an `Error`. Refusing
  // those would put a genuine ENOENT in `unknown`, which is the failure this
  // whole function exists to stop.
  expect(hostFailure({ code: "EACCES" })).toEqual({
    kind: "hostSetup",
    code: "EACCES",
    text: "[object Object]",
  });
});
