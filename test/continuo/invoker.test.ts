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
  ackGate,
  admitRun,
  answerGate,
  closeRun,
  deliverGate,
  type PerformLapRequest,
  performLap,
  presentGate,
  RUN_CLOSE_OUTCOMES,
  SERVED_ENDPOINT_RECIPIENTS,
  showGate,
  type VerifiedContinuo,
} from "../../src/continuo/invoker.js";
import { mapModelTier, mappedModelTiers } from "../../src/continuo/roles.js";

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
    modelTier: "standard",
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
    identityReadbackTimeoutMs: 30_000,
    gateOptions: [],
    gateDeadlineAtMs: null,
    invocationCeilingMs: 1_800_000,
    ...overrides,
  };
}

/**
 * One lap driven with the case's edit, reduced to continuo's outcome.
 *
 * `performLap` answers a *pair* -- the outcome and the model rondo selected --
 * for the same reason `admitRun` answers one with the role it used, so the cases
 * that only ask "how far did this get" go through here and the two that ask
 * about the model read the pair directly.
 */
async function performedLap(overrides: Partial<PerformLapRequest> = {}) {
  return (await performLap(unissued, lapRequest(overrides))).result;
}

/** The model a priced tier selects, read through the table rather than retyped. */
function selectedModel(tier: string): string {
  const selection = mapModelTier(tier);
  if (selection.kind !== "selected") {
    throw new Error(`expected '${tier}' to be priced, got ${selection.kind}`);
  }
  return selection.model;
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
    expect(defectReason(await performedLap())).toContain(REACHED_RUN);
  });

  test("an option-shaped gate label is carried rather than refused", async () => {
    // Gate options are labels an operator wrote for a person to choose between,
    // so like the prompt they may legitimately begin with a dash and must not be
    // refused for it. `--gate-option=<value>` is what makes that safe: as a
    // separate token one would be read as a flag, and an option spelled exactly
    // `--json` would be removed by `run()`'s de-duplication of that flag,
    // leaving a dangling `--gate-option` to swallow whichever flag came next.
    for (const option of ["--json", "--help", "-y"]) {
      const outcome = await performedLap({ gateOptions: [option] });
      expect(defectReason(outcome)).toContain(REACHED_RUN);
    }
  });

  test("every optional field may be null, and a null one is simply not passed", async () => {
    // continuo's own default applies to an omitted flag; an empty string in its
    // place would be a value rondo invented. The default request above already
    // has all five paths and both optional integers null.
    expect(defectReason(await performedLap())).toContain(REACHED_RUN);
  });

  test("gate show reaches the drive too, and it is the one verb that mutates nothing", async () => {
    const result = await showGate(unissued, { db: "/srv/rondo/cp.sqlite3", gateId: "g-r1-1" });
    expect(defectReason(result)).toContain(REACHED_RUN);
  });
});

describe("a field continuo requires to be absolute", () => {
  test("a relative artifact root is named, and no process is started", async () => {
    const reason = defectReason(await performedLap({ artifactRoot: "tmp/art" }));
    expect(reason).toContain("artifactRoot");
    expect(reason).toContain("absolute");
    expect(reason).not.toContain(REACHED_RUN);
    expect(reason).toContain("Nothing was spawned");
  });

  test("a worker CLI token resolved through PATH is refused, with its index", async () => {
    // continuo's rule, and the fence is its reason: a bare name would be
    // resolved through `PATH`, so which binary ran would depend on the
    // environment the host inherited.
    const reason = defectReason(await performedLap({ claudeCommand: ["claude", "--dangerous"] }));
    expect(reason).toContain("claudeCommand[0]");
    expect(reason).not.toContain(REACHED_RUN);
  });

  test("an empty worker CLI is refused rather than omitted", async () => {
    // Omitting `--claude-command` entirely means continuo's own default, which
    // is a different request from "run no worker".
    const reason = defectReason(await performedLap({ claudeCommand: [] }));
    expect(reason).toContain("claudeCommand");
    expect(reason).not.toContain(REACHED_RUN);
  });
});

