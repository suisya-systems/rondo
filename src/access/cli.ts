/**
 * The operator's command line: the three doors, and the escape hatch.
 *
 * Before this module the machine worked and nobody could reach it. Starting a
 * lap meant writing a throwaway `tsconfig`, compiling the tree by hand and
 * driving the composition root from a thirty-line `drive.mjs`; answering the
 * gate meant six continuo verbs typed in order with ids copied between them;
 * publishing meant remembering that continuo runs no git at all. This file is
 * those three things as `start`, `answer` and `publish` (D-0025).
 *
 * **It is deliberately thin, and the thinness is the design.** Every rule about
 * what a plan is lives in `readPlan`; every rule about what a verb's arguments
 * may be lives in `src/continuo/invoker.ts`; every rule about which transition
 * follows which lives in `src/refrain/`. What is here is argv, the order the
 * gate's verbs go in, and prose. Nothing in this file knows what a `RunPlan`
 * field means -- which is why it can be minimal without being a second place
 * that has to be kept true.
 *
 * **The layer's rule still holds.** `src/access/` may reach the loop and the
 * loop may never reach back, so nothing under `src/refrain/` imports this. The
 * one external capability the operator's surface needs beyond argv and a file
 * read -- spawning `git` and `gh` -- is not here either: it is in
 * `./forge.ts`, so the boundary test can say that *this* module cannot spell a
 * push (D-0025 rule 6).
 */
import { readFileSync } from "node:fs";
import { isAbsolute } from "node:path";
import { parseArgs } from "node:util";

import {
  ackGate,
  answerGate,
  closeRun,
  deliverGate,
  presentGate,
  showGate,
  startContinuo,
  type VerifiedContinuo,
} from "../continuo/invoker.js";
import type { ContinuoResult } from "../continuo/protocol.js";
import { type RunPlan, readPlan } from "../refrain/plan.js";
import type { LoopPolicy } from "../refrain/policy.js";
import type { IterationRecord, JsonRecord } from "../store/records.js";
import { type IterationStore, openIterationStore } from "../store/sqlite.js";
import { abandon, admit, conductorPorts, resume } from "./conductor.js";
import { asciiEscape, consoleSeams, relayUpstream } from "./console.js";
import {
  inspectPushTarget,
  openPullRequest,
  type PushTargetInspection,
  pushTopicBranch,
} from "./forge.js";

/**
 * The whole surface on one screen.
 *
 * ASCII only, and asserted so by `test/access/cli.test.ts`. That is D-0004 and
 * it is not decoration: the Windows cell's console may be cp932, where a
 * character it cannot encode crashes the writer rather than printing badly, and
 * vitest captures stdout through a UTF-8 path -- so a test that reads this
 * string is the only thing that catches an em-dash before an operator does.
 */
export const USAGE = `rondo - the operator surface for one lap at a time

  rondo start --plan FILE [--run-id ID] [--topic-branch NAME]
              [--workspace PATH] [--prompt TEXT]
                          take one request and run a lap, and stop at the gate
  rondo answer            show the gate that is waiting for a person
  rondo answer --actor-id ID --body=TEXT
                          answer it, and settle the iteration. Write --body
                          with an equals sign: an answer may begin with a dash
  rondo publish --repo OWNER/NAME --actor-id ID [--remote NAME] [--dry-run]
                [--allow-remote-mismatch]
                          push the branch, open the pull request, close the run.
                          Refuses before it prints when the workspace cannot
                          push where the plan says, or when the push remote and
                          --repo name different repositories
  rondo abandon --iteration-id ID --reason TEXT
                          end an iteration rondo cannot finish

environment:
  RONDO_CONTINUO_CLI  absolute path to continuo's built dist/cli.js
  RONDO_STORE         absolute path to rondo's own iteration database
  RONDO_APPROVER      the one identity allowed to answer a gate or publish

rondo never merges a pull request, and nothing here runs unless you typed it.
`;

/**
 * The policy `start` runs under, and why it is not `CONSERVATIVE_POLICY`.
 *
 * `CONSERVATIVE_POLICY` is `ask_every_iteration`, which `nextStep` refuses
 * *before a row exists* -- correctly, and by design (D-0019 rule 9). It is the
 * right default for a library whose caller has not said otherwise, and it
 * cannot be the value a command called `start` runs under, because under it
 * `start` never starts. So the surface states its own: one iteration, and a
 * human before anything lands, which is what a gate already guarantees.
 *
 * The reason this is three lines of policy rather than a flag is D-0012:
 * `maxIterations` above one would authorise a second iteration, and nothing in
 * lap 1 can allocate the second `(run id, topic branch, workspace)` triple it
 * would need.
 */
const START_POLICY: LoopPolicy = Object.freeze({
  autonomy: "ask_before_landing",
  maxIterations: 1,
});

const STORE_ENV = "RONDO_STORE";
const APPROVER_ENV = "RONDO_APPROVER";

/** The remote a push goes to when the operator does not name one. */
const DEFAULT_REMOTE = "origin";

/**
 * The one gate outcome that means a person answered.
 *
 * continuo reaches it itself, as `actor_kind: "system"`, when the forwarded
 * relay is acked -- so it is the only outcome that records an answer having
 * been carried all the way out. The other three (`withdrawn`, `expired`,
 * `unanswerable`) also close a gate and also close the iteration, and none of
 * them is a person saying yes.
 */
const APPROVED_OUTCOME = "answered_and_forwarded";

/**
 * Whether an iteration records a person having actually approved the work.
 *
 * A predicate rather than an inline comparison because it is the check that
 * stands between "a gate ended" and "a person said yes", and those are not the
 * same fact: `withdrawn`, `expired` and `unanswerable` each close a gate and
 * each close the iteration. Publishing on one of them would push the work and
 * open a pull request whose body says a human approved it -- rondo making a
 * false statement about somebody else.
 */
export function approvedForPublication(record: IterationRecord): boolean {
  return record.status === "closed" && record.gateOutcome === APPROVED_OUTCOME;
}

/** One command, as the parser understood it. Pure: this type holds no I/O. */
export interface ParsedCommand {
  readonly command: "start" | "answer" | "publish" | "abandon" | "help";
  readonly planFile: string | null;
  readonly runId: string | null;
  readonly topicBranch: string | null;
  readonly workspace: string | null;
  readonly prompt: string | null;
  readonly iterationId: string | null;
  readonly actorId: string | null;
  readonly body: string | null;
  readonly repo: string | null;
  readonly remote: string | null;
  readonly reason: string | null;
  readonly dryRun: boolean;
  readonly allowRemoteMismatch: boolean;
}

