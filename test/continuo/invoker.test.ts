/**
 * What the typed entry points refuse **before** a process exists.
 *
 * `test/continuo/smoke.test.ts` proves rondo drives a real continuo, and it can
 * only run where a pinned build has been provisioned. This file proves the half
 * that must hold everywhere and on every run: that an operator's typo is
 * rondo's own refusal, named by field, rather than continuo's exit 1 and a raw
 * stack (D-0015's exception 2, D-0019 rule 14's "semantic validation before the
 * spawn").
 *
 * **How a no-spawn claim is proved without watching for a process.** Every case
 * passes a `VerifiedContinuo` this module never issued. `run()` refuses such a
 * handle -- and it refuses it *inside* `run()`, which is the only place a spawn
 * can follow. So a case that gets a FIELD's reason back proves the entry point
 * returned before `run()`; a case that gets "did not issue" back proves it got
 * all the way there, which is what a fully valid request must do. The two
 * messages are the discriminator, and asserting only "an invokerDefect came
 * back" would tell them apart not at all.
 */
import { describe, expect, test } from "vitest";

import {
  admitRun,
  type PerformLapRequest,
  performLap,
  SERVED_ENDPOINT_RECIPIENTS,
  showGate,
  type VerifiedContinuo,
} from "../../src/continuo/invoker.js";

/** A handle rondo did not issue: enough to reach `run()`, never past it. */
const unissued: VerifiedContinuo = {
  cliPath: "/opt/continuo/dist/cli.js",
  revision: "44f62336108b86cab5da791111ffa0e5b73cd01a",
};

/** The message `run()` gives a handle it did not issue. The far marker. */
const REACHED_RUN = "did not issue";

/** A request every field of which continuo would accept, plus the case's edit. */
function lapRequest(overrides: Partial<PerformLapRequest> = {}): PerformLapRequest {
  return {
    db: "/srv/rondo/cp.sqlite3",
    runId: "r1",
    repository: "/srv/repos/rondo",
    artifactRoot: "/srv/rondo/artifacts",
    stateRoot: "/srv/rondo/state",
    endpointRecipient: "human-gated-effect",
    endpointDestinationDir: "/srv/rondo/outbox",
    claudeCommand: ["/usr/local/bin/claude"],
    interlockRoot: "/srv/rondo/interlock",
    claudeOrgPath: "/srv/claude-org",
    endpointDb: null,
    endpointModule: null,
    node: null,
    hookScript: null,
    python: null,
    pollIntervalMs: null,
    turnTimeoutMs: 900_000,
    gitTimeoutMs: 120_000,
    gateOptions: [],
    gateDeadlineAtMs: null,
    invocationCeilingMs: 1_800_000,
    ...overrides,
  };
}

/** The reason out of a defect, or a failure saying what came back instead. */
function defectReason(result: { readonly kind: string; readonly reason?: string }): string {
  if (result.kind !== "invokerDefect" || result.reason === undefined) {
    throw new Error(`expected an invokerDefect, got ${result.kind}`);
  }
  return result.reason;
}

describe("a request continuo would accept", () => {
  test("lap perform reaches the drive, which is where the unissued handle stops it", async () => {
    // The positive case, and it is the one that keeps the negatives honest: if
    // validation were too strict, every case below would still pass and the
    // conductor would refuse work continuo would have done.
    expect(defectReason(await performLap(unissued, lapRequest()))).toContain(REACHED_RUN);
  });

  test("every optional field may be null, and a null one is simply not passed", async () => {
    // continuo's own default applies to an omitted flag; an empty string in its
    // place would be a value rondo invented. The default request above already
    // has all five paths and both optional integers null.
    expect(defectReason(await performLap(unissued, lapRequest()))).toContain(REACHED_RUN);
  });

  test("gate show reaches the drive too, and it is the one verb that mutates nothing", async () => {
    const result = await showGate(unissued, { db: "/srv/rondo/cp.sqlite3", gateId: "g-r1-1" });
    expect(defectReason(result)).toContain(REACHED_RUN);
  });
});

describe("a field continuo requires to be absolute", () => {
  test("a relative artifact root is named, and no process is started", async () => {
    const reason = defectReason(
      await performLap(unissued, lapRequest({ artifactRoot: "tmp/art" })),
    );
    expect(reason).toContain("artifactRoot");
    expect(reason).toContain("absolute");
    expect(reason).not.toContain(REACHED_RUN);
    expect(reason).toContain("Nothing was spawned");
  });

  test("a worker CLI token resolved through PATH is refused, with its index", async () => {
    // continuo's rule, and the fence is its reason: a bare name would be
    // resolved through `PATH`, so which binary ran would depend on the
    // environment the host inherited.
    const reason = defectReason(
      await performLap(unissued, lapRequest({ claudeCommand: ["claude", "--dangerous"] })),
    );
    expect(reason).toContain("claudeCommand[0]");
    expect(reason).not.toContain(REACHED_RUN);
  });

  test("an empty worker CLI is refused rather than omitted", async () => {
    // Omitting `--claude-command` entirely means continuo's own default, which
    // is a different request from "run no worker".
    const reason = defectReason(await performLap(unissued, lapRequest({ claudeCommand: [] })));
    expect(reason).toContain("claudeCommand");
    expect(reason).not.toContain(REACHED_RUN);
  });
});

