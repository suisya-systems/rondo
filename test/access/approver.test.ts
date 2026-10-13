import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { recordApprover, withRecordedApprover } from "../../src/access/approver.js";

function store(): string {
  return join(mkdtempSync(join(tmpdir(), "rondo-approver-")), "rondo.sqlite3");
}

test("a name is recorded once, beside the store, and read back where RONDO_APPROVER is unset (rondo#675)", () => {
  const path = store();
  const environment: Record<string, string | undefined> = {};
  expect(recordApprover(environment, path, "ada")).toEqual({ ok: true });
  expect(environment["RONDO_APPROVER"]).toBe("ada");
  expect(readFileSync(`${path}.approver`, "utf8")).toBe("ada\n");
  expect(withRecordedApprover({}, path)["RONDO_APPROVER"]).toBe("ada");
  // RONDO_APPROVER, when set, still decides.
  expect(withRecordedApprover({ RONDO_APPROVER: "bo" }, path)["RONDO_APPROVER"]).toBe("bo");
  // Nothing recorded is nothing filled in.
  expect(withRecordedApprover({}, store())["RONDO_APPROVER"]).toBeUndefined();
});

test("a naming is refused where somebody is named, where the name is not one, and loses to an earlier one", () => {
  const path = store();
  expect(recordApprover({ RONDO_APPROVER: "bo" }, path, "ada")).toEqual({
    ok: false,
    why: "approverRefusedTaken",
  });
  for (const name of ["", "two words", "-flag"]) {
    expect(recordApprover({}, path, name)).toEqual({ ok: false, why: "approverRefusedShape" });
  }
  // Another process named somebody first: the file is there, this one's env is not.
  writeFileSync(`${path}.approver`, "bo\n");
  const environment: Record<string, string | undefined> = {};
  expect(recordApprover(environment, path, "ada")).toEqual({
    ok: false,
    why: "approverRefusedTaken",
  });
  expect(environment["RONDO_APPROVER"]).toBeUndefined();
});