describe("a field with a set of values continuo will accept", () => {
  test("a recipient continuo has no handler for is refused, and the set is named", async () => {
    const reason = defectReason(await performedLap({ endpointRecipient: "external-notif" }));
    for (const recipient of SERVED_ENDPOINT_RECIPIENTS) {
      expect(reason).toContain(recipient);
    }
    expect(reason).not.toContain(REACHED_RUN);
  });

  test("both recipients continuo serves are accepted", async () => {
    for (const recipient of SERVED_ENDPOINT_RECIPIENTS) {
      const result = await performedLap({ endpointRecipient: recipient });
      expect(defectReason(result)).toContain(REACHED_RUN);
    }
  });
});

describe("the numbers", () => {
  test("a ceiling that is not a whole positive number of milliseconds is refused", async () => {
    const reason = defectReason(await performedLap({ invocationCeilingMs: 0 }));
    expect(reason).toContain("invocationCeilingMs");
    expect(reason).not.toContain(REACHED_RUN);
  });

  test("the identity read-back budget is required, and a non-positive one is refused", async () => {
    // The third budget rondo states rather than inherits (D-0021). continuo
    // defaults it to 30 s; a plan that reached here with 0 would be rondo
    // asking for a window no worker can meet, which is the defect the dogfood's
    // F-1 measured in continuo's old constants.
    const reason = defectReason(await performedLap({ identityReadbackTimeoutMs: 0 }));
    expect(reason).toContain("identityReadbackTimeoutMs");
    expect(reason).not.toContain(REACHED_RUN);
  });

  test("a fractional poll interval is refused before it becomes an argv string", async () => {
    // `String(1.5)` is a perfectly good string and a nonsense millisecond
    // count; continuo's parser types the flag as an int and would refuse it in
    // prose, which is continuo answering for rondo's arithmetic.
    const reason = defectReason(await performedLap({ pollIntervalMs: 1.5 }));
    expect(reason).toContain("pollIntervalMs");
    expect(reason).not.toContain(REACHED_RUN);
  });
});

