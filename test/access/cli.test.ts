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
  approvedForPublication,
  forgeHost,
  type GateVerbs,
  type PreflightInput,
  type PullRequestTextInput,
  parseCommand,
  parseForgeSlug,
  publishPreflight,
  pullRequestText,
  repositoryFromRemoteUrl,
  revisionBlocker,
  USAGE,
  walkGate,
} from "../../src/access/cli.js";
import type { LapWorkInspection, PushTargetInspection } from "../../src/access/forge.js";
import type { VerifiedContinuo } from "../../src/continuo/invoker.js";
import type { ContinuoResult } from "../../src/continuo/protocol.js";
import type { IterationRecord } from "../../src/store/records.js";

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
    for (const command of ["start", "answer", "revise", "publish", "abandon"]) {
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

test("a flag the command does not read is refused, not ignored", () => {
  // The trap this closes: `--dry-run` is read only by `publish`, so before the
  // per-command check `rondo answer --body=approve --dry-run` answered the gate
  // and closed the iteration while its author believed they were previewing,
  // and `start --dry-run` spawned a real worker.
  for (const argv of [
    ["answer", "--actor-id", "me", "--body=approve", "--dry-run"],
    ["start", "--plan", "/tmp/p.json", "--dry-run"],
    ["answer", "--actor-id", "me", "--body=approve", "--repo", "o/n"],
    ["publish", "--repo", "o/n", "--actor-id", "me", "--plan", "/tmp/p.json"],
    ["abandon", "--iteration-id", "i1", "--reason", "x", "--body=approve"],
    // `revise` reads four of `start`'s flags and none of `publish`'s: a
    // `--prompt` here would read as though it replaced the second lap's prompt,
    // which is composed from the first lap's request and the instruction.
    ["revise", "--actor-id", "me", "--body=x", "--dry-run"],
    ["revise", "--actor-id", "me", "--body=x", "--prompt", "p"],
    ["revise", "--actor-id", "me", "--body=x", "--plan", "/tmp/p.json"],
  ]) {
    const outcome = parseCommand(argv);
    expect(outcome.kind).toBe("refused");
  }
});

test("each command still accepts every flag it does read", () => {
  // The other half of the check: a table that refused too much would be a
  // worse defect than the one it fixed, and would not show up above.
  for (const argv of [
    [
      "start",
      "--plan",
      "/tmp/p.json",
      "--run-id",
      "r",
      "--topic-branch",
      "t",
      "--workspace",
      "/w",
      "--prompt",
      "p",
      "--iteration-id",
      "i",
    ],
    ["answer", "--actor-id", "me", "--body=approve"],
    [
      "publish",
      "--repo",
      "o/n",
      "--actor-id",
      "me",
      "--remote",
      "upstream",
      "--iteration-id",
      "i",
      "--dry-run",
    ],
    ["abandon", "--iteration-id", "i1", "--reason", "wedged"],
    [
      "revise",
      "--actor-id",
      "me",
      "--body=use the existing helper",
      "--run-id",
      "r-2",
      "--topic-branch",
      "t-2",
      "--workspace",
      "/w2",
      "--iteration-id",
      "i-2",
    ],
  ]) {
    const outcome = parseCommand(argv);
    expect(outcome.kind).toBe("parsed");
  }
});

/**
 * The second lap's three identifiers reach the record.
 *
 * They are on the command line because rondo allocates none of them
 * (`D-0012`, `D-0019` rule 3) and continuo will not take the first lap's: it
 * holds a run under that id, git holds the branch, and a worktree stands at the
 * workspace. What crosses the two laps is the branch, and rondo sets that
 * itself.
 */
test("revise carries the instruction and the three fresh identifiers", () => {
  const outcome = parseCommand([
    "revise",
    "--actor-id",
    "me",
    "--body=-- use the existing helper",
    "--run-id",
    "r-2",
    "--topic-branch",
    "dogfood/r-2",
    "--workspace",
    "/srv/ws2",
  ]);
  expect(outcome.kind).toBe("parsed");
  if (outcome.kind !== "parsed") {
    return;
  }
  expect(outcome.parsed).toMatchObject({
    command: "revise",
    actorId: "me",
    // Carried byte for byte, dash and all: an instruction at a gate may
    // legitimately begin with one, which is why USAGE spells `--body=TEXT`.
    body: "-- use the existing helper",
    runId: "r-2",
    topicBranch: "dogfood/r-2",
    workspace: "/srv/ws2",
  });
});

/**
 * The two refusals that have to come before the gate is walked.
 *
 * The walk presents, delivers and answers through continuo and its ack closes
 * the gate; it cannot be taken back. `revisionPlan` already refuses a plan it
 * cannot build, and these are the two things it cannot see -- the id the
 * successor will be reserved under is not part of the plan, and a gate continuo
 * has already closed is walked *successfully* and silently. Either discovered
 * after the walk leaves a person having spent their gate on an answer that
 * started nothing.
 */
test("a revision is blocked before the walk when the id is taken or the gate is closed", () => {
  const clear = {
    predecessorId: "iter-1",
    gateOutcome: null,
    successorId: "iter-2",
    successorRow: "absent",
  } as const;
  expect(revisionBlocker(clear)).toBe(null);

  // A gate that already reached an outcome: the instruction would be carried
  // nowhere, and `withdrawn` and `expired` close a gate without a person having
  // said anything at all.
  for (const outcome of ["withdrawn", "expired", "answered_and_forwarded"]) {
    const blocked = revisionBlocker({ ...clear, gateOutcome: outcome });
    expect(blocked).toContain(outcome);
    expect(blocked).toContain("No lap was started");
  }

  // A row already standing under the successor's id. `unreadable` blocks it as
  // firmly as `read` does: it is a row, whatever it says.
  for (const row of ["read", "unreadable"] as const) {
    const blocked = revisionBlocker({ ...clear, successorRow: row });
    expect(blocked).toContain("iter-2");
    expect(blocked).toContain("Nothing was touched");
  }

  // The gate is checked first: a person whose gate has closed needs to hear
  // that before they hear about an identifier.
  expect(revisionBlocker({ ...clear, gateOutcome: "expired", successorRow: "read" })).toContain(
    "expired",
  );
});

test("the refusal names the flags the command does take", () => {
  const outcome = parseCommand(["answer", "--actor-id", "me", "--body=approve", "--dry-run"]);
  expect(outcome.kind).toBe("refused");
  if (outcome.kind === "refused") {
    expect(outcome.reason).toContain("--dry-run");
    expect(outcome.reason).toContain("--actor-id");
    expect(outcome.reason).toContain("--body");
  }
});

test("an actor id continuo would refuse is refused before any effect", () => {
  // `RONDO_APPROVER='Jane Doe'` matches `--actor-id 'Jane Doe'` and then fails
  // at the argument boundary -- after `publish` has pushed and opened a pull
  // request, or after `answer` has presented and delivered. The shape is
  // checked with the allowlist so that never happens.
  const spaced = approvedActor(withActor("Jane Doe"), { RONDO_APPROVER: "Jane Doe" });
  expect(spaced).toHaveProperty("refusal");
  if ("refusal" in spaced) {
    expect(spaced.refusal).toContain("whitespace");
  }

  // Written attached, because the parser refuses the space-separated form one
  // layer earlier -- which is itself the right answer, just not this one's.
  const dashedParse = parseCommand(["answer", "--actor-id=--db", "--body=x"]);
  expect(dashedParse.kind).toBe("parsed");
  if (dashedParse.kind === "parsed") {
    expect(approvedActor(dashedParse.parsed, { RONDO_APPROVER: "--db" })).toHaveProperty("refusal");
  }
});

/** An iteration row with only the two fields the publication check reads. */
function rowWith(status: string, gateOutcome: string | null) {
  return { status, gateOutcome } as unknown as Parameters<typeof approvedForPublication>[0];
}

test("only a gate a person answered is publishable", () => {
  expect(approvedForPublication(rowWith("closed", "answered_and_forwarded"))).toBe(true);

  // Each of these closes a gate and therefore closes the iteration, and none of
  // them is a person saying yes. Publishing on one would open a pull request
  // whose body claims an approval that never happened.
  for (const outcome of ["withdrawn", "expired", "unanswerable", null]) {
    expect(approvedForPublication(rowWith("closed", outcome))).toBe(false);
  }

  // And a row that never reached a terminal status is not publishable however
  // its gate reads.
  for (const status of ["awaiting_human", "performing", "abandoned", "failed"]) {
    expect(approvedForPublication(rowWith(status, "answered_and_forwarded"))).toBe(false);
  }
});

/** A workspace that answered every preflight query, with the parts a test varies. */
function inspected(
  parts: Partial<{
    remotes: readonly string[];
    pushUrls: readonly string[];
    topicBranchExists: boolean;
  }>,
): PushTargetInspection {
  return {
    kind: "read",
    remotes: parts.remotes ?? ["origin"],
    pushUrls: parts.pushUrls ?? ["git@github.com:suisya-systems/rondo.git"],
    topicBranchExists: parts.topicBranchExists ?? true,
  };
}

/** The preflight input a test varies one field of at a time. */
function preflight(parts: Partial<PreflightInput>) {
  return publishPreflight({
    repo: "suisya-systems/rondo",
    remote: "origin",
    workspace: "/srv/rondo/workspace-dogfood-001",
    topicBranch: "dogfood/dogfood-001",
    forgeHost: "github.com",
    allowRemoteMismatch: false,
    inspection: inspected({}),
    ...parts,
  });
}

test("a remote URL is read as owner/name only when it names a forge repository", () => {
  const rondo = { host: "github.com", owner: "suisya-systems", name: "rondo" };
  for (const url of [
    "git@github.com:suisya-systems/rondo.git",
    "git@github.com:suisya-systems/rondo",
    "https://github.com/suisya-systems/rondo.git",
    "https://github.com/suisya-systems/rondo/",
    "ssh://git@github.com/suisya-systems/rondo.git",
    "https://user:token@github.com/suisya-systems/rondo.git",
    "  https://github.com/suisya-systems/rondo.git  ",
  ]) {
    expect(repositoryFromRemoteUrl(url)).toEqual(rondo);
  }

  // None of these is malformed, and none of them is a repository `--repo
  // OWNER/NAME` can be about. The dogfood environment's own origin is the
  // second.
  for (const url of [
    "",
    "/srv/rondo/target-origin.git",
    "file:///srv/rondo/target-origin.git",
    "../sibling-clone",
    "https://gitlab.example.com/team/group/project.git",
    "https://github.com/suisya-systems",
  ]) {
    expect(repositoryFromRemoteUrl(url)).toBeNull();
  }

  // The host is carried rather than discarded, because it is half of a
  // repository's identity: these two are not `suisya-systems/rondo`, and a
  // slug-only reading would have called them that.
  for (const url of [
    "https://gitlab.com/suisya-systems/rondo.git",
    "git@gitlab.com:suisya-systems/rondo.git",
  ]) {
    expect(repositoryFromRemoteUrl(url)).toEqual({
      host: "gitlab.com",
      owner: "suisya-systems",
      name: "rondo",
    });
  }

  // A port and a userinfo section are both part of the URL and neither is part
  // of the repository.
  expect(repositoryFromRemoteUrl("ssh://git@github.com:22/suisya-systems/rondo.git")).toEqual(
    rondo,
  );
});

test("a token in a push URL is not printed back at the operator", () => {
  // A push URL may carry a credential in its userinfo, and every mention of a
  // remote URL is a line a terminal scrolls back and a log keeps.
  const refused = preflight({
    inspection: inspected({
      pushUrls: ["https://someone:ghp_SECRETTOKEN@github.com/fork/rondo.git"],
    }),
  });
  expect(refused.kind).toBe("refused");
  if (refused.kind === "refused") {
    expect(refused.reason).not.toContain("ghp_SECRETTOKEN");
    expect(refused.reason).toContain("<redacted>@github.com/fork/rondo.git");
    // The slug is still read through the credential, so the refusal still says
    // which repository the push would reach.
    expect(refused.reason).toContain("fork/rondo");
  }

  const allowed = preflight({
    allowRemoteMismatch: true,
    inspection: inspected({ pushUrls: ["https://someone:ghp_SECRETTOKEN@example.invalid/x.git"] }),
  });
  expect(allowed.kind).toBe("ready");
  if (allowed.kind === "ready") {
    expect(allowed.warnings[0]).not.toContain("ghp_SECRETTOKEN");
  }
});

test("--repo has to be OWNER/NAME, because the forge is given it unchanged", () => {
  expect(parseForgeSlug("suisya-systems/rondo")).toEqual({
    owner: "suisya-systems",
    name: "rondo",
  });
  for (const repo of ["rondo", "suisya-systems/rondo/extra", "suisya systems/rondo", "/rondo"]) {
    expect(parseForgeSlug(repo)).toBeNull();
    expect(preflight({ repo }).kind).toBe("refused");
  }
});

test("preflight refuses a workspace that cannot push where the plan says", () => {
  // The measured defect: a workspace with no remotes at all, for which
  // `--dry-run` printed a push as though it would work.
  const none = preflight({ inspection: inspected({ remotes: [], pushUrls: [] }) });
  expect(none.kind).toBe("refused");
  if (none.kind === "refused") {
    expect(none.reason).toContain("has no remote 'origin'");
    expect(none.reason).toContain("no remotes configured at all");
  }

  // A workspace that has remotes, but not the one the push would name. The
  // others are printed, because the operator's next move is usually one of them.
  const others = preflight({
    inspection: inspected({ remotes: ["upstream", "fork"], pushUrls: [] }),
  });
  expect(others.kind).toBe("refused");
  if (others.kind === "refused") {
    expect(others.reason).toContain("upstream, fork");
  }

  // git could not be asked at all. That is not "there is no remote", and the
  // refusal says so rather than inventing a diagnosis.
  const unreadable = preflight({
    inspection: { kind: "unreadable", reason: "fatal: not a git repository" },
  });
  expect(unreadable.kind).toBe("refused");
  if (unreadable.kind === "refused") {
    expect(unreadable.reason).toContain("fatal: not a git repository");
  }

  // Nothing to push: the branch the plan says the lap committed on is gone.
  const branchless = preflight({ inspection: inspected({ topicBranchExists: false }) });
  expect(branchless.kind).toBe("refused");
  if (branchless.kind === "refused") {
    expect(branchless.reason).toContain("has no branch 'dogfood/dogfood-001'");
  }
});

test("the push remote and --repo have to be one repository, or be said to differ", () => {
  const agreed = preflight({});
  expect(agreed.kind).toBe("ready");
  if (agreed.kind === "ready") {
    // Agreement is the ordinary case, and it changes nothing: the head is the
    // branch name, and there is nothing to warn about.
    expect(agreed.headRef).toBe("dogfood/dogfood-001");
    expect(agreed.warnings).toEqual([]);
  }

  // GitHub does not distinguish case in an owner or a repository name, so
  // neither does this; refusing on case alone would be rondo inventing a rule.
  expect(preflight({ repo: "Suisya-Systems/Rondo" }).kind).toBe("ready");

  // The second half of the measured defect: the push would go to one
  // repository and the pull request would be opened against another.
  const mismatch = preflight({
    inspection: inspected({ pushUrls: ["git@github.com:someone-else/practice.git"] }),
  });
  expect(mismatch.kind).toBe("refused");
  if (mismatch.kind === "refused") {
    expect(mismatch.reason).toContain("someone-else/practice");
    expect(mismatch.reason).toContain("--allow-remote-mismatch");
  }

  // A remote rondo cannot read as OWNER/NAME is refused too, and for a
  // different stated reason: it is not that they differ, it is that rondo
  // cannot tell. A local bare repository -- what the dogfood environment has --
  // is this case.
  const local = preflight({
    inspection: inspected({ pushUrls: ["/srv/rondo/target-origin.git"] }),
  });
  expect(local.kind).toBe("refused");
  if (local.kind === "refused") {
    expect(local.reason).toContain("not a repository rondo can read as OWNER/NAME");
  }

  // The mismatch that is easiest to miss: the path reads as `owner/name`, and
  // the host says it is a different repository entirely.
  const elsewhere = preflight({
    inspection: inspected({ pushUrls: ["https://gitlab.com/suisya-systems/rondo.git"] }),
  });
  expect(elsewhere.kind).toBe("refused");
  if (elsewhere.kind === "refused") {
    expect(elsewhere.reason).toContain("on gitlab.com");
  }

  // The host compared against is the one the forge CLI will use, not an
  // assumed github.com: with an enterprise host configured, the enterprise
  // remote agrees and the github.com one does not.
  const enterprise = { forgeHost: "github.example.com" };
  expect(
    preflight({
      ...enterprise,
      inspection: inspected({ pushUrls: ["https://github.example.com/suisya-systems/rondo.git"] }),
    }).kind,
  ).toBe("ready");
  expect(preflight({ ...enterprise }).kind).toBe("refused");
});

test("the forge host is read from the environment publish will spawn under", () => {
  // Assuming github.com is what would let the check approve a push to one
  // forge while the pull request is opened on another.
  expect(forgeHost({})).toBe("github.com");
  expect(forgeHost({ GH_HOST: "" })).toBe("github.com");
  expect(forgeHost({ GH_HOST: "  " })).toBe("github.com");
  expect(forgeHost({ GH_HOST: "github.example.com" })).toBe("github.example.com");
});

test("every destination of a multi-URL push remote is checked, not the first", () => {
  // `remote.<name>.pushurl` is multi-valued and `git push` sends to all of
  // them, so a check that stopped at the first would approve a publish that
  // also reached a repository it never looked at.
  const extra = preflight({
    inspection: inspected({
      pushUrls: [
        "git@github.com:suisya-systems/rondo.git",
        "git@github.com:someone-else/mirror.git",
      ],
    }),
  });
  expect(extra.kind).toBe("refused");
  if (extra.kind === "refused") {
    expect(extra.reason).toContain("pushes to 2 places");
    expect(extra.reason).toContain("someone-else/mirror");
  }

  // Two destinations that agree with --repo are still an agreement.
  expect(
    preflight({
      inspection: inspected({
        pushUrls: [
          "git@github.com:suisya-systems/rondo.git",
          "https://github.com/suisya-systems/rondo.git",
        ],
      }),
    }).kind,
  ).toBe("ready");

  // Under the override, two destinations with different owners leave no single
  // owner to qualify the head with, so it stays bare and says so.
  const spread = preflight({
    allowRemoteMismatch: true,
    inspection: inspected({
      pushUrls: ["git@github.com:happy-ryo/rondo.git", "git@github.com:someone-else/rondo.git"],
    }),
  });
  expect(spread.kind).toBe("ready");
  if (spread.kind === "ready") {
    expect(spread.headRef).toBe("dogfood/dogfood-001");
    expect(spread.warnings[0]).toContain("no single github.com owner");
  }
});

test("--allow-remote-mismatch keeps the fork route open, and spells the head for it", () => {
  // Push to the fork, open the pull request upstream. A bare branch name is
  // read by the forge as a branch of --repo, which is not where the push went,
  // so the head is qualified with the owner the push actually reached.
  const fork = preflight({
    allowRemoteMismatch: true,
    inspection: inspected({ pushUrls: ["git@github.com:happy-ryo/rondo.git"] }),
  });
  expect(fork.kind).toBe("ready");
  if (fork.kind === "ready") {
    expect(fork.headRef).toBe("happy-ryo:dogfood/dogfood-001");
    expect(fork.warnings.length).toBe(1);
    expect(fork.warnings[0]).toContain("happy-ryo:dogfood/dogfood-001");
  }

  // With a remote that is not a forge repository there is no owner to qualify
  // with, so the head stays bare and the warning says what that will mean.
  const local = preflight({
    allowRemoteMismatch: true,
    inspection: inspected({ pushUrls: ["/srv/rondo/target-origin.git"] }),
  });
  expect(local.kind).toBe("ready");
  if (local.kind === "ready") {
    expect(local.headRef).toBe("dogfood/dogfood-001");
    expect(local.warnings[0]).toContain("Expect the pull-request leg to fail");
  }

  // The override is publish's alone, and it is a flag `answer` would otherwise
  // have accepted silently.
  expect(parseCommand(["answer", "--actor-id", "me", "--allow-remote-mismatch"]).kind).toBe(
    "refused",
  );
  const parsed = parseCommand([
    "publish",
    "--repo",
    "o/n",
    "--actor-id",
    "me",
    "--allow-remote-mismatch",
  ]);
  expect(parsed.kind).toBe("parsed");
  if (parsed.kind === "parsed") {
    expect(parsed.parsed.allowRemoteMismatch).toBe(true);
  }
});

/**
 * The lap prompt that opened the first real pull request, in miniature.
 *
 * It is here in full shape rather than as a placeholder because the defect
 * being held closed is about *this kind of text*: a set of instructions to an
 * agent, several of them prohibitions, which said nothing about the change and
 * was printed as though it were the description of one.
 */
const REQUEST = [
  "Append exactly one line to the end of docs/operations/rondo-cli.md, recording that the",
  "first real lap ran.",
  "",
  "Do not build. Do not lint. Do not push. Do nothing else.",
].join("\n");

/** An iteration row a publish would be run against, varied one field at a time. */
function published(parts: Partial<IterationRecord> = {}): IterationRecord {
  return {
    id: "dogfood-001",
    status: "closed",
    request: REQUEST,
    plan: {},
    planDigest: "sha256:0",
    attempts: 1,
    runId: "dogfood-001",
    continuoRevision: "603843b",
    agentTypeDigest: null,
    configDigest: null,
    contractDigest: null,
    classification: "allowed",
    classificationReason: null,
    neutralRoleName: null,
    continuoRole: null,
    modelTier: "standard",
    model: "claude-opus-5",
    gateId: "g-1",
    gateStage: "forwarded",
    gateOutcome: "answered_and_forwarded",
    sessionId: "s-1",
    sessionPath: null,
    reason: null,
    createdAtMs: 0,
    updatedAtMs: 0,
    ...parts,
  };
}

/** What `inspectLapWork` read, with one commit and one file unless varied. */
function worked(
  parts: Partial<Extract<LapWorkInspection, { kind: "read" }>> = {},
): LapWorkInspection {
  return {
    kind: "read",
    baseRef: "refs/remotes/origin/main",
    commits: [{ abbreviatedSha: "cfa4502", subject: "docs: record the first real lap" }],
    files: [{ path: "docs/operations/rondo-cli.md", added: 1, deleted: 0 }],
    ...parts,
  };
}

/** The three bounds `src/access/cli.ts` composes a body under. */
const REQUEST_LIMIT = 4000;
const LIST_LIMIT = 20;
const LISTED_LIMIT = 200;

/** The pull request text a test varies one input of at a time. */
function text(parts: Partial<PullRequestTextInput> = {}) {
  return pullRequestText({
    record: published(),
    runId: "dogfood-001",
    topicBranch: "docs/rondo-first-real-lap",
    baseBranch: "main",
    headIsQualified: false,
    work: worked(),
    ...parts,
  });
}

test("the title is the lap's own commit subject, never the request cut short", () => {
  // The subject as written. Not the branch name, not the prompt, and nothing
  // appended: a commit subject is already a summary a person wrote.
  expect(text().title).toBe("docs: record the first real lap");

  // More than one commit says so rather than summarising the rest.
  const two = text({
    work: worked({
      commits: [
        { abbreviatedSha: "aaa1111", subject: "docs: record the first real lap" },
        { abbreviatedSha: "bbb2222", subject: "docs: fix the section number" },
      ],
    }),
  });
  expect(two.title).toBe("docs: record the first real lap (+1 more commit)");

  // No title rondo composes ends mid-sentence: the request never reaches it,
  // and a subject too long to be a summary is replaced rather than cut.
  const long = "docs: ".concat("and then it kept going ".repeat(20)).trim();
  expect(long.length).toBeGreaterThan(120);
  for (const title of [
    text({ work: worked({ commits: [{ abbreviatedSha: "ccc3333", subject: long }] }) }).title,
    text({ work: worked({ commits: [] }) }).title,
    text({ work: { kind: "unreadable", reason: "not a git repository" } }).title,
  ]) {
    expect(title).toBe("docs/rondo-first-real-lap (rondo run dogfood-001)");
    expect(title).not.toContain("...");
    expect(title).not.toContain("Do not");
  }
});

test("the body describes the change, and the request is quoted rather than presented", () => {
  const body = text().body;

  // What changed, from the work itself.
  expect(body).toContain("## What changed");
  expect(body).toContain("- `cfa4502` docs: record the first real lap");
  expect(body).toContain("1 file changed against `refs/remotes/origin/main`:");
  expect(body).toContain("- `docs/operations/rondo-cli.md` (+1 -0)");

  // The provenance the first pull request got right, kept.
  expect(body).toContain("run `dogfood-001` (iteration `dogfood-001`)");
  expect(body).toContain("Gate `g-1` closed `answered_and_forwarded`: a person answered it");
  expect(body).toContain("Against continuo `603843b`, on `claude-opus-5` (tier `standard`).");
  expect(body).toContain(
    "This pull request was opened by `rondo publish`, which an operator ran. Merging it is not.",
  );

  // And the instructions to the agent are quoted input behind a fold, not the
  // body's own prose. The prohibition is *below* the `<details>` that names
  // what it is -- which is the whole of the defect this test holds closed.
  expect(body).toContain("<details>");
  expect(body.indexOf("Do not build.")).toBeGreaterThan(body.indexOf("<summary>"));
  expect(body.indexOf("Do not build.")).toBeGreaterThan(body.indexOf("```"));
  expect(body.startsWith("## What changed")).toBe(true);
  expect(body.trimEnd().endsWith("Merging it is not.")).toBe(true);
});

test("a request that contains a code block cannot end the quotation it is inside", () => {
  const body = text({
    record: published({ request: "Run this:\n\n```sh\nnpm run verify\n```\n\nThen stop." }),
  }).body;
  // A fence longer than anything inside it, so the quoted request stays quoted.
  expect(body).toContain("````\nRun this:");
  expect(body).toContain("Then stop.\n````");
});

test("a very long request is quoted as far as it goes and says where the rest is", () => {
  const body = text({ record: published({ request: "x".repeat(4100) }) }).body;
  expect(body).toContain("[...100 more characters.");
  expect(body).toContain("on this iteration's row in rondo's store.]");
});

test("a history rondo could not read is said out loud, and loses no provenance", () => {
  const body = text({ work: { kind: "unreadable", reason: "not a git repository" } }).body;
  expect(body).toContain("rondo could not read this branch's history");
  expect(body).toContain("not a git repository");
  expect(body).toContain("Gate `g-1` closed `answered_and_forwarded`");
  expect(body).toContain("Merging it is not.");
});

test("long lists are counted rather than printed in full, and binary files say so", () => {
  const commits = Array.from({ length: 22 }, (_, index) => ({
    abbreviatedSha: `sha${String(index)}`,
    subject: `commit ${String(index)}`,
  }));
  const files = Array.from({ length: 21 }, (_, index) => ({
    path: `src/file-${String(index)}.ts`,
    added: index,
    deleted: 0,
  }));
  const body = text({ work: worked({ commits, files }) }).body;
  expect(body).toContain("- ...and 2 more commits.");
  expect(body).toContain("- ...and 1 more file.");
  expect(body).not.toContain("commit 21");

  const binary = text({
    work: worked({ files: [{ path: "docs/shot.png", added: null, deleted: null }] }),
  }).body;
  expect(binary).toContain("- `docs/shot.png` (binary)");
});

test("nothing rondo composes can be too long for the forge to accept", () => {
  // The branch and the run id are the operator's own strings and neither is
  // bounded. A title past a forge's limit is refused *after* the push, which is
  // the one leg publish cannot undo -- so the label steps down instead.
  const long = "b".repeat(400);
  const stepped = text({ topicBranch: long, work: worked({ commits: [] }) }).title;
  expect(stepped).toBe("rondo run dogfood-001");

  const both = text({
    topicBranch: long,
    runId: "r".repeat(400),
    work: worked({ commits: [] }),
  }).title;
  expect(both.length).toBe(120);
  expect(both.startsWith("rondo run rrr")).toBe(true);
});

test("the quoted request is the row's, whitespace and all, and its fence is sized to what is shown", () => {
  // Verbatim means verbatim: the block does not tidy what the row holds.
  const padded = text({ record: published({ request: "\n\n  do the thing  \n" }) }).body;
  expect(padded).toContain("```\n\n\n  do the thing  \n\n```");

  // A run of backticks past the cut is not in the quotation, so it must not
  // size the fence: a body whose fences are longer than its content is how a
  // bounded truncation becomes a pull request too large to open.
  const body = text({
    record: published({ request: `${"x".repeat(REQUEST_LIMIT)}${"`".repeat(5000)}` }),
  }).body;
  expect(body).toContain("```\nxxx");
  expect(body).not.toContain("````");
  expect(body.length).toBeLessThan(REQUEST_LIMIT + 2000);
});

test("a body is bounded by what it lists as well as by how much", () => {
  // Twenty entries is not a bound when one entry is unbounded: a subject and a
  // path are both as long as somebody made them, and a body past the forge's
  // limit is refused after the push has already happened.
  const body = text({
    work: worked({
      commits: [{ abbreviatedSha: "aaa1111", subject: "s".repeat(300) }],
      files: [{ path: `${"p".repeat(300)}.ts`, added: 1, deleted: 0 }],
    }),
  }).body;
  expect(body).toContain("- `aaa1111` (subject of 300 characters, not printed here)");
  expect(body).toContain("(path of 303 characters, not printed here)");
  expect(body).not.toContain("sss");
});

test("a fork publish says which base its summary compared against", () => {
  // The push went to one repository and the pull request is opened in another,
  // so the base rondo read is the workspace's and the base the forge diffs
  // against is the target's. The body says so rather than letting the two read
  // as one comparison.
  const forked = text({ headIsQualified: true }).body;
  expect(forked).toContain("pushed to a different repository than this pull request is opened in");
  expect(forked).toContain("compares against `refs/remotes/origin/main` as the workspace has it");

  expect(text().body).not.toContain("pushed to a different repository");

  // There is nothing to caveat when there was no comparison to begin with.
  const unreadable = text({
    headIsQualified: true,
    work: { kind: "unreadable", reason: "not a git repository" },
  }).body;
  expect(unreadable).not.toContain("pushed to a different repository");
});

test("no value the row carries can make a body the forge refuses", () => {
  // A run id, a branch, a session name and a git error are each as long as
  // whatever wrote them. Every one is bounded on the way into the body.
  const body = text({
    runId: "r".repeat(70_000),
    topicBranch: "b".repeat(70_000),
    record: published({ sessionId: "s".repeat(70_000), model: "m".repeat(70_000) }),
    work: { kind: "unreadable", reason: "e".repeat(70_000) },
  }).body;
  expect(body).toContain("(run id of 70000 characters, not printed here)");
  expect(body).toContain("(session name of 70000 characters, not printed here)");
  expect(body).toContain("(reason of 70000 characters, not printed here)");
  expect(body.length).toBeLessThan(6000);

  // And the sum is checked as well as the parts: the quoted request is what
  // gives way, because it is the one part not about this change and the row
  // still has it.
  const commits = Array.from({ length: LIST_LIMIT }, (_, index) => ({
    abbreviatedSha: "a".repeat(LISTED_LIMIT),
    subject: `${String(index)}${"s".repeat(LISTED_LIMIT - 1)}`,
  }));
  const huge = text({
    record: published({ request: "q".repeat(REQUEST_LIMIT) }),
    work: worked({ commits }),
  }).body;
  expect(huge).toContain("qqq");
  expect(huge.length).toBeLessThanOrEqual(60_000);
});