/** A command rondo understood, or the first reason it did not. */
export type ParseOutcome =
  | { readonly kind: "parsed"; readonly parsed: ParsedCommand }
  | { readonly kind: "refused"; readonly reason: string };

const FLAGS = {
  plan: { type: "string" },
  "run-id": { type: "string" },
  "topic-branch": { type: "string" },
  workspace: { type: "string" },
  prompt: { type: "string" },
  "iteration-id": { type: "string" },
  "actor-id": { type: "string" },
  body: { type: "string" },
  repo: { type: "string" },
  remote: { type: "string" },
  reason: { type: "string" },
  "dry-run": { type: "boolean" },
  "allow-remote-mismatch": { type: "boolean" },
} as const;

const COMMANDS = ["start", "answer", "publish", "abandon"] as const;

/**
 * Which flags each command actually reads.
 *
 * **A flag a command ignores is worse than one it refuses**, and this table is
 * what makes the difference. `--dry-run` is read only by `publish`; without
 * this check `rondo answer --body=approve --dry-run` would answer the gate and
 * close the iteration while its author believed they were previewing, and
 * `rondo start --dry-run` would spawn a real worker and spend real money. The
 * same reasoning covers the quieter cases -- `--repo` on `answer`, `--plan` on
 * `publish` -- where a value silently doing nothing reads on the command line
 * as though it did something.
 */
const FLAGS_BY_COMMAND: Readonly<Record<string, readonly string[]>> = {
  start: ["plan", "run-id", "topic-branch", "workspace", "prompt", "iteration-id"],
  answer: ["actor-id", "body"],
  publish: ["repo", "actor-id", "remote", "iteration-id", "dry-run", "allow-remote-mismatch"],
  abandon: ["iteration-id", "reason"],
};

/**
 * argv to a command, or the reason it will not read. Total; never throws.
 *
 * `parseArgs` in strict mode, which buys the refusal of an unknown flag for
 * free -- and a typo'd flag silently ignored is how an operator publishes to
 * the wrong remote while reading a command line that looks right.
 */
export function parseCommand(argv: readonly string[]): ParseOutcome {
  const [command, ...rest] = argv;
  if (command === undefined || command === "--help" || command === "-h" || command === "help") {
    return { kind: "parsed", parsed: emptyCommand("help") };
  }
  if (!(COMMANDS as readonly string[]).includes(command)) {
    return {
      kind: "refused",
      reason: `'${command}' is not a rondo command. The commands are ${COMMANDS.join(", ")}.`,
    };
  }

  let values: Record<string, string | boolean | undefined>;
  let positionals: readonly string[];
  try {
    const parsed = parseArgs({
      args: [...rest],
      options: FLAGS,
      strict: true,
      allowPositionals: true,
    });
    values = parsed.values;
    positionals = parsed.positionals;
  } catch (error) {
    return { kind: "refused", reason: error instanceof Error ? error.message : String(error) };
  }
  const permitted = FLAGS_BY_COMMAND[command] ?? [];
  for (const given of Object.keys(values)) {
    if (!permitted.includes(given)) {
      return {
        kind: "refused",
        reason:
          `'--${given}' is not a flag of '${command}'. rondo refuses it rather than ignoring it, ` +
          `because a flag that reads as though it did something is worse than one that is ` +
          `rejected. '${command}' takes: ${permitted.map((flag) => `--${flag}`).join(", ")}.`,
      };
    }
  }
  if (positionals.length > 0) {
    return {
      kind: "refused",
      reason:
        `'${String(positionals[0])}' is an extra argument to '${command}'. Every value rondo ` +
        "takes is named by a flag, so a bare word is a quoting mistake rather than a value.",
    };
  }

  const text = (name: string): string | null => {
    const value = values[name];
    return typeof value === "string" ? value : null;
  };

  return {
    kind: "parsed",
    parsed: {
      command: command as ParsedCommand["command"],
      planFile: text("plan"),
      runId: text("run-id"),
      topicBranch: text("topic-branch"),
      workspace: text("workspace"),
      prompt: text("prompt"),
      iterationId: text("iteration-id"),
      actorId: text("actor-id"),
      body: text("body"),
      repo: text("repo"),
      remote: text("remote"),
      reason: text("reason"),
      dryRun: values["dry-run"] === true,
      allowRemoteMismatch: values["allow-remote-mismatch"] === true,
    },
  };
}

function emptyCommand(command: ParsedCommand["command"]): ParsedCommand {
  return {
    command,
    planFile: null,
    runId: null,
    topicBranch: null,
    workspace: null,
    prompt: null,
    iterationId: null,
    actorId: null,
    body: null,
    repo: null,
    remote: null,
    reason: null,
    dryRun: false,
    allowRemoteMismatch: false,
  };
}

/** Write one line of rondo's own words, escaped like every other line. */
function say(line: string): void {
  consoleSeams.write(`${asciiEscape(line)}\n`);
}

/** Write one refusal of rondo's own. Exit status 2 goes with these. */
function refuse(line: string): number {
  consoleSeams.writeError(`${asciiEscape(line)}\n`);
  return 2;
}

/**
 * Turn one continuo outcome into an exit status, having said what it was.
 *
 * The three families are kept apart because they are three different things for
 * an operator to do: a refusal is continuo declining, which is usually the
 * operator's next move; a defect or a protocol break is rondo's problem; a
 * timeout is neither and may have left work in flight.
 */
function relayFailure(verb: string, result: ContinuoResult<unknown>): number {
  switch (result.kind) {
    case "refused":
      // continuo's own diagnosis, under its own error class. The operator's
      // next move is usually in this sentence.
      relayUpstream(`continuo ${verb} refused (${result.errorClass})`, result.message);
      return 2;
    case "refusedInProse":
      // An argparse-level refusal, which is prose rather than a document.
      // Relayed verbatim: rondo does not parse it (D-0015 rule 7).
      relayUpstream(`continuo ${verb} refused`, result.text);
      return 2;
    case "timedOut":
      // rondo's ceiling killed the CLI and not whatever it had started, so this
      // is the one failure that may have left work running.
      relayUpstream(`continuo ${verb} timed out`, result.reason);
      return 1;
    case "protocolRefusal":
    case "invokerDefect":
      relayUpstream(`continuo ${verb} could not be read`, result.reason);
      return 1;
    default:
      // `answered` -- the caller checked and this is unreachable, but a fallthrough
      // that returned 0 would be a failure path reporting success.
      relayUpstream(
        `continuo ${verb}`,
        "rondo asked for a failure to be relayed and got an answer.",
      );
      return 1;
  }
}

/** What one pass over the gate did, or why it stopped. */
export type WalkOutcome =
  | { readonly kind: "walked"; readonly closed: boolean }
  | { readonly kind: "failed"; readonly status: number };

