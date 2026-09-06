/**
 * The operator's command line, tested where it can be tested without a machine.
 *
 * Three things are checked here and each is a different kind of claim. The
 * parser is a pure function and is checked as one. `USAGE` is checked for
 * D-0004's alphabet, which is the **only automatic check of that rule that has
 * ever existed in this tree** -- every other statement of it is prose, and the
 * failure it guards (a cp932 console crashing on an em-dash) is invisible to
 * vitest, which captures stdout through a UTF-8 path. And `walkGate` is checked
 * against injected fakes for the four gate verbs, because the order those verbs
 * go in is the whole of what the operating surface contributes to answering a
 * gate: nothing else in the tree knows that a present does not move a stage, or
 * that the ack of the forwarded relay is what closes the gate.
 *
 * What is deliberately *not* here is `main()` end to end. It opens a database
 * and starts continuo, so a test of it would be a test of the machine rather
 * than of this module; the runbook's real walk is what covers that, and
 * `docs/operations/rondo-cli.md` records it.
 */
import { expect, test } from "vitest";
import {
  approvedActor,
  type GateVerbs,
  parseCommand,
  USAGE,
  walkGate,
} from "../../src/access/cli.js";
import type { VerifiedContinuo } from "../../src/continuo/invoker.js";
import type { ContinuoResult } from "../../src/continuo/protocol.js";

/** A handle no test reaches past: every verb below is a fake. */
const continuo: VerifiedContinuo = {
  cliPath: "/opt/continuo/dist/cli.js",
  revision: "38c667b5126fdfdc0465e4a422e88b20a8b53044",
};

const walkRequest = {
  db: "/srv/rondo/cp.sqlite3",
  gateId: "g1",
  destinationDir: "/srv/rondo/dropbox",
  holder: "rondo-operator",
  actorId: "happy_ryo",
  body: "approve",
};

/** An answered result, wrapped the way `decode` wraps one. */
function answered<T>(payload: T): ContinuoResult<T> {
  return { kind: "answered", db: "/srv/rondo/cp.sqlite3", payload };
}

/**
 * Fakes for the four verbs, recording the order they were called in.
 *
 * The message ids the fakes hand back are deliberately **not** derivable from
 * the gate id: `m-presented-relay` and `m-forwarded-relay` could not be
 * composed by a caller that wanted to guess. A walk that used a computed id
 * would fail these cases, which is the point -- the ids are continuo's to
 * spell.
 */
function fakeVerbs(
  stage: string,
  outcome: string | null = null,
): { verbs: GateVerbs; calls: string[] } {
  const calls: string[] = [];
  const verbs: GateVerbs = {
    show: async (_continuo, request) => {
      calls.push(`show:${request.gateId}`);
      return answered({
        gateId: request.gateId,
        gateType: "worker_escalation",
        runId: "r1",
        stage,
        outcome,
        rationale: "Ready to land. Land it?",
        options: '["approve", "revise"]',
      });
    },
    present: async (_continuo, request) => {
      calls.push(`present:${request.gateId}`);
      return answered({
        gateId: request.gateId,
        messageId: "m-presented-relay",
        toStage: "presented",
        recipient: "external-notify",
        enqueued: true,
      });
    },
    deliver: async (_continuo, request) => {
      calls.push(`deliver:${request.holder}`);
      return answered({
        recipient: "external-notify",
        epoch: 1,
        deliveredMessageIds: ["m-presented-relay"],
      });
    },
    ack: async (_continuo, request) => {
      calls.push(`ack:${request.messageId}`);
      return answered({
        messageId: request.messageId,
        gateId: "g1",
        toStage: request.messageId === "m-forwarded-relay" ? "forwarded" : "presented",
        acked: true,
        cancelled: false,
        advanced: true,
        closed: request.messageId === "m-forwarded-relay",
      });
    },
    answer: async (_continuo, request) => {
      calls.push(`answer:${request.body}`);
      return answered({
        advanced: true,
        enqueued: true,
        messageId: "m-forwarded-relay",
        toStage: "forwarded",
      });
    },
  };
  return { verbs, calls };
}

test("USAGE is printable ASCII, which is the only automatic check of D-0004", () => {
  // The rule is repository-wide and this is the one string a test can hold. An
  // em-dash here crashes a cp932 console on `--help`, and no other test in the
  // tree would go red.
  expect(USAGE).toMatch(/^[\x20-\x7E\n]*$/);
});