describe("the model tier, which only rondo can price", () => {
  test("a tier rondo has no model for is refused, and nothing is spawned", async () => {
    // Unlike an unmapped role, this one has no upstream check to fall back on:
    // cadenza validates the tier structurally and continuo never sees a tier at
    // all. So the refusal here is the only thing standing between an agent type
    // and a lap running on a model nobody chose.
    const outcome = await performLap(unissued, lapRequest({ modelTier: "economy" }));
    const reason = defectReason(outcome.result);
    expect(reason).toContain("economy");
    for (const tier of mappedModelTiers()) {
      expect(reason).toContain(tier);
    }
    expect(reason).not.toContain(REACHED_RUN);
    // Null exactly because rondo refused before driving: a reader cannot mistake
    // this for a lap that ran on no particular model.
    expect(outcome.model).toBeNull();
  });

  test("a prototype name is an unknown tier rather than a function on the command line", async () => {
    for (const tier of ["constructor", "toString", "__proto__"]) {
      const outcome = await performLap(unissued, lapRequest({ modelTier: tier }));
      expect(defectReason(outcome.result)).not.toContain(REACHED_RUN);
      expect(outcome.model).toBeNull();
    }
  });

  test("every priced tier reaches the drive and reports the model it selected", async () => {
    // The table asserted through the entry point rather than sampled: a tier
    // added with a value that is not a model id would reach continuo's own
    // `--model` check as an argv token, which is a refusal a lap away rather
    // than a refusal before one.
    for (const tier of mappedModelTiers()) {
      const outcome = await performLap(unissued, lapRequest({ modelTier: tier }));
      expect(defectReason(outcome.result)).toContain(REACHED_RUN);
      expect(outcome.model).toBe(selectedModel(tier));
      // continuo's own rule for this flag: the value becomes a token in the
      // fenced child's command line, so it must not be spellable as a second
      // argument.
      expect(outcome.model).toMatch(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
    }
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

/**
 * The five verbs D-0025 adds, checked where this file checks every other one:
 * at the argument boundary, before a process exists.
 *
 * `REACHED_RUN` is the far marker. A case asserting a refusal also asserts the
 * absence of that marker, which is what distinguishes "rondo refused this" from
 * "rondo built argv and continuo would have refused it" -- the whole point of
 * validating here (D-0015 exception 2).
 */
describe("the gate walk's verbs, at the argument boundary", () => {
  test("gate present refuses a relative db and an option-shaped gate id", async () => {
    const relative = await presentGate(unissued, { db: "cp.sqlite3", gateId: "g1" });
    expect(defectReason(relative)).toContain("db");
    expect(defectReason(relative)).not.toContain(REACHED_RUN);

    const optionShaped = await presentGate(unissued, {
      db: "/srv/rondo/cp.sqlite3",
      gateId: "--db",
    });
    expect(defectReason(optionShaped)).toContain("gateId");
    expect(defectReason(optionShaped)).not.toContain(REACHED_RUN);
  });

  test("gate deliver refuses a relative destination directory", async () => {
    const result = await deliverGate(unissued, {
      db: "/srv/rondo/cp.sqlite3",
      destinationDir: "dropbox",
      holder: "rondo-operator",
    });
    expect(defectReason(result)).toContain("destinationDir");
    expect(defectReason(result)).not.toContain(REACHED_RUN);
  });

  test("gate deliver with every field absolute reaches run", async () => {
    const result = await deliverGate(unissued, {
      db: "/srv/rondo/cp.sqlite3",
      destinationDir: "/srv/rondo/dropbox",
      holder: "rondo-operator",
    });
    expect(defectReason(result)).toContain(REACHED_RUN);
  });

  test("gate ack accepts a path-shaped relay id and refuses an option-shaped one", async () => {
    // A relay id is `relay/<gate id>/<stage>`. `requireIdentifier` refuses
    // option-shaped values and whitespace; a slash is neither, so the stronger
    // check costs this surface nothing.
    const ok = await ackGate(unissued, {
      db: "/srv/rondo/cp.sqlite3",
      messageId: "relay/g1/presented",
      actorId: "happy_ryo",
    });
    expect(defectReason(ok)).toContain(REACHED_RUN);

    const bad = await ackGate(unissued, {
      db: "/srv/rondo/cp.sqlite3",
      messageId: "--gate-id",
      actorId: "happy_ryo",
    });
    expect(defectReason(bad)).toContain("messageId");
    expect(defectReason(bad)).not.toContain(REACHED_RUN);
  });

  test("gate answer refuses an empty body", async () => {
    const result = await answerGate(unissued, {
      db: "/srv/rondo/cp.sqlite3",
      gateId: "g1",
      body: "",
      actorId: "happy_ryo",
    });
    expect(defectReason(result)).toContain("body");
    expect(defectReason(result)).not.toContain(REACHED_RUN);
  });

  test("gate answer carries a dash-leading body through, because --body is attached", async () => {
    // The case the attached form exists for: as a separate token this body
    // would read as a flag. It reaches `run`, which is as far as this file can
    // see -- the bytes themselves are asserted where the walk is tested.
    const result = await answerGate(unissued, {
      db: "/srv/rondo/cp.sqlite3",
      gateId: "g1",
      body: "--approve, with reservations",
      actorId: "happy_ryo",
    });
    expect(defectReason(result)).toContain(REACHED_RUN);
  });

  test("run close refuses an outcome outside continuo's terminal set", async () => {
    const result = await closeRun(unissued, {
      db: "/srv/rondo/cp.sqlite3",
      runId: "r1",
      outcome: "merged",
      actorId: "happy_ryo",
    });
    const reason = defectReason(result);
    expect(reason).toContain("outcome");
    // The refusal names the three that work, so the operator's next command is
    // in the message rather than in continuo's --help.
    for (const outcome of RUN_CLOSE_OUTCOMES) {
      expect(reason).toContain(outcome);
    }
    expect(reason).not.toContain(REACHED_RUN);
  });

  test("run close reaches run for each outcome continuo accepts", async () => {
    for (const outcome of RUN_CLOSE_OUTCOMES) {
      const result = await closeRun(unissued, {
        db: "/srv/rondo/cp.sqlite3",
        runId: "r1",
        outcome,
        actorId: "happy_ryo",
      });
      expect(defectReason(result)).toContain(REACHED_RUN);
    }
  });
});
