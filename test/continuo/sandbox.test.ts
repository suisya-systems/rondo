import { describe, expect, it } from "vitest";
import { probeUnixSocket, workerSandboxRefusal } from "../../src/continuo/sandbox.js";

describe("worker sandbox preflight (N-16, N-21)", () => {
  it("refuses only on EPERM, and says what it cannot see", () => {
    const refusal = workerSandboxRefusal("EPERM");
    expect(refusal).toContain("outside that sandbox");
    expect(refusal).toContain("Linux-only and detects only this cause");
    expect(workerSandboxRefusal(null)).toBeNull();
    expect(workerSandboxRefusal("EADDRINUSE")).toBeNull();
  });

  it("does not probe off Linux", async () => {
    await expect(probeUnixSocket("win32")).resolves.toBeNull();
  });

  // The live answer depends on where the suite runs: inside a Claude Code
  // sandbox it is EPERM, elsewhere null. Either is a completed probe.
  it("completes on this platform", async () => {
    expect([null, "EPERM"]).toContain(await probeUnixSocket());
  });
});