/** The ports `walkGate` drives, injected so a test can watch the order. */
export interface GateVerbs {
  readonly present: typeof presentGate;
  readonly deliver: typeof deliverGate;
  readonly ack: typeof ackGate;
  readonly answer: typeof answerGate;
  readonly show: typeof showGate;
}

/** The real ones. */
export const GATE_VERBS: GateVerbs = {
  present: presentGate,
  deliver: deliverGate,
  ack: ackGate,
  answer: answerGate,
  show: showGate,
};

/** Everything one pass over the gate needs. */
export interface WalkRequest {
  readonly db: string;
  readonly gateId: string;
  readonly destinationDir: string;
  readonly holder: string;
  readonly actorId: string;
  readonly body: string;
}

/**
 * Carry one answer from a person to a closed gate, in continuo's own verbs.
 *
 * Six verbs on the longest path -- present, deliver, ack, answer, deliver, ack
 * -- and the shape of that sequence is not arbitrary. `present` enqueues the
 * relay and **does not move the stage**; the ack of that relay is what moves it
 * to `presented`, which is the only stage `answer` may be called from. `answer`
 * is then one verb doing two writes: it records the advance and enqueues the
 * *forwarded* relay, whose ack closes the gate `answered_and_forwarded`. That
 * outcome is continuo's own, written as `actor_kind: "system"`, and is not in
 * `gate close`'s vocabulary at all -- nobody decides it -- which is why the walk
 * ends at an ack and never at a close.
 *
 * **It resumes from the stage continuo reports, and never replays from the
 * start.** A walk that always began at `present` would be refused
 * `InadmissibleTransitionRefused` the moment it was retried, which is exactly
 * when a person most needs it to work. And **every message id it uses is read
 * out of the payload that produced it**, never composed from the gate id: the
 * ids are continuo's to spell, and a computed one is a guess that happens to be
 * right until it is not.
 */
export async function walkGate(
  continuo: VerifiedContinuo,
  request: WalkRequest,
  verbs: GateVerbs = GATE_VERBS,
): Promise<WalkOutcome> {
  const observed = await verbs.show(continuo, { db: request.db, gateId: request.gateId });
  if (observed.kind !== "answered") {
    return { kind: "failed", status: relayFailure("gate show", observed) };
  }
  const gate = observed.payload;
  if (gate.outcome !== null) {
    say(
      `Gate ${gate.gateId} is already closed as '${gate.outcome}'. Your answer was not sent, ` +
        "and nothing was written.",
    );
    return { kind: "walked", closed: true };
  }

  let stage = gate.stage;

  // From 'received': enqueue the relay, deliver it, and ack it. The ack is what
  // moves the gate to 'presented'; the present alone does not.
  if (stage === "received") {
    const presented = await verbs.present(continuo, { db: request.db, gateId: request.gateId });
    if (presented.kind !== "answered") {
      return { kind: "failed", status: relayFailure("gate present", presented) };
    }
    say(
      `  gate present   message ${presented.payload.messageId} (enqueued: ${String(presented.payload.enqueued)})`,
    );

    const delivered = await deliverOnce(continuo, request, verbs);
    if (delivered !== null) {
      return { kind: "failed", status: delivered };
    }

    const acked = await verbs.ack(continuo, {
      db: request.db,
      messageId: presented.payload.messageId,
      actorId: request.actorId,
    });
    if (acked.kind !== "answered") {
      return { kind: "failed", status: relayFailure("gate ack", acked) };
    }
    stage = acked.payload.toStage;
    say(`  gate ack       stage is now '${stage}'`);
  }

  if (stage !== "presented" && stage !== "answered") {
    return {
      kind: "failed",
      status: refuse(
        `Gate ${gate.gateId} is at stage '${stage}', and an answer is carried from 'presented' ` +
          "or 'answered'. Nothing was written.",
      ),
    };
  }

  // `answer` from 'presented', or re-issued from 'answered'. Re-issuing the
  // identical body is idempotent and hands back the forwarded relay's id, which
  // is how a walk interrupted after the answer finds the id it has to ack
  // without composing one.
  const answered = await verbs.answer(continuo, {
    db: request.db,
    gateId: request.gateId,
    body: request.body,
    actorId: request.actorId,
  });
  if (answered.kind !== "answered") {
    return { kind: "failed", status: relayFailure("gate answer", answered) };
  }
  say(
    `  gate answer    forwarded relay ${answered.payload.messageId} ` +
      `(advanced: ${String(answered.payload.advanced)})`,
  );

  const deliveredAgain = await deliverOnce(continuo, request, verbs);
  if (deliveredAgain !== null) {
    return { kind: "failed", status: deliveredAgain };
  }

  const finalAck = await verbs.ack(continuo, {
    db: request.db,
    messageId: answered.payload.messageId,
    actorId: request.actorId,
  });
  if (finalAck.kind !== "answered") {
    return { kind: "failed", status: relayFailure("gate ack", finalAck) };
  }
  say(
    `  gate ack       stage is now '${finalAck.payload.toStage}'` +
      (finalAck.payload.closed ? ", and the gate is closed" : ""),
  );
  return { kind: "walked", closed: finalAck.payload.closed };
}

/** One delivery pass. Null when it worked; an exit status when it did not. */
async function deliverOnce(
  continuo: VerifiedContinuo,
  request: WalkRequest,
  verbs: GateVerbs,
): Promise<number | null> {
  const delivered = await verbs.deliver(continuo, {
    db: request.db,
    destinationDir: request.destinationDir,
    holder: request.holder,
  });
  if (delivered.kind !== "answered") {
    return relayFailure("gate deliver", delivered);
  }
  say(
    `  gate deliver   ${String(delivered.payload.deliveredMessageIds.length)} message(s) to ` +
      `'${delivered.payload.recipient}' (epoch ${String(delivered.payload.epoch)})`,
  );
  return null;
}

/** Print a conductor's report, whichever verb produced it. */
function sayReport(report: {
  readonly iterationId: string | null;
  readonly status: string | null;
  readonly lines: readonly string[];
}): void {
  if (report.iterationId !== null) {
    say(`iteration '${report.iterationId}' is ${report.status ?? "in an unnamed state"}`);
  }
  for (const line of report.lines) {
    say(`  ${line}`);
  }
}

/**
 * Read the plan file, apply the per-run overrides, and hand it to `readPlan`.
 *
 * **rondo gains no configuration layer here** (D-0019 rule 3 still holds). The
 * file is `planPayload`'s own JSON, `readPlan` is its only reader, and this
 * function neither defaults a field nor infers one: what it does is overwrite
 * at most four values a person changes per run, and rewrite `parties.grantee`
 * to the effective run id -- which is the only value `runPlan` permits it to
 * have, and the field the dogfood record shows costs a whole iteration when it
 * is wrong.
 *
 * Because the format is `planPayload`'s inverse, the `plan` column of any past
 * iteration row is a valid plan file. That is the whole of rondo's answer to
 * "where do thirty-two fields come from": from the last run, or from the
 * runbook's worked example.
 */