describe("a field with a set of values continuo will accept", () => {
  test("a recipient continuo has no handler for is refused, and the set is named", async () => {
    const reason = defectReason(
      await performLap(unissued, lapRequest({ endpointRecipient: "external-notif" })),
    );
    for (const recipient of SERVED_ENDPOINT_RECIPIENTS) {
      expect(reason).toContain(recipient);
    }
    expect(reason).not.toContain(REACHED_RUN);
  });

  test("both recipients continuo serves are accepted", async () => {
    for (const recipient of SERVED_ENDPOINT_RECIPIENTS) {
      const result = await performLap(unissued, lapRequest({ endpointRecipient: recipient }));
      expect(defectReason(result)).toContain(REACHED_RUN);
    }
  });
});

describe("the numbers", () => {
  test("a ceiling that is not a whole positive number of milliseconds is refused", async () => {
    const reason = defectReason(await performLap(unissued, lapRequest({ invocationCeilingMs: 0 })));
    expect(reason).toContain("invocationCeilingMs");
    expect(reason).not.toContain(REACHED_RUN);
  });

  test("a fractional poll interval is refused before it becomes an argv string", async () => {
    // `String(1.5)` is a perfectly good string and a nonsense millisecond
    // count; continuo's parser types the flag as an int and would refuse it in
    // prose, which is continuo answering for rondo's arithmetic.
    const reason = defectReason(await performLap(unissued, lapRequest({ pollIntervalMs: 1.5 })));
    expect(reason).toContain("pollIntervalMs");
    expect(reason).not.toContain(REACHED_RUN);
  });
});

describe("run admit's own fields", () => {
  /** A valid admission, plus the case's edit. */
  function admitRequest(overrides: Record<string, string> = {}) {
    return {
      db: "/srv/rondo/cp.sqlite3",
      runId: "r1",
      leaseClaimantId: "rondo",
      workspace: "/srv/work/r1",
      neutralRoleName: "worker",
      baseBranch: "main",
      topicBranch: "topic/r1",
      prompt: "add the thing",
      ...overrides,
    };
  }

  test("an empty prompt is refused here, where D-0015 measured a raw stack", async () => {
    const outcome = await admitRun(unissued, admitRequest({ prompt: "" }));
    expect(defectReason(outcome.result)).toContain("prompt");
    expect(outcome.continuoRole).toBeNull();
  });

  test("a run id with whitespace in it is refused: an identifier carries none", async () => {
    const outcome = await admitRun(unissued, admitRequest({ runId: "r 1" }));
    expect(defectReason(outcome.result)).toContain("runId");
    expect(outcome.continuoRole).toBeNull();
  });

  test("an option-shaped topic branch is refused before a parser can read it as a flag", async () => {
    const outcome = await admitRun(unissued, admitRequest({ topicBranch: "--help" }));
    expect(defectReason(outcome.result)).toContain("topicBranch");
    expect(outcome.continuoRole).toBeNull();
  });

  test("an option-shaped prompt is carried rather than refused, because prose may look like one", async () => {
    // The prompt is the one argument here that is arbitrary prose a person
    // typed, so unlike a branch or an identifier it may legitimately begin with
    // a dash and must not be refused for it. What makes that safe is the
    // spelling: `admitRun` joins it as `--prompt=<value>`, argparse's
    // explicit-value form, which takes everything after the first `=` whatever
    // it looks like. As a separate token, `--help` would be read as a flag and
    // `--json` would be deleted outright by `run()`'s de-duplication of that
    // flag -- both admitting something other than what was asked, silently.
    // Reaching `run()` is as far as a test without a build can see; the argv
    // itself is what `scripts/dogfood-lap.md` walks.
    for (const prompt of ["--help", "--json", "-x"]) {
      const outcome = await admitRun(unissued, admitRequest({ prompt }));
      expect(defectReason(outcome.result)).toContain(REACHED_RUN);
    }
  });

  test("a valid admission reaches the drive and reports the role it used", async () => {
    const outcome = await admitRun(unissued, admitRequest());
    expect(defectReason(outcome.result)).toContain(REACHED_RUN);
    expect(outcome.continuoRole).toBe("worker");
  });
});

describe("gate show", () => {
  test("an option-shaped gate id is refused", async () => {
    const result = await showGate(unissued, { db: "/srv/rondo/cp.sqlite3", gateId: "--db" });
    const reason = defectReason(result);
    expect(reason).toContain("gateId");
    expect(reason).not.toContain(REACHED_RUN);
  });

  test("a relative database path is refused", async () => {
    const result = await showGate(unissued, { db: "cp.sqlite3", gateId: "g1" });
    expect(defectReason(result)).toContain("db");
  });
});
