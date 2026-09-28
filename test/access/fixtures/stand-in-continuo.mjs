// A stand-in for the pinned continuo's CLI, for the one page-path test that
// has to run where the real one cannot (rondo#551, `repair-path.test.ts`).
//
// **What it is not.** It is not continuo: there is no control plane, no fence,
// no lease and no worker. It answers the verbs rondo drives, in the documents
// `src/continuo/protocol.ts` decodes, over a JSON file beside `--db`, and it
// does the two things a lap does that rondo reads back afterwards: it cuts the
// worktree from the base branch `run admit` named, and -- standing in for the
// worker's turn -- commits one file there. Everything rondo does around it is
// rondo's own code. `test/access/press-path.test.ts` drives the same scenario
// over the real pinned build, where CI provides one.
//
// Run by rondo's invoker as `node <this file> <verb> <noun> ...` once copied to
// `<dir>/dist/cli.js`, which is the path shape the invoker accepts.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

// Written in by the test when it copies this file: the pinned build's own
// `--version` line, so the invoker's startup check passes as it does for it.
const VERSION_LINE = "__PINNED_VERSION_LINE__";
const argv = process.argv.slice(2);

if (argv[0] === "--version") {
  process.stdout.write(`${VERSION_LINE}\n`);
  process.exit(0);
}

const verb = `${argv[0]} ${argv[1]}`;
const flags = {};
/** `--claude-command`, repeated: the worker's command prefix, token by token. */
const claudeCommand = [];
for (let i = 2; i < argv.length; i += 1) {
  const token = argv[i];
  if (!token.startsWith("--")) {
    continue;
  }
  const at = token.indexOf("=");
  if (at !== -1) {
    flags[token.slice(2, at)] = token.slice(at + 1);
  } else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
    if (token === "--claude-command") {
      claudeCommand.push(argv[i + 1]);
    }
    flags[token.slice(2)] = argv[i + 1];
    i += 1;
  } else {
    flags[token.slice(2)] = true;
  }
}

const db = flags.db;
const schema = `continuo.${argv[0]}.${argv[1]}/1`;
const statePath = `${db}.stand-in.json`;
const state = existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, "utf8"))
  : { runs: {}, gates: {}, messages: {}, epoch: 0 };
const save = () => writeFileSync(statePath, JSON.stringify(state), "utf8");

const answer = (payload) => {
  save();
  process.stdout.write(`${JSON.stringify({ schema, ok: true, db, ...payload })}\n`);
  process.exit(0);
};
const refuse = (errorClass, message) => {
  process.stderr.write(
    `${JSON.stringify({ schema, ok: false, db, error: { class: errorClass, message } })}\n`,
  );
  process.exit(2);
};

const git = (directory, ...args) =>
  execFileSync("git", ["-C", directory, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "stand-in worker",
      GIT_AUTHOR_EMAIL: "worker@example.invalid",
      GIT_COMMITTER_NAME: "stand-in worker",
      GIT_COMMITTER_EMAIL: "worker@example.invalid",
    },
  }).trim();

const gateOf = (gateId) => {
  const gate = state.gates[gateId];
  if (gate === undefined) {
    refuse("GateNotFound", `no gate '${gateId}'`);
  }
  return gate;
};

const enqueue = (gate, kind) => {
  const messageId = `relay-${kind}-${gate.gateId}`;
  state.messages[messageId] = { gateId: gate.gateId, kind, delivered: false };
  return messageId;
};