function loadPlan(parsed: ParsedCommand): { plan: RunPlan } | { refusal: string } {
  if (parsed.planFile === null) {
    return { refusal: "start needs --plan FILE, naming the JSON plan to run." };
  }
  let raw: string;
  try {
    raw = readFileSync(parsed.planFile, "utf8");
  } catch (error) {
    return {
      refusal: `The plan file could not be read: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  let document: unknown;
  try {
    document = JSON.parse(raw);
  } catch (error) {
    return {
      refusal: `The plan file is not JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (document === null || typeof document !== "object" || Array.isArray(document)) {
    return { refusal: "The plan file must hold a JSON object." };
  }

  const payload = { ...(document as JsonRecord) };
  if (parsed.runId !== null) {
    payload["run_id"] = parsed.runId;
  }
  if (parsed.topicBranch !== null) {
    payload["topic_branch"] = parsed.topicBranch;
  }
  if (parsed.workspace !== null) {
    payload["workspace"] = parsed.workspace;
  }
  if (parsed.prompt !== null) {
    payload["prompt"] = parsed.prompt;
  }

  // `parties.grantee` must equal `runId`: the conductor classifies under the run
  // id, so a different grantee is answered `grantee_mismatch` -- an *answered*
  // classification that ends the iteration at `abandoned` after the row is
  // reserved and the lock taken. `runPlan` refuses it by name, and rewriting it
  // here means an operator who overrode `--run-id` never meets that refusal.
  const parties = payload["parties"];
  const runId = payload["run_id"];
  if (
    parties !== null &&
    typeof parties === "object" &&
    !Array.isArray(parties) &&
    typeof runId === "string"
  ) {
    payload["parties"] = { ...(parties as JsonRecord), grantee: runId };
  }

  const outcome = readPlan(payload);
  if (outcome.kind !== "planned") {
    return { refusal: `The plan was refused: ${outcome.reason}` };
  }
  return { plan: outcome.plan };
}

/**
 * The identity check both answering and publishing pass through.
 *
 * **An allowlist of size one, read from the environment, checked before any
 * verb runs.** It keeps the half of D-0020 rule 2 that a command line can keep
 * -- rondo acts for a named person and refuses to act for an unnamed one -- and
 * it cannot keep the other half: there is no OIDC subject here, so the identity
 * is asserted by whoever is typing. That is a stated reduction scoped to lap 1,
 * and the thing that ends it is the adapter D-0020 already specifies.
 *
 * Exported so it can be tested. The end-to-end walk cannot reach its refusals:
 * by the time an operator gets an actor wrong, the interesting states are gone.
 */
export function approvedActor(
  parsed: ParsedCommand,
  environment: Readonly<Record<string, string | undefined>>,
): { actorId: string } | { refusal: string } {
  if (parsed.actorId === null) {
    return { refusal: "This command needs --actor-id ID, naming who is acting." };
  }
  const approver = environment[APPROVER_ENV];
  if (approver === undefined || approver === "") {
    return {
      refusal:
        `${APPROVER_ENV} is not set. It names the one identity allowed to answer a gate or ` +
        "publish, and rondo will not act for an unnamed person.",
    };
  }
  if (parsed.actorId !== approver) {
    return {
      refusal:
        `--actor-id is '${parsed.actorId}' and ${APPROVER_ENV} is '${approver}'. They must be ` +
        "the same identity.",
    };
  }
  // The shape continuo requires of an identifier, checked **here** rather than
  // left to the verb that first carries it. An identity with whitespace in it
  // passes the allowlist and is then refused at the argument boundary -- after
  // `publish` has already pushed and opened a pull request, or after `answer`
  // has already presented and delivered. Rondo refuses before a process starts
  // when it can, and this is one of the places it can.
  if (/\s/.test(parsed.actorId) || parsed.actorId.startsWith("-")) {
    return {
      refusal:
        `--actor-id is '${parsed.actorId}', and continuo's identifiers carry no whitespace and ` +
        "do not begin with a dash. It would be refused partway through, after the effects before " +
        "it had already happened.",
    };
  }
  return { actorId: parsed.actorId };
}

/** Open rondo's own store, or say why it cannot be opened. */
function openStore(
  environment: Readonly<Record<string, string | undefined>>,
): { store: IterationStore } | { refusal: string } {
  const path = environment[STORE_ENV];
  if (path === undefined || path === "") {
    return {
      refusal: `${STORE_ENV} is not set. It is the absolute path to rondo's iteration database, which is created on first use.`,
    };
  }
  // **Durable and absolute, checked before the file is opened.** `:memory:` is
  // SQLite's in-memory sentinel: `start` would run a real lap, spend real money
  // and then lose the row when the process exits, so the next `answer` would
  // report that nothing is waiting while a gate stood open. A relative path is
  // the quieter version of the same failure -- it names a different database
  // from each directory a command is run in, so the single-flight invariant
  // would hold per directory rather than per machine.
  if (path === ":memory:" || path.startsWith("file::memory:")) {
    return {
      refusal:
        `${STORE_ENV} is '${path}', which is SQLite's in-memory database. rondo's commands are ` +
        "separate processes and the row has to outlive each of them, so an in-memory store would " +
        "lose a lap that had already run.",
    };
  }
  if (!isAbsolute(path)) {
    return {
      refusal:
        `${STORE_ENV} is '${path}', and it must be an absolute path. A relative one names a ` +
        "different database from each directory a command is run in, and single-flight is an " +
        "invariant of one database.",
    };
  }
  try {
    return { store: openIterationStore(path) };
  } catch (error) {
    return {
      refusal: `The iteration store at ${path} could not be opened: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * The entry point.
 *
 * Returns an exit status and **never calls `process.exit`**, so that the whole
 * of the surface is reachable from a test: a function that exits cannot be
 * asserted against, and the launcher in `bin/rondo.mjs` is what turns this
 * number into one.
 *
 * The statuses are the three continuo itself uses, for the reason it uses them:
 * 0 succeeded, 2 something declined, 1 something broke.
 */
export async function main(
  argv: readonly string[],
  environment: Readonly<Record<string, string | undefined>>,
): Promise<number> {
  const parsedOutcome = parseCommand(argv);
  if (parsedOutcome.kind === "refused") {
    consoleSeams.writeError(`${asciiEscape(parsedOutcome.reason)}\n`);
    consoleSeams.writeError(USAGE);
    return 2;
  }
  const parsed = parsedOutcome.parsed;
  if (parsed.command === "help") {
    consoleSeams.write(USAGE);
    return 0;
  }

  const opened = openStore(environment);
  if ("refusal" in opened) {
    return refuse(opened.refusal);
  }
  const store = opened.store;

  // **`abandon` is dispatched before continuo is started, and that ordering is
  // the whole of its usefulness.** It is the way out of a row that is holding
  // the single-flight lock with nothing able to release it, and one of the
  // states that produces such a row is a continuo that will not start or no
  // longer matches the pin. Requiring a working continuo to recover from a
  // broken one would make the escape hatch unreachable exactly when it is
  // needed. It drives no continuo verb -- that is D-0019 rule 11's design, not
  // an accident here -- so there is nothing for it to need.
  if (parsed.command === "abandon") {
    return await commandAbandon(parsed, conductorPorts(unverifiedContinuo(), store));
  }

  const startup = await startContinuo(environment);
  if (startup.kind === "refused") {
    return refuse(`continuo is not usable: ${startup.reason}`);
  }
  const continuo = startup.continuo;
  const ports = conductorPorts(continuo, store);

  switch (parsed.command) {
    case "start":
      return await commandStart(parsed, ports, continuo);
    case "answer":
      return await commandAnswer(parsed, environment, store, ports, continuo);
    default:
      return await commandPublish(parsed, environment, store, continuo);
  }
}

/** Door one: take one request and run a lap. */
async function commandStart(
  parsed: ParsedCommand,
  ports: ReturnType<typeof conductorPorts>,
  continuo: VerifiedContinuo,
): Promise<number> {
  const loaded = loadPlan(parsed);
  if ("refusal" in loaded) {
    return refuse(loaded.refusal);
  }
  const plan = loaded.plan;

  say(`plan ok: ${String(Object.keys(plan).length)} fields`);
  say(`continuo verified at revision ${continuo.revision}`);
  // The iteration id defaults to the run id: a copy of an identifier the
  // operator already chose, not a mint. rondo allocates nothing (D-0012).
  const iterationId = parsed.iterationId ?? plan.runId;
  say(`starting iteration '${iterationId}'; the lap is the step that is slow`);

  const report = await admit(ports, plan, START_POLICY, iterationId);
  sayReport(report);
  if (report.status === "awaiting_human") {
    say("");
    say("A person has to answer this before anything lands. Next: rondo answer");
    return 0;
  }
  if (report.iterationId === null) {
    return 2;
  }
  return report.status === "closed" ? 0 : 1;
}

/** Door two: see what is waiting, and answer it. */
async function commandAnswer(
  parsed: ParsedCommand,
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  ports: ReturnType<typeof conductorPorts>,
  continuo: VerifiedContinuo,
): Promise<number> {
  const live = await store.readLive();
  if (live.kind === "absent") {
    say("Nothing is waiting. No iteration is live.");
    return 0;
  }
  if (live.kind === "unreadable") {
    return refuse(`The live iteration row would not read: ${live.reason}`);
  }
  const record = live.record;
  if (record.gateId === null) {
    say(`iteration '${record.id}' is ${record.status}, and no gate is open on it.`);
    say("There is nothing for a person to answer yet.");
    return 0;
  }

  const observed = await showGate(continuo, { db: planField(record, "db"), gateId: record.gateId });
  if (observed.kind !== "answered") {
    return relayFailure("gate show", observed);
  }
  const gate = observed.payload;

  if (parsed.body === null) {
    // The reading mode: what is being asked, and the command that answers it.
    say(`iteration '${record.id}' is ${record.status}`);
    say(`run     ${record.runId ?? "(none recorded)"}`);
    say(`gate    ${gate.gateId}  (${gate.gateType})  stage '${gate.stage}'`);
    say(`why     ${gate.rationale}`);
    say(`options ${gate.options}`);
    say("");
    say("to answer:");
    say(`  rondo answer --actor-id YOU --body="your answer"`);
    return 0;
  }

  const actor = approvedActor(parsed, environment);
  if ("refusal" in actor) {
    return refuse(actor.refusal);
  }
  if (parsed.body === "") {
    return refuse(
      "--body is empty. An answer is carried byte for byte, and there is nothing to carry.",
    );
  }

  say(`gate ${gate.gateId} is at stage '${gate.stage}'`);
  const walked = await walkGate(continuo, {
    db: planField(record, "db"),
    gateId: gate.gateId,
    destinationDir: planField(record, "endpoint_destination_dir"),
    holder: planField(record, "lease_claimant_id"),
    actorId: actor.actorId,
    body: parsed.body,
  });
  if (walked.kind === "failed") {
    return walked.status;
  }

  // `resume` is what moves rondo's own row. It is idempotent by construction,
  // so a walk that half-failed and was retried settles here exactly once.
  const report = await resume(ports, record.id);
  sayReport(report);
  if (report.status === "closed") {
    say("");
    // The id is spelled out because closing the iteration is what stops it
    // being the live one, so `publish` can no longer find it on its own. A
    // hint the operator cannot paste is not a hint.
    say(
      `Next: rondo publish --iteration-id ${record.id} --repo OWNER/NAME --actor-id ${actor.actorId}`,
    );
  }
  return 0;
}

/** A forge repository as `gh` names one: `owner/name`. */
export interface ForgeSlug {
  readonly owner: string;
  readonly name: string;
}

/** The characters GitHub allows in an owner or a repository name. */
const SLUG_SEGMENT = /^[A-Za-z0-9._-]+$/;

/** `owner/name`, or null for anything that is not exactly that. */
export function parseForgeSlug(text: string): ForgeSlug | null {
  const parts = text.split("/");
  if (parts.length !== 2) {
    return null;
  }
  const [owner, name] = parts;
  if (owner === undefined || name === undefined) {
    return null;
  }
  if (!SLUG_SEGMENT.test(owner) || !SLUG_SEGMENT.test(name)) {
    return null;
  }
  return { owner, name };
}

/**
 * The `owner/name` a git remote URL points at, when it points at a forge.
 *
 * **Null is an answer, and a common one.** A remote may be a local path, a bare
 * repository on the same disk, a `file://` URL or a host whose paths are not
 * `owner/name` at all; none of those is a repository `gh pr create --repo` can
 * be about, and none of them is malformed. The caller distinguishes "this names
 * a different repository" from "rondo cannot tell what this names", because the
 * two deserve different sentences even though both stop a publish.
 *
 * Both spellings git accepts are read: the scp-like `git@host:owner/name.git`
 * and the URL forms `ssh://`, `git://`, `http://` and `https://`.
 */
export function slugFromRemoteUrl(url: string): ForgeSlug | null {
  const trimmed = url.trim();
  let host: string | null = null;
  let path: string | null = null;
  const scpLike = /^[A-Za-z0-9._-]+@([A-Za-z0-9._-]+):(?!\/)(.+)$/.exec(trimmed);
  if (scpLike !== null) {
    host = scpLike[1] ?? null;
    path = scpLike[2] ?? null;
  } else if (/^(?:ssh|git|https?):\/\//.test(trimmed)) {
    const afterScheme = trimmed.replace(/^[A-Za-z][A-Za-z0-9+.-]*:\/\//, "");
    const slash = afterScheme.indexOf("/");
    if (slash !== -1) {
      // Userinfo off the front, port off the back: what is left is the host,
      // which is half of the identity of a repository and was the half a
      // slug-only reading threw away.
      const authority = afterScheme.slice(0, slash);
      const at = authority.lastIndexOf("@");
      host = (at === -1 ? authority : authority.slice(at + 1)).split(":")[0] ?? null;
      path = afterScheme.slice(slash + 1);
    }
  }
  if (host === null || path === null) {
    return null;
  }
  // **The host is checked, not merely parsed.** `--repo OWNER/NAME` is passed
  // to the forge as a github.com repository, so a remote on some other host
  // whose path happens to read as `owner/name` is a different repository
  // wearing the same name -- and comparing the slugs alone would call the push
  // and the pull request agreed when they are not.
  if (!GITHUB_HOSTS.has(host.toLowerCase())) {
    return null;
  }
  const cleaned = path
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\.git$/, "");
  return parseForgeSlug(cleaned);
}

/**
 * The hosts `--repo OWNER/NAME` can be about.
 *
 * `gh` reaches github.com unless it is told otherwise, and rondo's `--repo` is
 * two segments with no host in them. An enterprise host is therefore not
 * something this can recognise, and it is refused as a mismatch the operator
 * can override rather than being guessed at.
 */
const GITHUB_HOSTS: ReadonlySet<string> = new Set(["github.com", "www.github.com"]);

/**
 * A remote URL as it may be printed: any credentials in it replaced.
 *
 * A push URL can carry a token in its userinfo (`https://user:TOKEN@host/...`),
 * and every place rondo mentions a remote URL is a line an operator reads, a
 * terminal scrolls back and a captured log keeps. Refusing to print the URL at
 * all would remove the one fact that makes the refusal actionable, so what is
 * printed is the URL without the part that is a secret.
 */
function redactRemoteUrl(url: string): string {
  return url.replace(/^([A-Za-z][A-Za-z0-9+.-]*:\/\/)[^/@]*@/, "$1<redacted>@");
}

/** Whether two slugs name the same repository. GitHub is case-insensitive. */
function sameRepository(left: ForgeSlug, right: ForgeSlug): boolean {
  return (
    left.owner.toLowerCase() === right.owner.toLowerCase() &&
    left.name.toLowerCase() === right.name.toLowerCase()
  );
}

/** What publish may do, once the workspace has been asked about it. */
export type PreflightOutcome =
  | {
      readonly kind: "ready";
      /** What `gh pr create --head` is given, and what the plan prints. */
      readonly headRef: string;
      /** Things the operator has to know before running this, and none of them fatal. */
      readonly warnings: readonly string[];
    }
  | { readonly kind: "refused"; readonly reason: string };

/** What preflight decides over. Every field is already known before git is asked. */
export interface PreflightInput {
  readonly repo: string;
  readonly remote: string;
  readonly workspace: string;
  readonly topicBranch: string;
  readonly allowRemoteMismatch: boolean;
  readonly inspection: PushTargetInspection;
}

/**
 * Whether the three legs `publish` is about to print can actually run.
 *
 * **This is the defect this function exists for**, measured on 2026-09-06: a
 * `--dry-run` printed `git push origin dogfood-001` for a workspace with no
 * remotes configured at all, and a `gh pr create --repo suisya-systems/rondo`
 * for a branch holding a scratch repository's commits. A preview whose whole
 * purpose is to catch a mistake before the real run printed both as though they
 * would work. So the checks run **before anything is printed and whether or not
 * `--dry-run` was given**: a preview that passes where the real thing would
 * fail is the same defect in a quieter form.
 *
 * **Why a mismatch between the push remote and `--repo` is a refusal with a
 * named override, rather than either a hard equality or a warning.** Pushing to
 * a fork and opening the pull request against the upstream is a legitimate way
 * to work, so requiring equality would refuse correct usage. But the failure
 * being closed here is precisely that the two can be unrelated without anyone
 * noticing, and a warning printed above a plan that then runs is exactly the
 * "printed something that cannot work" this replaces. So: refuse by default,
 * name the flag that says "yes, they differ and I mean it", and -- because the
 * fork case is the one being kept open -- spell `--head` as `owner:branch` when
 * the override is used, since a bare branch name is read by `gh` as a branch of
 * `--repo` and would find the wrong branch or none.
 *
 * **Agreement is over the host as well as the two path segments.** `--repo`
 * names a github.com repository, so a remote on another host whose path happens
 * to read as `owner/name` is a different repository wearing the same name, and
 * it is refused as a mismatch rather than passed as an agreement.
 *
 * Pure, over what `inspectPushTarget` read. The rules are here because they are
 * rules about publishing; the process that reads a git config is in `./forge.ts`
 * because that is the only module allowed to start one.
 */
export function publishPreflight(input: PreflightInput): PreflightOutcome {
  const wanted = parseForgeSlug(input.repo);
  if (wanted === null) {
    return {
      kind: "refused",
      reason:
        `--repo is '${input.repo}', and it must be OWNER/NAME -- the repository as gh names ` +
        "one. rondo passes it to `gh pr create --repo` unchanged.",
    };
  }
  if (input.inspection.kind === "unreadable") {
    return {
      kind: "refused",
      reason:
        `rondo could not read the workspace '${input.workspace}' that publish would push from: ` +
        `${input.inspection.reason}. It stops here rather than printing a plan it cannot check.`,
    };
  }
  const inspection = input.inspection;
  if (inspection.pushUrl === null) {
    const configured =
      inspection.remotes.length === 0
        ? "It has no remotes configured at all"
        : `The remotes it has are: ${inspection.remotes.join(", ")}`;
    return {
      kind: "refused",
      reason:
        `The workspace '${input.workspace}' has no remote '${input.remote}', so ` +
        `'git push ${input.remote} ${input.topicBranch}' cannot run. ${configured}. Name one ` +
        "that is there with --remote NAME, or add the remote to the workspace.",
    };
  }
  if (!inspection.topicBranchExists) {
    return {
      kind: "refused",
      reason:
        `The workspace '${input.workspace}' has no branch '${input.topicBranch}', which is the ` +
        "branch the iteration's plan says the lap committed on. There is nothing to push, and a " +
        "workspace that lost it is not a workspace to publish from.",
    };
  }

  const pushing = slugFromRemoteUrl(inspection.pushUrl);
  if (pushing !== null && sameRepository(pushing, wanted)) {
    return { kind: "ready", headRef: input.topicBranch, warnings: [] };
  }

  const shown = redactRemoteUrl(inspection.pushUrl);
  const difference =
    pushing === null
      ? `'${input.remote}' is '${shown}', which rondo cannot read as a github.com OWNER/NAME, ` +
        `so it cannot be shown to be the repository '${input.repo}' names`
      : `'${input.remote}' is '${shown}', which is '${pushing.owner}/${pushing.name}', and ` +
        `--repo is '${input.repo}'`;
  if (!input.allowRemoteMismatch) {
    return {
      kind: "refused",
      reason:
        `The push and the pull request would not be about the same repository: ${difference}. ` +
        "The push goes to the workspace's remote and the pull request is opened against --repo, " +
        "so publishing this way puts the branch somewhere the pull request does not look. If " +
        "that is deliberate -- pushing to a fork and opening the pull request upstream is the " +
        "usual reason -- pass --allow-remote-mismatch.",
    };
  }
  // The override was given, so the operator has said the two differ on purpose.
  // What is left is to make `gh` agree: `--head branch` names a branch of
  // `--repo`, which is not where the push went.
  if (pushing === null) {
    return {
      kind: "ready",
      headRef: input.topicBranch,
      warnings: [
        `--allow-remote-mismatch: pushing to '${shown}' and opening the pull request against ` +
          `'${input.repo}'. rondo cannot read that remote as a github.com OWNER/NAME, so the ` +
          `head is the bare branch name and the forge will look for '${input.topicBranch}' in ` +
          `'${input.repo}'. Expect the pull-request leg to fail unless it is there.`,
      ],
    };
  }
  return {
    kind: "ready",
    headRef: `${pushing.owner}:${input.topicBranch}`,
    warnings: [
      `--allow-remote-mismatch: pushing to '${pushing.owner}/${pushing.name}' and opening the ` +
        `pull request against '${input.repo}'. --head is spelled ` +
        `'${pushing.owner}:${input.topicBranch}' so that gh looks for the branch where the push ` +
        "put it.",
    ],
  };
}

/**
 * Door three: push the branch, open the pull request, close the run.
 *
 * **Every leg is the operator's, and the operator is who typed this.** Nothing
 * else in rondo reaches `./forge.ts`, no other command calls this function, and
 * there is no flag, environment variable or code path that makes any of it
 * happen without the word `publish` on a command line. Merging is not here.
 *
 * The three legs run in order and stop at the first failure, because each one
 * is the precondition of the next: there is no pull request to open for a
 * branch that did not push, and closing the run says the work landed.
 *
 * **Nothing is printed before the workspace has been asked whether the plan can
 * run.** `publishPreflight` holds the rules and says why they are there; what
 * matters here is the ordering -- the checks are ahead of the printing and
 * ahead of the `--dry-run` branch, so a preview cannot pass where the real run
 * would fail.
 */
async function commandPublish(
  parsed: ParsedCommand,
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  continuo: VerifiedContinuo,
): Promise<number> {
  if (parsed.repo === null) {
    return refuse(
      "publish needs --repo OWNER/NAME. It is the forge repository, which is the one fact " +
        "about publishing that the plan does not carry.",
    );
  }
  const actor = approvedActor(parsed, environment);
  if ("refusal" in actor) {
    return refuse(actor.refusal);
  }

  const iterationId = parsed.iterationId;
  const found = iterationId === null ? await store.readLive() : await store.read(iterationId);
  if (found.kind === "absent") {
    return refuse(
      iterationId === null
        ? "No iteration is live. Name one with --iteration-id ID to publish a closed iteration."
        : `There is no iteration '${iterationId}'.`,
    );
  }
  if (found.kind === "unreadable") {
    return refuse(`That iteration row would not read: ${found.reason}`);
  }
  const record = found.record;
  if (record.status !== "closed") {
    return refuse(
      `iteration '${record.id}' is ${record.status}, not closed. Publishing is for work a ` +
        "person has already approved at the gate.",
    );
  }
  // **A closed iteration is not an approved one.** `withdrawn`, `expired` and
  // `unanswerable` all close a gate and therefore close the iteration, and
  // none of them is a person saying yes. Publishing on any of those would push
  // the work and open a pull request whose body claims a human approved it --
  // a false statement about somebody else, written by rondo. Only the outcome
  // that continuo reaches by carrying an answer through to its forward may
  // publish.
  if (!approvedForPublication(record)) {
    return refuse(
      `iteration '${record.id}' closed at gate outcome ` +
        `'${record.gateOutcome ?? "(none recorded)"}', not '${APPROVED_OUTCOME}'. That is a gate ` +
        "that ended without a person answering it, so there is no approval to publish under.",
    );
  }

  const workspace = planField(record, "workspace");
  const topicBranch = planField(record, "topic_branch");
  const baseBranch = planField(record, "base_branch");
  const db = planField(record, "db");
  const runId = record.runId;
  if (runId === null) {
    return refuse(`iteration '${record.id}' records no run id, so there is no run to close.`);
  }
  const remote = parsed.remote ?? DEFAULT_REMOTE;
  const title = `${topicBranch}: ${firstLine(record.request)}`;
  // The plan validated before the row existed, so a blank here is a row edited
  // out of band rather than an operator's mistake -- and every leg below is
  // built from these three, so guessing past one would print a command line
  // with a hole in it.
  for (const [field, value] of [
    ["workspace", workspace],
    ["topic_branch", topicBranch],
    ["base_branch", baseBranch],
  ] as const) {
    if (value === "") {
      return refuse(
        `iteration '${record.id}' records no '${field}' in its plan, and publish is built from ` +
          "it. The row cannot be published as it stands.",
      );
    }
  }

  // **Before the plan is printed, and whether or not this is a dry run.** A
  // preview exists to catch a mistake before the real run, so a preview that
  // passes where the real thing would fail is the failure it was meant to
  // prevent (see `publishPreflight`).
  const preflight = publishPreflight({
    repo: parsed.repo,
    remote,
    workspace,
    topicBranch,
    allowRemoteMismatch: parsed.allowRemoteMismatch,
    inspection: await inspectPushTarget({ workspace, remote, topicBranch }),
  });
  if (preflight.kind === "refused") {
    return refuse(preflight.reason);
  }
  const headRef = preflight.headRef;

  say(`iteration '${record.id}' is closed; gate outcome '${record.gateOutcome ?? "(none)"}'`);
  for (const warning of preflight.warnings) {
    say("");
    say(warning);
  }
  say("");
  say("publish runs these three, in order, as you:");
  say(`  1. git -C ${workspace} push ${remote} ${topicBranch}`);
  say(`  2. gh pr create --repo ${parsed.repo} --base ${baseBranch} --head ${headRef}`);
  say(`  3. continuo run close --run-id ${runId} --outcome completed`);
  say("");
  if (parsed.dryRun) {
    say("--dry-run: nothing was run.");
    return 0;
  }

  const pushed = await pushTopicBranch({ workspace, remote, topicBranch });
  if (!reportCommand("push the branch", pushed)) {
    return 1;
  }

  const opened = await openPullRequest({
    repo: parsed.repo,
    baseBranch,
    headRef,
    title,
    body: pullRequestBody(record, runId),
  });
  if (!reportCommand("open the pull request", opened)) {
    // **The push already happened, and it is the one leg that cannot be
    // undone from here.** Re-running `publish` re-runs the push harmlessly
    // (git answers "Everything up-to-date"), but a pull request that was in
    // fact created and then failed to be reported would be refused as a
    // duplicate on the second attempt, leaving the run row open with no way
    // forward through this command. rondo does not persist how far a publish
    // got -- that would be a durable record of somebody else's state -- so it
    // says instead exactly what is left and how to do it.
    say("");
    say(`The branch '${topicBranch}' was pushed to '${remote}'; that part is done.`);
    say("If the pull request already exists, the only leg left is the run close:");
    say(
      `  ${continuo.cliPath} run close --db ${db} --run-id ${runId} ` +
        `--outcome completed --actor-id ${actor.actorId}`,
    );
    return 1;
  }

  // The close records the operator's observation that the work landed. It is
  // last because it is a claim about the other two having happened, and it is
  // not idempotent: continuo refuses a second close, on purpose.
  const closed = await closeRun(continuo, {
    db,
    runId,
    outcome: "completed",
    actorId: actor.actorId,
  });
  if (closed.kind !== "answered") {
    return relayFailure("run close", closed);
  }
  say(`run ${closed.payload.runId}: ${closed.payload.from} -> ${closed.payload.to}`);
  say("");
  say("Published. rondo did not merge anything; that is still yours.");
  return 0;
}

/** Say what a forge command did. True when it succeeded. */
function reportCommand(
  what: string,
  outcome: {
    readonly commandLine: string;
    readonly status: number | null;
    readonly stdout: string;
    readonly stderr: string;
    readonly spawnError: string | null;
  },
): boolean {
  if (outcome.spawnError !== null) {
    relayUpstream(`rondo could not ${what}`, outcome.spawnError);
    return false;
  }
  if (outcome.status !== 0) {
    relayUpstream(
      `rondo could not ${what} (exit ${String(outcome.status)})`,
      outcome.stderr.trim(),
    );
    return false;
  }
  const said = outcome.stdout.trim();
  say(`  ok: ${outcome.commandLine}`);
  if (said !== "") {
    say(`  ${said}`);
  }
  return true;
}

/**
 * The pull request's body: what ran, under what, and what is still the human's.
 *
 * **The revision comes off the row, not off this process.** The row records the
 * continuo that actually drove the lap, committed before anything was spawned;
 * the revision this process verified at startup is whatever is installed today,
 * and the pin moves. Publishing a lap after a pin move would otherwise attribute
 * it to a build that never ran it -- which is the provenance the repository asks
 * to be recorded, replaced by a plausible wrong answer. A row with no revision
 * says so rather than borrowing one.
 */
function pullRequestBody(record: IterationRecord, runId: string): string {
  const revision = record.continuoRevision ?? "an unrecorded revision";
  return [
    record.request,
    "",
    "---",
    "",
    `Run \`${runId}\` was walked by rondo and approved by a person at the gate`,
    `(outcome \`${record.gateOutcome ?? "unknown"}\`), against continuo \`${revision}\`.`,
    "",
    "This pull request was opened by `rondo publish`, which an operator ran. Merging it is not.",
  ].join("\n");
}

/**
 * A handle that names no continuo, for the one command that drives none.
 *
 * `conductorPorts` wants a verified handle because every other port it wires
 * reaches a subprocess. `abandon` reaches none: it writes one terminal row and
 * returns (D-0019 rule 11). Handing it a handle whose paths are empty is
 * therefore not a shortcut around verification -- any verb reached through it
 * would be refused at the argument boundary before a process could start, which
 * is the property `test/continuo/invoker.test.ts` already holds open. What it
 * buys is that a stranded row can be settled on a machine whose continuo is
 * missing, broken, or no longer the pinned one.
 */
function unverifiedContinuo(): VerifiedContinuo {
  return { cliPath: "", revision: "" };
}

/** Door four, which is not a door: end an iteration rondo cannot finish. */
async function commandAbandon(
  parsed: ParsedCommand,
  ports: ReturnType<typeof conductorPorts>,
): Promise<number> {
  if (parsed.iterationId === null) {
    return refuse("abandon needs --iteration-id ID.");
  }
  if (parsed.reason === null || parsed.reason === "") {
    return refuse(
      "abandon needs --reason TEXT. The reason is the only record of why a row was settled by " +
        "hand, and a blank one makes the row unexplainable later.",
    );
  }
  const report = await abandon(ports, parsed.iterationId, parsed.reason);
  sayReport(report);
  // **`abandoned` or nothing.** A report with any other status is a settlement
  // that did not happen -- the row was absent, or the store refused the
  // terminal write and the single-flight lock is still held. Exiting 0 there
  // would tell an operator, and any script wrapping this, that a recovery
  // succeeded while the thing it was recovering from is still in place.
  if (report.status !== "abandoned") {
    return refuse(
      `iteration '${parsed.iterationId}' was not abandoned. Nothing was settled, and if it was ` +
        "holding the single-flight lock it still is.",
    );
  }
  say("");
  say(
    "rondo closed nothing upstream. If a gate is still open, closing it is yours; if the " +
      "continuo run is still open, closing it is yours.",
  );
  return 0;
}

/**
 * One field out of the plan the row carries.
 *
 * The row's `plan` is `planPayload`'s JSON, which `readPlan` validated before
 * the row existed -- so a field missing here is not an operator's mistake but a
 * row edited out of band, and the empty string it yields makes the verb below
 * refuse on an absolute-path check rather than acting on a guess.
 */
function planField(record: IterationRecord, key: string): string {
  const value = record.plan[key];
  return typeof value === "string" ? value : "";
}

/** The first line of a request, for a pull request title. */
function firstLine(text: string): string {
  const line = text.split("\n")[0] ?? "";
  return line.length > 72 ? `${line.slice(0, 69)}...` : line;
}