test("no argv, --help and help all reach the help command", () => {
  for (const argv of [[], ["--help"], ["-h"], ["help"]]) {
    const outcome = parseCommand(argv);
    expect(outcome.kind).toBe("parsed");
    if (outcome.kind === "parsed") {
      expect(outcome.parsed.command).toBe("help");
    }
  }
});

test("a word that is not a command is refused, and the refusal lists the commands", () => {
  const outcome = parseCommand(["strat", "--plan", "/tmp/p.json"]);
  expect(outcome.kind).toBe("refused");
  if (outcome.kind === "refused") {
    expect(outcome.reason).toContain("strat");
    for (const command of ["start", "answer", "publish", "abandon"]) {
      expect(outcome.reason).toContain(command);
    }
  }
});

test("an unknown flag is refused rather than ignored", () => {
  // The failure this prevents: `--remot origin` accepted silently, and a push
  // that goes somewhere the operator did not read on their own command line.
  const outcome = parseCommand(["publish", "--repo", "o/n", "--remot", "origin"]);
  expect(outcome.kind).toBe("refused");
});

test("a bare word is refused as a quoting mistake", () => {
  const outcome = parseCommand(["answer", "--body", "yes", "please"]);
  expect(outcome.kind).toBe("refused");
  if (outcome.kind === "refused") {
    expect(outcome.reason).toContain("please");
  }
});

test("each command's flags land on the parsed record", () => {
  const outcome = parseCommand([
    "start",
    "--plan",
    "/tmp/plan.json",
    "--run-id",
    "r-9",
    "--topic-branch",
    "dogfood/r-9",
    "--workspace",
    "/srv/ws",
    "--prompt",
    "do the thing",
  ]);
  expect(outcome.kind).toBe("parsed");
  if (outcome.kind !== "parsed") {
    return;
  }
  expect(outcome.parsed).toMatchObject({
    command: "start",
    planFile: "/tmp/plan.json",
    runId: "r-9",
    topicBranch: "dogfood/r-9",
    workspace: "/srv/ws",
    prompt: "do the thing",
    dryRun: false,
  });
});

test("--dry-run is a boolean and reaches the record", () => {
  const outcome = parseCommand(["publish", "--repo", "o/n", "--actor-id", "me", "--dry-run"]);
  expect(outcome.kind).toBe("parsed");
  if (outcome.kind === "parsed") {
    expect(outcome.parsed.dryRun).toBe(true);
  }
});

test("a dash-leading body is carried when it is attached to the flag", () => {
  // An answer may legitimately begin with a dash, and `--body=<value>` is how
  // it is written. The bytes are then carried through untouched (D-0009 part 3).
  const outcome = parseCommand(["answer", "--actor-id", "me", "--body=-- approve"]);
  expect(outcome.kind).toBe("parsed");
  if (outcome.kind === "parsed") {
    expect(outcome.parsed.body).toBe("-- approve");
  }
});

test("a dash-leading body passed with a space is refused, and the refusal says how", () => {
  // Node's `parseArgs` will not guess whether `--body -- approve` means a value
  // or a missing one, and neither will rondo. The refusal is relayed verbatim
  // because it already names the form that works -- which is why USAGE spells
  // `--body=TEXT` with the equals sign.
  const outcome = parseCommand(["answer", "--actor-id", "me", "--body", "-- approve"]);
  expect(outcome.kind).toBe("refused");
  if (outcome.kind === "refused") {
    expect(outcome.reason).toContain("--body=");
  }
});

test("from 'received' the walk is six verbs, in continuo's order", () => {
  return (async () => {
    const { verbs, calls } = fakeVerbs("received");
    const outcome = await walkGate(continuo, walkRequest, verbs);

    expect(outcome).toEqual({ kind: "walked", closed: true });
    expect(calls).toEqual([
      "show:g1",
      "present:g1",
      "deliver:rondo-operator",
      // The ack of the *presented* relay is what moves the stage; the present
      // did not.
      "ack:m-presented-relay",
      "answer:approve",
      "deliver:rondo-operator",
      // And the ack of the *forwarded* relay is what closes the gate.
      "ack:m-forwarded-relay",
    ]);
  })();
});