switch (verb) {
  case "db create":
    answer({ schema_version: 1, head_version: 1 });
    break;
  case "run admit": {
    if (state.runs[flags["run-id"]] !== undefined) {
      refuse("RunAlreadyExists", `run '${flags["run-id"]}' exists`);
    }
    state.runs[flags["run-id"]] = {
      status: "admitted",
      workspace: flags.workspace,
      baseBranch: flags["base-branch"],
      topicBranch: flags["topic-branch"],
    };
    answer({ run_id: flags["run-id"], status: "admitted", created_at_ms: Date.now() });
    break;
  }
  case "lap perform": {
    const runId = flags["run-id"];
    const run = state.runs[runId];
    if (run === undefined) {
      refuse("RunNotFound", `no run '${runId}'`);
    }
    git(flags.repository, "worktree", "add", "-b", run.topicBranch, run.workspace, run.baseBranch);
    const baseCommit = git(run.workspace, "rev-parse", "HEAD");
    // The worker's turn: the plan's command, in the worktree, as continuo
    // spawns it (`cwd` is the workspace). Its exit is not read: a lap whose
    // worker did nothing is the test's to notice, as it is with continuo.
    const [program, ...prefix] = claudeCommand;
    execFileSync(program, [...prefix, "-p", "the turn"], { cwd: run.workspace, stdio: "ignore" });
    run.status = "running";
    const gateId = `gate-${runId}`;
    state.gates[gateId] = { gateId, runId, stage: "received", outcome: null };
    answer({
      run_id: runId,
      workspace: run.workspace,
      topic_branch: run.topicBranch,
      base_commit: baseCommit,
      session_id: `session-${runId}`,
      session_path: "started",
      gate_id: gateId,
      event_id: `event-${runId}`,
      event_seq: 1,
      endpoint_lease_failure: null,
      elapsed_deadline_at_ms: null,
      model: typeof flags.model === "string" ? flags.model : null,
      permission_denials: [],
      spend: null,
      commands: [],
    });
    break;
  }
  case "gate show": {
    const gate = gateOf(flags["gate-id"]);
    answer({
      gate_id: gate.gateId,
      gate_type: "approval",
      run_id: gate.runId,
      stage: gate.stage,
      outcome: gate.outcome,
      rationale: "I did the work. May I go on?",
      options: '["approve","revise"]',
    });
    break;
  }
  case "gate present": {
    const gate = gateOf(flags["gate-id"]);
    const messageId = enqueue(gate, "present");
    answer({
      gate_id: gate.gateId,
      message_id: messageId,
      to_stage: gate.stage,
      recipient: "external-notify",
      enqueued: true,
    });
    break;
  }
  case "gate deliver": {
    state.epoch += 1;
    const delivered = Object.entries(state.messages)
      .filter(([, message]) => !message.delivered)
      .map(([messageId, message]) => {
        message.delivered = true;
        return { message_id: messageId, dedup_key: messageId };
      });
    answer({ recipient: "external-notify", epoch: state.epoch, delivered });
    break;
  }
  case "gate ack": {
    const messageId = flags["message-id"];
    const message = state.messages[messageId];
    if (message === undefined) {
      refuse("MessageNotFound", `no message '${messageId}'`);
    }
    const gate = gateOf(message.gateId);
    const closing = message.kind === "forward";
    gate.stage = closing ? "closed" : "presented";
    if (closing) {
      gate.outcome = "answered_and_forwarded";
    }
    answer({
      message_id: messageId,
      gate_id: gate.gateId,
      to_stage: gate.stage,
      acked: true,
      cancelled: false,
      advanced: true,
      closed: closing,
    });
    break;
  }
  case "gate answer": {
    const gate = gateOf(flags["gate-id"]);
    gate.stage = "answered";
    const messageId = enqueue(gate, "forward");
    const delegated = typeof flags["on-behalf-of"] === "string";
    answer({
      advanced: true,
      enqueued: true,
      message_id: messageId,
      to_stage: "answered",
      answered_by: {
        actor_kind: delegated ? "delegate" : "human",
        actor_id: flags["actor-id"],
        on_behalf_of: delegated ? flags["on-behalf-of"] : null,
        authority_ref: delegated ? flags["authority-ref"] : null,
      },
    });
    break;
  }
  case "run show": {
    const run = state.runs[flags["run-id"]];
    if (run === undefined) {
      refuse("RunNotFound", `no run '${flags["run-id"]}'`);
    }
    answer({
      run: { run_id: flags["run-id"], status: run.status },
      delegation_record: null,
      sessions: [],
    });
    break;
  }
  case "run close": {
    const run = state.runs[flags["run-id"]];
    if (run === undefined) {
      refuse("RunNotFound", `no run '${flags["run-id"]}'`);
    }
    const from = run.status;
    run.status = flags.outcome;
    answer({
      run_id: flags["run-id"],
      from,
      to: flags.outcome,
      actor_id: flags["actor-id"],
      writer_epoch: 1,
    });
    break;
  }
  default:
    process.stderr.write(`stand-in continuo: '${verb}' is not a verb this stand-in answers\n`);
    process.exit(2);
}
