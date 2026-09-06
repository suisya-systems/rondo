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
import { existsSync, readFileSync } from "node:fs";
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
import { allocate } from "../refrain/allocator.js";
import { type RunPlan, readRunPlan } from "../refrain/plan.js";
import {
  CONSERVATIVE_HOST_POLICY,
  type HostPolicy,
  hostPolicy,
  type LoopPolicy,
} from "../refrain/policy.js";
import { revisionPlan } from "../refrain/revision.js";
import type { IterationRecord, JsonRecord } from "../store/records.js";
import { type IterationStore, openIterationStore, type ReadOutcome } from "../store/sqlite.js";
import { abandon, admit, conductorPorts, resume } from "./conductor.js";
import { asciiEscape, consoleSeams, relayUpstream } from "./console.js";
import {
  inspectLapWork,
  inspectPushTarget,
  inspectTopicBranch,
  type LapFile,
  type LapWorkInspection,
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
export const USAGE = `rondo - the operator surface for delegated work

  rondo start --plan FILE --iteration-id ID [--prompt TEXT]
                          take one request and run a lap, and stop at the gate.
                          The run id, the topic branch and the workspace are
                          derived from --iteration-id; rondo mints them, so
                          there is no flag to type them
  rondo answer [--iteration-id ID]
                          show the gate that is waiting for a person. Name one
                          when more than one iteration is open
  rondo answer --actor-id ID --body=TEXT [--iteration-id ID]
                          answer it, and settle the iteration. Write --body
                          with an equals sign: an answer may begin with a dash
  rondo revise --actor-id ID --body=TEXT --run-id ID --topic-branch NAME
               --workspace PATH [--iteration-id ID]
                          answer the gate with a change to make, and run a
                          second lap that continues from the first one's
                          branch. The three identifiers are yours to choose:
                          rondo allocates none, and continuo refuses the ones
                          the first lap spent
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
  RONDO_MAX_LIVE      how many iterations may be open at once. Default 3. An
                      iteration suspended at a gate holds no worker, so this
                      bounds how many questions may wait on a person at once
  RONDO_MAX_OCCUPYING how many may be executing at once. Default 1, and raising
                      it needs continuo to allow a second concurrent lap first
  GH_HOST             the forge host --repo is on. Default: github.com

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

/**
 * The two bounds, as environment variables (D-0023 rule 12).
 *
 * Read here, once, on the way to opening the store, because this is where
 * rondo's other deployment facts are read: the database's path is already an
 * environment variable for the same reason, and one process with one bound is
 * the shape that makes the number mean anything. They are emphatically **not**
 * on `LoopPolicy`, which `admit()` takes per call -- a bound each request may
 * restate is not a bound.
 *
 * The durable, operator-editable form is D-0020's operating surface and is
 * deliberately not taken here (D-0023 rule 13).
 */
const MAX_LIVE_ENV = "RONDO_MAX_LIVE";
const MAX_OCCUPYING_ENV = "RONDO_MAX_OCCUPYING";
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
  readonly command: "start" | "answer" | "revise" | "publish" | "abandon" | "help";
  readonly planFile: string | null;
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

const COMMANDS = ["start", "answer", "revise", "publish", "abandon"] as const;

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
  // `--run-id`, `--topic-branch` and `--workspace` are gone from `start` and
  // from `revise` (D-0023 rule 9): rondo derives all three from the iteration
  // id, which is now required rather than defaulted. D-0027 typed them on
  // `revise` because no allocator existed when it was written.
  start: ["plan", "prompt", "iteration-id"],
  // `answer` gained `--iteration-id` because more than one iteration may be
  // waiting at once now, which is the whole point of D-0023.
  answer: ["actor-id", "body", "iteration-id"],
  revise: ["actor-id", "body", "iteration-id"],
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
  | {
      readonly kind: "walked";
      readonly closed: boolean;
      /**
       * Whether **this** walk carried the body to the gate.
       *
       * False exactly when the gate already had an outcome, which is a
       * successful walk that sent nothing -- the right thing to do, and a
       * result a caller must not read as "the answer landed". `answer` may
       * ignore it, because it has nothing left to do either way. `revise` may
       * not: it would otherwise start a lap whose instruction was never
       * recorded, under an outcome that may be `withdrawn` or `expired` rather
       * than anyone saying anything.
       */
      readonly answerSent: boolean;
    }
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
    return { kind: "walked", closed: true, answerSent: false };
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
  return { kind: "walked", closed: finalAck.payload.closed, answerSent: true };
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
  if (parsed.prompt !== null) {
    payload["prompt"] = parsed.prompt;
  }

  // **`--run-id`, `--topic-branch` and `--workspace` are gone, and so is the
  // `parties.grantee` rewrite that went with them** (D-0023 rule 9). All four
  // values are rondo's now: the allocator derives the triple from the iteration
  // id and fills the grantee from the run id it minted. An operator who could
  // still override one of them would be a second authority for a name the
  // capacity ledger's claim indexes rest on, which is the one thing the
  // allocator exists to prevent.
  const outcome = readRunPlan(payload);
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
  const bounds = hostPolicyOf(environment);
  if ("refusal" in bounds) {
    return bounds;
  }
  try {
    return { store: openIterationStore(path, bounds.policy) };
  } catch (error) {
    return {
      refusal: `The iteration store at ${path} could not be opened: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Which iteration a verb that used to mean "the live one" should act on.
 *
 * **The function D-0023 makes necessary.** While the bound was one, "the live
 * iteration" named a row, and `readLive()` could answer with it. Above one it
 * names nothing, and the honest answers are three rather than two: this is the
 * one, there is none, or there are several and the operator has to say which.
 * Picking the oldest would have kept every call site compiling and would have
 * silently answered somebody else's gate.
 *
 * An explicit `--iteration-id` always wins and is read by id, so a person may
 * name a terminal iteration that no longer appears in the live set at all --
 * which is what `publish` needs, since it acts on `closed` rows.
 */
async function pickWaiting(
  store: IterationStore,
  iterationId: string | null,
): Promise<
  { readonly record: IterationRecord | null; readonly note: string } | { readonly refusal: string }
> {
  if (iterationId !== null) {
    const found = await store.read(iterationId);
    if (found.kind === "absent") {
      return { refusal: `There is no iteration '${iterationId}'.` };
    }
    if (found.kind === "unreadable") {
      return { refusal: `That iteration row would not read: ${found.reason}` };
    }
    return { record: found.record, note: "" };
  }
  const live = await store.readLive();
  const unreadable = live.filter((outcome) => outcome.kind === "unreadable");
  const readable = live
    .filter((outcome) => outcome.kind === "read")
    .map((outcome) => outcome.record);
  if (readable.length === 0) {
    // An unreadable row is reported rather than counted as "nothing waiting":
    // a person told nothing is open, while a row sits there holding capacity,
    // has been told the one thing that stops them looking.
    if (unreadable.length > 0) {
      return {
        refusal:
          `No live iteration would read. ${String(unreadable.length)} row(s) are there and ` +
          "cannot be decoded; name one with --iteration-id ID to see why, or end it with abandon.",
      };
    }
    return { record: null, note: "Nothing is waiting. No iteration is live." };
  }
  if (readable.length > 1) {
    // **One line, and that is a constraint rather than a preference.** `say`
    // and `refuse` put every message through `asciiEscape` (D-0004), which
    // escapes control characters -- so a newline embedded here reaches the
    // operator as a literal `\u000a` and the list becomes unreadable. That is
    // exactly how it first shipped, and the real run is what caught it.
    const named = readable.map((record) => `${record.id} (${record.status})`).join(", ");
    return {
      refusal:
        `${String(readable.length)} iterations are live, so "the live one" does not name ` +
        `anything. Say which with --iteration-id ID: ${named}`,
    };
  }
  const only = readable[0];
  if (only === undefined) {
    return { record: null, note: "Nothing is waiting. No iteration is live." };
  }
  return { record: only, note: "" };
}

/**
 * The host's two bounds, from the environment, validated.
 *
 * Absent means the default rather than zero: a host nobody has configured
 * should behave the way lap 1 measured, which is one lap at a time with room
 * for a few unanswered questions beside it.
 *
 * **`maxOccupying` is settable, and setting it above one is currently a way to
 * make continuo refuse laps rather than a way to run them.** continuo
 * serialises `lap perform` on one global delivery resource until its `D-1104`
 * lands the holder-identity half; until then a second concurrent lap is refused
 * there. The knob exists here so that the day it lands is a policy edit and not
 * a code change, and this paragraph is what stops the number being raised on
 * the assumption that rondo is the thing in the way.
 */
function hostPolicyOf(
  environment: Readonly<Record<string, string | undefined>>,
): { readonly policy: HostPolicy } | { readonly refusal: string } {
  const read = (name: string, fallback: number): number | string => {
    const raw = environment[name];
    if (raw === undefined || raw.trim() === "") {
      return fallback;
    }
    const value = Number(raw);
    return Number.isInteger(value) ? value : `${name} is '${raw}', which is not a whole number.`;
  };
  const maxOccupying = read(MAX_OCCUPYING_ENV, CONSERVATIVE_HOST_POLICY.maxOccupying);
  if (typeof maxOccupying === "string") {
    return { refusal: maxOccupying };
  }
  const maxLive = read(MAX_LIVE_ENV, CONSERVATIVE_HOST_POLICY.maxLive);
  if (typeof maxLive === "string") {
    return { refusal: maxLive };
  }
  const outcome = hostPolicy({ maxOccupying, maxLive });
  return outcome.kind === "accepted"
    ? { policy: outcome.policy }
    : {
        refusal: `${MAX_OCCUPYING_ENV}/${MAX_LIVE_ENV} do not describe a host that can run: ${outcome.reason}`,
      };
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
    case "revise":
      return await commandRevise(parsed, environment, store, ports, continuo);
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
  // **The iteration id is the one identifier an operator still supplies, and it
  // no longer has a default** (D-0023). It used to fall back to the plan's run
  // id -- a copy of a name the operator had already chosen -- but the run id is
  // derived *from* the iteration id now, so the old default is circular. It is
  // also the value three command lines are built out of, which is why it is
  // checked against a closed alphabet before any row is written.
  if (parsed.iterationId === null) {
    return refuse(
      "start needs --iteration-id ID. rondo derives the run id, the topic branch and the " +
        "workspace from it, so it is the one name a person chooses and the only one that is " +
        "not the host's to mint. It must be a lowercase letter followed by up to 63 more of " +
        "[a-z0-9_-].",
    );
  }
  const iterationId = parsed.iterationId;
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
  const chosen = await pickWaiting(store, parsed.iterationId);
  if ("refusal" in chosen) {
    return refuse(chosen.refusal);
  }
  if (chosen.record === null) {
    say(chosen.note);
    return 0;
  }
  const record = chosen.record;
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

/**
 * Everything that has to be true before a revision may walk the gate.
 *
 * **A separate function because the walk is irreversible and these are not
 * about the plan.** `revisionPlan` already refuses a plan it cannot build, but
 * two things it cannot see would each be discovered *after* the gate had been
 * presented, answered and closed -- at which point the person has spent their
 * gate on an answer that started nothing, and the only way on is the
 * hand-written plan `revise` exists to remove.
 *
 *  1. **The successor's iteration id is not part of its plan**, so a plan can
 *     validate perfectly under an id the store already holds. `reserve` refuses
 *     the duplicate correctly -- but it runs after the walk, and by then the
 *     predecessor is `closed`, so a corrected retry is told that nothing is
 *     live. An `unreadable` row blocks the id too: it is a row, whatever it
 *     says.
 *  2. **The topic branch and the workspace are asked of the machine, not only
 *     of the predecessor's plan.** `revisionPlan` compares the three
 *     identifiers against the predecessor's, which catches the obvious reuse
 *     and is all a layer that may not start a process can do. It does not catch
 *     a branch from two laps ago, a branch something else created, or another
 *     spelling of a path that resolves to the same directory -- and continuo's
 *     materialiser requires that neither exists, discovering it after
 *     `run admit`, which for a revision is after the gate is gone.
 *  3. **A gate continuo has already closed is not an answer this command may
 *     stand on.** `walkGate` handles it correctly and gently -- it says so and
 *     sends nothing -- and that is exactly the trap: the walk *succeeds*, and a
 *     conductor's `resume` then reports `closed` for `withdrawn` and `expired`
 *     as readily as for `answered_and_forwarded`. Read as permission, a
 *     successful no-op walk would start a lap whose instruction was never
 *     recorded anywhere, under a gate outcome that is not a person saying
 *     anything at all.
 *
 * Both were found by review rather than by a walk, which is the half of the
 * ordering argument the first walk could not reach: the happy path never meets
 * either.
 */
export function revisionBlocker(input: {
  readonly predecessorId: string;
  readonly gateOutcome: string | null;
  readonly successorId: string;
  readonly successorRow: ReadOutcome["kind"];
  readonly topicBranch: string;
  readonly topicBranchExists: boolean;
  readonly workspace: string;
  readonly workspaceExists: boolean;
}): string | null {
  if (input.gateOutcome !== null) {
    return (
      `the gate on iteration '${input.predecessorId}' is already closed as ` +
      `'${input.gateOutcome}', so your instruction cannot be carried to it and nothing would ` +
      "record what you asked for. No lap was started. If the work should continue anyway, " +
      "'rondo start' takes a plan whose base branch is this iteration's topic branch."
    );
  }
  if (input.successorRow !== "absent") {
    return (
      `iteration '${input.successorId}' already exists in the store, so the second lap could ` +
      "not be reserved under it -- and the gate would have been answered first. Nothing was " +
      "touched. Choose another --iteration-id, or another --run-id, which is what the " +
      "iteration id defaults to."
    );
  }
  if (input.topicBranchExists) {
    return (
      `branch '${input.topicBranch}' already exists in the repository, and continuo creates the ` +
      "topic branch rather than checking it out -- it requires one that is not there. Nothing " +
      "was touched. Choose another --topic-branch."
    );
  }
  if (input.workspaceExists) {
    return (
      `'${input.workspace}' already exists, and continuo creates the worktree there -- it ` +
      "requires the path not to exist. Nothing was touched. Choose another --workspace."
    );
  }
  return null;
}

/**
 * Door two and a half: answer the gate with a change, and run a second lap.
 *
 * **The defect this closes, stated plainly.** `gate_options` has offered
 * `["approve", "revise"]` since the first dogfood run and the second word bought
 * nothing: `answer` carried whatever a person typed, the gate closed
 * `answered_and_forwarded` either way, and the only thing rondo then said was
 * "Next: rondo publish". Wanting a change meant writing a thirty-two-field plan
 * by hand and knowing, untold, that the next lap's `base_branch` has to be the
 * last lap's `topic_branch`. This command is that, typed once.
 *
 * **The order of the two effects is the whole of its safety.** The successor's
 * plan is composed and fully validated **before** the gate is walked, because
 * the walk cannot be taken back: it presents, delivers and answers through
 * continuo, and the ack closes the gate. A revision refused after that would
 * leave a person having spent their gate on an answer that started nothing, and
 * the way back would be the hand-written plan this command exists to remove. So
 * a bad identifier costs a refusal and nothing else -- the same "validate before
 * the effect" rule `D-0019` rule 14 applies to a spawn, applied to a gate.
 *
 * **The instruction goes to two places and is composed in neither.** continuo
 * gets it byte for byte as the gate's answer, which is where the record of what
 * a person said belongs and the only place it is authoritative; the second lap's
 * prompt gets it appended to the first lap's request by
 * {@link import("../refrain/revision.js").revisionPlan}. rondo writes no part of
 * either (`D-0009`).
 */
async function commandRevise(
  parsed: ParsedCommand,
  environment: Readonly<Record<string, string | undefined>>,
  store: IterationStore,
  ports: ReturnType<typeof conductorPorts>,
  continuo: VerifiedContinuo,
): Promise<number> {
  const actor = approvedActor(parsed, environment);
  if ("refusal" in actor) {
    return refuse(actor.refusal);
  }
  if (parsed.body === null || parsed.body === "") {
    return refuse(
      "revise needs --body=TEXT, saying what to change. It is carried to the gate byte for " +
        "byte and appended to the second lap's prompt, so there is nothing to carry without " +
        "it. Write it with an equals sign: an instruction may begin with a dash.",
    );
  }
  // **One identifier now, and it used to be three.** The second lap is a second
  // run -- continuo holds a run under the first lap's id, git holds its branch
  // and a worktree stands at its workspace -- so it needs identifiers of its
  // own. Under `D-0023` rondo derives all three from the iteration id, so this
  // is the only one a person types.
  const successorId = parsed.iterationId;
  if (successorId === null) {
    return refuse(
      "revise needs --iteration-id ID, which is the id the second lap is reserved under. " +
        "rondo derives its run id, topic branch and workspace from it, so it must be new and " +
        "must be a lowercase letter followed by up to 63 more of [a-z0-9_-]. What carries the " +
        "work across is the branch, and rondo sets that for you: the second lap's base branch " +
        "is the first lap's topic branch.",
    );
  }

  // **The iteration being revised is resolved the way `answer` resolves it**,
  // which since `D-0023` means "the one live iteration, and a refusal when
  // that does not name one". `--iteration-id` is already spoken for here: on
  // this verb alone it names the successor rather than the row being acted on,
  // which `D-0027` chose when there could only ever be one live row to revise.
  // With more than one open there is no second flag to say which, so revise is
  // unavailable until the others are settled -- a real limitation, recorded
  // rather than papered over with a guess at which row was meant.
  const chosen = await pickWaiting(store, null);
  if ("refusal" in chosen) {
    return refuse(chosen.refusal);
  }
  if (chosen.record === null) {
    say("Nothing is waiting. No iteration is live, so there is nothing to revise.");
    return 0;
  }
  const record = chosen.record;
  if (record.gateId === null) {
    say(`iteration '${record.id}' is ${record.status}, and no gate is open on it.`);
    say("There is nothing for a person to answer yet.");
    return 0;
  }

  // Composed and validated first. Nothing below this line is undoable.
  const successor = revisionPlan({
    predecessor: record,
    iterationId: successorId,
    instruction: parsed.body,
  });
  if (successor.kind === "refused") {
    return refuse(
      `The second lap's plan was refused, and the gate was not touched: ${successor.reason}`,
    );
  }

  const observed = await showGate(continuo, { db: planField(record, "db"), gateId: record.gateId });
  if (observed.kind !== "answered") {
    return relayFailure("gate show", observed);
  }
  const gate = observed.payload;

  // The last two refusals, and the last things that cost nothing. See
  // `revisionBlocker`: the id the successor will be reserved under is not part
  // of the plan that was just validated, and a gate continuo has already closed
  // is walked successfully and silently.
  //
  // **The successor's branch and workspace are derived here rather than read
  // off the plan** (`D-0023` rule 9): the plan no longer carries them, and what
  // the preflight has to ask git about is the name `admit()` will actually
  // mint. Deriving it twice -- once here, once at admission -- is safe because
  // the derivation is a pure function of the id, which is the property that
  // makes the check meaningful at all.
  const allocation = allocate(successorId, successor.plan.workspaceRoot);
  if (allocation.kind === "refused") {
    return refuse(`The second lap's iteration id was refused: ${allocation.reason}`);
  }
  const successorTopicBranch = allocation.allocation.topicBranch;
  const successorWorkspace = allocation.allocation.workspace;
  const existing = await store.read(successorId);
  // **Asked of git, and a refusal when git will not say.** The branch is the
  // one preflight that needs a process, so it is `forge.ts`'s (this module has
  // no spawn binding, and D-0025 rule 7 is that property rather than a
  // promise). An unreadable answer is refused rather than read as room to
  // proceed: the next thing this command does cannot be undone.
  const branch = await inspectTopicBranch({
    repository: successor.plan.repository,
    topicBranch: successorTopicBranch,
  });
  if (branch.kind === "malformed") {
    return refuse(
      `'${successorTopicBranch}' is not a name git will accept for a branch, so nothing ` +
        "could create it -- and a name that cannot exist reads as a name that is free. Nothing " +
        "was touched. Choose another --iteration-id.",
    );
  }
  if (branch.kind !== "read") {
    return refuse(
      `git could not say whether '${successorTopicBranch}' already exists in ` +
        `${successor.plan.repository}: ${branch.reason}. continuo requires a topic branch that ` +
        "is not there, and rondo will not answer the gate without knowing. Nothing was touched.",
    );
  }
  const blocker = revisionBlocker({
    predecessorId: record.id,
    gateOutcome: gate.outcome,
    successorId,
    successorRow: existing.kind,
    topicBranch: successorTopicBranch,
    topicBranchExists: branch.exists,
    workspace: successorWorkspace,
    workspaceExists: existsSync(successorWorkspace),
  });
  if (blocker !== null) {
    return refuse(blocker);
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
  // **A walk that sent nothing is not permission to start a lap.** The gate was
  // closed by somebody else between the read above and the walk's own, so the
  // instruction reached nothing -- and the outcome it closed at may be
  // `withdrawn` or `expired`, which are not a person saying anything. `resume`
  // below would settle the row at `closed` for any of them, so this is the
  // check that keeps a successor from running on an answer that was never
  // recorded. The row is still settled, because that is true and useful.
  if (!walked.answerSent) {
    const report = await resume(ports, record.id);
    sayReport(report);
    say("");
    say(
      "Your instruction was not carried to the gate, so no second lap was started. The " +
        "iteration above is settled; 'rondo start' is how the work continues from here.",
    );
    return 1;
  }

  const report = await resume(ports, record.id);
  sayReport(report);
  // **The second lap does not start until the first row is terminal**, and this
  // is a refusal rather than an attempt because the attempt has a worse failure
  // mode: `reserve` would answer `occupied` -- correctly -- and the operator
  // would read a single-flight message about an iteration they had just
  // answered, with no idea that the answer is what had not landed.
  if (report.status !== "closed") {
    say("");
    say(
      "The first iteration did not reach 'closed', so no second lap was started. Run " +
        "'rondo answer' to see where its gate stands.",
    );
    return 1;
  }

  say("");
  say(`revising as iteration '${successorId}', cut from '${successor.plan.baseBranch}'`);
  say("the lap is the step that is slow");
  const second = await admit(ports, successor.plan, START_POLICY, successorId);
  sayReport(second);
  if (second.status === "awaiting_human") {
    say("");
    say("A person has to answer this before anything lands. Next: rondo answer");
    return 0;
  }
  if (second.iterationId === null) {
    return 2;
  }
  return second.status === "closed" ? 0 : 1;
}

/** A forge repository as `gh` names one: `owner/name`. */
export interface ForgeSlug {
  readonly owner: string;
  readonly name: string;
}

/** The same, plus the host it is on -- which a remote URL always carries. */
export interface RemoteRepository extends ForgeSlug {
  readonly host: string;
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
export function repositoryFromRemoteUrl(url: string): RemoteRepository | null {
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
  if (host === null || host === "" || path === null) {
    return null;
  }
  const cleaned = path
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\.git$/, "");
  const slug = parseForgeSlug(cleaned);
  return slug === null ? null : { host, owner: slug.owner, name: slug.name };
}

/** Whether two host names are the same forge. `www.` is not a different one. */
function sameHost(left: string, right: string): boolean {
  const bare = (host: string): string => host.toLowerCase().replace(/^www\./, "");
  return bare(left) === bare(right);
}

/**
 * The host a pull request would be opened on, as the forge CLI would resolve it.
 *
 * **`--repo OWNER/NAME` carries no host, so the host has to come from somewhere,
 * and the only safe somewhere is where `gh` gets it.** `gh` reads it from the
 * environment and falls back to github.com, and rondo is handed the same
 * environment it will spawn `gh` under -- so this reads it rather than assuming
 * github.com. Assuming would produce exactly the failure these checks exist to
 * stop: a push approved against one forge while the pull request is opened on
 * another.
 */
export function forgeHost(environment: Readonly<Record<string, string | undefined>>): string {
  const named = environment[FORGE_HOST_ENV];
  return named === undefined || named.trim() === "" ? DEFAULT_FORGE_HOST : named.trim();
}

const FORGE_HOST_ENV = "GH_HOST";
const DEFAULT_FORGE_HOST = "github.com";

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
  /** The host `--repo` is on: what `forgeHost` read, not an assumption. */
  readonly forgeHost: string;
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
 * **Agreement is over the host and every destination, not two path segments
 * and the first URL.** A remote on another host whose path happens to read as
 * `owner/name` is a different repository wearing the same name, and the host to
 * compare against is the one the forge CLI will resolve rather than an assumed
 * github.com (see `forgeHost`). A remote can also push to several URLs at once,
 * and all of them have to agree, because all of them receive the branch.
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
  if (inspection.pushUrls.length === 0) {
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

  // **Every destination, not the first one.** `remote.<name>.pushurl` is
  // multi-valued and `git push` sends to all of them, so a check that read one
  // URL would approve a publish that also reached repositories it never looked
  // at.
  const destinations = inspection.pushUrls.map((url) => ({
    shown: redactRemoteUrl(url),
    repository: repositoryFromRemoteUrl(url),
  }));
  const agrees = (destination: (typeof destinations)[number]): boolean =>
    destination.repository !== null &&
    sameHost(destination.repository.host, input.forgeHost) &&
    sameRepository(destination.repository, wanted);
  const disagreeing = destinations.filter((destination) => !agrees(destination));
  if (disagreeing.length === 0) {
    return { kind: "ready", headRef: input.topicBranch, warnings: [] };
  }

  const differences = disagreeing.map((destination) => {
    const repository = destination.repository;
    return repository === null
      ? `'${destination.shown}' is not a repository rondo can read as OWNER/NAME on a forge`
      : `'${destination.shown}' is '${repository.owner}/${repository.name}' on ${repository.host}`;
  });
  const scope =
    destinations.length === 1
      ? `'${input.remote}' pushes to one place: ${differences[0] ?? ""}`
      : `'${input.remote}' pushes to ${String(destinations.length)} places, and ` +
        `${String(disagreeing.length)} of them do not match: ${differences.join("; ")}`;
  const wantedShown = `'${input.repo}' on ${input.forgeHost}`;
  if (!input.allowRemoteMismatch) {
    return {
      kind: "refused",
      reason:
        "The push and the pull request would not be about the same repository. --repo is " +
        `${wantedShown}, and ${scope}. The push goes to the workspace's remote and the pull ` +
        "request is opened against --repo, so publishing this way puts the branch somewhere the " +
        "pull request does not look. If that is deliberate -- pushing to a fork and opening the " +
        "pull request upstream is the usual reason -- pass --allow-remote-mismatch.",
    };
  }

  // The override was given, so the operator has said the two differ on purpose.
  // What is left is to make the forge agree: a bare `--head branch` names a
  // branch of `--repo`, which is not where the push went. Qualifying it needs
  // one owner on the forge's own host, which is the fork case; anything else --
  // a local path, another host, or several destinations that disagree with each
  // other -- has no single owner to name, and rondo says so rather than
  // choosing one.
  const owners = new Set(
    destinations.map((destination) =>
      destination.repository !== null && sameHost(destination.repository.host, input.forgeHost)
        ? destination.repository.owner
        : null,
    ),
  );
  const owner = owners.size === 1 ? [...owners][0] : null;
  if (owner === null || owner === undefined) {
    return {
      kind: "ready",
      headRef: input.topicBranch,
      warnings: [
        `--allow-remote-mismatch: ${scope}, while the pull request is opened against ` +
          `${wantedShown}. There is no single ${input.forgeHost} owner to qualify the head ` +
          `with, so it stays '${input.topicBranch}' and the forge will look for that branch in ` +
          `'${input.repo}'. Expect the pull-request leg to fail unless it is there.`,
      ],
    };
  }
  return {
    kind: "ready",
    headRef: `${owner}:${input.topicBranch}`,
    warnings: [
      `--allow-remote-mismatch: pushing to '${owner}' on ${input.forgeHost} and opening the ` +
        `pull request against ${wantedShown}. The head is spelled ` +
        `'${owner}:${input.topicBranch}' so that the forge looks for the branch where the push ` +
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

  const chosen = await pickWaiting(store, parsed.iterationId);
  if ("refusal" in chosen) {
    return refuse(chosen.refusal);
  }
  if (chosen.record === null) {
    return refuse(`${chosen.note} Name one with --iteration-id ID to publish a closed iteration.`);
  }
  const record = chosen.record;
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
  const cutFromBranch = planField(record, "base_branch");
  // **A revision's pull request is opened against the branch the *first* lap
  // was cut from, and not the branch *this* lap was cut from.** They are the
  // same value until a `revise` happens, at which point the plan carries both:
  // the second lap's worktree is cut from the first lap's topic branch, which
  // is a branch on this machine that nothing has pushed (`D-0010`), so a pull
  // request against it would name a branch the forge does not have. An absent
  // key is a plan no revision has touched, which is every plan an operator
  // writes.
  const revisionBase = planField(record, "pull_request_base_branch");
  const baseBranch = revisionBase === "" ? cutFromBranch : revisionBase;
  const db = planField(record, "db");
  const runId = record.runId;
  if (runId === null) {
    return refuse(`iteration '${record.id}' records no run id, so there is no run to close.`);
  }
  const remote = parsed.remote ?? DEFAULT_REMOTE;
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
  const host = forgeHost(environment);
  const preflight = publishPreflight({
    repo: parsed.repo,
    remote,
    workspace,
    topicBranch,
    forgeHost: host,
    allowRemoteMismatch: parsed.allowRemoteMismatch,
    inspection: await inspectPushTarget({ workspace, remote, topicBranch }),
  });
  if (preflight.kind === "refused") {
    return refuse(preflight.reason);
  }
  const headRef = preflight.headRef;
  // **The host that was checked is the host that is named**, rather than left
  // to the forge CLI to resolve a second time from its own configuration. It
  // resolves a bare `OWNER/NAME` against whatever host it is set up for, so a
  // preflight that agreed about one host and a command that then reached
  // another would be two answers to one question. `HOST/OWNER/NAME` is a
  // spelling the CLI already accepts, and it makes the two the same answer.
  const forgeRepo = `${host}/${parsed.repo}`;

  // **Read before the plan is printed, for the same reason the preflight is.**
  // The title and the body are what the operator is being asked to approve, so
  // a dry run that printed the three command lines and left the text to be
  // composed later would preview everything except the part a person can only
  // check by reading it.
  const work = await inspectLapWork({ workspace, remote, baseBranch, topicBranch });
  const pullRequest = pullRequestText({
    record,
    runId,
    topicBranch,
    baseBranch,
    headIsQualified: headRef !== topicBranch,
    work,
  });

  say(`iteration '${record.id}' is closed; gate outcome '${record.gateOutcome ?? "(none)"}'`);
  for (const warning of preflight.warnings) {
    say("");
    say(warning);
  }
  say("");
  say("publish runs these three, in order, as you:");
  say(`  1. git -C ${workspace} push ${remote} ${topicBranch}`);
  say(`  2. gh pr create --repo ${forgeRepo} --base ${baseBranch} --head ${headRef}`);
  say(`  3. continuo run close --run-id ${runId} --outcome completed`);
  say("");
  say("the pull request it opens reads:");
  say(`  title: ${pullRequest.title}`);
  say("  body:");
  for (const line of pullRequest.body.split("\n")) {
    say(line === "" ? "" : `    ${line}`);
  }
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
    repo: forgeRepo,
    baseBranch,
    headRef,
    title: pullRequest.title,
    body: pullRequest.body,
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
 * The longest title rondo will compose, in characters.
 *
 * Well inside every forge's own limit, and that is not what it is for. It is
 * the point past which a commit subject has stopped being a summary, and the
 * answer to one that has is to use a different title rather than to cut this
 * one short: **a title that ends in an ellipsis is a title that stops in the
 * middle of a sentence**, which is the defect the first real publish printed.
 */
const TITLE_LIMIT = 120;

/** How many commits, and how many paths, a body lists before it counts the rest. */
const LIST_LIMIT = 20;

/**
 * How long one listed commit subject or path may be before it is described
 * instead of printed.
 *
 * Past this a value has stopped being a line in a list. `LIST_LIMIT` bounds how
 * many entries there are and this bounds how large one can be; together they
 * are what keeps the body inside a forge's own size limit, which is checked
 * after a push that cannot be taken back.
 */
const LISTED_LIMIT = 200;

/**
 * How much of the request the collapsed block carries.
 *
 * A forge body has a size limit and a request has none, so something has to
 * give at some length. What gives is the *quoted input*, at a length no request
 * a person types comes near, and it says how much it left and where the whole
 * of it still is -- which is the difference between a truncation and a loss.
 */
const REQUEST_LIMIT = 4000;

/**
 * The largest body rondo will hand to the forge.
 *
 * Inside GitHub's own 65,536, with room for the difference between characters
 * and the bytes a forge counts. It is the belt to `LIST_LIMIT`, `LISTED_LIMIT`
 * and `REQUEST_LIMIT`'s braces: those bound every part, and this bounds the sum
 * of them, because the thing being prevented -- a pull request refused after
 * the push -- is worth being sure about rather than arguing about.
 */
const BODY_LIMIT = 60_000;

/** What the title and body are composed from. Every value is already on the row. */
export interface PullRequestTextInput {
  readonly record: IterationRecord;
  readonly runId: string;
  readonly topicBranch: string;
  readonly baseBranch: string;
  /**
   * Whether the head is spelled `owner:branch` -- which is to say, whether the
   * push and the pull request go to different repositories.
   *
   * It comes from the preflight rather than from the flag, because the flag is
   * permission to mismatch and this is the mismatch having happened.
   */
  readonly headIsQualified: boolean;
  readonly work: LapWorkInspection;
}

export interface PullRequestText {
  readonly title: string;
  readonly body: string;
}

/**
 * The pull request a person will read: what changed, how it was approved, and
 * what is still theirs.
 *
 * **The request is not the description, and this is the whole of why this
 * function exists.** The request is a prompt written *to an agent*; the first
 * pull request `publish` opened put it in both fields, so the title was the
 * prompt cut off mid-clause and the body was a list of instructions -- "do not
 * build", "do not push" -- standing where an account of the change belongs. It
 * told a reviewer nothing about the diff and several things that were not
 * addressed to them. What rondo has that *is* about the change is the work
 * itself: the commit subjects the lap wrote for people to read, and the paths
 * it touched. Those are the summary; the request is kept as quoted input,
 * collapsed and fenced, because "was this what was asked for?" is a real
 * question a reviewer asks and rondo is the only thing that can still answer it.
 *
 * **Pure, over what `inspectLapWork` read**, for the reason `publishPreflight`
 * is: the rules about what a pull request says are rules about pull requests,
 * and they should be checkable without a repository on disk.
 *
 * **The revision comes off the row, not off this process.** The row records the
 * continuo that actually drove the lap, committed before anything was spawned;
 * the revision this process verified at startup is whatever is installed today,
 * and the pin moves. Publishing a lap after a pin move would otherwise attribute
 * it to a build that never ran it -- which is the provenance the repository asks
 * to be recorded, replaced by a plausible wrong answer. A row with no revision
 * says so rather than borrowing one.
 */
export function pullRequestText(input: PullRequestTextInput): PullRequestText {
  return { title: pullRequestTitle(input), body: pullRequestBody(input) };
}

/**
 * The title: the lap's own first commit subject, or nothing of the kind.
 *
 * A commit subject is the one line in this whole record that was written by
 * somebody for somebody to read, and it is already about the change. Oldest
 * first, because that is the commit the lap set out to make and the ones after
 * it are what the work turned into; `(+N more commits)` says the rest exist
 * without pretending to summarise them.
 *
 * When there is no subject to use -- git could not be read, the branch adds no
 * commit, or the subject is long enough that it is no longer a summary -- the
 * title falls back to naming the branch and the run. That is a plain label
 * rather than a good title, and it is deliberately preferred over a cut-off
 * sentence: a reader can tell a label from a summary, and cannot tell a
 * truncated summary from a wrong one.
 */
function pullRequestTitle(input: PullRequestTextInput): string {
  const fallback = labelTitle(input);
  if (input.work.kind !== "read") {
    return fallback;
  }
  const first = input.work.commits[0];
  if (first === undefined || first.subject === "") {
    return fallback;
  }
  const rest = input.work.commits.length - 1;
  const title =
    rest === 0
      ? first.subject
      : `${first.subject} (+${String(rest)} more commit${rest === 1 ? "" : "s"})`;
  return title.length > TITLE_LIMIT ? fallback : title;
}

/**
 * The label used when no commit subject can be the title.
 *
 * **It is bounded, because a branch name and a run id are not.** Both are the
 * operator's own strings, and a title past the forge's own limit is refused by
 * `gh` *after* the push has already happened -- the one failure mode `publish`
 * cannot undo. So the label steps down: branch and run, then the run alone,
 * then a hard cut. The cut is a cut of an **identifier**, which reads as one;
 * `TITLE_LIMIT` is about summaries that stop mid-sentence, and a label is not a
 * sentence.
 */
function labelTitle(input: PullRequestTextInput): string {
  for (const candidate of [
    `${input.topicBranch} (rondo run ${input.runId})`,
    `rondo run ${input.runId}`,
  ]) {
    if (candidate.length <= TITLE_LIMIT) {
      return candidate;
    }
  }
  return `rondo run ${input.runId}`.slice(0, TITLE_LIMIT);
}

/**
 * The body, and the last check that it is one a forge will take.
 *
 * **Every value it contains is bounded on the way in** -- lists by
 * `LIST_LIMIT`, each listed or row-carried value by `LISTED_LIMIT`, the request
 * by `REQUEST_LIMIT` -- and this is the check that the sum is bounded too. It
 * exists because the failure it prevents is asymmetric: a body the forge
 * refuses is refused after the push, which is the one leg `publish` cannot take
 * back. The quoted request is what gives way first, because it is the one part
 * of the body that is not about this change and is recoverable from the row.
 */
function pullRequestBody(input: PullRequestTextInput): string {
  const whole = composeBody(input, true);
  if (whole.length <= BODY_LIMIT) {
    return whole;
  }
  const withoutRequest = composeBody(input, false);
  return withoutRequest.length <= BODY_LIMIT ? withoutRequest : withoutRequest.slice(0, BODY_LIMIT);
}

/** The body, section by section. */
function composeBody(input: PullRequestTextInput, withRequest: boolean): string {
  const { record, runId, topicBranch, baseBranch, work } = input;
  const lines: string[] = ["## What changed", ""];

  if (work.kind === "read") {
    if (work.commits.length === 0) {
      lines.push(
        `No commit separates \`${listed(topicBranch, "branch name")}\` from ` +
          `\`${listed(work.baseRef, "ref")}\`, so rondo has nothing ` +
          "to summarise here. Whatever this pull request shows, the lap did not commit it.",
        "",
      );
    } else {
      for (const commit of work.commits.slice(0, LIST_LIMIT)) {
        lines.push(`- \`${commit.abbreviatedSha}\` ${listed(commit.subject, "subject")}`);
      }
      const hidden = work.commits.length - LIST_LIMIT;
      if (hidden > 0) {
        lines.push(`- ...and ${String(hidden)} more commit${hidden === 1 ? "" : "s"}.`);
      }
      lines.push("");
    }
    if (work.files.length > 0) {
      const count = work.files.length;
      // **The ref, not the branch name.** What was compared is a ref in the
      // workspace; naming the branch instead would claim this is a comparison
      // against the base the forge will use, which under `--allow-remote-mismatch`
      // it is not (see `forkCaveat`).
      lines.push(
        `${String(count)} file${count === 1 ? "" : "s"} changed against \`${listed(work.baseRef, "ref")}\`:`,
        "",
      );
      for (const file of work.files.slice(0, LIST_LIMIT)) {
        lines.push(`- \`${listed(file.path, "path")}\` ${fileCounts(file)}`);
      }
      const hidden = count - LIST_LIMIT;
      if (hidden > 0) {
        lines.push(`- ...and ${String(hidden)} more file${hidden === 1 ? "" : "s"}.`);
      }
      lines.push("");
    }
    lines.push(...forkCaveat(input, work.baseRef));
  } else {
    // **A history rondo could not read is said out loud rather than left as a
    // silence.** The diff is on the branch either way; what a reader must not
    // do is take an empty section for an empty change.
    lines.push(
      "rondo could not read this branch's history, so it has not summarised the change: " +
        listed(work.reason, "reason"),
      "",
      "The commits on the branch are the record. Read them rather than this section.",
      "",
    );
  }

  lines.push("## How this got here", "");
  lines.push(
    `- rondo walked run \`${listed(runId, "run id")}\` (iteration \`${listed(record.id, "id")}\`) ` +
      `on \`${listed(topicBranch, "branch name")}\`, for \`${listed(baseBranch, "branch name")}\`.`,
  );
  lines.push(`- ${gateSentence(record)}`);
  lines.push(
    `- Against continuo \`${listed(record.continuoRevision ?? "an unrecorded revision", "revision")}\`` +
      `${modelClause(record)}.`,
  );
  if (record.sessionId !== null && record.sessionId !== "") {
    lines.push(`- Session \`${listed(record.sessionId, "session name")}\`.`);
  }
  lines.push("");
  lines.push(
    ...(withRequest
      ? requestBlock(record.request)
      : [
          "The request this lap was given is on this iteration's row in rondo's store. It is not " +
            "quoted here: with it, this body is larger than a pull request may be.",
          "",
        ]),
  );
  lines.push(
    "This pull request was opened by `rondo publish`, which an operator ran. Merging it is not.",
  );
  return lines.join("\n");
}

/**
 * One listed value, or a stand-in saying how long it was.
 *
 * **A list of twenty entries is not a bounded body if an entry is unbounded.**
 * A commit subject and a path are both as long as somebody made them, and a
 * body past the forge's limit is refused by `gh` after the push has already
 * happened -- the one leg `publish` cannot undo. Past `LISTED_LIMIT` the value
 * is replaced rather than cut, for the reason a too-long subject does not
 * become the title: a cut summary cannot be told from a wrong one, and the
 * commit itself is right there to read.
 */
function listed(value: string, what: string): string {
  if (value.length <= LISTED_LIMIT) {
    return value;
  }
  return `(${what} of ${String(value.length)} characters, not printed here)`;
}

/**
 * The line a fork publish needs, and an ordinary one does not.
 *
 * Under `--allow-remote-mismatch` the branch goes to one repository and the
 * pull request is opened in another, so the base rondo compared against is the
 * *workspace's* idea of it and the base the forge diffs against is the target
 * repository's. When those two have drifted, the summary above is honest about
 * a comparison the pull request is not making -- so the body says which
 * comparison it made rather than letting the two be read as one. rondo does not
 * fetch the target's base to settle it: that would be a network effect nothing
 * asked for, on a repository the operator only named.
 */
function forkCaveat(input: PullRequestTextInput, baseRef: string): readonly string[] {
  if (!input.headIsQualified) {
    return [];
  }
  return [
    `This branch was pushed to a different repository than this pull request is opened in, so the ` +
      `summary above compares against \`${baseRef}\` as the workspace has it, which may not be the ` +
      "commit this pull request is actually based on.",
    "",
  ];
}

/** One file's line counts, or the fact that it has none. */
function fileCounts(file: LapFile): string {
  if (file.added === null || file.deleted === null) {
    return "(binary)";
  }
  return `(+${String(file.added)} -${String(file.deleted)})`;
}

/** What the gate says about who approved this, in a reviewer's terms. */
function gateSentence(record: IterationRecord): string {
  const gate =
    record.gateId === null || record.gateId === ""
      ? "The gate"
      : `Gate \`${listed(record.gateId, "gate id")}\``;
  const outcome = listed(record.gateOutcome ?? "unknown", "outcome");
  if (outcome === APPROVED_OUTCOME) {
    return `${gate} closed \`${outcome}\`: a person answered it, and the answer was carried through.`;
  }
  return `${gate} closed \`${outcome}\`.`;
}

/**
 * The model a lap ran on, when the row knows it.
 *
 * Tier and model both, for the reason the row keeps both (see
 * `IterationRecord`): a tier is what an agent type asked for and a model id is
 * what the lap cost, and only the pair says what the tier was worth that day.
 */
function modelClause(record: IterationRecord): string {
  if (record.model === null || record.model === "") {
    return "";
  }
  const tier =
    record.modelTier === null || record.modelTier === ""
      ? ""
      : ` (tier \`${listed(record.modelTier, "tier")}\`)`;
  return `, on \`${listed(record.model, "model id")}\`${tier}`;
}

/**
 * The request, collapsed and quoted as what it is: input to an agent.
 *
 * Fenced rather than laid out as prose, and the fence is longer than the
 * longest run of backticks inside it, so a request that contains a code block
 * cannot end the quotation early and start writing the body. Collapsed, so the
 * instructions in it -- which are addressed to a worker, and often say what
 * *not* to do -- are somewhere a reviewer can go and not something they read
 * where the description of the change should be.
 */
function requestBlock(request: string): readonly string[] {
  // **Quoted as stored, not as tidied.** The emptiness check trims and the
  // quotation does not: surrounding whitespace is part of what the row holds,
  // and a block that says "verbatim" may not silently disagree with the row it
  // came from. Inside a fence it renders as the blank lines it is.
  if (request.trim() === "") {
    return [];
  }
  const shown =
    request.length > REQUEST_LIMIT
      ? `${request.slice(0, REQUEST_LIMIT)}\n[...${String(request.length - REQUEST_LIMIT)} more ` +
        "characters. The whole of it is on this iteration's row in rondo's store.]"
      : request;
  // Over what is **shown**, not over the whole request: a run of backticks past
  // the cut is not in the quotation, and sizing the fence to it would spend the
  // body's remaining size on two fence lines guarding nothing -- turning a
  // bounded truncation back into a pull request too large to open.
  const fence = "`".repeat(Math.max(3, longestBacktickRun(shown) + 1));
  return [
    "<details>",
    "<summary>The request this lap was given (written for the agent, not a description of the change)</summary>",
    "",
    fence,
    shown,
    fence,
    "",
    "</details>",
    "",
  ];
}

/** The longest run of backticks in `text`, so a fence can be longer than it. */
function longestBacktickRun(text: string): number {
  let longest = 0;
  for (const run of text.match(/`+/g) ?? []) {
    longest = Math.max(longest, run.length);
  }
  return longest;
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
