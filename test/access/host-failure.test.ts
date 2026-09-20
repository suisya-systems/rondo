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

test("node:sqlite's own result codes are read, because the store carries no errno", () => {
  // The failure that reaches a person most often, and the one a first pass at
  // this function missed: `node:sqlite` raises `ERR_SQLITE_ERROR` with the
  // driver's `errcode` and never `EROFS`. Raised by a real database below, in
  // `test/access/cli.test.ts`; the shapes here are the mapping itself.
  const sqlite = (errcode: number, message: string) =>
    Object.assign(new Error(message), { code: "ERR_SQLITE_ERROR", errcode });
  expect(hostFailure(sqlite(8, "attempt to write a readonly database"))).toEqual({
    kind: "hostSetup",
    code: "EROFS",
    text: "attempt to write a readonly database",
  });
  expect(hostFailure(sqlite(14, "unable to open database file"))).toEqual({
    kind: "hostSetup",
    code: "ENOENT",
    text: "unable to open database file",
  });
  expect(hostFailure(sqlite(3, "access permission denied")).kind).toBe("hostSetup");
  // Extended result codes: the primary code is the low byte, and both of these
  // are a store only installation repairs.
  for (const extended of [1544, 1032]) {
    expect(hostFailure(sqlite(extended, "attempt to write a readonly database"))).toEqual({
      kind: "hostSetup",
      code: "EROFS",
      text: "attempt to write a readonly database",
    });
  }
});

test("a store rondo's own writer is holding stays unknown, because trying again is the answer", () => {
  // SQLITE_BUSY is contention, not a break: the arm it would divert from
  // already says "go back and try again", which is the right thing to tell
  // that person. Same for SQLITE_LOCKED, and for a constraint rondo violated.
  // 261 is SQLITE_BUSY_SNAPSHOT, which masks to SQLITE_BUSY and stays out too.
  for (const errcode of [5, 6, 19, 261]) {
    expect(
      hostFailure(
        Object.assign(new Error("database is locked"), {
          code: "ERR_SQLITE_ERROR",
          errcode,
        }),
      ).kind,
    ).toBe("unknown");
  }
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