test("from 'presented' the walk skips straight to the answer", () => {
  return (async () => {
    const { verbs, calls } = fakeVerbs("presented");
    const outcome = await walkGate(continuo, walkRequest, verbs);

    expect(outcome).toEqual({ kind: "walked", closed: true });
    expect(calls).toEqual([
      "show:g1",
      "answer:approve",
      "deliver:rondo-operator",
      "ack:m-forwarded-relay",
    ]);
    // Replaying from `present` here is what continuo refuses
    // `InadmissibleTransitionRefused` -- which is why the walk reads the stage
    // rather than starting at the beginning.
    expect(calls).not.toContain("present:g1");
  })();
});

test("from 'answered' the walk re-issues the identical body to recover the relay id", () => {
  return (async () => {
    const { verbs, calls } = fakeVerbs("answered");
    const outcome = await walkGate(continuo, walkRequest, verbs);

    expect(outcome).toEqual({ kind: "walked", closed: true });
    // Re-issuing is idempotent for the same body, and it is the only way to get
    // the forwarded relay's id out of a payload rather than composing one.
    expect(calls).toEqual([
      "show:g1",
      "answer:approve",
      "deliver:rondo-operator",
      "ack:m-forwarded-relay",
    ]);
  })();
});

test("a gate that already has an outcome is not walked at all", () => {
  return (async () => {
    const { verbs, calls } = fakeVerbs("forwarded", "answered_and_forwarded");
    const outcome = await walkGate(continuo, walkRequest, verbs);

    expect(outcome).toEqual({ kind: "walked", closed: true });
    // Nothing after the observation. An answer sent to a closed gate would be
    // an operator believing they had answered something they had not.
    expect(calls).toEqual(["show:g1"]);
  })();
});

test("a refusal partway through stops the walk where it happened", () => {
  return (async () => {
    const { verbs, calls } = fakeVerbs("received");
    const refusing: GateVerbs = {
      ...verbs,
      deliver: async () => {
        calls.push("deliver:refused");
        return {
          kind: "refused",
          db: "/srv/rondo/cp.sqlite3",
          errorClass: "LeaseHeld",
          message: "the outbox-delivery lease is held",
        };
      },
    };
    const outcome = await walkGate(continuo, walkRequest, refusing);

    expect(outcome.kind).toBe("failed");
    // It stopped at the deliver. Nothing was answered, and no ack was sent for
    // a relay that never went out.
    expect(calls).toEqual(["show:g1", "present:g1", "deliver:refused"]);
  })();
});

test("a stage the walk cannot carry an answer from is refused, not guessed at", () => {
  return (async () => {
    const { verbs, calls } = fakeVerbs("withdrawn_pending");
    const outcome = await walkGate(continuo, walkRequest, verbs);

    expect(outcome.kind).toBe("failed");
    expect(calls).toEqual(["show:g1"]);
  })();
});

/** A parsed command carrying only the actor, for the approver cases. */
function withActor(actorId: string | null) {
  const outcome = parseCommand(actorId === null ? ["answer"] : ["answer", "--actor-id", actorId]);
  if (outcome.kind !== "parsed") {
    throw new Error("the fixture did not parse");
  }
  return outcome.parsed;
}

test("the approver allowlist refuses an unnamed actor, an unset allowlist and a mismatch", () => {
  // Three refusals rather than one, because they are three different mistakes
  // and an operator needs to be told which one they made.
  expect(approvedActor(withActor(null), { RONDO_APPROVER: "happy_ryo" })).toHaveProperty("refusal");

  const unset = approvedActor(withActor("happy_ryo"), {});
  expect(unset).toHaveProperty("refusal");
  if ("refusal" in unset) {
    expect(unset.refusal).toContain("RONDO_APPROVER");
  }

  const mismatch = approvedActor(withActor("somebody-else"), { RONDO_APPROVER: "happy_ryo" });
  expect(mismatch).toHaveProperty("refusal");
  if ("refusal" in mismatch) {
    expect(mismatch.refusal).toContain("somebody-else");
    expect(mismatch.refusal).toContain("happy_ryo");
  }

  // An empty allowlist is not an empty-string identity that something could
  // match: it is an unset allowlist, and it refuses.
  expect(approvedActor(withActor(""), { RONDO_APPROVER: "" })).toHaveProperty("refusal");
});

test("the approver allowlist admits the one identity it names", () => {
  const allowed = approvedActor(withActor("happy_ryo"), { RONDO_APPROVER: "happy_ryo" });
  expect(allowed).toEqual({ actorId: "happy_ryo" });
});
